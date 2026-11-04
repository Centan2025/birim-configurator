import { describe, it, expect } from "vitest";
import { DesignProject, createDefaultWardrobeModule, createInitialProject } from "@birim/core";
import { generateBOMForProject } from "@birim/manufacturing";
import { calculateProjectPrice } from "@birim/pricing";

describe("Performance Stress Suite: 100 Consecutive Mutations & Heap Growth", () => {
  it("Measures 100 consecutive dimension changes on a 20-module wardrobe", () => {
    // Setup 20-module project
    const proj = createInitialProject();
    for (let i = 1; i < 20; i++) {
      const mod = createDefaultWardrobeModule(`mod_${i}`);
      mod.position.x = i * 900;
      proj.modules.push(mod);
    }

    const tStart = performance.now();
    let currentProj = proj;

    for (let step = 0; step < 100; step++) {
      // simulate clone + dimension mutation + recompute
      const cloned: DesignProject = JSON.parse(JSON.stringify(currentProj));
      cloned.modules[0].dimensions.width = 1800 + (step % 50) * 10;
      const bom = generateBOMForProject(cloned);
      calculateProjectPrice(bom);
      currentProj = cloned;
    }

    const totalTimeMs = performance.now() - tStart;
    const avgPerMutationMs = totalTimeMs / 100;

    console.log(`[Stress Baseline] 100 Sequential Updates on 20 Modules: Total ${totalTimeMs.toFixed(1)}ms (Avg ${avgPerMutationMs.toFixed(2)}ms/update)`);
    expect(avgPerMutationMs).toBeLessThan(100);
  });

  it("Measures undo/redo history memory footprint across 50 operations", () => {
    const proj = createInitialProject();
    const history: DesignProject[] = [];

    const memBefore = process.memoryUsage().heapUsed;

    for (let step = 0; step < 50; step++) {
      const cloned: DesignProject = JSON.parse(JSON.stringify(proj));
      cloned.title = `Step ${step}`;
      cloned.version = step + 1;
      history.push(cloned);
    }

    const memAfter = process.memoryUsage().heapUsed;
    const heapDiffKb = Math.round((memAfter - memBefore) / 1024);

    console.log(`[Undo/Redo Baseline] 50 Deep Cloned Snapshots Heap Growth: ${heapDiffKb} KB`);
    expect(history.length).toBe(50);
  });
});
