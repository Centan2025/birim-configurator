import { ModuleInstance, calculateBayWidths, calculateNetInnerHeight, calculateNetInnerDepth } from "@birim/core";
import { ComponentGeometry, ModuleGeometryBreakdown } from "./types";

export interface GenerateGeometryOptions {
  doorOpenAngleDeg?: number; // 0 = closed, 90 = open
}

export function generateModuleGeometry(
  module: ModuleInstance,
  options: GenerateGeometryOptions = {}
): ModuleGeometryBreakdown {
  const { doorOpenAngleDeg = 0 } = options;
  const { width, height, depth } = module.dimensions;
  const {
    panelThickness: T,
    backPanelThickness: T_back,
    plinthHeight,
    bodyMaterialId,
    doorMaterialId,
    doorPerimeterGap,
  } = module.carcass;

  const components: ComponentGeometry[] = [];
  const bayWidths = calculateBayWidths(module);
  const netInnerH = calculateNetInnerHeight(module);
  const netInnerD = calculateNetInnerDepth(module);

  // 1. Plinth (Baza)
  if (plinthHeight > 0) {
    components.push({
      id: `${module.id}_plinth_front`,
      role: "plinth",
      label: "Baza Ön",
      dimensions: { width: width, height: plinthHeight, depth: T },
      position: { x: 0, y: 0, z: depth - T - 20 }, // 20mm inset
      materialId: bodyMaterialId,
    });
  }

  // 2. Left Side Panel (Sol Yan)
  const sideH = height - plinthHeight;
  components.push({
    id: `${module.id}_side_left`,
    role: "carcass_side_left",
    label: "Sol Yan Panel",
    dimensions: { width: T, height: sideH, depth },
    position: { x: 0, y: plinthHeight, z: 0 },
    materialId: bodyMaterialId,
  });

  // 3. Right Side Panel (Sağ Yan)
  components.push({
    id: `${module.id}_side_right`,
    role: "carcass_side_right",
    label: "Sağ Yan Panel",
    dimensions: { width: T, height: sideH, depth },
    position: { x: width - T, y: plinthHeight, z: 0 },
    materialId: bodyMaterialId,
  });

  // 4. Bottom Panel (Alt Panel)
  const innerSpanW = width - 2 * T;
  components.push({
    id: `${module.id}_bottom`,
    role: "carcass_bottom",
    label: "Alt Panel",
    dimensions: { width: innerSpanW, height: T, depth },
    position: { x: T, y: plinthHeight, z: 0 },
    materialId: bodyMaterialId,
  });

  // 5. Top Panel (Üst Panel)
  components.push({
    id: `${module.id}_top`,
    role: "carcass_top",
    label: "Üst Panel",
    dimensions: { width: innerSpanW, height: T, depth },
    position: { x: T, y: height - T, z: 0 },
    materialId: bodyMaterialId,
  });

  // 6. Back Panel (Arkalık)
  const backW = innerSpanW + 16; // 8mm groove on each side
  const backH = netInnerH + 16;
  components.push({
    id: `${module.id}_back`,
    role: "carcass_back",
    label: "Arkalık",
    dimensions: { width: backW, height: backH, depth: T_back },
    position: { x: T - 8, y: plinthHeight + T - 8, z: 12 },
    materialId: bodyMaterialId,
  });

  // 7. Bays, Internal Dividers, Shelves, Rails, Drawers & Doors
  let currentX = T;

  module.bays.forEach((bay, bayIdx) => {
    const bayW = bayWidths[bayIdx] || 0;
    const bayStartX = currentX;

    // Intermediate Divider (Dikme) if not the last bay
    if (bayIdx < module.bays.length - 1) {
      const dividerX = bayStartX + bayW;
      components.push({
        id: `${module.id}_divider_${bayIdx}`,
        role: "carcass_divider",
        label: `Ara Dikme ${bayIdx + 1}`,
        bayIndex: bayIdx,
        dimensions: { width: T, height: netInnerH, depth: netInnerD },
        position: { x: dividerX, y: plinthHeight + T, z: 20 },
        materialId: bodyMaterialId,
      });
    }

    // Shelves
    bay.shelves.forEach((shelf, sIdx) => {
      const shelfT = shelf.thickness || T;
      components.push({
        id: shelf.id || `${module.id}_bay_${bayIdx}_shelf_${sIdx}`,
        role: "shelf",
        label: `Raf B${bayIdx + 1}-${sIdx + 1} (${shelf.isAdjustable ? "Hareketli" : "Sabit"})`,
        bayIndex: bayIdx,
        dimensions: { width: bayW - 2, height: shelfT, depth: netInnerD - 10 },
        position: { x: bayStartX + 1, y: plinthHeight + T + shelf.elevationY, z: 20 },
        materialId: bodyMaterialId,
      });
    });

    // Hanging Rails
    bay.hangingRails.forEach((rail, rIdx) => {
      components.push({
        id: rail.id || `${module.id}_bay_${bayIdx}_rail_${rIdx}`,
        role: "hanging_rail",
        label: `Askı Borusu B${bayIdx + 1}-${rIdx + 1}`,
        bayIndex: bayIdx,
        dimensions: { width: bayW, height: 25, depth: 15 },
        position: { x: bayStartX, y: plinthHeight + T + rail.elevationY, z: depth / 2 },
        materialId: "mat_metal_chrome",
      });
    });

    // Drawers
    bay.drawers.forEach((drawer, dIdx) => {
      // Drawer Front (Klapa)
      const frontH = drawer.height - 3;
      const frontW = bayW - 4;
      components.push({
        id: `${drawer.id}_front`,
        role: "drawer_front",
        label: `Çekmece Önü B${bayIdx + 1}-${dIdx + 1}`,
        bayIndex: bayIdx,
        dimensions: { width: frontW, height: frontH, depth: T },
        position: { x: bayStartX + 2, y: plinthHeight + T + drawer.elevationY + 1.5, z: depth - T },
        materialId: drawer.frontMaterialId || doorMaterialId,
        isFrontFacing: true,
      });

      // Drawer Inner Box
      components.push({
        id: `${drawer.id}_box`,
        role: "drawer_box",
        label: `Çekmece Gövdesi B${bayIdx + 1}-${dIdx + 1}`,
        bayIndex: bayIdx,
        dimensions: { width: bayW - 24, height: Math.max(60, frontH - 40), depth: Math.min(500, netInnerD - 50) },
        position: { x: bayStartX + 12, y: plinthHeight + T + drawer.elevationY + 10, z: 40 },
        materialId: bodyMaterialId,
      });
    });

    // Doors (if front is not open and bay door is defined)
    if (!module.isOpenFront && bay.door && bay.door.type !== "open") {
      const doorH = netInnerH + 2 * T - 2 * doorPerimeterGap;
      const doorY = plinthHeight + doorPerimeterGap;
      const doorZ = depth; // flush against front carcass edge
      const rad = (doorOpenAngleDeg * Math.PI) / 180;

      if (bay.door.type === "single_left") {
        const doorW = bayW + (bayIdx === 0 ? T : T / 2) + (bayIdx === module.bays.length - 1 ? T : T / 2) - doorPerimeterGap;
        components.push({
          id: `${bay.door.id}_left`,
          role: "door_left",
          label: `Kapak Sol B${bayIdx + 1}`,
          bayIndex: bayIdx,
          dimensions: { width: doorW, height: doorH, depth: T },
          position: { x: bayStartX - (bayIdx === 0 ? T : T / 2) + doorPerimeterGap / 2, y: doorY, z: doorZ },
          rotation: [0, -rad, 0],
          materialId: bay.door.doorMaterialId || doorMaterialId,
          isFrontFacing: true,
        });
      } else if (bay.door.type === "single_right") {
        const doorW = bayW + (bayIdx === 0 ? T : T / 2) + (bayIdx === module.bays.length - 1 ? T : T / 2) - doorPerimeterGap;
        components.push({
          id: `${bay.door.id}_right`,
          role: "door_right",
          label: `Kapak Sağ B${bayIdx + 1}`,
          bayIndex: bayIdx,
          dimensions: { width: doorW, height: doorH, depth: T },
          position: { x: bayStartX - (bayIdx === 0 ? T : T / 2) + doorPerimeterGap / 2, y: doorY, z: doorZ },
          rotation: [0, rad, 0],
          materialId: bay.door.doorMaterialId || doorMaterialId,
          isFrontFacing: true,
        });
      } else if (bay.door.type === "double") {
        const totalSpan = bayW + (bayIdx === 0 ? T : T / 2) + (bayIdx === module.bays.length - 1 ? T : T / 2);
        const leafW = (totalSpan - 3 * doorPerimeterGap) / 2;

        // Left leaf
        components.push({
          id: `${bay.door.id}_leaf_left`,
          role: "door_left",
          label: `Çift Kapak Sol B${bayIdx + 1}`,
          bayIndex: bayIdx,
          dimensions: { width: leafW, height: doorH, depth: T },
          position: { x: bayStartX - (bayIdx === 0 ? T : T / 2) + doorPerimeterGap, y: doorY, z: doorZ },
          rotation: [0, -rad, 0],
          materialId: bay.door.doorMaterialId || doorMaterialId,
          isFrontFacing: true,
        });

        // Right leaf
        components.push({
          id: `${bay.door.id}_leaf_right`,
          role: "door_right",
          label: `Çift Kapak Sağ B${bayIdx + 1}`,
          bayIndex: bayIdx,
          dimensions: { width: leafW, height: doorH, depth: T },
          position: { x: bayStartX - (bayIdx === 0 ? T : T / 2) + doorPerimeterGap + leafW + doorPerimeterGap, y: doorY, z: doorZ },
          rotation: [0, rad, 0],
          materialId: bay.door.doorMaterialId || doorMaterialId,
          isFrontFacing: true,
        });
      }
    }

    currentX += bayW + T;
  });

  return {
    moduleId: module.id,
    overall: module.dimensions,
    components,
    bayWidths,
    netInnerHeight: netInnerH,
    netInnerDepth: netInnerD,
  };
}
