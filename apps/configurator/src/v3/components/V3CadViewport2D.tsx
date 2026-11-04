"use client";

import React, { useState, useMemo } from "react";
import {
  useV3Adapter,
  generateModuleGeometry,
  generateElevation2D,
  generateTopPlan2D,
  generateCrossSection2D,
  getModuleOrientedFootprint,
} from "../adapter/useV3Adapter";

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
    } = useV3Adapter();

    const [zoom, setZoom] = useState(1);
    const [showDoorsIn2D, setShowDoorsIn2D] = useState(false);
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
    } | null>(null);

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

    if (!activeModule) return null;

    // Multi-module architectural room plan mode
    if (mode === "plan" && interactivePlan) {
      const mainWall = spaceWalls[0] || {
        length: 3600,
        thickness: 150,
        name: "Ana Duvar",
      };
      const totalModExtentX = Math.max(
        mainWall.length + 200,
        ...footprints.map((fp) => fp.x + fp.planWidth + 250)
      );
      const maxDepthZ = Math.max(
        1800,
        ...footprints.map((fp) => fp.z + fp.planDepth + 450)
      );

      const pad = 280;
      const vb = {
        x: -pad,
        y: -pad,
        width: totalModExtentX + pad * 2,
        height: maxDepthZ + pad * 2,
      };

      const handleModPointerDown = (e: React.MouseEvent, idx: number) => {
        e.stopPropagation();
        if (idx !== activeModuleIndex) {
          setActiveModuleIndex(idx);
        }
        setDraggingModIdx(idx);
        setDragStartClient({
          x: e.clientX,
          z: e.clientY,
          startModX: project.modules[idx]?.position.x || 0,
          startModZ: project.modules[idx]?.position.z || 0,
        });
      };

      const handleSvgPointerMove = (e: React.MouseEvent<SVGSVGElement>) => {
        if (draggingModIdx === null) return;
        const svgEl = e.currentTarget;
        const rect = svgEl.getBoundingClientRect();
        const mmPerPx = vb.width / Math.max(1, rect.width * zoom);
        const dxMm = (e.clientX - dragStartClient.x) * mmPerPx;
        const dzMm = (e.clientY - dragStartClient.z) * mmPerPx;
        const nextX = Math.max(0, dragStartClient.startModX + dxMm);
        const nextZ = Math.max(0, dragStartClient.startModZ + dzMm);
        setModulePosition(draggingModIdx, nextX, nextZ, snapMm);
      };

      const handleSvgPointerUp = () => {
        setDraggingModIdx(null);
      };

      return (
        <div
          data-testid="v3-cad-plan-interactive"
          className="relative w-full h-full bg-[#E2DED5] overflow-hidden select-none flex flex-col"
        >
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
            viewBox={`${vb.x} ${vb.y} ${vb.width} ${vb.height}`}
            className="w-full h-full"
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

            {/* 1. Architectural Walls (Main Back Wall + L/U Side Return Walls) */}
            {spaceWalls.map((wall) => {
              const isSideWall = wall.rotationY === 90;
              if (isSideWall) {
                return (
                  <g key={wall.id}>
                    <rect
                      x={wall.position.x - wall.thickness}
                      y={wall.position.z}
                      width={wall.thickness}
                      height={wall.length}
                      fill="#B8B2A6"
                      stroke="#44403C"
                      strokeWidth="3"
                    />
                    <text
                      x={wall.position.x - wall.thickness - 24}
                      y={wall.position.z + wall.length / 2}
                      textAnchor="middle"
                      transform={`rotate(-90 ${wall.position.x - wall.thickness - 24} ${
                        wall.position.z + wall.length / 2
                      })`}
                      fill="#1C1917"
                      fontSize="22"
                      fontWeight="700"
                      fontFamily="monospace"
                    >
                      {wall.name} ({wall.length}mm)
                    </text>
                  </g>
                );
              }
              return (
                <g key={wall.id}>
                  <rect
                    x={wall.position.x}
                    y={-wall.thickness}
                    width={wall.length}
                    height={wall.thickness}
                    fill="#B8B2A6"
                    stroke="#44403C"
                    strokeWidth="3"
                  />
                  <line
                    x1={0}
                    y1={-wall.thickness - 55}
                    x2={wall.length}
                    y2={-wall.thickness - 55}
                    stroke="#44403C"
                    strokeWidth="2.5"
                  />
                  <text
                    x={wall.length / 2}
                    y={-wall.thickness - 72}
                    textAnchor="middle"
                    fill="#1C1917"
                    fontSize="26"
                    fontWeight="700"
                    fontFamily="monospace"
                  >
                    {wall.name}: {wall.length} mm
                  </text>
                </g>
              );
            })}

            {/* 2. Architectural Obstacles (Window, Structural Column, Plumbing) */}
            {spaceObstacles.map((obs) => {
              if (obs.type === "window") {
                return (
                  <g key={obs.id} data-testid={`plan-obstacle-${obs.id}`}>
                    <rect
                      x={obs.position.x}
                      y={-mainWall.thickness + 20}
                      width={obs.dimensions.width}
                      height={mainWall.thickness - 40}
                      fill="#BAE6FD"
                      stroke="#0284C7"
                      strokeWidth="3"
                    />
                    <text
                      x={obs.position.x + obs.dimensions.width / 2}
                      y={-mainWall.thickness / 2 + 6}
                      textAnchor="middle"
                      fill="#0369A1"
                      fontSize="20"
                      fontWeight="700"
                      fontFamily="monospace"
                    >
                      PENCERE ({obs.dimensions.width}mm)
                    </text>
                  </g>
                );
              }
              if (obs.type === "column") {
                return (
                  <g key={obs.id} data-testid={`plan-obstacle-${obs.id}`}>
                    <rect
                      x={obs.position.x}
                      y={obs.position.z}
                      width={obs.dimensions.width}
                      height={obs.dimensions.depth}
                      fill="url(#column_hatch)"
                      stroke="#292524"
                      strokeWidth="3"
                    />
                    <rect
                      x={obs.position.x}
                      y={obs.position.z}
                      width={obs.dimensions.width}
                      height={obs.dimensions.depth}
                      fill="#78716C"
                      opacity={0.35}
                    />
                    <text
                      x={obs.position.x + obs.dimensions.width / 2}
                      y={obs.position.z + obs.dimensions.depth + 32}
                      textAnchor="middle"
                      fill="#292524"
                      fontSize="19"
                      fontWeight="700"
                      fontFamily="monospace"
                    >
                      KOLON ({obs.dimensions.width}×{obs.dimensions.depth})
                    </text>
                  </g>
                );
              }
              if (obs.type === "plumbing") {
                const cx = obs.position.x + obs.dimensions.width / 2;
                return (
                  <g key={obs.id} data-testid={`plan-obstacle-${obs.id}`}>
                    <circle
                      cx={cx}
                      cy={-28}
                      r={24}
                      fill="#E0F2FE"
                      stroke="#0284C7"
                      strokeWidth="3"
                    />
                    <text
                      x={cx}
                      y={-21}
                      textAnchor="middle"
                      fill="#0369A1"
                      fontSize="18"
                      fontWeight="700"
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
              const isAct = idx === activeModuleIndex;
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
                    y={mz + md / 2 - 10}
                    textAnchor="middle"
                    fill="#1C1917"
                    fontSize="24"
                    fontWeight="700"
                    fontFamily="sans-serif"
                  >
                    {fp.name} {fp.rotationY > 0 ? `(${fp.rotationY}°)` : ""}
                  </text>
                  <text
                    x={mx + mw / 2}
                    y={mz + md / 2 + 22}
                    textAnchor="middle"
                    fill={hasCollisionError ? "#DC2626" : "#B86B2B"}
                    fontSize="22"
                    fontWeight="700"
                    fontFamily="monospace"
                  >
                    {fp.rawWidth} × {fp.rawDepth} mm
                  </text>

                  {/* Width Callout */}
                  <g>
                    <line
                      x1={mx}
                      y1={mz + md + 50}
                      x2={mx + mw}
                      y2={mz + md + 50}
                      stroke="#B86B2B"
                      strokeWidth="2"
                    />
                    <text
                      x={mx + mw / 2}
                      y={mz + md + 80}
                      textAnchor="middle"
                      fill="#9A3412"
                      fontSize="20"
                      fontWeight="700"
                      fontFamily="monospace"
                    >
                      {mw} mm
                    </text>
                  </g>

                  {/* Smart Remaining Clearance Callout */}
                  {gapRight > 20 && (
                    <g>
                      <line
                        x1={mx + mw}
                        y1={mz + md / 2}
                        x2={mx + mw + gapRight}
                        y2={mz + md / 2}
                        stroke="#0284C7"
                        strokeWidth="2"
                        strokeDasharray="10 6"
                      />
                      <text
                        x={mx + mw + gapRight / 2}
                        y={mz + md / 2 - 14}
                        textAnchor="middle"
                        fill="#0369A1"
                        fontSize="20"
                        fontWeight="700"
                        fontFamily="monospace"
                      >
                        Boşluk: {Math.round(gapRight)} mm
                      </text>
                    </g>
                  )}
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
      const snappedY = Math.round((interiorDrag.startValueMm + dyMm) / 10) * 10;

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
    };

    // Map component IDs to interior draggable items
    const findInteriorDragTarget = (compId: string) => {
      for (let bIdx = 0; bIdx < activeModule.bays.length; bIdx++) {
        const bay = activeModule.bays[bIdx];
        const shelf = bay.shelves.find((s) => s.id === compId);
        if (shelf) {
          return { kind: "shelf" as const, bayIdx: bIdx, targetId: shelf.id, startVal: shelf.elevationY };
        }
        const drawer = bay.drawers.find((d) => `${d.id}_front` === compId || `${d.id}_box` === compId || d.id === compId);
        if (drawer) {
          return { kind: "drawer" as const, bayIdx: bIdx, targetId: drawer.id, startVal: drawer.elevationY };
        }
        const rail = bay.hangingRails.find((r) => r.id === compId);
        if (rail) {
          return { kind: "rail" as const, bayIdx: bIdx, targetId: rail.id, startVal: rail.elevationY };
        }
        const subDiv = bay.subDividers?.find((sd) => sd.id === compId);
        if (subDiv) {
          return {
            kind: "sub_divider" as const,
            bayIdx: bIdx,
            targetId: subDiv.id,
            startVal: subDiv.offsetX,
          };
        }
      }
      if (compId.includes("_divider_")) {
        const divIdx = Number(compId.split("_divider_")[1]);
        if (!Number.isNaN(divIdx) && breakdown.bayWidths[divIdx]) {
          return {
            kind: "divider" as const,
            bayIdx: divIdx,
            targetId: compId,
            startVal: breakdown.bayWidths[divIdx],
          };
        }
      }
      return null;
    };

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
