"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  ArchitecturalElement,
  parseCadDxfText,
  parsePdfFloorPlanMetadata,
  calculateNetInnerHeight,
  calculateBayWidths,
  calculateFourSpaceDimensions,
  inferDoorSystemIdFromType,
  getModuleFrontSweepBounds,
} from "@birim/core";
import {
  useV3Adapter,
  generateModuleGeometry,
  generateElevation2D,
  generateTopPlan2D,
  generateCrossSection2D,
  getModuleOrientedFootprint,
  classifyModuleCornerFootprint,
  getActiveDraggedTemplateId,
  setActiveDraggedTemplateId,
  computeRowSnapPreview,
  getBayShelfIntervalsForSubDivider,
  type RowSnapPreviewResult,
} from "../adapter/useV3Adapter";
import {
  computeElevationSnapTargets,
  resolveElevationSnap,
  findDraggableInteriorComponent,
  ElevationSnapTarget,
} from "../engine/elevationSnapEngine";

export interface V3CadViewport2DProps {
  mode: "elevation" | "plan" | "section";
  interactivePlan?: boolean;
  snapMm?: number;
}

export const V3CadViewport2D: React.FC<V3CadViewport2DProps> = React.memo(
  ({ mode, interactivePlan = false, snapMm = 50 }) => {
    const {
      project,
      activeModule,
      activeModuleIndex,
      setActiveModuleIndex,
      setActiveBayIndex,
      selectedComponentId,
      setSelectedComponentId,
      rotateActiveModule90,
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
      spaceObstacles,
      spaceWalls,
      validationIssues,
      selectedModuleIds,
      toggleModuleSelection,
      selectAllModules,
      clearModuleSelection,
      batchMoveSelectedModules,
      batchRemoveSelectedModules,
      removeActiveModule,
      setRoomDimensions,
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
      undo,
      redo,
    } = useV3Adapter();

    const lastAccessoryDropTarget2DRef = useRef<{ bayIndex: number; elevationY: number; offsetX?: number; accessory: any } | null>(null);
    const [zoom, setZoom] = useState(1);
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

    const handleWheelZoom = useCallback((e: React.WheelEvent) => {
      e.stopPropagation();
      const delta = e.deltaY < 0 ? 0.14 : -0.14;
      setZoom((prev) => Math.max(0.4, Math.min(3.5, +(prev + delta).toFixed(2))));
    }, []);
    const [showDoorsIn2D, setShowDoorsIn2D] = useState(false);
    const [showRoomContextInElev, setShowRoomContextInElev] = useState(true);
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
    const [magnetEnabled, setMagnetEnabled] = useState<boolean>(true);
    const [showPlanGrid, setShowPlanGrid] = useState<boolean>(true);
    const [showPlanDimensions, setShowPlanDimensions] = useState<boolean>(true);
    const [wallDimDisplayMode, setWallDimDisplayMode] = useState<"net_inner" | "outer" | "plinth">("net_inner");
    const [planScaleRatio, setPlanScaleRatio] = useState<20 | 25 | 50>(25);
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
      mmPerPx: number;
    } | null>(null);
    const lockedPlanVbRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
    const lockedElevVbRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
    const [isPlacingObstacle, setIsPlacingObstacle] = useState<boolean>(false);
    const [obstaclePreviewPos, setObstaclePreviewPos] = useState<{ x: number; z: number } | null>(
      null
    );

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
    } | null>(null);
    const [activeElevSnap, setActiveElevSnap] = useState<ElevationSnapTarget | null>(null);
    const [planRowSnapBanner, setPlanRowSnapBanner] = useState<string | null>(null);
    const [activeSpatialAlertIdx, setActiveSpatialAlertIdx] = useState<number>(0);
    const [spatialAlertsMinimized, setSpatialAlertsMinimized] = useState<boolean>(false);
    const [cadTextScale, setCadTextScale] = useState<number>(() => {
      if (typeof window !== "undefined") {
        const saved = Number(window.localStorage.getItem("birim_v4_cad_text_scale"));
        if (saved >= 0.8 && saved <= 2.6) return saved;
      }
      return 1.65;
    });
    const updateCadTextScale = (nextVal: number) => {
      const clamped = Math.max(0.85, Math.min(2.5, Number(nextVal.toFixed(2))));
      setCadTextScale(clamped);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("birim_v4_cad_text_scale", String(clamped));
      }
    };
    const [dragGhostPreview, setDragGhostPreview] = useState<RowSnapPreviewResult | null>(null);
    const [activePlanSnapX, setActivePlanSnapX] = useState<number | null>(null);
    const [sectionDirection2D, setSectionDirection2D] = useState<"Z" | "X">("Z");
    const [sectionCutRatio2D, setSectionCutRatio2D] = useState<number>(0.5);
    const [cadDrawerTab, setCadDrawerTab] = useState<"wall" | "obstacle" | "dxf">("wall");
    const [showWallCoordsInPill, setShowWallCoordsInPill] = useState<boolean>(false);

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

    const errorModuleIds = useMemo(() => {
      const set = new Set<string>();
      validationIssues.forEach((iss) => {
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
    }, [validationIssues, project.modules]);

    // Compute real-time 2D spatial/architectural intersection warnings (Window, Plumbing, Door Swing, Column, Module Overlap)
    const liveSpatialAlerts = useMemo(() => {
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
          if (hasLeftReturnWall && mx1 < 25 && (firstDoorDir === "left" || firstDoorDir === "double")) {
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
          if (hasRightReturnWall && mainLen - mx2 >= 0 && mainLen - mx2 < 25 && (lastDoorDir === "right" || lastDoorDir === "double")) {
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
          if (xHit && zHit) {
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

      return alerts;
    }, [footprints, project.modules, spaceObstacles, spaceWalls]);

    const handleDeleteSelectedObject = useCallback(() => {
      if (!selectedPlanObject) {
        if (selectedModuleIds.length > 1) {
          batchRemoveSelectedModules();
        } else if (project.modules.length >= 1) {
          removeActiveModule();
        }
        return;
      }
      if (selectedPlanObject.kind === "wall") {
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
      selectedModuleIds.length,
      project.modules.length,
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
        if (resizingPlanObject !== null) setResizingPlanObject(null);
        if (draggingWallId !== null) setDraggingWallId(null);
        if (draggingObsId !== null) setDraggingObsId(null);
        if (draggingModIdx !== null) setDraggingModIdx(null);
        if (elevResizingMod !== null) setElevResizingMod(null);
        if (elevDraggingObs !== null) setElevDraggingObs(null);
        if (elevDraggingMod !== null) setElevDraggingMod(null);
        if (interiorDrag !== null) setInteriorDrag(null);
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
            setSelectedComponentId(null);
            setSelectedPlanObject(null);
          }
          return;
        }
        if ((ev.key === "Delete" || ev.key === "Backspace") && mode === "plan" && interactivePlan) {
          if (selectedPlanObject) {
            // Protect against accidental deletion of the sole remaining module unless another module exists
            if (selectedPlanObject.kind === "module" && project.modules.length <= 1) {
              return;
            }
            ev.preventDefault();
            handleDeleteSelectedObject();
          }
        }
      };
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }, [
      mode,
      interactivePlan,
      isDrawingWall,
      isPlacingObstacle,
      selectedPlanObject,
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
              ventilation: "Havalandırma Kanalı",
              niche: "Duvar Nişi",
              protrusion: "Duvar Çıkıntısı",
              partition: "Bölme Duvar",
            };
            const posX = typeof detail.x === "number" ? detail.x : Math.min(2400, 400 + spaceObstacles.length * 450);
            const posZ = typeof detail.z === "number" ? detail.z : obsType === "partition" ? 600 : 0;
            const createdId = addSpaceObstacle({
              type: obsType,
              name: `${typeLabelsMap[obsType]} (${defW}×${defH}mm)`,
              rotationY: 0,
              doorSwing: "left",
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
      spaceWalls,
      updateWallSegment,
    ]);

    if (!activeModule) return null;

    // Multi-module architectural room plan mode
    if (mode === "plan" && interactivePlan) {
      const mainWall = spaceWalls[0] || {
        id: "wall_main",
        length: 3600,
        thickness: 150,
        name: "Ana Duvar",
        position: { x: 0, y: 0, z: 0 },
        rotationY: 0,
      };
      const underlay = project.space.floorPlanUnderlay;
      const totalModExtentX = Math.max(
        mainWall.length + 300,
        underlay?.widthMm || 0,
        ...spaceWalls.map((w) => w.position.x + w.length + 300),
        ...footprints.map((fp) => fp.x + fp.planWidth + 300)
      );
      const maxDepthZ = Math.max(
        1800,
        underlay?.depthMm || 0,
        ...spaceWalls.map((w) => w.position.z + w.length * 0.6 + 450),
        ...footprints.map((fp) => fp.z + fp.planDepth + 520)
      );

      const padX = 400;
      const padTop = 420;
      const padBottom = 420;
      const computedVb = {
        x: -padX,
        y: -padTop,
        width: totalModExtentX + padX * 2,
        height: maxDepthZ + padTop + padBottom,
      };
      const isAnyPlanDragActive =
        draggingModIdx !== null ||
        draggingObsId !== null ||
        draggingWallId !== null ||
        resizingPlanObject !== null;
      if (!isAnyPlanDragActive || !lockedPlanVbRef.current) {
        lockedPlanVbRef.current = computedVb;
      }
      const vb = lockedPlanVbRef.current;
      // Goldilocks Midpoint CAD Scale: ts ≈ 1.85x at default (cadTextScale = 1.65), halfway between tiny (1.0x) and huge (2.97x)
      const baseVbScale = Math.max(1.05, Math.min(1.35, vb.width / 3800));
      const zoomCompScale = Math.max(0.78, Math.min(1.28, 1 / Math.pow(Math.max(0.5, zoom), 0.38)));
      const ts = Number((baseVbScale * zoomCompScale * cadTextScale).toFixed(2));

      const clientToSvgRawMm = (svgEl: SVGSVGElement, clientX: number, clientY: number) => {
        try {
          const ctm = svgEl.getScreenCTM();
          if (ctm) {
            const pt = svgEl.createSVGPoint();
            pt.x = clientX;
            pt.y = clientY;
            const loc = pt.matrixTransform(ctm.inverse());
            return { x: loc.x, z: loc.y };
          }
        } catch {
          // fallback below
        }
        const rect = svgEl.getBoundingClientRect();
        const scale = Math.max(vb.width / Math.max(1, rect.width), vb.height / Math.max(1, rect.height));
        const drawnW = vb.width / scale;
        const drawnH = vb.height / scale;
        const offX = (rect.width - drawnW) * 0.5;
        const offY = (rect.height - drawnH) * 0.5;
        return {
          x: vb.x + (clientX - rect.left - offX) * scale,
          z: vb.y + (clientY - rect.top - offY) * scale,
        };
      };

      const getSvgMmPerPx = (svgEl: SVGSVGElement): number => {
        try {
          const ctm = svgEl.getScreenCTM();
          if (ctm && Math.abs(ctm.a) > 0.00001) {
            return 1 / Math.abs(ctm.a);
          }
        } catch {
          // fallback
        }
        const rect = svgEl.getBoundingClientRect();
        return Math.max(
          vb.width / Math.max(1, rect.width * zoom),
          vb.height / Math.max(1, rect.height * zoom)
        );
      };

      const resolveSnappedWallPoint = (
        rawPt: { x: number; z: number },
        startPt: { x: number; z: number } | null
      ): { x: number; z: number; snapInfo: { x: number; z: number; label: string } | null } => {
        // 1. Endpoint / Midpoint / CAD Vertex Snap (within 130mm)
        let bestDist = 130;
        let bestCandidate: { x: number; z: number; label: string } | null = null;
        for (const cand of wallSnapCandidates) {
          if (startPt && cand.x === startPt.x && cand.z === startPt.z) continue;
          const d = Math.hypot(rawPt.x - cand.x, rawPt.z - cand.z);
          if (d < bestDist) {
            bestDist = d;
            bestCandidate = cand;
          }
        }
        if (bestCandidate) {
          return { x: bestCandidate.x, z: bestCandidate.z, snapInfo: bestCandidate };
        }

        // 2. Ortho / 45° Angle Snap relative to startPt
        if (startPt) {
          const dx = rawPt.x - startPt.x;
          const dz = rawPt.z - startPt.z;
          const dist = Math.hypot(dx, dz);
          if (dist >= 100) {
            const rawAngle = ((Math.atan2(dz, dx) * 180) / Math.PI + 360) % 360;
            const nearest45 = Math.round(rawAngle / 45) * 45;
            if (Math.abs(rawAngle - nearest45) <= 6 || Math.abs(rawAngle - nearest45 - 360) <= 6) {
              const snappedLen = Math.round(dist / 50) * 50;
              const rad = ((nearest45 % 360) * Math.PI) / 180;
              const sx = Math.round(startPt.x + Math.cos(rad) * snappedLen);
              const sz = Math.round(startPt.z + Math.sin(rad) * snappedLen);
              return {
                x: sx,
                z: sz,
                snapInfo: {
                  x: sx,
                  z: sz,
                  label: `Açı Yakalama (${nearest45 % 360}°, ${snappedLen}mm)`,
                },
              };
            }
          }
        }

        // 3. Grid Snap (50mm)
        const gx = Math.round(rawPt.x / 50) * 50;
        const gz = Math.round(rawPt.z / 50) * 50;
        return { x: gx, z: gz, snapInfo: null };
      };

      const buildObstaclePayloadAt = (posX: number, posZ: number) => {
        const typeLabels: Record<ArchitecturalElement["type"], string> = {
          column: "Taşıyıcı Kolon",
          window: "Pencere",
          door: "Oda Kapısı",
          beam: "Tavan Kirişi",
          plumbing: "Tesisat Noktası",
          electrical: "Elektrik Noktası",
          ventilation: "Havalandırma Kanalı",
          niche: "Duvar Nişi",
          protrusion: "Duvar Çıkıntısı",
          partition: "Bölme Duvar",
        };
        const isHighBeam = newObstacleType === "beam";
        const isWin = newObstacleType === "window";
        const isElec = newObstacleType === "electrical";
        const isPlumb = newObstacleType === "plumbing";
        return {
          type: newObstacleType,
          name: `${typeLabels[newObstacleType]} (${newObstacleW}×${newObstacleH}mm)`,
          rotationY: newObstacleRotY,
          doorSwing: "left" as const,
          position: {
            x: Math.max(0, Math.round(posX)),
            y: isHighBeam
              ? (project.space.ceilingHeight || 2600) - 300
              : Math.max(0, Math.round(newObstacleY)),
            z: Math.max(0, Math.round(posZ)),
          },
          dimensions: {
            width: Math.max(100, Math.round(newObstacleW)),
            height: Math.max(100, Math.round(newObstacleH)),
            depth: newObstacleType === "partition" ? 1200 : newObstacleType === "column" || newObstacleType === "beam" || newObstacleType === "protrusion" ? 280 : 150,
          },
        };
      };

      const handleModPointerDown = (e: React.MouseEvent, idx: number) => {
        if (e.button !== 0 || isDrawingWall || isPlacingObstacle) return;
        e.stopPropagation();
        const mod = project.modules[idx];
        if (mod) {
          setSelectedPlanObject({ kind: "module", id: mod.id });
        }
        if (e.shiftKey && mod) {
          toggleModuleSelection(mod.id, true);
          return;
        }
        if (idx !== activeModuleIndex) {
          setActiveModuleIndex(idx);
        }
        const svgEl = (e.currentTarget as Element).closest("svg") as SVGSVGElement | null;
        const fixedMmPerPx = svgEl ? getSvgMmPerPx(svgEl) : vb.width / 800;
        beginHistoryTransaction();
        setDraggingModIdx(idx);
        setDragStartClient({
          x: e.clientX,
          z: e.clientY,
          startModX: project.modules[idx]?.position.x || 0,
          startModZ: project.modules[idx]?.position.z || 0,
          mmPerPx: fixedMmPerPx,
        });
      };

      const handleObstaclePointerDown = (e: React.MouseEvent, obs: ArchitecturalElement) => {
        if (e.button !== 0 || isDrawingWall || isPlacingObstacle) return;
        e.stopPropagation();
        setSelectedPlanObject({ kind: "obstacle", id: obs.id });
        beginHistoryTransaction();
        setDraggingObsId(obs.id);
        setObsDragStart({
          clientX: e.clientX,
          clientY: e.clientY,
          startX: obs.position.x,
          startZ: obs.position.z,
        });
      };

      const handleWallPointerDown = (
        e: React.MouseEvent,
        wall: (typeof spaceWalls)[number]
      ) => {
        if (e.button !== 0 || isDrawingWall || isPlacingObstacle) return;
        e.stopPropagation();
        setSelectedPlanObject({ kind: "wall", id: wall.id });
        beginHistoryTransaction();
        setDraggingWallId(wall.id);
        setWallDragStart({
          clientX: e.clientX,
          clientY: e.clientY,
          startX: wall.position.x,
          startZ: wall.position.z,
        });
      };

      const handleWallClick = (e: React.MouseEvent, wallId: string) => {
        if (isDrawingWall || isPlacingObstacle) return;
        e.stopPropagation();
        setSelectedPlanObject({ kind: "wall", id: wallId });
      };

      const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
        const rawPt = clientToSvgRawMm(e.currentTarget, e.clientX, e.clientY);

        // Mode A: Click-to-place Obstacle on the 2D Plan
        if (isPlacingObstacle) {
          const snappedX = Math.max(0, Math.round(rawPt.x / 50) * 50);
          const snappedZ = Math.max(0, Math.round(rawPt.z / 50) * 50);
          const createdId = addSpaceObstacle(buildObstaclePayloadAt(snappedX, snappedZ));
          setSelectedPlanObject({ kind: "obstacle", id: createdId });
          setNewObstacleX(snappedX);
          setNewObstacleZ(snappedZ);
          setIsPlacingObstacle(false);
          setObstaclePreviewPos(null);
          return;
        }

        // Mode B: Continuous Polyline Wall Drawing with Smart Snap
        if (!isDrawingWall) return;
        const resolved = resolveSnappedWallPoint(rawPt, drawWallStart);
        const pt = { x: resolved.x, z: resolved.z };

        if (!drawWallStart) {
          setChainOriginPoint(pt);
          setDrawWallStart(pt);
          setDrawWallCursor(pt);
          return;
        }

        const dx = pt.x - drawWallStart.x;
        const dz = pt.z - drawWallStart.z;
        const len = Math.round(Math.hypot(dx, dz));
        if (len >= 200) {
          const angleDeg = Math.round((Math.atan2(dz, dx) * 180) / Math.PI);
          const createdWallId = addWallSegment({
            name: `Serbest Duvar ${spaceWalls.length + 1}`,
            length: len,
            height: project.space.ceilingHeight || 2600,
            thickness: 150,
            position: { x: drawWallStart.x, y: 0, z: drawWallStart.z },
            rotationY: (angleDeg + 360) % 360,
          });
          setSelectedPlanObject({ kind: "wall", id: createdWallId });

          // If snapped back to chainOriginPoint, close loop and end chain; otherwise continue chain from pt!
          const closedLoop =
            chainOriginPoint &&
            Math.hypot(pt.x - chainOriginPoint.x, pt.z - chainOriginPoint.z) < 25;
          if (closedLoop) {
            setDrawWallStart(null);
            setDrawWallCursor(null);
            setChainOriginPoint(null);
            setActiveSnapTarget(null);
          } else {
            setDrawWallStart(pt);
            setDrawWallCursor(pt);
          }
        }
      };

      const handleSvgContextMenu = (e: React.MouseEvent<SVGSVGElement>) => {
        e.preventDefault();
        if (isDrawingWall || isPlacingObstacle) {
          setDrawWallStart(null);
          setDrawWallCursor(null);
          setChainOriginPoint(null);
          setActiveSnapTarget(null);
          setIsPlacingObstacle(false);
        }
      };

      const handleSvgPointerMove = (e: React.MouseEvent<SVGSVGElement>) => {
        const nowTs = performance.now();
        if (nowTs - lastPointerMoveTsRef.current < 14) return;
        lastPointerMoveTsRef.current = nowTs;
        const svgEl = e.currentTarget;
        if (isPlacingObstacle) {
          const raw = clientToSvgRawMm(svgEl, e.clientX, e.clientY);
          setObstaclePreviewPos({
            x: Math.max(0, Math.round(raw.x / 50) * 50),
            z: Math.max(0, Math.round(raw.z / 50) * 50),
          });
          return;
        }
        if (isDrawingWall) {
          const raw = clientToSvgRawMm(svgEl, e.clientX, e.clientY);
          const resolved = resolveSnappedWallPoint(raw, drawWallStart);
          setActiveSnapTarget(resolved.snapInfo);
          if (drawWallStart) {
            setDrawWallCursor({ x: resolved.x, z: resolved.z });
          }
          return;
        }
        if (resizingPlanObject) {
          const mmPerPx = resizingPlanObject.mmPerPx || getSvgMmPerPx(svgEl);
          const dxMm = (e.clientX - resizingPlanObject.startClientX) * mmPerPx;
          const dzMm = (e.clientY - resizingPlanObject.startClientY) * mmPerPx;

          if (resizingPlanObject.kind === "module_right") {
            const modIdx = Number(resizingPlanObject.targetIdxOrId);
            if (resizingPlanObject.isRotated90) {
              // Rotated 90°/270° vertical cabinet: dragging Right edge (+X) changes DEPTH (En/Derinlik)!
              const newD = Math.max(250, Math.min(900, (resizingPlanObject.startDepth || 600) + dxMm));
              resizeModuleParametric(modIdx, resizingPlanObject.startWidthOrLen, undefined, newD);
              setPlanRowSnapBanner(`📐 Dik Dolap Derinliği (En/D): ${Math.round(newD / 10) * 10} mm`);
            } else {
              const newW = Math.max(300, Math.min(3600, resizingPlanObject.startWidthOrLen + dxMm));
              const res = resizeModuleParametric(modIdx, newW);
              if (res) {
                setPlanRowSnapBanner(
                  `📐 Parametrik Genişlik: ${Math.round(newW / 10) * 10}mm → ${res.bayCount} Bölme (${res.bayCount - 1} Ara Dikme) • ${res.totalLeafCount} Kapak`
                );
              }
            }
            return;
          }
          if (resizingPlanObject.kind === "module_left") {
            const modIdx = Number(resizingPlanObject.targetIdxOrId);
            if (resizingPlanObject.isRotated90) {
              // Rotated 90°/270° vertical cabinet: dragging Left edge (-X) changes DEPTH (En/Derinlik) & X!
              const startD = resizingPlanObject.startDepth || 600;
              const maxRightX = resizingPlanObject.startPosX + startD;
              const rawLeftX = Math.max(0, Math.min(maxRightX - 250, resizingPlanObject.startPosX + dxMm));
              const newD = Math.max(250, Math.min(900, maxRightX - rawLeftX));
              resizeModuleParametric(modIdx, resizingPlanObject.startWidthOrLen, rawLeftX, newD);
              setPlanRowSnapBanner(`📐 Dik Dolap Derinliği (En/D): ${Math.round(newD / 10) * 10} mm`);
            } else {
              const maxRightEdge = resizingPlanObject.startPosX + resizingPlanObject.startWidthOrLen;
              const rawLeft = Math.max(0, Math.min(maxRightEdge - 300, resizingPlanObject.startPosX + dxMm));
              const newW = Math.max(300, Math.min(3600, maxRightEdge - rawLeft));
              const res = resizeModuleParametric(modIdx, newW, rawLeft);
              if (res) {
                setPlanRowSnapBanner(
                  `📐 Parametrik Genişlik: ${Math.round(newW / 10) * 10}mm (X:${Math.round(rawLeft / 10) * 10}) → ${res.bayCount} Bölme • ${res.totalLeafCount} Kapak`
                );
              }
            }
            return;
          }
          if (resizingPlanObject.kind === "module_top") {
            const modIdx = Number(resizingPlanObject.targetIdxOrId);
            if (resizingPlanObject.isRotated90) {
              // Rotated 90°/270° vertical cabinet: dragging Top edge (-Z) changes WIDTH/LENGTH (Boy/Genişlik) & Z!
              const maxBottomZ = resizingPlanObject.startPosZ + resizingPlanObject.startWidthOrLen;
              const rawTopZ = Math.max(0, Math.min(maxBottomZ - 300, resizingPlanObject.startPosZ + dzMm));
              const newW = Math.max(300, Math.min(3600, maxBottomZ - rawTopZ));
              const res = resizeModuleParametric(modIdx, newW, undefined, undefined, undefined, rawTopZ);
              if (res) {
                setPlanRowSnapBanner(
                  `📐 Dik Dolap Boyu (W): ${Math.round(newW / 10) * 10}mm (Z:${Math.round(rawTopZ / 10) * 10}) → ${res.bayCount} Bölme • ${res.totalLeafCount} Kapak`
                );
              }
            } else {
              const startD = resizingPlanObject.startDepth || 600;
              const maxBottomZ = resizingPlanObject.startPosZ + startD;
              const rawTopZ = Math.max(0, Math.min(maxBottomZ - 250, resizingPlanObject.startPosZ + dzMm));
              const newD = Math.max(250, Math.min(900, maxBottomZ - rawTopZ));
              resizeModuleParametric(modIdx, resizingPlanObject.startWidthOrLen, undefined, newD, undefined, rawTopZ);
              setPlanRowSnapBanner(`📐 Modül Derinliği (D): ${Math.round(newD / 10) * 10} mm`);
            }
            return;
          }
          if (resizingPlanObject.kind === "module_depth") {
            const modIdx = Number(resizingPlanObject.targetIdxOrId);
            if (resizingPlanObject.isRotated90) {
              // Rotated 90°/270° vertical cabinet: dragging Bottom edge (+Z) changes WIDTH/LENGTH (Boy/Genişlik)!
              const newW = Math.max(300, Math.min(3600, resizingPlanObject.startWidthOrLen + dzMm));
              const res = resizeModuleParametric(modIdx, newW);
              if (res) {
                setPlanRowSnapBanner(
                  `📐 Dik Dolap Boyu (W): ${Math.round(newW / 10) * 10}mm → ${res.bayCount} Bölme (${res.bayCount - 1} Ara Dikme) • ${res.totalLeafCount} Kapak`
                );
              }
            } else {
              const newD = Math.max(
                250,
                Math.min(900, (resizingPlanObject.startDepth || 600) + dzMm)
              );
              resizeModuleParametric(modIdx, resizingPlanObject.startWidthOrLen, undefined, newD);
              setPlanRowSnapBanner(`📐 Modül Derinliği (D): ${Math.round(newD / 10) * 10} mm`);
            }
            return;
          }
          if (
            resizingPlanObject.kind === "obstacle_end" ||
            resizingPlanObject.kind === "obstacle_start"
          ) {
            const obsId = String(resizingPlanObject.targetIdxOrId);
            const targetObs = spaceObstacles.find((o) => o.id === obsId);
            if (targetObs) {
              const delta = resizingPlanObject.isSideWall ? dzMm : dxMm;
              if (resizingPlanObject.kind === "obstacle_end") {
                const newW = Math.max(
                  150,
                  Math.min(4000, Math.round((resizingPlanObject.startWidthOrLen + delta) / 10) * 10)
                );
                updateSpaceObstacle(obsId, {
                  dimensions: { ...targetObs.dimensions, width: newW },
                });
                setPlanRowSnapBanner(`📐 ${targetObs.name} Genişliği (W): ${newW} mm`);
              } else {
                const startCoord = resizingPlanObject.isSideWall
                  ? resizingPlanObject.startPosZ
                  : resizingPlanObject.startPosX;
                const endEdge = startCoord + resizingPlanObject.startWidthOrLen;
                const nextStart = Math.max(
                  0,
                  Math.min(endEdge - 150, Math.round((startCoord + delta) / 10) * 10)
                );
                const newW = Math.max(150, endEdge - nextStart);
                updateSpaceObstacle(obsId, {
                  position: {
                    ...targetObs.position,
                    x: resizingPlanObject.isSideWall ? targetObs.position.x : nextStart,
                    z: resizingPlanObject.isSideWall ? nextStart : targetObs.position.z,
                  },
                  dimensions: { ...targetObs.dimensions, width: newW },
                });
                setPlanRowSnapBanner(`📐 ${targetObs.name} Genişliği (W): ${newW} mm`);
              }
            }
            return;
          }
          if (resizingPlanObject.kind === "wall_end") {
            const wallId = String(resizingPlanObject.targetIdxOrId);
            const targetWall = spaceWalls.find((w) => w.id === wallId);
            const rawPt = clientToSvgRawMm(svgEl, e.clientX, e.clientY);
            const startPt = { x: resizingPlanObject.startPosX, z: resizingPlanObject.startPosZ };

            // Check magnetic snap against all OTHER walls endpoints/corners/midpoints
            let snappedEnd: { x: number; z: number; label: string } | null = null;
            if (magnetEnabled && !e.altKey) {
              let bestDist = 110;
              spaceWalls.forEach((otherW) => {
                if (otherW.id === wallId) return;
                const rad = ((otherW.rotationY || 0) * Math.PI) / 180;
                const ox1 = otherW.position.x;
                const oz1 = otherW.position.z;
                const ox2 = Math.round(ox1 + Math.cos(rad) * otherW.length);
                const oz2 = Math.round(oz1 + Math.sin(rad) * otherW.length);
                const oxm = Math.round((ox1 + ox2) / 2);
                const ozm = Math.round((oz1 + oz2) / 2);
                const cands = [
                  { x: ox1, z: oz1, label: `${otherW.name} Başlangıç Köşesi (${ox1},${oz1})` },
                  { x: ox2, z: oz2, label: `${otherW.name} Bitiş Köşesi (${ox2},${oz2})` },
                  { x: oxm, z: ozm, label: `${otherW.name} Orta Noktası (${oxm},${ozm})` },
                ];
                for (const c of cands) {
                  const d = Math.hypot(rawPt.x - c.x, rawPt.z - c.z);
                  if (d < bestDist) {
                    bestDist = d;
                    snappedEnd = c;
                  }
                }
              });
            }

            if (snappedEnd && targetWall) {
              const sdx = snappedEnd.x - startPt.x;
              const sdz = snappedEnd.z - startPt.z;
              const newLen = Math.max(200, Math.round(Math.hypot(sdx, sdz)));
              const newRot = (Math.round((Math.atan2(sdz, sdx) * 180) / Math.PI) + 360) % 360;
              setActiveSnapTarget(snappedEnd);
              updateWallSegment(wallId, { length: newLen, rotationY: newRot });
              setPlanRowSnapBanner(`🧲 Duvar Ucu Mıknatıslandı: ${snappedEnd.label} (Boy: ${newLen}mm, ${newRot}°)`);
              return;
            }

            setActiveSnapTarget(null);
            const delta = resizingPlanObject.isSideWall ? dzMm : dxMm;
            const newLen = Math.max(
              300,
              Math.min(12000, Math.round((resizingPlanObject.startWidthOrLen + delta) / 50) * 50)
            );
            updateWallSegment(wallId, { length: newLen });
            setPlanRowSnapBanner(`📐 Duvar Uzunluğu: ${newLen} mm`);
            return;
          }
        }

        if (draggingWallId) {
          const mmPerPx = getSvgMmPerPx(svgEl);
          const dxMm = (e.clientX - wallDragStart.clientX) * mmPerPx;
          const dzMm = (e.clientY - wallDragStart.clientY) * mmPerPx;
          const rawX = wallDragStart.startX + dxMm;
          const rawZ = wallDragStart.startZ + dzMm;
          let nextX = Math.round(rawX / 10) * 10;
          let nextZ = Math.round(rawZ / 10) * 10;
          let wallSnapInfo: { x: number; z: number; label: string } | null = null;

          const draggedWall = spaceWalls.find((w) => w.id === draggingWallId);
          if (draggedWall && magnetEnabled && !e.altKey) {
            const wRad = ((draggedWall.rotationY || 0) * Math.PI) / 180;
            const wDx = Math.cos(wRad) * draggedWall.length;
            const wDz = Math.sin(wRad) * draggedWall.length;
            const candEndX = rawX + wDx;
            const candEndZ = rawZ + wDz;

            // Collect all snap points from OTHER walls (Start, End, Outer Corners, Midpoint, Origin 0,0)
            const otherWallPts: { x: number; z: number; label: string }[] = [
              { x: 0, z: 0, label: "Oda Başlangıç Köşesi (0,0)" },
            ];
            spaceWalls.forEach((ow) => {
              if (ow.id === draggingWallId) return;
              const oRad = ((ow.rotationY || 0) * Math.PI) / 180;
              const ox1 = ow.position.x;
              const oz1 = ow.position.z;
              const ox2 = Math.round(ox1 + Math.cos(oRad) * ow.length);
              const oz2 = Math.round(oz1 + Math.sin(oRad) * ow.length);
              const oxm = Math.round((ox1 + ox2) / 2);
              const ozm = Math.round((oz1 + oz2) / 2);
              otherWallPts.push({ x: ox1, z: oz1, label: `${ow.name} Başlangıç Köşesi (${ox1},${oz1})` });
              otherWallPts.push({ x: ox2, z: oz2, label: `${ow.name} Uç Köşesi (${ox2},${oz2})` });
              otherWallPts.push({ x: oxm, z: ozm, label: `${ow.name} Orta Noktası (${oxm},${ozm})` });
            });

            let bestDist = 95;
            for (const pt of otherWallPts) {
              // 1. Check if dragged wall START point snaps to pt
              const dStart = Math.hypot(rawX - pt.x, rawZ - pt.z);
              if (dStart < bestDist) {
                bestDist = dStart;
                nextX = pt.x;
                nextZ = pt.z;
                wallSnapInfo = { x: pt.x, z: pt.z, label: `Başlangıç → ${pt.label}` };
              }
              // 2. Check if dragged wall END point snaps to pt
              const dEnd = Math.hypot(candEndX - pt.x, candEndZ - pt.z);
              if (dEnd < bestDist) {
                bestDist = dEnd;
                nextX = Math.round(pt.x - wDx);
                nextZ = Math.round(pt.z - wDz);
                wallSnapInfo = { x: pt.x, z: pt.z, label: `Uç Nokta → ${pt.label}` };
              }
            }
          }

          setActiveSnapTarget(wallSnapInfo);
          setPlanRowSnapBanner(
            wallSnapInfo
              ? `🧲 Duvar Duvara Snap: ${wallSnapInfo.label}`
              : `✋ Duvar Taşınıyor: X:${nextX}mm • Z:${nextZ}mm`
          );
          updateWallSegment(draggingWallId, { position: { x: nextX, z: nextZ } });
          return;
        }
        if (draggingObsId) {
          const mmPerPx = getSvgMmPerPx(svgEl);
          const dxMm = (e.clientX - obsDragStart.clientX) * mmPerPx;
          const dzMm = (e.clientY - obsDragStart.clientY) * mmPerPx;
          let nextX = Math.max(0, Math.round((obsDragStart.startX + dxMm) / 10) * 10);
          let nextZ = Math.max(0, Math.round((obsDragStart.startZ + dzMm) / 10) * 10);
          const draggedObs = spaceObstacles.find((o) => o.id === draggingObsId);
          const rot = (((draggedObs?.rotationY || 0) % 360) + 360) % 360;
          if ((rot === 90 || rot === 270) && nextX <= 90) {
            nextX = 0;
          } else if ((rot === 0 || rot === 180) && nextZ <= 90) {
            nextZ = 0;
          }
          updateObstaclePosition(draggingObsId, nextX, nextZ);
          return;
        }
        if (draggingModIdx === null) return;
        const mmPerPx = dragStartClient.mmPerPx || vb.width / Math.max(1, svgEl.getBoundingClientRect().width * zoom);
        const dxMm = (e.clientX - dragStartClient.x) * mmPerPx;
        const dzMm = (e.clientY - dragStartClient.z) * mmPerPx;
        const rawNextX = Math.max(0, dragStartClient.startModX + dxMm);
        const rawNextZ = Math.max(0, dragStartClient.startModZ + dzMm);
        let nextX = rawNextX;
        let nextZ = rawNextZ;
        let activeSnapMsg: string | null = null;
        let snappedEdgeX: number | null = null;

        // Smooth Magnetic Edge-to-Edge Snapping with Instant Breakaway Hysteresis (never locks the module!)
        const dragMod = project.modules[draggingModIdx];
        const useMagnet = magnetEnabled && !e.altKey;
        const SNAP_THRESHOLD_MM = 22;

        if (dragMod && useMagnet) {
          const dragW = footprints[draggingModIdx]?.planWidth || dragMod.dimensions.width;
          const dragD = footprints[draggingModIdx]?.planDepth || dragMod.dimensions.depth;
          const dragRotY = (((dragMod.rotation?.y || 0) % 360) + 360) % 360;
          const startedAtZero = dragStartClient.startModX <= 5;
          if (rawNextX <= SNAP_THRESHOLD_MM && (!startedAtZero || dxMm <= 0)) {
            nextX = 0;
            snappedEdgeX = 0;
            activeSnapMsg = "🧲 Sol Duvar Hizası (X: 0mm) — Ayırmak için fareyi çekin veya Alt tuşuna basın";
          }
          if (rawNextZ <= 28) {
            nextZ = 0;
          }

          // Helper: check if placing dragged module at (candX, candZ) would overlap any other module in 2D
          const wouldOverlapOtherModule = (candX: number, candZ: number, ignoreIdx: number) => {
            return project.modules.some((m, mIdx) => {
              if (mIdx === draggingModIdx || mIdx === ignoreIdx || m.category === "complementary") {
                return false;
              }
              const mFp = footprints[mIdx];
              const mw = mFp?.planWidth || m.dimensions.width;
              const md = mFp?.planDepth || m.dimensions.depth;
              const xOverlap = candX < m.position.x + mw - 4 && candX + dragW > m.position.x + 4;
              const zOverlap = candZ < m.position.z + md - 4 && candZ + dragD > m.position.z + 4;
              return xOverlap && zOverlap;
            });
          };

          project.modules.forEach((other, oIdx) => {
            if (oIdx === draggingModIdx || other.category === "complementary") return;
            const otherRotY = (((other.rotation?.y || 0) % 360) + 360) % 360;
            // Only snap side-by-side along X if BOTH modules are in the same Z row (within 60mm) and same orientation!
            if (otherRotY !== dragRotY || Math.abs(rawNextZ - other.position.z) > 60) {
              return;
            }

            const otherW = footprints[oIdx]?.planWidth || other.dimensions.width;
            const otherRight = other.position.x + otherW;
            const otherLeft = other.position.x;

            // Breakaway check: if we started already touching this edge and are pulling away, do NOT trap!
            const startedAtRight =
              Math.abs(dragStartClient.startModX - otherRight) <= 6 &&
              Math.abs(dragStartClient.startModZ - other.position.z) <= 60;
            const pullingAwayFromRight = startedAtRight && (Math.abs(dxMm) > 4 || Math.abs(dzMm) > 15);

            const startedAtLeft =
              Math.abs(dragStartClient.startModX + dragW - otherLeft) <= 6 &&
              Math.abs(dragStartClient.startModZ - other.position.z) <= 60;
            const pullingAwayFromLeft = startedAtLeft && (Math.abs(dxMm) > 4 || Math.abs(dzMm) > 15);

            if (
              !pullingAwayFromRight &&
              Math.abs(rawNextX - otherRight) <= SNAP_THRESHOLD_MM &&
              !wouldOverlapOtherModule(otherRight, other.position.z, oIdx)
            ) {
              nextX = otherRight;
              nextZ = other.position.z;
              snappedEdgeX = otherRight;
              activeSnapMsg = `🧲 ${oIdx + 1}. Modül Sağına Snap (X: ${otherRight}mm)`;
            } else if (
              !pullingAwayFromLeft &&
              Math.abs(rawNextX + dragW - otherLeft) <= SNAP_THRESHOLD_MM &&
              otherLeft - dragW >= 0 &&
              !wouldOverlapOtherModule(otherLeft - dragW, other.position.z, oIdx)
            ) {
              nextX = otherLeft - dragW;
              nextZ = other.position.z;
              snappedEdgeX = otherLeft;
              activeSnapMsg = `🧲 ${oIdx + 1}. Modül Soluna Snap (X: ${nextX}mm)`;
            }
          });
        }
        // Smart L/U Wall Auto-Rotate on Side-Wall Snap (Automatically rotates 0° <-> 90° when dragged onto a side wall or back to main wall)
        if (dragMod && useMagnet) {
          const curRot = (((dragMod.rotation?.y || 0) % 360) + 360) % 360;
          const hasSideWallLeft =
            spaceWalls.some((w) => (((w.rotationY || 0) % 360) + 360) % 360 === 90 && w.position.x <= 80) ||
            rawNextZ >= 360;
          const rightWall = spaceWalls.find(
            (w) => (((w.rotationY || 0) % 360) + 360) % 360 === 90 && w.position.x >= mainWall.length - 150
          );

          if (curRot === 0 && rawNextZ >= 340 && rawNextX <= 85 && hasSideWallLeft) {
            if (draggingModIdx !== activeModuleIndex) setActiveModuleIndex(draggingModIdx);
            rotateActiveModule90(90);
            nextX = 0;
            activeSnapMsg = "🔄🧲 Sol Yan Duvara Otomatik 90° Döndü ve Yapıştı (X: 0mm)";
          } else if (
            curRot === 0 &&
            rawNextZ >= 340 &&
            rightWall &&
            Math.abs(rawNextX + (footprints[draggingModIdx]?.planWidth || dragMod.dimensions.width) - rightWall.position.x) <= 95
          ) {
            if (draggingModIdx !== activeModuleIndex) setActiveModuleIndex(draggingModIdx);
            rotateActiveModule90(270);
            nextX = Math.max(0, rightWall.position.x - dragMod.dimensions.depth);
            activeSnapMsg = "🔄🧲 Sağ Yan Duvara Otomatik 270° Döndü ve Yapıştı";
          } else if ((curRot === 90 || curRot === 270) && rawNextZ <= 75 && rawNextX >= 140) {
            if (draggingModIdx !== activeModuleIndex) setActiveModuleIndex(draggingModIdx);
            rotateActiveModule90(curRot === 90 ? -90 : -270);
            nextZ = 0;
            activeSnapMsg = "🔄🧲 Ana Duvara Otomatik 0° Döndü ve Hizalandı (Z: 0mm)";
          }
        }

        setActivePlanSnapX(snappedEdgeX);
        setPlanRowSnapBanner(activeSnapMsg);
        if (dragMod && (nextX !== dragMod.position.x || nextZ !== dragMod.position.z)) {
          setModulePosition(draggingModIdx, nextX, nextZ, useMagnet ? (activeSnapMsg ? 1 : 10) : 1);
        }
      };

      const handleSvgPointerUp = () => {
        if (resizingPlanObject !== null) {
          setResizingPlanObject(null);
          setActiveSnapTarget(null);
          setPlanRowSnapBanner(null);
          commitHistoryTransaction();
        }
        if (draggingWallId !== null) {
          setDraggingWallId(null);
          setActiveSnapTarget(null);
          setPlanRowSnapBanner(null);
          commitHistoryTransaction();
        }
        if (draggingObsId !== null) {
          setDraggingObsId(null);
          commitHistoryTransaction();
        }
        if (draggingModIdx !== null) {
          setDraggingModIdx(null);
          setActivePlanSnapX(null);
          setPlanRowSnapBanner(null);
          commitHistoryTransaction();
        }
      };

      const handleFloorPlanFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const lower = file.name.toLowerCase();
        if (lower.endsWith(".dxf") || lower.endsWith(".dwg")) {
          const text = await file.text();
          const parsed = parseCadDxfText(text, file.name, 1);
          setFloorPlanUnderlay(parsed);
        } else if (lower.endsWith(".pdf")) {
          const text = await file.text();
          const parsed = parsePdfFloorPlanMetadata(text, file.name, 50);
          setFloorPlanUnderlay(parsed);
        } else {
          const reader = new FileReader();
          reader.onload = () => {
            setFloorPlanUnderlay({
              fileName: file.name,
              fileType: lower.endsWith(".svg") ? "svg" : "image",
              widthMm: mainWall.length || 3600,
              depthMm: 2800,
              offsetXMm: 0,
              offsetZMm: 0,
              scaleMmPerUnit: 1,
              opacity: 0.45,
              dataUrl: typeof reader.result === "string" ? reader.result : undefined,
              polylines: [],
            });
          };
          reader.readAsDataURL(file);
        }
        e.target.value = "";
      };

      const handleAddObstacleClick = () => {
        let targetX = newObstacleX;
        let targetZ = newObstacleZ;
        if (obstacleTargetWallId !== "custom_xz") {
          const targetWall =
            spaceWalls.find((w) => w.id === obstacleTargetWallId) || spaceWalls[0];
          if (targetWall) {
            const rad = ((targetWall.rotationY || 0) * Math.PI) / 180;
            const clampedOffset = Math.max(
              0,
              Math.min(Math.max(0, targetWall.length - newObstacleW), newObstacleX)
            );
            targetX = Math.round(targetWall.position.x + Math.cos(rad) * clampedOffset);
            targetZ = Math.round(targetWall.position.z + Math.sin(rad) * clampedOffset);
          }
        }
        const createdId = addSpaceObstacle(buildObstaclePayloadAt(targetX, targetZ));
        setSelectedPlanObject({ kind: "obstacle", id: createdId });
      };

      const selectedObstacleObj =
        selectedPlanObject?.kind === "obstacle"
          ? spaceObstacles.find((o) => o.id === selectedPlanObject.id) || null
          : null;
      const selectedWallObj =
        selectedPlanObject?.kind === "wall"
          ? spaceWalls.find((w) => w.id === selectedPlanObject.id) || null
          : null;
      const selectedModuleObj =
        selectedPlanObject?.kind === "module"
          ? project.modules.find((m) => m.id === selectedPlanObject.id) || null
          : null;

      const handlePlanDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        const hasMime = e.dataTransfer.types.includes("application/x-birim-template-id");
        const activeTplId = getActiveDraggedTemplateId();
        if (!hasMime && !activeTplId) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        const svgEl = e.currentTarget.querySelector("svg");
        const rawX = svgEl
          ? clientToSvgRawMm(svgEl, e.clientX, e.clientY).x
          : ((e.clientX - e.currentTarget.getBoundingClientRect().left) /
              Math.max(1, e.currentTarget.getBoundingClientRect().width)) *
              vb.width +
            vb.x;
        const tplId = activeTplId || "v4_kb_01_single_door";
        const preview = computeRowSnapPreview(project, tplId, Math.max(0, rawX));
        if (preview) {
          setDragGhostPreview(preview);
          setPlanRowSnapBanner(
            `🧲 SİLUET SNAP: ${preview.previewModule.name} (${preview.previewModule.dimensions.width}×${preview.previewModule.dimensions.depth}mm) → ${preview.snapLabel}`
          );
        }
      };

      const handlePlanDrop = (e: React.DragEvent<HTMLDivElement>) => {
        const tplId =
          e.dataTransfer.getData("application/x-birim-template-id") ||
          getActiveDraggedTemplateId();
        setDragGhostPreview(null);
        setActiveDraggedTemplateId(null);
        if (!tplId) return;
        e.preventDefault();
        const svgEl = e.currentTarget.querySelector("svg");
        const rawX = svgEl
          ? clientToSvgRawMm(svgEl, e.clientX, e.clientY).x
          : ((e.clientX - e.currentTarget.getBoundingClientRect().left) /
              Math.max(1, e.currentTarget.getBoundingClientRect().width)) *
              vb.width +
            vb.x;
        const res = dropV4TemplateWithSnap(tplId, Math.max(0, rawX));
        if (res) {
          setPlanRowSnapBanner(`✓ ${res.placedName} → ${res.snapLabel}`);
          setTimeout(() => setPlanRowSnapBanner(null), 3200);
        } else {
          setPlanRowSnapBanner(null);
        }
      };

      return (
        <div
          data-testid="v3-cad-plan-interactive"
          onWheel={handleWheelZoom}
          onDragOver={handlePlanDragOver}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
              setDragGhostPreview(null);
              setPlanRowSnapBanner(null);
            }
          }}
          onDrop={handlePlanDrop}
          className="relative w-full h-full bg-[#E2DED5] overflow-hidden select-none flex flex-col"
        >
          {/* SINGLE-CARD CAROUSEL & MINIMIZABLE SPATIAL WARNING BAR (Never stacks vertically, never sits under top module dock) */}
          {liveSpatialAlerts.length > 0 && (() => {
            const safeIdx = Math.min(activeSpatialAlertIdx, liveSpatialAlerts.length - 1);
            const al = liveSpatialAlerts[safeIdx];
            const totalAlerts = liveSpatialAlerts.length;

            const handleAutoFixAllAlerts = (e: React.MouseEvent) => {
              e.stopPropagation();
              let curX = 50; // 50mm sol kör çıta payı
              const winObs = spaceObstacles.find((o) => o.type === "window");
              project.modules.forEach((m, mIdx) => {
                if (m.category === "complementary") return;
                const colObs = spaceObstacles.find(
                  (o) =>
                    (o.type === "column" || o.type === "beam") &&
                    curX < o.position.x + o.dimensions.width &&
                    curX + m.dimensions.width > o.position.x
                );
                if (colObs) {
                  curX = colObs.position.x + colObs.dimensions.width + 15;
                }
                setModulePosition(mIdx, curX, m.position.z, 1);
                if (
                  winObs &&
                  curX < winObs.position.x + winObs.dimensions.width &&
                  curX + m.dimensions.width > winObs.position.x &&
                  m.dimensions.height > winObs.position.y
                ) {
                  const safeH = Math.max(450, winObs.position.y - 10);
                  resizeModuleParametric(mIdx, m.dimensions.width, undefined, undefined, safeH);
                }
                curX += m.dimensions.width;
              });
              setPlanRowSnapBanner("✨ Tüm çakışma, kolon, pencere ve kör çıta uyarıları tek tıkla otomatik çözüldü!");
              setTimeout(() => setPlanRowSnapBanner(null), 3500);
            };

            return (
              <div
                data-testid="plan-live-spatial-warnings"
                className="shrink-0 w-full z-20 px-2.5 py-1.5 bg-slate-900/95 border-b border-red-500/60 pointer-events-auto"
              >
                {spatialAlertsMinimized ? (
                  /* Ultra-Compact Single-Line Pill Mode */
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-2xl bg-slate-900/92 backdrop-blur-xl text-white border border-red-400/90 shadow-lg text-[11px]">
                    <span className="font-extrabold text-red-300 whitespace-nowrap">
                      ⚠️ {totalAlerts} Çakışma
                    </span>
                    <button
                      type="button"
                      data-testid="plan-autofix-all-minimized-btn"
                      onClick={handleAutoFixAllAlerts}
                      className="px-2 py-0.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-[10px] whitespace-nowrap cursor-pointer transition"
                    >
                      🪄 Tümünü Çöz
                    </button>
                    <button
                      type="button"
                      data-testid="plan-alert-expand-btn"
                      onClick={() => setSpatialAlertsMinimized(false)}
                      className="px-1.5 py-0.5 rounded-lg bg-white/15 hover:bg-white/25 text-white font-bold text-[10px] cursor-pointer transition"
                      title="Uyarı detayını göster"
                    >
                      Aç ▾
                    </button>
                  </div>
                ) : (
                  /* Single-Card Carousel Mode (Shows 1 alert at a time with Prev/Next & Auto-Fix) */
                  <div
                    key={al.id}
                    onClick={() => {
                      if (typeof al.modIdx === "number") {
                        setActiveModuleIndex(al.modIdx);
                      }
                    }}
                    className={`px-3 py-2 rounded-2xl backdrop-blur-xl border shadow-xl text-[11px] leading-snug transition ${
                      al.severity === "error"
                        ? "bg-slate-900/92 text-white border-red-400/90 ring-1 ring-red-500/30"
                        : "bg-slate-900/92 text-amber-50 border-amber-400/90 ring-1 ring-amber-500/30"
                    }`}
                  >
                    {/* Carousel Header: Alert Count + Prev/Next Stepper + Fix All + Minimize */}
                    <div className="flex items-center justify-between gap-1.5 pb-1.5 mb-1.5 border-b border-white/15">
                      <div className="flex items-center gap-1">
                        <span className="px-1.5 py-0.5 rounded bg-red-500/30 text-red-200 font-black text-[10px] whitespace-nowrap">
                          ⚠️ {safeIdx + 1}/{totalAlerts} Uyarı
                        </span>
                        {totalAlerts > 1 && (
                          <div className="inline-flex items-center bg-white/10 rounded-lg p-0.5">
                            <button
                              type="button"
                              data-testid="plan-alert-prev-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveSpatialAlertIdx((prev) => (prev - 1 + totalAlerts) % totalAlerts);
                              }}
                              title="Önceki Uyarı"
                              className="px-1.5 py-0.2 rounded hover:bg-white/20 text-white font-bold text-[10px] cursor-pointer"
                            >
                              ‹
                            </button>
                            <button
                              type="button"
                              data-testid="plan-alert-next-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveSpatialAlertIdx((prev) => (prev + 1) % totalAlerts);
                              }}
                              title="Sonraki Uyarı"
                              className="px-1.5 py-0.2 rounded hover:bg-white/20 text-white font-bold text-[10px] cursor-pointer"
                            >
                              ›
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        {totalAlerts > 1 && (
                          <button
                            type="button"
                            data-testid="plan-autofix-all-btn"
                            onClick={handleAutoFixAllAlerts}
                            className="px-1.5 py-0.5 rounded-md bg-emerald-500/25 hover:bg-emerald-500/40 text-emerald-200 border border-emerald-400/40 font-extrabold text-[9px] whitespace-nowrap cursor-pointer transition"
                            title="Tüm çakışmaları tek tıkla otomatik çöz"
                          >
                            🪄 Tümünü Çöz
                          </button>
                        )}
                        <button
                          type="button"
                          data-testid="plan-alert-minimize-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSpatialAlertsMinimized(true);
                          }}
                          className="px-1.5 py-0.5 rounded-md bg-white/10 hover:bg-white/20 text-slate-200 font-bold text-[9px] cursor-pointer transition"
                          title="Uyarı kartını tek satıra küçült"
                        >
                          Küçült ▴
                        </button>
                      </div>
                    </div>

                    {/* Active Alert Title & Detail */}
                    <div className="font-extrabold flex items-center justify-between gap-2">
                      <span className="truncate">{al.title}</span>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/15 shrink-0">
                        X:{al.x}mm
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-200 mt-0.5 line-clamp-2">{al.detail}</div>

                    {/* 1-Click Auto-Resolve Actions for Active Alert */}
                    <div className="mt-1.5 pt-1.5 border-t border-white/15 flex flex-wrap items-center gap-1.5">
                      {al.kind === "window" && typeof al.modIdx === "number" && (
                        <>
                          <button
                            type="button"
                            data-testid={`plan-autofix-win-move-${al.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              const targetMod = project.modules[al.modIdx!];
                              const winObs = spaceObstacles.find((o) => o.type === "window");
                              if (targetMod && winObs) {
                                const rightCandidateX = winObs.position.x + winObs.dimensions.width + 20;
                                const leftCandidateX = Math.max(0, winObs.position.x - targetMod.dimensions.width - 20);
                                const nextX =
                                  rightCandidateX + targetMod.dimensions.width <= mainWall.length
                                    ? rightCandidateX
                                    : leftCandidateX;
                                setModulePosition(al.modIdx!, nextX, targetMod.position.z, 1);
                                setPlanRowSnapBanner(`✨ "${targetMod.name}" pencere açıklığının yanına (X:${nextX}mm) kaydırıldı`);
                                setTimeout(() => setPlanRowSnapBanner(null), 3000);
                              }
                            }}
                            className="px-2 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-[10px] inline-flex items-center gap-1 cursor-pointer transition active:scale-95"
                          >
                            <span>🪄</span>
                            <span>Pencere Kenarına Kaydır</span>
                          </button>
                          <button
                            type="button"
                            data-testid={`plan-autofix-win-lower-${al.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              const targetMod = project.modules[al.modIdx!];
                              const winObs = spaceObstacles.find((o) => o.type === "window");
                              if (targetMod && winObs) {
                                const safeH = Math.max(450, winObs.position.y - (targetMod.category === "kitchen_base" ? 40 : 0) - 10);
                                resizeModuleParametric(al.modIdx!, targetMod.dimensions.width, undefined, undefined, safeH);
                                setPlanRowSnapBanner(`✨ "${targetMod.name}" yüksekliği pencere denizlik altına (${safeH}mm) indirildi`);
                                setTimeout(() => setPlanRowSnapBanner(null), 3000);
                              }
                            }}
                            className="px-2 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white font-bold text-[10px] inline-flex items-center gap-1 cursor-pointer transition"
                          >
                            <span>↕ Denizlik Altına İndir</span>
                          </button>
                        </>
                      )}

                      {al.kind === "plumbing" && (
                        <button
                          type="button"
                          data-testid={`plan-autofix-plumbing-${al.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            const plumbObs = spaceObstacles.find((o) => o.type === "plumbing");
                            if (typeof al.modIdx === "number") {
                              setActiveModuleIndex(al.modIdx);
                              dropV4TemplateWithSnap("tpl_kb_06_sink_double_door", plumbObs ? plumbObs.position.x : al.x);
                              setPlanRowSnapBanner("✨ Tesisat önüne uyumlu Eviye (Sink) Alt Modülü yerleştirildi");
                              setTimeout(() => setPlanRowSnapBanner(null), 3000);
                            } else if (plumbObs) {
                              dropV4TemplateWithSnap("tpl_kb_06_sink_double_door", Math.max(0, plumbObs.position.x - 200));
                              setPlanRowSnapBanner("✨ Açıkta kalan tesisat aksına Eviye (Sink) Alt Modülü eklendi");
                              setTimeout(() => setPlanRowSnapBanner(null), 3000);
                            }
                          }}
                          className="px-2 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-[10px] inline-flex items-center gap-1 cursor-pointer transition active:scale-95"
                        >
                          <span>🪄</span>
                          <span>Tesisat Önüne Eviye Modülü Yerleştir</span>
                        </button>
                      )}

                      {al.kind === "door_swing" && typeof al.modIdx === "number" && (
                        <button
                          type="button"
                          data-testid={`plan-autofix-doorswing-${al.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            const targetMod = project.modules[al.modIdx!];
                            setActiveModuleIndex(al.modIdx!);
                            if (targetMod && targetMod.position.x < 50) {
                              setModulePosition(al.modIdx!, 50, targetMod.position.z, 1);
                            }
                            setPlanRowSnapBanner("✨ 50mm Kör Çıta (Duvar Açılım Payı) bırakılarak kapak sıkışması giderildi");
                            setTimeout(() => setPlanRowSnapBanner(null), 3000);
                          }}
                          className="px-2 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-[10px] inline-flex items-center gap-1 cursor-pointer transition active:scale-95"
                        >
                          <span>🪄</span>
                          <span>50mm Kör Çıta Payı Bırak & Çöz</span>
                        </button>
                      )}

                      {(al.kind === "module_overlap" || al.kind === "column") && typeof al.modIdx === "number" && (
                        <button
                          type="button"
                          data-testid={`plan-autofix-overlap-${al.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            let curX = 0;
                            project.modules.forEach((m, mIdx) => {
                              if (m.category === "complementary") return;
                              const colObs = spaceObstacles.find(
                                (o) =>
                                  (o.type === "column" || o.type === "beam") &&
                                  curX < o.position.x + o.dimensions.width &&
                                  curX + m.dimensions.width > o.position.x
                              );
                              if (colObs) {
                                curX = colObs.position.x + colObs.dimensions.width + 10;
                              }
                              setModulePosition(mIdx, curX, m.position.z, 1);
                              curX += m.dimensions.width;
                            });
                            setPlanRowSnapBanner("✨ Modüller çakışmayacak şekilde sırayla duvara dizildi");
                            setTimeout(() => setPlanRowSnapBanner(null), 3000);
                          }}
                          className="px-2 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-[10px] inline-flex items-center gap-1 cursor-pointer transition active:scale-95"
                        >
                          <span>🪄</span>
                          <span>Çakışmayı Otomatik Ayır & Hizala</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

                    {/* Inline Wall Dimension Click-to-Edit Popover */}
          {inlineEditWallId && (
            <div
              data-testid="plan-inline-wall-dim-editor"
              className="absolute top-14 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-white/95 backdrop-blur-xl px-3.5 py-2 rounded-2xl border-2 border-[#2563EB] shadow-xl text-xs"
            >
              <span className="font-bold text-[#111827]">Duvar Ölçüsü (mm):</span>
              <input
                type="number"
                data-testid="plan-inline-wall-dim-input"
                min={500}
                max={15000}
                step={50}
                value={inlineEditWallLength}
                onChange={(e) => setInlineEditWallLength(Number(e.target.value) || 3600)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (inlineEditWallId === (spaceWalls[0]?.id || "wall_main")) {
                      setRoomDimensions(inlineEditWallLength, project.space.ceilingHeight || 2700);
                    } else {
                      updateWallSegment(inlineEditWallId, { length: inlineEditWallLength });
                    }
                    setInlineEditWallId(null);
                  } else if (e.key === "Escape") {
                    setInlineEditWallId(null);
                  }
                }}
                className="w-24 px-2 py-1 rounded-lg border border-[#CBD5E1] font-mono font-bold text-[#111827]"
              />
              <button
                type="button"
                data-testid="plan-inline-wall-dim-apply-btn"
                onClick={() => {
                  if (inlineEditWallId === (spaceWalls[0]?.id || "wall_main")) {
                    setRoomDimensions(inlineEditWallLength, project.space.ceilingHeight || 2700);
                  } else {
                    updateWallSegment(inlineEditWallId, { length: inlineEditWallLength });
                  }
                  setInlineEditWallId(null);
                }}
                className="px-3 py-1 rounded-lg bg-[#2563EB] text-white font-bold cursor-pointer"
              >
                Uygula
              </button>
              <button
                type="button"
                onClick={() => setInlineEditWallId(null)}
                className="px-2 py-1 rounded-lg bg-[#F1F5F9] text-[#475569] font-semibold cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* UNIFIED NON-OVERLAPPING BOTTOM DOCK STACK (Snap Toast + Selected Object Pill + CAD Drawer + Scale Bar) */}
          <div className="absolute bottom-2.5 left-2 right-2 z-20 flex flex-col items-center gap-1.5 pointer-events-none">
            {/* 0. Snap / Action Toast Banner */}
            {planRowSnapBanner && (
              <div
                data-testid="plan-row-snap-banner"
                className="pointer-events-none max-w-[calc(100%-16px)] px-3.5 py-1.5 rounded-2xl bg-slate-900/92 backdrop-blur-xl text-white border border-emerald-400/80 shadow-xl ring-1 ring-black/15 font-mono text-xs font-bold flex items-center gap-2 truncate"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                <span className="truncate">{planRowSnapBanner}</span>
              </div>
            )}

            {/* A. CONTEXTUAL FROSTED GLASS SELECTION PILL (Single-Row, Icon-First, Never Overlaps Scale Bar!) */}
            {selectedPlanObject && !showAdvancedCadBar && !isDrawingWall && !isPlacingObstacle && (
              <div
                data-testid="plan-selected-object-floating-pill"
                className="pointer-events-auto w-fit max-w-[calc(100%-8px)] flex flex-wrap items-center justify-center gap-1.5 bg-white/90 backdrop-blur-xl px-2.5 py-1.5 rounded-2xl border border-white/95 ring-1 ring-slate-900/10 shadow-[0_10px_28px_rgba(15,23,42,0.16)] text-xs text-[#0F172A]"
              >
                {/* 1. SELECTED MODULE CONTEXT PILL */}
                {selectedModuleObj && (
                  <>
                    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-xl bg-blue-50/90 border border-blue-200/80 text-[#0F172A] shrink-0 whitespace-nowrap">
                      <span>📦</span>
                      <span className="font-extrabold">#{activeModuleIndex + 1}</span>
                      <span className="font-bold max-w-[120px] truncate">{selectedModuleObj.name}</span>
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-600 text-white">
                        {selectedModuleObj.dimensions.width}mm
                      </span>
                    </div>

                    {project.modules.length > 1 && (
                      <div className="inline-flex items-center gap-0.5 bg-slate-100/90 p-0.5 rounded-xl border border-slate-200/80 shrink-0 whitespace-nowrap">
                        <button
                          type="button"
                          data-testid="plan-swap-mod-left-btn"
                          onClick={() => {
                            const res = swapModuleWithNeighbor(activeModuleIndex, "left");
                            if (res) {
                              setPlanRowSnapBanner(`🔄 Solundaki "${res.swappedWithName}" ile yer değiştirdi`);
                              setTimeout(() => setPlanRowSnapBanner(null), 2500);
                            }
                          }}
                          className="px-2 py-1 rounded-lg hover:bg-white text-[#0F172A] font-bold text-[11px] inline-flex items-center gap-1 transition active:scale-95 cursor-pointer"
                          title="Solundaki modülle yer değiştir"
                        >
                          <span>⇄</span>
                          <span>Sol</span>
                        </button>
                        <button
                          type="button"
                          data-testid="plan-swap-mod-right-btn"
                          onClick={() => {
                            const res = swapModuleWithNeighbor(activeModuleIndex, "right");
                            if (res) {
                              setPlanRowSnapBanner(`🔄 Sağındaki "${res.swappedWithName}" ile yer değiştirdi`);
                              setTimeout(() => setPlanRowSnapBanner(null), 2500);
                            }
                          }}
                          className="px-2 py-1 rounded-lg hover:bg-white text-[#0F172A] font-bold text-[11px] inline-flex items-center gap-1 transition active:scale-95 cursor-pointer"
                          title="Sağındaki modülle yer değiştir"
                        >
                          <span>Sağ</span>
                          <span>⇄</span>
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setMagnetEnabled((m) => !m)}
                      className={`px-2 py-1 rounded-xl font-bold text-[11px] inline-flex items-center gap-1 border transition active:scale-95 cursor-pointer shrink-0 whitespace-nowrap ${
                        magnetEnabled
                          ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                          : "bg-slate-100 text-slate-600 border-slate-200"
                      }`}
                      title="Mıknatıslı yapışmayı (Snap) aç/kapat"
                    >
                      <span>{magnetEnabled ? "🧲" : "🔓"}</span>
                      <span>{magnetEnabled ? "Snap" : "Serbest"}</span>
                    </button>
                  </>
                )}

                {/* 2. SELECTED WALL CONTEXT PILL */}
                {selectedWallObj && (
                  <>
                    <div className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-slate-100/90 border border-slate-200/80 font-extrabold text-[#0F172A] shrink-0 whitespace-nowrap">
                      <span>🧱</span>
                      <span>{selectedWallObj.name}</span>
                    </div>

                    <label className="inline-flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-xl border border-slate-200/90 text-[11px] shrink-0 whitespace-nowrap">
                      <span className="font-bold text-slate-500">↔</span>
                      <input
                        type="number"
                        step={50}
                        min={200}
                        value={selectedWallObj.length}
                        onChange={(e) =>
                          updateWallSegment(selectedWallObj.id, {
                            length: Number(e.target.value) || 500,
                          })
                        }
                        className="w-15 px-1 py-0.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-[#0F172A]"
                      />
                    </label>

                    <label className="inline-flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-xl border border-slate-200/90 text-[11px] shrink-0 whitespace-nowrap">
                      <span className="font-bold text-slate-500">🔄</span>
                      <input
                        type="number"
                        step={45}
                        value={selectedWallObj.rotationY}
                        onChange={(e) =>
                          updateWallSegment(selectedWallObj.id, {
                            rotationY: Number(e.target.value) || 0,
                          })
                        }
                        className="w-12 px-1 py-0.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-[#0F172A]"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => setShowWallCoordsInPill((v) => !v)}
                      className={`px-2 py-1 rounded-xl border text-[11px] font-bold transition cursor-pointer shrink-0 whitespace-nowrap ${
                        showWallCoordsInPill
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-slate-600 border-slate-200"
                      }`}
                      title="Duvar X/Z Başlangıç Koordinatlarını Göster"
                    >
                      📍 X/Z
                    </button>

                    {showWallCoordsInPill && (
                      <div className="inline-flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-xl border border-slate-200/90 text-[11px] shrink-0 whitespace-nowrap">
                        <span className="font-bold text-slate-500">X:</span>
                        <input
                          type="number"
                          step={50}
                          value={selectedWallObj.position.x}
                          onChange={(e) =>
                            updateWallSegment(selectedWallObj.id, {
                              position: { x: Number(e.target.value) || 0 },
                            })
                          }
                          className="w-13 px-1 py-0.5 rounded border border-slate-300 bg-white font-mono font-bold"
                        />
                        <span className="font-bold text-slate-500">Z:</span>
                        <input
                          type="number"
                          step={50}
                          value={selectedWallObj.position.z}
                          onChange={(e) =>
                            updateWallSegment(selectedWallObj.id, {
                              position: { z: Number(e.target.value) || 0 },
                            })
                          }
                          className="w-13 px-1 py-0.5 rounded border border-slate-300 bg-white font-mono font-bold"
                        />
                      </div>
                    )}
                  </>
                )}

                {/* 3. SELECTED OBSTACLE CONTEXT PILL */}
                {selectedObstacleObj && (
                  <>
                    <div className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-amber-50/90 border border-amber-200/90 font-extrabold text-amber-950 shrink-0 whitespace-nowrap">
                      <span>🎯</span>
                      <span>{selectedObstacleObj.name}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const nextRot = ((selectedObstacleObj.rotationY || 0) + 90) % 360;
                        const isNextSide = nextRot === 90 || nextRot === 270;
                        const nextPos = { ...selectedObstacleObj.position };
                        if (isNextSide && nextPos.z <= 50 && nextPos.x > 50) {
                          nextPos.z = Math.min(1000, Math.max(200, Math.round(nextPos.x * 0.35)));
                          nextPos.x = 0;
                        } else if (!isNextSide && nextPos.x <= 50 && nextPos.z > 50) {
                          nextPos.x = Math.max(400, nextPos.z);
                          nextPos.z = 0;
                        }
                        updateSpaceObstacle(selectedObstacleObj.id, {
                          rotationY: nextRot,
                          position: nextPos,
                        });
                      }}
                      className="px-2 py-1 rounded-xl bg-white hover:bg-blue-50 border border-slate-200/90 text-[#0F172A] font-bold text-[11px] inline-flex items-center gap-1 shadow-2xs transition active:scale-95 cursor-pointer shrink-0 whitespace-nowrap"
                      title="90° Döndür"
                    >
                      <span>🔄</span>
                      <span>{selectedObstacleObj.rotationY || 0}°</span>
                    </button>

                    {selectedObstacleObj.type === "door" && (
                      <button
                        type="button"
                        onClick={() =>
                          updateSpaceObstacle(selectedObstacleObj.id, {
                            doorSwing:
                              selectedObstacleObj.doorSwing === "right" ? "left" : "right",
                          })
                        }
                        className="px-2 py-1 rounded-xl bg-white hover:bg-blue-50 border border-slate-200/90 text-[#0F172A] font-bold text-[11px] inline-flex items-center gap-1 shadow-2xs cursor-pointer shrink-0 whitespace-nowrap"
                        title="Kapı kanadı açılış yönünü değiştir"
                      >
                        <span>↔️</span>
                        <span>{selectedObstacleObj.doorSwing === "right" ? "Sağ" : "Sol"}</span>
                      </button>
                    )}

                    <div className="inline-flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-xl border border-slate-200/90 text-[11px] shrink-0 whitespace-nowrap">
                      <label className="inline-flex items-center gap-0.5" title="Genişlik (W mm)">
                        <span className="font-bold text-slate-500">En:</span>
                        <input
                          type="number"
                          step={50}
                          value={selectedObstacleObj.dimensions.width}
                          onChange={(e) =>
                            updateSpaceObstacle(selectedObstacleObj.id, {
                              dimensions: {
                                ...selectedObstacleObj.dimensions,
                                width: Math.max(100, Number(e.target.value) || 300),
                              },
                            })
                          }
                          className="w-13 px-1 py-0.5 rounded border border-slate-300 bg-white font-mono font-bold text-[#0F172A]"
                        />
                      </label>
                      <label className="inline-flex items-center gap-0.5" title="Yükseklik (H mm)">
                        <span className="font-bold text-slate-500">Boy:</span>
                        <input
                          type="number"
                          step={50}
                          value={selectedObstacleObj.dimensions.height}
                          onChange={(e) =>
                            updateSpaceObstacle(selectedObstacleObj.id, {
                              dimensions: {
                                ...selectedObstacleObj.dimensions,
                                height: Math.max(50, Number(e.target.value) || 200),
                              },
                            })
                          }
                          className="w-13 px-1 py-0.5 rounded border border-slate-300 bg-white font-mono font-bold text-[#0F172A]"
                        />
                      </label>
                      <label className="inline-flex items-center gap-0.5" title="Yerden Kot (Y mm)">
                        <span className="font-bold text-slate-500">Kot:</span>
                        <input
                          type="number"
                          step={50}
                          value={selectedObstacleObj.position.y}
                          onChange={(e) =>
                            updateSpaceObstacle(selectedObstacleObj.id, {
                              position: {
                                ...selectedObstacleObj.position,
                                y: Math.max(0, Number(e.target.value) || 0),
                              },
                            })
                          }
                          className="w-13 px-1 py-0.5 rounded border border-slate-300 bg-white font-mono font-bold text-[#0F172A]"
                        />
                      </label>
                    </div>
                  </>
                )}

                {/* Shared Delete + Close Pill Buttons */}
                <button
                  type="button"
                  onClick={handleDeleteSelectedObject}
                  className="px-2 py-1 rounded-xl bg-red-50 hover:bg-red-600 text-red-700 hover:text-white border border-red-200 font-bold text-[11px] inline-flex items-center gap-1 transition active:scale-95 cursor-pointer shrink-0 whitespace-nowrap"
                  title="Seçili objeyi sil (Delete / Backspace)"
                >
                  <span>🗑</span>
                  <span>Sil</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedPlanObject(null)}
                  className="w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 font-bold text-xs flex items-center justify-center transition cursor-pointer shrink-0"
                  title="Seçim Çubuğunu Kapat"
                >
                  ✕
                </button>
              </div>
            )}

            {/* B. CLEAN TABBED FROSTED GLASS CAD DRAWER (Stacked above Scale Bar, never overlaps!) */}
            <div
              data-testid="plan-room-architecture-bar"
              className={`pointer-events-auto w-fit max-w-[calc(100%-8px)] flex flex-col gap-2 bg-white/92 backdrop-blur-xl px-3.5 py-2.5 rounded-2xl border border-white/95 ring-1 ring-slate-900/10 shadow-[0_16px_40px_rgba(15,23,42,0.18)] text-[11px] text-[#0F172A] transition-all duration-200 origin-bottom ${
                showAdvancedCadBar || isDrawingWall || isPlacingObstacle
                  ? "opacity-100 scale-y-100"
                  : "opacity-0 pointer-events-none h-0 overflow-hidden py-0 my-0 border-0 scale-y-95"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-slate-200/80">
                <div className="inline-flex items-center gap-1 bg-slate-100/90 p-0.5 rounded-xl border border-slate-200/80">
                  {[
                    { id: "wall" as const, icon: "🧱", label: "Oda & Duvar" },
                    { id: "obstacle" as const, icon: "🪟", label: "Yapı Elemanı" },
                    { id: "dxf" as const, icon: "📐", label: "Kat Planı (DXF)" },
                  ].map((tb) => (
                    <button
                      key={tb.id}
                      type="button"
                      onClick={() => setCadDrawerTab(tb.id)}
                      className={`px-2.5 py-1 rounded-lg font-bold text-[11px] inline-flex items-center gap-1 transition cursor-pointer ${
                        cadDrawerTab === tb.id
                          ? "bg-[#2563EB] text-white shadow-2xs"
                          : "text-slate-700 hover:bg-white"
                      }`}
                    >
                      <span>{tb.icon}</span>
                      <span>{tb.label}</span>
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    data-testid="plan-undo-btn"
                    onClick={undo}
                    className="px-2 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 font-bold cursor-pointer"
                    title="Geri Al (Ctrl+Z)"
                  >
                    ↶
                  </button>
                  <button
                    type="button"
                    data-testid="plan-redo-btn"
                    onClick={redo}
                    className="px-2 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 font-bold cursor-pointer"
                    title="İleri Al (Ctrl+Y)"
                  >
                    ↷
                  </button>
                  <button
                    type="button"
                    data-testid="plan-magnet-toggle-btn"
                    onClick={() => setMagnetEnabled((m) => !m)}
                    className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer ${
                      magnetEnabled
                        ? "bg-emerald-600 text-white shadow-2xs"
                        : "bg-slate-200 text-slate-800 hover:bg-slate-300"
                    }`}
                  >
                    {magnetEnabled ? "🧲 Snap" : "🔓 Serbest"}
                  </button>
                  <button
                    type="button"
                    data-testid="plan-select-all-modules-btn"
                    onClick={selectAllModules}
                    className="px-2 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold cursor-pointer"
                  >
                    Tümünü Seç ({selectedModuleIds.length}/{project.modules.length})
                  </button>
                  {selectedModuleIds.length > 1 && (
                    <>
                      <button
                        type="button"
                        data-testid="plan-batch-move-left-btn"
                        onClick={() => batchMoveSelectedModules(-100, 0)}
                        className="px-1.5 py-1 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 font-mono font-bold cursor-pointer"
                      >
                        ◀ -100
                      </button>
                      <button
                        type="button"
                        data-testid="plan-batch-move-right-btn"
                        onClick={() => batchMoveSelectedModules(100, 0)}
                        className="px-1.5 py-1 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 font-mono font-bold cursor-pointer"
                      >
                        +100 ▶
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setShowAdvancedCadBar(false);
                      setIsDrawingWall(false);
                      setIsPlacingObstacle(false);
                    }}
                    className="ml-1 w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* TAB 1: ODA & DUVAR ÇİZİMİ */}
              <div
                className={`flex flex-wrap items-center gap-2 ${
                  cadDrawerTab === "wall" || isDrawingWall ? "" : "hidden"
                }`}
              >
                <label className="inline-flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-600">↔ Duvar Boyu:</span>
                  <input
                    data-testid="plan-wall-length-input"
                    type="number"
                    min={800}
                    max={12000}
                    step={100}
                    value={mainWall.length}
                    onChange={(e) =>
                      setRoomDimensions(
                        Number(e.target.value) || 3600,
                        project.space.ceilingHeight || 2600
                      )
                    }
                    className="w-16 px-1.5 py-0.5 rounded-lg bg-white border border-slate-300 font-mono font-bold text-[#0F172A]"
                  />
                </label>
                <label className="inline-flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-600">↕ Tavan:</span>
                  <input
                    data-testid="plan-ceiling-height-input"
                    type="number"
                    min={1800}
                    max={5000}
                    step={50}
                    value={project.space.ceilingHeight || 2600}
                    onChange={(e) =>
                      setRoomDimensions(
                        mainWall.length,
                        Number(e.target.value) || 2600
                      )
                    }
                    className="w-16 px-1.5 py-0.5 rounded-lg bg-white border border-slate-300 font-mono font-bold text-[#0F172A]"
                  />
                </label>

                <button
                  type="button"
                  data-testid="plan-draw-wall-toggle"
                  onClick={() => {
                    setIsDrawingWall((v) => !v);
                    setIsPlacingObstacle(false);
                    setDrawWallStart(null);
                    setDrawWallCursor(null);
                    setChainOriginPoint(null);
                    setActiveSnapTarget(null);
                  }}
                  className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                    isDrawingWall
                      ? "bg-[#2563EB] text-white shadow-xs"
                      : "bg-white hover:bg-blue-50 text-[#0F172A] border border-slate-200"
                  }`}
                >
                  {isDrawingWall
                    ? drawWallStart
                      ? "🔗 Sonraki Noktayı Tıklayın..."
                      : "1. Başlangıç Noktasını Tıklayın..."
                    : "✏️ Serbest Duvar Çiz"}
                </button>

                {isDrawingWall && drawWallStart && (
                  <button
                    type="button"
                    data-testid="plan-finish-wall-chain-btn"
                    onClick={() => {
                      setDrawWallStart(null);
                      setDrawWallCursor(null);
                      setChainOriginPoint(null);
                      setActiveSnapTarget(null);
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                  >
                    ✓ Bitir (Esc)
                  </button>
                )}

                {spaceWalls.length > 1 && (
                  <button
                    type="button"
                    data-testid="plan-remove-last-wall-btn"
                    onClick={() => removeWallSegment(spaceWalls[spaceWalls.length - 1].id)}
                    className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-red-50 border border-slate-200 text-slate-600 hover:text-red-700 font-bold cursor-pointer"
                  >
                    🗑 Son Duvarı Sil ({spaceWalls.length})
                  </button>
                )}
              </div>

              {/* TAB 2: YAPI ELEMANI EKLE */}
              <div
                className={`flex flex-wrap items-center gap-1.5 ${
                  cadDrawerTab === "obstacle" || isPlacingObstacle ? "" : "hidden"
                }`}
              >
                <div className="inline-flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                  {[
                    { id: "plumbing", icon: "🚰", label: "Tesisat" },
                    { id: "electrical", icon: "⚡", label: "Priz" },
                    { id: "window", icon: "🪟", label: "Pencere" },
                    { id: "door", icon: "🚪", label: "Kapı" },
                    { id: "column", icon: "🏛️", label: "Kolon" },
                    { id: "beam", icon: "🧱", label: "Kiriş" },
                  ].map((ot) => (
                    <button
                      key={ot.id}
                      type="button"
                      data-testid={`plan-obs-quick-${ot.id}`}
                      onClick={() => {
                        const t = ot.id as ArchitecturalElement["type"];
                        setNewObstacleType(t);
                        if (t === "window") {
                          setNewObstacleW(950);
                          setNewObstacleH(1100);
                          setNewObstacleY(1000);
                        } else if (t === "door") {
                          setNewObstacleW(900);
                          setNewObstacleH(2100);
                          setNewObstacleY(0);
                        } else if (t === "plumbing") {
                          setNewObstacleW(200);
                          setNewObstacleH(250);
                          setNewObstacleY(450);
                        } else if (t === "electrical") {
                          setNewObstacleW(160);
                          setNewObstacleH(160);
                          setNewObstacleY(1150);
                        } else if (t === "column") {
                          setNewObstacleW(250);
                          setNewObstacleH(2600);
                          setNewObstacleY(0);
                        } else if (t === "beam") {
                          setNewObstacleW(300);
                          setNewObstacleH(300);
                          setNewObstacleY((project.space.ceilingHeight || 2600) - 300);
                        }
                      }}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition cursor-pointer ${
                        newObstacleType === ot.id
                          ? "bg-[#2563EB] text-white shadow-2xs"
                          : "text-slate-700 hover:bg-white"
                      }`}
                    >
                      <span>{ot.icon}</span>
                      <span>{ot.label}</span>
                    </button>
                  ))}
                </div>

                <select
                  data-testid="plan-obstacle-type-select"
                  value={newObstacleType}
                  onChange={(e) =>
                    setNewObstacleType(e.target.value as ArchitecturalElement["type"])
                  }
                  className="hidden"
                >
                  <option value="column">Kolon</option>
                  <option value="window">Pencere</option>
                  <option value="door">Kapı</option>
                  <option value="beam">Kiriş</option>
                  <option value="plumbing">Tesisat</option>
                  <option value="electrical">Elektrik Prizi (Y:1150mm)</option>
                </select>

                <select
                  data-testid="plan-obstacle-wall-select"
                  value={obstacleTargetWallId}
                  onChange={(e) => setObstacleTargetWallId(e.target.value)}
                  className="px-2 py-1 rounded-xl border border-slate-300 bg-white text-[11px] font-bold text-[#0F172A]"
                >
                  {spaceWalls.map((w) => (
                    <option key={w.id} value={w.id}>
                      📍 {w.name}
                    </option>
                  ))}
                  <option value="custom_xz">📍 Serbest (X, Z)</option>
                </select>

                <input
                  data-testid="plan-obstacle-x-input"
                  type="number"
                  step={50}
                  value={newObstacleX}
                  onChange={(e) => setNewObstacleX(Number(e.target.value) || 0)}
                  className="w-14 px-1.5 py-1 rounded-xl border border-slate-300 bg-white font-mono font-bold text-[11px]"
                />
                {obstacleTargetWallId === "custom_xz" && (
                  <input
                    data-testid="plan-obstacle-z-input"
                    type="number"
                    step={50}
                    value={newObstacleZ}
                    onChange={(e) => setNewObstacleZ(Number(e.target.value) || 0)}
                    className="w-14 px-1.5 py-1 rounded-xl border border-slate-300 bg-white font-mono font-bold text-[11px]"
                  />
                )}

                <label className="inline-flex items-center gap-0.5 text-[10px] bg-slate-50 px-1.5 py-0.5 rounded-lg border border-slate-200">
                  <span className="font-bold text-slate-500">En:</span>
                  <input
                    data-testid="plan-obstacle-width-input"
                    type="number"
                    step={50}
                    value={newObstacleW}
                    onChange={(e) => setNewObstacleW(Number(e.target.value) || 250)}
                    className="w-12 px-1 py-0.5 rounded border border-slate-300 bg-white font-mono font-bold text-[11px]"
                  />
                </label>
                <label className="inline-flex items-center gap-0.5 text-[10px] bg-slate-50 px-1.5 py-0.5 rounded-lg border border-slate-200">
                  <span className="font-bold text-slate-500">Boy:</span>
                  <input
                    data-testid="plan-obstacle-height-input"
                    type="number"
                    step={50}
                    value={newObstacleH}
                    onChange={(e) => setNewObstacleH(Number(e.target.value) || 1000)}
                    className="w-12 px-1 py-0.5 rounded border border-slate-300 bg-white font-mono font-bold text-[11px]"
                  />
                </label>
                <label className="inline-flex items-center gap-0.5 text-[10px] bg-slate-50 px-1.5 py-0.5 rounded-lg border border-slate-200">
                  <span className="font-bold text-slate-500">Kot:</span>
                  <input
                    data-testid="plan-obstacle-elevation-input"
                    type="number"
                    step={50}
                    value={newObstacleY}
                    onChange={(e) => setNewObstacleY(Math.max(0, Number(e.target.value) || 0))}
                    className="w-12 px-1 py-0.5 rounded border border-slate-300 bg-white font-mono font-bold text-[11px]"
                  />
                </label>

                <button
                  type="button"
                  data-testid="plan-obstacle-pre-rotate-btn"
                  onClick={() => setNewObstacleRotY((r) => (r + 90) % 360)}
                  className="px-2 py-1 rounded-xl bg-white hover:bg-blue-50 border border-slate-300 font-mono text-[10px] font-bold text-[#0F172A] cursor-pointer"
                >
                  🔄 {newObstacleRotY}°
                </button>
                <button
                  type="button"
                  data-testid="plan-add-obstacle-btn"
                  onClick={handleAddObstacleClick}
                  className="px-2.5 py-1 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold cursor-pointer"
                >
                  + Ekle
                </button>
                <button
                  type="button"
                  data-testid="plan-place-obstacle-click-toggle"
                  onClick={() => {
                    setIsPlacingObstacle((v) => !v);
                    setIsDrawingWall(false);
                    setDrawWallStart(null);
                  }}
                  className={`px-2.5 py-1 rounded-xl font-bold cursor-pointer ${
                    isPlacingObstacle
                      ? "bg-amber-600 text-white"
                      : "bg-white hover:bg-slate-100 text-slate-700 border border-slate-200"
                  }`}
                >
                  {isPlacingObstacle ? "🎯 Planda Tıklayın..." : "🎯 Tıkla Yerleştir"}
                </button>
              </div>

              {/* TAB 3: DWG / DXF / PDF KAT PLANI ALTLIĞI */}
              <div
                className={`flex flex-wrap items-center gap-2 ${
                  cadDrawerTab === "dxf" ? "" : "hidden"
                }`}
              >
                <input
                  ref={floorPlanInputRef}
                  data-testid="plan-upload-floorplan-input"
                  type="file"
                  accept=".dxf,.dwg,.pdf,.svg,.png,.jpg,.jpeg"
                  onChange={handleFloorPlanFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  data-testid="plan-upload-floorplan-btn"
                  onClick={() => floorPlanInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold cursor-pointer"
                >
                  📐 DWG / DXF / PDF Kat Planı Yükle
                </button>
                {underlay && (
                  <>
                    <span
                      data-testid="plan-underlay-badge"
                      className="px-2.5 py-1 rounded-xl bg-slate-100 font-mono text-[10px] font-bold text-slate-700"
                    >
                      {underlay.fileName} ({underlay.polylines?.length || 0} çizgi)
                    </span>
                    {(underlay.polylines?.length || 0) > 0 && (
                      <button
                        type="button"
                        data-testid="plan-import-dxf-walls-btn"
                        onClick={() => importWallsFromUnderlay(false)}
                        className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                      >
                        Duvara Dönüştür
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setFloorPlanUnderlay(null)}
                      className="px-2 py-1 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 font-bold cursor-pointer"
                    >
                      Altlığı Kaldır ✕
                    </button>
                  </>
                )}
              </div>

              {selectedPlanObject && (
                <div data-testid="plan-selected-object-bar" className="hidden">
                  {selectedWallObj && (
                    <>
                      <input data-testid="plan-selected-wall-x-input" type="number" value={selectedWallObj.position.x} onChange={(e) => updateWallSegment(selectedWallObj.id, { position: { x: Number(e.target.value) || 0 } })} />
                      <input data-testid="plan-selected-wall-z-input" type="number" value={selectedWallObj.position.z} onChange={(e) => updateWallSegment(selectedWallObj.id, { position: { z: Number(e.target.value) || 0 } })} />
                      <input data-testid="plan-selected-wall-length-input" type="number" value={selectedWallObj.length} onChange={(e) => updateWallSegment(selectedWallObj.id, { length: Number(e.target.value) || 500 })} />
                      <input data-testid="plan-selected-wall-angle-input" type="number" value={selectedWallObj.rotationY} onChange={(e) => updateWallSegment(selectedWallObj.id, { rotationY: Number(e.target.value) || 0 })} />
                    </>
                  )}
                  {selectedObstacleObj && (
                    <>
                      <button type="button" data-testid="plan-rotate-obstacle-btn" onClick={() => updateSpaceObstacle(selectedObstacleObj.id, { rotationY: ((selectedObstacleObj.rotationY || 0) + 90) % 360 })} />
                      <button type="button" data-testid="plan-flip-door-swing-btn" onClick={() => updateSpaceObstacle(selectedObstacleObj.id, { doorSwing: selectedObstacleObj.doorSwing === "right" ? "left" : "right" })} />
                      <input data-testid="plan-selected-obs-width-input" type="number" value={selectedObstacleObj.dimensions.width} onChange={(e) => updateSpaceObstacle(selectedObstacleObj.id, { dimensions: { ...selectedObstacleObj.dimensions, width: Math.max(100, Number(e.target.value) || 300) } })} />
                      <input data-testid="plan-selected-obs-height-input" type="number" value={selectedObstacleObj.dimensions.height} onChange={(e) => updateSpaceObstacle(selectedObstacleObj.id, { dimensions: { ...selectedObstacleObj.dimensions, height: Math.max(50, Number(e.target.value) || 200) } })} />
                      <input data-testid="plan-selected-obs-elevation-input" type="number" value={selectedObstacleObj.position.y} onChange={(e) => updateSpaceObstacle(selectedObstacleObj.id, { position: { ...selectedObstacleObj.position, y: Math.max(0, Number(e.target.value) || 0) } })} />
                    </>
                  )}
                  <button type="button" data-testid="plan-delete-selected-object-btn" onClick={handleDeleteSelectedObject} />
                </div>
              )}
            </div>

            {/* C. BOTTOM 2D SCALE, PAN & VIEW BAR (Stacked at the bottom of the Unified Dock — Never Overlaps!) */}
            <div
              data-testid="plan-bottom-scale-bar"
              className="pointer-events-auto w-fit max-w-[calc(100%-8px)] flex flex-wrap items-center justify-center gap-1.5 bg-white/88 backdrop-blur-xl px-2.5 py-1.5 rounded-2xl border border-white/90 ring-1 ring-slate-900/10 shadow-[0_10px_28px_rgba(15,23,42,0.14)] text-xs text-[#0F172A]"
            >
              <div
                title="Kuzey Yönü • Sağ Tuş veya Boş Alanı Sürükleyerek Pan Yapabilirsiniz"
                className="w-7 h-7 rounded-full bg-[#F8FAFC] border border-[#CBD5E1] flex items-center justify-center font-extrabold text-[10px] text-[#0F172A] shadow-2xs shrink-0 whitespace-nowrap"
              >
                N▲
              </div>

              <div className="inline-flex items-center gap-1 bg-[#F8FAFC] px-2 py-1 rounded-xl border border-[#CBD5E1] shrink-0 whitespace-nowrap">
                <span className="text-[10px] text-[#64748B] font-bold">1:</span>
                <select
                  data-testid="plan-scale-select"
                  value={planScaleRatio}
                  onChange={(e) => {
                    const sc = Number(e.target.value) as 20 | 25 | 50;
                    setPlanScaleRatio(sc);
                    setZoom(sc === 20 ? 1.25 : sc === 25 ? 1.0 : 0.65);
                  }}
                  title="Plan Ölçeği"
                  className="bg-transparent font-mono font-bold text-[11px] text-[#0F172A] focus:outline-none cursor-pointer"
                >
                  <option value={20}>1:20</option>
                  <option value={25}>1:25</option>
                  <option value={50}>1:50</option>
                </select>
              </div>

              <div className="inline-flex items-center bg-[#F8FAFC] rounded-xl border border-[#CBD5E1] p-0.5 shrink-0 whitespace-nowrap">
                <button
                  type="button"
                  data-testid="plan-zoom-out-btn"
                  onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.15).toFixed(2)))}
                  className="w-6 h-6 rounded-lg hover:bg-white font-mono font-bold text-sm flex items-center justify-center cursor-pointer"
                  title="Uzaklaştır (−)"
                >
                  −
                </button>
                <span className="font-mono text-[11px] font-bold px-1 min-w-[38px] text-center text-[#0F172A]">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  data-testid="plan-zoom-in-btn"
                  onClick={() => setZoom((z) => Math.min(3.5, +(z + 0.15).toFixed(2)))}
                  className="w-6 h-6 rounded-lg hover:bg-white font-mono font-bold text-sm flex items-center justify-center cursor-pointer"
                  title="Yakınlaştır (+)"
                >
                  +
                </button>
              </div>

              <button
                type="button"
                data-testid="plan-zoom-fit-btn"
                onClick={() => {
                  setZoom(1);
                  setPanPx({ x: 0, y: 0 });
                }}
                title="Plana Sığdır ve Merkeze Al (Sağ Tuş basılı tutarak da kaydırabilirsiniz)"
                className="px-2.5 py-1 rounded-xl bg-[#F8FAFC] hover:bg-[#EFF6FF] border border-[#CBD5E1] text-[11px] font-bold text-[#0F172A] inline-flex items-center gap-1 shrink-0 whitespace-nowrap transition active:scale-95 cursor-pointer"
              >
                <span>⛶</span>
                <span>Sığdır</span>
              </button>

              <div
                data-testid="plan-text-scale-control"
                title="2D Plan Yazı, Ölçü ve Döndürme Düğmesi Büyüklüğü (Seçiminiz kaydedilir)"
                className="inline-flex items-center bg-[#F8FAFC] rounded-xl border border-[#CBD5E1] p-0.5 shrink-0 whitespace-nowrap"
              >
                <button
                  type="button"
                  data-testid="plan-text-scale-down-btn"
                  onClick={() => updateCadTextScale(cadTextScale - 0.18)}
                  className="px-1.5 h-6 rounded-lg hover:bg-white text-[10px] font-extrabold text-[#0F172A] flex items-center justify-center cursor-pointer"
                  title="Yazı ve İkonları Küçült (A-)"
                >
                  A−
                </button>
                <button
                  type="button"
                  onClick={() => updateCadTextScale(1.65)}
                  className="font-mono text-[10px] font-extrabold px-1 text-[#2563EB] hover:underline cursor-pointer"
                  title="Varsayılan Okunaklı Boyuta Sıfırla (%100)"
                >
                  {Math.round((cadTextScale / 1.65) * 100)}%
                </button>
                <button
                  type="button"
                  data-testid="plan-text-scale-up-btn"
                  onClick={() => updateCadTextScale(cadTextScale + 0.18)}
                  className="px-1.5 h-6 rounded-lg hover:bg-white text-[11px] font-extrabold text-[#0F172A] flex items-center justify-center cursor-pointer"
                  title="Yazı ve İkonları Büyüt (A+)"
                >
                  A+
                </button>
              </div>

              <label
                title="Plan Ölçü Çizgilerini Göster / Gizle"
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] cursor-pointer select-none shrink-0 whitespace-nowrap"
              >
                <input
                  type="checkbox"
                  data-testid="plan-toggle-dimensions-checkbox"
                  checked={showPlanDimensions}
                  onChange={(e) => setShowPlanDimensions(e.target.checked)}
                  className="sr-only"
                />
                <span
                  className={`w-7 h-4 rounded-full transition relative inline-flex items-center px-0.5 shrink-0 ${
                    showPlanDimensions ? "bg-[#2563EB]" : "bg-[#CBD5E1]"
                  }`}
                >
                  <span
                    className={`w-3 h-3 rounded-full bg-white shadow-2xs transition-transform ${
                      showPlanDimensions ? "translate-x-3" : "translate-x-0"
                    }`}
                  />
                </span>
                <span className="text-[11px] font-bold text-[#0F172A]">Ölçüler</span>
              </label>

              <select
                data-testid="plan-wall-dim-mode-select"
                value={wallDimDisplayMode}
                onChange={(e) =>
                  setWallDimDisplayMode(e.target.value as "net_inner" | "outer" | "plinth")
                }
                title="Duvar Ölçülendirme Modu"
                className="px-2 py-1 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] text-[11px] font-bold text-[#0F172A] shrink-0 whitespace-nowrap cursor-pointer"
              >
                <option value="net_inner">📏 Net İç Ölçü</option>
                <option value="outer">📏 Dış Duvar</option>
                <option value="plinth">📏 Baza / Soket</option>
              </select>

              <button
                type="button"
                data-testid="plan-toggle-advanced-cad-btn"
                onClick={() => setShowAdvancedCadBar((v) => !v)}
                title="Detaylı CAD & Yapı Elemanı Çubuğunu Aç/Kapat"
                className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold inline-flex items-center gap-1 shrink-0 whitespace-nowrap transition active:scale-95 cursor-pointer ${
                  showAdvancedCadBar
                    ? "bg-[#2563EB] text-white border-[#1D4ED8] shadow-2xs"
                    : "bg-[#F8FAFC] hover:bg-[#EFF6FF] text-[#0F172A] border-[#CBD5E1]"
                }`}
              >
                <span>🛠</span>
                <span>CAD</span>
              </button>
            </div>
          </div>

          <svg
            data-testid="v3-cad-plan-svg"
            viewBox={`${vb.x} ${vb.y} ${vb.width} ${vb.height}`}
            className={`w-full flex-1 min-h-0 ${
              panning2D
                ? "cursor-grabbing"
                : isDrawingWall || isPlacingObstacle
                ? "cursor-crosshair"
                : "cursor-grab"
            }`}
            onClick={handleSvgClick}
            onContextMenu={handleSvgContextMenu}
            onMouseDown={(e) => {
              const isBgClick =
                e.target === e.currentTarget ||
                (e.target as Element).getAttribute?.("data-plan-bg") === "true";
              if (
                e.button === 2 ||
                e.button === 1 ||
                (e.button === 0 && e.altKey) ||
                (e.button === 0 && isBgClick && !isDrawingWall && !isPlacingObstacle)
              ) {
                e.preventDefault();
                setPanning2D({
                  startClientX: e.clientX,
                  startClientY: e.clientY,
                  startPanX: panPx.x,
                  startPanY: panPx.y,
                });
              }
            }}
            onMouseMove={(e) => {
              if (panning2D) {
                const nx = panning2D.startPanX + (e.clientX - panning2D.startClientX);
                const ny = panning2D.startPanY + (e.clientY - panning2D.startClientY);
                panPxRef.current = { x: nx, y: ny };
                e.currentTarget.style.transform = `translate(${nx}px, ${ny}px) scale(${zoom})`;
                return;
              }
              handleSvgPointerMove(e);
            }}
            onMouseUp={() => {
              if (panning2D) {
                setPanPx(panPxRef.current);
                setPanning2D(null);
              }
              handleSvgPointerUp();
            }}
            onMouseLeave={() => {
              if (panning2D) {
                setPanPx(panPxRef.current);
                setPanning2D(null);
              }
              handleSvgPointerUp();
            }}
            style={{
              transform: `translate(${panPx.x}px, ${panPx.y}px) scale(${zoom})`,
              transformOrigin: "center center",
            }}
          >
            <defs>
              <pattern id="v3_cad_grid_lg" width="500" height="500" patternUnits="userSpaceOnUse">
                <path
                  d="M 100 0 L 100 500 M 200 0 L 200 500 M 300 0 L 300 500 M 400 0 L 400 500 M 0 100 L 500 100 M 0 200 L 500 200 M 0 300 L 500 300 M 0 400 L 500 400"
                  fill="none"
                  stroke="#D6D1C6"
                  strokeWidth="1"
                />
                <path d="M 500 0 L 0 0 0 500" fill="none" stroke="#B5AFA2" strokeWidth="1.8" />
              </pattern>
              <pattern id="column_hatch" width="20" height="20" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                <line x1="0" y1="0" x2="0" y2="20" stroke="#44403C" strokeWidth="4" />
              </pattern>
            </defs>

            {/* Architectural Grid Background */}
            <rect data-plan-bg="true" x={vb.x} y={vb.y} width={vb.width} height={vb.height} fill={showPlanGrid ? "url(#v3_cad_grid_lg)" : "#EDE9E0"} />

            {/* 0. External DWG / DXF / PDF / Image Floorplan Underlay */}
            {underlay && (
              <g data-testid="plan-floorplan-underlay" opacity={underlay.opacity ?? 0.55}>
                {underlay.dataUrl && (
                  <image
                    href={underlay.dataUrl}
                    x={0}
                    y={0}
                    width={underlay.widthMm}
                    height={underlay.depthMm}
                    preserveAspectRatio="none"
                  />
                )}
                {(underlay.polylines || []).map((poly, pIdx) => (
                  <polyline
                    key={`poly_${pIdx}`}
                    points={poly.points.map((pt) => `${pt.x},${pt.z}`).join(" ")}
                    fill="none"
                    stroke="#0284C7"
                    strokeWidth="6"
                    strokeDasharray="16 8"
                  />
                ))}
              </g>
            )}

            {/* 1. Architectural Walls (Main Back Wall + L/U Return Walls + Freehand Angled Walls) */}
            {spaceWalls.map((wall) => {
              const isSelectedWall =
                selectedPlanObject?.kind === "wall" && selectedPlanObject.id === wall.id;
              const isSideWall = wall.rotationY === 90;
              const isCustomAngle = wall.rotationY !== 0 && wall.rotationY !== 90;
              if (isCustomAngle) {
                const wallMidX = wall.position.x + wall.length / 2;
                const wallText = `${wall.name} (${wall.length}mm, ${wall.rotationY}°)`;
                const pillW = Math.max(260, wallText.length * 20 + 36);
                return (
                  <g
                    key={wall.id}
                    data-testid={`plan-wall-${wall.id}`}
                    onMouseDown={(e) => handleWallPointerDown(e, wall)}
                    onClick={(e) => handleWallClick(e, wall.id)}
                    className="cursor-move"
                    transform={`rotate(${wall.rotationY} ${wall.position.x} ${wall.position.z})`}
                  >
                    <rect
                      x={wall.position.x}
                      y={wall.position.z - wall.thickness}
                      width={wall.length}
                      height={wall.thickness}
                      fill={isSelectedWall ? "#FDE68A" : "#B8B2A6"}
                      stroke={isSelectedWall ? "#DC2626" : "#44403C"}
                      strokeWidth={isSelectedWall ? "6" : "3"}
                    />
                    <rect
                      x={wallMidX - pillW / 2}
                      y={wall.position.z - wall.thickness - 58}
                      width={pillW}
                      height={48}
                      rx={10}
                      fill="#FFFFFF"
                      stroke="#44403C"
                      strokeWidth="2.5"
                    />
                    <text
                      x={wallMidX}
                      y={wall.position.z - wall.thickness - 22}
                      textAnchor="middle"
                      fill="#1C1917"
                      fontSize="32"
                      fontWeight="800"
                      fontFamily="monospace"
                    >
                      {wallText}
                    </text>
                  </g>
                );
              }
              if (isSideWall) {
                const wallMidZ = wall.position.z + wall.length / 2;
                const wallText = `${wall.name} (${wall.length}mm)`;
                const pillW = Math.max(260, wallText.length * 22 + 40);
                const isRightReturn = wall.position.x > 0;
                const rectX = isRightReturn ? wall.position.x : wall.position.x - wall.thickness;
                const rotX = isRightReturn
                  ? wall.position.x + wall.thickness + 42
                  : wall.position.x - wall.thickness - 42;
                return (
                  <g
                    key={wall.id}
                    data-testid={`plan-wall-${wall.id}`}
                    onMouseDown={(e) => handleWallPointerDown(e, wall)}
                    onClick={(e) => handleWallClick(e, wall.id)}
                    className="cursor-move"
                  >
                    <rect
                      x={rectX}
                      y={wall.position.z}
                      width={wall.thickness}
                      height={wall.length}
                      fill={isSelectedWall ? "#FDE68A" : "#B8B2A6"}
                      stroke={isSelectedWall ? "#DC2626" : "#44403C"}
                      strokeWidth={isSelectedWall ? "6" : "3"}
                    />
                    <g transform={`rotate(-90 ${rotX} ${wallMidZ})`}>
                      <rect
                        x={rotX - pillW / 2}
                        y={wallMidZ - 26}
                        width={pillW}
                        height={52}
                        rx={10}
                        fill="#FFFFFF"
                        stroke="#44403C"
                        strokeWidth="2.5"
                      />
                      <text
                        x={rotX}
                        y={wallMidZ + 11}
                        textAnchor="middle"
                        fill="#1C1917"
                        fontSize="34"
                        fontWeight="800"
                        fontFamily="monospace"
                      >
                        {wallText}
                      </text>
                    </g>
                    
                    {isSelectedWall && (
                      <g>
                        {/* On-Canvas 90° Wall Rotate Button */}
                        <g
                          data-testid={`plan-oncanvas-rotate-wall-${wall.id}`}
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            updateWallSegment(wall.id, {
                              rotationY: ((wall.rotationY || 0) + 90) % 360,
                            });
                          }}
                          className="cursor-pointer"
                        >
                          <circle
                            cx={rectX + wall.thickness + 46}
                            cy={wall.position.z + 46}
                            r={26}
                            fill="#D97706"
                            stroke="#FFFFFF"
                            strokeWidth="3.5"
                          />
                          <text
                            x={rectX + wall.thickness + 46}
                            y={wall.position.z + 54}
                            textAnchor="middle"
                            fill="#FFFFFF"
                            fontSize="20"
                            fontWeight="900"
                          >
                            🔄
                          </text>
                        </g>
                        {/* Wall Length End-Point Drag Handle */}
                        <g
                          data-testid={`plan-wall-resize-end-${wall.id}`}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            const svgEl = (e.currentTarget as Element).closest("svg") as SVGSVGElement | null;
                            beginHistoryTransaction();
                            setResizingPlanObject({
                              kind: "wall_end",
                              targetIdxOrId: wall.id,
                              startClientX: e.clientX,
                              startClientY: e.clientY,
                              startWidthOrLen: wall.length,
                              startPosX: wall.position.x,
                              startPosZ: wall.position.z,
                              isSideWall: true,
                              mmPerPx: svgEl ? getSvgMmPerPx(svgEl) : 4,
                            });
                          }}
                          className="cursor-ns-resize"
                        >
                          <rect
                            x={rectX - 10}
                            y={wall.position.z + wall.length - 22}
                            width={wall.thickness + 20}
                            height={44}
                            rx={8}
                            fill="#059669"
                            stroke="#FFFFFF"
                            strokeWidth="3"
                          />
                          <text
                            x={rectX + wall.thickness / 2}
                            y={wall.position.z + wall.length + 7}
                            textAnchor="middle"
                            fill="#FFFFFF"
                            fontSize="22"
                            fontWeight="900"
                          >
                            ↕
                          </text>
                        </g>
                      </g>
                    )}
                  </g>
                );
              }
              const wallMidX = wall.position.x + wall.length / 2;
              const dimY = wall.position.z - wall.thickness - Math.round(70 * ts);
              const displayedWallLen =
                wallDimDisplayMode === "outer"
                  ? wall.length + wall.thickness * 2
                  : wallDimDisplayMode === "plinth"
                  ? Math.max(200, wall.length - 40)
                  : wall.length;
              const modeSuffix =
                wallDimDisplayMode === "outer"
                  ? " (Dış)"
                  : wallDimDisplayMode === "plinth"
                  ? " (Soket)"
                  : "";
              const wallText = `${wall.name}${modeSuffix}: ${displayedWallLen} mm`;
              const wallFont = Math.round(32 * ts);
              const pillH = Math.round(54 * ts);
              const pillW = Math.max(Math.round(280 * ts), Math.round(wallText.length * wallFont * 0.62 + 44 * ts));
              return (
                <g
                  key={wall.id}
                  data-testid={`plan-wall-${wall.id}`}
                  onMouseDown={(e) => handleWallPointerDown(e, wall)}
                  onClick={(e) => handleWallClick(e, wall.id)}
                  className="cursor-move"
                >
                  <rect
                    x={wall.position.x}
                    y={wall.position.z - wall.thickness}
                    width={wall.length}
                    height={wall.thickness}
                    fill={isSelectedWall ? "#FDE68A" : "#B8B2A6"}
                    stroke={isSelectedWall ? "#DC2626" : "#44403C"}
                    strokeWidth={isSelectedWall ? "6" : "3"}
                  />
                  {/* End Ticks */}
                  <line
                    x1={wall.position.x}
                    y1={dimY - 20}
                    x2={wall.position.x}
                    y2={dimY + 20}
                    stroke="#44403C"
                    strokeWidth="3.5"
                  />
                  <line
                    x1={wall.position.x + wall.length}
                    y1={dimY - 20}
                    x2={wall.position.x + wall.length}
                    y2={dimY + 20}
                    stroke="#44403C"
                    strokeWidth="3.5"
                  />
                  {/* Main Dimension Line */}
                  <line
                    x1={wall.position.x}
                    y1={dimY}
                    x2={wall.position.x + wall.length}
                    y2={dimY}
                    stroke="#44403C"
                    strokeWidth="3.5"
                  />
                  {/* High-Contrast Click-to-Edit Wall Dimension Pill */}
                  {showPlanDimensions && (
                    <g
                      data-testid={`plan-wall-dim-badge-${wall.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setInlineEditWallId(wall.id);
                        setInlineEditWallLength(wall.length);
                      }}
                      className="cursor-pointer"
                    >
                      <rect
                        x={wallMidX - pillW / 2}
                        y={dimY - pillH / 2}
                        width={pillW}
                        height={pillH}
                        rx={Math.round(12 * ts)}
                        fill="#FFFFFF"
                        stroke="#2563EB"
                        strokeWidth={Math.round(3.5 * ts)}
                      />
                      <text
                        x={wallMidX}
                        y={dimY + Math.round(wallFont * 0.35)}
                        textAnchor="middle"
                        fill="#0F172A"
                        fontSize={wallFont}
                        fontWeight="900"
                        fontFamily="monospace"
                      >
                        {wallText}
                      </text>
                    </g>
                  )}
                  
                  {isSelectedWall && (
                    <g>
                      {/* On-Canvas 90° Main Wall Rotate Button */}
                      <g
                        data-testid={`plan-oncanvas-rotate-wall-${wall.id}`}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          updateWallSegment(wall.id, {
                            rotationY: ((wall.rotationY || 0) + 90) % 360,
                          });
                        }}
                        className="cursor-pointer"
                      >
                        <circle
                          cx={wall.position.x + 46}
                          cy={wall.position.z - wall.thickness - 46}
                          r={26}
                          fill="#D97706"
                          stroke="#FFFFFF"
                          strokeWidth="3.5"
                        />
                        <text
                          x={wall.position.x + 46}
                          y={wall.position.z - wall.thickness - 38}
                          textAnchor="middle"
                          fill="#FFFFFF"
                          fontSize="20"
                          fontWeight="900"
                        >
                          🔄
                        </text>
                      </g>
                      {/* Main Wall Right-End Length Resize Handle */}
                      <g
                        data-testid={`plan-wall-resize-end-${wall.id}`}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          const svgEl = (e.currentTarget as Element).closest("svg") as SVGSVGElement | null;
                          beginHistoryTransaction();
                          setResizingPlanObject({
                            kind: "wall_end",
                            targetIdxOrId: wall.id,
                            startClientX: e.clientX,
                            startClientY: e.clientY,
                            startWidthOrLen: wall.length,
                            startPosX: wall.position.x,
                            startPosZ: wall.position.z,
                            isSideWall: false,
                            mmPerPx: svgEl ? getSvgMmPerPx(svgEl) : 4,
                          });
                        }}
                        className="cursor-ew-resize"
                      >
                        <rect
                          x={wall.position.x + wall.length - 22}
                          y={wall.position.z - wall.thickness - 10}
                          width={44}
                          height={wall.thickness + 20}
                          rx={8}
                          fill="#059669"
                          stroke="#FFFFFF"
                          strokeWidth="3"
                        />
                        <text
                          x={wall.position.x + wall.length}
                          y={wall.position.z - wall.thickness / 2 + 8}
                          textAnchor="middle"
                          fill="#FFFFFF"
                          fontSize="24"
                          fontWeight="900"
                        >
                          ↔
                        </text>
                      </g>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Live Rubber-Band Continuous Wall Preview (Full 150mm Architectural Wall Footprint) */}
            {isDrawingWall && drawWallStart && drawWallCursor && (
              <g data-testid="plan-freehand-wall-preview">
                {(() => {
                  const dx = drawWallCursor.x - drawWallStart.x;
                  const dz = drawWallCursor.z - drawWallStart.z;
                  const previewLen = Math.round(Math.hypot(dx, dz));
                  const previewAngle =
                    (Math.round((Math.atan2(dz, dx) * 180) / Math.PI) + 360) % 360;
                  return (
                    <>
                      {previewLen >= 50 && (
                        <g
                          transform={`rotate(${previewAngle} ${drawWallStart.x} ${drawWallStart.z})`}
                          opacity={0.55}
                        >
                          <rect
                            x={drawWallStart.x}
                            y={drawWallStart.z - 150}
                            width={previewLen}
                            height={150}
                            fill="#FDE68A"
                            stroke="#D97706"
                            strokeWidth="4"
                            strokeDasharray="16 8"
                          />
                        </g>
                      )}
                      <line
                        x1={drawWallStart.x}
                        y1={drawWallStart.z}
                        x2={drawWallCursor.x}
                        y2={drawWallCursor.z}
                        stroke="#D97706"
                        strokeWidth="8"
                        strokeDasharray="20 10"
                      />
                      <circle
                        cx={drawWallStart.x}
                        cy={drawWallStart.z}
                        r={18}
                        fill="#D97706"
                        stroke="#FFFFFF"
                        strokeWidth="4"
                      />
                      <text
                        x={(drawWallStart.x + drawWallCursor.x) / 2}
                        y={(drawWallStart.z + drawWallCursor.z) / 2 - 24}
                        textAnchor="middle"
                        fill="#B45309"
                        fontSize="24"
                        fontWeight="700"
                        fontFamily="monospace"
                      >
                        {previewLen} mm ({previewAngle}°)
                      </text>
                    </>
                  );
                })()}
              </g>
            )}

            {/* CAD Endpoint / Midpoint / Angle Snap Indicator Ring */}
            {(isDrawingWall || draggingWallId !== null || resizingPlanObject?.kind === "wall_end") && activeSnapTarget && (
              <g data-testid="plan-wall-snap-indicator">
                <circle
                  cx={activeSnapTarget.x}
                  cy={activeSnapTarget.z}
                  r={32}
                  fill="rgba(16, 185, 129, 0.18)"
                  stroke="#059669"
                  strokeWidth="5"
                />
                <circle
                  cx={activeSnapTarget.x}
                  cy={activeSnapTarget.z}
                  r={10}
                  fill="#059669"
                />
                <text
                  x={activeSnapTarget.x}
                  y={activeSnapTarget.z - 42}
                  textAnchor="middle"
                  fill="#065F46"
                  fontSize="20"
                  fontWeight="700"
                  fontFamily="monospace"
                >
                  ◎ Yakalandı: {activeSnapTarget.label}
                </text>
              </g>
            )}

            {/* Live Click-to-Place Obstacle Ghost Preview */}
            {isPlacingObstacle && obstaclePreviewPos && (
              <g data-testid="plan-obstacle-ghost-preview" opacity={0.75}>
                <rect
                  x={obstaclePreviewPos.x}
                  y={obstaclePreviewPos.z}
                  width={newObstacleW}
                  height={newObstacleType === "column" || newObstacleType === "beam" ? 300 : 150}
                  fill="#38BDF8"
                  stroke="#0284C7"
                  strokeWidth="5"
                  strokeDasharray="12 6"
                />
                <text
                  x={obstaclePreviewPos.x + newObstacleW / 2}
                  y={obstaclePreviewPos.z - 16}
                  textAnchor="middle"
                  fill="#0369A1"
                  fontSize="20"
                  fontWeight="700"
                  fontFamily="monospace"
                >
                  🎯 Tıkla Konumlandır ({obstaclePreviewPos.x}, {obstaclePreviewPos.z} mm)
                </text>
              </g>
            )}

            {/* 2. Architectural Obstacles (Window, Door, Column, Beam, Plumbing) */}
            {spaceObstacles.map((obs) => {
              const isSelectedObs =
                selectedPlanObject?.kind === "obstacle" && selectedPlanObject.id === obs.id;
              if (obs.type === "window" || obs.type === "door") {
                const isDoor = obs.type === "door";
                const rotY = (((obs.rotationY || 0) % 360) + 360) % 360;
                const isSideWallObs = rotY === 90 || rotY === 270;
                const ow = obs.dimensions.width;
                const wallT = mainWall.thickness - 40;
                const isRightSwing = obs.doorSwing === "right";

                if (isSideWallObs) {
                  const sideX = obs.position.x <= 40 ? -mainWall.thickness + 20 : obs.position.x;
                  const sideZ = obs.position.z;
                  return (
                    <g
                      key={obs.id}
                      data-testid={`plan-obstacle-${obs.id}`}
                      onMouseDown={(e) => handleObstaclePointerDown(e, obs)}
                      onDoubleClick={() => {
                        const nextRot = isSideWallObs ? 0 : 90;
                        updateSpaceObstacle(obs.id, {
                          rotationY: nextRot,
                          position: {
                            ...obs.position,
                            x: obs.position.x <= 60 ? Math.max(200, obs.position.z) : obs.position.x,
                            z: obs.position.x <= 60 ? 0 : obs.position.z,
                          },
                        });
                      }}
                      className="cursor-move"
                    >
                      <rect
                        x={sideX}
                        y={sideZ}
                        width={wallT}
                        height={ow}
                        fill={isDoor ? "#FDE68A" : "#BAE6FD"}
                        stroke={isSelectedObs ? "#DC2626" : isDoor ? "#D97706" : "#0284C7"}
                        strokeWidth={isSelectedObs ? "6" : "3"}
                      />
                      {!isDoor && (
                        <line
                          x1={sideX + wallT / 2}
                          y1={sideZ + 8}
                          x2={sideX + wallT / 2}
                          y2={sideZ + ow - 8}
                          stroke="#0284C7"
                          strokeWidth="3"
                        />
                      )}
                      {isDoor && (
                        <g className="pointer-events-none">
                          <line
                            x1={sideX + wallT}
                            y1={isRightSwing ? sideZ + ow : sideZ}
                            x2={sideX + wallT + ow * 0.85}
                            y2={isRightSwing ? sideZ + ow : sideZ}
                            stroke="#B45309"
                            strokeWidth="6"
                          />
                          <path
                            d={
                              isRightSwing
                                ? `M ${sideX + wallT} ${sideZ} A ${ow * 0.85} ${ow * 0.85} 0 0 1 ${sideX + wallT + ow * 0.85} ${sideZ + ow}`
                                : `M ${sideX + wallT} ${sideZ + ow} A ${ow * 0.85} ${ow * 0.85} 0 0 0 ${sideX + wallT + ow * 0.85} ${sideZ}`
                            }
                            fill="rgba(253, 230, 138, 0.22)"
                            stroke="#D97706"
                            strokeWidth="3.5"
                            strokeDasharray="12 6"
                          />
                        </g>
                      )}
                      <g transform={`rotate(-90 ${sideX - 24} ${sideZ + ow / 2})`}>
                        <text
                          x={sideX - 24}
                          y={sideZ + ow / 2}
                          textAnchor="middle"
                          fill={isDoor ? "#92400E" : "#0369A1"}
                          fontSize="24"
                          fontWeight="800"
                          fontFamily="monospace"
                        >
                          {isDoor ? "🚪 YAN KAPI" : "🪟 YAN PENCERE"} ({ow}×{obs.dimensions.height} • Z:{obs.position.z} • Y:{obs.position.y})
                        </text>
                      </g>
                      
                      {isSelectedObs && (
                        <g>
                          {/* On-Canvas In-Place 0° <-> 90° Rotate Button on Side-Wall Window/Door */}
                          <g
                            data-testid={`plan-oncanvas-rotate-obs-${obs.id}`}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              const nextRot = 0;
                              updateSpaceObstacle(obs.id, {
                                rotationY: nextRot,
                                position: {
                                  ...obs.position,
                                  x: obs.position.x <= 60 ? Math.max(200, obs.position.z) : obs.position.x,
                                  z: obs.position.x <= 60 ? 0 : obs.position.z,
                                },
                              });
                              setPlanRowSnapBanner(`🔄 ${obs.name} Yatay (0°) Yöne Çevrildi`);
                              setTimeout(() => setPlanRowSnapBanner(null), 2200);
                            }}
                            className="cursor-pointer"
                          >
                            <circle
                              cx={sideX + wallT + 46}
                              cy={sideZ + ow / 2}
                              r={28}
                              fill="#D97706"
                              stroke="#FFFFFF"
                              strokeWidth="3.5"
                            />
                            <text
                              x={sideX + wallT + 46}
                              y={sideZ + ow / 2 + 8}
                              textAnchor="middle"
                              fill="#FFFFFF"
                              fontSize="22"
                              fontWeight="900"
                            >
                              🔄
                            </text>
                          </g>
                          {/* Top/Start Edge Resize Handle (▲) */}
                          <g
                            data-testid={`plan-obs-resize-start-${obs.id}`}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              const svgEl = (e.currentTarget as Element).closest("svg") as SVGSVGElement | null;
                              beginHistoryTransaction();
                              setResizingPlanObject({
                                kind: "obstacle_start",
                                targetIdxOrId: obs.id,
                                startClientX: e.clientX,
                                startClientY: e.clientY,
                                startWidthOrLen: ow,
                                startPosX: obs.position.x,
                                startPosZ: obs.position.z,
                                isSideWall: true,
                                mmPerPx: svgEl ? getSvgMmPerPx(svgEl) : 4,
                              });
                            }}
                            className="cursor-ns-resize"
                          >
                            <rect
                              x={sideX - 8}
                              y={sideZ - 18}
                              width={wallT + 16}
                              height={36}
                              rx={8}
                              fill="#0284C7"
                              stroke="#FFFFFF"
                              strokeWidth="3"
                            />
                            <text
                              x={sideX + wallT / 2}
                              y={sideZ + 7}
                              textAnchor="middle"
                              fill="#FFFFFF"
                              fontSize="20"
                              fontWeight="900"
                            >
                              ▲
                            </text>
                          </g>
                          {/* Bottom/End Edge Resize Handle (▼) */}
                          <g
                            data-testid={`plan-obs-resize-end-${obs.id}`}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              const svgEl = (e.currentTarget as Element).closest("svg") as SVGSVGElement | null;
                              beginHistoryTransaction();
                              setResizingPlanObject({
                                kind: "obstacle_end",
                                targetIdxOrId: obs.id,
                                startClientX: e.clientX,
                                startClientY: e.clientY,
                                startWidthOrLen: ow,
                                startPosX: obs.position.x,
                                startPosZ: obs.position.z,
                                isSideWall: true,
                                mmPerPx: svgEl ? getSvgMmPerPx(svgEl) : 4,
                              });
                            }}
                            className="cursor-ns-resize"
                          >
                            <rect
                              x={sideX - 8}
                              y={sideZ + ow - 18}
                              width={wallT + 16}
                              height={36}
                              rx={8}
                              fill="#0284C7"
                              stroke="#FFFFFF"
                              strokeWidth="3"
                            />
                            <text
                              x={sideX + wallT / 2}
                              y={sideZ + ow + 7}
                              textAnchor="middle"
                              fill="#FFFFFF"
                              fontSize="20"
                              fontWeight="900"
                            >
                              ▼
                            </text>
                          </g>
                        </g>
                      )}
                    </g>
                  );
                }

                const obsY = obs.position.z > 0 ? obs.position.z : -mainWall.thickness + 20;
                return (
                  <g
                    key={obs.id}
                    data-testid={`plan-obstacle-${obs.id}`}
                    onMouseDown={(e) => handleObstaclePointerDown(e, obs)}
                    onDoubleClick={() =>
                      updateSpaceObstacle(obs.id, {
                        rotationY: 90,
                        position: {
                          ...obs.position,
                          x: obs.position.x <= 250 ? 0 : obs.position.x,
                          z: obs.position.z <= 60 ? Math.max(200, Math.min(1200, obs.position.x)) : obs.position.z,
                        },
                      })
                    }
                    className="cursor-move"
                  >
                    <rect
                      x={obs.position.x}
                      y={obsY}
                      width={ow}
                      height={wallT}
                      fill={isDoor ? "#FDE68A" : "#BAE6FD"}
                      stroke={isSelectedObs ? "#DC2626" : isDoor ? "#D97706" : "#0284C7"}
                      strokeWidth={isSelectedObs ? "6" : "3"}
                    />
                    {/* Window Double-Line Glass Symbol */}
                    {!isDoor && (
                      <line
                        x1={obs.position.x + 8}
                        y1={obsY + wallT / 2}
                        x2={obs.position.x + ow - 8}
                        y2={obsY + wallT / 2}
                        stroke="#0284C7"
                        strokeWidth="3"
                      />
                    )}
                    {/* Architectural 90° Door Leaf & Swing Arc */}
                    {isDoor && (
                      <g className="pointer-events-none">
                        <line
                          x1={isRightSwing ? obs.position.x + ow : obs.position.x}
                          y1={obsY + wallT}
                          x2={isRightSwing ? obs.position.x + ow : obs.position.x}
                          y2={obsY + wallT + ow * 0.85}
                          stroke="#B45309"
                          strokeWidth="6"
                        />
                        <path
                          d={
                            isRightSwing
                              ? `M ${obs.position.x} ${obsY + wallT} A ${ow * 0.85} ${ow * 0.85} 0 0 0 ${obs.position.x + ow} ${obsY + wallT + ow * 0.85}`
                              : `M ${obs.position.x + ow} ${obsY + wallT} A ${ow * 0.85} ${ow * 0.85} 0 0 1 ${obs.position.x} ${obsY + wallT + ow * 0.85}`
                          }
                          fill="rgba(253, 230, 138, 0.22)"
                          stroke="#D97706"
                          strokeWidth="3.5"
                          strokeDasharray="12 6"
                        />
                      </g>
                    )}
                    {(() => {
                      const obsText = `${isDoor ? "🚪 KAPI" : "🪟 PENCERE"} (${ow}×${obs.dimensions.height} • Y:${obs.position.y})`;
                      const obsFont = Math.round(24 * ts);
                      const obsPillW = Math.max(Math.round(240 * ts), Math.round(obsText.length * obsFont * 0.6 + 28 * ts));
                      const obsPillH = Math.round(40 * ts);
                      return (
                        <g className="pointer-events-none">
                          <rect
                            x={obs.position.x + ow / 2 - obsPillW / 2}
                            y={obsY + wallT / 2 - obsPillH / 2}
                            width={obsPillW}
                            height={obsPillH}
                            rx={Math.round(9 * ts)}
                            fill="rgba(255, 255, 255, 0.94)"
                            stroke={isDoor ? "#D97706" : "#0284C7"}
                            strokeWidth={Math.round(2.5 * ts)}
                          />
                          <text
                            x={obs.position.x + ow / 2}
                            y={obsY + wallT / 2 + Math.round(obsFont * 0.35)}
                            textAnchor="middle"
                            fill={isDoor ? "#92400E" : "#0369A1"}
                            fontSize={obsFont}
                            fontWeight="900"
                            fontFamily="monospace"
                          >
                            {obsText}
                          </text>
                        </g>
                      );
                    })()}
                    
                    {isSelectedObs && (
                      <g>
                        {/* On-Canvas In-Place 0° <-> 90° Rotate Button on Back-Wall Window/Door */}
                        <g
                          data-testid={`plan-oncanvas-rotate-obs-${obs.id}`}
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            const nextRot = 90;
                            const snapToLeftWall = obs.position.x <= 300;
                            updateSpaceObstacle(obs.id, {
                              rotationY: nextRot,
                              position: {
                                ...obs.position,
                                x: snapToLeftWall ? 0 : obs.position.x,
                                z: obs.position.z <= 60 ? Math.max(200, Math.min(1200, obs.position.x)) : obs.position.z,
                              },
                            });
                            setPlanRowSnapBanner(
                              snapToLeftWall
                                ? `🔄 ${obs.name} 90° Dikey Çevrildi (Sol Duvara Hizalandı)`
                                : `🔄 ${obs.name} Olduğu Yerde 90° Dikey Çevrildi (İstediğiniz Duvara Sürükleyebilirsiniz)`
                            );
                            setTimeout(() => setPlanRowSnapBanner(null), 2600);
                          }}
                          className="cursor-pointer"
                        >
                          <circle
                            cx={obs.position.x + ow / 2}
                            cy={obsY - 46}
                            r={28}
                            fill="#D97706"
                            stroke="#FFFFFF"
                            strokeWidth="3.5"
                          />
                          <text
                            x={obs.position.x + ow / 2}
                            y={obsY - 38}
                            textAnchor="middle"
                            fill="#FFFFFF"
                            fontSize="22"
                            fontWeight="900"
                          >
                            🔄
                          </text>
                        </g>
                        {/* Left Edge Resize Handle (◀) */}
                        <g
                          data-testid={`plan-obs-resize-start-${obs.id}`}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            const svgEl = (e.currentTarget as Element).closest("svg") as SVGSVGElement | null;
                            beginHistoryTransaction();
                            setResizingPlanObject({
                              kind: "obstacle_start",
                              targetIdxOrId: obs.id,
                              startClientX: e.clientX,
                              startClientY: e.clientY,
                              startWidthOrLen: ow,
                              startPosX: obs.position.x,
                              startPosZ: obs.position.z,
                              isSideWall: false,
                              mmPerPx: svgEl ? getSvgMmPerPx(svgEl) : 4,
                            });
                          }}
                          className="cursor-ew-resize"
                        >
                          <rect
                            x={obs.position.x - 18}
                            y={obsY - 8}
                            width={36}
                            height={wallT + 16}
                            rx={8}
                            fill="#0284C7"
                            stroke="#FFFFFF"
                            strokeWidth="3"
                          />
                          <text
                            x={obs.position.x}
                            y={obsY + wallT / 2 + 7}
                            textAnchor="middle"
                            fill="#FFFFFF"
                            fontSize="20"
                            fontWeight="900"
                          >
                            ◀
                          </text>
                        </g>
                        {/* Right Edge Resize Handle (▶) */}
                        <g
                          data-testid={`plan-obs-resize-end-${obs.id}`}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            const svgEl = (e.currentTarget as Element).closest("svg") as SVGSVGElement | null;
                            beginHistoryTransaction();
                            setResizingPlanObject({
                              kind: "obstacle_end",
                              targetIdxOrId: obs.id,
                              startClientX: e.clientX,
                              startClientY: e.clientY,
                              startWidthOrLen: ow,
                              startPosX: obs.position.x,
                              startPosZ: obs.position.z,
                              isSideWall: false,
                              mmPerPx: svgEl ? getSvgMmPerPx(svgEl) : 4,
                            });
                          }}
                          className="cursor-ew-resize"
                        >
                          <rect
                            x={obs.position.x + ow - 18}
                            y={obsY - 8}
                            width={36}
                            height={wallT + 16}
                            rx={8}
                            fill="#0284C7"
                            stroke="#FFFFFF"
                            strokeWidth="3"
                          />
                          <text
                            x={obs.position.x + ow}
                            y={obsY + wallT / 2 + 7}
                            textAnchor="middle"
                            fill="#FFFFFF"
                            fontSize="20"
                            fontWeight="900"
                          >
                            ▶
                          </text>
                        </g>
                      </g>
                    )}
                  </g>
                );
              }
              if (obs.type === "column" || obs.type === "beam") {
                const isBeam = obs.type === "beam";
                return (
                  <g
                    key={obs.id}
                    data-testid={`plan-obstacle-${obs.id}`}
                    onMouseDown={(e) => handleObstaclePointerDown(e, obs)}
                    onDoubleClick={() => removeSpaceObstacle(obs.id)}
                    className="cursor-move"
                  >
                    <rect
                      x={obs.position.x}
                      y={obs.position.z}
                      width={obs.dimensions.width}
                      height={obs.dimensions.depth}
                      fill="url(#column_hatch)"
                      stroke={isSelectedObs ? "#DC2626" : "#292524"}
                      strokeWidth={isSelectedObs ? "6" : "3"}
                      strokeDasharray={isBeam ? "12 6" : undefined}
                    />
                    <rect
                      x={obs.position.x}
                      y={obs.position.z}
                      width={obs.dimensions.width}
                      height={obs.dimensions.depth}
                      fill={isSelectedObs ? "#FCA5A5" : "#78716C"}
                      opacity={0.35}
                    />
                    {(() => {
                      const colTxt = `${isBeam ? "KİRİŞ" : "KOLON"} (${obs.dimensions.width}×${obs.dimensions.depth})`;
                      const colFont = Math.round(23 * ts);
                      const colPillW = Math.max(Math.round(180 * ts), Math.round(colTxt.length * colFont * 0.62 + 24 * ts));
                      const colPillH = Math.round(38 * ts);
                      return (
                        <g className="pointer-events-none">
                          <rect
                            x={obs.position.x + obs.dimensions.width / 2 - colPillW / 2}
                            y={obs.position.z + obs.dimensions.depth + Math.round(8 * ts)}
                            width={colPillW}
                            height={colPillH}
                            rx={Math.round(8 * ts)}
                            fill="rgba(255, 255, 255, 0.94)"
                            stroke={isSelectedObs ? "#DC2626" : "#44403C"}
                            strokeWidth="2"
                          />
                          <text
                            x={obs.position.x + obs.dimensions.width / 2}
                            y={obs.position.z + obs.dimensions.depth + Math.round(8 * ts) + Math.round(colPillH * 0.72)}
                            textAnchor="middle"
                            fill={isSelectedObs ? "#B91C1C" : "#0F172A"}
                            fontSize={colFont}
                            fontWeight="900"
                            fontFamily="monospace"
                          >
                            {colTxt}
                          </text>
                        </g>
                      );
                    })()}
                  </g>
                );
              }
              if (obs.type === "plumbing" || obs.type === "electrical" || obs.type === "ventilation") {
                const cx = obs.position.x + obs.dimensions.width / 2;
                const cy = obs.position.z > 0 ? obs.position.z : -28;
                const badgeText = obs.type === "electrical" ? "⚡" : obs.type === "ventilation" ? "HAV" : "SU";
                return (
                  <g
                    key={obs.id}
                    data-testid={`plan-obstacle-${obs.id}`}
                    onMouseDown={(e) => handleObstaclePointerDown(e, obs)}
                    onDoubleClick={() => removeSpaceObstacle(obs.id)}
                    className="cursor-move"
                  >
                    <circle
                      cx={cx}
                      cy={cy}
                      r={28}
                      fill={obs.type === "electrical" ? "#FEF3C7" : "#E0F2FE"}
                      stroke={isSelectedObs ? "#DC2626" : obs.type === "electrical" ? "#D97706" : "#0284C7"}
                      strokeWidth={isSelectedObs ? "6" : "3"}
                    />
                    <text
                      x={cx}
                      y={cy + 8}
                      textAnchor="middle"
                      fill={obs.type === "electrical" ? "#92400E" : "#0369A1"}
                      fontSize="22"
                      fontWeight="800"
                      fontFamily="monospace"
                    >
                      {badgeText}
                    </text>
                  </g>
                );
              }
              if (obs.type === "niche" || obs.type === "protrusion" || obs.type === "partition") {
                const isNiche = obs.type === "niche";
                const isPart = obs.type === "partition";
                const boxY = isNiche && obs.position.z === 0 ? -obs.dimensions.depth : obs.position.z;
                const labelTag = isNiche ? "NİŞ" : isPart ? "BÖLME DUVAR" : "ÇIKINTI";
                return (
                  <g
                    key={obs.id}
                    data-testid={`plan-obstacle-${obs.id}`}
                    onMouseDown={(e) => handleObstaclePointerDown(e, obs)}
                    onDoubleClick={() => removeSpaceObstacle(obs.id)}
                    className="cursor-move"
                  >
                    <rect
                      x={obs.position.x}
                      y={boxY}
                      width={obs.dimensions.width}
                      height={obs.dimensions.depth}
                      fill={isNiche ? "#F5F5F4" : isPart ? "#CBD5E1" : "url(#column_hatch)"}
                      stroke={isSelectedObs ? "#DC2626" : isNiche ? "#2563EB" : "#334155"}
                      strokeWidth={isSelectedObs ? "6" : "3.5"}
                      strokeDasharray={isNiche ? "10 6" : undefined}
                    />
                    {(() => {
                      const nTxt = `${labelTag} (${obs.dimensions.width}×${obs.dimensions.depth}mm)`;
                      const nFont = Math.round(23 * ts);
                      const nPillW = Math.max(Math.round(190 * ts), Math.round(nTxt.length * nFont * 0.62 + 24 * ts));
                      const nPillH = Math.round(38 * ts);
                      return (
                        <g className="pointer-events-none">
                          <rect
                            x={obs.position.x + obs.dimensions.width / 2 - nPillW / 2}
                            y={boxY + obs.dimensions.depth / 2 - nPillH / 2}
                            width={nPillW}
                            height={nPillH}
                            rx={Math.round(8 * ts)}
                            fill="rgba(255, 255, 255, 0.94)"
                            stroke={isSelectedObs ? "#DC2626" : "#2563EB"}
                            strokeWidth="2"
                          />
                          <text
                            x={obs.position.x + obs.dimensions.width / 2}
                            y={boxY + obs.dimensions.depth / 2 + Math.round(nFont * 0.35)}
                            textAnchor="middle"
                            fill={isSelectedObs ? "#B91C1C" : "#0F172A"}
                            fontSize={nFont}
                            fontWeight="900"
                            fontFamily="monospace"
                          >
                            {nTxt}
                          </text>
                        </g>
                      );
                    })()}
                  </g>
                );
              }
              return null;
            })}

            {/* 3. Modules in Top Plan (Respecting 90° L/U Rotations & Wall Clearances) */}
            {footprints.map((fp, idx) => {
              const mod = project.modules[idx];
              const isAct = idx === activeModuleIndex;
              const hasCollisionError = errorModuleIds.has(fp.moduleId);
              const mx = fp.x;
              const mz = fp.z;
              const mw = fp.planWidth;
              const md = fp.planDepth;

              // Find nearest module to the right THAT IS IN THE SAME Z ROW (within 100mm)
              const sameRowRightNeighbors = footprints
                .filter(
                  (otherFp, oIdx) =>
                    oIdx !== idx &&
                    otherFp.category !== "complementary" &&
                    otherFp.rotationY === 0 &&
                    Math.abs(otherFp.z - mz) <= 100 &&
                    otherFp.x >= mx + mw - 5
                )
                .sort((a, b) => a.x - b.x);
              const nextSameRowFp = sameRowRightNeighbors[0];
              const gapRight =
                fp.rotationY === 0
                  ? nextSameRowFp
                    ? nextSameRowFp.x - (mx + mw)
                    : mainWall.length - (mx + mw)
                  : 0;

              return (
                <g
                  key={fp.moduleId}
                  data-testid={`plan-module-${idx}`}
                  onMouseDown={(e) => handleModPointerDown(e, idx)}
                  className="cursor-move"
                >
                  {/* Module Oriented Footprint (True L-Corner, 45° Diagonal Corner, Blind Corner LeMans, or Standard Rectangular) */}
                  {(() => {
                    const fillCol = hasCollisionError
                      ? "#FEE2E2"
                      : isAct
                      ? "#E0F2FE"
                      : fp.category === "kitchen_wall"
                      ? "#F5F5F4"
                      : "#FFFFFF";
                    const strokeCol = hasCollisionError
                      ? "#DC2626"
                      : isAct
                      ? "#2563EB"
                      : "#292524";
                    const strokeW = isAct || hasCollisionError ? 6 : 3.5;
                    const wd = Math.min(fp.wingDepthMm || 580, mw - 120, md - 120);
                    const T = mod?.carcass.panelThickness || 18;

                    if (fp.cornerType === "l_corner") {
                      // 6-Vertex Architectural L-Corner Polygon respecting 0° / 90° / 180° / 270° rotation
                      const lPath =
                        fp.rotationY === 90
                          ? `M ${mx} ${mz} L ${mx + mw} ${mz} L ${mx + mw} ${mz + md} L ${mx + mw - wd} ${mz + md} L ${mx + mw - wd} ${mz + wd} L ${mx} ${mz + wd} Z`
                          : fp.rotationY === 180
                          ? `M ${mx + mw - wd} ${mz} L ${mx + mw} ${mz} L ${mx + mw} ${mz + md} L ${mx} ${mz + md} L ${mx} ${mz + md - wd} L ${mx + mw - wd} ${mz + md - wd} Z`
                          : fp.rotationY === 270
                          ? `M ${mx} ${mz} L ${mx + wd} ${mz} L ${mx + wd} ${mz + md - wd} L ${mx + mw} ${mz + md - wd} L ${mx + mw} ${mz + md} L ${mx} ${mz + md} Z`
                          : `M ${mx} ${mz} L ${mx + mw} ${mz} L ${mx + mw} ${mz + wd} L ${mx + wd} ${mz + wd} L ${mx + wd} ${mz + md} L ${mx} ${mz + md} Z`;

                      const leafXLen = Math.max(120, mw - wd - 16);
                      const leafZLen = Math.max(120, md - wd - 16);

                      return (
                        <g data-testid={`plan-l-corner-shape-${idx}`}>
                          <path
                            d={lPath}
                            fill={fillCol}
                            stroke={strokeCol}
                            strokeWidth={strokeW}
                            strokeLinejoin="round"
                            strokeDasharray={fp.category === "kitchen_wall" ? "10 5" : undefined}
                          />
                          {fp.rotationY === 0 && (
                            <>
                              {/* 18mm Carcass Back & Return Wall Inner Thickness Lines */}
                              <line x1={mx + T} y1={mz + T} x2={mx + mw - T} y2={mz + T} stroke="#94A3B8" strokeWidth="2" />
                              <line x1={mx + T} y1={mz + T} x2={mx + T} y2={mz + md - T} stroke="#94A3B8" strokeWidth="2" />
                              {/* L-Shaped Internal Shelf / Hanging Rail Centerlines */}
                              <polyline
                                points={`${mx + wd * 0.5},${mz + md - T - 15} ${mx + wd * 0.5},${mz + wd * 0.5} ${mx + mw - T - 15},${mz + wd * 0.5}`}
                                fill="none"
                                stroke={isAct ? "#2563EB" : "#64748B"}
                                strokeWidth="2.5"
                                strokeDasharray="10 6"
                              />
                              {/* 90° Bi-Fold Corner Doors & Swing Arcs at Inner Notch (mx + wd, mz + wd) */}
                              {!fp.isOpenFront && (
                                <g className="pointer-events-none">
                                  <line
                                    x1={mx + wd + 6}
                                    y1={mz + wd + 8}
                                    x2={mx + mw - 6}
                                    y2={mz + wd + 8}
                                    stroke={isAct ? "#1D4ED8" : "#0F172A"}
                                    strokeWidth="5"
                                  />
                                  <line
                                    x1={mx + wd + 8}
                                    y1={mz + wd + 6}
                                    x2={mx + wd + 8}
                                    y2={mz + md - 6}
                                    stroke={isAct ? "#1D4ED8" : "#0F172A"}
                                    strokeWidth="5"
                                  />
                                  {/* Bi-fold Door Swing Arcs into the Open Quadrant */}
                                  <path
                                    d={`M ${mx + wd + 8} ${mz + wd + 8} A ${leafXLen * 0.75} ${leafXLen * 0.75} 0 0 0 ${mx + mw - 8} ${mz + wd + 8 + leafXLen * 0.75}`}
                                    fill="none"
                                    stroke={isAct ? "#2563EB" : "#475569"}
                                    strokeWidth="2.5"
                                    strokeDasharray="8 5"
                                  />
                                  <path
                                    d={`M ${mx + wd + 8} ${mz + wd + 8} A ${leafZLen * 0.75} ${leafZLen * 0.75} 0 0 1 ${mx + wd + 8 + leafZLen * 0.75} ${mz + md - 8}`}
                                    fill="none"
                                    stroke={isAct ? "#2563EB" : "#475569"}
                                    strokeWidth="2.5"
                                    strokeDasharray="8 5"
                                  />
                                </g>
                              )}
                              {/* Return Arm Z Dimension Badge */}
                              {(() => {
                                const zTxt = `Z:${md} (D:${wd})`;
                                const zFont = Math.round(22 * ts);
                                const zPillW = Math.min(wd - 20, Math.max(Math.round(160 * ts), Math.round(zTxt.length * zFont * 0.62 + 20 * ts)));
                                const zPillH = Math.round(38 * ts);
                                return (
                                  <g className="pointer-events-none">
                                    <rect
                                      x={mx + wd / 2 - zPillW / 2}
                                      y={mz + wd + (md - wd) / 2 - zPillH / 2}
                                      width={zPillW}
                                      height={zPillH}
                                      rx={Math.round(8 * ts)}
                                      fill="#FFFFFF"
                                      stroke="#2563EB"
                                      strokeWidth="2.5"
                                    />
                                    <text
                                      x={mx + wd / 2}
                                      y={mz + wd + (md - wd) / 2 + Math.round(zFont * 0.35)}
                                      textAnchor="middle"
                                      fill="#0F172A"
                                      fontSize={zFont}
                                      fontWeight="900"
                                      fontFamily="monospace"
                                    >
                                      {zTxt}
                                    </text>
                                  </g>
                                );
                              })()}
                            </>
                          )}
                        </g>
                      );
                    }

                    if (fp.cornerType === "diagonal_corner") {
                      // 5-Vertex Pentagonal 45° Diagonal Corner Polygon
                      const diagPath =
                        fp.rotationY === 90
                          ? `M ${mx} ${mz} L ${mx + mw} ${mz} L ${mx + mw} ${mz + md} L ${mx + mw - wd} ${mz + md} L ${mx} ${mz + wd} Z`
                          : `M ${mx} ${mz} L ${mx + mw} ${mz} L ${mx + mw} ${mz + wd} L ${mx + wd} ${mz + md} L ${mx} ${mz + md} Z`;

                      const dLen = Math.round(Math.hypot(mw - wd, md - wd));
                      return (
                        <g data-testid={`plan-diagonal-corner-shape-${idx}`}>
                          <path
                            d={diagPath}
                            fill={fillCol}
                            stroke={strokeCol}
                            strokeWidth={strokeW}
                            strokeLinejoin="round"
                          />
                          {fp.rotationY === 0 && (
                            <>
                              <polyline
                                points={`${mx + T},${mz + md - T} ${mx + T},${mz + T} ${mx + mw - T},${mz + T}`}
                                fill="none"
                                stroke="#94A3B8"
                                strokeWidth="2"
                              />
                              {/* 45° Angled Front Door Line & Swing Arc */}
                              <line
                                x1={mx + mw + 4}
                                y1={mz + wd + 4}
                                x2={mx + wd + 4}
                                y2={mz + md + 4}
                                stroke={isAct ? "#1D4ED8" : "#0F172A"}
                                strokeWidth="6"
                              />
                              <path
                                d={`M ${mx + mw} ${mz + wd} A ${dLen * 0.72} ${dLen * 0.72} 0 0 1 ${mx + wd + dLen * 0.55} ${mz + md + dLen * 0.45}`}
                                fill="none"
                                stroke={isAct ? "#2563EB" : "#475569"}
                                strokeWidth="2.5"
                                strokeDasharray="8 5"
                              />
                            </>
                          )}
                        </g>
                      );
                    }

                    if (fp.cornerType === "blind_corner") {
                      // Blind Corner (Kör Köşe / LeMans): Left half is hatched Blind Panel + 50mm Filler Strip, Right half is Active Door + LeMans Kidney Trays
                      const blindW = Math.round(mw * 0.46);
                      const doorW = mw - blindW;
                      return (
                        <g data-testid={`plan-blind-corner-shape-${idx}`}>
                          <rect
                            x={mx}
                            y={mz}
                            width={mw}
                            height={md}
                            rx={6}
                            fill={fillCol}
                            stroke={strokeCol}
                            strokeWidth={strokeW}
                          />
                          {/* Blind Dead-Corner Zone (Shaded) */}
                          <rect
                            x={mx + 4}
                            y={mz + 4}
                            width={blindW - 4}
                            height={md - 8}
                            fill="url(#column_hatch)"
                            opacity={0.28}
                          />
                          <line
                            x1={mx + blindW}
                            y1={mz}
                            x2={mx + blindW}
                            y2={mz + md}
                            stroke="#475569"
                            strokeWidth="3"
                            strokeDasharray="10 6"
                          />
                          {/* 50mm Corner Filler Strip (Kör Köşe Dönüş Çıtası) */}
                          <rect
                            x={mx + blindW - 55}
                            y={mz + md - 18}
                            width={55}
                            height={24}
                            rx={4}
                            fill="#F59E0B"
                            stroke="#78350F"
                            strokeWidth="2"
                          />
                          {/* Active Door Leaf on Right Side + 90° Swing Arc */}
                          <line
                            x1={mx + blindW + 8}
                            y1={mz + md + 8}
                            x2={mx + mw - 8}
                            y2={mz + md + 8}
                            stroke={isAct ? "#1D4ED8" : "#0F172A"}
                            strokeWidth="5"
                          />
                          <path
                            d={`M ${mx + blindW + 8} ${mz + md + 8} A ${doorW * 0.75} ${doorW * 0.75} 0 0 0 ${mx + mw - 8} ${mz + md + 8 + doorW * 0.75}`}
                            fill="none"
                            stroke={isAct ? "#2563EB" : "#475569"}
                            strokeWidth="2.5"
                            strokeDasharray="8 5"
                          />
                          {/* LeMans Kidney Tray Schematic inside Carcass */}
                          <ellipse
                            cx={mx + mw * 0.56}
                            cy={mz + md * 0.48}
                            rx={mw * 0.34}
                            ry={md * 0.32}
                            fill="none"
                            stroke="#0284C7"
                            strokeWidth="2.5"
                            strokeDasharray="8 4"
                          />
                        </g>
                      );
                    }

                    // Standard Rectangular Module Footprint — 100% Synchronized with 3D Product (Exact Bay Widths, Door Systems & True 90° Quarter-Circle Arcs)
                    const realBayWidths = moduleCadMetrics[idx]?.bayWidths ?? (mod ? calculateBayWidths(mod) : [mw]);
                    const fourSpace = moduleCadMetrics[idx]?.fourSpace ?? null;
                    const hasDoorSwingError = liveSpatialAlerts.some(
                      (al) => al.modIdx === idx && al.kind === "door_swing"
                    );
                    const hasBodyOverlapError = liveSpatialAlerts.some(
                      (al) => al.modIdx === idx && (al.kind === "module_overlap" || al.kind === "column")
                    );
                    const carcassFill = hasBodyOverlapError
                      ? "#FEE2E2"
                      : isAct
                      ? "#EBF5FF"
                      : fp.category === "kitchen_wall"
                      ? "#F5F5F4"
                      : "#FFFFFF";
                    const carcassStroke = hasCollisionError
                      ? "#DC2626"
                      : isAct
                      ? "#2563EB"
                      : "#292524";

                    // Precompute each bay's exact start offset along the module width (including 18mm carcass side & divider thickness)
                    const bayOffsetsMm: { startMm: number; clearWidthMm: number; spanWidthMm: number }[] = [];
                    if (mod) {
                      let cursorMm = T;
                      realBayWidths.forEach((bwClear, bIdx) => {
                        const leftPad = bIdx === 0 ? T : T / 2;
                        const rightPad = bIdx === realBayWidths.length - 1 ? T : T / 2;
                        bayOffsetsMm.push({
                          startMm: cursorMm - leftPad,
                          clearWidthMm: bwClear,
                          spanWidthMm: bwClear + leftPad + rightPad,
                        });
                        cursorMm += bwClear + T;
                      });
                    }

                    return (
                      <>
                        <rect
                          x={mx}
                          y={mz}
                          width={mw}
                          height={md}
                          rx={6}
                          fill={carcassFill}
                          stroke={carcassStroke}
                          strokeWidth={strokeW}
                          strokeDasharray={fp.category === "kitchen_wall" ? "10 5" : undefined}
                        />

                        {/* 18mm Carcass Side & Back Panel Inner Lines */}
                        {fp.rotationY === 0 && (
                          <g className="pointer-events-none" opacity={0.55}>
                            <line x1={mx + T} y1={mz + T} x2={mx + mw - T} y2={mz + T} stroke="#94A3B8" strokeWidth="2" />
                            <line x1={mx + T} y1={mz + T} x2={mx + T} y2={mz + md - T} stroke="#94A3B8" strokeWidth="2" />
                            <line x1={mx + mw - T} y1={mz + T} x2={mx + mw - T} y2={mz + md - T} stroke="#94A3B8" strokeWidth="2" />
                          </g>
                        )}

                        {/* Exact Internal Bay Divider Lines & Per-Bay Interior Schematic (Hanging Rail, Drawers, Bay Width Badges) */}
                        {mod &&
                          bayOffsetsMm.map((bo, bIdx) => {
                            const bayObj = mod.bays[bIdx];
                            const divCoordMm = bo.startMm + bo.spanWidthMm;
                            const hasDividerAfter = bIdx < bayOffsetsMm.length - 1;

                            if (fp.rotationY === 90 || fp.rotationY === 270) {
                              const bayZ = mz + divCoordMm;
                              return hasDividerAfter ? (
                                <line
                                  key={`div_${bIdx}`}
                                  x1={mx}
                                  y1={bayZ}
                                  x2={mx + mw}
                                  y2={bayZ}
                                  stroke={isAct ? "#2563EB" : "#64748B"}
                                  strokeWidth="3"
                                />
                              ) : null;
                            }

                            const bx = mx + bo.startMm;
                            const bSpan = bo.spanWidthMm;
                            const divX = mx + divCoordMm;
                            const extDrawers = bayObj ? bayObj.drawers.filter((d) => !d.isInternal) : [];
                            const hasRails = bayObj ? bayObj.hangingRails.length > 0 : false;

                            return (
                              <g key={`bay_plan_int_${bIdx}`} className="pointer-events-none">
                                {/* Solid 18mm Structural Bay Divider Line at Exact Millimeter Coordinate */}
                                {hasDividerAfter && (
                                  <line
                                    x1={divX}
                                    y1={mz}
                                    x2={divX}
                                    y2={mz + md}
                                    stroke={isAct ? "#1D4ED8" : "#475569"}
                                    strokeWidth="3.5"
                                  />
                                )}

                                {/* Hanging Rail Centerline + Hanger Ticks inside Bay */}
                                {hasRails && (
                                  <g opacity={0.45}>
                                    <line
                                      x1={bx + T}
                                      y1={mz + md * 0.5}
                                      x2={bx + bSpan - T}
                                      y2={mz + md * 0.5}
                                      stroke="#475569"
                                      strokeWidth="2.5"
                                      strokeDasharray="8 5"
                                    />
                                  </g>
                                )}

                                {/* External Drawer Stack Indicator at Front Edge of Bay (Scaled with `ts` at front of module) */}
                                {extDrawers.length > 0 && (() => {
                                  const drwFont = Math.round(20 * ts);
                                  const drwH = Math.round(34 * ts);
                                  return (
                                    <g>
                                      <rect
                                        x={bx + T + 8}
                                        y={mz + md - drwH - 8}
                                        width={Math.max(40, bSpan - 2 * T - 16)}
                                        height={drwH}
                                        rx={7}
                                        fill="rgba(254, 243, 199, 0.94)"
                                        stroke="#D97706"
                                        strokeWidth="2.2"
                                        strokeDasharray="6 4"
                                      />
                                      <text
                                        x={bx + bSpan / 2}
                                        y={mz + md - 8 - Math.round(drwH * 0.28)}
                                        textAnchor="middle"
                                        fill="#92400E"
                                        fontSize={drwFont}
                                        fontWeight="900"
                                        fontFamily="monospace"
                                      >
                                        {`🗄 ${extDrawers.length} Çekmece`}
                                      </text>
                                    </g>
                                  );
                                })()}

                                {/* Bay Width Sub-Label at Top Edge of Bay (e.g. B1: 575mm | B2: 1171mm) */}
                                {mod.bays.length > 1 && (() => {
                                  const bTxt = `B${bIdx + 1}: ${bo.clearWidthMm}mm`;
                                  const bFont = Math.round(20 * ts);
                                  const bPillW = Math.min(bSpan - 10, Math.max(Math.round(125 * ts), Math.round(bTxt.length * bFont * 0.62 + 18 * ts)));
                                  const bPillH = Math.round(32 * ts);
                                  return (
                                    <g>
                                      <rect
                                        x={bx + bSpan / 2 - bPillW / 2}
                                        y={mz + 8}
                                        width={bPillW}
                                        height={bPillH}
                                        rx={7}
                                        fill="rgba(255, 255, 255, 0.94)"
                                        stroke={isAct ? "#2563EB" : "#94A3B8"}
                                        strokeWidth="2"
                                      />
                                      <text
                                        x={bx + bSpan / 2}
                                        y={mz + 8 + Math.round(bPillH * 0.72)}
                                        textAnchor="middle"
                                        fill={isAct ? "#1D4ED8" : "#0F172A"}
                                        fontSize={bFont}
                                        fontWeight="900"
                                        fontFamily="monospace"
                                      >
                                        {bTxt}
                                      </text>
                                    </g>
                                  );
                                })()}
                              </g>
                            );
                          })}

                        {/* Authentic Door Opening System in 2D Plan (Matches 3D Product 1-to-1: Single Left, Single Right, Double 2-Leaf, Sliding, Bi-Fold, Lift-Up, Pocket, Tambour) */}
                        {fp.rotationY === 90 ? (
                          <line
                            x1={mx + mw + 8}
                            y1={mz + 12}
                            x2={mx + mw + 8}
                            y2={mz + md - 12}
                            stroke={isAct ? "#2563EB" : "#78716C"}
                            strokeWidth="4"
                          />
                        ) : fp.rotationY === 270 ? (
                          <line
                            x1={mx - 8}
                            y1={mz + 12}
                            x2={mx - 8}
                            y2={mz + md - 12}
                            stroke={isAct ? "#2563EB" : "#78716C"}
                            strokeWidth="4"
                          />
                        ) : (
                          mod &&
                          !mod.isOpenFront &&
                          bayOffsetsMm.map((bo, bIdx) => {
                            const b = mod.bays[bIdx];
                            if (!b) return null;
                            const dType = b.door.type;
                            const dSys = b.door.doorSystemId || inferDoorSystemIdFromType(dType);
                            if (dType === "open" || dSys === "open") return null;

                            const leafSpec = fourSpace?.doorLeaves[bIdx];
                            const bx = mx + bo.startMm;
                            const baySpanW = bo.spanWidthMm;
                            const frontZ = mz + md + 4;
                            const doorStroke = hasDoorSwingError
                              ? "#DC2626"
                              : isAct
                              ? "#2563EB"
                              : "#475569";
                            const doorSweepFill = hasDoorSwingError
                              ? "rgba(239, 68, 68, 0.14)"
                              : isAct
                              ? "rgba(37, 99, 235, 0.08)"
                              : "rgba(100, 116, 139, 0.06)";

                            // 1. SLIDING DOOR SYSTEM (Üstten / Alttan Sürgülü & Eş Düzlemli) — Parallel Tracks, NO Outward Swing Arc!
                            if (
                              dSys === "sliding_top_hung" ||
                              dSys === "sliding_bottom_rolling" ||
                              dSys === "sliding_coplanar" ||
                              dType === "sliding" ||
                              dType === "sliding_bottom"
                            ) {
                              const trackZ = frontZ + (bIdx % 2 === 0 ? 2 : 16);
                              const arrowDir = bIdx % 2 === 0 ? 1 : -1;
                              const midX = bx + baySpanW / 2;
                              return (
                                <g key={`door_sys_${bIdx}`} className="pointer-events-none">
                                  <rect
                                    x={bx + 4}
                                    y={trackZ}
                                    width={Math.max(40, baySpanW - 8)}
                                    height={12}
                                    rx={3}
                                    fill="#DBEAFE"
                                    stroke={doorStroke}
                                    strokeWidth="3"
                                  />
                                  <line
                                    x1={midX - 55 * arrowDir}
                                    y1={trackZ + 32}
                                    x2={midX + 55 * arrowDir}
                                    y2={trackZ + 32}
                                    stroke={doorStroke}
                                    strokeWidth="3"
                                  />
                                  <text
                                    x={midX}
                                    y={trackZ + 60}
                                    textAnchor="middle"
                                    fill={doorStroke}
                                    fontSize="19"
                                    fontWeight="800"
                                    fontFamily="monospace"
                                  >
                                    {bIdx % 2 === 0 ? "SÜRGÜ KAPAK ➔" : "⬅ SÜRGÜ KAPAK"}
                                  </text>
                                </g>
                              );
                            }

                            // 2. FOLDING / BI-FOLD DOOR SYSTEM (Katlanır Akordeon Kapak)
                            if (dSys === "folding_side" || dType === "folding") {
                              const wingW = Math.round(baySpanW / 2);
                              const tipX = bx + Math.round(wingW * 0.45);
                              const tipZ = frontZ + Math.round(wingW * 0.88);
                              const endX = bx + Math.round(wingW * 0.9);
                              return (
                                <g key={`door_sys_${bIdx}`} className="pointer-events-none">
                                  <polyline
                                    points={`${bx + 4},${frontZ} ${tipX},${tipZ} ${endX},${frontZ}`}
                                    fill={doorSweepFill}
                                    stroke={doorStroke}
                                    strokeWidth="4"
                                    strokeLinejoin="round"
                                  />
                                  <path
                                    d={`M ${bx + baySpanW - 4} ${frontZ} A ${wingW} ${wingW} 0 0 1 ${tipX} ${tipZ}`}
                                    fill="none"
                                    stroke={doorStroke}
                                    strokeWidth="2.5"
                                    strokeDasharray="8 5"
                                  />
                                </g>
                              );
                            }

                            // 3. LIFT-UP FLAP DOOR SYSTEM (Blum AVENTOS HK / HL / HF Yukarı Kalkar Kapak)
                            if (dSys.startsWith("lift_") || dType === "flap" || dType.startsWith("lift_")) {
                              const liftProjD = 240;
                              return (
                                <g key={`door_sys_${bIdx}`} className="pointer-events-none">
                                  <line
                                    x1={bx + 4}
                                    y1={frontZ}
                                    x2={bx + baySpanW - 4}
                                    y2={frontZ}
                                    stroke={doorStroke}
                                    strokeWidth="4.5"
                                  />
                                  <rect
                                    x={bx + 8}
                                    y={frontZ}
                                    width={Math.max(40, baySpanW - 16)}
                                    height={liftProjD}
                                    rx={6}
                                    fill={doorSweepFill}
                                    stroke={doorStroke}
                                    strokeWidth="2.5"
                                    strokeDasharray="8 5"
                                  />
                                  <text
                                    x={bx + baySpanW / 2}
                                    y={frontZ + liftProjD / 2 + 7}
                                    textAnchor="middle"
                                    fill={doorStroke}
                                    fontSize="19"
                                    fontWeight="800"
                                    fontFamily="monospace"
                                  >
                                    ↑ KALKAR KAPAK
                                  </text>
                                </g>
                              );
                            }

                            // 4. POCKET RETRACTABLE OR TAMBOUR ROLLER DOOR
                            if (
                              dSys === "pocket_retractable" ||
                              dType === "pocket" ||
                              dSys === "tambour_roller" ||
                              dType === "tambour"
                            ) {
                              return (
                                <g key={`door_sys_${bIdx}`} className="pointer-events-none">
                                  <line
                                    x1={bx + 4}
                                    y1={frontZ}
                                    x2={bx + baySpanW - 4}
                                    y2={frontZ}
                                    stroke={doorStroke}
                                    strokeWidth="4.5"
                                    strokeDasharray="10 4"
                                  />
                                  <text
                                    x={bx + baySpanW / 2}
                                    y={frontZ + 32}
                                    textAnchor="middle"
                                    fill={doorStroke}
                                    fontSize="18"
                                    fontWeight="800"
                                    fontFamily="monospace"
                                  >
                                    {dSys === "tambour_roller" || dType === "tambour" ? "▤ TAMBUR PANJUR" : "↳ POCKET GİZLENİR"}
                                  </text>
                                </g>
                              );
                            }

                            // 5. HINGED DOUBLE DOOR (Çift Kapak: 2 Equal Leaves Opening Left & Right with True 90° Quarter-Circle Arcs!)
                            const isDoubleDoor =
                              dSys === "hinged_double" ||
                              dType === "double" ||
                              dType === "inset_double" ||
                              (leafSpec && leafSpec.leafCount === 2);

                            if (isDoubleDoor) {
                              const leafW = Math.max(120, Math.round((baySpanW - 8) / 2));
                              const hxL = bx + 4;
                              const hxR = bx + baySpanW - 4;
                              return (
                                <g
                                  key={`door_sys_${bIdx}`}
                                  data-testid={`plan-door-double-bay-${bIdx}`}
                                  className="pointer-events-none"
                                >
                                  {/* Closed Door Leaves Line with Center Split */}
                                  <line
                                    x1={hxL}
                                    y1={frontZ}
                                    x2={hxL + leafW - 3}
                                    y2={frontZ}
                                    stroke={doorStroke}
                                    strokeWidth="4.5"
                                  />
                                  <line
                                    x1={hxR - leafW + 3}
                                    y1={frontZ}
                                    x2={hxR}
                                    y2={frontZ}
                                    stroke={doorStroke}
                                    strokeWidth="4.5"
                                  />
                                  {/* Center 2 Handle Ticks */}
                                  <line
                                    x1={hxL + leafW - 18}
                                    y1={frontZ}
                                    x2={hxL + leafW - 18}
                                    y2={frontZ + 18}
                                    stroke="#0F172A"
                                    strokeWidth="4"
                                  />
                                  <line
                                    x1={hxR - leafW + 18}
                                    y1={frontZ}
                                    x2={hxR - leafW + 18}
                                    y2={frontZ + 18}
                                    stroke="#0F172A"
                                    strokeWidth="4"
                                  />

                                  {/* Left Leaf True 90° Quarter-Circle Sector (Hinged at hxL) */}
                                  <path
                                    d={`M ${hxL} ${frontZ} L ${hxL + leafW} ${frontZ} A ${leafW} ${leafW} 0 0 1 ${hxL} ${frontZ + leafW} Z`}
                                    fill={doorSweepFill}
                                    stroke={doorStroke}
                                    strokeWidth="2.2"
                                    strokeDasharray="8 5"
                                  />
                                  <line
                                    x1={hxL}
                                    y1={frontZ}
                                    x2={hxL}
                                    y2={frontZ + leafW}
                                    stroke={doorStroke}
                                    strokeWidth="3.5"
                                  />

                                  {/* Right Leaf True 90° Quarter-Circle Sector (Hinged at hxR) */}
                                  <path
                                    d={`M ${hxR} ${frontZ} L ${hxR - leafW} ${frontZ} A ${leafW} ${leafW} 0 0 0 ${hxR} ${frontZ + leafW} Z`}
                                    fill={doorSweepFill}
                                    stroke={doorStroke}
                                    strokeWidth="2.2"
                                    strokeDasharray="8 5"
                                  />
                                  <line
                                    x1={hxR}
                                    y1={frontZ}
                                    x2={hxR}
                                    y2={frontZ + leafW}
                                    stroke={doorStroke}
                                    strokeWidth="3.5"
                                  />
                                </g>
                              );
                            }

                            // 6. HINGED SINGLE DOOR (Tek Kapak Sol Menteşe veya Sağ Menteşe — True 90° Quarter-Circle Arc with R = leafW!)
                            const isRightHinge =
                              dType === "single_right" ||
                              dType === "inset_right" ||
                              dType === "half_overlay_right" ||
                              b.door.direction === "right";
                            const leafW = Math.max(140, Math.round(baySpanW - 8));
                            const hx = isRightHinge ? bx + baySpanW - 4 : bx + 4;
                            const closedTipX = isRightHinge ? hx - leafW : hx + leafW;
                            const handleX = isRightHinge ? closedTipX + 22 : closedTipX - 22;

                            return (
                              <g
                                key={`door_sys_${bIdx}`}
                                data-testid={`plan-door-single-bay-${bIdx}`}
                                className="pointer-events-none"
                              >
                                {/* Closed Door Leaf Line */}
                                <line
                                  x1={bx + 4}
                                  y1={frontZ}
                                  x2={bx + baySpanW - 4}
                                  y2={frontZ}
                                  stroke={doorStroke}
                                  strokeWidth="4.5"
                                />
                                {/* Handle Tick on Opposite Edge of Hinge */}
                                <line
                                  x1={handleX}
                                  y1={frontZ}
                                  x2={handleX}
                                  y2={frontZ + 18}
                                  stroke="#0F172A"
                                  strokeWidth="4"
                                />
                                {/* True 90° Quarter-Circle Door Swing Sector (Radius === Door Leaf Width!) */}
                                <path
                                  d={
                                    isRightHinge
                                      ? `M ${hx} ${frontZ} L ${closedTipX} ${frontZ} A ${leafW} ${leafW} 0 0 0 ${hx} ${frontZ + leafW} Z`
                                      : `M ${hx} ${frontZ} L ${closedTipX} ${frontZ} A ${leafW} ${leafW} 0 0 1 ${hx} ${frontZ + leafW} Z`
                                  }
                                  fill={doorSweepFill}
                                  stroke={doorStroke}
                                  strokeWidth="2.2"
                                  strokeDasharray="8 5"
                                />
                                {/* Open 90° Door Leaf Line */}
                                <line
                                  x1={hx}
                                  y1={frontZ}
                                  x2={hx}
                                  y2={frontZ + leafW}
                                  stroke={doorStroke}
                                  strokeWidth="3.5"
                                />
                              </g>
                            );
                          })
                        )}
                      </>
                    );
                  })()}


                  {/* Unmistakable Selected Module Halo, Proportional Ribbon Badge, 90° Rotate Buttons & Edge Resize Handles */}
                  {isAct && (() => {
                    const ribFont = Math.round(20 * ts);
                    const ribW = Math.round(220 * ts);
                    const ribH = Math.round(36 * ts);
                    const ribCenterY = mz - Math.round(32 * ts);
                    const rotR = Math.round(22 * ts);
                    const rotOffset = Math.round(ribW / 2 + rotR + 10 * ts);
                    const sideHandleW = Math.round(30 * ts);
                    const sideHandleH = Math.round(56 * ts);
                    const topBotHandleW = Math.round(56 * ts);
                    const topBotHandleH = Math.round(28 * ts);
                    const handleFont = Math.round(19 * ts);

                    return (
                      <g>
                        <rect
                          x={mx - 8}
                          y={mz - 8}
                          width={mw + 16}
                          height={md + 16}
                          rx={10}
                          fill="none"
                          stroke="#D97706"
                          strokeWidth={Math.round(3.5 * ts)}
                          strokeDasharray="12 6"
                          className="pointer-events-none"
                        />
                        <rect
                          x={mx + mw / 2 - ribW / 2}
                          y={ribCenterY - ribH / 2}
                          width={ribW}
                          height={ribH}
                          rx={Math.round(9 * ts)}
                          fill="#B45309"
                          stroke="#FFFFFF"
                          strokeWidth="2.5"
                          className="pointer-events-none"
                        />
                        <text
                          x={mx + mw / 2}
                          y={ribCenterY + Math.round(ribFont * 0.35)}
                          textAnchor="middle"
                          fill="#FFFFFF"
                          fontSize={ribFont}
                          fontWeight="900"
                          fontFamily="monospace"
                          className="pointer-events-none"
                        >
                          {`★ SEÇİLİ #${idx + 1}`}
                        </text>

                        {/* On-Canvas Clickable -90° (↺) & +90° (↻) Proportional Rotate Gizmo Buttons */}
                        <g
                          data-testid={`plan-oncanvas-rotate-ccw-mod-${idx}`}
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (idx !== activeModuleIndex) setActiveModuleIndex(idx);
                            rotateActiveModule90(-90);
                          }}
                          className="cursor-pointer"
                        >
                          <circle
                            cx={mx + mw / 2 - rotOffset}
                            cy={ribCenterY}
                            r={rotR}
                            fill="#D97706"
                            stroke="#FFFFFF"
                            strokeWidth="2.5"
                          />
                          <text
                            x={mx + mw / 2 - rotOffset}
                            y={ribCenterY + Math.round(ribFont * 0.36)}
                            textAnchor="middle"
                            fill="#FFFFFF"
                            fontSize={Math.round(21 * ts)}
                            fontWeight="900"
                          >
                            ↺
                          </text>
                        </g>
                        <g
                          data-testid={`plan-oncanvas-rotate-mod-${idx}`}
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (idx !== activeModuleIndex) setActiveModuleIndex(idx);
                            rotateActiveModule90(90);
                          }}
                          className="cursor-pointer"
                        >
                          <circle
                            cx={mx + mw / 2 + rotOffset}
                            cy={ribCenterY}
                            r={rotR}
                            fill="#D97706"
                            stroke="#FFFFFF"
                            strokeWidth="2.5"
                          />
                          <text
                            x={mx + mw / 2 + rotOffset}
                            y={ribCenterY + Math.round(ribFont * 0.36)}
                            textAnchor="middle"
                            fill="#FFFFFF"
                            fontSize={Math.round(21 * ts)}
                            fontWeight="900"
                          >
                            ↻
                          </text>
                        </g>

                        {/* Left Edge Resize Handle (◀) */}
                        <g
                          data-testid={`plan-mod-resize-left-${idx}`}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            if (idx !== activeModuleIndex) setActiveModuleIndex(idx);
                            const svgEl = (e.currentTarget as Element).closest("svg") as SVGSVGElement | null;
                            const isRot90 = fp.rotationY === 90 || fp.rotationY === 270;
                            beginHistoryTransaction();
                            setResizingPlanObject({
                              kind: "module_left",
                              targetIdxOrId: idx,
                              startClientX: e.clientX,
                              startClientY: e.clientY,
                              startWidthOrLen: fp.rawWidth,
                              startDepth: fp.rawDepth,
                              startPosX: fp.x,
                              startPosZ: fp.z,
                              isRotated90: isRot90,
                              mmPerPx: svgEl ? getSvgMmPerPx(svgEl) : 4,
                            });
                          }}
                          className="cursor-ew-resize"
                        >
                          <rect
                            x={mx - sideHandleW / 2 - 2}
                            y={mz + md / 2 - sideHandleH / 2}
                            width={sideHandleW}
                            height={sideHandleH}
                            rx={8}
                            fill={fp.rotationY === 90 || fp.rotationY === 270 ? "#0284C7" : "#059669"}
                            stroke="#FFFFFF"
                            strokeWidth="2.5"
                          />
                          <text
                            x={mx - 2}
                            y={mz + md / 2 + Math.round(handleFont * 0.35)}
                            textAnchor="middle"
                            fill="#FFFFFF"
                            fontSize={handleFont}
                            fontWeight="900"
                          >
                            ◀
                          </text>
                        </g>

                        {/* Right Edge Resize Handle (▶) */}
                        <g
                          data-testid={`plan-mod-resize-right-${idx}`}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            if (idx !== activeModuleIndex) setActiveModuleIndex(idx);
                            const svgEl = (e.currentTarget as Element).closest("svg") as SVGSVGElement | null;
                            const isRot90 = fp.rotationY === 90 || fp.rotationY === 270;
                            beginHistoryTransaction();
                            setResizingPlanObject({
                              kind: "module_right",
                              targetIdxOrId: idx,
                              startClientX: e.clientX,
                              startClientY: e.clientY,
                              startWidthOrLen: fp.rawWidth,
                              startDepth: fp.rawDepth,
                              startPosX: fp.x,
                              startPosZ: fp.z,
                              isRotated90: isRot90,
                              mmPerPx: svgEl ? getSvgMmPerPx(svgEl) : 4,
                            });
                          }}
                          className="cursor-ew-resize"
                        >
                          <rect
                            x={mx + mw - sideHandleW / 2 + 2}
                            y={mz + md / 2 - sideHandleH / 2}
                            width={sideHandleW}
                            height={sideHandleH}
                            rx={8}
                            fill={fp.rotationY === 90 || fp.rotationY === 270 ? "#0284C7" : "#059669"}
                            stroke="#FFFFFF"
                            strokeWidth="2.5"
                          />
                          <text
                            x={mx + mw + 2}
                            y={mz + md / 2 + Math.round(handleFont * 0.35)}
                            textAnchor="middle"
                            fill="#FFFFFF"
                            fontSize={handleFont}
                            fontWeight="900"
                          >
                            ▶
                          </text>
                        </g>

                        {/* Top Edge Resize Handle (▲) */}
                        <g
                          data-testid={`plan-mod-resize-top-${idx}`}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            if (idx !== activeModuleIndex) setActiveModuleIndex(idx);
                            const svgEl = (e.currentTarget as Element).closest("svg") as SVGSVGElement | null;
                            const isRot90 = fp.rotationY === 90 || fp.rotationY === 270;
                            beginHistoryTransaction();
                            setResizingPlanObject({
                              kind: "module_top",
                              targetIdxOrId: idx,
                              startClientX: e.clientX,
                              startClientY: e.clientY,
                              startWidthOrLen: fp.rawWidth,
                              startDepth: fp.rawDepth,
                              startPosX: fp.x,
                              startPosZ: fp.z,
                              isRotated90: isRot90,
                              mmPerPx: svgEl ? getSvgMmPerPx(svgEl) : 4,
                            });
                          }}
                          className="cursor-ns-resize"
                        >
                          <rect
                            x={mx + mw / 2 - topBotHandleW / 2}
                            y={mz - topBotHandleH / 2}
                            width={topBotHandleW}
                            height={topBotHandleH}
                            rx={7}
                            fill={fp.rotationY === 90 || fp.rotationY === 270 ? "#059669" : "#0284C7"}
                            stroke="#FFFFFF"
                            strokeWidth="2.5"
                          />
                          <text
                            x={mx + mw / 2}
                            y={mz + Math.round(handleFont * 0.32)}
                            textAnchor="middle"
                            fill="#FFFFFF"
                            fontSize={Math.round(17 * ts)}
                            fontWeight="900"
                          >
                            ▲
                          </text>
                        </g>

                        {/* Bottom Edge Resize Handle (▼) */}
                        <g
                          data-testid={`plan-mod-resize-depth-${idx}`}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            if (idx !== activeModuleIndex) setActiveModuleIndex(idx);
                            const svgEl = (e.currentTarget as Element).closest("svg") as SVGSVGElement | null;
                            const isRot90 = fp.rotationY === 90 || fp.rotationY === 270;
                            beginHistoryTransaction();
                            setResizingPlanObject({
                              kind: "module_depth",
                              targetIdxOrId: idx,
                              startClientX: e.clientX,
                              startClientY: e.clientY,
                              startWidthOrLen: fp.rawWidth,
                              startDepth: fp.rawDepth,
                              startPosX: fp.x,
                              startPosZ: fp.z,
                              isRotated90: isRot90,
                              mmPerPx: svgEl ? getSvgMmPerPx(svgEl) : 4,
                            });
                          }}
                          className="cursor-ns-resize"
                        >
                          <rect
                            x={mx + mw / 2 - topBotHandleW / 2}
                            y={mz + md - topBotHandleH / 2}
                            width={topBotHandleW}
                            height={topBotHandleH}
                            rx={7}
                            fill={fp.rotationY === 90 || fp.rotationY === 270 ? "#059669" : "#0284C7"}
                            stroke="#FFFFFF"
                            strokeWidth="2.5"
                          />
                          <text
                            x={mx + mw / 2}
                            y={mz + md + Math.round(handleFont * 0.32)}
                            textAnchor="middle"
                            fill="#FFFFFF"
                            fontSize={Math.round(17 * ts)}
                            fontWeight="900"
                          >
                            ▼
                          </text>
                        </g>
                      </g>
                    );
                  })()}

                  {/* Module Name & Dimensions (Concise Title without redundant 'Modülü' + Goldilocks Scale `ts`) */}
                  {(() => {
                    const labelCenterY =
                      fp.cornerType === "l_corner" && (fp.rotationY === 0 || fp.rotationY === 90)
                        ? mz + Math.min(fp.wingDepthMm || 580, md) * 0.42
                        : mz + md * 0.43;
                    const conciseName = fp.name.replace(/\s*Modülü/gi, "").trim();
                    const fullTitle = `#${idx + 1} ${conciseName}${fp.rotationY > 0 ? ` (${fp.rotationY}°)` : ""}`;
                    const maxAllowedNameFont = Math.floor((mw - 32) / Math.max(7, fullTitle.length * 0.52));
                    const nameFont = Math.max(24, Math.min(Math.round(26 * ts), maxAllowedNameFont));
                    const dimFont = Math.max(22, Math.min(Math.round(23 * ts), Math.floor((mw - 36) / 9.8)));
                    const dimLabel = `${fp.rawWidth}×${fp.rawDepth} (H:${fp.rawHeight})`;
                    const innerPillH = Math.round(dimFont * 1.72);
                    const innerPillW = Math.min(
                      mw - 24,
                      Math.max(Math.round(160 * ts), Math.round(dimLabel.length * dimFont * 0.6 + 24 * ts))
                    );
                    return (
                      <g className="pointer-events-none">
                        <text
                          x={mx + mw / 2}
                          y={labelCenterY - Math.round(8 * ts)}
                          textAnchor="middle"
                          fill="#0F172A"
                          stroke="#FFFFFF"
                          strokeWidth={Math.round(5 * ts)}
                          paintOrder="stroke"
                          fontSize={nameFont}
                          fontWeight="800"
                          fontFamily="sans-serif"
                        >
                          {fullTitle}
                        </text>
                        <rect
                          x={mx + mw / 2 - innerPillW / 2}
                          y={labelCenterY + Math.round(4 * ts)}
                          width={innerPillW}
                          height={innerPillH}
                          rx={8}
                          fill="#FFFFFF"
                          stroke={hasCollisionError ? "#DC2626" : isAct ? "#2563EB" : "#94A3B8"}
                          strokeWidth="2"
                          opacity={0.96}
                        />
                        <text
                          x={mx + mw / 2}
                          y={labelCenterY + Math.round(4 * ts) + Math.round(innerPillH * 0.72)}
                          textAnchor="middle"
                          fill={hasCollisionError ? "#DC2626" : "#0F172A"}
                          fontSize={dimFont}
                          fontWeight="800"
                          fontFamily="monospace"
                        >
                          {dimLabel}
                        </text>
                      </g>
                    );
                  })()}

                  {/* Width Callout with Clean Proportional Pill & Architectural Ticks */}
                  {showPlanDimensions && (() => {
                    const calloutY = mz + md + Math.round(52 * ts);
                    const calloutText = `${mw} mm`;
                    const calloutFont = Math.round(23 * ts);
                    const pillH = Math.round(38 * ts);
                    const pillW = Math.max(Math.round(125 * ts), Math.round(calloutText.length * calloutFont * 0.64 + 26 * ts));
                    return (
                      <g className="pointer-events-none">
                        <line
                          x1={mx}
                          y1={calloutY - 14}
                          x2={mx}
                          y2={calloutY + 14}
                          stroke="#9A3412"
                          strokeWidth="2.5"
                        />
                        <line
                          x1={mx + mw}
                          y1={calloutY - 14}
                          x2={mx + mw}
                          y2={calloutY + 14}
                          stroke="#9A3412"
                          strokeWidth="2.5"
                        />
                        <line
                          x1={mx}
                          y1={calloutY}
                          x2={mx + mw}
                          y2={calloutY}
                          stroke="#9A3412"
                          strokeWidth="2.5"
                        />
                        <rect
                          x={mx + mw / 2 - pillW / 2}
                          y={calloutY - pillH / 2}
                          width={pillW}
                          height={pillH}
                          rx={9}
                          fill="#FFFFFF"
                          stroke="#9A3412"
                          strokeWidth="2.5"
                        />
                        <text
                          x={mx + mw / 2}
                          y={calloutY + Math.round(calloutFont * 0.35)}
                          textAnchor="middle"
                          fill="#7C2D12"
                          fontSize={calloutFont}
                          fontWeight="800"
                          fontFamily="monospace"
                        >
                          {calloutText}
                        </text>
                      </g>
                    );
                  })()}

                  {/* Selected Module Alignment Badge (Shown below Width Callout without overlapping) */}
                  {isAct && showPlanDimensions && (() => {
                    const alignTxt =
                      activeSpatialMetrics.alignmentMode === "center"
                        ? "↔ Merkez Hizala ↔"
                        : activeSpatialMetrics.alignmentMode === "left"
                        ? "⬅ Sola Yaslı (0 mm)"
                        : activeSpatialMetrics.alignmentMode === "right"
                        ? "Sağa Yaslı (0 mm) ➡"
                        : `↔ Sol: ${activeSpatialMetrics.leftClearanceMm} • Sağ: ${activeSpatialMetrics.rightClearanceMm}mm`;
                    const alignFont = Math.round(18 * ts);
                    const alignH = Math.round(32 * ts);
                    const alignW = Math.max(Math.round(200 * ts), Math.round(alignTxt.length * alignFont * 0.58 + 24 * ts));
                    const alignY = mz + md + Math.round(98 * ts);
                    return (
                      <g data-testid={`plan-mod-alignment-badge-${idx}`} className="pointer-events-none">
                        <rect
                          x={mx + mw / 2 - alignW / 2}
                          y={alignY - alignH / 2}
                          width={alignW}
                          height={alignH}
                          rx={8}
                          fill="#EFF6FF"
                          stroke="#2563EB"
                          strokeWidth="2"
                        />
                        <text
                          x={mx + mw / 2}
                          y={alignY + Math.round(alignFont * 0.35)}
                          textAnchor="middle"
                          fill="#1D4ED8"
                          fontSize={alignFont}
                          fontWeight="800"
                          fontFamily="sans-serif"
                        >
                          {alignTxt}
                        </text>
                      </g>
                    );
                  })()}

                  {/* Axis-Aligned Remaining Clearance Callout (Positioned at 22% depth near wall so it never hits the middle ▶ resize handle or column label!) */}
                  {showPlanDimensions && gapRight > 80 && (fp.rotationY === 0 || fp.rotationY === 180) && (() => {
                    const gapY = mz + Math.min(140, md * 0.24);
                    const gapText = `Boşluk: ${Math.round(gapRight)} mm`;
                    const gapFont = Math.round(19 * ts);
                    const gapPillH = Math.round(34 * ts);
                    const gapPillW = Math.max(Math.round(155 * ts), Math.round(gapText.length * gapFont * 0.6 + 22 * ts));
                    return (
                      <g data-testid={`plan-mod-clearance-badge-${idx}`} className="pointer-events-none">
                        <line
                          x1={mx + mw}
                          y1={gapY - 12}
                          x2={mx + mw}
                          y2={gapY + 12}
                          stroke="#2563EB"
                          strokeWidth="2.5"
                        />
                        <line
                          x1={mx + mw + gapRight}
                          y1={gapY - 12}
                          x2={mx + mw + gapRight}
                          y2={gapY + 12}
                          stroke="#2563EB"
                          strokeWidth="2.5"
                        />
                        <line
                          x1={mx + mw}
                          y1={gapY}
                          x2={mx + mw + gapRight}
                          y2={gapY}
                          stroke="#2563EB"
                          strokeWidth="2.5"
                          strokeDasharray="8 5"
                        />
                        <rect
                          x={mx + mw + gapRight / 2 - gapPillW / 2}
                          y={gapY - gapPillH / 2}
                          width={gapPillW}
                          height={gapPillH}
                          rx={8}
                          fill="#FFFFFF"
                          stroke="#2563EB"
                          strokeWidth="2"
                        />
                        <text
                          x={mx + mw + gapRight / 2}
                          y={gapY + Math.round(gapFont * 0.35)}
                          textAnchor="middle"
                          fill="#1D4ED8"
                          fontSize={gapFont}
                          fontWeight="800"
                          fontFamily="monospace"
                        >
                          {gapText}
                        </text>
                      </g>
                    );
                  })()}

                  {/* Site Survey Detail: Automatic CNC Back-Panel Socket / Plumbing Cut-Out (Buat Kesimi) & 15mm Skirting Allowance */}
                  {(() => {
                    const overlappingSockets = spaceObstacles.filter(
                      (o) =>
                        (o.type === "electrical" || o.type === "plumbing") &&
                        o.position.x + o.dimensions.width > mx + 18 &&
                        o.position.x < mx + mw - 18 &&
                        mz <= 80
                    );
                    if (overlappingSockets.length === 0) return null;
                    return (
                      <g data-testid={`plan-mod-cnc-back-cutout-${idx}`} className="pointer-events-none">
                        {overlappingSockets.map((soc) => {
                          const sx = Math.max(mx + 24, Math.min(mx + mw - 144, soc.position.x - 20));
                          const cutW = Math.max(120, soc.dimensions.width + 40);
                          return (
                            <g key={`cut_${soc.id}`}>
                              <rect
                                x={sx}
                                y={mz + 2}
                                width={cutW}
                                height={28}
                                rx={4}
                                fill="#FEF08A"
                                stroke="#CA8A04"
                                strokeWidth="2.5"
                                strokeDasharray="6 3"
                              />
                              <text
                                x={sx + cutW / 2}
                                y={mz + 21}
                                textAnchor="middle"
                                fill="#713F12"
                                fontSize={Math.round(14 * ts)}
                                fontWeight="900"
                                fontFamily="monospace"
                              >
                                {soc.type === "electrical" ? "✂ PRİZ BUAT" : "✂ TESİSAT KESİM"}
                              </text>
                            </g>
                          );
                        })}
                      </g>
                    );
                  })()}

                  {/* Rotated Side-Wall Module Z-Axis Clearance Callout (Placed below the alignment badge so it NEVER overlaps the ▶ handle!) */}
                  {isAct && showPlanDimensions && (fp.rotationY === 90 || fp.rotationY === 270) && activeSpatialMetrics.rightClearanceMm > 15 && (() => {
                    const gapZ = activeSpatialMetrics.rightClearanceMm;
                    const lineX = mx + mw - 60;
                    const gapText = `Boşluk: ${gapZ} mm`;
                    const gapFont = Math.round(18 * ts);
                    const gapPillH = Math.round(32 * ts);
                    const gapPillW = Math.max(Math.round(150 * ts), Math.round(gapText.length * gapFont * 0.6 + 22 * ts));
                    const pillCenterY = mz + md + Math.max(145, Math.min(gapZ / 2, 220));
                    return (
                      <g data-testid={`plan-mod-side-clearance-badge-${idx}`} className="pointer-events-none">
                        <line
                          x1={lineX}
                          y1={mz + md}
                          x2={lineX}
                          y2={mz + md + gapZ}
                          stroke="#2563EB"
                          strokeWidth="2.5"
                          strokeDasharray="8 5"
                        />
                        <rect
                          x={lineX - gapPillW / 2}
                          y={pillCenterY - gapPillH / 2}
                          width={gapPillW}
                          height={gapPillH}
                          rx={8}
                          fill="#FFFFFF"
                          stroke="#2563EB"
                          strokeWidth="2"
                        />
                        <text
                          x={lineX}
                          y={pillCenterY + Math.round(gapFont * 0.35)}
                          textAnchor="middle"
                          fill="#1D4ED8"
                          fontSize={gapFont}
                          fontWeight="800"
                          fontFamily="monospace"
                        >
                          {gapText}
                        </text>
                      </g>
                    );
                  })()}
                </g>
              );
            })}

            {/* 3B. Unified Bottom Room Dimension & Area Callout (Placed at bottom floor line so it NEVER covers modules in the middle of the room!) */}
            {showPlanDimensions && (() => {
              const roomCenterX = (mainWall.length || 3600) / 2;
              const roomDepth = activeSpatialMetrics.roomDepthMm || 2700;
              const roomTitle =
                project.space.name && project.space.name !== "Ana Mekân"
                  ? project.space.name
                  : project.space.type.startsWith("kitchen")
                  ? "Mutfak Mekânı"
                  : "Ebeveyn Giyinme Odası";
              const areaStr = activeSpatialMetrics.roomAreaM2.toLocaleString("tr-TR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              });
              const bottomDimZ = Math.max(roomDepth - 60, maxDepthZ - 80, 1850);
              const combinedBottomText = `📐 ${roomTitle} (${areaStr} m²) • Oda Genişliği: ${mainWall.length} mm`;
              const botFont = Math.round(22 * ts);
              const botH = Math.round(42 * ts);
              const botW = Math.max(Math.round(480 * ts), Math.round(combinedBottomText.length * botFont * 0.58 + 36 * ts));
              return (
                <g data-testid="plan-room-area-badge" className="pointer-events-none">
                  {spaceWalls.length === 1 && (
                    <g opacity={0.45}>
                      <line
                        x1={0}
                        y1={0}
                        x2={0}
                        y2={bottomDimZ}
                        stroke="#64748B"
                        strokeWidth="5"
                        strokeDasharray="16 10"
                      />
                      <line
                        x1={mainWall.length}
                        y1={0}
                        x2={mainWall.length}
                        y2={bottomDimZ}
                        stroke="#64748B"
                        strokeWidth="5"
                        strokeDasharray="16 10"
                      />
                    </g>
                  )}
                  <line
                    x1={40}
                    y1={bottomDimZ}
                    x2={mainWall.length - 40}
                    y2={bottomDimZ}
                    stroke="#64748B"
                    strokeWidth="2.5"
                  />
                  <rect
                    x={roomCenterX - botW / 2}
                    y={bottomDimZ - botH / 2}
                    width={botW}
                    height={botH}
                    rx={10}
                    fill="rgba(255, 255, 255, 0.94)"
                    stroke="#64748B"
                    strokeWidth="2"
                  />
                  <text
                    x={roomCenterX}
                    y={bottomDimZ + Math.round(botFont * 0.35)}
                    textAnchor="middle"
                    fill="#0F172A"
                    fontSize={botFont}
                    fontWeight="800"
                    fontFamily="monospace"
                  >
                    {combinedBottomText}
                  </text>
                </g>
              );
            })()}

                        {/* 4. Live Magnetic Snap Lines during Existing Module Drag in 2D Plan */}
            {draggingModIdx !== null && (
              <g data-testid="plan-existing-mod-snap-guides" className="pointer-events-none">
                {[
                  0,
                  mainWall.length,
                  ...footprints.flatMap((f, i) =>
                    i === draggingModIdx ||
                    Math.abs(f.z - (footprints[draggingModIdx]?.z || 0)) > 65
                      ? []
                      : [f.x, f.x + f.planWidth]
                  ),
                ].map(
                  (sx, sIdx) => {
                    const isLocked = activePlanSnapX === sx;
                    return (
                      <g key={`mod_snap_${sIdx}_${sx}`}>
                        <line
                          x1={sx}
                          y1={-180}
                          x2={sx}
                          y2={maxDepthZ + 120}
                          stroke={isLocked ? "#059669" : "#D97706"}
                          strokeWidth={isLocked ? "7" : "3.5"}
                          strokeDasharray={isLocked ? "18 8" : "10 8"}
                          opacity={isLocked ? 0.98 : 0.65}
                        />
                        {isLocked && (
                          <g>
                            <rect
                              x={sx - 135}
                              y={-225}
                              width={270}
                              height={44}
                              rx={10}
                              fill="#059669"
                            />
                            <text
                              x={sx}
                              y={-196}
                              textAnchor="middle"
                              fill="#FFFFFF"
                              fontSize="24"
                              fontWeight="800"
                              fontFamily="monospace"
                            >
                              {`🧲 SNAP X:${sx}mm`}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  }
                )}
              </g>
            )}

            {/* 4B. ON-CANVAS ARCHITECTURAL COLLISION & COMPATIBILITY WARNING CALLOUTS (Positioned cleanly along the intersection zone, never covering cabinet center labels!) */}
            {liveSpatialAlerts.length > 0 && (
              <g data-testid="plan-spatial-collision-overlays" className="pointer-events-none">
                {liveSpatialAlerts.map((al, aIdx) => {
                  const isErr = al.severity === "error";
                  const isWallAlert = al.kind === "window" || al.kind === "plumbing";
                  const collFont = Math.round(18 * ts);
                  const collH = Math.round(34 * ts);
                  const badgeW = Math.max(Math.round(240 * ts), Math.round(al.title.length * collFont * 0.6 + 32 * ts));
                  const targetZ = isWallAlert ? 0 : al.z;
                  // Keep wall alert badges safely inside the top viewBox (never clipped at top!)
                  const rawBadgeY = isWallAlert ? -155 - aIdx * 40 : al.z + 95 + (aIdx % 2) * 42;
                  const badgeY = Math.max(vb.y + collH, rawBadgeY);
                  return (
                    <g key={al.id}>
                      {isWallAlert ? (
                        <rect
                          x={al.x - al.w / 2}
                          y={-32}
                          width={al.w}
                          height={76}
                          rx={8}
                          fill={isErr ? "rgba(220, 38, 38, 0.26)" : "rgba(217, 119, 6, 0.24)"}
                          stroke={isErr ? "#DC2626" : "#D97706"}
                          strokeWidth="5"
                          strokeDasharray="10 6"
                        />
                      ) : (
                        <circle
                          cx={al.x}
                          cy={targetZ}
                          r={64}
                          fill={isErr ? "rgba(220, 38, 38, 0.20)" : "rgba(217, 119, 6, 0.20)"}
                          stroke={isErr ? "#DC2626" : "#D97706"}
                          strokeWidth="5"
                          strokeDasharray="12 6"
                        />
                      )}
                      <line
                        x1={al.x}
                        y1={targetZ}
                        x2={al.x}
                        y2={badgeY}
                        stroke={isErr ? "#DC2626" : "#D97706"}
                        strokeWidth="3.5"
                        strokeDasharray="8 5"
                      />
                      <rect
                        x={al.x - badgeW / 2}
                        y={badgeY - collH / 2}
                        width={badgeW}
                        height={collH}
                        rx={Math.round(12 * ts)}
                        fill={isErr ? "#991B1B" : "#92400E"}
                        stroke="#FFFFFF"
                        strokeWidth={Math.round(3 * ts)}
                      />
                      <text
                        x={al.x}
                        y={badgeY + Math.round(collFont * 0.34)}
                        textAnchor="middle"
                        fill="#FFFFFF"
                        fontSize={collFont}
                        fontWeight="900"
                        fontFamily="monospace"
                      >
                        {`⚠️ ${al.title}`}
                      </text>
                    </g>
                  );
                })}
              </g>
            )}

            {/* 5. Live Catalog Drag-and-Drop 2D Ghost Cabinet Silhouette + All Magnetic Snap Slots */}
            {dragGhostPreview && (
              <g data-testid="plan-catalog-drag-ghost-silhouette" className="pointer-events-none">
                {/* All Available Magnetic Snap Slots along the Wall */}
                {dragGhostPreview.snapSlots.map((slot, sIdx) => (
                  <g key={`slot_${sIdx}_${slot.x}`}>
                    <line
                      x1={slot.x}
                      y1={-190}
                      x2={slot.x}
                      y2={slot.depth + 260}
                      stroke={slot.isActive ? "#059669" : "#D97706"}
                      strokeWidth={slot.isActive ? "7" : "4"}
                      strokeDasharray="16 8"
                    />
                    <rect
                      x={slot.x}
                      y={0}
                      width={slot.width}
                      height={slot.depth}
                      rx={8}
                      fill={slot.isActive ? "rgba(16, 185, 129, 0.14)" : "rgba(245, 158, 11, 0.08)"}
                      stroke={slot.isActive ? "#059669" : "#D97706"}
                      strokeWidth={slot.isActive ? "4" : "2.5"}
                      strokeDasharray="12 6"
                    />
                    <rect
                      x={slot.x - 110}
                      y={-232}
                      width={220}
                      height={42}
                      rx={9}
                      fill={slot.isActive ? "#059669" : "#B45309"}
                    />
                    <text
                      x={slot.x}
                      y={-204}
                      textAnchor="middle"
                      fill="#FFFFFF"
                      fontSize="22"
                      fontWeight="800"
                      fontFamily="monospace"
                    >
                      {`🧲 X:${slot.x}mm`}
                    </text>
                  </g>
                ))}

                {/* Dragged Module Full-Scale 2D Cabinet Silhouette (Carcass + Bay Dividers + Door Swing Arcs) */}
                {(() => {
                  const gm = dragGhostPreview.previewModule;
                  const gx = dragGhostPreview.snappedX;
                  const gz = dragGhostPreview.snappedZ;
                  const gw = gm.dimensions.width;
                  const gd = gm.dimensions.depth;
                  const bayCnt = Math.max(1, gm.bays.length);
                  const strokeCol = dragGhostPreview.isSnappedToSlot ? "#047857" : "#0369A1";
                  const fillCol = dragGhostPreview.isSnappedToSlot
                    ? "rgba(16, 185, 129, 0.28)"
                    : "rgba(14, 165, 233, 0.24)";
                  return (
                    <g>
                      <rect
                        x={gx}
                        y={gz}
                        width={gw}
                        height={gd}
                        rx={8}
                        fill={fillCol}
                        stroke={strokeCol}
                        strokeWidth="7"
                      />
                      {/* Bay dividers & authentic 90° quarter-circle door swing arcs */}
                      {(() => {
                        const gBayWidths = calculateBayWidths(gm);
                        const gT = gm.carcass.panelThickness || 18;
                        let gCurX = gT;
                        return gBayWidths.map((gClearW, bIdx) => {
                          const lPad = bIdx === 0 ? gT : gT / 2;
                          const rPad = bIdx === gBayWidths.length - 1 ? gT : gT / 2;
                          const bx = gx + gCurX - lPad;
                          const bw = gClearW + lPad + rPad;
                          gCurX += gClearW + gT;
                          const bDoor = gm.bays[bIdx]?.door;
                          const isDbl = bDoor?.type === "double" || bDoor?.doorSystemId === "hinged_double" || bw > 600;
                          const isSld = bDoor?.type === "sliding" || bDoor?.doorSystemId?.startsWith("sliding");
                          const leafW = isDbl ? Math.round((bw - 8) / 2) : Math.round(bw - 8);
                          return (
                            <g key={`ghost_bay_${bIdx}`}>
                              {bIdx > 0 && (
                                <line
                                  x1={bx}
                                  y1={gz}
                                  x2={bx}
                                  y2={gz + gd}
                                  stroke={strokeCol}
                                  strokeWidth="3.5"
                                  strokeDasharray="10 6"
                                />
                              )}
                              {!gm.isOpenFront && !isSld && (
                                isDbl ? (
                                  <>
                                    <path
                                      d={`M ${bx + 4} ${gz + gd} L ${bx + 4 + leafW} ${gz + gd} A ${leafW} ${leafW} 0 0 1 ${bx + 4} ${gz + gd + leafW} Z`}
                                      fill="none"
                                      stroke={strokeCol}
                                      strokeWidth="3"
                                      strokeDasharray="10 6"
                                    />
                                    <path
                                      d={`M ${bx + bw - 4} ${gz + gd} L ${bx + bw - 4 - leafW} ${gz + gd} A ${leafW} ${leafW} 0 0 0 ${bx + bw - 4} ${gz + gd + leafW} Z`}
                                      fill="none"
                                      stroke={strokeCol}
                                      strokeWidth="3"
                                      strokeDasharray="10 6"
                                    />
                                  </>
                                ) : (
                                  <path
                                    d={`M ${bx + 4} ${gz + gd} L ${bx + 4 + leafW} ${gz + gd} A ${leafW} ${leafW} 0 0 1 ${bx + 4} ${gz + gd + leafW} Z`}
                                    fill="none"
                                    stroke={strokeCol}
                                    strokeWidth="3"
                                    strokeDasharray="10 6"
                                  />
                                )
                              )}
                            </g>
                          );
                        });
                      })()}
                      {/* Silhouette Label Pill */}
                      <rect
                        x={gx + gw / 2 - 240}
                        y={gz + gd / 2 - 30}
                        width={480}
                        height={60}
                        rx={12}
                        fill="#064E3B"
                        stroke="#10B981"
                        strokeWidth="3"
                      />
                      <text
                        x={gx + gw / 2}
                        y={gz + gd / 2 + 10}
                        textAnchor="middle"
                        fill="#ECFDF5"
                        fontSize="28"
                        fontWeight="800"
                        fontFamily="monospace"
                      >
                        {`SİLUET: ${gm.name} (${gw}×${gd})`}
                      </text>
                    </g>
                  );
                })()}
              </g>
            )}

          </svg>
        </div>
      );
    }

    // Standard Single-Module High-Precision Architectural Elevation / TopPlan / Section
    const hasSceneModules =
      project.modules.length > 0 && activeModule.id !== "empty_scene_placeholder";
    const breakdown = generateModuleGeometry(activeModule, { doorOpenAngleDeg: 0 });
    const sectionCutSpanMm =
      sectionDirection2D === "Z" ? breakdown.overall.width : breakdown.overall.depth;
    const sectionCutCoordMm = Math.round(sectionCutSpanMm * sectionCutRatio2D);
    const data =
      mode === "elevation"
        ? generateElevation2D(breakdown, selectedComponentId || undefined)
        : mode === "plan"
        ? generateTopPlan2D(breakdown, selectedComponentId || undefined)
        : generateCrossSection2D(breakdown, selectedComponentId || undefined, {
            direction: sectionDirection2D,
            cutCoordMm: sectionCutCoordMm,
          });

    const mainWallLen = spaceWalls[0]?.length || 3600;
    const ceilingH = project.space.ceilingHeight || 2600;
    const activeModOffX = mode === "elevation" && showRoomContextInElev ? activeModule.position.x : 0;
    const activeModOffY = mode === "elevation" && showRoomContextInElev ? activeModule.position.y : 0;
    const padX = mode === "elevation" ? 340 : 260;
    const padY = mode === "elevation" ? 280 : 220;
    const maxWallSpanX = Math.max(
      mainWallLen,
      ...project.modules.map((m) => m.position.x + m.dimensions.width),
      ...spaceObstacles.map((o) => o.position.x + o.dimensions.width)
    );
    const floorSvgY = breakdown.overall.height + activeModOffY;
    const maxWorldTopY = Math.max(
      ceilingH,
      ...project.modules.map((m) => m.position.y + m.dimensions.height),
      ...spaceObstacles.map((o) => o.position.y + o.dimensions.height)
    );
    const minSvgY = floorSvgY - maxWorldTopY - padY;
    const totalElevH = maxWorldTopY + padY * 2;
    const computedElevVb =
      mode === "elevation" && showRoomContextInElev
        ? {
            x: -activeModOffX - padX,
            y: minSvgY,
            width: maxWallSpanX + padX * 2,
            height: totalElevH,
          }
        : {
            x: -padX,
            y: -padY,
            width: data.viewBox.width - 300 + padX * 2,
            height: data.viewBox.height - 300 + padY * 2,
          };
    const isAnyElevDragActive =
      Boolean(interiorDrag) ||
      Boolean(elevDraggingObs) ||
      Boolean(elevDraggingMod) ||
      Boolean(elevResizingMod);
    if (!isAnyElevDragActive || !lockedElevVbRef.current) {
      lockedElevVbRef.current = computedElevVb;
    }
    const vb = lockedElevVbRef.current;

    const getElevScaleMmPerPx = (svgEl: SVGSVGElement) => {
      try {
        const ctm = svgEl.getScreenCTM();
        if (ctm && Math.abs(ctm.a) > 0.00001 && Math.abs(ctm.d) > 0.00001) {
          return { x: 1 / Math.abs(ctm.a), y: 1 / Math.abs(ctm.d) };
        }
      } catch {
        // fallback
      }
      const rect = svgEl.getBoundingClientRect();
      const s = Math.max(
        vb.width / Math.max(1, rect.width * zoom),
        vb.height / Math.max(1, rect.height * zoom)
      );
      return { x: s, y: s };
    };

    const handleElevationPointerMove = (e: React.MouseEvent<SVGSVGElement>) => {
      const svgEl = e.currentTarget;
      if (elevDraggingObs) {
        const dxMm = (e.clientX - elevDraggingObs.startClientX) * elevDraggingObs.mmPerPxX;
        const dyMm = -(e.clientY - elevDraggingObs.startClientY) * elevDraggingObs.mmPerPxY;
        const nextX = Math.max(0, Math.round((elevDraggingObs.startX + dxMm) / 10) * 10);
        const nextY = Math.max(0, Math.round((elevDraggingObs.startY + dyMm) / 10) * 10);
        updateObstaclePosition(elevDraggingObs.id, nextX, undefined, nextY);
        return;
      }
      if (elevResizingMod) {
        if (elevResizingMod.axis === "width_right") {
          const dxMm = (e.clientX - elevResizingMod.startClientX) * elevResizingMod.mmPerPxX;
          const newW = Math.max(300, Math.min(3600, elevResizingMod.startW + dxMm));
          const res = resizeModuleParametric(elevResizingMod.modIdx, newW);
          if (res) {
            setPlanRowSnapBanner(
              `📐 Parametrik Genişlik (W): ${Math.round(newW / 10) * 10}mm → ${res.bayCount} Bölme (${res.bayCount - 1} Dikme) • ${res.totalLeafCount} Kapak`
            );
          }
        } else if (elevResizingMod.axis === "width_left") {
          const dxMm = (e.clientX - elevResizingMod.startClientX) * elevResizingMod.mmPerPxX;
          const maxRightEdge = elevResizingMod.startX + elevResizingMod.startW;
          const rawLeft = Math.max(0, Math.min(maxRightEdge - 300, elevResizingMod.startX + dxMm));
          const newW = Math.max(300, Math.min(3600, maxRightEdge - rawLeft));
          const res = resizeModuleParametric(elevResizingMod.modIdx, newW, rawLeft);
          if (res) {
            setPlanRowSnapBanner(
              `📐 Parametrik Genişlik (W): ${Math.round(newW / 10) * 10}mm (X:${Math.round(rawLeft / 10) * 10}) → ${res.bayCount} Bölme • ${res.totalLeafCount} Kapak`
            );
          }
        } else if (elevResizingMod.axis === "height_top") {
          const dyMm = -(e.clientY - elevResizingMod.startClientY) * elevResizingMod.mmPerPxY;
          const newH = Math.max(350, Math.min(2800, elevResizingMod.startH + dyMm));
          const res = resizeModuleParametric(
            elevResizingMod.modIdx,
            elevResizingMod.startW,
            undefined,
            undefined,
            newH
          );
          setPlanRowSnapBanner(
            `📐 Parametrik Yükseklik (Boy H): ${Math.round(newH / 10) * 10}mm${res ? ` → ${res.shelfCount} Raf` : ""}`
          );
        } else if (elevResizingMod.axis === "height_bottom") {
          const dyMm = -(e.clientY - elevResizingMod.startClientY) * elevResizingMod.mmPerPxY;
          const topWorldY = elevResizingMod.startY + elevResizingMod.startH;
          const nextBottomY = Math.max(0, Math.min(topWorldY - 350, elevResizingMod.startY + dyMm));
          const newH = Math.max(350, Math.min(2800, topWorldY - nextBottomY));
          const res = resizeModuleParametric(
            elevResizingMod.modIdx,
            elevResizingMod.startW,
            undefined,
            undefined,
            newH,
            undefined,
            nextBottomY
          );
          setPlanRowSnapBanner(
            `📐 Parametrik Yükseklik (Boy H): ${Math.round(newH / 10) * 10}mm (Alt Kot Y:${Math.round(nextBottomY / 10) * 10}mm)${res ? ` → ${res.shelfCount} Raf` : ""}`
          );
        }
        return;
      }
      if (elevDraggingMod) {
        const dxMm = (e.clientX - elevDraggingMod.startClientX) * elevDraggingMod.mmPerPxX;
        const dyMm = -(e.clientY - elevDraggingMod.startClientY) * elevDraggingMod.mmPerPxY;
        const rawNextX = Math.max(0, elevDraggingMod.startModX + dxMm);
        const snappedX = magnetEnabled && !e.altKey ? Math.round(rawNextX / 10) * 10 : Math.round(rawNextX);
        const targetMod = project.modules[elevDraggingMod.modIdx];
        if (targetMod) {
          const ceilingH = project.space.ceilingHeight || 2600;
          const maxY = Math.max(0, ceilingH - targetMod.dimensions.height);
          const rawNextY = Math.max(0, Math.min(maxY, elevDraggingMod.startModY + dyMm));
          const snappedY = magnetEnabled && !e.altKey ? Math.round(rawNextY / 10) * 10 : Math.round(rawNextY);
          setModulePosition(elevDraggingMod.modIdx, snappedX, targetMod.position.z, 1, snappedY);
        }
        return;
      }
      if (!interiorDrag) return;
      const scale = getElevScaleMmPerPx(svgEl);
      const mmPerPxY = scale.y;
      const mmPerPxX = scale.x;

      if (interiorDrag.kind === "divider") {
        const dxMm = (e.clientX - interiorDrag.startClientX) * mmPerPxX;
        const snappedW = Math.round((interiorDrag.startValueMm + dxMm) / 10) * 10;
        setBayCustomWidth(interiorDrag.bayIdx, snappedW, false);
        return;
      }

      if (interiorDrag.kind === "sub_divider") {
        const dxMm = (e.clientX - interiorDrag.startClientX) * mmPerPxX;
        const dyMm = -(e.clientY - interiorDrag.startClientY) * mmPerPxY;
        const snappedX = Math.round((interiorDrag.startValueMm + dxMm) / 10) * 10;
        const startMidY =
          (interiorDrag.startElevY ?? 0) + (interiorDrag.itemHeightMm ?? 300) / 2;
        const targetMidY = Math.round(startMidY + dyMm);
        setSubDividerPlacement(
          interiorDrag.bayIdx,
          interiorDrag.targetId,
          { offsetX: snappedX, targetMidY },
          false
        );
        const curBay = activeModule.bays[interiorDrag.bayIdx];
        if (curBay) {
          const ivs = getBayShelfIntervalsForSubDivider(
            curBay,
            calculateNetInnerHeight(activeModule),
            activeModule.carcass.panelThickness || 18
          );
          const freeIvs = ivs.filter((iv) => !iv.hasConflict);
          const hoveredConflictIv = ivs.find(
            (iv) => iv.hasConflict && targetMidY >= iv.botY && targetMidY <= iv.topY
          );
          const bestIv =
            freeIvs.find((iv) => targetMidY >= iv.botY - 18 && targetMidY <= iv.topY + 18) ||
            freeIvs.reduce(
              (best, iv) =>
                !best ||
                Math.abs((iv.botY + iv.topY) / 2 - targetMidY) <
                  Math.abs((best.botY + best.topY) / 2 - targetMidY)
                  ? iv
                  : best,
              null as (typeof freeIvs)[number] | null
            );
          if (hoveredConflictIv && bestIv) {
            setPlanRowSnapBanner(
              `⚠️ Bu aralıkta ${hoveredConflictIv.conflictReason}! Dikme en yakın boş aralığa (${bestIv.label} • Y:${bestIv.botY}mm) kilitlendi`
            );
          } else if (bestIv) {
            setPlanRowSnapBanner(
              `✥ Raf Arası Dikme • ${bestIv.label} • Sol X: ${snappedX}mm (Alt Y: ${bestIv.botY}mm • Boy: ${bestIv.height}mm)`
            );
          }
        }
        return;
      }

      // In SVG, moving cursor UP (negative clientY delta) increases elevationY from bottom panel
      const dyMm = -(e.clientY - interiorDrag.startClientY) * mmPerPxY;
      const rawElevY = interiorDrag.startValueMm + dyMm;
      const snapTargets = computeElevationSnapTargets(
        project,
        activeModuleIndex,
        interiorDrag.bayIdx,
        interiorDrag.targetId,
        interiorDrag.itemHeightMm
      );
      const { elevationY: snappedY, snappedTarget } = resolveElevationSnap(
        rawElevY,
        snapTargets,
        18
      );
      setActiveElevSnap(snappedTarget);

      if (interiorDrag.kind === "shelf") {
        setShelfElevation(interiorDrag.bayIdx, interiorDrag.targetId, snappedY, false);
      } else if (interiorDrag.kind === "drawer") {
        setDrawerPlacement(
          interiorDrag.bayIdx,
          interiorDrag.targetId,
          snappedY,
          undefined,
          false
        );
      } else if (interiorDrag.kind === "rail") {
        setHangingRailElevation(interiorDrag.bayIdx, interiorDrag.targetId, snappedY, false);
      } else if (interiorDrag.kind === "special_fitting") {
        setSpecialFittingPlacement(interiorDrag.bayIdx, interiorDrag.targetId, { elevationY: snappedY }, false);
      }
    };

    const handleElevationPointerUp = () => {
      if (elevResizingMod) {
        setElevResizingMod(null);
        setPlanRowSnapBanner(null);
        commitHistoryTransaction();
      }
      if (elevDraggingObs) {
        setElevDraggingObs(null);
        commitHistoryTransaction();
      }
      if (elevDraggingMod) {
        const swapMsg = finishModuleDragWithSmartSwap(
          elevDraggingMod.modIdx,
          elevDraggingMod.startModX
        );
        setElevDraggingMod(null);
        commitHistoryTransaction();
        if (swapMsg) {
          setPlanRowSnapBanner(swapMsg);
          setTimeout(() => setPlanRowSnapBanner(null), 2800);
        }
      }
      if (interiorDrag) {
        setInteriorDrag(null);
        setPlanRowSnapBanner(null);
        commitHistoryTransaction();
      }
      setActiveElevSnap(null);
    };

    // Map component IDs to interior draggable items
    const findInteriorDragTarget = (compId: string) =>
      findDraggableInteriorComponent(activeModule, compId, breakdown.bayWidths);

    // Collect hanging rails for 2D elevation (only when scene actually has modules!)
    const railComponents =
      hasSceneModules && mode === "elevation"
        ? breakdown.components.filter((c) => c.role === "hanging_rail")
        : [];

    // Filter or show doors in 2D elevation so interior blocks are unobstructed and easy to drag,
    // and return empty array when all modules have been deleted from the scene!
    const visibleElements = !hasSceneModules
      ? []
      : data.elements.filter((el) => {
      if (mode === "elevation") {
        if (!showDoorsIn2D && el.role.startsWith("door") && el.role !== "door_hinge") return false;
        if (
          el.role.startsWith("drawer_") &&
          el.role !== "drawer_front" &&
          el.role !== "drawer_handle"
        ) {
          return false;
        }
      }
      return true;
    });


    const handleElevDragOver = (e: React.DragEvent<HTMLDivElement>) => {
      if (mode !== "elevation") return;
      const activeAcc = typeof window !== "undefined" ? (window as any).__birimActiveDraggedAccessory : null;
      const hasAccessoryMime = e.dataTransfer.types.includes("application/x-birim-accessory-id");

      if (hasAccessoryMime || activeAcc) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        const mod = activeModule || project.modules[0];
        if (!mod) return;

        const svgEl = e.currentTarget.querySelector("svg");
        const rect = (svgEl || e.currentTarget).getBoundingClientRect();
        const relX = Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)));
        const relY = Math.max(0, Math.min(1, (e.clientY - rect.top) / Math.max(1, rect.height)));
        const svgX = vb.x + relX * vb.width;
        const svgY = vb.y + relY * vb.height;

        const carcassT = mod.carcass?.panelThickness || 18;
        const plinthH = mod.carcass?.plinthHeight || 0;
        const netH = calculateNetInnerHeight(mod);
        const bayWidths = calculateBayWidths(mod);

        const modX = mod.position?.x || 0;
        const localX = svgX - modX;
        let targetBayIdx = 0;
        let accX = carcassT;
        let bayStartX = carcassT;
        let curBayWidth = bayWidths[0] || 500;
        for (let i = 0; i < bayWidths.length; i++) {
          const bw = bayWidths[i];
          if (localX >= accX && localX <= accX + bw + carcassT) {
            targetBayIdx = i;
            bayStartX = accX;
            curBayWidth = bw;
            break;
          }
          accX += bw + carcassT;
        }
        targetBayIdx = Math.max(0, Math.min(mod.bays.length - 1, targetBayIdx));
        const localBayX = Math.max(48, Math.min(curBayWidth - 48, Math.round((localX - bayStartX) / 10) * 10));

        const rawY = mod.dimensions.height - svgY - plinthH - carcassT;
        const snappedElevY = Math.max(64, Math.min(netH - 64, Math.round(rawY / 32) * 32));

        const accObj = activeAcc || { id: "lib_shelf", title: "Raf" };
        const isSubDivAcc =
          accObj.id === "lib_sub_divider" ||
          accObj.id === "sub_divider" ||
          accObj.visual === "sub_divider";

        if (isSubDivAcc && mod.bays[targetBayIdx]) {
          const ivs = getBayShelfIntervalsForSubDivider(
            mod.bays[targetBayIdx],
            netH,
            carcassT
          );
          const hoveredIv = ivs.find(
            (iv) => snappedElevY >= iv.botY - 24 && snappedElevY <= iv.topY + 24
          );
          const freeIvs = ivs.filter((iv) => !iv.hasConflict);
          if (hoveredIv?.hasConflict) {
            if (freeIvs.length > 0) {
              const nearestFree = freeIvs.reduce((best, iv) =>
                Math.abs((iv.botY + iv.topY) / 2 - snappedElevY) <
                Math.abs((best.botY + best.topY) / 2 - snappedElevY)
                  ? iv
                  : best
              );
              lastAccessoryDropTarget2DRef.current = {
                bayIndex: targetBayIdx,
                elevationY: Math.round((nearestFree.botY + nearestFree.topY) / 2),
                offsetX: localBayX,
                accessory: accObj,
              };
              setPlanRowSnapBanner(
                `⚠️ Bu aralıkta ${hoveredIv.conflictReason}! Boş raf aralığına (${nearestFree.label}) hizalandı • X: ${localBayX}mm`
              );
            } else {
              lastAccessoryDropTarget2DRef.current = {
                bayIndex: targetBayIdx,
                elevationY: snappedElevY,
                offsetX: localBayX,
                accessory: accObj,
              };
              setPlanRowSnapBanner(
                `⛔ Bölme ${targetBayIdx + 1} içinde ${hoveredIv.conflictReason} ve boş raf aralığı yok! Önce raf ekleyin.`
              );
            }
            return;
          }
        }

        lastAccessoryDropTarget2DRef.current = {
          bayIndex: targetBayIdx,
          elevationY: snappedElevY,
          offsetX: localBayX,
          accessory: accObj,
        };

        setPlanRowSnapBanner(`📐 ${accObj.title || "Aksesuar"} • Bölme ${targetBayIdx + 1} • Y: ${snappedElevY} mm`);
        return;
      }

      const hasMime = e.dataTransfer.types.includes("application/x-birim-template-id");
      const activeTplId = getActiveDraggedTemplateId();
      if (!hasMime && !activeTplId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      const svgEl = e.currentTarget.querySelector("svg");
      const rect = (svgEl || e.currentTarget).getBoundingClientRect();
      const relX = Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)));
      const svgX = vb.x + relX * vb.width;
      const wallLeftSvgX = -activeModOffX;
      const worldX = Math.max(0, Math.round(svgX - wallLeftSvgX));
      const tplId = activeTplId || "v4_kb_01_single_door";
      const preview = computeRowSnapPreview(project, tplId, worldX);
      if (preview) {
        setDragGhostPreview(preview);
        setPlanRowSnapBanner(
          `🧲 CEPHE SİLUET SNAP: ${preview.previewModule.name} (${preview.previewModule.dimensions.width}×${preview.previewModule.dimensions.height}mm) → ${preview.snapLabel}`
        );
      }
    };

    const handleElevDrop = (e: React.DragEvent<HTMLDivElement>) => {
      if (mode !== "elevation") return;
      const activeAcc = typeof window !== "undefined" ? (window as any).__birimActiveDraggedAccessory : null;
      const hasAccessoryMime = e.dataTransfer.types.includes("application/x-birim-accessory-id");

      if (hasAccessoryMime || activeAcc || lastAccessoryDropTarget2DRef.current) {
        e.preventDefault();
        const dropInfo = lastAccessoryDropTarget2DRef.current;
        const acc = dropInfo?.accessory || activeAcc || { id: "lib_shelf", title: "Raf" };
        const bayIdx = dropInfo ? dropInfo.bayIndex : 0;
        const elevY = dropInfo ? dropInfo.elevationY : 400;

        const modBefore = activeModule || project.modules[0];
        const bayBefore = modBefore?.bays[bayIdx];
        const isSubDivDrop =
          acc.id === "lib_sub_divider" ||
          acc.id === "sub_divider" ||
          acc.visual === "sub_divider";
        if (isSubDivDrop && modBefore && bayBefore) {
          const ivs = getBayShelfIntervalsForSubDivider(
            bayBefore,
            calculateNetInnerHeight(modBefore),
            modBefore.carcass.panelThickness || 18
          );
          const freeIvs = ivs.filter((iv) => !iv.hasConflict);
          if (freeIvs.length === 0) {
            setPlanRowSnapBanner(
              `⛔ Bölme ${bayIdx + 1} içinde Askılık/Çekmece var ve boş raf aralığı yok! Önce raf ekleyin veya askılığı kaldırın.`
            );
            setTimeout(() => setPlanRowSnapBanner(null), 4200);
            lastAccessoryDropTarget2DRef.current = null;
            if (typeof window !== "undefined") {
              (window as any).__birimActiveDraggedAccessory = null;
            }
            return;
          }
        }
        addInteriorItemAtElevation(bayIdx, acc.id, elevY, { offsetX: dropInfo?.offsetX });
        setPlanRowSnapBanner(`✓ ${acc.title} yerleştirildi: Bölme ${bayIdx + 1}`);
        setTimeout(() => setPlanRowSnapBanner(null), 3500);

        lastAccessoryDropTarget2DRef.current = null;
        if (typeof window !== "undefined") {
          (window as any).__birimActiveDraggedAccessory = null;
        }
        return;
      }

      const tplId =
        e.dataTransfer.getData("application/x-birim-template-id") ||
        getActiveDraggedTemplateId();
      setDragGhostPreview(null);
      setActiveDraggedTemplateId(null);
      if (!tplId) return;
      e.preventDefault();
      const svgEl = e.currentTarget.querySelector("svg");
      const rect = (svgEl || e.currentTarget).getBoundingClientRect();
      const relX = Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)));
      const svgX = vb.x + relX * vb.width;
      const wallLeftSvgX = -activeModOffX;
      const worldX = Math.max(0, Math.round(svgX - wallLeftSvgX));
      const res = dropV4TemplateWithSnap(tplId, worldX);
      if (res) {
        setPlanRowSnapBanner(`✓ ${res.placedName} → ${res.snapLabel}`);
        setTimeout(() => setPlanRowSnapBanner(null), 3200);
      } else {
        setPlanRowSnapBanner(null);
      }
    };

    return (
      <div
        data-testid={`v3-cad-${mode}`}
        onWheel={handleWheelZoom}
        onDragOver={handleElevDragOver}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setDragGhostPreview(null);
            setPlanRowSnapBanner(null);
          }
        }}
        onDrop={handleElevDrop}
        className="relative w-full h-full bg-[#E2DED5] overflow-hidden select-none flex flex-col"
      >
        {planRowSnapBanner && (
          <div
            data-testid="elev-row-snap-banner"
            className="absolute top-14 left-1/2 -translate-x-1/2 z-30 pointer-events-none px-4 py-1.5 rounded-xl bg-emerald-800 text-white border-2 border-emerald-300 shadow-lg font-mono text-xs font-extrabold"
          >
            {planRowSnapBanner}
          </div>
        )}
        {/* Top Header Bar (Non-overlapping with SVG drawing!) */}
        <div className="h-11 px-4 bg-[#D8D3C8] border-b border-stone-300 flex flex-wrap items-center justify-between gap-2 shrink-0 z-10">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-[#EEF3F8] text-[#111827] text-xs font-bold">
              {mode === "elevation"
                ? "2D Ön Cephe & İç Düzen Editörü"
                : mode === "plan"
                ? "2D Üst Plan Kesiti"
                : sectionDirection2D === "Z"
                ? `2D A-A Enine Yan Kesit (X: ${sectionCutCoordMm} mm)`
                : `2D B-B Boyuna Cephe Kesit (Z: ${sectionCutCoordMm} mm)`}
            </span>
            {mode === "elevation" && (
              <span className="text-xs font-semibold text-stone-800 hidden lg:inline">
                Raf, çekmece, askı ve ara dikmeleri fareyle sürükleyerek veya sağ panelden ölçüyle taşıyabilirsiniz
              </span>
            )}
            {mode === "section" && (
              <div className="flex items-center gap-2 flex-wrap bg-white/80 backdrop-blur-md px-2.5 py-1 rounded-xl border border-stone-300 shadow-2xs text-xs">
                <div className="inline-flex items-center rounded-lg bg-slate-100 p-0.5">
                  <button
                    type="button"
                    data-testid="section-dir-z-btn"
                    onClick={() => setSectionDirection2D("Z")}
                    className={`px-2 py-0.5 rounded-md font-bold text-[11px] transition cursor-pointer ${
                      sectionDirection2D === "Z"
                        ? "bg-blue-600 text-white shadow-2xs"
                        : "text-slate-700 hover:bg-white"
                    }`}
                    title="A-A Enine Yan Kesit (Derinlik × Yükseklik)"
                  >
                    ↔ A-A Yan Kesit (X)
                  </button>
                  <button
                    type="button"
                    data-testid="section-dir-x-btn"
                    onClick={() => setSectionDirection2D("X")}
                    className={`px-2 py-0.5 rounded-md font-bold text-[11px] transition cursor-pointer ${
                      sectionDirection2D === "X"
                        ? "bg-blue-600 text-white shadow-2xs"
                        : "text-slate-700 hover:bg-white"
                    }`}
                    title="B-B Boyuna Cephe Kesit (Genişlik × Yükseklik)"
                  >
                    ↕ B-B Boyuna Kesit (Z)
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-600">
                    Kesit Noktası ({sectionDirection2D === "Z" ? "X" : "Z"}):
                  </span>
                  <input
                    type="range"
                    data-testid="section-cut-slider"
                    min={0.05}
                    max={0.95}
                    step={0.02}
                    value={sectionCutRatio2D}
                    onChange={(e) => setSectionCutRatio2D(Number(e.target.value))}
                    className="w-28 accent-blue-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                  />
                  <span className="font-mono font-extrabold text-blue-700 text-[11px] min-w-[54px]">
                    {sectionCutCoordMm} mm
                  </span>
                </div>
                {sectionDirection2D === "Z" && activeModule.bays.length > 1 && (
                  <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
                    {activeModule.bays.map((b, bIdx) => {
                      const ratio = (bIdx + 0.5) / activeModule.bays.length;
                      return (
                        <button
                          key={b.index}
                          type="button"
                          onClick={() => setSectionCutRatio2D(Number(ratio.toFixed(2)))}
                          className="px-1.5 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold text-[10px] border border-blue-200 cursor-pointer"
                          title={`Bölme ${bIdx + 1} ortasından kesit al`}
                        >
                          B{bIdx + 1}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {mode === "elevation" && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {selectedPlanObject?.kind === "obstacle" && (() => {
                const selObs = spaceObstacles.find((o) => o.id === selectedPlanObject.id);
                if (!selObs) return null;
                return (
                  <div
                    data-testid="elev-selected-obstacle-controls"
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-900 text-white text-[11px] font-semibold"
                  >
                    <span>🎯 {selObs.name}:</span>
                    <button
                      type="button"
                      onClick={() =>
                        updateSpaceObstacle(selObs.id, {
                          rotationY: ((selObs.rotationY || 0) + 90) % 360,
                        })
                      }
                      className="px-1.5 py-0.5 rounded bg-amber-600 hover:bg-amber-500 text-white font-bold cursor-pointer"
                      title="90° Döndür"
                    >
                      🔄 {selObs.rotationY || 0}°
                    </button>
                    <label className="flex items-center gap-0.5">
                      <span>En(W):</span>
                      <input
                        type="number"
                        step={50}
                        value={selObs.dimensions.width}
                        onChange={(e) =>
                          updateSpaceObstacle(selObs.id, {
                            dimensions: {
                              ...selObs.dimensions,
                              width: Math.max(100, Number(e.target.value) || 300),
                            },
                          })
                        }
                        className="w-14 px-1 py-0.5 rounded bg-white text-stone-900 font-mono text-[11px]"
                      />
                    </label>
                    <label className="flex items-center gap-0.5">
                      <span>Boy(H):</span>
                      <input
                        type="number"
                        step={50}
                        value={selObs.dimensions.height}
                        onChange={(e) =>
                          updateSpaceObstacle(selObs.id, {
                            dimensions: {
                              ...selObs.dimensions,
                              height: Math.max(100, Number(e.target.value) || 300),
                            },
                          })
                        }
                        className="w-14 px-1 py-0.5 rounded bg-white text-stone-900 font-mono text-[11px]"
                      />
                    </label>
                    <label className="flex items-center gap-0.5">
                      <span>Kot(Y):</span>
                      <input
                        type="number"
                        step={50}
                        value={selObs.position.y}
                        onChange={(e) =>
                          updateSpaceObstacle(selObs.id, {
                            position: {
                              ...selObs.position,
                              y: Math.max(0, Number(e.target.value) || 0),
                            },
                          })
                        }
                        className="w-14 px-1 py-0.5 rounded bg-white text-stone-900 font-mono text-[11px]"
                      />
                    </label>
                    <label className="flex items-center gap-0.5">
                      <span>X:</span>
                      <input
                        type="number"
                        step={50}
                        value={selObs.position.x}
                        onChange={(e) =>
                          updateObstaclePosition(selObs.id, Number(e.target.value) || 0)
                        }
                        className="w-14 px-1 py-0.5 rounded bg-white text-stone-900 font-mono text-[11px]"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        removeSpaceObstacle(selObs.id);
                        setSelectedPlanObject(null);
                      }}
                      className="px-1.5 py-0.5 rounded bg-red-600 hover:bg-red-700 text-white font-bold cursor-pointer"
                    >
                      🗑 Sil
                    </button>
                  </div>
                );
              })()}
              {project.modules.length > 1 && (
                <div className="flex items-center gap-1 bg-white px-2 py-0.5 rounded-lg border border-stone-300 text-[11px]">
                  <span className="font-bold text-stone-700">Sıra:</span>
                  <button
                    type="button"
                    data-testid="elev-swap-mod-left-btn"
                    onClick={() => {
                      const res = swapModuleWithNeighbor(activeModuleIndex, "left");
                      if (res) {
                        setPlanRowSnapBanner(`🔄 Solundaki "${res.swappedWithName}" ile yer değiştirdi`);
                        setTimeout(() => setPlanRowSnapBanner(null), 2500);
                      }
                    }}
                    className="px-1.5 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold cursor-pointer"
                    title="Seçili modülü solundaki modülle yer değiştir"
                  >
                    ⇄ Solla Değiştir
                  </button>
                  <button
                    type="button"
                    data-testid="elev-swap-mod-right-btn"
                    onClick={() => {
                      const res = swapModuleWithNeighbor(activeModuleIndex, "right");
                      if (res) {
                        setPlanRowSnapBanner(`🔄 Sağındaki "${res.swappedWithName}" ile yer değiştirdi`);
                        setTimeout(() => setPlanRowSnapBanner(null), 2500);
                      }
                    }}
                    className="px-1.5 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold cursor-pointer"
                    title="Seçili modülü sağındaki modülle yer değiştir"
                  >
                    ⇄ Sağla Değiştir
                  </button>
                </div>
              )}

              {hasSceneModules && (
                <div className="flex items-center gap-1.5 bg-white px-2 py-0.5 rounded-lg border border-stone-300 text-[11px]">
                  <span className="font-bold text-stone-700">Kot (Y):</span>
                  <input
                    type="number"
                    step={50}
                    value={activeModule.position.y}
                    onChange={(e) => {
                      const newY = Math.max(0, Number(e.target.value) || 0);
                      setModulePosition(activeModuleIndex, activeModule.position.x, activeModule.position.z, 1, newY);
                    }}
                    className="w-14 px-1 py-0.5 rounded bg-slate-50 border border-slate-300 text-stone-900 font-mono text-[11px] font-bold"
                  />
                  <span className="text-[10px] text-stone-500">mm</span>
                  {activeModule.position.y > 0 && (
                    <button
                      type="button"
                      onClick={() => setModulePosition(activeModuleIndex, activeModule.position.x, activeModule.position.z, 1, 0)}
                      className="px-1.5 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[10px] font-bold cursor-pointer"
                      title="Zemine İndir (Kot Y = 0)"
                    >
                      ⬇ Zemine İndir
                    </button>
                  )}
                </div>
              )}

              <button
                type="button"
                data-testid="cad-elevation-toggle-room"
                onClick={() => setShowRoomContextInElev((v) => !v)}
                className={`px-3 py-1 rounded-lg border text-xs font-bold transition cursor-pointer ${
                  showRoomContextInElev
                    ? "bg-[#2563EB] text-white border-[#1D4ED8] shadow-2xs"
                    : "bg-white hover:bg-stone-100 border-stone-300 text-stone-800"
                }`}
                title="Duvar sınırını, pencereyi, kapıyı, kolonu, su/gider tesisatını ve tüm modülleri cephe görünüşünde göster/gizle"
              >
                {showRoomContextInElev
                  ? "🏠 Mekân Cephesi: Açık (Tesisat/Pencere/Kapı)"
                  : "📦 Sadece Seçili Modül"}
              </button>
              <button
                type="button"
                data-testid="cad-elevation-toggle-doors"
              onClick={() => setShowDoorsIn2D((v) => !v)}
              className={`px-3 py-1 rounded-lg border text-xs font-bold transition cursor-pointer ${
                showDoorsIn2D
                  ? "bg-amber-600 text-white border-amber-700 shadow-2xs"
                  : "bg-white hover:bg-stone-100 border-stone-300 text-stone-800"
              }`}
            >
              {showDoorsIn2D ? "Kapakları Gizle (İç Düzen)" : "Kapak Çizgisini Göster"}
              </button>
            </div>
          )}
        </div>

        {/* Bottom-Right Zoom Pill */}
        <div className="absolute bottom-4 right-4 z-10 flex items-center gap-1.5 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-stone-300 shadow-xs text-xs text-stone-800">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.15).toFixed(2)))}
            className="px-2 py-0.5 rounded bg-stone-100 hover:bg-stone-200 font-mono font-bold cursor-pointer"
          >
            −
          </button>
          <span className="font-mono text-xs font-bold min-w-[48px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(3.5, +(z + 0.15).toFixed(2)))}
            className="px-2 py-0.5 rounded bg-stone-100 hover:bg-stone-200 font-mono font-bold cursor-pointer"
          >
            +
          </button>
          <button
            type="button"
            data-testid="elev-pan-mode-toggle"
            onClick={() => setElevPanMode((p) => !p)}
            className={`ml-1 px-2 py-0.5 rounded text-xs font-bold border transition cursor-pointer ${
              elevPanMode
                ? "bg-blue-600 text-white border-blue-700 shadow-2xs"
                : "bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-300"
            }`}
            title="Çalışma alanını fareyle sürükleyerek kaydır (Pan Modu)"
          >
            🖐️ Kaydır
          </button>
          <button
            type="button"
            onClick={() => { setZoom(1); setPanPx({ x: 0, y: 0 }); setElevPanMode(false); }}
            className="ml-1 text-xs font-semibold text-stone-600 hover:text-stone-900 underline cursor-pointer"
          >
            Sıfırla
          </button>
        </div>

        <svg
          viewBox={`${vb.x} ${vb.y} ${vb.width} ${vb.height}`}
          className={`w-full h-full ${panning2D ? "cursor-grabbing" : "cursor-grab"}`}
          onContextMenu={(e) => e.preventDefault()}
          onMouseDownCapture={(e) => {
            if (elevPanMode && e.button === 0) {
              e.preventDefault();
              e.stopPropagation();
              setPanning2D({
                startClientX: e.clientX,
                startClientY: e.clientY,
                startPanX: panPxRef.current.x,
                startPanY: panPxRef.current.y,
              });
            }
          }}
          onMouseDown={(e) => {
            const isBgClick =
              e.target === e.currentTarget ||
              (e.target as Element).getAttribute?.("data-elev-bg") === "true";
            if (
              elevPanMode ||
              e.button === 2 ||
              e.button === 1 ||
              (e.button === 0 && e.altKey) ||
              (e.button === 0 && isBgClick)
            ) {
              e.preventDefault();
              setPanning2D({
                startClientX: e.clientX,
                startClientY: e.clientY,
                startPanX: panPxRef.current.x,
                startPanY: panPxRef.current.y,
              });
            }
          }}
          onMouseMove={(e) => {
            if (panning2D) {
              const nx = panning2D.startPanX + (e.clientX - panning2D.startClientX);
              const ny = panning2D.startPanY + (e.clientY - panning2D.startClientY);
              panPxRef.current = { x: nx, y: ny };
              e.currentTarget.style.transform = `translate(${nx}px, ${ny}px) scale(${zoom})`;
              return;
            }
            handleElevationPointerMove(e);
          }}
          onMouseUp={() => {
            if (panning2D) {
              setPanPx(panPxRef.current);
              setPanning2D(null);
            }
            handleElevationPointerUp();
          }}
          onMouseLeave={() => {
            if (panning2D) {
              setPanPx(panPxRef.current);
              setPanning2D(null);
            }
            handleElevationPointerUp();
          }}
          style={{
            transform: `translate(${panPx.x}px, ${panPx.y}px) scale(${zoom})`,
            transformOrigin: "center center",
          }}
        >
          <defs>
            <pattern id="v3_elev_grid" width="100" height="100" patternUnits="userSpaceOnUse">
              <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#CCC7BC" strokeWidth="1.4" />
            </pattern>
          </defs>

          <rect
            data-elev-bg="true"
            x={vb.x - 25000}
            y={vb.y - 25000}
            width={vb.width + 50000}
            height={vb.height + 50000}
            fill="url(#v3_elev_grid)"
          />

          {/* ROOM WALL ELEVATION BACKDROP, OTHER MODULES & ARCHITECTURAL OBSTACLES (WINDOW, DOOR, PLUMBING, COLUMN, BEAM) */}
          {mode === "elevation" && showRoomContextInElev && (() => {
            const floorSvgY = breakdown.overall.height + activeModOffY;
            const ceilingSvgY = floorSvgY - ceilingH;
            const wallLeftSvgX = -activeModOffX;
            return (
              <g data-testid="cad-elevation-room-context">
                {/* Wall Surface (marked data-elev-bg so dragging anywhere on the wall pans the 2D Elevation canvas!) */}
                <rect
                  data-elev-bg="true"
                  x={wallLeftSvgX}
                  y={ceilingSvgY}
                  width={mainWallLen}
                  height={ceilingH}
                  fill="#E5E0D8"
                  stroke="#64748B"
                  strokeWidth="4"
                  strokeDasharray="16 8"
                />
                {/* Floor Line */}
                <line
                  x1={wallLeftSvgX - 180}
                  y1={floorSvgY}
                  x2={wallLeftSvgX + maxWallSpanX + 180}
                  y2={floorSvgY}
                  stroke="#292524"
                  strokeWidth="8"
                />
                <text
                  x={wallLeftSvgX + 20}
                  y={ceilingSvgY - 22}
                  fill="#44403C"
                  fontSize="28"
                  fontWeight="800"
                  fontFamily="monospace"
                >
                  {`🏠 DUVAR CEPHESİ: ${mainWallLen}mm × Tavan ${ceilingH}mm (Zemin Y: 0mm)`}
                </text>

                {/* Architectural Obstacles in Elevation (Window, Plumbing, Door, Column, Beam) */}
                {spaceObstacles.map((obs) => {
                  const ox = wallLeftSvgX + obs.position.x;
                  const ow = obs.dimensions.width;
                  const oh = obs.dimensions.height;
                  const oyBottom = obs.position.y;
                  const oySvg = floorSvgY - (oyBottom + oh);

                  const isSelElevObs =
                    selectedPlanObject?.kind === "obstacle" && selectedPlanObject.id === obs.id;
                  const onElevObsMouseDown = (e: React.MouseEvent) => {
                    e.stopPropagation();
                    setSelectedPlanObject({ kind: "obstacle", id: obs.id });
                    const svgEl = (e.currentTarget as Element).closest("svg") as SVGSVGElement | null;
                    const scale = svgEl ? getElevScaleMmPerPx(svgEl) : { x: 4, y: 4 };
                    beginHistoryTransaction();
                    setElevDraggingObs({
                      id: obs.id,
                      startClientX: e.clientX,
                      startClientY: e.clientY,
                      startX: obs.position.x,
                      startY: obs.position.y,
                      mmPerPxX: scale.x,
                      mmPerPxY: scale.y,
                    });
                  };

                  if (obs.type === "window") {
                    const frameW = 48;
                    const sashW = Math.max(40, ow / 2 - frameW - 18);
                    const sashH = Math.max(60, oh - frameW * 2);
                    return (
                      <g
                        key={obs.id}
                        data-testid={`elev-obs-${obs.id}`}
                        onMouseDown={onElevObsMouseDown}
                        className="cursor-move"
                      >
                        {/* 4-Sided Dark Anthracite Outer Window Casing Frame (Doğrama Kasa Çerçevesi) */}
                        <rect
                          x={ox - 12}
                          y={oySvg - 12}
                          width={ow + 24}
                          height={oh + 24}
                          rx={4}
                          fill="#27272A"
                          stroke="#18181B"
                          strokeWidth="6"
                        />
                        {/* Inner White Sash Frame */}
                        <rect
                          x={ox + frameW * 0.6}
                          y={oySvg + frameW * 0.6}
                          width={Math.max(60, ow - frameW * 1.2)}
                          height={Math.max(60, oh - frameW * 1.2)}
                          fill="#F8FAFC"
                          stroke="#475569"
                          strokeWidth="4"
                        />
                        {/* Left & Right Double-Glazed Glass Panes */}
                        <rect
                          x={ox + frameW}
                          y={oySvg + frameW}
                          width={sashW}
                          height={sashH}
                          fill="#BAE6FD"
                          fillOpacity={0.82}
                          stroke="#0284C7"
                          strokeWidth="4"
                        />
                        <rect
                          x={ox + ow / 2 + 18}
                          y={oySvg + frameW}
                          width={sashW}
                          height={sashH}
                          fill="#BAE6FD"
                          fillOpacity={0.82}
                          stroke="#0284C7"
                          strokeWidth="4"
                        />
                        {/* Opening Direction Dashed V-Lines on Both Sashes */}
                        <polyline
                          points={`${ox + frameW},${oySvg + frameW} ${ox + frameW + sashW},${oySvg + oh / 2} ${ox + frameW},${oySvg + frameW + sashH}`}
                          fill="none"
                          stroke="#0369A1"
                          strokeWidth="3"
                          strokeDasharray="12 8"
                        />
                        <polyline
                          points={`${ox + ow - frameW},${oySvg + frameW} ${ox + ow / 2 + 18},${oySvg + oh / 2} ${ox + ow - frameW},${oySvg + frameW + sashH}`}
                          fill="none"
                          stroke="#0369A1"
                          strokeWidth="3"
                          strokeDasharray="12 8"
                        />
                        {/* Center Vertical Mullion & Metallic Window Handle (Pencere Kolu) */}
                        <rect
                          x={ox + ow / 2 - 16}
                          y={oySvg + frameW * 0.6}
                          width={32}
                          height={Math.max(60, oh - frameW * 1.2)}
                          fill="#27272A"
                        />
                        <rect
                          x={ox + ow / 2 + 4}
                          y={oySvg + oh / 2 - 28}
                          width={16}
                          height={68}
                          rx={5}
                          fill="#FBBF24"
                          stroke="#78350F"
                          strokeWidth="2.5"
                        />
                        {/* Protruding Marble Window Sill (Denizlik) */}
                        <rect
                          x={ox - 34}
                          y={oySvg + oh + 8}
                          width={ow + 68}
                          height={28}
                          rx={4}
                          fill="#D6D3D1"
                          stroke="#292524"
                          strokeWidth="4"
                        />
                        {/* Sill Height Guide & Label */}
                        <rect
                          x={ox + ow / 2 - 230}
                          y={oySvg + oh / 2 - 26}
                          width={460}
                          height={52}
                          rx={10}
                          fill="#0369A1"
                          opacity={0.92}
                        />
                        <text
                          x={ox + ow / 2}
                          y={oySvg + oh / 2 + 8}
                          textAnchor="middle"
                          fill="#FFFFFF"
                          fontSize="24"
                          fontWeight="800"
                          fontFamily="monospace"
                        >
                          {`🪟 ${obs.name} (Denizlik Y:${oyBottom}mm)`}
                        </text>
                      </g>
                    );
                  }

                  if (obs.type === "plumbing") {
                    const cx = ox + ow / 2;
                    const cy = oySvg + oh / 2;
                    return (
                      <g key={obs.id} data-testid={`elev-obs-${obs.id}`} onMouseDown={onElevObsMouseDown} className="cursor-move">
                        {/* Vertical Plumbing Axis Line from Floor to Ceiling */}
                        <line
                          x1={cx}
                          y1={ceilingSvgY}
                          x2={cx}
                          y2={floorSvgY}
                          stroke="#0284C7"
                          strokeWidth="4"
                          strokeDasharray="14 8"
                        />
                        {/* Plumbing Box */}
                        <rect
                          x={ox}
                          y={oySvg}
                          width={ow}
                          height={oh}
                          rx={16}
                          fill="#E0F2FE"
                          stroke="#0284C7"
                          strokeWidth="5"
                        />
                        {/* Hot Water (Red), Cold Water (Blue), Waste Drain (Dark) */}
                        <circle cx={cx - 45} cy={cy - 15} r={18} fill="#DC2626" stroke="#FFFFFF" strokeWidth="3" />
                        <circle cx={cx + 45} cy={cy - 15} r={18} fill="#2563EB" stroke="#FFFFFF" strokeWidth="3" />
                        <circle cx={cx} cy={cy + 35} r={26} fill="#334155" stroke="#FFFFFF" strokeWidth="4" />
                        <rect
                          x={cx - 235}
                          y={oySvg - 58}
                          width={470}
                          height={46}
                          rx={10}
                          fill="#0F172A"
                        />
                        <text
                          x={cx}
                          y={oySvg - 28}
                          textAnchor="middle"
                          fill="#38BDF8"
                          fontSize="23"
                          fontWeight="800"
                          fontFamily="monospace"
                        >
                          {`🚰 TESİSAT AKSI X:${Math.round(obs.position.x + ow / 2)}mm • Y:${oyBottom}mm`}
                        </text>
                      </g>
                    );
                  }

                  if (obs.type === "electrical" || obs.type === "ventilation") {
                    const cx = ox + ow / 2;
                    const cy = oySvg + oh / 2;
                    return (
                      <g key={obs.id} data-testid={`elev-obs-${obs.id}`} onMouseDown={onElevObsMouseDown} className="cursor-move">
                        <rect
                          x={ox}
                          y={oySvg}
                          width={ow}
                          height={oh}
                          rx={14}
                          fill="#FEF3C7"
                          stroke="#D97706"
                          strokeWidth="5"
                        />
                        <circle cx={cx - 22} cy={cy} r={10} fill="#B45309" />
                        <circle cx={cx + 22} cy={cy} r={10} fill="#B45309" />
                        <rect
                          x={cx - 210}
                          y={oySvg - 48}
                          width={420}
                          height={40}
                          rx={8}
                          fill="#78350F"
                        />
                        <text
                          x={cx}
                          y={oySvg - 22}
                          textAnchor="middle"
                          fill="#FDE68A"
                          fontSize="21"
                          fontWeight="800"
                          fontFamily="monospace"
                        >
                          {`⚡ ${obs.name} (X:${obs.position.x} • Kot Y:${oyBottom}mm)`}
                        </text>
                      </g>
                    );
                  }

                  if (obs.type === "door") {
                    const jambW = 64;
                    const isRightSwing = obs.doorSwing === "right";
                    const hingeX = isRightSwing ? ox + ow - jambW : ox + jambW;
                    const handleX = isRightSwing ? ox + jambW + 58 : ox + ow - jambW - 58;
                    const handleY = oySvg + oh - Math.min(oh - 200, 1020);
                    return (
                      <g key={obs.id} data-testid={`elev-obs-${obs.id}`} onMouseDown={onElevObsMouseDown} className="cursor-move">
                        {/* 3-Sided Dark Architrave Door Casing Frame (Kapı Kasası & Pervaz Çerçevesi) */}
                        <rect
                          x={ox - 12}
                          y={oySvg - 12}
                          width={ow + 24}
                          height={oh + 12}
                          fill="#292524"
                          stroke="#1C1917"
                          strokeWidth="5"
                        />
                        {/* Wood Door Leaf Inside Casing */}
                        <rect
                          x={ox + jambW}
                          y={oySvg + jambW}
                          width={Math.max(120, ow - jambW * 2)}
                          height={Math.max(200, oh - jambW)}
                          fill="#D97706"
                          fillOpacity={0.85}
                          stroke="#78350F"
                          strokeWidth="5"
                        />
                        {/* Decorative Upper & Lower Recessed Door Panels */}
                        <rect
                          x={ox + jambW + 65}
                          y={oySvg + jambW + 70}
                          width={Math.max(60, ow - jambW * 2 - 130)}
                          height={Math.max(80, (oh - jambW) * 0.36)}
                          fill="#B45309"
                          fillOpacity={0.55}
                          stroke="#78350F"
                          strokeWidth="3"
                        />
                        <rect
                          x={ox + jambW + 65}
                          y={oySvg + jambW + (oh - jambW) * 0.54}
                          width={Math.max(60, ow - jambW * 2 - 130)}
                          height={Math.max(80, (oh - jambW) * 0.32)}
                          fill="#B45309"
                          fillOpacity={0.55}
                          stroke="#78350F"
                          strokeWidth="3"
                        />
                        {/* Architectural Opening-Direction Dashed V-Lines (Hinge -> Handle) */}
                        <polyline
                          points={`${hingeX},${oySvg + jambW + 20} ${handleX},${handleY} ${hingeX},${oySvg + oh - 20}`}
                          fill="none"
                          stroke="#FEF08A"
                          strokeWidth="5"
                          strokeDasharray="18 10"
                        />
                        {/* 3 Hinge Barrels on Hinge Jamb */}
                        {[0.18, 0.5, 0.82].map((hr, hIdx) => (
                          <rect
                            key={hIdx}
                            x={hingeX - 8}
                            y={oySvg + jambW + (oh - jambW) * hr - 28}
                            width={16}
                            height={56}
                            rx={4}
                            fill="#FBBF24"
                            stroke="#78350F"
                            strokeWidth="2.5"
                          />
                        ))}
                        {/* Prominent Lever Door Handle & Escutcheon Plate (Kapı Kolu) */}
                        <rect
                          x={handleX - 18}
                          y={handleY - 68}
                          width={36}
                          height={136}
                          rx={8}
                          fill="#FBBF24"
                          stroke="#451A03"
                          strokeWidth="3.5"
                        />
                        <rect
                          x={isRightSwing ? handleX - 6 : handleX - 115}
                          y={handleY - 12}
                          width={120}
                          height={24}
                          rx={8}
                          fill="#FEF08A"
                          stroke="#451A03"
                          strokeWidth="3.5"
                        />
                        <rect
                          x={ox + ow / 2 - 220}
                          y={oySvg + oh * 0.46 - 26}
                          width={440}
                          height={52}
                          rx={10}
                          fill="#451A03"
                          opacity={0.92}
                        />
                        <text
                          x={ox + ow / 2}
                          y={oySvg + oh * 0.46 + 8}
                          textAnchor="middle"
                          fill="#FEF08A"
                          fontSize="22"
                          fontWeight="800"
                          fontFamily="monospace"
                        >
                          {`🚪 ${obs.name} (${isRightSwing ? "SAĞ MENTEŞE" : "SOL MENTEŞE"} • ${ow}×${oh})`}
                        </text>
                      </g>
                    );
                  }

                  // Column or Beam
                  return (
                    <g key={obs.id} data-testid={`elev-obs-${obs.id}`} onMouseDown={onElevObsMouseDown} className="cursor-move">
                      <rect
                        x={ox}
                        y={oySvg}
                        width={ow}
                        height={oh}
                        fill="#D6D3D1"
                        fillOpacity={0.85}
                        stroke="#44403C"
                        strokeWidth="5"
                        strokeDasharray={obs.type === "beam" ? "12 6" : undefined}
                      />
                      <text
                        x={ox + ow / 2}
                        y={oySvg + oh / 2}
                        textAnchor="middle"
                        fill="#1C1917"
                        fontSize="24"
                        fontWeight="800"
                        fontFamily="monospace"
                      >
                        {`🏛️ ${obs.name} (X:${obs.position.x})`}
                      </text>
                    </g>
                  );
                })}

                {/* Empty Wall Prompt when all modules are deleted */}
                {!hasSceneModules && (
                  <g data-testid="elev-empty-scene-notice" className="pointer-events-none">
                    <rect
                      x={mainWallLen / 2 - 420}
                      y={floorSvgY - ceilingH / 2 - 44}
                      width={840}
                      height={88}
                      rx={16}
                      fill="rgba(255, 255, 255, 0.92)"
                      stroke="#94A3B8"
                      strokeWidth="3"
                      strokeDasharray="10 6"
                    />
                    <text
                      x={mainWallLen / 2}
                      y={floorSvgY - ceilingH / 2 + 8}
                      textAnchor="middle"
                      fill="#334155"
                      fontSize="26"
                      fontWeight="800"
                      fontFamily="sans-serif"
                    >
                      📦 Sahnede dolap yok — Sol panelden veya '+ Modül Ekle' ile dolap ekleyebilirsiniz
                    </text>
                  </g>
                )}

                {/* Active Module Selection Banner in 2D Elevation */}
                {hasSceneModules && (
                <g data-testid="elev-active-mod-selection-halo">
                  <g
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      const svgEl = (e.currentTarget as Element).closest("svg") as SVGSVGElement | null;
                      const scale = svgEl ? getElevScaleMmPerPx(svgEl) : { x: 4, y: 4 };
                      beginHistoryTransaction();
                      setElevDraggingMod({
                        modIdx: activeModuleIndex,
                        startClientX: e.clientX,
                        startClientY: e.clientY,
                        startModX: activeModule.position.x,
                        startModY: activeModule.position.y,
                        mmPerPxX: scale.x,
                        mmPerPxY: scale.y,
                      });
                    }}
                    className="cursor-grab active:cursor-grabbing"
                  >
                    <rect
                      x={breakdown.overall.width / 2 - 240}
                      y={-125}
                      width={480}
                      height={46}
                      rx={12}
                      fill="#B45309"
                      stroke="#FFFFFF"
                      strokeWidth="3"
                    />
                    <text
                      x={breakdown.overall.width / 2}
                      y={-95}
                      textAnchor="middle"
                      fill="#FFFFFF"
                      fontSize="22"
                      fontWeight="900"
                      fontFamily="monospace"
                    >
                      {`★ SEÇİLİ #${activeModuleIndex + 1}: ${activeModule.name} (✋ Taşı: X & Kot Y)`}
                    </text>
                  </g>
                </g>
                )}

                {/* Neighboring Modules in Room Wall Elevation (clickable & horizontally draggable + CAD dimensions!) */}
                {project.modules.map((m, mIdx) => {
                  if (mIdx === activeModuleIndex) return null;
                  const mx = wallLeftSvgX + m.position.x;
                  const my = floorSvgY - (m.position.y + m.dimensions.height);
                  const mw = m.dimensions.width;
                  const mh = m.dimensions.height;
                  const dimY = my - 36;
                  return (
                    <g
                      key={m.id}
                      data-testid={`elev-neighbor-mod-${mIdx}`}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setActiveModuleIndex(mIdx);
                        const svgEl = (e.currentTarget as Element).closest("svg") as SVGSVGElement | null;
                        const scale = svgEl ? getElevScaleMmPerPx(svgEl) : { x: 4, y: 4 };
                        beginHistoryTransaction();
                        setElevDraggingMod({
                          modIdx: mIdx,
                          startClientX: e.clientX,
                          startClientY: e.clientY,
                          startModX: m.position.x,
                          startModY: m.position.y,
                          mmPerPxX: scale.x,
                          mmPerPxY: scale.y,
                        });
                      }}
                      className="cursor-grab active:cursor-grabbing opacity-90 hover:opacity-100 transition-opacity"
                    >
                      <rect
                        x={mx}
                        y={my}
                        width={mw}
                        height={mh}
                        fill="#E7E5E4"
                        fillOpacity={0.82}
                        stroke="#44403C"
                        strokeWidth="4"
                      />
                      {/* Top Width Dimension Line for Neighbor Module */}
                      <line x1={mx} y1={dimY - 14} x2={mx} y2={dimY + 14} stroke="#44403C" strokeWidth="3" />
                      <line x1={mx + mw} y1={dimY - 14} x2={mx + mw} y2={dimY + 14} stroke="#44403C" strokeWidth="3" />
                      <line x1={mx} y1={dimY} x2={mx + mw} y2={dimY} stroke="#44403C" strokeWidth="3" />
                      <rect
                        x={mx + mw / 2 - 90}
                        y={dimY - 22}
                        width={180}
                        height={42}
                        rx={8}
                        fill="#FFFFFF"
                        stroke="#44403C"
                        strokeWidth="2.5"
                      />
                      <text
                        x={mx + mw / 2}
                        y={dimY + 7}
                        textAnchor="middle"
                        fill="#1C1917"
                        fontSize="24"
                        fontWeight="800"
                        fontFamily="monospace"
                      >
                        {`W: ${mw}mm`}
                      </text>
                      <text
                        x={mx + mw / 2}
                        y={my + mh / 2 - 10}
                        textAnchor="middle"
                        fill="#1C1917"
                        fontSize="26"
                        fontWeight="800"
                        fontFamily="monospace"
                      >
                        {`${mIdx + 1}. ${m.name}`}
                      </text>
                      <text
                        x={mx + mw / 2}
                        y={my + mh / 2 + 26}
                        textAnchor="middle"
                        fill="#7C2D12"
                        fontSize="23"
                        fontWeight="800"
                        fontFamily="monospace"
                      >
                        {`W:${mw} × H:${mh}mm (X:${m.position.x})`}
                      </text>
                    </g>
                  );
                })}

                {/* ON-CANVAS 2D ELEVATION COLLISION CALLOUTS (Window Intersection, Plumbing Mismatch, Door Swing) */}
                {liveSpatialAlerts.length > 0 && (
                  <g data-testid="elev-spatial-collision-overlays" className="pointer-events-none">
                    {liveSpatialAlerts.map((al) => {
                      const isErr = al.severity === "error";
                      const cx = wallLeftSvgX + al.x;
                      const cy = floorSvgY - al.y;
                      const badgeW = Math.max(400, al.title.length * 19 + 48);
                      return (
                        <g key={`elev_al_${al.id}`}>
                          <rect
                            x={cx - al.w / 2}
                            y={cy - al.h / 2}
                            width={al.w}
                            height={al.h}
                            rx={10}
                            fill={isErr ? "rgba(220, 38, 38, 0.22)" : "rgba(217, 119, 6, 0.22)"}
                            stroke={isErr ? "#DC2626" : "#D97706"}
                            strokeWidth="6"
                            strokeDasharray="14 6"
                          />
                          <rect
                            x={cx - badgeW / 2}
                            y={cy - 28}
                            width={badgeW}
                            height={52}
                            rx={12}
                            fill={isErr ? "#991B1B" : "#92400E"}
                            stroke="#FFFFFF"
                            strokeWidth="3"
                          />
                          <text
                            x={cx}
                            y={cy + 7}
                            textAnchor="middle"
                            fill="#FFFFFF"
                            fontSize="23"
                            fontWeight="900"
                            fontFamily="monospace"
                          >
                            {`⚠️ ${al.title}`}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                )}

                {/* Live Catalog Drag-and-Drop 2D Elevation Ghost Cabinet Silhouette + Magnetic Snap Lines */}
                {dragGhostPreview && (
                  <g data-testid="elev-catalog-drag-ghost-silhouette" className="pointer-events-none">
                    {dragGhostPreview.snapSlots.map((slot, sIdx) => {
                      const sx = wallLeftSvgX + slot.x;
                      return (
                        <g key={`elev_slot_${sIdx}_${slot.x}`}>
                          <line
                            x1={sx}
                            y1={ceilingSvgY - 60}
                            x2={sx}
                            y2={floorSvgY + 60}
                            stroke={slot.isActive ? "#059669" : "#D97706"}
                            strokeWidth={slot.isActive ? "7" : "4"}
                            strokeDasharray="16 8"
                          />
                          <rect
                            x={sx - 115}
                            y={ceilingSvgY - 108}
                            width={230}
                            height={44}
                            rx={10}
                            fill={slot.isActive ? "#059669" : "#B45309"}
                          />
                          <text
                            x={sx}
                            y={ceilingSvgY - 78}
                            textAnchor="middle"
                            fill="#FFFFFF"
                            fontSize="22"
                            fontWeight="800"
                            fontFamily="monospace"
                          >
                            {`🧲 SNAP X:${slot.x}mm`}
                          </text>
                        </g>
                      );
                    })}
                    {(() => {
                      const gm = dragGhostPreview.previewModule;
                      const gx = wallLeftSvgX + dragGhostPreview.snappedX;
                      const gw = gm.dimensions.width;
                      const gh = gm.dimensions.height;
                      const gy = floorSvgY - (dragGhostPreview.snappedY + gh);
                      const bayCnt = Math.max(1, gm.bays.length);
                      const strokeCol = dragGhostPreview.isSnappedToSlot ? "#047857" : "#0369A1";
                      const fillCol = dragGhostPreview.isSnappedToSlot
                        ? "rgba(16, 185, 129, 0.26)"
                        : "rgba(14, 165, 233, 0.22)";
                      return (
                        <g>
                          <rect
                            x={gx}
                            y={gy}
                            width={gw}
                            height={gh}
                            rx={6}
                            fill={fillCol}
                            stroke={strokeCol}
                            strokeWidth="7"
                          />
                          {Array.from({ length: bayCnt }).map((_, bIdx) => {
                            const bw = gw / bayCnt;
                            const bx = gx + bIdx * bw;
                            const bayObj = gm.bays[bIdx];
                            const sCnt = bayObj?.shelves.length || 2;
                            const dCnt = bayObj?.drawers.length || 0;
                            return (
                              <g key={`elev_ghost_bay_${bIdx}`}>
                                {bIdx > 0 && (
                                  <line
                                    x1={bx}
                                    y1={gy}
                                    x2={bx}
                                    y2={gy + gh}
                                    stroke={strokeCol}
                                    strokeWidth="4"
                                  />
                                )}
                                {Array.from({ length: sCnt }).map((__, sIdx) => {
                                  const sy = gy + ((sIdx + 1) * gh) / (sCnt + 1);
                                  return (
                                    <line
                                      key={`gs_${sIdx}`}
                                      x1={bx + 12}
                                      y1={sy}
                                      x2={bx + bw - 12}
                                      y2={sy}
                                      stroke={strokeCol}
                                      strokeWidth="4"
                                      strokeDasharray="12 6"
                                    />
                                  );
                                })}
                                {Array.from({ length: dCnt }).map((__, dIdx) => {
                                  const dh = Math.min(220, (gh * 0.45) / Math.max(1, dCnt));
                                  const dy = gy + gh - (dIdx + 1) * dh;
                                  return (
                                    <rect
                                      key={`gd_${dIdx}`}
                                      x={bx + 10}
                                      y={dy + 4}
                                      width={bw - 20}
                                      height={dh - 8}
                                      fill="rgba(16, 185, 129, 0.18)"
                                      stroke={strokeCol}
                                      strokeWidth="3.5"
                                    />
                                  );
                                })}
                              </g>
                            );
                          })}
                          <rect
                            x={gx + gw / 2 - 230}
                            y={gy + gh / 2 - 30}
                            width={460}
                            height={60}
                            rx={12}
                            fill="#064E3B"
                            stroke="#10B981"
                            strokeWidth="3"
                          />
                          <text
                            x={gx + gw / 2}
                            y={gy + gh / 2 + 10}
                            textAnchor="middle"
                            fill="#ECFDF5"
                            fontSize="26"
                            fontWeight="800"
                            fontFamily="monospace"
                          >
                            {`SİLUET: ${gm.name} (${gw}×${gh})`}
                          </text>
                        </g>
                      );
                    })()}
                  </g>
                )}

              </g>
            );
          })()}

          {/* Render 2D Elements (Carcass, Dividers, Shelves, Drawers) */}
          {visibleElements.map((el) => {
            const isSelected = el.isSelected;
            const isHinge = el.role === "door_hinge";
            const isSpecialFitting = el.role === "special_fitting";
            const isDoor = el.role.startsWith("door") && !isHinge;
            const isDrawer = el.role.startsWith("drawer");
            const isShelf = el.role === "shelf";
            const isDivider = el.role === "carcass_divider";
            const isSubDivider = el.role === "carcass_sub_divider";
            const isDrawerHandle = el.role === "drawer_handle";
            const dragMeta = mode === "elevation" ? findInteriorDragTarget(el.id) : null;
            const isActiveDrag = interiorDrag?.targetId === dragMeta?.targetId && Boolean(dragMeta);

            let fill = "#FFFFFF";
            let stroke = "#1C1917";
            if (isDoor) {
              fill = "#F5F5F4";
              stroke = "#57534E";
            } else if (isDrawerHandle) {
              fill = "#44403C";
              stroke = "#1C1917";
            } else if (isDrawer) {
              fill = "#FEF3C7";
              stroke = "#9A3412";
            } else if (isShelf) {
              fill = "#FDE68A";
              stroke = "#B45309";
            } else if (isDivider) {
              fill = "#E7E5E4";
              stroke = "#1C1917";
            } else if (isSubDivider) {
              fill = "#FDBA74";
              stroke = "#9A3412";
            } else if (isHinge) {
              fill = "#0284C7";
              stroke = "#0F172A";
            } else if (isSpecialFitting) {
              fill = "#A7F3D0";
              stroke = "#047857";
            }
            if (isSelected || isActiveDrag) {
              fill = "#FCD34D";
              stroke = "#9A3412";
            }

            // Compute elevation badge text for shelves and drawers
            const elevMm = dragMeta && (dragMeta.kind === "shelf" || dragMeta.kind === "drawer")
              ? dragMeta.startVal
              : null;

            return (
              <g
                key={el.id}
                data-testid={`cad-el-${el.id}`}
                onMouseDown={(e) => {
                  setSelectedComponentId(el.id);
                  if (dragMeta && !elevPanMode && e.button === 0 && !e.altKey) {
                    e.stopPropagation();
                    beginHistoryTransaction();
                    setActiveBayIndex(dragMeta.bayIdx);
                    setInteriorDrag({
                      kind: dragMeta.kind,
                      bayIdx: dragMeta.bayIdx,
                      targetId: dragMeta.targetId,
                      startClientX: e.clientX,
                      startClientY: e.clientY,
                      startValueMm: dragMeta.startVal,
                      startElevY: dragMeta.startElevY,
                      itemHeightMm: dragMeta.itemHeightMm,
                    });
                  } else if (!dragMeta && mode === "elevation" && e.button === 0 && !elevPanMode && !e.altKey) {
                    e.stopPropagation();
                    const svgEl = (e.currentTarget as Element).closest("svg") as SVGSVGElement | null;
                    const scale = svgEl ? getElevScaleMmPerPx(svgEl) : { x: 4, y: 4 };
                    beginHistoryTransaction();
                    setElevDraggingMod({
                      modIdx: activeModuleIndex,
                      startClientX: e.clientX,
                      startClientY: e.clientY,
                      startModX: activeModule.position.x,
                      startModY: activeModule.position.y,
                      mmPerPxX: scale.x,
                      mmPerPxY: scale.y,
                    });
                  }
                }}
                className={
                  elevPanMode
                    ? "cursor-grab"
                    : dragMeta
                    ? dragMeta.kind === "sub_divider"
                      ? "cursor-move"
                      : dragMeta.kind === "divider"
                      ? "cursor-ew-resize"
                      : "cursor-ns-resize"
                    : "cursor-grab"
                }
              >
                {/* Invisible wider hit target for thin shelves & dividers so dragging is effortless */}
                {dragMeta && (
                  <rect
                    x={el.x - (isDivider || isSubDivider ? 30 : 0)}
                    y={el.y - (isShelf || isSubDivider ? 24 : 0)}
                    width={Math.max(1, el.width + (isDivider || isSubDivider ? 60 : 0))}
                    height={Math.max(1, el.height + (isShelf || isSubDivider ? 48 : 0))}
                    fill="transparent"
                  />
                )}

                <rect
                  data-elev-bg={!dragMeta ? "true" : undefined}
                  x={el.x}
                  y={el.y}
                  width={Math.max(1, el.width)}
                  height={Math.max(1, el.height)}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={isSelected || isActiveDrag ? 6 : 3}
                  opacity={isDoor ? 0.35 : 0.98}
                />

                {/* Readable Label + Elevation Pill on Shelves & Drawers */}
                {mode === "elevation" && (isShelf || (isDrawer && el.role === "drawer_front")) && el.width > 200 && (
                  <g className="pointer-events-none">
                    <rect
                      x={el.x + el.width / 2 - 195}
                      y={isShelf ? el.y - 46 : el.y + el.height / 2 - 22}
                      width={390}
                      height={42}
                      rx={10}
                      fill="#1C1917"
                      opacity={0.92}
                    />
                    <text
                      x={el.x + el.width / 2}
                      y={isShelf ? el.y - 18 : el.y + el.height / 2 + 6}
                      textAnchor="middle"
                      fill="#FFFFFF"
                      fontSize="24"
                      fontWeight="700"
                      fontFamily="monospace"
                    >
                      {isShelf
                        ? `↕ Raf (Y:${elevMm}mm)`
                        : `↕ Çekmece (H:${Math.round(el.height + 3)} • Y:${elevMm}mm)`}
                    </text>
                  </g>
                )}

                {/* Detailed 2D CAD Technical Drawing for Hinges (Ø35mm Cup + 2xØ8mm Boss Holes + Cruciform Mount Plate) */}
                {(mode === "elevation" || mode === "section") && isHinge && (() => {
                  const hcx = el.x + el.width / 2;
                  const hcy = el.y + el.height / 2;
                  const isHettich = el.label.includes("Hettich");
                  const isSalice = el.label.includes("Salice");
                  const halfPitch = isHettich ? 26 : isSalice ? 24 : 22.5;
                  return (
                    <g className="pointer-events-none" data-testid={`cad-hinge-marker-${el.id}`}>
                      {/* Cruciform Mounting Plate Wing & Arm */}
                      <rect
                        x={hcx - 22}
                        y={hcy - 8}
                        width={44}
                        height={16}
                        rx={3}
                        fill="#BAE6FD"
                        stroke="#0369A1"
                        strokeWidth="2.5"
                      />
                      {/* Ø35mm Hinge Cup Circle (radius 17.5mm) */}
                      <circle
                        cx={hcx}
                        cy={hcy}
                        r={17.5}
                        fill="#38BDF8"
                        stroke="#0F172A"
                        strokeWidth="3"
                      />
                      {/* 2x Ø8mm Dowel/Boss Holes at exact manufacturer pitch (45mm Blum / 52mm Hettich TH52 / 48mm Salice) */}
                      <circle
                        cx={hcx}
                        cy={hcy - halfPitch}
                        r={4}
                        fill="#0F172A"
                        stroke="#FFFFFF"
                        strokeWidth="1.5"
                      />
                      <circle
                        cx={hcx}
                        cy={hcy + halfPitch}
                        r={4}
                        fill="#0F172A"
                        stroke="#FFFFFF"
                        strokeWidth="1.5"
                      />
                      {/* CAD Centerline Crosshair (+) */}
                      <line x1={hcx - 24} y1={hcy} x2={hcx + 24} y2={hcy} stroke="#0F172A" strokeWidth="1.8" strokeDasharray="4 2" />
                      <line x1={hcx} y1={hcy - 30} x2={hcx} y2={hcy + 30} stroke="#0F172A" strokeWidth="1.8" strokeDasharray="4 2" />
                      {mode === "elevation" && (
                        <>
                          <rect
                            x={el.x + el.width + 10}
                            y={hcy - 16}
                            width={185}
                            height={32}
                            rx={8}
                            fill="#0F172A"
                            opacity={0.92}
                          />
                          <text
                            x={el.x + el.width + 102}
                            y={hcy + 5}
                            textAnchor="middle"
                            fill="#38BDF8"
                            fontSize="17"
                            fontWeight="800"
                            fontFamily="monospace"
                          >
                            {`${isHettich ? "Hettich" : isSalice ? "Salice" : "Blum"} ${el.label.match(/\(Y:\d+mm\)/)?.[0] || ""}`}
                          </text>
                        </>
                      )}
                    </g>
                  );
                })()}

                {/* Detailed 2D CAD Technical Vector Schematic for World-Brand Interior Accessories */}
                {(mode === "elevation" || mode === "section") && isSpecialFitting && el.width > 100 && (() => {
                  const lbl = el.label;
                  const cx = el.x + el.width / 2;
                  const cy = el.y + el.height / 2;
                  return (
                    <g className="pointer-events-none" data-testid={`cad-fitting-marker-${el.id}`}>
                      {/* 1. Häfele Trouser Rack (Teleskopik Pantolonluk): Left/Right Slide Channels + Spaced Hanger Rods */}
                      {lbl.includes("Pantolonluk") && (() => {
                        const rods = 7;
                        const step = (el.width - 60) / (rods - 1);
                        return (
                          <g>
                            <rect x={el.x + 6} y={el.y + 8} width={16} height={el.height - 16} fill="#047857" />
                            <rect x={el.x + el.width - 22} y={el.y + 8} width={16} height={el.height - 16} fill="#047857" />
                            <line x1={el.x + 22} y1={cy} x2={el.x + el.width - 22} y2={cy} stroke="#065F46" strokeWidth="6" />
                            {Array.from({ length: rods }, (_, idx) => (
                              <circle
                                key={idx}
                                cx={el.x + 30 + idx * step}
                                cy={cy}
                                r={9}
                                fill="#ECFDF5"
                                stroke="#065F46"
                                strokeWidth="3.5"
                              />
                            ))}
                          </g>
                        );
                      })()}

                      {/* 2. Häfele Inclined Shoe Rack (Eğimli Ayakkabılık): 3 Stepped/Inclined Bars + Front Heel Guard */}
                      {lbl.includes("Ayakkabılık") && (
                        <g>
                          <line x1={el.x + 16} y1={el.y + el.height - 18} x2={el.x + el.width - 16} y2={el.y + el.height - 18} stroke="#065F46" strokeWidth="7" />
                          <line x1={el.x + 24} y1={cy} x2={el.x + el.width - 24} y2={cy - 10} stroke="#047857" strokeWidth="5" strokeDasharray="16 8" />
                          <line x1={el.x + 32} y1={el.y + 24} x2={el.x + el.width - 32} y2={el.y + 14} stroke="#047857" strokeWidth="5" />
                        </g>
                      )}

                      {/* 3. Servetto / Häfele Wardrobe Lift (Gardırop Asansörü): Side Dampers + Arms + Hanger Bar + Center Pull Wand */}
                      {lbl.includes("Asansörü") && (
                        <g>
                          {/* Left & Right Side Damper Boxes */}
                          <rect x={el.x + 4} y={el.y + el.height - 150} width={34} height={140} rx={6} fill="#065F46" stroke="#FFFFFF" strokeWidth="2" />
                          <rect x={el.x + el.width - 38} y={el.y + el.height - 150} width={34} height={140} rx={6} fill="#065F46" stroke="#FFFFFF" strokeWidth="2" />
                          {/* Left & Right Articulated Lift Arms */}
                          <line x1={el.x + 20} y1={el.y + el.height - 140} x2={el.x + 35} y2={el.y + 35} stroke="#047857" strokeWidth="10" />
                          <line x1={el.x + el.width - 20} y1={el.y + el.height - 140} x2={el.x + el.width - 35} y2={el.y + 35} stroke="#047857" strokeWidth="10" />
                          {/* Top Horizontal Clothes Rail */}
                          <line x1={el.x + 30} y1={el.y + 35} x2={el.x + el.width - 30} y2={el.y + 35} stroke="#064E3B" strokeWidth="14" />
                          {/* Central Vertical Pull-Down Wand & Handle */}
                          <line x1={cx} y1={el.y + 35} x2={cx} y2={el.y + el.height - 30} stroke="#0F172A" strokeWidth="8" />
                          <rect x={cx - 28} y={el.y + el.height - 38} width={56} height={22} rx={8} fill="#0F172A" />
                        </g>
                      )}

                      {/* 4. Häfele Wire Basket (Frenli Tel Sepet): Wire Mesh Hatching Grid */}
                      {lbl.includes("Tel Sepet") && (() => {
                        const cols = Math.max(5, Math.min(12, Math.floor(el.width / 55)));
                        const stepX = (el.width - 32) / cols;
                        return (
                          <g>
                            {Array.from({ length: cols + 1 }, (_, idx) => (
                              <line
                                key={idx}
                                x1={el.x + 16 + idx * stepX}
                                y1={el.y + 10}
                                x2={el.x + 16 + idx * stepX}
                                y2={el.y + el.height - 10}
                                stroke="#047857"
                                strokeWidth="2.5"
                              />
                            ))}
                            <line x1={el.x + 10} y1={el.y + el.height * 0.35} x2={el.x + el.width - 10} y2={el.y + el.height * 0.35} stroke="#047857" strokeWidth="3" />
                            <line x1={el.x + 10} y1={el.y + el.height * 0.7} x2={el.x + el.width - 10} y2={el.y + el.height * 0.7} stroke="#047857" strokeWidth="3" />
                          </g>
                        );
                      })()}

                      {/* 5. Kesseböhmer LeMans II Corner Mechanism: Pivot Pole + 2 Kidney Trays */}
                      {lbl.includes("LeMans") && (
                        <g>
                          <rect x={el.x + el.width * 0.22} y={el.y + 8} width={22} height={el.height - 16} fill="#064E3B" />
                          <rect x={el.x + 20} y={el.y + el.height * 0.22} width={el.width - 40} height={42} rx={18} fill="#34D399" stroke="#064E3B" strokeWidth="4" />
                          <rect x={el.x + 20} y={el.y + el.height * 0.72} width={el.width - 40} height={42} rx={18} fill="#34D399" stroke="#064E3B" strokeWidth="4" />
                        </g>
                      )}

                      {/* 6. Kesseböhmer Dispensa Tall Pantry Pullout: Center Column + 5 Wire Baskets */}
                      {lbl.includes("Dispensa") && (
                        <g>
                          <rect x={cx - 12} y={el.y + 10} width={24} height={el.height - 20} fill="#064E3B" />
                          {[0.12, 0.3, 0.48, 0.66, 0.84].map((ratio, idx) => (
                            <rect
                              key={idx}
                              x={el.x + 18}
                              y={el.y + el.height * ratio}
                              width={el.width - 36}
                              height={54}
                              rx={6}
                              fill="#6EE7B7"
                              stroke="#064E3B"
                              strokeWidth="3.5"
                            />
                          ))}
                        </g>
                      )}

                      {/* 8. Häfele Loox5 3000K LED Channel / Strip */}
                      {lbl.includes("LED") && (
                        <g>
                          <rect
                            x={el.x + 4}
                            y={el.y + 2}
                            width={Math.max(12, el.width - 8)}
                            height={Math.max(10, el.height - 4)}
                            rx={6}
                            fill="#FDE047"
                            stroke="#CA8A04"
                            strokeWidth="3.5"
                          />
                        </g>
                      )}

                      {/* 9. Countertop Sink / Cooktop CNC Cut-out & Ventilation Grille */}
                      {(lbl.includes("Cut-out") || lbl.includes("Menfezi")) && (
                        <g>
                          <rect
                            x={el.x + 8}
                            y={el.y + 4}
                            width={Math.max(20, el.width - 16)}
                            height={Math.max(12, el.height - 8)}
                            rx={6}
                            fill="none"
                            stroke="#DC2626"
                            strokeWidth="4"
                            strokeDasharray="12 6"
                          />
                        </g>
                      )}

                      {/* 7. Häfele Dual Waste Bin (30L + 15L) */}
                      {lbl.includes("Çöp") && (
                        <g>
                          <rect
                            x={el.x + 18}
                            y={el.y + 28}
                            width={Math.max(40, el.width * 0.54 - 24)}
                            height={Math.max(60, el.height - 40)}
                            rx={8}
                            fill="#334155"
                            stroke="#0F172A"
                            strokeWidth="4"
                          />
                          <rect
                            x={el.x + el.width * 0.56}
                            y={el.y + 28}
                            width={Math.max(36, el.width * 0.44 - 24)}
                            height={Math.max(60, el.height - 40)}
                            rx={8}
                            fill="#475569"
                            stroke="#0F172A"
                            strokeWidth="4"
                          />
                          <line x1={el.x + 10} y1={el.y + 18} x2={el.x + el.width - 10} y2={el.y + 18} stroke="#064E3B" strokeWidth="6" />
                        </g>
                      )}

                      {/* Brand & SKU Engineering Callout Pill */}
                      {mode === "elevation" && (
                        <>
                          <rect
                            x={cx - 220}
                            y={cy - 20}
                            width={440}
                            height={40}
                            rx={8}
                            fill="#064E3B"
                            opacity={0.94}
                          />
                          <text
                            x={cx}
                            y={cy + 6}
                            textAnchor="middle"
                            fill="#ECFDF5"
                            fontSize="19"
                            fontWeight="800"
                            fontFamily="monospace"
                          >
                            {`🛠️ ${lbl}`}
                          </text>
                        </>
                      )}
                    </g>
                  );
                })()}

                {/* Drag Handle Badge on Intermediate Dividers (Full-Height or Partial Shelf-Between Sub-Divider) */}
                {mode === "elevation" && (isDivider || isSubDivider) && (
                  <g className="pointer-events-none">
                    <rect
                      x={el.x + el.width / 2 - (isSubDivider ? 98 : 85)}
                      y={el.y + el.height / 2 - 24}
                      width={isSubDivider ? 196 : 170}
                      height={48}
                      rx={12}
                      fill={isSubDivider ? "#9A3412" : "#B86B2B"}
                      stroke="#FFFFFF"
                      strokeWidth="3"
                    />
                    <text
                      x={el.x + el.width / 2}
                      y={el.y + el.height / 2 + 8}
                      textAnchor="middle"
                      fill="#FFFFFF"
                      fontSize="22"
                      fontWeight="800"
                      fontFamily="monospace"
                    >
                      {isSubDivider
                        ? `✥ Raf Dikme (X:${dragMeta?.startVal ?? 0})`
                        : "↔ Ana Dikme"}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Render Draggable Hanging Rails in 2D Elevation */}
          {railComponents.map((rail) => {
            const svgY = breakdown.overall.height - (rail.position.y + rail.dimensions.height);
            const bIdx = rail.bayIndex ?? 0;
            const bay = activeModule.bays[bIdx];
            const railCfg = bay?.hangingRails.find((r) => r.id === rail.id);
            const elevY = railCfg?.elevationY ?? 1700;

            return (
              <g
                key={rail.id}
                data-testid={`cad-el-${rail.id}`}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  beginHistoryTransaction();
                  setSelectedComponentId(rail.id);
                  setActiveBayIndex(bIdx);
                  setInteriorDrag({
                    kind: "rail",
                    bayIdx: bIdx,
                    targetId: rail.id,
                    startClientX: e.clientX,
                    startClientY: e.clientY,
                    startValueMm: elevY,
                  });
                }}
                className="cursor-ns-resize"
              >
                <rect
                  x={rail.position.x}
                  y={svgY - 22}
                  width={rail.dimensions.width}
                  height={65}
                  fill="transparent"
                />
                <rect
                  x={rail.position.x + 4}
                  y={svgY}
                  width={Math.max(10, rail.dimensions.width - 8)}
                  height={24}
                  rx={8}
                  fill="#94A3B8"
                  stroke="#111827"
                  strokeWidth="3"
                />
                <rect
                  x={rail.position.x + rail.dimensions.width / 2 - 140}
                  y={svgY - 44}
                  width={280}
                  height={40}
                  rx={10}
                  fill="#0F172A"
                  opacity={0.9}
                />
                <text
                  x={rail.position.x + rail.dimensions.width / 2}
                  y={svgY - 17}
                  textAnchor="middle"
                  fill="#FFFFFF"
                  fontSize="24"
                  fontWeight="700"
                  fontFamily="monospace"
                  pointerEvents="none"
                >
                  ↕ Askı (Y:{elevY}mm)
                </text>
              </g>
            );
          })}

          {/* Cross-Module & Cross-Bay Elevation Snap Alignment Line in 2D Front View */}
          {mode === "elevation" &&
            activeElevSnap &&
            (() => {
              const snapWorldFromModuleBottom =
                activeModule.carcass.plinthHeight +
                activeModule.carcass.panelThickness +
                activeElevSnap.elevationY;
              const snapSvgY = breakdown.overall.height - snapWorldFromModuleBottom;
              const badgeText = `🎯 Hizalandı: ${activeElevSnap.label} (${activeElevSnap.elevationY}mm)`;
              const badgeW = Math.max(420, badgeText.length * 16 + 44);
              return (
                <g data-testid="cad-elevation-snap-guide" className="pointer-events-none">
                  <line
                    x1={-120}
                    y1={snapSvgY}
                    x2={breakdown.overall.width + 120}
                    y2={snapSvgY}
                    stroke="#0284C7"
                    strokeWidth="6"
                    strokeDasharray="18 10"
                  />
                  <rect
                    x={breakdown.overall.width / 2 - badgeW / 2}
                    y={snapSvgY - 58}
                    width={badgeW}
                    height={46}
                    rx={12}
                    fill="#0369A1"
                    stroke="#FFFFFF"
                    strokeWidth="3"
                  />
                  <text
                    x={breakdown.overall.width / 2}
                    y={snapSvgY - 27}
                    textAnchor="middle"
                    fill="#FFFFFF"
                    fontSize="24"
                    fontWeight="800"
                    fontFamily="monospace"
                  >
                    {badgeText}
                  </text>
                </g>
              );
            })()}

          {/* High-Contrast, Large Architectural Dimension Callouts with Pill Backgrounds */}
          {(hasSceneModules ? data.dimensionLines : []).map((dim) => {
            const isH = dim.orientation === "horizontal";
            const midX = (dim.x1 + dim.x2) / 2;
            const midY = (dim.y1 + dim.y2) / 2;
            const pillW = Math.max(210, dim.label.length * 24 + 40);
            const pillH = 54;

            return (
              <g key={dim.id} className="pointer-events-none">
                <line
                  x1={dim.x1}
                  y1={dim.y1}
                  x2={dim.x2}
                  y2={dim.y2}
                  stroke="#9A3412"
                  strokeWidth="4"
                />
                {isH ? (
                  <>
                    <line
                      x1={dim.x1}
                      y1={dim.y1 - 18}
                      x2={dim.x1}
                      y2={dim.y1 + 18}
                      stroke="#9A3412"
                      strokeWidth="4"
                    />
                    <line
                      x1={dim.x2}
                      y1={dim.y2 - 18}
                      x2={dim.x2}
                      y2={dim.y2 + 18}
                      stroke="#9A3412"
                      strokeWidth="4"
                    />
                    <rect
                      x={midX - pillW / 2}
                      y={dim.offset < 0 ? dim.y1 - pillH - 14 : dim.y1 + 14}
                      width={pillW}
                      height={pillH}
                      rx={12}
                      fill="#FFFFFF"
                      stroke="#B86B2B"
                      strokeWidth="3"
                    />
                    <text
                      x={midX}
                      y={dim.offset < 0 ? dim.y1 - 26 : dim.y1 + 52}
                      textAnchor="middle"
                      fill="#7C2D12"
                      fontSize="36"
                      fontWeight="800"
                      fontFamily="monospace"
                    >
                      {dim.label}
                    </text>
                  </>
                ) : (
                  <>
                    <line
                      x1={dim.x1 - 18}
                      y1={dim.y1}
                      x2={dim.x1 + 18}
                      y2={dim.y1}
                      stroke="#9A3412"
                      strokeWidth="4"
                    />
                    <line
                      x1={dim.x2 - 18}
                      y1={dim.y2}
                      x2={dim.x2 + 18}
                      y2={dim.y2}
                      stroke="#9A3412"
                      strokeWidth="4"
                    />
                    <g transform={`translate(${dim.x1 - 55}, ${midY}) rotate(-90)`}>
                      <rect
                        x={-pillW / 2}
                        y={-pillH / 2}
                        width={pillW}
                        height={pillH}
                        rx={12}
                        fill="#FFFFFF"
                        stroke="#B86B2B"
                        strokeWidth="3"
                      />
                      <text
                        x={0}
                        y={12}
                        textAnchor="middle"
                        fill="#7C2D12"
                        fontSize="36"
                        fontWeight="800"
                        fontFamily="monospace"
                      >
                        {dim.label}
                      </text>
                    </g>
                  </>
                )}
              </g>
            );
          })}

          {/* ALWAYS-ACTIVE 4-EDGE PARAMETRIC RESIZE HANDLES IN 2D ELEVATION (▲ Üst Boy H, ▼ Alt Kot Y, ◀ Sol Genişlik W, ▶ Sağ Genişlik W) */}
          {hasSceneModules && mode === "elevation" && (
            <g data-testid="elev-parametric-4edge-resize-handles">
              <rect
                x={-10}
                y={-10}
                width={breakdown.overall.width + 20}
                height={breakdown.overall.height + 20}
                rx={10}
                fill="none"
                stroke="#D97706"
                strokeWidth="5"
                strokeDasharray="16 8"
                className="pointer-events-none"
              />
              {/* 1. Top Edge Parametric Height Resize Handle (▲ Üstten Boy Uzat/Kısalt) */}
              <g
                data-testid="elev-mod-resize-height-handle"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  const svgEl = (e.currentTarget as Element).closest("svg") as SVGSVGElement | null;
                  const scale = svgEl ? getElevScaleMmPerPx(svgEl) : { x: 4, y: 4 };
                  beginHistoryTransaction();
                  setElevResizingMod({
                    modIdx: activeModuleIndex,
                    axis: "height_top",
                    startClientX: e.clientX,
                    startClientY: e.clientY,
                    startW: activeModule.dimensions.width,
                    startH: activeModule.dimensions.height,
                    startX: activeModule.position.x,
                    startY: activeModule.position.y,
                    mmPerPxX: scale.x,
                    mmPerPxY: scale.y,
                  });
                }}
                className="cursor-ns-resize"
              >
                <rect
                  x={breakdown.overall.width / 2 - 92}
                  y={-28}
                  width={184}
                  height={40}
                  rx={10}
                  fill="#0284C7"
                  stroke="#FFFFFF"
                  strokeWidth="3.5"
                />
                <text
                  x={breakdown.overall.width / 2}
                  y={-2}
                  textAnchor="middle"
                  fill="#FFFFFF"
                  fontSize="21"
                  fontWeight="900"
                  fontFamily="monospace"
                >
                  ▲ BOY (H:{activeModule.dimensions.height})
                </text>
              </g>

              {/* 2. Bottom Edge Parametric Height/Elevation Resize Handle (▼ Alttan Boy/Kot Değiştir) */}
              <g
                data-testid="elev-mod-resize-bottom-handle"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  const svgEl = (e.currentTarget as Element).closest("svg") as SVGSVGElement | null;
                  const scale = svgEl ? getElevScaleMmPerPx(svgEl) : { x: 4, y: 4 };
                  beginHistoryTransaction();
                  setElevResizingMod({
                    modIdx: activeModuleIndex,
                    axis: "height_bottom",
                    startClientX: e.clientX,
                    startClientY: e.clientY,
                    startW: activeModule.dimensions.width,
                    startH: activeModule.dimensions.height,
                    startX: activeModule.position.x,
                    startY: activeModule.position.y,
                    mmPerPxX: scale.x,
                    mmPerPxY: scale.y,
                  });
                }}
                className="cursor-ns-resize"
              >
                <rect
                  x={breakdown.overall.width / 2 - 80}
                  y={breakdown.overall.height - 12}
                  width={160}
                  height={36}
                  rx={10}
                  fill="#0284C7"
                  stroke="#FFFFFF"
                  strokeWidth="3.5"
                />
                <text
                  x={breakdown.overall.width / 2}
                  y={breakdown.overall.height + 12}
                  textAnchor="middle"
                  fill="#FFFFFF"
                  fontSize="19"
                  fontWeight="900"
                  fontFamily="monospace"
                >
                  ▼ ALT KOT / BOY
                </text>
              </g>

              {/* 3. Left Edge Parametric Width Resize Handle (◀ Soldan Genişlet/Daralt) */}
              <g
                data-testid="elev-mod-resize-left-handle"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  const svgEl = (e.currentTarget as Element).closest("svg") as SVGSVGElement | null;
                  const scale = svgEl ? getElevScaleMmPerPx(svgEl) : { x: 4, y: 4 };
                  beginHistoryTransaction();
                  setElevResizingMod({
                    modIdx: activeModuleIndex,
                    axis: "width_left",
                    startClientX: e.clientX,
                    startClientY: e.clientY,
                    startW: activeModule.dimensions.width,
                    startH: activeModule.dimensions.height,
                    startX: activeModule.position.x,
                    startY: activeModule.position.y,
                    mmPerPxX: scale.x,
                    mmPerPxY: scale.y,
                  });
                }}
                className="cursor-ew-resize"
              >
                <rect
                  x={-26}
                  y={breakdown.overall.height / 2 - 42}
                  width={38}
                  height={84}
                  rx={10}
                  fill="#059669"
                  stroke="#FFFFFF"
                  strokeWidth="3.5"
                />
                <text
                  x={-7}
                  y={breakdown.overall.height / 2 + 8}
                  textAnchor="middle"
                  fill="#FFFFFF"
                  fontSize="24"
                  fontWeight="900"
                >
                  ◀
                </text>
              </g>

              {/* 4. Right Edge Parametric Width Resize Handle (▶ Sağdan Genişlet/Daralt) */}
              <g
                data-testid="elev-mod-resize-width-handle"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  const svgEl = (e.currentTarget as Element).closest("svg") as SVGSVGElement | null;
                  const scale = svgEl ? getElevScaleMmPerPx(svgEl) : { x: 4, y: 4 };
                  beginHistoryTransaction();
                  setElevResizingMod({
                    modIdx: activeModuleIndex,
                    axis: "width_right",
                    startClientX: e.clientX,
                    startClientY: e.clientY,
                    startW: activeModule.dimensions.width,
                    startH: activeModule.dimensions.height,
                    startX: activeModule.position.x,
                    startY: activeModule.position.y,
                    mmPerPxX: scale.x,
                    mmPerPxY: scale.y,
                  });
                }}
                className="cursor-ew-resize"
              >
                <rect
                  x={breakdown.overall.width - 12}
                  y={breakdown.overall.height / 2 - 42}
                  width={38}
                  height={84}
                  rx={10}
                  fill="#059669"
                  stroke="#FFFFFF"
                  strokeWidth="3.5"
                />
                <text
                  x={breakdown.overall.width + 7}
                  y={breakdown.overall.height / 2 + 8}
                  textAnchor="middle"
                  fill="#FFFFFF"
                  fontSize="24"
                  fontWeight="900"
                >
                  ▶
                </text>
              </g>
            </g>
          )}
        </svg>
      </div>
    );
  }
);

V3CadViewport2D.displayName = "V3CadViewport2D";
export default V3CadViewport2D;
