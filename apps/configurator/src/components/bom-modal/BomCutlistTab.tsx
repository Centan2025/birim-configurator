"use client";
import React from "react";
import { X, Download, FileCode, Tag, ChevronDown, ChevronUp, ChevronRight, Search, Code2, PanelRightOpen, PanelRightClose, Copy, Printer } from "lucide-react";
import type { CutPiece, ManufacturingBOM } from "@birim/manufacturing";
import { countActiveBands, getPieceDxfLayers, MiniEdgeBandSvg, CutPieceBlueprintSvg } from "./BomBlueprintSvgs";

export interface BomGroupedCutEntry {
  key: string;
  moduleName: string;
  materialName: string;
  thicknessMm: number;
  pieces: CutPiece[];
}

export interface BomBlueprintLayersState {
  bant: boolean;
  cnc: boolean;
  olcu: boolean;
}

export interface BomCutlistTabProps {
  activeCutPiece: CutPiece | null;
  activeTab: string;
  blueprintLayers: BomBlueprintLayersState;
  bom: ManufacturingBOM;
  checkedCutIds: Set<string>;
  collapsedGroups: Set<string>;
  copyPieceId: (id: string) => void;
  cutFilter: "all" | "band4" | "cnc" | "shelf" | "plinth";
  cutSearch: string;
  downloadPieceDXF: (piece: CutPiece) => void;
  downloadSelectedPiecesDxf: () => void;
  downloadThermalLabelsHtml: () => void;
  exportMenuOpen: boolean;
  filterBtnRefs: React.MutableRefObject<Record<string, HTMLButtonElement | null>>;
  filterGroupRef: React.RefObject<HTMLDivElement | null>;
  filterIndicator: { left: number; top: number; width: number; height: number; ready: boolean };
  groupedCutList: BomGroupedCutEntry[];
  inspectorOpen: boolean;
  navigateCutPiece: (dir: -1 | 1) => void;
  setBlueprintLayers: React.Dispatch<React.SetStateAction<BomBlueprintLayersState>>;
  setCheckedCutIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setCutFilter: React.Dispatch<React.SetStateAction<"all" | "band4" | "cnc" | "shelf" | "plinth">>;
  setCutSearch: React.Dispatch<React.SetStateAction<string>>;
  setExportMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setInspectorOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setLabelPreviewPiece: React.Dispatch<React.SetStateAction<CutPiece | null>>;
  setSelectedCutPieceId: React.Dispatch<React.SetStateAction<string | null>>;
  setShowTechIds: React.Dispatch<React.SetStateAction<boolean>>;
  showTechIds: boolean;
  toggleAllVisibleChecked: (checked: boolean) => void;
  toggleCutRowChecked: (id: string) => void;
  toggleGroupCollapsed: (key: string) => void;
}

