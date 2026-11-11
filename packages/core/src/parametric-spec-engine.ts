import {
  ContinuousBacksplashSegment,
  ContinuousCountertopSegment,
  ContinuousLayersSummary,
  ContinuousPlinthSegment,
  DesignProject,
  ModuleInstance,
  PartitionCellNode,
  ValidationIssue,
} from "./types";
import {
  calculateBayWidths,
  calculateModulePlacement,
  calculateNetInnerDepth,
  calculateNetInnerHeight,
  roundIntMm,
  roundMm,
} from "./rules";

/**
 * Checks if a module is a fully integrated built-in dishwasher slot ("Tam Ankastre Bulaşık Makinesi"):
 * - Carcassless 600mm floor niche between adjacent base cabinets
 * - Only exterior furniture door panel + continuous upper countertop + continuous lower plinth!
 */
export function isBuiltInDishwasherModule(module: ModuleInstance): boolean {
  if (module.isFreestandingDishwasher) return true;
  const sig = `${module.id} ${module.name} ${module.templateId || ""}`.toLowerCase();
  return (
    sig.includes("dishwasher") ||
    sig.includes("bulaşık") ||
    sig.includes("bulasik") ||
    sig.includes("_dsh")
  );
}

export function isSinkModule(module: ModuleInstance): boolean {
  const sig = `${module.id} ${module.name} ${module.templateId || ""}`.toLowerCase();
  return sig.includes("sink") || sig.includes("evye") || sig.includes("eviye");
}

export function isCooktopModule(module: ModuleInstance): boolean {
  const sig = `${module.id} ${module.name} ${module.templateId || ""}`.toLowerCase();
  return sig.includes("cooktop") || sig.includes("ocak") || sig.includes("oven_base");
}

export function isBuiltInOvenOrFridgeTower(module: ModuleInstance): boolean {
  const sig = `${module.id} ${module.name} ${module.templateId || ""}`.toLowerCase();
  return (
    sig.includes("oven") ||
    sig.includes("fırın") ||
    sig.includes("firin") ||
    sig.includes("fridge") ||
    sig.includes("buzdolab") ||
    sig.includes("soğutucu")
  );
}

/**
 * Builds the canonical Recursive Partition Tree (`PartitionCellNode`) from a `ModuleInstance`
 * so any UI cell-inspector or CAM exporter can traverse unlimited horizontal/vertical sub-divisions.
 */
