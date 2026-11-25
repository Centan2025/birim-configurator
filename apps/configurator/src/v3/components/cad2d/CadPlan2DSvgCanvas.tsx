"use client";


import React from "react";
import { calculateBayWidths, formatIssueHumanTitle } from "@birim/core";
import { CadPlanWallsAndObstaclesSvg } from "./CadPlanWallsAndObstaclesSvg";
import { CadPlanModuleFootprintsSvg } from "./CadPlanModuleFootprintsSvg";

import type { CadPlan2DSvgCanvasProps } from "./cad2dTypes";
export type { CadPlan2DSvgCanvasProps };

export const CadPlan2DSvgCanvas: React.FC<CadPlan2DSvgCanvasProps> = (props) => {
  const {
    activeModuleIndex,
    activePlanSnapX,
    activeSnapTarget,
    activeSpatialMetrics,
    beginHistoryTransaction,
    dragGhostPreview,
    draggingModIdx,
    draggingWallId,
    drawWallCursor,
    drawWallStart,
    elevDisplayUnit,
    errorModuleIds,
    fmtPlanDim,
    footprints,
    getSvgMmPerPx,
    handleModPointerDown,
    handleObstaclePointerDown,
    handleSceneObjectPointerDown,
    handleSvgClick,
    handleSvgContextMenu,
    handleSvgPointerMove,
    handleSvgPointerUp,
    handleWallClick,
    handleWallPointerDown,
    isDrawingWall,
    isPlacingObstacle,
    liveSpatialAlerts,
    longPress2DRef,
    mainWall,
    maxDepthZ,
    moduleCadMetrics,
    newObstacleRotY,
    newObstacleType,
    newObstacleW,
    obstaclePreviewPos,
    openPlanContextMenu,
    panPx,
    panPxRef,
    panning2D,
    pinchTrackerRef,
    project,
    removeSpaceObstacle,
    resizingPlanObject,
    rotateActiveModule90,
    selectedPlanObject,
    selectedSceneObjectId,
    setActiveModuleIndex,
    setInlineEditWallId,
    setInlineEditWallLength,
    setPanPx,
    setPanning2D,
    setPlanRowSnapBanner,
    setResizingPlanObject,
    setSelectedSceneObjectId,
    setZoom,
    showPlanDimensions,
    showPlanGrid,
    spaceObstacles,
    spaceWalls,
    ts,
    underlay,
    updateSpaceObstacle,
    updateWallSegment,
    vb,
    wallDimDisplayMode,
    zoom,
    zoomRef,
  } = props;
  return (
    <>
          <svg
            data-testid="v3-cad-plan-svg"
            viewBox={`${vb.x} ${vb.y} ${vb.width} ${vb.height}`}
            className={`w-full flex-1 min-h-0 touch-none ${
              panning2D
                ? "cursor-grabbing"
                : isDrawingWall || isPlacingObstacle
                ? "cursor-crosshair"
                : "cursor-grab"
            }`}
            onClick={handleSvgClick}
            onContextMenu={handleSvgContextMenu}
            onPointerDownCapture={(e) => {
              if (e.pointerType === "touch") {
                pinchTrackerRef.current.pointerDown(e.pointerId, e.clientX, e.clientY);
                if (pinchTrackerRef.current.isPinching()) {
                  longPress2DRef.current.cancel();
                  setPanning2D(null);
                }
              }
            }}
            onPointerDown={(e) => {
              if (e.pointerType === "touch") {
                if (pinchTrackerRef.current.isPinching()) return;
                longPress2DRef.current.start(e);
              }
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
              handleSvgPointerMove(e);
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
              handleSvgPointerUp();
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
            <CadPlanWallsAndObstaclesSvg {...props} />
            <CadPlanModuleFootprintsSvg {...props} />

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
              const combinedBottomText = `📐 ${roomTitle} (${areaStr} m²) • Oda Genişliği: ${fmtPlanDim(mainWall.length)}`;
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
                    fontFamily="Inter, 'Plus Jakarta Sans', system-ui, sans-serif"
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
                              fontFamily="Inter, 'Plus Jakarta Sans', system-ui, sans-serif"
                            >
                              {`🧲 SNAP X:${fmtPlanDim(sx)}`}
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
                        fontFamily="Inter, 'Plus Jakarta Sans', system-ui, sans-serif"
                      >
                        {`⚠️ ${al.title.startsWith("ERR_") || al.title.startsWith("WARN_") || al.title.startsWith("CHK_") ? formatIssueHumanTitle(al.title) : al.title}`}
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
                      fontFamily="Inter, 'Plus Jakarta Sans', system-ui, sans-serif"
                    >
                      {`🧲 X:${fmtPlanDim(slot.x)}`}
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
                        fontFamily="Inter, 'Plus Jakarta Sans', system-ui, sans-serif"
                      >
                        {`SİLUET: ${gm.name} (${gw}×${gd})`}
                      </text>
                    </g>
                  );
                })()}
              </g>
            )}

            {/* V5 SceneObjects in Interactive 2D Room Plan (Respecting Exact Rotation Angle `so.rotation.y`!) */}
            {(project.sceneObjects || [])
              .filter((so) => !so.isHidden)
              .map((so) => {
                const sc = so.scaleFactor || 1;
                const sw = so.dimensions.width * sc;
                const sd = so.dimensions.depth * sc;
                const sx = so.position.x;
                const sz = so.position.z;
                const rotY = so.rotation?.y || 0;
                const cx = sx + sw / 2;
                const cz = sz + sd / 2;
                const isSelObj = selectedSceneObjectId === so.id;
                const isTableObj =
                  String(so.visualKind) === "dining_table" ||
                  so.visualKind === "coffee_table" ||
                  so.name.toLowerCase().includes("masa");
                let textRot = 0;
                let normRot = -rotY;
                while (normRot <= -180) normRot += 360;
                while (normRot > 180) normRot -= 360;
                if (normRot > 90 || normRot < -90) textRot = 180;

                return (
                  <g
                    key={`plan_so_${so.id}`}
                    data-testid={`plan-scene-object-${so.id}`}
                    transform={`rotate(${-rotY}, ${cx}, ${cz})`}
                    onPointerDown={(ev) => handleSceneObjectPointerDown(ev, so)}
                    onContextMenu={(ev) =>
                      openPlanContextMenu(ev, {
                        kind: "sceneObject",
                        soId: so.id,
                        soName: so.name,
                        rotationY: rotY,
                      })
                    }
                    onClick={(ev) => {
                      ev.stopPropagation();
                      setSelectedSceneObjectId(so.id);
                    }}
                    className={so.isLocked ? "cursor-pointer" : "cursor-move"}
                  >
                    <rect
                      x={sx}
                      y={sz}
                      width={sw}
                      height={sd}
                      rx={so.visualKind === "structural_column" ? 2 : isTableObj ? 18 : 10}
                      fill={
                        so.visualKind === "structural_column"
                          ? "url(#column_hatch)"
                          : isSelObj
                          ? "#DBEAFE"
                          : isTableObj
                          ? "#EFE6D8"
                          : "#F8FAFC"
                      }
                      fillOpacity={so.visualKind === "structural_column" ? 0.96 : 0.92}
                      stroke={
                        isSelObj
                          ? "#2563EB"
                          : so.visualKind === "structural_column"
                          ? "#1C1917"
                          : isTableObj
                          ? "#78350F"
                          : "#475569"
                      }
                      strokeWidth={isSelObj ? 6 : so.visualKind === "structural_column" ? 5 : 3.5}
                      strokeDasharray={
                        so.category === "architectural_prop" && so.visualKind !== "structural_column"
                          ? "16 8"
                          : undefined
                      }
                    />
                    <g transform={`translate(${cx}, ${cz}) rotate(${textRot})`}>
                      <text
                        x={0}
                        y={-12}
                        textAnchor="middle"
                        fill="#0F172A"
                        fontSize={Math.max(22, Math.min(34, sw * 0.055))}
                        fontWeight="800"
                      >
                        {so.name}
                      </text>
                      <text
                        x={0}
                        y={18}
                        textAnchor="middle"
                        fill="#475569"
                        fontSize={Math.max(18, Math.min(26, sw * 0.045))}
                        fontWeight="700"
                        fontFamily="Inter, 'Plus Jakarta Sans', system-ui, sans-serif"
                      >
                        {`${fmtPlanDim(sw, false)}×${fmtPlanDim(sd)}${rotY ? ` • ${Math.round(rotY)}°` : ""}`}
                      </text>
                    </g>
                  </g>
                );
              })}

            {/* Reflected Ceiling Plan (RCP — Mimari Tavan İzdüşümü) Overlay */}
            {project.space.ceilingConfig?.enabled && (() => {
              const cc = project.space.ceilingConfig!;
              const cType = cc.ceilingType || "flat_plaster";
              const rcpDepth = Math.max(2200, maxDepthZ - 420);
              const soffitD = cc.soffitDepthMm || 620;
              return (
                <g data-testid="plan-rcp-ceiling-overlay" className="pointer-events-none" opacity={0.78}>
                  <rect
                    x={0}
                    y={0}
                    width={mainWall.length}
                    height={rcpDepth}
                    fill="none"
                    stroke="#A8A29E"
                    strokeWidth="2.5"
                    strokeDasharray="18 10"
                  />
                  {(cType === "dropped_perimeter_cove" || cType === "gypsum_soffit_bulkhead") && (
                    <rect
                      x={0}
                      y={0}
                      width={mainWall.length}
                      height={soffitD}
                      fill="rgba(245, 158, 11, 0.06)"
                      stroke="#D97706"
                      strokeWidth="3"
                      strokeDasharray="14 8"
                    />
                  )}
                  {(cType === "exposed_wood_beams" || cType === "coffered_baffle") && (() => {
                    const pitch = cType === "exposed_wood_beams" ? cc.beamSpacingMm || 600 : Math.max(180, (cc.bafflePitchMm || 120) * 2);
                    const cnt = Math.min(28, Math.max(2, Math.floor(mainWall.length / pitch)));
                    return Array.from({ length: cnt }).map((_, bi) => {
                      const bx = Math.round(((bi + 0.5) * mainWall.length) / cnt);
                      return (
                        <line
                          key={`rcp_bm_${bi}`}
                          x1={bx}
                          y1={0}
                          x2={bx}
                          y2={rcpDepth}
                          stroke="#92400E"
                          strokeWidth="2"
                          strokeDasharray="10 10"
                        />
                      );
                    });
                  })()}
                  {cc.hasRecessedSpots !== false &&
                    Array.from({ length: Math.max(2, Math.round(mainWall.length / 950)) }).map((_, si, arr) => {
                      const sx = Math.round(((si + 1) * mainWall.length) / (arr.length + 1));
                      const sz = cType === "dropped_perimeter_cove" ? Math.round(soffitD * 0.52) : 680;
                      return (
                        <g key={`rcp_spot_${si}`}>
                          <circle cx={sx} cy={sz} r={22} fill="#FEF3C7" stroke="#D97706" strokeWidth="2.5" />
                          <line x1={sx - 14} y1={sz} x2={sx + 14} y2={sz} stroke="#B45309" strokeWidth="2" />
                          <line x1={sx} y1={sz - 14} x2={sx} y2={sz + 14} stroke="#B45309" strokeWidth="2" />
                        </g>
                      );
                    })}
                </g>
              );
            })()}

            {/* FOREGROUND STRUCTURAL COLUMN & BEAM LAYER: Always rendered ABOVE cabinet footprints & rugs so a 3D column NEVER disappears behind opaque modules in 2D Plan! */}
            {spaceObstacles
              .filter(
                (obs) =>
                  obs.type === "column" ||
                  obs.type === "beam" ||
                  obs.type === "protrusion" ||
                  obs.type === "partition"
              )
              .map((obs) => {
                const isSelectedObs =
                  selectedPlanObject?.kind === "obstacle" && selectedPlanObject.id === obs.id;
                const isBeam = obs.type === "beam";
                const rotNorm = (((obs.rotationY || 0) % 360) + 360) % 360;
                const isRot90 = rotNorm === 90 || rotNorm === 270;
                const rawW = Math.max(80, obs.dimensions.width || 300);
                const rawD = Math.max(80, obs.dimensions.depth || rawW);
                const effW = isRot90 ? rawD : rawW;
                const effD = isRot90 ? rawW : rawD;
                const ox = obs.position.x;
                const oz = obs.position.z;

                const collidesWithModule =
                  !isBeam &&
                  footprints.some(
                    (fp) =>
                      ox < fp.x + fp.planWidth - 2 &&
                      ox + effW > fp.x + 2 &&
                      oz < fp.z + fp.planDepth - 2 &&
                      oz + effD > fp.z + 2
                  );

                const colTxt = `${
                  isBeam ? "KİRİŞ" : obs.type === "partition" ? "BÖLME DUVAR" : "KOLON"
                } (${fmtPlanDim(effW, false)}×${fmtPlanDim(effD)})`;
                const colFont = Math.round(22 * ts);
                const colPillW = Math.max(
                  Math.round(175 * ts),
                  Math.round(colTxt.length * colFont * 0.62 + 24 * ts)
                );
                const colPillH = Math.round(36 * ts);

                return (
                  <g
                    key={`fg_col_${obs.id}`}
                    data-testid={`plan-column-foreground-${obs.id}`}
                    onPointerDown={(e) => handleObstaclePointerDown(e, obs)}
                    onContextMenu={(e) =>
                      openPlanContextMenu(e, {
                        kind: "obstacle",
                        obsId: obs.id,
                        obsName: obs.name || "Taşıyıcı Kolon",
                        rotationY: obs.rotationY || 0,
                      })
                    }
                    onDoubleClick={() => removeSpaceObstacle(obs.id)}
                    className="cursor-move"
                  >
                    {collidesWithModule && (
                      <rect
                        x={ox - 10}
                        y={oz - 10}
                        width={effW + 20}
                        height={effD + 20}
                        rx={8}
                        fill="rgba(220, 38, 38, 0.14)"
                        stroke="#DC2626"
                        strokeWidth="4.5"
                        strokeDasharray="12 6"
                      />
                    )}
                    <rect
                      x={ox}
                      y={oz}
                      width={effW}
                      height={effD}
                      fill="#EAE5DC"
                      fillOpacity={0.94}
                    />
                    <rect
                      x={ox}
                      y={oz}
                      width={effW}
                      height={effD}
                      fill="url(#column_hatch)"
                      stroke={isSelectedObs || collidesWithModule ? "#DC2626" : "#1C1917"}
                      strokeWidth={isSelectedObs ? "6.5" : "4.5"}
                      strokeDasharray={isBeam ? "12 6" : undefined}
                    />
                    {/* Structural cross diagonals inside reinforced concrete column */}
                    {!isBeam && (
                      <g stroke="#44403C" strokeWidth="1.8" opacity={0.55} className="pointer-events-none">
                        <line x1={ox} y1={oz} x2={ox + effW} y2={oz + effD} />
                        <line x1={ox + effW} y1={oz} x2={ox} y2={oz + effD} />
                      </g>
                    )}
                    <g className="pointer-events-none">
                      <rect
                        x={ox + effW / 2 - colPillW / 2}
                        y={oz + effD + Math.round(8 * ts)}
                        width={colPillW}
                        height={colPillH}
                        rx={Math.round(8 * ts)}
                        fill="rgba(255, 255, 255, 0.96)"
                        stroke={isSelectedObs || collidesWithModule ? "#DC2626" : "#292524"}
                        strokeWidth="2.5"
                      />
                      <text
                        x={ox + effW / 2}
                        y={oz + effD + Math.round(8 * ts) + Math.round(colPillH * 0.72)}
                        textAnchor="middle"
                        fill={isSelectedObs || collidesWithModule ? "#B91C1C" : "#141413"}
                        fontSize={colFont}
                        fontWeight="900"
                        fontFamily="Inter, 'Plus Jakarta Sans', system-ui, sans-serif"
                      >
                        {colTxt}
                      </text>
                    </g>
                  </g>
                );
              })}

            {/* Reflected Ceiling Plan (RCP — Mimari Tavan İzdüşümü) Overlay */}
            {project.space.ceilingConfig?.enabled && (() => {
              const cc = project.space.ceilingConfig!;
              const cType = cc.ceilingType || "flat_plaster";
              const rcpDepth = Math.max(2200, maxDepthZ - 420);
              const soffitD = cc.soffitDepthMm || 620;
              return (
                <g data-testid="plan-rcp-ceiling-overlay" className="pointer-events-none" opacity={0.78}>
                  <rect
                    x={0}
                    y={0}
                    width={mainWall.length}
                    height={rcpDepth}
                    fill="none"
                    stroke="#A8A29E"
                    strokeWidth="2.5"
                    strokeDasharray="18 10"
                  />
                  {(cType === "dropped_perimeter_cove" || cType === "gypsum_soffit_bulkhead") && (
                    <rect
                      x={0}
                      y={0}
                      width={mainWall.length}
                      height={soffitD}
                      fill="rgba(245, 158, 11, 0.06)"
                      stroke="#D97706"
                      strokeWidth="3"
                      strokeDasharray="14 8"
                    />
                  )}
                  {(cType === "exposed_wood_beams" || cType === "coffered_baffle") && (() => {
                    const pitch = cType === "exposed_wood_beams" ? cc.beamSpacingMm || 600 : Math.max(180, (cc.bafflePitchMm || 120) * 2);
                    const cnt = Math.min(28, Math.max(2, Math.floor(mainWall.length / pitch)));
                    return Array.from({ length: cnt }).map((_, bi) => {
                      const bx = Math.round(((bi + 0.5) * mainWall.length) / cnt);
                      return (
                        <line
                          key={`rcp_bm_${bi}`}
                          x1={bx}
                          y1={0}
                          x2={bx}
                          y2={rcpDepth}
                          stroke="#92400E"
                          strokeWidth="2"
                          strokeDasharray="10 10"
                        />
                      );
                    });
                  })()}
                  {cc.hasRecessedSpots !== false &&
                    Array.from({ length: Math.max(2, Math.round(mainWall.length / 950)) }).map((_, si, arr) => {
                      const sx = Math.round(((si + 1) * mainWall.length) / (arr.length + 1));
                      const sz = cType === "dropped_perimeter_cove" ? Math.round(soffitD * 0.52) : 680;
                      return (
                        <g key={`rcp_spot_${si}`}>
                          <circle cx={sx} cy={sz} r={22} fill="#FEF3C7" stroke="#D97706" strokeWidth="2.5" />
                          <line x1={sx - 14} y1={sz} x2={sx + 14} y2={sz} stroke="#B45309" strokeWidth="2" />
                          <line x1={sx} y1={sz - 14} x2={sx} y2={sz + 14} stroke="#B45309" strokeWidth="2" />
                        </g>
                      );
                    })}
                </g>
              );
            })()}


          </svg>
    </>
  );
};
