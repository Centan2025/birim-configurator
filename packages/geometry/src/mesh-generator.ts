import {
  ModuleInstance,
  calculateBayWidths,
  calculateNetInnerHeight,
  calculateNetInnerDepth,
  calculateFourSpaceDimensions,
  inferDoorSystemIdFromType,
  resolveCanonicalDrawerCuttingFormula,
  isBuiltInDishwasherModule,
  isBuiltInOvenOrFridgeTower,
  isSinkModule,
  isCooktopModule,
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

  // Handle Fully Integrated Built-In Dishwasher (Checklist #12: Carcassless 600mm slot + exterior furniture door + continuous countertop & plinth!)
  if (isBuiltInDishwasherModule(module)) {
    const dshComponents: ComponentGeometry[] = [];
    const T_door = module.carcass.doorThickness || 18;
    const dshDoorH = Math.max(120, height - plinthHeight - 2 * doorPerimeterGap);
    const dshDoorW = Math.max(120, width - 2 * doorPerimeterGap);
    const rad = (doorOpenAngleDeg * Math.PI) / 180;
    const bay0 = module.bays[0];
    const dMatId = bay0?.door?.doorMaterialId || doorMaterialId;

    // 1. Continuous Lower Plinth Front Strip (no side legs inside appliance slot!)
    if (plinthHeight > 0) {
      const pSetback = module.carcass.plinthSetbackMm ?? 55;
      dshComponents.push({
        id: `${module.id}_plinth_front`,
        role: "plinth",
        label: `Ankastre Bulaşık Makinesi Ön Baza Bandı (H:${plinthHeight}mm)`,
        dimensions: { width, height: plinthHeight, depth: T },
        position: { x: 0, y: 0, z: Math.max(40, depth - pSetback - T) },
        materialId: module.carcass.plinthMaterialId || dMatId,
        isFrontFacing: true,
        isManufacturablePanel: true,
        thicknessAxis: "z",
      });
    }

    // 2. Appliance Stainless Body Preview (Non-manufacturable appliance volume inside 600mm niche)
    dshComponents.push({
      id: `${module.id}_builtin_dishwasher_body`,
      role: "special_fitting",
      label: "Tam Ankastre Bulaşık Makinesi Gövdesi (Ahşap Karkassız 600mm Boşluk)",
      dimensions: { width: Math.max(100, width - 4), height: Math.max(200, height - 6), depth: Math.max(200, depth - 15) },
      position: { x: 2, y: 0, z: 15 },
      materialId: "mat_anodized_metal",
      isManufacturablePanel: false,
    });

    // 3. Exterior Furniture Door Panel (pivots downward around bottom edge like a real dishwasher!)
    const dshDoor: ComponentGeometry = {
      id: `${bay0?.door?.id || module.id}_dsh_door`,
      role: "door_left",
      label: "Tam Ankastre Bulaşık Makinesi Mobilya Kapağı",
      bayIndex: 0,
      dimensions: { width: dshDoorW, height: dshDoorH, depth: T_door },
      position: { x: doorPerimeterGap, y: plinthHeight + doorPerimeterGap, z: depth },
      rotation: [rad * 0.85, 0, 0],
      pivot: { x: doorPerimeterGap, y: plinthHeight + doorPerimeterGap, z: depth },
      materialId: dMatId,
      isFrontFacing: true,
      isManufacturablePanel: true,
      thicknessAxis: "z",
    };
    dshComponents.push(dshDoor);

    if (bay0?.door) {
      const hCat = bay0.door.handleCategory || "bar_handle";
      dshComponents.push(
        ...generateHandleGeometry(dshDoor, hCat, {
          moduleCategory: module.category,
          moduleElevationY: module.position.y,
          moduleHeight: module.dimensions.height,
          handleOrientation: "horizontal",
          handleProfileId: bay0.door.handleProfileId,
          handleMaterialId: bay0.door.handleMaterialId,
        })
      );
    }

    // 4. Continuous Upper Countertop Slab above Dishwasher Niche
    dshComponents.push({
      id: `${module.id}_auto_countertop`,
      role: "countertop",
      label: "Bulaşık Makinesi Üstü Kesintisiz Kuvars Tezgâh (38mm)",
      dimensions: { width, height: 38, depth: depth + 26 },
      position: { x: 0, y: height, z: 0 },
      materialId: module.carcass.countertopMaterialId || "mat_neolith_calacatta_luxe",
      isFrontFacing: true,
      isManufacturablePanel: false,
    });

    const dshRes: ModuleGeometryBreakdown = {
      moduleId: module.id,
      overall: module.dimensions,
      components: dshComponents,
      bayWidths: [width],
      netInnerHeight: height - plinthHeight,
      netInnerDepth: depth,
    };
    moduleGeometryCache.set(cacheKey, dshRes);
    return dshRes;
  }

  // Handle Parametric Capsule Stadium Cabinet & Capsule Table Canonically (P0-01: Single Source of Truth for 3D + 2D + BOM!)
  if (
    module.carcass.hullShape === "capsule_stadium" ||
    module.carcass.hullShape === "capsule_table"
  ) {
    const capComponents: ComponentGeometry[] = [];
    const capR = Math.min(depth / 2, module.carcass.cornerRadiusMm || depth / 2);
    const straightSpanW = Math.max(0, width - 2 * capR);
    const buildStadiumContour = (wTotal: number, dTotal: number): [number, number][] => {
      const r = Math.min(wTotal / 2, dTotal / 2);
      const xL = r;
      const xR = Math.max(r, wTotal - r);
      const pts: [number, number][] = [];
      // 16-segment smooth stadium closed polygon in [0..dTotal, 0..wTotal] DXF local space (X=En=depth, Y=Boy=width)
      const segs = 8;
      for (let i = 0; i <= segs; i++) {
        const ang = Math.PI + (Math.PI * i) / segs;
        pts.push([
          Math.round((r + r * Math.cos(ang)) * 100) / 100,
          Math.round((xL + r * Math.sin(ang) * -1) * 100) / 100,
        ]);
      }
      for (let i = 0; i <= segs; i++) {
        const ang = (Math.PI * i) / segs;
        pts.push([
          Math.round((dTotal - r + r * Math.cos(ang)) * 100) / 100,
          Math.round((xR + r * Math.sin(ang)) * 100) / 100,
        ]);
      }
      return pts;
    };

    if (module.carcass.hullShape === "capsule_table") {
      const topT = module.attachedTableConfig?.topThicknessMm || 36;
      const pedH = Math.max(120, height - topT);
      const pedR = Math.round(Math.min(185, Math.max(95, depth * 0.21)));
      const arcFullMm = Math.round(2 * Math.PI * pedR * 10) / 10;
      const kerfPitch = 14;
      const kerfCnt = Math.max(12, Math.round(arcFullMm / kerfPitch));
      const pedCount = width >= 1450 ? 2 : 1;
      const topMat = module.carcass.countertopMaterialId || doorMaterialId || bodyMaterialId;

      capComponents.push({
        id: `${module.id}_capsule_table_top`,
        role: "countertop",
        label: `Kapsül Masa Üst Tablası (${width}×${depth}×${topT}mm, R=${Math.round(capR)}mm)`,
        dimensions: { width, height: topT, depth },
        position: { x: 0, y: pedH, z: 0 },
        materialId: topMat,
        isFrontFacing: true,
        isManufacturablePanel: true,
        thicknessAxis: "y",
        polygonContourMm: buildStadiumContour(width, depth),
      });

      for (let pi = 0; pi < pedCount; pi++) {
        const cx =
          pedCount === 1
            ? width / 2
            : pi === 0
            ? Math.max(pedR + 80, width * 0.27)
            : Math.min(width - pedR - 80, width * 0.73);
        capComponents.push({
          id: `${module.id}_kerf_pedestal_${pi + 1}`,
          role: "kerf_curve",
          label: `Silindirik Kapsül Sütun Ayak Kerf Açınımı #${pi + 1} (Ø${pedR * 2}mm)`,
          dimensions: { width: arcFullMm, height: pedH, depth: T },
          position: { x: cx - pedR, y: 0, z: depth / 2 - pedR },
          primitive: "cylinder",
          materialId: doorMaterialId || bodyMaterialId,
          isFrontFacing: true,
          isManufacturablePanel: true,
          thicknessAxis: "z",
          kerfBendingMeta: {
            outerRadiusMm: pedR,
            bendAngleDeg: 360,
            unfoldedArcLengthMm: arcFullMm,
            kerfCount: kerfCnt,
            kerfSpacingMm: Math.round((arcFullMm / kerfCnt) * 100) / 100,
            residualWebMm: 2.5,
          },
        });
      }

      const capTblRes: ModuleGeometryBreakdown = {
        moduleId: module.id,
        overall: module.dimensions,
        components: capComponents,
        bayWidths: [width],
        netInnerHeight: height,
        netInnerDepth: depth,
      };
      moduleGeometryCache.set(cacheKey, capTblRes);
      return capTblRes;
    }

    // hullShape === "capsule_stadium" (Curved Capsule Bar / Sideboard Cabinet — ZERO duplicate flat side panels!)
    const pH = plinthHeight || 0;
    const bodyBoxH = Math.max(180, height - pH);
    const innerClearH = Math.max(120, bodyBoxH - 2 * T);
    const semiArcMm = Math.round(Math.PI * capR * 10) / 10;
    const kerfSpacing = 14;
    const kerfCount = Math.max(8, Math.round(semiArcMm / kerfSpacing));
    const stadiumPoly = buildStadiumContour(width, depth);

    if (pH > 0) {
      const recess = 45;
      const plinthW = Math.max(160, width - 2 * recess);
      const plinthD = Math.max(140, depth - 2 * recess);
      capComponents.push({
        id: `${module.id}_capsule_plinth`,
        role: "plinth",
        label: `Kapsül Geri Çekmeli Baza Kasası (${plinthW}×${pH}mm)`,
        dimensions: { width: plinthW, height: pH, depth: T },
        position: { x: recess, y: 0, z: depth - recess - T },
        materialId: module.carcass.plinthMaterialId || doorMaterialId || bodyMaterialId,
        isFrontFacing: true,
        isManufacturablePanel: true,
        thicknessAxis: "z",
      });
    }

    // Stadium Bottom & Top CNC-Contoured Slabs
    capComponents.push(
      {
        id: `${module.id}_capsule_bottom`,
        role: "carcass_bottom",
        label: `Kapsül Stadyum Alt Tabla (${width}×${depth}mm, R=${Math.round(capR)}mm)`,
        dimensions: { width, height: T, depth },
        position: { x: 0, y: pH, z: 0 },
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        thicknessAxis: "y",
        polygonContourMm: stadiumPoly,
      },
      {
        id: `${module.id}_capsule_top`,
        role: "carcass_top",
        label: `Kapsül Stadyum Üst Tabla (${width}×${depth}mm, R=${Math.round(capR)}mm)`,
        dimensions: { width, height: T, depth },
        position: { x: 0, y: height - T, z: 0 },
        materialId: doorMaterialId || bodyMaterialId,
        isFrontFacing: true,
        isManufacturablePanel: true,
        thicknessAxis: "y",
        polygonContourMm: stadiumPoly,
      }
    );

    // Left & Right 180° Semi-Cylindrical CNC Kerf-Bent Shells (Replaces flat rectangular side panels!)
    [1, 2].forEach((ci) => {
      capComponents.push({
        id: `${module.id}_kerf_curve_${ci}`,
        role: "kerf_curve",
        label: `Kapsül Kavisli Yan Gövde Açınımı #${ci} (R=${Math.round(capR)}mm, Yay=${semiArcMm}mm, ${kerfCount} Kerf)`,
        dimensions: { width: semiArcMm, height: innerClearH, depth: T },
        position: { x: ci === 1 ? 0 : Math.max(0, width - capR), y: pH + T, z: 0 },
        materialId: doorMaterialId || bodyMaterialId,
        isFrontFacing: true,
        isManufacturablePanel: true,
        thicknessAxis: "z",
        kerfBendingMeta: {
          outerRadiusMm: Math.round(capR * 10) / 10,
          bendAngleDeg: 180,
          unfoldedArcLengthMm: semiArcMm,
          kerfCount,
          kerfSpacingMm: Math.round((semiArcMm / kerfCount) * 100) / 100,
          residualWebMm: 2.5,
        },
      });
    });

    // Two internal structural vertical bulkheads at tangent transitions (x = capR and x = width - capR)
    if (straightSpanW >= 120) {
      [capR, width - capR - T].forEach((bx, bi) => {
        capComponents.push({
          id: `${module.id}_capsule_bulkhead_${bi + 1}`,
          role: "carcass_divider",
          label: `Kapsül İç Taşıyıcı Dikme #${bi + 1}`,
          dimensions: { width: T, height: innerClearH, depth: Math.max(120, depth - 2 * T) },
          position: { x: bx, y: pH + T, z: T },
          materialId: bodyMaterialId,
          isManufacturablePanel: true,
          thicknessAxis: "x",
        });
      });

      // Rear flat center back panel between tangent bulkheads
      capComponents.push({
        id: `${module.id}_capsule_center_back`,
        role: "carcass_back",
        label: `Kapsül Orta Düz Arkalık (${Math.max(80, straightSpanW)}×${innerClearH}mm)`,
        dimensions: { width: Math.max(80, straightSpanW), height: innerClearH, depth: T },
        position: { x: capR, y: pH + T, z: 0 },
        materialId: doorMaterialId || bodyMaterialId,
        isManufacturablePanel: true,
        thicknessAxis: "z",
      });

      // Front tambour sliding flexible door panel covering straight front opening
      if (!module.isOpenFront) {
        capComponents.push({
          id: `${module.id}_capsule_tambour_front`,
          role: "door_left",
          label: `Kapsül Tambur Çıtalı Ön Sürgü Kapak (${Math.max(120, straightSpanW)}×${innerClearH - 4}mm)`,
          bayIndex: 0,
          dimensions: { width: Math.max(120, straightSpanW), height: Math.max(80, innerClearH - 4), depth: T },
          position: { x: capR, y: pH + T + 2, z: depth - T },
          materialId: doorMaterialId,
          isFrontFacing: true,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        });
      }
    }

    const capRes: ModuleGeometryBreakdown = {
      moduleId: module.id,
      overall: module.dimensions,
      components: capComponents,
      bayWidths: [Math.max(120, straightSpanW || width - 2 * T)],
      netInnerHeight: innerClearH,
      netInnerDepth: Math.max(120, depth - 2 * T),
    };
    moduleGeometryCache.set(cacheKey, capRes);
    return capRes;
  }

  // Handle complementary single-piece modules cleanly (Countertop, Backsplash, End Panel, Wall Filler, Leveling Feet, Wall Bracket)
  if (module.category === "complementary") {
    const cRole = module.complementaryRole || "end_panel";
    if (cRole === "attached_table") {
      const topT = module.attachedTableConfig?.topThicknessMm || 40;
      const legStyle = module.attachedTableConfig?.legStyle || "metal_u_frame";
      const topMat = module.carcass.countertopMaterialId || doorMaterialId || bodyMaterialId;
      const legH = Math.max(120, height - topT);
      const tblComps: ComponentGeometry[] = [
        {
          id: `${module.id}_table_top`,
          role: "countertop",
          label: `${module.name} Tablası (${width}×${depth}×${topT}mm)`,
          dimensions: { width, height: topT, depth },
          position: { x: 0, y: legH, z: 0 },
          materialId: topMat,
          isFrontFacing: true,
          isManufacturablePanel: true,
          thicknessAxis: "y",
        },
        {
          id: `${module.id}_cantilever_bracket`,
          role: "special_fitting",
          label: "Tezgâh / Ada Çelik Konsol Bağlantı Plakası",
          dimensions: { width: Math.min(240, width * 0.25), height: 14, depth: Math.max(180, depth * 0.56) },
          position: { x: 0, y: legH - 14, z: (depth - Math.max(180, depth * 0.56)) * 0.5 },
          materialId: "mat_handle_matte_black",
          isFrontFacing: false,
          isManufacturablePanel: false,
        },
      ];

      if (legStyle === "waterfall_slab") {
        const wfT = 40;
        tblComps.push({
          id: `${module.id}_waterfall_leg`,
          role: "countertop",
          label: `Masa Şelale Yan İniş Plakası (${legH}×${depth}×${wfT}mm)`,
          dimensions: { width: wfT, height: legH, depth },
          position: { x: Math.max(0, width - wfT), y: 0, z: 0 },
          materialId: topMat,
          isFrontFacing: true,
          isManufacturablePanel: true,
          thicknessAxis: "x",
        });
      } else if (legStyle === "pedestal_column") {
        const colDiam = Math.min(180, Math.max(110, Math.round(depth * 0.22)));
        tblComps.push({
          id: `${module.id}_pedestal_col`,
          role: "special_fitting",
          label: "Heykelsi Silindirik Masa Sütun Ayağı",
          dimensions: { width: colDiam, height: legH, depth: colDiam },
          position: { x: Math.max(120, width - 260 - colDiam * 0.5), y: 0, z: (depth - colDiam) * 0.5 },
          primitive: "cylinder",
          materialId: "mat_handle_matte_black",
          isFrontFacing: true,
          isManufacturablePanel: false,
        });
      } else {
        const barW = 50;
        const barThick = 24;
        const insetZ = 45;
        const spanZ = Math.max(160, depth - insetZ * 2);
        const legX = Math.max(80, width - 110);
        tblComps.push(
          {
            id: `${module.id}_uframe_front`,
            role: "special_fitting",
            label: "Mimari U-Profil Ön Dikme Ayak",
            dimensions: { width: barW, height: legH, depth: barThick },
            position: { x: legX, y: 0, z: depth - insetZ - barThick },
            materialId: "mat_handle_matte_black",
            isManufacturablePanel: false,
          },
          {
            id: `${module.id}_uframe_rear`,
            role: "special_fitting",
            label: "Mimari U-Profil Arka Dikme Ayak",
            dimensions: { width: barW, height: legH, depth: barThick },
            position: { x: legX, y: 0, z: insetZ },
            materialId: "mat_handle_matte_black",
            isManufacturablePanel: false,
          },
          {
            id: `${module.id}_uframe_bottom_runner`,
            role: "special_fitting",
            label: "Mimari U-Profil Alt Kayıt",
            dimensions: { width: barW, height: 18, depth: spanZ },
            position: { x: legX, y: 0, z: insetZ },
            materialId: "mat_handle_matte_black",
            isManufacturablePanel: false,
          }
        );
      }

      if (module.componentMaterialOverrides) {
        tblComps.forEach((c) => {
          const ov = module.componentMaterialOverrides?.[c.id];
          if (ov) c.materialId = ov;
        });
      }
      const tblRes: ModuleGeometryBreakdown = {
        moduleId: module.id,
        overall: module.dimensions,
        components: tblComps,
        bayWidths: [width],
        netInnerHeight: height,
        netInnerDepth: depth,
      };
      moduleGeometryCache.set(cacheKey, tblRes);
      return tblRes;
    }
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
    const effCornerPlinthType =
      module.carcass.plinthConstruction ||
      (module.carcass.hasAdjustableLegs === false
        ? isWardrobe
          ? "gable_rails"
          : "pedestal_box"
        : isWardrobe
        ? "pedestal_box"
        : "adjustable_legs_clip");
    const cornerSideRunsToFloor = plinthHeight > 0 && effCornerPlinthType === "gable_rails";
    const sideY = cornerSideRunsToFloor ? 0 : plinthHeight;
    const sideH = cornerSideRunsToFloor ? height : height - plinthHeight;
    const netH = Math.max(120, height - plinthHeight - 2 * T);

    // 1. World-Standard L-Corner Plinth (Seamless 90° Mitered/Connector Inner Corner + Bottom PVC Seal + Axilo Legs)
    if (plinthHeight > 0) {
      const lSetback = Math.max(
        18,
        Math.min(
          75,
          module.carcass.plinthSetbackMm ??
            (effCornerPlinthType === "adjustable_legs_clip" ? 55 : 35)
        )
      );
      const lSealH = plinthHeight >= 75 ? 3.5 : 0;
      const lBoardH = plinthHeight - lSealH;
      const lPlinthMat =
        module.carcass.plinthMaterialId ||
        (effCornerPlinthType === "adjustable_legs_clip"
          ? doorMaterialId || bodyMaterialId
          : bodyMaterialId);
      const cornerJuncX = wingD - lSetback - T;
      const cornerJuncZ = wingD - lSetback - T;
      const spanXArm = Math.max(80, width - cornerJuncX - (cornerSideRunsToFloor ? T : 3));
      const spanZArm = Math.max(80, depth - (cornerJuncZ + T) - (cornerSideRunsToFloor ? T : 3));

      if (effCornerPlinthType === "adjustable_legs_clip") {
        const lLegCoords = [
          { id: "fl_back", x: 56, z: 56 },
          { id: "fr_back", x: width - 56, z: 56 },
          { id: "fr_front", x: width - 56, z: Math.max(70, cornerJuncZ - 32) },
          { id: "inner_corner", x: Math.max(70, cornerJuncX - 32), z: Math.max(70, cornerJuncZ - 32) },
          { id: "ret_left", x: 56, z: depth - 56 },
          { id: "ret_right", x: Math.max(70, cornerJuncX - 32), z: depth - 56 },
        ];
        lLegCoords.forEach((lc, lIdx) => {
          components.push({
            id: `${module.id}_plastic_leg_${lc.id}_${lIdx + 1}`,
            role: "special_fitting",
            label: `Häfele Axilo 78 Ayarlı Baza Ayağı #${lIdx + 1}`,
            dimensions: { width: 64, height: plinthHeight, depth: 64 },
            position: { x: lc.x - 32, y: 0, z: lc.z - 32 },
            materialId: "mat_anodized_metal",
            isManufacturablePanel: false,
          });
        });
      }

      components.push(
        {
          id: `${module.id}_plinth_front_x`,
          role: "plinth",
          label: `L-Köşe Ön Baza Bandı X Kolu (Girinti:${lSetback}mm)`,
          dimensions: { width: spanXArm, height: lBoardH, depth: T },
          position: { x: cornerJuncX, y: lSealH, z: cornerJuncZ },
          materialId: lPlinthMat,
          isFrontFacing: true,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        },
        {
          id: `${module.id}_plinth_front_z`,
          role: "plinth",
          label: `L-Köşe Dönüş Baza Bandı Z Kolu (Girinti:${lSetback}mm)`,
          dimensions: { width: T, height: lBoardH, depth: spanZArm },
          position: { x: cornerJuncX, y: lSealH, z: cornerJuncZ + T },
          materialId: lPlinthMat,
          isFrontFacing: true,
          isManufacturablePanel: true,
          thicknessAxis: "x",
        },
        {
          id: `${module.id}_plinth_corner_90`,
          role: "special_fitting",
          label: "90° İç Köşe Baza Birleşim Profili",
          dimensions: { width: 22, height: plinthHeight, depth: 22 },
          position: { x: cornerJuncX - 2, y: 0, z: cornerJuncZ - 2 },
          materialId: "mat_anodized_metal",
          isManufacturablePanel: false,
        }
      );
      if (lSealH > 0) {
        components.push(
          {
            id: `${module.id}_plinth_seal_lx`,
            role: "special_fitting",
            label: "Baza Altı PVC Nem & Su Sızdırmazlık Fitili (X)",
            dimensions: { width: spanXArm, height: lSealH, depth: T + 3 },
            position: { x: cornerJuncX, y: 0, z: cornerJuncZ - 1.5 },
            materialId: "mat_anodized_metal",
            isManufacturablePanel: false,
          },
          {
            id: `${module.id}_plinth_seal_lz`,
            role: "special_fitting",
            label: "Baza Altı PVC Nem & Su Sızdırmazlık Fitili (Z)",
            dimensions: { width: T + 3, height: lSealH, depth: spanZArm },
            position: { x: cornerJuncX - 1.5, y: 0, z: cornerJuncZ + T },
            materialId: "mat_anodized_metal",
            isManufacturablePanel: false,
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

  // 1. WORLD-STANDARD ARCHITECTURAL PLINTH & TOE-KICK SYSTEMS (3 Authentic Constructions):
  //    A) "pedestal_box"         — Independent 4-sided leveled structural box frame + divider load ribs + bottom PVC seal (Wardrobe/Living standard, 35mm setback)
  //    B) "adjustable_legs_clip" — DIN 68935 / Häfele Axilo 78 legs + C-clips + front & side clip-on plinths + PVC water seal (Kitchen/Bath standard, 55mm setback)
  //    C) "gable_rails"          — Full-height side panels to floor + front & rear structural rails + divider load ribs + bottom PVC seal (Built-in standard, 26mm setback)
  const effPlinthType =
    module.carcass.plinthConstruction ||
    (module.carcass.hasAdjustableLegs === false
      ? isWardrobe
        ? "gable_rails"
        : "pedestal_box"
      : isWardrobe
      ? "pedestal_box"
      : "adjustable_legs_clip");

  const defaultPlinthSetback =
    effPlinthType === "adjustable_legs_clip"
      ? 55
      : effPlinthType === "pedestal_box"
      ? 35
      : 26;
  const plinthFrontSetback = Math.max(
    15,
    Math.min(
      Math.max(30, depth - 130),
      module.carcass.plinthSetbackMm ?? defaultPlinthSetback
    )
  );

  // Compute X positions of all intermediate bay dividers so structural plinth ribs or legs sit directly under every divider!
  const dividerStartXs: number[] = [];
  {
    let accX = T;
    for (let bI = 0; bI < module.bays.length - 1; bI++) {
      accX += bayWidths[bI] || 0;
      dividerStartXs.push(accX);
      accX += T;
    }
    if (dividerStartXs.length === 0 && width >= 950) {
      dividerStartXs.push(Math.round((width - T) / 2));
    }
  }

  if (plinthHeight > 0) {
    const baseExpY = explodeY > 0 ? -explodeY : 0;
    const sealH = plinthHeight >= 75 ? 3.5 : 0; // Co-extruded bottom PVC moisture & dust seal lip (keeps board cut >= 71.5mm!)
    const boardH = plinthHeight - sealH;
    const frontPlinthZ = Math.max(60, depth - plinthFrontSetback - T);
    const rearRailZ = 20; // 20mm rear wall skirting / cable clearance
    const plinthMatId =
      module.carcass.plinthMaterialId ||
      (effPlinthType === "adjustable_legs_clip"
        ? doorMaterialId || bodyMaterialId
        : bodyMaterialId);

    if (effPlinthType === "pedestal_box") {
      // A. INDEPENDENT 4-SIDED LEVELED STRUCTURAL BOX PLINTH (İtalyan Modüler Gardırop Standardı)
      const sideReveal = 3; // Crisp 3mm architectural shadow reveal on exposed ends
      const boxW = Math.max(120, width - 2 * sideReveal);
      const sideReturnDepth = Math.max(70, frontPlinthZ - rearRailZ);
      const ribDepth = Math.max(70, frontPlinthZ - (rearRailZ + T));

      components.push(
        {
          id: `${module.id}_plinth_front`,
          role: "plinth",
          label: `Kutu Baza Ön Bandı (H:${plinthHeight}mm, Girinti:${plinthFrontSetback}mm)`,
          dimensions: { width: boxW, height: boardH, depth: T },
          position: { x: sideReveal, y: baseExpY + sealH, z: frontPlinthZ + explodeZ * 0.45 },
          materialId: plinthMatId,
          isFrontFacing: true,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        },
        {
          id: `${module.id}_plinth_rear`,
          role: "plinth",
          label: `Kutu Baza Arka Taşıyıcı Kayıt`,
          dimensions: { width: Math.max(70, boxW - 2 * T), height: boardH, depth: T },
          position: { x: sideReveal + T, y: baseExpY + sealH, z: rearRailZ - explodeZ * 0.35 },
          materialId: bodyMaterialId,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        },
        {
          id: `${module.id}_plinth_side_left`,
          role: "plinth",
          label: `Kutu Baza Sol Dönüş Bandı`,
          dimensions: { width: T, height: boardH, depth: sideReturnDepth },
          position: { x: sideReveal - explodeX * 0.45, y: baseExpY + sealH, z: rearRailZ },
          materialId: plinthMatId,
          isManufacturablePanel: true,
          thicknessAxis: "x",
        },
        {
          id: `${module.id}_plinth_side_right`,
          role: "plinth",
          label: `Kutu Baza Sağ Dönüş Bandı`,
          dimensions: { width: T, height: boardH, depth: sideReturnDepth },
          position: {
            x: width - sideReveal - T + explodeX * 0.45,
            y: baseExpY + sealH,
            z: rearRailZ,
          },
          materialId: plinthMatId,
          isManufacturablePanel: true,
          thicknessAxis: "x",
        }
      );

      // Structural transverse load-bearing ribs directly beneath every vertical divider (zero bottom-panel sag!)
      dividerStartXs.forEach((divX, rIdx) => {
        if (ribDepth >= 70) {
          components.push({
            id: `${module.id}_plinth_rib_${rIdx + 1}`,
            role: "plinth",
            label: `Baza Ara Taşıyıcı Kayıt #${rIdx + 1}`,
            dimensions: { width: T, height: boardH, depth: ribDepth },
            position: { x: divX, y: baseExpY + sealH, z: rearRailZ + T },
            materialId: bodyMaterialId,
            isManufacturablePanel: true,
            thicknessAxis: "x",
          });
        }
      });

      // Bottom PVC Moisture & Dust Seal Gaskets on Front & Sides
      if (sealH > 0) {
        components.push(
          {
            id: `${module.id}_plinth_seal_front`,
            role: "special_fitting",
            label: "Baza Altı PVC Nem & Toz Sızdırmazlık Fitili (Ön)",
            dimensions: { width: boxW, height: sealH, depth: T + 3 },
            position: { x: sideReveal, y: baseExpY, z: frontPlinthZ - 1.5 + explodeZ * 0.45 },
            materialId: "mat_anodized_metal",
            isManufacturablePanel: false,
          },
          {
            id: `${module.id}_plinth_seal_left`,
            role: "special_fitting",
            label: "Baza Altı PVC Nem & Toz Fitili (Sol Yan)",
            dimensions: { width: T + 2, height: sealH, depth: sideReturnDepth },
            position: { x: sideReveal - 1 - explodeX * 0.45, y: baseExpY, z: rearRailZ },
            materialId: "mat_anodized_metal",
            isManufacturablePanel: false,
          },
          {
            id: `${module.id}_plinth_seal_right`,
            role: "special_fitting",
            label: "Baza Altı PVC Nem & Toz Fitili (Sağ Yan)",
            dimensions: { width: T + 2, height: sealH, depth: sideReturnDepth },
            position: {
              x: width - sideReveal - T - 1 + explodeX * 0.45,
              y: baseExpY,
              z: rearRailZ,
            },
            materialId: "mat_anodized_metal",
            isManufacturablePanel: false,
          }
        );
      }

      // Concealed Internal M10 Steel Leveling Glides (Terazi Pingoları) inside corners & under divider ribs
      const glideXs = [sideReveal + T + 18, ...dividerStartXs.map((dx) => dx + T / 2), width - sideReveal - T - 18];
      const glideZs = [rearRailZ + T + 24, Math.max(rearRailZ + T + 60, frontPlinthZ - 26)];
      let gCounter = 1;
      for (const gx of glideXs) {
        for (const gz of glideZs) {
          components.push({
            id: `${module.id}_plinth_glide_${gCounter++}`,
            role: "special_fitting",
            label: `Gizli Çelik Baza Terazi Pingosu M10`,
            dimensions: { width: 32, height: Math.min(28, plinthHeight - 8), depth: 32 },
            position: { x: gx - 16, y: baseExpY, z: gz - 16 },
            materialId: "mat_metal_chrome",
            isManufacturablePanel: false,
          });
        }
      }
    } else if (effPlinthType === "adjustable_legs_clip") {
      // B. DIN 68935 / HÄFELE AXILO 78 ADJUSTABLE LEGS + SNAP-ON C-CLIPS + FRONT/SIDE CLIP-ON PLINTH + WATER SEAL
      const sideReturnInset = 8; // Side return sits cleanly at x=8..26, enclosing legs completely!
      const legOuterOffset = Math.max(58, sideReturnInset + T + 34);
      const legXs = [
        legOuterOffset,
        ...dividerStartXs.map((dx) => dx + Math.round(T / 2)),
        Math.max(legOuterOffset + 40, width - legOuterOffset),
      ];
      const frontLegZ = Math.max(88, frontPlinthZ - 32);
      const rearLegZ = 56;
      const legZs = [rearLegZ, frontLegZ];

      let legCounter = 1;
      for (const lx of legXs) {
        for (const lz of legZs) {
          components.push({
            id: `${module.id}_plastic_leg_${legCounter}`,
            role: "special_fitting",
            label: `Häfele Axilo 78 Ayarlanabilir Baza Ayağı #${legCounter} (H:${plinthHeight}mm)`,
            dimensions: { width: 64, height: plinthHeight, depth: 64 },
            position: { x: lx - 32, y: baseExpY, z: lz - 32 },
            materialId: "mat_anodized_metal",
            isManufacturablePanel: false,
          });
          // Add 3D Snap-On Plinth C-Clip on every front-row leg latching onto the rear of _plinth_front!
          if (lz === frontLegZ) {
            components.push({
              id: `${module.id}_plinth_clip_${legCounter}`,
              role: "special_fitting",
              label: `Baza C-Klips Bağlantı Aparatı #${legCounter}`,
              dimensions: { width: 42, height: 30, depth: Math.max(24, frontPlinthZ - frontLegZ + 8) },
              position: {
                x: lx - 21,
                y: baseExpY + Math.round(plinthHeight * 0.45),
                z: frontLegZ - 4,
              },
              materialId: "mat_anodized_metal",
              isManufacturablePanel: false,
            });
          }
          legCounter++;
        }
      }

      // Clip-On Front Plinth Board + Side Return Panels so 3/4 views show a clean finished enclosed base!
      const sideRetDepth = Math.max(70, frontPlinthZ - rearRailZ);
      components.push(
        {
          id: `${module.id}_plinth_front`,
          role: "plinth",
          label: `Klipsli Ön Baza Bandı (H:${plinthHeight}mm, Girinti:${plinthFrontSetback}mm, Su Contalı)`,
          dimensions: { width, height: boardH, depth: T },
          position: { x: 0, y: baseExpY + sealH, z: frontPlinthZ + explodeZ * 0.55 },
          materialId: plinthMatId,
          isFrontFacing: true,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        },
        {
          id: `${module.id}_plinth_side_left`,
          role: "plinth",
          label: `Klipsli Sol Dönüş Baza Bandı`,
          dimensions: { width: T, height: boardH, depth: sideRetDepth },
          position: { x: sideReturnInset - explodeX * 0.5, y: baseExpY + sealH, z: rearRailZ },
          materialId: plinthMatId,
          isManufacturablePanel: true,
          thicknessAxis: "x",
        },
        {
          id: `${module.id}_plinth_side_right`,
          role: "plinth",
          label: `Klipsli Sağ Dönüş Baza Bandı`,
          dimensions: { width: T, height: boardH, depth: sideRetDepth },
          position: {
            x: width - sideReturnInset - T + explodeX * 0.5,
            y: baseExpY + sealH,
            z: rearRailZ,
          },
          materialId: plinthMatId,
          isManufacturablePanel: true,
          thicknessAxis: "x",
        }
      );

      if (sealH > 0) {
        components.push(
          {
            id: `${module.id}_plinth_seal_front`,
            role: "special_fitting",
            label: "Ko-Ekstrüze Baza Su Sızdırmazlık Contası (Ön)",
            dimensions: { width, height: sealH, depth: T + 3.5 },
            position: { x: 0, y: baseExpY, z: frontPlinthZ - 1.5 + explodeZ * 0.55 },
            materialId: "mat_anodized_metal",
            isManufacturablePanel: false,
          },
          {
            id: `${module.id}_plinth_seal_left`,
            role: "special_fitting",
            label: "Ko-Ekstrüze Baza Su Sızdırmazlık Contası (Sol Yan)",
            dimensions: { width: T + 2.5, height: sealH, depth: sideRetDepth },
            position: { x: sideReturnInset - 1.25 - explodeX * 0.5, y: baseExpY, z: rearRailZ },
            materialId: "mat_anodized_metal",
            isManufacturablePanel: false,
          },
          {
            id: `${module.id}_plinth_seal_right`,
            role: "special_fitting",
            label: "Ko-Ekstrüze Baza Su Sızdırmazlık Contası (Sağ Yan)",
            dimensions: { width: T + 2.5, height: sealH, depth: sideRetDepth },
            position: {
              x: width - sideReturnInset - T - 1.25 + explodeX * 0.5,
              y: baseExpY,
              z: rearRailZ,
            },
            materialId: "mat_anodized_metal",
            isManufacturablePanel: false,
          }
        );
      }
    } else {
      // C. "gable_rails" — FULL-HEIGHT SIDE PANELS TO FLOOR + DUAL FRONT/REAR STRUCTURAL RAILS + DIVIDER RIBS
      const ribDepth = Math.max(70, frontPlinthZ - (rearRailZ + T));
      components.push(
        {
          id: `${module.id}_plinth_front`,
          role: "plinth",
          label: `Gömme Ön Baza Kayıdı (H:${plinthHeight}mm, Girinti:${plinthFrontSetback}mm)`,
          dimensions: { width: innerSpanW, height: boardH, depth: T },
          position: { x: T, y: baseExpY + sealH, z: frontPlinthZ + explodeZ * 0.45 },
          materialId: plinthMatId,
          isFrontFacing: true,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        },
        {
          id: `${module.id}_plinth_rear`,
          role: "plinth",
          label: `Gömme Arka Baza Denge Kayıdı`,
          dimensions: { width: innerSpanW, height: boardH, depth: T },
          position: { x: T, y: baseExpY + sealH, z: rearRailZ - explodeZ * 0.35 },
          materialId: bodyMaterialId,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        }
      );

      dividerStartXs.forEach((divX, rIdx) => {
        if (ribDepth >= 70) {
          components.push({
            id: `${module.id}_plinth_rib_${rIdx + 1}`,
            role: "plinth",
            label: `Baza Ara Destek Kayıdı #${rIdx + 1}`,
            dimensions: { width: T, height: boardH, depth: ribDepth },
            position: { x: divX, y: baseExpY + sealH, z: rearRailZ + T },
            materialId: bodyMaterialId,
            isManufacturablePanel: true,
            thicknessAxis: "x",
          });
        }
      });

      if (sealH > 0) {
        components.push({
          id: `${module.id}_plinth_seal_front`,
          role: "special_fitting",
          label: "Baza Altı PVC Nem Fitili",
          dimensions: { width: innerSpanW, height: sealH, depth: T + 3 },
          position: { x: T, y: baseExpY, z: frontPlinthZ - 1.5 + explodeZ * 0.45 },
          materialId: "mat_anodized_metal",
          isManufacturablePanel: false,
        });
      }

      const glideXs = [T + 22, ...dividerStartXs.map((dx) => dx + T / 2), width - T - 22];
      let gCounter = 1;
      for (const gx of glideXs) {
        for (const gz of [rearRailZ + T + 24, Math.max(rearRailZ + T + 60, frontPlinthZ - 26)]) {
          components.push({
            id: `${module.id}_plinth_glide_${gCounter++}`,
            role: "special_fitting",
            label: `Gizli Dikme/Baza Terazi Pingosu M10`,
            dimensions: { width: 30, height: Math.min(26, plinthHeight - 8), depth: 30 },
            position: { x: gx - 15, y: baseExpY, z: gz - 15 },
            materialId: "mat_metal_chrome",
            isManufacturablePanel: false,
          });
        }
      }
    }
  }

  // Plinth Drawer Option (Checklist #18 / Section 5.2: Süpürgelik / Baza Çekmecesi)
  if (module.carcass.hasPlinthDrawer && plinthHeight >= 80) {
    const pDrawerW = Math.max(120, width - 2 * T - 26);
    const pDrawerD = Math.max(200, Math.min(450, depth - 90));
    components.push({
      id: `${module.id}_plinth_drawer_box`,
      role: "drawer_bottom",
      label: `Baza Gizli Çekmece Kasası (${pDrawerW}×${pDrawerD}mm)`,
      dimensions: { width: pDrawerW, height: Math.max(45, plinthHeight - 24), depth: pDrawerD },
      position: { x: T + 13, y: 12, z: depth - pDrawerD - 55 + drawerOpenMm * 0.6 },
      materialId: bodyMaterialId,
      isManufacturablePanel: true,
      thicknessAxis: "y",
    });
  }

  // 2 & 3. Left & Right Side Panels — Supports Tip A (sides_through), Tip B (top_bottom_through), Tip C (miter_45), Tip D (kitchen_stretchers)
  const joineryTopology =
    module.carcass.carcassJoineryTopology ||
    (module.category === "kitchen_base" || module.category === "kitchen_island"
      ? "kitchen_stretchers"
      : "sides_through");
  const sideRunsToFloor = plinthHeight > 0 && effPlinthType === "gable_rails" && joineryTopology !== "top_bottom_through";
  const sideH =
    joineryTopology === "top_bottom_through"
      ? Math.max(80, height - plinthHeight - 2 * T)
      : sideRunsToFloor
      ? height
      : height - plinthHeight;
  const sideY =
    joineryTopology === "top_bottom_through"
      ? plinthHeight + T
      : sideRunsToFloor
      ? 0
      : plinthHeight;

  // P1-05: Compute exact trapezoid/pentagon 2D CNC contour when slopedCeiling is active!
  const slopedCfg = module.carcass.slopedCeiling;
  const buildBackSlopeSideContour = (mirroredRight: boolean): [number, number][] | undefined => {
    if (!slopedCfg || slopedCfg.mode !== "back_slope") return undefined;
    const kneeRelH = Math.max(120, Math.min(sideH - 40, slopedCfg.kneeHeightMm - sideY));
    const radSlope = ((slopedCfg.slopeAngleDeg || 35) * Math.PI) / 180;
    const riseNeeded = sideH - kneeRelH;
    const runDepth = Math.min(depth - 40, Math.max(40, Math.round((riseNeeded / Math.max(0.2, Math.tan(radSlope))) * 100) / 100));
    // In CutPiece DXF space: X = depth (0..depth), Y = height (0..sideH)
    // Left side has front at x=0, rear at x=depth; mirrored right side has rear at x=0, front at x=depth
    if (!mirroredRight) {
      return [
        [0, 0],
        [depth, 0],
        [depth, kneeRelH],
        [Math.max(20, Math.round((depth - runDepth) * 100) / 100), sideH],
        [0, sideH],
      ];
    }
    return [
      [0, 0],
      [depth, 0],
      [depth, sideH],
      [Math.min(depth - 20, Math.round(runDepth * 100) / 100), sideH],
      [0, kneeRelH],
    ];
  };

  const leftSlopeH =
    slopedCfg?.mode === "left_slope"
      ? Math.max(160, Math.min(sideH, slopedCfg.kneeHeightMm - sideY))
      : sideH;
  const rightSlopeH =
    slopedCfg?.mode === "right_slope"
      ? Math.max(160, Math.min(sideH, slopedCfg.kneeHeightMm - sideY))
      : sideH;

  components.push({
    id: `${module.id}_side_left`,
    role: "carcass_side_left",
    label:
      slopedCfg && slopedCfg.mode !== "none"
        ? "Sol Yan Panel (Eğimli Tavan Kesimli)"
        : joineryTopology === "miter_45"
        ? "Sol Yan Panel (45° Gönye)"
        : "Sol Yan Panel",
    dimensions: { width: T, height: leftSlopeH, depth },
    position: { x: explodeX > 0 ? -explodeX : 0, y: sideY, z: 0 },
    materialId: bodyMaterialId,
    isManufacturablePanel: true,
    thicknessAxis: "x",
    polygonContourMm: buildBackSlopeSideContour(false),
  });

  components.push({
    id: `${module.id}_side_right`,
    role: "carcass_side_right",
    label:
      slopedCfg && slopedCfg.mode !== "none"
        ? "Sağ Yan Panel (Eğimli Tavan Kesimli)"
        : joineryTopology === "miter_45"
        ? "Sağ Yan Panel (45° Gönye)"
        : "Sağ Yan Panel",
    dimensions: { width: T, height: rightSlopeH, depth },
    position: { x: width - T + explodeX, y: sideY, z: 0 },
    materialId: bodyMaterialId,
    isManufacturablePanel: true,
    thicknessAxis: "x",
    polygonContourMm: buildBackSlopeSideContour(true),
  });

  // Applied Decorative End Panels (Checklist #19: D_carcass + T_door + 2mm covering front door reveal!)
  const T_door_ext = module.carcass.doorThickness || 18;
  const endPanelDepth = depth + T_door_ext + 2;
  if (module.carcass.appliedEndPanelLeft && module.carcass.appliedEndPanelLeft !== "none") {
    const epFloor = module.carcass.appliedEndPanelLeft === "floor_to_top";
    components.push({
      id: `${module.id}_applied_end_left`,
      role: "end_panel",
      label: epFloor ? "Sol Görünen Yan Panel (Zemine İnen, Cumba Örten)" : "Sol Görünen Yan Panel (Gövde Boyu, Cumba Örten)",
      dimensions: { width: T, height: epFloor ? height : height - plinthHeight, depth: endPanelDepth },
      position: { x: -T, y: epFloor ? 0 : plinthHeight, z: 0 },
      materialId: doorMaterialId,
      isFrontFacing: true,
      isManufacturablePanel: true,
      thicknessAxis: "x",
    });
  }
  if (module.carcass.appliedEndPanelRight && module.carcass.appliedEndPanelRight !== "none") {
    const epFloor = module.carcass.appliedEndPanelRight === "floor_to_top";
    components.push({
      id: `${module.id}_applied_end_right`,
      role: "end_panel",
      label: epFloor ? "Sağ Görünen Yan Panel (Zemine İnen, Cumba Örten)" : "Sağ Görünen Yan Panel (Gövde Boyu, Cumba Örten)",
      dimensions: { width: T, height: epFloor ? height : height - plinthHeight, depth: endPanelDepth },
      position: { x: width, y: epFloor ? 0 : plinthHeight, z: 0 },
      materialId: doorMaterialId,
      isFrontFacing: true,
      isManufacturablePanel: true,
      thicknessAxis: "x",
    });
  }

  // Island Decorative Back Cladding (MD Spec Section 7.3)
  if (module.category === "kitchen_island" || module.carcass.islandBackCladding) {
    components.push({
      id: `${module.id}_island_back_cladding`,
      role: "end_panel",
      label: "Ada Mutfak Dekoratif Arka Kapama Paneli",
      dimensions: { width, height, depth: T },
      position: { x: 0, y: 0, z: -T },
      materialId: doorMaterialId,
      isFrontFacing: true,
      isManufacturablePanel: true,
      thicknessAxis: "z",
    });
  }

  // 4. Bottom Panel (Tip B & Tip C run full outer width; Tip A & D sit between side panels)
  const horizPanelW =
    joineryTopology === "top_bottom_through" || joineryTopology === "miter_45" ? width : innerSpanW;
  const horizPanelX =
    joineryTopology === "top_bottom_through" || joineryTopology === "miter_45" ? 0 : T;
  components.push({
    id: `${module.id}_bottom`,
    role: "carcass_bottom",
    label: joineryTopology === "miter_45" ? "Alt Panel (45° Gönye)" : "Alt Panel",
    dimensions: { width: horizPanelW, height: T, depth },
    position: { x: horizPanelX, y: plinthHeight - explodeY * 0.5, z: 0 },
    materialId: bodyMaterialId,
    isManufacturablePanel: true,
    thicknessAxis: "y",
  });

  // 5. Top Construction: Tip D Kitchen Base Stretchers (Checklist #10!) vs Full Top Panel
  const isSinkMod = isSinkModule(module);
  const isCooktopMod = isCooktopModule(module);
  if (joineryTopology === "kitchen_stretchers") {
    const stretcherW = 90; // Standard 90mm rail width (80-100mm per MD Spec Section 3.1 Tip D)
    const stretcherMode =
      module.carcass.kitchenTopStretcherMode ||
      (isSinkMod
        ? "vertical_sink"
        : isCooktopMod && width >= 900
        ? "aluminum_reinforced"
        : "horizontal");

    if (stretcherMode === "vertical_sink") {
      // Vertical Front Apron Stretcher (Ön Dikey Alın Kaydı) for sink bowl & mixer tap clearance; rear rail omitted for plumbing!
      components.push({
        id: `${module.id}_top_stretcher_front_vert`,
        role: "carcass_top",
        label: "Eviye Altı Dikey Ön Alın Kaydı (90mm)",
        dimensions: { width: innerSpanW, height: stretcherW, depth: T },
        position: { x: T, y: height - stretcherW + explodeY, z: depth - T },
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        thicknessAxis: "z",
      });
    } else if (stretcherMode === "aluminum_reinforced") {
      // Extruded Aluminum Structural Front Rail for wide (900-1200mm) cooktop cabinets + wooden rear stretcher
      components.push(
        {
          id: `${module.id}_top_stretcher_front_alu`,
          role: "special_fitting",
          label: "Ocak Altı Alüminyum Mukavemet Ön Kaydı (Isı & Sehim Korumalı)",
          dimensions: { width: innerSpanW, height: 35, depth: 35 },
          position: { x: T, y: height - 35 + explodeY, z: depth - 35 },
          materialId: "mat_anodized_metal",
          isManufacturablePanel: false,
        },
        {
          id: `${module.id}_top_stretcher_rear`,
          role: "carcass_top",
          label: "Üst Arka Bağlantı Kaydı (90mm)",
          dimensions: { width: innerSpanW, height: T, depth: stretcherW },
          position: { x: T, y: height - T + explodeY, z: 26 },
          materialId: bodyMaterialId,
          isManufacturablePanel: true,
          thicknessAxis: "y",
        }
      );
    } else {
      // Standard Horizontal Front & Rear Top Stretchers (90mm)
      components.push(
        {
          id: `${module.id}_top_stretcher_front`,
          role: "carcass_top",
          label: "Üst Ön Kayıt (90mm)",
          dimensions: { width: innerSpanW, height: T, depth: stretcherW },
          position: { x: T, y: height - T + explodeY, z: depth - stretcherW },
          materialId: bodyMaterialId,
          isManufacturablePanel: true,
          thicknessAxis: "y",
        },
        {
          id: `${module.id}_top_stretcher_rear`,
          role: "carcass_top",
          label: "Üst Arka Kayıt (90mm)",
          dimensions: { width: innerSpanW, height: T, depth: stretcherW },
          position: { x: T, y: height - T + explodeY, z: 26 },
          materialId: bodyMaterialId,
          isManufacturablePanel: true,
          thicknessAxis: "y",
        }
      );
    }
  } else {
    components.push({
      id: `${module.id}_top`,
      role: "carcass_top",
      label: joineryTopology === "miter_45" ? "Üst Panel (45° Gönye)" : "Üst Panel",
      dimensions: { width: horizPanelW, height: T, depth },
      position: { x: horizPanelX, y: height - T + explodeY, z: 0 },
      materialId: bodyMaterialId,
      isManufacturablePanel: true,
      thicknessAxis: "y",
    });
  }

  // 6. Back Panel — All 5 Modes Supported (Checklist #2: grooved, rebated, nailed, flush, none; auto-omitted on sink base!)
  const effBackType = isSinkMod && !module.carcass.backPanelType ? "none" : isSinkMod ? "none" : (module.carcass.backPanelType || "grooved");
  if (effBackType !== "none" && !module.isOpenFront) {
    if (effBackType === "nailed") {
      components.push({
        id: `${module.id}_back`,
        role: "carcass_back",
        label: `Arkadan Çakma Arkalık (${T_back}mm)`,
        dimensions: { width: Math.max(80, width - 2), height: Math.max(80, height - plinthHeight - 2), depth: T_back },
        position: { x: 1, y: plinthHeight + 1, z: -T_back - explodeZ * 0.8 },
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        thicknessAxis: "z",
      });
    } else if (effBackType === "rebated") {
      components.push({
        id: `${module.id}_back`,
        role: "carcass_back",
        label: `Lambalı Geçme Arkalık (${T_back}mm)`,
        dimensions: { width: innerSpanW + 20, height: netInnerH + 20, depth: T_back },
        position: { x: T - 10, y: plinthHeight + T - 10, z: 0 - explodeZ * 0.8 },
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        thicknessAxis: "z",
      });
    } else if (effBackType === "flush") {
      const flushT = Math.max(18, T_back);
      components.push({
        id: `${module.id}_back`,
        role: "carcass_back",
        label: `Tam Kalınlık Yapısal Arkalık (${flushT}mm)`,
        dimensions: { width: innerSpanW, height: netInnerH, depth: flushT },
        position: { x: T, y: plinthHeight + T, z: 0 - explodeZ * 0.8 },
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        thicknessAxis: "z",
      });
    } else {
      const dOffset = module.carcass.backOffsetMm ?? (isWardrobe ? 12 : 18);
      const backW = innerSpanW + 16;
      const backH = netInnerH + 16;
      components.push({
        id: `${module.id}_back`,
        role: "carcass_back",
        label: `Kanallı Arkalık (${T_back}mm, Offset:${dOffset}mm)`,
        dimensions: { width: backW, height: backH, depth: T_back },
        position: { x: T - 8, y: plinthHeight + T - 8, z: dOffset - explodeZ * 0.8 },
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        thicknessAxis: "z",
      });
    }
  }

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

  const isSinkBase = isSinkModule(module);
  const isCooktopBase = isCooktopModule(module);

  // Automatic 38mm Calacatta Quartz Countertop Slab (WITH TRUE 3D CSG/POLYGON APERTURE OVER SINK & COOKTOP!) + Waterfall Options
  const ctopThickness = isKitchenBaseOrCorner || module.category === "kitchen_island" ? 38 : 0;
  if (ctopThickness > 0) {
    const rearOverhang = module.carcass.islandOverhangRearMm ?? (module.category === "kitchen_island" ? 280 : 0);
    const ctopDepth = depth + 40 + rearOverhang; // +40mm front drip overhang (20mm door + 20mm drip)
    const ctopMatId = module.carcass.countertopMaterialId || "mat_neolith_calacatta_luxe";
    const holeW = isSinkBase
      ? Math.min(560, Math.max(320, width - 80))
      : isCooktopBase
      ? Math.min(580, Math.max(320, width - 80))
      : 0;
    const holeD = isSinkBase
      ? Math.min(460, Math.max(280, depth - 110))
      : isCooktopBase
      ? Math.min(500, Math.max(280, depth - 100))
      : 0;

    components.push({
      id: `${module.id}_auto_countertop`,
      role: "countertop",
      label: `Çimstone Calacatta Kuvars Tezgâh (38mm${holeW > 0 ? ", Boşaltmalı" : ""})`,
      dimensions: { width, height: ctopThickness, depth: ctopDepth },
      position: { x: 0, y: height, z: -rearOverhang },
      cutoutHole:
        holeW > 0
          ? {
              centerXMm: width / 2,
              centerZMm: rearOverhang + depth / 2 + 10,
              widthMm: holeW,
              depthMm: holeD,
            }
          : undefined,
      materialId: ctopMatId,
      isFrontFacing: true,
      isManufacturablePanel: false,
    });
    if (module.category !== "kitchen_island") {
      components.push({
        id: `${module.id}_auto_backsplash_strip`,
        role: "countertop",
        label: `Tezgâh Arka Süpürgelik Çıtası (45×18mm)`,
        dimensions: { width, height: 45, depth: 18 },
        position: { x: 0, y: height + ctopThickness, z: 0 },
        materialId: ctopMatId,
        isFrontFacing: true,
        isManufacturablePanel: false,
      });
    }
    if (module.carcass.hasWaterfallLeft) {
      components.push({
        id: `${module.id}_waterfall_left`,
        role: "countertop",
        label: "Sol Şelale Tezgâh Yan İnişi (45° Gönye, 38mm)",
        dimensions: { width: 38, height: height + ctopThickness, depth: ctopDepth },
        position: { x: -38, y: 0, z: -rearOverhang },
        materialId: ctopMatId,
        isFrontFacing: true,
        isManufacturablePanel: false,
      });
    }
    if (module.carcass.hasWaterfallRight) {
      components.push({
        id: `${module.id}_waterfall_right`,
        role: "countertop",
        label: "Sağ Şelale Tezgâh Yan İnişi (45° Gönye, 38mm)",
        dimensions: { width: 38, height: height + ctopThickness, depth: ctopDepth },
        position: { x: width, y: 0, z: -rearOverhang },
        materialId: ctopMatId,
        isFrontFacing: true,
        isManufacturablePanel: false,
      });
    }
  }
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

    // Shelves:
    // - Pocket door bay narrows internal shelf width by 75mm (Section 6.3)
    // - Oven/Fridge tower leaves mandatory 50mm rear ventilation chimney behind fixed/movable shelves (Checklist #13)
    // - Vertical LED channel enforces >=25mm front setback (Section 4.2)
    const isPocketBay = bay.door?.doorSystemId === "pocket_retractable" || bay.door?.type === "pocket";
    const pocketClearOffset = isPocketBay ? 75 : 0;
    const isApplianceChimneyMod = isBuiltInOvenOrFridgeTower(module);
    const rearChimneyMm = isApplianceChimneyMod ? 50 : 0;
    const shelfRearZ = (effBackType === "grooved" ? (module.carcass.backOffsetMm ?? (isWardrobe ? 12 : 18)) + T_back : effBackType === "none" || effBackType === "nailed" ? 0 : T_back) + rearChimneyMm;

    bay.shelves.forEach((shelf, sIdx) => {
      if (shelf.isHidden) return;
      const shelfT = shelf.thickness || T;
      const frontSetback = shelf.frontSetbackMm ?? (moduleHasVertLed ? 26 : shelf.isAdjustable ? 15 : 4);
      const effShelfD = Math.max(100, netInnerD - rearChimneyMm - frontSetback);
      const effShelfW = Math.max(80, bayW - pocketClearOffset - (shelf.isAdjustable ? 4 : 0));
      components.push({
        id: shelf.id || `${module.id}_bay_${bayIdx}_shelf_${sIdx}`,
        role: "shelf",
        label: `Raf B${bayIdx + 1}-${sIdx + 1} (${shelf.isAdjustable ? "Hareketli" : "Sabit"}${rearChimneyMm > 0 ? ", 50mm Baca Boşluklu" : ""})`,
        bayIndex: bayIdx,
        dimensions: { width: effShelfW, height: shelfT, depth: effShelfD },
        position: {
          x: bayStartX + pocketClearOffset + (shelf.isAdjustable ? 2 : 0),
          y: plinthHeight + T + Math.max(24, Math.min(Math.max(48, netInnerH - shelfT - 16), shelf.elevationY)),
          z: shelfRearZ,
        },
        materialId: shelf.isGlass ? "mat_smoked_glass" : bodyMaterialId,
        isManufacturablePanel: !shelf.isGlass,
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

    // Blum REVEGO / Pocket Retractable Door Internal Pocket Partition Wall (100mm pocket clearance!)
    if (
      !module.isOpenFront &&
      bay.door &&
      (bay.door.doorSystemId === "pocket_retractable" || bay.door.type === "pocket") &&
      bayW >= 320
    ) {
      const pocketClearW = 100;
      const isRightPocket = bay.door.type.includes("right");
      const pocketWallX = isRightPocket
        ? bayStartX + bayW - pocketClearW
        : bayStartX + pocketClearW - T;
      components.push({
        id: `${module.id}_bay_${bayIdx}_pocket_partition`,
        role: "carcass_sub_divider",
        label: `Cep Kapak (REVEGO) İç Cep Bölme Dikmesi (100mm Cep Boşluğu) B${bayIdx + 1}`,
        bayIndex: bayIdx,
        dimensions: { width: T, height: netInnerH, depth: Math.max(180, netInnerD - 6) },
        position: {
          x: pocketWallX,
          y: plinthHeight + T,
          z: T_back > 0 ? 18 : 6,
        },
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        thicknessAxis: "x",
      });
    }

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
      const boxSys =
        drawer.boxSystemType ||
        (hwId === "hw_hettich_avantech_m"
          ? "metal_box_avantech"
          : hwId.includes("legrabox")
          ? "metal_box_legrabox"
          : hwId.includes("tandembox")
          ? "metal_box_tandembox"
          : "wooden_undermount");
      const isAvanTech = boxSys === "metal_box_avantech";
      const isLegrabox = boxSys === "metal_box_legrabox";
      const isTandembox = boxSys === "metal_box_tandembox";
      const isMetalBoxSystem = isAvanTech || isLegrabox || isTandembox;
      const isBallBearingSide = boxSys === "ball_bearing_side";
      const isMovento = hwId.includes("movento") || boxSys === "wooden_undermount";

      // Internal drawer behind hinged door: add 25mm Spacer Block when spacer_block_25mm is chosen or non-155° hinge
      const needsInternalSpacer =
        Boolean(drawer.isInternal) &&
        bay.door?.type !== "open" &&
        module.carcass.internalDrawerHingeSolution === "spacer_block_25mm";
      const spacerLeftMm = needsInternalSpacer && (bay.door.type === "single_left" || bay.door.type === "double") ? 25 : 0;
      const spacerRightMm = needsInternalSpacer && (bay.door.type === "single_right" || bay.door.type === "double") ? 25 : 0;
      const effCellW = Math.max(100, bayW - spacerLeftMm - spacerRightMm);
      const effCellStartX = bayStartX + spacerLeftMm;

      if (spacerLeftMm > 0) {
        components.push({
          id: `${drawer.id}_spacer_left`,
          role: "carcass_sub_divider",
          label: `İç Çekmece Sol Menteşe Besleme Çıtası (25mm) B${bayIdx + 1}-${dIdx + 1}`,
          bayIndex: bayIdx,
          dimensions: { width: spacerLeftMm, height: Math.max(70, drawer.height - 8), depth: Math.min(480, netInnerD - 25) },
          position: { x: bayStartX, y: drawerY0 + 4, z: 24 },
          materialId: bodyMaterialId,
          isManufacturablePanel: true,
          thicknessAxis: "x",
        });
      }
      if (spacerRightMm > 0) {
        components.push({
          id: `${drawer.id}_spacer_right`,
          role: "carcass_sub_divider",
          label: `İç Çekmece Sağ Menteşe Besleme Çıtası (25mm) B${bayIdx + 1}-${dIdx + 1}`,
          bayIndex: bayIdx,
          dimensions: { width: spacerRightMm, height: Math.max(70, drawer.height - 8), depth: Math.min(480, netInnerD - 25) },
          position: { x: bayStartX + bayW - spacerRightMm, y: drawerY0 + 4, z: 24 },
          materialId: bodyMaterialId,
          isManufacturablePanel: true,
          thicknessAxis: "x",
        });
      }

      // Horizontal C-Gola gap between stacked external drawers (35mm finger recess vs 3mm standard fuga)
      const isGolaDrawer = isExtDrawer && bay.door?.handleCategory === "gola_profile";
      const effFrontH = isGolaDrawer && !isTopAtCabinetCeiling ? Math.max(40, frontH - 32) : frontH;
      const effFrontW = isExtDrawer ? frontW : Math.max(60, effCellW - 4);
      const effFrontX = isExtDrawer ? frontX : effCellStartX + 2;

      // P2-03: Consume canonical manufacturer drawerCuttingFormula directly by SKU & boxSystemType!
      const catalogCutFormula = resolveCanonicalDrawerCuttingFormula(drawer.hardwareProductId, boxSys);
      const lengthDeductionMm = catalogCutFormula.lengthDeductionMm;
      const bottomWidthDeductionMm = catalogCutFormula.bottomWidthDeductionMm;
      const backWidthDeductionMm = catalogCutFormula.backWidthDeductionMm;

      const maxBoxD = Math.max(120, frontZ - pulledZ - explodeZ - 24);
      const boxD = Math.min(
        maxBoxD,
        drawer.nominalLengthMm
          ? Math.min(netInnerD - 10, drawer.nominalLengthMm - lengthDeductionMm)
          : Math.min(500, Math.max(260, netInnerD - 34))
      );
      const profileCode = drawer.boxSideProfileCode || (drawer.height >= 220 ? "C" : drawer.height >= 150 ? "K" : "M");
      const metalBackProfileH =
        profileCode === "F" ? 181 : profileCode === "C" ? 116 : profileCode === "K" ? 69 : 39;
      const boxH = isMetalBoxSystem
        ? Math.min(metalBackProfileH, Math.max(39, drawer.height - 32))
        : Math.max(70, Math.min(220, drawer.height - (isGolaDrawer ? 48 : 38)));
      const boxT = isMetalBoxSystem ? 13 : 16;
      const bottomT = isMetalBoxSystem ? 16 : 8;
      const sideClearance = isTandembox
        ? 21.5
        : isLegrabox
        ? 19
        : isAvanTech
        ? 12
        : isBallBearingSide
        ? 13
        : 21;
      const boxX0 = effCellStartX + sideClearance;
      const boxW = Math.max(100, effCellW - 2 * sideClearance);
      const bottomBoardW = Math.max(68, effCellW - bottomWidthDeductionMm);
      const backBoardW = Math.max(68, effCellW - backWidthDeductionMm);
      const boxZ0 = frontZ - boxD;
      const hasSiphonCut = Boolean(drawer.hasSiphonCutout || isSinkBase);
      const siphonSpec = hasSiphonCut
        ? {
            widthMm: drawer.siphonCutoutWidthMm || Math.min(220, Math.round(bottomBoardW * 0.35)),
            depthMm: drawer.siphonCutoutDepthMm || Math.min(220, Math.round(boxD * 0.45)),
          }
        : undefined;

      // 1. Front Panel
      components.push({
        id: `${drawer.id}_front`,
        role: "drawer_front",
        label: `Çekmece Önü B${bayIdx + 1}-${dIdx + 1}${drawer.isInternal ? " (İç)" : ""}`,
        bayIndex: bayIdx,
        dimensions: { width: effFrontW, height: effFrontH, depth: T },
        position: {
          x: effFrontX,
          y: frontY,
          z: frontZ,
        },
        materialId: drawer.frontMaterialId || doorMaterialId,
        isFrontFacing: true,
        isManufacturablePanel: true,
        thicknessAxis: "z",
      });

      // 3 & 4. Left & Right Side Panels of Box (Metal Box Systems -> NON-manufacturable anodized steel!)
      components.push({
        id: `${drawer.id}_side_left`,
        role: "drawer_side_left",
        label: isMetalBoxSystem
          ? `Metal Çekmece Sol Yanak (${profileCode}) B${bayIdx + 1}-${dIdx + 1}`
          : `Çekmece Sol Ahşap Kasa B${bayIdx + 1}-${dIdx + 1}`,
        bayIndex: bayIdx,
        dimensions: { width: boxT, height: boxH, depth: boxD },
        position: { x: boxX0, y: drawerY0 + 8, z: boxZ0 },
        materialId: isMetalBoxSystem ? "mat_anodized_metal" : bodyMaterialId,
        isManufacturablePanel: !isMetalBoxSystem,
        thicknessAxis: "x",
      });

      components.push({
        id: `${drawer.id}_side_right`,
        role: "drawer_side_right",
        label: isMetalBoxSystem
          ? `Metal Çekmece Sağ Yanak (${profileCode}) B${bayIdx + 1}-${dIdx + 1}`
          : `Çekmece Sağ Ahşap Kasa B${bayIdx + 1}-${dIdx + 1}`,
        bayIndex: bayIdx,
        dimensions: { width: boxT, height: boxH, depth: boxD },
        position: { x: boxX0 + boxW - boxT, y: drawerY0 + 8, z: boxZ0 },
        materialId: isMetalBoxSystem ? "mat_anodized_metal" : bodyMaterialId,
        isManufacturablePanel: !isMetalBoxSystem,
        thicknessAxis: "x",
      });

      // 5. Back Panel of Box (16mm wooden back for both metal-box & wooden systems)
      components.push({
        id: `${drawer.id}_back`,
        role: "drawer_back",
        label: `Çekmece Arka Sırt B${bayIdx + 1}-${dIdx + 1}${hasSiphonCut ? " (U-Sifon Kesimli)" : ""}`,
        bayIndex: bayIdx,
        dimensions: { width: backBoardW, height: boxH, depth: 16 },
        position: { x: effCellStartX + (effCellW - backBoardW) / 2, y: drawerY0 + 8, z: boxZ0 },
        siphonCutout: siphonSpec,
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        thicknessAxis: "z",
      });

      // 6. Bottom Floor Board of Box (16mm on metal box systems; 8mm grooved 13mm above side bottom & +6mm into front groove on wooden systems)
      components.push({
        id: `${drawer.id}_bottom`,
        role: "drawer_bottom",
        label: `Çekmece Tabanı (${bottomT}mm${isMetalBoxSystem ? "" : ", Kanala Geçmeli"}) B${bayIdx + 1}-${dIdx + 1}${hasSiphonCut ? " (U-Sifon Boşluklu)" : ""}`,
        bayIndex: bayIdx,
        dimensions: { width: bottomBoardW, height: bottomT, depth: isMetalBoxSystem ? boxD : boxD - 10 },
        position: { x: effCellStartX + (effCellW - bottomBoardW) / 2, y: drawerY0 + 8 + (isMetalBoxSystem ? 0 : 13), z: boxZ0 + (isMetalBoxSystem ? 0 : 16) },
        siphonCutout: siphonSpec,
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
            slidingMountingType: mountKind,
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
            slidingMountingType: mountKind,
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
    if (front.id.includes("_lift_bifold_top") || front.label.includes("Katlanır Kalkar Üst Kanat")) {
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
        crossSectionProfile: bay.door.crossSectionProfile || module.carcass.crossSectionProfile,
        openingTechnology: bay.door.openingTechnology,
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

  if (module.category === "kitchen_island" && module.islandCountertopConfig) {
    const ic = module.islandCountertopConfig;
    const topThick = 40;
    const wfT = 40;
    const overhangRear = Math.max(0, ic.barOverhangMm ?? 240);
    const overhangFront = 20;
    const wfL = ic.waterfallLeft !== false;
    const wfR = ic.waterfallRight !== false;
    const topMat = ic.countertopMaterialId || module.carcass.countertopMaterialId || "mat_quartz_calacatta";
    const totalTopW = width + (wfL ? wfT : 20) + (wfR ? wfT : 20);
    const topStartX = wfL ? -wfT : -20;
    const totalTopD = depth + overhangRear + overhangFront;

    components.push({
      id: `${module.id}_island_countertop`,
      role: "countertop",
      label: `Ada Mutfak Tezgâh Tablası (${totalTopW}×${totalTopD}×${topThick}mm)`,
      dimensions: { width: totalTopW, height: topThick, depth: totalTopD },
      position: { x: topStartX, y: height, z: -overhangRear },
      materialId: topMat,
      isFrontFacing: true,
      isManufacturablePanel: true,
      thicknessAxis: "y",
    });

    if (wfL) {
      components.push({
        id: `${module.id}_island_waterfall_left`,
        role: "countertop",
        label: `Ada Sol Şelale Taş İniş Paneli (${height}×${totalTopD}mm)`,
        dimensions: { width: wfT, height, depth: totalTopD },
        position: { x: -wfT, y: 0, z: -overhangRear },
        materialId: topMat,
        isFrontFacing: true,
        isManufacturablePanel: true,
        thicknessAxis: "x",
      });
    }
    if (wfR) {
      components.push({
        id: `${module.id}_island_waterfall_right`,
        role: "countertop",
        label: `Ada Sağ Şelale Taş İniş Paneli (${height}×${totalTopD}mm)`,
        dimensions: { width: wfT, height, depth: totalTopD },
        position: { x: width, y: 0, z: -overhangRear },
        materialId: topMat,
        isFrontFacing: true,
        isManufacturablePanel: true,
        thicknessAxis: "x",
      });
    }
    components.push({
      id: `${module.id}_island_rear_cladding`,
      role: "end_panel",
      label: `Ada Mutfak Arka Kaplama Paneli (${width}×${height - plinthHeight}mm)`,
      dimensions: { width, height: Math.max(120, height - plinthHeight), depth: T },
      position: { x: 0, y: plinthHeight, z: -T },
      materialId: doorMaterialId || bodyMaterialId,
      isFrontFacing: false,
      isManufacturablePanel: true,
      thicknessAxis: "z",
    });
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
  // P1-03: Expand any door leaf configured with `doorFrameConstruction === "five_piece_rail_stile"`
  // into true 5-piece joinery parts (2 vertical stiles + 2 horizontal tenoned rails + 1 8mm center panel)
  const finalComponents: ComponentGeometry[] = [];
  for (const comp of components) {
    if (
      (comp.role === "door_left" || comp.role === "door_right") &&
      comp.bayIndex !== undefined &&
      module.bays[comp.bayIndex]?.door?.doorFrameConstruction === "five_piece_rail_stile" &&
      comp.dimensions.width >= 240 &&
      comp.dimensions.height >= 240
    ) {
      const stileW = 70;
      const tenonMm = 12;
      const grooveDepthMm = 8;
      const leafW = comp.dimensions.width;
      const leafH = comp.dimensions.height;
      const leafT = comp.dimensions.depth;
      const railCutLength = Math.max(60, leafW - 2 * stileW + 2 * tenonMm);
      const centerW = Math.max(60, leafW - 2 * stileW + 2 * grooveDepthMm);
      const centerH = Math.max(60, leafH - 2 * stileW + 2 * grooveDepthMm);

      // Keep main leaf as non-manufacturable kinematic assembly carrier for hinges/handles, and emit 5 manufacturable frame parts!
      finalComponents.push({
        ...comp,
        isManufacturablePanel: false,
        label: `${comp.label} (5-Parça Çerçeve Montaj Grubu)`,
      });
      finalComponents.push(
        {
          id: `${comp.id}_stile_left`,
          role: "door_stile_left",
          label: `${comp.label} — Sol Dik Seren (${leafH}×${stileW}mm)`,
          bayIndex: comp.bayIndex,
          dimensions: { width: stileW, height: leafH, depth: leafT },
          position: { ...comp.position },
          materialId: comp.materialId,
          isFrontFacing: true,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        },
        {
          id: `${comp.id}_stile_right`,
          role: "door_stile_right",
          label: `${comp.label} — Sağ Dik Seren (${leafH}×${stileW}mm)`,
          bayIndex: comp.bayIndex,
          dimensions: { width: stileW, height: leafH, depth: leafT },
          position: { x: comp.position.x + leafW - stileW, y: comp.position.y, z: comp.position.z },
          materialId: comp.materialId,
          isFrontFacing: true,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        },
        {
          id: `${comp.id}_rail_bottom`,
          role: "door_rail_bottom",
          label: `${comp.label} — Alt Başlık Kaydı (${railCutLength}×${stileW}mm, 12mm Zıvanalı)`,
          bayIndex: comp.bayIndex,
          dimensions: { width: railCutLength, height: stileW, depth: leafT },
          position: { x: comp.position.x + stileW - tenonMm, y: comp.position.y, z: comp.position.z },
          materialId: comp.materialId,
          isFrontFacing: true,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        },
        {
          id: `${comp.id}_rail_top`,
          role: "door_rail_top",
          label: `${comp.label} — Üst Başlık Kaydı (${railCutLength}×${stileW}mm, 12mm Zıvanalı)`,
          bayIndex: comp.bayIndex,
          dimensions: { width: railCutLength, height: stileW, depth: leafT },
          position: {
            x: comp.position.x + stileW - tenonMm,
            y: comp.position.y + leafH - stileW,
            z: comp.position.z,
          },
          materialId: comp.materialId,
          isFrontFacing: true,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        },
        {
          id: `${comp.id}_center_panel`,
          role: "door_center_panel",
          label: `${comp.label} — 8mm Çerçeve Göbek Paneli (${centerH}×${centerW}mm)`,
          bayIndex: comp.bayIndex,
          dimensions: { width: centerW, height: centerH, depth: 8 },
          position: {
            x: comp.position.x + stileW - grooveDepthMm,
            y: comp.position.y + stileW - grooveDepthMm,
            z: comp.position.z + Math.max(4, (leafT - 8) / 2),
          },
          materialId: comp.materialId,
          isFrontFacing: true,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        }
      );
    } else {
      finalComponents.push(comp);
    }
  }

  const result: ModuleGeometryBreakdown = {
    moduleId: module.id,
    overall: module.dimensions,
    components: finalComponents,
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
