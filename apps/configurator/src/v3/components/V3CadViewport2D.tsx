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
      setModulePosition,
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
      beginHistoryTransaction,
      commitHistoryTransaction,
      undo,
      redo,
    } = useV3Adapter();

    const [zoom, setZoom] = useState(1);
    const [showDoorsIn2D, setShowDoorsIn2D] = useState(false);
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
    const [newObstacleW, setNewObstacleW] = useState<number>(300);
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
    }>({
      x: 0,
      z: 0,
      startModX: 0,
      startModZ: 0,
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
        } else if (project.modules.length > 1) {
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
        } else if (project.modules.length > 1) {
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
      const vb = {
        x: -pad,
        y: -pad,
        width: totalModExtentX + pad * 2,
        height: maxDepthZ + pad * 2,
      };

      const clientToSvgRawMm = (svgEl: SVGSVGElement, clientX: number, clientY: number) => {
        const rect = svgEl.getBoundingClientRect();
        const relX = (clientX - rect.left) / Math.max(1, rect.width);
        const relY = (clientY - rect.top) / Math.max(1, rect.height);
        return {
          x: vb.x + relX * vb.width,
          z: vb.y + relY * vb.height,
        };
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
        };
        const isHighBeam = newObstacleType === "beam";
        const isWin = newObstacleType === "window";
        return {
          type: newObstacleType,
          name: `${typeLabels[newObstacleType]} (${newObstacleW}mm)`,
          position: {
            x: Math.max(0, Math.round(posX)),
            y: isHighBeam ? (project.space.ceilingHeight || 2600) - 300 : isWin ? 1050 : 0,
            z: Math.max(0, Math.round(posZ)),
          },
          dimensions: {
            width: Math.max(100, Math.round(newObstacleW)),
            height: isHighBeam ? 300 : isWin ? 1100 : 2200,
            depth: newObstacleType === "column" || newObstacleType === "beam" ? 300 : 150,
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
        beginHistoryTransaction();
        setDraggingModIdx(idx);
        setDragStartClient({
          x: e.clientX,
          z: e.clientY,
          startModX: project.modules[idx]?.position.x || 0,
          startModZ: project.modules[idx]?.position.z || 0,
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
        if (draggingWallId) {
          const rect = svgEl.getBoundingClientRect();
          const mmPerPx = vb.width / Math.max(1, rect.width * zoom);
          const dxMm = (e.clientX - wallDragStart.clientX) * mmPerPx;
          const dzMm = (e.clientY - wallDragStart.clientY) * mmPerPx;
          const nextX = Math.round((wallDragStart.startX + dxMm) / 50) * 50;
          const nextZ = Math.round((wallDragStart.startZ + dzMm) / 50) * 50;
          updateWallSegment(draggingWallId, { position: { x: nextX, z: nextZ } });
          return;
        }
        if (draggingObsId) {
          const rect = svgEl.getBoundingClientRect();
          const mmPerPx = vb.width / Math.max(1, rect.width * zoom);
          const dxMm = (e.clientX - obsDragStart.clientX) * mmPerPx;
          const dzMm = (e.clientY - obsDragStart.clientY) * mmPerPx;
          const nextX = Math.max(0, Math.round((obsDragStart.startX + dxMm) / 50) * 50);
          const nextZ = Math.max(0, Math.round((obsDragStart.startZ + dzMm) / 50) * 50);
          updateObstaclePosition(draggingObsId, nextX, nextZ);
          return;
        }
        if (draggingModIdx === null) return;
        const rect = svgEl.getBoundingClientRect();
        const mmPerPx = vb.width / Math.max(1, rect.width * zoom);
        const dxMm = (e.clientX - dragStartClient.x) * mmPerPx;
        const dzMm = (e.clientY - dragStartClient.z) * mmPerPx;
        const nextX = Math.max(0, dragStartClient.startModX + dxMm);
        const nextZ = Math.max(0, dragStartClient.startModZ + dzMm);
        setModulePosition(draggingModIdx, nextX, nextZ, snapMm);
      };

      const handleSvgPointerUp = () => {
        if (draggingWallId !== null) {
          setDraggingWallId(null);
          commitHistoryTransaction();
        }
        if (draggingObsId !== null) {
          setDraggingObsId(null);
          commitHistoryTransaction();
        }
        if (draggingModIdx !== null) {
          setDraggingModIdx(null);
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

      return (
        <div
          data-testid="v3-cad-plan-interactive"
          className="relative w-full h-full bg-[#E2DED5] overflow-hidden select-none flex flex-col"
        >
          {/* Bottom Room, Wall, Obstacle, Freehand Wall & DWG/DXF/PDF Floorplan Bar */}
          <div
            data-testid="plan-room-architecture-bar"
            className="absolute bottom-14 left-4 right-4 z-10 flex flex-wrap items-center gap-2 bg-white/95 backdrop-blur-md px-3 py-2 rounded-xl border border-stone-200 shadow-xs text-[11px] text-stone-700"
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
                  className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer"
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

            {/* 3. Architectural Obstacle Adder + Target Wall / X-Z / Click-on-Map Placement */}
            <div className="flex items-center gap-1.5 pr-2 border-r border-stone-200">
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
              <input
                data-testid="plan-obstacle-width-input"
                type="number"
                step={50}
                value={newObstacleW}
                onChange={(e) => setNewObstacleW(Number(e.target.value) || 250)}
                className="w-14 px-1.5 py-0.5 rounded border border-stone-300 font-mono text-[11px]"
                title="Engel genişliği (mm)"
              />
              <button
                type="button"
                data-testid="plan-add-obstacle-btn"
                onClick={handleAddObstacleClick}
                className="px-2 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 font-semibold cursor-pointer"
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
                    ? "bg-sky-600 text-white"
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
                      className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer"
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
                    className="px-2 py-0.5 rounded bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] cursor-pointer"
                    title="Seçili objeyi sil (Delete / Backspace)"
                  >
                    🗑 Seçiliyi Sil (Del)
                  </button>
                </div>
              )}

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

          {/* Legend & Zoom Pill */}
          <div className="absolute bottom-4 left-4 z-10 flex items-center gap-3 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-stone-200 shadow-xs text-[11px] text-stone-600">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs bg-sky-200 border border-sky-600 inline-block" />
              Pencere / Tesisat
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs bg-stone-400 border border-stone-700 inline-block" />
              Kolon / Duvar
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs bg-red-100 border border-red-600 inline-block" />
              Çakışma Uyarısı
            </span>
          </div>

          <div className="absolute bottom-4 right-4 z-10 flex items-center gap-1.5 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-stone-200 shadow-xs text-xs text-stone-700">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.15).toFixed(2)))}
              className="px-2 py-0.5 rounded bg-stone-100 hover:bg-stone-200 font-mono font-bold cursor-pointer"
            >
              −
            </button>
            <span className="font-mono text-[11px] min-w-[46px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(2.2, +(z + 0.15).toFixed(2)))}
              className="px-2 py-0.5 rounded bg-stone-100 hover:bg-stone-200 font-mono font-bold cursor-pointer"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="ml-1 text-[11px] text-stone-500 hover:text-stone-900 underline cursor-pointer"
            >
              Sıfırla
            </button>
          </div>

          <svg
            data-testid="v3-cad-plan-svg"
            viewBox={`${vb.x} ${vb.y} ${vb.width} ${vb.height}`}
            className={`w-full h-full ${
              isDrawingWall || isPlacingObstacle ? "cursor-crosshair" : ""
            }`}
            onClick={handleSvgClick}
            onContextMenu={handleSvgContextMenu}
            onMouseMove={handleSvgPointerMove}
            onMouseUp={handleSvgPointerUp}
            onMouseLeave={handleSvgPointerUp}
            style={{
              transform: `scale(${zoom})`,
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
            <rect x={vb.x} y={vb.y} width={vb.width} height={vb.height} fill="url(#v3_cad_grid_lg)" />

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
                  </g>
                );
              }
              const wallMidX = wall.position.x + wall.length / 2;
              const dimY = wall.position.z - wall.thickness - 75;
              const wallText = `${wall.name}: ${wall.length} mm`;
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
                  {/* High-Contrast Dimension Pill */}
                  <rect
                    x={wallMidX - pillW / 2}
                    y={dimY - 30}
                    width={pillW}
                    height={60}
                    rx={12}
                    fill="#FFFFFF"
                    stroke="#44403C"
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
            {isDrawingWall && activeSnapTarget && (
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
                const obsY = obs.position.z > 0 ? obs.position.z : -mainWall.thickness + 20;
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
                      y={obsY}
                      width={obs.dimensions.width}
                      height={mainWall.thickness - 40}
                      fill={isDoor ? "#FDE68A" : "#BAE6FD"}
                      stroke={isSelectedObs ? "#DC2626" : isDoor ? "#D97706" : "#0284C7"}
                      strokeWidth={isSelectedObs ? "6" : "3"}
                    />
                    <text
                      x={obs.position.x + obs.dimensions.width / 2}
                      y={obsY + (mainWall.thickness - 40) / 2 + 9}
                      textAnchor="middle"
                      fill={isDoor ? "#92400E" : "#0369A1"}
                      fontSize="28"
                      fontWeight="800"
                      fontFamily="monospace"
                    >
                      {isDoor ? "KAPI" : "PENCERE"} ({obs.dimensions.width}mm)
                    </text>
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
              if (obs.type === "plumbing") {
                const cx = obs.position.x + obs.dimensions.width / 2;
                const cy = obs.position.z > 0 ? obs.position.z : -28;
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
                      fill="#E0F2FE"
                      stroke={isSelectedObs ? "#DC2626" : "#0284C7"}
                      strokeWidth={isSelectedObs ? "6" : "3"}
                    />
                    <text
                      x={cx}
                      y={cy + 8}
                      textAnchor="middle"
                      fill="#0369A1"
                      fontSize="22"
                      fontWeight="800"
                      fontFamily="monospace"
                    >
                      SU
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
                  {/* Module Oriented Footprint */}
                  <rect
                    x={mx}
                    y={mz}
                    width={mw}
                    height={md}
                    rx={6}
                    fill={
                      hasCollisionError
                        ? "#FEE2E2"
                        : isAct
                        ? "#FEF3C7"
                        : fp.category === "kitchen_wall"
                        ? "#F5F5F4"
                        : "#FFFFFF"
                    }
                    stroke={
                      hasCollisionError
                        ? "#DC2626"
                        : isAct
                        ? "#B86B2B"
                        : "#292524"
                    }
                    strokeWidth={isAct || hasCollisionError ? 6 : 3.5}
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
                            stroke={isAct ? "#D97706" : "#A8A29E"}
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
                          stroke={isAct ? "#D97706" : "#A8A29E"}
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
                      stroke={isAct ? "#B86B2B" : "#78716C"}
                      strokeWidth="4"
                    />
                  ) : fp.rotationY === 270 ? (
                    <line
                      x1={mx - 8}
                      y1={mz + 12}
                      x2={mx - 8}
                      y2={mz + md - 12}
                      stroke={isAct ? "#B86B2B" : "#78716C"}
                      strokeWidth="4"
                    />
                  ) : (
                    <line
                      x1={mx + 12}
                      y1={mz + md + 8}
                      x2={mx + mw - 12}
                      y2={mz + md + 8}
                      stroke={isAct ? "#B86B2B" : "#78716C"}
                      strokeWidth="4"
                    />
                  )}

                  {/* Module Name & Dimensions */}
                  <text
                    x={mx + mw / 2}
                    y={mz + md / 2 - 12}
                    textAnchor="middle"
                    fill="#1C1917"
                    fontSize="32"
                    fontWeight="700"
                    fontFamily="sans-serif"
                  >
                    {fp.name} {fp.rotationY > 0 ? `(${fp.rotationY}°)` : ""}
                  </text>

                  {/* Inner Module Dimensions Pill */}
                  {(() => {
                    const dimLabel = `${fp.rawWidth} × ${fp.rawDepth} mm`;
                    const innerPillW = Math.min(mw - 16, Math.max(180, dimLabel.length * 19 + 28));
                    return (
                      <g className="pointer-events-none">
                        <rect
                          x={mx + mw / 2 - innerPillW / 2}
                          y={mz + md / 2 + 6}
                          width={innerPillW}
                          height={46}
                          rx={10}
                          fill="#FFFFFF"
                          stroke={hasCollisionError ? "#DC2626" : isAct ? "#B86B2B" : "#A8A29E"}
                          strokeWidth="2.5"
                          opacity={0.96}
                        />
                        <text
                          x={mx + mw / 2}
                          y={mz + md / 2 + 39}
                          textAnchor="middle"
                          fill={hasCollisionError ? "#DC2626" : "#7C2D12"}
                          fontSize="30"
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

                  {/* Smart Remaining Clearance Callout */}
                  {gapRight > 20 && (() => {
                    const gapY = mz + md / 2;
                    const gapText = `Boşluk: ${Math.round(gapRight)} mm`;
                    const gapPillW = Math.max(220, gapText.length * 18 + 36);
                    return (
                      <g className="pointer-events-none">
                        <line
                          x1={mx + mw}
                          y1={gapY - 18}
                          x2={mx + mw}
                          y2={gapY + 18}
                          stroke="#0284C7"
                          strokeWidth="3.5"
                        />
                        <line
                          x1={mx + mw + gapRight}
                          y1={gapY - 18}
                          x2={mx + mw + gapRight}
                          y2={gapY + 18}
                          stroke="#0284C7"
                          strokeWidth="3.5"
                        />
                        <line
                          x1={mx + mw}
                          y1={gapY}
                          x2={mx + mw + gapRight}
                          y2={gapY}
                          stroke="#0284C7"
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
                          stroke="#0284C7"
                          strokeWidth="2.5"
                        />
                        <text
                          x={mx + mw + gapRight / 2}
                          y={gapY + 10}
                          textAnchor="middle"
                          fill="#0369A1"
                          fontSize="28"
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

    const padX = mode === "elevation" ? 340 : 260;
    const padY = mode === "elevation" ? 280 : 220;
    const vb = {
      x: -padX,
      y: -padY,
      width: data.viewBox.width - 300 + padX * 2,
      height: data.viewBox.height - 300 + padY * 2,
    };

    const handleElevationPointerMove = (e: React.MouseEvent<SVGSVGElement>) => {
      if (!interiorDrag) return;
      const svgEl = e.currentTarget;
      const rect = svgEl.getBoundingClientRect();
      const mmPerPxY = vb.height / Math.max(1, rect.height * zoom);
      const mmPerPxX = vb.width / Math.max(1, rect.width * zoom);

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
      if (interiorDrag) {
        setInteriorDrag(null);
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
        if (!showDoorsIn2D && el.role.startsWith("door")) return false;
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

    return (
      <div
        data-testid={`v3-cad-${mode}`}
        className="relative w-full h-full bg-[#E2DED5] overflow-hidden select-none flex flex-col"
      >
        {/* Top Header Bar (Non-overlapping with SVG drawing!) */}
        <div className="h-11 px-4 bg-[#D8D3C8] border-b border-stone-300 flex flex-wrap items-center justify-between gap-2 shrink-0 z-10">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-stone-900 text-white text-xs font-bold">
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
            <button
              type="button"
              data-testid="cad-elevation-toggle-doors"
              onClick={() => setShowDoorsIn2D((v) => !v)}
              className={`px-3 py-1 rounded-lg border text-xs font-bold transition cursor-pointer ${
                showDoorsIn2D
                  ? "bg-amber-700 border-amber-800 text-white"
                  : "bg-white hover:bg-stone-100 border-stone-300 text-stone-800"
              }`}
            >
              {showDoorsIn2D ? "Kapakları Gizle (İç Düzen)" : "Kapak Çizgisini Göster"}
            </button>
          )}
        </div>

        {/* Bottom-Right Zoom Pill */}
        <div className="absolute bottom-4 right-4 z-10 flex items-center gap-1.5 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-stone-300 shadow-xs text-xs text-stone-800">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.15).toFixed(2)))}
            className="px-2 py-0.5 rounded bg-stone-100 hover:bg-stone-200 font-mono font-bold cursor-pointer"
          >
            −
          </button>
          <span className="font-mono text-xs font-bold min-w-[48px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(2.2, +(z + 0.15).toFixed(2)))}
            className="px-2 py-0.5 rounded bg-stone-100 hover:bg-stone-200 font-mono font-bold cursor-pointer"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="ml-1 text-xs font-semibold text-stone-600 hover:text-stone-900 underline cursor-pointer"
          >
            Sıfırla
          </button>
        </div>

        <svg
          viewBox={`${vb.x} ${vb.y} ${vb.width} ${vb.height}`}
          className="w-full h-full"
          onMouseMove={handleElevationPointerMove}
          onMouseUp={handleElevationPointerUp}
          onMouseLeave={handleElevationPointerUp}
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: "center center",
          }}
        >
          <defs>
            <pattern id="v3_elev_grid" width="100" height="100" patternUnits="userSpaceOnUse">
              <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#CCC7BC" strokeWidth="1.4" />
            </pattern>
          </defs>

          <rect x={vb.x} y={vb.y} width={vb.width} height={vb.height} fill="url(#v3_elev_grid)" />

          {/* Render 2D Elements (Carcass, Dividers, Shelves, Drawers) */}
          {visibleElements.map((el) => {
            const isSelected = el.isSelected;
            const isDoor = el.role.startsWith("door");
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
                  stroke="#1E293B"
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
        </svg>
      </div>
    );
  }
);

V3CadViewport2D.displayName = "V3CadViewport2D";
export default V3CadViewport2D;