export function buildRecursivePartitionTree(module: ModuleInstance): PartitionCellNode {
  const T = module.carcass.panelThickness || 18;
  const plinth = module.carcass.plinthHeight || 0;
  const netH = calculateNetInnerHeight(module);
  const netD = calculateNetInnerDepth(module);
  const bayWidths = calculateBayWidths(module);
  const zMin =
    module.carcass.backPanelType === "none" || module.carcass.backPanelType === "nailed"
      ? 0
      : module.carcass.backPanelType === "grooved"
      ? (module.carcass.backOffsetMm ?? 18) + (module.carcass.backPanelThickness || 8)
      : module.carcass.backPanelThickness || 8;
  const zMax = zMin + netD;

  const rootBounds = {
    minX: T,
    maxX: Math.max(T, module.dimensions.width - T),
    minY: plinth + T,
    maxY: plinth + T + netH,
    minZ: zMin,
    maxZ: zMax,
  };

  const buildBayNode = (bayIdx: number, x0: number, bayW: number): PartitionCellNode => {
    const bay = module.bays[bayIdx];
    const bayBounds = {
      minX: roundMm(x0),
      maxX: roundMm(x0 + bayW),
      minY: rootBounds.minY,
      maxY: rootBounds.maxY,
      minZ: zMin,
      maxZ: zMax,
    };
    if (!bay) {
      return { id: `cell_${module.id}_b${bayIdx}`, bounds: bayBounds, splitType: "NONE", children: [] };
    }

    const fixedShelves = [...(bay.shelves || [])]
      .filter((s) => !s.isAdjustable && !s.isHidden)
      .sort((a, b) => a.elevationY - b.elevationY);

    if (fixedShelves.length === 0) {
      return {
        id: `cell_${module.id}_b${bayIdx}`,
        bounds: bayBounds,
        splitType: "NONE",
        children: [],
        contents: {
          shelves: bay.shelves.filter((s) => s.isAdjustable && !s.isHidden),
          drawers: bay.drawers.filter((d) => !d.isHidden),
          hangingRails: bay.hangingRails.filter((r) => !r.isHidden),
          specialFittings: bay.specialFittings.filter((f) => !f.isHidden),
        },
        assignedDoor: bay.door,
      };
    }

    const stackChildren: PartitionCellNode[] = [];
    let curY = 0;
    fixedShelves.forEach((fs, fsIdx) => {
      const topY = Math.min(netH, fs.elevationY);
      if (topY > curY + 20) {
        stackChildren.push({
          id: `cell_${module.id}_b${bayIdx}_v${fsIdx}`,
          bounds: {
            minX: bayBounds.minX,
            maxX: bayBounds.maxX,
            minY: roundMm(rootBounds.minY + curY),
            maxY: roundMm(rootBounds.minY + topY),
            minZ: zMin,
            maxZ: zMax,
          },
          splitType: "NONE",
          children: [],
          contents: {
            shelves: bay.shelves.filter(
              (s) => s.isAdjustable && !s.isHidden && s.elevationY >= curY && s.elevationY < topY
            ),
            drawers: bay.drawers.filter(
              (d) => !d.isHidden && d.elevationY >= curY - 2 && d.elevationY < topY
            ),
            hangingRails: bay.hangingRails.filter(
              (r) => !r.isHidden && r.elevationY >= curY && r.elevationY <= topY
            ),
            specialFittings: bay.specialFittings.filter(
              (f) => !f.isHidden && f.elevationY >= curY && f.elevationY <= topY
            ),
          },
        });
      }
      curY = topY + (fs.thickness || T);
    });

    if (netH > curY + 20) {
      stackChildren.push({
        id: `cell_${module.id}_b${bayIdx}_v${fixedShelves.length}`,
        bounds: {
          minX: bayBounds.minX,
          maxX: bayBounds.maxX,
          minY: roundMm(rootBounds.minY + curY),
          maxY: roundMm(rootBounds.minY + netH),
          minZ: zMin,
          maxZ: zMax,
        },
        splitType: "NONE",
        children: [],
        contents: {
          shelves: bay.shelves.filter((s) => s.isAdjustable && !s.isHidden && s.elevationY >= curY),
          drawers: bay.drawers.filter((d) => !d.isHidden && d.elevationY >= curY - 2),
          hangingRails: bay.hangingRails.filter((r) => !r.isHidden && r.elevationY >= curY),
          specialFittings: bay.specialFittings.filter((f) => !f.isHidden && f.elevationY >= curY),
        },
      });
    }

    return {
      id: `cell_${module.id}_b${bayIdx}`,
      bounds: bayBounds,
      splitType: "HORIZONTAL_STACK",
      dividerThicknessMm: T,
      children: stackChildren,
      assignedDoor: bay.door,
    };
  };

  if (module.bays.length <= 1) {
    return buildBayNode(0, T, bayWidths[0] || Math.max(0, module.dimensions.width - 2 * T));
  }

  let cursorX = T;
  const colChildren = module.bays.map((_, idx) => {
    const bw = bayWidths[idx] || 0;
    const node = buildBayNode(idx, cursorX, bw);
    cursorX += bw + T;
    return node;
  });

  return {
    id: `cell_root_${module.id}`,
    bounds: rootBounds,
    splitType: "VERTICAL_COLUMNS",
    dividerThicknessMm: T,
    children: colChildren,
  };
}

/**
 * Evaluates Sliding Door Dead Zones (MD Spec Section 6.3 & Checklist #6):
 * On 2-leaf or 3-leaf sliding wardrobes, doors overlap by `overlapMm` (typically 60mm)
 * and have a maximum slide travel limited by carcass ends. Any bay containing drawers
 * or pull-out accessories whose clear X interval intersects a permanently or partially
 * blocked sliding door overlap zone cannot pull out!
 */
