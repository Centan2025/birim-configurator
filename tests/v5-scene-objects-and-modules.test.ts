import { describe, expect, it } from "vitest";
import {
  autoNotchModulesAroundObstacles,
  computeAutoFillersAndTrimForProject,
  calculateModulePlacement,
  createInitialProject,
  evaluateKitchenWorkTriangleAndErgonomics,
  findWallFreeGaps,
  parseAndMigrateProject,
  parseRoomPlanScanJson,
  registerRuntimeMaterial,
} from "@birim/core";
import {
  createSceneObjectInstanceFromCatalog,
  getV4TemplateById,
  V5_COMPOSITE_ASSEMBLIES,
  V5_SCENE_OBJECT_CATALOG,
} from "@birim/catalog";
import {
  convertSceneObjectsToExportBoxes,
  exportPartsToUSDZ,
  generateModuleGeometry,
  generateTopPlan2D,
} from "@birim/geometry";
import {
  computeCurvedKerfBendingSpec,
  computeProjectCartonization,
  computeProjectMepUtilityPoints,
  generateBOMForProject,
  generateScmXcsProgram,
} from "@birim/manufacturing";
import { calculateProjectPrice } from "@birim/pricing";
import { getBirimV5SupabaseMigrationSql } from "@birim/integrations";
import * as THREE from "three";
import {
  createSafeWebGL2Renderer,
  disposeWebGLRendererCleanly,
  isSharedWebGLResource,
  markSharedGeometry,
  markSharedMaterial,
  probeWebGL2Support,
} from "../apps/configurator/src/v3/materials/webglResourceGuard";

