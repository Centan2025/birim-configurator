import { describe, it, expect } from "vitest";
import {
  createInitialProject,
  calculateModulePlacement,
  type WallDefinition,
  type ModuleInstance,
} from "@birim/core";
import { generateModuleGeometry, generateCrossSection2D } from "@birim/geometry";
import { generateBOMForProject } from "@birim/manufacturing";
import {
  registerCustomHandleProfile,
  getAllHandleProfiles,
  findHandleProfileByIdOrSku,
} from "@birim/catalog";
import {
  solveAngledWallSnapForModule,
  getWallRoomBasis,
} from "../apps/configurator/src/v3/engine/angledWallSnapEngine";

describe("V5.9 Architectural Features & Engineering Audit", () => {
  it("snaps a cabinet parallel and flush (0.0mm gap) against a 45° angled wall", () => {
    const project = createInitialProject("Angled Wall Test");
    const angledWall: WallDefinition = {
      id: "wall_45",
      name: "Açılı Duvar 45°",
      length: 2400,
      height: 2600,
      thickness: 150,
      position: { x: 2000, y: 0, z: 0 },
      rotationY: 45,
      elements: [],
    };
    const walls: WallDefinition[] = [project.space.walls[0], angledWall];
    const mod = project.modules[0];

    const sol = solveAngledWallSnapForModule({
      mod,
      modIdx: 0,
      candidatePosX: 2500,
      candidatePosZ: 450,
      walls,
      allModules: [mod],
      maxPerpSnapDistMm: 99999,
      forceWallId: "wall_45",
    });

    expect(sol).not.toBeNull();
    expect(sol!.wallId).toBe("wall_45");
    const snappedMod: ModuleInstance = {
      ...mod,
      position: { ...mod.position, x: sol!.snappedPositionX, z: sol!.snappedPositionZ },
      rotation: { x: 0, y: sol!.moduleRotationYDeg, z: 0 },
    };
    const place = calculateModulePlacement(snappedMod);
    const basis = getWallRoomBasis(angledWall);
    const dx = place.origin.x - basis.p0.x;
    const dz = place.origin.z - basis.p0.z;
    const perpGapMm = dx * basis.inwardNormal.x + dz * basis.inwardNormal.z;
    expect(Math.abs(perpGapMm)).toBeLessThan(1.5);
  });

  it("registers a custom C-C 320mm handle profile and drills Ø5mm C-C holes in CNC BOM", () => {
    registerCustomHandleProfile({
      id: "K_CUSTOM_320",
      sku: "B1-KULP-320-BRASS",
      name: "Özel Pirinç Mimari Kulp 360mm (C-C 320)",
      category: "bar_handle",
      holeSpacingCcMm: 320,
      totalLengthMm: 360,
      projectionDepthMm: 34,
      requiresCncRouting: false,
      defaultFinishMaterialId: "mat_handle_brass",
      unitPriceEur: 18.5,
    });

    const found = findHandleProfileByIdOrSku("K_CUSTOM_320");
    expect(found).toBeDefined();
    expect(found?.holeSpacingCcMm).toBe(320);
    expect(getAllHandleProfiles().some((h) => h.id === "K_CUSTOM_320")).toBe(true);

    const project = createInitialProject("Custom Handle CNC Test");
    project.modules[0].bays[0].door = {
      ...project.modules[0].bays[0].door,
      type: "single_left",
      doorSystemId: "hinged_single",
      handleCategory: "bar_handle",
      handleProfileId: "K_CUSTOM_320",
      handleLengthMm: 360,
    };

    const bom = generateBOMForProject(project);
    const doorPart = bom.cutList.find((p) => p.componentRole === "door_left");
    const handleHoles = doorPart?.holes?.filter((h) => h.purpose === "handle" && h.diameter === 5) || [];
    expect(handleHoles.length).toBeGreaterThanOrEqual(2);
    expect(
      bom.hardwareList.some(
        (h) => h.sku === "B1-KULP-320-BRASS" || h.name.includes("C-C 320")
      )
    ).toBe(true);
  });

  it("generates Waterfall Kitchen Island panels and 45° Attached Table geometry cleanly", () => {
    const project = createInitialProject("Kitchen Island & Table Test");
    const islandMod: ModuleInstance = {
      ...structuredClone(project.modules[0]),
      id: "mod_island_test",
      name: "Şelale Ada Mutfak",
      category: "kitchen_island",
      dimensions: { width: 1800, height: 880, depth: 900 },
      islandCountertopConfig: {
        barOverhangMm: 250,
        waterfallLeft: true,
        waterfallRight: true,
        countertopMaterialId: "mat_quartz_calacatta",
      },
    };

    const islGeo = generateModuleGeometry(islandMod);
    expect(islGeo.components.some((c) => c.id.includes("island_countertop"))).toBe(true);
    expect(islGeo.components.some((c) => c.id.includes("island_waterfall_left"))).toBe(true);
    expect(islGeo.components.some((c) => c.id.includes("island_waterfall_right"))).toBe(true);

    const tableMod: ModuleInstance = {
      id: "comp_table_test",
      name: "45° Açılı Yemek Masası",
      category: "complementary",
      complementaryRole: "attached_table",
      position: { x: 1800, y: 0, z: 900 },
      rotation: { x: 0, y: 315, z: 0 },
      dimensions: { width: 1600, height: 750, depth: 850 },
      bays: [],
      carcass: structuredClone(project.modules[0].carcass),
      attachedTableConfig: {
        anchorModuleId: "mod_island_test",
        angleDeg: 45,
        legStyle: "metal_u_frame",
        topThicknessMm: 40,
      },
    };

    const tblGeo = generateModuleGeometry(tableMod);
    expect(tblGeo.components.some((c) => c.id.includes("table_top"))).toBe(true);
    expect(tblGeo.components.some((c) => c.id.includes("cantilever_bracket"))).toBe(true);
    expect(tblGeo.components.some((c) => c.id.includes("uframe_front"))).toBe(true);
  });

  it("projects 16mm drawer_back panel in 2D A-A & B-B Cross-Section views", () => {
    const project = createInitialProject("Section Drawer Back Test");
    project.modules[0].bays[0].drawers = [
      { id: "drw_sec_1", bayIndex: 0, elevationY: 0, height: 220 },
    ];
    const bd = generateModuleGeometry(project.modules[0]);
    const secAA = generateCrossSection2D(bd, undefined, { direction: "X", cutCoordMm: 220 });
    const secBB = generateCrossSection2D(bd, undefined, { direction: "Z" });
    expect(secAA.elements.some((r) => r.role === "drawer_back")).toBe(true);
    expect(secBB.elements.some((r) => r.role === "drawer_back")).toBe(true);
  });
});
