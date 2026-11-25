import {
  ModuleInstance,
  inferDoorSystemIdFromType,
} from "@birim/core";
import { ComponentGeometry, ModuleGeometryBreakdown } from "../types";
import { generateHandleGeometry } from "../handle-geometry";
import { moduleGeometryCache, resolveStandardCornerWingDepthMm } from "./kinematics-and-math";

export interface CornerGeometryParams {
  module: ModuleInstance;
  cacheKey: string;
  isTrueLCorner: boolean;
  isDiagonalCorner: boolean;
  isWardrobe: boolean;
  doorOpenAngleDeg: number;
  drawerOpenMm: number;
}

export function tryGenerateCornerModuleGeometry(
  params: CornerGeometryParams
): ModuleGeometryBreakdown | null {
  const {
    module,
    cacheKey,
    isTrueLCorner,
    isDiagonalCorner,
    isWardrobe,
    doorOpenAngleDeg,
    drawerOpenMm,
  } = params;
  const components: ComponentGeometry[] = [];
  const { width, height, depth } = module.dimensions;
  const {
    panelThickness: T,
    backPanelThickness: T_back,
    plinthHeight,
    bodyMaterialId,
    doorMaterialId,
    doorPerimeterGap,
  } = module.carcass;

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
        },
        {
          id: `${module.id}_plinth_rear_x`,
          role: "plinth",
          label: "L-Köşe Arka Baza Taşıyıcı Kayıt (X Duvarı)",
          dimensions: { width: Math.max(120, width - (cornerSideRunsToFloor ? 2 * T : 40)), height: lBoardH, depth: T },
          position: { x: cornerSideRunsToFloor ? T : 20, y: lSealH, z: 20 },
          materialId: bodyMaterialId,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        },
        {
          id: `${module.id}_plinth_rear_z`,
          role: "plinth",
          label: "L-Köşe Arka Baza Taşıyıcı Kayıt (Z Duvarı)",
          dimensions: { width: T, height: lBoardH, depth: Math.max(120, depth - 20 - T - (cornerSideRunsToFloor ? T : 20)) },
          position: { x: cornerSideRunsToFloor ? T : 20, y: lSealH, z: 20 + T },
          materialId: bodyMaterialId,
          isManufacturablePanel: true,
          thicknessAxis: "x",
        },
        ...(!cornerSideRunsToFloor
          ? [
              {
                id: `${module.id}_plinth_end_right`,
                role: "plinth" as const,
                label: "L-Köşe Sağ Bitiş Dönüş Baza Bandı",
                dimensions: { width: T, height: lBoardH, depth: Math.max(80, cornerJuncZ - 20) },
                position: { x: width - T - 3, y: lSealH, z: 20 },
                materialId: lPlinthMat,
                isManufacturablePanel: true,
                thicknessAxis: "x" as const,
              },
              {
                id: `${module.id}_plinth_end_front`,
                role: "plinth" as const,
                label: "L-Köşe Ön Dönüş Bitiş Baza Bandı",
                dimensions: { width: Math.max(80, cornerJuncX - 20), height: lBoardH, depth: T },
                position: { x: 20, y: lSealH, z: depth - T - 3 },
                materialId: lPlinthMat,
                isManufacturablePanel: true,
                thicknessAxis: "z" as const,
              },
            ]
          : [])
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

    // 3. Tek Parça CNC L-Kesim Alt & Üst Tablalar (3B'de tek parça eksiz ExtrudeGeometry `_lshape_wx<X>_wz<Z>`, BOM'da tek parça L-plaka!)
    const lBlankW = Math.max(200, width - 2 * T);
    const lBlankD = Math.max(200, depth - T);
    const lWingX = Math.max(120, wingD - T);
    const lWingZ = Math.max(120, wingD);
    const lNotchW = Math.max(80, lBlankW - lWingX);
    const lNotchD = Math.max(80, lBlankD - lWingZ);
    components.push(
      {
        id: `${module.id}_bottom_lshape_wx${Math.round(lWingX)}_wz${Math.round(lWingZ)}`,
        role: "carcass_bottom",
        label: "L-Köşe Tek Parça CNC Alt Tabla (İç Boşaltmalı)",
        dimensions: { width: lBlankW, height: T, depth: lBlankD },
        position: { x: T, y: plinthHeight, z: 0 },
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        cncBlankOverride: { lengthMm: lBlankW, widthMm: lBlankD, notchWidthMm: lNotchW, notchDepthMm: lNotchD },
        thicknessAxis: "y",
      },
      {
        id: `${module.id}_top_lshape_wx${Math.round(lWingX)}_wz${Math.round(lWingZ)}`,
        role: "carcass_top",
        label: "L-Köşe Tek Parça CNC Üst Tabla (İç Boşaltmalı)",
        dimensions: { width: lBlankW, height: T, depth: lBlankD },
        position: { x: T, y: height - T, z: 0 },
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        cncBlankOverride: { lengthMm: lBlankW, widthMm: lBlankD, notchWidthMm: lNotchW, notchDepthMm: lNotchD },
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
          const lShelfWingX = Math.max(100, wingD - (T + 2) - 14);
          const lShelfWingZ = Math.max(100, mainShelfD);
          const lShelfNotchW = Math.max(80, lShelfBlankW - lShelfWingX);
          const lShelfNotchD = Math.max(80, lShelfBlankD - lShelfWingZ);
          components.push({
            id: `${sh.id || `${module.id}_l_shelf_${sIdx}`}_lshape_wx${Math.round(lShelfWingX)}_wz${Math.round(lShelfWingZ)}`,
            role: "shelf",
            label: `L-Köşe Tek Parça CNC Raf #${sIdx + 1} (İç Boşaltmalı)`,
            bayIndex: 0,
            dimensions: { width: lShelfBlankW, height: T, depth: lShelfBlankD },
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
          });
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
          id: `${module.id}_l_countertop_lshape_wx${Math.round(retCtopW)}_wz${Math.round(mainCtopD)}`,
          role: "countertop",
          label: "L-Köşe Tek Parça Kuvars Tezgâh (38mm, +40mm Damlalıklı)",
          dimensions: { width, height: 38, depth },
          position: { x: 0, y: height, z: 0 },
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
      const leaf2OuterPivotX = wingD;
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
            z: movingJointZ + doorPerimeterGap,
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
      const diagPlinthMat = module.carcass.plinthMaterialId || doorMaterialId || bodyMaterialId;
      components.push(
        {
          id: `${module.id}_diag_plinth`,
          role: "plinth",
          label: "45° Diyagonal Köşe Ön Baza Bandı",
          dimensions: { width: Math.max(120, diagLen), height: plinthHeight, depth: T },
          position: { x: wingD - pShift, y: 0, z: depth - pShift - T },
          rotation: [0, diagAngle, 0],
          pivot: { x: wingD - pShift, y: 0, z: depth - pShift },
          materialId: diagPlinthMat,
          isFrontFacing: true,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        },
        {
          id: `${module.id}_diag_plinth_rear_x`,
          role: "plinth",
          label: "45° Diyagonal Köşe Arka Baza Kayıtı (X Duvarı)",
          dimensions: { width: Math.max(120, width - 40), height: plinthHeight, depth: T },
          position: { x: 20, y: 0, z: 20 },
          materialId: bodyMaterialId,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        },
        {
          id: `${module.id}_diag_plinth_rear_z`,
          role: "plinth",
          label: "45° Diyagonal Köşe Arka Baza Kayıtı (Z Duvarı)",
          dimensions: { width: T, height: plinthHeight, depth: Math.max(120, depth - 40 - T) },
          position: { x: 20, y: 0, z: 20 + T },
          materialId: bodyMaterialId,
          isManufacturablePanel: true,
          thicknessAxis: "x",
        },
        ...(!diagSideRunsToFloor
          ? [
              {
                id: `${module.id}_diag_plinth_side_right`,
                role: "plinth" as const,
                label: "45° Diyagonal Köşe Sağ Dönüş Baza Bandı",
                dimensions: { width: T, height: plinthHeight, depth: Math.max(80, wingD - pShift - 20) },
                position: { x: width - T - 3, y: 0, z: 20 },
                materialId: diagPlinthMat,
                isManufacturablePanel: true,
                thicknessAxis: "x" as const,
              },
              {
                id: `${module.id}_diag_plinth_side_front`,
                role: "plinth" as const,
                label: "45° Diyagonal Köşe Ön Dönüş Baza Bandı",
                dimensions: { width: Math.max(80, wingD - pShift - 20), height: plinthHeight, depth: T },
                position: { x: 20, y: 0, z: depth - T - 3 },
                materialId: diagPlinthMat,
                isManufacturablePanel: true,
                thicknessAxis: "z" as const,
              },
            ]
          : [])
      );
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

  return null;
}
