import { describe, it, expect, beforeEach, vi } from "vitest";
import { createInitialProject, calculateBayWidths, calculateModulePlacement, calculateFourSpaceDimensions, DesignProjectSchema, evaluateProjectCompatibility, DEFAULT_MATERIALS } from "@birim/core";
import { generateModuleGeometry, transformComponentPoint, generateElevation2D } from "@birim/geometry";
import { V4_MODULE_TEMPLATES, HANDLE_PROFILES, V4LibraryAdminStore } from "@birim/catalog";
import { calculateProjectPrice } from "@birim/pricing";
import { generateBOMForProject, optimizeSheetNesting, STANDARD_SHEET_2800x2070 } from "@birim/manufacturing";
import { useConfiguratorStore } from "../apps/configurator/src/store/useConfiguratorStore";
import { mkdirSync, writeFileSync } from "node:fs";

const projectWith = (mod = V4_MODULE_TEMPLATES[0].createInstance("audit")) => ({ ...createInitialProject(), modules: [mod] });

describe("V4.1 independent geometry and manufacturing regressions", () => {
  for (const profile of HANDLE_PROFILES) it(`renders and binds ${profile.category} for left/right/double/drawer`, () => {
    for (const type of ["single_left", "single_right", "double"] as const) {
      const project = projectWith(); const mod = project.modules[0];
      mod.isOpenFront = false; mod.bays[0].door = { ...mod.bays[0].door, type, doorSystemId: type === "double" ? "hinged_double" : "hinged_single", handleCategory: profile.category };
      mod.bays[0].drawers = [{ id: "drawer", bayIndex: 0, height: 180, elevationY: 0, slideType: "soft_close" }];
      const closed = generateModuleGeometry(mod);
      const opened = generateModuleGeometry(mod, { doorOpenAngleDeg: 75, drawerOpenMm: 200 });
      const handles = opened.components.filter(c => c.handleCategory === profile.category);
      expect(handles.length > 0).toBe(profile.category !== "handleless_plain");
      for (const h of handles) {
        const parent = opened.components.find(c => c.id === h.parentComponentId)!;
        expect(parent).toBeDefined();
        if (profile.category !== "gola_profile") {
          expect(h.pivot).toEqual(parent.pivot); expect(h.rotation).toEqual(parent.rotation);
        } else expect(h.rotation).toBeUndefined();
        const prior = closed.components.find(c => c.id === h.id)!;
        if (parent.role === "drawer_front") expect(h.position.z - prior.position.z).toBe(200);
        if (h.rotation) {
          const transformed = transformComponentPoint(h, h.position);
          expect(Object.values(transformed).every(Number.isFinite)).toBe(true);
          expect(transformed).not.toEqual(prior.position);
        }
      }
      const bom = generateBOMForProject(project);
      const handleItems = bom.hardwareList.filter(h => h.category === "handle");
      expect(handleItems.reduce((sum, h) => sum + h.quantity, 0)).toBe(profile.category === "handleless_plain" ? 0 : type === "double" ? 3 : 2);
      if (profile.category !== "handleless_plain") expect(handleItems[0].sku).toBe(profile.sku);
      expect(bom.cutList.flatMap(p => p.holes ?? []).filter(h => h.purpose === "handle")).toEqual([]);
    }
  });

  it("preserves legacy master resizing and applies external drawer handle defaults", () => {
    useConfiguratorStore.getState().resetToDefault(); useConfiguratorStore.getState().setDimensions(2200, 2200, 600);
    expect(useConfiguratorStore.getState().project.modules[0].dimensions.width).toBe(2200);
    const mod = V4_MODULE_TEMPLATES.find(t => t.templateId === "tpl_kb_05_three_drawers")!.createInstance("external");
    expect(mod.bays[0].door.handleCategory).toBe("bar_handle");
    expect(generateModuleGeometry(mod).components.filter(c => c.role === "drawer_handle").length).toBeGreaterThan(0);
  });

  it("uses measured panel axes, drawer overrides and individual runner products", () => {
    const project = projectWith(); const mod = project.modules[0];
    mod.bays[0].drawers = [{ id: "a", bayIndex: 0, height: 180, elevationY: 0, slideType: "soft_close", frontMaterialId: "mat_veneer_oak", hardwareProductId: "hw_blum_legrabox_m40" }, { id: "b", bayIndex: 0, height: 240, elevationY: 185, slideType: "soft_close", hardwareProductId: "hw_blum_legrabox_c70" }];
    const bom = generateBOMForProject(project);
    expect(bom.cutList.find(p => p.componentRole === "carcass_top")?.thicknessMm).toBe(18);
    expect(bom.cutList.find(p => p.id.endsWith("a_bottom"))?.thicknessMm).toBe(8);
    expect(bom.cutList.find(p => p.id.endsWith("a_front"))?.materialId).toBe("mat_veneer_oak");
    expect(bom.hardwareList.filter(h => h.category === "slide")).toHaveLength(2);
    const side = bom.cutList.find(p => p.id.endsWith("a_side_left"))!;
    expect(side.thicknessMm).toBe(16);
    const bottom = bom.cutList.find(p => p.id.endsWith("a_bottom"))!;
    const geo = generateModuleGeometry(mod).components.find(c => c.id === "a_bottom")!;
    expect(bottom.lengthMm).toBe(Math.round(geo.dimensions.width));
    expect(bottom.widthMm).toBe(Math.round(geo.dimensions.depth));
  });

  it("invalidates caches for same-version gap, shelf thickness, material metadata and nesting trim", () => {
    const p = projectWith(); const mod = p.modules[0];
    const a = generateBOMForProject(p);
    mod.carcass.doorPerimeterGap = 5;
    mod.bays[0].shelves[0].thickness = 22;
    const b = generateBOMForProject(p);
    expect(b).not.toBe(a);
    expect(b.cutList.find(p => p.componentRole === "shelf")?.thicknessMm).toBe(22);
    expect(b.cutList.find(p => p.componentRole === "door_left")?.widthMm).not.toBe(a.cutList.find(p => p.componentRole === "door_left")?.widthMm);
    const materials = new Map(DEFAULT_MATERIALS.map(m => [m.id, { ...m, name: "Changed" }]));
    expect(generateBOMForProject(p, materials).cutList[0].materialName).toBe("Changed");
    const nested = optimizeSheetNesting(b.cutList, { ...STANDARD_SHEET_2800x2070, trimCutMm: 50 });
    expect(nested[0].sheets[0].placedPieces[0].x).toBe(50);
  });

  it("conserves available width with a fixed first bay and rotates 180-degree geometry", () => {
    const mod = createInitialProject().modules[0]; mod.dimensions.width = 1801;
    mod.bays[0].customWidth = 600;
    const widths = calculateBayWidths(mod);
    expect(widths.reduce((a, b) => a + b, 0)).toBe(1801 - (mod.bays.length + 1) * mod.carcass.panelThickness);
    mod.rotation = { x: 0, y: 180, z: 0 };
    const placement = calculateModulePlacement(mod); expect(placement.origin.x).toBeCloseTo(mod.position.x + mod.dimensions.width); expect(placement.origin.z).toBeCloseTo(mod.position.z + mod.dimensions.depth);
  });

  it("uses actual panel thickness in 2D bay dimensions and fixed lift pivot", () => {
    const p = projectWith(); const mod = p.modules[0]; mod.carcass.panelThickness = 22;
    const geo = generateModuleGeometry(mod);
    expect(generateElevation2D(geo).dimensionLines.find(d => d.id === "dim_bay_0")?.x1).toBe(22);
    mod.bays[0].door.type = "lift_up_stay"; mod.bays[0].door.doorSystemId = "lift_up_stay";
    const a = generateModuleGeometry(mod).components.find(c => c.role === "door_left")!;
    const b = generateModuleGeometry(mod, { doorOpenAngleDeg: 90 }).components.find(c => c.role === "door_left")!;
    // Top hinge remains fixed while lower edge moves outward.
    expect(transformComponentPoint(b, b.pivot!)).toEqual(b.pivot);
    expect(b.pivot).toEqual({ x: a.position.x, y: a.position.y + a.dimensions.height, z: a.position.z });
  });

  it("independently inventories every template, geometry, schema, BOM and compatibility", () => {
    const rows = V4_MODULE_TEMPLATES.map(t => {
      const mod = t.createInstance(t.templateId); const p = projectWith(mod); const geo = generateModuleGeometry(mod); const bom = generateBOMForProject(p);
      expect(DesignProjectSchema.safeParse(p).success, t.templateId).toBe(true);
      expect(geo.components.length).toBeGreaterThan(0);
      for (const c of geo.components) expect(Object.values(c.dimensions).every(n => Number.isFinite(n) && n > 0), `${t.templateId}:${c.id}`).toBe(true);
      expect(new Set(geo.components.map(c => c.id)).size).toBe(geo.components.length);
      const fronts = geo.components.filter(c => c.role === "door_left" || c.role === "door_right");
      const space = calculateFourSpaceDimensions(mod);
      const dimensionalMismatch = fronts.some(c => Math.abs(c.dimensions.width - space.doorLeaves[c.bayIndex ?? 0].leafWidthMm) > 1 || Math.abs(c.dimensions.height - space.doorLeaves[c.bayIndex ?? 0].leafHeightMm) > 1);
      const issues = evaluateProjectCompatibility(p).issues;
      return { id: t.templateId, family: t.familyId, name: t.name, dimensions: mod.dimensions, components: geo.components.length, cutPieces: bom.cutList.length, dimensionalMismatch, status: mod.requiresFactoryValidation || dimensionalMismatch ? "PARTIALLY WORKING" : "UNVERIFIED", issues: issues.map(i => i.code) };
    });
    mkdirSync("test-results/v41", { recursive: true }); writeFileSync("test-results/v41/catalog.json", JSON.stringify(rows, null, 2));
    expect(rows).toHaveLength(92);
  });

  it("keeps nesting parts inside trim, separated by kerf, fixed grain and separate thickness sheets", () => {
    const bom = generateBOMForProject(projectWith());
    const results = optimizeSheetNesting(bom.cutList);
    for (const r of results) for (const sheet of r.sheets) {
      const cfg = sheet.sheetDimension; const pieces = sheet.placedPieces;
      const thicknesses = new Set(pieces.map(p => bom.cutList.find(c => c.id === p.pieceId)!.thicknessMm)); expect(thicknesses.size).toBe(1);
      for (let i = 0; i < pieces.length; i++) {
        const a = pieces[i]; expect(a.x).toBeGreaterThanOrEqual(cfg.trimCutMm); expect(a.y).toBeGreaterThanOrEqual(cfg.trimCutMm);
        expect(a.x + a.width).toBeLessThanOrEqual(cfg.lengthMm - cfg.trimCutMm); expect(a.y + a.length).toBeLessThanOrEqual(cfg.widthMm - cfg.trimCutMm);
        if (bom.cutList.find(p => p.id === a.pieceId)!.grain !== "none") expect(a.isRotated).toBe(false);
        for (const b of pieces.slice(i + 1)) expect(a.x + a.width + cfg.kerfMm <= b.x + 0.001 || b.x + b.width + cfg.kerfMm <= a.x + 0.001 || a.y + a.length + cfg.kerfMm <= b.y + 0.001 || b.y + b.length + cfg.kerfMm <= a.y + 0.001).toBe(true);
      }
    }
  });
});

