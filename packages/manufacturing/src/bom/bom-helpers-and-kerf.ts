import {
  DesignProject,
  ModuleInstance,
  MaterialDefinition,
  DEFAULT_MATERIALS,
  BoundedLruCache,
  computeProjectStructuralSignature,
  inferDoorSystemIdFromType,
  roundIntMm,
  roundMm,
} from "@birim/core";
import {
  CutPiece,
  EdgeBandingConfig,
  HardwareBOMItem,
  ManufacturingBOM,
  ShelfDeflectionBOMEntry,
} from "../types";

export const STANDARD_SHEET_AREA_M2 = (2800 * 2070) / 1_000_000; // 5.796 m²
export const STANDARD_WASTE_FACTOR = 1.12;

export interface ModuleHardwareCallRecord {
  sku: string;
  name: string;
  category: HardwareBOMItem["category"];
  quantity: number;
  unit: HardwareBOMItem["unit"];
  unitPrice: number;
}

export interface CachedModuleBomSlice {
  cutPieces: CutPiece[];
  hardwareCalls: ModuleHardwareCallRecord[];
  shelfDeflections: ShelfDeflectionBOMEntry[];
  warnings: string[];
  drillingHolesDelta: number;
  dimChainClosed: boolean;
}

export const bomProjectCache = new BoundedLruCache<string, ManufacturingBOM>(48);
export const moduleBomSliceCache = new BoundedLruCache<string, CachedModuleBomSlice>(512);

export function computeMaterialsMapFingerprint(materialsMap: Map<string, MaterialDefinition>): string {
  if (materialsMap.size === DEFAULT_MATERIALS.length) {
    let allMatch = true;
    for (let i = 0; i < DEFAULT_MATERIALS.length; i++) {
      const dm = DEFAULT_MATERIALS[i];
      const cur = materialsMap.get(dm.id);
      if (!cur || cur.costPerM2 !== dm.costPerM2 || cur.category !== dm.category || cur.thickness !== dm.thickness || cur.requiresEdgeBanding !== dm.requiresEdgeBanding || cur.requiresPaintshop !== dm.requiresPaintshop) {
        allMatch = false;
        break;
      }
    }
    if (allMatch) return "DEFAULT_MATS";
  }
  let s = "";
  materialsMap.forEach((m, id) => {
    s += `${id}:${m.category}:${m.thickness}:${m.costPerM2}:${m.densityKgPerM3 || 0}:${m.requiresEdgeBanding ?? ""}:${m.requiresPaintshop ?? ""};`;
  });
  return s;
}

export function computeProjectBOMKey(
  project: DesignProject,
  materialsMap: Map<string, MaterialDefinition>,
  sheetCfg?: import("../sheet-nesting").SheetDimension
): string {
  const scSig = sheetCfg ? `${sheetCfg.lengthMm}x${sheetCfg.widthMm}:${sheetCfg.trimCutMm}:${sheetCfg.kerfMm}` : "std";
  return `${computeProjectStructuralSignature(project)}|SC:${scSig}|MM:${computeMaterialsMapFingerprint(materialsMap)}`;
}

export function formatEdgeBandCode(eb: EdgeBandingConfig): string {
  const bCount = (eb.left ? 1 : 0) + (eb.right ? 1 : 0);
  const eCount = (eb.top ? 1 : 0) + (eb.bottom ? 1 : 0);
  if (bCount === 0 && eCount === 0) return "Bantsız";
  if (bCount === 2 && eCount === 2) return `4K (2B+2E) ${eb.thickness}mm`;
  const parts: string[] = [];
  if (bCount > 0) parts.push(`${bCount}B`);
  if (eCount > 0) parts.push(`${eCount}E`);
  return `${parts.join("+")} ${eb.thickness}mm`;
}

export function doesBayDoorHingeOnLeft(bay: ModuleInstance["bays"][number] | undefined): boolean {
  if (!bay || !bay.door) return false;
  const dType = bay.door.type;
  const dSys = bay.door.doorSystemId || inferDoorSystemIdFromType(dType);
  if (
    dType === "open" ||
    dSys === "open" ||
    dSys.startsWith("sliding") ||
    dSys.startsWith("lift") ||
    dSys === "pocket_retractable" ||
    dSys === "tambour_roller"
  ) {
    return false;
  }
  return (
    dType === "single_left" ||
    String(dType) === "left" ||
    dType === "double" ||
    dType === "inset_left" ||
    dType === "inset_double" ||
    dType === "half_overlay_left" ||
    dType === "folding" ||
    dSys === "hinged_double" ||
    dSys === "folding_side"
  );
}