export const BomCutlistTab: React.FC<BomCutlistTabProps> = (props) => {
  const {
    activeCutPiece,
    activeTab,
    blueprintLayers,
    bom,
    checkedCutIds,
    collapsedGroups,
    copyPieceId,
    cutFilter,
    cutSearch,
    downloadPieceDXF,
    downloadSelectedPiecesDxf,
    downloadThermalLabelsHtml,
    exportMenuOpen,
    filterBtnRefs,
    filterGroupRef,
    filterIndicator,
    groupedCutList,
    inspectorOpen,
    navigateCutPiece,
    setBlueprintLayers,
    setCheckedCutIds,
    setCutFilter,
    setCutSearch,
    setExportMenuOpen,
    setInspectorOpen,
    setLabelPreviewPiece,
    setSelectedCutPieceId,
    setShowTechIds,
    showTechIds,
    toggleAllVisibleChecked,
    toggleCutRowChecked,
    toggleGroupCollapsed,
  } = props;
  return (
    <>
          {/* TAB 1: CUT LIST & DRILLING — Master-Detail Engineering Workspace */}
          {activeTab === "cutlist" && (
            <div
              onClick={() => exportMenuOpen && setExportMenuOpen(false)}
              className="flex flex-col xl:flex-row gap-4 items-start"
            >
              {/* LEFT / MAIN: Toolbar + Bulk Action Bar + Grouped Cut-List Table */}
              <div className="flex-1 min-w-0 w-full space-y-3">
                {/* Streamlined Single-Row Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
                    <div className="relative w-full sm:w-52">
                      <Search className="w-3.5 h-3.5 text-[#78716C] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={cutSearch}
                        onChange={(e) => setCutSearch(e.target.value)}
                        placeholder="Parça veya malzeme ara..."
                        className="w-full h-8 pl-8 pr-2.5 rounded-xl bg-white border border-[#DED8CC] text-xs text-[#141413] placeholder-[#A8A29E] focus:outline-none focus:border-[#141413] transition"
                      />
                    </div>

                    <div
                      ref={filterGroupRef}
                      className="relative inline-flex items-center p-1 gap-0.5 rounded-2xl bg-black/15 border border-white/15 shadow-[inset_0_1px_3px_rgba(0,0,0,0.35)] overflow-x-auto max-w-full"
                    >
                      {filterIndicator.ready && (
                        <span
                          aria-hidden="true"
                          style={{
                            transform: `translate3d(${filterIndicator.left}px, ${filterIndicator.top}px, 0)`,
                            width: `${filterIndicator.width}px`,
                            height: `${filterIndicator.height}px`,
                            transition:
                              "transform 240ms cubic-bezier(0.22, 1, 0.36, 1), width 240ms cubic-bezier(0.22, 1, 0.36, 1)",
                          }}
                          className="pointer-events-none absolute left-0 top-0 rounded-xl bg-gradient-to-r from-[#0284C7] to-[#2563EB] shadow-[0_4px_14px_rgba(37,99,235,0.48),inset_0_1px_0_rgba(255,255,255,0.28)] z-0"
                        />
                      )}
                      {(
                        [
                          { id: "all", label: "Tümü" },
                          { id: "band4", label: "4 Kenar Bantlı" },
                          { id: "cnc", label: "CNC'li" },
                          { id: "shelf", label: "Raflar" },
                          { id: "plinth", label: "Baza" },
                        ] as const
                      ).map((f) => {
                        const active = cutFilter === f.id;
                        return (
                          <button
                            key={f.id}
                            ref={(el) => {
                              filterBtnRefs.current[f.id] = el;
                            }}
                            type="button"
                            onClick={() => setCutFilter(f.id)}
                            className={`relative z-10 px-2.5 py-1 rounded-xl text-[11px] font-bold transition-colors duration-200 cursor-pointer whitespace-nowrap ${
                              active
                                ? "text-white"
                                : "text-[#57534E] hover:text-[#141413]"
                            }`}
                          >
                            {f.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="inline-flex items-center p-1 gap-1 rounded-2xl bg-black/15 border border-white/15 shadow-[inset_0_1px_3px_rgba(0,0,0,0.35)]">
                    <button
                      type="button"
                      onClick={() => setShowTechIds((v) => !v)}
                      className={`h-7 px-2.5 rounded-xl text-[11px] font-bold inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer ${
                        showTechIds
                          ? "bg-gradient-to-r from-[#0284C7] to-[#2563EB] text-white shadow-[0_4px_12px_rgba(37,99,235,0.45)]"
                          : "text-[#57534E] hover:text-[#141413]"
                      }`}
                    >
                      <Code2 className="w-3.5 h-3.5" />
                      <span>Teknik Kodlar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setInspectorOpen((v) => !v)}
                      className={`h-7 px-2.5 rounded-xl text-[11px] font-bold inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer ${
                        inspectorOpen
                          ? "bg-gradient-to-r from-[#0284C7] to-[#2563EB] text-white shadow-[0_4px_12px_rgba(37,99,235,0.45)]"
                          : "text-[#57534E] hover:text-[#141413]"
                      }`}
                      title="2D Teknik Çizim İnceleme Panelini Aç/Kapat"
                    >
                      {inspectorOpen ? (
                        <PanelRightClose className="w-3.5 h-3.5" />
                      ) : (
                        <PanelRightOpen className="w-3.5 h-3.5" />
                      )}
                      <span className="hidden sm:inline">2D İnceleme</span>
                    </button>
                  </div>
                </div>

                {/* Contextual Multi-Select Bulk Action Bar */}
                {checkedCutIds.size > 0 && (
                  <div className="px-3.5 py-2 rounded-xl bg-blue-50 border border-blue-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-md bg-blue-700 text-white font-mono text-[11px] font-bold flex items-center justify-center">
                        {checkedCutIds.size}
                      </span>
                      <span className="text-blue-950 font-bold">{checkedCutIds.size} parça seçildi</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={downloadSelectedPiecesDxf}
                        className="px-2.5 py-1 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-[11px] font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Download className="w-3 h-3" />
                        <span>Seçili DXF İndir</span>
                      </button>
                      <button
                        type="button"
                        onClick={downloadThermalLabelsHtml}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-blue-100 border border-blue-200 text-blue-950 text-[11px] font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Printer className="w-3 h-3" />
                        <span>100×50 Etiket</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCheckedCutIds(new Set())}
                        className="px-2 py-1 rounded-lg text-[#57534E] hover:text-[#141413] text-[11px] font-semibold cursor-pointer"
                      >
                        Temizle
                      </button>
                    </div>
                  </div>
                )}

                {/* Grouped & Scannable Cut-List Table */}
                <div className="bg-white border border-[#E5DFD3] rounded-2xl shadow-2xs overflow-hidden">
                  {groupedCutList.length === 0 ? (
                    <div className="py-10 text-center text-[#78716C] text-xs">
                      Arama veya filtre kriterine uygun kesim parçası bulunamadı.
                    </div>
                  ) : (
                    groupedCutList.map((grp, gIdx) => {
                      const isCollapsed = collapsedGroups.has(grp.key);
                      const grpArea = grp.pieces.reduce((s, p) => s + (p.areaM2 || 0), 0);
                      const grpBand = grp.pieces.reduce((s, p) => s + (p.edgeBandMeters || 0), 0);
                      const allGrpChecked = grp.pieces.every((p) => checkedCutIds.has(p.id));
                      return (
                        <div key={grp.key} className={gIdx > 0 ? "border-t border-[#E5DFD3]" : ""}>
                          {/* Collapsible Module + Material Group Header */}
                          <div
                            onClick={() => toggleGroupCollapsed(grp.key)}
                            className="px-4 py-2.5 bg-[#F5F2EA] hover:bg-[#EFECE4] border-b border-[#E5DFD3] flex flex-wrap items-center justify-between gap-2 cursor-pointer transition"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {isCollapsed ? (
                                <ChevronRight className="w-3.5 h-3.5 text-[#78716C] shrink-0" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5 text-[#78716C] shrink-0" />
                              )}
                              <span className="font-bold text-[#141413] truncate">{grp.moduleName}</span>
                              <span className="text-[#A8A29E]">•</span>
                              <span className="text-[#57534E] font-medium truncate">{grp.materialName}</span>
                              <span className="text-[#A8A29E]">•</span>
                              <span className="font-mono text-[11px] font-bold text-[#141413]">
                                {grp.thicknessMm}mm
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] font-mono text-[#57534E] tabular-nums">
                              <span>{grp.pieces.length} parça</span>
                              <span>•</span>
                              <span>{grpArea.toFixed(2)} m²</span>
                              <span>•</span>
                              <span className="text-amber-800 font-bold">{grpBand.toFixed(2)} mt</span>
                            </div>
                          </div>

                          {!isCollapsed && (
                            <div className="overflow-x-auto">
                              <table className="w-full text-left border-collapse">
                                <thead className="bg-[#FAF8F4] text-[#78716C] uppercase tracking-wider text-[10px] border-b border-[#ECE7DC]">
                                  <tr>
                                    <th className="py-2 pl-3.5 pr-2 w-8">
                                      <input
                                        type="checkbox"
                                        checked={allGrpChecked}
                                        onChange={(e) => toggleAllVisibleChecked(e.target.checked)}
                                        className="rounded border-stone-300 accent-[#141413] cursor-pointer"
                                      />
                                    </th>
                                    <th className="py-2 px-2 font-bold">Parça Adı / İşlem</th>
                                    <th className="py-2 px-2 text-right font-bold">Bitmiş (mm)</th>
                                    <th className="py-2 px-2 text-right font-bold">Testere Net (mm)</th>
                                    <th className="py-2 px-2.5 font-bold">Bant</th>
                                    <th className="py-2 px-2 text-right font-bold">CNC</th>
                                    <th className="py-2 px-2 text-right font-bold">Alan (m²)</th>
                                    <th className="py-2 pl-1.5 pr-3 w-10 text-right font-bold">DXF</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-[#ECE7DC] text-[11.5px]">
                                  {grp.pieces.map((p, idx) => {
                                    const isSel = activeCutPiece?.id === p.id;
                                    const isChk = checkedCutIds.has(p.id);
                                    const bandCount = countActiveBands(p.edgeBanding);
                                    const holeCount = p.holes?.length || 0;
                                    return (
                                      <tr
                                        key={p.id}
                                        onClick={() => {
                                          setSelectedCutPieceId(p.id);
                                          if (!inspectorOpen) setInspectorOpen(true);
                                        }}
                                        className={`group cursor-pointer transition-colors ${
                                          isSel ? "bg-blue-50/75" : "hover:bg-[#FAF7F1]"
                                        }`}
                                      >
                                        <td
                                          className="py-2.5 pl-3.5 pr-2 relative"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {isSel && (
                                            <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-blue-700 rounded-r" />
                                          )}
                                          <input
                                            type="checkbox"
                                            checked={isChk}
                                            onChange={() => toggleCutRowChecked(p.id)}
                                            className="rounded border-stone-300 accent-[#141413] cursor-pointer"
                                          />
                                        </td>
                                        <td className="py-2.5 px-2">
                                          <div className="flex items-center gap-1.5">
                                            <span className="font-mono text-[10px] text-[#A8A29E] tabular-nums">
                                              {String(idx + 1).padStart(2, "0")}
                                            </span>
                                            <span className="font-bold text-[#141413]">{p.pieceName}</span>
                                          </div>
                                          {(showTechIds ||
                                            p.tambourTrackGrooveSpec ||
                                            p.kerfBendingMeta ||
                                            p.hasBackGroove ||
                                            (p.polygonContourMm && p.polygonContourMm.length > 4)) && (
                                            <div className="flex flex-wrap items-center gap-1 mt-0.5 pl-5">
                                              {showTechIds && (
                                                <span className="text-[10px] text-[#78716C] font-mono">{p.id}</span>
                                              )}
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
                                          )}
                                        </td>
                                        <td className="py-2.5 px-2 text-right font-mono font-bold text-[#141413] tabular-nums whitespace-nowrap">
                                          {p.lengthMm} × {p.widthMm}
                                        </td>
                                        <td className="py-2.5 px-2 text-right font-mono font-bold text-emerald-800 tabular-nums whitespace-nowrap">
                                          {p.netCutLengthMm ?? p.lengthMm} × {p.netCutWidthMm ?? p.widthMm}
                                        </td>
                                        <td className="py-2.5 px-2.5 whitespace-nowrap">
                                          <div className="flex items-center gap-2">
                                            <MiniEdgeBandSvg edgeBanding={p.edgeBanding} />
                                            <span
                                              className={`font-mono text-[10.5px] font-bold ${
                                                bandCount === 4 ? "text-amber-800" : "text-[#57534E]"
                                              }`}
                                            >
                                              {p.edgeBandCode || (bandCount > 0 ? `${bandCount}K` : "—")}
                                            </span>
                                          </div>
                                        </td>
                                        <td className="py-2.5 px-2 text-right font-mono tabular-nums whitespace-nowrap">
                                          {holeCount > 0 ? (
                                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-800">
                                              <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                                              {holeCount}
                                            </span>
                                          ) : (
                                            <span className="text-[#A8A29E]">—</span>
                                          )}
                                        </td>
                                        <td className="py-2.5 px-2 text-right font-mono text-[#57534E] tabular-nums whitespace-nowrap">
                                          {p.areaM2}
                                        </td>
                                        <td
                                          className="py-2.5 pl-1.5 pr-3 text-right"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <button
                                            type="button"
                                            onClick={() => downloadPieceDXF(p)}
                                            className="p-1.5 rounded-lg text-[#57534E] hover:text-white hover:bg-[#141413] transition cursor-pointer"
                                            title={`${p.pieceName} için katmanlı AutoCAD DXF indir`}
                                          >
                                            <FileCode className="w-3.5 h-3.5" />
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}

                  {/* Clean Table Totals Footer */}
                  <div className="px-4 py-2.5 bg-[#F4F0E8] border-t border-[#E5DFD3] flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <span className="text-[#78716C] font-medium">
                      Satıra tıklayarak sağdaki 2D teknik çizimde delik, kanal ve bant detaylarını inceleyin
                    </span>
                    <div className="font-mono font-bold tabular-nums text-[#141413] flex items-center gap-2.5">
                      <span>{bom.summary.totalPiecesCount} Parça</span>
                      <span className="text-[#A8A29E]">•</span>
                      <span className="text-blue-800">{bom.summary.totalEdgeBandMeters} mt Bant</span>
                      <span className="text-[#A8A29E]">•</span>
                      <span className="text-amber-900">{bom.summary.totalPanelAreaM2} m² Alan</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT: 2D TECHNICAL BLUEPRINT INSPECTOR (340px on xl, full width below) */}
              {inspectorOpen && activeCutPiece && (
                <aside className="w-full xl:w-[340px] shrink-0 bg-white border border-[#E5DFD3] rounded-2xl shadow-2xs overflow-hidden flex flex-col">
                  {/* Inspector Header */}
                  <div className="px-4 py-3 bg-[#F5F2EA] border-b border-[#E5DFD3] space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] font-extrabold uppercase tracking-wider text-blue-800">
                        Parça #{String(Math.max(1, bom.cutList.findIndex((x) => x.id === activeCutPiece.id) + 1)).padStart(2, "0")} / {bom.cutList.length}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => navigateCutPiece(-1)}
                          className="w-6 h-6 rounded-lg bg-white border border-[#DED8CC] text-[#57534E] hover:text-[#141413] flex items-center justify-center cursor-pointer"
                          title="Önceki parça"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => navigateCutPiece(1)}
                          className="w-6 h-6 rounded-lg bg-white border border-[#DED8CC] text-[#57534E] hover:text-[#141413] flex items-center justify-center cursor-pointer"
                          title="Sonraki parça"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setInspectorOpen(false)}
                          className="w-6 h-6 rounded-lg bg-white border border-[#DED8CC] text-[#57534E] hover:text-[#141413] flex items-center justify-center cursor-pointer ml-0.5"
                          title="Paneli gizle"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <h3 className="text-[13px] font-extrabold text-[#141413] leading-snug">
                      {activeCutPiece.pieceName}
                    </h3>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] text-[#78716C] truncate">
                        {activeCutPiece.id}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyPieceId(activeCutPiece.id)}
                        className="text-[#78716C] hover:text-blue-700 transition shrink-0 cursor-pointer"
                        title="Teknik kodu kopyala"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Blueprint SVG Canvas + 3 Layer Toggles */}
                  <div className="p-4 space-y-3.5">
                    <div>
                      <CutPieceBlueprintSvg piece={activeCutPiece} layers={blueprintLayers} />
                      <div className="mt-2 grid grid-cols-3 gap-1.5">
                        {(
                          [
                            { key: "bant", label: "Bant", dot: "bg-amber-500" },
                            { key: "cnc", label: "CNC", dot: "bg-blue-500" },
                            { key: "olcu", label: "Ölçü", dot: "bg-emerald-500" },
                          ] as const
                        ).map((ly) => {
                          const on = blueprintLayers[ly.key];
                          return (
                            <button
                              key={ly.key}
                              type="button"
                              onClick={() =>
                                setBlueprintLayers((prev) => ({ ...prev, [ly.key]: !prev[ly.key] }))
                              }
                              className={`h-7 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 border transition cursor-pointer ${
                                on
                                  ? "bg-[#141413] text-white border-[#141413]"
                                  : "bg-[#FAF8F4] text-[#78716C] border-[#DED8CC] hover:text-[#141413]"
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${on ? ly.dot : "bg-stone-400"}`} />
                              <span>{ly.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 2-Column Technical Spec Grid */}
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 pt-2.5 border-t border-[#ECE7DC] text-xs">
                      <div>
                        <div className="text-[10px] text-[#78716C] font-semibold">Bitmiş Ölçü</div>
                        <div className="font-mono font-bold text-[#141413] tabular-nums mt-0.5">
                          {activeCutPiece.lengthMm} × {activeCutPiece.widthMm} mm
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#78716C] font-semibold">Testere Net</div>
                        <div className="font-mono font-bold text-emerald-800 tabular-nums mt-0.5">
                          {activeCutPiece.netCutLengthMm ?? activeCutPiece.lengthMm} × {activeCutPiece.netCutWidthMm ?? activeCutPiece.widthMm} mm
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#78716C] font-semibold">Kalınlık</div>
                        <div className="font-mono font-bold text-[#141413] mt-0.5">
                          {activeCutPiece.thicknessMm} mm
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#78716C] font-semibold">Alan</div>
                        <div className="font-mono font-bold text-[#141413] tabular-nums mt-0.5">
                          {activeCutPiece.areaM2} m²
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#78716C] font-semibold">Kenar Bandı</div>
                        <div className="font-mono font-bold text-amber-800 mt-0.5">
                          {activeCutPiece.edgeBandCode || `${countActiveBands(activeCutPiece.edgeBanding)} Kenar`}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#78716C] font-semibold">CNC Operasyon</div>
                        <div className="font-bold text-blue-800 mt-0.5">
                          {(activeCutPiece.holes?.length || 0) > 0
                            ? `${activeCutPiece.holes!.length} Delik`
                            : activeCutPiece.hasBackGroove
                            ? "8mm Kanal"
                            : "İşlem Yok"}
                        </div>
                      </div>
                    </div>

                    {/* Active DXF Layers */}
                    <div className="pt-2.5 border-t border-[#ECE7DC]">
                      <div className="text-[10px] text-[#78716C] font-semibold mb-1.5">
                        Aktif DXF Katmanları (AC1015)
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {getPieceDxfLayers(activeCutPiece).map((ly) => (
                          <span
                            key={ly}
                            className="px-1.5 py-0.5 rounded bg-[#F5F2EA] border border-[#E5DFD3] font-mono text-[9.5px] font-semibold text-[#44403C]"
                          >
                            {ly}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 2 Crisp Bottom Actions */}
                  <div className="p-3 border-t border-[#E5DFD3] bg-[#F5F2EA] grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => downloadPieceDXF(activeCutPiece)}
                      className="h-8 rounded-xl bg-[#141413] hover:bg-stone-800 text-xs font-bold text-white inline-flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-amber-300" />
                      <span>DXF İndir</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLabelPreviewPiece(activeCutPiece)}
                      className="h-8 rounded-xl bg-white hover:bg-[#EFECE4] border border-[#DED8CC] text-xs font-bold text-[#141413] inline-flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Tag className="w-3.5 h-3.5 text-orange-700" />
                      <span>100×50 Etiket</span>
                    </button>
                  </div>
                </aside>
              )}
            </div>
          )}
    </>
  );
};