it("records fresh 20/50-module computation timings without fabricated GPU memory estimates", () => {
  const rows: unknown[] = [];
  for (const count of [20, 50]) {
    const p = createInitialProject(); p.modules = Array.from({ length: count }, (_, i) => { const mod = V4_MODULE_TEMPLATES[0].createInstance(`stress_${i}`); mod.position.x = i * mod.dimensions.width; return mod; });
    const t0 = performance.now(); const geo = p.modules.map(m => generateModuleGeometry(m)); const t1 = performance.now(); const bom = generateBOMForProject(p); const t2 = performance.now(); calculateProjectPrice(bom); const t3 = performance.now();
    const mutations: number[] = [];
    for (let i = 0; i < 10; i++) { p.modules[0].dimensions.width += 1; const start = performance.now(); generateBOMForProject(p); mutations.push(performance.now() - start); }
    mutations.sort((a,b) => a-b);
    rows.push({ count, components: geo.reduce((n,g) => n + g.components.length, 0), cutPieces: bom.cutList.length, geometryMs: t1-t0, bomIncludingNestingMs: t2-t1, pricingMs: t3-t2, pipelineMs: t3-t0, mutationP50Ms: mutations[4], mutationP95Ms: mutations[9], processHeapUsedBytes: process.memoryUsage().heapUsed });
  }
  mkdirSync("test-results/v41", { recursive: true }); writeFileSync("test-results/v41/computation-performance.json", JSON.stringify(rows, null, 2));
});

