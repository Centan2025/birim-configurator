"use client";

import React from "react";
import { Lightbulb, Lock, ArrowUpDown } from "lucide-react";
import {
  type BayConfig,
  type CarcassConfig,
  type DrawerBoxSystemType,
  type HangingRailConfig,
  type ModuleInstance,
} from "@birim/core";
import type { RightParametricInspectorProps } from "../RightParametricInspector";
import { renderHardwareTechnicalSvg, renderInternalDrawerSolutionIcon, renderLedPlacementIcon } from "./inspectorSvgIcons";
import { StudioToggleSwitch, StudioSelect } from "./InspectorControls";

export interface InspectorInternalDrawerBlindCardProps {
  activeModule: ModuleInstance;
  onUpdateCarcassConfig: RightParametricInspectorProps["onUpdateCarcassConfig"];
}

export const InspectorInternalDrawerBlindCard: React.FC<InspectorInternalDrawerBlindCardProps> = (props) => {
  const { activeModule, onUpdateCarcassConfig } = props;
  return (
      <div className="space-y-2">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-[#141413]">
              İç Çekmece Kör Dikme & Menteşe
            </span>
            <span className="text-[10px] font-mono text-[#78716C]">
              {(activeModule.carcass.internalDrawerHingeSolution || "auto_155_hinge") ===
              "blind_panel_filler"
                ? `${activeModule.carcass.internalDrawerBlindWidthMm ?? 40} mm kör alan`
                : (activeModule.carcass.internalDrawerHingeSolution || "auto_155_hinge") ===
                  "spacer_block_25mm"
                ? "25 mm paspayı"
                : "155° sıfır çıkıntı"}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                {
                  id: "blind_panel_filler",
                  label: "Kör Dikme",
                  sub: "Kör alan + kapama",
                },
                {
                  id: "auto_155_hinge",
                  label: "155° Menteşe",
                  sub: "Sıfır çıkıntı",
                },
                {
                  id: "spacer_block_25mm",
                  label: "25mm Paspayı",
                  sub: "Ray altı çıta",
                },
              ] as const
            ).map((opt) => {
              const curSol =
                activeModule.carcass.internalDrawerHingeSolution || "auto_155_hinge";
              const isSel = curSol === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  data-testid={`v11-internal-drawer-solution-${opt.id}`}
                  onClick={() =>
                    onUpdateCarcassConfig({
                      internalDrawerHingeSolution: opt.id,
                    })
                  }
                  className={`py-2 px-1.5 rounded-xl border text-center transition cursor-pointer flex flex-col items-center gap-1 ${
                    isSel
                      ? "bg-[#141413] text-white border-[#38BDF8] ring-1 ring-[#38BDF8]/40"
                      : "bg-[#F5F2EA] hover:bg-[#EAE3D5] border-[#E5DFD3] text-[#44403C]"
                  }`}
                >
                  {renderInternalDrawerSolutionIcon(opt.id)}
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
        </div>

        {activeModule.carcass.internalDrawerHingeSolution === "blind_panel_filler" && (
          <div className="rounded-xl bg-[#F5F2EA] p-2.5 space-y-2 border border-[#E7E3DA]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-[#57534E]">
                Kör Alan Genişliği (mm)
              </span>
              <div className="flex items-center gap-1">
                {[36, 40, 50].map((presetW) => {
                  const curW = activeModule.carcass.internalDrawerBlindWidthMm ?? 40;
                  const isSel = curW === presetW;
                  return (
                    <button
                      key={presetW}
                      type="button"
                      onClick={() =>
                        onUpdateCarcassConfig({
                          internalDrawerBlindWidthMm: presetW,
                        })
                      }
                      className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors cursor-pointer ${
                        isSel
                          ? "bg-[#141413] text-white"
                          : "bg-white text-[#57534E] hover:bg-[#EAE6DC]"
                      }`}
                    >
                      {presetW}
                    </button>
                  );
                })}
                <input
                  type="number" inputMode="decimal"
                  min={32}
                  max={100}
                  step={1}
                  aria-label="Kör Alan Genişliği"
                  value={activeModule.carcass.internalDrawerBlindWidthMm ?? 40}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isFinite(n)) {
                      onUpdateCarcassConfig({
                        internalDrawerBlindWidthMm: Math.max(32, Math.min(100, Math.round(n))),
                      });
                    }
                  }}
                  className="w-14 px-1.5 py-0.5 text-[11px] font-semibold text-right rounded-md border border-[#D6D3CD] bg-white text-[#141413]"
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-[#57534E]">
                Klapadan İçeri (mm)
              </span>
              <div className="flex items-center gap-1">
                {[
                  { val: 0, label: "0" },
                  { val: 18, label: "18" },
                  { val: 35, label: "35" },
                ].map((preset) => {
                  const curS =
                    activeModule.carcass.internalDrawerBlindSetbackFromFrontMm ?? 0;
                  const isSel = curS === preset.val;
                  return (
                    <button
                      key={preset.val}
                      type="button"
                      title={
                        preset.val === 0
                          ? "Klapa ile hemzemin (0mm)"
                          : preset.val === 18
                          ? "Klapa arkası (18mm)"
                          : "Menteşe tabanı gerisi (35mm)"
                      }
                      onClick={() =>
                        onUpdateCarcassConfig({
                          internalDrawerBlindSetbackFromFrontMm: preset.val,
                        })
                      }
                      className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors cursor-pointer ${
                        isSel
                          ? "bg-[#141413] text-white"
                          : "bg-white text-[#57534E] hover:bg-[#EAE6DC]"
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
                <input
                  type="number" inputMode="decimal"
                  min={0}
                  max={80}
                  step={1}
                  aria-label="Klapadan İçeri Pay"
                  value={activeModule.carcass.internalDrawerBlindSetbackFromFrontMm ?? 0}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isFinite(n)) {
                      onUpdateCarcassConfig({
                        internalDrawerBlindSetbackFromFrontMm: Math.max(
                          0,
                          Math.min(80, Math.round(n))
                        ),
                      });
                    }
                  }}
                  className="w-14 px-1.5 py-0.5 text-[11px] font-semibold text-right rounded-md border border-[#D6D3CD] bg-white text-[#141413]"
                />
              </div>
            </div>
            <label className="flex items-center justify-between gap-2 cursor-pointer">
              <span className="text-[11px] text-[#57534E]">
                Tek kapakta da iki yanda simetrik uygula
              </span>
              <input
                type="checkbox"
                checked={Boolean(activeModule.carcass.internalDrawerBlindSymmetric)}
                onChange={(e) =>
                  onUpdateCarcassConfig({
                    internalDrawerBlindSymmetric: e.target.checked,
                  })
                }
                className="h-3.5 w-3.5 accent-[#141413] rounded"
              />
            </label>
          </div>
        )}
      </div>
  );
};

export interface InspectorDrawerBoxSystemCardProps {
  activeModule: ModuleInstance;
  isSimple: boolean;
  onUpdateCarcassConfig: RightParametricInspectorProps["onUpdateCarcassConfig"];
  renderApplyCarcassToAllBtn: (
    key: string,
    label: string,
    patch: Partial<CarcassConfig>
  ) => React.ReactNode;
}

export const InspectorDrawerBoxSystemCard: React.FC<InspectorDrawerBoxSystemCardProps> = (props) => {
  const { activeModule, isSimple, onUpdateCarcassConfig, renderApplyCarcassToAllBtn } = props;
  return (
    <>
              {!isSimple && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-0.5">
                    <span className="text-[11px] font-bold text-[#57534E]">
                      Çekmece Ray &amp; Kasa Sistemi
                    </span>
                    <span className="text-[10px] text-[#8C7A6B]">Çekmece mekanizma seçimi</span>
                  </div>
                  <div className="grid grid-cols-6 gap-1">
                    {[
                      {
                        id: "metal_box_legrabox" as const,
                        icon: "metal_box_legrabox",
                        label: "Blum Legrabox",
                      },
                      {
                        id: "metal_box_tandembox" as const,
                        icon: "metal_box_tandembox",
                        label: "Blum Tandembox",
                      },
                      {
                        id: "wooden_undermount" as const,
                        icon: "wooden_undermount",
                        label: "Movento Gizli Ray",
                      },
                    ].map((hw) => {
                      const sampleDrw = activeModule.bays.flatMap((b) => b.drawers || [])[0];
                      const sampleHw = (sampleDrw?.hardwareProductId || "").toLowerCase();
                      const resolvedModBoxSys =
                        activeModule.carcass.drawerBoxSystem ||
                        sampleDrw?.boxSystemType ||
                        (sampleHw.includes("avantech")
                          ? "metal_box_avantech"
                          : sampleHw.includes("legrabox")
                          ? "metal_box_legrabox"
                          : sampleHw.includes("tandembox")
                          ? "metal_box_tandembox"
                          : "wooden_undermount");
                      const activeSys = resolvedModBoxSys === hw.id;
                      return (
                        <button
                          key={hw.id}
                          type="button"
                          onClick={() => {
                            onUpdateCarcassConfig({ drawerBoxSystem: hw.id });
                          }}
                          title={`${hw.label} — Modüldeki çekmecelerin ray ve kasa sistemini günceller`}
                          className={`p-2 rounded-2xl border flex flex-col items-center justify-center gap-1 text-center transition cursor-pointer ${
                            activeSys
                              ? "bg-[#141413] text-white border-[#141413] shadow-xs"
                              : "bg-white hover:bg-[#F5F2EA] text-[#141413] border-[#E5DFD3] hover:border-[#8C7A6B]"
                          }`}
                        >
                          {renderHardwareTechnicalSvg(hw.icon)}
                          <span className="font-semibold text-[10px] leading-tight">
                            {hw.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {renderApplyCarcassToAllBtn("drawerbox", "Çekmece Sistemini Tüm Modüllere Uygula", {
                    drawerBoxSystem: activeModule.carcass.drawerBoxSystem,
                  })}
                </div>
              )}
    </>
  );
};

export interface InspectorBayShelvesListProps {
  activeBay: BayConfig;
  activeModule: ModuleInstance;
  isSimple: boolean;
  onRemoveShelf: RightParametricInspectorProps["onRemoveShelf"];
  onSetShelfElevation: RightParametricInspectorProps["onSetShelfElevation"];
  onSetShelfMountType: RightParametricInspectorProps["onSetShelfMountType"];
  safeBayIdx: number;
}

export const InspectorBayShelvesList: React.FC<InspectorBayShelvesListProps> = (props) => {
  const { activeBay, activeModule, isSimple, onRemoveShelf, onSetShelfElevation, onSetShelfMountType, safeBayIdx } = props;
  return (
    <>
                  {activeBay.shelves.length > 0 && (
                    <div className="space-y-1.5">
                      {activeBay.shelves.map((sh, i) => {
                        const isFixedSh = sh.isAdjustable === false || Boolean(sh.isFixed);
                        const connType = sh.fixedConnectorType || "minifix_dowel";
                        const shThick = sh.thickness || activeModule.carcass.panelThickness || 18;
                        return (
                          <div
                            key={sh.id}
                            className={`flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] ${
                              isFixedSh
                                ? "bg-[#F6EFE2] border-[#DFCFAF]"
                                : "bg-[#F8F6F1] border-[#E6E1D6]"
                            }`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-bold text-[#141413] shrink-0">
                                Raf {i + 1}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  onSetShelfMountType(safeBayIdx, sh.id, isFixedSh, connType)
                                }
                                title={
                                  isFixedSh
                                    ? "Sabit taşıyıcı raf (gövdeyi birbirine kilitler) — hareketli rafa çevirmek için tıklayın"
                                    : "Hareketli raf (Sistem 32 Ø5mm pimli) — sabit taşıyıcı rafa çevirmek için tıklayın"
                                }
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition cursor-pointer ${
                                  isFixedSh
                                    ? "bg-[#141413] text-[#F5EFE6]"
                                    : "bg-white border border-[#DAD3C5] text-[#44403C] hover:bg-[#EFECE4]"
                                }`}
                              >
                                {isFixedSh ? (
                                  <>
                                    <Lock className="w-2.5 h-2.5" />
                                    <span>Sabit</span>
                                  </>
                                ) : (
                                  <>
                                    <ArrowUpDown className="w-2.5 h-2.5" />
                                    <span>Hareketli</span>
                                  </>
                                )}
                              </button>

                              {!isSimple && isFixedSh && (
                                <StudioSelect
                                  ariaLabel={`Raf ${i + 1} Bağlantı Tipi`}
                                  size="sm"
                                  className="w-28"
                                  value={connType}
                                  onChange={(val) =>
                                    onSetShelfMountType(
                                      safeBayIdx,
                                      sh.id,
                                      false,
                                      val as "minifix_dowel" | "rafix_20"
                                    )
                                  }
                                  options={[
                                    { value: "minifix_dowel", label: "Minifix", icon: renderHardwareTechnicalSvg("minifix_dowel") },
                                    { value: "rafix_20", label: "Rafix 20", icon: renderHardwareTechnicalSvg("rafix_20") },
                                  ]}
                                />
                              )}
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {!isSimple ? (
                                <>
                                  <input
                                    type="number" inputMode="decimal"
                                    step={isFixedSh ? 1 : 32}
                                    value={Math.round(sh.elevationY)}
                                    onChange={(e) =>
                                      onSetShelfElevation(
                                        safeBayIdx,
                                        sh.id,
                                        Math.max(64, Number(e.target.value) || 0)
                                      )
                                    }
                                    className="w-12 px-1 py-0.5 rounded bg-white border border-[#DED8CC] font-mono text-[10px] text-center"
                                    title="Alt tabladan yükseklik (mm)"
                                  />
                                  <span className="text-[9.5px] font-mono text-[#78716C]">
                                    {shThick}mm
                                  </span>
                                </>
                              ) : (
                                <span className="text-[10px] font-mono text-[#78716C]">
                                  {Math.round(sh.elevationY / 10)} cm
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => onRemoveShelf(safeBayIdx, sh.id)}
                                className="w-5 h-5 rounded-full hover:bg-red-50 text-[#78716C] hover:text-red-600 flex items-center justify-center cursor-pointer"
                                title="Rafı Kaldır"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
    </>
  );
};

export interface InspectorBayDrawersRailsFittingsListProps {
  activeBay: BayConfig;
  activeModule: ModuleInstance;
  hasAnyInternalDrawer: boolean;
  internalDrawerBlindControlPanel: React.ReactNode;
  isSimple: boolean;
  isSlidingBay: boolean;
  onRemoveDrawer: RightParametricInspectorProps["onRemoveDrawer"];
  onRemoveHangingRail: RightParametricInspectorProps["onRemoveHangingRail"];
  onRemoveSpecialFitting: RightParametricInspectorProps["onRemoveSpecialFitting"];
  onSetDrawerPlacement: RightParametricInspectorProps["onSetDrawerPlacement"];
  onSetHangingRailProfile: RightParametricInspectorProps["onSetHangingRailProfile"];
  onUpdateCarcassConfig: RightParametricInspectorProps["onUpdateCarcassConfig"];
  safeBayIdx: number;
}

export const InspectorBayDrawersRailsFittingsList: React.FC<InspectorBayDrawersRailsFittingsListProps> = (props) => {
  const { activeBay, activeModule, hasAnyInternalDrawer, internalDrawerBlindControlPanel, isSimple, isSlidingBay, onRemoveDrawer, onRemoveHangingRail, onRemoveSpecialFitting, onSetDrawerPlacement, onSetHangingRailProfile, onUpdateCarcassConfig, safeBayIdx } = props;
  return (
    <>

                    {[...activeBay.drawers]
                      .sort((a, b) => (b.elevationY || 0) - (a.elevationY || 0))
                      .map((dr, i) => (
                      <div
                        key={dr.id}
                        className="w-full flex flex-wrap items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#F5F2EA] text-[11px] font-medium"
                      >
                        <span className="truncate font-semibold text-[#141413] min-w-0">
                          {dr.isInternal || isSlidingBay ? "İç Çekmece" : "Çekmece"} {i + 1}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {onSetDrawerPlacement && (
                            <>
                              <StudioSelect
                                ariaLabel={`Çekmece ${i + 1} Yüksekliği`}
                                size="sm"
                                className="w-28"
                                value={dr.height}
                                onChange={(val) =>
                                  onSetDrawerPlacement(
                                    safeBayIdx,
                                    dr.id,
                                    dr.elevationY,
                                    Number(val) || dr.height,
                                    true
                                  )
                                }
                                options={
                                  (dr.boxSystemType || activeModule.carcass.drawerBoxSystem) ===
                                  "metal_box_legrabox"
                                    ? [
                                        { value: "90", label: "N · 90 mm" },
                                        { value: "115", label: "M · 115 mm" },
                                        { value: "150", label: "K · 150 mm" },
                                        { value: "200", label: "C · 200 mm" },
                                        { value: "265", label: "F · 265 mm" },
                                      ]
                                    : [120, 140, 160, 180, 220, 280].map((dh) => ({
                                        value: String(dh),
                                        label: `${dh} mm`,
                                      }))
                                }
                              />
                              {!isSlidingBay && (
                                <button
                                  type="button"
                                  title="Dış Çekmece ↔ Gizli İç Çekmece Dönüştür"
                                  onClick={() =>
                                    onSetDrawerPlacement(
                                      safeBayIdx,
                                      dr.id,
                                      dr.elevationY,
                                      dr.height,
                                      true,
                                      { isInternal: !dr.isInternal }
                                    )
                                  }
                                  className="h-6 px-1.5 rounded-md bg-white hover:bg-[#141413] hover:text-white border border-[#DED8CC] text-[9.5px] font-semibold transition cursor-pointer"
                                >
                                  {dr.isInternal ? "İç → Dış" : "Dış → İç"}
                                </button>
                              )}
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => onRemoveDrawer(safeBayIdx, dr.id)}
                            className="w-5 h-5 rounded-full hover:bg-red-50 text-[#78716C] hover:text-red-600 flex items-center justify-center cursor-pointer"
                            title="Çekmeceyi Sil"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}

                    {(activeBay.drawers.length > 0 || hasAnyInternalDrawer || !isSimple) && (
                      <div className="w-full space-y-2.5 pt-2.5 mt-1 border-t border-[#F0ECE3]">
                        <div className="space-y-1">
                          <span className="text-[11px] text-[#57534E] font-medium block">
                            Çekmece Kasa Sistemi
                          </span>
                          <StudioSelect
                            ariaLabel="Çekmece Kasa Sistemi"
                            value={(() => {
                              if (activeModule.carcass.drawerBoxSystem) return activeModule.carcass.drawerBoxSystem;
                              const firstDr = activeModule.bays.flatMap((b) => b.drawers || [])[0];
                              if (firstDr?.boxSystemType) return firstDr.boxSystemType;
                              const fhw = (firstDr?.hardwareProductId || "").toLowerCase();
                              if (fhw.includes("avantech")) return "metal_box_avantech";
                              if (fhw.includes("legrabox")) return "metal_box_legrabox";
                              if (fhw.includes("tandembox")) return "metal_box_tandembox";
                              return "wooden_undermount";
                            })()}
                            onChange={(val) =>
                              onUpdateCarcassConfig({
                                drawerBoxSystem: val as DrawerBoxSystemType,
                              })
                            }
                            options={[
                              { value: "wooden_undermount", label: "Ahşap + Gizli Ray", icon: renderHardwareTechnicalSvg("wooden_undermount") },
                              { value: "metal_box_legrabox", label: "Blum Legrabox", icon: renderHardwareTechnicalSvg("metal_box_legrabox") },
                              { value: "metal_box_tandembox", label: "Blum Tandembox", icon: renderHardwareTechnicalSvg("metal_box_tandembox") },
                              { value: "metal_box_avantech", label: "Hettich AvanTech", icon: renderHardwareTechnicalSvg("metal_box_avantech") },
                            ]}
                          />
                        </div>
                        {internalDrawerBlindControlPanel}
                      </div>
                    )}

                    {activeBay.hangingRails.map((hr, i) => (
                      <div
                        key={hr.id}
                        className="w-full flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#F5F2EA] text-[11px] font-medium"
                      >
                        <span className="font-semibold text-[#141413] shrink-0">
                          Askı {i + 1}
                        </span>
                        <div className="flex items-center gap-1.5 min-w-0">
                          {onSetHangingRailProfile && (
                            <StudioSelect
                              ariaLabel={`Askı ${i + 1} Boru Tipi`}
                              size="sm"
                              className="w-44"
                              value={hr.profileType || "oval_30x15"}
                              onChange={(val) =>
                                onSetHangingRailProfile(
                                  safeBayIdx,
                                  hr.id,
                                  val as HangingRailConfig["profileType"]
                                )
                              }
                              options={[
                                { value: "oval_30x15", label: "Krom Oval 30×15", icon: renderHardwareTechnicalSvg("oval_30x15") },
                                { value: "round_25", label: "Yuvarlak Ø25 Krom", icon: renderHardwareTechnicalSvg("round_25") },
                                { value: "led_black_30x15", label: "LED'li Siyah Askı", icon: renderHardwareTechnicalSvg("led_black_30x15") },
                                { value: "brass_25", label: "Pirinç / Gold Ø25", icon: renderHardwareTechnicalSvg("brass_25") },
                                { value: "lift_pantograph", label: "Asansörlü Pantograf", icon: renderHardwareTechnicalSvg("lift_pantograph") },
                                { value: "pullout_front", label: "Öne Çekilir Askı", icon: renderHardwareTechnicalSvg("pullout_front") },
                              ]}
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => onRemoveHangingRail(safeBayIdx, hr.id)}
                            className="w-6 h-6 rounded-full hover:bg-red-50 text-[#78716C] hover:text-red-600 flex items-center justify-center cursor-pointer shrink-0"
                            title="Askıyı Kaldır"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}

                    {activeBay.specialFittings.map((sf, i) => {
                      const sfLabelMap: Record<string, string> = {
                        waste_bin: "Raylı Çöp Sistemi",
                        spice_pullout: "Teleskopik Şişelik",
                        pantry_pullout: "Boy Kiler Mekanizması",
                        corner_lemans: "LeMans II Fasulye",
                        magic_corner: "Magic Corner",
                        carousel_half_moon: "270° Karusel",
                        trouser_rack: "Pantolonluk",
                        shoe_rack: "Ayakkabılık",
                        jewelry_tray: "Takı Çekmecesi",
                        tie_rack: "Kemer & Kravatlık",
                        wire_basket: "Tel Sepet",
                      };
                      const sfName = sfLabelMap[sf.type] || `Aksesuar ${i + 1}`;
                      return (
                      <span
                        key={sf.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F5F2EA] text-[11px] font-medium"
                      >
                        <span>{sfName}</span>
                        <button
                          type="button"
                          onClick={() => onRemoveSpecialFitting(safeBayIdx, sf.id)}
                          className="text-[#78716C] hover:text-red-600 cursor-pointer"
                        >
                          ✕
                        </button>
                      </span>
                      );
                    })}
    </>
  );
};

export interface InspectorLedLightingCardProps {
  activeModule: ModuleInstance;
  isSimple: boolean;
  onToggleModuleLed: RightParametricInspectorProps["onToggleModuleLed"];
}

export const InspectorLedLightingCard: React.FC<InspectorLedLightingCardProps> = (props) => {
  const { activeModule, isSimple, onToggleModuleLed } = props;
  return (
              <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#141413] flex items-center gap-1.5">
                    <Lightbulb className="w-4 h-4 text-amber-500" />
                    <span>Gömme İç LED Aydınlatma</span>
                  </span>
                  <StudioToggleSwitch
                    testId="v11-toggle-led-lighting"
                    checked={Boolean(activeModule.carcass.ledLightingEnabled)}
                    onChange={(next) =>
                      onToggleModuleLed(next, {
                        colorTempK: activeModule.carcass.ledColorTempK || 3000,
                      })
                    }
                  />
                </div>

                <div className="space-y-2 pt-1">
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { k: 2700, label: "2700K Sıcak" },
                        { k: 3000, label: "3000K Doğal" },
                        { k: 4000, label: "4000K Gün" },
                      ] as const
                    ).map((temp) => {
                      const active =
                        Boolean(activeModule.carcass.ledLightingEnabled) &&
                        (activeModule.carcass.ledColorTempK || 3000) === temp.k;
                      return (
                        <button
                          key={temp.k}
                          type="button"
                          onClick={() => onToggleModuleLed(true, { colorTempK: temp.k })}
                          className={`py-1.5 rounded-xl text-[10.5px] font-semibold cursor-pointer ${
                            active
                              ? "bg-[#141413] text-white"
                              : "bg-[#F5F2EA] hover:bg-[#EAE3D5] text-[#44403C]"
                          }`}
                        >
                          {temp.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-[#F0ECE3]">
                    {(() => {
                      const activeMode = activeModule.carcass.ledPlacementMode;
                      const ledOn = Boolean(activeModule.carcass.ledLightingEnabled);
                      const hasTopShelf =
                        ledOn && (activeMode === "shelf_underside" || activeMode === "full_showcase");
                      const hasSideVert =
                        ledOn && (activeMode === "vertical_sides" || activeMode === "full_showcase");
                      const hasRod = ledOn && activeMode === "hanging_rod";
                      const cTemp = activeModule.carcass.ledColorTempK || 3000;

                      const toggleTopShelf = () => {
                        const nextTop = !hasTopShelf;
                        if (nextTop && hasSideVert) {
                          onToggleModuleLed(true, { ledType: "full_showcase", colorTempK: cTemp });
                        } else if (nextTop) {
                          onToggleModuleLed(true, { ledType: "led_profile", colorTempK: cTemp });
                        } else if (hasSideVert) {
                          onToggleModuleLed(true, { ledType: "led_vertical_strip", colorTempK: cTemp });
                        } else {
                          onToggleModuleLed(false);
                        }
                      };

                      const toggleSideVert = () => {
                        const nextSide = !hasSideVert;
                        if (hasTopShelf && nextSide) {
                          onToggleModuleLed(true, { ledType: "full_showcase", colorTempK: cTemp });
                        } else if (nextSide) {
                          onToggleModuleLed(true, { ledType: "led_vertical_strip", colorTempK: cTemp });
                        } else if (hasTopShelf) {
                          onToggleModuleLed(true, { ledType: "led_profile", colorTempK: cTemp });
                        } else {
                          onToggleModuleLed(false);
                        }
                      };

                      const items = [
                        { id: "led_profile", label: "Üst & Raf", isSel: hasTopShelf, onClick: toggleTopShelf },
                        { id: "led_vertical_strip", label: "Yan & Dikme", isSel: hasSideVert, onClick: toggleSideVert },
                        {
                          id: "led_rod_strip",
                          label: "Askı LED",
                          isSel: hasRod,
                          onClick: () =>
                            hasRod
                              ? onToggleModuleLed(false)
                              : onToggleModuleLed(true, { ledType: "led_rod_strip", colorTempK: cTemp }),
                        },
                        {
                          id: "full_showcase",
                          label: "Tam Vitrin",
                          isSel: hasTopShelf && hasSideVert,
                          onClick: () =>
                            onToggleModuleLed(true, { ledType: "full_showcase", colorTempK: cTemp }),
                        },
                      ];

                      return items.map((lt) => (
                        <button
                          key={lt.id}
                          type="button"
                          onClick={lt.onClick}
                          className={`py-1.5 px-2 rounded-xl text-[10.5px] font-semibold cursor-pointer flex items-center gap-2 text-left ${
                            lt.isSel
                              ? "bg-amber-600 text-white"
                              : "bg-[#F5F2EA] hover:bg-[#EAE3D5] text-[#44403C]"
                          }`}
                        >
                          {renderLedPlacementIcon(lt.id, lt.isSel)}
                          <span className="truncate">{lt.label}</span>
                        </button>
                      ));
                    })()}
                  </div>

                  {/* Sensör & CNC LED Kanal Ölçüleri (Genişlik, Derinlik, Önden Uzaklık) */}
                  <div className="space-y-2 pt-2 border-t border-[#F0ECE3]">
                    <div className="grid grid-cols-3 gap-1">
                      {(
                        [
                          { id: "ir_door", label: "Kapak Sensör" },
                          { id: "pir_motion", label: "Hareket PIR" },
                          { id: "manual_switch", label: "Anahtar" },
                        ] as const
                      ).map((sn) => {
                        const curSn = activeModule.carcass.ledSensorType || "ir_door";
                        return (
                          <button
                            key={sn.id}
                            type="button"
                            onClick={() => onToggleModuleLed(true, { sensorType: sn.id })}
                            className={`py-1 rounded-lg text-[10px] font-semibold cursor-pointer ${
                              curSn === sn.id
                                ? "bg-[#141413] text-white"
                                : "bg-[#F5F2EA] text-[#44403C]"
                            }`}
                          >
                            {sn.label}
                          </button>
                        );
                      })}
                    </div>

                    {!isSimple && (
                      <div className="space-y-2 pt-1">
                        <div className="grid grid-cols-3 gap-1.5">
                          <label className="space-y-0.5">
                            <span className="text-[9.5px] text-[#57534E] block">Genişlik (mm)</span>
                            <input
                              type="number" inputMode="decimal"
                              min={6}
                              max={32}
                              step={1}
                              value={activeModule.carcass.ledChannelWidthMm ?? 12}
                              onChange={(e) =>
                                onToggleModuleLed(true, {
                                  channelWidthMm: Math.max(6, Math.min(32, Number(e.target.value) || 12)),
                                })
                              }
                              className="w-full h-9 px-2.5 rounded-xl bg-[#FAF8F4] border border-[#DED8CC] font-mono text-xs font-semibold text-center"
                            />
                          </label>
                          <label className="space-y-0.5">
                            <span className="text-[9.5px] text-[#57534E] block">Derinlik (mm)</span>
                            <input
                              type="number" inputMode="decimal"
                              min={4}
                              max={15}
                              step={1}
                              value={activeModule.carcass.ledChannelDepthMm ?? 8}
                              onChange={(e) =>
                                onToggleModuleLed(true, {
                                  channelDepthMm: Math.max(4, Math.min(15, Number(e.target.value) || 8)),
                                })
                              }
                              className="w-full h-9 px-2.5 rounded-xl bg-[#FAF8F4] border border-[#DED8CC] font-mono text-xs font-semibold text-center"
                            />
                          </label>
                          <label className="space-y-0.5">
                            <span className="text-[9.5px] text-[#57534E] block">Önden (mm)</span>
                            <input
                              type="number" inputMode="decimal"
                              min={25}
                              max={200}
                              step={5}
                              value={activeModule.carcass.ledFrontSetbackMm ?? 75}
                              onChange={(e) =>
                                onToggleModuleLed(true, {
                                  frontSetbackMm: Math.max(25, Math.min(200, Number(e.target.value) || 75)),
                                })
                              }
                              className="w-full h-9 px-2.5 rounded-xl bg-[#FAF8F4] border border-[#DED8CC] font-mono text-xs font-semibold text-center"
                            />
                          </label>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] text-[#57534E]">
                            Raf & Dikme LED Aynı Düzlemde
                          </span>
                          <StudioToggleSwitch
                            size="sm"
                            checked={activeModule.carcass.ledAlignShelfAndSide !== false}
                            onChange={(next) =>
                              onToggleModuleLed(true, { alignShelfAndSide: next })
                            }
                          />
                        </div>

                        {activeModule.carcass.ledAlignShelfAndSide === false && (
                          <label className="flex items-center justify-between gap-2">
                            <span className="text-[10px] text-[#57534E]">
                              Raf LED Önden Uzaklık (mm)
                            </span>
                            <input
                              type="number" inputMode="decimal"
                              min={25}
                              max={200}
                              step={5}
                              value={activeModule.carcass.ledShelfSetbackMm ?? 75}
                              onChange={(e) =>
                                onToggleModuleLed(true, {
                                  shelfSetbackMm: Math.max(25, Math.min(200, Number(e.target.value) || 75)),
                                })
                              }
                              className="w-24 h-9 px-3 rounded-xl bg-[#FAF8F4] border border-[#DED8CC] font-mono text-xs font-semibold text-center"
                            />
                          </label>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
  );
};
