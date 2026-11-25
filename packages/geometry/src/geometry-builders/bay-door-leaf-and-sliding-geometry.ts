import {
  inferDoorSystemIdFromType,
  isDoorZoneOpen,
  type BayConfig,
  type DrawerConfig,
  type ModuleInstance,
  type SlidingMountingType,
  type calculateFourSpaceDimensions,
} from "@birim/core";
import type { ComponentGeometry } from "../types";
import { solve2BarLinkageYZ } from "./kinematics-and-math";

export interface BayDoorLeafGeometryContext {
  module: ModuleInstance;
  bay: BayConfig;
  fourSpace: ReturnType<typeof calculateFourSpaceDimensions>;
  bayIdx: number;
  lowerName: string;
  innerSpanW: number;
  explodeZ: number;
  T: number;
  width: number;
  doorOpenAngleDeg: number;
  doorMaterialId: string;
  depth: number;
  components: ComponentGeometry[];
  doorPerimeterGap: number;
  bayStartX: number;
  bayW: number;
  plinthHeight: number;
  sortedExtDrawersInBay: DrawerConfig[];
  height: number;
  frontCarcassMetaMap: Map<
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
  >;
  slidingLeafStateMap: Map<
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
  >;
  netInnerD: number;
}

export function appendBayDoorLeafGeometry(ctx: BayDoorLeafGeometryContext) {
  const {
    module,
    bay,
    fourSpace,
    bayIdx,
    lowerName,
    innerSpanW,
    explodeZ,
    T,
    width,
    doorOpenAngleDeg,
    doorMaterialId,
    depth,
    components,
    doorPerimeterGap,
    bayStartX,
    bayW,
    plinthHeight,
    sortedExtDrawersInBay,
    height,
    frontCarcassMetaMap,
    slidingLeafStateMap,
    netInnerD,
  } = ctx;
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
}

export interface ModuleSlidingTracksGeometryContext {
  module: ModuleInstance;
  doorMaterialId: string;
  width: number;
  T: number;
  components: ComponentGeometry[];
  height: number;
  depth: number;
  plinthHeight: number;
}

export function appendModuleSlidingTracksGeometry(ctx: ModuleSlidingTracksGeometryContext) {
  const {
    module,
    doorMaterialId,
    width,
    T,
    components,
    height,
    depth,
    plinthHeight,
  } = ctx;
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
}