describe("Birim Configurator V5 — Modül Ekleme, 3D Sahne Objeleri & Endüstriyel Tamamlamalar", () => {
  it("resolves V5 specialized templates (TV console, bookcase, vanity, laundry tower) via getV4TemplateById", () => {
    const tv = getV4TemplateById("v5_tv_media_console_240");
    expect(tv).toBeDefined();
    const inst = tv!.createInstance("mod_tv_test");
    expect(inst.dimensions.width).toBe(2400);
    expect(inst.carcass.carcassJoineryTopology).toBe("miter_45");
  });

  it("finds free wall gaps, generates auto-fillers/crown panels, and notches obstacles", () => {
    const proj = createInitialProject();
    proj.space.walls[0].length = 1920; // 1800mm wardrobe + 120mm wall-end gap
    proj.space.elements.push({
      id: "col_test",
      type: "column",
      name: "Köşe Kolon",
      position: { x: 0, y: 0, z: 0 },
      dimensions: { width: 200, height: 2600, depth: 200 },
    });

    const gaps = findWallFreeGaps(proj, "base");
    expect(gaps.some((g) => g.widthMm === 120)).toBe(true);

    const autoFill = computeAutoFillersAndTrimForProject(proj);
    expect(autoFill.addedModules.length).toBeGreaterThan(0);

    const notched = autoNotchModulesAroundObstacles(proj);
    expect(notched.appliedNotches.length).toBeGreaterThan(0);
    expect(notched.updatedModules[0].utilityCutouts?.length).toBeGreaterThan(0);
  });

  it("evaluates NKBA work triangle, MEP triggers, BOM drip-tray/heat-shield, and commercial pricing", () => {
    const proj = createInitialProject();
    const fridge = createSceneObjectInstanceFromCatalog("obj_fridge_french_910", {
      position: { x: 0, y: 0, z: 0 },
    })!;
    const sink = createSceneObjectInstanceFromCatalog("obj_sink_undermount_550", {
      position: { x: 1500, y: 900, z: 0 },
    })!;
    const cooktop = createSceneObjectInstanceFromCatalog("obj_cooktop_ind_600", {
      position: { x: 3100, y: 900, z: 0 },
    })!;
    const table = createSceneObjectInstanceFromCatalog("obj_birim_dining_table_1800")!;

    proj.sceneObjects = [fridge, sink, cooktop, table];

    const parsed = parseAndMigrateProject(proj);
    expect(parsed.ok).toBe(true);
    expect(parsed.success).toBe(true);

    const erg = evaluateKitchenWorkTriangleAndErgonomics(proj);
    expect(erg.report.isComplete).toBe(true);
    expect(erg.report.perimeterMm).toBeGreaterThan(3000);

    const mepPts = computeProjectMepUtilityPoints(proj);
    expect(mepPts.some((p) => p.id.includes(sink.id))).toBe(true);

    const bom = generateBOMForProject(proj);
    expect(bom.hardwareList.some((h) => h.sku === "EVYE-KORUMA-SAC")).toBe(true);
    expect(bom.hardwareList.some((h) => h.sku === "OCAK-ISI-KALKAN")).toBe(true);

    const priceBase = calculateProjectPrice(bom);
    const priceWithObjs = calculateProjectPrice(bom, undefined, undefined, proj.sceneObjects);
    expect(priceWithObjs.totalWithVatEur).toBeGreaterThan(priceBase.totalWithVatEur);
    expect((priceWithObjs.commercialObjectsCostEur || 0)).toBeGreaterThan(3000);
  });

  it("exports 64-byte-aligned Apple AR Quick Look .USDZ, SCM .XCS, Cartonization, and parses LiDAR RoomPlan", () => {
    const proj = createInitialProject();
    const preset = V5_COMPOSITE_ASSEMBLIES[0].buildItems(1200);
    proj.modules.push(...preset.modules);
    proj.sceneObjects = preset.sceneObjects;

    const sceneBoxes = convertSceneObjectsToExportBoxes(proj.sceneObjects);
    expect(sceneBoxes.length).toBe(preset.sceneObjects.length);

    const usdz = exportPartsToUSDZ(sceneBoxes, [], "Birim_AR_Test");
    // PK\x03\x04 ZIP magic header
    expect(usdz[0]).toBe(0x50);
    expect(usdz[1]).toBe(0x4b);
    // Verify 64-byte alignment of first file payload (`#usda 1.0` starts at byte 64 or 128)
    const nameLen = usdz[26] | (usdz[27] << 8);
    const extraLen = usdz[28] | (usdz[29] << 8);
    expect((30 + nameLen + extraLen) % 64).toBe(0);

    const bom = generateBOMForProject(proj);
    const cartons = computeProjectCartonization(proj, bom);
    expect(cartons.totalCartons).toBeGreaterThan(0);

    const scm = generateScmXcsProgram({
      id: "P1",
      moduleId: "m1",
      moduleName: "Test",
      partRole: "side_left",
      pieceName: "Sol Dikme",
      thicknessMm: 18,
      lengthMm: 2200,
      widthMm: 600,
      hasBackGroove: true,
      drillingOperations: [{ x: 37, y: 100, diameter: 5, depth: 13, face: "top", type: "shelf" }],
    });
    expect(scm.format).toBe("scm_xcs");
    expect(scm.content).toContain("CreateFinishedWorkpieceBox");

    const lidar = parseRoomPlanScanJson(
      JSON.stringify({
        walls: [{ identifier: "w1", dimensions: [4.2, 2.7, 0.15], transform: [1,0,0,0, 0,1,0,0, 0,0,1,0, 2.1,1.35,0,1] }],
        doors: [{ identifier: "d1", dimensions: [0.9, 2.1, 0.15], transform: [1,0,0,0, 0,1,0,0, 0,0,1,0, 0.6,1.05,0,1] }],
        objects: [{ category: "refrigerator", dimensions: [0.9, 1.8, 0.7], transform: [1,0,0,0, 0,1,0,0, 0,0,1,0, 3.5,0.9,0.35,1] }],
      })
    );
    expect(lidar.walls[0].length).toBe(4200);
    expect(lidar.detectedAppliances.length).toBe(1);
    expect(V5_SCENE_OBJECT_CATALOG.length).toBeGreaterThanOrEqual(24);
    expect(getBirimV5SupabaseMigrationSql()).toContain("CREATE TABLE IF NOT EXISTS public.configurator_projects");
  });

  it("prevents Uncaught WebGLRenderer crashes on WebGL2-unsupported / Direct3D9Ex (GeForce 210) environments", () => {
    const geo = markSharedGeometry(new THREE.BoxGeometry(1, 1, 1));
    const mat = markSharedMaterial(new THREE.MeshBasicMaterial({ color: 0xffffff }));
    expect(isSharedWebGLResource(geo)).toBe(true);
    expect(isSharedWebGLResource(mat)).toBe(true);

    const cap = probeWebGL2Support(true);
    expect(typeof cap.supported).toBe("boolean");

    const res = createSafeWebGL2Renderer({ forceRefreshProbe: true });
    if (!res.ok) {
      expect(res.capability.supported).toBe(false);
      expect(res.capability.tier).toBe("unavailable");
    } else {
      disposeWebGLRendererCleanly(res.bundle.renderer);
    }
    expect(() => disposeWebGLRendererCleanly(null)).not.toThrow();
  });

  it("creates parametric capsule bar cabinet & stadium table with CNC kerf-bending BOM and custom runtime materials", () => {
    const customMat = registerRuntimeMaterial({
      id: "mat_custom_ral7016_test",
      name: "Özel RAL 7016 İpek Mat Lake",
      category: "lacquer",
      thickness: 18,
      colorHex: "#383E42",
      roughness: 0.3,
      metalness: 0.04,
      costPerM2: 82,
      edgeBandCostPerM: 3.8,
      hasGrain: false,
    });
    expect(customMat.id).toBe("mat_custom_ral7016_test");

    const kerf = computeCurvedKerfBendingSpec(240, 180, 18, 3.2, 2.5);
    expect(kerf.unfoldedArcLengthMm).toBeGreaterThan(750);
    expect(kerf.kerfCount).toBeGreaterThan(10);

    const proj = createInitialProject();
    proj.customMaterials = [customMat];
    const capBar = getV4TemplateById("v5_capsule_bar_cabinet_120")!.createInstance("mod_cap_bar");
    capBar.carcass.doorMaterialId = customMat.id;
    const capTable = getV4TemplateById("v5_capsule_dining_table_220")!.createInstance("mod_cap_tbl");
    proj.modules.push(capBar, capTable);

    const migrated = parseAndMigrateProject(proj);
    expect(migrated.ok).toBe(true);

    const bom = generateBOMForProject(proj);
    expect(bom.hardwareList.some((h) => h.sku === "HW_CNC_KERF_BENDING")).toBe(true);
    expect(bom.hardwareList.some((h) => h.sku === "HW_CNC_SWISS_CAPSULE_TOP")).toBe(true);
    expect(bom.cutList.some((c) => c.id.includes("_kerf_curve_"))).toBe(true);
  });

  it("generateTopPlan2D includes tabletops and angled table placement projects forward into +Z room space", () => {
    const tblMod = {
      id: "comp_table_test",
      name: "Açılı Masa (45° • 160×85 cm)",
      category: "complementary" as const,
      complementaryRole: "attached_table" as const,
      position: { x: 1160, y: 0, z: 300 },
      rotation: { x: 0, y: 315, z: 0 }, // +45° plan heading into room (+X, +Z)
      dimensions: { width: 1600, height: 750, depth: 850 },
      bays: [],
      carcass: createInitialProject().modules[0].carcass,
      attachedTableConfig: {
        anchorModuleId: "m1",
        angleDeg: 45,
        legStyle: "pedestal_column" as const,
        topThicknessMm: 40,
      },
    };
    const pl = calculateModulePlacement(tblMod);
    // Far end (lx=1600, lz=425) must project forward (+Z > origin.z) and right (+X > origin.x)
    const farX = pl.origin.x + 1600 * Math.cos(pl.rotationYRad) + 425 * Math.sin(pl.rotationYRad);
    const farZ = pl.origin.z - 1600 * Math.sin(pl.rotationYRad) + 425 * Math.cos(pl.rotationYRad);
    expect(farX).toBeGreaterThan(pl.origin.x + 700);
    expect(farZ).toBeGreaterThan(pl.origin.z + 1000);

    const geo = generateModuleGeometry(tblMod);
    const topPlan = generateTopPlan2D(geo);
    expect(topPlan.elements.some((el) => el.role === "countertop")).toBe(true);
  });
});
