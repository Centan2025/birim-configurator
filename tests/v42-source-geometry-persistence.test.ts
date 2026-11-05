import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createInitialProject,
  calculateFourSpaceDimensions,
  calculateModulePlacement,
  DesignProjectSchema,
  evaluateProjectCompatibility,
  CANONICAL_TECHNICAL_SOURCES,
  isSourceFullyVerifiedForProduction,
  computeSourceInvalidationImpact,
  migrateV3ProjectToV4,
  SUPPORTED_PROJECT_SCHEMA_VERSION,
  validateProject,
  parseCadDxfText,
  parsePdfFloorPlanMetadata,
  convertUnderlayPolylinesToWalls,
} from "@birim/core";
import {
  generateModuleGeometry,
  generateElevation2D,
  generateTopPlan2D,
  generateCrossSection2D,
  componentBounds,
} from "@birim/geometry";
import { V4_MODULE_TEMPLATES, WARDROBE_TEMPLATES, HANDLE_PROFILES, V4LibraryAdminStore } from "@birim/catalog";
import { generateBOMForProject } from "@birim/manufacturing";
import { useConfiguratorStore } from "../apps/configurator/src/store/useConfiguratorStore";
import { computePhysicalUvScale } from "../apps/configurator/src/v3/materials/pbrMaterialSystem";
import {
  computeElevationSnapTargets,
  resolveElevationSnap,
} from "../apps/configurator/src/v3/engine/elevationSnapEngine";

describe("WP-01: Technical Source Registry, Evidence Matrix & Fail-Closed Production Gates", () => {
  it("separates explicit document claims from application inferences and fails closed when physicalFactorySample is false", () => {
    const sourceList = Object.values(CANONICAL_TECHNICAL_SOURCES);
    expect(sourceList.length).toBeGreaterThanOrEqual(16);
    for (const src of sourceList) {
      expect(src.documentExplicitClaims.length).toBeGreaterThan(0);
      expect(Array.isArray(src.applicationInferences)).toBe(true);
    }
    expect(sourceList.some((src) => src.applicationInferences.length > 0)).toBe(true);

    const factoryStatus = isSourceFullyVerifiedForProduction("SRC_BIRIM_FACTORY_V3", "3.1", "2026-11-05");
    expect(factoryStatus.verified).toBe(false);
    expect(factoryStatus.missingDomains).toContain("physicalFactorySample");

    const missingSource = isSourceFullyVerifiedForProduction(undefined);
    expect(missingSource.verified).toBe(false);
    expect(missingSource.missingDomains).toHaveLength(5);

    const revMismatch = isSourceFullyVerifiedForProduction("SRC_BLUM_CAT_HINGE", "2099.9", "2026-11-05");
    expect(revMismatch.verified).toBe(false);
    expect(revMismatch.reason).toContain("sürüm uyuşmazlığı");

    const expired = isSourceFullyVerifiedForProduction("SRC_BLUM_CAT_HINGE", "2024.1", "2035-01-01");
    expect(expired.verified).toBe(false);
    expect(expired.reason).toContain("geçerlilik süresi");
  });

  it("rejects draft catalog versions, missing hardware sourceIds, and forged production_approved status", () => {
    const project = createInitialProject();
    project.libraryVersionId = "lib_v4_2_draft";
    project.status = "production_approved";
    project.modules[0].bays[0].door.hardwareProductId = "hw_unknown_custom_hinge";

    const report = evaluateProjectCompatibility(project);
    expect(report.canApproveProduction).toBe(false);
    expect(report.overallStatus).toBe("INCOMPATIBLE");
    const codes = report.issues.map((i) => i.code);
    expect(codes).toContain("V41_FACTORY_RULES_UNVERIFIED");
    expect(codes).toContain("CHK_15_DRAFT_CATALOG_VERSION");
    expect(codes).toContain("CHK_15_UNVERIFIED_HARDWARE_SOURCE");
    expect(codes).toContain("CHK_15_TAMPERED_PRODUCTION_APPROVAL");
    expect(report.evidenceMatrix.allProductionGatesSatisfied).toBe(false);
    expect(report.evidenceMatrix.entries.some((e) => e.status === "TAMPERED_APPROVAL")).toBe(true);
  });

  it("invalidates published catalog entries when a technical source revision changes", () => {
    const store = new V4LibraryAdminStore();
    store.updateVerificationFlags("hw_blum_71b3550", {
      sourceTechDataVerified: true,
      cadGeometryVerified: true,
      bomFormulaVerified: true,
      drillingPatternVerified: true,
      physicalFactorySampleTested: true,
    });
    expect(store.transitionLifecycleState("hw_blum_71b3550", "PUBLISHED").success).toBe(true);

    const impacted = computeSourceInvalidationImpact(
      "SRC_BLUM_CAT_HINGE",
      "2025.1",
      store.getAllEntries().map((e) => ({ id: e.id, sourceId: e.sourceId, revision: e.sourceRevision || "2024.1" }))
    );
    expect(impacted.invalidatedHardwareIds).toContain("hw_blum_71b3550");

    const invalidatedIds = store.invalidateEntriesForSourceRevision("SRC_BLUM_CAT_HINGE", "2025.1");
    expect(invalidatedIds).toContain("hw_blum_71b3550");
    const entry = store.getAllEntries().find((e) => e.id === "hw_blum_71b3550")!;
    expect(entry.lifecycleState).toBe("REVIEW");
    expect(entry.verification.sourceTechDataVerified).toBe(false);
    expect(entry.verification.physicalFactorySampleTested).toBe(false);
  });
});

