"use client";


import React from "react";

import type { CadPlan2DSvgCanvasProps } from "./cad2dTypes";

export const CadPlanWallsAndObstaclesSvg: React.FC<CadPlan2DSvgCanvasProps> = (props) => {
  const { activeSnapTarget, beginHistoryTransaction, draggingWallId, drawWallCursor, drawWallStart, fmtPlanDim, getSvgMmPerPx, handleObstaclePointerDown, handleWallClick, handleWallPointerDown, isDrawingWall, isPlacingObstacle, mainWall, newObstacleRotY, newObstacleType, newObstacleW, obstaclePreviewPos, openPlanContextMenu, removeSpaceObstacle, resizingPlanObject, selectedPlanObject, setInlineEditWallId, setInlineEditWallLength, setPlanRowSnapBanner, setResizingPlanObject, showPlanDimensions, spaceObstacles, spaceWalls, ts, updateSpaceObstacle, updateWallSegment, wallDimDisplayMode } = props;
  return (
    <>
            {spaceWalls.map((wall) => {
              const isSelectedWall =
                selectedPlanObject?.kind === "wall" && selectedPlanObject.id === wall.id;
              const isSideWall = wall.rotationY === 90;
              const isCustomAngle = wall.rotationY !== 0 && wall.rotationY !== 90;
              const computeMeasuredSpan = (): { start: number; end: number; length: number } => {
                if (isCustomAngle) {
                  const s = wall.position.x;
                  const e = wall.position.x + wall.length;
                  if (wallDimDisplayMode === "outer") {
                    return { start: s - wall.thickness, end: e + wall.thickness, length: wall.length + wall.thickness * 2 };
                  }
                  if (wallDimDisplayMode === "plinth") {
                    return { start: s + 20, end: e - 20, length: Math.max(200, wall.length - 40) };
                  }
                  return { start: s, end: e, length: wall.length };
                }
                if (isSideWall) {
                  let zStart = wall.position.z;
                  let zEnd = wall.position.z + wall.length;
                  if (wallDimDisplayMode === "outer") {
                    return { start: zStart - wall.thickness, end: zEnd + wall.thickness, length: wall.length + wall.thickness * 2 };
                  }
                  if (wallDimDisplayMode === "plinth") {
                    return { start: zStart + 20, end: zEnd - 20, length: Math.max(200, wall.length - 40) };
                  }
                  const zMid = (zStart + zEnd) / 2;
                  const isRight = wall.position.x > 0;
                  const wXMin = isRight ? wall.position.x : wall.position.x - wall.thickness;
                  const wXMax = isRight ? wall.position.x + wall.thickness : wall.position.x;
                  for (const other of spaceWalls) {
                    if (other.id === wall.id || other.rotationY !== 0) continue;
                    const oXMin = other.position.x;
                    const oXMax = other.position.x + other.length;
                    if (oXMin <= wXMax + 2 && oXMax >= wXMin - 2) {
                      const oZMin = other.position.z - other.thickness;
                      const oZMax = other.position.z;
                      const oZMid = (oZMin + oZMax) / 2;
                      if (oZMax >= zStart && oZMin <= zEnd) {
                        if (oZMid <= zMid) zStart = Math.max(zStart, oZMax);
                        else zEnd = Math.min(zEnd, oZMin);
                      }
                    }
                  }
                  return { start: zStart, end: zEnd, length: Math.max(100, Math.round(zEnd - zStart)) };
                }
                let xStart = wall.position.x;
                let xEnd = wall.position.x + wall.length;
                if (wallDimDisplayMode === "outer") {
                  return { start: xStart - wall.thickness, end: xEnd + wall.thickness, length: wall.length + wall.thickness * 2 };
                }
                if (wallDimDisplayMode === "plinth") {
                  return { start: xStart + 20, end: xEnd - 20, length: Math.max(200, wall.length - 40) };
                }
                const xMid = (xStart + xEnd) / 2;
                const wZMin = wall.position.z - wall.thickness;
                const wZMax = wall.position.z;
                for (const other of spaceWalls) {
                  if (other.id === wall.id || other.rotationY !== 90) continue;
                  const oZMin = other.position.z;
                  const oZMax = other.position.z + other.length;
                  if (oZMin <= wZMax + 2 && oZMax >= wZMin - 2) {
                    const oIsRight = other.position.x > 0;
                    const oXMin = oIsRight ? other.position.x : other.position.x - other.thickness;
                    const oXMax = oIsRight ? other.position.x + other.thickness : other.position.x;
                    const oXMid = (oXMin + oXMax) / 2;
                    if (oXMax >= xStart && oXMin <= xEnd) {
                      if (oXMid <= xMid) xStart = Math.max(xStart, oXMax);
                      else xEnd = Math.min(xEnd, oXMin);
                    }
                  }
                }
                return { start: xStart, end: xEnd, length: Math.max(100, Math.round(xEnd - xStart)) };
              };
              const dimSpan = computeMeasuredSpan();
              const displayedWallLen = dimSpan.length;
              const modeSuffix =
                wallDimDisplayMode === "outer"
                  ? " (Dış)"
                  : wallDimDisplayMode === "plinth"
                  ? " (Soket)"
                  : "";
              const angleSuffix = isCustomAngle ? ` (${wall.rotationY}°)` : "";
              const wallText = `${wall.name}${modeSuffix}: ${fmtPlanDim(displayedWallLen)}${angleSuffix}`;
              const wallFont = Math.round(32 * ts);
              const pillH = Math.round(54 * ts);
              const pillW = Math.max(
                Math.round(280 * ts),
                Math.round(wallText.length * wallFont * 0.62 + 44 * ts)
              );
              const pillRx = Math.round(12 * ts);
              const pillStrokeW = Math.round(3.5 * ts);
              if (isCustomAngle) {
                const spanMidX = (dimSpan.start + dimSpan.end) / 2;
                const dimY = wall.position.z - wall.thickness - Math.round(70 * ts);
                const faceY = wall.position.z - wall.thickness;
                return (
                  <g
                    key={wall.id}
                    data-testid={`plan-wall-${wall.id}`}
                    onPointerDown={(e) => handleWallPointerDown(e, wall)}
                    onContextMenu={(e) =>
                      openPlanContextMenu(e, {
                        kind: "wall",
                        wallId: wall.id,
                        wallName: wall.name,
                        rotationY: wall.rotationY,
                        length: wall.length,
                      })
                    }
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
                    {showPlanDimensions && (
                      <>
                        <line x1={dimSpan.start} y1={faceY} x2={dimSpan.start} y2={dimY - 18} stroke="#64748B" strokeWidth="2.5" strokeDasharray="6 4" />
                        <line x1={dimSpan.end} y1={faceY} x2={dimSpan.end} y2={dimY - 18} stroke="#64748B" strokeWidth="2.5" strokeDasharray="6 4" />
                        <line x1={dimSpan.start} y1={dimY - 18} x2={dimSpan.start} y2={dimY + 18} stroke="#44403C" strokeWidth="3.5" />
                        <line x1={dimSpan.end} y1={dimY - 18} x2={dimSpan.end} y2={dimY + 18} stroke="#44403C" strokeWidth="3.5" />
                        <line x1={dimSpan.start} y1={dimY} x2={dimSpan.end} y2={dimY} stroke="#44403C" strokeWidth="3.5" />
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
                            x={spanMidX - pillW / 2}
                            y={dimY - pillH / 2}
                            width={pillW}
                            height={pillH}
                            rx={pillRx}
                            fill="#FFFFFF"
                            stroke="#2563EB"
                            strokeWidth={pillStrokeW}
                          />
                          <text
                            x={spanMidX}
                            y={dimY + Math.round(wallFont * 0.35)}
                            textAnchor="middle"
                            fill="#0F172A"
                            fontSize={wallFont}
                            fontWeight="900"
                            fontFamily="Inter, 'Plus Jakarta Sans', system-ui, sans-serif"
                          >
                            {wallText}
                          </text>
                        </g>
                      </>
                    )}
                    {isSelectedWall && (
                      <g
                        data-testid={`plan-wall-resize-end-${wall.id}`}
                        onPointerDown={(e) => {
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
                    )}
                  </g>
                );
              }
              if (isSideWall) {
                const spanMidZ = (dimSpan.start + dimSpan.end) / 2;
                const isRightReturn = wall.position.x > 0;
                const rectX = isRightReturn ? wall.position.x : wall.position.x - wall.thickness;
                const faceX = isRightReturn ? wall.position.x + wall.thickness : wall.position.x - wall.thickness;
                const rotOffset = Math.round(70 * ts);
                const rotX = isRightReturn
                  ? wall.position.x + wall.thickness + rotOffset
                  : wall.position.x - wall.thickness - rotOffset;
                const tickExt = isRightReturn ? rotX + 18 : rotX - 18;
                return (
                  <g
                    key={wall.id}
                    data-testid={`plan-wall-${wall.id}`}
                    onPointerDown={(e) => handleWallPointerDown(e, wall)}
                    onContextMenu={(e) =>
                      openPlanContextMenu(e, {
                        kind: "wall",
                        wallId: wall.id,
                        wallName: wall.name,
                        rotationY: wall.rotationY,
                        length: wall.length,
                      })
                    }
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
                    {showPlanDimensions && (
                      <>
                        <line x1={faceX} y1={dimSpan.start} x2={tickExt} y2={dimSpan.start} stroke="#64748B" strokeWidth="2.5" strokeDasharray="6 4" />
                        <line x1={faceX} y1={dimSpan.end} x2={tickExt} y2={dimSpan.end} stroke="#64748B" strokeWidth="2.5" strokeDasharray="6 4" />
                        <line x1={rotX - 18} y1={dimSpan.start} x2={rotX + 18} y2={dimSpan.start} stroke="#44403C" strokeWidth="3.5" />
                        <line x1={rotX - 18} y1={dimSpan.end} x2={rotX + 18} y2={dimSpan.end} stroke="#44403C" strokeWidth="3.5" />
                        <line x1={rotX} y1={dimSpan.start} x2={rotX} y2={dimSpan.end} stroke="#44403C" strokeWidth="3.5" />
                        <g
                          transform={`rotate(-90 ${rotX} ${spanMidZ})`}
                          data-testid={`plan-wall-dim-badge-${wall.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setInlineEditWallId(wall.id);
                            setInlineEditWallLength(wall.length);
                          }}
                          className="cursor-pointer"
                        >
                          <rect
                            x={rotX - pillW / 2}
                            y={spanMidZ - pillH / 2}
                            width={pillW}
                            height={pillH}
                            rx={pillRx}
                            fill="#FFFFFF"
                            stroke="#2563EB"
                            strokeWidth={pillStrokeW}
                          />
                          <text
                            x={rotX}
                            y={spanMidZ + Math.round(wallFont * 0.35)}
                            textAnchor="middle"
                            fill="#0F172A"
                            fontSize={wallFont}
                            fontWeight="900"
                            fontFamily="Inter, 'Plus Jakarta Sans', system-ui, sans-serif"
                          >
                            {wallText}
                          </text>
                        </g>
                      </>
                    )}
                    
                    {isSelectedWall && (
                      <g>
                        {/* On-Canvas 90° Wall Rotate Button */}
                        <g
                          data-testid={`plan-oncanvas-rotate-wall-${wall.id}`}
                          onPointerDown={(e) => e.stopPropagation()}
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
                          onPointerDown={(e) => {
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
              const wallMidX = (dimSpan.start + dimSpan.end) / 2;
              const dimY = wall.position.z - wall.thickness - Math.round(70 * ts);
              const faceY = wall.position.z - wall.thickness;
              return (
                <g
                  key={wall.id}
                  data-testid={`plan-wall-${wall.id}`}
                  onPointerDown={(e) => handleWallPointerDown(e, wall)}
                  onContextMenu={(e) =>
                    openPlanContextMenu(e, {
                      kind: "wall",
                      wallId: wall.id,
                      wallName: wall.name,
                      rotationY: wall.rotationY,
                      length: wall.length,
                    })
                  }
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
                  {/* Witness Extension Lines + End Ticks + Main Dimension Line */}
                  {showPlanDimensions && (
                    <>
                      <line
                        x1={dimSpan.start}
                        y1={faceY}
                        x2={dimSpan.start}
                        y2={dimY - 20}
                        stroke="#64748B"
                        strokeWidth="2.5"
                        strokeDasharray="6 4"
                      />
                      <line
                        x1={dimSpan.end}
                        y1={faceY}
                        x2={dimSpan.end}
                        y2={dimY - 20}
                        stroke="#64748B"
                        strokeWidth="2.5"
                        strokeDasharray="6 4"
                      />
                      <line
                        x1={dimSpan.start}
                        y1={dimY - 20}
                        x2={dimSpan.start}
                        y2={dimY + 20}
                        stroke="#44403C"
                        strokeWidth="3.5"
                      />
                      <line
                        x1={dimSpan.end}
                        y1={dimY - 20}
                        x2={dimSpan.end}
                        y2={dimY + 20}
                        stroke="#44403C"
                        strokeWidth="3.5"
                      />
                      <line
                        x1={dimSpan.start}
                        y1={dimY}
                        x2={dimSpan.end}
                        y2={dimY}
                        stroke="#44403C"
                        strokeWidth="3.5"
                      />
                    </>
                  )}
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
                        fontFamily="Inter, 'Plus Jakarta Sans', system-ui, sans-serif"
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
                        onPointerDown={(e) => e.stopPropagation()}
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
                        onPointerDown={(e) => {
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
                        fontFamily="Inter, 'Plus Jakarta Sans', system-ui, sans-serif"
                      >
                        {fmtPlanDim(previewLen)} ({previewAngle}°)
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
                  fontFamily="Inter, 'Plus Jakarta Sans', system-ui, sans-serif"
                >
                  ◎ Yakalandı: {activeSnapTarget.label}
                </text>
              </g>
            )}

            {/* Live Click-to-Place Obstacle Ghost Preview (Aligned Parallel to Target/Hovered Wall!) */}
            {isPlacingObstacle && obstaclePreviewPos && (() => {
              const prevRot = obstaclePreviewPos.rotY ?? newObstacleRotY;
              const ghostH = newObstacleType === "column" || newObstacleType === "beam" ? 280 : 140;
              return (
                <g
                  data-testid="plan-obstacle-ghost-preview"
                  opacity={0.82}
                  transform={`rotate(${prevRot} ${obstaclePreviewPos.x} ${obstaclePreviewPos.z})`}
                >
                  <rect
                    x={obstaclePreviewPos.x}
                    y={obstaclePreviewPos.z - ghostH * 0.5}
                    width={newObstacleW}
                    height={ghostH}
                    fill="#38BDF8"
                    stroke="#0284C7"
                    strokeWidth="5"
                    strokeDasharray="12 6"
                  />
                  <text
                    x={obstaclePreviewPos.x + newObstacleW / 2}
                    y={obstaclePreviewPos.z - ghostH * 0.5 - 16}
                    textAnchor="middle"
                    fill="#0369A1"
                    fontSize="20"
                    fontWeight="800"
                    fontFamily="Inter, 'Plus Jakarta Sans', system-ui, sans-serif"
                  >
                    🎯 {obstaclePreviewPos.wallName ? `${obstaclePreviewPos.wallName} (${prevRot}°)` : `Konumlandır (${fmtPlanDim(obstaclePreviewPos.x, false)}, ${fmtPlanDim(obstaclePreviewPos.z)})`}
                  </text>
                </g>
              );
            })()}

            {/* 2. Architectural Obstacles (Window, Door, Column, Beam, Plumbing) */}
            {spaceObstacles.map((obs) => {
              const isSelectedObs =
                selectedPlanObject?.kind === "obstacle" && selectedPlanObject.id === obs.id;
              if (obs.type === "window" || obs.type === "door") {
                const isDoor = obs.type === "door";
                const rotY = (((obs.rotationY || 0) % 360) + 360) % 360;
                const isSideWallObs = Math.abs(rotY - 90) < 0.5 || Math.abs(rotY - 270) < 0.5;
                const isCustomAngleObs = !isSideWallObs && Math.abs(rotY) > 0.5;
                const ow = obs.dimensions.width;
                const wallT = mainWall.thickness - 40;
                const isRightSwing = obs.doorSwing === "right";
                const isOutward = obs.doorOpenSide === "outward";
                const arcR = Math.round(ow * 0.85);

                const handleMirrorSwingClick = (e: React.MouseEvent) => {
                  e.stopPropagation();
                  const nextSwing = isRightSwing ? "left" : "right";
                  updateSpaceObstacle(obs.id, { doorSwing: nextSwing });
                  setPlanRowSnapBanner(
                    `⇄ ${obs.name} Aynalandı: ${nextSwing === "right" ? "Sağ Menteşe / Kanat" : "Sol Menteşe / Kanat"}`
                  );
                  setTimeout(() => setPlanRowSnapBanner(null), 2200);
                };

                const handleMirrorOpenSideClick = (e: React.MouseEvent) => {
                  e.stopPropagation();
                  const nextSide = isOutward ? "inward" : "outward";
                  updateSpaceObstacle(obs.id, { doorOpenSide: nextSide });
                  setPlanRowSnapBanner(
                    `⇅ ${obs.name} Açılım Tarafı Aynalandı: ${nextSide === "outward" ? "Dışa Açılır" : "İçe Açılır"}`
                  );
                  setTimeout(() => setPlanRowSnapBanner(null), 2200);
                };

                if (isSideWallObs) {
                  const isRightRoomWall = obs.position.x > (mainWall.length || 3600) * 0.45;
                  const sideX =
                    obs.position.x <= 40
                      ? -mainWall.thickness + 20
                      : isRightRoomWall
                      ? obs.position.x + 20
                      : obs.position.x;
                  const sideZ = obs.position.z;
                  const inwardDirX = isRightRoomWall ? -1 : 1;
                  const swingDirX = isOutward ? -inwardDirX : inwardDirX;
                  const doorFaceX = swingDirX > 0 ? sideX + wallT : sideX;
                  const hingeZ = isRightSwing ? sideZ + ow : sideZ;
                  const latchZ = isRightSwing ? sideZ + ow - arcR : sideZ + arcR;
                  const sweepFlag = swingDirX > 0 ? (isRightSwing ? 1 : 0) : isRightSwing ? 0 : 1;
                  const labelX = isRightRoomWall ? sideX + wallT + 28 : sideX - 24;
                  const btnColX = swingDirX > 0 ? sideX + wallT + 46 : sideX - 46;

                  return (
                    <g
                      key={obs.id}
                      data-testid={`plan-obstacle-${obs.id}`}
                      onPointerDown={(e) => handleObstaclePointerDown(e, obs)}
                      onContextMenu={(e) =>
                        openPlanContextMenu(e, {
                          kind: "obstacle",
                          obsId: obs.id,
                          obsName: obs.name || "Mimari Engel",
                          rotationY: obs.rotationY || 0,
                        })
                      }
                      onDoubleClick={handleMirrorSwingClick}
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
                          <path
                            d={`M ${doorFaceX} ${hingeZ} L ${doorFaceX} ${latchZ} A ${arcR} ${arcR} 0 0 ${sweepFlag} ${doorFaceX + swingDirX * arcR} ${hingeZ} Z`}
                            fill="rgba(253, 230, 138, 0.24)"
                            stroke="#D97706"
                            strokeWidth="3.5"
                            strokeDasharray="12 6"
                          />
                          <line
                            x1={doorFaceX}
                            y1={hingeZ}
                            x2={doorFaceX + swingDirX * arcR}
                            y2={hingeZ}
                            stroke="#B45309"
                            strokeWidth="6"
                          />
                        </g>
                      )}
                      <g transform={`rotate(-90 ${labelX} ${sideZ + ow / 2})`} className="pointer-events-none">
                        <text
                          x={labelX}
                          y={sideZ + ow / 2}
                          textAnchor="middle"
                          fill={isDoor ? "#92400E" : "#0369A1"}
                          fontSize="22"
                          fontWeight="800"
                          fontFamily="Inter, 'Plus Jakarta Sans', system-ui, sans-serif"
                        >
                          {isDoor ? "🚪 YAN KAPI" : "🪟 YAN PENCERE"} ({fmtPlanDim(ow, false)}×{fmtPlanDim(obs.dimensions.height)} • Z:{fmtPlanDim(obs.position.z)})
                        </text>
                      </g>

                      {isSelectedObs && (
                        <g>
                          {/* 1. On-Canvas Mirror Hinge/Leaf Button (⇄) */}
                          <g
                            data-testid={`plan-oncanvas-mirror-swing-obs-${obs.id}`}
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={handleMirrorSwingClick}
                            className="cursor-pointer"
                          >
                            <circle cx={btnColX} cy={sideZ + ow / 2 - (isDoor ? 64 : 34)} r={26} fill="#2563EB" stroke="#FFFFFF" strokeWidth="3.5" />
                            <text x={btnColX} y={sideZ + ow / 2 - (isDoor ? 56 : 26)} textAnchor="middle" fill="#FFFFFF" fontSize="22" fontWeight="900">⇄</text>
                          </g>
                          {/* 2. On-Canvas Mirror Inward/Outward Button (⇅) */}
                          {isDoor && (
                            <g
                              data-testid={`plan-oncanvas-mirror-side-obs-${obs.id}`}
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={handleMirrorOpenSideClick}
                              className="cursor-pointer"
                            >
                              <circle cx={btnColX} cy={sideZ + ow / 2} r={26} fill="#059669" stroke="#FFFFFF" strokeWidth="3.5" />
                              <text x={btnColX} y={sideZ + ow / 2 + 8} textAnchor="middle" fill="#FFFFFF" fontSize="22" fontWeight="900">⇅</text>
                            </g>
                          )}
                          {/* 3. On-Canvas 90° Rotate Button (🔄) */}
                          <g
                            data-testid={`plan-oncanvas-rotate-obs-${obs.id}`}
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              updateSpaceObstacle(obs.id, {
                                rotationY: 0,
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
                            <circle cx={btnColX} cy={sideZ + ow / 2 + (isDoor ? 64 : 34)} r={26} fill="#D97706" stroke="#FFFFFF" strokeWidth="3.5" />
                            <text x={btnColX} y={sideZ + ow / 2 + (isDoor ? 72 : 42)} textAnchor="middle" fill="#FFFFFF" fontSize="20" fontWeight="900">🔄</text>
                          </g>
                          {/* Top/Start Edge Resize Handle (▲) */}
                          <g
                            data-testid={`plan-obs-resize-start-${obs.id}`}
                            onPointerDown={(e) => {
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
                            <rect x={sideX - 8} y={sideZ - 18} width={wallT + 16} height={36} rx={8} fill="#0284C7" stroke="#FFFFFF" strokeWidth="3" />
                            <text x={sideX + wallT / 2} y={sideZ + 7} textAnchor="middle" fill="#FFFFFF" fontSize="20" fontWeight="900">▲</text>
                          </g>
                          {/* Bottom/End Edge Resize Handle (▼) */}
                          <g
                            data-testid={`plan-obs-resize-end-${obs.id}`}
                            onPointerDown={(e) => {
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
                            <rect x={sideX - 8} y={sideZ + ow - 18} width={wallT + 16} height={36} rx={8} fill="#0284C7" stroke="#FFFFFF" strokeWidth="3" />
                            <text x={sideX + wallT / 2} y={sideZ + ow + 7} textAnchor="middle" fill="#FFFFFF" fontSize="20" fontWeight="900">▼</text>
                          </g>
                        </g>
                      )}
                    </g>
                  );
                }

                if (isCustomAngleObs) {
                  // Angled or 180° Wall Window / Door: aligned 1:1 with wall's `rotate(rotY obs.position.x obs.position.z)` frame!
                  const locY = obs.position.z - mainWall.thickness + 20;
                  const rad = (rotY * Math.PI) / 180;
                  const midWorldX = obs.position.x + Math.cos(rad) * (ow * 0.5);
                  const midWorldZ = obs.position.z + Math.sin(rad) * (ow * 0.5);
                  // Local +Y in SVG `rotate(rotY)` corresponds to world `(-sin rad, cos rad)`
                  const nLocalPlusY = { x: -Math.sin(rad), z: Math.cos(rad) };
                  const toRoomCenter = { x: (mainWall.length || 3600) * 0.5 - midWorldX, z: 1100 - midWorldZ };
                  const inwardSignY = nLocalPlusY.x * toRoomCenter.x + nLocalPlusY.z * toRoomCenter.z >= 0 ? 1 : -1;
                  const swingSignY = isOutward ? -inwardSignY : inwardSignY;
                  const doorFaceY = swingSignY > 0 ? locY + wallT : locY;
                  const hingeX = isRightSwing ? obs.position.x + ow : obs.position.x;
                  const latchX = isRightSwing ? obs.position.x + ow - arcR : obs.position.x + arcR;
                  const sweepFlag = swingSignY > 0 ? (isRightSwing ? 0 : 1) : isRightSwing ? 1 : 0;
                  const flipLabel = rotY > 90 && rotY < 270;
                  const obsText = `${isDoor ? "🚪 KAPI" : "🪟 PENCERE"} (${fmtPlanDim(ow, false)}×${fmtPlanDim(obs.dimensions.height)} • ${Math.round(rotY)}°)`;
                  const obsFont = Math.round(22 * ts);
                  const obsPillW = Math.max(Math.round(230 * ts), Math.round(obsText.length * obsFont * 0.6 + 26 * ts));
                  const obsPillH = Math.round(38 * ts);

                  return (
                    <g
                      key={obs.id}
                      data-testid={`plan-obstacle-${obs.id}`}
                      onPointerDown={(e) => handleObstaclePointerDown(e, obs)}
                      onContextMenu={(e) =>
                        openPlanContextMenu(e, {
                          kind: "obstacle",
                          obsId: obs.id,
                          obsName: obs.name || "Mimari Engel",
                          rotationY: obs.rotationY || 0,
                        })
                      }
                      onDoubleClick={handleMirrorSwingClick}
                      transform={`rotate(${rotY} ${obs.position.x} ${obs.position.z})`}
                      className="cursor-move"
                    >
                      <rect
                        x={obs.position.x}
                        y={locY}
                        width={ow}
                        height={wallT}
                        fill={isDoor ? "#FDE68A" : "#BAE6FD"}
                        stroke={isSelectedObs ? "#DC2626" : isDoor ? "#D97706" : "#0284C7"}
                        strokeWidth={isSelectedObs ? "6" : "3"}
                      />
                      {!isDoor && (
                        <line x1={obs.position.x + 8} y1={locY + wallT / 2} x2={obs.position.x + ow - 8} y2={locY + wallT / 2} stroke="#0284C7" strokeWidth="3" />
                      )}
                      {isDoor && (
                        <g className="pointer-events-none">
                          <path
                            d={`M ${hingeX} ${doorFaceY} L ${latchX} ${doorFaceY} A ${arcR} ${arcR} 0 0 ${sweepFlag} ${hingeX} ${doorFaceY + swingSignY * arcR} Z`}
                            fill="rgba(253, 230, 138, 0.24)"
                            stroke="#D97706"
                            strokeWidth="3.5"
                            strokeDasharray="12 6"
                          />
                          <line x1={hingeX} y1={doorFaceY} x2={hingeX} y2={doorFaceY + swingSignY * arcR} stroke="#B45309" strokeWidth="6" />
                        </g>
                      )}
                      <g
                        transform={`translate(${obs.position.x + ow / 2}, ${locY + wallT / 2}) rotate(${flipLabel ? 180 : 0})`}
                        className="pointer-events-none"
                      >
                        <rect x={-obsPillW / 2} y={-obsPillH / 2} width={obsPillW} height={obsPillH} rx={8} fill="rgba(255,255,255,0.94)" stroke={isDoor ? "#D97706" : "#0284C7"} strokeWidth="2.5" />
                        <text x={0} y={Math.round(obsFont * 0.35)} textAnchor="middle" fill={isDoor ? "#92400E" : "#0369A1"} fontSize={obsFont} fontWeight="900" fontFamily="Inter, 'Plus Jakarta Sans', system-ui, sans-serif">
                          {obsText}
                        </text>
                      </g>
                      {isSelectedObs && (
                        <g>
                          <g data-testid={`plan-oncanvas-mirror-swing-obs-${obs.id}`} onPointerDown={(e) => e.stopPropagation()} onClick={handleMirrorSwingClick} className="cursor-pointer">
                            <circle cx={obs.position.x + ow / 2 - (isDoor ? 64 : 32)} cy={locY - 46} r={26} fill="#2563EB" stroke="#FFFFFF" strokeWidth="3.5" />
                            <text x={obs.position.x + ow / 2 - (isDoor ? 64 : 32)} y={locY - 38} textAnchor="middle" fill="#FFFFFF" fontSize="22" fontWeight="900">⇄</text>
                          </g>
                          {isDoor && (
                            <g data-testid={`plan-oncanvas-mirror-side-obs-${obs.id}`} onPointerDown={(e) => e.stopPropagation()} onClick={handleMirrorOpenSideClick} className="cursor-pointer">
                              <circle cx={obs.position.x + ow / 2} cy={locY - 46} r={26} fill="#059669" stroke="#FFFFFF" strokeWidth="3.5" />
                              <text x={obs.position.x + ow / 2} y={locY - 38} textAnchor="middle" fill="#FFFFFF" fontSize="22" fontWeight="900">⇅</text>
                            </g>
                          )}
                          <g
                            data-testid={`plan-oncanvas-rotate-obs-${obs.id}`}
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              updateSpaceObstacle(obs.id, { rotationY: (rotY + 45) % 360 });
                            }}
                            className="cursor-pointer"
                          >
                            <circle cx={obs.position.x + ow / 2 + (isDoor ? 64 : 32)} cy={locY - 46} r={26} fill="#D97706" stroke="#FFFFFF" strokeWidth="3.5" />
                            <text x={obs.position.x + ow / 2 + (isDoor ? 64 : 32)} y={locY - 38} textAnchor="middle" fill="#FFFFFF" fontSize="20" fontWeight="900">🔄</text>
                          </g>
                        </g>
                      )}
                    </g>
                  );
                }

                const obsY = obs.position.z > 0 ? obs.position.z : -mainWall.thickness + 20;
                const swingSignY0 = isOutward ? -1 : 1;
                const doorFaceY0 = swingSignY0 > 0 ? obsY + wallT : obsY;
                const hingeX0 = isRightSwing ? obs.position.x + ow : obs.position.x;
                const latchX0 = isRightSwing ? obs.position.x + ow - arcR : obs.position.x + arcR;
                const sweepFlag0 = swingSignY0 > 0 ? (isRightSwing ? 0 : 1) : isRightSwing ? 1 : 0;

                return (
                  <g
                    key={obs.id}
                    data-testid={`plan-obstacle-${obs.id}`}
                    onPointerDown={(e) => handleObstaclePointerDown(e, obs)}
                    onContextMenu={(e) =>
                      openPlanContextMenu(e, {
                        kind: "obstacle",
                        obsId: obs.id,
                        obsName: obs.name || "Mimari Engel",
                        rotationY: obs.rotationY || 0,
                      })
                    }
                    onDoubleClick={handleMirrorSwingClick}
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
                    {/* Architectural 90° Door Leaf & Swing Arc (Supports Left/Right Hinge Mirror AND Inward/Outward Mirror!) */}
                    {isDoor && (
                      <g className="pointer-events-none">
                        <path
                          d={`M ${hingeX0} ${doorFaceY0} L ${latchX0} ${doorFaceY0} A ${arcR} ${arcR} 0 0 ${sweepFlag0} ${hingeX0} ${doorFaceY0 + swingSignY0 * arcR} Z`}
                          fill="rgba(253, 230, 138, 0.24)"
                          stroke="#D97706"
                          strokeWidth="3.5"
                          strokeDasharray="12 6"
                        />
                        <line
                          x1={hingeX0}
                          y1={doorFaceY0}
                          x2={hingeX0}
                          y2={doorFaceY0 + swingSignY0 * arcR}
                          stroke="#B45309"
                          strokeWidth="6"
                        />
                      </g>
                    )}
                    {(() => {
                      const obsText = `${isDoor ? "🚪 KAPI" : "🪟 PENCERE"} (${fmtPlanDim(ow, false)}×${fmtPlanDim(obs.dimensions.height)} • Y:${fmtPlanDim(obs.position.y)})`;
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
                            fontFamily="Inter, 'Plus Jakarta Sans', system-ui, sans-serif"
                          >
                            {obsText}
                          </text>
                        </g>
                      );
                    })()}
                    
                    {isSelectedObs && (
                      <g>
                        {/* 1. On-Canvas Mirror Hinge/Leaf Button (⇄) */}
                        <g
                          data-testid={`plan-oncanvas-mirror-swing-obs-${obs.id}`}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={handleMirrorSwingClick}
                          className="cursor-pointer"
                        >
                          <circle
                            cx={obs.position.x + ow / 2 - (isDoor ? 64 : 32)}
                            cy={obsY - 46}
                            r={28}
                            fill="#2563EB"
                            stroke="#FFFFFF"
                            strokeWidth="3.5"
                          />
                          <text
                            x={obs.position.x + ow / 2 - (isDoor ? 64 : 32)}
                            y={obsY - 38}
                            textAnchor="middle"
                            fill="#FFFFFF"
                            fontSize="22"
                            fontWeight="900"
                          >
                            ⇄
                          </text>
                        </g>
                        {/* 2. On-Canvas Mirror Inward/Outward Button (⇅) */}
                        {isDoor && (
                          <g
                            data-testid={`plan-oncanvas-mirror-side-obs-${obs.id}`}
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={handleMirrorOpenSideClick}
                            className="cursor-pointer"
                          >
                            <circle
                              cx={obs.position.x + ow / 2}
                              cy={obsY - 46}
                              r={28}
                              fill="#059669"
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
                              ⇅
                            </text>
                          </g>
                        )}
                        {/* 3. On-Canvas In-Place 0° <-> 90° Rotate Button on Back-Wall Window/Door */}
                        <g
                          data-testid={`plan-oncanvas-rotate-obs-${obs.id}`}
                          onPointerDown={(e) => e.stopPropagation()}
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
                            cx={obs.position.x + ow / 2 + (isDoor ? 64 : 32)}
                            cy={obsY - 46}
                            r={28}
                            fill="#D97706"
                            stroke="#FFFFFF"
                            strokeWidth="3.5"
                          />
                          <text
                            x={obs.position.x + ow / 2 + (isDoor ? 64 : 32)}
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
                          onPointerDown={(e) => {
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
                          onPointerDown={(e) => {
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
                const rotNorm = (((obs.rotationY || 0) % 360) + 360) % 360;
                const ox = obs.position.x + obs.dimensions.width / 2;
                const oz = obs.position.z + obs.dimensions.depth / 2;
                return (
                  <g
                    key={obs.id}
                    data-testid={`plan-obstacle-${obs.id}`}
                    onPointerDown={(e) => handleObstaclePointerDown(e, obs)}
                    onContextMenu={(e) =>
                      openPlanContextMenu(e, {
                        kind: "obstacle",
                        obsId: obs.id,
                        obsName: obs.name || "Kolon / Kiriş",
                        rotationY: obs.rotationY || 0,
                      })
                    }
                    transform={
                      Math.abs(rotNorm % 90) > 0.5
                        ? `rotate(${rotNorm} ${ox} ${oz})`
                        : undefined
                    }
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
                    {/* Column label rendered once in foreground structural layer */}
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
                    onPointerDown={(e) => handleObstaclePointerDown(e, obs)}
                    onContextMenu={(e) =>
                      openPlanContextMenu(e, {
                        kind: "obstacle",
                        obsId: obs.id,
                        obsName: obs.name || "Tesisat Noktası",
                        rotationY: obs.rotationY || 0,
                      })
                    }
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
                      fontFamily="Inter, 'Plus Jakarta Sans', system-ui, sans-serif"
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
                    onPointerDown={(e) => handleObstaclePointerDown(e, obs)}
                    onContextMenu={(e) =>
                      openPlanContextMenu(e, {
                        kind: "obstacle",
                        obsId: obs.id,
                        obsName: obs.name || labelTag,
                        rotationY: obs.rotationY || 0,
                      })
                    }
                    onDoubleClick={() => removeSpaceObstacle(obs.id)}
                    transform={
                      Math.abs((obs.rotationY || 0) % 180) > 0.5
                        ? `rotate(${obs.rotationY || 0} ${obs.position.x} ${obs.position.z})`
                        : undefined
                    }
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
                      const nTxt = `${labelTag} (${fmtPlanDim(obs.dimensions.width, false)}×${fmtPlanDim(obs.dimensions.depth)})`;
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
                            fontFamily="Inter, 'Plus Jakarta Sans', system-ui, sans-serif"
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
    </>
  );
};
