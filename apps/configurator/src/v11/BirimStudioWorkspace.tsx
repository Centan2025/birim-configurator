"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  DEFAULT_MATERIALS,
  loadCustomStandardRules,
  computeBayDoorZones,
  resolveDoorZoneKeyFromComponentId,
  type CustomStandardMetric,
  type CustomStandardRule,
  type DesignProject,
} from "@birim/core";
import { V5_SPECIALIZED_MODULE_TEMPLATES } from "@birim/catalog";
import { convertSceneObjectsToExportBoxes, generateModuleGeometry } from "@birim/geometry";
import {
  useV3Adapter,
  KITCHEN_ENGINEERING_RULE_REGISTRY,
  type EngineeringValidationFinding,
} from "../v3/adapter/useV3Adapter";
import { useConfiguratorStore } from "../store/useConfiguratorStore";
import { V3ThreeViewport } from "../v3/components/V3ThreeViewport";
import type { CommandPaletteAction } from "../v3/components/workspace/CommandSearchModal";

import { StudioHeaderBar } from "./StudioHeaderBar";
import { useDeviceProfile } from "./useDeviceProfile";
import { safeLocalStorageGet, safeLocalStorageSet } from "../lib/safeStorage";
import { LeftCatalogLauncher } from "./LeftCatalogLauncher";
import { RightParametricInspector } from "./RightParametricInspector";
import { ShowroomPresentationOverlay } from "./ShowroomPresentationOverlay";
import { BottomSceneDock } from "./BottomSceneDock";
import { OnObjectQuickToolbar, type Selected3DPartKind } from "./OnObjectQuickToolbar";
import { HardwareQuickSwapPopover, type HardwareSwapGroup, type HardwareSwapTarget } from "./HardwareQuickSwapPopover";
import { QuickStyleAndMaterialDock } from "./QuickStyleAndMaterialDock";
import { resolveModuleHostWallId, wallIntervalToModulePosition, computeRoomDynamicCenter } from "../v3/engine/multiWallSnapAndBvhEngine";
import { getEffectiveSpaceWalls, getModuleOrientedFootprint } from "../v3/engine/kitchenSpatialEngine";
import { getWallRoomBasis } from "../v3/engine/angledWallSnapEngine";
import { AnimatedModalPresence, AnimatedValuePresence } from "./AnimatedWindowPresence";
import {
  BIRIM_CURATED_MOODBOARDS,
  applyZoneMaterialToProjectDraft,
  applyCuratedMoodboardToProjectDraft,
  replaceExistingMaterialAcrossProjectDraft,
  dispatchPaintToolState3D,
  type QuickZoneScope,
  type CuratedBirimMoodboard,
  type PaintTool3DState,
} from "./quickMaterialAndMoodboardEngine";
import type {
  V11CadSubMode,
  V11InspectorTab,
  V11LeftDrawerTab,
  V11WorkspaceMode,
} from "./v11Constants";

// Performans: İlk 3B açılışta kullanılmayan 2B CAD ve 19 modal/panel React.lazy ile tembel yüklenir (~%45-55 ilk JS azalması).
// next/dynamic({ ssr: false }) yerine React.lazy + Suspense kullanmak React 19 DevTools hydrated Suspense hatasını da önler.
const V3CadViewport2D = React.lazy(() => import("../v3/components/V3CadViewport2D"));
const BomModal = React.lazy(() => import("../components/BomModal"));
const StoreErpModal = React.lazy(() => import("../components/StoreErpModal"));
const CommandSearchModal = React.lazy(() => import("../v3/components/workspace/CommandSearchModal").then((m) => ({ default: m.CommandSearchModal })));
const DoorSystemsShowcaseModal = React.lazy(() => import("./DoorSystemsShowcaseModal").then((m) => ({ default: m.DoorSystemsShowcaseModal })));
const V3ProjectModal = React.lazy(() => import("../v3/components/V3ProjectModal").then((m) => ({ default: m.V3ProjectModal })));
const AssemblyDiagramModal = React.lazy(() => import("../v3/components/workspace/AssemblyDiagramModal").then((m) => ({ default: m.AssemblyDiagramModal })));
const StudioRenderModal = React.lazy(() => import("../v3/components/workspace/StudioRenderModal").then((m) => ({ default: m.StudioRenderModal })));
const ArRoomPreviewModal = React.lazy(() => import("../v3/components/workspace/ArRoomPreviewModal").then((m) => ({ default: m.ArRoomPreviewModal })));
const RulesStandardsModal = React.lazy(() => import("../v3/components/workspace/RulesStandardsModal").then((m) => ({ default: m.RulesStandardsModal })));
const SaasTenantStudioModal = React.lazy(() => import("../v3/components/workspace/SaasTenantStudioModal").then((m) => ({ default: m.SaasTenantStudioModal })));
const KitchenIslandTableModal = React.lazy(() => import("../v3/components/workspace/KitchenIslandTableModal").then((m) => ({ default: m.KitchenIslandTableModal })));
const CustomHardwareModal = React.lazy(() => import("../v3/components/workspace/CustomHardwareModal").then((m) => ({ default: m.CustomHardwareModal })));
const MepCoordinationModal = React.lazy(() => import("../v3/components/workspace/MepCoordinationModal").then((m) => ({ default: m.MepCoordinationModal })));
const SceneObjectAndModuleHubModal = React.lazy(() => import("../v3/components/workspace/SceneObjectAndModuleHubModal").then((m) => ({ default: m.SceneObjectAndModuleHubModal })));
const GuidedSetupModal = React.lazy(() => import("./GuidedSetupModal").then((m) => ({ default: m.GuidedSetupModal })));
const QuoteSummaryModal = React.lazy(() => import("./QuoteSummaryModal").then((m) => ({ default: m.QuoteSummaryModal })));
const SectionPlaneMiniMap = React.lazy(() => import("./SectionPlaneMiniMap").then((m) => ({ default: m.SectionPlaneMiniMap })));
const PanelCutoutModal = React.lazy(() => import("./PanelCutoutModal").then((m) => ({ default: m.PanelCutoutModal })));
const ProductionSheetStudioModal = React.lazy(() => import("./ProductionSheetStudioModal").then((m) => ({ default: m.ProductionSheetStudioModal })));

const EMPTY_SCENE_OBJECTS: NonNullable<DesignProject["sceneObjects"]> = [];
const EMPTY_FINDINGS: EngineeringValidationFinding[] = [];

export interface BirimStudioWorkspaceProps {
  initialMode?: "studio" | "plan" | "showroom";
}

