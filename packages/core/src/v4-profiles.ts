import type {
  BackPanelType,
  DesignProject,
  DoorOverlayType,
  DoorSystemId,
  HandleCategory,
  JointType,
  ModuleInstance,
  OpeningTechnology,
  UnitLength,
} from "./types";
import { DEFAULT_MATERIALS } from "./defaults";
import {
  calculateBayWidths,
  calculateNetInnerHeight,
  calculateNetInnerDepth,
  isWardrobeModule,
  roundIntMm,
  roundMm,
} from "./rules";

export type ProfileLayerType =
  | "INTERNATIONAL_REFERENCE"
  | "MANUFACTURER_SPECIFIC"
  | "BIRIM_FACTORY"
  | "PROJECT_OVERRIDE";

export interface ConstructionProfile {
  id: string;
  name: string;
  layerType: ProfileLayerType;
  panelThicknessMm: UnitLength;
  backPanelThicknessMm: UnitLength;
  backPanelType: BackPanelType;
  doorThicknessMm: UnitLength;
  doorPerimeterGapMm: UnitLength;
  centerRevealGapMm: UnitLength;
  defaultOverlayMm: UnitLength;
  plinthHeightMm: UnitLength;
  maxShelfSpanMm: UnitLength;
  wallMountClearanceMm: UnitLength;
  edgeBandThicknessMm: UnitLength;
  system32PitchMm: UnitLength;
  system32FrontSetbackMm: UnitLength;
  jointType: JointType;
  sourceId: string;
}

export const CONSTRUCTION_PROFILES: Record<string, ConstructionProfile> = {
  profile_intl_en1116: {
    id: "profile_intl_en1116",
    name: "EN 1116 / System 32 Uluslararası Referans Profil",
    layerType: "INTERNATIONAL_REFERENCE",
    panelThicknessMm: 16,
    backPanelThicknessMm: 8,
    backPanelType: "grooved",
    doorThicknessMm: 19,
    doorPerimeterGapMm: 2.0,
    centerRevealGapMm: 3.0,
    defaultOverlayMm: 14.0,
    plinthHeightMm: 100,
    maxShelfSpanMm: 850,
    wallMountClearanceMm: 35,
    edgeBandThicknessMm: 1.0,
    system32PitchMm: 32,
    system32FrontSetbackMm: 37,
    jointType: "minifix_dowel",
    sourceId: "SRC_STD_EN1116_2018",
  },
  profile_mfr_blum_std: {
    id: "profile_mfr_blum_std",
    name: "Blum System 32 & E-SERVICES Referans Profili",
    layerType: "MANUFACTURER_SPECIFIC",
    panelThicknessMm: 18,
    backPanelThicknessMm: 8,
    backPanelType: "grooved",
    doorThicknessMm: 18,
    doorPerimeterGapMm: 2.0,
    centerRevealGapMm: 3.0,
    defaultOverlayMm: 16.0,
    plinthHeightMm: 100,
    maxShelfSpanMm: 980,
    wallMountClearanceMm: 35,
    edgeBandThicknessMm: 1.0,
    system32PitchMm: 32,
    system32FrontSetbackMm: 37,
    jointType: "minifix_dowel",
    sourceId: "SRC_BLUM_CAT_HINGE",
  },
  profile_mfr_hettich_std: {
    id: "profile_mfr_hettich_std",
    name: "Hettich Sensys / AvanTech YOU Referans Profili",
    layerType: "MANUFACTURER_SPECIFIC",
    panelThicknessMm: 18,
    backPanelThicknessMm: 8,
    backPanelType: "grooved",
    doorThicknessMm: 19,
    doorPerimeterGapMm: 2.0,
    centerRevealGapMm: 3.0,
    defaultOverlayMm: 16.0,
    plinthHeightMm: 100,
    maxShelfSpanMm: 980,
    wallMountClearanceMm: 35,
    edgeBandThicknessMm: 1.0,
    system32PitchMm: 32,
    system32FrontSetbackMm: 37,
    jointType: "minifix_dowel",
    sourceId: "SRC_HETTICH_SENSYS",
  },
  profile_birim_factory_std: {
    id: "profile_birim_factory_std",
    name: "Birim Fabrika Standart Üretim Profili (18mm Karkas / 8mm Kanal)",
    layerType: "BIRIM_FACTORY",
    panelThicknessMm: 18,
    backPanelThicknessMm: 8,
    backPanelType: "grooved",
    doorThicknessMm: 18,
    doorPerimeterGapMm: 2.0,
    centerRevealGapMm: 3.0,
    defaultOverlayMm: 16.0,
    plinthHeightMm: 80,
    maxShelfSpanMm: 980,
    wallMountClearanceMm: 35,
    edgeBandThicknessMm: 1.0,
    system32PitchMm: 32,
    system32FrontSetbackMm: 37,
    jointType: "minifix_dowel",
    sourceId: "SRC_BIRIM_FACTORY_V3",
  },
};

export interface FourSpaceDimensionsBreakdown {
  externalCarcass: {
    widthMm: UnitLength;
    heightMm: UnitLength;
    depthMm: UnitLength;
    totalDepthWithDoorMm: UnitLength;
  };
  netPanelCut: {
    sidePanelHeightMm: UnitLength;
    sidePanelBottomYMm: UnitLength;
    sidePanelDepthMm: UnitLength;
    horizontalPanelWidthMm: UnitLength;
    horizontalPanelDepthMm: UnitLength;
    backPanelWidthMm: UnitLength;
    backPanelHeightMm: UnitLength;
  };
  usableInternal: {
    netInnerHeightMm: UnitLength;
    netInnerDepthMm: UnitLength;
    bayClearWidthsMm: UnitLength[];
    usableBayClearWidthsAfterPocketMm: UnitLength[];
  };
  doorLeaves: {
    bayIndex: number;
    leafCount: number;
    leafWidthMm: UnitLength;
    leafHeightMm: UnitLength;
    leafThicknessMm: UnitLength;
    leafWeightKg: number;
    powerFactorLf: number;
    recommendedHingesPerLeaf: number;
    effectiveHingeCount: number;
    hingePositionsY: UnitLength[];
    hingeBottomOffsetMm: UnitLength;
    hingeTopOffsetMm: UnitLength;
    overlayType: DoorOverlayType;
    hingeCrankType: "straight_full_overlay" | "half_cranked_middle" | "full_cranked_inset";
    doorX0Mm: UnitLength;
    doorY0Mm: UnitLength;
    doorZ0Mm: UnitLength;
    fullDoorSpanWidthMm: UnitLength;
    baseDoorHeightMm: UnitLength;
    centerRevealGapMm: UnitLength;
  }[];
}

export function calculateRecommendedHingesPerLeaf(
  leafHeightMm: UnitLength,
  leafWeightKg = 0,
  isNonHinged = false
): number {
  if (isNonHinged || leafHeightMm <= 120) return 0;
  if (leafHeightMm > 2200 || leafWeightKg > 18) return 5;
  if (leafHeightMm > 1600 || leafWeightKg > 13) return 4;
  if (leafHeightMm > 1000 || leafWeightKg > 9) return 3;
  return 2;
}

export function calculateDoorHingePositionsY(
  leafHeightMm: UnitLength,
  options?: {
    hingeCount?: number;
    bottomOffsetMm?: UnitLength;
    topOffsetMm?: UnitLength;
    leafWeightKg?: number;
    shelfElevationsMm?: UnitLength[];
  }
): UnitLength[] {
  if (leafHeightMm <= 120) return [];
  const bottomOff = Math.max(50, Math.min(400, roundIntMm(options?.bottomOffsetMm ?? 100)));
  const topOff = Math.max(50, Math.min(400, roundIntMm(options?.topOffsetMm ?? 100)));
  const weightKg = options?.leafWeightKg ?? 0;

  const autoCount = calculateRecommendedHingesPerLeaf(leafHeightMm, weightKg, false);

  const rawOverride = options?.hingeCount;
  const normalizedOverride =
    rawOverride && leafHeightMm <= 900 && rawOverride >= 4
      ? 2
      : rawOverride && rawOverride >= 6
      ? 4
      : rawOverride;
  const count = Math.max(2, Math.min(5, normalizedOverride || autoCount));
  const yStart = Math.min(bottomOff, Math.floor(leafHeightMm * 0.35));
  const yEnd = Math.max(
    yStart + 80,
    leafHeightMm - Math.min(topOff, Math.floor(leafHeightMm * 0.35))
  );

  if (count <= 2) return [yStart, yEnd];

  const step = (yEnd - yStart) / (count - 1);
  const shelves = options?.shelfElevationsMm || [];

  return Array.from({ length: count }, (_, idx) => {
    if (idx === 0) return yStart;
    if (idx === count - 1) return yEnd;
    let hy = roundIntMm(yStart + idx * step);
    for (const sy of shelves) {
      if (Math.abs(hy - sy) < 30) {
        hy = hy >= sy ? sy + 42 : Math.max(yStart + 64, sy - 42);
      }
    }
    return hy;
  });
}

export function resolveEffectiveConstructionProfile(module: ModuleInstance): ConstructionProfile {
  const baseProfile =
    CONSTRUCTION_PROFILES[module.carcass.constructionProfileId || "profile_birim_factory_std"] ||
    CONSTRUCTION_PROFILES.profile_birim_factory_std;

  return {
    ...baseProfile,
    panelThicknessMm: module.carcass.panelThickness || baseProfile.panelThicknessMm,
    backPanelThicknessMm: module.carcass.backPanelThickness ?? baseProfile.backPanelThicknessMm,
    backPanelType: module.carcass.backPanelType || baseProfile.backPanelType,
    doorThicknessMm: module.carcass.doorThickness || baseProfile.doorThicknessMm,
    doorPerimeterGapMm: module.carcass.doorPerimeterGap ?? baseProfile.doorPerimeterGapMm,
    centerRevealGapMm: module.carcass.centerRevealGapMm ?? baseProfile.centerRevealGapMm,
    plinthHeightMm: module.carcass.plinthHeight ?? baseProfile.plinthHeightMm,
    edgeBandThicknessMm: module.carcass.edgeBandThickness ?? baseProfile.edgeBandThicknessMm,
    system32FrontSetbackMm:
      module.carcass.system32FrontSetback || baseProfile.system32FrontSetbackMm,
    jointType: module.carcass.jointType || baseProfile.jointType,
  };
}

