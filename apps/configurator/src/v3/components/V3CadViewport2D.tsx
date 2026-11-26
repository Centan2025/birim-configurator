"use client";
import { createLongPressController, createTwoFingerPinchTracker } from "../design-system/touchGestureHelpers";
import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { ArchitecturalElement, calculateNetInnerHeight, calculateBayWidths, calculateFourSpaceDimensions, getModuleFrontSweepBounds, doModulesOverlapOBB2D, computeProjectGrainContinuityMap, formatIssueHumanTitle } from "@birim/core";
import { type ElevationDetailLevel, type ElevationDisplayUnit, loadElevationDetailLevel, saveElevationDetailLevel, loadElevationDisplayUnit, saveElevationDisplayUnit, type HoveredElevationItem } from "./workspace/elevation2dHelpers";
import { type CadContextMenuState } from "./workspace/CadContextMenu2D";
import { useV3Adapter, generateModuleGeometry, generateElevation2D, generateTopPlan2D, generateCrossSection2D, getModuleOrientedFootprint, getBayShelfIntervalsForSubDivider, type RowSnapPreviewResult } from "../adapter/useV3Adapter";
import { computeElevationSnapTargets, ElevationSnapTarget } from "../engine/elevationSnapEngine";
import { useConfiguratorStore } from "../../store/useConfiguratorStore";
import { CadInteractivePlan2DView } from "./cad2d/CadInteractivePlan2DView";
import { CadElevationAndSection2DView } from "./cad2d/CadElevationAndSection2DView";

export interface V3CadViewport2DProps {
  mode: "elevation" | "plan" | "section";
  interactivePlan?: boolean;
  snapMm?: number;
  externalSectionDirection?: "Z" | "X";
  externalSectionRatio?: number;
  onExternalSectionChange?: (dir: "Z" | "X", ratio: number) => void;
  hideLegacySectionBar?: boolean;
  studioSafeInsets?: {
    topPx?: number;
    leftPx?: number;
    rightPx?: number;
    bottomPx?: number;
  };
}

