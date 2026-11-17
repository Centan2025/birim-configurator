"use client";

import React, { useState } from "react";
import { formatIssueHumanTitle } from "@birim/core";
import { useConfiguratorStore } from "../store/useConfiguratorStore";
import {
  X,
  Download,
  AlertTriangle,
  FileCode,
  ListOrdered,
  Cpu,
  ShieldAlert,
  ShieldCheck,
  FileSpreadsheet,
  Tag,
} from "lucide-react";
import { DEFAULT_MATERIALS, evaluateUnifiedEngineeringModel, type RemediationProposal } from "@birim/core";
import { BirimLogo, V3PremiumDropdown } from "../v3/design-system";
import { startZeroLagModalDrag } from "../v3/design-system/zeroLagDrag";
import {
  exportCutListToCSV,
  buildBirimErpNestingBundle,
  adjustErpGrooveSideForRotation,
  generateAssemblyInstructions,
  generateSelcoExportPackage,
  generatePanelDXF,
  exportAllPanelsDXF,
  exportNestingSheetsDXF,
  exportIndustrialCamZipArchive,
  exportOptiCutCutListCsv,
  exportHardwareBomCsv,
  generateNestingDiagramSvg,
  generateThermalPartLabelsHtml,
  generateThermalPartLabelsZpl,
  exportArchitecturalMepDxf,
  generateBlumBxfXml,
  calculateBlumEngineeringSummary,
  generateProjectCncPostProcessorBundle,
  mapCutPieceToCncPieceInput,
  simulateCncPostProcessorBundle,
  generateCncToolpathSimulationSvg,
  type CncPieceInput,
  CutPiece,
} from "@birim/manufacturing";

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

