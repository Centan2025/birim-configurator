"use client";

import React, { useMemo, useState } from "react";
import type {
  ArchitecturalElement,
  DesignProject,
  WallDefinition,
} from "@birim/core";
import { exportAllPanelsDXF, type ManufacturingBOM } from "@birim/manufacturing";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileCode2,
  FileText,
  Layers,
  Maximize2,
  Printer,
  ShieldAlert,
  ShieldCheck,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  buildPrintableSheetsHtml,
  buildProductionSheetSvgDocument,
  buildSheetPages,
  SHEET_PAPER_SPECS,
  type SheetDisplayOptions,
  type SheetPaperFormat,
  type SheetScaleOption,
  type SheetTitleBlockMeta,
} from "./productionSheetEngine";

export interface ProductionSheetStudioModalProps {
  open: boolean;
  onClose: () => void;
  project: DesignProject;
  bom: ManufacturingBOM;
  spaceWalls: WallDefinition[];
  spaceObstacles: ArchitecturalElement[];
  initialUnit?: "mm" | "cm";
  onOpenBomModal?: (tab?: "cutlist" | "nesting" | "cnc_mpr_cix" | "blum_bxf") => void;
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const ProductionSheetStudioModal: React.FC<ProductionSheetStudioModalProps> = ({
  open,
  onClose,
  project,
  bom,
  spaceWalls,
  spaceObstacles,
  initialUnit = "mm",
  onOpenBomModal,
}) => {
  const pages = useMemo(() => buildSheetPages(project), [project]);
  const [activePageId, setActivePageId] = useState<string>("overview");
  const [zoom, setZoom] = useState<number>(1);

  const [options, setOptions] = useState<SheetDisplayOptions>({
    paperFormat: "A3_LANDSCAPE",
    scale: "auto",
    unit: "mm",
    showDimensions: true,
    showSectionHatch: true,
    showXrayInterior: false,
    showBomTable: true,
    showGridTicks: true,
    isoCameraSide: "front_right",
  });

  const [meta, setMeta] = useState<SheetTitleBlockMeta>(() => ({
    companyName: "BİRİM®",
    projectTitle: project.title || "Mobilya Projesi",
    customerOrOrderNo: `ORD-${project.id.slice(0, 6).toUpperCase()}`,
    drawnBy: "Birim Studio CAD",
    approvedBy: "Üretim Kontrol",
    revisionNote: `v${project.version || 1}`,
    sheetCodePrefix: "PAFTA",
  }));

  const activeIndex = useMemo(() => {
    const idx = pages.findIndex((p) => p.id === activePageId);
    return idx >= 0 ? idx : 0;
  }, [pages, activePageId]);

  const activePage = pages[activeIndex] ?? pages[0];

  const sheetCtx = useMemo(
    () => ({
      project,
      bom,
      spaceWalls,
      spaceObstacles,
      options,
      meta,
    }),
    [project, bom, spaceWalls, spaceObstacles, options, meta]
  );

  const activeSvg = useMemo(() => {
    if (!open || !activePage) return "";
    return buildProductionSheetSvgDocument(sheetCtx, activePage);
  }, [open, sheetCtx, activePage]);

  if (!open || !activePage) return null;

  const handlePrintPages = (targetPages: typeof pages) => {
    const html = buildPrintableSheetsHtml(sheetCtx, targetPages);
    const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleDownloadSvg = () => {
    const safeName = (project.title || "proje").replace(/[^a-zA-Z0-9_-]+/g, "_");
    downloadBlob(
      activeSvg,
      `${safeName}_${activePage.id}_${options.paperFormat}.svg`,
      "image/svg+xml;charset=utf-8"
    );
  };

  const handleDownloadDxf = () => {
    const dxf = exportAllPanelsDXF(bom);
    const safeName = (project.title || "proje").replace(/[^a-zA-Z0-9_-]+/g, "_");
    downloadBlob(dxf, `${safeName}_Uretim_Parcalari.dxf`, "application/dxf;charset=utf-8");
  };

  const gatePassed = bom.productionGate?.isReadyForErp ?? false;

  return (
    <div
      className="fixed inset-0 z-[95] bg-[#0B1120]/90 backdrop-blur-md flex flex-col text-slate-100 select-none"
      data-testid="production-sheet-studio-modal"
    >
      {/* Top Toolbar */}
      <header className="h-14 px-4 border-b border-white/10 bg-[#0F172A] flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-300 shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold tracking-tight text-white truncate">
              Üretim Paftası &amp; Teknik Çizim Düzeni
            </div>
            <div className="text-[11px] text-slate-400 truncate">
              {activePage.sheetNo} • {activePage.title}
            </div>
          </div>
        </div>

        {/* Paper, Scale, Unit, Zoom */}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            aria-label="Kağıt Formatı"
            value={options.paperFormat}
            onChange={(e) =>
              setOptions((prev) => ({
                ...prev,
                paperFormat: e.target.value as SheetPaperFormat,
              }))
            }
            className="h-8 px-2.5 rounded-lg bg-slate-800 border border-white/10 text-xs font-medium text-slate-100 cursor-pointer"
          >
            {Object.values(SHEET_PAPER_SPECS).map((spec) => (
              <option key={spec.id} value={spec.id}>
                {spec.label}
              </option>
            ))}
          </select>

          <select
            aria-label="Ölçek"
            value={options.scale}
            onChange={(e) =>
              setOptions((prev) => ({
                ...prev,
                scale: e.target.value as SheetScaleOption,
              }))
            }
            className="h-8 px-2.5 rounded-lg bg-slate-800 border border-white/10 text-xs font-medium text-slate-100 cursor-pointer"
          >
            <option value="auto">Ölçek: Oto Sığdır</option>
            <option value="1:10">Ölçek: 1:10</option>
            <option value="1:20">Ölçek: 1:20</option>
            <option value="1:25">Ölçek: 1:25</option>
            <option value="1:50">Ölçek: 1:50</option>
          </select>

          <div className="flex items-center rounded-lg bg-slate-800 border border-white/10 p-0.5">
            {(["mm", "cm"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setOptions((prev) => ({ ...prev, unit: u }))}
                className={`px-2 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                  options.unit === u
                    ? "bg-sky-600 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {u}
              </button>
            ))}
          </div>

          <div className="flex items-center rounded-lg bg-slate-800 border border-white/10 p-0.5" title="L / U Sistemler için 3B İzometrik Bakış Açısı">
            {([
              { id: "front_right", label: "3B Sağ" },
              { id: "front_left", label: "3B Sol" },
            ] as const).map((cam) => (
              <button
                key={cam.id}
                type="button"
                onClick={() => setOptions((prev) => ({ ...prev, isoCameraSide: cam.id }))}
                className={`px-2 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                  (options.isoCameraSide || "front_right") === cam.id
                    ? "bg-sky-600 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {cam.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 rounded-lg bg-slate-800 border border-white/10 px-1.5 h-8">
            <button
              type="button"
              title="Uzaklaştır"
              onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.15).toFixed(2))))}
              className="p-1 text-slate-300 hover:text-white cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono w-10 text-center text-slate-200">
              %{Math.round(zoom * 100)}
            </span>
            <button
              type="button"
              title="Yakınlaştır"
              onClick={() => setZoom((z) => Math.min(2.4, Number((z + 0.15).toFixed(2))))}
              className="p-1 text-slate-300 hover:text-white cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              title="Ekrana Sığdır"
              onClick={() => setZoom(1)}
              className="p-1 text-slate-300 hover:text-white cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Export Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleDownloadDxf}
            className="h-8 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/10 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            title="Tüm parçaları AutoCAD DXF olarak indir"
          >
            <FileCode2 className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden lg:inline">DXF</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadSvg}
            className="h-8 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/10 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            title="Aktif paftayı vektörel SVG olarak indir"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden lg:inline">SVG</span>
          </button>

          <button
            type="button"
            onClick={() => handlePrintPages([activePage])}
            className="h-8 px-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Aktif Pafta</span>
          </button>

          <button
            type="button"
            onClick={() => handlePrintPages(pages)}
            className="h-8 px-3.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-sky-900/40 transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Tüm Paftalar PDF ({pages.length})</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            aria-label="Pafta Stüdyosunu Kapat"
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/15 flex items-center justify-center text-slate-300 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 min-h-0 flex">
        {/* Left Sidebar */}
        <aside className="w-72 shrink-0 border-r border-white/10 bg-[#0F172A]/95 overflow-y-auto p-3.5 space-y-4">
          {/* Page List */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              Pafta Sayfaları ({pages.length})
            </div>
            <div className="space-y-1">
              {pages.map((p) => {
                const isActive = p.id === activePage.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setActivePageId(p.id)}
                    className={`w-full px-2.5 py-2 rounded-xl text-left transition border cursor-pointer ${
                      isActive
                        ? "bg-sky-600/20 border-sky-400/50 text-white"
                        : "bg-white/[0.03] border-transparent hover:bg-white/[0.07] text-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono font-bold text-sky-300">
                        {p.sheetNo}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {p.kind === "overview"
                          ? "Genel"
                          : p.kind === "module_views"
                          ? "Görünüş"
                          : p.kind === "joinery_details"
                          ? "1:2 Detay"
                          : p.kind === "exploded_bom"
                          ? "Montaj"
                          : p.kind === "panel_drilling"
                          ? "Delik"
                          : p.kind === "isometric_dimensions"
                          ? "3B Ölçü"
                          : "Kesim"}
                      </span>
                    </div>
                    <div className="text-xs font-semibold truncate mt-0.5">{p.title}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Layer Toggles */}
          <div className="pt-2 border-t border-white/10">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Çizim &amp; Katman Ayarları
            </div>
            <div className="space-y-1.5 text-xs">
              {(
                [
                  { key: "showDimensions", label: "Ölçülendirme Çizgileri" },
                  { key: "showSectionHatch", label: "Kesit Taraması (Hatch)" },
                  { key: "showXrayInterior", label: "Şeffaf Kapak / İç Detay" },
                  { key: "showBomTable", label: "Kesim Listesi (BOM) Tablosu" },
                  { key: "showGridTicks", label: "ISO Çerçeve Koordinatları" },
                ] as const
              ).map((item) => (
                <label
                  key={item.key}
                  className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] cursor-pointer"
                >
                  <span className="text-slate-200">{item.label}</span>
                  <input
                    type="checkbox"
                    checked={options[item.key]}
                    onChange={(e) =>
                      setOptions((prev) => ({ ...prev, [item.key]: e.target.checked }))
                    }
                    className="accent-sky-500 w-3.5 h-3.5 cursor-pointer"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Title Block Meta */}
          <div className="pt-2 border-t border-white/10 space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Antet (Title Block) Bilgileri
            </div>
            {(
              [
                { key: "companyName", label: "Firma / Marka" },
                { key: "projectTitle", label: "Proje Adı" },
                { key: "customerOrOrderNo", label: "Müşteri / Sipariş No" },
                { key: "drawnBy", label: "Çizen / Tasarım" },
                { key: "approvedBy", label: "Onaylayan" },
                { key: "sheetCodePrefix", label: "Pafta Kodu Ön Eki" },
              ] as const
            ).map((field) => (
              <div key={field.key}>
                <label className="block text-[10px] text-slate-400 mb-0.5">
                  {field.label}
                </label>
                <input
                  type="text"
                  value={meta[field.key]}
                  onChange={(e) =>
                    setMeta((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                  className="w-full h-7 px-2 rounded-lg bg-slate-800 border border-white/10 text-xs text-slate-100 focus:outline-none focus:border-sky-400"
                />
              </div>
            ))}
          </div>

          {/* Production Gate Summary */}
          <div className="pt-2 border-t border-white/10">
            <div
              className={`p-2.5 rounded-xl border text-xs ${
                gatePassed
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-200"
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold">
                {gatePassed ? (
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                )}
                <span>{gatePassed ? "Üretim Kapısı Onaylı" : "Doğrulama Bekliyor"}</span>
              </div>
              <div className="text-[11px] opacity-85 mt-1">
                {bom.summary.totalPiecesCount} net parça • {bom.summary.totalPanelAreaM2.toFixed(2)} m² • {bom.summary.totalEdgeBandMeters.toFixed(1)} mt PVC
              </div>
              {onOpenBomModal && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenBomModal("cutlist");
                  }}
                  className="mt-2 w-full h-7 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-semibold transition cursor-pointer"
                >
                  Kesim &amp; CNC Detayına Git →
                </button>
              )}
            </div>
          </div>
        </aside>

        {/* Sheet Canvas */}
        <main className="flex-1 min-w-0 min-h-0 overflow-auto bg-[#1E293B] relative flex flex-col items-center justify-center p-6">
          <div
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: "center center",
              transition: "transform 160ms ease-out",
            }}
            className="w-full max-w-[1280px] shadow-[0_24px_70px_rgba(0,0,0,0.65)] rounded-sm overflow-hidden bg-white border border-slate-700"
            dangerouslySetInnerHTML={{ __html: activeSvg }}
          />

          {/* Bottom Page Pager Pill */}
          {pages.length > 1 && (
            <div className="fixed bottom-5 right-6 flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0F172A]/95 border border-white/15 shadow-xl text-xs">
              <button
                type="button"
                disabled={activeIndex <= 0}
                onClick={() => setActivePageId(pages[Math.max(0, activeIndex - 1)].id)}
                className="p-1 rounded-full hover:bg-white/10 disabled:opacity-35 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-mono font-bold text-slate-200">
                {activePage.sheetNo}
              </span>
              <button
                type="button"
                disabled={activeIndex >= pages.length - 1}
                onClick={() =>
                  setActivePageId(pages[Math.min(pages.length - 1, activeIndex + 1)].id)
                }
                className="p-1 rounded-full hover:bg-white/10 disabled:opacity-35 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
