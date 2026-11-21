"use client";

import React, { useMemo, useState } from "react";
import { X, Layers, ArrowRight, ZoomIn, AlertTriangle, CheckCircle2 } from "lucide-react";
import { createInitialProject, type ModuleInstance } from "@birim/core";
import {
  generateModuleGeometry,
  componentBounds,
  transformComponentPoint,
  type ComponentGeometry,
} from "@birim/geometry";
import { HandleCrossSectionSvg, getHandleCrossSectionMeta } from "./HandleCrossSectionSvg";
import {
  buildDoorSystemsShowcaseProject,
  type DoorShowcaseMode,
} from "../v3/adapter/doorShowcaseBuilder";

export interface DoorSystemsShowcaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoad3DShowcase: (mode: DoorShowcaseMode) => void;
}

interface RealSectionCardData {
  mod: ModuleInstance;
  components: ComponentGeometry[];
  isWall: boolean;
  doorGapTopMm: number | null;
  golaZRange: [number, number] | null;
  bracketCount: number;
  doorZRange: [number, number] | null;
  protrusionMm: number;
}

function getRoleStyle(comp: ComponentGeometry): {
  fill: string;
  stroke: string;
  opacity: number;
  zOrder: number;
} {
  if (comp.id.includes("_gola_fixing_bracket_")) {
    return { fill: "#64748B", stroke: "#1E293B", opacity: 0.94, zOrder: 4 };
  }
  const r = String(comp.role);
  if (r === "countertop") {
    return { fill: "#D6CFC2", stroke: "#44403C", opacity: 0.92, zOrder: 2 };
  }
  if (r.startsWith("carcass_") || r === "plinth" || r === "shelf") {
    return { fill: "#EDE8DD", stroke: "#78716C", opacity: 0.72, zOrder: 1 };
  }
  if (r === "gola_profile") {
    return { fill: "#F59E0B", stroke: "#92400E", opacity: 0.96, zOrder: 6 };
  }
  if (r === "door_handle" || r === "drawer_handle") {
    return { fill: "#2563EB", stroke: "#1E3A8A", opacity: 0.96, zOrder: 7 };
  }
  if (r === "door_left" || r === "door_right" || r === "drawer_front") {
    return { fill: "#CBD5E1", stroke: "#0F172A", opacity: 0.92, zOrder: 5 };
  }
  if (r === "door_hinge" || r === "special_fitting" || comp.id.includes("_aventos_mech_")) {
    return { fill: "#A855F7", stroke: "#6B21A8", opacity: 0.82, zOrder: 3 };
  }
  return { fill: "#E2E8F0", stroke: "#64748B", opacity: 0.45, zOrder: 0 };
}

/**
 * Renders the true 2D cross-section contour (not just AABB!) of contoured/rotated doors,
 * extruded Gola/Edge profiles, and Carcass Fixing Brackets directly from `generateModuleGeometry(mod)`.
 */
