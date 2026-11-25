"use client";
import React from "react";



import type { Viewport3DCalloutOverlaysProps } from "./viewport3DTypes";
export type { Viewport3DCalloutOverlaysProps };

export const Viewport3DCalloutOverlays: React.FC<Viewport3DCalloutOverlaysProps> = (props) => {
  const {
    activeBayIndex,
    activeBrushMaterialId,
    activeModuleIndex,
    applyMaterialByTargetScope,
    badgeDraftValue,
    collapsedFloatingPanels,
    commitBadgeEdit,
    dimBounds,
    dimLabelDomMapRef,
    dimLabels,
    dimPopoverDomRef,
    editingBadge,
    effectiveShowDimensions,
    floatingPanelPos,
    hardwareViewMode,
    hwCalloutDomMapRef,
    hwCallouts,
    matCalloutDomMapRef,
    matCallouts,
    materialModeActive,
    materialPaintTool,
    selectedComponentId,
    selectedHwCalloutId,
    setActiveBayIndex,
    setBadgeDraftValue,
    setDismissedBayPopover,
    setEditingBadge,
    setSelectedComponentId,
    setSelectedHwCalloutId,
    showInCanvasHud,
    startCalloutBadgeDrag,
    startFloatingPanelDrag,
  } = props;
  return (
    <>
        {/* INTERACTIVE CLICK-TO-EDIT 3D DIMENSION CALLOUT PILLS & FLOATING POPOVER WINDOW */}
        {effectiveShowDimensions && dimLabels.length > 0 && (
          <div
            data-testid="viewport-3d-dim-labels"
            className="absolute inset-0 pointer-events-none overflow-hidden z-[16]"
          >
            {dimLabels.map((item) => {
              const badgeKey: null | "W" | "H" | "D" | "SOKET" =
                item.id === "dim_W"
                  ? "W"
                  : item.id === "dim_H"
                  ? "H"
                  : item.id === "dim_D"
                  ? "D"
                  : item.id === "dim_SOKET"
                  ? "SOKET"
                  : null;
              const isBayBadge = item.id.startsWith("dim_BAY_");
              const bayBadgeIdx = isBayBadge ? Number(item.id.replace("dim_BAY_", "")) : -1;
              const isActiveBayBadge = isBayBadge && bayBadgeIdx === activeBayIndex;
              const isEditingThis = badgeKey !== null && editingBadge === badgeKey;

              return (
                <div
                  key={item.id}
                  data-testid={`viewport-3d-dim-${item.id}`}
                  ref={(el) => {
                    if (el) {
                      dimLabelDomMapRef.current.set(item.id, el);
                    } else {
                      dimLabelDomMapRef.current.delete(item.id);
                    }
                  }}
                  style={{
                    transform: "translate3d(-9999px, -9999px, 0)",
                  }}
                  onMouseDown={(e) => startCalloutBadgeDrag(item.id, e)}
                  onClick={(e) => {
                    if (typeof window !== "undefined" && (window as any).__birimSuppressNextClick && Date.now() - (window as any).__birimSuppressNextClick < 250) {
                      e.stopPropagation();
                      return;
                    }
                    if (isBayBadge && bayBadgeIdx >= 0) {
                      e.stopPropagation();
                      setActiveBayIndex(bayBadgeIdx);
                      setDismissedBayPopover(false);
                      if (typeof window !== "undefined") {
                        window.dispatchEvent(
                          new CustomEvent("birim:select-bay-3d", {
                            detail: {
                              bayIndex: bayBadgeIdx,
                              role: "bay_compartment",
                              moduleIndex: activeModuleIndex,
                            },
                          })
                        );
                      }
                      return;
                    }
                    if (!badgeKey) return;
                    e.stopPropagation();
                    const curVal = dimBounds[badgeKey].current;
                    setBadgeDraftValue(String(curVal));
                    setEditingBadge(badgeKey);
                  }}
                  title={
                    isBayBadge
                      ? `${item.tag} (${item.valueText}) — Bölmeyi seçmek ve iç düzenini açmak için tıklayın`
                      : badgeKey
                      ? `${item.tag} ölçüsünü doğrudan 3D sahnede düzenlemek için tıklayın`
                      : item.tag
                  }
                  className={`absolute top-0 left-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg backdrop-blur-md border whitespace-nowrap transition-all duration-150 shadow-[0_6px_18px_rgba(0,0,0,0.45)] ${
                    item.id.startsWith("dim_SHELF_GAP_")
                      ? "bg-[#15283E]/94 text-white border-[#38BDF8]/80 pointer-events-none"
                      : isActiveBayBadge
                      ? "bg-[#15283E]/96 text-white border-[#38BDF8] ring-1 ring-[#38BDF8]/40 pointer-events-auto cursor-pointer"
                      : isBayBadge
                      ? "bg-[#232935]/90 hover:bg-[#2C3444]/96 text-slate-100 border-white/25 hover:border-[#38BDF8]/70 pointer-events-auto cursor-pointer"
                      : isEditingThis
                      ? "bg-[#15283E]/98 text-white border-2 border-[#38BDF8] pointer-events-auto cursor-pointer"
                      : badgeKey
                      ? "bg-[#222733]/94 hover:bg-[#2B3242]/98 text-white border-white/28 hover:border-[#38BDF8]/80 pointer-events-auto cursor-pointer group"
                      : "bg-[#222733]/92 text-white border-white/22 pointer-events-none"
                  }`}
                >
                  <span
                    className={`text-[10.5px] font-semibold leading-none ${
                      isActiveBayBadge || item.id.startsWith("dim_SHELF_GAP_")
                        ? "text-[#7DD3FC]"
                        : "text-slate-300"
                    }`}
                  >
                    {item.tag}
                  </span>
                  <span
                    className={`text-[12.5px] font-bold leading-none font-mono tabular-nums tracking-tight ${
                      isActiveBayBadge || item.id.startsWith("dim_SHELF_GAP_")
                        ? "text-white"
                        : "text-white"
                    }`}
                  >
                    {item.valueText}
                  </span>
                  {badgeKey && (
                    <span className="text-[10.5px] text-[#7DD3FC] opacity-75 group-hover:opacity-100 transition-opacity leading-none">
                      ✎
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* FAZ 2: 3D HARDWARE SELECTION PINS & CONTEXTUAL CALLOUT CARDS (Matches Birim_Tasarim_5_Donanim_Mekanizmalar.png) */}
        {showInCanvasHud &&
          (hardwareViewMode === "hardware" || hardwareViewMode === "technical") &&
          hwCallouts.length > 0 && (
            <div
              data-testid="viewport-3d-hardware-callouts"
              className="absolute inset-0 pointer-events-none overflow-hidden z-[18]"
            >
              {hwCallouts.map((hc) => {
                const isSelectedPin = selectedHwCalloutId === hc.id;
                return (
                  <div
                    key={hc.id}
                    data-testid={`viewport-3d-hw-${hc.id}`}
                    ref={(el) => {
                      if (el) {
                        hwCalloutDomMapRef.current.set(hc.id, el);
                      } else {
                        hwCalloutDomMapRef.current.delete(hc.id);
                      }
                    }}
                    style={{ transform: "translate3d(-9999px, -9999px, 0)" }}
                    className="absolute top-0 left-0 transition-opacity duration-75"
                  >
                    {/* Blue 3D Hardware Pin Dot at exact 3D coordinate */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedHwCalloutId(hc.id);
                        setActiveBayIndex(hc.bayIndex);
                        if (typeof window !== "undefined") {
                          window.dispatchEvent(
                            new CustomEvent("birim:select-hardware-3d", {
                              detail: {
                                pinId: hc.id,
                                group: hc.group,
                                bayIndex: hc.bayIndex,
                                sku: hc.sku,
                              },
                            })
                          );
                        }
                      }}
                      className={`-translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white shadow-lg pointer-events-auto cursor-pointer transition-transform hover:scale-125 ${
                        isSelectedPin
                          ? "bg-[#1D4ED8] ring-4 ring-[#2563EB]/40 scale-115"
                          : "bg-[#2563EB] ring-2 ring-[#2563EB]/25"
                      }`}
                      title={`${hc.title}: ${hc.subtitle} — Sağ panelde düzenlemek için tıklayın`}
                    />

                    {/* Leader Line + Contextual Hardware Callout Card (Draggable & Collapsible!) */}
                    {!collapsedFloatingPanels.callouts && (
                    <button
                      type="button"
                      data-testid={`viewport-3d-hw-card-${hc.group}`}
                      onMouseDown={(e) => startCalloutBadgeDrag(hc.id, e)}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (typeof window !== "undefined" && (window as any).__birimSuppressNextClick && Date.now() - (window as any).__birimSuppressNextClick < 250) {
                          return;
                        }
                        setSelectedHwCalloutId(hc.id);
                        setActiveBayIndex(hc.bayIndex);
                        if (typeof window !== "undefined") {
                          window.dispatchEvent(
                            new CustomEvent("birim:select-hardware-3d", {
                              detail: {
                                pinId: hc.id,
                                group: hc.group,
                                bayIndex: hc.bayIndex,
                                sku: hc.sku,
                              },
                            })
                          );
                        }
                      }}
                      style={{
                        transform: `translate(${hc.offsetPx[0]}px, ${hc.offsetPx[1]}px)`,
                      }}
                      className={`pointer-events-auto cursor-pointer px-3 py-1.5 rounded-2xl backdrop-blur-md border shadow-xl flex items-center gap-2 text-left whitespace-nowrap transition ${
                        isSelectedPin
                          ? "bg-[#EFF6FF]/98 border-2 border-[#2563EB] ring-2 ring-[#2563EB]/20"
                          : "bg-white/95 hover:bg-[#EFF6FF] border-[#CBD5E1] hover:border-[#2563EB]"
                      }`}
                    >
                      <span className="w-6 h-6 rounded-xl bg-[#F1F5F9] border border-[#E2E8F0] flex items-center justify-center text-[#111827] shrink-0">
                        {hc.group === "hinge" ? (
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <rect x="4" y="6" width="6" height="12" rx="1" />
                            <circle cx="15" cy="12" r="3" />
                            <path d="M10 10h2M10 14h2" />
                          </svg>
                        ) : hc.group === "lighting" ? (
                          <svg className="w-3.5 h-3.5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <path d="M9 18h6M10 22h4M12 2a7 7 0 00-4 12.7V17h8v-2.3A7 7 0 0012 2z" />
                          </svg>
                        ) : hc.group === "accessories" ? (
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <path d="M4 12h16M6 10v4M18 10v4" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <rect x="3" y="7" width="18" height="10" rx="1.5" />
                            <path d="M9 11h6" />
                          </svg>
                        )}
                      </span>
                      <span className="block">
                        <span className="text-[11px] font-extrabold text-[#111827] block leading-tight">
                          {hc.title}
                        </span>
                        <span className="text-[10px] font-medium text-[#475569] block leading-tight mt-0.5">
                          {hc.subtitle}
                        </span>
                      </span>
                      <span className="text-[9px] text-slate-400 ml-1" title="Sürükleyerek taşıyabilirsiniz">⠿</span>
                    </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

        {/* FAZ 2 (SCREEN 6): 3D PART-LEVEL MATERIAL CALLOUT PINS & CARDS (Matches image_dad0ff.jpg: Üst Tabla, Kapak, Sağ Yan Panel, Çekmece Önü, Soket) */}
        {showInCanvasHud && materialModeActive && matCallouts.length > 0 && (
          <div
            data-testid="viewport-3d-material-callouts"
            className="absolute inset-0 pointer-events-none overflow-hidden z-[19]"
          >
            {matCallouts.map((mc) => {
              const isSelectedPart = selectedComponentId === mc.componentId;
              return (
                <div
                  key={mc.id}
                  data-testid={`viewport-3d-mat-${mc.id}`}
                  ref={(el) => {
                    if (el) {
                      matCalloutDomMapRef.current.set(mc.id, el);
                    } else {
                      matCalloutDomMapRef.current.delete(mc.id);
                    }
                  }}
                  style={{ transform: "translate3d(-9999px, -9999px, 0)" }}
                  className="absolute top-0 left-0 transition-opacity duration-75"
                >
                  {/* Blue 3D Part Selection Dot */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      (setSelectedComponentId as (id: string | null, mIdx?: number) => void)(
                        mc.componentId,
                        activeModuleIndex
                      );
                      if (materialPaintTool === "paint") {
                        applyMaterialByTargetScope("selected_part", activeBrushMaterialId, mc.componentId);
                      } else if (materialPaintTool === "group") {
                        applyMaterialByTargetScope(mc.scope, activeBrushMaterialId, mc.componentId);
                      } else if (materialPaintTool === "same_material") {
                        applyMaterialByTargetScope(
                          "same_material_parts",
                          activeBrushMaterialId,
                          mc.componentId
                        );
                      }
                      if (typeof window !== "undefined") {
                        window.dispatchEvent(
                          new CustomEvent("birim:select-material-part-3d", {
                            detail: {
                              componentId: mc.componentId,
                              scope: mc.scope,
                              title: mc.title,
                            },
                          })
                        );
                      }
                    }}
                    className={`-translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white shadow-lg pointer-events-auto cursor-pointer transition-transform hover:scale-125 ${
                      isSelectedPart
                        ? "bg-[#1D4ED8] ring-4 ring-[#2563EB]/40 scale-115"
                        : "bg-[#2563EB] ring-2 ring-[#2563EB]/25"
                    }`}
                  />

                  {/* Contextual Material Callout Card (Draggable!) */}
                  <button
                    type="button"
                    data-testid={`viewport-3d-mat-card-${mc.id}`}
                    onMouseDown={(e) => startCalloutBadgeDrag(mc.id, e)}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (typeof window !== "undefined" && (window as any).__birimSuppressNextClick && Date.now() - (window as any).__birimSuppressNextClick < 250) {
                        return;
                      }
                      (setSelectedComponentId as (id: string | null, mIdx?: number) => void)(
                        mc.componentId,
                        activeModuleIndex
                      );
                      if (materialPaintTool === "paint") {
                        applyMaterialByTargetScope("selected_part", activeBrushMaterialId, mc.componentId);
                      } else if (materialPaintTool === "group") {
                        applyMaterialByTargetScope(mc.scope, activeBrushMaterialId, mc.componentId);
                      } else if (materialPaintTool === "same_material") {
                        applyMaterialByTargetScope(
                          "same_material_parts",
                          activeBrushMaterialId,
                          mc.componentId
                        );
                      }
                      if (typeof window !== "undefined") {
                        window.dispatchEvent(
                          new CustomEvent("birim:select-material-part-3d", {
                            detail: {
                              componentId: mc.componentId,
                              scope: mc.scope,
                              title: mc.title,
                            },
                          })
                        );
                      }
                    }}
                    style={{
                      transform: `translate(${mc.offsetPx[0]}px, ${mc.offsetPx[1]}px)`,
                    }}
                    className={`pointer-events-auto cursor-pointer px-3 py-1.5 rounded-2xl backdrop-blur-md border shadow-xl flex items-center gap-2 text-left whitespace-nowrap transition ${
                      isSelectedPart
                        ? "bg-[#EFF6FF]/98 border-2 border-[#2563EB] ring-2 ring-[#2563EB]/20"
                        : "bg-white/95 hover:bg-[#EFF6FF] border-[#CBD5E1] hover:border-[#2563EB]"
                    }`}
                  >
                    <span
                      className="w-5 h-5 rounded-lg border border-stone-300 shadow-inner shrink-0"
                      style={{ backgroundColor: mc.colorHex }}
                    />
                    <span className="block">
                      <span className="text-xs font-extrabold text-[#111827] block leading-tight">
                        {mc.title}
                      </span>
                      <span className="text-[11px] font-medium text-[#475569] block leading-tight mt-0.5">
                        {mc.subtitle}
                      </span>
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* 3D DIRECT DIMENSION EDITING POPOVER WINDOW (Mevcut değer, Sayısal giriş, Hazır ölçüler, Geçerlilik kontrolü, Enter/Esc) */}
        {editingBadge && (() => {
          const bInfo = dimBounds[editingBadge];
          const draftNum = Number(badgeDraftValue);
          const isNumeric = badgeDraftValue.trim() !== "" && !Number.isNaN(draftNum) && Number.isFinite(draftNum);
          const isOutOfRange = !isNumeric || draftNum < bInfo.min || draftNum > bInfo.max;
          const validPresets = bInfo.presets.filter((p) => p >= bInfo.min && p <= bInfo.max);

          return (
            <div
              ref={dimPopoverDomRef}
              data-floating-card="dim"
              data-testid={`viewport-3d-dim-popover-${editingBadge}`}
              onClick={(e) => e.stopPropagation()}
              style={
                floatingPanelPos.dim
                  ? {
                      left: "0px",
                      top: "0px",
                      translate: "none",
                      transform: `translate3d(${floatingPanelPos.dim.x}px, ${floatingPanelPos.dim.y}px, 0)`,
                    }
                  : undefined
              }
              className={`absolute ${floatingPanelPos.dim ? "top-0 left-0" : "top-[168px] left-1/2 -translate-x-1/2"} z-[55] w-80 birim-ice-popover rounded-[26px] p-4 space-y-3 text-xs text-[#111827] pointer-events-auto`}
            >
              <div
                onPointerDown={(e) => startFloatingPanelDrag("dim", e)}
                title="Pencereyi taşımak için basılı tutup sürükleyin"
                className="flex items-start justify-between gap-2 border-b border-[#E2E8F0] pb-2 cursor-move select-none"
              >
                <div>
                  <div className="text-xs font-bold text-[#111827]">
                    📐 {bInfo.label} Düzenle (3D Doğrudan Giriş)
                  </div>
                  <div className="text-[11px] text-[#475569] mt-0.5">
                    Mevcut değer: <b className="font-mono text-[#111827]">{bInfo.current} mm</b> • İzin verilen: <span className="font-mono">{bInfo.min}–{bInfo.max} mm</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingBadge(null)}
                  className="px-1.5 py-0.5 rounded-lg text-[#64748B] hover:text-[#111827] hover:bg-[#F1F5F9] cursor-pointer"
                  title="İptal (Esc)"
                >
                  ✕
                </button>
              </div>

              {bInfo.isFixed ? (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-medium">
                  Bu modül sabit genişlikli bir şablondur ({bInfo.current} mm). Genişliği değiştirilemez.
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    commitBadgeEdit();
                  }}
                  className="space-y-3"
                >
                  {/* Numeric Input + Stepper */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const next = Math.max(bInfo.min, (isNumeric ? draftNum : bInfo.current) - bInfo.step);
                        setBadgeDraftValue(String(next));
                      }}
                      className="h-9 px-2.5 rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0] border border-[#CBD5E1] font-mono text-xs font-bold text-[#111827] cursor-pointer"
                    >
                      −{bInfo.step}
                    </button>
                    <div className="flex-1 flex items-center justify-between bg-[#F8FAFC] rounded-xl border border-[#94A3B8] px-3 py-1.5">
                      <input
                        type="number" inputMode="decimal"
                        data-testid={`viewport-3d-dim-input-${editingBadge}`}
                        autoFocus
                        min={bInfo.min}
                        max={bInfo.max}
                        step={bInfo.step}
                        value={badgeDraftValue}
                        onChange={(e) => setBadgeDraftValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            e.stopPropagation();
                            setEditingBadge(null);
                          } else if (e.key === "Enter") {
                            e.preventDefault();
                            commitBadgeEdit();
                          }
                        }}
                        className="w-full font-mono text-sm font-bold text-[#111827] bg-transparent focus:outline-none text-center"
                      />
                      <span className="text-[11px] font-semibold text-[#475569] ml-1">mm</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const next = Math.min(bInfo.max, (isNumeric ? draftNum : bInfo.current) + bInfo.step);
                        setBadgeDraftValue(String(next));
                      }}
                      className="h-9 px-2.5 rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0] border border-[#CBD5E1] font-mono text-xs font-bold text-[#111827] cursor-pointer"
                    >
                      +{bInfo.step}
                    </button>
                  </div>

                  {/* Live Validity Check Feedback */}
                  {isOutOfRange ? (
                    <div
                      data-testid="viewport-3d-dim-validation-error"
                      className="p-2 rounded-xl bg-red-50 border border-red-200 text-red-800 text-[11px] font-semibold flex items-center justify-between gap-2"
                    >
                      <span>
                        ⚠️ Geçersiz ölçü! İzin verilen aralık: {bInfo.min} – {bInfo.max} mm.
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setBadgeDraftValue(
                            String(Math.max(bInfo.min, Math.min(bInfo.max, draftNum || bInfo.min)))
                          )
                        }
                        className="px-2 py-0.5 rounded bg-white border border-red-300 text-[10px] font-bold text-red-900 shrink-0 cursor-pointer"
                      >
                        Sınıra Çek
                      </button>
                    </div>
                  ) : (
                    <div className="px-2.5 py-1.5 rounded-xl bg-[#EEF3F8] border border-[#CBD5E1] text-[10px] text-[#111827] flex items-center justify-between">
                      <span>✓ Parametrik kurallara uygun</span>
                      <span className="font-mono font-bold">
                        Δ {draftNum - bInfo.current >= 0 ? `+${draftNum - bInfo.current}` : draftNum - bInfo.current} mm
                      </span>
                    </div>
                  )}

                  {/* Supported Quick Preset Dimension Chips */}
                  {validPresets.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] block">
                        Hazır Ölçü Seçenekleri (mm):
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {validPresets.map((presetVal) => {
                          const isCurrent = draftNum === presetVal;
                          return (
                            <button
                              key={presetVal}
                              type="button"
                              data-testid={`viewport-3d-dim-preset-${presetVal}`}
                              onClick={() => {
                                setBadgeDraftValue(String(presetVal));
                                commitBadgeEdit(presetVal);
                              }}
                              className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold border transition cursor-pointer ${
                                isCurrent
                                  ? "bg-[#EEF3F8] text-[#111827] border-[#3B82F6] shadow-2xs"
                                  : "bg-white hover:bg-[#F8FAFC] text-[#475569] border-[#E2E8F0]"
                              }`}
                            >
                              {presetVal}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Confirm (Enter) & Cancel (Escape) Buttons */}
                  <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-[#E2E8F0]">
                    <button
                      type="button"
                      data-testid="viewport-3d-dim-cancel-btn"
                      onClick={() => setEditingBadge(null)}
                      className="px-3 py-1.5 rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#475569] text-[11px] font-semibold cursor-pointer"
                    >
                      İptal (Esc)
                    </button>
                    <button
                      type="submit"
                      data-testid="viewport-3d-dim-confirm-btn"
                      disabled={isOutOfRange}
                      className="px-4 py-1.5 rounded-xl bg-[#EEF3F8] hover:bg-[#E4ECF4] disabled:opacity-40 text-[#111827] border border-[#94A3B8] text-[11px] font-bold cursor-pointer"
                    >
                      Onayla (Enter)
                    </button>
                  </div>
                </form>
              )}
            </div>
          );
        })()}
    </>
  );
};
