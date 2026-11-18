import type { DoorConfig, DrawerConfig, ModuleInstance, UnitLength } from "./types";
import {
  calculateBayWidths,
  calculateNetInnerDepth,
  calculateNetInnerHeight,
  roundMm,
} from "./rules";
import {
  calculateDoorHingePositionsY,
  calculateRecommendedHingesPerLeaf,
  inferDoorSystemIdFromType,
} from "./v4-profiles";

/**
 * Versioned rule engine identifier so every technical calculation is traceable and testable.
 */
export const HARDWARE_ENGINEERING_RULES_VERSION = "2026.11.1";

/**
 * Three-tier engineering & production readiness status for every hardware item:
 * - `production_ready` ("Üretime uygun"): Technical specs verified from official catalog,
 *   drilling/BOM formulas validated, safe for automatic CNC & BOM export.
 * - `review_required` ("Kontrol gerekli"): Official base specs exist, but drilling pattern,
 *   exact CNC coordinates, or compatibility requires engineer/factory review before release.
 * - `visual_only` ("Yalnızca görsel"): Usable for 3D scene visualization & concept design only;
 *   NEVER automatically emits CNC drilling holes or unverified production BOM lines.
 */
export type HardwareProductionStatus = "production_ready" | "review_required" | "visual_only";

export const HARDWARE_PRODUCTION_STATUS_META: Record<
  HardwareProductionStatus,
  {
    id: HardwareProductionStatus;
    labelTr: string;
    shortLabelTr: string;
    descriptionTr: string;
    canAutoExportCnc: boolean;
    canAutoExportBom: boolean;
    badgeTone: "emerald" | "amber" | "slate";
  }
> = {
  production_ready: {
    id: "production_ready",
    labelTr: "Üretime uygun",
    shortLabelTr: "Üretime Uygun",
    descriptionTr: "Teknik veriler resmi kaynaklardan doğrulanmış, montaj ve ölçü kontrollerinden geçmiş.",
    canAutoExportCnc: true,
    canAutoExportBom: true,
    badgeTone: "emerald",
  },
  review_required: {
    id: "review_required",
    labelTr: "Kontrol gerekli",
    shortLabelTr: "Kontrol Gerekli",
    descriptionTr: "Temel teknik veriler mevcut ancak delik planı, montaj payı veya uyumluluk mühendis onayı gerektiriyor.",
    canAutoExportCnc: false,
    canAutoExportBom: true,
    badgeTone: "amber",
  },
  visual_only: {
    id: "visual_only",
    labelTr: "Yalnızca görsel",
    shortLabelTr: "Yalnızca Görsel",
    descriptionTr: "Yalnızca 3D sahne ve tasarım önizlemesi için kullanılır; CNC delik ve üretim çıktısına otomatik aktarılmaz.",
    canAutoExportCnc: false,
    canAutoExportBom: false,
    badgeTone: "slate",
  },
};

export type HardwareMountSurface =
  | "door_leaf"
  | "carcass_side"
  | "drawer_box"
  | "bay_interior"
  | "carcass_top"
  | "carcass_bottom"
  | "carcass_back";

export interface HardwareApplicationEnvelope {
  minWidthMm?: UnitLength;
  maxWidthMm?: UnitLength;
  minHeightMm?: UnitLength;
  maxHeightMm?: UnitLength;
  minDepthMm?: UnitLength;
  maxDepthMm?: UnitLength;
  minPanelThicknessMm?: UnitLength;
  maxPanelThicknessMm?: UnitLength;
  maxLoadKg?: number;
  maxDoorWeightKg?: number;
  openingAngleDeg?: number;
  nominalLengthsMm?: UnitLength[];
  rearClearanceMm?: UnitLength;
  sideClearanceMm?: UnitLength;
  overheadClearanceMm?: UnitLength;
  powerFactorRangeLf?: [number, number];
}

export interface HardwareCompanionRequirement {
  sku: string;
  nameTr: string;
  quantityFormula: "per_unit" | "per_pair" | "per_door" | "fixed_1";
  mandatory: boolean;
}

export interface HardwareSmartSpecInput {
  id: string;
  sku: string;
  name: string;
  manufacturerId: string;
  manufacturerName: string;
  familyId: string;
  series?: string;
  productionStatus?: HardwareProductionStatus;
  mountSurface?: HardwareMountSurface;
  loadCapacityKg: number;
  doorThicknessLimitsMm?: [UnitLength, UnitLength];
  doorWeightLimitsKg?: [number, number];
  powerFactorRangeLf?: [number, number];
  pocketClearanceMm?: {
    pocketWidthMm: UnitLength;
    minCarcassDepthMm: UnitLength;
    minDoorHeightMm: UnitLength;
    maxDoorHeightMm: UnitLength;
  };
  applicationEnvelope?: HardwareApplicationEnvelope;
  requiredCompanions?: HardwareCompanionRequirement[];
  compatibleDoorSystems?: string[];
  verification?: {
    sourceTechDataVerified: boolean;
    cadGeometryVerified: boolean;
    bomFormulaVerified: boolean;
    drillingPatternVerified: boolean;
    physicalFactorySampleTested: boolean;
  };
  sourceId?: string;
  officialSourceUrl?: string;
}

/**
 * Manufacturer standards vs general furniture engineering rules are managed separately
 * so updates to a manufacturer catalog never corrupt general ergonomic/structural limits.
 */
