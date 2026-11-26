"use client";

import { createPortal } from "react-dom";
import React, { useState, useMemo, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, X, SlidersHorizontal, Plus, Minus, Trash2, Sparkles, Copy, RotateCw, ArrowUpFromLine, MoreHorizontal, Scissors, BookmarkPlus, Columns2, FlipHorizontal2 } from "lucide-react";
import { calculateFourSpaceDimensions, getCompatibleInteriorElementsForModuleBay, type CompatibleInteriorElementKey, type DoorCrossSectionProfile, type EngineeringValidationFinding, type FixedShelfConnectorType, type HandleCategory, type HangingRailConfig, type MaterialDefinition, type ModuleInstance, type RemediationProposal, type SpecialFittingConfig } from "@birim/core";
import type { HandleProfileDefinition } from "@birim/catalog";
import { useConfiguratorStore, type UserExperienceTier } from "../store/useConfiguratorStore";
import { V11_INTERIOR_PRESETS, filterMaterialsByGroup, formatFindingForTier, type V11InspectorTab, type V11MaterialGroup } from "./v11Constants";
import { type CustomDoorProfilePreset } from "./CustomDoorSketchEditor";
import { getBayShelfIntervalsForSubDivider } from "../v3/adapter/useV3Adapter";
import { InspectorSelectedPartCard } from "./InspectorSelectedPartCard";
import { RightHardwareLibraryPanel } from "./RightHardwareLibraryPanel";
import { renderPresetSvg, renderInteriorItemSvg, type InteriorVisualKind } from "./inspector/inspectorSvgIcons";
import { startLive3DPartGrab } from "./inspector/inspectorLiveDrag";
import { StudioSelect } from "./inspector/InspectorControls";
import { InspectorDimensionsTab } from "./inspector/InspectorDimensionsTab";
import { InspectorDoorsTab } from "./inspector/InspectorDoorsTab";
import { InspectorMaterialsTab } from "./inspector/InspectorMaterialsTab";
import { InspectorInternalDrawerBlindCard, InspectorDrawerBoxSystemCard, InspectorBayShelvesList, InspectorBayDrawersRailsFittingsList, InspectorLedLightingCard } from "./inspector/InspectorInteriorSubCards";

export interface RightParametricInspectorProps {
  selectedPartSlot?: React.ReactNode;
  isOpen: boolean;
  onToggleOpen: () => void;
  activeTab: V11InspectorTab;
  onChangeTab: (tab: V11InspectorTab) => void;
  experienceTier: UserExperienceTier;
  onChangeExperienceTier?: (tier: UserExperienceTier) => void;
  modules: ModuleInstance[];
  activeModule: ModuleInstance;
  activeModuleIndex: number;
  activeBayIndex: number;
  materials: MaterialDefinition[];
  handleProfiles: HandleProfileDefinition[];
  engineeringFindings: EngineeringValidationFinding[];
  facadeGrainContinuity: boolean;
  onToggleFacadeGrainContinuity: (enabled: boolean) => void;
  onRunAutoFillersAndCrown: () => void;
  onOpenCutoutModal: () => void;
  onSaveModuleAsTemplate: (name: string) => void;
  onAddCustomMaterial: (input: {
    name: string;
    category: MaterialDefinition["category"];
    colorHex: string;
    roughness: number;
    costPerM2: number;
    hasGrain?: boolean;
  }) => void;
  onSelectModuleIndex: (idx: number) => void;
  onSelectBayIndex: (idx: number) => void;
  onSetDimensions: (w: number, h: number, d: number) => void;
  onBeginSliderDrag?: () => void;
  onCommitSliderDrag?: () => void;
  onSetPlinthHeight: (h: number) => void;
  onSplitBayIntoTwo: (bayIdx: number) => void;
  onEqualizeBaysAndShelves: () => void;
  onRemoveBayAt: (bayIdx: number) => void;
  onSetBayCustomWidth: (bayIdx: number, widthMm: number | null) => void;
  onApplyBayPreset: (
    bayIdx: number,
    presetId: "rail_double" | "shelves_5" | "rail_drawers_3" | "mixed_combo",
    options?: {
      shelfCount?: number;
      shelfMountMode?: "auto" | "all_adjustable" | "all_fixed";
      shelfThicknessMm?: 18 | 25;
    }
  ) => void;
  onAddShelf: (bayIdx: number) => void;
  onAddFixedShelf: (bayIdx: number) => void;
  onSetShelfMountType: (
    bayIdx: number,
    shelfId: string,
    isAdjustable: boolean,
    fixedConnectorType?: FixedShelfConnectorType
  ) => void;
  onRemoveShelf: (bayIdx: number, shelfId: string) => void;
  onSetShelfElevation: (bayIdx: number, shelfId: string, elevMm: number) => void;
  onSetShelfThickness: (bayIdx: number, shelfId: string | "all", thicknessMm: number) => void;
  onAddDrawer: (bayIdx: number) => void;
  onAddInternalDrawer: (bayIdx: number) => void;
  onSetDrawerPlacement?: (
    bayIdx: number,
    drawerId: string,
    newElevationY?: number,
    newHeight?: number,
    pushHistory?: boolean,
    hardwareUpdates?: {
      isInternal?: boolean;
      frontProfile?: DoorCrossSectionProfile;
      frontMaterialId?: string;
    }
  ) => void;
  onRemoveDrawer: (bayIdx: number, drawerId: string) => void;
  onAddHangingRail: (bayIdx: number) => void;
  onRemoveHangingRail: (bayIdx: number, railId: string) => void;
  onSetHangingRailProfile?: (
    bayIdx: number,
    railId: string,
    profileType: HangingRailConfig["profileType"]
  ) => void;
  onAddSpecialFitting: (bayIdx: number, fittingType: SpecialFittingConfig["type"]) => void;
  onRemoveSpecialFitting: (bayIdx: number, fittingId: string) => void;
  onAddSubDivider: (bayIdx: number) => void;
  onSetSubDividerPlacement?: (
    bayIdx: number,
    subId: string,
    updates: { offsetX?: number; elevationY?: number; height?: number; targetMidY?: number }
  ) => void;
  onRemoveSubDivider: (bayIdx: number, subId: string) => void;
  onSetBayDoorType: (
    bayIdx: number,
    type: "single_left" | "single_right" | "double" | "sliding" | "tambour" | "open"
  ) => void;
  onSetSlidingMountingType: (
    mode: "inset_inside" | "top_hung_exposed" | "top_hung_pelmet" | "coplanar_flush"
  ) => void;
  onSetBayV4DoorConfig: (
    bayIdx: number,
    updates: {
      crossSectionProfile?: DoorCrossSectionProfile;
      customCadPolygon?: Array<{ x: number; y: number }>;
      customCadProfileName?: string;
      isGlassFramed?: boolean;
      handleCategory?: HandleCategory;
      handleProfileId?: string;
      handleMaterialId?: string;
      handleLengthMm?: number;
      handleOrientation?: "auto" | "vertical" | "horizontal";
      softClose?: boolean;
      frontFillerLeftMm?: number;
      frontFillerRightMm?: number;
      frontFillerPosition?: "coplanar_front" | "recessed_inner";
      upperZoneDoorState?: "auto" | "closed" | "open";
      lowerZoneDoorState?: "auto" | "closed" | "open";
      zoneDoorStates?: Record<string, "closed" | "open">;
      hardwareProductId?: string;
      doorSystemId?: import("@birim/core").DoorSystemId;
      openingTechnology?: import("@birim/core").OpeningTechnology;
      handleType?: import("@birim/core").DoorConfig["handleType"];
    }
  ) => void;
  onCopyDoorToAllBays: (sourceBayIdx: number) => void;
  onCopyBayInteriorToAllBays?: (sourceBayIdx: number) => void;
  onMirrorModuleBays?: () => void;
  onUpdateCarcassConfig: (patch: Partial<ModuleInstance["carcass"]>, applyToAllModules?: boolean) => void;
  onApplyMaterialScope: (
    scope: "doors" | "carcass" | "all_module",
    materialId: string
  ) => void;
  onToggleModuleLed: (
    enabled: boolean,
    opts?: {
      ledType?: "led_profile" | "led_vertical_strip" | "led_rod_strip" | "full_showcase";
      colorTempK?: 2700 | 3000 | 4000;
      sensorType?: "ir_door" | "pir_motion" | "manual_switch";
      frontSetbackMm?: number;
      shelfSetbackMm?: number;
      alignShelfAndSide?: boolean;
      channelWidthMm?: number;
      channelDepthMm?: number;
    }
  ) => void;
  onApplyApprovedFix: (proposal: RemediationProposal) => void;
  onDuplicateActiveModule: () => void;
  onAddStackedTopModule: () => void;
  onRotateActiveModule90: () => void;
  onRemoveActiveModule: () => void;
  onOpenCustomHardwareModal: () => void;
  hideExpandTabOnCompact?: boolean;
}

