import { describe, it, expect } from "vitest";
import type { ModuleInstance, SceneObjectInstance } from "@birim/core";
import {
  computeResizeWidthSnap,
  applyPostResizeModuleSync,
  isDirectStackedOn,
} from "../apps/configurator/src/v3/engine/cabinetResizeAndStackEngine";

function makeModule(overrides: Partial<ModuleInstance> = {}): ModuleInstance {
  return {
    id: overrides.id ?? "mod_1",
    name: overrides.name ?? "Gardırop",
    category: overrides.category ?? "wardrobe",
    moduleFamilyId: overrides.moduleFamilyId,
    position: overrides.position ?? { x: 0, y: 0, z: 0 },
    rotation: overrides.rotation ?? { x: 0, y: 0, z: 0 },
    dimensions: overrides.dimensions ?? { width: 800, height: 2000, depth: 600 },
    bays: overrides.bays ?? [
      {
        index: 0,
        door: {
          id: "d_0",
          bayIndex: 0,
          type: "double",
          doorSystemId: "hinged_double",
          materialId: "mat_white",
          handleType: "bar_handle",
        } as any,
        shelves: [
          {
            id: "sh_0",
            bayIndex: 0,
            elevationY: 300,
            thickness: 18,
            isAdjustable: true,
          },
        ],
        drawers: [],
        hangingRails: [],
        specialFittings: [],
      } as any,
    ],
    carcass: overrides.carcass ?? ({
      panelThickness: 18,
      plinthHeight: 100,
      backPanelThickness: 8,
      materialId: "mat_white",
    } as any),
  };
}

