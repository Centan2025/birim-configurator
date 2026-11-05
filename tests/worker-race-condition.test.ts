import { describe, it, expect, beforeEach } from "vitest";
import {
  computeNestingAsync,
  AsyncNestingJob,
  subscribeNestingJob,
  resetNestingWorkerState,
} from "../apps/configurator/src/workers/manufacturing-worker-client";
import { CutPiece, STANDARD_SHEET_2800x2070 } from "@birim/manufacturing";

const mockPieces: CutPiece[] = [
  {
    id: "p1",
    pieceName: "Yan Tabla Sol",
    moduleName: "Mod 1",
    moduleId: "m1",
    componentRole: "side_left",
    materialId: "mat_white",
    materialName: "Beyaz Gövde",
    lengthMm: 2200,
    widthMm: 580,
    thicknessMm: 18,
    quantity: 1,
    edgeBanding: { top: true, bottom: true, left: true, right: true, thickness: 1 },
    grain: "lengthwise",
    areaM2: 1.276,
    edgeBandMeters: 5.56,
    holes: [],
  },
];

describe("Web Worker & Async Calculation: Race Condition & Token Invalidation", () => {
  beforeEach(() => {
    resetNestingWorkerState();
  });

  it("safely invalidates older in-flight jobs when a newer version arrives", async () => {
    const jobLog: AsyncNestingJob[] = [];
    const unsubscribe = subscribeNestingJob((job) => jobLog.push(job));

    // Fire Job v1
    const p1 = computeNestingAsync(mockPieces, 1);
    // Fire Job v2 immediately after
    const p2 = computeNestingAsync(mockPieces, 2);

    const [res1, res2] = await Promise.all([p1, p2]);

    unsubscribe();

    // res1 should be discarded / null due to newer version 2
    expect(res1).toBeNull();
    // res2 should succeed
    expect(res2).not.toBeNull();
    expect(res2?.length).toBeGreaterThan(0);

    const cancelledJobs = jobLog.filter((j) => j.status === "cancelled" && j.version === 1);
    expect(cancelledJobs.length).toBeGreaterThan(0);
  });

  it("properly handles non-monotonic undo (v5 -> v4) and project switches without dropping the newer undo job", async () => {
    const jobLog: AsyncNestingJob[] = [];
    const unsubscribe = subscribeNestingJob((job) => jobLog.push(job));

    // Fire Job at v5 on project A
    const pHigh = computeNestingAsync(mockPieces, 5, STANDARD_SHEET_2800x2070, {
      projectId: "proj_A",
      revisionId: "rev_v5",
    });
    // User presses Ctrl+Z (Undo back to v4) immediately after
    const pUndo = computeNestingAsync(mockPieces, 4, STANDARD_SHEET_2800x2070, {
      projectId: "proj_A",
      revisionId: "rev_v4",
    });

    const [resHigh, resUndo] = await Promise.all([pHigh, pUndo]);
    expect(resHigh).toBeNull();
    expect(resUndo).not.toBeNull();
    expect(resUndo?.length).toBeGreaterThan(0);

    // Switch from project A to project B while a job on project A is in flight
    const pOldProj = computeNestingAsync(mockPieces, 10, STANDARD_SHEET_2800x2070, {
      projectId: "proj_A",
      revisionId: "rev_v10",
    });
    const pNewProj = computeNestingAsync(mockPieces, 1, STANDARD_SHEET_2800x2070, {
      projectId: "proj_B",
      revisionId: "rev_v1",
    });

    const [resOldProj, resNewProj] = await Promise.all([pOldProj, pNewProj]);
    unsubscribe();

    expect(resOldProj).toBeNull();
    expect(resNewProj).not.toBeNull();
  });
});
