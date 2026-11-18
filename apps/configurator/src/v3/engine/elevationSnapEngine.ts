import {
  DesignProject,
  ModuleInstance,
  computeSystem32MultiHoleYs,
  resolveMultiHoleSpec,
} from "@birim/core";

export interface ElevationSnapTarget {
  elevationY: number;
  worldY: number;
  label: string;
  sourceModuleIndex: number;
  sourceBayIndex: number;
  kind: "shelf" | "drawer_top" | "drawer_bottom" | "rail" | "mid" | "system32_hole";
}

export function findDraggableInteriorComponent(
  mod: ModuleInstance,
  compId: string,
  bayWidths: number[]
): {
  kind: "shelf" | "drawer" | "rail" | "special_fitting" | "divider" | "sub_divider";
  bayIdx: number;
  targetId: string;
  startVal: number;
  startElevY?: number;
  itemHeightMm?: number;
} | null {
  for (let bIdx = 0; bIdx < mod.bays.length; bIdx++) {
    const bay = mod.bays[bIdx];
    const shelf = bay.shelves.find(
      (s, sIdx) => s.id === compId || `${mod.id}_bay_${bIdx}_shelf_${sIdx}` === compId
    );
    if (shelf) {
      return {
        kind: "shelf",
        bayIdx: bIdx,
        targetId: shelf.id,
        startVal: shelf.elevationY,
        itemHeightMm: shelf.thickness || mod.carcass.panelThickness,
      };
    }

    const drawer = bay.drawers.find(
      (d) => compId === d.id || compId.startsWith(`${d.id}_`)
    );
    if (drawer) {
      return {
        kind: "drawer",
        bayIdx: bIdx,
        targetId: drawer.id,
        startVal: drawer.elevationY,
        itemHeightMm: drawer.height,
      };
    }

    const rail = bay.hangingRails.find(
      (r, rIdx) => r.id === compId || `${mod.id}_bay_${bIdx}_rail_${rIdx}` === compId
    );
    if (rail) {
      return {
        kind: "rail",
        bayIdx: bIdx,
        targetId: rail.id,
        startVal: rail.elevationY,
        itemHeightMm: 25,
      };
    }

    const fit = bay.specialFittings?.find(
      (f, fIdx) =>
        compId === f.id ||
        compId.startsWith(`${f.id}_`) ||
        compId === `${mod.id}_bay_${bIdx}_fit_${fIdx}` ||
        compId.startsWith(`${mod.id}_bay_${bIdx}_fit_${fIdx}_`)
    );
    if (fit) {
      return {
        kind: "special_fitting",
        bayIdx: bIdx,
        targetId: fit.id,
        startVal: fit.elevationY,
        itemHeightMm: fit.height || 100,
      };
    }

    const subDiv = bay.subDividers?.find(
      (sd, sdIdx) => sd.id === compId || `${mod.id}_bay_${bIdx}_subdiv_${sdIdx}` === compId
    );
    if (subDiv) {
      return {
        kind: "sub_divider",
        bayIdx: bIdx,
        targetId: subDiv.id,
        startVal: subDiv.offsetX,
        startElevY: subDiv.elevationY,
        itemHeightMm: subDiv.height,
      };
    }
  }

  if (compId.includes("_divider_")) {
    const divIdx = Number(compId.split("_divider_")[1]);
    if (!Number.isNaN(divIdx) && bayWidths[divIdx]) {
      return {
        kind: "divider",
        bayIdx: divIdx,
        targetId: compId,
        startVal: bayWidths[divIdx],
      };
    }
  }

  return null;
}

