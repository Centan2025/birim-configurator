"use client";

import React, { useMemo, useState } from "react";
import { Plus, SlidersHorizontal, ArrowUp, ArrowDown, Trash2, X, ArrowLeftRight, Palette } from "lucide-react";
import { getMaterialSwatchStyle } from "../v3/materials/pbrMaterialSystem";
import { classifyModuleArchitecturalZone, dispatchLive3DMaterialPreview, type QuickZoneScope } from "./quickMaterialAndMoodboardEngine";
import type { HardwareSwapGroup } from "./HardwareQuickSwapPopover";
import {
  calculateFourSpaceDimensions,
  type DoorCrossSectionProfile,
  type MaterialDefinition,
  type ModuleInstance,
} from "@birim/core";
import { getBayShelfIntervalsForSubDivider } from "../v3/adapter/useV3Adapter";

export type Selected3DPartKind =
  | "door"
  | "shelf"
  | "sub_divider"
  | "drawer"
  | "rail"
  | "bay";

export interface OnObjectQuickToolbarProps {
  activeModule: ModuleInstance;
  activeBayIndex: number;
  selectedPartKind: Selected3DPartKind;
  selectedComponentId: string | null;
  selectedContextLabel: string | null;
  displayUnit?: "cm" | "mm";
  placementMode?: "docked" | "stage";
  leftSafePx?: number;
  rightSafePx?: number;
  hasGuidedStepStrip?: boolean;
  hasTopPaintBanner?: boolean;
  materials: MaterialDefinition[];
  isInspectorOpen: boolean;
  onAddShelf: (bayIdx: number) => void;
  onAddDrawerOrInternal: (bayIdx: number) => void;
  onAddHangingRail: (bayIdx: number) => void;
  onAddSubDivider: (bayIdx: number) => void;
  onCycleDoorType: (bayIdx: number) => void;
  onSetDoorProfile: (bayIdx: number, profile: DoorCrossSectionProfile, isGlass: boolean) => void;
  onRemoveBayDoor: (bayIdx: number) => void;
  onQuickApplyDoorMaterial: (materialId: string) => void;
  onToggleShelfMount: (bayIdx: number, shelfId: string) => void;
  onSetShelfThickness: (bayIdx: number, shelfId: string, thicknessMm: number) => void;
  onShiftShelfElevation: (bayIdx: number, shelfId: string, deltaMm: number) => void;
  onMoveSubDividerToInterval: (
    bayIdx: number,
    subDividerId: string,
    botY: number,
    height: number
  ) => void;
  onCenterSubDividerX: (bayIdx: number, subDividerId: string, bayClearWidthMm: number) => void;
  onShiftRailElevation: (bayIdx: number, railId: string, deltaMm: number) => void;
  onDeleteSelectedPart: () => void;
  onOpenHardwareSwap?: (group: HardwareSwapGroup, bayIdx: number) => void;
  onOpenQuickPaletteDock?: () => void;
  onQuickApplyZoneMaterial?: (scope: QuickZoneScope, materialId: string) => void;
  onOpenInspectorDetails: () => void;
  onDismiss: () => void;
}

