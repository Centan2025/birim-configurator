"use client";

import React, { useState } from "react";
import type { HandleCategory } from "@birim/core";
import {
  type HandleProfileDefinition,
  type HardwareProductRecord,
  registerCustomHandleProfile,
  removeCustomHandleProfile,
  getCustomHandleProfiles,
  registerCustomHardwareProduct,
  removeCustomHardwareProduct,
  getCustomHardwareProducts,
} from "@birim/catalog";
import { BirimLogo } from "../../design-system";
import { startZeroLagModalDrag } from "../../design-system/zeroLagDrag";
import { Wrench, Plus, Trash2, Check, X } from "lucide-react";

interface CustomHardwareModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyHandleToActiveBay: (spec: {
    handleCategory: HandleCategory;
    handleProfileId: string;
    handleLengthMm: number;
    handleMaterialId: string;
  }) => void;
  onApplyHandleToAllBays: (spec: {
    handleCategory: HandleCategory;
    handleProfileId: string;
    handleLengthMm: number;
    handleMaterialId: string;
  }) => void;
  onCatalogChanged: () => void;
}

const FINISH_OPTIONS = [
  { id: "mat_handle_matte_black", label: "Eloksal Mat Siyah", hex: "#1E2022" },
  { id: "mat_handle_inox", label: "Saten İnox / Çelik", hex: "#C8CCD0" },
  { id: "mat_handle_brass", label: "Fırçalı Antik Pirinç", hex: "#C4A466" },
  { id: "mat_handle_anthracite", label: "Koyu Antrasit", hex: "#3D4045" },
  { id: "mat_veneer_oak", label: "Doğal Meşe Ahşap", hex: "#B98B56" },
  { id: "mat_veneer_walnut", label: "Amerikan Ceviz", hex: "#5B3E2B" },
] as const;