export function computeElevationSnapTargets(
  project: DesignProject,
  activeModuleIndex: number,
  activeBayIndex: number,
  targetId: string,
  draggedItemHeightMm = 0
): ElevationSnapTarget[] {
  const activeMod = project.modules[activeModuleIndex] || project.modules[0];
  if (!activeMod) return [];

  const activeBaseWorldY =
    (activeMod.position?.y ?? 0) +
    activeMod.carcass.plinthHeight +
    activeMod.carcass.panelThickness;
  const activeNetInnerH = Math.max(
    200,
    activeMod.dimensions.height -
      activeMod.carcass.plinthHeight -
      2 * activeMod.carcass.panelThickness
  );

  const targets: ElevationSnapTarget[] = [];

  project.modules.forEach((mod, mIdx) => {
    const modBaseWorldY =
      (mod.position?.y ?? 0) + mod.carcass.plinthHeight + mod.carcass.panelThickness;
    const modPrefix = mIdx === activeModuleIndex ? "" : `${mod.name} • `;

    mod.bays.forEach((bay, bIdx) => {
      const isSameBay = mIdx === activeModuleIndex && bIdx === activeBayIndex;

      // 1. Shelves across all bays & modules
      bay.shelves.forEach((s) => {
        if (isSameBay && s.id === targetId) return;
        const worldY = modBaseWorldY + s.elevationY;
        const localElevY = Math.round(worldY - activeBaseWorldY);
        if (localElevY >= 0 && localElevY <= activeNetInnerH) {
          targets.push({
            elevationY: localElevY,
            worldY,
            label: `${modPrefix}B${bIdx + 1} Raf Hizası (${localElevY} mm)`,
            sourceModuleIndex: mIdx,
            sourceBayIndex: bIdx,
            kind: "shelf",
          });
        }
      });

      // 2. Drawers (Bottom & Top / Fixed Shelf Above Drawer) across all bays & modules
      bay.drawers.forEach((d) => {
        if (isSameBay && d.id === targetId) return;
        const botWorldY = modBaseWorldY + d.elevationY;
        const botLocalY = Math.round(botWorldY - activeBaseWorldY);
        if (botLocalY >= 0 && botLocalY <= activeNetInnerH) {
          targets.push({
            elevationY: botLocalY,
            worldY: botWorldY,
            label: `${modPrefix}B${bIdx + 1} Çekmece Altı (${botLocalY} mm)`,
            sourceModuleIndex: mIdx,
            sourceBayIndex: bIdx,
            kind: "drawer_bottom",
          });
        }

        const topWorldY = modBaseWorldY + d.elevationY + d.height;
        const topLocalY = Math.round(topWorldY - activeBaseWorldY);
        if (topLocalY >= 0 && topLocalY <= activeNetInnerH) {
          targets.push({
            elevationY: topLocalY,
            worldY: topWorldY,
            label: `${modPrefix}B${bIdx + 1} Çekmece Üstü (${topLocalY} mm)`,
            sourceModuleIndex: mIdx,
            sourceBayIndex: bIdx,
            kind: "drawer_top",
          });
        }

        if (draggedItemHeightMm > 30) {
          const alignTopLocalY = topLocalY - draggedItemHeightMm;
          if (alignTopLocalY >= 0 && alignTopLocalY <= activeNetInnerH) {
            targets.push({
              elevationY: alignTopLocalY,
              worldY: topWorldY,
              label: `${modPrefix}B${bIdx + 1} Çekmece Üst Hizası (${topLocalY} mm)`,
              sourceModuleIndex: mIdx,
              sourceBayIndex: bIdx,
              kind: "drawer_top",
            });
          }
        }
      });

      // 3. Hanging Rails across all bays & modules
      bay.hangingRails.forEach((r) => {
        if (isSameBay && r.id === targetId) return;
        const worldY = modBaseWorldY + r.elevationY;
        const localElevY = Math.round(worldY - activeBaseWorldY);
        if (localElevY >= 0 && localElevY <= activeNetInnerH) {
          targets.push({
            elevationY: localElevY,
            worldY,
            label: `${modPrefix}B${bIdx + 1} Askı Hizası (${localElevY} mm)`,
            sourceModuleIndex: mIdx,
            sourceBayIndex: bIdx,
            kind: "rail",
          });
        }
      });
    });
  });

  // 4. Cabinet inner midpoint
  const midElev = Math.round(activeNetInnerH / 2);
  targets.push({
    elevationY: midElev,
    worldY: activeBaseWorldY + midElev,
    label: `Dolap Orta Hizası (${midElev} mm)`,
    sourceModuleIndex: activeModuleIndex,
    sourceBayIndex: activeBayIndex,
    kind: "mid",
  });

  return targets;
}

export function resolveElevationSnap(
  rawElevationY: number,
  targets: ElevationSnapTarget[],
  thresholdMm = 18
): { elevationY: number; snappedTarget: ElevationSnapTarget | null } {
  let best: ElevationSnapTarget | null = null;
  let bestDist = thresholdMm + 0.01;

  for (const t of targets) {
    const dist = Math.abs(rawElevationY - t.elevationY);
    if (dist < bestDist) {
      bestDist = dist;
      best = t;
    }
  }

  if (best) {
    return { elevationY: best.elevationY, snappedTarget: best };
  }

  return {
    elevationY: Math.round(rawElevationY / 2) * 2,
    snappedTarget: null,
  };
}

/**
 * Computes exact valid System-32 Ø5mm shelf-pin hole elevations (`elevationY` above inner bottom panel)
 * for a movable shelf (`isAdjustable !== false && !isFixed`) when multi-hole boring (`mode !== "none"`) is active.
 * Coordinates match `build3DModuleMultiHoleInstancedMesh` and `drilling-engine.ts` to 0.00 mm!
 */
