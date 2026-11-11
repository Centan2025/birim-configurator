// ============================================================================
// packages/manufacturing/src/erp-nesting/erp-nesting-algorithm.ts
// Birim ERP lib/nestingAlgorithm.ts birebir MaxRects / Guillotine / Auto motoru
// ve Fire Geri Kazanımı (extractErpReclaimableRemnants)
// ============================================================================

import type {
  ErpNestingPartInput,
  ErpNestingOptimizationResult,
  ErpNestingSheetResult,
  ErpPlacementData,
  ErpReclaimableRemnant,
  ErpNestingOptimizationSettings,
  ErpCutSequence,
  ErpGrainDirection,
} from "./erp-nesting-types";
import { getErpPartColor } from "./erp-nesting-types";
import { ErpGuillotineEngine, type ErpSheetConfig } from "./erp-guillotine-engine";

interface ExpandedPart {
  original_index: number;
  instance_index: number;
  part_id: string;
  label: string;
  width: number;
  height: number;
  can_rotate: boolean;
  grain_direction: ErpGrainDirection | null;
  area: number;
  color: string;
  edgeL1?: string;
  edgeL2?: string;
  edgeW1?: string;
  edgeW2?: string;
  hasGroove?: boolean;
  grooveSide?: string;
  grooveOffset?: number;
  grooveWidth?: number;
  grooveDepth?: number;
}

interface MaxRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SheetState {
  index: number;
  free_rects: MaxRect[];
  placements: ErpPlacementData[];
  used_area: number;
  is_remnant?: boolean;
  remnant_id?: string;
  sheet_name?: string;
  usable_width?: number;
  usable_height?: number;
  sheet_width?: number;
  sheet_height?: number;
}

export function runErpNesting(
  parts: ErpNestingPartInput[],
  sheet: ErpSheetConfig,
  settings?: ErpNestingOptimizationSettings
): ErpNestingOptimizationResult {
  const chosenAlgo = settings?.algorithm ?? "Auto";

  if (chosenAlgo === "Guillotine") {
    const guillotineSheets = ErpGuillotineEngine.run(parts, sheet, settings);
    const totalPlaced = guillotineSheets.reduce((sum, s) => sum + s.placements.length, 0);
    const totalReq = parts.reduce((sum, p) => sum + Math.max(1, p.quantity || 1), 0);
    const totalUsed = guillotineSheets.reduce(
      (sum, s) => sum + s.placements.reduce((ps, p) => ps + p.width * p.height, 0),
      0
    );
    const totalAvailable =
      guillotineSheets.length * Number(sheet.width) * Number(sheet.height);
    const overallUtil = totalAvailable > 0 ? (totalUsed / totalAvailable) * 100 : 0;
    const totalWaste = Math.max(0, totalAvailable - totalUsed);

    return {
      sheets: guillotineSheets,
      total_parts_placed: totalPlaced,
      total_parts_requested: totalReq,
      overall_utilization: Math.round(overallUtil * 100) / 100,
      total_waste_mm2: totalWaste,
      algorithm: "Guillotine",
      computed_at: new Date().toISOString(),
      settings,
    };
  }

  if (chosenAlgo === "Auto") {
    const maxRectsRes = runMaxRects(parts, sheet, settings);
    const guillotineRes = runErpNesting(parts, sheet, {
      ...settings,
      algorithm: "Guillotine",
    });

    if (guillotineRes.sheets.length > 0 && maxRectsRes.sheets.length > 0) {
      if (
        guillotineRes.sheets.length < maxRectsRes.sheets.length ||
        (guillotineRes.sheets.length === maxRectsRes.sheets.length &&
          guillotineRes.overall_utilization >= maxRectsRes.overall_utilization)
      ) {
        return guillotineRes;
      }
    } else if (guillotineRes.sheets.length > 0 && maxRectsRes.sheets.length === 0) {
      return guillotineRes;
    }
    return maxRectsRes;
  }

  return runMaxRects(parts, sheet, settings);
}