export const GENERAL_FURNITURE_ENGINEERING_RULES = {
  version: HARDWARE_ENGINEERING_RULES_VERSION,
  standardPanelThicknessMm: 18,
  defaultDoorDensityKgPerM3: 720, // MDF / melamin ortalama
  minHingedLeafWidthMm: 180,
  maxHingedLeafWidthMm: 600,
  maxHingedLeafHeightMm: 2600,
  minDrawerBayWidthMm: 250,
  maxDrawerBayWidthUnsynchronizedMm: 1200,
  minDrawerFrontHeightMm: 90,
  defaultDrawerRearClearanceMm: 15,
  system32FrontSetbackMm: 37,
  system32PitchMm: 32,
  defaultHingeEdgeOffsetMm: 100,
} as const;

export const MANUFACTURER_DRILLING_STANDARDS = {
  version: HARDWARE_ENGINEERING_RULES_VERSION,
  mfr_blum: {
    cupDiameterMm: 35,
    cupDepthStdMm: 13.0,
    cupDepth155Mm: 11.7,
    cupDepth107Mm: 11.5,
    bossPitchMm: 45.0,
    bossOffsetMm: 9.5,
    system32SetbackMm: 37.0,
    defaultMountingPlateSku: "173H7100",
    defaultMountingPlateNameTr: "Blum CLIP Haç Montaj Tablası 0mm (37/32)",
  },
  mfr_hettich: {
    cupDiameterMm: 35,
    cupDepthStdMm: 12.8,
    cupDepth165Mm: 11.6,
    bossPitchMm: 52.0,
    bossOffsetMm: 5.5,
    system32SetbackMm: 37.0,
    defaultMountingPlateSku: "9071626",
    defaultMountingPlateNameTr: "Hettich Sensys Haç Montaj Tablası 1.5mm (37/32)",
  },
  mfr_salice: {
    cupDiameterMm: 35,
    cupDepthStdMm: 12.0,
    bossPitchMm: 48.0,
    bossOffsetMm: 9.0,
    system32SetbackMm: 37.0,
    defaultMountingPlateSku: "BAP3R09",
    defaultMountingPlateNameTr: "Salice Domi Haç Montaj Tablası 0mm",
  },
  mfr_grass: {
    cupDiameterMm: 35,
    cupDepthStdMm: 12.6,
    bossPitchMm: 45.0,
    bossOffsetMm: 9.5,
    system32SetbackMm: 37.0,
    defaultMountingPlateSku: "F058139702",
    defaultMountingPlateNameTr: "Grass Tiomos Haç Montaj Tablası 0mm",
  },
} as const;

/**
 * Deterministically resolves the 3-tier production status of a hardware item.
 * Never promotes an unverified item to `production_ready`.
 */
export function resolveHardwareProductionStatus(
  item: Pick<HardwareSmartSpecInput, "productionStatus" | "verification" | "sourceId">
): HardwareProductionStatus {
  if (item.productionStatus === "visual_only") return "visual_only";
  const v = item.verification;
  if (!v || !v.sourceTechDataVerified || !item.sourceId) {
    return "visual_only";
  }
  if (
    item.productionStatus === "production_ready" &&
    v.sourceTechDataVerified &&
    v.cadGeometryVerified &&
    v.bomFormulaVerified &&
    v.drillingPatternVerified
  ) {
    return "production_ready";
  }
  if (
    !item.productionStatus &&
    v.sourceTechDataVerified &&
    v.cadGeometryVerified &&
    v.bomFormulaVerified &&
    v.drillingPatternVerified
  ) {
    return "production_ready";
  }
  return "review_required";
}

export interface ComputedMountPoint3D {
  labelTr: string;
  surface: HardwareMountSurface;
  side: "left" | "right" | "both" | "top" | "bottom" | "center";
  xMm: UnitLength;
  yMm: UnitLength;
  zMm: UnitLength;
  drillingNotesTr?: string;
}

export interface HardwareMountIssue {
  code: string;
  severity: "error" | "warning";
  reasonTr: string;
  solutionTr: string;
}

export interface HardwareMountEvaluation {
  rulesVersion: string;
  hardwareId: string;
  sku: string;
  productionStatus: HardwareProductionStatus;
  canMount: boolean;
  canExportCnc: boolean;
  targetSurface: HardwareMountSurface;
  bayIndex: number;
  drawerId?: string;
  estimatedDoorWeightKg?: number;
  computedPowerFactorLf?: number;
  recommendedNominalLengthMm?: UnitLength;
  recommendedQuantityPerTarget: number;
  mountPoints: ComputedMountPoint3D[];
  requiredCompanions: HardwareCompanionRequirement[];
  issues: HardwareMountIssue[];
  summaryTr: string;
}

/**
 * Estimates door leaf weight (kg) from geometry + panel thickness + material density.
 */
export function estimateDoorLeafWeightKg(
  leafWidthMm: UnitLength,
  leafHeightMm: UnitLength,
  thicknessMm: UnitLength,
  densityKgPerM3 = GENERAL_FURNITURE_ENGINEERING_RULES.defaultDoorDensityKgPerM3,
  handleWeightKg = 0.25
): number {
  const volumeM3 = (leafWidthMm / 1000) * (leafHeightMm / 1000) * (thicknessMm / 1000);
  return roundMm(Math.max(0.5, volumeM3 * densityKgPerM3 + handleWeightKg), 2);
}

/**
 * Infers primary mount surface from hardware family when not explicitly specified.
 */
export function inferHardwareMountSurface(familyId: string): HardwareMountSurface {
  switch (familyId) {
    case "fam_hinge_concealed":
    case "fam_hinge_plate":
    case "fam_push_soft_close":
      return "door_leaf";
    case "fam_drawer_box":
    case "fam_runner_concealed":
      return "drawer_box";
    case "fam_lift_system":
    case "fam_sliding_system":
    case "fam_pocket_system":
      return "door_leaf";
    case "fam_plinth_leg":
      return "carcass_bottom";
    case "fam_connector":
    case "fam_shelf_support":
      return "carcass_side";
    case "fam_wardrobe_acc":
    case "fam_kitchen_acc":
    default:
      return "bay_interior";
  }
}

