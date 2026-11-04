import { describe, it, expect } from "vitest";
import { computeNestingAsync, AsyncNestingJob, subscribeNestingJob } from "../apps/configurator/src/workers/manufacturing-worker-client";
import { CutPiece } from "@birim/manufacturing";

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
    edgeBanding: { top: true, bottom: true, left: true, right: true },
    grain: "lengthwise",
    areaM2: 1.276,
    edgeBandMeters: 5.56,
    holes: [],
  },
];

describe("Web Worker & Async Calculation: Race Condition & Token Invalidation", () => {
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
});
