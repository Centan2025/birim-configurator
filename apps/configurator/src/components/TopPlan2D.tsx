"use client";

import React, { useState } from "react";
import { useConfiguratorStore } from "../store/useConfiguratorStore";
import { generateModuleGeometry, generateTopPlan2D } from "@birim/geometry";

export default function TopPlan2D() {
  const project = useConfiguratorStore((s) => s.project);
  const activeModIndex = useConfiguratorStore((s) => s.activeModuleIndex);
  const selectedComponentId = useConfiguratorStore((s) => s.selectedComponentId);
  const setSelectedComponentId = useConfiguratorStore((s) => s.setSelectedComponentId);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });

  const activeMod = project.modules[activeModIndex] || project.modules[0];
  if (!activeMod) return null;

  const breakdown = generateModuleGeometry(activeMod, { doorOpenAngleDeg: 0 });
  const planData = generateTopPlan2D(breakdown, selectedComponentId || undefined);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsPanning(true);
    setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({ x: e.clientX - startPan.x, y: e.clientY - startPan.y });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const newZoom = Math.min(Math.max(0.4, zoom - e.deltaY * 0.001), 3);
    setZoom(newZoom);
  };

  const vb = planData.viewBox;

  return (
    <div
      className="relative w-full h-full bg-slate-900 overflow-hidden cursor-crosshair"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
    >
      <div className="absolute top-4 left-4 z-10 flex gap-2 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 text-xs">
        <span className="text-amber-400 font-semibold uppercase tracking-wider self-center">Üstten Plan (2D Top Plan)</span>
        <button
          onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
          className="ml-4 px-2 py-0.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
        >
          Sıfırla
        </button>
        <span className="text-slate-400 self-center">Zoom: {Math.round(zoom * 100)}%</span>
      </div>

      <svg
        viewBox={`${vb.x} ${vb.y} ${vb.width} ${vb.height}`}
        className="w-full h-full"
        style={{
          transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
          transformOrigin: "center center",
          transition: isPanning ? "none" : "transform 0.08s ease-out",
        }}
      >
        <defs>
          <pattern id="plan_grid" width="100" height="100" patternUnits="userSpaceOnUse">
            <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#1e293b" strokeWidth="1" />
          </pattern>
        </defs>

        <rect x={vb.x} y={vb.y} width={vb.width} height={vb.height} fill="url(#plan_grid)" />

        {/* Back Wall Representation */}
        <line
          x1={-50}
          y1={-5}
          x2={activeMod.dimensions.width + 50}
          y2={-5}
          stroke="#475569"
          strokeWidth="6"
        />

        {/* Components */}
        {planData.elements.map((el) => {
          const isSelected = el.isSelected;
          return (
            <rect
              key={el.id}
              x={el.x}
              y={el.y}
              width={Math.max(1, el.width)}
              height={Math.max(1, el.height)}
              fill={isSelected ? "#1d4ed8" : "#334155"}
              stroke={isSelected ? "#60a5fa" : "#64748b"}
              strokeWidth={isSelected ? 3 : 1.5}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedComponentId(el.id);
              }}
              className="cursor-pointer hover:brightness-125"
            />
          );
        })}

        {/* Dimension Lines */}
        {planData.dimensionLines.map((dim) => {
          const isH = dim.orientation === "horizontal";
          const midX = (dim.x1 + dim.x2) / 2;
          const midY = (dim.y1 + dim.y2) / 2;
          const pillW = Math.max(170, dim.label.length * 17 + 32);
          const pillH = 46;

          return (
            <g key={dim.id} className="select-none pointer-events-none">
              <line x1={dim.x1} y1={dim.y1} x2={dim.x2} y2={dim.y2} stroke="#f59e0b" strokeWidth="3" />
              {isH ? (
                <>
                  <line x1={dim.x1} y1={dim.y1 - 15} x2={dim.x1} y2={dim.y1 + 15} stroke="#f59e0b" strokeWidth="3" />
                  <line x1={dim.x2} y1={dim.y2 - 15} x2={dim.x2} y2={dim.y2 + 15} stroke="#f59e0b" strokeWidth="3" />
                  <rect
                    x={midX - pillW / 2}
                    y={dim.y1 - pillH - 8}
                    width={pillW}
                    height={pillH}
                    rx={10}
                    fill="#0f172a"
                    stroke="#f59e0b"
                    strokeWidth="2.5"
                  />
                  <text
                    x={midX}
                    y={dim.y1 - 18}
                    textAnchor="middle"
                    fill="#fbbf24"
                    fontSize="26"
                    fontWeight="700"
                    fontFamily="monospace"
                  >
                    {dim.label}
                  </text>
                </>
              ) : (
                <>
                  <line x1={dim.x1 - 15} y1={dim.y1} x2={dim.x1 + 15} y2={dim.y1} stroke="#f59e0b" strokeWidth="3" />
                  <line x1={dim.x2 - 15} y1={dim.y2} x2={dim.x2 + 15} y2={dim.y2} stroke="#f59e0b" strokeWidth="3" />
                  <g transform={`translate(${dim.x1 - 38}, ${midY}) rotate(-90)`}>
                    <rect
                      x={-pillW / 2}
                      y={-pillH / 2}
                      width={pillW}
                      height={pillH}
                      rx={10}
                      fill="#0f172a"
                      stroke="#f59e0b"
                      strokeWidth="2.5"
                    />
                    <text
                      x={0}
                      y={9}
                      textAnchor="middle"
                      fill="#fbbf24"
                      fontSize="26"
                      fontWeight="700"
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
