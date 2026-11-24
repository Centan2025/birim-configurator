import type { ModuleInstance, SceneObjectInstance } from "@birim/core";

export interface ResizeWidthSnapParams {
  modules: ModuleInstance[];
  activeModIdx: number;
  axis: "width_right" | "width_left";
  rawWidthMm: number;
  startX: number;
  startW: number;
  minW?: number;
  maxW?: number;
  toleranceMm?: number;
  disableSnap?: boolean;
}

export interface ResizeWidthSnapResult {
  width: number;
  positionX: number;
  snappedEdgeX: number | null;
  snapKind: "same_side_align" | "adjacent_butt" | "wall_start" | null;
  snapTargetName: string | null;
  snapBanner: string | null;
  candidateLinesX: number[];
}

export interface PostResizeSyncOptions {
  /** Automatically scale/shift directly stacked upper cabinets that were aligned with the resized base. Default: true */
  syncStackedColumns?: boolean;
  /** Push touching neighbors in the same row when a cabinet widens into them (e.g. kitchen base row). Default: true */
  reflowAdjacentRow?: boolean;
  /** Wall width limit in mm when pushing right neighbors (optional). */
  wallWidthLimitMm?: number;
}

export interface PostResizeSyncResult {
  modules: ModuleInstance[];
  sceneObjects: SceneObjectInstance[];
  notices: string[];
}

export function isKitchenWallModule(mod: ModuleInstance): boolean {
  return (
    mod.category === "kitchen_wall" ||
    mod.moduleFamilyId === "fam_kitchen_wall"
  );
}

export function isKitchenBaseModule(mod: ModuleInstance): boolean {
  return (
    mod.category === "kitchen_base" ||
    mod.moduleFamilyId === "fam_kitchen_base"
  );
}

export function isSameOrientation(a: ModuleInstance, b: ModuleInstance, tolDeg = 5): boolean {
  return Math.abs((a.rotation?.y || 0) - (b.rotation?.y || 0)) <= tolDeg;
}

/**
 * Returns true if `upper` sits directly on top of `base` (contact stacking, e.g. wardrobe + top cabinet).
 * Kitchen wall cabinets (floating above a countertop gap) return false.
 */
export function isDirectStackedOn(
  upper: ModuleInstance,
  base: ModuleInstance,
  yTolMm = 20
): boolean {
  if (upper.id === base.id) return false;
  if (upper.category === "complementary" || base.category === "complementary") return false;
  if (!isSameOrientation(upper, base)) return false;

  const baseTopY = base.position.y + base.dimensions.height;
  if (Math.abs(upper.position.y - baseTopY) > yTolMm) return false;

  const uLeft = upper.position.x;
  const uRight = uLeft + upper.dimensions.width;
  const bLeft = base.position.x;
  const bRight = bLeft + base.dimensions.width;
  const xOverlap = uLeft < bRight - 10 && uRight > bLeft + 10;
  if (!xOverlap) return false;

  const uRear = upper.position.z;
  const uFront = uRear + upper.dimensions.depth;
  const bRear = base.position.z;
  const bFront = bRear + base.dimensions.depth;
  return uRear < bFront - 20 && uFront > bRear + 20;
}

/**
 * Computes magnetic width snap for 3D and 2D Elevation resize handles (`width_right` and `width_left`).
 * Snaps to BOTH opposite edges (adjacent butt joint) AND same-side edges (stacked upper/base & kitchen vertical seam alignment),
 * selecting the closest candidate within `toleranceMm`.
 */
