import { describe, expect, it } from "vitest";
import {
  autoFixModuleIssues,
  createDefaultWardrobeModule,
  createInitialProject,
  evaluateProjectCompatibility,
  evaluateUnifiedEngineeringModel,
  validateProject,
} from "@birim/core";
import { generateModuleGeometry } from "@birim/geometry";
import {
  buildGuidedWizardProject,
  type GuidedWizardLayoutInput,
} from "../apps/configurator/src/v3/adapter/guidedWizardBuilder";

function has3DAABBOverlap(
  aPos: { x: number; y: number; z: number },
  aDim: { width: number; height: number; depth: number },
  bPos: { x: number; y: number; z: number },
  bDim: { width: number; height: number; depth: number },
  epsMm = 0.5
): boolean {
  const ox =
    Math.min(aPos.x + aDim.width, bPos.x + bDim.width) - Math.max(aPos.x, bPos.x);
  const oy =
    Math.min(aPos.y + aDim.height, bPos.y + bDim.height) - Math.max(aPos.y, bPos.y);
  const oz =
    Math.min(aPos.z + aDim.depth, bPos.z + bDim.depth) - Math.max(aPos.z, bPos.z);
  return ox > epsMm && oy > epsMm && oz > epsMm;
}

function assertNoDrawerPiercesAnyDoor(
  mod: ReturnType<typeof createInitialProject>["modules"][number],
  doorOpenAngleDeg: number,
  drawerOpenMm: number
) {
  const geom = generateModuleGeometry(mod, { doorOpenAngleDeg, drawerOpenMm });
  const doors = geom.components.filter(
    (c) => c.role === "door_left" || c.role === "door_right"
  );
  const drawerParts = geom.components.filter(
    (c) => c.role.startsWith("drawer_") && !c.id.includes("_plinth_")
  );
  for (const dp of drawerParts) {
    for (const dr of doors) {
      expect(
        has3DAABBOverlap(dp.position, dp.dimensions, dr.position, dr.dimensions),
        `Drawer part ${dp.id} overlaps door ${dr.id} at doorOpen=${doorOpenAngleDeg}, drawerOpen=${drawerOpenMm}`
      ).toBe(false);
    }
  }
  return { geom, doors, drawerParts };
}

function assertProjectPassesAllGates(proj: ReturnType<typeof createInitialProject>) {
  const valIssues = validateProject(proj).filter((i) => i.severity === "error");
  expect(valIssues).toEqual([]);

  const compat = evaluateProjectCompatibility(proj);
  const blockingCompat = compat.issues.filter((i) => i.blockingProduction);
  expect(blockingCompat).toEqual([]);

  const unified = evaluateUnifiedEngineeringModel(proj);
  expect(unified.blockingSafetyAndEngineeringErrors).toEqual([]);
  expect(unified.canExportToCncAndSaw).toBe(true);
}

const BASE_WIZARD_INPUT: GuidedWizardLayoutInput = {
  spaceCategory: "wardrobe",
  roomShape: "rectangular",
  wallWidthMm: 2400,
  targetHeightMm: 2400,
  targetDepthMm: 600,
  autoFiller50Mm: true,
  interiorFocus: "balanced",
  doorStyle: "sliding",
  conceptTier: "smart",
  colorSwatchId: "mat_veneer_oak",
  addLed: true,
  addTrouserRack: false,
  addJewelryTray: false,
};

