import {
  ModuleInstance,
  SlidingMountingType,
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
  BoundedLruCache,
  computeModuleStructuralSignature,
  doesDrawerHaveUpperCGolaChannel,
  doesModuleEmitTopHorizontalGola,
  resolveErgonomicGolaDrawerPlan,
  computeModuleIntrinsicSignature,
  isDoorZoneOpen,
  resolveInternalDrawerHingeClearance,
} from "@birim/core";
import { ComponentGeometry, ModuleGeometryBreakdown } from "./types";
import { generateHandleGeometry } from "./handle-geometry";

export interface GenerateGeometryOptions {
  doorOpenAngleDeg?: number; // 0 = closed, 90 = open
  drawerOpenMm?: number; // 0 = closed, 350 = pulled out
  explodedFactor?: number; // 0 = normal, 1 = fully exploded
}

const moduleGeometryCache = new BoundedLruCache<string, ModuleGeometryBreakdown>(512);

/**
 * Exact 2-Bar Articulated Linkage Inverse Kinematics in the Y-Z Plane (Law of Cosines).
 * Connects a stationary carcass pivot (yS, zS) to a moving door pivot (yD, zD) using two
 * rigid steel arms of constant lengths L1 and L2 so 60fps Three.js fast-path transforms
 * stay 100% connected from 0° (closed inside cabinet) to 90° (fully open)!
 */
function solve2BarLinkageYZ(
  yS: number,
  zS: number,
  yD: number,
  zD: number,
  L1: number,
  L2: number,
  bendRearward = true
): { yE: number; zE: number; pitch1Rad: number; pitch2Rad: number } {
  const dy = yD - yS;
  const dz = zD - zS;
  const rawDist = Math.hypot(dy, dz);
  const minReach = Math.abs(L1 - L2) + 2;
  const maxReach = L1 + L2 - 1;
  const d = Math.max(minReach, Math.min(maxReach, rawDist > 1e-3 ? rawDist : minReach));
  const ux = rawDist > 1e-3 ? dy / rawDist : -1;
  const uz = rawDist > 1e-3 ? dz / rawDist : 0;

  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  const midY = yS + a * ux;
  const midZ = zS + a * uz;

  // Candidate elbows perpendicular to (ux, uz) in (Y, Z)
  const candAY = midY - h * uz;
  const candAZ = midZ + h * ux;
  const candBY = midY + h * uz;
  const candBZ = midZ - h * ux;

  const pickA = bendRearward ? candAZ <= candBZ : candAZ > candBZ;
  const yE = pickA ? candAY : candBY;
  const zE = pickA ? candAZ : candBZ;

  // In Three.js right-handed coords (+Y up, +Z forward), a +Z bar rotated around X by rx = -atan2(dy, dz) lands on (+dy, +dz)!
  const pitch1Rad = -Math.atan2(yE - yS, zE - zS);
  const pitch2Rad = -Math.atan2(yD - yE, zD - zE);
  return { yE, zE, pitch1Rad, pitch2Rad };
}

function resolveStandardCornerWingDepthMm(
  width: number,
  depth: number,
  isWallCorner: boolean,
  isWardrobeCorner: boolean
): number {
  const minArm = Math.min(width, depth);
  if (isWallCorner) {
    return minArm >= 580 ? 350 : Math.min(350, Math.round(minArm * 0.56));
  }
  if (isWardrobeCorner) {
    return minArm >= 920 ? 600 : Math.min(600, Math.round(minArm * 0.58));
  }
  return minArm >= 780 ? 580 : Math.min(580, Math.round(minArm * 0.64));
}

export const GEOMETRY_ENGINE_REV = "2026-11-21-r7";

