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

interface InFlightOrQueuedWorkerTask {
  job: AsyncNestingJob;
  pieces: CutPiece[];
  sheetConfig: SheetDimension;
  t0: number;
  resolve: (result: NestingOptimizationResult[] | null) => void;
}

let activeSequenceId = 0;
let latestSequenceByProject = new Map<string, number>();
let activeProjectId = "default_project";
let currentJob: AsyncNestingJob | null = null;
let persistentBrowserWorker: Worker | null = null;
let workerIdleTimer: ReturnType<typeof setTimeout> | null = null;
let workerInFlightTask: InFlightOrQueuedWorkerTask | null = null;
let workerQueuedLatestTask: InFlightOrQueuedWorkerTask | null = null;
let workerSpawnCount = 0;
const listeners = new Set<(job: AsyncNestingJob) => void>();

function cancelTaskImmediately(task: InFlightOrQueuedWorkerTask): void {
  const durationMs = Number((performance.now() - task.t0).toFixed(2));
  notify({ ...task.job, status: "cancelled", durationMs });
  task.resolve(null);
}

function terminateActiveWorkerAndBlob(): void {
  if (workerIdleTimer !== null) {
    clearTimeout(workerIdleTimer);
    workerIdleTimer = null;
  }
  if (persistentBrowserWorker) {
    persistentBrowserWorker.terminate();
    persistentBrowserWorker = null;
  }
  if (workerQueuedLatestTask) {
    const q = workerQueuedLatestTask;
    workerQueuedLatestTask = null;
    cancelTaskImmediately(q);
  }
  if (workerInFlightTask) {
    const cur = workerInFlightTask;
    workerInFlightTask = null;
    cancelTaskImmediately(cur);
  }
}

function scheduleWorkerIdleTerminate(): void {
  if (workerIdleTimer !== null) clearTimeout(workerIdleTimer);
  workerIdleTimer = setTimeout(() => {
    workerIdleTimer = null;
    if (!workerInFlightTask && !workerQueuedLatestTask && persistentBrowserWorker) {
      persistentBrowserWorker.terminate();
      persistentBrowserWorker = null;
    }
  }, 45_000);
}

function isTaskStale(task: InFlightOrQueuedWorkerTask): boolean {
  return (
    activeProjectId !== task.job.projectId ||
    (latestSequenceByProject.get(task.job.projectId) ?? 0) > task.job.sequenceId
  );
}

function dispatchNextQueuedTaskOnWarmWorker(): void {
  if (workerInFlightTask || !workerQueuedLatestTask) {
    if (!workerInFlightTask && !workerQueuedLatestTask) {
      scheduleWorkerIdleTerminate();
    }
    return;
  }
  const nextTask = workerQueuedLatestTask;
  workerQueuedLatestTask = null;

  if (isTaskStale(nextTask)) {
    cancelTaskImmediately(nextTask);
    dispatchNextQueuedTaskOnWarmWorker();
    return;
  }

  const worker = getOrCreatePersistentNestingWorker();
  if (!worker) {
    // Fallback if worker creation unexpectedly failed mid-session
    const result = optimizeSheetNesting(nextTask.pieces, nextTask.sheetConfig);
    const durationMs = Number((performance.now() - nextTask.t0).toFixed(2));
    if (isTaskStale(nextTask)) {
      cancelTaskImmediately(nextTask);
    } else {
      notify({
        ...nextTask.job,
        executionMode: "async_fallback",
        status: "completed",
        result,
        durationMs,
      });
      nextTask.resolve(result);
    }
    return;
  }

  workerInFlightTask = nextTask;
  worker.postMessage({
    reqSeq: nextTask.job.sequenceId,
    pieces: nextTask.pieces,
    sheetConfig: nextTask.sheetConfig,
  });
}