function renderComponentTrueSectionShape(
  c: ComponentGeometry,
  b: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } },
  toX: (z: number) => number,
  toY: (y: number) => number,
  scale: number,
  isWall: boolean,
  isProtrudingMech: boolean
): React.ReactNode {
  const st = getRoleStyle(c);
  const z0 = b.min.z;
  const z1 = b.max.z;
  const y0 = b.min.y;
  const y1 = b.max.y;
  const d = z1 - z0;
  const h = y1 - y0;
  const tooltip = `${c.label || c.role} | Y:${Math.round(y0)}..${Math.round(y1)} mm | Z:${Math.round(
    z0
  )}..${Math.round(z1)} mm`;

  // 0. Gola Carcass Fixing Bracket (`_gola_fixing_bracket_`, Scilm SU116 / Häfele 712.63.511)
  if (c.id.includes("_gola_fixing_bracket_")) {
    // Only render left-side bracket in Y-Z view so left & right don't double-paint
    if (c.id.includes("_R")) return null;
    const midY = (y0 + y1) / 2;
    return (
      <g key={c.id}>
        <title>{tooltip}</title>
        {/* Main zinc/polymer L-bracket body bolted to carcass side upright */}
        <rect
          x={toX(z0)}
          y={toY(y1)}
          width={Math.max(2, d * scale)}
          height={Math.max(2, h * scale)}
          rx={1.2}
          fill="#64748B"
          fillOpacity={0.9}
          stroke="#CBD5E1"
          strokeWidth={1}
        />
        {/* Front T-slot locking tongue engaging rear dovetail of Gola channel */}
        <rect
          x={toX(z1 - 6)}
          y={toY(midY + Math.min(9, h * 0.28))}
          width={Math.max(2, 9 * scale)}
          height={Math.max(2, Math.min(18, h * 0.56) * scale)}
          fill="#475569"
          stroke="#E2E8F0"
          strokeWidth={0.9}
        />
        {/* Dual Ø5mm Euro/chipboard mounting screws into side panel */}
        <circle
          cx={toX(z0 + d * 0.34)}
          cy={toY(midY + h * 0.24)}
          r={Math.max(1.3, 2.4 * scale)}
          fill="#F8FAFC"
          stroke="#CBD5E1"
          strokeWidth={0.7}
        />
        <circle
          cx={toX(z0 + d * 0.34)}
          cy={toY(midY - h * 0.24)}
          r={Math.max(1.3, 2.4 * scale)}
          fill="#F8FAFC"
          stroke="#CBD5E1"
          strokeWidth={0.7}
        />
      </g>
    );
  }

  const isDoorOrDrawer =
    c.role === "door_left" || c.role === "door_right" || c.role === "drawer_front";

  // 0b. Pitch-Rotated Lift / Bi-Fold / Flap Door Leaf (`Math.abs(rotation[0]) > 0.01`):
  // Project exact 4 Y-Z corners so tilted AVENTOS HK / HF bi-fold leaves draw true 18mm slabs instead of fat AABBs!
  if ((isDoorOrDrawer || c.id.includes("_aventos_mech_")) && c.rotation && Math.abs(c.rotation[0]) > 0.01) {
    const px = c.position.x + c.dimensions.width / 2;
    const py = c.position.y;
    const pz = c.position.z;
    const ch = c.dimensions.height;
    const cd = c.dimensions.depth;
    const corners = [
      transformComponentPoint(c, { x: px, y: py, z: pz }),
      transformComponentPoint(c, { x: px, y: py, z: pz + cd }),
      transformComponentPoint(c, { x: px, y: py + ch, z: pz + cd }),
      transformComponentPoint(c, { x: px, y: py + ch, z: pz }),
    ];
    const pts = corners.map((pt) => `${toX(pt.z)},${toY(pt.y)}`).join(" ");
    return (
      <polygon
        key={c.id}
        points={pts}
        fill={st.fill}
        fillOpacity={st.opacity}
        stroke={st.stroke}
        strokeWidth={1.15}
      >
        <title>{tooltip}</title>
      </polygon>
    );
  }

  // 1. Contoured CNC J-Pull Door (`j_pull_bevel`): Top edge on Base/Drawers, BOTTOM edge on Upper Wall Cabinets!
  if (isDoorOrDrawer && c.crossSectionProfile === "j_pull_bevel" && h > 80) {
    const grooveDepthY = Math.min(35, Math.max(26, h * 0.05));
    const backWallT = Math.max(4.5, d * 0.21);
    const frontHookT = Math.max(3.5, d * 0.17);
    const zGrooveBack = z0 + backWallT;
    const zHookInner = z1 - frontHookT;
    const pathD = isWall
      ? (() => {
          const yFloorB = y0 + grooveDepthY;
          const yHookTipB = yFloorB - 5.5;
          return [
            `M ${toX(z0)} ${toY(y1)}`,
            `L ${toX(z1)} ${toY(y1)}`,
            `L ${toX(z1)} ${toY(yHookTipB + 1.5)}`,
            `Q ${toX(z1)} ${toY(yHookTipB)} ${toX(z1 - 1.2)} ${toY(yHookTipB)}`,
            `L ${toX(zHookInner + 0.8)} ${toY(yHookTipB)}`,
            `Q ${toX(zHookInner - 1.2)} ${toY(yFloorB)} ${toX((zGrooveBack + zHookInner) * 0.5)} ${toY(yFloorB)}`,
            `Q ${toX(zGrooveBack + 0.8)} ${toY(yFloorB)} ${toX(zGrooveBack)} ${toY(yFloorB - 3)}`,
            `L ${toX(zGrooveBack)} ${toY(y0)}`,
            `L ${toX(z0)} ${toY(y0)}`,
            "Z",
          ].join(" ");
        })()
      : (() => {
          const yFloor = y1 - grooveDepthY;
          const yHookTip = yFloor + 5.5;
          return [
            `M ${toX(z0)} ${toY(y0)}`,
            `L ${toX(z1)} ${toY(y0)}`,
            `L ${toX(z1)} ${toY(yHookTip - 1.5)}`,
            `Q ${toX(z1)} ${toY(yHookTip)} ${toX(z1 - 1.2)} ${toY(yHookTip)}`,
            `L ${toX(zHookInner + 0.8)} ${toY(yHookTip)}`,
            `Q ${toX(zHookInner - 1.2)} ${toY(yFloor)} ${toX((zGrooveBack + zHookInner) * 0.5)} ${toY(yFloor)}`,
            `Q ${toX(zGrooveBack + 0.8)} ${toY(yFloor)} ${toX(zGrooveBack)} ${toY(yFloor + 3)}`,
            `L ${toX(zGrooveBack)} ${toY(y1)}`,
            `L ${toX(z0)} ${toY(y1)}`,
            "Z",
          ].join(" ");
        })();
    return (
      <path
        key={c.id}
        d={pathD}
        fill={st.fill}
        fillOpacity={st.opacity}
        stroke={st.stroke}
        strokeWidth={1.1}
      >
        <title>{tooltip}</title>
      </path>
    );
  }

  // 2. 30°/45° Beveled Door (`bevel_45`): Sloped top edge (back lower, front crisp peak — TLD HL10!)
  if (isDoorOrDrawer && c.crossSectionProfile === "bevel_45" && h > 80 && !isWall) {
    const bevelDrop = Math.min(16, d * 0.85);
    const pts = [
      `${toX(z0)},${toY(y0)}`,
      `${toX(z1)},${toY(y0)}`,
      `${toX(z1)},${toY(y1)}`,
      `${toX(z0)},${toY(y1 - bevelDrop)}`,
    ].join(" ");
    return (
      <polygon
        key={c.id}
        points={pts}
        fill={st.fill}
        fillOpacity={st.opacity}
        stroke={st.stroke}
        strokeWidth={1.1}
      >
        <title>{tooltip}</title>
      </polygon>
    );
  }

  // 3. True Extruded Gola / Melamine Finger-Box / C-Gola / Wall Gola 268 Cross-Section Contours!
  if (c.role === "gola_profile") {
    const cid = c.id;
    // 3a. 2-Piece L Melamine / Moulded Finger Box
    if (cid.includes("gola_melamine_box") || cid.includes("gola_moulded_box")) {
      const bt = cid.includes("gola_moulded_box") ? 12 : 16;
      const pts = [
        `${toX(z0)},${toY(y1)}`,
        `${toX(z0 + bt)},${toY(y1)}`,
        `${toX(z0 + bt)},${toY(y0 + bt)}`,
        `${toX(z1)},${toY(y0 + bt)}`,
        `${toX(z1)},${toY(y0)}`,
        `${toX(z0)},${toY(y0)}`,
      ].join(" ");
      return (
        <polygon key={c.id} points={pts} fill="#D6B88D" stroke="#78350F" strokeWidth={1.2}>
          <title>{tooltip}</title>
        </polygon>
      );
    }

    // 3b. Flat 60x18mm Bevel Backing Plate
    if (cid.includes("gola_bevel_backing")) {
      return (
        <rect
          key={c.id}
          x={toX(z0)}
          y={toY(y1)}
          width={Math.max(2, d * scale)}
          height={Math.max(2, h * scale)}
          fill="#D6B88D"
          stroke="#78350F"
          strokeWidth={1.2}
        >
          <title>{tooltip}</title>
        </rect>
      );
    }

    // 3c. Hollow Aluminum C-Gola (73.5x26mm between drawers + rear dovetail bracket rails)
    if (cid.includes("gola_c_channel")) {
      const t = 3;
      const lip = 8;
      const midY = (y0 + y1) / 2;
      const pts = [
        `${toX(z1)},${toY(y1 - lip)}`,
        `${toX(z1)},${toY(y1)}`,
        `${toX(z0)},${toY(y1)}`,
        `${toX(z0)},${toY(y0)}`,
        `${toX(z1)},${toY(y0)}`,
        `${toX(z1)},${toY(y0 + lip)}`,
        `${toX(z1 - t)},${toY(y0 + lip)}`,
        `${toX(z1 - t)},${toY(y0 + t)}`,
        `${toX(z0 + t)},${toY(y0 + t)}`,
        `${toX(z0 + t)},${toY(y1 - t)}`,
        `${toX(z1 - t)},${toY(y1 - t)}`,
        `${toX(z1 - t)},${toY(y1 - lip)}`,
      ].join(" ");
      return (
        <g key={c.id}>
          <title>{tooltip}</title>
          <polygon points={pts} fill="#F59E0B" stroke="#92400E" strokeWidth={1} />
          {/* Rear extruded dovetail locking ears gripping the carcass bracket */}
          <rect
            x={toX(z0 - 3.5)}
            y={toY(midY + 10)}
            width={Math.max(1.5, 3.5 * scale)}
            height={Math.max(1.2, 2.5 * scale)}
            fill="#F59E0B"
            stroke="#92400E"
            strokeWidth={0.7}
          />
          <rect
            x={toX(z0 - 3.5)}
            y={toY(midY - 7.5)}
            width={Math.max(1.5, 3.5 * scale)}
            height={Math.max(1.2, 2.5 * scale)}
            fill="#F59E0B"
            stroke="#92400E"
            strokeWidth={0.7}
          />
        </g>
      );
    }

    // 3d. Wall Cabinet Bottom Gola 268 (Inverted Recessed Channel)
    if (cid.includes("gola_wall_268")) {
      const t = 3;
      const pts = [
        `${toX(z0)},${toY(y0)}`,
        `${toX(z0)},${toY(y1)}`,
        `${toX(z1)},${toY(y1)}`,
        `${toX(z1)},${toY(y1 - 6)}`,
        `${toX(z1 - t)},${toY(y1 - 6)}`,
        `${toX(z1 - t)},${toY(y1 - t)}`,
        `${toX(z0 + t)},${toY(y1 - t)}`,
        `${toX(z0 + t)},${toY(y0)}`,
      ].join(" ");
      return (
        <polygon key={c.id} points={pts} fill="#F59E0B" stroke="#92400E" strokeWidth={1}>
          <title>{tooltip}</title>
        </polygon>
      );
    }

    // 3e. Hollow Aluminum Top L-Gola (56x26mm + rear dovetail bracket rails)
    const t = 3;
    const lip = 7;
    const midBracketY = y0 + 22;
    const pts = [
      `${toX(z0)},${toY(y1)}`,
      `${toX(z0 + t)},${toY(y1)}`,
      `${toX(z0 + t)},${toY(y0 + t)}`,
      `${toX(z1 - t)},${toY(y0 + t)}`,
      `${toX(z1 - t)},${toY(y0 + lip)}`,
      `${toX(z1)},${toY(y0 + lip)}`,
      `${toX(z1)},${toY(y0)}`,
      `${toX(z0)},${toY(y0)}`,
    ].join(" ");
    return (
      <g key={c.id}>
        <title>{tooltip}</title>
        <polygon points={pts} fill="#F59E0B" stroke="#92400E" strokeWidth={1} />
        <rect
          x={toX(z0 - 3.5)}
          y={toY(midBracketY + 8.5)}
          width={Math.max(1.5, 3.5 * scale)}
          height={Math.max(1.2, 2.4 * scale)}
          fill="#F59E0B"
          stroke="#92400E"
          strokeWidth={0.7}
        />
        <rect
          x={toX(z0 - 3.5)}
          y={toY(midBracketY - 6.5)}
          width={Math.max(1.5, 3.5 * scale)}
          height={Math.max(1.2, 2.4 * scale)}
          fill="#F59E0B"
          stroke="#92400E"
          strokeWidth={0.7}
        />
      </g>
    );
  }

  // 4. Clip-On Aluminum Edge Profile (`edge_horizontal_profile`): Thin top plate + downward front hook
  if (c.id.includes("edge_horizontal_profile")) {
    const pts = [
      `${toX(z0)},${toY(y1)}`,
      `${toX(z1)},${toY(y1)}`,
      `${toX(z1)},${toY(y1 - 9)}`,
      `${toX(z1 - 2.5)},${toY(y1 - 9)}`,
      `${toX(z1 - 2.5)},${toY(y1 - 2.5)}`,
      `${toX(z0)},${toY(y1 - 2.5)}`,
    ].join(" ");
    return (
      <polygon key={c.id} points={pts} fill="#2563EB" stroke="#1E3A8A" strokeWidth={1}>
        <title>{tooltip}</title>
      </polygon>
    );
  }

  // Default rectangular cross-section
  return (
    <rect
      key={c.id}
      x={toX(z0)}
      y={toY(y1)}
      width={Math.max(1.5, d * scale)}
      height={Math.max(1.5, h * scale)}
      fill={isProtrudingMech ? "#EF4444" : st.fill}
      fillOpacity={st.opacity}
      stroke={isProtrudingMech ? "#991B1B" : st.stroke}
      strokeWidth={isProtrudingMech ? 1.4 : 0.9}
    >
      <title>{tooltip}</title>
    </rect>
  );
}

