"use client";


import React from "react";
import { calculateModulePlacement, type ModuleInstance } from "@birim/core";
import type { CadPlan2DSvgCanvasProps } from "./cad2dTypes";

export type CadPlanActiveModuleHaloSvgProps = Pick<
  CadPlan2DSvgCanvasProps,
  | "activeModuleIndex"
  | "activeSpatialMetrics"
  | "beginHistoryTransaction"
  | "elevDisplayUnit"
  | "fmtPlanDim"
  | "getSvgMmPerPx"
  | "rotateActiveModule90"
  | "setActiveModuleIndex"
  | "setResizingPlanObject"
  | "showPlanDimensions"
  | "spaceObstacles"
  | "ts"
> & {
  fp: CadPlan2DSvgCanvasProps["footprints"][number];
  gapRight: number;
  hasCollisionError: boolean;
  idx: number;
  isAct: boolean;
  md: number;
  mod: ModuleInstance | undefined;
  mw: number;
  mx: number;
  mz: number;
};

export const CadPlanActiveModuleHaloSvg: React.FC<CadPlanActiveModuleHaloSvgProps> = (props) => {
  const { activeModuleIndex, activeSpatialMetrics, beginHistoryTransaction, elevDisplayUnit, fmtPlanDim, fp, gapRight, getSvgMmPerPx, hasCollisionError, idx, isAct, md, mod, mw, mx, mz, rotateActiveModule90, setActiveModuleIndex, setResizingPlanObject, showPlanDimensions, spaceObstacles, ts } = props;
  return (
    <>
                  {isAct && (() => {
                    const mRot = (((mod?.rotation?.y ?? fp.rotationY ?? 0) % 360) + 360) % 360;
                    const isCustomAngled =
                      Math.abs(mRot % 90) > 0.5 ||
                      mod?.complementaryRole === "attached_table" ||
                      mod?.carcass.hullShape === "capsule_table" ||
                      mod?.carcass.hullShape === "capsule_stadium";
                    const mPlace = mod ? calculateModulePlacement(mod) : null;
                    const locW = mod ? mod.dimensions.width : mw;
                    const locD = mod ? mod.dimensions.depth : md;
                    const isCap =
                      mod?.carcass.hullShape === "capsule_stadium" ||
                      mod?.carcass.hullShape === "capsule_table";
                    const haloRx = isCap ? Math.round(locD / 2) + 8 : 12;

                    const ribFont = Math.round(20 * ts);
                    const ribW = Math.round(220 * ts);
                    const ribH = Math.round(36 * ts);
                    const rotR = Math.round(22 * ts);
                    const rotOffset = Math.round(ribW / 2 + rotR + 10 * ts);
                    const sideHandleW = Math.round(30 * ts);
                    const sideHandleH = Math.round(56 * ts);
                    const topBotHandleW = Math.round(56 * ts);
                    const topBotHandleH = Math.round(28 * ts);
                    const handleFont = Math.round(19 * ts);

                    if (isCustomAngled && mPlace) {
                      const rad = mPlace.rotationYRad;
                      const cxW =
                        mPlace.origin.x + (locW * 0.5) * Math.cos(rad) + (locD * 0.5) * Math.sin(rad);
                      const czW =
                        mPlace.origin.z - (locW * 0.5) * Math.sin(rad) + (locD * 0.5) * Math.cos(rad);
                      // Far-end tip of the angled table/module at (locW, locD/2) in local coordinates
                      const tipX = mPlace.origin.x + locW * Math.cos(rad) + (locD * 0.5) * Math.sin(rad);
                      const tipZ = mPlace.origin.z - locW * Math.sin(rad) + (locD * 0.5) * Math.cos(rad);
                      const topCtrlY = Math.min(mz - Math.round(34 * ts), czW - locD * 0.5 - Math.round(44 * ts));

                      return (
                        <g>
                          {/* Tightly-Fitted Oriented Selection Halo (Rotates with the Angled Table!) */}
                          <g
                            transform={`translate(${mPlace.origin.x}, ${mPlace.origin.z}) rotate(${-mRot})`}
                            className="pointer-events-none"
                          >
                            <rect
                              x={-10}
                              y={-10}
                              width={locW + 20}
                              height={locD + 20}
                              rx={haloRx}
                              fill="none"
                              stroke="#D97706"
                              strokeWidth={Math.round(3.5 * ts)}
                              strokeDasharray="12 6"
                            />
                          </g>

                          {/* Floating Upright Selection & Angle Control Bar (-45°, -15°, SEÇİLİ, +15°, +45°) */}
                          <g
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              rotateActiveModule90(15);
                            }}
                            className="cursor-pointer"
                          >
                            <circle
                              cx={cxW - rotOffset - rotR * 2.2}
                              cy={topCtrlY}
                              r={rotR}
                              fill="#0F172A"
                              stroke="#FFFFFF"
                              strokeWidth="2.5"
                            />
                            <text
                              x={cxW - rotOffset - rotR * 2.2}
                              y={topCtrlY + Math.round(ribFont * 0.3)}
                              textAnchor="middle"
                              fill="#FFFFFF"
                              fontSize={Math.round(15 * ts)}
                              fontWeight="900"
                            >
                              -15°
                            </text>
                          </g>

                          <g
                            data-testid={`plan-oncanvas-rotate-ccw-mod-${idx}`}
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              rotateActiveModule90(45);
                            }}
                            className="cursor-pointer"
                          >
                            <circle
                              cx={cxW - rotOffset}
                              cy={topCtrlY}
                              r={rotR}
                              fill="#D97706"
                              stroke="#FFFFFF"
                              strokeWidth="2.5"
                            />
                            <text
                              x={cxW - rotOffset}
                              y={topCtrlY + Math.round(ribFont * 0.3)}
                              textAnchor="middle"
                              fill="#FFFFFF"
                              fontSize={Math.round(15 * ts)}
                              fontWeight="900"
                            >
                              -45°
                            </text>
                          </g>

                          <rect
                            x={cxW - ribW / 2}
                            y={topCtrlY - ribH / 2}
                            width={ribW}
                            height={ribH}
                            rx={Math.round(9 * ts)}
                            fill="#B45309"
                            stroke="#FFFFFF"
                            strokeWidth="2.5"
                            className="pointer-events-none"
                          />
                          <text
                            x={cxW}
                            y={topCtrlY + Math.round(ribFont * 0.35)}
                            textAnchor="middle"
                            fill="#FFFFFF"
                            fontSize={ribFont}
                            fontWeight="900"
                            fontFamily="Inter, 'Plus Jakarta Sans', system-ui, sans-serif"
                            className="pointer-events-none"
                          >
                            {`★ SEÇİLİ #${idx + 1}`}
                          </text>

                          <g
                            data-testid={`plan-oncanvas-rotate-mod-${idx}`}
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              rotateActiveModule90(-45);
                            }}
                            className="cursor-pointer"
                          >
                            <circle
                              cx={cxW + rotOffset}
                              cy={topCtrlY}
                              r={rotR}
                              fill="#D97706"
                              stroke="#FFFFFF"
                              strokeWidth="2.5"
                            />
                            <text
                              x={cxW + rotOffset}
                              y={topCtrlY + Math.round(ribFont * 0.3)}
                              textAnchor="middle"
                              fill="#FFFFFF"
                              fontSize={Math.round(15 * ts)}
                              fontWeight="900"
                            >
                              +45°
                            </text>
                          </g>

                          <g
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              rotateActiveModule90(-15);
                            }}
                            className="cursor-pointer"
                          >
                            <circle
                              cx={cxW + rotOffset + rotR * 2.2}
                              cy={topCtrlY}
                              r={rotR}
                              fill="#0F172A"
                              stroke="#FFFFFF"
                              strokeWidth="2.5"
                            />
                            <text
                              x={cxW + rotOffset + rotR * 2.2}
                              y={topCtrlY + Math.round(ribFont * 0.3)}
                              textAnchor="middle"
                              fill="#FFFFFF"
                              fontSize={Math.round(15 * ts)}
                              fontWeight="900"
                            >
                              +15°
                            </text>
                          </g>

                          {/* Angled End-Tip Length Resize Handle (Lengthens/Shortens along exact table angle!) */}
                          <g
                            data-testid={`plan-mod-resize-right-${idx}`}
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              const svgEl = (e.currentTarget as Element).closest("svg") as SVGSVGElement | null;
                              beginHistoryTransaction();
                              setResizingPlanObject({
                                kind: "angled_module_length",
                                targetIdxOrId: idx,
                                startClientX: e.clientX,
                                startClientY: e.clientY,
                                startWidthOrLen: locW,
                                startDepth: locD,
                                startPosX: fp.x,
                                startPosZ: fp.z,
                                rotYDeg: mRot,
                                anchorOriginX: mPlace.origin.x,
                                anchorOriginZ: mPlace.origin.z,
                                mmPerPx: svgEl ? getSvgMmPerPx(svgEl) : 4,
                              });
                            }}
                            className="cursor-grab active:cursor-grabbing"
                          >
                            <circle
                              cx={tipX}
                              cy={tipZ}
                              r={Math.round(22 * ts)}
                              fill="#059669"
                              stroke="#FFFFFF"
                              strokeWidth="3"
                            />
                            <text
                              x={tipX}
                              y={tipZ + Math.round(handleFont * 0.34)}
                              textAnchor="middle"
                              fill="#FFFFFF"
                              fontSize={handleFont}
                              fontWeight="900"
                            >
                              ↔
                            </text>
                          </g>
                        </g>
                      );
                    }

                    const ribCenterY = mz - Math.round(32 * ts);
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
                          fontFamily="Inter, 'Plus Jakarta Sans', system-ui, sans-serif"
                          className="pointer-events-none"
                        >
                          {`★ SEÇİLİ #${idx + 1}`}
                        </text>

                        {/* On-Canvas Clickable -90° (↺) & +90° (↻) Proportional Rotate Gizmo Buttons */}
                        <g
                          data-testid={`plan-oncanvas-rotate-ccw-mod-${idx}`}
                          onPointerDown={(e) => e.stopPropagation()}
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
                          onPointerDown={(e) => e.stopPropagation()}
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
                          onPointerDown={(e) => {
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
                          onPointerDown={(e) => {
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
                          onPointerDown={(e) => {
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
                          onPointerDown={(e) => {
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

                  {/* Module Name & Dimensions (Aligned along True Oriented Axis for Angled Tables & Modules!) */}
                  {(() => {
                    const mRot = (((mod?.rotation?.y ?? fp.rotationY ?? 0) % 360) + 360) % 360;
                    const isAngledLabel = Math.abs(mRot % 90) > 0.5;
                    const mPlace = mod && isAngledLabel ? calculateModulePlacement(mod) : null;
                    const effSpanW = isAngledLabel ? fp.rawWidth : mw;
                    const conciseName = fp.name.replace(/\s*Modülü/gi, "").trim();
                    const alreadyHasDeg = conciseName.includes("°");
                    const planDegDisplay = mRot > 180 ? 360 - mRot : mRot;
                    const fullTitle = `#${idx + 1} ${conciseName}${
                      fp.rotationY > 0 && !alreadyHasDeg ? ` (${planDegDisplay}°)` : ""
                    }`;
                    const maxAllowedNameFont = Math.floor(
                      (Math.max(420, effSpanW) - 32) / Math.max(7, fullTitle.length * 0.52)
                    );
                    const nameFont = Math.max(22, Math.min(Math.round(25 * ts), maxAllowedNameFont));
                    const dimFont = Math.max(
                      20,
                      Math.min(Math.round(22 * ts), Math.floor((Math.max(420, effSpanW) - 36) / 9.8))
                    );
                    const dimLabel = `${fmtPlanDim(fp.rawWidth, false)}×${fmtPlanDim(fp.rawDepth)} (Boy:${fmtPlanDim(fp.rawHeight)})`;
                    const innerPillH = Math.round(dimFont * 1.72);
                    const innerPillW = Math.min(
                      Math.max(360, effSpanW - 24),
                      Math.max(Math.round(160 * ts), Math.round(dimLabel.length * dimFont * 0.6 + 24 * ts))
                    );

                    if (isAngledLabel && mPlace) {
                      const rad = mPlace.rotationYRad;
                      const cxW =
                        mPlace.origin.x +
                        (fp.rawWidth * 0.5) * Math.cos(rad) +
                        (fp.rawDepth * 0.5) * Math.sin(rad);
                      const czW =
                        mPlace.origin.z -
                        (fp.rawWidth * 0.5) * Math.sin(rad) +
                        (fp.rawDepth * 0.5) * Math.cos(rad);
                      // Keep SVG text readable right-side-up in [-89°..+89°]
                      let svgRot = -mRot;
                      while (svgRot <= -180) svgRot += 360;
                      while (svgRot > 180) svgRot -= 360;
                      if (svgRot > 90) svgRot -= 180;
                      if (svgRot < -90) svgRot += 180;

                      return (
                        <g
                          transform={`translate(${cxW}, ${czW}) rotate(${svgRot})`}
                          className="pointer-events-none"
                        >
                          <text
                            x={0}
                            y={-Math.round(10 * ts)}
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
                            x={-innerPillW / 2}
                            y={Math.round(2 * ts)}
                            width={innerPillW}
                            height={innerPillH}
                            rx={8}
                            fill="#FFFFFF"
                            stroke={hasCollisionError ? "#DC2626" : isAct ? "#2563EB" : "#94A3B8"}
                            strokeWidth="2"
                            opacity={0.96}
                          />
                          <text
                            x={0}
                            y={Math.round(2 * ts) + Math.round(innerPillH * 0.72)}
                            textAnchor="middle"
                            fill={hasCollisionError ? "#DC2626" : "#0F172A"}
                            fontSize={dimFont}
                            fontWeight="800"
                            fontFamily="Inter, 'Plus Jakarta Sans', system-ui, sans-serif"
                          >
                            {dimLabel}
                          </text>
                        </g>
                      );
                    }

                    const labelCenterY =
                      fp.cornerType === "l_corner" && (fp.rotationY === 0 || fp.rotationY === 90)
                        ? mz + Math.min(fp.wingDepthMm || 580, md) * 0.42
                        : mz + md * 0.43;
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
                          fontFamily="Inter, 'Plus Jakarta Sans', system-ui, sans-serif"
                        >
                          {dimLabel}
                        </text>
                      </g>
                    );
                  })()}

                  {/* Width / Length Callout: Aligned Parallel to Angled Edge (Shows True Length `rawWidth`, NEVER diagonal AABB!) */}
                  {showPlanDimensions && (() => {
                    const mRot = (((mod?.rotation?.y ?? fp.rotationY ?? 0) % 360) + 360) % 360;
                    const isCustomAng = Math.abs(mRot % 90) > 0.5;
                    if (isCustomAng && mod) {
                      const mPl = calculateModulePlacement(mod);
                      const locW = mod.dimensions.width;
                      const locD = mod.dimensions.depth;
                      const offZ = locD + Math.round(56 * ts);
                      const calloutText = elevDisplayUnit === "cm" ? `${fmtPlanDim(locW, false)} × ${fmtPlanDim(locD, false)} cm` : `${locW} × ${locD} mm`;
                      const calloutFont = Math.round(21 * ts);
                      const pillH = Math.round(36 * ts);
                      const pillW = Math.max(
                        Math.round(150 * ts),
                        Math.round(calloutText.length * calloutFont * 0.62 + 24 * ts)
                      );
                      let flipText = false;
                      let normSvg = -mRot;
                      while (normSvg <= -180) normSvg += 360;
                      while (normSvg > 180) normSvg -= 360;
                      if (normSvg > 90 || normSvg < -90) flipText = true;

                      return (
                        <g
                          transform={`translate(${mPl.origin.x}, ${mPl.origin.z}) rotate(${-mRot})`}
                          className="pointer-events-none"
                        >
                          <line x1={0} y1={offZ - 14} x2={0} y2={offZ + 14} stroke="#9A3412" strokeWidth="2.5" />
                          <line x1={locW} y1={offZ - 14} x2={locW} y2={offZ + 14} stroke="#9A3412" strokeWidth="2.5" />
                          <line x1={0} y1={offZ} x2={locW} y2={offZ} stroke="#9A3412" strokeWidth="2.5" />
                          <g transform={`translate(${locW / 2}, ${offZ}) rotate(${flipText ? 180 : 0})`}>
                            <rect
                              x={-pillW / 2}
                              y={-pillH / 2}
                              width={pillW}
                              height={pillH}
                              rx={9}
                              fill="#FFFFFF"
                              stroke="#9A3412"
                              strokeWidth="2.5"
                            />
                            <text
                              x={0}
                              y={Math.round(calloutFont * 0.35)}
                              textAnchor="middle"
                              fill="#7C2D12"
                              fontSize={calloutFont}
                              fontWeight="800"
                              fontFamily="Inter, 'Plus Jakarta Sans', system-ui, sans-serif"
                            >
                              {calloutText}
                            </text>
                          </g>
                        </g>
                      );
                    }

                    const calloutY = mz + md + Math.round(52 * ts);
                    const calloutText = fmtPlanDim(mw);
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
                          fontFamily="Inter, 'Plus Jakarta Sans', system-ui, sans-serif"
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
                        ? `⬅ Sola Yaslı (0 ${elevDisplayUnit})`
                        : activeSpatialMetrics.alignmentMode === "right"
                        ? `Sağa Yaslı (0 ${elevDisplayUnit}) ➡`
                        : `↔ Sol: ${fmtPlanDim(activeSpatialMetrics.leftClearanceMm, false)} • Sağ: ${fmtPlanDim(activeSpatialMetrics.rightClearanceMm)}`;
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
                    const gapText = `Boşluk: ${fmtPlanDim(gapRight)}`;
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
                          fontFamily="Inter, 'Plus Jakarta Sans', system-ui, sans-serif"
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
                                fontFamily="Inter, 'Plus Jakarta Sans', system-ui, sans-serif"
                              >
                                {soc.type === "electrical" ? "✂ PRİZ BUAT" : "✂ TESİSAT KESİM"}
                              </text>
                            </g>
                          );
                        })}
                      </g>
                    );
                  })()}
    </>
  );
};