export function computeResizeWidthSnap(params: ResizeWidthSnapParams): ResizeWidthSnapResult {
  const {
    modules,
    activeModIdx,
    axis,
    rawWidthMm,
    startX,
    startW,
    minW = 250,
    maxW = 3600,
    toleranceMm = 35,
    disableSnap = false,
  } = params;

  const activeMod = modules[activeModIdx];
  const clampedRawW = Math.max(minW, Math.min(maxW, Math.round(rawWidthMm / 10) * 10));
  const rightEdgeFixed = startX + startW;

  if (!activeMod) {
    const posX = axis === "width_left" ? Math.max(0, rightEdgeFixed - clampedRawW) : startX;
    return {
      width: clampedRawW,
      positionX: posX,
      snappedEdgeX: null,
      snapKind: null,
      snapTargetName: null,
      snapBanner: null,
      candidateLinesX: [],
    };
  }

  const candidateLineSet = new Set<number>([0]);
  const otherModules: Array<{ mod: ModuleInstance; idx: number }> = [];
  modules.forEach((other, oi) => {
    if (oi === activeModIdx || other.category === "complementary") return;
    if (!isSameOrientation(activeMod, other)) return;
    candidateLineSet.add(other.position.x);
    candidateLineSet.add(other.position.x + other.dimensions.width);
    otherModules.push({ mod: other, idx: oi });
  });
  const candidateLinesX = Array.from(candidateLineSet);

  if (disableSnap) {
    const posX = axis === "width_left" ? Math.max(0, rightEdgeFixed - clampedRawW) : startX;
    return {
      width: clampedRawW,
      positionX: posX,
      snappedEdgeX: null,
      snapKind: null,
      snapTargetName: null,
      snapBanner: null,
      candidateLinesX,
    };
  }

  interface SnapCandidate {
    edgeX: number;
    resultingW: number;
    resultingX: number;
    dist: number;
    effectiveScore: number;
    kind: "same_side_align" | "adjacent_butt" | "wall_start";
    targetName: string;
    banner: string;
  }

  const candidates: SnapCandidate[] = [];
  const activeIsKitchenWall = isKitchenWallModule(activeMod);
  const activeIsKitchenBase = isKitchenBaseModule(activeMod);

  if (axis === "width_right") {
    const rawRight = startX + clampedRawW;

    for (const { mod: other } of otherModules) {
      const oLeft = other.position.x;
      const oRight = other.position.x + other.dimensions.width;
      const verticallyRelated =
        Math.abs(activeMod.position.y - other.position.y) > 20 &&
        startX < oRight - 10 &&
        rawRight > oLeft + 10;

      // 1. Same-side right edge alignment (stacked upper <-> base, or kitchen wall <-> kitchen base seam)
      const distRight = Math.abs(rawRight - oRight);
      const wAlign = oRight - startX;
      if (distRight <= toleranceMm && wAlign >= minW && wAlign <= maxW) {
        const isKitchenSeam =
          (activeIsKitchenWall && isKitchenBaseModule(other)) ||
          (activeIsKitchenBase && isKitchenWallModule(other));
        const label = isKitchenSeam
          ? `🧲 ${other.name} Dikey Derzine Hizalandı (${wAlign} mm)`
          : `🧲 ${other.name} Sağ Kenarına Hizalandı (${wAlign} mm)`;
        candidates.push({
          edgeX: oRight,
          resultingW: wAlign,
          resultingX: startX,
          dist: distRight,
          effectiveScore: distRight - (verticallyRelated ? 2 : 0),
          kind: "same_side_align",
          targetName: other.name,
          banner: label,
        });
      }

      // 2. Opposite-side left edge butt snap (adjacent module)
      const distLeft = Math.abs(rawRight - oLeft);
      const wButt = oLeft - startX;
      if (distLeft <= toleranceMm && wButt >= minW && wButt <= maxW) {
        candidates.push({
          edgeX: oLeft,
          resultingW: wButt,
          resultingX: startX,
          dist: distLeft,
          effectiveScore: distLeft,
          kind: "adjacent_butt",
          targetName: other.name,
          banner: `🧲 ${other.name} Sol Kenarına Bitişti (${wButt} mm)`,
        });
      }
    }
  } else {
    // width_left: right edge stays fixed at rightEdgeFixed, left edge moves
    const rawLeft = rightEdgeFixed - clampedRawW;

    // 0. Wall start X = 0
    if (Math.abs(rawLeft) <= toleranceMm) {
      const wWall = rightEdgeFixed;
      if (wWall >= minW && wWall <= maxW) {
        candidates.push({
          edgeX: 0,
          resultingW: wWall,
          resultingX: 0,
          dist: Math.abs(rawLeft),
          effectiveScore: Math.abs(rawLeft),
          kind: "wall_start",
          targetName: "Duvar Başlangıcı",
          banner: `🧲 Duvar Başlangıcına Hizalandı (${wWall} mm)`,
        });
      }
    }

    for (const { mod: other } of otherModules) {
      const oLeft = other.position.x;
      const oRight = other.position.x + other.dimensions.width;
      const verticallyRelated =
        Math.abs(activeMod.position.y - other.position.y) > 20 &&
        rawLeft < oRight - 10 &&
        rightEdgeFixed > oLeft + 10;

      // 1. Same-side left edge alignment (stacked upper <-> base, or kitchen wall <-> kitchen base seam)
      const distLeft = Math.abs(rawLeft - oLeft);
      const wAlign = rightEdgeFixed - oLeft;
      if (distLeft <= toleranceMm && wAlign >= minW && wAlign <= maxW) {
        const isKitchenSeam =
          (activeIsKitchenWall && isKitchenBaseModule(other)) ||
          (activeIsKitchenBase && isKitchenWallModule(other));
        const label = isKitchenSeam
          ? `🧲 ${other.name} Sol Derzine Hizalandı (${wAlign} mm)`
          : `🧲 ${other.name} Sol Kenarına Hizalandı (${wAlign} mm)`;
        candidates.push({
          edgeX: oLeft,
          resultingW: wAlign,
          resultingX: oLeft,
          dist: distLeft,
          effectiveScore: distLeft - (verticallyRelated ? 2 : 0),
          kind: "same_side_align",
          targetName: other.name,
          banner: label,
        });
      }

      // 2. Opposite-side right edge butt snap (adjacent module)
      const distRight = Math.abs(rawLeft - oRight);
      const wButt = rightEdgeFixed - oRight;
      if (distRight <= toleranceMm && wButt >= minW && wButt <= maxW) {
        candidates.push({
          edgeX: oRight,
          resultingW: wButt,
          resultingX: oRight,
          dist: distRight,
          effectiveScore: distRight,
          kind: "adjacent_butt",
          targetName: other.name,
          banner: `🧲 ${other.name} Sağ Kenarına Bitişti (${wButt} mm)`,
        });
      }
    }
  }

  if (candidates.length === 0) {
    const posX = axis === "width_left" ? Math.max(0, rightEdgeFixed - clampedRawW) : startX;
    const finalW = axis === "width_left" ? Math.max(minW, Math.min(maxW, rightEdgeFixed - posX)) : clampedRawW;
    return {
      width: finalW,
      positionX: posX,
      snappedEdgeX: null,
      snapKind: null,
      snapTargetName: null,
      snapBanner: null,
      candidateLinesX,
    };
  }

  candidates.sort((a, b) => a.effectiveScore - b.effectiveScore);
  const best = candidates[0];
  return {
    width: best.resultingW,
    positionX: best.resultingX,
    snappedEdgeX: best.edgeX,
    snapKind: best.kind,
    snapTargetName: best.targetName,
    snapBanner: best.banner,
    candidateLinesX,
  };
}

