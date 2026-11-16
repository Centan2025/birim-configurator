import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import {
  DEFAULT_MATERIALS,
  computeProjectGrainContinuityMap,
  createDefaultWardrobeModule,
  createInitialProject,
  evaluateProjectCompatibility,
  evaluateUnifiedEngineeringModel,
} from "@birim/core";
import { getV4TemplateById } from "@birim/catalog";
import {
  componentBounds,
  generateCrossSection2D,
  generateElevation2D,
  generateModuleGeometry,
  generateTopPlan2D,
  transformComponentPoint,
  type ComponentGeometry,
} from "@birim/geometry";
import { generateBOMForProject } from "@birim/manufacturing";
import { calculateProjectPrice } from "@birim/pricing";

function referenceBounds(component: ComponentGeometry) {
  const pts = [0, 1].flatMap((x) =>
    [0, 1].flatMap((y) =>
      [0, 1].map((z) =>
        transformComponentPoint(component, {
          x: component.position.x + x * component.dimensions.width,
          y: component.position.y + y * component.dimensions.height,
          z: component.position.z + z * component.dimensions.depth,
        })
      )
    )
  );
  return {
    min: {
      x: Math.min(...pts.map((p) => p.x)),
      y: Math.min(...pts.map((p) => p.y)),
      z: Math.min(...pts.map((p) => p.z)),
    },
    max: {
      x: Math.max(...pts.map((p) => p.x)),
      y: Math.max(...pts.map((p) => p.y)),
      z: Math.max(...pts.map((p) => p.z)),
    },
  };
}

