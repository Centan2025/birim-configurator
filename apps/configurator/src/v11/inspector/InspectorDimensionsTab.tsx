"use client";
import React from "react";
import { X, Plus, Minus, Scissors } from "lucide-react";
import {
  resolveMultiHoleSpec,
  calculateSlopedCeilingGeometry,
  resolveSpaceCeilingConfig,
  computeEffectiveCeilingClearHeight,
  type BackPanelType,
  type CarcassConfig,
  type CarcassJoineryTopology,
  type DesignProject,
  type JointType,
  type MaterialDefinition,
  type ModuleInstance,
  type MultiHoleBoringMode,
  type PlinthConstructionType,
} from "@birim/core";
import { useConfiguratorStore } from "../../store/useConfiguratorStore";
import { renderPlinthIcon, renderMultiHoleIcon, renderBackPanelIcon } from "./inspectorSvgIcons";
import { StudioToggleSwitch, StudioSelect } from "./InspectorControls";
import type { V11InspectorTab } from "../v11Constants";

import type { RightParametricInspectorProps } from "../RightParametricInspector";

export interface InspectorDimensionsTabProps {
  activeHullShape: string;
  activeModule: ModuleInstance;
  activeTab: V11InspectorTab;
  curDoorType: string;
  dMm: number;
  facadeGrainContinuity: boolean;
  hMm: number;
  hasAnyInternalDrawer: boolean;
  hasBaseboardNotch: boolean;
  internalDrawerBlindControlPanel: React.ReactNode;
  isCapsuleOrRounded: boolean;
  isSimple: boolean;
  isSlidingBay: boolean;
  isTableOrIslandMod: boolean;
  materials: MaterialDefinition[];
  onBeginSliderDrag?: RightParametricInspectorProps["onBeginSliderDrag"];
  onCommitSliderDrag?: RightParametricInspectorProps["onCommitSliderDrag"];
  onOpenCutoutModal: RightParametricInspectorProps["onOpenCutoutModal"];
  onRunAutoFillersAndCrown: RightParametricInspectorProps["onRunAutoFillersAndCrown"];
  onSetDimensions: RightParametricInspectorProps["onSetDimensions"];
  onSetPlinthHeight: RightParametricInspectorProps["onSetPlinthHeight"];
  onToggleFacadeGrainContinuity: RightParametricInspectorProps["onToggleFacadeGrainContinuity"];
  onUpdateCarcassConfig: RightParametricInspectorProps["onUpdateCarcassConfig"];
  plinthMm: number;
  reactiveSpace: DesignProject["space"];
  renderApplyCarcassToAllBtn: (
    key: string,
    label: string,
    patch: Partial<CarcassConfig>
  ) => React.ReactNode;
  setUnitMode: (unit: "cm" | "mm") => void;
  unitMode: "cm" | "mm";
  wMm: number;
}

interface DimensionNumberInputProps {
  label: string;
  unitMode: "cm" | "mm";
  valMm: number;
  minMm: number;
  maxMm: number;
  displayNum: number;
  onApply: (nextMm: number) => void;
}

const DimensionNumberInput: React.FC<DimensionNumberInputProps> = ({
  label,
  unitMode,
  valMm,
  minMm,
  maxMm,
  displayNum,
  onApply,
}) => {
  const [draftText, setDraftText] = React.useState<string | null>(null);
  const valueStr = draftText !== null ? draftText : String(displayNum);

  return (
    <input
      type="number"
      inputMode="decimal"
      value={valueStr}
      step={unitMode === "cm" ? 1 : 10}
      onFocus={() => setDraftText(String(displayNum))}
      onChange={(e) => {
        const nextText = e.currentTarget.value;
        setDraftText(nextText);
        const raw = Number(nextText);
        if (!Number.isFinite(raw) || raw <= 0) return;
        const nextMm = unitMode === "cm" ? Math.round(raw * 10) : Math.round(raw);
        if (nextMm >= minMm && nextMm <= maxMm && nextMm !== valMm) {
          onApply(nextMm);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        }
      }}
      onBlur={(e) => {
        const raw = Number(e.currentTarget.value);
        setDraftText(null);
        if (!Number.isFinite(raw) || raw <= 0) return;
        const nextMm = unitMode === "cm" ? Math.round(raw * 10) : Math.round(raw);
        const clamped = Math.max(minMm, Math.min(maxMm, nextMm));
        if (clamped !== valMm) {
          onApply(clamped);
        }
      }}
      className="w-16 bg-transparent font-mono font-bold text-[14px] text-center text-[#141413] outline-none"
      title={`${label} değerini (${unitMode}) girin`}
    />
  );
};