describe("WP-02 & WP-05: Canonical Part/Front/Motion Contract, 2D Unclipped Bounds & Manufacturable BOM", () => {
  it("keeps 4-space door leaf dimensions and origins 100% aligned with 3D geometry across 16/18/22mm and overlay types", () => {
    for (const panelThickness of [16, 18, 22]) {
      for (const overlayType of ["full_overlay", "half_overlay", "inset"] as const) {
        for (const doorType of ["single_left", "single_right", "double", "folding"] as const) {
          const mod = createInitialProject().modules[0];
          mod.carcass.panelThickness = panelThickness;
          mod.bays[0].door = {
            ...mod.bays[0].door,
            type: doorType,
            doorSystemId:
              doorType === "double"
                ? "hinged_double"
                : doorType === "folding"
                  ? "folding_side"
                  : overlayType === "inset"
                    ? "hinged_inset"
                    : "hinged_single",
            overlayType,
          };
          const fourSpace = calculateFourSpaceDimensions(mod);
          const geo = generateModuleGeometry(mod);
          const bay0Doors = geo.components.filter(
            (c) => c.bayIndex === 0 && (c.role === "door_left" || c.role === "door_right")
          );
          expect(bay0Doors.length).toBe(fourSpace.doorLeaves[0].leafCount);
          for (const doorComp of bay0Doors) {
            expect(doorComp.dimensions.width).toBeCloseTo(fourSpace.doorLeaves[0].leafWidthMm, 4);
            expect(doorComp.dimensions.height).toBeCloseTo(fourSpace.doorLeaves[0].leafHeightMm, 4);
            expect(doorComp.position.y).toBeCloseTo(fourSpace.doorLeaves[0].doorY0Mm, 4);
            expect(doorComp.position.z).toBeCloseTo(fourSpace.doorLeaves[0].doorZ0Mm, 4);
          }
        }
      }
    }
  });

  it("expands 2D elevation, top plan, and cross-section viewBoxes so open doors (0/45/90 deg) and pulled drawers never clip", () => {
    const mod = createInitialProject().modules[0];
    for (const angle of [0, 45, 90]) {
      const geo = generateModuleGeometry(mod, { doorOpenAngleDeg: angle, drawerOpenMm: 220 });
      for (const proj of [generateElevation2D(geo), generateTopPlan2D(geo), generateCrossSection2D(geo)]) {
        const { viewBox, elements } = proj;
        for (const el of elements) {
          expect(el.x).toBeGreaterThanOrEqual(viewBox.x);
          expect(el.y).toBeGreaterThanOrEqual(viewBox.y);
          expect(el.x + el.width).toBeLessThanOrEqual(viewBox.x + viewBox.width);
          expect(el.y + el.height).toBeLessThanOrEqual(viewBox.y + viewBox.height);
        }
      }
    }

    for (const rotY of [0, 90, 180, 270]) {
      mod.rotation = { x: 0, y: rotY, z: 0 };
      const placement = calculateModulePlacement(mod);
      expect(placement.width).toBeCloseTo(rotY % 180 === 0 ? mod.dimensions.width : mod.dimensions.depth, 3);
      expect(placement.depth).toBeCloseTo(rotY % 180 === 0 ? mod.dimensions.depth : mod.dimensions.width, 3);
    }
  });

  it("excludes special fittings and hardware-only complementary items from wooden panel cutList while preserving their hardware BOM", () => {
    const project = createInitialProject();
    project.modules[0].bays[0].specialFittings = [
      { id: "fit_trouser", bayIndex: 0, elevationY: 650, type: "trouser_rack", height: 80 },
      { id: "fit_basket", bayIndex: 0, elevationY: 300, type: "wire_basket", height: 150 },
    ];
    const levelingFeetMod = V4_MODULE_TEMPLATES.find((t) => t.templateId === "tpl_cm_02_leveling_feet")!.createInstance("feet_1");
    project.modules.push(levelingFeetMod);

    const bom = generateBOMForProject(project);
    expect(bom.cutList.some((p) => p.id.includes("fit_trouser") || p.id.includes("fit_basket"))).toBe(false);
    expect(bom.cutList.some((p) => p.moduleId === "feet_1")).toBe(false);
    expect(bom.hardwareList.some((h) => h.sku === "807.95.122")).toBe(true);
    expect(bom.hardwareList.some((h) => h.sku === "807.52.220")).toBe(true);
    expect(bom.hardwareList.some((h) => h.sku === "HW_LEVELING_FEET")).toBe(true);
  });
});

describe("WP-03: Handle & Front Compatibility Rules & Per-Bay Handle Selection", () => {
  it("flags gola_profile + inset door, recessed_grip on thin door, and long_profile_handle exceeding door/drawer span", () => {
    const p1 = createInitialProject();
    p1.modules[0].bays[0].door.overlayType = "inset";
    p1.modules[0].bays[0].door.doorSystemId = "hinged_inset";
    p1.modules[0].bays[0].door.handleCategory = "gola_profile";
    expect(evaluateProjectCompatibility(p1).issues.map((i) => i.code)).toContain("CHK_08_GOLA_INCOMPATIBLE_WITH_INSET");

    const p2 = createInitialProject();
    p2.modules[0].bays[0].door.doorThicknessMm = 16;
    p2.modules[0].bays[0].door.handleCategory = "recessed_grip";
    expect(evaluateProjectCompatibility(p2).issues.map((i) => i.code)).toContain("CHK_08_RECESSED_GRIP_MIN_THICKNESS");

    const p3 = createInitialProject();
    p3.modules[0].dimensions.height = 720;
    p3.modules[0].bays[0].door.handleCategory = "long_profile_handle";
    expect(evaluateProjectCompatibility(p3).issues.map((i) => i.code)).toContain("CHK_08_HANDLE_LENGTH_EXCEEDS_FRONT");
  });

  it("updates per-bay handle category and profile via store action and reflects in BOM", () => {
    const bespokeProfile = HANDLE_PROFILES.find((p) => p.category === "decorative_bespoke")!;
    useConfiguratorStore.getState().resetToDefault();
    useConfiguratorStore.getState().setBayHandleCategory(0, "decorative_bespoke", bespokeProfile.id);
    const state = useConfiguratorStore.getState();
    expect(state.project.modules[0].bays[0].door.handleCategory).toBe("decorative_bespoke");
    expect(state.project.modules[0].bays[0].door.handleProfileId).toBe(bespokeProfile.id);
    expect(state.bom.hardwareList.some((h) => h.sku === bespokeProfile.sku)).toBe(true);
  });
});

