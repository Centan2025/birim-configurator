import {
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
import { calculateBayWidths, calculateNetInnerHeight, calculateNetInnerDepth } from "./rules";

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
    maxShelfSpanMm: 950,
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
    maxShelfSpanMm: 950,
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
    maxShelfSpanMm: 950,
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
    overlayType: DoorOverlayType;
    doorX0Mm: UnitLength;
    doorY0Mm: UnitLength;
    doorZ0Mm: UnitLength;
    fullDoorSpanWidthMm: UnitLength;
    baseDoorHeightMm: UnitLength;
    centerRevealGapMm: UnitLength;
  }[];
}

/**
 * Resolves the effective construction parameters by cascading:
 * International -> Manufacturer -> Birim Factory -> Module Override
 */
export function resolveEffectiveConstructionProfile(module: ModuleInstance): ConstructionProfile {
  const baseProfile =
    CONSTRUCTION_PROFILES[module.carcass.constructionProfileId || "profile_birim_factory_std"] ||
    CONSTRUCTION_PROFILES.profile_birim_factory_std;

  return {
    ...baseProfile,
    panelThicknessMm: module.carcass.panelThickness || baseProfile.panelThicknessMm,
    backPanelThicknessMm: module.carcass.backPanelThickness || baseProfile.backPanelThicknessMm,
    backPanelType: module.carcass.backPanelType || baseProfile.backPanelType,
    doorThicknessMm: module.carcass.doorThickness || baseProfile.doorThicknessMm,
    doorPerimeterGapMm: module.carcass.doorPerimeterGap ?? baseProfile.doorPerimeterGapMm,
    plinthHeightMm: module.carcass.plinthHeight ?? baseProfile.plinthHeightMm,
    edgeBandThicknessMm: module.carcass.edgeBandThickness ?? baseProfile.edgeBandThicknessMm,
    system32FrontSetbackMm: module.carcass.system32FrontSetback || baseProfile.system32FrontSetbackMm,
    jointType: module.carcass.jointType || baseProfile.jointType,
  };
}

/**
 * Computes the 4 separate canonical dimension spaces required by Faz 03 & Faz 04:
 * 1. External Carcass Dimensions
 * 2. Net Panel Cut Dimensions
 * 3. Usable Internal Clear Dimensions
 * 4. Door Leaf Dimensions, Mass (kg), Power Factor (LF), and Hinge Count
 */
