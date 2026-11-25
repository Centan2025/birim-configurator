"use client";
import React, { useState } from "react";
import { formatIssueHumanTitle } from "@birim/core";
import { useConfiguratorStore } from "../store/useConfiguratorStore";
import { X, Download, ListOrdered, Cpu, ShieldCheck, FileSpreadsheet, Tag, ChevronDown, Printer, Package } from "lucide-react";
import { DEFAULT_MATERIALS, evaluateUnifiedEngineeringModel, buildHardwareCertificationSummary, exportHardwareCertificationCsv, type RemediationProposal } from "@birim/core";
import { V4_HARDWARE_CATALOG } from "@birim/catalog";
import { BirimLogo } from "../v3/design-system";
import { startZeroLagModalDrag } from "../v3/design-system/zeroLagDrag";
import { exportCutListToCSV, buildBirimErpNestingBundle, generateAssemblyInstructions, generateSelcoExportPackage, generatePanelDXF, exportAllPanelsDXF, exportNestingSheetsDXF, exportIndustrialCamZipArchive, exportOptiCutCutListCsv, exportHardwareBomCsv, generateNestingDiagramSvg, generateThermalPartLabelsHtml, generateThermalPartLabelsZpl, exportArchitecturalMepDxf, generateBlumBxfXml, calculateBlumEngineeringSummary, CutPiece } from "@birim/manufacturing";
import { escapeHtml, countActiveBands } from "./bom-modal/BomBlueprintSvgs";
import { BomCutlistTab } from "./bom-modal/BomCutlistTab";
import { BomNestingTab } from "./bom-modal/BomNestingTab";
import { BomSecondaryTabs } from "./bom-modal/BomSecondaryTabs";

interface BomModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?:
    | "cutlist"
    | "hardware"
    | "nesting"
    | "validation"
    | "assembly"
    | "selco"
    | "cnc_mpr_cix"
    | "quote"
    | "blum_bxf";
}


export default function BomModal(props: BomModalProps) {
  if (!props.isOpen) return null;
  return <BomModalInner {...props} />;
}

