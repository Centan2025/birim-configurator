import { DesignProject, ModuleInstance, MaterialDefinition, DEFAULT_MATERIALS, ParametricPart } from "@birim/core";
import { generateModuleGeometry } from "@birim/geometry";
import { CutPiece, EdgeBandingConfig, HardwareBOMItem, ManufacturingBOM } from "./types";
import { generateDrillingForPart } from "./drilling-engine";
import { optimizeSheetNesting } from "./sheet-nesting";

const STANDARD_SHEET_AREA_M2 = (2800 * 2070) / 1_000_000; // 5.796 m²
const STANDARD_WASTE_FACTOR = 1.12; // Flat 12% comparison reference

export function generateBOMForProject(
  project: DesignProject,
  materialsMap: Map<string, MaterialDefinition> = new Map(DEFAULT_MATERIALS.map((m) => [m.id, m]))
): ManufacturingBOM {
  const cutList: CutPiece[] = [];
  const hardwareMap: Map<string, HardwareBOMItem> = new Map();
  const validationWarnings: string[] = [];
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
    const bodyMat = materialsMap.get(module.carcass.bodyMaterialId) || DEFAULT_MATERIALS[0];
    const doorMat = materialsMap.get(module.carcass.doorMaterialId) || DEFAULT_MATERIALS[2];

    // Connectors per carcass (Minifix + Dowels):
    const numDividers = Math.max(0, module.bays.length - 1);
    const minifixCount = 8 + numDividers * 4;
    addHardware("HW_MINIFIX_SET", "Häfele Minifix + Dübel Bağlantı Elemanı", "connector", minifixCount, "adet", 0.45);
    addHardware("HW_DOWEL_8X35", "Ahşap Kavela 8x35mm", "fastener", minifixCount, "adet", 0.05);

    // Plinth adjustable leveling feet
    if (module.carcass.plinthHeight > 0) {
      const feetCount = Math.max(4, Math.ceil(module.dimensions.width / 450) * 2);
      addHardware("HW_LEVELING_FEET", "Ayarlanabilir Baza Ayağı 80-100mm", "leg", feetCount, "adet", 1.2);
    }

    // Process each component geometry
    geo.components.forEach((comp) => {
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

      if (comp.role.includes("side")) {
        length = comp.dimensions.height;
        width = comp.dimensions.depth;
        edgeBanding = { top: false, bottom: true, left: true, right: false, thickness: 1 };
      } else if (comp.role === "carcass_bottom" || comp.role === "carcass_top") {
        length = comp.dimensions.width;
        width = comp.dimensions.depth;
        edgeBanding = { top: false, bottom: false, left: true, right: false, thickness: 1 };
      } else if (comp.role === "carcass_divider") {
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
      } else if (comp.role === "hanging_rail") {
        addHardware("HW_HANGING_RAIL", `Oval Alüminyum Elbise Askı Borusu ${length}mm`, "rod", 1, "adet", 4.5);
        addHardware("HW_RAIL_SOCKET", "Askı Borusu Flanşı (Sağ-Sol Takım)", "connector", 1, "takım", 1.8);
        return;
      } else if (comp.role.includes("door")) {
        mat = doorMat;
        grain = mat.hasGrain ? "lengthwise" : "none";
        length = comp.dimensions.height;
        width = comp.dimensions.width;
        edgeBanding = { top: true, bottom: true, left: true, right: true, thickness: 1 };

        const hingesNeeded = length > 2000 ? 5 : length > 1600 ? 4 : length > 900 ? 3 : 2;
        addHardware("HW_BLUM_HINGE_110", "Blum Clip Top Blumotion 110° Frenli Menteşe", "hinge", hingesNeeded, "adet", 3.8);
        addHardware("HW_HANDLE_BAR", "Birim Özel Profil Metal Mobilya Kulpu 200mm", "handle", 1, "adet", 6.5);
      } else if (comp.role === "drawer_front") {
        mat = doorMat;
        grain = mat.hasGrain ? "lengthwise" : "none";
        length = comp.dimensions.width;
        width = comp.dimensions.height;
        edgeBanding = { top: true, bottom: true, left: true, right: true, thickness: 1 };
        addHardware("HW_DRAWER_HANDLE", "Çekmece Gizli Entegre Kulp", "handle", 1, "adet", 4.5);
      } else if (comp.role === "drawer_box") {
        addHardware("HW_BLUM_TANDEM_BOX", "Blum Antaro / Tandembox Çekmece Rayı Frenli 500mm", "slide", 1, "takım", 28.0);
        return;
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

      // Stable part ID
      const stablePartId = `P_${module.id}_${comp.id}`;
      const thicknessMm = Math.round(comp.role === "carcass_back" ? module.carcass.backPanelThickness : comp.dimensions.width || 18);

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

    // Special Fittings hardware (trouser rack, shoe rack, LED profiles)
    module.bays.forEach((bay) => {
      bay.specialFittings?.forEach((fit) => {
        if (fit.type === "trouser_rack") {
          addHardware("HW_FITTING_TROUSER", "Häfele Teleskopik Pantolonluk Mekanizması", "special", 1, "adet", 38.0);
        } else if (fit.type === "shoe_rack") {
          addHardware("HW_FITTING_SHOE", "Ayarlanabilir Eğimli Metal Ayakkabılık Rafı", "special", 1, "adet", 26.0);
        } else if (fit.type === "wire_basket") {
          addHardware("HW_FITTING_BASKET", "Frenli Raylı Tel Çamaşır Sepeti", "special", 1, "adet", 32.0);
        } else if (fit.type === "tie_rack") {
          addHardware("HW_FITTING_TIE", "Yandan Çıkışlı Kravatlık & Kemerlik", "special", 1, "adet", 19.5);
        } else if (fit.type === "led_profile") {
          addHardware("HW_FITTING_LED", "Alüminyum Gömme LED Aydınlatma Profili (Metretül)", "special", 1, "metre", 14.0);
        }
      });
    });
  });

  // Calculate material usage breakdown & estimated standard sheets (comparison baseline)
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

  // Compute Real 2D Guillotine Bin Packing Nesting Results
  const nestingResults = optimizeSheetNesting(cutList);

  const hardwareList = Array.from(hardwareMap.values());
  const totalHardwareCount = hardwareList.reduce((acc, h) => acc + h.quantity, 0);

  return {
    projectId: project.id,
    version: project.version,
    createdAt: new Date().toISOString(),
    approvalStatus: project.status === "production_approved" ? "production_approved" : "draft",
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
}