function bindWarmWorkerHandlers(worker: Worker): void {
  worker.onmessage = (
    ev: MessageEvent<{
      ok: boolean;
      reqSeq?: number;
      result?: NestingOptimizationResult[];
      error?: string;
    }>
  ) => {
    const finishedTask = workerInFlightTask;
    workerInFlightTask = null;

    if (finishedTask) {
      const seqMatches =
        ev.data?.reqSeq === undefined || ev.data.reqSeq === finishedTask.job.sequenceId;
      const durationMs = Number((performance.now() - finishedTask.t0).toFixed(2));
      if (!seqMatches || isTaskStale(finishedTask)) {
        // Might already have been cancelled cooperatively when a newer task arrived
        if (
          (latestSequenceByProject.get(finishedTask.job.projectId) ?? 0) ===
          finishedTask.job.sequenceId
        ) {
          notify({ ...finishedTask.job, status: "cancelled", durationMs });
        }
        finishedTask.resolve(null);
      } else if (ev.data?.ok && ev.data.result) {
        notify({
          ...finishedTask.job,
          status: "completed",
          result: ev.data.result,
          durationMs,
        });
        finishedTask.resolve(ev.data.result);
      } else {
        notify({
          ...finishedTask.job,
          status: "cancelled",
          error: ev.data?.error || "Nesting worker hatası",
          durationMs,
        });
        finishedTask.resolve(null);
      }
    }

    dispatchNextQueuedTaskOnWarmWorker();
  };

  worker.onerror = () => {
    const crashedTask = workerInFlightTask;
    workerInFlightTask = null;
    if (persistentBrowserWorker === worker) {
      persistentBrowserWorker.terminate();
      persistentBrowserWorker = null;
    }
    if (crashedTask) {
      if (isTaskStale(crashedTask)) {
        cancelTaskImmediately(crashedTask);
      } else {
        const result = optimizeSheetNesting(crashedTask.pieces, crashedTask.sheetConfig);
        const durationMs = Number((performance.now() - crashedTask.t0).toFixed(2));
        notify({
          ...crashedTask.job,
          executionMode: "async_fallback",
          status: "completed",
          result,
          durationMs,
        });
        crashedTask.resolve(result);
      }
    }
    dispatchNextQueuedTaskOnWarmWorker();
  };
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
    workerSpawnCount += 1;
    bindWarmWorkerHandlers(worker);
    persistentBrowserWorker = worker;
    return worker;
  } catch {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    return null;
  }
}

export function getWorkerSpawnCountForDiagnostics(): number {
  return workerSpawnCount;
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
  workerSpawnCount = 0;
}

/**
 * Dispatches heavy nesting bin-packing asynchronously with Warm Cooperative Worker Reuse:
 * - Never destroys/re-creates the V8 Worker thread during rapid slider drags; instead,
 *   cancels any superseded in-flight/queued task in 0ms and keeps a single latest-wins slot
 *   ready on the warm persistent Worker!
 * - Falls back cleanly to non-blocking microtask/timeout execution in Node/Vitest environments.
 */
export async function computeNestingAsync(
  pieces: CutPiece[],
  version: number,
  sheetConfig: SheetDimension = STANDARD_SHEET_2800x2070,
  options: NestingWorkerRequestOptions = {}
): Promise<NestingOptimizationResult[] | null> {
  const sequenceId = ++activeSequenceId;
  const projectId = options.projectId || "default_project";
  const revisionId = options.revisionId || `rev_v${version}`;

  activeProjectId = projectId;
  latestSequenceByProject.set(projectId, sequenceId);

  // Cooperatively cancel any superseded queued or in-flight promises immediately (zero Worker teardown!)
  if (workerQueuedLatestTask) {
    const prevQueued = workerQueuedLatestTask;
    workerQueuedLatestTask = null;
    cancelTaskImmediately(prevQueued);
  }
  if (workerInFlightTask) {
    const prevInFlight = workerInFlightTask;
    // Resolve superseded caller immediately with null while letting the warm worker finish its ~4ms turn cleanly
    const durationMs = Number((performance.now() - prevInFlight.t0).toFixed(2));
    notify({ ...prevInFlight.job, status: "cancelled", durationMs });
    prevInFlight.resolve(null);
    workerInFlightTask = {
      ...prevInFlight,
      resolve: () => {},
    };
  }

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
        workerQueuedLatestTask = {
          job,
          pieces,
          sheetConfig,
          t0,
          resolve,
        };
        dispatchNextQueuedTaskOnWarmWorker();
      });
    }
  }

  return new Promise((resolve) => {
    setTimeout(() => {
      if (isStale()) {
        const durationMs = Number((performance.now() - t0).toFixed(2));
        notify({ ...job, status: "cancelled", durationMs });
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
        notify({
          ...job,
          executionMode: "async_fallback",
          status: "completed",
          result,
          durationMs,
        });
        resolve(result);
      } catch (err) {
        notify({
          ...job,
          status: "cancelled",
          error: err instanceof Error ? err.message : "Nesting hesaplama hatası",
        });
        resolve(null);
      }
    }, 0);
  });
}
