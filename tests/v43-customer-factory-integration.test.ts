import { describe, it, expect } from "vitest";
import {
  createInitialProject,
  calculateFourSpaceDimensions,
  calculateShelfDeflection,
  autoFixModuleIssues,
  parseCadDxfText,
} from "@birim/core";
import { V4_MODULE_TEMPLATES } from "@birim/catalog";
import { generateModuleGeometry } from "@birim/geometry";
import {
  generateBOMForProject,
  generatePanelDXF,
  exportAllPanelsDXF,
  exportCutListToCSV,
} from "@birim/manufacturing";

describe("Birim V4.3 — Mağaza Müşterisi & Fabrika Üretim Planlamacısı Bütünleşik Testleri", () => {
  it("1. 92/92 V4 şablonunda kapalı ölçü zinciri ve 3D geometri tutarlılığını doğrular", () => {
    expect(V4_MODULE_TEMPLATES.length).toBe(92);
    for (const tpl of V4_MODULE_TEMPLATES) {
      const mod = tpl.createInstance(`test_${tpl.templateId}`);
      const fourSpace = calculateFourSpaceDimensions(mod);
      const geo = generateModuleGeometry(mod);
      expect(geo.components.length).toBeGreaterThan(0);
      if (mod.category !== "complementary") {
        const sumBays = fourSpace.usableInternal.bayClearWidthsMm.reduce((a, b) => a + b, 0);
        const expectedW = sumBays + (mod.bays.length + 1) * mod.carcass.panelThickness;
        expect(expectedW).toBe(mod.dimensions.width);
      }
    }
  });

  it("2. ISO 7170 Euler-Bernoulli fiziksel raf sehim hesabını doğrular", () => {
    const safe = calculateShelfDeflection(700, 560, 18, "melamine", 35);
    expect(safe.passed).toBe(true);
    expect(safe.deflectionMm).toBeLessThanOrEqual(safe.maxAllowedDeflectionMm);

    const overloaded = calculateShelfDeflection(1150, 560, 18, "melamine", 35);
    expect(overloaded.passed).toBe(false);
    expect(overloaded.recommendation).toContain("25mm");
  });

  it("3. Mağaza müşterisi tek tıkla otomatik düzeltme (autoFixModuleIssues) kurallarını doğrular", () => {
    const proj = createInitialProject();
    const mod = JSON.parse(JSON.stringify(proj.modules[0]));
    mod.dimensions.width = 1400;
    mod.bays = [mod.bays[0]];
    mod.bays[0].door.doorSystemId = "hinged_single";
    mod.bays[0].door.type = "single_left";
    mod.bays[0].door.handleCategory = "gola_profile";
    mod.bays[0].door.overlayType = "inset";

    const { updatedModule, appliedFixes } = autoFixModuleIssues(mod);
    expect(appliedFixes.length).toBeGreaterThanOrEqual(2);
    expect(updatedModule.bays.length).toBeGreaterThanOrEqual(2);
    expect(updatedModule.bays[0].door.overlayType).toBe("full_overlay");
  });

  it("4. Fabrika BOM: Bitmiş ölçü vs. bant düşümlü testere net kesim ölçüsü ve delik çakışma korumasını doğrular", () => {
    const proj = createInitialProject();
    const bom = generateBOMForProject(proj);
    const doorPiece = bom.cutList.find((p) => p.componentRole.startsWith("door_"));
    expect(doorPiece).toBeDefined();
    expect(doorPiece!.netCutLengthMm).toBe(doorPiece!.lengthMm - 2);
    expect(doorPiece!.netCutWidthMm).toBe(doorPiece!.widthMm - 2);
    expect(doorPiece!.edgeBandCode).toContain("4K");

    const sidePiece = bom.cutList.find((p) => p.componentRole === "carcass_side_left");
    expect(sidePiece).toBeDefined();
    const frontHoles = (sidePiece!.holes || []).filter((h) => h.x === 37);
    for (let i = 0; i < frontHoles.length; i++) {
      for (let j = i + 1; j < frontHoles.length; j++) {
        expect(Math.abs(frontHoles[i].y - frontHoles[j].y)).toBeGreaterThanOrEqual(12);
      }
    }
  });

  it("5. Katmanlı AutoCAD DXF ($INSUNITS=4), Toplu DXF, CSV ve 6 aşamalı üretim kapısını doğrular", () => {
    const proj = createInitialProject();
    const bom = generateBOMForProject(proj);
    expect(bom.productionGate).toBeDefined();
    expect(bom.productionGate!.checks.length).toBe(6);
    expect(bom.productionGate!.isReadyForErp).toBe(false);

    const sidePiece = bom.cutList.find((p) => p.componentRole === "carcass_side_left")!;
    const dxf = generatePanelDXF(sidePiece);
    expect(dxf).toContain("$INSUNITS");
    expect(dxf).toContain("PANEL_CONTOUR");
    expect(dxf).toContain("BACK_GROOVE_8MM");

    const allDxf = exportAllPanelsDXF(bom);
    expect(allDxf).toContain("PANEL_CONTOUR");
    const csv = exportCutListToCSV(bom);
    expect(csv).toContain("Net_Kesim_Boy_mm;Net_Kesim_En_mm");

    const samplePlanDxf = "0\nSECTION\n2\nENTITIES\n0\nLINE\n8\nWALLS\n10\n0\n20\n0\n11\n3200\n21\n0\n0\nENDSEC\n0\nEOF";
    const parsed = parseCadDxfText(samplePlanDxf, "plan.dxf");
    expect(parsed.fileType).toBe("dxf");
    expect(parsed.polylines.length).toBeGreaterThan(0);
  });
});
