import { CutPiece, NestingOptimizationResult, SheetDimension, optimizeSheetNesting, STANDARD_SHEET_2800x2070 } from "@birim/manufacturing";

export interface AsyncNestingJob {
  jobId: string;
  version: number;
  piecesCount: number;
  status: "pending" | "computing" | "completed" | "cancelled";
  result?: NestingOptimizationResult[];
  durationMs?: number;
  error?: string;
}

let activeJobId = 0;
let latestVersion = 0;
let currentJob: AsyncNestingJob | null = null;
const listeners = new Set<(job: AsyncNestingJob) => void>();

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

/**
 * Dispatches heavy nesting bin-packing asynchronously.
 * Guarantees out-of-order execution safety: if a newer revision arrives,
 * older in-flight jobs are safely invalidated and discarded.
 */
export async function computeNestingAsync(
  pieces: CutPiece[],
  version: number,
  sheetConfig: SheetDimension = STANDARD_SHEET_2800x2070
): Promise<NestingOptimizationResult[] | null> {
  const jobId = `nest_${++activeJobId}_v${version}`;
  latestVersion = Math.max(latestVersion, version);

  const job: AsyncNestingJob = {
    jobId,
    version,
    piecesCount: pieces.length,
    status: "computing",
  };
  notify(job);

  const t0 = performance.now();

  return new Promise((resolve) => {
    // Non-blocking async microtask dispatch
    setTimeout(() => {
      // Stale check before computation
      if (version < latestVersion) {
        notify({ ...job, status: "cancelled" });
        resolve(null);
        return;
      }

      try {
        const result = optimizeSheetNesting(pieces, sheetConfig);
        const durationMs = Number((performance.now() - t0).toFixed(2));

        // Stale check after computation
        if (version < latestVersion) {
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