describe("WP-07: Versioned Persistence, Forward-Version Rejection, Revisions & Atomic Batch Undo", () => {
  let saved: Map<string, string>;
  beforeEach(() => {
    saved = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => saved.get(k) ?? null,
      setItem: (k: string, v: string) => saved.set(k, v),
    });
    useConfiguratorStore.getState().resetToDefault();
  });

  it("stamps schemaVersion=4 on export/save, migrates legacy projects, and rejects future schemaVersion > 4", () => {
    const store = useConfiguratorStore.getState();
    const exported = JSON.parse(store.exportProjectJSON());
    expect(exported.schemaVersion).toBe(SUPPORTED_PROJECT_SCHEMA_VERSION);
    expect(exported.catalogVersion).toBe("lib_v4_0_0");
    expect(exported.revisionId).toBeDefined();
    expect(exported.verificationSnapshot).toBeDefined();

    // Forward-version rejection in schema and importProjectJSON
    const futurePayload = JSON.stringify({ ...exported, schemaVersion: 99 });
    expect(DesignProjectSchema.safeParse(JSON.parse(futurePayload)).success).toBe(false);
    const importRes = useConfiguratorStore.getState().importProjectJSON(futurePayload);
    expect(importRes.success).toBe(false);
    expect(importRes.error).toContain("Desteklenmeyen ileri şema sürümü");

    // Legacy V3 migration
    const legacyRaw = { ...exported };
    delete legacyRaw.schemaVersion;
    delete legacyRaw.catalogVersion;
    delete legacyRaw.revisionId;
    const migrated = migrateV3ProjectToV4(legacyRaw);
    expect(migrated.schemaVersion).toBe(SUPPORTED_PROJECT_SCHEMA_VERSION);
    expect(migrated.catalogVersion).toBe("lib_v4_0_0");
    expect(migrated.revisionId).toBeDefined();
  });

  it("coalesces continuous slider/drag mutations into a single atomic undo step", () => {
    const store = useConfiguratorStore;
    const initialWidth = store.getState().project.modules[0].dimensions.width;

    store.getState().beginHistoryTransaction();
    for (const w of [1900, 2000, 2100, 2200, 2400]) {
      store.getState().setDimensions(w, 2200, 600);
    }
    expect(store.getState().history).toHaveLength(0);
    store.getState().commitHistoryTransaction();

    expect(store.getState().history).toHaveLength(1);
    expect(store.getState().project.modules[0].dimensions.width).toBe(2400);

    store.getState().undo();
    expect(store.getState().project.modules[0].dimensions.width).toBe(initialWidth);
  });

  it("creates revision snapshots, computes deterministic revision diffs, and restores prior revisions", () => {
    const store = useConfiguratorStore;
    const rev1 = store.getState().createRevisionSnapshot("İlk Tasarım");
    store.getState().setDimensions(2400, 2200, 600);
    store.getState().addAdjacentModule();
    const rev2 = store.getState().createRevisionSnapshot("Genişletilmiş Tasarım");

    const diff = store.getState().diffRevisions(rev1, rev2);
    expect(diff).not.toBeNull();
    expect(diff!.moduleCountDelta).toBe(1);
    expect(diff!.addedModuleIds).toHaveLength(1);
    expect(diff!.modifiedModuleIds).toContain("module_1");
    expect(diff!.priceDeltaEur).toBeGreaterThan(0);

    expect(store.getState().restoreRevisionSnapshot(rev1)).toBe(true);
    expect(store.getState().project.modules).toHaveLength(1);
    expect(store.getState().project.modules[0].dimensions.width).toBe(1800);
  });
});