/**
 * Syncs complementary attachments (`comp_att_${parentId}__...`) to a parent module's geometry.
 */
function syncAttachedComplementariesForModule(
  modules: ModuleInstance[],
  parentMod: ModuleInstance
): void {
  const attachedPrefix = `comp_att_${parentMod.id}__`;
  const { x: px, y: py, z: pz } = parentMod.position;
  const { width: pw, height: ph, depth: pd } = parentMod.dimensions;

  for (let i = 0; i < modules.length; i++) {
    const m = modules[i];
    if (m.category !== "complementary" || !m.id.startsWith(attachedPrefix)) continue;
    const suffix = m.id.slice(attachedPrefix.length);
    const upd: ModuleInstance = {
      ...m,
      position: { ...m.position },
      dimensions: { ...m.dimensions },
    };
    if (suffix.startsWith("panel_left")) {
      upd.position.x = Math.max(0, px - upd.dimensions.width);
      upd.position.y = py;
      upd.position.z = pz;
      upd.dimensions.height = ph;
      upd.dimensions.depth = pd + 20;
    } else if (suffix.startsWith("panel_right")) {
      upd.position.x = px + pw;
      upd.position.y = py;
      upd.position.z = pz;
      upd.dimensions.height = ph;
      upd.dimensions.depth = pd + 20;
    } else if (suffix.startsWith("crown_top")) {
      upd.position.x = px;
      upd.position.y = py + ph;
      upd.position.z = pz;
      upd.dimensions.width = pw;
    } else if (suffix.startsWith("worktop")) {
      upd.position.x = px;
      upd.position.y = py + ph;
      upd.position.z = pz;
      upd.dimensions.width = pw;
      upd.dimensions.depth = pd + 20;
    } else if (suffix.startsWith("backsplash")) {
      upd.position.x = px;
      upd.position.y = py + ph + 38;
      upd.position.z = pz;
      upd.dimensions.width = pw;
    } else if (suffix.startsWith("plinth_front")) {
      upd.position.x = px;
      upd.position.y = py;
      upd.position.z = pz + Math.max(0, pd - 32);
      upd.dimensions.width = pw;
    } else if (suffix.startsWith("waterfall_right")) {
      upd.position.x = px + pw;
      upd.position.y = py;
      upd.position.z = pz;
      upd.dimensions.height = ph + 38;
      upd.dimensions.depth = pd + 20;
    } else if (suffix.startsWith("filler_left")) {
      upd.position.x = Math.max(0, px - upd.dimensions.width);
      upd.position.y = py;
      upd.position.z = pz;
      upd.dimensions.height = ph;
    }
    modules[i] = upd;
  }
}