function runMaxRects(
  parts: ErpNestingPartInput[],
  sheet: ErpSheetConfig,
  settings?: ErpNestingOptimizationSettings
): ErpNestingOptimizationResult {
  const margin = Number(settings?.edgeMargin ?? settings?.margin ?? sheet.margin);
  const useCommon = Boolean(settings?.useCommonCut ?? settings?.commonCut);
  const kerf = useCommon ? 0 : Number(settings?.sawKerf ?? settings?.kerf ?? sheet.kerf);
  const usableWidth = Number(sheet.width) - 2 * margin;
  const usableHeight = Number(sheet.height) - 2 * margin;

  if (usableWidth <= 0 || usableHeight <= 0) {
    return emptyResult();
  }

  const expanded = expandParts(parts, settings, sheet);
  if (expanded.length === 0) {
    return emptyResult();
  }

  expanded.sort((a, b) => b.area - a.area);

  const sheets: SheetState[] = [];
  let totalPlaced = 0;

  if (settings?.priorityRemnantSheets && settings.priorityRemnantSheets.length > 0) {
    for (let ri = 0; ri < settings.priorityRemnantSheets.length; ri++) {
      const rSheet = settings.priorityRemnantSheets[ri];
      const rMargin = Number(
        settings?.edgeMargin ?? settings?.margin ?? rSheet.margin ?? sheet.margin
      );
      const rUsableW = Number(rSheet.width) - 2 * rMargin;
      const rUsableH = Number(rSheet.height) - 2 * rMargin;
      if (rUsableW > 0 && rUsableH > 0) {
        sheets.push(
          createSheet(sheets.length, rUsableW, rUsableH, {
            is_remnant: true,
            remnant_id: rSheet.id,
            sheet_name: rSheet.name || `Artık Plaka ${ri + 1}`,
            sheet_width: Number(rSheet.width),
            sheet_height: Number(rSheet.height),
          })
        );
      }
    }
  }

  for (const part of expanded) {
    const partW = part.width + kerf;
    const partH = part.height + kerf;

    let placed = false;

    for (const sheetState of sheets) {
      const sUsableW = sheetState.usable_width ?? usableWidth;
      const sUsableH = sheetState.usable_height ?? usableHeight;
      if (
        tryPlace(sheetState, partW, partH, part, sheet, sUsableW, sUsableH, margin, kerf)
      ) {
        placed = true;
        totalPlaced++;
        break;
      }
    }

    if (!placed) {
      const newSheet = createSheet(sheets.length, usableWidth, usableHeight, {
        is_remnant: false,
        sheet_width: Number(sheet.width),
        sheet_height: Number(sheet.height),
      });
      if (
        tryPlace(newSheet, partW, partH, part, sheet, usableWidth, usableHeight, margin, kerf)
      ) {
        sheets.push(newSheet);
        totalPlaced++;
      }
    }
  }

  const totalRequested = expanded.length;
  const activeSheets = sheets.filter((s) => s.placements.length > 0);

  const sheetResults: ErpNestingSheetResult[] = activeSheets.map((s, idx) => {
    const sUsableW = s.usable_width ?? usableWidth;
    const sUsableH = s.usable_height ?? usableHeight;
    const sArea = sUsableW * sUsableH;
    const utilization = sArea > 0 ? (s.used_area / sArea) * 100 : 0;
    const waste = sArea - s.used_area;

    const sequences: ErpCutSequence[] = [];
    for (let i = 0; i < s.placements.length - 1; i++) {
      const p1 = s.placements[i];
      const p2 = s.placements[i + 1];
      sequences.push({
        stepNumber: i + 1,
        x1: p1.x + p1.width / 2,
        y1: p1.y + p1.height / 2,
        x2: p2.x + p2.width / 2,
        y2: p2.y + p2.height / 2,
        isTraversal: true,
      });
    }

    if (useCommon) {
      const tolerance = 1.0;
      s.placements.forEach((pl) => {
        const sh = { top: false, bottom: false, left: false, right: false };
        const x1 = pl.x;
        const x2 = pl.x + pl.width;
        const y1 = pl.y;
        const y2 = pl.y + pl.height;
        for (const other of s.placements) {
          if (other.part_id === pl.part_id) continue;
          const ox1 = other.x;
          const ox2 = other.x + other.width;
          const oy1 = other.y;
          const oy2 = other.y + other.height;
          const yOverlap = Math.min(y2, oy2) - Math.max(y1, oy1) > tolerance;
          const xOverlap = Math.min(x2, ox2) - Math.max(x1, ox1) > tolerance;
          if (yOverlap) {
            if (Math.abs(x1 - ox2) < tolerance) sh.left = true;
            if (Math.abs(x2 - ox1) < tolerance) sh.right = true;
          }
          if (xOverlap) {
            if (Math.abs(y1 - oy2) < tolerance) sh.top = true;
            if (Math.abs(y2 - oy1) < tolerance) sh.bottom = true;
          }
        }
        pl.isSharedEdge = sh;
      });
    }

    return {
      sheet_index: idx,
      placements: s.placements,
      utilization_percent: Math.round(utilization * 100) / 100,
      waste_mm2: Math.round(waste * 100) / 100,
      free_rects: s.free_rects.map((r) => ({
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
      })),
      sequences,
      is_remnant: s.is_remnant || false,
      remnant_id: s.remnant_id,
      sheet_name: s.sheet_name,
      sheet_width: s.sheet_width,
      sheet_height: s.sheet_height,
    };
  });

  const totalUsedArea = activeSheets.reduce((sum, s) => sum + s.used_area, 0);
  const totalAvailableArea = activeSheets.reduce(
    (sum, s) => sum + (s.usable_width ?? usableWidth) * (s.usable_height ?? usableHeight),
    0
  );
  const overallUtilization =
    totalAvailableArea > 0 ? (totalUsedArea / totalAvailableArea) * 100 : 0;

  return {
    sheets: sheetResults,
    total_parts_placed: totalPlaced,
    total_parts_requested: totalRequested,
    overall_utilization: Math.round(overallUtilization * 100) / 100,
    total_waste_mm2: Math.round((totalAvailableArea - totalUsedArea) * 100) / 100,
    algorithm: "bottom-left-maxrects",
    computed_at: new Date().toISOString(),
    settings,
  };
}

