import {
  ModuleInstance,
  calculateBayWidths,
  calculateNetInnerHeight,
  calculateNetInnerDepth,
  calculateFourSpaceDimensions,
  inferDoorSystemIdFromType,
} from "@birim/core";
import { ComponentGeometry, ModuleGeometryBreakdown } from "./types";
import { generateHandleGeometry } from "./handle-geometry";

export interface GenerateGeometryOptions {
  doorOpenAngleDeg?: number; // 0 = closed, 90 = open
  drawerOpenMm?: number; // 0 = closed, 350 = pulled out
  explodedFactor?: number; // 0 = normal, 1 = fully exploded
}

const moduleGeometryCache = new Map<string, ModuleGeometryBreakdown>();

export function generateModuleGeometry(
  module: ModuleInstance,
  options: GenerateGeometryOptions = {}
): ModuleGeometryBreakdown {
  const cacheKey = JSON.stringify([module, options]);
  const cached = moduleGeometryCache.get(cacheKey);
  if (cached) return cached;

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

  // Handle complementary single-piece modules cleanly (Countertop, Backsplash, End Panel, Wall Filler, Leveling Feet, Wall Bracket)
  if (module.category === "complementary") {
    const cRole = module.complementaryRole || "end_panel";
    const nonPanelRoles = new Set([
      "leveling_feet",
      "led_channel",
      "wall_bracket",
      "service_spacer",
    ]);
    const isPanel = !nonPanelRoles.has(cRole);
    const compRole =
      cRole === "countertop" || cRole === "waterfall_edge"
        ? "countertop"
        : cRole === "plinth_strip" || cRole === "skirting"
        ? "plinth"
        : isPanel
        ? "carcass_side_left"
        : "special_fitting";
    const minAxis =
      width <= height && width <= depth ? "x" : height <= width && height <= depth ? "y" : "z";
    const compResult: ModuleGeometryBreakdown = {
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
          isManufacturablePanel: isPanel,
          thicknessAxis: isPanel ? minAxis : undefined,
        },
      ],
      bayWidths: [width],
      netInnerHeight: height,
      netInnerDepth: depth,
    };
    moduleGeometryCache.set(cacheKey, compResult);
    return compResult;
  }

  const components: ComponentGeometry[] = [];
  const fourSpace = calculateFourSpaceDimensions(module);
  const bayWidths = calculateBayWidths(module);
  const netInnerH = calculateNetInnerHeight(module);
  const netInnerD = calculateNetInnerDepth(module);

  // Exploded offsets
  const explodeX = explodedFactor > 0 ? explodedFactor * 250 : 0;
  const explodeY = explodedFactor > 0 ? explodedFactor * 200 : 0;
  const explodeZ = explodedFactor > 0 ? explodedFactor * 300 : 0;

  const innerSpanW = width - 2 * T;
  const tplLowerCheck = (module.templateId || "").toLowerCase();
  const nameLowerCheck = (module.name || "").toLowerCase();
  const isWardrobe =
    !module.category ||
    module.category.startsWith("wardrobe") ||
    module.category === "special_corner" ||
    module.moduleFamilyId === "fam_wardrobe" ||
    module.moduleFamilyId === "fam_special_corner" ||
    Boolean(module.templateId?.startsWith("tpl_wd_")) ||
    Boolean(module.templateId?.startsWith("tpl_wardrobe")) ||
    Boolean(module.templateId?.startsWith("tpl_sc_")) ||
    (Boolean(module.isCorner) && height >= 1400);

  const isDiagonalCorner =
    Boolean(module.isCorner) &&
    (tplLowerCheck.includes("diagonal") ||
      nameLowerCheck.includes("diyagonal") ||
      nameLowerCheck.includes("45°")) &&
    width >= 620 &&
    depth >= 620;

  const isTrueLCorner =
    Boolean(module.isCorner) &&
    !isDiagonalCorner &&
    !tplLowerCheck.includes("blind") &&
    !tplLowerCheck.includes("outer_corner") &&
    !nameLowerCheck.includes("kör") &&
    !nameLowerCheck.includes("dış köşe") &&
    width >= 620 &&
    depth >= 620;

  if (isTrueLCorner) {
    const isWallL = module.category === "kitchen_wall" || module.moduleFamilyId === "fam_kitchen_wall";
    const wingD = isWallL
      ? Math.min(360, Math.round(depth * 0.56))
      : isWardrobe
      ? Math.min(600, Math.round(depth * 0.58))
      : Math.min(580, Math.round(depth * 0.64));
    const returnSpanZ = Math.max(180, depth - wingD);
    // In wardrobes / tall corners, ALL vertical uprights (dikmeler) extend all the way down to the floor (y = 0)!
    const sideY = isWardrobe ? 0 : plinthHeight;
    const sideH = isWardrobe ? height : height - plinthHeight;
    const netH = Math.max(120, height - plinthHeight - 2 * T);

    // 1. Floor-standing Plinth (for Wardrobe) OR Adjustable Black Plastic Kitchen Legs (for Kitchen L-Corner Base)
    if (plinthHeight > 0) {
      if (isWardrobe) {
        components.push(
          {
            id: `${module.id}_plinth_front_x`,
            role: "plinth",
            label: "Köşe Gardırop Ön Baza (X Kolu)",
            dimensions: { width: Math.max(80, width - wingD - T), height: plinthHeight, depth: T },
            position: { x: wingD, y: 0, z: wingD - T - 16 },
            materialId: bodyMaterialId,
            isManufacturablePanel: true,
            thicknessAxis: "z",
          },
          {
            id: `${module.id}_plinth_front_z`,
            role: "plinth",
            label: "Köşe Gardırop Dönüş Baza (Z Kolu)",
            dimensions: { width: T, height: plinthHeight, depth: Math.max(80, returnSpanZ - T) },
            position: { x: wingD - T - 16, y: 0, z: wingD },
            materialId: bodyMaterialId,
            isManufacturablePanel: true,
            thicknessAxis: "x",
          }
        );
      } else {
        // 6 Adjustable Black Plastic Legs under the L-Corner Kitchen Base Cabinet
        const lLegCoords = [
          { id: "fl_back", x: 42, z: 42 },
          { id: "fr_back", x: width - 42, z: 42 },
          { id: "fr_front", x: width - 42, z: wingD - 48 },
          { id: "inner_corner", x: wingD - 48, z: wingD - 48 },
          { id: "ret_left", x: 42, z: depth - 48 },
          { id: "ret_right", x: wingD - 48, z: depth - 48 },
        ];
        lLegCoords.forEach((lc, lIdx) => {
          components.push({
            id: `${module.id}_plastic_leg_${lc.id}_${lIdx + 1}`,
            role: "special_fitting",
            label: `Ayarlanabilir Plastik Baza Ayağı #${lIdx + 1}`,
            dimensions: { width: 52, height: plinthHeight, depth: 52 },
            position: { x: lc.x - 26, y: 0, z: Math.max(30, lc.z - 52) },
            materialId: "mat_anodized_metal",
            isManufacturablePanel: false,
          });
        });
        // Ready-made L-Corner Kitchen Base comes with L-shaped Front Plinth installed in front of the plastic legs!
        components.push(
          {
            id: `${module.id}_plinth_front_x`,
            role: "plinth",
            label: "Mutfak L-Köşe Ön Baza Bandı (X Kolu)",
            dimensions: { width: Math.max(80, width - wingD), height: plinthHeight, depth: T },
            position: { x: wingD, y: 0, z: wingD - T - 22 },
            materialId: doorMaterialId || bodyMaterialId,
            isManufacturablePanel: true,
            thicknessAxis: "z",
          },
          {
            id: `${module.id}_plinth_front_z`,
            role: "plinth",
            label: "Mutfak L-Köşe Dönüş Baza Bandı (Z Kolu)",
            dimensions: { width: T, height: plinthHeight, depth: Math.max(80, returnSpanZ) },
            position: { x: wingD - T - 22, y: 0, z: wingD },
            materialId: doorMaterialId || bodyMaterialId,
            isManufacturablePanel: true,
            thicknessAxis: "x",
          }
        );
      }
    }

    // 2. Vertical Uprights (Dikmeler) — Floor-to-top (y=0..height) for Wardrobe Corners!
    components.push(
      {
        id: `${module.id}_side_left_outer`,
        role: "carcass_side_left",
        label: "Köşe Sol Dış Boy Dikme (Yere Kadar)",
        dimensions: { width: T, height: sideH, depth },
        position: { x: 0, y: sideY, z: 0 },
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        thicknessAxis: "x",
      },
      {
        id: `${module.id}_side_right_end`,
        role: "carcass_side_right",
        label: "Köşe Sağ Bitiş Dikmesi (X Kolu)",
        dimensions: { width: T, height: sideH, depth: wingD },
        position: { x: width - T, y: sideY, z: 0 },
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        thicknessAxis: "x",
      },
      {
        id: `${module.id}_side_front_return`,
        role: "carcass_side_right",
        label: "Köşe Ön Dönüş Bitiş Dikmesi (Z Kolu)",
        dimensions: { width: wingD - T, height: sideH, depth: T },
        position: { x: T, y: sideY, z: depth - T },
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        thicknessAxis: "z",
      },
      {
        id: `${module.id}_corner_inner_pillar`,
        role: "carcass_divider",
        label: "Köşe İç Taşıyıcı Dikme",
        dimensions: { width: 65, height: sideH, depth: T },
        position: { x: wingD - 65, y: sideY, z: T },
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        thicknessAxis: "z",
      }
    );

    // 3. L-Shaped Bottom & Top Panels
    components.push(
      {
        id: `${module.id}_bottom_main`,
        role: "carcass_bottom",
        label: "L-Köşe Alt Tabla (Ana Kol)",
        dimensions: { width: width - 2 * T, height: T, depth: wingD },
        position: { x: T, y: plinthHeight, z: 0 },
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        thicknessAxis: "y",
      },
      {
        id: `${module.id}_bottom_return`,
        role: "carcass_bottom",
        label: "L-Köşe Alt Tabla (Dönüş Kolu)",
        dimensions: { width: wingD - T, height: T, depth: returnSpanZ - T },
        position: { x: T, y: plinthHeight, z: wingD },
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        thicknessAxis: "y",
      },
      {
        id: `${module.id}_top_main`,
        role: "carcass_top",
        label: "L-Köşe Üst Tabla (Ana Kol)",
        dimensions: { width: width - 2 * T, height: T, depth: wingD },
        position: { x: T, y: height - T, z: 0 },
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        thicknessAxis: "y",
      },
      {
        id: `${module.id}_top_return`,
        role: "carcass_top",
        label: "L-Köşe Üst Tabla (Dönüş Kolu)",
        dimensions: { width: wingD - T, height: T, depth: returnSpanZ - T },
        position: { x: T, y: height - T, z: wingD },
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        thicknessAxis: "y",
      },
      {
        id: `${module.id}_back_main`,
        role: "carcass_back",
        label: "L-Köşe Arkalık",
        dimensions: { width: width - 2 * T, height: netH, depth: T_back },
        position: { x: T, y: plinthHeight + T, z: 8 },
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        thicknessAxis: "z",
      }
    );

    // 4. L-Shaped Internal Shelves & Hanging Rails
    const firstBay = module.bays[0];
    if (firstBay) {
      firstBay.shelves.forEach((sh, sIdx) => {
        const clampedElevY = Math.max(32, Math.min(Math.max(64, netH - T - 24), sh.elevationY));
        const sy = plinthHeight + T + clampedElevY;
        components.push(
          {
            id: sh.id || `${module.id}_l_shelf_main_${sIdx}`,
            role: "shelf",
            label: `L-Köşe Raf #${sIdx + 1} (Ana Kol)`,
            bayIndex: 0,
            dimensions: { width: width - 2 * T - 4, height: T, depth: wingD - 24 },
            position: { x: T + 2, y: sy, z: 18 },
            materialId: bodyMaterialId,
            isManufacturablePanel: true,
            thicknessAxis: "y",
          },
          {
            id: `${sh.id || module.id}_l_shelf_ret_${sIdx}`,
            role: "shelf",
            label: `L-Köşe Raf #${sIdx + 1} (Dönüş Kolu)`,
            bayIndex: 0,
            dimensions: { width: wingD - T - 24, height: T, depth: returnSpanZ - T - 4 },
            position: { x: T + 18, y: sy, z: wingD - 2 },
            materialId: bodyMaterialId,
            isManufacturablePanel: true,
            thicknessAxis: "y",
          }
        );
      });
      firstBay.hangingRails.forEach((rl, rIdx) => {
        const clampedRailY = Math.max(64, Math.min(Math.max(96, netH - 40), rl.elevationY));
        const ry = plinthHeight + T + clampedRailY;
        components.push(
          {
            id: rl.id || `${module.id}_l_rail_main_${rIdx}`,
            role: "hanging_rail",
            label: `L-Köşe Askı Borusu #${rIdx + 1} (Ana Kol)`,
            bayIndex: 0,
            dimensions: { width: width - 2 * T - 10, height: 25, depth: 15 },
            position: { x: T + 5, y: ry, z: wingD * 0.5 },
            materialId: "mat_metal_chrome",
            isManufacturablePanel: false,
          },
          {
            id: `${rl.id || module.id}_l_rail_ret_${rIdx}`,
            role: "hanging_rail",
            label: `L-Köşe Askı Borusu #${rIdx + 1} (Dönüş Kolu)`,
            bayIndex: 0,
            dimensions: { width: 15, height: 25, depth: returnSpanZ - T - 10 },
            position: { x: wingD * 0.5, y: ry, z: wingD + 5 },
            materialId: "mat_metal_chrome",
            isManufacturablePanel: false,
          }
        );
      });
    }

    // 5. L-Shaped Calacatta Quartz Countertop & Backsplash for Kitchen Base L-Corner
    if (!isWardrobe && !isWallL) {
      components.push(
        {
          id: `${module.id}_l_countertop_main`,
          role: "countertop",
          label: "L-Köşe Kuvars Tezgâh (Ana Kol 38mm)",
          dimensions: { width, height: 38, depth: wingD + 22 },
          position: { x: 0, y: height, z: 0 },
          materialId: module.carcass.countertopMaterialId || "mat_neolith_calacatta_luxe",
          isFrontFacing: true,
          isManufacturablePanel: false,
        },
        {
          id: `${module.id}_l_countertop_return`,
          role: "countertop",
          label: "L-Köşe Kuvars Tezgâh (Dönüş Kolu 38mm)",
          dimensions: { width: wingD + 22, height: 38, depth: returnSpanZ },
          position: { x: 0, y: height, z: wingD },
          materialId: module.carcass.countertopMaterialId || "mat_neolith_calacatta_luxe",
          isFrontFacing: true,
          isManufacturablePanel: false,
        }
      );
    }

    // 6. 90° Inner-Corner Bi-Fold Meeting Doors (unless open walk-in)
    if (!module.isOpenFront && firstBay?.door && firstBay.door.type !== "open" && firstBay.door.doorSystemId !== "open") {
      const doorY = plinthHeight + doorPerimeterGap;
      const doorH = Math.max(120, height - plinthHeight - 2 * doorPerimeterGap);
      const leaf1W = Math.max(120, width - wingD - doorPerimeterGap * 2);
      const leaf2W = Math.max(120, returnSpanZ - T - doorPerimeterGap * 2);
      const rad = (doorOpenAngleDeg * Math.PI) / 180;
      const doorMatId = firstBay.door.doorMaterialId || doorMaterialId;

      const leaf1: ComponentGeometry = {
        id: `${firstBay.door.id}_lcorner_right`,
        role: "door_right",
        label: "90° L-Köşe Sağ Kanat (X Açılım)",
        bayIndex: 0,
        dimensions: { width: leaf1W, height: doorH, depth: T },
        position: { x: wingD + doorPerimeterGap, y: doorY, z: wingD },
        rotation: [0, rad, 0],
        pivot: { x: wingD + doorPerimeterGap + leaf1W, y: doorY, z: wingD + T },
        materialId: doorMatId,
        isFrontFacing: true,
        isManufacturablePanel: true,
        thicknessAxis: "z",
      };
      components.push(leaf1);

      // Second 90° meeting leaf along Z return wall (hinged at front return upright z = wingD + T + gap + leaf2W)
      const returnPivotX = wingD + T;
      const returnPivotZ = wingD + T + doorPerimeterGap + leaf2W;
      const leaf2: ComponentGeometry = {
        id: `${firstBay.door.id}_lcorner_return`,
        role: "door_right",
        label: "90° L-Köşe Dönüş Kanadı (Z Açılım)",
        bayIndex: 0,
        dimensions: { width: leaf2W, height: doorH, depth: T },
        position: {
          x: returnPivotX,
          y: doorY,
          z: returnPivotZ - T,
        },
        rotation: [0, Math.PI / 2 - rad * 0.92, 0],
        pivot: { x: returnPivotX, y: doorY, z: returnPivotZ },
        materialId: doorMatId,
        isFrontFacing: true,
        isManufacturablePanel: true,
        thicknessAxis: "z",
      };
      components.push(leaf2);

      const hCat = firstBay.door.handleCategory || "bar_handle";
      components.push(
        ...generateHandleGeometry(leaf1, hCat, {
          moduleCategory: module.category,
          moduleElevationY: module.position.y,
          moduleHeight: module.dimensions.height,
          handleOrientation: firstBay.door.handleOrientation,
          handleOffsetY: firstBay.door.handleOffsetY,
          handleEdgeInsetX: firstBay.door.handleEdgeInsetX,
          handleLengthMm: firstBay.door.handleLengthMm,
          handleMaterialId: firstBay.door.handleMaterialId,
          handleProfileId: firstBay.door.handleProfileId,
        }),
        ...generateHandleGeometry(leaf2, hCat, {
          moduleCategory: module.category,
          moduleElevationY: module.position.y,
          moduleHeight: module.dimensions.height,
          handleOrientation: firstBay.door.handleOrientation,
          handleOffsetY: firstBay.door.handleOffsetY,
          handleEdgeInsetX: firstBay.door.handleEdgeInsetX,
          handleLengthMm: firstBay.door.handleLengthMm,
          handleMaterialId: firstBay.door.handleMaterialId,
          handleProfileId: firstBay.door.handleProfileId,
        })
      );
    }

    if (module.componentMaterialOverrides) {
      components.forEach((c) => {
        const ov = module.componentMaterialOverrides?.[c.id];
        if (ov) c.materialId = ov;
      });
    }
    const lResult: ModuleGeometryBreakdown = {
      moduleId: module.id,
      overall: module.dimensions,
      components,
      bayWidths: [width - 2 * T],
      netInnerHeight: netH,
      netInnerDepth: wingD - 20,
    };
    moduleGeometryCache.set(cacheKey, lResult);
    return lResult;
  }

  if (isDiagonalCorner) {
    const wingD = isWardrobe
      ? Math.min(600, Math.round(Math.min(width, depth) * 0.58))
      : Math.min(580, Math.round(Math.min(width, depth) * 0.64));
    const returnSpanZ = Math.max(180, depth - wingD);
    const sideY = isWardrobe ? 0 : plinthHeight;
    const sideH = isWardrobe ? height : height - plinthHeight;
    const netH = Math.max(120, height - plinthHeight - 2 * T);
    const diagDx = Math.max(120, width - wingD);
    const diagDz = Math.max(120, depth - wingD);
    const diagLen = Math.round(Math.hypot(diagDx, diagDz));
    const diagAngle = Math.atan2(diagDz, diagDx);

    if (plinthHeight > 0) {
      components.push({
        id: `${module.id}_diag_plinth`,
        role: "plinth",
        label: "45° Diyagonal Köşe Ön Baza",
        dimensions: { width: Math.max(120, diagLen - 24), height: plinthHeight, depth: T },
        position: { x: wingD + 12, y: 0, z: depth - 24 },
        rotation: [0, diagAngle, 0],
        pivot: { x: wingD + 12, y: 0, z: depth - 24 },
        materialId: doorMaterialId || bodyMaterialId,
        isManufacturablePanel: true,
        thicknessAxis: "z",
      });
    }

    components.push(
      {
        id: `${module.id}_diag_side_left_back`,
        role: "carcass_side_left",
        label: "Diyagonal Köşe Sol Arka Dikme",
        dimensions: { width: T, height: sideH, depth },
        position: { x: 0, y: sideY, z: 0 },
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        thicknessAxis: "x",
      },
      {
        id: `${module.id}_diag_side_right`,
        role: "carcass_side_right",
        label: "Diyagonal Köşe Sağ Yan Dikme",
        dimensions: { width: T, height: sideH, depth: wingD },
        position: { x: width - T, y: sideY, z: 0 },
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        thicknessAxis: "x",
      },
      {
        id: `${module.id}_diag_side_front_return`,
        role: "carcass_side_right",
        label: "Diyagonal Köşe Ön Dönüş Dikmesi",
        dimensions: { width: wingD - T, height: sideH, depth: T },
        position: { x: T, y: sideY, z: depth - T },
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        thicknessAxis: "z",
      },
      {
        id: `${module.id}_diag_bottom_main`,
        role: "carcass_bottom",
        label: "Diyagonal Köşe Alt Tabla (Ana)",
        dimensions: { width: width - 2 * T, height: T, depth: wingD },
        position: { x: T, y: plinthHeight, z: 0 },
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        thicknessAxis: "y",
      },
      {
        id: `${module.id}_diag_bottom_return`,
        role: "carcass_bottom",
        label: "Diyagonal Köşe Alt Tabla (Dönüş)",
        dimensions: { width: wingD - T, height: T, depth: returnSpanZ - T },
        position: { x: T, y: plinthHeight, z: wingD },
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        thicknessAxis: "y",
      },
      {
        id: `${module.id}_diag_top_main`,
        role: "carcass_top",
        label: "Diyagonal Köşe Üst Tabla (Ana)",
        dimensions: { width: width - 2 * T, height: T, depth: wingD },
        position: { x: T, y: height - T, z: 0 },
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        thicknessAxis: "y",
      },
      {
        id: `${module.id}_diag_top_return`,
        role: "carcass_top",
        label: "Diyagonal Köşe Üst Tabla (Dönüş)",
        dimensions: { width: wingD - T, height: T, depth: returnSpanZ - T },
        position: { x: T, y: height - T, z: wingD },
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        thicknessAxis: "y",
      },
      {
        id: `${module.id}_diag_back_main`,
        role: "carcass_back",
        label: "Diyagonal Köşe Arkalık",
        dimensions: { width: width - 2 * T, height: netH, depth: T_back },
        position: { x: T, y: plinthHeight + T, z: 8 },
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        thicknessAxis: "z",
      }
    );

    const firstBay = module.bays[0];
    if (firstBay) {
      firstBay.shelves.forEach((sh, sIdx) => {
        const clampedElevY = Math.max(32, Math.min(Math.max(64, netH - T - 24), sh.elevationY));
        const sy = plinthHeight + T + clampedElevY;
        components.push(
          {
            id: sh.id || `${module.id}_diag_shelf_main_${sIdx}`,
            role: "shelf",
            label: `45° Köşe Raf #${sIdx + 1} (Ana)`,
            bayIndex: 0,
            dimensions: { width: width - 2 * T - 4, height: T, depth: wingD - 20 },
            position: { x: T + 2, y: sy, z: 18 },
            materialId: bodyMaterialId,
            isManufacturablePanel: true,
            thicknessAxis: "y",
          },
          {
            id: `${sh.id || module.id}_diag_shelf_ret_${sIdx}`,
            role: "shelf",
            label: `45° Köşe Raf #${sIdx + 1} (Dönüş)`,
            bayIndex: 0,
            dimensions: { width: wingD - T - 20, height: T, depth: returnSpanZ - T - 4 },
            position: { x: T + 18, y: sy, z: wingD - 2 },
            materialId: bodyMaterialId,
            isManufacturablePanel: true,
            thicknessAxis: "y",
          }
        );
      });
    }

    if (!isWardrobe) {
      components.push(
        {
          id: `${module.id}_diag_countertop_main`,
          role: "countertop",
          label: "Diyagonal Köşe Kuvars Tezgâh (Ana Kol 38mm)",
          dimensions: { width, height: 38, depth: wingD + 20 },
          position: { x: 0, y: height, z: 0 },
          materialId: module.carcass.countertopMaterialId || "mat_neolith_calacatta_luxe",
          isFrontFacing: true,
          isManufacturablePanel: false,
        },
        {
          id: `${module.id}_diag_countertop_return`,
          role: "countertop",
          label: "Diyagonal Köşe Kuvars Tezgâh (Dönüş Kolu 38mm)",
          dimensions: { width: wingD + 20, height: 38, depth: returnSpanZ },
          position: { x: 0, y: height, z: wingD },
          materialId: module.carcass.countertopMaterialId || "mat_neolith_calacatta_luxe",
          isFrontFacing: true,
          isManufacturablePanel: false,
        }
      );
    }

    if (!module.isOpenFront && firstBay?.door && firstBay.door.type !== "open" && firstBay.door.doorSystemId !== "open") {
      const doorY = plinthHeight + doorPerimeterGap;
      const doorH = Math.max(120, height - plinthHeight - 2 * doorPerimeterGap);
      const leafW = Math.max(180, diagLen - doorPerimeterGap * 2);
      const rad = (doorOpenAngleDeg * Math.PI) / 180;
      const doorMatId = firstBay.door.doorMaterialId || doorMaterialId;
      const diagDoor: ComponentGeometry = {
        id: `${firstBay.door.id}_diag45_door`,
        role: "door_left",
        label: "45° Diyagonal Köşe Kapak (+45° Blum Açılı Menteşeli)",
        bayIndex: 0,
        dimensions: { width: leafW, height: doorH, depth: T },
        position: { x: wingD, y: doorY, z: depth - T },
        rotation: [0, diagAngle - rad, 0],
        pivot: { x: wingD, y: doorY, z: depth },
        materialId: doorMatId,
        isFrontFacing: true,
        isManufacturablePanel: true,
        thicknessAxis: "z",
      };
      components.push(diagDoor);
    }

    if (module.componentMaterialOverrides) {
      components.forEach((c) => {
        const ov = module.componentMaterialOverrides?.[c.id];
        if (ov) c.materialId = ov;
      });
    }
    const diagResult: ModuleGeometryBreakdown = {
      moduleId: module.id,
      overall: module.dimensions,
      components,
      bayWidths: [width - 2 * T],
      netInnerHeight: netH,
      netInnerDepth: wingD - 20,
    };
    moduleGeometryCache.set(cacheKey, diagResult);
    return diagResult;
  }

  // 1. Plinth (Baza) & Visible Adjustable Plastic Kitchen Legs
  const showLegs = module.carcass.hasAdjustableLegs !== false;
  if (plinthHeight > 0) {
    if (isWardrobe) {
      if (showLegs) {
        const legXs = [T + 36, width - T - 36];
        if (width > 1100) legXs.push(Math.round(width / 2));
        const legZs = [54, Math.max(90, depth - 82)];
        let wLegIdx = 1;
        for (const lx of legXs) {
          for (const lz of legZs) {
            components.push({
              id: `${module.id}_plastic_leg_${wLegIdx}`,
              role: "special_fitting",
              label: `Ayarlı Dolap Baza Ayağı #${wLegIdx} (H:${plinthHeight}mm)`,
              dimensions: { width: 48, height: plinthHeight, depth: 48 },
              position: { x: lx - 24, y: explodeY > 0 ? -explodeY : 0, z: lz - 24 },
              materialId: "mat_anodized_metal",
              isManufacturablePanel: false,
            });
            wLegIdx++;
          }
        }
      }
      // In wardrobes, side panels extend to floor so plinth fits between side panels (x = T, width = innerSpanW)
      components.push({
        id: `${module.id}_plinth_front`,
        role: "plinth",
        label: "Baza Ön",
        dimensions: {
          width: innerSpanW,
          height: plinthHeight,
          depth: T,
        },
        position: {
          x: T,
          y: explodeY > 0 ? -explodeY : 0,
          z: depth - T - 20,
        },
        materialId: module.carcass.plinthMaterialId || bodyMaterialId,
        isManufacturablePanel: true,
        thicknessAxis: "z",
      });
    } else {
      // In kitchen base & tall cabinets: generate visible 3D Adjustable Black ABS Plastic Legs (_plastic_leg_)!
      const legXs = [46, width - 46];
      if (width > 950) {
        legXs.push(Math.round(width / 2));
      }
      // 1. Adjustable Black ABS Plastic Legs sit at z = depth - 82mm (strictly BEHIND the front plinth board!)
      const legZs = [54, Math.max(90, depth - 82)];
      let legCounter = 1;
      for (const lx of (showLegs ? legXs : [])) {
        for (const lz of legZs) {
          components.push({
            id: `${module.id}_plastic_leg_${legCounter}`,
            role: "special_fitting",
            label: `Ayarlanabilir Plastik Mutfak Baza Ayağı #${legCounter} (H:${plinthHeight}mm)`,
            dimensions: { width: 52, height: plinthHeight, depth: 52 },
            position: {
              x: lx - 26,
              y: explodeY > 0 ? -explodeY : 0,
              z: lz - 26,
            },
            materialId: "mat_anodized_metal",
            isManufacturablePanel: false,
          });
          legCounter++;
        }
      }
      // 2. Ready-Made Kitchen Base Front Plinth (Ön Baza Bandı) is included by default at z = depth - T - 24 (in front of the plastic legs!)
      components.push({
        id: `${module.id}_plinth_front`,
        role: "plinth",
        label: `Mutfak Ön Baza Bandı (H:${plinthHeight}mm, Su Contalı)`,
        dimensions: {
          width,
          height: plinthHeight,
          depth: T,
        },
        position: {
          x: 0,
          y: explodeY > 0 ? -explodeY : 0,
          z: depth - T - 24,
        },
        materialId: doorMaterialId || bodyMaterialId,
        isFrontFacing: true,
        isManufacturablePanel: true,
        thicknessAxis: "z",
      });
    }
  }

  // 2. Left Side Panel — in wardrobes, side panels extend all the way to the floor (y = 0, height = height)
  const sideH = isWardrobe ? height : height - plinthHeight;
  const sideY = isWardrobe ? 0 : plinthHeight;
  components.push({
    id: `${module.id}_side_left`,
    role: "carcass_side_left",
    label: "Sol Yan Panel",
    dimensions: { width: T, height: sideH, depth },
    position: { x: explodeX > 0 ? -explodeX : 0, y: sideY, z: 0 },
    materialId: bodyMaterialId,
    isManufacturablePanel: true,
    thicknessAxis: "x",
  });

  // 3. Right Side Panel
  components.push({
    id: `${module.id}_side_right`,
    role: "carcass_side_right",
    label: "Sağ Yan Panel",
    dimensions: { width: T, height: sideH, depth },
    position: { x: width - T + explodeX, y: sideY, z: 0 },
    materialId: bodyMaterialId,
    isManufacturablePanel: true,
    thicknessAxis: "x",
  });

  // 4. Bottom Panel
  components.push({
    id: `${module.id}_bottom`,
    role: "carcass_bottom",
    label: "Alt Panel",
    dimensions: { width: innerSpanW, height: T, depth },
    position: { x: T, y: plinthHeight - explodeY * 0.5, z: 0 },
    materialId: bodyMaterialId,
    isManufacturablePanel: true,
    thicknessAxis: "y",
  });

  // 5. Top Panel
  components.push({
    id: `${module.id}_top`,
    role: "carcass_top",
    label: "Üst Panel",
    dimensions: { width: innerSpanW, height: T, depth },
    position: { x: T, y: height - T + explodeY, z: 0 },
    materialId: bodyMaterialId,
    isManufacturablePanel: true,
    thicknessAxis: "y",
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
    isManufacturablePanel: true,
    thicknessAxis: "z",
  });

  // 6b. WP-05 Special Carcass Topology for Blind Corner, L-Corner & Built-in Appliance Housing
  const lowerName = module.name.toLowerCase();
  if (module.templateId?.includes("blind") || lowerName.includes("kör köşe")) {
    const blindW = Math.max(120, Math.round(innerSpanW * 0.45));
    components.push({
      id: `${module.id}_blind_panel`,
      role: "carcass_divider",
      label: "Kör Köşe Ön Sabit Panel",
      dimensions: { width: blindW, height: netInnerH, depth: T },
      position: { x: T, y: plinthHeight + T, z: depth - T },
      materialId: bodyMaterialId,
      isManufacturablePanel: true,
      thicknessAxis: "z",
    });
    components.push({
      id: `${module.id}_corner_filler`,
      role: "carcass_divider",
      label: "Kör Köşe Dönüş Kör Çıtası",
      dimensions: { width: 70, height: netInnerH, depth: T },
      position: { x: T + blindW - 70, y: plinthHeight + T, z: depth },
      materialId: doorMaterialId,
      isManufacturablePanel: true,
      thicknessAxis: "z",
    });
  }

  if (
    module.templateId?.includes("oven") ||
    module.templateId?.includes("microwave") ||
    lowerName.includes("ankastre fırın")
  ) {
    components.push({
      id: `${module.id}_appliance_shelf`,
      role: "shelf",
      label: "Ankastre Cihaz Taşıyıcı Tabla (22mm)",
      dimensions: { width: innerSpanW, height: 22, depth: Math.max(120, netInnerD - 50) },
      position: { x: T, y: plinthHeight + T + Math.min(netInnerH - 100, 720), z: 20 },
      materialId: bodyMaterialId,
      isManufacturablePanel: true,
      thicknessAxis: "y",
    });
    components.push({
      id: `${module.id}_appliance_vent_strip`,
      role: "plinth",
      label: "Ankastre Havalandırma Ön Kayıtı",
      dimensions: { width: innerSpanW, height: 70, depth: T },
      position: { x: T, y: height - T - 70, z: depth - T },
      materialId: doorMaterialId,
      isManufacturablePanel: true,
      thicknessAxis: "z",
    });

    if (module.templateId?.includes("oven") || lowerName.includes("ankastre fırın")) {
      const ovenY = module.templateId?.includes("kb_09")
        ? plinthHeight + T + 125
        : plinthHeight + T + 380;
      const ovenH = Math.min(595, Math.max(200, height - ovenY - T));
      components.push({
        id: `${module.id}_builtin_oven_unit`,
        role: "special_fitting",
        label: "Ankastre Fırın Ünitesi (EN 1116 600mm)",
        dimensions: { width: Math.max(100, width - 8), height: ovenH, depth: 24 },
        position: { x: 4, y: ovenY, z: depth - 2 },
        materialId: "mat_smoked_glass",
        isManufacturablePanel: false,
      });
    }
    if (module.templateId?.includes("microwave")) {
      const mwY = module.templateId?.includes("oven_microwave")
        ? plinthHeight + T + 985
        : plinthHeight + T + 4;
      const mwH = Math.min(380, Math.max(150, height - mwY - T));
      components.push({
        id: `${module.id}_builtin_microwave_unit`,
        role: "special_fitting",
        label: "Ankastre Mikrodalga Ünitesi (380mm)",
        dimensions: { width: Math.max(100, width - 8), height: mwH, depth: 22 },
        position: { x: 4, y: mwY, z: depth - 2 },
        materialId: "mat_smoked_glass",
        isManufacturablePanel: false,
      });
    }
  }

  const tplLower = (module.templateId || "").toLowerCase();
  const nameLower = (module.name || "").toLowerCase();
  if (tplLower.includes("oven") || tplLower.includes("fridge")) {
    components.push({
      id: `${module.id}_appliance_vent_grille`,
      role: "special_fitting",
      label: "Ankastre Havalandırma Menfezi (Min 200cm²)",
      dimensions: { width: Math.max(180, width - 120), height: 42, depth: 16 },
      position: { x: 60, y: Math.max(18, plinthHeight - 48), z: depth - 28 },
      materialId: "mat_anodized_metal",
      isManufacturablePanel: false,
    });
  }
  const isKitchenBaseOrCorner =
    module.category === "kitchen_base" ||
    module.category === "kitchen_corner" ||
    module.moduleFamilyId === "fam_base" ||
    (module.moduleFamilyId === "fam_corner" && height <= 1150) ||
    tplLower.includes("kitchen_base") ||
    tplLower.includes("_kb_") ||
    tplLower.includes("_kc_");

  // Automatic 38mm Calacatta Quartz Countertop Slab + 45mm Rear Backsplash Strip on all Kitchen Base & Corner Cabinets
  const ctopThickness = isKitchenBaseOrCorner ? 38 : 0;
  if (isKitchenBaseOrCorner) {
    components.push({
      id: `${module.id}_auto_countertop`,
      role: "countertop",
      label: `Çimstone Calacatta Kuvars Tezgâh (38mm)`,
      dimensions: { width, height: ctopThickness, depth: depth + 26 },
      position: { x: 0, y: height, z: 0 },
      materialId: module.carcass.countertopMaterialId || "mat_neolith_calacatta_luxe",
      isFrontFacing: true,
      isManufacturablePanel: false,
    });
    components.push({
      id: `${module.id}_auto_backsplash_strip`,
      role: "countertop",
      label: `Tezgâh Arka Süpürgelik Çıtası (45×18mm)`,
      dimensions: { width, height: 45, depth: 18 },
      position: { x: 0, y: height + ctopThickness, z: 0 },
      materialId: module.carcass.countertopMaterialId || "mat_neolith_calacatta_luxe",
      isFrontFacing: true,
      isManufacturablePanel: false,
    });
  }

  const isSinkBase = tplLower.includes("sink") || nameLower.includes("evye");
  const isCooktopBase =
    tplLower.includes("cooktop") ||
    tplLower.includes("oven_base") ||
    nameLower.includes("ocak");
  if (isSinkBase) {
    const cutW = Math.min(560, Math.max(320, width - 80));
    const cutD = Math.min(460, Math.max(280, depth - 110));
    components.push({
      id: `${module.id}_cutout_sink`,
      role: "special_fitting",
      label: `Paslanmaz Çelik Eviye & Kuğu Batarya (${cutW}×${cutD}mm)`,
      dimensions: { width: cutW, height: 32, depth: cutD },
      position: { x: (width - cutW) / 2, y: height + ctopThickness - 14, z: (depth - cutD) / 2 + 10 },
      materialId: "mat_metal_chrome",
      isManufacturablePanel: false,
    });
  } else if (isCooktopBase) {
    const cutW = Math.min(580, Math.max(320, width - 80));
    const cutD = Math.min(500, Math.max(280, depth - 100));
    components.push({
      id: `${module.id}_cutout_cooktop`,
      role: "special_fitting",
      label: `4 Gözlü Ankastre İndüksiyonlu Ocak (${cutW}×${cutD}mm)`,
      dimensions: { width: cutW, height: 18, depth: cutD },
      position: { x: (width - cutW) / 2, y: height + ctopThickness - 4, z: (depth - cutD) / 2 + 12 },
      materialId: "mat_smoked_glass",
      isManufacturablePanel: false,
    });
  }

  // 7. Bays, Internal Dividers, Shelves, Rails, Drawers & All 12 V4 Door Systems
  let currentX = T;
  const ledKelvinVal = module.carcass.ledColorTempK || 3000;
  const ledMatId =
    ledKelvinVal <= 2800
      ? "mat_led_warm_2700k"
      : ledKelvinVal >= 3800
      ? "mat_led_neutral_4000k"
      : "mat_led_warm_3000k";
  const ledMode = module.carcass.ledPlacementMode;
  const moduleHasVertLed =
    (Boolean(module.carcass.ledLightingEnabled) &&
      (ledMode === "vertical_sides" || ledMode === "full_showcase")) ||
    module.bays.some((b) =>
      (b.specialFittings || []).some((f) => !f.isHidden && f.type === "led_vertical_strip")
    );
  const moduleHasHorizLed =
    (Boolean(module.carcass.ledLightingEnabled) &&
      (ledMode === "top_and_shelves" || ledMode === "full_showcase")) ||
    module.bays.some((b) =>
      (b.specialFittings || []).some((f) => !f.isHidden && f.type === "led_profile")
    );
  const moduleHasRodLed =
    (Boolean(module.carcass.ledLightingEnabled) &&
      (ledMode === "hanging_rod" || ledMode === "full_showcase")) ||
    module.bays.some((b) =>
      (b.specialFittings || []).some((f) => !f.isHidden && f.type === "led_rod_strip")
    );

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
        isManufacturablePanel: true,
        thicknessAxis: "x",
      });
    }

    // Compute bottom drawer stack ceiling so vertical LEDs sit cleanly in the open upper bay (never behind closed external drawers!)
    const bottomDrawersInBay = bay.drawers.filter((d) => d.elevationY < netInnerH * 0.55);
    const extBottomDrawersInBay = bottomDrawersInBay.filter((d) => !d.isInternal);
    const extDrawerTopLocalY =
      extBottomDrawersInBay.length > 0
        ? Math.max(...extBottomDrawersInBay.map((d) => d.elevationY + d.height)) + T
        : 0;

    // Parametric CNC LED Channel Dimensions & Aligned/Independent Front Setback
    const ledChanWidth = Math.max(6, Math.min(32, module.carcass.ledChannelWidthMm ?? 12));
    const ledChanRouteDepth = Math.max(
      4,
      Math.min(Math.max(5, T - 4), module.carcass.ledChannelDepthMm ?? 8)
    );
    const ledAligned = module.carcass.ledAlignShelfAndSide !== false;
    const vertFrontSetback = Math.max(
      35,
      Math.min(Math.max(60, depth - 45), module.carcass.ledFrontSetbackMm ?? 75)
    );
    const horizFrontSetback = ledAligned
      ? vertFrontSetback
      : Math.max(
          35,
          Math.min(Math.max(60, depth - 45), module.carcass.ledShelfSetbackMm ?? vertFrontSetback)
        );
    // Subtle physical bezel step scales slightly with channel routing depth while staying < 1.75mm so shelves never collide
    const flushStepMm = Number(
      Math.min(1.7, 1.25 + (ledChanRouteDepth - 4) * 0.045).toFixed(2)
    );

    // Unified Single-Channel Architectural Recessed LED Profiles (Zero duplicates, zero Z-fighting!)
    if (moduleHasVertLed) {
      const ledZ = Math.max(28, Math.round(depth - vertFrontSetback - ledChanWidth / 2));
      const vStartY = plinthHeight + T + extDrawerTopLocalY + 4;
      const topJoinOffset = moduleHasHorizLed && ledAligned ? 2 : 6;
      const vLedH = Math.max(120, netInnerH - extDrawerTopLocalY - 4 - topJoinOffset);
      if (vLedH >= 120) {
        components.push(
          {
            id: `${module.id}_bay_${bayIdx}_recessed_led_vert_left`,
            role: "special_fitting",
            label: `B${bayIdx + 1} Sol Dikme Gömme LED ${ledKelvinVal}K (${ledChanWidth}×${ledChanRouteDepth}mm, Önden ${vertFrontSetback}mm)`,
            bayIndex: bayIdx,
            dimensions: { width: flushStepMm, height: vLedH, depth: ledChanWidth },
            position: { x: bayStartX + 0.25, y: vStartY, z: ledZ },
            materialId: ledMatId,
            isManufacturablePanel: false,
          },
          {
            id: `${module.id}_bay_${bayIdx}_recessed_led_vert_right`,
            role: "special_fitting",
            label: `B${bayIdx + 1} Sağ Dikme Gömme LED ${ledKelvinVal}K (${ledChanWidth}×${ledChanRouteDepth}mm, Önden ${vertFrontSetback}mm)`,
            bayIndex: bayIdx,
            dimensions: { width: flushStepMm, height: vLedH, depth: ledChanWidth },
            position: { x: bayStartX + bayW - flushStepMm - 0.25, y: vStartY, z: ledZ },
            materialId: ledMatId,
            isManufacturablePanel: false,
          }
        );
      }
    }

    if (moduleHasHorizLed) {
      // When aligned with vertical side LEDs, span almost full bay width (bayW - 4mm) so corners meet in a continuous U-frame!
      const sideMargin = moduleHasVertLed && ledAligned ? 2 : 6;
      const spanW = Math.max(60, bayW - sideMargin * 2);
      const xOff = bayStartX + sideMargin;
      const zPos = Math.max(28, Math.round(depth - horizFrontSetback - ledChanWidth / 2));
      components.push({
        id: `${module.id}_bay_${bayIdx}_recessed_led_top`,
        role: "special_fitting",
        label: `B${bayIdx + 1} Üst Tabla Gömme LED ${ledKelvinVal}K (${ledChanWidth}×${ledChanRouteDepth}mm, Önden ${horizFrontSetback}mm)`,
        bayIndex: bayIdx,
        dimensions: { width: spanW, height: flushStepMm, depth: ledChanWidth },
        position: { x: xOff, y: plinthHeight + T + netInnerH - flushStepMm - 0.2, z: zPos },
        materialId: ledMatId,
        isManufacturablePanel: false,
      });
      bay.shelves.forEach((sh, shIdx) => {
        if (sh.isHidden) return;
        const clampedShY = Math.max(
          24,
          Math.min(Math.max(48, netInnerH - (sh.thickness || T) - 16), sh.elevationY)
        );
        if (clampedShY > extDrawerTopLocalY + 60) {
          components.push({
            id: `${module.id}_bay_${bayIdx}_recessed_led_sh_${shIdx}`,
            role: "special_fitting",
            label: `B${bayIdx + 1} Raf #${shIdx + 1} Altı Gömme LED ${ledKelvinVal}K (${ledChanWidth}×${ledChanRouteDepth}mm, Önden ${horizFrontSetback}mm)`,
            bayIndex: bayIdx,
            dimensions: { width: spanW, height: flushStepMm, depth: ledChanWidth },
            position: { x: xOff, y: plinthHeight + T + clampedShY - flushStepMm - 0.2, z: zPos },
            materialId: ledMatId,
            isManufacturablePanel: false,
          });
        }
      });
    }

    if (moduleHasRodLed) {
      const spanW = Math.max(60, bayW - 20);
      const xOff = bayStartX + Math.round((bayW - spanW) / 2);
      if (bay.hangingRails.length > 0) {
        bay.hangingRails.forEach((rl, rlIdx) => {
          if (rl.isHidden) return;
          const clampedRailY = Math.max(
            48,
            Math.min(Math.max(80, netInnerH - 36), rl.elevationY)
          );
          components.push({
            id: `${module.id}_bay_${bayIdx}_recessed_led_rod_${rlIdx}`,
            role: "special_fitting",
            label: `B${bayIdx + 1} Sensörlü Işıklı Askı Borusu LED ${ledKelvinVal}K`,
            bayIndex: bayIdx,
            dimensions: { width: spanW, height: 3.2, depth: 8 },
            position: { x: xOff, y: plinthHeight + T + clampedRailY - 3.0, z: depth / 2 - 4 },
            materialId: ledMatId,
            isManufacturablePanel: false,
          });
        });
      } else {
        const fallbackRodY = Math.max(extDrawerTopLocalY + 200, Math.round(netInnerH * 0.78));
        components.push({
          id: `${module.id}_bay_${bayIdx}_recessed_led_rod_0`,
          role: "special_fitting",
          label: `B${bayIdx + 1} Sensörlü Işıklı Askı Borusu LED ${ledKelvinVal}K`,
          bayIndex: bayIdx,
          dimensions: { width: spanW, height: 3.2, depth: 8 },
          position: { x: xOff, y: plinthHeight + T + fallbackRodY, z: depth / 2 - 4 },
          materialId: ledMatId,
          isManufacturablePanel: false,
        });
      }
    }

    // Shelves (2mm per-side clearance so shelves never overlap flush 1.6mm recessed side-panel LEDs!)
    bay.shelves.forEach((shelf, sIdx) => {
      if (shelf.isHidden) return;
      const shelfT = shelf.thickness || T;
      components.push({
        id: shelf.id || `${module.id}_bay_${bayIdx}_shelf_${sIdx}`,
        role: "shelf",
        label: `Raf B${bayIdx + 1}-${sIdx + 1} (${shelf.isAdjustable ? "Hareketli" : "Sabit"})`,
        bayIndex: bayIdx,
        dimensions: { width: bayW - 4, height: shelfT, depth: netInnerD - 10 },
        position: { x: bayStartX + 2, y: plinthHeight + T + Math.max(24, Math.min(Math.max(48, netInnerH - shelfT - 16), shelf.elevationY)), z: 20 },
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        thicknessAxis: "y",
      });
    });

    // Mandatory fixed shelf directly above bottom drawer stack when upper bay space exists
    if (bottomDrawersInBay.length > 0) {
      const maxDrawerTopEle = Math.max(...bottomDrawersInBay.map((d) => d.elevationY + d.height));
      const hasShelfAboveDrawers = bay.shelves.some(
        (s) => Math.abs(s.elevationY - maxDrawerTopEle) <= 55
      );
      if (!hasShelfAboveDrawers && maxDrawerTopEle + T + 80 < netInnerH) {
        components.push({
          id: `${module.id}_bay_${bayIdx}_drawer_top_shelf`,
          role: "shelf",
          label: `Çekmece Üstü Sabit Tabla B${bayIdx + 1}`,
          bayIndex: bayIdx,
          dimensions: { width: bayW - 4, height: T, depth: netInnerD - 10 },
          position: { x: bayStartX + 2, y: plinthHeight + T + maxDrawerTopEle, z: 20 },
          materialId: bodyMaterialId,
          isManufacturablePanel: true,
          thicknessAxis: "y",
        });
      }
    }

    // Hanging Rails
    bay.hangingRails.forEach((rail, rIdx) => {
      if (rail.isHidden) return;
      components.push({
        id: rail.id || `${module.id}_bay_${bayIdx}_rail_${rIdx}`,
        role: "hanging_rail",
        label: `Askı Borusu B${bayIdx + 1}-${rIdx + 1}`,
        bayIndex: bayIdx,
        dimensions: { width: bayW, height: 25, depth: 25 },
        position: { x: bayStartX, y: plinthHeight + T + Math.max(48, Math.min(Math.max(80, netInnerH - 36), rail.elevationY)), z: depth / 2 - 12 },
        materialId: "mat_metal_chrome",
        isManufacturablePanel: false,
      });
    });

    // Special Fittings (World-Brand Hardware / Metal Accessories — NOT wooden shelves!)
    const fittingBrandLabels: Record<string, string> = {
      trouser_rack: "Häfele Teleskopik Pantolonluk [807.95.122]",
      shoe_rack: "Häfele Eğimli Ayakkabılık [807.96.310]",
      wire_basket: "Häfele Frenli Tel Sepet [807.52.220]",
      wardrobe_lift: "Servetto Gardırop Asansörü 10kg [805.20.232]",
      jewelry_tray: "Häfele Kadife Takı & Saat Çekmecesi [807.88.150]",
      corner_lemans: "Kesseböhmer LeMans II Kör Köşe [541.32.240]",
      pantry_pullout: "Kesseböhmer Dispensa Boy Kiler [545.13.251]",
      waste_bin: "Häfele Raylı Çöp Sistemi [502.70.252]",
      spice_pullout: "Kesseböhmer Teleskopik Şişelik [545.61.211]",
      cutlery_tray: "Blum AMBIA-LINE Çatal-Kaşık [556.86.322]",
      tie_rack: "Häfele Yandan Çıkışlı Kravatlık [807.95.410]",
      belt_rack: "Häfele Teleskopik Kemerlik [807.95.420]",
      led_profile: "Häfele Loox5 Raf/Üst Gömme LED Kanal 3000K [833.74.700]",
      led_vertical_strip: "Häfele Loox5 Yan Dikme Boy LED Kanal 3000K [833.74.710]",
      led_rod_strip: "Häfele Loox5 Sensörlü LED Askı Borusu 3000K [833.72.810]",
    };
    bay.specialFittings?.forEach((fit, fIdx) => {
      if (fit.isHidden) return;
      const baseId = fit.id || `${module.id}_bay_${bayIdx}_fit_${fIdx}`;
      const brandLabel = fittingBrandLabels[fit.type] || `Özel Donanım (${fit.type})`;
      const fitW = Math.max(80, bayW - 4);
      const fitD = Math.max(120, netInnerD - 28);
      const fitX = bayStartX + 2;
      const fitY = plinthHeight + T + fit.elevationY;
      const fitZ = 24;

      const isLedFitting =
        fit.type === "led_profile" ||
        fit.type === "led_vertical_strip" ||
        fit.type === "led_rod_strip";
      if (isLedFitting) {
        // Handled cleanly in the unified bay recessed LED block above (zero duplicate bars!)
        return;
      }

      const ledChanW =
        fit.type === "led_vertical_strip"
          ? Math.max(6, Math.min(40, fit.width || 14))
          : Math.max(60, Math.min(bayW - 4, fit.width || bayW - 12));
      const ledChanD =
        fit.type === "led_vertical_strip"
          ? Math.max(20, Math.min(depth - 40, fit.depth || 75))
          : Math.max(8, Math.min(60, fit.depth || 18));

      // IMPORTANT: Only LED fittings use _recessed_led_main; non-LED accessories use _fitting_<type> so componentMesh renders their real 3D hardware!
      components.push({
        id: isLedFitting ? `${baseId}_recessed_led_main` : `${baseId}_fitting_${fit.type}`,
        role: "special_fitting",
        label: isLedFitting
          ? `${brandLabel} B${bayIdx + 1} (${ledChanW}×${ledChanD}mm)`
          : `${brandLabel} B${bayIdx + 1}`,
        bayIndex: bayIdx,
        dimensions: isLedFitting
          ? fit.type === "led_vertical_strip"
            ? { width: 4, height: Math.max(160, netInnerH - 24), depth: ledChanW }
            : { width: ledChanW, height: 4, depth: ledChanD }
          : { width: fitW, height: Math.max(65, fit.height || 85), depth: fitD },
        position: isLedFitting
          ? fit.type === "led_vertical_strip"
            ? { x: bayStartX - 1.5, y: plinthHeight + T + 12, z: Math.max(24, depth - ledChanD) }
            : fit.type === "led_rod_strip"
            ? { x: bayStartX + Math.round((bayW - ledChanW) / 2), y: fitY, z: depth / 2 }
            : {
                x: bayStartX + Math.round((bayW - ledChanW) / 2),
                y: plinthHeight + T + netInnerH - 2.5,
                z: Math.max(50, depth - 95),
              }
          : { x: fitX, y: fitY, z: fitZ },
        materialId: isLedFitting ? "mat_led_warm_3000k" : "mat_metal_chrome",
        isManufacturablePanel: false,
      });

      // Detailed 3D mechanical sub-components per world-brand accessory type
      if (fit.type === "trouser_rack") {
        const rodCount = Math.max(4, Math.min(9, Math.floor((fitW - 40) / 65)));
        const stepX = (fitW - 40) / Math.max(1, rodCount - 1);
        for (let r = 0; r < rodCount; r++) {
          components.push({
            id: `${baseId}_sub_rod_${r + 1}`,
            role: "special_fitting",
            label: `Häfele Pantolon Askı Çubuğu #${r + 1}`,
            bayIndex: bayIdx,
            dimensions: { width: 10, height: 12, depth: Math.max(80, fitD - 24) },
            position: { x: fitX + 20 + Math.round(r * stepX), y: fitY + fit.height - 18, z: fitZ + 12 },
            materialId: "mat_anodized_metal",
            isManufacturablePanel: false,
          });
        }
      } else if (fit.type === "wardrobe_lift") {
        // Left & right side damper mechanisms + central vertical pull-down wand
        components.push(
          {
            id: `${baseId}_sub_damper_left`,
            role: "special_fitting",
            label: "Servetto Sol Amortisör Kutusu",
            bayIndex: bayIdx,
            dimensions: { width: 28, height: 140, depth: 95 },
            position: { x: bayStartX + 2, y: fitY, z: depth / 2 - 45 },
            materialId: "mat_anodized_metal",
            isManufacturablePanel: false,
          },
          {
            id: `${baseId}_sub_damper_right`,
            role: "special_fitting",
            label: "Servetto Sağ Amortisör Kutusu",
            bayIndex: bayIdx,
            dimensions: { width: 28, height: 140, depth: 95 },
            position: { x: bayStartX + bayW - 30, y: fitY, z: depth / 2 - 45 },
            materialId: "mat_anodized_metal",
            isManufacturablePanel: false,
          },
          {
            id: `${baseId}_sub_pull_wand`,
            role: "special_fitting",
            label: "Servetto Teleskopik Çekme Kolu",
            bayIndex: bayIdx,
            dimensions: { width: 14, height: Math.max(300, fit.height - 60), depth: 14 },
            position: { x: bayStartX + bayW / 2 - 7, y: fitY + 20, z: depth / 2 },
            materialId: "mat_metal_chrome",
            isManufacturablePanel: false,
          }
        );
      } else if (fit.type === "pantry_pullout") {
        // Kesseböhmer Dispensa 5-tier wire baskets along the tall frame
        const tiers = 5;
        const stepY = Math.floor((fit.height - 100) / Math.max(1, tiers - 1));
        for (let t = 0; t < tiers; t++) {
          components.push({
            id: `${baseId}_sub_basket_${t + 1}`,
            role: "special_fitting",
            label: `Kesseböhmer Dispensa Sepet #${t + 1}`,
            bayIndex: bayIdx,
            dimensions: { width: Math.max(80, fitW - 24), height: 75, depth: Math.max(100, fitD - 20) },
            position: { x: fitX + 12, y: fitY + t * stepY, z: fitZ + 10 },
            materialId: "mat_metal_chrome",
            isManufacturablePanel: false,
          });
        }
      } else if (fit.type === "corner_lemans") {
        // Kesseböhmer LeMans II pivot pole + 2 kidney swing trays
        components.push(
          {
            id: `${baseId}_sub_pivot_pole`,
            role: "special_fitting",
            label: "Kesseböhmer LeMans Döner Mil Ø35mm",
            bayIndex: bayIdx,
            dimensions: { width: 32, height: fit.height, depth: 32 },
            position: { x: fitX + fitW * 0.25, y: fitY, z: fitZ + fitD * 0.5 },
            materialId: "mat_metal_chrome",
            isManufacturablePanel: false,
          },
          {
            id: `${baseId}_sub_tray_upper`,
            role: "special_fitting",
            label: "Kesseböhmer LeMans II Üst Döner Tabla",
            bayIndex: bayIdx,
            dimensions: { width: Math.max(80, fitW - 30), height: 65, depth: Math.max(100, fitD - 30) },
            position: { x: fitX + 15, y: fitY + Math.round(fit.height * 0.58), z: fitZ + 15 },
            materialId: "mat_metal_chrome",
            isManufacturablePanel: false,
          }
        );
      } else if (fit.type === "waste_bin") {
        // Häfele dual waste bins (30L + 15L)
        const halfW = Math.max(40, Math.floor((fitW - 24) / 2));
        components.push(
          {
            id: `${baseId}_sub_bin_30l`,
            role: "special_fitting",
            label: "Häfele 30L Ana Çöp Kovası",
            bayIndex: bayIdx,
            dimensions: { width: halfW + 16, height: Math.max(120, fit.height - 36), depth: Math.max(100, fitD - 24) },
            position: { x: fitX + 6, y: fitY + 18, z: fitZ + 12 },
            materialId: "mat_anodized_metal",
            isManufacturablePanel: false,
          },
          {
            id: `${baseId}_sub_bin_15l`,
            role: "special_fitting",
            label: "Häfele 15L Geri Dönüşüm Kovası",
            bayIndex: bayIdx,
            dimensions: { width: Math.max(36, halfW - 16), height: Math.max(120, fit.height - 36), depth: Math.max(100, fitD - 24) },
            position: { x: fitX + halfW + 26, y: fitY + 18, z: fitZ + 12 },
            materialId: "mat_metal_chrome",
            isManufacturablePanel: false,
          }
        );
      } else if (fit.type === "led_profile") {
        const xOff = bayStartX + Math.round((bayW - ledChanW) / 2);
        bay.shelves.forEach((sh, shIdx) => {
          components.push({
            id: `${baseId}_recessed_led_sh_${shIdx}`,
            role: "special_fitting",
            label: `Häfele Loox5 Raf #${shIdx + 1} Altı Gömme LED 3000K (${ledChanW}×${ledChanD}mm)`,
            bayIndex: bayIdx,
            dimensions: { width: ledChanW, height: 4, depth: ledChanD },
            position: { x: xOff, y: plinthHeight + T + sh.elevationY - 2.5, z: Math.max(50, depth - 95) },
            materialId: "mat_led_warm_3000k",
            isManufacturablePanel: false,
          });
        });
      } else if (fit.type === "led_vertical_strip") {
        const vLedH = Math.max(160, netInnerH - 24);
        components.push({
          id: `${baseId}_recessed_led_vert_right`,
          role: "special_fitting",
          label: `Häfele Loox5 Sağ Dikme Gömme Boy LED 3000K (${ledChanW}×${ledChanD}mm)`,
          bayIndex: bayIdx,
          dimensions: { width: 4, height: vLedH, depth: ledChanW },
          position: { x: bayStartX + bayW - 2.5, y: plinthHeight + T + 12, z: Math.max(24, depth - ledChanD) },
          materialId: "mat_led_warm_3000k",
          isManufacturablePanel: false,
        });
      } else if (fit.type === "led_rod_strip") {
        components.push({
          id: `${baseId}_sub_led_rod`,
          role: "special_fitting",
          label: "Häfele Loox5 Sensörlü LED Askı Borusu 3000K",
          bayIndex: bayIdx,
          dimensions: { width: Math.max(60, bayW - 4), height: 28, depth: 18 },
          position: { x: bayStartX + 2, y: fitY, z: depth / 2 },
          materialId: "mat_led_warm_3000k",
          isManufacturablePanel: false,
        });
      }
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
        isManufacturablePanel: true,
        thicknessAxis: "x",
      });
    });

    // Drawers with manufacturer cutting deduction support
    const bayLeafSpec = fourSpace.doorLeaves[bayIdx];
    const hasNoUpperDoor =
      Boolean(module.isOpenFront) ||
      !bay.door ||
      bay.door.type === "open" ||
      bay.door.doorSystemId === "open";
    bay.drawers.forEach((drawer, dIdx) => {
      const isExtDrawer = !drawer.isInternal;
      const isExtOverlay = isExtDrawer && bayLeafSpec?.overlayType !== "inset";
      const isLowestExtDrawer = isExtOverlay && drawer.elevationY <= 5;
      const isHighestDrawerInBay = !bay.drawers.some(
        (other) => other.id !== drawer.id && other.elevationY > drawer.elevationY
      );
      const isTopComboExtDrawer = isExtOverlay && drawer.elevationY >= netInnerH * 0.55;
      const isTopAtCabinetCeiling =
        isExtOverlay &&
        isHighestDrawerInBay &&
        (isTopComboExtDrawer ||
          (hasNoUpperDoor && drawer.elevationY + drawer.height >= netInnerH * 0.7));
      const extraCoverMm =
        isLowestExtDrawer || isTopComboExtDrawer ? Math.max(0, T - doorPerimeterGap) : 0;
      const drawerY0 = plinthHeight + T + drawer.elevationY;
      const frontX = isExtDrawer ? (bayLeafSpec?.doorX0Mm ?? bayStartX + 2) : bayStartX + 2;
      const frontY = isLowestExtDrawer ? plinthHeight + doorPerimeterGap : drawerY0 + 1.5;
      const cabinetTopAlignY =
        height - doorPerimeterGap - (bay.door.handleCategory === "gola_profile" ? 30 : 0);
      const frontH = isTopAtCabinetCeiling
        ? Math.max(40, cabinetTopAlignY - frontY)
        : Math.max(40, drawer.height + extraCoverMm - 3);
      const frontW = isExtDrawer
        ? Math.max(60, bayLeafSpec?.fullDoorSpanWidthMm || bayW - 4)
        : Math.max(60, bayW - 4);
      const pulledZ = drawerOpenMm;
      const frontZ = isExtDrawer
        ? (bayLeafSpec?.doorZ0Mm ?? depth) + pulledZ + explodeZ
        : depth - T + pulledZ + explodeZ - 24;
      const hwId = drawer.hardwareProductId || "";
      const isAvanTech = hwId === "hw_hettich_avantech_m";
      const isLegrabox = hwId.includes("legrabox");
      const isMovento = hwId.includes("movento");
      const isTandembox = hwId.includes("tandembox");
      const lengthDeductionMm = isTandembox ? 24 : isAvanTech ? 21 : 10;
      const bottomWidthDeductionMm = isTandembox
        ? 75
        : isMovento
        ? 42
        : isLegrabox
        ? 35
        : isAvanTech
        ? 24
        : 68;
      const backWidthDeductionMm = isTandembox
        ? 87
        : isMovento
        ? 42
        : isLegrabox
        ? 38
        : isAvanTech
        ? 24
        : 68;

      const maxBoxD = Math.max(120, frontZ - pulledZ - explodeZ - 24);
      const boxD = Math.min(
        maxBoxD,
        drawer.nominalLengthMm
          ? Math.min(netInnerD - 10, drawer.nominalLengthMm - lengthDeductionMm)
          : Math.min(500, Math.max(260, netInnerD - 50))
      );
      const boxH = Math.max(70, Math.min(220, drawer.height - 38));
      const boxT = isAvanTech || isLegrabox ? 13 : 16;
      const bottomT = isTandembox || isLegrabox || isAvanTech ? 16 : 8;
      // Respect manufacturer width deduction (24mm AvanTech, 35mm LEGRABOX, 42mm MOVENTO, 75mm TANDEMBOX)
      const sideClearance = isTandembox
        ? 21.5
        : isMovento
        ? 21
        : isLegrabox
        ? 17.5
        : isAvanTech
        ? 12
        : 18;
      const boxX0 = bayStartX + sideClearance;
      const boxW = Math.max(100, bayW - 2 * sideClearance);
      const bottomBoardW = hwId
        ? Math.max(80, bayW - bottomWidthDeductionMm)
        : Math.max(68, boxW - 2 * boxT);
      const backBoardW = hwId
        ? Math.max(80, bayW - backWidthDeductionMm)
        : Math.max(68, boxW - 2 * boxT);
      const boxZ0 = frontZ - boxD;

      // 1. Front Panel
      components.push({
        id: `${drawer.id}_front`,
        role: "drawer_front",
        label: `Çekmece Önü B${bayIdx + 1}-${dIdx + 1}`,
        bayIndex: bayIdx,
        dimensions: { width: frontW, height: frontH, depth: T },
        position: {
          x: frontX,
          y: frontY,
          z: frontZ,
        },
        materialId: drawer.frontMaterialId || doorMaterialId,
        isFrontFacing: true,
        isManufacturablePanel: true,
        thicknessAxis: "z",
      });

      // 3. Left Side Panel of Box
      components.push({
        id: `${drawer.id}_side_left`,
        role: "drawer_side_left",
        label: `Çekmece Sol Kasa B${bayIdx + 1}-${dIdx + 1}`,
        bayIndex: bayIdx,
        dimensions: { width: boxT, height: boxH, depth: boxD },
        position: { x: boxX0, y: drawerY0 + 8, z: boxZ0 },
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        thicknessAxis: "x",
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
        isManufacturablePanel: true,
        thicknessAxis: "x",
      });

      // 5. Back Panel of Box
      components.push({
        id: `${drawer.id}_back`,
        role: "drawer_back",
        label: `Çekmece Arka Kasa B${bayIdx + 1}-${dIdx + 1}`,
        bayIndex: bayIdx,
        dimensions: { width: backBoardW, height: boxH, depth: boxT },
        position: { x: bayStartX + (bayW - backBoardW) / 2, y: drawerY0 + 8, z: boxZ0 },
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        thicknessAxis: "z",
      });

      // 6. Bottom Floor Board of Box
      components.push({
        id: `${drawer.id}_bottom`,
        role: "drawer_bottom",
        label: `Çekmece Tabanı B${bayIdx + 1}-${dIdx + 1}`,
        bayIndex: bayIdx,
        dimensions: { width: bottomBoardW, height: bottomT, depth: hwId ? boxD : boxD - boxT },
        position: { x: bayStartX + (bayW - bottomBoardW) / 2, y: drawerY0 + 8, z: boxZ0 + boxT },
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        thicknessAxis: "y",
      });

      // 7. Left & Right Undermount Slide Rails
      const slideZ0 = boxZ0 - (pulledZ > 0 ? pulledZ * 0.5 : 0);
      components.push({
        id: `${drawer.id}_slide_left`,
        role: "drawer_slide",
        label: `Çekmece Rayı Sol B${bayIdx + 1}-${dIdx + 1}`,
        bayIndex: bayIdx,
        dimensions: { width: 12, height: 16, depth: boxD },
        position: {
          x: bayStartX + 4,
          y: drawerY0 + 2,
          z: slideZ0,
        },
        materialId: "mat_anodized_metal",
        isManufacturablePanel: false,
      });

      components.push({
        id: `${drawer.id}_slide_right`,
        role: "drawer_slide",
        label: `Çekmece Rayı Sağ B${bayIdx + 1}-${dIdx + 1}`,
        bayIndex: bayIdx,
        dimensions: { width: 12, height: 16, depth: boxD },
        position: {
          x: bayStartX + bayW - 16,
          y: drawerY0 + 2,
          z: slideZ0,
        },
        materialId: "mat_anodized_metal",
        isManufacturablePanel: false,
      });
    });

    // Doors — Consuming Canonical 4-Space Door Leaf Geometry
    if (!module.isOpenFront && bay.door && bay.door.type !== "open" && bay.door.doorSystemId !== "open") {
      const dType = bay.door.type;
      const dSys = bay.door.doorSystemId || inferDoorSystemIdFromType(dType);
      const leafSpec = fourSpace.doorLeaves[bayIdx];
      const isInset = leafSpec.overlayType === "inset";
      const isHalfOverlay = leafSpec.overlayType === "half_overlay";

      const isBlindCornerCab =
        (module.templateId?.includes("blind") || lowerName.includes("kör köşe")) &&
        module.bays.length === 1;
      const blindPanelSpanW = isBlindCornerCab ? Math.max(120, Math.round(innerSpanW * 0.45)) : 0;
      const doorH = leafSpec.baseDoorHeightMm;
      const doorY = leafSpec.doorY0Mm;
      const doorZ = leafSpec.doorZ0Mm + explodeZ;
      const doorX0 = isBlindCornerCab ? T + blindPanelSpanW + 2 : leafSpec.doorX0Mm;
      const fullDoorW = isBlindCornerCab
        ? Math.max(140, width - doorX0 - 2)
        : leafSpec.fullDoorSpanWidthMm;
      const T_door = leafSpec.leafThicknessMm;
      const rad = (doorOpenAngleDeg * Math.PI) / 180;
      const openRatio = Math.min(1, Math.max(0, doorOpenAngleDeg / 90));
      const doorMatId = bay.door.doorMaterialId || doorMaterialId;

      const isHingedDoubleSplit = !isBlindCornerCab && (
        dSys === "hinged_double" ||
        dType === "double" ||
        dType === "inset_double" ||
        (!dSys.startsWith("sliding") &&
          !dSys.startsWith("lift_") &&
          dSys !== "folding_side" &&
          dType !== "folding" &&
          dSys !== "pocket_retractable" &&
          dType !== "pocket" &&
          dSys !== "tambour_roller" &&
          dType !== "tambour" &&
          leafSpec.leafCount === 2));

      if (isHingedDoubleSplit) {
        const leafW = leafSpec.leafWidthMm;
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
          isManufacturablePanel: true,
          thicknessAxis: "z",
        });
        components.push({
          id: `${bay.door.id}_leaf_right`,
          role: "door_right",
          label: `Çift Kapak Sağ B${bayIdx + 1}`,
          bayIndex: bayIdx,
          dimensions: { width: leafW, height: doorH, depth: T_door },
          position: { x: doorX0 + leafW + leafSpec.centerRevealGapMm, y: doorY, z: doorZ },
          rotation: [0, rad, 0],
          materialId: doorMatId,
          isFrontFacing: true,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        });
      } else if (dSys === "sliding_top_hung" || dSys === "sliding_bottom_rolling" || dSys === "sliding_coplanar" || dType === "sliding" || dType === "sliding_bottom") {
        const mountKind =
          bay.door.slidingMountingType ||
          (dSys === "sliding_bottom_rolling" || dType === "sliding_bottom"
            ? "inset_inside"
            : dSys === "sliding_coplanar"
            ? "coplanar_flush"
            : "top_hung_pelmet");

        const totalBays = Math.max(1, module.bays.length);
        const isFrontTrack = bayIdx % 2 === 1 || totalBays === 1;
        const slideDir = bayIdx >= totalBays - 1 ? -1 : 1;

        // Calculate realistic door width, Y-span, and Z-plane per mounting system
        let effDoorW = leafSpec.leafWidthMm;
        let effDoorH = doorH;
        let effDoorY = doorY;
        let baseClosedX = Math.max(0, Math.min(width - effDoorW, doorX0));
        let leafZ = doorZ;

        if (mountKind === "inset_inside") {
          // 1. INSET DUAL-TRACK (Hettich SlideLine M / Häfele Slido F-Line21):
          // Runs strictly INSIDE carcass side panels & top/bottom horizontal boards with 24mm center overlap!
          const innerClearSpanW = Math.max(240, width - 2 * T);
          const overlapMm = totalBays > 1 ? 22 : 0;
          effDoorW = Math.round((innerClearSpanW + overlapMm * (totalBays - 1)) / totalBays);
          baseClosedX = Math.round(
            T + bayIdx * ((innerClearSpanW - effDoorW) / Math.max(1, totalBays - 1))
          );
          effDoorY = plinthHeight + T + 12; // 12mm bottom recessed track clearance
          effDoorH = Math.max(160, height - plinthHeight - 2 * T - 24); // 12mm top + 12mm bottom track clearance
          leafZ = isFrontTrack ? depth - T_door - 4 : depth - 2 * T_door - 12;
        } else if (mountKind === "coplanar_flush") {
          // 4. COPLANAR FLUSH (Hettich InLine XL / Cinetto PS48):
          // Completely flush in a single Z plane when closed; active front leaf pops out +48mm on pantograph arms then slides!
          const popProgress = Math.min(1, openRatio * 3.5);
          const slideProgress = Math.max(0, (openRatio - 0.22) / 0.78);
          const popZ = isFrontTrack ? popProgress * 48 : 0;
          effDoorY = plinthHeight + 4;
          effDoorH = Math.max(160, height - plinthHeight - 6);
          leafZ = depth + 4 + popZ;
          const coplanarSlideOffset = isFrontTrack ? slideProgress * (bayW * 0.84) * slideDir : 0;
          baseClosedX = Math.max(0, Math.min(width - effDoorW, doorX0));
          const coplanarX = Math.max(0, Math.min(width - effDoorW, baseClosedX + coplanarSlideOffset));

          components.push({
            id: `${bay.door.id}_sliding_${isFrontTrack ? "front" : "rear"}`,
            role: "door_left",
            label: `Hemzemin Koplanar Sürgü Kapak B${bayIdx + 1}`,
            bayIndex: bayIdx,
            dimensions: { width: effDoorW, height: effDoorH, depth: T_door },
            position: { x: coplanarX, y: effDoorY, z: leafZ },
            materialId: doorMatId,
            isFrontFacing: true,
            isManufacturablePanel: true,
            thicknessAxis: "z",
          });

          // Top & Bottom Pantograph Carriage Units attached to leaf
          components.push({
            id: `${bay.door.id}_sliding_coplanar_mech_top`,
            role: "special_fitting",
            label: `InLine XL Üst Koplanar Pantograf Mekanizması B${bayIdx + 1}`,
            bayIndex: bayIdx,
            dimensions: { width: Math.min(260, effDoorW * 0.42), height: 34, depth: 52 + popZ },
            position: {
              x: coplanarX + effDoorW * 0.29,
              y: height - 2,
              z: depth - 42,
            },
            materialId: "mat_metal_chrome",
          });
        } else {
          // 2 & 3. TOP-HUNG EXTERNAL OVERLAY (Exposed TopLine XL vs Concealed Pelmet Fascia):
          const overlapMm = totalBays > 1 ? 26 : 0;
          effDoorW = Math.round((width + overlapMm * (totalBays - 1)) / totalBays);
          baseClosedX = Math.round(
            bayIdx * ((width - effDoorW) / Math.max(1, totalBays - 1))
          );
          effDoorY = plinthHeight + 4;
          effDoorH = Math.max(160, height - plinthHeight - 4);
          leafZ = isFrontTrack ? depth + 34 : depth + 8;
        }

        if (mountKind !== "coplanar_flush") {
          const maxLeft = mountKind === "inset_inside" ? T : 0;
          const maxRight = mountKind === "inset_inside" ? width - T - effDoorW : width - effDoorW;
          const rawSlideOffset = isFrontTrack ? openRatio * (bayW * 0.82) * slideDir : 0;
          const clampedSlideX = Math.max(maxLeft, Math.min(maxRight, baseClosedX + rawSlideOffset));

          const mountTitle =
            mountKind === "inset_inside"
              ? "İçten Raylı Sürgü Kapak"
              : mountKind === "top_hung_pelmet"
              ? "Üstü Kapamalı Sürgü Kapak"
              : "Üstten Askılı Sürgü Kapak";

          components.push({
            id: `${bay.door.id}_sliding_${isFrontTrack && totalBays > 1 ? "front" : totalBays > 1 ? "rear" : "front"}`,
            role: "door_left",
            label: `${mountTitle} B${bayIdx + 1}`,
            bayIndex: bayIdx,
            dimensions: { width: effDoorW, height: effDoorH, depth: T_door },
            position: {
              x: clampedSlideX,
              y: effDoorY,
              z: leafZ,
            },
            materialId: doorMatId,
            isFrontFacing: true,
            isManufacturablePanel: true,
            thicknessAxis: "z",
          });

          // Emit 2 Roller Carriages + Silent-System Soft-Close Damper per Sliding Door Leaf!
          [0.16, 0.84].forEach((xFrac, cIdx) => {
            const carrX = clampedSlideX + effDoorW * xFrac - 48;
            if (mountKind === "inset_inside") {
              // Bottom recessed ball-bearing wheel carriage + top guide roller
              components.push({
                id: `${bay.door.id}_sliding_carriage_inset_${cIdx}`,
                role: "special_fitting",
                label: `SlideLine M Gömme Tekerlek & Fren Arabası #${cIdx + 1} B${bayIdx + 1}`,
                bayIndex: bayIdx,
                dimensions: { width: 96, height: 28, depth: 18 },
                position: { x: carrX, y: effDoorY - 6, z: leafZ - 8 },
                materialId: "mat_metal_chrome",
              });
            } else {
              // Top-hung gooseneck steel bracket + twin roller carriage riding on top track
              components.push({
                id: `${bay.door.id}_sliding_carriage_top_${cIdx}`,
                role: "special_fitting",
                label: `TopLine XL Üstten Askı Tekerlek & Fren Arabası #${cIdx + 1} B${bayIdx + 1}`,
                bayIndex: bayIdx,
                dimensions: { width: 108, height: 42, depth: isFrontTrack ? 48 : 24 },
                position: {
                  x: carrX,
                  y: height - 18,
                  z: depth - 4,
                },
                materialId: "mat_metal_chrome",
              });
            }
          });
        }
      } else if (dSys === "lift_up_stay" || dType === "lift_up_stay") {
        components.push({
          id: `${bay.door.id}_lift_stay`,
          role: "door_left",
          label: `Yukarı Kalkar Kapak (HK top) B${bayIdx + 1}`,
          bayIndex: bayIdx,
          dimensions: { width: fullDoorW, height: doorH, depth: T_door },
          position: {
            x: doorX0,
            y: doorY,
            z: doorZ,
          },
          rotation: [-rad * 0.95, 0, 0],
          materialId: doorMatId,
          isFrontFacing: true,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        });
        // Real 3D Blum AVENTOS HK top Power Units & Telescopic Stay Arms (Left & Right Side Panels)
        const mechH = Math.min(130, Math.max(80, doorH * 0.36));
        const mechD = Math.min(210, Math.max(110, netInnerD * 0.62));
        const mechY = doorY + Math.max(30, doorH - mechH - 22);
        const mechZ = Math.max(24, depth - mechD - 16);
        [-1, 1].forEach((sideSign) => {
          const isRightSide = sideSign === 1;
          components.push({
            id: `${bay.door.id}_aventos_mech_hk_${isRightSide ? "right" : "left"}`,
            role: "special_fitting",
            label: `Blum AVENTOS HK top Güç Ünitesi & Kaldırma Kolu (${isRightSide ? "Sağ" : "Sol"}) B${bayIdx + 1}`,
            bayIndex: bayIdx,
            dimensions: { width: 32, height: mechH, depth: mechD },
            position: {
              x: isRightSide ? bayStartX + bayW - 34 : bayStartX + 2,
              y: mechY,
              z: mechZ,
            },
            rotation: [-rad * 0.45, 0, 0],
            materialId: "mat_metal_chrome",
            isManufacturablePanel: false,
          });
        });
      } else if (dSys === "lift_parallel") {
        // WP-04: 4-bar parallelogram linkage arc (AVENTOS HL top)
        const armRadius = Math.min(220, doorH * 0.52);
        const linkAngle = openRatio * (Math.PI * 0.62);
        const liftDy = Math.round(armRadius * (1 - Math.cos(linkAngle)) + openRatio * (doorH * 0.32));
        const liftDz = Math.round(armRadius * Math.sin(linkAngle));
        components.push({
          id: `${bay.door.id}_lift_parallel`,
          role: "door_left",
          label: `Paralel Kalkar Kapak (HL top) B${bayIdx + 1}`,
          bayIndex: bayIdx,
          dimensions: { width: fullDoorW, height: doorH, depth: T_door },
          position: {
            x: doorX0,
            y: doorY + liftDy,
            z: doorZ + liftDz,
          },
          materialId: doorMatId,
          isFrontFacing: true,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        });
        // Real 3D Blum AVENTOS HL top 4-Bar Parallelogram Power Units & Arms (Left & Right)
        const mechH = Math.min(140, Math.max(85, doorH * 0.38));
        const mechD = Math.min(220, Math.max(120, netInnerD * 0.65));
        const mechY = doorY + Math.max(30, doorH - mechH - 24);
        const mechZ = Math.max(24, depth - mechD - 14);
        [-1, 1].forEach((sideSign) => {
          const isRightSide = sideSign === 1;
          components.push({
            id: `${bay.door.id}_aventos_mech_hl_${isRightSide ? "right" : "left"}`,
            role: "special_fitting",
            label: `Blum AVENTOS HL top Paralel Mekanizma (${isRightSide ? "Sağ" : "Sol"}) B${bayIdx + 1}`,
            bayIndex: bayIdx,
            dimensions: { width: 32, height: mechH, depth: mechD + Math.round(liftDz * 0.7) },
            position: {
              x: isRightSide ? bayStartX + bayW - 34 : bayStartX + 2,
              y: mechY,
              z: mechZ,
            },
            rotation: [-linkAngle * 0.42, 0, 0],
            materialId: "mat_metal_chrome",
            isManufacturablePanel: false,
          });
        });
      } else if (dSys === "lift_bi_fold") {
        // WP-04: Coupled 2-leaf bi-fold linkage (Blum AVENTOS HF top)
        // Upper leaf pivots around its stationary TOP edge (y = doorY + 2*halfH + gap, z = doorZ)
        // Lower leaf top edge is hinged directly to the moving bottom edge of the upper leaf!
        const halfH = leafSpec.leafHeightMm;
        const thetaTop = rad * 0.92;
        const thetaBot = rad * 0.62;
        const topLeafBaseY = doorY + halfH + doorPerimeterGap;
        const topCeilingPivotY = topLeafBaseY + halfH;
        const knuckleJointY = topCeilingPivotY - Math.round(halfH * Math.cos(thetaTop)) - doorPerimeterGap;
        const knuckleJointZ = doorZ + Math.round(halfH * Math.sin(thetaTop));
        components.push({
          id: `${bay.door.id}_lift_bifold_top`,
          role: "door_left",
          label: `Katlanır Kalkar Üst Kanat B${bayIdx + 1}`,
          bayIndex: bayIdx,
          dimensions: { width: fullDoorW, height: halfH, depth: T_door },
          position: {
            x: doorX0,
            y: topLeafBaseY,
            z: doorZ,
          },
          rotation: [-thetaTop, 0, 0],
          materialId: doorMatId,
          isFrontFacing: true,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        });
        components.push({
          id: `${bay.door.id}_lift_bifold_bot`,
          role: "door_right",
          label: `Katlanır Kalkar Alt Kanat B${bayIdx + 1}`,
          bayIndex: bayIdx,
          dimensions: { width: fullDoorW, height: halfH, depth: T_door },
          position: {
            x: doorX0,
            y: knuckleJointY - halfH,
            z: knuckleJointZ,
          },
          rotation: [thetaBot, 0, 0],
          materialId: doorMatId,
          isFrontFacing: true,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        });
        // Real 3D Blum AVENTOS HF top Bi-Fold Power Units & Telescopic Arms (Left & Right)
        const mechH = Math.min(145, Math.max(90, doorH * 0.34));
        const mechD = Math.min(230, Math.max(120, netInnerD * 0.66));
        const mechY = doorY + Math.max(40, doorH - mechH - 22);
        const mechZ = Math.max(24, depth - mechD - 14);
        [-1, 1].forEach((sideSign) => {
          const isRightSide = sideSign === 1;
          components.push({
            id: `${bay.door.id}_aventos_mech_hf_${isRightSide ? "right" : "left"}`,
            role: "special_fitting",
            label: `Blum AVENTOS HF top Katlanır Teleskopik Mekanizma (${isRightSide ? "Sağ" : "Sol"}) B${bayIdx + 1}`,
            bayIndex: bayIdx,
            dimensions: { width: 32, height: mechH, depth: mechD + Math.round((knuckleJointZ - doorZ) * 0.65) },
            position: {
              x: isRightSide ? bayStartX + bayW - 34 : bayStartX + 2,
              y: mechY,
              z: mechZ,
            },
            rotation: [-thetaTop * 0.45, 0, 0],
            materialId: "mat_metal_chrome",
            isManufacturablePanel: false,
          });
        });
      } else if (dSys === "folding_side" || dType === "folding") {
        // WP-04: True Coupled Accordion Bi-Fold Kinematics (Hettich WingLine L)
        // Wing 1 pivots around left carcass edge (doorX0, doorZ + T_door) by -thetaWing;
        // Wing 2 left knuckle is locked to Wing 1 right tip (jointX, jointZ) and rotates by +thetaWing so its right roller glides along z = doorZ!
        const wingW = Math.max(120, Math.round((fullDoorW - doorPerimeterGap) / 2));
        const thetaWing = rad * 0.88;
        const jointX = doorX0 + Math.round(wingW * Math.cos(thetaWing)) + doorPerimeterGap;
        const jointZ = doorZ + Math.round(wingW * Math.sin(thetaWing));
        components.push({
          id: `${bay.door.id}_fold_wing_1`,
          role: "door_left",
          label: `Katlanır Sol Ana Kanat B${bayIdx + 1}`,
          bayIndex: bayIdx,
          dimensions: { width: wingW, height: doorH, depth: T_door },
          position: { x: doorX0, y: doorY, z: doorZ },
          rotation: [0, -thetaWing, 0],
          materialId: doorMatId,
          isFrontFacing: true,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        });
        components.push({
          id: `${bay.door.id}_fold_wing_2`,
          role: "door_right",
          label: `Katlanır Sağ Eşlenik Kanat B${bayIdx + 1}`,
          bayIndex: bayIdx,
          dimensions: { width: wingW, height: doorH, depth: T_door },
          position: {
            x: jointX,
            y: doorY,
            z: jointZ,
          },
          rotation: [0, thetaWing, 0],
          materialId: doorMatId,
          isFrontFacing: true,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        });
        // Top Aluminum Guide Track for Hettich WingLine L Folding System
        components.push({
          id: `${bay.door.id}_wingline_top_track`,
          role: "special_fitting",
          label: `Hettich WingLine L Üst Katlanır Kılavuz Rayı B${bayIdx + 1}`,
          bayIndex: bayIdx,
          dimensions: { width: fullDoorW, height: 14, depth: 22 },
          position: { x: doorX0, y: doorY + doorH - 12, z: doorZ - 8 },
          materialId: "mat_metal_chrome",
          isManufacturablePanel: false,
        });
      } else if (dSys === "pocket_retractable" || dType === "pocket") {
        // WP-04: Two-stage pivot (0..35%) then linear pocket retraction (35..100%)
        const pivotPhase = Math.min(1, openRatio / 0.35);
        const retractPhase = openRatio > 0.35 ? (openRatio - 0.35) / 0.65 : 0;
        const pocketYawRad = -pivotPhase * (Math.PI / 2);
        const retractZ = Math.round(retractPhase * Math.min(500, depth * 0.76));
        components.push({
          id: `${bay.door.id}_pocket_leaf`,
          role: "door_left",
          label: `Pocket Gizlenen Kapak B${bayIdx + 1}`,
          bayIndex: bayIdx,
          dimensions: { width: fullDoorW, height: doorH, depth: T_door },
          position: {
            x: doorX0 + Math.round(pivotPhase * 22),
            y: doorY,
            z: doorZ - retractZ,
          },
          rotation: [0, pocketYawRad, 0],
          materialId: doorMatId,
          isFrontFacing: true,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        });
        if (openRatio > 0.05) {
          components.push({
            id: `${bay.door.id}_revego_pocket_track`,
            role: "special_fitting",
            label: `REVEGO Pocket Taşıyıcı Ray B${bayIdx + 1}`,
            bayIndex: bayIdx,
            dimensions: { width: 16, height: 24, depth: Math.max(200, depth - 60) },
            position: {
              x: bayStartX + 6,
              y: doorY + doorH - 28,
              z: T + 20,
            },
            materialId: "mat_metal_chrome",
            isManufacturablePanel: false,
          });
        }
      } else if (dSys === "tambour_roller" || dType === "tambour") {
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
          isManufacturablePanel: true,
          thicknessAxis: "z",
        });
      } else {
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
          isManufacturablePanel: true,
          thicknessAxis: "z",
        });
      }
    }

    currentX += bayW + T;
  });

  // MODULE-WIDE SLIDING DOOR TRACK RAILS, STB-19 BOTTOM GUIDES & CONCEALED TOP PELMET FASCIA VALANCE
  const firstSlidingBay = !module.isOpenFront
    ? module.bays.find((b) => {
        const ds = b.door?.doorSystemId || inferDoorSystemIdFromType(b.door?.type || "open");
        return (
          b.door &&
          b.door.type !== "open" &&
          (ds.startsWith("sliding") || b.door.type === "sliding" || b.door.type === "sliding_bottom")
        );
      })
    : undefined;

  if (firstSlidingBay) {
    const dSysSlide =
      firstSlidingBay.door.doorSystemId || inferDoorSystemIdFromType(firstSlidingBay.door.type);
    const mountKind =
      firstSlidingBay.door.slidingMountingType ||
      (dSysSlide === "sliding_bottom_rolling" || firstSlidingBay.door.type === "sliding_bottom"
        ? "inset_inside"
        : dSysSlide === "sliding_coplanar"
        ? "coplanar_flush"
        : "top_hung_pelmet");
    const pelmetMatId = firstSlidingBay.door.doorMaterialId || doorMaterialId;

    if (mountKind === "inset_inside") {
      // Recessed Double-Channel Anodized Aluminum Upper Guide Track & Lower Running Track inside Carcass
      const trackSpanW = Math.max(180, width - 2 * T);
      components.push({
        id: `${module.id}_sliding_track_inset_top`,
        role: "special_fitting",
        label: "Üst Çift Kanallı Gömme Alüminyum Sürgü Rayı (SlideLine M / Slido)",
        dimensions: { width: trackSpanW, height: 14, depth: 54 },
        position: { x: T, y: height - T - 14, z: depth - 58 },
        materialId: "mat_metal_chrome",
      });
      components.push({
        id: `${module.id}_sliding_track_inset_bottom`,
        role: "special_fitting",
        label: "Alt Çift Kanallı Gömme Alüminyum Taşıyıcı Ray (SlideLine M / Slido)",
        dimensions: { width: trackSpanW, height: 12, depth: 54 },
        position: { x: T, y: plinthHeight + T, z: depth - 58 },
        materialId: "mat_metal_chrome",
      });
    } else if (mountKind === "coplanar_flush") {
      // Concealed Roof-Mounted Coplanar Pantograph Track Housing + Under-Floor Guide Rail
      components.push({
        id: `${module.id}_sliding_track_coplanar_top`,
        role: "special_fitting",
        label: "InLine XL Üst Koplanar Senkronize Ray Kasası",
        dimensions: { width: width - 16, height: 26, depth: 78 },
        position: { x: 8, y: height, z: depth - 82 },
        materialId: "mat_metal_chrome",
      });
      components.push({
        id: `${module.id}_sliding_guide_bottom`,
        role: "special_fitting",
        label: "InLine XL Alt Gizli Koplanar Kılavuz Rayı",
        dimensions: { width: width - 24, height: 14, depth: 52 },
        position: { x: 12, y: Math.max(0, plinthHeight - 14), z: depth - 46 },
        materialId: "mat_metal_chrome",
      });
    } else {
      // Top-Hung Roof-Mounted Heavy-Duty Twin Aluminum Track (TopLine XL) + Concealed Bottom STB-19 Guide
      components.push({
        id: `${module.id}_sliding_track_top_hung`,
        role: "special_fitting",
        label: "Hettich TopLine XL Üstten Askılı Çift Yollu Alüminyum Taşıyıcı Ray",
        dimensions: { width, height: 28, depth: 66 },
        position: { x: 0, y: height, z: depth - 8 },
        materialId: "mat_metal_chrome",
      });
      components.push({
        id: `${module.id}_sliding_guide_bottom`,
        role: "special_fitting",
        label: "STB 19 Alt Tabla Altı Gizli Sürgü Kılavuz Profili",
        dimensions: { width: width - 16, height: 12, depth: 48 },
        position: { x: 8, y: Math.max(0, plinthHeight - 12), z: depth + 4 },
        materialId: "mat_metal_chrome",
      });

      // Architectural Top Pelmet / Fascia Cover + Left/Right Side End-Caps (Üstü Kapalı / Alın Kapamalı Sistem!)
      if (mountKind === "top_hung_pelmet") {
        const fasciaH = 62;
        const overhangZ = 60;
        components.push({
          id: `${module.id}_sliding_pelmet_fascia`,
          role: "carcass_top",
          label: "Sürgü Üst Alın Kapama Bandı (Gizli Ray Valansı)",
          dimensions: { width, height: fasciaH, depth: T },
          position: { x: 0, y: height - 18, z: depth + overhangZ - T },
          materialId: pelmetMatId,
          isFrontFacing: true,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        });
        components.push({
          id: `${module.id}_sliding_pelmet_cap_top`,
          role: "carcass_top",
          label: "Sürgü Üst Ray Toz Kapama Kepi",
          dimensions: { width, height: T, depth: overhangZ },
          position: { x: 0, y: height + fasciaH - 18, z: depth },
          materialId: pelmetMatId,
          isManufacturablePanel: true,
          thicknessAxis: "y",
        });
        [0, width - T].forEach((endX, sSide) => {
          components.push({
            id: `${module.id}_sliding_pelmet_end_${sSide}`,
            role: "carcass_side_left",
            label: `Sürgü Üst Valans ${sSide === 0 ? "Sol" : "Sağ"} Yan Kapama`,
            dimensions: { width: T, height: fasciaH, depth: overhangZ - T },
            position: { x: endX, y: height - 18, z: depth },
            materialId: pelmetMatId,
            isManufacturablePanel: true,
            thicknessAxis: "x",
          });
        });
      }
    }
  }

  // Explicit motion transforms are consumed identically by both renderers and 2D.
  const fronts = components.filter(c => c.role === "door_left" || c.role === "door_right" || c.role === "drawer_front");
  for (const front of fronts) {
    const bayIdx = front.bayIndex ?? 0;
    const bay = module.bays[bayIdx];
    const leafSpec = fourSpace.doorLeaves[bayIdx];
    if (front.rotation) {
      const topPivot = front.rotation[0] !== 0;
      const isRightEdgeHinge =
        front.role === "door_right" && !topPivot && !front.id.includes("fold_wing_2");
      front.pivot = {
        x: front.position.x + (isRightEdgeHinge ? front.dimensions.width : 0),
        y: front.position.y + (topPivot ? front.dimensions.height : 0),
        z: front.position.z + (topPivot ? 0 : front.dimensions.depth),
      };
    }
    if (front.role === "drawer_front" && bay.drawers.find(d => `${d.id}_front` === front.id)?.isInternal) {
      front.isInternalDrawer = true;
      continue;
    }
    const isRearSlidingLeaf = front.id.includes("_sliding_rear");
    const rawCategory =
      bay.door.handleCategory ??
      (bay.door.handleType === "none" || bay.door.handleType === "push_to_open"
        ? "handleless_plain"
        : "bar_handle");
    const category = isRearSlidingLeaf ? "recessed_grip" : rawCategory;
    components.push(
      ...generateHandleGeometry(front, category, {
        moduleCategory: module.category,
        moduleElevationY: module.position.y,
        moduleHeight: module.dimensions.height,
        handleOrientation: bay.door.handleOrientation,
        handleOffsetY: bay.door.handleOffsetY,
        handleEdgeInsetX: bay.door.handleEdgeInsetX,
        handleLengthMm: bay.door.handleLengthMm,
        handleMaterialId: bay.door.handleMaterialId,
        handleProfileId: bay.door.handleProfileId,
      })
    );

    // Emit visible 3D/2D concealed hinge cups & mounting plates along the hinge edge of hinged doors
    const dSys = bay.door.doorSystemId || inferDoorSystemIdFromType(bay.door.type);
    const isHingedLeaf =
      (front.role === "door_left" || front.role === "door_right") &&
      !dSys.startsWith("sliding") &&
      !dSys.startsWith("lift") &&
      dSys !== "tambour_roller" &&
      !front.id.includes("fold_wing_2");
    if (isHingedLeaf && leafSpec && leafSpec.hingePositionsY.length > 0) {
      const isRightHinge = front.role === "door_right";
      const hwBrand = bay.door.hardwareProductId?.includes("hettich")
        ? "Hettich Sensys"
        : bay.door.hardwareProductId?.includes("salice")
        ? "Salice Silentia+"
        : "Blum CLIP top";
      leafSpec.hingePositionsY.forEach((hy, hIdx) => {
        const hingeW = 28;
        const hingeH = 64;
        const hingeD = 38;
        const hx = isRightHinge
          ? front.position.x + front.dimensions.width - hingeW - 2
          : front.position.x + 2;
        const absY = front.position.y + hy - hingeH / 2;
        const hz = front.position.z - hingeD + 4;
        components.push({
          id: `${front.id}_hinge_${hIdx + 1}`,
          role: "door_hinge",
          label: `${hwBrand} Menteşe #${hIdx + 1} (Y:${hy}mm) B${bayIdx + 1}`,
          bayIndex: bayIdx,
          dimensions: { width: hingeW, height: hingeH, depth: hingeD },
          position: { x: hx, y: absY, z: hz },
          rotation: front.rotation,
          pivot: front.pivot,
          parentComponentId: front.id,
          materialId: "mat_metal_chrome",
          isManufacturablePanel: false,
        });
      });
    }
  }

  components.forEach((c) => {
    if (c.role === "plinth") {
      const plMat =
        module.carcass.plinthMaterialId || module.componentMaterialOverrides?.__plinth__;
      if (plMat) c.materialId = plMat;
    }
    if (c.role === "door_left" || c.role === "door_right" || c.role === "drawer_front") {
      const bayObj = typeof c.bayIndex === "number" ? module.bays[c.bayIndex] : module.bays[0];
      const prof =
        bayObj?.door?.crossSectionProfile || module.carcass.crossSectionProfile;
      const poly =
        bayObj?.door?.customCadPolygon || module.carcass.customCadPolygon;
      if (prof) c.crossSectionProfile = prof;
      if (poly && poly.length >= 3) {
        const cleanPoly = poly.filter(
          (pt) => Number.isFinite(pt.x) && Number.isFinite(pt.y)
        );
        let deduped: { x: number; y: number }[] = [];
        for (const pt of cleanPoly) {
          const prev = deduped[deduped.length - 1];
          if (!prev || Math.hypot(pt.x - prev.x, pt.y - prev.y) > 1e-4) {
            deduped.push({
              x: Math.max(0, Math.min(1, Number(pt.x.toFixed(4)))),
              y: Math.max(0, Math.min(1, Number(pt.y.toFixed(4)))),
            });
          }
        }
        if (deduped.length >= 3) {
          let signedArea2 = 0;
          for (let i = 0; i < deduped.length; i++) {
            const a = deduped[i];
            const b = deduped[(i + 1) % deduped.length];
            signedArea2 += a.x * b.y - b.x * a.y;
          }
          if (Math.abs(signedArea2) > 1e-4) {
            c.customCadPolygon = deduped;
          }
        }
      }
    }
    const ov = module.componentMaterialOverrides?.[c.id];
    if (ov) c.materialId = ov;
  });
  const result: ModuleGeometryBreakdown = {
    moduleId: module.id,
    overall: module.dimensions,
    components,
    bayWidths,
    netInnerHeight: netInnerH,
    netInnerDepth: netInnerD,
  };
  if (moduleGeometryCache.size >= 400) {
    const oldestKey = moduleGeometryCache.keys().next().value;
    if (oldestKey) moduleGeometryCache.delete(oldestKey);
  }
  moduleGeometryCache.set(cacheKey, result);
  return result;
}

export function generateMultiModuleGeometry(
  modules: ModuleInstance[],
  options: GenerateGeometryOptions = {}
): ModuleGeometryBreakdown[] {
  return modules.map((m) => generateModuleGeometry(m, options));
}
