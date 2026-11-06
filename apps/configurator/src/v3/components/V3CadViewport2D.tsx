"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  ArchitecturalElement,
  parseCadDxfText,
  parsePdfFloorPlanMetadata,
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
      undo,
      redo,
    } = useV3Adapter();

    const [zoom, setZoom] = useState(1);
    const [panPx, setPanPx] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
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
      startModX: number;
      mmPerPxX: number;
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
    const [interiorDrag, setInteriorDrag] = useState<{
      kind: "shelf" | "drawer" | "rail" | "divider" | "sub_divider";
      bayIdx: number;
      targetId: string;
      startClientX: number;
      startClientY: number;
      startValueMm: number;
      itemHeightMm?: number;
    } | null>(null);
    const [activeElevSnap, setActiveElevSnap] = useState<ElevationSnapTarget | null>(null);
    const [planRowSnapBanner, setPlanRowSnapBanner] = useState<string | null>(null);
    const [dragGhostPreview, setDragGhostPreview] = useState<RowSnapPreviewResult | null>(null);
    const [activePlanSnapX, setActivePlanSnapX] = useState<number | null>(null);

    const footprints = useMemo(
      () => project.modules.map((m, idx) => getModuleOrientedFootprint(m, idx)),
      [project.modules]
    );

    const errorModuleIds = useMemo(() => {
      const set = new Set<string>();
      validationIssues.forEach((iss) => {
        if (iss.severity === "error" && iss.targetId) {
          set.add(iss.targetId);
        }
      });
      return set;
    }, [validationIssues]);

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

    // Global keyboard shortcuts for Ctrl+Z, Ctrl+Y / Ctrl+Shift+Z, Delete/Backspace, and Escape
    useEffect(() => {
      if (mode !== "plan" || !interactivePlan) return;
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
          }
          return;
        }
        if (ev.key === "Delete" || ev.key === "Backspace") {
          if (selectedPlanObject) {
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

      const pad = 360;
      const computedVb = {
        x: -pad,
        y: -pad,
        width: totalModExtentX + pad * 2,
        height: maxDepthZ + pad * 2,
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
        if (isDrawingWall || isPlacingObstacle) return;
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
        if (isDrawingWall || isPlacingObstacle) return;
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
        if (isDrawingWall || isPlacingObstacle) return;
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
        if (isDrawingWall || isPlacingObstacle) {
          e.preventDefault();
          setDrawWallStart(null);
          setDrawWallCursor(null);
          setChainOriginPoint(null);
          setActiveSnapTarget(null);
          setIsPlacingObstacle(false);
        }
      };

      const handleSvgPointerMove = (e: React.MouseEvent<SVGSVGElement>) => {
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
          const startedAtZero = dragStartClient.startModX <= 5;
          if (rawNextX <= SNAP_THRESHOLD_MM && (!startedAtZero || dxMm <= 0)) {
            nextX = 0;
            snappedEdgeX = 0;
            activeSnapMsg = "🧲 Duvar Başlangıcı (X: 0mm) — Ayırmak için fareyi çekin veya Alt tuşuna basın";
          }
          if (rawNextZ <= 28) {
            nextZ = 0;
          }
          project.modules.forEach((other, oIdx) => {
            if (oIdx === draggingModIdx || other.category === "complementary") return;
            const otherW = footprints[oIdx]?.planWidth || other.dimensions.width;
            const otherRight = other.position.x + otherW;
            const otherLeft = other.position.x;

            // Breakaway check: if we started already touching this edge and are pulling away, do NOT trap!
            const startedAtRight = Math.abs(dragStartClient.startModX - otherRight) <= 6;
            const pullingAwayFromRight = startedAtRight && Math.abs(dxMm) > 4;

            const startedAtLeft = Math.abs(dragStartClient.startModX + dragW - otherLeft) <= 6;
            const pullingAwayFromLeft = startedAtLeft && Math.abs(dxMm) > 4;

            if (!pullingAwayFromRight && Math.abs(rawNextX - otherRight) <= SNAP_THRESHOLD_MM) {
              nextX = otherRight;
              nextZ = other.position.z;
              snappedEdgeX = otherRight;
              activeSnapMsg = `🧲 ${oIdx + 1}. Modül Sağına Snap (X: ${otherRight}mm)`;
            } else if (
              !pullingAwayFromLeft &&
              Math.abs(rawNextX + dragW - otherLeft) <= SNAP_THRESHOLD_MM &&
              otherLeft - dragW >= 0
            ) {
              nextX = otherLeft - dragW;
              nextZ = other.position.z;
              snappedEdgeX = otherLeft;
              activeSnapMsg = `🧲 ${oIdx + 1}. Modül Soluna Snap (X: ${nextX}mm)`;
            }
          });
        }
        setActivePlanSnapX(snappedEdgeX);
        setPlanRowSnapBanner(activeSnapMsg);
        setModulePosition(draggingModIdx, nextX, nextZ, useMagnet ? (activeSnapMsg ? 1 : 10) : 1);
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
          const finishedIdx = draggingModIdx;
          const origX = dragStartClient.startModX;
          setDraggingModIdx(null);
          setActivePlanSnapX(null);
          const swapMsg = finishModuleDragWithSmartSwap(finishedIdx, origX);
          commitHistoryTransaction();
          if (swapMsg) {
            setPlanRowSnapBanner(swapMsg);
            setTimeout(() => setPlanRowSnapBanner(null), 2800);
          } else {
            setPlanRowSnapBanner(null);
          }
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
          {planRowSnapBanner && (
            <div
              data-testid="plan-row-snap-banner"
              className="absolute top-16 left-1/2 -translate-x-1/2 z-30 pointer-events-none px-4 py-1.5 rounded-xl bg-[#F1F5F9] text-[#5C4018] text-white border-2 border-amber-200 shadow-lg font-mono text-xs font-extrabold"
            >
              {planRowSnapBanner}
            </div>
          )}
          {/* Inline Wall Dimension Click-to-Edit Popover */}
          {inlineEditWallId && (
            <div
              data-testid="plan-inline-wall-dim-editor"
              className="absolute top-14 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-white px-3.5 py-2 rounded-2xl border-2 border-[#2563EB] shadow-xl text-xs"
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

          {/* Bottom Room, Wall, Obstacle, Freehand Wall & DWG/DXF/PDF Floorplan Bar (Collapsible CAD drawer, always in DOM for tests) */}
          <div
            data-testid="plan-room-architecture-bar"
            className={`absolute bottom-14 left-4 right-4 z-20 flex flex-wrap items-center gap-2 bg-white/95 backdrop-blur-md px-3 py-2 rounded-xl border border-stone-200 shadow-md text-[11px] text-stone-700 transition-opacity ${
              showAdvancedCadBar || isDrawingWall || isPlacingObstacle || selectedPlanObject
                ? "opacity-100"
                : "opacity-0 pointer-events-none h-0 overflow-hidden py-0 border-0"
            }`}
          >
            {/* 0. Undo / Redo (Ctrl+Z / Ctrl+Y) */}
            <div className="flex items-center gap-1 pr-2 border-r border-stone-200">
              <button
                type="button"
                data-testid="plan-undo-btn"
                onClick={undo}
                className="px-2 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold cursor-pointer"
                title="Geri Al (Ctrl+Z)"
              >
                ↶ Geri Al (Ctrl+Z)
              </button>
              <button
                type="button"
                data-testid="plan-redo-btn"
                onClick={redo}
                className="px-2 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold cursor-pointer"
                title="İleri Al (Ctrl+Y)"
              >
                ↷
              </button>
            </div>

            {/* 1. Room & Wall Dimensions */}
            <div className="flex items-center gap-1.5 pr-2 border-r border-stone-200">
              <span className="font-semibold text-stone-800">Oda/Duvar:</span>
              <label className="flex items-center gap-1 text-stone-600">
                <span>Boy</span>
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
                  className="w-16 px-1.5 py-0.5 rounded border border-stone-300 font-mono text-[11px] text-stone-900"
                />
              </label>
              <label className="flex items-center gap-1 text-stone-600">
                <span>Tavan</span>
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
                  className="w-16 px-1.5 py-0.5 rounded border border-stone-300 font-mono text-[11px] text-stone-900"
                />
              </label>
            </div>

            {/* 2. Continuous Freehand Wall Drawing + Snap */}
            <div className="flex items-center gap-1.5 pr-2 border-r border-stone-200">
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
                className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                  isDrawingWall
                    ? "bg-amber-600 text-white shadow-xs"
                    : "bg-stone-100 hover:bg-stone-200 text-stone-800"
                }`}
              >
                {isDrawingWall
                  ? drawWallStart
                    ? "🔗 Zincir Çiziliyor (Sonraki Nokta)..."
                    : "1. Başlangıç Noktasını Tıklayın..."
                  : "✏️ Devamlı Duvar Çiz (Snap)"}
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
                  className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-[#E5EFEA] text-[#1E3F2F] text-white font-semibold cursor-pointer"
                  title="Mevcut duvar zincirini sonlandır (Esc / Sağ Tık)"
                >
                  ✓ Zinciri Bitir (Esc)
                </button>
              )}
              {spaceWalls.length > 1 && (
                <button
                  type="button"
                  data-testid="plan-remove-last-wall-btn"
                  onClick={() => removeWallSegment(spaceWalls[spaceWalls.length - 1].id)}
                  className="px-2 py-1 rounded-lg bg-stone-100 hover:bg-red-50 text-stone-600 hover:text-red-700 cursor-pointer"
                  title="Son eklenen duvarı sil"
                >
                  Duvar Sil ({spaceWalls.length})
                </button>
              )}
            </div>

            {/* 3. Architectural Obstacle Adder + Visual Icon Buttons + Target Wall / X-Z / Click-on-Map Placement */}
            <div className="flex items-center gap-1.5 pr-2 border-r border-stone-200 flex-wrap">
              <div className="inline-flex items-center gap-0.5 bg-stone-100 p-0.5 rounded-lg border border-stone-200">
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
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 transition cursor-pointer ${
                      newObstacleType === ot.id
                        ? "bg-[#F1F5F9] text-[#5C4018] text-white shadow-2xs"
                        : "text-stone-700 hover:bg-white"
                    }`}
                    title={`${ot.label} seç`}
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
                className="px-1.5 py-0.5 rounded border border-stone-300 bg-white text-[11px] font-medium text-stone-800"
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
                className="px-1.5 py-0.5 rounded border border-stone-300 bg-white text-[11px] text-stone-700"
                title="Engelin ekleneceği duvar veya serbest koordinat"
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
                className="w-14 px-1.5 py-0.5 rounded border border-stone-300 font-mono text-[11px]"
                title="Duvar boyunca mesafe veya X konumu (mm)"
              />
              {obstacleTargetWallId === "custom_xz" && (
                <input
                  data-testid="plan-obstacle-z-input"
                  type="number"
                  step={50}
                  value={newObstacleZ}
                  onChange={(e) => setNewObstacleZ(Number(e.target.value) || 0)}
                  className="w-14 px-1.5 py-0.5 rounded border border-stone-300 font-mono text-[11px]"
                  title="Engel Z derinlik konumu (mm)"
                />
              )}
              <label className="flex items-center gap-0.5 text-[10px]" title="Genişlik (W mm)">
                <span>En(W):</span>
                <input
                  data-testid="plan-obstacle-width-input"
                  type="number"
                  step={50}
                  value={newObstacleW}
                  onChange={(e) => setNewObstacleW(Number(e.target.value) || 250)}
                  className="w-13 px-1 py-0.5 rounded border border-stone-300 font-mono text-[11px]"
                />
              </label>
              <label className="flex items-center gap-0.5 text-[10px]" title="Yükseklik / Boy (H mm)">
                <span>Boy(H):</span>
                <input
                  data-testid="plan-obstacle-height-input"
                  type="number"
                  step={50}
                  value={newObstacleH}
                  onChange={(e) => setNewObstacleH(Number(e.target.value) || 1000)}
                  className="w-13 px-1 py-0.5 rounded border border-stone-300 font-mono text-[11px]"
                />
              </label>
              <label className="flex items-center gap-0.5 text-[10px]" title="Yerden Kot / Denizlik Yüksekliği (Y mm)">
                <span>Kot(Y):</span>
                <input
                  data-testid="plan-obstacle-elevation-input"
                  type="number"
                  step={50}
                  value={newObstacleY}
                  onChange={(e) => setNewObstacleY(Math.max(0, Number(e.target.value) || 0))}
                  className="w-13 px-1 py-0.5 rounded border border-stone-300 font-mono text-[11px]"
                />
              </label>
              <button
                type="button"
                data-testid="plan-obstacle-pre-rotate-btn"
                onClick={() => setNewObstacleRotY((r) => (r + 90) % 360)}
                className="px-1.5 py-0.5 rounded bg-stone-100 hover:bg-amber-100 border border-stone-300 font-mono text-[10px] font-bold text-stone-800 cursor-pointer"
                title="Eklenecek Pencere / Kapı / Engelin açısını 90° döndür (Yan duvarlar için)"
              >
                🔄 {newObstacleRotY}°
              </button>
              <button
                type="button"
                data-testid="plan-add-obstacle-btn"
                onClick={handleAddObstacleClick}
                className="px-2 py-1 rounded-lg bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#111827] border border-[#E2E8F0] font-semibold cursor-pointer"
              >
                + Engel Ekle
              </button>
              <button
                type="button"
                data-testid="plan-place-obstacle-click-toggle"
                onClick={() => {
                  setIsPlacingObstacle((v) => !v);
                  setIsDrawingWall(false);
                  setDrawWallStart(null);
                }}
                className={`px-2 py-1 rounded-lg font-semibold cursor-pointer ${
                  isPlacingObstacle
                    ? "bg-[#EEF3F8] text-[#111827] border border-[#CBD5E1]"
                    : "bg-stone-100 hover:bg-stone-200 text-stone-700"
                }`}
                title="Harita üzerinde istediğiniz yere tıklayarak engeli konumlandırın"
              >
                {isPlacingObstacle ? "🎯 Haritada Tıklayın..." : "🎯 Planda Tıkla Ekle"}
              </button>
            </div>

            {/* 4. DWG / DXF / PDF Floorplan Underlay Import */}
            <div className="flex items-center gap-1.5 pr-2 border-r border-stone-200">
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
                className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-semibold cursor-pointer"
              >
                📐 DWG/DXF/PDF Kat Planı
              </button>
              {underlay && (
                <>
                  <span
                    data-testid="plan-underlay-badge"
                    className="px-2 py-0.5 rounded bg-stone-100 font-mono text-[10px] text-stone-700"
                  >
                    {underlay.fileName} ({underlay.polylines?.length || 0} çizgi)
                  </span>
                  {(underlay.polylines?.length || 0) > 0 && (
                    <button
                      type="button"
                      data-testid="plan-import-dxf-walls-btn"
                      onClick={() => importWallsFromUnderlay(false)}
                      className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-[#E5EFEA] text-[#1E3F2F] text-white font-semibold cursor-pointer"
                    >
                      Duvara Dönüştür
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setFloorPlanUnderlay(null)}
                    className="text-stone-400 hover:text-red-600 font-bold px-1 cursor-pointer"
                    title="Kat planı altlığını kaldır"
                  >
                    ×
                  </button>
                </>
              )}
            </div>

            {/* 5. Selected Object Inspector & Delete + Multi-Select Batch Move */}
            <div className="flex items-center gap-1.5">
              {selectedPlanObject && (
                <div
                  data-testid="plan-selected-object-bar"
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-red-50/90 border border-red-200 text-red-900"
                >
                  <span className="font-semibold text-[10px]">
                    Seçili:{" "}
                    {selectedObstacleObj
                      ? `Engel (${selectedObstacleObj.name})`
                      : selectedWallObj
                      ? `Duvar (${selectedWallObj.name})`
                      : selectedModuleObj
                      ? `Modül (${selectedModuleObj.name})`
                      : selectedPlanObject.id}
                  </span>
                  {selectedModuleObj && project.modules.length > 1 && (
                    <>
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
                        className="px-2 py-0.5 rounded bg-[#F1F5F9] text-[#5C4018] hover:bg-amber-800 text-white font-bold text-[10px] cursor-pointer"
                        title="Bu modülü solundaki modülle yer değiştir"
                      >
                        ⇄ Solla Değiştir
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
                        className="px-2 py-0.5 rounded bg-[#F1F5F9] text-[#5C4018] hover:bg-amber-800 text-white font-bold text-[10px] cursor-pointer"
                        title="Bu modülü sağındaki modülle yer değiştir"
                      >
                        ⇄ Sağla Değiştir
                      </button>
                    </>
                  )}
                  {selectedWallObj && (
                    <>
                      <label className="flex items-center gap-0.5 text-[10px]">
                        <span>X:</span>
                        <input
                          data-testid="plan-selected-wall-x-input"
                          type="number"
                          step={50}
                          value={selectedWallObj.position.x}
                          onChange={(e) =>
                            updateWallSegment(selectedWallObj.id, {
                              position: { x: Number(e.target.value) || 0 },
                            })
                          }
                          className="w-14 px-1 py-0.5 rounded border border-red-300 bg-white font-mono text-[10px]"
                        />
                      </label>
                      <label className="flex items-center gap-0.5 text-[10px]">
                        <span>Z:</span>
                        <input
                          data-testid="plan-selected-wall-z-input"
                          type="number"
                          step={50}
                          value={selectedWallObj.position.z}
                          onChange={(e) =>
                            updateWallSegment(selectedWallObj.id, {
                              position: { z: Number(e.target.value) || 0 },
                            })
                          }
                          className="w-14 px-1 py-0.5 rounded border border-red-300 bg-white font-mono text-[10px]"
                        />
                      </label>
                      <label className="flex items-center gap-0.5 text-[10px]">
                        <span>Boy:</span>
                        <input
                          data-testid="plan-selected-wall-length-input"
                          type="number"
                          step={50}
                          min={200}
                          value={selectedWallObj.length}
                          onChange={(e) =>
                            updateWallSegment(selectedWallObj.id, {
                              length: Number(e.target.value) || 500,
                            })
                          }
                          className="w-15 px-1 py-0.5 rounded border border-red-300 bg-white font-mono text-[10px]"
                        />
                      </label>
                      <label className="flex items-center gap-0.5 text-[10px]">
                        <span>Açı°:</span>
                        <input
                          data-testid="plan-selected-wall-angle-input"
                          type="number"
                          step={45}
                          value={selectedWallObj.rotationY}
                          onChange={(e) =>
                            updateWallSegment(selectedWallObj.id, {
                              rotationY: Number(e.target.value) || 0,
                            })
                          }
                          className="w-12 px-1 py-0.5 rounded border border-red-300 bg-white font-mono text-[10px]"
                        />
                      </label>
                    </>
                  )}
                  {selectedObstacleObj && (
                    <>
                      <button
                        type="button"
                        data-testid="plan-rotate-obstacle-btn"
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
                        className="px-2 py-0.5 rounded bg-amber-600 hover:bg-[#F1F5F9] text-[#5C4018] text-white font-bold text-[10px] cursor-pointer"
                        title="Pencere / Kapı / Engeli 90° döndür (Yan duvara çevir veya yönünü değiştir)"
                      >
                        🔄 90° Döndür ({selectedObstacleObj.rotationY || 0}°)
                      </button>
                      {selectedObstacleObj.type === "door" && (
                        <button
                          type="button"
                          data-testid="plan-flip-door-swing-btn"
                          onClick={() =>
                            updateSpaceObstacle(selectedObstacleObj.id, {
                              doorSwing:
                                selectedObstacleObj.doorSwing === "right" ? "left" : "right",
                            })
                          }
                          className="px-2 py-0.5 rounded bg-[#F1F5F9] text-[#111827] hover:bg-[#EEF3F8] text-[#111827] border border-[#CBD5E1] font-bold text-[10px] cursor-pointer"
                          title="Kapı kanadı açılış yönünü (Sol / Sağ) değiştir"
                        >
                          ↔️ Kanat: {selectedObstacleObj.doorSwing === "right" ? "Sağ" : "Sol"}
                        </button>
                      )}
                      <label className="flex items-center gap-0.5 text-[10px]" title="Genişlik (W mm)">
                        <span>En(W):</span>
                        <input
                          data-testid="plan-selected-obs-width-input"
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
                          className="w-13 px-1 py-0.5 rounded border border-red-300 bg-white font-mono text-[10px]"
                        />
                      </label>
                      <label className="flex items-center gap-0.5 text-[10px]" title="Engel Yüksekliği (H mm)">
                        <span>Boy(H):</span>
                        <input
                          data-testid="plan-selected-obs-height-input"
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
                          className="w-13 px-1 py-0.5 rounded border border-red-300 bg-white font-mono text-[10px]"
                        />
                      </label>
                      <label className="flex items-center gap-0.5 text-[10px]" title="Yerden Yükseklik / Denizlik Kotu (Y mm)">
                        <span>Kot(Y):</span>
                        <input
                          data-testid="plan-selected-obs-elevation-input"
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
                          className="w-13 px-1 py-0.5 rounded border border-red-300 bg-white font-mono text-[10px]"
                        />
                      </label>
                      <label className="flex items-center gap-0.5 text-[10px]">
                        <span>X:</span>
                        <input
                          type="number"
                          step={50}
                          value={selectedObstacleObj.position.x}
                          onChange={(e) =>
                            updateObstaclePosition(
                              selectedObstacleObj.id,
                              Number(e.target.value) || 0,
                              selectedObstacleObj.position.z
                            )
                          }
                          className="w-13 px-1 py-0.5 rounded border border-red-300 bg-white font-mono text-[10px]"
                        />
                      </label>
                      <label className="flex items-center gap-0.5 text-[10px]">
                        <span>Z:</span>
                        <input
                          type="number"
                          step={50}
                          value={selectedObstacleObj.position.z}
                          onChange={(e) =>
                            updateObstaclePosition(
                              selectedObstacleObj.id,
                              selectedObstacleObj.position.x,
                              Number(e.target.value) || 0
                            )
                          }
                          className="w-13 px-1 py-0.5 rounded border border-red-300 bg-white font-mono text-[10px]"
                        />
                      </label>
                    </>
                  )}
                  <button
                    type="button"
                    data-testid="plan-delete-selected-object-btn"
                    onClick={handleDeleteSelectedObject}
                    className="px-2 py-0.5 rounded bg-red-100 text-red-900 hover:bg-red-100 text-red-900 text-white font-bold text-[10px] cursor-pointer"
                    title="Seçili objeyi sil (Delete / Backspace)"
                  >
                    🗑 Seçiliyi Sil (Del)
                  </button>
                </div>
              )}

              <button
                type="button"
                data-testid="plan-magnet-toggle-btn"
                onClick={() => setMagnetEnabled((m) => !m)}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                  magnetEnabled
                    ? "bg-[#E5EFEA] text-[#1E3F2F] text-white"
                    : "bg-stone-200 text-stone-800 hover:bg-stone-300"
                }`}
                title="Modül sürüklerken mıknatıslı yapışmayı (Snap) aç/kapat (İpucu: Alt tuşuna basılı tutarak da serbest taşıyabilirsiniz)"
              >
                {magnetEnabled ? "🧲 Mıknatıs: Açık" : "🔓 Mıknatıs: Serbest"}
              </button>
              <button
                type="button"
                data-testid="plan-select-all-modules-btn"
                onClick={selectAllModules}
                className="px-2 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium cursor-pointer"
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
                  <button
                    type="button"
                    onClick={clearModuleSelection}
                    className="px-1.5 py-1 rounded text-stone-500 hover:text-stone-800 cursor-pointer"
                  >
                    Tek Seçim
                  </button>
                </>
              )}
            </div>
          </div>

          {/* EKRAN 7 (FAZ 6): ALT 2D ÖLÇEK VE GÖRÜNÜM ÇUBUĞU (Matches image_da6ae9.jpg 1-to-1) */}
          <div
            data-testid="plan-bottom-scale-bar"
            className="absolute bottom-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-[#CBD5E1] shadow-sm text-xs text-[#111827]"
          >
            {/* Left: Compass N + Scale Dropdown + Zoom Controls + Fit */}
            <div className="flex items-center gap-2">
              <div
                title="Kuzey Yönü (Yukarı = Kuzey / Ana Duvar)"
                className="w-7 h-7 rounded-full bg-[#F8FAFC] border border-[#CBD5E1] flex items-center justify-center font-extrabold text-[11px] text-[#1E293B] shadow-2xs"
              >
                N▲
              </div>

              <div className="flex items-center gap-1 bg-[#F8FAFC] px-2.5 py-1 rounded-xl border border-[#E2E8F0]">
                <span className="text-[11px] text-[#64748B] font-medium">Ölçek:</span>
                <select
                  data-testid="plan-scale-select"
                  value={planScaleRatio}
                  onChange={(e) => {
                    const sc = Number(e.target.value) as 20 | 25 | 50;
                    setPlanScaleRatio(sc);
                    setZoom(sc === 20 ? 1.25 : sc === 25 ? 1.0 : 0.65);
                  }}
                  className="bg-transparent font-mono font-bold text-xs text-[#111827] focus:outline-none cursor-pointer"
                >
                  <option value={20}>1:20</option>
                  <option value={25}>1:25</option>
                  <option value={50}>1:50</option>
                </select>
              </div>

              <div className="inline-flex items-center bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] p-0.5">
                <button
                  type="button"
                  data-testid="plan-zoom-out-btn"
                  onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.15).toFixed(2)))}
                  className="w-6 h-6 rounded-lg hover:bg-white font-mono font-bold text-sm flex items-center justify-center cursor-pointer"
                  title="Uzaklaştır (−)"
                >
                  −
                </button>
                <span className="font-mono text-[11px] font-semibold px-1.5 min-w-[44px] text-center text-[#334155]">
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
                title="Plana Sığdır (100%)"
                className="px-2 py-1 rounded-xl bg-[#F8FAFC] hover:bg-[#EFF6FF] border border-[#E2E8F0] text-[11px] font-semibold text-[#334155] cursor-pointer"
              >
                ⛶ Sığdır
              </button>
            </div>

            {/* Right: Ölçüleri Göster Toggle + Duvar Ölçüleri Mode Select + CAD Drawer Toggle */}
            <div className="flex items-center gap-2.5">
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  data-testid="plan-toggle-dimensions-checkbox"
                  checked={showPlanDimensions}
                  onChange={(e) => setShowPlanDimensions(e.target.checked)}
                  className="sr-only"
                />
                <span
                  className={`w-8 h-4.5 rounded-full transition relative inline-flex items-center px-0.5 ${
                    showPlanDimensions ? "bg-[#2563EB]" : "bg-[#CBD5E1]"
                  }`}
                >
                  <span
                    className={`w-3.5 h-3.5 rounded-full bg-white shadow-2xs transition-transform ${
                      showPlanDimensions ? "translate-x-3.5" : "translate-x-0"
                    }`}
                  />
                </span>
                <span className="text-[11px] font-semibold text-[#334155]">Ölçüleri Göster</span>
              </label>

              <select
                data-testid="plan-wall-dim-mode-select"
                value={wallDimDisplayMode}
                onChange={(e) =>
                  setWallDimDisplayMode(e.target.value as "net_inner" | "outer" | "plinth")
                }
                className="px-2.5 py-1 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[11px] font-semibold text-[#111827] cursor-pointer"
              >
                <option value="net_inner">Duvar Ölçüleri (Net İç)</option>
                <option value="outer">Dış Duvar Ölçüsü</option>
                <option value="plinth">Kaide / Soket Ölçüsü</option>
              </select>

              <button
                type="button"
                data-testid="plan-toggle-advanced-cad-btn"
                onClick={() => setShowAdvancedCadBar((v) => !v)}
                title="Detaylı CAD & Engel Koordinat Çubuğunu Aç/Kapat"
                className={`px-2 py-1 rounded-xl border text-[11px] font-semibold transition cursor-pointer ${
                  showAdvancedCadBar
                    ? "bg-[#EFF6FF] text-[#1D4ED8] border-[#2563EB]"
                    : "bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#475569] border-[#E2E8F0]"
                }`}
              >
                🛠 CAD
              </button>
            </div>
          </div>

          <svg
            data-testid="v3-cad-plan-svg"
            viewBox={`${vb.x} ${vb.y} ${vb.width} ${vb.height}`}
            className={`w-full h-full ${
              isDrawingWall || isPlacingObstacle ? "cursor-crosshair" : ""
            }`}
            onClick={handleSvgClick}
            onContextMenu={handleSvgContextMenu}
            onMouseDown={(e) => {
              if (e.button === 1 || (e.button === 0 && e.altKey)) {
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
                setPanPx({
                  x: panning2D.startPanX + (e.clientX - panning2D.startClientX),
                  y: panning2D.startPanY + (e.clientY - panning2D.startClientY),
                });
                return;
              }
              handleSvgPointerMove(e);
            }}
            onMouseUp={() => {
              if (panning2D) setPanning2D(null);
              handleSvgPointerUp();
            }}
            onMouseLeave={() => {
              if (panning2D) setPanning2D(null);
              handleSvgPointerUp();
            }}
            style={{
              transform: `translate(${panPx.x}px, ${panPx.y}px) scale(${zoom})`,
              transformOrigin: "center center",
            }}
          >
            <defs>
              <pattern id="v3_cad_grid_sm" width="100" height="100" patternUnits="userSpaceOnUse">
                <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#CCC7BC" strokeWidth="1.2" />
              </pattern>
              <pattern id="v3_cad_grid_lg" width="500" height="500" patternUnits="userSpaceOnUse">
                <rect width="500" height="500" fill="url(#v3_cad_grid_sm)" />
                <path d="M 500 0 L 0 0 0 500" fill="none" stroke="#B5AFA2" strokeWidth="2" />
              </pattern>
              <pattern id="column_hatch" width="20" height="20" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                <line x1="0" y1="0" x2="0" y2="20" stroke="#44403C" strokeWidth="4" />
              </pattern>
            </defs>

            {/* Architectural Grid Background */}
            <rect x={vb.x} y={vb.y} width={vb.width} height={vb.height} fill={showPlanGrid ? "url(#v3_cad_grid_lg)" : "#EDE9E0"} />

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
              const dimY = wall.position.z - wall.thickness - 75;
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
              const pillW = Math.max(300, wallText.length * 24 + 40);
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
                        y={dimY - 30}
                        width={pillW}
                        height={60}
                        rx={12}
                        fill="#FFFFFF"
                        stroke="#2563EB"
                        strokeWidth="3"
                      />
                      <text
                        x={wallMidX}
                        y={dimY + 12}
                        textAnchor="middle"
                        fill="#1C1917"
                        fontSize="38"
                        fontWeight="800"
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
                    <text
                      x={obs.position.x + ow / 2}
                      y={obsY + wallT / 2 + 9}
                      textAnchor="middle"
                      fill={isDoor ? "#92400E" : "#0369A1"}
                      fontSize="26"
                      fontWeight="800"
                      fontFamily="monospace"
                    >
                      {isDoor ? "🚪 KAPI" : "🪟 PENCERE"} ({ow}×{obs.dimensions.height}mm • Y:{obs.position.y})
                    </text>
                    
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
                    <text
                      x={obs.position.x + obs.dimensions.width / 2}
                      y={obs.position.z + obs.dimensions.depth + 36}
                      textAnchor="middle"
                      fill={isSelectedObs ? "#B91C1C" : "#292524"}
                      fontSize="30"
                      fontWeight="800"
                      fontFamily="monospace"
                    >
                      {isBeam ? "KİRİŞ" : "KOLON"} ({obs.dimensions.width}×{obs.dimensions.depth})
                    </text>
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
                    <text
                      x={obs.position.x + obs.dimensions.width / 2}
                      y={boxY + obs.dimensions.depth + 34}
                      textAnchor="middle"
                      fill={isSelectedObs ? "#B91C1C" : "#1E293B"}
                      fontSize="26"
                      fontWeight="800"
                      fontFamily="monospace"
                    >
                      {labelTag} ({obs.dimensions.width}×{obs.dimensions.depth}mm)
                    </text>
                  </g>
                );
              }
              return null;
            })}

            {/* 3. Modules in Top Plan (Respecting 90° L/U Rotations & Wall Clearances) */}
            {footprints.map((fp, idx) => {
              const mod = project.modules[idx];
              const isAct = idx === activeModuleIndex || selectedModuleIds.includes(fp.moduleId);
              const hasCollisionError = errorModuleIds.has(fp.moduleId);
              const mx = fp.x;
              const mz = fp.z;
              const mw = fp.planWidth;
              const md = fp.planDepth;

              const nextFp = footprints[idx + 1];
              const gapRight =
                fp.rotationY === 0
                  ? nextFp && nextFp.rotationY === 0
                    ? nextFp.x - (mx + mw)
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
                              <g className="pointer-events-none">
                                <rect
                                  x={mx + 18}
                                  y={mz + wd + (md - wd) / 2 - 20}
                                  width={Math.min(wd - 36, 220)}
                                  height={40}
                                  rx={8}
                                  fill="#F8FAFC"
                                  stroke="#CBD5E1"
                                  strokeWidth="2"
                                />
                                <text
                                  x={mx + wd / 2}
                                  y={mz + wd + (md - wd) / 2 + 6}
                                  textAnchor="middle"
                                  fill="#334155"
                                  fontSize="22"
                                  fontWeight="800"
                                  fontFamily="monospace"
                                >
                                  {`Z:${md} (D:${wd})`}
                                </text>
                              </g>
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

                    // Standard Rectangular Module Footprint
                    return (
                      <>
                        <rect
                          x={mx}
                          y={mz}
                          width={mw}
                          height={md}
                          rx={6}
                          fill={fillCol}
                          stroke={strokeCol}
                          strokeWidth={strokeW}
                          strokeDasharray={fp.category === "kitchen_wall" ? "10 5" : undefined}
                        />

                        {/* Internal Bay Divider Lines */}
                        {mod &&
                          mod.bays.length > 1 &&
                          mod.bays.slice(0, -1).map((b, bIdx) => {
                            if (fp.rotationY === 90 || fp.rotationY === 270) {
                              const bayZ = mz + ((bIdx + 1) * md) / mod.bays.length;
                              return (
                                <line
                                  key={b.index}
                                  x1={mx}
                                  y1={bayZ}
                                  x2={mx + mw}
                                  y2={bayZ}
                                  stroke={isAct ? "#2563EB" : "#A8A29E"}
                                  strokeWidth="2"
                                  strokeDasharray="8 6"
                                />
                              );
                            }
                            const bayX = mx + ((bIdx + 1) * mw) / mod.bays.length;
                            return (
                              <line
                                key={b.index}
                                x1={bayX}
                                y1={mz}
                                x2={bayX}
                                y2={mz + md}
                                stroke={isAct ? "#2563EB" : "#A8A29E"}
                                strokeWidth="2"
                                strokeDasharray="8 6"
                              />
                            );
                          })}

                        {/* Door Front Direction Line */}
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
                          <line
                            x1={mx + 12}
                            y1={mz + md + 8}
                            x2={mx + mw - 12}
                            y2={mz + md + 8}
                            stroke={isAct ? "#2563EB" : "#78716C"}
                            strokeWidth="4"
                          />
                        )}
                      </>
                    );
                  })()}


                  {/* Unmistakable Selected Module Halo, Ribbon Badge, On-Canvas 90° Rotate Icon & Parametric Edge Resize Handles */}
                  {isAct && (
                    <g>
                      <rect
                        x={mx - 12}
                        y={mz - 12}
                        width={mw + 24}
                        height={md + 24}
                        rx={12}
                        fill="none"
                        stroke="#D97706"
                        strokeWidth="4"
                        strokeDasharray="14 6"
                        className="pointer-events-none"
                      />
                      <rect
                        x={mx + mw / 2 - 140}
                        y={mz - 54}
                        width={280}
                        height={42}
                        rx={10}
                        fill="#B45309"
                        className="pointer-events-none"
                      />
                      <text
                        x={mx + mw / 2}
                        y={mz - 26}
                        textAnchor="middle"
                        fill="#FFFFFF"
                        fontSize="24"
                        fontWeight="900"
                        fontFamily="monospace"
                        className="pointer-events-none"
                      >
                        {`★ SEÇİLİ MODÜL #${idx + 1}`}
                      </text>

                      {/* On-Canvas Clickable -90° (↺) & +90° (↻) Flexible Rotate Gizmo Buttons */}
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
                          cx={mx + mw / 2 - 176}
                          cy={mz - 33}
                          r={26}
                          fill="#D97706"
                          stroke="#FFFFFF"
                          strokeWidth="3.5"
                        />
                        <text
                          x={mx + mw / 2 - 176}
                          y={mz - 25}
                          textAnchor="middle"
                          fill="#FFFFFF"
                          fontSize="22"
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
                          cx={mx + mw / 2 + 176}
                          cy={mz - 33}
                          r={26}
                          fill="#D97706"
                          stroke="#FFFFFF"
                          strokeWidth="3.5"
                        />
                        <text
                          x={mx + mw / 2 + 176}
                          y={mz - 25}
                          textAnchor="middle"
                          fill="#FFFFFF"
                          fontSize="22"
                          fontWeight="900"
                        >
                          ↻
                        </text>
                      </g>

                      {/* Left Edge Resize Handle (◀): Width on 0°/180°, Depth on 90°/270° */}
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
                          x={mx - 22}
                          y={mz + md / 2 - 34}
                          width={36}
                          height={68}
                          rx={9}
                          fill={fp.rotationY === 90 || fp.rotationY === 270 ? "#0284C7" : "#059669"}
                          stroke="#FFFFFF"
                          strokeWidth="3"
                        />
                        <text
                          x={mx - 4}
                          y={mz + md / 2 + 8}
                          textAnchor="middle"
                          fill="#FFFFFF"
                          fontSize="22"
                          fontWeight="900"
                        >
                          ◀
                        </text>
                      </g>

                      {/* Right Edge Resize Handle (▶): Width on 0°/180°, Depth on 90°/270° */}
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
                          x={mx + mw - 14}
                          y={mz + md / 2 - 34}
                          width={36}
                          height={68}
                          rx={9}
                          fill={fp.rotationY === 90 || fp.rotationY === 270 ? "#0284C7" : "#059669"}
                          stroke="#FFFFFF"
                          strokeWidth="3"
                        />
                        <text
                          x={mx + mw + 4}
                          y={mz + md / 2 + 8}
                          textAnchor="middle"
                          fill="#FFFFFF"
                          fontSize="22"
                          fontWeight="900"
                        >
                          ▶
                        </text>
                      </g>

                      {/* Top Edge Resize Handle (▲): Width/Length on 90°/270° vertical cabinets, Depth on 0°/180° */}
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
                          x={mx + mw / 2 - 34}
                          y={mz - 18}
                          width={68}
                          height={32}
                          rx={8}
                          fill={fp.rotationY === 90 || fp.rotationY === 270 ? "#059669" : "#0284C7"}
                          stroke="#FFFFFF"
                          strokeWidth="3"
                        />
                        <text
                          x={mx + mw / 2}
                          y={mz + 5}
                          textAnchor="middle"
                          fill="#FFFFFF"
                          fontSize="20"
                          fontWeight="900"
                        >
                          ▲
                        </text>
                      </g>

                      {/* Bottom Edge Resize Handle (▼): Width/Length on 90°/270° vertical cabinets, Depth on 0°/180° */}
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
                          x={mx + mw / 2 - 34}
                          y={mz + md - 14}
                          width={68}
                          height={32}
                          rx={8}
                          fill={fp.rotationY === 90 || fp.rotationY === 270 ? "#059669" : "#0284C7"}
                          stroke="#FFFFFF"
                          strokeWidth="3"
                        />
                        <text
                          x={mx + mw / 2}
                          y={mz + md + 9}
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

                  {/* Module Name & Dimensions (Positioned cleanly inside the main arm for L-Corner / Diagonal Corner) */}
                  {(() => {
                    const labelCenterY =
                      fp.cornerType === "l_corner" && (fp.rotationY === 0 || fp.rotationY === 90)
                        ? mz + Math.min(fp.wingDepthMm || 580, md) * 0.48
                        : mz + md / 2;
                    const dimLabel = `${fp.rawWidth}×${fp.rawDepth} (H:${fp.rawHeight}) mm`;
                    const innerPillW = Math.min(mw - 16, Math.max(180, dimLabel.length * 19 + 28));
                    return (
                      <g className="pointer-events-none">
                        <text
                          x={mx + mw / 2}
                          y={labelCenterY - 12}
                          textAnchor="middle"
                          fill="#1C1917"
                          fontSize="30"
                          fontWeight="700"
                          fontFamily="sans-serif"
                        >
                          {fp.name} {fp.rotationY > 0 ? `(${fp.rotationY}°)` : ""}
                        </text>
                        <rect
                          x={mx + mw / 2 - innerPillW / 2}
                          y={labelCenterY + 6}
                          width={innerPillW}
                          height={46}
                          rx={10}
                          fill="#FFFFFF"
                          stroke={hasCollisionError ? "#DC2626" : isAct ? "#2563EB" : "#A8A29E"}
                          strokeWidth="2.5"
                          opacity={0.96}
                        />
                        <text
                          x={mx + mw / 2}
                          y={labelCenterY + 39}
                          textAnchor="middle"
                          fill={hasCollisionError ? "#DC2626" : "#1E293B"}
                          fontSize="28"
                          fontWeight="800"
                          fontFamily="monospace"
                        >
                          {dimLabel}
                        </text>
                      </g>
                    );
                  })()}

                  {/* Width Callout with High-Contrast Pill & Architectural Ticks */}
                  {(() => {
                    const calloutY = mz + md + 65;
                    const calloutText = `${mw} mm`;
                    const pillW = Math.max(160, calloutText.length * 24 + 36);
                    return (
                      <g className="pointer-events-none">
                        {/* Extension Ticks */}
                        <line
                          x1={mx}
                          y1={calloutY - 22}
                          x2={mx}
                          y2={calloutY + 22}
                          stroke="#9A3412"
                          strokeWidth="3.5"
                        />
                        <line
                          x1={mx + mw}
                          y1={calloutY - 22}
                          x2={mx + mw}
                          y2={calloutY + 22}
                          stroke="#9A3412"
                          strokeWidth="3.5"
                        />
                        {/* Connecting Line */}
                        <line
                          x1={mx}
                          y1={calloutY}
                          x2={mx + mw}
                          y2={calloutY}
                          stroke="#9A3412"
                          strokeWidth="3.5"
                        />
                        {/* Badge Pill */}
                        <rect
                          x={mx + mw / 2 - pillW / 2}
                          y={calloutY - 27}
                          width={pillW}
                          height={54}
                          rx={12}
                          fill="#FFFFFF"
                          stroke="#9A3412"
                          strokeWidth="3"
                        />
                        <text
                          x={mx + mw / 2}
                          y={calloutY + 12}
                          textAnchor="middle"
                          fill="#7C2D12"
                          fontSize="38"
                          fontWeight="800"
                          fontFamily="monospace"
                        >
                          {calloutText}
                        </text>
                      </g>
                    );
                  })()}

                  {/* Selected Module Alignment Badge (Matches image_da6ae9.jpg: ↔ Merkez Hizala ↔) */}
                  {isAct && showPlanDimensions && (
                    <g data-testid={`plan-mod-alignment-badge-${idx}`} className="pointer-events-none">
                      <rect
                        x={mx + mw / 2 - 150}
                        y={mz + md + 112}
                        width={300}
                        height={44}
                        rx={12}
                        fill="#EFF6FF"
                        stroke="#2563EB"
                        strokeWidth="2.5"
                      />
                      <text
                        x={mx + mw / 2}
                        y={mz + md + 141}
                        textAnchor="middle"
                        fill="#1D4ED8"
                        fontSize="24"
                        fontWeight="800"
                        fontFamily="sans-serif"
                      >
                        {activeSpatialMetrics.alignmentMode === "center"
                          ? "↔ Merkez Hizala ↔"
                          : activeSpatialMetrics.alignmentMode === "left"
                          ? "⬅ Sola Yaslı (0 mm)"
                          : activeSpatialMetrics.alignmentMode === "right"
                          ? "Sağa Yaslı (0 mm) ➡"
                          : `↔ Sol: ${activeSpatialMetrics.leftClearanceMm} • Sağ: ${activeSpatialMetrics.rightClearanceMm}mm`}
                      </text>
                    </g>
                  )}

                  {/* Axis-Aligned Remaining Clearance Callout (Matches image_da6ae9.jpg: Boşluk: 710 mm) */}
                  {showPlanDimensions && gapRight > 15 && (fp.rotationY === 0 || fp.rotationY === 180) && (() => {
                    const gapY = mz + md / 2;
                    const gapText = `Boşluk: ${Math.round(gapRight)} mm`;
                    const gapPillW = Math.max(230, gapText.length * 18 + 36);
                    return (
                      <g data-testid={`plan-mod-clearance-badge-${idx}`} className="pointer-events-none">
                        <line
                          x1={mx + mw}
                          y1={gapY - 18}
                          x2={mx + mw}
                          y2={gapY + 18}
                          stroke="#2563EB"
                          strokeWidth="3.5"
                        />
                        <line
                          x1={mx + mw + gapRight}
                          y1={gapY - 18}
                          x2={mx + mw + gapRight}
                          y2={gapY + 18}
                          stroke="#2563EB"
                          strokeWidth="3.5"
                        />
                        <line
                          x1={mx + mw}
                          y1={gapY}
                          x2={mx + mw + gapRight}
                          y2={gapY}
                          stroke="#2563EB"
                          strokeWidth="3.5"
                          strokeDasharray="10 6"
                        />
                        <rect
                          x={mx + mw + gapRight / 2 - gapPillW / 2}
                          y={gapY - 24}
                          width={gapPillW}
                          height={48}
                          rx={10}
                          fill="#FFFFFF"
                          stroke="#2563EB"
                          strokeWidth="2.5"
                        />
                        <text
                          x={mx + mw + gapRight / 2}
                          y={gapY + 10}
                          textAnchor="middle"
                          fill="#1D4ED8"
                          fontSize="28"
                          fontWeight="800"
                          fontFamily="monospace"
                        >
                          {gapText}
                        </text>
                      </g>
                    );
                  })()}

                  {/* Rotated Side-Wall Module Z-Axis Clearance Callout (Never subtracts from Ana Duvar!) */}
                  {isAct && showPlanDimensions && (fp.rotationY === 90 || fp.rotationY === 270) && activeSpatialMetrics.rightClearanceMm > 15 && (() => {
                    const gapZ = activeSpatialMetrics.rightClearanceMm;
                    const lineX = mx + mw / 2;
                    const gapText = `Yan Duvar Boşluk: ${gapZ} mm`;
                    const gapPillW = Math.max(260, gapText.length * 18 + 36);
                    return (
                      <g data-testid={`plan-mod-side-clearance-badge-${idx}`} className="pointer-events-none">
                        <line
                          x1={lineX}
                          y1={mz + md}
                          x2={lineX}
                          y2={mz + md + gapZ}
                          stroke="#2563EB"
                          strokeWidth="3.5"
                          strokeDasharray="10 6"
                        />
                        <rect
                          x={lineX - gapPillW / 2}
                          y={mz + md + gapZ / 2 - 24}
                          width={gapPillW}
                          height={48}
                          rx={10}
                          fill="#FFFFFF"
                          stroke="#2563EB"
                          strokeWidth="2.5"
                        />
                        <text
                          x={lineX}
                          y={mz + md + gapZ / 2 + 9}
                          textAnchor="middle"
                          fill="#1D4ED8"
                          fontSize="24"
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

            {/* 3B. Room Center Area & Name Badge + Bottom Oda Genişliği Callout (Matches image_da6ae9.jpg) */}
            {showPlanDimensions && (() => {
              const roomCenterX = (mainWall.length || 3600) / 2;
              const roomDepth = activeSpatialMetrics.roomDepthMm || 2700;
              const roomCenterZ = Math.max(1150, Math.round(roomDepth * 0.56));
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
              const badgeText = `📐 ${roomTitle} • ${areaStr} m²`;
              const badgeW = Math.max(460, badgeText.length * 20 + 48);
              const bottomDimZ = Math.max(roomDepth - 90, 1650);
              const bottomDimText = `Oda Genişliği: ${mainWall.length} mm`;
              return (
                <g data-testid="plan-room-area-badge" className="pointer-events-none">
                  {/* Subtle Room Side Boundaries when only 1 wall is explicitly in spaceWalls */}
                  {spaceWalls.length === 1 && (
                    <g opacity={0.45}>
                      <line
                        x1={0}
                        y1={0}
                        x2={0}
                        y2={roomDepth}
                        stroke="#64748B"
                        strokeWidth="6"
                        strokeDasharray="18 10"
                      />
                      <line
                        x1={mainWall.length}
                        y1={0}
                        x2={mainWall.length}
                        y2={roomDepth}
                        stroke="#64748B"
                        strokeWidth="6"
                        strokeDasharray="18 10"
                      />
                    </g>
                  )}
                  <rect
                    x={roomCenterX - badgeW / 2}
                    y={roomCenterZ - 32}
                    width={badgeW}
                    height={64}
                    rx={16}
                    fill="rgba(255, 255, 255, 0.92)"
                    stroke="#CBD5E1"
                    strokeWidth="2.5"
                  />
                  <text
                    x={roomCenterX}
                    y={roomCenterZ + 11}
                    textAnchor="middle"
                    fill="#334155"
                    fontSize="30"
                    fontWeight="700"
                    fontFamily="sans-serif"
                  >
                    {badgeText}
                  </text>

                  {/* Bottom Room Width Callout Line (Oda Genişliği: 3600 mm) */}
                  <line
                    x1={40}
                    y1={bottomDimZ}
                    x2={mainWall.length - 40}
                    y2={bottomDimZ}
                    stroke="#94A3B8"
                    strokeWidth="2.5"
                  />
                  <rect
                    x={roomCenterX - 210}
                    y={bottomDimZ - 24}
                    width={420}
                    height={48}
                    rx={10}
                    fill="rgba(255, 255, 255, 0.9)"
                    stroke="#CBD5E1"
                    strokeWidth="2"
                  />
                  <text
                    x={roomCenterX}
                    y={bottomDimZ + 9}
                    textAnchor="middle"
                    fill="#475569"
                    fontSize="26"
                    fontWeight="700"
                    fontFamily="monospace"
                  >
                    {bottomDimText}
                  </text>
                </g>
              );
            })()}

                        {/* 4. Live Magnetic Snap Lines during Existing Module Drag in 2D Plan */}
            {draggingModIdx !== null && (
              <g data-testid="plan-existing-mod-snap-guides" className="pointer-events-none">
                {[0, ...footprints.flatMap((f, i) => (i === draggingModIdx ? [] : [f.x, f.x + f.planWidth]))].map(
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
                      {/* Bay dividers & architectural door swing arcs */}
                      {Array.from({ length: bayCnt }).map((_, bIdx) => {
                        const bw = gw / bayCnt;
                        const bx = gx + bIdx * bw;
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
                            {/* Architectural 90° Door Swing Silhouette Arc */}
                            <line
                              x1={bx + 6}
                              y1={gz + gd}
                              x2={bx + 6}
                              y2={gz + gd + bw * 0.85}
                              stroke={strokeCol}
                              strokeWidth="4"
                            />
                            <path
                              d={`M ${bx + bw - 6} ${gz + gd} A ${bw * 0.85} ${bw * 0.85} 0 0 1 ${bx + 6} ${gz + gd + bw * 0.85}`}
                              fill="none"
                              stroke={strokeCol}
                              strokeWidth="3.5"
                              strokeDasharray="12 6"
                            />
                          </g>
                        );
                      })}
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
    const breakdown = generateModuleGeometry(activeModule, { doorOpenAngleDeg: 0 });
    const data =
      mode === "elevation"
        ? generateElevation2D(breakdown, selectedComponentId || undefined)
        : mode === "plan"
        ? generateTopPlan2D(breakdown, selectedComponentId || undefined)
        : generateCrossSection2D(breakdown, selectedComponentId || undefined);

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
    const computedElevVb =
      mode === "elevation" && showRoomContextInElev
        ? {
            x: -activeModOffX - padX,
            y: breakdown.overall.height + activeModOffY - ceilingH - padY,
            width: maxWallSpanX + padX * 2,
            height: ceilingH + padY * 2,
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
        const rawNextX = Math.max(0, elevDraggingMod.startModX + dxMm);
        const snappedX = magnetEnabled && !e.altKey ? Math.round(rawNextX / 10) * 10 : Math.round(rawNextX);
        const targetMod = project.modules[elevDraggingMod.modIdx];
        if (targetMod) {
          setModulePosition(elevDraggingMod.modIdx, snappedX, targetMod.position.z, 1);
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
        const snappedX = Math.round((interiorDrag.startValueMm + dxMm) / 10) * 10;
        setSubDividerPlacement(
          interiorDrag.bayIdx,
          interiorDrag.targetId,
          { offsetX: snappedX },
          false
        );
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
        commitHistoryTransaction();
      }
      setActiveElevSnap(null);
    };

    // Map component IDs to interior draggable items
    const findInteriorDragTarget = (compId: string) =>
      findDraggableInteriorComponent(activeModule, compId, breakdown.bayWidths);

    // Collect hanging rails for 2D elevation (projection2d filters them out by default)
    const railComponents =
      mode === "elevation"
        ? breakdown.components.filter((c) => c.role === "hanging_rail")
        : [];

    // Filter or show doors in 2D elevation so interior blocks are unobstructed and easy to drag,
    // and exclude `drawer_box` in elevation so it doesn't cover `drawer_front` labels
    const visibleElements = data.elements.filter((el) => {
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
                : "2D Yan Düşey Kesit"}
            </span>
            {mode === "elevation" && (
              <span className="text-xs font-semibold text-stone-800 hidden lg:inline">
                Raf, çekmece, askı ve ara dikmeleri fareyle sürükleyerek veya sağ panelden ölçüyle taşıyabilirsiniz
              </span>
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
                      className="px-1.5 py-0.5 rounded bg-red-100 text-red-900 hover:bg-red-100 text-red-900 text-white font-bold cursor-pointer"
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

              <button
                type="button"
                data-testid="cad-elevation-toggle-room"
                onClick={() => setShowRoomContextInElev((v) => !v)}
                className={`px-3 py-1 rounded-lg border text-xs font-bold transition cursor-pointer ${
                  showRoomContextInElev
                    ? "bg-[#F1F5F9] text-[#111827] border-sky-800 text-white"
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
                  ? "bg-[#F1F5F9] text-[#5C4018] border-amber-800 text-white"
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
            onClick={() => { setZoom(1); setPanPx({ x: 0, y: 0 }); }}
            className="ml-1 text-xs font-semibold text-stone-600 hover:text-stone-900 underline cursor-pointer"
          >
            Sıfırla
          </button>
        </div>

        <svg
          viewBox={`${vb.x} ${vb.y} ${vb.width} ${vb.height}`}
          className="w-full h-full"
          onMouseDown={(e) => {
            if (e.button === 1 || (e.button === 0 && e.altKey)) {
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
              setPanPx({
                x: panning2D.startPanX + (e.clientX - panning2D.startClientX),
                y: panning2D.startPanY + (e.clientY - panning2D.startClientY),
              });
              return;
            }
            handleElevationPointerMove(e);
          }}
          onMouseUp={() => {
            if (panning2D) setPanning2D(null);
            handleElevationPointerUp();
          }}
          onMouseLeave={() => {
            if (panning2D) setPanning2D(null);
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

          <rect x={vb.x} y={vb.y} width={vb.width} height={vb.height} fill="url(#v3_elev_grid)" />

          {/* ROOM WALL ELEVATION BACKDROP, OTHER MODULES & ARCHITECTURAL OBSTACLES (WINDOW, DOOR, PLUMBING, COLUMN, BEAM) */}
          {mode === "elevation" && showRoomContextInElev && (() => {
            const floorSvgY = breakdown.overall.height + activeModOffY;
            const ceilingSvgY = floorSvgY - ceilingH;
            const wallLeftSvgX = -activeModOffX;
            return (
              <g data-testid="cad-elevation-room-context">
                {/* Wall Surface */}
                <rect
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

                {/* Active Module Selection Banner in 2D Elevation */}
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
                        startModX: activeModule.position.x,
                        mmPerPxX: scale.x,
                      });
                    }}
                    className="cursor-grab active:cursor-grabbing"
                  >
                    <rect
                      x={breakdown.overall.width / 2 - 220}
                      y={-125}
                      width={440}
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
                      {`★ SEÇİLİ #${activeModuleIndex + 1}: ${activeModule.name} (✋ Taşı)`}
                    </text>
                  </g>
                </g>

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
                          startModX: m.position.x,
                          mmPerPxX: scale.x,
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
                  e.stopPropagation();
                  setSelectedComponentId(el.id);
                  if (dragMeta) {
                    beginHistoryTransaction();
                    setActiveBayIndex(dragMeta.bayIdx);
                    setInteriorDrag({
                      kind: dragMeta.kind,
                      bayIdx: dragMeta.bayIdx,
                      targetId: dragMeta.targetId,
                      startClientX: e.clientX,
                      startClientY: e.clientY,
                      startValueMm: dragMeta.startVal,
                      itemHeightMm: dragMeta.itemHeightMm,
                    });
                  }
                }}
                className={
                  dragMeta
                    ? dragMeta.kind === "divider" || dragMeta.kind === "sub_divider"
                      ? "cursor-ew-resize"
                      : "cursor-ns-resize"
                    : "cursor-pointer"
                }
              >
                {/* Invisible wider hit target for thin shelves & dividers so dragging is effortless */}
                {dragMeta && (
                  <rect
                    x={el.x - (isDivider || isSubDivider ? 24 : 0)}
                    y={el.y - (isShelf ? 24 : 0)}
                    width={Math.max(1, el.width + (isDivider || isSubDivider ? 48 : 0))}
                    height={Math.max(1, el.height + (isShelf ? 48 : 0))}
                    fill="transparent"
                  />
                )}

                <rect
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
                        ? `↔ Raf Dikme (X:${dragMeta?.startVal ?? 0})`
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
          {data.dimensionLines.map((dim) => {
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
          {mode === "elevation" && (
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