describe("V9.1 — Guided Wizard Sliding Wardrobe Engineering & 3D Anti-Piercing", () => {
  it("1. 240x240x60 Sürgülü + Dengeli sihirbaz yerleşimi 0 hata üretir ve iç çekmeceleri güvenli orta bölmeye koyar", () => {
    const baseProj = createInitialProject();
    const proj = buildGuidedWizardProject(baseProj, BASE_WIZARD_INPUT);

    expect(proj.modules.length).toBe(1);
    const mod = proj.modules[0];
    expect(mod.dimensions).toEqual({ width: 2300, height: 2400, depth: 600 });
    expect(mod.bays.length).toBe(3);

    // Center bay (index 1) holds internal drawers; outer bays (0, 2) have hanging rails
    expect(mod.bays[0].drawers.length).toBe(0);
    expect(mod.bays[0].hangingRails.length).toBeGreaterThan(0);
    expect(mod.bays[1].drawers.length).toBe(2);
    expect(mod.bays[1].drawers.every((d) => d.isInternal === true)).toBe(true);
    expect(mod.bays[1].shelves.every((s) => typeof s.thickness === "number")).toBe(true);
    expect(mod.bays[2].drawers.length).toBe(0);
    expect(mod.bays[2].hangingRails.length).toBeGreaterThan(0);

    assertProjectPassesAllGates(proj);
  });

  it("2. 3B kinematik kilit: kapak kapalı veya çekmece bölmesini kapatırken çekmeceler kapağı delmez; yalnızca kapak çekilince açılır", () => {
    const proj = buildGuidedWizardProject(createInitialProject(), BASE_WIZARD_INPUT);
    const mod = proj.modules[0];

    // Closed doors, closed drawers
    const closed = assertNoDrawerPiercesAnyDoor(mod, 0, 0);
    const minDoorZ = Math.min(...closed.doors.map((d) => d.position.z));
    const closedFronts = closed.drawerParts.filter((c) => c.role === "drawer_front");
    expect(closedFronts.length).toBe(2);
    closedFronts.forEach((f) => {
      expect(f.position.z + f.dimensions.depth).toBeLessThanOrEqual(minDoorZ);
    });

    // Closed doors + drawerOpenMm = 300 -> must stay retracted (pulledZ = 0), zero door piercing!
    const blockedClosed = assertNoDrawerPiercesAnyDoor(mod, 0, 300);
    const blockedClosedFronts = blockedClosed.drawerParts.filter(
      (c) => c.role === "drawer_front"
    );
    expect(blockedClosedFronts[0].position.z).toBe(closedFronts[0].position.z);

    // Partially sliding door (35 deg) still overlapping center bay -> must stay retracted
    const midSlide = assertNoDrawerPiercesAnyDoor(mod, 35, 300);
    const midSlideFronts = midSlide.drawerParts.filter((c) => c.role === "drawer_front");
    expect(midSlideFronts[0].position.z).toBe(closedFronts[0].position.z);

    // Fully open sliding door (82 deg -> Center leaf slid onto Bay 0) -> Center drawers pull forward cleanly!
    const openState = assertNoDrawerPiercesAnyDoor(mod, 82, 300);
    const openFronts = openState.drawerParts.filter((c) => c.role === "drawer_front");
    expect(openFronts[0].position.z).toBeGreaterThan(mod.dimensions.depth);
  });

  it("3. 2 bölmeli (180cm), çoklu (320cm), Pantolonluk ekli ve L/U-Tipi sürgülü sihirbaz kurulumları hatasız geçer", () => {
    const baseProj = createInitialProject();

    // 180cm -> 2-bay sliding
    const p180 = buildGuidedWizardProject(baseProj, {
      ...BASE_WIZARD_INPUT,
      wallWidthMm: 1800,
    });
    expect(p180.modules.length).toBe(1);
    expect(p180.modules[0].bays.length).toBe(2);
    assertProjectPassesAllGates(p180);
    assertNoDrawerPiercesAnyDoor(p180.modules[0], 0, 300);
    const p180Open = assertNoDrawerPiercesAnyDoor(p180.modules[0], 82, 300);
    expect(
      p180Open.drawerParts.find((c) => c.role === "drawer_front")!.position.z
    ).toBeGreaterThan(p180.modules[0].dimensions.depth);

    // 320cm -> multi-module sliding
    const p320 = buildGuidedWizardProject(baseProj, {
      ...BASE_WIZARD_INPUT,
      wallWidthMm: 3200,
    });
    expect(p320.modules.length).toBe(2);
    assertProjectPassesAllGates(p320);

    // + Pantolonluk Ekle on 240cm balanced sliding
    const pTrouser = buildGuidedWizardProject(baseProj, {
      ...BASE_WIZARD_INPUT,
      addTrouserRack: true,
    });
    const trouserInCenter = pTrouser.modules[0].bays[1].specialFittings?.some(
      (f) => f.type === "trouser_rack"
    );
    expect(trouserInCenter).toBe(true);
    assertProjectPassesAllGates(pTrouser);

    // L-Shape & U-Shape with sliding doors
    const pL = buildGuidedWizardProject(baseProj, {
      ...BASE_WIZARD_INPUT,
      roomShape: "l_shape",
    });
    expect(pL.modules.length).toBe(2);
    assertProjectPassesAllGates(pL);

    const pU = buildGuidedWizardProject(baseProj, {
      ...BASE_WIZARD_INPUT,
      roomShape: "u_shape",
    });
    expect(pU.modules.length).toBe(3);
    assertProjectPassesAllGates(pU);
  });

  it("4. autoFixModuleIssues: eşit bölmeli ve dış çekmeceli bozuk 3 kapaklı sürgü dolabı onarır", () => {
    const broken = createDefaultWardrobeModule("broken_slide_3");
    broken.dimensions = { width: 2300, height: 2400, depth: 600 };
    broken.bays = [
      { ...broken.bays[0], index: 0, customWidth: undefined, drawers: [] },
      {
        ...broken.bays[0],
        index: 1,
        customWidth: undefined,
        drawers: [
          {
            id: "d_bad_1",
            bayIndex: 1,
            elevationY: 0,
            height: 180,
            slideType: "soft_close",
            isInternal: false,
          },
        ],
      },
      { ...broken.bays[0], index: 2, customWidth: undefined, drawers: [] },
    ];
    broken.bays.forEach((b) => {
      b.door.type = "sliding";
      b.door.doorSystemId = "sliding_top_hung";
    });

    const brokenProj = { ...createInitialProject(), modules: [broken] };
    const beforeIssues = validateProject(brokenProj).map((i) => i.code);
    expect(beforeIssues).toContain("ERR_SLIDING_DOOR_REQUIRES_INTERNAL_DRAWER");
    expect(beforeIssues).toContain("ERR_SLIDING_DEAD_ZONE_DRAWER_CLASH");

    const { updatedModule } = autoFixModuleIssues(broken);
    const fixedProj = { ...createInitialProject(), modules: [updatedModule] };
    const afterCodes = validateProject(fixedProj)
      .filter((i) => i.severity === "error")
      .map((i) => i.code);
    expect(afterCodes).not.toContain("ERR_SLIDING_DOOR_REQUIRES_INTERNAL_DRAWER");
    expect(afterCodes).not.toContain("ERR_SLIDING_DEAD_ZONE_DRAWER_CLASH");
    expect(afterCodes).toEqual([]);
  });
});