export function evaluateSlidingDoorDeadZones(
  module: ModuleInstance,
  overlapMm = 60
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const hasSliding = module.bays.some((b) => {
    const ds = b.door?.doorSystemId || "";
    return b.door?.type === "sliding" || b.door?.type === "sliding_bottom" || ds.startsWith("sliding");
  });
  if (!hasSliding || module.bays.length < 2) return issues;

  const T = module.carcass.panelThickness || 18;
  const W = module.dimensions.width;
  const numLeaves = Math.min(4, Math.max(2, module.bays.length));
  const innerSpan = Math.max(200, W - 2 * T);
  const leafWidth = roundMm((innerSpan + overlapMm * (numLeaves - 1)) / numLeaves, 1);
  const bayWidths = calculateBayWidths(module);

  let curX = T;
  module.bays.forEach((bay, bIdx) => {
    const bayMinX = curX;
    const bayMaxX = curX + (bayWidths[bIdx] || 0);
    curX = bayMaxX + T;

    const hasPullout =
      bay.drawers.some((d) => !d.isHidden) ||
      (bay.specialFittings || []).some(
        (f) =>
          !f.isHidden &&
          (f.type === "trouser_rack" ||
            f.type === "wire_basket" ||
            f.type === "jewelry_tray" ||
            f.type === "shoe_rack")
      );
    if (!hasPullout) return;

    // Determine maximum clear opening around this bay when all other sliding leaves are stacked
    // Away from this bay (either stacked at left [T .. T + leafWidth] or at right [W - T - leafWidth .. W - T]).
    // Note: in a 2-leaf sliding wardrobe with 3 unequal bays or a middle bay straddling the center,
    // the stacked leaves ALWAYS cover either [T .. T + leafWidth] OR [W - T - leafWidth .. W - T]!
    const clearWhenStackedRight = { minX: T, maxX: W - T - leafWidth };
    const clearWhenStackedLeft = { minX: T + leafWidth, maxX: W - T };

    const fitsWhenStackedRight =
      bayMinX >= clearWhenStackedRight.minX - 2 && bayMaxX <= clearWhenStackedRight.maxX + 2;
    const fitsWhenStackedLeft =
      bayMinX >= clearWhenStackedLeft.minX - 2 && bayMaxX <= clearWhenStackedLeft.maxX + 2;

    if (!fitsWhenStackedRight && !fitsWhenStackedLeft) {
      const blockedByMm = Math.round(
        Math.min(
          Math.max(0, bayMaxX - clearWhenStackedRight.maxX),
          Math.max(0, clearWhenStackedLeft.minX - bayMinX)
        )
      );
      issues.push({
        severity: "error",
        code: "ERR_SLIDING_DEAD_ZONE_DRAWER_CLASH",
        message: `Bölme ${bIdx + 1} (${Math.round(bayMinX)}–${Math.round(
          bayMaxX
        )}mm) sürgü kapak binme ölü bölgesine (${blockedByMm}mm) denk geliyor; kapak tam açılsa bile çekmece/raylı aksesuar kapağa çarpar!`,
        targetId: `bay_${bIdx}`,
        blockingProduction: true,
        compatibilityStatus: "INCOMPATIBLE",
        suggestions: [
          `Çekmeceyi kenar bölmeye taşıyın veya sürgü kanat sayısı (${numLeaves}) ile bölme sayısını eşitleyin.`,
          `İç bölme genişliğini daraltarak ölü bölgeden (${blockedByMm}mm) kurtarın.`,
        ],
      });
    }
  });

  return issues;
}

/**
 * Computes CNC L-Gola (26×57mm top front corner) and C-Gola (26×73.5mm intermediate drawer gap)
 * notches on side panels and intermediate dividers when Gola handleless system is active.
 */
