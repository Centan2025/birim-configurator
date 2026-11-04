import { describe, it, expect } from "vitest";
import { DesignProject, ModuleInstance, createDefaultWardrobeModule } from "@birim/core";
import { generateModuleGeometry } from "@birim/geometry";
import { generateBOMForProject, optimizeSheetNesting } from "@birim/manufacturing";
import { calculateProjectPrice } from "@birim/pricing";
import { createKitchenLProject, createKitchenUProject } from "@birim/catalog";

interface BenchmarkMetrics {
  scenario: string;
  moduleCount: number;
  totalPieces: number;
  geometryMs: number;
  bomMs: number;
  pricingMs: number;
  nestingMs: number;
  deepCloneMs: number;
  totalPipelineMs: number;
  memoryMbEstimate: number;
}

function runBenchmark(scenarioName: string, project: DesignProject): BenchmarkMetrics {
  const t0 = performance.now();

  // 1. Deep clone benchmark (current store behavior)
  const cloneStart = performance.now();
  for (let i = 0; i < 5; i++) {
    JSON.parse(JSON.stringify(project));
  }
  const deepCloneMs = (performance.now() - cloneStart) / 5;

  // 2. Geometry generation for all modules
  const geoStart = performance.now();
  let totalComps = 0;
  project.modules.forEach((mod) => {
    const geo = generateModuleGeometry(mod);
    totalComps += geo.components.length;
  });
  const geometryMs = performance.now() - geoStart;

  // 3. BOM generation
  const bomStart = performance.now();
  const bom = generateBOMForProject(project);
  const bomMs = performance.now() - bomStart;

  // 4. Pricing calculation
  const priceStart = performance.now();
  calculateProjectPrice(bom);
  const pricingMs = performance.now() - priceStart;

  // 5. Sheet Nesting
  const nestingStart = performance.now();
  optimizeSheetNesting(bom.cutList);
  const nestingMs = performance.now() - nestingStart;

  const totalPipelineMs = performance.now() - t0;
  const memoryMbEstimate = Math.round((JSON.stringify(project).length * 8 + totalComps * 128) / 1024);

  return {
    scenario: scenarioName,
    moduleCount: project.modules.length,
    totalPieces: bom.summary.totalPiecesCount,
    geometryMs: Number(geometryMs.toFixed(2)),
    bomMs: Number(bomMs.toFixed(2)),
    pricingMs: Number(pricingMs.toFixed(2)),
    nestingMs: Number(nestingMs.toFixed(2)),
    deepCloneMs: Number(deepCloneMs.toFixed(2)),
    totalPipelineMs: Number(totalPipelineMs.toFixed(2)),
    memoryMbEstimate,
  };
}

describe("FAZ 0 — Performance Profiling & Baseline Benchmarks", () => {
  const results: BenchmarkMetrics[] = [];

  it("Scenario A: 2-module standard wardrobe", () => {
    const mod1 = createDefaultWardrobeModule("mod_1");
    const mod2 = createDefaultWardrobeModule("mod_2");
    mod2.position.x = 1800;
    const proj: DesignProject = {
      id: "sc_a",
      version: 1,
      title: "2-Module Standard Wardrobe",
      branchId: "branch_1",
      status: "draft",
      space: { id: "sp1", name: "Room", type: "room", walls: [], ceilingHeight: 2600, elements: [] },
      modules: [mod1, mod2],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const metric = runBenchmark("A. 2 Modüllü Standart Dolap", proj);
    results.push(metric);
    expect(metric.totalPipelineMs).toBeGreaterThan(0);
  });

  it("Scenario B: 10-module multi-bay wardrobe", () => {
    const modules: ModuleInstance[] = [];
    for (let i = 0; i < 10; i++) {
      const mod = createDefaultWardrobeModule(`mod_b_${i}`);
      mod.position.x = i * 1000;
      mod.dimensions.width = 1000;
      modules.push(mod);
    }
    const proj: DesignProject = {
      id: "sc_b",
      version: 1,
      title: "10-Module Wardrobe",
      branchId: "branch_1",
      status: "draft",
      space: { id: "sp1", name: "Room", type: "room", walls: [], ceilingHeight: 2600, elements: [] },
      modules,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const metric = runBenchmark("B. 10 Modüllü Gardırop", proj);
    results.push(metric);
    expect(metric.moduleCount).toBe(10);
  });

  it("Scenario C: 20-module wardrobe with drawers and accessories", () => {
    const modules: ModuleInstance[] = [];
    for (let i = 0; i < 20; i++) {
      const mod = createDefaultWardrobeModule(`mod_c_${i}`);
      mod.position.x = i * 900;
      mod.dimensions.width = 900;
      mod.bays[0].drawers = [
        { id: `d_${i}_1`, bayIndex: 0, elevationY: 0, height: 180, slideType: "soft_close" },
        { id: `d_${i}_2`, bayIndex: 0, elevationY: 185, height: 180, slideType: "soft_close" },
        { id: `d_${i}_3`, bayIndex: 0, elevationY: 370, height: 180, slideType: "soft_close" },
      ];
      modules.push(mod);
    }
    const proj: DesignProject = {
      id: "sc_c",
      version: 1,
      title: "20-Module Wardrobe with Drawers",
      branchId: "branch_1",
      status: "draft",
      space: { id: "sp1", name: "Room", type: "room", walls: [], ceilingHeight: 2600, elements: [] },
      modules,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const metric = runBenchmark("C. 20 Modüllü Çekmeceli Gardırop", proj);
    results.push(metric);
    expect(metric.moduleCount).toBe(20);
  });

  it("Scenario D: L kitchen", () => {
    const proj = createKitchenLProject();
    const metric = runBenchmark("D. L Mutfak", proj);
    results.push(metric);
    expect(metric.totalPieces).toBeGreaterThan(0);
  });

  it("Scenario E: U kitchen", () => {
    const proj = createKitchenUProject();
    const metric = runBenchmark("E. U Mutfak", proj);
    results.push(metric);
    expect(metric.totalPieces).toBeGreaterThan(0);
  });

  it("Scenario F: 50+ module stress test", () => {
    const modules: ModuleInstance[] = [];
    for (let i = 0; i < 50; i++) {
      const mod = createDefaultWardrobeModule(`mod_f_${i}`);
      mod.position.x = i * 800;
      mod.dimensions.width = 800;
      mod.bays[0].shelves.push({ id: `sh_${i}`, bayIndex: 0, elevationY: 1200, isAdjustable: true });
      modules.push(mod);
    }
    const proj: DesignProject = {
      id: "sc_f",
      version: 1,
      title: "50+ Module Stress Test",
      branchId: "branch_1",
      status: "draft",
      space: { id: "sp1", name: "Room", type: "room", walls: [], ceilingHeight: 2600, elements: [] },
      modules,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const metric = runBenchmark("F. 50+ Modüllü Stres Testi", proj);
    results.push(metric);
    expect(metric.moduleCount).toBe(50);

    // Print profiling summary
    console.table(results);
  });
});
