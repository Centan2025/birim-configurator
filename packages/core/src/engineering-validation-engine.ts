import {
  DesignProject,
  ModuleInstance,
  Position3D,
  SpaceDefinition,
  ValidationIssue,
} from "./types";
import { DEFAULT_MATERIALS } from "./defaults";
import {
  calculateBayWidths,
  calculateModulePlacement,
  calculateNetInnerDepth,
  calculateNetInnerHeight,
  calculateShelfDeflection,
  validateProject,
} from "./rules";
import {
  calculateFourSpaceDimensions,
  inferDoorSystemIdFromType,
  resolveCanonicalDrawerCuttingFormula,
  resolveCanonicalHandlePlacement,
} from "./v4-profiles";
import { ENGINEERING_TOLERANCE_POLICY } from "./tolerance-policy";
import {
  isBuiltInOvenOrFridgeTower,
  isSinkModule,
} from "./parametric-spec-engine";
import { evaluateProjectCompatibility } from "./v4-compatibility";
import { computeEffectiveCeilingClearHeight } from "./ceiling-and-grain-engine";
import {
  RuleGovernanceNature,
  RegionErgonomicProfileId,
  getErgonomicProfile,
  roundCncCoordMm,
  roundGeometryMm,
} from "./tolerance-policy";

function resolveCoreHandleSpacingCcMm(door?: {
  handleCategory?: string;
  handleProfileId?: string;
  handleLengthMm?: number;
}): number {
  const hCat = door?.handleCategory || "bar_handle";
  if (hCat === "knob") return 1;
  const pid = (door?.handleProfileId || "").toLowerCase();
  const matchCc = pid.match(/(?:cc|_)(\d{2,4})$/) || pid.match(/(96|128|160|192|224|256|320|480|640|960)/);
  if (matchCc) return Number(matchCc[1]);
  if (typeof door?.handleLengthMm === "number" && door.handleLengthMm >= 64) {
    return Math.max(32, door.handleLengthMm - 24);
  }
  if (hCat === "long_profile_handle") return 320;
  return 160;
}

export interface RemediationProposal {
  id: string;
  label: string;
  description: string;
  requiresExplicitUserApproval: true;
  targetModuleId: string;
  targetBayIndex?: number;
  targetComponentId?: string;
  patchKind:
    | "enable_wall_anchor"
    | "increase_module_depth"
    | "switch_hinge_155_zero"
    | "add_internal_drawer_spacer"
    | "switch_single_to_double_door"
    | "enable_siphon_cutout"
    | "reduce_drawer_runner_nl"
    | "add_wall_filler_50mm"
    | "increase_plinth_for_ventilation"
    | "snap_stacked_to_support_or_floor"
    | "align_stacked_width_to_base"
    | "expand_module_width"
    | "switch_handle_to_knob"
    | "clamp_height_to_usable_sheet"
    | "upgrade_shelf_thickness_25mm"
    | "increase_hinge_count"
    | "confirm_wall_substrate"
    | "upgrade_wet_zone_board"
    | "switch_topology_sides_through";
  patchPayload: Record<string, number | string | boolean>;
}

export interface EngineeringValidationFinding extends ValidationIssue {
  ruleNature: RuleGovernanceNature;
  targetModuleId?: string;
  targetComponentId?: string;
  worldPositionMm?: Position3D;
  remediationProposals?: RemediationProposal[];
}

export interface TipOverStabilityResult {
  moduleId: string;
  isApplicable: boolean;
  slendernessRatioHD: number;
  stabilizingMomentNm: number;
  overturningMomentNm: number;
  safetyFactor: number;
  isBackedByWall: boolean;
  requiresWallAnchor: boolean;
  isSafe: boolean;
  reason?: string;
}

/**
 * Modülün arkasında 40mm mesafe içinde gerçek bir oda duvarı bulunup bulunmadığını denetler.
 */
export function isModuleBackedByWall(
  module: ModuleInstance,
  space?: SpaceDefinition
): boolean {
  if (!space || !space.walls || space.walls.length === 0) {
    return module.position.z <= 40;
  }
  const rotDeg = (((module.rotation?.y ?? 0) % 360) + 360) % 360;
  if (Math.abs(rotDeg) <= 8 || Math.abs(rotDeg - 360) <= 8) {
    if (module.position.z <= 45) return true;
  }
  const roomW = space.walls[0]?.length || 4000;
  const roomD = space.walls[1]?.length || 3200;
  if (Math.abs(rotDeg - 90) <= 8 && module.position.x <= 45) return true;
  if (Math.abs(rotDeg - 270) <= 8 && module.position.x + module.dimensions.depth >= roomW - 45) {
    return true;
  }
  if (Math.abs(rotDeg - 180) <= 8 && module.position.z + module.dimensions.depth >= roomD - 45) {
    return true;
  }
  return false;
}

/**
 * EN 14749:2016+A1:2022 & EN 16122:2012 Serbest Duran Yüksek Dolap Devrilme Kararlılığı Hesabı (P0-03).
 * Açık çekmecelerin ağırlık merkezi kaymasını ve ön kenar düşey test kuvvetini (75 N) değerlendirir.
 */
export function evaluateFreestandingTipOverRisk(
  module: ModuleInstance,
  space?: SpaceDefinition
): TipOverStabilityResult {
  const { width, height, depth } = module.dimensions;
  const isFreestandingFloorUnit =
    module.category !== "kitchen_wall" &&
    module.category !== "complementary" &&
    module.position.y <= 50;

  if (!isFreestandingFloorUnit || height < 600) {
    return {
      moduleId: module.id,
      isApplicable: false,
      slendernessRatioHD: roundGeometryMm(height / Math.max(1, depth)),
      stabilizingMomentNm: 0,
      overturningMomentNm: 0,
      safetyFactor: 99,
      isBackedByWall: true,
      requiresWallAnchor: false,
      isSafe: true,
    };
  }

  const T = module.carcass.panelThickness || 18;
  const plinthSetback = Math.min(75, Math.max(0, module.carcass.plinthSetbackMm ?? 35));
  const effectiveSupportDepthMm = Math.max(120, depth - plinthSetback);
  const slendernessRatioHD = roundGeometryMm(height / effectiveSupportDepthMm);

  // Tahmini boş gövde kütlesi (18mm yonga levha ~ 12.2 kg/m²)
  const approxSurfaceAreaM2 =
    (2 * (height * depth) + 2 * (width * depth) + width * height * 1.6) / 1_000_000;
  const emptyCarcassMassKg = Math.max(14, approxSurfaceAreaM2 * (T / 18) * 12.2);
  const g = 9.81;

  // Denge momenti: Gövde ağırlık merkezi ön devrilme mesnedinden (effectiveSupportDepth / 2) geridedir
  const leverStabM = (effectiveSupportDepthMm * 0.5) / 1000;
  const stabilizingMomentNm = roundCncCoordMm(emptyCarcassMassKg * g * leverStabM);

  // Devrilme momenti: EN 16122 açık çekmece yükü + kapak/çekmece ön kenar düşey test kuvveti (75 N)
  const totalDrawers = module.bays.reduce((acc, b) => acc + b.drawers.length, 0);
  const avgExtensionM = (Math.min(500, Math.max(250, depth - 60)) * 0.67) / 1000;
  const perDrawerLoadedKg = Math.max(6, (width / 1000) * (depth / 1000) * 28);
  // EN 16122 kilitli olmayan ünitelerde en elverişsiz çekmecenin tam açılımı + ön yük (75 N)
  const openDrawerMomentNm =
    totalDrawers > 0 ? Math.min(2, totalDrawers) * perDrawerLoadedKg * g * avgExtensionM : 0;
  const frontTestForceN = height >= 1000 ? 75 : 50;
  const frontLeverM = Math.max(0.22, Math.min(0.55, (depth * 0.65) / 1000));
  const overturningMomentNm = roundCncCoordMm(openDrawerMomentNm + frontTestForceN * frontLeverM);

  const safetyFactor =
    overturningMomentNm > 0
      ? roundCncCoordMm(stabilizingMomentNm / overturningMomentNm)
      : 99;

  const isHighSlenderness = height >= 900 && slendernessRatioHD > 2.4;
  const isMomentUnstable = safetyFactor < 1.35;
  const requiresWallAnchor = isHighSlenderness || isMomentUnstable || height >= 1600;
  const backedByWall = isModuleBackedByWall(module, space);

  const explicitlyDisabledAnchor = module.carcass.wallAnchored === false;
  const explicitlyFloorAnchored = module.carcass.floorAnchored === true;

  let isSafe = true;
  let reason: string | undefined;

  if (requiresWallAnchor) {
    if (explicitlyDisabledAnchor && !explicitlyFloorAnchored) {
      isSafe = false;
      reason = `Modül "${module.name}" (H=${height}mm, D=${depth}mm, Narinlik H/D=${slendernessRatioHD}, Devrilme Emniyet Katsayısı=${safetyFactor}) EN 14749 devrilme sınırını aşıyor; duvar sabitlemesi devre dışı bırakılamaz.`;
    } else if (!backedByWall && !explicitlyFloorAnchored && module.carcass.wallAnchored !== true) {
      isSafe = false;
      reason = `Serbest duran yüksek ünite "${module.name}" (H=${height}mm, D=${depth}mm, H/D=${slendernessRatioHD}, SF=${safetyFactor}) arkasında duvar olmadan devrilme riski taşıyor (EN 14749 / EN 16122). Duvara yaslayın, derinliği artırın veya zemine çelik ankraj onaylayın.`;
    }
  }

  return {
    moduleId: module.id,
    isApplicable: true,
    slendernessRatioHD,
    stabilizingMomentNm,
    overturningMomentNm,
    safetyFactor,
    isBackedByWall: backedByWall,
    requiresWallAnchor,
    isSafe,
    reason,
  };
}

/**
 * Uzun dönem viskoelastik sünme (creep factor k_def) ve temperli cam emniyetini dikkate alan raf sehim denetimi.
 */
export function evaluateLongTermShelfDeflection(params: {
  spanMm: number;
  depthMm: number;
  thicknessMm: number;
  materialCategory: string;
  uniformLoadKgPerM2?: number;
}): {
  instantDeflectionMm: number;
  longTermDeflectionMm: number;
  maxAllowedMm: number;
  passed: boolean;
  requiresSafetyGlassCheck: boolean;
} {
  const { spanMm, depthMm, thicknessMm, materialCategory } = params;
  const loadKgM2 = params.uniformLoadKgPerM2 ?? 65; // EN 16122 konut/ofis depolama raf yükü (0.65 kN/m²)
  const totalForceN = (spanMm / 1000) * (depthMm / 1000) * loadKgM2 * 9.81;

  const isGlass = materialCategory === "glass" || materialCategory === "mirror";
  const E_MPa = isGlass
    ? 70000
    : materialCategory === "lacquer" || materialCategory === "wood"
    ? 2800
    : 2200;
  // Ahşap esaslı panellerde uzun dönem nem/yük sünme katsayısı k_def = 0.80 (Eurocode 5 / EN 16122)
  const kDef = isGlass ? 0.0 : 0.8;
  const I_mm4 = (Math.max(80, depthMm) * Math.pow(Math.max(4, thicknessMm), 3)) / 12;

  const instantDeflectionMm =
    I_mm4 > 0 ? (5 * totalForceN * Math.pow(spanMm, 3)) / (384 * E_MPa * I_mm4) : 99;
  const longTermDeflectionMm = instantDeflectionMm * (1 + kDef);
  const maxAllowedMm = isGlass ? spanMm / 300 : spanMm / 200;

  const glassTooThin = isGlass && (thicknessMm < 6 || (spanMm > 700 && thicknessMm < 8));

  return {
    instantDeflectionMm: roundCncCoordMm(instantDeflectionMm),
    longTermDeflectionMm: roundCncCoordMm(longTermDeflectionMm),
    maxAllowedMm: roundCncCoordMm(maxAllowedMm),
    passed: longTermDeflectionMm <= maxAllowedMm && !glassTooThin,
    requiresSafetyGlassCheck: isGlass,
  };
}