export function computeGolaSidePanelNotches(
  module: ModuleInstance,
  sidePanelBottomYMm: number,
  sidePanelHeightMm: number
): { kind: "L_TOP" | "C_MID"; yBottomMm: number; widthMm: number; heightMm: number }[] {
  const hasGola = module.bays.some((b) => b.door?.handleCategory === "gola_profile");
  if (!hasGola || module.category === "kitchen_wall" || module.category === "complementary") {
    return [];
  }

  const notches: { kind: "L_TOP" | "C_MID"; yBottomMm: number; widthMm: number; heightMm: number }[] = [];
  const T = module.carcass.panelThickness || 18;
  const plinth = module.carcass.plinthHeight || 0;

  // 1. Horizontal Top L-Gola Notch (26mm deep x 57mm high at top front corner of base module)
  if (module.category === "kitchen_base" || module.category === "kitchen_island" || module.category === "kitchen_corner") {
    const yTopNotch = Math.max(0, roundMm(sidePanelHeightMm - 57, 1));
    notches.push({
      kind: "L_TOP",
      yBottomMm: yTopNotch,
      widthMm: 26,
      heightMm: 57,
    });
  }

  // 2. Horizontal Intermediate C-Gola Notches (26mm deep x 73.5mm high between stacked external drawers)
  const cGolaCenters = new Set<number>();
  module.bays.forEach((bay) => {
    if (bay.door?.handleCategory !== "gola_profile") return;
    const extDrawers = [...bay.drawers]
      .filter((d) => !d.isInternal && !d.isHidden)
      .sort((a, b) => a.elevationY - b.elevationY);
    for (let i = 0; i < extDrawers.length - 1; i++) {
      const jointWorldY = plinth + T + extDrawers[i].elevationY + extDrawers[i].height;
      const localY = roundMm(jointWorldY - sidePanelBottomYMm - 73.5 / 2, 1);
      if (localY > 20 && localY + 73.5 < sidePanelHeightMm - 30) {
        cGolaCenters.add(localY);
      }
    }
  });

  Array.from(cGolaCenters)
    .sort((a, b) => a - b)
    .forEach((yBot) => {
      notches.push({
        kind: "C_MID",
        yBottomMm: yBot,
        widthMm: 26,
        heightMm: 73.5,
      });
    });

  return notches;
}

/**
 * Computes T-junction Y coordinates (mm from divider bottom) where two fixed shelves in
 * adjacent bays meet at the same height on opposite faces of a 18mm intermediate divider.
 */
export function computeDividerTJunctionYs(
  module: ModuleInstance,
  dividerBayIndex: number
): number[] {
  const leftBay = module.bays[dividerBayIndex];
  const rightBay = module.bays[dividerBayIndex + 1];
  if (!leftBay || !rightBay) return [];

  const leftFixed = leftBay.shelves.filter((s) => !s.isAdjustable && !s.isHidden);
  const rightFixed = rightBay.shelves.filter((s) => !s.isAdjustable && !s.isHidden);
  const tJunctionYs: number[] = [];

  for (const ls of leftFixed) {
    if (rightFixed.some((rs) => Math.abs(rs.elevationY - ls.elevationY) <= 16)) {
      tJunctionYs.push(roundMm(ls.elevationY + (ls.thickness || module.carcass.panelThickness || 18) / 2, 1));
    }
  }
  return tJunctionYs;
}

/**
 * Continuous Multi-Module Kitchen Layer Solver (MD Spec Section 8 & Checklist #20):
 * Scans collinear adjacent kitchen base/island modules and unifies:
 * 1. Continuous Countertops (+40mm front overhang, +15mm open end overhang, Waterfall options,
 *    3200mm slab seam detection avoiding sink/cooktop cutouts, >300mm rear bar support check,
 *    and exact 3D cutout apertures for every sink & cooktop).
 * 2. Continuous Plinth Runs (setback 35-55mm + side return panels only on exposed ends).
 * 3. Continuous Backsplash m² runs between countertop and upper wall cabinets.
 */
