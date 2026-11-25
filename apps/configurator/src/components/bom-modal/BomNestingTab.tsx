"use client";
import React from "react";
import { Download, FileCode } from "lucide-react";
import { BirimLogo, V3PremiumDropdown } from "../../v3/design-system";
import {
  adjustErpGrooveSideForRotation,
  type ManufacturingBOM,
  type buildBirimErpNestingBundle,
} from "@birim/manufacturing";

export interface BomNestingTabProps {
  activeTab: string;
  bom: ManufacturingBOM;
  downloadErpCncGCode: () => void;
  downloadErpNestingJson: () => void;
  downloadErpSelcoCsv: () => void;
  erpAlgorithm: "Auto" | "Guillotine" | "MaxRects";
  erpCommonCut: boolean;
  erpKerf: number;
  erpMargin: number;
  erpNestingBundle: ReturnType<typeof buildBirimErpNestingBundle> | null;
  erpSheetHeight: 2100 | 2070;
  erpUseNetCut: boolean;
  printBomOrNestingSheet: (mode: "nesting" | "bom") => void;
  setErpAlgorithm: React.Dispatch<React.SetStateAction<"Auto" | "Guillotine" | "MaxRects">>;
  setErpCommonCut: React.Dispatch<React.SetStateAction<boolean>>;
  setErpKerf: React.Dispatch<React.SetStateAction<number>>;
  setErpMargin: React.Dispatch<React.SetStateAction<number>>;
  setErpSheetHeight: React.Dispatch<React.SetStateAction<2100 | 2070>>;
  setErpUseNetCut: React.Dispatch<React.SetStateAction<boolean>>;
  setShowCutSequences: React.Dispatch<React.SetStateAction<boolean>>;
  setShowErpContractPreview: React.Dispatch<React.SetStateAction<boolean>>;
  showCutSequences: boolean;
  showErpContractPreview: boolean;
}

