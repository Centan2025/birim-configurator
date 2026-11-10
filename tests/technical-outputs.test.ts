import { describe, it, expect } from "vitest";
import { createInitialProject } from "@birim/core";
import {
  generateBOMForProject,
  exportCutListToCSV,
  generateAssemblyInstructions,
  generatePanelDXF,
  exportAllPanelsDXF,
  generateSelcoExportPackage,
} from "@birim/manufacturing";

describe("Professional Technical Outputs (CSV, DXF, Assembly, Selco)", () => {
  it("exports valid semicolon-delimited CSV for production cut list", () => {
    const proj = createInitialProject();
    const bom = generateBOMForProject(proj);
    const csv = exportCutListToCSV(bom);

    expect(csv).toContain("Parca_ID;Parca_Adi;Modul;Malzeme;Boy_mm;En_mm");
    const lines = csv.split("\n");
    expect(lines.length).toBeGreaterThan(5);
  });

  it("generates sequential assembly steps with safety instructions", () => {
    const proj = createInitialProject();
    const bom = generateBOMForProject(proj);
    const steps = generateAssemblyInstructions(proj, bom);

    expect(steps.length).toBeGreaterThanOrEqual(5);
    expect(steps[0].title).toContain("Baza");
    expect(steps[1].title).toContain("Karkas");
    expect(steps[4].title).toContain("Kapak");
  });

  it("generates AutoCAD compatible ASCII DXF for panel cutting & drilling", () => {
    const proj = createInitialProject();
    const bom = generateBOMForProject(proj);
    const piece = bom.cutList[0];
    const dxf = generatePanelDXF(piece);

    const allDxf = exportAllPanelsDXF(bom);
    expect(allDxf).toContain("SECTION");
    expect(allDxf).toContain("PANEL_CONTOUR");

    expect(dxf).toContain("SECTION");
    expect(dxf).toContain("$ACADVER");
    expect(dxf).toContain("AC1015");
    expect(dxf).toContain("BLOCK_RECORD");
    expect(dxf).toContain("*Model_Space");
    expect(dxf).toContain("LWPOLYLINE");
    expect(dxf).toContain("PANEL_CONTOUR");
    expect(dxf).toContain("AcDbPolyline");
    expect(dxf).toContain("OBJECTS");
    expect(dxf).toContain("DICTIONARY");
    expect(dxf).toContain("EOF");

    // Verify paired group codes
    const lines = dxf.replace(/\r\n/g, "\n").trim().split("\n");
    expect(lines.length % 2).toBe(0);
    for (let i = 0; i < lines.length; i += 2) {
      const code = parseInt(lines[i].trim(), 10);
      expect(Number.isInteger(code)).toBe(true);
    }

    // Verify all holes are strictly bounded within piece dimensions
    const sidePiece = bom.cutList.find((p) => p.holes && p.holes.length > 0);
    if (sidePiece && sidePiece.holes) {
      for (const h of sidePiece.holes) {
        expect(h.x).toBeGreaterThanOrEqual(0);
        expect(h.x).toBeLessThanOrEqual(sidePiece.widthMm);
        expect(h.y).toBeGreaterThanOrEqual(0);
        expect(h.y).toBeLessThanOrEqual(sidePiece.lengthMm);
      }
    }
  });

  it("prepares Selco WNT 600 export package with clear UNVERIFIED markers", () => {
    const proj = createInitialProject();
    const bom = generateBOMForProject(proj);
    const selcoPkg = generateSelcoExportPackage(bom.nestingResults[0].sheets);

    expect(selcoPkg.machineTarget).toBe("Biesse_Selco_WNT_600");
    expect(selcoPkg.status).toBe("DRAFT_UNVERIFIED_PENDING_FACTORY_CONFIRMATION");
    expect(selcoPkg.unverifiedNotes.length).toBeGreaterThan(0);
    expect(selcoPkg.xmlOutputDraft).toContain("<BiesseProductionBatch");
  });
});