import { BoundedLruCache, computeModuleStructuralSignature } from "./lru-cache";
const fourSpaceLruCache = new BoundedLruCache<string, FourSpaceDimensionsBreakdown>(512);

export function calculateFourSpaceDimensions(
  module: ModuleInstance,
  customMaterials?: import("./types").MaterialDefinition[]
): FourSpaceDimensionsBreakdown {
  const cmSig = customMaterials?.length
    ? customMaterials.map((m) => `${m.id}:${m.thickness}:${m.category}:${m.densityKgPerM3 || 0}`).join(",")
    : "";
  const cacheKey = `${computeModuleStructuralSignature(module)}|DM:${DEFAULT_MATERIALS.length}|CM:${cmSig}`;
  const cached = fourSpaceLruCache.get(cacheKey);
  if (cached) return cached;
  const computed = calculateFourSpaceDimensionsUncached(module, customMaterials);
  fourSpaceLruCache.set(cacheKey, computed);
  return computed;
}

function calculateFourSpaceDimensionsUncached(
  module: ModuleInstance,
  customMaterials?: import("./types").MaterialDefinition[]
): FourSpaceDimensionsBreakdown {
  const profile = resolveEffectiveConstructionProfile(module);
  const { width, height, depth } = module.dimensions;
  const T = profile.panelThicknessMm;
  const T_top = module.carcass.topPanelThicknessMm || T;
  const hasCustomTopThick = T_top !== T;
  const T_door = profile.doorThicknessMm;
  const plinth = profile.plinthHeightMm;
  const gap = profile.doorPerimeterGapMm;
  const centerGap = profile.centerRevealGapMm;

  const isWardrobe = isWardrobeModule(module);
  const effPlinthConstruction =
    module.carcass.plinthConstruction ||
    (module.carcass.hasAdjustableLegs === false
      ? isWardrobe
        ? "gable_rails"
        : "pedestal_box"
      : isWardrobe
      ? "pedestal_box"
      : "adjustable_legs_clip");
  const joinery = module.carcass.carcassJoineryTopology || "sides_through";
  const sideRunsToFloor = plinth > 0 && effPlinthConstruction === "gable_rails";
  const carcassBoxHeightMm = Math.max(0, roundIntMm(height - plinth - (hasCustomTopThick ? T_top : 0)));
  const sidePanelHeightMm = hasCustomTopThick
    ? Math.max(0, roundIntMm((sideRunsToFloor ? height : height - plinth) - T_top))
    : sideRunsToFloor
    ? Math.max(0, roundIntMm(joinery === "top_bottom_through" ? height - T : height))
    : joinery === "top_bottom_through"
    ? Math.max(0, carcassBoxHeightMm - 2 * T)
    : carcassBoxHeightMm;
  const sidePanelBottomYMm = sideRunsToFloor
    ? 0
    : joinery === "top_bottom_through" && !hasCustomTopThick
    ? roundIntMm(plinth + T)
    : roundIntMm(plinth);
  const horizontalPanelWidthMm =
    hasCustomTopThick || joinery === "top_bottom_through" || joinery === "miter_45"
      ? roundIntMm(width)
      : Math.max(0, roundIntMm(width - 2 * T));

  const netInnerHeightMm = calculateNetInnerHeight(module);
  const baseInnerDepthMm = calculateNetInnerDepth(module);
  const bayClearWidthsMm = calculateBayWidths(module);
  const usableBayClearWidthsAfterPocketMm = bayClearWidthsMm.map((bw, idx) => {
    const b = module.bays[idx];
    const isPocket = b?.door?.doorSystemId === "pocket_retractable" || b?.door?.type === "pocket";
    return isPocket ? Math.max(80, bw - 75) : bw;
  });

  const hasSliding = module.bays.some(
    (b) =>
      b.door.type === "sliding" ||
      b.door.doorSystemId === "sliding_top_hung" ||
      b.door.doorSystemId === "sliding_bottom_rolling"
  );
  const hasInset = module.bays.some(
    (b) =>
      b.door.overlayType === "inset" ||
      b.door.doorSystemId === "hinged_inset" ||
      b.door.type.startsWith("inset")
  );

  const usableInnerDepthMm = Math.max(
    0,
    roundIntMm(baseInnerDepthMm - (hasSliding ? 80 : 0) - (hasInset ? T_door + 2 : 0))
  );

  // Back panel cutting formula per MD Spec Section 3.2:
  // Grooved: W_back = (W_ext - 2*T) + 2*(d_groove - eps), d_groove = 9mm, eps = 1mm -> +16mm!
  const innerHorizW = Math.max(0, roundIntMm(width - 2 * T));
  let backPanelWidthMm = innerHorizW + 16;
  let backPanelHeightMm = netInnerHeightMm + 16;
  if (profile.backPanelType === "none") {
    backPanelWidthMm = 0;
    backPanelHeightMm = 0;
  } else if (profile.backPanelType === "rebated") {
    backPanelWidthMm = innerHorizW + 20;
    backPanelHeightMm = netInnerHeightMm + 20;
  } else if (profile.backPanelType === "flush") {
    backPanelWidthMm = innerHorizW;
    backPanelHeightMm = netInnerHeightMm;
  } else if (profile.backPanelType === "nailed") {
    backPanelWidthMm = Math.max(0, roundIntMm(width - 2));
    backPanelHeightMm = Math.max(0, roundIntMm(carcassBoxHeightMm - 2));
  }

  const totalExtraDepthForNailed =
    profile.backPanelType === "nailed" ? profile.backPanelThicknessMm : 0;

  let currentBayStartX = T;
  const doorLeaves = module.bays.map((bay, bayIdx) => {
    const bayW = bayClearWidthsMm[bayIdx] || 0;
    const bayStartX = currentBayStartX;
    currentBayStartX = roundMm(currentBayStartX + bayW + T);

    const bayDoorMatId = bay.door.doorMaterialId || module.carcass.doorMaterialId;
    const doorMat =
      (customMaterials || []).find((m) => m.id === bayDoorMatId) ||
      DEFAULT_MATERIALS.find((m) => m.id === bayDoorMatId) ||
      DEFAULT_MATERIALS[2];
    const densityKgM3 = doorMat.densityKgPerM3 || 750;

    const dType = bay.door.type;
    const dSys = bay.door.doorSystemId || inferDoorSystemIdFromType(dType);
    const overlayType: DoorOverlayType =
      bay.door.overlayType ||
      (dSys === "hinged_inset" || dType.startsWith("inset")
        ? "inset"
        : dSys === "hinged_overlay_variant" || dType.startsWith("half_overlay")
        ? "half_overlay"
        : "full_overlay");

    const isRightHinged =
      dType === "single_right" || dType === "inset_right" || dType === "half_overlay_right";
    const isSingleDoorLeaf =
      dType === "single_left" ||
      dType === "single_right" ||
      dType === "inset_left" ||
      dType === "inset_right" ||
      dType === "half_overlay_left" ||
      dType === "half_overlay_right" ||
      dSys === "hinged_single";
    const isVertGolaBay = bay.door.handleProfileId === "hnd_gola_vertical";
    const isDouble =
      dType === "double" ||
      dType === "inset_double" ||
      dSys === "hinged_double" ||
      dSys === "folding_side" ||
      dType === "folding";
    const effCenterGapMm = isVertGolaBay && isDouble ? 30 : centerGap;

    // Exact Half-Overlay formula on shared 18mm middle divider: b_half = (T - g_gap) / 2 (MD Spec Section 6.1.3!)
    const halfOverlayMm = roundMm((T - centerGap) / 2, 2);
    const baseLeftOverlay =
      overlayType === "inset"
        ? -gap
        : overlayType === "half_overlay"
        ? halfOverlayMm
        : bayIdx === 0
        ? T - gap
        : halfOverlayMm;
    const baseRightOverlay =
      overlayType === "inset"
        ? -gap
        : overlayType === "half_overlay"
        ? halfOverlayMm
        : bayIdx === module.bays.length - 1
        ? T - gap
        : halfOverlayMm;

    // Vertical Gola 1020 Opening-Edge Finger Clearance (30mm gap!):
    // - On single right-hinged door, left edge is the opening edge: pull back to -6mm on shared divider (18 + 6 + 6 = 30mm!) or -12mm on outer side!
    // - On single left-hinged door, right edge is the opening edge: pull back to -6mm on shared divider or -12mm on outer side!
    const leftOverlay =
      isVertGolaBay && isSingleDoorLeaf && isRightHinged
        ? bayIdx > 0
          ? -6
          : -12
        : baseLeftOverlay;
    const rightOverlay =
      isVertGolaBay && isSingleDoorLeaf && !isRightHinged
        ? bayIdx < module.bays.length - 1
          ? -6
          : -12
        : baseRightOverlay;
    const hingesOnSharedMiddleDivider =
      overlayType === "half_overlay" ||
      (!isRightHinged && bayIdx > 0) ||
      (isRightHinged && bayIdx < module.bays.length - 1);
    const hingeCrankType: "straight_full_overlay" | "half_cranked_middle" | "full_cranked_inset" =
      overlayType === "inset"
        ? "full_cranked_inset"
        : hingesOnSharedMiddleDivider
        ? "half_cranked_middle"
        : "straight_full_overlay";

    const tplId = (module.templateId || "").toLowerCase();
    const extDrawers = bay.drawers.filter((d) => !d.isInternal);
    const bottomExtDrawers = extDrawers.filter((d) => d.elevationY < netInnerHeightMm * 0.55);
    const topExtDrawers = extDrawers.filter((d) => d.elevationY >= netInnerHeightMm * 0.55);

    const bottomDrawersSpan =
      bottomExtDrawers.length > 0
        ? Math.max(...bottomExtDrawers.map((d) => d.elevationY + d.height)) + T
        : 0;

    let openCavityBottomCut = bottomDrawersSpan;
    if (tplId.includes("oven_microwave_tower")) {
      openCavityBottomCut = Math.max(bottomDrawersSpan, 380) + 600 + 380 + 2 * T;
    } else if (tplId.includes("oven_tower")) {
      openCavityBottomCut = Math.max(bottomDrawersSpan, 380) + 600 + T;
    } else if (tplId.includes("niche_tall")) {
      openCavityBottomCut = Math.max(bottomDrawersSpan, 400) + 550 + T;
    } else if (tplId.includes("microwave_wall")) {
      openCavityBottomCut = Math.max(bottomDrawersSpan, 360);
    } else if (tplId.includes("fridge_surround")) {
      openCavityBottomCut = Math.max(bottomDrawersSpan, 1720);
    }

    const applyPartialDoorCut =
      !dSys.startsWith("sliding") && dSys !== "pocket_retractable" && dSys !== "tambour_roller";
    const userBottomOpenMm = Math.max(0, bay.door.doorBottomGapMm || 0);
    const userTopOpenMm = Math.max(0, bay.door.doorTopGapMm || 0);
    const bottomCutMm = (applyPartialDoorCut ? openCavityBottomCut : 0) + userBottomOpenMm;
    const topCutMm =
      (applyPartialDoorCut && topExtDrawers.length > 0
        ? Math.max(
            0,
            netInnerHeightMm - Math.min(...topExtDrawers.map((d) => d.elevationY)) + T
          )
        : 0) + userTopOpenMm;

    const bottomOverhang = bay.door.bottomOverhangMm ?? 0; // e.g. +15mm handleless wall cabinet drop
    const isVerticalGola = bay.door.handleProfileId === "hnd_gola_vertical";
    const isWallGolaOverhang =
      module.category === "kitchen_wall" &&
      bay.door.handleCategory === "gola_profile" &&
      !isVerticalGola;
    const effBottomOverhang = isWallGolaOverhang ? Math.max(bottomOverhang, 18) : bottomOverhang;
    const rawDoorY0Mm =
      (overlayType === "inset" ? plinth + T + gap : plinth + gap) - effBottomOverhang;
    const klapaLeftMm = Math.max(0, bay.door.frontFillerLeftMm || 0);
    const klapaRightMm = Math.max(0, bay.door.frontFillerRightMm || 0);
    const klapaLeftGap = klapaLeftMm > 0 ? gap : 0;
    const klapaRightGap = klapaRightMm > 0 ? gap : 0;
    const doorX0Mm = roundMm(
      (overlayType === "inset" ? bayStartX + gap : bayStartX - leftOverlay) + klapaLeftMm + klapaLeftGap
    );
    const doorY0Mm = roundMm(rawDoorY0Mm + bottomCutMm);
    const doorZ0Mm = roundMm(overlayType === "inset" ? depth - T : depth);
    const totalDoorSpanW = Math.max(
      80,
      roundMm(bayW + leftOverlay + rightOverlay - klapaLeftMm - klapaRightMm - klapaLeftGap - klapaRightGap)
    );

    if (module.isOpenFront || dType === "open" || dSys === "open") {
      return {
        bayIndex: bayIdx,
        leafCount: 0,
        leafWidthMm: 0,
        leafHeightMm: 0,
        leafThicknessMm: T_door,
        leafWeightKg: 0,
        powerFactorLf: 0,
        recommendedHingesPerLeaf: 0,
        effectiveHingeCount: 0,
        hingePositionsY: [],
        hingeBottomOffsetMm: bay.door.hingeBottomOffsetMm ?? 100,
        hingeTopOffsetMm: bay.door.hingeTopOffsetMm ?? 100,
        overlayType,
        hingeCrankType,
        doorX0Mm,
        doorY0Mm,
        doorZ0Mm,
        fullDoorSpanWidthMm: totalDoorSpanW,
        baseDoorHeightMm: 0,
        centerRevealGapMm: effCenterGapMm,
      };
    }

    const isHingedOrFold =
      !dSys.startsWith("sliding") &&
      !dSys.startsWith("lift_") &&
      dSys !== "pocket_retractable" &&
      dSys !== "tambour_roller";
    const isBiFoldLift = dType === "lift_bi_fold" || dSys === "lift_bi_fold";
    const leafCount = isDouble || isBiFoldLift ? 2 : 1;
    const rawLeafWidthMm =
      dSys === "folding_side" || dType === "folding"
        ? Math.max(0, roundIntMm((totalDoorSpanW - gap) / 2))
        : isDouble
        ? Math.max(0, roundIntMm((totalDoorSpanW - effCenterGapMm) / 2))
        : roundIntMm(totalDoorSpanW);
    // P1-01 Engineering Fix: Never silently clamp regular cabinet leafWidthMm; for Blind Corner & 45° Diagonal Corner,
    // use the actual hinged access opening width rather than full L/blind carcass span!
    const nameLowerForCorner = (module.name || "").toLowerCase();
    const isBlindCornerMod =
      module.bays.length === 1 &&
      (tplId.includes("blind") || nameLowerForCorner.includes("kör köşe"));
    const isDiagCornerMod =
      module.bays.length === 1 &&
      (tplId.includes("diagonal") || nameLowerForCorner.includes("diyagonal"));
    const blindAccessSpanMm = isBlindCornerMod
      ? Math.max(400, roundIntMm(width - Math.max(120, Math.round((width - 2 * T) * 0.45)) - 2 * gap))
      : rawLeafWidthMm;
    const minCornerArmMm = Math.min(width, depth);
    const diagWingDMm =
      module.category === "kitchen_wall" || module.moduleFamilyId === "fam_kitchen_wall"
        ? minCornerArmMm >= 580
          ? 350
          : Math.min(350, Math.round(minCornerArmMm * 0.56))
        : isWardrobe
        ? minCornerArmMm >= 920
          ? 600
          : Math.min(600, Math.round(minCornerArmMm * 0.58))
        : minCornerArmMm >= 780
        ? 580
        : Math.min(580, Math.round(minCornerArmMm * 0.64));
    const isTrueLCornerMod =
      module.bays.length === 1 &&
      Boolean(module.isCorner) &&
      !isBlindCornerMod &&
      !isDiagCornerMod &&
      !tplId.includes("outer_corner");
    const lCornerWingLeafMm = isTrueLCornerMod
      ? Math.max(180, roundIntMm(width - diagWingDMm - T_door - 2 * gap))
      : rawLeafWidthMm;
    const diagBevelSpanMm = isDiagCornerMod
      ? Math.max(320, roundIntMm(Math.hypot(Math.max(120, width - diagWingDMm), Math.max(120, depth - diagWingDMm)) - 2 * gap))
      : rawLeafWidthMm;
    const leafWidthMm = isBlindCornerMod
      ? Math.min(rawLeafWidthMm, blindAccessSpanMm)
      : isDiagCornerMod
      ? Math.min(rawLeafWidthMm, diagBevelSpanMm)
      : isTrueLCornerMod
      ? lCornerWingLeafMm
      : rawLeafWidthMm;

    // Horizontal Top Gola finger clearance deduction (28mm + 2mm gap = exact 30mm on base cabinets <= 1200mm;
    // 0mm on wall cabinets, vertical Gola, tall doors >= 1200mm, or partial lower doors under top drawers!)
    const isAutoTallVerticalDoor =
      bay.door.handleOrientation !== "horizontal" &&
      (module.category === "kitchen_tall" ||
        module.category === "wardrobe" ||
        module.category === "wardrobe_walkin" ||
        module.category === "wardrobe_corner" ||
        module.category === "special_corner" ||
        carcassBoxHeightMm - bottomCutMm - topCutMm >= 1200 ||
        (module.position?.y || 0) + height > 1250);
    const golaDeduction =
      bay.door.handleCategory === "gola_profile" &&
      module.category !== "kitchen_wall" &&
      !isVerticalGola &&
      !isAutoTallVerticalDoor &&
      topCutMm <= 0
        ? 28
        : 0;
    const rawBaseDoorHeight =
      overlayType === "inset"
        ? Math.max(80, netInnerHeightMm - 2 * gap - golaDeduction + effBottomOverhang)
        : Math.max(80, carcassBoxHeightMm - 2 * gap - golaDeduction + effBottomOverhang);
    const baseDoorHeight = Math.max(80, roundIntMm(rawBaseDoorHeight - bottomCutMm - topCutMm));

    const leafHeightMm = isBiFoldLift
      ? roundIntMm((baseDoorHeight - gap) / 2)
      : roundIntMm(baseDoorHeight);

    const leafThicknessMm = bay.door.doorThicknessMm || T_door;
    const hCatWeight = bay.door.handleCategory;
    const isIntegratedHandleless =
      hCatWeight === "handleless_plain" ||
      hCatWeight === "j_pull" ||
      hCatWeight === "gola_profile" ||
      hCatWeight === "milled_wood_grip" ||
      bay.door.crossSectionProfile === "j_pull_bevel" ||
      bay.door.crossSectionProfile === "bevel_45" ||
      bay.door.handleType === "none";
    const handleWeightKg = isIntegratedHandleless ? 0 : 0.18;

    const leafAreaM2 = (leafWidthMm * leafHeightMm) / 1_000_000;
    const activeDoorProf =
      bay.door.crossSectionProfile || module.carcass.crossSectionProfile || "flat_slab";
    // P1-03: 4mm silver mirror bonded onto carrier panel adds 0.004m * 2500 kg/m³ = 10.0 kg/m²!
    const mirrorExtraKg = activeDoorProf === "mirror_door" ? leafAreaM2 * 10.0 : 0;
    const singleLeafBoardKg =
      activeDoorProf === "glass_frame"
        ? ((2 * (leafWidthMm + leafHeightMm)) / 1000) * 0.95 +
          Math.max(0, ((leafWidthMm - 90) * (leafHeightMm - 90)) / 1_000_000) * 10.0
        : ((leafWidthMm * leafHeightMm * leafThicknessMm) / 1_000_000_000) * densityKgM3 +
          mirrorExtraKg;
    const leafWeightKg = roundMm(singleLeafBoardKg + handleWeightKg, 2);

    const totalLiftPanelBoardKg = singleLeafBoardKg * leafCount;
    const powerFactorLf = roundIntMm(
      baseDoorHeight * (totalLiftPanelBoardKg + 2 * handleWeightKg)
    );

    const isNonHinged =
      dSys.startsWith("sliding") ||
      dSys.startsWith("lift") ||
      dSys === "pocket_retractable" ||
      dSys === "tambour_roller";
    const recommendedHingesPerLeaf = calculateRecommendedHingesPerLeaf(
      leafHeightMm,
      leafWeightKg,
      isNonHinged
    );

    const hingeBottomOffsetMm = bay.door.hingeBottomOffsetMm ?? 100;
    const hingeTopOffsetMm = bay.door.hingeTopOffsetMm ?? 100;
    const shelfRelativeY = bay.shelves.map((s) => Math.max(0, s.elevationY + T - bottomCutMm));
    const hingePositionsY = isNonHinged
      ? []
      : calculateDoorHingePositionsY(leafHeightMm, {
          hingeCount: bay.door.hingeCount,
          bottomOffsetMm: hingeBottomOffsetMm,
          topOffsetMm: hingeTopOffsetMm,
          leafWeightKg,
          shelfElevationsMm: shelfRelativeY,
        });
    const effectiveHingeCount = hingePositionsY.length;

    return {
      bayIndex: bayIdx,
      leafCount,
      leafWidthMm,
      leafHeightMm,
      leafThicknessMm,
      leafWeightKg,
      powerFactorLf,
      recommendedHingesPerLeaf,
      effectiveHingeCount,
      hingePositionsY,
      hingeBottomOffsetMm,
      hingeTopOffsetMm,
      overlayType,
      hingeCrankType,
      doorX0Mm,
      doorY0Mm,
      doorZ0Mm,
      fullDoorSpanWidthMm: totalDoorSpanW,
      baseDoorHeightMm: baseDoorHeight,
      centerRevealGapMm: centerGap,
    };
  });

  return {
    externalCarcass: {
      widthMm: width,
      heightMm: height,
      depthMm: depth + totalExtraDepthForNailed,
      totalDepthWithDoorMm:
        module.isOpenFront
          ? depth + totalExtraDepthForNailed
          : depth + totalExtraDepthForNailed + T_door + 2,
    },
    netPanelCut: {
      sidePanelHeightMm,
      sidePanelBottomYMm,
      sidePanelDepthMm: depth,
      horizontalPanelWidthMm,
      horizontalPanelDepthMm: depth,
      backPanelWidthMm,
      backPanelHeightMm,
    },
    usableInternal: {
      netInnerHeightMm,
      netInnerDepthMm: usableInnerDepthMm,
      bayClearWidthsMm,
      usableBayClearWidthsAfterPocketMm,
    },
    doorLeaves,
  };
}

