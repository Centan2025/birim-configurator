import type { CutPiece } from "./types";
import type { NestingOptimizationResult, SheetDimension } from "./sheet-nesting";

/**
 * Single-Source-of-Truth Portable 2D Guillotine Nesting Kernel.
 * Executed directly in JS/TS AND serialized via `.toString()` into the browser Web Worker
 * so there is ZERO hand-maintained duplicate string worker code.
 */
export function runPortableGuillotineNestingKernel(
  pieces: CutPiece[],
  rawSheetConfig?: Partial<SheetDimension>
): NestingOptimizationResult[] {
  const sheetConfig: SheetDimension = {
    name: rawSheetConfig?.name || "Standart Ham/Melamin Levha 2800x2070",
    lengthMm: rawSheetConfig?.lengthMm || 2800,
    widthMm: rawSheetConfig?.widthMm || 2070,
    trimCutMm: rawSheetConfig?.trimCutMm ?? 15,
    kerfMm: rawSheetConfig?.kerfMm ?? 4.0,
  };
  if (!pieces || pieces.length === 0) return [];

  const materialGroups = new Map<string, CutPiece[]>();
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    const key = `${p.materialId}::${p.thicknessMm}`;
    const list = materialGroups.get(key) || [];
    list.push(p);
    materialGroups.set(key, list);
  }

  const results: NestingOptimizationResult[] = [];
  materialGroups.forEach((matPieces) => {
    const matId = matPieces[0].materialId;
    const matName = matPieces[0].materialName || "Bilinmeyen Malzeme";
    const usableW = sheetConfig.lengthMm - 2 * sheetConfig.trimCutMm;
    const usableH = sheetConfig.widthMm - 2 * sheetConfig.trimCutMm;
    const kerf = sheetConfig.kerfMm;
    const fullSheetAreaM2 = (sheetConfig.lengthMm * sheetConfig.widthMm) / 1_000_000;

    const itemsToPlace: { piece: CutPiece; w: number; h: number; canRotate: boolean }[] = [];
    for (let j = 0; j < matPieces.length; j++) {
      const piece = matPieces[j];
      const netL = typeof piece.netCutLengthMm === "number" ? piece.netCutLengthMm : piece.lengthMm;
      const netW = typeof piece.netCutWidthMm === "number" ? piece.netCutWidthMm : piece.widthMm;
      const itemW = piece.grain === "crosswise" ? netW : netL;
      const itemH = piece.grain === "crosswise" ? netL : netW;
      for (let q = 0; q < piece.quantity; q++) {
        itemsToPlace.push({
          piece,
          w: itemW,
          h: itemH,
          canRotate: piece.grain === "none",
        });
      }
    }

    itemsToPlace.sort((a, b) => b.w * b.h - a.w * a.h);
    const sheets: NestingOptimizationResult["sheets"] = [];
    const unplaced: CutPiece[] = [];
    const activeSheets: {
      sheet: NestingOptimizationResult["sheets"][number];
      freeRects: { x: number; y: number; w: number; h: number }[];
    }[] = [];

    const createNewSheet = (idx: number): (typeof activeSheets)[number] => ({
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
    });

    for (let k = 0; k < itemsToPlace.length; k++) {
      const item = itemsToPlace[k];
      let placed = false;
      for (let sIdx = 0; sIdx < activeSheets.length; sIdx++) {
        const cur = activeSheets[sIdx];
        let bestRectIdx = -1;
        let bestRotate = false;
        let minRemArea = Infinity;
        for (let rIdx = 0; rIdx < cur.freeRects.length; rIdx++) {
          const rect = cur.freeRects[rIdx];
          if (item.w <= rect.w && item.h <= rect.h) {
            const remA = rect.w * rect.h - item.w * item.h;
            if (remA < minRemArea) {
              minRemArea = remA;
              bestRectIdx = rIdx;
              bestRotate = false;
            }
          }
          if (item.canRotate && item.h <= rect.w && item.w <= rect.h) {
            const remB = rect.w * rect.h - item.w * item.h;
            if (remB < minRemArea) {
              minRemArea = remB;
              bestRectIdx = rIdx;
              bestRotate = true;
            }
          }
        }
        if (bestRectIdx >= 0) {
          const chosen = cur.freeRects[bestRectIdx];
          const placeW = bestRotate ? item.h : item.w;
          const placeH = bestRotate ? item.w : item.h;
          cur.sheet.placedPieces.push({
            pieceId: item.piece.id,
            pieceName: item.piece.pieceName,
            materialName: item.piece.materialName,
            x: chosen.x,
            y: chosen.y,
            width: placeW,
            length: placeH,
            isRotated: bestRotate,
            hasGroove: Boolean(item.piece.hasBackGroove),
            grooveOffset: item.piece.backGrooveOffsetMm,
            grainDirection: item.piece.grain === "none" ? "none" : "vertical",
            polygonContourMm: item.piece.polygonContourMm,
          });
          cur.sheet.netUsedAreaM2 += (placeW * placeH) / 1_000_000;
          cur.freeRects.splice(bestRectIdx, 1);
          const rightW = chosen.w - placeW - kerf;
          if (rightW > 50) {
            cur.freeRects.push({ x: chosen.x + placeW + kerf, y: chosen.y, w: rightW, h: placeH });
          }
          const topH = chosen.h - placeH - kerf;
          if (topH > 50) {
            cur.freeRects.push({ x: chosen.x, y: chosen.y + placeH + kerf, w: chosen.w, h: topH });
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
          const firstRect = newEntry.freeRects[0];
          const rotNew =
            (item.w > firstRect.w || item.h > firstRect.h) &&
            item.canRotate &&
            item.h <= firstRect.w &&
            item.w <= firstRect.h;
          const pw = rotNew ? item.h : item.w;
          const ph = rotNew ? item.w : item.h;
          newEntry.sheet.placedPieces.push({
            pieceId: item.piece.id,
            pieceName: item.piece.pieceName,
            materialName: item.piece.materialName,
            x: firstRect.x,
            y: firstRect.y,
            width: pw,
            length: ph,
            isRotated: rotNew,
            hasGroove: Boolean(item.piece.hasBackGroove),
            grooveOffset: item.piece.backGrooveOffsetMm,
            grainDirection: item.piece.grain === "none" ? "none" : "vertical",
            polygonContourMm: item.piece.polygonContourMm,
          });
          newEntry.sheet.netUsedAreaM2 += (pw * ph) / 1_000_000;
          newEntry.freeRects.splice(0, 1);
          const rw = firstRect.w - pw - kerf;
          if (rw > 50) {
            newEntry.freeRects.push({ x: firstRect.x + pw + kerf, y: firstRect.y, w: rw, h: ph });
          }
          const th = firstRect.h - ph - kerf;
          if (th > 50) {
            newEntry.freeRects.push({ x: firstRect.x, y: firstRect.y + ph + kerf, w: firstRect.w, h: th });
          }
        }
      }
    }

    let totalMatNetAreaM2 = 0;
    let totalUsableRemnantAreaM2 = 0;
    for (let m = 0; m < activeSheets.length; m++) {
      const s = activeSheets[m];
      const usableRemnants = [];
      let sheetRemArea = 0;
      for (let frIdx = 0; frIdx < s.freeRects.length; frIdx++) {
        const fr = s.freeRects[frIdx];
        if (fr.w >= 300 && fr.h >= 300) {
          const areaM2 = Number(((fr.w * fr.h) / 1_000_000).toFixed(3));
          sheetRemArea += areaM2;
          usableRemnants.push({
            id: `rem_${matId}_s${s.sheet.sheetIndex}_${frIdx + 1}`,
            x: Math.round(fr.x),
            y: Math.round(fr.y),
            width: Math.round(fr.w),
            length: Math.round(fr.h),
            areaM2,
          });
        }
      }
      s.sheet.usableRemnants = usableRemnants;
      s.sheet.usableRemnantAreaM2 = Number(sheetRemArea.toFixed(3));
      s.sheet.netUsedAreaM2 = Number(s.sheet.netUsedAreaM2.toFixed(3));
      s.sheet.wasteAreaM2 = Number(
        Math.max(0, s.sheet.totalSheetAreaM2 - s.sheet.netUsedAreaM2).toFixed(3)
      );
      s.sheet.wastePercent = Number(
        ((s.sheet.wasteAreaM2 / s.sheet.totalSheetAreaM2) * 100).toFixed(1)
      );
      totalMatNetAreaM2 += s.sheet.netUsedAreaM2;
      totalUsableRemnantAreaM2 += s.sheet.usableRemnantAreaM2;
      sheets.push(s.sheet);
    }

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
      usableRemnantAreaM2: Number(totalUsableRemnantAreaM2.toFixed(2)),
      overallWastePercent,
    });
  });

  return results;
}

export function buildPortableNestingWorkerBootstrapSource(): string {
  const fnSource = runPortableGuillotineNestingKernel.toString();
  return [
    `const __kernel = ${fnSource};`,
    `self.onmessage = function(e) {`,
    `  var data = e.data || {};`,
    `  try {`,
    `    var result = __kernel(data.pieces || [], data.sheetConfig);`,
    `    self.postMessage({ ok: true, result: result });`,
    `  } catch (err) {`,
    `    self.postMessage({ ok: false, error: err && err.message ? err.message : "Worker nesting error" });`,
    `  }`,
    `};`,
  ].join("\n");
}