describe("V4.1 persistence, state and library governance", () => {
  let saved: Map<string, string>;
  beforeEach(() => { saved = new Map(); vi.stubGlobal("localStorage", { getItem: (k: string) => saved.get(k) ?? null, setItem: (k: string, v: string) => saved.set(k, v) }); useConfiguratorStore.getState().resetToDefault(); });
  it("round trips handle/material selection, rejects malformed storage, surfaces quota failure", () => {
    const store = useConfiguratorStore; const p = structuredClone(store.getState().project);
    p.modules[0].bays[0].door.handleCategory = "knob"; store.setState({ project: p });
    store.getState().setMaterials(undefined, "mat_melamine_white");
    const id = store.getState().saveToStorage("Audit"); store.getState().resetToDefault(); expect(store.getState().loadFromStorage(id)).toBe(true);
    expect(store.getState().project.modules[0].bays[0].door.handleCategory).toBe("knob");
    expect(store.getState().project.modules[0].carcass.doorMaterialId).toBe("mat_melamine_white");
    saved.set("birim_saved_projects", JSON.stringify([{ id: "bad", project: { modules: [] } }])); expect(store.getState().loadFromStorage("bad")).toBe(false);
    vi.stubGlobal("localStorage", { getItem: () => "[]", setItem: () => { throw new Error("QuotaExceededError"); } }); expect(() => store.getState().saveToStorage()).toThrow(/Kayıt başarısız/);
  });
  it("syncs legacy door selection, clears approval, preserves undo and unique duplicated components", () => {
    const store = useConfiguratorStore; const p = structuredClone(store.getState().project); p.status = "production_approved"; p.modules[0].bays[0].door.doorSystemId = "hinged_double"; store.setState({ project: p });
    store.getState().setBayDoorType(0, "single_right"); expect(store.getState().project.status).toBe("draft"); expect(store.getState().project.modules[0].bays[0].door.doorSystemId).toBe("hinged_single");
    store.getState().undo(); expect(store.getState().project.modules[0].bays[0].door.doorSystemId).toBe("hinged_double"); store.getState().redo();
    store.getState().duplicateActiveModule(); const ids = store.getState().project.modules.flatMap(m => generateModuleGeometry(m).components.map(c => c.id)); expect(new Set(ids).size).toBe(ids.length);
    expect(store.getState().approveProduction().success).toBe(false);
  });
  it("does not publish fabricated verification or digests, isolates returned records", async () => {
    const admin = new V4LibraryAdminStore(); expect(admin.getReleases()).toEqual([]); expect(admin.getAllEntries().some(e => e.lifecycleState === "PUBLISHED")).toBe(false);
    const entry = admin.createDraftHardwareEntry({ id: "local_test", sku: "TEST", name: "Test", manufacturerName: "Synthetic", sourceId: "test-source" });
    expect(() => admin.createDraftHardwareEntry({ id: entry.id, sku: "TEST", name: "Test", manufacturerName: "Synthetic", sourceId: "test-source" })).toThrow();
    expect(admin.transitionLifecycleState(entry.id, "PUBLISHED").success).toBe(false);
    admin.updateVerificationFlags(entry.id, { sourceTechDataVerified: true, cadGeometryVerified: true, bomFormulaVerified: true, drillingPatternVerified: true, physicalFactorySampleTested: true }); admin.transitionLifecycleState(entry.id, "PUBLISHED");
    const release = await admin.publishNewRelease("4.1.0"); expect(release.sha256Digest).toMatch(/^[0-9a-f]{64}$/);
    release.entries![0].name = "Changed"; expect(admin.getReleases()[0].entries![0].name).toBe("Test");
  });
});
