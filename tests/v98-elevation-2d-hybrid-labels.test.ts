import { describe, it, expect } from "vitest";
import type { ModuleInstance } from "@birim/core";
import {
  computeElevationHingeAnnotation,
  formatHoveredElevationHud,
} from "../apps/configurator/src/v3/components/workspace/elevation2dHelpers";

function makeTwoBayWardrobe(): ModuleInstance {
  return {
    id: "mod_w1",
    name: "Master Gardırop Modülü",
    category: "wardrobe",
    position: { x: 0, y: 0, z: 0 },
    dimensions: { width: 1670, height: 2200, depth: 600 },
    bays: [
      { index: 0, door: { id: "d0", bayIndex: 0, type: "double" }, shelves: [], drawers: [], hangingRails: [], specialFittings: [] } as any,
      { index: 1, door: { id: "d1", bayIndex: 1, type: "double" }, shelves: [], drawers: [], hangingRails: [], specialFittings: [] } as any,
    ],
    carcass: {
      panelThickness: 18,
      plinthHeight: 80,
      backPanelThickness: 8,
      materialId: "mat_white",
    } as any,
  };
}

describe("V98 2D Elevation 1+3 Hybrid Labels & Global/Local Y Hinge Annotations", () => {
  it("computes identical globalY=2016 for full door and partial door above 378mm shelf, showing local Y in HUD", () => {
    const mod = makeTwoBayWardrobe();
    // Module height 2200, plinth 80 => globalY=2016 sits at moduleBottomY = 2096 => svgY = 2200 - 2096 = 104
    const fullDoorHinge = computeElevationHingeAnnotation({
      el: { id: "h_full", label: "Blum Menteşe #1 (Y:2016mm) B1", x: 20, y: 104 - 32, width: 28, height: 64, bayIndex: 0 },
      activeModule: mod,
      moduleHeightMm: 2200,
    });
    expect(fullDoorHinge.globalY).toBe(2016);
    expect(fullDoorHinge.doorBaseY).toBe(0);
    expect(
      formatHoveredElevationHud({
        id: fullDoorHinge.id,
        kind: "hinge",
        title: "Blum Menteşe",
        globalY: fullDoorHinge.globalY,
        doorLocalY: fullDoorHinge.doorLocalY,
        doorBaseY: fullDoorHinge.doorBaseY,
        svgY: fullDoorHinge.svgY,
      })
    ).toBe("Blum Menteşe | Y:2016");

    const partialDoorHinge = computeElevationHingeAnnotation({
      el: { id: "h_partial", label: "Blum Menteşe #1 (Y:1638mm) B2", x: 1622, y: 104 - 32, width: 28, height: 64, bayIndex: 1 },
      activeModule: mod,
      moduleHeightMm: 2200,
    });
    expect(partialDoorHinge.globalY).toBe(2016);
    expect(partialDoorHinge.doorLocalY).toBe(1638);
    expect(partialDoorHinge.doorBaseY).toBe(378);
    expect(
      formatHoveredElevationHud({
        id: partialDoorHinge.id,
        kind: "hinge",
        title: "Blum Menteşe",
        globalY: partialDoorHinge.globalY,
        doorLocalY: partialDoorHinge.doorLocalY,
        doorBaseY: partialDoorHinge.doorBaseY,
        svgY: partialDoorHinge.svgY,
      })
    ).toBe("Blum Menteşe | Y:2016 (Kapak: 1638)");
  });

  it("opens hinge labels strictly inward for all 4 mountSides", () => {
    const mod = makeTwoBayWardrobe();
    // Bay 0: [18..826], Bay 1: [844..1652]
    const leftWall = computeElevationHingeAnnotation({
      el: { id: "h1", label: "Blum (Y:200mm)", x: 20, y: 1800, width: 28, height: 64, bayIndex: 0 },
      activeModule: mod,
      moduleHeightMm: 2200,
    });
    const divLeft = computeElevationHingeAnnotation({
      el: { id: "h2", label: "Blum (Y:200mm)", x: 790, y: 1800, width: 28, height: 64, bayIndex: 0 },
      activeModule: mod,
      moduleHeightMm: 2200,
    });
    const divRight = computeElevationHingeAnnotation({
      el: { id: "h3", label: "Blum (Y:200mm)", x: 850, y: 1800, width: 28, height: 64, bayIndex: 1 },
      activeModule: mod,
      moduleHeightMm: 2200,
    });
    const rightWall = computeElevationHingeAnnotation({
      el: { id: "h4", label: "Blum (Y:200mm)", x: 1620, y: 1800, width: 28, height: 64, bayIndex: 1 },
      activeModule: mod,
      moduleHeightMm: 2200,
    });

    expect(leftWall.mountSide).toBe("left-wall");
    expect(leftWall.labelAnchor).toBe("start");
    expect(divLeft.mountSide).toBe("divider-left");
    expect(divLeft.labelAnchor).toBe("end");
    expect(divRight.mountSide).toBe("divider-right");
    expect(divRight.labelAnchor).toBe("start");
    expect(rightWall.mountSide).toBe("right-wall");
    expect(rightWall.labelAnchor).toBe("end");
  });

  it("nudges hinge label vertically by ±12px when within 22px of a same-bay shelf", () => {
    const mod = makeTwoBayWardrobe();
    const nudged = computeElevationHingeAnnotation({
      el: { id: "h_col", label: "Blum (Y:500mm)", x: 20, y: 1000 - 32, width: 28, height: 64, bayIndex: 0 },
      activeModule: mod,
      moduleHeightMm: 2200,
      sameBayObstacleSvgYs: [995], // 5 SVG units away (< 22px * 2)
      svgMmPerPx: 2,
    });
    expect(nudged.verticalNudgeSvgY).toBe(24); // +12px * 2
  });
});
