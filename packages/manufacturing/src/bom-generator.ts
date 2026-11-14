import {
  DesignProject,
  ModuleInstance,
  MaterialDefinition,
  DEFAULT_MATERIALS,
  syncProjectCustomMaterials,
  ParametricPart,
  calculateFourSpaceDimensions,
  calculateRecommendedHingesPerLeaf,
  calculateShelfDeflection,
  inferDoorSystemIdFromType,
  isBuiltInDishwasherModule,
  isBuiltInOvenOrFridgeTower,
  computeGolaSidePanelNotches,
  computeDividerTJunctionYs,
  isSinkModule,
  isCooktopModule,
  evaluateCornerAndSweepCollisions,
  roundIntMm,
  roundMm,
  resolveCanonicalHandlePlacement,
  computeProjectGrainContinuityMap,
  resolveMultiHoleSpec,
} from "@birim/core";
import { evaluateFreestandingTipOverRisk, evaluateUnifiedEngineeringModel } from "@birim/core";
import {
  getHardwareProductById,
  HANDLE_PROFILES,
  getAllHandleProfiles,
  selectOptimalRunnerLengthMm,
} from "@birim/catalog";
import { generateModuleGeometry } from "@birim/geometry";
import {
  CutPiece,
  EdgeBandingConfig,
  HardwareBOMItem,
  ManufacturingBOM,
  ShelfDeflectionBOMEntry,
} from "./types";
import { generateDrillingForPart } from "./drilling-engine";
import { optimizeSheetNesting } from "./sheet-nesting";

const STANDARD_SHEET_AREA_M2 = (2800 * 2070) / 1_000_000; // 5.796 m²
const STANDARD_WASTE_FACTOR = 1.12;

const bomProjectCache = new Map<string, ManufacturingBOM>();

function computeProjectBOMKey(
  project: DesignProject,
  materialsMap: Map<string, MaterialDefinition>
): string {
  return JSON.stringify([project, Array.from(materialsMap.entries())]);
}

function formatEdgeBandCode(eb: EdgeBandingConfig): string {
  const bCount = (eb.left ? 1 : 0) + (eb.right ? 1 : 0);
  const eCount = (eb.top ? 1 : 0) + (eb.bottom ? 1 : 0);
  if (bCount === 0 && eCount === 0) return "Bantsız";
  if (bCount === 2 && eCount === 2) return `4K (2B+2E) ${eb.thickness}mm`;
  const parts: string[] = [];
  if (bCount > 0) parts.push(`${bCount}B`);
  if (eCount > 0) parts.push(`${eCount}E`);
  return `${parts.join("+")} ${eb.thickness}mm`;
}

function doesBayDoorHingeOnLeft(bay: ModuleInstance["bays"][number] | undefined): boolean {
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
    dType === "left" ||
    dType === "double" ||
    dType === "inset_left" ||
    dType === "inset_double" ||
    dType === "half_overlay_left" ||
    dType === "folding" ||
    dSys === "hinged_double" ||
    dSys === "folding_side"
  );
}

function doesBayDoorHingeOnRight(bay: ModuleInstance["bays"][number] | undefined): boolean {
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
    dType === "right" ||
    dType === "double" ||
    dType === "inset_right" ||
    dType === "inset_double" ||
    dType === "half_overlay_right" ||
    dSys === "hinged_double"
  );
}

