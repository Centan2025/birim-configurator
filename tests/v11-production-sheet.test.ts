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

    expect(pages.length).toBe(1 + project.modules.length * 5);
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
});