export function calculateFourSpaceDimensions(module: ModuleInstance): FourSpaceDimensionsBreakdown {
  const profile = resolveEffectiveConstructionProfile(module);
  const { width, height, depth } = module.dimensions;
  const T = profile.panelThicknessMm;
  const T_door = profile.doorThicknessMm;
  const plinth = profile.plinthHeightMm;
  const gap = profile.doorPerimeterGapMm;

  const sidePanelHeightMm = Math.max(0, height - plinth);
  const horizontalPanelWidthMm = Math.max(0, width - 2 * T);
  const netInnerHeightMm = calculateNetInnerHeight(module);
  const baseInnerDepthMm = calculateNetInnerDepth(module);
  const bayClearWidthsMm = calculateBayWidths(module);

  // Check if any bay uses sliding or inset doors to adjust usable internal depth
  const hasSliding = module.bays.some(
    (b) =>
      b.door.type === "sliding" ||
      b.door.doorSystemId === "sliding_top_hung" ||
      b.door.doorSystemId === "sliding_bottom_rolling"
  );
  const hasInset = module.bays.some(
    (b) => b.door.overlayType === "inset" || b.door.doorSystemId === "hinged_inset" || b.door.type.startsWith("inset")
  );

  const usableInnerDepthMm = Math.max(
    0,
    baseInnerDepthMm - (hasSliding ? 80 : 0) - (hasInset ? T_door + 2 : 0)
  );

  let backPanelWidthMm = horizontalPanelWidthMm + 16;
  let backPanelHeightMm = netInnerHeightMm + 16;
  if (profile.backPanelType === "rebated") {
    backPanelWidthMm = horizontalPanelWidthMm + 20;
    backPanelHeightMm = netInnerHeightMm + 20;
  } else if (profile.backPanelType === "flush" || profile.backPanelType === "nailed") {
    backPanelWidthMm = Math.max(0, width - 2);
    backPanelHeightMm = Math.max(0, sidePanelHeightMm - 2);
  }

  const doorMat =
    DEFAULT_MATERIALS.find((m) => m.id === module.carcass.doorMaterialId) || DEFAULT_MATERIALS[2];
  const densityKgM3 = doorMat.densityKgPerM3 || 750;

  let currentBayStartX = T;
  const doorLeaves = module.bays.map((bay, bayIdx) => {
    const bayW = bayClearWidthsMm[bayIdx] || 0;
    const bayStartX = currentBayStartX;
    currentBayStartX += bayW + T;

    const dType = bay.door.type;
    const dSys = bay.door.doorSystemId || inferDoorSystemIdFromType(dType);
    const overlayType: DoorOverlayType =
      bay.door.overlayType ||
      (dSys === "hinged_inset" || dType.startsWith("inset")
        ? "inset"
        : dSys === "hinged_overlay_variant" || dType.startsWith("half_overlay")
        ? "half_overlay"
        : "full_overlay");

    const leftOverlay =
      overlayType === "inset"
        ? -gap
        : overlayType === "half_overlay"
        ? T / 2 - gap / 2
        : bayIdx === 0
        ? T - gap
        : T / 2 - gap / 2;
    const rightOverlay =
      overlayType === "inset"
        ? -gap
        : overlayType === "half_overlay"
        ? T / 2 - gap / 2
        : bayIdx === module.bays.length - 1
        ? T - gap
        : T / 2 - gap / 2;

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
    const bottomCutMm = applyPartialDoorCut ? openCavityBottomCut : 0;
    const topCutMm =
      applyPartialDoorCut && topExtDrawers.length > 0
        ? Math.max(0, netInnerHeightMm - Math.min(...topExtDrawers.map((d) => d.elevationY)) + T)
        : 0;

    const rawDoorY0Mm = overlayType === "inset" ? plinth + T + gap : plinth + gap;
    const doorX0Mm = overlayType === "inset" ? bayStartX + gap : bayStartX - leftOverlay;
    const doorY0Mm = rawDoorY0Mm + bottomCutMm;
    const doorZ0Mm = overlayType === "inset" ? depth - T : depth;
    const totalDoorSpanW = Math.max(80, bayW + leftOverlay + rightOverlay);

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
        overlayType,
        doorX0Mm,
        doorY0Mm,
        doorZ0Mm,
        fullDoorSpanWidthMm: totalDoorSpanW,
        baseDoorHeightMm: 0,
        centerRevealGapMm: profile.centerRevealGapMm,
      };
    }

    const isHingedOrFold =
      !dSys.startsWith("sliding") &&
      !dSys.startsWith("lift_") &&
      dSys !== "pocket_retractable" &&
      dSys !== "tambour_roller";
    const isDouble =
      dType === "double" ||
      dType === "inset_double" ||
      dSys === "hinged_double" ||
      dSys === "folding_side" ||
      (isHingedOrFold && totalDoorSpanW > 600);
    const isBiFoldLift = dType === "lift_bi_fold" || dSys === "lift_bi_fold";
    const leafCount = isDouble || isBiFoldLift ? 2 : 1;

    const rawLeafWidthMm =
      dSys === "folding_side" || dType === "folding"
        ? Math.max(0, Math.round((totalDoorSpanW - gap) / 2))
        : isDouble
        ? Math.max(0, Math.round((totalDoorSpanW - profile.centerRevealGapMm) / 2))
        : Math.round(totalDoorSpanW);
    const leafWidthMm = isHingedOrFold ? Math.min(600, rawLeafWidthMm) : rawLeafWidthMm;

    const golaDeduction = bay.door.handleCategory === "gola_profile" ? 30 : 0;
    const rawBaseDoorHeight =
      overlayType === "inset"
        ? Math.max(80, netInnerHeightMm - 2 * gap - golaDeduction)
        : Math.max(80, sidePanelHeightMm - 2 * gap - golaDeduction);
    const baseDoorHeight = Math.max(80, rawBaseDoorHeight - bottomCutMm - topCutMm);

    const leafHeightMm = isBiFoldLift
      ? Math.round((baseDoorHeight - gap) / 2)
      : Math.round(baseDoorHeight);

    const leafThicknessMm = bay.door.doorThicknessMm || T_door;
    const volumeM3 = (leafWidthMm * baseDoorHeight * leafThicknessMm) / 1_000_000_000;
    const handleWeightKg = bay.door.handleCategory === "handleless_plain" ? 0 : 0.18;
    const totalFrontWeightKg = Number((volumeM3 * densityKgM3 + handleWeightKg).toFixed(2));
    const leafWeightKg = isDouble
      ? Number((totalFrontWeightKg / 2).toFixed(2))
      : totalFrontWeightKg;

    const powerFactorLf = Math.round(sidePanelHeightMm * (totalFrontWeightKg + 2 * handleWeightKg));

    const recommendedHingesPerLeaf =
      dSys.startsWith("sliding") || dSys.startsWith("lift") || dSys === "tambour_roller"
        ? 0
        : leafHeightMm > 2000 || leafWeightKg > 20
        ? 5
        : leafHeightMm > 1600 || leafWeightKg > 15
        ? 4
        : leafHeightMm > 900 || leafWeightKg > 9
        ? 3
        : 2;

    return {
      bayIndex: bayIdx,
      leafCount,
      leafWidthMm,
      leafHeightMm,
      leafThicknessMm,
      leafWeightKg,
      powerFactorLf,
      recommendedHingesPerLeaf,
      overlayType,
      doorX0Mm,
      doorY0Mm,
      doorZ0Mm,
      fullDoorSpanWidthMm: totalDoorSpanW,
      baseDoorHeightMm: baseDoorHeight,
      centerRevealGapMm: profile.centerRevealGapMm,
    };
  });

  return {
    externalCarcass: {
      widthMm: width,
      heightMm: height,
      depthMm: depth,
      totalDepthWithDoorMm: module.isOpenFront ? depth : depth + T_door + 2,
    },
    netPanelCut: {
      sidePanelHeightMm,
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

/**
 * Safely migrates any V3.1 DesignProject to V4 without losing any existing fields,
 * populating canonical V4 doorSystemId, overlayType, handleCategory, openingTechnology, and moduleFamilyId.
 */
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
          : mod.category === "kitchen_corner" || mod.category === "wardrobe_corner" || mod.category === "special_corner"
          ? "fam_special_corner"
          : mod.category === "complementary"
          ? "fam_complementary"
          : "fam_wardrobe");

      return {
        ...mod,
        moduleFamilyId,
        carcass: {
          ...mod.carcass,
          constructionProfileId: mod.carcass.constructionProfileId || "profile_birim_factory_std",
          doorThickness: mod.carcass.doorThickness || 18,
          system32FrontSetback: mod.carcass.system32FrontSetback || 37,
        },
        bays: mod.bays.map((bay) => {
          const doorSystemId = bay.door.doorSystemId || inferDoorSystemIdFromType(bay.door.type);
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
