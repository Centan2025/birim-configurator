import { CutPiece } from "./types";

export interface SheetDimension {
  name: string;
  lengthMm: number; // e.g. 2800 mm
  widthMm: number; // e.g. 2070 mm
  trimCutMm: number; // e.g. 15 mm perimeter trim
  kerfMm: number; // e.g. 4.4 mm saw blade thickness
}

export const STANDARD_SHEET_2800x2070: SheetDimension = {
  name: "Standart Ham/Melamin Levha 2800x2070",
  lengthMm: 2800,
  widthMm: 2070,
  trimCutMm: 15,
  kerfMm: 4.4,
};

export interface PlacedPiece {
  pieceId: string;
  pieceName: string;
  materialName: string;
  x: number;
  y: number;
  width: number; // X extent, along sheet length
  length: number; // Y extent, along sheet width
  isRotated: boolean;
}

export interface UsableRemnantRect {
  x: number;
  y: number;
  width: number;
  length: number;
  areaM2: number;
}

export interface OptimizedSheet {
  sheetIndex: number;
  materialId: string;
  materialName: string;
  sheetDimension: SheetDimension;
  placedPieces: PlacedPiece[];
  usableRemnants?: UsableRemnantRect[];
  usableRemnantAreaM2?: number;
  netUsedAreaM2: number;
  totalSheetAreaM2: number;
  wasteAreaM2: number;
  wastePercent: number;
}

export interface NestingOptimizationResult {
  materialId: string;
  materialName: string;
  sheets: OptimizedSheet[];
  unplacedPieces: CutPiece[];
  totalSheetsCount: number;
  totalNetAreaM2: number;
  totalGrossAreaM2: number;
  overallWastePercent: number;
}

interface FreeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * 2D Guillotine Bin Packing Optimizer.
 * Places cut pieces onto minimum number of standard sheets considering kerf, trimming, grain direction,
 * and reusable offcut (remnant >= 300x300mm) consolidation.
 * Reference: doublesharp/bin-packing (MIT), tyschroed/guillotine-packer (MIT).
 */
const nestingCache = new Map<string, NestingOptimizationResult[]>();

function computeNestingKey(pieces: CutPiece[], sheetConfig: SheetDimension): string {
  return JSON.stringify([sheetConfig, pieces]);
}