function BomModalInner({ isOpen, onClose, initialTab = "cutlist" }: BomModalProps) {
  const [activeTab, setActiveTab] = useState<
    | "cutlist"
    | "hardware"
    | "nesting"
    | "validation"
    | "assembly"
    | "selco"
    | "cnc_mpr_cix"
    | "quote"
    | "blum_bxf"
  >(initialTab);
  const [exportStatusBanner, setExportStatusBanner] = useState<string | null>(null);
  const [erpAlgorithm, setErpAlgorithm] = useState<"Auto" | "Guillotine" | "MaxRects">("Auto");
  const [erpSheetHeight, setErpSheetHeight] = useState<2100 | 2070>(2100);
  const [erpKerf, setErpKerf] = useState<number>(4);
  const [erpMargin, setErpMargin] = useState<number>(15);
  const [erpUseNetCut, setErpUseNetCut] = useState<boolean>(true);
  const [erpCommonCut, setErpCommonCut] = useState<boolean>(false);
  const [showCutSequences, setShowCutSequences] = useState<boolean>(true);
  const [showErpContractPreview, setShowErpContractPreview] = useState<boolean>(false);
  const [selectedSimulatedPieceId, setSelectedSimulatedPieceId] = useState<string | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState<boolean>(false);
  const [cutSearch, setCutSearch] = useState<string>("");
  const [cutFilter, setCutFilter] = useState<"all" | "band4" | "cnc" | "shelf" | "plinth">("all");
  const [showTechIds, setShowTechIds] = useState<boolean>(false);
  const [inspectorOpen, setInspectorOpen] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.innerWidth >= 1200 : true
  );
  const [selectedCutPieceId, setSelectedCutPieceId] = useState<string | null>(null);
  const [checkedCutIds, setCheckedCutIds] = useState<Set<string>>(() => new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());
  const [blueprintLayers, setBlueprintLayers] = useState({ bant: true, cnc: true, olcu: true });
  const [labelPreviewPiece, setLabelPreviewPiece] = useState<CutPiece | null>(null);
  const tabGroupRef = React.useRef<HTMLDivElement | null>(null);
  const tabBtnRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});
  const [tabIndicator, setTabIndicator] = useState<{ left: number; top: number; width: number; height: number; ready: boolean }>({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    ready: false,
  });

  const filterGroupRef = React.useRef<HTMLDivElement | null>(null);
  const filterBtnRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});
  const [filterIndicator, setFilterIndicator] = useState<{ left: number; top: number; width: number; height: number; ready: boolean }>({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    ready: false,
  });



  React.useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  React.useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (labelPreviewPiece) {
          setLabelPreviewPiece(null);
          return;
        }
        if (exportMenuOpen) {
          setExportMenuOpen(false);
          return;
        }
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose, exportMenuOpen, labelPreviewPiece]);

  const bom = useConfiguratorStore((s) => s.bom);
  const project = useConfiguratorStore((s) => s.project);
  const pricing = useConfiguratorStore((s) => s.pricing);

  React.useLayoutEffect(() => {
    if (!isOpen) return;
    const syncTabs = () => {
      const btn = tabBtnRefs.current[activeTab];
      if (btn) {
        setTabIndicator({
          left: btn.offsetLeft,
          top: btn.offsetTop,
          width: btn.offsetWidth,
          height: btn.offsetHeight,
          ready: true,
        });
      }
    };
    const syncFilters = () => {
      const btn = filterBtnRefs.current[cutFilter];
      if (btn) {
        setFilterIndicator({
          left: btn.offsetLeft,
          top: btn.offsetTop,
          width: btn.offsetWidth,
          height: btn.offsetHeight,
          ready: true,
        });
      }
    };
    syncTabs();
    syncFilters();
    const raf = requestAnimationFrame(() => {
      syncTabs();
      syncFilters();
    });
    window.addEventListener("resize", syncTabs);
    window.addEventListener("resize", syncFilters);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", syncTabs);
      window.removeEventListener("resize", syncFilters);
    };
  }, [isOpen, activeTab, cutFilter, bom.cutList.length, bom.hardwareList.length]);

  const erpNestingBundle = React.useMemo(() => {
    if (!isOpen) return null;
    const matMap = new Map(
      [...DEFAULT_MATERIALS, ...(project.customMaterials || [])].map((m) => [m.id, m])
    );
    return buildBirimErpNestingBundle(project, bom, matMap, {
      organizationId: project.branchId || "org_birim_fabrika",
      orderRef: `${project.id}_v${project.version}`,
      sheetWidthMm: 2800,
      sheetHeightMm: erpSheetHeight,
      kerfMm: erpKerf,
      edgeMarginMm: erpMargin,
      algorithm: erpAlgorithm,
      useCommonCut: erpCommonCut,
      useNetCutDimensions: erpUseNetCut,
    });
  }, [
    isOpen,
    project,
    bom,
    erpSheetHeight,
    erpKerf,
    erpMargin,
    erpAlgorithm,
    erpCommonCut,
    erpUseNetCut,
  ]);

  const blumBxfXml = React.useMemo(
    () => (isOpen && activeTab === "blum_bxf" ? generateBlumBxfXml(project, bom) : ""),
    [isOpen, activeTab, project, bom]
  );
  const blumCabinetSummaries = React.useMemo(
    () =>
      isOpen && activeTab === "blum_bxf"
        ? project.modules
            .filter((m) => m.category !== "complementary")
            .map((m) => calculateBlumEngineeringSummary(m))
        : [],
    [isOpen, activeTab, project.modules]
  );

  if (!isOpen) return null;

  const downloadCustomerQuoteHtml = () => {
    const safeTitle = escapeHtml(project.title);
    const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<title>Birim Mobilya - Müşteri Teklif ve Teknik Sunum Föyü (${safeTitle})</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1c1917; margin: 32px; background: #fafaf9; }
  .header { display: flex; justify-content: space-between; border-bottom: 3px solid #b45309; padding-bottom: 16px; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; margin-bottom: 24px; background: #fff; }
  th, td { border: 1px solid #d6d3d1; padding: 10px 12px; text-align: left; font-size: 13px; }
  th { background: #f5f5f4; font-weight: 700; }
  .total-box { background: #1c1917; color: #fff; padding: 18px 24px; border-radius: 12px; text-align: right; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1 style="margin:0;font-size:22px;">BİRİM MOBİLYA — MÜŞTERİ TEKLİF & TEKNİK SUNUM FÖYÜ</h1>
      <p style="margin:4px 0 0;font-size:13px;color:#57534e;">Proje: ${safeTitle} • Versiyon: v${escapeHtml(project.version)} • Tarih: ${new Date().toLocaleDateString("tr-TR")}</p>
    </div>
    <div style="text-align:right;font-size:13px;">
      <strong>Toplam Modül:</strong> ${project.modules.length} Adet<br/>
      <strong>Toplam Panel Alanı:</strong> ${bom.summary.totalPanelAreaM2} m²
    </div>
  </div>
  <h3>1. Modül ve Malzeme Özeti</h3>
  <table>
    <thead><tr><th>#</th><th>Modül Adı</th><th>Ölçüler (G×Y×D)</th><th>Gövde Malzemesi</th><th>Kapak Malzemesi</th></tr></thead>
    <tbody>
      ${project.modules.map((m, i) => `<tr><td>${i + 1}</td><td>${escapeHtml(m.name)}</td><td>${escapeHtml(m.dimensions.width)}×${escapeHtml(m.dimensions.height)}×${escapeHtml(m.dimensions.depth)} mm</td><td>${escapeHtml(m.carcass.bodyMaterialId)}</td><td>${escapeHtml(m.carcass.doorMaterialId)}</td></tr>`).join("")}
    </tbody>
  </table>
  <h3>2. Dünya Markaları Donanım, Aksesuar ve LED Aydınlatma Listesi</h3>
  <table>
    <thead><tr><th>Katalog Kodu (SKU)</th><th>Donanım / Aksesuar Açıklaması</th><th>Miktar</th><th>Birim Fiyat (€)</th><th>Toplam (€)</th></tr></thead>
    <tbody>
      ${bom.hardwareList.map((h) => `<tr><td><code>${escapeHtml(h.sku)}</code></td><td>${escapeHtml(h.name)}</td><td>${escapeHtml(h.quantity)} ${escapeHtml(h.unit)}</td><td>€${(h.unitPrice ?? 0).toFixed(2)}</td><td>€${(h.totalPrice ?? 0).toFixed(2)}</td></tr>`).join("")}
    </tbody>
  </table>
  <div class="total-box">
    <div style="font-size:13px;color:#d6d3d1;">KDV Dahil Genel Toplam Teklif Tutarı</div>
    <div style="font-size:26px;font-weight:900;color:#fbbf24;">€${(pricing.totalWithVatEur ?? 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} (${(pricing.totalWithVatTry ?? 0).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL)</div>
  </div>
</body>
</html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Musteri_Teklif_Foyu_${project.id}_v${project.version}.html`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (a.parentNode) a.parentNode.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1500);
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    setExportStatusBanner(`${filename} indirildi`);
    setTimeout(() => setExportStatusBanner(null), 3500);
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (a.parentNode) a.parentNode.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1500);
  };

  const engGate = evaluateUnifiedEngineeringModel(project);

  const checkGateBeforeProductionExport = (formatLabel: string): boolean => {
    if (!engGate.canExportToCncAndSaw) {
      const firstErr = engGate.blockingSafetyAndEngineeringErrors[0];
      setExportStatusBanner(
        `ÜRETİM KİLİTLİ (${formatLabel}): [${firstErr?.code || "ENGEL"}] ${
          firstErr?.message || "Kritik mühendislik/güvenlik hatasını çözmeden üretim dosyası indirilemez."
        }`
      );
      return false;
    }
    return true;
  };

  const handleApplyApprovedFixInModal = (proposal: RemediationProposal) => {
    useConfiguratorStore.getState().applyApprovedEngineeringFix(proposal);
    setExportStatusBanner(`Onaylı düzeltme uygulandı (BOM & Fiyat güncellendi): ${proposal.label}`);
  };

  const downloadCamZipArchive = () => {
    if (!checkGateBeforeProductionExport("CAM ZIP")) return;
    const zipBytes = exportIndustrialCamZipArchive(project, bom);
    const blob = new Blob([zipBytes as unknown as BlobPart], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `CAM_DXF_Paketi_${project.id}_v${project.version}.zip`;
    document.body.appendChild(a);
    a.click();
    setExportStatusBanner(`CAM_DXF_Paketi_${project.id}_v${project.version}.zip indirildi`);
    setTimeout(() => {
      if (a.parentNode) a.parentNode.removeChild(a);
      URL.revokeObjectURL(url);
      setExportStatusBanner(null);
    }, 2500);
  };

  const downloadOptiCutCsv = () => {
    if (!checkGateBeforeProductionExport("OptiCut CSV")) return;
    const matMap = new Map(
      [...DEFAULT_MATERIALS, ...(project.customMaterials || [])].map((m) => [m.id, m])
    );
    const csvOut = exportOptiCutCutListCsv(bom, matMap);
    downloadFile(
      csvOut,
      `OptiCut_17Sutun_Kesim_${project.id}_v${project.version}.csv`,
      "text/csv;charset=utf-8"
    );
  };

  const downloadHardwareBomCsv = () => {
    const csvOut = exportHardwareBomCsv(bom);
    downloadFile(
      csvOut,
      `Donanim_BOM_${project.id}_v${project.version}.csv`,
      "text/csv;charset=utf-8"
    );
  };

  const downloadHardwareCertificationCsv = () => {
    const summary = buildHardwareCertificationSummary(V4_HARDWARE_CATALOG, project);
    const csvOut = exportHardwareCertificationCsv(summary);
    downloadFile(
      csvOut,
      `Fabrika_Donanim_Sertifikasyon_${project.id}_v${project.version}.csv`,
      "text/csv;charset=utf-8"
    );
    setExportStatusBanner(
      `56 donanım fabrika sertifikasyon listesi indirildi (${summary.productionReadyCount} hazır · ${summary.reviewRequiredCount} onay bekliyor).`
    );
  };

  const printBomOrNestingSheet = (mode: "nesting" | "bom") => {
    if (typeof document === "undefined" || typeof window === "undefined") return;
    const dateStr = new Date().toLocaleDateString("tr-TR");
    if (mode === "nesting") {
      const sheetSvgs = Array.from(
        document.querySelectorAll('[data-testid^="bom-nesting-svg-sheet-"]')
      );
      const svgBlocks =
        sheetSvgs.length > 0
          ? sheetSvgs
              .map((el, i) => {
                const clone = el.cloneNode(true) as SVGSVGElement;
                clone.setAttribute("style", "width:100%;height:auto;max-height:155mm;display:block;background:#FFFFFF;");
                return `<div class="sheet-block"><h4>Plaka #${i + 1} Yerleşim Şeması</h4>${new XMLSerializer().serializeToString(clone)}</div>`;
              })
              .join("")
          : `<div class="sheet-block">${generateNestingDiagramSvg(bom)}</div>`;
      const utilPct = erpNestingBundle ? erpNestingBundle.summary.overall_utilization_percent : "-";
      const totalSheets = erpNestingBundle
        ? erpNestingBundle.summary.total_sheets_used
        : bom.nestingResults.reduce((s, r) => s + r.totalSheetsCount, 0);
      const html = `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"/><title>Birim 2D Plaka Nesting — ${project.title}</title>
        <style>
          @page { size: A4 landscape; margin: 10mm; }
          body { font-family: -apple-system, Segoe UI, sans-serif; margin: 0; padding: 14px; color: #0F172A; background: #FFFFFF; }
          .hdr { display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2px solid #0F172A; padding-bottom:8px; margin-bottom:12px; }
          .sheet-block { page-break-inside: avoid; border:1px solid #CBD5E1; border-radius:10px; padding:10px; margin-bottom:14px; background:#FFFFFF; }
          h4 { margin: 0 0 6px; font-size: 13px; color: #0F172A; }
        </style></head><body>
        <div class="hdr">
          <div><div style="font-size:18px;font-weight:900;">BİRİM® 2D PLAKA NESTİNG &amp; KESİM YERLEŞİM PAFTASI</div>
          <div style="font-size:11px;color:#475569;">${project.title} • Toplam Plaka: ${totalSheets} Adet • Verimlilik: %${utilPct} • Tarih: ${dateStr}</div></div>
        </div>
        ${svgBlocks}
        <script>window.onload=()=>setTimeout(()=>window.print(),280);</script></body></html>`;
      const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    const cutRows = bom.cutList
      .map(
        (c, idx) =>
          `<tr><td>${idx + 1}</td><td><b>${c.pieceName}</b></td><td>${c.materialId}</td><td style="text-align:right">${Math.round(c.lengthMm)}×${Math.round(c.widthMm)}×${c.thicknessMm}</td><td style="text-align:right">${c.quantity}</td></tr>`
      )
      .join("");
    const hwRows = bom.hardwareList
      .map(
        (h) =>
          `<tr><td><code>${h.sku}</code></td><td>${h.name}</td><td style="text-align:right"><b>${h.quantity} ${h.unit}</b></td></tr>`
      )
      .join("");
    const html = `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"/><title>Birim Kesim & Hırdavat Listesi — ${project.title}</title>
      <style>
        @page { size: A4 portrait; margin: 12mm; }
        body { font-family: -apple-system, Segoe UI, sans-serif; margin: 0; padding: 14px; color: #0F172A; background: #FFFFFF; }
        .hdr { display:flex; justify-content:space-between; border-bottom:2px solid #0F172A; padding-bottom:8px; margin-bottom:12px; }
        table { width:100%; border-collapse:collapse; font-size:11px; margin-bottom:14px; }
        th, td { border:1px solid #CBD5E1; padding:5px 7px; text-align:left; }
        th { background:#F1F5F9; font-weight:800; }
      </style></head><body>
      <div class="hdr">
        <div><div style="font-size:18px;font-weight:900;">BİRİM® KESİM LİSTESİ (BOM) &amp; HIRDAVAT FÖYÜ</div>
        <div style="font-size:11px;color:#475569;">${project.title} • Toplam Parça: ${bom.cutList.length} • Tarih: ${dateStr}</div></div>
      </div>
      <h3 style="font-size:14px;margin:0 0 6px;">Net Kesim Parça Listesi</h3>
      <table><thead><tr><th>#</th><th>Parça Adı</th><th>Malzeme</th><th style="text-align:right">Ölçü (mm)</th><th style="text-align:right">Adet</th></tr></thead><tbody>${cutRows}</tbody></table>
      <h3 style="font-size:14px;margin:0 0 6px;">Hırdavat &amp; Bağlantı Elemanları</h3>
      <table><thead><tr><th>SKU</th><th>Donanım</th><th style="text-align:right">Miktar</th></tr></thead><tbody>${hwRows}</tbody></table>
      <script>window.onload=()=>setTimeout(()=>window.print(),260);</script></body></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const downloadNestingSvg = () => {
    const svgOut = generateNestingDiagramSvg(bom);
    downloadFile(
      svgOut,
      `Plaka_Nesting_${project.id}_v${project.version}.svg`,
      "image/svg+xml;charset=utf-8"
    );
  };

  const downloadThermalLabelsHtml = () => {
    if (!checkGateBeforeProductionExport("Termal Etiket HTML")) return;
    const htmlOut = generateThermalPartLabelsHtml(project, bom);
    downloadFile(
      htmlOut,
      `Termal_Barkod_Etiketler_100x50_${project.id}_v${project.version}.html`,
      "text/html;charset=utf-8"
    );
  };

  const downloadThermalLabelsZpl = () => {
    if (!checkGateBeforeProductionExport("Zebra ZPL Etiket")) return;
    const zplOut = generateThermalPartLabelsZpl(project, bom);
    downloadFile(
      zplOut,
      `Termal_Zebra_Barkod_100x50_${project.id}_v${project.version}.zpl`,
      "text/plain;charset=utf-8"
    );
  };

  const downloadArchitectMepDxf = () => {
    const dxfOut = exportArchitecturalMepDxf(project);
    downloadFile(
      dxfOut,
      `Santiye_MEP_Tesisat_Paftasi_${project.id}_v${project.version}.dxf`,
      "application/dxf"
    );
  };

  const downloadBlumBxf = () => {
    if (!checkGateBeforeProductionExport("Blum BXF XML")) return;
    const xmlOut = blumBxfXml || generateBlumBxfXml(project, bom);
    downloadFile(
      xmlOut,
      `Blum_Easystick_${project.id}_v${project.version}.bxf`,
      "application/xml;charset=utf-8"
    );
  };

  const downloadErpNestingJson = () => {
    if (!checkGateBeforeProductionExport("ERP Nesting JSON")) return;
    if (!erpNestingBundle) return;
    downloadFile(
      JSON.stringify(erpNestingBundle, null, 2),
      `Birim_ERP_Nesting_${project.id}_v${project.version}.json`,
      "application/json;charset=utf-8"
    );
  };

  const downloadErpSelcoCsv = () => {
    if (!checkGateBeforeProductionExport("ERP Selco CSV")) return;
    if (!erpNestingBundle) return;
    downloadFile(
      erpNestingBundle.combined_selco_csv,
      `NST_${project.id}_SELCO_WNT600.csv`,
      "text/csv;charset=utf-8"
    );
  };

  const downloadErpCncGCode = () => {
    if (!checkGateBeforeProductionExport("ERP CNC G-Code")) return;
    if (!erpNestingBundle) return;
    downloadFile(
      erpNestingBundle.combined_cnc_gcode,
      `NST_${project.id}_all.nc`,
      "text/plain;charset=utf-8"
    );
  };

  const downloadJson = () => {
    downloadFile(
      JSON.stringify(bom, null, 2),
      `BOM_${project.id}_v${project.version}.json`,
      "application/json;charset=utf-8"
    );
  };

  const downloadCsv = () => {
    if (!checkGateBeforeProductionExport("Kesim CSV")) return;
    const csvContent = exportCutListToCSV(bom);
    downloadFile(
      csvContent,
      `Kesim_Listesi_${project.id}_v${project.version}.csv`,
      "text/csv;charset=utf-8"
    );
  };

  const downloadPieceDXF = (piece: CutPiece) => {
    if (!checkGateBeforeProductionExport(`Tekil Parça DXF (${piece.id})`)) return;
    const dxfContent = generatePanelDXF(piece);
    downloadFile(dxfContent, `${piece.id}.dxf`, "application/dxf;charset=utf-8");
  };

  const downloadSampleDXF = () => {
    const piece = bom.cutList[0];
    if (!piece) return;
    downloadPieceDXF(piece);
  };

  const downloadAllPanelsDXF = () => {
    if (!checkGateBeforeProductionExport("Tüm Paneller DXF")) return;
    if (!bom.cutList.length) return;
    const dxfContent = exportAllPanelsDXF(bom);
    downloadFile(
      dxfContent,
      `Tum_Paneller_CNC_${project.id}_v${project.version}.dxf`,
      "application/dxf;charset=utf-8"
    );
  };

  const downloadNestingSheetsDXF = () => {
    if (!checkGateBeforeProductionExport("Plaka Nesting DXF")) return;
    const dxfContent = exportNestingSheetsDXF(bom);
    downloadFile(
      dxfContent,
      `Plaka_Yerlesim_Kesim_Semasi_2800x2070_${project.id}_v${project.version}.dxf`,
      "application/dxf;charset=utf-8"
    );
  };

  const assemblySteps = generateAssemblyInstructions(project, bom);
  const selcoPackage = bom.nestingResults[0]
    ? generateSelcoExportPackage(bom.nestingResults[0].sheets)
    : null;
  const gateChecks = bom.productionGate?.checks || [];
  const shelfDeflections = bom.shelfDeflectionAnalyses || [];
  const totalHardwareEur = bom.hardwareList.reduce((acc, h) => acc + (h.totalPrice ?? 0), 0);

  const filteredCutList = bom.cutList.filter((p) => {
    const q = cutSearch.trim().toLowerCase();
    if (
      q &&
      !p.pieceName.toLowerCase().includes(q) &&
      !p.id.toLowerCase().includes(q) &&
      !p.moduleName.toLowerCase().includes(q) &&
      !p.materialName.toLowerCase().includes(q)
    ) {
      return false;
    }
    if (cutFilter === "band4") return countActiveBands(p.edgeBanding) === 4;
    if (cutFilter === "cnc") return (p.holes?.length || 0) > 0 || Boolean(p.hasBackGroove || p.kerfBendingMeta || p.tambourTrackGrooveSpec);
    if (cutFilter === "shelf") return /raf|shelf/i.test(p.pieceName) || /shelf/i.test(p.componentRole);
    if (cutFilter === "plinth") return /baza|plinth/i.test(p.pieceName) || /plinth/i.test(p.componentRole);
    return true;
  });

  const groupedCutMap = new Map<string, { key: string; moduleName: string; materialName: string; thicknessMm: number; pieces: CutPiece[] }>();
  for (const p of filteredCutList) {
    const gk = `${p.moduleName}__${p.materialName}__${p.thicknessMm}`;
    let grp = groupedCutMap.get(gk);
    if (!grp) {
      grp = { key: gk, moduleName: p.moduleName, materialName: p.materialName, thicknessMm: p.thicknessMm, pieces: [] };
      groupedCutMap.set(gk, grp);
    }
    grp.pieces.push(p);
  }
  const groupedCutList = Array.from(groupedCutMap.values());

  const activeCutPiece =
    filteredCutList.find((p) => p.id === selectedCutPieceId) ||
    bom.cutList.find((p) => p.id === selectedCutPieceId) ||
    filteredCutList[0] ||
    bom.cutList[0] ||
    null;

  const navigateCutPiece = (dir: -1 | 1) => {
    const list = filteredCutList.length > 0 ? filteredCutList : bom.cutList;
    if (!list.length) return;
    const curIdx = activeCutPiece ? list.findIndex((p) => p.id === activeCutPiece.id) : -1;
    const nextIdx = curIdx === -1 ? 0 : (curIdx + dir + list.length) % list.length;
    setSelectedCutPieceId(list[nextIdx].id);
    if (!inspectorOpen) setInspectorOpen(true);
  };

  const toggleCutRowChecked = (id: string) => {
    setCheckedCutIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllVisibleChecked = (checked: boolean) => {
    setCheckedCutIds((prev) => {
      const next = new Set(prev);
      for (const p of filteredCutList) {
        if (checked) next.add(p.id);
        else next.delete(p.id);
      }
      return next;
    });
  };

  const toggleGroupCollapsed = (groupKey: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  };

  const copyPieceId = (id: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(id).catch(() => {});
    }
    setExportStatusBanner(`Teknik kod kopyalandı: ${id}`);
    setTimeout(() => setExportStatusBanner(null), 2400);
  };

  const downloadSelectedPiecesDxf = () => {
    const selected = bom.cutList.filter((p) => checkedCutIds.has(p.id));
    if (!selected.length) return;
    if (selected.length === 1) {
      downloadPieceDXF(selected[0]);
      return;
    }
    if (!checkGateBeforeProductionExport(`Seçili Parçalar DXF (${selected.length})`)) return;
    selected.slice(0, 6).forEach((p, i) => {
      setTimeout(() => downloadPieceDXF(p), i * 180);
    });
    if (selected.length > 6) {
      downloadAllPanelsDXF();
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[155] flex items-center justify-center bg-[#141413]/52 backdrop-blur-xs p-0 md:p-5"
    >
      <div
        data-draggable-shell="bom"
        onClick={(e) => e.stopPropagation()}
        className="flex flex-col w-full max-w-6xl h-[91dvh] birim-ice-modal rounded-[28px] max-md:rounded-none max-md:h-[100dvh] max-md:max-h-[100dvh] overflow-hidden text-[#141413]"
      >
        {/* Row 1: Refined Single Command Header + 3-Column Export Mega-Popover */}
        <div
          onPointerDown={(e) => startZeroLagModalDrag(e)}
          title="Pencereyi taşımak için basılı tutup sürükleyin"
          className="px-4 sm:px-5 py-3 birim-ice-shell-header flex flex-wrap items-center justify-between gap-2.5 cursor-grab active:cursor-grabbing select-none relative z-30"
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <BirimLogo className="h-4 sm:h-5 w-auto text-[#141413] shrink-0" />
            <div className="h-5 w-px bg-[#141413]/15 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xs sm:text-sm font-extrabold text-[#141413] tracking-tight leading-tight">
                  <span className="hidden sm:inline">BOM &amp; İmalat Portalı</span><span className="sm:hidden">BOM &amp; CNC</span>
                </h2>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold border whitespace-nowrap shrink-0 ${
                    bom.approvalStatus === "production_approved"
                      ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                      : "bg-amber-50 border-amber-300 text-amber-900"
                  }`}
                >
                  v{project.version} •{" "}
                  {bom.approvalStatus === "production_approved" ? "ONAYLI" : "TASLAK"}
                </span>
                {exportStatusBanner && (
                  <span className="hidden xl:inline text-[10.5px] px-2 py-0.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-900 font-semibold truncate max-w-[220px]">
                    ✓ {exportStatusBanner}
                  </span>
                )}
              </div>
              <div className="text-[11px] font-medium text-[#57534E] truncate mt-0.5">
                {project.title}
              </div>
            </div>
          </div>

          {/* Right: Unified Command Pill Group + Close */}
          <div
            className="flex items-center gap-2 shrink-0"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="inline-flex items-center p-1 gap-1 rounded-2xl bg-black/15 border border-white/15 shadow-[inset_0_1px_2px_rgba(0,0,0,0.35)]">
            {/* 1. Categorized "Dışa Aktar ▾" 3-Column Mega-Popover */}
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setExportMenuOpen((v) => !v);
                }}
                data-testid="bom-export-menu-btn"
                className="h-8 px-2.5 sm:px-3 rounded-xl birim-ice-btn text-xs font-bold text-[#141413] inline-flex items-center gap-1.5 cursor-pointer"
                title="16 farklı kesim, CAD, etiket ve makine çıktı formatı"
              >
                <Download className="w-3.5 h-3.5 text-[#57534E]" />
                <span className="hidden sm:inline">Dışa Aktar</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-[#78716C] transition-transform duration-150 ${
                    exportMenuOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {exportMenuOpen && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="fixed sm:absolute right-3 sm:right-0 top-[56px] sm:top-full sm:mt-2 w-[calc(100vw-24px)] sm:w-[680px] max-h-[78dvh] overflow-y-auto bg-[#FAF8F4]/98 backdrop-blur-xl border border-[#D6CFC2] rounded-2xl shadow-2xl p-3.5 sm:p-4 z-50 text-[#141413]"
                >
                  <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-[#E5DFD3]">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-[#141413]">
                        Dışa Aktarma &amp; Makine Çıktıları
                      </span>
                      <span className="text-[10px] font-mono text-[#78716C]">16 format</span>
                    </div>
                    <span className="text-[10px] font-mono text-[#57534E] px-2 py-0.5 rounded bg-white border border-[#E5DFD3]">
                      AC1015 / mm
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Col 1: Kesim & Liste */}
                    <div>
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#78716C] px-2 mb-1.5">
                        Kesim &amp; Liste
                      </div>
                      <div className="space-y-0.5">
                        <button
                          type="button"
                          onClick={() => { setExportMenuOpen(false); downloadOptiCutCsv(); }}
                          data-testid="bom-download-opticut-csv-btn"
                          className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-[#EFECE4] flex items-center justify-between gap-2 transition cursor-pointer"
                        >
                          <span className="text-xs font-semibold text-[#141413] truncate">OptiCut CSV</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white border border-[#E5DFD3] text-teal-700 font-bold">CSV</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setExportMenuOpen(false); downloadCsv(); }}
                          className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-[#EFECE4] flex items-center justify-between gap-2 transition cursor-pointer"
                        >
                          <span className="text-xs font-semibold text-[#141413] truncate">Standart Kesim CSV</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white border border-[#E5DFD3] text-emerald-700 font-bold">CSV</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setExportMenuOpen(false); downloadHardwareBomCsv(); }}
                          data-testid="bom-download-hw-csv-btn"
                          className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-[#EFECE4] flex items-center justify-between gap-2 transition cursor-pointer"
                        >
                          <span className="text-xs font-semibold text-[#141413] truncate">Hırdavat CSV</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white border border-[#E5DFD3] text-sky-700 font-bold">CSV</span>
                        </button>
                        <button
                          type="button"
                          data-testid="download-hardware-cert-csv-btn"
                          onClick={() => { setExportMenuOpen(false); downloadHardwareCertificationCsv(); }}
                          className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-[#EFECE4] flex items-center justify-between gap-2 transition cursor-pointer"
                        >
                          <span className="text-xs font-bold text-blue-800 truncate">56 Donanım Sertifikasyon</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 font-bold">CSV</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setExportMenuOpen(false); downloadJson(); }}
                          className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-[#EFECE4] flex items-center justify-between gap-2 transition cursor-pointer"
                        >
                          <span className="text-xs font-semibold text-[#44403C] truncate">Ham Üretim BOM</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white border border-[#E5DFD3] text-[#78716C] font-bold">JSON</span>
                        </button>
                      </div>
                    </div>

                    {/* Col 2: CAD & Plaka */}
                    <div>
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#78716C] px-2 mb-1.5">
                        CAD &amp; Plaka
                      </div>
                      <div className="space-y-0.5">
                        <button
                          type="button"
                          onClick={() => { setExportMenuOpen(false); downloadAllPanelsDXF(); }}
                          data-testid="bom-download-all-dxf-btn"
                          className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-[#EFECE4] flex items-center justify-between gap-2 transition cursor-pointer"
                        >
                          <span className="text-xs font-bold text-indigo-800 truncate">Tüm Parçalar DXF ({bom.cutList.length})</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold">DXF</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setExportMenuOpen(false); downloadNestingSheetsDXF(); }}
                          data-testid="bom-download-nesting-dxf-btn"
                          className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-[#EFECE4] flex items-center justify-between gap-2 transition cursor-pointer"
                        >
                          <span className="text-xs font-semibold text-[#141413] truncate">2800×2070 Plaka Şeması</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white border border-[#E5DFD3] text-purple-700 font-bold">DXF</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setExportMenuOpen(false); downloadNestingSvg(); }}
                          data-testid="bom-download-nesting-svg-btn"
                          className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-[#EFECE4] flex items-center justify-between gap-2 transition cursor-pointer"
                        >
                          <span className="text-xs font-semibold text-[#141413] truncate">Plaka Nest Şeması</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white border border-[#E5DFD3] text-fuchsia-700 font-bold">SVG</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setExportMenuOpen(false); downloadSampleDXF(); }}
                          className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-[#EFECE4] flex items-center justify-between gap-2 transition cursor-pointer"
                        >
                          <span className="text-xs font-semibold text-[#44403C] truncate">Örnek Tekil Parça</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white border border-[#E5DFD3] text-blue-700 font-bold">1×DXF</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setExportMenuOpen(false); downloadArchitectMepDxf(); }}
                          data-testid="bom-download-mep-dxf-btn"
                          className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-[#EFECE4] flex items-center justify-between gap-2 transition cursor-pointer"
                        >
                          <span className="text-xs font-semibold text-[#141413] truncate">Şantiye MEP Tesisat</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white border border-[#E5DFD3] text-amber-700 font-bold">DXF</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setExportMenuOpen(false); printBomOrNestingSheet(activeTab === "nesting" ? "nesting" : "bom"); }}
                          data-testid="bom-print-active-sheet-btn"
                          className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-[#EFECE4] flex items-center justify-between gap-2 transition cursor-pointer"
                        >
                          <span className="text-xs font-bold text-blue-700 truncate">Aktif Ekranı Yazdır</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 font-bold">A4</span>
                        </button>
                      </div>
                    </div>

                    {/* Col 3: Etiket & Makine Köprüsü */}
                    <div>
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#78716C] px-2 mb-1.5">
                        Etiket &amp; Makine Köprüsü
                      </div>
                      <div className="space-y-0.5">
                        <button
                          type="button"
                          onClick={() => { setExportMenuOpen(false); downloadThermalLabelsHtml(); }}
                          data-testid="bom-download-thermal-labels-btn"
                          className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-[#EFECE4] flex items-center justify-between gap-2 transition cursor-pointer"
                        >
                          <span className="text-xs font-semibold text-[#141413] truncate">Termal Etiket 100×50</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white border border-[#E5DFD3] text-orange-700 font-bold">HTML</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setExportMenuOpen(false); downloadThermalLabelsZpl(); }}
                          data-testid="bom-download-zpl-labels-btn"
                          className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-[#EFECE4] flex items-center justify-between gap-2 transition cursor-pointer"
                        >
                          <span className="text-xs font-semibold text-[#141413] truncate">Zebra Barkod Akışı</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white border border-[#E5DFD3] text-stone-700 font-bold">ZPL</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setExportMenuOpen(false); downloadBlumBxf(); }}
                          data-testid="bom-download-bxf-btn"
                          className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-[#EFECE4] flex items-center justify-between gap-2 transition cursor-pointer"
                        >
                          <span className="text-xs font-bold text-amber-800 truncate">Blum EASYSTICK</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 font-bold">BXF</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setExportMenuOpen(false); downloadCustomerQuoteHtml(); }}
                          data-testid="bom-download-quote-btn"
                          className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-[#EFECE4] flex items-center justify-between gap-2 transition cursor-pointer"
                        >
                          <span className="text-xs font-bold text-emerald-800 truncate">Müşteri Teklif Föyü</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold">HTML</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Subtle ERP Button */}
            <button
              type="button"
              onClick={downloadErpNestingJson}
              data-testid="bom-download-erp-nesting-json-btn"
              className="h-8 px-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
              title="Birim Portal ERP Nesting modülüyle %100 uyumlu JSON paketini indir"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
              <span>ERP</span>
            </button>

            {/* 3. Primary CAM .ZIP Button */}
            <button
              type="button"
              onClick={downloadCamZipArchive}
              data-testid="bom-download-cam-zip-btn"
              className="h-8 px-3 rounded-xl birim-ice-charcoal-pill shadow-[0_4px_14px_rgba(37,99,235,0.42)] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              title="Her parça için ayrı endüstriyel katmanlı CNC .DXF dosyaları içeren .ZIP paketini indir"
            >
              <Package className="w-3.5 h-3.5 text-amber-300" />
              <span className="hidden sm:inline">CAM .ZIP</span><span className="sm:hidden">ZIP</span>
            </button>

            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Kapat"
              title="Kapat"
              className="w-8 h-8 rounded-full birim-ice-btn flex items-center justify-center text-[#57534E] hover:text-[#141413] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Engineering Safety / Verification Gate Banners (if any) */}
        {(!engGate.canExportToCncAndSaw ||
          engGate.verificationRequiredFindings.some((f) => f.remediationProposals?.length)) && (
          <div className="px-5 py-2.5 bg-[#F8F5EE] border-b border-[#E5DFD3] space-y-2 text-xs">
            {!engGate.canExportToCncAndSaw && (
              <div className="p-3 rounded-2xl bg-red-50 border border-red-300 text-red-950 space-y-2">
                <div className="font-bold text-red-900">
                  Üretim Onay Kapısı Kilitli — {engGate.blockingSafetyAndEngineeringErrors.length} Kritik Mühendislik / Güvenlik Engeli
                </div>
                {engGate.blockingSafetyAndEngineeringErrors.slice(0, 3).map((err) => (
                  <div
                    key={`${err.code}_${err.targetId}`}
                    className="p-2.5 rounded-xl bg-white border border-red-200 space-y-1.5"
                  >
                    <div>
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-900 font-bold mr-1.5">
                        {err.ruleNature === "MANDATORY_SAFETY" ? "ZORUNLU GÜVENLİK" : "MÜHENDİSLİK"} •{" "}
                        {formatIssueHumanTitle(err.code, "studio")}
                      </span>
                      <span>{err.message}</span>
                    </div>
                    {err.remediationProposals && err.remediationProposals.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {err.remediationProposals.map((prop) => (
                          <button
                            key={prop.id}
                            type="button"
                            onClick={() => handleApplyApprovedFixInModal(prop)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-[11px] cursor-pointer transition"
                          >
                            Onayla ve Uygula: {prop.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {engGate.canExportToCncAndSaw &&
              engGate.verificationRequiredFindings.some((f) => f.remediationProposals?.length) && (
                <div className="p-2.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 space-y-1.5">
                  {engGate.verificationRequiredFindings
                    .filter((f) => f.remediationProposals?.length)
                    .slice(0, 2)
                    .map((vf) => (
                      <div
                        key={`${vf.code}_${vf.targetId}`}
                        className="flex flex-wrap items-center justify-between gap-2"
                      >
                        <span>
                          [{formatIssueHumanTitle(vf.code, "studio")}] {vf.message}
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {vf.remediationProposals!.map((prop) => (
                            <button
                              key={prop.id}
                              type="button"
                              onClick={() => handleApplyApprovedFixInModal(prop)}
                              className="px-2.5 py-1 rounded-lg bg-[#141413] hover:bg-stone-800 text-white font-bold text-[11px] cursor-pointer transition"
                            >
                              {prop.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              )}
          </div>
        )}

        {/* Modern Mini Info Panels (5 Tactile KPI Cards) */}
        <div className="px-3.5 sm:px-5 py-2.5 bg-[#F5F2EA] border-b border-[#E5DFD3]">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            <div className="px-3 py-2 rounded-xl bg-white/90 border border-[#E5DFD3] shadow-2xs flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-slate-500/15 border border-slate-400/25 flex items-center justify-center shrink-0">
                <Package className="w-3.5 h-3.5 text-slate-600" />
              </div>
              <div className="min-w-0">
                <div className="text-[9.5px] font-bold uppercase tracking-wider text-[#78716C] truncate">
                  Toplam Parça
                </div>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="font-mono text-sm font-extrabold text-[#141413] tabular-nums leading-none">
                    {bom.summary.totalPiecesCount}
                  </span>
                  <span className="text-[10px] text-[#78716C]">adet</span>
                </div>
              </div>
            </div>

            <div className="px-3 py-2 rounded-xl bg-white/90 border border-[#E5DFD3] shadow-2xs flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-400/30 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <div className="min-w-0">
                <div className="text-[9.5px] font-bold uppercase tracking-wider text-[#78716C] truncate">
                  Net Panel Alanı
                </div>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="font-mono text-sm font-extrabold text-amber-800 tabular-nums leading-none">
                    {bom.summary.totalPanelAreaM2}
                  </span>
                  <span className="text-[10px] text-[#78716C]">m²</span>
                </div>
              </div>
            </div>

            <div className="px-3 py-2 rounded-xl bg-white/90 border border-[#E5DFD3] shadow-2xs flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-sky-500/15 border border-sky-400/30 flex items-center justify-center shrink-0">
                <Tag className="w-3.5 h-3.5 text-sky-500" />
              </div>
              <div className="min-w-0">
                <div className="text-[9.5px] font-bold uppercase tracking-wider text-[#78716C] truncate">
                  Kenar Bandı
                </div>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="font-mono text-sm font-extrabold text-blue-800 tabular-nums leading-none">
                    {bom.summary.totalEdgeBandMeters}
                  </span>
                  <span className="text-[10px] text-[#78716C]">mt</span>
                </div>
              </div>
            </div>

            <div className="px-3 py-2 rounded-xl bg-white/90 border border-[#E5DFD3] shadow-2xs flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center shrink-0">
                <ListOrdered className="w-3.5 h-3.5 text-emerald-500" />
              </div>
              <div className="min-w-0">
                <div className="text-[9.5px] font-bold uppercase tracking-wider text-[#78716C] truncate">
                  Hırdavat &amp; Ray
                </div>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="font-mono text-sm font-extrabold text-emerald-800 tabular-nums leading-none">
                    {bom.summary.totalHardwareCount}
                  </span>
                  <span className="text-[10px] text-[#78716C]">adet</span>
                </div>
              </div>
            </div>

            <div className="col-span-2 sm:col-span-1 px-3 py-2 rounded-xl bg-white/90 border border-[#E5DFD3] shadow-2xs flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-sky-500/15 border border-sky-400/30 flex items-center justify-center shrink-0">
                <Cpu className="w-3.5 h-3.5 text-sky-400" />
              </div>
              <div className="min-w-0">
                <div className="text-[9.5px] font-bold uppercase tracking-wider text-[#78716C] truncate">
                  CNC Delik
                </div>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="font-mono text-sm font-extrabold text-sky-400 tabular-nums leading-none">
                    {bom.summary.totalDrillingHolesCount}
                  </span>
                  <span className="text-[10px] text-[#78716C]">işlem</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Row 4: Grouped Segmented Track with Smooth Sliding Active Pill */}
        <div className="px-3.5 sm:px-5 py-2 bg-white/85 border-b border-[#E5DFD3]">
          <div
            ref={tabGroupRef}
            className="relative inline-flex flex-wrap items-center p-1 gap-1 rounded-2xl bg-black/15 border border-white/15 shadow-[inset_0_1px_3px_rgba(0,0,0,0.35)] text-[11.5px] max-w-full"
          >
            {tabIndicator.ready && (
              <span
                aria-hidden="true"
                style={{
                  transform: `translate3d(${tabIndicator.left}px, ${tabIndicator.top}px, 0)`,
                  width: `${tabIndicator.width}px`,
                  height: `${tabIndicator.height}px`,
                  transition:
                    "transform 260ms cubic-bezier(0.22, 1, 0.36, 1), width 260ms cubic-bezier(0.22, 1, 0.36, 1), height 260ms cubic-bezier(0.22, 1, 0.36, 1)",
                }}
                className="pointer-events-none absolute left-0 top-0 rounded-xl bg-gradient-to-r from-[#0284C7] to-[#2563EB] shadow-[0_6px_18px_rgba(37,99,235,0.52),inset_0_1px_0_rgba(255,255,255,0.28)] z-0"
              />
            )}
            {(
              [
                { id: "cutlist", label: "Kesim & CNC", count: bom.cutList.length, testId: undefined, icon: null },
                { id: "hardware", label: "Hırdavat", count: bom.hardwareList.length, testId: undefined, icon: null },
                {
                  id: "nesting",
                  label: "2D Nesting",
                  count: erpNestingBundle
                    ? erpNestingBundle.summary.total_sheets_used
                    : bom.nestingResults.reduce((s, r) => s + r.totalSheetsCount, 0),
                  testId: undefined,
                  icon: null,
                },
                { id: "validation", label: "Doğrulama", count: gateChecks.length, testId: "bom-tab-validation", icon: "shield" },
                { id: "assembly", label: "Montaj", count: assemblySteps.length, testId: undefined, icon: "list" },
                { id: "quote", label: "Teklif Föyü", count: null, testId: "bom-tab-quote", icon: null },
                { id: "blum_bxf", label: "Blum BXF", count: null, testId: "bom-tab-blum-bxf", icon: null },
                { id: "selco", label: "Selco", count: null, testId: undefined, icon: "cpu" },
                { id: "cnc_mpr_cix", label: "CNC .MPR/.CIX", count: null, testId: "bom-tab-cnc-mpr-cix", icon: "cpu" },
              ] as const
            ).map((t) => {
              const isAct = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  ref={(el) => {
                    tabBtnRefs.current[t.id] = el;
                  }}
                  type="button"
                  data-testid={t.testId}
                  onClick={() => setActiveTab(t.id)}
                  className={`relative z-10 px-2.5 py-1.5 rounded-xl transition-colors duration-200 cursor-pointer shrink-0 inline-flex items-center gap-1.5 ${
                    isAct
                      ? "text-white font-bold"
                      : "text-[#57534E] hover:text-[#141413] font-semibold"
                  }`}
                >
                  {t.icon === "shield" && <ShieldCheck className="w-3.5 h-3.5" />}
                  {t.icon === "list" && <ListOrdered className="w-3.5 h-3.5" />}
                  {t.icon === "cpu" && <Cpu className="w-3.5 h-3.5" />}
                  <span>{t.label}</span>
                  {t.count !== null && (
                    <span
                      className={`px-1.5 py-0.2 rounded-md font-mono text-[10px] tabular-nums ${
                        isAct ? "bg-white/20 text-white" : "bg-black/10 text-inherit"
                      }`}
                    >
                      {t.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Scrollable Content */}
        <div className="flex-1 overflow-auto p-3 sm:p-5 bg-[#FAF8F4] text-xs">
          <BomCutlistTab activeCutPiece={activeCutPiece} activeTab={activeTab} blueprintLayers={blueprintLayers} bom={bom} checkedCutIds={checkedCutIds} collapsedGroups={collapsedGroups} copyPieceId={copyPieceId} cutFilter={cutFilter} cutSearch={cutSearch} downloadPieceDXF={downloadPieceDXF} downloadSelectedPiecesDxf={downloadSelectedPiecesDxf} downloadThermalLabelsHtml={downloadThermalLabelsHtml} exportMenuOpen={exportMenuOpen} filterBtnRefs={filterBtnRefs} filterGroupRef={filterGroupRef} filterIndicator={filterIndicator} groupedCutList={groupedCutList} inspectorOpen={inspectorOpen} navigateCutPiece={navigateCutPiece} setBlueprintLayers={setBlueprintLayers} setCheckedCutIds={setCheckedCutIds} setCutFilter={setCutFilter} setCutSearch={setCutSearch} setExportMenuOpen={setExportMenuOpen} setInspectorOpen={setInspectorOpen} setLabelPreviewPiece={setLabelPreviewPiece} setSelectedCutPieceId={setSelectedCutPieceId} setShowTechIds={setShowTechIds} showTechIds={showTechIds} toggleAllVisibleChecked={toggleAllVisibleChecked} toggleCutRowChecked={toggleCutRowChecked} toggleGroupCollapsed={toggleGroupCollapsed} />
          <BomNestingTab activeTab={activeTab} bom={bom} downloadErpCncGCode={downloadErpCncGCode} downloadErpNestingJson={downloadErpNestingJson} downloadErpSelcoCsv={downloadErpSelcoCsv} erpAlgorithm={erpAlgorithm} erpCommonCut={erpCommonCut} erpKerf={erpKerf} erpMargin={erpMargin} erpNestingBundle={erpNestingBundle} erpSheetHeight={erpSheetHeight} erpUseNetCut={erpUseNetCut} printBomOrNestingSheet={printBomOrNestingSheet} setErpAlgorithm={setErpAlgorithm} setErpCommonCut={setErpCommonCut} setErpKerf={setErpKerf} setErpMargin={setErpMargin} setErpSheetHeight={setErpSheetHeight} setErpUseNetCut={setErpUseNetCut} setShowCutSequences={setShowCutSequences} setShowErpContractPreview={setShowErpContractPreview} showCutSequences={showCutSequences} showErpContractPreview={showErpContractPreview} />
          <BomSecondaryTabs activeTab={activeTab} assemblySteps={assemblySteps} blumBxfXml={blumBxfXml} blumCabinetSummaries={blumCabinetSummaries} bom={bom} checkGateBeforeProductionExport={checkGateBeforeProductionExport} downloadBlumBxf={downloadBlumBxf} downloadCustomerQuoteHtml={downloadCustomerQuoteHtml} downloadFile={downloadFile} gateChecks={gateChecks} pricing={pricing} project={project} selcoPackage={selcoPackage} selectedSimulatedPieceId={selectedSimulatedPieceId} setSelectedSimulatedPieceId={setSelectedSimulatedPieceId} shelfDeflections={shelfDeflections} totalHardwareEur={totalHardwareEur} />
        </div>
      </div>
      {/* 100×50mm Thermal Label Preview Sub-Modal */}
      {labelPreviewPiece && (
        <div
          onClick={() => setLabelPreviewPiece(null)}
          className="fixed inset-0 z-[170] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-[#FAF8F4] border border-[#D6CFC2] rounded-2xl shadow-2xl overflow-hidden text-[#141413]"
          >
            <div className="px-4 py-3 bg-[#F5F2EA] border-b border-[#E5DFD3] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-orange-700" />
                <span className="text-xs font-extrabold">Termal Etiket Önizleme · 100 × 50 mm</span>
              </div>
              <button
                type="button"
                onClick={() => setLabelPreviewPiece(null)}
                className="p-1 rounded-lg text-[#57534E] hover:text-[#141413] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 bg-[#EFECE4]">
              <div className="bg-white text-zinc-950 rounded-xl p-4 border-2 border-dashed border-stone-400">
                <div className="flex items-start justify-between border-b-2 border-zinc-900 pb-2">
                  <div>
                    <div className="text-[9px] font-extrabold tracking-[0.18em] uppercase">BİRİM® · İMALAT ETİKETİ</div>
                    <div className="text-xs font-bold mt-0.5">{project.title}</div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="text-base font-extrabold leading-none">
                      #{String(Math.max(1, bom.cutList.findIndex((x) => x.id === labelPreviewPiece.id) + 1)).padStart(2, "0")}
                    </div>
                    <div className="text-[9px] text-zinc-600">/ {bom.cutList.length} PARÇA</div>
                  </div>
                </div>
                <div className="grid grid-cols-12 gap-3 py-3 items-center">
                  <div className="col-span-8 space-y-1">
                    <div className="text-sm font-extrabold leading-tight">{labelPreviewPiece.pieceName}</div>
                    <div className="font-mono text-[9.5px] text-zinc-600 break-all">{labelPreviewPiece.id}</div>
                    <div className="pt-1 flex items-center gap-3 font-mono text-xs">
                      <span><strong>NET:</strong> {labelPreviewPiece.netCutLengthMm ?? labelPreviewPiece.lengthMm}×{labelPreviewPiece.netCutWidthMm ?? labelPreviewPiece.widthMm}</span>
                      <span><strong>{labelPreviewPiece.thicknessMm}mm</strong></span>
                    </div>
                    <div className="text-[10px] text-zinc-700">
                      {labelPreviewPiece.materialName} • CNC: {(labelPreviewPiece.holes?.length || 0) > 0 ? `${labelPreviewPiece.holes!.length} delik` : "Yok"}
                    </div>
                  </div>
                  <div className="col-span-4 flex flex-col items-center">
                    <svg viewBox="0 0 80 52" className="w-24 h-16">
                      <rect x="12" y="9" width="56" height="34" fill="#F4F4F5" stroke="#A1A1AA" strokeWidth="1" />
                      {labelPreviewPiece.edgeBanding.top && <line x1="12" y1="9" x2="68" y2="9" stroke="#09090B" strokeWidth="4" />}
                      {labelPreviewPiece.edgeBanding.bottom && <line x1="12" y1="43" x2="68" y2="43" stroke="#09090B" strokeWidth="4" />}
                      {labelPreviewPiece.edgeBanding.left && <line x1="12" y1="9" x2="12" y2="43" stroke="#09090B" strokeWidth="4" />}
                      {labelPreviewPiece.edgeBanding.right && <line x1="68" y1="9" x2="68" y2="43" stroke="#09090B" strokeWidth="4" />}
                      <text x="40" y="29" textAnchor="middle" fontFamily="monospace" fontSize="8" fontWeight="bold" fill="#18181B">
                        {labelPreviewPiece.edgeBandCode || `${countActiveBands(labelPreviewPiece.edgeBanding)}K`}
                      </text>
                    </svg>
                  </div>
                </div>
                <div className="pt-2 border-t border-zinc-300 flex items-center justify-between gap-3">
                  <svg viewBox="0 0 210 22" className="h-5 flex-1">
                    {Array.from({ length: 42 }).map((_, i) => (
                      <rect key={i} x={i * 5} y="0" width={i % 3 === 0 ? 3 : i % 2 === 0 ? 1.4 : 2.2} height="22" fill="#09090B" />
                    ))}
                  </svg>
                  <span className="font-mono text-[10px] font-bold">v{project.version}</span>
                </div>
              </div>
            </div>
            <div className="px-4 py-3 bg-[#F5F2EA] border-t border-[#E5DFD3] flex items-center justify-between gap-2">
              <span className="text-[10px] font-mono text-[#78716C]">Zebra ZD421 • 203 DPI • ZPL II</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    downloadThermalLabelsHtml();
                    setLabelPreviewPiece(null);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#EFECE4] border border-[#DED8CC] text-xs font-bold cursor-pointer"
                >
                  HTML Etiket
                </button>
                <button
                  type="button"
                  onClick={() => {
                    downloadThermalLabelsZpl();
                    setLabelPreviewPiece(null);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#141413] hover:bg-stone-800 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-amber-300" />
                  <span>Zebra .ZPL İndir</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
