import { DesignProject, ModuleInstance } from "@birim/core";

export interface ElevationSnapTarget {
  elevationY: number;
  worldY: number;
  label: string;
  sourceModuleIndex: number;
  sourceBayIndex: number;
  kind: "shelf" | "drawer_top" | "drawer_bottom" | "rail" | "mid";
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
    elevationY: Math.round(rawElevationY / 5) * 5,
    snappedTarget: null,
  };
}
