"use client";

import { getMaterialSwatchStyle } from "../../materials/pbrMaterialSystem";

import React, { useState, useEffect } from "react";
import type {
  BayConfig,
  DoorCrossSectionProfile,
  HandleCategory,
  MaterialDefinition,
  ModuleInstance,
  PlinthConstructionType,
  SlidingMountingType,
} from "@birim/core";
import { type UserExperienceTier } from "../../../store/useConfiguratorStore";
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
  ArrowLeft,
} from "lucide-react";

export interface LedConfigOptions {
  ledType?: "led_profile" | "led_vertical_strip" | "led_rod_strip" | "full_showcase";
  colorTempK?: 2700 | 3000 | 4000;
  sensorType?: "ir_door" | "pir_motion" | "manual_switch";
  dimmerPct?: number;
  frontSetbackMm?: number;
  shelfSetbackMm?: number;
  alignShelfAndSide?: boolean;
  channelWidthMm?: number;
  channelDepthMm?: number;
}

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
  onUpdatePlinthConfig?: (patch: {
    plinthHeight?: number;
    plinthConstruction?: PlinthConstructionType;
    plinthSetbackMm?: number;
    hasAdjustableLegs?: boolean;
    topPanelThicknessMm?: number;
    crownMolding?: import("@birim/core").CrownMoldingConfig;
  }) => void;
  onToggleDoorOpen: () => void;
  onSetBayDoorType: (
    bayIdx: number,
    type: "single_left" | "single_right" | "double" | "sliding" | "open"
  ) => void;
  onSetSlidingMountingType?: (mountingType: SlidingMountingType) => void;
  onSetBayV4DoorConfig?: (
    bayIdx: number,
    patch: {
      crossSectionProfile?: DoorCrossSectionProfile;
      isGlassFramed?: boolean;
      handleCategory?: HandleCategory;
      handleProfileId?: string;
      handleMaterialId?: string;
    }
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
  onToggleLed: (enabled: boolean, options?: LedConfigOptions) => void;
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

const DimensionField: React.FC<{
  label: string;
  valueMm: number;
  minMm: number;
  maxMm: number;
  stepMm?: number;
  unit: "cm" | "mm";
  onCommitMm: (nextMm: number) => void;
}> = ({ label, valueMm, minMm, maxMm, stepMm = 50, unit, onCommitMm }) => {
  const displayVal = unit === "cm" ? Math.round(valueMm / 10) : Math.round(valueMm);
  const [draft, setDraft] = useState<string>(String(displayVal));

  useEffect(() => {
    setDraft(String(unit === "cm" ? Math.round(valueMm / 10) : Math.round(valueMm)));
  }, [valueMm, unit]);

  const commit = () => {
    const parsed = Number(draft.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setDraft(String(displayVal));
      return;
    }
    const rawMm = unit === "cm" ? Math.round(parsed * 10) : Math.round(parsed);
    const clamped = Math.max(minMm, Math.min(maxMm, rawMm));
    onCommitMm(clamped);
    setDraft(String(unit === "cm" ? Math.round(clamped / 10) : clamped));
  };

  return (
    <div className="p-2.5 rounded-2xl bg-white/52 backdrop-blur-md border border-white/75 shadow-2xs flex items-center justify-between gap-2">
      <div>
        <span className="text-xs font-bold text-[#141413] block">{label}</span>
        <span className="text-[10px] text-[#78716C]">
          {unit === "cm"
            ? `${Math.round(minMm / 10)}–${Math.round(maxMm / 10)} cm`
            : `${minMm}–${maxMm} mm`}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onCommitMm(Math.max(minMm, valueMm - stepMm))}
          className="w-8 h-8 rounded-lg bg-white hover:bg-[#EFECE5] border border-[#DED8CC] text-sm font-bold text-[#141413] flex items-center justify-center transition cursor-pointer"
          title="Azalt"
        >
          −
        </button>
        <div className="relative flex items-center">
          <input
            type="text"
            inputMode="numeric"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              }
            }}
            className="w-20 h-8 pr-7 pl-2 rounded-lg bg-white border border-[#CFC8BA] focus:border-[#141413] focus:outline-none text-center font-mono text-sm font-bold text-[#141413]"
          />
          <span className="absolute right-2 text-[10px] font-mono text-[#78716C] pointer-events-none">
            {unit}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onCommitMm(Math.min(maxMm, valueMm + stepMm))}
          className="w-8 h-8 rounded-lg bg-white hover:bg-[#EFECE5] border border-[#DED8CC] text-sm font-bold text-[#141413] flex items-center justify-center transition cursor-pointer"
          title="Artır"
        >
          +
        </button>
      </div>
    </div>
  );
};

type CustomerStepId = "dimensions" | "interior" | "door" | "led" | "material";

const STEP_ORDER: { id: CustomerStepId; shortLabel: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "dimensions", shortLabel: "Ölçü", Icon: Ruler },
  { id: "interior", shortLabel: "Bölme", Icon: Columns },
  { id: "door", shortLabel: "Kapak", Icon: DoorOpen },
  { id: "led", shortLabel: "LED Işık", Icon: Lightbulb },
  { id: "material", shortLabel: "Renk", Icon: Palette },
];