const RealGeometricYZSection: React.FC<{
  data: RealSectionCardData;
  zoomGripZone: boolean;
  doorOpenDeg: number;
  drawerOpenMm: number;
}> = React.memo(({ data, zoomGripZone, doorOpenDeg, drawerOpenMm }) => {
  const { mod, components, isWall } = data;
  const modD = mod.dimensions.depth;
  const modH = mod.dimensions.height;
  const isVerticalGolaMod = mod.bays.some((b) => b.door?.handleProfileId === "hnd_gola_vertical");

  // Dikey Gola (1020) için gerçek 1:1 X–Z Yatay Plan Kesiti (Orta Birleşim + Sabitleyici Klips!)
  if (isVerticalGolaMod) {
    const modW = mod.dimensions.width;
    const minX = zoomGripZone ? modW / 2 - 110 : -20;
    const maxX = zoomGripZone ? modW / 2 + 110 : modW + 20;
    const pMinZ = zoomGripZone ? modD - 95 : Math.max(0, modD - 200);
    const pMaxZ = modD + (doorOpenDeg > 2 ? 180 : 45);
    const spanX = Math.max(80, maxX - minX);
    const spanZ = Math.max(80, pMaxZ - pMinZ);
    const svgW = 280;
    const svgH = 190;
    const pad = 16;
    const scale = Math.min((svgW - pad * 2) / spanX, (svgH - pad * 2) / spanZ);
    const ox = pad + (svgW - pad * 2 - spanX * scale) / 2;
    const oy = pad + (svgH - pad * 2 - spanZ * scale) / 2;
    const toPX = (x: number) => ox + (x - minX) * scale;
    const toPZ = (z: number) => oy + (z - pMinZ) * scale;

    const planComps = [...components]
      .filter(
        (c) =>
          c.role === "carcass_side_left" ||
          c.role === "carcass_side_right" ||
          c.role === "carcass_divider" ||
          c.role === "door_left" ||
          c.role === "door_right" ||
          c.role === "gola_profile" ||
          c.id.includes("_gola_fixing_bracket_vert_2")
      )
      .sort((a, b) => getRoleStyle(a).zOrder - getRoleStyle(b).zOrder);

    return (
      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="w-full h-[186px] rounded-xl bg-[#FAF8F4] border border-[#E5DFD3]"
      >
        <line
          x1={pad}
          y1={toPZ(modD)}
          x2={svgW - pad}
          y2={toPZ(modD)}
          stroke="#DC2626"
          strokeWidth="0.9"
          strokeDasharray="3 2"
          opacity={0.55}
        />
        <text x={pad + 2} y={toPZ(modD) - 4} fontSize="7.5" fontFamily="monospace" fill="#DC2626">
          YATAY PLAN KESİTİ (X–Z) • Z={modD}
        </text>
        {planComps.map((c) => {
          const b = componentBounds(c);
          const st = getRoleStyle(c);
          if (c.role === "gola_profile") {
            const t = 3;
            const pts = [
              `${toPX(b.min.x)},${toPZ(b.max.z)}`,
              `${toPX(b.min.x)},${toPZ(b.min.z)}`,
              `${toPX(b.max.x)},${toPZ(b.min.z)}`,
              `${toPX(b.max.x)},${toPZ(b.max.z)}`,
              `${toPX(b.max.x - t)},${toPZ(b.max.z)}`,
              `${toPX(b.max.x - t)},${toPZ(b.min.z + t)}`,
              `${toPX(b.min.x + t)},${toPZ(b.min.z + t)}`,
              `${toPX(b.min.x + t)},${toPZ(b.max.z)}`,
            ].join(" ");
            return (
              <polygon key={c.id} points={pts} fill="#F59E0B" stroke="#92400E" strokeWidth={1.1}>
                <title>{`${c.label} | X:${Math.round(b.min.x)}..${Math.round(b.max.x)} | Z:${Math.round(b.min.z)}..${Math.round(b.max.z)}`}</title>
              </polygon>
            );
          }
          // Yaw-rotated hinged tall doors in X-Z plan!
          if ((c.role === "door_left" || c.role === "door_right") && c.rotation && Math.abs(c.rotation[1]) > 0.01) {
            const py = c.position.y + c.dimensions.height / 2;
            const px = c.position.x;
            const pz = c.position.z;
            const cw = c.dimensions.width;
            const cd = c.dimensions.depth;
            const corners = [
              transformComponentPoint(c, { x: px, y: py, z: pz }),
              transformComponentPoint(c, { x: px + cw, y: py, z: pz }),
              transformComponentPoint(c, { x: px + cw, y: py, z: pz + cd }),
              transformComponentPoint(c, { x: px, y: py, z: pz + cd }),
            ];
            const pts = corners.map((pt) => `${toPX(pt.x)},${toPZ(pt.z)}`).join(" ");
            return (
              <polygon
                key={c.id}
                points={pts}
                fill={st.fill}
                fillOpacity={st.opacity}
                stroke={st.stroke}
                strokeWidth={1.1}
              >
                <title>{c.label}</title>
              </polygon>
            );
          }
          return (
            <rect
              key={c.id}
              x={toPX(b.min.x)}
              y={toPZ(b.min.z)}
              width={Math.max(1.5, (b.max.x - b.min.x) * scale)}
              height={Math.max(1.5, (b.max.z - b.min.z) * scale)}
              fill={st.fill}
              fillOpacity={st.opacity}
              stroke={st.stroke}
              strokeWidth={1}
            >
              <title>{`${c.label || c.role} | X:${Math.round(b.min.x)}..${Math.round(b.max.x)} | Z:${Math.round(b.min.z)}..${Math.round(b.max.z)}`}</title>
            </rect>
          );
        })}
      </svg>
    );
  }

  // Y–Z Yan Kesit (Z = soldan sağa, Y = aşağıdan yukarıya)
  const isMultiDrawerGola = (mod.bays[0]?.drawers?.length || 0) >= 2;
  const extraPullZ = isMultiDrawerGola && drawerOpenMm > 2 ? drawerOpenMm : 0;
  let minZ = -20;
  let maxZ = modD + Math.max(doorOpenDeg > 2 ? 260 : 90, extraPullZ + 70);
  let minY = -25;
  let maxY = modH + (isWall ? (doorOpenDeg > 2 ? 260 : 60) : 95);

  if (zoomGripZone) {
    minZ = Math.max(0, modD - 165);
    maxZ = modD + Math.max(doorOpenDeg > 2 ? 155 : 70, Math.min(220, extraPullZ + 55));
    if (isWall) {
      minY = -32;
      maxY = doorOpenDeg > 2 ? modH + 160 : Math.min(modH + 30, 175);
    } else if (isMultiDrawerGola) {
      const cChannels = components.filter((c) => c.id.includes("gola_c_channel"));
      const lowestCGolaY =
        cChannels.length > 0
          ? Math.min(...cChannels.map((c) => componentBounds(c).min.y))
          : modH - 520;
      minY = Math.max(80, lowestCGolaY - 65);
      maxY = modH + 55;
    } else {
      minY = Math.max(0, modH - 185);
      maxY = modH + 62;
    }
  }

  const spanZ = Math.max(80, maxZ - minZ);
  const spanY = Math.max(80, maxY - minY);
  const svgW = 280;
  const svgH = 190;
  const pad = 16;
  const scale = Math.min((svgW - pad * 2) / spanZ, (svgH - pad * 2) / spanY);
  const offsetX = pad + (svgW - pad * 2 - spanZ * scale) / 2;
  const offsetY = pad + (svgH - pad * 2 - spanY * scale) / 2;

  const toX = (z: number) => offsetX + (z - minZ) * scale;
  const toY = (y: number) => svgH - offsetY - (y - minY) * scale;

  const sortedComps = [...components]
    .filter(
      (c) =>
        c.role !== "carcass_side_left" &&
        c.role !== "carcass_side_right" &&
        !c.id.includes("backsplash")
    )
    .sort((a, b) => getRoleStyle(a).zOrder - getRoleStyle(b).zOrder);

  return (
    <svg
      viewBox={`0 0 ${svgW} ${svgH}`}
      className="w-full h-[186px] rounded-xl bg-[#FAF8F4] border border-[#E5DFD3]"
    >
      {Array.from({ length: 14 }).map((_, i) => {
        const gz = Math.ceil(minZ / 50) * 50 + i * 50;
        if (gz > maxZ) return null;
        return (
          <line
            key={`gz-${gz}`}
            x1={toX(gz)}
            y1={pad}
            x2={toX(gz)}
            y2={svgH - pad}
            stroke="#E7E2D8"
            strokeWidth="0.6"
            strokeDasharray="2 2"
          />
        );
      })}

      {/* Gövde Ön Yüzü Referans Çizgisi */}
      <line
        x1={toX(modD)}
        y1={pad}
        x2={toX(modD)}
        y2={svgH - pad}
        stroke="#DC2626"
        strokeWidth="0.9"
        strokeDasharray="3 2"
        opacity={0.55}
      />
      <text
        x={toX(modD) + 2}
        y={pad + 8}
        fontSize="7.5"
        fontFamily="monospace"
        fill="#DC2626"
        opacity={0.85}
      >
        Z={modD}
      </text>

      {sortedComps.map((c) => {
        const b = componentBounds(c);
        const isProtrudingMech =
          doorOpenDeg < 2 &&
          drawerOpenMm < 2 &&
          (c.role === "special_fitting" || c.id.includes("_aventos_mech_")) &&
          !c.id.includes("_gola_fixing_bracket_") &&
          b.max.z > modD + 2;
        return renderComponentTrueSectionShape(
          c,
          b,
          toX,
          toY,
          scale,
          isWall,
          isProtrudingMech
        );
      })}
    </svg>
  );
});
RealGeometricYZSection.displayName = "RealGeometricYZSection";

