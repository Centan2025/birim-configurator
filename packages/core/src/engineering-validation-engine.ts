import { DesignProject, ModuleInstance, Position3D } from "./types";
import { evaluateProjectCompatibility } from "./v4-compatibility";
import {
  RegionErgonomicProfileId,
  RuleGovernanceNature,
  getErgonomicProfile,
  roundGeometryMm,
} from "./tolerance-policy";
import {
  BoundedLruCache,
  computeProjectStructuralSignature,
} from "./lru-cache";
import { loadCustomStandardRules } from "./standards-registry";
import {
  EngineeringValidationFinding,
  RemediationProposal,
  TipOverStabilityResult,
  isModuleBackedByWall,
  evaluateFreestandingTipOverRisk,
  evaluateLongTermShelfDeflection,
} from "./engineering-validation/stability-and-deflection";
import { runPerModuleEngineeringAudits } from "./engineering-validation/module-engineering-audits";
import { runStackedAndCustomVerificationAudits } from "./engineering-validation/stacked-and-custom-audits";
import {
  applyApprovedRemediationProposal,
  ProductionGateBlockedError,
  assertProductionExportAllowed,
} from "./engineering-validation/remediation-and-gate";

export type {
  RemediationProposal,
  EngineeringValidationFinding,
  TipOverStabilityResult,
};
export {
  isModuleBackedByWall,
  evaluateFreestandingTipOverRisk,
  evaluateLongTermShelfDeflection,
  applyApprovedRemediationProposal,
  ProductionGateBlockedError,
  assertProductionExportAllowed,
};

const unifiedEngineeringLruCache = new BoundedLruCache<
  string,
  ReturnType<typeof evaluateUnifiedEngineeringModelUncached>
>(64);
const moduleEngineeringSliceCache = new BoundedLruCache<string, EngineeringValidationFinding[]>(512);

export function evaluateUnifiedEngineeringModel(
  project: DesignProject,
  options?: { ergonomicProfileId?: RegionErgonomicProfileId; referenceDateIso?: string }
) {
  const customRulesCnt = loadCustomStandardRules().length;
  if (!options?.referenceDateIso && customRulesCnt === 0) {
    const key = `${options?.ergonomicProfileId || project.ergonomicProfileId || "TR"}|${project.libraryVersionId || ""}|${computeProjectStructuralSignature(project)}`;
    const hit = unifiedEngineeringLruCache.get(key);
    if (hit) return hit;
    const computed = evaluateUnifiedEngineeringModelUncached(project, options);
    unifiedEngineeringLruCache.set(key, computed);
    return computed;
  }
  return evaluateUnifiedEngineeringModelUncached(project, options);
}

