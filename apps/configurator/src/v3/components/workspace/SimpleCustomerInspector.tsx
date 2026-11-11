"use client";

import React, { useState, useEffect } from "react";
import type { BayConfig, MaterialDefinition, ModuleInstance } from "@birim/core";
import { useConfiguratorStore, type UserExperienceTier } from "../../../store/useConfiguratorStore";
import { startAccessorySilhouetteDrag } from "../../engine/kitchenSpatialEngine";
import type { TapToPlaceItemSpec } from "./TapToPlaceController";
import {
  Columns,
  DoorOpen,
  Eye,
  EyeOff,
  Palette,
  Ruler,
  Lightbulb,
  Check,
  ArrowRight,
  ChevronDown,
} from "lucide-react";

interface SimpleCustomerInspectorProps {
  activeModule: ModuleInstance;
  activeBay: BayConfig | undefined;
  activeBayIndex: number;
  bayWidths: number[];
  materials: MaterialDefinition[];
  doorOpenAngleDeg: number;
  onSelectBay: (idx: number) => void;
  onSplitBay: (idx: number) => void;
  onMergeBay: (idx: number) => void;
  onRemoveBayAndShrink?: (idx: number) => void;
  onShrinkDoubleBay?: (idx: number) => void;
  onSetDimensions: (w: number, h: number, d: number) => void;
  onToggleDoorOpen: () => void;
  onSetBayDoorType: (
    bayIdx: number,
    type: "single_left" | "single_right" | "double" | "sliding" | "open"
  ) => void;
  onApplyBayPreset: (
    bayIdx: number,
    presetId: "shelves_4" | "rail_double" | "rail_drawers_3" | "mixed_combo"
  ) => void;
  onAddShelf: (bayIdx: number) => void;
  onRemoveShelf: (bayIdx: number, id: string) => void;
  onAddSubDivider: (bayIdx: number) => void;
  onRemoveSubDivider: (bayIdx: number, id: string) => void;
  onAddDrawer: (bayIdx: number) => void;
  onRemoveDrawer: (bayIdx: number, id: string) => void;
  onAddInternalDrawer: (bayIdx: number, h: number) => void;
  onAddHangingRail: (bayIdx: number) => void;
  onRemoveHangingRail: (bayIdx: number, id: string) => void;
  onAddSpecialFitting: (bayIdx: number, type: "trouser_rack" | "shoe_rack") => void;
  onSetMaterials: (bodyMatId?: string, doorMatId?: string) => void;
  onToggleLed: (enabled: boolean) => void;
  onSwitchTier: (tier: UserExperienceTier) => void;
  onArmTapToPlace?: (item: TapToPlaceItemSpec) => void;
  renderInteriorIcon: (
    kind:
      | "shelf"
      | "sub_divider"
      | "carcass_divider"
      | "drawer"
      | "internal_drawer"
      | "rail"
      | "trouser_rack"
      | "shoe_rack",
    size: "sm" | "md"
  ) => React.ReactNode;
}

function cleanMaterialDisplayName(rawName: string): string {
  return rawName
    .replace(/^Kastamonu Entegre\s+/i, "")
    .replace(/^Yıldız Entegre\s+/i, "")
    .replace(/^Çamsan Entegre\s+/i, "")
    .replace(/^AGT\s+\d+\s*/i, "AGT ")
    .split("(")[0]
    .trim();
}

const SafeUnitInput: React.FC<{
  label: string;
  valueMm: number;
  minMm: number;
  maxMm: number;
  unit: "cm" | "mm";
  onCommitMm: (nextMm: number) => void;
}> = ({ label, valueMm, minMm, maxMm, unit, onCommitMm }) => {
  const toDisplay = (mm: number) =>
    unit === "cm" ? String(Math.round((mm / 10) * 10) / 10) : String(Math.round(mm));
  const [draft, setDraft] = useState<string>(() => toDisplay(valueMm));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setDraft(toDisplay(valueMm));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueMm, unit, focused]);

  const commit = (raw: string) => {
    const parsed = Number(raw.replace(",", "."));
    if (!Number.isFinite(parsed) || raw.trim() === "") {
      setDraft(toDisplay(valueMm));
      return;
    }
    const mm = unit === "cm" ? Math.round(parsed * 10) : Math.round(parsed);
    const clamped = Math.max(minMm, Math.min(maxMm, mm));
    setDraft(toDisplay(clamped));
    onCommitMm(clamped);
  };

  return (
    <div className="px-2.5 py-2 rounded-lg bg-[#FAF9F6] border border-[#DED8CC] focus-within:border-[#141413] focus-within:bg-white transition">
      <div className="text-[10px] font-medium text-[#78716C] flex items-center justify-between">
        <span>{label}</span>
        <span className="font-mono text-[9px] uppercase">{unit}</span>
      </div>
      <input
        type="text"
        inputMode="decimal"
        value={focused ? draft : toDisplay(valueMm)}
        onFocus={() => {
          setFocused(true);
          setDraft(toDisplay(valueMm));
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => {
          setFocused(false);
          commit(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            setFocused(false);
            setDraft(toDisplay(valueMm));
          }
        }}
        className="w-full text-center font-mono text-sm font-bold text-[#141413] bg-transparent focus:outline-none mt-0.5"
      />
    </div>
  );
};