export function computeBaySystem32ShelfHoleElevations(
  mod: ModuleInstance,
  bayIndex: number,
  draggedShelfId?: string,
  options?: { includeFixedShelves?: boolean }
): number[] | null {
  const bay = mod.bays[bayIndex];
  if (!bay) return null;

  const draggedShelf = draggedShelfId
    ? bay.shelves.find((s) => s.id === draggedShelfId)
    : undefined;

  if (draggedShelfId && !options?.includeFixedShelves) {
    if (draggedShelf && (draggedShelf.isAdjustable === false || draggedShelf.isFixed === true)) {
      return null; // Fixed structural shelves (Minifix / Rafix) are not restricted to Ø5mm pin holes unless explicitly requested
    }
  }

  const spec = resolveMultiHoleSpec(mod);
  if (spec.mode === "none" || mod.category === "complementary") {
    return null;
  }

  const panelT = mod.carcass.panelThickness || 18;
  const plinthH = mod.carcass.plinthHeight ?? 80;
  const sideToFloor =
    plinthH > 0 && String(mod.carcass.plinthConstruction) === "gable_rails";
  const bottomOffsetY = sideToFloor ? plinthH : 0;
  const sidePanelHeight = sideToFloor ? mod.dimensions.height : Math.max(200, mod.dimensions.height - plinthH);
  const netInnerH = Math.max(200, mod.dimensions.height - plinthH - 2 * panelT);

  const drawerTopY =
    bay.drawers.length > 0
      ? Math.max(...bay.drawers.map((d) => d.elevationY + d.height))
      : 0;

  const fixedPanelYs = bay.shelves
    .filter(
      (s) =>
        s.id !== draggedShelfId &&
        !s.isHidden &&
        (s.isAdjustable === false || s.isFixed === true)
    )
    .map((s) => bottomOffsetY + panelT + s.elevationY);

  // Always expose the full vertical System-32 candidate grid (32mm .. netInnerH - 32mm)
  // so shelves can be freely dragged to top hat-shelf or low shoe-shelf zones even when zone_32 is active!
  const panelHoleYs = computeSystem32MultiHoleYs({
    mode: spec.mode === "zone_32" ? "zone_32" : "full_system_32",
    panelHeightMm: sidePanelHeight,
    bottomOffsetY,
    panelThicknessMm: panelT,
    edgeMarginMm: spec.edgeMarginMm,
    adjustableShelfYsMm: [],
    blockedYsMm: fixedPanelYs.map((fy) => ({ y: fy, clearanceMm: 20 })),
  });

  const shelfElevYs = panelHoleYs
    .map((py) => Math.round(py - bottomOffsetY - panelT))
    .filter((ey) => ey >= Math.max(32, drawerTopY + 24) && ey <= netInnerH - 32);

  return shelfElevYs.length > 0 ? shelfElevYs : null;
}

/**
 * Snaps a dragged shelf strictly to physical System-32 multi-hole coordinates whenever multi-hole mode is active
 * on a movable shelf (unless `bypassMultiHole` / Alt key is held), while still highlighting cross-bay shelf alignments!
 */
export function snapShelfToMultiHoleOrElevationTargets(params: {
  project: DesignProject;
  moduleIndex: number;
  bayIndex: number;
  shelfId: string;
  rawElevationY: number;
  snapTargets: ElevationSnapTarget[];
  bypassMultiHole?: boolean;
}): { elevationY: number; snappedTarget: ElevationSnapTarget | null } {
  const {
    project,
    moduleIndex,
    bayIndex,
    shelfId,
    rawElevationY,
    snapTargets,
    bypassMultiHole = false,
  } = params;

  const mod = project.modules[moduleIndex] || project.modules[0];
  if (!mod || bypassMultiHole) {
    return resolveElevationSnap(rawElevationY, snapTargets, 18);
  }

  const holeYs = computeBaySystem32ShelfHoleElevations(mod, bayIndex, shelfId, {
    includeFixedShelves: false,
  });
  if (!holeYs || holeYs.length === 0) {
    return resolveElevationSnap(rawElevationY, snapTargets, 18);
  }

  let bestHoleIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < holeYs.length; i++) {
    const d = Math.abs(rawElevationY - holeYs[i]);
    if (d < bestDist) {
      bestDist = d;
      bestHoleIdx = i;
    }
  }

  const snappedHoleY = holeYs[bestHoleIdx];
  const baseWorldY =
    (mod.position?.y ?? 0) +
    (mod.carcass.plinthHeight ?? 80) +
    (mod.carcass.panelThickness || 18);

  // Check if an adjacent bay's shelf or drawer top also aligns with this System-32 hole
  const matchingCrossTarget = snapTargets.find(
    (t) => Math.abs(t.elevationY - snappedHoleY) <= 4
  );

  const label = matchingCrossTarget
    ? `${matchingCrossTarget.label} • Sistem 32 Delik #${bestHoleIdx + 1}`
    : `Sistem 32 Delik #${bestHoleIdx + 1} (${snappedHoleY} mm)`;

  return {
    elevationY: snappedHoleY,
    snappedTarget: {
      elevationY: snappedHoleY,
      worldY: baseWorldY + snappedHoleY,
      label,
      sourceModuleIndex: moduleIndex,
      sourceBayIndex: bayIndex,
      kind: "system32_hole",
    },
  };
}