export const BomNestingTab: React.FC<BomNestingTabProps> = (props) => {
  const {
    activeTab,
    bom,
    downloadErpCncGCode,
    downloadErpNestingJson,
    downloadErpSelcoCsv,
    erpAlgorithm,
    erpCommonCut,
    erpKerf,
    erpMargin,
    erpNestingBundle,
    erpSheetHeight,
    erpUseNetCut,
    printBomOrNestingSheet,
    setErpAlgorithm,
    setErpCommonCut,
    setErpKerf,
    setErpMargin,
    setErpSheetHeight,
    setErpUseNetCut,
    setShowCutSequences,
    setShowErpContractPreview,
    showCutSequences,
    showErpContractPreview,
  } = props;
  return (
    <>
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
                      onClick={() => printBomOrNestingSheet("nesting")}
                      data-testid="bom-print-nesting-a4-btn"
                      className="px-3 py-1.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>🖨 Plaka Yerleşimini Yazdır (A4)</span>
                    </button>
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

                                  const isLNotchPanel = /L-Köşe.*Tek Parça|İç Boşaltmalı/i.test(pl.part_label);
                                  const isDiagChamferPanel = !isLNotchPanel && /Diyagonal.*(Alt|Üst|Raf)|pentagon/i.test(`${pl.part_label} ${pl.part_id}`);
                                  const isRoundedSlabPanel = !isLNotchPanel && !isDiagChamferPanel && /(Kapsül|Stadyum|R-Köşe|R-Köşeli).*(Alt Tabla|Üst Tabla|Masa Tablası|Mermer|Kuvars)/i.test(pl.part_label);
                                  const rMatch = isRoundedSlabPanel ? pl.part_label.match(/R=(\d+)/i) : null;
                                  const roundedSlabR = isRoundedSlabPanel
                                    ? Math.min(Math.floor(Math.min(pw, ph) / 2), rMatch ? Number(rMatch[1]) : Math.floor(Math.min(pw, ph) * 0.48))
                                    : 4;
                                  const matchedCut = isLNotchPanel
                                    ? bom.cutList.find((cp) => cp.pieceName === pl.part_label || pl.part_id.startsWith(cp.id))
                                    : undefined;
                                  const rawNw = matchedCut?.cutoutWidthMm || Math.round(pw * 0.39);
                                  const rawNh = matchedCut?.cutoutDepthMm || Math.round(ph * 0.39);
                                  const notchW = Math.min(Math.round(pw * 0.65), Math.max(80, rot === 90 || rot === 270 ? rawNh : rawNw));
                                  const notchH = Math.min(Math.round(ph * 0.65), Math.max(80, rot === 90 || rot === 270 ? rawNw : rawNh));
                                  const lPolyPoints = isLNotchPanel
                                    ? `${pl.x},${pl.y} ${pl.x + pw},${pl.y} ${pl.x + pw},${pl.y + ph - notchH} ${pl.x + pw - notchW},${pl.y + ph - notchH} ${pl.x + pw - notchW},${pl.y + ph} ${pl.x},${pl.y + ph}`
                                    : "";

                                  return (
                                    <g key={pl.part_id}>
                                      {isLNotchPanel ? (
                                        <>
                                          <polygon
                                            points={lPolyPoints}
                                            fill={pl.color || "#3B82F6"}
                                            fillOpacity={0.84}
                                            stroke="#0F172A"
                                            strokeWidth="5"
                                            strokeLinejoin="round"
                                          />
                                          <rect
                                            x={pl.x + pw - notchW}
                                            y={pl.y + ph - notchH}
                                            width={notchW}
                                            height={notchH}
                                            fill="#F8FAFC"
                                            fillOpacity={0.92}
                                            stroke="#DC2626"
                                            strokeWidth="5"
                                            strokeDasharray="18 10"
                                          />
                                          <line
                                            x1={pl.x + pw - notchW}
                                            y1={pl.y + ph - notchH}
                                            x2={pl.x + pw}
                                            y2={pl.y + ph}
                                            stroke="#DC2626"
                                            strokeOpacity={0.35}
                                            strokeWidth="3"
                                          />
                                          <line
                                            x1={pl.x + pw}
                                            y1={pl.y + ph - notchH}
                                            x2={pl.x + pw - notchW}
                                            y2={pl.y + ph}
                                            stroke="#DC2626"
                                            strokeOpacity={0.35}
                                            strokeWidth="3"
                                          />
                                          <text
                                            x={pl.x + pw - notchW / 2}
                                            y={pl.y + ph - notchH / 2 - 12}
                                            textAnchor="middle"
                                            fontSize={Math.max(20, Math.min(30, Math.floor(notchW / 12)))}
                                            fontWeight="800"
                                            fill="#B91C1C"
                                          >
                                            CNC L-BOŞALTMA
                                          </text>
                                          <text
                                            x={pl.x + pw - notchW / 2}
                                            y={pl.y + ph - notchH / 2 + 20}
                                            textAnchor="middle"
                                            fontSize={Math.max(18, Math.min(28, Math.floor(notchW / 11)))}
                                            fontWeight="700"
                                            fontFamily="ui-monospace, monospace"
                                            fill="#991B1B"
                                          >
                                            {Math.round(notchW)}×{Math.round(notchH)}
                                          </text>
                                        </>
                                      ) : isDiagChamferPanel ? (
                                        <>
                                          <polygon
                                            points={`${pl.x},${pl.y} ${pl.x + pw},${pl.y} ${pl.x + pw},${pl.y + Math.round(ph * 0.6)} ${pl.x + Math.round(pw * 0.6)},${pl.y + ph} ${pl.x},${pl.y + ph}`}
                                            fill={pl.color || "#3B82F6"}
                                            fillOpacity={0.84}
                                            stroke="#0F172A"
                                            strokeWidth="5"
                                            strokeLinejoin="round"
                                          />
                                          <polygon
                                            points={`${pl.x + pw},${pl.y + Math.round(ph * 0.6)} ${pl.x + pw},${pl.y + ph} ${pl.x + Math.round(pw * 0.6)},${pl.y + ph}`}
                                            fill="#F8FAFC"
                                            fillOpacity={0.92}
                                            stroke="#DC2626"
                                            strokeWidth="5"
                                            strokeDasharray="16 10"
                                          />
                                        </>
                                      ) : isRoundedSlabPanel ? (
                                        <>
                                          <rect
                                            x={pl.x}
                                            y={pl.y}
                                            width={pw}
                                            height={ph}
                                            fill="none"
                                            stroke="#DC2626"
                                            strokeWidth="3"
                                            strokeDasharray="14 10"
                                            strokeOpacity={0.55}
                                          />
                                          <rect
                                            x={pl.x}
                                            y={pl.y}
                                            width={pw}
                                            height={ph}
                                            rx={roundedSlabR}
                                            ry={roundedSlabR}
                                            fill={pl.color || "#3B82F6"}
                                            fillOpacity={0.84}
                                            stroke="#0F172A"
                                            strokeWidth="5"
                                          />
                                        </>
                                      ) : (
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
                                      )}
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
    </>
  );
};
