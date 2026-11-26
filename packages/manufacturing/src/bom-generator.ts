import {
  DesignProject,
  MaterialDefinition,
  DEFAULT_MATERIALS,
  syncProjectCustomMaterials,
  isBuiltInDishwasherModule,
  evaluateCornerAndSweepCollisions,
  roundMm,
  computeProjectGrainContinuityMap,
} from "@birim/core";
import { CutPiece, HardwareBOMItem, ManufacturingBOM, ShelfDeflectionBOMEntry } from "./types";
import {
  GenerateBOMOptions,
  CurvedKerfBendingSpec,
  ModuleHardwareCallRecord,
  bomProjectCache,
  computeCurvedKerfBendingSpec,
  computeMaterialsMapFingerprint,
  computeProjectBOMKey,
  hasSinkOrCooktopAppliance,
} from "./bom/bom-helpers-and-kerf";
import { populateModuleBomSlices } from "./bom/module-bom-slice-builder";
import { finalizeManufacturingBom } from "./bom/bom-aggregation-and-gate";

export type { GenerateBOMOptions, CurvedKerfBendingSpec };
export { computeCurvedKerfBendingSpec };

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

  let activeModuleHardwareSink: ModuleHardwareCallRecord[] | null = null;

  function addHardware(
    sku: string,
    name: string,
    category: HardwareBOMItem["category"],
    quantity: number,
    unit: HardwareBOMItem["unit"] = "adet",
    unitPrice = 0
  ) {
    if (quantity <= 0) return;
    if (activeModuleHardwareSink) {
      activeModuleHardwareSink.push({ sku, name, category, quantity, unit, unitPrice });
    }
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

  const effectiveMaterialsMap = new Map(materialsMap);
  if (project.customMaterials?.length) {
    for (const cm of project.customMaterials) {
      if (cm && cm.id && !effectiveMaterialsMap.has(cm.id)) {
        effectiveMaterialsMap.set(cm.id, cm);
      }
    }
  }

  const matsFingerprint = computeMaterialsMapFingerprint(effectiveMaterialsMap);
  const spaceCeilingH = project.space?.ceilingHeight || 2600;
  const spaceWallsCount = project.space?.walls?.length || 0;


  ({ totalDrillingHolesCount, allDimensionChainsClosed } = populateModuleBomSlices({
    project,
    materialsMap: effectiveMaterialsMap,
    matsFingerprint,
    spaceCeilingH,
    spaceWallsCount,
    grainContinuityMap,
    cutList,
    shelfDeflectionAnalyses,
    validationWarnings,
    addHardware,
    setActiveHardwareSink: (sink) => {
      activeModuleHardwareSink = sink;
    },
  }));

  return finalizeManufacturingBom({
    project,
    materialsMap: effectiveMaterialsMap,
    options,
    skipSyncNesting,
    cacheKey,
    cutList,
    hardwareMap,
    shelfDeflectionAnalyses,
    validationWarnings,
    totalDrillingHolesCount,
    allDimensionChainsClosed,
  });
}
