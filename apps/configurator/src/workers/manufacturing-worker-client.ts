import {
  CutPiece,
  NestingOptimizationResult,
  SheetDimension,
  optimizeSheetNesting,
  STANDARD_SHEET_2800x2070,
} from "@birim/manufacturing";

export interface AsyncNestingJob {
  jobId: string;
  projectId: string;
  revisionId: string;
  version: number;
  sequenceId: number;
  piecesCount: number;
  status: "pending" | "computing" | "completed" | "cancelled";
  executionMode: "web_worker" | "async_fallback";
  result?: NestingOptimizationResult[];
  durationMs?: number;
  error?: string;
}

export interface NestingWorkerRequestOptions {
  projectId?: string;
  revisionId?: string;
}

let activeSequenceId = 0;
let latestSequenceByProject = new Map<string, number>();
let activeProjectId = "default_project";
let currentJob: AsyncNestingJob | null = null;
let activeBrowserWorker: Worker | null = null;
let activeWorkerBlobUrl: string | null = null;
const listeners = new Set<(job: AsyncNestingJob) => void>();

function terminateActiveWorkerAndBlob(): void {
  if (activeBrowserWorker) {
    activeBrowserWorker.terminate();
    activeBrowserWorker = null;
  }
  if (activeWorkerBlobUrl && typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
    URL.revokeObjectURL(activeWorkerBlobUrl);
    activeWorkerBlobUrl = null;
  }
}