function evaluateUnifiedEngineeringModelUncached(
  project: DesignProject,
  options?: { ergonomicProfileId?: RegionErgonomicProfileId; referenceDateIso?: string }
): {
  findings: EngineeringValidationFinding[];
  blockingSafetyAndEngineeringErrors: EngineeringValidationFinding[];
  verificationRequiredFindings: EngineeringValidationFinding[];
  ergonomicAdvisories: EngineeringValidationFinding[];
  canExportToCncAndSaw: boolean;
  canApproveFinalErpRelease: boolean;
} {
  const ergProfile = getErgonomicProfile(
    options?.ergonomicProfileId || project.ergonomicProfileId || "TR"
  );
  const compatReport = evaluateProjectCompatibility(
    project,
    options?.referenceDateIso ? { referenceDateIso: options.referenceDateIso } : undefined
  );

  const findingsMap = new Map<string, EngineeringValidationFinding>();
  const addProjectFinding = (f: EngineeringValidationFinding) => {
    const key = `${f.code}::${f.targetId || f.targetComponentId || "global"}`;
    const prev = findingsMap.get(key);
    if (!prev || (!prev.remediationProposals?.length && f.remediationProposals?.length) || (!prev.worldPositionMm && f.worldPositionMm)) {
      findingsMap.set(key, f);
    }
  };
  let addFinding = addProjectFinding;

  const targetIdToModule = new Map<string, ModuleInstance>();
  for (let mi = 0; mi < project.modules.length; mi++) {
    const m = project.modules[mi];
    targetIdToModule.set(m.id, m);
    for (let bi = 0; bi < m.bays.length; bi++) {
      const b = m.bays[bi];
      if (b.door?.id) targetIdToModule.set(b.door.id, m);
      for (let di = 0; di < b.drawers.length; di++) {
        targetIdToModule.set(b.drawers[di].id, m);
      }
      for (let si = 0; si < b.shelves.length; si++) {
        targetIdToModule.set(b.shelves[si].id, m);
      }
    }
  }

  // 1. Mevcut çekirdek ve V4 uyumluluk bulgularını yönetişim sınıflarıyla zenginleştir (compatReport.issues zaten validateProject bulgularını içerir!)
  for (const iss of compatReport.issues) {
    const isUnverified = iss.compatibilityStatus === "UNVERIFIED" || iss.code.startsWith("CHK_15_");
    const isSafety =
      iss.code.includes("TIPOVER") ||
      iss.code.includes("VENTILATION") ||
      iss.code.includes("CEILING_COLLISION") ||
      iss.code.includes("WALL_LOAD") ||
      iss.code.includes("TEMPERED_GLASS");
    const isErgonomic =
      iss.code.startsWith("WARN_SHELF_HEIGHT") ||
      iss.code.startsWith("WARN_RAIL_HEIGHT") ||
      iss.code.startsWith("WARN_NARROW_PASSAGE") ||
      iss.code.startsWith("WARN_WORK_TRIANGLE");

    const ruleNature: RuleGovernanceNature = isUnverified
      ? "VERIFICATION_REQUIRED"
      : isSafety
      ? "MANDATORY_SAFETY"
      : iss.severity === "error" || iss.blockingProduction
      ? "ENGINEERING_VALIDITY"
      : isErgonomic
      ? "ERGONOMIC_ADVISORY"
      : "ENGINEERING_VALIDITY";

    const hostMod = iss.targetId ? targetIdToModule.get(iss.targetId) : undefined;

    const worldPos: Position3D | undefined = hostMod
      ? {
          x: roundGeometryMm(hostMod.position.x + hostMod.dimensions.width / 2),
          y: roundGeometryMm(hostMod.position.y + hostMod.dimensions.height / 2),
          z: roundGeometryMm(hostMod.position.z + hostMod.dimensions.depth),
        }
      : undefined;

    addProjectFinding({
      ...iss,
      ruleNature,
      targetModuleId: hostMod?.id,
      targetComponentId: iss.targetId,
      worldPositionMm: worldPos,
    });
  }

  const allObstacles = [
    ...(project.space.elements || []),
    ...(project.space.walls || []).flatMap((w) => w.elements || []),
  ];
  const roomWidthMm = project.space.walls?.[0]?.length || 4000;
  const roomDepthMmEnv = project.space?.walls?.[1]?.length || 3200;
  let customMatsEnvSig = "";
  const customMatsArr = project.customMaterials || [];
  for (let i = 0; i < customMatsArr.length; i++) {
    const cm = customMatsArr[i];
    customMatsEnvSig += `${cm.id}:${cm.densityKgPerM3 || 0}:${cm.elasticModulusMpa || 0}:${cm.mechanicalDataVerified ? 1 : 0};`;
  }
  let obsEnvSig = "";
  for (let i = 0; i < allObstacles.length; i++) {
    const ob = allObstacles[i];
    obsEnvSig += `${ob.id}:${ob.type}:${ob.position.x},${ob.position.y},${ob.position.z}:${ob.dimensions.width}x${ob.dimensions.height}x${ob.dimensions.depth}:${ob.rotationY || 0};`;
  }
  const spaceSlopeEnv = project.space.slopedCeiling
    ? `${project.space.slopedCeiling.mode}:${project.space.slopedCeiling.kneeHeightMm}:${project.space.slopedCeiling.slopeAngleDeg}:${project.space.slopedCeiling.topFlatSpanMm || 0}`
    : "";
  const spaceCeilCfgEnv = project.space?.ceilingConfig
    ? JSON.stringify(project.space.ceilingConfig)
    : "";
  const spaceEnvSig = `${roomWidthMm}x${roomDepthMmEnv}|H:${project.space.ceilingHeight || 0}|WS:${project.space.wallSubstrateType || ""}|SLP:${spaceSlopeEnv}|CEIL:${spaceCeilCfgEnv}|OBS:${obsEnvSig}|CM:${customMatsEnvSig}`;


  runPerModuleEngineeringAudits({
    project,
    ergProfile,
    allObstacles,
    roomWidthMm,
    spaceEnvSig,
    moduleEngineeringSliceCache,
    addProjectFinding,
  });

  runStackedAndCustomVerificationAudits(project, addProjectFinding);

  const findings = Array.from(findingsMap.values());
  const blockingSafetyAndEngineeringErrors = findings.filter(
    (f) =>
      (f.ruleNature === "MANDATORY_SAFETY" || f.ruleNature === "ENGINEERING_VALIDITY") &&
      (f.severity === "error" || f.blockingProduction)
  );
  const verificationRequiredFindings = findings.filter(
    (f) => f.ruleNature === "VERIFICATION_REQUIRED"
  );
  const ergonomicAdvisories = findings.filter((f) => f.ruleNature === "ERGONOMIC_ADVISORY");

  return {
    findings,
    blockingSafetyAndEngineeringErrors,
    verificationRequiredFindings,
    ergonomicAdvisories,
    canExportToCncAndSaw: blockingSafetyAndEngineeringErrors.length === 0,
    canApproveFinalErpRelease:
      blockingSafetyAndEngineeringErrors.length === 0 && verificationRequiredFindings.length === 0,
  };
}
