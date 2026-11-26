"use client";

import { buildSceneObject3DGroup, subscribeSceneObjectGlbLoaded } from "../materials/sceneObject3DBuilder";
import React, { useEffect, useRef, useCallback, useState, useMemo } from "react";
import * as THREE from "three";
import { buildSpatialEngineeringFindings } from "../engine/kitchenSpatialEngine";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { createLongPressController } from "../design-system/touchGestureHelpers";
import { useV3Adapter, getMemoizedUnifiedEngineering } from "../adapter/useV3Adapter";
import { calculateFourSpaceDimensions, evaluateUnifiedEngineeringModel } from "@birim/core";
import { GEOMETRY_ENGINE_REV } from "@birim/geometry";
import { computeElevationSnapTargets, findDraggableInteriorComponent, type ElevationSnapTarget } from "../engine/elevationSnapEngine";
import { applyMaxAnisotropyToCachedTextures, configurePbrForHardwareTier, trimPbrCachesUnderMemoryPressure, getStudioEnvironmentTexture, getStudioPmremEnvironment, disposeRendererPmremEnvironment, type ArchitecturalFloorStyle, type ArchitecturalWallTone } from "../materials/pbrMaterialSystem";
import { disposeObject3DTree, markSharedMaterial, attachWebGLContextRecovery, createSafeWebGL2Renderer, disposeWebGLRendererCleanly, getAdaptiveWebglRenderBudget, type WebGL2CapabilityReport } from "../materials/webglResourceGuard";
import { Software3DFallbackViewport } from "./Software3DFallbackViewport";
import { preloadAllWardrobeGlbAssets, subscribeWardrobeGlbCatalogChange, subscribeWardrobeGlbRenderNeeded } from "../materials/wardrobeGlbAssetLoader";
import { type Viewport3DContextTarget } from "./Viewport3DContextMenu";
import { useConfiguratorStore } from "../../store/useConfiguratorStore";
import { type PaintTool3DState } from "../../v11/quickMaterialAndMoodboardEngine";
import { computeFastParametricSceneBounds, collectSolidCabinetMeshes, formatEngineeringErrorCode } from "./three-viewport/viewport3DSceneHelpers";
import { Viewport3DCalloutOverlays } from "./three-viewport/Viewport3DCalloutOverlays";
import { Viewport3DFloatingCards } from "./three-viewport/Viewport3DFloatingCards";
import { Viewport3DHudToolbars } from "./three-viewport/Viewport3DHudToolbars";
import { useViewport3DRoomXrayAndDropEffects } from "./three-viewport/useViewport3DRoomXrayAndDropEffects";
import { useViewport3DWindowAndKeyEvents } from "./three-viewport/useViewport3DWindowAndKeyEvents";
import { useViewport3DCalloutProjections } from "./three-viewport/useViewport3DCalloutProjections";
import { createViewport3DPointerMoveHandler } from "./three-viewport/viewport3DPointerMoveHandler";
import { createViewport3DPointerUpAndContextMenu } from "./three-viewport/viewport3DPointerUpAndContextMenu";
import { attachViewport3DStudioRenderAndLoop } from "./three-viewport/viewport3DStudioRenderAndLoop";
import { useViewport3DCameraSectionAndFrames } from "./three-viewport/useViewport3DCameraSectionAndFrames";
import { syncParametricCabinetMeshes3D } from "./three-viewport/syncParametricCabinetMeshes3D";
import { syncInteriorWardrobeProps3D, Viewport3DBottomAlertsAndContextMenu, Viewport3DBottomCenterHudStack, Viewport3DBeaconPopoverBody } from "./three-viewport/syncInteriorPropsAndAlerts3D";


export interface V3ThreeViewportProps {
  paused?: boolean;
  theme?: "warm-light" | "showroom-neutral" | "dark";
  showGrid?: boolean;
  showInCanvasHud?: boolean;
  minimalChrome?: boolean;
  showDimensions?: boolean;
  stageSafeInsets?: { topPx?: number; bottomPx?: number; leftPx?: number; rightPx?: number };
  isRightInspectorOpen?: boolean;
  onToggleDimensions?: () => void;
  onRequest2DElevation?: () => void;
  onPerformanceSample?: (metrics: { lastRenderMs: number }) => void;
}

