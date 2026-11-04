"use client";

import React from "react";
import { ModuleInstance, DEFAULT_MATERIALS } from "@birim/core";

export interface V3IsometricModuleIconProps {
  module?: ModuleInstance;
  bayCount?: number;
  widthMm?: number;
  heightMm?: number;
  depthMm?: number;
  hasDrawers?: boolean;
  isOpenFront?: boolean;
  doorColorHex?: string;
  size?: "sm" | "md" | "lg";
}

/**
 * Renders a 3D isometric / perspective SVG miniature of a furniture module
 * showing its proportions (W/H/D), vertical intermediate dividers (Ara Dikmeler),
 * internal shelves, drawer fronts, and door material color.
 */
export const V3IsometricModuleIcon: React.FC<V3IsometricModuleIconProps> = React.memo(
  ({
    module,
    bayCount: propBayCount,
    widthMm: propW,
    heightMm: propH,
    depthMm: propD,
    hasDrawers: propDrawers,
    isOpenFront: propOpen,
    doorColorHex: propColor,
    size = "md",
  }) => {
    const wMm = module ? module.dimensions.width : propW || 1200;
    const hMm = module ? module.dimensions.height : propH || 2200;
    const dMm = module ? module.dimensions.depth : propD || 600;
    const bays = module ? module.bays.length : propBayCount || 2;
    const isOpen = module
      ? Boolean(module.isOpenFront || module.bays.every((b) => b.door.type === "open"))
      : Boolean(propOpen);

    const drawerCount = module
      ? module.bays.reduce((sum, b) => sum + b.drawers.length, 0)
      : propDrawers
      ? 2
      : 0;

    const shelfCount = module
      ? Math.max(1, ...module.bays.map((b) => b.shelves.length))
      : 2;

    const matDef = module
      ? DEFAULT_MATERIALS.find((m) => m.id === module.carcass.doorMaterialId)
      : undefined;
    const frontColor = propColor || matDef?.colorHex || "#D4B483";

    // Normalize cabinet visual dimensions inside a 64x56 viewBox
    const normW = Math.max(18, Math.min(34, (wMm / 2400) * 32));
    const normH = Math.max(18, Math.min(32, (hMm / 2400) * 30));
    const isoDx = Math.max(6, Math.min(11, (dMm / 650) * 9));
    const isoDy = Math.round(isoDx * 0.55);

    const x0 = Math.round((64 - (normW + isoDx)) / 2);
    const y0 = Math.round((54 - (normH + isoDy)) / 2) + isoDy;

    // Front face corners: (x0, y0) top-left, (x0+normW, y0+normH) bottom-right
    // Top face polygon
    const topPoints = `${x0},${y0} ${x0 + isoDx},${y0 - isoDy} ${x0 + normW + isoDx},${
      y0 - isoDy
    } ${x0 + normW},${y0}`;

    // Right side face polygon
    const sidePoints = `${x0 + normW},${y0} ${x0 + normW + isoDx},${y0 - isoDy} ${
      x0 + normW + isoDx
    },${y0 + normH - isoDy} ${x0 + normW},${y0 + normH}`;

    const dimClass =
      size === "sm" ? "w-8 h-7" : size === "lg" ? "w-14 h-12" : "w-10 h-9";

    return (
      <svg
        viewBox="0 0 64 54"
        className={`${dimClass} shrink-0 overflow-visible`}
        aria-hidden="true"
      >
        {/* Soft floor shadow */}
        <polygon
          points={`${x0 + 2},${y0 + normH + 2} ${x0 + normW + isoDx + 2},${
            y0 + normH - isoDy + 2
          } ${x0 + normW + 1},${y0 + normH + 4} ${x0 - 1},${y0 + normH + 4}`}
          fill="#000000"
          opacity={0.14}
        />

        {/* Top 3D Perspective Face */}
        <polygon
          points={topPoints}
          fill="#F5F5F4"
          stroke="#292524"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {/* Right Side 3D Perspective Face */}
        <polygon
          points={sidePoints}
          fill="#D6D3CB"
          stroke="#292524"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {/* Front Carcass Frame */}
        <rect
          x={x0}
          y={y0}
          width={normW}
          height={normH}
          fill={isOpen ? "#FAF8F5" : frontColor}
          stroke="#1C1917"
          strokeWidth="1.6"
          rx="1"
        />

        {/* Internal Shelves (visible when open or lightly hinted through doors) */}
        {Array.from({ length: Math.min(3, shelfCount) }).map((_, sIdx) => {
          const sy = y0 + ((sIdx + 1) * (normH * 0.68)) / (Math.min(3, shelfCount) + 1);
          return (
            <line
              key={`sh_${sIdx}`}
              x1={x0 + 1.5}
              y1={sy}
              x2={x0 + normW - 1.5}
              y2={sy}
              stroke="#B45309"
              strokeWidth="1.3"
              opacity={isOpen ? 0.95 : 0.45}
            />
          );
        })}

        {/* Drawer Stack at Bottom */}
        {drawerCount > 0 && (
          <g>
            {Array.from({ length: Math.min(3, drawerCount) }).map((_, dIdx) => {
              const dh = Math.min(5, (normH * 0.36) / Math.min(3, drawerCount));
              const dy = y0 + normH - 2 - (dIdx + 1) * dh;
              return (
                <rect
                  key={`drw_${dIdx}`}
                  x={x0 + 1.5}
                  y={dy}
                  width={normW - 3}
                  height={dh - 0.6}
                  fill={frontColor}
                  stroke="#7C2D12"
                  strokeWidth="1.1"
                />
              );
            })}
          </g>
        )}

        {/* Vertical Intermediate Dividers (Ara Dikmeler) */}
        {bays > 1 &&
          Array.from({ length: bays - 1 }).map((_, bIdx) => {
            const bx = x0 + ((bIdx + 1) * normW) / bays;
            return (
              <line
                key={`div_${bIdx}`}
                x1={bx}
                y1={y0 + 1}
                x2={bx}
                y2={y0 + normH - 1}
                stroke="#1C1917"
                strokeWidth="1.5"
              />
            );
          })}

        {/* Plinth / Baza Line */}
        <line
          x1={x0}
          y1={y0 + normH - 2}
          x2={x0 + normW}
          y2={y0 + normH - 2}
          stroke="#1C1917"
          strokeWidth="1.2"
        />
      </svg>
    );
  }
);

V3IsometricModuleIcon.displayName = "V3IsometricModuleIcon";
export default V3IsometricModuleIcon;