describe("WP-06: Room Obstacles, Rotated Placement & Front Opening Sweep Collisions", () => {
  it("detects column and window collisions and 90-degree L-corner front opening sweep interference", () => {
    const project = createInitialProject();
    project.space.elements = [
      {
        id: "col_1",
        type: "column",
        name: "Taşıyıcı Kolon",
        position: { x: 100, y: 0, z: 0 },
        dimensions: { width: 300, height: 2600, depth: 300 },
      },
    ];
    const mod2 = V4_MODULE_TEMPLATES[0].createInstance("mod_corner_return");
    mod2.position = { x: 0, y: 0, z: 600 };
    mod2.rotation = { x: 0, y: 90, z: 0 };
    project.modules.push(mod2);

    const issues = validateProject(project);
    const codes = issues.map((i) => i.code);
    expect(codes).toContain("ERR_COLUMN_COLLISION");
    expect(codes).toContain("WARN_FRONT_OPENING_SWEEP_COLLISION");
  });

  it("parses DXF/DWG CAD polylines and PDF floorplan bounds, converts CAD lines to walls, and updates room/wall/obstacle state", () => {
    const sampleDxf = [
      "0", "SECTION", "2", "ENTITIES",
      "0", "LINE", "8", "WALLS", "10", "0", "20", "0", "11", "4200", "21", "0",
      "0", "LINE", "8", "WALLS", "10", "4200", "20", "0", "11", "4200", "21", "2800",
      "0", "LWPOLYLINE", "8", "ISLAND", "70", "1", "10", "1000", "20", "1200", "10", "2600", "20", "1200", "10", "2600", "20", "2100",
      "0", "ENDSEC", "0", "EOF",
    ].join("\n");

    const parsedDxf = parseCadDxfText(sampleDxf, "kat_plani.dxf", 1);
    expect(parsedDxf.fileType).toBe("dxf");
    expect(parsedDxf.polylines?.length).toBe(3);
    expect(parsedDxf.widthMm).toBe(4200);
    expect(parsedDxf.depthMm).toBe(2800);

    const extractedWalls = convertUnderlayPolylinesToWalls(parsedDxf, 2700);
    expect(extractedWalls.length).toBeGreaterThanOrEqual(4);
    expect(extractedWalls[0].length).toBe(4200);
    expect(extractedWalls[1].rotationY).toBe(90);

    const samplePdf = "%PDF-1.7\n1 0 obj\n<< /Type /Page /MediaBox [0 0 841.89 595.28] >>\nendobj";
    const parsedPdf = parsePdfFloorPlanMetadata(samplePdf, "mimari_plan.pdf", 50);
    expect(parsedPdf.fileType).toBe("pdf");
    expect(parsedPdf.widthMm).toBeGreaterThan(2500);
    expect(parsedPdf.polylines).toHaveLength(1);

    const store = useConfiguratorStore;
    store.getState().resetToDefault();
    store.getState().setRoomDimensions(4800, 2850);
    expect(store.getState().project.space.walls[0].length).toBe(4800);
    expect(store.getState().project.space.ceilingHeight).toBe(2850);

    const wallId = store.getState().addWallSegment({
      name: "Serbest Açılı Duvar",
      length: 1800,
      position: { x: 4800, y: 0, z: 0 },
      rotationY: 45,
    });
    expect(store.getState().project.space.walls.some((w) => w.id === wallId && w.rotationY === 45)).toBe(true);

    // Move and resize wall segment, then undo/redo
    store.getState().updateWallSegment(wallId, {
      position: { x: 3600, z: 250 },
      length: 2100,
      rotationY: 90,
    });
    const movedWall = store.getState().project.space.walls.find((w) => w.id === wallId)!;
    expect(movedWall.position.x).toBe(3600);
    expect(movedWall.position.z).toBe(250);
    expect(movedWall.length).toBe(2100);
    expect(movedWall.rotationY).toBe(90);
    store.getState().undo();
    expect(store.getState().project.space.walls.find((w) => w.id === wallId)!.position.x).toBe(4800);
    store.getState().redo();
    expect(store.getState().project.space.walls.find((w) => w.id === wallId)!.position.x).toBe(3600);

    const obsId = store.getState().addSpaceObstacle({
      type: "column",
      name: "Köşe Kolon",
      position: { x: 200, y: 0, z: 0 },
      dimensions: { width: 300, height: 2850, depth: 300 },
    });
    expect(store.getState().project.space.elements.some((el) => el.id === obsId)).toBe(true);
    expect(store.getState().validationIssues.some((i) => i.code === "ERR_COLUMN_COLLISION")).toBe(true);

    // Move obstacle to (x: 2400, z: 400) away from the wardrobe module -> collision clears
    store.getState().updateSpaceObstacle(obsId, { position: { x: 2400, z: 400 } });
    const movedObs = store.getState().project.space.elements.find((el) => el.id === obsId)!;
    expect(movedObs.position.x).toBe(2400);
    expect(movedObs.position.z).toBe(400);
    expect(store.getState().validationIssues.some((i) => i.code === "ERR_COLUMN_COLLISION")).toBe(false);

    // Delete obstacle, then undo (Ctrl+Z) -> obstacle returns!
    store.getState().removeSpaceObstacle(obsId);
    expect(store.getState().project.space.elements.some((el) => el.id === obsId)).toBe(false);
    store.getState().undo();
    expect(store.getState().project.space.elements.some((el) => el.id === obsId)).toBe(true);
    store.getState().redo();
    expect(store.getState().project.space.elements.some((el) => el.id === obsId)).toBe(false);

    store.getState().setFloorPlanUnderlay(parsedDxf);
    const importedCount = store.getState().importWallsFromUnderlay(false);
    expect(importedCount).toBe(extractedWalls.length);
  });
});

