import {
  ModuleInstance,
  Position3D,
  SpaceDefinition,
  ValidationIssue,
} from "../types";
import {
  RuleGovernanceNature,
  roundCncCoordMm,
  roundGeometryMm,
} from "../tolerance-policy";

export function resolveCoreHandleSpacingCcMm(door?: {
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
    | "clamp_width_to_usable_sheet"
    | "upgrade_shelf_thickness_25mm"
    | "increase_hinge_count"
    | "confirm_wall_substrate"
    | "upgrade_wet_zone_board"
    | "switch_topology_sides_through"
    | "convert_mid_shelf_to_fixed"
    | "convert_high_drawers_to_shelves"
    | "switch_high_drawers_to_push_open"
    | "auto_notch_obstacles"
    | "resize_before_obstacle";
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

  const explicitlyDisabledAnchor = module.carcass.wallAnchored === false || (module as { wallAnchored?: boolean }).wallAnchored === false;
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