export function optimizeSheetNesting(
  pieces: CutPiece[],
  sheetConfig: SheetDimension = STANDARD_SHEET_2800x2070
): NestingOptimizationResult[] {
  if (!pieces || pieces.length === 0) return [];

  const cacheKey = computeNestingKey(pieces, sheetConfig);
  const cached = nestingCache.get(cacheKey);
  if (cached) return cached;

  // Group pieces by material + thickness
  const materialGroups = new Map<string, CutPiece[]>();
  pieces.forEach((p) => {
    const groupKey = `${p.materialId}::${p.thicknessMm}`;
    const list = materialGroups.get(groupKey) || [];
    list.push(p);
    materialGroups.set(groupKey, list);
  });

  const results: NestingOptimizationResult[] = [];

  materialGroups.forEach((matPieces) => {
    const matId = matPieces[0].materialId;
    const matName = matPieces[0]?.materialName || "Bilinmeyen Malzeme";
    const usableW = sheetConfig.lengthMm - 2 * sheetConfig.trimCutMm;
    const usableH = sheetConfig.widthMm - 2 * sheetConfig.trimCutMm;
    const kerf = sheetConfig.kerfMm;
    const fullSheetAreaM2 = (sheetConfig.lengthMm * sheetConfig.widthMm) / 1_000_000;

    // Expand pieces by quantity and sort descending by area (First-Fit Decreasing)
    const itemsToPlace: { piece: CutPiece; w: number; h: number; canRotate: boolean }[] = [];
    matPieces.forEach((p) => {
      for (let q = 0; q < p.quantity; q++) {
        itemsToPlace.push({
          piece: p,
          w: p.lengthMm,
          h: p.widthMm,
          canRotate: p.grain === "none",
        });
      }
    });

    itemsToPlace.sort((a, b) => b.w * b.h - a.w * a.h);

    const sheets: OptimizedSheet[] = [];
    const unplaced: CutPiece[] = [];

    const createNewSheet = (idx: number): { sheet: OptimizedSheet; freeRects: FreeRect[] } => {
      return {
        sheet: {
          sheetIndex: idx + 1,
          materialId: matId,
          materialName: matName,
          sheetDimension: sheetConfig,
          placedPieces: [],
          usableRemnants: [],
          usableRemnantAreaM2: 0,
          netUsedAreaM2: 0,
          totalSheetAreaM2: fullSheetAreaM2,
          wasteAreaM2: fullSheetAreaM2,
          wastePercent: 100,
        },
        freeRects: [{ x: sheetConfig.trimCutMm, y: sheetConfig.trimCutMm, w: usableW, h: usableH }],
      };
    };

    const activeSheets: { sheet: OptimizedSheet; freeRects: FreeRect[] }[] = [];

    itemsToPlace.forEach((item) => {
      let placed = false;

      for (const cur of activeSheets) {
        let bestRectIdx = -1;
        let bestRotate = false;
        let minRemArea = Number.POSITIVE_INFINITY;

        for (let rIdx = 0; rIdx < cur.freeRects.length; rIdx++) {
          const rect = cur.freeRects[rIdx];

          if (item.w <= rect.w && item.h <= rect.h) {
            const rem = rect.w * rect.h - item.w * item.h;
            if (rem < minRemArea) {
              minRemArea = rem;
              bestRectIdx = rIdx;
              bestRotate = false;
            }
          }

          if (item.canRotate && item.h <= rect.w && item.w <= rect.h) {
            const rem = rect.w * rect.h - item.w * item.h;
            if (rem < minRemArea) {
              minRemArea = rem;
              bestRectIdx = rIdx;
              bestRotate = true;
            }
          }
        }

        if (bestRectIdx >= 0) {
          const rect = cur.freeRects[bestRectIdx];
          const placeW = bestRotate ? item.h : item.w;
          const placeH = bestRotate ? item.w : item.h;

          cur.sheet.placedPieces.push({
            pieceId: item.piece.id,
            pieceName: item.piece.pieceName,
            materialName: item.piece.materialName,
            x: rect.x,
            y: rect.y,
            width: placeW,
            length: placeH,
            isRotated: bestRotate,
          });

          cur.sheet.netUsedAreaM2 += (placeW * placeH) / 1_000_000;
          cur.freeRects.splice(bestRectIdx, 1);

          const rightW = rect.w - placeW - kerf;
          if (rightW > 50) {
            cur.freeRects.push({
              x: rect.x + placeW + kerf,
              y: rect.y,
              w: rightW,
              h: placeH,
            });
          }

          const topH = rect.h - placeH - kerf;
          if (topH > 50) {
            cur.freeRects.push({
              x: rect.x,
              y: rect.y + placeH + kerf,
              w: rect.w,
              h: topH,
            });
          }

          placed = true;
          break;
        }
      }

      if (!placed) {
        if (
          (item.w > usableW || item.h > usableH) &&
          (!item.canRotate || item.h > usableW || item.w > usableH)
        ) {
          unplaced.push(item.piece);
        } else {
          const newEntry = createNewSheet(activeSheets.length);
          activeSheets.push(newEntry);

          const rect = newEntry.freeRects[0];
          const bestRotate =
            (item.w > rect.w || item.h > rect.h) &&
            item.canRotate &&
            item.h <= rect.w &&
            item.w <= rect.h;
          const placeW = bestRotate ? item.h : item.w;
          const placeH = bestRotate ? item.w : item.h;

          newEntry.sheet.placedPieces.push({
            pieceId: item.piece.id,
            pieceName: item.piece.pieceName,
            materialName: item.piece.materialName,
            x: rect.x,
            y: rect.y,
            width: placeW,
            length: placeH,
            isRotated: bestRotate,
          });

          newEntry.sheet.netUsedAreaM2 += (placeW * placeH) / 1_000_000;
          newEntry.freeRects.splice(0, 1);

          const rightW = rect.w - placeW - kerf;
          if (rightW > 50) {
            newEntry.freeRects.push({
              x: rect.x + placeW + kerf,
              y: rect.y,
              w: rightW,
              h: placeH,
            });
          }

          const topH = rect.h - placeH - kerf;
          if (topH > 50) {
            newEntry.freeRects.push({
              x: rect.x,
              y: rect.y + placeH + kerf,
              w: rect.w,
              h: topH,
            });
          }
        }
      }
    });

    let totalNetM2 = 0;
    activeSheets.forEach((entry) => {
      const s = entry.sheet;
      s.netUsedAreaM2 = Number(s.netUsedAreaM2.toFixed(3));
      s.wasteAreaM2 = Number(Math.max(0, s.totalSheetAreaM2 - s.netUsedAreaM2).toFixed(3));
      s.wastePercent = Number(((s.wasteAreaM2 / s.totalSheetAreaM2) * 100).toFixed(1));
      // Identify reusable stock remnants (>= 300mm x 300mm)
      const remnants = entry.freeRects
        .filter((r) => r.w >= 300 && r.h >= 300)
        .map((r) => ({
          x: Math.round(r.x),
          y: Math.round(r.y),
          width: Math.round(r.w),
          length: Math.round(r.h),
          areaM2: Number(((r.w * r.h) / 1_000_000).toFixed(3)),
        }));
      s.usableRemnants = remnants;
      s.usableRemnantAreaM2 = Number(remnants.reduce((acc, rm) => acc + rm.areaM2, 0).toFixed(3));
      totalNetM2 += s.netUsedAreaM2;
      sheets.push(s);
    });

    const totalGrossM2 = Number((sheets.length * fullSheetAreaM2).toFixed(3));
    const overallWastePercent =
      totalGrossM2 > 0 ? Number((((totalGrossM2 - totalNetM2) / totalGrossM2) * 100).toFixed(1)) : 0;

    results.push({
      materialId: matId,
      materialName: matName,
      sheets,
      unplacedPieces: unplaced,
      totalSheetsCount: sheets.length,
      totalNetAreaM2: Number(totalNetM2.toFixed(3)),
      totalGrossAreaM2: totalGrossM2,
      overallWastePercent,
    });
  });

  if (nestingCache.size >= 32) {
    const oldestKey = nestingCache.keys().next().value;
    if (oldestKey) nestingCache.delete(oldestKey);
  }
  nestingCache.set(cacheKey, results);

  return results;
}