export function computeContinuousKitchenLayers(project: DesignProject): ContinuousLayersSummary {
  const baseCandidates = project.modules.filter(
    (m) =>
      m.category === "kitchen_base" ||
      m.category === "kitchen_island" ||
      (m.category === "kitchen_corner" && m.dimensions.height <= 1150)
  );

  if (baseCandidates.length === 0) {
    return { countertops: [], plinths: [], backsplashes: [] };
  }

  // Group collinear modules by rotationY & Z-row (within 25mm tolerance) and Y top height (within 15mm)
  interface ModSpan {
    mod: ModuleInstance;
    rotY: number;
    minAlong: number;
    maxAlong: number;
    fixedOrtho: number;
    depth: number;
  }

  const spans: ModSpan[] = baseCandidates.map((mod) => {
    const rotY = (((mod.rotation?.y ?? 0) % 360) + 360) % 360;
    const place = calculateModulePlacement(mod);
    const isZAxisRun = rotY === 90 || rotY === 270;
    return {
      mod,
      rotY,
      minAlong: isZAxisRun ? mod.position.z : mod.position.x,
      maxAlong: isZAxisRun ? mod.position.z + place.depth : mod.position.x + place.width,
      fixedOrtho: isZAxisRun ? mod.position.x : mod.position.z,
      depth: isZAxisRun ? place.width : place.depth,
    };
  });

  const groups: ModSpan[][] = [];
  const sorted = [...spans].sort((a, b) =>
    a.rotY !== b.rotY
      ? a.rotY - b.rotY
      : Math.abs(a.fixedOrtho - b.fixedOrtho) > 35
      ? a.fixedOrtho - b.fixedOrtho
      : a.minAlong - b.minAlong
  );

  for (const item of sorted) {
    const lastGroup = groups[groups.length - 1];
    if (!lastGroup) {
      groups.push([item]);
      continue;
    }
    const prev = lastGroup[lastGroup.length - 1];
    const sameAxis = prev.rotY === item.rotY && Math.abs(prev.fixedOrtho - item.fixedOrtho) <= 35;
    const sameHeight = Math.abs(prev.mod.dimensions.height - item.mod.dimensions.height) <= 15;
    const touching = item.minAlong <= prev.maxAlong + 5;
    if (sameAxis && sameHeight && touching) {
      lastGroup.push(item);
    } else {
      groups.push([item]);
    }
  }

  const countertops: ContinuousCountertopSegment[] = [];
  const plinths: ContinuousPlinthSegment[] = [];
  const backsplashes: ContinuousBacksplashSegment[] = [];

  groups.forEach((grp, gIdx) => {
    const first = grp[0].mod;
    const last = grp[grp.length - 1].mod;
    const rotY = grp[0].rotY;
    const isZAxisRun = rotY === 90 || rotY === 270;
    const startAlong = Math.min(...grp.map((g) => g.minAlong));
    const endAlong = Math.max(...grp.map((g) => g.maxAlong));
    const carcassSpan = Math.max(100, endAlong - startAlong);
    const maxCarcassDepth = Math.max(...grp.map((g) => g.mod.dimensions.depth));
    const topY = first.position.y + first.dimensions.height;

    const frontOverhangMm = 40; // 20mm door + 20mm drip edge (MD Spec Section 8.1)
    const leftOverhangMm = first.isCorner ? 0 : 15;
    const rightOverhangMm = last.isCorner ? 0 : 15;
    const rearOverhangMm = Math.max(
      0,
      ...grp.map((g) => g.mod.carcass.islandOverhangRearMm ?? (g.mod.category === "kitchen_island" ? 280 : 0))
    );
    const waterfallLeft = Boolean(first.carcass.hasWaterfallLeft);
    const waterfallRight = Boolean(last.carcass.hasWaterfallRight);
    const totalWidth = carcassSpan + leftOverhangMm + rightOverhangMm;
    const totalDepth = maxCarcassDepth + frontOverhangMm + rearOverhangMm;
    const slabMaxLengthMm = 3200;

    // Collect sink & cooktop cutouts in segment local coordinates
    const cutouts: ContinuousCountertopSegment["cutouts"] = [];
    grp.forEach((g) => {
      const m = g.mod;
      const isSink = isSinkModule(m);
      const isHob = isCooktopModule(m);
      if (!isSink && !isHob) return;
      const mW = m.dimensions.width;
      const mD = m.dimensions.depth;
      const cutW = isSink ? Math.min(560, Math.max(320, mW - 80)) : Math.min(580, Math.max(320, mW - 80));
      const cutD = isSink ? Math.min(460, Math.max(280, mD - 110)) : Math.min(500, Math.max(280, mD - 100));
      const centerAlong = leftOverhangMm + (g.minAlong - startAlong) + mW / 2;
      const centerZ = rearOverhangMm + mD / 2 + 10;
      cutouts.push({
        id: `cut_${m.id}`,
        kind: isSink ? "sink" : "cooktop",
        localCenterXMm: roundMm(centerAlong, 1),
        localCenterZMm: roundMm(centerZ, 1),
        widthMm: cutW,
        depthMm: cutD,
      });
    });

    // Compute slab seam positions (> 3200mm) and shift away from sink/cooktop cutouts if possible
    const seamPositionsXMm: number[] = [];
    let hasSeamCutoutConflict = false;
    if (totalWidth > slabMaxLengthMm) {
      const count = Math.ceil(totalWidth / slabMaxLengthMm) - 1;
      for (let s = 1; s <= count; s++) {
        let seamX = Math.round((totalWidth * s) / (count + 1));
        for (const co of cutouts) {
          const halfW = co.widthMm / 2 + 80; // min 80mm stone bridge safety margin
          if (Math.abs(seamX - co.localCenterXMm) < halfW) {
            const shiftedLeft = co.localCenterXMm - halfW - 20;
            const shiftedRight = co.localCenterXMm + halfW + 20;
            if (shiftedLeft > 250 && shiftedLeft <= slabMaxLengthMm) {
              seamX = Math.round(shiftedLeft);
            } else if (totalWidth - shiftedRight <= slabMaxLengthMm && shiftedRight < totalWidth - 250) {
              seamX = Math.round(shiftedRight);
            } else {
              hasSeamCutoutConflict = true;
            }
          }
        }
        seamPositionsXMm.push(seamX);
      }
    }

    const ctopMatId = first.carcass.countertopMaterialId || "mat_neolith_calacatta_luxe";
    countertops.push({
      id: `ctop_run_${gIdx + 1}`,
      moduleIds: grp.map((g) => g.mod.id),
      x: isZAxisRun ? grp[0].fixedOrtho : startAlong - leftOverhangMm,
      y: topY,
      z: isZAxisRun ? startAlong - leftOverhangMm : grp[0].fixedOrtho - rearOverhangMm,
      width: totalWidth,
      thickness: 38,
      depth: totalDepth,
      rotationY: rotY,
      materialId: ctopMatId,
      frontOverhangMm,
      leftOverhangMm,
      rightOverhangMm,
      rearOverhangMm,
      waterfallLeft,
      waterfallRight,
      slabMaxLengthMm,
      seamPositionsXMm,
      hasSeamCutoutConflict,
      requiresSupportBrackets: rearOverhangMm > 300,
      cutouts,
    });

    // Continuous Plinth Run
    const plinthH = first.carcass.plinthHeight || 100;
    if (plinthH > 0) {
      const setback = first.carcass.plinthSetbackMm ?? 50;
      const plinthMat = first.carcass.plinthMaterialId || first.carcass.doorMaterialId || first.carcass.bodyMaterialId;
      plinths.push({
        id: `plinth_run_${gIdx + 1}`,
        moduleIds: grp.map((g) => g.mod.id),
        x: isZAxisRun ? grp[0].fixedOrtho : startAlong,
        y: first.position.y,
        z: isZAxisRun ? startAlong : grp[0].fixedOrtho + maxCarcassDepth - setback - 18,
        lengthMm: carcassSpan,
        heightMm: plinthH,
        thicknessMm: 18,
        setbackMm: setback,
        rotationY: rotY,
        hasLeftReturn: !first.isCorner && startAlong > 20,
        hasRightReturn: !last.isCorner,
        returnDepthMm: Math.max(80, maxCarcassDepth - setback - 20),
        materialId: plinthMat,
      });
    }

    // Continuous Backsplash (on wall-backed runs)
    if (first.category !== "kitchen_island" && rotY === 0) {
      const splashH = 600; // Standard 600mm backsplash between 860mm countertop and 1460mm wall cabinet
      backsplashes.push({
        id: `backsplash_run_${gIdx + 1}`,
        x: startAlong,
        y: topY + 38,
        z: grp[0].fixedOrtho,
        widthMm: carcassSpan,
        heightMm: splashH,
        thicknessMm: 12,
        areaM2: roundMm((carcassSpan * splashH) / 1_000_000, 2),
        materialId: ctopMatId,
      });
    }
  });

  return { countertops, plinths, backsplashes };
}
