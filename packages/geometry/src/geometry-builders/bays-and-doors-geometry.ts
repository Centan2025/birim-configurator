import { ModuleInstance, SlidingMountingType, calculateFourSpaceDimensions, inferDoorSystemIdFromType, isBuiltInOvenOrFridgeTower, isDoorZoneOpen, resolveCanonicalDrawerCuttingFormula, resolveErgonomicGolaDrawerPlan, resolveInternalDrawerHingeClearance } from "@birim/core";
import { ComponentGeometry } from "../types";
import { appendBayDoorLeafGeometry, appendModuleSlidingTracksGeometry } from "./bay-door-leaf-and-sliding-geometry";

export interface BaysAndDoorsParams {
  module: ModuleInstance;
  components: ComponentGeometry[];
  fourSpace: ReturnType<typeof calculateFourSpaceDimensions>;
  bayWidths: number[];
  netInnerH: number;
  netInnerD: number;
  innerSpanW: number;
  isWardrobe: boolean;
  effBackType: string;
  isSinkBase: boolean;
  lowerName: string;
  doorOpenAngleDeg: number;
  drawerOpenMm: number;
  explodeZ: number;
}

export function appendBaysAndDoorsGeometry(params: BaysAndDoorsParams) {
  const {
    module,
    components,
    fourSpace,
    bayWidths,
    netInnerH,
    netInnerD,
    innerSpanW,
    isWardrobe,
    effBackType,
    isSinkBase,
    lowerName,
    doorOpenAngleDeg,
    drawerOpenMm,
    explodeZ,
  } = params;
  const { width, height, depth } = module.dimensions;
  const {
    panelThickness: T,
    backPanelThickness: T_back,
    plinthHeight,
    bodyMaterialId,
    doorMaterialId,
    doorPerimeterGap,
  } = module.carcass;

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
    appendBayDoorLeafGeometry({ module, bay, fourSpace, bayIdx, lowerName, innerSpanW, explodeZ, T, width, doorOpenAngleDeg, doorMaterialId, depth, components, doorPerimeterGap, bayStartX, bayW, plinthHeight, sortedExtDrawersInBay, height, frontCarcassMetaMap, slidingLeafStateMap, netInnerD });
    currentX += bayW + T;
  });

  // MODULE-WIDE SLIDING DOOR TRACK RAILS, STB-19 BOTTOM GUIDES & CONCEALED TOP PELMET FASCIA VALANCE
  appendModuleSlidingTracksGeometry({ module, doorMaterialId, width, T, components, height, depth, plinthHeight });
  return frontCarcassMetaMap;
}