/**
 * Aligns a stacked upper cabinet's bays (divider positions & hinged door splits) to match its base module
 * while preserving the upper cabinet's shelves and keeping drawers/hanging rails empty.
 */
function syncStackedBaysToBase(upper: ModuleInstance, base: ModuleInstance): void {
  if (!base.bays || base.bays.length === 0) return;
  const T = upper.carcass.panelThickness || 18;
  const netH = Math.max(100, upper.dimensions.height - 2 * T);
  const templateBay = upper.bays[0];

  const nextBays = base.bays.map((baseBay, idx) => {
    const existing = upper.bays[idx] || templateBay;
    const cloned = existing
      ? JSON.parse(JSON.stringify(existing))
      : JSON.parse(JSON.stringify(baseBay));
    cloned.index = idx;
    cloned.customWidth = baseBay.customWidth;
    cloned.door = {
      ...cloned.door,
      id: `${upper.id}_door_${idx}`,
      bayIndex: idx,
      type: baseBay.door?.type === "open" ? cloned.door?.type || "single_left" : baseBay.door?.type || "single_left",
      doorSystemId:
        baseBay.door?.type === "double"
          ? "hinged_double"
          : baseBay.door?.type === "single_left" || baseBay.door?.type === "single_right"
          ? "hinged_single"
          : cloned.door?.doorSystemId,
    };
    if (!existing) {
      cloned.drawers = [];
      cloned.hangingRails = [];
      cloned.specialFittings = [];
      cloned.subDividers = [];
      cloned.shelves =
        upper.dimensions.height >= 550
          ? [
              {
                id: `${upper.id}_shelf_${idx}_0`,
                bayIndex: idx,
                elevationY: Math.round(netH / 2),
                thickness: T,
                isAdjustable: true,
              },
            ]
          : [];
    } else {
      cloned.shelves = (cloned.shelves || []).map((s: any, si: number) => ({
        ...s,
        id: s.id || `${upper.id}_shelf_${idx}_${si}`,
        bayIndex: idx,
        elevationY: Math.max(60, Math.min(netH - 60, s.elevationY)),
      }));
    }
    return cloned;
  });

  upper.bays = nextBays;
}

/**
 * Rescales shelves inside a cabinet when its height is trimmed for ceiling clearance.
 */
function rescaleUpperShelvesForHeight(upper: ModuleInstance, oldH: number, newH: number): void {
  const T = upper.carcass.panelThickness || 18;
  const oldNet = Math.max(100, oldH - 2 * T);
  const newNet = Math.max(100, newH - 2 * T);
  const ratio = newNet / oldNet;
  upper.bays.forEach((b) => {
    if (!b.shelves || b.shelves.length === 0) return;
    if (newH < 420) {
      b.shelves = [];
      return;
    }
    b.shelves.forEach((s) => {
      s.elevationY = Math.max(60, Math.min(newNet - 60, Math.round((s.elevationY * ratio) / 10) * 10));
    });
  });
}

