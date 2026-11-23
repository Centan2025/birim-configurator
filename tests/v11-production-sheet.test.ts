import { describe, expect, it } from "vitest";
import { createInitialProject } from "@birim/core";
import { generateBOMForProject } from "@birim/manufacturing";
import {
  buildPrintableSheetsHtml,
  buildProductionSheetSvgDocument,
  buildSheetPages,
  type SheetBuildContext,
} from "../apps/configurator/src/v11/productionSheetEngine";

describe("v11 Production Sheet (Pafta Düzeni) Engine", () => {
  it("generates full 6-sheet DIN 919 + ISO 128 engineering set per module", () => {
    const project = createInitialProject();
    const bom = generateBOMForProject(project);
    const pages = buildSheetPages(project);

    expect(pages.length).toBe(1 + project.modules.length * 6);
    expect(pages[0].kind).toBe("overview");
    expect(pages[0].sheetNo).toBe(`01/${String(pages.length).padStart(2, "0")}`);

    const ctx: SheetBuildContext = {
      project,
      bom,
      spaceWalls: [],
      spaceObstacles: [],
      options: {
        paperFormat: "A3_LANDSCAPE",
        scale: "auto",
        unit: "mm",
        showDimensions: true,
        showSectionHatch: true,
        showXrayInterior: false,
        showBomTable: true,
        showGridTicks: true,
      },
      meta: {
        companyName: "BİRİM TEST A.Ş.",
        projectTitle: "Test Gardırop Projesi",
        customerOrOrderNo: "ORD-9912",
        drawnBy: "Test Mühendis",
        approvedBy: "Üretim Müdürü",
        revisionNote: "v1",
        sheetCodePrefix: "URT",
      },
    };

    const overviewSvg = buildProductionSheetSvgDocument(ctx, pages[0]);
    expect(overviewSvg).toContain("<svg");
    expect(overviewSvg).toContain("MEKÂN YERLEŞİM PLANI");
    expect(overviewSvg).toContain("ÖN CEPHE GÖRÜNÜŞÜ");
    expect(overviewSvg).toContain("3B İZOMETRİK PERSPEKTİF");
    expect(overviewSvg).toContain("PROJE MODÜL &amp; ÜRETİM ÖZETİ");
    expect(overviewSvg).toContain("ISO 2768-m");

    if (project.modules.length > 0) {
      const viewsSvg = buildProductionSheetSvgDocument(ctx, pages[1]);
      expect(viewsSvg).toContain("ÖN GÖRÜNÜŞ (KAPALI)");
      expect(viewsSvg).toContain("İÇ GÖRÜNÜŞ (KAPAKSIZ)");
      expect(viewsSvg).toContain("B-B YATAY PLAN KESİTİ");
      expect(viewsSvg).toContain("DÜŞEY KESİT A-A");
      expect(viewsSvg).toContain("iso-section-plane");
      expect(viewsSvg).toContain("cad-dim-chain");
      expect(viewsSvg).toContain(">473<");
      expect(viewsSvg).toContain(">973<");
      // Front asymmetric door/drawer split heights (1739 vs 2118) and Bay 2 interior 1414
      expect(viewsSvg).toContain(">1739<");
      expect(viewsSvg).toContain(">2118<");
      expect(viewsSvg).toContain(">1414<");

      const joinerySvg = buildProductionSheetSvgDocument(ctx, pages[2]);
      expect(joinerySvg).toContain("DETAY D1");
      expect(joinerySvg).toContain("DETAY D2");
      expect(joinerySvg).toContain("DETAY D3");
      expect(joinerySvg).toContain("DETAY D4");
      expect(joinerySvg).toContain("71B3550");
      expect(joinerySvg).toContain("Tam Bini");

      const explodedSvg = buildProductionSheetSvgDocument(ctx, pages[3]);
      expect(explodedSvg).toContain("PATLATILMIŞ MONTAJ PERSPEKTİFİ");
      expect(explodedSvg).toContain("PARÇA POZ LİSTESİ (BOM");
      expect(explodedSvg).toContain("ATÖLYE MONTAJ SIRASI");
      expect(explodedSvg).toContain("pafta4-asm-arrow-");
      expect(explodedSvg).toContain("HIRDAVAT:");
      expect(explodedSvg).toContain("Sol Dikme");
      expect(explodedSvg).toContain("Sağ Dikme");
      expect(explodedSvg).toContain("8mm Arkalık");

      const drillingSvg = buildProductionSheetSvgDocument(ctx, pages[4]);
      expect(drillingSvg).toContain("YAN DİKME İŞLEME DETAYI");
      expect(drillingSvg).toContain("KAPAK DELİK DETAYI");
      expect(drillingSvg).toContain("MENTEŞE TAS DELİĞİ (1:1)");
      expect(drillingSvg).toContain("DELİK KOORDİNAT TABLOSU");
      // Door hinge Y-axis centerlines & closed chain dimensions (100 / 639 / 638 / 639 / 100)
      expect(drillingSvg).toContain(">100<");
      expect(drillingSvg).toContain(">639<");
      expect(drillingSvg).toContain(">638<");
      // Door X setback (21.5), Yan Dikme Sistem 32 setback (37), 1:1 dowel pitch (45)
      expect(drillingSvg).toContain(">21.5<");
      expect(drillingSvg).toContain(">37<");
      expect(drillingSvg).toContain(">45<");
      // All 4 hinge cups listed in table without truncation
      expect(drillingSvg).toContain("Kapak Tas #1");
      expect(drillingSvg).toContain("Kapak Tas #4");
      expect(drillingSvg).toContain(">2016<");
      expect(drillingSvg).toContain("PANEL İŞLEME &amp; DELİK PLANI");

      const cuttingSvg = buildProductionSheetSvgDocument(ctx, pages[5]);
      expect(cuttingSvg).toContain("TAM NET KESİM LİSTESİ");
      expect(cuttingSvg).toContain("HIRDAVAT &amp; AKSESUAR LİSTESİ");
      expect(cuttingSvg).toContain("SUYOLU (GRAIN) &amp; KENAR BANTLAMA ŞEMASI");

      const isoDimsSvg = buildProductionSheetSvgDocument(ctx, pages[6]);
      expect(isoDimsSvg).toContain("3B İZOMETRİK DIŞ ÖLÇÜLENDİRME");
      expect(isoDimsSvg).toContain("3B İZOMETRİK İÇ DETAY ÖLÇÜLENDİRME");
      expect(isoDimsSvg).toContain("cad-iso-dimensions");
      expect(isoDimsSvg).toContain("cad-iso-interior-dimensions");
    }
  });

  it("generates printable multi-page HTML with requested paper size", () => {
    const project = createInitialProject();
    const bom = generateBOMForProject(project);
    const pages = buildSheetPages(project);

    const html = buildPrintableSheetsHtml(
      {
        project,
        bom,
        spaceWalls: [],
        spaceObstacles: [],
        options: {
          paperFormat: "A2_LANDSCAPE",
          scale: "1:20",
          unit: "mm",
          showDimensions: true,
          showSectionHatch: true,
          showXrayInterior: false,
          showBomTable: true,
          showGridTicks: true,
        },
        meta: {
          companyName: "BİRİM®",
          projectTitle: project.title,
          customerOrOrderNo: "SIP-42",
          drawnBy: "CAD",
          approvedBy: "Onay",
          revisionNote: "v1",
          sheetCodePrefix: "PAFTA",
        },
      },
      pages
    );

    expect(html).toContain("@page { size: A2 landscape;");
    expect(html).toContain("PATLATILMIŞ MONTAJ PERSPEKTİFİ");
    expect(html).toContain("window.print()");
  });

  it("renders manufacturer-accurate hinge technical drawings for selected hinge SKUs", () => {
    const project = createInitialProject();
    const cases = [
      { hwId: "hw_hettich_9071205", expectD4: ["9071205", "Hettich Sensys 8645i", "12.8"], expectP5: ["9071205", ">52<"] },
      { hwId: "hw_blum_71b7550", expectD4: ["71B7550", "155°", "cad-hinge-wide-scissor-arm"], expectP5: ["71B7550", "11.7"] },
      { hwId: "hw_blum_cristallo", expectD4: ["71B4500C", "CRISTALLO", "30.2 (UV)"], expectP5: ["71B4500C", "DELİKSİZ UV PLAKA"] },
      { hwId: "hw_blum_expando_t", expectD4: ["71B3550T", "EXPANDO T", "Ø10"], expectP5: ["71B3550T", "2×Ø10×6.0"] },
      { hwId: "hw_salice_c7p6ae9", expectD4: ["C7P6AE9", "Salice Silentia+", "12 mm"], expectP5: ["C7P6AE9", ">48<"] },
      { hwId: "hw_grass_tiomos_110", expectD4: ["F045138470", "Grass Tiomos", "12.6"], expectP5: ["F045138470", "12.6"] },
    ];

    for (const c of cases) {
      project.modules[0].bays[0].door.hardwareProductId = c.hwId;
      const bom = generateBOMForProject(project);
      const pages = buildSheetPages(project);
      const ctx: SheetBuildContext = {
        project,
        bom,
        spaceWalls: [],
        spaceObstacles: [],
        options: {
          paperFormat: "A3_LANDSCAPE",
          scale: "auto",
          unit: "mm",
          showDimensions: true,
          showSectionHatch: true,
          showXrayInterior: false,
          showBomTable: true,
          showGridTicks: true,
        },
        meta: {
          companyName: "BİRİM®",
          projectTitle: project.title,
          customerOrOrderNo: "ORD-HINGE",
          drawnBy: "CAD",
          approvedBy: "Onay",
          revisionNote: "v1",
          sheetCodePrefix: "PAFTA",
        },
      };
      const joinerySvg = buildProductionSheetSvgDocument(ctx, pages[2]);
      const drillingSvg = buildProductionSheetSvgDocument(ctx, pages[4]);
      for (const token of c.expectD4) expect(joinerySvg).toContain(token);
      for (const token of c.expectP5) expect(drillingSvg).toContain(token);
    }
  });
});
