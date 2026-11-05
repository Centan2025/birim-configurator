import {
  DesignProject,
  ModuleInstance,
  MaterialDefinition,
  DEFAULT_MATERIALS,
  ParametricPart,
  calculateFourSpaceDimensions,
  inferDoorSystemIdFromType,
} from "@birim/core";
import {
  getHardwareProductById,
  HANDLE_PROFILES,
  selectOptimalRunnerLengthMm,
} from "@birim/catalog";
import { generateModuleGeometry } from "@birim/geometry";
import { CutPiece, EdgeBandingConfig, HardwareBOMItem, ManufacturingBOM } from "./types";
import { generateDrillingForPart } from "./drilling-engine";
import { optimizeSheetNesting } from "./sheet-nesting";

const STANDARD_SHEET_AREA_M2 = (2800 * 2070) / 1_000_000; // 5.796 m²
const STANDARD_WASTE_FACTOR = 1.12; // Flat 12% comparison reference

const bomProjectCache = new Map<string, ManufacturingBOM>();

function computeProjectBOMKey(project: DesignProject, materialsMap: Map<string, MaterialDefinition>): string {
  return JSON.stringify([project, Array.from(materialsMap.entries())]);
}

export function generateBOMForProject(
  project: DesignProject,
  materialsMap: Map<string, MaterialDefinition> = new Map(DEFAULT_MATERIALS.map((m) => [m.id, m]))
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
    };
  }

  const cacheKey = computeProjectBOMKey(project, materialsMap);
  const cached = bomProjectCache.get(cacheKey);
  if (cached) return cached;

  const cutList: CutPiece[] = [];
  const hardwareMap: Map<string, HardwareBOMItem> = new Map();
  const validationWarnings: string[] = ["UNVERIFIED: Üretim kuralları ve montaj koordinatları fabrika teknik doğrulaması bekliyor; CNC çıktısı üretime hazır değildir."];
  let totalDrillingHolesCount = 0;

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
      existing.quantity += quantity;
      existing.totalPrice = existing.quantity * existing.unitPrice;
    } else {
      hardwareMap.set(sku, {
        sku,
        name,
        category,
        quantity,
        unit,
        unitPrice,
        totalPrice: quantity * unitPrice,
      });
    }
  }

  // Iterate over all modules in the project
  project.modules.forEach((module: ModuleInstance) => {
    const geo = generateModuleGeometry(module);
    const fourSpace = calculateFourSpaceDimensions(module);
    const bodyMat = materialsMap.get(module.carcass.bodyMaterialId) || DEFAULT_MATERIALS[0];
    const doorMat = materialsMap.get(module.carcass.doorMaterialId) || DEFAULT_MATERIALS[2];

    // Skip carcass connectors for single-piece complementary modules
    if (module.category !== "complementary") {
      const numDividers = Math.max(0, module.bays.length - 1);
      const minifixCount = 8 + numDividers * 4;
      addHardware("HW_MINIFIX_SET", "Häfele Minifix 15 + Mil Bağlantı Elemanı", "connector", minifixCount, "adet", 0.45);
      addHardware("HW_DOWEL_8X35", "Ahşap Kavela 8x35mm", "fastener", minifixCount, "adet", 0.05);

      if (module.carcass.plinthHeight > 0) {
        const feetCount = Math.max(4, Math.ceil(module.dimensions.width / 450) * 2);
        addHardware("HW_LEVELING_FEET", "Ayarlanabilir Baza Ayağı 80-100mm", "leg", feetCount, "adet", 1.2);
      }

      if (module.category === "kitchen_wall") {
        addHardware("HW_WALL_HANGER_EN14749", "EN 14749 Ağır Yük Üst Dolap Duvar Askı Elemanı", "connector", 2, "adet", 4.2);
      }
    } else {
      if (module.complementaryRole === "leveling_feet") {
        addHardware("HW_LEVELING_FEET", "Ayarlanabilir Baza Ayağı 80-100mm", "leg", 4, "adet", 1.2);
      } else if (module.complementaryRole === "led_channel") {
        const meters = Math.max(1, Number((module.dimensions.width / 1000).toFixed(2)));
        addHardware("HW_FITTING_LED", "Alüminyum Gömme LED Aydınlatma Profili (Metretül)", "special", meters, "metre", 14.0);
      } else if (module.complementaryRole === "wall_bracket") {
        addHardware("HW_WALL_HANGER_EN14749", "EN 14749 Ağır Yük Üst Dolap Duvar Askı Elemanı", "connector", 2, "adet", 4.2);
      } else if (module.complementaryRole === "service_spacer") {
        addHardware("HW_SERVICE_SPACER", "Tesisat Boşluğu Ayar Aparatı", "connector", 2, "adet", 2.5);
      }
    }

    // Track door hardware per bay so multi-leaf systems (sliding/lift/pocket/folding) add mechanisms accurately
    const bayMechanismAdded = new Set<number>();

    geo.components.forEach((comp) => {
      if (comp.role === "hanging_rail") {
        addHardware("HW_HANGING_RAIL", `Oval Alüminyum Elbise Askı Borusu ${comp.dimensions.width}mm`, "rod", 1, "adet", 4.5);
        addHardware("HW_RAIL_SOCKET", "Askı Borusu Flanşı (Sağ-Sol Takım)", "connector", 1, "takım", 1.8);
        return;
      }
      if (
        comp.isManufacturablePanel === false ||
        comp.role === "door_handle" ||
        comp.role === "gola_profile" ||
        comp.role === "drawer_handle" ||
        comp.role === "drawer_slide" ||
        comp.role === "special_fitting"
      ) {
        return;
      }

      let mat = bodyMat;
      let grain: CutPiece["grain"] = mat.hasGrain ? "lengthwise" : "none";
      let edgeBanding: EdgeBandingConfig = {
        top: false,
        bottom: false,
        left: false,
        right: false,
        thickness: module.carcass.edgeBandThickness,
      };

      let length = comp.dimensions.height;
      let width = comp.dimensions.depth;
      const bayIdx = comp.bayIndex ?? 0;
      const bay = module.bays[bayIdx] || module.bays[0];
      const dSys = bay ? bay.door.doorSystemId || inferDoorSystemIdFromType(bay.door.type) : "open";
      const isInsetDoor =
        bay?.door.overlayType === "inset" || dSys === "hinged_inset" || bay?.door.type.startsWith("inset");

      if (comp.role.includes("side") && !comp.role.includes("drawer")) {
        length = comp.dimensions.height;
        width = comp.dimensions.depth;
        edgeBanding = { top: false, bottom: true, left: true, right: false, thickness: 1 };
      } else if (comp.role === "carcass_bottom" || comp.role === "carcass_top") {
        length = comp.dimensions.width;
        width = comp.dimensions.depth;
        edgeBanding = { top: false, bottom: false, left: true, right: false, thickness: 1 };
      } else if (comp.role === "carcass_divider" || comp.role === "carcass_sub_divider") {
        length = comp.dimensions.height;
        width = comp.dimensions.depth;
        edgeBanding = { top: false, bottom: false, left: true, right: false, thickness: 1 };
      } else if (comp.role === "carcass_back") {
        length = comp.dimensions.height;
        width = comp.dimensions.width;
        grain = "none";
        edgeBanding = { top: false, bottom: false, left: false, right: false, thickness: 0 };
      } else if (comp.role === "shelf") {
        length = comp.dimensions.width;
        width = comp.dimensions.depth;
        edgeBanding = { top: false, bottom: false, left: true, right: false, thickness: 1 };
        addHardware("HW_SHELF_PIN", "Kilitli Raf Pimi 5mm (Häfele)", "fastener", 4, "adet", 0.15);
      } else if (comp.role === "countertop") {
        mat = materialsMap.get(comp.materialId) || bodyMat;
        length = comp.dimensions.width;
        width = comp.dimensions.depth;
        edgeBanding = { top: true, bottom: true, left: true, right: true, thickness: 2 };
      } else if (comp.role.includes("door")) {
        mat = materialsMap.get(comp.materialId) || doorMat;
        grain = mat.hasGrain ? "lengthwise" : "none";
        length = comp.dimensions.height;
        width = comp.dimensions.width;
        edgeBanding = { top: true, bottom: true, left: true, right: true, thickness: 1 };

        const leafInfo = fourSpace.doorLeaves[bayIdx];
        const selectedHw = getHardwareProductById(bay?.door.hardwareProductId);

        if (dSys.startsWith("hinged")) {
          const hingesNeeded =
            leafInfo?.recommendedHingesPerLeaf ||
            (length > 2000 ? 5 : length > 1600 ? 4 : length > 900 ? 3 : 2);
          const hingeSku = selectedHw?.sku || "HW_BLUM_HINGE_110";
          const hingeName = selectedHw?.name || "Blum Clip Top Blumotion 110° Frenli Menteşe";
          const hingePrice = selectedHw?.unitPriceEur || 3.8;
          addHardware(hingeSku, hingeName, "hinge", hingesNeeded, "adet", hingePrice);
        } else if (!bayMechanismAdded.has(bayIdx)) {
          bayMechanismAdded.add(bayIdx);
          if (dSys.startsWith("lift")) {
            const liftSku = selectedHw?.sku || "22K2700";
            const liftName = selectedHw?.name || "Blum AVENTOS Yukarı Kalkar Mekanizma Seti";
            const liftPrice = selectedHw?.unitPriceEur || 52.0;
            addHardware(liftSku, liftName, "special", 1, "takım", liftPrice);
          } else if (dSys.startsWith("sliding")) {
            const slideSku = selectedHw?.sku || "TopLineL_50";
            const slideName = selectedHw?.name || "Hettich TopLine L Yavaşlatıcılı Sürgü Sistemi";
            const slidePrice = selectedHw?.unitPriceEur || 135.0;
            addHardware(slideSku, slideName, "slide", 1, "takım", slidePrice);
          } else if (dSys === "folding_side") {
            const foldSku = selectedHw?.sku || "WingLineL_25";
            const foldName = selectedHw?.name || "Hettich WingLine L Katlanır Kapak Sistemi";
            const foldPrice = selectedHw?.unitPriceEur || 110.0;
            addHardware(foldSku, foldName, "special", 1, "takım", foldPrice);
          } else if (dSys === "pocket_retractable") {
            const pocketSku = selectedHw?.sku || "REVEGO_UNO_650";
            const pocketName = selectedHw?.name || "Blum REVEGO Pocket Gizlenen Kapak Sistemi";
            const pocketPrice = selectedHw?.unitPriceEur || 420.0;
            addHardware(pocketSku, pocketName, "special", 1, "takım", pocketPrice);
          }
        }

        // Opening mechanism add-on (Push-to-open TIP-ON or SERVO-DRIVE)
        const openTech = bay?.door.openingTechnology;
        if (openTech === "push_to_open") {
          addHardware("956A1004", "Blum TIP-ON Bas-Aç Mekanik İtici + Adaptör", "special", 1, "adet", 6.5);
        } else if (openTech === "push_to_open_soft_close") {
          addHardware("TIP_ON_BLUMOTION_SET", "Blum TIP-ON BLUMOTION Bas-Aç + Frenli Ünite", "special", 1, "takım", 14.0);
        } else if (openTech === "servo_electric") {
          addHardware("Z10A3000", "Blum SERVO-DRIVE Elektrikli Açılma Ünitesi", "special", 1, "takım", 145.0);
        }

        // Handle hardware (skip if handleless_plain)
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
        grain = mat.hasGrain ? "lengthwise" : "none";
        length = comp.dimensions.width;
        width = comp.dimensions.height;
        edgeBanding = { top: true, bottom: true, left: true, right: true, thickness: 1 };
        const drawer = bay?.drawers.find((d) => `${d.id}_front` === comp.id);
        if (!drawer?.isInternal && bay?.door.handleCategory !== "handleless_plain") {
          const profile =
            HANDLE_PROFILES.find((p) => p.id === bay?.door.handleProfileId) ||
            HANDLE_PROFILES.find((p) => p.category === (bay?.door.handleCategory || "bar_handle"))!;
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
        length = comp.role === "drawer_bottom" || comp.role === "drawer_back" ? comp.dimensions.width : comp.dimensions.depth;
        width = comp.role === "drawer_bottom" ? comp.dimensions.depth : comp.dimensions.height;
        edgeBanding = { top: true, bottom: false, left: false, right: false, thickness: 1 };
      } else if (comp.role === "plinth") {
        length = comp.dimensions.width;
        width = comp.dimensions.height;
        edgeBanding = { top: true, bottom: false, left: false, right: false, thickness: 1 };
      }

      // Check min manufacturing size for beam saw (Selco WNT 600 min dimension: 70mm)
      if (width < 70 || length < 70) {
        validationWarnings.push(
          `Parça "${comp.label}" boyutu (${length}x${width}mm) Selco testere min kesim ölçüsünden (70mm) küçük [UNVERIFIED].`
        );
      }

      const areaM2 = (length * width) / 1_000_000;
      let edgeBandMeters = 0;
      if (edgeBanding.top) edgeBandMeters += width / 1000;
      if (edgeBanding.bottom) edgeBandMeters += width / 1000;
      if (edgeBanding.left) edgeBandMeters += length / 1000;
      if (edgeBanding.right) edgeBandMeters += length / 1000;

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
          width: Math.round(width),
          height: Math.round(length),
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
        // Catalog C-C alone does not establish a verified mounting specification.
        handleSpacingMm: undefined,
        isInsetDoor,
      };

      const holes = generateDrillingForPart(parametricPart);
      totalDrillingHolesCount += holes.length;

      cutList.push({
        id: stablePartId,
        pieceName: comp.label,
        moduleName: module.name,
        moduleId: module.id,
        componentRole: comp.role,
        materialId: mat.id,
        materialName: mat.name,
        lengthMm: Math.round(length),
        widthMm: Math.round(width),
        thicknessMm,
        quantity: 1,
        edgeBanding,
        grain,
        areaM2: Number(areaM2.toFixed(3)),
        edgeBandMeters: Number(edgeBandMeters.toFixed(3)),
        holes,
      });
    });

    // Special Fittings hardware (wardrobe & kitchen accessories)
    module.bays.forEach((bay) => {
      bay.specialFittings?.forEach((fit) => {
        if (fit.type === "trouser_rack") {
          addHardware("807.95.122", "Häfele Teleskopik Pantolonluk Mekanizması", "special", 1, "adet", 38.0);
        } else if (fit.type === "shoe_rack") {
          addHardware("807.96.310", "Häfele Eğimli Metal Ayakkabılık Rafı", "special", 1, "adet", 26.0);
        } else if (fit.type === "wire_basket") {
          addHardware("807.52.220", "Frenli Raylı Tel Çamaşır Sepeti", "special", 1, "adet", 32.0);
        } else if (fit.type === "tie_rack") {
          addHardware("HW_FITTING_TIE", "Yandan Çıkışlı Kravatlık & Kemerlik", "special", 1, "adet", 19.5);
        } else if (fit.type === "led_profile") {
          addHardware("HW_FITTING_LED", "Alüminyum Gömme LED Aydınlatma Profili (Metretül)", "special", 1, "metre", 14.0);
        } else if (fit.type === "wardrobe_lift") {
          addHardware("805.20.232", "Servetto / Häfele Frenli Gardırop Asansörü (10kg)", "special", 1, "adet", 64.0);
        } else if (fit.type === "jewelry_tray") {
          addHardware("807.88.150", "Kadife Bölmeli Takı & Saat Çekmece Düzenleyici", "special", 1, "adet", 48.0);
        } else if (fit.type === "corner_lemans") {
          addHardware("541.32.240", "Kesseböhmer LeMans II Kör Köşe Mekanizması (2x25kg)", "special", 1, "takım", 195.0);
        } else if (fit.type === "pantry_pullout") {
          addHardware("545.13.251", "Kesseböhmer Dispensa Boy Kiler Mekanizması (100kg)", "special", 1, "takım", 260.0);
        } else if (fit.type === "waste_bin") {
          addHardware("502.70.252", "Häfele Raylı Çöp Ayrıştırma Sistemi (2x15L+30L)", "special", 1, "takım", 85.0);
        } else if (fit.type === "spice_pullout") {
          addHardware("545.61.211", "Teleskopik Dar Modül Şişelik & Baharatlık", "special", 1, "takım", 42.0);
        } else if (fit.type === "cutlery_tray") {
          addHardware("556.86.322", "Blum AMBIA-LINE Çatal-Kaşık Düzenleyici", "special", 1, "adet", 34.0);
        }
      });
    });
  });

  // Calculate material usage breakdown & estimated standard sheets
  const matUsageMap = new Map<string, { materialName: string; netAreaM2: number }>();
  let totalPanelAreaM2 = 0;
  let totalEdgeBandMeters = 0;

  cutList.forEach((piece) => {
    totalPanelAreaM2 += piece.areaM2;
    totalEdgeBandMeters += piece.edgeBandMeters;

    const cur = matUsageMap.get(piece.materialId) || { materialName: piece.materialName, netAreaM2: 0 };
    cur.netAreaM2 += piece.areaM2;
    matUsageMap.set(piece.materialId, cur);
  });

  const materialUsage = Array.from(matUsageMap.entries()).map(([materialId, data]) => {
    const grossAreaM2 = data.netAreaM2 * STANDARD_WASTE_FACTOR;
    const estimatedSheetsCount = Math.max(1, Math.ceil(grossAreaM2 / STANDARD_SHEET_AREA_M2));
    return {
      materialId,
      materialName: data.materialName,
      netAreaM2: Number(data.netAreaM2.toFixed(2)),
      grossAreaM2: Number(grossAreaM2.toFixed(2)),
      estimatedSheetsCount,
    };
  });

  const nestingResults = optimizeSheetNesting(cutList);
  const hardwareList = Array.from(hardwareMap.values());
  const totalHardwareCount = hardwareList.reduce((acc, h) => acc + h.quantity, 0);

  const result: ManufacturingBOM = {
    projectId: project.id,
    version: project.version,
    createdAt: new Date().toISOString(),
    approvalStatus: "draft",
    summary: {
      totalPiecesCount: cutList.length,
      totalPanelAreaM2: Number(totalPanelAreaM2.toFixed(2)),
      totalEdgeBandMeters: Number(totalEdgeBandMeters.toFixed(2)),
      totalHardwareCount,
      totalDrillingHolesCount,
    },
    cutList,
    hardwareList,
    materialUsage,
    nestingResults,
    validationWarnings,
  };
  if (bomProjectCache.size >= 32) bomProjectCache.delete(bomProjectCache.keys().next().value!);
  bomProjectCache.set(cacheKey, result);
  return result;
}
