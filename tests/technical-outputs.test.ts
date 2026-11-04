import { describe, it, expect } from "vitest";
import { createInitialProject } from "@birim/core";
import {
  generateBOMForProject,
  exportCutListToCSV,
  generateAssemblyInstructions,
  generatePanelDXF,
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

    expect(dxf).toContain("SECTION");
    expect(dxf).toContain("LWPOLYLINE");
    expect(dxf).toContain("PANEL_CONTOUR");
    expect(dxf).toContain("EOF");
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
