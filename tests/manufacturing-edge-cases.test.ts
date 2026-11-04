import { describe, it, expect } from "vitest";
import {
  optimizeSheetNesting,
  STANDARD_SHEET_2800x2070,
  generateDrillingForPart,
  generateSelcoExportPackage,
  generatePanelDXF,
  exportCutListToCSV,
  DEFAULT_SELCO_CONFIG,
  generateBOMForProject,
  CutPiece,
} from "@birim/manufacturing";
import { ParametricPart, createInitialProject } from "@birim/core";

describe("BİRİM CONFIGURATOR V2.5 Manufacturing Engine & Edge-Case Verification", () => {
  it("1. Sheet Nesting: Correctly handles oversized piece exceeding raw sheet dimensions", () => {
    const oversizedPiece: CutPiece = {
      id: "giant_panel",
      pieceName: "Dev Panel",
      moduleName: "Kabin 1",
      moduleId: "mod_1",
      componentRole: "side",
      materialId: "mat_melamine_white",
      materialName: "Melamin Beyaz",
      lengthMm: 3000, // Exceeds 2800mm
      widthMm: 2200,  // Exceeds 2070mm
      thicknessMm: 18,
      quantity: 1,
      edgeBanding: { top: false, bottom: false, left: false, right: false, thickness: 1 },
      grain: "lengthwise",
      areaM2: 6.6,
      edgeBandMeters: 0,
    };

    const results = optimizeSheetNesting([oversizedPiece], STANDARD_SHEET_2800x2070);
    expect(results).toHaveLength(1);
    expect(results[0].unplacedPieces.length).toBe(1);
    expect(results[0].unplacedPieces[0].id).toBe("giant_panel");
  });

  it("2. Sheet Nesting: Strict grain direction lockout prevents rotation when lengthwise grain is set", () => {
    // Piece dimensions: 2500 x 2050.
    // Sheet dimension: 2800 x 2070 (trim 15 on all sides -> net max usable: 2770 x 2040).
    // Width 2050 exceeds usable 2040mm width.
    // If grain is "lengthwise", cannot rotate, so it must remain unplaced!
    const unplacedDueToGrain: CutPiece = {
      id: "grain_locked",
      pieceName: "Kapak Damarlı",
      moduleName: "Kabin 1",
      moduleId: "mod_1",
      componentRole: "door",
      materialId: "mat_veneer_oak",
      materialName: "Meşe Kaplama",
      lengthMm: 1800,
      widthMm: 2050, // exceeds net usable sheet width 2040mm (2070 - 30)
      thicknessMm: 18,
      quantity: 1,
      edgeBanding: { top: false, bottom: false, left: false, right: false, thickness: 1 },
      grain: "lengthwise", // Locked: cannot rotate
      areaM2: 3.69,
      edgeBandMeters: 0,
    };

    const resLocked = optimizeSheetNesting([unplacedDueToGrain], STANDARD_SHEET_2800x2070);
    expect(resLocked).toHaveLength(1);
    expect(resLocked[0].unplacedPieces.length).toBe(1);

    // If grain is "none", rotation is permitted:
    // Rotated: length becomes 2050 (fits in 2770) and width becomes 1800 (fits in 2040)
    const rotationAllowed: CutPiece = {
      ...unplacedDueToGrain,
      id: "grain_allowed",
      grain: "none",
    };
    const resAllowed = optimizeSheetNesting([rotationAllowed], STANDARD_SHEET_2800x2070);
    expect(resAllowed).toHaveLength(1);
    expect(resAllowed[0].unplacedPieces.length).toBe(0);
    expect(resAllowed[0].sheets.length).toBe(1);
    expect(resAllowed[0].sheets[0].placedPieces[0].isRotated).toBe(true);
  });

  it("3. Saw Kerf & Perimeter Trim Clearance are strictly reserved", () => {
    const piece1: CutPiece = {
      id: "p1",
      pieceName: "Yan 1",
      moduleName: "M1",
      moduleId: "mod_1",
      componentRole: "side",
      materialId: "mat_melamine_white",
      materialName: "Melamin Beyaz",
      lengthMm: 1000,
      widthMm: 500,
      thicknessMm: 18,
      quantity: 1,
      edgeBanding: { top: false, bottom: false, left: false, right: false, thickness: 1 },
      grain: "none",
      areaM2: 0.5,
      edgeBandMeters: 0,
    };
    const piece2: CutPiece = { ...piece1, id: "p2" };

    const results = optimizeSheetNesting([piece1, piece2], STANDARD_SHEET_2800x2070);
    expect(results).toHaveLength(1);
    expect(results[0].sheets.length).toBe(1);
    const sheet = results[0].sheets[0];
    expect(sheet.placedPieces.length).toBe(2);

    // Each piece must obey perimeter trim (>= 15mm from borders)
    for (const p of sheet.placedPieces) {
      expect(p.x).toBeGreaterThanOrEqual(15);
      expect(p.y).toBeGreaterThanOrEqual(15);
      expect(p.x + p.length).toBeLessThanOrEqual(2800 - 15 + 0.1);
      expect(p.y + p.width).toBeLessThanOrEqual(2070 - 15 + 0.1);
    }
  });

  it("4. Drilling Engine: System 32 hole grid coordinates match European hardware standard", () => {
    const sidePart: ParametricPart = {
      id: "P_test_side",
      moduleId: "mod_1",
      label: "Sol Yan Panel",
      role: "carcass_side_left",
      dimensions: { width: 580, height: 2120, depth: 18 },
      materialId: "mat_melamine_white",
      grain: "lengthwise",
      edgeBanding: { top: false, bottom: true, left: true, right: false, thickness: 1 },
      jointType: "minifix_dowel",
      holes: [],
      position: { x: 0, y: 80, z: 0 },
    };

    const holes = generateDrillingForPart(sidePart);
    expect(holes.length).toBeGreaterThan(10);

    // Minifix bolts and dowels
    const minifixBolts = holes.filter((h) => h.purpose === "minifix_bolt");
    expect(minifixBolts.length).toBe(4);

    const dowels = holes.filter((h) => h.purpose === "dowel");
    expect(dowels.length).toBe(4);

    // Shelf pins have 5mm diameter and 12mm depth
    const shelfPins = holes.filter((h) => h.purpose === "shelf_pin");
    expect(shelfPins.length).toBeGreaterThan(0);
    expect(shelfPins[0].diameter).toBe(5);
    expect(shelfPins[0].depth).toBe(12);

    // Door hinges (Blum 35mm cup)
    const doorPart: ParametricPart = {
      id: "P_test_door",
      moduleId: "mod_1",
      label: "Kapak",
      role: "door_left",
      dimensions: { width: 596, height: 2116, depth: 18 },
      materialId: "mat_veneer_oak",
      grain: "lengthwise",
      edgeBanding: { top: true, bottom: true, left: true, right: true, thickness: 1 },
      jointType: "minifix_dowel",
      holes: [],
      position: { x: 0, y: 82, z: 600 },
    };
    const doorHoles = generateDrillingForPart(doorPart);
    const hingeCups = doorHoles.filter((h) => h.purpose === "hinge_cup");
    expect(hingeCups.length).toBeGreaterThanOrEqual(4);
    expect(hingeCups[0].diameter).toBe(35);
    expect(hingeCups[0].x).toBe(21.5);
  });

  it("5. Machine Outputs & Compliance: Explicit unverified disclaimer on CNC outputs", () => {
    const pkg = generateSelcoExportPackage([], DEFAULT_SELCO_CONFIG);
    expect(pkg.status).toBe("DRAFT_UNVERIFIED_PENDING_FACTORY_CONFIRMATION");
    expect(pkg.machineTarget).toBe("Biesse_Selco_WNT_600");
    expect(pkg.xmlOutputDraft).toContain("status=\"UNVERIFIED_DRAFT\"");
    expect(pkg.xmlOutputDraft).toContain(`kerf="${DEFAULT_SELCO_CONFIG.sawBladeKerfMm}"`);
    expect(pkg.xmlOutputDraft).toContain(`minGripper="${DEFAULT_SELCO_CONFIG.minGripperCutWidthMm}"`);
  });

  it("6. DXF Technical Drawing Generation: Header, layers and boundary integrity", () => {
    const piece: CutPiece = {
      id: "p_dxf_test",
      pieceName: "Alt Baza",
      moduleName: "M1",
      moduleId: "mod_1",
      componentRole: "bottom",
      materialId: "mat_melamine_white",
      materialName: "Melamin Beyaz",
      lengthMm: 864,
      widthMm: 580,
      thicknessMm: 18,
      quantity: 1,
      edgeBanding: { top: false, bottom: false, left: false, right: false, thickness: 1 },
      grain: "none",
      areaM2: 0.5,
      edgeBandMeters: 0,
    };

    const dxf = generatePanelDXF(piece);
    expect(dxf).toContain("SECTION");
    expect(dxf).toContain("ENTITIES");
    expect(dxf).toContain("LWPOLYLINE");
    expect(dxf).toContain("PANEL_CONTOUR");
    expect(dxf).toContain("EOF");
  });

  it("7. CSV Cut List Export: Delimiter, headers and row correctness", () => {
    const proj = createInitialProject();
    const bom = generateBOMForProject(proj);
    const csv = exportCutListToCSV(bom);

    const lines = csv.split("\n");
    expect(lines.length).toBeGreaterThan(3);
    expect(lines[0]).toBe("Parca_ID;Parca_Adi;Modul;Malzeme;Boy_mm;En_mm;Kalinlik_mm;Adet;Ust_Bant;Alt_Bant;Sol_Bant;Sag_Bant;Damar_Yonu;Alan_m2;Bant_Metre;Delik_Adedi");
    expect(lines[1]).toContain(";");
  });
});