describe("WP-05, WP-08, WP-09, WP-10 & WP-12: Special Carcass Topology, Library Rollback, Multi-Select Batch & Memoization", () => {
  it("generates dedicated multi-part carcass components for blind-corner, L-corner, and built-in oven modules", () => {
    const blindTpl = V4_MODULE_TEMPLATES.find((t) => t.templateId.includes("blind"))!;
    const blindGeo = generateModuleGeometry(blindTpl.createInstance("mod_blind"));
    expect(blindGeo.components.some((c) => c.id.endsWith("_blind_panel"))).toBe(true);
    expect(blindGeo.components.some((c) => c.id.endsWith("_corner_filler"))).toBe(true);

    const cornerTpl = V4_MODULE_TEMPLATES.find(
      (t) => t.category === "kitchen_corner" && !t.templateId.includes("blind")
    )!;
    const cornerGeo = generateModuleGeometry(cornerTpl.createInstance("mod_corner"));
    expect(cornerGeo.components.some((c) => c.id.endsWith("_corner_post"))).toBe(true);

    const ovenTpl = V4_MODULE_TEMPLATES.find((t) => t.templateId.includes("oven"))!;
    const ovenGeo = generateModuleGeometry(ovenTpl.createInstance("mod_oven"));
    expect(ovenGeo.components.some((c) => c.id.endsWith("_appliance_shelf"))).toBe(true);
    expect(ovenGeo.components.some((c) => c.id.endsWith("_appliance_vent_strip"))).toBe(true);
  });

  it("supports library draft authoring, localStorage persistence, and release snapshot rollback (WP-08)", async () => {
    const saved = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => saved.get(k) ?? null,
      setItem: (k: string, v: string) => saved.set(k, v),
    });

    const libStore = new V4LibraryAdminStore();
    const draft = libStore.createDraftTemplateEntry({
      id: "tpl_custom_v42_test",
      code: "TPL-CUSTOM-V42",
      name: "Özel Test Modülü",
      familyId: "fam_wardrobe_hinged",
      sourceId: "SRC_BIRIM_V4_SPEC",
    });
    expect(draft.lifecycleState).toBe("DRAFT");
    expect(libStore.saveToLocalStorage()).toBe(true);

    libStore.updateVerificationFlags("tpl_custom_v42_test", {
      sourceTechDataVerified: true,
      cadGeometryVerified: true,
      bomFormulaVerified: true,
      drillingPatternVerified: true,
      physicalFactorySampleTested: true,
    });
    expect(libStore.transitionLifecycleState("tpl_custom_v42_test", "PUBLISHED").success).toBe(true);
    const rel = await libStore.publishNewRelease("4.2.0", "BIRIM_ADMIN");
    libStore.transitionLifecycleState("tpl_custom_v42_test", "DEPRECATED");
    expect(libStore.rollbackToRelease(rel.releaseId).success).toBe(true);

    const reloadedStore = new V4LibraryAdminStore();
    expect(reloadedStore.loadFromLocalStorage()).toBe(true);
    expect(reloadedStore.getAllEntries().some((e) => e.id === "tpl_custom_v42_test")).toBe(true);
  });

  it("supports multi-module selection and atomic batch move/material update with single-step undo (WP-09)", () => {
    const store = useConfiguratorStore;
    store.getState().resetToDefault();
    store.getState().addAdjacentModule();
    store.getState().selectAllModules();
    expect(store.getState().selectedModuleIds).toHaveLength(2);

    const x0Before = store.getState().project.modules[0].position.x;
    const x1Before = store.getState().project.modules[1].position.x;

    store.getState().batchMoveSelectedModules(150, 50);
    expect(store.getState().project.modules[0].position.x).toBe(x0Before + 150);
    expect(store.getState().project.modules[1].position.x).toBe(x1Before + 150);
    expect(store.getState().project.modules[1].position.z).toBe(50);

    store.getState().undo();
    expect(store.getState().project.modules[0].position.x).toBe(x0Before);
    expect(store.getState().project.modules[1].position.x).toBe(x1Before);

    store.getState().selectAllModules();
    store.getState().batchSetSelectedModulesMaterial("mat_anthracite_melamine", "mat_ american_walnut");
    expect(
      store.getState().project.modules.every((m) => m.carcass.bodyMaterialId === "mat_anthracite_melamine")
    ).toBe(true);
  });

  it("computes millimeter-accurate UV repeat and grain rotation (WP-10) and memoizes unchanged module geometry (WP-12)", () => {
    const uvLengthwise = computePhysicalUvScale(600, 1200, "lengthwise");
    const uvCrosswise = computePhysicalUvScale(600, 1200, "crosswise");
    expect(uvLengthwise.repeatX).toBe(1);
    expect(uvLengthwise.repeatY).toBe(2);
    expect(uvLengthwise.rotationRad).toBe(0);
    expect(uvCrosswise.rotationRad).toBeCloseTo(Math.PI / 2, 5);

    const mod = createInitialProject().modules[0];
    const g1 = generateModuleGeometry(mod);
    const g2 = generateModuleGeometry(mod);
    expect(g1).toBe(g2);
  });

  it("keeps drawer handles strictly within drawer front bounds and places integrated handles at ergonomic reach on wall and tall cabinets (WP-03)", () => {
    const categories = [
      "knob",
      "bar_handle",
      "long_profile_handle",
      "edge_profile",
      "recessed_grip",
      "gola_profile",
      "j_pull",
      "milled_wood_grip",
      "decorative_bespoke",
    ] as const;

    // 1. Shallow + standard drawers (e.g. 115mm / 140mm / 215mm): no handle part may overflow drawer_front X or Y bounds
    const drawerTpl = V4_MODULE_TEMPLATES.find((t) => t.templateId === "tpl_kb_05_three_drawers")!;
    for (const cat of categories) {
      const mod = drawerTpl.createInstance(`drw_${cat}`);
      mod.bays[0].door.handleCategory = cat;
      const geo = generateModuleGeometry(mod);
      const fronts = geo.components.filter((c) => c.role === "drawer_front");
      expect(fronts.length).toBeGreaterThan(0);
      for (const front of fronts) {
        const handles = geo.components.filter((c) => c.parentComponentId === front.id);
        expect(handles.length).toBeGreaterThan(0);
        for (const h of handles) {
          expect(h.position.x).toBeGreaterThanOrEqual(front.position.x - 0.5);
          expect(h.position.x + h.dimensions.width).toBeLessThanOrEqual(
            front.position.x + front.dimensions.width + 0.5
          );
          expect(h.position.y).toBeGreaterThanOrEqual(front.position.y - 0.5);
          expect(h.position.y + h.dimensions.height).toBeLessThanOrEqual(
            front.position.y + front.dimensions.height + 0.5
          );
        }
      }
    }

    // 2. Kitchen Wall cabinet (mounted at Y=1450mm): integrated handles (j_pull, gola_profile, edge_profile) must be at the BOTTOM edge, never at the unreachable top!
    const wallTpl = V4_MODULE_TEMPLATES.find((t) => t.templateId === "tpl_kw_01_single_door")!;
    for (const cat of ["j_pull", "gola_profile", "edge_profile", "bar_handle"] as const) {
      const wallMod = wallTpl.createInstance(`wall_${cat}`);
      wallMod.bays[0].door.handleCategory = cat;
      const wallGeo = generateModuleGeometry(wallMod);
      const door = wallGeo.components.find((c) => c.role === "door_left" || c.role === "door_right")!;
      const handles = wallGeo.components.filter((c) => c.parentComponentId === door.id);
      for (const h of handles) {
        const handleCenterY = h.position.y + h.dimensions.height / 2 - door.position.y;
        expect(handleCenterY).toBeLessThan(120);
      }
    }

    // 3. Tall Wardrobe (height 2200mm): integrated handles (j_pull, edge_profile) must be placed at reachable waist/chest height (~900-1150mm), never at the top edge (2200mm)!
    const wardrobeTpl = V4_MODULE_TEMPLATES.find((t) => t.templateId === "tpl_wd_02_two_door")!;
    for (const cat of ["j_pull", "edge_profile", "bar_handle"] as const) {
      const wdMod = wardrobeTpl.createInstance(`wd_${cat}`);
      wdMod.bays[0].door.handleCategory = cat;
      const wdGeo = generateModuleGeometry(wdMod);
      const door = wdGeo.components.find((c) => c.role === "door_left")!;
      const handles = wdGeo.components.filter((c) => c.parentComponentId === door.id);
      for (const h of handles) {
        const topOfHandleY = h.position.y + h.dimensions.height;
        expect(topOfHandleY).toBeLessThan(1400);
      }
    }
  });

  it("computes multi-link door kinematics with non-manufacturable linkage arms (WP-04) and supports all 92 template instances + parametric draft authoring (WP-08.1)", () => {
    expect(V4_MODULE_TEMPLATES.length).toBe(92);
    for (const tpl of V4_MODULE_TEMPLATES) {
      const inst = tpl.createInstance(`test_${tpl.templateId}`);
      expect(inst.dimensions.width).toBeGreaterThan(0);
      expect(inst.dimensions.height).toBeGreaterThan(0);
      expect(inst.dimensions.depth).toBeGreaterThan(0);
    }

    // AVENTOS HF Bi-fold & HL Parallel linkage arms when open
    const bifoldTpl = V4_MODULE_TEMPLATES.find((t) => t.templateId === "tpl_kw_06_lift_bifold")!;
    const bifoldMod = bifoldTpl.createInstance("bifold_test");
    const bifoldOpen = generateModuleGeometry(bifoldMod, { doorOpenAngleDeg: 75 });
    const hfArm = bifoldOpen.components.find((c) => c.id.includes("hf_telescopic_arm"));
    expect(hfArm).toBeDefined();
    expect(hfArm?.isManufacturablePanel).toBe(false);

    // REVEGO Pocket 2-stage pivot then linear retraction
    const pocketTpl = V4_MODULE_TEMPLATES.find((t) => t.templateId === "tpl_kt_11_pocket_appliance")!;
    const pocketMod = pocketTpl.createInstance("pocket_test");
    const pocketStage1 = generateModuleGeometry(pocketMod, { doorOpenAngleDeg: 25 });
    const pocketStage2 = generateModuleGeometry(pocketMod, { doorOpenAngleDeg: 85 });
    const leaf1 = pocketStage1.components.find((c) => c.id.includes("pocket_leaf"))!;
    const leaf2 = pocketStage2.components.find((c) => c.id.includes("pocket_leaf"))!;
    expect(leaf2.position.z).toBeLessThan(leaf1.position.z);
    const pocketTrack = pocketStage2.components.find((c) => c.id.includes("revego_pocket_track"));
    expect(pocketTrack).toBeDefined();
    expect(pocketTrack?.isManufacturablePanel).toBe(false);

    // WP-08.1 Parametric draft template authoring
    const admin = new V4LibraryAdminStore();
    const draft = admin.createDraftTemplateEntry({
      id: "tpl_custom_wp081",
      code: "TPL-WP081",
      name: "Özel Parametrik Dolap",
      familyId: "fam_kitchen_base",
      sourceId: "SRC_BIRIM_V4_SPEC",
      defaultDimensions: { width: 750, height: 760, depth: 600 },
      defaultDoorSystemId: "hinged_double",
    });
    expect(draft.defaultDimensions).toEqual({ width: 750, height: 760, depth: 600 });
    expect(draft.defaultDoorSystemId).toBe("hinged_double");
  });

  it("enforces exact door leaf counts, equalized 3-door bay widths, bottom-to-top drawer ordering, and non-overlapping partial doors across templates", () => {
    // 1. tpl_wd_03_three_door ("Üç Kapaklı Gardırop", 1500mm) -> 3 doors (1 single on Bay 0 + 2 double on Bay 1)
    const wd3Tpl = V4_MODULE_TEMPLATES.find((t) => t.templateId === "tpl_wd_03_three_door")!;
    const wd3Mod = wd3Tpl.createInstance("wd3");
    const wd3Geo = generateModuleGeometry(wd3Mod);
    const wd3Doors = wd3Geo.components.filter(
      (c) => c.role === "door_left" || c.role === "door_right"
    );
    expect(wd3Doors.length).toBe(3);
    // All 3 door leaves should have approximately equal width (~496mm each on a 1500mm wardrobe)
    expect(Math.abs(wd3Doors[0].dimensions.width - wd3Doors[1].dimensions.width)).toBeLessThanOrEqual(4);
    expect(Math.abs(wd3Doors[1].dimensions.width - wd3Doors[2].dimensions.width)).toBeLessThanOrEqual(4);
    // Bay 1 has 2 external bottom drawers, and Bay 1's doors sit cleanly above those drawers
    const wd3Bay1Drawers = wd3Geo.components.filter(
      (c) => c.role === "drawer_front" && c.bayIndex === 1
    );
    expect(wd3Bay1Drawers.length).toBe(2);
    const maxDrawerTopY = Math.max(
      ...wd3Bay1Drawers.map((d) => d.position.y + d.dimensions.height)
    );
    const wd3Bay1Doors = wd3Doors.filter((d) => d.bayIndex === 1);
    for (const d of wd3Bay1Doors) {
      expect(d.position.y).toBeGreaterThanOrEqual(maxDrawerTopY);
    }

    // 2. Legacy WARDROBE_TEMPLATES tpl_wardrobe_3door_drawers ("3 Kapaklı Çekmeceli Master Gardırop", 1800mm) -> 3 equal-width doors
    const master3Tpl = WARDROBE_TEMPLATES.find(
      (t) => t.templateId === "tpl_wardrobe_3door_drawers"
    )!;
    const master3Mod = master3Tpl.createInstance("master3");
    const master3Geo = generateModuleGeometry(master3Mod);
    const master3Doors = master3Geo.components.filter(
      (c) => c.role === "door_left" || c.role === "door_right"
    );
    expect(master3Doors.length).toBe(3);
    expect(
      Math.abs(master3Doors[0].dimensions.width - master3Doors[1].dimensions.width)
    ).toBeLessThanOrEqual(4);

    // 3. tpl_wd_04_four_door ("Dört Kapaklı Gardırop", 2000mm) -> 4 doors
    const wd4Mod = V4_MODULE_TEMPLATES.find(
      (t) => t.templateId === "tpl_wd_04_four_door"
    )!.createInstance("wd4");
    const wd4Doors = generateModuleGeometry(wd4Mod).components.filter(
      (c) => c.role === "door_left" || c.role === "door_right"
    );
    expect(wd4Doors.length).toBe(4);

    // 4. tpl_wd_12_mixed_organizer (1200mm) & tpl_sc_06_under_stairs (1200mm) -> 2 doors (1 per bay)
    for (const id of ["tpl_wd_12_mixed_organizer", "tpl_sc_06_under_stairs"]) {
      const mod = V4_MODULE_TEMPLATES.find((t) => t.templateId === id)!.createInstance(id);
      const doors = generateModuleGeometry(mod).components.filter(
        (c) => c.role === "door_left" || c.role === "door_right"
      );
      expect(doors.length).toBe(2);
    }

    // 5. tpl_kb_19_drawer_door_combo -> top cutlery drawer above lower hinged door
    const comboMod = V4_MODULE_TEMPLATES.find(
      (t) => t.templateId === "tpl_kb_19_drawer_door_combo"
    )!.createInstance("combo");
    const comboGeo = generateModuleGeometry(comboMod);
    const comboDrawer = comboGeo.components.find((c) => c.role === "drawer_front")!;
    const comboDoor = comboGeo.components.find((c) => c.role === "door_left")!;
    expect(comboDrawer.position.y).toBeGreaterThan(comboDoor.position.y + comboDoor.dimensions.height - 5);

    // 6. tpl_kb_05_three_drawers -> shallow cutlery drawer (140mm) is at the top (highest elevationY)
    const kb05Mod = V4_MODULE_TEMPLATES.find(
      (t) => t.templateId === "tpl_kb_05_three_drawers"
    )!.createInstance("kb05");
    const kb05Drawers = [...kb05Mod.bays[0].drawers].sort((a, b) => a.elevationY - b.elevationY);
    expect(kb05Drawers[0].height).toBe(215);
    expect(kb05Drawers[2].height).toBe(140);

    // 7. Built-in oven tower has non-manufacturable 3D oven visual and upper door sits above oven cavity
    const ovenTowerMod = V4_MODULE_TEMPLATES.find(
      (t) => t.templateId === "tpl_kt_04_oven_tower"
    )!.createInstance("oven_tower");
    const ovenTowerGeo = generateModuleGeometry(ovenTowerMod);
    const ovenUnit = ovenTowerGeo.components.find((c) => c.id.includes("builtin_oven_unit"));
    expect(ovenUnit).toBeDefined();
    expect(ovenUnit?.isManufacturablePanel).toBe(false);
    const ovenTowerDoor = ovenTowerGeo.components.find((c) => c.role === "door_left")!;
    expect(ovenTowerDoor.position.y).toBeGreaterThan(1000);

    // 8. Max 60cm (600mm) hinged door leaf width across all 92 V4 templates & default initial project
    for (const tpl of V4_MODULE_TEMPLATES) {
      const m = tpl.createInstance(`max60_${tpl.templateId}`);
      const fs = calculateFourSpaceDimensions(m);
      m.bays.forEach((b, bIdx) => {
        const dSys = b.door.doorSystemId || "hinged_single";
        if (dSys.startsWith("hinged_") || dSys === "folding_side") {
          expect(fs.doorLeaves[bIdx].leafWidthMm).toBeLessThanOrEqual(600);
        }
      });
    }

    // 9. External drawers on 3-door master wardrobe align in Z and X with doors, cover bottom panel, and have a fixed shelf above
    const initMod = createInitialProject().modules[0];
    const initGeo = generateModuleGeometry(initMod);
    const bay0Door = initGeo.components.find((c) => c.role === "door_left" && c.bayIndex === 0)!;
    const bay1LeftDoor = initGeo.components.find((c) => c.role === "door_left" && c.bayIndex === 1)!;
    const bay1Drawers = initGeo.components.filter((c) => c.role === "drawer_front" && c.bayIndex === 1);
    expect(bay1Drawers[0].position.z).toBe(bay1LeftDoor.position.z);
    expect(bay1Drawers[0].position.x).toBe(bay1LeftDoor.position.x);
    expect(bay1Drawers[0].position.y).toBe(bay0Door.position.y);
    const bay1Shelves = initGeo.components.filter((c) => c.role === "shelf" && c.bayIndex === 1);
    expect(bay1Shelves.some((s) => Math.abs(s.position.y - (80 + 18 + 365)) <= 10)).toBe(true);

    // 10. Adjacent doors on shared intermediate divider do not intersect when opened (doorOpenAngleDeg = 90)
    const wd4OpenGeo = generateModuleGeometry(wd4Mod, { doorOpenAngleDeg: 90 });
    const bay0RightOpen = wd4OpenGeo.components.find(
      (c) => c.role === "door_right" && c.bayIndex === 0
    )!;
    const bay1LeftOpen = wd4OpenGeo.components.find(
      (c) => c.role === "door_left" && c.bayIndex === 1
    )!;
    const b0Bounds = componentBounds(bay0RightOpen);
    const b1Bounds = componentBounds(bay1LeftOpen);
    expect(b0Bounds.max.x).toBeLessThan(b1Bounds.min.x);

    // 11. Drawer box sides/bottom/back/slides start strictly behind drawer front (klapa) on all 92 templates including tpl_wd_12_mixed_organizer
    for (const tpl of V4_MODULE_TEMPLATES) {
      const m = tpl.createInstance(`drw_box_check_${tpl.templateId}`);
      const geo = generateModuleGeometry(m);
      const fronts = geo.components.filter((c) => c.role === "drawer_front");
      for (const front of fronts) {
        const baseDrwId = front.id.replace(/_front$/, "");
        const boxParts = geo.components.filter(
          (c) =>
            c.id.startsWith(`${baseDrwId}_`) &&
            c.role !== "drawer_front" &&
            c.role !== "drawer_handle"
        );
        for (const bp of boxParts) {
          expect(bp.position.z + bp.dimensions.depth).toBeLessThanOrEqual(front.position.z + 0.01);
        }
      }
    }

    // 12. Kitchen base cabinets with a top drawer align top of drawer front flush with cabinet top (height - doorPerimeterGap)
    const topDrawerBaseIds = [
      "tpl_kb_03_single_drawer",
      "tpl_kb_04_two_drawers",
      "tpl_kb_05_three_drawers",
      "tpl_kb_06_four_drawers",
      "tpl_kb_18_cooktop_base",
      "tpl_kb_19_drawer_door_combo",
    ];
    for (const tid of topDrawerBaseIds) {
      const m = V4_MODULE_TEMPLATES.find((t) => t.templateId === tid)!.createInstance(`top_${tid}`);
      const geo = generateModuleGeometry(m);
      const fronts = geo.components.filter((c) => c.role === "drawer_front");
      const highestFront = fronts.reduce((a, b) => (a.position.y > b.position.y ? a : b));
      expect(highestFront.position.y + highestFront.dimensions.height).toBeCloseTo(
        m.dimensions.height - m.carcass.doorPerimeterGap,
        2
      );
    }

    // 13. Cross-module and cross-bay elevation snapping aligns dragged shelves/drawers to adjacent module shelves and drawer tops
    const snapProject = createInitialProject();
    const adjMod = V4_MODULE_TEMPLATES[0].createInstance("adj_linen_mod");
    adjMod.carcass.plinthHeight = snapProject.modules[0].carcass.plinthHeight;
    adjMod.bays[0].shelves[0].elevationY = 645;
    snapProject.modules.push(adjMod);

    const targets = computeElevationSnapTargets(
      snapProject,
      0,
      0,
      snapProject.modules[0].bays[0].shelves[0]?.id ?? "dragged_shelf"
    );
    const expectedDrawerTop =
      snapProject.modules[0].bays[1].drawers[1].elevationY +
      snapProject.modules[0].bays[1].drawers[1].height;
    // Should include adjacent module's shelf at 645mm and Module 1 Bay 2's top drawer top
    expect(targets.some((t) => t.elevationY === 645 && t.sourceModuleIndex === 1)).toBe(true);
    expect(
      targets.some((t) => t.elevationY === expectedDrawerTop && t.kind === "drawer_top")
    ).toBe(true);

    // Dragging near 645mm (e.g. 634mm) snaps magnetically to 645mm
    const snappedToAdjShelf = resolveElevationSnap(634, targets, 18);
    expect(snappedToAdjShelf.elevationY).toBe(645);
    expect(snappedToAdjShelf.snappedTarget?.sourceModuleIndex).toBe(1);

    const firstDrawerTop =
      snapProject.modules[0].bays[1].drawers[0].elevationY +
      snapProject.modules[0].bays[1].drawers[0].height;
    // Dragging near first drawer top snaps magnetically to drawer_top
    const snappedToDrawerTop = resolveElevationSnap(firstDrawerTop - 11, targets, 18);
    expect(snappedToDrawerTop.elevationY).toBe(firstDrawerTop);
    expect(snappedToDrawerTop.snappedTarget?.kind).toBe("drawer_top");

    // 14. Wardrobe side panels (carcass_side_left, carcass_side_right) extend down to the floor (y = 0, height = H) and plinth fits between them
    for (const tpl of WARDROBE_TEMPLATES) {
      const wMod = tpl.createInstance(`wd_side_floor_${tpl.templateId}`);
      const wGeo = generateModuleGeometry(wMod);
      const leftSide = wGeo.components.find((c) => c.role === "carcass_side_left")!;
      const rightSide = wGeo.components.find((c) => c.role === "carcass_side_right")!;
      const plinth = wGeo.components.find((c) => c.role === "plinth");
      expect(leftSide.position.y).toBe(0);
      expect(leftSide.dimensions.height).toBe(wMod.dimensions.height);
      expect(rightSide.position.y).toBe(0);
      expect(rightSide.dimensions.height).toBe(wMod.dimensions.height);
      if (plinth) {
        expect(plinth.position.x).toBe(wMod.carcass.panelThickness);
        expect(plinth.dimensions.width).toBe(
          wMod.dimensions.width - 2 * wMod.carcass.panelThickness
        );
      }
    }
  });
});