export const OnObjectQuickToolbar: React.FC<OnObjectQuickToolbarProps> = React.memo(
  ({
    activeModule,
    activeBayIndex,
    selectedPartKind,
    selectedComponentId,
    selectedContextLabel,
    displayUnit = "cm",
    placementMode = "docked",
    leftSafePx = 76,
    rightSafePx = 64,
    hasGuidedStepStrip = false,
    hasTopPaintBanner = false,
    materials,
    isInspectorOpen,
    onAddShelf,
    onAddDrawerOrInternal,
    onAddHangingRail,
    onAddSubDivider,
    onCycleDoorType,
    onSetDoorProfile,
    onRemoveBayDoor,
    onQuickApplyDoorMaterial,
    onToggleShelfMount,
    onSetShelfThickness,
    onShiftShelfElevation,
    onMoveSubDividerToInterval,
    onCenterSubDividerX,
    onShiftRailElevation,
    onDeleteSelectedPart,
    onOpenHardwareSwap,
    onOpenQuickPaletteDock,
    onQuickApplyZoneMaterial,
    onOpenInspectorDetails,
    onDismiss,
  }) => {
    const [applyToZoneGroup, setApplyToZoneGroup] = useState(false);
    const safeBayIdx = Math.min(activeBayIndex, Math.max(0, activeModule.bays.length - 1));
    const bay = activeModule.bays[safeBayIdx];
    const isSliding = activeModule.bays.some((b) => b.door?.type === "sliding");
    const activeDoorMatId = activeModule.carcass.doorMaterialId;
    const modZone = classifyModuleArchitecturalZone(activeModule);
    const groupScopeForMod: QuickZoneScope =
      modZone === "wall"
        ? "wall_cabinets"
        : modZone === "tall_or_island"
        ? "tall_and_island"
        : "base_cabinets";
    const groupScopeLabelTr =
      modZone === "wall" ? "Tüm Üstler" : modZone === "tall_or_island" ? "Boy/Ada" : "Tüm Altlar";
    const quickSwatches = useMemo(() => {
      const preferredIds = [
        activeDoorMatId,
        "mat_camsan_iskandinav_mese",
        "mat_veneer_oak",
        "mat_veneer_walnut",
        "mat_lacquer_cream",
        "mat_lacquer_sage",
        "mat_ke_mattplus_vizon",
        "mat_melamine_anthracite",
      ];
      const out: MaterialDefinition[] = [];
      const seen = new Set<string>();
      for (const id of preferredIds) {
        if (!id || seen.has(id)) continue;
        const found = materials.find((m) => m.id === id);
        if (found) {
          seen.add(found.id);
          out.push(found);
        }
        if (out.length >= 6) break;
      }
      for (const m of materials) {
        if (out.length >= 6) break;
        if (!seen.has(m.id) && m.category !== "stone" && m.category !== "metal") {
          seen.add(m.id);
          out.push(m);
        }
      }
      return out;
    }, [materials, activeDoorMatId]);

    const fourSpace = useMemo(
      () => calculateFourSpaceDimensions(activeModule),
      [activeModule]
    );
    const bayClearW = fourSpace.usableInternal.bayClearWidthsMm[safeBayIdx] || 600;
    const panelT = activeModule.carcass.panelThickness || 18;
    const plinthH = activeModule.carcass.plinthHeight ?? 80;
    const netInnerH =
      fourSpace.usableInternal.netInnerHeightMm ||
      Math.max(300, activeModule.dimensions.height - plinthH - 2 * panelT);

    const subIntervals = useMemo(
      () => (bay ? getBayShelfIntervalsForSubDivider(bay, netInnerH, panelT) : []),
      [bay, netInnerH, panelT]
    );

    if (!selectedContextLabel || !bay) return null;

    const matchedShelf =
      bay.shelves.find(
        (s, idx) =>
          s.id === selectedComponentId ||
          `${activeModule.id}_bay_${safeBayIdx}_shelf_${idx}` === selectedComponentId
      ) || bay.shelves[0];

    const matchedSubDiv =
      (bay.subDividers || []).find(
        (sd, idx) =>
          sd.id === selectedComponentId ||
          `${activeModule.id}_bay_${safeBayIdx}_subdiv_${idx}` === selectedComponentId
      ) || (bay.subDividers || [])[0];

    const matchedRail =
      bay.hangingRails.find(
        (r, idx) =>
          r.id === selectedComponentId ||
          `${activeModule.id}_bay_${safeBayIdx}_rail_${idx}` === selectedComponentId
      ) || bay.hangingRails[0];

    const curDoorProfile =
      bay.door?.crossSectionProfile || activeModule.carcass.crossSectionProfile || "flat_slab";

    const currentSubIntervalIdx = matchedSubDiv
      ? Math.max(
          0,
          subIntervals.findIndex(
            (iv) =>
              Math.abs(iv.botY - matchedSubDiv.elevationY) <= 22 ||
              (matchedSubDiv.elevationY + matchedSubDiv.height / 2 >= iv.botY &&
                matchedSubDiv.elevationY + matchedSubDiv.height / 2 <= iv.topY)
          )
        )
      : 0;

    const containerClass =
      placementMode === "docked"
        ? "birim-dramatic-panel mx-3.5 mt-2.5 p-2.5 rounded-2xl bg-[#2B313E]/90 border border-white/[0.20] text-[#F3F4F6] shadow-md space-y-2 shrink-0"
        : "birim-dramatic-panel fixed z-30 w-[min(372px,calc(100vw-24px))] p-2.5 rounded-2xl bg-[#252A34]/88 backdrop-blur-2xl border border-white/[0.22] ring-1 ring-black/60 text-[#F3F4F6] shadow-[0_20px_48px_rgba(0,0,0,0.56)] space-y-2";

    const containerStyle: React.CSSProperties | undefined =
      placementMode === "stage"
        ? {
            top: `${122 + (hasTopPaintBanner ? 42 : 0)}px`,
            left: `calc(${leftSafePx}px + (100vw - ${leftSafePx + rightSafePx}px) / 2)`,
            transform: "translateX(-50%)",
          }
        : undefined;

    return (
      <div
        data-testid="v12-on-object-quick-toolbar"
        style={containerStyle}
        className={containerClass}
      >
        {/* Üst Satır: Seçili Parça Başlığı + Sağda Detay/Kapat */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-2 h-2 rounded-full bg-[#38BDF8] shrink-0" />
            <span className="text-[11px] font-bold text-[#141413] truncate">
              {selectedContextLabel}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {onOpenHardwareSwap &&
              (selectedPartKind === "door" ||
                selectedPartKind === "drawer" ||
                selectedPartKind === "rail") && (
                <button
                  type="button"
                  data-testid="v12-on-object-swap-hardware"
                  onClick={() =>
                    onOpenHardwareSwap(
                      selectedPartKind === "door"
                        ? "hinge"
                        : selectedPartKind === "drawer"
                        ? "drawer_slide"
                        : "rail",
                      safeBayIdx
                    )
                  }
                  className="h-6 px-2 rounded-lg bg-[#141413] hover:bg-[#292524] text-white text-[10.5px] font-semibold inline-flex items-center gap-1 transition cursor-pointer"
                  title="Donanımı alternatifleriyle değiştir"
                >
                  <ArrowLeftRight className="w-3 h-3" />
                  <span>Donanım</span>
                </button>
              )}
            {!isInspectorOpen && (
              <button
                type="button"
                data-testid="v12-on-object-open-details"
                onClick={onOpenInspectorDetails}
                className="h-6 px-2 rounded-lg bg-[#EFECE4] hover:bg-[#E4DEC9] text-[10.5px] font-semibold inline-flex items-center gap-1 transition cursor-pointer"
                title="Sağ tasarım panelini aç"
              >
                <SlidersHorizontal className="w-3 h-3" />
                <span>Panel</span>
              </button>
            )}
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Seçili parça kartını kapat"
              className="w-6 h-6 rounded-full hover:bg-[#EFECE4] flex items-center justify-center text-[#78716C] hover:text-[#141413] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Alt Satır: Taşmayan (flex-wrap) Parçaya Özgü Hızlı Kontroller */}
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          {/* 1. KAPAK SEÇİLDİĞİNDE */}
          {selectedPartKind === "door" && (
            <>
              {!isSliding && (
                <button
                  type="button"
                  data-testid="v12-on-object-cycle-door"
                  onClick={() => onCycleDoorType(safeBayIdx)}
                  className="h-7 px-2.5 rounded-xl bg-white hover:bg-[#F3EFE6] border border-[#E5DFD3] text-[11px] font-semibold transition cursor-pointer"
                >
                  {bay.door?.type === "single_left"
                    ? "Yön: Sol"
                    : bay.door?.type === "single_right"
                    ? "Yön: Sağ"
                    : bay.door?.type === "open"
                    ? "Kapaksız"
                    : "Yön: Çift"}
                </button>
              )}

              <div className="inline-flex items-center p-0.5 rounded-xl bg-[#ECE7DD] border border-[#DFD9CE]">
                {(
                  [
                    { id: "flat_slab", label: "Düz", glass: false },
                    { id: "shaker_frame", label: "Çerçeve", glass: false },
                    { id: "glass_frame", label: "Cam", glass: true },
                  ] as const
                ).map((pf) => {
                  const active = curDoorProfile === pf.id;
                  return (
                    <button
                      key={pf.id}
                      type="button"
                      onClick={() => onSetDoorProfile(safeBayIdx, pf.id, pf.glass)}
                      className={`h-6 px-2 rounded-lg text-[10.5px] font-semibold transition cursor-pointer ${
                        active ? "bg-[#141413] text-white" : "text-[#57534E] hover:text-[#141413]"
                      }`}
                    >
                      {pf.label}
                    </button>
                  );
                })}
              </div>

              <div
                onMouseLeave={() => dispatchLive3DMaterialPreview(null)}
                className="inline-flex items-center gap-1 px-1"
                title="Üzerine gelince 3B önizler, tıklayınca uygular"
              >
                {onQuickApplyZoneMaterial && (
                  <button
                    type="button"
                    onClick={() => setApplyToZoneGroup((v) => !v)}
                    title={
                      applyToZoneGroup
                        ? `Grup Modu Açık: Seçilen renk "${groupScopeLabelTr}" grubuna uygulanır`
                        : "Tek Modül Modu: Yalnızca bu dolaba uygulanır (Gruba yaymak için tıklayın)"
                    }
                    className={`h-5.5 px-1.5 rounded-md text-[9.5px] font-bold border transition cursor-pointer ${
                      applyToZoneGroup
                        ? "bg-[#141413] border-[#141413] text-white"
                        : "bg-white border-[#DED8CC] text-[#57534E] hover:text-[#141413]"
                    }`}
                  >
                    {applyToZoneGroup ? groupScopeLabelTr : "Bu Dolap"}
                  </button>
                )}
                {quickSwatches.map((m) => {
                  const active = activeDoorMatId === m.id;
                  const targetScope: QuickZoneScope = applyToZoneGroup ? groupScopeForMod : "active_doors";
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onMouseEnter={() =>
                        dispatchLive3DMaterialPreview({
                          materialId: m.id,
                          scope: targetScope,
                        })
                      }
                      onClick={() => {
                        dispatchLive3DMaterialPreview(null);
                        if (applyToZoneGroup && onQuickApplyZoneMaterial) {
                          onQuickApplyZoneMaterial(groupScopeForMod, m.id);
                        } else {
                          onQuickApplyDoorMaterial(m.id);
                        }
                      }}
                      title={`${m.name} (${applyToZoneGroup ? groupScopeLabelTr : "Bu Dolap"})`}
                      className={`w-5 h-5 rounded-full border transition cursor-pointer ${
                        active
                          ? "border-[#141413] scale-110 ring-2 ring-[#141413]/20"
                          : "border-black/20 opacity-90 hover:opacity-100 hover:scale-110"
                      }`}
                      style={getMaterialSwatchStyle(m)}
                    />
                  );
                })}
                {onOpenQuickPaletteDock && (
                  <button
                    type="button"
                    onClick={onOpenQuickPaletteDock}
                    title="Tüm Kartela ve Hazır Kombinasyonları Aç (M)"
                    className="h-5.5 px-1.5 rounded-md bg-[#EFEAE0] hover:bg-[#E4DEC9] border border-[#DED8CC] text-[10px] font-bold text-[#141413] inline-flex items-center gap-0.5 cursor-pointer"
                  >
                    <Palette className="w-2.5 h-2.5 text-[#8C6D46]" />
                    <span>+</span>
                  </button>
                )}
              </div>

              {bay.door?.type !== "open" && (
                <button
                  type="button"
                  onClick={() => onRemoveBayDoor(safeBayIdx)}
                  className="h-7 px-2.5 rounded-xl bg-white hover:bg-red-50 border border-[#E5DFD3] hover:border-red-200 text-[11px] font-semibold text-[#78716C] hover:text-red-700 transition cursor-pointer"
                >
                  Kapağı Kaldır
                </button>
              )}
            </>
          )}

          {/* 2. RAF ARASI DİKME SEÇİLDİĞİNDE */}
          {selectedPartKind === "sub_divider" && matchedSubDiv && (
            <>
              {subIntervals.length > 0 && (
                <select
                  aria-label="Raf Arası Dikme Raf Aralığı Seçimi"
                  value={currentSubIntervalIdx}
                  onChange={(e) => {
                    const targetIv = subIntervals[Number(e.target.value)];
                    if (targetIv) {
                      onMoveSubDividerToInterval(
                        safeBayIdx,
                        matchedSubDiv.id,
                        targetIv.botY,
                        targetIv.height
                      );
                    }
                  }}
                  className="flex-1 min-w-[140px] h-7 px-2 rounded-xl bg-white border border-[#DED8CC] text-[11px] font-semibold text-[#141413] outline-none cursor-pointer"
                >
                  {subIntervals.map((iv, idx) => (
                    <option key={`${iv.botY}_${idx}`} value={idx}>
                      {iv.label}
                    </option>
                  ))}
                </select>
              )}

              {subIntervals.length > 1 && (
                <>
                  <button
                    type="button"
                    disabled={currentSubIntervalIdx >= subIntervals.length - 1}
                    onClick={() => {
                      const nextIv = subIntervals[currentSubIntervalIdx + 1];
                      if (nextIv) {
                        onMoveSubDividerToInterval(
                          safeBayIdx,
                          matchedSubDiv.id,
                          nextIv.botY,
                          nextIv.height
                        );
                      }
                    }}
                    title="Üst raf aralığına taşı"
                    className="h-7 px-2 rounded-xl bg-white hover:bg-[#F3EFE6] disabled:opacity-35 border border-[#E5DFD3] inline-flex items-center justify-center cursor-pointer"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={currentSubIntervalIdx <= 0}
                    onClick={() => {
                      const prevIv = subIntervals[currentSubIntervalIdx - 1];
                      if (prevIv) {
                        onMoveSubDividerToInterval(
                          safeBayIdx,
                          matchedSubDiv.id,
                          prevIv.botY,
                          prevIv.height
                        );
                      }
                    }}
                    title="Alt raf aralığına taşı"
                    className="h-7 px-2 rounded-xl bg-white hover:bg-[#F3EFE6] disabled:opacity-35 border border-[#E5DFD3] inline-flex items-center justify-center cursor-pointer"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => onCenterSubDividerX(safeBayIdx, matchedSubDiv.id, bayClearW)}
                className="h-7 px-2.5 rounded-xl bg-white hover:bg-[#F3EFE6] border border-[#E5DFD3] text-[11px] font-semibold transition cursor-pointer"
              >
                Ortala
              </button>

              <button
                type="button"
                onClick={onDeleteSelectedPart}
                title="Raf Arası Dikmeyi Sil"
                className="h-7 px-2 rounded-xl bg-white hover:bg-red-50 border border-[#E5DFD3] text-[#78716C] hover:text-red-600 inline-flex items-center cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {/* 3. RAF SEÇİLDİĞİNDE */}
          {selectedPartKind === "shelf" && matchedShelf && (() => {
            const isFixedShelf = matchedShelf.isAdjustable === false || matchedShelf.isFixed;
            const shelfElevMm = Math.round(Number(matchedShelf.elevationY ?? 0));
            const shelfElevText =
              displayUnit === "cm"
                ? `${Number((shelfElevMm / 10).toFixed(1))} cm`
                : `${shelfElevMm} mm`;
            return (
            <>
              <span
                data-testid="v11-shelf-mode-badge"
                title={
                  isFixedShelf
                    ? "Sabit yapısal raf (Minifix/Rafix) — serbest konumlandırılabilir"
                    : "Hareketli pimli raf — System 32 çoklu deliklere 32 mm adımla kilitlenir"
                }
                className={`h-7 px-2.5 rounded-xl border text-[11px] font-semibold inline-flex items-center gap-1.5 select-none ${
                  isFixedShelf
                    ? "bg-amber-50/90 border-amber-300/80 text-amber-900"
                    : "bg-blue-50/90 border-blue-300/80 text-blue-900"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isFixedShelf ? "bg-amber-600" : "bg-blue-600"
                  }`}
                />
                <span>{isFixedShelf ? "Sabit Raf · Serbest" : "Pimli · 32 mm"}</span>
                <span className="font-mono text-[10px] opacity-80">Y:{shelfElevText}</span>
              </span>

              <button
                type="button"
                onClick={() => onToggleShelfMount(safeBayIdx, matchedShelf.id)}
                title={isFixedShelf ? "Hareketli pimli rafa çevir (System 32)" : "Sabit yapısal rafa çevir (Minifix/Rafix)"}
                className="h-7 px-2.5 rounded-xl bg-white hover:bg-[#F3EFE6] border border-[#E5DFD3] text-[11px] font-semibold transition cursor-pointer"
              >
                {isFixedShelf ? "Sabit → Hareketli" : "Hareketli → Sabit"}
              </button>

              <button
                type="button"
                onClick={() =>
                  onSetShelfThickness(
                    safeBayIdx,
                    matchedShelf.id,
                    (matchedShelf.thickness || panelT) >= 25 ? 18 : 25
                  )
                }
                className="h-7 px-2.5 rounded-xl bg-white hover:bg-[#F3EFE6] border border-[#E5DFD3] font-mono text-[11px] font-semibold transition cursor-pointer"
              >
                {displayUnit === "cm" ? `${Number(((matchedShelf.thickness || panelT) / 10).toFixed(1))} cm` : `${matchedShelf.thickness || panelT} mm`}
              </button>

              <button
                type="button"
                onClick={() => onShiftShelfElevation(safeBayIdx, matchedShelf.id, 32)}
                title="Rafı 32 mm yukarı taşı"
                className="h-7 px-2 rounded-xl bg-white hover:bg-[#F3EFE6] border border-[#E5DFD3] inline-flex items-center cursor-pointer"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onShiftShelfElevation(safeBayIdx, matchedShelf.id, -32)}
                title="Rafı 32 mm aşağı taşı"
                className="h-7 px-2 rounded-xl bg-white hover:bg-[#F3EFE6] border border-[#E5DFD3] inline-flex items-center cursor-pointer"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={onDeleteSelectedPart}
                title="Seçili Rafı Sil"
                className="h-7 px-2 rounded-xl bg-white hover:bg-red-50 border border-[#E5DFD3] text-[#78716C] hover:text-red-600 inline-flex items-center cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
            );
          })()}

          {/* 4. ÇEKMECE VEYA ASKI SEÇİLDİĞİNDE */}
          {(selectedPartKind === "drawer" || selectedPartKind === "rail") && (
            <>
              {selectedPartKind === "drawer" ? (
                <button
                  type="button"
                  onClick={() => onAddDrawerOrInternal(safeBayIdx)}
                  className="h-7 px-2.5 rounded-xl bg-white hover:bg-[#F3EFE6] border border-[#E5DFD3] text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Üstüne Çekmece</span>
                </button>
              ) : (
                matchedRail && (
                  <>
                    <button
                      type="button"
                      onClick={() => onShiftRailElevation(safeBayIdx, matchedRail.id, 32)}
                      className="h-7 px-2 rounded-xl bg-white hover:bg-[#F3EFE6] border border-[#E5DFD3] inline-flex items-center cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onShiftRailElevation(safeBayIdx, matchedRail.id, -32)}
                      className="h-7 px-2 rounded-xl bg-white hover:bg-[#F3EFE6] border border-[#E5DFD3] inline-flex items-center cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </>
                )
              )}
              <button
                type="button"
                onClick={onDeleteSelectedPart}
                title="Seçili Elemanı Sil"
                className="h-7 px-2 rounded-xl bg-white hover:bg-red-50 border border-[#E5DFD3] text-[#78716C] hover:text-red-600 inline-flex items-center cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {/* 5. GENEL BÖLME İÇİ SEÇİLDİĞİNDE */}
          {selectedPartKind === "bay" && (
            <>
              <button
                type="button"
                data-testid="v12-on-object-add-shelf"
                onClick={() => onAddShelf(safeBayIdx)}
                className="h-7 px-2.5 rounded-xl bg-white hover:bg-[#F3EFE6] border border-[#E5DFD3] text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3 text-[#6B4F28]" />
                <span>Raf</span>
              </button>
              <button
                type="button"
                onClick={() => onAddSubDivider(safeBayIdx)}
                className="h-7 px-2.5 rounded-xl bg-white hover:bg-[#F3EFE6] border border-[#E5DFD3] text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3 text-[#6B4F28]" />
                <span>Ara Dikme</span>
              </button>
              <button
                type="button"
                data-testid="v12-on-object-add-drawer"
                onClick={() => onAddDrawerOrInternal(safeBayIdx)}
                className="h-7 px-2.5 rounded-xl bg-white hover:bg-[#F3EFE6] border border-[#E5DFD3] text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3 text-[#6B4F28]" />
                <span>Çekmece</span>
              </button>
              <button
                type="button"
                onClick={() => onAddHangingRail(safeBayIdx)}
                className="h-7 px-2.5 rounded-xl bg-white hover:bg-[#F3EFE6] border border-[#E5DFD3] text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3 text-[#6B4F28]" />
                <span>Askı</span>
              </button>
            </>
          )}
        </div>
      </div>
    );
  }
);
OnObjectQuickToolbar.displayName = "OnObjectQuickToolbar";