export function inferDoorSystemIdFromType(type: string): DoorSystemId {
  switch (type) {
    case "single_left":
    case "single_right":
    case "left":
    case "right":
      return "hinged_single";
    case "double":
      return "hinged_double";
    case "inset_left":
    case "inset_right":
    case "inset_double":
      return "hinged_inset";
    case "half_overlay_left":
    case "half_overlay_right":
      return "hinged_overlay_variant";
    case "sliding":
      return "sliding_top_hung";
    case "sliding_bottom":
      return "sliding_bottom_rolling";
    case "lift_parallel":
      return "lift_parallel";
    case "lift_bi_fold":
      return "lift_bi_fold";
    case "lift":
    case "lift_up_stay":
      return "lift_up_stay";
    case "folding":
      return "folding_side";
    case "pocket":
      return "pocket_retractable";
    case "tambour":
      return "tambour_roller";
    default:
      return "open";
  }
}

export function migrateV3ProjectToV4(project: DesignProject): DesignProject {
  const catalogVersion = project.catalogVersion || project.libraryVersionId || "lib_v4_0_0";
  return {
    ...project,
    schemaVersion: 4,
    catalogVersion,
    libraryVersionId: project.libraryVersionId || catalogVersion,
    revisionId: project.revisionId || `rev_v${project.version || 1}`,
    constructionProfileId: project.constructionProfileId || "profile_birim_factory_std",
    modules: project.modules.map((mod) => {
      const moduleFamilyId =
        mod.moduleFamilyId ||
        (mod.category === "kitchen_base" || mod.category === "kitchen_island"
          ? "fam_kitchen_base"
          : mod.category === "kitchen_wall"
          ? "fam_kitchen_wall"
          : mod.category === "kitchen_tall"
          ? "fam_kitchen_tall"
          : mod.category === "kitchen_corner" ||
            mod.category === "wardrobe_corner" ||
            mod.category === "special_corner"
          ? "fam_special_corner"
          : mod.category === "complementary"
          ? "fam_complementary"
          : "fam_wardrobe");

      const hasLedFitting = mod.bays.some((b) =>
        (b.specialFittings || []).some((f) => f.type.startsWith("led_"))
      );

      return {
        ...mod,
        moduleFamilyId,
        carcass: {
          ...mod.carcass,
          constructionProfileId:
            mod.carcass.constructionProfileId || "profile_birim_factory_std",
          doorThickness: mod.carcass.doorThickness || 18,
          system32FrontSetback: mod.carcass.system32FrontSetback || 37,
          ledLightingEnabled: mod.carcass.ledLightingEnabled ?? hasLedFitting,
        },
        bays: mod.bays.map((bay) => {
          const doorSystemId =
            bay.door.doorSystemId || inferDoorSystemIdFromType(bay.door.type);
          const overlayType: DoorOverlayType =
            bay.door.overlayType ||
            (doorSystemId === "hinged_inset"
              ? "inset"
              : doorSystemId === "hinged_overlay_variant"
              ? "half_overlay"
              : "full_overlay");
          const handleCategory: HandleCategory =
            bay.door.handleCategory ||
            (bay.door.handleType === "push_to_open" || bay.door.handleType === "none"
              ? "handleless_plain"
              : bay.door.handleType === "integrated_profile"
              ? "gola_profile"
              : "bar_handle");
          const openingTechnology: OpeningTechnology =
            bay.door.openingTechnology ||
            (bay.door.handleType === "push_to_open"
              ? "push_to_open"
              : bay.door.softClose
              ? "soft_close"
              : "manual_standard");

          return {
            ...bay,
            door: {
              ...bay.door,
              doorSystemId,
              overlayType,
              handleCategory,
              openingTechnology,
            },
          };
        }),
      };
    }),
  };
}


