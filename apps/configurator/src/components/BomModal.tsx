"use client";

import React, { useState } from "react";
import { useConfiguratorStore } from "../store/useConfiguratorStore";
import {
  X,
  Download,
  CheckCircle,
  AlertTriangle,
  FileCode,
  ListOrdered,
  Cpu,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import {
  exportCutListToCSV,
  generateAssemblyInstructions,
  generateSelcoExportPackage,
  generatePanelDXF,
  exportAllPanelsDXF,
  exportNestingSheetsDXF,
  generateBlumBxfXml,
  calculateBlumEngineeringSummary,
  generateProjectCncPostProcessorBundle,
  type CncPieceInput,
  CutPiece,
} from "@birim/manufacturing";

interface BomModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: "cutlist" | "hardware" | "nesting" | "validation" | "assembly" | "selco" | "cnc_mpr_cix" | "quote" | "blum_bxf";
}

function escapeHtml(raw: unknown): string {
  return String(raw ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export default function BomModal({ isOpen, onClose, initialTab = "cutlist" }: BomModalProps) {
  const [activeTab, setActiveTab] = useState<
    "cutlist" | "hardware" | "nesting" | "validation" | "assembly" | "selco" | "cnc_mpr_cix" | "quote" | "blum_bxf"
  >(initialTab);
  const [exportStatusBanner, setExportStatusBanner] = useState<string | null>(null);

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

  const downloadBlumBxf = () => {
    const xmlOut = blumBxfXml || generateBlumBxfXml(project, bom);
    downloadFile(
      xmlOut,
      `Blum_Easystick_${project.id}_v${project.version}.bxf`,
      "application/xml;charset=utf-8"
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
    const csvContent = exportCutListToCSV(bom);
    downloadFile(
      csvContent,
      `Kesim_Listesi_${project.id}_v${project.version}.csv`,
      "text/csv;charset=utf-8"
    );
  };

  const downloadPieceDXF = (piece: CutPiece) => {
    const dxfContent = generatePanelDXF(piece);
    downloadFile(dxfContent, `${piece.id}.dxf`, "application/dxf;charset=utf-8");
  };

  const downloadSampleDXF = () => {
    const piece = bom.cutList[0];
    if (!piece) return;
    downloadPieceDXF(piece);
  };

  const downloadAllPanelsDXF = () => {
    if (!bom.cutList.length) return;
    const dxfContent = exportAllPanelsDXF(bom);
    downloadFile(
      dxfContent,
      `Tum_Paneller_CNC_${project.id}_v${project.version}.dxf`,
      "application/dxf;charset=utf-8"
    );
  };

  const downloadNestingSheetsDXF = () => {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="flex flex-col w-full max-w-6xl h-[88vh] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <span>BOM & İmalat Mühendisliği Portalı</span>
              <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono">
                v{project.version} (
                {bom.approvalStatus === "production_approved" ? "ONAYLANDI" : "TASLAK"})
              </span>
              {exportStatusBanner && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-medium">
                  ✓ {exportStatusBanner}
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-400">
              Parametrik modelden türetilmiş bitmiş & bant düşümlü net kesim, System 32 delik
              operasyonları, 2D giyotin plaka yerleşimi ve sehim doğrulaması
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={downloadBlumBxf}
              data-testid="bom-download-bxf-btn"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow transition-all cursor-pointer"
              title="Blum E-SERVICES / EASYSTICK / MINIPRESS ve CAD/CAM yazılımları için .BXF üretim dosyasını indir"
            >
              <Download className="w-3.5 h-3.5" />
              🟦 Blum .BXF İndir
            </button>
            <button
              onClick={downloadCustomerQuoteHtml}
              data-testid="bom-download-quote-btn"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-500 text-white shadow transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              📄 Müşteri Teklif Föyü İndir
            </button>
            <button
              onClick={downloadCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white shadow transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              CSV Kesim Listesi
            </button>
            <button
              onClick={downloadAllPanelsDXF}
              data-testid="bom-download-all-dxf-btn"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow transition-all cursor-pointer"
              title="Projedeki tüm parçaların bitmiş kontur, net kesim, kanal ve delik katmanlı CNC DXF çizimini indir"
            >
              <FileCode className="w-3.5 h-3.5" />
              📐 Parça Listesi DXF İndir
            </button>
            <button
              onClick={downloadNestingSheetsDXF}
              data-testid="bom-download-nesting-dxf-btn"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-purple-700 hover:bg-purple-600 text-white shadow transition-all cursor-pointer"
              title="2800x2070 mm plaka yerleşim (optimizasyon) kesim şemasını DXF olarak indir"
            >
              <FileCode className="w-3.5 h-3.5" />
              📏 Plaka Kesim DXF
            </button>
            <button
              onClick={downloadSampleDXF}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-700 hover:bg-blue-600 text-white shadow transition-all cursor-pointer"
            >
              <FileCode className="w-3.5 h-3.5" />
              Örnek DXF
            </button>
            <button
              onClick={downloadJson}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              JSON
            </button>
            <button
              onClick={onClose}
              title="Kapat"
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Summary Badges */}
        <div className="grid grid-cols-5 gap-3 px-6 py-3 bg-slate-950/60 border-b border-slate-800/80 text-xs">
          <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
            <span className="text-slate-400">Toplam Parça:</span>
            <div className="text-sm font-bold text-slate-200">
              {bom.summary.totalPiecesCount} adet
            </div>
          </div>
          <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
            <span className="text-slate-400">Net Panel Alanı:</span>
            <div className="text-sm font-bold text-amber-400">
              {bom.summary.totalPanelAreaM2} m²
            </div>
          </div>
          <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
            <span className="text-slate-400">Kenar Bandı:</span>
            <div className="text-sm font-bold text-blue-400">
              {bom.summary.totalEdgeBandMeters} mt
            </div>
          </div>
          <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
            <span className="text-slate-400">Hırdavat:</span>
            <div className="text-sm font-bold text-emerald-400">
              {bom.summary.totalHardwareCount} adet
            </div>
          </div>
          <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
            <span className="text-slate-400">CNC Delik Operasyonu:</span>
            <div className="text-sm font-bold text-purple-400">
              {bom.summary.totalDrillingHolesCount} delik
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-6 pt-2 border-b border-slate-800 gap-5 text-xs font-medium overflow-x-auto">
          <button
            onClick={() => setActiveTab("cutlist")}
            className={`pb-2.5 border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === "cutlist"
                ? "border-amber-500 text-amber-400 font-semibold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Net Kesim & Delik Tablosu ({bom.cutList.length})
          </button>
          <button
            onClick={() => setActiveTab("hardware")}
            className={`pb-2.5 border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === "hardware"
                ? "border-amber-500 text-amber-400 font-semibold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Hırdavat & Aksesuarlar ({bom.hardwareList.length})
          </button>
          <button
            onClick={() => setActiveTab("nesting")}
            className={`pb-2.5 border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === "nesting"
                ? "border-amber-500 text-amber-400 font-semibold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Gerçek 2D Plaka Optimizasyonu (
            {bom.nestingResults.reduce((s, r) => s + r.totalSheetsCount, 0)} Plaka)
          </button>
          <button
            onClick={() => setActiveTab("validation")}
            data-testid="bom-tab-validation"
            className={`pb-2.5 border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === "validation"
                ? "border-amber-500 text-amber-400 font-semibold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 inline mr-1" />
            Fabrika Doğrulama & Sehim ({gateChecks.length})
          </button>
          <button
            onClick={() => setActiveTab("assembly")}
            className={`pb-2.5 border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === "assembly"
                ? "border-amber-500 text-amber-400 font-semibold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <ListOrdered className="w-3.5 h-3.5 inline mr-1" />
            Montaj Kılavuzu ({assemblySteps.length} Adım)
          </button>
          <button
            onClick={() => setActiveTab("quote")}
            data-testid="bom-tab-quote"
            className={`pb-2.5 border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === "quote"
                ? "border-amber-500 text-amber-400 font-semibold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            📄 Müşteri Teklif & Sunum Föyü
          </button>
          <button
            onClick={() => setActiveTab("blum_bxf")}
            data-testid="bom-tab-blum-bxf"
            className={`pb-2.5 border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === "blum_bxf"
                ? "border-amber-500 text-amber-400 font-semibold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            🟦 Blum BXF & EASYSTICK (MINIPRESS)
          </button>
          <button
            onClick={() => setActiveTab("selco")}
            className={`pb-2.5 border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === "selco"
                ? "border-amber-500 text-amber-400 font-semibold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Cpu className="w-3.5 h-3.5 inline mr-1" />
            Selco WNT 600 Postprocessor
          </button>
          <button
            onClick={() => setActiveTab("cnc_mpr_cix")}
            data-testid="bom-tab-cnc-mpr-cix"
            className={`pb-2.5 border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === "cnc_mpr_cix"
                ? "border-amber-500 text-amber-400 font-semibold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Cpu className="w-3.5 h-3.5 inline mr-1" />
            Çift Yüzeyli CNC (.MPR / .CIX)
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 text-xs">
          {/* TAB 1: CUT LIST & DRILLING */}
          {activeTab === "cutlist" && (
            <div className="space-y-3">
              <div className="p-3 bg-slate-950 border border-indigo-500/40 rounded-xl flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="font-bold text-slate-100 block">
                    📐 AutoCAD / CNC Parça Kesim ve Delik Çizimleri (.DXF — AutoCAD AC1015 / mm)
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Her parçanın bitmiş ebadı (PANEL_CONTOUR), bant düşümlü net kesim ebadı (NET_CUT_CONTOUR), 8mm arkalık kanalı (BACK_GROOVE_8MM) ve delik eksenleri ayrı katmanlarda (LAYER) yer alır.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={downloadAllPanelsDXF}
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Tüm Parça Listesini DXF İndir ({bom.cutList.length} Parça)</span>
                  </button>
                  <button
                    type="button"
                    onClick={downloadNestingSheetsDXF}
                    className="px-3.5 py-2 rounded-xl bg-purple-700 hover:bg-purple-600 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>2800×2070 Plaka Kesim Şeması DXF İndir</span>
                  </button>
                </div>
              </div>
              <div className="border border-slate-800 rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="p-2.5">Parça ID / Adı</th>
                    <th className="p-2.5">Modül</th>
                    <th className="p-2.5">Malzeme</th>
                    <th className="p-2.5 text-right">Bitmiş (Boy×En)</th>
                    <th className="p-2.5 text-right">Testere Net (mm)</th>
                    <th className="p-2.5 text-right">Kalınlık</th>
                    <th className="p-2.5 text-center">Bant (Ü/A/S/Sa)</th>
                    <th className="p-2.5 text-center">CNC Delik</th>
                    <th className="p-2.5 text-right">Alan (m²)</th>
                    <th className="p-2.5 text-center">CAD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  {bom.cutList.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-800/40">
                      <td className="p-2.5 font-sans">
                        <div className="font-semibold text-slate-200">{p.pieceName}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{p.id}</div>
                      </td>
                      <td className="p-2.5 text-slate-400 font-sans">{p.moduleName}</td>
                      <td className="p-2.5 text-slate-300 font-sans">{p.materialName}</td>
                      <td className="p-2.5 text-right text-amber-400 font-bold">
                        {p.lengthMm} × {p.widthMm}
                      </td>
                      <td className="p-2.5 text-right text-emerald-400 font-bold">
                        {p.netCutLengthMm ?? p.lengthMm} × {p.netCutWidthMm ?? p.widthMm}
                      </td>
                      <td className="p-2.5 text-right text-slate-300">{p.thicknessMm}mm</td>
                      <td className="p-2.5 text-center">
                        <div className="flex justify-center gap-0.5 text-[9px]">
                          <span
                            className={`px-1 py-0.5 rounded ${
                              p.edgeBanding.top
                                ? "bg-blue-600 text-white"
                                : "bg-slate-800 text-slate-600"
                            }`}
                          >
                            Ü
                          </span>
                          <span
                            className={`px-1 py-0.5 rounded ${
                              p.edgeBanding.bottom
                                ? "bg-blue-600 text-white"
                                : "bg-slate-800 text-slate-600"
                            }`}
                          >
                            A
                          </span>
                          <span
                            className={`px-1 py-0.5 rounded ${
                              p.edgeBanding.left
                                ? "bg-blue-600 text-white"
                                : "bg-slate-800 text-slate-600"
                            }`}
                          >
                            S
                          </span>
                          <span
                            className={`px-1 py-0.5 rounded ${
                              p.edgeBanding.right
                                ? "bg-blue-600 text-white"
                                : "bg-slate-800 text-slate-600"
                            }`}
                          >
                            Sa
                          </span>
                        </div>
                        {p.edgeBandCode && (
                          <div className="text-[9px] text-slate-400 mt-0.5 font-sans">
                            {p.edgeBandCode}
                          </div>
                        )}
                      </td>
                      <td className="p-2.5 text-center text-purple-400 font-bold">
                        {p.holes ? `${p.holes.length} delik` : "0"}
                      </td>
                      <td className="p-2.5 text-right text-slate-300">{p.areaM2}</td>
                      <td className="p-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => downloadPieceDXF(p)}
                          className="px-2 py-0.5 rounded bg-slate-800 hover:bg-blue-700 text-slate-200 hover:text-white text-[10px] font-sans cursor-pointer"
                          title={`${p.pieceName} için katmanlı AutoCAD DXF indir`}
                        >
                          DXF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}

          {/* TAB 2: HARDWARE */}
          {activeTab === "hardware" && (
            <div className="border border-slate-800 rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="p-3">SKU</th>
                    <th className="p-3">Hırdavat Tanımı</th>
                    <th className="p-3">Kategori</th>
                    <th className="p-3 text-right">Miktar</th>
                    <th className="p-3 text-right">Birim Fiyat (€)</th>
                    <th className="p-3 text-right">Toplam (€)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {bom.hardwareList.map((hw) => (
                    <tr key={hw.sku} className="hover:bg-slate-800/40">
                      <td className="p-3 text-slate-400">{hw.sku}</td>
                      <td className="p-3 font-sans font-medium text-slate-200">{hw.name}</td>
                      <td className="p-3 font-sans text-slate-400">{hw.category}</td>
                      <td className="p-3 text-right text-emerald-400 font-bold">
                        {hw.quantity} {hw.unit}
                      </td>
                      <td className="p-3 text-right text-slate-300">{(hw.unitPrice ?? 0).toFixed(2)}</td>
                      <td className="p-3 text-right text-emerald-400 font-bold">
                        {(hw.totalPrice ?? 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 3: REAL 2D GUILLOTINE NESTING */}
          {activeTab === "nesting" && (
            <div className="space-y-6">
              <div className="p-3 bg-blue-950/30 border border-blue-800/50 rounded-lg text-blue-200 text-xs flex items-center justify-between">
                <div>
                  <strong>Gerçek 2D Giyotin Yerleşim Algoritması:</strong> Standart 2800x2070mm
                  plaka, 4.4mm testere kerf, 15mm kenar düzeltme, damar yönü kilidi ve ≥300×300mm
                  kullanılabilir stok fire konsolidasyonuna göre hesaplanmıştır.
                </div>
              </div>

              {bom.nestingResults.map((nestRes, nIdx) => (
                <div key={`${nestRes.materialId}_${nIdx}`} className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <h3 className="font-bold text-slate-200 text-sm">{nestRes.materialName}</h3>
                    <div className="flex gap-4 text-xs font-mono">
                      <span>
                        Plaka: <strong className="text-amber-400">{nestRes.totalSheetsCount} adet</strong>
                      </span>
                      <span>
                        Net: <strong className="text-slate-300">{nestRes.totalNetAreaM2} m²</strong>
                      </span>
                      <span>
                        Fire: <strong className="text-blue-400">%{nestRes.overallWastePercent}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Sheet Visualizations */}
                  <div className="grid grid-cols-2 gap-4">
                    {nestRes.sheets.map((sheet) => (
                      <div
                        key={sheet.sheetIndex}
                        className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2"
                      >
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-semibold text-slate-300">
                            Plaka #{sheet.sheetIndex} (2800x2070 mm)
                          </span>
                          <div className="flex items-center gap-3 font-mono">
                            {sheet.usableRemnantAreaM2 ? (
                              <span className="text-emerald-400">
                                Stok Fire: {sheet.usableRemnantAreaM2} m²
                              </span>
                            ) : null}
                            <span className="text-amber-400">Fire: %{sheet.wastePercent}</span>
                          </div>
                        </div>

                        {/* High-Precision CAD Vector SVG 2800x2070mm Sheet Nesting Representation */}
                        <div className="relative w-full bg-slate-900 border border-slate-700 rounded-lg overflow-hidden p-1.5">
                          <svg
                            data-testid={`bom-nesting-svg-sheet-${sheet.sheetIndex}`}
                            viewBox="-110 -85 3000 2230"
                            className="w-full h-auto block select-none"
                          >
                            <defs>
                              <pattern id={`waste_hatch_${sheet.sheetIndex}`} width="40" height="40" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                                <line x1="0" y1="0" x2="0" y2="40" stroke="#334155" strokeWidth="6" />
                              </pattern>
                            </defs>

                            {/* Outer 2800x2070mm Raw Board */}
                            <rect
                              x={0}
                              y={0}
                              width={2800}
                              height={2070}
                              fill={`url(#waste_hatch_${sheet.sheetIndex})`}
                              stroke="#64748B"
                              strokeWidth="8"
                            />
                            {/* 15mm Trim Margin (Kenar Temizleme Payı) */}
                            <rect
                              x={15}
                              y={15}
                              width={2770}
                              height={2040}
                              fill="#0F172A"
                              stroke="#475569"
                              strokeWidth="4"
                              strokeDasharray="24 14"
                            />

                            {/* Top Horizontal Ruler (0 -> 2800 mm) */}
                            <line x1={0} y1={-32} x2={2800} y2={-32} stroke="#94A3B8" strokeWidth="4" />
                            {[0, 700, 1400, 2100, 2800].map((tx) => (
                              <g key={`rx_${tx}`}>
                                <line x1={tx} y1={-48} x2={tx} y2={-16} stroke="#94A3B8" strokeWidth="4" />
                                <text x={tx} y={-54} textAnchor="middle" fill="#CBD5E1" fontSize="42" fontWeight="800" fontFamily="monospace">
                                  {tx}
                                </text>
                              </g>
                            ))}

                            {/* Left Vertical Ruler (0 -> 2070 mm) */}
                            <line x1={-32} y1={0} x2={-32} y2={2070} stroke="#94A3B8" strokeWidth="4" />
                            {[0, 500, 1000, 1500, 2070].map((ty) => (
                              <g key={`ry_${ty}`}>
                                <line x1={-48} y1={ty} x2={-16} y2={ty} stroke="#94A3B8" strokeWidth="4" />
                                <text x={-56} y={ty + 14} textAnchor="end" fill="#CBD5E1" fontSize="38" fontWeight="800" fontFamily="monospace">
                                  {ty}
                                </text>
                              </g>
                            ))}

                            {/* Placed Cut Pieces with 4.4mm Kerf Gap, Grain Direction Arrow & Dimensions */}
                            {sheet.placedPieces.map((p, pIdx) => {
                              const pw = Math.max(40, p.width);
                              const ph = Math.max(40, p.length);
                              const cx = p.x + pw / 2;
                              const cy = p.y + ph / 2;
                              const palette = [
                                { fill: "#1E3A8A", stroke: "#60A5FA", text: "#EFF6FF" },
                                { fill: "#064E3B", stroke: "#34D399", text: "#ECFDF5" },
                                { fill: "#78350F", stroke: "#FBBF24", text: "#FFFBEB" },
                                { fill: "#3B0764", stroke: "#C084FC", text: "#FAF5FF" },
                              ];
                              const col = palette[pIdx % palette.length];
                              const fontTitle = Math.max(26, Math.min(48, Math.floor(pw / Math.max(6, p.pieceName.length * 0.65))));
                              const fontDim = Math.max(24, Math.min(42, Math.floor(pw / 8)));
                              return (
                                <g key={p.pieceId}>
                                  {/* 4.4mm Saw Kerf Outline */}
                                  <rect
                                    x={p.x - 2.2}
                                    y={p.y - 2.2}
                                    width={pw + 4.4}
                                    height={ph + 4.4}
                                    fill="none"
                                    stroke="#EF4444"
                                    strokeWidth="2.5"
                                    strokeDasharray="10 6"
                                  />
                                  {/* Net Panel Body */}
                                  <rect
                                    x={p.x}
                                    y={p.y}
                                    width={pw}
                                    height={ph}
                                    rx={4}
                                    fill={col.fill}
                                    stroke={col.stroke}
                                    strokeWidth="5"
                                  />
                                  {/* Grain Direction Line */}
                                  {pw >= 180 && ph >= 120 && (
                                    <line
                                      x1={cx - Math.min(pw * 0.28, 120)}
                                      y1={cy + fontDim + 24}
                                      x2={cx + Math.min(pw * 0.28, 120)}
                                      y2={cy + fontDim + 24}
                                      stroke={col.stroke}
                                      strokeWidth="3.5"
                                      strokeDasharray="12 6"
                                    />
                                  )}
                                  {pw >= 120 && ph >= 85 && (
                                    <>
                                      <text
                                        x={cx}
                                        y={cy - 6}
                                        textAnchor="middle"
                                        fill={col.text}
                                        fontSize={fontTitle}
                                        fontWeight="900"
                                        fontFamily="sans-serif"
                                      >
                                        {p.pieceName.slice(0, 18)}
                                      </text>
                                      <text
                                        x={cx}
                                        y={cy + fontDim + 4}
                                        textAnchor="middle"
                                        fill="#FDE68A"
                                        fontSize={fontDim}
                                        fontWeight="800"
                                        fontFamily="monospace"
                                      >
                                        {`${p.length}×${p.width}`}
                                      </text>
                                    </>
                                  )}
                                </g>
                              );
                            })}
                          </svg>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 4: FACTORY VALIDATION GATE & SHELF DEFLECTION */}
          {activeTab === "validation" && (
            <div className="space-y-6">
              <div className="space-y-3">
                <h3 className="font-bold text-slate-200 text-sm">
                  6 Aşamalı Deterministik Üretim Doğrulama Kapısı (Fail-Closed Gate)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {gateChecks.map((chk) => (
                    <div
                      key={chk.id}
                      className={`p-3.5 rounded-xl border ${
                        chk.passed
                          ? "bg-emerald-950/30 border-emerald-800/60 text-emerald-200"
                          : "bg-amber-950/40 border-amber-800/70 text-amber-200"
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold text-xs mb-1">
                        <span>{chk.label}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                            chk.passed
                              ? "bg-emerald-800/80 text-emerald-100"
                              : "bg-amber-800/80 text-amber-100"
                          }`}
                        >
                          {chk.passed ? "GEÇTİ (PASS)" : "KİLİTLİ (HOLD)"}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed">{chk.detail}</p>
                    </div>
                  ))}
                </div>
              </div>

              {shelfDeflections.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-bold text-slate-200 text-sm">
                    ISO 7170 Euler-Bernoulli Fiziksel Raf Sehim (Esneme) Analizi
                  </h3>
                  <div className="border border-slate-800 rounded-lg overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[11px]">
                        <tr>
                          <th className="p-2.5">Modül / Bölme</th>
                          <th className="p-2.5 text-right">Açıklık (L)</th>
                          <th className="p-2.5 text-right">Derinlik (D)</th>
                          <th className="p-2.5 text-right">Kalınlık (T)</th>
                          <th className="p-2.5 text-right">Hesaplanan Sehim</th>
                          <th className="p-2.5 text-right">L/300 Sınırı</th>
                          <th className="p-2.5 text-center">Durum</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                        {shelfDeflections.map((sd, idx) => (
                          <tr key={`${sd.moduleId}_${sd.bayIndex}_${idx}`}>
                            <td className="p-2.5 font-sans text-slate-200">
                              {sd.moduleName} — Bölme {sd.bayIndex + 1}
                            </td>
                            <td className="p-2.5 text-right text-slate-300">{sd.spanMm} mm</td>
                            <td className="p-2.5 text-right text-slate-300">{sd.depthMm} mm</td>
                            <td className="p-2.5 text-right text-slate-300">{sd.thicknessMm} mm</td>
                            <td className="p-2.5 text-right font-bold text-amber-400">
                              {sd.deflectionMm} mm
                            </td>
                            <td className="p-2.5 text-right text-slate-400">
                              {sd.maxAllowedMm} mm
                            </td>
                            <td className="p-2.5 text-center">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  sd.passed
                                    ? "bg-emerald-900/60 text-emerald-300"
                                    : "bg-red-900/60 text-red-300"
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
            <div className="space-y-4 max-w-3xl">
              <p className="text-slate-400">
                Fabrikada ebatlanan, kenar bantlanan ve System 32 delikleri açılan panellerin
                sahada montaj sırası:
              </p>
              <div className="space-y-3">
                {assemblySteps.map((st) => (
                  <div
                    key={st.stepNumber}
                    className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-amber-600 text-white font-bold text-xs flex items-center justify-center">
                        {st.stepNumber}
                      </span>
                      <h4 className="font-bold text-slate-200">{st.title}</h4>
                    </div>
                    <p className="text-slate-300 leading-relaxed pl-8">{st.description}</p>
                    <div className="pl-8 pt-1 flex flex-wrap gap-2 text-[11px]">
                      <span className="text-slate-400">Parçalar:</span>
                      {st.requiredParts.map((p, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                    {st.safetyNotes && (
                      <div className="pl-8 text-amber-400/90 text-[11px] flex items-center gap-1.5 pt-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
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
              <div className="p-4 bg-amber-950/40 border border-amber-800/60 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-amber-400 font-bold">
                  <ShieldAlert className="w-5 h-5" />
                  <span>Biesse Selco WNT 600 Postprocessor (Teknik Uyarı)</span>
                </div>
                <p className="text-slate-300 text-xs leading-relaxed">
                  Gerçek üretim dosyası oluşturulmadan önce fabrika şefi ve Selco OptiPlanning
                  operatörü tarafından takım ve bıçak parametreleri onaylanmalıdır.
                </p>
                {selcoPackage?.unverifiedNotes.map((note, idx) => (
                  <div key={idx} className="text-amber-300/90 text-xs font-mono">
                    • {note}
                  </div>
                ))}
              </div>

              {selcoPackage && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-slate-300">
                    Üretim XML Çıktı Taslağı ({selcoPackage.batchId}):
                  </h4>
                  <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-[11px] font-mono overflow-x-auto max-h-72">
                    {selcoPackage.xmlOutputDraft}
                  </pre>
                </div>
              )}
            </div>
          )}


          {/* TAB 8: BLUM BXF & EASYSTICK (MINIPRESS / E-SERVICES) */}
          {activeTab === "blum_bxf" && (
            <div data-testid="bom-blum-bxf-panel" className="space-y-5 text-xs">
              <div className="p-4 rounded-xl bg-slate-950 border border-blue-500/40 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-blue-400">
                    BLUM GÖVDE TASARLAYICI (CABINET CONFIGURATOR) & BXF / EASYSTICK ÜRETİM PAKETİ
                  </h3>
                  <p className="text-slate-400 mt-0.5">
                    KB/KH/KT Dış Ölçüler • LW/LH/LT Net İç Ölçüler • Kapak Ağırlığı (kg) & AVENTOS Güç Faktörü (LF) • LEGRABOX/TANDEMBOX Ahşap Kesim Formülleri • MINIPRESS EASYSTICK Delik Matrisi
                  </p>
                </div>
                <button
                  type="button"
                  onClick={downloadBlumBxf}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold cursor-pointer"
                >
                  🟦 Blum .BXF Dosyasını İndir (EASYSTICK / CAD)
                </button>
              </div>

              {blumCabinetSummaries.map((cab, cIdx) => (
                <div
                  key={cab.moduleId}
                  className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                    <div>
                      <span className="font-bold text-slate-100 text-sm">
                        {cIdx + 1}. {cab.moduleName} ({cab.moduleId})
                      </span>
                      <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                        Dış (KB×KH×KT):{" "}
                        <strong className="text-amber-400">
                          {cab.outerDimensions.KB} × {cab.outerDimensions.KH} × {cab.outerDimensions.KT} mm
                        </strong>{" "}
                        • Net İç (LW×LH×LT):{" "}
                        <strong className="text-emerald-400">
                          {cab.innerDimensions.LW} × {cab.innerDimensions.LH} × {cab.innerDimensions.LT} mm
                        </strong>{" "}
                        • Panel: {cab.panelThicknessMm}mm • Derz (Fuge): {cab.frontGapFugeMm}mm
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        cab.collisionFree
                          ? "bg-emerald-900/60 text-emerald-300 border border-emerald-700"
                          : "bg-amber-900/60 text-amber-300 border border-amber-700"
                      }`}
                    >
                      {cab.collisionFree ? "✓ BLUM ÇAKIŞMA KONTROLÜ: UYGUN" : "⚠ UYARI MEVCUT"}
                    </span>
                  </div>

                  {cab.collisionWarnings.length > 0 && (
                    <div className="p-2.5 rounded-lg bg-amber-950/50 border border-amber-800 text-amber-200 space-y-1">
                      {cab.collisionWarnings.map((w, wi) => (
                        <div key={wi}>• {w}</div>
                      ))}
                    </div>
                  )}

                  {/* Front Weight, Hinge & AVENTOS LF Table */}
                  {cab.doors.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="font-bold text-slate-300 text-[11px] uppercase tracking-wider">
                        Kapak Ağırlığı, CLIP top BLUMOTION Menteşe & AVENTOS Güç Faktörü (LF = KH × kg)
                      </div>
                      <table className="w-full text-left border-collapse font-mono text-[11px]">
                        <thead className="bg-slate-900 text-slate-400">
                          <tr>
                            <th className="p-2">Bölme</th>
                            <th className="p-2">Kapak Ölçüsü</th>
                            <th className="p-2">Ağırlık (kg)</th>
                            <th className="p-2">Menteşe Adedi & Kodu</th>
                            <th className="p-2">Delik Şablonu</th>
                            <th className="p-2">AVENTOS LF & Öneri</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/70">
                          {cab.doors.map((d) => (
                            <tr key={d.bayIndex}>
                              <td className="p-2 text-slate-200">Bölme {d.bayIndex + 1}</td>
                              <td className="p-2 text-amber-400">
                                {d.doorWidthMm}×{d.doorHeightMm}×{d.doorThicknessMm} mm
                              </td>
                              <td className="p-2 text-emerald-400 font-bold">{d.estimatedWeightKg} kg</td>
                              <td className="p-2 text-slate-200">
                                {d.recommendedHingeCount}× {d.hingeSku} + {d.mountingPlateSku}
                              </td>
                              <td className="p-2 text-slate-400">{d.cupDrillingPattern}</td>
                              <td className="p-2 text-blue-300">
                                LF={d.aventosPowerFactorLf} • {d.recommendedAventosModel || "Menteşeli"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Drawer Cutting Formulas & EASYSTICK Ruler Coordinates */}
                  {cab.drawers.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="font-bold text-slate-300 text-[11px] uppercase tracking-wider">
                        Çekmece Ahşap Kesim Ölçüleri (Taban & Arkalık) ve EASYSTICK Ray Delik Eksenleri
                      </div>
                      <table className="w-full text-left border-collapse font-mono text-[11px]">
                        <thead className="bg-slate-900 text-slate-400">
                          <tr>
                            <th className="p-2">Bölme</th>
                            <th className="p-2">Blum Sistem & Ray SKU</th>
                            <th className="p-2">NL / LW</th>
                            <th className="p-2">Ahşap Taban Kesim</th>
                            <th className="p-2">Ahşap Arkalık Kesim</th>
                            <th className="p-2">EASYSTICK Yan Delik X (mm)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/70">
                          {cab.drawers.map((drw) => (
                            <tr key={drw.drawerId}>
                              <td className="p-2 text-slate-200">Bölme {drw.bayIndex + 1}</td>
                              <td className="p-2 text-slate-200">
                                {drw.systemName} [{drw.runnerSku}]
                              </td>
                              <td className="p-2 text-amber-400">
                                NL:{drw.nominalLengthNlMm} / LW:{drw.netInnerWidthLwMm}
                              </td>
                              <td className="p-2 text-emerald-400 font-bold">
                                {drw.woodenBottomWidthMm} × {drw.woodenBottomDepthMm} mm (16mm)
                              </td>
                              <td className="p-2 text-emerald-400 font-bold">
                                {drw.woodenBackWidthMm} × {drw.woodenBackHeightMm} mm (16mm)
                              </td>
                              <td className="p-2 text-purple-300">
                                Y:{drw.easystickElevationYMm}mm → X:[{drw.easystickSideHoleXCoordsMm.join(", ")}]
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}

              <div className="space-y-2">
                <h4 className="font-semibold text-slate-300">
                  Canlı Blum Exchange Format (.BXF / XML) Çıktı Önizlemesi:
                </h4>
                <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-[11px] font-mono overflow-x-auto max-h-64">
                  {blumBxfXml}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 7: CUSTOMER QUOTE & PRESENTATION SHEET */}
          {activeTab === "quote" && (
            <div data-testid="bom-quote-panel" className="space-y-5 text-xs">
              <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/40 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-amber-400">
                    BİRİM MOBİLYA — KURUMSAL MÜŞTERİ TEKLİF & TEKNİK SUNUM FÖYÜ
                  </h3>
                  <p className="text-slate-400 mt-0.5">
                    Proje: {project.title} • {project.modules.length} Modül • Toplam Levha:{" "}
                    {bom.summary.totalPanelAreaM2} m² • Kenar Bandı: {bom.summary.totalEdgeBandMeters} mt
                  </p>
                </div>
                <button
                  type="button"
                  onClick={downloadCustomerQuoteHtml}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold cursor-pointer"
                >
                  📄 Yazdırılabilir Teklif Föyünü İndir (.HTML)
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">
                    1. Modül ve Seçilen Levha Dekorları
                  </h4>
                  <div className="divide-y divide-slate-800">
                    {project.modules.map((m, idx) => (
                      <div key={m.id} className="py-2 flex items-center justify-between">
                        <div>
                          <div className="font-bold text-slate-200">
                            {idx + 1}. {m.name}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            Gövde: {m.carcass.bodyMaterialId} • Kapak: {m.carcass.doorMaterialId}
                          </div>
                        </div>
                        <span className="font-mono font-bold text-amber-400">
                          {m.dimensions.width}×{m.dimensions.height}×{m.dimensions.depth} mm
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">
                    2. Maliyet ve Satış Teklif Kırılımı
                  </h4>
                  <div className="space-y-1.5 font-mono">
                    <div className="flex justify-between text-slate-300">
                      <span>Ahşap / Levha Maliyeti:</span>
                      <span>€{(pricing.materialCost ?? (pricing as any).materialCostEur ?? 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Kenar Bandı (PVC/ABS) Maliyeti:</span>
                      <span>€{(pricing.edgeBandCost ?? (pricing as any).edgeBandCostEur ?? 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Dünya Markaları Aksesuar & LED Donanım:</span>
                      <span>€{(pricing.hardwareCost ?? (pricing as any).hardwareCostEur ?? 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>CNC İşçilik, Ebatlama & Montaj:</span>
                      <span>€{(pricing.laborCost ?? (pricing as any).laborCostEur ?? 0).toFixed(2)}</span>
                    </div>
                    <div className="pt-2 border-t border-slate-800 flex justify-between text-base font-black text-amber-400">
                      <span>KDV Dahil Müşteri Satış Toplamı:</span>
                      <span>
                        €{(pricing.totalWithVatEur ?? 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} (
                        {(pricing.totalWithVatTry ?? 0).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {activeTab === "cnc_mpr_cix" && (() => {
            const cncInputs: CncPieceInput[] = bom.cutList.map((cp) => ({
              id: cp.id,
              moduleId: cp.moduleId,
              moduleName: cp.moduleName,
              partRole: cp.componentRole,
              pieceName: cp.pieceName,
              thicknessMm: cp.thicknessMm,
              lengthMm: cp.lengthMm,
              widthMm: cp.widthMm,
              netCutLengthMm: cp.netCutLengthMm,
              netCutWidthMm: cp.netCutWidthMm,
              mirrorInnerFaceX: cp.mirrorInnerFaceX,
              hasBackGroove: cp.hasBackGroove,
              backGrooveOffsetMm: cp.backGrooveOffsetMm,
              hasSinkOrHobCutout: cp.hasSinkOrHobCutout,
              cutoutWidthMm: cp.cutoutWidthMm,
              cutoutDepthMm: cp.cutoutDepthMm,
              utilityCutouts: cp.utilityCutouts,
              drillingOperations: (cp.holes || []).map((h) => ({
                x: h.x,
                y: h.y,
                diameter: h.diameter,
                depth: h.depth,
                face:
                  h.direction === "face_back"
                    ? "bottom"
                    : h.direction.startsWith("edge_")
                    ? (h.direction as CncPieceInput["drillingOperations"][number]["face"])
                    : "top",
                type: h.purpose || "drill",
              })),
            }));
            const bundle = generateProjectCncPostProcessorBundle(cncInputs);
            return (
              <div className="space-y-4 text-xs text-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Homag WoodWOP 5.0 (.MPR) &amp; BiesseWorks (.CIX) Çift Yüzeyli CNC Çıktısı
                    </h3>
                    <p className="text-slate-400 mt-0.5">
                      Ara dikme gibi çift yüzeyli parçalar otomatik olarak Setup-1 (Üst) ve Setup-2 (X-Simetrik Flip) programlarına ayrılır.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const allMpr = bundle.homagMprFiles
                          .map((f) => `; === ${f.fileName} ===\r\n${f.content}`)
                          .join("\r\n\r\n");
                        downloadFile(allMpr, `Homag_WoodWOP_${project.id}_v${project.version}.mpr`, "text/plain;charset=utf-8");
                      }}
                      className="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold cursor-pointer"
                    >
                      Homag .MPR Paketi İndir ({bundle.homagMprFiles.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const allCix = bundle.biesseCixFiles
                          .map((f) => `// === ${f.fileName} ===\r\n${f.content}`)
                          .join("\r\n\r\n");
                        downloadFile(allCix, `Biesse_Works_${project.id}_v${project.version}.cix`, "text/plain;charset=utf-8");
                      }}
                      className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold cursor-pointer"
                    >
                      Biesse .CIX Paketi İndir ({bundle.biesseCixFiles.length})
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="font-bold text-amber-400 mb-2">
                      Örnek Homag .MPR Önizleme ({bundle.homagMprFiles[0]?.fileName || "-"})
                    </div>
                    <pre className="max-h-80 overflow-auto text-[11px] font-mono text-slate-300 whitespace-pre-wrap">
                      {bundle.homagMprFiles[0]?.content || "Parça yok"}
                    </pre>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="font-bold text-blue-400 mb-2">
                      Örnek Biesse .CIX Önizleme ({bundle.biesseCixFiles[0]?.fileName || "-"})
                    </div>
                    <pre className="max-h-80 overflow-auto text-[11px] font-mono text-slate-300 whitespace-pre-wrap">
                      {bundle.biesseCixFiles[0]?.content || "Parça yok"}
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