export const DoorSystemsShowcaseModal: React.FC<DoorSystemsShowcaseModalProps> = React.memo(
  ({ isOpen, onClose, onLoad3DShowcase }) => {
    const [zoomGripZone, setZoomGripZone] = useState(true);
    const [doorOpenDeg, setDoorOpenDeg] = useState(0);
    const [drawerOpenMm, setDrawerOpenMm] = useState(0);

    const sectionCards = useMemo<RealSectionCardData[]>(() => {
      if (!isOpen) return [];
      const baseProj = createInitialProject();
      const showcaseProj = buildDoorSystemsShowcaseProject(baseProj, "kitchen_opening_systems");

      return showcaseProj.modules.map((mod) => {
        const bd = generateModuleGeometry(mod, {
          doorOpenAngleDeg: doorOpenDeg,
          drawerOpenMm,
          explodedFactor: 0,
        });
        const comps = bd.components;
        const isWall = mod.position.y >= 1100 || mod.category === "kitchen_wall";

        const doors = comps.filter(
          (c) => c.role === "door_left" || c.role === "door_right" || c.role === "drawer_front"
        );
        const golas = comps.filter((c) => c.role === "gola_profile");
        const brackets = comps.filter((c) => c.id.includes("_gola_fixing_bracket_"));
        const mechs = comps.filter(
          (c) =>
            (c.role === "special_fitting" || c.id.includes("_aventos_mech_")) &&
            !c.id.includes("_gola_fixing_bracket_")
        );

        let doorMaxY = -Infinity;
        let doorMinY = Infinity;
        let doorMinZ = Infinity;
        let doorMaxZ = -Infinity;
        for (const d of doors) {
          const b = componentBounds(d);
          if (b.max.y > doorMaxY) doorMaxY = b.max.y;
          if (b.min.y < doorMinY) doorMinY = b.min.y;
          if (b.min.z < doorMinZ) doorMinZ = b.min.z;
          if (b.max.z > doorMaxZ) doorMaxZ = b.max.z;
        }

        let golaMinZ = Infinity;
        let golaMaxZ = -Infinity;
        for (const g of golas) {
          const b = componentBounds(g);
          if (b.min.z < golaMinZ) golaMinZ = b.min.z;
          if (b.max.z > golaMaxZ) golaMaxZ = b.max.z;
        }

        let maxMechZ = -Infinity;
        for (const m of mechs) {
          const b = componentBounds(m);
          if (b.max.z > maxMechZ) maxMechZ = b.max.z;
        }

        const protrusionMm =
          doorOpenDeg < 2 && drawerOpenMm < 2 && Number.isFinite(maxMechZ)
            ? Math.max(0, Math.round(maxMechZ - mod.dimensions.depth))
            : 0;

        const doorGapTopMm =
          !isWall && Number.isFinite(doorMaxY)
            ? Math.round(mod.dimensions.height - doorMaxY)
            : isWall && Number.isFinite(doorMinY) && doorMinY < 0
            ? Math.round(Math.abs(doorMinY))
            : null;

        return {
          mod,
          components: comps,
          isWall,
          doorGapTopMm,
          golaZRange:
            golas.length > 0 ? [Math.round(golaMinZ), Math.round(golaMaxZ)] : null,
          bracketCount: brackets.length,
          doorZRange:
            doors.length > 0 ? [Math.round(doorMinZ), Math.round(doorMaxZ)] : null,
          protrusionMm,
        };
      });
    }, [isOpen, doorOpenDeg, drawerOpenMm]);

    if (!isOpen) return null;

    const triggerShowcase = (mode: DoorShowcaseMode) => {
      onClose();
      if (typeof window !== "undefined") {
        window.setTimeout(() => {
          React.startTransition(() => {
            onLoad3DShowcase(mode);
          });
        }, 24);
      } else {
        onLoad3DShowcase(mode);
      }
    };

    return (
      <div
        data-testid="v11-door-showcase-modal"
        className="fixed inset-0 z-[155] bg-[#141413]/55 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-6xl max-h-[92vh] flex flex-col birim-ice-modal rounded-[28px] overflow-hidden text-[#141413]"
        >
          <div className="px-6 py-4 birim-ice-shell-header flex items-center justify-between shrink-0 gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-9 h-9 rounded-2xl bg-[#141413] text-[#D6C7B2] flex items-center justify-center shrink-0">
                <Layers className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-bold truncate">
                  Canlı Geometrik Kesit Müfettişi (Standart vs Gerçek 1:1 Motor Çıktısı)
                </h2>
                <p className="text-xs text-[#78716C]">
                  Solda DIN / KBB referans kesiti, sağda <code className="font-mono">generateModuleGeometry()</code> gerçek profil &amp; sabitleyici klips konturları
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-[#EFECE4] flex items-center justify-center cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-6 py-3 bg-[#F6F2EA] border-b border-[#E6E0D4] flex flex-wrap items-center justify-between gap-2.5 shrink-0">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setZoomGripZone((v) => !v)}
                className={`h-8 px-3 rounded-full text-[11px] font-bold inline-flex items-center gap-1.5 border transition cursor-pointer ${
                  zoomGripZone
                    ? "bg-[#141413] text-white border-[#141413]"
                    : "bg-white text-[#141413] border-[#DFD3BC]"
                }`}
              >
                <ZoomIn className="w-3.5 h-3.5" />
                <span>{zoomGripZone ? "Yakın Çekim" : "Tam Kesit"}</span>
              </button>

              <div className="flex items-center gap-1.5 px-2.5 h-8 rounded-full bg-white border border-[#DFD3BC] text-[11px]">
                <span className="font-semibold text-[#57534E]">Kapak:</span>
                <input
                  type="range"
                  min={0}
                  max={85}
                  step={5}
                  value={doorOpenDeg}
                  onChange={(e) => setDoorOpenDeg(Number(e.target.value))}
                  className="w-20 accent-[#141413] cursor-pointer"
                />
                <span className="font-mono font-bold w-7 text-right">{doorOpenDeg}°</span>
              </div>

              <div className="flex items-center gap-1.5 px-2.5 h-8 rounded-full bg-white border border-[#DFD3BC] text-[11px]">
                <span className="font-semibold text-[#57534E]">Çekmece:</span>
                <input
                  type="range"
                  min={0}
                  max={300}
                  step={15}
                  value={drawerOpenMm}
                  onChange={(e) => setDrawerOpenMm(Number(e.target.value))}
                  className="w-20 accent-[#141413] cursor-pointer"
                />
                <span className="font-mono font-bold w-11 text-right">{drawerOpenMm}mm</span>
              </div>

              <div className="hidden xl:flex items-center gap-2 text-[10px] font-semibold text-[#57534E] pl-1">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#CBD5E1] border border-[#0F172A]" /> Kapak
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#F59E0B] border border-[#92400E]" /> Gola
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#64748B] border border-[#1E293B]" /> Sabitleyici Klips
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#D6B88D] border border-[#78350F]" /> Ahşap Kutu
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => triggerShowcase("kitchen_opening_systems")}
                className="h-8 px-3 rounded-full bg-[#141413] hover:bg-[#292524] text-white text-[11px] font-semibold inline-flex items-center gap-1.5 transition cursor-pointer"
              >
                <span>3B Sahneye Diz (15 Sistem)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => triggerShowcase("door_profiles")}
                className="h-8 px-3 rounded-full bg-white hover:bg-[#FAF7F0] border border-[#DFD3BC] text-[#141413] text-[11px] font-semibold transition cursor-pointer"
              >
                Kapak Modelleri (9)
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
              {sectionCards.map((card) => {
                const doorCfg = card.mod.bays[0]?.door;
                const profId = doorCfg?.handleProfileId || "hnd_bar_160";
                const hCat = String(doorCfg?.handleCategory || "bar_handle");
                const refMeta = getHandleCrossSectionMeta(profId, hCat, card.mod.name);
                return (
                  <div
                    key={card.mod.id}
                    className="p-3 rounded-2xl bg-white border border-[#E5DFD3] flex flex-col gap-2 shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[12px] font-bold text-[#141413] leading-snug">
                          {card.mod.name}
                        </div>
                        <div className="text-[10px] font-mono text-[#78716C]">
                          {card.mod.dimensions.width}×{card.mod.dimensions.height}×{card.mod.dimensions.depth} mm • {refMeta.specLine}
                        </div>
                      </div>
                      {card.protrusionMm > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 text-[9.5px] font-bold inline-flex items-center gap-1 shrink-0">
                          <AlertTriangle className="w-3 h-3" /> +{card.protrusionMm}mm Taşma
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[9.5px] font-bold inline-flex items-center gap-1 shrink-0">
                          <CheckCircle2 className="w-3 h-3" /> Temiz
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-[136px_1fr] gap-2 items-stretch">
                      <div className="rounded-xl bg-[#F8F5EE] border border-[#E5DFD3] p-2 flex flex-col items-center justify-between">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[#8C6D46] text-center">
                          Olması Gereken
                        </span>
                        <HandleCrossSectionSvg
                          profileId={profId}
                          category={hCat}
                          size="lg"
                        />
                        <span className="text-[8.5px] text-[#57534E] text-center leading-tight">
                          {refMeta.surfaceNote}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1 min-w-0">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-[#0F172A] px-1">
                          Sistemin Gerçek 1:1 Çizimi
                        </div>
                        <RealGeometricYZSection
                          data={card}
                          zoomGripZone={zoomGripZone}
                          doorOpenDeg={doorOpenDeg}
                          drawerOpenMm={drawerOpenMm}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 text-[9.5px] font-mono bg-[#FAF8F4] px-2 py-1.5 rounded-lg border border-[#EFEAE0] text-[#44403C]">
                      <div>
                        <span className="text-[#78716C]">
                          {card.isWall ? "Alt Sarkma: " : "Üst Boşluk: "}
                        </span>
                        <strong>
                          {card.doorGapTopMm !== null
                            ? `${card.doorGapTopMm} mm`
                            : card.isWall
                            ? "0 mm (Hemzemin)"
                            : "—"}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[#78716C]">Kapak/Çekmece Z: </span>
                        <strong>
                          {card.doorZRange ? `${card.doorZRange[0]}..${card.doorZRange[1]}` : "—"}
                        </strong>
                      </div>
                      <div className="col-span-2">
                        <span className="text-[#78716C]">Gola Kanal Z (Sabit): </span>
                        <strong>
                          {card.golaZRange
                            ? `${card.golaZRange[0]}..${card.golaZRange[1]} mm${
                                card.bracketCount > 0
                                  ? ` • ${card.bracketCount} Sabitleyici Klips`
                                  : " • Gövdeye Sabit"
                              }`
                            : "Ek Gövde Profili Yok (Kapak Üzerinde)"}
                        </strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }
);

DoorSystemsShowcaseModal.displayName = "DoorSystemsShowcaseModal";
