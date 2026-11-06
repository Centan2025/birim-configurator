"use client";

import React, { useState } from "react";
import { useConfiguratorStore } from "../store/useConfiguratorStore";
import { generateModuleGeometry, generateElevation2D } from "@birim/geometry";

export default function Elevation2D() {
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
  const elevationData = generateElevation2D(breakdown, selectedComponentId || undefined);

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
    e.stopPropagation();
    const newZoom = Math.min(Math.max(0.4, zoom - e.deltaY * 0.001), 3);
    setZoom(newZoom);
  };

  const vb = elevationData.viewBox;

  return (
    <div
      className="relative w-full h-full bg-slate-900 overflow-hidden cursor-crosshair"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* 2D Toolbar */}
      <div className="absolute top-4 left-4 z-10 flex gap-2 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 text-xs">
        <span className="text-amber-400 font-semibold uppercase tracking-wider self-center">Ön Görünüş (2D CAD)</span>
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
          <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
            <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#1e293b" strokeWidth="1" />
          </pattern>
        </defs>

        {/* CAD Grid */}
        <rect x={vb.x} y={vb.y} width={vb.width} height={vb.height} fill="url(#grid)" />

        {/* Floor Line */}
        <line
          x1={-100}
          y1={activeMod.dimensions.height}
          x2={activeMod.dimensions.width + 100}
          y2={activeMod.dimensions.height}
          stroke="#475569"
          strokeWidth="3"
          strokeDasharray="8 4"
        />

        {/* Components */}
        {elevationData.elements.map((el) => {
          const isSelected = el.isSelected;
          const isDoor = el.role.startsWith("door");
          const isDrawer = el.role.startsWith("drawer");
          const isShelf = el.role === "shelf";

          let fillColor = "#1e293b";
          let strokeColor = "#64748b";

          if (isDoor) {
            fillColor = "#334155";
            strokeColor = "#94a3b8";
          } else if (isDrawer) {
            fillColor = "#1e293b";
            strokeColor = "#cbd5e1";
          } else if (isShelf) {
            fillColor = "#3b4252";
            strokeColor = "#94a3b8";
          }

          if (isSelected) {
            fillColor = "#1d4ed8";
            strokeColor = "#60a5fa";
          }

          return (
            <g
              key={el.id}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedComponentId(el.id);
              }}
              className="cursor-pointer group"
            >
              <rect
                x={el.x}
                y={el.y}
                width={Math.max(1, el.width)}
                height={Math.max(1, el.height)}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={isSelected ? 3 : 1.5}
                opacity={isDoor ? 0.6 : 0.9}
                className="transition-all duration-150 group-hover:brightness-125"
              />
              {/* Label inside component if large enough */}
              {el.width > 120 && el.height > 60 && (
                <text
                  x={el.x + el.width / 2}
                  y={el.y + el.height / 2 + 4}
                  textAnchor="middle"
                  fill="#f1f5f9"
                  fontSize="12"
                  fontFamily="monospace"
                  opacity={0.8}
                  pointerEvents="none"
                >
                  {el.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Dimension Lines */}
        {elevationData.dimensionLines.map((dim) => {
          const isH = dim.orientation === "horizontal";
          return (
            <g key={dim.id} className="select-none pointer-events-none">
              {/* Main Line */}
              <line
                x1={dim.x1}
                y1={dim.y1}
                x2={dim.x2}
                y2={dim.y2}
                stroke="#f59e0b"
                strokeWidth="1.5"
              />
              {/* Ticks */}
              {isH ? (
                <>
                  <line x1={dim.x1} y1={dim.y1 - 6} x2={dim.x1} y2={dim.y1 + 6} stroke="#f59e0b" strokeWidth="1.5" />
                  <line x1={dim.x2} y1={dim.y2 - 6} x2={dim.x2} y2={dim.y2 + 6} stroke="#f59e0b" strokeWidth="1.5" />
                  <text
                    x={(dim.x1 + dim.x2) / 2}
                    y={dim.y1 - 8}
                    textAnchor="middle"
                    fill="#fbbf24"
                    fontSize="13"
                    fontWeight="600"
                    fontFamily="monospace"
                  >
                    {dim.label}
                  </text>
                </>
              ) : (
                <>
                  <line x1={dim.x1 - 6} y1={dim.y1} x2={dim.x1 + 6} y2={dim.y1} stroke="#f59e0b" strokeWidth="1.5" />
                  <line x1={dim.x2 - 6} y1={dim.y2} x2={dim.x2 + 6} y2={dim.y2} stroke="#f59e0b" strokeWidth="1.5" />
                  <text
                    x={dim.x1 - 10}
                    y={(dim.y1 + dim.y2) / 2 + 4}
                    textAnchor="end"
                    fill="#fbbf24"
                    fontSize="13"
                    fontWeight="600"
                    fontFamily="monospace"
                  >
                    {dim.label}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
