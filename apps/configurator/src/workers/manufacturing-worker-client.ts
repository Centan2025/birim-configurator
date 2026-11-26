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
let persistentBrowserWorker: Worker | null = null;
let workerIdleTimer: ReturnType<typeof setTimeout> | null = null;
let activeJobResolver: ((result: NestingOptimizationResult[] | null) => void) | null = null;
const listeners = new Set<(job: AsyncNestingJob) => void>();

function terminateActiveWorkerAndBlob(): void {
  if (workerIdleTimer !== null) {
    clearTimeout(workerIdleTimer);
    workerIdleTimer = null;
  }
  if (persistentBrowserWorker) {
    persistentBrowserWorker.terminate();
    persistentBrowserWorker = null;
  }
  if (activeJobResolver) {
    const prevResolve = activeJobResolver;
    activeJobResolver = null;
    prevResolve(null);
  }
}

function scheduleWorkerIdleTerminate(): void {
  if (workerIdleTimer !== null) clearTimeout(workerIdleTimer);
  workerIdleTimer = setTimeout(() => {
    workerIdleTimer = null;
    if (!activeJobResolver && persistentBrowserWorker) {
      persistentBrowserWorker.terminate();
      persistentBrowserWorker = null;
    }
  }, 30_000);
}

function getOrCreatePersistentNestingWorker(): Worker | null {
  if (workerIdleTimer !== null) {
    clearTimeout(workerIdleTimer);
    workerIdleTimer = null;
  }
  if (persistentBrowserWorker) return persistentBrowserWorker;
  let blobUrl: string | null = null;
  try {
    const blob = new Blob([buildPortableNestingWorkerBootstrapSource()], {
      type: "application/javascript",
    });
    blobUrl = URL.createObjectURL(blob);
    const worker = new Worker(blobUrl);
    URL.revokeObjectURL(blobUrl);
    blobUrl = null;
    persistentBrowserWorker = worker;
    return worker;
  } catch {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    return null;
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
  // If a previous job is still running inside the worker, terminate to guarantee
  // its late response can never resolve the new job; when idle, reuse the persistent worker.
  if (activeJobResolver) {
    terminateActiveWorkerAndBlob();
  }

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
    const worker = getOrCreatePersistentNestingWorker();
    if (worker) {
      return new Promise((resolve) => {
        activeJobResolver = resolve;
        const finish = (res: NestingOptimizationResult[] | null) => {
          if (activeJobResolver === resolve) {
            activeJobResolver = null;
          }
          scheduleWorkerIdleTerminate();
          resolve(res);
        };

        worker.onmessage = (
          ev: MessageEvent<{ ok: boolean; result?: NestingOptimizationResult[]; error?: string }>
        ) => {
          const durationMs = Number((performance.now() - t0).toFixed(2));
          if (isStale()) {
            notify({ ...job, status: "cancelled", durationMs });
            finish(null);
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
            finish(ev.data.result);
          } else {
            notify({
              ...job,
              status: "cancelled",
              error: ev.data?.error || "Nesting worker hatası",
            });
            finish(null);
          }
        };

        worker.onerror = () => {
          // Reset crashed worker instance and fall back synchronously
          if (persistentBrowserWorker === worker) {
            persistentBrowserWorker.terminate();
            persistentBrowserWorker = null;
          }
          const result = optimizeSheetNesting(pieces, sheetConfig);
          const durationMs = Number((performance.now() - t0).toFixed(2));
          if (isStale()) {
            notify({ ...job, status: "cancelled", durationMs });
            finish(null);
            return;
          }
          notify({
            ...job,
            executionMode: "async_fallback",
            status: "completed",
            result,
            durationMs,
          });
          finish(result);
        };

        try {
          worker.postMessage({ pieces, sheetConfig });
        } catch {
          if (persistentBrowserWorker === worker) {
            persistentBrowserWorker.terminate();
            persistentBrowserWorker = null;
          }
          setTimeout(() => {
            if (isStale()) {
              notify({ ...job, status: "cancelled" });
              finish(null);
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
            finish(result);
          }, 0);
        }
      });
    }
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