const INLINE_NESTING_WORKER_SOURCE = `
self.onmessage = function(e) {
  var data = e.data || {};
  var pieces = data.pieces || [];
  var sheetConfig = data.sheetConfig || {
    name: "Standart Ham/Melamin Levha 2800x2070",
    lengthMm: 2800,
    widthMm: 2070,
    trimCutMm: 15,
    kerfMm: 4.4
  };
  if (!pieces.length) {
    self.postMessage({ ok: true, result: [] });
    return;
  }
  try {
    var materialGroups = new Map();
    for (var i = 0; i < pieces.length; i++) {
      var p = pieces[i];
      var key = p.materialId + "::" + p.thicknessMm;
      var list = materialGroups.get(key) || [];
      list.push(p);
      materialGroups.set(key, list);
    }
    var results = [];
    materialGroups.forEach(function(matPieces) {
      var matId = matPieces[0].materialId;
      var matName = matPieces[0].materialName || "Bilinmeyen Malzeme";
      var usableW = sheetConfig.lengthMm - 2 * sheetConfig.trimCutMm;
      var usableH = sheetConfig.widthMm - 2 * sheetConfig.trimCutMm;
      var kerf = sheetConfig.kerfMm;
      var fullSheetAreaM2 = (sheetConfig.lengthMm * sheetConfig.widthMm) / 1000000;
      var itemsToPlace = [];
      for (var j = 0; j < matPieces.length; j++) {
        var piece = matPieces[j];
        var netL = typeof piece.netCutLengthMm === "number" ? piece.netCutLengthMm : piece.lengthMm;
        var netW = typeof piece.netCutWidthMm === "number" ? piece.netCutWidthMm : piece.widthMm;
        var itemW = piece.grain === "crosswise" ? netW : netL;
        var itemH = piece.grain === "crosswise" ? netL : netW;
        for (var q = 0; q < piece.quantity; q++) {
          itemsToPlace.push({
            piece: piece,
            w: itemW,
            h: itemH,
            canRotate: piece.grain === "none"
          });
        }
      }
      itemsToPlace.sort(function(a, b) { return b.w * b.h - a.w * a.h; });
      var sheets = [];
      var unplaced = [];
      var activeSheets = [];
      function createNewSheet(idx) {
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
            wastePercent: 100
          },
          freeRects: [{ x: sheetConfig.trimCutMm, y: sheetConfig.trimCutMm, w: usableW, h: usableH }]
        };
      }
      for (var k = 0; k < itemsToPlace.length; k++) {
        var item = itemsToPlace[k];
        var placed = false;
        for (var sIdx = 0; sIdx < activeSheets.length; sIdx++) {
          var cur = activeSheets[sIdx];
          var bestRectIdx = -1;
          var bestRotate = false;
          var minRemArea = Infinity;
          for (var rIdx = 0; rIdx < cur.freeRects.length; rIdx++) {
            var rect = cur.freeRects[rIdx];
            if (item.w <= rect.w && item.h <= rect.h) {
              var remA = rect.w * rect.h - item.w * item.h;
              if (remA < minRemArea) { minRemArea = remA; bestRectIdx = rIdx; bestRotate = false; }
            }
            if (item.canRotate && item.h <= rect.w && item.w <= rect.h) {
              var remB = rect.w * rect.h - item.w * item.h;
              if (remB < minRemArea) { minRemArea = remB; bestRectIdx = rIdx; bestRotate = true; }
            }
          }
          if (bestRectIdx >= 0) {
            var chosen = cur.freeRects[bestRectIdx];
            var placeW = bestRotate ? item.h : item.w;
            var placeH = bestRotate ? item.w : item.h;
            cur.sheet.placedPieces.push({
              pieceId: item.piece.id,
              pieceName: item.piece.pieceName,
              materialName: item.piece.materialName,
              x: chosen.x,
              y: chosen.y,
              width: placeW,
              length: placeH,
              isRotated: bestRotate
            });
            cur.sheet.netUsedAreaM2 += (placeW * placeH) / 1000000;
            cur.freeRects.splice(bestRectIdx, 1);
            var rightW = chosen.w - placeW - kerf;
            if (rightW > 50) cur.freeRects.push({ x: chosen.x + placeW + kerf, y: chosen.y, w: rightW, h: placeH });
            var topH = chosen.h - placeH - kerf;
            if (topH > 50) cur.freeRects.push({ x: chosen.x, y: chosen.y + placeH + kerf, w: chosen.w, h: topH });
            placed = true;
            break;
          }
        }
        if (!placed) {
          if ((item.w > usableW || item.h > usableH) && (!item.canRotate || item.h > usableW || item.w > usableH)) {
            unplaced.push(item.piece);
          } else {
            var newEntry = createNewSheet(activeSheets.length);
            activeSheets.push(newEntry);
            var firstRect = newEntry.freeRects[0];
            var rotNew = (item.w > firstRect.w || item.h > firstRect.h) && item.canRotate && item.h <= firstRect.w && item.w <= firstRect.h;
            var pw = rotNew ? item.h : item.w;
            var ph = rotNew ? item.w : item.h;
            newEntry.sheet.placedPieces.push({
              pieceId: item.piece.id,
              pieceName: item.piece.pieceName,
              materialName: item.piece.materialName,
              x: firstRect.x,
              y: firstRect.y,
              width: pw,
              length: ph,
              isRotated: rotNew
            });
            newEntry.sheet.netUsedAreaM2 += (pw * ph) / 1000000;
            newEntry.freeRects.splice(0, 1);
            var rw = firstRect.w - pw - kerf;
            if (rw > 50) newEntry.freeRects.push({ x: firstRect.x + pw + kerf, y: firstRect.y, w: rw, h: ph });
            var th = firstRect.h - ph - kerf;
            if (th > 50) newEntry.freeRects.push({ x: firstRect.x, y: firstRect.y + ph + kerf, w: firstRect.w, h: th });
          }
        }
      }
      var totalMatNetAreaM2 = 0;
      var totalUsableRemnantAreaM2 = 0;
      for (var m = 0; m < activeSheets.length; m++) {
        var s = activeSheets[m];
        var usableRemnants = [];
        var sheetRemArea = 0;
        for (var frIdx = 0; frIdx < s.freeRects.length; frIdx++) {
          var fr = s.freeRects[frIdx];
          if (fr.w >= 300 && fr.h >= 300) {
            var areaM2 = Number(((fr.w * fr.h) / 1000000).toFixed(3));
            sheetRemArea += areaM2;
            usableRemnants.push({
              id: "rem_" + matId + "_s" + s.sheet.sheetIndex + "_" + (frIdx + 1),
              x: Math.round(fr.x),
              y: Math.round(fr.y),
              width: Math.round(fr.w),
              length: Math.round(fr.h),
              areaM2: areaM2
            });
          }
        }
        s.sheet.usableRemnants = usableRemnants;
        s.sheet.usableRemnantAreaM2 = Number(sheetRemArea.toFixed(3));
        s.sheet.netUsedAreaM2 = Number(s.sheet.netUsedAreaM2.toFixed(3));
        s.sheet.wasteAreaM2 = Number(Math.max(0, s.sheet.totalSheetAreaM2 - s.sheet.netUsedAreaM2).toFixed(3));
        s.sheet.wastePercent = Number(((s.sheet.wasteAreaM2 / s.sheet.totalSheetAreaM2) * 100).toFixed(1));
        totalMatNetAreaM2 += s.sheet.netUsedAreaM2;
        totalUsableRemnantAreaM2 += s.sheet.usableRemnantAreaM2;
        sheets.push(s.sheet);
      }
      var totalGrossAreaM2 = sheets.length * fullSheetAreaM2;
      var overallWastePercent = totalGrossAreaM2 > 0
        ? Number((((totalGrossAreaM2 - totalMatNetAreaM2) / totalGrossAreaM2) * 100).toFixed(1))
        : 0;
      results.push({
        materialId: matId,
        materialName: matName,
        sheets: sheets,
        unplacedPieces: unplaced,
        totalSheetsCount: sheets.length,
        totalNetAreaM2: Number(totalMatNetAreaM2.toFixed(2)),
        totalGrossAreaM2: Number(totalGrossAreaM2.toFixed(2)),
        usableRemnantAreaM2: Number(totalUsableRemnantAreaM2.toFixed(2)),
        overallWastePercent: overallWastePercent
      });
    });
    self.postMessage({ ok: true, result: results });
  } catch (err) {
    self.postMessage({ ok: false, error: err && err.message ? err.message : "Worker nesting error" });
  }
};
`;