describe("V9.2 — End-to-End Performance Acceleration (Geometry, Core Engineering, 2D Projections & Studio Bundle)", () => {
  it("1. componentBounds matches rotated & axis-aligned math exactly and 200x 2D projections run in < 5ms via WeakMap cache", () => {
    const axisComp: ComponentGeometry = {
      id: "c_axis",
      role: "shelf",
      label: "Raf",
      dimensions: { width: 800, height: 18, depth: 520 },
      position: { x: 18, y: 640, z: 20 },
      materialId: "mat_melamine_white",
    };
    expect(componentBounds(axisComp)).toEqual(referenceBounds(axisComp));

    const rotComp: ComponentGeometry = {
      id: "c_rot",
      role: "door_left",
      label: "Kapak",
      dimensions: { width: 450, height: 2100, depth: 18 },
      position: { x: 2, y: 84, z: 600 },
      pivot: { x: 2, y: 84, z: 600 },
      rotation: [0.2, 0.8, -0.1],
      materialId: "mat_veneer_oak",
    };
    const fastRot = componentBounds(rotComp);
    const refRot = referenceBounds(rotComp);
    expect(fastRot.min.x).toBeCloseTo(refRot.min.x, 6);
    expect(fastRot.min.y).toBeCloseTo(refRot.min.y, 6);
    expect(fastRot.min.z).toBeCloseTo(refRot.min.z, 6);
    expect(fastRot.max.x).toBeCloseTo(refRot.max.x, 6);
    expect(fastRot.max.y).toBeCloseTo(refRot.max.y, 6);
    expect(fastRot.max.z).toBeCloseTo(refRot.max.z, 6);

    const mod = createDefaultWardrobeModule("perf_2d");
    const bd = generateModuleGeometry(mod, { doorOpenAngleDeg: 0 });
    // Warm up each 2D projection view once
    const firstElev = generateElevation2D(bd, "door_1");
    const firstPlan = generateTopPlan2D(bd, "door_1");
    const firstSecZ = generateCrossSection2D(bd, "door_1", { direction: "Z", cutCoordMm: 450 });
    const firstSecX = generateCrossSection2D(bd, "door_1", { direction: "X", cutCoordMm: 300 });

    let lastElev = firstElev;
    let lastPlan = firstPlan;
    let lastSecZ = firstSecZ;
    let lastSecX = firstSecX;
    const t0 = performance.now();
    for (let i = 0; i < 200; i++) {
      lastElev = generateElevation2D(bd, "door_1");
      lastPlan = generateTopPlan2D(bd, "door_1");
      lastSecZ = generateCrossSection2D(bd, "door_1", { direction: "Z", cutCoordMm: 450 });
      lastSecX = generateCrossSection2D(bd, "door_1", { direction: "X", cutCoordMm: 300 });
    }
    const elapsedMs = performance.now() - t0;
    expect(lastElev).toBe(firstElev);
    expect(lastPlan).toBe(firstPlan);
    expect(lastSecZ).toBe(firstSecZ);
    expect(lastSecX).toBe(firstSecX);
    expect(elapsedMs).toBeLessThan(5);

    // Must invalidate immediately when geometry changes produce a new breakdown
    const modifiedMod = {
      ...mod,
      dimensions: { ...mod.dimensions, width: mod.dimensions.width + 100 },
    };
    const bd2 = generateModuleGeometry(modifiedMod, { doorOpenAngleDeg: 0 });
    const updatedElev = generateElevation2D(bd2, "door_1");
    expect(updatedElev).not.toBe(firstElev);
    expect(updatedElev.dimensionLines[0].value).toBe(modifiedMod.dimensions.width);
  });

  it("2. 20-module full incremental pipeline (unified engineering + BOM + pricing + grain continuity) averages < 20ms and matches cold computation", () => {
    const baseProj = createInitialProject();
    baseProj.modules = [];
    for (let i = 0; i < 20; i++) {
      const m = createDefaultWardrobeModule(`perf_20_m_${i}`);
      m.position = { x: i * 1000, y: 0, z: 0 };
      m.carcass.wallAnchored = true;
      baseProj.modules.push(m);
    }
    baseProj.space.walls[0].length = 22000;

    // Warm up per-module caches for modules 1..19
    evaluateUnifiedEngineeringModel(baseProj);
    generateBOMForProject(baseProj, undefined, { skipSyncNesting: true });
    computeProjectGrainContinuityMap(baseProj);

    const t0 = performance.now();
    let finalProj = baseProj;
    let finalUnified = evaluateUnifiedEngineeringModel(baseProj);
    let finalBom = generateBOMForProject(baseProj, undefined, { skipSyncNesting: true });
    let finalPrice = calculateProjectPrice(finalBom);
    let finalGrain = computeProjectGrainContinuityMap(baseProj);

    for (let step = 0; step < 20; step++) {
      finalProj = {
        ...baseProj,
        version: baseProj.version + step + 1,
        modules: baseProj.modules.map((m, idx) =>
          idx === 0
            ? {
                ...m,
                dimensions: { ...m.dimensions, width: 1200 + step * 15 },
                bays: m.bays.map((b, bIdx) =>
                  bIdx === 0 && b.shelves[0]
                    ? {
                        ...b,
                        shelves: [
                          { ...b.shelves[0], elevationY: 640 + step * 16 },
                          ...b.shelves.slice(1),
                        ],
                      }
                    : b
                ),
              }
            : m
        ),
      };
      finalUnified = evaluateUnifiedEngineeringModel(finalProj);
      finalBom = generateBOMForProject(finalProj, undefined, { skipSyncNesting: true });
      finalPrice = calculateProjectPrice(finalBom);
      finalGrain = computeProjectGrainContinuityMap(finalProj);
    }
    const avgMs = (performance.now() - t0) / 20;
    expect(avgMs).toBeLessThan(20);
    expect(finalPrice.totalWithVatEur).toBeGreaterThan(0);

    // Cross-check incremental results against cold/direct computation paths
    const coldCompat = evaluateProjectCompatibility(finalProj);
    const compatCodes = new Set(coldCompat.issues.map((i) => i.code));
    const unifiedCodes = new Set(finalUnified.findings.map((f) => f.code));
    for (const cCode of compatCodes) {
      expect(unifiedCodes.has(cCode)).toBe(true);
    }

    const directUnifiedBypassProjectLru = evaluateUnifiedEngineeringModel({
      ...finalProj,
      libraryVersionId: "cold_verify_v92",
    });
    expect(finalUnified.findings).toEqual(directUnifiedBypassProjectLru.findings);
    expect(finalUnified.canExportToCncAndSaw).toBe(
      directUnifiedBypassProjectLru.canExportToCncAndSaw
    );

    const directGrainMap = computeProjectGrainContinuityMap(
      finalProj,
      new Map(DEFAULT_MATERIALS.map((m) => [m.id, m]))
    );
    expect(Array.from(finalGrain.entries())).toEqual(Array.from(directGrainMap.entries()));
  });

  it("3. 60-frame kinematic door/drawer animation sweep averages < 3ms per frame", () => {
    const slidingMod = getV4TemplateById("tpl_wd_06_sliding_3door")!.createInstance(
      "perf_slide_kin"
    );
    // Warm up geometry cache cleanly before measuring uncached kinematic angles
    generateModuleGeometry(slidingMod, { doorOpenAngleDeg: 0, drawerOpenMm: 0 });

    const t0 = performance.now();
    for (let f = 0; f < 60; f++) {
      const angle = Number(((f / 59) * 82).toFixed(2));
      const drawerMm = Number(((f / 59) * 300).toFixed(1));
      const res = generateModuleGeometry(slidingMod, {
        doorOpenAngleDeg: angle,
        drawerOpenMm: drawerMm,
      });
      expect(res.components.length).toBeGreaterThan(10);
    }
    const avgFrameMs = (performance.now() - t0) / 60;
    expect(avgFrameMs).toBeLessThan(3);
  });

  it("4. V11 Studio lazy-loads heavy modals and keeps React.memo references stable", () => {
    const rootDir = path.resolve(__dirname, "..");
    const wsPath = path.join(rootDir, "apps/configurator/src/v11/BirimStudioWorkspace.tsx");
    const wsSrc = fs.readFileSync(wsPath, "utf8");

    expect(wsSrc).toContain('import dynamic from "next/dynamic"');
    expect(wsSrc).toContain("EMPTY_SCENE_OBJECTS");
    expect(wsSrc).toContain("useCallback(");
    expect(wsSrc).not.toContain("sceneObjects={project.sceneObjects || []}");

    const lazyModals = [
      "V3CadViewport2D",
      "BomModal",
      "StoreErpModal",
      "AssemblyDiagramModal",
      "StudioRenderModal",
      "ArRoomPreviewModal",
      "RulesStandardsModal",
      "SaasTenantStudioModal",
      "SceneObjectAndModuleHubModal",
      "GuidedSetupModal",
      "QuoteSummaryModal",
    ];
    for (const modalName of lazyModals) {
      expect(wsSrc).toContain(`const ${modalName} = dynamic(`);
    }
  });
});