/**
 * Merkezi Birleşik Mühendislik, Konstrüksiyon, Mekân ve Üretilebilirlik Doğrulama Motoru (Bölüm 8 & 9).
 */
export function evaluateUnifiedEngineeringModel(
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
    options?.ergonomicProfileId || project.ergonomicProfileId
  );
  const compatReport = evaluateProjectCompatibility(project, options?.referenceDateIso);
  const baseProjectIssues = validateProject(project);

  const findingsMap = new Map<string, EngineeringValidationFinding>();
  const addFinding = (f: EngineeringValidationFinding) => {
    const key = `${f.code}::${f.targetComponentId || f.targetId || "global"}`;
    if (!findingsMap.has(key)) {
      findingsMap.set(key, f);
    }
  };

  // 1. Mevcut çekirdek ve V4 uyumluluk bulgularını yönetişim sınıflarıyla zenginleştir
  for (const iss of [...baseProjectIssues, ...compatReport.issues]) {
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

    const hostMod = project.modules.find(
      (m) =>
        m.id === iss.targetId ||
        m.bays.some(
          (b) =>
            b.door?.id === iss.targetId ||
            b.drawers.some((d) => d.id === iss.targetId) ||
            b.shelves.some((s) => s.id === iss.targetId)
        )
    );

    const worldPos: Position3D | undefined = hostMod
      ? {
          x: roundGeometryMm(hostMod.position.x + hostMod.dimensions.width / 2),
          y: roundGeometryMm(hostMod.position.y + hostMod.dimensions.height / 2),
          z: roundGeometryMm(hostMod.position.z + hostMod.dimensions.depth),
        }
      : undefined;

    addFinding({
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

  // 2. Modül bazlı derin mühendislik denetimleri (P0-03, P1-02, P1-06, P2-01, P2-02, P2-04)
  for (const mod of project.modules) {
    if (mod.category === "complementary") continue;

    const T = mod.carcass.panelThickness || 18;
    const plinthH = mod.carcass.plinthHeight || 0;
    const fourSpace = calculateFourSpaceDimensions(mod, project.customMaterials);
    const bayWidths = calculateBayWidths(mod);
    const netInnerD = calculateNetInnerDepth(mod);
    const netInnerH = calculateNetInnerHeight(mod);

    // 2a. Serbest Duran Yüksek Dolap Devrilme Güvenliği (EN 14749 / P0-03)
    const tipCheck = evaluateFreestandingTipOverRisk(mod, project.space);
    if (!tipCheck.isSafe && tipCheck.reason) {
      addFinding({
        severity: "error",
        code: "ERR_FREESTANDING_TIPOVER_UNSAFE",
        message: tipCheck.reason,
        targetId: mod.id,
        targetModuleId: mod.id,
        targetComponentId: mod.id,
        blockingProduction: true,
        compatibilityStatus: "INCOMPATIBLE",
        sourceId: "SRC_EN_14749_2022",
        ruleNature: "MANDATORY_SAFETY",
        worldPositionMm: {
          x: roundGeometryMm(mod.position.x + mod.dimensions.width / 2),
          y: roundGeometryMm(mod.position.y + mod.dimensions.height * 0.75),
          z: roundGeometryMm(mod.position.z + mod.dimensions.depth),
        },
        suggestions: [
          "Modülü arka duvara yaslayıp EN 14749 çelik L-braket duvar sabitlemesini etkinleştirin.",
          "Serbest ada/bölücü kullanımda taban derinliğini artırın veya zemine çelik ankraj onaylayın.",
        ],
        remediationProposals: [
          {
            id: `fix_tip_anchor_${mod.id}`,
            label: "Duvar/Zemin Devrilme Sabitlemesini Onayla (EN 14749)",
            description:
              "BOM listesine 2 adet çelik L-duvar/zemin sabitleme braketi ekler ve devrilme emniyetini onaylar.",
            requiresExplicitUserApproval: true,
            targetModuleId: mod.id,
            patchKind: "enable_wall_anchor",
            patchPayload: tipCheck.isBackedByWall
              ? { wallAnchored: true }
              : { floorAnchored: true },
          },
          {
            id: `fix_tip_depth_${mod.id}`,
            label: `Gövde Derinliğini ${Math.max(550, Math.ceil(mod.dimensions.height / 2.4 / 10) * 10)}mm Yap`,
            description: "Taban derinliğini büyüterek devrilme denge momentini güvenli sınıra taşır.",
            requiresExplicitUserApproval: true,
            targetModuleId: mod.id,
            patchKind: "increase_module_depth",
            patchPayload: {
              depth: Math.max(550, Math.ceil(mod.dimensions.height / 2.4 / 10) * 10),
            },
          },
        ],
      });
    }

    // 2b. Dinamik Menteşe Y Kotları ile İç Çekmece Fiziksel Çarpışma Kontrolü (P1-02)
    let bayCursorX = T;
    mod.bays.forEach((bay, bayIdx) => {
      const bayW = bayWidths[bayIdx] || 500;
      const leaf = fourSpace.doorLeaves[bayIdx];
      const dSys = bay.door?.doorSystemId || inferDoorSystemIdFromType(bay.door?.type || "open");

      if (leaf && dSys.startsWith("hinged") && leaf.hingePositionsY.length > 0) {
        const doorOffsetAboveInnerBottom = (leaf.doorY0Mm || plinthH) - (plinthH + T);
        const hingeInnerYs = leaf.hingePositionsY.map((hy) =>
          roundGeometryMm(doorOffsetAboveInnerBottom + hy)
        );
        const hasZeroProtrusionOrSpacer =
          bay.door.hardwareProductId === "hw_blum_71b7550" ||
          bay.door.hardwareProductId === "hw_hettich_9099540" ||
          mod.carcass.internalDrawerHingeSolution === "spacer_block_25mm" ||
          mod.carcass.internalDrawerHingeSolution === "zero_protrusion_155deg";

        bay.drawers.forEach((drw) => {
          if (!drw.isInternal) return;
          // Ray montaj ekseni çekmece tabanından ~22mm yukarıdadır; menteşe tabanı ±42mm yasaklı kuşak oluşturur
          const runnerMountY = drw.elevationY + 22;
          const clashingHingeY = hingeInnerYs.find(
            (hy) =>
              Math.abs(runnerMountY - hy) < 42 ||
              (hy >= drw.elevationY - 12 && hy <= drw.elevationY + Math.min(65, drw.height))
          );

          if (clashingHingeY !== undefined && !hasZeroProtrusionOrSpacer) {
            addFinding({
              severity: "error",
              code: "ERR_INTERNAL_DRAWER_HINGE_BODY_CLASH",
              message: `"${mod.name}" Bölme ${bayIdx + 1}: İç çekmece (Y=${drw.elevationY}mm) gerçek menteşe gövdesiyle (Y=${clashingHingeY}mm) fiziksel olarak çakışıyor; ray monte edilemez ve çekmece açılamaz.`,
              targetId: drw.id,
              targetModuleId: mod.id,
              targetComponentId: drw.id,
              blockingProduction: true,
              compatibilityStatus: "INCOMPATIBLE",
              sourceId: "SRC_BLUM_CAT_HINGE",
              ruleNature: "ENGINEERING_VALIDITY",
              worldPositionMm: {
                x: roundGeometryMm(mod.position.x + bayCursorX + bayW / 2),
                y: roundGeometryMm(mod.position.y + plinthH + T + clashingHingeY),
                z: roundGeometryMm(mod.position.z + mod.dimensions.depth - 37),
              },
              suggestions: [
                "Menteşeyi Blum 155° Sıfır Çıkıntılı (71B7550) modele yükseltin ve çekmece kotunu menteşeden 50mm uzaklaştırın.",
                "İç çekmece yanına 25mm menteşe besleme çıtası (spacer_block_25mm) ekleyin.",
              ],
              remediationProposals: [
                {
                  id: `fix_int_drw_spacer_${drw.id}`,
                  label: "25mm İç Çekmece Besleme Çıtası Ekle",
                  description:
                    "Gövde yanına 25mm besleme çıtası ekleyerek iç çekmece rayını menteşe gövdesinden kurtarır.",
                  requiresExplicitUserApproval: true,
                  targetModuleId: mod.id,
                  targetBayIndex: bayIdx,
                  targetComponentId: drw.id,
                  patchKind: "add_internal_drawer_spacer",
                  patchPayload: { internalDrawerHingeSolution: "spacer_block_25mm" },
                },
                {
                  id: `fix_int_drw_155_${drw.id}`,
                  label: "Blum 155° Sıfır Çıkıntılı Menteşeye Geç (71B7550)",
                  description: "Kapak tam açıldığında iç açıklığı sıfır çıkıntıyla serbest bırakır.",
                  requiresExplicitUserApproval: true,
                  targetModuleId: mod.id,
                  targetBayIndex: bayIdx,
                  targetComponentId: bay.door.id,
                  patchKind: "switch_hinge_155_zero",
                  patchPayload: { hardwareProductId: "hw_blum_71b7550" },
                },
              ],
            });
          }
        });
      }


      // 2b-ii. Özel İç Donanım Net Genişlik / Net Derinlik / Net Yükseklik ve Menteşe Kambur Payı Denetimi (Bölüm 4)
      const fittingEnvelopeSpecs: Record<
        string,
        {
          label: string;
          minWidthMm: number;
          maxWidthMm: number;
          minDepthMm: number;
          minHeightMm: number;
          isSideRunnerPullout: boolean;
        }
      > = {
        trouser_rack: {
          label: "Teleskopik Pantolonluk",
          minWidthMm: 420,
          maxWidthMm: 1200,
          minDepthMm: 450,
          minHeightMm: 550,
          isSideRunnerPullout: true,
        },
        shoe_rack: {
          label: "Raylı Ayakkabılık",
          minWidthMm: 380,
          maxWidthMm: 1200,
          minDepthMm: 330,
          minHeightMm: 160,
          isSideRunnerPullout: true,
        },
        wire_basket: {
          label: "Teleskopik Tel Sepet",
          minWidthMm: 340,
          maxWidthMm: 1050,
          minDepthMm: 430,
          minHeightMm: 150,
          isSideRunnerPullout: true,
        },
        jewelry_tray: {
          label: "Kadife Takı Çekmecesi",
          minWidthMm: 350,
          maxWidthMm: 1200,
          minDepthMm: 400,
          minHeightMm: 80,
          isSideRunnerPullout: true,
        },
        pantry_pullout: {
          label: "Tandem / Dispensa Boy Kiler Mekanizması",
          minWidthMm: 250,
          maxWidthMm: 570,
          minDepthMm: 490,
          minHeightMm: 1100,
          isSideRunnerPullout: true,
        },
        imove_pull_down: {
          label: "Asansörlü Üst Dolap Rafı (iMove)",
          minWidthMm: 450,
          maxWidthMm: 880,
          minDepthMm: 260,
          minHeightMm: 480,
          isSideRunnerPullout: false,
        },
        foldable_ironing_board: {
          label: "Katlanır Raylı Ütü Masası",
          minWidthMm: 350,
          maxWidthMm: 580,
          minDepthMm: 480,
          minHeightMm: 140,
          isSideRunnerPullout: true,
        },
        spice_pullout: {
          label: "Dar Şişelik / Baharatlık Mekanizması",
          minWidthMm: 110,
          maxWidthMm: 280,
          minDepthMm: 450,
          minHeightMm: 450,
          isSideRunnerPullout: true,
        },
        waste_bin: {
          label: "Raylı Çöp Ayrıştırma Mekanizması",
          minWidthMm: 350,
          maxWidthMm: 880,
          minDepthMm: 420,
          minHeightMm: 360,
          isSideRunnerPullout: false,
        },
        swivel_mirror: {
          label: "Döner Raylı Boy Aynası",
          minWidthMm: 340,
          maxWidthMm: 1200,
          minDepthMm: 360,
          minHeightMm: 1000,
          isSideRunnerPullout: true,
        },
        dish_drainer: {
          label: "Paslanmaz Tabaklık / Bardaklık",
          minWidthMm: 400,
          maxWidthMm: 980,
          minDepthMm: 250,
          minHeightMm: 280,
          isSideRunnerPullout: false,
        },
      };

      const bayHasZeroProtrusionOrSpacer =
        bay.door?.hardwareProductId === "hw_blum_71b7550" ||
        bay.door?.hardwareProductId === "hw_hettich_9099540" ||
        mod.carcass.internalDrawerHingeSolution === "spacer_block_25mm" ||
        mod.carcass.internalDrawerHingeSolution === "zero_protrusion_155deg";

      (bay.specialFittings || []).forEach((fit) => {
        if (fit.isHidden) return;
        const env = fittingEnvelopeSpecs[fit.type];
        if (!env) return;

        const widthTooNarrow = bayW < env.minWidthMm;
        const widthTooWide = bayW > env.maxWidthMm;
        const depthTooShallow = netInnerD < env.minDepthMm;
        const heightTooLow = netInnerH < env.minHeightMm;

        if (widthTooNarrow || widthTooWide || depthTooShallow || heightTooLow) {
          const reasons: string[] = [];
          if (widthTooNarrow) reasons.push(`net iç genişlik ${roundGeometryMm(bayW)}mm < min ${env.minWidthMm}mm`);
          if (widthTooWide) reasons.push(`net iç genişlik ${roundGeometryMm(bayW)}mm > maks ${env.maxWidthMm}mm`);
          if (depthTooShallow) reasons.push(`net iç derinlik ${roundGeometryMm(netInnerD)}mm < min ${env.minDepthMm}mm`);
          if (heightTooLow) reasons.push(`net iç yükseklik ${roundGeometryMm(netInnerH)}mm < min ${env.minHeightMm}mm`);

          const proposals: RemediationProposal[] = [];
          if (depthTooShallow) {
            const depthDelta = env.minDepthMm - netInnerD;
            proposals.push({
              id: `fix_fit_depth_${fit.id}`,
              label: `Gövde Derinliğini ${Math.ceil(mod.dimensions.depth + depthDelta + 6)}mm Yap`,
              description: `${env.label} mekanizmasının ray boyu için gereken ${env.minDepthMm}mm net iç derinliği sağlar.`,
              requiresExplicitUserApproval: true,
              targetModuleId: mod.id,
              targetBayIndex: bayIdx,
              targetComponentId: fit.id,
              patchKind: "increase_module_depth",
              patchPayload: { depth: Math.ceil(mod.dimensions.depth + depthDelta + 6) },
            });
          }
          if (widthTooNarrow) {
            const neededExtraW = Math.ceil((env.minWidthMm - bayW) * Math.max(1, mod.bays.length));
            proposals.push({
              id: `fix_fit_width_${fit.id}`,
              label: `Modül Genişliğini ${mod.dimensions.width + neededExtraW}mm Yap`,
              description: `${env.label} için gereken minimum ${env.minWidthMm}mm bölme açıklığını sağlar.`,
              requiresExplicitUserApproval: true,
              targetModuleId: mod.id,
              targetBayIndex: bayIdx,
              targetComponentId: fit.id,
              patchKind: "expand_module_width",
              patchPayload: { width: mod.dimensions.width + neededExtraW },
            });
          }

          addFinding({
            severity: "error",
            code: "ERR_INTERNAL_FITTING_ENVELOPE_VIOLATION",
            message: `"${mod.name}" Bölme ${bayIdx + 1}: ${env.label} (${fit.type}) mevcut iç hacme sığmıyor (${reasons.join("; ")}).`,
            targetId: fit.id,
            targetModuleId: mod.id,
            targetComponentId: fit.id,
            blockingProduction: true,
            compatibilityStatus: "INCOMPATIBLE",
            sourceId: "SRC_HAFELE_WARDROBE_ACC",
            ruleNature: "ENGINEERING_VALIDITY",
            worldPositionMm: {
              x: roundGeometryMm(mod.position.x + bayCursorX + bayW / 2),
              y: roundGeometryMm(mod.position.y + plinthH + T + (fit.elevationY || 200)),
              z: roundGeometryMm(mod.position.z + mod.dimensions.depth * 0.5),
            },
            suggestions: [
              `${env.label} için net iç genişlik ${env.minWidthMm}–${env.maxWidthMm}mm ve net iç derinlik en az ${env.minDepthMm}mm olmalıdır.`,
            ],
            remediationProposals: proposals.length > 0 ? proposals : undefined,
          });
        }

        // Yan raylı iç mekanizma menteşeli kapak arkasındaysa menteşe gövdesi Y çakışması ve 25mm kambur payı kontrolü
        if (env.isSideRunnerPullout && leaf && dSys.startsWith("hinged") && leaf.hingePositionsY.length > 0) {
          const doorOffY = (leaf.doorY0Mm || plinthH) - (plinthH + T);
          const fitHingeYs = leaf.hingePositionsY.map((hy) => roundGeometryMm(doorOffY + hy));
          const runnerAxisY = (fit.elevationY || 0) + 18;
          const clashingHingeY = fitHingeYs.find(
            (hy) =>
              Math.abs(runnerAxisY - hy) < 34 ||
              (hy >= fit.elevationY - 10 && hy <= fit.elevationY + Math.min(48, fit.height || 90))
          );

          if (clashingHingeY !== undefined && !bayHasZeroProtrusionOrSpacer) {
            addFinding({
              severity: "error",
              code: "ERR_INTERNAL_FITTING_HINGE_BODY_CLASH",
              message: `"${mod.name}" Bölme ${bayIdx + 1}: ${env.label} yan rayı (Y=${fit.elevationY}mm) menteşe taban plakasıyla (Y=${clashingHingeY}mm) çakışıyor!`,
              targetId: fit.id,
              targetModuleId: mod.id,
              targetComponentId: fit.id,
              blockingProduction: true,
              compatibilityStatus: "INCOMPATIBLE",
              sourceId: "SRC_BLUM_CAT_HINGE",
              ruleNature: "ENGINEERING_VALIDITY",
              worldPositionMm: {
                x: roundGeometryMm(mod.position.x + bayCursorX + bayW / 2),
                y: roundGeometryMm(mod.position.y + plinthH + T + clashingHingeY),
                z: roundGeometryMm(mod.position.z + mod.dimensions.depth - 37),
              },
              suggestions: [
                "25mm yan besleme çıtası (spacer_block_25mm) ekleyin veya 155° sıfır çıkıntılı menteşeye geçin.",
                "Aksesuar kotunu menteşe ekseninden en az 45mm yukarı/aşağı kaydırın.",
              ],
              remediationProposals: [
                {
                  id: `fix_fit_spacer_${fit.id}`,
                  label: "25mm Yan Besleme Çıtası Ekle",
                  description: "Yan rayı menteşe gövdesinden ve kapak kamburundan kurtarır.",
                  requiresExplicitUserApproval: true,
                  targetModuleId: mod.id,
                  targetBayIndex: bayIdx,
                  targetComponentId: fit.id,
                  patchKind: "add_internal_drawer_spacer",
                  patchPayload: { internalDrawerHingeSolution: "spacer_block_25mm" },
                },
                {
                  id: `fix_fit_155_${fit.id}`,
                  label: "Blum 155° Sıfır Çıkıntılı Menteşeye Geç (71B7550)",
                  description: "Kapak açıldığında iç net açıklığı sıfır çıkıntıyla serbest bırakır.",
                  requiresExplicitUserApproval: true,
                  targetModuleId: mod.id,
                  targetBayIndex: bayIdx,
                  targetComponentId: bay.door.id,
                  patchKind: "switch_hinge_155_zero",
                  patchPayload: { hardwareProductId: "hw_blum_71b7550" },
                },
              ],
            });
          } else if (
            !bayHasZeroProtrusionOrSpacer &&
            bay.door?.overlayType !== "inset" &&
            (fit.type === "wire_basket" || fit.type === "foldable_ironing_board" || fit.type === "pantry_pullout")
          ) {
            addFinding({
              severity: "warning",
              code: "WARN_INTERNAL_PULLOUT_HINGE_SPACER_REQUIRED",
              message: `"${mod.name}" Bölme ${bayIdx + 1}: Standart 110° menteşeli kapak arkasındaki ${env.label} için ~22–25mm kapak kambur mesafe pulu/çıtası veya 155° sıfır çıkıntılı menteşe kullanılmalıdır.`,
              targetId: fit.id,
              targetModuleId: mod.id,
              targetComponentId: fit.id,
              blockingProduction: false,
              compatibilityStatus: "COMPATIBLE_WITH_CONDITIONS",
              sourceId: "SRC_BLUM_CAT_HINGE",
              ruleNature: "ENGINEERING_VALIDITY",
              remediationProposals: [
                {
                  id: `adv_fit_spacer_${fit.id}`,
                  label: "25mm Besleme Çıtası Tanımla",
                  description: "BOM ve montaj föyüne 25mm yan besleme çıtası ekler.",
                  requiresExplicitUserApproval: true,
                  targetModuleId: mod.id,
                  targetBayIndex: bayIdx,
                  targetComponentId: fit.id,
                  patchKind: "add_internal_drawer_spacer",
                  patchPayload: { internalDrawerHingeSolution: "spacer_block_25mm" },
                },
              ],
            });
          }
        }
      });

      // 2c. Duvar Köşesine Sıfır Kulplu Menteşeli Kapak 90° Açılım & Kulp Çarpışma Kontrolü (P2-01)
      const handleCat = bay.door?.handleCategory || "bar_handle";
      const hasProtrudingHandle =
        handleCat === "bar_handle" ||
        handleCat === "knob" ||
        handleCat === "long_profile_handle" ||
        handleCat === "decorative_bespoke";

      if (dSys.startsWith("hinged") && hasProtrudingHandle) {
        const isLeftmostBay = bayIdx === 0;
        const isRightmostBay = bayIdx === mod.bays.length - 1;
        const hingesLeft =
          bay.door.type === "single_left" ||
          bay.door.type === "inset_left" ||
          bay.door.type === "half_overlay_left" ||
          bay.door.type === "double" ||
          bay.door.type === "inset_double";
        const hingesRight =
          bay.door.type === "single_right" ||
          bay.door.type === "inset_right" ||
          bay.door.type === "half_overlay_right" ||
          bay.door.type === "double" ||
          bay.door.type === "inset_double";

        const hasLeftFiller = project.modules.some(
          (other) =>
            other.id !== mod.id &&
            other.complementaryRole === "wall_filler" &&
            Math.abs(other.position.x + other.dimensions.width - mod.position.x) <= 15
        );
        const hasRightFiller = project.modules.some(
          (other) =>
            other.id !== mod.id &&
            other.complementaryRole === "wall_filler" &&
            Math.abs(other.position.x - (mod.position.x + mod.dimensions.width)) <= 15
        );

        const modRotNorm = (((mod.rotation?.y ?? 0) % 360) + 360) % 360;
        const roomDepthMm = project.space?.walls?.[1]?.length || 3200;
        const isRot0 = Math.abs(modRotNorm) <= 8 || Math.abs(modRotNorm - 360) <= 8;
        const isRot90 = Math.abs(modRotNorm - 90) <= 8;
        const isRot270 = Math.abs(modRotNorm - 270) <= 8;

        const hitsLeftReturnWall =
          isLeftmostBay &&
          hingesLeft &&
          !hasLeftFiller &&
          ((isRot0 && mod.position.x <= 15) ||
            (isRot90 && mod.position.z + mod.dimensions.width >= roomDepthMm - 15) ||
            (isRot270 && mod.position.z <= 15));
        const hitsRightReturnWall =
          isRightmostBay &&
          hingesRight &&
          !hasRightFiller &&
          ((isRot0 && mod.position.x + mod.dimensions.width >= roomWidthMm - 15) ||
            (isRot90 && mod.position.z <= 15) ||
            (isRot270 && mod.position.z + mod.dimensions.width >= roomDepthMm - 15));

        if (hitsLeftReturnWall || hitsRightReturnWall) {
          const blocksInternalPullout = bay.drawers.some((d) => d.isInternal);
          addFinding({
            severity: blocksInternalPullout ? "error" : "warning",
            code: "CHK_SPATIAL_WALL_CORNER_HANDLE_SWING_CLASH",
            message: `"${mod.name}" yan duvara kör parça (wall_filler) olmadan sıfır yerleştirildi; kapak açıldığında çıkıntılı kulp yan duvara çarparak 90° açılımı ${
              blocksInternalPullout ? "ve iç çekmece çıkışını engeller!" : "kısıtlar."
            }`,
            targetId: bay.door.id,
            targetModuleId: mod.id,
            targetComponentId: bay.door.id,
            blockingProduction: blocksInternalPullout,
            compatibilityStatus: blocksInternalPullout
              ? "INCOMPATIBLE"
              : "COMPATIBLE_WITH_CONDITIONS",
            ruleNature: blocksInternalPullout ? "ENGINEERING_VALIDITY" : "ERGONOMIC_ADVISORY",
            worldPositionMm: {
              x: roundGeometryMm(
                hitsLeftReturnWall ? mod.position.x + 15 : mod.position.x + mod.dimensions.width - 15
              ),
              y: roundGeometryMm(mod.position.y + mod.dimensions.height * 0.55),
              z: roundGeometryMm(mod.position.z + mod.dimensions.depth),
            },
            suggestions: [
              "Duvar ile dolap arasına en az 45-50mm Kör Parça (wall_filler) ekleyin.",
              "Kulpsuz J-Kanal (j_pull) veya Bas-Aç kapak mekanizmasına geçin.",
            ],
            remediationProposals: [
              {
                id: `fix_wall_filler_${mod.id}`,
                label: "Duvar Arasına 50mm Kör Parça Payı Bırak",
                description:
                  "Modülü yan duvardan 50mm içeri kaydırarak kapak kulpunun 90° serbest açılmasını sağlar.",
                requiresExplicitUserApproval: true,
                targetModuleId: mod.id,
                targetBayIndex: bayIdx,
                patchKind: "add_wall_filler_50mm",
                patchPayload: {
                  shiftXMm: hitsLeftReturnWall ? 50 : -50,
                },
              },
            ],
          });
        }
      }

      // 2d. Eviye Kazan Hacmi ile Üst Çekmece Çarpışma Denetimi (P1-06)
      if (isSinkModule(mod)) {
        const sinkBowlBottomFromInnerTopMm = 230;
        const safeDrawerTopLimitY = Math.max(0, netInnerH - sinkBowlBottomFromInnerTopMm);
        bay.drawers.forEach((drw) => {
          const drwTopY = drw.elevationY + drw.height;
          if (drwTopY > safeDrawerTopLimitY && !drw.hasSiphonCutout) {
            addFinding({
              severity: "error",
              code: "ERR_SINK_BOWL_DRAWER_COLLISION",
              message: `Eviye modülü "${mod.name}" üst çekmecesi (üst kot ${drwTopY}mm > izin verilen ${safeDrawerTopLimitY}mm) eviye kazanı ve sifon tesisatıyla çarpışıyor; U-sifon kesimi zorunludur.`,
              targetId: drw.id,
              targetModuleId: mod.id,
              targetComponentId: drw.id,
              blockingProduction: true,
              compatibilityStatus: "INCOMPATIBLE",
              sourceId: "SRC_BLUM_SINK_DRAWER",
              ruleNature: "ENGINEERING_VALIDITY",
              worldPositionMm: {
                x: roundGeometryMm(mod.position.x + bayCursorX + bayW / 2),
                y: roundGeometryMm(mod.position.y + plinthH + T + drwTopY),
                z: roundGeometryMm(mod.position.z + mod.dimensions.depth * 0.5),
              },
              suggestions: [
                "Çekmecede U-Sifon Boşaltmasını (hasSiphonCutout) etkinleştirin.",
                "Üst bölgeyi sabit kör klapa yapıp çekmeceyi alt kota indirin.",
              ],
              remediationProposals: [
                {
                  id: `fix_sink_siphon_${drw.id}`,
                  label: "Çekmeceye CNC U-Sifon Boşaltması Uygula",
                  description:
                    "Çekmece tabanına ve sırtlığına sifon/batarya geçişi için U-kesim ve dönüş aparatı ekler.",
                  requiresExplicitUserApproval: true,
                  targetModuleId: mod.id,
                  targetBayIndex: bayIdx,
                  targetComponentId: drw.id,
                  patchKind: "enable_siphon_cutout",
                  patchPayload: { hasSiphonCutout: true },
                },
              ],
            });
          }
        });
      }


      // P0-02: Kulp Vida Ekseni (C-C) — Kapak ve Çekmece Klapa Genişliğine Sığma Kontrolü (Sessiz Kırpma Yasak!)
      if (!mod.isOpenFront && bay.door && bay.door.type !== "open" && dSys !== "open") {
        const hCat = bay.door.handleCategory || "bar_handle";
        const doorProf = bay.door.crossSectionProfile || mod.carcass.crossSectionProfile || "flat_slab";
        const doorCc = resolveCoreHandleSpacingCcMm(bay.door);
        if (leaf && leaf.leafCount > 0) {
          const isLift = dSys.startsWith("lift_");
          const hCheck = resolveCanonicalHandlePlacement({
            partRole: "door_left",
            partId: isLift ? `${bay.door.id}_lift` : bay.door.id,
            frontWidthMm: leaf.leafWidthMm,
            frontHeightMm: leaf.leafHeightMm,
            frontElevationYMm: leaf.doorY0Mm,
            moduleCategory: mod.category,
            moduleElevationYMm: mod.position.y,
            handleCategory: hCat,
            openingTechnology: bay.door.openingTechnology,
            crossSectionProfile: doorProf,
            spacingCcMm: doorCc,
            handleOrientation: bay.door.handleOrientation,
            handleOffsetY: bay.door.handleOffsetY,
            handleEdgeInsetX: bay.door.handleEdgeInsetX,
          });
          if (hCheck.exceedsPanelSpan) {
            const avail = hCheck.orientation === "horizontal" ? leaf.leafWidthMm : leaf.leafHeightMm;
            addFinding({
              severity: "error",
              code: "ERR_HANDLE_CC_EXCEEDS_PANEL_SPAN",
              message: `"${mod.name}" Bölme ${bayIdx + 1}: Seçilen kulp vida ekseni (C-C ${hCheck.spacingCcMm}mm + kenar payları = min ${hCheck.minRequiredSpanMm}mm), kapak ölçüsüne (${avail}mm) sığmıyor!`,
              targetId: bay.door.id,
              targetModuleId: mod.id,
              targetComponentId: bay.door.id,
              blockingProduction: true,
              compatibilityStatus: "INCOMPATIBLE",
              ruleNature: "ENGINEERING_VALIDITY",
              suggestions: [
                "Tek delikli Düğme Kulp (knob) veya daha kısa C-C eksenli kulp seçin.",
                "Bölme/kapak genişliğini büyütün.",
              ],
              remediationProposals: [
                {
                  id: `fix_door_handle_knob_${bay.door.id}`,
                  label: "Tek Delikli Düğme Kulpa (Knob) Geç",
                  description: "Dar kapakta vida ekseni taşmasını tek M4 merkez bağlantısıyla çözer.",
                  requiresExplicitUserApproval: true,
                  targetModuleId: mod.id,
                  targetBayIndex: bayIdx,
                  targetComponentId: bay.door.id,
                  patchKind: "switch_handle_to_knob",
                  patchPayload: { handleCategory: "knob" },
                },
              ],
            });
          }
        }
      }

      bay.drawers.forEach((drw) => {
        if (drw.isHidden || drw.isInternal) return;
        const hCat = bay.door?.handleCategory || "bar_handle";
        const doorProf = bay.door?.crossSectionProfile || mod.carcass.crossSectionProfile || "flat_slab";
        const drwCc = resolveCoreHandleSpacingCcMm(bay.door);
        const drwFrontW = Math.max(80, bayW + 2 * T - 4);
        const drwHCheck = resolveCanonicalHandlePlacement({
          partRole: "drawer_front",
          partId: `${drw.id}_front`,
          frontWidthMm: drwFrontW,
          frontHeightMm: drw.height,
          moduleCategory: mod.category,
          handleCategory: hCat,
          openingTechnology: bay.door?.openingTechnology,
          crossSectionProfile: doorProf,
          spacingCcMm: drwCc,
        });
        if (drwHCheck.exceedsPanelSpan) {
          addFinding({
            severity: "error",
            code: "ERR_HANDLE_CC_EXCEEDS_PANEL_SPAN",
            message: `"${mod.name}" Bölme ${bayIdx + 1}: Çekmece klapası genişliği (${roundGeometryMm(
              drwFrontW
            )}mm), seçilen kulp vida ekseni (C-C ${drwHCheck.spacingCcMm}mm, min ${drwHCheck.minRequiredSpanMm}mm) için yetersiz!`,
            targetId: drw.id,
            targetModuleId: mod.id,
            targetComponentId: drw.id,
            blockingProduction: true,
            compatibilityStatus: "INCOMPATIBLE",
            ruleNature: "ENGINEERING_VALIDITY",
            suggestions: [
              "Düğme kulp (knob), 96mm dar kulp veya Bas-Aç (push_to_open) seçin.",
            ],
            remediationProposals: [
              {
                id: `fix_drw_handle_knob_${drw.id}`,
                label: "Bölme Kulplarını Düğme Kulpa (Knob) Çevir",
                description: "Dar çekmece klapasına sığmayan kulp eksenini tek nokta bağlantıya çevirir.",
                requiresExplicitUserApproval: true,
                targetModuleId: mod.id,
                targetBayIndex: bayIdx,
                targetComponentId: drw.id,
                patchKind: "switch_handle_to_knob",
                patchPayload: { handleCategory: "knob" },
              },
            ],
          });
        }
      });

      // P1-02: Fiziksel Euler-Bernoulli Raf Sehimi (EN 16122 L/200 Güvenlik & Cam Raf Kalınlık Denetimi)
      const bodyMatObj =
        (project.customMaterials || []).find((m) => m.id === mod.carcass.bodyMaterialId) ||
        DEFAULT_MATERIALS.find((m) => m.id === mod.carcass.bodyMaterialId) ||
        DEFAULT_MATERIALS[0];
      const baseShelfMatCat: "melamine" | "lacquer" | "wood" | "glass" | "metal" =
        bodyMatObj.category === "lacquer"
          ? "lacquer"
          : bodyMatObj.category === "wood"
          ? "wood"
          : bodyMatObj.category === "glass"
          ? "glass"
          : bodyMatObj.category === "metal"
          ? "metal"
          : "melamine";
      const designLoadKgPerM =
        mod.category === "kitchen_tall" || mod.name.toLowerCase().includes("kitap") ? 45 : 35;

      bay.shelves.forEach((sh) => {
        if (sh.isHidden) return;
        const shThick = sh.thickness || (sh.isGlass ? 8 : T);
        const shCat = sh.isGlass ? "glass" : baseShelfMatCat;
        const shDepth = Math.max(150, netInnerD - (sh.frontSetbackMm ?? 15));
        const rawDefl = calculateShelfDeflection(bayW, shDepth, shThick, shCat, designLoadKgPerM);
        // Fixed cam-locked shelves supported along the rear grooved/flush back panel act as 3-edge supported plates (factor 0.42)
        const supportBoundaryFactor =
          !sh.isAdjustable && !sh.isGlass && mod.carcass.backPanelType !== "none" ? 0.42 : 1.0;
        const effDeflectionMm = roundGeometryMm(rawDefl.deflectionMm * supportBoundaryFactor);
        const en16122LimitMm = roundGeometryMm(bayW / 200);
        const glassTooThinForSpan =
          Boolean(sh.isGlass) && ((shThick < 8 && bayW > 700) || (shThick < 10 && bayW > 950));

        if (effDeflectionMm > en16122LimitMm || glassTooThinForSpan) {
          const targetThick = sh.isGlass ? (bayW > 950 ? 10 : 8) : 25;
          addFinding({
            severity: "error",
            code: "ERR_SHELF_STRUCTURAL_DEFLECTION",
            message: glassTooThinForSpan
              ? `"${mod.name}" Bölme ${bayIdx + 1}: ${shThick}mm cam raf ${roundGeometryMm(
                  bayW
                )}mm açıklık için kırılma riski taşıyor (en az ${targetThick}mm temperli cam gerekir).`
              : `"${mod.name}" Bölme ${bayIdx + 1}: ${shThick}mm raf sehimi (${effDeflectionMm}mm), EN 16122 güvenlik sınırını (L/200 = ${en16122LimitMm}mm) aşıyor!`,
            targetId: sh.id,
            targetModuleId: mod.id,
            targetComponentId: sh.id,
            blockingProduction: true,
            compatibilityStatus: "INCOMPATIBLE",
            sourceId: "SRC_EN_16122_2012",
            ruleNature: "MANDATORY_SAFETY",
            worldPositionMm: {
              x: roundGeometryMm(mod.position.x + bayCursorX + bayW / 2),
              y: roundGeometryMm(mod.position.y + plinthH + T + sh.elevationY),
              z: roundGeometryMm(mod.position.z + mod.dimensions.depth * 0.5),
            },
            suggestions: [
              `Raf kalınlığını ${targetThick}mm yapın veya orta ara dikme ekleyerek açıklığı daraltın.`,
            ],
            remediationProposals: [
              {
                id: `fix_shelf_thick_${sh.id}`,
                label: `Raf Kalınlığını ${targetThick}mm'ye Yükselt`,
                description: `Atalet momentini (b·t³/12) artırarak sehimi EN 16122 güvenlik sınırının altına çeker.`,
                requiresExplicitUserApproval: true,
                targetModuleId: mod.id,
                targetBayIndex: bayIdx,
                targetComponentId: sh.id,
                patchKind: "upgrade_shelf_thickness_25mm",
                patchPayload: { thickness: targetThick },
              },
            ],
          });
        }
      });

      // 2e. Bölgesel ve Erişilebilirlik Ergonomi Profili Kontrolleri (P2-02)
      bay.shelves.forEach((sh) => {
        const absShelfY = mod.position.y + plinthH + T + sh.elevationY;
        if (absShelfY > ergProfile.maxComfortableShelfHeightMm) {
          addFinding({
            severity: "info",
            code: "INFO_ERGONOMIC_PROFILE_SHELF_REACH",
            message: `[${ergProfile.name}] Raf yüksekliği (${absShelfY}mm), profil konfor erişim sınırını (${ergProfile.maxComfortableShelfHeightMm}mm) aşıyor.`,
            targetId: sh.id,
            targetModuleId: mod.id,
            targetComponentId: sh.id,
            compatibilityStatus: "COMPATIBLE_WITH_CONDITIONS",
            sourceId: ergProfile.sourceId,
            ruleNature: "ERGONOMIC_ADVISORY",
          });
        }
      });

      bayCursorX += bayW + T;
    });

    // 2f. Ankastre Soğutucu / Fırın Boy Kulesi 200 cm² Baza Hava Girişi Denetimi (P1-06)
    if (isBuiltInOvenOrFridgeTower(mod)) {
      // 200 cm² = 20.000 mm² serbest hava kesiti için tipik 450mm menfezde en az 60mm baza yüksekliği gerekir
      const freePlinthVentAreaCm2 = Math.round(((mod.dimensions.width - 120) * plinthH * 0.65) / 100);
      if (plinthH < 60 || freePlinthVentAreaCm2 < 200 || netInnerD < 530) {
        addFinding({
          severity: "error",
          code: "ERR_APPLIANCE_200CM2_AIRFLOW_VIOLATION",
          message: `Ankastre cihaz kulesi "${mod.name}" soğutma/tahliye şartını karşılamıyor (Baza serbest hava kesiti: ~${Math.max(
            0,
            freePlinthVentAreaCm2
          )} cm² < min 200 cm²; Net iç derinlik: ${netInnerD}mm < min 530mm). Kompresör/cihaz aşırı ısınma riski!`,
          targetId: mod.id,
          targetModuleId: mod.id,
          targetComponentId: mod.id,
          blockingProduction: true,
          compatibilityStatus: "INCOMPATIBLE",
          sourceId: "SRC_APPLIANCE_VENT_200CM2",
          ruleNature: "MANDATORY_SAFETY",
          worldPositionMm: {
            x: roundGeometryMm(mod.position.x + mod.dimensions.width / 2),
            y: roundGeometryMm(mod.position.y + Math.max(40, plinthH / 2)),
            z: roundGeometryMm(mod.position.z + mod.dimensions.depth - 40),
          },
          suggestions: [
            "Baza yüksekliğini en az 80-100mm yapın (200 cm² alüminyum menfez için).",
            "Gövde net iç derinliğini arka 50mm baca boşluğu dahil en az 550mm yapın.",
          ],
          remediationProposals: [
            {
              id: `fix_vent_plinth_${mod.id}`,
              label: "Baza Yüksekliğini 100mm ve Gövde Derinliğini 580mm Yap",
              description:
                "200 cm² baza hava girişi ve 50mm kesintisiz arka baca kanalı şartını sağlar.",
              requiresExplicitUserApproval: true,
              targetModuleId: mod.id,
              patchKind: "increase_plinth_for_ventilation",
              patchPayload: { plinthHeight: Math.max(100, plinthH), depth: Math.max(580, mod.dimensions.depth) },
            },
          ],
        });
      }
    }


    // 2h. Baş-Kesim Sonrası Net Kesilebilir Plaka Ebadı (2770×2040mm) ve 70mm Kıskaç Kontrolü (P0-03)
    const maxSheetLen = mod.carcass.allowJumboSheet3660
      ? 3630
      : ENGINEERING_TOLERANCE_POLICY.USABLE_STANDARD_SHEET_LENGTH_MM;
    const maxSheetWid = mod.carcass.allowJumboSheet3660
      ? 1800
      : ENGINEERING_TOLERANCE_POLICY.USABLE_STANDARD_SHEET_WIDTH_MM;

    const candidatePanels: { label: string; l: number; w: number }[] = [
      {
        label: "Yan Dikme",
        l: Math.max(fourSpace.netPanelCut.sidePanelHeightMm, fourSpace.netPanelCut.sidePanelDepthMm),
        w: Math.min(fourSpace.netPanelCut.sidePanelHeightMm, fourSpace.netPanelCut.sidePanelDepthMm),
      },
      {
        label: "Alt/Üst Tabla",
        l: Math.max(fourSpace.netPanelCut.horizontalPanelWidthMm, fourSpace.netPanelCut.horizontalPanelDepthMm),
        w: Math.min(fourSpace.netPanelCut.horizontalPanelWidthMm, fourSpace.netPanelCut.horizontalPanelDepthMm),
      },
    ];
    fourSpace.doorLeaves.forEach((dl, dbi) => {
      if (dl.leafCount > 0) {
        candidatePanels.push({
          label: `Bölme ${dbi + 1} Kapak Kanadı`,
          l: Math.max(dl.leafHeightMm, dl.leafWidthMm),
          w: Math.min(dl.leafHeightMm, dl.leafWidthMm),
        });
      }
    });

    for (const cp of candidatePanels) {
      if (cp.l > maxSheetLen || cp.w > maxSheetWid) {
        addFinding({
          severity: "error",
          code: "ERR_PANEL_EXCEEDS_USABLE_SHEET_SIZE",
          message: `"${mod.name}" ${cp.label} net kesim ölçüsü (${roundGeometryMm(cp.l)}×${roundGeometryMm(
            cp.w
          )}mm), baş-kesim sonrası net kesilebilir plaka sınırını (${maxSheetLen}×${maxSheetWid}mm) aşıyor; parça plakaya yerleşemez!`,
          targetId: mod.id,
          targetModuleId: mod.id,
          targetComponentId: mod.id,
          blockingProduction: true,
          compatibilityStatus: "INCOMPATIBLE",
          ruleNature: "ENGINEERING_VALIDITY",
          worldPositionMm: {
            x: roundGeometryMm(mod.position.x + mod.dimensions.width / 2),
            y: roundGeometryMm(mod.position.y + mod.dimensions.height - 60),
            z: roundGeometryMm(mod.position.z + mod.dimensions.depth),
          },
          suggestions: [
            `Modül yüksekliğini/genişliğini net plaka sınırı (${maxSheetLen}mm) içine çekin veya üst yüklük modülüne bölün.`,
            "Özel Jumbo levha (3660×1830mm) tedariki varsa Jumbo Plaka modunu etkinleştirin.",
          ],
          remediationProposals: [
            {
              id: `fix_sheet_clamp_${mod.id}`,
              label: `Yüksekliği Net Plaka Sınırına (${maxSheetLen + plinthH}mm) Çek`,
              description: "Yan dikme boyunu 2770mm net kesilebilir standart plaka sınırına indirir.",
              requiresExplicitUserApproval: true,
              targetModuleId: mod.id,
              patchKind: "clamp_height_to_usable_sheet",
              patchPayload: { height: Math.min(mod.dimensions.height, maxSheetLen + plinthH) },
            },
          ],
        });
        break;
      }
    }

    // 2i. Duvara Asılı Dolaplarda (kitchen_wall & Asma TV/Banyo) EN 14749 Askı Kapasitesi ve Duvar Cinsi Kontrolü (P1-04)
    const isWallHungNoBase =
      mod.category === "kitchen_wall" ||
      Boolean(mod.templateId?.includes("floating")) ||
      (mod.category !== "complementary" &&
        mod.position.y >= 150 &&
        plinthH === 0 &&
        !project.modules.some(
          (bm) =>
            bm.id !== mod.id &&
            bm.category !== "complementary" &&
            Math.abs(bm.position.y + bm.dimensions.height - mod.position.y) <= 20 &&
            bm.position.x < mod.position.x + mod.dimensions.width - 20 &&
            bm.position.x + bm.dimensions.width > mod.position.x + 20
        ));

    if (isWallHungNoBase) {
      const volM3 =
        (mod.dimensions.width * mod.dimensions.height * mod.dimensions.depth) / 1_000_000_000;
      const estLoadedKg = roundGeometryMm(volM3 * 165);
      const maxHangerLocations = mod.bays.length + 1; // Sol dikme + ara dikmeler + sağ dikme
      const maxSafeKgForUprights = maxHangerLocations * 65;

      if (project.space.wallSubstrateType === "drywall_unreinforced") {
        addFinding({
          severity: "error",
          code: "ERR_DRYWALL_UNREINFORCED_HEAVY_HANG",
          message: `"${mod.name}" (tahmini dolu yük ~${estLoadedKg} kg) karkas desteksiz tek kat alçıpan duvara (drywall_unreinforced) güvenle asılamaz!`,
          targetId: mod.id,
          targetModuleId: mod.id,
          targetComponentId: mod.id,
          blockingProduction: true,
          compatibilityStatus: "INCOMPATIBLE",
          sourceId: "SRC_EN_14749_2022",
          ruleNature: "MANDATORY_SAFETY",
          suggestions: [
            "Duvar arkasına çelik/ahşap karkas takviyesi yapıp 'drywall_reinforced' seçin veya zemine oturan ayaklı modüle geçin.",
          ],
        });
      } else if (estLoadedKg > maxSafeKgForUprights) {
        addFinding({
          severity: "error",
          code: "ERR_WALL_CABINET_HANGER_OVERLOAD",
          message: `Duvara asılı "${mod.name}" tahmini dolu kütlesi (~${estLoadedKg} kg), mevcut ${maxHangerLocations} taşıyıcı dikmedeki askı kapasitesini (${maxSafeKgForUprights} kg) aşıyor; ara dikme + ek askı elemanı zorunludur!`,
          targetId: mod.id,
          targetModuleId: mod.id,
          targetComponentId: mod.id,
          blockingProduction: true,
          compatibilityStatus: "INCOMPATIBLE",
          sourceId: "SRC_EN_14749_2022",
          ruleNature: "MANDATORY_SAFETY",
          suggestions: [
            "Bölme sayısını artırarak orta taşıyıcı dikme ve 3./4. duvar askı elemanı ekleyin.",
            "Genişliği iki ayrı asma modüle bölün.",
          ],
        });
      } else if (estLoadedKg > 95 && !project.space.wallSubstrateType) {
        addFinding({
          severity: "warning",
          code: "CHK_WALL_SUBSTRATE_VERIFICATION_REQUIRED",
          message: `Ağır asma ünite "${mod.name}" (~${estLoadedKg} kg) için duvar taşıyıcı cinsi (betonarme/tuğla/destekli alçıpan) henüz doğrulanmadı.`,
          targetId: mod.id,
          targetModuleId: mod.id,
          targetComponentId: mod.id,
          blockingProduction: false,
          compatibilityStatus: "UNVERIFIED",
          sourceId: "SRC_EN_14749_2022",
          ruleNature: "VERIFICATION_REQUIRED",
          remediationProposals: [
            {
              id: `confirm_wall_concrete_${mod.id}`,
              label: "Duvar Cinsini Betonarme / Dolu Tuğla Olarak Doğrula",
              description: "Saha duvar taşıyıcısının EN 14749 askı yüküne uygun olduğunu kayıt altına alır.",
              requiresExplicitUserApproval: true,
              targetModuleId: mod.id,
              patchKind: "confirm_wall_substrate",
              patchPayload: { wallSubstrateType: "reinforced_concrete" },
            },
          ],
        });
      }
    }

    // 2g. Tesisat / Elektrik / Gaz Uçlarının Taşıyıcı Yan Panel veya Ara Dikme Kesitine Denk Gelmesi — 0°/90°/270°/Açılı OBB Uyumlu! (P2-01)
    const modPlace = calculateModulePlacement(mod);
    const cosM = Math.cos(modPlace.rotationYRad);
    const sinM = Math.sin(modPlace.rotationYRad);
    const localUprightOffsets: { label: string; uMm: number }[] = [
      { label: "Sol Yan Panel", uMm: T / 2 },
      { label: "Sağ Yan Panel", uMm: mod.dimensions.width - T / 2 },
    ];
    let accLocalU = T;
    for (let bi = 0; bi < mod.bays.length - 1; bi++) {
      accLocalU += bayWidths[bi] || 0;
      localUprightOffsets.push({
        label: `Ara Dikme #${bi + 1}`,
        uMm: accLocalU + T / 2,
      });
      accLocalU += T;
    }

    for (const obs of allObstacles) {
      if (obs.type !== "electrical" && obs.type !== "plumbing" && obs.type !== "gas_valve") {
        continue;
      }
      const oSpanW = Math.max(60, obs.dimensions.width || 80);
      const oSpanD = Math.max(60, obs.dimensions.depth || 80);
      const oCenterX = obs.position.x + oSpanW / 2;
      const oCenterZ = obs.position.z + Math.min(40, oSpanD / 2);
      const oMinY = obs.position.y;
      const oMaxY = obs.position.y + Math.max(60, obs.dimensions.height || 80);
      if (oMaxY <= mod.position.y || oMinY >= mod.position.y + mod.dimensions.height) continue;

      // Project obstacle center into module local coordinates (u along width 0..W, v along depth 0..D from rear face!)
      const dxWorld = oCenterX - modPlace.origin.x;
      const dzWorld = oCenterZ - modPlace.origin.z;
      const localU = dxWorld * cosM - dzWorld * sinM;
      const localV = dxWorld * sinM + dzWorld * cosM;

      // Obstacle must lie near the rear wall face of the module (-120mm .. +250mm) and within module width span
      if (localV < -120 || localV > 250 || localU < -40 || localU > mod.dimensions.width + 40) {
        continue;
      }

      const halfObsRadius = oSpanW / 2 + T / 2 + 8;
      for (const upPlane of localUprightOffsets) {
        if (Math.abs(localU - upPlane.uMm) <= halfObsRadius) {
          const hitWorldX = modPlace.origin.x + upPlane.uMm * cosM + 20 * sinM;
          const hitWorldZ = modPlace.origin.z - upPlane.uMm * sinM + 20 * cosM;
          addFinding({
            severity: "error",
            code: "ERR_MEP_OUTLET_BLOCKED_BY_UPRIGHT_PANEL",
            message: `Tesisat/Priz çakışması: "${obs.name}" (${obs.type}), "${mod.name}" modülünün "${upPlane.label}" taşıyıcı dikme kesitine denk geliyor!`,
            targetId: mod.id,
            targetModuleId: mod.id,
            targetComponentId: obs.id,
            blockingProduction: true,
            compatibilityStatus: "INCOMPATIBLE",
            ruleNature: "MANDATORY_SAFETY",
            worldPositionMm: {
              x: roundGeometryMm(hitWorldX),
              y: roundGeometryMm((oMinY + oMaxY) / 2),
              z: roundGeometryMm(hitWorldZ),
            },
            suggestions: [
              "Modülü veya bölme dikmesini tesisat ekseninden en az 45mm kaydırın.",
            ],
          });
        }
      }
    }

    // 2j. Suyolu / Damar Takibi Grubu (`grainGroupId`) Tek Plaka Şerit Uzunluğu Kontrolü (P2-02)
    const grainGroups = new Map<string, number>();
    mod.bays.forEach((b) => {
      b.drawers.forEach((d) => {
        if (!d.isHidden && d.grainGroupId) {
          grainGroups.set(d.grainGroupId, (grainGroups.get(d.grainGroupId) || 0) + d.height + 4);
        }
      });
    });
    grainGroups.forEach((totalStripMm, gid) => {
      if (totalStripMm > maxSheetLen) {
        addFinding({
          severity: "warning",
          code: "WARN_GRAIN_GROUP_EXCEEDS_SINGLE_SHEET",
          message: `"${mod.name}" suyolu damar grubu (${gid}) toplam kesim şeridi (${roundGeometryMm(
            totalStripMm
          )}mm), tek plaka net boyunu (${maxSheetLen}mm) aşıyor; kesintisiz damar takibi tek plakadan çıkamaz.`,
          targetId: mod.id,
          targetModuleId: mod.id,
          compatibilityStatus: "COMPATIBLE_WITH_CONDITIONS",
          ruleNature: "ENGINEERING_VALIDITY",
          suggestions: [
            "Damar grubunu iki ayrı bölgeye ayırın veya 3660mm Jumbo kaplama levhası kullanın.",
          ],
        });
      }
    });

    // 2m. V7.4 Mimari Tavan Tipi Alt Kot Çakışması & Kapak Tavan Boşluğu Kontrolü
    if (project.space?.ceilingConfig?.enabled) {
      const ceilClear = computeEffectiveCeilingClearHeight(
        project.space,
        mod.position.x,
        mod.dimensions.width,
        mod.position.z,
        mod.dimensions.depth
      );
      const modTopY = mod.position.y + mod.dimensions.height;
      if (modTopY > ceilClear.minClearHeightMm + 0.5) {
        addFinding({
          severity: "error",
          code: "ERR_CEILING_TYPE_COLLISION",
          message: `"${mod.name}" üst kotu (${roundGeometryMm(
            modTopY
          )}mm), seçilen tavan tipinin (${ceilClear.reasonLabel}) net alt kotunu (${roundGeometryMm(
            ceilClear.minClearHeightMm
          )}mm) aşıyor!`,
          targetId: mod.id,
          targetModuleId: mod.id,
          blockingProduction: true,
          compatibilityStatus: "INCOMPATIBLE",
          ruleNature: "ENGINEERING_VALIDITY",
          worldPositionMm: {
            x: mod.position.x + mod.dimensions.width / 2,
            y: ceilClear.minClearHeightMm,
            z: mod.position.z + mod.dimensions.depth / 2,
          },
          remediationProposals: [
            {
              id: `fix_ceil_clamp_${mod.id}`,
              label: `Yüksekliği Tavan Alt Kotuna Uyarla (${Math.max(
                400,
                Math.floor(ceilClear.minClearHeightMm - mod.position.y - 20)
              )}mm)`,
              description: "Modül yüksekliğini net tavan alt kotundan 20mm montaj payı bırakacak şekilde düşürür.",
              requiresExplicitUserApproval: true,
              targetModuleId: mod.id,
              patchKind: "clamp_height_to_usable_sheet",
              patchPayload: {
                targetHeightMm: Math.max(
                  400,
                  Math.floor(ceilClear.minClearHeightMm - mod.position.y - 20)
                ),
              },
            },
          ],
        });
      } else if (
        mod.category !== "complementary" &&
        ceilClear.minClearHeightMm - modTopY < 15 &&
        mod.bays.some((b) => b.door && b.door.type !== "open" && b.door.type !== "sliding")
      ) {
        addFinding({
          severity: "warning",
          code: "WARN_CEILING_DOOR_SWEEP_TIGHT",
          message: `"${mod.name}" ile ${ceilClear.reasonLabel} arasındaki montaj/açılım boşluğu çok dar (${roundGeometryMm(
            ceilClear.minClearHeightMm - modTopY
          )}mm < 15mm); tavan terazisi eğriliğinde kapak sürtebilir.`,
          targetId: mod.id,
          targetModuleId: mod.id,
          compatibilityStatus: "COMPATIBLE_WITH_CONDITIONS",
          ruleNature: "ENGINEERING_VALIDITY",
        });
      }
    }

    // 2n. V7.4 Çoklu Delik Sistemi Kapalıyken Hareketli Raf Seçimi Kontrolü
    if (mod.carcass.multiHoleMode === "none") {
      const hasAdjShelf = mod.bays.some((b) =>
        (b.shelves || []).some((s) => !s.isHidden && s.isAdjustable !== false)
      );
      if (hasAdjShelf) {
        addFinding({
          severity: "error",
          code: "ERR_ADJUSTABLE_SHELF_WITHOUT_PIN_HOLES",
          message: `"${mod.name}" modülünde Çoklu Delik Sistemi kapatılmış (Deliksiz) ancak hareketli raf bulunuyor; Ø5mm pim deliği olmadan hareketli raf taşınamaz!`,
          targetId: mod.id,
          targetModuleId: mod.id,
          blockingProduction: true,
          compatibilityStatus: "INCOMPATIBLE",
          ruleNature: "ENGINEERING_VALIDITY",
          suggestions: [
            "Çoklu delik modunu Tekli Raf Pimi, 3-lü Küme veya Tam Boy Sistem 32 olarak değiştirin ya da rafları sabit yapın.",
          ],
        });
      }
    }

    // 2l. Tip-B (`top_bottom_through`) Ağır Boy Dolap / Taş Tezgâh Alt Tabla Kesme Yükü Kontrolü (Şartname Bölüm 3)
    if (
      mod.carcass.carcassJoineryTopology === "top_bottom_through" &&
      (mod.carcass.plinthHeight ?? 80) > 0 &&
      (mod.dimensions.height >= 1900 ||
        mod.category === "kitchen_base" ||
        mod.category === "kitchen_tall" ||
        mod.category === "kitchen_island")
    ) {
      addFinding({
        severity: "warning",
        code: "CHK_TOP_BOTTOM_THROUGH_LEG_SHEAR",
        message: `"${mod.name}" modülünde Tip-B (Alt/Üst Tabla Tam Boy) birleşim seçili; ağır düşey yük altında yan dikme kesme kuvvetinin alt tablada sehim yaratmaması için ayar ayakları yan panel ekseninin tam altına basmalı veya Tip-A (Yanlar Tam Boy) tercih edilmelidir.`,
        targetId: mod.id,
        targetModuleId: mod.id,
        compatibilityStatus: "COMPATIBLE_WITH_CONDITIONS",
        sourceId: "SRC_HAFELE_MINIFIX",
        ruleNature: "ENGINEERING_VALIDITY",
        remediationProposals: [
          {
            id: `switch_sides_through_${mod.id}`,
            label: "Tip-A (Yan Paneller Tam Boy) Konstrüksiyona Geç",
            description: "Düşey gövde ve tezgâh yükünü doğrudan yan dikmeler üzerinden baza ayaklarına aktarır.",
            requiresExplicitUserApproval: true,
            targetModuleId: mod.id,
            patchKind: "switch_topology_sides_through",
            patchPayload: { carcassJoineryTopology: "sides_through" },
          },
        ],
      });
    }

    // 2k. Islak Hacim (Banyo Lavabo / Mutfak Eviye) Neme Dayanıklı Gövde Malzemesi Kontrolü (P2-03)
    const isWetModule =
      isSinkModule(mod) ||
      Boolean(mod.templateId?.includes("bathroom")) ||
      mod.name.toLowerCase().includes("banyo") ||
      mod.name.toLowerCase().includes("lavabo");
    if (
      isWetModule &&
      (mod.carcass.bodyMaterialId === "mat_chipboard_raw" ||
        mod.carcass.bodyMaterialId === "mat_melamine_oak_raw")
    ) {
      addFinding({
        severity: "warning",
        code: "WARN_WET_ZONE_MOISTURE_BOARD_RECOMMENDED",
        message: `Islak hacim ünitesi "${mod.name}" gövdesinde neme dayanıksız ham yonga levha seçili; su buharı ve sızıntıya karşı MR-MDF / Lake / Kompakt gövde önerilir.`,
        targetId: mod.id,
        targetModuleId: mod.id,
        compatibilityStatus: "COMPATIBLE_WITH_CONDITIONS",
        ruleNature: "ENGINEERING_VALIDITY",
        remediationProposals: [
          {
            id: `fix_wet_board_${mod.id}`,
            label: "Gövdeyi Neme Dayanıklı MDF Lake'ye Yükselt",
            description: "Islak hacimde şişme riskini önlemek için gövde malzemesini neme dayanıklı sınıfa geçirir.",
            requiresExplicitUserApproval: true,
            targetModuleId: mod.id,
            patchKind: "upgrade_wet_zone_board",
            patchPayload: { bodyMaterialId: "mat_lacquer_white" },
          },
        ],
      });
    }
  }

  // 3. Üst Üste İstiflenen Modüllerde (Stacked Modules) Yük Aktarımı, Konsol Taşma ve Taşıyıcı Dikme Hizası (Bölüm 3)
  for (const upper of project.modules) {
    if (
      upper.category === "complementary" ||
      upper.category === "kitchen_wall" ||
      upper.position.y <= 50
    ) {
      continue;
    }
    const uLeft = upper.position.x;
    const uRight = upper.position.x + upper.dimensions.width;
    const uFront = upper.position.z + upper.dimensions.depth;
    const uRear = upper.position.z;

    // Find floor/lower modules whose top surface meets upper.position.y (within ±20mm) and overlaps in X & Z
    const supportingBases = project.modules.filter((base) => {
      if (base.id === upper.id || base.category === "complementary") return false;
      const baseTopY = base.position.y + base.dimensions.height;
      if (Math.abs(baseTopY - upper.position.y) > 20) return false;
      const bLeft = base.position.x;
      const bRight = base.position.x + base.dimensions.width;
      const bRear = base.position.z;
      const bFront = base.position.z + base.dimensions.depth;
      return uLeft < bRight - 10 && uRight > bLeft + 10 && uRear < bFront - 20 && uFront > bRear + 20;
    });

    if (supportingBases.length === 0) {
      if (upper.carcass.wallAnchored !== true) {
        addFinding({
          severity: "error",
          code: "ERR_STACKED_MODULE_UNSUPPORTED_MIDAIR",
          message: `Üst modül "${upper.name}" (Y=${upper.position.y}mm) altında taşıyıcı alt modül olmadan ve duvar askı onayı bulunmadan havada duruyor!`,
          targetId: upper.id,
          targetModuleId: upper.id,
          targetComponentId: upper.id,
          blockingProduction: true,
          compatibilityStatus: "INCOMPATIBLE",
          sourceId: "SRC_EN_14749_2022",
          ruleNature: "MANDATORY_SAFETY",
          worldPositionMm: {
            x: roundGeometryMm(uLeft + upper.dimensions.width / 2),
            y: roundGeometryMm(upper.position.y),
            z: roundGeometryMm(uFront),
          },
          suggestions: [
            "Modülü altındaki taşıyıcı gövdenin üst kotuna oturtun veya zemine (Y=0) indirin.",
            "Duvara asılı ünite ise duvar taşıyıcı askı sistemini onaylayın.",
          ],
          remediationProposals: [
            {
              id: `fix_stack_drop_${upper.id}`,
              label: "Modülü Zemine (Y=0mm) İndir",
              description: "Havada kalan modülü zemin kotuna oturtarak yapısal mesnet sağlar.",
              requiresExplicitUserApproval: true,
              targetModuleId: upper.id,
              patchKind: "snap_stacked_to_support_or_floor",
              patchPayload: { positionY: 0 },
            },
          ],
        });
      }
    } else {
      const minSupportLeftX = Math.min(...supportingBases.map((b) => b.position.x));
      const maxSupportRightX = Math.max(
        ...supportingBases.map((b) => b.position.x + b.dimensions.width)
      );
      const maxSupportDepthZ = Math.max(
        ...supportingBases.map((b) => b.position.z + b.dimensions.depth)
      );

      const leftOverhangMm = roundCncCoordMm(minSupportLeftX - uLeft);
      const rightOverhangMm = roundCncCoordMm(uRight - maxSupportRightX);
      const frontOverhangMm = roundCncCoordMm(uFront - maxSupportDepthZ);

      if (leftOverhangMm > 25 || rightOverhangMm > 25 || frontOverhangMm > 35) {
        addFinding({
          severity: "error",
          code: "ERR_STACKED_MODULE_CANTILEVER_OVERHANG",
          message: `Üst üste bağlanan "${upper.name}" modülü alt taşıyıcı gövdeden desteksiz taşıyor (Sol taşma: ${Math.max(
            0,
            leftOverhangMm
          )}mm, Sağ taşma: ${Math.max(0, rightOverhangMm)}mm, Ön taşma: ${Math.max(
            0,
            frontOverhangMm
          )}mm). Yük aktarımı güvensiz!`,
          targetId: upper.id,
          targetModuleId: upper.id,
          targetComponentId: upper.id,
          blockingProduction: true,
          compatibilityStatus: "INCOMPATIBLE",
          sourceId: "SRC_EN_16122_2012",
          ruleNature: "MANDATORY_SAFETY",
          worldPositionMm: {
            x: roundGeometryMm(uLeft + upper.dimensions.width / 2),
            y: roundGeometryMm(upper.position.y),
            z: roundGeometryMm(uFront),
          },
          suggestions: [
            "Üst kutu genişliğini ve X hizasını alt taşıyıcı modül sınırlarına eşitleyin.",
          ],
          remediationProposals: [
            {
              id: `fix_stack_align_${upper.id}`,
              label: `Üst Modülü Alt Gövdeye Hizala (${maxSupportRightX - minSupportLeftX}mm)`,
              description:
                "Üst modülün X konumunu ve genişliğini alt taşıyıcı modül dikmeleriyle tam hizalar.",
              requiresExplicitUserApproval: true,
              targetModuleId: upper.id,
              patchKind: "align_stacked_width_to_base",
              patchPayload: {
                positionX: minSupportLeftX,
                width: maxSupportRightX - minSupportLeftX,
              },
            },
          ],
        });
      } else {
        // Check vertical load-bearing upright alignment: collect all vertical side/divider X planes of supporting base modules
        const baseLoadBearingPlanesX: number[] = [];
        for (const base of supportingBases) {
          const bT = base.carcass.panelThickness || 18;
          baseLoadBearingPlanesX.push(base.position.x + bT / 2);
          baseLoadBearingPlanesX.push(base.position.x + base.dimensions.width - bT / 2);
          const bBayWs = calculateBayWidths(base);
          let curX = base.position.x + bT;
          for (let bi = 0; bi < base.bays.length - 1; bi++) {
            curX += bBayWs[bi] || 0;
            baseLoadBearingPlanesX.push(curX + bT / 2);
            curX += bT;
          }
        }
        const uT = upper.carcass.panelThickness || 18;
        const upperLeftPlaneX = uLeft + uT / 2;
        const upperRightPlaneX = uRight - uT / 2;
        const leftAligned = baseLoadBearingPlanesX.some((px) => Math.abs(px - upperLeftPlaneX) <= 35);
        const rightAligned = baseLoadBearingPlanesX.some((px) => Math.abs(px - upperRightPlaneX) <= 35);

        if (!leftAligned || !rightAligned) {
          addFinding({
            severity: "warning",
            code: "WARN_STACKED_UPRIGHT_LOAD_PATH_OFFSET",
            message: `Üst modül "${upper.name}" yan dikmeleri alt modülün taşıyıcı yan/orta dikmeleriyle aynı düşey eksende değil; alt modül üst tablasında eğilme riski oluşur (25mm üst tabla veya orta dikme hizası önerilir).`,
            targetId: upper.id,
            targetModuleId: upper.id,
            targetComponentId: upper.id,
            compatibilityStatus: "COMPATIBLE_WITH_CONDITIONS",
            sourceId: "SRC_EN_16122_2012",
            ruleNature: "ENGINEERING_VALIDITY",
            worldPositionMm: {
              x: roundGeometryMm(!leftAligned ? upperLeftPlaneX : upperRightPlaneX),
              y: roundGeometryMm(upper.position.y),
              z: roundGeometryMm(uFront),
            },
            suggestions: [
              "Üst modül dikmelerini alt modül yan/ara dikme eksenlerine hizalayın.",
              "Alt modül üst tablasını 25mm kalınlığa yükseltin.",
            ],
          });
        }
      }
    }
  }

  // 4. Özel Malzeme ve Özel Donanımlarda Eksik Teknik Veri Koruması (`VERIFICATION_REQUIRED` — Bölüm 3, 6 & 7)
  const customMatMap = new Map((project.customMaterials || []).map((cm) => [cm.id, cm]));
  for (const mod of project.modules) {
    const usedMatIds = new Set<string>([
      mod.carcass.bodyMaterialId,
      mod.carcass.doorMaterialId,
      ...(mod.carcass.countertopMaterialId ? [mod.carcass.countertopMaterialId] : []),
      ...mod.bays.map((b) => b.door?.doorMaterialId).filter((x): x is string => Boolean(x)),
    ]);

    for (const matId of usedMatIds) {
      const cMat = customMatMap.get(matId);
      if (
        cMat &&
        (!cMat.densityKgPerM3 ||
          cMat.densityKgPerM3 <= 0 ||
          (!cMat.elasticModulusMpa && cMat.mechanicalDataVerified !== true))
      ) {
        addFinding({
          severity: "warning",
          code: "CHK_DATA_CUSTOM_MATERIAL_UNVERIFIED",
          message: `Özel tanımlı malzeme "${cMat.name}" (${cMat.id}) için doğrulanmış yoğunluk veya elastisite modülü (MPa) girilmemiş; kapak ağırlığı ve raf sehim hesabı tahmini değerle yapıldı, mühendislik doğrulaması gerektirir.`,
          targetId: mod.id,
          targetModuleId: mod.id,
          targetComponentId: mod.id,
          blockingProduction: true,
          compatibilityStatus: "UNVERIFIED",
          ruleNature: "VERIFICATION_REQUIRED",
          worldPositionMm: {
            x: roundGeometryMm(mod.position.x + mod.dimensions.width / 2),
            y: roundGeometryMm(mod.position.y + mod.dimensions.height / 2),
            z: roundGeometryMm(mod.position.z + mod.dimensions.depth),
          },
          suggestions: [
            "Malzeme üretici teknik föyünden gerçek yoğunluk (kg/m³) ve elastisite modülü (MPa) değerlerini girip doğrulayın.",
          ],
        });
      }
    }

    mod.bays.forEach((bay, bIdx) => {
      bay.drawers.forEach((drw) => {
        if (drw.hardwareProductId) {
          const cutSpec = resolveCanonicalDrawerCuttingFormula(
            drw.hardwareProductId,
            drw.boxSystemType
          );
          if (!cutSpec.isVerifiedCatalogFormula) {
            addFinding({
              severity: "warning",
              code: "CHK_DATA_CUSTOM_DRAWER_FORMULA_UNVERIFIED",
              message: `"${mod.name}" Bölme ${bIdx + 1} çekmecesinde seçilen özel donanım (${drw.hardwareProductId}) için doğrulanmış üretici kesim formülü bulunamadı; üretim öncesi numune doğrulaması zorunludur.`,
              targetId: drw.id,
              targetModuleId: mod.id,
              targetComponentId: drw.id,
              blockingProduction: true,
              compatibilityStatus: "UNVERIFIED",
              ruleNature: "VERIFICATION_REQUIRED",
              worldPositionMm: {
                x: roundGeometryMm(mod.position.x + mod.dimensions.width / 2),
                y: roundGeometryMm(mod.position.y + (mod.carcass.plinthHeight || 0) + drw.elevationY),
                z: roundGeometryMm(mod.position.z + mod.dimensions.depth),
              },
              suggestions: [
                "Üretici teknik dokümanındaki taban/sırt düşüm ölçülerini katalog kaydına işleyin veya doğrulanmış Blum/Hettich ray seçin.",
              ],
            });
          }
        }
      });
    });
  }

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

/**
 * Kullanıcı tarafından açıkça onaylanan tekil bir düzeltme önerisini (RemediationProposal)
 * sessiz yan etki yaratmadan projeye uygular ve yeni bir DesignProject kopyası döndürür (Bölüm 9).
 */
export function applyApprovedRemediationProposal(
  project: DesignProject,
  proposal: RemediationProposal
): DesignProject {
  const next: DesignProject = JSON.parse(JSON.stringify(project));
  const mod = next.modules.find((m) => m.id === proposal.targetModuleId);
  if (!mod) return next;

  switch (proposal.patchKind) {
    case "enable_wall_anchor": {
      if (proposal.patchPayload.wallAnchored) mod.carcass.wallAnchored = true;
      if (proposal.patchPayload.floorAnchored) mod.carcass.floorAnchored = true;
      break;
    }
    case "increase_module_depth": {
      const newD = Number(proposal.patchPayload.depth);
      if (Number.isFinite(newD) && newD >= 250) mod.dimensions.depth = newD;
      break;
    }
    case "add_internal_drawer_spacer": {
      mod.carcass.internalDrawerHingeSolution = "spacer_block_25mm";
      break;
    }
    case "switch_hinge_155_zero": {
      const bIdx = proposal.targetBayIndex ?? 0;
      if (mod.bays[bIdx]?.door) {
        mod.bays[bIdx].door.hardwareProductId = "hw_blum_71b7550";
      }
      break;
    }
    case "switch_single_to_double_door": {
      const bIdx = proposal.targetBayIndex ?? 0;
      if (mod.bays[bIdx]?.door) {
        mod.bays[bIdx].door.type = "double";
        mod.bays[bIdx].door.doorSystemId = "hinged_double";
      }
      break;
    }
    case "enable_siphon_cutout": {
      const bIdx = proposal.targetBayIndex ?? 0;
      const drw = mod.bays[bIdx]?.drawers.find((d) => d.id === proposal.targetComponentId);
      if (drw) drw.hasSiphonCutout = true;
      break;
    }
    case "reduce_drawer_runner_nl": {
      const bIdx = proposal.targetBayIndex ?? 0;
      const drw = mod.bays[bIdx]?.drawers.find((d) => d.id === proposal.targetComponentId);
      const nl = Number(proposal.patchPayload.nominalLengthMm);
      if (drw && Number.isFinite(nl)) drw.nominalLengthMm = nl;
      break;
    }
    case "add_wall_filler_50mm": {
      const shiftX = Number(proposal.patchPayload.shiftXMm || 0);
      mod.position.x = Math.max(0, mod.position.x + shiftX);
      break;
    }
    case "increase_plinth_for_ventilation": {
      const ph = Number(proposal.patchPayload.plinthHeight);
      const dp = Number(proposal.patchPayload.depth);
      if (Number.isFinite(ph)) mod.carcass.plinthHeight = ph;
      if (Number.isFinite(dp)) mod.dimensions.depth = dp;
      break;
    }
    case "snap_stacked_to_support_or_floor": {
      const py = Number(proposal.patchPayload.positionY ?? 0);
      if (Number.isFinite(py)) mod.position.y = Math.max(0, py);
      break;
    }
    case "align_stacked_width_to_base": {
      const px = Number(proposal.patchPayload.positionX);
      const w = Number(proposal.patchPayload.width);
      if (Number.isFinite(px)) mod.position.x = px;
      if (Number.isFinite(w) && w >= 250) mod.dimensions.width = w;
      break;
    }
    case "expand_module_width": {
      const w = Number(proposal.patchPayload.width);
      if (Number.isFinite(w) && w >= 250) mod.dimensions.width = w;
      break;
    }
    case "switch_handle_to_knob": {
      const bIdx = proposal.targetBayIndex ?? 0;
      if (mod.bays[bIdx]?.door) {
        mod.bays[bIdx].door.handleCategory = "knob";
      }
      break;
    }
    case "clamp_height_to_usable_sheet": {
      const h = Number(proposal.patchPayload.height);
      if (Number.isFinite(h) && h >= 300) {
        mod.dimensions.height = h;
      }
      break;
    }
    case "upgrade_shelf_thickness_25mm": {
      const bIdx = proposal.targetBayIndex ?? 0;
      const sh = mod.bays[bIdx]?.shelves.find((s) => s.id === proposal.targetComponentId);
      const t = Number(proposal.patchPayload.thickness);
      if (sh && Number.isFinite(t) && t >= 8) sh.thickness = t;
      break;
    }
    case "increase_hinge_count": {
      const bIdx = proposal.targetBayIndex ?? 0;
      const hc = Number(proposal.patchPayload.hingeCount);
      if (mod.bays[bIdx]?.door && Number.isFinite(hc) && hc >= 2 && hc <= 5) {
        mod.bays[bIdx].door.hingeCount = hc;
      }
      break;
    }
    case "confirm_wall_substrate": {
      const sub = String(proposal.patchPayload.wallSubstrateType || "reinforced_concrete");
      next.space.wallSubstrateType = sub as NonNullable<DesignProject["space"]["wallSubstrateType"]>;
      break;
    }
    case "upgrade_wet_zone_board": {
      const matId = String(proposal.patchPayload.bodyMaterialId || "mat_lacquer_white");
      mod.carcass.bodyMaterialId = matId;
      break;
    }
    case "switch_topology_sides_through": {
      mod.carcass.carcassJoineryTopology = "sides_through";
      break;
    }
  }

  next.version = (next.version || 1) + 1;
  next.updatedAt = new Date().toISOString();
  return next;
}

export class ProductionGateBlockedError extends Error {
  public readonly blockingErrors: EngineeringValidationFinding[];

  constructor(message: string, blockingErrors: EngineeringValidationFinding[]) {
    super(message);
    this.name = "ProductionGateBlockedError";
    this.blockingErrors = blockingErrors;
  }
}

/**
 * Üretim Çıkış Kapısı (P0-02):
 * Fiziksel olarak hatalı, çakışmalı, devrilme riskli veya donanım açısından uyumsuz
 * tasarımların CNC, DXF, OptiCut CSV veya ERP üretim emrine dönüşmesini engeller.
 */
export function assertProductionExportAllowed(
  project: DesignProject,
  options?: { requireFactorySampleVerification?: boolean }
): ReturnType<typeof evaluateUnifiedEngineeringModel> {
  const report = evaluateUnifiedEngineeringModel(project);
  if (!report.canExportToCncAndSaw) {
    const summary = report.blockingSafetyAndEngineeringErrors
      .slice(0, 4)
      .map((e) => `[${e.code}] ${e.message}`)
      .join(" | ");
    throw new ProductionGateBlockedError(
      `ÜRETİM ENGELİ: Tasarımda ${report.blockingSafetyAndEngineeringErrors.length} adet kritik mühendislik/güvenlik hatası bulunuyor ve üretime aktarılamaz. Detay: ${summary}`,
      report.blockingSafetyAndEngineeringErrors
    );
  }
  if (options?.requireFactorySampleVerification && !report.canApproveFinalErpRelease) {
    const vSummary = report.verificationRequiredFindings
      .slice(0, 3)
      .map((e) => `[${e.code}] ${e.message}`)
      .join(" | ");
    throw new ProductionGateBlockedError(
      `DOĞRULAMA BEKLİYOR: Tasarımda doğrulanmamış teknik kaynak veya fabrika numune onayı eksikliği var. Detay: ${vSummary}`,
      report.verificationRequiredFindings
    );
  }
  return report;
}
