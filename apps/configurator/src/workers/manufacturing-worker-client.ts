import {
  CutPiece,
  NestingOptimizationResult,
  SheetDimension,
  optimizeSheetNesting,
  STANDARD_SHEET_2800x2070,
  buildPortableNestingWorkerBootstrapSource,
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

// Single-Source-of-Truth Worker Bootstrap generated from @birim/manufacturing
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
        const blob = new Blob([buildPortableNestingWorkerBootstrapSource()], {
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