export function doesBayDoorHingeOnRight(bay: ModuleInstance["bays"][number] | undefined): boolean {
  if (!bay || !bay.door) return false;
  const dType = bay.door.type;
  const dSys = bay.door.doorSystemId || inferDoorSystemIdFromType(dType);
  if (
    dType === "open" ||
    dSys === "open" ||
    dSys.startsWith("sliding") ||
    dSys.startsWith("lift") ||
    dSys === "pocket_retractable" ||
    dSys === "tambour_roller"
  ) {
    return false;
  }
  return (
    dType === "single_right" ||
    String(dType) === "right" ||
    dType === "double" ||
    dType === "inset_right" ||
    dType === "inset_double" ||
    dType === "half_overlay_right" ||
    dSys === "hinged_double"
  );
}

export function hasSinkOrCooktopAppliance(module: ModuleInstance): boolean {
  const sig = `${module.id} ${module.name} ${module.templateId || ""}`.toLowerCase();
  return (
    sig.includes("sink") ||
    sig.includes("evye") ||
    sig.includes("eviye") ||
    sig.includes("cooktop") ||
    sig.includes("ocak") ||
    sig.includes("oven_base")
  );
}

export interface GenerateBOMOptions {
  skipSyncNesting?: boolean;
  sheetConfig?: import("../sheet-nesting").SheetDimension;
}


export interface CurvedKerfBendingSpec {
  outerRadiusMm: number;
  insideRadiusMm: number;
  bendAngleDeg: number;
  panelThicknessMm: number;
  uncutSkinMm: number;
  kerfBladeWidthMm: number;
  kerfDepthMm: number;
  anglePerKerfDeg: number;
  kerfCount: number;
  kerfSpacingMm: number;
  unfoldedArcLengthMm: number;
}

/**
 * Exact closing-wedge CNC kerf-bending geometry for curved / stadium-capsule wooden & MDF panels:
 * - `kerfDepth = stockThickness - uncutSkin`
 * - `anglePerKerfRad = 2 * atan((kerfBladeWidth / 2) / kerfDepth)`
 * - `kerfCount = ceil(bendAngleRad / anglePerKerfRad)`
 * - `kerfSpacingMm = (insideRadius + kerfDepth) * anglePerKerfRad`
 * - `unfoldedArcLengthMm = outerRadius * bendAngleRad`
 */
export function computeCurvedKerfBendingSpec(
  outerRadiusMm: number,
  bendAngleDeg = 180,
  panelThicknessMm = 18,
  kerfBladeWidthMm = 3.2,
  uncutSkinMm = 2.5
): CurvedKerfBendingSpec {
  const rOut = Math.max(40, outerRadiusMm);
  const t = Math.max(8, panelThicknessMm);
  const skin = Math.max(1.5, Math.min(t * 0.35, uncutSkinMm));
  const kerfDepth = Math.max(4, t - skin);
  const rIn = Math.max(20, rOut - t);
  const thetaRad = (Math.max(15, bendAngleDeg) * Math.PI) / 180;
  const alphaRad = 2 * Math.atan(Math.max(0.8, kerfBladeWidthMm) / 2 / kerfDepth);
  const kerfCount = Math.max(2, Math.ceil(thetaRad / alphaRad));
  const kerfSpacing = (rIn + kerfDepth) * alphaRad;
  const unfoldedArc = rOut * thetaRad;

  return {
    outerRadiusMm: roundMm(rOut, 1),
    insideRadiusMm: roundMm(rIn, 1),
    bendAngleDeg: roundMm(bendAngleDeg, 1),
    panelThicknessMm: t,
    uncutSkinMm: roundMm(skin, 2),
    kerfBladeWidthMm: roundMm(kerfBladeWidthMm, 2),
    kerfDepthMm: roundMm(kerfDepth, 2),
    anglePerKerfDeg: roundMm((alphaRad * 180) / Math.PI, 2),
    kerfCount,
    kerfSpacingMm: roundMm(kerfSpacing, 1),
    unfoldedArcLengthMm: roundMm(unfoldedArc, 1),
  };
}