/**
 * Evaluates smart parametric placement, coordinates, companion parts, kinematics,
 * clearances, and manufacturer limits for placing a hardware item onto a module bay/drawer.
 */
export function evaluateHardwareMountPlacement(
  module: ModuleInstance,
  hardware: HardwareSmartSpecInput,
  bayIndex = 0,
  targetDrawerId?: string
): HardwareMountEvaluation {
  const status = resolveHardwareProductionStatus(hardware);
  const statusMeta = HARDWARE_PRODUCTION_STATUS_META[status];
  const safeBayIdx = Math.max(0, Math.min(bayIndex, Math.max(0, module.bays.length - 1)));
  const bay = module.bays[safeBayIdx];
  const bayWidths = calculateBayWidths(module);
  const bayW = bayWidths[safeBayIdx] ?? 450;
  const netInnerDepth = calculateNetInnerDepth(module);
  const netInnerHeight = calculateNetInnerHeight(module);
  const doorThickness = module.carcass.doorThickness ?? module.carcass.panelThickness ?? 18;
  const panelThickness = module.carcass.panelThickness ?? 18;
  const targetSurface = hardware.mountSurface ?? inferHardwareMountSurface(hardware.familyId);
  const env = hardware.applicationEnvelope ?? {};

  const issues: HardwareMountIssue[] = [];
  const mountPoints: ComputedMountPoint3D[] = [];
  const requiredCompanions: HardwareCompanionRequirement[] = [...(hardware.requiredCompanions ?? [])];

  if (status === "visual_only") {
    issues.push({
      code: "HW_VISUAL_ONLY_NO_CNC",
      severity: "warning",
      reasonTr: `${hardware.name} "Yalnızca görsel" durumundadır; doğrulanmış delik ve üretim verisi içermez.`,
      solutionTr: "Tasarım önizlemesi için kullanabilirsiniz ancak CNC/BOM üretim çıktısı öncesi doğrulanmış bir ürün seçin.",
    });
  } else if (status === "review_required") {
    issues.push({
      code: "HW_REVIEW_REQUIRED",
      severity: "warning",
      reasonTr: `${hardware.name} "Kontrol gerekli" durumundadır; delik koordinatları veya fabrika uyumluluğu onay bekliyor.`,
      solutionTr: "Üretim paketini aktarmadan önce teknik çizimi ve delik koordinatlarını kontrol edin.",
    });
  }

  let estimatedDoorWeightKg: number | undefined;
  let computedPowerFactorLf: number | undefined;
  let recommendedNominalLengthMm: UnitLength | undefined;
  let recommendedQuantityPerTarget = 1;

  // 1. HINGE & HINGE MOUNTING PLATE RULES
  if (hardware.familyId === "fam_hinge_concealed" || hardware.familyId === "fam_hinge_plate") {
    const door = bay?.door;
    const hasDoor = Boolean(door && door.type !== "open");
    const isDouble = Boolean(door && (door.type === "double" || door.type === "inset_double"));
    const leafWidthMm = isDouble ? roundMm(bayW / 2, 1) : bayW;
    const leafHeightMm = netInnerHeight + 2 * panelThickness - 4;
    estimatedDoorWeightKg = estimateDoorLeafWeightKg(leafWidthMm, leafHeightMm, doorThickness);

    if (!hasDoor) {
      issues.push({
        code: "HW_NO_DOOR_IN_BAY",
        severity: "error",
        reasonTr: `Bölme ${safeBayIdx + 1} açık (kapaksız) olduğu için menteşe bağlanacak kapak yüzeyi bulunamadı.`,
        solutionTr: "Önce bu bölmeye tek veya çift menteşeli kapak ekleyin, ardından menteşe seçin.",
      });
    } else if (door) {
      const dSys = door.doorSystemId || inferDoorSystemIdFromType(door.type);
      if (dSys.startsWith("sliding") || dSys.startsWith("lift") || dSys === "pocket_retractable" || dSys === "tambour_roller") {
        issues.push({
          code: "HW_INCOMPATIBLE_DOOR_SYSTEM",
          severity: "error",
          reasonTr: `Mevcut kapak tipi (${dSys}) standart tas menteşe ile uyumlu değil.`,
          solutionTr: "Menteşe kullanmak için kapak tipini menteşeli (tek/çift/içten) olarak değiştirin.",
        });
      }
      const hasInternalDrawers = (bay?.drawers || []).some((d) => d.isInternal && !d.isHidden);
      const isZeroProtrusion =
        hardware.id.includes("155") ||
        hardware.id.includes("165") ||
        hardware.sku.includes("71B7550") ||
        hardware.sku.includes("9099540") ||
        (env.openingAngleDeg ?? 110) >= 155;
      if (hasInternalDrawers && !isZeroProtrusion) {
        issues.push({
          code: "HW_INTERNAL_DRAWER_COLLISION",
          severity: "error",
          reasonTr: "Bu bölmede iç çekmece bulunuyor; standart 110° menteşede kapak kalınlığı çekmece çıkış yolunu kapatır.",
          solutionTr: "Blum 155° (71B7550) veya Hettich Sensys 165° (9099540) sıfır çıkıntı menteşe kullanın.",
        });
      }
    }

    const thickLimits = hardware.doorThicknessLimitsMm ?? (env.minPanelThicknessMm && env.maxPanelThicknessMm ? [env.minPanelThicknessMm, env.maxPanelThicknessMm] : [16, 24]);
    if (doorThickness < thickLimits[0] || doorThickness > thickLimits[1]) {
      issues.push({
        code: "HW_DOOR_THICKNESS_OUT_OF_RANGE",
        severity: "error",
        reasonTr: `Kapak kalınlığı (${doorThickness} mm) bu menteşenin izin verdiği aralığın (${thickLimits[0]}–${thickLimits[1]} mm) dışında.`,
        solutionTr: doorThickness > thickLimits[1]
          ? "Kalın kapak menteşesi (örn. Blum 95° 71B9550 veya Hettich 165° 9099540) seçin ya da kapak kalınlığını düşürün."
          : "İnce kapak menteşesi (Blum EXPANDO T 8–14mm veya 107°) seçin.",
      });
    }

    if (leafWidthMm > GENERAL_FURNITURE_ENGINEERING_RULES.maxHingedLeafWidthMm) {
      issues.push({
        code: "HW_LEAF_TOO_WIDE",
        severity: "error",
        reasonTr: `Tek kapak kanadı (${Math.round(leafWidthMm)} mm) 600 mm güvenli menteşe sınırını aşıyor.`,
        solutionTr: "Kapağı çift kanata bölün veya bölme genişliğini 600 mm ve altına düşürün.",
      });
    }

    const hingesPerLeaf = calculateRecommendedHingesPerLeaf(leafHeightMm, estimatedDoorWeightKg);
    recommendedQuantityPerTarget = isDouble ? hingesPerLeaf * 2 : hingesPerLeaf;
    const hingeYs = calculateDoorHingePositionsY(leafHeightMm, { hingeCount: hingesPerLeaf, leafWeightKg: estimatedDoorWeightKg });
    const side: "left" | "right" | "both" = isDouble
      ? "both"
      : door?.type === "single_right" || door?.type === "inset_right" || door?.type === "half_overlay_right"
      ? "right"
      : "left";

    const mfrStd =
      hardware.manufacturerId === "mfr_hettich"
        ? MANUFACTURER_DRILLING_STANDARDS.mfr_hettich
        : hardware.manufacturerId === "mfr_salice"
        ? MANUFACTURER_DRILLING_STANDARDS.mfr_salice
        : hardware.manufacturerId === "mfr_grass"
        ? MANUFACTURER_DRILLING_STANDARDS.mfr_grass
        : MANUFACTURER_DRILLING_STANDARDS.mfr_blum;

    if (hardware.familyId === "fam_hinge_concealed" && requiredCompanions.length === 0) {
      requiredCompanions.push({
        sku: mfrStd.defaultMountingPlateSku,
        nameTr: mfrStd.defaultMountingPlateNameTr,
        quantityFormula: "per_unit",
        mandatory: true,
      });
    }

    hingeYs.forEach((yMm, idx) => {
      mountPoints.push({
        labelTr: `Menteşe #${idx + 1} (${side === "both" ? "Sol+Sağ" : side === "right" ? "Sağ" : "Sol"})`,
        surface: "door_leaf",
        side,
        xMm: side === "right" ? roundMm(leafWidthMm - 21.5, 1) : 21.5,
        yMm: roundMm(yMm, 1),
        zMm: 0,
        drillingNotesTr: `Ø${mfrStd.cupDiameterMm}×${mfrStd.cupDepthStdMm}mm tas + ${mfrStd.bossPitchMm}×${mfrStd.bossOffsetMm}mm vida; gövde 37/32mm`,
      });
    });
  }

  // 2. DRAWER BOX & CONCEALED RUNNER RULES
  else if (hardware.familyId === "fam_drawer_box" || hardware.familyId === "fam_runner_concealed") {
    const activeDrawers = (bay?.drawers || []).filter((d) => !d.isHidden);
    const matchedDrawer: DrawerConfig | undefined = targetDrawerId
      ? activeDrawers.find((d) => d.id === targetDrawerId)
      : activeDrawers[0];
    const rearClearance = env.rearClearanceMm ?? GENERAL_FURNITURE_ENGINEERING_RULES.defaultDrawerRearClearanceMm;
    const nominalList = env.nominalLengthsMm ?? [270, 300, 350, 400, 450, 500, 550, 600];
    const fittingNominals = nominalList.filter((nl) => nl + rearClearance <= netInnerDepth);
    recommendedNominalLengthMm = fittingNominals.length > 0 ? fittingNominals[fittingNominals.length - 1] : undefined;

    if (!recommendedNominalLengthMm) {
      const minNl = Math.min(...nominalList);
      issues.push({
        code: "HW_DRAWER_DEPTH_INSUFFICIENT",
        severity: "error",
        reasonTr: `Modül net iç derinliği (${Math.round(netInnerDepth)} mm), en kısa ray boyu (${minNl} mm + ${rearClearance} mm arka pay = ${minNl + rearClearance} mm) için yetersiz.`,
        solutionTr: `Modül derinliğini en az ${minNl + rearClearance + 30} mm değerine çıkarın veya daha kısa ray ailesi seçin.`,
      });
    }

    const minW = env.minWidthMm ?? GENERAL_FURNITURE_ENGINEERING_RULES.minDrawerBayWidthMm;
    const maxW = env.maxWidthMm ?? GENERAL_FURNITURE_ENGINEERING_RULES.maxDrawerBayWidthUnsynchronizedMm;
    if (bayW < minW || bayW > maxW) {
      issues.push({
        code: "HW_DRAWER_WIDTH_OUT_OF_RANGE",
        severity: "error",
        reasonTr: `Bölme iç genişliği (${Math.round(bayW)} mm) bu ray/çekmece sisteminin çalışma aralığı (${minW}–${maxW} mm) dışında.`,
        solutionTr: bayW > maxW
          ? "Bölmeyi ikiye bölün veya senkronizasyon mili ekleyin."
          : `Bölme genişliğini en az ${minW} mm yapın.`,
      });
    }

    if (matchedDrawer && matchedDrawer.height < (env.minHeightMm ?? GENERAL_FURNITURE_ENGINEERING_RULES.minDrawerFrontHeightMm)) {
      issues.push({
        code: "HW_DRAWER_HEIGHT_TOO_LOW",
        severity: "error",
        reasonTr: `Çekmece ön yüksekliği (${Math.round(matchedDrawer.height)} mm) kasa/ray montaj yüksekliğinin (${env.minHeightMm ?? 90} mm) altında.`,
        solutionTr: `Çekmece yüksekliğini en az ${env.minHeightMm ?? 140} mm olarak güncelleyin.`,
      });
    }

    const elevY = matchedDrawer ? matchedDrawer.elevationY : 32;
    mountPoints.push(
      {
        labelTr: `Sol Ray Montaj Hattı (NL ${recommendedNominalLengthMm ?? "—"} mm)`,
        surface: "carcass_side",
        side: "left",
        xMm: 37,
        yMm: roundMm(elevY + 37, 1),
        zMm: 0,
        drillingNotesTr: "System 32 ön eksen 37 mm + arka montaj delikleri 32 mm katları",
      },
      {
        labelTr: `Sağ Ray Montaj Hattı (NL ${recommendedNominalLengthMm ?? "—"} mm)`,
        surface: "carcass_side",
        side: "right",
        xMm: 37,
        yMm: roundMm(elevY + 37, 1),
        zMm: 0,
        drillingNotesTr: "System 32 ön eksen 37 mm + arka montaj delikleri 32 mm katları",
      }
    );
  }

  // 3. LIFT MECHANISM RULES (AVENTOS HK top / HF top / HL top / HK-S)
  else if (hardware.familyId === "fam_lift_system") {
    const kh = module.dimensions.height;
    const minH = env.minHeightMm ?? 205;
    const maxH = env.maxHeightMm ?? 600;
    const maxW = env.maxWidthMm ?? 1800;
    const minD = env.minDepthMm ?? 187;

    estimatedDoorWeightKg = estimateDoorLeafWeightKg(bayW, kh, doorThickness);
    computedPowerFactorLf = roundMm(kh * estimatedDoorWeightKg, 0);

    if (kh < minH || kh > maxH) {
      issues.push({
        code: "HW_LIFT_HEIGHT_OUT_OF_RANGE",
        severity: "error",
        reasonTr: `Gövde yüksekliği (${Math.round(kh)} mm), ${hardware.name} çalışma aralığı (${minH}–${maxH} mm) dışında.`,
        solutionTr: kh > 600
          ? "600–1040 mm yükseklikler için Blum AVENTOS HF top (katlanır kalkar) veya çift menteşeli kapak seçin."
          : "205–400 mm alçak üst dolaplar için Blum AVENTOS HK-S seçin.",
      });
    }
    if (bayW > maxW) {
      issues.push({
        code: "HW_LIFT_WIDTH_EXCEEDED",
        severity: "error",
        reasonTr: `Kapak genişliği (${Math.round(bayW)} mm) azami ${maxW} mm sınırını aşıyor.`,
        solutionTr: "Bölmeyi ikiye bölerek her kanat için bağımsız kalkar mekanizma kullanın.",
      });
    }
    if (netInnerDepth < minD) {
      issues.push({
        code: "HW_LIFT_DEPTH_INSUFFICIENT",
        severity: "error",
        reasonTr: `Net iç derinlik (${Math.round(netInnerDepth)} mm) mekanizma gövdesi için gereken minimum ${minD} mm değerinin altında.`,
        solutionTr: `Modül derinliğini en az ${minD + 30} mm değerine çıkarın.`,
      });
    }
    const lfRange = hardware.powerFactorRangeLf ?? env.powerFactorRangeLf;
    if (lfRange && (computedPowerFactorLf < lfRange[0] || computedPowerFactorLf > lfRange[1])) {
      issues.push({
        code: "HW_LIFT_POWER_FACTOR_MISMATCH",
        severity: "warning",
        reasonTr: `Hesaplanan güç faktörü LF = ${computedPowerFactorLf} (${Math.round(kh)}mm × ${estimatedDoorWeightKg}kg), bu mekanizmanın LF aralığının (${lfRange[0]}–${lfRange[1]}) dışında.`,
        solutionTr: "Kapak ağırlığına uygun farklı güç faktörlü AVENTOS kuvvet ünitesi seçin veya 3. kuvvet ünitesi ekleyin.",
      });
    }

    mountPoints.push(
      {
        labelTr: "Sol Kuvvet Ünitesi (Üst Yan Dikme)",
        surface: "carcass_side",
        side: "left",
        xMm: 37,
        yMm: roundMm(netInnerHeight - 48, 1),
        zMm: 0,
        drillingNotesTr: `LF = ${computedPowerFactorLf} • min. iç derinlik ${minD} mm`,
      },
      {
        labelTr: "Sağ Kuvvet Ünitesi (Üst Yan Dikme)",
        surface: "carcass_side",
        side: "right",
        xMm: 37,
        yMm: roundMm(netInnerHeight - 48, 1),
        zMm: 0,
        drillingNotesTr: `LF = ${computedPowerFactorLf} • min. iç derinlik ${minD} mm`,
      }
    );
  }

  // 4. SLIDING, FOLDING & POCKET SYSTEMS
  else if (hardware.familyId === "fam_sliding_system" || hardware.familyId === "fam_pocket_system") {
    const minD = hardware.pocketClearanceMm?.minCarcassDepthMm ?? env.minDepthMm ?? 560;
    const minH = hardware.pocketClearanceMm?.minDoorHeightMm ?? env.minHeightMm ?? 800;
    const maxH = hardware.pocketClearanceMm?.maxDoorHeightMm ?? env.maxHeightMm ?? 2600;
    const minW = env.minWidthMm ?? 550;
    const maxW = env.maxWidthMm ?? 2000;
    const doorH = module.dimensions.height - module.carcass.plinthHeight;
    const leafW = hardware.familyId === "fam_pocket_system" ? bayW : roundMm(module.dimensions.width / 2, 1);
    estimatedDoorWeightKg = estimateDoorLeafWeightKg(leafW, doorH, doorThickness);

    if (module.dimensions.depth < minD) {
      issues.push({
        code: "HW_SLIDING_POCKET_DEPTH_LOW",
        severity: "error",
        reasonTr: `Modül derinliği (${Math.round(module.dimensions.depth)} mm), ${hardware.name} için gereken minimum ${minD} mm derinliğin altında.`,
        solutionTr: `Modül derinliğini en az ${minD} mm yapın.`,
      });
    }
    if (doorH < minH || doorH > maxH) {
      issues.push({
        code: "HW_SLIDING_POCKET_HEIGHT_OUT_OF_RANGE",
        severity: "error",
        reasonTr: `Kapak yüksekliği (${Math.round(doorH)} mm) sistemin izin verdiği ${minH}–${maxH} mm aralığının dışında.`,
        solutionTr: `Modül yüksekliğini ${minH}–${maxH} mm aralığına getirin veya uygun başka bir sürgü/pocket serisi seçin.`,
      });
    }
    if (leafW < minW || leafW > maxW) {
      issues.push({
        code: "HW_SLIDING_LEAF_WIDTH_OUT_OF_RANGE",
        severity: "warning",
        reasonTr: `Kapak kanat genişliği (${Math.round(leafW)} mm) üretici tavsiye aralığı (${minW}–${maxW} mm) dışında.`,
        solutionTr: "Modül genişliğini veya kapak kanat sayısını üretici aralığına göre ayarlayın.",
      });
    }
    if (estimatedDoorWeightKg > hardware.loadCapacityKg) {
      issues.push({
        code: "HW_SLIDING_WEIGHT_EXCEEDED",
        severity: "error",
        reasonTr: `Tahmini kanat ağırlığı (${estimatedDoorWeightKg} kg) mekanizma taşıma kapasitesini (${hardware.loadCapacityKg} kg) aşıyor.`,
        solutionTr: "Daha yüksek kapasiteli bir sürgü sistemi (örn. Hettich TopLine XL 80/100 kg) seçin.",
      });
    }
    mountPoints.push({
      labelTr: hardware.familyId === "fam_pocket_system" ? "Yan Cep Kaseti (Pocket)" : "Üst/Alt Sürgü Ray Profili",
      surface: hardware.familyId === "fam_pocket_system" ? "carcass_side" : "carcass_top",
      side: "top",
      xMm: 0,
      yMm: roundMm(doorH, 1),
      zMm: 0,
      drillingNotesTr: hardware.pocketClearanceMm
        ? `Cep genişliği: ${hardware.pocketClearanceMm.pocketWidthMm} mm • Min. derinlik: ${minD} mm`
        : `Azami kanat ağırlığı: ${hardware.loadCapacityKg} kg`,
    });
  }

  // 5. PUSH-TO-OPEN & SOFT-CLOSE MECHANISMS
  else if (hardware.familyId === "fam_push_soft_close") {
    const door = bay?.door;
    if (door && door.handleCategory && door.handleCategory !== "handleless_plain") {
      issues.push({
        code: "HW_PUSH_OPEN_WITH_HANDLE",
        severity: "warning",
        reasonTr: "Bu kapakta fiziksel kulp seçili; Bas-Aç (TIP-ON) mekanizması kulpsuz cepheler için tasarlanmıştır.",
        solutionTr: "Kulpu 'Kulpsuz Düz Cephe' olarak değiştirin; 2.5 mm basma boşluğu otomatik uygulanır.",
      });
    }
    mountPoints.push({
      labelTr: "Bas-Aç Piston / Adaptör Plakası (Kulp Tarafı)",
      surface: "carcass_side",
      side: door?.type === "single_right" ? "left" : "right",
      xMm: 37,
      yMm: roundMm(netInnerHeight / 2, 1),
      zMm: 0,
      drillingNotesTr: "Kapak açma boşluğu 2.0–2.6 mm; yaylı olmayan (unsprung) menteşe ile eşleştirin",
    });
  }

  // 6. CONNECTORS, SHELF SUPPORTS, PLINTH LEGS & ORGANIZERS
  else {
    const minW = env.minWidthMm;
    const maxW = env.maxWidthMm;
    const minD = env.minDepthMm;
    const minH = env.minHeightMm;
    if (minW && bayW < minW) {
      issues.push({
        code: "HW_ACC_WIDTH_TOO_NARROW",
        severity: "error",
        reasonTr: `Bölme genişliği (${Math.round(bayW)} mm) bu donanım için gereken minimum ${minW} mm genişliğin altında.`,
        solutionTr: `Bölme genişliğini en az ${minW} mm olacak şekilde genişletin.`,
      });
    }
    if (maxW && bayW > maxW) {
      issues.push({
        code: "HW_ACC_WIDTH_TOO_WIDE",
        severity: "error",
        reasonTr: `Bölme genişliği (${Math.round(bayW)} mm) bu donanım için azami ${maxW} mm sınırını aşıyor.`,
        solutionTr: `Bölme genişliğini ${maxW} mm veya altına düşürün.`,
      });
    }
    if (minD && netInnerDepth < minD) {
      issues.push({
        code: "HW_ACC_DEPTH_TOO_SHALLOW",
        severity: "error",
        reasonTr: `Net iç derinlik (${Math.round(netInnerDepth)} mm) bu aksesuar için gereken minimum ${minD} mm derinliğin altında.`,
        solutionTr: `Modül derinliğini en az ${minD + 30} mm yapın.`,
      });
    }
    if (minH && netInnerHeight < minH) {
      issues.push({
        code: "HW_ACC_HEIGHT_TOO_LOW",
        severity: "error",
        reasonTr: `Net iç yükseklik (${Math.round(netInnerHeight)} mm) bu mekanizma için gereken minimum ${minH} mm yüksekliğin altında.`,
        solutionTr: `Modül yüksekliğini en az ${minH + 150} mm yapın.`,
      });
    }
    if (hardware.familyId === "fam_plinth_leg") {
      recommendedQuantityPerTarget = module.dimensions.width > 900 ? 6 : 4;
      mountPoints.push({
        labelTr: `${recommendedQuantityPerTarget} Adet Ayarlı Baza Ayağı`,
        surface: "carcass_bottom",
        side: "bottom",
        xMm: 60,
        yMm: 0,
        zMm: 60,
        drillingNotesTr: `Baza yüksekliği: ${module.carcass.plinthHeight} mm`,
      });
    } else {
      mountPoints.push({
        labelTr: `Bölme ${safeBayIdx + 1} İç Montaj Konumu`,
        surface: targetSurface,
        side: "center",
        xMm: roundMm(bayW / 2, 1),
        yMm: roundMm(netInnerHeight / 2, 1),
        zMm: roundMm(netInnerDepth / 2, 1),
      });
    }
  }

  const hasBlockingError = issues.some((i) => i.severity === "error");

  return {
    rulesVersion: HARDWARE_ENGINEERING_RULES_VERSION,
    hardwareId: hardware.id,
    sku: hardware.sku,
    productionStatus: status,
    canMount: !hasBlockingError,
    canExportCnc: !hasBlockingError && statusMeta.canAutoExportCnc,
    targetSurface,
    bayIndex: safeBayIdx,
    drawerId: targetDrawerId,
    estimatedDoorWeightKg,
    computedPowerFactorLf,
    recommendedNominalLengthMm,
    recommendedQuantityPerTarget,
    mountPoints,
    requiredCompanions,
    issues,
    summaryTr: hasBlockingError
      ? issues.find((i) => i.severity === "error")?.reasonTr || "Donanım bu ölçülerle uyumlu değil."
      : `${hardware.name} Bölme ${safeBayIdx + 1} için uyumlu (${statusMeta.labelTr}).`,
  };
}

