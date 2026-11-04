import { describe, it, expect } from "vitest";
import { createInitialProject } from "@birim/core";
import { createKitchenLProject, createKitchenUProject, createKitchenLinearProject } from "@birim/catalog";
import {
  getModuleOrientedFootprint,
  validateSpatialAndKitchenEngineering,
  KITCHEN_ENGINEERING_RULE_REGISTRY,
} from "../apps/configurator/src/v3/engine/kitchenSpatialEngine";

describe("BİRİM CONFIGURATOR V3.1 — Kitchen & Spatial Engineering Engine", () => {
  it("1. Correctly swaps planWidth and planDepth when a module is rotated 90 or 270 degrees", () => {
    const proj = createKitchenLProject();
    const arm = proj.modules.find((m) => m.id === "l_arm")!;
    arm.rotation = { x: 0, y: 90, z: 0 };

    const fp = getModuleOrientedFootprint(arm, 2);
    expect(fp.rawWidth).toBe(600);
    expect(fp.rawDepth).toBe(580);
    expect(fp.planWidth).toBe(580);
    expect(fp.planDepth).toBe(600);
    expect(fp.rotationY).toBe(90);
  });

  it("2. Detects Window collision when a tall or wall cabinet overlaps window opening", () => {
    const proj = createKitchenLinearProject();
    // Move tall pantry (height 2150mm) to X=1900mm where window is at X=1850..2800, Y=1100..2150
    const tall = proj.modules.find((m) => m.id === "k_tall")!;
    tall.position.x = 1900;

    const issues = validateSpatialAndKitchenEngineering(proj);
    const windowErr = issues.find((i) => i.code === "ERR_WINDOW_COLLISION");
    expect(windowErr).toBeDefined();
    expect(windowErr?.severity).toBe("error");
    expect(windowErr?.blockingProduction).toBe(true);
  });

  it("3. Detects Structural Column collision when module extends into column zone", () => {
    const proj = createKitchenLinearProject();
    const tall = proj.modules.find((m) => m.id === "k_tall")!;
    // Column is at X=2950..3200
    tall.position.x = 2600; // 2600 + 600 = 3200 -> overlaps 2950..3200

    const issues = validateSpatialAndKitchenEngineering(proj);
    const colErr = issues.find((i) => i.code === "ERR_COLUMN_COLLISION");
    expect(colErr).toBeDefined();
    expect(colErr?.severity).toBe("error");
  });

  it("4. Detects Plumbing misalignment when Sink cabinet is moved far from water outlet", () => {
    const proj = createKitchenLinearProject();
    const sink = proj.modules.find((m) => m.id === "k_sink")!;
    sink.position.x = 1600; // Plumbing is centered at X=450mm

    const issues = validateSpatialAndKitchenEngineering(proj);
    const plumbWarn = issues.find((i) => i.code === "WARN_PLUMBING_OFFSET");
    expect(plumbWarn).toBeDefined();
    expect(plumbWarn?.severity).toBe("warning");
  });

  it("5. Explicitly marks unverified field rules in KITCHEN_ENGINEERING_RULE_REGISTRY", () => {
    const verified = KITCHEN_ENGINEERING_RULE_REGISTRY.filter((r) => r.verified);
    const unverified = KITCHEN_ENGINEERING_RULE_REGISTRY.filter((r) => !r.verified);
    expect(verified.length).toBeGreaterThanOrEqual(7);
    expect(unverified.length).toBeGreaterThanOrEqual(2);
    expect(unverified[0].standardRef).toContain("DOĞRULANMAMIŞ");
  });

  it("6. Validates U-Kitchen with rotated left and right arms without false-positive overlap", () => {
    const proj = createKitchenUProject();
    const leftArm = proj.modules.find((m) => m.id === "u_arm_left")!;
    const rightArm = proj.modules.find((m) => m.id === "u_arm_right")!;
    leftArm.position = { x: 0, y: 0, z: 650 };
    leftArm.rotation = { x: 0, y: 90, z: 0 };
    rightArm.position = { x: 1820, y: 0, z: 650 };
    rightArm.rotation = { x: 0, y: 270, z: 0 };

    const issues = validateSpatialAndKitchenEngineering(proj);
    const overlaps = issues.filter((i) => i.code === "ERR_SPATIAL_MODULE_OVERLAP");
    expect(overlaps).toHaveLength(0);
  });
});
