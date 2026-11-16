"use client";

import React, { useMemo } from "react";
import type { ModuleInstance } from "@birim/core";
import { generateModuleGeometry, generateElevation2D } from "../../adapter/useV3Adapter";
import { findDraggableInteriorComponent } from "../../engine/elevationSnapEngine";
import {
  type ElevationDetailLevel,
  type ElevationDisplayUnit,
  formatElevationValue,
  truncateCadLabel,
} from "./elevation2dHelpers";

export interface NeighborElevationModuleProps {
  module: ModuleInstance;
  moduleIndex: number;
  mx: number;
  my: number;
  showDoorsIn2D: boolean;
  detailLevel: ElevationDetailLevel;
  displayUnit: ElevationDisplayUnit;
  elevPanMode: boolean;
  effectiveInteriorMoveMode: boolean;
  getElevScaleMmPerPx: (svgEl: SVGSVGElement) => { x: number; y: number };
  onSelectModule: (modIdx: number) => void;
  onSelectComponent: (compId: string | null) => void;
  onSelectBay: (bayIdx: number) => void;
  onBeginHistory: () => void;
  onStartModuleDrag: (payload: {
    modIdx: number;
    startClientX: number;
    startClientY: number;
    startModX: number;
    startModY: number;
    mmPerPxX: number;
    mmPerPxY: number;
  }) => void;
  onStartInteriorDrag: (payload: {
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
  }) => void;
}

