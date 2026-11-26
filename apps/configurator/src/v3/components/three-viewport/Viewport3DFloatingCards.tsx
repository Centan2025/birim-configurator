"use client";
import React from "react";
import { generateModuleGeometry, DEFAULT_MATERIALS } from "../../adapter/useV3Adapter";
import { calculateFourSpaceDimensions } from "@birim/core";
import { startAccessorySilhouetteDrag } from "../../engine/kitchenSpatialEngine";


import type { Viewport3DFloatingCardsProps } from "./viewport3DTypes";
export type { Viewport3DFloatingCardsProps };

export const Viewport3DFloatingCards: React.FC<Viewport3DFloatingCardsProps> = (props) => {
  const {
    active3DSnap,
    activeBayIndex,
    activeModule,
    activeModuleIndex,
    addDrawer,
    addHangingRail,
    addShelf,
    addSpecialFitting,
    addSubDivider,
    applyBayInteriorPreset,
    applyMaterialToSimilarComponents,
    bayMenuSubSection,
    bayPopoverDomRef,
    clicked3DContext,
    collapsedFloatingPanels,
    contextPopoverDomRef,
    copyDoorConfigToAllBays,
    cutawayActiveBay,
    dismissedBayPopover,
    dockedToCorner,
    doorMenuSubSection,
    doorOpenAngleDeg,
    doorPopoverDomRef,
    doorsHiddenIn3D,
    dragDropSnapBanner,
    flipActiveDoorDirection,
    floatingMatScope,
    floatingPanelPos,
    isDraggingItemOver3D,
    isRightInspectorOpen,
    minimalChrome,
    needsRenderRef,
    removeBayAndShrinkModule,
    removeBayAt,
    removeSelectedInteriorComponent,
    selectedComponentId,
    setActiveBayIndex,
    setActiveCamPill,
    setBayDoorType,
    setBayMenuSubSection,
    setBayV4DoorConfig,
    setClicked3DContext,
    setCollapsedFloatingPanels,
    setCutawayActiveBay,
    setDismissedBayPopover,
    setDockedToCorner,
    setDoorMenuSubSection,
    setDoorsHiddenIn3D,
    setFloatingMatScope,
    setFloatingPanelPos,
    setModuleSlidingMountingType,
    setSnapBannerDedup,
    showInCanvasHud,
    shrinkDoubleBayToSingle,
    splitBayIntoTwo,
    stageSafeInsets,
    startFloatingPanelDrag,
    toggleDoorOpen,
  } = props;
  return (
    <>
        {/* 3D DIRECT INTERACTION MINI CONTEXT MENU — Shown ONLY if floating bay/door cards are dismissed (zero duplicate bay float panels!) */}
        {!minimalChrome && showInCanvasHud && !isRightInspectorOpen && dismissedBayPopover && !dragDropSnapBanner && !active3DSnap && (clicked3DContext || doorsHiddenIn3D || cutawayActiveBay) && (
          <div
            ref={contextPopoverDomRef}
            data-floating-card="context"
            data-testid="viewport-3d-context-mini-menu"
            onPointerDown={(e) => startFloatingPanelDrag("context", e)}
            style={
              floatingPanelPos.context
                ? {
                    left: "0px",
                    top: "0px",
                    translate: "none",
                    transform: `translate3d(${floatingPanelPos.context.x}px, ${floatingPanelPos.context.y}px, 0)`,
                  }
                : stageSafeInsets
                ? {
                    top: `${(stageSafeInsets.topPx ?? 14) + 52}px`,
                    left: `calc(${stageSafeInsets.leftPx ?? 16}px + (100% - ${(stageSafeInsets.leftPx ?? 16) + (stageSafeInsets.rightPx ?? 16)}px) / 2)`,
                    transform: "translateX(-50%)",
                    maxWidth: `calc(100% - ${(stageSafeInsets.leftPx ?? 16) + (stageSafeInsets.rightPx ?? 16) + 16}px)`,
                  }
                : undefined
            }
            className={`absolute ${floatingPanelPos.context ? "top-0 left-0" : stageSafeInsets ? "" : "top-16 left-1/2 -translate-x-1/2"} z-[35] flex flex-wrap items-center justify-center gap-1.5 birim-ice-pill px-3 py-1.5 rounded-full text-xs text-[#111827] cursor-grab active:cursor-grabbing select-none transition-opacity duration-150 ${
              isDraggingItemOver3D ? "opacity-15 pointer-events-none" : ""
            }`}
          >
            <span
              title="Bu çubuğu taşımak için basılı tutup sürükleyin"
              className="px-1.5 py-0.5 rounded-full bg-white/70 border border-white/85 text-slate-500 hover:text-slate-900 font-bold cursor-grab active:cursor-grabbing select-none"
            >
              ⠿
            </span>
            {clicked3DContext?.kind === "door" && !doorsHiddenIn3D ? (
              <>
                <span className="px-2 py-0.5 rounded-lg bg-[#EEF3F8] text-[#111827] border border-[#CBD5E1] font-bold text-[11px]">
                  🚪 {clicked3DContext.label} Seçildi
                </span>
                <button
                  type="button"
                  data-testid="mini-menu-hide-doors-btn"
                  onClick={() => {
                    setDoorsHiddenIn3D(true);
                    setClicked3DContext({
                      kind: "bay",
                      bayIndex: clicked3DContext.bayIndex,
                      role: "bay_compartment",
                      label: `Bölme ${clicked3DContext.bayIndex + 1}`,
                    });
                    if (typeof window !== "undefined") {
                      window.dispatchEvent(
                        new CustomEvent("birim:select-bay-3d", {
                          detail: {
                            bayIndex: clicked3DContext.bayIndex,
                            role: "bay_compartment",
                            moduleIndex: activeModuleIndex,
                          },
                        })
                      );
                    }
                  }}
                  className="px-2.5 py-1 rounded-xl bg-[#EEF3F8] hover:bg-[#E4ECF4] text-[#111827] border border-[#94A3B8] font-bold flex items-center gap-1 cursor-pointer transition shadow-2xs"
                >
                  <span>👁️ Kapakları Gizle (İç Düzenle)</span>
                </button>
                <button
                  type="button"
                  data-testid="mini-menu-open-door-btn"
                  onClick={() => toggleDoorOpen()}
                  className="px-2.5 py-1 rounded-xl bg-white hover:bg-[#F1F5F9] text-[#111827] border border-[#CBD5E1] font-semibold cursor-pointer transition"
                >
                  {doorOpenAngleDeg > 0 ? "Kapağı Kapat (0°)" : "Kapağı Aç (85°)"}
                </button>
                <button
                  type="button"
                  data-testid="mini-menu-flip-door-btn"
                  onClick={() => flipActiveDoorDirection(clicked3DContext.bayIndex)}
                  className="px-2.5 py-1 rounded-xl bg-white hover:bg-[#F1F5F9] text-[#111827] border border-[#CBD5E1] font-semibold cursor-pointer transition"
                >
                  ⇄ Yön Çevir
                </button>
                <button
                  type="button"
                  onClick={() => setClicked3DContext(null)}
                  className="px-1.5 py-0.5 rounded-lg text-[#64748B] hover:text-[#111827] cursor-pointer"
                  title="Mini menüyü kapat"
                >
                  ✕
                </button>
              </>
            ) : (
              <>
                <span className="text-[11px] font-bold text-[#111827] mr-1">
                  🎯 3D Bölme Seçimi:
                </span>
                {activeModule.bays.map((b, bIdx) => {
                  const isSelBay = activeBayIndex === bIdx;
                  return (
                    <button
                      key={b.index}
                      type="button"
                      data-testid={`viewport-3d-bay-pill-${bIdx}`}
                      onClick={() => {
                        setActiveBayIndex(bIdx);
                        if (typeof window !== "undefined") {
                          window.dispatchEvent(
                            new CustomEvent("birim:select-bay-3d", {
                              detail: {
                                bayIndex: bIdx,
                                role: "bay_compartment",
                                moduleIndex: activeModuleIndex,
                              },
                            })
                          );
                        }
                      }}
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition cursor-pointer ${
                        isSelBay
                          ? "bg-[#EEF3F8] text-[#111827] border border-[#94A3B8] shadow-2xs"
                          : "bg-white hover:bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]"
                      }`}
                    >
                      Bölme {bIdx + 1}
                    </button>
                  );
                })}
                {(doorsHiddenIn3D || cutawayActiveBay) && (
                  <button
                    type="button"
                    data-testid="mini-menu-show-doors-btn"
                    onClick={() => {
                      setDoorsHiddenIn3D(false);
                      setCutawayActiveBay(false);
                      setActiveCamPill("3d");
                      setClicked3DContext(null);
                    }}
                    className="ml-1 px-2.5 py-1 rounded-xl bg-[#EEF3F8] hover:bg-[#E4ECF4] text-[#111827] border border-[#94A3B8] text-[11px] font-bold cursor-pointer transition"
                  >
                    🚪 Kapakları Göster
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* FLOATING 3D DOOR CONTEXTUAL CARD (Architectural B1R1M Style, w-72 Zero-Truncation, Direct Compartment Switcher & Removal) */}
        {!minimalChrome &&
          showInCanvasHud &&
          !isRightInspectorOpen &&
          clicked3DContext?.kind === "door" &&
          !doorsHiddenIn3D &&
          activeModule.bays[Math.min(clicked3DContext.bayIndex, Math.max(0, activeModule.bays.length - 1))]?.door?.type !== "open" &&
          (() => {
            const targetBayIdx = Math.min(
              clicked3DContext.bayIndex,
              Math.max(0, activeModule.bays.length - 1)
            );
            const targetBay = activeModule.bays[targetBayIdx] || activeModule.bays[0];
            const targetDoorCompId =
              clicked3DContext.componentId || selectedComponentId || `${targetBay?.door?.id}_left`;
            const curDoorProf =
              targetBay?.door?.crossSectionProfile ||
              activeModule.carcass.crossSectionProfile ||
              "flat_slab";
            const curHandleSku = targetBay?.door?.handleProfileId || "K019";
            const fourSpaceDoor = calculateFourSpaceDimensions(activeModule);
            const doorBayClearW =
              fourSpaceDoor.usableInternal.bayClearWidthsMm[targetBayIdx] || 600;
            const panelTDoor = activeModule.carcass.panelThickness || 18;
            const shrunkOuterCmDoor = Math.max(
              35,
              Math.round((activeModule.dimensions.width - (doorBayClearW + panelTDoor)) / 10)
            );
            const halfShrunkOuterCmDoor = Math.max(
              40,
              Math.round((activeModule.dimensions.width - Math.round(doorBayClearW * 0.5)) / 10)
            );
            const bdDoorSel = generateModuleGeometry(activeModule, { doorOpenAngleDeg: 0 });
            const selDoorPart = bdDoorSel.components.find((c) => c.id === targetDoorCompId);
            const fullDoorPartName = selDoorPart
              ? selDoorPart.label.split(" (")[0]
              : clicked3DContext.label;
            const doorDimsLabel = selDoorPart
              ? `${Math.round(selDoorPart.dimensions.width)} × ${Math.round(selDoorPart.dimensions.height)} × ${Math.round(selDoorPart.dimensions.depth)} mm`
              : `${doorBayClearW} mm Bölme Kapağı`;

            return (
              <div
                ref={doorPopoverDomRef}
                data-floating-card="door"
                data-testid="viewport-3d-floating-door-card"
                onClick={(e) => e.stopPropagation()}
                style={{
                  left: "0px",
                  top: "0px",
                  transform: floatingPanelPos.door
                    ? `translate3d(${floatingPanelPos.door.x}px, ${floatingPanelPos.door.y}px, 0)`
                    : "translate3d(-9999px, -9999px, 0)",
                }}
                className={`absolute top-0 left-0 z-[25] w-72 birim-ice-popover rounded-[26px] p-3.5 space-y-2.5 text-xs text-[#141413] transition-opacity duration-150 ${
                  isDraggingItemOver3D ? "opacity-15 pointer-events-none" : "pointer-events-auto"
                }`}
              >
                {/* Header Bar */}
                <div
                  onPointerDown={(e) => startFloatingPanelDrag("door", e)}
                  title="Paneli taşımak için başlığı tutup sürükleyin"
                  className="flex items-center justify-between gap-2 pb-2 border-b border-[#E5E0D5] cursor-move select-none"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[#8C7A6B] font-bold text-xs">⠿</span>
                    <span className="font-bold text-[13px] text-[#141413]">
                      {targetBayIdx + 1}. Bölme
                    </span>
                    <span className="px-1.5 py-0.5 rounded-md bg-[#EFECE5] text-[#44403C] font-mono text-[10px] font-semibold">
                      {doorBayClearW} mm
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setFloatingPanelPos((prev) => ({ ...prev, door: null }));
                        setDockedToCorner((d) => !d);
                        needsRenderRef.current = true;
                      }}
                      title={
                        dockedToCorner
                          ? "Dolap yanına yaklaştır"
                          : "Sağ üst köşeye sabitle (dolabı kapatmasın)"
                      }
                      className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold border transition cursor-pointer ${
                        dockedToCorner
                          ? "bg-[#141413] text-white border-[#141413]"
                          : "bg-white text-[#57534E] border-[#DED8CC] hover:bg-[#EFECE5]"
                      }`}
                    >
                      Sabit
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setCollapsedFloatingPanels((prev) => ({ ...prev, door: !prev.door }))
                      }
                      title={collapsedFloatingPanels.door ? "Genişlet" : "Küçült"}
                      className="w-6 h-6 rounded-md bg-white hover:bg-[#EFECE5] border border-[#DED8CC] text-[#44403C] font-bold text-[11px] flex items-center justify-center cursor-pointer"
                    >
                      {collapsedFloatingPanels.door ? "+" : "—"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setClicked3DContext(null);
                        setDoorMenuSubSection(null);
                      }}
                      title="Menüyü kapat"
                      className="w-6 h-6 rounded-md hover:bg-[#EFECE5] text-[#78716C] hover:text-[#141413] text-xs flex items-center justify-center cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {!collapsedFloatingPanels.door && (
                  <div className="space-y-2">
                    {/* Quick Mode Tabs: Switch directly between Door Settings & Compartment Interior */}
                    <div className="grid grid-cols-2 gap-1 p-0.5 rounded-xl bg-[#EFECE5] border border-[#DED8CC]">
                      <button
                        type="button"
                        className="py-1 px-2 rounded-lg bg-[#141413] text-white text-[10px] font-semibold shadow-2xs cursor-pointer"
                      >
                        Kapak Ayarları
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveBayIndex(targetBayIdx);
                          setDismissedBayPopover(false);
                          setCutawayActiveBay(true);
                          setClicked3DContext({
                            kind: "bay",
                            bayIndex: targetBayIdx,
                            role: "bay_compartment",
                            label: `Bölme ${targetBayIdx + 1}`,
                          });
                        }}
                        className="py-1 px-2 rounded-lg text-[#44403C] hover:text-[#141413] hover:bg-white/70 text-[10px] font-semibold transition cursor-pointer"
                      >
                        Bölme İç Düzeni
                      </button>
                    </div>

                    {/* Full-Width Module & Selected Door Info (Zero Truncation!) */}
                    <div className="p-2 rounded-xl bg-white border border-[#E5E0D5] space-y-1.5">
                      <div className="text-[10px] text-[#78716C] font-medium leading-snug break-words">
                        Modül #{activeModuleIndex + 1} • {activeModule.name} (
                        {Math.round(activeModule.dimensions.width / 10)}×
                        {Math.round(activeModule.dimensions.height / 10)} cm)
                      </div>
                      <div className="pt-1.5 border-t border-[#F2EFE9] flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-[9px] uppercase tracking-wider font-semibold text-[#8C7A6B]">
                            Seçili Parça
                          </div>
                          <div className="text-[11px] font-bold text-[#141413] leading-snug break-words">
                            {fullDoorPartName}
                          </div>
                          <div className="text-[10px] font-mono text-[#78716C] mt-0.5">
                            {doorDimsLabel}
                          </div>
                        </div>
                        {targetBay?.door?.type !== "open" && (
                          <button
                            type="button"
                            data-testid="floating-card-delete-selected-part"
                            onClick={() => {
                              setBayDoorType(targetBayIdx, "open");
                              setClicked3DContext({
                                kind: "bay",
                                bayIndex: targetBayIdx,
                                role: "bay_compartment",
                                label: `Bölme ${targetBayIdx + 1}`,
                              });
                              setSnapBannerDedup(
                                `${targetBayIdx + 1}. Bölme kapağı kaldırıldı (Açık bölme)`
                              );
                              setTimeout(() => setSnapBannerDedup(null), 2200);
                            }}
                            title="Sadece bu bölmenin kapağını kaldırıp açık raf düzenine çevirir"
                            className="shrink-0 px-2 py-1 rounded-lg bg-[#FAF9F6] hover:bg-red-50 border border-[#DED8CC] hover:border-red-200 text-[10px] font-semibold text-[#57534E] hover:text-red-700 transition cursor-pointer"
                          >
                            Kapağı Kaldır
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 1. Kapak Tipini Değiştir */}
                    <button
                      type="button"
                      data-testid="floating-door-change-type"
                      onClick={() =>
                        setDoorMenuSubSection((prev) => (prev === "type" ? null : "type"))
                      }
                      className="w-full px-2.5 py-1.5 rounded-xl bg-white hover:bg-[#EFECE5] border border-[#E5E0D5] text-[#141413] font-semibold flex items-center justify-between gap-2 text-left transition cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <svg className="w-3.5 h-3.5 text-[#57534E] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <rect x="4" y="3" width="16" height="18" rx="2" />
                          <path d="M9 3v18" />
                        </svg>
                        <span>Kapak Modeli</span>
                      </span>
                      <span className="text-[10px] text-[#78716C]">›</span>
                    </button>
                    {doorMenuSubSection === "type" && (
                      <div className="grid grid-cols-3 gap-1 p-1.5 rounded-xl bg-white border border-[#E5E0D5]">
                        {[
                          { id: "flat_slab", label: "Düz Kapak" },
                          { id: "shaker_frame", label: "Çerçeve" },
                          { id: "fluted_ribbed", label: "Fitilli" },
                          { id: "bevel_45", label: "45° Pahlı" },
                          { id: "glass_frame", label: "Füme Cam" },
                          { id: "mirror_door", label: "Aynalı" },
                        ].map((pt) => (
                          <button
                            key={pt.id}
                            type="button"
                            data-testid={`floating-door-type-${pt.id}`}
                            onClick={() => {
                              setBayV4DoorConfig(targetBayIdx, {
                                crossSectionProfile: pt.id as import("@birim/core").DoorCrossSectionProfile,
                                isGlassFramed: pt.id === "glass_frame",
                              });
                            }}
                            className={`py-1 px-0.5 rounded-lg text-[10px] font-semibold transition cursor-pointer ${
                              curDoorProf === pt.id
                                ? "bg-[#141413] text-white"
                                : "bg-[#FAF9F6] hover:bg-[#EFECE5] text-[#141413] border border-[#DED8CC]"
                            }`}
                          >
                            {pt.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* 2. Açılma Yönü */}
                    <button
                      type="button"
                      data-testid="floating-door-change-direction"
                      onClick={() =>
                        setDoorMenuSubSection((prev) => (prev === "direction" ? null : "direction"))
                      }
                      className="w-full px-2.5 py-1.5 rounded-xl bg-white hover:bg-[#EFECE5] border border-[#E5E0D5] text-[#141413] font-semibold flex items-center justify-between gap-2 text-left transition cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <svg className="w-3.5 h-3.5 text-[#57534E] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M4 12h16M15 7l5 5-5 5" />
                        </svg>
                        <span>Açılma Yönü</span>
                      </span>
                      <span className="text-[10px] text-[#78716C]">
                        {targetBay?.door?.type === "double"
                          ? "Çift Kapak"
                          : targetBay?.door?.type === "single_right"
                          ? "Sağ"
                          : "Sol"}
                      </span>
                    </button>
                    {doorMenuSubSection === "direction" && (
                      <div className="space-y-1.5 p-1.5 rounded-xl bg-white border border-[#E5E0D5]">
                        <div className="grid grid-cols-4 gap-1">
                          {[
                            { id: "single_left", label: "Sol" },
                            { id: "single_right", label: "Sağ" },
                            { id: "double", label: "Çift" },
                            { id: "sliding", label: "Sürgü" },
                          ].map((dir) => (
                            <button
                              key={dir.id}
                              type="button"
                              data-testid={`floating-door-dir-${dir.id}`}
                              onClick={() =>
                                setBayDoorType(
                                  targetBayIdx,
                                  dir.id as "single_left" | "single_right" | "double" | "sliding"
                                )
                              }
                              className={`py-1 px-1 rounded-lg text-[10px] font-semibold transition cursor-pointer ${
                                targetBay?.door?.type === dir.id
                                  ? "bg-[#141413] text-white"
                                  : "bg-[#FAF9F6] hover:bg-[#EFECE5] text-[#141413] border border-[#DED8CC]"
                              }`}
                            >
                              {dir.label}
                            </button>
                          ))}
                        </div>
                        {(targetBay?.door?.type === "sliding" ||
                          targetBay?.door?.doorSystemId?.startsWith("sliding")) && (
                          <div className="grid grid-cols-2 gap-1 pt-1 border-t border-[#EFECE5]">
                            {[
                              { id: "inset_inside" as const, label: "İçten Raylı" },
                              { id: "top_hung_exposed" as const, label: "Üstten Askılı" },
                              { id: "top_hung_pelmet" as const, label: "Üstü Kapalı" },
                              { id: "coplanar_flush" as const, label: "Hemzemin" },
                            ].map((sm) => {
                              const curM = targetBay?.door?.slidingMountingType || "top_hung_pelmet";
                              return (
                                <button
                                  key={sm.id}
                                  type="button"
                                  onClick={() => setModuleSlidingMountingType(sm.id)}
                                  className={`py-1 px-1.5 rounded-lg text-[9.5px] font-semibold transition cursor-pointer ${
                                    curM === sm.id
                                      ? "bg-[#141413] text-white"
                                      : "bg-[#FAF9F6] hover:bg-[#EFECE5] text-[#44403C] border border-[#DED8CC]"
                                  }`}
                                >
                                  {sm.label}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 3. Kulp Değiştir */}
                    <button
                      type="button"
                      data-testid="floating-door-change-handle"
                      onClick={() =>
                        setDoorMenuSubSection((prev) => (prev === "handle" ? null : "handle"))
                      }
                      className="w-full px-2.5 py-1.5 rounded-xl bg-white hover:bg-[#EFECE5] border border-[#E5E0D5] text-[#141413] font-semibold flex items-center justify-between gap-2 text-left transition cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <svg className="w-3.5 h-3.5 text-[#57534E] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M6 18L18 6M8 6h10v10" />
                        </svg>
                        <span>Kulp Seçimi</span>
                      </span>
                      <span className="text-[10px] font-mono text-[#78716C]">{curHandleSku}</span>
                    </button>
                    {doorMenuSubSection === "handle" && (
                      <div className="grid grid-cols-2 gap-1 p-1.5 rounded-xl bg-white border border-[#E5E0D5]">
                        {[
                          { sku: "K019", label: "K019 Mat Siyah", mat: "mat_handle_matte_black", cat: "bar_handle" as const },
                          { sku: "K020", label: "K020 Inox", mat: "mat_handle_inox", cat: "bar_handle" as const },
                          { sku: "K021", label: "K021 Pirinç", mat: "mat_handle_brass", cat: "bar_handle" as const },
                          { sku: "K022", label: "K022 Antrasit", mat: "mat_handle_anthracite", cat: "bar_handle" as const },
                        ].map((hk) => (
                          <button
                            key={hk.sku}
                            type="button"
                            data-testid={`floating-door-handle-${hk.sku}`}
                            onClick={() =>
                              setBayV4DoorConfig(targetBayIdx, {
                                handleCategory: hk.cat,
                                handleProfileId: hk.sku,
                                handleMaterialId: hk.mat,
                              })
                            }
                            className={`py-1 px-1.5 rounded-lg text-[10px] font-semibold transition cursor-pointer ${
                              curHandleSku === hk.sku
                                ? "bg-[#141413] text-white"
                                : "bg-[#FAF9F6] hover:bg-[#EFECE5] text-[#141413] border border-[#DED8CC]"
                            }`}
                          >
                            {hk.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* 4. Kapak Malzemesi */}
                    <button
                      type="button"
                      data-testid="floating-door-change-material"
                      onClick={() =>
                        setDoorMenuSubSection((prev) => (prev === "material" ? null : "material"))
                      }
                      className="w-full px-2.5 py-1.5 rounded-xl bg-white hover:bg-[#EFECE5] border border-[#E5E0D5] text-[#141413] font-semibold flex items-center justify-between gap-2 text-left transition cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <svg className="w-3.5 h-3.5 text-[#57534E] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <circle cx="12" cy="12" r="9" />
                          <circle cx="12" cy="8" r="1.5" fill="currentColor" />
                          <circle cx="8.5" cy="13" r="1.5" fill="currentColor" />
                          <circle cx="15.5" cy="13" r="1.5" fill="currentColor" />
                        </svg>
                        <span>Kapak Rengi &amp; Uygulama Kapsamı</span>
                      </span>
                      <span className="text-[10px] text-[#78716C]">›</span>
                    </button>
                    {doorMenuSubSection === "material" && (
                      <div className="p-2 rounded-xl bg-white border border-[#E5E0D5] space-y-2">
                        <div className="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-[#F4F1EA]">
                          {[
                            { id: "single" as const, lbl: "Bu Kapak" },
                            { id: "module_similar" as const, lbl: "Modül Kapakları" },
                            { id: "project_similar" as const, lbl: "Tüm Dolaplar" },
                          ].map((sc) => (
                            <button
                              key={sc.id}
                              type="button"
                              onClick={() => setFloatingMatScope(sc.id)}
                              className={`py-1 px-1 rounded-md text-[9.5px] font-bold transition cursor-pointer ${
                                floatingMatScope === sc.id
                                  ? "bg-[#141413] text-white"
                                  : "text-[#57534E] hover:text-[#141413]"
                              }`}
                            >
                              {sc.lbl}
                            </button>
                          ))}
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                          {DEFAULT_MATERIALS.filter(
                            (m) =>
                              m.category === "wood" ||
                              m.category === "lacquer" ||
                              m.category === "laminate" ||
                              m.category === "glass" ||
                              m.category === "mirror"
                          )
                            .slice(0, 8)
                            .map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                data-testid={`floating-door-mat-${m.id}`}
                                onClick={() => {
                                  applyMaterialToSimilarComponents(m.id, targetDoorCompId, floatingMatScope);
                                  const scopeText =
                                    floatingMatScope === "project_similar"
                                      ? "Tüm dolap kapaklarına"
                                      : floatingMatScope === "module_similar"
                                      ? "Modüldeki tüm kapaklara"
                                      : fullDoorPartName;
                                  setSnapBannerDedup(
                                    `${scopeText}: "${m.name.split(" (")[0]}" uygulandı`
                                  );
                                  setTimeout(() => setSnapBannerDedup(null), 2200);
                                }}
                                className="p-1.5 rounded-lg bg-[#FAF9F6] hover:bg-[#EFECE5] border border-[#DED8CC] flex items-center gap-1.5 text-[10px] font-medium text-[#141413] text-left cursor-pointer"
                                title={m.name}
                              >
                                <span
                                  className="w-3.5 h-3.5 rounded-xs border border-stone-300 shrink-0"
                                  style={{ backgroundColor: m.colorHex }}
                                />
                                <span className="truncate">{m.name.split(" (")[0]}</span>
                              </button>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* 5. Bu Kapağı Tümüne Uygula + Kapak Aç/İçini Gör */}
                    <div className="grid grid-cols-3 gap-1">
                      <button
                        type="button"
                        data-testid="floating-door-copy-to-all"
                        onClick={() => {
                          copyDoorConfigToAllBays(targetBayIdx);
                          setSnapBannerDedup(
                            "Seçili kapak modeli ve kulp tüm bölmelere uygulandı"
                          );
                          setTimeout(() => setSnapBannerDedup(null), 2400);
                        }}
                        className="py-1.5 px-1.5 rounded-lg bg-white hover:bg-[#EFECE5] border border-[#DED8CC] text-[10px] font-semibold text-[#141413] cursor-pointer"
                        title="Bu kapağın model, kulp ve renk ayarlarını tüm kapaklara kopyalar"
                      >
                        Tümüne Kopyala
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleDoorOpen()}
                        className="py-1.5 px-1.5 rounded-lg bg-white hover:bg-[#EFECE5] border border-[#DED8CC] text-[10px] font-semibold text-[#141413] cursor-pointer"
                      >
                        {doorOpenAngleDeg > 0 ? "Kapağı Kapat" : "Kapağı Aç"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDoorsHiddenIn3D(true);
                          setClicked3DContext({
                            kind: "bay",
                            bayIndex: targetBayIdx,
                            role: "bay_compartment",
                            label: `Bölme ${targetBayIdx + 1}`,
                          });
                        }}
                        className="py-1.5 px-1.5 rounded-lg bg-white hover:bg-[#EFECE5] border border-[#DED8CC] text-[10px] font-semibold text-[#44403C] cursor-pointer"
                      >
                        İçini Göster
                      </button>
                    </div>

                    {/* 6. BÖLME İŞLEMLERİ (Directly accessible even when clicking a door!) */}
                    {(activeModule.bays.length > 1 ||
                      (targetBay?.door?.type === "double" && doorBayClearW >= 760)) && (
                      <div className="pt-2 border-t border-[#E5E0D5] space-y-1">
                        <div className="text-[9px] uppercase tracking-wider font-semibold text-[#8C7A6B] px-0.5">
                          {targetBayIdx + 1}. Bölme İşlemleri
                        </div>
                        {targetBay?.door?.type === "double" && doorBayClearW >= 760 && (
                          <button
                            type="button"
                            data-testid="floating-door-shrink-double"
                            onClick={() => {
                              shrinkDoubleBayToSingle(targetBayIdx);
                              setClicked3DContext(null);
                              setSnapBannerDedup(
                                `${targetBayIdx + 1}. Bölme tek kapağa düşürüldü (Dolap ${halfShrunkOuterCmDoor} cm oldu)`
                              );
                              setTimeout(() => setSnapBannerDedup(null), 2500);
                            }}
                            className="w-full px-2.5 py-1.5 rounded-xl bg-white hover:bg-[#EFECE5] border border-[#DED8CC] text-left transition cursor-pointer"
                          >
                            <div className="text-[11px] font-semibold text-[#141413]">
                              Çift Kapağı Tek Kapağa Düşür
                            </div>
                            <div className="text-[9.5px] text-[#78716C]">
                              1 kapak eksilir • Dolap ~{halfShrunkOuterCmDoor} cm genişliğe iner
                            </div>
                          </button>
                        )}
                        {activeModule.bays.length > 1 && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                removeBayAt(targetBayIdx);
                                setClicked3DContext(null);
                                setSnapBannerDedup(
                                  `${targetBayIdx + 1}. Bölme komşu bölmeyle birleştirildi (${Math.round(activeModule.dimensions.width / 10)} cm sabit)`
                                );
                                setTimeout(() => setSnapBannerDedup(null), 2500);
                              }}
                              className="w-full px-2.5 py-1.5 rounded-xl bg-white hover:bg-[#EFECE5] border border-[#DED8CC] text-left transition cursor-pointer"
                            >
                              <div className="text-[11px] font-semibold text-[#141413]">
                                Yan Bölmeyle Birleştir (Dikme Sil)
                              </div>
                              <div className="text-[9.5px] text-[#78716C]">
                                Ara dikme kalkar • Dış ölçü {Math.round(activeModule.dimensions.width / 10)} cm sabit kalır
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                removeBayAndShrinkModule(targetBayIdx);
                                setClicked3DContext(null);
                                setSnapBannerDedup(
                                  `${targetBayIdx + 1}. Bölme çıkarıldı (Dolap ${shrunkOuterCmDoor} cm genişliğe daraltıldı)`
                                );
                                setTimeout(() => setSnapBannerDedup(null), 2500);
                              }}
                              className="w-full px-2.5 py-1.5 rounded-xl bg-white hover:bg-red-50 border border-[#E5E0D5] hover:border-red-200 text-left transition cursor-pointer"
                            >
                              <div className="text-[11px] font-semibold text-red-700">
                                {targetBayIdx + 1}. Bölmeyi Sil ve Dolabı Daralt
                              </div>
                              <div className="text-[9.5px] text-[#78716C]">
                                Bölme + kapağı çıkarılır • Dolap ~{shrunkOuterCmDoor} cm&apos;e iner
                              </div>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

        {/* FLOATING 3D COMPARTMENT POPOVER CARD (Architectural B1R1M Style, w-72 Zero-Truncation, Distinct Part vs Bay Deletion!) */}
        {!minimalChrome &&
          showInCanvasHud &&
          !isRightInspectorOpen &&
          !dismissedBayPopover &&
          !(clicked3DContext?.kind === "door" && !doorsHiddenIn3D) &&
          (cutawayActiveBay || doorsHiddenIn3D || clicked3DContext?.kind === "bay") &&
          (() => {
            const fourSpaceBay = calculateFourSpaceDimensions(activeModule);
            const bayClearW =
              fourSpaceBay.usableInternal.bayClearWidthsMm[activeBayIndex] || 600;
            const panelTBay = activeModule.carcass.panelThickness || 18;
            const shrunkOuterCm = Math.max(
              35,
              Math.round((activeModule.dimensions.width - (bayClearW + panelTBay)) / 10)
            );
            const halfShrunkOuterCm = Math.max(
              40,
              Math.round((activeModule.dimensions.width - Math.round(bayClearW * 0.5)) / 10)
            );
            const curBayObj = activeModule.bays[activeBayIndex];
            const bdSel = selectedComponentId
              ? generateModuleGeometry(activeModule, { doorOpenAngleDeg: 0 })
              : null;
            const selPart = bdSel
              ? bdSel.components.find((c) => c.id === selectedComponentId)
              : undefined;
            const selRole = selPart?.role || "";
            const isRemovableInteriorPart =
              selRole === "shelf" ||
              selRole.startsWith("drawer_") ||
              selRole === "hanging_rail" ||
              selRole === "special_fitting" ||
              selRole === "carcass_sub_divider";
            const isRemovableDivider =
              selRole === "carcass_divider" && activeModule.bays.length > 1;
            const isDoorPart = selRole === "door_left" || selRole === "door_right";

            return (
              <div
                ref={bayPopoverDomRef}
                data-floating-card="bay"
                data-testid="viewport-3d-floating-bay-card"
                onClick={(e) => e.stopPropagation()}
                style={{
                  left: "0px",
                  top: "0px",
                  transform: floatingPanelPos.bay
                    ? `translate3d(${floatingPanelPos.bay.x}px, ${floatingPanelPos.bay.y}px, 0)`
                    : "translate3d(-9999px, -9999px, 0)",
                }}
                className={`absolute top-0 left-0 z-[15] w-72 birim-ice-popover rounded-[26px] p-3.5 space-y-2.5 text-xs text-[#141413] transition-opacity duration-150 ${
                  isDraggingItemOver3D ? "opacity-15 pointer-events-none" : "pointer-events-auto"
                }`}
              >
                {/* Header */}
                <div
                  onPointerDown={(e) => startFloatingPanelDrag("bay", e)}
                  title="Paneli taşımak için başlığı tutup sürükleyin"
                  className="flex items-center justify-between gap-2 pb-2 border-b border-[#E5E0D5] cursor-move select-none"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[#8C7A6B] font-bold text-xs">⠿</span>
                    <span className="font-bold text-[13px] text-[#141413]">
                      {activeBayIndex + 1}. Bölme
                    </span>
                    <span className="px-1.5 py-0.5 rounded-md bg-[#EFECE5] text-[#44403C] font-mono text-[10px] font-semibold">
                      {bayClearW} mm
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setFloatingPanelPos((prev) => ({ ...prev, bay: null }));
                        setDockedToCorner((d) => !d);
                        needsRenderRef.current = true;
                      }}
                      title={
                        dockedToCorner
                          ? "Dolap yanına yaklaştır"
                          : "Sağ üst köşeye sabitle (dolabı kapatmasın)"
                      }
                      className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold border transition cursor-pointer ${
                        dockedToCorner
                          ? "bg-[#141413] text-white border-[#141413]"
                          : "bg-white text-[#57534E] border-[#DED8CC] hover:bg-[#EFECE5]"
                      }`}
                    >
                      Sabit
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setCollapsedFloatingPanels((prev) => ({ ...prev, bay: !prev.bay }))
                      }
                      title={collapsedFloatingPanels.bay ? "Genişlet" : "Küçült"}
                      className="w-6 h-6 rounded-md bg-white hover:bg-[#EFECE5] border border-[#DED8CC] text-[#44403C] font-bold text-[11px] flex items-center justify-center cursor-pointer"
                    >
                      {collapsedFloatingPanels.bay ? "+" : "—"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDismissedBayPopover(true);
                        setCutawayActiveBay(false);
                        setBayMenuSubSection(null);
                      }}
                      title="Bölme menüsünü kapat"
                      className="w-6 h-6 rounded-md hover:bg-[#EFECE5] text-[#78716C] hover:text-[#141413] text-xs flex items-center justify-center cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {!collapsedFloatingPanels.bay && (
                  <div className="space-y-2">
                    {/* Optional Door Switcher Tab when bay has a door */}
                    {!activeModule.isOpenFront && curBayObj?.door?.type !== "open" && (
                      <div className="grid grid-cols-2 gap-1 p-0.5 rounded-xl bg-[#EFECE5] border border-[#DED8CC]">
                        <button
                          type="button"
                          className="py-1 px-2 rounded-lg bg-[#141413] text-white text-[10px] font-semibold shadow-2xs cursor-pointer"
                        >
                          Bölme İç Düzeni
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDoorsHiddenIn3D(false);
                            setClicked3DContext({
                              kind: "door",
                              bayIndex: activeBayIndex,
                              role: "door_left",
                              componentId: `${curBayObj?.door?.id || `${activeModule.id}_door_${activeBayIndex}`}_left`,
                              label: `Bölme ${activeBayIndex + 1} • Kapak`,
                            });
                          }}
                          className="py-1 px-2 rounded-lg text-[#44403C] hover:text-[#141413] hover:bg-white/70 text-[10px] font-semibold transition cursor-pointer"
                        >
                          Kapak Ayarları
                        </button>
                      </div>
                    )}

                    {/* Full-Width Untruncated Module & Selected Part Box */}
                    <div className="p-2 rounded-xl bg-white border border-[#E5E0D5] space-y-1.5">
                      <div className="text-[10px] text-[#78716C] font-medium leading-snug break-words">
                        Modül #{activeModuleIndex + 1} • {activeModule.name} (
                        {Math.round(activeModule.dimensions.width / 10)}×
                        {Math.round(activeModule.dimensions.height / 10)} cm)
                      </div>
                      {selPart && (
                        <div className="pt-1.5 border-t border-[#F2EFE9] flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-[9px] uppercase tracking-wider font-semibold text-[#8C7A6B]">
                              Tıklanan Parça
                            </div>
                            <div className="text-[11px] font-bold text-[#141413] leading-snug break-words">
                              {selPart.label.split(" (")[0]}
                            </div>
                            <div className="text-[10px] font-mono text-[#78716C] mt-0.5">
                              {Math.round(selPart.dimensions.width)} ×{" "}
                              {Math.round(selPart.dimensions.height)} ×{" "}
                              {Math.round(selPart.dimensions.depth)} mm
                            </div>
                          </div>
                          {isRemovableInteriorPart ? (
                            <button
                              type="button"
                              data-testid="floating-card-delete-selected-part"
                              onClick={() => {
                                const labelShort = selPart.label.split(" (")[0];
                                if (removeSelectedInteriorComponent()) {
                                  setSnapBannerDedup(`"${labelShort}" parçası silindi`);
                                  setTimeout(() => setSnapBannerDedup(null), 2200);
                                }
                              }}
                              title="Sadece seçili iç parçayı siler (bölmeyi silmez)"
                              className="shrink-0 px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 text-[10px] font-semibold text-red-700 transition cursor-pointer"
                            >
                              Parçayı Sil
                            </button>
                          ) : isRemovableDivider ? (
                            <button
                              type="button"
                              data-testid="floating-card-delete-selected-part"
                              onClick={() => {
                                removeBayAt(activeBayIndex);
                                setSnapBannerDedup("Ara dikme kaldırıldı ve bölmeler birleştirildi");
                                setTimeout(() => setSnapBannerDedup(null), 2200);
                              }}
                              className="shrink-0 px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 text-[10px] font-semibold text-red-700 transition cursor-pointer"
                            >
                              Dikmeyi Sil
                            </button>
                          ) : isDoorPart ? (
                            <button
                              type="button"
                              data-testid="floating-card-delete-selected-part"
                              onClick={() => {
                                setBayDoorType(activeBayIndex, "open");
                                setSnapBannerDedup(
                                  `${activeBayIndex + 1}. Bölme kapağı kaldırıldı`
                                );
                                setTimeout(() => setSnapBannerDedup(null), 2200);
                              }}
                              className="shrink-0 px-2 py-1 rounded-lg bg-[#FAF9F6] hover:bg-red-50 border border-[#DED8CC] text-[10px] font-semibold text-[#57534E] hover:text-red-700 transition cursor-pointer"
                            >
                              Kapağı Kaldır
                            </button>
                          ) : (
                            <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-[#EFECE5] text-[#57534E] text-[9.5px] font-semibold">
                              Sabit Gövde
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Add Interior Items Grid */}
                    <div className="px-0.5 text-[10px] font-semibold text-[#78716C] flex items-center justify-between">
                      <span>İç Parça Ekle (Sürükle veya Tıkla)</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        {
                          id: "lib_shelf",
                          testId: "floating-bay-add-shelf",
                          title: "Raf",
                          visual: "shelf",
                          onClick: () => addShelf(activeBayIndex),
                          icon: (
                            <svg viewBox="0 0 40 28" className="w-7 h-5 pointer-events-none" fill="none">
                              <polygon points="4,14 14,7 36,10 26,17" fill="#E5D3B3" stroke="#8C6D46" strokeWidth="1.4" />
                              <polygon points="4,14 26,17 26,21 4,18" fill="#C8AD82" stroke="#8C6D46" strokeWidth="1.4" />
                            </svg>
                          ),
                        },
                        {
                          id: "lib_drawer",
                          testId: "floating-bay-add-drawer",
                          title: "Çekmece",
                          visual: "drawer",
                          onClick: () => addDrawer(activeBayIndex),
                          icon: (
                            <svg viewBox="0 0 40 28" className="w-7 h-5 pointer-events-none" fill="none">
                              <polygon points="6,10 28,13 28,23 6,20" fill="#E5D3B3" stroke="#785A37" strokeWidth="1.3" />
                              <line x1="13" y1="15.5" x2="21" y2="16.5" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                          ),
                        },
                        {
                          id: "lib_rail",
                          testId: "floating-bay-add-rail",
                          title: "Askılık",
                          visual: "rail",
                          onClick: () => addHangingRail(activeBayIndex),
                          icon: (
                            <svg viewBox="0 0 40 28" className="w-7 h-5 pointer-events-none" fill="none">
                              <line x1="6" y1="8" x2="34" y2="8" stroke="#64748B" strokeWidth="3" strokeLinecap="round" />
                              <polygon points="20,11 13,20 27,20" fill="#D6B88E" stroke="#8C6D46" strokeWidth="1.2" />
                            </svg>
                          ),
                        },
                        {
                          id: "lib_sub_divider",
                          testId: "floating-bay-add-subdivider",
                          title: "Raf Dikmesi",
                          visual: "sub_divider",
                          onClick: () => addSubDivider(activeBayIndex),
                          icon: (
                            <svg viewBox="0 0 40 28" className="w-7 h-5 pointer-events-none" fill="none">
                              <rect x="6" y="4" width="28" height="3" fill="#CBD5E1" stroke="#475569" strokeWidth="1.1" />
                              <rect x="6" y="21" width="28" height="3" fill="#CBD5E1" stroke="#475569" strokeWidth="1.1" />
                              <rect x="18" y="7" width="4" height="14" fill="#8C7A6B" stroke="#44403C" strokeWidth="1.3" />
                            </svg>
                          ),
                        },
                        {
                          id: "lib_carcass_divider",
                          testId: "floating-bay-split-carcass",
                          title: "2'ye Böl",
                          visual: "carcass_divider",
                          onClick: () => splitBayIntoTwo(activeBayIndex),
                          icon: (
                            <svg viewBox="0 0 40 28" className="w-7 h-5 pointer-events-none" fill="none">
                              <rect x="6" y="3" width="28" height="22" rx="1.5" fill="#FAF9F6" stroke="#44403C" strokeWidth="1.3" />
                              <rect x="18.5" y="3" width="3" height="22" fill="#141413" />
                            </svg>
                          ),
                        },
                        {
                          id: "lib_trouser_rack",
                          testId: "floating-bay-add-trouser",
                          title: "Pantolonluk",
                          visual: "trouser_rack",
                          onClick: () => addSpecialFitting(activeBayIndex, "trouser_rack"),
                          icon: (
                            <svg viewBox="0 0 40 28" className="w-7 h-5 pointer-events-none" fill="none">
                              <polygon points="6,9 14,4 34,7 26,12" fill="none" stroke="#334155" strokeWidth="1.5" />
                              <rect x="12" y="10" width="5" height="12" fill="#D6C7B2" stroke="#44403C" strokeWidth="1" />
                              <rect x="21" y="11" width="5" height="12" fill="#E5E0D5" stroke="#44403C" strokeWidth="1" />
                            </svg>
                          ),
                        },
                      ].map((fItem) => (
                        <div
                          key={fItem.id}
                          role="button"
                          tabIndex={0}
                          data-testid={fItem.testId}
                          draggable={true}
                          onDragStart={(e) =>
                            startAccessorySilhouetteDrag(e, {
                              id: fItem.id,
                              visual: fItem.visual,
                              title: fItem.title,
                              cat: "all",
                              spec: fItem.title,
                            })
                          }
                          onDragEnd={() => {
                            if (typeof window !== "undefined") {
                              window.__birimActiveDraggedAccessory = null;
                            }
                          }}
                          onClick={fItem.onClick}
                          title={`${fItem.title} — Gövde üzerine sürükleyip bırakın veya tıklayın`}
                          className="p-1.5 rounded-xl bg-white hover:bg-[#EFECE5] border border-[#E5E0D5] hover:border-[#8C7A6B] flex flex-col items-center justify-center text-center gap-0.5 transition cursor-grab active:cursor-grabbing select-none"
                        >
                          <div className="pointer-events-none flex flex-col items-center gap-0.5">
                            {fItem.icon}
                            <span className="text-[10px] font-semibold text-[#141413] leading-tight">
                              {fItem.title}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Aksesuar & Şablon & Bölme Ayarları Compact Row */}
                    <div className="grid grid-cols-3 gap-1">
                      <button
                        type="button"
                        data-testid="floating-bay-add-accessory"
                        onClick={() =>
                          setBayMenuSubSection((prev) =>
                            prev === "accessories" ? null : "accessories"
                          )
                        }
                        className={`py-1.5 px-1.5 rounded-lg border text-[10px] font-semibold transition cursor-pointer ${
                          bayMenuSubSection === "accessories"
                            ? "bg-[#141413] text-white border-[#141413]"
                            : "bg-white hover:bg-[#EFECE5] text-[#141413] border-[#E5E0D5]"
                        }`}
                      >
                        + Aksesuar
                      </button>
                      <button
                        type="button"
                        data-testid="floating-bay-apply-template"
                        onClick={() =>
                          setBayMenuSubSection((prev) =>
                            prev === "templates" ? null : "templates"
                          )
                        }
                        className={`py-1.5 px-1.5 rounded-lg border text-[10px] font-semibold transition cursor-pointer ${
                          bayMenuSubSection === "templates"
                            ? "bg-[#141413] text-white border-[#141413]"
                            : "bg-white hover:bg-[#EFECE5] text-[#141413] border-[#E5E0D5]"
                        }`}
                      >
                        Hazır Şablon
                      </button>
                      <button
                        type="button"
                        data-testid="floating-bay-open-settings"
                        onClick={() => {
                          if (typeof window !== "undefined") {
                            window.dispatchEvent(
                              new CustomEvent("birim:select-bay-3d", {
                                detail: {
                                  bayIndex: activeBayIndex,
                                  role: "bay_compartment",
                                  moduleIndex: activeModuleIndex,
                                },
                              })
                            );
                          }
                        }}
                        className="py-1.5 px-1.5 rounded-lg bg-white hover:bg-[#EFECE5] border border-[#E5E0D5] text-[10px] font-semibold text-[#141413] transition cursor-pointer"
                      >
                        Detay Panel
                      </button>
                    </div>

                    {bayMenuSubSection === "accessories" && (
                      <div className="grid grid-cols-2 gap-1 p-1.5 rounded-xl bg-white border border-[#E5E0D5]">
                        {[
                          { type: "trouser_rack" as const, label: "Pantolonluk" },
                          { type: "shoe_rack" as const, label: "Ayakkabılık" },
                          { type: "tie_rack" as const, label: "Kravatlık" },
                          { type: "belt_rack" as const, label: "Kemerlik" },
                          { type: "wardrobe_lift" as const, label: "Asansör" },
                          { type: "wire_basket" as const, label: "Tel Sepet" },
                        ].map((acc) => (
                          <button
                            key={acc.type}
                            type="button"
                            data-testid={`floating-bay-acc-${acc.type}`}
                            onClick={() => {
                              addSpecialFitting(activeBayIndex, acc.type);
                              setBayMenuSubSection(null);
                            }}
                            className="py-1 px-1.5 rounded-lg bg-[#FAF9F6] hover:bg-[#EFECE5] text-[#141413] border border-[#DED8CC] text-[10px] font-semibold transition cursor-pointer text-left"
                          >
                            + {acc.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {bayMenuSubSection === "templates" && (
                      <div className="grid grid-cols-2 gap-1 p-1.5 rounded-xl bg-white border border-[#E5E0D5]">
                        {[
                          { id: "shirt_shelf" as const, label: "Gömlek + Raf" },
                          { id: "dress_drawer" as const, label: "Elbise + Çekmece" },
                          { id: "mixed_combo" as const, label: "Karma Düzen" },
                          { id: "shelves_5" as const, label: "5 Raflı İstif" },
                        ].map((tpl) => (
                          <button
                            key={tpl.id}
                            type="button"
                            data-testid={`floating-bay-tpl-${tpl.id}`}
                            onClick={() => {
                              applyBayInteriorPreset(activeBayIndex, tpl.id);
                              setBayMenuSubSection(null);
                            }}
                            className="py-1 px-2 rounded-lg bg-[#FAF9F6] hover:bg-[#EFECE5] text-[#141413] border border-[#DED8CC] text-[10px] font-semibold transition cursor-pointer text-left"
                          >
                            ✓ {tpl.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* CRYSTAL-CLEAR COMPARTMENT MERGE vs SHRINK-DELETE SECTION */}
                    {(activeModule.bays.length > 1 ||
                      (curBayObj?.door?.type === "double" && bayClearW >= 760)) && (
                      <div className="pt-2 border-t border-[#E5E0D5] space-y-1">
                        <div className="text-[9px] uppercase tracking-wider font-semibold text-[#8C7A6B] px-0.5">
                          {activeBayIndex + 1}. Bölme Silme / Birleştirme
                        </div>
                        {curBayObj?.door?.type === "double" && bayClearW >= 760 && (
                          <button
                            type="button"
                            data-testid="floating-bay-shrink-double"
                            onClick={() => {
                              shrinkDoubleBayToSingle(activeBayIndex);
                              setSnapBannerDedup(
                                `${activeBayIndex + 1}. Bölme tek kapağa düşürüldü (Dolap ${halfShrunkOuterCm} cm oldu)`
                              );
                              setTimeout(() => setSnapBannerDedup(null), 2500);
                            }}
                            className="w-full px-2.5 py-1.5 rounded-xl bg-white hover:bg-[#EFECE5] border border-[#DED8CC] text-left transition cursor-pointer"
                          >
                            <div className="text-[11px] font-semibold text-[#141413]">
                              Çift Kapağı Tek Kapağa Düşür
                            </div>
                            <div className="text-[9.5px] text-[#78716C]">
                              1 kapak eksilir • Dolap ~{halfShrunkOuterCm} cm genişliğe iner
                            </div>
                          </button>
                        )}
                        {activeModule.bays.length > 1 && (
                          <>
                            <button
                              type="button"
                              data-testid="floating-bay-merge-bay"
                              onClick={() => {
                                removeBayAt(activeBayIndex);
                                setSnapBannerDedup(
                                  `${activeBayIndex + 1}. Bölme komşu bölmeyle birleştirildi (${Math.round(activeModule.dimensions.width / 10)} cm sabit)`
                                );
                                setTimeout(() => setSnapBannerDedup(null), 2400);
                              }}
                              className="w-full px-2.5 py-1.5 rounded-xl bg-white hover:bg-[#EFECE5] border border-[#DED8CC] text-left transition cursor-pointer"
                            >
                              <div className="text-[11px] font-semibold text-[#141413]">
                                Yan Bölmeyle Birleştir (Dikme Sil)
                              </div>
                              <div className="text-[9.5px] text-[#78716C]">
                                Ara dikme kalkar • Dış ölçü {Math.round(activeModule.dimensions.width / 10)} cm sabit kalır
                              </div>
                            </button>
                            <button
                              type="button"
                              data-testid="floating-bay-delete-bay"
                              onClick={() => {
                                removeBayAndShrinkModule(activeBayIndex);
                                setSnapBannerDedup(
                                  `${activeBayIndex + 1}. Bölme çıkarıldı (Dolap ${shrunkOuterCm} cm genişliğe daraltıldı)`
                                );
                                setTimeout(() => setSnapBannerDedup(null), 2400);
                              }}
                              className="w-full px-2.5 py-1.5 rounded-xl bg-white hover:bg-red-50 border border-[#E5E0D5] hover:border-red-200 text-left transition cursor-pointer"
                            >
                              <div className="text-[11px] font-semibold text-red-700">
                                {activeBayIndex + 1}. Bölmeyi Sil ve Dolabı Daralt
                              </div>
                              <div className="text-[9.5px] text-[#78716C]">
                                Bölme + kapağı çıkarılır • Dolap ~{shrunkOuterCm} cm&apos;e iner
                              </div>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
    </>
  );
};
