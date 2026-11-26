"use client";


import React from "react";
import { formatIssueHumanTitle } from "@birim/core";
import { ElevationCeilingSectionSvg } from "../workspace/CeilingAndGrain2DOverlays";
import { formatElevationValue, truncateCadLabel } from "../workspace/elevation2dHelpers";
import { NeighborElevationModule } from "../workspace/NeighborElevationModule";
import { CadElevationActiveModuleGroupSvg } from "./CadElevationActiveModuleGroupSvg";

import type { CadElevationAndSectionSvgCanvasProps } from "./cad2dTypes";
export type { CadElevationAndSectionSvgCanvasProps };

export const CadElevationAndSectionSvgCanvas: React.FC<CadElevationAndSectionSvgCanvasProps> = (props) => {
  const {
    activeElevSnap,
    activeElevWallKey,
    activeHaloGroupRef,
    activeModGroupRef,
    activeModOffX,
    activeModTransform,
    activeModule,
    activeModuleIndex,
    beginHistoryTransaction,
    breakdown,
    ceilingH,
    data,
    dragGhostPreview,
    duplicateSceneObject,
    effectiveInteriorMoveMode,
    effectiveShowAllDims,
    elevCoordMode,
    elevDetailLevel,
    elevDisplayUnit,
    elevDraggingMod,
    elevInteriorLiveRef,
    elevLabelScale,
    elevPanMode,
    elevResizingMod,
    elevWallMeta,
    findInteriorDragTarget,
    getElevScaleMmPerPx,
    getModElevWallKey,
    getModWallAlongX,
    grainContinuityMap2D,
    handleElevationPointerMove,
    handleElevationPointerUp,
    hasSceneModules,
    hoveredElevationItem,
    hoveredHeightHandle,
    interiorDrag,
    lastDividerCommitValRef,
    lastInteriorCommitRef,
    liveAccessoryGhost2D,
    liveSpatialAlerts,
    longPress2DRef,
    mainWallLen,
    maxWallSpanX,
    mode,
    openElevationContextMenu,
    panPx,
    panPxRef,
    panning2D,
    pinchTrackerRef,
    project,
    railComponents,
    removeSceneObject,
    removeSpaceObstacle,
    roomModH,
    roomOffX,
    roomOffY,
    sectionDirection2D,
    selectedComponentId,
    selectedPlanObject,
    selectedSceneObjectId,
    setActiveBayIndex,
    setActiveModuleIndex,
    setCadContextMenu,
    setElevDraggingMod,
    setElevDraggingObs,
    setElevDraggingSceneObj,
    setElevResizingMod,
    setHoveredElevationItem,
    setHoveredHeightHandle,
    setInteriorDrag,
    setPanPx,
    setPanning2D,
    setSelectedComponentId,
    setSelectedPlanObject,
    setSelectedSceneObjectId,
    setZoom,
    showDoorsIn2D,
    showRoomContextInElev,
    snapXBadgeRef,
    snapXCircleRef,
    snapXGroupRef,
    snapXLineRef,
    snapXTextRef,
    snapYBadgeRef,
    snapYGroupRef,
    snapYLineRef,
    snapYTextRef,
    spaceObstacles,
    spaceWalls,
    updateSceneObject,
    updateSpaceObstacle,
    vb,
    visibleElements,
    zoom,
    zoomRef,
  } = props;
  return (
    <>
        <svg
          data-birim-elev-svg="true"
          viewBox={`${vb.x} ${vb.y} ${vb.width} ${vb.height}`}
          className={`w-full h-full touch-none ${panning2D ? "cursor-grabbing" : "cursor-grab"}`}
          onContextMenu={(e) => openElevationContextMenu(e, { kind: "canvas" })}
          onPointerDownCapture={(e) => {
            if (e.pointerType === "touch") {
              pinchTrackerRef.current.pointerDown(e.pointerId, e.clientX, e.clientY);
              if (pinchTrackerRef.current.isPinching()) {
                longPress2DRef.current.cancel();
                setPanning2D(null);
                return;
              }
            }
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
          onPointerDown={(e) => {
            if (e.pointerType === "touch") {
              if (pinchTrackerRef.current.isPinching()) return;
              longPress2DRef.current.start(e);
            }
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
          onPointerMove={(e) => {
            if (e.pointerType === "touch") {
              longPress2DRef.current.move(e);
              const pinch = pinchTrackerRef.current.pointerMove(e.pointerId, e.clientX, e.clientY);
              if (pinch) {
                const nextZ = Math.max(0.35, Math.min(5, zoomRef.current * pinch.scaleRatio));
                zoomRef.current = nextZ;
                const nx = panPxRef.current.x + pinch.panDx;
                const ny = panPxRef.current.y + pinch.panDy;
                panPxRef.current = { x: nx, y: ny };
                e.currentTarget.style.transform = `translate(${nx}px, ${ny}px) scale(${nextZ})`;
                return;
              }
              if (pinchTrackerRef.current.isPinching()) return;
            }
            if (panning2D) {
              const nx = panning2D.startPanX + (e.clientX - panning2D.startClientX);
              const ny = panning2D.startPanY + (e.clientY - panning2D.startClientY);
              panPxRef.current = { x: nx, y: ny };
              e.currentTarget.style.transform = `translate(${nx}px, ${ny}px) scale(${zoom})`;
              return;
            }
            handleElevationPointerMove(e);
          }}
          onPointerCancel={(e) => {
            if (e.pointerType === "touch") {
              pinchTrackerRef.current.pointerUp(e.pointerId);
              longPress2DRef.current.cancel();
            }
            if (panning2D) {
              setPanPx(panPxRef.current);
              setPanning2D(null);
            }
          }}
          onPointerUp={(e) => {
            if (e.pointerType === "touch") {
              const wasPinch = pinchTrackerRef.current.isPinching();
              pinchTrackerRef.current.pointerUp(e.pointerId);
              longPress2DRef.current.cancel();
              if (wasPinch && !pinchTrackerRef.current.isPinching()) {
                setZoom(Number(zoomRef.current.toFixed(3)));
                setPanPx(panPxRef.current);
              }
            }
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
            {/* Realistic Metallic Chrome Gradients for 2D Front Elevation Hanging Rails */}
            <linearGradient id="v3_chrome_rail_grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#475569" />
              <stop offset="18%" stopColor="#CBD5E1" />
              <stop offset="34%" stopColor="#FFFFFF" />
              <stop offset="50%" stopColor="#E2E8F0" />
              <stop offset="74%" stopColor="#94A3B8" />
              <stop offset="92%" stopColor="#475569" />
              <stop offset="100%" stopColor="#334155" />
            </linearGradient>
            <linearGradient id="v3_chrome_rail_selected_grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1D4ED8" />
              <stop offset="18%" stopColor="#93C5FD" />
              <stop offset="34%" stopColor="#EFF6FF" />
              <stop offset="52%" stopColor="#BFDBFE" />
              <stop offset="76%" stopColor="#60A5FA" />
              <stop offset="92%" stopColor="#2563EB" />
              <stop offset="100%" stopColor="#1E3A8A" />
            </linearGradient>
            <linearGradient id="v3_chrome_rail_drag_grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#C2410C" />
              <stop offset="20%" stopColor="#FDBA74" />
              <stop offset="36%" stopColor="#FFF7ED" />
              <stop offset="54%" stopColor="#FED7AA" />
              <stop offset="78%" stopColor="#FB923C" />
              <stop offset="100%" stopColor="#EA580C" />
            </linearGradient>
            <linearGradient id="v3_chrome_flange_grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#334155" />
              <stop offset="35%" stopColor="#CBD5E1" />
              <stop offset="58%" stopColor="#F8FAFC" />
              <stop offset="100%" stopColor="#475569" />
            </linearGradient>
          </defs>

          <rect
            data-elev-bg="true"
            x={vb.x - 4000}
            y={vb.y - 4000}
            width={vb.width + 8000}
            height={vb.height + 8000}
            fill="url(#v3_elev_grid)"
          />

          {/* ROOM WALL ELEVATION BACKDROP, OTHER MODULES & ARCHITECTURAL OBSTACLES (WINDOW, DOOR, PLUMBING, COLUMN, BEAM) */}
          {mode === "elevation" && !showRoomContextInElev && project.space.ceilingConfig?.enabled && activeModule && (
            <ElevationCeilingSectionSvg
              project={project}
              activeModule={activeModule}
              wallLeftSvgX={-activeModOffX}
              floorSvgY={breakdown.overall.height}
              mainWallLen={Math.max(spaceWalls?.[0]?.length || 3600, activeModule.position.x + activeModule.dimensions.width + 200)}
            />
          )}
          {mode === "elevation" && showRoomContextInElev && (() => {
            const floorSvgY = roomModH + roomOffY;
            const ceilingSvgY = floorSvgY - ceilingH;
            const wallLeftSvgX = -roomOffX;
            return (
              <g data-testid="cad-elevation-room-context">
                {/* Wall Surface (marked data-elev-bg so dragging anywhere on the wall pans the 2D Elevation canvas!) */}
                <rect
                  data-elev-bg="true"
                  x={wallLeftSvgX}
                  y={ceilingSvgY}
                  width={mainWallLen}
                  height={ceilingH}
                  fill="#CCD3DC"
                  stroke="#475569"
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
                {(() => {
                  const wallHdrText = `🏠 ${elevWallMeta[activeElevWallKey].label.toUpperCase()} CEPHESİ: ${formatElevationValue(mainWallLen, elevDisplayUnit)} × Tavan ${formatElevationValue(ceilingH, elevDisplayUnit)} (Zemin Y: 0)`;
                  const hdrY = ceilingSvgY - (project.space.ceilingConfig?.enabled ? 156 : 52);
                  const hdrW = Math.max(540, Math.round(wallHdrText.length * 15.5 + 36));
                  return (
                    <foreignObject x={wallLeftSvgX + 12} y={hdrY} width={hdrW + 32} height={48} className="pointer-events-none overflow-visible">
                      <div className="inline-flex items-center gap-2.5 text-slate-200 bg-slate-900/88 px-2 py-0.5 rounded text-[21px] font-semibold tracking-tight whitespace-nowrap border border-white/12 shadow-md">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                        <span>{wallHdrText}</span>
                      </div>
                    </foreignObject>
                  );
                })()}
                {activeModule && (
                  <ElevationCeilingSectionSvg
                    project={project}
                    activeModule={activeModule}
                    wallLeftSvgX={wallLeftSvgX}
                    floorSvgY={floorSvgY}
                    mainWallLen={mainWallLen}
                  />
                )}

                {/* Architectural Obstacles in Elevation (Window, Plumbing, Door, Column, Beam) */}
                {(activeElevWallKey === "main" ? spaceObstacles : []).map((obs) => {
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
                        onPointerDown={onElevObsMouseDown}
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
                          fontFamily="Inter, 'Plus Jakarta Sans', system-ui, sans-serif"
                        >
                          {`🪟 ${obs.name} (Denizlik Y:${formatElevationValue(oyBottom, elevDisplayUnit)})`}
                        </text>
                      </g>
                    );
                  }

                  if (obs.type === "plumbing") {
                    const cx = ox + ow / 2;
                    const cy = oySvg + oh / 2;
                    return (
                      <g key={obs.id} data-testid={`elev-obs-${obs.id}`} onPointerDown={onElevObsMouseDown} className="cursor-move">
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
                          fontFamily="Inter, 'Plus Jakarta Sans', system-ui, sans-serif"
                        >
                          {`🚰 TESİSAT AKSI X:${formatElevationValue(obs.position.x + ow / 2, elevDisplayUnit)} • Y:${formatElevationValue(oyBottom, elevDisplayUnit)}`}
                        </text>
                      </g>
                    );
                  }

                  if (obs.type === "electrical" || obs.type === "ventilation") {
                    const cx = ox + ow / 2;
                    const cy = oySvg + oh / 2;
                    return (
                      <g key={obs.id} data-testid={`elev-obs-${obs.id}`} onPointerDown={onElevObsMouseDown} className="cursor-move">
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
                          fontFamily="Inter, 'Plus Jakarta Sans', system-ui, sans-serif"
                        >
                          {`⚡ ${obs.name} (X:${formatElevationValue(obs.position.x, elevDisplayUnit)} • Kot Y:${formatElevationValue(oyBottom, elevDisplayUnit)})`}
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
                      <g
                        key={obs.id}
                        data-testid={`elev-obs-${obs.id}`}
                        onPointerDown={onElevObsMouseDown}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          updateSpaceObstacle(obs.id, { doorSwing: isRightSwing ? "left" : "right" });
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setCadContextMenu({
                            x: e.clientX,
                            y: e.clientY,
                            headerTitle: obs.name || "Oda Kapısı",
                            headerSubtitle: `${formatElevationValue(ow, elevDisplayUnit, false)}×${formatElevationValue(oh, elevDisplayUnit)}`,
                            sections: [
                              {
                                title: "Kapı Aynalama İşlemleri",
                                items: [
                                  {
                                    id: "elev-door-mirror-swing",
                                    label: `⇄ Menteşe Yönünü Aynala (${isRightSwing ? "Sağ → Sol" : "Sol → Sağ"})`,
                                    onClick: () =>
                                      updateSpaceObstacle(obs.id, {
                                        doorSwing: isRightSwing ? "left" : "right",
                                      }),
                                  },
                                  {
                                    id: "elev-door-mirror-side",
                                    label: `⇅ Açılım Tarafını Aynala (${obs.doorOpenSide === "outward" ? "Dışa → İçe" : "İçe → Dışa"})`,
                                    onClick: () =>
                                      updateSpaceObstacle(obs.id, {
                                        doorOpenSide: obs.doorOpenSide === "outward" ? "inward" : "outward",
                                      }),
                                  },
                                ],
                              },
                              {
                                items: [
                                  {
                                    id: "elev-door-del",
                                    label: "Kapıyı Sil",
                                    danger: true,
                                    onClick: () => removeSpaceObstacle(obs.id),
                                  },
                                ],
                              },
                            ],
                          });
                        }}
                        className="cursor-move"
                      >
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
                          fontFamily="Inter, 'Plus Jakarta Sans', system-ui, sans-serif"
                        >
                          {`🚪 ${obs.name} (${isRightSwing ? "SAĞ" : "SOL"} • ${obs.doorOpenSide === "outward" ? "DIŞA" : "İÇE"} • ${formatElevationValue(ow, elevDisplayUnit, false)}×${formatElevationValue(oh, elevDisplayUnit)})`}
                        </text>
                      </g>
                    );
                  }

                  // Column or Beam
                  return (
                    <g key={obs.id} data-testid={`elev-obs-${obs.id}`} onPointerDown={onElevObsMouseDown} className="cursor-move">
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
                      {(() => {
                        const colTxt = `🏛️ ${obs.name} (X:${obs.position.x})`;
                        const colPillW = Math.max(260, Math.round(colTxt.length * 14.5 * elevLabelScale * 0.65));
                        const colPillH = Math.round(38 * Math.min(1.45, Math.max(1, elevLabelScale * 0.75)));
                        return (
                          <g pointerEvents="none">
                            <rect
                              x={ox + ow / 2 - colPillW / 2}
                              y={oySvg + oh / 2 - colPillH / 2}
                              width={colPillW}
                              height={colPillH}
                              rx={Math.round(colPillH / 2)}
                              fill="#0F172A"
                              fillOpacity="0.93"
                              stroke="#64748B"
                              strokeWidth="2"
                            />
                            <text
                              x={ox + ow / 2}
                              y={oySvg + oh / 2 + Math.round(colPillH * 0.22)}
                              textAnchor="middle"
                              fill="#F8FAFC"
                              fontSize={Math.round(colPillH * 0.52)}
                              fontWeight="700"
                              fontFamily="Inter, 'Plus Jakarta Sans', system-ui, sans-serif"
                            >
                              {colTxt}
                            </text>
                          </g>
                        );
                      })()}
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
                {hasSceneModules && (() => {
                  const rawTitle = activeModule.name.replace(/^V4\s+/i, "");
                  const shortTitle = truncateCadLabel(rawTitle, breakdown.overall.width, 16);
                  const haloText = `#${activeModuleIndex + 1} · ${shortTitle}`;
                  const pxScaleHdr = Math.max(1.1, Math.min(2.6, (vb.width || 2200) / 1050));
                  const haloFs = Math.round(13.5 * pxScaleHdr);
                  const haloH = Math.round(28 * pxScaleHdr);
                  const haloW = Math.max(Math.round(180 * pxScaleHdr), Math.round(haloText.length * haloFs * 0.68 + 44));
                  // Üst genişlik ölçü çizgisinin (1670 mm) en az 28px yukarısında konumla
                  const haloY = -Math.round(88 + 28 * pxScaleHdr) - haloH;
                  return (
                  <g ref={activeHaloGroupRef} data-testid="elev-active-mod-selection-halo" transform={activeModTransform || ""}>
                    <g
                      onPointerDown={(e) => {
                        if (effectiveInteriorMoveMode) return;
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
                      className={effectiveInteriorMoveMode ? "cursor-default" : "cursor-grab active:cursor-grabbing"}
                    >
                      <rect
                        x={breakdown.overall.width / 2 - haloW / 2}
                        y={haloY}
                        width={haloW}
                        height={haloH}
                        rx={Math.round(haloH / 2)}
                        fill={elevDraggingMod ? "#B45309" : "#1E293B"}
                        fillOpacity="0.94"
                        stroke={elevDraggingMod ? "#FDE68A" : "#38BDF8"}
                        strokeWidth="2.4"
                      />
                      <text
                        x={breakdown.overall.width / 2}
                        y={haloY + haloH * 0.66}
                        textAnchor="middle"
                        fill="#F8FAFC"
                        fontSize={haloFs}
                        fontWeight="600"
                        letterSpacing="0.8"
                        fontFamily="Inter, 'Plus Jakarta Sans', system-ui, sans-serif"
                      >
                        {haloText}
                      </text>
                    </g>
                  </g>
                  );
                })()}

                {/* ALL Modules Simultaneous Interior Elevation (Filtered to Active Wall — zero L/U overlap!) */}
                {project.modules.map((m, mIdx) => {
                  if (mIdx === activeModuleIndex) return null;
                  if (getModElevWallKey(m) !== activeElevWallKey) return null;
                  const mx = wallLeftSvgX + getModWallAlongX(m, activeElevWallKey);
                  const my = floorSvgY - (m.position.y + m.dimensions.height);
                  return (
                    <NeighborElevationModule
                      key={m.id}
                      module={m}
                      moduleIndex={mIdx}
                      mx={mx}
                      my={my}
                      showDoorsIn2D={showDoorsIn2D}
                      detailLevel={elevDetailLevel}
                      displayUnit={elevDisplayUnit}
                      elevPanMode={elevPanMode}
                      effectiveInteriorMoveMode={effectiveInteriorMoveMode}
                      getElevScaleMmPerPx={getElevScaleMmPerPx}
                      onSelectModule={setActiveModuleIndex}
                      onSelectComponent={setSelectedComponentId}
                      onSelectBay={setActiveBayIndex}
                      onBeginHistory={beginHistoryTransaction}
                      onStartModuleDrag={setElevDraggingMod}
                      onStartInteriorDrag={setInteriorDrag}
                    />
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
                            fontFamily="Inter, 'Plus Jakarta Sans', system-ui, sans-serif"
                          >
                            {`⚠️ ${al.title.startsWith("ERR_") || al.title.startsWith("WARN_") || al.title.startsWith("CHK_") ? formatIssueHumanTitle(al.title) : al.title}`}
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
                            fontFamily="Inter, 'Plus Jakarta Sans', system-ui, sans-serif"
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
                            fontFamily="Inter, 'Plus Jakarta Sans', system-ui, sans-serif"
                          >
                            {`SİLUET: ${gm.name} (${gw}×${gh})`}
                          </text>
                        </g>
                      );
                    })()}
                  </g>
                )}
                {liveAccessoryGhost2D && (() => {
                  const g = liveAccessoryGhost2D;
                  const floorSvgY = roomModH + roomOffY;
                  const innerFloorSvgY = floorSvgY - g.modY - g.plinthH - g.carcassT;
                  const isSubDiv = g.visual === "sub_divider";
                  const isDrawer = g.visual === "drawer" || g.visual === "internal_drawer";
                  const isWardrobeLift = g.visual === "wardrobe_lift" || g.id === "lib_wardrobe_lift";
                  const isRail = g.visual === "rail" && !isWardrobeLift;
                  const isTray =
                    g.visual === "trouser_rack" ||
                    g.visual === "shoe_rack" ||
                    g.visual === "jewelry_tray" ||
                    g.visual === "tie_rack";
                  const itemH = isSubDiv
                    ? (g.subSpanH || 300)
                    : isWardrobeLift
                    ? 740
                    : isDrawer
                    ? 180
                    : isRail
                    ? 22
                    : isTray
                    ? 64
                    : g.id === "lib_fixed_shelf"
                    ? 25
                    : g.carcassT;
                  const itemW = isSubDiv ? g.carcassT : Math.max(40, g.bayWidth - 6);
                  const gx = isSubDiv ? g.baySvgX + g.offsetX : g.baySvgX + 3;
                  const effectiveElevY = isWardrobeLift
                    ? Math.max(32, g.elevationY - Math.round(itemH * 0.75))
                    : g.elevationY;
                  const gy = isSubDiv
                    ? innerFloorSvgY - ((g.subBotY ?? 0) + itemH)
                    : innerFloorSvgY - (effectiveElevY + itemH);
                  return (
                    <g data-testid="elev-live-accessory-ghost" className="pointer-events-none">
                      {isWardrobeLift ? (
                        <>
                          {/* Left & right hydraulic damper housings */}
                          <rect x={gx} y={gy + itemH - 140} width={28} height={140} rx={4} fill="rgba(30, 41, 59, 0.55)" stroke="#2563EB" strokeWidth="3.5" />
                          <rect x={gx + itemW - 28} y={gy + itemH - 140} width={28} height={140} rx={4} fill="rgba(30, 41, 59, 0.55)" stroke="#2563EB" strokeWidth="3.5" />
                          {/* Telescopic lift arms + top hanging bar */}
                          <path
                            d={`M ${gx + 22} ${gy + itemH - 95} L ${gx + 22} ${gy + 34} Q ${gx + 22} ${gy + 12} ${gx + 44} ${gy + 12} L ${gx + itemW - 44} ${gy + 12} Q ${gx + itemW - 22} ${gy + 12} ${gx + itemW - 22} ${gy + 34} L ${gx + itemW - 22} ${gy + itemH - 95}`}
                            fill="none"
                            stroke="#2563EB"
                            strokeWidth="16"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            opacity="0.72"
                          />
                          {/* Central pull-down wand + T-handle grip */}
                          <line
                            x1={gx + itemW / 2}
                            y1={gy + 16}
                            x2={gx + itemW / 2}
                            y2={gy + itemH - 60}
                            stroke="#2563EB"
                            strokeWidth="10"
                            strokeLinecap="round"
                            opacity="0.8"
                          />
                          <rect
                            x={gx + itemW / 2 - 46}
                            y={gy + itemH - 68}
                            width={92}
                            height={20}
                            rx={10}
                            fill="#1E3A8A"
                            stroke="#60A5FA"
                            strokeWidth="3"
                          />
                        </>
                      ) : (
                        <rect
                          x={gx}
                          y={gy}
                          width={itemW}
                          height={itemH}
                          rx={isRail ? 11 : 4}
                          fill="rgba(37, 99, 235, 0.24)"
                          stroke="#2563EB"
                          strokeWidth="4"
                          strokeDasharray="10 5"
                        />
                      )}
                      <rect
                        x={gx + itemW / 2 - 120}
                        y={gy - 42}
                        width={240}
                        height={32}
                        rx={8}
                        fill="#1E3A8A"
                      />
                      <text
                        x={gx + itemW / 2}
                        y={gy - 21}
                        textAnchor="middle"
                        fill="#FFFFFF"
                        fontSize="20"
                        fontWeight="800"
                        fontFamily="Inter, 'Plus Jakarta Sans', system-ui, sans-serif"
                      >
                        {isSubDiv ? `${g.title} X:${g.offsetX}mm` : `${g.title} Y:${g.elevationY}mm`}
                      </text>
                    </g>
                  );
                })()}

              </g>
            );
          })()}

          {/* Render 2D Elements (Carcass, Dividers, Shelves, Drawers) */}
          <CadElevationActiveModuleGroupSvg {...props} />
          {/* V5 2D CAD SceneObjects (Appliances, Sinks, Freestanding Birim Furniture) */}
          {mode === "elevation" && (project.sceneObjects || []).filter((so) => !so.isHidden).map((so) => {
            const floorSvgY = roomModH + roomOffY;
            const sx = so.position.x - roomOffX;
            const sy = floorSvgY - so.position.y - so.dimensions.height;
            const sw = so.dimensions.width;
            const sh = so.dimensions.height;
            const isSelObj = selectedSceneObjectId === so.id;
            return (
              <g
                key={so.id}
                data-testid={`elev-scene-object-${so.id}`}
                onPointerDown={(ev) => {
                  if (ev.button !== 0 || elevPanMode) return;
                  ev.stopPropagation();
                  setSelectedSceneObjectId(so.id);
                  if (so.isLocked) return;
                  const svgEl = (ev.currentTarget as Element).closest("svg") as SVGSVGElement | null;
                  const scale = svgEl ? getElevScaleMmPerPx(svgEl) : { x: 4, y: 4 };
                  document.body.dataset.birimUiDragging = "1";
                  beginHistoryTransaction();
                  setElevDraggingSceneObj({
                    id: so.id,
                    startClientX: ev.clientX,
                    startClientY: ev.clientY,
                    startX: so.position.x,
                    startY: so.position.y,
                    startZ: so.position.z,
                    mmPerPxX: scale.x,
                    mmPerPxY: scale.y,
                  });
                }}
                onContextMenu={(ev) => {
                  ev.preventDefault();
                  ev.stopPropagation();
                  setSelectedSceneObjectId(so.id);
                  setCadContextMenu({
                    x: ev.clientX,
                    y: ev.clientY,
                    headerTitle: so.name || so.sku,
                    headerSubtitle: `${Math.round(sw)}×${Math.round(sh)} mm • Kot Y:${Math.round(so.position.y)} mm`,
                    sections: [
                      {
                        title: "Sahne Objesi",
                        items: [
                          {
                            id: "elev-so-floor",
                            label: "Zemine İndir (Kot Y=0)",
                            disabled: Math.round(so.position.y) === 0 || Boolean(so.isLocked),
                            onClick: () =>
                              updateSceneObject(so.id, {
                                position: { x: so.position.x, y: 0, z: so.position.z },
                              }),
                          },
                          {
                            id: "elev-so-dup",
                            label: "Objeyi Çoğalt",
                            onClick: () => duplicateSceneObject(so.id),
                          },
                        ],
                      },
                      {
                        items: [
                          {
                            id: "elev-so-del",
                            label: "Objeyi Sil",
                            shortcut: "Del",
                            danger: true,
                            onClick: () => removeSceneObject(so.id),
                          },
                        ],
                      },
                    ],
                  });
                }}
                onClick={(ev) => {
                  ev.stopPropagation();
                  setSelectedSceneObjectId(so.id);
                }}
                className={so.isLocked ? "cursor-pointer" : "cursor-move"}
              >
                <rect
                  x={sx}
                  y={sy}
                  width={sw}
                  height={sh}
                  rx={8}
                  fill={isSelObj ? "#DBEAFE" : "#F8FAFC"}
                  fillOpacity={0.86}
                  stroke={isSelObj ? "#2563EB" : "#475569"}
                  strokeWidth={isSelObj ? 6 : 3}
                  strokeDasharray={so.category === "architectural_prop" ? "18 10" : undefined}
                />
                <text
                  x={sx + sw / 2}
                  y={sy + sh / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#0F172A"
                  fontSize={Math.max(26, Math.min(44, sw * 0.08))}
                  fontWeight="700"
                >
                  {so.sku}
                </text>
              </g>
            );
          })}
          {/* CAD Snap Guide Lines rendered ON TOP of all cabinets via refs (0 React re-renders during drag) */}
          {mode === "elevation" && elevDraggingMod && (() => {
            const snapWallLeftSvgX = -roomOffX;
            const snapFloorSvgY = roomModH + roomOffY;
            const snapWallLen = project.space.walls?.[0]?.length || 4200;
            const snapCeilH = project.space.ceilingHeight || 2600;
            const snapFs = Math.round(23 * elevLabelScale);
            return (
              <g data-testid="elev-snap-guide-lines" className="pointer-events-none">
                <g ref={snapXGroupRef} style={{ display: "none" }}>
                  <line
                    ref={snapXLineRef}
                    x1={snapWallLeftSvgX}
                    y1={snapFloorSvgY - snapCeilH - 180}
                    x2={snapWallLeftSvgX}
                    y2={snapFloorSvgY + 120}
                    stroke="#06B6D4"
                    strokeWidth={3}
                    vectorEffect="non-scaling-stroke"
                    strokeDasharray="10 6"
                  />
                  <circle
                    ref={snapXCircleRef}
                    cx={snapWallLeftSvgX}
                    cy={snapFloorSvgY}
                    r={Math.round(12 * elevLabelScale)}
                    fill="#06B6D4"
                    stroke="#FFFFFF"
                    strokeWidth="4"
                  />
                  <rect
                    ref={snapXBadgeRef}
                    x={snapWallLeftSvgX - 80}
                    y={snapFloorSvgY + 34}
                    width={160}
                    height={Math.round(42 * elevLabelScale)}
                    rx={10}
                    fill="#0891B2"
                    stroke="#FFFFFF"
                    strokeWidth="3"
                  />
                  <text
                    ref={snapXTextRef}
                    x={snapWallLeftSvgX}
                    y={snapFloorSvgY + 34 + Math.round(28 * elevLabelScale)}
                    textAnchor="middle"
                    fill="#FFFFFF"
                    fontSize={snapFs}
                    fontWeight="900"
                    fontFamily="Inter, 'Plus Jakarta Sans', system-ui, sans-serif"
                  />
                </g>
                <g ref={snapYGroupRef} style={{ display: "none" }}>
                  <line
                    ref={snapYLineRef}
                    x1={snapWallLeftSvgX - 180}
                    y1={snapFloorSvgY}
                    x2={snapWallLeftSvgX + snapWallLen + 180}
                    y2={snapFloorSvgY}
                    stroke="#EC4899"
                    strokeWidth={3}
                    vectorEffect="non-scaling-stroke"
                    strokeDasharray="10 6"
                  />
                  <rect
                    ref={snapYBadgeRef}
                    x={snapWallLeftSvgX + snapWallLen + 20}
                    y={snapFloorSvgY - 26}
                    width={Math.round(160 * elevLabelScale)}
                    height={Math.round(44 * elevLabelScale)}
                    rx={10}
                    fill="#DB2777"
                    stroke="#FFFFFF"
                    strokeWidth="3"
                  />
                  <text
                    ref={snapYTextRef}
                    x={snapWallLeftSvgX + snapWallLen + 20 + Math.round(80 * elevLabelScale)}
                    y={snapFloorSvgY + 9}
                    textAnchor="middle"
                    fill="#FFFFFF"
                    fontSize={snapFs}
                    fontWeight="900"
                    fontFamily="Inter, 'Plus Jakarta Sans', system-ui, sans-serif"
                  />
                </g>
              </g>
            );
          })()}
        </svg>
    </>
  );
};