function escapeHtml(raw: unknown): string {
  return String(raw ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

  React.useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  React.useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  const bom = useConfiguratorStore((s) => s.bom);
  const project = useConfiguratorStore((s) => s.project);
  const pricing = useConfiguratorStore((s) => s.pricing);

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

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[155] flex items-center justify-center bg-[#141413]/52 backdrop-blur-xs p-3 sm:p-5"
    >
      <div
        data-draggable-shell="bom"
        onClick={(e) => e.stopPropagation()}
        className="flex flex-col w-full max-w-6xl h-[91vh] birim-ice-modal rounded-[28px] overflow-hidden text-[#141413]"
      >
        {/* Row 1: Studio Architectural Header (Zero-Lag Draggable) */}
        <div
          onPointerDown={(e) => startZeroLagModalDrag(e)}
          title="Pencereyi taşımak için basılı tutup sürükleyin"
          className="px-5 py-3.5 birim-ice-shell-header flex flex-wrap items-center justify-between gap-3 cursor-grab active:cursor-grabbing select-none"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <BirimLogo className="h-5 w-auto text-[#141413] shrink-0" />
            <div className="h-4 w-px bg-[#141413]/15 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-extrabold text-[#141413] tracking-tight">
                  BOM &amp; İmalat Mühendisliği Portalı
                </h2>
                <span
                  className={`text-[10.5px] px-2.5 py-0.5 rounded-full font-mono font-bold border ${
                    bom.approvalStatus === "production_approved"
                      ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                      : "bg-amber-50 border-amber-300 text-amber-900"
                  }`}
                >
                  v{project.version} •{" "}
                  {bom.approvalStatus === "production_approved" ? "ÜRETİM ONAYLI" : "TASLAK"}
                </span>
                {exportStatusBanner && (
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-900 font-semibold">
                    ✓ {exportStatusBanner}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#57534E] truncate mt-0.5">
                {project.title} • Net Testere Kesim, CNC Delik/Kanal/Kerf Operasyonları, 2D Plaka Nesting, Blum BXF &amp; Sehim Doğrulaması
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={downloadCamZipArchive}
              data-testid="bom-download-cam-zip-btn"
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl birim-ice-charcoal-pill cursor-pointer"
              title="Her parça için ayrı endüstriyel katmanlı CNC .DXF dosyaları içeren .ZIP paketini indir"
            >
              <Download className="w-3.5 h-3.5 text-amber-300" />
              <span>CAM .ZIP Paketi</span>
            </button>
            <button
              type="button"
              onClick={downloadCustomerQuoteHtml}
              data-testid="bom-download-quote-btn"
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition cursor-pointer"
              title="Yazdırılabilir Müşteri Teklif & Teknik Sunum Föyünü İndir"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Teklif Föyü</span>
            </button>
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

        {/* Row 2: Organized Industrial Export & CAD Strip */}
        <div className="px-5 py-2 bg-[#F5F2EA] border-b border-[#E5DFD3] flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px]">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#78716C] mr-0.5">
              Kesim &amp; Liste:
            </span>
            <button
              type="button"
              onClick={downloadOptiCutCsv}
              data-testid="bom-download-opticut-csv-btn"
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg birim-ice-btn font-bold text-[#141413] cursor-pointer"
              title="17 sütunlu OptiCut / Kesim Optimizasyon CSV listesini indir"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-teal-700" />
              <span>OptiCut CSV</span>
            </button>
            <button
              type="button"
              onClick={downloadCsv}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg birim-ice-btn font-semibold text-[#141413] cursor-pointer"
              title="Standart Kesim Listesi CSV"
            >
              <Download className="w-3 h-3 text-emerald-700" />
              <span>CSV</span>
            </button>
            <button
              type="button"
              onClick={downloadHardwareBomCsv}
              data-testid="bom-download-hw-csv-btn"
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg birim-ice-btn font-bold text-[#141413] cursor-pointer"
              title="Aksesuar ve Hırdavat Malzeme İhtiyaç Listesi (BOM CSV)"
            >
              <ListOrdered className="w-3.5 h-3.5 text-sky-700" />
              <span>Hırdavat CSV</span>
            </button>
            <button
              type="button"
              onClick={downloadJson}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg birim-ice-btn font-semibold text-[#44403C] cursor-pointer"
              title="Ham Üretim BOM JSON Paketi"
            >
              <Download className="w-3 h-3 text-[#78716C]" />
              <span>JSON</span>
            </button>
          </div>

          <span className="hidden lg:inline-block h-4 w-px bg-[#D6CFC2]" />

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#78716C] mr-0.5">
              CAD &amp; Plaka:
            </span>
            <button
              type="button"
              onClick={downloadAllPanelsDXF}
              data-testid="bom-download-all-dxf-btn"
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg birim-ice-btn font-bold text-[#141413] cursor-pointer"
              title="Projedeki tüm parçaların bitmiş kontur, net kesim, kanal ve delik katmanlı CNC DXF çizimini indir"
            >
              <FileCode className="w-3.5 h-3.5 text-indigo-700" />
              <span>DXF</span>
            </button>
            <button
              type="button"
              onClick={downloadNestingSheetsDXF}
              data-testid="bom-download-nesting-dxf-btn"
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg birim-ice-btn font-bold text-[#141413] cursor-pointer"
              title="2800x2070 mm plaka yerleşim (optimizasyon) kesim şemasını DXF olarak indir"
            >
              <FileCode className="w-3.5 h-3.5 text-purple-700" />
              <span>Nest DXF</span>
            </button>
            <button
              type="button"
              onClick={downloadNestingSvg}
              data-testid="bom-download-nesting-svg-btn"
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg birim-ice-btn font-bold text-[#141413] cursor-pointer"
              title="2800×2070 mm Plaka Kesim ve Yerleşim Şemasını (.SVG) indir"
            >
              <Cpu className="w-3.5 h-3.5 text-fuchsia-700" />
              <span>Nest SVG</span>
            </button>
            <button
              type="button"
              onClick={downloadSampleDXF}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg birim-ice-btn font-semibold text-[#44403C] cursor-pointer"
              title="İlk parçanın örnek tekil DXF çizimini indir"
            >
              <FileCode className="w-3 h-3 text-blue-700" />
              <span>1×DXF</span>
            </button>
            <button
              type="button"
              onClick={downloadArchitectMepDxf}
              data-testid="bom-download-mep-dxf-btn"
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg birim-ice-btn font-bold text-[#141413] cursor-pointer"
              title="İç Mimar Şantiye Elektrik, Priz, Su, Gider ve Davlumbaz Baca Aks Paftası (Çok Katmanlı AIA .DXF)"
            >
              <FileCode className="w-3.5 h-3.5 text-amber-700" />
              <span>MEP .DXF</span>
            </button>
          </div>

          <span className="hidden lg:inline-block h-4 w-px bg-[#D6CFC2]" />

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#78716C] mr-0.5">
              Etiket &amp; Köprü:
            </span>
            <button
              type="button"
              onClick={downloadThermalLabelsHtml}
              data-testid="bom-download-thermal-labels-btn"
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg birim-ice-btn font-bold text-[#141413] cursor-pointer"
              title="100×50 mm Barkodlu, Kenar Bant Şemalı Termal Parça Etiketlerini Yazdır / İndir"
            >
              <Tag className="w-3.5 h-3.5 text-orange-700" />
              <span>Etiket 100×50</span>
            </button>
            <button
              type="button"
              onClick={downloadThermalLabelsZpl}
              data-testid="bom-download-zpl-labels-btn"
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg birim-ice-btn font-bold text-[#141413] cursor-pointer"
              title="Zebra Termal Yazıcı için Doğrudan Ham .ZPL II (203dpi, 100×50mm Code-128 Barkod) Akışını İndir"
            >
              <Tag className="w-3.5 h-3.5 text-stone-700" />
              <span>Zebra .ZPL</span>
            </button>
            <button
              type="button"
              onClick={downloadErpNestingJson}
              data-testid="bom-download-erp-nesting-json-btn"
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold cursor-pointer"
              title="Birim Portal ERP Nesting modülüyle %100 uyumlu JSON paketini indir"
            >
              <Download className="w-3 h-3" />
              <span>ERP</span>
            </button>
            <button
              type="button"
              onClick={downloadBlumBxf}
              data-testid="bom-download-bxf-btn"
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold cursor-pointer"
              title="Blum E-SERVICES / EASYSTICK / MINIPRESS için .BXF üretim dosyasını indir"
            >
              <Download className="w-3 h-3" />
              <span>BXF</span>
            </button>
          </div>
        </div>

        {/* Row 3: 5 Crisp Summary KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 px-5 py-2.5 bg-[#FAF8F4] border-b border-[#E5DFD3] text-xs">
          <div className="bg-white px-3 py-2 rounded-xl border border-[#E5DFD3] shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716C] block">
              Toplam Parça
            </span>
            <div className="text-sm font-extrabold font-mono text-[#141413]">
              {bom.summary.totalPiecesCount} adet
            </div>
          </div>
          <div className="bg-white px-3 py-2 rounded-xl border border-[#E5DFD3] shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716C] block">
              Net Panel Alanı
            </span>
            <div className="text-sm font-extrabold font-mono text-amber-800">
              {bom.summary.totalPanelAreaM2} m²
            </div>
          </div>
          <div className="bg-white px-3 py-2 rounded-xl border border-[#E5DFD3] shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716C] block">
              Kenar Bandı
            </span>
            <div className="text-sm font-extrabold font-mono text-blue-800">
              {bom.summary.totalEdgeBandMeters} mt
            </div>
          </div>
          <div className="bg-white px-3 py-2 rounded-xl border border-[#E5DFD3] shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716C] block">
              Hırdavat &amp; Ray
            </span>
            <div className="text-sm font-extrabold font-mono text-emerald-800">
              {bom.summary.totalHardwareCount} adet
            </div>
          </div>
          <div className="col-span-2 sm:col-span-1 bg-white px-3 py-2 rounded-xl border border-[#E5DFD3] shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716C] block">
              CNC Delik İşlemi
            </span>
            <div className="text-sm font-extrabold font-mono text-purple-800">
              {bom.summary.totalDrillingHolesCount} delik
            </div>
          </div>
        </div>

        {/* Row 4: Modern Segmented Pill Tabs */}
        <div className="flex items-center px-5 py-2 bg-white/85 border-b border-[#E5DFD3] gap-1.5 text-xs overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("cutlist")}
            className={`px-3 py-1.5 rounded-xl transition cursor-pointer shrink-0 ${
              activeTab === "cutlist"
                ? "bg-[#141413] text-white font-bold shadow-2xs"
                : "text-[#57534E] hover:text-[#141413] hover:bg-[#EFECE4] font-semibold"
            }`}
          >
            Net Kesim &amp; CNC Tablosu ({bom.cutList.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("hardware")}
            className={`px-3 py-1.5 rounded-xl transition cursor-pointer shrink-0 ${
              activeTab === "hardware"
                ? "bg-[#141413] text-white font-bold shadow-2xs"
                : "text-[#57534E] hover:text-[#141413] hover:bg-[#EFECE4] font-semibold"
            }`}
          >
            Hırdavat &amp; Donanım ({bom.hardwareList.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("nesting")}
            className={`px-3 py-1.5 rounded-xl transition cursor-pointer shrink-0 ${
              activeTab === "nesting"
                ? "bg-[#141413] text-white font-bold shadow-2xs"
                : "text-[#57534E] hover:text-[#141413] hover:bg-[#EFECE4] font-semibold"
            }`}
          >
            2D Plaka Nesting (
            {erpNestingBundle
              ? erpNestingBundle.summary.total_sheets_used
              : bom.nestingResults.reduce((s, r) => s + r.totalSheetsCount, 0)}{" "}
            Plaka)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("validation")}
            data-testid="bom-tab-validation"
            className={`px-3 py-1.5 rounded-xl transition cursor-pointer shrink-0 inline-flex items-center gap-1 ${
              activeTab === "validation"
                ? "bg-[#141413] text-white font-bold shadow-2xs"
                : "text-[#57534E] hover:text-[#141413] hover:bg-[#EFECE4] font-semibold"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Doğrulama &amp; Sehim ({gateChecks.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("assembly")}
            className={`px-3 py-1.5 rounded-xl transition cursor-pointer shrink-0 inline-flex items-center gap-1 ${
              activeTab === "assembly"
                ? "bg-[#141413] text-white font-bold shadow-2xs"
                : "text-[#57534E] hover:text-[#141413] hover:bg-[#EFECE4] font-semibold"
            }`}
          >
            <ListOrdered className="w-3.5 h-3.5" />
            <span>Montaj Sırası ({assemblySteps.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("quote")}
            data-testid="bom-tab-quote"
            className={`px-3 py-1.5 rounded-xl transition cursor-pointer shrink-0 ${
              activeTab === "quote"
                ? "bg-[#141413] text-white font-bold shadow-2xs"
                : "text-[#57534E] hover:text-[#141413] hover:bg-[#EFECE4] font-semibold"
            }`}
          >
            Müşteri Teklif Föyü
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("blum_bxf")}
            data-testid="bom-tab-blum-bxf"
            className={`px-3 py-1.5 rounded-xl transition cursor-pointer shrink-0 ${
              activeTab === "blum_bxf"
                ? "bg-[#141413] text-white font-bold shadow-2xs"
                : "text-[#57534E] hover:text-[#141413] hover:bg-[#EFECE4] font-semibold"
            }`}
          >
            Blum BXF &amp; EASYSTICK
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("selco")}
            className={`px-3 py-1.5 rounded-xl transition cursor-pointer shrink-0 inline-flex items-center gap-1 ${
              activeTab === "selco"
                ? "bg-[#141413] text-white font-bold shadow-2xs"
                : "text-[#57534E] hover:text-[#141413] hover:bg-[#EFECE4] font-semibold"
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Selco WNT 600</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("cnc_mpr_cix")}
            data-testid="bom-tab-cnc-mpr-cix"
            className={`px-3 py-1.5 rounded-xl transition cursor-pointer shrink-0 inline-flex items-center gap-1 ${
              activeTab === "cnc_mpr_cix"
                ? "bg-[#141413] text-white font-bold shadow-2xs"
                : "text-[#57534E] hover:text-[#141413] hover:bg-[#EFECE4] font-semibold"
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>CNC (.MPR / .CIX / .XCS)</span>
          </button>
        </div>

        {/* Main Scrollable Content */}
        <div className="flex-1 overflow-auto p-5 bg-[#FAF8F4] text-xs">
          {/* TAB 1: CUT LIST & DRILLING */}
          {activeTab === "cutlist" && (
            <div className="space-y-3.5">
              <div className="p-3.5 bg-white border border-[#E5DFD3] rounded-2xl shadow-2xs flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="font-bold text-[#141413] block">
                    AutoCAD / CNC Parça Kesim, Tambur Kanal &amp; Delik Çizimleri (.DXF — AC1015 / mm)
                  </span>
                  <span className="text-[11px] text-[#57534E]">
                    PANEL_CONTOUR, NET_CUT_CONTOUR, BACK_GROOVE_8MM, TAMBOUR_TRACK_W8_5_Z7_5, KERF_SLOTS ve System 32 delik katmanları ayrı ayrı üretilir.
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={downloadAllPanelsDXF}
                    className="px-3.5 py-2 rounded-xl bg-[#141413] hover:bg-stone-800 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-300" />
                    <span>Tüm Parçaları DXF İndir ({bom.cutList.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={downloadNestingSheetsDXF}
                    className="px-3.5 py-2 rounded-xl birim-ice-btn text-[#141413] font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-purple-700" />
                    <span>2800×2070 Plaka Şeması DXF</span>
                  </button>
                </div>
              </div>

              <div className="bg-white border border-[#E5DFD3] rounded-2xl shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-[#F4F0E8] text-[#57534E] uppercase tracking-wider text-[10.5px] border-b border-[#E5DFD3]">
                      <tr>
                        <th className="p-2.5 font-bold">Parça Adı / CNC İşlem</th>
                        <th className="p-2.5 font-bold">Modül</th>
                        <th className="p-2.5 font-bold">Malzeme</th>
                        <th className="p-2.5 text-right font-bold">Bitmiş (Boy×En)</th>
                        <th className="p-2.5 text-right font-bold">Testere Net (mm)</th>
                        <th className="p-2.5 text-right font-bold">Kalınlık</th>
                        <th className="p-2.5 text-center font-bold">Bant (Ü/A/S/Sa)</th>
                        <th className="p-2.5 text-center font-bold">CNC Delik</th>
                        <th className="p-2.5 text-right font-bold">Alan (m²)</th>
                        <th className="p-2.5 text-center font-bold">CAD</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#ECE7DC] font-mono text-[11px]">
                      {bom.cutList.map((p) => (
                        <tr key={p.id} className="hover:bg-[#FAF7F1] transition-colors">
                          <td className="p-2.5 font-sans">
                            <div className="font-bold text-[#141413]">{p.pieceName}</div>
                            <div className="flex flex-wrap items-center gap-1 mt-0.5">
                              <span className="text-[10px] text-[#78716C] font-mono">{p.id}</span>
                              {p.tambourTrackGrooveSpec && (
                                <span className="px-1.5 py-0.2 rounded bg-sky-100 border border-sky-300 text-sky-900 text-[9.5px] font-bold">
                                  Tambur Ray {p.tambourTrackGrooveSpec.widthMm}×{p.tambourTrackGrooveSpec.depthMm}mm
                                </span>
                              )}
                              {p.kerfBendingMeta && (
                                <span className="px-1.5 py-0.2 rounded bg-amber-100 border border-amber-300 text-amber-950 text-[9.5px] font-bold">
                                  CNC Kerf R{p.kerfBendingMeta.outerRadiusMm} ({p.kerfBendingMeta.kerfCount} çentik)
                                </span>
                              )}
                              {p.polygonContourMm && p.polygonContourMm.length > 4 && !p.tambourTrackGrooveSpec && (
                                <span className="px-1.5 py-0.2 rounded bg-purple-100 border border-purple-300 text-purple-900 text-[9.5px] font-bold">
                                  5-Eksen Kontur
                                </span>
                              )}
                              {p.hasBackGroove && (
                                <span className="px-1.5 py-0.2 rounded bg-stone-100 border border-stone-300 text-stone-700 text-[9.5px] font-semibold">
                                  8mm Kanal
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-2.5 text-[#57534E] font-sans">{p.moduleName}</td>
                          <td className="p-2.5 text-[#292524] font-sans font-medium">{p.materialName}</td>
                          <td className="p-2.5 text-right text-amber-900 font-bold">
                            {p.lengthMm} × {p.widthMm}
                          </td>
                          <td className="p-2.5 text-right text-emerald-800 font-bold">
                            {p.netCutLengthMm ?? p.lengthMm} × {p.netCutWidthMm ?? p.widthMm}
                          </td>
                          <td className="p-2.5 text-right text-[#44403C]">{p.thicknessMm}mm</td>
                          <td className="p-2.5 text-center">
                            <div className="flex justify-center gap-0.5 text-[9.5px] font-bold">
                              {(
                                [
                                  ["Ü", p.edgeBanding.top],
                                  ["A", p.edgeBanding.bottom],
                                  ["S", p.edgeBanding.left],
                                  ["Sa", p.edgeBanding.right],
                                ] as const
                              ).map(([lbl, on]) => (
                                <span
                                  key={lbl}
                                  className={`px-1.5 py-0.5 rounded ${
                                    on
                                      ? "bg-blue-700 text-white"
                                      : "bg-[#EFECE4] text-[#A8A29E]"
                                  }`}
                                >
                                  {lbl}
                                </span>
                              ))}
                            </div>
                            {p.edgeBandCode && (
                              <div className="text-[9.5px] text-[#78716C] mt-0.5 font-sans">
                                {p.edgeBandCode}
                              </div>
                            )}
                          </td>
                          <td className="p-2.5 text-center text-purple-800 font-bold">
                            {p.holes ? `${p.holes.length} delik` : "0"}
                          </td>
                          <td className="p-2.5 text-right text-[#44403C]">{p.areaM2}</td>
                          <td className="p-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => downloadPieceDXF(p)}
                              className="px-2 py-1 rounded-lg bg-[#F5F2EA] hover:bg-[#141413] text-[#141413] hover:text-white border border-[#DED8CC] text-[10px] font-sans font-bold transition cursor-pointer"
                              title={`${p.pieceName} için katmanlı AutoCAD DXF indir`}
                            >
                              DXF
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-[#F4F0E8] border-t border-[#E5DFD3] font-mono text-[11px] font-bold text-[#141413]">
                      <tr>
                        <td className="p-2.5 font-sans" colSpan={6}>
                          TOPLAM ({bom.summary.totalPiecesCount} Kesim Parçası • Kenar Bandı:{" "}
                          {bom.summary.totalEdgeBandMeters} mt)
                        </td>
                        <td className="p-2.5 text-center text-blue-800">
                          {bom.summary.totalEdgeBandMeters} mt
                        </td>
                        <td className="p-2.5 text-center text-purple-800">
                          {bom.summary.totalDrillingHolesCount} delik
                        </td>
                        <td className="p-2.5 text-right text-amber-900">
                          {bom.summary.totalPanelAreaM2} m²
                        </td>
                        <td className="p-2.5" />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: HARDWARE */}
          {activeTab === "hardware" && (
            <div className="bg-white border border-[#E5DFD3] rounded-2xl shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[#F4F0E8] text-[#57534E] uppercase tracking-wider text-[10.5px] border-b border-[#E5DFD3]">
                    <tr>
                      <th className="p-3 font-bold">SKU</th>
                      <th className="p-3 font-bold">Hırdavat &amp; Mekanizma Tanımı</th>
                      <th className="p-3 font-bold">Kategori</th>
                      <th className="p-3 text-right font-bold">Miktar</th>
                      <th className="p-3 text-right font-bold">Birim Fiyat (€)</th>
                      <th className="p-3 text-right font-bold">Toplam (€)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ECE7DC] font-mono text-[11.5px]">
                    {bom.hardwareList.map((hw) => (
                      <tr key={hw.sku} className="hover:bg-[#FAF7F1] transition-colors">
                        <td className="p-3 text-[#57534E] font-semibold">{hw.sku}</td>
                        <td className="p-3 font-sans font-bold text-[#141413]">{hw.name}</td>
                        <td className="p-3 font-sans text-[#57534E]">{hw.category}</td>
                        <td className="p-3 text-right text-emerald-800 font-bold">
                          {hw.quantity} {hw.unit}
                        </td>
                        <td className="p-3 text-right text-[#44403C]">
                          {(hw.unitPrice ?? 0).toFixed(2)}
                        </td>
                        <td className="p-3 text-right text-[#141413] font-extrabold">
                          {(hw.totalPrice ?? 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-[#F4F0E8] border-t border-[#E5DFD3] font-mono text-xs font-extrabold text-[#141413]">
                    <tr>
                      <td className="p-3 font-sans" colSpan={3}>
                        TOPLAM DONANIM &amp; HIRDAVAT PAKETİ ({bom.hardwareList.length} Kalem)
                      </td>
                      <td className="p-3 text-right text-emerald-800">
                        {bom.summary.totalHardwareCount} birim
                      </td>
                      <td className="p-3" />
                      <td className="p-3 text-right text-amber-900">
                        €{totalHardwareEur.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: BIRIM PORTAL ERP 2D NESTING ENGINE & EXPORTER */}
          {activeTab === "nesting" && erpNestingBundle && (
            <div className="space-y-4 text-xs">
              <div className="p-4 bg-white border border-[#E5DFD3] rounded-2xl shadow-2xs space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-[#141413] flex items-center gap-2">
                      <BirimLogo className="h-4 w-auto text-[#141413]" />
                      <span>Portal ERP — CNC Panel Nesting &amp; Kesim Motoru</span>
                      <span className="px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-900 font-mono text-[10px]">
                        {erpNestingBundle.schema_version}
                      </span>
                    </h3>
                    <p className="text-[#57534E] mt-0.5">
                      ERP <code>nesting_projects</code>, <code>nesting_sheets</code>,{" "}
                      <code>nesting_parts</code> (U1/U2/K1/K2 PVC + Arkalık Kanalı JSON) ve{" "}
                      <code>nesting_placements</code> ile birebir aynı algoritma ve şema
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={downloadErpNestingJson}
                      className="px-3 py-1.5 rounded-xl bg-[#141413] hover:bg-stone-800 text-white font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-amber-300" />
                      ERP (.json)
                    </button>
                    <button
                      type="button"
                      onClick={downloadErpSelcoCsv}
                      className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      ERP Selco WNT 600 (.csv)
                    </button>
                    <button
                      type="button"
                      onClick={downloadErpCncGCode}
                      className="px-3 py-1.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <FileCode className="w-3.5 h-3.5" />
                      ERP CNC G-Code (.nc)
                    </button>
                  </div>
                </div>

                {/* Interactive ERP Optimization Parameters */}
                <div className="grid grid-cols-2 md:grid-cols-6 gap-2.5 pt-2.5 border-t border-[#ECE7DC]">
                  <div className="space-y-1">
                    <span className="text-[10px] text-[#78716C] uppercase font-bold block">
                      Algoritma
                    </span>
                    <V3PremiumDropdown
                      variant="popover"
                      size="sm"
                      value={erpAlgorithm}
                      onChange={(val) =>
                        setErpAlgorithm(val as "Auto" | "Guillotine" | "MaxRects")
                      }
                      options={[
                        { value: "Auto", label: "Auto (ERP)" },
                        { value: "Guillotine", label: "Guillotine" },
                        { value: "MaxRects", label: "MaxRects (CNC)" },
                      ]}
                    />
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] text-[#78716C] uppercase font-bold block">
                      Plaka Ebadı
                    </span>
                    <V3PremiumDropdown
                      variant="popover"
                      size="sm"
                      value={String(erpSheetHeight)}
                      onChange={(val) => setErpSheetHeight(Number(val) as 2100 | 2070)}
                      options={[
                        { value: "2100", label: "2800 × 2100 mm" },
                        { value: "2070", label: "2800 × 2070 mm" },
                      ]}
                    />
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] text-[#78716C] uppercase font-bold block">
                      Bıçak Payı (Kerf)
                    </span>
                    <V3PremiumDropdown
                      variant="popover"
                      size="sm"
                      value={String(erpKerf)}
                      onChange={(val) => setErpKerf(Number(val))}
                      options={[
                        { value: "4", label: "4.0 mm (ERP)" },
                        { value: "4.4", label: "4.4 mm (Selco)" },
                        { value: "3.5", label: "3.5 mm" },
                        { value: "6", label: "6.0 mm (Freze)" },
                      ]}
                    />
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] text-[#78716C] uppercase font-bold block">
                      Kenar Tıraş
                    </span>
                    <V3PremiumDropdown
                      variant="popover"
                      size="sm"
                      value={String(erpMargin)}
                      onChange={(val) => setErpMargin(Number(val))}
                      options={[
                        { value: "15", label: "15 mm" },
                        { value: "10", label: "10 mm (ERP)" },
                        { value: "20", label: "20 mm" },
                      ]}
                    />
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] text-[#78716C] uppercase font-bold block">
                      Ölçü Bazı
                    </span>
                    <V3PremiumDropdown
                      variant="popover"
                      size="sm"
                      value={erpUseNetCut ? "net" : "nominal"}
                      onChange={(val) => setErpUseNetCut(val === "net")}
                      options={[
                        { value: "net", label: "Net Kesim" },
                        { value: "nominal", label: "Anma Ölçü" },
                      ]}
                    />
                  </div>

                  <div className="flex flex-col justify-end gap-1.5">
                    <label className="flex items-center gap-1.5 text-[#44403C] font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={erpCommonCut}
                        onChange={(e) => setErpCommonCut(e.target.checked)}
                        className="rounded border-[#C7BCAE]"
                      />
                      <span>Ortak Kesim (Kerf=0)</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-[#44403C] font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showCutSequences}
                        onChange={(e) => setShowCutSequences(e.target.checked)}
                        className="rounded border-[#C7BCAE]"
                      />
                      <span>Kesim Sırası Çizgileri</span>
                    </label>
                  </div>
                </div>

                {/* Live ERP Summary KPIs + Color Legend */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-[#ECE7DC] text-[11px]">
                  <div className="flex flex-wrap items-center gap-4 font-mono text-[#44403C]">
                    <span>
                      İş Emri Grubu:{" "}
                      <strong className="text-[#141413]">
                        {erpNestingBundle.summary.board_groups_count}
                      </strong>
                    </span>
                    <span>
                      Toplam Plaka:{" "}
                      <strong className="text-amber-800">
                        {erpNestingBundle.summary.total_sheets_used} adet
                      </strong>
                    </span>
                    <span>
                      Yerleşen Parça:{" "}
                      <strong className="text-emerald-800">
                        {erpNestingBundle.summary.total_parts_placed}/
                        {erpNestingBundle.summary.total_parts_requested}
                      </strong>
                    </span>
                    <span>
                      Genel Verim:{" "}
                      <strong className="text-indigo-800">
                        %{erpNestingBundle.summary.overall_utilization_percent}
                      </strong>
                    </span>
                    <span>
                      Artık Plaka (≥400×400):{" "}
                      <strong className="text-cyan-800">
                        {erpNestingBundle.summary.reclaimable_remnants_count} adet (
                        {erpNestingBundle.summary.reclaimable_remnants_area_m2} m²)
                      </strong>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-[10.5px] font-semibold">
                    <span className="inline-flex items-center gap-1 text-rose-800">
                      <span className="w-2.5 h-1.5 bg-rose-500 inline-block rounded" /> 2.0mm PVC
                    </span>
                    <span className="inline-flex items-center gap-1 text-amber-800">
                      <span className="w-2.5 h-1.5 bg-amber-500 inline-block rounded" /> 1.0mm PVC
                    </span>
                    <span className="inline-flex items-center gap-1 text-cyan-800">
                      <span className="w-2.5 h-1.5 bg-cyan-500 inline-block rounded" /> 0.4mm PVC
                    </span>
                    <span className="inline-flex items-center gap-1 text-sky-800">
                      <span className="w-3 border-b-2 border-dashed border-sky-600 inline-block" />{" "}
                      Arkalık Kanalı
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowErpContractPreview((v) => !v)}
                      className="px-2.5 py-1 rounded-lg bg-[#F5F2EA] hover:bg-[#EAE5D9] text-[#141413] border border-[#D8D1C4] font-bold cursor-pointer"
                    >
                      {showErpContractPreview ? "JSON Sözleşmeyi Gizle" : "ERP API / DB Önizleme"}
                    </button>
                  </div>
                </div>
              </div>

              {showErpContractPreview && (
                <div className="p-4 rounded-2xl bg-white border border-[#E5DFD3] space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-[#141413]">
                      Canlı Birim ERP API &amp; Supabase <code>nesting_parts</code> /{" "}
                      <code>nesting_projects</code> JSON Sözleşmesi
                    </span>
                    <span className="text-[10px] font-mono text-[#78716C]">
                      POST /api/nesting/sheets → POST /api/nesting → POST /api/nesting/:id/parts →
                      POST /api/nesting/:id/optimize
                    </span>
                  </div>
                  <pre className="max-h-60 overflow-auto p-3 rounded-xl bg-[#1E1D1B] text-[#F5F2EA] text-[10.5px] font-mono">
                    {JSON.stringify(
                      erpNestingBundle.jobs.map((j) => ({
                        project_no: j.project_record.project_no,
                        source_type: j.project_record.source_type,
                        source_ref: j.project_record.source_ref,
                        sheet_input: j.sheet_input,
                        parts_count: j.part_inputs.length,
                        sample_parts: j.part_inputs.slice(0, 4),
                        sheets_used: j.optimization_result.sheets.length,
                        algorithm_selected: j.optimization_result.algorithm,
                        utilization_percent: j.optimization_result.overall_utilization,
                      })),
                      null,
                      2
                    )}
                  </pre>
                </div>
              )}

              {/* Render Each Material/Thickness ERP Nesting Job */}
              {erpNestingBundle.jobs.map((job) => {
                const sheetW = job.sheet_record.width_mm;
                const sheetH = job.sheet_record.height_mm;
                const margin = job.sheet_record.edge_margin_mm;
                const getBandColor = (tape?: string) => {
                  if (!tape) return null;
                  const cl = tape.toLowerCase();
                  if (cl.includes("2")) return "#F43F5E";
                  if (cl.includes("1")) return "#F59E0B";
                  if (cl.includes("0.4")) return "#06B6D4";
                  return "#10B981";
                };

                return (
                  <div
                    key={job.group_key}
                    className="space-y-3.5 p-4 rounded-2xl bg-white border border-[#E5DFD3] shadow-2xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#ECE7DC] pb-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="px-2.5 py-0.5 rounded-lg bg-[#141413] text-amber-300 font-mono font-bold text-[11px]">
                          {job.project_record.project_no}
                        </span>
                        <h3 className="font-extrabold text-[#141413] text-sm">
                          {job.material_name} ({job.thickness_mm}mm)
                        </h3>
                        <span className="px-2 py-0.5 rounded-md bg-[#F4F0E8] border border-[#E5DFD3] text-[#57534E] font-mono text-[10px]">
                          {job.sheet_input.material_type}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-4 text-xs font-mono text-[#57534E]">
                        <span>
                          Algoritma:{" "}
                          <strong className="text-indigo-800">
                            {job.optimization_result.algorithm}
                          </strong>
                        </span>
                        <span>
                          Plaka:{" "}
                          <strong className="text-amber-800">
                            {job.optimization_result.sheets.length} adet
                          </strong>
                        </span>
                        <span>
                          Parça:{" "}
                          <strong className="text-[#141413]">
                            {job.optimization_result.total_parts_placed}/
                            {job.optimization_result.total_parts_requested}
                          </strong>
                        </span>
                        <span>
                          Doluluk:{" "}
                          <strong className="text-emerald-800">
                            %{job.optimization_result.overall_utilization}
                          </strong>
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {job.optimization_result.sheets.map((sheet) => {
                        const sheetRemnants = job.reclaimable_remnants.filter(
                          (rm) => rm.sheet_index === sheet.sheet_index
                        );
                        const globalSvgIdx = sheet.sheet_index + 1;
                        return (
                          <div
                            key={sheet.sheet_index}
                            className="p-3.5 bg-[#FAF8F4] rounded-2xl border border-[#E5DFD3] space-y-2.5"
                          >
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-bold text-[#141413]">
                                Plaka #{sheet.sheet_index + 1} ({sheetW}×{sheetH} mm)
                              </span>
                              <div className="flex items-center gap-3 font-mono text-[11px] font-bold">
                                {sheetRemnants.length > 0 && (
                                  <span className="text-cyan-800">
                                    Artık: {sheetRemnants.length} adet
                                  </span>
                                )}
                                <span className="text-emerald-800">
                                  Verim: %{sheet.utilization_percent}
                                </span>
                              </div>
                            </div>

                            {/* High-contrast CNC Sheet Blueprint Canvas */}
                            <div className="relative w-full bg-[#0F172A] border border-slate-700 rounded-xl overflow-hidden p-1.5">
                              <svg
                                data-testid={`bom-nesting-svg-sheet-${globalSvgIdx}`}
                                viewBox={`-110 -85 ${sheetW + 200} ${sheetH + 160}`}
                                className="w-full h-auto block select-none"
                              >
                                <defs>
                                  <pattern
                                    id={`waste_hatch_${job.job_index}_${sheet.sheet_index}`}
                                    width="40"
                                    height="40"
                                    patternTransform="rotate(45 0 0)"
                                    patternUnits="userSpaceOnUse"
                                  >
                                    <line
                                      x1="0"
                                      y1="0"
                                      x2="0"
                                      y2="40"
                                      stroke="#334155"
                                      strokeWidth="6"
                                    />
                                  </pattern>
                                </defs>

                                <rect
                                  x={0}
                                  y={0}
                                  width={sheetW}
                                  height={sheetH}
                                  fill={`url(#waste_hatch_${job.job_index}_${sheet.sheet_index})`}
                                  stroke="#64748B"
                                  strokeWidth="8"
                                />
                                <rect
                                  x={margin}
                                  y={margin}
                                  width={sheetW - 2 * margin}
                                  height={sheetH - 2 * margin}
                                  fill="#0F172A"
                                  stroke="#475569"
                                  strokeWidth="4"
                                  strokeDasharray="24 14"
                                />

                                <line
                                  x1={0}
                                  y1={-32}
                                  x2={sheetW}
                                  y2={-32}
                                  stroke="#94A3B8"
                                  strokeWidth="4"
                                />
                                {[0, 700, 1400, 2100, sheetW].map((tx) => (
                                  <g key={`rx_${tx}`}>
                                    <line
                                      x1={tx}
                                      y1={-48}
                                      x2={tx}
                                      y2={-16}
                                      stroke="#94A3B8"
                                      strokeWidth="4"
                                    />
                                    <text
                                      x={tx}
                                      y={-54}
                                      textAnchor="middle"
                                      fill="#CBD5E1"
                                      fontSize="40"
                                      fontWeight="800"
                                      fontFamily="monospace"
                                    >
                                      {tx}
                                    </text>
                                  </g>
                                ))}

                                <line
                                  x1={-32}
                                  y1={0}
                                  x2={-32}
                                  y2={sheetH}
                                  stroke="#94A3B8"
                                  strokeWidth="4"
                                />
                                {[0, 500, 1000, 1500, sheetH].map((ty) => (
                                  <g key={`ry_${ty}`}>
                                    <line
                                      x1={-48}
                                      y1={ty}
                                      x2={-16}
                                      y2={ty}
                                      stroke="#94A3B8"
                                      strokeWidth="4"
                                    />
                                    <text
                                      x={-56}
                                      y={ty + 14}
                                      textAnchor="end"
                                      fill="#CBD5E1"
                                      fontSize="38"
                                      fontWeight="800"
                                      fontFamily="monospace"
                                    >
                                      {ty}
                                    </text>
                                  </g>
                                ))}

                                {sheetRemnants.map((rm) => (
                                  <g key={`rem_${rm.remnant_index}`}>
                                    <rect
                                      x={margin + rm.x_mm}
                                      y={margin + rm.y_mm}
                                      width={rm.width_mm}
                                      height={rm.height_mm}
                                      fill="rgba(16, 185, 129, 0.14)"
                                      stroke="#10B981"
                                      strokeWidth="5"
                                      strokeDasharray="18 10"
                                    />
                                    {rm.width_mm >= 400 && rm.height_mm >= 350 && (
                                      <text
                                        x={margin + rm.x_mm + rm.width_mm / 2}
                                        y={margin + rm.y_mm + rm.height_mm / 2}
                                        textAnchor="middle"
                                        fill="#6EE7B7"
                                        fontSize="36"
                                        fontWeight="800"
                                        fontFamily="monospace"
                                      >
                                        {`ARTIK ${Math.round(rm.width_mm)}×${Math.round(rm.height_mm)}`}
                                      </text>
                                    )}
                                  </g>
                                ))}

                                {sheet.placements.map((pl) => {
                                  const pw = Math.max(40, pl.width);
                                  const ph = Math.max(40, pl.height);
                                  const cx = pl.x + pw / 2;
                                  const cy = pl.y + ph / 2;
                                  const rot = (pl.rotation || (pl.rotated ? 90 : 0)) % 360;
                                  const cU1 = getBandColor(pl.edgeL1);
                                  const cU2 = getBandColor(pl.edgeL2);
                                  const cK1 = getBandColor(pl.edgeW1);
                                  const cK2 = getBandColor(pl.edgeW2);
                                  const visEdges =
                                    rot === 90
                                      ? { top: cK1, bottom: cK2, left: cU2, right: cU1 }
                                      : rot === 180
                                      ? { top: cU2, bottom: cU1, left: cK2, right: cK1 }
                                      : rot === 270
                                      ? { top: cK2, bottom: cK1, left: cU1, right: cU2 }
                                      : { top: cU1, bottom: cU2, left: cK1, right: cK2 };

                                  const adjGrooveSide = pl.hasGroove
                                    ? adjustErpGrooveSideForRotation(pl.grooveSide || "Alt", rot)
                                    : "";
                                  const gOff = pl.grooveOffset ?? 20;
                                  const fontTitle = Math.max(
                                    24,
                                    Math.min(
                                      44,
                                      Math.floor(pw / Math.max(6, pl.part_label.length * 0.58))
                                    )
                                  );
                                  const fontDim = Math.max(22, Math.min(38, Math.floor(pw / 8.5)));

                                  return (
                                    <g key={pl.part_id}>
                                      <rect
                                        x={pl.x}
                                        y={pl.y}
                                        width={pw}
                                        height={ph}
                                        rx={4}
                                        fill={pl.color || "#3B82F6"}
                                        fillOpacity={0.82}
                                        stroke="#0F172A"
                                        strokeWidth="4"
                                      />
                                      {visEdges.top && (
                                        <line
                                          x1={pl.x + 3}
                                          y1={pl.y + 5}
                                          x2={pl.x + pw - 3}
                                          y2={pl.y + 5}
                                          stroke={visEdges.top}
                                          strokeWidth="10"
                                        />
                                      )}
                                      {visEdges.bottom && (
                                        <line
                                          x1={pl.x + 3}
                                          y1={pl.y + ph - 5}
                                          x2={pl.x + pw - 3}
                                          y2={pl.y + ph - 5}
                                          stroke={visEdges.bottom}
                                          strokeWidth="10"
                                        />
                                      )}
                                      {visEdges.left && (
                                        <line
                                          x1={pl.x + 5}
                                          y1={pl.y + 3}
                                          x2={pl.x + 5}
                                          y2={pl.y + ph - 3}
                                          stroke={visEdges.left}
                                          strokeWidth="10"
                                        />
                                      )}
                                      {visEdges.right && (
                                        <line
                                          x1={pl.x + pw - 5}
                                          y1={pl.y + 3}
                                          x2={pl.x + pw - 5}
                                          y2={pl.y + ph - 3}
                                          stroke={visEdges.right}
                                          strokeWidth="10"
                                        />
                                      )}

                                      {pl.hasGroove && (
                                        <line
                                          x1={
                                            adjGrooveSide === "Sol"
                                              ? pl.x + gOff
                                              : adjGrooveSide === "Sağ"
                                              ? pl.x + pw - gOff
                                              : pl.x + 8
                                          }
                                          y1={
                                            adjGrooveSide === "Üst"
                                              ? pl.y + gOff
                                              : adjGrooveSide === "Alt"
                                              ? pl.y + ph - gOff
                                              : pl.y + 8
                                          }
                                          x2={
                                            adjGrooveSide === "Sol"
                                              ? pl.x + gOff
                                              : adjGrooveSide === "Sağ"
                                              ? pl.x + pw - gOff
                                              : pl.x + pw - 8
                                          }
                                          y2={
                                            adjGrooveSide === "Üst"
                                              ? pl.y + gOff
                                              : adjGrooveSide === "Alt"
                                              ? pl.y + ph - gOff
                                              : pl.y + ph - 8
                                          }
                                          stroke="#67E8F9"
                                          strokeWidth="6"
                                          strokeDasharray="16 10"
                                        />
                                      )}

                                      {pw >= 120 && ph >= 80 && (
                                        <>
                                          <text
                                            x={cx}
                                            y={cy - 4}
                                            textAnchor="middle"
                                            fill="#FFFFFF"
                                            fontSize={fontTitle}
                                            fontWeight="900"
                                            fontFamily="sans-serif"
                                          >
                                            {pl.part_label.slice(0, 22)}
                                          </text>
                                          <text
                                            x={cx}
                                            y={cy + fontDim + 6}
                                            textAnchor="middle"
                                            fill="#FEF08A"
                                            fontSize={fontDim}
                                            fontWeight="800"
                                            fontFamily="monospace"
                                          >
                                            {`${Math.round(pl.width)}×${Math.round(pl.height)}${pl.rotated ? " ↻" : ""}`}
                                          </text>
                                        </>
                                      )}
                                    </g>
                                  );
                                })}

                                {showCutSequences &&
                                  (sheet.sequences || []).map((seq, sqIdx) => (
                                    <line
                                      key={`seq_${sqIdx}`}
                                      x1={seq.x1}
                                      y1={seq.y1}
                                      x2={seq.x2}
                                      y2={seq.y2}
                                      stroke={seq.isTraversal ? "#38BDF8" : "#F43F5E"}
                                      strokeWidth={seq.isTraversal ? "4" : "5.5"}
                                      strokeDasharray={seq.isTraversal ? "14 10" : "22 10"}
                                      opacity={0.85}
                                    />
                                  ))}
                              </svg>
                            </div>

                            {sheet.cuttingInstructions && sheet.cuttingInstructions.length > 0 && (
                              <details className="rounded-xl bg-white border border-[#E5DFD3] p-2.5">
                                <summary className="cursor-pointer font-bold text-[#141413] text-[11px]">
                                  🪚 Ebatlama Operatör Kesim Reçetesi ({sheet.placements.length}{" "}
                                  Parça Kesim Adımı)
                                </summary>
                                <pre className="mt-2 max-h-40 overflow-auto text-[10px] font-mono text-[#44403C] whitespace-pre-wrap">
                                  {sheet.cuttingInstructions.join("\n")}
                                </pre>
                              </details>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 4: FACTORY VALIDATION GATE & SHELF DEFLECTION */}
          {activeTab === "validation" && (
            <div className="space-y-5">
              <div className="space-y-3">
                <h3 className="font-extrabold text-[#141413] text-sm">
                  6 Aşamalı Deterministik Üretim Doğrulama Kapısı (Fail-Closed Gate)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {gateChecks.map((chk) => (
                    <div
                      key={chk.id}
                      className={`p-3.5 rounded-2xl border ${
                        chk.passed
                          ? "bg-emerald-50/75 border-emerald-300 text-emerald-950"
                          : "bg-amber-50/90 border-amber-300 text-amber-950"
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold text-xs mb-1">
                        <span>{chk.label}</span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                            chk.passed
                              ? "bg-emerald-700 text-white"
                              : "bg-amber-700 text-white"
                          }`}
                        >
                          {chk.passed ? "GEÇTİ (PASS)" : "KİLİTLİ (HOLD)"}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#44403C] leading-relaxed">{chk.detail}</p>
                    </div>
                  ))}
                </div>
              </div>

              {shelfDeflections.length > 0 && (
                <div className="space-y-2.5">
                  <h3 className="font-extrabold text-[#141413] text-sm">
                    ISO 7170 Euler-Bernoulli Fiziksel Raf Sehim (Esneme) Analizi
                  </h3>
                  <div className="bg-white border border-[#E5DFD3] rounded-2xl shadow-2xs overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-[#F4F0E8] text-[#57534E] uppercase tracking-wider text-[10.5px] border-b border-[#E5DFD3]">
                        <tr>
                          <th className="p-2.5 font-bold">Modül / Bölme</th>
                          <th className="p-2.5 text-right font-bold">Açıklık (L)</th>
                          <th className="p-2.5 text-right font-bold">Derinlik (D)</th>
                          <th className="p-2.5 text-right font-bold">Kalınlık (T)</th>
                          <th className="p-2.5 text-right font-bold">Hesaplanan Sehim</th>
                          <th className="p-2.5 text-right font-bold">L/300 Sınırı</th>
                          <th className="p-2.5 text-center font-bold">Durum</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#ECE7DC] font-mono text-[11px]">
                        {shelfDeflections.map((sd, idx) => (
                          <tr key={`${sd.moduleId}_${sd.bayIndex}_${idx}`} className="hover:bg-[#FAF7F1]">
                            <td className="p-2.5 font-sans font-bold text-[#141413]">
                              {sd.moduleName} — Bölme {sd.bayIndex + 1}
                            </td>
                            <td className="p-2.5 text-right text-[#44403C]">{sd.spanMm} mm</td>
                            <td className="p-2.5 text-right text-[#44403C]">{sd.depthMm} mm</td>
                            <td className="p-2.5 text-right text-[#44403C]">{sd.thicknessMm} mm</td>
                            <td className="p-2.5 text-right font-bold text-amber-800">
                              {sd.deflectionMm} mm
                            </td>
                            <td className="p-2.5 text-right text-[#78716C]">{sd.maxAllowedMm} mm</td>
                            <td className="p-2.5 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                  sd.passed
                                    ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                                    : "bg-red-100 text-red-900 border border-red-300"
                                }`}
                              >
                                {sd.passed ? "UYGUN" : "SEHİM AŞIMI"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: ASSEMBLY INSTRUCTIONS */}
          {activeTab === "assembly" && (
            <div className="space-y-3.5 max-w-4xl">
              <p className="text-[#57534E] font-medium">
                Fabrikada ebatlanan, kenar bantlanan ve CNC delik/kanal operasyonları açılan panellerin sahada kurulum sırası:
              </p>
              <div className="space-y-2.5">
                {assemblySteps.map((st) => (
                  <div
                    key={st.stepNumber}
                    className="p-4 rounded-2xl bg-white border border-[#E5DFD3] shadow-2xs space-y-2"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-[#141413] text-amber-300 font-mono font-black text-xs flex items-center justify-center">
                        {st.stepNumber}
                      </span>
                      <h4 className="font-extrabold text-[#141413] text-xs">{st.title}</h4>
                    </div>
                    <p className="text-[#44403C] leading-relaxed pl-8">{st.description}</p>
                    <div className="pl-8 pt-1 flex flex-wrap gap-1.5 text-[11px]">
                      <span className="text-[#78716C] font-semibold">Parçalar:</span>
                      {st.requiredParts.map((p, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-lg bg-[#FAF8F4] text-[#141413] border border-[#E5DFD3] font-medium"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                    {st.safetyNotes && (
                      <div className="pl-8 text-amber-900 text-[11px] flex items-center gap-1.5 pt-1 font-medium">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                        <span>{st.safetyNotes}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 6: SELCO WNT 600 POSTPROCESSOR */}
          {activeTab === "selco" && (
            <div className="space-y-4">
              <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-amber-950 font-extrabold">
                  <ShieldAlert className="w-5 h-5 text-amber-700" />
                  <span>Biesse Selco WNT 600 Postprocessor (Teknik Uyarı)</span>
                </div>
                <p className="text-amber-950/90 text-xs leading-relaxed">
                  Gerçek üretim dosyası oluşturulmadan önce fabrika şefi ve Selco OptiPlanning operatörü tarafından takım ve bıçak parametreleri onaylanmalıdır.
                </p>
                {selcoPackage?.unverifiedNotes.map((note, idx) => (
                  <div key={idx} className="text-amber-900 text-xs font-mono">
                    • {note}
                  </div>
                ))}
              </div>

              {selcoPackage && (
                <div className="space-y-2">
                  <h4 className="font-bold text-[#141413]">
                    Üretim XML Çıktı Taslağı ({selcoPackage.batchId}):
                  </h4>
                  <pre className="p-4 rounded-2xl bg-[#1E1D1B] text-[#F5F2EA] text-[11px] font-mono overflow-x-auto max-h-80">
                    {selcoPackage.xmlOutputDraft}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* TAB 8: BLUM BXF & EASYSTICK (MINIPRESS / E-SERVICES) */}
          {activeTab === "blum_bxf" && (
            <div data-testid="bom-blum-bxf-panel" className="space-y-4 text-xs">
              <div className="p-4 rounded-2xl bg-white border border-[#E5DFD3] shadow-2xs flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-extrabold text-[#1D4ED8]">
                    BLUM GÖVDE TASARLAYICI &amp; BXF / EASYSTICK ÜRETİM PAKETİ
                  </h3>
                  <p className="text-[#57534E] mt-0.5">
                    KB/KH/KT Dış Ölçüler • LW/LH/LT Net İç Ölçüler • Kapak Ağırlığı (kg) &amp; AVENTOS Güç Faktörü (LF) • LEGRABOX/TANDEMBOX Kesim Formülleri • MINIPRESS EASYSTICK Delik Matrisi
                  </p>
                </div>
                <button
                  type="button"
                  onClick={downloadBlumBxf}
                  className="px-4 py-2 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold cursor-pointer"
                >
                  🟦 Blum .BXF Dosyasını İndir (EASYSTICK / CAD)
                </button>
              </div>

              {blumCabinetSummaries.map((cab, cIdx) => (
                <div
                  key={cab.moduleId}
                  className="p-4 rounded-2xl bg-white border border-[#E5DFD3] shadow-2xs space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#ECE7DC] pb-2.5">
                    <div>
                      <span className="font-extrabold text-[#141413] text-sm">
                        {cIdx + 1}. {cab.moduleName} ({cab.moduleId})
                      </span>
                      <div className="text-[11px] font-mono text-[#57534E] mt-0.5">
                        Dış (KB×KH×KT):{" "}
                        <strong className="text-amber-800">
                          {cab.outerDimensions.KB} × {cab.outerDimensions.KH} ×{" "}
                          {cab.outerDimensions.KT} mm
                        </strong>{" "}
                        • Net İç (LW×LH×LT):{" "}
                        <strong className="text-emerald-800">
                          {cab.innerDimensions.LW} × {cab.innerDimensions.LH} ×{" "}
                          {cab.innerDimensions.LT} mm
                        </strong>{" "}
                        • Panel: {cab.panelThicknessMm}mm • Derz (Fuge): {cab.frontGapFugeMm}mm
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        cab.collisionFree
                          ? "bg-emerald-50 text-emerald-900 border border-emerald-300"
                          : "bg-amber-50 text-amber-950 border border-amber-300"
                      }`}
                    >
                      {cab.collisionFree ? "✓ BLUM ÇAKIŞMA KONTROLÜ: UYGUN" : "⚠ UYARI MEVCUT"}
                    </span>
                  </div>

                  {cab.collisionWarnings.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 space-y-1">
                      {cab.collisionWarnings.map((w, wi) => (
                        <div key={wi}>• {w}</div>
                      ))}
                    </div>
                  )}

                  {cab.doors.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="font-bold text-[#57534E] text-[10.5px] uppercase tracking-wider">
                        Kapak Ağırlığı, CLIP top BLUMOTION Menteşe &amp; AVENTOS Güç Faktörü (LF = KH × kg)
                      </div>
                      <div className="border border-[#ECE7DC] rounded-xl overflow-hidden">
                        <table className="w-full text-left border-collapse font-mono text-[11px]">
                          <thead className="bg-[#F4F0E8] text-[#57534E]">
                            <tr>
                              <th className="p-2">Bölme</th>
                              <th className="p-2">Kapak Ölçüsü</th>
                              <th className="p-2">Ağırlık (kg)</th>
                              <th className="p-2">Menteşe Adedi &amp; Kodu</th>
                              <th className="p-2">Delik Şablonu</th>
                              <th className="p-2">AVENTOS LF &amp; Öneri</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#ECE7DC]">
                            {cab.doors.map((d) => (
                              <tr key={d.bayIndex}>
                                <td className="p-2 text-[#141413] font-bold">Bölme {d.bayIndex + 1}</td>
                                <td className="p-2 text-amber-900">
                                  {d.doorWidthMm}×{d.doorHeightMm}×{d.doorThicknessMm} mm
                                </td>
                                <td className="p-2 text-emerald-800 font-bold">
                                  {d.estimatedWeightKg} kg
                                </td>
                                <td className="p-2 text-[#292524]">
                                  {d.recommendedHingeCount}× {d.hingeSku} + {d.mountingPlateSku}
                                </td>
                                <td className="p-2 text-[#57534E]">{d.cupDrillingPattern}</td>
                                <td className="p-2 text-blue-800 font-semibold">
                                  LF={d.aventosPowerFactorLf} •{" "}
                                  {d.recommendedAventosModel || "Menteşeli"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {cab.drawers.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="font-bold text-[#57534E] text-[10.5px] uppercase tracking-wider">
                        Çekmece Ahşap Kesim Ölçüleri (Taban &amp; Arkalık) ve EASYSTICK Ray Delik Eksenleri
                      </div>
                      <div className="border border-[#ECE7DC] rounded-xl overflow-hidden">
                        <table className="w-full text-left border-collapse font-mono text-[11px]">
                          <thead className="bg-[#F4F0E8] text-[#57534E]">
                            <tr>
                              <th className="p-2">Bölme</th>
                              <th className="p-2">Blum Sistem &amp; Ray SKU</th>
                              <th className="p-2">NL / LW</th>
                              <th className="p-2">Ahşap Taban Kesim</th>
                              <th className="p-2">Ahşap Arkalık Kesim</th>
                              <th className="p-2">EASYSTICK Yan Delik X (mm)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#ECE7DC]">
                            {cab.drawers.map((drw) => (
                              <tr key={drw.drawerId}>
                                <td className="p-2 text-[#141413] font-bold">
                                  Bölme {drw.bayIndex + 1}
                                </td>
                                <td className="p-2 text-[#292524]">
                                  {drw.systemName} [{drw.runnerSku}]
                                </td>
                                <td className="p-2 text-amber-900">
                                  NL:{drw.nominalLengthNlMm} / LW:{drw.netInnerWidthLwMm}
                                </td>
                                <td className="p-2 text-emerald-800 font-bold">
                                  {drw.woodenBottomWidthMm} × {drw.woodenBottomDepthMm} mm (16mm)
                                </td>
                                <td className="p-2 text-emerald-800 font-bold">
                                  {drw.woodenBackWidthMm} × {drw.woodenBackHeightMm} mm (16mm)
                                </td>
                                <td className="p-2 text-purple-800">
                                  Y:{drw.easystickElevationYMm}mm → X:[
                                  {drw.easystickSideHoleXCoordsMm.join(", ")}]
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              <div className="space-y-2">
                <h4 className="font-bold text-[#141413]">
                  Canlı Blum Exchange Format (.BXF / XML) Çıktı Önizlemesi:
                </h4>
                <pre className="p-4 rounded-2xl bg-[#1E1D1B] text-[#F5F2EA] text-[11px] font-mono overflow-x-auto max-h-64">
                  {blumBxfXml}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 7: CUSTOMER QUOTE & PRESENTATION SHEET */}
          {activeTab === "quote" && (
            <div data-testid="bom-quote-panel" className="space-y-4 text-xs">
              <div className="p-4 rounded-2xl bg-white border border-[#E5DFD3] shadow-2xs flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-extrabold text-[#141413]">
                    BİRİM MOBİLYA — KURUMSAL MÜŞTERİ TEKLİF &amp; TEKNİK SUNUM FÖYÜ
                  </h3>
                  <p className="text-[#57534E] mt-0.5">
                    Proje: {project.title} • {project.modules.length} Modül • Toplam Levha:{" "}
                    {bom.summary.totalPanelAreaM2} m² • Kenar Bandı:{" "}
                    {bom.summary.totalEdgeBandMeters} mt
                  </p>
                </div>
                <button
                  type="button"
                  onClick={downloadCustomerQuoteHtml}
                  className="px-4 py-2 rounded-xl birim-ice-charcoal-pill font-bold cursor-pointer"
                >
                  📄 Yazdırılabilir Teklif Föyünü İndir (.HTML)
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-white border border-[#E5DFD3] shadow-2xs space-y-2">
                  <h4 className="font-bold text-[#57534E] uppercase tracking-wider text-[11px]">
                    1. Modül ve Seçilen Levha Dekorları
                  </h4>
                  <div className="divide-y divide-[#ECE7DC]">
                    {project.modules.map((m, idx) => (
                      <div key={m.id} className="py-2.5 flex items-center justify-between gap-2">
                        <div>
                          <div className="font-bold text-[#141413]">
                            {idx + 1}. {m.name}
                          </div>
                          <div className="text-[11px] text-[#78716C] font-mono">
                            Gövde: {m.carcass.bodyMaterialId} • Kapak: {m.carcass.doorMaterialId}
                          </div>
                        </div>
                        <span className="font-mono font-bold text-amber-900 shrink-0">
                          {m.dimensions.width}×{m.dimensions.height}×{m.dimensions.depth} mm
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-[#E5DFD3] shadow-2xs space-y-3">
                  <h4 className="font-bold text-[#57534E] uppercase tracking-wider text-[11px]">
                    2. Maliyet ve Satış Teklif Kırılımı
                  </h4>
                  <div className="space-y-2 font-mono text-[#292524]">
                    <div className="flex justify-between">
                      <span className="font-sans text-[#57534E]">Ahşap / Levha Maliyeti:</span>
                      <span className="font-bold">
                        €{(pricing.materialCost ?? (pricing as any).materialCostEur ?? 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-sans text-[#57534E]">
                        Kenar Bandı (PVC/ABS) Maliyeti:
                      </span>
                      <span className="font-bold">
                        €{(pricing.edgeBandCost ?? (pricing as any).edgeBandCostEur ?? 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-sans text-[#57534E]">
                        Dünya Markaları Aksesuar &amp; LED Donanım:
                      </span>
                      <span className="font-bold">
                        €{(pricing.hardwareCost ?? (pricing as any).hardwareCostEur ?? 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-sans text-[#57534E]">
                        CNC İşçilik, Ebatlama &amp; Montaj:
                      </span>
                      <span className="font-bold">
                        €{(pricing.laborCost ?? (pricing as any).laborCostEur ?? 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="pt-3 border-t border-[#E5DFD3] flex justify-between items-baseline text-sm font-black text-[#141413]">
                      <span className="font-sans">KDV Dahil Müşteri Satış Toplamı:</span>
                      <span className="text-amber-900">
                        €
                        {(pricing.totalWithVatEur ?? 0).toLocaleString("tr-TR", {
                          minimumFractionDigits: 2,
                        })}{" "}
                        (
                        {(pricing.totalWithVatTry ?? 0).toLocaleString("tr-TR", {
                          maximumFractionDigits: 0,
                        })}{" "}
                        TL)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 9: DOUBLE-SIDED CNC POSTPROCESSORS (.MPR / .CIX / .XCS) */}
          {activeTab === "cnc_mpr_cix" &&
            (() => {
              const cncInputs: CncPieceInput[] = bom.cutList.map((cp) =>
                mapCutPieceToCncPieceInput(cp)
              );
              const bundle = generateProjectCncPostProcessorBundle(cncInputs);
              return (
                <div className="space-y-4 text-xs text-[#141413]">
                  <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-white border border-[#E5DFD3] shadow-2xs">
                    <div>
                      <h3 className="text-sm font-extrabold text-[#141413]">
                        Homag WoodWOP (.MPR), BiesseWorks (.CIX) &amp; SCM Maestro (.XCS) Çift Yüzeyli CNC Çıktısı
                      </h3>
                      <p className="text-[#57534E] mt-0.5">
                        Ara dikme gibi çift yüzeyli parçalar otomatik olarak Setup-1 (Üst) ve Setup-2 (X-Simetrik Flip) programlarına ayrılır.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (!checkGateBeforeProductionExport("Homag .MPR")) return;
                          const allMpr = bundle.homagMprFiles
                            .map((f) => `; === ${f.fileName} ===\r\n${f.content}`)
                            .join("\r\n\r\n");
                          downloadFile(
                            allMpr,
                            `Homag_WoodWOP_${project.id}_v${project.version}.mpr`,
                            "text/plain;charset=utf-8"
                          );
                        }}
                        className="px-3.5 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold cursor-pointer"
                      >
                        Homag .MPR İndir ({bundle.homagMprFiles.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!checkGateBeforeProductionExport("Biesse .CIX")) return;
                          const allCix = bundle.biesseCixFiles
                            .map((f) => `// === ${f.fileName} ===\r\n${f.content}`)
                            .join("\r\n\r\n");
                          downloadFile(
                            allCix,
                            `Biesse_Works_${project.id}_v${project.version}.cix`,
                            "text/plain;charset=utf-8"
                          );
                        }}
                        className="px-3.5 py-2 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold cursor-pointer"
                      >
                        Biesse .CIX İndir ({bundle.biesseCixFiles.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!checkGateBeforeProductionExport("SCM Maestro .XCS")) return;
                          const allXcs = bundle.scmXcsFiles
                            .map((f) => `// === ${f.fileName} ===\r\n${f.content}`)
                            .join("\r\n\r\n");
                          downloadFile(
                            allXcs,
                            `SCM_Maestro_${project.id}_v${project.version}.xcs`,
                            "text/plain;charset=utf-8"
                          );
                        }}
                        className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold cursor-pointer"
                      >
                        SCM .XCS İndir ({bundle.scmXcsFiles.length})
                      </button>
                    </div>
                  </div>

                  {(() => {
                    const simReport = simulateCncPostProcessorBundle(project, bom);
                    const simTargetPiece =
                      bom.cutList.find((cp) => cp.id === selectedSimulatedPieceId) ||
                      bom.cutList.find((cp) => (cp.holes?.length || 0) > 0) ||
                      bom.cutList[0];
                    const simSvg = simTargetPiece
                      ? generateCncToolpathSimulationSvg(simTargetPiece)
                      : "";
                    return (
                      <div
                        data-testid="cnc-preflight-simulation-card"
                        className="p-4 rounded-2xl bg-white border border-[#E5DFD3] shadow-2xs space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="text-sm font-extrabold text-[#141413]">
                              CNC Ön Doğrulama &amp; 2B Takım Yolu Simülasyonu (Makine Öncesi Güvenlik Kapısı)
                            </div>
                            <div className="text-[11px] text-amber-800 mt-0.5 font-medium">
                              {simReport.postProcessorDisclaimerTr}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                            <span className="px-2.5 py-1 rounded-xl bg-[#FAF8F4] border border-[#E5DFD3] text-[#141413] font-semibold">
                              İşlenen Panel: {simReport.machinedPanelsCount}/
                              {simReport.totalPanelsSimulated}
                            </span>
                            <span className="px-2.5 py-1 rounded-xl bg-[#FAF8F4] border border-[#E5DFD3] text-emerald-800 font-bold">
                              Tahmini Süre: ~{simReport.totalEstimatedMinutes} dk
                            </span>
                            <span
                              className={`px-2.5 py-1 rounded-xl border font-bold ${
                                simReport.blockingErrorCount === 0
                                  ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                                  : "bg-red-50 border-red-300 text-red-900"
                              }`}
                            >
                              {simReport.blockingErrorCount === 0
                                ? "Z-Derinlik & Et Kalınlığı Uygun"
                                : `${simReport.blockingErrorCount} Kritik CNC Uyarısı`}
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-start">
                          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                            {simReport.pieces.map((sp) => (
                              <button
                                key={sp.pieceId}
                                type="button"
                                onClick={() => setSelectedSimulatedPieceId(sp.pieceId)}
                                className={`w-full text-left p-2.5 rounded-xl border text-[11px] transition cursor-pointer ${
                                  simTargetPiece?.id === sp.pieceId
                                    ? "bg-[#141413] border-[#141413] text-white shadow-xs"
                                    : "bg-[#FAF8F4] border-[#E5DFD3] text-[#141413] hover:bg-[#EFECE4]"
                                }`}
                              >
                                <div className="font-bold truncate">{sp.partName}</div>
                                <div
                                  className={`text-[10px] font-mono ${
                                    simTargetPiece?.id === sp.pieceId
                                      ? "text-amber-300"
                                      : "text-[#78716C]"
                                  }`}
                                >
                                  {sp.lengthMm}×{sp.widthMm}×{sp.thicknessMm}mm • {sp.drillCount}{" "}
                                  delik • ~{sp.estimatedCycleSeconds}s
                                </div>
                              </button>
                            ))}
                          </div>
                          <div
                            className="lg:col-span-2 p-2.5 rounded-xl bg-[#FAF8F4] border border-[#E5DFD3] overflow-hidden"
                            dangerouslySetInnerHTML={{ __html: simSvg }}
                          />
                        </div>
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] shadow-2xs">
                      <div className="font-bold text-amber-900 mb-2">
                        Örnek Homag .MPR ({bundle.homagMprFiles[0]?.fileName || "-"})
                      </div>
                      <pre className="max-h-80 overflow-auto p-3 rounded-xl bg-[#1E1D1B] text-[#F5F2EA] text-[11px] font-mono whitespace-pre-wrap">
                        {bundle.homagMprFiles[0]?.content || "Parça yok"}
                      </pre>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] shadow-2xs">
                      <div className="font-bold text-blue-900 mb-2">
                        Örnek Biesse .CIX ({bundle.biesseCixFiles[0]?.fileName || "-"})
                      </div>
                      <pre className="max-h-80 overflow-auto p-3 rounded-xl bg-[#1E1D1B] text-[#F5F2EA] text-[11px] font-mono whitespace-pre-wrap">
                        {bundle.biesseCixFiles[0]?.content || "Parça yok"}
                      </pre>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] shadow-2xs">
                      <div className="font-bold text-emerald-900 mb-2">
                        Örnek SCM Maestro .XCS ({bundle.scmXcsFiles[0]?.fileName || "-"})
                      </div>
                      <pre className="max-h-80 overflow-auto p-3 rounded-xl bg-[#1E1D1B] text-[#F5F2EA] text-[11px] font-mono whitespace-pre-wrap">
                        {bundle.scmXcsFiles[0]?.content || "Parça yok"}
                      </pre>
                    </div>
                  </div>
                </div>
              );
            })()}
        </div>
      </div>
    </div>
  );
}