export function subscribeNestingJob(listener: (job: AsyncNestingJob) => void): () => void {
  listeners.add(listener);
  if (currentJob) listener(currentJob);
  return () => {
    listeners.delete(listener);
  };
}

function notify(job: AsyncNestingJob) {
  currentJob = job;
  listeners.forEach((fn) => fn(job));
}

export function resetNestingWorkerState(): void {
  terminateActiveWorkerAndBlob();
  activeSequenceId = 0;
  latestSequenceByProject = new Map();
  activeProjectId = "default_project";
  currentJob = null;
}

/**
 * Dispatches heavy nesting bin-packing asynchronously.
 * WP-12 Contract:
 * - Tracks `projectId + revisionId + jobId + sequenceId`.
 * - Executes inside an isolated browser Web Worker thread when `Worker` + `Blob` are available,
 *   immediately terminating any superseded in-flight worker and revoking its Blob URL, and falls
 *   back to async scheduling in non-Worker environments (such as Node/Vitest).
 */
export async function computeNestingAsync(
  pieces: CutPiece[],
  version: number,
  sheetConfig: SheetDimension = STANDARD_SHEET_2800x2070,
  options: NestingWorkerRequestOptions = {}
): Promise<NestingOptimizationResult[] | null> {
  terminateActiveWorkerAndBlob();

  const sequenceId = ++activeSequenceId;
  const projectId = options.projectId || "default_project";
  const revisionId = options.revisionId || `rev_v${version}`;

  activeProjectId = projectId;
  latestSequenceByProject.set(projectId, sequenceId);

  const jobId = `nest_${projectId}_${revisionId}_seq${sequenceId}`;
  const hasBrowserWorker =
    typeof window !== "undefined" &&
    typeof Worker !== "undefined" &&
    typeof Blob !== "undefined" &&
    typeof URL !== "undefined" &&
    typeof URL.createObjectURL === "function";

  const job: AsyncNestingJob = {
    jobId,
    projectId,
    revisionId,
    version,
    sequenceId,
    piecesCount: pieces.length,
    status: "computing",
    executionMode: hasBrowserWorker ? "web_worker" : "async_fallback",
  };
  notify(job);

  const isStale = () =>
    activeProjectId !== projectId ||
    (latestSequenceByProject.get(projectId) ?? 0) > sequenceId;

  const t0 = performance.now();

  if (hasBrowserWorker) {
    return new Promise((resolve) => {
      let localBlobUrl: string | null = null;
      try {
        const blob = new Blob([INLINE_NESTING_WORKER_SOURCE], {
          type: "application/javascript",
        });
        localBlobUrl = URL.createObjectURL(blob);
        activeWorkerBlobUrl = localBlobUrl;
        const worker = new Worker(localBlobUrl);
        activeBrowserWorker = worker;

        const cleanup = () => {
          if (localBlobUrl) {
            URL.revokeObjectURL(localBlobUrl);
            if (activeWorkerBlobUrl === localBlobUrl) {
              activeWorkerBlobUrl = null;
            }
            localBlobUrl = null;
          }
          if (activeBrowserWorker === worker) {
            activeBrowserWorker = null;
          }
        };

        worker.onmessage = (
          ev: MessageEvent<{ ok: boolean; result?: NestingOptimizationResult[]; error?: string }>
        ) => {
          cleanup();
          const durationMs = Number((performance.now() - t0).toFixed(2));
          if (isStale()) {
            notify({ ...job, status: "cancelled", durationMs });
            resolve(null);
            return;
          }
          if (ev.data?.ok && ev.data.result) {
            const completedJob: AsyncNestingJob = {
              ...job,
              status: "completed",
              result: ev.data.result,
              durationMs,
            };
            notify(completedJob);
            resolve(ev.data.result);
          } else {
            notify({
              ...job,
              status: "cancelled",
              error: ev.data?.error || "Nesting worker hatası",
            });
            resolve(null);
          }
        };

        worker.onerror = () => {
          cleanup();
          const result = optimizeSheetNesting(pieces, sheetConfig);
          const durationMs = Number((performance.now() - t0).toFixed(2));
          if (isStale()) {
            notify({ ...job, status: "cancelled", durationMs });
            resolve(null);
            return;
          }
          notify({
            ...job,
            executionMode: "async_fallback",
            status: "completed",
            result,
            durationMs,
          });
          resolve(result);
        };

        worker.postMessage({ pieces, sheetConfig });
      } catch {
        if (localBlobUrl) {
          URL.revokeObjectURL(localBlobUrl);
          if (activeWorkerBlobUrl === localBlobUrl) {
            activeWorkerBlobUrl = null;
          }
        }
        setTimeout(() => {
          if (isStale()) {
            notify({ ...job, status: "cancelled" });
            resolve(null);
            return;
          }
          const result = optimizeSheetNesting(pieces, sheetConfig);
          const durationMs = Number((performance.now() - t0).toFixed(2));
          notify({
            ...job,
            executionMode: "async_fallback",
            status: "completed",
            result,
            durationMs,
          });
          resolve(result);
        }, 0);
      }
    });
  }

  return new Promise((resolve) => {
    setTimeout(() => {
      if (isStale()) {
        notify({ ...job, status: "cancelled" });
        resolve(null);
        return;
      }

      try {
        const result = optimizeSheetNesting(pieces, sheetConfig);
        const durationMs = Number((performance.now() - t0).toFixed(2));

        if (isStale()) {
          notify({ ...job, status: "cancelled", durationMs });
          resolve(null);
          return;
        }

        const completedJob: AsyncNestingJob = {
          ...job,
          status: "completed",
          result,
          durationMs,
        };
        notify(completedJob);
        resolve(result);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : "Nesting hesaplama hatası";
        notify({ ...job, status: "cancelled", error: errorMsg });
        resolve(null);
      }
    }, 0);
  });
}
