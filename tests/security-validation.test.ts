import { describe, it, expect } from "vitest";
import { DesignProjectSchema, ModuleInstanceSchema } from "@birim/core";

describe("Security Boundaries & Schema Validation", () => {
  it("rejects malicious or invalid dimensions via Zod validation", () => {
    const invalidModule = {
      id: "mod_attack",
      name: "Attack",
      category: "wardrobe",
      position: { x: 0, y: 0, z: 0 },
      dimensions: {
        width: -500, // Negative dimension
        height: 100000, // Out of limits
        depth: 0,
      },
      bays: [],
      carcass: {
        panelThickness: 18,
        backPanelThickness: 8,
        backPanelType: "grooved",
        plinthHeight: 80,
        doorPerimeterGap: 2,
        edgeBandThickness: 1,
        bodyMaterialId: "mat_melamine_white",
        doorMaterialId: "mat_veneer_oak",
      },
    };

    const res = ModuleInstanceSchema.safeParse(invalidModule);
    expect(res.success).toBe(false);
  });

  it("validates project schema integrity strictly", () => {
    const maliciousPayload = {
      id: "proj_1",
      version: "invalid_string_version", // should be int
      title: "",
    };

    const res = DesignProjectSchema.safeParse(maliciousPayload);
    expect(res.success).toBe(false);
  });
});