export const CustomHardwareModal: React.FC<CustomHardwareModalProps> = ({
  isOpen,
  onClose,
  onApplyHandleToActiveBay,
  onApplyHandleToAllBays,
  onCatalogChanged,
}) => {
  const [activeTab, setActiveTab] = useState<"handle" | "hardware">("handle");

  // Handle form state
  const [hSku, setHSku] = useState<string>("K-OZEL-320");
  const [hName, setHName] = useState<string>("Birim Mimari İnce Çubuk Kulp");
  const [hCategory, setHCategory] = useState<HandleCategory>("bar_handle");
  const [hLengthMm, setHLengthMm] = useState<number>(352);
  const [hHoleCcMm, setHHoleCcMm] = useState<number>(320);
  const [hSingleScrew, setHSingleScrew] = useState<boolean>(false);
  const [hProtrusionMm, setHProtrusionMm] = useState<number>(28);
  const [hFinishId, setHFinishId] = useState<string>("mat_handle_brass");
  const [hPriceEur, setHPriceEur] = useState<number>(14.5);

  // Hardware mechanism form state
  const [hwFamily, setHwFamily] = useState<HardwareProductRecord["familyId"]>("fam_hinge_concealed");
  const [hwMfrName, setHwMfrName] = useState<string>("Blum / Özel Tedarik");
  const [hwSku, setHwSku] = useState<string>("HW-OZEL-01");
  const [hwName, setHwName] = useState<string>("Özel Frenli Menteşe / Ray Donanımı");
  const [hwLoadKg, setHwLoadKg] = useState<number>(40);
  const [hwPriceEur, setHwPriceEur] = useState<number>(12.0);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [, setRefreshTick] = useState<number>(0);

  if (!isOpen) return null;

  const customHandles = getCustomHandleProfiles();
  const customHwList = getCustomHardwareProducts();
  const activeFinish = FINISH_OPTIONS.find((f) => f.id === hFinishId) || FINISH_OPTIONS[0];

  const handleSaveCustomHandle = (applyScope: "none" | "bay" | "module") => {
    const cleanSku = hSku.trim().toUpperCase() || `K-${Date.now().toString().slice(-4)}`;
    const cleanName = hName.trim() || `Özel Kulp (${cleanSku})`;
    const isKnobOrPocket =
      hCategory === "knob" ||
      hCategory === "recessed_grip" ||
      hCategory === "edge_profile" ||
      hCategory === "gola_profile" ||
      hCategory === "j_pull";
    const effCc =
      isKnobOrPocket || hSingleScrew
        ? null
        : Math.max(32, Math.min(1600, Math.round(hHoleCcMm)));
    const effLen = Math.max(
      effCc ? effCc + 24 : 32,
      Math.min(2200, Math.round(hLengthMm))
    );

    const record: HandleProfileDefinition & {
      totalLengthMm?: number;
      defaultFinishMaterialId?: string;
    } = {
      id: `hnd_custom_${cleanSku.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
      sku: cleanSku,
      name: `${cleanName}${effCc ? ` (C-C ${effCc}mm)` : ""}`,
      category: hCategory,
      holeSpacingCcMm: effCc,
      protrusionMm: Math.max(0, Math.min(80, Math.round(hProtrusionMm))),
      doorHeightDeductionMm: hCategory === "gola_profile" ? 30 : hCategory === "edge_profile" ? 2 : 0,
      minDoorThicknessMm: 16,
      unitPriceEur: Math.max(0, Number(hPriceEur) || 0),
      totalLengthMm: effLen,
      defaultFinishMaterialId: hFinishId,
    };

    registerCustomHandleProfile(record);
    onCatalogChanged();
    setRefreshTick((t) => t + 1);

    if (applyScope === "bay") {
      onApplyHandleToActiveBay({
        handleCategory: hCategory,
        handleProfileId: cleanSku,
        handleLengthMm: effLen,
        handleMaterialId: hFinishId,
      });
      setStatusBanner(`"${cleanName}" [${cleanSku}] kataloğa eklendi ve seçili bölmeye uygulandı.`);
    } else if (applyScope === "module") {
      onApplyHandleToAllBays({
        handleCategory: hCategory,
        handleProfileId: cleanSku,
        handleLengthMm: effLen,
        handleMaterialId: hFinishId,
      });
      setStatusBanner(`"${cleanName}" [${cleanSku}] kataloğa eklendi ve modüldeki tüm kapaklara uygulandı.`);
    } else {
      setStatusBanner(`"${cleanName}" [${cleanSku}] kulp kataloğuna kaydedildi (CNC Ø5mm C-C delik + BOM hazır).`);
    }
  };

  const handleSaveCustomHardware = () => {
    const cleanSku = hwSku.trim().toUpperCase() || `HW-${Date.now().toString().slice(-4)}`;
    const cleanName = hwName.trim() || `Özel Donanım (${cleanSku})`;
    const newHw: HardwareProductRecord = {
      id: `hw_custom_${cleanSku.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
      manufacturerId: "mfr_hafele",
      manufacturerName: hwMfrName.trim() || "Özel Tedarik",
      familyId: hwFamily,
      sku: cleanSku,
      name: cleanName,
      revision: "2026.1",
      lifecycleStatus: "ACTIVE",
      loadCapacityKg: Math.max(5, Math.round(hwLoadKg)),
      compatibleModuleFamilies: [
        "fam_wardrobe",
        "fam_kitchen_base",
        "fam_kitchen_wall",
        "fam_kitchen_tall",
        "fam_bathroom_storage",
        "fam_bespoke_custom",
      ],
      compatibleDoorSystems: [
        "hinged_single",
        "hinged_double",
        "sliding_top_hung",
        "lift_bi_fold",
        "lift_up_stay",
      ],
      unitPriceEur: Math.max(0, Number(hwPriceEur) || 0),
      unit: hwFamily === "fam_hinge_concealed" ? "adet" : "takım",
      sourceId: "SRC_BIRIM_FACTORY_V3",
      verification: {
        sourceTechDataVerified: true,
        cadGeometryVerified: true,
        bomFormulaVerified: true,
        drillingPatternVerified: true,
        physicalFactorySampleTested: false,
      },
    };
    registerCustomHardwareProduct(newHw);
    onCatalogChanged();
    setRefreshTick((t) => t + 1);
    setStatusBanner(`"${cleanName}" [${cleanSku}] proje donanım kütüphanesine eklendi.`);
  };

  return (
    <div
      data-testid="custom-hardware-studio-modal"
      onClick={onClose}
      className="fixed inset-0 z-[155] flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-3 sm:p-5"
    >
      <div
        data-draggable-shell="custom-hardware-modal"
        onClick={(e) => e.stopPropagation()}
        className="birim-ice-modal rounded-[28px] max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden text-[#141413]"
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
                Yeni Kulp &amp; Donanım Tanımlama Merkezi
              </h2>
              <p className="text-[11px] text-[#475569] truncate">
                Özel kulp (boy, C-C delik aksı, yüzey, fiyat) ve mekanizma SKU&apos;larını 3D sahne, CNC delik ve BOM listesine ekleyin
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

        {/* Mode Switcher */}
        <div className="px-5 py-2.5 bg-white/40 border-b border-white/60 flex items-center justify-between gap-2">
          <div className="inline-flex items-center p-1 rounded-2xl birim-ice-pill gap-1">
            <button
              type="button"
              onClick={() => setActiveTab("handle")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === "handle"
                  ? "birim-ice-charcoal-pill"
                  : "text-slate-700 hover:bg-white/60"
              }`}
            >
              + Yeni Kulp / Profil Ekle ({customHandles.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("hardware")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === "hardware"
                  ? "birim-ice-charcoal-pill"
                  : "text-slate-700 hover:bg-white/60"
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>+ Menteşe / Ray / Aksesuar Donanımı Ekle ({customHwList.length})</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {statusBanner && (
            <div className="px-3.5 py-2 rounded-2xl bg-emerald-950/90 text-emerald-100 font-semibold flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{statusBanner}</span>
              </span>
              <button
                type="button"
                onClick={() => setStatusBanner(null)}
                className="text-emerald-300 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {activeTab === "handle" ? (
            <div className="space-y-4">
              {/* Live Technical Preview Card + Form */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-5 p-4 rounded-2xl birim-ice-card flex flex-col items-center justify-between gap-3">
                  <div className="w-full flex items-center justify-between text-[10px] font-mono text-slate-600">
                    <span className="font-bold text-[#141413]">{hSku || "K-OZEL"}</span>
                    <span>€{Number(hPriceEur || 0).toFixed(2)} / adet</span>
                  </div>

                  {/* Interactive 2D/Isometric Technical Handle Diagram */}
                  <svg viewBox="0 0 240 128" className="w-full h-28">
                    <rect x="20" y="16" width="200" height="92" rx="8" fill="#E8E4DC" stroke="#BFB8AA" strokeWidth="1.5" />
                    {hCategory === "knob" ? (
                      <>
                        <circle cx="120" cy="62" r="18" fill={activeFinish.hex} stroke="#141413" strokeWidth="1.5" />
                        <circle cx="115" cy="56" r="5" fill="#ffffff" fillOpacity="0.28" />
                        <circle cx="120" cy="62" r="2.5" fill="#0ea5e9" />
                        <text x="120" y="98" textAnchor="middle" fontSize="9.5" fontFamily="monospace" fill="#334155">
                          Tek Vida Ø5mm • Ø32 Topuz
                        </text>
                      </>
                    ) : hCategory === "recessed_grip" ? (
                      <>
                        <rect x="65" y="46" width="110" height="32" rx="6" fill="#27272A" stroke={activeFinish.hex} strokeWidth="4" />
                        <text x="120" y="98" textAnchor="middle" fontSize="9.5" fontFamily="monospace" fill="#334155">
                          Gömme Kulp Yuvası ({hLengthMm}mm)
                        </text>
                      </>
                    ) : (
                      <>
                        {/* Standoff posts + Ø5mm CNC drill axes */}
                        <line x1="62" y1="36" x2="62" y2="86" stroke="#0284c7" strokeWidth="1" strokeDasharray="3 2" />
                        <line x1="178" y1="36" x2="178" y2="86" stroke="#0284c7" strokeWidth="1" strokeDasharray="3 2" />
                        <rect x="57" y="48" width="10" height="14" rx="2" fill={activeFinish.hex} />
                        <rect x="173" y="48" width="10" height="14" rx="2" fill={activeFinish.hex} />
                        {/* Main Bar Grip */}
                        <rect x="44" y="40" width="152" height="12" rx="4" fill={activeFinish.hex} stroke="#141413" strokeOpacity="0.35" />
                        <line x1="48" y1="43" x2="192" y2="43" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1.5" />
                        {/* Dimension C-C arrow */}
                        <line x1="62" y1="80" x2="178" y2="80" stroke="#0284c7" strokeWidth="1.4" />
                        <circle cx="62" cy="80" r="2.5" fill="#0284c7" />
                        <circle cx="178" cy="80" r="2.5" fill="#0284c7" />
                        <text x="120" y="95" textAnchor="middle" fontSize="9.5" fontWeight="700" fontFamily="monospace" fill="#0369a1">
                          {hSingleScrew ? "Tek Vida Ø5mm" : `CNC C-C: ${hHoleCcMm} mm (2×Ø5mm)`}
                        </text>
                        <text x="120" y="29" textAnchor="middle" fontSize="9" fontFamily="monospace" fill="#475569">
                          Toplam Boy: {hLengthMm} mm • Çıkıntı: {hProtrusionMm} mm
                        </text>
                      </>
                    )}
                  </svg>

                  <div className="text-center">
                    <div className="font-bold text-[#141413] text-xs">{hName || "Özel Kulp"}</div>
                    <div className="text-[10px] text-slate-600">{activeFinish.label}</div>
                  </div>
                </div>

                <div className="md:col-span-7 space-y-3">
                  <div className="grid grid-cols-2 gap-2.5">
                    <label className="space-y-1 block">
                      <span className="font-bold text-slate-700">Kulp Stok Kodu (SKU)</span>
                      <input
                        type="text"
                        data-testid="custom-handle-sku-input"
                        value={hSku}
                        onChange={(e) => setHSku(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl bg-white/80 border border-slate-300 font-mono font-bold text-[#141413]"
                      />
                    </label>
                    <label className="space-y-1 block">
                      <span className="font-bold text-slate-700">Kulp Tipi</span>
                      <select
                        value={hCategory}
                        onChange={(e) => setHCategory(e.target.value as HandleCategory)}
                        className="w-full px-3 py-1.5 rounded-xl bg-white/80 border border-slate-300 font-semibold text-[#141413]"
                      >
                        <option value="bar_handle">Çubuk / Köprü Kulp</option>
                        <option value="long_profile_handle">Uzun Dikey Gardırop Kulpu</option>
                        <option value="knob">Düğme / Topuz Kulp (Tek Vida)</option>
                        <option value="edge_profile">Kenar Geçme Alüminyum Kulp</option>
                        <option value="recessed_grip">Gömme Sürgü / Kapak Kulpu</option>
                        <option value="decorative_bespoke">Dekoratif Özel Mimari Kulp</option>
                      </select>
                    </label>
                  </div>

                  <label className="space-y-1 block">
                    <span className="font-bold text-slate-700">Kulp Model Adı</span>
                    <input
                      type="text"
                      data-testid="custom-handle-name-input"
                      value={hName}
                      onChange={(e) => setHName(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl bg-white/80 border border-slate-300 font-medium text-[#141413]"
                    />
                  </label>

                  <div className="grid grid-cols-3 gap-2">
                    <label className="space-y-1 block">
                      <span className="font-bold text-slate-700">Toplam Boy (mm)</span>
                      <input
                        type="number"
                        min={24}
                        max={2200}
                        step={16}
                        value={hLengthMm}
                        onChange={(e) => setHLengthMm(Number(e.target.value) || 160)}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white/80 border border-slate-300 font-mono font-bold text-[#141413]"
                      />
                    </label>
                    <label className="space-y-1 block">
                      <span className="font-bold text-slate-700">Delik Aksı C-C (mm)</span>
                      <input
                        type="number"
                        disabled={hCategory === "knob" || hSingleScrew}
                        min={32}
                        max={1600}
                        step={32}
                        value={hHoleCcMm}
                        onChange={(e) => {
                          const cc = Number(e.target.value) || 160;
                          setHHoleCcMm(cc);
                          if (hLengthMm < cc + 20) setHLengthMm(cc + 32);
                        }}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white/80 border border-slate-300 font-mono font-bold text-[#141413] disabled:opacity-45"
                      />
                    </label>
                    <label className="space-y-1 block">
                      <span className="font-bold text-slate-700">Birim Fiyat (€)</span>
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={hPriceEur}
                        onChange={(e) => setHPriceEur(Number(e.target.value) || 0)}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white/80 border border-slate-300 font-mono font-bold text-[#141413]"
                      />
                    </label>
                  </div>

                  {/* Standard System-32 C-C Quick Presets */}
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[10px] font-bold text-slate-600 mr-1">Standart C-C Aks:</span>
                    {[96, 128, 160, 192, 256, 320, 480, 960].map((cc) => (
                      <button
                        key={cc}
                        type="button"
                        onClick={() => {
                          setHSingleScrew(false);
                          setHHoleCcMm(cc);
                          setHLengthMm(cc + 32);
                        }}
                        className={`px-2 py-0.5 rounded-lg font-mono text-[10px] font-bold border cursor-pointer ${
                          !hSingleScrew && hHoleCcMm === cc
                            ? "bg-[#141413] text-white border-[#141413]"
                            : "bg-white/75 text-slate-700 border-slate-300"
                        }`}
                      >
                        {cc}mm
                      </button>
                    ))}
                  </div>

                  {/* Finish Swatches */}
                  <div className="space-y-1">
                    <span className="font-bold text-slate-700 block">Yüzey &amp; Malzeme Kaplaması</span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {FINISH_OPTIONS.map((fin) => (
                        <button
                          key={fin.id}
                          type="button"
                          onClick={() => setHFinishId(fin.id)}
                          className={`px-2.5 py-1.5 rounded-xl border flex items-center gap-2 text-left cursor-pointer transition ${
                            hFinishId === fin.id
                              ? "bg-[#141413] text-white border-[#141413]"
                              : "bg-white/75 text-slate-800 border-slate-300 hover:bg-white"
                          }`}
                        >
                          <span
                            className="w-4 h-4 rounded-full border border-white/60 shrink-0"
                            style={{ backgroundColor: fin.hex }}
                          />
                          <span className="text-[10.5px] font-bold truncate">{fin.label.split(" ")[1] || fin.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-white/60">
                <button
                  type="button"
                  data-testid="save-custom-handle-only-btn"
                  onClick={() => handleSaveCustomHandle("none")}
                  className="px-3.5 py-2 rounded-xl birim-ice-btn font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Sadece Kataloğa Kaydet</span>
                </button>
                <button
                  type="button"
                  data-testid="save-apply-custom-handle-bay-btn"
                  onClick={() => handleSaveCustomHandle("bay")}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Kaydet &amp; Seçili Bölmeye Uygula</span>
                </button>
                <button
                  type="button"
                  data-testid="save-apply-custom-handle-module-btn"
                  onClick={() => handleSaveCustomHandle("module")}
                  className="px-4 py-2 rounded-xl birim-ice-charcoal-pill font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Kaydet &amp; Modüldeki Tüm Kapaklara Uygula</span>
                </button>
              </div>

              {/* Saved Custom Handles List */}
              {customHandles.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-white/60">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    Projeye Eklenen Özel Kulplar ({customHandles.length})
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {customHandles.map((ch) => {
                      const ext = ch as HandleProfileDefinition & {
                        totalLengthMm?: number;
                        defaultFinishMaterialId?: string;
                      };
                      const len = ext.totalLengthMm || (ch.holeSpacingCcMm ? ch.holeSpacingCcMm + 32 : 160);
                      const fin = ext.defaultFinishMaterialId || "mat_handle_matte_black";
                      return (
                        <div
                          key={ch.id}
                          className="p-2.5 rounded-2xl bg-white/70 border border-white/85 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="font-bold text-[#141413] truncate">
                              [{ch.sku}] {ch.name}
                            </div>
                            <div className="text-[10px] font-mono text-slate-600">
                              Boy: {len}mm • {ch.holeSpacingCcMm ? `C-C ${ch.holeSpacingCcMm}mm` : "Tek Vida / Profil"} • €{ch.unitPriceEur.toFixed(2)}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                onApplyHandleToAllBays({
                                  handleCategory: ch.category,
                                  handleProfileId: ch.sku,
                                  handleLengthMm: len,
                                  handleMaterialId: fin,
                                })
                              }
                              className="px-2.5 py-1 rounded-lg bg-[#141413] text-white text-[10px] font-bold cursor-pointer"
                            >
                              Uygula
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                removeCustomHandleProfile(ch.id);
                                onCatalogChanged();
                                setRefreshTick((t) => t + 1);
                              }}
                              className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                              title="Sil"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="space-y-1 block">
                  <span className="font-bold text-slate-700">Donanım Grubu</span>
                  <select
                    value={hwFamily}
                    onChange={(e) => setHwFamily(e.target.value as HardwareProductRecord["familyId"])}
                    className="w-full px-3 py-1.5 rounded-xl bg-white/80 border border-slate-300 font-semibold text-[#141413]"
                  >
                    <option value="fam_hinge_concealed">Tas Menteşe Sistemi (Ø35mm)</option>
                    <option value="fam_runner_concealed">Gizli Çekmece Rayı / Tandem</option>
                    <option value="fam_drawer_box">Metal Yanlı Çekmece Sistemi</option>
                    <option value="fam_lift_system">Yukarı Kalkar Kapak Mekanizması</option>
                    <option value="fam_sliding_system">Sürgülü Kapak Mekanizması</option>
                    <option value="fam_wardrobe_acc">Gardırop İç Aksesuarı (Pantolonluk vb.)</option>
                  </select>
                </label>
                <label className="space-y-1 block">
                  <span className="font-bold text-slate-700">Üretici / Marka</span>
                  <input
                    type="text"
                    value={hwMfrName}
                    onChange={(e) => setHwMfrName(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-white/80 border border-slate-300 font-medium text-[#141413]"
                  />
                </label>
                <label className="space-y-1 block">
                  <span className="font-bold text-slate-700">Üretici Stok Kodu (SKU)</span>
                  <input
                    type="text"
                    value={hwSku}
                    onChange={(e) => setHwSku(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-white/80 border border-slate-300 font-mono font-bold text-[#141413]"
                  />
                </label>
                <label className="space-y-1 block">
                  <span className="font-bold text-slate-700">Donanım Adı</span>
                  <input
                    type="text"
                    value={hwName}
                    onChange={(e) => setHwName(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-white/80 border border-slate-300 font-medium text-[#141413]"
                  />
                </label>
                <label className="space-y-1 block">
                  <span className="font-bold text-slate-700">Taşıma Kapasitesi (kg)</span>
                  <input
                    type="number"
                    min={5}
                    max={120}
                    value={hwLoadKg}
                    onChange={(e) => setHwLoadKg(Number(e.target.value) || 30)}
                    className="w-full px-3 py-1.5 rounded-xl bg-white/80 border border-slate-300 font-mono font-bold text-[#141413]"
                  />
                </label>
                <label className="space-y-1 block">
                  <span className="font-bold text-slate-700">Birim / Takım Fiyatı (€)</span>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={hwPriceEur}
                    onChange={(e) => setHwPriceEur(Number(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 rounded-xl bg-white/80 border border-slate-300 font-mono font-bold text-[#141413]"
                  />
                </label>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  data-testid="save-custom-hardware-product-btn"
                  onClick={handleSaveCustomHardware}
                  className="px-4 py-2 rounded-xl birim-ice-charcoal-pill font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Donanımı Proje Kütüphanesine Ekle</span>
                </button>
              </div>

              {customHwList.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-white/60">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    Projeye Eklenen Özel Donanımlar ({customHwList.length})
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {customHwList.map((item) => (
                      <div
                        key={item.id}
                        className="p-2.5 rounded-2xl bg-white/70 border border-white/85 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-[#141413] truncate">
                            [{item.sku}] {item.name}
                          </div>
                          <div className="text-[10px] font-mono text-slate-600">
                            {item.manufacturerName} • {item.loadCapacityKg}kg • €{item.unitPriceEur.toFixed(2)}/{item.unit}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            removeCustomHardwareProduct(item.id);
                            onCatalogChanged();
                            setRefreshTick((t) => t + 1);
                          }}
                          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                          title="Sil"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