export const V3ThreeViewport: React.FC<V3ThreeViewportProps> = React.memo(
  ({
    paused = false,
    theme = "warm-light",
    showGrid = true,
    showInCanvasHud = true,
    minimalChrome = false,
    showDimensions,
    stageSafeInsets,
    isRightInspectorOpen = false,
    onToggleDimensions,
    onRequest2DElevation,
    onPerformanceSample,
  }) => {
    const mountRef = useRef<HTMLDivElement>(null);
    const {
      project,
      activeModule,
      activeModuleIndex,
      activeBay,
      activeBayIndex,
      doorOpenAngleDeg,
      setDoorOpenAngleDeg,
      toggleDoorOpen,
      drawerOpenMm,
      setDrawerOpenMm,
      explodedFactor,
      setExplodedFactor,
      isOrthographic,
      cameraPreset,
      selectedComponentId,
      setSelectedComponentId,
      v4ModuleTemplates,
      hardwareCatalog,
      spaceObstacles,
      spaceWalls,
      setActiveModuleIndex,
      setActiveBayIndex,
      selectModuleBayComponent,
      setDimensions,
    resizeModuleParametric,
      setPlinthHeight,
      setBayDoorType,
      setModuleSlidingMountingType,
      setBayV4DoorConfig,
      copyDoorConfigToAllBays,
      setSelectedComponentMaterial,
      applyMaterialToSimilarComponents,
      applyMaterialByTargetScope,
      resetModuleMaterialOverrides,
      setDoorCrossSectionProfile,
      setShelfElevation,
      setDrawerPlacement,
      setSpecialFittingPlacement,
      setHangingRailElevation,
      setBayCustomWidth,
      setSubDividerPlacement,
      setBayCount,
      setShelfThickness,
      moveInteriorItemToBay,
      equalizeBaysAndShelves,
      addShelf,
      addDrawer,
      addHangingRail,
      addSpecialFitting,
      addSubDivider,
      splitBayIntoTwo,
      applyBayInteriorPreset,
      removeBayAt,
      removeBayAndShrinkModule,
      shrinkDoubleBayToSingle,
      removeSelectedInteriorComponent,
      addAdjacentModule,
      addStackedTopModule,
      duplicateActiveModule,
      removeActiveModule,
      toggleModuleLedLighting,
      removeSpaceObstacle,
      undo,
      redo,
      rotateActiveModule90,
      flipActiveDoorDirection,
      setModulePosition,
      swapModuleWithNeighbor,
      applyV4Template,
      finishModuleDragWithSmartSwap,
      updateObstaclePosition,
      beginHistoryTransaction,
      commitHistoryTransaction,
      addInteriorItemAtElevation,
      dropV4TemplateWithSnap,
      selectedSceneObjectId,
      setSelectedSceneObjectId,
      addSceneObjectFromCatalog,
      updateSceneObject,
      duplicateSceneObject,
      removeSceneObject,
      deleteActiveSelectionSmart,
      applyApprovedEngineeringFix,
    } = useV3Adapter({ lightweightViewport: true });

    const pausedRef = useRef<boolean>(Boolean(paused));
    pausedRef.current = Boolean(paused);
    const removeSceneObjectRef = useRef(removeSceneObject);
    removeSceneObjectRef.current = removeSceneObject;
    const duplicateSceneObjectRef = useRef(duplicateSceneObject);
    duplicateSceneObjectRef.current = duplicateSceneObject;
    const duplicateActiveModuleRef = useRef(duplicateActiveModule);
    duplicateActiveModuleRef.current = duplicateActiveModule;
    const deleteActiveSelectionSmartRef = useRef(deleteActiveSelectionSmart);
    deleteActiveSelectionSmartRef.current = deleteActiveSelectionSmart;
    const cadCopyClipboardRef = useRef<
      { kind: "sceneObject"; id: string } | { kind: "module"; moduleId: string } | null
    >(null);
    const isStoreBatchDragging = useConfiguratorStore((s) => s.batchStartProject !== null);
    const displayUnit = useConfiguratorStore((s) => s.displayUnit);
    const displayUnitRef = useRef<"cm" | "mm">(displayUnit);
    displayUnitRef.current = displayUnit;
    const lastSettled3DEngRef = useRef<ReturnType<typeof evaluateUnifiedEngineeringModel> | null>(null);
    const live3DEngineeringReport = useMemo(() => {
      if ((paused || isStoreBatchDragging) && lastSettled3DEngRef.current) {
        return lastSettled3DEngRef.current;
      }
      if (paused) return null;
      const computed = getMemoizedUnifiedEngineering(project);
      const spatialFindings = buildSpatialEngineeringFindings(project);
      if (spatialFindings.length === 0) {
        lastSettled3DEngRef.current = computed;
        return computed;
      }
      const existingKeys = new Set(
        computed.findings.map((f) => `${f.code}_${f.targetModuleId || f.targetId || ""}`)
      );
      const newSpatial = spatialFindings.filter(
        (sf) => !existingKeys.has(`${sf.code}_${sf.targetModuleId || sf.targetId || ""}`)
      );
      if (newSpatial.length === 0) {
        lastSettled3DEngRef.current = computed;
        return computed;
      }
      const mergedReport: ReturnType<typeof evaluateUnifiedEngineeringModel> = {
        ...computed,
        findings: [...newSpatial, ...computed.findings],
        blockingSafetyAndEngineeringErrors: [
          ...newSpatial.filter((sf) => sf.severity === "error" || sf.blockingProduction),
          ...computed.blockingSafetyAndEngineeringErrors,
        ],
        canExportToCncAndSaw: false,
        canApproveFinalErpRelease: false,
      };
      lastSettled3DEngRef.current = mergedReport;
      return mergedReport;
    }, [project, paused, isStoreBatchDragging]);

    const experienceTier = useConfiguratorStore((s) => s.userExperienceTier);
    const activeWallId = useConfiguratorStore((s) => s.activeWallId);
    const canUndo3D = useConfiguratorStore((s) => s.history.length > 0);
    const canRedo3D = useConfiguratorStore((s) => s.future.length > 0);
    const isSimpleTier = experienceTier === "simple";
    const [contextMenuTarget, setContextMenuTarget] = useState<Viewport3DContextTarget | null>(null);
    const [editingBadge, setEditingBadge] = useState<null | "W" | "H" | "D" | "SOKET">(null);
    const [badgeDraftValue, setBadgeDraftValue] = useState<string>("");
    const [doorsHiddenIn3D, setDoorsHiddenIn3D] = useState<boolean>(false);
    const [cutawayActiveBay, setCutawayActiveBay] = useState<boolean>(false);
    useEffect(() => {
      if (typeof window === "undefined") return;
      window.dispatchEvent(
        new CustomEvent("birim:doors-hidden-state-changed", {
          detail: Boolean(doorsHiddenIn3D || cutawayActiveBay),
        })
      );
    }, [doorsHiddenIn3D, cutawayActiveBay]);
    const [showInteriorProps3D, setShowInteriorProps3D] = useState<boolean>(true);
    const [engineeringAlertCollapsed, setEngineeringAlertCollapsed] = useState<boolean>(false);
    const [selectedBeaconFinding, setSelectedBeaconFinding] = useState<{
      code: string;
      severity: string;
      title: string;
      message: string;
      suggestions: string[];
      remediationProposals: import("@birim/core").RemediationProposal[];
      moduleIndex: number;
      bayIndex: number;
    } | null>(null);
    const engineeringBeaconGroupRef = useRef<THREE.Group | null>(null);
    const interiorPropsGroupRef = useRef<THREE.Group | null>(null);
    const multiHoleMeshCacheRef = useRef<Map<string, THREE.InstancedMesh>>(new Map());
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onNightLedToggle = () => {
      setLightingPreset((prev) => (prev === "night_led" ? "daylight" : "night_led"));
    };
    window.addEventListener("birim:toggle-night-led", onNightLedToggle);
    return () => window.removeEventListener("birim:toggle-night-led", onNightLedToggle);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onToggle = (ev: Event) => {
      const detail = (ev as CustomEvent<{ visible?: boolean }>).detail;
      setShowInteriorProps3D((prev) =>
        typeof detail?.visible === "boolean" ? detail.visible : !prev
      );
    };
    window.addEventListener("birim:toggle-interior-props", onToggle);
    return () => window.removeEventListener("birim:toggle-interior-props", onToggle);
  }, []);
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("birim:interior-props-changed", { detail: { visible: showInteriorProps3D } }));
    }
  }, [showInteriorProps3D]);
    const bayPopoverDomRef = useRef<HTMLDivElement | null>(null);
    const activeBayWorldAnchorRef = useRef<THREE.Vector3 | null>(null);
    const doorPopoverDomRef = useRef<HTMLDivElement | null>(null);
    const activeDoorWorldAnchorRef = useRef<THREE.Vector3 | null>(null);
    const contextPopoverDomRef = useRef<HTMLDivElement | null>(null);
    const dimPopoverDomRef = useRef<HTMLDivElement | null>(null);
    const lifestylePropsCacheRef = useRef<Map<string, THREE.Group>>(new Map());
    const stageSafeInsetsRef = useRef(stageSafeInsets);
    useEffect(() => {
      stageSafeInsetsRef.current = stageSafeInsets;
    }, [stageSafeInsets]);

    // Draggable & Collapsible Floating Panel System (prevents covering the 3D cabinet)
    const [floatingPanelPos, setFloatingPanelPos] = useState<
      Record<"bay" | "door" | "dim" | "context", { x: number; y: number } | null>
    >({
      bay: null,
      door: null,
      dim: null,
      context: null,
    });
    const floatingPanelPosRef = useRef(floatingPanelPos);
    useEffect(() => {
      floatingPanelPosRef.current = floatingPanelPos;
    }, [floatingPanelPos]);

    const [collapsedFloatingPanels, setCollapsedFloatingPanels] = useState<
      Record<"bay" | "door" | "callouts", boolean>
    >({
      bay: false,
      door: false,
      callouts: false,
    });
    const [dockedToCorner, setDockedToCorner] = useState<boolean>(true);
    const dockedToCornerRef = useRef<boolean>(true);
    useEffect(() => {
      dockedToCornerRef.current = dockedToCorner;
    }, [dockedToCorner]);

    const [isDraggingItemOver3D, setIsDraggingItemOver3D] = useState<boolean>(false);
    const [section3DAxis, setSection3DAxis] = useState<null | "X" | "Z">(null);
    const [section3DRatio, setSection3DRatio] = useState<number>(0.55);
    const [section3DMenuOpen, setSection3DMenuOpen] = useState<boolean>(false);
    const [explode3DMenuOpen, setExplode3DMenuOpen] = useState<boolean>(false);
    const customLabelOffsetsRef = useRef<Record<string, { dx: number; dy: number }>>({});
    const [, setCustomLabelTick] = useState(0);

    const [doorMenuSubSection, setDoorMenuSubSection] = useState<
      null | "type" | "direction" | "handle" | "material"
    >(null);
    const [floatingMatScope, setFloatingMatScope] = useState<"single" | "module_similar" | "project_similar">("single");
    const [bayMenuSubSection, setBayMenuSubSection] = useState<
      null | "accessories" | "templates"
    >(null);
    const [clicked3DContext, setClicked3DContext] = useState<null | {
      kind: "door" | "bay";
      bayIndex: number;
      role: string;
      componentId?: string;
      label: string;
    }>(null);
    const [localShowDimensions, setLocalShowDimensions] = useState<boolean>(() => !isSimpleTier);
    const [showRoomArchitecture3D, setShowRoomArchitecture3D] = useState<boolean>(true);
    const [wallFocusHighlight, setWallFocusHighlight] = useState<boolean>(false);
    const hasActiveCabinetSelection = Boolean(selectedComponentId);
    useEffect(() => {
      if (selectedComponentId) setWallFocusHighlight(false);
    }, [selectedComponentId]);
    useEffect(() => {
      const onWallSel = () => setWallFocusHighlight(true);
      window.addEventListener("birim:wall-selected-3d", onWallSel);
      return () => window.removeEventListener("birim:wall-selected-3d", onWallSel);
    }, []);
    const [lightingPreset, setLightingPreset] = useState<"daylight" | "showroom_warm" | "night_led">(
      "daylight"
    );
    const [wallTone, setWallTone] = useState<ArchitecturalWallTone>("soft_plaster");
    const [floorStyle, setFloorStyle] = useState<ArchitecturalFloorStyle>("oak_parquet");
    const [activeCamPill, setActiveCamPill] = useState<"3d" | "2d" | "front" | "side" | "top" | "interior">("3d");
    const [renderMenuOpen, setRenderMenuOpen] = useState<boolean>(false);
    const [ultraRenderProgress, setUltraRenderProgress] = useState<number | null>(null);
    const [materialModeActive, setMaterialModeActive] = useState<boolean>(false);
    const [materialPaintTool, setMaterialPaintTool] = useState<
      "select" | "paint" | "group" | "same_material"
    >("select");
    const [activeBrushMaterialId, setActiveBrushMaterialId] = useState<string>("mat_veneer_oak");
    const matWorldAnchorsRef = useRef<
      { id: string; worldPos: THREE.Vector3; offsetPx: [number, number] }[]
    >([]);
    const matCalloutDomMapRef = useRef<Map<string, HTMLDivElement>>(new Map());
    const [hardwareViewMode, setHardwareViewMode] = useState<"normal" | "hardware" | "technical">("normal");
    const [hardwareViewMenuOpen, setHardwareViewMenuOpen] = useState<boolean>(false);
    const [selectedHwCalloutId, setSelectedHwCalloutId] = useState<string | null>(null);
    const hwWorldAnchorsRef = useRef<
      { id: string; worldPos: THREE.Vector3; offsetPx: [number, number] }[]
    >([]);
    const hwCalloutDomMapRef = useRef<Map<string, HTMLDivElement>>(new Map());
    const [renderEdgeMode, setRenderEdgeMode] = useState<"photoreal" | "cad">("photoreal");
    const [moveObjectMode3D, setMoveObjectMode3D] = useState<boolean>(false);
    const [invertCameraMouse, setInvertCameraMouse] = useState<boolean>(false);
    const minimalChromeRef = useRef<boolean>(Boolean(minimalChrome));
    minimalChromeRef.current = Boolean(minimalChrome);
    const lastSnapBannerRef = useRef<string | null>(null);
    const snapBannerDomRef = useRef<HTMLDivElement | null>(null);
    const snapBannerTextRef = useRef<HTMLSpanElement | null>(null);
    const snapBadgeDomRef = useRef<HTMLDivElement | null>(null);
    const snapBadgeLabelRef = useRef<HTMLSpanElement | null>(null);
    const snapBadgeYRef = useRef<HTMLSpanElement | null>(null);
    const setSnapBannerDedup = useCallback((msg: string | null) => {
      if (lastSnapBannerRef.current === msg) return;
      lastSnapBannerRef.current = msg;
      const el = snapBannerDomRef.current;
      const txt = snapBannerTextRef.current;
      if (el && txt) {
        if (msg) {
          txt.textContent = msg;
          el.style.display = "flex";
        } else {
          el.style.display = "none";
        }
      }
    }, []);
    const setActive3DSnap = useCallback((snap: ElevationSnapTarget | null) => {
      const el = snapBadgeDomRef.current;
      const lbl = snapBadgeLabelRef.current;
      const yEl = snapBadgeYRef.current;
      if (el && lbl && yEl) {
        if (snap) {
          lbl.textContent = `🎯 Hizalandı: ${snap.label}`;
          yEl.textContent = displayUnitRef.current === "cm" ? `Y: ${Number((snap.elevationY / 10).toFixed(1))} cm` : `Y: ${snap.elevationY} mm`;
          el.style.display = "flex";
        } else {
          el.style.display = "none";
        }
      }
    }, []);
    const active3DSnap: ElevationSnapTarget | null = null;
    const dragDropSnapBanner: string | null = null;
    const roomArchGroupRef = useRef<THREE.Group | null>(null);
    const sceneObjectsGroupRef = useRef<THREE.Group | null>(null);
    const [glbRefreshTick, setGlbRefreshTick] = useState<number>(0);
    const [webglUnavailable, setWebglUnavailable] = useState<boolean>(false);
    const [webglCapability, setWebglCapability] = useState<WebGL2CapabilityReport | null>(null);
    const [webglRetryKey, setWebglRetryKey] = useState<number>(0);
    const hoverBadgeDomRef = useRef<HTMLDivElement | null>(null);
    const hoverBadgeTextRef = useRef<HTMLSpanElement | null>(null);
    const solidMeshesCacheRef = useRef<{ open: THREE.Mesh[]; closed: THREE.Mesh[]; dirty: boolean }>({
      open: [],
      closed: [],
      dirty: true,
    });
    const getCachedSolidMeshes = useCallback((curGroup: THREE.Object3D, includeBayVolumes: boolean) => {
      const cache = solidMeshesCacheRef.current;
      if (cache.dirty) {
        cache.open = collectSolidCabinetMeshes(curGroup, true);
        cache.closed = cache.open.filter((m) => m.userData?.role !== "bay_compartment");
        cache.dirty = false;
      }
      return includeBayVolumes ? cache.open : cache.closed;
    }, []);
    const isOrbitingRef = useRef<boolean>(false);
    const canvasRectRef = useRef<DOMRect | null>(null);
    const [dismissedBayPopover, setDismissedBayPopover] = useState<boolean>(false);
    const [isCtrlPressed, setIsCtrlPressed] = useState<boolean>(false);
    const [webglContextLost, setWebglContextLost] = useState<boolean>(false);
    const cncXrayMode = useConfiguratorStore((s) => s.cncXrayMode);
    const setCncXrayMode = useConfiguratorStore((s) => s.setCncXrayMode);
    const viewportRenderStyle = useConfiguratorStore((s) => s.viewportRenderStyle);
    const setViewportRenderStyle = useConfiguratorStore((s) => s.setViewportRenderStyle);
    const isWireframeMode = viewportRenderStyle === "wireframe";
    const effectiveDoorsHiddenIn3D = doorsHiddenIn3D || viewportRenderStyle === "carcass_only";
    const isXrayActive = cncXrayMode || viewportRenderStyle === "transparent" || hardwareViewMode === "technical";
    const updateCeilingConfigStore = useConfiguratorStore((s) => s.updateCeilingConfig);
    const setFacadeGrainContinuityStore = useConfiguratorStore((s) => s.setFacadeGrainContinuity);
    const setRoomDimensionsStore = useConfiguratorStore((s) => s.setRoomDimensions);
    const updateCarcassStore = useConfiguratorStore((s) => s.updateCarcass);
    const storeBom = useConfiguratorStore((s) => (isXrayActive ? s.bom : null));

    useEffect(() => {
      setDismissedBayPopover(false);
    }, [activeBayIndex, activeModuleIndex, doorsHiddenIn3D]);

    const cameraFlightRef = useRef<{
      startPos: THREE.Vector3;
      endPos: THREE.Vector3;
      startTarget: THREE.Vector3;
      endTarget: THREE.Vector3;
      startTime: number;
      durationMs: number;
    } | null>(null);
    const hemiLightRef = useRef<THREE.HemisphereLight | null>(null);
    const keyLightRef = useRef<THREE.DirectionalLight | null>(null);
    const rimLightRef = useRef<THREE.DirectionalLight | null>(null);
    const gallerySpotLightRef = useRef<THREE.SpotLight | null>(null);

    const latestStateRef = useRef({
      project,
      activeModuleIndex,
      selectedComponentId,
      doorOpenAngleDeg,
      doorsHiddenIn3D,
      moveObjectMode3D,
      spaceObstacles,
      setActiveModuleIndex,
      setActiveBayIndex,
      setSelectedComponentId,
      selectModuleBayComponent,
      setShelfElevation,
      setDrawerPlacement,
      setSpecialFittingPlacement,
      setHangingRailElevation,
      setBayCustomWidth,
      setSubDividerPlacement,
      setModulePosition,
      resizeModuleParametric,
      finishModuleDragWithSmartSwap,
      updateObstaclePosition,
      updateSceneObject,
      beginHistoryTransaction,
      commitHistoryTransaction,
      addInteriorItemAtElevation,
      setDoorOpenAngleDeg,
    });
    useEffect(() => {
      latestStateRef.current = {
        project,
        activeModuleIndex,
        selectedComponentId,
        doorOpenAngleDeg,
        doorsHiddenIn3D,
        moveObjectMode3D,
        spaceObstacles,
        setActiveModuleIndex,
        setActiveBayIndex,
        setSelectedComponentId,
        selectModuleBayComponent,
        setShelfElevation,
        setDrawerPlacement,
        setSpecialFittingPlacement,
        setHangingRailElevation,
        setBayCustomWidth,
        setSubDividerPlacement,
        setModulePosition,
      resizeModuleParametric,
        finishModuleDragWithSmartSwap,
        updateObstaclePosition,
        updateSceneObject,
        beginHistoryTransaction,
        commitHistoryTransaction,
        addInteriorItemAtElevation,
        setDoorOpenAngleDeg,
      };
    }, [
      project,
      activeModuleIndex,
      selectedComponentId,
      doorOpenAngleDeg,
      doorsHiddenIn3D,
      moveObjectMode3D,
      spaceObstacles,
      setActiveModuleIndex,
      setActiveBayIndex,
      setSelectedComponentId,
      selectModuleBayComponent,
      setShelfElevation,
      setDrawerPlacement,
      setSpecialFittingPlacement,
      setHangingRailElevation,
      setBayCustomWidth,
      setSubDividerPlacement,
      setModulePosition,
      finishModuleDragWithSmartSwap,
      updateObstaclePosition,
      updateSceneObject,
      beginHistoryTransaction,
      commitHistoryTransaction,
      addInteriorItemAtElevation,
      setDoorOpenAngleDeg,
    ]);

    useEffect(() => {
      return () => {
        for (const grp of lifestylePropsCacheRef.current.values()) {
          if (!grp.parent) {
            disposeObject3DTree(grp);
          }
        }
        lifestylePropsCacheRef.current.clear();
      };
    }, []);

    // Sync OrbitControls mouse direction (Natural object rotation vs standard camera orbit)
    useEffect(() => {
      if (controlsRef.current) {
        controlsRef.current.rotateSpeed = invertCameraMouse ? -0.85 : 0.85;
      }
    }, [invertCameraMouse]);

    const effectiveShowDimensions = showDimensions ?? localShowDimensions;
    const handleToggleDimensions = useCallback(() => {
      if (onToggleDimensions) {
        onToggleDimensions();
      } else {
        setLocalShowDimensions((prev) => !prev);
      }
    }, [onToggleDimensions]);


    const sceneRef = useRef<THREE.Scene | null>(null);
    const perspCamRef = useRef<THREE.PerspectiveCamera | null>(null);
    const orthoCamRef = useRef<THREE.OrthographicCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const meshGroupRef = useRef<THREE.Group | null>(null);
    const sectionCapGroupRef = useRef<THREE.Group | null>(null);
    const dimGroupRef = useRef<THREE.Group | null>(null);
    const ghostSnapGroupRef = useRef<THREE.Group | null>(null);
    const lastGhostKeyRef = useRef<string>("");
    const lastAccessoryDropTargetRef = useRef<{ bayIndex: number; elevationY: number; offsetX?: number; accessory: import("../../types/birim-window").BirimDraggedAccessoryPayload } | null>(null);
    const selectionFrameGroupRef = useRef<THREE.Group | null>(null);
    const activeModFrameGroupRef = useRef<THREE.Group | null>(null);
    const dimWorldAnchorsRef = useRef<{ id: string; worldPos: THREE.Vector3; worldStart?: THREE.Vector3; worldEnd?: THREE.Vector3; isActiveMod?: boolean }[]>([]);
    const liveDimDeltaRef = useRef<{ dx: number; dz: number }>({ dx: 0, dz: 0 });
    const dimLabelDomMapRef = useRef<Map<string, HTMLDivElement>>(new Map());
    const labelScale3DRef = useRef<number>(1);
    const gridRef = useRef<THREE.GridHelper | null>(null);
    const shadowPlaneRef = useRef<THREE.Mesh | null>(null);
    const wakeRenderLoopRef = useRef<(() => void) | null>(null);
    const needsRenderRef = useMemo(() => {
      let dirty = true;
      return {
        get current(): boolean {
          return dirty;
        },
        set current(val: boolean) {
          dirty = val;
          if (val) wakeRenderLoopRef.current?.();
        },
      } as React.MutableRefObject<boolean>;
    }, []);
    useEffect(() => {
      if (!paused) {
        needsRenderRef.current = true;
      }
    }, [paused, needsRenderRef]);
    const wallPulseRef = useRef<{ wallId: string; startTime: number; durationMs: number } | null>(null);
    const prevActiveWallIdRef = useRef<string | undefined>(activeWallId);

    const triggerWallSelectionPulse = useCallback((targetWallId?: string | null) => {
      if (!targetWallId) return;
      wallPulseRef.current = {
        wallId: targetWallId,
        startTime: performance.now(),
        durationMs: 680,
      };
      needsRenderRef.current = true;
    }, []);

    useEffect(() => {
      if (activeWallId && prevActiveWallIdRef.current !== activeWallId) {
        triggerWallSelectionPulse(activeWallId);
      }
      prevActiveWallIdRef.current = activeWallId;
    }, [activeWallId, triggerWallSelectionPulse]);

    useEffect(() => {
      const onWallPulse = (ev: Event) => {
        const detail = (ev as CustomEvent<{ wallId?: string }>).detail;
        const targetId = detail?.wallId || useConfiguratorStore.getState().activeWallId || "wall_main";
        triggerWallSelectionPulse(targetId);
      };
      window.addEventListener("birim:wall-selected-3d", onWallPulse);
      return () => window.removeEventListener("birim:wall-selected-3d", onWallPulse);
    }, [triggerWallSelectionPulse]);

    const [glbCatalogRev, setGlbCatalogRev] = useState(0);
    const [glbLibraryOpen, setGlbLibraryOpen] = useState(false);

    const previewOriginalMatsRef = useRef<Map<THREE.Object3D, THREE.Material | THREE.Material[]>>(
      new Map()
    );
    const restoreHoverPreviewMaterials = useCallback(() => {
      if (previewOriginalMatsRef.current.size === 0) return false;
      previewOriginalMatsRef.current.forEach((origMat, obj) => {
        if ((obj as THREE.Mesh).isMesh || (obj as THREE.InstancedMesh).isInstancedMesh) {
          (obj as THREE.Mesh).material = origMat;
        }
      });
      previewOriginalMatsRef.current.clear();
      return true;
    }, []);

    const [paintTool3D, setPaintTool3D] = useState<PaintTool3DState>({
      mode: "none",
      materialId: "mat_veneer_oak",
      clickBehavior: "active_scope",
      zoneScope: "active_doors",
    });
    const paintTool3DRef = useRef<PaintTool3DState>(paintTool3D);
    paintTool3DRef.current = paintTool3D;

    const fitKeyLightShadowToSceneBounds = useCallback(() => {
      const kl = keyLightRef.current;
      if (!kl || !kl.castShadow) return;
      const mods = useConfiguratorStore.getState().project.modules;
      const bounds = computeFastParametricSceneBounds(mods);
      if (bounds.isEmpty()) return;
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      const maxSpan = Math.max(1200, size.x, size.y, size.z);
      const halfSpan = Math.min(4800, Math.max(1050, maxSpan * 0.68 + 340));

      kl.target.position.set(center.x, Math.max(420, center.y * 0.78), center.z);
      kl.target.updateMatrixWorld();
      kl.position.set(center.x - halfSpan * 1.05, center.y + halfSpan * 1.48, center.z + halfSpan * 1.42);
      const sCam = kl.shadow.camera;
      if (
        Math.abs(sCam.left + halfSpan) > 40 ||
        Math.abs(sCam.right - halfSpan) > 40 ||
        Math.abs(sCam.top - halfSpan * 1.08) > 40
      ) {
        sCam.left = -halfSpan;
        sCam.right = halfSpan;
        sCam.top = halfSpan * 1.08;
        sCam.bottom = -halfSpan * 0.72;
        sCam.near = 180;
        sCam.far = Math.max(8500, halfSpan * 4.8);
        sCam.updateProjectionMatrix();
      }
    }, []);

    const markShadowsAndRender = useCallback(() => {
      fitKeyLightShadowToSceneBounds();
      if (rendererRef.current && rendererRef.current.shadowMap.enabled) {
        rendererRef.current.shadowMap.needsUpdate = true;
      }
      needsRenderRef.current = true;
    }, [fitKeyLightShadowToSceneBounds]);

    useEffect(() => {
      if (showInteriorProps3D) {
        preloadAllWardrobeGlbAssets();
      }
    }, [showInteriorProps3D]);

    useEffect(() => {
      const unsubRender = subscribeWardrobeGlbRenderNeeded(() => {
        needsRenderRef.current = true;
      });
      const unsubCatalog = subscribeWardrobeGlbCatalogChange(() => {
        setGlbCatalogRev((rev) => rev + 1);
      });
      return () => {
        unsubRender();
        unsubCatalog();
      };
    }, []);

    useViewport3DWindowAndKeyEvents({ cadCopyClipboardRef, cameraFlightRef, controlsRef, deleteActiveSelectionSmartRef, duplicateActiveModuleRef, duplicateSceneObjectRef, meshGroupRef, mountRef, needsRenderRef, pausedRef, perspCamRef, previewOriginalMatsRef, removeSceneObjectRef, restoreHoverPreviewMaterials, setActiveBrushMaterialId, setClicked3DContext, setCutawayActiveBay, setDismissedBayPopover, setDoorsHiddenIn3D, setEditingBadge, setExplode3DMenuOpen, setFloorStyle, setGlbLibraryOpen, setHardwareViewMenuOpen, setHardwareViewMode, setIsCtrlPressed, setLightingPreset, setMaterialModeActive, setMoveObjectMode3D, setPaintTool3D, setRenderEdgeMode, setRenderMenuOpen, setSection3DAxis, setSection3DMenuOpen, setSection3DRatio, setShowRoomArchitecture3D, setSnapBannerDedup, setWallTone });
    const { startFloatingPanelDrag, startCalloutBadgeDrag, dimLabels, hwCallouts, matCallouts, updateProjectedDimensionLabels } = useViewport3DCalloutProjections({ activeBayIndex, activeBayWorldAnchorRef, activeDoorWorldAnchorRef, activeModuleIndex, bayPopoverDomRef, canvasRectRef, contextPopoverDomRef, controlsRef, customLabelOffsetsRef, dimLabelDomMapRef, dimPopoverDomRef, dimWorldAnchorsRef, displayUnit, dockedToCornerRef, doorPopoverDomRef, effectiveShowDimensions, floatingPanelPosRef, hardwareCatalog, hwCalloutDomMapRef, hwWorldAnchorsRef, isSimpleTier, labelScale3DRef, liveDimDeltaRef, matCalloutDomMapRef, matWorldAnchorsRef, mountRef, needsRenderRef, perspCamRef, project, rendererRef, selectedComponentId, setCustomLabelTick, setFloatingPanelPos, stageSafeInsetsRef });

    const requestRender = useCallback(() => {
      needsRenderRef.current = true;
    }, []);

    useEffect(() => {
      const saved = Number(window.localStorage.getItem("birim_ui_font_scale"));
      if (Number.isFinite(saved) && saved >= 0.75 && saved <= 1.6) {
        labelScale3DRef.current = saved;
        needsRenderRef.current = true;
      }
      const onScaleChange = (ev: Event) => {
        const val = Number((ev as CustomEvent<number>).detail);
        if (Number.isFinite(val) && val >= 0.75 && val <= 1.6) {
          labelScale3DRef.current = val;
          needsRenderRef.current = true;
        }
      };
      window.addEventListener("birim:canvas-font-scale-changed", onScaleChange);
      return () => window.removeEventListener("birim:canvas-font-scale-changed", onScaleChange);
    }, []);

    // Initialize WebGL Scene once — never destroyed across mode switches
    useEffect(() => {
      const container = mountRef.current;
      if (!container) return;

      const width = container.clientWidth || 800;
      const height = container.clientHeight || 600;

      const scene = new THREE.Scene();
      const bgHex =
        theme === "warm-light"
          ? 0x262a33
          : theme === "showroom-neutral"
          ? 0x22252d
          : 0x14161b;
      scene.background = new THREE.Color(bgHex);
      sceneRef.current = scene;

      // 30° Architectural Telephoto Lens at Human Eye-Level (eliminates security-camera downward distortion)
      const perspCamera = new THREE.PerspectiveCamera(30, width / height, 15, 28000);
      perspCamera.position.set(2050, 1820, 7650);
      perspCamRef.current = perspCamera;

      const aspect = width / height;
      const orthoD = 1950;
      const orthoCamera = new THREE.OrthographicCamera(
        -orthoD * aspect,
        orthoD * aspect,
        orthoD,
        -orthoD,
        -50000,
        50000
      );
      orthoCamera.position.set(2050, 1820, 7650);
      orthoCamRef.current = orthoCamera;

      const safeGl = createSafeWebGL2Renderer({
        forceRefreshProbe: webglRetryKey > 0,
        preferAlpha: false,
      });
      setWebglCapability(safeGl.ok ? safeGl.bundle.capability : safeGl.capability);
      if (!safeGl.ok) {
        setWebglUnavailable(true);
        return;
      }
      setWebglUnavailable(false);

      const renderer = safeGl.bundle.renderer;
      const isLegacyGpu = safeGl.bundle.capability.isLegacyOrLowSpecGpu;
      const adaptiveBudget = getAdaptiveWebglRenderBudget(
        isLegacyGpu,
        renderer.capabilities?.maxTextureSize || 2048,
        safeGl.bundle.capability.gpuRendererInfo
      );
      configurePbrForHardwareTier(adaptiveBudget);
      document.body.dataset.birimGpuTier = adaptiveBudget.disableBackdropBlur ? "low" : "high";
      let restSharpDpr = adaptiveBudget.restSharpDpr;
      let motionFastDpr = adaptiveBudget.motionFastDpr;
      let currentAppliedDpr = restSharpDpr;
      let governorDowngradeLevel = 0;
      const onRenderQualityChange = (ev: Event) => {
        const qTier = (ev as CustomEvent<"performance" | "hd" | "ultra">).detail || "ultra";
        const nativeDpr = window.devicePixelRatio || 1;
        if (qTier === "performance") {
          restSharpDpr = 1;
          motionFastDpr = 0.85;
          applyMaxAnisotropyToCachedTextures(2);
        } else if (qTier === "hd") {
          restSharpDpr = adaptiveBudget.isTouchMobile
            ? Math.min(nativeDpr, 1.25)
            : Math.min(nativeDpr, 1.5);
          motionFastDpr = adaptiveBudget.isTouchMobile ? 1 : Math.min(nativeDpr, 1.15);
          applyMaxAnisotropyToCachedTextures(Math.min(8, adaptiveBudget.maxAnisotropyCap));
        } else {
          restSharpDpr = adaptiveBudget.isTouchMobile
            ? adaptiveBudget.restSharpDpr
            : Math.min(nativeDpr, 2.0);
          motionFastDpr = adaptiveBudget.isTouchMobile
            ? adaptiveBudget.motionFastDpr
            : Math.min(nativeDpr, 1.35);
          if (renderer.capabilities?.getMaxAnisotropy) {
            applyMaxAnisotropyToCachedTextures(
              Math.min(renderer.capabilities.getMaxAnisotropy(), adaptiveBudget.maxAnisotropyCap)
            );
          }
        }
        renderer.setPixelRatio(restSharpDpr);
        currentAppliedDpr = restSharpDpr;
        // Clear module render signatures so upgraded procedural PBR maps rebind immediately!
        if (meshGroupRef.current) {
          meshGroupRef.current.children.forEach((ch) => {
            if (ch.userData) ch.userData.renderSig = "";
          });
        }
        renderer.shadowMap.needsUpdate = true;
        needsRenderRef.current = true;
      };
      window.addEventListener("birim:set-render-quality", onRenderQualityChange);
      const onPbrTextureReady = () => {
        needsRenderRef.current = true;
      };
      window.addEventListener("birim:pbr-texture-ready", onPbrTextureReady);
      let settleSharpTimer: ReturnType<typeof setTimeout> | null = null;
      const setAdaptiveDpr = (dprVal: number) => {
        if (Math.abs(currentAppliedDpr - dprVal) < 0.02) return;
        currentAppliedDpr = dprVal;
        renderer.setPixelRatio(dprVal);
        needsRenderRef.current = true;
      };
      renderer.setSize(width, height);
      renderer.setPixelRatio(restSharpDpr);
      renderer.shadowMap.enabled = !isLegacyGpu;
      renderer.shadowMap.autoUpdate = false;
      renderer.shadowMap.needsUpdate = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      const agxToneMapping = (THREE as unknown as { AgXToneMapping?: THREE.ToneMapping }).AgXToneMapping;
      renderer.toneMapping = agxToneMapping ?? THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.94;
      if (!isLegacyGpu && renderer.capabilities?.getMaxAnisotropy) {
        applyMaxAnisotropyToCachedTextures(
          Math.min(renderer.capabilities.getMaxAnisotropy(), adaptiveBudget.maxAnisotropyCap)
        );
      }
      rendererRef.current = renderer;
      container.appendChild(renderer.domElement);
      canvasRectRef.current = renderer.domElement.getBoundingClientRect();

      const activeCam = isOrthographic ? orthoCamera : perspCamera;
      const controls = new OrbitControls(activeCam, renderer.domElement);
      controls.mouseButtons = {
        LEFT: THREE.MOUSE.PAN,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.ROTATE,
      };
      controls.touches = {
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN,
      };
      controls.rotateSpeed = invertCameraMouse ? -0.85 : 0.85;
      controls.screenSpacePanning = true;
      controls.enableDamping = true;
      controls.dampingFactor = 0.09;
      controls.maxDistance = 14000;
      controls.minDistance = 250;
      controls.minPolarAngle = 0.03;
      // Allow orbiting well below target elevation (up to ~65° upward pitch from floor level)
      // so users can freely lower the camera to countertop, plinth, or under-wall-cabinet eye level!
      controls.maxPolarAngle = Math.PI * 0.86;
      controls.target.set(850, 1080, 300);
      controls.addEventListener("start", () => {
        cameraFlightRef.current = null;
        isOrbitingRef.current = true;
        document.body.dataset.birimOrbiting = "true";
        if (settleSharpTimer) {
          clearTimeout(settleSharpTimer);
          settleSharpTimer = null;
        }
        setAdaptiveDpr(motionFastDpr);
      });
      controls.addEventListener("end", () => {
        isOrbitingRef.current = false;
        delete document.body.dataset.birimOrbiting;
        touchLongPress.cancel();
        activeTouchPointerIds.clear();
        if (settleSharpTimer) clearTimeout(settleSharpTimer);
        settleSharpTimer = setTimeout(() => {
          settleSharpTimer = null;
          setAdaptiveDpr(restSharpDpr);
          if (renderer.shadowMap.enabled) {
            renderer.shadowMap.needsUpdate = true;
          }
          needsRenderRef.current = true;
        }, 140);
      });
      controls.addEventListener("change", () => {
        if (controls.target.y < 0) {
          controls.target.y = 0;
        }
        // Keep camera lens gracefully above the studio floor slab (+35 mm) without blocking low-angle upward orbit
        if (controls.object.position.y < 35) {
          controls.object.position.y = 35;
        }
        needsRenderRef.current = true;
      });
      controlsRef.current = controls;

      // Initialize studio environment once at mount so mid-session envMap switching never triggers D3D11 shader recompilation stalls.
      if (isLegacyGpu) {
        scene.environment = getStudioEnvironmentTexture();
      } else {
        scene.environment = getStudioPmremEnvironment(renderer);
      }
      (scene as unknown as { environmentIntensity?: number }).environmentIntensity = 0.42;

      const detachContextRecovery = attachWebGLContextRecovery(renderer.domElement, {
        onContextLost: () => {
          setWebglContextLost(true);
        },
        onContextRestored: () => {
          setWebglContextLost(false);
          scene.environment = getStudioPmremEnvironment(renderer);
          renderer.shadowMap.needsUpdate = true;
          needsRenderRef.current = true;
        },
      });

      const hemiLight = new THREE.HemisphereLight(0xcbe0ff, 0x1b1815, 0.16);
      scene.add(hemiLight);
      hemiLightRef.current = hemiLight;

      // Dramatic Chiaroscuro 3/4 Key Light (warm sunlit architectural beam casting deep crisp 4K soft shadows)
      const hiResShadowSize = adaptiveBudget.shadowMapSize;
      const keyLight = new THREE.DirectionalLight(0xfff0da, 1.98);
      keyLight.position.set(-2750, 3450, 2700);
      keyLight.target.position.set(1600, 900, 700);
      scene.add(keyLight.target);
      keyLight.castShadow = !isLegacyGpu;
      keyLight.shadow.mapSize.width = hiResShadowSize;
      keyLight.shadow.mapSize.height = hiResShadowSize;
      keyLight.shadow.camera.left = -4200;
      keyLight.shadow.camera.right = 4800;
      keyLight.shadow.camera.top = 3600;
      keyLight.shadow.camera.bottom = -1200;
      keyLight.shadow.camera.near = 250;
      keyLight.shadow.camera.far = 13500;
      keyLight.shadow.bias = -0.00010;
      keyLight.shadow.normalBias = 0.25;
      keyLight.shadow.radius = 2.4;
      scene.add(keyLight);
      keyLightRef.current = keyLight;

      // Sculpted Cool Arctic Rim Light (separates dark cabinet edges & metallic handles against deep space!)
      const rimLight = new THREE.DirectionalLight(0x93c5fd, 0.76);
      rimLight.position.set(3650, 2550, -950);
      scene.add(rimLight);
      rimLightRef.current = rimLight;

      // Whisper-soft front detail fill & gallery spot: skipped on tier0/tier1 integrated GPUs (~30% fragment shader savings)
      if (!adaptiveBudget.useLowSpecLighting) {
        const frontFillLight = new THREE.DirectionalLight(0xf8fafc, 0.09);
        frontFillLight.position.set(1500, 1450, 3900);
        scene.add(frontFillLight);

        const floorBounceLight = new THREE.DirectionalLight(0xd8c3a5, 0.05);
        floorBounceLight.position.set(950, -1400, 2100);
        scene.add(floorBounceLight);

        // Architectural Ceiling Gallery SpotLight (mm-calibrated decay=0.15 so wall-washer light pool & dramatic falloff are clearly visible!)
        const gallerySpot = new THREE.SpotLight(0xffe6c2, 3.6, 8500, Math.PI / 3.4, 0.72, 0.15);
        gallerySpot.position.set(1600, 3250, 1950);
        gallerySpot.target.position.set(1450, 950, 180);
        scene.add(gallerySpot.target);
        scene.add(gallerySpot);
        gallerySpotLightRef.current = gallerySpot;
      } else {
        gallerySpotLightRef.current = null;
      }

      // Refined architectural floor grid with non-distracting gallery opacity
      const gridColor1 = theme === "dark" ? 0x334155 : 0xa39c90;
      const gridColor2 = theme === "dark" ? 0x1e293b : 0xcbc5ba;
      const grid = new THREE.GridHelper(8000, 80, gridColor1, gridColor2);
      if (Array.isArray(grid.material)) {
        grid.material.forEach((gm) => {
          gm.transparent = true;
          gm.opacity = theme === "dark" ? 0.38 : 0.32;
        });
      } else {
        grid.material.transparent = true;
        grid.material.opacity = theme === "dark" ? 0.38 : 0.32;
      }
      grid.position.y = -2;
      grid.visible = showGrid;
      scene.add(grid);
      gridRef.current = grid;

      const shadowPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(8000, 8000),
        new THREE.ShadowMaterial({ opacity: theme === "dark" ? 0.32 : 0.22 })
      );
      shadowPlane.rotation.x = -Math.PI / 2;
      shadowPlane.position.y = -1;
      shadowPlane.receiveShadow = true;
      scene.add(shadowPlane);
      shadowPlaneRef.current = shadowPlane;

      const roomArchGroup = new THREE.Group();
      scene.add(roomArchGroup);
      roomArchGroupRef.current = roomArchGroup;

      const sceneObjsGroup = new THREE.Group();
      sceneObjsGroup.name = "v5_scene_objects_3d";
      scene.add(sceneObjsGroup);
      sceneObjectsGroupRef.current = sceneObjsGroup;

      const meshGroup = new THREE.Group();
      scene.add(meshGroup);
      meshGroupRef.current = meshGroup;

      const dimGroup = new THREE.Group();
      scene.add(dimGroup);
      dimGroupRef.current = dimGroup;

      const ghostSnapGroup = new THREE.Group();
      ghostSnapGroup.name = "v3_ghost_silhouette_and_snaps";
      scene.add(ghostSnapGroup);
      ghostSnapGroupRef.current = ghostSnapGroup;

      const selFrameGroup = new THREE.Group();
      selFrameGroup.name = "v3_selected_part_frame";
      scene.add(selFrameGroup);
      selectionFrameGroupRef.current = selFrameGroup;

      const activeModFrameGroup = new THREE.Group();
      activeModFrameGroup.name = "v3_active_module_frame";
      scene.add(activeModFrameGroup);
      activeModFrameGroupRef.current = activeModFrameGroup;

      const interiorPropsGroup = new THREE.Group();
      interiorPropsGroup.name = "v11_interior_props_3d";
      interiorPropsGroup.raycast = () => {};
      scene.add(interiorPropsGroup);
      interiorPropsGroupRef.current = interiorPropsGroup;

      const engBeaconGroup = new THREE.Group();
      engBeaconGroup.name = "v11_engineering_beacons_3d";
      scene.add(engBeaconGroup);
      engineeringBeaconGroupRef.current = engBeaconGroup;



      // Direct model raycast selection + 3D Front/Perspective Interior Component Dragging with Cross-Module Snapping
      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      let downPos = { x: 0, y: 0 };
      let activeDrag3D: {
        modIdx: number;
        bayIdx: number;
        kind:
          | "shelf"
          | "drawer"
          | "rail"
          | "special_fitting"
          | "divider"
          | "sub_divider"
          | "module_3d"
          | "obstacle_3d"
          | "scene_object_3d"
          | "resize_3d";
        targetId: string;
        startValueMm: number;
        startSecondValueMm?: number;
        startThirdValueMm?: number;
        isSideWallObs?: boolean;
        dragPlane?: THREE.Plane;
        startPlaneHit?: THREE.Vector3;
        itemHeightMm?: number;
        cachedSnapTargets?: ReturnType<typeof computeElevationSnapTargets>;
        liveSnappedY?: number;
        liveDestModIdx?: number;
        liveDestBayIdx?: number;
        liveSubDivider?: { offsetX: number; elevationY: number; height: number; targetMidY: number; targetBayIndex?: number };
        liveGpuX?: number;
        liveGpuY?: number;
        liveGpuZ?: number;
        liveTargetWallId?: string;
        liveTargetRotY?: number;
        startClientX: number;
        startClientY: number;
        mmPerPx: number;
        hasMoved: boolean;
      } | null = null;

      let rightDownPos: { x: number; y: number } | null = null;
      const activeTouchPointerIds = new Set<number>();
      const touchLongPress = createLongPressController((cx, cy) => {
        const el = rendererRef.current?.domElement;
        if (!el || activeDrag3D) return;
        el.dispatchEvent(
          new MouseEvent("contextmenu", {
            clientX: cx,
            clientY: cy,
            bubbles: true,
            cancelable: true,
          })
        );
      });

      const handlePointerDown = (e: PointerEvent) => {
        if (e.pointerType === "touch") {
          activeTouchPointerIds.add(e.pointerId);
          if (activeTouchPointerIds.size > 1 || !e.isPrimary) {
            touchLongPress.cancel();
            if (activeDrag3D) {
              activeDrag3D = null;
              latestStateRef.current.commitHistoryTransaction();
            }
            if (controlsRef.current) {
              controlsRef.current.enabled = true;
            }
            return;
          }
          touchLongPress.start(e);
        }
        if (e.button === 2) {
          rightDownPos = { x: e.clientX, y: e.clientY };
          return;
        }
        if (e.button !== 0) return;
        downPos = { x: e.clientX, y: e.clientY };
        const curRenderer = rendererRef.current;
        const curGroup = meshGroupRef.current;
        const curRoomGroup = roomArchGroupRef.current;
        const curControls = controlsRef.current;
        if (!curRenderer || !curGroup || !curControls) return;

        const rect =
          canvasRectRef.current && canvasRectRef.current.width > 0
            ? canvasRectRef.current
            : curRenderer.domElement.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        const curCam = (curControls.object as THREE.Camera) || perspCamRef.current;
        if (!curCam) return;

        raycaster.setFromCamera(pointer, curCam);
        const state = latestStateRef.current;

        // 0. Check 3D Red/Amber Engineering Error Beacons FIRST (since they render on top with depthTest=false!)
        if (engineeringBeaconGroupRef.current && engineeringBeaconGroupRef.current.children.length > 0) {
          const bHits = raycaster.intersectObjects(engineeringBeaconGroupRef.current.children, false);
          const hitBeacon = bHits.find((bh) => bh.object?.userData?.isEngineeringBeacon);
          if (hitBeacon) {
            const ud = hitBeacon.object.userData;
            setSelectedBeaconFinding({
              code: String(ud.findingCode || "UYARI"),
              severity: String(ud.findingSeverity || "error"),
              title: String(ud.findingTitle || "Mühendislik Uyarısı"),
              message: String(ud.findingMessage || ""),
              suggestions: Array.isArray(ud.findingSuggestions) ? ud.findingSuggestions : [],
              remediationProposals: Array.isArray(ud.remediationProposals) ? ud.remediationProposals : [],
              moduleIndex: typeof ud.moduleIndex === "number" && ud.moduleIndex >= 0 ? ud.moduleIndex : state.activeModuleIndex,
              bayIndex: typeof ud.bayIndex === "number" && ud.bayIndex >= 0 ? ud.bayIndex : 0,
            });
            e.stopImmediatePropagation();
            return;
          }
        }

        // V96: 0b. Check SketchUp-style 3D Live Resize Handles (◀ Left, ▶ Right, ▲ Top) on active cabinet!
        if (
          paintTool3DRef.current.mode === "none" &&
          !e.altKey &&
          activeModFrameGroupRef.current &&
          activeModFrameGroupRef.current.children.length > 0
        ) {
          const rHits = raycaster.intersectObjects(activeModFrameGroupRef.current.children, true);
          const hitResize = rHits.find((rh) => rh.object?.userData?.isResizeHandle3D);
          if (hitResize) {
            const rAxis = String(hitResize.object.userData.resizeAxis || "width_right");
            const rModIdx =
              typeof hitResize.object.userData.modIdx === "number"
                ? hitResize.object.userData.modIdx
                : state.activeModuleIndex;
            const rMod = state.project.modules[rModIdx];
            if (rMod && !rMod.isFixedWidth) {
              curControls.enabled = false;
              const camDir = new THREE.Vector3();
              curCam.getWorldDirection(camDir);
              const dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
                camDir.clone().negate(),
                hitResize.point
              );
              state.beginHistoryTransaction();
              activeDrag3D = {
                modIdx: rModIdx,
                bayIdx: activeBayIndex,
                kind: "resize_3d",
                targetId: rAxis,
                startValueMm: rAxis === "height_top" ? rMod.dimensions.height : rAxis === "depth_front" ? rMod.dimensions.depth : rMod.dimensions.width,
                startSecondValueMm: rMod.position.x,
                startThirdValueMm: rMod.position.z,
                dragPlane,
                startPlaneHit: hitResize.point.clone(),
                startClientX: e.clientX,
                startClientY: e.clientY,
                mmPerPx: 4,
                hasMoved: false,
              };
              e.stopImmediatePropagation();
              return;
            }
          }
        }

        // When 3D Paint Brush or Eyedropper is active, left-click NEVER drags shelves, scene objects, or cabinets —
        // it cleanly passes straight to handlePointerUp to paint or sample the clicked 3D surface!
        if (curControls) {
          curControls.enabled = true;
          curControls.enablePan = true;
          curControls.mouseButtons.LEFT = THREE.MOUSE.PAN;
        }
        if (paintTool3DRef.current.mode !== "none" || e.altKey) {
          curControls.enabled = false;
          return;
        }
        const isMoveGesture = Boolean(state.moveObjectMode3D || e.shiftKey || e.ctrlKey || e.metaKey);
        const anyDoorsOpen =
          state.doorsHiddenIn3D ||
          state.doorOpenAngleDeg > 5 ||
          state.project.modules.some(
            (m) =>
              Boolean(m.isOpenFront) ||
              m.bays.some((b) => b.door.type === "open" || b.door.doorSystemId === "open")
          );

        // ULTRA-FAST ORBIT PATH: When doors are closed, not in Move Mode, and no unlocked 3D scene objects exist,
        // let OrbitControls handle left-drag camera rotation immediately in 0.0ms without mesh raycasting or state updates!
        const hasUnlockedSceneObjects = (state.project.sceneObjects || []).some((o) => !o.isHidden && !o.isLocked);
        if (!isMoveGesture && !anyDoorsOpen && !hasUnlockedSceneObjects && !e.ctrlKey && !e.metaKey && !e.altKey) {
          curControls.enabled = true;
          return;
        }

        // 1. Raycast solid cabinet meshes FIRST so upper & base cabinets always take priority over wall obstacles behind them!
        const solidMeshes = getCachedSolidMeshes(curGroup, anyDoorsOpen);
        const hits = raycaster.intersectObjects(solidMeshes, false);
        const closestCabinetDist = hits.length > 0 ? hits[0].distance : Infinity;

        // 1b. Check V5 3D SceneObjects (Appliances, Sinks, Freestanding Birim Furniture, Custom .GLB)
        if (sceneObjectsGroupRef.current && sceneObjectsGroupRef.current.children.length > 0) {
          const sHits = raycaster.intersectObjects(sceneObjectsGroupRef.current.children, true);
          for (const sh of sHits) {
            if (sh.object instanceof THREE.Line || sh.object instanceof THREE.LineSegments) continue;
            if (sh.distance <= closestCabinetDist + 5) {
              let walker: THREE.Object3D | null = sh.object;
              while (walker && !walker.userData?.sceneObjectId) {
                walker = walker.parent;
              }
              if (walker?.userData?.sceneObjectId) {
                const sobjId = String(walker.userData.sceneObjectId);
                useConfiguratorStore.getState().setSelectedSceneObjectId(sobjId);
                const sobjInst = (state.project.sceneObjects || []).find((o) => o.id === sobjId);
                if (sobjInst && !sobjInst.isLocked) {
                  const hitDist = Math.max(300, sh.distance);
                  const fovRad =
                    curCam instanceof THREE.PerspectiveCamera
                      ? (curCam.fov * Math.PI) / 180
                      : 0.7;
                  const visibleHeightMm =
                    curCam instanceof THREE.PerspectiveCamera
                      ? 2 * hitDist * Math.tan(fovRad / 2)
                      : 2200;
                  const mmPerPx = visibleHeightMm / Math.max(200, rect.height);
                  const floorPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
                    new THREE.Vector3(0, 1, 0),
                    sh.point
                  );
                  state.beginHistoryTransaction();
                  document.body.dataset.birimUiDragging = "1";
                  activeDrag3D = {
                    modIdx: state.activeModuleIndex,
                    bayIdx: 0,
                    kind: "scene_object_3d",
                    targetId: sobjId,
                    startValueMm: sobjInst.position.x,
                    startSecondValueMm: sobjInst.position.y,
                    startThirdValueMm: sobjInst.position.z,
                    dragPlane: floorPlane,
                    startPlaneHit: sh.point.clone(),
                    startClientX: e.clientX,
                    startClientY: e.clientY,
                    mmPerPx,
                    hasMoved: false,
                  };
                  curControls.enabled = false;
                  curRenderer.domElement.style.cursor = "grabbing";
                  e.stopImmediatePropagation();
                }
                return;
              }
            }
          }
        }

        // 2. Only grab an Architectural Obstacle (Window, Door, Plumbing, Column) if NO cabinet is in front of it!
        if (curRoomGroup && (state.moveObjectMode3D || e.shiftKey || e.ctrlKey || e.metaKey)) {
          const roomHits = raycaster.intersectObjects(curRoomGroup.children, true);
          for (const rh of roomHits) {
            if (rh.object instanceof THREE.Line || rh.object instanceof THREE.LineSegments) continue;
            if (rh.distance >= closestCabinetDist - 2) break;
            let rCand: THREE.Object3D | null = rh.object;
            while (rCand && !rCand.userData?.obstacleId) {
              rCand = rCand.parent;
            }
            if (rCand?.userData?.obstacleId) {
              const obsId = String(rCand.userData.obstacleId);
              const obsObj = (state.spaceObstacles || []).find((o) => o.id === obsId);
              if (obsObj) {
                const hitDist = Math.max(300, rh.distance);
                const fovRad =
                  curCam instanceof THREE.PerspectiveCamera
                    ? (curCam.fov * Math.PI) / 180
                    : 0.7;
                const visibleHeightMm =
                  curCam instanceof THREE.PerspectiveCamera
                    ? 2 * hitDist * Math.tan(fovRad / 2)
                    : 2200;
                const mmPerPx = visibleHeightMm / Math.max(200, rect.height);
                const obsRot = (((obsObj.rotationY || 0) % 360) + 360) % 360;
                const isSideObs = obsRot === 90 || obsRot === 270;
                const planeNormal = isSideObs
                  ? new THREE.Vector3(1, 0, 0)
                  : new THREE.Vector3(0, 0, 1);
                const dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
                  planeNormal,
                  rh.point
                );
                const startPlaneHit = rh.point.clone();
                state.beginHistoryTransaction();
                document.body.dataset.birimUiDragging = "1";
                activeDrag3D = {
                  modIdx: state.activeModuleIndex,
                  bayIdx: 0,
                  kind: "obstacle_3d",
                  targetId: obsId,
                  startValueMm: obsObj.position.x,
                  startSecondValueMm: obsObj.position.y,
                  startThirdValueMm: obsObj.position.z,
                  isSideWallObs: isSideObs,
                  dragPlane,
                  startPlaneHit,
                  startClientX: e.clientX,
                  startClientY: e.clientY,
                  mmPerPx,
                  hasMoved: false,
                };
                curControls.enabled = false;
                e.stopImmediatePropagation();
                return;
              }
            }
          }
        }
        if (hits.length === 0) return;

        let hitObj: THREE.Object3D | null = null;
        let dragMeta: ReturnType<typeof findDraggableInteriorComponent> = null;
        let modIdx = state.activeModuleIndex;
        let mod = state.project.modules[modIdx];

        for (const h of hits) {
          const cand = h.object;
          if (!cand?.userData?.componentId) continue;
          const cModIdx =
            typeof cand.userData.moduleIndex === "number"
              ? cand.userData.moduleIndex
              : state.activeModuleIndex;
          const cMod = state.project.modules[cModIdx];
          if (!cMod) continue;

          // First hit is guaranteed to be the closest solid 3D mesh under the cursor!
          if (!hitObj) {
            hitObj = cand;
            modIdx = cModIdx;
            mod = cMod;
          }

          // Do not look behind the first hit module into a DIFFERENT module!
          if (cModIdx !== modIdx) {
            break;
          }

          const isExternalDrawerFront = String(cand.userData.role) === "drawer_front";
          const doorsAreOpen =
            state.doorsHiddenIn3D ||
            state.doorOpenAngleDeg > 5 ||
            Boolean(cMod.isOpenFront) ||
            cMod.bays.some(
              (b) =>
                b.door.type === "open" ||
                b.door.doorSystemId === "open" ||
                Boolean(b.door.isGlassFramed) ||
                b.door.crossSectionProfile === "glass_frame" ||
                b.door.crossSectionProfile === "full_smoked_glass" ||
                b.door.crossSectionProfile === "center_glass_frame" ||
                b.door.crossSectionProfile === "u_glass_open_top"
            );

          const wantInteriorDrag = !state.moveObjectMode3D
            ? !(e.shiftKey || e.ctrlKey || e.metaKey)
            : false;
          if (wantInteriorDrag && (doorsAreOpen || (isExternalDrawerFront && e.altKey))) {
            const fs = calculateFourSpaceDimensions(cMod);
            const dm = findDraggableInteriorComponent(
              cMod,
              String(cand.userData.componentId),
              fs.usableInternal.bayClearWidthsMm
            );
            if (dm) {
              hitObj = cand;
              modIdx = cModIdx;
              mod = cMod;
              dragMeta = dm;
              // If we hit a shelf first, peek 40mm deeper along the same ray in case the user clicked right on a Raf Arası Dikme joint!
              if (dm.kind !== "sub_divider") {
                for (const hSub of hits) {
                  if (hSub.distance > h.distance + 45) break;
                  const subCid = String(hSub.object?.userData?.componentId || "");
                  if (!subCid) continue;
                  const subDm = findDraggableInteriorComponent(
                    cMod,
                    subCid,
                    fs.usableInternal.bayClearWidthsMm
                  );
                  if (subDm && subDm.kind === "sub_divider") {
                    hitObj = hSub.object;
                    dragMeta = subDm;
                    break;
                  }
                }
              }
              break;
            }
          }
          if (!doorsAreOpen && String(cand.userData.role || "").startsWith("door")) {
            break;
          }
        }
        if (!hitObj?.userData?.componentId || !mod) return;

        // Defer selection state updates to handlePointerUp (on non-drag click) unless an actual 3D drag starts below,
        // so pressing left-mouse to rotate the 3D scene causes ZERO synchronous React/Zustand re-renders!
        const clickedCompId =
          String(hitObj.userData.role) === "door_handle" && hitObj.userData.parentComponentId
            ? String(hitObj.userData.parentComponentId)
            : String(hitObj.userData.componentId);

        // Calculate world-mm per screen-pixel at the hit point
        const hitDist = Math.max(300, hits[0].distance);
        let visibleHeightMm = 2200;
        if (curCam instanceof THREE.PerspectiveCamera) {
          const fovRad = (curCam.fov * Math.PI) / 180;
          visibleHeightMm = 2 * hitDist * Math.tan(fovRad / 2);
        } else if (curCam instanceof THREE.OrthographicCamera) {
          visibleHeightMm = (curCam.top - curCam.bottom) / Math.max(0.01, curCam.zoom);
        }
        const mmPerPx = visibleHeightMm / Math.max(200, rect.height);

        // If user is in 3D Move Mode (or holding Ctrl / Shift), grab and move the WHOLE MODULE along the wall!
        if ((state.moveObjectMode3D || e.shiftKey || e.ctrlKey || e.metaKey) && !dragMeta) {
          state.setActiveModuleIndex(modIdx);
          (state.setSelectedComponentId as (id: string | null, mIdx?: number) => void)(
            clickedCompId,
            modIdx
          );
          state.beginHistoryTransaction();
          document.body.dataset.birimUiDragging = "1";
          const modDragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
            new THREE.Vector3(0, 1, 0),
            hits[0].point
          );
          activeDrag3D = {
            modIdx,
            bayIdx: 0,
            kind: "module_3d",
            targetId: mod.id,
            startValueMm: mod.position.x,
            startSecondValueMm: mod.position.z,
            dragPlane: modDragPlane,
            startPlaneHit: hits[0].point.clone(),
            startClientX: e.clientX,
            startClientY: e.clientY,
            mmPerPx,
            hasMoved: false,
          };
          curControls.enabled = false;
          curRenderer.domElement.style.cursor = "grabbing";
          e.stopImmediatePropagation();
          return;
        }

        if (!dragMeta) {
          // If no interior component is draggable, keep OrbitControls enabled so user can freely rotate camera around cabinet!
          curControls.enabled = true;
          return;
        }

        state.setActiveModuleIndex(modIdx);
        state.setActiveBayIndex(dragMeta.bayIdx);
        (state.setSelectedComponentId as (id: string | null, mIdx?: number) => void)(
          String(hitObj.userData.componentId),
          modIdx
        );
        state.beginHistoryTransaction();
        document.body.dataset.birimUiDragging = "1";
        const precomputedSnapTargets =
          dragMeta.kind === "divider" || dragMeta.kind === "sub_divider"
            ? undefined
            : computeElevationSnapTargets(
                state.project,
                modIdx,
                dragMeta.bayIdx,
                dragMeta.targetId,
                dragMeta.itemHeightMm
              );

        const camHorizNormal = new THREE.Vector3();
        curCam.getWorldDirection(camHorizNormal);
        camHorizNormal.y = 0;
        if (camHorizNormal.lengthSq() < 1e-4) {
          camHorizNormal.set(0, 0, -1);
        } else {
          camHorizNormal.normalize().negate();
        }
        const interiorDragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
          camHorizNormal,
          hits[0].point
        );

        activeDrag3D = {
          modIdx,
          bayIdx: dragMeta.bayIdx,
          kind: dragMeta.kind,
          targetId: dragMeta.targetId,
          startValueMm: dragMeta.startVal,
          startSecondValueMm: dragMeta.startElevY,
          dragPlane: interiorDragPlane,
          startPlaneHit: hits[0].point.clone(),
          itemHeightMm: dragMeta.itemHeightMm,
          cachedSnapTargets: precomputedSnapTargets,
          startClientX: e.clientX,
          startClientY: e.clientY,
          mmPerPx,
          hasMoved: false,
        };
        curControls.enabled = false;
        curRenderer.domElement.style.cursor = "grabbing";
        e.stopImmediatePropagation();
      };

      const hoverOverlayGroup = new THREE.Group();
      hoverOverlayGroup.name = "v3_hover_highlight_box";
      scene.add(hoverOverlayGroup);

      const hoverBoxGeo = new THREE.BoxGeometry(1, 1, 1);
      const hoverEdgesCache = new Map<THREE.BufferGeometry, THREE.EdgesGeometry>();
      const getHoverEdgesForGeometry = (geo: THREE.BufferGeometry): THREE.EdgesGeometry => {
        let cached = hoverEdgesCache.get(geo);
        if (!cached) {
          if (hoverEdgesCache.size >= 64) {
            const oldestKey = hoverEdgesCache.keys().next().value;
            if (oldestKey) {
              const oldestEdges = hoverEdgesCache.get(oldestKey);
              oldestEdges?.dispose();
              hoverEdgesCache.delete(oldestKey);
            }
          }
          cached = new THREE.EdgesGeometry(geo, 18);
          hoverEdgesCache.set(geo, cached);
        }
        return cached;
      };
      const hoverFillMat = new THREE.MeshBasicMaterial({
        color: 0x0ea5e9,
        transparent: true,
        opacity: 0.24,
        depthTest: false,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      });
      const hoverOutlineMat = new THREE.LineBasicMaterial({
        color: 0x0284c7,
        linewidth: 2,
        depthTest: false,
      });
      const hoverFillMesh = new THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>(
        hoverBoxGeo,
        hoverFillMat
      );
      hoverFillMesh.raycast = () => {};
      const hoverOutlineSegments = new THREE.LineSegments(
        getHoverEdgesForGeometry(hoverBoxGeo),
        hoverOutlineMat
      );
      hoverOutlineSegments.raycast = () => {};
      hoverOverlayGroup.add(hoverFillMesh);
      hoverOverlayGroup.add(hoverOutlineSegments);
      hoverOverlayGroup.visible = false;

      const { handlePointerMove, flushPendingPointerDragRaf, cancelPendingPointerDragRaf } = createViewport3DPointerMoveHandler({ getActiveDrag3D: () => activeDrag3D, activeModFrameGroupRef, activeTouchPointerIds, canvasRectRef, controlsRef, dimGroupRef, engineeringBeaconGroupRef, getCachedSolidMeshes, getHoverEdgesForGeometry, ghostSnapGroupRef, hoverBadgeDomRef, hoverBadgeTextRef, hoverFillMat, hoverFillMesh, hoverOutlineMat, hoverOutlineSegments, hoverOverlayGroup, interiorPropsGroupRef, isOrbitingRef, latestStateRef, liveDimDeltaRef, meshGroupRef, needsRenderRef, paintTool3DRef, perspCamRef, pointer, previewOriginalMatsRef, raycaster, rendererRef, restoreHoverPreviewMaterials, roomArchGroupRef, sceneObjectsGroupRef, selectionFrameGroupRef, setActive3DSnap, setSnapBannerDedup, touchLongPress });
      const { handlePointerUp, handleContextMenu } = createViewport3DPointerUpAndContextMenu({ flushPendingPointerDragRaf, getActiveDrag3D: () => activeDrag3D, setActiveDrag3D: (v: typeof activeDrag3D) => { activeDrag3D = v; }, getDownPos: () => downPos, setDownPos: (v: typeof downPos) => { downPos = v; }, getRightDownPos: () => rightDownPos, setRightDownPos: (v: typeof rightDownPos) => { rightDownPos = v; }, activeModFrameGroupRef, activeTouchPointerIds, canvasRectRef, controlsRef, dimGroupRef, getCachedSolidMeshes, ghostSnapGroupRef, interiorPropsGroupRef, latestStateRef, liveDimDeltaRef, meshGroupRef, minimalChromeRef, needsRenderRef, paintTool3DRef, perspCamRef, pointer, raycaster, rendererRef, restoreHoverPreviewMaterials, roomArchGroupRef, selectionFrameGroupRef, setActive3DSnap, setActiveBrushMaterialId, setClicked3DContext, setContextMenuTarget, setDoorMenuSubSection, setPaintTool3D, setSnapBannerDedup, setWallFocusHighlight, touchLongPress });
      const handlePointerCancelOrBlur = () => {
        cancelPendingPointerDragRaf();
        delete document.body.dataset.birimUiDragging;
        if (activeDrag3D) {
          activeDrag3D = null;
          latestStateRef.current.commitHistoryTransaction();
        }
        activeTouchPointerIds.clear();
        touchLongPress.cancel();
        if (controlsRef.current) {
          controlsRef.current.enabled = true;
        }
      };

      renderer.domElement.addEventListener("pointerdown", handlePointerDown, { capture: true });
      renderer.domElement.addEventListener("contextmenu", handleContextMenu, { capture: true });
      window.addEventListener("pointermove", handlePointerMove, { capture: true });
      window.addEventListener("pointerup", handlePointerUp, { capture: true });
      window.addEventListener("pointercancel", handlePointerCancelOrBlur, { capture: true });
      window.addEventListener("blur", handlePointerCancelOrBlur);

      let powerSaverActive = false;
      const applyGovernorLevel = (level: number) => {
        governorDowngradeLevel = level;
        if (level === 0 && !powerSaverActive) {
          restSharpDpr = adaptiveBudget.restSharpDpr;
          motionFastDpr = adaptiveBudget.motionFastDpr;
          setAdaptiveDpr(isOrbitingRef.current ? motionFastDpr : restSharpDpr);
          if (!isLegacyGpu && renderer.capabilities?.getMaxAnisotropy) {
            applyMaxAnisotropyToCachedTextures(
              Math.min(renderer.capabilities.getMaxAnisotropy(), adaptiveBudget.maxAnisotropyCap)
            );
          }
          document.body.dataset.birimGpuTier = adaptiveBudget.disableBackdropBlur ? "low" : "high";
          if (!isLegacyGpu && !renderer.shadowMap.enabled) {
            renderer.shadowMap.enabled = true;
            keyLight.castShadow = true;
            renderer.shadowMap.needsUpdate = true;
            needsRenderRef.current = true;
          }
        } else if (level === 1) {
          restSharpDpr = Math.min(adaptiveBudget.restSharpDpr, 1.0);
          motionFastDpr = Math.min(adaptiveBudget.motionFastDpr, 0.85);
          setAdaptiveDpr(isOrbitingRef.current ? motionFastDpr : restSharpDpr);
          applyMaxAnisotropyToCachedTextures(2);
          document.body.dataset.birimGpuTier = "low";
          if (!isLegacyGpu && !renderer.shadowMap.enabled) {
            renderer.shadowMap.enabled = true;
            keyLight.castShadow = true;
            renderer.shadowMap.needsUpdate = true;
            needsRenderRef.current = true;
          }
        } else if (level >= 2) {
          restSharpDpr = Math.min(adaptiveBudget.restSharpDpr, 1.0);
          motionFastDpr = Math.min(adaptiveBudget.motionFastDpr, 0.85);
          setAdaptiveDpr(isOrbitingRef.current ? motionFastDpr : restSharpDpr);
          applyMaxAnisotropyToCachedTextures(2);
          document.body.dataset.birimGpuTier = "low";
          if (renderer.shadowMap.enabled) {
            renderer.shadowMap.enabled = false;
            keyLight.castShadow = false;
            needsRenderRef.current = true;
          }
        }
      };

      const onSlowFrameWindow = (avgRenderMs: number) => {
        if (governorDowngradeLevel === 0) {
          applyGovernorLevel(1);
        } else if (governorDowngradeLevel === 1 && avgRenderMs > 46) {
          applyGovernorLevel(2);
        }
      };

      const onFastFrameWindow = () => {
        if (powerSaverActive) return;
        if (governorDowngradeLevel > 0) {
          applyGovernorLevel(governorDowngradeLevel - 1);
        }
      };

      // JS Heap memory pressure watchdog (Chromium performance.memory) — trims PBR LRU before OOM
      const memoryWatchdogId = window.setInterval(() => {
        if (document.hidden) return;
        const perfMem = (
          performance as unknown as {
            memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number };
          }
        ).memory;
        if (perfMem && perfMem.jsHeapSizeLimit > 0) {
          const ratio = perfMem.usedJSHeapSize / perfMem.jsHeapSizeLimit;
          if (ratio > 0.78) {
            trimPbrCachesUnderMemoryPressure();
            if (governorDowngradeLevel < 1) {
              applyGovernorLevel(1);
            }
          }
        }
      }, 15_000);

      // Battery / power-saver & tab visibility guard
      const handleVisibilityChange = () => {
        if (!document.hidden && !pausedRef.current) {
          needsRenderRef.current = true;
        }
      };
      document.addEventListener("visibilitychange", handleVisibilityChange);

      let detachBatteryListeners: (() => void) | null = null;
      const navBattery = navigator as unknown as {
        getBattery?: () => Promise<{
          charging: boolean;
          level: number;
          addEventListener: (ev: string, fn: () => void) => void;
          removeEventListener: (ev: string, fn: () => void) => void;
        }>;
      };
      if (typeof navBattery.getBattery === "function") {
        void navBattery
          .getBattery()
          .then((bat) => {
            const syncBattery = () => {
              const lowBattery = !bat.charging && bat.level <= 0.2;
              if (lowBattery !== powerSaverActive) {
                powerSaverActive = lowBattery;
                if (lowBattery) {
                  applyGovernorLevel(Math.max(governorDowngradeLevel, 1));
                } else {
                  applyGovernorLevel(0);
                }
              }
            };
            syncBattery();
            bat.addEventListener("chargingchange", syncBattery);
            bat.addEventListener("levelchange", syncBattery);
            detachBatteryListeners = () => {
              bat.removeEventListener("chargingchange", syncBattery);
              bat.removeEventListener("levelchange", syncBattery);
            };
          })
          .catch(() => {
            // Ignore unsupported Battery API
          });
      }

      const stopStudioAnimLoop = attachViewport3DStudioRenderAndLoop({
        activeModFrameGroupRef,
        cameraFlightRef,
        container,
        controlsRef,
        dimGroupRef,
        ghostSnapGroupRef,
        gridRef,
        hoverOverlayGroup,
        interiorPropsGroupRef,
        isOrbitingRef,
        keyLightRef,
        meshGroupRef,
        needsRenderRef,
        onFastFrameWindow,
        onPerformanceSample,
        onSlowFrameWindow,
        pausedRef,
        perspCamRef,
        rendererRef,
        rimLightRef,
        roomArchGroupRef,
        sceneObjectsGroupRef,
        sceneRef,
        selectionFrameGroupRef,
        ultraPhotoLimits: {
          maxWidth: adaptiveBudget.maxUltraPhotoWidth,
          maxHeight: adaptiveBudget.maxUltraPhotoHeight,
          maxSamples: adaptiveBudget.maxUltraPhotoSamples,
        },
        updateProjectedDimensionLabels,
        wakeRenderLoopRef,
        wallPulseRef,
      });

      const resizeObserver = new ResizeObserver(() => {
        const curRenderer = rendererRef.current;
        if (!container || !curRenderer) return;
        const w = container.clientWidth;
        const h = container.clientHeight;
        if (w === 0 || h === 0) return;

        if (perspCamRef.current) {
          perspCamRef.current.aspect = w / h;
          perspCamRef.current.updateProjectionMatrix();
        }
        if (orthoCamRef.current) {
          const asp = w / h;
          const d = 1800;
          orthoCamRef.current.left = -d * asp;
          orthoCamRef.current.right = d * asp;
          orthoCamRef.current.top = d;
          orthoCamRef.current.bottom = -d;
          orthoCamRef.current.updateProjectionMatrix();
        }
        curRenderer.setSize(w, h);
        canvasRectRef.current = curRenderer.domElement.getBoundingClientRect();
        const cam = (controlsRef.current?.object as THREE.Camera) || perspCamRef.current;
        if (cam && sceneRef.current) {
          curRenderer.render(sceneRef.current, cam);
          updateProjectedDimensionLabels();
        }
        needsRenderRef.current = true;
      });
      resizeObserver.observe(container);

      return () => {
        delete document.body.dataset.birimOrbiting;
        delete document.body.dataset.birimGpuTier;
        window.clearInterval(memoryWatchdogId);
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        detachBatteryListeners?.();
        delete (window as unknown as { __birimRenderUltraStudioPhoto?: unknown }).__birimRenderUltraStudioPhoto;
        if (settleSharpTimer) clearTimeout(settleSharpTimer);
        stopStudioAnimLoop();
        resizeObserver.disconnect();
        window.removeEventListener("birim:set-render-quality", onRenderQualityChange);
        window.removeEventListener("birim:pbr-texture-ready", onPbrTextureReady);
        detachContextRecovery();
        delete (window as unknown as { __birimCapture3DSnapshot?: unknown }).__birimCapture3DSnapshot;
        renderer.domElement.removeEventListener("pointerdown", handlePointerDown, { capture: true });
        renderer.domElement.removeEventListener("contextmenu", handleContextMenu, { capture: true });
        window.removeEventListener("pointermove", handlePointerMove, { capture: true });
        window.removeEventListener("pointerup", handlePointerUp, { capture: true });
        window.removeEventListener("pointercancel", handlePointerCancelOrBlur, { capture: true });
        window.removeEventListener("blur", handlePointerCancelOrBlur);
        controls.dispose();
        hoverEdgesCache.forEach((edgeGeo) => edgeGeo.dispose());
        hoverEdgesCache.clear();
        hoverBoxGeo.dispose();
        hoverFillMat.dispose();
        multiHoleMeshCacheRef.current.forEach((inst) => inst.dispose());
        multiHoleMeshCacheRef.current.clear();
        disposeObject3DTree(scene);
        scene.clear();
        disposeRendererPmremEnvironment(renderer);
        disposeWebGLRendererCleanly(renderer);
        if (container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [webglRetryKey]);

    const { updateSelectionAndActiveFrames } = useViewport3DCameraSectionAndFrames({ activeBayIndex, activeBayWorldAnchorRef, activeDoorWorldAnchorRef, activeModFrameGroupRef, activeModuleIndex, cameraPreset, controlsRef, cutawayActiveBay, doorOpenAngleDeg, doorsHiddenIn3D, floorStyle, gallerySpotLightRef, gridRef, hemiLightRef, isOrthographic, isXrayActive, keyLightRef, latestStateRef, lightingPreset, markShadowsAndRender, meshGroupRef, orthoCamRef, perspCamRef, project, renderEdgeMode, rendererRef, requestRender, rimLightRef, roomArchGroupRef, sceneRef, section3DAxis, section3DRatio, sectionCapGroupRef, selectedComponentId, selectionFrameGroupRef, showGrid, showRoomArchitecture3D, theme, wallTone });

    const updateSelectionFramesRef = useRef(updateSelectionAndActiveFrames);
    updateSelectionFramesRef.current = updateSelectionAndActiveFrames;

    // Rebuild Parametric Meshes ONLY when project geometry or kinematic sliders change
    useEffect(() => {
      if (paused) return;
      const meshGroup = meshGroupRef.current;
      if (!meshGroup) return;

      // Always clear any transient hover preview before evaluating committed project materials
      if (syncParametricCabinetMeshes3D({ activeBayIndex, activeModuleIndex, cutawayActiveBay, doorOpenAngleDeg, doorsHiddenIn3D, drawerOpenMm, effectiveDoorsHiddenIn3D, engineeringBeaconGroupRef, explodedFactor, isStoreBatchDragging, isXrayActive, lightingPreset, live3DEngineeringReport, markShadowsAndRender, meshGroup, multiHoleMeshCacheRef, project, renderEdgeMode, rendererRef, requestRender, restoreHoverPreviewMaterials, section3DAxis, selectedComponentId, solidMeshesCacheRef, spaceObstacles, storeBom, theme, updateSelectionFramesRef })) {
        updateSelectionFramesRef.current();
        markShadowsAndRender();
      }
    }, [
      project,
      doorOpenAngleDeg,
      drawerOpenMm,
      toggleDoorOpen,
      setDrawerOpenMm,
      explodedFactor,
      cutawayActiveBay ? activeModuleIndex : -1,
      cutawayActiveBay ? activeBayIndex : -1,
      doorsHiddenIn3D,
      section3DAxis,
      effectiveDoorsHiddenIn3D,
      cutawayActiveBay,
      theme,
      renderEdgeMode,
      isXrayActive,
      isStoreBatchDragging,
      paused,
      isXrayActive ? storeBom : null,
      requestRender,
      GEOMETRY_ENGINE_REV,
    ]);

    // Dedicated O(1) Interior Wardrobe Styling Props Layer (`Eşyalar`) — Decoupled from Cabinet Mesh Rebuilds!
    useEffect(() => {
      if (paused) return;
      const propsRoot = interiorPropsGroupRef.current;
      if (!propsRoot) return;

      syncInteriorWardrobeProps3D({ activeModuleIndex, cutawayActiveBay, doorOpenAngleDeg, effectiveDoorsHiddenIn3D, glbCatalogRev, isStoreBatchDragging, isXrayActive, lifestylePropsCacheRef, project, propsRoot, renderEdgeMode, requestRender, showInteriorProps3D });
    }, [
      paused,
      project.modules,
      showInteriorProps3D,
      renderEdgeMode,
      isXrayActive,
      isStoreBatchDragging,
      effectiveDoorsHiddenIn3D,
      cutawayActiveBay,
      activeModuleIndex,
      doorOpenAngleDeg > 8,
      glbCatalogRev,
      requestRender,
    ]);

    useEffect(() => {
      return subscribeSceneObjectGlbLoaded(() => {
        setGlbRefreshTick((t) => t + 1);
      });
    }, []);

    useEffect(() => {
      if (paused) return;
      const grp = sceneObjectsGroupRef.current;
      if (!grp) return;
      const visibleObjs = (project.sceneObjects || []).filter((so) => !so.isHidden);
      const nextSigMap = new Map<string, string>();
      for (const sobj of visibleObjs) {
        nextSigMap.set(
          sobj.id,
          JSON.stringify({
            id: sobj.id,
            cat: sobj.catalogId,
            vk: sobj.visualKind,
            dims: sobj.dimensions,
            sc: sobj.scaleFactor || 1,
            pri: sobj.primaryColorHex,
            sec: sobj.secondaryColorHex,
            glb: sobj.glbUrl || sobj.localAssetKey || "",
            sel: selectedSceneObjectId === sobj.id,
            tick: glbRefreshTick,
          })
        );
      }

      const existingById = new Map<string, THREE.Object3D>();
      for (const child of [...grp.children]) {
        const cid = String(child.userData?.sceneObjectId || "");
        const prevSig = child.userData?.__sobjGeomSig;
        if (cid && prevSig && nextSigMap.get(cid) === prevSig) {
          existingById.set(cid, child);
        } else {
          grp.remove(child);
          disposeObject3DTree(child);
        }
      }
      grp.clear();

      for (const sobj of visibleObjs) {
        const reused = existingById.get(sobj.id);
        if (reused) {
          reused.position.set(sobj.position.x, sobj.position.y, sobj.position.z);
          const pivot = reused.children[0];
          if (pivot) {
            pivot.rotation.y = ((sobj.rotation?.y || 0) * Math.PI) / 180;
          }
          grp.add(reused);
        } else {
          const objMesh = buildSceneObject3DGroup(sobj, {
            isSelected: selectedSceneObjectId === sobj.id,
            renderer: rendererRef.current,
          });
          objMesh.userData.__sobjGeomSig = nextSigMap.get(sobj.id);
          grp.add(objMesh);
        }
      }
      requestRender();
    }, [paused, project.sceneObjects, selectedSceneObjectId, glbRefreshTick, requestRender]);

    // Fast Selection & Active Module Highlight WITHOUT rebuilding scene geometry
    useEffect(() => {
      if (paused) return;
      updateSelectionAndActiveFrames();
    }, [paused, selectedComponentId, activeModuleIndex, theme, renderEdgeMode, updateSelectionAndActiveFrames]);

    // Zero-WebGL-Reset Non-Mutating Wireframe Toggle (< 0.5ms; NEVER mutates shared cached PBR materials!)
    const wasWireframeModeRef = useRef<boolean>(false);
    const sharedWireframeMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
    useEffect(() => {
      return () => {
        sharedWireframeMatRef.current?.dispose();
        sharedWireframeMatRef.current = null;
      };
    }, []);
    useEffect(() => {
      const grp = meshGroupRef.current;
      if (!grp) return;
      if (!isWireframeMode && !wasWireframeModeRef.current) return;
      wasWireframeModeRef.current = isWireframeMode;
      if (isWireframeMode && !sharedWireframeMatRef.current) {
        sharedWireframeMatRef.current = markSharedMaterial(
          new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            wireframe: true,
            roughness: 0.6,
            metalness: 0.1,
          })
        );
      }
      grp.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh || !mesh.material) return;
        if (mesh.userData?.role === "bay_compartment" || mesh.userData?.isSelectionHelper) return;
        if (isWireframeMode) {
          if (mesh.userData.__origSolidMaterial === undefined) {
            mesh.userData.__origSolidMaterial = mesh.material;
          }
          if (sharedWireframeMatRef.current) {
            mesh.material = sharedWireframeMatRef.current;
          }
        } else if (mesh.userData.__origSolidMaterial !== undefined) {
          mesh.material = mesh.userData.__origSolidMaterial;
          delete mesh.userData.__origSolidMaterial;
        }
      });
      requestRender();
    }, [isWireframeMode, project.modules, requestRender]);

    const { width, depth, dimBounds, commitBadgeEdit, clear3DGhostPreview, handle3DDragOver, handle3DDrop } = useViewport3DRoomXrayAndDropEffects({ activeBayIndex, activeModule, activeModuleIndex, activeWallId, addInteriorItemAtElevation, addSceneObjectFromCatalog, badgeDraftValue, controlsRef, dimGroupRef, dimWorldAnchorsRef, displayUnit, doorOpenAngleDeg, dropV4TemplateWithSnap, editingBadge, effectiveShowDimensions, floorStyle, getCachedSolidMeshes, ghostSnapGroupRef, hardwareViewMode, hasActiveCabinetSelection, hwCallouts, hwWorldAnchorsRef, isDraggingItemOver3D, isSimpleTier, lastAccessoryDropTargetRef, lastGhostKeyRef, latestStateRef, lightingPreset, liveDimDeltaRef, markShadowsAndRender, matCallouts, matWorldAnchorsRef, materialModeActive, meshGroupRef, paused, pausedRef, perspCamRef, project, renderEdgeMode, rendererRef, requestRender, roomArchGroupRef, sceneObjectsGroupRef, setDimensions, setDoorOpenAngleDeg, setEditingBadge, setIsDraggingItemOver3D, setPlinthHeight, setSnapBannerDedup, shadowPlaneRef, showInCanvasHud, showRoomArchitecture3D, spaceObstacles, spaceWalls, theme, updateProjectedDimensionLabels, v4ModuleTemplates, wallFocusHighlight, wallTone });

    if (!activeModule) return null;

    return (
      <div
        data-testid="v3-three-viewport-dropzone"
        onDragOver={handle3DDragOver}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            clear3DGhostPreview();
            setSnapBannerDedup(null);
          }
        }}
        onDrop={handle3DDrop}
        className="relative w-full h-full select-none overflow-hidden"
      >
        {webglUnavailable && (
          <div className="absolute inset-0 z-40">
            <Software3DFallbackViewport
              project={project}
              activeModuleIndex={activeModuleIndex}
              selectedComponentId={selectedComponentId}
              selectedSceneObjectId={selectedSceneObjectId}
              doorOpenAngleDeg={doorOpenAngleDeg}
              drawerOpenMm={drawerOpenMm}
              explodedFactor={explodedFactor}
              gpuRendererInfo={webglCapability?.gpuRendererInfo}
              failureReason={webglCapability?.failureReason}
              onSelectModule={(idx) => setActiveModuleIndex(idx)}
              onSelectComponent={(cid) => setSelectedComponentId(cid)}
              onSelectSceneObject={(oid) => setSelectedSceneObjectId(oid)}
              onToggleDoorOpen={() => setDoorOpenAngleDeg(doorOpenAngleDeg > 5 ? 0 : 75)}
              onRetryWebGL={() => setWebglRetryKey((k) => k + 1)}
              onSwitchTo2DCad={onRequest2DElevation}
            />
          </div>
        )}
        {/* Alt-Orta HUD Yığını: Hover Bilgisi, Yerleştirme Bildirimi ve Seçili Obje Çubuğu asla üst üste binmez */}
        <Viewport3DBottomCenterHudStack duplicateSceneObject={duplicateSceneObject} hoverBadgeDomRef={hoverBadgeDomRef} hoverBadgeTextRef={hoverBadgeTextRef} project={project} removeSceneObject={removeSceneObject} selectedSceneObjectId={selectedSceneObjectId} setSelectedSceneObjectId={setSelectedSceneObjectId} setSnapBannerDedup={setSnapBannerDedup} snapBannerDomRef={snapBannerDomRef} snapBannerTextRef={snapBannerTextRef} stageSafeInsets={stageSafeInsets} updateSceneObject={updateSceneObject} />

        <div
          ref={mountRef}
          data-testid="v3-three-canvas"
          className={`w-full h-full ${isCtrlPressed ? "cursor-move" : "cursor-grab active:cursor-grabbing"}`}
        />
        {!paused && (
        <>
        {webglContextLost && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#141413]/75 backdrop-blur-sm p-6">
            <div className="max-w-sm rounded-2xl bg-[#F5F3EE] border border-[#D8D3C8] px-6 py-5 text-center shadow-2xl">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8C7A6B] mb-1">
                3D Grafik Motoru
              </div>
              <div className="text-sm font-bold text-[#141413] mb-1.5">
                WebGL Bağlantısı Yeniden Kuruluyor
              </div>
              <p className="text-xs text-[#57534E] leading-relaxed">
                Ekran kartı sürücüsü sıfırlandı. Tasarım verileriniz güvende, sahne otomatik olarak geri yükleniyor.
              </p>
            </div>
          </div>
        )}

        <Viewport3DCalloutOverlays activeBayIndex={activeBayIndex} activeBrushMaterialId={activeBrushMaterialId} activeModuleIndex={activeModuleIndex} applyMaterialByTargetScope={applyMaterialByTargetScope} badgeDraftValue={badgeDraftValue} collapsedFloatingPanels={collapsedFloatingPanels} commitBadgeEdit={commitBadgeEdit} dimBounds={dimBounds} dimLabelDomMapRef={dimLabelDomMapRef} dimLabels={dimLabels} dimPopoverDomRef={dimPopoverDomRef} editingBadge={editingBadge} effectiveShowDimensions={effectiveShowDimensions} floatingPanelPos={floatingPanelPos} hardwareViewMode={hardwareViewMode} hwCalloutDomMapRef={hwCalloutDomMapRef} hwCallouts={hwCallouts} matCalloutDomMapRef={matCalloutDomMapRef} matCallouts={matCallouts} materialModeActive={materialModeActive} materialPaintTool={materialPaintTool} selectedComponentId={selectedComponentId} selectedHwCalloutId={selectedHwCalloutId} setActiveBayIndex={setActiveBayIndex} setBadgeDraftValue={setBadgeDraftValue} setDismissedBayPopover={setDismissedBayPopover} setEditingBadge={setEditingBadge} setSelectedComponentId={setSelectedComponentId} setSelectedHwCalloutId={setSelectedHwCalloutId} showInCanvasHud={showInCanvasHud} startCalloutBadgeDrag={startCalloutBadgeDrag} startFloatingPanelDrag={startFloatingPanelDrag} />
        <Viewport3DFloatingCards active3DSnap={active3DSnap} activeBayIndex={activeBayIndex} activeModule={activeModule} activeModuleIndex={activeModuleIndex} addDrawer={addDrawer} addHangingRail={addHangingRail} addShelf={addShelf} addSpecialFitting={addSpecialFitting} addSubDivider={addSubDivider} applyBayInteriorPreset={applyBayInteriorPreset} applyMaterialToSimilarComponents={applyMaterialToSimilarComponents} bayMenuSubSection={bayMenuSubSection} bayPopoverDomRef={bayPopoverDomRef} clicked3DContext={clicked3DContext} collapsedFloatingPanels={collapsedFloatingPanels} contextPopoverDomRef={contextPopoverDomRef} copyDoorConfigToAllBays={copyDoorConfigToAllBays} cutawayActiveBay={cutawayActiveBay} dismissedBayPopover={dismissedBayPopover} dockedToCorner={dockedToCorner} doorMenuSubSection={doorMenuSubSection} doorOpenAngleDeg={doorOpenAngleDeg} doorPopoverDomRef={doorPopoverDomRef} doorsHiddenIn3D={doorsHiddenIn3D} dragDropSnapBanner={dragDropSnapBanner} flipActiveDoorDirection={flipActiveDoorDirection} floatingMatScope={floatingMatScope} floatingPanelPos={floatingPanelPos} isDraggingItemOver3D={isDraggingItemOver3D} isRightInspectorOpen={isRightInspectorOpen} minimalChrome={minimalChrome} needsRenderRef={needsRenderRef} removeBayAndShrinkModule={removeBayAndShrinkModule} removeBayAt={removeBayAt} removeSelectedInteriorComponent={removeSelectedInteriorComponent} selectedComponentId={selectedComponentId} setActiveBayIndex={setActiveBayIndex} setActiveCamPill={setActiveCamPill} setBayDoorType={setBayDoorType} setBayMenuSubSection={setBayMenuSubSection} setBayV4DoorConfig={setBayV4DoorConfig} setClicked3DContext={setClicked3DContext} setCollapsedFloatingPanels={setCollapsedFloatingPanels} setCutawayActiveBay={setCutawayActiveBay} setDismissedBayPopover={setDismissedBayPopover} setDockedToCorner={setDockedToCorner} setDoorMenuSubSection={setDoorMenuSubSection} setDoorsHiddenIn3D={setDoorsHiddenIn3D} setFloatingMatScope={setFloatingMatScope} setFloatingPanelPos={setFloatingPanelPos} setModuleSlidingMountingType={setModuleSlidingMountingType} setSnapBannerDedup={setSnapBannerDedup} showInCanvasHud={showInCanvasHud} shrinkDoubleBayToSingle={shrinkDoubleBayToSingle} splitBayIntoTwo={splitBayIntoTwo} stageSafeInsets={stageSafeInsets} startFloatingPanelDrag={startFloatingPanelDrag} toggleDoorOpen={toggleDoorOpen} />
        <Viewport3DHudToolbars activeBayIndex={activeBayIndex} activeCamPill={activeCamPill} activeModule={activeModule} addAdjacentModule={addAdjacentModule} addStackedTopModule={addStackedTopModule} controlsRef={controlsRef} cutawayActiveBay={cutawayActiveBay} depth={depth} doorOpenAngleDeg={doorOpenAngleDeg} doorsHiddenIn3D={doorsHiddenIn3D} effectiveShowDimensions={effectiveShowDimensions} explode3DMenuOpen={explode3DMenuOpen} explodedFactor={explodedFactor} flipActiveDoorDirection={flipActiveDoorDirection} floorStyle={floorStyle} glbLibraryOpen={glbLibraryOpen} handleToggleDimensions={handleToggleDimensions} hardwareViewMenuOpen={hardwareViewMenuOpen} hardwareViewMode={hardwareViewMode} isSimpleTier={isSimpleTier} isXrayActive={isXrayActive} lightingPreset={lightingPreset} materialModeActive={materialModeActive} materialPaintTool={materialPaintTool} minimalChrome={minimalChrome} moveObjectMode3D={moveObjectMode3D} orthoCamRef={orthoCamRef} perspCamRef={perspCamRef} project={project} removeBayAt={removeBayAt} renderEdgeMode={renderEdgeMode} renderMenuOpen={renderMenuOpen} requestRender={requestRender} resetModuleMaterialOverrides={resetModuleMaterialOverrides} rotateActiveModule90={rotateActiveModule90} section3DAxis={section3DAxis} section3DMenuOpen={section3DMenuOpen} section3DRatio={section3DRatio} setActiveCamPill={setActiveCamPill} setCncXrayMode={setCncXrayMode} setCutawayActiveBay={setCutawayActiveBay} setDismissedBayPopover={setDismissedBayPopover} setDoorOpenAngleDeg={setDoorOpenAngleDeg} setDoorsHiddenIn3D={setDoorsHiddenIn3D} setExplode3DMenuOpen={setExplode3DMenuOpen} setExplodedFactor={setExplodedFactor} setFacadeGrainContinuityStore={setFacadeGrainContinuityStore} setFloorStyle={setFloorStyle} setGlbLibraryOpen={setGlbLibraryOpen} setHardwareViewMenuOpen={setHardwareViewMenuOpen} setHardwareViewMode={setHardwareViewMode} setLightingPreset={setLightingPreset} setMaterialPaintTool={setMaterialPaintTool} setMoveObjectMode3D={setMoveObjectMode3D} setRenderEdgeMode={setRenderEdgeMode} setRenderMenuOpen={setRenderMenuOpen} setRoomDimensionsStore={setRoomDimensionsStore} setSection3DAxis={setSection3DAxis} setSection3DMenuOpen={setSection3DMenuOpen} setSection3DRatio={setSection3DRatio} setShowInteriorProps3D={setShowInteriorProps3D} setShowRoomArchitecture3D={setShowRoomArchitecture3D} setSnapBannerDedup={setSnapBannerDedup} setUltraRenderProgress={setUltraRenderProgress} setViewportRenderStyle={setViewportRenderStyle} setWallTone={setWallTone} showInCanvasHud={showInCanvasHud} showInteriorProps3D={showInteriorProps3D} showRoomArchitecture3D={showRoomArchitecture3D} snapBadgeDomRef={snapBadgeDomRef} snapBadgeLabelRef={snapBadgeLabelRef} snapBadgeYRef={snapBadgeYRef} spaceWalls={spaceWalls} splitBayIntoTwo={splitBayIntoTwo} stageSafeInsets={stageSafeInsets} toggleDoorOpen={toggleDoorOpen} ultraRenderProgress={ultraRenderProgress} updateCarcassStore={updateCarcassStore} updateCeilingConfigStore={updateCeilingConfigStore} viewportRenderStyle={viewportRenderStyle} wallTone={wallTone} width={width} />
        {/* Option 2: Compact floating Active Target Wall HUD pill with 1-click wall switching */}
        {!minimalChrome && (project.space?.walls?.length || 0) > 1 && (() => {
          const effWalls = project.space.walls || [];
          const curWallIdx = Math.max(0, effWalls.findIndex((w) => w.id === (activeWallId || effWalls[0]?.id)));
          const curWall = effWalls[curWallIdx] || effWalls[0];
          if (!curWall) return null;
          const nextWall = effWalls[(curWallIdx + 1) % effWalls.length];
          return (
            <button
              type="button"
              data-testid="v11-active-wall-hud-pill"
              title={`Sonraki duvara geç: ${nextWall?.name || "Duvar"}`}
              onClick={(e) => {
                e.stopPropagation();
                if (nextWall) useConfiguratorStore.getState().setActiveWallId(nextWall.id);
              }}
              className="pointer-events-auto absolute top-[72px] max-xl:top-[108px] left-1/2 -translate-x-1/2 z-20 px-3 py-1 rounded-full bg-[#141821]/78 hover:bg-[#1E293B]/90 backdrop-blur-md border border-sky-400/45 text-[#E0F2FE] text-[11px] font-semibold shadow-[0_6px_18px_rgba(0,0,0,0.42)] flex items-center gap-2 transition cursor-pointer"
            >
              <span className="w-2 h-2 rounded-full bg-sky-400 shadow-[0_0_8px_#38BDF8] shrink-0" />
              <span className="truncate max-w-[200px]">
                Aktif Duvar: <b className="text-white">{curWall.name || "Ana Duvar"}</b> ({Math.round((curWall.length || 0) / 10)} cm)
              </span>
              <span className="text-[10px] text-sky-300/90 hidden sm:inline">• Değiştir</span>
            </button>
          );
        })()}

        {/* V11.4 ETKİLEŞİMLİ 3B KIRMIZI / TURUNCU HATA NOKTASI AÇIKLAMA & ÇÖZÜM KARTI */}
        {live3DEngineeringReport &&
          (() => {
            const spatialItems = (live3DEngineeringReport.findings || []).filter(
              (f) =>
                Boolean(f.worldPositionMm) &&
                (f.severity === "error" || f.ruleNature === "VERIFICATION_REQUIRED")
            );
            if (spatialItems.length === 0 && !selectedBeaconFinding) return null;

            return (
              <>
                {selectedBeaconFinding && (
                  <div
                    data-testid="v11-3d-beacon-popover"
                    style={{
                      bottom: "84px",
                      left: `${stageSafeInsets?.leftPx ?? 84}px`,
                    }}
                    className="birim-dramatic-panel absolute z-50 w-[296px] max-w-[calc(100vw-32px)] rounded-2xl bg-[#262D3B]/70 backdrop-blur-2xl border border-white/25 ring-1 ring-red-400/35 shadow-[0_18px_46px_rgba(0,0,0,0.48)] p-3 space-y-2 text-[11px] text-slate-100"
                  >
                    <Viewport3DBeaconPopoverBody activeBayIndex={activeBayIndex} activeModuleIndex={activeModuleIndex} applyApprovedEngineeringFix={applyApprovedEngineeringFix} project={project} selectedBeaconFinding={selectedBeaconFinding} setActiveBayIndex={setActiveBayIndex} setActiveModuleIndex={setActiveModuleIndex} setSelectedBeaconFinding={setSelectedBeaconFinding} spatialItems={spatialItems} />
                  </div>
                )}
              </>
            );
          })()}
        <Viewport3DBottomAlertsAndContextMenu addAdjacentModule={addAdjacentModule} addInteriorItemAtElevation={addInteriorItemAtElevation} applyApprovedEngineeringFix={applyApprovedEngineeringFix} applyBayInteriorPreset={applyBayInteriorPreset} applyMaterialToSimilarComponents={applyMaterialToSimilarComponents} applyV4Template={applyV4Template} canRedo3D={canRedo3D} canUndo3D={canUndo3D} contextMenuTarget={contextMenuTarget} controlsRef={controlsRef} doorOpenAngleDeg={doorOpenAngleDeg} doorsHiddenIn3D={doorsHiddenIn3D} drawerOpenMm={drawerOpenMm} duplicateActiveModule={duplicateActiveModule} effectiveShowDimensions={effectiveShowDimensions} engineeringAlertCollapsed={engineeringAlertCollapsed} equalizeBaysAndShelves={equalizeBaysAndShelves} flipActiveDoorDirection={flipActiveDoorDirection} handleToggleDimensions={handleToggleDimensions} live3DEngineeringReport={live3DEngineeringReport} minimalChrome={minimalChrome} moveInteriorItemToBay={moveInteriorItemToBay} paintTool3D={paintTool3D} perspCamRef={perspCamRef} project={project} redo={redo} removeActiveModule={removeActiveModule} removeBayAt={removeBayAt} removeSelectedInteriorComponent={removeSelectedInteriorComponent} removeSpaceObstacle={removeSpaceObstacle} requestRender={requestRender} restoreHoverPreviewMaterials={restoreHoverPreviewMaterials} rotateActiveModule90={rotateActiveModule90} setBayDoorType={setBayDoorType} setContextMenuTarget={setContextMenuTarget} setDoorsHiddenIn3D={setDoorsHiddenIn3D} setDrawerPlacement={setDrawerPlacement} setEngineeringAlertCollapsed={setEngineeringAlertCollapsed} setHangingRailElevation={setHangingRailElevation} setPaintTool3D={setPaintTool3D} setPlinthHeight={setPlinthHeight} setShelfElevation={setShelfElevation} setShelfThickness={setShelfThickness} setShowInteriorProps3D={setShowInteriorProps3D} showInCanvasHud={showInCanvasHud} showInteriorProps3D={showInteriorProps3D} splitBayIntoTwo={splitBayIntoTwo} stageSafeInsets={stageSafeInsets} swapModuleWithNeighbor={swapModuleWithNeighbor} toggleDoorOpen={toggleDoorOpen} toggleModuleLedLighting={toggleModuleLedLighting} undo={undo} />
        </>
        )}
      </div>
    );
  }
);

V3ThreeViewport.displayName = "V3ThreeViewport";
export default V3ThreeViewport;