export const BirimStudioWorkspace: React.FC<BirimStudioWorkspaceProps> = ({
  initialMode = "studio",
}) => {
  const {
    project,
    activeModule,
    activeModuleIndex,
    activeBayIndex,
    pricing,
    bom,
    canUndo,
    canRedo,
    undo,
    redo,
    doorOpenAngleDeg,
    setDoorOpenAngleDeg,
    explodedFactor,
    setExplodedFactor,
    cncXrayMode,
    toggleCncXrayMode,
    v4ModuleTemplates,
    handleProfiles,
    spaceObstacles,
    spaceWalls,
    unifiedEngineeringReport,
    ergonomicProfileId,
    setErgonomicProfileId,
    regionalErgonomicProfiles,
    applyApprovedEngineeringFix,
    setActiveModuleIndex,
    setActiveBayIndex,
    setDimensions,
    setPlinthHeight,
    splitBayIntoTwo,
    equalizeBaysAndShelves,
    removeBayAt,
    setBayCustomWidth,
    applyBayInteriorPreset,
    addShelf,
    addFixedShelf,
    setShelfMountType,
    removeShelf,
    setShelfElevation,
    setShelfThickness,
    addDrawer,
    addInternalDrawer,
    setDrawerPlacement,
    removeDrawer,
    addHangingRail,
    setHangingRailElevation,
    setHangingRailProfile,
    removeHangingRail,
    addSpecialFitting,
    removeSpecialFitting,
    addSubDivider,
    setSubDividerPlacement,
    removeSubDivider,
    removeSelectedInteriorComponent,
    selectedComponentId,
    setBayDoorType,
    setModuleSlidingMountingType,
    setBayV4DoorConfig,
    copyDoorConfigToAllBays,
    copyBayInteriorToAllBays,
    mirrorModuleBaysLeftRight,
    updateCarcassConfig,
    applyMaterialByTargetScope,
    addCustomMaterialToProject,
    toggleModuleLedLighting,
    applyV4Template,
    dropV4TemplateWithSnap,
    duplicateActiveModule,
    addStackedTopModule,
    rotateActiveModule90,
    removeActiveModule,
    removeModuleAt,
    fillWallGapWithParametricModule,
    setRoomDimensions,
    setFacadeGrainContinuity,
    beginHistoryTransaction,
    commitHistoryTransaction,
    addSpaceObstacle,
    removeSpaceObstacle,
    applyGuidedWizardLayout,
    loadDoorSystemsShowcase,
    addKitchenIslandUnit,
    addOrUpdateAttachedTable,
    loadLinearKitchen,
    loadLKitchen,
    loadUKitchen,
    selectedSceneObjectId,
    setSelectedSceneObjectId,
    appendModuleWithMultiWallSnap,
    addCompositeAssemblyPreset,
    saveActiveModuleAsCustomTemplate,
    deleteCustomModuleTemplate,
    addSceneObjectFromCatalog,
    addCustomSceneObject,
    updateSceneObject,
    duplicateSceneObject,
    removeSceneObject,
    addCustomCapsuleModule,
    runAutoFillersAndCrown,
    runAutoNotchObstacles,
    importRoomPlanLiDARJson,
    setModuleUtilityCutouts,
    autoResolveCornerCollisions,
  } = useV3Adapter();

  const experienceTier = useConfiguratorStore((s) => s.userExperienceTier);
  const displayUnit = useConfiguratorStore((s) => s.displayUnit);
  const setDisplayUnit = useConfiguratorStore((s) => s.setDisplayUnit);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("birim_elev_unit");
      if (saved === "mm" || saved === "cm") {
        setDisplayUnit(saved);
      }
    } catch {
      // ignore storage errors
    }
  }, [setDisplayUnit]);
  const setExperienceTier = useConfiguratorStore((s) => s.setUserExperienceTier);
  const viewportRenderStyle = useConfiguratorStore((s) => s.viewportRenderStyle);
  const setViewportRenderStyle = useConfiguratorStore((s) => s.setViewportRenderStyle);
  const activeTenantId = useConfiguratorStore((s) => s.activeTenantId);
  const updateCeilingConfig = useConfiguratorStore((s) => s.updateCeilingConfig);
  const updateBayDrawerConfig = useConfiguratorStore((s) => s.updateBayDrawerConfig);
  const [hardwareSwapTarget, setHardwareSwapTarget] = useState<HardwareSwapTarget | null>(null);
  const [doorShowcaseOpen, setDoorShowcaseOpen] = useState(false);
  const [quickPaletteOpen, setQuickPaletteOpen] = useState(false);
  const [paintToolState, setPaintToolState] = useState<PaintTool3DState>({
    mode: "none",
    materialId: "mat_camsan_iskandinav_mese",
    clickBehavior: "active_scope",
    zoneScope: "active_doors",
  });
  const [variantSnapshots, setVariantSnapshots] = useState<
    Record<"A" | "B" | "C", { project: DesignProject; priceEur: number; summaryTr: string } | null>
  >({ A: null, B: null, C: null });
  const [activeVariantSlot, setActiveVariantSlot] = useState<"A" | "B" | "C" | null>(null);

  const workspaceModeRef = useRef<V11WorkspaceMode>("3d");
  const [workspaceMode, setWorkspaceMode] = useState<V11WorkspaceMode>(() =>
    initialMode === "plan" ? "plan" : initialMode === "showroom" ? "showroom" : "3d"
  );
  const [cadSubMode, setCadSubMode] = useState<V11CadSubMode>("elevation");
  const [split2DViewMode, setSplit2DViewMode] = useState<"elevation" | "plan" | "section">("elevation");
  const [splitRatio3D, setSplitRatio3D] = useState<number>(50);
  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const [sectionAxis2D, setSectionAxis2D] = useState<"X" | "Z">("X");
  const [sectionRatio2D, setSectionRatio2D] = useState<number>(0.5);

  const [leftDrawer, setLeftDrawer] = useState<V11LeftDrawerTab>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(true);
  const [dismissedAutoFixKey, setDismissedAutoFixKey] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<V11InspectorTab>("interior");
  const [showDimensions3D, setShowDimensions3D] = useState<boolean>(true);
  const [doorsHidden3D, setDoorsHidden3D] = useState<boolean>(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onDoorsSync = (ev: Event) => {
      const next = Boolean((ev as CustomEvent<boolean>).detail);
      setDoorsHidden3D(next);
    };
    window.addEventListener("birim:doors-hidden-state-changed", onDoorsSync);
    return () => window.removeEventListener("birim:doors-hidden-state-changed", onDoorsSync);
  }, []);
  const [showInteriorProps3D, setShowInteriorProps3D] = useState<boolean>(true);
  const [toastText, setToastText] = useState<string | null>(null);
  const [selected3DContextLabel, setSelected3DContextLabel] = useState<string | null>(null);
  workspaceModeRef.current = workspaceMode;
  const [selected3DPartKind, setSelected3DPartKind] = useState<Selected3DPartKind>("bay");
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent("birim:3d-part-selected", {
        detail: { partKind: selected3DPartKind },
      })
    );
  }, [selected3DPartKind]);
  const [selected3DCompId, setSelected3DCompId] = useState<string | null>(null);
  const deviceProfile = useDeviceProfile();
  const isCompactViewport = deviceProfile.isMobile;
  const [uiFontScale, setUiFontScale] = useState<number>(1);
  const [fontScaleHydrated, setFontScaleHydrated] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const raw = Number(safeLocalStorageGet("birim_ui_font_scale") || "1");
      if (Number.isFinite(raw) && raw >= 0.75 && raw <= 1.6) {
        setUiFontScale(raw);
      }
    }
    setFontScaleHydrated(true);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.style.fontSize = "16px";
    document.documentElement.style.setProperty("--birim-canvas-label-scale", String(uiFontScale));
    window.dispatchEvent(new CustomEvent("birim:canvas-font-scale-changed", { detail: uiFontScale }));
    if (fontScaleHydrated) {
      try {
        safeLocalStorageSet("birim_ui_font_scale", String(uiFontScale));
      } catch {}
    }
  }, [uiFontScale, fontScaleHydrated]);

  // Lazy-mounted modal states
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [wizardModalOpen, setWizardModalOpen] = useState(false);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [bomModalTab, setBomModalTab] = useState<
    null | "cutlist" | "nesting" | "cnc_mpr_cix" | "blum_bxf"
  >(null);
  const [storeErpOpen, setStoreErpOpen] = useState(false);
  const [productionSheetModalOpen, setProductionSheetModalOpen] = useState(false);
  const [assemblyModalOpen, setAssemblyModalOpen] = useState(false);
  const [studioRenderOpen, setStudioRenderOpen] = useState(false);
  const [arModalOpen, setArModalOpen] = useState(false);
  const [standardsModalOpen, setStandardsModalOpen] = useState(false);
  const [saasModalOpen, setSaasModalOpen] = useState(false);
  const [commandSearchOpen, setCommandSearchOpen] = useState(false);
  const [kitchenIslandOpen, setKitchenIslandOpen] = useState(false);
  const [customHardwareOpen, setCustomHardwareOpen] = useState(false);
  const [mepModalOpen, setMepModalOpen] = useState(false);
  const [cutoutModalOpen, setCutoutModalOpen] = useState(false);
  const [sceneHubTab, setSceneHubTab] = useState<
    null | "modules" | "capsule_curved" | "appliances" | "furniture" | "custom_glb" | "automation"
  >(null);
  const [, setCatalogBump] = useState(0);

  // Standards modal local states
  const [rulesTab, setRulesTab] = useState<"audit" | "catalog" | "add_custom">("audit");
  const [customStdRules, setCustomStdRules] = useState<CustomStandardRule[]>(() =>
    typeof window !== "undefined" ? loadCustomStandardRules() : []
  );
  const [newStdName, setNewStdName] = useState("");
  const [newStdRef, setNewStdRef] = useState("Özel Fabrika Kuralı");
  const [newStdMetric, setNewStdMetric] = useState<CustomStandardMetric>("max_shelf_span_18mm");
  const [newStdThreshold, setNewStdThreshold] = useState(850);
  const [newStdCategory, setNewStdCategory] =
    useState<CustomStandardRule["appliesToCategory"]>("all");
  const [newStdSeverity, setNewStdSeverity] = useState<"warning" | "error">("warning");


  const handleChangeLeftDrawer = useCallback(
    (nextDrawer: V11LeftDrawerTab) => {
      setLeftDrawer(nextDrawer);
      if (nextDrawer && deviceProfile.singleDrawerOnly) {
        setIsInspectorOpen(false);
        setQuickPaletteOpen(false);
      }
    },
    [deviceProfile.singleDrawerOnly]
  );

  const showToast = useCallback((msg: string) => {
    setToastText(msg);
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        setToastText((prev) => (prev === msg ? null : prev));
      }, 2400);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onBay3D = (ev: Event) => {
      const detail = (
        ev as CustomEvent<{ bayIndex?: number; moduleIndex?: number; role?: string; componentId?: string }>
      ).detail;
      if (typeof detail?.moduleIndex === "number" && detail.moduleIndex >= 0) {
        setActiveModuleIndex(detail.moduleIndex);
      }
      const bIdx = typeof detail?.bayIndex === "number" ? detail.bayIndex : 0;
      setActiveBayIndex(bIdx);
      setSelected3DCompId(detail?.componentId || null);
      const r = detail?.role || "";
      const partKind: Selected3DPartKind = r.includes("sub_divider")
        ? "sub_divider"
        : r.includes("shelf")
        ? "shelf"
        : r.includes("drawer")
        ? "drawer"
        : r.includes("rail")
        ? "rail"
        : "bay";
      const roleTr =
        partKind === "sub_divider"
          ? "Raf Arası Dikme"
          : partKind === "shelf"
          ? "Raf"
          : partKind === "drawer"
          ? "Çekmece"
          : partKind === "rail"
          ? "Askı Borusu"
          : "Bölme İçi";
      setSelected3DPartKind(partKind);
      setSelected3DContextLabel(`${bIdx + 1}. Bölme • ${roleTr}`);
      setInspectorTab("interior");
      setIsInspectorOpen(true);
    };
    const onDoor3D = (ev: Event) => {
      const detail = (ev as CustomEvent<{ bayIndex?: number; componentId?: string }>).detail;
      const bIdx = typeof detail?.bayIndex === "number" ? detail.bayIndex : 0;
      setActiveBayIndex(bIdx);
      setSelected3DCompId(detail?.componentId || null);
      setSelected3DPartKind("door");
      setSelected3DContextLabel(`${bIdx + 1}. Bölme • Kapak`);
      setInspectorTab("doors");
      setIsInspectorOpen(true);
    };
    const onMat3D = () => {
      setSelected3DPartKind("door");
      setSelected3DContextLabel("Yüzey & Kartela");
      setInspectorTab("materials");
      setIsInspectorOpen(true);
    };
    const onHardware3D = (ev: Event) => {
      const detail = (
        ev as CustomEvent<{
          group?: string;
          bayIndex?: number;
          componentId?: string;
          moduleIndex?: number;
          sku?: string;
        }>
      ).detail;
      if (typeof detail?.moduleIndex === "number" && detail.moduleIndex >= 0) {
        setActiveModuleIndex(detail.moduleIndex);
      }
      const bIdx = typeof detail?.bayIndex === "number" ? detail.bayIndex : 0;
      setActiveBayIndex(bIdx);
      const rawGroup = detail?.group || "hinge";
      const mappedGroup: HardwareSwapGroup =
        rawGroup === "handle"
          ? "handle"
          : rawGroup === "drawer_slide" || rawGroup === "drawer"
          ? "drawer_slide"
          : rawGroup === "rail" || rawGroup === "accessories"
          ? "rail"
          : "hinge";
      setHardwareSwapTarget({
        group: mappedGroup,
        bayIndex: bIdx,
        componentId: detail?.componentId || null,
        sku: detail?.sku || null,
      });
    };
    const onClear3DSelection = () => {
      setSelected3DContextLabel(null);
      setSelected3DCompId(null);
      setHardwareSwapTarget(null);
    };
    const onOpenStudioRender = () => setStudioRenderOpen(true);
    const onDeleteActiveSelection = () => {
      const stNow = useConfiguratorStore.getState();
      if (stNow.selectedSceneObjectId) {
        stNow.removeSceneObject(stNow.selectedSceneObjectId);
        stNow.setSelectedSceneObjectId(null);
        setSelected3DContextLabel(null);
        latestRef.current.showToast("Seçili 3B obje silindi.");
        return;
      }
      const selComp = stNow.selectedComponentId;
      if (selComp && removeSelectedInteriorComponent()) {
        setSelected3DContextLabel(null);
        return;
      }
      if (stNow.project.modules.length > 1) {
        const delIdx = Math.max(0, Math.min(stNow.activeModuleIndex, stNow.project.modules.length - 1));
        const delName = stNow.project.modules[delIdx]?.name || "Modül";
        removeModuleAt(delIdx);
        setSelected3DContextLabel(null);
        latestRef.current.showToast(`"${delName}" sahneden silindi.`);
      } else {
        latestRef.current.showToast("Sahnede en az 1 ana modül kalmalıdır.");
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandSearchOpen((v) => !v);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
        if (tag !== "input" && tag !== "textarea") {
          e.preventDefault();
          undo();
        }
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))
      ) {
        const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
        if (tag !== "input" && tag !== "textarea") {
          e.preventDefault();
          redo();
        }
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const el = e.target as HTMLElement | null;
        const tag = el?.tagName?.toLowerCase();
        if (tag === "input" || tag === "textarea" || tag === "select" || el?.isContentEditable) {
          return;
        }
        const k = e.key.toLowerCase();
        if (k === "m") {
          e.preventDefault();
          setQuickPaletteOpen((v) => !v);
        } else if (k === "b") {
          e.preventDefault();
          setPaintToolState((prev) => ({
            ...prev,
            mode: prev.mode === "paint" ? "none" : "paint",
          }));
        } else if (k === "i") {
          e.preventDefault();
          setPaintToolState((prev) => ({
            ...prev,
            mode: prev.mode === "eyedropper" ? "none" : "eyedropper",
          }));
        } else if (e.key === "Delete" || e.key === "Backspace") {
          // In 2D Plan mode, let V3CadViewport2D handle deleting selected plan walls, obstacles, or placed items
          if (workspaceModeRef.current === "plan") return;
          if ((e as unknown as { __birimDeleteHandled?: boolean }).__birimDeleteHandled) return;
          (e as unknown as { __birimDeleteHandled?: boolean }).__birimDeleteHandled = true;
          e.preventDefault();
          e.stopImmediatePropagation?.();
          const stDel = useConfiguratorStore.getState();
          // 1. Delete selected 3D scene object (appliance, chair, plant, etc.)
          if (stDel.selectedSceneObjectId) {
            const objId = stDel.selectedSceneObjectId;
            stDel.removeSceneObject(objId);
            stDel.setSelectedSceneObjectId(null);
            latestRef.current.showToast("Seçili 3B obje silindi.");
            return;
          }
          // 2. Delete selected interior cabinet component (shelf, drawer, rail, sub-divider, special_fitting/accessory)
          // Works identically in BOTH 3D Viewport and 2D Front Elevation regardless of selected3DPartKind!
          const selCid = stDel.selectedComponentId || "";
          if (selCid) {
            if (removeSelectedInteriorComponent()) {
              setSelected3DContextLabel(null);
              latestRef.current.showToast("Seçili iç parça silindi (Ctrl+Z ile geri al).");
              return;
            }
            if (selCid.includes("_fitting_") || selCid.includes("_fit_")) {
              let deletedFit = false;
              stDel.applyBatchProjectUpdate((draft) => {
                for (const m of draft.modules) {
                  for (const b of m.bays) {
                    if (!b.specialFittings?.length) continue;
                    const before = b.specialFittings.length;
                    b.specialFittings = b.specialFittings.filter(
                      (f) => !selCid.startsWith(f.id) && !selCid.includes(f.id)
                    );
                    if (b.specialFittings.length < before) deletedFit = true;
                  }
                }
              }, "İç donanım silindi");
              if (deletedFit) {
                stDel.setSelectedComponentId(null);
                setSelected3DContextLabel(null);
                latestRef.current.showToast("Seçili donanım silindi (Ctrl+Z ile geri al).");
                return;
              }
            }
            // 2b. Vertical carcass divider -> remove divider & merge adjacent bays
            const activeMod =
              stDel.project.modules[stDel.activeModuleIndex] || stDel.project.modules[0];
            if (activeMod && (selCid.includes("_divider_") || selCid.includes("carcass_divider"))) {
              if (activeMod.bays.length > 1) {
                const divMatch = selCid.match(/divider_(\d+)/);
                const bIdx = divMatch
                  ? Math.max(0, Math.min(activeMod.bays.length - 1, Number(divMatch[1])))
                  : Math.max(0, Math.min(activeMod.bays.length - 1, stDel.activeBayIndex));
                removeBayAt(bIdx);
                stDel.setSelectedComponentId(null);
                setSelected3DContextLabel(null);
                latestRef.current.showToast("Ara dikme kaldırıldı ve bölmeler birleştirildi.");
                return;
              }
            }
            // 2c. Door leaf / hinge -> remove door from bay (convert to open bay)
            if (activeMod && (selCid.includes("_door_") || selCid.includes("_hinge_"))) {
              const bayMatch = selCid.match(/bay_(\d+)/);
              const bIdx = bayMatch
                ? Math.max(0, Math.min(activeMod.bays.length - 1, Number(bayMatch[1])))
                : Math.max(0, Math.min(activeMod.bays.length - 1, stDel.activeBayIndex));
              if (activeMod.bays[bIdx]?.door?.type && activeMod.bays[bIdx].door.type !== "open") {
                setBayDoorType(bIdx, "open");
                stDel.setSelectedComponentId(null);
                setSelected3DContextLabel(null);
                latestRef.current.showToast("Bölme kapağı kaldırıldı (Açık bölme).");
                return;
              }
            }
          }
          // 3. Delete currently active module (keep at least 1 module in scene)
          if (stDel.project.modules.length > 1) {
            const delIdx = Math.max(
              0,
              Math.min(stDel.activeModuleIndex, stDel.project.modules.length - 1)
            );
            const delName = stDel.project.modules[delIdx]?.name || "Modül";
            removeModuleAt(delIdx);
            setSelected3DContextLabel(null);
            latestRef.current.showToast(`"${delName}" sahneden silindi.`);
          } else {
            latestRef.current.showToast("Sahnede en az 1 ana modül kalmalıdır.");
          }
        } else if (e.key === "Escape") {
          setPaintToolState((prev) =>
            prev.mode === "none" ? prev : { ...prev, mode: "none" }
          );
        }
      }
    };

    const onMaterialSampled3D = (ev: Event) => {
      const detail = (
        ev as CustomEvent<{ materialId: string; materialName: string; toolState?: PaintTool3DState }>
      ).detail;
      if (!detail) return;
      if (detail.toolState) {
        setPaintToolState(detail.toolState);
      }
      showToast(`Damlalık ile alındı: ${detail.materialName} — Boyamaya hazır`);
    };

    const onMaterialPainted3D = (ev: Event) => {
      const detail = (ev as CustomEvent<{ materialName: string }>).detail;
      if (detail?.materialName) {
        showToast(`${detail.materialName} yüzeye uygulandı.`);
      }
    };

    const onTogglePaletteEvt = () => setQuickPaletteOpen((v) => !v);
    const onTogglePaintEvt = () => {
      setPaintToolState((prev) => ({
        ...prev,
        mode: prev.mode === "paint" ? "none" : "paint",
      }));
    };
    const onClearPaintToolEvt = () => {
      setPaintToolState((prev) => (prev.mode === "none" ? prev : { ...prev, mode: "none" }));
    };
    const onSyncPaintToolFrom3DEvt = (ev: Event) => {
      const detail = (ev as CustomEvent<PaintTool3DState>).detail;
      if (detail) setPaintToolState(detail);
    };
    const onWallSelected3DEvt = (ev: Event) => {
      const detail = (ev as CustomEvent<{ wallId: string; wallName: string }>).detail;
      if (detail?.wallName) {
        showToast(
          `Hedef duvar seçildi: ${detail.wallName} — Yeni eklenecek modül ve objeler bu duvara yerleşir.`
        );
      }
    };
    const onStyleCopiedEvt = (ev: Event) => {
      const detail = (ev as CustomEvent<{ sourceModuleName?: string } | null>).detail;
      if (detail?.sourceModuleName) {
        showToast(`"${detail.sourceModuleName}" stili kopyalandı — Sağ tıkla başka dolaplara yapıştırın.`);
      }
    };

    window.addEventListener("birim:select-bay-3d", onBay3D);
    window.addEventListener("birim:select-door-3d", onDoor3D);
    window.addEventListener("birim:select-hardware-3d", onHardware3D);
    window.addEventListener("birim:select-material-part-3d", onMat3D);
    window.addEventListener("birim:clear-3d-selection", onClear3DSelection);
    window.addEventListener("birim:open-studio-render-modal", onOpenStudioRender);
    window.addEventListener("birim:delete-active-selection", onDeleteActiveSelection);
    window.addEventListener("birim:material-sampled-3d", onMaterialSampled3D);
    window.addEventListener("birim:material-painted-3d", onMaterialPainted3D);
    window.addEventListener("birim:toggle-quick-palette-dock", onTogglePaletteEvt);
    window.addEventListener("birim:toggle-paint-bucket-shortcut", onTogglePaintEvt);
    window.addEventListener("birim:request-clear-paint-tool-3d", onClearPaintToolEvt);
    window.addEventListener("birim:sync-paint-tool-from-3d", onSyncPaintToolFrom3DEvt);
    window.addEventListener("birim:wall-selected-3d", onWallSelected3DEvt);
    window.addEventListener("birim:style-clipboard-changed", onStyleCopiedEvt);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("birim:select-bay-3d", onBay3D);
      window.removeEventListener("birim:select-door-3d", onDoor3D);
      window.removeEventListener("birim:select-hardware-3d", onHardware3D);
      window.removeEventListener("birim:select-material-part-3d", onMat3D);
      window.removeEventListener("birim:clear-3d-selection", onClear3DSelection);
      window.removeEventListener("birim:open-studio-render-modal", onOpenStudioRender);
      window.removeEventListener("birim:delete-active-selection", onDeleteActiveSelection);
      window.removeEventListener("birim:material-sampled-3d", onMaterialSampled3D);
      window.removeEventListener("birim:material-painted-3d", onMaterialPainted3D);
      window.removeEventListener("birim:toggle-quick-palette-dock", onTogglePaletteEvt);
      window.removeEventListener("birim:toggle-paint-bucket-shortcut", onTogglePaintEvt);
      window.removeEventListener("birim:request-clear-paint-tool-3d", onClearPaintToolEvt);
      window.removeEventListener("birim:sync-paint-tool-from-3d", onSyncPaintToolFrom3DEvt);
      window.removeEventListener("birim:wall-selected-3d", onWallSelected3DEvt);
      window.removeEventListener("birim:style-clipboard-changed", onStyleCopiedEvt);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [setActiveBayIndex, undo, redo, showToast]);

  // Combine V5 specialized templates (TV Bench, Capsule Table, Capsule Bar, Bookcase, Vestiyer, Vanity) + V4 templates + user custom templates
  const combinedTemplates = useMemo(() => {
    const customAsDefs = (project.customModuleTemplates || []).map((ct) => ({
      templateId: ct.templateId,
      familyId: ct.familyId,
      category: ct.serializedModuleSnapshot.category,
      name: ct.name,
      description: "Kaydedilmiş özel modül şablonu",
      defaultDimensions: ct.serializedModuleSnapshot.dimensions,
      dimensionLimits: { minW: 300, maxW: 3600, minH: 350, maxH: 2900, minD: 280, maxD: 950 },
      defaultDoorSystemId: "hinged_double" as const,
      compatibleDoorSystems: ["hinged_single", "hinged_double", "sliding_top_hung", "open"] as any,
      createInstance: (id: string, customName?: string) => {
        const cl = JSON.parse(JSON.stringify(ct.serializedModuleSnapshot));
        cl.id = id;
        if (customName) cl.name = customName;
        return cl;
      },
    }));
    const v5Ids = new Set(V5_SPECIALIZED_MODULE_TEMPLATES.map((t) => t.templateId));
    return [
      ...customAsDefs,
      ...V5_SPECIALIZED_MODULE_TEMPLATES,
      ...v4ModuleTemplates.filter((t) => !v5Ids.has(t.templateId)),
    ];
  }, [v4ModuleTemplates, project.customModuleTemplates]);

  const allMaterials = useMemo(
    () => [...DEFAULT_MATERIALS, ...(project.customMaterials || [])],
    [project.customMaterials]
  );

  const wallWidthMm = spaceWalls?.[0]?.length || project.space?.walls?.[0]?.length || 3600;
  const ceilingHeightMm = spaceWalls?.[0]?.height || project.space?.ceilingHeight || 2600;

  const storeValidationIssues = useConfiguratorStore((s) => s.validationIssues);

  const allFindings = useMemo<EngineeringValidationFinding[]>(() => {
    const merged: EngineeringValidationFinding[] = [];
    const seenKeys = new Set<string>();
    const pushUnique = (f: EngineeringValidationFinding) => {
      const k = `${f.code}::${f.message}`;
      if (seenKeys.has(k)) return;
      seenKeys.add(k);
      merged.push(f);
    };
    if (unifiedEngineeringReport) {
      if (Array.isArray(unifiedEngineeringReport.findings)) {
        unifiedEngineeringReport.findings.forEach(pushUnique);
      }
      (Array.isArray(unifiedEngineeringReport.blockingSafetyAndEngineeringErrors)
        ? unifiedEngineeringReport.blockingSafetyAndEngineeringErrors
        : []
      ).forEach(pushUnique);
      (Array.isArray(unifiedEngineeringReport.verificationRequiredFindings)
        ? unifiedEngineeringReport.verificationRequiredFindings
        : []
      ).forEach(pushUnique);
      (Array.isArray(unifiedEngineeringReport.ergonomicAdvisories)
        ? unifiedEngineeringReport.ergonomicAdvisories
        : []
      ).forEach(pushUnique);
    }
    if (Array.isArray(storeValidationIssues)) {
      storeValidationIssues.forEach((vi) => {
        const viCompat = vi as typeof vi & { moduleId?: string; bayId?: string; suggestion?: string };
        const viCode = vi.code || "VALIDATION_ISSUE";
        // Avoid duplicating legacy rule issues when unifiedEngineeringReport already emitted an actionable finding for the same drawer/issue
        if (
          (viCode === "ERR_INTERNAL_DRAWER_HINGE_COLLISION" ||
            viCode === "WARN_INTERNAL_DRAWER_HINGE_PROTRUSION") &&
          merged.some(
            (m) =>
              (m.code === "ERR_INTERNAL_DRAWER_HINGE_BODY_CLASH" ||
                m.code === "WARN_INTERNAL_DRAWER_HINGE_PROTRUSION") &&
              (!vi.targetId || !m.targetId || m.targetId === vi.targetId)
          )
        ) {
          return;
        }
        pushUnique({
          code: viCode,
          severity: vi.severity === "error" ? "error" : "warning",
          category: "spatial_collision",
          message: vi.message,
          targetModuleId: viCompat.moduleId || project.modules[activeModuleIndex]?.id || "",
          targetId: vi.targetId || viCompat.bayId || viCompat.moduleId || "",
          suggestions: viCompat.suggestion ? [viCompat.suggestion] : [],
        } as unknown as EngineeringValidationFinding);
      });
    }
    return merged;
  }, [unifiedEngineeringReport, storeValidationIssues, project.modules, activeModuleIndex]);

  const blockingCount = useMemo(
    () => allFindings.filter((f) => f.severity === "error").length,
    [allFindings]
  );

  // NEVER call window.dispatchEvent inside a setState(prev => ...) reducer!
  const handleToggleDoorsHidden = useCallback(() => {
    const next = !doorsHidden3D;
    setDoorsHidden3D(next);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("birim:set-doors-hidden", { detail: next }));
    }
  }, [doorsHidden3D]);

  const handleToggleInteriorProps = useCallback(() => {
    const next = !showInteriorProps3D;
    setShowInteriorProps3D(next);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("birim:toggle-interior-props", { detail: { visible: next } })
      );
    }
  }, [showInteriorProps3D]);

  const handleFillRemainingWallGap = useCallback(() => {
    const mainMods = project.modules.filter((m) => m.category !== "complementary");
    const maxRight = mainMods.reduce(
      (acc, m) => Math.max(acc, m.position.x + m.dimensions.width),
      0
    );
    const gapW = Math.round(wallWidthMm - maxRight);
    if (gapW < 350) {
      showToast("Duvar üzerinde tamamlanacak yeterli boşluk kalmadı.");
      return;
    }
    fillWallGapWithParametricModule({
      id: `gap_${maxRight}`,
      wallId: spaceWalls?.[0]?.id || "wall_north",
      wallName: "Ana Duvar",
      zone: "base",
      startAlongMm: maxRight,
      endAlongMm: wallWidthMm,
      widthMm: gapW,
      targetElevationY: 0,
      worldOriginX: maxRight,
      worldOriginZ: 0,
      moduleRotationYDeg: 0,
    });
    showToast(`${Math.round(gapW / 10)} cm boşluk yeni modülle tamamlandı.`);
  }, [project.modules, wallWidthMm, spaceWalls, fillWallGapWithParametricModule, showToast]);

  // Sync paintToolState to V3ThreeViewport strictly AFTER render commit (never inside a setState reducer!)
  useEffect(() => {
    dispatchPaintToolState3D(paintToolState);
  }, [paintToolState]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const tryRecoverStaleChunk = (msg: string) => {
      if (!msg.includes("ChunkLoadError") && !msg.includes("Loading chunk")) return;
      try {
        const key = "birim_chunk_recover_ts";
        const prev = Number(window.sessionStorage.getItem(key) || "0");
        const now = Date.now();
        if (now - prev > 15000) {
          window.sessionStorage.setItem(key, String(now));
          window.location.reload();
        }
      } catch {
        window.location.reload();
      }
    };
    const onError = (ev: ErrorEvent) => {
      tryRecoverStaleChunk(`${ev.error?.name || ""} ${ev.message || ""}`);
    };
    const onRejection = (ev: PromiseRejectionEvent) => {
      const reason = ev.reason;
      tryRecoverStaleChunk(`${reason?.name || ""} ${reason?.message || String(reason || "")}`);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  const handleChangePaintToolState = useCallback((next: PaintTool3DState) => {
    setPaintToolState(next);
  }, []);

  const handleToggleQuickPalette = useCallback(() => {
    setQuickPaletteOpen((v) => !v);
  }, []);

  const handleTogglePaintBucketBtn = useCallback(() => {
    setPaintToolState((prev) => ({
      ...prev,
      mode: prev.mode === "paint" ? "none" : "paint",
    }));
  }, []);

  const handleApplyZoneMaterial = useCallback(
    (scope: QuickZoneScope, materialId: string) => {
      const mats = [...DEFAULT_MATERIALS, ...(useConfiguratorStore.getState().project.customMaterials || [])];
      let outcomeMsg = "";
      let ok = true;
      useConfiguratorStore.getState().applyBatchProjectUpdate((draft) => {
        const res = applyZoneMaterialToProjectDraft(
          draft,
          useConfiguratorStore.getState().activeModuleIndex,
          scope,
          materialId,
          mats
        );
        ok = res.ok;
        outcomeMsg = res.messageTr;
      }, "Bölgesel malzeme güncellendi");
      if (outcomeMsg) showToast(outcomeMsg);
      void ok;
    },
    [showToast]
  );

  const handleReplaceProjectMaterial = useCallback(
    (fromMatId: string, toMatId: string) => {
      const mats = [...DEFAULT_MATERIALS, ...(useConfiguratorStore.getState().project.customMaterials || [])];
      const toName = mats.find((m) => m.id === toMatId)?.name || toMatId;
      let count = 0;
      useConfiguratorStore.getState().applyBatchProjectUpdate((draft) => {
        count = replaceExistingMaterialAcrossProjectDraft(draft, fromMatId, toMatId);
      }, `Tüm projede ${toName} ile değiştirildi`);
      showToast(`${toName} sahnedeki ${count} yüzeye uygulandı.`);
    },
    [showToast]
  );

  const handleApplyCuratedMoodboard = useCallback(
    (mb: CuratedBirimMoodboard) => {
      useConfiguratorStore.getState().applyBatchProjectUpdate((draft) => {
        applyCuratedMoodboardToProjectDraft(draft, mb);
      }, `Kombinasyon: ${mb.titleTr}`);
      showToast(`"${mb.titleTr}" kombinasyonu tüm projeye uygulandı.`);
    },
    [showToast]
  );

  const handleSelectOrSaveVariantSlot = useCallback(
    (slot: "A" | "B" | "C", forceOverwrite = false) => {
      const st = useConfiguratorStore.getState();
      const curPrice = st.pricing?.totalWithVatEur || 0;
      const firstMod = st.project.modules.find((m) => m.category !== "complementary") || st.project.modules[0];
      const allMats = [...DEFAULT_MATERIALS, ...(st.project.customMaterials || [])];
      const doorMatName =
        allMats.find((m) => m.id === firstMod?.carcass.doorMaterialId)?.name || "Mevcut Tasarım";

      const existing = variantSnapshots[slot];
      if (!existing || forceOverwrite) {
        const cloned = JSON.parse(JSON.stringify(st.project)) as DesignProject;
        setVariantSnapshots((prev) => ({
          ...prev,
          ...(slot !== "A" && !prev.A
            ? {
                A: {
                  project: JSON.parse(JSON.stringify(st.project)) as DesignProject,
                  priceEur: curPrice,
                  summaryTr: doorMatName,
                },
              }
            : {}),
          [slot]: {
            project: cloned,
            priceEur: curPrice,
            summaryTr: doorMatName,
          },
        }));
        setActiveVariantSlot(slot);
        showToast(
          forceOverwrite
            ? `Seçenek ${slot} güncellendi (${doorMatName}).`
            : `Seçenek ${slot} kaydedildi — Farklı renk deneyip tek tıkla dönebilirsiniz.`
        );
        return;
      }

      if (!variantSnapshots.A && slot !== "A") {
        setVariantSnapshots((prev) => ({
          ...prev,
          A: {
            project: JSON.parse(JSON.stringify(st.project)) as DesignProject,
            priceEur: curPrice,
            summaryTr: doorMatName,
          },
        }));
      }
      st.restoreProjectVariantSnapshot(existing.project, `Seçenek ${slot} yüklendi`);
      setActiveVariantSlot(slot);
      showToast(`Seçenek ${slot} (${existing.summaryTr}) yüklendi.`);
    },
    [variantSnapshots, showToast]
  );

  const headerVariantSlots = useMemo(
    () =>
      (["A", "B", "C"] as const).map((slot) => ({
        slot,
        saved: Boolean(variantSnapshots[slot]),
        priceEur: variantSnapshots[slot]?.priceEur,
        summaryTr: variantSnapshots[slot]?.summaryTr,
      })),
    [variantSnapshots]
  );

  const commandActions = useMemo<CommandPaletteAction[]>(
    () => [
      {
        id: "open_catalog",
        labelTr: "Ürün, Modül, TV Bench ve Masa Kataloğunu Aç",
        categoryTr: "Tasarım",
        keywords: "modül ekle gardırop mutfak tv bench konsol masa kütüphane",
        onExecute: () => setLeftDrawer("catalog"),
      },
      {
        id: "open_island",
        labelTr: "Şelale Mutfak Adası ve Açılı Yemek/Bar Masası Ekle",
        categoryTr: "Mutfak",
        keywords: "ada mutfak şelale masa bar taburesi",
        onExecute: () => setKitchenIslandOpen(true),
      },
      {
        id: "open_capsule",
        labelTr: "Kapsül Stadyum Yemek Masası & Tamburlu Konsol Tasarla",
        categoryTr: "Özel Ürün",
        keywords: "kapsül oval masa konsol bar glb 3d",
        onExecute: () => setSceneHubTab("capsule_curved"),
      },
      {
        id: "open_wizard",
        labelTr: "Hızlı Oda & Dolap Kurulum Sihirbazı",
        categoryTr: "Tasarım",
        keywords: "sihirbaz otomatik kurulum oda",
        onExecute: () => setWizardModalOpen(true),
      },
      {
        id: "open_section_2d",
        labelTr: "Görsel Planlı 2B A-A Yan Kesit Ekranını Aç",
        categoryTr: "Teknik Çizim",
        keywords: "kesit plan aa bb 2d",
        onExecute: () => {
          setWorkspaceMode("2d");
          setCadSubMode("section");
        },
      },
      {
        id: "open_mep",
        labelTr: "Elektrik ve Sıhhi Tesisat (MEP) Koordinasyon Planı",
        categoryTr: "Mühendislik",
        keywords: "tesisat elektrik su priz boru mep dxf",
        onExecute: () => setMepModalOpen(true),
      },
      {
        id: "open_cutout",
        labelTr: "Panel Kertme ve Priz / Boru CNC Kesimi",
        categoryTr: "Mühendislik",
        keywords: "kertme priz boru kolon kesim cnc",
        onExecute: () => setCutoutModalOpen(true),
      },
      {
        id: "open_production_sheet",
        labelTr: "Üretim Paftası & Teknik Çizim Düzeni (Plan, Görünüş, Kesit, 3B)",
        categoryTr: "Üretim",
        keywords: "pafta plan görünüş kesit perspektif antet pdf svg dxf üretim",
        onExecute: () => setProductionSheetModalOpen(true),
      },
      {
        id: "open_bom",
        labelTr: "Kesim Listesi, Plaka Nesting, CNC (.MPR/.CIX) ve Blum BXF",
        categoryTr: "Üretim",
        keywords: "bom kesim nesting cnc dxf mpr cix blum bxf plaka",
        onExecute: () => setBomModalTab("cutlist"),
      },
      {
        id: "open_erp",
        labelTr: "Birim Store & Portal ERP Sipariş Aktarımı",
        categoryTr: "Üretim",
        keywords: "erp mağaza store sipariş portal",
        onExecute: () => setStoreErpOpen(true),
      },
      {
        id: "open_quote",
        labelTr: "Müşteri Fiyat Teklifi ve Görselli PDF",
        categoryTr: "Satış",
        keywords: "fiyat teklif pdf iskonto",
        onExecute: () => setQuoteModalOpen(true),
      },
      {
        id: "toggle_quick_palette",
        labelTr: "Bölgesel Hızlı Kartela ve İmza Kombinasyonlarını Aç (M)",
        categoryTr: "Hızlı Malzeme",
        keywords: "kartela malzeme renk kombinasyon palet m",
        onExecute: () => setQuickPaletteOpen(true),
      },
      {
        id: "activate_paint_bucket",
        labelTr: "3B Boya Kovası Modunu Aç (Kısayol: B)",
        categoryTr: "Hızlı Malzeme",
        keywords: "boya kovası fırça paint bucket b",
        onExecute: () =>
          handleChangePaintToolState({
            ...paintToolState,
            mode: "paint",
          }),
      },
      {
        id: "activate_eyedropper",
        labelTr: "3B Damlalık ile Dolaptan Malzeme Örnekle (Kısayol: I / Alt+Tık)",
        categoryTr: "Hızlı Malzeme",
        keywords: "damlalık eyedropper malzeme seç örnekle i",
        onExecute: () =>
          handleChangePaintToolState({
            ...paintToolState,
            mode: "eyedropper",
          }),
      },
      ...BIRIM_CURATED_MOODBOARDS.map((mb) => ({
        id: `cmd_mb_${mb.id}`,
        labelTr: `Hazır Kombinasyon Uygula: ${mb.titleTr} (${mb.badgeTr})`,
        categoryTr: "İmza Kombinasyon",
        keywords: `kombinasyon çift ton ${mb.titleTr.toLowerCase()} ${mb.subtitleTr.toLowerCase()}`,
        onExecute: () => handleApplyCuratedMoodboard(mb),
      })),
      {
        id: "batch_base_walnut",
        labelTr: "Tüm Alt Dolaplar → Variodor Barok Ceviz",
        categoryTr: "Bölgesel Boyama",
        keywords: "alt dolaplar barok ceviz ahşap",
        onExecute: () => handleApplyZoneMaterial("base_cabinets", "mat_veneer_walnut"),
      },
      {
        id: "batch_base_nordic_oak",
        labelTr: "Tüm Alt Dolaplar → Çamsan İskandinav Meşe",
        categoryTr: "Bölgesel Boyama",
        keywords: "alt dolaplar iskandinav meşe",
        onExecute: () => handleApplyZoneMaterial("base_cabinets", "mat_camsan_iskandinav_mese"),
      },
      {
        id: "batch_wall_cream_lacquer",
        labelTr: "Tüm Üst Dolaplar → İpek Mat Lake Sahra Kumu",
        categoryTr: "Bölgesel Boyama",
        keywords: "üst dolaplar sahra kumu krem lake",
        onExecute: () => handleApplyZoneMaterial("wall_cabinets", "mat_lacquer_cream"),
      },
      {
        id: "batch_wall_sage_lacquer",
        labelTr: "Tüm Üst Dolaplar → İpek Mat Lake Adaçayı Yeşili",
        categoryTr: "Bölgesel Boyama",
        keywords: "üst dolaplar adaçayı yeşili lake",
        onExecute: () => handleApplyZoneMaterial("wall_cabinets", "mat_lacquer_sage"),
      },
      {
        id: "batch_wall_cashmere",
        labelTr: "Tüm Üst Dolaplar → Kaşmir Gri",
        categoryTr: "Bölgesel Boyama",
        keywords: "üst dolaplar kaşmir gri",
        onExecute: () => handleApplyZoneMaterial("wall_cabinets", "mat_ye_kasmir_gri"),
      },
      {
        id: "batch_ct_calacatta_luxe",
        labelTr: " Tüm Tezgâhlar → Neolith Calacatta Luxe Porselen",
        categoryTr: "Tezgâh & Taş",
        keywords: "tezgah neolith calacatta luxe mermer kuvars",
        onExecute: () => handleApplyZoneMaterial("countertops", "mat_neolith_calacatta_luxe"),
      },
      {
        id: "batch_ct_dekton_entzo",
        labelTr: "Tüm Tezgâhlar → Dekton Entzo Calacatta Gold",
        categoryTr: "Tezgâh & Taş",
        keywords: "tezgah dekton entzo gold",
        onExecute: () => handleApplyZoneMaterial("countertops", "mat_dekton_entzo"),
      },
      {
        id: "batch_ct_basalt_black",
        labelTr: "Tüm Tezgâhlar → Neolith Basalt Black",
        categoryTr: "Tezgâh & Taş",
        keywords: "tezgah siyah bazalt basalt black",
        onExecute: () => handleApplyZoneMaterial("countertops", "mat_neolith_basalt_black"),
      },
      {
        id: "batch_handle_black",
        labelTr: "Kulp & Gola Profilleri → K019 Mat Siyah Eloksal",
        categoryTr: "Kulp & Gola",
        keywords: "kulp gola siyah eloksal metal",
        onExecute: () => handleApplyZoneMaterial("handles_gola", "mat_handle_matte_black"),
      },
      {
        id: "batch_handle_brass",
        labelTr: "Kulp & Gola Profilleri → K021 Satine Pirinç",
        categoryTr: "Kulp & Gola",
        keywords: "kulp gola pirinç altın brass",
        onExecute: () => handleApplyZoneMaterial("handles_gola", "mat_handle_brass"),
      },
      {
        id: "open_door_gallery",
        labelTr: "Kapak ve Kulpsuz Sistemler 1:1 Kesit Galerisini Aç",
        categoryTr: "Tasarım",
        keywords: "kapak galerisi gola j kulp kesit aventos",
        onExecute: () => setDoorShowcaseOpen(true),
      },
    ],
    [
      handleChangePaintToolState,
      paintToolState,
      handleApplyCuratedMoodboard,
      handleApplyZoneMaterial,
    ]
  );

  const arExportParts = useMemo(() => {
    if (!arModalOpen) return [];
    const boxes = project.modules.flatMap((mod) => {
      const geom = generateModuleGeometry(mod, { doorOpenAngleDeg: 0 });
      return geom.components.map((c) => ({
        id: `${mod.id}_${c.id}`,
        name: c.label,
        role: c.role,
        moduleId: mod.id,
        moduleName: mod.name,
        positionMm: {
          x: mod.position.x + c.position.x,
          y: mod.position.y + c.position.y,
          z: mod.position.z + c.position.z,
        },
        dimensionsMm: {
          width: c.dimensions.width,
          height: c.dimensions.height,
          depth: c.dimensions.depth,
        },
        materialId: c.materialId,
      }));
    });
    const sceneBoxes = convertSceneObjectsToExportBoxes(project.sceneObjects || []);
    return [...boxes, ...sceneBoxes];
  }, [arModalOpen, project.modules, project.sceneObjects]);

  const hasSecondHeaderStrip = workspaceMode === "2d";

  const stageSafeInsets = useMemo(
    () => ({
      topPx: hasSecondHeaderStrip ? 116 : 74,
      bottomPx: quickPaletteOpen ? 330 : 76,
      leftPx: leftDrawer ? 492 : 76,
      rightPx: workspaceMode === "showroom" ? 24 : isInspectorOpen ? 444 : 68,
    }),
    [hasSecondHeaderStrip, quickPaletteOpen, leftDrawer, workspaceMode, isInspectorOpen]
  );

  const isShowroom = workspaceMode === "showroom";
  const show3DCanvas =
    workspaceMode === "3d" ||
    workspaceMode === "showroom" ||
    (workspaceMode === "2d" && cadSubMode === "split");

  // Map SectionPlaneMiniMap axis ("X" = A-A vertical cut along width, "Z" = B-B longitudinal cut along depth)
  // to V3CadViewport2D's internal convention ("Z" = A-A cut along width, "X" = B-B cut along depth)
  const cadExternalSectionDir: "Z" | "X" = sectionAxis2D === "X" ? "Z" : "X";

  const stableSceneObjects = project.sceneObjects || EMPTY_SCENE_OBJECTS;

  const latestRef = useRef({
    project,
    activeModule,
    isShowroom,
    showToast,
    applyApprovedEngineeringFix,
    setActiveModuleIndex,
    setActiveBayIndex,
    applyV4Template,
    dropV4TemplateWithSnap,
    addCompositeAssemblyPreset,
    addSceneObjectFromCatalog,
    updateSceneObject,
    duplicateActiveModule,
    addStackedTopModule,
    loadLinearKitchen,
    loadLKitchen,
    loadUKitchen,
    setFacadeGrainContinuity,
    runAutoFillersAndCrown,
    saveActiveModuleAsCustomTemplate,
    addCustomMaterialToProject,
    setBayCustomWidth,
    addInternalDrawer,
    setDrawerPlacement,
    addSubDivider,
    applyMaterialByTargetScope,
    toggleModuleLedLighting,
    rotateActiveModule90,
    setDoorOpenAngleDeg,
    setDrawerOpenMm: (mm: number, animated?: boolean) => useConfiguratorStore.getState().setDrawerOpenMm(mm, animated),
  });
  latestRef.current = {
    project,
    activeModule,
    isShowroom,
    showToast,
    applyApprovedEngineeringFix,
    setActiveModuleIndex,
    setActiveBayIndex,
    applyV4Template,
    dropV4TemplateWithSnap,
    addCompositeAssemblyPreset,
    addSceneObjectFromCatalog,
    updateSceneObject,
    duplicateActiveModule,
    addStackedTopModule,
    loadLinearKitchen,
    loadLKitchen,
    loadUKitchen,
    setFacadeGrainContinuity,
    runAutoFillersAndCrown,
    saveActiveModuleAsCustomTemplate,
    addCustomMaterialToProject,
    setBayCustomWidth,
    addInternalDrawer,
    setDrawerPlacement,
    addSubDivider,
    applyMaterialByTargetScope,
    toggleModuleLedLighting,
    rotateActiveModule90,
    setDoorOpenAngleDeg,
    setDrawerOpenMm: (mm: number, animated?: boolean) => useConfiguratorStore.getState().setDrawerOpenMm(mm, animated),
  };

  // Memoized callbacks so React.memo on StudioHeaderBar, LeftCatalogLauncher,
  // RightParametricInspector & BottomSceneDock stays intact during 60fps animations
  const handleApplyFindingFix = useCallback((prop: Parameters<typeof applyApprovedEngineeringFix>[0]) => {
    latestRef.current.applyApprovedEngineeringFix(prop);
    latestRef.current.showToast("Önerilen iyileştirme uygulandı.");
  }, []);

  const handleFocusFinding = useCallback((fd: EngineeringValidationFinding) => {
    const mIdx = latestRef.current.project.modules.findIndex((m) => m.id === fd.targetModuleId);
    if (mIdx >= 0) latestRef.current.setActiveModuleIndex(mIdx);
    const bMatch = String(fd.targetId || "").match(/bay_(\d+)/);
    if (bMatch) latestRef.current.setActiveBayIndex(Number(bMatch[1]));
    setInspectorTab(
      fd.code.includes("DOOR") || fd.code.includes("HINGE") || fd.code.includes("HANDLE")
        ? "doors"
        : "interior"
    );
    setIsInspectorOpen(true);
  }, []);

  const handleOpenProjectModal = useCallback(() => setProjectModalOpen(true), []);
  const handleOpenWizardModal = useCallback(() => setWizardModalOpen(true), []);
  const handleOpenCommandSearch = useCallback(() => setCommandSearchOpen(true), []);
  const handleOpenQuoteModal = useCallback(() => setQuoteModalOpen(true), []);
  const handleOpenBomModal = useCallback(
    (tab?: "cutlist" | "nesting" | "cnc_mpr_cix" | "blum_bxf") => setBomModalTab(tab || "cutlist"),
    []
  );
  const handleOpenProductionSheetModal = useCallback(() => setProductionSheetModalOpen(true), []);
  const handleOpenAssemblyModal = useCallback(() => setAssemblyModalOpen(true), []);
  const handleOpenStudioRenderModal = useCallback(() => setStudioRenderOpen(true), []);
  const handleOpenArModal = useCallback(() => setArModalOpen(true), []);
  const handleOpenStoreErpModal = useCallback(() => setStoreErpOpen(true), []);
  const handleOpenStandardsModal = useCallback(() => setStandardsModalOpen(true), []);
  const handleOpenSaasModal = useCallback(() => setSaasModalOpen(true), []);
  const handleOpenMepModal = useCallback(() => setMepModalOpen(true), []);
  const handleOpenCutoutModal = useCallback(() => setCutoutModalOpen(true), []);
  const handleOpenSceneHubCapsule = useCallback(() => setSceneHubTab("capsule_curved"), []);

  const handleToggleDimensions3D = useCallback(() => setShowDimensions3D((v) => !v), []);
  const handleRequest2DElevation = useCallback(() => {
    setWorkspaceMode("2d");
    setCadSubMode("elevation");
  }, []);

  const handleExternalSectionChange = useCallback((dir: "Z" | "X", r: number) => {
    setSectionAxis2D(dir === "Z" ? "X" : "Z");
    setSectionRatio2D(r);
  }, []);

  const handleApplyTemplateToActive = useCallback((tplId: string) => {
    const st = useConfiguratorStore.getState();
    const effWalls = getEffectiveSpaceWalls(st.project);
    const primaryId = effWalls[0]?.id || "wall_main";
    const selWallId = st.activeWallId || primaryId;
    const selWall = effWalls.find((w) => w.id === selWallId) || effWalls[0];
    const curMod = st.project.modules[st.activeModuleIndex];
    const curModWallId = resolveModuleHostWallId(st.project, curMod);

    if (selWall && selWallId !== curModWallId) {
      const placed = st.appendModuleWithMultiWallSnap(tplId, { wallId: selWallId });
      if (placed) {
        latestRef.current.showToast(`Yeni modül "${selWall.name}" üzerine yerleştirildi.`);
        return;
      }
    }

    if (selWall && selWallId !== primaryId && curMod) {
      const roomCenter = computeRoomDynamicCenter(effWalls);
      const wb = getWallRoomBasis(selWall, roomCenter);
      const prevAlong = Math.max(
        0,
        (curMod.position.x - wb.p0.x) * wb.rawTangent.x +
          (curMod.position.z - wb.p0.z) * wb.rawTangent.z
      );
      latestRef.current.applyV4Template(tplId);
      const stAfter = useConfiguratorStore.getState();
      const repMod = stAfter.project.modules[stAfter.activeModuleIndex];
      if (repMod) {
        const clampedAlong = Math.max(0, Math.min(selWall.length - repMod.dimensions.width, prevAlong));
        const newPos = wallIntervalToModulePosition(
          selWall,
          clampedAlong,
          repMod.dimensions.width,
          repMod.dimensions.depth,
          roomCenter
        );
        stAfter.applyBatchProjectUpdate((draft) => {
          const dm = draft.modules[stAfter.activeModuleIndex];
          if (dm) {
            dm.position.x = newPos.x;
            dm.position.z = newPos.z;
            dm.rotation = { x: 0, y: newPos.rotationYDeg, z: 0 };
          }
        }, "Seçili duvar modülü güncellendi");
      }
      latestRef.current.showToast(`"${selWall.name}" üzerindeki modül güncellendi.`);
      return;
    }

    latestRef.current.applyV4Template(tplId);
    latestRef.current.showToast(
      selWall ? `"${selWall.name}" üzerindeki modül güncellendi.` : "Ürün şablonu uygulandı."
    );
  }, []);

  const handleAppendTemplateAdjacent = useCallback(
    (tplId: string, side: "left" | "right" | "above" = "right") => {
      const st = useConfiguratorStore.getState();
      const effWalls = getEffectiveSpaceWalls(st.project);
      const primaryId = effWalls[0]?.id || "wall_main";
      const curMod = st.project.modules[st.activeModuleIndex];
      const curModWallId = resolveModuleHostWallId(st.project, curMod);
      const selWallId = st.activeWallId || curModWallId || primaryId;
      const selWall = effWalls.find((w) => w.id === selWallId) || effWalls[0];

      // 1. Place directly to LEFT, RIGHT, or ABOVE the currently active module along the selected wall!
      if (selWall && curMod && selWallId === curModWallId) {
        const roomCenter = computeRoomDynamicCenter(effWalls);
        const wb = getWallRoomBasis(selWall, roomCenter);
        const projectAlongInterval = (m: typeof curMod) => {
          const fp = getModuleOrientedFootprint(m, 0);
          const xs = [fp.x, fp.x + fp.planWidth];
          const zs = [fp.z, fp.z + fp.planDepth];
          let mn = Infinity;
          let mx = -Infinity;
          for (const px of xs) {
            for (const pz of zs) {
              const v = (px - wb.p0.x) * wb.rawTangent.x + (pz - wb.p0.z) * wb.rawTangent.z;
              if (v < mn) mn = v;
              if (v > mx) mx = v;
            }
          }
          return { min: Math.max(0, Math.round(mn)), max: Math.max(0, Math.round(mx)) };
        };
        const curInterval = projectAlongInterval(curMod);
        const curAlong = curInterval.min;
        const dotModuleVsWall =
          wb.moduleTangent.x * wb.rawTangent.x + wb.moduleTangent.z * wb.rawTangent.z;
        // İzleyici dolaba karşıdan bakarken: moduleTangent (+X) SAĞ, -moduleTangent SOL yöndür.
        // Sol duvar gibi moduleTangent ile rawTangent zıt yönlü olduğunda SOL = +rawTangent (büyük along), SAĞ = -rawTangent (küçük along) olur!
        const moveTowardSmallerAlong = dotModuleVsWall >= 0 ? side === "left" : side === "right";

        const placed = st.appendModuleWithMultiWallSnap(tplId, { wallId: selWallId });
        if (placed) {
          const stNow = useConfiguratorStore.getState();
          const newIdx = stNow.project.modules.findIndex((m) => m.id === placed.id);
          if (newIdx >= 0) {
            const newW = placed.dimensions.width;
            const newD = placed.dimensions.depth;
            if (side === "above") {
              const targetPos = wallIntervalToModulePosition(
                selWall,
                curAlong,
                newW,
                newD,
                roomCenter
              );
              stNow.applyBatchProjectUpdate((draft) => {
                const dm = draft.modules[newIdx];
                if (dm) {
                  dm.position.x = targetPos.x;
                  dm.position.z = targetPos.z;
                  dm.position.y = 1450;
                  dm.rotation = { x: 0, y: targetPos.rotationYDeg, z: 0 };
                }
              }, "Üst dolap seçili modülün üstüne hizalandı");
              latestRef.current.showToast(`Üst dolap "${curMod.name}" üstüne yerleştirildi.`);
              return;
            }
            if (moveTowardSmallerAlong) {
              const desiredAlong = curInterval.min - newW;
              const shiftRightMm = desiredAlong < 0 ? -desiredAlong : 0;
              const finalAlong = Math.max(0, desiredAlong);
              const targetPos = wallIntervalToModulePosition(
                selWall,
                finalAlong,
                newW,
                newD,
                roomCenter
              );
              stNow.applyBatchProjectUpdate((draft) => {
                if (shiftRightMm > 0) {
                  draft.modules.forEach((m, idx) => {
                    if (idx === newIdx || m.category === "complementary" || m.category === "kitchen_island") return;
                    if (resolveModuleHostWallId(draft, m) !== selWallId) return;
                    const mInt = projectAlongInterval(m);
                    if (mInt.min >= curInterval.min - 5) {
                      const shifted = wallIntervalToModulePosition(
                        selWall,
                        mInt.min + shiftRightMm,
                        m.dimensions.width,
                        m.dimensions.depth,
                        roomCenter
                      );
                      m.position.x = shifted.x;
                      m.position.z = shifted.z;
                    }
                  });
                }
                const dm = draft.modules[newIdx];
                if (dm) {
                  dm.position.x = targetPos.x;
                  dm.position.z = targetPos.z;
                  dm.rotation = { x: 0, y: targetPos.rotationYDeg, z: 0 };
                }
              }, side === "left" ? "Yeni modül sol tarafa yerleştirildi" : "Yeni modül sağ tarafa yerleştirildi");
              latestRef.current.showToast(
                side === "left"
                  ? `Yeni modül "${curMod.name}" soluna eklendi.`
                  : `Yeni modül "${curMod.name}" sağına eklendi.`
              );
              return;
            }
            // moveTowardLargerAlong (+rawTangent yönü)
            const largerAlong = curInterval.max;
            const targetPos = wallIntervalToModulePosition(
              selWall,
              largerAlong,
              newW,
              newD,
              roomCenter
            );
            stNow.applyBatchProjectUpdate((draft) => {
              const dm = draft.modules[newIdx];
              if (dm) {
                dm.position.x = targetPos.x;
                dm.position.z = targetPos.z;
                dm.rotation = { x: 0, y: targetPos.rotationYDeg, z: 0 };
              }
            }, side === "left" ? "Yeni modül sol tarafa yerleştirildi" : "Yeni modül sağ tarafa yerleştirildi");
            latestRef.current.showToast(
              side === "left"
                ? `Yeni modül "${curMod.name}" soluna eklendi.`
                : `Yeni modül "${curMod.name}" sağına eklendi.`
            );
            return;
          }
        }
      }

      if (selWall && (selWallId !== primaryId || effWalls.length > 1)) {
        const placed = st.appendModuleWithMultiWallSnap(tplId, { wallId: selWallId });
        if (placed) {
          latestRef.current.showToast(`Yeni modül "${selWall.name}" üzerine eklendi.`);
          return;
        }
      }
      latestRef.current.dropV4TemplateWithSnap(tplId);
      latestRef.current.showToast(
        selWall ? `Yeni modül "${selWall.name}" sırasına eklendi.` : "Yeni ürün yanına eklendi."
      );
    },
    []
  );

  const handleAddCompositeAssembly = useCallback((presetId: string) => {
    latestRef.current.addCompositeAssemblyPreset(presetId);
    latestRef.current.showToast("Hazır set sahneye eklendi.");
  }, []);

  const handleAddSceneObject = useCallback((catalogId: string) => {
    const st = useConfiguratorStore.getState();
    const effWalls = getEffectiveSpaceWalls(st.project);
    const selWall = effWalls.find((w) => w.id === st.activeWallId) || effWalls[0];
    latestRef.current.addSceneObjectFromCatalog(catalogId, {
      wallId: selWall?.id,
    });
    latestRef.current.showToast(
      selWall ? `3B eşya "${selWall.name}" üzerine yerleştirildi.` : "3B eşya sahneye yerleştirildi."
    );
  }, []);

  const handleRotateSceneObject = useCallback((id: string) => {
    const cur = (latestRef.current.project.sceneObjects || []).find((o) => o.id === id);
    if (cur) {
      latestRef.current.updateSceneObject(id, {
        rotation: {
          x: cur.rotation?.x ?? 0,
          y: ((cur.rotation?.y ?? 0) + 90) % 360,
          z: cur.rotation?.z ?? 0,
        },
      });
    }
  }, []);

  const handleDuplicateActiveModule = useCallback(() => {
    latestRef.current.duplicateActiveModule();
    latestRef.current.showToast("Modül yanına kopyalandı.");
  }, []);

  const handleAddStackedTopModule = useCallback(() => {
    latestRef.current.addStackedTopModule();
    latestRef.current.showToast("Üst yüklük modülü eklendi.");
  }, []);

  const handleLoadKitchenPreset = useCallback((kind: "linear" | "l" | "u") => {
    if (kind === "linear") latestRef.current.loadLinearKitchen();
    else if (kind === "l") latestRef.current.loadLKitchen();
    else latestRef.current.loadUKitchen();
    latestRef.current.showToast("Hazır mutfak yerleşimi yüklendi.");
  }, []);

  const handleOpenKitchenIslandModal = useCallback(() => setKitchenIslandOpen(true), []);
  const handleToggleInspectorOpen = useCallback(() => {
    setIsInspectorOpen((v) => {
      const next = !v;
      if (next && deviceProfile.singleDrawerOnly) {
        setLeftDrawer(null);
        setQuickPaletteOpen(false);
      }
      return next;
    });
  }, [deviceProfile.singleDrawerOnly]);

  const handleQuickNavigateStep = useCallback((step: "dimensions" | "interior" | "showroom") => {
    if (step === "showroom") {
      setWorkspaceMode("showroom");
      return;
    }
    setWorkspaceMode("3d");
    setInspectorTab(step);
    setIsInspectorOpen(true);
  }, []);

  const handleCycleBayDoorType = useCallback((bIdx: number) => {
    const cur = latestRef.current.activeModule?.bays[bIdx]?.door?.type || "double";
    const order: Array<"double" | "single_left" | "single_right" | "open"> = [
      "double",
      "single_left",
      "single_right",
      "open",
    ];
    const next = order[(order.indexOf(cur as any) + 1) % order.length];
    setBayDoorType(bIdx, next);
  }, [setBayDoorType]);
  const handleToggleFacadeGrainContinuity = useCallback((enabled: boolean) => {
    latestRef.current.setFacadeGrainContinuity(enabled);
    latestRef.current.showToast(
      enabled ? "Cephe ahşap desen takibi açıldı." : "Cephe ahşap desen takibi kapatıldı."
    );
  }, []);

  const handleRunAutoFillersAndCrown = useCallback(() => {
    const res = latestRef.current.runAutoFillersAndCrown();
    latestRef.current.showToast(
      res.count > 0
        ? `${res.count} adet bitiş/taç parçası eklendi.`
        : "Mevcut yerleşim için ek bitiş parçası gerekmiyor."
    );
  }, []);

  const handleSaveModuleAsTemplate = useCallback((name: string) => {
    latestRef.current.saveActiveModuleAsCustomTemplate(
      name,
      latestRef.current.activeModule?.moduleFamilyId || "fam_wardrobe"
    );
    latestRef.current.showToast("Modül özel şablon olarak kütüphaneye kaydedildi.");
  }, []);

  const handleAddCustomMaterial = useCallback(
    (matInput: Parameters<typeof addCustomMaterialToProject>[0]) => {
      latestRef.current.addCustomMaterialToProject(matInput);
      latestRef.current.showToast(`"${matInput.name}" kartelaya eklendi.`);
    },
    []
  );

  const handleSetBayCustomWidth = useCallback(
    (bIdx: number, w: number | null) => latestRef.current.setBayCustomWidth(bIdx, w, true),
    []
  );
  const handleAddInternalDrawer = useCallback(
    (bIdx: number) => latestRef.current.addInternalDrawer(bIdx, 140),
    []
  );
  const handleAddSubDivider = useCallback(
    (bIdx: number) => latestRef.current.addSubDivider(bIdx),
    []
  );
  const handleApplyMaterialScope = useCallback(
    (scope: Parameters<typeof applyMaterialByTargetScope>[0], matId: string) =>
      latestRef.current.applyMaterialByTargetScope(scope, matId),
    []
  );
  const handleToggleModuleLed = useCallback(
    (
      enabled: boolean,
      opts?: Parameters<typeof latestRef.current.toggleModuleLedLighting>[1]
    ) => latestRef.current.toggleModuleLedLighting(enabled, opts),
    []
  );
  const handleRotateActiveModule90 = useCallback(
    () => latestRef.current.rotateActiveModule90(90),
    []
  );
  const handleOpenCustomHardwareModal = useCallback(() => setCustomHardwareOpen(true), []);

  const handleChangeDoorAngle = useCallback(
    (deg: number, animated = false) => {
      const clampedDeg = Math.max(0, Math.min(85, deg));
      const targetDrawerMm = clampedDeg <= 2 ? 0 : Math.round((clampedDeg / 85) * 260);
      latestRef.current.setDrawerOpenMm(targetDrawerMm, animated);
      latestRef.current.setDoorOpenAngleDeg(clampedDeg, animated);
    },
    []
  );
  const handleToggleDockDimensions = useCallback(() => {
    setShowDimensions3D((v) => !v);
  }, []);

  const studioSafeInsets2DSplit = useMemo(
    () => ({ topPx: 158, bottomPx: 24, leftPx: 16, rightPx: isInspectorOpen ? 392 : 64 }),
    [isInspectorOpen]
  );
  const studioSafeInsets2DFull = useMemo(
    () => ({
      topPx: 158,
      bottomPx: 24,
      leftPx: leftDrawer ? 492 : 76,
      rightPx: isInspectorOpen ? 392 : 64,
    }),
    [leftDrawer, isInspectorOpen]
  );
  const studioSafeInsetsPlan = useMemo(
    () => ({
      topPx: 76,
      bottomPx: 24,
      leftPx: leftDrawer ? 480 : 76,
      rightPx: isInspectorOpen ? 392 : 64,
    }),
    [leftDrawer, isInspectorOpen]
  );

      const selectedPartQuickToolbar =
        workspaceMode === "3d" && !isShowroom && activeModule && selected3DContextLabel ? (
          <OnObjectQuickToolbar
            activeModule={activeModule}
            activeBayIndex={activeBayIndex}
            selectedPartKind={selected3DPartKind}
            selectedComponentId={selected3DCompId || selectedComponentId}
            selectedContextLabel={selected3DContextLabel}
            displayUnit={displayUnit}
            placementMode={isInspectorOpen ? "docked" : "stage"}
            leftSafePx={leftDrawer ? 424 : 76}
            rightSafePx={isInspectorOpen ? 444 : 64}
            hasGuidedStepStrip={experienceTier === "simple"}
            hasTopPaintBanner={paintToolState.mode !== "none"}
            materials={allMaterials}
            isInspectorOpen={isInspectorOpen}
            onAddShelf={addShelf}
            onAddDrawerOrInternal={(bIdx) =>
              activeModule.bays.some((b) => b.door?.type === "sliding")
                ? handleAddInternalDrawer(bIdx)
                : addDrawer(bIdx)
            }
            onAddHangingRail={addHangingRail}
            onToggleDrawerInternal={(bIdx, drId) => {
              const dr = activeModule.bays[bIdx]?.drawers.find((d) => d.id === drId);
              if (!dr) return;
              setDrawerPlacement(bIdx, dr.id, dr.elevationY, dr.height, true, {
                isInternal: !dr.isInternal,
              });
            }}
            onUpdateCarcassConfig={updateCarcassConfig}
            onAddSubDivider={handleAddSubDivider}
            onCycleDoorType={handleCycleBayDoorType}
            onSetDoorProfile={(bIdx, profile, isGlass) =>
              setBayV4DoorConfig(bIdx, { crossSectionProfile: profile, isGlassFramed: isGlass })
            }
            onRemoveBayDoor={(bIdx) => {
              const targetBay = activeModule.bays[bIdx];
              const zones = computeBayDoorZones(activeModule, bIdx);
              const compId = selected3DCompId || selectedComponentId || "";
              const zKey = resolveDoorZoneKeyFromComponentId(compId);
              if (zones.length > 0 && targetBay?.door && targetBay.door.type !== "open") {
                const nextStates: Record<string, "closed" | "open"> = {
                  ...(targetBay.door.zoneDoorStates || {}),
                  [zKey]: "open",
                };
                const anyRemainingClosed = zones.some(
                  (z) => (z.key in nextStates ? nextStates[z.key] !== "open" : !z.isOpen)
                );
                if (!anyRemainingClosed) {
                  setBayDoorType(bIdx, "open");
                } else {
                  setBayV4DoorConfig(bIdx, {
                    zoneDoorStates: nextStates,
                    ...(zKey === "upper" ? { upperZoneDoorState: "open" } : {}),
                    ...(zKey === "lower" ? { lowerZoneDoorState: "open" } : {}),
                  });
                }
              } else {
                setBayDoorType(bIdx, "open");
              }
              setSelected3DContextLabel(null);
            }}
            onQuickApplyDoorMaterial={(matId) => handleApplyMaterialScope("doors", matId)}
            onToggleShelfMount={(bIdx, shId) => {
              const sh = activeModule.bays[bIdx]?.shelves.find((s) => s.id === shId);
              if (!sh) return;
              const isFixedNow = sh.isAdjustable === false || Boolean(sh.isFixed);
              setShelfMountType(bIdx, shId, isFixedNow, sh.fixedConnectorType || "minifix_dowel");
            }}
            onSetShelfThickness={(bIdx, shId, thick) => setShelfThickness(bIdx, shId, thick)}
            onShiftShelfElevation={(bIdx, shId, deltaMm) => {
              const sh = activeModule.bays[bIdx]?.shelves.find((s) => s.id === shId);
              if (!sh) return;
              setShelfElevation(bIdx, shId, Math.max(32, sh.elevationY + deltaMm));
            }}
            onMoveSubDividerToInterval={(bIdx, subId, botY, height) =>
              setSubDividerPlacement(bIdx, subId, {
                elevationY: botY,
                height,
                targetMidY: Math.round(botY + height / 2),
              })
            }
            onCenterSubDividerX={(bIdx, subId, bayClearW) =>
              setSubDividerPlacement(bIdx, subId, {
                offsetX: Math.round((bayClearW - (activeModule.carcass.panelThickness || 18)) / 2),
              })
            }
            onShiftRailElevation={(bIdx, railId, deltaMm) => {
              const rl = activeModule.bays[bIdx]?.hangingRails.find((r) => r.id === railId);
              if (!rl) return;
              setHangingRailElevation(bIdx, railId, Math.max(160, rl.elevationY + deltaMm));
            }}
            onDeleteSelectedPart={() => {
              removeSelectedInteriorComponent();
              setSelected3DContextLabel(null);
            }}
            onOpenHardwareSwap={(group, bIdx) => setHardwareSwapTarget({ group, bayIndex: bIdx })}
            onOpenQuickPaletteDock={() => setQuickPaletteOpen(true)}
            onQuickApplyZoneMaterial={handleApplyZoneMaterial}
            onOpenInspectorDetails={() => {
              setIsInspectorOpen(true);
              if (isCompactViewport) setLeftDrawer(null);
            }}
            onDismiss={() => setSelected3DContextLabel(null)}
          />
        ) : null;

  return (
    <main
      data-testid="v11-birim-studio-workspace"
      className="birim-dramatic-studio relative w-screen h-dvh overflow-hidden overscroll-none bg-[#1A1E26] text-[#F3F4F6] select-none"
    >
      <React.Suspense fallback={null}>
      {/* 1. ÜST MİMARİ BAŞLIK ÇUBUĞU */}
      <StudioHeaderBar
        projectTitle={project.title}
        workspaceMode={workspaceMode}
        onChangeWorkspaceMode={setWorkspaceMode}
        cadSubMode={cadSubMode}
        onChangeCadSubMode={setCadSubMode}
        split2DViewMode={split2DViewMode}
        onChangeSplit2DViewMode={setSplit2DViewMode}
        experienceTier={experienceTier}
        onChangeExperienceTier={setExperienceTier}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        totalPriceEur={pricing?.totalWithVatEur || 0}
        blockingIssueCount={blockingCount}
        engineeringFindings={allFindings}
        onApplyFindingFix={handleApplyFindingFix}
        onFocusFinding={handleFocusFinding}
        onOpenProjectModal={handleOpenProjectModal}
        onOpenWizardModal={handleOpenWizardModal}
        onOpenCommandSearch={handleOpenCommandSearch}
        onOpenQuoteModal={handleOpenQuoteModal}
        onOpenBomModal={handleOpenBomModal}
        onOpenProductionSheetModal={handleOpenProductionSheetModal}
        onOpenAssemblyModal={handleOpenAssemblyModal}
        onOpenStudioRenderModal={handleOpenStudioRenderModal}
        onOpenArModal={handleOpenArModal}
        onOpenStoreErpModal={handleOpenStoreErpModal}
        onOpenStandardsModal={handleOpenStandardsModal}
        onOpenSaasModal={handleOpenSaasModal}
        onOpenMepModal={handleOpenMepModal}
        onOpenCutoutModal={handleOpenCutoutModal}
        onOpenSceneHubModal={handleOpenSceneHubCapsule}
        isReadOnlyCustomer={initialMode === "showroom"}
        displayUnit={displayUnit}
        onChangeDisplayUnit={setDisplayUnit}
        onOpenDoorShowcase={() => setDoorShowcaseOpen(true)}
        uiFontScale={uiFontScale}
        onChangeUiFontScale={setUiFontScale}
        activeInspectorTab={inspectorTab}
        onQuickNavigateStep={handleQuickNavigateStep}
        variantSlots={headerVariantSlots}
        activeVariantSlot={activeVariantSlot}
        onSelectOrSaveVariantSlot={handleSelectOrSaveVariantSlot}
      />

      {/* 2. ANA ÇALIŞMA SAHNESİ — WebGL kanvası sekme geçişlerinde ASLA sökülmez (paused={!show3DCanvas} ile 0ms anlık geçiş) */}
      <div
        ref={splitContainerRef}
        className={`w-full h-full flex ${
          workspaceMode === "2d" && cadSubMode === "split" && show3DCanvas && deviceProfile.isPortrait && !deviceProfile.isDesktop
            ? "flex-col"
            : ""
        }`}
      >
        <div
          style={
            workspaceMode === "2d" && cadSubMode === "split" && show3DCanvas
              ? deviceProfile.isPortrait && !deviceProfile.isDesktop
                ? { height: `${splitRatio3D}%` }
                : { width: `${splitRatio3D}%` }
              : undefined
          }
          className={
            !show3DCanvas
              ? "hidden"
              : workspaceMode === "2d" && cadSubMode === "split"
              ? deviceProfile.isPortrait && !deviceProfile.isDesktop
                ? "w-full relative shrink-0 min-h-0"
                : "h-full relative shrink-0 min-w-0"
              : "w-full h-full relative"
          }
        >
          <V3ThreeViewport
            paused={!show3DCanvas}
            theme="warm-light"
            showGrid={!isShowroom}
            showInCanvasHud={!isShowroom}
            minimalChrome={true}
            showDimensions={showDimensions3D}
            isRightInspectorOpen={!isShowroom && isInspectorOpen}
            stageSafeInsets={stageSafeInsets}
            onToggleDimensions={handleToggleDimensions3D}
            onRequest2DElevation={handleRequest2DElevation}
          />
        </div>

        {workspaceMode === "2d" && cadSubMode === "split" && show3DCanvas && (() => {
          const isVerticalSplit = deviceProfile.isPortrait && !deviceProfile.isDesktop;
          return (
          <div
            role="separator"
            aria-orientation={isVerticalSplit ? "horizontal" : "vertical"}
            title="3B / 2B ekran oranını sürükleyerek ayarlayın (Çift tıkla: %50 / %50)"
            onDoubleClick={() => setSplitRatio3D(50)}
            onPointerDown={(e) => {
              e.preventDefault();
              const container = splitContainerRef.current;
              if (!container) return;
              document.body.style.userSelect = "none";
              document.body.style.cursor = isVerticalSplit ? "row-resize" : "col-resize";
              const onMove = (ev: PointerEvent) => {
                const rect = container.getBoundingClientRect();
                if (isVerticalSplit) {
                  if (rect.height <= 0) return;
                  const pct = ((ev.clientY - rect.top) / rect.height) * 100;
                  setSplitRatio3D(Math.max(25, Math.min(75, Math.round(pct * 10) / 10)));
                } else {
                  if (rect.width <= 0) return;
                  const pct = ((ev.clientX - rect.left) / rect.width) * 100;
                  setSplitRatio3D(Math.max(22, Math.min(78, Math.round(pct * 10) / 10)));
                }
              };
              const onUp = () => {
                document.body.style.userSelect = "";
                document.body.style.cursor = "";
                window.removeEventListener("pointermove", onMove);
                window.removeEventListener("pointerup", onUp);
                window.removeEventListener("pointercancel", onUp);
              };
              window.addEventListener("pointermove", onMove);
              window.addEventListener("pointerup", onUp);
              window.addEventListener("pointercancel", onUp);
            }}
            className={
              isVerticalSplit
                ? "h-3 w-full shrink-0 cursor-row-resize touch-none relative z-30 flex items-center justify-center group bg-[#E6E0D3]/60 hover:bg-[#1C1917]/15 transition-colors select-none"
                : "w-3 sm:w-2 h-full shrink-0 cursor-col-resize touch-none relative z-30 flex items-center justify-center group bg-[#E6E0D3]/60 hover:bg-[#1C1917]/15 transition-colors select-none"
            }
          >
            <span
              className={
                isVerticalSplit
                  ? "h-1 w-12 rounded-full bg-[#A8A29E] group-hover:bg-[#1C1917] transition-colors"
                  : "w-1 h-10 rounded-full bg-[#A8A29E] group-hover:bg-[#1C1917] transition-colors"
              }
            />
          </div>
          );
        })()}

        {workspaceMode === "2d" && (() => {
          const effective2DMode =
            cadSubMode === "section"
              ? "section"
              : cadSubMode === "split"
              ? split2DViewMode
              : "elevation";
          return (
          <div
            style={
              cadSubMode === "split"
                ? deviceProfile.isPortrait && !deviceProfile.isDesktop
                  ? { height: `calc(${100 - splitRatio3D}% - 12px)` }
                  : { width: `calc(${100 - splitRatio3D}% - 8px)` }
                : undefined
            }
            className={
              cadSubMode === "split"
                ? deviceProfile.isPortrait && !deviceProfile.isDesktop
                  ? "w-full relative flex-1 min-h-0"
                  : "h-full relative flex-1 min-w-0"
                : "w-full h-full relative"
            }
          >
            <V3CadViewport2D
              mode={effective2DMode}
              interactivePlan={effective2DMode === "plan"}
              externalSectionDirection={cadExternalSectionDir}
              externalSectionRatio={sectionRatio2D}
              onExternalSectionChange={handleExternalSectionChange}
              hideLegacySectionBar={true}
              studioSafeInsets={
                cadSubMode === "split"
                  ? studioSafeInsets2DSplit
                  : studioSafeInsets2DFull
              }
            />

            {/* 2B KESİT MODUNDA DOĞRUDAN GÖRSEL ÜST PLAN KESİT SEÇİCİSİ */}
            {effective2DMode === "section" && activeModule && (
              <div
                style={
                  cadSubMode === "split"
                    ? undefined
                    : { left: leftDrawer ? "488px" : "80px" }
                }
                className={
                  cadSubMode === "split"
                    ? "absolute top-[156px] left-4 max-lg:left-2.5 max-lg:right-2.5 max-lg:w-auto z-20 w-[290px]"
                    : "fixed top-[168px] max-lg:top-[156px] max-lg:!left-2.5 max-lg:right-2.5 max-lg:w-auto z-20 w-[312px] transition-[left] duration-200"
                }
              >
                <SectionPlaneMiniMap
                  activeModule={activeModule}
                  axis={sectionAxis2D}
                  ratio={sectionRatio2D}
                  onChangeAxis={setSectionAxis2D}
                  onChangeRatio={setSectionRatio2D}
                />
              </div>
            )}
          </div>
          );
        })()}

        {workspaceMode === "plan" && (
          <div className="w-full h-full relative">
            <V3CadViewport2D
              mode="plan"
              interactivePlan={true}
              studioSafeInsets={studioSafeInsetsPlan}
            />
          </div>
        )}
      </div>

      {/* 3. SOL ÜRÜN, MODÜL, ADA, MASA VE 3B EŞYA BAŞLATICI */}
      {!isShowroom && (
        <LeftCatalogLauncher
          activeDrawer={leftDrawer}
          onChangeDrawer={handleChangeLeftDrawer}
          templates={combinedTemplates}
          modules={project.modules}
          sceneObjects={stableSceneObjects}
          activeModuleIndex={activeModuleIndex}
          wallWidthMm={wallWidthMm}
          ceilingHeightMm={ceilingHeightMm}
          obstacles={spaceObstacles}
          onApplyTemplateToActive={handleApplyTemplateToActive}
          onAppendTemplateAdjacent={handleAppendTemplateAdjacent}
          onAddCompositeAssembly={handleAddCompositeAssembly}
          onAddSceneObject={handleAddSceneObject}
          onRotateSceneObject={handleRotateSceneObject}
          onRemoveSceneObject={removeSceneObject}
          onSelectModuleIndex={setActiveModuleIndex}
          onDuplicateActiveModule={handleDuplicateActiveModule}
          onAddStackedTopModule={handleAddStackedTopModule}
          onFillRemainingWallGap={handleFillRemainingWallGap}
          onRemoveModuleAt={removeModuleAt}
          onSetRoomDimensions={setRoomDimensions}
          onAddSpaceObstacle={addSpaceObstacle}
          onRemoveSpaceObstacle={removeSpaceObstacle}
          onLoadKitchenPreset={handleLoadKitchenPreset}
          onOpenWizardModal={handleOpenWizardModal}
          onOpenKitchenIslandModal={handleOpenKitchenIslandModal}
          onOpenCapsuleAndGlbHub={setSceneHubTab}
          isQuickPaletteOpen={quickPaletteOpen}
          onToggleQuickPalette={handleToggleQuickPalette}
        />
      )}

      {/* 4. SAĞ PARAMETRİK KONTROL PANELİ */}
      {!isShowroom && activeModule && (
        <RightParametricInspector
          selectedPartSlot={isInspectorOpen ? selectedPartQuickToolbar : null}
          isOpen={isInspectorOpen}
          onToggleOpen={handleToggleInspectorOpen}
          activeTab={inspectorTab}
          onChangeTab={setInspectorTab}
          experienceTier={experienceTier}
          onChangeExperienceTier={setExperienceTier}
          modules={project.modules}
          activeModule={activeModule}
          activeModuleIndex={activeModuleIndex}
          activeBayIndex={activeBayIndex}
          materials={allMaterials}
          handleProfiles={handleProfiles}
          engineeringFindings={allFindings}
          facadeGrainContinuity={
            Boolean(project.facadeGrainContinuity) ||
            activeModule.carcass.grainContinuityMode === "facade_continuous"
          }
          onToggleFacadeGrainContinuity={handleToggleFacadeGrainContinuity}
          onRunAutoFillersAndCrown={handleRunAutoFillersAndCrown}
          onOpenCutoutModal={handleOpenCutoutModal}
          onSaveModuleAsTemplate={handleSaveModuleAsTemplate}
          onAddCustomMaterial={handleAddCustomMaterial}
          onSelectModuleIndex={setActiveModuleIndex}
          onSelectBayIndex={setActiveBayIndex}
          onSetDimensions={setDimensions}
          onBeginSliderDrag={beginHistoryTransaction}
          onCommitSliderDrag={commitHistoryTransaction}
          onSetPlinthHeight={setPlinthHeight}
          onSplitBayIntoTwo={splitBayIntoTwo}
          onEqualizeBaysAndShelves={equalizeBaysAndShelves}
          onRemoveBayAt={removeBayAt}
          onSetBayCustomWidth={handleSetBayCustomWidth}
          onApplyBayPreset={applyBayInteriorPreset}
          onAddShelf={addShelf}
          onAddFixedShelf={addFixedShelf}
          onSetShelfMountType={setShelfMountType}
          onRemoveShelf={removeShelf}
          onSetShelfElevation={setShelfElevation}
          onSetShelfThickness={setShelfThickness}
          onAddDrawer={addDrawer}
          onAddInternalDrawer={handleAddInternalDrawer}
          onSetDrawerPlacement={setDrawerPlacement}
          onRemoveDrawer={removeDrawer}
          onAddHangingRail={addHangingRail}
          onRemoveHangingRail={removeHangingRail}
          onSetHangingRailProfile={setHangingRailProfile}
          onAddSpecialFitting={addSpecialFitting}
          onRemoveSpecialFitting={removeSpecialFitting}
          onAddSubDivider={handleAddSubDivider}
          onSetSubDividerPlacement={setSubDividerPlacement}
          onRemoveSubDivider={removeSubDivider}
          onSetBayDoorType={setBayDoorType}
          onSetSlidingMountingType={setModuleSlidingMountingType}
          onSetBayV4DoorConfig={setBayV4DoorConfig}
          onCopyDoorToAllBays={copyDoorConfigToAllBays}
          onCopyBayInteriorToAllBays={copyBayInteriorToAllBays}
          onMirrorModuleBays={mirrorModuleBaysLeftRight}
          onUpdateCarcassConfig={updateCarcassConfig}
          onApplyMaterialScope={handleApplyMaterialScope}
          onToggleModuleLed={handleToggleModuleLed}
          onApplyApprovedFix={handleApplyFindingFix}
          onDuplicateActiveModule={duplicateActiveModule}
          onAddStackedTopModule={addStackedTopModule}
          onRotateActiveModule90={handleRotateActiveModule90}
          onRemoveActiveModule={removeActiveModule}
          onOpenCustomHardwareModal={handleOpenCustomHardwareModal}
          hideExpandTabOnCompact={
            !deviceProfile.isDesktop && (Boolean(leftDrawer) || quickPaletteOpen)
          }
        />
      )}

      {/* 4B. Sağ Denetçi Kapalıyken Sahne Ortası Taşmayan Seçili Parça Kartı */}
      {!isInspectorOpen && selectedPartQuickToolbar}

      {/* BAĞLAMSAL ÇAKIŞMA, HATALI TASARIM & TEK TIKLA OTOMATİK DÜZELT UYARI SİSTEMİ */}
            {/* Sol alt sabit Tasarım Önerisi kartı kaldırıldı — tüm öneriler üst bardaki Öneri rozeti ve sağ panelde yer alır */}

      {/* 5A. YÜZEN HIZLI KARTELA, İMZA KOMBİNASYONLAR VE 3B BOYA PANELİ */}
      {(workspaceMode === "3d" || workspaceMode === "showroom") && (
        <QuickStyleAndMaterialDock
          isOpen={quickPaletteOpen}
          leftSafePx={stageSafeInsets.leftPx}
          rightSafePx={stageSafeInsets.rightPx}
          project={project}
          activeModuleIndex={activeModuleIndex}
          materials={allMaterials}
          paintToolState={paintToolState}
          onChangePaintToolState={handleChangePaintToolState}
          onApplyZoneMaterial={handleApplyZoneMaterial}
          onReplaceProjectMaterial={handleReplaceProjectMaterial}
          onApplyCuratedMoodboard={handleApplyCuratedMoodboard}
          onSetSurfaceFinish={(finish, allMods) => {
            useConfiguratorStore.getState().applyBatchProjectUpdate((draft) => {
              if (allMods) {
                draft.modules.forEach((m) => {
                  m.surfaceFinishOverride = finish;
                });
              } else if (draft.modules[activeModuleIndex]) {
                draft.modules[activeModuleIndex].surfaceFinishOverride = finish;
              }
            }, "Yüzey parlaklık dokusu güncellendi");
            showToast(
              finish === "gloss"
                ? "Parlak Lake yüzey yansıması uygulandı."
                : finish === "satin"
                ? "Saten yüzey yansıması uygulandı."
                : "İpek Mat yüzey dokusu uygulandı."
            );
          }}
          onClose={() => setQuickPaletteOpen(false)}
        />
      )}

      {/* 5. TEK BİRLEŞİK ALT SAHNE KAPSÜLÜ (Sunum modunda ShowroomPresentationOverlay tekil alt dock'u yönetir, çifte bar oluşmaz) */}
      {workspaceMode === "3d" && (
        <BottomSceneDock
          activeModule={activeModule}
          doorOpenAngleDeg={doorOpenAngleDeg}
          onChangeDoorAngle={handleChangeDoorAngle}
          doorsHidden={doorsHidden3D}
          onToggleDoorsHidden={handleToggleDoorsHidden}
          showDimensions={showDimensions3D}
          onToggleDimensions={handleToggleDockDimensions}
          showInteriorProps={showInteriorProps3D}
          onToggleInteriorProps={handleToggleInteriorProps}
          renderStyle={viewportRenderStyle}
          onChangeRenderStyle={setViewportRenderStyle}
          cncXrayMode={cncXrayMode}
          onToggleCncXray={toggleCncXrayMode}
          explodedFactor={explodedFactor}
          onChangeExplodedFactor={setExplodedFactor}
          isSimpleTier={experienceTier === "simple"}
          projectId={project.id}
          isShowroom={isShowroom}
          isQuickPaletteOpen={quickPaletteOpen}
          onToggleQuickPalette={handleToggleQuickPalette}
          paintToolMode={paintToolState.mode}
          onTogglePaintBucket={handleTogglePaintBucketBtn}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={undo}
          onRedo={redo}
          isHiddenOnCompactSheet={
            !deviceProfile.isDesktop && (Boolean(leftDrawer) || isInspectorOpen || quickPaletteOpen)
          }
        />
      )}

      {isShowroom && (
        <ShowroomPresentationOverlay
          project={project}
          modules={project.modules}
          activeModuleIndex={activeModuleIndex}
          materials={allMaterials}
          totalPriceWithVatEur={pricing?.totalWithVatEur || 0}
          doorOpenAngleDeg={doorOpenAngleDeg}
          onSelectModuleIndex={setActiveModuleIndex}
          onChangeDoorAngle={handleChangeDoorAngle}
          onOpenQuoteModal={handleOpenQuoteModal}
          onOpenStudioRenderModal={handleOpenStudioRenderModal}
          onOpenArModal={handleOpenArModal}
          onApplyMaterialScope={handleApplyMaterialScope}
        />
      )}

      {toastText && (
        <div
          style={{ bottom: quickPaletteOpen ? "352px" : "80px" }}
          className="fixed left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-[#141413] text-white text-xs font-medium shadow-lg pointer-events-none transition-[bottom] duration-150"
        >
          {toastText}
        </div>
      )}

      {/* 6. TÜM MODALLAR İÇİN YAY ANİMASYONLU AÇILIŞ & KAPANIŞ SAHNESİ */}
      <AnimatedModalPresence isOpen={projectModalOpen}>
        {(renderOpen) => (
          <V3ProjectModal isOpen={renderOpen} onClose={() => setProjectModalOpen(false)} />
        )}
      </AnimatedModalPresence>

      <AnimatedModalPresence isOpen={wizardModalOpen}>
        {(renderOpen) => (
          <GuidedSetupModal
            isOpen={renderOpen}
            project={project}
            materials={allMaterials}
            onClose={() => setWizardModalOpen(false)}
            onApply={(wiz) => {
              applyGuidedWizardLayout(wiz);
              showToast("Endüstriyel standartlara uygun yerleşim oluşturuldu.");
            }}
          />
        )}
      </AnimatedModalPresence>

      <AnimatedModalPresence isOpen={quoteModalOpen}>
        {(renderOpen) => (
          <QuoteSummaryModal
            isOpen={renderOpen}
            project={project}
            materials={allMaterials}
            pricing={pricing}
            onClose={() => setQuoteModalOpen(false)}
            onOpenBomModal={(tab) => setBomModalTab(tab || "cutlist")}
            onOpenStoreErpModal={() => setStoreErpOpen(true)}
          />
        )}
      </AnimatedModalPresence>

      <AnimatedValuePresence value={bomModalTab}>
        {(latchedBomTab) => (
          <BomModal
            isOpen={true}
            initialTab={latchedBomTab}
            onClose={() => setBomModalTab(null)}
          />
        )}
      </AnimatedValuePresence>

      <AnimatedModalPresence isOpen={storeErpOpen}>
        {(renderOpen) => (
          <StoreErpModal isOpen={renderOpen} onClose={() => setStoreErpOpen(false)} />
        )}
      </AnimatedModalPresence>

      <AnimatedModalPresence isOpen={assemblyModalOpen}>
        {(renderOpen) => (
          <AssemblyDiagramModal
            isOpen={renderOpen}
            project={project}
            bom={bom}
            activeModuleIndex={activeModuleIndex}
            onClose={() => setAssemblyModalOpen(false)}
          />
        )}
      </AnimatedModalPresence>

      <ProductionSheetStudioModal
        open={productionSheetModalOpen}
        onClose={() => setProductionSheetModalOpen(false)}
        project={project}
        bom={bom}
        spaceWalls={spaceWalls}
        spaceObstacles={spaceObstacles}
        initialUnit={displayUnit}
        onOpenBomModal={(tab) => setBomModalTab(tab || "cutlist")}
      />

      <AnimatedModalPresence isOpen={studioRenderOpen}>
        {(renderOpen) => (
          <StudioRenderModal
            isOpen={renderOpen}
            projectId={project.id}
            projectTitle={project.title}
            onClose={() => setStudioRenderOpen(false)}
          />
        )}
      </AnimatedModalPresence>

      <AnimatedModalPresence isOpen={arModalOpen}>
        {(renderOpen) => (
          <ArRoomPreviewModal
            isOpen={renderOpen}
            onClose={() => setArModalOpen(false)}
            project={project}
            materials={allMaterials}
            parts={arExportParts}
            clientTotalEur={pricing?.totalWithVatEur || 0}
          />
        )}
      </AnimatedModalPresence>

      <AnimatedModalPresence isOpen={standardsModalOpen}>
        {(renderOpen) => (
          <RulesStandardsModal
            isOpen={renderOpen}
            onClose={() => setStandardsModalOpen(false)}
            onOpenAdminModal={() => {
              setStandardsModalOpen(false);
              setSaasModalOpen(true);
            }}
            tenantId={activeTenantId}
            humanCompatStatusLabel={
              blockingCount === 0 ? "Üretime Hazır" : `${blockingCount} Kontrol Noktası`
            }
            rulesModalTab={rulesTab}
            setRulesModalTab={setRulesTab}
            findings={allFindings}
            ergonomicProfileId={ergonomicProfileId}
            setErgonomicProfileId={setErgonomicProfileId}
            regionalErgonomicProfiles={regionalErgonomicProfiles}
            applyApprovedEngineeringFix={applyApprovedEngineeringFix}
            onShowBanner={(b) => showToast(b.text)}
            customStdRules={customStdRules}
            setCustomStdRules={setCustomStdRules}
            kitchenRuleRegistry={KITCHEN_ENGINEERING_RULE_REGISTRY}
            newStdName={newStdName}
            setNewStdName={setNewStdName}
            newStdRef={newStdRef}
            setNewStdRef={setNewStdRef}
            newStdMetric={newStdMetric}
            setNewStdMetric={setNewStdMetric}
            newStdThreshold={newStdThreshold}
            setNewStdThreshold={setNewStdThreshold}
            newStdCategory={newStdCategory}
            setNewStdCategory={setNewStdCategory}
            newStdSeverity={newStdSeverity}
            setNewStdSeverity={setNewStdSeverity}
          />
        )}
      </AnimatedModalPresence>

      <AnimatedModalPresence isOpen={saasModalOpen}>
        {(renderOpen) => (
          <SaasTenantStudioModal
            isOpen={renderOpen}
            onClose={() => setSaasModalOpen(false)}
          />
        )}
      </AnimatedModalPresence>

      <AnimatedModalPresence isOpen={commandSearchOpen}>
        {(renderOpen) => (
          <CommandSearchModal
            isOpen={renderOpen}
            actions={commandActions}
            onClose={() => setCommandSearchOpen(false)}
          />
        )}
      </AnimatedModalPresence>

      <AnimatedModalPresence isOpen={kitchenIslandOpen}>
        {(renderOpen) => (
          <KitchenIslandTableModal
            isOpen={renderOpen}
            project={project}
            materials={allMaterials}
            activeModuleIndex={activeModuleIndex}
            onAddIsland={(spec) => {
              addKitchenIslandUnit(spec);
              setKitchenIslandOpen(false);
              showToast("Şelale ada mutfak sahneye eklendi.");
            }}
            onAddOrUpdateAttachedTable={(spec) => {
              addOrUpdateAttachedTable(spec);
              setKitchenIslandOpen(false);
              showToast("Açılı masa bağlantısı eklendi.");
            }}
            onClose={() => setKitchenIslandOpen(false)}
          />
        )}
      </AnimatedModalPresence>

      <AnimatedModalPresence isOpen={customHardwareOpen}>
        {(renderOpen) => (
          <CustomHardwareModal
            isOpen={renderOpen}
            onClose={() => setCustomHardwareOpen(false)}
            onApplyHandleToActiveBay={(spec) => {
              setBayV4DoorConfig(activeBayIndex, {
                handleCategory: spec.handleCategory,
                handleProfileId: spec.handleProfileId,
                handleLengthMm: spec.handleLengthMm,
                handleMaterialId: spec.handleMaterialId,
              });
            }}
            onApplyHandleToAllBays={(spec) => {
              setBayV4DoorConfig(activeBayIndex, {
                handleCategory: spec.handleCategory,
                handleProfileId: spec.handleProfileId,
                handleLengthMm: spec.handleLengthMm,
                handleMaterialId: spec.handleMaterialId,
              });
              copyDoorConfigToAllBays(activeBayIndex);
            }}
            onCatalogChanged={() => setCatalogBump((n) => n + 1)}
          />
        )}
      </AnimatedModalPresence>

      <AnimatedModalPresence isOpen={mepModalOpen}>
        {(renderOpen) => (
          <MepCoordinationModal
            isOpen={renderOpen}
            project={project}
            onClose={() => setMepModalOpen(false)}
          />
        )}
      </AnimatedModalPresence>

      <AnimatedModalPresence isOpen={Boolean(cutoutModalOpen && activeModule)}>
        {(renderOpen) =>
          activeModule ? (
            <PanelCutoutModal
              isOpen={renderOpen}
              activeModule={activeModule}
              allModules={project.modules}
              roomObstacles={spaceObstacles}
              bom={bom}
              canExportProduction={blockingCount === 0}
              onChangeCutouts={(nextCutouts) => {
                setModuleUtilityCutouts(nextCutouts);
                showToast("Panel kertme ayarları güncellendi.");
              }}
              onAutoResolveCornerCollisions={() => {
                autoResolveCornerCollisions();
                showToast("Köşe çakışmaları otomatik çözüldü.");
              }}
              onClose={() => setCutoutModalOpen(false)}
            />
          ) : null
        }
      </AnimatedModalPresence>

      <AnimatedValuePresence value={sceneHubTab}>
        {(latchedHubTab) => (
          <SceneObjectAndModuleHubModal
            isOpen={true}
            initialTab={latchedHubTab}
            project={project}
            totalWithVatEur={pricing?.totalWithVatEur || 0}
            selectedSceneObjectId={selectedSceneObjectId}
            onSelectSceneObject={setSelectedSceneObjectId}
            onAppendModule={(tplId, opts) => appendModuleWithMultiWallSnap(tplId, opts)}
            onFillWallGap={(gap, tplId) => fillWallGapWithParametricModule(gap, tplId)}
            onAddCompositeAssembly={addCompositeAssemblyPreset}
            onSaveActiveModuleAsTemplate={saveActiveModuleAsCustomTemplate}
            onDeleteCustomTemplate={deleteCustomModuleTemplate}
            onAddSceneObjectCatalog={(catId) =>
              addSceneObjectFromCatalog(catId, undefined)
            }
            onAddCustomSceneObject={addCustomSceneObject}
            onUpdateSceneObject={updateSceneObject}
            onDuplicateSceneObject={duplicateSceneObject}
            onRemoveSceneObject={removeSceneObject}
            onAutoFillersAndCrown={runAutoFillersAndCrown}
            onAutoNotchObstacles={runAutoNotchObstacles}
            onImportRoomPlanJson={importRoomPlanLiDARJson}
            onCreateCapsuleModule={(spec) => {
              addCustomCapsuleModule(spec);
              showToast("Özel kapsül ünite oluşturuldu.");
            }}
            onClose={() => setSceneHubTab(null)}
          />
        )}
      </AnimatedValuePresence>
      {workspaceMode === "3d" && !isShowroom && activeModule && hardwareSwapTarget && (
        <HardwareQuickSwapPopover
          target={hardwareSwapTarget}
          activeModule={activeModule}
          onApplyDoorHardware={(bayIndices, patch, msg) => {
            bayIndices.forEach((bIdx) => {
              setBayV4DoorConfig(bIdx, patch);
            });
            showToast(msg);
          }}
          onApplyDrawerHardware={(bayIndices, patch, msg) => {
            bayIndices.forEach((bIdx) => {
              const drws = activeModule.bays[bIdx]?.drawers || [];
              drws.forEach((d) => {
                updateBayDrawerConfig(bIdx, d.id, patch);
              });
            });
            showToast(msg);
          }}
          onApplyRailProfile={(bayIndices, profileType, msg) => {
            bayIndices.forEach((bIdx) => {
              const rails = activeModule.bays[bIdx]?.hangingRails || [];
              rails.forEach((r) => {
                setHangingRailProfile(bIdx, r.id, profileType);
              });
            });
            showToast(msg);
          }}
          onClose={() => setHardwareSwapTarget(null)}
        />
      )}
      <AnimatedModalPresence isOpen={doorShowcaseOpen}>
        {(renderOpen) => (
          <DoorSystemsShowcaseModal
            isOpen={renderOpen}
            onClose={() => setDoorShowcaseOpen(false)}
            onLoad3DShowcase={(mode) => {
              loadDoorSystemsShowcase(mode);
              showToast(
                mode === "kitchen_opening_systems"
                  ? "15 paralel mutfak kapak & açılım örneği 3B sahneye dizildi."
                  : "9 paralel kapak modeli & kesit örneği 3B sahneye dizildi."
              );
            }}
          />
        )}
      </AnimatedModalPresence>

      {/* 3B Galeri Modundayken Paralel Modül İsim Şeridi (Tek Tıkla Seç & İncele) */}
      {workspaceMode === "3d" &&
        !isShowroom &&
        !quickPaletteOpen &&
        project.modules.some((m) => m.id.startsWith("mod_show_")) && (
          <div
            data-testid="v11-showcase-module-strip"
            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-30 max-w-[min(92vw,960px)] px-2.5 py-1.5 rounded-2xl bg-[#FAF8F4]/95 backdrop-blur-md border border-[#DFD3BC] shadow-lg flex items-center gap-1.5 overflow-x-auto"
          >
            {project.modules.map((m, idx) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setActiveModuleIndex(idx);
                  setActiveBayIndex(0);
                }}
                className={`px-2.5 py-1 rounded-xl text-[10.5px] font-semibold whitespace-nowrap transition cursor-pointer shrink-0 ${
                  idx === activeModuleIndex
                    ? "bg-[#141413] text-white"
                    : "bg-white hover:bg-[#EFEAE0] border border-[#E5DFD3] text-[#1C1917]"
                }`}
              >
                {m.name}
              </button>
            ))}
          </div>
        )}
      </React.Suspense>
    </main>
  );
};

export default BirimStudioWorkspace;