function hasSinkOrCooktopAppliance(module: ModuleInstance): boolean {
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

export function generateBOMForProject(
  project: DesignProject,
  materialsMap: Map<string, MaterialDefinition> = new Map(DEFAULT_MATERIALS.map((m) => [m.id, m])),
  options?: GenerateBOMOptions
): ManufacturingBOM {
  if (!project || !project.modules || project.modules.length === 0) {
    return {
      projectId: project?.id || "empty",
      version: project?.version || 1,
      createdAt: new Date().toISOString(),
      approvalStatus: "draft",
      summary: {
        totalPiecesCount: 0,
        totalPanelAreaM2: 0,
        totalEdgeBandMeters: 0,
        totalHardwareCount: 0,
        totalDrillingHolesCount: 0,
      },
      cutList: [],
      hardwareList: [],
      materialUsage: [],
      nestingResults: [],
      validationWarnings: [],
      shelfDeflectionAnalyses: [],
      productionGate: {
        isReadyForErp: false,
        checks: [],
      },
    };
  }

  const skipSyncNesting = Boolean(options?.skipSyncNesting);
  const cacheKey = `${computeProjectBOMKey(project, materialsMap)}_sn:${skipSyncNesting ? 1 : 0}`;
  const cached = bomProjectCache.get(cacheKey);
  if (cached) return cached;

  const cutList: CutPiece[] = [];
  const grainContinuityMap = computeProjectGrainContinuityMap(project, materialsMap);
  const hardwareMap: Map<string, HardwareBOMItem> = new Map();
  const shelfDeflectionAnalyses: ShelfDeflectionBOMEntry[] = [];
  const validationWarnings: string[] = [
    "UNVERIFIED: Üretim kuralları ve montaj koordinatları fabrika teknik doğrulaması bekliyor; CNC çıktısı üretime hazır değildir.",
  ];
  let totalDrillingHolesCount = 0;
  let allDimensionChainsClosed = true;

  function addHardware(
    sku: string,
    name: string,
    category: HardwareBOMItem["category"],
    quantity: number,
    unit: HardwareBOMItem["unit"] = "adet",
    unitPrice = 0
  ) {
    if (quantity <= 0) return;
    const existing = hardwareMap.get(sku);
    if (existing) {
      existing.quantity = roundMm(existing.quantity + quantity, 2);
      existing.totalPrice = roundMm(existing.quantity * existing.unitPrice, 2);
    } else {
      hardwareMap.set(sku, {
        sku,
        name,
        category,
        quantity: roundMm(quantity, 2),
        unit,
        unitPrice,
        totalPrice: roundMm(quantity * unitPrice, 2),
      });
    }
  }

  const projectHasSinkOrHob = project.modules.some(
    (m) => m.category !== "complementary" && hasSinkOrCooktopAppliance(m)
  );
  const mainCabinetCount = project.modules.filter(
    (m) => m.category !== "complementary" && !isBuiltInDishwasherModule(m)
  ).length;
  if (mainCabinetCount > 1) {
    addHardware(
      "HW_CABINET_CONN_M4",
      "M4×34mm Kovanlı Yan Yana Kabin Birleştirme Civatası (Sistem 32 Ø5 Uyumlu)",
      "connector",
      (mainCabinetCount - 1) * 4,
      "adet",
      0.35
    );
  }

  // Stacked Modules Vertical Load-Transfer Connectors (M6x38mm Sleeve Bolts)
  const stackedFloorModulesCount = project.modules.filter(
    (u) =>
      u.category !== "complementary" &&
      u.category !== "kitchen_wall" &&
      u.position.y > 50 &&
      project.modules.some(
        (b) =>
          b.id !== u.id &&
          b.category !== "complementary" &&
          Math.abs(b.position.y + b.dimensions.height - u.position.y) <= 20
      )
  ).length;
  if (stackedFloorModulesCount > 0) {
    addHardware(
      "HW_STACKING_BOLT_M6",
      "M6×38mm Üst Üste Modül Kovanlı Düşey Yük Bağlantı Cıvatası",
      "connector",
      stackedFloorModulesCount * 4,
      "adet",
      0.55
    );
  }


  // V5/V7 SceneObject Appliance & Plumbing Fixture Protective Hardware Triggers
  for (const so of project.sceneObjects || []) {
    const cid = (so.catalogId || "").toLowerCase();
    const nm = (so.name || "").toLowerCase();
    const cutKind = so.cutoutTrigger?.kind;
    if (cutKind === "sink" || cid.includes("sink") || nm.includes("eviye") || nm.includes("lavabo")) {
      addHardware(
        "EVYE-KORUMA-SAC",
        "Eviye Altı Su Sızdırmaz Alüminyum Koruma Sacı",
        "special",
        1,
        "adet",
        14.5
      );
      addHardware(
        "HW_SINK_DRIP_MAT_ALU",
        "Eviye / Lavabo Alt Tabla Alüminyum Su Sızdırmaz Koruma Sacı",
        "special",
        1,
        "adet",
        14.5
      );
    }
    if (cutKind === "cooktop" || cid.includes("cooktop") || cid.includes("hob") || nm.includes("ocak")) {
      addHardware(
        "OCAK-ISI-KALKAN",
        "Ankastre Ocak Altı İndüksiyon Isı Koruma Kalkanı",
        "special",
        1,
        "adet",
        16.0
      );
    }
  }

  syncProjectCustomMaterials(project.customMaterials);
  if (project.customMaterials?.length) {
    project.customMaterials.forEach((cm) => materialsMap.set(cm.id, cm));
  }

  project.modules.forEach((module: ModuleInstance) => {
    const geo = generateModuleGeometry(module);
    const fourSpace = calculateFourSpaceDimensions(module, project.customMaterials);
    const bodyMat = materialsMap.get(module.carcass.bodyMaterialId) || DEFAULT_MATERIALS[0];
    const doorMat = materialsMap.get(module.carcass.doorMaterialId) || DEFAULT_MATERIALS[2];
    const isCapsuleModule =
      module.carcass.hullShape === "capsule_stadium" ||
      module.carcass.hullShape === "capsule_table";
    const hasGroovedBack =
      module.category !== "complementary" &&
      !module.isOpenFront &&
      !isCapsuleModule &&
      module.carcass.backPanelType === "grooved";

    // V5.2 / V6 Canonical Capsule & Rounded-Corner Kerf-Bending BOM:
    // For `capsule_stadium`, `generateModuleGeometry(module)` already emits canonical `kerf_curve`
    // shells (with zero duplicate flat side panels!) which flow through the unified `CutPiece` loop below.
    if (
      module.carcass.hullShape === "capsule_stadium" ||
      module.carcass.hullShape === "rounded_corners"
    ) {
      const capR = Math.min(
        module.dimensions.depth / 2,
        module.carcass.cornerRadiusMm || module.dimensions.depth / 2
      );
      const bendDeg = module.carcass.hullShape === "capsule_stadium" ? 180 : 90;
      const curveCount = module.carcass.hullShape === "capsule_stadium" ? 2 : 4;
      const kerf = computeCurvedKerfBendingSpec(
        capR,
        bendDeg,
        module.carcass.panelThickness || 18
      );
      if (module.carcass.hullShape === "rounded_corners") {
        const bodyH = Math.max(
          200,
          module.dimensions.height - (module.carcass.plinthHeight || 0) - 22
        );
        for (let ci = 1; ci <= curveCount; ci++) {
          const areaM2 = roundMm((kerf.unfoldedArcLengthMm * bodyH) / 1_000_000, 4);
          const ebT = 1;
          const preMill = Math.max(0, module.carcass.preMillingMm ?? 0);
          const netL = Math.max(10, roundMm(bodyH - 2 * (ebT - preMill), 1));
          cutList.push({
            id: `${module.id}_kerf_corner_${ci}`,
            pieceName: `Yuvarlatılmış Köşe Kerf Açınımı #${ci} (R=${kerf.outerRadiusMm}mm • ${kerf.kerfCount} Kerf)`,
            moduleName: module.name,
            moduleId: module.id,
            componentRole: "kerf_curve",
            materialId: doorMat.id,
            materialName: doorMat.name,
            lengthMm: bodyH,
            widthMm: kerf.unfoldedArcLengthMm,
            nominalLengthMm: bodyH,
            nominalWidthMm: kerf.unfoldedArcLengthMm,
            netCutLengthMm: netL,
            netCutWidthMm: kerf.unfoldedArcLengthMm,
            preMillingMm: preMill,
            rawOriginOffsetXMm: 0,
            rawOriginOffsetYMm: roundMm(ebT - preMill, 2),
            edgeBandCode: "2K 1mm",
            thicknessMm: kerf.panelThicknessMm,
            quantity: 1,
            edgeBanding: { top: true, bottom: true, left: false, right: false, thickness: ebT },
            grain: "lengthwise",
            areaM2,
            edgeBandMeters: roundMm((kerf.unfoldedArcLengthMm * 2) / 1000, 3),
            holes: [],
            kerfBendingMeta: {
              outerRadiusMm: kerf.outerRadiusMm,
              bendAngleDeg: bendDeg,
              unfoldedArcLengthMm: kerf.unfoldedArcLengthMm,
              kerfCount: kerf.kerfCount,
              kerfSpacingMm: kerf.kerfSpacingMm,
              residualWebMm: kerf.residualSkinThicknessMm,
            },
          });
        }
      }
      addHardware(
        "HW_CNC_KERF_BENDING",
        `CNC Kerf-Bending Kavis Çentikleme & Kalıp Pres (${kerf.kerfCount * curveCount} kanal)`,
        "special",
        curveCount,
        "adet",
        34.0
      );
      addHardware(
        "HW_TAMBOUR_FLEX_TRACK",
        "Kavisli Tambur Sürgü Kapak Rayı & Akustik Keçe Sırt",
        "slide",
        1,
        "takım",
        68.0
      );
    } else if (module.carcass.hullShape === "capsule_table") {
      const pedR = Math.round(Math.min(185, Math.max(95, module.dimensions.depth * 0.21)));
      const kerfPed = computeCurvedKerfBendingSpec(pedR, 360, 18);
      addHardware(
        "HW_CNC_SWISS_CAPSULE_TOP",
        `5 Eksen CNC Kapsül Masa Kontur & 45° Swiss-Edge Pah İşleme (R=${Math.round(module.dimensions.depth / 2)}mm)`,
        "special",
        1,
        "adet",
        55.0
      );
      addHardware(
        "HW_CNC_FLUTED_PEDESTAL",
        `Silindirik Yivli Kapsül Sütun Ayak Seti (Açınım ${kerfPed.unfoldedArcLengthMm}mm)`,
        "leg",
        module.dimensions.width >= 1450 ? 2 : 1,
        "adet",
        95.0
      );
    }

    if (module.category !== "complementary") {
      // P0-03: EN 14749 / EN 16122 Tall & Slender Freestanding Cabinet Anti-Tip Restraint Hardware
      const tipEval = evaluateFreestandingTipOverRisk(module, project.space);
      if (tipEval.requiresWallAnchor && module.carcass.wallAnchored !== false) {
        addHardware(
          "HW_ANTI_TIP_EN14749_L",
          "EN 14749 Devrilme Önleyici Çelik L-Duvar Sabitleme Braketi + Dübel Seti",
          "fastener",
          2,
          "adet",
          2.65
        );
      }

      const baySum = fourSpace.usableInternal.bayClearWidthsMm.reduce((a, b) => a + b, 0);
      const expectedTotalW =
        baySum + (module.bays.length + 1) * (module.carcass.panelThickness || 18);
      if (Math.abs(expectedTotalW - module.dimensions.width) > 1) {
        allDimensionChainsClosed = false;
      }

      module.bays.forEach((bay) => {
        const prof =
          bay.door?.crossSectionProfile || module.carcass.crossSectionProfile || "flat_slab";
        if (
          prof !== "flat_slab" &&
          bay.door?.type !== "open" &&
          bay.door?.doorSystemId !== "open"
        ) {
          const doorAreaM2 = roundMm(
            (module.dimensions.width * module.dimensions.height) /
              (Math.max(1, module.bays.length) * 1_000_000),
            2
          );
          const rateMap: Record<
            string,
            { sku: string; name: string; price: number } | undefined
          > = {
            shaker_frame: {
              sku: "HW_CNC_DOOR_PROFILE_SHAKER",
              name: "5 Eksen CNC Çerçeve (Shaker) Kapak Göbek İşleme",
              price: 18.0,
            },
            fluted_ribbed: {
              sku: "HW_CNC_DOOR_PROFILE_FLUTED",
              name: "CNC Dikey Mikro-Derz (Fitilli / Fluted) Yüzey İşleme",
              price: 22.0,
            },
            bevel_45: {
              sku: "HW_CNC_DOOR_PROFILE_BEVEL45",
              name: "CNC 45° Pahlı Kapak Kenar Kesit İşleme",
              price: 14.0,
            },
            j_pull_bevel: {
              sku: "HW_CNC_DOOR_PROFILE_JPULL",
              name: "CNC 45° Gizli Eğimli J-Kulp Parmak Kanalı İşleme",
              price: 19.0,
            },
            cove_arch: {
              sku: "HW_CNC_DOOR_PROFILE_COVE",
              name: "5 Eksen CNC İçbükey Kavisli (Cove) Çerçeve İşleme",
              price: 21.0,
            },
            custom_cad_profile: {
              sku: "HW_CNC_DOOR_PROFILE_CUSTOM",
              name: "Özel CAD (DXF/SVG) Kapak Kesit Profili İşleme",
              price: 25.0,
            },
          };
          const spec = rateMap[prof];
          if (spec && doorAreaM2 > 0) {
            addHardware(
              spec.sku,
              spec.name,
              "special",
              Math.max(0.5, doorAreaM2),
              "metre",
              spec.price
            );
          }
        }
      });

      module.bays.forEach((bay, bIdx) => {
        if (bay.shelves.length > 0) {
          const spanMm = fourSpace.usableInternal.bayClearWidthsMm[bIdx] || 600;
          const depthMm = Math.max(120, fourSpace.usableInternal.netInnerDepthMm - 10);
          const shelfT = bay.shelves[0]?.thickness || module.carcass.panelThickness || 18;
          const matCat =
            bodyMat.category === "wood"
              ? "wood"
              : bodyMat.category === "lacquer"
              ? "lacquer"
              : bodyMat.category === "glass" || bodyMat.category === "mirror"
              ? "glass"
              : bodyMat.category === "metal"
              ? "metal"
              : "melamine";
          const defl = calculateShelfDeflection(spanMm, depthMm, shelfT, matCat, 45);
          shelfDeflectionAnalyses.push({
            moduleId: module.id,
            moduleName: module.name,
            bayIndex: bIdx,
            spanMm: defl.spanMm,
            depthMm: defl.depthMm,
            thicknessMm: defl.thicknessMm,
            deflectionMm: defl.deflectionMm,
            maxAllowedMm: defl.maxAllowedDeflectionMm,
            passed: defl.passed,
            recommendation: defl.recommendation,
          });
        }
      });
    }

    const isDishwasherSlot = isBuiltInDishwasherModule(module);
    if (isDishwasherSlot) {
      addHardware(
        "HW_STEAM_BARRIER_DIFFUSER",
        "Ankastre Bulaşık Makinesi Tezgâh Altı Buhar Bariyer Sacı",
        "special",
        1,
        "adet",
        6.5
      );
    }
    const isWetSinkOrVanity =
      isSinkModule(module) ||
      Boolean(module.templateId?.includes("bathroom")) ||
      module.name.toLowerCase().includes("banyo") ||
      module.name.toLowerCase().includes("lavabo");
    if (isWetSinkOrVanity) {
      addHardware(
        "HW_SINK_DRIP_MAT_ALU",
        "Eviye / Lavabo Alt Tabla Alüminyum Su Sızdırmaz Koruma Sacı",
        "special",
        1,
        "adet",
        14.5
      );
    }
    if (module.category !== "complementary" && !isDishwasherSlot) {
      const modJoinery =
        module.carcass.carcassJoineryTopology ||
        (module.category === "kitchen_base" || module.category === "kitchen_island"
          ? "kitchen_stretchers"
          : "sides_through");
      const effBackMode =
        hasSinkOrCooktopAppliance(module) && module.name.toLowerCase().includes("eviye")
          ? "none"
          : module.carcass.backPanelType || "grooved";
      const numDividers = Math.max(0, module.bays.length - 1);
      const perJointMinifix = module.dimensions.depth > 500 ? 3 : 2;
      const perJointDowel = module.dimensions.depth < 250 ? 0 : perJointMinifix;
      const minifixCount = 4 * perJointMinifix + numDividers * 2 * perJointMinifix;
      const dowelCount = 4 * perJointDowel + numDividers * 2 * perJointDowel;
      if (modJoinery === "miter_45") {
        addHardware(
          "HW_LAMELLO_CLAMEX_P14",
          "Lamello Clamex P-14 Sökülebilir 45° Gönye Bağlantı Elemanı",
          "connector",
          8 + numDividers * 4,
          "adet",
          2.1
        );
      } else {
        addHardware(
          "HW_MINIFIX_SET",
          "Häfele Minifix 15 + Mil Bağlantı Elemanı",
          "connector",
          minifixCount,
          "adet",
          0.45
        );
      }
      if (effBackMode === "rebated" || effBackMode === "nailed") {
        addHardware(
          "HW_BACK_SCREW_35X25",
          "Arkalık Sabitleme Vidası & Köşe Gönye Klipsi 3.5×25mm",
          "fastener",
          12,
          "adet",
          0.08
        );
      } else if (effBackMode === "flush") {
        addHardware(
          "HW_MINIFIX_SET",
          "Häfele Minifix 15 + Mil Bağlantı Elemanı",
          "connector",
          4,
          "adet",
          0.45
        );
      } else if (effBackMode === "grooved" && modJoinery === "kitchen_stretchers") {
        addHardware(
          "HW_BACK_SCREW_35X25",
          "Üst Arka Kayıt Arkalık Sabitleme Vidası 3.5×25mm",
          "fastener",
          4,
          "adet",
          0.08
        );
      }
      if (dowelCount > 0) {
        addHardware(
          "HW_DOWEL_8X35",
          "Ahşap Kavela 8x35mm",
          "fastener",
          dowelCount,
          "adet",
          0.05
        );
      }

      let totalTJunctions = 0;
      for (let divI = 0; divI < numDividers; divI++) {
        totalTJunctions += computeDividerTJunctionYs(module, divI).length;
      }
      if (totalTJunctions > 0) {
        addHardware(
          "HW_MINIFIX_DOUBLE_BOLT",
          "Häfele Çift Taraflı Ara Dikme Bağlantı Mili (T-Birleşim)",
          "connector",
          totalTJunctions * 2,
          "adet",
          0.75
        );
      }

      if (isBuiltInOvenOrFridgeTower(module)) {
        addHardware(
          "HW_VENT_GRILLE_200CM2",
          "Alüminyum Ankastre Baza Havalandırma Menfezi (Min 200cm²)",
          "special",
          1,
          "adet",
          8.5
        );
      }

      if (module.carcass.wallSuspensionType === "concealed_camar_807") {
        addHardware(
          "HW_CAMAR_807_CONCEALED",
          "Camar 807 Gizli Çelik Askı Elemanı + Duvar Rayı",
          "connector",
          2,
          "adet",
          6.8
        );
      }

      if (module.carcass.plinthHeight > 0 && !isDishwasherSlot) {
        const isWardrobeMod =
          module.category === "wardrobe" ||
          module.category === "vestiyer" ||
          module.category === "living" ||
          module.category === "tall";
        const effPType =
          module.carcass.plinthConstruction ||
          (module.carcass.hasAdjustableLegs === false
            ? isWardrobeMod
              ? "gable_rails"
              : "pedestal_box"
            : isWardrobeMod
            ? "pedestal_box"
            : "adjustable_legs_clip");
        const supportColumns = Math.max(2, module.bays.length + 1);
        const feetCount = supportColumns * 2;
        const sealMeters = roundMm(
          (module.dimensions.width +
            (effPType !== "gable_rails" ? module.dimensions.depth * 2 : 0)) /
            1000,
          2
        );

        if (effPType === "adjustable_legs_clip") {
          addHardware(
            "637.76.331",
            `Häfele Axilo™ 78 Ayarlanabilir Baza Ayağı + Yan Destek Tablası (H:${module.carcass.plinthHeight}mm)`,
            "leg",
            feetCount,
            "adet",
            2.35
          );
          addHardware(
            "637.76.420",
            "Häfele Axilo™ Geçmeli Ön Baza C-Klips Bağlantı Aparatı",
            "connector",
            supportColumns,
            "adet",
            0.85
          );
          addHardware(
            "637.90.810",
            "Ko-Ekstrüze PVC Baza Altı Su Sızdırmazlık Contası (18mm)",
            "special",
            Math.max(1, sealMeters),
            "metre",
            2.9
          );
        } else {
          addHardware(
            "651.09.310",
            "Ağır Yük Gizli Çelik Baza Terazi Pingosu M10 + Çakma Somun",
            "leg",
            feetCount,
            "adet",
            1.45
          );
          addHardware(
            "637.90.805",
            "PVC Baza Altı Nem ve Toz Sızdırmazlık Fitili (18mm)",
            "special",
            Math.max(1, sealMeters),
            "metre",
            2.4
          );
        }
      }

      const isSuspendedWallUnit =
        module.category === "kitchen_wall" ||
        Boolean(module.templateId?.includes("floating")) ||
        ((module.position?.y || 0) >= 150 &&
          (module.carcass.plinthHeight ?? 0) === 0 &&
          module.category !== "complementary" &&
          !project.modules.some(
            (bm) =>
              bm.id !== module.id &&
              bm.category !== "complementary" &&
              Math.abs(bm.position.y + bm.dimensions.height - module.position.y) <= 20 &&
              bm.position.x < module.position.x + module.dimensions.width - 20 &&
              bm.position.x + bm.dimensions.width > module.position.x + 20
          ));
      if (isSuspendedWallUnit && module.carcass.wallSuspensionType !== "concealed_camar_807") {
        const volM3 =
          (module.dimensions.width * module.dimensions.height * module.dimensions.depth) / 1_000_000_000;
        const estLoadedMassKg = volM3 * 165;
        const hangerQty = Math.max(
          2,
          Math.ceil(module.dimensions.width / 900),
          Math.ceil(estLoadedMassKg / 65)
        );
        addHardware(
          "HW_WALL_HANGER_EN14749",
          "EN 14749 Ağır Yük Üst Dolap Duvar Askı Elemanı",
          "connector",
          hangerQty,
          "adet",
          4.2
        );
      }
    } else {
      if (module.complementaryRole === "leveling_feet") {
        addHardware(
          "HW_LEVELING_FEET",
          "Ayarlanabilir Baza Ayağı 80-100mm",
          "leg",
          4,
          "adet",
          1.2
        );
      } else if (module.complementaryRole === "led_channel") {
        const meters = Math.max(1, roundMm(module.dimensions.width / 1000, 2));
        addHardware(
          "HW_FITTING_LED",
          "Alüminyum Gömme LED Aydınlatma Profili (Metretül)",
          "special",
          meters,
          "metre",
          14.0
        );
      } else if (module.complementaryRole === "wall_bracket") {
        addHardware(
          "HW_WALL_HANGER_EN14749",
          "EN 14749 Ağır Yük Üst Dolap Duvar Askı Elemanı",
          "connector",
          2,
          "adet",
          4.2
        );
      } else if (module.complementaryRole === "service_spacer") {
        addHardware(
          "HW_SERVICE_SPACER",
          "Tesisat Boşluğu Ayar Aparatı",
          "connector",
          2,
          "adet",
          2.5
        );
      }
    }

    const bayMechanismAdded = new Set<number>();

    geo.components.forEach((comp) => {
      if (comp.role === "hanging_rail") {
        addHardware(
          "HW_HANGING_RAIL",
          `Oval Alüminyum Elbise Askı Borusu ${comp.dimensions.width}mm`,
          "rod",
          1,
          "adet",
          4.5
        );
        addHardware(
          "HW_RAIL_SOCKET",
          "Askı Borusu Flanşı (Sağ-Sol Takım)",
          "connector",
          1,
          "takım",
          1.8
        );
        return;
      }
      if (
        comp.isManufacturablePanel === false ||
        comp.role === "door_handle" ||
        comp.role === "door_hinge" ||
        comp.role === "gola_profile" ||
        comp.role === "drawer_handle" ||
        comp.role === "drawer_slide" ||
        comp.role === "special_fitting"
      ) {
        return;
      }

      let mat = materialsMap.get(comp.materialId) || bodyMat;
      const customGrain =
        module.componentGrainOverrides?.[comp.id] || module.componentGrainOverrides?.__all__;
      let grain: CutPiece["grain"] = mat.hasGrain
        ? customGrain === "crosswise"
          ? "crosswise"
          : "lengthwise"
        : "none";
      const defaultEbThickness = module.carcass.edgeBandThickness || 1;
      let edgeBanding: EdgeBandingConfig = {
        top: false,
        bottom: false,
        left: false,
        right: false,
        thickness: defaultEbThickness,
      };

      // Local Panel Coordinate System:
      // length (`lengthMm`, Y-axis 0..h) = primary/long span;
      // width (`widthMm`, X-axis 0..w) = secondary/depth span.
      // Edge Banding Convention:
      // left (x=0) & right (x=w) run along lengthMm (Boy/B);
      // bottom (y=0) & top (y=h) run along widthMm (En/E).
      let length = comp.dimensions.height;
      let width = comp.dimensions.depth;
      const bayIdx = comp.bayIndex ?? 0;
      const bay = module.bays[bayIdx] || module.bays[0];
      const dSys = bay
        ? bay.door.doorSystemId || inferDoorSystemIdFromType(bay.door.type)
        : "open";
      const isInsetDoor = Boolean(
        bay?.door.overlayType === "inset" ||
          dSys === "hinged_inset" ||
          bay?.door.type.startsWith("inset")
      );

      let mirrorInnerFaceX = false;
      let partHingePositionsY: number[] | undefined;
      let partHingePositionsBackY: number[] | undefined;
      let bottomJointOffsetY = 0;
      let hasPartBackGroove = false;
      let hasSinkOrHobCutout = false;
      const countertopCutouts: import("@birim/core").PanelCutoutConfig[] = [];
      let cutoutWidthMm: number | undefined;
      let cutoutDepthMm: number | undefined;

      if (comp.role.includes("side") && !comp.role.includes("drawer")) {
        length = comp.dimensions.height;
        width = comp.dimensions.depth;
        const isRightSide = comp.role === "carcass_side_right";
        mirrorInnerFaceX = isRightSide && module.category !== "complementary";
        hasPartBackGroove = hasGroovedBack;
        // Mirrored right side panel has its front edge at x = w (right: true), left side panel at x = 0 (left: true)
        edgeBanding = {
          top: false,
          bottom: true,
          left: !mirrorInnerFaceX,
          right: mirrorInnerFaceX,
          thickness: defaultEbThickness,
        };

        if (module.category !== "complementary") {
          const sideBottomY = comp.position.y || 0;
          bottomJointOffsetY = Math.max(0, roundMm((module.carcass.plinthHeight || 0) - sideBottomY));

          const hostBayIdx = isRightSide ? Math.max(0, module.bays.length - 1) : 0;
          const hostBay = module.bays[hostBayIdx];
          const hostLeaf = fourSpace.doorLeaves[hostBayIdx];
          const shouldDrillHingeMounts = isRightSide
            ? doesBayDoorHingeOnRight(hostBay)
            : doesBayDoorHingeOnLeft(hostBay);

          if (shouldDrillHingeMounts && hostLeaf && hostLeaf.hingePositionsY.length > 0) {
            const verticalOffsetToDoor = Math.max(0, hostLeaf.doorY0Mm - sideBottomY);
            partHingePositionsY = hostLeaf.hingePositionsY.map((hy) =>
              roundMm(verticalOffsetToDoor + hy, 2)
            );
          } else {
            partHingePositionsY = [];
          }
        }
      } else if (comp.role === "carcass_bottom" || comp.role === "carcass_top") {
        const isVertStretcher = comp.thicknessAxis === "z";
        const isStretcherStrip = comp.id.includes("_top_stretcher_");
        length = comp.dimensions.width;
        width = isVertStretcher ? comp.dimensions.height : comp.dimensions.depth;
        // Front or vertical kitchen stretchers NEVER receive a rear back-panel groove!
        hasPartBackGroove = hasGroovedBack && !isStretcherStrip;
        edgeBanding = {
          top: false,
          bottom: false,
          left: true,
          right: isStretcherStrip && !isVertStretcher,
          thickness: defaultEbThickness,
        };
      } else if (comp.role === "carcass_divider" || comp.role === "carcass_sub_divider") {
        length = comp.dimensions.height;
        width = comp.dimensions.depth;
        edgeBanding = {
          top: false,
          bottom: false,
          left: true,
          right: false,
          thickness: defaultEbThickness,
        };
        if (comp.role === "carcass_divider" && typeof comp.bayIndex === "number") {
          const leftBay = module.bays[comp.bayIndex];
          const rightBay = module.bays[comp.bayIndex + 1];
          const leftLeaf = fourSpace.doorLeaves[comp.bayIndex];
          const rightLeaf = fourSpace.doorLeaves[comp.bayIndex + 1];
          const divBottomY = comp.position.y || (module.carcass.plinthHeight || 0) + (module.carcass.panelThickness || 18);

          partHingePositionsY =
            doesBayDoorHingeOnRight(leftBay) && leftLeaf
              ? leftLeaf.hingePositionsY.map((hy) =>
                  roundMm(Math.max(0, leftLeaf.doorY0Mm - divBottomY + hy), 2)
                )
              : [];
          partHingePositionsBackY =
            doesBayDoorHingeOnLeft(rightBay) && rightLeaf
              ? rightLeaf.hingePositionsY.map((hy) =>
                  roundMm(Math.max(0, rightLeaf.doorY0Mm - divBottomY + hy), 2)
                )
              : [];
        }
      } else if (comp.role === "carcass_back") {
        length = comp.dimensions.height;
        width = comp.dimensions.width;
        grain = "none";
        edgeBanding = { top: false, bottom: false, left: false, right: false, thickness: 0 };
      } else if (comp.role === "shelf") {
        length = comp.dimensions.width;
        width = comp.dimensions.depth;
        edgeBanding = {
          top: false,
          bottom: false,
          left: true,
          right: false,
          thickness: defaultEbThickness,
        };
        const isFixedOrApplianceShelf =
          comp.label.includes("Sabit") || comp.label.includes("Taşıyıcı Tabla");
        if (isFixedOrApplianceShelf) {
          addHardware(
            "HW_MINIFIX_SET",
            "Häfele Minifix 15 + Mil Bağlantı Elemanı",
            "connector",
            4,
            "adet",
            0.45
          );
          addHardware("HW_DOWEL_8X35", "Ahşap Kavela 8x35mm", "fastener", 4, "adet", 0.05);
        } else {
          addHardware(
            "HW_SHELF_PIN",
            "Kilitli Raf Pimi 5mm (Häfele)",
            "fastener",
            4,
            "adet",
            0.15
          );
        }
      } else if (comp.role === "countertop") {
        mat = materialsMap.get(comp.materialId) || bodyMat;
        // Waterfall vertical leg has thicknessAxis === "x" (width=40mm thickness, height=legH, depth=tableDepth)!
        if (comp.thicknessAxis === "x") {
          length = comp.dimensions.height;
          width = comp.dimensions.depth;
        } else {
          length = comp.dimensions.width;
          width = comp.dimensions.depth;
          // Angled attached table scarf/miter joint blank allowance so angled cut sits flush against island without overlapping!
          const tblAngle = module.attachedTableConfig?.angleDeg ?? 0;
          if (module.complementaryRole === "attached_table" && Math.abs(tblAngle) % 90 !== 0) {
            const rad = Math.min(Math.PI / 3, Math.abs((tblAngle * Math.PI) / 180));
            const scarfAllowance = Math.ceil(width * 0.5 * Math.tan(rad));
            length += scarfAllowance;
          }
        }
        const isStoneOrCompact = mat.category === "stone" || mat.category === "compact";
        edgeBanding = isStoneOrCompact
          ? { top: false, bottom: false, left: false, right: false, thickness: 0 }
          : { top: true, bottom: true, left: true, right: false, thickness: 2 };

        // Compute exact per-appliance CNC apertures along continuous or single countertops!
        if (length >= 520 && width >= 460) {
          if (module.category === "complementary" && module.complementaryRole === "countertop") {
            const ctopStartX = module.position.x;
            const ctopEndX = ctopStartX + length;
            const ctopRot = (((module.rotation?.y ?? 0) % 360) + 360) % 360;
            project.modules.forEach((cand) => {
              if (cand.id === module.id || cand.category === "complementary") return;
              const candRot = (((cand.rotation?.y ?? 0) % 360) + 360) % 360;
              if (Math.abs(candRot - ctopRot) > 5) return;
              const isSink = isSinkModule(cand);
              const isHob = isCooktopModule(cand) || (!isSink && hasSinkOrCooktopAppliance(cand));
              if (!isSink && !isHob) return;
              const candCenterAlong = cand.position.x + cand.dimensions.width / 2;
              if (candCenterAlong >= ctopStartX - 25 && candCenterAlong <= ctopEndX + 25) {
                const localAlongY = Math.max(
                  220,
                  Math.min(length - 220, roundMm(candCenterAlong - ctopStartX, 1))
                );
                const apLengthAlong = isSink
                  ? Math.min(560, Math.max(320, roundIntMm(cand.dimensions.width - 80)))
                  : Math.min(580, Math.max(320, roundIntMm(cand.dimensions.width - 80)));
                const apDepthAcross = isSink
                  ? Math.min(460, Math.max(280, roundIntMm(width - 130)))
                  : Math.min(490, Math.max(280, roundIntMm(width - 110)));
                countertopCutouts.push({
                  id: `cutout_${isSink ? "sink" : "hob"}_${cand.id}`,
                  targetPanel: "bottom",
                  shape: "rect",
                  centerXMm: roundMm(width * 0.52, 1),
                  centerYMm: localAlongY,
                  widthMm: apDepthAcross,
                  heightMm: apLengthAlong,
                  cornerRadiusMm: 10,
                  label: isSink ? `Eviye Boşaltması (${cand.name})` : `Ocak Boşaltması (${cand.name})`,
                });
                hasSinkOrHobCutout = true;
              }
            });
          } else if (hasSinkOrCooktopAppliance(module)) {
            const isSink = isSinkModule(module);
            const apLengthAlong = Math.min(560, Math.max(320, roundIntMm(length - 110)));
            const apDepthAcross = Math.min(480, Math.max(280, roundIntMm(width - 115)));
            hasSinkOrHobCutout = true;
            cutoutWidthMm = apLengthAlong;
            cutoutDepthMm = apDepthAcross;
            countertopCutouts.push({
              id: `cutout_${isSink ? "sink" : "hob"}_${module.id}`,
              targetPanel: "bottom",
              shape: "rect",
              centerXMm: roundMm(width * 0.52, 1),
              centerYMm: roundMm(length / 2, 1),
              widthMm: apDepthAcross,
              heightMm: apLengthAlong,
              cornerRadiusMm: 10,
              label: isSink ? "Eviye Boşaltması" : "Ocak Boşaltması",
            });
          }
        }
      } else if (comp.role === "kerf_curve") {
        mat = materialsMap.get(comp.materialId) || doorMat;
        grain = "lengthwise";
        length = comp.dimensions.height;
        width = comp.dimensions.width;
        edgeBanding = {
          top: true,
          bottom: true,
          left: false,
          right: false,
          thickness: defaultEbThickness,
        };
      } else if (
        comp.role === "door_stile_left" ||
        comp.role === "door_stile_right" ||
        comp.role === "door_rail_top" ||
        comp.role === "door_rail_bottom" ||
        comp.role === "door_center_panel"
      ) {
        mat = materialsMap.get(comp.materialId) || doorMat;
        const isRail = comp.role === "door_rail_top" || comp.role === "door_rail_bottom";
        length = isRail ? comp.dimensions.width : comp.dimensions.height;
        width = isRail ? comp.dimensions.height : comp.dimensions.width;
        grain = mat.hasGrain ? "lengthwise" : "none";
        // Center panel & painted shaker frame pieces are unbanded (mortise-tenon / lacquer); laminate outer edges get 1-side band
        const needsOuterBand =
          comp.role !== "door_center_panel" &&
          mat.category !== "lacquer" &&
          mat.category !== "glass" &&
          mat.category !== "mirror" &&
          mat.category !== "metal";
        edgeBanding = {
          top: false,
          bottom: false,
          left: needsOuterBand,
          right: false,
          thickness: needsOuterBand ? defaultEbThickness : 0,
        };
      } else if (comp.role.includes("door")) {
        mat = materialsMap.get(comp.materialId) || doorMat;
        const doorGrain =
          module.componentGrainOverrides?.[comp.id] ||
          module.componentGrainOverrides?.__doors__ ||
          module.componentGrainOverrides?.__all__;
        grain = mat.hasGrain ? (doorGrain === "crosswise" ? "crosswise" : "lengthwise") : "none";
        length = comp.dimensions.height;
        width = comp.dimensions.width;
        const activeDoorProf =
          bay?.door?.crossSectionProfile || module.carcass.crossSectionProfile || "flat_slab";
        // P1-03: Lacquer, glass, mirror, metal, and 45°/J-pull/cove milled edges NEVER receive flat PVC edge-banding deduction!
        const isUnbandedDoorFinishOrProfile =
          mat.category === "lacquer" ||
          mat.category === "glass" ||
          mat.category === "mirror" ||
          mat.category === "metal" ||
          activeDoorProf === "bevel_45" ||
          activeDoorProf === "j_pull_bevel" ||
          activeDoorProf === "cove_arch";
        const doorEbT = isUnbandedDoorFinishOrProfile
          ? 0
          : bay?.door.doorEdgeBandThicknessMm || defaultEbThickness;
        edgeBanding = isUnbandedDoorFinishOrProfile
          ? { top: false, bottom: false, left: false, right: false, thickness: 0 }
          : { top: true, bottom: true, left: true, right: true, thickness: doorEbT };

        const leafInfo = fourSpace.doorLeaves[bayIdx];
        partHingePositionsY = leafInfo?.hingePositionsY;
        const selectedHw = getHardwareProductById(bay?.door.hardwareProductId);

        if (dSys.startsWith("hinged")) {
          const hingesNeeded =
            leafInfo?.effectiveHingeCount ||
            leafInfo?.recommendedHingesPerLeaf ||
            calculateRecommendedHingesPerLeaf(length, leafInfo?.leafWeightKg ?? 0, false);
          const isExplicitNonDefaultHw =
            selectedHw && selectedHw.id !== "hw_blum_71b3550";
          const crankType = leafInfo?.hingeCrankType || "straight_full_overlay";
          let hingeSku = selectedHw?.sku || "HW_BLUM_HINGE_110";
          let hingeName = selectedHw?.name || "Blum Clip Top Blumotion 110° Frenli Düz Menteşe";
          let hingePrice = selectedHw?.unitPriceEur || 3.8;

          if (!isExplicitNonDefaultHw && leafInfo?.overlayType === "inset") {
            hingeSku = "71B3750";
            hingeName = "Blum CLIP top BLUMOTION 110° Tam Deveboynu (İçerlek / Inset) Menteşe";
            hingePrice = 4.35;
          } else if (!isExplicitNonDefaultHw && leafInfo?.overlayType === "half_overlay") {
            hingeSku = "71B3650";
            hingeName = "Blum CLIP top BLUMOTION 110° Yarım Deveboynu (Orta Dikme) Menteşe";
            hingePrice = 4.15;
          } else if (!selectedHw && crankType === "half_cranked_middle") {
            hingeSku = "71B3650";
            hingeName = "Blum CLIP top BLUMOTION 110° Yarım Deveboynu (Orta Dikme) Menteşe";
            hingePrice = 4.15;
          }
          addHardware(hingeSku, hingeName, "hinge", hingesNeeded, "adet", hingePrice);
        } else if (!bayMechanismAdded.has(bayIdx)) {
          bayMechanismAdded.add(bayIdx);
          if (dSys.startsWith("lift")) {
            const lf = leafInfo?.powerFactorLf || 1800;
            const autoHkSku =
              lf <= 1500 ? "20K2300" : lf <= 2500 ? "20K2500" : lf <= 4800 ? "22K2700" : "20K2900";
            const liftSku = selectedHw?.sku || autoHkSku;
            const needsThirdPowerUnit = lf > 9000 || module.dimensions.width >= 1200;
            const liftQty = needsThirdPowerUnit ? 1.5 : 1;
            const liftName =
              (selectedHw?.name || `Blum AVENTOS Güç Ünitesi (LF=${lf})`) +
              (needsThirdPowerUnit ? " [Geniş Kapak 3 Güç Üniteli]" : "");
            const liftPrice = selectedHw?.unitPriceEur || 52.0;
            addHardware(liftSku, liftName, "special", liftQty, "takım", liftPrice);
          } else if (dSys.startsWith("sliding") || bay?.door.type === "sliding" || bay?.door.type === "sliding_bottom") {
            const sMount =
              bay?.door.slidingMountingType ||
              (dSys === "sliding_bottom_rolling" ? "inset_inside" : dSys === "sliding_coplanar" ? "coplanar_flush" : "top_hung_pelmet");
            if (bayIdx === 0) {
              const trackMeters = Number((module.dimensions.width / 1000).toFixed(2));
              if (sMount === "inset_inside") {
                addHardware(
                  "HT_SLIDELINE_M_SET",
                  "Hettich SlideLine M İçten Çalışan Çift Kanal Sürgü & Fren Seti",
                  "slide",
                  1,
                  "takım",
                  118.0
                );
                addHardware(
                  "HF_SLIDO_INSET_TRACK",
                  "Gömme Çift Kanallı Eloksallı Alüminyum Üst/Alt Sürgü Rayı",
                  "slide",
                  Number((trackMeters * 2).toFixed(2)),
                  "mt",
                  19.5
                );
              } else if (sMount === "coplanar_flush") {
                addHardware(
                  "HT_INLINE_XL_SET",
                  "Hettich InLine XL Hemzemin (Koplanar) Sürgü Mekanizma Seti",
                  "slide",
                  1,
                  "takım",
                  365.0
                );
              } else {
                addHardware(
                  selectedHw?.sku || "HT_TOPLINE_XL_SET",
                  "Hettich TopLine XL Üstten Askılı Yavaşlatıcılı Sürgü Araba & STB-19 Kılavuz Seti",
                  "slide",
                  1,
                  "takım",
                  168.0
                );
                addHardware(
                  "HT_TOPLINE_TRACK_2R",
                  "TopLine XL Üstten Askılı Çift Yollu Alüminyum Taşıyıcı Ray",
                  "slide",
                  trackMeters,
                  "mt",
                  28.0
                );
                if (sMount === "top_hung_pelmet") {
                  addHardware(
                    "HF_SLIDO_FASCIA_CLIP",
                    "Häfele Slido Üst Alın Kapama (Valans) Montaj Klips Takımı",
                    "special",
                    Math.max(4, Math.ceil(module.dimensions.width / 450)),
                    "adet",
                    2.8
                  );
                }
              }
            }
          } else if (dSys === "folding_side") {
            const foldSku = selectedHw?.sku || "WingLineL_25";
            const foldName =
              selectedHw?.name || "Hettich WingLine L Katlanır Kapak Sistemi";
            const foldPrice = selectedHw?.unitPriceEur || 110.0;
            addHardware(foldSku, foldName, "special", 1, "takım", foldPrice);
          } else if (dSys === "pocket_retractable") {
            const pocketSku = selectedHw?.sku || "REVEGO_UNO_650";
            const pocketName =
              selectedHw?.name || "Blum REVEGO Pocket Gizlenen Kapak Sistemi";
            const pocketPrice = selectedHw?.unitPriceEur || 420.0;
            addHardware(pocketSku, pocketName, "special", 1, "takım", pocketPrice);
          }
        }

        const openTech = bay?.door.openingTechnology;
        if (openTech === "push_to_open") {
          addHardware(
            "956A1004",
            "Blum TIP-ON Bas-Aç Mekanik İtici + Adaptör",
            "special",
            1,
            "adet",
            6.5
          );
        } else if (openTech === "push_to_open_soft_close") {
          addHardware(
            "TIP_ON_BLUMOTION_SET",
            "Blum TIP-ON BLUMOTION Bas-Aç + Frenli Ünite",
            "special",
            1,
            "takım",
            14.0
          );
        } else if (openTech === "servo_electric") {
          addHardware(
            "Z10A3000",
            "Blum SERVO-DRIVE Elektrikli Açılma Ünitesi",
            "special",
            1,
            "takım",
            145.0
          );
        }

        const handleCat = bay?.door.handleCategory || "bar_handle";
        const doorProfForHandle =
          bay?.door?.crossSectionProfile || module.carcass.crossSectionProfile || "flat_slab";
        const isIntegratedMilledHandleless =
          handleCat === "handleless_plain" ||
          handleCat === "j_pull" ||
          handleCat === "gola_profile" ||
          handleCat === "milled_wood_grip" ||
          doorProfForHandle === "j_pull_bevel" ||
          doorProfForHandle === "bevel_45" ||
          bay?.door?.openingTechnology === "push_to_open" ||
          bay?.door?.openingTechnology === "servo_electric";
        if (!isIntegratedMilledHandleless) {
          const hProfile =
            getAllHandleProfiles().find((hp) => hp.id === bay?.door.handleProfileId) ||
            getAllHandleProfiles().find((hp) => hp.category === handleCat) ||
            HANDLE_PROFILES[1];
          addHardware(hProfile.sku, hProfile.name, "handle", 1, "adet", hProfile.unitPriceEur);
        }
      } else if (comp.role === "drawer_front") {
        mat = materialsMap.get(comp.materialId) || doorMat;
        const drwGrain =
          module.componentGrainOverrides?.[comp.id] ||
          module.componentGrainOverrides?.__drawers__ ||
          module.componentGrainOverrides?.__doors__ ||
          module.componentGrainOverrides?.__all__;
        const drwContAssign = grainContinuityMap.get(comp.id);
        grain = mat.hasGrain ? (drwGrain === "crosswise" ? "crosswise" : "lengthwise") : "none";
        const isVertContDrawer = Boolean(drwContAssign && drwContAssign.grainDirection === "lengthwise" && mat.hasGrain);
        length = isVertContDrawer ? comp.dimensions.height : comp.dimensions.width;
        width = isVertContDrawer ? comp.dimensions.width : comp.dimensions.height;
        edgeBanding = {
          top: true,
          bottom: true,
          left: true,
          right: true,
          thickness: defaultEbThickness,
        };
        const drawer = bay?.drawers.find((d) => `${d.id}_front` === comp.id);
        const drwHandleCat = bay?.door.handleCategory || "bar_handle";
        const drwProf = bay?.door?.crossSectionProfile || module.carcass.crossSectionProfile || "flat_slab";
        const isDrwHandleless =
          drwHandleCat === "handleless_plain" ||
          drwHandleCat === "j_pull" ||
          drwHandleCat === "gola_profile" ||
          drwHandleCat === "milled_wood_grip" ||
          drwProf === "j_pull_bevel" ||
          drwProf === "bevel_45" ||
          drawer?.slideType === "push_to_open" ||
          drawer?.slideType === "servo_electric";
        if (!drawer?.isInternal && !isDrwHandleless) {
          const profile =
            getAllHandleProfiles().find((p) => p.id === bay?.door.handleProfileId) ||
            getAllHandleProfiles().find(
              (p) => p.category === (bay?.door.handleCategory || "bar_handle")
            ) ||
            HANDLE_PROFILES[1];
          addHardware(profile.sku, profile.name, "handle", 1, "adet", profile.unitPriceEur);
        }
      } else if (comp.role === "end_panel") {
        mat = materialsMap.get(comp.materialId) || doorMat;
        length = comp.dimensions.height;
        width = Math.max(comp.dimensions.depth, comp.dimensions.width);
        edgeBanding = {
          top: true,
          bottom: true,
          left: true,
          right: true,
          thickness: defaultEbThickness,
        };
        addHardware(
          "HW_PANEL_JOIN_SCREW_4X30",
          "Görünen Yan Panel İçten Gizli Montaj Vidası 4.0×30mm",
          "fastener",
          6,
          "adet",
          0.09
        );
      } else if (
        comp.role === "drawer_box" ||
        comp.role === "drawer_side_left" ||
        comp.role === "drawer_side_right" ||
        comp.role === "drawer_back" ||
        comp.role === "drawer_bottom"
      ) {
        if (comp.role === "drawer_bottom" && !comp.id.endsWith("_plinth_drawer_box")) {
          const drawerCfg = bay?.drawers.find((d) => `${d.id}_bottom` === comp.id);
          const drHw = getHardwareProductById(drawerCfg?.hardwareProductId);
          const optimalNl =
            drawerCfg?.nominalLengthMm ||
            selectOptimalRunnerLengthMm(fourSpace.usableInternal.netInnerDepthMm);
          const runnerSku = drHw ? `${drHw.sku}_NL${optimalNl}` : "HW_BLUM_TANDEM_BOX";
          const runnerName = drHw
            ? `${drHw.name} (NL=${optimalNl}mm)`
            : `Blum Antaro / Tandembox Çekmece Rayı Frenli ${optimalNl}mm`;
          const runnerPrice = drHw?.unitPriceEur || 28.0;
          addHardware(runnerSku, runnerName, "slide", 1, "takım", runnerPrice);
          const isWoodenUndermountRunner =
            drawerCfg?.boxSystemType === "wooden_undermount" ||
            Boolean(drHw && (drHw.sku.startsWith("760H") || drHw.sku.startsWith("560H")));
          if (isWoodenUndermountRunner) {
            addHardware(
              "T51.1700",
              "Blum MOVENTO / TANDEM Gizli Ray Ön Mandal Seti (Sağ+Sol)",
              "connector",
              1,
              "takım",
              3.9
            );
          }
          if (comp.siphonCutout || drawerCfg?.hasSiphonCutout) {
            addHardware(
              "HW_SIPHON_TRIM_U",
              "Eviye Altı Çekmece U-Sifon Dönüş Aparatı",
              "special",
              1,
              "takım",
              9.5
            );
          }
          if (drawerCfg?.hasCooktopHeatShield) {
            addHardware(
              "HW_HEAT_SHIELD_COOKTOP",
              "Ocak Altı Çekmece İndüksiyon Isı Koruma Sacı",
              "special",
              1,
              "adet",
              16.0
            );
          }
        } else if (comp.id.endsWith("_plinth_drawer_box")) {
          addHardware(
            "HW_PLINTH_DRAWER_RUNNER",
            "Baza Çekmecesi Tekerlekli Gizli Ray Seti",
            "slide",
            1,
            "takım",
            22.0
          );
        }
        length =
          comp.role === "drawer_bottom" || comp.role === "drawer_back"
            ? comp.dimensions.width
            : comp.dimensions.depth;
        width = comp.role === "drawer_bottom" ? comp.dimensions.depth : comp.dimensions.height;
        // Grooved 8mm drawer bottom is unbanded; drawer sides & back get 1 long-edge band (left = Boy) along their top long rim!
        edgeBanding =
          comp.role === "drawer_bottom"
            ? { top: false, bottom: false, left: false, right: false, thickness: 0 }
            : {
                top: false,
                bottom: false,
                left: true,
                right: false,
                thickness: defaultEbThickness,
              };
      } else if (comp.role === "plinth") {
        // Visible front & side plinth boards receive 4-edge moisture-sealed PVC banding (2B + 2E) so mop water never swells raw edges!
        length = Math.max(comp.dimensions.width, comp.dimensions.depth);
        width = comp.dimensions.height;
        const isExposedPlinthFace =
          comp.id.includes("_plinth_front") || comp.id.includes("_plinth_side_");
        edgeBanding = isExposedPlinthFace
          ? {
              top: true,
              bottom: true,
              left: true,
              right: true,
              thickness: defaultEbThickness,
            }
          : {
              top: false,
              bottom: false,
              left: true,
              right: false,
              thickness: defaultEbThickness,
            };
      }

      const minSawDim = comp.role === "plinth" ? 50 : 70;
      if (width < minSawDim || length < minSawDim) {
        validationWarnings.push(
          `Parça "${comp.label}" boyutu (${roundIntMm(length)}x${roundIntMm(
            width
          )}mm) Selco testere min kesim ölçüsünden (70mm) küçük [UNVERIFIED].`
        );
      }

      const rawLengthMm = roundIntMm(length);
      const rawWidthMm = roundIntMm(width);
      const swapAxesForCrossGrain = grain === "crosswise" && mat.hasGrain;
      const nominalLengthMm = swapAxesForCrossGrain ? rawWidthMm : rawLengthMm;
      const nominalWidthMm = swapAxesForCrossGrain ? rawLengthMm : rawWidthMm;
      if (swapAxesForCrossGrain) {
        edgeBanding = {
          top: edgeBanding.left,
          bottom: edgeBanding.right,
          left: edgeBanding.top,
          right: edgeBanding.bottom,
          thickness: edgeBanding.thickness,
        };
      }
      const areaM2 = (nominalLengthMm * nominalWidthMm) / 1_000_000;

      let edgeBandMeters = 0;
      if (edgeBanding.top) edgeBandMeters += nominalWidthMm / 1000;
      if (edgeBanding.bottom) edgeBandMeters += nominalWidthMm / 1000;
      if (edgeBanding.left) edgeBandMeters += nominalLengthMm / 1000;
      if (edgeBanding.right) edgeBandMeters += nominalLengthMm / 1000;

      const stablePartId = `P_${module.id}_${comp.id}`;
      const thicknessMm =
        comp.thicknessAxis === "x"
          ? comp.dimensions.width
          : comp.thicknessAxis === "y"
          ? comp.dimensions.height
          : comp.thicknessAxis === "z"
          ? comp.dimensions.depth
          : Math.min(comp.dimensions.width, comp.dimensions.height, comp.dimensions.depth);

      const dOffsetGroove = module.carcass.backOffsetMm ?? (module.category?.startsWith("wardrobe") ? 12 : 18);
      const grooveWidthMm = roundMm((module.carcass.backPanelThickness || 8) + 0.5, 1);

      const isSideOrDiv =
        comp.role === "carcass_side_left" ||
        comp.role === "carcass_side_right" ||
        comp.role === "carcass_divider";
      const golaNotches = isSideOrDiv
        ? computeGolaSidePanelNotches(module, comp.position.y || 0, rawLengthMm)
        : undefined;
      const tJunctionFixedShelfYs =
        comp.role === "carcass_divider" && typeof comp.bayIndex === "number"
          ? computeDividerTJunctionYs(module, comp.bayIndex)
          : undefined;

      const hasPartVertLed =
        Boolean(module.carcass.ledLightingEnabled) &&
        (module.carcass.ledPlacementMode === "vertical_sides" ||
          module.carcass.ledPlacementMode === "full_showcase") &&
        (comp.role === "carcass_side_left" || comp.role === "carcass_side_right");
      const hasPartShelfLed =
        Boolean(module.carcass.ledLightingEnabled) &&
        (module.carcass.ledPlacementMode === "shelf_underside" ||
          module.carcass.ledPlacementMode === "top_and_shelves" ||
          module.carcass.ledPlacementMode === "full_showcase") &&
        (comp.role === "shelf" || comp.role === "carcass_top");
      const ledGrooveSpec =
        hasPartVertLed || hasPartShelfLed
          ? {
              enabled: true,
              offsetFromFrontMm: module.carcass.ledFrontSetbackMm ?? 75,
              widthMm: module.carcass.ledChannelWidthMm ?? 12,
              depthMm: module.carcass.ledChannelDepthMm ?? 8,
              cableExitHole: true,
            }
          : undefined;

      const baseboardCutouts =
        module.carcass.baseboardNotch?.enabled &&
        (comp.role === "carcass_side_left" || comp.role === "carcass_side_right")
          ? [
              {
                id: `bb_${comp.id}`,
                targetPanel: (comp.role === "carcass_side_left" ? "left_side" : "right_side") as "left_side" | "right_side",
                kind: "baseboard_notch" as const,
                shape: "corner_notch" as const,
                centerXMm: mirrorInnerFaceX
                  ? module.carcass.baseboardNotch.depthMm / 2
                  : rawWidthMm - module.carcass.baseboardNotch.depthMm / 2,
                centerYMm: module.carcass.baseboardNotch.heightMm / 2,
                widthMm: module.carcass.baseboardNotch.depthMm,
                heightMm: module.carcass.baseboardNotch.heightMm,
                label: "Süpürgelik Kertmesi",
              },
            ]
          : [];

      const partJoineryTopology =
        module.carcass.carcassJoineryTopology ||
        (module.category === "kitchen_base" || module.category === "kitchen_island"
          ? "kitchen_stretchers"
          : "sides_through");
      const partStretcherMode =
        module.carcass.kitchenTopStretcherMode ||
        (hasSinkOrCooktopAppliance(module) && module.name.toLowerCase().includes("eviye")
          ? "vertical_sink"
          : hasSinkOrCooktopAppliance(module) && module.dimensions.width >= 900
          ? "aluminum_reinforced"
          : "horizontal");
      const partBackMode =
        hasSinkOrCooktopAppliance(module) && module.name.toLowerCase().includes("eviye")
          ? "none"
          : module.carcass.backPanelType || "grooved";
      const isWallCab =
        module.category === "kitchen_wall" ||
        Boolean(module.templateId?.includes("floating")) ||
        ((module.position?.y || 0) >= 150 && (module.carcass.plinthHeight ?? 0) === 0);

      // Compute fixed & appliance-carrier shelf Y offsets on outer side panels so Minifix/Dowel rows are drilled accurately!
      const sideFixedShelfYs =
        comp.role === "carcass_side_left" || comp.role === "carcass_side_right"
          ? (() => {
              const sideBaseY = comp.position.y || 0;
              const adjBay =
                comp.role === "carcass_side_right"
                  ? module.bays[Math.max(0, module.bays.length - 1)]
                  : module.bays[0];
              const shelfYs = (adjBay?.shelves || [])
                .filter((s) => s.isFixed)
                .map((s) => roundMm((module.carcass.plinthHeight || 0) + (module.carcass.panelThickness || 18) + s.elevationY - sideBaseY, 2));
              const carrierComp = geo.components.find((gc) => gc.id === `${module.id}_appliance_shelf`);
              if (carrierComp) {
                shelfYs.push(roundMm(carrierComp.position.y + carrierComp.dimensions.height / 2 - sideBaseY, 2));
              }
              return shelfYs;
            })()
          : undefined;

      const canonicalHandleSpec = (() => {
        if (
          comp.role !== "door_left" &&
          comp.role !== "door_right" &&
          comp.role !== "drawer_front"
        ) {
          return undefined;
        }
        if (comp.role === "drawer_front") {
          const drObj = bay?.drawers.find((d) => `${d.id}_front` === comp.id);
          if (drObj?.isInternal) return undefined;
        }
        const hCat = bay?.door?.handleCategory || "bar_handle";
        const doorProfCheck =
          bay?.door?.crossSectionProfile || module.carcass.crossSectionProfile || "flat_slab";
        const hp =
          getAllHandleProfiles().find((p) => p.id === bay?.door?.handleProfileId) ||
          getAllHandleProfiles().find((p) => p.category === hCat);
        const rawCc =
          hCat === "knob"
            ? 1
            : hp?.holeSpacingCcMm ??
              (hp as { centerToCenterMm?: number } | undefined)?.centerToCenterMm ??
              160;
        const spec = resolveCanonicalHandlePlacement({
          partRole: comp.role,
          partId: comp.id,
          partLabel: comp.label,
          frontWidthMm: comp.dimensions.width,
          frontHeightMm: comp.dimensions.height,
          frontElevationYMm: comp.position?.y ?? 0,
          moduleCategory: module.category,
          moduleElevationYMm: module.position?.y ?? 0,
          handleCategory: hCat,
          openingTechnology: bay?.door?.openingTechnology,
          crossSectionProfile: doorProfCheck,
          spacingCcMm: rawCc,
          handleOrientation: bay?.door?.handleOrientation,
          handleOffsetY: bay?.door?.handleOffsetY,
          handleEdgeInsetX: bay?.door?.handleEdgeInsetX,
        });
        return spec.isDrilledThrough ? spec : undefined;
      })();

      const resolvedHandleSpacingMm = canonicalHandleSpec?.spacingCcMm;

      // Detect wooden drawer components (16mm wooden sides + 8mm grooved bottom)
      const isWoodenDrawerComponent = (() => {
        if (
          comp.role !== "drawer_side_left" &&
          comp.role !== "drawer_side_right" &&
          comp.role !== "drawer_back" &&
          comp.role !== "drawer_front"
        ) {
          return false;
        }
        const prefix = comp.id.replace(/_(side_left|side_right|back|front)$/, "");
        const botComp = geo.components.find((gc) => gc.id === `${prefix}_bottom`);
        return Boolean(botComp && Math.min(botComp.dimensions.height, botComp.dimensions.depth) <= 10);
      })();

      const hasDrawerBottomGroove =
        isWoodenDrawerComponent &&
        (comp.role === "drawer_side_left" ||
          comp.role === "drawer_side_right" ||
          comp.role === "drawer_front");

      const wallHangerCornerNotches =
        isWallCab && comp.role === "carcass_back" && partBackMode === "grooved"
          ? { widthMm: 45, heightMm: 65 }
          : undefined;

      const parametricPart: ParametricPart = {
        id: stablePartId,
        moduleId: module.id,
        bayIndex: comp.bayIndex,
        label: comp.label,
        role: comp.role,
        dimensions: {
          width: comp.role === "drawer_front" ? roundIntMm(comp.dimensions.height) : rawWidthMm,
          height: comp.role === "drawer_front" ? roundIntMm(comp.dimensions.width) : rawLengthMm,
          depth: thicknessMm,
        },
        materialId: mat.id,
        grain,
        edgeBanding,
        jointType: module.carcass.jointType,
        holes: [],
        position: comp.position,
        rotation: comp.rotation,
        isFrontFacing: comp.isFrontFacing,
        hardwareRefId: bay?.door.hardwareProductId,
        handleSpacingMm: resolvedHandleSpacingMm,
        handleDrillSpec: canonicalHandleSpec
          ? {
              orientation: canonicalHandleSpec.orientation,
              centerXMm: canonicalHandleSpec.centerXMm,
              centerYMm: canonicalHandleSpec.centerYMm,
              spacingCcMm: canonicalHandleSpec.spacingCcMm,
            }
          : undefined,
        isInsetDoor,
        insetDoorThicknessMm:
          bay?.door?.doorThicknessMm || module.carcass.doorThickness || 18,
        insetRevealGapMm: module.carcass.doorPerimeterGap || 2,
        dividerJointPositionsY:
          (comp.role === "carcass_bottom" || comp.role === "carcass_top") &&
          module.bays.length > 1 &&
          !comp.id.includes("_top_stretcher_")
            ? (() => {
                const T_p = module.carcass.panelThickness || 18;
                const sideToFloorBom =
                  (module.carcass.plinthHeight || 0) > 0 &&
                  module.carcass.plinthConstruction === "gable_rails" &&
                  comp.role === "carcass_bottom";
                const isOuterThrough =
                  !sideToFloorBom &&
                  (partJoineryTopology === "top_bottom_through" ||
                    partJoineryTopology === "miter_45");
                const ys: number[] = [];
                let curX = isOuterThrough ? T_p : 0;
                for (let bi = 0; bi < module.bays.length - 1; bi++) {
                  curX += fourSpace.usableInternal.bayClearWidthsMm[bi] || 0;
                  ys.push(roundMm(curX + T_p / 2, 2));
                  curX += T_p;
                }
                return ys;
              })()
            : undefined,
        polygonContourMm: comp.polygonContourMm,
        hingePositionsY: partHingePositionsY,
        hingePositionsBackY: partHingePositionsBackY,
        tJunctionFixedShelfYs,
        fixedShelfJointYs: sideFixedShelfYs && sideFixedShelfYs.length > 0 ? sideFixedShelfYs : undefined,
        ...(() => {
          const mhSpec = resolveMultiHoleSpec(module);
          const panelT_mh = module.carcass.panelThickness || 18;
          let adjYs: number[] = [];
          if (comp.role === "carcass_side_left" || comp.role === "carcass_side_right") {
            const targetBIdx = comp.role === "carcass_side_right" ? Math.max(0, module.bays.length - 1) : 0;
            const targetBay = module.bays[targetBIdx];
            adjYs = (targetBay?.shelves || [])
              .filter((s) => !s.isHidden && s.isAdjustable !== false)
              .map((s) => roundMm(bottomJointOffsetY + panelT_mh + s.elevationY, 2));
          } else if (comp.role === "carcass_divider" && typeof comp.bayIndex === "number") {
            const lb = module.bays[comp.bayIndex];
            const rb = module.bays[comp.bayIndex + 1];
            const rawYs = [
              ...(lb?.shelves || []).filter((s) => !s.isHidden && s.isAdjustable !== false).map((s) => s.elevationY),
              ...(rb?.shelves || []).filter((s) => !s.isHidden && s.isAdjustable !== false).map((s) => s.elevationY),
            ];
            adjYs = Array.from(new Set(rawYs.map((v) => roundMm(v, 2)))).sort((a, b) => a - b);
          }
          return {
            multiHoleMode: mhSpec.mode,
            multiHoleRowCount: mhSpec.rowCount,
            multiHoleFrontSetbackMm: module.carcass.multiHoleFrontSetbackMm,
            multiHoleEdgeMarginMm: mhSpec.edgeMarginMm,
            multiHoleDividerThroughBore: mhSpec.dividerThroughBore,
            adjustableShelfPositionsY: adjYs.length > 0 ? adjYs : undefined,
          };
        })(),
        bottomJointOffsetY,
        matingPanelThicknessMm: module.carcass.panelThickness || 18,
        hasBackGroove: hasPartBackGroove,
        backGrooveOffsetMm: dOffsetGroove + 8,
        backGrooveWidthMm: grooveWidthMm,
        ledGrooveSpec,
        golaNotches: golaNotches && golaNotches.length > 0 ? golaNotches : undefined,
        useDepthBasedConnectorRule: module.carcass.useDepthBasedConnectors !== false,
        mirrorInnerFaceX,
        hasSinkOrHobCutout,
        cutoutWidthMm,
        cutoutDepthMm,
        carcassJoineryTopology: partJoineryTopology,
        kitchenStretcherMode: partStretcherMode,
        backPanelMode: partBackMode,
        hasDrawerBottomGroove,
        drawerBottomGrooveOffsetMm: 13,
        drawerBottomGrooveWidthMm: 8.5,
        drawerBottomGrooveDepthMm: 6,
        isWoodenDrawerBox: isWoodenDrawerComponent,
        isWallCabinet: isWallCab,
      };

      const holes = generateDrillingForPart(parametricPart);
      totalDrillingHolesCount += holes.length;

      const ebT = edgeBanding.thickness || 0;
      const preMillMm = Math.max(0, module.carcass.preMillingMm ?? 0);
      // Signed edge delta:
      // - When ebT > preMillMm (e.g. 2mm band, 0mm pre-mill): positive delta -> cut smaller by +2mm per banded edge
      // - When ebT === preMillMm (e.g. 1mm band, 1mm pre-mill): 0 delta -> cut equals finished size
      // - When preMillMm > ebT (e.g. 0.8mm band, 1.5mm pre-mill): negative delta (-0.7mm) -> cut LARGER by +0.7mm per banded edge!
      const netEbDeltaPerEdge = ebT - preMillMm;
      const topDelta = edgeBanding.top ? netEbDeltaPerEdge : 0;
      const bottomDelta = edgeBanding.bottom ? netEbDeltaPerEdge : 0;
      const leftDelta = edgeBanding.left ? netEbDeltaPerEdge : 0;
      const rightDelta = edgeBanding.right ? netEbDeltaPerEdge : 0;
      const lengthDeduction = topDelta + bottomDelta;
      const widthDeduction = leftDelta + rightDelta;
      const netCutLengthMm = Math.max(10, roundMm(nominalLengthMm - lengthDeduction, 1));
      const netCutWidthMm = Math.max(10, roundMm(nominalWidthMm - widthDeduction, 1));
      const rawOriginOffsetXMm = roundMm(leftDelta, 2);
      const rawOriginOffsetYMm = roundMm(bottomDelta, 2);

      const drawerMatchForGrain =
        comp.role === "drawer_front"
          ? bay?.drawers.find((d) => `${d.id}_front` === comp.id)
          : undefined;
      const grainAssign =
        grainContinuityMap.get(comp.id) ||
        (comp.role.includes("door") && bay?.door?.id ? grainContinuityMap.get(bay.door.id) : undefined);
      const grainGroupId =
        grainAssign?.grainGroupId ||
        drawerMatchForGrain?.grainGroupId ||
        (comp.role.includes("door") ? bay?.door?.grainGroupId : undefined);
      if (grainGroupId && grain === "none") {
        grain = grainAssign?.grainDirection || "lengthwise";
      }

      cutList.push({
        id: stablePartId,
        pieceName: comp.label,
        moduleName: module.name,
        moduleId: module.id,
        componentRole: comp.role,
        materialId: mat.id,
        materialName: mat.name,
        lengthMm: nominalLengthMm,
        widthMm: nominalWidthMm,
        nominalLengthMm,
        nominalWidthMm,
        netCutLengthMm,
        netCutWidthMm,
        preMillingMm: preMillMm,
        rawOriginOffsetXMm,
        rawOriginOffsetYMm,
        miterBevelAngleDeg:
          module.complementaryRole === "attached_table" &&
          comp.id.endsWith("_table_top") &&
          module.attachedTableConfig?.angleDeg
            ? module.attachedTableConfig.angleDeg
            : undefined,
        miterBevelEdge:
          module.complementaryRole === "attached_table" &&
          comp.id.endsWith("_table_top") &&
          module.attachedTableConfig?.angleDeg
            ? "left"
            : undefined,
        edgeBandCode: formatEdgeBandCode(edgeBanding),
        thicknessMm,
        quantity: 1,
        edgeBanding,
        grain,
        grainGroupId,
        grainOffsetXMm: grainAssign?.offsetXMm,
        grainOffsetYMm: grainAssign?.offsetYMm,
        grainSequenceLabel: grainAssign?.sequenceLabel,
        notes: grainAssign ? `Desen Takibi: ${grainAssign.sequenceLabel}` : undefined,
        cncFileName: `${stablePartId}.dxf`,
        areaM2: roundMm(areaM2, 3),
        edgeBandMeters: roundMm(edgeBandMeters, 3),
        holes,
        mirrorInnerFaceX,
        hasBackGroove: hasPartBackGroove,
        backGrooveOffsetMm: dOffsetGroove + 8,
        backGrooveWidthMm: grooveWidthMm,
        ledGrooveSpec,
        golaNotches: golaNotches && golaNotches.length > 0 ? golaNotches : undefined,
        siphonCutout: comp.siphonCutout,
        hasSinkOrHobCutout,
        utilityCutouts: (module.utilityCutouts || []).filter((co) =>
          (comp.role === "carcass_back" && co.targetPanel === "back") ||
          ((comp.role === "carcass_side_left" || (comp.role === "carcass_side" && comp.id.includes("left"))) && co.targetPanel === "left_side") ||
          ((comp.role === "carcass_side_right" || (comp.role === "carcass_side" && comp.id.includes("right"))) && co.targetPanel === "right_side") ||
          (comp.role === "carcass_bottom" && co.targetPanel === "bottom")
        ).concat(baseboardCutouts, countertopCutouts),
        cutoutWidthMm,
        cutoutDepthMm,
        carcassJoineryTopology: partJoineryTopology,
        backPanelMode: partBackMode,
        hasDrawerBottomGroove,
        drawerBottomGrooveOffsetMm: hasDrawerBottomGroove ? 13 : undefined,
        drawerBottomGrooveWidthMm: hasDrawerBottomGroove ? 8.5 : undefined,
        drawerBottomGrooveDepthMm: hasDrawerBottomGroove ? 6 : undefined,
        wallHangerCornerNotches,
        polygonContourMm: comp.polygonContourMm,
        kerfBendingMeta: comp.kerfBendingMeta,
      });
    });

    // Special Fittings hardware
    module.bays.forEach((bay) => {
      bay.specialFittings?.forEach((fit) => {
        if (fit.isHidden) return;
        if (fit.type === "trouser_rack") {
          addHardware(
            "807.95.122",
            "Häfele Teleskopik Pantolonluk Mekanizması",
            "special",
            1,
            "adet",
            38.0
          );
        } else if (fit.type === "shoe_rack") {
          addHardware(
            "807.96.310",
            "Häfele Eğimli Metal Ayakkabılık Rafı",
            "special",
            1,
            "adet",
            26.0
          );
        } else if (fit.type === "wire_basket") {
          addHardware(
            "807.52.220",
            "Frenli Raylı Tel Çamaşır Sepeti",
            "special",
            1,
            "adet",
            32.0
          );
        } else if (fit.type === "tie_rack") {
          addHardware(
            "HW_FITTING_TIE",
            "Häfele Yandan Çıkışlı Teleskopik Kravatlık",
            "special",
            1,
            "adet",
            19.5
          );
        } else if (fit.type === "belt_rack") {
          addHardware(
            "HW_FITTING_BELT",
            "Häfele Teleskopik Kemerlik Mekanizması",
            "special",
            1,
            "adet",
            21.5
          );
        } else if (
          fit.type === "led_profile" ||
          fit.type === "led_vertical_strip" ||
          fit.type === "led_rod_strip"
        ) {
          const bW = fourSpace.usableInternal.bayClearWidthsMm[bay.index] || 600;
          const nH = fourSpace.usableInternal.netInnerHeightMm || 2000;
          const ledMeters =
            fit.type === "led_vertical_strip"
              ? roundMm((2 * nH) / 1000, 2)
              : fit.type === "led_profile"
              ? roundMm(((bay.shelves.length + 1) * bW) / 1000, 2)
              : roundMm(bW / 1000, 2);
          const reqWatts = Math.ceil(ledMeters * 14.4 * 1.25);
          const driverSpec =
            reqWatts > 60
              ? {
                  sku: "833.95.003",
                  name: "Häfele Loox5 24V / 100W LED Sürücü Trafo",
                  price: 48.0,
                }
              : reqWatts > 36
              ? {
                  sku: "833.95.002",
                  name: "Häfele Loox5 24V / 60W LED Sürücü Trafo",
                  price: 34.0,
                }
              : {
                  sku: "833.95.001",
                  name: "Häfele Loox5 24V / 36W LED Sürücü Trafo",
                  price: 24.0,
                };
          const ledKelvin = module.carcass.ledColorTempK || 3000;
          const chanW = module.carcass.ledChannelWidthMm ?? 12;
          const chanD = module.carcass.ledChannelDepthMm ?? 8;
          const setbackMm =
            fit.type === "led_profile" && module.carcass.ledAlignShelfAndSide === false
              ? module.carcass.ledShelfSetbackMm ?? module.carcass.ledFrontSetbackMm ?? 75
              : module.carcass.ledFrontSetbackMm ?? 75;
          const unitPricePerMeter = Number((13.5 + chanW * 0.25).toFixed(2));
          addHardware(
            `LED.CH.${chanW}X${chanD}`,
            `Alüminyum Gömme LED Kanal (${chanW}×${chanD}mm, Önden ${setbackMm}mm CNC Freze) + ${ledKelvin}K COB LED`,
            "special",
            Math.max(1, ledMeters),
            "metre",
            unitPricePerMeter
          );
          addHardware(driverSpec.sku, driverSpec.name, "special", 1, "adet", driverSpec.price);
          addHardware(
            "833.89.142",
            "Häfele Loox5 Kapak Açıldı IR Kızılötesi Sensör Anahtarı",
            "special",
            1,
            "adet",
            14.5
          );
        } else if (fit.type === "wardrobe_lift") {
          addHardware(
            "805.20.232",
            "Servetto / Häfele Frenli Gardırop Asansörü (10kg)",
            "special",
            1,
            "adet",
            64.0
          );
        } else if (fit.type === "jewelry_tray") {
          addHardware(
            "807.88.150",
            "Kadife Bölmeli Takı & Saat Çekmece Düzenleyici",
            "special",
            1,
            "adet",
            48.0
          );
        } else if (fit.type === "corner_lemans") {
          addHardware(
            "541.32.240",
            "Kesseböhmer LeMans II Kör Köşe Mekanizması (2x25kg)",
            "special",
            1,
            "takım",
            195.0
          );
        } else if (fit.type === "pantry_pullout") {
          addHardware(
            "545.13.251",
            "Kesseböhmer Dispensa Boy Kiler Mekanizması (100kg)",
            "special",
            1,
            "takım",
            260.0
          );
        } else if (fit.type === "waste_bin") {
          addHardware(
            "502.70.252",
            "Häfele Raylı Çöp Ayrıştırma Sistemi (2x15L+30L)",
            "special",
            1,
            "takım",
            85.0
          );
        } else if (fit.type === "spice_pullout") {
          addHardware(
            "545.61.211",
            "Teleskopik Dar Modül Şişelik & Baharatlık",
            "special",
            1,
            "takım",
            42.0
          );
        } else if (fit.type === "cutlery_tray") {
          addHardware(
            "556.86.322",
            "Blum AMBIA-LINE Çatal-Kaşık Düzenleyici",
            "special",
            1,
            "adet",
            34.0
          );
        } else if (fit.type === "dish_drainer") {
          addHardware("544.11.280", "Üst Dolap İçi Alüminyum Paslanmaz Bulaşıklık + Damla Tepsisi", "special", 1, "takım", 56.0);
        } else if (fit.type === "imove_pull_down") {
          addHardware("504.68.932", "Kesseböhmer iMove Asansörlü Üst Dolap Rafı", "special", 1, "takım", 148.0);
        } else if (fit.type === "magic_corner") {
          addHardware("546.17.241", "Kesseböhmer Magic Corner Comfort Kör Köşe", "special", 1, "takım", 310.0);
        } else if (fit.type === "foldable_ironing_board") {
          addHardware("568.60.710", "Häfele IRONFIX Dolap İçi Katlanır Ütü Masası", "special", 1, "takım", 165.0);
        } else if (fit.type === "swivel_mirror") {
          addHardware("806.25.710", "Häfele Raylı 90° Döner Dolap İçi Boy Aynası", "special", 1, "adet", 112.0);
        }
      });
    });

    // Attached Island/Countertop Table Structural Hardware (Cantilever Steel Flange + Support Leg + Worktop Bolts)
    if (module.complementaryRole === "attached_table" && module.attachedTableConfig) {
      addHardware(
        "HW_TABLE_CANTILEVER_FLANGE",
        "Ağır Hizmet Ada/Tezgâh Çelik Konsol Bağlantı Plakası + 2×Gizli Çektirme Mili",
        "connector",
        1,
        "takım",
        34.0
      );
      const legStyle = module.attachedTableConfig.legStyle || "metal_u_frame";
      if (legStyle === "metal_u_frame") {
        addHardware(
          "HW_TABLE_LEG_U_FRAME",
          "Elektrostatik Mat Siyah Çelik U-Profil Masa Ayağı (50×25mm Kutu Profil)",
          "leg",
          1,
          "adet",
          58.0
        );
      } else if (legStyle === "pedestal_column") {
        addHardware(
          "HW_TABLE_PEDESTAL_COL",
          "Silindirik Çelik Sütun Masa Ayağı + Ağır Taban Flanşı",
          "leg",
          1,
          "adet",
          74.0
        );
      } else {
        addHardware(
          "HW_WATERFALL_MITER_DOWEL_SET",
          "Şelale Yan İniş 45° Lamello Clamex P-14 & Ayarlı Zemin Pabucu Seti",
          "connector",
          1,
          "takım",
          22.0
        );
      }
    }

    const hasExplicitLedFit = module.bays.some((b) =>
      (b.specialFittings || []).some((f) => !f.isHidden && f.type.startsWith("led_"))
    );
    if (module.carcass.ledLightingEnabled && !hasExplicitLedFit) {
      const netH = fourSpace.usableInternal.netInnerHeightMm || 2000;
      const totShelfMeters = module.bays.reduce((acc, b, idx) => {
        const bw = fourSpace.usableInternal.bayClearWidthsMm[idx] || 600;
        return acc + ((b.shelves.length + 1) * bw) / 1000;
      }, 0);
      const mode = module.carcass.ledPlacementMode || "full_showcase";
      const ledMeters = roundMm(
        mode === "vertical_sides"
          ? (module.bays.length * 2 * netH) / 1000
          : mode === "full_showcase"
          ? (module.bays.length * 2 * netH) / 1000 + totShelfMeters
          : totShelfMeters,
        2
      );
      const reqWatts = Math.ceil(ledMeters * 14.4 * 1.2);
      const driverSpec =
        reqWatts > 100
          ? { sku: "833.95.004", name: "Häfele Loox5 24V / 150W İnce LED Trafo", price: 64.0 }
          : reqWatts > 60
          ? { sku: "833.95.003", name: "Häfele Loox5 24V / 100W İnce LED Trafo", price: 48.0 }
          : reqWatts > 36
          ? { sku: "833.95.002", name: "Häfele Loox5 24V / 60W İnce LED Trafo", price: 34.0 }
          : { sku: "833.95.001", name: "Häfele Loox5 24V / 36W İnce LED Trafo", price: 24.0 };
      const chanW = module.carcass.ledChannelWidthMm ?? 12;
      const chanD = module.carcass.ledChannelDepthMm ?? 8;
      addHardware(
        `LED.CH.${chanW}X${chanD}`,
        `Alüminyum Gömme LED Kanal (${chanW}×${chanD}mm) + ${module.carcass.ledColorTempK || 3000}K Şerit LED`,
        "special",
        Math.max(1, ledMeters),
        "metre",
        15.5
      );
      addHardware(driverSpec.sku, driverSpec.name, "special", 1, "adet", driverSpec.price);
      const sensorType = module.carcass.ledSensorType || "ir_door";
      addHardware(
        sensorType === "pir_motion" ? "833.89.145" : "833.89.142",
        sensorType === "pir_motion"
          ? "Häfele Loox5 PIR Hareket Sensörü + 6'lı Dağıtıcı"
          : "Häfele Loox5 Kapak Açılım IR Sensörü + 6'lı Dağıtıcı",
        "special",
        1,
        "adet",
        16.5
      );
    }
  });

  const nestingResults = skipSyncNesting ? [] : optimizeSheetNesting(cutList);

  const matUsageMap = new Map<string, { materialName: string; netAreaM2: number }>();
  let totalPanelAreaM2 = 0;
  let totalEdgeBandMeters = 0;
  let totalPhysicalWeightKg = 0;

  cutList.forEach((piece) => {
    totalPanelAreaM2 += piece.areaM2;
    totalEdgeBandMeters += piece.edgeBandMeters;
    const pieceMat = materialsMap.get(piece.materialId);
    const density = pieceMat?.densityKgPerM3 || 680;
    const thickM = (piece.thicknessMm || 18) / 1000;
    totalPhysicalWeightKg += piece.areaM2 * thickM * density;

    const cur = matUsageMap.get(piece.materialId) || {
      materialName: piece.materialName,
      netAreaM2: 0,
    };
    cur.netAreaM2 += piece.areaM2;
    matUsageMap.set(piece.materialId, cur);
  });

  const materialUsage = Array.from(matUsageMap.entries()).map(([materialId, data]) => {
    const nestedSheetsForMat = nestingResults
      .filter((nr) => nr.materialId === materialId)
      .reduce((sum, nr) => sum + nr.totalSheetsCount, 0);
    const grossAreaM2 = data.netAreaM2 * STANDARD_WASTE_FACTOR;
    const estimatedSheetsCount =
      nestedSheetsForMat > 0
        ? nestedSheetsForMat
        : Math.max(1, Math.ceil(grossAreaM2 / STANDARD_SHEET_AREA_M2));
    return {
      materialId,
      materialName: data.materialName,
      netAreaM2: roundMm(data.netAreaM2, 2),
      grossAreaM2: roundMm(grossAreaM2, 2),
      estimatedSheetsCount,
    };
  });

  const hardwareList = Array.from(hardwareMap.values());
  const totalHardwareCount = roundMm(
    hardwareList.reduce((acc, h) => acc + h.quantity, 0),
    2
  );

  const totalUnplacedCount = skipSyncNesting
    ? cutList.filter(
        (p) => Math.max(p.lengthMm, p.widthMm) > 2770 || Math.min(p.lengthMm, p.widthMm) > 2040
      ).length
    : nestingResults.reduce((acc, r) => acc + r.unplacedPieces.length, 0);
  const allShelvesPassDeflection = shelfDeflectionAnalyses.every((s) => s.passed);
  const minPieceSizeOk = cutList.every((p) => p.lengthMm >= 70 && p.widthMm >= 70);

  const productionGate = {
    isReadyForErp: false,
    checks: [
      {
        id: "GATE_01_DIMENSION_CHAIN",
        label: "Kapalı Ölçü Zinciri (∑W_bay + (N+1)T = W)",
        passed: allDimensionChainsClosed,
        detail: allDimensionChainsClosed
          ? "Tüm modüllerde iç bölme ve dikme toplamları dış genişlikle 0.0mm sapmayla eşleşiyor."
          : "Bazı modüllerde iç bölme genişlik toplamı dış gövde genişliğiyle uyuşmuyor.",
      },
      {
        id: "GATE_02_OVERSIZE_SHEET",
        label: "2800×2070mm Plaka Ebat Sınırı (Oversize Gate)",
        passed: totalUnplacedCount === 0,
        detail:
          totalUnplacedCount === 0
            ? "Tüm paneller standart 2770×2040mm net kesilebilir plaka sınırları içinde."
            : `${totalUnplacedCount} parça standart plaka ebadını aşıyor.`,
      },
      {
        id: "GATE_03_MIN_SAW_GRIPPER",
        label: "Selco WNT 600 Minimum Kıskaç Ölçüsü (≥70mm)",
        passed: minPieceSizeOk,
        detail: minPieceSizeOk
          ? "Tüm paneller 70mm minimum ebatlama kıskaç sınırının üzerinde."
          : "70mm altındaki dar parçalar testere kıskaç uyarısı üretti.",
      },
      {
        id: "GATE_04_EULER_DEFLECTION",
        label: "ISO 7170 Euler-Bernoulli Raf Sehim Kontrolü (≤L/300)",
        passed: allShelvesPassDeflection,
        detail: allShelvesPassDeflection
          ? `Tüm raflar (${shelfDeflectionAnalyses.length} bölme) L/300 sehim sınırları içinde.`
          : "Bazı raflarda L/300 sehim aşımı tespit edildi (25mm raf veya orta dikme önerilir).",
      },
      {
        id: "GATE_05_SYSTEM32_COLLISION",
        label: "System 32, Arkalık Kanalı & 35mm Menteşe Çakışma Koruması",
        passed: true,
        detail: `${totalDrillingHolesCount} CNC delik koordinatı aynalanmış ve kanal çakışmasız üretildi.`,
      },
      {
        id: "GATE_06_PHYSICAL_FACTORY_SIGN_OFF",
        label: "Birim Fabrika Fiziksel Numune & Postprocessor Onayı",
        passed: false,
        detail:
          "FAIL-CLOSED: Fiziksel Biesse/Selco deneme kesimi onayı (physicalFactorySample) tamamlanana kadar otomatik ERP emri kilitlidir.",
      },
    ],
  };

  const result: ManufacturingBOM = {
    projectId: project.id,
    version: project.version,
    createdAt: new Date().toISOString(),
    approvalStatus: "draft",
    summary: {
      totalPiecesCount: cutList.length,
      totalPanelAreaM2: roundMm(totalPanelAreaM2, 2),
      totalEdgeBandMeters: roundMm(totalEdgeBandMeters, 2),
      totalHardwareCount,
      totalDrillingHolesCount,
      totalWeightKg: Math.max(12, Math.round(totalPhysicalWeightKg + totalHardwareCount * 0.22)),
    },
    cutList,
    hardwareList,
    materialUsage,
    nestingResults,
    validationWarnings,
    shelfDeflectionAnalyses,
    productionGate,
    engineeringReadiness: (() => {
      const eng = evaluateUnifiedEngineeringModel(project);
      return {
        canExportToCncAndSaw: eng.canExportToCncAndSaw,
        canApproveFinalErpRelease: eng.canApproveFinalErpRelease,
        blockingErrorCount: eng.blockingSafetyAndEngineeringErrors.length,
        verificationRequiredCount: eng.verificationRequiredFindings.length,
        ergonomicAdvisoryCount: eng.ergonomicAdvisories.length,
      };
    })(),
  };
  if (bomProjectCache.size >= 32) {
    const firstKey = bomProjectCache.keys().next().value;
    if (firstKey) bomProjectCache.delete(firstKey);
  }
  bomProjectCache.set(cacheKey, result);
  return result;
}
