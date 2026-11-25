"use client";

import React from "react";
import { ArchitecturalElement, parseCadDxfText, parsePdfFloorPlanMetadata } from "@birim/core";
import { CadContextMenu2D, type CadContextMenuState } from "../workspace/CadContextMenu2D";
import { getActiveDraggedTemplateId, setActiveDraggedTemplateId, computeRowSnapPreview } from "../../adapter/useV3Adapter";
import { solveAngledWallSnapForModule } from "../../engine/angledWallSnapEngine";
import { CadPlan2DChromeOverlays } from "./CadPlan2DChromeOverlays";
import { CadPlan2DSvgCanvas } from "./CadPlan2DSvgCanvas";



import type { CadInteractivePlan2DViewProps } from "./cad2dTypes";
export type { CadInteractivePlan2DViewProps };

export const CadInteractivePlan2DView: React.FC<CadInteractivePlan2DViewProps> = (props) => {
  const {
    activeModuleIndex,
    activePlanSnapX,
    activeSnapTarget,
    activeSpatialAlertIdx,
    activeSpatialMetrics,
    addAdjacentModule,
    addSpaceObstacle,
    addStackedTopModule,
    addWallSegment,
    batchMoveSelectedModules,
    beginHistoryTransaction,
    cadContextMenu,
    cadDrawerTab,
    cadTextScale,
    chainOriginPoint,
    clearModuleSelection,
    commitHistoryTransaction,
    dragGhostPreview,
    dragStartClient,
    draggingModIdx,
    draggingObsId,
    draggingSceneObjId,
    draggingWallId,
    drawWallCursor,
    drawWallStart,
    dropV4TemplateWithSnap,
    duplicateActiveModule,
    duplicateSceneObject,
    elevDisplayUnit,
    errorModuleIds,
    floorPlanInputRef,
    fmtPlanDim,
    footprints,
    handleChangeElevDisplayUnit,
    handleDeleteSelectedObject,
    handleWheelZoom,
    importWallsFromUnderlay,
    inlineEditWallId,
    inlineEditWallLength,
    isDrawingWall,
    isPlacingObstacle,
    lastPointerMoveTsRef,
    liveObsSnappedRotRef,
    liveSpatialAlerts,
    lockedPlanVbRef,
    longPress2DRef,
    magnetEnabled,
    moduleCadMetrics,
    newObstacleH,
    newObstacleRotY,
    newObstacleType,
    newObstacleW,
    newObstacleX,
    newObstacleY,
    newObstacleZ,
    obsDragStart,
    obstaclePreviewPos,
    obstacleTargetWallId,
    panPx,
    panPxRef,
    panning2D,
    pinchTrackerRef,
    planLiveSvgDragRef,
    planRowSnapBanner,
    planScaleRatio,
    planSnapBannerTextRef,
    planSnapBannerWrapRef,
    printActive2DCadSheet,
    project,
    redo,
    removeActiveModule,
    removeSceneObject,
    removeSpaceObstacle,
    removeWallSegment,
    resizeModuleParametric,
    resizingPlanObject,
    rotateActiveModule90,
    sceneObjDragStart,
    selectAllModules,
    selectedModuleIds,
    selectedPlanObject,
    selectedSceneObjectId,
    setActiveModuleIndex,
    setActivePlanSnapX,
    setActiveSnapTarget,
    setActiveSpatialAlertIdx,
    setCadContextMenu,
    setCadDrawerTab,
    setChainOriginPoint,
    setDragGhostPreview,
    setDragStartClient,
    setDraggingModIdx,
    setDraggingObsId,
    setDraggingSceneObjId,
    setDraggingWallId,
    setDrawWallCursor,
    setDrawWallStart,
    setFloorPlanUnderlay,
    setInlineEditWallId,
    setInlineEditWallLength,
    setIsDrawingWall,
    setIsPlacingObstacle,
    setMagnetEnabled,
    setModulePosition,
    setNewObstacleH,
    setNewObstacleRotY,
    setNewObstacleType,
    setNewObstacleW,
    setNewObstacleX,
    setNewObstacleY,
    setNewObstacleZ,
    setObsDragStart,
    setObstaclePreviewPos,
    setObstacleTargetWallId,
    setPanPx,
    setPanning2D,
    setPlanRowSnapBanner,
    setPlanScaleRatio,
    setResizingPlanObject,
    setRoomDimensions,
    setSceneObjDragStart,
    setSelectedPlanObject,
    setSelectedSceneObjectId,
    setShowAdvancedCadBar,
    setShowPlanDimensions,
    setShowWallCoordsInPill,
    setSpatialAlertsMinimized,
    setStoreActiveWallId,
    setWallDimDisplayMode,
    setWallDragStart,
    setZoom,
    showAdvancedCadBar,
    showPlanDimensions,
    showPlanGrid,
    showWallCoordsInPill,
    snapModuleToAngledWall,
    spaceObstacles,
    spaceWalls,
    spatialAlertsMinimized,
    storeActiveWallId,
    swapModuleWithNeighbor,
    toggleModuleSelection,
    undo,
    updateObstaclePosition,
    updateSceneObject,
    updateSpaceObstacle,
    updateWallSegment,
    wallDimDisplayMode,
    wallDragStart,
    wallSnapCandidates,
    zoom,
    zoomRef,
  } = props;
      const mainWall = spaceWalls[0] || {
        id: "wall_main",
        length: 3600,
        thickness: 150,
        name: "Ana Duvar",
        position: { x: 0, y: 0, z: 0 },
        rotationY: 0,
      };
      const underlay = project.space.floorPlanUnderlay;
      const minPlanX = Math.min(
        0,
        ...spaceWalls.map((w) => w.position.x),
        ...footprints.map((fp) => fp.x),
        ...spaceObstacles.map((o) => o.position.x),
        ...(project.sceneObjects || []).map((s) => s.position.x)
      );
      const minPlanZ = Math.min(
        0,
        ...spaceWalls.map((w) => w.position.z),
        ...footprints.map((fp) => fp.z),
        ...spaceObstacles.map((o) => o.position.z),
        ...(project.sceneObjects || []).map((s) => s.position.z)
      );
      const totalModExtentX = Math.max(
        mainWall.length + 300,
        underlay?.widthMm || 0,
        ...spaceWalls.map((w) => w.position.x + w.length + 300),
        ...footprints.map((fp) => fp.x + fp.planWidth + 300),
        ...spaceObstacles.map((o) => o.position.x + Math.max(o.dimensions.width || 300, o.dimensions.depth || 300) + 300),
        ...(project.sceneObjects || []).map((s) => s.position.x + s.dimensions.width + 300)
      );
      const maxDepthZ = Math.max(
        1800,
        underlay?.depthMm || 0,
        ...spaceWalls.map((w) => w.position.z + w.length * 0.6 + 450),
        ...footprints.map((fp) => fp.z + fp.planDepth + 520),
        ...spaceObstacles.map((o) => o.position.z + Math.max(o.dimensions.depth || 300, o.dimensions.width || 300) + 520),
        ...(project.sceneObjects || []).map((s) => s.position.z + s.dimensions.depth + 520)
      );

      const padX = 420;
      const padTop = 420;
      const padBottom = 440;
      const computedVb = {
        x: minPlanX - padX,
        y: minPlanZ - padTop,
        width: totalModExtentX - minPlanX + padX * 2,
        height: maxDepthZ - minPlanZ + padTop + padBottom,
      };
      const isAnyPlanDragActive =
        draggingModIdx !== null ||
        draggingObsId !== null ||
        draggingWallId !== null ||
        draggingSceneObjId !== null ||
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

      const selectWallAndSyncObstacleTarget = (wallId: string) => {
        setSelectedPlanObject({ kind: "wall", id: wallId });
        setObstacleTargetWallId(wallId);
        setStoreActiveWallId(wallId);
        const wObj = spaceWalls.find((w) => w.id === wallId);
        if (wObj) {
          const wRot = (((wObj.rotationY || 0) % 360) + 360) % 360;
          setNewObstacleRotY(wRot);
          const maxOff = Math.max(0, wObj.length - newObstacleW);
          setNewObstacleX((prev) => Math.max(0, Math.min(maxOff, prev)));
        }
      };

      const resolveWallPlacementAlongTarget = (
        targetWall: (typeof spaceWalls)[number],
        obsW: number,
        preferredOffsetMm?: number
      ) => {
        const wallRot = (((targetWall.rotationY || 0) % 360) + 360) % 360;
        const rad = (wallRot * Math.PI) / 180;
        const dirX = Math.cos(rad);
        const dirZ = Math.sin(rad);
        const maxStart = Math.max(0, targetWall.length - obsW);

        const sameWallIntervals: Array<[number, number]> = [];
        for (const ex of spaceObstacles) {
          const exRot = (((ex.rotationY || 0) % 360) + 360) % 360;
          const rotDiff = Math.min(Math.abs(exRot - wallRot), 360 - Math.abs(exRot - wallRot));
          if (rotDiff > 12) continue;
          const relX = ex.position.x - targetWall.position.x;
          const relZ = ex.position.z - targetWall.position.z;
          const along = relX * dirX + relZ * dirZ;
          const perp = Math.abs(-relX * dirZ + relZ * dirX);
          if (perp <= 220 && along >= -120 && along <= targetWall.length + 120) {
            sameWallIntervals.push([along, along + (ex.dimensions.width || 300)]);
          }
        }
        sameWallIntervals.sort((a, b) => a[0] - b[0]);

        const overlaps = (cand: number) =>
          sameWallIntervals.some(([s, e]) => cand < e + 40 && cand + obsW > s - 40);

        let chosenOffset =
          typeof preferredOffsetMm === "number"
            ? Math.max(0, Math.min(maxStart, preferredOffsetMm))
            : Math.min(maxStart, Math.max(150, Math.round((targetWall.length - obsW) * 0.35)));

        if (overlaps(chosenOffset)) {
          let cursor = 120;
          for (const [s, e] of sameWallIntervals) {
            if (cursor + obsW + 40 <= s) break;
            cursor = Math.max(cursor, e + 100);
          }
          chosenOffset = Math.max(0, Math.min(maxStart, Math.round(cursor / 50) * 50));
        }

        const nextSuggestedOffset = Math.max(
          0,
          Math.min(maxStart, Math.round((chosenOffset + obsW + 120) / 50) * 50)
        );

        return {
          x: Math.round(targetWall.position.x + dirX * chosenOffset),
          z: Math.round(targetWall.position.z + dirZ * chosenOffset),
          rotationY: wallRot,
          chosenOffset,
          nextSuggestedOffset,
        };
      };

      const snapObstaclePointToClosestWall = (
        rawX: number,
        rawZ: number,
        obsW: number,
        maxPerpDistMm = 320
      ): { x: number; z: number; rotY: number; wallName: string; wallId: string; alongMm: number } | null => {
        let bestScore = maxPerpDistMm;
        let bestHit: { x: number; z: number; rotY: number; wallName: string; wallId: string; alongMm: number } | null = null;
        const preferredWallId =
          selectedPlanObject?.kind === "wall" ? selectedPlanObject.id : obstacleTargetWallId;

        for (const w of spaceWalls) {
          const wRot = (((w.rotationY || 0) % 360) + 360) % 360;
          const rad = (wRot * Math.PI) / 180;
          const dirX = Math.cos(rad);
          const dirZ = Math.sin(rad);
          const relX = rawX - w.position.x;
          const relZ = rawZ - w.position.z;
          const rawAlong = relX * dirX + relZ * dirZ;
          if (rawAlong < -160 || rawAlong > w.length + 160) continue;
          const perp = Math.abs(-relX * dirZ + relZ * dirX);
          const effectiveDist = w.id === preferredWallId ? perp * 0.75 : perp;
          if (effectiveDist <= bestScore) {
            bestScore = effectiveDist;
            const maxStart = Math.max(0, w.length - obsW);
            const snappedAlong = Math.max(0, Math.min(maxStart, Math.round((rawAlong - obsW * 0.5) / 50) * 50));
            bestHit = {
              x: Math.round(w.position.x + dirX * snappedAlong),
              z: Math.round(w.position.z + dirZ * snappedAlong),
              rotY: wRot,
              wallName: w.name,
              wallId: w.id,
              alongMm: snappedAlong,
            };
          }
        }
        return bestHit;
      };

      const buildObstaclePayloadAt = (posX: number, posZ: number, overrideRotY?: number) => {
        const typeLabels: Record<ArchitecturalElement["type"], string> = {
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
        const isHighBeam = newObstacleType === "beam";
        const effRotY = typeof overrideRotY === "number" ? overrideRotY : newObstacleRotY;
        return {
          type: newObstacleType,
          name: typeLabels[newObstacleType as keyof typeof typeLabels] ?? String(newObstacleType),
          rotationY: effRotY,
          doorSwing: "left" as const,
          doorOpenSide: "inward" as const,
          position: {
            x: Math.round(posX),
            y: isHighBeam
              ? (project.space.ceilingHeight || 2600) - 300
              : Math.max(0, Math.round(newObstacleY)),
            z: Math.round(posZ),
          },
          dimensions: {
            width: Math.max(100, Math.round(newObstacleW)),
            height: Math.max(100, Math.round(newObstacleH)),
            depth: newObstacleType === "partition" ? 1200 : newObstacleType === "column" || newObstacleType === "beam" || newObstacleType === "protrusion" ? 280 : 150,
          },
        };
      };

      const setPlanSnapBannerFast = (msg: string | null) => {
        const wrap = planSnapBannerWrapRef.current;
        const txt = planSnapBannerTextRef.current;
        if (wrap && txt) {
          if (msg) {
            txt.textContent = msg;
            wrap.style.display = "flex";
          } else {
            txt.textContent = "";
            wrap.style.display = "none";
          }
        } else {
          setPlanRowSnapBanner(msg);
        }
      };

      const resetPlanLiveSvgTransform = () => {
        const cur = planLiveSvgDragRef.current;
        if (!cur) return;
        if (cur.el) {
          if (cur.baseTransform) cur.el.setAttribute("transform", cur.baseTransform);
          else cur.el.removeAttribute("transform");
        }
        for (const att of cur.attachedEls) {
          if (att.baseTransform) att.el.setAttribute("transform", att.baseTransform);
          else att.el.removeAttribute("transform");
        }
        planLiveSvgDragRef.current = null;
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
        const gEl = e.currentTarget as SVGGElement;
        const svgEl = gEl.closest("svg") as SVGSVGElement | null;
        const fixedMmPerPx = svgEl ? getSvgMmPerPx(svgEl) : vb.width / 800;
        const attachedEls: { el: SVGGElement; baseTransform: string }[] = [];
        if (svgEl && mod) {
          const attachedPrefix = `comp_att_${mod.id}__`;
          project.modules.forEach((m, mIdx) => {
            if (m.category === "complementary" && m.id.startsWith(attachedPrefix)) {
              const attNode = svgEl.querySelector(
                `[data-testid="plan-module-${mIdx}"]`
              ) as SVGGElement | null;
              if (attNode) {
                attachedEls.push({
                  el: attNode,
                  baseTransform: attNode.getAttribute("transform") || "",
                });
              }
            }
          });
        }
        const startX = mod?.position.x || 0;
        const startZ = mod?.position.z || 0;
        document.body.dataset.birimUiDragging = "1";
        beginHistoryTransaction();
        planLiveSvgDragRef.current = {
          el: gEl,
          baseTransform: gEl.getAttribute("transform") || "",
          attachedEls,
          kind: "module",
          modIdx: idx,
          startX,
          startZ,
          nextX: startX,
          nextZ: startZ,
          snapStepMm: 1,
          hasMoved: false,
        };
        setDraggingModIdx(idx);
        setDragStartClient({
          x: e.clientX,
          z: e.clientY,
          startModX: startX,
          startModZ: startZ,
          mmPerPx: fixedMmPerPx,
        });
      };

      const handleObstaclePointerDown = (e: React.MouseEvent, obs: ArchitecturalElement) => {
        if (e.button !== 0 || isDrawingWall || isPlacingObstacle) return;
        e.stopPropagation();
        const gEl = e.currentTarget as SVGGElement;
        setSelectedPlanObject({ kind: "obstacle", id: obs.id });
        document.body.dataset.birimUiDragging = "1";
        beginHistoryTransaction();
        planLiveSvgDragRef.current = {
          el: gEl,
          baseTransform: gEl.getAttribute("transform") || "",
          attachedEls: [],
          kind: "obstacle",
          targetId: obs.id,
          startX: obs.position.x,
          startZ: obs.position.z,
          nextX: obs.position.x,
          nextZ: obs.position.z,
          hasMoved: false,
        };
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
        const gEl = e.currentTarget as SVGGElement;
        selectWallAndSyncObstacleTarget(wall.id);
        document.body.dataset.birimUiDragging = "1";
        beginHistoryTransaction();
        planLiveSvgDragRef.current = {
          el: gEl,
          baseTransform: gEl.getAttribute("transform") || "",
          attachedEls: [],
          kind: "wall",
          targetId: wall.id,
          startX: wall.position.x,
          startZ: wall.position.z,
          nextX: wall.position.x,
          nextZ: wall.position.z,
          hasMoved: false,
        };
        setDraggingWallId(wall.id);
        setWallDragStart({
          clientX: e.clientX,
          clientY: e.clientY,
          startX: wall.position.x,
          startZ: wall.position.z,
        });
      };

      const handleSceneObjectPointerDown = (
        e: React.MouseEvent,
        so: NonNullable<typeof project.sceneObjects>[number]
      ) => {
        if (e.button !== 0 || isDrawingWall || isPlacingObstacle) return;
        e.stopPropagation();
        setSelectedSceneObjectId(so.id);
        if (so.isLocked) return;
        const gEl = e.currentTarget as SVGGElement;
        const svgEl = gEl.closest("svg") as SVGSVGElement | null;
        const fixedMmPerPx = svgEl ? getSvgMmPerPx(svgEl) : vb.width / 800;
        document.body.dataset.birimUiDragging = "1";
        beginHistoryTransaction();
        planLiveSvgDragRef.current = {
          el: gEl,
          baseTransform: gEl.getAttribute("transform") || "",
          attachedEls: [],
          kind: "scene_object",
          targetId: so.id,
          startX: so.position.x,
          startZ: so.position.z,
          nextX: so.position.x,
          nextZ: so.position.z,
          hasMoved: false,
        };
        setDraggingSceneObjId(so.id);
        setSceneObjDragStart({
          clientX: e.clientX,
          clientY: e.clientY,
          startX: so.position.x,
          startZ: so.position.z,
          mmPerPx: fixedMmPerPx,
        });
      };

      const handleWallClick = (e: React.MouseEvent, wallId: string) => {
        if (isDrawingWall || isPlacingObstacle) return;
        e.stopPropagation();
        selectWallAndSyncObstacleTarget(wallId);
      };

      const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
        const rawPt = clientToSvgRawMm(e.currentTarget, e.clientX, e.clientY);

        // Mode A: Click-to-place Obstacle on the 2D Plan (Auto-aligns & rotates onto hovered/selected wall!)
        if (isPlacingObstacle) {
          const wallSnap = magnetEnabled
            ? snapObstaclePointToClosestWall(rawPt.x, rawPt.z, newObstacleW, 380)
            : null;
          const finalX = wallSnap ? wallSnap.x : Math.round(rawPt.x / 50) * 50;
          const finalZ = wallSnap ? wallSnap.z : Math.round(rawPt.z / 50) * 50;
          const finalRotY = wallSnap ? wallSnap.rotY : newObstacleRotY;
          if (wallSnap) {
            setObstacleTargetWallId(wallSnap.wallId);
            setStoreActiveWallId(wallSnap.wallId);
            setNewObstacleRotY(wallSnap.rotY);
          }
          const createdId = addSpaceObstacle(buildObstaclePayloadAt(finalX, finalZ, finalRotY));
          setSelectedPlanObject({ kind: "obstacle", id: createdId });
          setNewObstacleX(wallSnap ? wallSnap.alongMm : finalX);
          setNewObstacleZ(finalZ);
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
          setObstacleTargetWallId(createdWallId);
          setStoreActiveWallId(createdWallId);
          setNewObstacleRotY((angleDeg + 360) % 360);

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

      type PlanContextTarget =
        | { kind: "canvas" }
        | { kind: "module"; modIdx: number }
        | { kind: "wall"; wallId: string; wallName: string; rotationY: number; length: number }
        | { kind: "obstacle"; obsId: string; obsName: string; rotationY: number }
        | { kind: "sceneObject"; soId: string; soName: string; rotationY: number };

      const openPlanContextMenu = (e: React.MouseEvent, target: PlanContextTarget) => {
        e.preventDefault();
        e.stopPropagation();

        if (target.kind === "module") {
          const mod = project.modules[target.modIdx];
          if (!mod) return;
          setActiveModuleIndex(target.modIdx);
          const sections: CadContextMenuState["sections"] = [
            {
              title: "Modül İşlemleri",
              items: [
                {
                  id: "plan-mod-rotate",
                  label: "90° Döndür",
                  shortcut: "R",
                  onClick: () => rotateActiveModule90(target.modIdx),
                },
                {
                  id: "plan-mod-dup",
                  label: "Modülü Çoğalt",
                  onClick: () => {
                    setActiveModuleIndex(target.modIdx);
                    duplicateActiveModule();
                  },
                },
                {
                  id: "plan-mod-adj",
                  label: "Yanına Modül Ekle",
                  onClick: () => {
                    setActiveModuleIndex(target.modIdx);
                    addAdjacentModule();
                  },
                },
                {
                  id: "plan-mod-top",
                  label: "Üstüne Modül Ekle",
                  onClick: () => {
                    setActiveModuleIndex(target.modIdx);
                    addStackedTopModule();
                  },
                },
              ],
            },
          ];
          if (project.modules.length > 1) {
            sections.push({
              title: "Sıra & Konum",
              items: [
                {
                  id: "plan-mod-swap-left",
                  label: "Sola Kaydır (Takas)",
                  disabled: target.modIdx === 0,
                  onClick: () => swapModuleWithNeighbor(target.modIdx, "left"),
                },
                {
                  id: "plan-mod-swap-right",
                  label: "Sağa Kaydır (Takas)",
                  disabled: target.modIdx >= project.modules.length - 1,
                  onClick: () => swapModuleWithNeighbor(target.modIdx, "right"),
                },
              ],
            });
          }
          sections.push({
            items: [
              {
                id: "plan-mod-delete",
                label: "Modülü Sil",
                shortcut: "Del",
                danger: true,
                onClick: () => {
                  setActiveModuleIndex(target.modIdx);
                  removeActiveModule();
                },
              },
            ],
          });
          setCadContextMenu({
            x: e.clientX,
            y: e.clientY,
            headerTitle: mod.name || `Modül ${target.modIdx + 1}`,
            headerSubtitle: `${fmtPlanDim(mod.dimensions.width, false)}×${fmtPlanDim(mod.dimensions.depth, false)}×${fmtPlanDim(mod.dimensions.height)}`,
            sections,
          });
          return;
        }

        if (target.kind === "wall") {
          selectWallAndSyncObstacleTarget(target.wallId);
          const wallObjForMenu = spaceWalls.find((w) => w.id === target.wallId);
          const addQuickToThisWall = (
            t: ArchitecturalElement["type"],
            label: string,
            wMm: number,
            hMm: number,
            yMm: number
          ) => {
            if (!wallObjForMenu) return;
            const placed = resolveWallPlacementAlongTarget(wallObjForMenu, wMm);
            const cid = addSpaceObstacle({
              type: t,
              name: label,
              rotationY: placed.rotationY,
              doorSwing: "left",
              doorOpenSide: "inward",
              position: { x: placed.x, y: yMm, z: placed.z },
              dimensions: { width: wMm, height: hMm, depth: t === "column" ? 280 : 150 },
            });
            setSelectedPlanObject({ kind: "obstacle", id: cid });
          };
          setCadContextMenu({
            x: e.clientX,
            y: e.clientY,
            headerTitle: target.wallName || "Duvar",
            headerSubtitle: `${fmtPlanDim(target.length)} • ${Math.round(target.rotationY)}°`,
            sections: [
              {
                title: "Bu Duvara Yapı Elemanı Ekle",
                items: [
                  {
                    id: "plan-wall-add-win",
                    label: "🪟 Bu Duvara Pencere Ekle",
                    onClick: () => addQuickToThisWall("window", "Pencere", 950, 1100, 1000),
                  },
                  {
                    id: "plan-wall-add-door",
                    label: "🚪 Bu Duvara Kapı Ekle",
                    onClick: () => addQuickToThisWall("door", "Oda Kapısı", 900, 2100, 0),
                  },
                  {
                    id: "plan-wall-add-elec",
                    label: "⚡ Bu Duvara Priz Ekle",
                    onClick: () => addQuickToThisWall("electrical", "Elektrik Prizi", 160, 160, 1150),
                  },
                  {
                    id: "plan-wall-add-plumb",
                    label: "🚰 Bu Duvara Tesisat Ekle",
                    onClick: () => addQuickToThisWall("plumbing", "Tesisat Noktası", 200, 250, 450),
                  },
                ],
              },
              {
                title: "Duvar İşlemleri",
                items: [
                  {
                    id: "plan-wall-rotate",
                    label: "90° Döndür",
                    onClick: () =>
                      updateWallSegment(target.wallId, {
                        rotationY: (target.rotationY + 90) % 360,
                      }),
                  },
                  {
                    id: "plan-wall-draw",
                    label: "Yeni Duvar Çiz",
                    onClick: () => setIsDrawingWall(true),
                  },
                ],
              },
              ...(spaceWalls.length > 1
                ? [
                    {
                      items: [
                        {
                          id: "plan-wall-delete",
                          label: "Duvarı Sil",
                          shortcut: "Del",
                          danger: true,
                          onClick: () => removeWallSegment(target.wallId),
                        },
                      ],
                    },
                  ]
                : []),
            ],
          });
          return;
        }

        if (target.kind === "obstacle") {
          setSelectedPlanObject({ kind: "obstacle", id: target.obsId });
          const obsItem = spaceObstacles.find((o) => o.id === target.obsId);
          setCadContextMenu({
            x: e.clientX,
            y: e.clientY,
            headerTitle: target.obsName || "Mimari Engel",
            headerSubtitle: obsItem
              ? `${fmtPlanDim(obsItem.dimensions.width, false)}×${fmtPlanDim(obsItem.dimensions.height)} • ${Math.round(target.rotationY)}°`
              : `${Math.round(target.rotationY)}°`,
            sections: [
              {
                title: "Aynalama & Yön İşlemleri",
                items: [
                  {
                    id: "plan-obs-mirror-swing",
                    label: `⇄ Yönü Aynala (${obsItem?.doorSwing === "right" ? "Sağ → Sol" : "Sol → Sağ"})`,
                    shortcut: "M",
                    onClick: () =>
                      updateSpaceObstacle(target.obsId, {
                        doorSwing: obsItem?.doorSwing === "right" ? "left" : "right",
                      }),
                  },
                  ...(obsItem?.type === "door"
                    ? [
                        {
                          id: "plan-obs-mirror-side",
                          label: `⇅ Açılımı Çevir (${obsItem.doorOpenSide === "outward" ? "Dışa → İçe" : "İçe → Dışa"})`,
                          shortcut: "Shift+M",
                          onClick: () =>
                            updateSpaceObstacle(target.obsId, {
                              doorOpenSide: obsItem.doorOpenSide === "outward" ? "inward" : "outward",
                            }),
                        },
                      ]
                    : []),
                  {
                    id: "plan-obs-rotate",
                    label: "🔄 90° Döndür",
                    onClick: () =>
                      updateSpaceObstacle(target.obsId, {
                        rotationY: (target.rotationY + 90) % 360,
                      }),
                  },
                ],
              },
              {
                items: [
                  {
                    id: "plan-obs-delete",
                    label: "Engeli Sil",
                    shortcut: "Del",
                    danger: true,
                    onClick: () => removeSpaceObstacle(target.obsId),
                  },
                ],
              },
            ],
          });
          return;
        }

        if (target.kind === "sceneObject") {
          setSelectedSceneObjectId(target.soId);
          setCadContextMenu({
            x: e.clientX,
            y: e.clientY,
            headerTitle: target.soName || "Sahne Objesi",
            headerSubtitle: `${Math.round(target.rotationY)}°`,
            sections: [
              {
                title: "Obje İşlemleri",
                items: [
                  {
                    id: "plan-so-rotate",
                    label: "90° Döndür",
                    onClick: () => {
                      const soObj = (project.sceneObjects || []).find((o) => o.id === target.soId);
                      updateSceneObject(target.soId, {
                        rotation: {
                          x: soObj?.rotation?.x ?? 0,
                          y: (target.rotationY + 90) % 360,
                          z: soObj?.rotation?.z ?? 0,
                        },
                      });
                    },
                  },
                  {
                    id: "plan-so-dup",
                    label: "Objeyi Çoğalt",
                    onClick: () => duplicateSceneObject(target.soId),
                  },
                ],
              },
              {
                items: [
                  {
                    id: "plan-so-delete",
                    label: "Objeyi Sil",
                    shortcut: "Del",
                    danger: true,
                    onClick: () => removeSceneObject(target.soId),
                  },
                ],
              },
            ],
          });
          return;
        }

        setCadContextMenu({
          x: e.clientX,
          y: e.clientY,
          headerTitle: "Mekan Planı",
          headerSubtitle: `${project.modules.length} Modül • ${spaceWalls.length} Duvar`,
          sections: [
            {
              title: "Çizim & Yerleşim",
              items: [
                {
                  id: "plan-canvas-wall",
                  label: "Duvar Çizmeye Başla",
                  onClick: () => setIsDrawingWall(true),
                },
                {
                  id: "plan-canvas-obs",
                  label: "Kolon / Engel Yerleştir",
                  onClick: () => setIsPlacingObstacle(true),
                },
              ],
            },
            {
              title: "Seçim & Görünüm",
              items: [
                {
                  id: "plan-canvas-sel-all",
                  label: "Tüm Modülleri Seç",
                  disabled: project.modules.length === 0,
                  onClick: () => selectAllModules(),
                },
                {
                  id: "plan-canvas-sel-clear",
                  label: "Seçimi Temizle",
                  onClick: () => {
                    clearModuleSelection();
                    setSelectedPlanObject(null);
                    setSelectedSceneObjectId(null);
                  },
                },
                {
                  id: "plan-canvas-dims",
                  label: showPlanDimensions ? "Plan Ölçülerini Gizle" : "Plan Ölçülerini Göster",
                  onClick: () => setShowPlanDimensions((v) => !v),
                },
                {
                  id: "plan-canvas-unit",
                  label: `Ölçü Birimi: ${elevDisplayUnit === "mm" ? "cm'ye Geç" : "mm'ye Geç"}`,
                  onClick: () => handleChangeElevDisplayUnit(elevDisplayUnit === "mm" ? "cm" : "mm"),
                },
                {
                  id: "plan-canvas-reset",
                  label: "Yakınlaştırmayı ve Konumu Sıfırla",
                  onClick: () => {
                    setZoom(1);
                    setPanPx({ x: 0, y: 0 });
                  },
                },
              ],
            },
          ],
        });
      };

      const handleSvgContextMenu = (e: React.MouseEvent<SVGSVGElement>) => {
        e.preventDefault();
        if (isDrawingWall || isPlacingObstacle) {
          setDrawWallStart(null);
          setDrawWallCursor(null);
          setChainOriginPoint(null);
          setActiveSnapTarget(null);
          setIsPlacingObstacle(false);
          return;
        }
        openPlanContextMenu(e, { kind: "canvas" });
      };

      const handleSvgPointerMove = (e: React.MouseEvent<SVGSVGElement>) => {
        const nowTs = performance.now();
        if (nowTs - lastPointerMoveTsRef.current < 14) return;
        lastPointerMoveTsRef.current = nowTs;
        const svgEl = e.currentTarget;
        if (isPlacingObstacle) {
          const raw = clientToSvgRawMm(svgEl, e.clientX, e.clientY);
          const wallSnap = magnetEnabled
            ? snapObstaclePointToClosestWall(raw.x, raw.z, newObstacleW, 380)
            : null;
          if (wallSnap) {
            setObstaclePreviewPos({
              x: wallSnap.x,
              z: wallSnap.z,
              rotY: wallSnap.rotY,
              wallName: wallSnap.wallName,
            });
          } else {
            setObstaclePreviewPos({
              x: Math.round(raw.x / 50) * 50,
              z: Math.round(raw.z / 50) * 50,
              rotY: newObstacleRotY,
            });
          }
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
          if (resizingPlanObject.kind === "angled_module_length") {
            const modIdx = Number(resizingPlanObject.targetIdxOrId);
            const rotDeg = resizingPlanObject.rotYDeg || 0;
            const rad = (rotDeg * Math.PI) / 180;
            // Project screen delta (dxMm, dzMm) onto rotated module's +X length axis (cos(rad), -sin(rad))
            const projDeltaLen = dxMm * Math.cos(rad) + dzMm * -Math.sin(rad);
            const newLen = Math.max(
              500,
              Math.min(3600, Math.round((resizingPlanObject.startWidthOrLen + projDeltaLen) / 10) * 10)
            );
            const ox = resizingPlanObject.anchorOriginX ?? resizingPlanObject.startPosX;
            const oz = resizingPlanObject.anchorOriginZ ?? resizingPlanObject.startPosZ;
            const d = resizingPlanObject.startDepth || 850;
            const c = Math.cos(rad);
            const s = Math.sin(rad);
            const corners = [0, newLen].flatMap((lx) =>
              [0, d].map((lz) => ({ x: lx * c + lz * s, z: -lx * s + lz * c }))
            );
            const minX = Math.min(...corners.map((p) => p.x));
            const minZ = Math.min(...corners.map((p) => p.z));
            const nextPosX = Math.round(ox + minX);
            const nextPosZ = Math.round(oz + minZ);
            resizeModuleParametric(modIdx, newLen, nextPosX, d, undefined, nextPosZ);
            setPlanRowSnapBanner(`📐 Açılı Masa / Modül Boyu: ${newLen} mm (Sabit Pivot)`);
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
              for (const otherW of spaceWalls) {
                if (otherW.id === wallId) continue;
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
              }
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
            const rotDeg = targetWall?.rotationY || 0;
            const isCustomAngleWall = rotDeg !== 0 && rotDeg !== 90;
            let newLen: number;
            if (isCustomAngleWall) {
              const rad = (rotDeg * Math.PI) / 180;
              const projLen =
                (rawPt.x - startPt.x) * Math.cos(rad) + (rawPt.z - startPt.z) * Math.sin(rad);
              newLen = Math.max(300, Math.min(12000, Math.round(projLen / 50) * 50));
            } else {
              const delta = resizingPlanObject.isSideWall ? dzMm : dxMm;
              newLen = Math.max(
                300,
                Math.min(12000, Math.round((resizingPlanObject.startWidthOrLen + delta) / 50) * 50)
              );
            }
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

          setActiveSnapTarget((prev) =>
            prev?.x === wallSnapInfo?.x && prev?.z === wallSnapInfo?.z ? prev : wallSnapInfo
          );
          setPlanSnapBannerFast(
            wallSnapInfo
              ? `🧲 Duvar Duvara Snap: ${wallSnapInfo.label}`
              : `✋ Duvar Taşınıyor: X:${nextX}mm • Z:${nextZ}mm`
          );
          const liveWall = planLiveSvgDragRef.current;
          if (liveWall && liveWall.kind === "wall" && liveWall.el) {
            liveWall.nextX = nextX;
            liveWall.nextZ = nextZ;
            liveWall.hasMoved = true;
            const tdx = nextX - liveWall.startX;
            const tdz = nextZ - liveWall.startZ;
            liveWall.el.setAttribute(
              "transform",
              liveWall.baseTransform
                ? `translate(${tdx}, ${tdz}) ${liveWall.baseTransform}`
                : `translate(${tdx}, ${tdz})`
            );
          } else {
            updateWallSegment(draggingWallId, { position: { x: nextX, z: nextZ } });
          }
          return;
        }
        if (draggingObsId) {
          const mmPerPx = getSvgMmPerPx(svgEl);
          const dxMm = (e.clientX - obsDragStart.clientX) * mmPerPx;
          const dzMm = (e.clientY - obsDragStart.clientY) * mmPerPx;
          const draggedObs = spaceObstacles.find((o) => o.id === draggingObsId);
          const obsW = draggedObs?.dimensions.width || 600;
          const rawNextX = obsDragStart.startX + dxMm;
          const rawNextZ = obsDragStart.startZ + dzMm;
          let nextX = Math.round(rawNextX / 10) * 10;
          let nextZ = Math.round(rawNextZ / 10) * 10;
          const isWallMounted =
            draggedObs &&
            (draggedObs.type === "window" ||
              draggedObs.type === "door" ||
              draggedObs.type === "plumbing" ||
              draggedObs.type === "electrical" ||
              draggedObs.type === "niche");
          const snappedWallHit =
            isWallMounted && magnetEnabled && !e.altKey
              ? snapObstaclePointToClosestWall(rawNextX + obsW * 0.5, rawNextZ, obsW, 180)
              : null;
          if (snappedWallHit) {
            nextX = snappedWallHit.x;
            nextZ = snappedWallHit.z;
            liveObsSnappedRotRef.current = snappedWallHit.rotY;
            setPlanSnapBannerFast(
              `🧲 ${snappedWallHit.wallName} Üzerinde: ${fmtPlanDim(snappedWallHit.alongMm)} (${snappedWallHit.rotY}°)`
            );
          } else {
            liveObsSnappedRotRef.current = null;
            const rot = (((draggedObs?.rotationY || 0) % 360) + 360) % 360;
            if ((rot === 90 || rot === 270) && Math.abs(nextX) <= 90) {
              nextX = 0;
            } else if ((rot === 0 || rot === 180) && Math.abs(nextZ) <= 90) {
              nextZ = 0;
            }
            setPlanSnapBannerFast(
              `🎯 Engel Taşınıyor: X:${fmtPlanDim(nextX)} • Z:${fmtPlanDim(nextZ)}`
            );
          }
          const liveObs = planLiveSvgDragRef.current;
          if (liveObs && liveObs.kind === "obstacle" && liveObs.el) {
            liveObs.nextX = nextX;
            liveObs.nextZ = nextZ;
            liveObs.hasMoved = true;
            const tdx = nextX - liveObs.startX;
            const tdz = nextZ - liveObs.startZ;
            liveObs.el.setAttribute(
              "transform",
              liveObs.baseTransform
                ? `translate(${tdx}, ${tdz}) ${liveObs.baseTransform}`
                : `translate(${tdx}, ${tdz})`
            );
          } else {
            updateObstaclePosition(draggingObsId, nextX, nextZ);
          }
          return;
        }
        if (draggingSceneObjId) {
          const mmPerPx = sceneObjDragStart.mmPerPx || getSvgMmPerPx(svgEl);
          const dxMm = (e.clientX - sceneObjDragStart.clientX) * mmPerPx;
          const dzMm = (e.clientY - sceneObjDragStart.clientY) * mmPerPx;
          const nextX = Math.round((sceneObjDragStart.startX + dxMm) / 10) * 10;
          const nextZ = Math.round((sceneObjDragStart.startZ + dzMm) / 10) * 10;
          setPlanSnapBannerFast(`✋ Sahne Objesi Taşınıyor: X:${nextX}mm • Z:${nextZ}mm`);
          const liveSo = planLiveSvgDragRef.current;
          if (liveSo && liveSo.kind === "scene_object" && liveSo.el) {
            liveSo.nextX = nextX;
            liveSo.nextZ = nextZ;
            liveSo.hasMoved = true;
            const tdx = nextX - liveSo.startX;
            const tdz = nextZ - liveSo.startZ;
            liveSo.el.setAttribute(
              "transform",
              liveSo.baseTransform
                ? `translate(${tdx}, ${tdz}) ${liveSo.baseTransform}`
                : `translate(${tdx}, ${tdz})`
            );
          } else {
            updateSceneObject(draggingSceneObjId, { position: { x: nextX, y: 0, z: nextZ } });
          }
          return;
        }
        if (draggingModIdx === null) return;
        const mmPerPx = dragStartClient.mmPerPx || vb.width / Math.max(1, svgEl.getBoundingClientRect().width * zoom);
        const dxMm = (e.clientX - dragStartClient.x) * mmPerPx;
        const dzMm = (e.clientY - dragStartClient.z) * mmPerPx;
        const dragMod = project.modules[draggingModIdx];
        const isFreeTableOrIsland = Boolean(
          dragMod &&
            (dragMod.complementaryRole === "attached_table" ||
              dragMod.category === "kitchen_island" ||
              (dragMod.carcass.hullShape && dragMod.carcass.hullShape !== "rectangular"))
        );
        const rawNextX = isFreeTableOrIsland
          ? dragStartClient.startModX + dxMm
          : Math.max(0, dragStartClient.startModX + dxMm);
        const rawNextZ = isFreeTableOrIsland
          ? dragStartClient.startModZ + dzMm
          : Math.max(0, dragStartClient.startModZ + dzMm);
        let nextX = rawNextX;
        let nextZ = rawNextZ;
        let activeSnapMsg: string | null = null;
        let snappedEdgeX: number | null = null;

        // Smooth Magnetic Edge-to-Edge Snapping with Instant Breakaway Hysteresis (never locks free angled tables!)
        const useMagnet = magnetEnabled && !e.altKey && !isFreeTableOrIsland;
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
        let didDiscreteAutoRotate = false;
        // Smart L/U Wall Auto-Rotate on Side-Wall Snap (Never auto-flip L-corner cabinets while dragging!)
        if (dragMod && useMagnet && !dragMod.isCorner) {
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
            didDiscreteAutoRotate = true;
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
            didDiscreteAutoRotate = true;
            nextX = Math.max(0, rightWall.position.x - dragMod.dimensions.depth);
            activeSnapMsg = "🔄🧲 Sağ Yan Duvara Otomatik 270° Döndü ve Yapıştı";
          } else if ((curRot === 90 || curRot === 270) && rawNextZ <= 75 && rawNextX >= 140) {
            if (draggingModIdx !== activeModuleIndex) setActiveModuleIndex(draggingModIdx);
            rotateActiveModule90(curRot === 90 ? -90 : -270);
            didDiscreteAutoRotate = true;
            nextZ = 0;
            activeSnapMsg = "🔄🧲 Ana Duvara Otomatik 0° Döndü ve Hizalandı (Z: 0mm)";
          }
        }

        // Automatic Parallel Alignment & Flush Back-Snap to ANY Angled Wall (`30°`, `45°`, `135°`, freehand)!
        if (dragMod && useMagnet && !dragMod.isCorner && spaceWalls.some((w) => ((w.rotationY || 0) % 90 + 90) % 90 !== 0)) {
          const angledSol = solveAngledWallSnapForModule({
            mod: dragMod,
            modIdx: draggingModIdx,
            candidatePosX: rawNextX,
            candidatePosZ: rawNextZ,
            walls: spaceWalls.filter((w) => ((w.rotationY || 0) % 90 + 90) % 90 !== 0),
            allModules: project.modules,
            maxPerpSnapDistMm: 145,
          });
          if (angledSol) {
            nextX = angledSol.snappedPositionX;
            nextZ = angledSol.snappedPositionZ;
            const curModRot = (((dragMod.rotation?.y || 0) % 360) + 360) % 360;
            if (Math.abs(curModRot - angledSol.moduleRotationYDeg) > 0.5) {
              if (draggingModIdx !== activeModuleIndex) setActiveModuleIndex(draggingModIdx);
              rotateActiveModule90(angledSol.moduleRotationYDeg - curModRot);
              didDiscreteAutoRotate = true;
            }
            activeSnapMsg = `🧲📐 "${angledSol.wallName}" Açılı Duvarına Paralel Yaslandı (${angledSol.moduleRotationYDeg}°)`;
          }
        }

        const snapStep = useMagnet ? (activeSnapMsg ? 1 : 10) : 1;
        const snappedNextX = snapStep > 1 ? Math.round(nextX / snapStep) * snapStep : Math.round(nextX);
        const snappedNextZ = snapStep > 1 ? Math.round(nextZ / snapStep) * snapStep : Math.round(nextZ);

        setActivePlanSnapX((prev) => (prev === snappedEdgeX ? prev : snappedEdgeX));
        setPlanSnapBannerFast(
          activeSnapMsg || `📐 Modül Konumu: X:${snappedNextX}mm • Z:${snappedNextZ}mm`
        );

        const liveMod = planLiveSvgDragRef.current;
        if (!didDiscreteAutoRotate && dragMod && liveMod && liveMod.kind === "module" && liveMod.el) {
          liveMod.nextX = snappedNextX;
          liveMod.nextZ = snappedNextZ;
          liveMod.snapStepMm = snapStep;
          liveMod.hasMoved = true;
          const tdx = snappedNextX - dragMod.position.x;
          const tdz = snappedNextZ - dragMod.position.z;
          const tf = liveMod.baseTransform
            ? `translate(${tdx}, ${tdz}) ${liveMod.baseTransform}`
            : `translate(${tdx}, ${tdz})`;
          liveMod.el.setAttribute("transform", tf);
          for (const att of liveMod.attachedEls) {
            att.el.setAttribute(
              "transform",
              att.baseTransform ? `translate(${tdx}, ${tdz}) ${att.baseTransform}` : `translate(${tdx}, ${tdz})`
            );
          }
          return;
        }

        if (dragMod && (snappedNextX !== dragMod.position.x || snappedNextZ !== dragMod.position.z)) {
          if (liveMod) {
            liveMod.startX = snappedNextX;
            liveMod.startZ = snappedNextZ;
            liveMod.nextX = snappedNextX;
            liveMod.nextZ = snappedNextZ;
          }
          setModulePosition(draggingModIdx, snappedNextX, snappedNextZ, snapStep);
        }
      };

      const handleSvgPointerUp = () => {
        if (typeof document !== "undefined") {
          delete document.body.dataset.birimUiDragging;
        }
        const liveDrag = planLiveSvgDragRef.current;
        resetPlanLiveSvgTransform();
        setPlanSnapBannerFast(null);

        if (resizingPlanObject !== null) {
          setResizingPlanObject(null);
          setActiveSnapTarget(null);
          setPlanRowSnapBanner(null);
          commitHistoryTransaction();
        }
        if (draggingWallId !== null) {
          if (liveDrag && liveDrag.kind === "wall" && liveDrag.hasMoved && liveDrag.targetId) {
            updateWallSegment(liveDrag.targetId, {
              position: { x: liveDrag.nextX, z: liveDrag.nextZ },
            });
          }
          setDraggingWallId(null);
          setActiveSnapTarget(null);
          setPlanRowSnapBanner(null);
          commitHistoryTransaction();
        }
        if (draggingObsId !== null) {
          if (liveDrag && liveDrag.kind === "obstacle" && liveDrag.hasMoved && liveDrag.targetId) {
            updateObstaclePosition(liveDrag.targetId, liveDrag.nextX, liveDrag.nextZ);
            if (liveObsSnappedRotRef.current !== null) {
              updateSpaceObstacle(liveDrag.targetId, { rotationY: liveObsSnappedRotRef.current });
            }
          }
          liveObsSnappedRotRef.current = null;
          setDraggingObsId(null);
          setPlanRowSnapBanner(null);
          commitHistoryTransaction();
        }
        if (draggingSceneObjId !== null) {
          if (liveDrag && liveDrag.kind === "scene_object" && liveDrag.hasMoved && liveDrag.targetId) {
            const curSo = (project.sceneObjects || []).find((o) => o.id === liveDrag.targetId);
            updateSceneObject(liveDrag.targetId, {
              position: { x: liveDrag.nextX, y: curSo?.position.y || 0, z: liveDrag.nextZ },
            });
          }
          setDraggingSceneObjId(null);
          setPlanRowSnapBanner(null);
          commitHistoryTransaction();
        }
        if (draggingModIdx !== null) {
          if (liveDrag && liveDrag.kind === "module" && liveDrag.hasMoved && typeof liveDrag.modIdx === "number") {
            setModulePosition(liveDrag.modIdx, liveDrag.nextX, liveDrag.nextZ, liveDrag.snapStepMm ?? 1);
          }
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
        let targetRotY = newObstacleRotY;
        if (obstacleTargetWallId !== "custom_xz") {
          const effectiveWallId =
            selectedPlanObject?.kind === "wall"
              ? selectedPlanObject.id
              : obstacleTargetWallId || storeActiveWallId || spaceWalls[0]?.id;
          const targetWall =
            spaceWalls.find((w) => w.id === effectiveWallId) || spaceWalls[0];
          if (targetWall) {
            const placed = resolveWallPlacementAlongTarget(
              targetWall,
              newObstacleW,
              newObstacleX
            );
            targetX = placed.x;
            targetZ = placed.z;
            targetRotY = placed.rotationY;
            setNewObstacleRotY(placed.rotationY);
            setNewObstacleX(placed.nextSuggestedOffset);
          }
        }
        const createdId = addSpaceObstacle(buildObstaclePayloadAt(targetX, targetZ, targetRotY));
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
          <CadPlan2DChromeOverlays activeModuleIndex={activeModuleIndex} activeSpatialAlertIdx={activeSpatialAlertIdx} addSpaceObstacle={addSpaceObstacle} addWallSegment={addWallSegment} batchMoveSelectedModules={batchMoveSelectedModules} cadDrawerTab={cadDrawerTab} drawWallStart={drawWallStart} dropV4TemplateWithSnap={dropV4TemplateWithSnap} elevDisplayUnit={elevDisplayUnit} floorPlanInputRef={floorPlanInputRef} fmtPlanDim={fmtPlanDim} handleAddObstacleClick={handleAddObstacleClick} handleDeleteSelectedObject={handleDeleteSelectedObject} handleFloorPlanFileChange={handleFloorPlanFileChange} importWallsFromUnderlay={importWallsFromUnderlay} inlineEditWallId={inlineEditWallId} inlineEditWallLength={inlineEditWallLength} isDrawingWall={isDrawingWall} isPlacingObstacle={isPlacingObstacle} liveSpatialAlerts={liveSpatialAlerts} magnetEnabled={magnetEnabled} mainWall={mainWall} newObstacleH={newObstacleH} newObstacleRotY={newObstacleRotY} newObstacleType={newObstacleType} newObstacleW={newObstacleW} newObstacleX={newObstacleX} newObstacleY={newObstacleY} newObstacleZ={newObstacleZ} obstacleTargetWallId={obstacleTargetWallId} planRowSnapBanner={planRowSnapBanner} planScaleRatio={planScaleRatio} planSnapBannerTextRef={planSnapBannerTextRef} planSnapBannerWrapRef={planSnapBannerWrapRef} printActive2DCadSheet={printActive2DCadSheet} project={project} redo={redo} removeWallSegment={removeWallSegment} resizeModuleParametric={resizeModuleParametric} resolveWallPlacementAlongTarget={resolveWallPlacementAlongTarget} selectAllModules={selectAllModules} selectWallAndSyncObstacleTarget={selectWallAndSyncObstacleTarget} selectedModuleIds={selectedModuleIds} selectedModuleObj={selectedModuleObj} selectedObstacleObj={selectedObstacleObj} selectedPlanObject={selectedPlanObject} selectedWallObj={selectedWallObj} setActiveModuleIndex={setActiveModuleIndex} setActiveSnapTarget={setActiveSnapTarget} setActiveSpatialAlertIdx={setActiveSpatialAlertIdx} setCadDrawerTab={setCadDrawerTab} setChainOriginPoint={setChainOriginPoint} setDrawWallCursor={setDrawWallCursor} setDrawWallStart={setDrawWallStart} setFloorPlanUnderlay={setFloorPlanUnderlay} setInlineEditWallId={setInlineEditWallId} setInlineEditWallLength={setInlineEditWallLength} setIsDrawingWall={setIsDrawingWall} setIsPlacingObstacle={setIsPlacingObstacle} setMagnetEnabled={setMagnetEnabled} setModulePosition={setModulePosition} setNewObstacleH={setNewObstacleH} setNewObstacleRotY={setNewObstacleRotY} setNewObstacleType={setNewObstacleType} setNewObstacleW={setNewObstacleW} setNewObstacleX={setNewObstacleX} setNewObstacleY={setNewObstacleY} setNewObstacleZ={setNewObstacleZ} setObstacleTargetWallId={setObstacleTargetWallId} setPanPx={setPanPx} setPlanRowSnapBanner={setPlanRowSnapBanner} setPlanScaleRatio={setPlanScaleRatio} setRoomDimensions={setRoomDimensions} setSelectedPlanObject={setSelectedPlanObject} setShowAdvancedCadBar={setShowAdvancedCadBar} setShowPlanDimensions={setShowPlanDimensions} setShowWallCoordsInPill={setShowWallCoordsInPill} setSpatialAlertsMinimized={setSpatialAlertsMinimized} setWallDimDisplayMode={setWallDimDisplayMode} setZoom={setZoom} showAdvancedCadBar={showAdvancedCadBar} showPlanDimensions={showPlanDimensions} showWallCoordsInPill={showWallCoordsInPill} snapModuleToAngledWall={snapModuleToAngledWall} spaceObstacles={spaceObstacles} spaceWalls={spaceWalls} spatialAlertsMinimized={spatialAlertsMinimized} swapModuleWithNeighbor={swapModuleWithNeighbor} underlay={underlay} undo={undo} updateSpaceObstacle={updateSpaceObstacle} updateWallSegment={updateWallSegment} wallDimDisplayMode={wallDimDisplayMode} zoom={zoom} />
          <CadPlan2DSvgCanvas activeModuleIndex={activeModuleIndex} activePlanSnapX={activePlanSnapX} activeSnapTarget={activeSnapTarget} activeSpatialMetrics={activeSpatialMetrics} beginHistoryTransaction={beginHistoryTransaction} dragGhostPreview={dragGhostPreview} draggingModIdx={draggingModIdx} draggingWallId={draggingWallId} drawWallCursor={drawWallCursor} drawWallStart={drawWallStart} elevDisplayUnit={elevDisplayUnit} errorModuleIds={errorModuleIds} fmtPlanDim={fmtPlanDim} footprints={footprints} getSvgMmPerPx={getSvgMmPerPx} handleModPointerDown={handleModPointerDown} handleObstaclePointerDown={handleObstaclePointerDown} handleSceneObjectPointerDown={handleSceneObjectPointerDown} handleSvgClick={handleSvgClick} handleSvgContextMenu={handleSvgContextMenu} handleSvgPointerMove={handleSvgPointerMove} handleSvgPointerUp={handleSvgPointerUp} handleWallClick={handleWallClick} handleWallPointerDown={handleWallPointerDown} isDrawingWall={isDrawingWall} isPlacingObstacle={isPlacingObstacle} liveSpatialAlerts={liveSpatialAlerts} longPress2DRef={longPress2DRef} mainWall={mainWall} maxDepthZ={maxDepthZ} moduleCadMetrics={moduleCadMetrics} newObstacleRotY={newObstacleRotY} newObstacleType={newObstacleType} newObstacleW={newObstacleW} obstaclePreviewPos={obstaclePreviewPos} openPlanContextMenu={openPlanContextMenu} panPx={panPx} panPxRef={panPxRef} panning2D={panning2D} pinchTrackerRef={pinchTrackerRef} project={project} removeSpaceObstacle={removeSpaceObstacle} resizingPlanObject={resizingPlanObject} rotateActiveModule90={rotateActiveModule90} selectedPlanObject={selectedPlanObject} selectedSceneObjectId={selectedSceneObjectId} setActiveModuleIndex={setActiveModuleIndex} setInlineEditWallId={setInlineEditWallId} setInlineEditWallLength={setInlineEditWallLength} setPanPx={setPanPx} setPanning2D={setPanning2D} setPlanRowSnapBanner={setPlanRowSnapBanner} setResizingPlanObject={setResizingPlanObject} setSelectedSceneObjectId={setSelectedSceneObjectId} setZoom={setZoom} showPlanDimensions={showPlanDimensions} showPlanGrid={showPlanGrid} spaceObstacles={spaceObstacles} spaceWalls={spaceWalls} ts={ts} underlay={underlay} updateSpaceObstacle={updateSpaceObstacle} updateWallSegment={updateWallSegment} vb={vb} wallDimDisplayMode={wallDimDisplayMode} zoom={zoom} zoomRef={zoomRef} />
          <CadContextMenu2D menu={cadContextMenu} onClose={() => setCadContextMenu(null)} />
        </div>
      );
};