export interface ResolvedDrawerCuttingFormula {
  bottomWidthDeductionMm: number;
  backWidthDeductionMm: number;
  lengthDeductionMm: number;
  sideClearancePerSideMm: number;
  requiresBottomGroove: boolean;
  sourceId: string;
  isVerifiedCatalogFormula: boolean;
}

/**
 * Resolves manufacturer-verified wooden cutting deductions for drawer bottoms, backs, and box lengths
 * directly by SKU / hardwareProductId (`Blum LEGRABOX`, `Blum TANDEMBOX`, `Blum MOVENTO 760H`, `Hettich AvanTech YOU`).
 * Never invents verified status when an unknown custom SKU is supplied (Section 7).
 */
export function resolveCanonicalDrawerCuttingFormula(
  hardwareProductId?: string,
  boxSystemType?: string
): ResolvedDrawerCuttingFormula {
  const hw = (hardwareProductId || "").toLowerCase();
  const sys = boxSystemType || "";

  if (hw === "hw_blum_tandembox_m" || hw.includes("tandembox") || (!hw && sys === "metal_box_tandembox")) {
    return {
      bottomWidthDeductionMm: 75,
      backWidthDeductionMm: 87,
      lengthDeductionMm: 24,
      sideClearancePerSideMm: 21.5,
      requiresBottomGroove: false,
      sourceId: "SRC_BLUM_TANDEMBOX",
      isVerifiedCatalogFormula: !hw || hw === "hw_blum_tandembox_m" || hw.startsWith("hw_blum_"),
    };
  }
  if (hw === "hw_blum_legrabox_m" || hw.includes("legrabox") || (!hw && sys === "metal_box_legrabox")) {
    return {
      bottomWidthDeductionMm: 38,
      backWidthDeductionMm: 38,
      lengthDeductionMm: 10,
      sideClearancePerSideMm: 19,
      requiresBottomGroove: false,
      sourceId: "SRC_BLUM_LEGRABOX",
      isVerifiedCatalogFormula: !hw || hw === "hw_blum_legrabox_m" || hw.startsWith("hw_blum_"),
    };
  }
  if (hw === "hw_hettich_avantech_m" || hw.includes("avantech") || (!hw && sys === "metal_box_avantech")) {
    return {
      bottomWidthDeductionMm: 24,
      backWidthDeductionMm: 24,
      lengthDeductionMm: 21,
      sideClearancePerSideMm: 12,
      requiresBottomGroove: false,
      sourceId: "SRC_HETTICH_AVANTECH",
      isVerifiedCatalogFormula: !hw || hw === "hw_hettich_avantech_m" || hw.startsWith("hw_hettich_"),
    };
  }
  if (sys === "ball_bearing_side" || hw.includes("ball_bearing")) {
    return {
      bottomWidthDeductionMm: 46,
      backWidthDeductionMm: 58,
      lengthDeductionMm: 10,
      sideClearancePerSideMm: 13,
      requiresBottomGroove: true,
      sourceId: "SRC_HAFELE_BALL_RUNNER",
      isVerifiedCatalogFormula: !hw || hw.startsWith("hw_hafele_"),
    };
  }
  if (
    !hw ||
    hw === "hw_blum_movento_760h" ||
    hw === "hw_blum_tandem_560h" ||
    hw.includes("movento") ||
    hw.includes("tandem_560")
  ) {
    // Blum MOVENTO 760H / TANDEM: SKW = LW - 42mm; 8mm grooved bottom slots 2x6mm into 16mm wooden sides -> LW - 30mm!
    return {
      bottomWidthDeductionMm: 30,
      backWidthDeductionMm: 42,
      lengthDeductionMm: 10,
      sideClearancePerSideMm: 21,
      requiresBottomGroove: true,
      sourceId: "SRC_BLUM_MOVENTO",
      isVerifiedCatalogFormula: true,
    };
  }

  // Unknown / custom user-supplied hardwareProductId without manufacturer cutting specification!
  return {
    bottomWidthDeductionMm: 30,
    backWidthDeductionMm: 42,
    lengthDeductionMm: 10,
    sideClearancePerSideMm: 21,
    requiresBottomGroove: true,
    sourceId: "UNVERIFIED_CUSTOM_HARDWARE",
    isVerifiedCatalogFormula: false,
  };
}


