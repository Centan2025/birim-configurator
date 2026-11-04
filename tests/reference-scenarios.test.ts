import { describe, it, expect } from "vitest";
import { DesignProject, ModuleInstance, createDefaultWardrobeModule } from "@birim/core";
import { generateModuleGeometry, generateElevation2D, generateTopPlan2D } from "@birim/geometry";
import { generateBOMForProject } from "@birim/manufacturing";
import { calculateProjectPrice } from "@birim/pricing";
import { WARDROBE_TEMPLATES, KITCHEN_TEMPLATES, createKitchenLinearProject } from "@birim/catalog";

function verifyFullPipeline(project: DesignProject) {
  // 1. Parametric Geometry
  project.modules.forEach((mod) => {
    const geo = generateModuleGeometry(mod);
    expect(geo.components.length).toBeGreaterThan(4);
    // 2. 2D Views
    const elev = generateElevation2D(geo);
    expect(elev.elements.length).toBeGreaterThan(0);
    const plan = generateTopPlan2D(geo);
    expect(plan.elements.length).toBeGreaterThan(0);
  });

  // 3. BOM & Nesting
  const bom = generateBOMForProject(project);
  expect(bom.cutList.length).toBeGreaterThan(0);
  expect(bom.summary.totalPanelAreaM2).toBeGreaterThan(0);
  expect(bom.hardwareList.length).toBeGreaterThan(0);

  // 4. Pricing
  const price = calculateProjectPrice(bom);
  expect(price.subtotalNetEur).toBeGreaterThan(0);
  expect(price.totalWithVatEur).toBeGreaterThan(price.subtotalNetEur);
  expect(price.totalWithVatTry).toBeGreaterThan(price.totalWithVatEur);

  return { bom, price };
}