export const RightParametricInspector: React.FC<RightParametricInspectorProps> = React.memo(
  (props) => {
    const {
      selectedPartSlot,
      isOpen,
      onToggleOpen,
      activeTab,
      onChangeTab,
      experienceTier,
      onChangeExperienceTier,
      modules,
      activeModule,
      activeModuleIndex,
      activeBayIndex,
      materials,
      handleProfiles,
      engineeringFindings,
      facadeGrainContinuity,
      onToggleFacadeGrainContinuity,
      onRunAutoFillersAndCrown,
      onOpenCutoutModal,
      onSaveModuleAsTemplate,
      onAddCustomMaterial,
      onSelectModuleIndex,
      onSelectBayIndex,
      onSetDimensions,
      onBeginSliderDrag,
      onCommitSliderDrag,
      onSetPlinthHeight,
      onSplitBayIntoTwo,
      onEqualizeBaysAndShelves,
      onRemoveBayAt,
      onSetBayCustomWidth,
      onApplyBayPreset,
      onAddShelf,
      onAddFixedShelf,
      onSetShelfMountType,
      onRemoveShelf,
      onSetShelfElevation,
      onSetShelfThickness,
      onAddDrawer,
      onAddInternalDrawer,
      onSetDrawerPlacement,
      onRemoveDrawer,
      onAddHangingRail,
      onRemoveHangingRail,
      onSetHangingRailProfile,
      onAddSpecialFitting,
      onRemoveSpecialFitting,
      onAddSubDivider,
      onSetSubDividerPlacement,
      onRemoveSubDivider,
      onSetBayDoorType,
      onSetSlidingMountingType,
      onSetBayV4DoorConfig,
      onCopyDoorToAllBays,
      onCopyBayInteriorToAllBays,
      onMirrorModuleBays,
      onUpdateCarcassConfig,
      onApplyMaterialScope,
      onToggleModuleLed,
      onApplyApprovedFix,
      onDuplicateActiveModule,
      onAddStackedTopModule,
      onRotateActiveModule90,
      onRemoveActiveModule,
      onOpenCustomHardwareModal,
    hideExpandTabOnCompact = false,
    } = props;

    const unitMode = useConfiguratorStore((st) => st.displayUnit);
    const setUnitMode = useConfiguratorStore((st) => st.setDisplayUnit);
    const reactiveSpace = useConfiguratorStore((st) => st.project.space);
    const [moduleMenuOpen, setModuleMenuOpen] = useState(false);
    const [moduleMenuPos, setModuleMenuPos] = useState<{ top: number; right: number }>({
      top: 126,
      right: 28,
    });
    const moduleMenuBtnRef = useRef<HTMLButtonElement | null>(null);
    const moduleMenuPortalRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
      if (!isOpen) setModuleMenuOpen(false);
    }, [isOpen]);

    useEffect(() => {
      if (!moduleMenuOpen) return;
      const onDown = (e: PointerEvent) => {
        const t = e.target as Node | null;
        if (moduleMenuPortalRef.current?.contains(t)) return;
        if (moduleMenuBtnRef.current?.contains(t)) return;
        setModuleMenuOpen(false);
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") setModuleMenuOpen(false);
      };
      window.addEventListener("pointerdown", onDown, true);
      window.addEventListener("keydown", onKey);
      return () => {
        window.removeEventListener("pointerdown", onDown, true);
        window.removeEventListener("keydown", onKey);
      };
    }, [moduleMenuOpen]);
  const [interiorSubTab, setInteriorSubTab] = useState<"layout" | "hardware">("layout");
  const [appliedAllKey, setAppliedAllKey] = useState<string | null>(null);
  const mainModuleCount = useConfiguratorStore(
    (st) => (st.project?.modules || []).filter((m) => m.category !== "complementary").length
  );
  const renderApplyCarcassToAllBtn = (
    key: string,
    label: string,
    patch: Partial<ModuleInstance["carcass"]>
  ) => {
    if (mainModuleCount < 2) return null;
    const done = appliedAllKey === key;
    return (
      <button
        type="button"
        onClick={() => {
          onUpdateCarcassConfig(patch, true);
          setAppliedAllKey(key);
          window.setTimeout(() => setAppliedAllKey((cur) => (cur === key ? null : cur)), 1800);
        }}
        className={`w-full mt-1.5 py-1.5 px-2.5 rounded-xl border text-[10.5px] font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
          done
            ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-700"
            : "bg-[#F5F2EA] hover:bg-[#EAE3D5] border-[#DED8CC] text-[#44403C]"
        }`}
      >
        <span>{done ? `✓ Tüm Modüllere Uygulandı (${mainModuleCount} Modül)` : `${label} (${mainModuleCount} Modül)`}</span>
      </button>
    );
  };
  useEffect(() => {
    if (activeTab === "hardware") {
      setInteriorSubTab("hardware");
    }
  }, [activeTab]);
  const [panelWidthPx, setPanelWidthPx] = useState<number>(() => {
    if (typeof window === "undefined") return 412;
    try {
      const saved = Number(localStorage.getItem("birim_right_panel_width_v1"));
      if (Number.isFinite(saved) && saved >= 340 && saved <= 680) return saved;
    } catch {
      // ignore
    }
    return 412;
  });
  const startPanelResize = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const startW = panelWidthPx;
    const onMove = (ev: PointerEvent) => {
      const nextW = Math.max(340, Math.min(680, Math.round(startW + (startX - ev.clientX))));
      setPanelWidthPx(nextW);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      try {
        localStorage.setItem("birim_right_panel_width_v1", String(panelWidthPx));
      } catch {
        // ignore
      }
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp);
  };
    const [materialTarget, setMaterialTarget] = useState<"doors" | "carcass" | "all_module">(
      "doors"
    );
    const [materialGroup, setMaterialGroup] = useState<V11MaterialGroup["id"]>("all");
    const [materialSearch, setMaterialSearch] = useState("");
    const [customMatOpen, setCustomMatOpen] = useState(false);
    const [newMatName, setNewMatName] = useState("");
    const [newMatHex, setNewMatHex] = useState("#C8B8A2");
    const [newMatCat, setNewMatCat] = useState<"laminate" | "lacquer" | "wood" | "stone">("laminate");
    const [newMatGrain, setNewMatGrain] = useState(false);
    const [batchApplyHandlesToModule, setBatchApplyHandlesToModule] = useState(true);
    const [handleFilterTab, setHandleFilterTab] = useState<"all" | "pull_handles" | "gola_handleless">("all");
    const [batchApplyHandlesToAllModules, setBatchApplyHandlesToAllModules] = useState(false);
    const [batchApplyDoorModelToModule, setBatchApplyDoorModelToModule] = useState(true);
    const [doorFrontSubTab, setDoorFrontSubTab] = useState<"door" | "drawer">("door");
    const [selectedDrawerFrontId, setSelectedDrawerFrontId] = useState<string | null>(null);
    const [batchApplyDrawerFrontToAll, setBatchApplyDrawerFrontToAll] = useState(false);
    const reactiveSelectedCompId = useConfiguratorStore((s) => s.selectedComponentId);

    // 3D sahnede bir çekmece seçildiğinde Kapak bölümünde otomatik "Çekmece Klapası" ve ilgili çekmece seçili gelsin
    useEffect(() => {
      if (!reactiveSelectedCompId || !activeModule) return;
      const bay = activeModule.bays[Math.min(activeBayIndex, Math.max(0, activeModule.bays.length - 1))];
      if (!bay) return;
      const lower = reactiveSelectedCompId.toLowerCase();
      const matchedDr = bay.drawers.find(
        (dr, idx) =>
          reactiveSelectedCompId === dr.id ||
          reactiveSelectedCompId.startsWith(`${dr.id}_`) ||
          lower.includes(`_drawer_${idx}`)
      );
      if (matchedDr) {
        setDoorFrontSubTab("drawer");
        setSelectedDrawerFrontId(matchedDr.id);
        setBatchApplyDrawerFrontToAll(false);
      } else if (lower.includes("door")) {
        setDoorFrontSubTab("door");
      }
    }, [reactiveSelectedCompId, activeModule, activeBayIndex]);
    const [customDoorProfiles, setCustomDoorProfiles] = useState<CustomDoorProfilePreset[]>(() => {
      if (typeof window === "undefined") return [];
      try {
        const raw = window.localStorage.getItem("birim_custom_door_profiles_v1");
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    });
    const [selectedCustomDoorId, setSelectedCustomDoorId] = useState<string | null>(null);
    const [customDoorOpen, setCustomDoorOpen] = useState(false);
    const [mobileSheetDvh, setMobileSheetDvh] = useState<38 | 62 | 86>(62);
    const sheetDragStartYRef = useRef<number | null>(null);
    const [multiShelfOpen, setMultiShelfOpen] = useState(false);
    const [multiShelfCount, setMultiShelfCount] = useState(5);
    const [multiShelfMount, setMultiShelfMount] = useState<
      "auto" | "all_adjustable" | "all_fixed"
    >("auto");
    const [multiShelfThick, setMultiShelfThick] = useState<18 | 25>(18);

    const isSimple = experienceTier === "simple";
    const safeBayIdx = Math.min(activeBayIndex, Math.max(0, activeModule.bays.length - 1));
    const activeBay = activeModule.bays[safeBayIdx] || activeModule.bays[0];

    const fourSpace = useMemo(
      () => calculateFourSpaceDimensions(activeModule),
      [activeModule]
    );
    const bayClearWidths = fourSpace.usableInternal.bayClearWidthsMm;
    const netInnerHeightMm =
      fourSpace.usableInternal.netInnerHeightMm ||
      Math.max(300, activeModule.dimensions.height - (activeModule.carcass.plinthHeight ?? 80) - 2 * (activeModule.carcass.panelThickness || 18));
    const subDividerIntervals = useMemo(
      () =>
        activeBay
          ? getBayShelfIntervalsForSubDivider(
              activeBay,
              netInnerHeightMm,
              activeModule.carcass.panelThickness || 18
            )
          : [],
      [activeBay, netInnerHeightMm, activeModule.carcass.panelThickness]
    );

    const mainModuleIndices = useMemo(
      () =>
        modules
          .map((m, idx) => ({ m, idx }))
          .filter((item) => item.m.category !== "complementary"),
      [modules]
    );
    const currentOrderIdx = Math.max(
      0,
      mainModuleIndices.findIndex((x) => x.idx === activeModuleIndex)
    );

    const visibleMaterials = useMemo(() => {
      const base = filterMaterialsByGroup(materials, materialGroup);
      const q = materialSearch.trim().toLowerCase();
      if (!q) return base;
      return base.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          (m.brand || "").toLowerCase().includes(q) ||
          (m.decorCode || "").toLowerCase().includes(q)
      );
    }, [materials, materialGroup, materialSearch]);

    const applyDoorPatchAcrossScope = (
      patch: Parameters<typeof onSetBayV4DoorConfig>[1],
      applyAllBaysInModule: boolean,
      applyAllModulesInScene: boolean
    ) => {
      if (applyAllModulesInScene) {
        const st = useConfiguratorStore.getState();
        st.beginHistoryTransaction();
        const prevIdx = st.activeModuleIndex;
        st.project.modules.forEach((m, mIdx) => {
          if (m.category === "complementary") return;
          st.setActiveModuleIndex(mIdx);
          m.bays.forEach((b, bIdx) => {
            const bayHasExtDrawers = (b.drawers || []).some((d) => !d.isInternal && !d.isHidden);
            if (b.door?.type !== "open" || bayHasExtDrawers) {
              onSetBayV4DoorConfig(bIdx, patch);
            }
          });
        });
        st.setActiveModuleIndex(prevIdx);
        st.commitHistoryTransaction();
        return;
      }
      if (applyAllBaysInModule && activeModule.bays.length > 1) {
        onBeginSliderDrag?.();
        activeModule.bays.forEach((b, bIdx) => {
          const bayHasExtDrawers = (b.drawers || []).some((d) => !d.isInternal && !d.isHidden);
          if (b.door?.type !== "open" || bayHasExtDrawers) {
            onSetBayV4DoorConfig(bIdx, patch);
          }
        });
        onCommitSliderDrag?.();
        return;
      }
      onSetBayV4DoorConfig(safeBayIdx, patch);
    };

    const activeFinding = engineeringFindings[0] || null;
    const formattedFinding = useMemo(
      () => (activeFinding ? formatFindingForTier(activeFinding, experienceTier) : null),
      [activeFinding, experienceTier]
    );

    const wMm = activeModule.dimensions.width;
    const hMm = activeModule.dimensions.height;
    const dMm = activeModule.dimensions.depth;
    const plinthMm = activeModule.carcass.plinthHeight ?? 80;
    const formatVal = (mm: number) =>
      unitMode === "cm" ? `${Math.round(mm / 10)}` : `${Math.round(mm)}`;

    const curDoorType = activeBay?.door?.type || "double";
    const hasExternalDrawersInActiveBay = Boolean(
      activeBay?.drawers?.some((d) => !d.isInternal && !d.isHidden)
    );
    const isKitchenCornerMod = Boolean(
      activeModule.isCorner ||
        activeModule.category === "kitchen_corner" ||
        activeModule.templateId?.includes("corner") ||
        activeModule.name.toLowerCase().includes("köşe")
    );
    const activeHullShape = activeModule.carcass.hullShape || "rectangular";
    const isCapsuleOrRounded =
      activeHullShape === "capsule_stadium" || activeHullShape === "rounded_corners";
    const isTableOrIslandMod =
      activeHullShape === "capsule_table" ||
      activeModule.category === "kitchen_island" ||
      activeModule.complementaryRole === "attached_table";
    const isSlidingBay =
      !isCapsuleOrRounded && (curDoorType === "sliding" || curDoorType === "sliding_bottom");
    const curDoorProfile =
      activeBay?.door?.crossSectionProfile ||
      activeModule.carcass.crossSectionProfile ||
      "flat_slab";
    const activeMatId =
      materialTarget === "carcass"
        ? activeModule.carcass.bodyMaterialId
        : activeModule.carcass.doorMaterialId;
    const hasBaseboardNotch = Boolean(activeModule.carcass.baseboardNotch?.enabled);
    const hasAnyInternalDrawer = activeModule.bays.some((b) =>
      (b.drawers || []).some((d) => d.isInternal && !d.isHidden)
    );
    const internalDrawerBlindControlPanel = <InspectorInternalDrawerBlindCard activeModule={activeModule} onUpdateCarcassConfig={onUpdateCarcassConfig} />;

    return (
      <>
        {/* DARALTILMI�? DURUM: Sağ dikey merkezde durur, açılıp kapanırken yumuşak ölçek/opaklık geçişi yapar */}
        <button
          type="button"
          data-testid="v11-expand-inspector-btn"
          inert={isOpen ? true : undefined}
          tabIndex={isOpen ? -1 : 0}
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleOpen();
          }}
          title="Modül Özellikleri Panelini Aç"
          className={`fixed right-4 max-md:right-2 top-1/2 -translate-y-1/2 z-30 py-3.5 px-2.5 max-md:py-2.5 max-md:px-1.5 rounded-full bg-[#2C3341]/66 backdrop-blur-2xl border border-white/[0.22] ring-1 ring-black/50 shadow-[0_18px_46px_rgba(0,0,0,0.46)] text-xs font-semibold text-[#F3F4F6] flex flex-col items-center gap-2 max-md:gap-1 hover:bg-[#222631] cursor-pointer origin-right transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isOpen || hideExpandTabOnCompact
              ? "opacity-0 scale-90 translate-x-4 pointer-events-none"
              : "opacity-100 scale-100 translate-x-0 pointer-events-auto"
          }`}
        >
          <ChevronLeft className="w-4 h-4 text-[#7DD3FC]" />
          <SlidersHorizontal className="w-4 h-4 text-[#7DD3FC]" />
          <span className="[writing-mode:vertical-rl] rotate-180 text-[11px] font-bold tracking-wide py-0.5">
            Özellikler
          </span>
        </button>

        {/* MOBİL / TABLET SAĞ ÇEKMECE ARKA PLAN KARARTMASI (<1024px — dışa dokunarak kapat) */}
        <div
          aria-hidden="true"
          onClick={() => {
            if (isOpen) onToggleOpen();
          }}
          className={`lg:hidden fixed inset-0 z-[58] bg-black/45 transition-opacity duration-300 ease-out ${
            isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
        />

        <aside
          aria-label="Modül Parametreleri"
          inert={!isOpen ? true : undefined}
          data-testid="v11-right-inspector"
          style={
            {
              width: `${panelWidthPx}px`,
              paddingTop: "env(safe-area-inset-top)",
              paddingBottom: "env(safe-area-inset-bottom)",
              transform: isOpen ? "translate3d(0, 0, 0)" : "translate3d(calc(100% + 28px), 0, 0)",
              transition:
                "transform 380ms cubic-bezier(0.16, 1, 0.3, 1), opacity 260ms ease",
            } as React.CSSProperties
          }
          className={`birim-dramatic-panel fixed right-4 top-[72px] max-xl:top-[112px] bottom-[84px] max-w-[calc(100vw-32px)] max-lg:!w-[min(88vw,390px)] max-lg:left-auto max-lg:right-0 max-lg:!top-0 max-lg:bottom-0 max-lg:h-dvh max-lg:max-w-none max-lg:rounded-none max-lg:rounded-l-[28px] max-lg:z-[65] z-30 rounded-3xl bg-[#2A313F]/66 backdrop-blur-2xl border border-white/[0.22] max-lg:border-r-0 ring-1 ring-black/60 shadow-[0_28px_68px_rgba(0,0,0,0.62)] flex flex-col overflow-hidden text-[#F3F4F6] will-change-[transform,opacity] ${
            isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
        >
        {/* MOBİL / TABLET SAĞA KAYDIRARAK KAPATMA KENAR TUTAMACI (<1024px) */}
        <div
          aria-label="Paneli sağa kaydırarak kapat"
          onPointerDown={(e) => {
            sheetDragStartYRef.current = e.clientX;
            try {
              (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
            } catch {}
          }}
          onPointerUp={(e) => {
            const startX = sheetDragStartYRef.current;
            sheetDragStartYRef.current = null;
            if (startX !== null && e.clientX - startX > 48 && isOpen) {
              onToggleOpen();
            }
          }}
          className="lg:hidden absolute left-0 top-1/2 -translate-y-1/2 w-3.5 h-24 z-40 flex items-center justify-center touch-none cursor-ew-resize"
        >
          <span className="w-1 h-12 rounded-full bg-white/30" />
        </div>
        {/* SOL KENAR YENİDEN BOYUTLANDIRMA TUTAMACI (340–680px) */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Sağ panel genişliğini ayarla"
          data-testid="v11-right-inspector-resize-handle"
          onPointerDown={startPanelResize}
          title="Panel genişliğini sürükleyerek ayarlayın"
          className="hidden md:flex absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-[#141413]/10 z-40 items-center justify-center group"
        >
          <span className="w-0.5 h-10 rounded-full bg-[#C7BFB0] group-hover:bg-[#141413] transition" />
        </div>
        {/* ÜST MODÜL SEÇİCİ VE AKSİYON BA�?LI�?I */}
        <div className="px-4 pt-3.5 pb-3 border-b border-[#E6E1D6] shrink-0 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#8C7A6B]">
                  Modül {currentOrderIdx + 1} / {Math.max(1, mainModuleIndices.length)}
                </span>
                {mainModuleIndices.length > 1 && (
                  <div className="inline-flex items-center gap-0.5 ml-1">
                    <button
                      type="button"
                      onClick={() => {
                        const prev =
                          mainModuleIndices[
                            (currentOrderIdx - 1 + mainModuleIndices.length) %
                              mainModuleIndices.length
                          ];
                        if (prev) onSelectModuleIndex(prev.idx);
                      }}
                      className="w-5 h-5 rounded-full hover:bg-[#EFECE4] flex items-center justify-center cursor-pointer"
                      title="Önceki Modül"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const next =
                          mainModuleIndices[(currentOrderIdx + 1) % mainModuleIndices.length];
                        if (next) onSelectModuleIndex(next.idx);
                      }}
                      className="w-5 h-5 rounded-full hover:bg-[#EFECE4] flex items-center justify-center cursor-pointer"
                      title="Sonraki Modül"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
              <h2 className="text-sm font-bold truncate mt-0.5">{activeModule.name}</h2>
              <p className="text-[11px] font-mono text-[#78716C]">
                {unitMode === "cm"
                  ? `${Number((wMm / 10).toFixed(1))} × ${Number((hMm / 10).toFixed(1))} × ${Number((dMm / 10).toFixed(1))} cm`
                  : `${Math.round(wMm)} × ${Math.round(hMm)} × ${Math.round(dMm)} mm`} •{" "}
                {activeModule.bays.length} Bölme
              </p>
              {(experienceTier !== "simple" ||
                activeModule.includeInProduction === false ||
                activeModule.includeInPricing === false) && (
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                <button
                  type="button"
                  data-testid="v11-toggle-module-production"
                  onClick={() =>
                    useConfiguratorStore.getState().setModuleProductionAndPricingFlags(activeModuleIndex, {
                      includeInProduction: activeModule.includeInProduction === false,
                    })
                  }
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition cursor-pointer ${
                    activeModule.includeInProduction !== false
                      ? "bg-emerald-500/15 text-emerald-300 border-emerald-400/35"
                      : "bg-slate-500/15 text-slate-400 border-slate-400/30 line-through"
                  }`}
                  title="Bu modülün Kesim Listesi, CNC ve 2D Nesting üretimine dahil edilip edilmeyeceğini seçin"
                >
                  {activeModule.includeInProduction !== false ? "✓ Üretime Dahil" : "✕ Üretim Dışı"}
                </button>
                <button
                  type="button"
                  data-testid="v11-toggle-module-pricing"
                  onClick={() =>
                    useConfiguratorStore.getState().setModuleProductionAndPricingFlags(activeModuleIndex, {
                      includeInPricing: activeModule.includeInPricing === false,
                    })
                  }
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition cursor-pointer ${
                    activeModule.includeInPricing !== false
                      ? "bg-sky-500/15 text-sky-300 border-sky-400/35"
                      : "bg-amber-500/15 text-amber-300 border-amber-400/35 line-through"
                  }`}
                  title="Bu modülün müşteri teklif fiyatına dahil edilip edilmeyeceğini seçin"
                >
                  {activeModule.includeInPricing !== false ? "✓ Fiyata Dahil" : "✕ Fiyat Dışı"}
                </button>
              </div>
              )}
            </div>

            <div className="relative flex items-center gap-1 shrink-0">
              <button
                ref={moduleMenuBtnRef}
                type="button"
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  const nextTop = Math.min(
                    Math.max(16, window.innerHeight - 280),
                    Math.max(16, Math.round(r.bottom + 8))
                  );
                  const nextRight = Math.max(12, Math.round(window.innerWidth - r.right));
                  setModuleMenuPos({ top: nextTop, right: nextRight });
                  setModuleMenuOpen((v) => !v);
                }}
                title="Modül İşlemleri"
                className="w-8 h-8 rounded-full hover:bg-[#EFECE4] text-[#57534E] hover:text-[#141413] flex items-center justify-center transition cursor-pointer"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setModuleMenuOpen(false);
                  onToggleOpen();
                }}
                aria-label="Paneli Kapat"
                title="Paneli Kapat"
                className="w-8 h-8 rounded-full hover:bg-[#EFECE4] text-[#57534E] hover:text-[#141413] flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              {isOpen && moduleMenuOpen && typeof document !== "undefined" && createPortal(
                <div
                  ref={moduleMenuPortalRef}
                  data-birim-portal-menu="true"
                  onPointerDown={(e) => e.stopPropagation()}
                  style={{
                    position: "fixed",
                    top: `${moduleMenuPos.top}px`,
                    right: `${moduleMenuPos.right}px`,
                    zIndex: 90,
                    background: "rgba(30, 36, 48, 0.94)",
                    backdropFilter: "blur(32px) saturate(185%)",
                    WebkitBackdropFilter: "blur(32px) saturate(185%)",
                  }}
                  className="w-60 max-w-[calc(100vw-24px)] rounded-2xl border border-white/[0.22] ring-1 ring-black/50 shadow-[0_24px_60px_rgba(0,0,0,0.62)] p-1.5 text-xs text-slate-100"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setModuleMenuOpen(false);
                      onDuplicateActiveModule();
                    }}
                    className="w-full px-3 py-2 rounded-xl hover:bg-white/[0.14] text-slate-100 flex items-center gap-2 text-left font-medium transition cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5 text-slate-300" />
                    <span>Yanına Kopyala</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModuleMenuOpen(false);
                      onAddStackedTopModule();
                    }}
                    className="w-full px-3 py-2 rounded-xl hover:bg-white/[0.14] text-slate-100 flex items-center gap-2 text-left font-medium transition cursor-pointer"
                  >
                    <ArrowUpFromLine className="w-3.5 h-3.5 text-slate-300" />
                    <span>Üst Yüklük Modülü Ekle</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModuleMenuOpen(false);
                      onRotateActiveModule90();
                    }}
                    className="w-full px-3 py-2 rounded-xl hover:bg-white/[0.14] text-slate-100 flex items-center gap-2 text-left font-medium transition cursor-pointer"
                  >
                    <RotateCw className="w-3.5 h-3.5 text-slate-300" />
                    <span>90° Döndür</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModuleMenuOpen(false);
                      onOpenCutoutModal();
                    }}
                    className="w-full px-3 py-2 rounded-xl hover:bg-white/[0.14] text-slate-100 flex items-center gap-2 text-left font-medium transition cursor-pointer"
                  >
                    <Scissors className="w-3.5 h-3.5 text-slate-300" />
                    <span>Panel Kertme & Priz Kesimi</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModuleMenuOpen(false);
                      onSaveModuleAsTemplate(`${activeModule.name} (Özel)`);
                    }}
                    className="w-full px-3 py-2 rounded-xl hover:bg-white/[0.14] text-slate-100 flex items-center gap-2 text-left font-medium transition cursor-pointer"
                  >
                    <BookmarkPlus className="w-3.5 h-3.5 text-slate-300" />
                    <span>Özel Şablon Olarak Kaydet</span>
                  </button>
                  {(modules.length > 1 && (activeModule.category === "complementary" || mainModuleIndices.length > 1)) && (
                    <button
                      type="button"
                      onClick={() => {
                        setModuleMenuOpen(false);
                        onRemoveActiveModule();
                      }}
                      className="w-full px-3 py-2 rounded-xl hover:bg-red-50 text-red-600 flex items-center gap-2 text-left font-medium cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Modülü Sil</span>
                    </button>
                  )}
                </div>,
                document.body
              )}
            </div>
          </div>

          {onChangeExperienceTier && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10.5px] font-semibold text-[#8C7A6B] uppercase tracking-wider">
                Panel Seviyesi
              </span>
              <div
                className="inline-flex items-center p-0.5 rounded-full bg-[#ECE7DD]/80 border border-[#DFD9CE]"
                title="Sağ Panel Detay Seviyesi"
              >
                {(
                  [
                    { id: "simple", label: "Kolay" },
                    { id: "architect", label: "Pro" },
                    { id: "factory", label: "Üretim" },
                  ] as const
                ).map((t) => {
                  const active = experienceTier === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      data-testid={`v11-tier-${t.id}`}
                      onClick={() => onChangeExperienceTier(t.id)}
                      className={`h-6 px-3 rounded-full text-[11px] font-semibold transition cursor-pointer ${
                        active
                          ? "bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] text-white font-bold border border-[#38BDF8]/65 shadow-[0_0_16px_rgba(29,78,216,0.58)]"
                          : "text-[#57534E] hover:text-[#141413]"
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="relative grid grid-cols-4 gap-1 p-1 rounded-2xl bg-slate-900/[0.07] border border-white/55">
            <span
              aria-hidden="true"
              style={{
                width: "calc((100% - 8px - 12px) / 4)",
                transform: `translate3d(calc(${
                  activeTab === "dimensions"
                    ? 0
                    : activeTab === "doors"
                    ? 2
                    : activeTab === "materials"
                    ? 3
                    : 1
                } * (100% + 4px)), 0, 0)`,
              }}
              className="pointer-events-none absolute top-1 bottom-1 left-1 rounded-xl bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] border border-[#38BDF8]/60 shadow-[0_0_20px_rgba(29,78,216,0.58),0_4px_14px_rgba(37,99,235,0.45)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
            />
            {(
              [
                { id: "dimensions", label: experienceTier === "simple" ? "Ölçü & Gövde" : "Gövde" },
                { id: "interior", label: "İç & Donanım" },
                { id: "doors", label: "Kapak" },
                { id: "materials", label: "Yüzey" },
              ] as const
            ).map((tb) => {
              const active = activeTab === tb.id || (tb.id === "interior" && activeTab === "hardware");
              return (
                <button
                  key={tb.id}
                  type="button"
                  data-testid={`v11-tab-${tb.id}`}
                  onClick={() => onChangeTab(tb.id)}
                  className={`relative z-10 py-2 px-1 rounded-xl text-[11px] sm:text-xs font-semibold whitespace-nowrap truncate transition-colors duration-200 cursor-pointer ${
                    active
                      ? "text-white"
                      : "text-slate-700 hover:text-[#18181B]"
                  }`}
                >
                  {tb.label}
                </button>
              );
            })}
          </div>
        </div>

        {selectedPartSlot}

        {/* KAYDIRILABİLİR İÇERİK ALANI */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* ==================== SEKME 1: BOYUT & MİMARİ DETAYLAR ==================== */}
          {/* SEÇİLİ PARÇA BAĞLAMSAL HIZLI KARTI (React.memo izole) */}
          {(() => {
            const bay = activeModule.bays[activeBayIndex];
            const storeSelCompId = useConfiguratorStore.getState().selectedComponentId;
            const selComp = storeSelCompId
              ? (bay as unknown as { components?: Array<{ id: string; type?: string; isAdjustable?: boolean; isFixed?: boolean; position?: number; y?: number; elevationY?: number }> } | undefined)?.components?.find((c) => c.id === storeSelCompId)
              : undefined;
            if (!selComp) return null;
            const isShelf = selComp.type === "shelf";
            const isFixed = isShelf && (selComp.isAdjustable === false || selComp.isFixed);
            const partKind =
              selComp.type === "shelf"
                ? "shelf"
                : selComp.type === "drawer"
                ? "drawer"
                : selComp.type === "hanging_rail"
                ? "rail"
                : "bay";
            return (
              <InspectorSelectedPartCard
                partLabel={`${activeBayIndex + 1}. Bölme · ${
                  isShelf ? "Raf" : selComp.type === "drawer" ? "Çekmece" : selComp.type === "hanging_rail" ? "Askı Borusu" : "İç Eleman"
                }`}
                partKind={partKind}
                isFixedShelf={Boolean(isFixed)}
                elevationMm={Number(selComp.position ?? selComp.y ?? 0)}
                displayUnit={unitMode}
                onJumpToTab={(t) => onChangeTab(t)}
              />
            );
          })()}

          <InspectorDimensionsTab activeHullShape={activeHullShape} activeModule={activeModule} activeTab={activeTab} curDoorType={curDoorType} dMm={dMm} facadeGrainContinuity={facadeGrainContinuity} hMm={hMm} hasAnyInternalDrawer={hasAnyInternalDrawer} hasBaseboardNotch={hasBaseboardNotch} internalDrawerBlindControlPanel={internalDrawerBlindControlPanel} isCapsuleOrRounded={isCapsuleOrRounded} isSimple={isSimple} isSlidingBay={isSlidingBay} isTableOrIslandMod={isTableOrIslandMod} materials={materials} onBeginSliderDrag={onBeginSliderDrag} onCommitSliderDrag={onCommitSliderDrag} onOpenCutoutModal={onOpenCutoutModal} onRunAutoFillersAndCrown={onRunAutoFillersAndCrown} onSetDimensions={onSetDimensions} onSetPlinthHeight={onSetPlinthHeight} onToggleFacadeGrainContinuity={onToggleFacadeGrainContinuity} onUpdateCarcassConfig={onUpdateCarcassConfig} plinthMm={plinthMm} reactiveSpace={reactiveSpace} renderApplyCarcassToAllBtn={renderApplyCarcassToAllBtn} setUnitMode={setUnitMode} unitMode={unitMode} wMm={wMm} />
          {/* ==================== SEKME 2: İÇ DÜZEN ==================== */}
          {(activeTab === "interior" || activeTab === "hardware") && (
            <>
              <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-[#ECE7DD]/80 border border-[#DFD9CE]">
                <button
                  type="button"
                  data-testid="v11-interior-subtab-layout"
                  onClick={() => {
                    setInteriorSubTab("layout");
                    if (activeTab === "hardware") onChangeTab("interior");
                  }}
                  className={`py-1.5 px-2 rounded-xl text-[11px] font-semibold transition cursor-pointer ${
                    interiorSubTab === "layout"
                      ? "bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] text-white font-bold border border-[#38BDF8]/65 shadow-[0_0_16px_rgba(29,78,216,0.58)]"
                      : "text-[#57534E] hover:text-[#141413]"
                  }`}
                >
                  Yerleşim
                </button>
                <button
                  type="button"
                  data-testid="v11-interior-subtab-hardware"
                  onClick={() => setInteriorSubTab("hardware")}
                  className={`py-1.5 px-2 rounded-xl text-[11px] font-semibold transition cursor-pointer ${
                    interiorSubTab === "hardware"
                      ? "bg-[#141413] text-white shadow-2xs"
                      : "text-[#57534E] hover:text-[#141413]"
                  }`}
                >
                  Donanım
                </button>
              </div>

              {interiorSubTab === "hardware" ? (
                <RightHardwareLibraryPanel
                  activeModule={activeModule}
                  activeBayIndex={activeBayIndex}
                  experienceTier={experienceTier}
                  onApplyHardware={(bayIdx, hwId, opts) =>
                    useConfiguratorStore.getState().applyHardwareProductToBay(bayIdx, hwId, opts)
                  }
                  onOpenCustomHardwareModal={onOpenCustomHardwareModal}
                />
              ) : (
                <>
              <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#141413]">
                    Bölme Seçimi ({activeModule.bays.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => onSplitBayIntoTwo(safeBayIdx)}
                    className="px-2.5 py-1 rounded-full bg-[#141413] hover:bg-[#292524] text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Bölme Ekle</span>
                  </button>
                </div>

                {/* GERÇEKÇİ DOLAP ÖN GÖRÜNÜŞÜ BÖLME SEÇİCİSİ (Orantılı Gövde + Baza + Canlı İç Yerleşim) */}
                <div className="p-2.5 rounded-2xl bg-[#141923]/90 border border-white/12 flex flex-col items-center">
                  <div
                    className={`w-full ${
                      activeModule.bays.length === 1
                        ? "max-w-[116px]"
                        : activeModule.bays.length === 2
                        ? "max-w-[210px]"
                        : "max-w-full"
                    }`}
                  >
                    {/* Dolap Üst Taç + Gövde Çerçevesi */}
                    <div className="rounded-t-lg border-[3px] border-[#94A3B8]/65 bg-[#475569]/55 p-[2px] shadow-[0_8px_22px_rgba(0,0,0,0.45)]">
                      <div className="flex items-stretch gap-[3px] h-[118px] w-full">
                        {activeModule.bays.map((b, idx) => {
                          const isSel = idx === safeBayIdx;
                          const bwMm = Math.max(150, Math.round(bayClearWidths[idx] || 600));
                          const clearCm = Math.round(bwMm / 10);
                          const modInnerH = Math.max(
                            400,
                            activeModule.dimensions.height - (activeModule.carcass.plinthHeight ?? 100) - 36
                          );
                          const visShelves = (b.shelves || []).filter((s) => !s.isHidden);
                          const visDrawers = (b.drawers || []).filter((d) => !d.isHidden);
                          const visRails = (b.hangingRails || []).filter((r) => !r.isHidden);
                          const visSubDivs = b.subDividers || [];
                          return (
                            <button
                              key={b.index}
                              type="button"
                              onClick={() => onSelectBayIndex(idx)}
                              style={{ flex: `${Math.max(1, bwMm)} 1 0%` }}
                              title={`${idx + 1}. Bölme (${unitMode === "cm" ? `${clearCm} cm` : `${bwMm} mm`})`}
                              className={`group relative h-full overflow-hidden transition-all duration-200 cursor-pointer ${
                                isSel
                                  ? "bg-[#16273B] ring-2 ring-inset ring-[#38BDF8] shadow-[inset_0_0_18px_rgba(56,189,248,0.28)]"
                                  : "bg-[#1A202C] hover:bg-[#232B3A]"
                              }`}
                            >
                              {/* Raf, Askı ve Çekmece Yerleşimi (Gerçek Orantılı Yükseklik) */}
                              <div className="relative w-full h-full pointer-events-none">
                                {visDrawers.map((dr, di) => {
                                  const hPct = Math.max(9, Math.min(28, (dr.height / modInnerH) * 100));
                                  const bPct = Math.max(1, Math.min(96 - hPct, (dr.elevationY / modInnerH) * 100));
                                  return (
                                    <div
                                      key={`dr_${di}`}
                                      style={{ bottom: `${bPct}%`, height: `${hPct}%` }}
                                      className={`absolute left-[4px] right-[4px] rounded-[2px] border flex items-center justify-center ${
                                        isSel
                                          ? "bg-[#0284C7]/35 border-[#7DD3FC]/85"
                                          : "bg-slate-600/45 border-slate-400/65"
                                      }`}
                                    >
                                      <span className="w-5 h-[2px] rounded-full bg-white/85" />
                                    </div>
                                  );
                                })}
                                {visShelves.map((sh, si) => {
                                  const bPct = Math.max(4, Math.min(94, (sh.elevationY / modInnerH) * 100));
                                  const isFixed = sh.isAdjustable === false || Boolean(sh.isFixed);
                                  return (
                                    <div
                                      key={`sh_${si}`}
                                      style={{ bottom: `${bPct}%` }}
                                      className={`absolute left-[2px] right-[2px] rounded-full ${
                                        isFixed
                                          ? "h-[3px] bg-[#38BDF8] shadow-[0_0_6px_rgba(56,189,248,0.6)]"
                                          : "h-[2.5px] bg-[#E2B47E]"
                                      }`}
                                    />
                                  );
                                })}
                                {visRails.map((rl, ri) => {
                                  const bPct = Math.max(14, Math.min(92, (rl.elevationY / modInnerH) * 100));
                                  return (
                                    <div
                                      key={`rl_${ri}`}
                                      style={{ bottom: `${bPct}%` }}
                                      className="absolute left-[4px] right-[4px] flex flex-col items-center"
                                    >
                                      <div className="w-full h-[2.5px] rounded-full bg-[#7DD3FC]" />
                                      <div className="w-4 h-2.5 border-l border-r border-b border-[#7DD3FC]/75 rounded-b-sm -mt-[1px] opacity-80" />
                                    </div>
                                  );
                                })}
                                {visSubDivs.map((sd, sdi) => {
                                  const xPct = Math.max(18, Math.min(82, ((sd.offsetX || bwMm * 0.5) / bwMm) * 100));
                                  const bPct = Math.max(2, Math.min(92, ((sd.elevationY || 0) / modInnerH) * 100));
                                  const hPct = Math.max(8, Math.min(95 - bPct, ((sd.height || 300) / modInnerH) * 100));
                                  return (
                                    <div
                                      key={`sd_${sdi}`}
                                      style={{ left: `${xPct}%`, bottom: `${bPct}%`, height: `${hPct}%` }}
                                      className="absolute w-[2px] bg-slate-300/80"
                                    />
                                  );
                                })}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {/* Dolap Alt Baza (Ayak / Plinth) */}
                    <div className="mx-[3px] h-[8px] rounded-b-sm bg-[#2B3342] border-x border-b border-white/15" />

                    {/* Alt Bölme Etiketleri */}
                    <div className="flex items-center gap-[3px] mt-1.5 w-full">
                      {activeModule.bays.map((b, idx) => {
                        const isSel = idx === safeBayIdx;
                        const bwMm = Math.max(150, Math.round(bayClearWidths[idx] || 600));
                        const clearCm = Math.round(bwMm / 10);
                        return (
                          <button
                            key={`lbl_${b.index}`}
                            type="button"
                            onClick={() => onSelectBayIndex(idx)}
                            style={{ flex: `${Math.max(1, bwMm)} 1 0%` }}
                            className={`py-0.5 px-1 rounded-md text-center transition cursor-pointer ${
                              isSel
                                ? "bg-[#0284C7]/35 border border-[#38BDF8]/70 text-white"
                                : "text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            <div className="text-[10px] font-bold leading-tight">B{idx + 1}</div>
                            <div className="text-[9px] font-mono opacity-85 leading-tight">
                              {unitMode === "cm" ? `${clearCm}cm` : `${bwMm}`}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {activeModule.bays.length > 1 && (
                  <div
                    data-testid="v12-bay-micro-toolbar"
                    className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-white/10"
                  >
                    <button
                      type="button"
                      onClick={onEqualizeBaysAndShelves}
                      title="Genişlikleri Eşitle — Tüm bölmeleri eşit genişliğe getirir"
                      aria-label="Genişlikleri Eşitle"
                      className="flex-1 h-8 rounded-xl bg-slate-800/85 hover:bg-slate-700 border border-white/15 text-slate-100 hover:text-white flex items-center justify-center gap-1 text-[10.5px] font-semibold transition cursor-pointer"
                    >
                      <Columns2 className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                      <span className="sr-only">Genişlikleri Eşitle</span>
                    </button>
                    {onCopyBayInteriorToAllBays && (
                      <button
                        type="button"
                        data-testid="v12-copy-bay-interior-btn"
                        onClick={() => onCopyBayInteriorToAllBays(safeBayIdx)}
                        title="İç Düzeni Tüm Bölmelere Kopyala — Bu bölmedeki raf, çekmece ve askı düzenini diğer tüm bölmelere uygular"
                        aria-label="İç Düzeni Tüm Bölmelere Kopyala"
                        className="flex-1 h-8 rounded-xl bg-slate-800/85 hover:bg-slate-700 border border-white/15 text-slate-100 hover:text-white flex items-center justify-center gap-1 text-[10.5px] font-semibold transition cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                        <span className="sr-only">İç Düzeni Tüm Bölmelere Kopyala</span>
                      </button>
                    )}
                    {onMirrorModuleBays && (
                      <button
                        type="button"
                        data-testid="v12-mirror-bays-btn"
                        onClick={onMirrorModuleBays}
                        title="Simetri — Sol ve sağ bölmelerin dizilimini ve kapak yönlerini aynalar"
                        aria-label="Simetri"
                        className="flex-1 h-8 rounded-xl bg-slate-800/85 hover:bg-slate-700 border border-white/15 text-slate-100 hover:text-white flex items-center justify-center gap-1 text-[10.5px] font-semibold transition cursor-pointer"
                      >
                        <FlipHorizontal2 className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                        <span className="sr-only">Simetri</span>
                      </button>
                    )}
                    {!(isSlidingBay && activeModule.bays.length <= 2) && (
                      <button
                        type="button"
                        onClick={() => onRemoveBayAt(safeBayIdx)}
                        title={`${safeBayIdx + 1}. Bölmeyi Kaldır`}
                        aria-label={`${safeBayIdx + 1}. Bölmeyi Kaldır`}
                        className="flex-1 h-8 rounded-xl bg-red-500/12 hover:bg-red-500/25 border border-red-400/25 text-red-300 hover:text-red-200 flex items-center justify-center gap-1 text-[10.5px] font-semibold transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5 shrink-0" />
                        <span className="sr-only">{safeBayIdx + 1}. Bölmeyi Kaldır</span>
                      </button>
                    )}
                  </div>
                )}

                {!isSimple && activeModule.bays.length > 1 && (
                  <div className="pt-2 border-t border-[#F0ECE3] space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#57534E]">{safeBayIdx + 1}. Bölme İç Genişlik</span>
                      <span className="font-mono font-bold">
                        {unitMode === "cm" ? `${Number(((bayClearWidths[safeBayIdx] || 600) / 10).toFixed(1))} cm` : `${Math.round(bayClearWidths[safeBayIdx] || 600)} mm`}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={280}
                      max={Math.max(400, wMm - 320)}
                      step={10}
                      value={Math.round(bayClearWidths[safeBayIdx] || 600)}
                      onPointerDown={() => onBeginSliderDrag?.()}
                      onPointerUp={() => onCommitSliderDrag?.()}
                      onPointerCancel={() => onCommitSliderDrag?.()}
                      onBlur={() => onCommitSliderDrag?.()}
                      onChange={(e) => onSetBayCustomWidth(safeBayIdx, Number(e.target.value))}
                      className="w-full accent-[#141413] cursor-pointer"
                    />
                  </div>
                )}
              </div>

              {formattedFinding && activeFinding && (
                <div className="p-3.5 rounded-2xl bg-[#F7F2E7] border border-[#E3D5B8] space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-[#6B4F28] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{formattedFinding.title}</span>
                    </span>
                  </div>
                  <p className="text-[11px] text-[#57534E] leading-relaxed">
                    {formattedFinding.detail}
                  </p>
                  {activeFinding.remediationProposals &&
                    activeFinding.remediationProposals.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {activeFinding.remediationProposals.slice(0, 2).map((prop) => (
                          <button
                            key={prop.id}
                            type="button"
                            onClick={() => onApplyApprovedFix(prop)}
                            className="px-3 py-1.5 rounded-full bg-[#141413] hover:bg-[#292524] text-white text-[11px] font-semibold cursor-pointer transition"
                          >
                            Uygula: {prop.label}
                          </button>
                        ))}
                      </div>
                    )}
                </div>
              )}

              <div className="space-y-2">
                <div className="text-[11px] font-bold text-[#57534E] px-0.5">
                  {safeBayIdx + 1}. Bölme Hazır İç Düzeni
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {V11_INTERIOR_PRESETS.map((pr) => {
                    const isMultiShelf = pr.id === "shelves_5";
                    return (
                      <div key={pr.id} className="relative">
                        <button
                          type="button"
                          title={`${pr.title} — ${pr.subtitle}`}
                          onClick={() => {
                            if (isMultiShelf) {
                              setMultiShelfOpen(true);
                              onApplyBayPreset(safeBayIdx, pr.id, {
                                shelfCount: multiShelfCount,
                                shelfMountMode: multiShelfMount,
                                shelfThicknessMm: multiShelfThick,
                              });
                            } else {
                              setMultiShelfOpen(false);
                              onApplyBayPreset(safeBayIdx, pr.id);
                            }
                          }}
                          className={`w-full p-2.5 rounded-2xl bg-white hover:bg-[#F5F2EA] border flex items-center gap-2.5 text-left transition cursor-pointer ${
                            isMultiShelf && multiShelfOpen
                              ? "border-[#141413] ring-1 ring-[#141413]/20"
                              : "border-[#E5DFD3] hover:border-[#141413]/40"
                          }`}
                        >
                          {renderPresetSvg(pr.diagram)}
                          <div className="min-w-0 pr-4">
                            <div className="font-bold text-[#141413] text-[11.5px] leading-tight">{pr.title}</div>
                          </div>
                        </button>
                        {isMultiShelf && (
                          <button
                            type="button"
                            title="Çok Raflı Ayarları"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMultiShelfOpen((v) => !v);
                            }}
                            className={`absolute top-2 right-2 w-6 h-6 rounded-lg flex items-center justify-center transition cursor-pointer ${
                              multiShelfOpen
                                ? "bg-[#141413] text-white"
                                : "bg-[#F5F2EA] text-[#57534E] hover:bg-[#EAE3D5]"
                            }`}
                          >
                            <SlidersHorizontal className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                {multiShelfOpen && (
                  <div className="p-3 rounded-2xl bg-white border border-[#DED8CC] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-[#141413]">
                        Çok Raflı Ayarları
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            const next = Math.max(2, multiShelfCount - 1);
                            setMultiShelfCount(next);
                            onApplyBayPreset(safeBayIdx, "shelves_5", {
                              shelfCount: next,
                              shelfMountMode: multiShelfMount,
                              shelfThicknessMm: multiShelfThick,
                            });
                          }}
                          className="w-7 h-7 rounded-lg bg-[#F5F2EA] hover:bg-[#EAE3D5] flex items-center justify-center cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-12 text-center font-mono text-xs font-bold text-[#141413]">
                          {multiShelfCount} Raf
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const next = Math.min(10, multiShelfCount + 1);
                            setMultiShelfCount(next);
                            onApplyBayPreset(safeBayIdx, "shelves_5", {
                              shelfCount: next,
                              shelfMountMode: multiShelfMount,
                              shelfThicknessMm: multiShelfThick,
                            });
                          }}
                          className="w-7 h-7 rounded-lg bg-[#F5F2EA] hover:bg-[#EAE3D5] flex items-center justify-center cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {(
                        [
                          { id: "auto", label: "Orta Sabit" },
                          { id: "all_adjustable", label: "Tümü Hareketli" },
                          { id: "all_fixed", label: "Tümü Sabit" },
                        ] as const
                      ).map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setMultiShelfMount(m.id);
                            onApplyBayPreset(safeBayIdx, "shelves_5", {
                              shelfCount: multiShelfCount,
                              shelfMountMode: m.id,
                              shelfThicknessMm: multiShelfThick,
                            });
                          }}
                          className={`py-1.5 px-1.5 rounded-lg text-[10.5px] font-semibold cursor-pointer ${
                            multiShelfMount === m.id
                              ? "bg-[#141413] text-white"
                              : "bg-[#F5F2EA] hover:bg-[#EAE3D5] text-[#44403C]"
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {([18, 25] as const).map((th) => (
                        <button
                          key={th}
                          type="button"
                          onClick={() => {
                            setMultiShelfThick(th);
                            onApplyBayPreset(safeBayIdx, "shelves_5", {
                              shelfCount: multiShelfCount,
                              shelfMountMode: multiShelfMount,
                              shelfThicknessMm: th,
                            });
                          }}
                          className={`py-1.5 rounded-lg font-mono text-[11px] font-semibold cursor-pointer ${
                            multiShelfThick === th
                              ? "bg-[#141413] text-white"
                              : "bg-[#F5F2EA] hover:bg-[#EAE3D5] text-[#44403C]"
                          }`}
                        >
                          {th} mm Raf Kalınlığı
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between px-0.5">
                  <span className="text-[11px] font-bold text-[#57534E]">+ İç Eleman</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(() => {
                    const allowedSet = getCompatibleInteriorElementsForModuleBay(
                      activeModule,
                      safeBayIdx
                    );
                    const allCandidates: Array<{
                      compatKey: CompatibleInteriorElementKey;
                      id: string;
                      label: string;
                      visual: InteriorVisualKind;
                      dragVisual: string;
                      count: number;
                      onClick: () => void;
                    }> = [
                      {
                        compatKey: "movable_shelf",
                        id: "lib_shelf",
                        label: "Hareketli Raf",
                        visual: "shelf",
                        dragVisual: "shelf",
                        count:
                          activeBay?.shelves.filter(
                            (s) => !s.isHidden && s.isAdjustable !== false && !s.isFixed
                          ).length || 0,
                        onClick: () => onAddShelf(safeBayIdx),
                      },
                      {
                        compatKey: "fixed_shelf",
                        id: "lib_fixed_shelf",
                        label: "Sabit Taşıyıcı Raf",
                        visual: "fixed_shelf",
                        dragVisual: "shelf",
                        count:
                          activeBay?.shelves.filter(
                            (s) => !s.isHidden && (s.isAdjustable === false || Boolean(s.isFixed))
                          ).length || 0,
                        onClick: () => onAddFixedShelf(safeBayIdx),
                      },
                      {
                        compatKey: "external_drawer",
                        id: "lib_drawer",
                        label: "Dış Çekmece",
                        visual: "drawer",
                        dragVisual: "drawer",
                        count: activeBay?.drawers.filter((d) => !d.isInternal).length || 0,
                        onClick: () => onAddDrawer(safeBayIdx),
                      },
                      {
                        compatKey: "internal_drawer",
                        id: "lib_internal_drawer",
                        label: isSlidingBay ? "Sürgü İçi Çekmece" : "Gizli İç Çekmece",
                        visual: "internal_drawer",
                        dragVisual: "internal_drawer",
                        count:
                          activeBay?.drawers.filter((d) => Boolean(d.isInternal) || isSlidingBay)
                            .length || 0,
                        onClick: () => onAddInternalDrawer(safeBayIdx),
                      },
                      {
                        compatKey: "sub_divider",
                        id: "lib_sub_divider",
                        label: "Raf Arası Dikme",
                        visual: "sub_divider",
                        dragVisual: "sub_divider",
                        count: activeBay?.subDividers?.length || 0,
                        onClick: () => onAddSubDivider(safeBayIdx),
                      },
                      {
                        compatKey: "waste_bin",
                        id: "lib_waste_bin",
                        label: "Raylı Çöp Sistemi",
                        visual: "waste_bin",
                        dragVisual: "waste_bin",
                        count:
                          activeBay?.specialFittings.filter((f) => f.type === "waste_bin")
                            .length || 0,
                        onClick: () => onAddSpecialFitting(safeBayIdx, "waste_bin"),
                      },
                      {
                        compatKey: "spice_pullout",
                        id: "lib_spice_pullout",
                        label: "Teleskopik Şişelik",
                        visual: "spice_pullout",
                        dragVisual: "spice_pullout",
                        count:
                          activeBay?.specialFittings.filter((f) => f.type === "spice_pullout")
                            .length || 0,
                        onClick: () => onAddSpecialFitting(safeBayIdx, "spice_pullout"),
                      },
                      {
                        compatKey: "pantry_pullout",
                        id: "lib_pantry_pullout",
                        label: "Boy Kiler Mekanizması",
                        visual: "pantry_pullout",
                        dragVisual: "pantry_pullout",
                        count:
                          activeBay?.specialFittings.filter((f) => f.type === "pantry_pullout")
                            .length || 0,
                        onClick: () => onAddSpecialFitting(safeBayIdx, "pantry_pullout"),
                      },
                      {
                        compatKey: "corner_lemans",
                        id: "lib_corner_lemans",
                        label: "Kör Köşe LeMans II",
                        visual: "corner_lemans",
                        dragVisual: "corner_lemans",
                        count:
                          activeBay?.specialFittings.filter((f) => f.type === "corner_lemans")
                            .length || 0,
                        onClick: () => onAddSpecialFitting(safeBayIdx, "corner_lemans"),
                      },
                      {
                        compatKey: "wire_basket",
                        id: "lib_wire_basket",
                        label: "Tel Sepet",
                        visual: "wire_basket",
                        dragVisual: "wire_basket",
                        count:
                          activeBay?.specialFittings.filter((f) => f.type === "wire_basket")
                            .length || 0,
                        onClick: () => onAddSpecialFitting(safeBayIdx, "wire_basket"),
                      },
                      {
                        compatKey: "hanging_rail",
                        id: "lib_rail",
                        label: "Elbise Askısı",
                        visual: "rail",
                        dragVisual: "rail",
                        count: activeBay?.hangingRails.length || 0,
                        onClick: () => onAddHangingRail(safeBayIdx),
                      },
                      {
                        compatKey: "trouser_pullout",
                        id: "lib_trouser_rack",
                        label: "Pantolonluk",
                        visual: "trouser_rack",
                        dragVisual: "trouser_rack",
                        count:
                          activeBay?.specialFittings.filter((f) => f.type === "trouser_rack")
                            .length || 0,
                        onClick: () => onAddSpecialFitting(safeBayIdx, "trouser_rack"),
                      },
                      {
                        compatKey: "shoe_pullout",
                        id: "lib_shoe_rack",
                        label: "Ayakkabılık",
                        visual: "shoe_rack",
                        dragVisual: "shoe_rack",
                        count:
                          activeBay?.specialFittings.filter((f) => f.type === "shoe_rack").length ||
                          0,
                        onClick: () => onAddSpecialFitting(safeBayIdx, "shoe_rack"),
                      },
                      {
                        compatKey: "jewelry_tray",
                        id: "lib_jewelry_tray",
                        label: "Takı Çekmecesi",
                        visual: "jewelry_tray",
                        dragVisual: "jewelry_tray",
                        count:
                          activeBay?.specialFittings.filter((f) => f.type === "jewelry_tray")
                            .length || 0,
                        onClick: () => onAddSpecialFitting(safeBayIdx, "jewelry_tray"),
                      },
                      {
                        compatKey: "pantograph_lift",
                        id: "lib_wardrobe_lift",
                        label: "Asansörlü Askı",
                        visual: "rail",
                        dragVisual: "wardrobe_lift",
                        count:
                          activeBay?.specialFittings.filter((f) => f.type === "wardrobe_lift")
                            .length || 0,
                        onClick: () => onAddSpecialFitting(safeBayIdx, "wardrobe_lift"),
                      },
                      {
                        compatKey: "led_hanging_rail",
                        id: "lib_rail_led",
                        label: "LED'li Askı Borusu",
                        visual: "rail",
                        dragVisual: "rail",
                        count: (activeModule as unknown as { lighting?: { enabled?: boolean } }).lighting?.enabled ? 1 : 0,
                        onClick: () => {
                          onAddHangingRail(safeBayIdx);
                          onToggleModuleLed(true, { ledType: "led_rod_strip" });
                        },
                      },
                      {
                        compatKey: "tie_belt_rack",
                        id: "lib_tie_belt",
                        label: "Kemer & Kravatlık",
                        visual: "trouser_rack",
                        dragVisual: "tie_rack",
                        count:
                          activeBay?.specialFittings.filter((f) => f.type === "tie_rack")
                            .length || 0,
                        onClick: () => onAddSpecialFitting(safeBayIdx, "tie_rack"),
                      },
                    ];
                    return allCandidates.filter((c) => allowedSet.has(c.compatKey));
                  })().map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      draggable={false}
                      onPointerDown={(e) =>
                        startLive3DPartGrab(
                          e,
                          {
                            id: item.id,
                            title: item.label,
                            visual: item.dragVisual,
                          },
                          item.onClick
                        )
                      }
                      onKeyDown={(ke) => {
                        if (ke.key === "Enter" || ke.key === " ") {
                          ke.preventDefault();
                          item.onClick();
                        }
                      }}
                      title={`${item.label} — Tıklayın veya basılı tutup doğrudan 3B dolabın içine taşıyın`}
                      className="group relative p-2 rounded-2xl bg-white hover:bg-[#F5F2EA] border border-[#E5DFD3] hover:border-[#38BDF8]/70 flex flex-col items-stretch gap-1.5 text-left transition cursor-grab active:cursor-grabbing touch-none select-none"
                    >
                      <div className="relative h-[76px] w-full rounded-xl bg-[#181D27]/85 border border-white/12 flex items-center justify-center overflow-hidden">
                        {renderInteriorItemSvg(item.visual, item.id)}
                        <span
                          className={`absolute top-1.5 right-1.5 min-w-[20px] h-5 px-1.5 rounded-full text-[10.5px] font-bold flex items-center justify-center ${
                            item.count > 0
                              ? "bg-gradient-to-br from-[#0284C7] to-[#1E40AF] text-white shadow-[0_0_10px_rgba(29,78,216,0.52)]"
                              : "bg-white/12 text-slate-200 border border-white/15"
                          }`}
                        >
                          {item.count > 0 ? item.count : "+"}
                        </span>
                      </div>
                      <span className="font-bold text-[#141413] text-[11.5px] leading-tight text-center px-0.5 truncate">
                        {item.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Çekmece Ray & Kasa Sistemi (Pro / Üretim — Fiziksel aksesuarlar üstteki İç Eleman Ekle grubundadır) */}
              <InspectorDrawerBoxSystemCard activeModule={activeModule} isSimple={isSimple} onUpdateCarcassConfig={onUpdateCarcassConfig} renderApplyCarcassToAllBtn={renderApplyCarcassToAllBtn} />

              {activeBay && (
                <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#141413]">
                      {safeBayIdx + 1}. Bölmedeki Elemanlar
                    </span>
                    {!isSimple && activeBay.shelves.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const curThick =
                            activeBay.shelves[0]?.thickness ||
                            activeModule.carcass.panelThickness ||
                            18;
                          onSetShelfThickness(safeBayIdx, "all", curThick === 25 ? 18 : 25);
                        }}
                        className="px-2 py-0.5 rounded-full bg-[#F5F2EA] hover:bg-[#EAE3D5] text-[10.5px] font-semibold cursor-pointer"
                      >
                        Tüm Raflar: {activeBay.shelves[0]?.thickness || activeModule.carcass.panelThickness || 18} mm
                      </button>
                    )}
                  </div>

                  <InspectorBayShelvesList activeBay={activeBay} activeModule={activeModule} isSimple={isSimple} onRemoveShelf={onRemoveShelf} onSetShelfElevation={onSetShelfElevation} onSetShelfMountType={onSetShelfMountType} safeBayIdx={safeBayIdx} />

                  <div className="flex flex-wrap gap-1.5">
                    <InspectorBayDrawersRailsFittingsList activeBay={activeBay} activeModule={activeModule} hasAnyInternalDrawer={hasAnyInternalDrawer} internalDrawerBlindControlPanel={internalDrawerBlindControlPanel} isSimple={isSimple} isSlidingBay={isSlidingBay} onRemoveDrawer={onRemoveDrawer} onRemoveHangingRail={onRemoveHangingRail} onRemoveSpecialFitting={onRemoveSpecialFitting} onSetDrawerPlacement={onSetDrawerPlacement} onSetHangingRailProfile={onSetHangingRailProfile} onUpdateCarcassConfig={onUpdateCarcassConfig} safeBayIdx={safeBayIdx} />

                    {(activeBay.subDividers || []).length > 0 && (
                      <div className="w-full space-y-1.5 pt-1">
                        {(activeBay.subDividers || []).map((sd, i) => {
                          const curIvIdx = Math.max(
                            0,
                            subDividerIntervals.findIndex(
                              (iv) =>
                                Math.abs(iv.botY - sd.elevationY) <= 22 ||
                                (sd.elevationY + sd.height / 2 >= iv.botY &&
                                  sd.elevationY + sd.height / 2 <= iv.topY)
                            )
                          );
                          const bayW = bayClearWidths[safeBayIdx] || 600;
                          const panelT = activeModule.carcass.panelThickness || 18;
                          return (
                            <div
                              key={sd.id}
                              data-testid={`v12-subdivider-row-${i}`}
                              className="w-full px-2.5 py-2 rounded-xl bg-[#F8F5EE] border border-[#E2DACB] space-y-1.5 text-[11px]"
                            >
                              <div className="flex items-center justify-between gap-1.5">
                                <span className="font-bold text-[#141413]">
                                  Raf Arası Dikme {i + 1}
                                </span>
                                <div className="flex items-center gap-1">
                                  {onSetSubDividerPlacement && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onSetSubDividerPlacement(safeBayIdx, sd.id, {
                                          offsetX: Math.round((bayW - panelT) / 2),
                                        })
                                      }
                                      className="px-2 py-0.5 rounded-full bg-white border border-[#DED8CC] text-[10px] font-semibold text-[#44403C] hover:text-[#141413] cursor-pointer"
                                      title="Dikmeyi bölme genişliğinin tam ortasına hizala"
                                    >
                                      Ortala
                                    </button>
                                  )}
                                  {!isSimple && onSetSubDividerPlacement && (
                                    <input
                                      type="number" inputMode="decimal"
                                      step={unitMode === "cm" ? 1 : 10}
                                      value={unitMode === "cm" ? Number((sd.offsetX / 10).toFixed(1)) : Math.round(sd.offsetX)}
                                      onChange={(e) => {
                                        const raw = Number(e.target.value) || 0;
                                        const mmVal = unitMode === "cm" ? Math.round(raw * 10) : Math.round(raw);
                                        onSetSubDividerPlacement(safeBayIdx, sd.id, {
                                          offsetX: Math.max(40, mmVal),
                                        });
                                      }}
                                      className="w-20 h-8 px-2 rounded-lg bg-white border border-[#DED8CC] font-mono text-xs font-semibold text-center"
                                      title={`Bölme solundan mesafe (${unitMode})`}
                                    />
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => onRemoveSubDivider(safeBayIdx, sd.id)}
                                    className="w-5 h-5 rounded-full hover:bg-red-50 text-[#78716C] hover:text-red-600 flex items-center justify-center cursor-pointer"
                                    title="Raf Arası Dikmeyi Kaldır"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>

                              {onSetSubDividerPlacement && subDividerIntervals.length > 0 && (
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-[#78716C] shrink-0">Aralık:</span>
                                  <StudioSelect
                                    ariaLabel={`Raf Arası Dikme ${i + 1} Raf Aralığı`}
                                    size="sm"
                                    className="flex-1 min-w-0"
                                    value={curIvIdx}
                                    onChange={(val) => {
                                      const targetIv = subDividerIntervals[Number(val)];
                                      if (targetIv) {
                                        onSetSubDividerPlacement(safeBayIdx, sd.id, {
                                          elevationY: targetIv.botY,
                                          height: targetIv.height,
                                          targetMidY: Math.round((targetIv.botY + targetIv.topY) / 2),
                                        });
                                      }
                                    }}
                                    options={subDividerIntervals.map((iv, ivIdx) => ({
                                      value: String(ivIdx),
                                      label: `${iv.label} (${
                                        unitMode === "cm"
                                          ? `${Number((iv.height / 10).toFixed(1))} cm`
                                          : `${Math.round(iv.height)} mm`
                                      })`,
                                    }))}
                                  />
                                  {subDividerIntervals.length > 1 && (
                                    <>
                                      <button
                                        type="button"
                                        disabled={curIvIdx >= subDividerIntervals.length - 1}
                                        onClick={() => {
                                          const upIv = subDividerIntervals[curIvIdx + 1];
                                          if (upIv) {
                                            onSetSubDividerPlacement(safeBayIdx, sd.id, {
                                              elevationY: upIv.botY,
                                              height: upIv.height,
                                              targetMidY: Math.round((upIv.botY + upIv.topY) / 2),
                                            });
                                          }
                                        }}
                                        title="Üst raf aralığına taşı"
                                        className="px-1.5 h-6 rounded-lg bg-white hover:bg-[#EFECE4] disabled:opacity-35 border border-[#DED8CC] font-bold text-[10px] cursor-pointer"
                                      >
                                        ⬆
                                      </button>
                                      <button
                                        type="button"
                                        disabled={curIvIdx <= 0}
                                        onClick={() => {
                                          const dnIv = subDividerIntervals[curIvIdx - 1];
                                          if (dnIv) {
                                            onSetSubDividerPlacement(safeBayIdx, sd.id, {
                                              elevationY: dnIv.botY,
                                              height: dnIv.height,
                                              targetMidY: Math.round((dnIv.botY + dnIv.topY) / 2),
                                            });
                                          }
                                        }}
                                        title="Alt raf aralığına taşı"
                                        className="px-1.5 h-6 rounded-lg bg-white hover:bg-[#EFECE4] disabled:opacity-35 border border-[#DED8CC] font-bold text-[10px] cursor-pointer"
                                      >
                                        ⬇
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {activeBay.shelves.length === 0 &&
                      activeBay.drawers.length === 0 &&
                      activeBay.hangingRails.length === 0 &&
                      activeBay.specialFittings.length === 0 && (
                        <span className="text-[11px] text-[#78716C]">
                          Bu bölmede henüz iç eleman yok. Yukarıdan ekleyebilirsiniz.
                        </span>
                      )}
                  </div>
                </div>
              )}

              {/* Gömme İç LED Aydınlatma (İç Düzen) */}
              <InspectorLedLightingCard activeModule={activeModule} isSimple={isSimple} onToggleModuleLed={onToggleModuleLed} />
            </>
              )}
            </>
          )}

          <InspectorDoorsTab activeBay={activeBay} activeModule={activeModule} activeTab={activeTab} applyDoorPatchAcrossScope={applyDoorPatchAcrossScope} batchApplyDoorModelToModule={batchApplyDoorModelToModule} batchApplyDrawerFrontToAll={batchApplyDrawerFrontToAll} batchApplyHandlesToAllModules={batchApplyHandlesToAllModules} batchApplyHandlesToModule={batchApplyHandlesToModule} curDoorProfile={curDoorProfile} curDoorType={curDoorType} customDoorOpen={customDoorOpen} customDoorProfiles={customDoorProfiles} doorFrontSubTab={doorFrontSubTab} handleFilterTab={handleFilterTab} handleProfiles={handleProfiles} hasExternalDrawersInActiveBay={hasExternalDrawersInActiveBay} isKitchenCornerMod={isKitchenCornerMod} isSimple={isSimple} mainModuleIndices={mainModuleIndices} onAddSpecialFitting={onAddSpecialFitting} onCopyDoorToAllBays={onCopyDoorToAllBays} onOpenCustomHardwareModal={onOpenCustomHardwareModal} onRemoveSpecialFitting={onRemoveSpecialFitting} onSetBayDoorType={onSetBayDoorType} onSetBayV4DoorConfig={onSetBayV4DoorConfig} onSetDrawerPlacement={onSetDrawerPlacement} onSetSlidingMountingType={onSetSlidingMountingType} onUpdateCarcassConfig={onUpdateCarcassConfig} safeBayIdx={safeBayIdx} selectedCustomDoorId={selectedCustomDoorId} selectedDrawerFrontId={selectedDrawerFrontId} setBatchApplyDoorModelToModule={setBatchApplyDoorModelToModule} setBatchApplyDrawerFrontToAll={setBatchApplyDrawerFrontToAll} setBatchApplyHandlesToAllModules={setBatchApplyHandlesToAllModules} setBatchApplyHandlesToModule={setBatchApplyHandlesToModule} setCustomDoorOpen={setCustomDoorOpen} setCustomDoorProfiles={setCustomDoorProfiles} setDoorFrontSubTab={setDoorFrontSubTab} setHandleFilterTab={setHandleFilterTab} setSelectedCustomDoorId={setSelectedCustomDoorId} setSelectedDrawerFrontId={setSelectedDrawerFrontId} />
          <InspectorMaterialsTab activeMatId={activeMatId} activeModule={activeModule} activeTab={activeTab} customMatOpen={customMatOpen} materialGroup={materialGroup} materialSearch={materialSearch} materialTarget={materialTarget} newMatCat={newMatCat} newMatGrain={newMatGrain} newMatHex={newMatHex} newMatName={newMatName} onAddCustomMaterial={onAddCustomMaterial} onApplyMaterialScope={onApplyMaterialScope} onUpdateCarcassConfig={onUpdateCarcassConfig} setCustomMatOpen={setCustomMatOpen} setMaterialGroup={setMaterialGroup} setMaterialSearch={setMaterialSearch} setMaterialTarget={setMaterialTarget} setNewMatCat={setNewMatCat} setNewMatGrain={setNewMatGrain} setNewMatHex={setNewMatHex} setNewMatName={setNewMatName} visibleMaterials={visibleMaterials} />
        </div>
      </aside>
      </>
    );
  }
);

RightParametricInspector.displayName = "RightParametricInspector";
