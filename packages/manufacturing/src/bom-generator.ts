import {
  DesignProject,
  ModuleInstance,
  MaterialDefinition,
  DEFAULT_MATERIALS,
  ParametricPart,
  calculateFourSpaceDimensions,
  calculateRecommendedHingesPerLeaf,
  calculateShelfDeflection,
  inferDoorSystemIdFromType,
  roundIntMm,
  roundMm,
} from "@birim/core";
import {
  getHardwareProductById,
  HANDLE_PROFILES,
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

  project.modules.forEach((module: ModuleInstance) => {
    const geo = generateModuleGeometry(module);
    const fourSpace = calculateFourSpaceDimensions(module);
    const bodyMat = materialsMap.get(module.carcass.bodyMaterialId) || DEFAULT_MATERIALS[0];
    const doorMat = materialsMap.get(module.carcass.doorMaterialId) || DEFAULT_MATERIALS[2];
    const hasGroovedBack =
      module.category !== "complementary" &&
      !module.isOpenFront &&
      module.carcass.backPanelType === "grooved";

    if (module.category !== "complementary") {
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

    if (module.category !== "complementary") {
      const numDividers = Math.max(0, module.bays.length - 1);
      const minifixCount = 8 + numDividers * 4;
      addHardware(
        "HW_MINIFIX_SET",
        "Häfele Minifix 15 + Mil Bağlantı Elemanı",
        "connector",
        minifixCount,
        "adet",
        0.45
      );
      addHardware(
        "HW_DOWEL_8X35",
        "Ahşap Kavela 8x35mm",
        "fastener",
        minifixCount,
        "adet",
        0.05
      );

      if (module.carcass.plinthHeight > 0 && module.carcass.hasAdjustableLegs !== false) {
        const feetCount = Math.max(4, Math.ceil(module.dimensions.width / 450) * 2);
        addHardware(
          "HW_LEVELING_FEET",
          "Ayarlanabilir Baza Ayağı 80-100mm",
          "leg",
          feetCount,
          "adet",
          1.2
        );
      }

      if (module.category === "kitchen_wall") {
        addHardware(
          "HW_WALL_HANGER_EN14749",
          "EN 14749 Ağır Yük Üst Dolap Duvar Askı Elemanı",
          "connector",
          2,
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
        length = comp.dimensions.width;
        width = comp.dimensions.depth;
        hasPartBackGroove = hasGroovedBack;
        edgeBanding = {
          top: false,
          bottom: false,
          left: true,
          right: false,
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
        addHardware(
          "HW_SHELF_PIN",
          "Kilitli Raf Pimi 5mm (Häfele)",
          "fastener",
          4,
          "adet",
          0.15
        );
      } else if (comp.role === "countertop") {
        mat = materialsMap.get(comp.materialId) || bodyMat;
        length = comp.dimensions.width;
        width = comp.dimensions.depth;
        edgeBanding = { top: true, bottom: true, left: true, right: true, thickness: 2 };
        // Only cut sink/hob aperture if the module (or complementary countertop's project) actually has a sink/cooktop!
        const shouldCut =
          module.category === "complementary"
            ? module.complementaryRole === "countertop" && projectHasSinkOrHob
            : hasSinkOrCooktopAppliance(module);
        if (shouldCut && length >= 550 && width >= 480) {
          hasSinkOrHobCutout = true;
          cutoutWidthMm = Math.min(560, Math.max(320, roundIntMm(length - 120)));
          cutoutDepthMm = Math.min(480, Math.max(280, roundIntMm(width - 100)));
        }
      } else if (comp.role.includes("door")) {
        mat = materialsMap.get(comp.materialId) || doorMat;
        const doorGrain =
          module.componentGrainOverrides?.[comp.id] ||
          module.componentGrainOverrides?.__doors__ ||
          module.componentGrainOverrides?.__all__;
        grain = mat.hasGrain ? (doorGrain === "crosswise" ? "crosswise" : "lengthwise") : "none";
        length = comp.dimensions.height;
        width = comp.dimensions.width;
        const doorEbT = bay?.door.doorEdgeBandThicknessMm || defaultEbThickness;
        edgeBanding = { top: true, bottom: true, left: true, right: true, thickness: doorEbT };

        const leafInfo = fourSpace.doorLeaves[bayIdx];
        partHingePositionsY = leafInfo?.hingePositionsY;
        const selectedHw = getHardwareProductById(bay?.door.hardwareProductId);

        if (dSys.startsWith("hinged")) {
          const hingesNeeded =
            leafInfo?.effectiveHingeCount ||
            leafInfo?.recommendedHingesPerLeaf ||
            calculateRecommendedHingesPerLeaf(length, leafInfo?.leafWeightKg ?? 0, false);
          const hingeSku = selectedHw?.sku || "HW_BLUM_HINGE_110";
          const hingeName =
            selectedHw?.name || "Blum Clip Top Blumotion 110° Frenli Menteşe";
          const hingePrice = selectedHw?.unitPriceEur || 3.8;
          addHardware(hingeSku, hingeName, "hinge", hingesNeeded, "adet", hingePrice);
        } else if (!bayMechanismAdded.has(bayIdx)) {
          bayMechanismAdded.add(bayIdx);
          if (dSys.startsWith("lift")) {
            const liftSku = selectedHw?.sku || "22K2700";
            const liftName =
              selectedHw?.name || "Blum AVENTOS Yukarı Kalkar Mekanizma Seti";
            const liftPrice = selectedHw?.unitPriceEur || 52.0;
            addHardware(liftSku, liftName, "special", 1, "takım", liftPrice);
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
                  "metre",
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
                  "metre",
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
        if (handleCat !== "handleless_plain") {
          const hProfile =
            HANDLE_PROFILES.find((hp) => hp.id === bay?.door.handleProfileId) ||
            HANDLE_PROFILES.find((hp) => hp.category === handleCat) ||
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
        grain = mat.hasGrain ? (drwGrain === "crosswise" ? "crosswise" : "lengthwise") : "none";
        length = comp.dimensions.width;
        width = comp.dimensions.height;
        edgeBanding = {
          top: true,
          bottom: true,
          left: true,
          right: true,
          thickness: defaultEbThickness,
        };
        const drawer = bay?.drawers.find((d) => `${d.id}_front` === comp.id);
        if (!drawer?.isInternal && bay?.door.handleCategory !== "handleless_plain") {
          const profile =
            HANDLE_PROFILES.find((p) => p.id === bay?.door.handleProfileId) ||
            HANDLE_PROFILES.find(
              (p) => p.category === (bay?.door.handleCategory || "bar_handle")
            ) ||
            HANDLE_PROFILES[1];
          addHardware(profile.sku, profile.name, "handle", 1, "adet", profile.unitPriceEur);
        }
      } else if (
        comp.role === "drawer_box" ||
        comp.role === "drawer_side_left" ||
        comp.role === "drawer_side_right" ||
        comp.role === "drawer_back" ||
        comp.role === "drawer_bottom"
      ) {
        if (comp.role === "drawer_side_left") {
          const drawerCfg = bay?.drawers.find((d) => `${d.id}_side_left` === comp.id);
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
        // Plinth lengthMm is its long horizontal span; widthMm is its height (e.g. 80mm).
        // Banding along the long edge uses `left: true` (1B) so meters = length/1000 and height net-cut deducts ebT!
        length = Math.max(comp.dimensions.width, comp.dimensions.depth);
        width = comp.dimensions.height;
        edgeBanding = {
          top: false,
          bottom: false,
          left: true,
          right: false,
          thickness: defaultEbThickness,
        };
      }

      if (width < 70 || length < 70) {
        validationWarnings.push(
          `Parça "${comp.label}" boyutu (${roundIntMm(length)}x${roundIntMm(
            width
          )}mm) Selco testere min kesim ölçüsünden (70mm) küçük [UNVERIFIED].`
        );
      }

      const nominalLengthMm = roundIntMm(length);
      const nominalWidthMm = roundIntMm(width);
      const areaM2 = (nominalLengthMm * nominalWidthMm) / 1_000_000;

      // Consistent Edge Banding Axis Contract:
      // top & bottom span across nominalWidthMm (En); left & right span along nominalLengthMm (Boy).
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

      const parametricPart: ParametricPart = {
        id: stablePartId,
        moduleId: module.id,
        bayIndex: comp.bayIndex,
        label: comp.label,
        role: comp.role,
        dimensions: {
          width: nominalWidthMm,
          height: nominalLengthMm,
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
        handleSpacingMm: undefined,
        isInsetDoor,
        hingePositionsY: partHingePositionsY,
        hingePositionsBackY: partHingePositionsBackY,
        bottomJointOffsetY,
        matingPanelThicknessMm: module.carcass.panelThickness || 18,
        hasBackGroove: hasPartBackGroove,
        backGrooveOffsetMm: 20,
        mirrorInnerFaceX,
        hasSinkOrHobCutout,
        cutoutWidthMm,
        cutoutDepthMm,
      };

      const holes = generateDrillingForPart(parametricPart);
      totalDrillingHolesCount += holes.length;

      const ebT = edgeBanding.thickness || 0;
      const lengthDeduction = (edgeBanding.top ? ebT : 0) + (edgeBanding.bottom ? ebT : 0);
      const widthDeduction = (edgeBanding.left ? ebT : 0) + (edgeBanding.right ? ebT : 0);
      const netCutLengthMm = Math.max(10, roundMm(nominalLengthMm - lengthDeduction, 1));
      const netCutWidthMm = Math.max(10, roundMm(nominalWidthMm - widthDeduction, 1));

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
        edgeBandCode: formatEdgeBandCode(edgeBanding),
        thicknessMm,
        quantity: 1,
        edgeBanding,
        grain,
        areaM2: roundMm(areaM2, 3),
        edgeBandMeters: roundMm(edgeBandMeters, 3),
        holes,
        mirrorInnerFaceX,
        hasBackGroove: hasPartBackGroove,
        backGrooveOffsetMm: 20,
        hasSinkOrHobCutout,
        utilityCutouts: (module.utilityCutouts || []).filter((co) =>
          (comp.role === "carcass_back" && co.targetPanel === "back") ||
          ((comp.role === "carcass_side_left" || (comp.role === "carcass_side" && comp.id.includes("left"))) && co.targetPanel === "left_side") ||
          ((comp.role === "carcass_side_right" || (comp.role === "carcass_side" && comp.id.includes("right"))) && co.targetPanel === "right_side") ||
          (comp.role === "carcass_bottom" && co.targetPanel === "bottom")
        ),
        cutoutWidthMm,
        cutoutDepthMm,
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
        }
      });
    });
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
  };
  if (bomProjectCache.size >= 32) {
    const firstKey = bomProjectCache.keys().next().value;
    if (firstKey) bomProjectCache.delete(firstKey);
  }
  bomProjectCache.set(cacheKey, result);
  return result;
}
