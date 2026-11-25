import {
  ModuleInstance,
  calculateFourSpaceDimensions,
  inferDoorSystemIdFromType,
} from "@birim/core";
import { ComponentGeometry } from "../types";
import { generateHandleGeometry } from "../handle-geometry";
import { applySlopedCeilingToComponents } from "./sloped-ceiling-clipper";
import type { appendBaysAndDoorsGeometry } from "./bays-and-doors-geometry";

export interface FinalizeGeometryParams {
  module: ModuleInstance;
  components: ComponentGeometry[];
  fourSpace: ReturnType<typeof calculateFourSpaceDimensions>;
  bayWidths: number[];
  frontCarcassMetaMap: ReturnType<typeof appendBaysAndDoorsGeometry>;
}

export function finalizeHandlesIslandAndHardwareGeometry(
  params: FinalizeGeometryParams
): ComponentGeometry[] {
  const { module, components, fourSpace, bayWidths, frontCarcassMetaMap } = params;
  const { width, height, depth } = module.dimensions;
  const {
    panelThickness: T,
    plinthHeight,
    bodyMaterialId,
    doorMaterialId,
  } = module.carcass;

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

  // Apply parametric sloped-ceiling / attic / under-stairs cutting to carcass, doors, back, dividers & shelves
  applySlopedCeilingToComponents(finalComponents, module, T, bodyMaterialId);

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


  return finalComponents;
}
