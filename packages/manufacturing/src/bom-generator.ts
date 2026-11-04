import { DesignProject, ModuleInstance, MaterialDefinition, DEFAULT_MATERIALS } from "@birim/core";
import { generateModuleGeometry } from "@birim/geometry";
import { CutPiece, EdgeBandingConfig, HardwareBOMItem, ManufacturingBOM } from "./types";

const STANDARD_SHEET_AREA_M2 = (2800 * 2070) / 1_000_000; // 5.796 m²
const STANDARD_WASTE_FACTOR = 1.12; // %12 fire payı

export function generateBOMForProject(
  project: DesignProject,
  materialsMap: Map<string, MaterialDefinition> = new Map(DEFAULT_MATERIALS.map((m) => [m.id, m]))
): ManufacturingBOM {
  const cutList: CutPiece[] = [];
  const hardwareMap: Map<string, HardwareBOMItem> = new Map();
  const validationWarnings: string[] = [];

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
    // 4 for top panel, 4 for bottom panel, 4 per internal divider
    const numDividers = Math.max(0, module.bays.length - 1);
    const minifixCount = 8 + numDividers * 4;
    addHardware("HW_MINIFIX_SET", "Häfele Minifix + Dübel Bağlantı Elemanı", "connector", minifixCount, "adet", 0.45);
    addHardware("HW_DOWEL_8X35", "Ahşap Kavela 8x35mm", "fastener", minifixCount, "adet", 0.05);

    // Plinth adjustable leveling feet
    const feetCount = Math.max(4, Math.ceil(module.dimensions.width / 450) * 2);
    addHardware("HW_LEVELING_FEET", "Ayarlanabilir Baza Ayağı 80-100mm", "leg", feetCount, "adet", 1.2);

    geo.components.forEach((comp) => {
      let mat = bodyMat;
      let grain: CutPiece["grain"] = "lengthwise";
      let edgeBanding: EdgeBandingConfig = {
        top: false,
        bottom: false,
        left: false,
        right: false,
        thickness: module.carcass.edgeBandThickness,
      };

      // Determine dimensions, grain & edge banding per part type
      let length = comp.dimensions.height;
      let width = comp.dimensions.depth;
      const thickness = comp.dimensions.width;

      if (comp.role.includes("side")) {
        // Vertical side panels: height = length, depth = width, front & bottom edge banded
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
        // Shelf support pins
        addHardware("HW_SHELF_PIN", "Kilitli Raf Pimi 5mm (Häfele)", "fastener", 4, "adet", 0.15);
      } else if (comp.role === "hanging_rail") {
        // Rail is hardware, not cut board
        addHardware("HW_HANGING_RAIL", `Oval Alüminyum Elbise Askı Borusu ${length}mm`, "rod", 1, "adet", 4.5);
        addHardware("HW_RAIL_SOCKET", "Askı Borusu Flanşı (Sağ-Sol Takım)", "connector", 1, "takım", 1.8);
        return;
      } else if (comp.role.includes("door")) {
        mat = doorMat;
        length = comp.dimensions.height;
        width = comp.dimensions.width;
        // All 4 edges banded with 1mm/2mm ABS
        edgeBanding = { top: true, bottom: true, left: true, right: true, thickness: 1 };

        // Hinges based on door height
        const hingesNeeded = length > 2000 ? 5 : length > 1600 ? 4 : length > 900 ? 3 : 2;
        addHardware("HW_BLUM_HINGE_110", "Blum Clip Top Blumotion 110° Frenli Menteşe", "hinge", hingesNeeded, "adet", 3.8);
        addHardware("HW_HANDLE_BAR", "Birim Özel Profil Metal Mobilya Kulpu 200mm", "handle", 1, "adet", 6.5);
      } else if (comp.role === "drawer_front") {
        mat = doorMat;
        length = comp.dimensions.width;
        width = comp.dimensions.height;
        edgeBanding = { top: true, bottom: true, left: true, right: true, thickness: 1 };
        addHardware("HW_DRAWER_HANDLE", "Çekmece Gizli Entegre Kulp", "handle", 1, "adet", 4.5);
      } else if (comp.role === "drawer_box") {
        // Drawer box & tandem slides
        addHardware("HW_BLUM_TANDEM_BOX", "Blum Antaro / Tandembox Çekmece Rayı Frenli 500mm", "slide", 1, "takım", 28.0);
        return; // Box is assembled from slides & bottom
      } else if (comp.role === "plinth") {
        length = comp.dimensions.width;
        width = comp.dimensions.height;
        edgeBanding = { top: true, bottom: false, left: false, right: false, thickness: 1 };
      }

      // Check min manufacturing size for beam saw (Selco WNT 600 min dimension: 70mm)
      if (width < 70 || length < 70) {
        validationWarnings.push(
          `Parça "${comp.label}" boyutu (${length}x${width}mm) Selco testere min kesim ölçüsünden (70mm) küçük.`
        );
      }

      // Calculate area and edgeband linear meters
      const areaM2 = (length * width) / 1_000_000;
      let edgeBandMeters = 0;
      if (edgeBanding.top) edgeBandMeters += width / 1000;
      if (edgeBanding.bottom) edgeBandMeters += width / 1000;
      if (edgeBanding.left) edgeBandMeters += length / 1000;
      if (edgeBanding.right) edgeBandMeters += length / 1000;

      cutList.push({
        id: comp.id,
        pieceName: comp.label,
        moduleName: module.name,
        componentRole: comp.role,
        materialId: mat.id,
        materialName: mat.name,
        lengthMm: Math.round(length),
        widthMm: Math.round(width),
        thicknessMm: Math.round(comp.role === "carcass_back" ? module.carcass.backPanelThickness : comp.dimensions.width || 18),
        quantity: 1,
        edgeBanding,
        grain,
        areaM2: Number(areaM2.toFixed(3)),
        edgeBandMeters: Number(edgeBandMeters.toFixed(3)),
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

  const hardwareList = Array.from(hardwareMap.values());
  const totalHardwareCount = hardwareList.reduce((acc, h) => acc + h.quantity, 0);

  return {
    projectId: project.id,
    version: project.version,
    createdAt: new Date().toISOString(),
    summary: {
      totalPiecesCount: cutList.length,
      totalPanelAreaM2: Number(totalPanelAreaM2.toFixed(2)),
      totalEdgeBandMeters: Number(totalEdgeBandMeters.toFixed(2)),
      totalHardwareCount,
    },
    cutList,
    hardwareList,
    materialUsage,
    validationWarnings,
  };
}