export const SimpleCustomerInspector: React.FC<SimpleCustomerInspectorProps> = ({
  activeModule,
  activeBay,
  activeBayIndex,
  bayWidths,
  materials,
  doorOpenAngleDeg,
  onSelectBay,
  onSplitBay,
  onMergeBay,
  onRemoveBayAndShrink,
  onShrinkDoubleBay,
  onSetDimensions,
  onToggleDoorOpen,
  onSetBayDoorType,
  onApplyBayPreset,
  onAddShelf,
  onRemoveShelf,
  onAddSubDivider,
  onRemoveSubDivider,
  onAddDrawer,
  onRemoveDrawer,
  onAddInternalDrawer,
  onAddHangingRail,
  onRemoveHangingRail,
  onAddSpecialFitting,
  onSetMaterials,
  onToggleLed,
  onSwitchTier,
  onArmTapToPlace,
  renderInteriorIcon,
}) => {
  const [unit, setUnit] = useState<"cm" | "mm">("cm");
  const [matTarget, setMatTarget] = useState<"door" | "body">("door");
  const [tapModeEnabled, setTapModeEnabled] = useState<boolean>(false);
  const [collapsedSteps, setCollapsedSteps] = useState<Record<number, boolean>>({
    1: false,
    2: false,
    3: false,
    4: false,
  });

  const toggleStep = (stepNum: number) => {
    setCollapsedSteps((prev) => ({ ...prev, [stepNum]: !prev[stepNum] }));
  };

  const { width, height, depth } = activeModule.dimensions;
  const ledOn = Boolean(activeModule.carcass.ledLightingEnabled);

  const curatedSwatches = materials
    .filter((m) => m.id !== "mat_led_warm_3000k")
    .slice(0, 10);

  // Detect active bay's current layout signature so preset thumbnails reflect real state!
  const bayShelfCount = activeBay?.shelves.length || 0;
  const bayRailCount = activeBay?.hangingRails.length || 0;
  const bayDrawerCount = activeBay?.drawers.length || 0;
  const activePresetId =
    bayRailCount >= 2 && bayDrawerCount === 0
      ? "rail_double"
      : bayShelfCount >= 4 && bayRailCount === 0 && bayDrawerCount === 0
      ? "shelves_4"
      : bayRailCount >= 1 && bayDrawerCount >= 3
      ? "rail_drawers_3"
      : bayRailCount >= 1 && bayShelfCount >= 2 && bayDrawerCount >= 1
      ? "mixed_combo"
      : null;

  const activeDoorMat = materials.find((m) => m.id === activeModule.carcass.doorMaterialId);
  const activeDoorHex = activeDoorMat?.colorHex || "#D6C7B2";
  const activeBodyMat = materials.find((m) => m.id === activeModule.carcass.bodyMaterialId);
  const activeBodyHex = activeBodyMat?.colorHex || "#F5F3EE";

  return (
    <div data-testid="blum-clean-inspector-card" className="space-y-2.5">
      {/* LIVE MINI VISUAL SUMMARY STRIP OF SELECTED MODULE & BAY (Updates Instantly on Every Change!) */}
      <div className="p-2.5 rounded-xl bg-[#FAF9F6] border border-[#DED8CC] flex items-center gap-3">
        <svg viewBox="0 0 88 64" className="w-16 h-12 shrink-0 select-none">
          {/* Dynamic Module Proportional Preview */}
          {(() => {
            const drawW = Math.max(38, Math.min(76, Math.round((width / 2600) * 74)));
            const drawH = Math.max(32, Math.min(54, Math.round((height / 2600) * 52)));
            const sx = Math.round((88 - drawW) / 2);
            const sy = 58 - drawH;
            const nBays = Math.max(1, activeModule.bays.length);
            const unitW = drawW / nBays;
            return (
              <g>
                <rect
                  x={sx}
                  y={sy}
                  width={drawW}
                  height={drawH}
                  rx="1.5"
                  fill={activeBodyHex}
                  stroke="#44403C"
                  strokeWidth="1.4"
                />
                {activeModule.bays.map((b, idx) => {
                  const bx = sx + idx * unitW;
                  const isAct = idx === activeBayIndex;
                  const dType = b.door?.type || "double";
                  const showOpen =
                    Boolean(activeModule.isOpenFront) ||
                    dType === "open" ||
                    doorOpenAngleDeg > 10 ||
                    isAct;
                  return (
                    <g key={b.index}>
                      {idx > 0 && (
                        <line
                          x1={bx}
                          y1={sy}
                          x2={bx}
                          y2={sy + drawH}
                          stroke="#57534E"
                          strokeWidth="1.1"
                        />
                      )}
                      {showOpen ? (
                        <g>
                          <rect
                            x={bx + 1}
                            y={sy + 1}
                            width={Math.max(4, unitW - 2)}
                            height={drawH - 2}
                            fill={isAct ? "#FFFDF9" : activeBodyHex}
                          />
                          {ledOn && (
                            <line
                              x1={bx + 2}
                              y1={sy + 2.5}
                              x2={bx + unitW - 2}
                              y2={sy + 2.5}
                              stroke="#F59E0B"
                              strokeWidth="1.8"
                            />
                          )}
                          {(b.hangingRails || []).map((r, rI) => (
                            <line
                              key={r.id || rI}
                              x1={bx + 2}
                              y1={sy + 7 + rI * 14}
                              x2={bx + unitW - 2}
                              y2={sy + 7 + rI * 14}
                              stroke="#57534E"
                              strokeWidth="1.4"
                            />
                          ))}
                          {(b.shelves || []).slice(0, 5).map((sh, sI) => {
                            const ratio = Math.min(
                              0.85,
                              Math.max(0.16, 1 - sh.elevationY / Math.max(500, height - 120))
                            );
                            return (
                              <line
                                key={sh.id || sI}
                                x1={bx + 1.5}
                                y1={sy + drawH * ratio}
                                x2={bx + unitW - 1.5}
                                y2={sy + drawH * ratio}
                                stroke="#8C7A6B"
                                strokeWidth="1.1"
                              />
                            );
                          })}
                          {(b.drawers || []).slice(0, 4).map((dr, dI) => {
                            const dh = 4.5;
                            const dy = sy + drawH - (dI + 1) * 5.2 - 1;
                            return (
                              <rect
                                key={dr.id || dI}
                                x={bx + 1.5}
                                y={dy}
                                width={Math.max(3, unitW - 3)}
                                height={dh}
                                fill={activeDoorHex}
                                stroke="#57534E"
                                strokeWidth="0.7"
                              />
                            );
                          })}
                        </g>
                      ) : (
                        <rect
                          x={bx + 0.8}
                          y={sy + 0.8}
                          width={Math.max(4, unitW - 1.6)}
                          height={drawH - 1.6}
                          fill={activeDoorHex}
                          stroke="#57534E"
                          strokeWidth="0.9"
                        />
                      )}
                      {isAct && (
                        <rect
                          x={bx + 0.5}
                          y={sy + 0.5}
                          width={Math.max(4, unitW - 1)}
                          height={drawH - 1}
                          fill="none"
                          stroke="#141413"
                          strokeWidth="1.4"
                        />
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })()}
        </svg>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold text-[#141413] truncate">
            {activeBayIndex + 1}. Bölme Seçili ({Math.round((bayWidths[activeBayIndex] || 0) / 10)} cm)
          </div>
          <div className="text-[10px] text-[#57534E] mt-0.5 leading-snug">
            {bayRailCount} Askı • {bayShelfCount} Raf • {bayDrawerCount} Çekmece
          </div>
          <div className="text-[10px] text-[#8C7A6B] font-medium truncate mt-0.5">
            {cleanMaterialDisplayName(activeDoorMat?.name || "Doğal Meşe")}
          </div>
        </div>
      </div>

      {/* 1. ÖLÇÜLER */}
      <section className="rounded-xl bg-white border border-[#DED8CC] overflow-hidden">
        <div className="px-3 py-2.5 flex items-center justify-between gap-2 bg-[#FAF9F6]/70 border-b border-[#EFECE5]">
          <button
            type="button"
            onClick={() => toggleStep(1)}
            className="flex items-center gap-2 text-left cursor-pointer flex-1 min-w-0"
          >
            <span className="w-5 h-5 rounded-md bg-[#141413] text-[#FAF9F6] text-[10px] font-bold flex items-center justify-center shrink-0">
              1
            </span>
            <span className="text-xs font-bold text-[#141413]">Dolap Ölçüsü</span>
            <span className="text-[10px] font-mono text-[#78716C] ml-auto mr-1">
              {unit === "cm"
                ? `${width / 10}×${height / 10}×${depth / 10}`
                : `${width}×${height}×${depth}`}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-[#78716C] transition-transform ${
                collapsedSteps[1] ? "-rotate-90" : ""
              }`}
            />
          </button>

          <div className="inline-flex rounded-md bg-[#EFECE5] p-0.5 text-[10px] font-bold border border-[#DED8CC]">
            <button
              type="button"
              onClick={() => setUnit("cm")}
              className={`px-2 py-0.5 rounded-xs cursor-pointer transition ${
                unit === "cm" ? "bg-[#141413] text-white" : "text-[#57534E]"
              }`}
            >
              cm
            </button>
            <button
              type="button"
              onClick={() => setUnit("mm")}
              className={`px-2 py-0.5 rounded-xs cursor-pointer transition ${
                unit === "mm" ? "bg-[#141413] text-white" : "text-[#57534E]"
              }`}
            >
              mm
            </button>
          </div>
        </div>

        {!collapsedSteps[1] && (
          <div className="p-3 space-y-2.5">
            <div className="grid grid-cols-3 gap-1.5">
              <SafeUnitInput
                label="Genişlik"
                valueMm={width}
                minMm={300}
                maxMm={3600}
                unit={unit}
                onCommitMm={(w) => onSetDimensions(w, height, depth)}
              />
              <SafeUnitInput
                label="Yükseklik"
                valueMm={height}
                minMm={400}
                maxMm={2800}
                unit={unit}
                onCommitMm={(h) => onSetDimensions(width, h, depth)}
              />
              <SafeUnitInput
                label="Derinlik"
                valueMm={depth}
                minMm={250}
                maxMm={900}
                unit={unit}
                onCommitMm={(d) => onSetDimensions(width, height, d)}
              />
            </div>

            <div className="space-y-1.5">
              <div className="grid grid-cols-5 gap-1">
                {[800, 1200, 1600, 2000, 2400].map((presetW) => (
                  <button
                    key={presetW}
                    type="button"
                    onClick={() => onSetDimensions(presetW, height, depth)}
                    className={`h-7 rounded-lg text-[11px] font-mono font-semibold transition cursor-pointer border ${
                      width === presetW
                        ? "bg-[#141413] text-white border-[#141413]"
                        : "bg-[#FAF9F6] hover:bg-[#EFECE5] text-[#44403C] border-[#DED8CC]"
                    }`}
                  >
                    {unit === "cm" ? `${presetW / 10}` : presetW}
                  </button>
                ))}
              </div>
              <input
                type="range"
                min={400}
                max={3200}
                step={50}
                value={Math.min(3200, Math.max(400, width))}
                onPointerDown={() => useConfiguratorStore.getState().beginHistoryTransaction()}
                onPointerUp={() => useConfiguratorStore.getState().commitHistoryTransaction()}
                onPointerCancel={() => useConfiguratorStore.getState().commitHistoryTransaction()}
                onChange={(e) => onSetDimensions(Number(e.target.value), height, depth)}
                className="w-full accent-[#141413] h-1.5 bg-[#E4DFD5] rounded-lg cursor-pointer"
              />
            </div>
          </div>
        )}
      </section>

      {/* 2. BÖLMELER & TEK TIKLA İÇ DÜZEN */}
      <section className="rounded-xl bg-white border border-[#DED8CC] overflow-hidden">
        <div className="px-3 py-2.5 flex items-center justify-between gap-2 bg-[#FAF9F6]/70 border-b border-[#EFECE5]">
          <button
            type="button"
            onClick={() => toggleStep(2)}
            className="flex items-center gap-2 text-left cursor-pointer flex-1 min-w-0"
          >
            <span className="w-5 h-5 rounded-md bg-[#141413] text-[#FAF9F6] text-[10px] font-bold flex items-center justify-center shrink-0">
              2
            </span>
            <span className="text-xs font-bold text-[#141413]">
              Bölmeler ({activeModule.bays.length}) &amp; İç Düzen
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-[#78716C] ml-auto transition-transform ${
                collapsedSteps[2] ? "-rotate-90" : ""
              }`}
            />
          </button>

          <button
            type="button"
            onClick={onToggleDoorOpen}
            className={`h-6 px-2.5 rounded-md text-[10px] font-semibold inline-flex items-center gap-1 border transition cursor-pointer ${
              doorOpenAngleDeg > 0
                ? "bg-[#141413] text-white border-[#141413]"
                : "bg-white hover:bg-[#EFECE5] text-[#141413] border-[#DED8CC]"
            }`}
          >
            {doorOpenAngleDeg > 0 ? (
              <>
                <EyeOff className="w-3 h-3" />
                <span>Kapat</span>
              </>
            ) : (
              <>
                <Eye className="w-3 h-3" />
                <span>İçini Gör</span>
              </>
            )}
          </button>
        </div>

        {!collapsedSteps[2] && (
          <div className="p-3 space-y-3">
            {/* Bay Selector + Split / Merge */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {activeModule.bays.map((b, idx) => {
                const isAct = idx === activeBayIndex;
                const bw = bayWidths[idx] || 0;
                return (
                  <button
                    key={b.index}
                    type="button"
                    onClick={() => onSelectBay(idx)}
                    className={`flex-1 min-w-[70px] py-1.5 px-2 rounded-lg border text-center transition cursor-pointer ${
                      isAct
                        ? "bg-[#141413] text-white border-[#141413]"
                        : "bg-[#FAF9F6] hover:bg-[#EFECE5] text-[#44403C] border-[#DED8CC]"
                    }`}
                  >
                    <span className="text-[11px] font-bold block">{idx + 1}. Bölme</span>
                    <span
                      className={`text-[10px] font-mono block ${
                        isAct ? "text-[#D6C7B2]" : "text-[#78716C]"
                      }`}
                    >
                      {unit === "cm" ? `${Math.round(bw / 10)} cm` : `${bw} mm`}
                    </span>
                  </button>
                );
              })}

              <div
                role="button"
                tabIndex={0}
                data-testid="simple-split-selected-bay-btn"
                draggable={true}
                onDragStart={(e) =>
                  startAccessorySilhouetteDrag(e, {
                    id: "lib_carcass_divider",
                    visual: "carcass_divider",
                    title: "Ara Dikme (2'ye Böl)",
                    cat: "dikme",
                    spec: "Seçili Bölmeyi 2'ye Böler",
                  })
                }
                onDragEnd={() => {
                  if (typeof window !== "undefined") {
                    (
                      window as unknown as { __birimActiveDraggedAccessory?: unknown }
                    ).__birimActiveDraggedAccessory = null;
                  }
                }}
                onClick={() => onSplitBay(activeBayIndex)}
                className="h-9 px-2.5 rounded-lg bg-[#FAF9F6] hover:bg-[#EFECE5] border border-dashed border-[#8C7A6B] text-[#141413] text-[11px] font-semibold flex items-center justify-center cursor-pointer"
                title="Seçili bölmeyi ikiye böl"
              >
                + Bölme
              </div>

            </div>

            {/* Explicit Compartment Removal / Merge Bar */}
            {(activeModule.bays.length > 1 ||
              (activeBay?.door?.type === "double" && (bayWidths[activeBayIndex] || 0) >= 760)) && (
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                {activeModule.bays.length > 1 && (
                  <button
                    type="button"
                    data-testid="simple-merge-selected-bay-btn"
                    onClick={() => onMergeBay(activeBayIndex)}
                    className="flex-1 min-w-[120px] py-1.5 px-2.5 rounded-lg bg-[#FAF9F6] hover:bg-[#EFECE5] border border-[#DED8CC] text-[10.5px] font-semibold text-[#44403C] transition cursor-pointer text-center"
                    title="Ara dikmeyi kaldırıp yan bölmeyle birleştirir; dolap dış genişliği sabit kalır"
                  >
                    Dikmeyi Kaldır (Birleştir)
                  </button>
                )}
                {activeModule.bays.length > 1 && onRemoveBayAndShrink && (
                  <button
                    type="button"
                    data-testid="simple-delete-shrink-bay-btn"
                    onClick={() => onRemoveBayAndShrink(activeBayIndex)}
                    className="flex-1 min-w-[125px] py-1.5 px-2.5 rounded-lg bg-[#FAF9F6] hover:bg-red-50 border border-[#DED8CC] hover:border-red-200 text-[10.5px] font-semibold text-red-700 transition cursor-pointer text-center"
                    title="Seçili bölmeyi kapak ve iç düzeniyle çıkarır; dolap genişliğini bu bölme kadar daraltır"
                  >
                    {activeBayIndex + 1}. Bölmeyi Sil (Daralt)
                  </button>
                )}
                {activeBay?.door?.type === "double" &&
                  (bayWidths[activeBayIndex] || 0) >= 760 &&
                  onShrinkDoubleBay && (
                    <button
                      type="button"
                      data-testid="simple-shrink-double-bay-btn"
                      onClick={() => onShrinkDoubleBay(activeBayIndex)}
                      className="w-full py-1.5 px-2.5 rounded-lg bg-[#FAF9F6] hover:bg-[#EFECE5] border border-[#DED8CC] text-[10.5px] font-semibold text-[#141413] transition cursor-pointer text-center"
                      title="Çift kapaklı geniş bölmeyi tek kapaklı bölmeye düşürür ve dolap genişliğini daraltır"
                    >
                      Çift Kapağı Tek Kapağa Düşür (Daralt)
                    </button>
                  )}
              </div>
            )}

            {/* 1-Click Ready Interior Combos with Architectural Schematic Previews */}
            <div>
              <div className="text-[10px] font-semibold text-[#78716C] mb-1.5">
                Seçili Bölme İçin Hazır Düzen
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  {
                    id: "rail_double" as const,
                    label: "Çift Askı",
                    svg: (
                      <svg viewBox="0 0 28 32" className="w-6 h-7">
                        <rect x="3" y="2" width="22" height="28" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                        <line x1="5" y1="8" x2="23" y2="8" stroke="currentColor" strokeWidth="1.5" />
                        <line x1="5" y1="18" x2="23" y2="18" stroke="currentColor" strokeWidth="1.5" />
                      </svg>
                    ),
                  },
                  {
                    id: "shelves_4" as const,
                    label: "4 Raflı",
                    svg: (
                      <svg viewBox="0 0 28 32" className="w-6 h-7">
                        <rect x="3" y="2" width="22" height="28" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                        <line x1="4" y1="8" x2="24" y2="8" stroke="currentColor" strokeWidth="1.3" />
                        <line x1="4" y1="14" x2="24" y2="14" stroke="currentColor" strokeWidth="1.3" />
                        <line x1="4" y1="20" x2="24" y2="20" stroke="currentColor" strokeWidth="1.3" />
                        <line x1="4" y1="25" x2="24" y2="25" stroke="currentColor" strokeWidth="1.3" />
                      </svg>
                    ),
                  },
                  {
                    id: "rail_drawers_3" as const,
                    label: "Askı+Çek.",
                    svg: (
                      <svg viewBox="0 0 28 32" className="w-6 h-7">
                        <rect x="3" y="2" width="22" height="28" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                        <line x1="5" y1="8" x2="23" y2="8" stroke="currentColor" strokeWidth="1.5" />
                        <line x1="4" y1="19" x2="24" y2="19" stroke="currentColor" strokeWidth="1.3" />
                        <line x1="4" y1="23" x2="24" y2="23" stroke="currentColor" strokeWidth="1.3" />
                        <line x1="4" y1="27" x2="24" y2="27" stroke="currentColor" strokeWidth="1.3" />
                      </svg>
                    ),
                  },
                  {
                    id: "mixed_combo" as const,
                    label: "Tam Düzen",
                    svg: (
                      <svg viewBox="0 0 28 32" className="w-6 h-7">
                        <rect x="3" y="2" width="22" height="28" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                        <line x1="4" y1="7" x2="24" y2="7" stroke="currentColor" strokeWidth="1.3" />
                        <line x1="6" y1="10" x2="22" y2="10" stroke="currentColor" strokeWidth="1.5" />
                        <line x1="4" y1="19" x2="24" y2="19" stroke="currentColor" strokeWidth="1.3" />
                        <line x1="4" y1="24" x2="24" y2="24" stroke="currentColor" strokeWidth="1.3" />
                      </svg>
                    ),
                  },
                ].map((pr) => {
                  const isActPreset = activePresetId === pr.id;
                  return (
                    <button
                      key={pr.id}
                      type="button"
                      onClick={() => onApplyBayPreset(activeBayIndex, pr.id)}
                      className={`py-2 px-1 rounded-lg border flex flex-col items-center gap-1 text-[10px] font-semibold transition cursor-pointer ${
                        isActPreset
                          ? "bg-[#141413] text-white border-[#141413]"
                          : "bg-[#FAF9F6] hover:bg-[#EFECE5] border-[#DED8CC] text-[#141413]"
                      }`}
                    >
                      {pr.svg}
                      <span className="truncate max-w-full">{pr.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Drag-or-Click / Tap-to-Place Individual Interior Parts */}
            <div>
              <div className="flex items-center justify-between text-[10px] text-[#78716C] mb-1.5 gap-2">
                <span className="font-semibold">Tek Tek Parça Ekle</span>
                {onArmTapToPlace && (
                  <button
                    type="button"
                    data-testid="toggle-tap-to-place-mode-btn"
                    onClick={() => setTapModeEnabled((v) => !v)}
                    className={`px-2 py-0.5 rounded-md border text-[10px] font-semibold transition cursor-pointer ${
                      tapModeEnabled
                        ? "bg-[#141413] text-white border-[#141413]"
                        : "bg-[#FAF9F6] text-[#44403C] border-[#DED8CC]"
                    }`}
                  >
                    {tapModeEnabled ? "Dokun-Yerleştir: Açık" : "Dokun-Yerleştir"}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  {
                    id: "lib_shelf",
                    title: "Raf",
                    visual: "shelf" as const,
                    count: activeBay?.shelves.length || 0,
                    onClick: () => onAddShelf(activeBayIndex),
                  },
                  {
                    id: "lib_drawer",
                    title: "Çekmece",
                    visual: "drawer" as const,
                    count: activeBay?.drawers.filter((d) => !d.isInternal).length || 0,
                    onClick: () => onAddDrawer(activeBayIndex),
                  },
                  {
                    id: "lib_internal_drawer",
                    title: "İç Çekmece",
                    visual: "internal_drawer" as const,
                    count: activeBay?.drawers.filter((d) => d.isInternal).length || 0,
                    onClick: () => onAddInternalDrawer(activeBayIndex, 140),
                  },
                  {
                    id: "lib_rail",
                    title: "Askılık",
                    visual: "rail" as const,
                    count: activeBay?.hangingRails.length || 0,
                    onClick: () => onAddHangingRail(activeBayIndex),
                  },
                  {
                    id: "lib_trouser_rack",
                    title: "Pantolonluk",
                    visual: "trouser_rack" as const,
                    count:
                      activeBay?.specialFittings?.filter((f) => f.type === "trouser_rack").length ||
                      0,
                    onClick: () => onAddSpecialFitting(activeBayIndex, "trouser_rack"),
                  },
                  {
                    id: "lib_shoe_rack",
                    title: "Ayakkabılık",
                    visual: "shoe_rack" as const,
                    count:
                      activeBay?.specialFittings?.filter((f) => f.type === "shoe_rack").length || 0,
                    onClick: () => onAddSpecialFitting(activeBayIndex, "shoe_rack"),
                  },
                  {
                    id: "lib_sub_divider",
                    title: "Ara Bölme",
                    visual: "sub_divider" as const,
                    count: activeBay?.subDividers?.length || 0,
                    onClick: () => onAddSubDivider(activeBayIndex),
                  },
                  {
                    id: "lib_carcass_divider",
                    title: "Ana Dikme",
                    visual: "carcass_divider" as const,
                    count: Math.max(0, activeModule.bays.length - 1),
                    onClick: () => onSplitBay(activeBayIndex),
                  },
                ].map((tile) => (
                  <div
                    key={tile.id}
                    role="button"
                    tabIndex={0}
                    data-testid={`right-quick-drag-${tile.id}`}
                    draggable={true}
                    onDragStart={(e) =>
                      startAccessorySilhouetteDrag(e, {
                        id: tile.id,
                        visual: tile.visual,
                        title: tile.title,
                        cat: "all",
                        spec: tile.title,
                      })
                    }
                    onDragEnd={() => {
                      if (typeof window !== "undefined") {
                        (
                          window as unknown as { __birimActiveDraggedAccessory?: unknown }
                        ).__birimActiveDraggedAccessory = null;
                      }
                    }}
                    onClick={() => {
                      if (tapModeEnabled && onArmTapToPlace) {
                        const kindMap: Record<string, TapToPlaceItemSpec["kind"]> = {
                          lib_shelf: "shelf",
                          lib_drawer: "drawer",
                          lib_internal_drawer: "internal_drawer",
                          lib_rail: "rail",
                          lib_trouser_rack: "trouser_rack",
                          lib_shoe_rack: "shoe_rack",
                          lib_sub_divider: "sub_divider",
                          lib_carcass_divider: "carcass_divider",
                        };
                        onArmTapToPlace({
                          id: tile.id,
                          kind: kindMap[tile.id] || "shelf",
                          label: tile.title.trim(),
                        });
                        return;
                      }
                      tile.onClick();
                    }}
                    className="p-2 rounded-lg bg-[#FAF9F6] hover:bg-[#EFECE5] border border-[#DED8CC] flex flex-col items-center justify-between gap-1 transition cursor-grab active:cursor-grabbing select-none relative"
                  >
                    {tile.count > 0 && (
                      <span className="pointer-events-none absolute top-1 right-1 min-w-[15px] h-[15px] px-1 rounded-xs bg-[#141413] text-white text-[9px] font-bold flex items-center justify-center">
                        {tile.count}
                      </span>
                    )}
                    <div className="pointer-events-none py-0.5 flex items-center justify-center">
                      {renderInteriorIcon(tile.visual, "sm")}
                    </div>
                    <span className="pointer-events-none text-[10px] font-semibold text-[#141413] leading-tight text-center">
                      {tile.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Removable Chips for Active Bay */}
            {activeBay &&
              (activeBay.shelves.length > 0 ||
                (activeBay.subDividers?.length || 0) > 0 ||
                activeBay.drawers.length > 0 ||
                activeBay.hangingRails.length > 0) && (
                <div className="pt-2 border-t border-[#EFECE5] flex flex-wrap gap-1">
                  {activeBay.shelves.map((sh, sIdx) => (
                    <span
                      key={sh.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FAF9F6] border border-[#DED8CC] text-[10px] font-medium text-[#141413]"
                    >
                      <span>Raf {sIdx + 1}</span>
                      <button
                        type="button"
                        onClick={() => onRemoveShelf(activeBayIndex, sh.id)}
                        className="text-[#78716C] hover:text-red-600 font-bold cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {(activeBay.subDividers || []).map((sd, sdIdx) => (
                    <span
                      key={sd.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FAF9F6] border border-[#DED8CC] text-[10px] font-medium text-[#141413]"
                    >
                      <span>Dikme {sdIdx + 1}</span>
                      <button
                        type="button"
                        onClick={() => onRemoveSubDivider(activeBayIndex, sd.id)}
                        className="text-[#78716C] hover:text-red-600 font-bold cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {activeBay.drawers.map((dr, dIdx) => (
                    <span
                      key={dr.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FAF9F6] border border-[#DED8CC] text-[10px] font-medium text-[#141413]"
                    >
                      <span>Çekmece {dIdx + 1}</span>
                      <button
                        type="button"
                        onClick={() => onRemoveDrawer(activeBayIndex, dr.id)}
                        className="text-[#78716C] hover:text-red-600 font-bold cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {activeBay.hangingRails.map((rl, rIdx) => (
                    <span
                      key={rl.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FAF9F6] border border-[#DED8CC] text-[10px] font-medium text-[#141413]"
                    >
                      <span>Askı {rIdx + 1}</span>
                      <button
                        type="button"
                        onClick={() => onRemoveHangingRail(activeBayIndex, rl.id)}
                        className="text-[#78716C] hover:text-red-600 font-bold cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
          </div>
        )}
      </section>

      {/* 3. KAPAK STİLİ & İÇ LED AYDINLATMA */}
      <section className="rounded-xl bg-white border border-[#DED8CC] overflow-hidden">
        <div className="px-3 py-2.5 flex items-center justify-between gap-2 bg-[#FAF9F6]/70 border-b border-[#EFECE5]">
          <button
            type="button"
            onClick={() => toggleStep(3)}
            className="flex items-center gap-2 text-left cursor-pointer flex-1 min-w-0"
          >
            <span className="w-5 h-5 rounded-md bg-[#141413] text-[#FAF9F6] text-[10px] font-bold flex items-center justify-center shrink-0">
              3
            </span>
            <span className="text-xs font-bold text-[#141413]">Kapak &amp; Aydınlatma</span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-[#78716C] ml-auto transition-transform ${
                collapsedSteps[3] ? "-rotate-90" : ""
              }`}
            />
          </button>

          <button
            type="button"
            onClick={() => onToggleLed(!ledOn)}
            className={`h-6 px-2.5 rounded-md text-[10px] font-semibold inline-flex items-center gap-1 border transition cursor-pointer ${
              ledOn
                ? "bg-[#FDF8EE] text-[#78531E] border-[#E6D2AE]"
                : "bg-white text-[#57534E] border-[#DED8CC] hover:bg-[#EFECE5]"
            }`}
          >
            <Lightbulb className="w-3 h-3" />
            <span>{ledOn ? "3000K LED Açık" : "İç LED Ekle"}</span>
          </button>
        </div>

        {!collapsedSteps[3] && (
          <div className="p-3">
            <div className="grid grid-cols-4 gap-1.5">
              {[
                {
                  id: "single_left" as const,
                  label: "Sol Kapak",
                  active: activeBay?.door?.type === "single_left",
                  svg: (
                    <svg viewBox="0 0 24 28" className="w-5 h-6">
                      <rect x="3" y="2" width="18" height="24" rx="1" fill="none" stroke="currentColor" strokeWidth="1.4" />
                      <polyline points="3,4 19,14 3,24" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 1.5" />
                      <line x1="18" y1="11" x2="18" y2="17" stroke="currentColor" strokeWidth="1.6" />
                    </svg>
                  ),
                },
                {
                  id: "single_right" as const,
                  label: "Sağ Kapak",
                  active: activeBay?.door?.type === "single_right",
                  svg: (
                    <svg viewBox="0 0 24 28" className="w-5 h-6">
                      <rect x="3" y="2" width="18" height="24" rx="1" fill="none" stroke="currentColor" strokeWidth="1.4" />
                      <polyline points="21,4 5,14 21,24" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 1.5" />
                      <line x1="6" y1="11" x2="6" y2="17" stroke="currentColor" strokeWidth="1.6" />
                    </svg>
                  ),
                },
                {
                  id: "double" as const,
                  label: "Çift Kapak",
                  active: activeBay?.door?.type === "double",
                  svg: (
                    <svg viewBox="0 0 24 28" className="w-5 h-6">
                      <rect x="2" y="2" width="20" height="24" rx="1" fill="none" stroke="currentColor" strokeWidth="1.4" />
                      <line x1="12" y1="2" x2="12" y2="26" stroke="currentColor" strokeWidth="1.2" />
                      <line x1="10" y1="11" x2="10" y2="17" stroke="currentColor" strokeWidth="1.4" />
                      <line x1="14" y1="11" x2="14" y2="17" stroke="currentColor" strokeWidth="1.4" />
                    </svg>
                  ),
                },
                {
                  id: "open" as const,
                  label: "Kapaksız",
                  active: activeBay?.door?.type === "open" || Boolean(activeModule.isOpenFront),
                  svg: (
                    <svg viewBox="0 0 24 28" className="w-5 h-6">
                      <rect x="3" y="2" width="18" height="24" rx="1" fill="none" stroke="currentColor" strokeWidth="1.4" />
                      <line x1="4" y1="9" x2="20" y2="9" stroke="currentColor" strokeWidth="1.2" />
                      <line x1="4" y1="17" x2="20" y2="17" stroke="currentColor" strokeWidth="1.2" />
                    </svg>
                  ),
                },
              ].map((dBtn) => (
                <button
                  key={dBtn.id}
                  type="button"
                  onClick={() => onSetBayDoorType(activeBayIndex, dBtn.id)}
                  className={`py-2 px-1 rounded-lg border flex flex-col items-center gap-1 text-[10px] font-semibold transition cursor-pointer ${
                    dBtn.active
                      ? "bg-[#141413] text-white border-[#141413]"
                      : "bg-[#FAF9F6] hover:bg-[#EFECE5] text-[#44403C] border-[#DED8CC]"
                  }`}
                >
                  {dBtn.svg}
                  <span>{dBtn.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 4. BİRİM MALZEME & DOKU KARTELASI */}
      <section className="rounded-xl bg-white border border-[#DED8CC] overflow-hidden">
        <div className="px-3 py-2.5 flex items-center justify-between gap-2 bg-[#FAF9F6]/70 border-b border-[#EFECE5]">
          <button
            type="button"
            onClick={() => toggleStep(4)}
            className="flex items-center gap-2 text-left cursor-pointer flex-1 min-w-0"
          >
            <span className="w-5 h-5 rounded-md bg-[#141413] text-[#FAF9F6] text-[10px] font-bold flex items-center justify-center shrink-0">
              4
            </span>
            <span className="text-xs font-bold text-[#141413]">Doku &amp; Malzeme</span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-[#78716C] ml-auto transition-transform ${
                collapsedSteps[4] ? "-rotate-90" : ""
              }`}
            />
          </button>

          <div className="inline-flex rounded-md bg-[#EFECE5] p-0.5 text-[10px] font-bold border border-[#DED8CC]">
            <button
              type="button"
              onClick={() => setMatTarget("door")}
              className={`px-2 py-0.5 rounded-xs cursor-pointer transition ${
                matTarget === "door" ? "bg-[#141413] text-white" : "text-[#57534E]"
              }`}
            >
              Kapak
            </button>
            <button
              type="button"
              onClick={() => setMatTarget("body")}
              className={`px-2 py-0.5 rounded-xs cursor-pointer transition ${
                matTarget === "body" ? "bg-[#141413] text-white" : "text-[#57534E]"
              }`}
            >
              Gövde
            </button>
          </div>
        </div>

        {!collapsedSteps[4] && (
          <div className="p-3 grid grid-cols-2 gap-1.5">
            {curatedSwatches.map((mat) => {
              const currentId =
                matTarget === "door"
                  ? activeModule.carcass.doorMaterialId
                  : activeModule.carcass.bodyMaterialId;
              const selected = currentId === mat.id;
              const shortLabel = cleanMaterialDisplayName(mat.name);
              const isLight =
                mat.colorHex.toLowerCase() === "#ffffff" ||
                mat.colorHex.toLowerCase() === "#f3f4f6" ||
                mat.colorHex.toLowerCase() === "#f8fafc" ||
                mat.colorHex.toLowerCase() === "#ede8d0";

              return (
                <button
                  key={mat.id}
                  type="button"
                  title={mat.name}
                  onClick={() =>
                    matTarget === "door"
                      ? onSetMaterials(activeModule.carcass.bodyMaterialId, mat.id)
                      : onSetMaterials(mat.id, activeModule.carcass.doorMaterialId)
                  }
                  className={`p-2 rounded-lg border flex items-center gap-2 text-left transition cursor-pointer ${
                    selected
                      ? "bg-[#FAF9F6] border-[#141413] ring-1 ring-[#141413]"
                      : "bg-white hover:bg-[#FAF9F6] border-[#DED8CC]"
                  }`}
                >
                  <span
                    className="w-7 h-7 rounded-md border border-[#D6D0C4] shrink-0 flex items-center justify-center relative overflow-hidden"
                    style={{ backgroundColor: mat.colorHex }}
                  >
                    {(mat.category === "wood" || (mat.category === "laminate" && mat.hasGrain)) && (
                      <svg
                        viewBox="0 0 28 28"
                        className="absolute inset-0 w-full h-full opacity-25 pointer-events-none"
                      >
                        <path
                          d="M6 0 Q9 14 6 28 M14 0 Q18 14 14 28 M22 0 Q19 14 22 28"
                          fill="none"
                          stroke="#2C1810"
                          strokeWidth="1.1"
                        />
                      </svg>
                    )}
                    {selected && (
                      <Check
                        className={`w-3.5 h-3.5 relative z-10 ${
                          isLight ? "text-[#141413]" : "text-white"
                        }`}
                      />
                    )}
                  </span>
                  <span className="text-[11px] font-semibold text-[#141413] truncate">
                    {shortLabel}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Progressive Disclosure Bridge for Architects & CNC Engineers */}
      <div className="px-3 py-2.5 rounded-xl bg-[#FAF9F6] border border-[#DED8CC] flex items-center justify-between gap-2">
        <span className="text-[11px] text-[#57534E]">
          Kesit, kulp, priz kesimi veya CNC ayarları:
        </span>
        <button
          type="button"
          onClick={() => onSwitchTier("architect")}
          className="text-[11px] font-bold text-[#141413] hover:text-[#8C7A6B] inline-flex items-center gap-1 cursor-pointer shrink-0"
        >
          <span>Mimar Modu</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