export const NeighborElevationModule: React.FC<NeighborElevationModuleProps> = React.memo(
  ({
    module: m,
    moduleIndex: mIdx,
    mx,
    my,
    showDoorsIn2D,
    detailLevel,
    displayUnit,
    elevPanMode,
    effectiveInteriorMoveMode,
    getElevScaleMmPerPx,
    onSelectModule,
    onSelectComponent,
    onSelectBay,
    onBeginHistory,
    onStartModuleDrag,
    onStartInteriorDrag,
  }) => {
    const mw = m.dimensions.width;
    const mh = m.dimensions.height;
    const dimY = -38;

    const nBreakdown = useMemo(
      () => generateModuleGeometry(m, { doorOpenAngleDeg: 0 }),
      [m]
    );
    const nElevData = useMemo(
      () => generateElevation2D(nBreakdown),
      [nBreakdown]
    );
    const nRails = useMemo(
      () => nBreakdown.components.filter((c) => c.role === "hanging_rail"),
      [nBreakdown]
    );
    const nElements = useMemo(
      () =>
        nElevData.elements.filter((el) => {
          if (!showDoorsIn2D && el.role.startsWith("door") && el.role !== "door_hinge") {
            return false;
          }
          if (
            el.role.startsWith("drawer_") &&
            el.role !== "drawer_front" &&
            el.role !== "drawer_handle"
          ) {
            return false;
          }
          return true;
        }),
      [nElevData, showDoorsIn2D]
    );

    const startNeighborModMove = (e: React.MouseEvent<SVGGElement>) => {
      if (elevPanMode || effectiveInteriorMoveMode || e.button !== 0 || e.altKey) return;
      e.stopPropagation();
      onSelectModule(mIdx);
      const svgEl = (e.currentTarget as Element).closest("svg") as SVGSVGElement | null;
      const scale = svgEl ? getElevScaleMmPerPx(svgEl) : { x: 4, y: 4 };
      onBeginHistory();
      onStartModuleDrag({
        modIdx: mIdx,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startModX: m.position.x,
        startModY: m.position.y,
        mmPerPxX: scale.x,
        mmPerPxY: scale.y,
      });
    };

    const isTech = detailLevel === "technical";
    const isSelectedMode = detailLevel === "selected";

    return (
      <g
        data-testid={`elev-neighbor-mod-${mIdx}`}
        transform={`translate(${mx}, ${my})`}
        className="group/mod"
      >
        {/* Clean Interior Cavity Background */}
        <rect
          x={0}
          y={0}
          width={mw}
          height={mh}
          fill="#FAF9F6"
          stroke="#292524"
          strokeWidth="3"
          onMouseDown={(e) => {
            onSelectModule(mIdx);
            onSelectComponent(null);
            startNeighborModMove(e);
          }}
          className={
            effectiveInteriorMoveMode ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"
          }
        />

        {/* Neighbor Module Carcass, Dividers, Shelves, Drawers & Special Fittings */}
        {nElements.map((el) => {
          const isHinge = el.role === "door_hinge";
          const isSpecialFitting = el.role === "special_fitting";
          const isDoor = el.role.startsWith("door") && !isHinge && el.role !== "door_handle";
          const isDrawer = el.role.startsWith("drawer");
          const isShelf = el.role === "shelf";
          const isDivider = el.role === "carcass_divider";
          const isSubDivider = el.role === "carcass_sub_divider";
          const isDrawerHandle =
            el.role === "drawer_handle" ||
            el.role === "door_handle" ||
            el.role === "gola_profile";
          const dragMeta = findDraggableInteriorComponent(m, el.id, nBreakdown.bayWidths);

          const isPlinth = el.role === "plinth";
          const isPlinthSeal = el.role === "plinth_seal" || el.id.includes("_plinth_seal_");
          const isHiddenLeg = el.role === "plinth_leg_hidden";
          let fill = "#FFFFFF";
          let stroke = "#1C1917";
          if (isDoor) {
            fill = "#F5F5F4";
            stroke = "#57534E";
          } else if (isPlinthSeal) {
            fill = "#27272A";
            stroke = "#18181B";
          } else if (isPlinth) {
            fill = "#E7E5E4";
            stroke = "#1C1917";
          } else if (isHiddenLeg) {
            fill = "none";
            stroke = "#64748B";
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

          const elevMm =
            dragMeta && (dragMeta.kind === "shelf" || dragMeta.kind === "drawer")
              ? dragMeta.startVal
              : null;

          return (
            <g
              key={el.id}
              data-testid={`cad-el-${el.id}`}
              onMouseDown={(e) => {
                if (elevPanMode || e.button !== 0 || e.altKey) return;
                e.stopPropagation();
                onSelectModule(mIdx);
                onSelectComponent(el.id);
                if (dragMeta) {
                  const svgEl = (e.currentTarget as Element).closest("svg") as SVGSVGElement | null;
                  const scale = svgEl ? getElevScaleMmPerPx(svgEl) : { x: 4, y: 4 };
                  onBeginHistory();
                  onSelectBay(dragMeta.bayIdx);
                  onStartInteriorDrag({
                    kind: dragMeta.kind,
                    bayIdx: dragMeta.bayIdx,
                    targetId: dragMeta.targetId,
                    startClientX: e.clientX,
                    startClientY: e.clientY,
                    startValueMm: dragMeta.startVal,
                    startElevY: dragMeta.startElevY,
                    itemHeightMm: dragMeta.itemHeightMm,
                    mmPerPxX: scale.x,
                    mmPerPxY: scale.y,
                  });
                } else {
                  startNeighborModMove(e);
                }
              }}
              className={`group/el ${
                elevPanMode
                  ? "cursor-grab"
                  : dragMeta
                  ? dragMeta.kind === "sub_divider"
                    ? "cursor-move"
                    : dragMeta.kind === "divider"
                    ? "cursor-ew-resize"
                    : "cursor-ns-resize"
                  : "cursor-grab"
              }`}
            >
              {dragMeta && (
                <rect
                  x={el.x - (isDivider || isSubDivider ? 28 : 0)}
                  y={el.y - (isShelf || isSubDivider ? 22 : 0)}
                  width={Math.max(1, el.width + (isDivider || isSubDivider ? 56 : 0))}
                  height={Math.max(1, el.height + (isShelf || isSubDivider ? 44 : 0))}
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
                strokeWidth={isHiddenLeg ? 2 : 2.8}
                strokeDasharray={isHiddenLeg ? "10 7" : undefined}
                opacity={isDoor ? 0.34 : isHiddenLeg ? 0.65 : 0.98}
              />
              {(isShelf || (isDrawer && el.role === "drawer_front")) && el.width > 160 && (
                <g
                  className={`pointer-events-none transition-opacity duration-75 ${
                    isTech ? "opacity-100" : "opacity-0 group-hover/el:opacity-100"
                  }`}
                >
                  <rect
                    x={el.x + el.width / 2 - Math.min(175, el.width * 0.46)}
                    y={isShelf ? el.y - 42 : el.y + el.height / 2 - 20}
                    width={Math.min(350, el.width * 0.92)}
                    height={38}
                    rx={9}
                    fill="#1C1917"
                    opacity={0.9}
                  />
                  <text
                    x={el.x + el.width / 2}
                    y={isShelf ? el.y - 17 : el.y + el.height / 2 + 5}
                    textAnchor="middle"
                    fill="#FFFFFF"
                    fontSize="21"
                    fontWeight="700"
                    fontFamily="monospace"
                  >
                    {truncateCadLabel(
                      isShelf
                        ? `↕ Raf (${formatElevationValue(elevMm ?? 0, displayUnit)})`
                        : `↕ Çekmece (${formatElevationValue(elevMm ?? 0, displayUnit)})`,
                      el.width * 0.88,
                      13
                    )}
                  </text>
                </g>
              )}
              {isSpecialFitting &&
                !el.id.includes("_plinth_") &&
                !el.id.includes("_plastic_leg_") &&
                el.width > 120 && (
                  <g
                    className={`pointer-events-none transition-opacity duration-75 ${
                      isTech ? "opacity-100" : "opacity-0 group-hover/el:opacity-100"
                    }`}
                  >
                    <rect
                      x={el.x + el.width / 2 - Math.min(180, el.width * 0.46)}
                      y={el.y + el.height / 2 - 18}
                      width={Math.min(360, el.width * 0.92)}
                      height={36}
                      rx={8}
                      fill="#064E3B"
                      opacity={0.9}
                    />
                    <text
                      x={el.x + el.width / 2}
                      y={el.y + el.height / 2 + 6}
                      textAnchor="middle"
                      fill="#ECFDF5"
                      fontSize="18"
                      fontWeight="700"
                      fontFamily="monospace"
                    >
                      {truncateCadLabel(el.label, el.width * 0.88, 11)}
                    </text>
                  </g>
                )}
            </g>
          );
        })}

        {/* Neighbor Module Hanging Rails */}
        {nRails.map((rail) => {
          const rSvgY = nBreakdown.overall.height - (rail.position.y + rail.dimensions.height);
          const bIdx = rail.bayIndex ?? 0;
          const rCfg = m.bays[bIdx]?.hangingRails.find((r) => r.id === rail.id);
          const rElevY = rCfg?.elevationY ?? 1700;
          return (
            <g
              key={rail.id}
              data-testid={`cad-el-${rail.id}`}
              onMouseDown={(e) => {
                if (elevPanMode || e.button !== 0 || e.altKey) return;
                e.stopPropagation();
                const svgEl = (e.currentTarget as Element).closest("svg") as SVGSVGElement | null;
                const scale = svgEl ? getElevScaleMmPerPx(svgEl) : { x: 4, y: 4 };
                onSelectModule(mIdx);
                onSelectComponent(rail.id);
                onSelectBay(bIdx);
                onBeginHistory();
                onStartInteriorDrag({
                  kind: "rail",
                  bayIdx: bIdx,
                  targetId: rail.id,
                  startClientX: e.clientX,
                  startClientY: e.clientY,
                  startValueMm: rElevY,
                  mmPerPxX: scale.x,
                  mmPerPxY: scale.y,
                });
              }}
              className="group/el cursor-ns-resize"
            >
              <rect
                x={rail.position.x}
                y={rSvgY - 20}
                width={rail.dimensions.width}
                height={60}
                fill="transparent"
              />
              <rect
                x={rail.position.x + 4}
                y={rSvgY}
                width={Math.max(10, rail.dimensions.width - 8)}
                height={22}
                rx={7}
                fill="#94A3B8"
                stroke="#111827"
                strokeWidth="2.8"
              />
              {rail.dimensions.width > 160 && (
                <g
                  className={`pointer-events-none transition-opacity duration-75 ${
                    isTech ? "opacity-100" : "opacity-0 group-hover/el:opacity-100"
                  }`}
                >
                  <rect
                    x={rail.position.x + rail.dimensions.width / 2 - Math.min(130, rail.dimensions.width * 0.46)}
                    y={rSvgY - 40}
                    width={Math.min(260, rail.dimensions.width * 0.92)}
                    height={36}
                    rx={9}
                    fill="#0F172A"
                    opacity={0.86}
                  />
                  <text
                    x={rail.position.x + rail.dimensions.width / 2}
                    y={rSvgY - 16}
                    textAnchor="middle"
                    fill="#FFFFFF"
                    fontSize="20"
                    fontWeight="700"
                    fontFamily="monospace"
                  >
                    {truncateCadLabel(
                      `↕ Askı (${formatElevationValue(rElevY, displayUnit)})`,
                      rail.dimensions.width * 0.88,
                      12
                    )}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* Neighbor Module Top Dimension Line & Header Pill */}
        {isTech && (
          <>
            <line x1={0} y1={dimY - 12} x2={0} y2={dimY + 12} stroke="#44403C" strokeWidth="2.8" />
            <line x1={mw} y1={dimY - 12} x2={mw} y2={dimY + 12} stroke="#44403C" strokeWidth="2.8" />
            <line x1={0} y1={dimY} x2={mw} y2={dimY} stroke="#44403C" strokeWidth="2.8" />
          </>
        )}
        <g
          onMouseDown={startNeighborModMove}
          className={`${effectiveInteriorMoveMode ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"} ${
            isTech ? "opacity-100" : isSelectedMode ? "opacity-0 group-hover/mod:opacity-100 transition-opacity duration-75" : "opacity-0 pointer-events-none"
          }`}
        >
          <rect
            x={mw / 2 - Math.min(195, mw * 0.48)}
            y={-118}
            width={Math.min(390, mw * 0.96)}
            height={44}
            rx={10}
            fill="#FFFFFF"
            stroke="#44403C"
            strokeWidth="2.8"
          />
          <text
            x={mw / 2}
            y={-89}
            textAnchor="middle"
            fill="#141413"
            fontSize="21"
            fontWeight="800"
            fontFamily="monospace"
          >
            {truncateCadLabel(
              `#${mIdx + 1} ${m.name} (${formatElevationValue(mw, displayUnit)})`,
              mw * 0.9,
              13
            )}
          </text>
        </g>
      </g>
    );
  }
);

NeighborElevationModule.displayName = "NeighborElevationModule";
