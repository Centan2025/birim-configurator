"use client";

import React, { useState } from "react";
import type { DesignProject, MaterialDefinition } from "@birim/core";
import { BirimLogo } from "../../design-system";
import { startZeroLagModalDrag } from "../../design-system/zeroLagDrag";
import { getMaterialSwatchStyle } from "../../materials/pbrMaterialSystem";
import { Plus, Compass, Layers, X, Check } from "lucide-react";

export interface AddKitchenIslandSpec {
  widthMm: number;
  depthMm: number;
  heightMm: number;
  aisleClearanceMm: number;
  barOverhangMm: number;
  waterfallLeft: boolean;
  waterfallRight: boolean;
  countertopMaterialId: string;
}

export interface AddAttachedTableSpec {
  anchorModuleIndex: number;
  attachSide: "right_end" | "left_end" | "front_center_t" | "front_right_corner";
  angleDeg: number; // 0 = collinear extension, 90 = T/L perpendicular, 30/45/-45 = angled!
  lengthMm: number;
  widthMm: number;
  tableHeightMm: number; // 750 dining, 900 flush counter, 1050 high bar
  legStyle: "waterfall_slab" | "metal_u_frame" | "pedestal_column";
  topMaterialId: string;
}

interface KitchenIslandTableModalProps {
  isOpen: boolean;
  project: DesignProject;
  materials: MaterialDefinition[];
  activeModuleIndex: number;
  onAddIsland: (spec: AddKitchenIslandSpec) => void;
  onAddOrUpdateAttachedTable: (spec: AddAttachedTableSpec) => void;
  onClose: () => void;
}