export interface CanonicalHandlePlacementInput {
  partRole: string;
  partId?: string;
  partLabel?: string;
  /** Horizontal width of front in 3D view (mm) */
  frontWidthMm: number;
  /** Vertical height of front in 3D view (mm) */
  frontHeightMm: number;
  /** Bottom elevation Y of front relative to module base (mm) */
  frontElevationYMm?: number;
  moduleCategory?: import("./types").ModuleCategory;
  moduleElevationYMm?: number;
  handleCategory?: import("./types").HandleCategory;
  openingTechnology?: string;
  crossSectionProfile?: string;
  spacingCcMm?: number;
  handleOrientation?: "auto" | "vertical" | "horizontal";
  handleOffsetY?: number;
  handleEdgeInsetX?: number;
}

export interface CanonicalHandlePlacementResult {
  hasVisualHandle: boolean;
  isDrilledThrough: boolean;
  orientation: "horizontal" | "vertical";
  /** X from left edge of 3D front (0 .. frontWidthMm) */
  centerXMm: number;
  /** Y from bottom edge of 3D front (0 .. frontHeightMm) */
  centerYMm: number;
  /** Exact manufacturer screw pitch (1 = single M4 knob bore, >=32 = two M4 bores) */
  spacingCcMm: number;
  exceedsPanelSpan: boolean;
  minRequiredSpanMm: number;
}

/**
 * Tekil Doğrulanmış Kulp Yerleşim ve CNC Delik Hesabı (P0-02 & P1-01):
 * 3B sahne (`handle-geometry.ts`), BOM, `drilling-engine.ts` ve `engineering-validation-engine.ts`
 * aynı koordinatı kullanır; AVENTOS HF üst kanada asla delik açmaz ve C-C ölçüsünü sessizce kırpmaz!
 */
export function resolveCanonicalHandlePlacement(
  input: CanonicalHandlePlacementInput
): CanonicalHandlePlacementResult {
  const idStr = input.partId || "";
  const lblStr = input.partLabel || "";
  const isBifoldUpperLeaf =
    idStr.includes("_lift_bifold_top") ||
    lblStr.includes("Katlanır Kalkar Üst Kanat") ||
    lblStr.includes("AVENTOS HF Üst");

  const cat = input.handleCategory || "bar_handle";
  const prof = input.crossSectionProfile || "flat_slab";
  const opTech = input.openingTechnology || "soft_close";

  if (isBifoldUpperLeaf || cat === "handleless_plain") {
    return {
      hasVisualHandle: false,
      isDrilledThrough: false,
      orientation: "horizontal",
      centerXMm: roundMm(input.frontWidthMm / 2, 2),
      centerYMm: roundMm(input.frontHeightMm / 2, 2),
      spacingCcMm: 0,
      exceedsPanelSpan: false,
      minRequiredSpanMm: 0,
    };
  }

  const isDrilledCategory =
    (cat === "bar_handle" ||
      cat === "knob" ||
      cat === "long_profile_handle" ||
      cat === "decorative_bespoke") &&
    prof !== "j_pull_bevel" &&
    prof !== "bevel_45" &&
    opTech !== "push_to_open" &&
    opTech !== "servo_electric" &&
    !idStr.includes("_sliding_rear");

  const isDrawer = input.partRole === "drawer_front";
  const isLiftLeaf =
    idStr.includes("lift_") ||
    lblStr.includes("Kalkar") ||
    idStr.includes("_dsh_door");

  const frontElevY = input.frontElevationYMm ?? 0;
  const isWallOrHighFront =
    !isDrawer &&
    (input.moduleCategory === "kitchen_wall" ||
      (input.moduleElevationYMm ?? 0) >= 1100 ||
      frontElevY >= 1100);
  const isTallOrWardrobeFront =
    !isDrawer &&
    !isWallOrHighFront &&
    (input.moduleCategory === "wardrobe" ||
      input.moduleCategory === "wardrobe_walkin" ||
      input.moduleCategory === "wardrobe_corner" ||
      input.moduleCategory === "kitchen_tall" ||
      input.moduleCategory === "special_corner" ||
      input.frontHeightMm >= 1200);

  const isTopBottomEdgeProfile =
    cat === "edge_profile" || cat === "j_pull" || cat === "gola_profile";
  const autoHorizontal =
    isDrawer || isLiftLeaf || (isTopBottomEdgeProfile && !isTallOrWardrobeFront);

  const horizontal =
    !isDrawer && input.handleOrientation === "horizontal"
      ? true
      : !isDrawer && input.handleOrientation === "vertical" && !isLiftLeaf
      ? false
      : autoHorizontal;

  const spacingCcMm =
    cat === "knob"
      ? 1
      : typeof input.spacingCcMm === "number" && input.spacingCcMm > 0
      ? input.spacingCcMm
      : 160;

  const defaultEdgeInset = prof === "shaker_frame" ? 35 : 42;
  const edgeInset = Math.max(22, Math.min(120, input.handleEdgeInsetX ?? defaultEdgeInset));
  const openingSideX =
    input.partRole === "door_right"
      ? Math.min(edgeInset, input.frontWidthMm / 2)
      : Math.max(input.frontWidthMm / 2, input.frontWidthMm - edgeInset);

  const centerXMm = roundMm(horizontal ? input.frontWidthMm / 2 : openingSideX, 2);

  const approxVisualSpan = spacingCcMm <= 1 ? 32 : spacingCcMm + 24;
  const ergonomicTallCy = Math.max(
    120,
    Math.min(input.frontHeightMm - 180, 1020 - frontElevY)
  );
  const wallVerticalCy =
    cat === "knob"
      ? 48
      : Math.min(input.frontHeightMm / 2, Math.max(70, Math.round(approxVisualSpan / 2 + 45)));

  const defaultCy = isDrawer
    ? input.frontHeightMm <= 260
      ? input.frontHeightMm / 2
      : Math.max(input.frontHeightMm / 2, input.frontHeightMm - 38)
    : isLiftLeaf || (isWallOrHighFront && horizontal)
    ? Math.min(input.frontHeightMm / 2, 40)
    : isWallOrHighFront
    ? wallVerticalCy
    : isTallOrWardrobeFront
    ? ergonomicTallCy
    : horizontal
    ? Math.max(input.frontHeightMm / 2, input.frontHeightMm - 40)
    : Math.max(
        input.frontHeightMm / 2,
        input.frontHeightMm - Math.max(60, Math.round(approxVisualSpan / 2 + 32))
      );

  const centerYMm = roundMm(
    !isDrawer && typeof input.handleOffsetY === "number" && input.handleOffsetY >= 30
      ? Math.max(36, Math.min(input.frontHeightMm - 36, input.handleOffsetY))
      : defaultCy,
    2
  );

  const axisSpanMm = horizontal ? input.frontWidthMm : input.frontHeightMm;
  const edgeMarginMinMm = 32;
  const minRequiredSpanMm = spacingCcMm <= 1 ? 50 : spacingCcMm + 2 * edgeMarginMinMm;
  const exceedsPanelSpan = isDrilledCategory && axisSpanMm < minRequiredSpanMm;

  return {
    hasVisualHandle: true,
    isDrilledThrough: isDrilledCategory,
    orientation: horizontal ? "horizontal" : "vertical",
    centerXMm,
    centerYMm,
    spacingCcMm: isDrilledCategory ? spacingCcMm : 0,
    exceedsPanelSpan,
    minRequiredSpanMm,
  };
}

/**
 * Canonical Multi-Drawer Horizontal Gola L + C Pairing Rule (Scilm / Häfele / Schüller Standard):
 * Given external drawers sorted from BOTTOM (`sortedBottomToTopIndex = 0`) to TOP (`totalExtDrawers - 1`):
 * - When `topReachesCeiling === true` (drawer stack reaches under countertop):
 *   • Top drawer (`index = N - 1`) is opened from ABOVE via a normal Top L-Gola (56×26 mm) -> returns `false` for C-Gola.
 *   • Intermediate drawers pair up from the bottom (`index % 2 === 0`) because each 73.5×26 mm C-Gola is double-sided
 *     (opens the upper drawer from its bottom edge AND the lower drawer from its top edge), while the bottom-most drawer
 *     (`index = 0`) sits above the plinth and requires a top grip:
 *     - 1 drawer  (D1):                Top L only
 *     - 2 drawers (D1..D2):            Top L + C(1–2)
 *     - 3 drawers (D1..D3):            Top L + 3mm fuga(1–2) + C(2–3)
 *     - 4 drawers (D1..D4):            Top L + C(1–2) + 3mm fuga(2–3) + C(3–4)
 *     - 5 drawers (D1..D5):            Top L + 3mm fuga(1–2) + C(2–3) + 3mm fuga(3–4) + C(4–5)
 * - When `topReachesCeiling === false` (an upper door sits above the drawer stack):
 *   • `index = N - 1` ALSO gets a C-Gola above it (between the top drawer and the upper door).
 */
export type ErgonomicDrawerGripMode =
  | "top_l_overhand"
  | "top_c_overhand"
  | "bottom_c_underhand";

export interface ErgonomicGolaDrawerPlan {
  /** Dolabın en üstünde 56×26mm L-Gola (ve 30mm kapak üst düşümü) uygulanacak mı? (>1200mm yüksek çekmecelerde false!) */
  emitTopLGola: boolean;
  /** Alttan üste sıralı her dış çekmecenin (0 .. N-1) ÜST kenarındaki derzde 73.5×26mm C-Gola olup olmadığı */
  cGolaAbove: boolean[];
  /** Her çekmecenin insan biyomekaniğine göre açılma yönü (üstten avuç aşağı vs. alttan avuç yukarı) */
  gripModes: ErgonomicDrawerGripMode[];
}