export function generateModuleGeometry(
  module: ModuleInstance,
  options: GenerateGeometryOptions = {}
): ModuleGeometryBreakdown {
  const cacheKey = `${GEOMETRY_ENGINE_REV}|${computeModuleIntrinsicSignature(module)}|${options.doorOpenAngleDeg || 0}:${options.drawerOpenMm || 0}:${options.explodedFactor || 0}`;
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
      capComponents.push({
        id: `${module.id}_capsule_plinth`,
        role: "plinth",
        label: `${shapeTitle} Alt Taşıyıcı Baza / Ayak Kasası (${plinthW}×${pH}mm)`,
        dimensions: { width: plinthW, height: pH, depth: T },
        position: { x: recess, y: 0, z: Math.max(T, depth - recess - T) },
        materialId: module.carcass.plinthMaterialId || doorMaterialId || bodyMaterialId,
        isFrontFacing: true,
        isManufacturablePanel: true,
        thicknessAxis: "z",
      });
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

  const isWallCornerCandidate =
    module.category === "kitchen_wall" || module.moduleFamilyId === "fam_kitchen_wall";
  const minCornerDimMm = isWallCornerCandidate ? 500 : 600;

  const isDiagonalCorner =
    Boolean(module.isCorner) &&
    (tplLowerCheck.includes("diagonal") ||
      nameLowerCheck.includes("diyagonal") ||
      nameLowerCheck.includes("45°")) &&
    width >= minCornerDimMm &&
    depth >= minCornerDimMm;

  const isTrueLCorner =
    Boolean(module.isCorner) &&
    !isDiagonalCorner &&
    !tplLowerCheck.includes("blind") &&
    !tplLowerCheck.includes("outer_corner") &&
    !nameLowerCheck.includes("kör") &&
    !nameLowerCheck.includes("dış köşe") &&
    width >= minCornerDimMm &&
    depth >= minCornerDimMm;

  if (isTrueLCorner) {
    const isWallL = module.category === "kitchen_wall" || module.moduleFamilyId === "fam_kitchen_wall";
    const wingD = resolveStandardCornerWingDepthMm(width, depth, isWallL, isWardrobe);
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
      }
    );

    // 3. Tek Parça CNC L-Kesim Alt & Üst Tablalar (Statik Süreklilik — BOM'da tek parça L-plaka olarak kesilir, dönüş kolu 3B görsel uzantısıdır)
    const lBlankW = Math.max(200, width - 2 * T);
    const lBlankD = Math.max(200, depth - T);
    const lNotchW = Math.max(80, width - T - wingD);
    const lNotchD = Math.max(80, depth - T - wingD);
    components.push(
      {
        id: `${module.id}_bottom_main`,
        role: "carcass_bottom",
        label: "L-Köşe Tek Parça CNC Alt Tabla (İç Boşaltmalı)",
        dimensions: { width: lBlankW, height: T, depth: wingD },
        position: { x: T, y: plinthHeight, z: 0 },
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        cncBlankOverride: { lengthMm: lBlankW, widthMm: lBlankD, notchWidthMm: lNotchW, notchDepthMm: lNotchD },
        thicknessAxis: "y",
      },
      {
        id: `${module.id}_bottom_return`,
        role: "carcass_bottom",
        label: "L-Köşe Alt Tabla (Tek Parça 3B Uzantı)",
        dimensions: { width: wingD - T, height: T, depth: returnSpanZ - T },
        position: { x: T, y: plinthHeight, z: wingD },
        materialId: bodyMaterialId,
        isManufacturablePanel: false,
        thicknessAxis: "y",
      },
      {
        id: `${module.id}_top_main`,
        role: "carcass_top",
        label: "L-Köşe Tek Parça CNC Üst Tabla (İç Boşaltmalı)",
        dimensions: { width: lBlankW, height: T, depth: wingD },
        position: { x: T, y: height - T, z: 0 },
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        cncBlankOverride: { lengthMm: lBlankW, widthMm: lBlankD, notchWidthMm: lNotchW, notchDepthMm: lNotchD },
        thicknessAxis: "y",
      },
      {
        id: `${module.id}_top_return`,
        role: "carcass_top",
        label: "L-Köşe Üst Tabla (Tek Parça 3B Uzantı)",
        dimensions: { width: wingD - T, height: T, depth: returnSpanZ - T },
        position: { x: T, y: height - T, z: wingD },
        materialId: bodyMaterialId,
        isManufacturablePanel: false,
        thicknessAxis: "y",
      },
      {
        id: `${module.id}_back_main`,
        role: "carcass_back",
        label: "L-Köşe Kanallı Arkalık (X Duvarı)",
        dimensions: { width: width - 2 * T + 16, height: netH + 16, depth: T_back },
        position: { x: T - 8, y: plinthHeight + T - 8, z: 8 },
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        thicknessAxis: "z",
      },
      {
        id: `${module.id}_back_return`,
        role: "carcass_back",
        label: "L-Köşe Kanallı Dönüş Arkalık (Z Duvarı)",
        dimensions: { width: T_back, height: netH + 16, depth: Math.max(120, depth - 2 * T) },
        position: { x: T, y: plinthHeight + T - 8, z: T + 8 },
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        thicknessAxis: "x",
      }
    );

    // 4. L-Shaped Internal Shelves, Corner Mechanisms (Strictly Contained Inside L-Cavity!) & Hanging Rails
    const firstBay = module.bays[0];
    // Upper wall L-corners (350mm wing depth) never take heavy base LeMans/MagicCorner frames; only allow compact 270° turntable if explicitly set
    const rawCornerMechFit = firstBay?.specialFittings?.find(
      (f) =>
        !f.isHidden &&
        (f.type === "carousel_half_moon" || f.type === "corner_lemans" || f.type === "magic_corner")
    );
    const cornerMechFit =
      isWallL && rawCornerMechFit && rawCornerMechFit.type !== "carousel_half_moon"
        ? undefined
        : rawCornerMechFit;
    if (firstBay) {
      if (cornerMechFit) {
        const openSpinRad = ((doorOpenAngleDeg + drawerOpenMm * 0.25) * Math.PI) / 180;
        if (cornerMechFit.type === "carousel_half_moon") {
          // 270° Pie-Cut Carousel: spindle center (cx, cz) MUST stay <= wingD - 34 so the 90° pie cutout clears (wingD, wingD) with zero door overflow!
          const maxSpindleCoord = Math.max(T + 110, wingD - 36);
          const maxSafeRadius = Math.max(
            90,
            Math.min(
              maxSpindleCoord - (T + 20),
              Math.min(width, depth) - T - 24 - maxSpindleCoord,
              isWallL ? 135 : 275
            )
          );
          const mechDia = Math.round(maxSafeRadius * 2);
          const spindleC = Math.min(maxSpindleCoord, T + 20 + maxSafeRadius);
          components.push({
            id: `${cornerMechFit.id || `${module.id}_l_mech`}_fitting_carousel_half_moon`,
            role: "special_fitting",
            label: "270° 3/4 Döner Karusel Köşe Sepeti [Häfele 542.02.210]",
            bayIndex: 0,
            dimensions: { width: mechDia, height: Math.max(260, netH - 28), depth: mechDia },
            position: { x: spindleC - maxSafeRadius, y: plinthHeight + T + 14, z: spindleC - maxSafeRadius },
            pivot: { x: spindleC, y: plinthHeight + T + 14, z: spindleC },
            rotation: [0, openSpinRad * 0.85, 0],
            materialId: "mat_metal_chrome",
            isManufacturablePanel: false,
          });
        } else {
          // Base L-Corner LeMans / Magic Corner: strictly confined inside the X-arm depth (z <= wingD - 28) when closed!
          const fitW = Math.max(280, Math.min(width - 2 * T - 44, 720));
          const fitD = Math.max(220, wingD - T - 46);
          const pullProg = doorOpenAngleDeg > 35 ? Math.min(1, (doorOpenAngleDeg - 35) / 55) : 0;
          components.push({
            id: `${cornerMechFit.id || `${module.id}_l_mech`}_fitting_${cornerMechFit.type}`,
            role: "special_fitting",
            label:
              cornerMechFit.type === "magic_corner"
                ? "Kesseböhmer Magic Corner Köşe Mekanizması [548.10.220]"
                : "Kesseböhmer LeMans II Köşe Mekanizması [541.32.240]",
            bayIndex: 0,
            dimensions: { width: fitW, height: Math.max(320, netH - 28), depth: fitD },
            position: {
              x: T + 22 + Math.round(pullProg * 60),
              y: plinthHeight + T + 14,
              z: T + 16 + Math.round(pullProg * 140),
            },
            pivot: {
              x: Math.min(width - T - 40, wingD + 20),
              y: plinthHeight + T + 14,
              z: Math.max(T + 80, wingD - 55),
            },
            rotation: [0, -pullProg * 0.45, 0],
            materialId: "mat_metal_chrome",
            isManufacturablePanel: false,
          });
        }
      } else {
        firstBay.shelves.forEach((sh, sIdx) => {
          if (sh.isHidden) return;
          const clampedElevY = Math.max(32, Math.min(Math.max(64, netH - T - 24), sh.elevationY));
          const sy = plinthHeight + T + clampedElevY;
          const mainShelfD = Math.max(120, wingD - 18 - 14);
          const lShelfBlankW = Math.max(200, width - 2 * T - 4);
          const lShelfBlankD = Math.max(200, depth - T - 20);
          const lShelfNotchW = Math.max(80, lShelfBlankW - Math.max(100, wingD - (T + 18) - 14));
          const lShelfNotchD = Math.max(80, lShelfBlankD - mainShelfD);
          components.push(
            {
              id: sh.id || `${module.id}_l_shelf_main_${sIdx}`,
              role: "shelf",
              label: `L-Köşe Tek Parça CNC Raf #${sIdx + 1} (İç Boşaltmalı)`,
              bayIndex: 0,
              dimensions: { width: lShelfBlankW, height: T, depth: mainShelfD },
              position: { x: T + 2, y: sy, z: 18 },
              materialId: bodyMaterialId,
              isManufacturablePanel: true,
              cncBlankOverride: {
                lengthMm: lShelfBlankW,
                widthMm: lShelfBlankD,
                notchWidthMm: lShelfNotchW,
                notchDepthMm: lShelfNotchD,
              },
              thicknessAxis: "y",
            },
            {
              id: `${sh.id || module.id}_l_shelf_ret_${sIdx}`,
              role: "shelf",
              label: `L-Köşe Raf #${sIdx + 1} (Tek Parça 3B Uzantı)`,
              bayIndex: 0,
              dimensions: {
                width: Math.max(100, wingD - (T + 18) - 14),
                height: T,
                depth: Math.max(100, depth - T - (18 + mainShelfD) - 2),
              },
              position: { x: T + 18, y: sy, z: 18 + mainShelfD },
              materialId: bodyMaterialId,
              isManufacturablePanel: false,
              thicknessAxis: "y",
            }
          );
        });
      }
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

    // 5. Zero-Overlap L-Shaped 38mm Quartz Countertop (+40mm Standard Drip Overhang) & X/Z Rear Backsplashes
    if (!isWardrobe && !isWallL) {
      const ctopMat = module.carcass.countertopMaterialId || "mat_neolith_calacatta_luxe";
      const mainCtopD = wingD + 40; // Matches neighboring 580+40=620mm base countertops to 0.0mm!
      const retCtopW = wingD + 40;
      const retCtopD = Math.max(60, depth - mainCtopD);
      components.push(
        {
          id: `${module.id}_l_countertop_main`,
          role: "countertop",
          label: "L-Köşe Kuvars Tezgâh Ana Kol (38mm, +40mm Damlalıklı)",
          dimensions: { width, height: 38, depth: mainCtopD },
          position: { x: 0, y: height, z: 0 },
          materialId: ctopMat,
          isFrontFacing: true,
          isManufacturablePanel: false,
        },
        {
          id: `${module.id}_l_countertop_return`,
          role: "countertop",
          label: "L-Köşe Kuvars Tezgâh Dönüş Kolu (38mm, Sıfır Çakışmalı)",
          dimensions: { width: retCtopW, height: 38, depth: retCtopD },
          position: { x: 0, y: height, z: mainCtopD },
          materialId: ctopMat,
          isFrontFacing: true,
          isManufacturablePanel: false,
        },
        {
          id: `${module.id}_l_backsplash_x`,
          role: "countertop",
          label: "L-Köşe Tezgâh Arka Süpürgelik Çıtası (X Duvarı 45×18mm)",
          dimensions: { width, height: 45, depth: 18 },
          position: { x: 0, y: height + 38, z: 0 },
          materialId: ctopMat,
          isFrontFacing: true,
          isManufacturablePanel: false,
        },
        {
          id: `${module.id}_l_backsplash_z`,
          role: "countertop",
          label: "L-Köşe Tezgâh Yan Dönüş Süpürgelik Çıtası (Z Duvarı 45×18mm)",
          dimensions: { width: 18, height: 45, depth: Math.max(80, depth - 18) },
          position: { x: 0, y: height + 38, z: 18 },
          materialId: ctopMat,
          isFrontFacing: true,
          isManufacturablePanel: false,
        }
      );
    }

    // 6. 90° Inner-Corner Doors — Supports Bi-Fold Right (default/folding), Bi-Fold Left (single_left), and Independent Double (double) + Stationary 90° L-Gola
    if (!module.isOpenFront && firstBay?.door && firstBay.door.type !== "open" && firstBay.door.doorSystemId !== "open") {
      const lDoorType = firstBay.door.type;
      const lDoorSys = firstBay.door.doorSystemId || inferDoorSystemIdFromType(lDoorType);
      const isLDouble =
        lDoorType === "double" ||
        lDoorType === "inset_double" ||
        lDoorSys === "hinged_double";
      const isLLeftFold =
        !isLDouble &&
        (lDoorType === "single_left" ||
          lDoorType === "inset_left" ||
          lDoorType === "half_overlay_left");
      const hCat = firstBay.door.handleCategory || "bar_handle";
      const isHorizGolaCorner =
        hCat === "gola_profile" &&
        firstBay.door.handleProfileId !== "hnd_gola_vertical" &&
        firstBay.door.handleProfileId !== "hnd_overhang_recessed_lip";
      const isBaseHorizGola = isHorizGolaCorner && !isWallL && !isWardrobe;
      const wallBottomOverhang = isWallL && hCat === "gola_profile" ? 18 : 0;
      const doorY = isWallL ? doorPerimeterGap - wallBottomOverhang : plinthHeight + doorPerimeterGap;
      const doorH = Math.max(
        120,
        height -
          plinthHeight -
          2 * doorPerimeterGap -
          (isBaseHorizGola ? 30 : 0) +
          wallBottomOverhang
      );
      const T_door = firstBay.door.doorThicknessMm || T;
      // Tight 90° inner corner meeting joint at (x = wingD, z = wingD) with zero gaping hole!
      const leaf1X0 = wingD + T_door + doorPerimeterGap;
      const leaf1W = Math.max(120, width - leaf1X0 - doorPerimeterGap);
      const leaf2Z0 = wingD + doorPerimeterGap;
      const leaf2W = Math.max(120, depth - leaf2Z0 - doorPerimeterGap);
      const rad = (doorOpenAngleDeg * Math.PI) / 180;
      const doorMatId = firstBay.door.doorMaterialId || doorMaterialId;

      const leaf1PivotX = leaf1X0 + leaf1W;
      const leaf1PivotZ = wingD + T_door;
      const leaf2OuterPivotX = wingD + T_door;
      const leaf2OuterPivotZ = leaf2Z0 + leaf2W;
      let leaf1: ComponentGeometry;
      let leaf2: ComponentGeometry;

      if (isLDouble) {
        // Independent Double Doors meeting at 90° inner corner (each hinged on its own outer upright)
        leaf1 = {
          id: `${firstBay.door.id}_lcorner_right`,
          role: "door_right",
          label: "90° L-Köşe Sağ Kapak (Bağımsız Çift Kapak)",
          bayIndex: 0,
          dimensions: { width: leaf1W, height: doorH, depth: T_door },
          position: { x: leaf1X0, y: doorY, z: wingD },
          rotation: [0, rad, 0],
          pivot: { x: leaf1PivotX, y: doorY, z: leaf1PivotZ },
          crossSectionProfile: firstBay.door.crossSectionProfile || module.carcass.crossSectionProfile,
          materialId: doorMatId,
          isFrontFacing: true,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        };
        leaf2 = {
          id: `${firstBay.door.id}_lcorner_return`,
          role: "door_left",
          label: "90° L-Köşe Sol Kapak (Bağımsız Çift Kapak)",
          bayIndex: 0,
          dimensions: { width: leaf2W, height: doorH, depth: T_door },
          position: { x: leaf2OuterPivotX - leaf2W, y: doorY, z: leaf2OuterPivotZ - T_door },
          rotation: [0, -Math.PI / 2 - rad, 0],
          pivot: { x: leaf2OuterPivotX, y: doorY, z: leaf2OuterPivotZ },
          crossSectionProfile: firstBay.door.crossSectionProfile || module.carcass.crossSectionProfile,
          materialId: doorMatId,
          isFrontFacing: true,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        };
        components.push(leaf1, leaf2);
        [doorY + 95, doorY + Math.max(160, doorH - 125)].forEach((hy, hIdx) => {
          components.push(
            {
              id: `${firstBay.door.id}_lcorner_right_hinge_170_${hIdx + 1}`,
              role: "door_hinge",
              label: `Blum CLIP top 110° Sağ Köşe Menteşesi #${hIdx + 1}`,
              bayIndex: 0,
              dimensions: { width: 28, height: 64, depth: 38 },
              position: { x: leaf1PivotX - 30, y: hy - 32, z: leaf1PivotZ - 38 },
              pivot: { x: leaf1PivotX, y: hy, z: leaf1PivotZ },
              rotation: [0, rad, 0],
              materialId: "mat_metal_chrome",
              isManufacturablePanel: false,
            },
            {
              id: `${firstBay.door.id}_lcorner_left_hinge_170_${hIdx + 1}`,
              role: "door_hinge",
              label: `Blum CLIP top 110° Sol Köşe Menteşesi #${hIdx + 1}`,
              bayIndex: 0,
              dimensions: { width: 28, height: 64, depth: 38 },
              position: { x: leaf2OuterPivotX - 38, y: hy - 32, z: leaf2OuterPivotZ - 30 },
              pivot: { x: leaf2OuterPivotX, y: hy, z: leaf2OuterPivotZ },
              rotation: [0, -Math.PI / 2 - rad, 0],
              materialId: "mat_metal_chrome",
              isManufacturablePanel: false,
            }
          );
        });
      } else if (isLLeftFold) {
        // Left-Hinged Coupled 90° Bi-Fold: Leaf 2 hinged on Z-arm outer upright, Leaf 1 folds against Leaf 2
        const thetaL = rad * 1.05;
        const leaf2YawL = -Math.PI / 2 - thetaL;
        leaf2 = {
          id: `${firstBay.door.id}_lcorner_return`,
          role: "door_left",
          label: "90° L-Köşe Ana Sol Kanat (Blum 170° Geniş Açılı Menteşeli)",
          bayIndex: 0,
          dimensions: { width: leaf2W, height: doorH, depth: T_door },
          position: { x: leaf2OuterPivotX - leaf2W, y: doorY, z: leaf2OuterPivotZ - T_door },
          rotation: [0, leaf2YawL, 0],
          pivot: { x: leaf2OuterPivotX, y: doorY, z: leaf2OuterPivotZ },
          crossSectionProfile: firstBay.door.crossSectionProfile || module.carcass.crossSectionProfile,
          materialId: doorMatId,
          isFrontFacing: true,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        };
        const dxJointL = -leaf2W;
        const dzJointL = -T_door;
        const movingJointXL = leaf2OuterPivotX + dxJointL * Math.cos(leaf2YawL) + dzJointL * Math.sin(leaf2YawL) + doorPerimeterGap;
        const movingJointZL = leaf2OuterPivotZ - dxJointL * Math.sin(leaf2YawL) + dzJointL * Math.cos(leaf2YawL);
        const leaf1YawL = -thetaL - Math.min(Math.PI * 0.72, rad * 1.25);
        leaf1 = {
          id: `${firstBay.door.id}_lcorner_right`,
          role: "door_right",
          label: "90° L-Köşe Eşlenik Katlanır Kanat (Blum 79T8500 Bi-Fold)",
          bayIndex: 0,
          dimensions: { width: leaf1W, height: doorH, depth: T_door },
          position: { x: movingJointXL, y: doorY, z: movingJointZL - T_door },
          rotation: [0, leaf1YawL, 0],
          pivot: { x: movingJointXL, y: doorY, z: movingJointZL },
          crossSectionProfile: firstBay.door.crossSectionProfile || module.carcass.crossSectionProfile,
          materialId: doorMatId,
          isFrontFacing: true,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        };
        components.push(leaf2, leaf1);
        [doorY + 95, doorY + Math.max(160, doorH - 125)].forEach((hy, hIdx) => {
          components.push(
            {
              id: `${firstBay.door.id}_lcorner_left_hinge_170_${hIdx + 1}`,
              role: "door_hinge",
              label: `Blum CLIP top 170° Sol Köşe Menteşesi #${hIdx + 1}`,
              bayIndex: 0,
              dimensions: { width: 28, height: 64, depth: 38 },
              position: { x: leaf2OuterPivotX - 38, y: hy - 32, z: leaf2OuterPivotZ - 30 },
              pivot: { x: leaf2OuterPivotX, y: hy, z: leaf2OuterPivotZ },
              rotation: [0, leaf2YawL, 0],
              materialId: "mat_metal_chrome",
              isManufacturablePanel: false,
            },
            {
              id: `${firstBay.door.id}_lcorner_bifold_hinge_${hIdx + 1}`,
              role: "special_fitting",
              label: `Blum CLIP top 79T8500 Orta Katlanır Köşe Menteşesi #${hIdx + 1}`,
              bayIndex: 0,
              dimensions: { width: 20, height: 48, depth: 20 },
              position: { x: movingJointXL - T_door - 22, y: hy - 24, z: movingJointZL - T_door - 22 },
              pivot: { x: movingJointXL, y: hy, z: movingJointZL },
              rotation: [0, -thetaL, 0],
              materialId: "mat_metal_chrome",
              isManufacturablePanel: false,
            }
          );
        });
      } else {
        // Primary X-arm leaf hinged at right carcass upright (x = width - gap, z = wingD + T_door) via 170° Blum hinges
        const theta1 = rad * 1.05; // Swings wide up to ~95°..115°
        leaf1 = {
          id: `${firstBay.door.id}_lcorner_right`,
          role: "door_right",
          label: "90° L-Köşe Ana Kanat (Blum 170° Geniş Açılı Menteşeli)",
          bayIndex: 0,
          dimensions: { width: leaf1W, height: doorH, depth: T_door },
          position: { x: leaf1X0, y: doorY, z: wingD },
          rotation: [0, theta1, 0],
          pivot: { x: leaf1PivotX, y: doorY, z: leaf1PivotZ },
          crossSectionProfile: firstBay.door.crossSectionProfile || module.carcass.crossSectionProfile,
          materialId: doorMatId,
          isFrontFacing: true,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        };
        components.push(leaf1);

        // Coupled Z-arm bi-fold leaf hinged directly to Leaf 1's moving inner edge via Blum 79T8500 bi-fold hinges!
        const dxJoint = leaf1X0 - leaf1PivotX; // -leaf1W
        const dzJoint = -T_door;
        const movingJointX = leaf1PivotX + dxJoint * Math.cos(theta1) + dzJoint * Math.sin(theta1);
        const movingJointZ = leaf1PivotZ - dxJoint * Math.sin(theta1) + dzJoint * Math.cos(theta1) + doorPerimeterGap;
        const leaf2Yaw = -Math.PI / 2 + theta1 + Math.min(Math.PI * 0.72, rad * 1.25);
        leaf2 = {
          id: `${firstBay.door.id}_lcorner_return`,
          role: "door_left",
          label: "90° L-Köşe Eşlenik Katlanır Kanat (Blum 79T8500 Bi-Fold)",
          bayIndex: 0,
          dimensions: { width: leaf2W, height: doorH, depth: T_door },
          position: {
            x: movingJointX,
            y: doorY,
            z: movingJointZ - T_door,
          },
          rotation: [0, leaf2Yaw, 0],
          pivot: { x: movingJointX, y: doorY, z: movingJointZ },
          crossSectionProfile: firstBay.door.crossSectionProfile || module.carcass.crossSectionProfile,
          materialId: doorMatId,
          isFrontFacing: true,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        };
        components.push(leaf2);

        // Visible 170° Right-Upright Hinges (strictly inside x <= width - T) + 79T8500 Concealed Inner-Corner Bi-Fold Hinges (strictly inside x <= wingD, z <= wingD!)
        [doorY + 95, doorY + Math.max(160, doorH - 125)].forEach((hy, hIdx) => {
          components.push(
            {
              // "_right_" in ID ensures componentMesh sets dirSign = -1 (inward -X), never poking +36mm out through right exterior wall!
              id: `${firstBay.door.id}_lcorner_right_hinge_170_${hIdx + 1}`,
              role: "door_hinge",
              label: `Blum CLIP top 170° Sağ Köşe Menteşesi #${hIdx + 1}`,
              bayIndex: 0,
              dimensions: { width: 28, height: 64, depth: 38 },
              position: { x: leaf1PivotX - 30, y: hy - 32, z: leaf1PivotZ - 38 },
              pivot: { x: leaf1PivotX, y: hy, z: leaf1PivotZ },
              rotation: [0, theta1, 0],
              materialId: "mat_metal_chrome",
              isManufacturablePanel: false,
            },
            {
              // Positioned behind BOTH inner door faces (dx = -T_door - 22 .. -T_door - 2, dz = -T_door - 22 .. -T_door - 2) -> ZERO front seam protrusion!
              id: `${firstBay.door.id}_lcorner_bifold_hinge_${hIdx + 1}`,
              role: "special_fitting",
              label: `Blum CLIP top 79T8500 Orta Katlanır Köşe Menteşesi #${hIdx + 1}`,
              bayIndex: 0,
              dimensions: { width: 20, height: 48, depth: 20 },
              position: {
                x: movingJointX - T_door - 22,
                y: hy - 24,
                z: movingJointZ - T_door - 22,
              },
              pivot: { x: movingJointX, y: hy, z: movingJointZ },
              rotation: [0, theta1, 0],
              materialId: "mat_metal_chrome",
              isManufacturablePanel: false,
            }
          );
        });
      }

      if (isBaseHorizGola) {
        // True 90° Mitered Stationary Carcass L-Gola along BOTH X and Z front openings!
        const golaMat = firstBay.door.handleMaterialId || "mat_anodized_metal";
        components.push(
          {
            id: `${firstBay.door.id}_gola_l_corner_x`,
            role: "gola_profile",
            label: "90° L-Köşe Üst Yatay Alüminyum L-Gola (X Kolu — Gövdeye Sabit)",
            bayIndex: 0,
            dimensions: { width: Math.max(80, width - T - (wingD - 26)), height: 56, depth: 26 },
            position: { x: wingD - 26, y: height - 56, z: wingD - 26 },
            materialId: golaMat,
            isManufacturablePanel: false,
          },
          {
            id: `${firstBay.door.id}_gola_l_corner_z`,
            role: "gola_profile",
            label: "90° L-Köşe Üst Yatay Alüminyum L-Gola (Z Kolu — 45° Gönye Birleşim)",
            bayIndex: 0,
            dimensions: { width: 26, height: 56, depth: Math.max(80, depth - T - wingD) },
            position: { x: wingD - 26, y: height - 56, z: wingD },
            materialId: golaMat,
            isManufacturablePanel: false,
          }
        );
      } else if (isWallL && isHorizGolaCorner) {
        const golaMat = firstBay.door.handleMaterialId || "mat_anodized_metal";
        components.push(
          {
            id: `${firstBay.door.id}_gola_wall_corner_x`,
            role: "gola_profile",
            label: "Üst Köşe Dolap Alt Tabla Gola 268 (X Kolu)",
            bayIndex: 0,
            dimensions: { width: Math.max(80, width - T - (wingD - 26)), height: T, depth: 26 },
            position: { x: wingD - 26, y: 0, z: wingD - 26 },
            materialId: golaMat,
            isManufacturablePanel: false,
          },
          {
            id: `${firstBay.door.id}_gola_wall_corner_z`,
            role: "gola_profile",
            label: "Üst Köşe Dolap Alt Tabla Gola 268 (Z Kolu)",
            bayIndex: 0,
            dimensions: { width: 26, height: T, depth: Math.max(80, depth - T - wingD) },
            position: { x: wingD - 26, y: 0, z: wingD },
            materialId: golaMat,
            isManufacturablePanel: false,
          }
        );
      } else if (hCat !== "gola_profile" && hCat !== "j_pull" && hCat !== "handleless_plain") {
        const handleTargets = isLDouble ? [leaf1, leaf2] : isLLeftFold ? [leaf1] : [leaf2];
        handleTargets.forEach((targetLeaf) => {
          components.push(
            ...generateHandleGeometry(targetLeaf, hCat, {
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
        });
      }
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
    const isWallDiag = module.category === "kitchen_wall" || module.moduleFamilyId === "fam_kitchen_wall";
    const wingD = resolveStandardCornerWingDepthMm(width, depth, isWallDiag, isWardrobe);
    const effDiagPlinthType =
      module.carcass.plinthConstruction ||
      (module.carcass.hasAdjustableLegs === false
        ? isWardrobe
          ? "gable_rails"
          : "pedestal_box"
        : isWardrobe
        ? "pedestal_box"
        : "adjustable_legs_clip");
    const diagSideRunsToFloor =
      plinthHeight > 0 && (effDiagPlinthType === "gable_rails" || (isWardrobe && !module.carcass.plinthConstruction));
    const sideY = diagSideRunsToFloor ? 0 : plinthHeight;
    const sideH = diagSideRunsToFloor ? height : height - plinthHeight;
    const netH = Math.max(120, height - plinthHeight - 2 * T);
    const diagDx = Math.max(120, width - wingD);
    const diagDz = Math.max(120, depth - wingD);
    const diagLen = Math.round(Math.hypot(diagDx, diagDz));
    const diagAngle = Math.atan2(diagDz, diagDx);

    if (plinthHeight > 0) {
      const pSetback = 42;
      const pShift = Math.round(pSetback * 0.707);
      components.push({
        id: `${module.id}_diag_plinth`,
        role: "plinth",
        label: "45° Diyagonal Köşe Ön Baza Bandı",
        dimensions: { width: Math.max(120, diagLen), height: plinthHeight, depth: T },
        position: { x: wingD - pShift, y: 0, z: depth - pShift - T },
        rotation: [0, diagAngle, 0],
        pivot: { x: wingD - pShift, y: 0, z: depth - pShift },
        materialId: module.carcass.plinthMaterialId || doorMaterialId || bodyMaterialId,
        isFrontFacing: true,
        isManufacturablePanel: true,
        thicknessAxis: "z",
      });
      if (effDiagPlinthType === "adjustable_legs_clip") {
        [
          { id: "bl", x: 64, z: 64 },
          { id: "br", x: width - 64, z: 64 },
          { id: "rf", x: width - 64, z: Math.max(80, wingD - 56) },
          { id: "fl", x: 64, z: depth - 64 },
          { id: "fr", x: Math.max(80, wingD - 56), z: depth - 64 },
        ].forEach((lc, lIdx) => {
          components.push({
            id: `${module.id}_plastic_leg_diag_${lc.id}_${lIdx + 1}`,
            role: "special_fitting",
            label: `Häfele Axilo 78 Diyagonal Baza Ayağı #${lIdx + 1}`,
            dimensions: { width: 64, height: plinthHeight, depth: 64 },
            position: { x: lc.x - 32, y: 0, z: lc.z - 32 },
            materialId: "mat_anodized_metal",
            isManufacturablePanel: false,
          });
        });
      }
    }

    // True 5-sided pentagonal horizontal carcass panels (`_pentagon_wx<X>_wz<Z>`) so NO triangular hole exists behind the 45° door!
    const innerPentW = Math.max(200, width - 2 * T);
    const innerPentD = Math.max(200, depth - 2 * T);
    const innerWingX = Math.max(120, wingD - T);
    const innerWingZ = Math.max(120, wingD - T);

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
        label: "Diyagonal Köşe Sağ Yan Dikme (580mm)",
        dimensions: { width: T, height: sideH, depth: wingD },
        position: { x: width - T, y: sideY, z: 0 },
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        thicknessAxis: "x",
      },
      {
        id: `${module.id}_diag_side_front_return`,
        role: "carcass_side_right",
        label: "Diyagonal Köşe Ön Dönüş Dikmesi (580mm)",
        dimensions: { width: wingD - T, height: sideH, depth: T },
        position: { x: T, y: sideY, z: depth - T },
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        thicknessAxis: "z",
      },
      {
        id: `${module.id}_diag_bottom_pentagon_wx${innerWingX}_wz${innerWingZ}`,
        role: "carcass_bottom",
        label: "45° Diyagonal Tek Parça Beşgen Alt Tabla",
        dimensions: { width: innerPentW, height: T, depth: innerPentD },
        position: { x: T, y: plinthHeight, z: T },
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        thicknessAxis: "y",
      },
      {
        id: `${module.id}_diag_top_pentagon_wx${innerWingX}_wz${innerWingZ}`,
        role: "carcass_top",
        label: "45° Diyagonal Tek Parça Beşgen Üst Tabla",
        dimensions: { width: innerPentW, height: T, depth: innerPentD },
        position: { x: T, y: height - T, z: T },
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        thicknessAxis: "y",
      },
      {
        id: `${module.id}_diag_back_main`,
        role: "carcass_back",
        label: "Diyagonal Köşe Kanallı Arkalık (X Duvarı)",
        dimensions: { width: width - 2 * T + 16, height: netH + 16, depth: T_back },
        position: { x: T - 8, y: plinthHeight + T - 8, z: 8 },
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        thicknessAxis: "z",
      },
      {
        id: `${module.id}_diag_back_return`,
        role: "carcass_back",
        label: "Diyagonal Köşe Kanallı Dönüş Arkalık (Z Duvarı)",
        dimensions: { width: T_back, height: netH + 16, depth: Math.max(120, depth - 2 * T) },
        position: { x: T, y: plinthHeight + T - 8, z: T + 8 },
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        thicknessAxis: "x",
      }
    );

    const firstBay = module.bays[0];
    const rawDiagMech = firstBay?.specialFittings?.find(
      (f) =>
        !f.isHidden &&
        (f.type === "carousel_half_moon" || f.type === "corner_lemans" || f.type === "magic_corner")
    );
    const diagCornerMech =
      isWallDiag && rawDiagMech && rawDiagMech.type !== "carousel_half_moon"
        ? undefined
        : rawDiagMech;
    if (firstBay) {
      if (diagCornerMech) {
        // Exact analytical inscribed radius inside the 5-sided pentagon: 2*(T + 24 + R) + sqrt(2)*R <= width + wingD - 2*T - 28
        const maxInscribedR = Math.max(
          95,
          Math.min(
            350,
            Math.floor((Math.min(width, depth) + wingD - 4 * T - 76) / 3.42)
          )
        );
        const mechDia = maxInscribedR * 2;
        const centerC = T + 24 + maxInscribedR;
        const openSpinRad = ((doorOpenAngleDeg + drawerOpenMm * 0.25) * Math.PI) / 180;
        components.push({
          id: `${diagCornerMech.id || `${module.id}_diag_mech`}_fitting_carousel_half_moon`,
          role: "special_fitting",
          label: "Döner Karusel Diyagonal Köşe Sepeti [Häfele 542.02.210]",
          bayIndex: 0,
          dimensions: { width: mechDia, height: Math.max(260, netH - 28), depth: mechDia },
          position: { x: centerC - maxInscribedR, y: plinthHeight + T + 14, z: centerC - maxInscribedR },
          pivot: { x: centerC, y: plinthHeight + T + 14, z: centerC },
          rotation: [0, openSpinRad * 0.85, 0],
          materialId: "mat_metal_chrome",
          isManufacturablePanel: false,
        });
      } else {
        const shWing = Math.max(100, innerWingX - 18);
        firstBay.shelves.forEach((sh, sIdx) => {
          if (sh.isHidden) return;
          const clampedElevY = Math.max(32, Math.min(Math.max(64, netH - T - 24), sh.elevationY));
          const sy = plinthHeight + T + clampedElevY;
          components.push({
            id: `${sh.id || `${module.id}_diag_shelf_${sIdx}`}_pentagon_wx${shWing}_wz${shWing}`,
            role: "shelf",
            label: `45° Diyagonal Beşgen Raf #${sIdx + 1}`,
            bayIndex: 0,
            dimensions: { width: innerPentW - 14, height: T, depth: innerPentD - 14 },
            position: { x: T + 10, y: sy, z: T + 10 },
            materialId: bodyMaterialId,
            isManufacturablePanel: true,
            thicknessAxis: "y",
          });
        });
      }
    }

    if (!isWardrobe && !isWallDiag) {
      const ctopMat = module.carcass.countertopMaterialId || "mat_neolith_calacatta_luxe";
      // Seamless 1-piece pentagonal countertop with +40mm front drip overhang matching neighboring 620mm countertops!
      const ctopWing = wingD + 40;
      const ctopW = width + 20;
      const ctopD = depth + 20;
      components.push(
        {
          id: `${module.id}_diag_countertop_pentagon_wx${ctopWing}_wz${ctopWing}`,
          role: "countertop",
          label: "45° Diyagonal Tek Parça Beşgen Kuvars Tezgâh (38mm)",
          dimensions: { width: ctopW, height: 38, depth: ctopD },
          position: { x: 0, y: height, z: 0 },
          materialId: ctopMat,
          isFrontFacing: true,
          isManufacturablePanel: false,
        },
        {
          id: `${module.id}_diag_backsplash_x`,
          role: "countertop",
          label: "Diyagonal Köşe Arka Süpürgelik Çıtası (X Duvarı 45×18mm)",
          dimensions: { width, height: 45, depth: 18 },
          position: { x: 0, y: height + 38, z: 0 },
          materialId: ctopMat,
          isFrontFacing: true,
          isManufacturablePanel: false,
        },
        {
          id: `${module.id}_diag_backsplash_z`,
          role: "countertop",
          label: "Diyagonal Köşe Yan Dönüş Süpürgelik Çıtası (Z Duvarı 45×18mm)",
          dimensions: { width: 18, height: 45, depth: Math.max(80, depth - 18) },
          position: { x: 0, y: height + 38, z: 18 },
          materialId: ctopMat,
          isFrontFacing: true,
          isManufacturablePanel: false,
        }
      );
    }

    if (!module.isOpenFront && firstBay?.door && firstBay.door.type !== "open" && firstBay.door.doorSystemId !== "open") {
      const diagDoorType = firstBay.door.type;
      const diagDoorSys = firstBay.door.doorSystemId || inferDoorSystemIdFromType(diagDoorType);
      const isDiagDouble =
        diagDoorType === "double" ||
        diagDoorType === "inset_double" ||
        diagDoorSys === "hinged_double";
      const isDiagRight =
        !isDiagDouble &&
        (diagDoorType === "single_right" ||
          diagDoorType === "inset_right" ||
          diagDoorType === "half_overlay_right");
      const diagHCat = firstBay.door.handleCategory || "bar_handle";
      const isGolaDiag =
        diagHCat === "gola_profile" &&
        firstBay.door.handleProfileId !== "hnd_gola_vertical" &&
        !isWardrobe &&
        !isWallDiag;
      const doorY = plinthHeight + doorPerimeterGap;
      const doorH = Math.max(120, height - plinthHeight - 2 * doorPerimeterGap - (isGolaDiag ? 30 : 0));
      const T_door = firstBay.door.doorThicknessMm || T;
      const leafW = Math.max(180, diagLen - doorPerimeterGap * 2);
      const rad = (doorOpenAngleDeg * Math.PI) / 180;
      const doorMatId = firstBay.door.doorMaterialId || doorMaterialId;
      const diagDoorLeaves: ComponentGeometry[] = [];

      if (isDiagDouble) {
        const centerGap = Math.max(2, module.carcass.centerRevealGapMm ?? 3);
        const halfLeafW = Math.max(90, Math.round((leafW - centerGap) / 2));
        const diagLeft: ComponentGeometry = {
          id: `${firstBay.door.id}_diag45_door_left`,
          role: "door_left",
          label: "45° Diyagonal Çift Kapak Sol (+45° Blum 79B9458)",
          bayIndex: 0,
          dimensions: { width: halfLeafW, height: doorH, depth: T_door },
          position: { x: wingD, y: doorY, z: depth - T_door },
          rotation: [0, diagAngle - rad, 0],
          pivot: { x: wingD, y: doorY, z: depth },
          crossSectionProfile: firstBay.door.crossSectionProfile || module.carcass.crossSectionProfile,
          materialId: doorMatId,
          isFrontFacing: true,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        };
        const diagRight: ComponentGeometry = {
          id: `${firstBay.door.id}_diag45_door_right`,
          role: "door_right",
          label: "45° Diyagonal Çift Kapak Sağ (+45° Blum 79B9458)",
          bayIndex: 0,
          dimensions: { width: halfLeafW, height: doorH, depth: T_door },
          position: { x: width - halfLeafW, y: doorY, z: wingD - T_door },
          rotation: [0, diagAngle + rad, 0],
          pivot: { x: width, y: doorY, z: wingD },
          crossSectionProfile: firstBay.door.crossSectionProfile || module.carcass.crossSectionProfile,
          materialId: doorMatId,
          isFrontFacing: true,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        };
        diagDoorLeaves.push(diagLeft, diagRight);
        components.push(diagLeft, diagRight);
        [doorY + 95, doorY + Math.max(160, doorH - 125)].forEach((hy, hIdx) => {
          components.push(
            {
              id: `${firstBay.door.id}_diag45_hinge_left_${hIdx + 1}`,
              role: "door_hinge",
              label: `Blum CLIP top +45° Sol Köşe Menteşesi (79B9458) #${hIdx + 1}`,
              bayIndex: 0,
              dimensions: { width: 28, height: 64, depth: 38 },
              position: { x: wingD + 2, y: hy - 32, z: depth - 38 },
              pivot: { x: wingD, y: hy, z: depth },
              rotation: [0, diagAngle - rad, 0],
              materialId: "mat_metal_chrome",
              isManufacturablePanel: false,
            },
            {
              id: `${firstBay.door.id}_diag45_hinge_right_${hIdx + 1}`,
              role: "door_hinge",
              label: `Blum CLIP top +45° Sağ Köşe Menteşesi (79B9458) #${hIdx + 1}`,
              bayIndex: 0,
              dimensions: { width: 28, height: 64, depth: 38 },
              position: { x: width - 30, y: hy - 32, z: wingD - 38 },
              pivot: { x: width, y: hy, z: wingD },
              rotation: [0, diagAngle + rad, 0],
              materialId: "mat_metal_chrome",
              isManufacturablePanel: false,
            }
          );
        });
      } else if (isDiagRight) {
        const diagDoor: ComponentGeometry = {
          id: `${firstBay.door.id}_diag45_door_right`,
          role: "door_right",
          label: "45° Diyagonal Köşe Kapak Sağ (+45° Blum 79B9458 Açılı Menteşeli)",
          bayIndex: 0,
          dimensions: { width: leafW, height: doorH, depth: T_door },
          position: { x: width - leafW, y: doorY, z: wingD - T_door },
          rotation: [0, diagAngle + rad, 0],
          pivot: { x: width, y: doorY, z: wingD },
          crossSectionProfile: firstBay.door.crossSectionProfile || module.carcass.crossSectionProfile,
          materialId: doorMatId,
          isFrontFacing: true,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        };
        diagDoorLeaves.push(diagDoor);
        components.push(diagDoor);
        [doorY + 95, doorY + Math.max(160, doorH - 125)].forEach((hy, hIdx) => {
          components.push({
            id: `${firstBay.door.id}_diag45_hinge_right_${hIdx + 1}`,
            role: "door_hinge",
            label: `Blum CLIP top +45° Açılı Köşe Menteşesi (79B9458) #${hIdx + 1}`,
            bayIndex: 0,
            dimensions: { width: 28, height: 64, depth: 38 },
            position: { x: width - 30, y: hy - 32, z: wingD - 38 },
            pivot: { x: width, y: hy, z: wingD },
            rotation: [0, diagAngle + rad, 0],
            materialId: "mat_metal_chrome",
            isManufacturablePanel: false,
          });
        });
      } else {
        const diagDoor: ComponentGeometry = {
          id: `${firstBay.door.id}_diag45_door`,
          role: "door_left",
          label: "45° Diyagonal Köşe Kapak (+45° Blum 79B9458 Açılı Menteşeli)",
          bayIndex: 0,
          dimensions: { width: leafW, height: doorH, depth: T_door },
          position: { x: wingD, y: doorY, z: depth - T_door },
          rotation: [0, diagAngle - rad, 0],
          pivot: { x: wingD, y: doorY, z: depth },
          crossSectionProfile: firstBay.door.crossSectionProfile || module.carcass.crossSectionProfile,
          materialId: doorMatId,
          isFrontFacing: true,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        };
        diagDoorLeaves.push(diagDoor);
        components.push(diagDoor);

        // Visible +45° Blum CLIP top 79B9458 Angled Hinges
        [doorY + 95, doorY + Math.max(160, doorH - 125)].forEach((hy, hIdx) => {
          components.push({
            id: `${firstBay.door.id}_diag45_hinge_${hIdx + 1}`,
            role: "door_hinge",
            label: `Blum CLIP top +45° Açılı Köşe Menteşesi (79B9458) #${hIdx + 1}`,
            bayIndex: 0,
            dimensions: { width: 28, height: 64, depth: 38 },
            position: { x: wingD + 2, y: hy - 32, z: depth - 38 },
            pivot: { x: wingD, y: hy, z: depth },
            rotation: [0, diagAngle - rad, 0],
            materialId: "mat_metal_chrome",
            isManufacturablePanel: false,
          });
        });
      }

      if (isGolaDiag) {
        const golaMat = firstBay.door.handleMaterialId || "mat_anodized_metal";
        components.push({
          id: `${firstBay.door.id}_diag45_gola_top`,
          role: "gola_profile",
          label: "45° Diyagonal Üst Yatay Alüminyum L-Gola (Gövdeye Sabit)",
          bayIndex: 0,
          dimensions: { width: Math.max(140, diagLen - 8), height: 56, depth: 26 },
          position: { x: wingD + 4, y: height - 56, z: depth - 26 },
          pivot: { x: wingD + 4, y: height - 56, z: depth },
          rotation: [0, diagAngle, 0],
          materialId: golaMat,
          isManufacturablePanel: false,
        });
      } else {
        diagDoorLeaves.forEach((leafComp) => {
          components.push(
            ...generateHandleGeometry(leafComp, diagHCat, {
              moduleCategory: module.category,
              moduleElevationY: module.position.y,
              moduleHeight: module.dimensions.height,
              stationaryYawRad: diagAngle,
              handleOrientation: firstBay.door.handleOrientation,
              handleOffsetY: firstBay.door.handleOffsetY,
              handleEdgeInsetX: firstBay.door.handleEdgeInsetX,
              handleLengthMm: firstBay.door.handleLengthMm,
              handleMaterialId: firstBay.door.handleMaterialId,
              handleProfileId: firstBay.door.handleProfileId,
            })
          );
        });
      }
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
  const topT = module.carcass.topPanelThicknessMm || T;
  const hasCustomTopThick = topT !== T;
  const sideRunsToFloor = plinthHeight > 0 && effPlinthType === "gable_rails";
  const sideH = hasCustomTopThick
    ? Math.max(80, (sideRunsToFloor ? height : height - plinthHeight) - topT)
    : sideRunsToFloor
    ? Math.max(80, joineryTopology === "top_bottom_through" ? height - T : height)
    : joineryTopology === "top_bottom_through"
    ? Math.max(80, height - plinthHeight - 2 * T)
    : height - plinthHeight;
  const sideY = sideRunsToFloor
    ? 0
    : joineryTopology === "top_bottom_through" && !hasCustomTopThick
    ? plinthHeight + T
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

  const leftSideMatId = module.carcass.exposedLeftSideUseDoorMaterial ? (doorMaterialId || bodyMaterialId) : bodyMaterialId;
  const rightSideMatId = module.carcass.exposedRightSideUseDoorMaterial ? (doorMaterialId || bodyMaterialId) : bodyMaterialId;

  components.push({
    id: `${module.id}_side_left`,
    role: "carcass_side_left",
    label:
      slopedCfg && slopedCfg.mode !== "none"
        ? "Sol Yan Panel (Eğimli Tavan Kesimli)"
        : joineryTopology === "miter_45"
        ? "Sol Yan Panel (45° Gönye)"
        : module.carcass.exposedLeftSideUseDoorMaterial
        ? "Sol Yan Panel (Görünen Yan - Kapak Malzemeli)"
        : "Sol Yan Panel",
    dimensions: { width: T, height: leftSlopeH, depth },
    position: { x: explodeX > 0 ? -explodeX : 0, y: sideY, z: 0 },
    materialId: leftSideMatId,
    isFrontFacing: module.carcass.exposedLeftSideUseDoorMaterial ? true : undefined,
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
        : module.carcass.exposedRightSideUseDoorMaterial
        ? "Sağ Yan Panel (Görünen Yan - Kapak Malzemeli)"
        : "Sağ Yan Panel",
    dimensions: { width: T, height: rightSlopeH, depth },
    position: { x: width - T + explodeX, y: sideY, z: 0 },
    materialId: rightSideMatId,
    isFrontFacing: module.carcass.exposedRightSideUseDoorMaterial ? true : undefined,
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

  // 4. Bottom Panel (When sideRunsToFloor / gable_rails is active, bottom panel ALWAYS sits between floor-standing side uprights!)
  const horizPanelW =
    joineryTopology === "top_bottom_through" || joineryTopology === "miter_45" ? width : innerSpanW;
  const horizPanelX =
    joineryTopology === "top_bottom_through" || joineryTopology === "miter_45" ? 0 : T;
  const bottomPanelW = sideRunsToFloor ? innerSpanW : horizPanelW;
  const bottomPanelX = sideRunsToFloor ? T : horizPanelX;
  const hasWallBottomGola268 =
    (module.category === "kitchen_wall" || module.moduleFamilyId === "fam_kitchen_wall") &&
    module.bays.some(
      (b) =>
        b.door?.handleCategory === "gola_profile" &&
        b.door?.handleProfileId !== "hnd_gola_vertical" &&
        b.door?.handleProfileId !== "hnd_overhang_recessed_lip"
    );
  const bottomPanelDepth = hasWallBottomGola268 ? Math.max(120, depth - 26) : depth;
  components.push({
    id: `${module.id}_bottom`,
    role: "carcass_bottom",
    label: hasWallBottomGola268
      ? "Alt Panel (Gola 268 Ön 26mm Geri Çekili)"
      : joineryTopology === "miter_45" && !sideRunsToFloor
      ? "Alt Panel (45° Gönye)"
      : "Alt Panel",
    dimensions: { width: bottomPanelW, height: T, depth: bottomPanelDepth },
    position: { x: bottomPanelX, y: plinthHeight - explodeY * 0.5, z: 0 },
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

    const golaBaseDoor = doesModuleEmitTopHorizontalGola(module)
      ? module.bays.find(
          (b) =>
            b.door?.handleCategory === "gola_profile" &&
            b.door?.handleProfileId !== "hnd_gola_vertical"
        )?.door
      : undefined;
    const topGolaRecessMm = golaBaseDoor
      ? golaBaseDoor.handleProfileId === "hnd_gola_melamine_box"
        ? 38
        : golaBaseDoor.handleProfileId === "hnd_gola_moulded_box"
        ? 25
        : golaBaseDoor.handleProfileId === "hnd_bevel_30_backing"
        ? 18
        : 26
      : 0;

    const hasAnyExtDrawerForTop = module.bays.some((b) =>
      (b.drawers || []).some((d) => !d.isInternal && !d.isHidden)
    );
    const effectiveOpenFrontForTop = Boolean(module.isOpenFront) && !hasAnyExtDrawerForTop;
    const effBackTypeForStretcher = isSinkMod ? "none" : module.carcass.backPanelType || "grooved";
    const rearStretcherD =
      effBackTypeForStretcher === "grooved" && !effectiveOpenFrontForTop
        ? Math.max(stretcherW, (module.carcass.backOffsetMm ?? (isWardrobe ? 12 : 18)) + T_back + 74)
        : stretcherW;
    if (stretcherMode === "vertical_sink") {
      // Vertical Front Apron Stretcher + Rear Wall-Mounting Stretcher (since sink bases omit back panel for plumbing!)
      components.push(
        {
          id: `${module.id}_top_stretcher_front_vert`,
          role: "carcass_top",
          label: topGolaRecessMm > 0 ? `Eviye Altı Dikey Ön Alın Kaydı (Gola ${topGolaRecessMm}mm Geri Çekili)` : "Eviye Altı Dikey Ön Alın Kaydı (90mm)",
          dimensions: { width: innerSpanW, height: stretcherW, depth: T },
          position: { x: T, y: height - stretcherW + explodeY, z: Math.max(40, depth - topGolaRecessMm - T) },
          materialId: bodyMaterialId,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        },
        {
          id: `${module.id}_top_stretcher_rear_vert`,
          role: "carcass_top",
          label: "Eviye Altı Dikey Arka Bağlantı Kaydı (90mm)",
          dimensions: { width: innerSpanW, height: stretcherW, depth: T },
          position: { x: T, y: height - stretcherW + explodeY, z: 0 },
          materialId: bodyMaterialId,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        }
      );
    } else if (stretcherMode === "aluminum_reinforced") {
      // Extruded Aluminum Structural Front Rail for wide (900-1200mm) cooktop cabinets + grooved wooden rear stretcher flush at z = 0
      components.push(
        {
          id: `${module.id}_top_stretcher_front_alu`,
          role: "special_fitting",
          label: "Ocak Altı Alüminyum Mukavemet Ön Kaydı (Isı & Sehim Korumalı)",
          dimensions: { width: innerSpanW, height: 35, depth: 35 },
          position: { x: T, y: height - 35 + explodeY, z: Math.max(40, depth - topGolaRecessMm - 35) },
          materialId: "mat_anodized_metal",
          isManufacturablePanel: false,
        },
        {
          id: `${module.id}_top_stretcher_rear`,
          role: "carcass_top",
          label: `Üst Arka Bağlantı Kaydı (${rearStretcherD}mm, Arkalık Kanallı)`,
          dimensions: { width: innerSpanW, height: T, depth: rearStretcherD },
          position: { x: T, y: height - T + explodeY, z: 0 },
          materialId: bodyMaterialId,
          isManufacturablePanel: true,
          thicknessAxis: "y",
        }
      );
    } else {
      components.push(
        {
          id: `${module.id}_top_stretcher_front`,
          role: "carcass_top",
          label: topGolaRecessMm > 0 ? `Üst Ön Kayıt (Gola ${topGolaRecessMm}mm Geri Çekili)` : "Üst Ön Kayıt (90mm)",
          dimensions: { width: innerSpanW, height: T, depth: stretcherW },
          position: { x: T, y: height - T + explodeY, z: Math.max(rearStretcherD + 20, depth - topGolaRecessMm - stretcherW) },
          materialId: bodyMaterialId,
          isManufacturablePanel: true,
          thicknessAxis: "y",
        },
        {
          id: `${module.id}_top_stretcher_rear`,
          role: "carcass_top",
          label: `Üst Arka Kayıt (${rearStretcherD}mm, Arkalık Kanallı)`,
          dimensions: { width: innerSpanW, height: T, depth: rearStretcherD },
          position: { x: T, y: height - T + explodeY, z: 0 },
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
      label: hasCustomTopThick
        ? `Üst Tabla (${topT}mm Kalınlık)`
        : joineryTopology === "miter_45"
        ? "Üst Panel (45° Gönye)"
        : "Üst Panel",
      dimensions: { width: hasCustomTopThick ? width : horizPanelW, height: topT, depth },
      position: { x: hasCustomTopThick ? 0 : horizPanelX, y: height - topT + explodeY, z: 0 },
      materialId: bodyMaterialId,
      isManufacturablePanel: true,
      thicknessAxis: "y",
    });
  }

  // 5b. Taç Profili (Crown Molding / Cornice — Modern, Basamaklı, Klasik Kavisli veya LED Kanallı)
  const crownCfg = module.carcass.crownMolding;
  if (crownCfg?.enabled) {
    const crownH = Math.max(25, Math.min(200, crownCfg.heightMm || 60));
    const crownProj = Math.max(0, Math.min(120, crownCfg.projectionMm ?? 25));
    const crownMat = crownCfg.materialId || doorMaterialId;
    const crownY = height + explodeY * 1.15;
    const crownBaseThick = 18;
    const frontProjDepth = crownBaseThick + crownProj;
    const styleLabel =
      crownCfg.style === "stepped"
        ? "Basamaklı"
        : crownCfg.style === "classic_coving"
        ? "Klasik Kavisli"
        : crownCfg.style === "led_channel"
        ? "LED Kanallı"
        : "Modern Düz";

    components.push(
      {
        id: `${module.id}_crown_front`,
        role: "end_panel",
        label: `Ön Taç Profili (${styleLabel} • ${crownH}mm, 45° Gönyeli)`,
        dimensions: { width: width + crownProj * 2, height: crownH, depth: frontProjDepth },
        position: { x: -crownProj, y: crownY, z: depth - crownBaseThick },
        materialId: crownMat,
        isFrontFacing: true,
        isManufacturablePanel: true,
        thicknessAxis: "z",
      },
      {
        id: `${module.id}_crown_left`,
        role: "end_panel",
        label: `Sol Yan Taç Profili (${styleLabel} • ${crownH}mm)`,
        dimensions: { width: frontProjDepth, height: crownH, depth: Math.max(40, depth - crownBaseThick) },
        position: { x: -crownProj, y: crownY, z: 0 },
        materialId: crownMat,
        isFrontFacing: true,
        isManufacturablePanel: true,
        thicknessAxis: "x",
      },
      {
        id: `${module.id}_crown_right`,
        role: "end_panel",
        label: `Sağ Yan Taç Profili (${styleLabel} • ${crownH}mm)`,
        dimensions: { width: frontProjDepth, height: crownH, depth: Math.max(40, depth - crownBaseThick) },
        position: { x: width - crownBaseThick, y: crownY, z: 0 },
        materialId: crownMat,
        isFrontFacing: true,
        isManufacturablePanel: true,
        thicknessAxis: "x",
      }
    );

    if (crownCfg.style === "stepped" || crownCfg.style === "classic_coving") {
      const upperLipH = Math.max(14, Math.round(crownH * 0.42));
      const extraProj = crownCfg.style === "classic_coving" ? 16 : 12;
      components.push({
        id: `${module.id}_crown_upper_tier`,
        role: "end_panel",
        label: `Üst Taç Kademe Şeridi (${styleLabel})`,
        dimensions: {
          width: width + (crownProj + extraProj) * 2,
          height: upperLipH,
          depth: frontProjDepth + extraProj,
        },
        position: {
          x: -(crownProj + extraProj),
          y: crownY + (crownH - upperLipH),
          z: depth - crownBaseThick,
        },
        materialId: crownMat,
        isFrontFacing: true,
        isManufacturablePanel: false,
      });
    } else if (crownCfg.style === "led_channel") {
      components.push({
        id: `${module.id}_crown_led_strip`,
        role: "led_strip",
        label: `Taç Altı LED Aydınlatma Şeridi`,
        dimensions: { width: Math.max(40, width - 20), height: 4, depth: 8 },
        position: { x: 10, y: crownY - 2, z: depth + Math.max(4, crownProj - 10) },
        materialId: "mat_led_warm",
        isManufacturablePanel: false,
      });
    }
  }

  // 6. Back Panel — All 5 Modes Supported (Checklist #2: grooved, rebated, nailed, flush, none; auto-omitted on sink base!)
  const hasAnyExternalDrawerForBack = module.bays.some((b) =>
    (b.drawers || []).some((d) => !d.isInternal && !d.isHidden)
  );
  const effectiveOpenFrontForBack = Boolean(module.isOpenFront) && !hasAnyExternalDrawerForBack;
  const effBackType = isSinkMod && !module.carcass.backPanelType ? "none" : isSinkMod ? "none" : (module.carcass.backPanelType || "grooved");
  if (effBackType !== "none" && !effectiveOpenFrontForBack) {
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
      // 4-sided 8mm grooved back panel: seats 8mm into carcass_bottom AND 8mm into carcass_top / grooved _top_stretcher_rear!
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
    const hasHorizGolaBlind = module.bays.some(
      (b) =>
        b.door?.handleCategory === "gola_profile" &&
        b.door?.handleProfileId !== "hnd_gola_vertical"
    );
    const blindFrontY = plinthHeight + doorPerimeterGap;
    const blindFrontH = Math.max(
      120,
      height - plinthHeight - 2 * doorPerimeterGap - (hasHorizGolaBlind && height <= 1200 ? 30 : 0)
    );
    components.push(
      {
        id: `${module.id}_blind_center_post`,
        role: "carcass_divider",
        label: "Kör Köşe Orta Taşıyıcı Dikme (Menteşe Karşılığı)",
        dimensions: { width: T, height: netInnerH, depth: 72 },
        position: { x: T + blindW - T, y: plinthHeight + T, z: depth - 72 - (hasHorizGolaBlind ? 26 : 0) },
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        thicknessAxis: "x",
      },
      {
        id: `${module.id}_blind_panel`,
        role: "wall_filler",
        label: "Kör Köşe Ön Sabit Kapama Paneli",
        dimensions: { width: T + blindW - 2, height: blindFrontH, depth: T },
        position: { x: 2, y: blindFrontY, z: depth },
        materialId: doorMaterialId || bodyMaterialId,
        isFrontFacing: true,
        isManufacturablePanel: true,
        thicknessAxis: "z",
      },
      {
        id: `${module.id}_corner_filler`,
        role: "wall_filler",
        label: "90° L-Kör Köşe Klapa Ön Alın Bandı (65mm)",
        dimensions: { width: 65, height: blindFrontH, depth: T },
        position: { x: T + blindW - 65, y: blindFrontY, z: depth + T },
        materialId: doorMaterialId || bodyMaterialId,
        isFrontFacing: true,
        isManufacturablePanel: true,
        thicknessAxis: "z",
      },
      {
        id: `${module.id}_corner_filler_return`,
        role: "wall_filler",
        label: "90° L-Kör Köşe Dönüş Klapa Kanadı (55mm Kulp Kurtarma Payı)",
        dimensions: { width: T, height: blindFrontH, depth: 55 },
        position: { x: T + blindW - 65, y: blindFrontY, z: depth + T },
        materialId: doorMaterialId || bodyMaterialId,
        isFrontFacing: true,
        isManufacturablePanel: true,
        thicknessAxis: "x",
      }
    );
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
    String(module.moduleFamilyId) === "fam_base" ||
    (String(module.moduleFamilyId) === "fam_corner" && height <= 1150) ||
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

  const slidingLeafStateMap = new Map<
    number,
    {
      bayIdx: number;
      mountKind: SlidingMountingType;
      isFrontTrack: boolean;
      effDoorW: number;
      currentX: number;
      minX: number;
      maxX: number;
      popZ: number;
    }
  >();

  const hasAnySlidingBay =
    !module.isOpenFront &&
    module.bays.some((b) => {
      const ds = b.door?.doorSystemId || inferDoorSystemIdFromType(b.door?.type || "open");
      return (
        b.door &&
        b.door.type !== "open" &&
        ds !== "open" &&
        (ds.startsWith("sliding") || b.door.type === "sliding" || b.door.type === "sliding_bottom")
      );
    });

  if (hasAnySlidingBay) {
    const totalBays = Math.max(1, module.bays.length);
    const slideOpenRatio = Math.min(1, Math.max(0, doorOpenAngleDeg / 75));
    const foundPulloutIdx = module.bays.findIndex(
      (b) =>
        b.drawers.some((d) => !d.isHidden) ||
        (b.specialFittings || []).some(
          (f) =>
            !f.isHidden &&
            (f.type === "trouser_rack" ||
              f.type === "wire_basket" ||
              f.type === "jewelry_tray" ||
              f.type === "shoe_rack")
        )
    );
    const primaryPulloutBayIdx =
      foundPulloutIdx >= 0
        ? foundPulloutIdx
        : totalBays >= 3
        ? 1
        : Math.max(0, totalBays - 1);

    module.bays.forEach((sBay, bIdx) => {
      if (!sBay.door || sBay.door.type === "open" || sBay.door.doorSystemId === "open") return;
      const dType = sBay.door.type;
      const dSys = sBay.door.doorSystemId || inferDoorSystemIdFromType(dType);
      if (!dSys.startsWith("sliding") && dType !== "sliding" && dType !== "sliding_bottom") {
        return;
      }

      const mountKind: SlidingMountingType =
        sBay.door.slidingMountingType ||
        (dSys === "sliding_bottom_rolling" || dType === "sliding_bottom"
          ? "inset_inside"
          : dSys === "sliding_coplanar"
          ? "coplanar_flush"
          : "top_hung_pelmet");

      let effDoorW = 0;
      let maxLeft = 0;
      let maxRight = 0;
      let baseClosedX = 0;

      if (mountKind === "inset_inside") {
        const innerClearSpanW = Math.max(240, width - 2 * T);
        const overlapMm = totalBays > 1 ? 22 : 0;
        effDoorW = Math.round((innerClearSpanW + overlapMm * (totalBays - 1)) / totalBays);
        maxLeft = T;
        maxRight = Math.max(T, width - T - effDoorW);
        baseClosedX = Math.round(
          T + bIdx * ((innerClearSpanW - effDoorW) / Math.max(1, totalBays - 1))
        );
      } else if (mountKind === "coplanar_flush") {
        const leafSpecS = fourSpace.doorLeaves[bIdx];
        effDoorW = leafSpecS?.leafWidthMm || Math.round(width / totalBays);
        maxLeft = 0;
        maxRight = Math.max(0, width - effDoorW);
        baseClosedX = Math.max(
          maxLeft,
          Math.min(maxRight, leafSpecS?.doorX0Mm ?? bIdx * effDoorW)
        );
      } else {
        const overlapMm = totalBays > 1 ? 26 : 0;
        effDoorW = Math.round((width + overlapMm * (totalBays - 1)) / totalBays);
        maxLeft = 0;
        maxRight = Math.max(0, width - effDoorW);
        baseClosedX = Math.round(
          bIdx * ((width - effDoorW) / Math.max(1, totalBays - 1))
        );
      }

      const isFrontTrack =
        totalBays === 1
          ? true
          : totalBays === 2
          ? bIdx === 1
          : bIdx > 0 && bIdx < totalBays - 1
          ? bIdx % 2 === 1
          : false;

      let targetOpenX = baseClosedX;
      if (totalBays === 2) {
        if (primaryPulloutBayIdx === 0) {
          targetOpenX = maxRight;
        } else {
          targetOpenX = maxLeft;
        }
      } else if (totalBays === 3) {
        if (primaryPulloutBayIdx === 1) {
          targetOpenX = bIdx === 0 ? maxLeft : bIdx === 2 ? maxRight : maxLeft;
        } else if (primaryPulloutBayIdx === 2) {
          targetOpenX =
            bIdx === 0
              ? maxLeft
              : bIdx === 1
              ? maxLeft
              : Math.min(baseClosedX, maxLeft + effDoorW + 4);
        } else {
          targetOpenX =
            bIdx === 2
              ? maxRight
              : bIdx === 1
              ? maxRight
              : Math.max(baseClosedX, maxRight - effDoorW - 4);
        }
      } else if (totalBays >= 4) {
        targetOpenX =
          bIdx === primaryPulloutBayIdx
            ? primaryPulloutBayIdx < totalBays / 2
              ? maxRight
              : maxLeft
            : baseClosedX;
      }

      let popZ = 0;
      let currentX = baseClosedX;
      if (mountKind === "coplanar_flush") {
        const popProgress = Math.min(1, slideOpenRatio * 3.5);
        const slideProgress = Math.max(0, (slideOpenRatio - 0.22) / 0.78);
        const isMovingLeaf = Math.abs(targetOpenX - baseClosedX) > 1;
        popZ = isMovingLeaf ? popProgress * 48 : 0;
        currentX = Math.max(
          maxLeft,
          Math.min(maxRight, Math.round(baseClosedX + (targetOpenX - baseClosedX) * slideProgress))
        );
      } else {
        currentX = Math.max(
          maxLeft,
          Math.min(maxRight, Math.round(baseClosedX + (targetOpenX - baseClosedX) * slideOpenRatio))
        );
      }

      slidingLeafStateMap.set(bIdx, {
        bayIdx: bIdx,
        mountKind,
        isFrontTrack,
        effDoorW,
        currentX,
        minX: currentX,
        maxX: currentX + effDoorW,
        popZ,
      });
    });
  }

  const frontCarcassMetaMap = new Map<
    string,
    {
      bayStartX: number;
      bayW: number;
      closedZ0: number;
      closedY0: number;
      closedH: number;
      nextUpperDrawerBottomY?: number;
      isTopAtCabinetCeiling?: boolean;
      emitTopLGola?: boolean;
      emitIntermediateCGola?: boolean;
    }
  >();

  module.bays.forEach((bay, bayIdx) => {
    const bayW = bayWidths[bayIdx] || 0;
    const bayStartX = currentX;

    // Intermediate Divider
    if (bayIdx < module.bays.length - 1) {
      const dividerX = bayStartX + bayW;
      const hasVertGolaOnDiv = module.bays.some((b) => b.door?.handleProfileId === "hnd_gola_vertical");
      components.push({
        id: `${module.id}_divider_${bayIdx}`,
        role: "carcass_divider",
        label: `Ara Dikme ${bayIdx + 1}`,
        bayIndex: bayIdx,
        dimensions: { width: T, height: netInnerH, depth: hasVertGolaOnDiv ? Math.max(120, netInnerD - 26) : netInnerD },
        position: { x: dividerX, y: plinthHeight + T, z: 20 },
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        thicknessAxis: "x",
      });
    }

    // Compute drawer stack ceiling across ALL drawers so full-height drawer banks never get a stray mid-shelf or LED inside upper drawers!
    const allVisibleDrawersInBay = bay.drawers.filter((d) => !d.isHidden);
    const allExtDrawersInBay = allVisibleDrawersInBay.filter((d) => !d.isInternal);
    const extDrawerTopLocalY =
      allExtDrawersInBay.length > 0
        ? Math.max(...allExtDrawersInBay.map((d) => d.elevationY + d.height)) + T
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

    // Unified Single-Channel Architectural Recessed LED Profiles (Covers upper, middle & lower zones outside external drawers!)
    if (moduleHasVertLed) {
      const ledZ = Math.max(28, Math.round(depth - vertFrontSetback - ledChanWidth / 2));
      const topJoinOffset = moduleHasHorizLed && ledAligned ? 2 : 6;
      const sortedExtForLed = [...allExtDrawersInBay].sort((a, b) => a.elevationY - b.elevationY);
      const ledSegments: Array<{ botLocal: number; topLocal: number; tag: string }> = [];
      if (sortedExtForLed.length === 0) {
        ledSegments.push({ botLocal: 4, topLocal: netInnerH - topJoinOffset, tag: "" });
      } else {
        let cursorY = 4;
        sortedExtForLed.forEach((drw, sIdx) => {
          const drwBot = Math.max(0, drw.elevationY - 4);
          if (drwBot - cursorY >= 120) {
            ledSegments.push({ botLocal: cursorY, topLocal: drwBot, tag: `_seg${sIdx}` });
          }
          cursorY = Math.max(cursorY, drw.elevationY + drw.height + T + 4);
        });
        if (netInnerH - topJoinOffset - cursorY >= 120) {
          ledSegments.push({
            botLocal: cursorY,
            topLocal: netInnerH - topJoinOffset,
            tag: "",
          });
        }
      }

      ledSegments.forEach((seg) => {
        const vLedH = Math.round(seg.topLocal - seg.botLocal);
        if (vLedH < 120) return;
        const vStartY = plinthHeight + T + seg.botLocal;
        components.push(
          {
            id: `${module.id}_bay_${bayIdx}_recessed_led_vert_left${seg.tag}`,
            role: "special_fitting",
            label: `B${bayIdx + 1} Sol Dikme Gömme LED ${ledKelvinVal}K (${ledChanWidth}×${ledChanRouteDepth}mm, Önden ${vertFrontSetback}mm)`,
            bayIndex: bayIdx,
            dimensions: { width: flushStepMm, height: vLedH, depth: ledChanWidth },
            position: { x: bayStartX + 0.25, y: vStartY, z: ledZ },
            materialId: ledMatId,
            isManufacturablePanel: false,
          },
          {
            id: `${module.id}_bay_${bayIdx}_recessed_led_vert_right${seg.tag}`,
            role: "special_fitting",
            label: `B${bayIdx + 1} Sağ Dikme Gömme LED ${ledKelvinVal}K (${ledChanWidth}×${ledChanRouteDepth}mm, Önden ${vertFrontSetback}mm)`,
            bayIndex: bayIdx,
            dimensions: { width: flushStepMm, height: vLedH, depth: ledChanWidth },
            position: { x: bayStartX + bayW - flushStepMm - 0.25, y: vStartY, z: ledZ },
            materialId: ledMatId,
            isManufacturablePanel: false,
          }
        );
      });
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
      const isFixedSh = shelf.isAdjustable === false || shelf.isFixed === true;
      const fixedConnLabel = shelf.fixedConnectorType === "rafix_20" ? "Rafix 20" : "Minifix";
      const frontSetback = shelf.frontSetbackMm ?? (moduleHasVertLed ? 26 : isFixedSh ? 4 : 15);
      const effShelfD = Math.max(100, netInnerD - rearChimneyMm - frontSetback);
      const effShelfW = Math.max(80, bayW - pocketClearOffset - (isFixedSh ? 0 : 4));
      const shelfIdResolved = shelf.id || `${module.id}_bay_${bayIdx}_shelf_${sIdx}`;
      const shelfY =
        plinthHeight + T + Math.max(24, Math.min(Math.max(48, netInnerH - shelfT - 16), shelf.elevationY));
      const shelfX = bayStartX + pocketClearOffset + (isFixedSh ? 0 : 2);
      components.push({
        id: shelfIdResolved,
        role: "shelf",
        label: `Raf B${bayIdx + 1}-${sIdx + 1} (${isFixedSh ? `Sabit · ${fixedConnLabel}` : "Hareketli"}${rearChimneyMm > 0 ? ", 50mm Baca Boşluklu" : ""})`,
        bayIndex: bayIdx,
        dimensions: { width: effShelfW, height: shelfT, depth: effShelfD },
        position: {
          x: shelfX,
          y: shelfY,
          z: shelfRearZ,
        },
        materialId: shelf.isGlass ? "mat_smoked_glass" : bodyMaterialId,
        isManufacturablePanel: !shelf.isGlass,
        thicknessAxis: "y",
      });

      // 3D Hardware Visuals: System-32 Ø5mm Steel Spoon Pins under Movable Shelves vs Recessed Cam Housings under Fixed Shelves
      if (effShelfD >= 140 && effShelfW >= 120) {
        const zFrontPin = shelfRearZ + Math.max(32, effShelfD - 37);
        const zRearPin = shelfRearZ + 37;
        if (!isFixedSh) {
          [zRearPin, zFrontPin].forEach((pz, pIdx) => {
            components.push(
              {
                id: `${shelfIdResolved}_pin_L_${pIdx}`,
                role: "special_fitting",
                label: "Kilitli Çelik Raf Pimi Ø5mm (Sol)",
                bayIndex: bayIdx,
                dimensions: { width: 8, height: 6, depth: 12 },
                position: { x: bayStartX + pocketClearOffset, y: shelfY - 6, z: pz - 6 },
                materialId: "mat_metal_chrome",
                isManufacturablePanel: false,
              },
              {
                id: `${shelfIdResolved}_pin_R_${pIdx}`,
                role: "special_fitting",
                label: "Kilitli Çelik Raf Pimi Ø5mm (Sağ)",
                bayIndex: bayIdx,
                dimensions: { width: 8, height: 6, depth: 12 },
                position: {
                  x: bayStartX + bayW - 8,
                  y: shelfY - 6,
                  z: pz - 6,
                },
                materialId: "mat_metal_chrome",
                isManufacturablePanel: false,
              }
            );
          });
        } else if (!shelf.isGlass) {
          const camDiam = shelf.fixedConnectorType === "rafix_20" ? 20 : 15;
          const camInsetX = shelf.fixedConnectorType === "rafix_20" ? 2 : 26;
          [zRearPin, zFrontPin].forEach((cz, cIdx) => {
            components.push(
              {
                id: `${shelfIdResolved}_cam_L_${cIdx}`,
                role: "special_fitting",
                label: `${fixedConnLabel} Sabit Raf Kilit Gövdesi (Sol)`,
                bayIndex: bayIdx,
                dimensions: { width: camDiam, height: 2, depth: camDiam },
                position: {
                  x: shelfX + camInsetX,
                  y: shelfY - 1.5,
                  z: cz - camDiam * 0.5,
                },
                primitive: "cylinder",
                materialId: "mat_anodized_metal",
                isManufacturablePanel: false,
              },
              {
                id: `${shelfIdResolved}_cam_R_${cIdx}`,
                role: "special_fitting",
                label: `${fixedConnLabel} Sabit Raf Kilit Gövdesi (Sağ)`,
                bayIndex: bayIdx,
                dimensions: { width: camDiam, height: 2, depth: camDiam },
                position: {
                  x: shelfX + effShelfW - camInsetX - camDiam,
                  y: shelfY - 1.5,
                  z: cz - camDiam * 0.5,
                },
                primitive: "cylinder",
                materialId: "mat_anodized_metal",
                isManufacturablePanel: false,
              }
            );
          });
        }
      }
    });

    // Mandatory fixed shelf directly above drawer stack ONLY when open upper bay space genuinely exists above ALL drawers!
    if (allVisibleDrawersInBay.length > 0) {
      const maxDrawerTopEle = Math.max(...allVisibleDrawersInBay.map((d) => d.elevationY + d.height));
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
      const railY = plinthHeight + T + Math.max(48, Math.min(Math.max(80, netInnerH - 36), rail.elevationY));
      if (rail.profileType === "lift_pantograph") {
        const liftH = Math.min(820, Math.max(360, railY - (plinthHeight + T) - 40));
        components.push({
          id: `${rail.id || `${module.id}_bay_${bayIdx}_rail_${rIdx}`}_fitting_wardrobe_lift`,
          role: "special_fitting",
          label: `Servetto Asansörlü Pantograf B${bayIdx + 1}-${rIdx + 1}`,
          bayIndex: bayIdx,
          dimensions: { width: Math.max(80, bayW - 4), height: liftH, depth: Math.max(120, netInnerD - 28) },
          position: { x: bayStartX + 2, y: Math.max(plinthHeight + T + 20, railY - liftH + 22), z: 24 },
          materialId: "mat_metal_chrome",
          isManufacturablePanel: false,
        });
        return;
      }
      components.push({
        id: rail.id || `${module.id}_bay_${bayIdx}_rail_${rIdx}`,
        role: "hanging_rail",
        label: `Askı Borusu B${bayIdx + 1}-${rIdx + 1}`,
        bayIndex: bayIdx,
        dimensions: { width: bayW, height: 25, depth: 25 },
        position: { x: bayStartX, y: railY, z: depth / 2 - 12 },
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
      corner_lemans: "Kesseböhmer LeMans II Kör Köşe Fasulye [541.32.240]",
      magic_corner: "Kesseböhmer Magic Corner Çift Kademe Kör Köşe [548.10.220]",
      carousel_half_moon: "Häfele 270° 3/4 Döner Karusel Sepet [542.02.210]",
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

      // Detailed 3D mechanical geometry is rendered cleanly by componentMesh.ts (_fitting_trouser_rack, _fitting_wire_basket, etc.)
      if (fit.type === "wardrobe_lift") {
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
      } else if (
        fit.type === "corner_lemans" ||
        fit.type === "magic_corner" ||
        fit.type === "carousel_half_moon"
      ) {
        // Live kinematic swing-out / pull-out when door opens past 25° or drawer slider pulls!
        const doorProgress = doorOpenAngleDeg > 25 ? Math.min(1, (doorOpenAngleDeg - 25) / 60) : 0;
        const pullProgress = Math.max(doorProgress, Math.min(1, drawerOpenMm / 300));
        const mainFitComp = components[components.length - 1];
        if (mainFitComp && mainFitComp.id === `${baseId}_fitting_${fit.type}`) {
          mainFitComp.dimensions.height = Math.max(420, netInnerH - 28);
          mainFitComp.position.y = plinthHeight + T + 14;
          if (fit.type === "corner_lemans") {
            // Pivot around the center blind-corner post so kidney trays swing OUT through the right door opening!
            const poleX = fitX + Math.round(fitW * 0.46);
            const poleZ = fitZ + Math.round(fitD * 0.68);
            mainFitComp.position.x = fitX + Math.round(pullProgress * fitW * 0.16);
            mainFitComp.position.z = fitZ + Math.round(pullProgress * (fitD * 0.52));
            mainFitComp.pivot = {
              x: poleX + Math.round(pullProgress * fitW * 0.16),
              y: mainFitComp.position.y,
              z: poleZ + Math.round(pullProgress * (fitD * 0.52)),
            };
            mainFitComp.rotation = [0, -pullProgress * 0.62, 0];
          } else if (fit.type === "magic_corner") {
            // Front carrier frame pulls straight out of the right-hand access opening (+Z) while rear baskets slide right!
            mainFitComp.position.x = fitX + Math.round(pullProgress * fitW * 0.18);
            mainFitComp.position.z = fitZ + Math.round(pullProgress * (fitD * 0.64));
          } else {
            mainFitComp.pivot = {
              x: fitX + fitW / 2,
              y: mainFitComp.position.y,
              z: fitZ + fitD / 2,
            };
            mainFitComp.rotation = [0, pullProgress * 1.45, 0];
          }
        }
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
    const bayDoorSysForDrw = bay.door?.doorSystemId || "";
    const isFullHeightTrackDoor = Boolean(
      bayDoorSysForDrw.startsWith("sliding") ||
        bay.door?.type === "sliding" ||
        bay.door?.type === "sliding_bottom" ||
        bay.door?.type === "pocket" ||
        bay.door?.type === "tambour" ||
        bayDoorSysForDrw === "pocket_retractable" ||
        bayDoorSysForDrw === "tambour_roller"
    );
    const hasNoUpperDoor =
      Boolean(module.isOpenFront) ||
      !bay.door ||
      bay.door.type === "open" ||
      bay.door.doorSystemId === "open";
    const sortedExtDrawersInBay = [...bay.drawers]
      .filter((d) => !d.isInternal && !d.isHidden && !isFullHeightTrackDoor)
      .sort((a, b) => a.elevationY - b.elevationY);
    const modFloorWorldYMm = module.position?.y || 0;
    const topExtDrawerInBay =
      sortedExtDrawersInBay.length > 0
        ? sortedExtDrawersInBay[sortedExtDrawersInBay.length - 1]
        : undefined;
    const bayStackTopReachesCeiling = Boolean(
      topExtDrawerInBay &&
        bayLeafSpec?.overlayType !== "inset" &&
        (topExtDrawerInBay.elevationY >= netInnerH * 0.55 ||
          (hasNoUpperDoor &&
            topExtDrawerInBay.elevationY + topExtDrawerInBay.height >= netInnerH * 0.7))
    );
    const bayErgonomicGolaPlan = resolveErgonomicGolaDrawerPlan({
      bottomWorldYsMm: sortedExtDrawersInBay.map(
        (d) => modFloorWorldYMm + plinthHeight + T + d.elevationY
      ),
      topWorldYsMm: sortedExtDrawersInBay.map(
        (d) => modFloorWorldYMm + plinthHeight + T + d.elevationY + d.height
      ),
      moduleFloorWorldYMm: modFloorWorldYMm,
      plinthHeightMm: plinthHeight,
      topReachesCeiling: bayStackTopReachesCeiling,
    });
    const bayBlindPlan = resolveInternalDrawerHingeClearance(module, bay);
    if (
      bayBlindPlan.solution === "blind_panel_filler" &&
      (bayBlindPlan.hasLeftBlindFiller || bayBlindPlan.hasRightBlindFiller) &&
      bayBlindPlan.blockHeightMm >= 80
    ) {
      const blindBackZ =
        effBackType === "grooved" && !module.isOpenFront
          ? (module.carcass.backOffsetMm ?? (isWardrobe ? 12 : 18)) + T_back
          : effBackType === "flush"
          ? Math.max(18, T_back)
          : 0;
      const blindFrontZ0 = Math.max(
        blindBackZ + 120,
        depth - T - 24 - bayBlindPlan.blindSetbackFromFrontMm
      );
      const blindDividerD = Math.max(120, blindFrontZ0 - blindBackZ);
      const blindWorldY0 = plinthHeight + T + bayBlindPlan.blockBottomInnerYMm;
      const blindH = bayBlindPlan.blockHeightMm;
      const blindW = bayBlindPlan.blindWidthMm;

      if (bayBlindPlan.hasLeftBlindFiller) {
        components.push({
          id: `${module.id}_bay${bayIdx}_blind_divider_left`,
          role: "carcass_sub_divider",
          label: `İç Çekmece Sol Kör Dikme (${T}mm) B${bayIdx + 1}`,
          bayIndex: bayIdx,
          dimensions: { width: T, height: blindH, depth: blindDividerD },
          position: { x: bayStartX + blindW - T, y: blindWorldY0, z: blindBackZ },
          materialId: bodyMaterialId,
          isManufacturablePanel: true,
          thicknessAxis: "x",
        });
        components.push({
          id: `${module.id}_bay${bayIdx}_blind_front_left`,
          role: "carcass_sub_divider",
          label: `İç Çekmece Sol Ön Kör Kapama (${blindW}mm) B${bayIdx + 1}`,
          bayIndex: bayIdx,
          dimensions: { width: blindW, height: blindH, depth: T },
          position: { x: bayStartX, y: blindWorldY0, z: blindFrontZ0 },
          materialId: bodyMaterialId,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        });
      }
      if (bayBlindPlan.hasRightBlindFiller) {
        components.push({
          id: `${module.id}_bay${bayIdx}_blind_divider_right`,
          role: "carcass_sub_divider",
          label: `İç Çekmece Sağ Kör Dikme (${T}mm) B${bayIdx + 1}`,
          bayIndex: bayIdx,
          dimensions: { width: T, height: blindH, depth: blindDividerD },
          position: { x: bayStartX + bayW - blindW, y: blindWorldY0, z: blindBackZ },
          materialId: bodyMaterialId,
          isManufacturablePanel: true,
          thicknessAxis: "x",
        });
        components.push({
          id: `${module.id}_bay${bayIdx}_blind_front_right`,
          role: "carcass_sub_divider",
          label: `İç Çekmece Sağ Ön Kör Kapama (${blindW}mm) B${bayIdx + 1}`,
          bayIndex: bayIdx,
          dimensions: { width: blindW, height: blindH, depth: T },
          position: { x: bayStartX + bayW - blindW, y: blindWorldY0, z: blindFrontZ0 },
          materialId: bodyMaterialId,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        });
      }
    }

    bay.drawers.forEach((drawer, dIdx) => {
      const isExtDrawer = !drawer.isInternal && !isFullHeightTrackDoor;
      const isExtOverlay = isExtDrawer && bayLeafSpec?.overlayType !== "inset";
      const isLowestExtDrawer = isExtOverlay && drawer.elevationY <= 5;
      const isHighestDrawerInBay = !bay.drawers.some(
        (other) => other.id !== drawer.id && other.elevationY > drawer.elevationY
      );
      const gapAboveDrawerMm = netInnerH - (drawer.elevationY + drawer.height);
      const isTopComboExtDrawer = isExtOverlay && gapAboveDrawerMm <= 36;
      const isTopAtCabinetCeiling =
        isExtOverlay &&
        isHighestDrawerInBay &&
        gapAboveDrawerMm <= 36;
      const extraCoverMm =
        isLowestExtDrawer || isTopComboExtDrawer ? Math.max(0, T - doorPerimeterGap) : 0;
      const drawerY0 = plinthHeight + T + drawer.elevationY;
      const frontX = isExtDrawer ? (bayLeafSpec?.doorX0Mm ?? bayStartX + 2) : bayStartX + 2;
      const frontY = isLowestExtDrawer ? plinthHeight + doorPerimeterGap : drawerY0 + 1.5;
      const isHorizGolaBay =
        bay.door?.handleCategory === "gola_profile" &&
        bay.door?.handleProfileId !== "hnd_gola_vertical" &&
        bay.door?.handleProfileId !== "hnd_overhang_recessed_lip";
      const cabinetTopAlignY =
        height -
        doorPerimeterGap -
        (isHorizGolaBay && bayErgonomicGolaPlan.emitTopLGola ? 30 : 0);
      const frontH = isTopAtCabinetCeiling
        ? Math.max(40, cabinetTopAlignY - frontY)
        : isLowestExtDrawer
        ? Math.max(40, drawerY0 + drawer.height - 1.5 - frontY)
        : Math.max(40, drawer.height + extraCoverMm - 3);
      const frontW = isExtDrawer
        ? Math.max(60, bayLeafSpec?.fullDoorSpanWidthMm || bayW - 4)
        : Math.max(60, bayW - 4);
      let pulledZ = drawerOpenMm;
      if (!isExtDrawer) {
        if (slidingLeafStateMap.size > 0 || isFullHeightTrackDoor) {
          const drwMinX = bayStartX + 2;
          const drwMaxX = bayStartX + bayW - 2;
          const blockedBySlidingLeaf = Array.from(slidingLeafStateMap.values()).some(
            (lf) => lf.minX < drwMaxX - 2 && lf.maxX > drwMinX + 2
          );
          const blockedByPocketOrTambour =
            (bay.door?.type === "pocket" ||
              bay.door?.type === "tambour" ||
              bayDoorSysForDrw === "pocket_retractable" ||
              bayDoorSysForDrw === "tambour_roller") &&
            doorOpenAngleDeg < 65;
          pulledZ = blockedBySlidingLeaf || blockedByPocketOrTambour ? 0 : drawerOpenMm;
        } else if (!hasNoUpperDoor) {
          pulledZ =
            doorOpenAngleDeg < 60
              ? 0
              : Math.round(drawerOpenMm * Math.min(1, (doorOpenAngleDeg - 60) / 15));
        }
      }
      const drawerDoorLeafT = bayLeafSpec?.leafThicknessMm || bay.door?.doorThicknessMm || module.carcass.doorThickness || 18;
      const trackRecessMm =
        isFullHeightTrackDoor &&
        (bay.door?.slidingMountingType === "inset_inside" || bay.door?.type === "sliding_bottom")
          ? 2 * drawerDoorLeafT + 22
          : 24;
      const frontZ = isExtDrawer
        ? (bayLeafSpec?.doorZ0Mm ?? depth) + pulledZ + explodeZ
        : depth - T + pulledZ + explodeZ - trackRecessMm;
      const hwId = drawer.hardwareProductId || "";
      const boxSys =
        drawer.boxSystemType ||
        module.carcass.drawerBoxSystem ||
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

      // Internal drawer behind hinged door: deduct blind-panel filler or legacy 25mm spacer
      const spacerLeftMm = drawer.isInternal ? bayBlindPlan.leftDeductionMm : 0;
      const spacerRightMm = drawer.isInternal ? bayBlindPlan.rightDeductionMm : 0;
      const effCellW = Math.max(100, bayW - spacerLeftMm - spacerRightMm);
      const effCellStartX = bayStartX + spacerLeftMm;
      const emitLegacy25mmSpacer =
        Boolean(drawer.isInternal) && bayBlindPlan.solution === "spacer_block_25mm";

      if (emitLegacy25mmSpacer && spacerLeftMm > 0) {
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
      if (emitLegacy25mmSpacer && spacerRightMm > 0) {
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

      // Horizontal L + C Gola pairing across stacked external drawers:
      // Top drawer gets L-Gola (30mm top deduction); paired lower drawers get 32mm C-Gola; unpaired middle seams keep crisp 3mm fuga!
      const isGolaDrawer =
        isExtDrawer &&
        bay.door?.handleCategory === "gola_profile" &&
        bay.door?.handleProfileId !== "hnd_gola_vertical" &&
        bay.door?.handleProfileId !== "hnd_overhang_recessed_lip";
      const isBevel30BackingDrawer =
        isExtDrawer && bay.door?.handleProfileId === "hnd_bevel_30_backing";
      const isWoodGolaBoxDrawer =
        isExtDrawer &&
        (bay.door?.handleProfileId === "hnd_gola_melamine_box" ||
          bay.door?.handleProfileId === "hnd_gola_moulded_box");
      const isJPullBayDrawer =
        isExtDrawer &&
        (bay.door?.handleCategory === "j_pull" ||
          bay.door?.handleProfileId === "hnd_j_pull" ||
          bay.door?.crossSectionProfile === "j_pull_bevel");
      const extSortIdx = isExtDrawer
        ? sortedExtDrawersInBay.findIndex((ed) => ed.id === drawer.id)
        : -1;
      const hasUpperLGola =
        isGolaDrawer && isTopAtCabinetCeiling && bayErgonomicGolaPlan.emitTopLGola;
      const hasUpperCGola =
        isGolaDrawer &&
        extSortIdx >= 0 &&
        Boolean(bayErgonomicGolaPlan.cGolaAbove[extSortIdx]);
      const hasLowerHingedDoorUnderDrawer =
        isGolaDrawer &&
        extSortIdx === 0 &&
        !hasNoUpperDoor &&
        !isDoorZoneOpen(bay.door, "lower") &&
        drawer.elevationY >= 150;
      const hasLowerCGola =
        isGolaDrawer &&
        ((extSortIdx > 0 && Boolean(bayErgonomicGolaPlan.cGolaAbove[extSortIdx - 1])) ||
          hasLowerHingedDoorUnderDrawer);
      const nextUpperExtDrawer =
        extSortIdx >= 0 && extSortIdx < sortedExtDrawersInBay.length - 1
          ? sortedExtDrawersInBay[extSortIdx + 1]
          : undefined;
      const nextUpperFrontBottomY = nextUpperExtDrawer
        ? plinthHeight + T + nextUpperExtDrawer.elevationY + 1.5
        : !isTopAtCabinetCeiling && bayLeafSpec && bayLeafSpec.baseDoorHeightMm > 0
        ? bayLeafSpec.doorY0Mm
        : undefined;
      const rawGapToUpper =
        nextUpperFrontBottomY !== undefined ? nextUpperFrontBottomY - (frontY + frontH) : undefined;
      const shouldNormalizeAdjacentFuga =
        !isGolaDrawer &&
        !isTopAtCabinetCeiling &&
        rawGapToUpper !== undefined &&
        rawGapToUpper > 0.5 &&
        rawGapToUpper <= 12;
      const interDrawerGolaGapMm = isBevel30BackingDrawer || isWoodGolaBoxDrawer ? 30 : 32;
      const effFrontH =
        isGolaDrawer && !isTopAtCabinetCeiling
          ? hasUpperCGola
            ? nextUpperFrontBottomY !== undefined
              ? Math.max(40, nextUpperFrontBottomY - interDrawerGolaGapMm - frontY)
              : Math.max(40, frontH - interDrawerGolaGapMm)
            : nextUpperFrontBottomY !== undefined
            ? Math.max(40, nextUpperFrontBottomY - 3 - frontY)
            : frontH
          : shouldNormalizeAdjacentFuga && nextUpperFrontBottomY !== undefined
          ? Math.max(40, nextUpperFrontBottomY - 3 - frontY)
          : frontH;
      const effFrontW = isExtDrawer ? frontW : Math.max(60, effCellW - 4);
      const effFrontX = isExtDrawer ? frontX : effCellStartX + 2;
      const closedFrontZ0 = isExtDrawer ? (bayLeafSpec?.doorZ0Mm ?? depth) : depth - T - trackRecessMm;
      frontCarcassMetaMap.set(`${drawer.id}_front`, {
        bayStartX,
        bayW,
        closedZ0: closedFrontZ0,
        closedY0: frontY,
        closedH: effFrontH,
        nextUpperDrawerBottomY: nextUpperFrontBottomY,
        isTopAtCabinetCeiling,
        emitTopLGola: bayErgonomicGolaPlan.emitTopLGola,
        emitIntermediateCGola: hasUpperCGola,
      });

      // P2-03: Consume canonical manufacturer drawerCuttingFormula directly by SKU & boxSystemType!
      const catalogCutFormula = resolveCanonicalDrawerCuttingFormula(drawer.hardwareProductId, boxSys);
      const lengthDeductionMm = catalogCutFormula.lengthDeductionMm;
      const bottomWidthDeductionMm = catalogCutFormula.bottomWidthDeductionMm;
      const backWidthDeductionMm = catalogCutFormula.backWidthDeductionMm;

      const backClearFrontZ =
        effBackType === "grooved" && !module.isOpenFront
          ? (module.carcass.backOffsetMm ?? (isWardrobe ? 12 : 18)) + T_back + 12
          : effBackType === "flush"
          ? Math.max(18, T_back) + 12
          : 24;
      const maxBoxD = Math.max(120, frontZ - pulledZ - explodeZ - backClearFrontZ);
      const boxD = Math.min(
        maxBoxD,
        drawer.nominalLengthMm
          ? Math.min(netInnerD - 10, drawer.nominalLengthMm - lengthDeductionMm)
          : Math.min(500, Math.max(260, netInnerD - 34))
      );
      const profileCode =
        drawer.boxSideProfileCode ||
        (drawer.height >= 265 ? "F" : drawer.height >= 205 ? "C" : drawer.height >= 155 ? "K" : "M");
      // Authentic total side wall heights (Blum LEGRABOX / TANDEMBOX M=84mm, K=116mm, C=168mm, F=224mm)
      const metalSideProfileH =
        profileCode === "F" ? 224 : profileCode === "C" ? 168 : profileCode === "K" ? 116 : 84;
      // Undermount runner clearance:
      // - Metal Box (LEGRABOX/TANDEMBOX): 16mm below 16mm bottom panel (runner occupies y = [boxBaseY - 14 .. boxBaseY])
      // - Wooden Undermount (MOVENTO/TANDEM): 14mm below side wall + 13mm dado pocket (runner occupies y = [boxBaseY - 7 .. boxBaseY + 13])
      // - Above a middle Gola / moulded box / backing strip (`hasLowerCGola`), elevate boxBaseY so BOTH the box AND the undermount runner
      //   clear the stationary rail top (`+18mm` box/backing or `+21mm` aluminum C-Gola) by at least +4mm with ZERO collision!
      const minRunnerBaseOffset = isMetalBoxSystem ? 16 : 14;
      const midRailAboveLowerFront = isBevel30BackingDrawer || isWoodGolaBoxDrawer ? 18 : 21;
      const runnerDropBelowBoxBase = isMetalBoxSystem ? 14 : 7;
      const lowerGolaClearBaseY = frontY + midRailAboveLowerFront + runnerDropBelowBoxBase + 4;
      const boxBaseY = hasLowerCGola
        ? Math.max(drawerY0 + minRunnerBaseOffset, lowerGolaClearBaseY)
        : Math.max(
            drawerY0 + minRunnerBaseOffset,
            isExtDrawer ? frontY + minRunnerBaseOffset : drawerY0 + minRunnerBaseOffset
          );
      const rawBoxH = isMetalBoxSystem
        ? metalSideProfileH
        : Math.max(72, Math.min(220, drawer.height - (hasUpperLGola || hasUpperCGola ? 36 : 26)));
      const topGolaHousingH =
        isBevel30BackingDrawer || isWoodGolaBoxDrawer
          ? 64
          : 60;
      const midGolaDropBelowUpperFront = isBevel30BackingDrawer || isWoodGolaBoxDrawer ? 53 : 58;
      const maxClearBoxTopY = hasUpperLGola
        ? height - topGolaHousingH
        : hasUpperCGola
        ? nextUpperFrontBottomY !== undefined
          ? nextUpperFrontBottomY - midGolaDropBelowUpperFront
          : frontY + effFrontH - (isBevel30BackingDrawer ? 22 : 25)
        : nextUpperFrontBottomY !== undefined
        ? nextUpperFrontBottomY - 6
        : Math.min(height - T - 8, frontY + effFrontH - 12);
      const boxH = Math.max(18, Math.min(rawBoxH, maxClearBoxTopY - boxBaseY));
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
      const drawerGripMode =
        extSortIdx >= 0 ? bayErgonomicGolaPlan.gripModes[extSortIdx] : "top_l_overhand";
      const drawerBevelPullEdge: "top" | "bottom" | undefined = isBevel30BackingDrawer
        ? drawerGripMode === "bottom_c_underhand"
          ? "bottom"
          : "top"
        : undefined;
      const drawerFrontDepthMm = isJPullBayDrawer
        ? Math.max(22, bay.door?.doorThicknessMm || T)
        : isExtDrawer && bay.door?.doorThicknessMm
        ? bay.door.doorThicknessMm
        : T;
      components.push({
        id: `${drawer.id}_front`,
        role: "drawer_front",
        label: `Çekmece Önü B${bayIdx + 1}-${dIdx + 1}${drawer.isInternal ? " (İç)" : ""}`,
        bayIndex: bayIdx,
        dimensions: { width: effFrontW, height: effFrontH, depth: drawerFrontDepthMm },
        position: {
          x: effFrontX,
          y: frontY,
          z: frontZ,
        },
        materialId: drawer.frontMaterialId || doorMaterialId,
        bevelPullEdge: drawerBevelPullEdge,
        isFrontFacing: true,
        isManufacturablePanel: true,
        thicknessAxis: "z",
      });

      // 3 & 4. Left & Right Side Panels of Box (Metal Box Systems -> NON-manufacturable steel; Wooden -> 16mm body panel!)
      const metalSideMatId =
        isLegrabox || isAvanTech ? "mat_handle_anthracite" : "mat_anodized_metal";
      const metalSideLabelPrefix = isLegrabox
        ? "Blum LEGRABOX Antrasit Metal"
        : isAvanTech
        ? "Hettich AvanTech Antrasit Metal"
        : "Blum TANDEMBOX Metal";
      const tandemSolidH = isTandembox && boxH > 96 ? 83 : boxH;
      components.push({
        id: `${drawer.id}_side_left`,
        role: "drawer_side_left",
        label: isMetalBoxSystem
          ? `${metalSideLabelPrefix} Sol Yanak (${profileCode}) B${bayIdx + 1}-${dIdx + 1}`
          : `Çekmece Sol Ahşap Kasa (16mm) B${bayIdx + 1}-${dIdx + 1}`,
        bayIndex: bayIdx,
        dimensions: { width: boxT, height: isTandembox ? tandemSolidH : boxH, depth: boxD },
        position: { x: boxX0, y: boxBaseY, z: boxZ0 },
        materialId: isMetalBoxSystem ? metalSideMatId : bodyMaterialId,
        isManufacturablePanel: !isMetalBoxSystem,
        thicknessAxis: "x",
      });

      components.push({
        id: `${drawer.id}_side_right`,
        role: "drawer_side_right",
        label: isMetalBoxSystem
          ? `${metalSideLabelPrefix} Sağ Yanak (${profileCode}) B${bayIdx + 1}-${dIdx + 1}`
          : `Çekmece Sağ Ahşap Kasa (16mm) B${bayIdx + 1}-${dIdx + 1}`,
        bayIndex: bayIdx,
        dimensions: { width: boxT, height: isTandembox ? tandemSolidH : boxH, depth: boxD },
        position: { x: boxX0 + boxW - boxT, y: boxBaseY, z: boxZ0 },
        materialId: isMetalBoxSystem ? metalSideMatId : bodyMaterialId,
        isManufacturablePanel: !isMetalBoxSystem,
        thicknessAxis: "x",
      });

      // TANDEMBOX Antaro tall pot drawers (C/F): signature rectangular top gallery rails connecting front to rear back!
      if (isTandembox && boxH > tandemSolidH + 18) {
        const railTopY = boxBaseY + boxH - 12;
        components.push(
          {
            id: `${drawer.id}_tandem_gallery_left`,
            role: "special_fitting",
            label: `Blum TANDEMBOX Antaro Sol Galeri Borusu B${bayIdx + 1}-${dIdx + 1}`,
            bayIndex: bayIdx,
            dimensions: { width: 10, height: 12, depth: Math.max(80, boxD - 16) },
            position: { x: boxX0 + 1.5, y: railTopY, z: boxZ0 + 8 },
            materialId: "mat_anodized_metal",
            isManufacturablePanel: false,
          },
          {
            id: `${drawer.id}_tandem_gallery_right`,
            role: "special_fitting",
            label: `Blum TANDEMBOX Antaro Sağ Galeri Borusu B${bayIdx + 1}-${dIdx + 1}`,
            bayIndex: bayIdx,
            dimensions: { width: 10, height: 12, depth: Math.max(80, boxD - 16) },
            position: { x: boxX0 + boxW - boxT + 1.5, y: railTopY, z: boxZ0 + 8 },
            materialId: "mat_anodized_metal",
            isManufacturablePanel: false,
          }
        );
      }

      // 4b. 4-Sided Wooden Drawer Inner Sub-Front (`drawer_sub_front`, 16mm):
      //     Real factory standard for wooden drawers + concealed Blum MOVENTO/TANDEM runners:
      //     The 8mm bottom slots 6mm into this inner sub-front (NEVER cutting a groove into the lacquered/45°-beveled outer front!),
      //     and the outer drawer front attaches cleanly to the inner sub-front!
      const innerSpanW = Math.max(68, boxW - 2 * boxT);
      if (!isMetalBoxSystem) {
        components.push({
          id: `${drawer.id}_sub_front`,
          role: "drawer_box",
          label: `Çekmece İç Ön Kasa (16mm, Taban Kanallı) B${bayIdx + 1}-${dIdx + 1}`,
          bayIndex: bayIdx,
          dimensions: { width: innerSpanW, height: boxH, depth: 16 },
          position: { x: boxX0 + boxT, y: boxBaseY, z: frontZ - 16 },
          materialId: bodyMaterialId,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        });
      }

      // 5. Back Panel of Box (`drawer_back`, 16mm):
      //    - Metal Box (LEGRABOX/TANDEMBOX/AvanTech): sits ON TOP OF the 16mm bottom panel (`y = boxBaseY + 16`)
      //    - Wooden Undermount (Blum MOVENTO/TANDEM standard): FULL HEIGHT starting at `y = boxBaseY` (flush with left/right drawer sides),
      //      leaving the mandatory 13mm skirt below the 8mm bottom panel for the Blum Ø6x10mm rear hook holes (at y=+11mm) & runner corner notches!
      const backBottomOffsetY = isMetalBoxSystem ? bottomT : 0;
      const backBoardH = Math.max(12, boxH - backBottomOffsetY);
      components.push({
        id: `${drawer.id}_back`,
        role: "drawer_back",
        label: `Çekmece Arka Sırt B${bayIdx + 1}-${dIdx + 1}${hasSiphonCut ? " (U-Sifon Kesimli)" : ""}`,
        bayIndex: bayIdx,
        dimensions: { width: innerSpanW, height: backBoardH, depth: 16 },
        position: { x: boxX0 + boxT, y: boxBaseY + backBottomOffsetY, z: boxZ0 },
        siphonCutout: siphonSpec,
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        thicknessAxis: "z",
      });

      // 6. Bottom Floor Board of Box (`drawer_bottom`):
      //    - Metal Box (16mm): full length `boxD` (`NL - 10mm`) from `boxZ0` (under `drawer_back`) flush to `frontZ`!
      //    - Wooden Undermount (8mm, 4-sided 6mm dado groove standard): seated at `y = boxBaseY + 13`, slotting 6mm into
      //      left/right sides, 6mm into full-height `drawer_back` (`z = boxZ0 + 16 - 6 = boxZ0 + 10`), and 6mm into `drawer_sub_front`
      //      (`z = frontZ - 16 + 6 = frontZ - 10`, depth = `boxD - 20`)!
      const visualBottomW = isMetalBoxSystem ? innerSpanW : Math.min(boxW - 4, innerSpanW + 12);
      const visualBottomX = boxX0 + (boxW - visualBottomW) / 2;
      const bottomGrooveZ = isMetalBoxSystem ? boxZ0 : boxZ0 + 10;
      const bottomGrooveD = isMetalBoxSystem ? Math.max(80, boxD) : Math.max(80, boxD - 20);
      components.push({
        id: `${drawer.id}_bottom`,
        role: "drawer_bottom",
        label: `Çekmece Tabanı (${bottomT}mm${isMetalBoxSystem ? "" : ", 4 Kenar Kanala Geçmeli"}) B${bayIdx + 1}-${dIdx + 1}${hasSiphonCut ? " (U-Sifon Boşluklu)" : ""}`,
        bayIndex: bayIdx,
        dimensions: { width: visualBottomW, height: bottomT, depth: bottomGrooveD },
        position: { x: visualBottomX, y: boxBaseY + (isMetalBoxSystem ? 0 : 13), z: bottomGrooveZ },
        siphonCutout: siphonSpec,
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        thicknessAxis: "y",
      });

      // 7. Left & Right Realistic Telescopic Undermount Slide Rails (strictly BELOW drawer_bottom, ABOVE carcass_bottom, recessed behind Gola/backing!)
      const slideRecessFront = isGolaDrawer ? 28 : 4;
      const slideD = Math.max(120, boxD - slideRecessFront);
      const slideZ0 = boxZ0 - (pulledZ > 0 ? pulledZ * 0.48 : 0);
      const slideH = isMetalBoxSystem ? 14 : 20;
      const slideY = isMetalBoxSystem
        ? Math.max(plinthHeight + T + 1, boxBaseY - slideH)
        : Math.max(plinthHeight + T + 1, boxBaseY + 13 - slideH);
      const slideBrandTag = (drawer.hardwareProductId || "").includes("hettich") ? "Hettich" : "Blum";
      components.push({
        id: `${drawer.id}_slide_left`,
        role: "drawer_slide",
        label: `${slideBrandTag} Çekmece Rayı Sol B${bayIdx + 1}-${dIdx + 1}`,
        bayIndex: bayIdx,
        dimensions: { width: 16, height: slideH, depth: slideD },
        position: {
          x: bayStartX + 1,
          y: slideY,
          z: slideZ0,
        },
        materialId: "mat_anodized_metal",
        isManufacturablePanel: false,
      });

      components.push({
        id: `${drawer.id}_slide_right`,
        role: "drawer_slide",
        label: `${slideBrandTag} Çekmece Rayı Sağ B${bayIdx + 1}-${dIdx + 1}`,
        bayIndex: bayIdx,
        dimensions: { width: 16, height: slideH, depth: slideD },
        position: {
          x: bayStartX + bayW - 17,
          y: slideY,
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
      const klapaLeftW = Math.max(0, bay.door.frontFillerLeftMm || 0);
      const klapaRightW = Math.max(0, bay.door.frontFillerRightMm || 0);
      const klapaZ = bay.door.frontFillerPosition === "recessed_inner" ? depth - T_door : doorZ;
      if (klapaLeftW > 0 && doorH > 0) {
        components.push({
          id: `${bay.door.id}_klapa_left`,
          role: "wall_filler",
          label: `Sol Ön Klapa B${bayIdx + 1} (${Math.round(klapaLeftW)}mm)`,
          bayIndex: bayIdx,
          dimensions: { width: klapaLeftW, height: doorH, depth: T_door },
          position: { x: Math.max(0, doorX0 - klapaLeftW - (doorPerimeterGap || 2)), y: doorY, z: klapaZ },
          materialId: doorMatId,
          isFrontFacing: true,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        });
      }
      if (klapaRightW > 0 && doorH > 0) {
        components.push({
          id: `${bay.door.id}_klapa_right`,
          role: "wall_filler",
          label: `Sağ Ön Klapa B${bayIdx + 1} (${Math.round(klapaRightW)}mm)`,
          bayIndex: bayIdx,
          dimensions: { width: klapaRightW, height: doorH, depth: T_door },
          position: { x: doorX0 + fullDoorW + (doorPerimeterGap || 2), y: doorY, z: klapaZ },
          materialId: doorMatId,
          isFrontFacing: true,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        });
      }

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

      const effCarcassBayStartX = isBlindCornerCab ? doorX0 : bayStartX;
      const effCarcassBayW = isBlindCornerCab ? fullDoorW : bayW;
      const closedDoorZ0 = leafSpec.doorZ0Mm ?? depth;
      const closedDoorY0 = leafSpec.doorY0Mm ?? (plinthHeight + doorPerimeterGap);

      // Multi-zone split door support when external drawer(s) sit in the middle of a hinged bay
      const hasExtDrawers = sortedExtDrawersInBay.length > 0;
      const upperZoneOpen = hasExtDrawers && isDoorZoneOpen(bay.door, "upper");
      const isHingedLikeDoor =
        !dSys.startsWith("sliding") &&
        !dSys.startsWith("lift_") &&
        dSys !== "folding_side" &&
        dType !== "folding" &&
        dSys !== "pocket_retractable" &&
        dType !== "pocket" &&
        dSys !== "tambour_roller" &&
        dType !== "tambour";
      const lowerDoorY = plinthHeight + doorPerimeterGap;
      const lowestExtDrw = hasExtDrawers ? sortedExtDrawersInBay[0] : undefined;
      const lowestExtFrontY = lowestExtDrw ? plinthHeight + T + lowestExtDrw.elevationY + 1.5 : 0;
      const isHorizGolaBayForDoor =
        bay.door.handleCategory === "gola_profile" &&
        bay.door.handleProfileId !== "hnd_gola_vertical" &&
        bay.door.handleProfileId !== "hnd_overhang_recessed_lip";
      const lowerDoorGapMm = isHorizGolaBayForDoor
        ? bay.door.handleProfileId === "hnd_bevel_30_backing"
          ? 30
          : 32
        : 3;
      const lowerDoorH =
        hasExtDrawers && isHingedLikeDoor && !isDoorZoneOpen(bay.door, "lower") && lowestExtDrw
          ? Math.round(lowestExtFrontY - lowerDoorGapMm - lowerDoorY)
          : 0;

      // Also detect any >=140mm middle gap between two separated external drawers (individually toggleable via zoneDoorStates["mid_k"])
      const midDoorZones: Array<{ idx: number; y: number; h: number }> = [];
      if (hasExtDrawers && isHingedLikeDoor && sortedExtDrawersInBay.length >= 2) {
        for (let di = 0; di < sortedExtDrawersInBay.length - 1; di++) {
          if (isDoorZoneOpen(bay.door, `mid_${di}`)) continue;
          const prevDrw = sortedExtDrawersInBay[di];
          const nextDrw = sortedExtDrawersInBay[di + 1];
          const midY0 = plinthHeight + T + prevDrw.elevationY + prevDrw.height + 3;
          const midY1 = plinthHeight + T + nextDrw.elevationY - 4;
          const midH = Math.round(midY1 - midY0 - 3);
          if (midH >= 140) {
            midDoorZones.push({ idx: di, y: midY0, h: midH });
          }
        }
      }

      // Compute exact upper-zone door bounds above the highest external drawer (works even when top drawer sits above 55% height!)
      const topExtDrw = hasExtDrawers
        ? sortedExtDrawersInBay[sortedExtDrawersInBay.length - 1]
        : undefined;
      const effUpperDoorY =
        hasExtDrawers && isHingedLikeDoor && topExtDrw
          ? plinthHeight + T + topExtDrw.elevationY + topExtDrw.height + 3
          : doorY;
      const effUpperDoorH =
        hasExtDrawers && isHingedLikeDoor && topExtDrw
          ? Math.round(height - doorPerimeterGap - effUpperDoorY)
          : doorH;
      const effUpperClosedY0 =
        hasExtDrawers && isHingedLikeDoor && topExtDrw ? effUpperDoorY : closedDoorY0;

      if (isHingedDoubleSplit) {
        const leafW = leafSpec.leafWidthMm;
        const leftId = `${bay.door.id}_leaf_left`;
        const rightId = `${bay.door.id}_leaf_right`;
        const rightX0 = doorX0 + leafW + leafSpec.centerRevealGapMm;
        if (!upperZoneOpen && effUpperDoorH >= 140) {
          frontCarcassMetaMap.set(leftId, {
            bayStartX,
            bayW,
            closedZ0: closedDoorZ0,
            closedY0: effUpperClosedY0,
            closedH: effUpperDoorH,
          });
          frontCarcassMetaMap.set(rightId, {
            bayStartX,
            bayW,
            closedZ0: closedDoorZ0,
            closedY0: effUpperClosedY0,
            closedH: effUpperDoorH,
          });
          components.push({
            id: leftId,
            role: "door_left",
            label: `Çift Kapak Sol B${bayIdx + 1}`,
            bayIndex: bayIdx,
            dimensions: { width: leafW, height: effUpperDoorH, depth: T_door },
            position: { x: doorX0, y: effUpperDoorY, z: doorZ },
            pivot: { x: doorX0, y: effUpperDoorY, z: doorZ + T_door },
            rotation: [0, -rad, 0],
            materialId: doorMatId,
            isFrontFacing: true,
            isManufacturablePanel: true,
            thicknessAxis: "z",
          });
          components.push({
            id: rightId,
            role: "door_right",
            label: `Çift Kapak Sağ B${bayIdx + 1}`,
            bayIndex: bayIdx,
            dimensions: { width: leafW, height: effUpperDoorH, depth: T_door },
            position: { x: rightX0, y: effUpperDoorY, z: doorZ },
            pivot: { x: rightX0 + leafW, y: effUpperDoorY, z: doorZ + T_door },
            rotation: [0, rad, 0],
            materialId: doorMatId,
            isFrontFacing: true,
            isManufacturablePanel: true,
            thicknessAxis: "z",
          });
        }
        if (lowerDoorH >= 140) {
          const lowLeftId = `${bay.door.id}_lower_leaf_left`;
          const lowRightId = `${bay.door.id}_lower_leaf_right`;
          frontCarcassMetaMap.set(lowLeftId, {
            bayStartX,
            bayW,
            closedZ0: closedDoorZ0,
            closedY0: lowerDoorY,
            closedH: lowerDoorH,
            nextUpperDrawerBottomY: lowestExtFrontY || undefined,
          });
          frontCarcassMetaMap.set(lowRightId, {
            bayStartX,
            bayW,
            closedZ0: closedDoorZ0,
            closedY0: lowerDoorY,
            closedH: lowerDoorH,
            nextUpperDrawerBottomY: lowestExtFrontY || undefined,
          });
          components.push(
            {
              id: lowLeftId,
              role: "door_left",
              label: `Alt Çift Kapak Sol B${bayIdx + 1}`,
              bayIndex: bayIdx,
              dimensions: { width: leafW, height: lowerDoorH, depth: T_door },
              position: { x: doorX0, y: lowerDoorY, z: doorZ },
              pivot: { x: doorX0, y: lowerDoorY, z: doorZ + T_door },
              rotation: [0, -rad, 0],
              materialId: doorMatId,
              isFrontFacing: true,
              isManufacturablePanel: true,
              thicknessAxis: "z",
            },
            {
              id: lowRightId,
              role: "door_right",
              label: `Alt Çift Kapak Sağ B${bayIdx + 1}`,
              bayIndex: bayIdx,
              dimensions: { width: leafW, height: lowerDoorH, depth: T_door },
              position: { x: rightX0, y: lowerDoorY, z: doorZ },
              pivot: { x: rightX0 + leafW, y: lowerDoorY, z: doorZ + T_door },
              rotation: [0, rad, 0],
              materialId: doorMatId,
              isFrontFacing: true,
              isManufacturablePanel: true,
              thicknessAxis: "z",
            }
          );
        }
        midDoorZones.forEach((mz) => {
          const midLeftId = `${bay.door.id}_mid_${mz.idx}_leaf_left`;
          const midRightId = `${bay.door.id}_mid_${mz.idx}_leaf_right`;
          frontCarcassMetaMap.set(midLeftId, {
            bayStartX,
            bayW,
            closedZ0: closedDoorZ0,
            closedY0: mz.y,
            closedH: mz.h,
          });
          frontCarcassMetaMap.set(midRightId, {
            bayStartX,
            bayW,
            closedZ0: closedDoorZ0,
            closedY0: mz.y,
            closedH: mz.h,
          });
          components.push(
            {
              id: midLeftId,
              role: "door_left",
              label: `Orta Çift Kapak Sol B${bayIdx + 1}`,
              bayIndex: bayIdx,
              dimensions: { width: leafW, height: mz.h, depth: T_door },
              position: { x: doorX0, y: mz.y, z: doorZ },
              pivot: { x: doorX0, y: mz.y, z: doorZ + T_door },
              rotation: [0, -rad, 0],
              materialId: doorMatId,
              isFrontFacing: true,
              isManufacturablePanel: true,
              thicknessAxis: "z",
            },
            {
              id: midRightId,
              role: "door_right",
              label: `Orta Çift Kapak Sağ B${bayIdx + 1}`,
              bayIndex: bayIdx,
              dimensions: { width: leafW, height: mz.h, depth: T_door },
              position: { x: rightX0, y: mz.y, z: doorZ },
              pivot: { x: rightX0 + leafW, y: mz.y, z: doorZ + T_door },
              rotation: [0, rad, 0],
              materialId: doorMatId,
              isFrontFacing: true,
              isManufacturablePanel: true,
              thicknessAxis: "z",
            }
          );
        });
      } else if (dSys === "sliding_top_hung" || dSys === "sliding_bottom_rolling" || dSys === "sliding_coplanar" || dType === "sliding" || dType === "sliding_bottom") {
        const preLeaf = slidingLeafStateMap.get(bayIdx);
        const mountKind =
          preLeaf?.mountKind ||
          bay.door.slidingMountingType ||
          (dSys === "sliding_bottom_rolling" || dType === "sliding_bottom"
            ? "inset_inside"
            : dSys === "sliding_coplanar"
            ? "coplanar_flush"
            : "top_hung_pelmet");

        const totalBays = Math.max(1, module.bays.length);
        const isFrontTrack = preLeaf?.isFrontTrack ?? (bayIdx % 2 === 1 || totalBays === 1);

        // Consume canonical precomputed sliding leaf dimensions & travel coordinates
        let effDoorW = preLeaf?.effDoorW ?? leafSpec.leafWidthMm;
        let effDoorH = doorH;
        let effDoorY = doorY;
        let leafZ = doorZ;
        const resolvedLeafX = preLeaf?.currentX ?? Math.max(0, Math.min(width - effDoorW, doorX0));

        if (mountKind === "inset_inside") {
          effDoorY = plinthHeight + T + 12; // 12mm bottom recessed track clearance
          effDoorH = Math.max(160, height - plinthHeight - 2 * T - 24); // 12mm top + 12mm bottom track clearance
          leafZ = isFrontTrack ? depth - T_door - 4 : depth - 2 * T_door - 12;
        } else if (mountKind === "coplanar_flush") {
          const popZ = preLeaf?.popZ ?? 0;
          effDoorY = plinthHeight + 4;
          effDoorH = Math.max(160, height - plinthHeight - 6);
          leafZ = depth + 4 + popZ;
          const coplanarX = resolvedLeafX;

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
          effDoorY = plinthHeight + 4;
          effDoorH = Math.max(160, height - plinthHeight - 4);
          leafZ = isFrontTrack ? depth + 34 : depth + 8;
        }

        if (mountKind !== "coplanar_flush") {
          const clampedSlideX = resolvedLeafX;

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
        const stayId = `${bay.door.id}_lift_stay`;
        const doorTopPivotY = doorY + doorH;
        const doorPitch = -rad * 0.95;
        frontCarcassMetaMap.set(stayId, {
          bayStartX,
          bayW,
          closedZ0: closedDoorZ0,
          closedY0: closedDoorY0,
          closedH: doorH,
        });
        components.push({
          id: stayId,
          role: "door_left",
          label: `Yukarı Kalkar Kapak (HK top) B${bayIdx + 1}`,
          bayIndex: bayIdx,
          dimensions: { width: fullDoorW, height: doorH, depth: T_door },
          position: {
            x: doorX0,
            y: doorY,
            z: doorZ,
          },
          pivot: { x: doorX0, y: doorTopPivotY, z: doorZ },
          rotation: [doorPitch, 0, 0],
          materialId: doorMatId,
          isFrontFacing: true,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        });

        // True Connected 2-Bar Blum AVENTOS HK top Assembly (Stationary Housing + Primary Arm + Forearm + Door Pad)
        const mechH = Math.min(126, Math.max(76, Math.round(Math.min(doorH * 0.34, height - 2 * T - 28))));
        const mechD = Math.min(198, Math.max(115, Math.round(netInnerD * 0.62)));
        const mechY = Math.min(height - T - mechH - 6, Math.max(T + 12, doorTopPivotY - mechH - 18));
        const mechZ = Math.max(22, depth - mechD - 24);
        const yS = mechY + Math.round(mechH * 0.54);
        const zS = mechZ + mechD - 14;

        // Exact door attachment bracket coordinates rotated with doorPitch around (doorTopPivotY, doorZ)
        const rAttach = Math.max(76, Math.min(162, Math.round(doorH * 0.36)));
        const padBackZ = -4;
        const yD = doorTopPivotY + (-rAttach) * Math.cos(doorPitch) - padBackZ * Math.sin(doorPitch);
        const zD = doorZ + (-rAttach) * Math.sin(doorPitch) + padBackZ * Math.cos(doorPitch);

        // Constant arm length derived purely from static cabinet dimensions so 60fps fast-path never rebuilds meshes!
        const maxOpenPitch = -(85 * Math.PI / 180) * 0.95;
        const yDMax = doorTopPivotY + (-rAttach) * Math.cos(maxOpenPitch) - padBackZ * Math.sin(maxOpenPitch);
        const zDMax = doorZ + (-rAttach) * Math.sin(maxOpenPitch) + padBackZ * Math.cos(maxOpenPitch);
        const maxChordHk = Math.hypot(yDMax - yS, zDMax - zS);
        const armLenHk = Math.max(78, Math.ceil(maxChordHk * 0.56));
        const ikHk = solve2BarLinkageYZ(yS, zS, yD, zD, armLenHk, armLenHk, true);

        [-1, 1].forEach((sideSign) => {
          const isRightSide = sideSign === 1;
          const sideTag = isRightSide ? "right" : "left";
          const sideTr = isRightSide ? "Sağ" : "Sol";
          const housingX = isRightSide ? bayStartX + bayW - 28 : bayStartX + 2;
          const armX = isRightSide ? bayStartX + bayW - 18 : bayStartX + 8;
          components.push(
            {
              id: `${bay.door.id}_aventos_mech_housing_hk_${sideTag}`,
              role: "special_fitting",
              label: `Blum AVENTOS HK top Güç Ünitesi (${sideTr}) B${bayIdx + 1}`,
              bayIndex: bayIdx,
              dimensions: { width: 26, height: mechH, depth: mechD },
              position: { x: housingX, y: mechY, z: mechZ },
              materialId: "mat_anodized_metal",
              isManufacturablePanel: false,
            },
            {
              id: `${bay.door.id}_aventos_mech_arm1_hk_${sideTag}`,
              role: "special_fitting",
              label: `Blum AVENTOS HK top Ana Kaldırma Kolu (${sideTr}) B${bayIdx + 1}`,
              bayIndex: bayIdx,
              dimensions: { width: 10, height: 16, depth: armLenHk },
              position: { x: armX, y: yS - 8, z: zS },
              pivot: { x: armX, y: yS, z: zS },
              rotation: [ikHk.pitch1Rad, 0, 0],
              materialId: "mat_metal_chrome",
              isManufacturablePanel: false,
            },
            {
              id: `${bay.door.id}_aventos_mech_arm2_hk_${sideTag}`,
              role: "special_fitting",
              label: `Blum AVENTOS HK top Teleskopik Bağlantı Kolu (${sideTr}) B${bayIdx + 1}`,
              bayIndex: bayIdx,
              dimensions: { width: 8, height: 13, depth: armLenHk },
              position: { x: armX + (isRightSide ? -2 : 2), y: ikHk.yE - 6.5, z: ikHk.zE },
              pivot: { x: armX + (isRightSide ? -2 : 2), y: ikHk.yE, z: ikHk.zE },
              rotation: [ikHk.pitch2Rad, 0, 0],
              materialId: "mat_metal_chrome",
              isManufacturablePanel: false,
            },
            {
              id: `${bay.door.id}_aventos_mech_pad_hk_${sideTag}`,
              role: "special_fitting",
              label: `Blum AVENTOS HK top Kapak Bağlantı Adaptörü (${sideTr}) B${bayIdx + 1}`,
              bayIndex: bayIdx,
              dimensions: { width: 18, height: 52, depth: 10 },
              position: { x: armX - 4, y: doorTopPivotY - rAttach - 26, z: doorZ - 10 },
              pivot: { x: armX - 4, y: doorTopPivotY, z: doorZ },
              rotation: [doorPitch, 0, 0],
              materialId: "mat_metal_chrome",
              isManufacturablePanel: false,
            }
          );
        });
      } else if (dSys === "lift_parallel" || dType === "lift_parallel") {
        // True 4-Bar Parallelogram Linkage (Blum AVENTOS HL top):
        // Upper Drive Arm & Lower Parallel Stabilizer Rod share identical length R_hl and angle beta
        // so both arms remain 100% locked between the stationary housing and the parallel-lifted door!
        const mechH = Math.min(136, Math.max(88, Math.round(Math.min(doorH * 0.38, height - 2 * T - 28))));
        const mechD = Math.min(208, Math.max(120, Math.round(netInnerD * 0.64)));
        const mechY = Math.min(height - T - mechH - 6, Math.max(T + 14, doorY + doorH - mechH - 18));
        const mechZ = Math.max(22, depth - mechD - 22);

        const yS1 = mechY + Math.round(mechH * 0.68);
        const yS2 = yS1 - 38;
        const zS = mechZ + mechD - 14;
        const zPadClosed = doorZ - 6;
        const dzClosed = Math.max(16, zPadClosed - zS);
        const rHl = Math.min(210, Math.max(dzClosed + 95, Math.round(doorH * 0.44)));
        const dyClosed = -Math.sqrt(Math.max(400, rHl * rHl - dzClosed * dzClosed));
        const betaClosed = Math.atan2(dyClosed, dzClosed); // ~ -72° (tucked downward inside closed cabinet)
        const betaOpen = 0.72; // ~ +41° upward & forward when fully open
        const betaCur = betaClosed + openRatio * (betaOpen - betaClosed);

        const liftDy = Math.round(rHl * Math.sin(betaCur) - dyClosed);
        const liftDz = Math.round(rHl * Math.cos(betaCur) - dzClosed);
        const armPitchHl = -betaCur;

        const hlId = `${bay.door.id}_lift_parallel`;
        frontCarcassMetaMap.set(hlId, {
          bayStartX,
          bayW,
          closedZ0: closedDoorZ0,
          closedY0: closedDoorY0,
          closedH: doorH,
        });
        components.push({
          id: hlId,
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

        // Cross-stabilizer synchronization rod between Left & Right HL Power Units
        if (bayW >= 180) {
          components.push({
            id: `${bay.door.id}_aventos_mech_hl_crossbar`,
            role: "special_fitting",
            label: `Blum AVENTOS HL top Senkronizasyon Mili B${bayIdx + 1}`,
            bayIndex: bayIdx,
            dimensions: { width: Math.max(80, bayW - 56), height: 12, depth: 12 },
            position: { x: bayStartX + 28, y: yS1 - 6, z: zS - 18 },
            materialId: "mat_anodized_metal",
            isManufacturablePanel: false,
          });
        }

        const yDoorPadTop0 = yS1 + dyClosed;
        [-1, 1].forEach((sideSign) => {
          const isRightSide = sideSign === 1;
          const sideTag = isRightSide ? "right" : "left";
          const sideTr = isRightSide ? "Sağ" : "Sol";
          const housingX = isRightSide ? bayStartX + bayW - 28 : bayStartX + 2;
          const armX = isRightSide ? bayStartX + bayW - 18 : bayStartX + 8;
          components.push(
            {
              id: `${bay.door.id}_aventos_mech_housing_hl_${sideTag}`,
              role: "special_fitting",
              label: `Blum AVENTOS HL top Güç Ünitesi (${sideTr}) B${bayIdx + 1}`,
              bayIndex: bayIdx,
              dimensions: { width: 26, height: mechH, depth: mechD },
              position: { x: housingX, y: mechY, z: mechZ },
              materialId: "mat_anodized_metal",
              isManufacturablePanel: false,
            },
            {
              id: `${bay.door.id}_aventos_mech_arm1_hl_${sideTag}`,
              role: "special_fitting",
              label: `Blum AVENTOS HL top Üst Paralel Ana Kol (${sideTr}) B${bayIdx + 1}`,
              bayIndex: bayIdx,
              dimensions: { width: 10, height: 15, depth: rHl },
              position: { x: armX, y: yS1 - 7.5, z: zS },
              pivot: { x: armX, y: yS1, z: zS },
              rotation: [armPitchHl, 0, 0],
              materialId: "mat_metal_chrome",
              isManufacturablePanel: false,
            },
            {
              id: `${bay.door.id}_aventos_mech_arm2_hl_${sideTag}`,
              role: "special_fitting",
              label: `Blum AVENTOS HL top Alt Paralel Denge Kolu (${sideTr}) B${bayIdx + 1}`,
              bayIndex: bayIdx,
              dimensions: { width: 8, height: 11, depth: rHl },
              position: { x: armX + (isRightSide ? -2 : 2), y: yS2 - 5.5, z: zS },
              pivot: { x: armX + (isRightSide ? -2 : 2), y: yS2, z: zS },
              rotation: [armPitchHl, 0, 0],
              materialId: "mat_metal_chrome",
              isManufacturablePanel: false,
            },
            {
              id: `${bay.door.id}_aventos_mech_pad_hl_${sideTag}`,
              role: "special_fitting",
              label: `Blum AVENTOS HL top Kapak Dikey Bağlantı Rayı (${sideTr}) B${bayIdx + 1}`,
              bayIndex: bayIdx,
              dimensions: { width: 18, height: 68, depth: 10 },
              position: {
                x: armX - 4,
                y: yDoorPadTop0 - 52 + liftDy,
                z: doorZ - 10 + liftDz,
              },
              materialId: "mat_metal_chrome",
              isManufacturablePanel: false,
            }
          );
        });
      } else if (dSys === "lift_bi_fold" || dType === "lift_bi_fold") {
        // True Coupled 2-Leaf Bi-Fold Linkage (Blum AVENTOS HF top):
        // 1) Upper leaf hinged to cabinet ceiling via 2 CLIP top ceiling hinges
        // 2) Lower leaf hinged to upper leaf bottom via 2 anti-pinch center knuckle hinges
        // 3) Left & Right Stationary HF Power Units + 2-bar articulated arms connected to lower leaf rear pad!
        const halfH = leafSpec.leafHeightMm;
        const thetaTop = rad * 0.92;
        const thetaBot = rad * 0.56;
        const topLeafBaseY = doorY + halfH + doorPerimeterGap;
        const topCeilingPivotY = topLeafBaseY + halfH;
        const knuckleJointY = topCeilingPivotY - Math.round(halfH * Math.cos(thetaTop)) - doorPerimeterGap;
        const knuckleJointZ = doorZ + Math.round(halfH * Math.sin(thetaTop));
        const topId = `${bay.door.id}_lift_bifold_top`;
        const botId = `${bay.door.id}_lift_bifold_bot`;
        frontCarcassMetaMap.set(botId, {
          bayStartX,
          bayW,
          closedZ0: closedDoorZ0,
          closedY0: closedDoorY0,
          closedH: halfH,
        });
        components.push({
          id: topId,
          role: "door_left",
          label: `Katlanır Kalkar Üst Kanat B${bayIdx + 1}`,
          bayIndex: bayIdx,
          dimensions: { width: fullDoorW, height: halfH, depth: T_door },
          position: {
            x: doorX0,
            y: topLeafBaseY,
            z: doorZ,
          },
          pivot: { x: doorX0, y: topCeilingPivotY, z: doorZ },
          rotation: [-thetaTop, 0, 0],
          materialId: doorMatId,
          isFrontFacing: true,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        });
        components.push({
          id: botId,
          role: "door_left",
          label: `Katlanır Kalkar Alt Kanat B${bayIdx + 1}`,
          bayIndex: bayIdx,
          dimensions: { width: fullDoorW, height: halfH, depth: T_door },
          position: {
            x: doorX0,
            y: knuckleJointY - halfH,
            z: knuckleJointZ,
          },
          pivot: { x: doorX0, y: knuckleJointY, z: knuckleJointZ },
          rotation: [thetaBot, 0, 0],
          materialId: doorMatId,
          isFrontFacing: true,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        });

        // Top Ceiling CLIP Hinges & Center Anti-Pinch Knuckle Hinges between Upper & Lower Leaves
        const hingeInsetX = Math.min(95, Math.max(42, Math.round(bayW * 0.16)));
        [bayStartX + hingeInsetX, bayStartX + bayW - hingeInsetX - 28].forEach((hx, hIdx) => {
          components.push(
            {
              id: `${bay.door.id}_aventos_mech_hf_top_hinge_${hIdx + 1}`,
              role: "special_fitting",
              label: `Blum AVENTOS HF Üst Tabla Menteşesi (70T5550) #${hIdx + 1}`,
              bayIndex: bayIdx,
              dimensions: { width: 28, height: 22, depth: 46 },
              position: { x: hx, y: height - T - 22, z: depth - 48 },
              materialId: "mat_metal_chrome",
              isManufacturablePanel: false,
            },
            {
              id: `${bay.door.id}_aventos_mech_hf_mid_hinge_${hIdx + 1}`,
              role: "special_fitting",
              label: `Blum AVENTOS HF Orta Parmak Koruma Menteşesi (78Z5530T) #${hIdx + 1}`,
              bayIndex: bayIdx,
              dimensions: { width: 28, height: 42, depth: 16 },
              position: { x: hx, y: knuckleJointY - 21, z: knuckleJointZ - 16 },
              pivot: { x: hx, y: knuckleJointY, z: knuckleJointZ },
              rotation: [(thetaBot - thetaTop) * 0.5, 0, 0],
              materialId: "mat_metal_chrome",
              isManufacturablePanel: false,
            }
          );
        });

        // Stationary HF Power Housings + 2-Bar Telescopic Linkage Reaching Lower Leaf Rear Pad!
        const mechH = Math.min(142, Math.max(88, Math.round(Math.min(doorH * 0.3, height - 2 * T - 28))));
        const mechD = Math.min(218, Math.max(120, Math.round(netInnerD * 0.65)));
        const mechY = Math.min(height - T - mechH - 8, Math.max(T + 14, topCeilingPivotY - mechH - 28));
        const mechZ = Math.max(22, depth - mechD - 22);
        const yS = mechY + Math.round(mechH * 0.44);
        const zS = mechZ + mechD - 14;

        // Attachment bracket sits on the back of the lower leaf (`rBot` below knuckleJointY)
        const rBot = Math.max(48, Math.min(115, Math.round(halfH * 0.3)));
        const padBackZ = -4;
        const yD = knuckleJointY + (-rBot) * Math.cos(thetaBot) - padBackZ * Math.sin(thetaBot);
        const zD = knuckleJointZ + (-rBot) * Math.sin(thetaBot) + padBackZ * Math.cos(thetaBot);

        // Compute static arm length L1=L2 from maximum 85° open chord so dimensions remain 100% constant across drag!
        const maxRadHf = (85 * Math.PI) / 180;
        const maxThTop = maxRadHf * 0.92;
        const maxThBot = maxRadHf * 0.56;
        const maxKnuckleY = topCeilingPivotY - Math.round(halfH * Math.cos(maxThTop)) - doorPerimeterGap;
        const maxKnuckleZ = doorZ + Math.round(halfH * Math.sin(maxThTop));
        const yDMaxHf = maxKnuckleY + (-rBot) * Math.cos(maxThBot) - padBackZ * Math.sin(maxThBot);
        const zDMaxHf = maxKnuckleZ + (-rBot) * Math.sin(maxThBot) + padBackZ * Math.cos(maxThBot);
        const yDMinHf = (topCeilingPivotY - halfH - doorPerimeterGap) - rBot;
        const zDMinHf = doorZ + padBackZ;
        const maxChordHf = Math.max(
          Math.hypot(yDMaxHf - yS, zDMaxHf - zS),
          Math.hypot(yDMinHf - yS, zDMinHf - zS)
        );
        const armLenHf = Math.max(115, Math.ceil(maxChordHf * 0.55));
        const ikHf = solve2BarLinkageYZ(yS, zS, yD, zD, armLenHf, armLenHf, true);

        [-1, 1].forEach((sideSign) => {
          const isRightSide = sideSign === 1;
          const sideTag = isRightSide ? "right" : "left";
          const sideTr = isRightSide ? "Sağ" : "Sol";
          const housingX = isRightSide ? bayStartX + bayW - 28 : bayStartX + 2;
          const armX = isRightSide ? bayStartX + bayW - 18 : bayStartX + 8;
          components.push(
            {
              id: `${bay.door.id}_aventos_mech_housing_hf_${sideTag}`,
              role: "special_fitting",
              label: `Blum AVENTOS HF top Güç Ünitesi (${sideTr}) B${bayIdx + 1}`,
              bayIndex: bayIdx,
              dimensions: { width: 26, height: mechH, depth: mechD },
              position: { x: housingX, y: mechY, z: mechZ },
              materialId: "mat_anodized_metal",
              isManufacturablePanel: false,
            },
            {
              id: `${bay.door.id}_aventos_mech_arm1_hf_${sideTag}`,
              role: "special_fitting",
              label: `Blum AVENTOS HF top Üst Teleskopik Kol (${sideTr}) B${bayIdx + 1}`,
              bayIndex: bayIdx,
              dimensions: { width: 10, height: 16, depth: armLenHf },
              position: { x: armX, y: yS - 8, z: zS },
              pivot: { x: armX, y: yS, z: zS },
              rotation: [ikHf.pitch1Rad, 0, 0],
              materialId: "mat_metal_chrome",
              isManufacturablePanel: false,
            },
            {
              id: `${bay.door.id}_aventos_mech_arm2_hf_${sideTag}`,
              role: "special_fitting",
              label: `Blum AVENTOS HF top Alt Uzatma Kolu (${sideTr}) B${bayIdx + 1}`,
              bayIndex: bayIdx,
              dimensions: { width: 8, height: 12, depth: armLenHf },
              position: { x: armX + (isRightSide ? -2 : 2), y: ikHf.yE - 6, z: ikHf.zE },
              pivot: { x: armX + (isRightSide ? -2 : 2), y: ikHf.yE, z: ikHf.zE },
              rotation: [ikHf.pitch2Rad, 0, 0],
              materialId: "mat_metal_chrome",
              isManufacturablePanel: false,
            },
            {
              id: `${bay.door.id}_aventos_mech_pad_hf_${sideTag}`,
              role: "special_fitting",
              label: `Blum AVENTOS HF top Alt Kanat Klipsi (${sideTr}) B${bayIdx + 1}`,
              bayIndex: bayIdx,
              dimensions: { width: 18, height: 48, depth: 10 },
              position: { x: armX - 4, y: knuckleJointY - rBot - 24, z: knuckleJointZ - 10 },
              pivot: { x: armX - 4, y: knuckleJointY, z: knuckleJointZ },
              rotation: [thetaBot, 0, 0],
              materialId: "mat_metal_chrome",
              isManufacturablePanel: false,
            }
          );
        });
      } else if (dSys === "folding_side" || dType === "folding") {
        // WP-04: True Coupled Accordion Bi-Fold Kinematics (Hettich WingLine L)
        // Wing 1 pivots around left carcass edge (doorX0, doorZ + T_door) by -thetaWing;
        // Wing 2 left knuckle is locked to Wing 1 right tip (jointX, jointZ) and rotates by +thetaWing so its right roller glides along z = doorZ!
        const wingW = Math.max(120, Math.round((fullDoorW - doorPerimeterGap) / 2));
        const thetaWing = rad * 0.88;
        const jointX = doorX0 + Math.round(wingW * Math.cos(thetaWing)) + doorPerimeterGap;
        const jointZ = doorZ + Math.round(wingW * Math.sin(thetaWing));
        frontCarcassMetaMap.set(`${bay.door.id}_fold_wing_1`, {
          bayStartX,
          bayW,
          closedZ0: closedDoorZ0,
          closedY0: closedDoorY0,
          closedH: doorH,
        });
        frontCarcassMetaMap.set(`${bay.door.id}_fold_wing_2`, {
          bayStartX,
          bayW,
          closedZ0: closedDoorZ0,
          closedY0: closedDoorY0,
          closedH: doorH,
        });
        components.push({
          id: `${bay.door.id}_fold_wing_1`,
          role: "door_left",
          label: `Katlanır Sol Ana Kanat B${bayIdx + 1}`,
          bayIndex: bayIdx,
          dimensions: { width: wingW, height: doorH, depth: T_door },
          position: { x: doorX0, y: doorY, z: doorZ },
          pivot: { x: doorX0, y: doorY, z: doorZ + T_door },
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
          pivot: { x: jointX, y: doorY, z: jointZ + T_door },
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
        const valanceH = Math.min(84, Math.max(56, Math.round(doorH * 0.09)));
        const curtainClearH = Math.max(80, doorH - valanceH);
        const visibleH = Math.max(48, Math.round(curtainClearH * (1 - openRatio * 0.86)));
        const trackZ = Math.max(T + 12, depth - 24);
        const tambourW = Math.max(100, bayW + 12);
        const tambourX = bayStartX - 6;

        // 1. Concealed Upper Roller Box Fascia Panel (Manufacturable front valance covering spiral drum)
        components.push({
          id: `${bay.door.id}_tambour_valance`,
          role: "carcass_top",
          label: `Tambur Sarım Kaseti Ön Kapama Alını B${bayIdx + 1}`,
          bayIndex: bayIdx,
          dimensions: { width: bayW, height: valanceH, depth: T_door },
          position: {
            x: bayStartX,
            y: doorY + doorH - valanceH,
            z: depth - T_door,
          },
          materialId: doorMatId,
          isFrontFacing: true,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        });

        // 2. Internal Counterbalanced Spiral Tambour Drum + Left/Right Recessed Aluminum Guide Tracks
        const drumDiam = Math.min(72, valanceH - 8);
        components.push(
          {
            id: `${bay.door.id}_tambour_drum`,
            role: "special_fitting",
            label: `Tambur Yaylı Dengeleme Sarım Tamburu B${bayIdx + 1}`,
            bayIndex: bayIdx,
            dimensions: { width: Math.max(80, bayW - 24), height: drumDiam, depth: drumDiam },
            position: {
              x: bayStartX + 12,
              y: doorY + doorH - valanceH + 4,
              z: Math.max(T + 10, depth - T_door - drumDiam - 14),
            },
            primitive: "cylinder",
            rotation: [0, 0, Math.PI / 2],
            materialId: "mat_anodized_metal",
            isManufacturablePanel: false,
          },
          {
            id: `${bay.door.id}_tambour_track_L`,
            role: "special_fitting",
            label: `Tambur Sol Alüminyum Gömme Kılavuz Ray B${bayIdx + 1}`,
            bayIndex: bayIdx,
            dimensions: { width: 12, height: curtainClearH, depth: 18 },
            position: { x: bayStartX, y: doorY, z: trackZ - 2 },
            materialId: "mat_anodized_metal",
            isManufacturablePanel: false,
          },
          {
            id: `${bay.door.id}_tambour_track_R`,
            role: "special_fitting",
            label: `Tambur Sağ Alüminyum Gömme Kılavuz Ray B${bayIdx + 1}`,
            bayIndex: bayIdx,
            dimensions: { width: 12, height: curtainClearH, depth: 18 },
            position: { x: bayStartX + bayW - 12, y: doorY, z: trackZ - 2 },
            materialId: "mat_anodized_metal",
            isManufacturablePanel: false,
          }
        );

        // 3. Articulated Slat Tambour Curtain + Bottom Anodized Pull Handle Profile
        const curtainBottomY = doorY + (curtainClearH - visibleH);
        components.push(
          {
            id: `${bay.door.id}_tambour_curtain`,
            role: "door_left",
            label: `Esnek Tambur Lamel Perde Açınımı B${bayIdx + 1} (${tambourW}×${curtainClearH + 90}mm)`,
            bayIndex: bayIdx,
            dimensions: { width: tambourW, height: visibleH, depth: 14 },
            position: {
              x: tambourX,
              y: curtainBottomY,
              z: trackZ,
            },
            materialId: doorMatId,
            isFrontFacing: true,
            isManufacturablePanel: true,
            thicknessAxis: "z",
          },
          {
            id: `${bay.door.id}_tambour_pull_bar`,
            role: "door_handle",
            label: `Tambur Entegre Alt Tutamak Profili B${bayIdx + 1}`,
            bayIndex: bayIdx,
            dimensions: { width: bayW - 4, height: 24, depth: 22 },
            position: {
              x: bayStartX + 2,
              y: curtainBottomY,
              z: trackZ - 2,
            },
            materialId: bay.door.handleMaterialId || "mat_handle_matte_black",
            isFrontFacing: true,
            isManufacturablePanel: false,
          }
        );
      } else {
        const isRight = dType === "single_right" || dType === "inset_right" || dType === "half_overlay_right";
        const sId = `${bay.door.id}_${isRight ? "right" : "left"}`;
        if (!upperZoneOpen && effUpperDoorH >= 140) {
          frontCarcassMetaMap.set(sId, {
            bayStartX: effCarcassBayStartX,
            bayW: effCarcassBayW,
            closedZ0: closedDoorZ0,
            closedY0: effUpperClosedY0,
            closedH: effUpperDoorH,
          });
          components.push({
            id: sId,
            role: isRight ? "door_right" : "door_left",
            label: `Kapak ${isRight ? "Sağ" : "Sol"}${isInset ? " (İçten)" : isHalfOverlay ? " (Yarım Bini)" : ""} B${bayIdx + 1}`,
            bayIndex: bayIdx,
            dimensions: { width: fullDoorW, height: effUpperDoorH, depth: T_door },
            position: { x: doorX0, y: effUpperDoorY, z: doorZ },
            pivot: { x: doorX0 + (isRight ? fullDoorW : 0), y: effUpperDoorY, z: doorZ + T_door },
            rotation: [0, isRight ? rad : -rad, 0],
            materialId: doorMatId,
            isFrontFacing: true,
            isManufacturablePanel: true,
            thicknessAxis: "z",
          });
        }
        if (lowerDoorH >= 140) {
          const lowId = `${bay.door.id}_lower_${isRight ? "right" : "left"}`;
          frontCarcassMetaMap.set(lowId, {
            bayStartX: effCarcassBayStartX,
            bayW: effCarcassBayW,
            closedZ0: closedDoorZ0,
            closedY0: lowerDoorY,
            closedH: lowerDoorH,
            nextUpperDrawerBottomY: lowestExtFrontY || undefined,
          });
          components.push({
            id: lowId,
            role: isRight ? "door_right" : "door_left",
            label: `Alt Kapak ${isRight ? "Sağ" : "Sol"}${isInset ? " (İçten)" : isHalfOverlay ? " (Yarım Bini)" : ""} B${bayIdx + 1}`,
            bayIndex: bayIdx,
            dimensions: { width: fullDoorW, height: lowerDoorH, depth: T_door },
            position: { x: doorX0, y: lowerDoorY, z: doorZ },
            pivot: { x: doorX0 + (isRight ? fullDoorW : 0), y: lowerDoorY, z: doorZ + T_door },
            rotation: [0, isRight ? rad : -rad, 0],
            materialId: doorMatId,
            isFrontFacing: true,
            isManufacturablePanel: true,
            thicknessAxis: "z",
          });
        }
        midDoorZones.forEach((mz) => {
          const midId = `${bay.door.id}_mid_${mz.idx}_${isRight ? "right" : "left"}`;
          frontCarcassMetaMap.set(midId, {
            bayStartX: effCarcassBayStartX,
            bayW: effCarcassBayW,
            closedZ0: closedDoorZ0,
            closedY0: mz.y,
            closedH: mz.h,
          });
          components.push({
            id: midId,
            role: isRight ? "door_right" : "door_left",
            label: `Orta Kapak ${isRight ? "Sağ" : "Sol"}${isInset ? " (İçten)" : isHalfOverlay ? " (Yarım Bini)" : ""} B${bayIdx + 1}`,
            bayIndex: bayIdx,
            dimensions: { width: fullDoorW, height: mz.h, depth: T_door },
            position: { x: doorX0, y: mz.y, z: doorZ },
            pivot: { x: doorX0 + (isRight ? fullDoorW : 0), y: mz.y, z: doorZ + T_door },
            rotation: [0, isRight ? rad : -rad, 0],
            materialId: doorMatId,
            isFrontFacing: true,
            isManufacturablePanel: true,
            thicknessAxis: "z",
          });
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
    if (front.rotation && !front.pivot) {
      const topPivot = front.id.includes("lift_") || front.rotation[0] !== 0;
      const isRightEdgeHinge =
        front.role === "door_right" && !topPivot && !front.id.includes("fold_wing_2");
      front.pivot = {
        x: front.position.x + (isRightEdgeHinge ? front.dimensions.width : 0),
        y: front.position.y + (topPivot ? front.dimensions.height : 0),
        z: front.position.z + (topPivot ? 0 : front.dimensions.depth),
      };
    }
    const dSysCheckTrack = bay.door?.doorSystemId || "";
    const bayHasTrackDoor = Boolean(
      dSysCheckTrack.startsWith("sliding") ||
        bay.door?.type === "sliding" ||
        bay.door?.type === "sliding_bottom" ||
        bay.door?.type === "pocket" ||
        bay.door?.type === "tambour"
    );
    if (
      front.role === "drawer_front" &&
      (bay.drawers.find((d) => `${d.id}_front` === front.id)?.isInternal || bayHasTrackDoor)
    ) {
      front.isInternalDrawer = true;
      continue;
    }
    if (front.id.includes("_lift_bifold_top") || front.label.includes("Katlanır Kalkar Üst Kanat")) {
      continue;
    }
    const isAnySlidingLeaf = front.id.includes("_sliding_");
    const isRearSlidingLeaf = front.id.includes("_sliding_rear");
    const rawCategory =
      bay.door.handleCategory ??
      (bay.door.handleType === "none" || bay.door.handleType === "push_to_open"
        ? "handleless_plain"
        : isAnySlidingLeaf
        ? "recessed_grip"
        : "bar_handle");
    const category = isRearSlidingLeaf ? "recessed_grip" : rawCategory;
    const carcassMeta = frontCarcassMetaMap.get(front.id);
    components.push(
      ...generateHandleGeometry(front, category, {
        moduleCategory: module.category,
        moduleElevationY: module.position.y,
        moduleHeight: module.dimensions.height,
        moduleWidth: width,
        moduleDepth: depth,
        panelThickness: T,
        carcassBayStartX: carcassMeta?.bayStartX,
        carcassBayWidth: carcassMeta?.bayW,
        carcassFrontZ0: carcassMeta?.closedZ0 ?? depth,
        carcassClosedY0: carcassMeta?.closedY0,
        carcassClosedHeight: carcassMeta?.closedH,
        nextUpperDrawerBottomY: carcassMeta?.nextUpperDrawerBottomY,
        isTopAtCabinetCeiling: carcassMeta?.isTopAtCabinetCeiling,
        emitTopLGola: carcassMeta?.emitTopLGola,
        emitIntermediateCGola: carcassMeta?.emitIntermediateCGola,
        handleOrientation: bay.door.handleOrientation,
        handleOffsetY:
          front.role !== "drawer_front" && front.dimensions.height < 420
            ? undefined
            : bay.door.handleOffsetY,
        handleEdgeInsetX: bay.door.handleEdgeInsetX,
        handleLengthMm:
          front.role !== "drawer_front"
            ? Math.min(
                bay.door.handleLengthMm || 192,
                Math.max(48, Math.round(front.dimensions.height - 56))
              )
            : bay.door.handleLengthMm,
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
      // For split lower/mid/short door leaves, compute hinge Y coordinates strictly within the leaf's own height
      const leafOwnH = front.dimensions.height;
      const isSplitOrShortLeaf =
        front.id.includes("_lower_") ||
        front.id.includes("_mid_") ||
        Math.abs(leafOwnH - leafSpec.baseDoorHeightMm) > 25;
      const effectiveHingeYs: number[] = isSplitOrShortLeaf
        ? leafOwnH < 300
          ? [Math.max(42, Math.round(leafOwnH * 0.24)), Math.min(leafOwnH - 42, Math.round(leafOwnH * 0.76))]
          : leafOwnH < 900
          ? [95, Math.round(leafOwnH - 95)]
          : [95, Math.round(leafOwnH * 0.5), Math.round(leafOwnH - 95)]
        : leafSpec.hingePositionsY;
      effectiveHingeYs.forEach((hy, hIdx) => {
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
      const isBevel30BackingFront = bayObj?.door?.handleProfileId === "hnd_bevel_30_backing";
      if (isBevel30BackingFront) {
        c.handleProfileId = "hnd_bevel_30_backing";
        if (c.role !== "drawer_front" && !c.bevelPullEdge) {
          c.bevelPullEdge = "top";
        }
      }
      const explicitDrawerProf =
        c.role === "drawer_front"
          ? bayObj?.drawers.find((d) => `${d.id}_front` === c.id)?.frontProfile
          : undefined;
      const isJPullBayFront =
        bayObj?.door?.handleCategory === "j_pull" ||
        bayObj?.door?.handleProfileId === "hnd_j_pull" ||
        bayObj?.door?.crossSectionProfile === "j_pull_bevel";
      const prof =
        c.role === "drawer_front"
          ? explicitDrawerProf ||
            (isBevel30BackingFront ? "bevel_45" : undefined) ||
            (isJPullBayFront ? "j_pull_bevel" : undefined) ||
            module.carcass.drawerFrontProfile ||
            "flat_slab"
          : bayObj?.door?.crossSectionProfile || module.carcass.crossSectionProfile;
      const poly =
        bayObj?.door?.customCadPolygon || module.carcass.customCadPolygon;
      if (prof) {
        c.crossSectionProfile = prof;
        if (prof === "j_pull_bevel") {
          const isUpperWallMod =
            c.role !== "drawer_front" &&
            (module.category === "kitchen_wall" ||
              module.moduleFamilyId === "fam_kitchen_wall" ||
              (module.position?.y ?? 0) >= 1100);
          c.jPullEdge = isUpperWallMod ? "bottom" : "top";
        }
      }
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

  // Emit 3D Architectural Hardware: Adjustable Plinth Feet, Anti-Tip Brackets, TIP-ON Pistons & Shelf Pins
  if ((module.category as string) !== "complementary") {
    const modW = module.dimensions.width;
    const modH = module.dimensions.height;
    const modD = module.dimensions.depth;
    const modPlinthH = module.carcass.plinthHeight || 0;
    const panelT = module.carcass.panelThickness || 18;

    // 1. Adjustable Axilo Plinth Legs (4 or 6 cylindrical feet under carcass bottom)
    if (modPlinthH >= 50 && module.category !== "kitchen_wall") {
      const legXs = modW > 900 ? [65, modW / 2, modW - 65] : [65, modW - 65];
      const legZs = [75, Math.max(120, modD - 75)];
      legXs.forEach((lx, li) => {
        legZs.forEach((lz, zi) => {
          finalComponents.push({
            id: `${module.id}_axilo_leg_${li}_${zi}`,
            role: "special_fitting",
            label: "Häfele Axilo Ayarlı Baza Ayağı",
            dimensions: { width: 34, height: modPlinthH, depth: 34 },
            position: { x: lx - 17, y: 0, z: lz - 17 },
            materialId: "mat_anodized_metal",
            isManufacturablePanel: false,
          });
        });
      });
    }

    // 2. EN 14749 Anti-Tip Steel Wall Brackets at top rear corners of tall cabinets
    if (modH >= 1800) {
      [panelT + 20, modW - panelT - 44].forEach((bx, bi) => {
        finalComponents.push({
          id: `${module.id}_anti_tip_${bi}`,
          role: "special_fitting",
          label: "EN 14749 Devrilme Önleyici Duvar Braketi",
          dimensions: { width: 24, height: 42, depth: 42 },
          position: { x: bx, y: modH - panelT - 44, z: 12 },
          materialId: "mat_anodized_metal",
          isManufacturablePanel: false,
        });
      });
    }

    // 3. Per-bay TIP-ON pistons & Ø5mm steel shelf support pins
    let cursorX = panelT;
    module.bays.forEach((b, bIdx) => {
      const bw = bayWidths[bIdx] || 450;
      if (
        b.door &&
        b.door.type !== "open" &&
        (b.door.openingTechnology === "push_to_open" || b.door.openingTechnology === "push_to_open_soft_close")
      ) {
        const onRightSide = b.door.type !== "single_right" && b.door.type !== "inset_right";
        finalComponents.push({
          id: `${module.id}_tip_on_b${bIdx}`,
          role: "special_fitting",
          label: "Blum TIP-ON Bas-Aç Pistonu",
          dimensions: { width: 16, height: 18, depth: 76 },
          position: {
            x: onRightSide ? cursorX + bw - 16 : cursorX,
            y: modPlinthH + (modH - modPlinthH) * 0.5,
            z: Math.max(40, modD - 92),
          },
          materialId: "mat_anodized_metal",
          isManufacturablePanel: false,
        });
      }

      (b.shelves || []).forEach((sh, sIdx) => {
        if (sh.isHidden || !sh.isAdjustable) return;
        const pinY = modPlinthH + panelT + sh.elevationY - 6;
        const pinZs = [Math.min(modD - 55, 65), Math.max(70, modD - 65)];
        [cursorX, cursorX + bw - 8].forEach((px, pSide) => {
          pinZs.forEach((pz, pDepth) => {
            finalComponents.push({
              id: `${module.id}_shelf_pin_b${bIdx}_s${sIdx}_${pSide}_${pDepth}`,
              role: "special_fitting",
              label: "System 32 Ø5mm Çelik Raf Pimi",
              dimensions: { width: 8, height: 8, depth: 12 },
              position: { x: px, y: pinY, z: pz },
              materialId: "mat_anodized_metal",
              isManufacturablePanel: false,
            });
          });
        });
      });

      cursorX += bw + panelT;
    });
  }

  // Systemic uniqueness invariant: guarantee every ComponentGeometry.id is 100% unique even if bays were cloned!
  const seenCompIds = new Map<string, number>();
  for (let ci = 0; ci < finalComponents.length; ci++) {
    const baseId = finalComponents[ci].id;
    const prevCount = seenCompIds.get(baseId) || 0;
    seenCompIds.set(baseId, prevCount + 1);
    if (prevCount > 0) {
      finalComponents[ci] = {
        ...finalComponents[ci],
        id: `${baseId}__dup${prevCount + 1}`,
      };
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
  moduleGeometryCache.set(cacheKey, result);
  return result;
}