describe("V97 Cabinet Resize Magnetic Snap & Stacked/Kitchen Sync Engine", () => {
  it("snaps upper cabinet right edge to lower cabinet right edge within 35mm", () => {
    const base = makeModule({
      id: "base_1",
      name: "Alt Gardırop",
      position: { x: 0, y: 0, z: 0 },
      dimensions: { width: 1200, height: 2000, depth: 600 },
    });
    const upper = makeModule({
      id: "upper_1",
      name: "Alt Gardırop (Üst Yüklük)",
      position: { x: 0, y: 2000, z: 0 },
      dimensions: { width: 800, height: 600, depth: 600 },
    });

    const snap = computeResizeWidthSnap({
      modules: [base, upper],
      activeModIdx: 1,
      axis: "width_right",
      rawWidthMm: 1180, // 20mm away from base right edge (1200)
      startX: 0,
      startW: 800,
    });

    expect(snap.width).toBe(1200);
    expect(snap.snappedEdgeX).toBe(1200);
    expect(snap.snapKind).toBe("same_side_align");
    expect(snap.snapBanner).toContain("Alt Gardırop");
  });

  it("snaps upper cabinet left edge to lower cabinet left edge and adjacent module right edge", () => {
    const leftBase = makeModule({
      id: "base_l",
      name: "Sol Modül",
      position: { x: 0, y: 0, z: 0 },
      dimensions: { width: 600, height: 2000, depth: 600 },
    });
    const base = makeModule({
      id: "base_r",
      name: "Ana Modül",
      position: { x: 600, y: 0, z: 0 },
      dimensions: { width: 1000, height: 2000, depth: 600 },
    });
    const upper = makeModule({
      id: "upper_r",
      name: "Üst Yüklük",
      position: { x: 800, y: 2000, z: 0 },
      dimensions: { width: 800, height: 500, depth: 600 },
    });

    const snap = computeResizeWidthSnap({
      modules: [leftBase, base, upper],
      activeModIdx: 2,
      axis: "width_left",
      rawWidthMm: 980, // rawLeft = 1600 - 980 = 620 (20mm from 600)
      startX: 800,
      startW: 800,
    });

    expect(snap.positionX).toBe(600);
    expect(snap.width).toBe(1000);
    expect(snap.snappedEdgeX).toBe(600);
  });

  it("snaps kitchen wall cabinet right edge to kitchen base vertical seam (two 600mm bases = 1200mm)", () => {
    const base1 = makeModule({
      id: "kb_1",
      name: "Mutfak Alt 1",
      category: "kitchen_base",
      position: { x: 0, y: 0, z: 0 },
      dimensions: { width: 600, height: 820, depth: 580 },
    });
    const base2 = makeModule({
      id: "kb_2",
      name: "Mutfak Alt 2",
      category: "kitchen_base",
      position: { x: 600, y: 0, z: 0 },
      dimensions: { width: 600, height: 820, depth: 580 },
    });
    const wall = makeModule({
      id: "kw_1",
      name: "Mutfak Üst",
      category: "kitchen_wall",
      position: { x: 0, y: 1450, z: 0 },
      dimensions: { width: 600, height: 720, depth: 340 },
    });

    expect(isDirectStackedOn(wall, base1)).toBe(false);

    const snap = computeResizeWidthSnap({
      modules: [base1, base2, wall],
      activeModIdx: 2,
      axis: "width_right",
      rawWidthMm: 1220, // 20mm past base2 right edge (1200)
      startX: 0,
      startW: 600,
    });

    expect(snap.width).toBe(1200);
    expect(snap.snapKind).toBe("same_side_align");
    expect(snap.snapBanner).toContain("Dikey Derzine");
  });

  it("tracks stacked upper cabinet Y-elevation and clamps to ceiling when base height changes", () => {
    const oldBase = makeModule({
      id: "base_1",
      position: { x: 0, y: 0, z: 0 },
      dimensions: { width: 800, height: 2000, depth: 600 },
    });
    const upper = makeModule({
      id: "upper_1",
      name: "Üst Yüklük",
      position: { x: 0, y: 2000, z: 0 },
      dimensions: { width: 800, height: 600, depth: 600 },
    });
    const tallerBase = {
      ...oldBase,
      dimensions: { ...oldBase.dimensions, height: 2250 },
    };

    const res = applyPostResizeModuleSync([tallerBase, upper], [], 0, oldBase, 2700);
    expect(res.modules[1].position.y).toBe(2250);
    expect(res.modules[1].dimensions.height).toBe(450); // trimmed to fit 2700 ceiling
    expect(res.notices.length).toBeGreaterThan(0);
  });

  it("syncs aligned stacked upper cabinet width, bays, and depth with base", () => {
    const oldBase = makeModule({
      id: "base_1",
      position: { x: 0, y: 0, z: 0 },
      dimensions: { width: 800, height: 2000, depth: 600 },
    });
    const upper = makeModule({
      id: "upper_1",
      position: { x: 0, y: 2000, z: 0 },
      dimensions: { width: 800, height: 500, depth: 600 },
    });
    const widerBase = makeModule({
      id: "base_1",
      position: { x: 0, y: 0, z: 0 },
      dimensions: { width: 1400, height: 2000, depth: 550 },
      bays: [
        { index: 0, customWidth: 450, door: { id: "d0", bayIndex: 0, type: "single_left" }, shelves: [], drawers: [], hangingRails: [], specialFittings: [] } as any,
        { index: 1, door: { id: "d1", bayIndex: 1, type: "double" }, shelves: [], drawers: [], hangingRails: [], specialFittings: [] } as any,
      ],
    });

    const res = applyPostResizeModuleSync([widerBase, upper], [], 0, oldBase, 2700);
    expect(res.modules[1].dimensions.width).toBe(1400);
    expect(res.modules[1].dimensions.depth).toBe(550);
    expect(res.modules[1].bays.length).toBe(2);
    expect(res.modules[1].bays[0].customWidth).toBe(450);
  });

  it("reflows adjacent kitchen base cabinets on widening and re-centers hosted cooktop", () => {
    const oldBase1 = makeModule({
      id: "kb_1",
      name: "Ocaklı Alt Dolap",
      category: "kitchen_base",
      position: { x: 0, y: 0, z: 0 },
      dimensions: { width: 600, height: 820, depth: 580 },
    });
    const base2 = makeModule({
      id: "kb_2",
      name: "Yan Alt Dolap",
      category: "kitchen_base",
      position: { x: 600, y: 0, z: 0 },
      dimensions: { width: 600, height: 820, depth: 580 },
    });
    const cooktop: SceneObjectInstance = {
      id: "so_cooktop",
      catalogId: "cooktop_induction_60",
      name: "İndüksiyon Ocak",
      visualKind: "cooktop_induction",
      anchorMode: "countertop_cutout",
      hostModuleId: "kb_1",
      position: { x: 0, y: 858, z: 30 },
      dimensions: { width: 600, height: 50, depth: 520 },
    } as any;

    const widerBase1 = {
      ...oldBase1,
      dimensions: { ...oldBase1.dimensions, width: 800 },
    };

    const res = applyPostResizeModuleSync([widerBase1, base2], [cooktop], 0, oldBase1, 2700);
    expect(res.modules[1].position.x).toBe(800); // pushed right by +200mm
    expect(res.sceneObjects[0].position.x).toBe(100); // re-centered inside 800mm cabinet ((800-600)/2 = 100)
  });

  it("lifts floating kitchen wall cabinet to maintain 650mm cooktop clearance when base height increases", () => {
    const oldBase = makeModule({
      id: "kb_1",
      category: "kitchen_base",
      position: { x: 0, y: 0, z: 0 },
      dimensions: { width: 800, height: 820, depth: 580 },
    });
    const wall = makeModule({
      id: "kw_1",
      name: "Davlumbaz Üstü",
      category: "kitchen_wall",
      position: { x: 0, y: 1520, z: 0 },
      dimensions: { width: 800, height: 600, depth: 340 },
    });
    const cooktop: SceneObjectInstance = {
      id: "so_cooktop",
      catalogId: "cooktop_induction_60",
      name: "Ocak",
      visualKind: "cooktop_induction",
      anchorMode: "countertop_cutout",
      hostModuleId: "kb_1",
      position: { x: 100, y: 858, z: 30 },
      dimensions: { width: 600, height: 50, depth: 520 },
    } as any;

    const tallerBase = {
      ...oldBase,
      dimensions: { ...oldBase.dimensions, height: 920 },
    };

    const res = applyPostResizeModuleSync([tallerBase, wall], [cooktop], 0, oldBase, 2700);
    // countertopTopY = 920 + 38 = 958; minClearance = 650 => 1608 => rounded to 10mm = 1610
    expect(res.modules[1].position.y).toBeGreaterThanOrEqual(1600);
    expect(res.notices.some((n) => n.includes("650 mm"))).toBe(true);
  });
});