/**
 * Anthropometric Two-Pass Optimal Gola L + C Solver (TS EN 14749 / DIN 33402 / Blum Ergonomic Zones):
 * - Ortalama yetişkin boyunda (~168–172 cm) yerden `maxOverhandTopGripMm` (`1200 mm`) üzerindeki bir çekmece
 *   üst kenarından bilek bükülerek (overhand / avuç aşağı) AÇILAMAZ; tıpkı üst dolap kapakları gibi
 *   ALT kenarından parmaklar yukarı kıvrılarak (underhand / avuç yukarı) açılmak zorundadır!
 * - Bu nedenle:
 *   1. En üst çekmecenin üst kotu `> 1200 mm` ise üstteki **L-Gola iptal edilir** (`emitTopLGola = false`),
 *      üst çekmece gövde tavanına tam sıfır çıkar ve kendi altındaki C-Gola'dan alttan çekilerek açılır.
 *   2. **Faz 1 (Yukarıdan Aşağı Yüksek Bölge Kuralı)**: Üst kotu `> 1200 mm` olan her çekmecenin hemen altına
 *      zorunlu C-Gola yerleştirilir (`cGolaAbove[k - 1] = true`). Eğer bu kanalın kotu `<= 1200 mm` seviyesine
 *      inmişse, aynı C-Gola bir alttaki çekmeceyi de üstten açar!
 *   3. **Faz 2 (Aşağıdan Yukarı Konfor Bölgesi Eşleştirmesi)**: `<= 1200 mm` altındaki kalan çekmeceler
 *      aşağıdan yukarı ikişerli eşleşerek tek bir çift yönlü C-Gola paylaşır; eşleşmeyen ara derzler net `3 mm` kalır!
 */
export function resolveErgonomicGolaDrawerPlan(params: {
  bottomWorldYsMm: number[];
  topWorldYsMm: number[];
  moduleFloorWorldYMm?: number;
  plinthHeightMm?: number;
  topReachesCeiling: boolean;
  maxOverhandTopGripMm?: number;
}): ErgonomicGolaDrawerPlan {
  const N = Math.min(params.bottomWorldYsMm.length, params.topWorldYsMm.length);
  if (N <= 0) {
    return { emitTopLGola: false, cGolaAbove: [], gripModes: [] };
  }
  const maxOverhandMm = params.maxOverhandTopGripMm ?? 1200;
  const floorPlusPlinthMm = (params.moduleFloorWorldYMm ?? 0) + (params.plinthHeightMm ?? 0);

  if (N === 1) {
    if (params.topReachesCeiling) {
      const canOnlyOpenFromTop =
        params.topWorldYsMm[0] <= maxOverhandMm ||
        params.bottomWorldYsMm[0] <= floorPlusPlinthMm + 35;
      return {
        emitTopLGola: canOnlyOpenFromTop,
        cGolaAbove: [false],
        gripModes: [canOnlyOpenFromTop ? "top_l_overhand" : "bottom_c_underhand"],
      };
    }
    return {
      emitTopLGola: false,
      cGolaAbove: [true],
      gripModes: [
        params.topWorldYsMm[0] <= maxOverhandMm ? "top_c_overhand" : "bottom_c_underhand",
      ],
    };
  }

  const emitTopLGola = Boolean(
    params.topReachesCeiling && params.topWorldYsMm[N - 1] <= maxOverhandMm
  );
  const cGolaAbove = new Array<boolean>(N).fill(false);
  const opened = new Array<boolean>(N).fill(false);
  const gripModes = new Array<ErgonomicDrawerGripMode>(N).fill("top_c_overhand");

  if (emitTopLGola) {
    opened[N - 1] = true;
    gripModes[N - 1] = "top_l_overhand";
  }
  if (!params.topReachesCeiling) {
    cGolaAbove[N - 1] = true;
    if (params.topWorldYsMm[N - 1] <= maxOverhandMm) {
      opened[N - 1] = true;
      gripModes[N - 1] = "top_c_overhand";
    }
  }

  // Pass 1: Top-Down High-Zone Underhand Enforcement (> 1200 mm MUST pull from bottom edge!)
  for (let k = N - 1; k >= 1; k--) {
    if (!opened[k] && params.topWorldYsMm[k] > maxOverhandMm) {
      cGolaAbove[k - 1] = true;
      opened[k] = true;
      gripModes[k] = "bottom_c_underhand";
      if (!opened[k - 1] && params.topWorldYsMm[k - 1] <= maxOverhandMm) {
        opened[k - 1] = true;
        gripModes[k - 1] = "top_c_overhand";
      }
    }
  }

  // Pass 2: Bottom-Up Comfortable-Zone Pairing (<= 1200 mm double-sided C-Gola sharing)
  for (let i = 0; i <= N - 2; i++) {
    if (!opened[i]) {
      cGolaAbove[i] = true;
      opened[i] = true;
      gripModes[i] = "top_c_overhand";
      if (!opened[i + 1]) {
        opened[i + 1] = true;
        gripModes[i + 1] = "bottom_c_underhand";
      }
    }
  }

  return { emitTopLGola, cGolaAbove, gripModes };
}

/**
 * Bir modülün tavan/tezgâh altında yatay Üst L-Gola (veya Gömme Parmak Kutusu) gerektirip gerektirmediğini
 * tüm bölmelerin kapak ve çekmece ergonomisine göre kesin olarak hesaplar.
 */
export function doesModuleEmitTopHorizontalGola(
  module: ModuleInstance,
  maxOverhandTopGripMm: number = 1200
): boolean {
  if (module.category === "kitchen_wall" || module.category === "complementary") {
    return false;
  }
  const T = module.carcass.panelThickness || 18;
  const plinth = module.carcass.plinthHeight || 0;
  const modWorldY = module.position?.y || 0;
  const modH = module.dimensions.height;
  const netInnerH = Math.max(120, modH - plinth - 2 * T);

  return module.bays.some((bay) => {
    if (
      bay.door?.handleCategory !== "gola_profile" ||
      bay.door?.handleProfileId === "hnd_gola_vertical" ||
      bay.door?.handleProfileId === "hnd_overhang_recessed_lip"
    ) {
      return false;
    }
    const hasNoUpperDoor =
      Boolean(module.isOpenFront) ||
      !bay.door ||
      bay.door.type === "open" ||
      bay.door.doorSystemId === "open";
    const extDrawers = [...bay.drawers]
      .filter((d) => !d.isInternal && !d.isHidden)
      .sort((a, b) => a.elevationY - b.elevationY);

    if (extDrawers.length > 0) {
      const highest = extDrawers[extDrawers.length - 1];
      const topReachesCeiling =
        highest.elevationY >= netInnerH * 0.55 ||
        (hasNoUpperDoor && highest.elevationY + highest.height >= netInnerH * 0.7);
      if (topReachesCeiling) {
        const plan = resolveErgonomicGolaDrawerPlan({
          bottomWorldYsMm: extDrawers.map((d) => modWorldY + plinth + T + d.elevationY),
          topWorldYsMm: extDrawers.map((d) => modWorldY + plinth + T + d.elevationY + d.height),
          moduleFloorWorldYMm: modWorldY,
          plinthHeightMm: plinth,
          topReachesCeiling: true,
          maxOverhandTopGripMm,
        });
        return plan.emitTopLGola;
      }
    }

    if (hasNoUpperDoor) return false;
    const isTallVerticalDoor =
      bay.door.handleOrientation !== "horizontal" &&
      (module.category === "kitchen_tall" ||
        module.category === "wardrobe" ||
        module.category === "wardrobe_walkin" ||
        module.category === "wardrobe_corner" ||
        module.category === "special_corner" ||
        modH - plinth >= 1200 ||
        modWorldY + modH > maxOverhandTopGripMm + 50);
    return !isTallVerticalDoor;
  });
}

export function doesDrawerHaveUpperCGolaChannel(
  sortedBottomToTopIndex: number,
  totalExtDrawers: number,
  topReachesCeiling: boolean,
  options?: {
    bottomWorldYsMm?: number[];
    topWorldYsMm?: number[];
    moduleFloorWorldYMm?: number;
    plinthHeightMm?: number;
    maxOverhandTopGripMm?: number;
  }
): boolean {
  if (sortedBottomToTopIndex < 0 || totalExtDrawers <= 0) return false;
  if (
    options?.bottomWorldYsMm &&
    options?.topWorldYsMm &&
    options.bottomWorldYsMm.length === totalExtDrawers &&
    options.topWorldYsMm.length === totalExtDrawers
  ) {
    const plan = resolveErgonomicGolaDrawerPlan({
      bottomWorldYsMm: options.bottomWorldYsMm,
      topWorldYsMm: options.topWorldYsMm,
      moduleFloorWorldYMm: options.moduleFloorWorldYMm,
      plinthHeightMm: options.plinthHeightMm,
      topReachesCeiling,
      maxOverhandTopGripMm: options.maxOverhandTopGripMm,
    });
    return Boolean(plan.cGolaAbove[sortedBottomToTopIndex]);
  }
  if (sortedBottomToTopIndex >= totalExtDrawers - 1) {
    return !topReachesCeiling;
  }
  return sortedBottomToTopIndex % 2 === 0;
}


// ============================================================================
// WORLD-STANDARD CABINET ZONE, HANDLE, DOOR & INTERIOR ELEMENT COMPATIBILITY
// (TS EN 14749 / EN 1116 / DIN 33402 / Blum / Häfele / Scilm / Kesseböhmer)
// ============================================================================

export type WorldCabinetZone =
  | "kitchen_wall"
  | "kitchen_corner_wall"
  | "kitchen_base"
  | "kitchen_corner_base"
  | "kitchen_sink_base"
  | "kitchen_appliance_base"
  | "kitchen_tall"
  | "wardrobe"
  | "living_or_other";