function isCountertopAppliance(so: SceneObjectInstance): boolean {
  return Boolean(
    so.catalogId?.includes("cooktop") ||
      so.catalogId?.includes("sink") ||
      so.visualKind === "cooktop_induction" ||
      so.visualKind === "sink_undermount_faucet" ||
      so.anchorMode === "countertop_cutout"
  );
}

function isCooktopAppliance(so: SceneObjectInstance): boolean {
  return Boolean(so.catalogId?.includes("cooktop") || so.visualKind === "cooktop_induction");
}

/**
 * Post-resize parametric synchronization engine for:
 * 1. Contact-stacked upper cabinets (Y-elevation tracking, ceiling clamp, aligned W/X/D & bay seam sync, overhang guard)
 * 2. Contiguous row reflow on widening (prevents overlapping adjacent base/kitchen cabinets + shifts their attachments & stacks)
 * 3. Host-mounted countertop appliances (auto-centering on X/Z, Y tracking, minimum cabinet width warning)
 * 4. Kitchen base height vs floating kitchen wall minimum clearance protection (450 mm standard / 650 mm above cooktop)
 */
export function applyPostResizeModuleSync(
  inputModules: ModuleInstance[],
  inputSceneObjects: SceneObjectInstance[],
  modIdx: number,
  oldMod: ModuleInstance,
  ceilingHeightMm = 2700,
  options: PostResizeSyncOptions = {}
): PostResizeSyncResult {
  const syncStackedColumns = options.syncStackedColumns !== false;
  const reflowAdjacentRow = options.reflowAdjacentRow !== false;

  const modules = inputModules.map((m) => m);
  let sceneObjects = (inputSceneObjects || []).map((so) => ({
    ...so,
    position: { ...so.position },
  }));
  const notices: string[] = [];

  const target = modules[modIdx];
  if (!target || target.category === "complementary") {
    return { modules, sceneObjects, notices };
  }

  // Clone target in case we need to clamp height for ceiling safety
  let nextMod: ModuleInstance = target;
  const oldTopY = oldMod.position.y + oldMod.dimensions.height;
  let newTopY = nextMod.position.y + nextMod.dimensions.height;
  const deltaH = newTopY - oldTopY;
  const widthOrXChanged =
    nextMod.dimensions.width !== oldMod.dimensions.width ||
    nextMod.position.x !== oldMod.position.x;
  const depthChanged = nextMod.dimensions.depth !== oldMod.dimensions.depth;

  // ---------------------------------------------------------------------------
  // 1. DIRECTLY STACKED UPPER CABINETS (Wardrobe + Üst Yüklük, Tall + Top Box)
  // ---------------------------------------------------------------------------
  const stackedIndices: number[] = [];
  for (let i = 0; i < modules.length; i++) {
    if (i === modIdx) continue;
    if (isDirectStackedOn(modules[i], oldMod)) {
      stackedIndices.push(i);
    }
  }

  for (const uIdx of stackedIndices) {
    const oldUpper = modules[uIdx];
    const nextUpper: ModuleInstance = JSON.parse(JSON.stringify(oldUpper));
    let upperChanged = false;

    // 1a. Y-Elevation Tracking + Ceiling Headroom Guard
    if (deltaH !== 0) {
      const desiredUpperY = nextMod.position.y + nextMod.dimensions.height;
      if (desiredUpperY + nextUpper.dimensions.height > ceilingHeightMm) {
        const availH = ceilingHeightMm - desiredUpperY;
        const minUpperH = 260;
        if (availH >= minUpperH) {
          const trimmedH = Math.max(minUpperH, Math.floor(availH / 10) * 10);
          rescaleUpperShelvesForHeight(nextUpper, nextUpper.dimensions.height, trimmedH);
          nextUpper.position.y = desiredUpperY;
          nextUpper.dimensions.height = trimmedH;
          notices.push(
            `📏 Tavan kotu (${ceilingHeightMm} mm) nedeniyle "${nextUpper.name}" yüksekliği ${trimmedH} mm'ye uyarlandı.`
          );
        } else {
          // Clamp base height so upper keeps minUpperH under ceiling
          const maxBaseH = Math.max(260, ceilingHeightMm - minUpperH - nextMod.position.y);
          nextMod = {
            ...nextMod,
            dimensions: { ...nextMod.dimensions, height: maxBaseH },
          };
          modules[modIdx] = nextMod;
          newTopY = nextMod.position.y + nextMod.dimensions.height;
          rescaleUpperShelvesForHeight(nextUpper, nextUpper.dimensions.height, minUpperH);
          nextUpper.position.y = newTopY;
          nextUpper.dimensions.height = minUpperH;
          notices.push(
            `🛡️ Tavan sınırı (${ceilingHeightMm} mm) nedeniyle alt ve üst dolap yükseklikleri sınırlandı.`
          );
        }
      } else {
        nextUpper.position.y = desiredUpperY;
      }
      upperChanged = true;
    }

    // 1b. Width & X Linked Column Sync + Overhang Prevention
    const wasWidthMatched =
      Math.abs(oldUpper.position.x - oldMod.position.x) <= 10 &&
      Math.abs(oldUpper.dimensions.width - oldMod.dimensions.width) <= 10;

    if (widthOrXChanged) {
      if (syncStackedColumns && wasWidthMatched) {
        nextUpper.position.x = nextMod.position.x;
        nextUpper.dimensions.width = nextMod.dimensions.width;
        syncStackedBaysToBase(nextUpper, nextMod);
        upperChanged = true;
      } else {
        // Even if independent width, prevent unsafe cantilever overhang (>25mm) when base shrinks
        const baseLeft = nextMod.position.x;
        const baseRight = baseLeft + nextMod.dimensions.width;
        let uLeft = nextUpper.position.x;
        let uRight = uLeft + nextUpper.dimensions.width;
        if (uLeft < baseLeft - 25 || uRight > baseRight + 25) {
          uLeft = Math.max(baseLeft, Math.min(uLeft, baseRight - 250));
          uRight = Math.min(baseRight, Math.max(uRight, uLeft + 250));
          nextUpper.position.x = uLeft;
          nextUpper.dimensions.width = Math.max(250, uRight - uLeft);
          upperChanged = true;
          notices.push(
            `🛡️ Konsol taşmasını önlemek için "${nextUpper.name}" alt dolap sınırlarına çekildi.`
          );
        }
      }
    }

    // 1c. Depth Sync & Front Overhang Guard
    if (depthChanged) {
      const wasDepthMatched = Math.abs(oldUpper.dimensions.depth - oldMod.dimensions.depth) <= 10;
      if ((syncStackedColumns && wasDepthMatched) || nextUpper.dimensions.depth > nextMod.dimensions.depth) {
        nextUpper.dimensions.depth = nextMod.dimensions.depth;
        upperChanged = true;
      }
    }

    if (upperChanged) {
      modules[uIdx] = nextUpper;
      syncAttachedComplementariesForModule(modules, nextUpper);
    }
  }

  // ---------------------------------------------------------------------------
  // 2. CONTIGUOUS ROW REFLOW (Prevent overlap when widening base/kitchen cabinets)
  // ---------------------------------------------------------------------------
  if (reflowAdjacentRow && widthOrXChanged) {
    const oldLeft = oldMod.position.x;
    const oldRight = oldLeft + oldMod.dimensions.width;
    const nextLeft = nextMod.position.x;
    const nextRight = nextLeft + nextMod.dimensions.width;

    // Collect same-row, same-orientation modules (excluding self, complementaries, and stacked uppers)
    const stackedIdSet = new Set(stackedIndices.map((idx) => modules[idx].id));
    const sameRowIndices = modules
      .map((m, idx) => ({ m, idx }))
      .filter(({ m, idx }) => {
        if (idx === modIdx || m.category === "complementary") return false;
        if (stackedIdSet.has(m.id)) return false;
        if (!isSameOrientation(oldMod, m)) return false;
        return Math.abs(m.position.y - oldMod.position.y) <= 20;
      });

    // 2a. Widened rightwards -> push colliding right neighbors cleanly
    if (nextRight > oldRight) {
      const rightNeighbors = sameRowIndices
        .filter(({ m }) => m.position.x >= oldRight - 15)
        .sort((a, b) => a.m.position.x - b.m.position.x);

      let cursorRight = nextRight;
      let pushedCount = 0;
      for (const { idx: nIdx } of rightNeighbors) {
        const nMod = modules[nIdx];
        if (nMod.position.x < cursorRight) {
          const shiftX = cursorRight - nMod.position.x;
          const shiftedMod: ModuleInstance = {
            ...nMod,
            position: { ...nMod.position, x: nMod.position.x + shiftX },
          };
          modules[nIdx] = shiftedMod;
          syncAttachedComplementariesForModule(modules, shiftedMod);

          // Also shift any stacked module sitting directly on top of this pushed neighbor
          for (let sIdx = 0; sIdx < modules.length; sIdx++) {
            if (sIdx === nIdx || sIdx === modIdx) continue;
            if (isDirectStackedOn(modules[sIdx], nMod)) {
              const sShifted: ModuleInstance = {
                ...modules[sIdx],
                position: { ...modules[sIdx].position, x: modules[sIdx].position.x + shiftX },
              };
              modules[sIdx] = sShifted;
              syncAttachedComplementariesForModule(modules, sShifted);
            }
          }

          // Shift sceneObjects hosted on this pushed neighbor
          sceneObjects = sceneObjects.map((so) =>
            so.hostModuleId === nMod.id
              ? { ...so, position: { ...so.position, x: so.position.x + shiftX } }
              : so
          );

          cursorRight = shiftedMod.position.x + shiftedMod.dimensions.width;
          pushedCount++;
        } else {
          // Non-colliding gap reached; stop cascading
          break;
        }
      }
      if (pushedCount > 0) {
        notices.push(`↔ Çakışmayı önlemek için sağdaki ${pushedCount} komşu modül otomatik ötelendi.`);
      }
    }

    // 2b. Widened leftwards -> push colliding left neighbors cleanly (if space >= 0)
    if (nextLeft < oldLeft) {
      const leftNeighbors = sameRowIndices
        .filter(({ m }) => m.position.x + m.dimensions.width <= oldLeft + 15)
        .sort((a, b) => (b.m.position.x + b.m.dimensions.width) - (a.m.position.x + a.m.dimensions.width));

      let cursorLeft = nextLeft;
      let pushedCount = 0;
      for (const { idx: nIdx } of leftNeighbors) {
        const nMod = modules[nIdx];
        const nRight = nMod.position.x + nMod.dimensions.width;
        if (nRight > cursorLeft) {
          const desiredShift = cursorLeft - nRight; // negative
          const nextNX = Math.max(0, nMod.position.x + desiredShift);
          const actualShift = nextNX - nMod.position.x;
          if (actualShift !== 0) {
            const shiftedMod: ModuleInstance = {
              ...nMod,
              position: { ...nMod.position, x: nextNX },
            };
            modules[nIdx] = shiftedMod;
            syncAttachedComplementariesForModule(modules, shiftedMod);
            for (let sIdx = 0; sIdx < modules.length; sIdx++) {
              if (sIdx === nIdx || sIdx === modIdx) continue;
              if (isDirectStackedOn(modules[sIdx], nMod)) {
                const sShifted: ModuleInstance = {
                  ...modules[sIdx],
                  position: { ...modules[sIdx].position, x: modules[sIdx].position.x + actualShift },
                };
                modules[sIdx] = sShifted;
                syncAttachedComplementariesForModule(modules, sShifted);
              }
            }
            sceneObjects = sceneObjects.map((so) =>
              so.hostModuleId === nMod.id
                ? { ...so, position: { ...so.position, x: so.position.x + actualShift } }
                : so
            );
            pushedCount++;
          }
          cursorLeft = nextNX;
        } else {
          break;
        }
      }
      if (pushedCount > 0) {
        notices.push(`↔ Çakışmayı önlemek için soldaki ${pushedCount} komşu modül otomatik ötelendi.`);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 3. HOSTED SCENE OBJECTS (Cooktop / Sink Auto-Centering & Min Width Check)
  // ---------------------------------------------------------------------------
  const deltaX = nextMod.position.x - oldMod.position.x;
  const deltaZ = nextMod.position.z - oldMod.position.z;
  const deltaTopYFinal = newTopY - oldTopY;

  sceneObjects = sceneObjects.map((so) => {
    if (so.hostModuleId !== oldMod.id) return so;
    const isTopMounted = isCountertopAppliance(so);
    const oldCenteredX = Math.round(oldMod.position.x + (oldMod.dimensions.width - so.dimensions.width) / 2);
    const wasCenteredX = Math.abs(so.position.x - oldCenteredX) <= 45;

    let nextSoX = wasCenteredX
      ? Math.round(nextMod.position.x + (nextMod.dimensions.width - so.dimensions.width) / 2)
      : so.position.x + deltaX;
    // Keep inside cabinet footprint when possible
    if (nextMod.dimensions.width >= so.dimensions.width) {
      nextSoX = Math.max(
        nextMod.position.x,
        Math.min(nextMod.position.x + nextMod.dimensions.width - so.dimensions.width, nextSoX)
      );
    }

    const oldCenteredZ = Math.round(oldMod.position.z + (oldMod.dimensions.depth - so.dimensions.depth) / 2);
    const wasCenteredZ = Math.abs(so.position.z - oldCenteredZ) <= 45;
    const nextSoZ =
      isTopMounted && wasCenteredZ
        ? Math.round(nextMod.position.z + (nextMod.dimensions.depth - so.dimensions.depth) / 2)
        : so.position.z + deltaZ;

    const nextSoY = isTopMounted
      ? Math.max(newTopY + 38, so.position.y + deltaTopYFinal)
      : so.position.y + deltaTopYFinal;

    if (isTopMounted && nextMod.dimensions.width < so.dimensions.width) {
      notices.push(
        `⚠️ "${so.name}" (${so.dimensions.width} mm) için alt dolap genişliği yetersiz (${nextMod.dimensions.width} mm).`
      );
    }

    return {
      ...so,
      position: {
        x: nextSoX,
        y: nextSoY,
        z: nextSoZ,
      },
    };
  });

  // ---------------------------------------------------------------------------
  // 4. KITCHEN BASE HEIGHT <-> FLOATING KITCHEN WALL CLEARANCE GUARD
  // ---------------------------------------------------------------------------
  if (isKitchenBaseModule(nextMod) && deltaTopYFinal !== 0) {
    const countertopTopY = newTopY + 38;
    const hostsCooktop = sceneObjects.some(
      (so) => so.hostModuleId === nextMod.id && isCooktopAppliance(so)
    );
    const minClearanceMm = hostsCooktop ? 650 : 450;

    const baseLeft = nextMod.position.x;
    const baseRight = baseLeft + nextMod.dimensions.width;

    for (let wIdx = 0; wIdx < modules.length; wIdx++) {
      const wMod = modules[wIdx];
      if (wIdx === modIdx || !isKitchenWallModule(wMod)) continue;
      if (!isSameOrientation(nextMod, wMod)) continue;
      const wLeft = wMod.position.x;
      const wRight = wLeft + wMod.dimensions.width;
      const overlapsX = wLeft < baseRight - 10 && wRight > baseLeft + 10;
      if (!overlapsX) continue;

      const currentClearance = wMod.position.y - countertopTopY;
      if (currentClearance < minClearanceMm) {
        const desiredWallY = countertopTopY + minClearanceMm;
        const maxSafeWallY = Math.max(wMod.position.y, ceilingHeightMm - wMod.dimensions.height);
        const clampedWallY = Math.min(desiredWallY, maxSafeWallY);
        if (clampedWallY > wMod.position.y) {
          const liftedWall: ModuleInstance = {
            ...wMod,
            position: { ...wMod.position, y: Math.round(clampedWallY / 10) * 10 },
          };
          modules[wIdx] = liftedWall;
          syncAttachedComplementariesForModule(modules, liftedWall);
          notices.push(
            `🛡️ Tezgah arası güvenlik mesafesi (${minClearanceMm} mm) için "${wMod.name}" Y=${liftedWall.position.y} mm kotuna yükseltildi.`
          );
        } else {
          notices.push(
            `⚠️ "${wMod.name}" ile tezgah arası mesafe ${Math.round(currentClearance)} mm (önerilen min ${minClearanceMm} mm).`
          );
        }
      }
    }
  }

  return { modules, sceneObjects, notices };
}