export const InspectorDimensionsTab: React.FC<InspectorDimensionsTabProps> = (props) => {
  const {
    activeHullShape,
    activeModule,
    activeTab,
    curDoorType,
    dMm,
    facadeGrainContinuity,
    hMm,
    hasAnyInternalDrawer,
    hasBaseboardNotch,
    internalDrawerBlindControlPanel,
    isCapsuleOrRounded,
    isSimple,
    isSlidingBay,
    isTableOrIslandMod,
    materials,
    onBeginSliderDrag,
    onCommitSliderDrag,
    onOpenCutoutModal,
    onRunAutoFillersAndCrown,
    onSetDimensions,
    onSetPlinthHeight,
    onToggleFacadeGrainContinuity,
    onUpdateCarcassConfig,
    plinthMm,
    reactiveSpace,
    renderApplyCarcassToAllBtn,
    setUnitMode,
    unitMode,
    wMm,
  } = props;
  return (
    <>
          {activeTab === "dimensions" && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[#78716C]">Ölçü Birimi</span>
                <div className="inline-flex p-0.5 rounded-full bg-[#ECE7DD] border border-[#DFD9CE]">
                  {(["cm", "mm"] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setUnitMode(u)}
                      className={`px-3 py-1 rounded-full text-[11px] font-semibold transition cursor-pointer ${
                        unitMode === u ? "bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] text-white font-bold border border-[#38BDF8]/65 shadow-[0_0_16px_rgba(29,78,216,0.58)]" : "text-[#57534E]"
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              {(
                [
                  {
                    key: "width",
                    label: "Genişlik",
                    valMm: wMm,
                    minMm: isSlidingBay ? 1200 : activeHullShape === "capsule_table" ? 900 : isCapsuleOrRounded ? 650 : 280,
                    maxMm: 3600,
                    stepMm: unitMode === "cm" ? 50 : 10,
                    presetsMm: isSlidingBay
                      ? [1500, 1800, 2200, 2600, 3000]
                      : isCapsuleOrRounded
                      ? [1200, 1600, 2000, 2200, 2600]
                      : isTableOrIslandMod
                      ? [1600, 2000, 2200, 2600]
                      : [600, 900, 1200, 1800, 2400],
                    apply: (next: number) => onSetDimensions(next, hMm, dMm),
                  },
                  {
                    key: "height",
                    label: "Yükseklik",
                    valMm: hMm,
                    minMm: 260,
                    maxMm: 2900,
                    stepMm: unitMode === "cm" ? 20 : 10,
                    presetsMm: isCapsuleOrRounded
                      ? [480, 540, 850, 1050, 1400]
                      : isTableOrIslandMod
                      ? [740, 750, 870, 900]
                      : [520, 870, 2200, 2400, 2600],
                    apply: (next: number) => onSetDimensions(wMm, next, dMm),
                  },
                  {
                    key: "depth",
                    label: "Derinlik",
                    valMm: dMm,
                    minMm: isSlidingBay ? 600 : activeHullShape === "capsule_table" ? 650 : isCapsuleOrRounded ? 340 : 240,
                    maxMm: isTableOrIslandMod ? 1400 : 950,
                    stepMm: unitMode === "cm" ? 20 : 10,
                    presetsMm: isSlidingBay
                      ? [600, 650, 700]
                      : isTableOrIslandMod
                      ? [850, 950, 1000, 1150]
                      : isCapsuleOrRounded
                      ? [380, 440, 450, 500, 580]
                      : [400, 500, 600, 650],
                    apply: (next: number) => onSetDimensions(wMm, hMm, next),
                  },
                ] as const
              ).map((dim) => {
                const displayNum =
                  unitMode === "cm" ? Number((dim.valMm / 10).toFixed(1)) : Math.round(dim.valMm);
                return (
                  <div
                    key={dim.key}
                    className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-[#141413] text-[13px]">{dim.label}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            dim.apply(Math.max(dim.minMm, dim.valMm - dim.stepMm))
                          }
                          className="w-7 h-7 rounded-full bg-[#F5F2EA] hover:bg-[#E7E1D4] flex items-center justify-center cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xl bg-[#FAF8F4] border border-[#DED8CC] focus-within:border-[#141413]">
                          <DimensionNumberInput
                            label={dim.label}
                            unitMode={unitMode}
                            valMm={dim.valMm}
                            minMm={dim.minMm}
                            maxMm={dim.maxMm}
                            displayNum={displayNum}
                            onApply={dim.apply}
                          />
                          <span className="text-[10px] font-normal text-[#78716C] pr-0.5">{unitMode}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            dim.apply(Math.min(dim.maxMm, dim.valMm + dim.stepMm))
                          }
                          className="w-7 h-7 rounded-full bg-[#F5F2EA] hover:bg-[#E7E1D4] flex items-center justify-center cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <input
                      type="range"
                      min={dim.minMm}
                      max={dim.maxMm}
                      step={unitMode === "cm" ? 10 : 5}
                      value={Math.min(dim.maxMm, Math.max(dim.minMm, dim.valMm))}
                      onPointerDown={() => onBeginSliderDrag?.()}
                      onPointerUp={() => onCommitSliderDrag?.()}
                      onPointerCancel={() => onCommitSliderDrag?.()}
                      onBlur={() => onCommitSliderDrag?.()}
                      onChange={(e) => dim.apply(Number(e.target.value))}
                      className="w-full accent-[#141413] cursor-pointer"
                    />

                    <div className="flex flex-wrap gap-1.5">
                      {dim.presetsMm.map((pMm) => {
                        const active = Math.abs(dim.valMm - pMm) < 5;
                        return (
                          <button
                            key={pMm}
                            type="button"
                            onClick={() => dim.apply(pMm)}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold transition cursor-pointer ${
                              active
                                ? "bg-[#141413] text-white"
                                : "bg-[#F5F2EA] hover:bg-[#EAE3D5] text-[#44403C]"
                            }`}
                          >
                            {unitMode === "cm" ? `${pMm / 10} cm` : `${pMm} mm`}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Baza & Torna Ayak Yüksekliği */}
              {activeHullShape !== "capsule_table" && (
                <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#141413]">
                      {isCapsuleOrRounded ? "Alt Ayak / Baza Yüksekliği" : "Alt Baza Yüksekliği"}
                    </span>
                    <span className="font-mono text-[#78716C]">
                      {plinthMm === 0 ? "Bazasız" : unitMode === "cm" ? `${Number((plinthMm / 10).toFixed(1))} cm` : `${Math.round(plinthMm)} mm`}
                    </span>
                  </div>
                  <div className="grid grid-cols-6 gap-1">
                    {[
                      { mm: 0, label: "Yok" },
                      { mm: 80, label: unitMode === "cm" ? "8 cm" : "80 mm" },
                      { mm: 100, label: unitMode === "cm" ? "10 cm" : "100 mm" },
                      { mm: 150, label: unitMode === "cm" ? "15 cm" : "150 mm" },
                      { mm: 160, label: unitMode === "cm" ? "16 cm" : "160 mm" },
                      { mm: 180, label: unitMode === "cm" ? "18 cm" : "180 mm" },
                    ].map((pl) => (
                      <button
                        key={pl.mm}
                        type="button"
                        onClick={() => onSetPlinthHeight(pl.mm)}
                        className={`py-2 rounded-xl text-[11px] font-semibold transition cursor-pointer ${
                          Math.abs(plinthMm - pl.mm) < 5
                            ? "bg-[#141413] text-white"
                            : "bg-[#F5F2EA] hover:bg-[#EAE3D5] text-[#44403C]"
                        }`}
                      >
                        {pl.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* TAMBUR & KAVİSLİ KAPSÜL GÖVDE MÜHENDİSLİK KARTI — Kolay modda yalnızca kavisli modül seçiliyse gösterilir */}
              {(!isSimple || isCapsuleOrRounded || curDoorType === "tambour") && (
              <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#141413]">Gövde Formu &amp; Tambur Sistemi</span>
                  <span className="text-[10.5px] font-mono text-[#8C7A6B]">
                    {activeHullShape === "capsule_stadium"
                      ? "180° Kapsül"
                      : activeHullShape === "rounded_corners"
                      ? "4×90° R-Köşe"
                      : activeHullShape === "capsule_table"
                      ? "Stadyum Masa"
                      : "Standart Düz"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    [
                      { id: "rectangular", label: "Standart Düz Karkas" },
                      { id: "capsule_stadium", label: "Kapsül Tambur (180°)" },
                      { id: "rounded_corners", label: "R-Köşeli Tambur (90°)" },
                      { id: "capsule_table", label: "Kapsül Stadyum Masa" },
                    ] as const
                  ).map((hs) => {
                    const active = activeHullShape === hs.id;
                    return (
                      <button
                        key={hs.id}
                        type="button"
                        onClick={() => {
                          if (hs.id === "capsule_stadium") {
                            onUpdateCarcassConfig({
                              hullShape: "capsule_stadium",
                              cornerRadiusMm: Math.round(dMm / 2),
                              tambourSlatPitchMm: activeModule.carcass.tambourSlatPitchMm || 22,
                            });
                          } else if (hs.id === "rounded_corners") {
                            onUpdateCarcassConfig({
                              hullShape: "rounded_corners",
                              cornerRadiusMm: Math.min(Math.max(70, Math.floor(dMm / 2) - 30), 110),
                              tambourSlatPitchMm: activeModule.carcass.tambourSlatPitchMm || 20,
                            });
                          } else if (hs.id === "capsule_table") {
                            onUpdateCarcassConfig({
                              hullShape: "capsule_table",
                              cornerRadiusMm: Math.round(dMm / 2),
                              plinthHeight: 0,
                            });
                          } else {
                            const isWallMounted =
                              activeModule.moduleFamilyId === "fam_kitchen_wall" ||
                              activeModule.category === "kitchen_wall";
                            const restoredPlinthH =
                              (activeModule.carcass.plinthHeight || 0) > 0
                                ? activeModule.carcass.plinthHeight
                                : isWallMounted
                                ? 0
                                : activeModule.moduleFamilyId?.startsWith("fam_kitchen")
                                ? 100
                                : 80;
                            onUpdateCarcassConfig({
                              hullShape: "rectangular",
                              cornerRadiusMm: 0,
                              plinthHeight: restoredPlinthH,
                            });
                          }
                        }}
                        className={`py-2 px-2.5 rounded-xl text-[11px] font-semibold text-left transition cursor-pointer ${
                          active
                            ? "bg-[#141413] text-white"
                            : "bg-[#F5F2EA] hover:bg-[#EAE3D5] text-[#44403C]"
                        }`}
                      >
                        {hs.label}
                      </button>
                    );
                  })}
                </div>

                {(isCapsuleOrRounded || curDoorType === "tambour") && (
                  <div className="pt-2 border-t border-[#F0ECE3] space-y-2.5">
                    {activeHullShape === "rounded_corners" && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-[#57534E] font-medium">Köşe Dönüş Yarıçapı (R)</span>
                          <span className="font-mono font-bold">
                            {activeModule.carcass.cornerRadiusMm || 110} mm
                          </span>
                        </div>
                        <input
                          type="range"
                          min={65}
                          max={Math.max(75, Math.floor(dMm / 2) - 20)}
                          step={5}
                          value={Math.min(
                            Math.max(75, Math.floor(dMm / 2) - 20),
                            activeModule.carcass.cornerRadiusMm || 110
                          )}
                          onChange={(e) =>
                            onUpdateCarcassConfig({ cornerRadiusMm: Number(e.target.value) })
                          }
                          className="w-full accent-[#141413] cursor-pointer"
                        />
                      </div>
                    )}

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#57534E] font-medium">Tambur Lamel Adımı</span>
                        <span className="font-mono font-bold">
                          {activeModule.carcass.tambourSlatPitchMm || 22} mm
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1">
                        {[18, 20, 24, 30].map((pitch) => {
                          const curP = activeModule.carcass.tambourSlatPitchMm || 22;
                          return (
                            <button
                              key={pitch}
                              type="button"
                              onClick={() => onUpdateCarcassConfig({ tambourSlatPitchMm: pitch })}
                              className={`py-1.5 rounded-lg font-mono text-[11px] font-semibold cursor-pointer ${
                                Math.abs(curP - pitch) <= 1
                                  ? "bg-[#141413] text-white"
                                  : "bg-[#F5F2EA] text-[#44403C]"
                              }`}
                            >
                              {pitch}mm
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {isCapsuleOrRounded && (
                      <div className="w-full py-2 px-3 rounded-xl bg-[#FAF8F4] border border-[#DED8CC] flex items-center justify-between gap-2 text-[11px] font-semibold text-[#141413]">
                        <span>20mm Gömme Mermer / Kuvars Üst Tabla</span>
                        <StudioToggleSwitch
                          checked={Boolean(
                            activeModule.carcass.countertopMaterialId &&
                              activeModule.carcass.hasCountertopTray !== false
                          )}
                          onChange={(nextOn) =>
                            onUpdateCarcassConfig({
                              hasCountertopTray: nextOn,
                              countertopMaterialId: nextOn
                                ? activeModule.carcass.countertopMaterialId || "mat_quartz_calacatta"
                                : activeModule.carcass.countertopMaterialId,
                            })
                          }
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
              )}


              {hasAnyInternalDrawer && (
                <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3]">
                  {internalDrawerBlindControlPanel}
                </div>
              )}

              {/* Baza & Yan Dikme Yere Oturuşu (Tüm Modlarda Görünür — Dünya Standartları) */}
              <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#141413] text-[12px]">
                    Baza & Yan Dikme Yere Oturuşu
                  </span>
                  <span className="font-mono text-[10px] text-[#78716C]">
                    Baza: {activeModule.carcass.plinthHeight ?? 100} mm
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      {
                        id: "pedestal_box",
                        label: "Baza Üstü",
                        sub: "Bağımsız kutu baza",
                        title: "Avrupa Gardırop Standardı: 4 kenarlı bağımsız baza kutusu, yan dikmeler baza üstünde biter",
                      },
                      {
                        id: "adjustable_legs_clip",
                        label: "Ayar Ayaklı",
                        sub: "DIN 68935 • Klips",
                        title: "Mutfak / Banyo Standardı: Ayarlanabilir ayaklar ve ön klipsli baza bandı",
                      },
                      {
                        id: "gable_rails",
                        label: "Dikme Yere Basar",
                        sub: "İçerlek baza",
                        title: "Gömme / İtalyan Standardı: Sol ve sağ yan dikmeler zemine kadar iner, baza iki dikme arasına oturur",
                      },
                    ] as const
                  ).map((opt) => {
                    const curPlinth: PlinthConstructionType =
                      activeModule.carcass.plinthConstruction ||
                      (activeModule.moduleFamilyId?.startsWith("fam_kitchen")
                        ? "adjustable_legs_clip"
                        : "pedestal_box");
                    const isSel = curPlinth === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        title={opt.title}
                        data-testid={`v11-plinth-${opt.id}`}
                        onClick={() => {
                          const defaultPlinthH = activeModule.moduleFamilyId?.startsWith("fam_kitchen")
                            ? 100
                            : 80;
                          onUpdateCarcassConfig({
                            plinthConstruction: opt.id,
                            ...((activeModule.carcass.plinthHeight || 0) <= 0
                              ? { plinthHeight: defaultPlinthH }
                              : {}),
                          });
                        }}
                        className={`py-2 px-1.5 rounded-xl border text-center transition cursor-pointer flex flex-col items-center gap-1 ${
                          isSel
                            ? "bg-[#141413] text-white border-[#38BDF8] ring-1 ring-[#38BDF8]/40"
                            : "bg-[#F5F2EA] hover:bg-[#EAE3D5] border-[#E5DFD3] text-[#44403C]"
                        }`}
                      >
                        {renderPlinthIcon(opt.id)}
                        <span className="text-[10px] font-bold leading-tight">{opt.label}</span>
                        <span
                          className={`text-[8.5px] leading-tight ${
                            isSel ? "text-slate-300" : "text-[#78716C]"
                          }`}
                        >
                          {opt.sub}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {(activeModule.carcass.plinthHeight ?? 100) >= 90 && (
                  <div className="flex items-center justify-between pt-1 border-t border-[#F0ECE3]">
                    <span className="text-[11px] text-[#57534E]">Baza Çekmecesi</span>
                    <StudioToggleSwitch
                      size="sm"
                      checked={Boolean(activeModule.carcass.hasPlinthDrawer)}
                      onChange={(next) => onUpdateCarcassConfig({ hasPlinthDrawer: next })}
                    />
                  </div>
                )}
                {renderApplyCarcassToAllBtn("plinth", "Baza Ayarını Tüm Modüllere Uygula", {
                  plinthHeight: activeModule.carcass.plinthHeight,
                  plinthConstruction: activeModule.carcass.plinthConstruction,
                  plinthSetbackMm: activeModule.carcass.plinthSetbackMm,
                })}
              </div>

              {/* Gövde Çoklu Delik & Karkas Yapısı (Yalnızca Pro / Üretim) */}
              {!isSimple && (
              <>
              <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] space-y-3">
                <div className="font-bold text-[#141413]">
                  Çoklu Delik & Karkas Detayları
                </div>

                {/* Çoklu Delik Sistemi (System 32 / 5'li Küme) */}
                {(() => {
                  const mhSpec = resolveMultiHoleSpec(activeModule);
                  const mhModes: Array<{ id: MultiHoleBoringMode; label: string }> = [
                    { id: "full_system_32", label: "Tam Boy 32mm" },
                    { id: "zone_32", label: "Kuşak 32mm" },
                    { id: "cluster_5", label: "5'li Küme" },
                    { id: "cluster_3", label: "3'lü Küme" },
                    { id: "single_pin", label: "Tekli Pim" },
                    { id: "none", label: "Deliksiz" },
                  ];
                  return (
                    <div className="space-y-1.5 pt-2 border-t border-[#F0ECE3]">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#57534E] font-medium">Çoklu Delik Sistemi</span>
                        <span className="font-mono text-[10px] text-[#78716C]">Ø5 mm</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        {mhModes.map((mh) => (
                          <button
                            key={mh.id}
                            type="button"
                            data-testid={`v11-multihole-${mh.id}`}
                            onClick={() => onUpdateCarcassConfig({ multiHoleMode: mh.id })}
                            className={`py-1.5 px-1.5 rounded-xl text-[10px] font-semibold transition cursor-pointer flex flex-col items-center gap-1 ${
                              mhSpec.mode === mh.id
                                ? "bg-[#141413] text-white"
                                : "bg-[#F5F2EA] hover:bg-[#EAE3D5] text-[#44403C]"
                            }`}
                          >
                            {renderMultiHoleIcon(mh.id)}
                            <span>{mh.label}</span>
                          </button>
                        ))}
                      </div>
                      {mhSpec.mode !== "none" && (
                        <div className="space-y-2 pt-2 border-t border-[#F0ECE3]">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1">
                              <span className="text-[11px] text-[#57534E] font-medium">Sıra:</span>
                              {([2, 3] as const).map((rc) => (
                                <button
                                  key={rc}
                                  type="button"
                                  onClick={() => onUpdateCarcassConfig({ multiHoleRowCount: rc })}
                                  className={`px-2.5 py-1 rounded-lg text-[10.5px] font-semibold cursor-pointer ${
                                    mhSpec.rowCount === rc
                                      ? "bg-[#141413] text-white"
                                      : "bg-[#F5F2EA] hover:bg-[#EAE3D5] text-[#44403C]"
                                  }`}
                                >
                                  {rc} Sıra
                                </button>
                              ))}
                            </div>
                            <StudioToggleSwitch
                              size="sm"
                              label="3B Delikler"
                              checked={activeModule.carcass.showMultiHolesIn3D !== false}
                              onChange={(next) =>
                                onUpdateCarcassConfig({ showMultiHolesIn3D: next })
                              }
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="space-y-1">
                              <span className="text-[11px] text-[#57534E]">Ön Mesafe (mm)</span>
                              <input
                                type="number" inputMode="decimal"
                                min={28}
                                max={120}
                                step={1}
                                value={
                                  activeModule.carcass.multiHoleFrontSetbackMm ??
                                  mhSpec.frontSetbackMm
                                }
                                onChange={(e) =>
                                  onUpdateCarcassConfig({
                                    multiHoleFrontSetbackMm: Math.max(
                                      28,
                                      Math.min(120, Number(e.target.value) || 37)
                                    ),
                                  })
                                }
                                className="w-full h-9 px-3 rounded-xl bg-[#FAF8F4] border border-[#DED8CC] font-mono text-xs font-semibold"
                              />
                            </label>
                            <label className="space-y-1">
                              <span className="text-[11px] text-[#57534E]">Kenar Payı (mm)</span>
                              <input
                                type="number" inputMode="decimal"
                                min={48}
                                max={192}
                                step={8}
                                value={
                                  activeModule.carcass.multiHoleEdgeMarginMm ??
                                  mhSpec.edgeMarginMm
                                }
                                onChange={(e) =>
                                  onUpdateCarcassConfig({
                                    multiHoleEdgeMarginMm: Math.max(
                                      48,
                                      Math.min(192, Number(e.target.value) || 96)
                                    ),
                                  })
                                }
                                className="w-full h-9 px-3 rounded-xl bg-[#FAF8F4] border border-[#DED8CC] font-mono text-xs font-semibold"
                              />
                            </label>
                          </div>
                          {!isSimple && (
                            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-[#F5F2EA]">
                              <StudioToggleSwitch
                                size="sm"
                                label="Orta Dikme Çift Yön Delik"
                                checked={Boolean(activeModule.carcass.multiHoleDividerThroughBore)}
                                onChange={(next) =>
                                  onUpdateCarcassConfig({ multiHoleDividerThroughBore: next })
                                }
                              />
                            </div>
                          )}
                        </div>
                      )}
                      {renderApplyCarcassToAllBtn("multihole", "32mm Delik Ayarını Tüm Modüllere Uygula", {
                        multiHoleMode: activeModule.carcass.multiHoleMode,
                        multiHoleRowCount: activeModule.carcass.multiHoleRowCount,
                        showMultiHolesIn3D: activeModule.carcass.showMultiHolesIn3D,
                        multiHoleDividerThroughBore: activeModule.carcass.multiHoleDividerThroughBore,
                      })}
                    </div>
                  );
                })()}

                {/* Arkalık 5 Mod + Birleşim Tipi + Kenar Bandı (Detaylı / Üretim) */}
                {!isSimple && (
                  <div className="space-y-2.5 pt-2 border-t border-[#F0ECE3]">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#57534E] font-medium">Arkalık Konstrüksiyonu</span>
                        <span className="font-mono text-[10px] text-[#78716C]">
                          {activeModule.carcass.backPanelThickness || 8} mm
                        </span>
                      </div>
                      <div className="grid grid-cols-5 gap-1">
                        {(
                          [
                            { id: "grooved", label: "Kanallı" },
                            { id: "rebated", label: "Lamba" },
                            { id: "flush", label: "Gömme" },
                            { id: "nailed", label: "Çakma" },
                            { id: "none", label: "Yok" },
                          ] as Array<{ id: BackPanelType; label: string }>
                        ).map((bp) => {
                          const curBp = activeModule.carcass.backPanelType || "grooved";
                          return (
                            <button
                              key={bp.id}
                              type="button"
                              onClick={() => onUpdateCarcassConfig({ backPanelType: bp.id })}
                              className={`py-1.5 px-1 rounded-lg text-[9.5px] font-semibold cursor-pointer flex flex-col items-center gap-0.5 ${
                                curBp === bp.id
                                  ? "bg-[#141413] text-white"
                                  : "bg-[#F5F2EA] hover:bg-[#EAE3D5] text-[#44403C]"
                              }`}
                            >
                              {renderBackPanelIcon(bp.id)}
                              <span>{bp.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <span className="text-[11px] text-[#57534E] block">Birleşim Tipi</span>
                        <StudioSelect
                          ariaLabel="Birleşim Tipi"
                          value={activeModule.carcass.jointType || "minifix_dowel"}
                          onChange={(val) => {
                            const nextJoint = val as JointType;
                            const fallbackTopo: CarcassJoineryTopology =
                              activeModule.category === "kitchen_base" || activeModule.category === "kitchen_island"
                                ? "kitchen_stretchers"
                                : "sides_through";
                            onUpdateCarcassConfig({
                              jointType: nextJoint,
                              ...(nextJoint === "miter_45"
                                ? { carcassJoineryTopology: "miter_45" as CarcassJoineryTopology }
                                : activeModule.carcass.carcassJoineryTopology === "miter_45"
                                ? { carcassJoineryTopology: fallbackTopo }
                                : {}),
                            });
                          }}
                          options={[
                            { value: "minifix_dowel", label: "Minifiks + Kavela" },
                            { value: "dowel_only", label: "Kavela" },
                            { value: "confirmat", label: "Konfirmat Vida" },
                            { value: "miter_45", label: "45° Gönye" },
                          ]}
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[11px] text-[#57534E] block">PVC Kenar Bandı</span>
                        <div className="grid grid-cols-3 gap-1">
                          {([0.4, 1, 2] as const).map((eb) => {
                            const curEb = activeModule.carcass.edgeBandThickness ?? 1;
                            return (
                              <button
                                key={eb}
                                type="button"
                                onClick={() => onUpdateCarcassConfig({ edgeBandThickness: eb })}
                                className={`h-9 rounded-xl font-mono text-xs font-semibold cursor-pointer ${
                                  Math.abs(curEb - eb) < 0.1
                                    ? "bg-[#141413] text-white"
                                    : "bg-[#F5F2EA] text-[#44403C]"
                                }`}
                              >
                                {eb}mm
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[#F0ECE3] space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="px-2.5 py-2 rounded-xl bg-[#F5F2EA] flex items-center justify-between">
                          <StudioToggleSwitch
                            size="sm"
                            label="Şelale Sol"
                            checked={Boolean(activeModule.carcass.hasWaterfallLeft)}
                            onChange={(next) => onUpdateCarcassConfig({ hasWaterfallLeft: next })}
                          />
                        </div>
                        <div className="px-2.5 py-2 rounded-xl bg-[#F5F2EA] flex items-center justify-between">
                          <StudioToggleSwitch
                            size="sm"
                            label="Şelale Sağ"
                            checked={Boolean(activeModule.carcass.hasWaterfallRight)}
                            onChange={(next) => onUpdateCarcassConfig({ hasWaterfallRight: next })}
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-[#57534E]">CNC Ön Freze (mm)</span>
                        <input
                          type="number" inputMode="decimal"
                          min={0}
                          max={5}
                          step={0.5}
                          value={activeModule.carcass.preMillingMm ?? 0}
                          onChange={(e) =>
                            onUpdateCarcassConfig({
                              preMillingMm: Math.max(0, Math.min(5, Number(e.target.value) || 0)),
                            })
                          }
                          className="w-24 h-9 px-3 rounded-xl bg-[#FAF8F4] border border-[#DED8CC] font-mono text-xs font-semibold text-center"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div className="space-y-1">
                          <span className="text-[11px] text-[#57534E] block">Karkas Topolojisi</span>
                          <StudioSelect
                            ariaLabel="Karkas Topolojisi"
                            value={activeModule.carcass.carcassJoineryTopology || "sides_through"}
                            onChange={(val) => {
                              const nextTopo = val as CarcassJoineryTopology;
                              onUpdateCarcassConfig({
                                carcassJoineryTopology: nextTopo,
                                ...(nextTopo === "miter_45"
                                  ? { jointType: "miter_45" as JointType }
                                  : activeModule.carcass.jointType === "miter_45"
                                  ? { jointType: "minifix_dowel" as JointType }
                                  : {}),
                              });
                            }}
                            options={[
                              { value: "sides_through", label: "Tip A: Yan Dikmeler" },
                              { value: "top_bottom_through", label: "Tip B: Alt/Üst Boyda" },
                              { value: "miter_45", label: "Tip C: 45° Gönye" },
                              { value: "kitchen_stretchers", label: "Tip D: Mutfak Kayıtlı" },
                            ]}
                          />
                        </div>
                        <label className="space-y-1">
                          <span className="text-[11px] text-[#57534E]">Baza Geri Çekme (mm)</span>
                          <input
                            type="number" inputMode="decimal"
                            min={0}
                            max={120}
                            step={5}
                            value={activeModule.carcass.plinthSetbackMm ?? 35}
                            onChange={(e) =>
                              onUpdateCarcassConfig({
                                plinthSetbackMm: Math.max(0, Math.min(120, Number(e.target.value) || 0)),
                              })
                            }
                            className="w-full h-9 px-3 rounded-xl bg-[#FAF8F4] border border-[#DED8CC] font-mono text-xs font-semibold"
                          />
                        </label>
                      </div>
                      {renderApplyCarcassToAllBtn("joinery", "Birleşim, Topoloji & Kenar Bandını Tüm Modüllere Uygula", {
                        jointType: activeModule.carcass.jointType,
                        carcassJoineryTopology: activeModule.carcass.carcassJoineryTopology,
                        backPanelType: activeModule.carcass.backPanelType,
                        edgeBandThickness: activeModule.carcass.edgeBandThickness,
                        preMillingMm: activeModule.carcass.preMillingMm,
                        plinthSetbackMm: activeModule.carcass.plinthSetbackMm,
                      })}

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <span className="text-[11px] text-[#57534E] block">Kapak Kalınlığı</span>
                          <StudioSelect
                            ariaLabel="Kapak Kalınlığı"
                            value={activeModule.carcass.doorThickness ?? 18}
                            onChange={(val) =>
                              onUpdateCarcassConfig({ doorThickness: Number(val) || 18 })
                            }
                            options={[
                              { value: "18", label: "18 mm Standart" },
                              { value: "20", label: "20 mm Masif/Lake" },
                              { value: "22", label: "22 mm Kalın" },
                            ]}
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[11px] text-[#57534E] block">Üst Taç Profili</span>
                          <StudioSelect
                            ariaLabel="Üst Taç Profili"
                            value={
                              activeModule.carcass.crownMolding?.enabled
                                ? activeModule.carcass.crownMolding.style
                                : "none"
                            }
                            onChange={(v) => {
                              if (v === "none") {
                                onUpdateCarcassConfig({
                                  crownMolding: {
                                    enabled: false,
                                    style: "modern_flat",
                                    heightMm: 60,
                                    projectionMm: 20,
                                  },
                                });
                              } else {
                                onUpdateCarcassConfig({
                                  crownMolding: {
                                    enabled: true,
                                    style: v as "modern_flat" | "stepped" | "classic_coving" | "led_channel",
                                    heightMm: activeModule.carcass.crownMolding?.heightMm ?? 60,
                                    projectionMm: activeModule.carcass.crownMolding?.projectionMm ?? 25,
                                    materialId: activeModule.carcass.crownMolding?.materialId,
                                  },
                                });
                              }
                            }}
                            options={[
                              { value: "none", label: "Taç Yok" },
                              { value: "modern_flat", label: "Modern Düz" },
                              { value: "stepped", label: "Basamaklı" },
                              { value: "classic_coving", label: "Klasik" },
                              { value: "led_channel", label: "LED Kanallı Taç" },
                            ]}
                          />
                        </div>
                      </div>

                      {activeModule.carcass.crownMolding?.enabled && (() => {
                        const cm = activeModule.carcass.crownMolding!;
                        const curH = cm.heightMm ?? 60;
                        const curProj = cm.projectionMm ?? 25;
                        const ceilH = useConfiguratorStore.getState().project.space?.ceilingHeight || 2600;
                        const gapToCeiling = Math.round(ceilH - ((activeModule.position?.y || 0) + activeModule.dimensions.height));
                        return (
                          <div className="p-2.5 rounded-xl bg-[#F5F2EA] border border-[#E5DFD3] space-y-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-bold text-[#141413]">Taç Profili Ayarları</span>
                              {gapToCeiling >= 25 && gapToCeiling <= 200 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onUpdateCarcassConfig({
                                      crownMolding: { ...cm, enabled: true, heightMm: gapToCeiling },
                                    })
                                  }
                                  className="px-2 py-0.5 rounded-lg bg-[#141413] text-white text-[10px] font-bold cursor-pointer hover:opacity-90 transition"
                                  title="Taç yüksekliğini tavan boşluğuna tam eşitle"
                                >
                                  Tavana Eşitle ({gapToCeiling}mm)
                                </button>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <label className="space-y-1 block">
                                <span className="text-[10.5px] text-[#57534E] flex items-center justify-between">
                                  <span>Taç Yüksekliği</span>
                                  <span className="font-mono font-bold text-[#141413]">{curH} mm</span>
                                </span>
                                <input
                                  type="range"
                                  min={25}
                                  max={200}
                                  step={5}
                                  value={curH}
                                  onChange={(e) =>
                                    onUpdateCarcassConfig({
                                      crownMolding: {
                                        ...cm,
                                        enabled: true,
                                        heightMm: Math.max(25, Math.min(200, Number(e.target.value) || 60)),
                                      },
                                    })
                                  }
                                  className="w-full accent-[#141413] cursor-pointer"
                                />
                              </label>

                              <label className="space-y-1 block">
                                <span className="text-[10.5px] text-[#57534E] flex items-center justify-between">
                                  <span>Ön Taşma / Çıkıntı</span>
                                  <span className="font-mono font-bold text-[#141413]">{curProj} mm</span>
                                </span>
                                <input
                                  type="range"
                                  min={0}
                                  max={120}
                                  step={5}
                                  value={curProj}
                                  onChange={(e) =>
                                    onUpdateCarcassConfig({
                                      crownMolding: {
                                        ...cm,
                                        enabled: true,
                                        projectionMm: Math.max(0, Math.min(120, Number(e.target.value) || 0)),
                                      },
                                    })
                                  }
                                  className="w-full accent-[#141413] cursor-pointer"
                                />
                              </label>
                            </div>

                            <div className="flex flex-wrap items-center gap-1">
                              {[45, 60, 80, 100, 120].map((presetH) => (
                                <button
                                  key={presetH}
                                  type="button"
                                  onClick={() =>
                                    onUpdateCarcassConfig({
                                      crownMolding: { ...cm, enabled: true, heightMm: presetH },
                                    })
                                  }
                                  className={`px-2 py-0.5 rounded-lg font-mono text-[10px] font-bold cursor-pointer transition ${
                                    curH === presetH
                                      ? "bg-[#141413] text-white"
                                      : "bg-white text-[#57534E] border border-[#DED8CC] hover:text-[#141413]"
                                  }`}
                                >
                                  H:{presetH}
                                </button>
                              ))}
                            </div>

                            <div className="space-y-1">
                              <span className="text-[10.5px] text-[#57534E] block">Taç Yüzey Malzemesi</span>
                              <StudioSelect
                                ariaLabel="Taç Yüzey Malzemesi"
                                value={cm.materialId || "__door__"}
                                onChange={(matVal) =>
                                  onUpdateCarcassConfig({
                                    crownMolding: {
                                      ...cm,
                                      enabled: true,
                                      materialId: matVal === "__door__" ? undefined : matVal,
                                    },
                                  })
                                }
                                options={[
                                  { value: "__door__", label: "Kapak Malzemesiyle Aynı" },
                                  ...materials.slice(0, 24).map((m) => ({
                                    value: m.id,
                                    label: m.name,
                                  })),
                                ]}
                              />
                            </div>
                            {renderApplyCarcassToAllBtn("crown", "Taç Profilini Tüm Modüllere Uygula", {
                              crownMolding: activeModule.carcass.crownMolding,
                            })}
                          </div>
                        );
                      })()}

                      <label className="space-y-1 block">
                        <span className="text-[10.5px] text-[#57534E]">CNC Üretim Notu</span>
                        <input
                          type="text"
                          placeholder="Fabrika / atölye kesim notu..."
                          value={activeModule.carcass.cncProductionNote || ""}
                          onChange={(e) =>
                            onUpdateCarcassConfig({ cncProductionNote: e.target.value })
                          }
                          className="w-full h-9 px-3 rounded-xl bg-[#FAF8F4] border border-[#DED8CC] text-xs"
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Mimari Bitişler, Desen Takibi ve Kertme */}
              <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] space-y-2.5">
                <div className="font-bold text-[#141413]">Mimari Detaylar & Desen Takibi</div>

                <div className="flex items-center justify-between py-1">
                  <div>
                    <div className="font-semibold text-[11.5px]">Cephe Ahşap Desen Takibi</div>
                    <div className="text-[10px] text-[#78716C]">
                      Kapak ve çekmecelerde kesintisiz damar sürekliliği
                    </div>
                  </div>
                  <StudioToggleSwitch
                    testId="v11-toggle-grain-continuity"
                    checked={facadeGrainContinuity}
                    onChange={(next) => onToggleFacadeGrainContinuity(next)}
                  />
                </div>

                {!isSimple && (() => {
                  const skCfg = useConfiguratorStore.getState().project.space?.skirtingConfig;
                  const roomSkH = Math.max(20, Math.round(skCfg?.heightMm ?? 114));
                  const roomSkD = Math.max(8, Math.round(skCfg?.thicknessMm ?? 16));
                  const curBbH = activeModule.carcass.baseboardNotch?.heightMm ?? roomSkH;
                  const curBbD = activeModule.carcass.baseboardNotch?.depthMm ?? roomSkD;
                  return (
                    <div className="py-1.5 border-t border-[#F0ECE3] space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="font-semibold text-[11.5px]">Arka Süpürgelik Çentiği</div>
                          <div className="text-[10px] text-[#78716C]">
                            Yan/ara dikme, baza ve arka sistem çentiği ({curBbH}×{curBbD} mm)
                          </div>
                        </div>
                        <StudioToggleSwitch
                          testId="v11-toggle-baseboard-notch"
                          checked={hasBaseboardNotch}
                          onChange={(next) =>
                            onUpdateCarcassConfig({
                              baseboardNotch: {
                                enabled: next,
                                heightMm: next
                                  ? Math.max(roomSkH, activeModule.carcass.baseboardNotch?.heightMm || roomSkH)
                                  : curBbH,
                                depthMm: next
                                  ? Math.max(roomSkD, activeModule.carcass.baseboardNotch?.depthMm || roomSkD)
                                  : curBbD,
                              },
                            })
                          }
                        />
                      </div>

                      {hasBaseboardNotch && (
                        <div className="p-2.5 rounded-xl bg-[#F5F2EA] border border-[#E5DFD3] space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <label className="space-y-0.5 block">
                              <span className="text-[10px] text-[#57534E] font-semibold">Yükseklik (mm)</span>
                              <input
                                type="number"
                                inputMode="decimal"
                                min={20}
                                max={260}
                                step={2}
                                value={curBbH}
                                onChange={(e) =>
                                  onUpdateCarcassConfig({
                                    baseboardNotch: {
                                      enabled: true,
                                      heightMm: Math.max(20, Math.min(260, Number(e.target.value) || roomSkH)),
                                      depthMm: curBbD,
                                    },
                                  })
                                }
                                className="w-full h-8 px-2.5 rounded-lg bg-white border border-[#DED8CC] font-mono text-xs font-bold"
                              />
                            </label>
                            <label className="space-y-0.5 block">
                              <span className="text-[10px] text-[#57534E] font-semibold">Derinlik (mm)</span>
                              <input
                                type="number"
                                inputMode="decimal"
                                min={8}
                                max={80}
                                step={1}
                                value={curBbD}
                                onChange={(e) =>
                                  onUpdateCarcassConfig({
                                    baseboardNotch: {
                                      enabled: true,
                                      heightMm: curBbH,
                                      depthMm: Math.max(8, Math.min(80, Number(e.target.value) || roomSkD)),
                                    },
                                  })
                                }
                                className="w-full h-8 px-2.5 rounded-lg bg-white border border-[#DED8CC] font-mono text-xs font-bold"
                              />
                            </label>
                          </div>
                          {(curBbH < roomSkH || curBbD < roomSkD) && (
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateCarcassConfig({
                                  baseboardNotch: {
                                    enabled: true,
                                    heightMm: roomSkH,
                                    depthMm: roomSkD,
                                  },
                                })
                              }
                              className="w-full py-1 px-2 rounded-lg bg-[#141413] text-white text-[10.5px] font-bold cursor-pointer"
                            >
                              Duvar Süpürgeliğine Eşitle ({roomSkH}×{roomSkD} mm)
                            </button>
                          )}
                          {renderApplyCarcassToAllBtn("baseboard", "Süpürgelik Çentiğini Tüm Modüllere Uygula", {
                            baseboardNotch: activeModule.carcass.baseboardNotch,
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div className={`grid ${isSimple ? "grid-cols-1" : "grid-cols-2"} gap-1.5 pt-1 border-t border-[#F0ECE3]`}>
                  <button
                    type="button"
                    onClick={onRunAutoFillersAndCrown}
                    className="py-2 px-2.5 rounded-xl bg-[#F5F2EA] hover:bg-[#EAE3D5] text-[11px] font-semibold cursor-pointer"
                  >
                    + Otomatik Taç & Bitiş
                  </button>
                  {!isSimple && (
                    <button
                      type="button"
                      onClick={onOpenCutoutModal}
                      className="py-2 px-2.5 rounded-xl bg-[#F5F2EA] hover:bg-[#EAE3D5] text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Scissors className="w-3 h-3" />
                      <span>Panel Kertme</span>
                    </button>
                  )}
                </div>
              </div>
            
                            </>
              )}

              {/* ÇATI EĞİMİ / NİŞ KESİMİ (EĞİMLİ TAVAN) */}
              {(() => {
                const slopeSpec = activeModule.carcass.roofSlope || {
                  side: "none" as const,
                  kneeWallHeightMm: Math.max(900, activeModule.dimensions.height - 550),
                  slopeRunMm: Math.min(activeModule.dimensions.width, 900),
                };
                const slopeGeom = calculateSlopedCeilingGeometry(
                  activeModule.dimensions.width,
                  activeModule.dimensions.height,
                  activeModule.dimensions.depth,
                  slopeSpec
                );
                const setSlope = (patch: Partial<typeof slopeSpec>) => {
                  const next = { ...slopeSpec, ...patch };
                  const nextGeom = calculateSlopedCeilingGeometry(
                    activeModule.dimensions.width,
                    activeModule.dimensions.height,
                    activeModule.dimensions.depth,
                    next
                  );
                  const syncedSlopedCeiling =
                    next.side === "none"
                      ? {
                          mode: "none" as const,
                          kneeHeightMm: activeModule.dimensions.height,
                          slopeAngleDeg: 0,
                        }
                      : {
                          mode:
                            next.side === "left"
                              ? ("left_slope" as const)
                              : next.side === "right"
                              ? ("right_slope" as const)
                              : ("back_slope" as const),
                          kneeHeightMm: nextGeom.kneeWallHeightMm,
                          slopeAngleDeg: Math.max(5, Math.round(nextGeom.slopeAngleDeg || 30)),
                          topFlatSpanMm: nextGeom.flatTopLengthMm,
                        };
                  onUpdateCarcassConfig({
                    roofSlope: next,
                    secondaryRoofSlope: next.side === "none" ? undefined : activeModule.carcass.secondaryRoofSlope,
                    slopedCeiling: syncedSlopedCeiling,
                  });
                };

                const storeSpace = reactiveSpace;
                const roomCeilCfg = resolveSpaceCeilingConfig(storeSpace);
                const hasSlopedRoomCeiling =
                  roomCeilCfg.enabled && roomCeilCfg.ceilingType === "sloped_attic";

                const handleFitToRoomSlopedCeiling = () => {
                  const modX = activeModule.position?.x || 0;
                  const modY = activeModule.position?.y || 0;
                  const modZ = activeModule.position?.z || 0;
                  const modW = activeModule.dimensions.width;
                  const modH = activeModule.dimensions.height;
                  const modD = activeModule.dimensions.depth;
                  const rotYDeg = activeModule.rotation?.y || 0;
                  const rotYRad = (rotYDeg * Math.PI) / 180;
                  const sinY = Math.sin(rotYRad);
                  const cosY = Math.cos(rotYRad);
                  const clearance = 20;

                  const toWorldXZ = (lx: number, lz: number) => ({
                    x: modX + lx * cosY + lz * sinY,
                    z: modZ - lx * sinY + lz * cosY,
                  });

                  // Exact net clear height under single- or multi-wall (hip/gable) roof at any local (lx, lz)
                  const clearAtLocal = (lx: number, lz: number): number => {
                    const wp = toWorldXZ(lx, lz);
                    const res = computeEffectiveCeilingClearHeight(
                      storeSpace,
                      Math.max(0, wp.x),
                      1,
                      Math.max(0, wp.z),
                      1
                    );
                    return res.minClearHeightMm - modY - clearance;
                  };

                  // Sample the 4 corners and detect independent rear (Z) and lateral (X) roof slopes (supports hip/compound roofs!)
                  const cBL = clearAtLocal(0, 0);
                  const cBR = clearAtLocal(modW, 0);
                  const cFL = clearAtLocal(0, modD);
                  const cFR = clearAtLocal(modW, modD);
                  const maxCornerClear = Math.max(cBL, cBR, cFL, cFR);
                  const targetH = Math.max(700, Math.min(modH, Math.floor(maxCornerClear)));

                  type SlopeSpec = {
                    side: "left" | "right" | "rear";
                    kneeWallHeightMm: number;
                    slopeRunMm: number;
                  };

                  const solveRunAlongLine = (
                    maxSpan: number,
                    knee: number,
                    sampleFn: (u: number) => number
                  ): number => {
                    let reqRun = 150;
                    const steps = 16;
                    for (let i = 1; i <= steps; i++) {
                      const u = (maxSpan * i) / steps;
                      const sy = sampleFn(u);
                      if (sy < targetH - 1) {
                        const denom = sy - knee;
                        if (denom <= 1) {
                          reqRun = maxSpan;
                        } else {
                          const needed = (u * (targetH - knee)) / denom;
                          if (needed > reqRun) reqRun = needed;
                        }
                      }
                    }
                    return Math.round(Math.max(150, Math.min(maxSpan, reqRun)));
                  };

                  // 1) Rear (back-to-front Z) slope evaluated along the taller X side so a lateral hip slope doesn't mask it
                  const rearHighX = cFR >= cFL ? modW : 0;
                  const rearLow = clearAtLocal(rearHighX, 0);
                  const rearHigh = clearAtLocal(rearHighX, modD);
                  let rearSlope: SlopeSpec | undefined;
                  if (rearHigh > rearLow + 25 && rearLow < targetH - 25) {
                    const knee = Math.max(450, Math.min(targetH - 40, Math.floor(rearLow)));
                    const run = solveRunAlongLine(modD, knee, (u) => clearAtLocal(rearHighX, u));
                    rearSlope = { side: "rear", kneeWallHeightMm: knee, slopeRunMm: run };
                  }

                  // 2) Lateral (left/right X) slope evaluated along the taller Z side (usually front z = modD)
                  const latHighZ = Math.max(cFL, cFR) >= Math.max(cBL, cBR) ? modD : 0;
                  const latLeft = clearAtLocal(0, latHighZ);
                  const latRight = clearAtLocal(modW, latHighZ);
                  let lateralSlope: SlopeSpec | undefined;
                  if (latRight > latLeft + 25 && latLeft < targetH - 25) {
                    const knee = Math.max(450, Math.min(targetH - 40, Math.floor(latLeft)));
                    const run = solveRunAlongLine(modW, knee, (u) => clearAtLocal(u, latHighZ));
                    lateralSlope = { side: "left", kneeWallHeightMm: knee, slopeRunMm: run };
                  } else if (latLeft > latRight + 25 && latRight < targetH - 25) {
                    const knee = Math.max(450, Math.min(targetH - 40, Math.floor(latRight)));
                    const run = solveRunAlongLine(modW, knee, (u) => clearAtLocal(modW - u, latHighZ));
                    lateralSlope = { side: "right", kneeWallHeightMm: knee, slopeRunMm: run };
                  }

                  const primarySlope: SlopeSpec | undefined = rearSlope || lateralSlope;
                  const secondarySlope: SlopeSpec | undefined =
                    rearSlope && lateralSlope ? lateralSlope : undefined;

                  if (targetH !== modH) {
                    onSetDimensions(modW, targetH, modD);
                  }

                  if (!primarySlope) {
                    const flatH = Math.max(500, Math.min(modH, Math.floor(Math.min(cBL, cBR, cFL, cFR))));
                    if (flatH !== targetH && flatH !== modH) {
                      onSetDimensions(modW, flatH, modD);
                    }
                    onUpdateCarcassConfig({
                      roofSlope: { side: "none", kneeWallHeightMm: flatH, slopeRunMm: 0 },
                      secondaryRoofSlope: undefined,
                      slopedCeiling: {
                        mode: "none",
                        kneeHeightMm: flatH,
                        slopeAngleDeg: 0,
                        topFlatSpanMm: modW,
                      },
                    });
                    return;
                  }

                  const nextGeom = calculateSlopedCeilingGeometry(modW, targetH, modD, primarySlope);
                  onUpdateCarcassConfig({
                    roofSlope: primarySlope,
                    secondaryRoofSlope: secondarySlope,
                    slopedCeiling: {
                      mode:
                        primarySlope.side === "left"
                          ? "left_slope"
                          : primarySlope.side === "right"
                            ? "right_slope"
                            : "back_slope",
                      kneeHeightMm: nextGeom.kneeWallHeightMm,
                      slopeAngleDeg: Math.max(5, Math.round(nextGeom.slopeAngleDeg || 25)),
                      topFlatSpanMm: nextGeom.flatTopLengthMm,
                    },
                  });

                  // Auto-flip hinged single doors away from any short lateral sloped edge
                  const latDir =
                    primarySlope.side === "left" || primarySlope.side === "right"
                      ? primarySlope.side
                      : secondarySlope?.side === "left" || secondarySlope?.side === "right"
                        ? secondarySlope.side
                        : null;
                  if (latDir) {
                    const stStore = useConfiguratorStore.getState();
                    activeModule.bays.forEach((bay, bIdx) => {
                      if (latDir === "left" && bay.door.type === "single_left") {
                        stStore.setBayDoorType(bIdx, "single_right");
                      } else if (latDir === "right" && bay.door.type === "single_right") {
                        stStore.setBayDoorType(bIdx, "single_left");
                      }
                    });
                  }
                };

                return (
                  <div
                    data-testid="v11-roof-slope-section"
                    className="p-3 rounded-2xl bg-white/85 border border-[#E5DFD3] space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-[#141413]">
                        Çatı Eğimi / Merdiven Altı Kesimi
                      </span>
                      {slopeGeom.isSloped && (
                        <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-900 border border-blue-200">
                          {slopeGeom.slopeAngleDeg}° Eğim
                        </span>
                      )}
                    </div>

                    {hasSlopedRoomCeiling && (
                      <button
                        type="button"
                        data-testid="v11-fit-module-to-sloped-ceiling-btn"
                        onClick={handleFitToRoomSlopedCeiling}
                        className="w-full py-1.5 px-2.5 rounded-xl bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] text-white text-[11px] font-bold flex items-center justify-center gap-1.5 shadow-xs hover:brightness-110 transition cursor-pointer"
                      >
                        <span>✨ Oda Tavan Eğimine Uydur</span>
                      </button>
                    )}

                    <div className="grid grid-cols-4 gap-1">
                      {(
                        [
                          { id: "none", label: "Düz" },
                          { id: "left", label: "Sol Eğim" },
                          { id: "right", label: "Sağ Eğim" },
                          { id: "rear", label: "Arka Eğim" },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setSlope({ side: opt.id })}
                          className={`h-7 rounded-lg text-[11px] font-semibold border transition cursor-pointer ${
                            slopeSpec.side === opt.id
                              ? "bg-[#141413] text-white border-[#141413]"
                              : "bg-white/[0.08] hover:bg-white/[0.15] text-slate-200 border-white/15"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {slopeGeom.isSloped && (
                      <div className="space-y-2 pt-1">
                        <div className="grid grid-cols-2 gap-2">
                          <label className="text-[10px] text-[#57534E] space-y-1">
                            <span>Düşük Kenar ({unitMode})</span>
                            <input
                              type="number" inputMode="decimal"
                              min={unitMode === "cm" ? 45 : 450}
                              max={unitMode === "cm" ? Math.round((activeModule.dimensions.height - 120) / 10) : activeModule.dimensions.height - 120}
                              value={unitMode === "cm" ? Math.round(slopeSpec.kneeWallHeightMm / 10) : slopeSpec.kneeWallHeightMm}
                              onChange={(e) => {
                                const raw = Number(e.target.value) || 1200;
                                setSlope({ kneeWallHeightMm: unitMode === "cm" ? raw * 10 : raw });
                              }}
                              className="w-full h-8 px-2.5 rounded-lg bg-white/[0.08] border border-white/15 font-mono text-xs text-slate-100"
                            />
                          </label>
                          <label className="text-[10px] text-[#57534E] space-y-1">
                            <span>Eğim Mesafesi ({unitMode})</span>
                            <input
                              type="number" inputMode="decimal"
                              min={unitMode === "cm" ? 15 : 150}
                              max={unitMode === "cm" ? Math.round((slopeSpec.side === "rear" ? activeModule.dimensions.depth : activeModule.dimensions.width) / 10) : (slopeSpec.side === "rear" ? activeModule.dimensions.depth : activeModule.dimensions.width)}
                              value={unitMode === "cm" ? Math.round(slopeSpec.slopeRunMm / 10) : slopeSpec.slopeRunMm}
                              onChange={(e) => {
                                const raw = Number(e.target.value) || 600;
                                setSlope({ slopeRunMm: unitMode === "cm" ? raw * 10 : raw });
                              }}
                              className="w-full h-8 px-2.5 rounded-lg bg-white/[0.08] border border-white/15 font-mono text-xs text-slate-100"
                            />
                          </label>
                        </div>
                        <div className="text-[10px] font-mono text-[#57534E] flex items-center justify-between">
                          <span>Eğimli Üst Tabla: {slopeGeom.slopedTopLengthMm} mm</span>
                          <span>Düz Üst: {slopeGeom.flatTopLengthMm} mm</span>
                        </div>
                        {slopeGeom.warnings.length > 0 && (
                          <p className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                            {slopeGeom.warnings[0]}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </>
          )}
    </>
  );
};
