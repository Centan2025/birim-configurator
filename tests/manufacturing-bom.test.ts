import { describe, it, expect } from "vitest";
import { createInitialProject } from "@birim/core";
import { generateBOMForProject } from "@birim/manufacturing";

describe("Manufacturing & BOM Engine", () => {
  it("produces deterministic cut list from project model", () => {
    const proj = createInitialProject();
    const bom = generateBOMForProject(proj);

    expect(bom.cutList.length).toBeGreaterThan(0);
    expect(bom.summary.totalPanelAreaM2).toBeGreaterThan(0);
    expect(bom.summary.totalEdgeBandMeters).toBeGreaterThan(0);
    expect(bom.summary.totalHardwareCount).toBeGreaterThan(0);

    // Verify pieces have valid positive dimensions
    bom.cutList.forEach((piece) => {
      expect(piece.lengthMm).toBeGreaterThan(0);
      expect(piece.widthMm).toBeGreaterThan(0);
      expect(piece.thicknessMm).toBeGreaterThan(0);
      expect(piece.areaM2).toBeGreaterThan(0);
    });
  });

  it("calculates edge banding requirements correctly for front-banded carcass parts", () => {
    const proj = createInitialProject();
    const bom = generateBOMForProject(proj);

    const sidePanel = bom.cutList.find((p) => p.componentRole === "carcass_side_left");
    expect(sidePanel).toBeDefined();
    expect(sidePanel!.edgeBanding.bottom).toBe(true);
    expect(sidePanel!.edgeBanding.left).toBe(true);
    expect(sidePanel!.edgeBandMeters).toBeGreaterThan(0);
  });

  it("accurately estimates standard sheets required with waste factor", () => {
    const proj = createInitialProject();
    const bom = generateBOMForProject(proj);

    bom.materialUsage.forEach((mat) => {
      expect(mat.grossAreaM2).toBeGreaterThan(mat.netAreaM2);
      expect(mat.estimatedSheetsCount).toBeGreaterThanOrEqual(1);
    });
  });

  it("generates hardware BOM with minifix, hinges and handles", () => {
    const proj = createInitialProject();
    const bom = generateBOMForProject(proj);

    const hingeHw = bom.hardwareList.find((h) => h.category === "hinge");
    const minifixHw = bom.hardwareList.find((h) => h.sku === "HW_MINIFIX_SET");

    expect(hingeHw).toBeDefined();
    expect(hingeHw!.quantity).toBeGreaterThan(0);
    expect(minifixHw).toBeDefined();
    expect(minifixHw!.quantity).toBeGreaterThanOrEqual(8);
  });
});
