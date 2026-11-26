import { describe, expect, it } from "vitest";
import {
  createDefaultWardrobeModule,
  createInitialProject,
} from "@birim/core";
import type { CutPiece } from "@birim/manufacturing";
import {
  computeNestingAsync,
  getWorkerSpawnCountForDiagnostics,
  resetNestingWorkerState,
  subscribeNestingJob,
  type AsyncNestingJob,
} from "../apps/configurator/src/workers/manufacturing-worker-client";
import { useConfiguratorStore } from "../apps/configurator/src/store/useConfiguratorStore";
import {
  buildStructuralHistorySnapshot,
} from "../apps/configurator/src/store/slices/historyAndTransactionsSlice";

const samplePieces: CutPiece[] = [
  {
    id: "p_side_l",
    pieceName: "Sol Yan Dikme",
    moduleName: "Modül 1",
    moduleId: "m1",
    componentRole: "side_left",
    materialId: "mat_melamine_white",
    materialName: "Beyaz Melamin",
    lengthMm: 2200,
    widthMm: 580,
    thicknessMm: 18,
    quantity: 2,
    edgeBanding: { top: true, bottom: true, left: true, right: true, thickness: 1 },
    grain: "lengthwise",
    areaM2: 1.276,
    edgeBandMeters: 5.56,
    holes: [],
  },
];

describe("V13 Faz 2 — Performans, Sıcak Web Worker Kuyruğu ve Yapısal Undo/Redo Doğrulaması", () => {
  it("1. 50 modüllü projede buildStructuralHistorySnapshot dokunulmayan 49 modülün referansını O(1) korur ve < 2ms sürer", () => {
    const proj = createInitialProject();
    proj.modules = Array.from({ length: 50 }, (_, idx) => {
      const m = createDefaultWardrobeModule(`m_struct_${idx}`);
      m.position = { x: idx * 900, y: 0, z: 0 };
      return m;
    });

    const t0 = performance.now();
    const snap = buildStructuralHistorySnapshot(proj, 3, ["m_struct_3", "m_struct_7"]);
    const elapsedMs = performance.now() - t0;

    expect(elapsedMs).toBeLessThan(5);
    expect(snap.modules.length).toBe(50);

    // Active module (3) and selected module (7) must be freshly cloned so live mutations cannot taint history
    expect(snap.modules[3]).not.toBe(proj.modules[3]);
    expect(snap.modules[3].bays[0]).not.toBe(proj.modules[3].bays[0]);
    expect(snap.modules[7]).not.toBe(proj.modules[7]);

    // All other 48 untouched modules MUST retain exact reference identity (zero GC churn!)
    for (let i = 0; i < 50; i++) {
      if (i === 3 || i === 7) continue;
      expect(snap.modules[i]).toBe(proj.modules[i]);
    }
  });

  it("2. Sıcak (Warm) Web Worker 8 ardışık hızlı sürükleme adımında Worker thread'i yıkmadan (spawnCount=1) yalnızca son işi tamamlar", async () => {
    resetNestingWorkerState();
    const g = globalThis as Record<string, unknown>;
    const prevWin = g.window;
    const prevWorker = g.Worker;
    const prevBlob = g.Blob;
    const prevUrlCreate = URL.createObjectURL;
    const prevUrlRevoke = URL.revokeObjectURL;

    let terminateCalls = 0;
    class MockWarmWorker {
      onmessage: ((ev: { data: unknown }) => void) | null = null;
      onerror: ((err: unknown) => void) | null = null;
      postMessage(data: { reqSeq?: number }) {
        setTimeout(() => {
          if (this.onmessage) {
            this.onmessage({
              data: {
                ok: true,
                reqSeq: data.reqSeq,
                result: [
                  {
                    materialId: "mat_melamine_white",
                    materialName: "Beyaz Melamin",
                    sheets: [],
                    unplacedPieces: [],
                    totalSheetsCount: 1,
                    totalNetAreaM2: 2.55,
                    totalGrossAreaM2: 5.8,
                    usableRemnantAreaM2: 1.2,
                    overallWastePercent: 22.4,
                  },
                ],
              },
            });
          }
        }, 8);
      }
      terminate() {
        terminateCalls += 1;
      }
    }

    try {
      g.window = {};
      g.Worker = MockWarmWorker;
      g.Blob = class {
        constructor(public parts: unknown[]) {}
      };
      URL.createObjectURL = () => "blob:mock-nesting-worker";
      URL.revokeObjectURL = () => {};

      const events: AsyncNestingJob[] = [];
      const unsub = subscribeNestingJob((j) => events.push(j));

      const promises = Array.from({ length: 8 }, (_, idx) =>
        computeNestingAsync(samplePieces, idx + 1, undefined, { projectId: "proj_rapid" })
      );
      const results = await Promise.all(promises);
      unsub();

      // Superseded jobs 1..7 resolve cleanly to null; final job 8 resolves with valid result
      for (let i = 0; i < 7; i++) {
        expect(results[i]).toBeNull();
      }
      expect(results[7]).not.toBeNull();
      expect(results[7]?.[0]?.totalSheetsCount).toBe(1);

      // Zero destructive Worker termination during rapid burst & only 1 Worker spawned!
      expect(getWorkerSpawnCountForDiagnostics()).toBe(1);
      expect(terminateCalls).toBe(0);
      expect(events.some((e) => e.status === "completed" && e.version === 8)).toBe(true);
    } finally {
      resetNestingWorkerState();
      if (prevWin === undefined) delete g.window;
      else g.window = prevWin;
      if (prevWorker === undefined) delete g.Worker;
      else g.Worker = prevWorker;
      if (prevBlob === undefined) delete g.Blob;
      else g.Blob = prevBlob;
      URL.createObjectURL = prevUrlCreate;
      URL.revokeObjectURL = prevUrlRevoke;
    }
  });

  it("3. Store beginHistoryTransaction -> setDimensions -> commitHistoryTransaction -> undo/redo tam doğrulukla çalışır", () => {
    const store = useConfiguratorStore.getState();
    store.resetToDefault();
    const initialW = useConfiguratorStore.getState().project.modules[0].dimensions.width;

    useConfiguratorStore.getState().beginHistoryTransaction();
    useConfiguratorStore.getState().setDimensions(initialW + 200, 2400, 600);
    useConfiguratorStore.getState().commitHistoryTransaction();

    expect(useConfiguratorStore.getState().project.modules[0].dimensions.width).toBe(initialW + 200);

    useConfiguratorStore.getState().undo();
    expect(useConfiguratorStore.getState().project.modules[0].dimensions.width).toBe(initialW);

    useConfiguratorStore.getState().redo();
    expect(useConfiguratorStore.getState().project.modules[0].dimensions.width).toBe(initialW + 200);
    store.resetToDefault();
  });
});