export const SimpleCustomerInspector: React.FC<SimpleCustomerInspectorProps> = React.memo(({
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
  onUpdatePlinthConfig,
  onToggleDoorOpen,
  onSetBayDoorType,
  onSetSlidingMountingType,
  onSetBayV4DoorConfig,
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
  const [activeStep, setActiveStep] = useState<CustomerStepId>("interior");
  const [showAllSteps, setShowAllSteps] = useState<boolean>(false);
  const [unit, setUnit] = useState<"cm" | "mm">("cm");
  const [matTarget, setMatTarget] = useState<"door" | "body">("door");
  const [tapModeEnabled, setTapModeEnabled] = useState<boolean>(false);

  // Sync active right-panel step automatically with 3D viewport clicks!
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onSelectBay = () => setActiveStep("interior");
    const onSelectDoor = () => setActiveStep("door");
    const onSelectMat = () => setActiveStep("material");
    window.addEventListener("birim:select-bay-3d", onSelectBay);
    window.addEventListener("birim:select-door-3d", onSelectDoor);
    window.addEventListener("birim:select-material-part-3d", onSelectMat);
    return () => {
      window.removeEventListener("birim:select-bay-3d", onSelectBay);
      window.removeEventListener("birim:select-door-3d", onSelectDoor);
      window.removeEventListener("birim:select-material-part-3d", onSelectMat);
    };
  }, []);

  const { width, height, depth } = activeModule.dimensions;

  const hasAnyLedFitting = activeModule.bays.some((b) =>
    (b.specialFittings || []).some((f) => f.type.startsWith("led_"))
  );
  const ledOn = Boolean(activeModule.carcass.ledLightingEnabled || hasAnyLedFitting);
  const curLedTempK: 2700 | 3000 | 4000 = activeModule.carcass.ledColorTempK || 3000;
  const curLedSensor = activeModule.carcass.ledSensorType || "ir_door";
  const curLedDimmer = activeModule.carcass.ledDimmerPct ?? 100;
  const panelThickMm = activeModule.carcass.panelThickness || 18;
  const maxSafeLedSetback = Math.max(60, depth - 45);
  const curLedAlign = activeModule.carcass.ledAlignShelfAndSide !== false;
  const curLedFrontSetback = Math.max(
    35,
    Math.min(maxSafeLedSetback, activeModule.carcass.ledFrontSetbackMm ?? 75)
  );
  const curLedShelfSetback = curLedAlign
    ? curLedFrontSetback
    : Math.max(
        35,
        Math.min(maxSafeLedSetback, activeModule.carcass.ledShelfSetbackMm ?? curLedFrontSetback)
      );
  const curLedChanW = Math.max(6, Math.min(32, activeModule.carcass.ledChannelWidthMm ?? 12));
  const maxSafeChanDepth = Math.max(5, panelThickMm - 4);
  const curLedChanD = Math.max(
    4,
    Math.min(maxSafeChanDepth, activeModule.carcass.ledChannelDepthMm ?? 8)
  );
  const remainingWallMm = Math.max(3, panelThickMm - curLedChanD);
  const hasHingedDoorInMod = activeModule.bays.some((b) => {
    const dt = b.door?.type || "open";
    const ds = b.door?.doorSystemId || "";
    return (
      dt === "single_left" ||
      dt === "single_right" ||
      dt === "double" ||
      ds.startsWith("hinged")
    );
  });
  const isSlidingModule = activeModule.bays.some((b) => {
    const dt = b.door?.type || "open";
    const ds = b.door?.doorSystemId || "";
    return dt === "sliding" || dt === "sliding_bottom" || ds.startsWith("sliding");
  });
  const hasInsetSlidingInMod =
    isSlidingModule &&
    activeModule.bays.some(
      (b) =>
        b.door?.slidingMountingType === "inset_inside" ||
        b.door?.doorSystemId === "sliding_bottom_rolling" ||
        b.door?.type === "sliding_bottom"
    );

  const detectedLedType: "led_profile" | "led_vertical_strip" | "led_rod_strip" | "full_showcase" = (() => {
    const mode = activeModule.carcass.ledPlacementMode;
    if (mode === "full_showcase") return "full_showcase";
    if (mode === "vertical_sides") return "led_vertical_strip";
    if (mode === "hanging_rod") return "led_rod_strip";
    if (mode === "shelf_underside") return "led_profile";
    const fits = activeModule.bays.flatMap((b) => b.specialFittings || []);
    const hasHoriz = fits.some((f) => f.type === "led_profile");
    const hasVert = fits.some((f) => f.type === "led_vertical_strip");
    if (hasHoriz && hasVert) return "full_showcase";
    if (hasVert) return "led_vertical_strip";
    if (fits.some((f) => f.type === "led_rod_strip")) return "led_rod_strip";
    return "led_profile";
  })();

  const curatedSwatches = materials.filter((m) => m.id !== "mat_led_warm_3000k").slice(0, 12);

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
  const activeDoorHex = activeDoorMat?.colorHex || "#C8A982";
  const activeBodyMat = materials.find((m) => m.id === activeModule.carcass.bodyMaterialId);
  const activeBodyHex = activeBodyMat?.colorHex || "#F5F3EE";

  const curDoorProf =
    activeBay?.door?.crossSectionProfile ||
    activeModule.carcass.crossSectionProfile ||
    "flat_slab";
  const curHandleSku = activeBay?.door?.handleProfileId || "K019";

  const stepIndex = STEP_ORDER.findIndex((s) => s.id === activeStep);

  return (
    <div data-testid="blum-clean-inspector-card" className="space-y-3.5 pb-4">
      {/* 1. INTERACTIVE VISUAL CABINET SUMMARY CARD + QUICK INTERIOR VIEW BUTTON */}
      <div className="p-3.5 rounded-[24px] birim-ice-card flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <svg viewBox="0 0 88 64" className="w-16 h-12 shrink-0 select-none">
            {(() => {
              const drawW = Math.max(40, Math.min(78, Math.round((width / 2600) * 76)));
              const drawH = Math.max(34, Math.min(54, Math.round((height / 2600) * 52)));
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
                      <g
                        key={b.index}
                        onClick={() => onSelectBay(idx)}
                        className="cursor-pointer"
                      >
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
                                stroke={curLedTempK === 4000 ? "#FDE68A" : "#F59E0B"}
                                strokeWidth="2.2"
                              />
                            )}
                            {(b.hangingRails || []).map((r, rI) => (
                              <line
                                key={r.id || rI}
                                x1={bx + 2}
                                y1={sy + 8 + rI * 14}
                                x2={bx + unitW - 2}
                                y2={sy + 8 + rI * 14}
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
                                <g key={sh.id || sI}>
                                  <line
                                    x1={bx + 1.5}
                                    y1={sy + drawH * ratio}
                                    x2={bx + unitW - 1.5}
                                    y2={sy + drawH * ratio}
                                    stroke="#8C7A6B"
                                    strokeWidth="1.1"
                                  />
                                  {ledOn &&
                                    (detectedLedType === "led_profile" ||
                                      detectedLedType === "full_showcase") && (
                                      <line
                                        x1={bx + 2}
                                        y1={sy + drawH * ratio + 1.4}
                                        x2={bx + unitW - 2}
                                        y2={sy + drawH * ratio + 1.4}
                                        stroke="#F59E0B"
                                        strokeWidth="1.3"
                                      />
                                    )}
                                </g>
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
                            strokeWidth="1.5"
                          />
                        )}
                      </g>
                    );
                  })}
                </g>
              );
            })()}
          </svg>

          <div className="min-w-0">
            <div className="text-xs font-bold text-[#141413]">
              {Math.round(width / 10)} × {Math.round(height / 10)} × {Math.round(depth / 10)} cm
            </div>
            <div className="text-[11px] text-[#57534E] mt-0.5">
              {activeModule.bays.length} Bölme • Seçili: {activeBayIndex + 1}. Bölme
            </div>
            <div className="text-[10px] text-[#78716C] mt-0.5">
              {ledOn ? `LED Açık (${curLedTempK}K)` : "LED Kapalı"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          data-testid="simple-toggle-interior-props-btn"
          onClick={() => {
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("birim:toggle-interior-props"));
            }
          }}
          data-tooltip="İç Eşyaları (Giysi, Kutu, Ayakkabı) Göster / Gizle"
          className="shrink-0 w-9 h-9 rounded-xl inline-flex items-center justify-center birim-ice-btn text-[#141413] transition cursor-pointer"
        >
          <span className="text-sm leading-none">👔</span>
          <span className="sr-only">İç Eşyalar</span>
        </button>
        <button
          type="button"
          onClick={onToggleDoorOpen}
          title={doorOpenAngleDeg > 0 ? "Kapakları Kapat" : "Dolap İçini Gör"}
          className={`shrink-0 w-9 h-9 rounded-xl inline-flex items-center justify-center transition cursor-pointer ${
            doorOpenAngleDeg > 0
              ? "birim-ice-btn-active"
              : "birim-ice-btn text-[#141413]"
          }`}
        >
          {doorOpenAngleDeg > 0 ? (
            <>
              <EyeOff className="w-4 h-4" />
              <span className="sr-only">Kapat</span>
            </>
          ) : (
            <>
              <Eye className="w-4 h-4" />
              <span className="sr-only">İçini Gör</span>
            </>
          )}
        </button>
        </div>
      </div>

      {/* 2. SPACIOUS 5-STEP SEGMENTED NAVIGATION BAR (Eliminates Cramped Endless Scrolling!) */}
      <div className="space-y-1.5">
        <div className="p-1.5 rounded-[24px] birim-ice-card grid grid-cols-5 gap-1.5">
          {STEP_ORDER.map((step) => {
            const IconComp = step.Icon;
            const isAct = !showAllSteps && activeStep === step.id;
            const hasLedDot = step.id === "led" && ledOn;
            return (
              <button
                key={step.id}
                type="button"
                title={step.shortLabel}
                data-testid={`customer-step-tab-${step.id}`}
                onClick={() => {
                  setShowAllSteps(false);
                  setActiveStep(step.id);
                  if ((step.id === "interior" || step.id === "led") && hasHingedDoorInMod && doorOpenAngleDeg < 15) {
                    onToggleDoorOpen();
                  } else if ((step.id === "door" || step.id === "material") && hasHingedDoorInMod && doorOpenAngleDeg > 35) {
                    onToggleDoorOpen();
                  }
                }}
                className={`h-11 px-1 rounded-[18px] flex flex-col items-center justify-center gap-0.5 transition cursor-pointer relative ${
                  isAct
                    ? "birim-ice-charcoal-pill font-bold"
                    : "text-[#44403C] hover:text-[#141413] hover:bg-white/70 font-medium"
                }`}
              >
                {hasLedDot && (
                  <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-amber-200/60" />
                )}
                <IconComp className="w-4 h-4 shrink-0" />
                {isAct ? (
                  <span className="text-[9px] leading-none tracking-tight">{step.shortLabel}</span>
                ) : (
                  <span className="sr-only">{step.shortLabel}</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] text-[#78716C] font-medium">
            {showAllSteps
              ? "Tüm ayarlar tek listede açık"
              : `Adım ${stepIndex + 1} / 5 — ${
                  activeStep === "dimensions"
                    ? "Dolap Dış Ölçüleri"
                    : activeStep === "interior"
                    ? "Bölmeler ve İç Düzen"
                    : activeStep === "door"
                    ? "Kapak, Sürgü Mekanizması ve Kulp"
                    : activeStep === "led"
                    ? "Mimari İç LED Aydınlatma"
                    : "Kapak ve Gövde Malzemesi"
                }`}
          </span>
          <button
            type="button"
            onClick={() => setShowAllSteps((v) => !v)}
            className="text-[11px] font-semibold text-[#57534E] hover:text-[#141413] underline underline-offset-2 cursor-pointer"
          >
            {showAllSteps ? "Sekmeli Görünüm" : "Tümünü Aç"}
          </button>
        </div>
      </div>

      {/* ========================================================================
          STEP 1: DOLAP DIŞ ÖLÇÜLERİ (Spacious Single-Column Stepper Inputs)
         ======================================================================== */}
      {(showAllSteps || activeStep === "dimensions") && (
        <section className="p-3.5 rounded-[24px] birim-ice-card space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#141413]">Dolap Dış Ölçüsü</span>
            <div className="inline-flex rounded-lg bg-[#EFECE5] p-0.5 border border-[#DED8CC]">
              {(["cm", "mm"] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUnit(u)}
                  className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold transition cursor-pointer ${
                    unit === u ? "bg-white text-[#141413] shadow-2xs" : "text-[#78716C]"
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <DimensionField
              label="Genişlik"
              valueMm={width}
              minMm={400}
              maxMm={3600}
              stepMm={100}
              unit={unit}
              onCommitMm={(nextW) => onSetDimensions(nextW, height, depth)}
            />
            <DimensionField
              label="Yükseklik"
              valueMm={height}
              minMm={600}
              maxMm={2800}
              stepMm={50}
              unit={unit}
              onCommitMm={(nextH) => onSetDimensions(width, nextH, depth)}
            />
            <DimensionField
              label="Derinlik"
              valueMm={depth}
              minMm={320}
              maxMm={800}
              stepMm={20}
              unit={unit}
              onCommitMm={(nextD) => onSetDimensions(width, height, nextD)}
            />
          </div>

          <div className="pt-1 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-[#78716C]">
              <span>Standart Genişlik Seçimi</span>
              <span className="font-mono font-bold text-[#141413]">{Math.round(width / 10)} cm</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {[900, 1200, 1600, 1800, 2000, 2400].map((presetW) => (
                <button
                  key={presetW}
                  type="button"
                  onClick={() => onSetDimensions(presetW, height, depth)}
                  className={`py-1.5 px-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                    Math.abs(width - presetW) <= 20
                      ? "bg-[#141413] text-white border-[#141413]"
                      : "bg-[#FAF9F6] hover:bg-[#EFECE5] text-[#44403C] border-[#DED8CC]"
                  }`}
                >
                  {presetW / 10} cm
                </button>
              ))}
            </div>
          </div>

          {/* World-Standard Plinth (Baza / Soket) System Selector */}
          {onUpdatePlinthConfig && (() => {
            const curPlinthH = activeModule.carcass.plinthHeight ?? 80;
            const isWardrobeCat =
              activeModule.category === "wardrobe" ||
              activeModule.category === "vestiyer" ||
              activeModule.category === "living" ||
              activeModule.category === "tall";
            const curPlinthType: PlinthConstructionType =
              activeModule.carcass.plinthConstruction ||
              (activeModule.carcass.hasAdjustableLegs === false
                ? isWardrobeCat
                  ? "gable_rails"
                  : "pedestal_box"
                : isWardrobeCat
                ? "pedestal_box"
                : "adjustable_legs_clip");
            const defaultSetback =
              curPlinthType === "adjustable_legs_clip"
                ? 55
                : curPlinthType === "pedestal_box"
                ? 35
                : 26;
            const curPlinthSetback = activeModule.carcass.plinthSetbackMm ?? defaultSetback;

            return (
              <div className="pt-2.5 border-t border-[#EFECE5] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-[#141413]">
                      Baza (Soket) Konstrüksiyonu
                    </div>
                    <div className="text-[10.5px] text-[#78716C]">
                      Dünya standartlarında taşıyıcı baza ve alt nem contası
                    </div>
                  </div>
                  <span className="font-mono text-xs font-bold text-[#141413]">
                    {curPlinthH === 0
                      ? "Bazasız"
                      : unit === "cm"
                      ? `${Math.round(curPlinthH / 10)} cm`
                      : `${curPlinthH} mm`}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    {
                      id: "pedestal_box" as const,
                      title: "Kutu Baza Kasası",
                      sub: "4 kenar kapalı + ara kayıt + fitil (Gardırop)",
                      defSetback: 35,
                    },
                    {
                      id: "adjustable_legs_clip" as const,
                      title: "Klipsli Ayaklı Baza",
                      sub: "Axilo ayak + C-klips + su contası (DIN 68935)",
                      defSetback: 55,
                    },
                    {
                      id: "gable_rails" as const,
                      title: "Yan Dikme İnişli Kayıtlı",
                      sub: "Zemine inen yanlar + ön/arka çift kayıt",
                      defSetback: 26,
                    },
                    {
                      id: "none" as const,
                      title: "Bazasız (0 cm)",
                      sub: "Zemine sıfır veya duvara askılı",
                      defSetback: 0,
                    },
                  ].map((pOpt) => {
                    const isAct =
                      pOpt.id === "none"
                        ? curPlinthH === 0
                        : curPlinthH > 0 && curPlinthType === pOpt.id;
                    return (
                      <button
                        key={pOpt.id}
                        type="button"
                        data-testid={`simple-plinth-type-${pOpt.id}`}
                        onClick={() => {
                          if (pOpt.id === "none") {
                            onUpdatePlinthConfig({ plinthHeight: 0, hasAdjustableLegs: false });
                          } else {
                            onUpdatePlinthConfig({
                              plinthHeight: curPlinthH > 0 ? curPlinthH : 80,
                              plinthConstruction: pOpt.id,
                              plinthSetbackMm: pOpt.defSetback,
                              hasAdjustableLegs: pOpt.id !== "gable_rails",
                            });
                          }
                        }}
                        className={`p-2 rounded-xl border text-left transition cursor-pointer ${
                          isAct
                            ? "bg-[#141413] text-white border-[#141413]"
                            : "bg-[#FAF9F6] hover:bg-[#EFECE5] text-[#141413] border-[#DED8CC]"
                        }`}
                      >
                        <div className="text-[11.5px] font-bold leading-tight">{pOpt.title}</div>
                        <div
                          className={`text-[10px] mt-0.5 leading-snug ${
                            isAct ? "text-[#E6D2AE]" : "text-[#78716C]"
                          }`}
                        >
                          {pOpt.sub}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {curPlinthH > 0 && (
                  <div className="p-2.5 rounded-xl bg-[#FAF9F6] border border-[#DED8CC] space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-[#44403C]">Baza Yüksekliği</span>
                      <span className="font-mono font-bold text-[#141413]">{curPlinthH} mm</span>
                    </div>
                    <div className="grid grid-cols-5 gap-1">
                      {[60, 80, 100, 120, 150].map((ph) => (
                        <button
                          key={ph}
                          type="button"
                          onClick={() => onUpdatePlinthConfig({ plinthHeight: ph })}
                          className={`py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                            curPlinthH === ph
                              ? "bg-[#141413] text-white border-[#141413]"
                              : "bg-white hover:bg-[#EFECE5] text-[#44403C] border-[#DED8CC]"
                          }`}
                        >
                          {unit === "cm" ? `${ph / 10}cm` : `${ph}`}
                        </button>
                      ))}
                    </div>

                    <div className="pt-1 space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-[#44403C]">
                          Ön Girinti (Ayak Boşluğu)
                        </span>
                        <span className="font-mono font-bold text-[#141413]">
                          {curPlinthSetback} mm
                        </span>
                      </div>
                      <input
                        type="range"
                        data-testid="simple-plinth-setback-slider"
                        min={15}
                        max={85}
                        step={1}
                        value={Math.min(85, Math.max(15, curPlinthSetback))}
                        onChange={(e) =>
                          onUpdatePlinthConfig({ plinthSetbackMm: Number(e.target.value) })
                        }
                        className="w-full accent-[#141413] h-1.5 bg-[#DED8CC] rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {onUpdatePlinthConfig && (
            <div className="pt-2 border-t border-[#EFECE5] space-y-2.5">
              {/* Bağımsız Üst Tabla Kalınlığı (TV Bench / Konsol / Dolap) */}
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-[#141413] block">
                  Üst Tabla Kalınlığı (TV Bench / Özel Üst)
                </span>
                <div className="grid grid-cols-5 gap-1">
                  {[
                    { val: undefined, label: `${panelThickMm}mm` },
                    { val: 25, label: "25mm" },
                    { val: 30, label: "30mm" },
                    { val: 36, label: "36mm" },
                    { val: 40, label: "40mm" },
                  ].map((opt) => {
                    const isAct =
                      opt.val === undefined
                        ? !activeModule.carcass.topPanelThicknessMm
                        : activeModule.carcass.topPanelThicknessMm === opt.val;
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => onUpdatePlinthConfig({ topPanelThicknessMm: opt.val })}
                        className={`py-1.5 rounded-xl font-mono text-[11px] font-bold border transition cursor-pointer ${
                          isAct
                            ? "bg-[#141413] text-white border-[#141413]"
                            : "bg-[#FAF9F6] hover:bg-[#EFECE5] text-[#141413] border-[#DED8CC]"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Üst Taç Profili */}
              <div className="p-2.5 rounded-xl bg-[#FAF9F6] border border-[#DED8CC] space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#141413]">
                    👑 Üst Taç Profili (45° Gönyeli)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const cur = activeModule.carcass.crownMolding;
                      onUpdatePlinthConfig({
                        crownMolding: cur?.enabled
                          ? { ...cur, enabled: false }
                          : {
                              enabled: true,
                              style: cur?.style || "modern_flat",
                              heightMm: cur?.heightMm || 60,
                              projectionMm: cur?.projectionMm ?? 25,
                            },
                      });
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                      activeModule.carcass.crownMolding?.enabled
                        ? "bg-[#141413] text-white border-[#141413]"
                        : "bg-white text-[#57534E] border-[#DED8CC] hover:bg-[#EFECE5]"
                    }`}
                  >
                    {activeModule.carcass.crownMolding?.enabled ? "Aktif ✓" : "Kapalı"}
                  </button>
                </div>
                {activeModule.carcass.crownMolding?.enabled && (
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-2 gap-1">
                      {[
                        { id: "modern_flat" as const, label: "Modern Düz" },
                        { id: "stepped" as const, label: "Basamaklı" },
                        { id: "classic_coving" as const, label: "Klasik Kavisli" },
                        { id: "led_channel" as const, label: "LED Kanallı" },
                      ].map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() =>
                            onUpdatePlinthConfig({
                              crownMolding: {
                                ...activeModule.carcass.crownMolding!,
                                style: st.id,
                              },
                            })
                          }
                          className={`py-1 px-2 rounded-lg text-[10.5px] font-bold border cursor-pointer transition ${
                            activeModule.carcass.crownMolding?.style === st.id
                              ? "bg-[#141413] text-white border-[#141413]"
                              : "bg-white border-[#DED8CC] text-[#44403C]"
                          }`}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      {[40, 60, 80, 120].map((ch) => (
                        <button
                          key={ch}
                          type="button"
                          onClick={() =>
                            onUpdatePlinthConfig({
                              crownMolding: {
                                ...activeModule.carcass.crownMolding!,
                                heightMm: ch,
                              },
                            })
                          }
                          className={`py-1 rounded-lg font-mono text-[10.5px] font-bold border cursor-pointer ${
                            activeModule.carcass.crownMolding?.heightMm === ch
                              ? "bg-[#141413] text-white border-[#141413]"
                              : "bg-white border-[#DED8CC] text-[#44403C]"
                          }`}
                        >
                          {ch}mm
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ========================================================================
          STEP 2: BÖLMELER & İÇ DÜZEN (Spacious 2-Column Cards — Zero Squeezed Text!)
         ======================================================================== */}
      {(showAllSteps || activeStep === "interior") && (
        <section className="p-3.5 rounded-[24px] birim-ice-card space-y-3.5">
          {/* Compartment Selector Pills */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#141413]">
                Bölme Seçimi ({activeModule.bays.length} Bölme)
              </span>
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
                className="px-3.5 py-1.5 rounded-full birim-ice-charcoal-pill text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                title="Seçili bölmeyi ortadan ikiye böler"
              >
                + Bölme Ekle
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {activeModule.bays.map((b, idx) => {
                const isAct = idx === activeBayIndex;
                const bw = bayWidths[idx] || 0;
                return (
                  <button
                    key={b.index}
                    type="button"
                    onClick={() => onSelectBay(idx)}
                    className={`py-2.5 px-3.5 rounded-2xl border flex items-center justify-between transition cursor-pointer ${
                      isAct
                        ? "birim-ice-charcoal-pill"
                        : "birim-ice-btn text-[#141413]"
                    }`}
                  >
                    <span className="text-xs font-bold">{idx + 1}. Bölme</span>
                    <span
                      className={`text-xs font-mono ${
                        isAct ? "text-[#D6C7B2]" : "text-[#78716C]"
                      }`}
                    >
                      {unit === "cm" ? `${Math.round(bw / 10)} cm` : `${bw} mm`}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Distinct Merge vs Shrink-Delete Bar */}
            {(activeModule.bays.length > 1 ||
              (activeBay?.door?.type === "double" && (bayWidths[activeBayIndex] || 0) >= 760)) && (
              <div className="grid grid-cols-1 gap-1.5 pt-1">
                {activeModule.bays.length > 1 && (
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      data-testid="simple-merge-selected-bay-btn"
                      onClick={() => onMergeBay(activeBayIndex)}
                      className="py-2 px-2.5 rounded-xl bg-[#FAF9F6] hover:bg-[#EFECE5] border border-[#DED8CC] text-xs font-semibold text-[#44403C] transition cursor-pointer text-center"
                      title="Ara dikmeyi kaldırır, dış genişlik sabit kalır"
                    >
                      Yanla Birleştir
                    </button>
                    {onRemoveBayAndShrink && (
                      <button
                        type="button"
                        data-testid="simple-delete-shrink-bay-btn"
                        onClick={() => onRemoveBayAndShrink(activeBayIndex)}
                        className="py-2 px-2.5 rounded-xl bg-[#FAF9F6] hover:bg-red-50 border border-[#DED8CC] hover:border-red-200 text-xs font-semibold text-red-700 transition cursor-pointer text-center"
                        title="Bu bölmeyi çıkarır ve dolabı daraltır"
                      >
                        {activeBayIndex + 1}. Bölmeyi Sil
                      </button>
                    )}
                  </div>
                )}
                {activeBay?.door?.type === "double" &&
                  (bayWidths[activeBayIndex] || 0) >= 760 &&
                  onShrinkDoubleBay && (
                    <button
                      type="button"
                      data-testid="simple-shrink-double-bay-btn"
                      onClick={() => onShrinkDoubleBay(activeBayIndex)}
                      className="w-full py-2 px-3 rounded-xl bg-[#FAF9F6] hover:bg-[#EFECE5] border border-[#DED8CC] text-xs font-semibold text-[#141413] transition cursor-pointer"
                    >
                      Çift Kapağı Tek Kapağa Düşür (Dolabı Daralt)
                    </button>
                  )}
              </div>
            )}
          </div>

          {/* EN 14749 Live Span Deflection Engineering Alert + 1-Click Auto-Divider Support */}
          {(() => {
            const wideSpanWarnings = activeModule.bays
              .map((b, idx) => ({
                idx,
                bw: bayWidths[idx] || 0,
                hasLoad: (b.shelves?.length || 0) > 0 || (b.hangingRails?.length || 0) > 0,
              }))
              .filter((x) => x.bw > 980 && x.hasLoad);
            if (wideSpanWarnings.length === 0) return null;
            return (
              <div
                data-testid="simple-engineering-span-warning"
                className="p-3 rounded-2xl bg-amber-50/90 border border-amber-300/80 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11.5px] font-bold text-amber-950">
                    ⚠️ Mühendislik Uyarısı ({wideSpanWarnings.length})
                  </span>
                  <button
                    type="button"
                    data-testid="simple-auto-support-span-btn"
                    onClick={() => onSplitBay(wideSpanWarnings[0].idx)}
                    className="px-2.5 py-1 rounded-full bg-[#141413] hover:bg-stone-800 text-white text-[10.5px] font-bold cursor-pointer shrink-0"
                    title="Geniş açıklığa otomatik taşıyıcı ara dikme ekler"
                  >
                    ✦ Oto-Destek
                  </button>
                </div>
                {wideSpanWarnings.map((w) => (
                  <div
                    key={w.idx}
                    className="p-2 rounded-xl bg-white/80 border border-amber-200/70 text-[10.5px] text-stone-700 leading-snug"
                  >
                    <strong>{w.idx + 1}. Bölme ({w.bw} mm):</strong> EN 14749 standardına göre 980 mm üzeri açıklıklarda 18 mm raf ve askı borusu esneme yapar; 25 mm raf veya ara dikme önerilir.
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Spacious 2-Column Ready Interior Presets */}
          <div className="pt-2 border-t border-[#EFECE5] space-y-2">
            <div className="text-xs font-bold text-[#141413]">
              {activeBayIndex + 1}. Bölme İçin Hazır Düzen Şablonu
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  id: "rail_double" as const,
                  label: "Çift Askılı Düzen",
                  desc: "Üst ve alt gömlek askısı",
                },
                {
                  id: "shelves_4" as const,
                  label: "4 Raflı İstif",
                  desc: "Katlı kıyafet & kutular",
                },
                {
                  id: "rail_drawers_3" as const,
                  label: "Askı + 3 Çekmece",
                  desc: "Üst askı, alt çekmece",
                },
                {
                  id: "mixed_combo" as const,
                  label: "Tam Karma Düzen",
                  desc: "Raf, askı ve çekmece",
                },
              ].map((pr) => {
                const isActPreset = activePresetId === pr.id;
                return (
                  <button
                    key={pr.id}
                    type="button"
                    onClick={() => onApplyBayPreset(activeBayIndex, pr.id)}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      isActPreset
                        ? "bg-[#141413] text-white border-[#141413]"
                        : "bg-[#FAF9F6] hover:bg-[#EFECE5] text-[#141413] border-[#DED8CC]"
                    }`}
                  >
                    <div className="text-xs font-bold">{pr.label}</div>
                    <div
                      className={`text-[10.5px] mt-0.5 ${
                        isActPreset ? "text-[#D6C7B2]" : "text-[#78716C]"
                      }`}
                    >
                      {pr.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Spacious 2-Column Drag-or-Click Interior Accessories */}
          <div className="pt-2 border-t border-[#EFECE5] space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-[#141413]">Tek Tek İç Parça Ekle</span>
              {onArmTapToPlace && (
                <button
                  type="button"
                  data-testid="toggle-tap-to-place-mode-btn"
                  onClick={() => setTapModeEnabled((v) => !v)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition cursor-pointer ${
                    tapModeEnabled
                      ? "bg-[#141413] text-white border-[#141413]"
                      : "bg-[#FAF9F6] hover:bg-[#EFECE5] text-[#57534E] border-[#DED8CC]"
                  }`}
                >
                  {tapModeEnabled ? "Tıkla-Yerleştir: Açık" : "Tıkla-Yerleştir"}
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  id: "lib_shelf",
                  title: "Hareketli Raf",
                  visual: "shelf" as const,
                  count: activeBay?.shelves.length || 0,
                  onClick: () => onAddShelf(activeBayIndex),
                },
                {
                  id: "lib_drawer",
                  title: "Dış Çekmece",
                  visual: "drawer" as const,
                  count: activeBay?.drawers.filter((d) => !d.isInternal).length || 0,
                  onClick: () => onAddDrawer(activeBayIndex),
                },
                {
                  id: "lib_internal_drawer",
                  title: "İç Çekmece (Gizli)",
                  visual: "internal_drawer" as const,
                  count: activeBay?.drawers.filter((d) => d.isInternal).length || 0,
                  onClick: () => onAddInternalDrawer(activeBayIndex, 180),
                },
                {
                  id: "lib_rail",
                  title: "Elbise Askılığı",
                  visual: "rail" as const,
                  count: activeBay?.hangingRails.length || 0,
                  onClick: () => onAddHangingRail(activeBayIndex),
                },
                {
                  id: "lib_trouser_rack",
                  title: "Teleskopik Pantolonluk",
                  visual: "trouser_rack" as const,
                  count:
                    activeBay?.specialFittings?.filter((f) => f.type === "trouser_rack").length || 0,
                  onClick: () => onAddSpecialFitting(activeBayIndex, "trouser_rack"),
                },
                {
                  id: "lib_shoe_rack",
                  title: "Eğimli Ayakkabılık",
                  visual: "shoe_rack" as const,
                  count:
                    activeBay?.specialFittings?.filter((f) => f.type === "shoe_rack").length || 0,
                  onClick: () => onAddSpecialFitting(activeBayIndex, "shoe_rack"),
                },
                {
                  id: "lib_sub_divider",
                  title: "Raf Arası Dikme",
                  visual: "sub_divider" as const,
                  count: activeBay?.subDividers?.length || 0,
                  onClick: () => onAddSubDivider(activeBayIndex),
                },
                {
                  id: "lib_carcass_divider",
                  title: "Yeni Dikey Bölme",
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
                  className="p-2.5 rounded-xl bg-[#FAF9F6] hover:bg-[#EFECE5] border border-[#DED8CC] flex items-center gap-2.5 transition cursor-grab active:cursor-grabbing select-none relative"
                >
                  <div className="pointer-events-none shrink-0 w-9 h-9 rounded-lg bg-white border border-[#E5E0D5] flex items-center justify-center">
                    {renderInteriorIcon(tile.visual, "sm")}
                  </div>
                  <div className="pointer-events-none min-w-0 flex-1">
                    <div className="text-xs font-semibold text-[#141413] leading-snug">
                      {tile.title}
                    </div>
                    <div className="text-[10px] text-[#78716C]">
                      {tile.count > 0 ? `${tile.count} adet mevcut` : "+ Tıkla veya sürükle"}
                    </div>
                  </div>
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
              <div className="pt-2 border-t border-[#EFECE5] space-y-1.5">
                <div className="text-[11px] font-semibold text-[#78716C]">
                  {activeBayIndex + 1}. Bölmedeki Parçalar (Silmek için ×)
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {activeBay.shelves.map((sh, sIdx) => (
                    <span
                      key={sh.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FAF9F6] border border-[#DED8CC] text-xs font-medium text-[#141413]"
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
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FAF9F6] border border-[#DED8CC] text-xs font-medium text-[#141413]"
                    >
                      <span>Ara Bölme {sdIdx + 1}</span>
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
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FAF9F6] border border-[#DED8CC] text-xs font-medium text-[#141413]"
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
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FAF9F6] border border-[#DED8CC] text-xs font-medium text-[#141413]"
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
              </div>
            )}
        </section>
      )}

      {/* ========================================================================
          STEP 3: KAPAK SİSTEMİ, SÜRGÜ MONTAJ MEKANİZMALARI & KULP (Spacious 2-Col!)
         ======================================================================== */}
      {(showAllSteps || activeStep === "door") && (
        <section className="p-3.5 rounded-[24px] birim-ice-card space-y-3.5">
          <div className="space-y-2">
            <div className="text-xs font-bold text-[#141413]">
              Kapak Açılma Sistemi ({activeBayIndex + 1}. Bölme)
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  id: "single_left" as const,
                  label: "Sol Menteşeli",
                  sub: "Sola doğru açılır",
                  active: activeBay?.door?.type === "single_left",
                },
                {
                  id: "single_right" as const,
                  label: "Sağ Menteşeli",
                  sub: "Sağa doğru açılır",
                  active: activeBay?.door?.type === "single_right",
                },
                {
                  id: "double" as const,
                  label: "Çift Kapak",
                  sub: "İki yana açılan çift kanat",
                  active: activeBay?.door?.type === "double",
                },
                {
                  id: "sliding" as const,
                  label: "Sürgü Kapak Sistemi",
                  sub: "Raylı kayar kapak mekanizması",
                  active:
                    activeBay?.door?.type === "sliding" ||
                    activeBay?.door?.doorSystemId?.startsWith("sliding"),
                },
                {
                  id: "open" as const,
                  label: "Kapaksız (Açık Raf)",
                  sub: "Giyinme odası açık modül",
                  active: activeBay?.door?.type === "open" || Boolean(activeModule.isOpenFront),
                },
              ].map((dBtn) => (
                <button
                  key={dBtn.id}
                  type="button"
                  onClick={() => onSetBayDoorType(activeBayIndex, dBtn.id)}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                    dBtn.id === "open" ? "col-span-2" : ""
                  } ${
                    dBtn.active
                      ? "bg-[#141413] text-white border-[#141413]"
                      : "bg-[#FAF9F6] hover:bg-[#EFECE5] text-[#141413] border-[#DED8CC]"
                  }`}
                >
                  <div className="text-xs font-bold">{dBtn.label}</div>
                  <div
                    className={`text-[10.5px] mt-0.5 ${
                      dBtn.active ? "text-[#D6C7B2]" : "text-[#78716C]"
                    }`}
                  >
                    {dBtn.sub}
                  </div>
                </button>
              ))}
            </div>

            {activeBay?.door?.type !== "open" && !activeModule.isOpenFront && onSetBayV4DoorConfig && (
              <div className="p-3 rounded-xl bg-[#FAF9F6] border border-[#DED8CC] space-y-2 mt-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#141413]">
                    Kapak Dikey Bölgesi (Kısmi Kapak)
                  </span>
                  {(Boolean(activeBay?.door?.doorBottomGapMm) || Boolean(activeBay?.door?.doorTopGapMm)) && (
                    <button
                      type="button"
                      onClick={() =>
                        onSetBayV4DoorConfig(activeBayIndex, {
                          doorBottomGapMm: 0,
                          doorTopGapMm: 0,
                        })
                      }
                      className="text-[11px] font-semibold text-blue-700 hover:underline cursor-pointer"
                    >
                      Tam Boya Sıfırla
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {[
                    { id: "full", label: "Tam Boy", bot: 0, top: 0 },
                    { id: "top_open", label: "Üst Boş", bot: 0, top: Math.round((activeModule.dimensions.height - (activeModule.carcass.plinthHeight || 0)) * 0.32) },
                    { id: "mid_only", label: "Orta Kapak", bot: Math.round((activeModule.dimensions.height - (activeModule.carcass.plinthHeight || 0)) * 0.24), top: Math.round((activeModule.dimensions.height - (activeModule.carcass.plinthHeight || 0)) * 0.24) },
                    { id: "bot_open", label: "Alt Boş", bot: Math.round((activeModule.dimensions.height - (activeModule.carcass.plinthHeight || 0)) * 0.32), top: 0 },
                  ].map((zp) => {
                    const curBot = activeBay?.door?.doorBottomGapMm || 0;
                    const curTop = activeBay?.door?.doorTopGapMm || 0;
                    const isAct =
                      zp.id === "full"
                        ? curBot === 0 && curTop === 0
                        : zp.id === "top_open"
                        ? curBot === 0 && curTop > 0
                        : zp.id === "mid_only"
                        ? curBot > 0 && curTop > 0
                        : curBot > 0 && curTop === 0;
                    return (
                      <button
                        key={zp.id}
                        type="button"
                        onClick={() =>
                          onSetBayV4DoorConfig(activeBayIndex, {
                            doorBottomGapMm: zp.bot,
                            doorTopGapMm: zp.top,
                          })
                        }
                        className={`py-1.5 px-1 rounded-lg text-[10.5px] font-bold border cursor-pointer transition ${
                          isAct
                            ? "bg-[#141413] text-white border-[#141413]"
                            : "bg-white hover:bg-[#EFECE5] text-[#141413] border-[#DED8CC]"
                        }`}
                      >
                        {zp.label}
                      </button>
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block text-[10.5px] font-semibold text-[#57534E]">
                    Alttan Boşluk (mm)
                    <input
                      type="number"
                      min={0}
                      max={Math.max(0, activeModule.dimensions.height - 250)}
                      step={10}
                      value={activeBay?.door?.doorBottomGapMm || 0}
                      onChange={(e) =>
                        onSetBayV4DoorConfig(activeBayIndex, {
                          doorBottomGapMm: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      className="mt-1 w-full px-2 py-1 rounded-lg border border-[#DED8CC] bg-white font-mono text-xs text-[#141413]"
                    />
                  </label>
                  <label className="block text-[10.5px] font-semibold text-[#57534E]">
                    Üstten Boşluk (mm)
                    <input
                      type="number"
                      min={0}
                      max={Math.max(0, activeModule.dimensions.height - 250)}
                      step={10}
                      value={activeBay?.door?.doorTopGapMm || 0}
                      onChange={(e) =>
                        onSetBayV4DoorConfig(activeBayIndex, {
                          doorTopGapMm: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      className="mt-1 w-full px-2 py-1 rounded-lg border border-[#DED8CC] bg-white font-mono text-xs text-[#141413]"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* 4 REAL-WORLD SLIDING DOOR MOUNTING ARCHITECTURE CARDS */}
          {(activeBay?.door?.type === "sliding" ||
            activeBay?.door?.doorSystemId?.startsWith("sliding")) &&
            onSetSlidingMountingType && (
              <div className="p-3 rounded-xl bg-[#FAF9F6] border border-[#DED8CC] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#141413]">
                    Sürgü Montaj &amp; Mekanizma Tipi
                  </span>
                  <span className="text-[10px] font-mono text-[#78716C]">Hettich / Häfele</span>
                </div>
                <div className="space-y-1.5">
                  {(
                    [
                      {
                        id: "inset_inside" as const,
                        title: "1. İçten Çalışan (Gömme Çift Kanal Ray)",
                        sub: "Kapaklar yan dikmelerin ve üst/alt tablanın içinde kayar; dış karkas çerçevesi görünür (SlideLine M / Slido).",
                      },
                      {
                        id: "top_hung_exposed" as const,
                        title: "2. Üstten Askılı (Dıştan Açık Raylı)",
                        sub: "Üst tablanın üzerine monte edilen alüminyum taşıyıcı ray ve çelik askı arabalarıyla gövde önünde çalışır (TopLine XL).",
                      },
                      {
                        id: "top_hung_pelmet" as const,
                        title: "3. Üstten Askılı & Üstü Kapalı (Alın Valanslı)",
                        sub: "Üstteki taşıyıcı ray ve tekerlekler kapak rengindeki L-alın kapama bandıyla (valans) tamamen gizlenir.",
                      },
                      {
                        id: "coplanar_flush" as const,
                        title: "4. Hemzemin Koplanar (Kapalıyken Tek Düzlem)",
                        sub: "Kapalıyken menteşeli kapak gibi sıfıra sıfır düz durur; açılırken pantograf kollarla öne çıkıp kayar (InLine XL).",
                      },
                    ] as const
                  ).map((sm) => {
                    const curMount =
                      activeBay?.door?.slidingMountingType ||
                      (activeBay?.door?.doorSystemId === "sliding_bottom_rolling"
                        ? "inset_inside"
                        : activeBay?.door?.doorSystemId === "sliding_coplanar"
                        ? "coplanar_flush"
                        : "top_hung_pelmet");
                    const isSelMount = curMount === sm.id;
                    return (
                      <button
                        key={sm.id}
                        type="button"
                        data-testid={`sliding-mount-${sm.id}`}
                        onClick={() => onSetSlidingMountingType(sm.id)}
                        className={`w-full p-2.5 rounded-xl border text-left transition cursor-pointer ${
                          isSelMount
                            ? "bg-[#141413] text-white border-[#141413]"
                            : "bg-white hover:bg-[#EFECE5] text-[#141413] border-[#DED8CC]"
                        }`}
                      >
                        <div className="text-xs font-bold">{sm.title}</div>
                        <div
                          className={`text-[10.5px] mt-0.5 leading-snug ${
                            isSelMount ? "text-[#D6C7B2]" : "text-[#78716C]"
                          }`}
                        >
                          {sm.sub}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

          {/* Door Cross-Section Profile & Handle Selector */}
          {onSetBayV4DoorConfig && activeBay?.door?.type !== "open" && (
            <div className="pt-2 border-t border-[#EFECE5] space-y-3">
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-[#141413]">Kapak Yüzey Modeli</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { id: "flat_slab" as const, label: "Düz Modern Kapak" },
                    { id: "shaker_frame" as const, label: "Çerçeveli (Shaker)" },
                    { id: "fluted_ribbed" as const, label: "Fitilli (CNC Çıtalı)" },
                    { id: "glass_frame" as const, label: "Füme Cam Vitrin" },
                    { id: "mirror_door" as const, label: "Aynalı Kapak" },
                    { id: "bevel_45" as const, label: "45° Pahlı Kesit" },
                  ].map((pf) => (
                    <button
                      key={pf.id}
                      type="button"
                      onClick={() =>
                        onSetBayV4DoorConfig(activeBayIndex, {
                          crossSectionProfile: pf.id,
                          isGlassFramed: pf.id === "glass_frame",
                        })
                      }
                      className={`py-2 px-3 rounded-xl border text-xs font-semibold text-left transition cursor-pointer ${
                        curDoorProf === pf.id
                          ? "bg-[#141413] text-white border-[#141413]"
                          : "bg-[#FAF9F6] hover:bg-[#EFECE5] text-[#141413] border-[#DED8CC]"
                      }`}
                    >
                      {pf.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-xs font-bold text-[#141413]">Kulp Rengi &amp; Modeli</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { sku: "K019", label: "Mat Siyah Bar Kulp", mat: "mat_handle_matte_black", hex: "#1D1D1B" },
                    { sku: "K020", label: "Saten Inox Kulp", mat: "mat_handle_inox", hex: "#D4CFC6" },
                    { sku: "K021", label: "Fırçalı Pirinç Kulp", mat: "mat_handle_brass", hex: "#BFA065" },
                    { sku: "K022", label: "Antrasit Titanyum", mat: "mat_handle_anthracite", hex: "#3D3E42" },
                  ].map((hk) => (
                    <button
                      key={hk.sku}
                      type="button"
                      onClick={() =>
                        onSetBayV4DoorConfig(activeBayIndex, {
                          handleCategory: "bar_handle",
                          handleProfileId: hk.sku,
                          handleMaterialId: hk.mat,
                        })
                      }
                      className={`py-2 px-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 text-left transition cursor-pointer ${
                        curHandleSku === hk.sku
                          ? "bg-[#141413] text-white border-[#141413]"
                          : "bg-[#FAF9F6] hover:bg-[#EFECE5] text-[#141413] border-[#DED8CC]"
                      }`}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-black/20 shrink-0"
                        style={{ backgroundColor: hk.hex }}
                      />
                      <span>{hk.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ========================================================================
          STEP 4: MİMARİ İÇ LED AYDINLATMA SİSTEMİ (Dedicated Studio Control!)
         ======================================================================== */}
      {(showAllSteps || activeStep === "led") && (
        <section
          data-testid="customer-led-studio-section"
          className="p-3.5 rounded-[24px] birim-ice-card space-y-3.5"
        >
          {/* Master Toggle Card */}
          <div
            className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition ${
              ledOn
                ? "bg-[#FDF8EE] border-[#E6C891]"
                : "bg-[#FAF9F6] border-[#DED8CC]"
            }`}
          >
            <div className="min-w-0">
              <div className="text-xs font-bold text-[#141413] flex items-center gap-1.5">
                <Lightbulb
                  className={`w-4 h-4 ${ledOn ? "text-amber-600 fill-amber-300" : "text-[#78716C]"}`}
                />
                <span>Häfele Loox5 Entegre İç LED Sistemi</span>
              </div>
              <div className="text-[11px] text-[#57534E] mt-0.5 leading-snug">
                {ledOn
                  ? `${curLedTempK}K ışık rengi aktif • 24V gizli sürücü dahil`
                  : "Dolap içi rafları ve askılıkları homojen aydınlatır"}
              </div>
            </div>

            <button
              type="button"
              data-testid="led-master-toggle-btn"
              onClick={() =>
                onToggleLed(!ledOn, {
                  ledType: detectedLedType,
                  colorTempK: curLedTempK,
                  sensorType: curLedSensor,
                  dimmerPct: curLedDimmer,
                })
              }
              className={`shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                ledOn
                  ? "bg-[#141413] text-white"
                  : "bg-amber-500 hover:bg-amber-600 text-white shadow-xs"
              }`}
            >
              {ledOn ? "Kapat" : "LED'i Aç"}
            </button>
          </div>

          {/* 1. LED Placement Zone Cards */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-[#141413]">1. LED Yerleşim Şekli</div>
            <div className="space-y-1.5">
              {[
                {
                  id: "led_profile" as const,
                  title: "Raf Altı + Üst Tabla Gömme LED",
                  sub: "Üst tabla ve tüm rafların altına boydan boya alüminyum difüzör profil açılır (Önerilen katalog görünümü).",
                },
                {
                  id: "led_vertical_strip" as const,
                  title: "Yan Dikme Boy LED Kanalı",
                  sub: "Her bölmenin sol ve sağ iç dikmelerine yukarıdan aşağıya gömme ışık kanalı açılır.",
                },
                {
                  id: "led_rod_strip" as const,
                  title: "Işıklı Elbise Askı Borusu",
                  sub: "Askı borusunun altındaki difüzörden doğrudan gömlek ve ceketlerin üzerine ışık süzülür.",
                },
                {
                  id: "full_showcase" as const,
                  title: "Tam Vitrin Paketi (Raf Altı + Yan Dikme)",
                  sub: "Cam kapaklı ve giyinme odası dolapları için hem raf altı hem yan dikme kombine aydınlatma.",
                },
              ].map((zone) => {
                const isActZone = ledOn && detectedLedType === zone.id;
                return (
                  <button
                    key={zone.id}
                    type="button"
                    data-testid={`led-zone-${zone.id}`}
                    onClick={() =>
                      onToggleLed(true, {
                        ledType: zone.id,
                        colorTempK: curLedTempK,
                        sensorType: curLedSensor,
                        dimmerPct: curLedDimmer,
                      })
                    }
                    className={`w-full p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      isActZone
                        ? "bg-[#141413] text-white border-[#141413]"
                        : "bg-[#FAF9F6] hover:bg-[#EFECE5] text-[#141413] border-[#DED8CC]"
                    }`}
                  >
                    <div className="text-xs font-bold">{zone.title}</div>
                    <div
                      className={`text-[10.5px] mt-0.5 leading-snug ${
                        isActZone ? "text-[#E6D2AE]" : "text-[#78716C]"
                      }`}
                    >
                      {zone.sub}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Ön Kenardan Mesafe (Hizalama) & LED Kanal Ölçüleri (Genişlik × Derinlik) */}
          <div className="space-y-3 pt-2.5 border-t border-[#EFECE5]">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-[#141413]">
                  2. Ön Kenar Hizası &amp; Kanal Kesiti
                </div>
                <div className="text-[10.5px] text-[#78716C] leading-snug">
                  Raf ve dikme LED kanallarının önden mesafesi ve CNC freze yuvası
                </div>
              </div>
            </div>

            {/* Ortak Hiza vs Ayrı Hiza Segmented Switch */}
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#EFECE5] border border-[#DED8CC]">
              <button
                type="button"
                data-testid="led-align-locked-btn"
                onClick={() =>
                  onToggleLed(true, {
                    ledType: detectedLedType,
                    colorTempK: curLedTempK,
                    sensorType: curLedSensor,
                    dimmerPct: curLedDimmer,
                    alignShelfAndSide: true,
                    frontSetbackMm: curLedFrontSetback,
                    shelfSetbackMm: curLedFrontSetback,
                    channelWidthMm: curLedChanW,
                    channelDepthMm: curLedChanD,
                  })
                }
                className={`py-2 px-2.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  curLedAlign
                    ? "bg-[#141413] text-white shadow-xs"
                    : "text-[#57534E] hover:text-[#141413]"
                }`}
              >
                Ortak Hiza (Önerilen)
              </button>
              <button
                type="button"
                data-testid="led-align-split-btn"
                onClick={() =>
                  onToggleLed(true, {
                    ledType: detectedLedType,
                    colorTempK: curLedTempK,
                    sensorType: curLedSensor,
                    dimmerPct: curLedDimmer,
                    alignShelfAndSide: false,
                    frontSetbackMm: curLedFrontSetback,
                    shelfSetbackMm: curLedShelfSetback,
                    channelWidthMm: curLedChanW,
                    channelDepthMm: curLedChanD,
                  })
                }
                className={`py-2 px-2.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  !curLedAlign
                    ? "bg-[#141413] text-white shadow-xs"
                    : "text-[#57534E] hover:text-[#141413]"
                }`}
              >
                Raf / Dikme Ayrı
              </button>
            </div>

            {/* Önden Mesafe (Setback) Slider + Quick Presets */}
            <div className="p-2.5 rounded-xl bg-[#FAF9F6] border border-[#DED8CC] space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#141413]">
                  {curLedAlign ? "Ön Kenardan Mesafe (Ortak Aks)" : "Dikme LED Önden Mesafe"}
                </span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    data-testid="led-front-setback-input"
                    min={35}
                    max={maxSafeLedSetback}
                    step={1}
                    value={curLedFrontSetback}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (!Number.isNaN(v)) {
                        onToggleLed(true, {
                          ledType: detectedLedType,
                          colorTempK: curLedTempK,
                          sensorType: curLedSensor,
                          dimmerPct: curLedDimmer,
                          alignShelfAndSide: curLedAlign,
                          frontSetbackMm: v,
                          shelfSetbackMm: curLedAlign ? v : curLedShelfSetback,
                          channelWidthMm: curLedChanW,
                          channelDepthMm: curLedChanD,
                        });
                      }
                    }}
                    className="w-14 px-1.5 py-0.5 rounded-lg bg-white border border-[#DED8CC] text-right font-mono text-xs font-bold text-[#141413]"
                  />
                  <span className="text-[11px] font-semibold text-[#57534E]">mm</span>
                </div>
              </div>

              <input
                type="range"
                data-testid="led-front-setback-slider"
                min={35}
                max={Math.min(240, maxSafeLedSetback)}
                step={1}
                value={Math.min(240, curLedFrontSetback)}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  onToggleLed(true, {
                    ledType: detectedLedType,
                    colorTempK: curLedTempK,
                    sensorType: curLedSensor,
                    dimmerPct: curLedDimmer,
                    alignShelfAndSide: curLedAlign,
                    frontSetbackMm: v,
                    shelfSetbackMm: curLedAlign ? v : curLedShelfSetback,
                    channelWidthMm: curLedChanW,
                    channelDepthMm: curLedChanD,
                  });
                }}
                className="w-full accent-[#141413] h-1.5 bg-[#DED8CC] rounded-lg cursor-pointer"
              />

              <div className="grid grid-cols-4 gap-1">
                {[
                  { mm: 50, label: "50 mm" },
                  { mm: 75, label: "75 mm ★" },
                  { mm: 100, label: "100 mm" },
                  { mm: 140, label: "140 mm" },
                ]
                  .filter((p) => p.mm <= maxSafeLedSetback)
                  .map((p) => (
                    <button
                      key={p.mm}
                      type="button"
                      onClick={() =>
                        onToggleLed(true, {
                          ledType: detectedLedType,
                          colorTempK: curLedTempK,
                          sensorType: curLedSensor,
                          dimmerPct: curLedDimmer,
                          alignShelfAndSide: curLedAlign,
                          frontSetbackMm: p.mm,
                          shelfSetbackMm: curLedAlign ? p.mm : curLedShelfSetback,
                          channelWidthMm: curLedChanW,
                          channelDepthMm: curLedChanD,
                        })
                      }
                      className={`py-1 px-1.5 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                        curLedFrontSetback === p.mm
                          ? "bg-[#141413] text-white border-[#141413]"
                          : "bg-white hover:bg-[#EFECE5] text-[#44403C] border-[#DED8CC]"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
              </div>

              {hasHingedDoorInMod && curLedFrontSetback <= 46 && (
                <div className="text-[10.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 leading-snug">
                  37 mm menteşe tabanı / raf pimi delik aksına çok yakın. Çakışmaması için{" "}
                  <b>70–75 mm</b> önerilir.
                </div>
              )}
              {hasInsetSlidingInMod && curLedFrontSetback < 65 && (
                <div className="text-[10.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 leading-snug">
                  İçten çalışan sürgü rayı ilk 58 mm alanı kullanır. Rayla çakışmaması için{" "}
                  <b>en az 70 mm</b> önerilir.
                </div>
              )}

              {!curLedAlign && (
                <div className="pt-2 mt-1 border-t border-[#E5E0D5] space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#141413]">
                      Raf Altı &amp; Üst LED Önden Mesafe
                    </span>
                    <span className="font-mono text-xs font-bold text-[#141413]">
                      {curLedShelfSetback} mm
                    </span>
                  </div>
                  <input
                    type="range"
                    data-testid="led-shelf-setback-slider"
                    min={35}
                    max={Math.min(240, maxSafeLedSetback)}
                    step={1}
                    value={Math.min(240, curLedShelfSetback)}
                    onChange={(e) =>
                      onToggleLed(true, {
                        ledType: detectedLedType,
                        colorTempK: curLedTempK,
                        sensorType: curLedSensor,
                        dimmerPct: curLedDimmer,
                        alignShelfAndSide: false,
                        frontSetbackMm: curLedFrontSetback,
                        shelfSetbackMm: Number(e.target.value),
                        channelWidthMm: curLedChanW,
                        channelDepthMm: curLedChanD,
                      })
                    }
                    className="w-full accent-[#141413] h-1.5 bg-[#DED8CC] rounded-lg cursor-pointer"
                  />
                </div>
              )}
            </div>

            {/* Farklı LED Kanal Profilleri (Hazır Kesitler + Özel Genişlik & Derinlik) */}
            <div className="p-2.5 rounded-xl bg-[#FAF9F6] border border-[#DED8CC] space-y-2.5">
              <div className="text-xs font-semibold text-[#141413]">
                LED Kanal Profili (Genişlik × Derinlik)
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { w: 8, d: 6, title: "İnce COB Mikro", spec: "8 × 6 mm" },
                  { w: 12, d: 8, title: "Standart Loox5", spec: "12 × 8 mm" },
                  { w: 16, d: 10, title: "Geniş Mimari", spec: "16 × 10 mm" },
                  { w: 22, d: 12, title: "Çift Şerit Vitrin", spec: "22 × 12 mm" },
                ].map((preset) => {
                  const effD = Math.min(maxSafeChanDepth, preset.d);
                  const isActivePreset = curLedChanW === preset.w && curLedChanD === effD;
                  return (
                    <button
                      key={preset.title}
                      type="button"
                      onClick={() =>
                        onToggleLed(true, {
                          ledType: detectedLedType,
                          colorTempK: curLedTempK,
                          sensorType: curLedSensor,
                          dimmerPct: curLedDimmer,
                          alignShelfAndSide: curLedAlign,
                          frontSetbackMm: curLedFrontSetback,
                          shelfSetbackMm: curLedShelfSetback,
                          channelWidthMm: preset.w,
                          channelDepthMm: effD,
                        })
                      }
                      className={`p-2 rounded-xl border text-left transition cursor-pointer ${
                        isActivePreset
                          ? "bg-[#141413] text-white border-[#141413]"
                          : "bg-white hover:bg-[#EFECE5] text-[#141413] border-[#DED8CC]"
                      }`}
                    >
                      <div className="text-[11.5px] font-bold leading-tight">{preset.title}</div>
                      <div
                        className={`text-[10.5px] font-mono mt-0.5 ${
                          isActivePreset ? "text-[#E6D2AE]" : "text-[#78716C]"
                        }`}
                      >
                        {preset.spec}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Özel Kanal Genişliği (mm) */}
              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11.5px] font-semibold text-[#44403C]">
                    Kanal Genişliği (Freze Ağzı)
                  </span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      data-testid="led-channel-width-input"
                      min={6}
                      max={32}
                      step={1}
                      value={curLedChanW}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (!Number.isNaN(v)) {
                          onToggleLed(true, {
                            ledType: detectedLedType,
                            colorTempK: curLedTempK,
                            sensorType: curLedSensor,
                            dimmerPct: curLedDimmer,
                            alignShelfAndSide: curLedAlign,
                            frontSetbackMm: curLedFrontSetback,
                            shelfSetbackMm: curLedShelfSetback,
                            channelWidthMm: v,
                            channelDepthMm: curLedChanD,
                          });
                        }
                      }}
                      className="w-12 px-1 py-0.5 rounded-lg bg-white border border-[#DED8CC] text-right font-mono text-xs font-bold text-[#141413]"
                    />
                    <span className="text-[11px] font-semibold text-[#57534E]">mm</span>
                  </div>
                </div>
                <input
                  type="range"
                  data-testid="led-channel-width-slider"
                  min={6}
                  max={30}
                  step={1}
                  value={Math.min(30, curLedChanW)}
                  onChange={(e) =>
                    onToggleLed(true, {
                      ledType: detectedLedType,
                      colorTempK: curLedTempK,
                      sensorType: curLedSensor,
                      dimmerPct: curLedDimmer,
                      alignShelfAndSide: curLedAlign,
                      frontSetbackMm: curLedFrontSetback,
                      shelfSetbackMm: curLedShelfSetback,
                      channelWidthMm: Number(e.target.value),
                      channelDepthMm: curLedChanD,
                    })
                  }
                  className="w-full accent-[#141413] h-1.5 bg-[#DED8CC] rounded-lg cursor-pointer"
                />
              </div>

              {/* Özel Kanal Derinliği (mm) + Kalan Panel Et Kalınlığı */}
              <div className="space-y-1 pt-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11.5px] font-semibold text-[#44403C]">
                    Kanal Derinliği (Gömme Payı)
                  </span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      data-testid="led-channel-depth-input"
                      min={4}
                      max={maxSafeChanDepth}
                      step={1}
                      value={curLedChanD}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (!Number.isNaN(v)) {
                          onToggleLed(true, {
                            ledType: detectedLedType,
                            colorTempK: curLedTempK,
                            sensorType: curLedSensor,
                            dimmerPct: curLedDimmer,
                            alignShelfAndSide: curLedAlign,
                            frontSetbackMm: curLedFrontSetback,
                            shelfSetbackMm: curLedShelfSetback,
                            channelWidthMm: curLedChanW,
                            channelDepthMm: v,
                          });
                        }
                      }}
                      className="w-12 px-1 py-0.5 rounded-lg bg-white border border-[#DED8CC] text-right font-mono text-xs font-bold text-[#141413]"
                    />
                    <span className="text-[11px] font-semibold text-[#57534E]">mm</span>
                  </div>
                </div>
                <input
                  type="range"
                  data-testid="led-channel-depth-slider"
                  min={4}
                  max={maxSafeChanDepth}
                  step={1}
                  value={curLedChanD}
                  onChange={(e) =>
                    onToggleLed(true, {
                      ledType: detectedLedType,
                      colorTempK: curLedTempK,
                      sensorType: curLedSensor,
                      dimmerPct: curLedDimmer,
                      alignShelfAndSide: curLedAlign,
                      frontSetbackMm: curLedFrontSetback,
                      shelfSetbackMm: curLedShelfSetback,
                      channelWidthMm: curLedChanW,
                      channelDepthMm: Number(e.target.value),
                    })
                  }
                  className="w-full accent-[#141413] h-1.5 bg-[#DED8CC] rounded-lg cursor-pointer"
                />
                <div className="flex items-center justify-between text-[10.5px] text-[#57534E] pt-0.5">
                  <span>{panelThickMm} mm panel içinde CNC yuva</span>
                  <span className="font-semibold text-emerald-800">
                    Kalan et kalınlığı: {remainingWallMm} mm
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Kelvin Color Temperature */}
          <div className="space-y-2 pt-2 border-t border-[#EFECE5]">
            <div className="text-xs font-bold text-[#141413]">3. Işık Sıcaklığı (Kelvin)</div>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { k: 2700 as const, label: "2700K", sub: "Loş Kehribar", swatch: "#FFB65C" },
                  { k: 3000 as const, label: "3000K", sub: "Sıcak Beyaz", swatch: "#FFD48A" },
                  { k: 4000 as const, label: "4000K", sub: "Doğal Gün Işığı", swatch: "#FFF3DC" },
                ] as const
              ).map((kt) => {
                const isSelK = curLedTempK === kt.k && ledOn;
                return (
                  <button
                    key={kt.k}
                    type="button"
                    data-testid={`led-kelvin-${kt.k}`}
                    onClick={() =>
                      onToggleLed(true, {
                        ledType: detectedLedType,
                        colorTempK: kt.k,
                        sensorType: curLedSensor,
                        dimmerPct: curLedDimmer,
                      })
                    }
                    className={`p-2 rounded-xl border text-center transition cursor-pointer flex flex-col items-center gap-1 ${
                      isSelK
                        ? "bg-[#141413] text-white border-[#141413]"
                        : "bg-[#FAF9F6] hover:bg-[#EFECE5] text-[#141413] border-[#DED8CC]"
                    }`}
                  >
                    <span
                      className="w-5 h-2.5 rounded-full border border-black/15"
                      style={{ backgroundColor: kt.swatch }}
                    />
                    <span className="text-xs font-bold">{kt.label}</span>
                    <span
                      className={`text-[10px] leading-tight ${
                        isSelK ? "text-[#D6C7B2]" : "text-[#78716C]"
                      }`}
                    >
                      {kt.sub}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Dimmer & Sensor */}
          <div className="space-y-2.5 pt-2 border-t border-[#EFECE5]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#141413]">4. Parlaklık (Dimmer)</span>
              <span className="text-xs font-mono font-bold text-[#57534E]">%{curLedDimmer}</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {[25, 50, 75, 100].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() =>
                    onToggleLed(true, {
                      ledType: detectedLedType,
                      colorTempK: curLedTempK,
                      sensorType: curLedSensor,
                      dimmerPct: pct,
                    })
                  }
                  className={`py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                    ledOn && curLedDimmer === pct
                      ? "bg-[#141413] text-white border-[#141413]"
                      : "bg-[#FAF9F6] hover:bg-[#EFECE5] text-[#44403C] border-[#DED8CC]"
                  }`}
                >
                  %{pct}
                </button>
              ))}
            </div>

            <div className="space-y-1.5 pt-1">
              <div className="text-xs font-bold text-[#141413]">Sensör &amp; Kontrol Tipi</div>
              <div className="grid grid-cols-1 gap-1.5">
                {[
                  { id: "ir_door" as const, label: "Kapak Açılınca Otomatik Yanan (IR Sensör)" },
                  { id: "pir_motion" as const, label: "Yaklaşınca Yanan Hareket Sensörü (PIR)" },
                  { id: "manual_switch" as const, label: "Gömme Dokunmatik Dimmer Anahtar" },
                ].map((sn) => (
                  <button
                    key={sn.id}
                    type="button"
                    onClick={() =>
                      onToggleLed(true, {
                        ledType: detectedLedType,
                        colorTempK: curLedTempK,
                        sensorType: sn.id,
                        dimmerPct: curLedDimmer,
                      })
                    }
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold text-left transition cursor-pointer ${
                      ledOn && curLedSensor === sn.id
                        ? "bg-[#141413] text-white border-[#141413]"
                        : "bg-[#FAF9F6] hover:bg-[#EFECE5] text-[#141413] border-[#DED8CC]"
                    }`}
                  >
                    {sn.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================================
          STEP 5: MALZEME & RENK KARTELASI (Spacious 2-Column Untruncated Cards!)
         ======================================================================== */}
      {(showAllSteps || activeStep === "material") && (
        <section className="p-3.5 rounded-[24px] birim-ice-card space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-[#141413]">Yüzey Seçimi</span>
            <div className="inline-flex rounded-xl bg-[#EFECE5] p-0.5 border border-[#DED8CC]">
              <button
                type="button"
                onClick={() => setMatTarget("door")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  matTarget === "door"
                    ? "bg-[#141413] text-white"
                    : "text-[#57534E] hover:text-[#141413]"
                }`}
              >
                Kapak Yüzeyi
              </button>
              <button
                type="button"
                onClick={() => setMatTarget("body")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  matTarget === "body"
                    ? "bg-[#141413] text-white"
                    : "text-[#57534E] hover:text-[#141413]"
                }`}
              >
                İç Gövde
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {curatedSwatches.map((mat) => {
              const currentId =
                matTarget === "door"
                  ? activeModule.carcass.doorMaterialId
                  : activeModule.carcass.bodyMaterialId;
              const isSelected = currentId === mat.id;
              return (
                <button
                  key={mat.id}
                  type="button"
                  onClick={() =>
                    matTarget === "door"
                      ? onSetMaterials(undefined, mat.id)
                      : onSetMaterials(mat.id, undefined)
                  }
                  className={`p-2.5 rounded-xl border flex items-center gap-2.5 text-left transition cursor-pointer ${
                    isSelected
                      ? "bg-[#FAF9F6] border-2 border-[#141413] shadow-2xs"
                      : "bg-[#FAF9F6]/60 hover:bg-[#EFECE5] border-[#DED8CC]"
                  }`}
                >
                  <span
                    data-material-swatch="true"
                    className="w-8 h-8 rounded-lg border border-black/15 shrink-0 flex items-center justify-center relative overflow-hidden"
                    style={getMaterialSwatchStyle(mat)}
                  >
                    {isSelected && (
                      <Check
                        className={`w-4 h-4 ${
                          mat.id.includes("white") || mat.id.includes("cream")
                            ? "text-[#141413]"
                            : "text-white"
                        }`}
                      />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-xs font-semibold text-[#141413] block leading-snug break-words">
                      {cleanMaterialDisplayName(mat.name)}
                    </span>
                    <span className="text-[10px] text-[#78716C] block">
                      {mat.category === "wood"
                        ? "Doğal Ahşap Doku"
                        : mat.category === "lacquer"
                        ? "İpek Mat Lake"
                        : mat.category === "glass"
                        ? "Temperli Vitrin Cam"
                        : mat.category === "mirror"
                        ? "Bronz / Gümüş Ayna"
                        : "MDFLam Yüzey"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* PREV / NEXT STEP FOOTER + ARCHITECT SWITCH */}
      {!showAllSteps && (
        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            type="button"
            disabled={stepIndex <= 0}
            title="Önceki Adım"
            onClick={() => stepIndex > 0 && setActiveStep(STEP_ORDER[stepIndex - 1].id)}
            className="w-9 h-9 rounded-xl birim-ice-btn disabled:opacity-35 text-[#141413] inline-flex items-center justify-center transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="sr-only">Önceki</span>
          </button>

          {stepIndex < STEP_ORDER.length - 1 ? (
            <button
              type="button"
              title={`Sonraki: ${STEP_ORDER[stepIndex + 1].shortLabel}`}
              onClick={() => setActiveStep(STEP_ORDER[stepIndex + 1].id)}
              className="h-9 px-3.5 rounded-xl birim-ice-btn-active text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer"
            >
              <span>{STEP_ORDER[stepIndex + 1].shortLabel}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              title="Mimar Detay Moduna Geç"
              onClick={() => onSwitchTier("architect")}
              className="h-9 px-3 rounded-xl birim-ice-btn text-xs font-semibold text-[#44403C] inline-flex items-center gap-1.5 transition cursor-pointer"
            >
              <span>Mimar</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
});
SimpleCustomerInspector.displayName = "SimpleCustomerInspector";
