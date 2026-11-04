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
  width: number; // along sheet width
  length: number; // along sheet length
  isRotated: boolean;
}

export interface OptimizedSheet {
  sheetIndex: number;
  materialId: string;
  materialName: string;
  sheetDimension: SheetDimension;
  placedPieces: PlacedPiece[];
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
 * Places cut pieces onto minimum number of standard sheets considering kerf, trimming and grain direction.
 */
export function optimizeSheetNesting(
  pieces: CutPiece[],
  sheetConfig: SheetDimension = STANDARD_SHEET_2800x2070
): NestingOptimizationResult[] {
  // Group pieces by material
  const materialGroups = new Map<string, CutPiece[]>();
  pieces.forEach((p) => {
    const list = materialGroups.get(p.materialId) || [];
    list.push(p);
    materialGroups.set(p.materialId, list);
  });

  const results: NestingOptimizationResult[] = [];

  materialGroups.forEach((matPieces, matId) => {
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

    // Helper to start a new sheet
    const createNewSheet = (idx: number): { sheet: OptimizedSheet; freeRects: FreeRect[] } => {
      return {
        sheet: {
          sheetIndex: idx + 1,
          materialId: matId,
          materialName: matName,
          sheetDimension: sheetConfig,
          placedPieces: [],
          netUsedAreaM2: 0,
          totalSheetAreaM2: fullSheetAreaM2,
          wasteAreaM2: fullSheetAreaM2,
          wastePercent: 100,
        },
        freeRects: [{ x: sheetConfig.trimCutMm, y: sheetConfig.trimCutMm, w: usableW, h: usableH }],
      };
    };

    let activeSheets: { sheet: OptimizedSheet; freeRects: FreeRect[] }[] = [];
    if (itemsToPlace.length > 0) {
      activeSheets.push(createNewSheet(0));
    }

    itemsToPlace.forEach((item) => {
      let placed = false;

      // Try to place in existing sheets
      for (const cur of activeSheets) {
        // Find best fit free rect (Best-Area Fit)
        let bestRectIdx = -1;
        let bestRotate = false;
        let minRemArea = Number.POSITIVE_INFINITY;

        for (let rIdx = 0; rIdx < cur.freeRects.length; rIdx++) {
          const rect = cur.freeRects[rIdx];

          // Option A: normal orientation
          if (item.w <= rect.w && item.h <= rect.h) {
            const rem = rect.w * rect.h - item.w * item.h;
            if (rem < minRemArea) {
              minRemArea = rem;
              bestRectIdx = rIdx;
              bestRotate = false;
            }
          }

          // Option B: rotated 90° if grain permits
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
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: placeW,
            length: placeH,
            isRotated: bestRotate,
          });

          cur.sheet.netUsedAreaM2 += (placeW * placeH) / 1_000_000;

          // Guillotine split of remaining free rect:
          // Right sub-rectangle and Top sub-rectangle
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

      // If couldn't place in any existing sheet, open a new sheet!
      if (!placed) {
        // Check if piece fundamentally exceeds single sheet size
        if (
          (item.w > usableW || item.h > usableH) &&
          (!item.canRotate || item.h > usableW || item.w > usableH)
        ) {
          unplaced.push(item.piece);
        } else {
          const newEntry = createNewSheet(activeSheets.length);
          activeSheets.push(newEntry);

          const rect = newEntry.freeRects[0];
          const bestRotate = item.w > rect.w && item.canRotate && item.h <= rect.w;
          const placeW = bestRotate ? item.h : item.w;
          const placeH = bestRotate ? item.w : item.h;

          newEntry.sheet.placedPieces.push({
            pieceId: item.piece.id,
            pieceName: item.piece.pieceName,
            materialName: item.piece.materialName,
            x: Math.round(rect.x),
            y: Math.round(rect.y),
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

    // Finalize sheet statistics
    let totalMatNetAreaM2 = 0;
    activeSheets.forEach((s) => {
      s.sheet.netUsedAreaM2 = Number(s.sheet.netUsedAreaM2.toFixed(3));
      s.sheet.wasteAreaM2 = Number(Math.max(0, s.sheet.totalSheetAreaM2 - s.sheet.netUsedAreaM2).toFixed(3));
      s.sheet.wastePercent = Number(((s.sheet.wasteAreaM2 / s.sheet.totalSheetAreaM2) * 100).toFixed(1));
      totalMatNetAreaM2 += s.sheet.netUsedAreaM2;
      sheets.push(s.sheet);
    });

    const totalGrossAreaM2 = sheets.length * fullSheetAreaM2;
    const overallWastePercent =
      totalGrossAreaM2 > 0
        ? Number((((totalGrossAreaM2 - totalMatNetAreaM2) / totalGrossAreaM2) * 100).toFixed(1))
        : 0;

    results.push({
      materialId: matId,
      materialName: matName,
      sheets,
      unplacedPieces: unplaced,
      totalSheetsCount: sheets.length,
      totalNetAreaM2: Number(totalMatNetAreaM2.toFixed(2)),
      totalGrossAreaM2: Number(totalGrossAreaM2.toFixed(2)),
      overallWastePercent,
    });
  });

  return results;
}