describe("8 Reference Design Scenarios (Design -> 2D -> 3D -> BOM -> Price)", () => {
  // Scenario 1: 2-Door Standard Wardrobe
  it("Scenario 1: 2-door standard wardrobe pipeline", () => {
    const tpl = WARDROBE_TEMPLATES[0];
    const mod = tpl.createInstance("sc1_mod");
    const proj: DesignProject = {
      id: "sc1_proj",
      version: 1,
      title: "2-Kapak Standart Dolap",
      branchId: "branch_main",
      status: "draft",
      space: { id: "sp1", name: "Oda", type: "room", walls: [], ceilingHeight: 2600, elements: [] },
      modules: [mod],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { bom, price } = verifyFullPipeline(proj);
    expect(bom.summary.totalPiecesCount).toBeGreaterThanOrEqual(6);
    expect(price.totalWithVatEur).toBeGreaterThan(400);
  });

  // Scenario 2: 4-Bay Wardrobe
  it("Scenario 2: 4-bay wardrobe pipeline", () => {
    const mod = createDefaultWardrobeModule("sc2_mod");
    mod.dimensions.width = 3200;
    // Add 4 bays
    mod.bays = [
      {
        index: 0,
        door: { id: "d0", bayIndex: 0, type: "single_left", softClose: true },
        shelves: [{ id: "s0", bayIndex: 0, elevationY: 1800, isAdjustable: false }],
        hangingRails: [{ id: "r0", bayIndex: 0, elevationY: 1730 }],
        drawers: [],
        specialFittings: [],
      },
      {
        index: 1,
        door: { id: "d1", bayIndex: 1, type: "single_left", softClose: true },
        shelves: [{ id: "s1", bayIndex: 1, elevationY: 1800, isAdjustable: false }],
        hangingRails: [{ id: "r1", bayIndex: 1, elevationY: 1730 }],
        drawers: [],
        specialFittings: [],
      },
      {
        index: 2,
        door: { id: "d2", bayIndex: 2, type: "single_right", softClose: true },
        shelves: [{ id: "s2", bayIndex: 2, elevationY: 1800, isAdjustable: false }],
        hangingRails: [{ id: "r2", bayIndex: 2, elevationY: 1730 }],
        drawers: [],
        specialFittings: [],
      },
      {
        index: 3,
        door: { id: "d3", bayIndex: 3, type: "single_right", softClose: true },
        shelves: [{ id: "s3", bayIndex: 3, elevationY: 1800, isAdjustable: false }],
        hangingRails: [{ id: "r3", bayIndex: 3, elevationY: 1730 }],
        drawers: [],
        specialFittings: [],
      },
    ];

    const proj: DesignProject = {
      id: "sc2_proj",
      version: 1,
      title: "4 Bölmeli Gardırop",
      branchId: "branch_main",
      status: "draft",
      space: { id: "sp2", name: "Oda", type: "room", walls: [], ceilingHeight: 2600, elements: [] },
      modules: [mod],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { bom, price } = verifyFullPipeline(proj);
    expect(bom.summary.totalPiecesCount).toBeGreaterThanOrEqual(14);
    expect(price.totalWithVatEur).toBeGreaterThan(1200);
  });

  // Scenario 3: Drawers Cabinet
  it("Scenario 3: Drawers cabinet pipeline", () => {
    const tpl = KITCHEN_TEMPLATES.find((t) => t.templateId === "tpl_kitchen_base_drawers")!;
    const mod = tpl.createInstance("sc3_mod");
    const proj: DesignProject = {
      id: "sc3_proj",
      version: 1,
      title: "Çekmeceli Alt Dolap",
      branchId: "branch_main",
      status: "draft",
      space: { id: "sp3", name: "Mutfak", type: "room", walls: [], ceilingHeight: 2600, elements: [] },
      modules: [mod],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { bom, price } = verifyFullPipeline(proj);
    const drawerFronts = bom.cutList.filter((p) => p.componentRole === "drawer_front");
    expect(drawerFronts.length).toBe(3);
    expect(price.totalWithVatEur).toBeGreaterThan(300);
  });

  // Scenario 4: Corner Cabinet (Köşe Dolap)
  it("Scenario 4: Corner wardrobe cabinet pipeline", () => {
    const mod: ModuleInstance = {
      id: "sc4_mod",
      name: "Köşe Gardırop Modülü",
      category: "wardrobe_corner",
      isCorner: true,
      cornerAngleDeg: 90,
      position: { x: 0, y: 0, z: 0 },
      dimensions: { width: 950, height: 2200, depth: 950 },
      carcass: {
        panelThickness: 18,
        backPanelThickness: 8,
        backPanelType: "grooved",
        plinthHeight: 80,
        doorPerimeterGap: 2,
        edgeBandThickness: 1,
        bodyMaterialId: "mat_melamine_white",
        doorMaterialId: "mat_lacquer_cream",
        jointType: "minifix_dowel",
      },
      bays: [
        {
          index: 0,
          door: { id: "sc4_door", bayIndex: 0, type: "single_left", softClose: true },
          shelves: [{ id: "sc4_sh1", bayIndex: 0, elevationY: 1800, isAdjustable: false }],
          hangingRails: [{ id: "sc4_rail", bayIndex: 0, elevationY: 1730 }],
          drawers: [],
          specialFittings: [],
        },
      ],
    };

    const proj: DesignProject = {
      id: "sc4_proj",
      version: 1,
      title: "Köşe Dolap",
      branchId: "branch_main",
      status: "draft",
      space: { id: "sp4", name: "Köşe", type: "room", walls: [], ceilingHeight: 2600, elements: [] },
      modules: [mod],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { bom, price } = verifyFullPipeline(proj);
    expect(bom.cutList.length).toBeGreaterThan(4);
    expect(price.totalWithVatEur).toBeGreaterThan(350);
  });

  // Scenario 5: Sliding Door Wardrobe
  it("Scenario 5: Sliding door wardrobe pipeline", () => {
    const mod = createDefaultWardrobeModule("sc5_mod");
    mod.bays[0].door.type = "sliding";
    mod.bays[1].door.type = "sliding";

    const proj: DesignProject = {
      id: "sc5_proj",
      version: 1,
      title: "Sürgülü Gardırop",
      branchId: "branch_main",
      status: "draft",
      space: { id: "sp5", name: "Oda", type: "room", walls: [], ceilingHeight: 2600, elements: [] },
      modules: [mod],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { bom, price } = verifyFullPipeline(proj);
    expect(bom.cutList.length).toBeGreaterThan(6);
    expect(price.totalWithVatEur).toBeGreaterThan(600);
  });

  // Scenario 6: Straight Kitchen
  it("Scenario 6: Straight kitchen pipeline", () => {
    const kitchenProj = createKitchenLinearProject();
    const { bom, price } = verifyFullPipeline(kitchenProj);

    expect(kitchenProj.modules.length).toBe(6);
    expect(bom.summary.totalPiecesCount).toBeGreaterThan(20);
    expect(price.totalWithVatEur).toBeGreaterThan(1500);
  });

  // Scenario 7: L-Shape Kitchen
  it("Scenario 7: L-Shape kitchen pipeline", () => {
    const baseSink = KITCHEN_TEMPLATES.find((t) => t.templateId === "tpl_kitchen_base_sink")!.createInstance("l_sink", "Evye Dolabı 800");
    baseSink.position = { x: 0, y: 0, z: 0 };

    const baseDrawers = KITCHEN_TEMPLATES.find((t) => t.templateId === "tpl_kitchen_base_drawers")!.createInstance("l_drawers", "Çekmeceli Alt Dolap 800");
    baseDrawers.position = { x: 800, y: 0, z: 0 };

    // Perpendicular arm
    const baseArm = KITCHEN_TEMPLATES.find((t) => t.templateId === "tpl_kitchen_base_standard")!.createInstance("l_arm", "L Kol Dolabı 600");
    baseArm.position = { x: 0, y: 0, z: 600 };

    const proj: DesignProject = {
      id: "sc7_l_kitchen",
      version: 1,
      title: "L Mutfak Yerleşimi",
      branchId: "branch_main",
      status: "draft",
      space: { id: "sp7", name: "L Mutfak", type: "kitchen_l", walls: [], ceilingHeight: 2600, elements: [] },
      modules: [baseSink, baseDrawers, baseArm],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { bom, price } = verifyFullPipeline(proj);
    expect(bom.cutList.length).toBeGreaterThan(10);
    expect(price.totalWithVatEur).toBeGreaterThan(800);
  });

  // Scenario 8: U-Shape Kitchen
  it("Scenario 8: U-Shape kitchen pipeline", () => {
    const baseSink = KITCHEN_TEMPLATES.find((t) => t.templateId === "tpl_kitchen_base_sink")!.createInstance("u_sink", "Evye Dolabı 800");
    baseSink.position = { x: 600, y: 0, z: 0 };

    const armLeft = KITCHEN_TEMPLATES.find((t) => t.templateId === "tpl_kitchen_base_standard")!.createInstance("u_arm_left", "Sol Kol Alt Dolap");
    armLeft.position = { x: 0, y: 0, z: 600 };

    const armRight = KITCHEN_TEMPLATES.find((t) => t.templateId === "tpl_kitchen_base_drawers")!.createInstance("u_arm_right", "Sağ Kol Çekmeceli");
    armRight.position = { x: 1400, y: 0, z: 600 };

    const proj: DesignProject = {
      id: "sc8_u_kitchen",
      version: 1,
      title: "U Mutfak Yerleşimi",
      branchId: "branch_main",
      status: "draft",
      space: { id: "sp8", name: "U Mutfak", type: "kitchen_u", walls: [], ceilingHeight: 2600, elements: [] },
      modules: [baseSink, armLeft, armRight],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { bom, price } = verifyFullPipeline(proj);
    expect(bom.cutList.length).toBeGreaterThan(12);
    expect(price.totalWithVatEur).toBeGreaterThan(1000);
  });
});