export interface ResizeHardwareFinding {
  bayIndex: number;
  targetKind: "door" | "drawer" | "special_fitting";
  targetId: string;
  currentHardwareId: string;
  currentHardwareName: string;
  productionStatus: HardwareProductionStatus;
  compatible: boolean;
  reasonTr: string;
  solutionTr: string;
  suggestedAlternatives: Array<{
    hardwareId: string;
    sku: string;
    nameTr: string;
    reasonTr: string;
  }>;
}

export interface ResizeHardwareAdaptationReport {
  rulesVersion: string;
  moduleId: string;
  allCompatible: boolean;
  incompatibleCount: number;
  findings: ResizeHardwareFinding[];
}

/**
 * Re-evaluates every assigned hardware product in a module after any dimension,
 * panel thickness, or bay-split change. NEVER silently replaces user-chosen hardware;
 * instead reports exact incompatibilities and suggests verified compatible alternatives.
 */
export function evaluateHardwareAfterModuleResize(
  module: ModuleInstance,
  catalogLookup: (id?: string) => HardwareSmartSpecInput | undefined,
  allCatalogItems: HardwareSmartSpecInput[]
): ResizeHardwareAdaptationReport {
  const findings: ResizeHardwareFinding[] = [];

  const findAlternatives = (
    current: HardwareSmartSpecInput,
    bayIdx: number,
    drawerId?: string
  ) => {
    return allCatalogItems
      .filter(
        (cand) =>
          cand.id !== current.id &&
          cand.familyId === current.familyId &&
          resolveHardwareProductionStatus(cand) !== "visual_only"
      )
      .filter((cand) => evaluateHardwareMountPlacement(module, cand, bayIdx, drawerId).canMount)
      .slice(0, 3)
      .map((cand) => ({
        hardwareId: cand.id,
        sku: cand.sku,
        nameTr: cand.name,
        reasonTr: `Yeni modül ölçüleriyle uyumlu (${cand.manufacturerName} • ${cand.loadCapacityKg} kg)`,
      }));
  };

  module.bays.forEach((bay, bIdx) => {
    // 1. Door hardware
    if (bay.door && bay.door.type !== "open" && bay.door.hardwareProductId) {
      const hw = catalogLookup(bay.door.hardwareProductId);
      if (hw) {
        const evalRes = evaluateHardwareMountPlacement(module, hw, bIdx);
        if (!evalRes.canMount) {
          const firstErr = evalRes.issues.find((i) => i.severity === "error");
          findings.push({
            bayIndex: bIdx,
            targetKind: "door",
            targetId: bay.door.id,
            currentHardwareId: hw.id,
            currentHardwareName: hw.name,
            productionStatus: evalRes.productionStatus,
            compatible: false,
            reasonTr: firstErr?.reasonTr || "Kapak donanımı yeni ölçülerle uyumsuz.",
            solutionTr: firstErr?.solutionTr || "Ölçüleri düzenleyin veya uyumlu bir alternatif seçin.",
            suggestedAlternatives: findAlternatives(hw, bIdx),
          });
        }
      }
    }

    // 2. Drawer hardware
    (bay.drawers || []).forEach((drw) => {
      if (drw.isHidden || !drw.hardwareProductId) return;
      const hw = catalogLookup(drw.hardwareProductId);
      if (hw) {
        const evalRes = evaluateHardwareMountPlacement(module, hw, bIdx, drw.id);
        if (!evalRes.canMount) {
          const firstErr = evalRes.issues.find((i) => i.severity === "error");
          findings.push({
            bayIndex: bIdx,
            targetKind: "drawer",
            targetId: drw.id,
            currentHardwareId: hw.id,
            currentHardwareName: hw.name,
            productionStatus: evalRes.productionStatus,
            compatible: false,
            reasonTr: firstErr?.reasonTr || "Çekmece rayı yeni ölçülerle uyumsuz.",
            solutionTr: firstErr?.solutionTr || "Derinliği artırın veya uyumlu ray seçin.",
            suggestedAlternatives: findAlternatives(hw, bIdx, drw.id),
          });
        }
      }
    });

    // 3. Special fittings
    (bay.specialFittings || []).forEach((fit) => {
      if (fit.isHidden || !fit.hardwareProductId) return;
      const hw = catalogLookup(fit.hardwareProductId);
      if (hw) {
        const evalRes = evaluateHardwareMountPlacement(module, hw, bIdx);
        if (!evalRes.canMount) {
          const firstErr = evalRes.issues.find((i) => i.severity === "error");
          findings.push({
            bayIndex: bIdx,
            targetKind: "special_fitting",
            targetId: fit.id,
            currentHardwareId: hw.id,
            currentHardwareName: hw.name,
            productionStatus: evalRes.productionStatus,
            compatible: false,
            reasonTr: firstErr?.reasonTr || "Özel aksesuar yeni ölçülerle uyumsuz.",
            solutionTr: firstErr?.solutionTr || "Bölme ölçüsünü düzenleyin veya uyumlu alternatif seçin.",
            suggestedAlternatives: findAlternatives(hw, bIdx),
          });
        }
      }
    });
  });

  return {
    rulesVersion: HARDWARE_ENGINEERING_RULES_VERSION,
    moduleId: module.id,
    allCompatible: findings.length === 0,
    incompatibleCount: findings.length,
    findings,
  };
}

