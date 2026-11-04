import { describe, it, expect } from "vitest";
import {
  createDefaultWardrobeModule,
  calculateBayWidths,
  calculateNetInnerHeight,
  calculateNetInnerDepth,
  validateModule,
} from "@birim/core";
import { generateModuleGeometry } from "@birim/geometry";

describe("Parametric Engine & Rules", () => {
  it("calculates accurate bay widths for 2-bay module", () => {
    const mod = createDefaultWardrobeModule();
    mod.dimensions.width = 1800;
    mod.carcass.panelThickness = 18;
    // 2 bays => 2 outer sides (2*18=36) + 1 divider (18) = 54mm total panels
    // Available inner width = 1800 - 54 = 1746mm
    // 1746 / 2 = 873mm per bay
    const widths = calculateBayWidths(mod);
    expect(widths).toHaveLength(2);
    expect(widths[0]).toBe(873);
    expect(widths[1]).toBe(873);
    expect(widths[0] + widths[1] + 3 * 18).toBe(1800);
  });

  it("calculates net inner height and depth correctly", () => {
    const mod = createDefaultWardrobeModule();
    mod.dimensions.height = 2200;
    mod.carcass.plinthHeight = 80;
    mod.carcass.panelThickness = 18;
    // Net Inner Height = 2200 - 80 - 2*18 = 2084mm
    expect(calculateNetInnerHeight(mod)).toBe(2084);

    mod.dimensions.depth = 600;
    // Net Inner Depth = 600 - 20 (groove/clearance) = 580mm
    expect(calculateNetInnerDepth(mod)).toBe(580);
  });

  it("handles custom bay width overrides", () => {
    const mod = createDefaultWardrobeModule();
    mod.dimensions.width = 1800;
    mod.carcass.panelThickness = 18;
    mod.bays[0].customWidth = 600;
    delete mod.bays[1].customWidth;

    const widths = calculateBayWidths(mod);
    expect(widths[0]).toBe(600);
    // Remaining = 1746 - 600 = 1146
    expect(widths[1]).toBe(1146);
    expect(widths[0] + widths[1] + 3 * 18).toBe(1800);
  });

  it("validates boundary errors on invalid dimensions", () => {
    const mod = createDefaultWardrobeModule();
    mod.dimensions.width = 150; // below 300mm min limit
    mod.dimensions.height = 3500; // above 2800mm max limit

    const issues = validateModule(mod);
    const codes = issues.map((i) => i.code);
    expect(codes).toContain("ERR_WIDTH_TOO_SMALL");
    expect(codes).toContain("ERR_HEIGHT_TOO_LARGE");
  });

  it("warns on shelf deflection when bay width exceeds safe span", () => {
    const mod = createDefaultWardrobeModule();
    mod.dimensions.width = 2400;
    // Only 1 single bay spanning 2400mm - 36mm = 2364mm
    mod.bays = [mod.bays[0]];

    const issues = validateModule(mod);
    const codes = issues.map((i) => i.code);
    expect(codes).toContain("WARN_SHELF_SPAN_DEFLECTION");
  });

  it("generates 3D components corresponding strictly to parametric model", () => {
    const mod = createDefaultWardrobeModule();
    const geo = generateModuleGeometry(mod, { doorOpenAngleDeg: 45 });

    expect(geo.components.length).toBeGreaterThan(5);
    const sideLeft = geo.components.find((c) => c.role === "carcass_side_left");
    const sideRight = geo.components.find((c) => c.role === "carcass_side_right");
    const bottom = geo.components.find((c) => c.role === "carcass_bottom");
    const top = geo.components.find((c) => c.role === "carcass_top");
    const plinth = geo.components.find((c) => c.role === "plinth");

    expect(sideLeft).toBeDefined();
    expect(sideRight).toBeDefined();
    expect(bottom).toBeDefined();
    expect(top).toBeDefined();
    expect(plinth).toBeDefined();

    // Verify positioning
    expect(sideLeft!.position.x).toBe(0);
    expect(sideRight!.position.x).toBe(mod.dimensions.width - mod.carcass.panelThickness);
    expect(bottom!.dimensions.width).toBe(mod.dimensions.width - 2 * mod.carcass.panelThickness);
  });
});