export function classifyCabinetPlacementZone(module: ModuleInstance): WorldCabinetZone {
  const nameLc = (module.name || "").toLowerCase();
  const tplLc = (module.templateId || "").toLowerCase();
  const isCorner = Boolean(
    module.isCorner ||
      module.category === "kitchen_corner" ||
      module.category === "wardrobe_corner" ||
      module.category === "special_corner" ||
      tplLc.includes("corner") ||
      nameLc.includes("köşe")
  );
  const isUpperWall =
    module.category === "kitchen_wall" ||
    module.moduleFamilyId === "fam_kitchen_wall" ||
    (!module.category.startsWith("wardrobe") && (module.position?.y ?? 0) >= 1100);

  if (isUpperWall) {
    return isCorner ? "kitchen_corner_wall" : "kitchen_wall";
  }

  if (
    module.category === "wardrobe" ||
    module.category === "wardrobe_walkin" ||
    module.category === "wardrobe_corner" ||
    module.moduleFamilyId === "fam_wardrobe"
  ) {
    return "wardrobe";
  }

  const netCarcassH = module.dimensions.height - (module.carcass.plinthHeight ?? 0);
  if (
    module.category === "kitchen_tall" ||
    module.moduleFamilyId === "fam_kitchen_tall" ||
    (module.category.startsWith("kitchen") && netCarcassH >= 1350)
  ) {
    return "kitchen_tall";
  }

  if (
    module.category === "kitchen_base" ||
    module.category === "kitchen_island" ||
    module.category === "kitchen_corner" ||
    module.moduleFamilyId === "fam_kitchen_base"
  ) {
    if (isCorner) return "kitchen_corner_base";
    if (tplLc.includes("sink") || nameLc.includes("evye") || nameLc.includes("eviye")) {
      return "kitchen_sink_base";
    }
    if (
      tplLc.includes("oven") ||
      tplLc.includes("dishwasher") ||
      nameLc.includes("fırın") ||
      nameLc.includes("bulaşık")
    ) {
      return "kitchen_appliance_base";
    }
    return "kitchen_base";
  }

  return "living_or_other";
}

export interface HandleCompatibilityResult {
  compatible: boolean;
  reasonTr?: string;
  recommendedProfileId?: string;
  recommendedCategory?: HandleCategory;
}

/**
 * Dünya mutfak & mobilya mühendisliği standartlarına göre (EN 14749 / Blum / Scilm / Häfele)
 * bir kulp profilinin belirli bir dolap bölgesi ve bölmesinde (Üst Dolap, Alt Dolap, Boy Dolap,
 * Sürgülü Kapak, Çekmece Grubu) kullanılabilir olup olmadığını denetler.
 */
export function evaluateHandleProfileForModuleBay(
  profileId: string | undefined,
  category: HandleCategory | string | undefined,
  module: ModuleInstance,
  bayIndex: number = 0
): HandleCompatibilityResult {
  const pid = profileId || "hnd_bar_160";
  const cat = (category || "bar_handle") as HandleCategory;
  const zone = classifyCabinetPlacementZone(module);
  const bay = module.bays[bayIndex] || module.bays[0];
  const doorType = bay?.door?.type || "single_left";
  const doorSys = bay?.door?.doorSystemId || "";
  const isSliding =
    doorType === "sliding" ||
    doorType === "sliding_bottom" ||
    doorSys === "sliding_top_hung" ||
    doorSys === "sliding_bottom_rolling";
  const extDrawersCount = (bay?.drawers || []).filter((d) => !d.isInternal && !d.isHidden).length;
  const isPureDrawerBay = doorType === "open" && extDrawersCount > 0;
  const bayWidths = calculateBayWidths(module);
  const bayW = bayWidths[bayIndex] || module.dimensions.width;
  const isDoubleDoor = doorType === "double" || doorSys === "hinged_double";
  const approxLeafW = isPureDrawerBay ? bayW : isDoubleDoor ? bayW / 2 : bayW;

  // 1. SÜRGÜLÜ KAPAK KURALLARI: Çıkıntılı kulplar arkadan geçen kanada çarpar!
  if (isSliding) {
    const allowedSliding =
      cat === "recessed_grip" ||
      cat === "milled_wood_grip" ||
      cat === "edge_profile" ||
      cat === "long_profile_handle";
    if (!allowedSliding) {
      return {
        compatible: false,
        reasonTr:
          "Sürgülü kapaklarda çıkıntılı çekme/düğme kulplar ve karkas Gola profilleri kanat geçişini kilitler; gömme sürgü kulpu veya hemzemin kenar profili kullanılmalıdır.",
        recommendedProfileId: "hnd_recessed_grip",
        recommendedCategory: "recessed_grip",
      };
    }
    return { compatible: true };
  }

  // Sürgüye özel gömme cep kulpu menteşeli/çekmeceli kapaklarda önerilmez
  if (pid === "hnd_recessed_grip") {
    return {
      compatible: false,
      reasonTr: "Gömme sürgü kulpu yalnızca sürgülü kapak sistemleri içindir.",
      recommendedProfileId: "hnd_bar_160",
      recommendedCategory: "bar_handle",
    };
  }

  // 2. ÜST DUVAR DOLABI KURALLARI (145 cm+ kot: Üstten el sokulan tezgâh altı L-Gola, C-Gola, Dikey Gola, 960mm kulp ve Çanak kulp YASAKTIR!)
  if (zone === "kitchen_wall" || zone === "kitchen_corner_wall") {
    const forbiddenUpperIds = new Set([
      "hnd_gola_profile",       // Tezgâh altı üst L-Gola (217 cm tavanda el girmez!)
      "hnd_gola_c_drawer",      // Çekmece arası C-Gola
      "hnd_gola_vertical",      // Boy dolap dikey Gola 1020
      "hnd_gola_melamine_box",  // Tezgâh altı 60x38 melamin parmak kutusu
      "hnd_gola_moulded_box",   // Tezgâh altı şekillendirilmiş kutu
      "hnd_bevel_30_backing",   // Üst kenar 30°/45° pah + arka kapama bandı (217 cm'de ulaşılamaz!)
      "hnd_long_profile_960",   // 960 mm boy dolap kulpu (720 mm üst dolap boyunu aşar!)
      "hnd_cup_pull_96",        // Klasik çanak/kupa kulp yalnızca alt çekmeceler içindir!
    ]);
    if (forbiddenUpperIds.has(pid) || cat === "long_profile_handle") {
      const isGolaOrBevel = cat === "gola_profile" || pid === "hnd_bevel_30_backing";
      return {
        compatible: false,
        reasonTr: isGolaOrBevel
          ? "Üst duvar dolaplarında (145–217 cm) üstten el sokulan L/C-Gola, dikey Gola veya üst pah kullanılamaz; alt tabana gömülü Gola 268 veya 18 mm sarkık kapak seçilmelidir."
          : "960 mm gardırop kulpu ve çanak çekmece kulpu üst duvar dolaplarında kullanılamaz.",
        recommendedProfileId: isGolaOrBevel
          ? "hnd_gola_wall_268"
          : pid === "hnd_cup_pull_96"
          ? "hnd_knob_std"
          : "hnd_bar_160",
        recommendedCategory: isGolaOrBevel
          ? "gola_profile"
          : pid === "hnd_cup_pull_96"
          ? "knob"
          : "bar_handle",
      };
    }
    if (pid === "hnd_bar_320" && approxLeafW < 384) {
      return {
        compatible: false,
        reasonTr: `C-C 320 mm geniş kulp, ${Math.round(approxLeafW)} mm dar üst kapak kanadına sığmaz (min. 384 mm gerekir).`,
        recommendedProfileId: "hnd_bar_160",
        recommendedCategory: "bar_handle",
      };
    }
    return { compatible: true };
  }

  // 3. ALT DOLAP / ADA / EVYE / KÖŞE ALT DOLAP KURALLARI
  if (
    zone === "kitchen_base" ||
    zone === "kitchen_corner_base" ||
    zone === "kitchen_sink_base" ||
    zone === "kitchen_appliance_base"
  ) {
    if (pid === "hnd_gola_wall_268" || pid === "hnd_overhang_recessed_lip") {
      return {
        compatible: false,
        reasonTr:
          "Üst Dolap Altı Gola 268 ve sarkık üst dolap tutamağı yalnızca duvar üst dolapları içindir; alt dolaplarda L-Gola veya C-Gola kullanılır.",
        recommendedProfileId: extDrawersCount > 0 ? "hnd_gola_c_drawer" : "hnd_gola_profile",
        recommendedCategory: "gola_profile",
      };
    }
    if (pid === "hnd_gola_vertical") {
      return {
        compatible: false,
        reasonTr:
          "Dikey Gola 1020 profili boy dolap ve gardıroplar içindir; tezgâh altı dolaplarda yatay L-Gola veya C-Gola kullanılır.",
        recommendedProfileId: extDrawersCount > 0 ? "hnd_gola_c_drawer" : "hnd_gola_profile",
        recommendedCategory: "gola_profile",
      };
    }
    if (pid === "hnd_long_profile_960" || cat === "long_profile_handle") {
      return {
        compatible: false,
        reasonTr: "960 mm uzun dikey gardırop kulpu 720 mm alt dolap yüksekliğini aşar.",
        recommendedProfileId: approxLeafW >= 400 ? "hnd_bar_320" : "hnd_bar_160",
        recommendedCategory: "bar_handle",
      };
    }
    if (pid === "hnd_gola_c_drawer" && extDrawersCount === 0) {
      return {
        compatible: false,
        reasonTr:
          "Çekmecesiz kapaklı alt dolaplarda ara C-Gola yerine tezgâh altı L-Gola profili kullanılır.",
        recommendedProfileId: "hnd_gola_profile",
        recommendedCategory: "gola_profile",
      };
    }
    if (pid === "hnd_bar_320" && approxLeafW < 384 && !isPureDrawerBay) {
      return {
        compatible: false,
        reasonTr: `C-C 320 mm kulp ${Math.round(approxLeafW)} mm dar kapak kanadını aşar.`,
        recommendedProfileId: "hnd_bar_160",
        recommendedCategory: "bar_handle",
      };
    }
    return { compatible: true };
  }

  // 4. BOY DOLAP (KITCHEN TALL) VE GARDIROP KURALLARI
  if (zone === "kitchen_tall" || zone === "wardrobe") {
    if (!isPureDrawerBay) {
      const forbiddenTallDoorIds = new Set([
        "hnd_gola_wall_268",
        "hnd_overhang_recessed_lip",
        "hnd_gola_profile",
        "hnd_gola_melamine_box",
        "hnd_gola_moulded_box",
        "hnd_bevel_30_backing",
        "hnd_cup_pull_96",
      ]);
      if (forbiddenTallDoorIds.has(pid) || (pid === "hnd_gola_c_drawer" && extDrawersCount === 0)) {
        const isGolaLike = cat === "gola_profile" || pid === "hnd_bevel_30_backing";
        return {
          compatible: false,
          reasonTr: isGolaLike
            ? "Boy dolap ve gardırop kapaklarında tezgâh altı yatay L-Gola veya üst dolap Gola 268 kullanılamaz; Dikey Alüminyum Gola (1020) kullanılır."
            : "Çanak kulp boy dolap ve gardırop kapaklarında kullanılamaz.",
          recommendedProfileId: isGolaLike ? "hnd_gola_vertical" : "hnd_bar_160",
          recommendedCategory: isGolaLike ? "gola_profile" : "bar_handle",
        };
      }
      if (pid === "hnd_long_profile_960" && module.dimensions.height < 1100) {
        return {
          compatible: false,
          reasonTr: "C-C 960 mm uzun kulp için kapak yüksekliği en az 1100 mm olmalıdır.",
          recommendedProfileId: "hnd_bar_320",
          recommendedCategory: "bar_handle",
        };
      }
    } else {
      // Sadece çekmeceli yüksek bölme
      if (pid === "hnd_gola_wall_268" || pid === "hnd_overhang_recessed_lip" || pid === "hnd_long_profile_960") {
        return {
          compatible: false,
          reasonTr: "Bu kulp modeli çekmece grubunda kullanılamaz.",
          recommendedProfileId: cat === "gola_profile" ? "hnd_gola_c_drawer" : "hnd_bar_320",
          recommendedCategory: cat === "gola_profile" ? "gola_profile" : "bar_handle",
        };
      }
    }
    return { compatible: true };
  }

  // 5. TV & YAŞAM ÜNİTELERİ (Alçak konsollar <= 950 mm)
  if (pid === "hnd_gola_wall_268" && (module.position?.y ?? 0) < 900) {
    return {
      compatible: false,
      reasonTr: "Üst Dolap Altı Gola 268 yalnızca duvara asılı üst modüller içindir.",
      recommendedProfileId: extDrawersCount > 0 ? "hnd_gola_c_drawer" : "hnd_gola_profile",
      recommendedCategory: "gola_profile",
    };
  }
  if (pid === "hnd_long_profile_960" && module.dimensions.height < 1100) {
    return {
      compatible: false,
      reasonTr: "C-C 960 mm uzun gardırop kulpu alçak konsollarda kullanılamaz.",
      recommendedProfileId: "hnd_bar_160",
      recommendedCategory: "bar_handle",
    };
  }

  return { compatible: true };
}