export interface ProjectHardwareGateResult {
  passed: boolean;
  visualOnlyCount: number;
  reviewRequiredCount: number;
  incompatibleCount: number;
  blockingReasonsTr: string[];
  advisoryNotesTr: string[];
}

/**
 * Production gate check across all modules in a project:
 * - Blocks automatic CNC/BOM release if any assigned hardware is `visual_only`
 *   or fails parametric dimension/clearance validation.
 * - Flags `review_required` items as advisories for engineering sign-off.
 */
export function evaluateProjectHardwareProductionGate(
  modules: ModuleInstance[],
  catalogLookup: (id?: string) => HardwareSmartSpecInput | undefined,
  allCatalogItems: HardwareSmartSpecInput[]
): ProjectHardwareGateResult {
  let visualOnlyCount = 0;
  let reviewRequiredCount = 0;
  let incompatibleCount = 0;
  const blockingReasonsTr: string[] = [];
  const advisoryNotesTr: string[] = [];

  modules.forEach((mod) => {
    const resizeReport = evaluateHardwareAfterModuleResize(mod, catalogLookup, allCatalogItems);
    resizeReport.findings.forEach((f) => {
      incompatibleCount += 1;
      blockingReasonsTr.push(
        `[${mod.name} • Bölme ${f.bayIndex + 1}] ${f.currentHardwareName}: ${f.reasonTr}`
      );
    });

    mod.bays.forEach((bay, bIdx) => {
      const assignedIds: Array<{ label: string; id?: string }> = [];
      if (bay.door && bay.door.type !== "open" && bay.door.hardwareProductId) {
        assignedIds.push({ label: "Kapak", id: bay.door.hardwareProductId });
      }
      (bay.drawers || []).forEach((d, dIdx) => {
        if (!d.isHidden && d.hardwareProductId) {
          assignedIds.push({ label: `Çekmece #${dIdx + 1}`, id: d.hardwareProductId });
        }
      });
      (bay.specialFittings || []).forEach((sf) => {
        if (!sf.isHidden && sf.hardwareProductId) {
          assignedIds.push({ label: "Aksesuar", id: sf.hardwareProductId });
        }
      });

      assignedIds.forEach(({ label, id }) => {
        const hw = catalogLookup(id);
        if (!hw) return;
        const st = resolveHardwareProductionStatus(hw);
        if (st === "visual_only") {
          visualOnlyCount += 1;
          blockingReasonsTr.push(
            `[${mod.name} • Bölme ${bIdx + 1} ${label}] "${hw.name}" yalnızca görsel durumundadır; CNC/üretim çıktısına otomatik aktarılamaz.`
          );
        } else if (st === "review_required") {
          reviewRequiredCount += 1;
          advisoryNotesTr.push(
            `[${mod.name} • Bölme ${bIdx + 1} ${label}] "${hw.name}" kontrol gerekli durumundadır; delik/montaj planı onaylanmalıdır.`
          );
        }
      });
    });
  });

  return {
    passed: incompatibleCount === 0 && visualOnlyCount === 0,
    visualOnlyCount,
    reviewRequiredCount,
    incompatibleCount,
    blockingReasonsTr,
    advisoryNotesTr,
  };
}