export const V3CadViewport2D: React.FC<V3CadViewport2DProps> = React.memo(
  ({
    mode,
    interactivePlan = false,
    snapMm = 50,
    externalSectionDirection,
    externalSectionRatio,
    onExternalSectionChange,
    hideLegacySectionBar = false,
    studioSafeInsets,
  }) => {
    const {
      project,
      activeModule,
      activeModuleIndex,
      setActiveModuleIndex,
      activeBayIndex,
      setActiveBayIndex,
      selectedComponentId,
      setSelectedComponentId,
      rotateActiveModule90,
      snapModuleToAngledWall,
      setModulePosition,
      resizeModuleParametric,
      swapModuleWithNeighbor,
      finishModuleDragWithSmartSwap,
      setShelfElevation,
      setDrawerPlacement,
      setSpecialFittingPlacement,
      setHangingRailElevation,
      setBayCustomWidth,
      setSubDividerPlacement,
      removeSelectedInteriorComponent,
      spaceObstacles,
      spaceWalls,
      validationIssues,
      unifiedEngineeringReport,
      selectedModuleIds,
      toggleModuleSelection,
      selectAllModules,
      clearModuleSelection,
      batchMoveSelectedModules,
      batchRemoveSelectedModules,
      removeActiveModule,
      setRoomDimensions,
      updateCeilingConfig,
      setFacadeGrainContinuity,
      updateCarcassConfig,
      addWallSegment,
      updateWallSegment,
      removeWallSegment,
      addSpaceObstacle,
      updateSpaceObstacle,
      updateObstaclePosition,
      removeSpaceObstacle,
      setFloorPlanUnderlay,
      importWallsFromUnderlay,
      dropV4TemplateWithSnap,
      beginHistoryTransaction,
      commitHistoryTransaction,
      activeSpatialMetrics,
      applyRoomShapePreset,
      addInteriorItemAtElevation,
      setModuleOffsetFromLeftWall,
      selectedSceneObjectId,
      setSelectedSceneObjectId,
      updateSceneObject,
      duplicateSceneObject,
      removeSceneObject,
      addShelf,
      addFixedShelf,
      setShelfMountType,
      setShelfThickness,
      addDrawer,
      addInternalDrawer,
      addHangingRail,
      splitBayIntoTwo,
      equalizeBaysAndShelves,
      duplicateActiveModule,
      addAdjacentModule,
      addStackedTopModule,
      applyMaterialToSimilarComponents,
      undo,
      redo,
    } = useV3Adapter({ lightweightViewport: true });
    const [cadContextMenu, setCadContextMenu] = useState<CadContextMenuState | null>(null);
    const storeValidationIssues = useConfiguratorStore((s) => s.validationIssues);
    const isStoreBatchDragging = useConfiguratorStore((s) => s.batchStartProject !== null);

    const lastAccessoryDropTarget2DRef = useRef<{ bayIndex: number; elevationY: number; offsetX?: number; accessory: import("../../types/birim-window").BirimDraggedAccessoryPayload } | null>(null);
    const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  zoomRef.current = zoom;
  const pinchTrackerRef = useRef(createTwoFingerPinchTracker());
  const longPress2DRef = useRef(
    createLongPressController((cx, cy, tgt) => {
      const targetEl = tgt instanceof Element ? tgt : null;
      if (!targetEl) return;
      targetEl.dispatchEvent(
        new MouseEvent("contextmenu", {
          clientX: cx,
          clientY: cy,
          bubbles: true,
          cancelable: true,
        })
      );
    })
  );
    const [panPx, setPanPx] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const panPxRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const lastPointerMoveTsRef = useRef<number>(0);
    useEffect(() => {
      panPxRef.current = panPx;
    }, [panPx]);
    const [panning2D, setPanning2D] = useState<{
      startClientX: number;
      startClientY: number;
      startPanX: number;
      startPanY: number;
    } | null>(null);

    const wheelZoomAccRef = useRef<number>(0);
    const wheelZoomRafRef = useRef<number | null>(null);
    const lastDividerCommitValRef = useRef<string>("");

    const handleWheelZoom = useCallback((e: React.WheelEvent) => {
      e.stopPropagation();
      wheelZoomAccRef.current += e.deltaY < 0 ? 0.14 : -0.14;
      if (wheelZoomRafRef.current !== null) return;
      wheelZoomRafRef.current = requestAnimationFrame(() => {
        const acc = wheelZoomAccRef.current;
        wheelZoomAccRef.current = 0;
        wheelZoomRafRef.current = null;
        if (acc !== 0) {
          setZoom((prev) => Math.max(0.4, Math.min(3.5, +(prev + acc).toFixed(2))));
        }
      });
    }, []);
    const [showDoorsIn2D, setShowDoorsIn2D] = useState(false);
    const emptyGrainMapRef = useRef<ReturnType<typeof computeProjectGrainContinuityMap>>(new Map());
    const settledGrainMapRef = useRef<ReturnType<typeof computeProjectGrainContinuityMap>>(new Map());
    const grainContinuityMap2D = useMemo(() => {
      if (mode !== "elevation") return emptyGrainMapRef.current;
      if (isStoreBatchDragging && settledGrainMapRef.current.size > 0) {
        return settledGrainMapRef.current;
      }
      const nextMap = computeProjectGrainContinuityMap(project);
      settledGrainMapRef.current = nextMap;
      return nextMap;
    }, [project, mode, isStoreBatchDragging]);
    const [showRoomContextInElev, setShowRoomContextInElev] = useState(true);
    const [elevDetailLevel, setElevDetailLevel] = useState<ElevationDetailLevel>(loadElevationDetailLevel);
    const storeDisplayUnit = useConfiguratorStore((st) => st.displayUnit);
    const setStoreDisplayUnit = useConfiguratorStore((st) => st.setDisplayUnit);
    const storeActiveWallId = useConfiguratorStore((st) => st.activeWallId);
    const setStoreActiveWallId = useConfiguratorStore((st) => st.setActiveWallId);
    const [elevDisplayUnit, setElevDisplayUnit] = useState<ElevationDisplayUnit>(storeDisplayUnit || loadElevationDisplayUnit());
    useEffect(() => {
      if (storeDisplayUnit && storeDisplayUnit !== elevDisplayUnit) {
        setElevDisplayUnit(storeDisplayUnit);
      }
    }, [storeDisplayUnit, elevDisplayUnit]);
    const [elevInteriorMoveMode, setElevInteriorMoveMode] = useState<boolean>(false);
    const [isCtrlHeldElev, setIsCtrlHeldElev] = useState<boolean>(false);
    const interiorSnapTargetsRef = useRef<ElevationSnapTarget[]>([]);
    const effectiveInteriorMoveMode = elevInteriorMoveMode || isCtrlHeldElev;

    const handleChangeElevDetailLevel = useCallback((lvl: ElevationDetailLevel) => {
      setElevDetailLevel(lvl);
      saveElevationDetailLevel(lvl);
    }, []);
    const handleChangeElevDisplayUnit = useCallback((u: ElevationDisplayUnit) => {
      setElevDisplayUnit(u);
      saveElevationDisplayUnit(u);
      setStoreDisplayUnit(u);
    }, [setStoreDisplayUnit]);
    const fmtPlanDim = useCallback(
      (mmVal: number, withUnit = true) => {
        if (elevDisplayUnit === "cm") {
          const v = Number((mmVal / 10).toFixed(1));
          return withUnit ? `${v} cm` : `${v}`;
        }
        const v = Math.round(mmVal);
        return withUnit ? `${v} mm` : `${v}`;
      },
      [elevDisplayUnit]
    );

    // V86: Removed duplicate legacy birim:live-3d-part-drop listener (handled solely by unified resolveAccessoryDropTarget2D + onLiveDrop below)
    const [isDrawingWall, setIsDrawingWall] = useState(false);
    const [chainOriginPoint, setChainOriginPoint] = useState<{ x: number; z: number } | null>(null);
    const [drawWallStart, setDrawWallStart] = useState<{ x: number; z: number } | null>(null);
    const [drawWallCursor, setDrawWallCursor] = useState<{ x: number; z: number } | null>(null);
    const [activeSnapTarget, setActiveSnapTarget] = useState<{
      x: number;
      z: number;
      label: string;
    } | null>(null);

    const [newObstacleType, setNewObstacleType] = useState<ArchitecturalElement["type"]>("column");
    const [obstacleTargetWallId, setObstacleTargetWallId] = useState<string>("wall_main");
    const [newObstacleX, setNewObstacleX] = useState<number>(1200);
    const [newObstacleZ, setNewObstacleZ] = useState<number>(0);
    const [newObstacleW, setNewObstacleW] = useState<number>(900);
    const [newObstacleH, setNewObstacleH] = useState<number>(1100);
    const [newObstacleY, setNewObstacleY] = useState<number>(1000);
    const [newObstacleRotY, setNewObstacleRotY] = useState<number>(0);
    useEffect(() => {
      if (!storeActiveWallId) return;
      const matchedWall = spaceWalls.find((w) => w.id === storeActiveWallId);
      if (matchedWall) {
        setObstacleTargetWallId(matchedWall.id);
        setNewObstacleRotY((((matchedWall.rotationY || 0) % 360) + 360) % 360);
      }
    }, [storeActiveWallId, spaceWalls]);
    const [magnetEnabled, setMagnetEnabled] = useState<boolean>(true);
    const [showPlanGrid, setShowPlanGrid] = useState<boolean>(true);
    const [showPlanDimensions, setShowPlanDimensions] = useState<boolean>(true);
    const [wallDimDisplayMode, setWallDimDisplayMode] = useState<"net_inner" | "outer" | "plinth">("net_inner");
    const [planScaleRatio, setPlanScaleRatio] = useState<20 | 25 | 50>(25);

  const printActive2DCadSheet = useCallback(
    (sheetKind: "plan" | "elevation") => {
      if (typeof document === "undefined" || typeof window === "undefined") return;
      const selector =
        sheetKind === "plan" ? '[data-testid="v3-cad-plan-svg"]' : '[data-birim-elev-svg="true"]';
      const svgEl = document.querySelector(selector) as SVGSVGElement | null;
      if (!svgEl) return;
      const clone = svgEl.cloneNode(true) as SVGSVGElement;
      clone.removeAttribute("class");
      clone.setAttribute("style", "width:100%;height:auto;max-height:165mm;display:block;background:#FFFFFF;");
      const svgMarkup = new XMLSerializer().serializeToString(clone);
      const sheetTitle =
        sheetKind === "plan"
          ? "BİRİM® MEKÂN YERLEŞİM PLANI (2B)"
          : "BİRİM® TEKNİK GÖRÜNÜŞ & ÖLÇÜ PAFTASI (2B)";
      const subMeta = `${project.title || "Birim Projesi"} • Modül Sayısı: ${project.modules.length} • Ölçü Birimi: ${elevDisplayUnit} • Tarih: ${new Date().toLocaleDateString("tr-TR")}`;
      const modSummary = project.modules
        .map(
          (m, idx) =>
            `<tr><td>#${idx + 1}</td><td><b>${m.name}</b></td><td>${m.dimensions.width} × ${m.dimensions.height} × ${m.dimensions.depth} mm</td><td>X: ${Math.round(m.position.x)} mm • Y: ${Math.round(m.position.y)} mm</td></tr>`
        )
        .join("");
      const html = `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"/><title>${sheetTitle}</title>
        <style>
          @page { size: A4 landscape; margin: 10mm; }
          body { font-family: -apple-system, Segoe UI, sans-serif; margin: 0; padding: 14px; color: #0F172A; background: #FFFFFF; }
          .hdr { display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2px solid #0F172A; padding-bottom:8px; margin-bottom:10px; }
          .ttl { font-size:18px; font-weight:900; letter-spacing:0.6px; }
          .sub { font-size:11px; color:#475569; margin-top:2px; }
          .canvas-box { border:1px solid #CBD5E1; border-radius:10px; padding:8px; background:#FFFFFF; text-align:center; }
          table { width:100%; border-collapse:collapse; font-size:11px; margin-top:10px; }
          th, td { border:1px solid #CBD5E1; padding:5px 7px; text-align:left; }
          th { background:#F1F5F9; font-weight:800; }
        </style></head><body>
        <div class="hdr">
          <div><div class="ttl">${sheetTitle}</div><div class="sub">${subMeta}</div></div>
          <div style="font-family:monospace;font-size:11px;text-align:right;">Ölçek: 1:${planScaleRatio}<br/>Tavan: ${project.space.ceilingHeight || 2600} mm</div>
        </div>
        <div class="canvas-box">${svgMarkup}</div>
        ${modSummary ? `<table><thead><tr><th>#</th><th>Modül</th><th>Ölçüler (G×Y×D)</th><th>Yerleşim Konumu</th></tr></thead><tbody>${modSummary}</tbody></table>` : ""}
        <script>window.onload=()=>setTimeout(()=>window.print(),260);</script></body></html>`;
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
    },
    [project.title, project.modules, project.space.ceilingHeight, elevDisplayUnit, planScaleRatio]
  );
    const [showAdvancedCadBar, setShowAdvancedCadBar] = useState<boolean>(false);
    const [inlineEditWallId, setInlineEditWallId] = useState<string | null>(null);
    const [inlineEditWallLength, setInlineEditWallLength] = useState<number>(3600);
    const [elevDraggingObs, setElevDraggingObs] = useState<{
      id: string;
      startClientX: number;
      startClientY: number;
      startX: number;
      startY: number;
      mmPerPxX: number;
      mmPerPxY: number;
    } | null>(null);
    const [elevDraggingMod, setElevDraggingMod] = useState<{
      modIdx: number;
      startClientX: number;
      startClientY: number;
      startModX: number;
      startModY: number;
      mmPerPxX: number;
      mmPerPxY: number;
    } | null>(null);
    const [elevDraggingSceneObj, setElevDraggingSceneObj] = useState<{
      id: string;
      startClientX: number;
      startClientY: number;
      startX: number;
      startY: number;
      startZ: number;
      mmPerPxX: number;
      mmPerPxY: number;
    } | null>(null);
    const elevDragPreviewRef = useRef<{
      modIdx: number;
      x: number;
      y: number;
      snapXLine?: number;
      snapYLine?: number;
    } | null>(null);
    const activeModGroupRef = useRef<SVGGElement | null>(null);
    const activeHaloGroupRef = useRef<SVGGElement | null>(null);
    const snapXGroupRef = useRef<SVGGElement | null>(null);
    const snapXLineRef = useRef<SVGLineElement | null>(null);
    const snapXCircleRef = useRef<SVGCircleElement | null>(null);
    const snapXBadgeRef = useRef<SVGRectElement | null>(null);
    const snapXTextRef = useRef<SVGTextElement | null>(null);
    const snapYGroupRef = useRef<SVGGElement | null>(null);
    const snapYLineRef = useRef<SVGLineElement | null>(null);
    const snapYBadgeRef = useRef<SVGRectElement | null>(null);
    const snapYTextRef = useRef<SVGTextElement | null>(null);
    const elevSnapBannerDomRef = useRef<HTMLDivElement | null>(null);
    const [canvasFontScale, setCanvasFontScale] = useState<number>(1);
    useEffect(() => {
      if (typeof window === "undefined") return;
      const cur = Number(getComputedStyle(document.documentElement).getPropertyValue("--birim-canvas-label-scale") || "1");
      if (Number.isFinite(cur) && cur >= 0.7 && cur <= 1.7) setCanvasFontScale(cur);
      const onScale = (ev: Event) => {
        const val = Number((ev as CustomEvent<number>).detail);
        if (Number.isFinite(val) && val >= 0.7 && val <= 1.7) setCanvasFontScale(val);
      };
      window.addEventListener("birim:canvas-font-scale-changed", onScale);
      return () => window.removeEventListener("birim:canvas-font-scale-changed", onScale);
    }, []);
    const [elevResizingMod, setElevResizingMod] = useState<{
      modIdx: number;
      axis: "width_right" | "width_left" | "height_top" | "height_bottom";
      startClientX: number;
      startClientY: number;
      startW: number;
      startH: number;
      startX: number;
      startY: number;
      mmPerPxX: number;
      mmPerPxY: number;
    } | null>(null);
    const [resizingPlanObject, setResizingPlanObject] = useState<{
      kind:
        | "module_left"
        | "module_right"
        | "module_top"
        | "module_depth"
        | "angled_module_length"
        | "obstacle_start"
        | "obstacle_end"
        | "wall_end";
      targetIdxOrId: string | number;
      startClientX: number;
      startClientY: number;
      startWidthOrLen: number;
      startDepth?: number;
      startPosX: number;
      startPosZ: number;
      isSideWall?: boolean;
      isRotated90?: boolean;
      rotYDeg?: number;
      anchorOriginX?: number;
      anchorOriginZ?: number;
      mmPerPx: number;
    } | null>(null);
    const lockedPlanVbRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
    const lockedElevVbRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
    const lockedElevOriginRef = useRef<{ x: number; y: number; modH: number } | null>(null);
    const lockedElevModIdRef = useRef<string | null>(null);
    const [isPlacingObstacle, setIsPlacingObstacle] = useState<boolean>(false);
    const [obstaclePreviewPos, setObstaclePreviewPos] = useState<{
      x: number;
      z: number;
      rotY?: number;
      wallName?: string;
    } | null>(null);
    const liveObsSnappedRotRef = useRef<number | null>(null);

    const [selectedPlanObject, setSelectedPlanObject] = useState<{
      kind: "wall" | "obstacle" | "module";
      id: string;
    } | null>(null);

    const [draggingObsId, setDraggingObsId] = useState<string | null>(null);
    const [obsDragStart, setObsDragStart] = useState<{
      clientX: number;
      clientY: number;
      startX: number;
      startZ: number;
    }>({ clientX: 0, clientY: 0, startX: 0, startZ: 0 });

    const [draggingWallId, setDraggingWallId] = useState<string | null>(null);
    const [wallDragStart, setWallDragStart] = useState<{
      clientX: number;
      clientY: number;
      startX: number;
      startZ: number;
    }>({ clientX: 0, clientY: 0, startX: 0, startZ: 0 });

    const floorPlanInputRef = useRef<HTMLInputElement | null>(null);
    const [draggingModIdx, setDraggingModIdx] = useState<number | null>(null);
    const [dragStartClient, setDragStartClient] = useState<{
      x: number;
      z: number;
      startModX: number;
      startModZ: number;
      mmPerPx: number;
    }>({
      x: 0,
      z: 0,
      startModX: 0,
      startModZ: 0,
      mmPerPx: 4,
    });

    // Interactive dragging state for 2D Elevation interior blocks (Shelf Y, Drawer Y, Rail Y, Bay Divider X, SubDivider X)
    const [elevPanMode, setElevPanMode] = useState<boolean>(false);
    const [interiorDrag, setInteriorDrag] = useState<{
      kind: "shelf" | "drawer" | "rail" | "special_fitting" | "divider" | "sub_divider";
      bayIdx: number;
      targetId: string;
      startClientX: number;
      startClientY: number;
      startValueMm: number;
      startElevY?: number;
      itemHeightMm?: number;
      mmPerPxX?: number;
      mmPerPxY?: number;
    } | null>(null);
    const [activeElevSnap, setActiveElevSnap] = useState<ElevationSnapTarget | null>(null);
    const [planRowSnapBanner, setPlanRowSnapBanner] = useState<string | null>(null);
    const [activeSpatialAlertIdx, setActiveSpatialAlertIdx] = useState<number>(0);
    const [spatialAlertsMinimized, setSpatialAlertsMinimized] = useState<boolean>(false);
    const [cadTextScale, setCadTextScale] = useState<number>(() => {
      if (typeof window !== "undefined") {
        const globalUi = Number(window.localStorage.getItem("birim_ui_font_scale"));
        if (Number.isFinite(globalUi) && globalUi >= 0.75 && globalUi <= 1.6) {
          return Number((1.65 * globalUi).toFixed(2));
        }
        const saved = Number(window.localStorage.getItem("birim_v4_cad_text_scale"));
        if (saved >= 0.8 && saved <= 2.6) return saved;
      }
      return 1.65;
    });
    useEffect(() => {
      const onFontScale = (ev: Event) => {
        const scale = Number((ev as CustomEvent<number>).detail);
        if (Number.isFinite(scale) && scale >= 0.75 && scale <= 1.6) {
          const clamped = Math.max(0.85, Math.min(2.64, Number((1.65 * scale).toFixed(2))));
          setCadTextScale(clamped);
        }
      };
      window.addEventListener("birim:canvas-font-scale-changed", onFontScale);
      return () => window.removeEventListener("birim:canvas-font-scale-changed", onFontScale);
    }, []);
    const [dragGhostPreview, setDragGhostPreview] = useState<RowSnapPreviewResult | null>(null);
    const [activePlanSnapX, setActivePlanSnapX] = useState<number | null>(null);
    const [internalSectionDir2D, setInternalSectionDir2D] = useState<"Z" | "X">("Z");
    const [internalSectionRatio2D, setInternalSectionRatio2D] = useState<number>(0.5);
    const sectionDirection2D = externalSectionDirection ?? internalSectionDir2D;
    const sectionCutRatio2D = typeof externalSectionRatio === "number" ? externalSectionRatio : internalSectionRatio2D;
    const setSectionDirection2D = (dir: "Z" | "X") => {
      setInternalSectionDir2D(dir);
      onExternalSectionChange?.(dir, sectionCutRatio2D);
    };
    const setSectionCutRatio2D = (ratio: number) => {
      setInternalSectionRatio2D(ratio);
      onExternalSectionChange?.(sectionDirection2D, ratio);
    };
    const [cadDrawerTab, setCadDrawerTab] = useState<"wall" | "obstacle" | "dxf">("wall");
    const [showWallCoordsInPill, setShowWallCoordsInPill] = useState<boolean>(false);
    // 1+3 Hibrit Cephe Görünürlüğü: Varsayılan Tasarım Modu (false), klavye kısayolu T
    const [showAllDimensions, setShowAllDimensions] = useState<boolean>(false);
    const [hoveredElevationItem, setHoveredElevationItem] = useState<HoveredElevationItem | null>(null);
    const [hoveredHeightHandle, setHoveredHeightHandle] = useState<"top" | "bottom" | null>(null);
    const [elevCoordMode, setElevCoordMode] = useState<"global" | "local">("global");
    const effectiveShowAllDims = showAllDimensions || elevDetailLevel === "technical";
    useEffect(() => {
      if (mode !== "elevation") return;
      const onKeyToggleDims = (ev: KeyboardEvent) => {
        const tag = (ev.target as HTMLElement | null)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (ev.target as HTMLElement | null)?.isContentEditable) return;
        if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
        if (ev.key === "t" || ev.key === "T") {
          ev.preventDefault();
          setShowAllDimensions((v) => {
            const next = !v;
            handleChangeElevDetailLevel(next ? "technical" : "selected");
            return next;
          });
        }
      };
      window.addEventListener("keydown", onKeyToggleDims);
      return () => window.removeEventListener("keydown", onKeyToggleDims);
    }, [mode]);

    const footprints = useMemo(
      () => project.modules.map((m, idx) => getModuleOrientedFootprint(m, idx)),
      [project.modules]
    );

    const moduleCadMetrics = useMemo(
      () =>
        project.modules.map((m) => ({
          bayWidths: calculateBayWidths(m),
          fourSpace: calculateFourSpaceDimensions(m),
        })),
      [project.modules]
    );

    // Zero-re-render 2D Plan ("Odam") & Elevation interior drag refs
    const planLiveSvgDragRef = useRef<{
      el: SVGGElement | null;
      baseTransform: string;
      attachedEls: { el: SVGGElement; baseTransform: string }[];
      kind: "module" | "obstacle" | "wall" | "scene_object";
      modIdx?: number;
      targetId?: string;
      startX: number;
      startZ: number;
      nextX: number;
      nextZ: number;
      snapStepMm?: number;
      hasMoved: boolean;
    } | null>(null);
    const [draggingSceneObjId, setDraggingSceneObjId] = useState<string | null>(null);
    const [sceneObjDragStart, setSceneObjDragStart] = useState<{
      clientX: number;
      clientY: number;
      startX: number;
      startZ: number;
      mmPerPx: number;
    }>({ clientX: 0, clientY: 0, startX: 0, startZ: 0, mmPerPx: 4 });
    const planSnapBannerWrapRef = useRef<HTMLDivElement | null>(null);
    const planSnapBannerTextRef = useRef<HTMLSpanElement | null>(null);
    const elevInteriorLiveRef = useRef<{
      els: { el: SVGGElement; baseTransform: string }[];
      snappedY: number;
      hasMoved: boolean;
      destModIdx?: number;
      destBayIdx?: number;
    } | null>(null);
    const lastInteriorCommitRef = useRef<string>("");
    const lastModElevCommitRef = useRef<string>("");
    const elevVbZoomRef = useRef<{ vbWidth: number; vbHeight: number; zoom: number }>({
      vbWidth: 2400,
      vbHeight: 2400,
      zoom: 1,
    });

    const getElevScaleMmPerPx = useCallback((svgEl: SVGSVGElement) => {
      try {
        const ctm = svgEl.getScreenCTM();
        if (ctm && Math.abs(ctm.a) > 0.00001 && Math.abs(ctm.d) > 0.00001) {
          return { x: 1 / Math.abs(ctm.a), y: 1 / Math.abs(ctm.d) };
        }
      } catch {
        // fallback
      }
      const rect = svgEl.getBoundingClientRect();
      const { vbWidth, vbHeight, zoom: curZ } = elevVbZoomRef.current;
      const s = Math.max(
        vbWidth / Math.max(1, rect.width * curZ),
        vbHeight / Math.max(1, rect.height * curZ)
      );
      return { x: s, y: s };
    }, []);

    useEffect(() => {
      return () => {
        if (typeof document !== "undefined") {
          delete document.body.dataset.birimUiDragging;
        }
      };
    }, []);

    const isInteractiveRoomPlan = mode === "plan" && interactivePlan;

    const activeModuleBreakdown = useMemo(
      () =>
        isInteractiveRoomPlan
          ? ({
              moduleId: activeModule.id,
              overall: activeModule.dimensions,
              netInnerHeight: Math.max(200, activeModule.dimensions.height - 136),
              bayWidths: [],
              components: [],
            } as unknown as ReturnType<typeof generateModuleGeometry>)
          : generateModuleGeometry(activeModule, { doorOpenAngleDeg: 0 }),
      [activeModule, isInteractiveRoomPlan]
    );

    const sectionCutCoordMm = useMemo(() => {
      if (isInteractiveRoomPlan) return 0;
      const span =
        sectionDirection2D === "Z"
          ? activeModuleBreakdown.overall.width
          : activeModuleBreakdown.overall.depth;
      return Math.round(span * sectionCutRatio2D);
    }, [activeModuleBreakdown, sectionDirection2D, sectionCutRatio2D, isInteractiveRoomPlan]);

    const activeModule2DData = useMemo(
      () =>
        isInteractiveRoomPlan
          ? ({ elements: [], dimensions: [], overallWidth: 0, overallHeight: 0 } as unknown as ReturnType<
              typeof generateElevation2D
            >)
          : mode === "elevation"
          ? generateElevation2D(activeModuleBreakdown, selectedComponentId || undefined)
          : mode === "plan"
          ? generateTopPlan2D(activeModuleBreakdown, selectedComponentId || undefined)
          : generateCrossSection2D(activeModuleBreakdown, selectedComponentId || undefined, {
              direction: sectionDirection2D,
              cutCoordMm: sectionCutCoordMm,
            }),
      [
        isInteractiveRoomPlan,
        mode,
        activeModuleBreakdown,
        selectedComponentId,
        sectionDirection2D,
        sectionCutCoordMm,
      ]
    );

    useEffect(() => {
      if (!interiorDrag || mode !== "elevation") {
        interiorSnapTargetsRef.current = [];
        return;
      }
      interiorSnapTargetsRef.current = computeElevationSnapTargets(
        project,
        activeModuleIndex,
        interiorDrag.bayIdx,
        interiorDrag.targetId,
        interiorDrag.itemHeightMm
      );
    }, [interiorDrag?.targetId, interiorDrag?.bayIdx, activeModuleIndex, mode]);

    const effectiveValidationIssues =
      validationIssues.length > 0 ? validationIssues : storeValidationIssues;
    const errorModuleIds = useMemo(() => {
      const set = new Set<string>();
      effectiveValidationIssues.forEach((iss) => {
        if (
          (iss.severity === "error" ||
            iss.code === "WARN_FRONT_OPENING_SWEEP_COLLISION") &&
          iss.targetId
        ) {
          set.add(iss.targetId);
          project.modules.forEach((m) => {
            if (iss.targetId?.includes(m.id)) {
              set.add(m.id);
            }
          });
        }
      });
      return set;
    }, [effectiveValidationIssues, project.modules]);

    const settledSpatialAlertsRef = useRef<
      {
        id: string;
        kind: "window" | "plumbing" | "door_swing" | "column" | "module_overlap";
        severity: "error" | "warning";
        title: string;
        detail: string;
        x: number;
        z: number;
        y: number;
        w: number;
        h: number;
        modIdx?: number;
      }[]
    >([]);

    // Compute real-time 2D spatial/architectural intersection warnings (Window, Plumbing, Door Swing, Column, Module Overlap)
    const liveSpatialAlerts = useMemo(() => {
      if (isStoreBatchDragging) {
        return settledSpatialAlertsRef.current;
      }
      const alerts: {
        id: string;
        kind: "window" | "plumbing" | "door_swing" | "column" | "module_overlap";
        severity: "error" | "warning";
        title: string;
        detail: string;
        x: number;
        z: number;
        y: number;
        w: number;
        h: number;
        modIdx?: number;
      }[] = [];

      const isSinkCompatible = (mod: (typeof project.modules)[number]) => {
        const lbl = `${mod.id} ${mod.name} ${mod.templateId || ""}`.toLowerCase();
        return (
          lbl.includes("eviye") ||
          lbl.includes("sink") ||
          lbl.includes("snk") ||
          lbl.includes("ıslak") ||
          lbl.includes("islak") ||
          lbl.includes("tesisat") ||
          lbl.includes("bulaşık") ||
          lbl.includes("bulasik") ||
          lbl.includes("dsh")
        );
      };

      // Check each module against obstacles & side walls
      footprints.forEach((fp, mIdx) => {
        const mod = project.modules[mIdx];
        if (!mod || mod.category === "complementary") return;
        const mx1 = fp.x;
        const mx2 = fp.x + fp.planWidth;
        const mz1 = fp.z;
        const mz2 = fp.z + fp.planDepth;
        const worktopH = mod.category === "kitchen_base" ? 40 : 0;
        const mBottomY = mod.position.y;
        const mTopY = mod.position.y + mod.dimensions.height + worktopH;
        const hasHingedDoor =
          !mod.isOpenFront &&
          mod.bays.some((b) => b.door.type !== "open" && b.door.type !== "sliding");
        const sweepD = hasHingedDoor
          ? Math.min(550, Math.max(320, Math.round(fp.planWidth / Math.max(1, mod.bays.length))))
          : 0;

        // Side-wall handle block check: hinged door right against X=0 or side return wall (<25mm gap)
        if (hasHingedDoor && fp.rotationY === 0) {
          const firstDoorDir = mod.bays[0]?.door?.direction;
          const lastDoorDir = mod.bays[mod.bays.length - 1]?.door?.direction;
          const hasLeftReturnWall = spaceWalls.some(
            (w) => (w.rotationY === 90 || w.rotationY === 270) && w.position.x <= 50
          );
          if (hasLeftReturnWall && mx1 < 25 && (firstDoorDir === "left" || String(firstDoorDir) === "double")) {
            alerts.push({
              id: `door_wall_left_${mod.id}`,
              kind: "door_swing",
              severity: "warning",
              title: "🚪 KAPAK AÇILIM ENGELİ",
              detail: `${mod.name} sol yan duvara sıfır (${mx1}mm); kulp duvara çarpar (min 35mm kör çıta önerilir)`,
              x: mx1 + 80,
              z: mz2 + 120,
              y: mBottomY + mod.dimensions.height / 2,
              w: 220,
              h: 220,
              modIdx: mIdx,
            });
          }
          const hasRightReturnWall = spaceWalls.some(
            (w) => (w.rotationY === 90 || w.rotationY === 270) && Math.abs(w.position.x - (spaceWalls[0]?.length || 3600)) <= 60
          );
          const mainLen = spaceWalls[0]?.length || 3600;
          if (hasRightReturnWall && mainLen - mx2 >= 0 && mainLen - mx2 < 25 && (lastDoorDir === "right" || String(lastDoorDir) === "double")) {
            alerts.push({
              id: `door_wall_right_${mod.id}`,
              kind: "door_swing",
              severity: "warning",
              title: "🚪 KAPAK AÇILIM ENGELİ",
              detail: `${mod.name} sağ yan duvara sıfır; kapak tam açılamaz (kör çıta önerilir)`,
              x: mx2 - 80,
              z: mz2 + 120,
              y: mBottomY + mod.dimensions.height / 2,
              w: 220,
              h: 220,
              modIdx: mIdx,
            });
          }
        }

        spaceObstacles.forEach((obs) => {
          const oRot = (((obs.rotationY || 0) % 360) + 360) % 360;
          const isSideObs = oRot === 90 || oRot === 270;
          const ox1 = obs.position.x;
          const ox2 = obs.position.x + (isSideObs ? Math.max(180, obs.dimensions.depth || 150) : obs.dimensions.width);
          const oz1 = obs.position.z;
          const oz2 = obs.position.z + (isSideObs ? obs.dimensions.width : Math.max(180, obs.dimensions.depth || 150));
          const oy1 = obs.position.y;
          const oy2 = obs.position.y + obs.dimensions.height;

          const xOverlap = mx1 < ox2 - 2 && mx2 > ox1 + 2;
          const zOverlap = isSideObs
            ? mz1 < oz2 - 2 && mz2 > oz1 + 2 && mx1 < 260
            : mz1 < 350;
          const yOverlap = mBottomY < oy2 - 2 && mTopY > oy1 + 2;

          // A. Window Collision
          if (obs.type === "window" && (isSideObs ? zOverlap : xOverlap && mz1 < 350)) {
            if (yOverlap) {
              const overlapX1 = Math.max(mx1, ox1);
              const overlapX2 = Math.min(mx2, ox2);
              alerts.push({
                id: `win_hit_${mod.id}_${obs.id}`,
                kind: "window",
                severity: "error",
                title: `🪟 PENCERE KESİŞİMİ (${obs.name})`,
                detail: `${mod.name} üst kotu (${mTopY}mm) pencere denizliğini (Y:${oy1}mm) ${mTopY - oy1}mm aşıyor!`,
                x: Math.round((overlapX1 + overlapX2) / 2),
                z: mz1 + fp.planDepth / 2,
                y: oy1,
                w: Math.max(160, overlapX2 - overlapX1),
                h: Math.max(120, mTopY - oy1),
                modIdx: mIdx,
              });
            }
          }

          // B. Plumbing Compatibility Check
          if (obs.type === "plumbing" && xOverlap && mz1 < 350 && mBottomY < 500 && mod.category !== "kitchen_wall") {
            if (!isSinkCompatible(mod)) {
              alerts.push({
                id: `plumb_incompat_${mod.id}_${obs.id}`,
                kind: "plumbing",
                severity: "error",
                title: "🚰 TESİSAT UYUMSUZLUĞU!",
                detail: `Tesisat önüne "${mod.name}" geldi! Buraya mutlaka Eviye (Sink) / tesisat uyumlu modül yerleştirilmelidir.`,
                x: Math.round(obs.position.x + obs.dimensions.width / 2),
                z: mz1 + fp.planDepth / 2,
                y: oy1 + obs.dimensions.height / 2,
                w: fp.planWidth,
                h: mod.dimensions.height,
                modIdx: mIdx,
              });
            }
          }

          // C. Architectural Room Door Swing Collision
          if (obs.type === "door") {
            const doorArcMaxX = isSideObs ? ox1 + obs.dimensions.width * 0.85 : ox2;
            const doorArcMaxZ = isSideObs ? oz2 : Math.max(oz2, obs.dimensions.width * 0.85);
            if (mx1 < doorArcMaxX - 5 && mx2 > ox1 + 5 && mz1 < doorArcMaxZ - 5 && yOverlap) {
              alerts.push({
                id: `room_door_hit_${mod.id}_${obs.id}`,
                kind: "door_swing",
                severity: "error",
                title: `🚪 KAPI AÇILIM ENGELİ (${obs.name})`,
                detail: `${mod.name} modülü oda kapısının 90° açılış alanını kapatıyor!`,
                x: Math.round((Math.max(mx1, ox1) + Math.min(mx2, doorArcMaxX)) / 2),
                z: Math.round(doorArcMaxZ * 0.5),
                y: oy1 + 900,
                w: obs.dimensions.width,
                h: obs.dimensions.height,
                modIdx: mIdx,
              });
            }
          }

          // D. Column / Beam / Partition Body or Cabinet Door Sweep Collision
          if (obs.type === "column" || obs.type === "beam" || obs.type === "partition" || obs.type === "protrusion") {
            const bodyZHit = mz1 < oz2 - 2 && mz2 > oz1 + 2;
            const sweepZHit = hasHingedDoor && mz2 + sweepD > oz1 + 2 && mz1 < oz2 - 2;
            if (xOverlap && bodyZHit && yOverlap) {
              alerts.push({
                id: `col_hit_${mod.id}_${obs.id}`,
                kind: "column",
                severity: "error",
                title: `🏛️ ${obs.name.toUpperCase()} ÇAKIŞMASI`,
                detail: `${mod.name} gövdesi ${obs.name} ile iç içe geçiyor!`,
                x: Math.round(obs.position.x + obs.dimensions.width / 2),
                z: Math.round(obs.position.z + (obs.dimensions.depth || 250) / 2),
                y: mBottomY + mod.dimensions.height / 2,
                w: obs.dimensions.width,
                h: mod.dimensions.height,
                modIdx: mIdx,
              });
            } else if (xOverlap && sweepZHit && yOverlap) {
              alerts.push({
                id: `col_door_hit_${mod.id}_${obs.id}`,
                kind: "door_swing",
                severity: "error",
                title: `🚪 KAPAK AÇILIM ENGELİ (${obs.name})`,
                detail: `${mod.name} kapağı açılırken ${obs.name} engeline çarpıyor!`,
                x: Math.round(obs.position.x + obs.dimensions.width / 2),
                z: mz2 + Math.round(sweepD * 0.5),
                y: mBottomY + mod.dimensions.height / 2,
                w: obs.dimensions.width,
                h: mod.dimensions.height,
                modIdx: mIdx,
              });
            }
          }
        });
      });

      // Check unassigned plumbing points (plumbing with no floor module in front of it)
      spaceObstacles
        .filter((o) => o.type === "plumbing")
        .forEach((plumb) => {
          const px1 = plumb.position.x;
          const px2 = plumb.position.x + plumb.dimensions.width;
          const hasCoveringMod = footprints.some((fp, idx) => {
            const m = project.modules[idx];
            return (
              m &&
              m.category !== "complementary" &&
              m.category !== "kitchen_wall" &&
              m.position.y < 500 &&
              fp.z < 350 &&
              fp.x < px2 - 2 &&
              fp.x + fp.planWidth > px1 + 2
            );
          });
          if (!hasCoveringMod) {
            alerts.push({
              id: `plumb_unassigned_${plumb.id}`,
              kind: "plumbing",
              severity: "warning",
              title: "🚰 AÇIKTA TESİSAT AKSI",
              detail: `X:${Math.round(px1 + plumb.dimensions.width / 2)}mm tesisat önünde Eviye (Sink) modülü yok!`,
              x: Math.round(px1 + plumb.dimensions.width / 2),
              z: 220,
              y: plumb.position.y + plumb.dimensions.height / 2,
              w: plumb.dimensions.width,
              h: plumb.dimensions.height,
            });
          }
        });

      // Check Module-to-Module Body Overlap & Door-Swing Sweep Collision
      for (let i = 0; i < footprints.length; i++) {
        for (let j = i + 1; j < footprints.length; j++) {
          const f1 = footprints[i];
          const f2 = footprints[j];
          const m1 = project.modules[i];
          const m2 = project.modules[j];
          if (!m1 || !m2 || m1.category === "complementary" || m2.category === "complementary") continue;
          const yHit =
            m1.position.y < m2.position.y + m2.dimensions.height - 2 &&
            m1.position.y + m1.dimensions.height > m2.position.y + 2;
          if (!yHit) continue;

          const xHit = f1.x < f2.x + f2.planWidth - 4 && f1.x + f1.planWidth > f2.x + 4;
          const zHit = f1.z < f2.z + f2.planDepth - 4 && f1.z + f1.planDepth > f2.z + 4;
          if (xHit && zHit && doModulesOverlapOBB2D(m1, m2, 2.5)) {
            alerts.push({
              id: `mod_overlap_${m1.id}_${m2.id}`,
              kind: "module_overlap",
              severity: "error",
              title: "⚠️ MODÜL ÇAKIŞMASI",
              detail: `#${i + 1} ${m1.name} ile #${j + 1} ${m2.name} üst üste biniyor!`,
              x: Math.round((Math.max(f1.x, f2.x) + Math.min(f1.x + f1.planWidth, f2.x + f2.planWidth)) / 2),
              z: Math.round((Math.max(f1.z, f2.z) + Math.min(f1.z + f1.planDepth, f2.z + f2.planDepth)) / 2),
              y: Math.max(m1.position.y, m2.position.y) + 400,
              w: Math.max(120, Math.min(f1.x + f1.planWidth, f2.x + f2.planWidth) - Math.max(f1.x, f2.x)),
              h: 600,
              modIdx: i,
            });
            continue;
          }

          // Check Door Opening Sweep Collision between m1 and m2
          const s1 = getModuleFrontSweepBounds(m1);
          const s2 = getModuleFrontSweepBounds(m2);
          const s1HitsM2 =
            s1 &&
            s1.minX < f2.x + f2.planWidth - 4 &&
            s1.maxX > f2.x + 4 &&
            s1.minZ < f2.z + f2.planDepth - 4 &&
            s1.maxZ > f2.z + 4;
          const s2HitsM1 =
            s2 &&
            s2.minX < f1.x + f1.planWidth - 4 &&
            s2.maxX > f1.x + 4 &&
            s2.minZ < f1.z + f1.planDepth - 4 &&
            s2.maxZ > f1.z + 4;
          const sweepsCollide =
            s1 &&
            s2 &&
            f1.rotationY !== f2.rotationY &&
            s1.minX < s2.maxX - 4 &&
            s1.maxX > s2.minX + 4 &&
            s1.minZ < s2.maxZ - 4 &&
            s1.maxZ > s2.minZ + 4;

          if (s1HitsM2 || s2HitsM1 || sweepsCollide) {
            alerts.push({
              id: `door_sweep_${m1.id}_${m2.id}`,
              kind: "door_swing",
              severity: "warning",
              title: "🚪 KAPAK AÇILIM ÇAKIŞMASI",
              detail: `#${i + 1} ${m1.name} ve #${j + 1} ${m2.name} kapak açılış yönleri birbirini engelliyor!`,
              x: Math.round((f1.x + f1.planWidth / 2 + f2.x + f2.planWidth / 2) / 2),
              z: Math.max(f1.z + f1.planDepth, f2.z + f2.planDepth) + 120,
              y: Math.max(m1.position.y, m2.position.y) + 450,
              w: 260,
              h: 260,
              modIdx: i,
            });
          }
        }
      }

      // Merge centralized EngineeringValidationFinding spatial anchors with human-readable Turkish titles (never raw ERR_* keys!)
      (unifiedEngineeringReport?.findings || []).forEach((ef) => {
        if (!ef.worldPositionMm) return;
        if (ef.severity !== "error" && ef.ruleNature !== "VERIFICATION_REQUIRED") return;
        const humanTitle = formatIssueHumanTitle(ef.code);
        const dup = alerts.some(
          (a) =>
            Math.abs(a.x - ef.worldPositionMm!.x) < 60 &&
            (a.id.includes(ef.code) || a.title === humanTitle)
        );
        if (dup) return;
        const mIdx = project.modules.findIndex((m) => m.id === ef.targetModuleId);
        alerts.push({
          id: `eng_spatial_${ef.code}_${ef.targetComponentId || ef.targetId || alerts.length}`,
          kind: ef.code.includes("SWING") ? "door_swing" : ef.code.includes("MEP") ? "plumbing" : "module_overlap",
          severity: ef.severity === "error" ? "error" : "warning",
          title: humanTitle,
          detail: ef.message,
          x: Math.round(ef.worldPositionMm.x),
          z: Math.round(ef.worldPositionMm.z),
          y: Math.round(ef.worldPositionMm.y),
          w: 220,
          h: 180,
          modIdx: mIdx >= 0 ? mIdx : undefined,
        });
      });

      settledSpatialAlertsRef.current = alerts;
      return alerts;
    }, [footprints, project.modules, spaceObstacles, spaceWalls, unifiedEngineeringReport, isStoreBatchDragging]);

    const handleDeleteSelectedObject = useCallback(() => {
      if (!selectedPlanObject) {
        if (selectedSceneObjectId) {
          removeSceneObject(selectedSceneObjectId);
          setSelectedSceneObjectId(null);
          return;
        }
        if (selectedModuleIds.length > 1) {
          batchRemoveSelectedModules();
        } else if (project.modules.length >= 1) {
          removeActiveModule();
        }
        return;
      }
      if (selectedPlanObject.kind === "wall") {
        if (spaceWalls.length <= 1) {
          setPlanRowSnapBanner("En az 1 ana duvar kalmalıdır");
          setTimeout(() => setPlanRowSnapBanner(null), 2200);
          return;
        }
        removeWallSegment(selectedPlanObject.id);
        setSelectedPlanObject(null);
      } else if (selectedPlanObject.kind === "obstacle") {
        removeSpaceObstacle(selectedPlanObject.id);
        setSelectedPlanObject(null);
      } else if (selectedPlanObject.kind === "module") {
        if (selectedModuleIds.length > 1) {
          batchRemoveSelectedModules();
        } else if (project.modules.length >= 1) {
          removeActiveModule();
        }
        setSelectedPlanObject(null);
      }
    }, [
      selectedPlanObject,
      selectedSceneObjectId,
      selectedModuleIds.length,
      project.modules.length,
      spaceWalls.length,
      removeSceneObject,
      setSelectedSceneObjectId,
      removeWallSegment,
      removeSpaceObstacle,
      batchRemoveSelectedModules,
      removeActiveModule,
    ]);

    // Global safety net: if user releases mouse outside SVG or window loses focus during 2D drag/resize,
    // always close batchStartProject so Undo/BOM never get stuck in an uncommitted transaction!
    useEffect(() => {
      const hasActive2DGesture =
        resizingPlanObject !== null ||
        draggingWallId !== null ||
        draggingObsId !== null ||
        draggingModIdx !== null ||
        elevResizingMod !== null ||
        elevDraggingObs !== null ||
        elevDraggingMod !== null ||
        interiorDrag !== null;
      if (!hasActive2DGesture) return;

      const finishGlobal2DGesture = () => {
        const livePlanDrag = planLiveSvgDragRef.current;
        if (livePlanDrag?.el) {
          if (livePlanDrag.baseTransform) {
            livePlanDrag.el.setAttribute("transform", livePlanDrag.baseTransform);
          } else {
            livePlanDrag.el.removeAttribute("transform");
          }
        }
        planLiveSvgDragRef.current = null;

        if (resizingPlanObject !== null) setResizingPlanObject(null);
        if (draggingWallId !== null) {
          if (livePlanDrag && livePlanDrag.kind === "wall" && livePlanDrag.hasMoved && livePlanDrag.targetId) {
            updateWallSegment(livePlanDrag.targetId, {
              position: { x: livePlanDrag.nextX, z: livePlanDrag.nextZ },
            });
          }
          setDraggingWallId(null);
        }
        if (draggingObsId !== null) {
          if (livePlanDrag && livePlanDrag.kind === "obstacle" && livePlanDrag.hasMoved && livePlanDrag.targetId) {
            updateObstaclePosition(livePlanDrag.targetId, livePlanDrag.nextX, livePlanDrag.nextZ);
          }
          setDraggingObsId(null);
        }
        if (draggingSceneObjId !== null) {
          if (livePlanDrag && livePlanDrag.kind === "scene_object" && livePlanDrag.hasMoved && livePlanDrag.targetId) {
            const curSo = (project.sceneObjects || []).find((o) => o.id === livePlanDrag.targetId);
            updateSceneObject(livePlanDrag.targetId, {
              position: { x: livePlanDrag.nextX, y: curSo?.position.y || 0, z: livePlanDrag.nextZ },
            });
          }
          setDraggingSceneObjId(null);
        }
        if (draggingModIdx !== null) {
          if (livePlanDrag && livePlanDrag.kind === "module" && livePlanDrag.hasMoved && typeof livePlanDrag.modIdx === "number") {
            setModulePosition(livePlanDrag.modIdx, livePlanDrag.nextX, livePlanDrag.nextZ, livePlanDrag.snapStepMm ?? 1);
          }
          setDraggingModIdx(null);
        }
        if (elevResizingMod !== null) setElevResizingMod(null); if (snapYGroupRef.current) snapYGroupRef.current.style.display = "none";
        if (elevDraggingObs !== null) setElevDraggingObs(null);
        if (elevDraggingMod !== null) {
          const preview = elevDragPreviewRef.current;
          const draggedMod = project.modules[elevDraggingMod.modIdx];
          if (draggedMod && preview && preview.modIdx === elevDraggingMod.modIdx) {
            setModulePosition(
              elevDraggingMod.modIdx,
              preview.x,
              draggedMod.position.z,
              1,
              preview.y
            );
          }
          elevDragPreviewRef.current = null;
          if (activeModGroupRef.current) activeModGroupRef.current.removeAttribute("transform");
          if (activeHaloGroupRef.current) activeHaloGroupRef.current.removeAttribute("transform");
          setElevDraggingMod(null);
        }
        if (interiorDrag !== null) {
          const liveInt = elevInteriorLiveRef.current;
          if (liveInt) {
            for (const item of liveInt.els) {
              if (item.baseTransform) item.el.setAttribute("transform", item.baseTransform);
              else item.el.removeAttribute("transform");
            }
            if (liveInt.hasMoved) {
              const dstModIdx =
                typeof liveInt.destModIdx === "number" ? liveInt.destModIdx : activeModuleIndex;
              const dstBayIdx =
                typeof liveInt.destBayIdx === "number" ? liveInt.destBayIdx : interiorDrag.bayIdx;
              if (dstModIdx !== activeModuleIndex || dstBayIdx !== interiorDrag.bayIdx) {
                let movedCross = false;
                const st2d = useConfiguratorStore.getState();
                st2d.applyBatchProjectUpdate((draft) => {
                  const srcBay = draft.modules[activeModuleIndex]?.bays[interiorDrag.bayIdx];
                  const dstBay = draft.modules[dstModIdx]?.bays[dstBayIdx];
                  if (!srcBay || !dstBay) return;
                  if (interiorDrag.kind === "shelf") {
                    const idx = srcBay.shelves.findIndex(
                      (s) => s.id === interiorDrag.targetId || interiorDrag.targetId.includes(s.id)
                    );
                    if (idx >= 0) {
                      const [mItem] = srcBay.shelves.splice(idx, 1);
                      mItem.elevationY = liveInt.snappedY;
                      dstBay.shelves.push(mItem);
                      movedCross = true;
                    }
                  } else if (interiorDrag.kind === "drawer") {
                    const idx = srcBay.drawers.findIndex(
                      (d) => d.id === interiorDrag.targetId || interiorDrag.targetId.includes(d.id)
                    );
                    if (idx >= 0) {
                      const [mItem] = srcBay.drawers.splice(idx, 1);
                      mItem.elevationY = liveInt.snappedY;
                      dstBay.drawers.push(mItem);
                      movedCross = true;
                    }
                  } else if (interiorDrag.kind === "rail") {
                    const idx = srcBay.hangingRails.findIndex(
                      (r) => r.id === interiorDrag.targetId || interiorDrag.targetId.includes(r.id)
                    );
                    if (idx >= 0) {
                      const [mItem] = srcBay.hangingRails.splice(idx, 1);
                      mItem.elevationY = liveInt.snappedY;
                      dstBay.hangingRails.push(mItem);
                      movedCross = true;
                    }
                  } else if (interiorDrag.kind === "special_fitting" && srcBay.specialFittings) {
                    const idx = srcBay.specialFittings.findIndex(
                      (f) => f.id === interiorDrag.targetId || interiorDrag.targetId.includes(f.id)
                    );
                    if (idx >= 0) {
                      const [mItem] = srcBay.specialFittings.splice(idx, 1);
                      mItem.elevationY = liveInt.snappedY;
                      if (!dstBay.specialFittings) dstBay.specialFittings = [];
                      dstBay.specialFittings.push(mItem);
                      movedCross = true;
                    }
                  }
                }, "İç eleman bölme değiştirildi");
                if (movedCross) {
                  if (dstModIdx !== activeModuleIndex) st2d.setActiveModuleIndex(dstModIdx);
                  st2d.setActiveBayIndex(dstBayIdx);
                }
              }
            }
            elevInteriorLiveRef.current = null;
          }
          setInteriorDrag(null);
        }
        elevInteriorLiveRef.current = null;
        lastInteriorCommitRef.current = "";
        lastModElevCommitRef.current = "";
        setActiveSnapTarget(null);
        setActivePlanSnapX(null);
        setActiveElevSnap(null);
        setPlanRowSnapBanner(null);
        commitHistoryTransaction();
      };

      window.addEventListener("pointerup", finishGlobal2DGesture);
      window.addEventListener("mouseup", finishGlobal2DGesture);
      window.addEventListener("blur", finishGlobal2DGesture);
      return () => {
        window.removeEventListener("pointerup", finishGlobal2DGesture);
        window.removeEventListener("mouseup", finishGlobal2DGesture);
        window.removeEventListener("blur", finishGlobal2DGesture);
      };
    }, [
      resizingPlanObject,
      draggingWallId,
      draggingObsId,
      draggingModIdx,
      elevResizingMod,
      elevDraggingObs,
      elevDraggingMod,
      interiorDrag,
      commitHistoryTransaction,
    ]);

    // Global keyboard shortcuts for Ctrl+Z, Ctrl+Y / Ctrl+Shift+Z, Delete/Backspace, and Escape across ALL 2D modes
    useEffect(() => {
      const onKeyDown = (ev: KeyboardEvent) => {
        const tag = (ev.target as HTMLElement | null)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

        if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "z") {
          ev.preventDefault();
          if (ev.shiftKey) {
            redo();
          } else {
            undo();
          }
          return;
        }
        if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "y") {
          ev.preventDefault();
          redo();
          return;
        }
        if (ev.key === "Escape" || ev.key === "Enter") {
          if (isDrawingWall || isPlacingObstacle) {
            ev.preventDefault();
            setDrawWallStart(null);
            setDrawWallCursor(null);
            setChainOriginPoint(null);
            setActiveSnapTarget(null);
            if (ev.key === "Escape") {
              setIsDrawingWall(false);
              setIsPlacingObstacle(false);
            }
            return;
          }
          if (ev.key === "Escape") {
            if (interiorDrag) {
              setInteriorDrag(null);
              setActiveElevSnap(null);
              commitHistoryTransaction();
              undo();
              return;
            }
            setSelectedComponentId(null);
            setSelectedPlanObject(null);
          }
          return;
        }
        if ((ev.key === "Delete" || ev.key === "Backspace") && mode === "plan" && interactivePlan) {
          if (selectedPlanObject || selectedSceneObjectId) {
            ev.preventDefault();
            handleDeleteSelectedObject();
          }
        }
        if ((ev.key === "m" || ev.key === "M") && mode === "plan" && interactivePlan && selectedPlanObject?.kind === "obstacle") {
          const curObs = spaceObstacles.find((o) => o.id === selectedPlanObject.id);
          if (curObs) {
            ev.preventDefault();
            if (ev.shiftKey && curObs.type === "door") {
              const nextSide = curObs.doorOpenSide === "outward" ? "inward" : "outward";
              updateSpaceObstacle(curObs.id, { doorOpenSide: nextSide });
              setPlanRowSnapBanner(`⇅ ${curObs.name} Açılım Tarafı Aynalandı: ${nextSide === "outward" ? "Dışa Açılır" : "İçe Açılır"}`);
            } else {
              const nextSwing = curObs.doorSwing === "right" ? "left" : "right";
              updateSpaceObstacle(curObs.id, { doorSwing: nextSwing });
              setPlanRowSnapBanner(`⇄ ${curObs.name} Yönü Aynalandı: ${nextSwing === "right" ? "Sağ Menteşe / Kanat" : "Sol Menteşe / Kanat"}`);
            }
            setTimeout(() => setPlanRowSnapBanner(null), 2400);
          }
        }
      };
      const onModifierKeyDown = (ev: KeyboardEvent) => {
        if (ev.key === "Control" || ev.key === "Meta") {
          setIsCtrlHeldElev(true);
        }
      };
      const onModifierKeyUp = (ev: KeyboardEvent) => {
        if (ev.key === "Control" || ev.key === "Meta") {
          setIsCtrlHeldElev(false);
        }
      };
      const onWindowBlur = () => setIsCtrlHeldElev(false);
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keydown", onModifierKeyDown);
      window.addEventListener("keyup", onModifierKeyUp);
      window.addEventListener("blur", onWindowBlur);
      return () => {
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keydown", onModifierKeyDown);
        window.removeEventListener("keyup", onModifierKeyUp);
        window.removeEventListener("blur", onWindowBlur);
      };
    }, [
      mode,
      interactivePlan,
      isDrawingWall,
      isPlacingObstacle,
      selectedPlanObject,
      interiorDrag,
      commitHistoryTransaction,
      undo,
      redo,
      handleDeleteSelectedObject,
    ]);

    // Compute all CAD snap candidates (wall inner-face endpoints, outer-corner joints, midpoints, underlay vertices, chain origin)
    const wallSnapCandidates = useMemo(() => {
      const pts: { x: number; z: number; label: string }[] = [
        { x: 0, z: 0, label: "Başlangıç (0,0)" },
      ];
      spaceWalls.forEach((w) => {
        const rad = ((w.rotationY || 0) * Math.PI) / 180;
        const t = w.thickness || 150;
        const x1 = w.position.x;
        const z1 = w.position.z;
        const x2 = Math.round(x1 + Math.cos(rad) * w.length);
        const z2 = Math.round(z1 + Math.sin(rad) * w.length);
        const xm = Math.round((x1 + x2) / 2);
        const zm = Math.round((z1 + z2) / 2);
        // Outer face normal is (sin(rad), -cos(rad)) since wall thickness extends in local -Y
        const nx = Math.sin(rad) * t;
        const nz = -Math.cos(rad) * t;
        pts.push({ x: x1, z: z1, label: `${w.name} Başlangıç (İç Yüz)` });
        pts.push({ x: x2, z: z2, label: `${w.name} Uç Nokta (İç Yüz)` });
        pts.push({
          x: Math.round(x1 + nx),
          z: Math.round(z1 + nz),
          label: `${w.name} Başlangıç (Dış Köşe)`,
        });
        pts.push({
          x: Math.round(x2 + nx),
          z: Math.round(z2 + nz),
          label: `${w.name} Uç Nokta (Dış Köşe)`,
        });
        pts.push({ x: xm, z: zm, label: `${w.name} Orta Nokta` });
      });
      if (chainOriginPoint) {
        pts.push({
          x: chainOriginPoint.x,
          z: chainOriginPoint.z,
          label: "Zincir Başlangıcı (Odayı Kapat)",
        });
      }
      const underlay = project.space.floorPlanUnderlay;
      if (underlay?.polylines) {
        underlay.polylines.forEach((pl, pIdx) => {
          pl.points.forEach((pt) => {
            pts.push({ x: pt.x, z: pt.z, label: `CAD Köşe #${pIdx + 1}` });
          });
        });
      }
      return pts;
    }, [spaceWalls, chainOriginPoint, project.space.floorPlanUnderlay]);


    // Listen for Plan Mode Tool Actions dispatched from Left Panel / Top Contextual Toolbar
    useEffect(() => {
      if (mode !== "plan" || !interactivePlan) return;
      const onPlanToolAction = (ev: Event) => {
        const detail = (ev as CustomEvent).detail || {};
        const act = detail.action;
        if (act === "select_mode") {
          setIsDrawingWall(false);
          setIsPlacingObstacle(false);
          setDrawWallStart(null);
          setDrawWallCursor(null);
          setChainOriginPoint(null);
        } else if (act === "draw_wall") {
          setIsDrawingWall(true);
          setIsPlacingObstacle(false);
          setDrawWallStart(null);
          setDrawWallCursor(null);
          setChainOriginPoint(null);
        } else if (act === "draw_room") {
          setIsDrawingWall(false);
          setIsPlacingObstacle(false);
          applyRoomShapePreset("rectangular");
        } else if (act === "place_obstacle") {
          const obsType = (detail.obstacleType || "column") as ArchitecturalElement["type"];
          setNewObstacleType(obsType);
          setIsDrawingWall(false);
          let defW = 900;
          let defH = 2100;
          let defY = 0;
          if (obsType === "window") {
            defW = 950;
            defH = 1100;
            defY = 1000;
          } else if (obsType === "door") {
            defW = 900;
            defH = 2100;
            defY = 0;
          } else if (obsType === "niche") {
            defW = 800;
            defH = 1200;
            defY = 600;
          } else if (obsType === "column") {
            defW = 250;
            defH = project.space.ceilingHeight || 2700;
            defY = 0;
          } else if (obsType === "beam") {
            defW = 300;
            defH = 300;
            defY = (project.space.ceilingHeight || 2700) - 300;
          } else if (obsType === "protrusion") {
            defW = 400;
            defH = project.space.ceilingHeight || 2700;
            defY = 0;
          } else if (obsType === "partition") {
            defW = 120;
            defH = project.space.ceilingHeight || 2700;
            defY = 0;
          }
          setNewObstacleW(defW);
          setNewObstacleH(defH);
          setNewObstacleY(defY);
          if (detail.immediate) {
            const typeLabelsMap: Record<ArchitecturalElement["type"], string> = {
              column: "Taşıyıcı Kolon",
              window: "Pencere",
              door: "Oda Kapısı",
              beam: "Tavan Kirişi",
              plumbing: "Tesisat Noktası",
              electrical: "Elektrik Noktası",
              gas_valve: "Doğalgaz Vanası",
              flue_duct: "Baca / Davlumbaz Kanalı",
              radiator: "Radyatör / Petek",
              baseboard: "Süpürgelik",
              ventilation: "Havalandırma Kanalı",
              niche: "Duvar Nişi",
              protrusion: "Duvar Çıkıntısı",
              partition: "Bölme Duvar",
            };
            const activeTargetWall =
              spaceWalls.find((w) => w.id === (storeActiveWallId || obstacleTargetWallId)) ||
              spaceWalls[0];
            const wallRot = activeTargetWall
              ? (((activeTargetWall.rotationY || 0) % 360) + 360) % 360
              : 0;
            const wallRad = (wallRot * Math.PI) / 180;
            const dirX = Math.cos(wallRad);
            const dirZ = Math.sin(wallRad);
            let alongWall = 300;
            if (activeTargetWall) {
              const maxStart = Math.max(0, activeTargetWall.length - defW);
              const existingAlong: Array<[number, number]> = [];
              for (const ex of spaceObstacles) {
                const exRot = (((ex.rotationY || 0) % 360) + 360) % 360;
                const rDiff = Math.min(Math.abs(exRot - wallRot), 360 - Math.abs(exRot - wallRot));
                if (rDiff > 12) continue;
                const rx = ex.position.x - activeTargetWall.position.x;
                const rz = ex.position.z - activeTargetWall.position.z;
                const al = rx * dirX + rz * dirZ;
                const pp = Math.abs(-rx * dirZ + rz * dirX);
                if (pp <= 220) existingAlong.push([al, al + (ex.dimensions.width || 300)]);
              }
              existingAlong.sort((a, b) => a[0] - b[0]);
              let cursor = 200;
              for (const [s, e] of existingAlong) {
                if (cursor + defW + 80 <= s) break;
                cursor = Math.max(cursor, e + 120);
              }
              alongWall = Math.max(0, Math.min(maxStart, Math.round(cursor / 50) * 50));
            }
            const posX =
              typeof detail.x === "number"
                ? detail.x
                : activeTargetWall
                ? Math.round(activeTargetWall.position.x + dirX * alongWall)
                : Math.min(2400, 400 + spaceObstacles.length * 450);
            const posZ =
              typeof detail.z === "number"
                ? detail.z
                : obsType === "partition" && !activeTargetWall
                ? 600
                : activeTargetWall
                ? Math.round(activeTargetWall.position.z + dirZ * alongWall)
                : 0;
            const createdId = addSpaceObstacle({
              type: obsType,
              name: `${typeLabelsMap[obsType]}`,
              rotationY: wallRot,
              doorSwing: "left",
              doorOpenSide: "inward",
              position: { x: posX, y: defY, z: posZ },
              dimensions: {
                width: defW,
                height: defH,
                depth: obsType === "partition" ? 1200 : obsType === "column" || obsType === "beam" || obsType === "protrusion" ? 250 : 150,
              },
            });
            setSelectedPlanObject({ kind: "obstacle", id: createdId });
            setIsPlacingObstacle(false);
          } else {
            setIsPlacingObstacle(true);
          }
        } else if (act === "open_dxf_upload") {
          floorPlanInputRef.current?.click();
        } else if (act === "toggle_grid") {
          setShowPlanGrid((v) => !v);
        } else if (act === "toggle_snaps") {
          setMagnetEnabled((v) => !v);
        } else if (act === "toggle_dimensions") {
          setShowPlanDimensions((v) => (typeof detail.value === "boolean" ? detail.value : !v));
        } else if (act === "set_wall_dim_mode") {
          if (detail.mode) setWallDimDisplayMode(detail.mode);
        } else if (act === "set_scale") {
          const sc = detail.scaleRatio as 20 | 25 | 50;
          if (sc === 20 || sc === 25 || sc === 50) {
            setPlanScaleRatio(sc);
            setZoom(sc === 20 ? 1.25 : sc === 25 ? 1.0 : 0.65);
          }
        } else if (act === "zoom_in") {
          setZoom((z) => Math.min(3.5, +(z + 0.15).toFixed(2)));
        } else if (act === "zoom_out") {
          setZoom((z) => Math.max(0.4, +(z - 0.15).toFixed(2)));
        } else if (act === "zoom_fit") {
          setZoom(1);
          setPanPx({ x: 0, y: 0 });
        } else if (act === "offset_wall") {
          const delta = typeof detail.offsetMm === "number" ? detail.offsetMm : 100;
          const targetW = spaceWalls[0];
          if (targetW) {
            updateWallSegment(targetW.id, { length: Math.max(800, targetW.length + delta) });
          }
        } else if (act === "toggle_cad_bar") {
          setShowAdvancedCadBar((v) => !v);
        }
      };
      window.addEventListener("birim:plan-tool-action", onPlanToolAction);
      return () => window.removeEventListener("birim:plan-tool-action", onPlanToolAction);
    }, [
      mode,
      interactivePlan,
      applyRoomShapePreset,
      project.space.ceilingHeight,
      spaceObstacles.length,
      addSpaceObstacle,
      spaceObstacles,
      spaceWalls,
      storeActiveWallId,
      obstacleTargetWallId,
      updateWallSegment,
    ]);

    // V25 FIX: Hoisted elevation/material drop hooks above all early returns (`!activeModule` & `mode === 'plan'`)
    const [liveAccessoryGhost2D, setLiveAccessoryGhost2D] = useState<{
      visual: string;
      id: string;
      title: string;
      bayIndex: number;
      baySvgX: number;
      bayWidth: number;
      carcassT: number;
      plinthH: number;
      modY: number;
      elevationY: number;
      offsetX: number;
      subBotY?: number;
      subSpanH?: number;
    } | null>(null);
    const elevContainerRef = useRef<HTMLDivElement | null>(null);
    const elevDropRuntimeRef = useRef<{
      vb: { x: number; y: number; width: number; height: number };
      roomOffX: number;
      roomOffY: number;
      roomModH: number;
      mod: typeof activeModule | undefined;
      addInteriorItemAtElevation: typeof addInteriorItemAtElevation;
    } | null>(null);

    const resolveAccessoryDropTarget2D = useCallback(
      (
        clientX: number,
        clientY: number,
        accObj: { id: string; title?: string; visual?: string }
      ) => {
        const ctx = elevDropRuntimeRef.current;
        const container = elevContainerRef.current;
        if (!ctx || !ctx.mod || !container) return null;
        const svgEl = (container.querySelector("svg[data-birim-elev-svg=\"true\"]") || container.querySelector("svg")) as SVGSVGElement | null;
        const rect = (svgEl || container).getBoundingClientRect();
        if (
          clientX < rect.left ||
          clientX > rect.right ||
          clientY < rect.top ||
          clientY > rect.bottom
        ) {
          return null;
        }
        let svgX: number;
        let svgY: number;
        const ctm = svgEl?.getScreenCTM?.();
        if (svgEl && ctm) {
          const pt = svgEl.createSVGPoint();
          pt.x = clientX;
          pt.y = clientY;
          const svgPt = pt.matrixTransform(ctm.inverse());
          svgX = svgPt.x;
          svgY = svgPt.y;
        } else {
          const relX = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
          const relY = Math.max(0, Math.min(1, (clientY - rect.top) / Math.max(1, rect.height)));
          svgX = ctx.vb.x + relX * ctx.vb.width;
          svgY = ctx.vb.y + relY * ctx.vb.height;
        }

        const mod = ctx.mod;
        const carcassT = mod.carcass?.panelThickness || 18;
        const plinthH = mod.carcass?.plinthHeight ?? 100;
        const netH = calculateNetInnerHeight(mod);
        const bayWidths = calculateBayWidths(mod);

        const modSvgX = (mod.position?.x || 0) - ctx.roomOffX;
        const localX = svgX - modSvgX;
        // V86: Do not preview or snap inside Bay 0 while cursor is still outside the cabinet horizontally!
        if (localX < -24 || localX > mod.dimensions.width + 24) {
          return null;
        }
        let targetBayIdx = localX > mod.dimensions.width * 0.5 ? Math.max(0, bayWidths.length - 1) : 0;
        let accX = carcassT;
        let bayStartX = carcassT;
        let curBayWidth = bayWidths[targetBayIdx] || 500;
        for (let i = 0; i < bayWidths.length; i++) {
          const bw = bayWidths[i];
          const isFirst = i === 0;
          const isLast = i === bayWidths.length - 1;
          const leftBound = isFirst ? -24 : accX - carcassT * 0.5;
          const rightBound = isLast ? mod.dimensions.width + 24 : accX + bw + carcassT * 0.5;
          if (localX >= leftBound && localX <= rightBound) {
            targetBayIdx = i;
            bayStartX = accX;
            curBayWidth = bw;
            break;
          }
          accX += bw + carcassT;
        }
        targetBayIdx = Math.max(0, Math.min(mod.bays.length - 1, targetBayIdx));
        const localBayX = Math.max(
          48,
          Math.min(curBayWidth - 48, Math.round((localX - bayStartX) / 10) * 10)
        );

        const floorSvgY = ctx.roomModH + ctx.roomOffY;
        const rawY = floorSvgY - (mod.position?.y || 0) - plinthH - carcassT - svgY;
        const snappedElevY = Math.max(64, Math.min(netH - 64, Math.round(rawY / 32) * 32));
        return {
          bayIndex: targetBayIdx,
          elevationY: snappedElevY,
          offsetX: localBayX,
          baySvgX: modSvgX + bayStartX,
          bayWidth: curBayWidth,
          plinthH,
          accessory: accObj,
          mod,
          netH,
          carcassT,
        };
      },
      []
    );

    const commitAccessoryDrop2D = useCallback(
      (
        dropInfo: {
          bayIndex: number;
          elevationY: number;
          offsetX?: number;
          accessory: { id: string; title?: string; visual?: string };
        },
        modBefore?: typeof activeModule
      ) => {
        const ctx = elevDropRuntimeRef.current;
        if (!ctx) return;
        const acc = dropInfo.accessory;
        const bayIdx = dropInfo.bayIndex;
        const elevY = dropInfo.elevationY;
        const targetMod = modBefore || ctx.mod;
        const bayBefore = targetMod?.bays[bayIdx];
        const isSubDivDrop =
          acc.id === "lib_sub_divider" ||
          acc.id === "sub_divider" ||
          acc.visual === "sub_divider";
        if (isSubDivDrop && targetMod && bayBefore) {
          const ivs = getBayShelfIntervalsForSubDivider(
            bayBefore,
            calculateNetInnerHeight(targetMod),
            targetMod.carcass.panelThickness || 18
          );
          const freeIvs = ivs.filter((iv) => !iv.hasConflict);
          if (freeIvs.length === 0) {
            setPlanRowSnapBanner(
              `⛔ Bölme ${bayIdx + 1} içinde Askılık/Çekmece var ve boş raf aralığı yok! Önce raf ekleyin veya askılığı kaldırın.`
            );
            setTimeout(() => setPlanRowSnapBanner(null), 4200);
            lastAccessoryDropTarget2DRef.current = null;
            return;
          }
        }
        ctx.addInteriorItemAtElevation(bayIdx, acc.id, elevY, { offsetX: dropInfo.offsetX });
        setPlanRowSnapBanner(`✓ ${acc.title || "Parça"} yerleştirildi: Bölme ${bayIdx + 1}`);
        setTimeout(() => setPlanRowSnapBanner(null), 3500);
        lastAccessoryDropTarget2DRef.current = null;
      },
      []
    );

    useEffect(() => {
      if (mode !== "elevation") return;
      const onLiveMove = (ev: Event) => {
        const detail = (ev as CustomEvent<{
          id: string;
          title: string;
          visual: string;
          clientX: number;
          clientY: number;
        }>).detail;
        if (!detail) return;
        const res = resolveAccessoryDropTarget2D(detail.clientX, detail.clientY, {
          id: detail.id,
          title: detail.title,
          visual: detail.visual,
        });
        if (!res) {
          lastAccessoryDropTarget2DRef.current = null;
          setLiveAccessoryGhost2D(null);
          window.dispatchEvent(new CustomEvent("birim:live-part-snapped-in-bay", { detail: { active: false } }));
          setPlanRowSnapBanner(null);
          return;
        }
        window.dispatchEvent(new CustomEvent("birim:live-part-snapped-in-bay", { detail: { active: true } }));
        const isSubDivAcc =
          detail.id === "lib_sub_divider" ||
          detail.id === "sub_divider" ||
          detail.visual === "sub_divider";
        if (isSubDivAcc && res.mod.bays[res.bayIndex]) {
          const ivs = getBayShelfIntervalsForSubDivider(
            res.mod.bays[res.bayIndex],
            res.netH,
            res.carcassT
          );
          const hoveredIv = ivs.find(
            (iv) => res.elevationY >= iv.botY && res.elevationY <= iv.topY
          );
          const freeIvs = ivs.filter((iv) => !iv.hasConflict);
          const chosenIv =
            (hoveredIv && !hoveredIv.hasConflict ? hoveredIv : null) ||
            (freeIvs.length > 0
              ? freeIvs.reduce((best, iv) =>
                  Math.abs((iv.botY + iv.topY) / 2 - res.elevationY) <
                  Math.abs((best.botY + best.topY) / 2 - res.elevationY)
                    ? iv
                    : best
                )
              : hoveredIv);
          if (chosenIv) {
            const subMidY = Math.round((chosenIv.botY + chosenIv.topY) / 2);
            lastAccessoryDropTarget2DRef.current = {
              bayIndex: res.bayIndex,
              elevationY: subMidY,
              offsetX: res.offsetX,
              accessory: res.accessory,
            };
            setLiveAccessoryGhost2D({
              visual: detail.visual || "sub_divider",
              id: detail.id,
              title: detail.title || "Raf Arası Dikme",
              bayIndex: res.bayIndex,
              baySvgX: res.baySvgX,
              bayWidth: res.bayWidth,
              carcassT: res.carcassT,
              plinthH: res.plinthH,
              modY: res.mod.position?.y || 0,
              elevationY: subMidY,
              offsetX: res.offsetX,
              subBotY: chosenIv.botY,
              subSpanH: Math.max(80, chosenIv.height),
            });
            setPlanRowSnapBanner(
              hoveredIv?.hasConflict
                ? `⚠️ Bu aralıkta ${hoveredIv.conflictReason}! Boş raf aralığına (${chosenIv.label}) hizalandı • X: ${res.offsetX}mm`
                : `📐 Raf Arası Dikme • Bölme ${res.bayIndex + 1} (${chosenIv.label}) • X: ${res.offsetX}mm`
            );
            return;
          }
        }
        lastAccessoryDropTarget2DRef.current = {
          bayIndex: res.bayIndex,
          elevationY: res.elevationY,
          offsetX: res.offsetX,
          accessory: res.accessory,
        };
        setLiveAccessoryGhost2D({
          visual: detail.visual || "shelf",
          id: detail.id,
          title: detail.title || "Parça",
          bayIndex: res.bayIndex,
          baySvgX: res.baySvgX,
          bayWidth: res.bayWidth,
          carcassT: res.carcassT,
          plinthH: res.plinthH,
          modY: res.mod.position?.y || 0,
          elevationY: res.elevationY,
          offsetX: res.offsetX,
        });
        setPlanRowSnapBanner(
          `📐 ${detail.title || "Parça"} • Bölme ${res.bayIndex + 1} • Y: ${res.elevationY} mm`
        );
      };

      const onLiveDrop = (ev: Event) => {
        if ((ev as unknown as { __birimLivePartDropHandled?: boolean }).__birimLivePartDropHandled) return;
        const detail = (ev as CustomEvent<{
          id: string;
          title: string;
          visual: string;
          clientX: number;
          clientY: number;
        }>).detail;
        setLiveAccessoryGhost2D(null);
        if (!detail) return;
        const res = resolveAccessoryDropTarget2D(detail.clientX, detail.clientY, {
          id: detail.id,
          title: detail.title,
          visual: detail.visual,
        });
        lastAccessoryDropTarget2DRef.current = null;
        if (!res) return;
        (ev as unknown as { __birimLivePartDropHandled?: boolean }).__birimLivePartDropHandled = true;
        commitAccessoryDrop2D(
          {
            bayIndex: res.bayIndex,
            elevationY: res.elevationY,
            offsetX: res.offsetX,
            accessory: res.accessory,
          },
          res.mod
        );
      };

      const onLiveCancel = () => {
        lastAccessoryDropTarget2DRef.current = null;
        setLiveAccessoryGhost2D(null);
        setPlanRowSnapBanner(null);
      };

      window.addEventListener("birim:live-3d-part-move", onLiveMove);
      window.addEventListener("birim:live-3d-part-drop", onLiveDrop);
      window.addEventListener("birim:live-3d-part-cancel", onLiveCancel);
      return () => {
        window.removeEventListener("birim:live-3d-part-move", onLiveMove);
        window.removeEventListener("birim:live-3d-part-drop", onLiveDrop);
        window.removeEventListener("birim:live-3d-part-cancel", onLiveCancel);
      };
    }, [mode, resolveAccessoryDropTarget2D, commitAccessoryDrop2D]);

    useEffect(() => {
      const onMaterialDrop2D = (ev: Event) => {
        const detail = (
          ev as CustomEvent<{ materialId: string; materialName?: string; clientX: number; clientY: number }>
        ).detail;
        if (!detail?.materialId || typeof document === "undefined") return;
        const container = elevContainerRef.current;
        if (container) {
          const r = container.getBoundingClientRect();
          if (
            detail.clientX < r.left ||
            detail.clientX > r.right ||
            detail.clientY < r.top ||
            detail.clientY > r.bottom
          ) {
            return;
          }
        }
        const els = document.elementsFromPoint(detail.clientX, detail.clientY);
        for (const el of els) {
          const tid = el.closest("[data-testid]")?.getAttribute("data-testid") || "";
          if (tid.startsWith("cad-el-")) {
            const compId = tid.slice("cad-el-".length);
            applyMaterialToSimilarComponents(detail.materialId, compId, "single");
            setPlanRowSnapBanner(`✓ Malzeme atandı: ${detail.materialName || detail.materialId}`);
            setTimeout(() => setPlanRowSnapBanner(null), 2400);
            return;
          }
          if (tid.startsWith("elev-scene-object-") || tid.startsWith("plan-scene-object-")) {
            const soId = tid.replace(/^elev-scene-object-|^plan-scene-object-/, "");
            (updateSceneObject as (id: string, p: Record<string, unknown>) => void)(soId, {
              materialId: detail.materialId,
            });
            setPlanRowSnapBanner(`✓ Malzeme atandı: ${detail.materialName || detail.materialId}`);
            setTimeout(() => setPlanRowSnapBanner(null), 2400);
            return;
          }
        }
      };
      window.addEventListener("birim:live-material-drop", onMaterialDrop2D);
      return () => window.removeEventListener("birim:live-material-drop", onMaterialDrop2D);
    }, [applyMaterialToSimilarComponents, updateSceneObject]);

    if (!activeModule) return null;

    // Multi-module architectural room plan mode
    if (mode === "plan" && interactivePlan) {
      return <CadInteractivePlan2DView activeModuleIndex={activeModuleIndex} activePlanSnapX={activePlanSnapX} activeSnapTarget={activeSnapTarget} activeSpatialAlertIdx={activeSpatialAlertIdx} activeSpatialMetrics={activeSpatialMetrics} addAdjacentModule={addAdjacentModule} addSpaceObstacle={addSpaceObstacle} addStackedTopModule={addStackedTopModule} addWallSegment={addWallSegment} batchMoveSelectedModules={batchMoveSelectedModules} beginHistoryTransaction={beginHistoryTransaction} cadContextMenu={cadContextMenu} cadDrawerTab={cadDrawerTab} cadTextScale={cadTextScale} chainOriginPoint={chainOriginPoint} clearModuleSelection={clearModuleSelection} commitHistoryTransaction={commitHistoryTransaction} dragGhostPreview={dragGhostPreview} dragStartClient={dragStartClient} draggingModIdx={draggingModIdx} draggingObsId={draggingObsId} draggingSceneObjId={draggingSceneObjId} draggingWallId={draggingWallId} drawWallCursor={drawWallCursor} drawWallStart={drawWallStart} dropV4TemplateWithSnap={dropV4TemplateWithSnap} duplicateActiveModule={duplicateActiveModule} duplicateSceneObject={duplicateSceneObject} elevDisplayUnit={elevDisplayUnit} errorModuleIds={errorModuleIds} floorPlanInputRef={floorPlanInputRef} fmtPlanDim={fmtPlanDim} footprints={footprints} handleChangeElevDisplayUnit={handleChangeElevDisplayUnit} handleDeleteSelectedObject={handleDeleteSelectedObject} handleWheelZoom={handleWheelZoom} importWallsFromUnderlay={importWallsFromUnderlay} inlineEditWallId={inlineEditWallId} inlineEditWallLength={inlineEditWallLength} isDrawingWall={isDrawingWall} isPlacingObstacle={isPlacingObstacle} lastPointerMoveTsRef={lastPointerMoveTsRef} liveObsSnappedRotRef={liveObsSnappedRotRef} liveSpatialAlerts={liveSpatialAlerts} lockedPlanVbRef={lockedPlanVbRef} longPress2DRef={longPress2DRef} magnetEnabled={magnetEnabled} moduleCadMetrics={moduleCadMetrics} newObstacleH={newObstacleH} newObstacleRotY={newObstacleRotY} newObstacleType={newObstacleType} newObstacleW={newObstacleW} newObstacleX={newObstacleX} newObstacleY={newObstacleY} newObstacleZ={newObstacleZ} obsDragStart={obsDragStart} obstaclePreviewPos={obstaclePreviewPos} obstacleTargetWallId={obstacleTargetWallId} panPx={panPx} panPxRef={panPxRef} panning2D={panning2D} pinchTrackerRef={pinchTrackerRef} planLiveSvgDragRef={planLiveSvgDragRef} planRowSnapBanner={planRowSnapBanner} planScaleRatio={planScaleRatio} planSnapBannerTextRef={planSnapBannerTextRef} planSnapBannerWrapRef={planSnapBannerWrapRef} printActive2DCadSheet={printActive2DCadSheet} project={project} redo={redo} removeActiveModule={removeActiveModule} removeSceneObject={removeSceneObject} removeSpaceObstacle={removeSpaceObstacle} removeWallSegment={removeWallSegment} resizeModuleParametric={resizeModuleParametric} resizingPlanObject={resizingPlanObject} rotateActiveModule90={rotateActiveModule90} sceneObjDragStart={sceneObjDragStart} selectAllModules={selectAllModules} selectedModuleIds={selectedModuleIds} selectedPlanObject={selectedPlanObject} selectedSceneObjectId={selectedSceneObjectId} setActiveModuleIndex={setActiveModuleIndex} setActivePlanSnapX={setActivePlanSnapX} setActiveSnapTarget={setActiveSnapTarget} setActiveSpatialAlertIdx={setActiveSpatialAlertIdx} setCadContextMenu={setCadContextMenu} setCadDrawerTab={setCadDrawerTab} setChainOriginPoint={setChainOriginPoint} setDragGhostPreview={setDragGhostPreview} setDragStartClient={setDragStartClient} setDraggingModIdx={setDraggingModIdx} setDraggingObsId={setDraggingObsId} setDraggingSceneObjId={setDraggingSceneObjId} setDraggingWallId={setDraggingWallId} setDrawWallCursor={setDrawWallCursor} setDrawWallStart={setDrawWallStart} setFloorPlanUnderlay={setFloorPlanUnderlay} setInlineEditWallId={setInlineEditWallId} setInlineEditWallLength={setInlineEditWallLength} setIsDrawingWall={setIsDrawingWall} setIsPlacingObstacle={setIsPlacingObstacle} setMagnetEnabled={setMagnetEnabled} setModulePosition={setModulePosition} setNewObstacleH={setNewObstacleH} setNewObstacleRotY={setNewObstacleRotY} setNewObstacleType={setNewObstacleType} setNewObstacleW={setNewObstacleW} setNewObstacleX={setNewObstacleX} setNewObstacleY={setNewObstacleY} setNewObstacleZ={setNewObstacleZ} setObsDragStart={setObsDragStart} setObstaclePreviewPos={setObstaclePreviewPos} setObstacleTargetWallId={setObstacleTargetWallId} setPanPx={setPanPx} setPanning2D={setPanning2D} setPlanRowSnapBanner={setPlanRowSnapBanner} setPlanScaleRatio={setPlanScaleRatio} setResizingPlanObject={setResizingPlanObject} setRoomDimensions={setRoomDimensions} setSceneObjDragStart={setSceneObjDragStart} setSelectedPlanObject={setSelectedPlanObject} setSelectedSceneObjectId={setSelectedSceneObjectId} setShowAdvancedCadBar={setShowAdvancedCadBar} setShowPlanDimensions={setShowPlanDimensions} setShowWallCoordsInPill={setShowWallCoordsInPill} setSpatialAlertsMinimized={setSpatialAlertsMinimized} setStoreActiveWallId={setStoreActiveWallId} setWallDimDisplayMode={setWallDimDisplayMode} setWallDragStart={setWallDragStart} setZoom={setZoom} showAdvancedCadBar={showAdvancedCadBar} showPlanDimensions={showPlanDimensions} showPlanGrid={showPlanGrid} showWallCoordsInPill={showWallCoordsInPill} snapModuleToAngledWall={snapModuleToAngledWall} spaceObstacles={spaceObstacles} spaceWalls={spaceWalls} spatialAlertsMinimized={spatialAlertsMinimized} storeActiveWallId={storeActiveWallId} swapModuleWithNeighbor={swapModuleWithNeighbor} toggleModuleSelection={toggleModuleSelection} undo={undo} updateObstaclePosition={updateObstaclePosition} updateSceneObject={updateSceneObject} updateSpaceObstacle={updateSpaceObstacle} updateWallSegment={updateWallSegment} wallDimDisplayMode={wallDimDisplayMode} wallDragStart={wallDragStart} wallSnapCandidates={wallSnapCandidates} zoom={zoom} zoomRef={zoomRef} />;
    }
    return <CadElevationAndSection2DView activeBayIndex={activeBayIndex} activeElevSnap={activeElevSnap} activeHaloGroupRef={activeHaloGroupRef} activeModGroupRef={activeModGroupRef} activeModule={activeModule} activeModule2DData={activeModule2DData} activeModuleBreakdown={activeModuleBreakdown} activeModuleIndex={activeModuleIndex} addDrawer={addDrawer} addFixedShelf={addFixedShelf} addHangingRail={addHangingRail} addInteriorItemAtElevation={addInteriorItemAtElevation} addInternalDrawer={addInternalDrawer} addShelf={addShelf} addStackedTopModule={addStackedTopModule} applyMaterialToSimilarComponents={applyMaterialToSimilarComponents} beginHistoryTransaction={beginHistoryTransaction} cadContextMenu={cadContextMenu} canvasFontScale={canvasFontScale} commitHistoryTransaction={commitHistoryTransaction} dragGhostPreview={dragGhostPreview} dropV4TemplateWithSnap={dropV4TemplateWithSnap} duplicateActiveModule={duplicateActiveModule} duplicateSceneObject={duplicateSceneObject} effectiveInteriorMoveMode={effectiveInteriorMoveMode} effectiveShowAllDims={effectiveShowAllDims} elevContainerRef={elevContainerRef} elevCoordMode={elevCoordMode} elevDetailLevel={elevDetailLevel} elevDisplayUnit={elevDisplayUnit} elevDragPreviewRef={elevDragPreviewRef} elevDraggingMod={elevDraggingMod} elevDraggingObs={elevDraggingObs} elevDraggingSceneObj={elevDraggingSceneObj} elevDropRuntimeRef={elevDropRuntimeRef} elevInteriorLiveRef={elevInteriorLiveRef} elevPanMode={elevPanMode} elevResizingMod={elevResizingMod} elevSnapBannerDomRef={elevSnapBannerDomRef} elevVbZoomRef={elevVbZoomRef} equalizeBaysAndShelves={equalizeBaysAndShelves} finishModuleDragWithSmartSwap={finishModuleDragWithSmartSwap} getElevScaleMmPerPx={getElevScaleMmPerPx} grainContinuityMap2D={grainContinuityMap2D} handleChangeElevDetailLevel={handleChangeElevDetailLevel} handleChangeElevDisplayUnit={handleChangeElevDisplayUnit} handleWheelZoom={handleWheelZoom} hideLegacySectionBar={hideLegacySectionBar} hoveredElevationItem={hoveredElevationItem} hoveredHeightHandle={hoveredHeightHandle} interiorDrag={interiorDrag} interiorSnapTargetsRef={interiorSnapTargetsRef} isCtrlHeldElev={isCtrlHeldElev} lastAccessoryDropTarget2DRef={lastAccessoryDropTarget2DRef} lastDividerCommitValRef={lastDividerCommitValRef} lastInteriorCommitRef={lastInteriorCommitRef} lastModElevCommitRef={lastModElevCommitRef} lastPointerMoveTsRef={lastPointerMoveTsRef} liveAccessoryGhost2D={liveAccessoryGhost2D} liveSpatialAlerts={liveSpatialAlerts} lockedElevModIdRef={lockedElevModIdRef} lockedElevOriginRef={lockedElevOriginRef} lockedElevVbRef={lockedElevVbRef} longPress2DRef={longPress2DRef} magnetEnabled={magnetEnabled} mode={mode} panPx={panPx} panPxRef={panPxRef} panning2D={panning2D} pinchTrackerRef={pinchTrackerRef} planRowSnapBanner={planRowSnapBanner} printActive2DCadSheet={printActive2DCadSheet} project={project} removeActiveModule={removeActiveModule} removeSceneObject={removeSceneObject} removeSelectedInteriorComponent={removeSelectedInteriorComponent} removeSpaceObstacle={removeSpaceObstacle} resizeModuleParametric={resizeModuleParametric} sectionCutCoordMm={sectionCutCoordMm} sectionCutRatio2D={sectionCutRatio2D} sectionDirection2D={sectionDirection2D} selectedComponentId={selectedComponentId} selectedPlanObject={selectedPlanObject} selectedSceneObjectId={selectedSceneObjectId} setActiveBayIndex={setActiveBayIndex} setActiveElevSnap={setActiveElevSnap} setActiveModuleIndex={setActiveModuleIndex} setBayCustomWidth={setBayCustomWidth} setCadContextMenu={setCadContextMenu} setDragGhostPreview={setDragGhostPreview} setDrawerPlacement={setDrawerPlacement} setElevCoordMode={setElevCoordMode} setElevDraggingMod={setElevDraggingMod} setElevDraggingObs={setElevDraggingObs} setElevDraggingSceneObj={setElevDraggingSceneObj} setElevInteriorMoveMode={setElevInteriorMoveMode} setElevPanMode={setElevPanMode} setElevResizingMod={setElevResizingMod} setFacadeGrainContinuity={setFacadeGrainContinuity} setHangingRailElevation={setHangingRailElevation} setHoveredElevationItem={setHoveredElevationItem} setHoveredHeightHandle={setHoveredHeightHandle} setInteriorDrag={setInteriorDrag} setModuleOffsetFromLeftWall={setModuleOffsetFromLeftWall} setModulePosition={setModulePosition} setPanPx={setPanPx} setPanning2D={setPanning2D} setPlanRowSnapBanner={setPlanRowSnapBanner} setRoomDimensions={setRoomDimensions} setSectionCutRatio2D={setSectionCutRatio2D} setSectionDirection2D={setSectionDirection2D} setSelectedComponentId={setSelectedComponentId} setSelectedPlanObject={setSelectedPlanObject} setSelectedSceneObjectId={setSelectedSceneObjectId} setShelfElevation={setShelfElevation} setShelfMountType={setShelfMountType} setShelfThickness={setShelfThickness} setShowAllDimensions={setShowAllDimensions} setShowDoorsIn2D={setShowDoorsIn2D} setShowRoomContextInElev={setShowRoomContextInElev} setSpecialFittingPlacement={setSpecialFittingPlacement} setSubDividerPlacement={setSubDividerPlacement} setZoom={setZoom} showDoorsIn2D={showDoorsIn2D} showRoomContextInElev={showRoomContextInElev} snapXBadgeRef={snapXBadgeRef} snapXCircleRef={snapXCircleRef} snapXGroupRef={snapXGroupRef} snapXLineRef={snapXLineRef} snapXTextRef={snapXTextRef} snapYBadgeRef={snapYBadgeRef} snapYGroupRef={snapYGroupRef} snapYLineRef={snapYLineRef} snapYTextRef={snapYTextRef} spaceObstacles={spaceObstacles} spaceWalls={spaceWalls} splitBayIntoTwo={splitBayIntoTwo} studioSafeInsets={studioSafeInsets} swapModuleWithNeighbor={swapModuleWithNeighbor} updateCarcassConfig={updateCarcassConfig} updateCeilingConfig={updateCeilingConfig} updateObstaclePosition={updateObstaclePosition} updateSceneObject={updateSceneObject} updateSpaceObstacle={updateSpaceObstacle} zoom={zoom} zoomRef={zoomRef} />;
  }
);

V3CadViewport2D.displayName = "V3CadViewport2D";
export default V3CadViewport2D;