export function extractErpReclaimableRemnants(
  sheetResult: ErpNestingSheetResult,
  opts?: {
    minWidthMm?: number;
    minHeightMm?: number;
    sheetCost?: number | null;
    sheetAreaMm2?: number;
  }
): ErpReclaimableRemnant[] {
  const minW = opts?.minWidthMm ?? 400;
  const minH = opts?.minHeightMm ?? 400;
  const sheetCost = opts?.sheetCost ?? 0;
  const sheetArea = opts?.sheetAreaMm2 ?? 0;

  if (!sheetResult.free_rects || sheetResult.free_rects.length === 0) {
    return [];
  }

  const candidates = sheetResult.free_rects
    .filter(
      (r) =>
        (r.width >= minW && r.height >= minH) ||
        (r.width >= minH && r.height >= minW)
    )
    .map((r) => ({
      ...r,
      area: r.width * r.height,
    }));

  candidates.sort((a, b) => b.area - a.area);

  const selected: typeof candidates = [];

  for (const cand of candidates) {
    const overlaps = selected.some((s) => {
      const isDisjoint =
        cand.x + cand.width <= s.x ||
        s.x + s.width <= cand.x ||
        cand.y + cand.height <= s.y ||
        s.y + s.height <= cand.y;
      return !isDisjoint;
    });

    if (!overlaps) {
      selected.push(cand);
    }
  }

  return selected.map((r, idx) => {
    const area_mm2 = r.width * r.height;
    const estVal =
      sheetCost && sheetArea > 0
        ? Math.round((area_mm2 / sheetArea) * sheetCost * 100) / 100
        : 0;

    return {
      sheet_index: sheetResult.sheet_index,
      remnant_index: idx + 1,
      x_mm: r.x,
      y_mm: r.y,
      width_mm: r.width,
      height_mm: r.height,
      area_mm2,
      estimated_value: estVal,
    };
  });
}

function emptyResult(): ErpNestingOptimizationResult {
  return {
    sheets: [],
    total_parts_placed: 0,
    total_parts_requested: 0,
    overall_utilization: 0,
    total_waste_mm2: 0,
    algorithm: "bottom-left-maxrects",
    computed_at: new Date().toISOString(),
  };
}

function expandParts(
  parts: ErpNestingPartInput[],
  settings?: ErpNestingOptimizationSettings,
  sheet?: ErpSheetConfig
): ExpandedPart[] {
  const expanded: ExpandedPart[] = [];
  const globalRotationAllowed =
    settings?.rotationAllowed ?? settings?.allowRotation ?? true;
  const sheetGrain = sheet?.grain_direction || "vertical";
  const sheetIsPlain = sheetGrain === "none";

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const isHorizontalGrain =
      !sheetIsPlain && part.grain_direction === "horizontal";
    const w = isHorizontalGrain ? Number(part.height_mm) : Number(part.width_mm);
    const h = isHorizontalGrain ? Number(part.width_mm) : Number(part.height_mm);

    const partExplicitGrain =
      part.grain_direction === "horizontal" || part.grain_direction === "vertical";
    const effectivePartGrain: ErpGrainDirection | null = partExplicitGrain
      ? part.grain_direction
      : sheetIsPlain
      ? "none"
      : sheetGrain;
    const isGrainLocked =
      partExplicitGrain || (!sheetIsPlain && effectivePartGrain !== "none");
    const canRotate =
      !isGrainLocked && Boolean(part.can_rotate) && globalRotationAllowed;

    for (let q = 0; q < Number(part.quantity); q++) {
      expanded.push({
        original_index: i,
        instance_index: q,
        part_id: `part-${i}-${q}`,
        label: part.part_label,
        width: w,
        height: h,
        can_rotate: canRotate,
        grain_direction: effectivePartGrain,
        area: w * h,
        color: getErpPartColor(i),
        edgeL1: part.edgeL1,
        edgeL2: part.edgeL2,
        edgeW1: part.edgeW1,
        edgeW2: part.edgeW2,
        hasGroove: part.hasGroove,
        grooveSide: part.grooveSide,
        grooveOffset: part.grooveOffset,
        grooveWidth: part.grooveWidth,
        grooveDepth: part.grooveDepth,
      });
    }
  }

  return expanded;
}

