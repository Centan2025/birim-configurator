import {
  ModuleInstance,
  isBuiltInDishwasherModule,
} from "@birim/core";
import { ComponentGeometry, ModuleGeometryBreakdown } from "../types";
import { generateHandleGeometry } from "../handle-geometry";
import { moduleGeometryCache } from "./kinematics-and-math";

export interface SpecializedHullParams {
  module: ModuleInstance;
  cacheKey: string;
  doorOpenAngleDeg: number;
  drawerOpenMm: number;
}

export function tryGenerateSpecializedHullGeometry(
  params: SpecializedHullParams
): ModuleGeometryBreakdown | null {
  const { module, cacheKey, doorOpenAngleDeg, drawerOpenMm } = params;
  const { width, height, depth } = module.dimensions;
  const {
    panelThickness: T,
    plinthHeight,
    bodyMaterialId,
    doorMaterialId,
    doorPerimeterGap,
  } = module.carcass;

  // Handle Fully Integrated Built-In Dishwasher (Checklist #12: Carcassless 600mm slot + exterior furniture door + continuous countertop & plinth!)
  if (isBuiltInDishwasherModule(module)) {
    const dshComponents: ComponentGeometry[] = [];
    const T_door = module.carcass.doorThickness || 18;
    const bay0 = module.bays[0];
    const isGolaDsh =
      bay0?.door?.handleCategory === "gola_profile" &&
      bay0?.door?.handleProfileId !== "hnd_gola_vertical";
    const dshDoorH = Math.max(
      120,
      height - plinthHeight - 2 * doorPerimeterGap - (isGolaDsh ? 30 : 0)
    );
    const dshDoorW = Math.max(120, width - 2 * doorPerimeterGap);
    const rad = (doorOpenAngleDeg * Math.PI) / 180;
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
    if (!module.isOpenFront && bay0?.door?.type !== "open" && bay0?.door?.doorSystemId !== "open") {
      const dshProf = bay0?.door?.crossSectionProfile || module.carcass.crossSectionProfile;
      const isBevel30Dsh = bay0?.door?.handleProfileId === "hnd_bevel_30_backing";
      const dshDoor: ComponentGeometry = {
        id: `${bay0?.door?.id || module.id}_dsh_door`,
        role: "door_left",
        label: "Tam Ankastre Bulaşık Makinesi Mobilya Kapağı",
        bayIndex: 0,
        dimensions: { width: dshDoorW, height: dshDoorH, depth: T_door },
        position: { x: doorPerimeterGap, y: plinthHeight + doorPerimeterGap, z: depth },
        rotation: [rad * 0.85, 0, 0],
        pivot: { x: doorPerimeterGap, y: plinthHeight + doorPerimeterGap, z: depth },
        crossSectionProfile: dshProf,
        jPullEdge: dshProf === "j_pull_bevel" ? "top" : undefined,
        handleProfileId: isBevel30Dsh ? "hnd_bevel_30_backing" : undefined,
        bevelPullEdge: isBevel30Dsh ? "top" : undefined,
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
            moduleWidth: width,
            moduleDepth: depth,
            panelThickness: T,
            carcassBayStartX: doorPerimeterGap,
            carcassBayWidth: dshDoorW,
            carcassFrontZ0: depth,
            carcassClosedY0: plinthHeight + doorPerimeterGap,
            carcassClosedHeight: dshDoorH,
            isTopAtCabinetCeiling: true,
            handleOrientation: "horizontal",
            handleProfileId: bay0.door.handleProfileId,
            handleMaterialId: bay0.door.handleMaterialId,
          })
        );
      }
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

  // Handle Parametric Capsule Stadium, Rounded-Corners Tambour Units & Capsule Table Canonically (Single Source of Truth for 3D + 2D + BOM!)
  if (
    module.carcass.hullShape === "capsule_stadium" ||
    module.carcass.hullShape === "rounded_corners" ||
    module.carcass.hullShape === "capsule_table"
  ) {
    const capComponents: ComponentGeometry[] = [];
    const isRoundedRect = module.carcass.hullShape === "rounded_corners";
    const maxAllowedR = Math.max(40, Math.min(depth / 2, width / 2 - 40));
    const capR = isRoundedRect
      ? Math.max(65, Math.min(Math.max(65, depth / 2 - 20), maxAllowedR, module.carcass.cornerRadiusMm || 110))
      : module.carcass.hullShape === "capsule_table"
      ? Math.max(80, Math.min(maxAllowedR, module.carcass.cornerRadiusMm || depth / 2))
      : maxAllowedR;
    const straightSpanW = Math.max(0, width - 2 * capR);
    const flatSideZ = Math.max(0, depth - 2 * capR);

    // Closed 2D polygon in DXF local panel coordinates: X = En (depth, 0..dTotal), Y = Boy (width, 0..wTotal)
    const buildRoundedContour = (wTotal: number, dTotal: number, rCorner: number): [number, number][] => {
      const r = Math.max(8, Math.min(wTotal / 2, dTotal / 2, rCorner));
      const pts: [number, number][] = [];
      const corners: [number, number, number, number][] = [
        [r, r, Math.PI, 1.5 * Math.PI],
        [dTotal - r, r, 1.5 * Math.PI, 2.0 * Math.PI],
        [dTotal - r, wTotal - r, 0, 0.5 * Math.PI],
        [r, wTotal - r, 0.5 * Math.PI, Math.PI],
      ];
      for (const [cx, cy, a0, a1] of corners) {
        for (let i = 0; i <= 6; i++) {
          const ang = a0 + ((a1 - a0) * i) / 6;
          pts.push([
            Math.round((cx + r * Math.cos(ang)) * 100) / 100,
            Math.round((cy + r * Math.sin(ang)) * 100) / 100,
          ]);
        }
      }
      return pts;
    };

    const buildCircleContour = (diam: number): [number, number][] => {
      const r = diam / 2;
      const pts: [number, number][] = [];
      for (let i = 0; i < 20; i++) {
        const ang = (2 * Math.PI * i) / 20;
        pts.push([
          Math.round((r + r * Math.cos(ang)) * 100) / 100,
          Math.round((r + r * Math.sin(ang)) * 100) / 100,
        ]);
      }
      return pts;
    };

    if (module.carcass.hullShape === "capsule_table") {
      const topT = module.carcass.topPanelThicknessMm || module.attachedTableConfig?.topThicknessMm || 36;
      const pedH = Math.max(120, height - topT);
      const pedR = Math.round(Math.min(185, Math.max(95, depth * 0.21)));
      const arcFullMm = Math.round(2 * Math.PI * pedR * 10) / 10;
      const kerfPitch = 14;
      const kerfCnt = Math.max(12, Math.round(arcFullMm / kerfPitch));
      const pedCount = width >= 1450 ? 2 : 1;
      const topMat = module.carcass.countertopMaterialId || doorMaterialId || bodyMaterialId;
      const innerDiscDiam = Math.max(120, pedR * 2 - 2 * T);

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
        polygonContourMm: buildRoundedContour(width, depth, capR),
      });

      const pedCentersX: number[] = [];
      for (let pi = 0; pi < pedCount; pi++) {
        const cx =
          pedCount === 1
            ? width / 2
            : pi === 0
            ? Math.max(pedR + 90, Math.round(width * 0.26))
            : Math.min(width - pedR - 90, Math.round(width * 0.74));
        pedCentersX.push(cx);
        capComponents.push(
          {
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
          },
          {
            id: `${module.id}_pedestal_disc_top_${pi + 1}`,
            role: "carcass_top",
            label: `Sütun Ayak Üst Kalıp & Flanş Diski #${pi + 1} (Ø${innerDiscDiam}mm)`,
            dimensions: { width: innerDiscDiam, height: T, depth: innerDiscDiam },
            position: { x: cx - innerDiscDiam / 2, y: pedH - T, z: depth / 2 - innerDiscDiam / 2 },
            materialId: bodyMaterialId,
            isManufacturablePanel: true,
            thicknessAxis: "y",
            polygonContourMm: buildCircleContour(innerDiscDiam),
          },
          {
            id: `${module.id}_pedestal_disc_bot_${pi + 1}`,
            role: "carcass_bottom",
            label: `Sütun Ayak Alt Terazi Diski #${pi + 1} (Ø${innerDiscDiam}mm)`,
            dimensions: { width: innerDiscDiam, height: T, depth: innerDiscDiam },
            position: { x: cx - innerDiscDiam / 2, y: 8, z: depth / 2 - innerDiscDiam / 2 },
            materialId: bodyMaterialId,
            isManufacturablePanel: true,
            thicknessAxis: "y",
            polygonContourMm: buildCircleContour(innerDiscDiam),
          }
        );
      }

      if (pedCentersX.length >= 2) {
        const spanBeamW = Math.max(240, pedCentersX[1] - pedCentersX[0] + pedR);
        capComponents.push({
          id: `${module.id}_table_steel_apron`,
          role: "special_fitting",
          label: `Masa Altı Çelik Sarkma Önleyici Travers (${Math.round(spanBeamW)}×40×30mm)`,
          dimensions: { width: Math.round(spanBeamW), height: 30, depth: 80 },
          position: { x: Math.round((width - spanBeamW) / 2), y: pedH - 30, z: Math.round(depth / 2 - 40) },
          materialId: "mat_handle_matte_black",
          isManufacturablePanel: false,
        });
      }

      if (module.componentMaterialOverrides) {
        capComponents.forEach((c) => {
          const ov = module.componentMaterialOverrides?.[c.id];
          if (ov) c.materialId = ov;
        });
      }

      const capTblRes: ModuleGeometryBreakdown = {
        moduleId: module.id,
        overall: module.dimensions,
        components: capComponents,
        bayWidths: [width],
        netInnerHeight: pedH,
        netInnerDepth: depth,
      };
      moduleGeometryCache.set(cacheKey, capTblRes);
      return capTblRes;
    }

    // hullShape === "capsule_stadium" | "rounded_corners" (True Tambour Production Architecture)
    const pH = plinthHeight || 0;
    const hasTopTray = Boolean(
      module.carcass.countertopMaterialId && module.carcass.hasCountertopTray !== false
    );
    const topTrayT = hasTopTray ? 20 : 0;
    const bodyBoxH = Math.max(180, height - pH - topTrayT);
    const innerClearH = Math.max(120, bodyBoxH - 2 * T);
    const trackInsetMm = 18;
    const pocketCorridorMm = 32;
    const pocketOuterR = Math.max(52, capR - pocketCorridorMm);
    const slabContour = buildRoundedContour(width, depth, capR);
    const shapeTitle = isRoundedRect ? "R-Köşeli Tambur" : "Kapsül Stadyum";

    if (pH > 0) {
      const recess = Math.min(65, Math.max(35, Math.round(capR * 0.35)));
      const plinthW = Math.max(160, width - 2 * recess);
      const capPlinthMat = module.carcass.plinthMaterialId || doorMaterialId || bodyMaterialId;
      const capFrontZ = Math.max(T + 40, depth - recess - T);
      const capRearZ = Math.min(recess, Math.max(20, capFrontZ - 60));
      const capSideD = Math.max(40, capFrontZ - capRearZ);
      capComponents.push(
        {
          id: `${module.id}_capsule_plinth`,
          role: "plinth",
          label: `${shapeTitle} Ön Baza Bandı (${plinthW}×${pH}mm)`,
          dimensions: { width: plinthW, height: pH, depth: T },
          position: { x: recess, y: 0, z: capFrontZ },
          materialId: capPlinthMat,
          isFrontFacing: true,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        },
        {
          id: `${module.id}_capsule_plinth_rear`,
          role: "plinth",
          label: `${shapeTitle} Arka Baza Kayıtı`,
          dimensions: { width: Math.max(80, plinthW - 2 * T), height: pH, depth: T },
          position: { x: recess + T, y: 0, z: capRearZ },
          materialId: bodyMaterialId,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        },
        {
          id: `${module.id}_capsule_plinth_left`,
          role: "plinth",
          label: `${shapeTitle} Sol Dönüş Baza Bandı`,
          dimensions: { width: T, height: pH, depth: capSideD },
          position: { x: recess, y: 0, z: capRearZ },
          materialId: capPlinthMat,
          isManufacturablePanel: true,
          thicknessAxis: "x",
        },
        {
          id: `${module.id}_capsule_plinth_right`,
          role: "plinth",
          label: `${shapeTitle} Sağ Dönüş Baza Bandı`,
          dimensions: { width: T, height: pH, depth: capSideD },
          position: { x: recess + plinthW - T, y: 0, z: capRearZ },
          materialId: capPlinthMat,
          isManufacturablePanel: true,
          thicknessAxis: "x",
        }
      );
    }

    // Contoured Bottom & Top Slabs with 8.5×7.5mm CNC Tambour Guide Track Groove
    const trackGrooveSpec = !module.isOpenFront
      ? {
          insetFromOuterMm: trackInsetMm,
          widthMm: 8.5,
          depthMm: 7.5,
          cornerRadiusMm: Math.round(capR * 10) / 10,
        }
      : undefined;

    capComponents.push(
      {
        id: `${module.id}_capsule_bottom`,
        role: "carcass_bottom",
        label: `${shapeTitle} Alt Tabla (${width}×${depth}mm, R=${Math.round(capR)}mm)`,
        dimensions: { width, height: T, depth },
        position: { x: 0, y: pH, z: 0 },
        materialId: doorMaterialId || bodyMaterialId,
        isFrontFacing: true,
        isManufacturablePanel: true,
        thicknessAxis: "y",
        polygonContourMm: slabContour,
        tambourTrackGrooveSpec: trackGrooveSpec,
      },
      {
        id: `${module.id}_capsule_top`,
        role: "carcass_top",
        label: `${shapeTitle} Üst Tabla (${width}×${depth}mm, R=${Math.round(capR)}mm)`,
        dimensions: { width, height: T, depth },
        position: { x: 0, y: pH + bodyBoxH - T, z: 0 },
        materialId: doorMaterialId || bodyMaterialId,
        isFrontFacing: true,
        isManufacturablePanel: true,
        thicknessAxis: "y",
        polygonContourMm: slabContour,
        tambourTrackGrooveSpec: trackGrooveSpec,
      }
    );

    if (hasTopTray && topTrayT > 0) {
      const trayInset = 8;
      const trayW = Math.max(160, width - 2 * trayInset);
      const trayD = Math.max(140, depth - 2 * trayInset);
      const trayR = Math.max(40, capR - trayInset);
      capComponents.push({
        id: `${module.id}_capsule_marble_top`,
        role: "countertop",
        label: `${shapeTitle} Üst Mermer / Kuvars Tabla (${trayW}×${trayD}×${topTrayT}mm)`,
        dimensions: { width: trayW, height: topTrayT, depth: trayD },
        position: { x: trayInset, y: pH + bodyBoxH, z: trayInset },
        materialId: module.carcass.countertopMaterialId || "mat_quartz_calacatta",
        isFrontFacing: true,
        isManufacturablePanel: true,
        thicknessAxis: "y",
        polygonContourMm: buildRoundedContour(trayW, trayD, trayR),
      });
    }

    // Internal Curved Kerf-Bent Pocket Shells (Creates real 32mm lateral pocket corridor for tambour slats!)
    const kerfSpacing = 13;
    if (isRoundedRect) {
      const quarterArcMm = Math.round(0.5 * Math.PI * pocketOuterR * 10) / 10;
      const kerfCount90 = Math.max(6, Math.round(quarterArcMm / kerfSpacing));
      [1, 2, 3, 4].forEach((ci) => {
        capComponents.push({
          id: `${module.id}_kerf_corner_${ci}`,
          role: "kerf_curve",
          label: `R-Köşe İç Cep Kerf Açınımı #${ci} (R=${Math.round(pocketOuterR)}mm, Yay=${quarterArcMm}mm, ${kerfCount90} Kerf)`,
          dimensions: { width: quarterArcMm, height: innerClearH, depth: T },
          position: {
            x: ci === 1 || ci === 4 ? pocketCorridorMm : Math.max(0, width - capR),
            y: pH + T,
            z: ci <= 2 ? pocketCorridorMm : Math.max(0, depth - capR),
          },
          materialId: bodyMaterialId,
          isFrontFacing: false,
          isManufacturablePanel: true,
          thicknessAxis: "z",
          kerfBendingMeta: {
            outerRadiusMm: Math.round(pocketOuterR * 10) / 10,
            bendAngleDeg: 90,
            unfoldedArcLengthMm: quarterArcMm,
            kerfCount: kerfCount90,
            kerfSpacingMm: Math.round((quarterArcMm / kerfCount90) * 100) / 100,
            residualWebMm: 2.5,
          },
        });
      });
      if (flatSideZ >= 60) {
        [pocketCorridorMm, width - pocketCorridorMm - T].forEach((sx, si) => {
          capComponents.push({
            id: `${module.id}_rounded_side_wall_${si + 1}`,
            role: "carcass_divider",
            label: `R-Köşeli Yan Cep İç Duvarı #${si + 1} (${Math.round(flatSideZ)}×${innerClearH}mm)`,
            dimensions: { width: T, height: innerClearH, depth: Math.round(flatSideZ) },
            position: { x: sx, y: pH + T, z: capR },
            materialId: bodyMaterialId,
            isManufacturablePanel: true,
            thicknessAxis: "x",
          });
        });
      }
    } else {
      const semiArcMm = Math.round(Math.PI * pocketOuterR * 10) / 10;
      const kerfCount180 = Math.max(8, Math.round(semiArcMm / kerfSpacing));
      [1, 2].forEach((ci) => {
        capComponents.push({
          id: `${module.id}_kerf_curve_${ci}`,
          role: "kerf_curve",
          label: `Kapsül Kavisli Yan Gövde Açınımı #${ci} (R=${Math.round(pocketOuterR)}mm, Yay=${semiArcMm}mm, ${kerfCount180} Kerf)`,
          dimensions: { width: semiArcMm, height: innerClearH, depth: T },
          position: {
            x: ci === 1 ? pocketCorridorMm : Math.max(0, width - capR),
            y: pH + T,
            z: pocketCorridorMm,
          },
          materialId: doorMaterialId || bodyMaterialId,
          isFrontFacing: true,
          isManufacturablePanel: true,
          thicknessAxis: "z",
          kerfBendingMeta: {
            outerRadiusMm: Math.round(pocketOuterR * 10) / 10,
            bendAngleDeg: 180,
            unfoldedArcLengthMm: semiArcMm,
            kerfCount: kerfCount180,
            kerfSpacingMm: Math.round((semiArcMm / kerfCount180) * 100) / 100,
            residualWebMm: 2.5,
          },
        });
      });
    }

    // Internal Usable Carcass Zone (Set back 34mm from front & 32mm+T from rear so tambour track has unobstructed loop clearance!)
    const zRearBack = pocketCorridorMm;
    const zInnerStart = zRearBack + T;
    const zInnerFrontLimit = Math.max(zInnerStart + 120, depth - 34);
    const netInnerD = Math.max(120, zInnerFrontLimit - zInnerStart);
    const centerLeftX = Math.min(capR, Math.max(pocketCorridorMm + T, capR));
    const centerRightX = Math.max(centerLeftX + 2 * T + 100, width - capR);
    const centerSpanW = Math.max(120, centerRightX - centerLeftX);

    // Two Structural Tangent Bulkheads + Rear Straight Back Panel
    if (straightSpanW >= 120) {
      [centerLeftX, centerRightX - T].forEach((bx, bi) => {
        capComponents.push({
          id: `${module.id}_capsule_bulkhead_${bi + 1}`,
          role: "carcass_divider",
          label: `${shapeTitle} İç Taşıyıcı Dikme #${bi + 1}`,
          dimensions: { width: T, height: innerClearH, depth: netInnerD },
          position: { x: bx, y: pH + T, z: zInnerStart },
          materialId: bodyMaterialId,
          isManufacturablePanel: true,
          thicknessAxis: "x",
        });
      });

      capComponents.push({
        id: `${module.id}_capsule_center_back`,
        role: "carcass_back",
        label: `${shapeTitle} Orta Düz Arkalık (${Math.round(centerSpanW)}×${innerClearH}mm)`,
        dimensions: { width: Math.round(centerSpanW), height: innerClearH, depth: T },
        position: { x: centerLeftX, y: pH + T, z: zRearBack },
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        thicknessAxis: "z",
      });
    }

    // Compute Bay Clear Widths inside [centerLeftX + T .. centerRightX - T] & Generate Real Dividers, Shelves & Drawers!
    const bayCount = Math.max(1, module.bays.length);
    const availBaysClearW = Math.max(
      120,
      (straightSpanW >= 120 ? centerSpanW - 2 * T : width - 2 * (pocketCorridorMm + T)) - (bayCount - 1) * T
    );
    const bayZoneOriginX = straightSpanW >= 120 ? centerLeftX + T : pocketCorridorMm + T;
    const rawRatios = module.bays.map((b) =>
      b.customWidth && b.customWidth > 60 ? b.customWidth : Math.max(100, availBaysClearW / bayCount)
    );
    const ratioSum = rawRatios.reduce((a, b) => a + b, 0) || 1;
    const computedBayClearWs = rawRatios.map((r) => Math.max(80, Math.round((availBaysClearW * r) / ratioSum)));
    const diffW = availBaysClearW - computedBayClearWs.reduce((a, b) => a + b, 0);
    if (computedBayClearWs.length > 0) {
      computedBayClearWs[computedBayClearWs.length - 1] = Math.max(
        80,
        computedBayClearWs[computedBayClearWs.length - 1] + diffW
      );
    }

    let cursorBayX = bayZoneOriginX;
    const bayStartsX: number[] = [];
    module.bays.forEach((bay, bi) => {
      const bClearW = computedBayClearWs[bi] || availBaysClearW;
      bayStartsX.push(cursorBayX);

      // Intermediate Bay Divider
      if (bi > 0) {
        capComponents.push({
          id: `${module.id}_capsule_bay_div_${bi}`,
          role: "carcass_divider",
          bayIndex: bi - 1,
          label: `${shapeTitle} Ara Bölme Dikmesi #${bi}`,
          dimensions: { width: T, height: innerClearH, depth: netInnerD },
          position: { x: cursorBayX - T, y: pH + T, z: zInnerStart },
          materialId: bodyMaterialId,
          isManufacturablePanel: true,
          thicknessAxis: "x",
        });
      }

      // Bay Shelves (respects elevationY, thickness, glass vs wood, and tambour clearance!)
      (bay.shelves || []).forEach((sh, si) => {
        if (sh.isHidden) return;
        const shT = sh.thickness || (sh.isGlass ? 8 : T);
        const clampedElev = Math.max(32, Math.min(innerClearH - shT - 24, sh.elevationY));
        const shMat = sh.isGlass ? "mat_glass_clear" : bodyMaterialId;
        const mountTag = sh.isFixed || sh.isAdjustable === false ? "Sabit" : "Hareketli";
        capComponents.push({
          id: sh.id || `${module.id}_cap_shelf_${bi}_${si}`,
          role: "shelf",
          bayIndex: bi,
          label: `${shapeTitle} ${mountTag} Raf B${bi + 1}.${si + 1} (${bClearW}×${Math.max(100, netInnerD - 8)}mm)`,
          dimensions: { width: bClearW, height: shT, depth: Math.max(100, netInnerD - 8) },
          position: { x: cursorBayX, y: pH + T + clampedElev, z: zInnerStart + 4 },
          materialId: shMat,
          isManufacturablePanel: true,
          thicknessAxis: "y",
        });
      });

      // Bay Drawers (TV Unit Media Drawers & Internal Buffet Drawers!)
      (bay.drawers || []).forEach((dr, di) => {
        if (dr.isHidden) return;
        const drFrontH = Math.max(80, Math.min(innerClearH - 8, dr.height));
        const drElev = Math.max(0, Math.min(innerClearH - drFrontH, dr.elevationY));
        const isBehindTambour = bay.door?.type !== "open" && !module.isOpenFront;
        const frontZ = isBehindTambour ? zInnerFrontLimit - T : depth - trackInsetMm - T;
        const boxDepth = Math.max(180, Math.floor((frontZ - zInnerStart - 16) / 25) * 25);
        const pullZ = Math.min(boxDepth * 0.75, Math.max(0, drawerOpenMm));
        const boxH = Math.max(60, drFrontH - 36);
        const boxT = 16;
        const boxInnerW = Math.max(80, bClearW - 26 - 2 * boxT);
        const drMat = dr.frontMaterialId || doorMaterialId;

        capComponents.push(
          {
            id: `${dr.id}_front`,
            role: "drawer_front",
            bayIndex: bi,
            label: `${shapeTitle} Çekmece Klapası B${bi + 1}.${di + 1}`,
            dimensions: { width: Math.max(80, bClearW - 4), height: drFrontH - 4, depth: T },
            position: { x: cursorBayX + 2, y: pH + T + drElev + 2, z: frontZ + pullZ },
            materialId: drMat,
            isFrontFacing: true,
            isManufacturablePanel: true,
            thicknessAxis: "z",
          },
          {
            id: `${dr.id}_bottom`,
            role: "drawer_bottom",
            bayIndex: bi,
            label: `Çekmece Alt Tablası B${bi + 1}.${di + 1}`,
            dimensions: { width: boxInnerW + 12, height: 8, depth: Math.max(120, boxDepth - boxT) },
            position: { x: cursorBayX + 13 + boxT - 6, y: pH + T + drElev + 14, z: frontZ - boxDepth + pullZ },
            materialId: bodyMaterialId,
            isManufacturablePanel: true,
            thicknessAxis: "y",
          },
          {
            id: `${dr.id}_side_left`,
            role: "drawer_side_left",
            bayIndex: bi,
            label: `Çekmece Sol Yan B${bi + 1}.${di + 1}`,
            dimensions: { width: boxT, height: boxH, depth: boxDepth },
            position: { x: cursorBayX + 13, y: pH + T + drElev + 10, z: frontZ - boxDepth + pullZ },
            materialId: bodyMaterialId,
            isManufacturablePanel: true,
            thicknessAxis: "x",
          },
          {
            id: `${dr.id}_side_right`,
            role: "drawer_side_right",
            bayIndex: bi,
            label: `Çekmece Sağ Yan B${bi + 1}.${di + 1}`,
            dimensions: { width: boxT, height: boxH, depth: boxDepth },
            position: { x: cursorBayX + bClearW - 13 - boxT, y: pH + T + drElev + 10, z: frontZ - boxDepth + pullZ },
            materialId: bodyMaterialId,
            isManufacturablePanel: true,
            thicknessAxis: "x",
          },
          {
            id: `${dr.id}_back`,
            role: "drawer_back",
            bayIndex: bi,
            label: `Çekmece Arkalık B${bi + 1}.${di + 1}`,
            dimensions: { width: boxInnerW, height: Math.max(50, boxH - 12), depth: boxT },
            position: { x: cursorBayX + 13 + boxT, y: pH + T + drElev + 22, z: frontZ - boxDepth + pullZ },
            materialId: bodyMaterialId,
            isManufacturablePanel: true,
            thicknessAxis: "z",
          }
        );
      });

      cursorBayX += bClearW + T;
    });

    // Flexible Tambour Door Curtains (Supports Full Center-Split OR Left/Right Tambour around Open Center TV Media Bay!)
    if (!module.isOpenFront) {
      const rTrack = Math.max(30, capR - trackInsetMm);
      const curveWrapMm = Math.round(0.5 * Math.PI * rTrack + flatSideZ * 0.5);
      const hasOpenCenterMediaBay =
        module.bays.length >= 3 &&
        module.bays[0]?.door?.type !== "open" &&
        module.bays[1]?.door?.type === "open" &&
        module.bays[module.bays.length - 1]?.door?.type !== "open";

      const leftFrontSpanMm = hasOpenCenterMediaBay
        ? Math.max(120, bayStartsX[1] - T / 2 - capR)
        : Math.max(120, straightSpanW / 2);
      const rightFrontSpanMm = hasOpenCenterMediaBay
        ? Math.max(
            120,
            width - capR - (bayStartsX[module.bays.length - 1] - T / 2)
          )
        : Math.max(120, straightSpanW / 2);

      const leftUnfoldedW = Math.max(180, Math.round(leftFrontSpanMm + curveWrapMm));
      const rightUnfoldedW = Math.max(180, Math.round(rightFrontSpanMm + curveWrapMm));
      const curtainH = Math.max(80, innerClearH + 10); // +5mm top & +5mm bottom guide tenon inside 7.5mm CNC track
      const slatThick = 14;

      const anyClosedDoor = module.bays.some((b) => b.door?.type !== "open");
      if (anyClosedDoor) {
        capComponents.push(
          {
            id: `${module.id}_capsule_tambour_left`,
            role: "door_left",
            bayIndex: 0,
            label: `${shapeTitle} Sol Esnek Tambur Kapak Açınımı (${leftUnfoldedW}×${curtainH}mm, Keçe Sırtlı)`,
            dimensions: { width: leftUnfoldedW, height: curtainH, depth: slatThick },
            position: { x: capR, y: pH + T - 5, z: depth - trackInsetMm - slatThick / 2 },
            materialId: module.bays[0]?.door?.doorMaterialId || doorMaterialId,
            isFrontFacing: true,
            isManufacturablePanel: true,
            thicknessAxis: "z",
          },
          {
            id: `${module.id}_capsule_tambour_right`,
            role: "door_right",
            bayIndex: Math.max(0, module.bays.length - 1),
            label: `${shapeTitle} Sağ Esnek Tambur Kapak Açınımı (${rightUnfoldedW}×${curtainH}mm, Keçe Sırtlı)`,
            dimensions: { width: rightUnfoldedW, height: curtainH, depth: slatThick },
            position: {
              x: width - capR - rightFrontSpanMm,
              y: pH + T - 5,
              z: depth - trackInsetMm - slatThick / 2,
            },
            materialId: module.bays[module.bays.length - 1]?.door?.doorMaterialId || doorMaterialId,
            isFrontFacing: true,
            isManufacturablePanel: true,
            thicknessAxis: "z",
          }
        );
      }
    }

    if (module.componentMaterialOverrides) {
      capComponents.forEach((c) => {
        const ov = module.componentMaterialOverrides?.[c.id];
        if (ov) c.materialId = ov;
      });
    }

    const capRes: ModuleGeometryBreakdown = {
      moduleId: module.id,
      overall: module.dimensions,
      components: capComponents,
      bayWidths: computedBayClearWs.length > 0 ? computedBayClearWs : [Math.max(120, straightSpanW || width - 2 * T)],
      netInnerHeight: innerClearH,
      netInnerDepth: netInnerD,
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

  return null;
}
