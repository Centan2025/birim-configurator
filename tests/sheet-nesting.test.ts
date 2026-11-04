import { describe, it, expect } from "vitest";
import { optimizeSheetNesting, STANDARD_SHEET_2800x2070 } from "@birim/manufacturing";
import { CutPiece } from "@birim/manufacturing";

describe("Real 2D Guillotine Sheet Nesting Optimizer", () => {
  it("places multiple cut pieces onto standard sheets respecting kerf and trim limits", () => {
    const pieces: CutPiece[] = [
      {
        id: "p1",
        pieceName: "Yan Panel 1",
        moduleName: "Mod",
        moduleId: "m1",
        componentRole: "side",
        materialId: "mat_white",
        materialName: "Melamin Beyaz",
        lengthMm: 2120,
        widthMm: 580,
        thicknessMm: 18,
        quantity: 2,
        edgeBanding: { top: false, bottom: true, left: true, right: false, thickness: 1 },
        grain: "lengthwise",
        areaM2: 1.23,
        edgeBandMeters: 2.7,
      },
      {
        id: "p2",
        pieceName: "Alt Panel",
        moduleName: "Mod",
        moduleId: "m1",
        componentRole: "bottom",
        materialId: "mat_white",
        materialName: "Melamin Beyaz",
        lengthMm: 1164,
        widthMm: 580,
        thicknessMm: 18,
        quantity: 2,
        edgeBanding: { top: false, bottom: false, left: true, right: false, thickness: 1 },
        grain: "none", // rotation allowed
        areaM2: 0.675,
        edgeBandMeters: 1.164,
      },
    ];

    const results = optimizeSheetNesting(pieces, STANDARD_SHEET_2800x2070);
    expect(results).toHaveLength(1);

    const matResult = results[0];
    expect(matResult.sheets.length).toBeGreaterThanOrEqual(1);
    expect(matResult.unplacedPieces).toHaveLength(0);

    const sheet1 = matResult.sheets[0];
    expect(sheet1.placedPieces.length).toBe(4);
    expect(sheet1.netUsedAreaM2).toBeGreaterThan(0);
    expect(sheet1.wasteAreaM2).toBeGreaterThanOrEqual(0);
    expect(sheet1.wastePercent).toBeLessThan(100);

    // Verify pieces fit within usable sheet boundary: 2800 - 2*15 = 2770, 2070 - 2*15 = 2040
    sheet1.placedPieces.forEach((p) => {
      expect(p.x + p.width).toBeLessThanOrEqual(2800 - 15 + 1);
      expect(p.y + p.length).toBeLessThanOrEqual(2070 - 15 + 1);
    });
  });

  it("handles grain direction: disallows rotation when grain is lengthwise", () => {
    const pieces: CutPiece[] = [
      {
        id: "p_grain",
        pieceName: "Meşe Kapak",
        moduleName: "Mod",
        moduleId: "m1",
        componentRole: "door",
        materialId: "mat_oak",
        materialName: "Doğal Meşe",
        lengthMm: 2100,
        widthMm: 500,
        thicknessMm: 18,
        quantity: 1,
        edgeBanding: { top: true, bottom: true, left: true, right: true, thickness: 1 },
        grain: "lengthwise",
        areaM2: 1.05,
        edgeBandMeters: 5.2,
      },
    ];

    const results = optimizeSheetNesting(pieces);
    const placed = results[0].sheets[0].placedPieces[0];
    expect(placed.isRotated).toBe(false); // must not rotate lengthwise wood grain
  });
});