export function isHandleProfileCompatibleWithModuleBay(
  profileId: string | undefined,
  category: HandleCategory | string | undefined,
  module: ModuleInstance,
  bayIndex: number = 0
): boolean {
  return evaluateHandleProfileForModuleBay(profileId, category, module, bayIndex).compatible;
}

/**
 * Sahnedeki tüm dolaplara veya tüm bölmelere toplu kulp/kapak stili uygulanırken,
 * uyumsuz kulpları hedef dolabın dünya standardındaki eşdeğerine otomatik dönüştürür:
 * - Gola ailesi -> Alt kapakta L-Gola (`hnd_gola_profile`), Alt çekmecede C-Gola (`hnd_gola_c_drawer`),
 *   Üst dolapta Gola 268 (`hnd_gola_wall_268`), Boy dolapta Dikey Gola (`hnd_gola_vertical`)!
 */
export function resolveSmartCompatibleDoorPatchForModuleBay<
  T extends {
    handleProfileId?: string;
    handleCategory?: HandleCategory;
    crossSectionProfile?: import("./types").DoorCrossSectionProfile;
    openingTechnology?: OpeningTechnology;
    handleType?: "standard" | "integrated_profile" | "push_to_open" | "none" | "bar" | "recessed";
  }
>(patch: T, module: ModuleInstance, bayIndex: number = 0): T {
  if (!patch.handleProfileId && !patch.handleCategory && patch.crossSectionProfile !== "bevel_45") {
    return patch;
  }
  const bay = module.bays[bayIndex] || module.bays[0];
  const zone = classifyCabinetPlacementZone(module);
  const reqPid = patch.handleProfileId || bay?.door?.handleProfileId || "hnd_bar_160";
  const reqCat = patch.handleCategory || bay?.door?.handleCategory || "bar_handle";

  // Üst dolapta 45° üst pah (`bevel_45` / `hnd_bevel_30_backing`) seçildiyse düz kapak + Gola 268 / sarkık tutamağa çevir
  if (
    (zone === "kitchen_wall" || zone === "kitchen_corner_wall") &&
    patch.crossSectionProfile === "bevel_45" &&
    reqPid === "hnd_bevel_30_backing"
  ) {
    return {
      ...patch,
      handleProfileId: "hnd_overhang_recessed_lip",
      handleCategory: "gola_profile",
      crossSectionProfile: "flat_slab",
    };
  }

  const check = evaluateHandleProfileForModuleBay(reqPid, reqCat, module, bayIndex);
  if (check.compatible) {
    // Alt dolapta çekmeceli bölmeye L-Gola toplu gönderildiyse L+C Gola olarak zenginleştir
    const extDrawersCount = (bay?.drawers || []).filter((d) => !d.isInternal && !d.isHidden).length;
    if (reqPid === "hnd_gola_profile" && extDrawersCount > 0 && zone === "kitchen_base") {
      return {
        ...patch,
        handleProfileId: "hnd_gola_c_drawer",
        handleCategory: "gola_profile",
      };
    }
    return patch;
  }

  const nextPid = check.recommendedProfileId || "hnd_bar_160";
  const nextCat = check.recommendedCategory || "bar_handle";
  const nextCrossSection =
    nextCat === "j_pull"
      ? ("j_pull_bevel" as const)
      : nextPid === "hnd_bevel_30_backing"
      ? ("bevel_45" as const)
      : patch.crossSectionProfile === "bevel_45" || patch.crossSectionProfile === "j_pull_bevel"
      ? ("flat_slab" as const)
      : patch.crossSectionProfile;

  return {
    ...patch,
    handleProfileId: nextPid,
    handleCategory: nextCat,
    ...(nextCrossSection ? { crossSectionProfile: nextCrossSection } : {}),
  };
}

export type CompatibleInteriorElementKey =
  | "movable_shelf"
  | "fixed_shelf"
  | "external_drawer"
  | "internal_drawer"
  | "sub_divider"
  | "hanging_rail"
  | "trouser_pullout"
  | "shoe_pullout"
  | "jewelry_tray"
  | "pantograph_lift"
  | "led_hanging_rail"
  | "wire_basket"
  | "tie_belt_rack"
  | "waste_bin"
  | "spice_pullout"
  | "pantry_pullout"
  | "corner_lemans";

/**
 * Seçili dolap tipine göre "+ İç Eleman Ekle" menüsünde gösterilecek dünya standardı
 * uyumlu iç donanım listesini döndürür (Örn. Üst mutfak dolabına asla elbise askısı,
 * ayakkabılık, pantolonluk veya çekmece eklenemez!).
 */
export function getCompatibleInteriorElementsForModuleBay(
  module: ModuleInstance,
  bayIndex: number = 0
): Set<CompatibleInteriorElementKey> {
  const zone = classifyCabinetPlacementZone(module);
  const bay = module.bays[bayIndex] || module.bays[0];
  const doorType = bay?.door?.type || "single_left";
  const isSliding =
    doorType === "sliding" ||
    doorType === "sliding_bottom" ||
    bay?.door?.doorSystemId?.startsWith("sliding");
  const bayWidths = calculateBayWidths(module);
  const bayW = bayWidths[bayIndex] || module.dimensions.width;
  const netH = calculateNetInnerHeight(module);
  const depth = module.dimensions.depth;
  const hasShelves = (bay?.shelves || []).length >= 1;

  if (zone === "kitchen_wall" || zone === "kitchen_corner_wall") {
    const set = new Set<CompatibleInteriorElementKey>(["movable_shelf", "fixed_shelf"]);
    if (hasShelves && zone !== "kitchen_corner_wall") set.add("sub_divider");
    return set;
  }

  if (zone === "kitchen_sink_base") {
    return new Set<CompatibleInteriorElementKey>(["fixed_shelf", "waste_bin"]);
  }

  if (zone === "kitchen_corner_base") {
    return new Set<CompatibleInteriorElementKey>(["movable_shelf", "fixed_shelf", "corner_lemans"]);
  }

  if (zone === "kitchen_appliance_base") {
    return new Set<CompatibleInteriorElementKey>(["fixed_shelf", "external_drawer"]);
  }

  if (zone === "kitchen_base") {
    const set = new Set<CompatibleInteriorElementKey>([
      "movable_shelf",
      "fixed_shelf",
      "internal_drawer",
      "wire_basket",
    ]);
    if (!isSliding) set.add("external_drawer");
    if (hasShelves) set.add("sub_divider");
    if (bayW >= 340) set.add("waste_bin");
    if (bayW <= 460) set.add("spice_pullout");
    return set;
  }

  if (zone === "kitchen_tall") {
    const set = new Set<CompatibleInteriorElementKey>([
      "movable_shelf",
      "fixed_shelf",
      "internal_drawer",
      "wire_basket",
    ]);
    if (!isSliding) set.add("external_drawer");
    if (hasShelves) set.add("sub_divider");
    if (bayW <= 660) set.add("pantry_pullout");
    return set;
  }

  if (zone === "wardrobe") {
    const set = new Set<CompatibleInteriorElementKey>([
      "movable_shelf",
      "fixed_shelf",
      "internal_drawer",
      "hanging_rail",
      "led_hanging_rail",
      "shoe_pullout",
      "jewelry_tray",
      "wire_basket",
      "tie_belt_rack",
    ]);
    if (!isSliding) set.add("external_drawer");
    if (hasShelves) set.add("sub_divider");
    if (depth >= 440) set.add("trouser_pullout");
    if (netH >= 780 && bayW >= 420) set.add("pantograph_lift");
    return set;
  }

  // TV & Yaşam / Banyo / Vestiyer
  const set = new Set<CompatibleInteriorElementKey>([
    "movable_shelf",
    "fixed_shelf",
    "internal_drawer",
  ]);
  if (!isSliding) set.add("external_drawer");
  if (hasShelves) set.add("sub_divider");
  if (netH >= 900 && depth >= 450) {
    set.add("hanging_rail");
    set.add("shoe_pullout");
  }
  return set;
}
