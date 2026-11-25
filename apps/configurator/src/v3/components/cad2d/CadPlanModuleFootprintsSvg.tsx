"use client";


import React from "react";
import { calculateBayWidths, inferDoorSystemIdFromType, calculateModulePlacement } from "@birim/core";
import { CadPlanActiveModuleHaloSvg } from "./CadPlanActiveModuleHaloSvg";

import type { CadPlan2DSvgCanvasProps } from "./cad2dTypes";

export const CadPlanModuleFootprintsSvg: React.FC<CadPlan2DSvgCanvasProps> = (props) => {
  const { activeModuleIndex, activeSpatialMetrics, beginHistoryTransaction, elevDisplayUnit, errorModuleIds, fmtPlanDim, footprints, getSvgMmPerPx, handleModPointerDown, liveSpatialAlerts, mainWall, moduleCadMetrics, openPlanContextMenu, project, rotateActiveModule90, setActiveModuleIndex, setResizingPlanObject, showPlanDimensions, spaceObstacles, ts } = props;
  return (
    <>
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
                  onPointerDown={(e) => handleModPointerDown(e, idx)}
                  onContextMenu={(e) => openPlanContextMenu(e, { kind: "module", modIdx: idx })}
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
                                const zTxt = `Z:${fmtPlanDim(md)} (D:${fmtPlanDim(wd)})`;
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
                                      fontFamily="Inter, 'Plus Jakarta Sans', system-ui, sans-serif"
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

                    const modRotDeg = (((mod?.rotation?.y ?? fp.rotationY ?? 0) % 360) + 360) % 360;
                    const isRotatedMod = Math.abs(modRotDeg) > 0.05;
                    const modPlace = mod ? calculateModulePlacement(mod) : null;
                    const localW = mod ? mod.dimensions.width : mw;
                    const localD = mod ? mod.dimensions.depth : md;
                    const lx0 = isRotatedMod ? 0 : mx;
                    const lz0 = isRotatedMod ? 0 : mz;
                    const localGroupTransform =
                      isRotatedMod && modPlace
                        ? `translate(${modPlace.origin.x}, ${modPlace.origin.z}) rotate(${-modRotDeg})`
                        : undefined;
                    const isAttachedTable = mod?.complementaryRole === "attached_table";
                    const isCapsuleHull =
                      mod?.carcass.hullShape === "capsule_stadium" ||
                      mod?.carcass.hullShape === "capsule_table";
                    const isTableVisual = isAttachedTable || mod?.carcass.hullShape === "capsule_table";
                    const shapeRx = isCapsuleHull
                      ? Math.round(
                          Math.min(localD / 2, localW / 2, mod?.carcass.cornerRadiusMm || localD / 2)
                        )
                      : isTableVisual
                      ? 18
                      : 6;
                    const seatCountPerSide = isTableVisual
                      ? Math.max(1, Math.min(4, Math.floor((localW - 220) / 560)))
                      : 0;

                    return (
                      <g transform={localGroupTransform}>
                        {/* Subtle Architectural Chair Tuck Outlines on Both Long Sides of Angled / Capsule Tables */}
                        {isTableVisual &&
                          Array.from({ length: seatCountPerSide }).map((_, sIdx) => {
                            const chairW = Math.min(420, Math.round((localW - 260) / seatCountPerSide) - 40);
                            const step = (localW - 220) / seatCountPerSide;
                            const cxChair = lx0 + 110 + sIdx * step + (step - chairW) * 0.5;
                            return (
                              <g key={`tbl_chair_${sIdx}`} className="pointer-events-none" opacity={0.62}>
                                {/* Top/Rear Seating Arc */}
                                <rect
                                  x={cxChair}
                                  y={lz0 - 95}
                                  width={chairW}
                                  height={85}
                                  rx={24}
                                  fill="#F8FAFC"
                                  stroke="#64748B"
                                  strokeWidth="2.2"
                                  strokeDasharray="8 5"
                                />
                                {/* Bottom/Front Seating Arc */}
                                <rect
                                  x={cxChair}
                                  y={lz0 + localD + 10}
                                  width={chairW}
                                  height={85}
                                  rx={24}
                                  fill="#F8FAFC"
                                  stroke="#64748B"
                                  strokeWidth="2.2"
                                  strokeDasharray="8 5"
                                />
                              </g>
                            );
                          })}

                        <rect
                          x={lx0}
                          y={lz0}
                          width={localW}
                          height={localD}
                          rx={shapeRx}
                          fill={
                            isTableVisual
                              ? isAct
                                ? "#DBEAFE"
                                : "#EFE6D8"
                              : fp.category === "complementary"
                              ? "rgba(216, 184, 146, 0.55)"
                              : carcassFill
                          }
                          stroke={isTableVisual ? (isAct ? "#2563EB" : "#78350F") : carcassStroke}
                          strokeWidth={strokeW}
                          strokeDasharray={fp.category === "kitchen_wall" ? "10 5" : undefined}
                        />

                        {/* Architectural Table Details: Pivot Joint, Centerline Axis & Leg/Pedestal Footprints */}
                        {isTableVisual && (
                          <g className="pointer-events-none">
                            <line
                              x1={lx0 + 48}
                              y1={lz0 + localD / 2}
                              x2={lx0 + localW - 48}
                              y2={lz0 + localD / 2}
                              stroke="#92400E"
                              strokeOpacity={0.32}
                              strokeWidth="2"
                              strokeDasharray="14 8"
                            />
                            {isAttachedTable && (
                              <>
                                {/* Mounting Pivot Anchor Point at lx0 */}
                                <circle
                                  cx={lx0 + 20}
                                  cy={lz0 + localD / 2}
                                  r={16}
                                  fill="#0284C7"
                                  stroke="#FFFFFF"
                                  strokeWidth="3.5"
                                />
                                {/* Far-End Support Leg / Pedestal Schematic */}
                                {mod?.attachedTableConfig?.legStyle === "pedestal_column" ? (
                                  <circle
                                    cx={lx0 + Math.max(180, localW - 260)}
                                    cy={lz0 + localD / 2}
                                    r={Math.min(95, localD * 0.14)}
                                    fill="none"
                                    stroke="#451A03"
                                    strokeWidth="3"
                                    strokeDasharray="8 4"
                                  />
                                ) : (
                                  <rect
                                    x={lx0 + Math.max(80, localW - 90)}
                                    y={lz0 + 45}
                                    width={46}
                                    height={Math.max(80, localD - 90)}
                                    rx={6}
                                    fill="none"
                                    stroke="#451A03"
                                    strokeWidth="2.8"
                                    strokeDasharray="8 4"
                                  />
                                )}
                              </>
                            )}
                            {mod?.carcass.hullShape === "capsule_table" && (
                              <>
                                <circle
                                  cx={lx0 + localW * 0.27}
                                  cy={lz0 + localD / 2}
                                  r={Math.min(145, localD * 0.18)}
                                  fill="none"
                                  stroke="#78350F"
                                  strokeOpacity={0.55}
                                  strokeWidth="3"
                                  strokeDasharray="8 5"
                                />
                                <circle
                                  cx={lx0 + localW * 0.73}
                                  cy={lz0 + localD / 2}
                                  r={Math.min(145, localD * 0.18)}
                                  fill="none"
                                  stroke="#78350F"
                                  strokeOpacity={0.55}
                                  strokeWidth="3"
                                  strokeDasharray="8 5"
                                />
                              </>
                            )}
                          </g>
                        )}

                        {/* 18mm Carcass Side & Back Panel Inner Lines (Preserved at ALL angles 0°/45°/90°/180°/270°!) */}
                        {fp.category !== "complementary" && (
                          <g className="pointer-events-none" opacity={0.55}>
                            <line x1={lx0 + T} y1={lz0 + T} x2={lx0 + localW - T} y2={lz0 + T} stroke="#94A3B8" strokeWidth="2" />
                            <line x1={lx0 + T} y1={lz0 + T} x2={lx0 + T} y2={lz0 + localD - T} stroke="#94A3B8" strokeWidth="2" />
                            <line x1={lx0 + localW - T} y1={lz0 + T} x2={lx0 + localW - T} y2={lz0 + localD - T} stroke="#94A3B8" strokeWidth="2" />
                          </g>
                        )}

                        {/* Exact Internal Bay Divider Lines & Per-Bay Interior Schematic (Hanging Rail, Drawers, Bay Width Badges) */}
                        {mod &&
                          bayOffsetsMm.map((bo, bIdx) => {
                            const bayObj = mod.bays[bIdx];
                            const divCoordMm = bo.startMm + bo.spanWidthMm;
                            const hasDividerAfter = bIdx < bayOffsetsMm.length - 1;

                            const bx = lx0 + bo.startMm;
                            const bSpan = bo.spanWidthMm;
                            const divX = lx0 + divCoordMm;
                            const extDrawers = bayObj ? bayObj.drawers.filter((d) => !d.isInternal) : [];
                            const hasRails = bayObj ? bayObj.hangingRails.length > 0 : false;

                            return (
                              <g key={`bay_plan_int_${bIdx}`} className="pointer-events-none">
                                {/* Solid 18mm Structural Bay Divider Line at Exact Millimeter Coordinate */}
                                {hasDividerAfter && (
                                  <line
                                    x1={divX}
                                    y1={lz0}
                                    x2={divX}
                                    y2={lz0 + localD}
                                    stroke={isAct ? "#1D4ED8" : "#475569"}
                                    strokeWidth="3.5"
                                  />
                                )}

                                {/* Hanging Rail Centerline + Hanger Ticks inside Bay */}
                                {hasRails && (
                                  <g opacity={0.45}>
                                    <line
                                      x1={bx + T}
                                      y1={lz0 + localD * 0.5}
                                      x2={bx + bSpan - T}
                                      y2={lz0 + localD * 0.5}
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
                                        y={lz0 + localD - drwH - 8}
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
                                        y={lz0 + localD - 8 - Math.round(drwH * 0.28)}
                                        textAnchor="middle"
                                        fill="#92400E"
                                        fontSize={drwFont}
                                        fontWeight="900"
                                        fontFamily="Inter, 'Plus Jakarta Sans', system-ui, sans-serif"
                                      >
                                        {`🗄 ${extDrawers.length} Çekmece`}
                                      </text>
                                    </g>
                                  );
                                })()}

                                {/* Bay Width Sub-Label at Top Edge of Bay (e.g. B1: 575mm | B2: 1171mm) */}
                                {mod.bays.length > 1 && (() => {
                                  const bTxt = `B${bIdx + 1}: ${fmtPlanDim(bo.clearWidthMm)}`;
                                  const bFont = Math.round(20 * ts);
                                  const bPillW = Math.min(bSpan - 10, Math.max(Math.round(125 * ts), Math.round(bTxt.length * bFont * 0.62 + 18 * ts)));
                                  const bPillH = Math.round(32 * ts);
                                  return (
                                    <g>
                                      <rect
                                        x={bx + bSpan / 2 - bPillW / 2}
                                        y={lz0 + 8}
                                        width={bPillW}
                                        height={bPillH}
                                        rx={7}
                                        fill="rgba(255, 255, 255, 0.94)"
                                        stroke={isAct ? "#2563EB" : "#94A3B8"}
                                        strokeWidth="2"
                                      />
                                      <text
                                        x={bx + bSpan / 2}
                                        y={lz0 + 8 + Math.round(bPillH * 0.72)}
                                        textAnchor="middle"
                                        fill={isAct ? "#1D4ED8" : "#0F172A"}
                                        fontSize={bFont}
                                        fontWeight="900"
                                        fontFamily="Inter, 'Plus Jakarta Sans', system-ui, sans-serif"
                                      >
                                        {bTxt}
                                      </text>
                                    </g>
                                  );
                                })()}
                              </g>
                            );
                          })}

                        {/* Authentic Door Opening System & 90° Sweep Arcs in 2D Plan — Active for ALL rotations (0°, 45°, 90°, 180°, 270°)! */}
                        {(
                          mod &&
                          !mod.isOpenFront &&
                          bayOffsetsMm.map((bo, bIdx) => {
                            const b = mod.bays[bIdx];
                            if (!b) return null;
                            const dType = b.door.type;
                            const dSys = b.door.doorSystemId || inferDoorSystemIdFromType(dType);
                            if (dType === "open" || dSys === "open") return null;

                            const leafSpec = fourSpace?.doorLeaves[bIdx];
                            const bx = lx0 + bo.startMm;
                            const baySpanW = bo.spanWidthMm;
                            const frontZ = lz0 + localD + 4;
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
                                    fontFamily="Inter, 'Plus Jakarta Sans', system-ui, sans-serif"
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
                            if (dSys.startsWith("lift_") || String(dType) === "flap" || dType.startsWith("lift_")) {
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
                                    fontFamily="Inter, 'Plus Jakarta Sans', system-ui, sans-serif"
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
                                    fontFamily="Inter, 'Plus Jakarta Sans', system-ui, sans-serif"
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
                      </g>
                    );
                  })()}


                  {/* Unmistakable Selected Module Halo, Proportional Ribbon Badge, Rotate Buttons & Edge Resize Handles */}
                  <CadPlanActiveModuleHaloSvg activeModuleIndex={activeModuleIndex} activeSpatialMetrics={activeSpatialMetrics} beginHistoryTransaction={beginHistoryTransaction} elevDisplayUnit={elevDisplayUnit} fmtPlanDim={fmtPlanDim} fp={fp} gapRight={gapRight} getSvgMmPerPx={getSvgMmPerPx} hasCollisionError={hasCollisionError} idx={idx} isAct={isAct} md={md} mod={mod} mw={mw} mx={mx} mz={mz} rotateActiveModule90={rotateActiveModule90} setActiveModuleIndex={setActiveModuleIndex} setResizingPlanObject={setResizingPlanObject} showPlanDimensions={showPlanDimensions} spaceObstacles={spaceObstacles} ts={ts} />

                  {/* Rotated Side-Wall Module Z-Axis Clearance Callout (Placed below the alignment badge so it NEVER overlaps the ▶ handle!) */}
                  {isAct && showPlanDimensions && (fp.rotationY === 90 || fp.rotationY === 270) && activeSpatialMetrics.rightClearanceMm > 15 && (() => {
                    const gapZ = activeSpatialMetrics.rightClearanceMm;
                    const lineX = mx + mw - 60;
                    const gapText = `Boşluk: ${fmtPlanDim(gapZ)}`;
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
                          fontFamily="Inter, 'Plus Jakarta Sans', system-ui, sans-serif"
                        >
                          {gapText}
                        </text>
                      </g>
                    );
                  })()}
                </g>
              );
            })}
    </>
  );
};