export const KitchenIslandTableModal: React.FC<KitchenIslandTableModalProps> = ({
  isOpen,
  project,
  materials,
  activeModuleIndex,
  onAddIsland,
  onAddOrUpdateAttachedTable,
  onClose,
}) => {
  const [tab, setTab] = useState<"island" | "table">("table");
  const [banner, setBanner] = useState<string | null>(null);

  // Island state
  const [islW, setIslW] = useState<number>(1800);
  const [islD, setIslD] = useState<number>(950);
  const [islH, setIslH] = useState<number>(870);
  const [aisleMm, setAisleMm] = useState<number>(1100);
  const [overhangMm, setOverhangMm] = useState<number>(260);
  const [wfLeft, setWfLeft] = useState<boolean>(true);
  const [wfRight, setWfRight] = useState<boolean>(true);
  const [islTopMat, setIslTopMat] = useState<string>("mat_quartz_calacatta");

  // Attached Angled Table state
  const candidateAnchors = project.modules
    .map((m, idx) => ({ m, idx }))
    .filter(({ m }) => m.category !== "complementary");
  const defaultAnchorIdx =
    candidateAnchors.find(({ m }) => m.category === "kitchen_island")?.idx ??
    activeModuleIndex;

  const [anchorIdx, setAnchorIdx] = useState<number>(defaultAnchorIdx);
  const [attachSide, setAttachSide] = useState<AddAttachedTableSpec["attachSide"]>("right_end");
  const [angleDeg, setAngleDeg] = useState<number>(45);
  const [tblLen, setTblLen] = useState<number>(1600);
  const [tblWidth, setTblWidth] = useState<number>(850);
  const [tblHeight, setTblHeight] = useState<number>(750);
  const [legStyle, setLegStyle] = useState<AddAttachedTableSpec["legStyle"]>("metal_u_frame");
  const [tblMatId, setTblMatId] = useState<string>("mat_veneer_oak");

  if (!isOpen) return null;

  const topMatChoices = materials.filter(
    (m) => m.category === "wood" || m.category === "stone" || m.category === "lacquer" || m.category === "compact"
  );

  const previewRad = (angleDeg * Math.PI) / 180;
  const pTblDx = Math.cos(previewRad) * 95;
  const pTblDz = Math.sin(previewRad) * 95;

  return (
    <div
      data-testid="kitchen-island-table-modal"
      onClick={onClose}
      className="fixed inset-0 z-[158] flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-3 sm:p-5"
    >
      <div
        data-draggable-shell="island-table-modal"
        onClick={(e) => e.stopPropagation()}
        className="birim-ice-modal rounded-[28px] max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden text-[#141413]"
      >
        {/* Header with Official Birim Logo */}
        <div
          onPointerDown={(e) => startZeroLagModalDrag(e)}
          title="Pencereyi taşımak için sürükleyin"
          className="px-5 py-3.5 birim-ice-shell-header flex items-center justify-between gap-3 cursor-grab active:cursor-grabbing select-none"
        >
          <div className="flex items-center gap-3 min-w-0">
            <BirimLogo className="h-5 w-auto text-[#141413] shrink-0" />
            <div className="h-4 w-px bg-slate-900/15 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-[#141413] truncate">
                Ada Mutfak &amp; Tezgâha / Adaya Bağlı Açılı Masa Stüdyosu
              </h2>
              <p className="text-[11px] text-[#475569] truncate">
                Şelale tezgâhlı mutfak adası ve 0° / 30° / 45° / 90° / serbest açıda birleşen yemek &amp; bar masaları oluşturun
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl birim-ice-btn flex items-center justify-center text-slate-700 hover:text-slate-950 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-2.5 bg-white/40 border-b border-white/60 flex items-center gap-2">
          <div className="inline-flex items-center p-1 rounded-2xl birim-ice-pill gap-1 text-xs">
            <button
              type="button"
              onClick={() => setTab("table")}
              className={`px-3.5 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 ${
                tab === "table" ? "birim-ice-charcoal-pill" : "text-slate-700 hover:bg-white/60"
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Tezgâha / Adaya Bağlı Açılı Masa (0°–135°)</span>
            </button>
            <button
              type="button"
              onClick={() => setTab("island")}
              className={`px-3.5 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 ${
                tab === "island" ? "birim-ice-charcoal-pill" : "text-slate-700 hover:bg-white/60"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Şelale Tezgâhlı Ada Mutfak Ünitesi</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {banner && (
            <div className="px-3.5 py-2 rounded-2xl bg-emerald-950/90 text-emerald-100 font-semibold flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>{banner}</span>
              </span>
              <button type="button" onClick={() => setBanner(null)} className="cursor-pointer">
                ✕
              </button>
            </div>
          )}

          {tab === "table" ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* Live 2D Top-Plan Angle Connection Diagram */}
                <div className="md:col-span-5 p-3.5 rounded-2xl birim-ice-card flex flex-col items-center justify-between">
                  <div className="w-full flex items-center justify-between text-[10px] font-mono text-slate-600">
                    <span className="font-bold text-[#141413]">Üstten Birleşim Planı</span>
                    <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-bold">{angleDeg}° Açı</span>
                  </div>
                  <svg viewBox="0 0 260 185" className="w-full h-40">
                    <rect x="6" y="6" width="248" height="173" rx="12" fill="#F8FAFC" stroke="#E2E8F0" />
                    {/* Base / Island Anchor Block */}
                    <rect x="28" y="38" width="96" height="54" rx="5" fill="#CBD5E1" stroke="#334155" strokeWidth="2" />
                    <text x="76" y="69" textAnchor="middle" fontSize="9.5" fontWeight="800" fill="#0F172A">
                      ADA / TEZGÂH
                    </text>

                    {/* Pivot Joint + Angled Attached Table (Exact Room-Plan Heading Match) */}
                    {(() => {
                      const px =
                        attachSide === "left_end"
                          ? 28
                          : attachSide === "front_center_t"
                          ? 76
                          : 124;
                      const pz =
                        attachSide === "front_center_t" || attachSide === "front_right_corner"
                          ? 92
                          : 65;
                      const planHeadingDeg =
                        attachSide === "left_end"
                          ? 180 - angleDeg
                          : attachSide === "front_center_t"
                          ? angleDeg === 90 || angleDeg === 0
                            ? 90
                            : 90 - angleDeg
                          : angleDeg;
                      return (
                        <g>
                          <g transform={`translate(${px}, ${pz}) rotate(${planHeadingDeg})`}>
                            <rect
                              x={0}
                              y={-18}
                              width={96}
                              height={36}
                              rx={4}
                              fill="#D8B892"
                              stroke="#7C2D12"
                              strokeWidth="2"
                            />
                            <text x="48" y="4" textAnchor="middle" fontSize="8.5" fontWeight="800" fill="#431407">
                              MASA ({tblLen}mm)
                            </text>
                          </g>
                          <circle cx={px} cy={pz} r="4.5" fill="#0284C7" stroke="#ffffff" strokeWidth="1.5" />
                        </g>
                      );
                    })()}
                    <text x="130" y="168" textAnchor="middle" fontSize="9.5" fontFamily="monospace" fill="#475569">
                      Kot: H={tblHeight}mm • {tblLen}×{tblWidth}mm • Açı: {angleDeg}° ({Math.round(Math.hypot(pTblDx, pTblDz)) > 0 ? "Canlı 3D+2D" : ""})
                    </text>
                  </svg>
                </div>

                {/* Controls */}
                <div className="md:col-span-7 space-y-3">
                  <div className="grid grid-cols-2 gap-2.5">
                    <label className="space-y-1 block">
                      <span className="font-bold text-slate-700">Bağlanacağı Modül / Ada</span>
                      <select
                        value={anchorIdx}
                        onChange={(e) => setAnchorIdx(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white/85 border border-slate-300 font-semibold text-[#141413]"
                      >
                        {candidateAnchors.map(({ m, idx }) => (
                          <option key={m.id} value={idx}>
                            #{idx + 1} {m.name} ({m.dimensions.width}mm)
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1 block">
                      <span className="font-bold text-slate-700">Kenetlenme Noktası</span>
                      <select
                        value={attachSide}
                        onChange={(e) => setAttachSide(e.target.value as AddAttachedTableSpec["attachSide"])}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white/85 border border-slate-300 font-semibold text-[#141413]"
                      >
                        <option value="right_end">Sağ Uçtan Uzanan Masa</option>
                        <option value="front_center_t">Ön Cepheden T-Masa</option>
                        <option value="front_right_corner">Sağ Ön Köşeden Açılı</option>
                        <option value="left_end">Sol Uçtan Uzanan Masa</option>
                      </select>
                    </label>
                  </div>

                  {/* Angle Presets + Continuous Slider */}
                  <div className="space-y-1.5 p-2.5 rounded-2xl bg-white/65 border border-white/85">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">Masa Birleşim Açısı</span>
                      <span className="font-mono font-black text-[#141413]">{angleDeg}°</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {[
                        { deg: 0, lbl: "0° Doğrusal" },
                        { deg: 30, lbl: "30° Açılı" },
                        { deg: 45, lbl: "45° Diyagonal" },
                        { deg: 90, lbl: "90° Dik (T/L)" },
                        { deg: -45, lbl: "-45° Ters Açı" },
                      ].map((ap) => (
                        <button
                          key={ap.deg}
                          type="button"
                          onClick={() => setAngleDeg(ap.deg)}
                          className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold border cursor-pointer ${
                            angleDeg === ap.deg
                              ? "bg-[#141413] text-white border-[#141413]"
                              : "bg-white text-slate-700 border-slate-300"
                          }`}
                        >
                          {ap.lbl}
                        </button>
                      ))}
                    </div>
                    <input
                      type="range"
                      min={-90}
                      max={135}
                      step={5}
                      value={angleDeg}
                      onChange={(e) => setAngleDeg(Number(e.target.value))}
                      className="w-full accent-[#141413] h-1.5 bg-slate-300 rounded-lg cursor-pointer"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <label className="space-y-1 block">
                      <span className="font-bold text-slate-700">Masa Boyu (mm)</span>
                      <input
                        type="number"
                        min={700}
                        max={2800}
                        step={50}
                        value={tblLen}
                        onChange={(e) => setTblLen(Number(e.target.value) || 1500)}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white/85 border border-slate-300 font-mono font-bold"
                      />
                    </label>
                    <label className="space-y-1 block">
                      <span className="font-bold text-slate-700">Genişlik (mm)</span>
                      <input
                        type="number"
                        min={550}
                        max={1200}
                        step={50}
                        value={tblWidth}
                        onChange={(e) => setTblWidth(Number(e.target.value) || 850)}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white/85 border border-slate-300 font-mono font-bold"
                      />
                    </label>
                    <label className="space-y-1 block">
                      <span className="font-bold text-slate-700">Yükseklik Kotu</span>
                      <select
                        value={tblHeight}
                        onChange={(e) => setTblHeight(Number(e.target.value))}
                        className="w-full px-2 py-1.5 rounded-xl bg-white/85 border border-slate-300 font-mono font-bold text-[11px]"
                      >
                        <option value={750}>750mm Yemek</option>
                        <option value={870}>870mm Tezgâh</option>
                        <option value={1050}>1050mm Bar</option>
                      </select>
                    </label>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: "metal_u_frame" as const, lbl: "Mat Siyah U-Ayak" },
                      { id: "waterfall_slab" as const, lbl: "Şelale Plaka Ayak" },
                      { id: "pedestal_column" as const, lbl: "Silindirik Sütun" },
                    ].map((ls) => (
                      <button
                        key={ls.id}
                        type="button"
                        onClick={() => setLegStyle(ls.id)}
                        className={`py-1.5 px-2 rounded-xl border text-[10.5px] font-bold cursor-pointer ${
                          legStyle === ls.id
                            ? "bg-[#141413] text-white border-[#141413]"
                            : "bg-white/75 text-slate-700 border-slate-300"
                        }`}
                      >
                        {ls.lbl}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Table Top Material Picker */}
              <div className="space-y-1.5">
                <span className="font-bold text-slate-700 block">Masa Tablası Malzemesi</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {topMatChoices.slice(0, 8).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setTblMatId(m.id)}
                      className={`p-2 rounded-xl border flex items-center gap-2 text-left cursor-pointer ${
                        tblMatId === m.id
                          ? "bg-[#141413] text-white border-[#141413]"
                          : "bg-white/75 text-slate-800 border-slate-300"
                      }`}
                    >
                      <span
                        className="w-5 h-5 rounded-lg border border-white/60 shrink-0"
                        style={getMaterialSwatchStyle(m)}
                      />
                      <span className="text-[10.5px] font-bold truncate">{m.name.split(" (")[0]}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-white/60">
                <button
                  type="button"
                  data-testid="confirm-add-attached-table-btn"
                  onClick={() => {
                    onAddOrUpdateAttachedTable({
                      anchorModuleIndex: anchorIdx,
                      attachSide,
                      angleDeg,
                      lengthMm: tblLen,
                      widthMm: tblWidth,
                      tableHeightMm: tblHeight,
                      legStyle,
                      topMaterialId: tblMatId,
                    });
                    setBanner(`${angleDeg}° açılı masa (${tblLen}×${tblWidth}×H${tblHeight}mm) tezgâha/adaya bağlandı!`);
                  }}
                  className="px-4 py-2 rounded-xl birim-ice-charcoal-pill font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-emerald-300" />
                  <span>Açılı Masayı Tezgâha / Adaya Bağla</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <label className="space-y-1 block">
                  <span className="font-bold text-slate-700">Ada Genişliği (mm)</span>
                  <input
                    type="number"
                    min={900}
                    max={3200}
                    step={100}
                    value={islW}
                    onChange={(e) => setIslW(Number(e.target.value) || 1800)}
                    className="w-full px-3 py-1.5 rounded-xl bg-white/85 border border-slate-300 font-mono font-bold"
                  />
                </label>
                <label className="space-y-1 block">
                  <span className="font-bold text-slate-700">Ada Derinliği (mm)</span>
                  <input
                    type="number"
                    min={700}
                    max={1300}
                    step={50}
                    value={islD}
                    onChange={(e) => setIslD(Number(e.target.value) || 950)}
                    className="w-full px-3 py-1.5 rounded-xl bg-white/85 border border-slate-300 font-mono font-bold"
                  />
                </label>
                <label className="space-y-1 block">
                  <span className="font-bold text-slate-700">Koridor Boşluğu (mm)</span>
                  <input
                    type="number"
                    min={850}
                    max={1800}
                    step={50}
                    value={aisleMm}
                    onChange={(e) => setAisleMm(Number(e.target.value) || 1100)}
                    className="w-full px-3 py-1.5 rounded-xl bg-white/85 border border-slate-300 font-mono font-bold"
                  />
                </label>
                <label className="space-y-1 block">
                  <span className="font-bold text-slate-700">Bar Çıkıntısı (mm)</span>
                  <input
                    type="number"
                    min={0}
                    max={400}
                    step={20}
                    value={overhangMm}
                    onChange={(e) => setOverhangMm(Number(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 rounded-xl bg-white/85 border border-slate-300 font-mono font-bold"
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-3 p-3 rounded-2xl bg-white/65 border border-white/85">
                <label className="inline-flex items-center gap-2 font-bold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={wfLeft}
                    onChange={(e) => setWfLeft(e.target.checked)}
                    className="w-4 h-4 accent-[#141413]"
                  />
                  <span>Sol Şelale Taş Yan İniş (40mm)</span>
                </label>
                <label className="inline-flex items-center gap-2 font-bold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={wfRight}
                    onChange={(e) => setWfRight(e.target.checked)}
                    className="w-4 h-4 accent-[#141413]"
                  />
                  <span>Sağ Şelale Taş Yan İniş (40mm)</span>
                </label>
                <span className="text-[11px] text-slate-500 ml-auto font-mono">
                  Yükseklik: {islH}mm + 40mm Tezgâh
                </span>
              </div>

              <div className="space-y-1.5">
                <span className="font-bold text-slate-700 block">Ada Tezgâh &amp; Şelale Taş Malzemesi</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {topMatChoices.slice(0, 8).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setIslTopMat(m.id)}
                      className={`p-2 rounded-xl border flex items-center gap-2 text-left cursor-pointer ${
                        islTopMat === m.id
                          ? "bg-[#141413] text-white border-[#141413]"
                          : "bg-white/75 text-slate-800 border-slate-300"
                      }`}
                    >
                      <span
                        className="w-5 h-5 rounded-lg border border-white/60 shrink-0"
                        style={getMaterialSwatchStyle(m)}
                      />
                      <span className="text-[10.5px] font-bold truncate">{m.name.split(" (")[0]}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/60">
                <span className="text-[11px] text-slate-600">
                  İpucu: Ada eklendikten sonra üstteki sekmeden adaya 0° / 45° / 90° açılı yemek masası bağlayabilirsiniz.
                </span>
                <button
                  type="button"
                  data-testid="confirm-add-kitchen-island-btn"
                  onClick={() => {
                    onAddIsland({
                      widthMm: islW,
                      depthMm: islD,
                      heightMm: islH,
                      aisleClearanceMm: aisleMm,
                      barOverhangMm: overhangMm,
                      waterfallLeft: wfLeft,
                      waterfallRight: wfRight,
                      countertopMaterialId: islTopMat,
                    });
                    setBanner(`Şelale tezgâhlı Ada Mutfak (${islW}×${islD}mm) sahneye yerleştirildi!`);
                  }}
                  className="px-4 py-2 rounded-xl birim-ice-charcoal-pill font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-emerald-300" />
                  <span>Ada Mutfak Ünitesini Sahneye Ekle</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