function createSheet(
  index: number,
  width: number,
  height: number,
  meta?: {
    is_remnant?: boolean;
    remnant_id?: string;
    sheet_name?: string;
    sheet_width?: number;
    sheet_height?: number;
  }
): SheetState {
  return {
    index,
    free_rects: [{ x: 0, y: 0, width, height }],
    placements: [],
    used_area: 0,
    is_remnant: meta?.is_remnant || false,
    remnant_id: meta?.remnant_id,
    sheet_name: meta?.sheet_name,
    usable_width: width,
    usable_height: height,
    sheet_width: meta?.sheet_width,
    sheet_height: meta?.sheet_height,
  };
}

function tryPlace(
  sheetState: SheetState,
  partW: number,
  partH: number,
  part: ExpandedPart,
  _config: ErpSheetConfig,
  _usableWidth: number,
  _usableHeight: number,
  margin: number,
  kerf: number
): boolean {
  let bestShortSideFit = Infinity;
  let bestLongSideFit = Infinity;
  let bestRotated = false;
  let bestRectIndex = -1;
  const canRotate =
    part.can_rotate && (!part.grain_direction || part.grain_direction === "none");

  for (let i = 0; i < sheetState.free_rects.length; i++) {
    const rect = sheetState.free_rects[i];

    if (partW <= rect.width && partH <= rect.height) {
      const leftoverW = Math.abs(rect.width - partW);
      const leftoverH = Math.abs(rect.height - partH);
      const shortSideFit = Math.min(leftoverW, leftoverH);
      const longSideFit = Math.max(leftoverW, leftoverH);

      if (
        shortSideFit < bestShortSideFit ||
        (shortSideFit === bestShortSideFit && longSideFit < bestLongSideFit)
      ) {
        bestShortSideFit = shortSideFit;
        bestLongSideFit = longSideFit;
        bestRotated = false;
        bestRectIndex = i;
      }
    }

    if (canRotate && partH <= rect.width && partW <= rect.height) {
      const leftoverW = Math.abs(rect.width - partH);
      const leftoverH = Math.abs(rect.height - partW);
      const shortSideFit = Math.min(leftoverW, leftoverH);
      const longSideFit = Math.max(leftoverW, leftoverH);

      if (
        shortSideFit < bestShortSideFit ||
        (shortSideFit === bestShortSideFit && longSideFit < bestLongSideFit)
      ) {
        bestShortSideFit = shortSideFit;
        bestLongSideFit = longSideFit;
        bestRotated = true;
        bestRectIndex = i;
      }
    }
  }

  if (bestRectIndex === -1) {
    return false;
  }

  const bestRect = sheetState.free_rects[bestRectIndex];
  const placedW = bestRotated ? partH : partW;
  const placedH = bestRotated ? partW : partH;
  const actualW = placedW - kerf;
  const actualH = placedH - kerf;

  const placement: ErpPlacementData = {
    part_id: part.part_id,
    part_label: part.label,
    x: margin + bestRect.x,
    y: margin + bestRect.y,
    width: actualW,
    height: actualH,
    rotated: bestRotated,
    rotation: bestRotated ? 90 : 0,
    color: part.color,
    edgeL1: part.edgeL1,
    edgeL2: part.edgeL2,
    edgeW1: part.edgeW1,
    edgeW2: part.edgeW2,
    hasGroove: part.hasGroove,
    grooveSide: part.grooveSide,
    grooveOffset: part.grooveOffset,
    grooveWidth: part.grooveWidth,
    grooveDepth: part.grooveDepth,
    grain_direction: part.grain_direction,
    can_rotate: part.can_rotate,
  };

  sheetState.placements.push(placement);
  sheetState.used_area += actualW * actualH;

  splitFreeRects(sheetState, bestRect, bestRectIndex, placedW, placedH);
  return true;
}

function splitFreeRects(
  sheetState: SheetState,
  rect: MaxRect,
  rectIdx: number,
  placedW: number,
  placedH: number
): void {
  sheetState.free_rects.splice(rectIdx, 1);

  const rightW = rect.width - placedW;
  if (rightW > 1) {
    sheetState.free_rects.push({
      x: rect.x + placedW,
      y: rect.y,
      width: rightW,
      height: rect.height,
    });
  }

  const topH = rect.height - placedH;
  if (topH > 1) {
    sheetState.free_rects.push({
      x: rect.x,
      y: rect.y + placedH,
      width: placedW,
      height: topH,
    });
  }

  sheetState.free_rects = sheetState.free_rects.filter(
    (r) => r.width >= 5 && r.height >= 5
  );
}
