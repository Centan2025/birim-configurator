import {
  ModuleInstance,
  calculateBayWidths,
  calculateNetInnerHeight,
  calculateNetInnerDepth,
  inferDoorSystemIdFromType,
} from "@birim/core";
import { ComponentGeometry, ModuleGeometryBreakdown } from "./types";

export interface GenerateGeometryOptions {
  doorOpenAngleDeg?: number; // 0 = closed, 90 = open
  drawerOpenMm?: number; // 0 = closed, 350 = pulled out
  explodedFactor?: number; // 0 = normal, 1 = fully exploded
}

export function generateModuleGeometry(
  module: ModuleInstance,
  options: GenerateGeometryOptions = {}
): ModuleGeometryBreakdown {
  const { doorOpenAngleDeg = 0, drawerOpenMm = 0, explodedFactor = 0 } = options;
  const { width, height, depth } = module.dimensions;
  const {
    panelThickness: T,
    backPanelThickness: T_back,
    plinthHeight,
    bodyMaterialId,
    doorMaterialId,
    doorPerimeterGap,
  } = module.carcass;

  // Handle complementary single-piece modules cleanly (Countertop, Backsplash, End Panel, Wall Filler)
  if (module.category === "complementary" && module.complementaryRole) {
    const compRole =
      module.complementaryRole === "countertop" || module.complementaryRole === "waterfall_edge"
        ? "countertop"
        : module.complementaryRole === "plinth_strip" || module.complementaryRole === "skirting"
        ? "plinth"
        : "carcass_side_left";
    return {
      moduleId: module.id,
      overall: module.dimensions,
      components: [
        {
          id: `${module.id}_comp_main`,
          role: compRole,
          label: module.name,
          dimensions: { width, height, depth },
          position: { x: 0, y: 0, z: 0 },
          materialId: bodyMaterialId,
          isFrontFacing: true,
        },
      ],
      bayWidths: [width],
      netInnerHeight: height,
      netInnerDepth: depth,
    };
  }

  const components: ComponentGeometry[] = [];
  const bayWidths = calculateBayWidths(module);
  const netInnerH = calculateNetInnerHeight(module);
  const netInnerD = calculateNetInnerDepth(module);

  // Exploded offsets
  const explodeX = explodedFactor > 0 ? explodedFactor * 250 : 0;
  const explodeY = explodedFactor > 0 ? explodedFactor * 200 : 0;
  const explodeZ = explodedFactor > 0 ? explodedFactor * 300 : 0;

  // 1. Plinth (Baza)
  if (plinthHeight > 0) {
    components.push({
      id: `${module.id}_plinth_front`,
      role: "plinth",
      label: "Baza Ön",
      dimensions: { width, height: plinthHeight, depth: T },
      position: { x: 0, y: explodeY > 0 ? -explodeY : 0, z: depth - T - 20 },
      materialId: bodyMaterialId,
    });
  }

  // 2. Left Side Panel
  const sideH = height - plinthHeight;
  components.push({
    id: `${module.id}_side_left`,
    role: "carcass_side_left",
    label: "Sol Yan Panel",
    dimensions: { width: T, height: sideH, depth },
    position: { x: explodeX > 0 ? -explodeX : 0, y: plinthHeight, z: 0 },
    materialId: bodyMaterialId,
  });

  // 3. Right Side Panel
  components.push({
    id: `${module.id}_side_right`,
    role: "carcass_side_right",
    label: "Sağ Yan Panel",
    dimensions: { width: T, height: sideH, depth },
    position: { x: width - T + explodeX, y: plinthHeight, z: 0 },
    materialId: bodyMaterialId,
  });

  // 4. Bottom Panel
  const innerSpanW = width - 2 * T;
  components.push({
    id: `${module.id}_bottom`,
    role: "carcass_bottom",
    label: "Alt Panel",
    dimensions: { width: innerSpanW, height: T, depth },
    position: { x: T, y: plinthHeight - explodeY * 0.5, z: 0 },
    materialId: bodyMaterialId,
  });

  // 5. Top Panel
  components.push({
    id: `${module.id}_top`,
    role: "carcass_top",
    label: "Üst Panel",
    dimensions: { width: innerSpanW, height: T, depth },
    position: { x: T, y: height - T + explodeY, z: 0 },
    materialId: bodyMaterialId,
  });

  // 6. Back Panel
  const backW = innerSpanW + 16;
  const backH = netInnerH + 16;
  components.push({
    id: `${module.id}_back`,
    role: "carcass_back",
    label: "Arkalık",
    dimensions: { width: backW, height: backH, depth: T_back },
    position: { x: T - 8, y: plinthHeight + T - 8, z: 12 - explodeZ * 0.8 },
    materialId: bodyMaterialId,
  });

  // 7. Bays, Internal Dividers, Shelves, Rails, Drawers & All 12 V4 Door Systems
  let currentX = T;

  module.bays.forEach((bay, bayIdx) => {
    const bayW = bayWidths[bayIdx] || 0;
    const bayStartX = currentX;

    // Intermediate Divider
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

    // Special Fittings
    bay.specialFittings?.forEach((fit, fIdx) => {
      components.push({
        id: fit.id || `${module.id}_bay_${bayIdx}_fit_${fIdx}`,
        role: "shelf",
        label: `Özel Donanım (${fit.type}) B${bayIdx + 1}`,
        bayIndex: bayIdx,
        dimensions: { width: bayW - 20, height: fit.height, depth: netInnerD - 40 },
        position: { x: bayStartX + 10, y: plinthHeight + T + fit.elevationY, z: 30 },
        materialId: "mat_metal_chrome",
      });
    });

    // Sub-dividers
    bay.subDividers?.forEach((sub, sdIdx) => {
      const divT = sub.thickness || T;
      const clampedX = Math.max(40, Math.min(Math.max(60, bayW - divT - 40), sub.offsetX));
      components.push({
        id: sub.id || `${module.id}_bay_${bayIdx}_subdiv_${sdIdx}`,
        role: "carcass_sub_divider",
        label: `Raf Arası Dikme B${bayIdx + 1}-${sdIdx + 1}`,
        bayIndex: bayIdx,
        dimensions: { width: divT, height: sub.height, depth: netInnerD - 10 },
        position: {
          x: bayStartX + clampedX,
          y: plinthHeight + T + sub.elevationY,
          z: 20,
        },
        materialId: bodyMaterialId,
      });
    });

    // Drawers with manufacturer cutting deduction support
    bay.drawers.forEach((drawer, dIdx) => {
      const frontH = drawer.height - 3;
      const frontW = bayW - 4;
      const pulledZ = drawerOpenMm;
      const boxD = drawer.nominalLengthMm
        ? Math.min(netInnerD - 15, drawer.nominalLengthMm - 10)
        : Math.min(500, Math.max(300, netInnerD - 50));
      const boxH = Math.max(70, Math.min(220, frontH - 35));
      const boxT = 16;
      const bottomT = 8;
      const drawerY0 = plinthHeight + T + drawer.elevationY;
      // Respect manufacturer width deduction (24mm AvanTech, 35mm LEGRABOX, 42mm MOVENTO)
      const sideClearance =
        drawer.hardwareProductId === "hw_hettich_avantech_m"
          ? 12
          : drawer.hardwareProductId?.includes("movento")
          ? 21
          : 18;
      const boxX0 = bayStartX + sideClearance;
      const boxW = Math.max(100, bayW - 2 * sideClearance);
      const boxZ0 = depth - T - boxD + pulledZ + explodeZ;

      // 1. Front Panel
      components.push({
        id: `${drawer.id}_front`,
        role: "drawer_front",
        label: `Çekmece Önü B${bayIdx + 1}-${dIdx + 1}`,
        bayIndex: bayIdx,
        dimensions: { width: frontW, height: frontH, depth: T },
        position: {
          x: bayStartX + 2,
          y: drawerY0 + 1.5,
          z: depth - T + pulledZ + explodeZ - (drawer.isInternal ? 24 : 0),
        },
        materialId: drawer.frontMaterialId || doorMaterialId,
        isFrontFacing: true,
      });

      // 2. Handle on Front Panel (skip if internal drawer or handleless)
      if (!drawer.isInternal && bay.door.handleCategory !== "handleless_plain") {
        const handleW = Math.min(240, Math.max(120, frontW * 0.4));
        components.push({
          id: `${drawer.id}_handle`,
          role: "drawer_handle",
          label: `Çekmece Kulpu B${bayIdx + 1}-${dIdx + 1}`,
          bayIndex: bayIdx,
          dimensions: { width: handleW, height: 12, depth: 16 },
          position: {
            x: bayStartX + 2 + (frontW - handleW) / 2,
            y: drawerY0 + frontH - 24,
            z: depth + pulledZ + explodeZ,
          },
          materialId: "mat_anodized_metal",
          isFrontFacing: true,
        });
      }

      // 3. Left Side Panel of Box
      components.push({
        id: `${drawer.id}_side_left`,
        role: "drawer_side_left",
        label: `Çekmece Sol Kasa B${bayIdx + 1}-${dIdx + 1}`,
        bayIndex: bayIdx,
        dimensions: { width: boxT, height: boxH, depth: boxD },
        position: { x: boxX0, y: drawerY0 + 8, z: boxZ0 },
        materialId: bodyMaterialId,
      });

      // 4. Right Side Panel of Box
      components.push({
        id: `${drawer.id}_side_right`,
        role: "drawer_side_right",
        label: `Çekmece Sağ Kasa B${bayIdx + 1}-${dIdx + 1}`,
        bayIndex: bayIdx,
        dimensions: { width: boxT, height: boxH, depth: boxD },
        position: { x: boxX0 + boxW - boxT, y: drawerY0 + 8, z: boxZ0 },
        materialId: bodyMaterialId,
      });

      // 5. Back Panel of Box
      components.push({
        id: `${drawer.id}_back`,
        role: "drawer_back",
        label: `Çekmece Arka Kasa B${bayIdx + 1}-${dIdx + 1}`,
        bayIndex: bayIdx,
        dimensions: { width: boxW - 2 * boxT, height: boxH, depth: boxT },
        position: { x: boxX0 + boxT, y: drawerY0 + 8, z: boxZ0 },
        materialId: bodyMaterialId,
      });

      // 6. Bottom Floor Board of Box
      components.push({
        id: `${drawer.id}_bottom`,
        role: "drawer_bottom",
        label: `Çekmece Tabanı B${bayIdx + 1}-${dIdx + 1}`,
        bayIndex: bayIdx,
        dimensions: { width: boxW - 2 * boxT, height: bottomT, depth: boxD - boxT },
        position: { x: boxX0 + boxT, y: drawerY0 + 8, z: boxZ0 + boxT },
        materialId: bodyMaterialId,
      });

      // 7. Left & Right Undermount Slide Rails
      components.push({
        id: `${drawer.id}_slide_left`,
        role: "drawer_slide",
        label: `Çekmece Rayı Sol B${bayIdx + 1}-${dIdx + 1}`,
        bayIndex: bayIdx,
        dimensions: { width: 12, height: 16, depth: boxD + 10 },
        position: {
          x: bayStartX + 4,
          y: drawerY0 + 2,
          z: depth - T - boxD - 10 + (pulledZ > 0 ? pulledZ * 0.5 : 0),
        },
        materialId: "mat_anodized_metal",
      });

      components.push({
        id: `${drawer.id}_slide_right`,
        role: "drawer_slide",
        label: `Çekmece Rayı Sağ B${bayIdx + 1}-${dIdx + 1}`,
        bayIndex: bayIdx,
        dimensions: { width: 12, height: 16, depth: boxD + 10 },
        position: {
          x: bayStartX + bayW - 16,
          y: drawerY0 + 2,
          z: depth - T - boxD - 10 + (pulledZ > 0 ? pulledZ * 0.5 : 0),
        },
        materialId: "mat_anodized_metal",
      });
    });

    // Doors — All 12 V4 Motion Categories
    if (!module.isOpenFront && bay.door && bay.door.type !== "open" && bay.door.doorSystemId !== "open") {
      const dType = bay.door.type;
      const dSys = bay.door.doorSystemId || inferDoorSystemIdFromType(dType);
      const isInset = bay.door.overlayType === "inset" || dSys === "hinged_inset" || dType.startsWith("inset");
      const isHalfOverlay =
        bay.door.overlayType === "half_overlay" ||
        dSys === "hinged_overlay_variant" ||
        dType.startsWith("half_overlay");

      const golaDeduct = bay.door.handleCategory === "gola_profile" ? 30 : 0;
      const doorH = isInset
        ? Math.max(80, netInnerH - 2 * doorPerimeterGap - golaDeduct)
        : Math.max(80, netInnerH + 2 * T - 2 * doorPerimeterGap - golaDeduct);
      const doorY = isInset
        ? plinthHeight + T + doorPerimeterGap
        : plinthHeight + doorPerimeterGap;
      const doorZ = isInset ? depth - T + explodeZ : depth + explodeZ;
      const rad = (doorOpenAngleDeg * Math.PI) / 180;
      const openRatio = Math.min(1, Math.max(0, doorOpenAngleDeg / 90));
      const doorMatId = bay.door.doorMaterialId || doorMaterialId;
      const T_door = bay.door.doorThicknessMm || module.carcass.doorThickness || T;

      const leftOverlay = isInset
        ? -doorPerimeterGap
        : isHalfOverlay
        ? T / 2 - doorPerimeterGap / 2
        : bayIdx === 0
        ? T - doorPerimeterGap / 2
        : T / 2 - doorPerimeterGap / 2;
      const rightOverlay = isInset
        ? -doorPerimeterGap
        : isHalfOverlay
        ? T / 2 - doorPerimeterGap / 2
        : bayIdx === module.bays.length - 1
        ? T - doorPerimeterGap / 2
        : T / 2 - doorPerimeterGap / 2;

      const fullDoorW = Math.max(80, bayW + leftOverlay + rightOverlay);
      const doorX0 = isInset ? bayStartX + doorPerimeterGap : bayStartX - leftOverlay;

      if (dSys === "hinged_double" || dType === "double" || dType === "inset_double") {
        const leafW = (fullDoorW - doorPerimeterGap) / 2;
        components.push({
          id: `${bay.door.id}_leaf_left`,
          role: "door_left",
          label: `Çift Kapak Sol B${bayIdx + 1}`,
          bayIndex: bayIdx,
          dimensions: { width: leafW, height: doorH, depth: T_door },
          position: { x: doorX0, y: doorY, z: doorZ },
          rotation: [0, -rad, 0],
          materialId: doorMatId,
          isFrontFacing: true,
        });
        components.push({
          id: `${bay.door.id}_leaf_right`,
          role: "door_right",
          label: `Çift Kapak Sağ B${bayIdx + 1}`,
          bayIndex: bayIdx,
          dimensions: { width: leafW, height: doorH, depth: T_door },
          position: { x: doorX0 + leafW + doorPerimeterGap, y: doorY, z: doorZ },
          rotation: [0, rad, 0],
          materialId: doorMatId,
          isFrontFacing: true,
        });
      } else if (dSys === "sliding_top_hung" || dSys === "sliding_bottom_rolling" || dType === "sliding") {
        const slideOffset = openRatio * (bayW * 0.75);
        const doorW = bayW + T;
        const trackZOffset = dSys === "sliding_bottom_rolling" ? -18 : bayIdx % 2 === 0 ? 0 : 25;
        components.push({
          id: `${bay.door.id}_sliding`,
          role: "door_left",
          label: `${dSys === "sliding_bottom_rolling" ? "Alttan Sürgülü" : "Üstten Sürgülü"} Kapak B${bayIdx + 1}`,
          bayIndex: bayIdx,
          dimensions: { width: doorW, height: doorH, depth: T_door },
          position: {
            x: bayStartX - (bayIdx === 0 ? T : 0) + slideOffset,
            y: doorY,
            z: doorZ + trackZOffset,
          },
          materialId: doorMatId,
          isFrontFacing: true,
        });
      } else if (dSys === "lift_up_stay" || dType === "lift_up_stay") {
        // Pivots upward around top edge (X-axis rotation)
        components.push({
          id: `${bay.door.id}_lift_stay`,
          role: "door_left",
          label: `Yukarı Kalkar Kapak (HK top) B${bayIdx + 1}`,
          bayIndex: bayIdx,
          dimensions: { width: fullDoorW, height: doorH, depth: T_door },
          position: {
            x: doorX0,
            y: doorY + openRatio * (doorH * 0.45),
            z: doorZ + openRatio * (doorH * 0.65),
          },
          rotation: [-rad * 0.95, 0, 0],
          materialId: doorMatId,
          isFrontFacing: true,
        });
      } else if (dSys === "lift_parallel") {
        // Lifts parallel upward and outward without tilting
        components.push({
          id: `${bay.door.id}_lift_parallel`,
          role: "door_left",
          label: `Paralel Kalkar Kapak (HL top) B${bayIdx + 1}`,
          bayIndex: bayIdx,
          dimensions: { width: fullDoorW, height: doorH, depth: T_door },
          position: {
            x: doorX0,
            y: doorY + openRatio * Math.min(420, doorH * 0.85),
            z: doorZ + openRatio * 180,
          },
          materialId: doorMatId,
          isFrontFacing: true,
        });
      } else if (dSys === "lift_bi_fold") {
        // Horizontal 2-leaf bi-fold lift (AVENTOS HF top)
        const halfH = (doorH - doorPerimeterGap) / 2;
        components.push({
          id: `${bay.door.id}_lift_bifold_top`,
          role: "door_left",
          label: `Katlanır Kalkar Üst Kanat B${bayIdx + 1}`,
          bayIndex: bayIdx,
          dimensions: { width: fullDoorW, height: halfH, depth: T_door },
          position: {
            x: doorX0,
            y: doorY + halfH + doorPerimeterGap + openRatio * (halfH * 0.45),
            z: doorZ + openRatio * (halfH * 0.65),
          },
          rotation: [-rad * 0.95, 0, 0],
          materialId: doorMatId,
          isFrontFacing: true,
        });
        components.push({
          id: `${bay.door.id}_lift_bifold_bot`,
          role: "door_right",
          label: `Katlanır Kalkar Alt Kanat B${bayIdx + 1}`,
          bayIndex: bayIdx,
          dimensions: { width: fullDoorW, height: halfH, depth: T_door },
          position: {
            x: doorX0,
            y: doorY + openRatio * (halfH * 1.15),
            z: doorZ + openRatio * (halfH * 0.85),
          },
          rotation: [rad * 0.55, 0, 0],
          materialId: doorMatId,
          isFrontFacing: true,
        });
      } else if (dSys === "folding_side" || dType === "folding") {
        // Side bi-fold (WingLine L): 2 narrow vertical leaves folding together
        const wingW = (fullDoorW - doorPerimeterGap) / 2;
        components.push({
          id: `${bay.door.id}_fold_wing_1`,
          role: "door_left",
          label: `Katlanır Sol Kanat B${bayIdx + 1}`,
          bayIndex: bayIdx,
          dimensions: { width: wingW, height: doorH, depth: T_door },
          position: { x: doorX0, y: doorY, z: doorZ },
          rotation: [0, -rad * 0.95, 0],
          materialId: doorMatId,
          isFrontFacing: true,
        });
        components.push({
          id: `${bay.door.id}_fold_wing_2`,
          role: "door_right",
          label: `Katlanır Orta Kanat B${bayIdx + 1}`,
          bayIndex: bayIdx,
          dimensions: { width: wingW, height: doorH, depth: T_door },
          position: {
            x: doorX0 + wingW * (1 - openRatio * 0.85) + doorPerimeterGap,
            y: doorY,
            z: doorZ + openRatio * (wingW * 0.75),
          },
          rotation: [0, rad * 0.85, 0],
          materialId: doorMatId,
          isFrontFacing: true,
        });
      } else if (dSys === "pocket_retractable" || dType === "pocket") {
        // Pocket door (REVEGO / Concepta III): pivots 90 deg and slides back into side pocket
        const retractZ = openRatio > 0.3 ? ((openRatio - 0.3) / 0.7) * Math.min(480, depth * 0.72) : 0;
        components.push({
          id: `${bay.door.id}_pocket_leaf`,
          role: "door_left",
          label: `Pocket Gizlenen Kapak B${bayIdx + 1}`,
          bayIndex: bayIdx,
          dimensions: { width: fullDoorW, height: doorH, depth: T_door },
          position: {
            x: doorX0 + openRatio * 24,
            y: doorY,
            z: doorZ - retractZ,
          },
          rotation: [0, -Math.min(Math.PI / 2, rad * 1.15), 0],
          materialId: doorMatId,
          isFrontFacing: true,
        });
      } else if (dSys === "tambour_roller" || dType === "tambour") {
        // Tambour roller shutter rolls up into top box
        const visibleH = Math.max(60, doorH * (1 - openRatio * 0.82));
        components.push({
          id: `${bay.door.id}_tambour_curtain`,
          role: "door_left",
          label: `Tambur Panjur Kapak (Önizleme) B${bayIdx + 1}`,
          bayIndex: bayIdx,
          dimensions: { width: fullDoorW, height: visibleH, depth: T_door },
          position: {
            x: doorX0,
            y: doorY + (doorH - visibleH),
            z: doorZ - 8,
          },
          materialId: doorMatId,
          isFrontFacing: true,
        });
      } else {
        // Single Left or Right Hinged (including Inset & Half-Overlay)
        const isRight = dType === "single_right" || dType === "inset_right" || dType === "half_overlay_right";
        components.push({
          id: `${bay.door.id}_${isRight ? "right" : "left"}`,
          role: isRight ? "door_right" : "door_left",
          label: `Kapak ${isRight ? "Sağ" : "Sol"}${isInset ? " (İçten)" : isHalfOverlay ? " (Yarım Bini)" : ""} B${bayIdx + 1}`,
          bayIndex: bayIdx,
          dimensions: { width: fullDoorW, height: doorH, depth: T_door },
          position: { x: doorX0, y: doorY, z: doorZ },
          rotation: [0, isRight ? rad : -rad, 0],
          materialId: doorMatId,
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

export function generateMultiModuleGeometry(
  modules: ModuleInstance[],
  options: GenerateGeometryOptions = {}
): ModuleGeometryBreakdown[] {
  return modules.map((m) => generateModuleGeometry(m, options));
}
