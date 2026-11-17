"use client";

import React, { useState, useMemo, useRef } from "react";
import {
  calculateBayWidths,
  computeProjectGrainNeighborMap,
  evaluateUnifiedEngineeringModel,
  type DesignProject,
  type GrainPartNeighborInfo,
  type ModuleInstance,
} from "@birim/core";
import {
  computeProjectCartonization,
  exportCartonManifestCsv,
  generateAssemblyInstructions,
  type ManufacturingBOM,
} from "@birim/manufacturing";
import { BirimLogo, V3PremiumDropdown } from "../../design-system";
import { startZeroLagModalDrag } from "../../design-system/zeroLagDrag";
import { Printer, Download, CheckCircle2, X, Layers, Wrench } from "lucide-react";

type IsoShapeVariant =
  | "box"
  | "stadium_slab"
  | "curved_kerf_left"
  | "curved_kerf_right"
  | "tambour_curtain_left"
  | "tambour_curtain_right"
  | "tambour_curtain_vertical"
  | "pedestal_cylinder"
  | "pedestal_disc";

interface IsoBoxSpec {
  id: string;
  code: string;
  x0: number;
  y0: number;
  z0: number;
  x1: number;
  y1: number;
  z1: number;
  frontFill: string;
  sideFill: string;
  topFill: string;
  stroke: string;
  strokeWidth?: number;
  opacity?: number;
  kind?: "carcass" | "back" | "plinth" | "shelf" | "drawer" | "door" | "rail" | "tray";
  shapeVariant?: IsoShapeVariant;
  cornerRadiusMm?: number;
  hasTambourTrackGroove?: boolean;
  slatCount?: number;
  hingeSide?: "left" | "right" | "none";
  handlePos?: "left" | "right" | "bottom-center" | "tambour-recessed" | "none";
  hasSys32?: boolean;
  grainLookupKeys?: string[];
}

function projectIsoPoint(x: number, y: number, z: number): { u: number; v: number } {
  return {
    u: x - z * 0.42,
    v: -y + z * 0.24,
  };
}

function computeModuleBayRanges(mod: ModuleInstance): Array<{ x0: number; x1: number; width: number }> {
  const T = mod.carcass.panelThickness || 18;
  const hull = mod.carcass.hullShape || "rectangular";
  if (hull === "capsule_stadium" || hull === "rounded_corners") {
    const W = mod.dimensions.width;
    const D = mod.dimensions.depth;
    const R =
      hull === "capsule_stadium"
        ? D / 2
        : Math.max(65, Math.min(mod.carcass.cornerRadiusMm || 100, D / 2 - 10, W / 4));
    const straightX0 = Math.max(T, R);
    const straightSpan = Math.max(180, W - 2 * straightX0);
    const bayCount = Math.max(1, mod.bays.length);
    const innerSpan = Math.max(120, straightSpan - (bayCount - 1) * T);
    const perBay = innerSpan / bayCount;
    const ranges: Array<{ x0: number; x1: number; width: number }> = [];
    let cursorX = straightX0;
    for (let i = 0; i < bayCount; i++) {
      ranges.push({ x0: cursorX, x1: cursorX + perBay, width: perBay });
      cursorX += perBay + T;
    }
    return ranges;
  }

  const canonicalWidths = calculateBayWidths(mod);
  const ranges: Array<{ x0: number; x1: number; width: number }> = [];
  let cursorX = T;
  for (let i = 0; i < mod.bays.length; i++) {
    const bw = canonicalWidths[i] ?? Math.max(80, mod.dimensions.width - 2 * T);
    ranges.push({ x0: cursorX, x1: cursorX + bw, width: bw });
    cursorX += bw + T;
  }
  return ranges;
}

function sampleRoundedRectLoopXZ(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  rawRadius: number,
  segsPerCorner = 6
): Array<{ x: number; z: number }> {
  const w = Math.max(10, x1 - x0);
  const d = Math.max(10, z1 - z0);
  const r = Math.max(2, Math.min(rawRadius, w / 2 - 0.5, d / 2 - 0.5));
  const pts: Array<{ x: number; z: number }> = [];
  const corners: Array<{ cx: number; cz: number; a0: number; a1: number }> = [
    { cx: x1 - r, cz: z1 - r, a0: 0, a1: Math.PI / 2 },
    { cx: x0 + r, cz: z1 - r, a0: Math.PI / 2, a1: Math.PI },
    { cx: x0 + r, cz: z0 + r, a0: Math.PI, a1: (3 * Math.PI) / 2 },
    { cx: x1 - r, cz: z0 + r, a0: (3 * Math.PI) / 2, a1: Math.PI * 2 },
  ];
  for (const c of corners) {
    for (let i = 0; i <= segsPerCorner; i++) {
      const t = c.a0 + ((c.a1 - c.a0) * i) / segsPerCorner;
      pts.push({
        x: c.cx + Math.cos(t) * r,
        z: c.cz + Math.sin(t) * r,
      });
    }
  }
  return pts;
}

function isTambourDoor(door: ModuleInstance["bays"][number]["door"]): boolean {
  if (!door) return false;
  return (
    String(door.type) === "tambour" ||
    door.doorSystemId === "tambour_roller" ||
    door.doorSystemId === "tambour"
  );
}

function buildExplodedIsoBoxes(
  mod: ModuleInstance,
  isWallCab: boolean,
  topStretcherMode: boolean
): {
  boxes: IsoBoxSpec[];
  explodeX: number;
  explodeY: number;
  explodeZ: number;
  explodeDrawerZ: number;
  explodeDoorZ: number;
  bayRanges: Array<{ x0: number; x1: number; width: number }>;
} {
  const W = mod.dimensions.width;
  const H = mod.dimensions.height;
  const D = mod.dimensions.depth;
  const T = mod.carcass.panelThickness || 18;
  const backT = mod.carcass.backPanelThickness || 8;
  const hull = mod.carcass.hullShape || "rectangular";
  const plinthH = isWallCab ? 0 : mod.carcass.plinthHeight ?? 80;

  const explodeX = Math.max(380, Math.round(W * 0.3));
  const explodeY = Math.max(190, Math.round(H * 0.16));
  const explodeZ = Math.max(300, Math.round(D * 0.68));
  const explodeDrawerZ = Math.max(340, Math.round(D * 0.78));
  const explodeDoorZ = Math.max(540, Math.round(D * 1.18));

  const bayRanges = computeModuleBayRanges(mod);
  const boxes: IsoBoxSpec[] = [];

  // =========================================================================
  // 1. CAPSULE DINING / CONFERENCE TABLE (`capsule_table`)
  // =========================================================================
  if (hull === "capsule_table") {
    const topThick = Math.max(25, Math.min(42, mod.carcass.countertopThicknessMm || 30));
    const colH = Math.max(420, H - topThick);
    const colD = Math.min(Math.round(D * 0.46), 420);
    const colR = colD / 2;
    const colOffset = Math.max(colR + 80, Math.round(W * 0.24));
    const leftCx = colOffset;
    const rightCx = W - colOffset;
    const stadiumR = D / 2;

    // ⑦ Leveling glides & bottom base rings (exploded down)
    for (const [idx, cx] of [leftCx, rightCx].entries()) {
      boxes.push({
        id: `table-disc-bot-${idx}`,
        code: "⑦",
        x0: cx - colR + (idx === 0 ? -explodeX * 0.45 : explodeX * 0.45),
        y0: -explodeY * 0.7,
        z0: D / 2 - colR,
        x1: cx + colR + (idx === 0 ? -explodeX * 0.45 : explodeX * 0.45),
        y1: T - explodeY * 0.7,
        z1: D / 2 + colR,
        frontFill: "#64748B",
        sideFill: "#475569",
        topFill: "#94A3B8",
        stroke: "#1E293B",
        strokeWidth: 1.4,
        kind: "plinth",
        shapeVariant: "pedestal_disc",
        cornerRadiusMm: colR,
      });
    }

    // ① & ② Cylindrical fluted kerf pedestal columns (exploded left/right)
    boxes.push({
      id: "table-pedestal-left",
      code: "①",
      x0: leftCx - colR - explodeX * 0.45,
      y0: T,
      z0: D / 2 - colR,
      x1: leftCx + colR - explodeX * 0.45,
      y1: colH,
      z1: D / 2 + colR,
      frontFill: "#C79D6E",
      sideFill: "#AD8254",
      topFill: "#DEC09B",
      stroke: "#44403C",
      strokeWidth: 1.6,
      kind: "carcass",
      shapeVariant: "pedestal_cylinder",
      cornerRadiusMm: colR,
      slatCount: 12,
    });

    boxes.push({
      id: "table-pedestal-right",
      code: "②",
      x0: rightCx - colR + explodeX * 0.45,
      y0: T,
      z0: D / 2 - colR,
      x1: rightCx + colR + explodeX * 0.45,
      y1: colH,
      z1: D / 2 + colR,
      frontFill: "#C79D6E",
      sideFill: "#AD8254",
      topFill: "#DEC09B",
      stroke: "#44403C",
      strokeWidth: 1.6,
      kind: "carcass",
      shapeVariant: "pedestal_cylinder",
      cornerRadiusMm: colR,
      slatCount: 12,
    });

    // ③ Upper internal CNC form & M8 steel flange discs
    for (const [idx, cx] of [leftCx, rightCx].entries()) {
      boxes.push({
        id: `table-disc-top-${idx}`,
        code: "③",
        x0: cx - colR,
        y0: colH + explodeY * 0.35,
        z0: D / 2 - colR,
        x1: cx + colR,
        y1: colH + T + explodeY * 0.35,
        z1: D / 2 + colR,
        frontFill: "#CBD5E1",
        sideFill: "#94A3B8",
        topFill: "#E2E8F0",
        stroke: "#334155",
        strokeWidth: 1.4,
        kind: "carcass",
        shapeVariant: "pedestal_disc",
        cornerRadiusMm: colR,
      });
    }

    // ⑤ Central steel anti-sag apron bar (40x20x2mm)
    const apronSpanX0 = Math.min(leftCx + colR * 0.3, W * 0.32);
    const apronSpanX1 = Math.max(rightCx - colR * 0.3, W * 0.68);
    boxes.push({
      id: "table-steel-apron",
      code: "⑤",
      x0: apronSpanX0,
      y0: colH + explodeY * 0.52,
      z0: D / 2 - 28,
      x1: apronSpanX1,
      y1: colH + 32 + explodeY * 0.52,
      z1: D / 2 + 28,
      frontFill: "#334155",
      sideFill: "#1E293B",
      topFill: "#475569",
      stroke: "#0F172A",
      strokeWidth: 1.5,
      kind: "rail",
    });

    // ④ 5-Axis Swiss-Edge Capsule Tabletop (exploded up)
    boxes.push({
      id: "table-stadium-top",
      code: "④",
      x0: 0,
      y0: H - topThick + explodeY * 1.15,
      z0: 0,
      x1: W,
      y1: H + explodeY * 1.15,
      z1: D,
      frontFill: "#D8B892",
      sideFill: "#B99164",
      topFill: "#EAD1B2",
      stroke: "#44403C",
      strokeWidth: 1.8,
      kind: "carcass",
      shapeVariant: "stadium_slab",
      cornerRadiusMm: stadiumR,
    });

    boxes.sort((a, b) => {
      const da = ((a.z0 + a.z1) / 2) * 1.0 + ((a.y0 + a.y1) / 2) * 0.35 + ((a.x0 + a.x1) / 2) * 0.12;
      const db = ((b.z0 + b.z1) / 2) * 1.0 + ((b.y0 + b.y1) / 2) * 0.35 + ((b.x0 + b.x1) / 2) * 0.12;
      return da - db;
    });

    return { boxes, explodeX, explodeY, explodeZ, explodeDrawerZ, explodeDoorZ, bayRanges };
  }

  // =========================================================================
  // 2. CAPSULE STADIUM & R-CORNER TAMBOUR CABINET / TV UNIT
  // =========================================================================
  if (hull === "capsule_stadium" || hull === "rounded_corners") {
    const cornerR =
      hull === "capsule_stadium"
        ? D / 2
        : Math.max(65, Math.min(mod.carcass.cornerRadiusMm || 100, D / 2 - 10, W / 4));
    const hasTray = mod.carcass.hasCountertopTray !== false && Boolean(mod.carcass.countertopMaterialId || hull === "capsule_stadium");
    const trayT = hasTray ? 20 : 0;
    const carcassTopY = H - trayT;
    const pocketCorridorMm = 32;
    const innerR = Math.max(40, cornerR - pocketCorridorMm);
    const straightX0 = cornerR;
    const straightX1 = Math.max(straightX0 + 80, W - cornerR);

    // ⑥ Center Straight Back Panel with Cable Port (exploded rear)
    boxes.push({
      id: "capsule-back-panel",
      code: "⑥",
      x0: straightX0 + 6,
      y0: plinthH + T + 30,
      z0: -explodeZ * 0.85,
      x1: straightX1 - 6,
      y1: carcassTopY - T + 30,
      z1: -explodeZ * 0.85 + backT,
      frontFill: "#E2DDD3",
      sideFill: "#CBD5E1",
      topFill: "#EDE9E0",
      stroke: "#475569",
      strokeWidth: 1.4,
      kind: "back",
    });

    // ⑦ Turned Solid Metal/Wood Legs or Plinth Frame (exploded down)
    if (!isWallCab && plinthH > 0) {
      const legR = 22;
      const legPositions = [
        [Math.max(cornerR * 0.75, 95), 75],
        [Math.max(cornerR * 0.75, 95), D - 75],
        [Math.min(W - cornerR * 0.75, W - 95), 75],
        [Math.min(W - cornerR * 0.75, W - 95), D - 75],
      ];
      legPositions.forEach(([lx, lz], lIdx) => {
        boxes.push({
          id: `capsule-leg-${lIdx}`,
          code: "⑦",
          x0: lx - legR,
          y0: -explodeY * 0.85,
          z0: lz - legR,
          x1: lx + legR,
          y1: plinthH - explodeY * 0.85,
          z1: lz + legR,
          frontFill: "#475569",
          sideFill: "#334155",
          topFill: "#94A3B8",
          stroke: "#1E293B",
          strokeWidth: 1.3,
          kind: "plinth",
          shapeVariant: "pedestal_cylinder",
          cornerRadiusMm: legR,
        });
      });
    }

    // ③ Stadium / R-Corner Bottom Slab with 8.5x7.5mm CNC Tambour Track Groove
    boxes.push({
      id: "capsule-bottom-slab",
      code: "③",
      x0: 0,
      y0: plinthH,
      z0: 0,
      x1: W,
      y1: plinthH + T,
      z1: D,
      frontFill: "#D8B892",
      sideFill: "#C39B6E",
      topFill: "#E8D0B1",
      stroke: "#57534E",
      strokeWidth: 1.7,
      kind: "carcass",
      shapeVariant: "stadium_slab",
      cornerRadiusMm: cornerR,
      hasTambourTrackGroove: true,
    });

    // ① & ② Left and Right Curved CNC Kerf Inner Pocket Shells (exploded left & right)
    boxes.push({
      id: "capsule-kerf-left",
      code: "①",
      x0: pocketCorridorMm - explodeX * 0.72,
      y0: plinthH + T,
      z0: pocketCorridorMm,
      x1: cornerR + T - explodeX * 0.72,
      y1: carcassTopY - T,
      z1: D - pocketCorridorMm,
      frontFill: "#DFC3A0",
      sideFill: "#C7A379",
      topFill: "#EAD2B3",
      stroke: "#57534E",
      strokeWidth: 1.5,
      kind: "carcass",
      shapeVariant: "curved_kerf_left",
      cornerRadiusMm: innerR,
      slatCount: 9,
    });

    boxes.push({
      id: "capsule-kerf-right",
      code: "②",
      x0: W - cornerR - T + explodeX * 0.72,
      y0: plinthH + T,
      z0: pocketCorridorMm,
      x1: W - pocketCorridorMm + explodeX * 0.72,
      y1: carcassTopY - T,
      z1: D - pocketCorridorMm,
      frontFill: "#DFC3A0",
      sideFill: "#C7A379",
      topFill: "#EAD2B3",
      stroke: "#57534E",
      strokeWidth: 1.5,
      kind: "carcass",
      shapeVariant: "curved_kerf_right",
      cornerRadiusMm: innerR,
      slatCount: 9,
    });

    // ⑤ Inner Structural Cheek Bulkheads + Bay Dividers
    const structuralXs = [straightX0, straightX1 - T];
    for (let i = 0; i < bayRanges.length - 1; i++) {
      structuralXs.push(bayRanges[i].x1);
    }
    structuralXs.forEach((dx, idx) => {
      boxes.push({
        id: `capsule-divider-${idx}`,
        code: "⑤",
        x0: dx,
        y0: plinthH + T,
        z0: pocketCorridorMm + 8,
        x1: dx + T,
        y1: carcassTopY - T,
        z1: D - pocketCorridorMm - 8,
        frontFill: "#DFC4A2",
        sideFill: "#C9A67D",
        topFill: "#EAD2B3",
        stroke: "#57534E",
        strokeWidth: 1.35,
        kind: "carcass",
        hasSys32: idx === 0,
      });
    });

    // ⑧ Bay Shelves & ⑨ Media / Interior Drawers
    const innerBottomY = plinthH + T;
    const innerTopY = carcassTopY - T;
    mod.bays.forEach((bay, bIdx) => {
      const range = bayRanges[bIdx];
      if (!range) return;

      (bay.shelves || []).forEach((shelf, sIdx) => {
        if (shelf.isHidden) return;
        const shT = shelf.thickness || T;
        const sy = Math.min(innerTopY - shT, Math.max(innerBottomY + 24, innerBottomY + shelf.elevationY));
        boxes.push({
          id: `capsule-shelf-${bIdx}-${sIdx}`,
          code: "⑧",
          x0: range.x0 + 3,
          y0: sy,
          z0: pocketCorridorMm + 12,
          x1: range.x1 - 3,
          y1: sy + shT,
          z1: D - pocketCorridorMm - 14,
          frontFill: shelf.isGlass ? "#BAE6FD" : "#EFE6D8",
          sideFill: shelf.isGlass ? "#7DD3FC" : "#DDD0BE",
          topFill: shelf.isGlass ? "#E0F2FE" : "#F5EFE6",
          stroke: "#64748B",
          strokeWidth: 1.1,
          opacity: shelf.isGlass ? 0.7 : 0.96,
          kind: "shelf",
        });
      });

      (bay.drawers || [])
        .filter((d) => !d.isHidden)
        .forEach((drw, dIdx) => {
          const dh = Math.max(90, drw.height || 160);
          const dy0 = innerBottomY + drw.elevationY;
          const dy1 = Math.min(innerTopY - 8, dy0 + dh);
          const zShift = explodeDrawerZ * 0.78 + dIdx * 20;
          boxes.push({
            id: `capsule-drawer-box-${bIdx}-${dIdx}`,
            code: "⑨",
            x0: range.x0 + 6,
            y0: dy0 + 6,
            z0: D * 0.35 + zShift,
            x1: range.x1 - 6,
            y1: dy1 - 10,
            z1: D - 24 + zShift,
            frontFill: "#FDBA74",
            sideFill: "#FB923C",
            topFill: "#FDE68A",
            stroke: "#9A3412",
            strokeWidth: 1.2,
            kind: "drawer",
          });
          boxes.push({
            id: `capsule-drawer-front-${bIdx}-${dIdx}`,
            code: "⑨",
            x0: range.x0,
            y0: dy0 + 2,
            z0: D - 22 + zShift,
            x1: range.x1,
            y1: dy1 - 2,
            z1: D - 4 + zShift,
            frontFill: "#D6AE7E",
            sideFill: "#B88C5A",
            topFill: "#E8C99E",
            stroke: "#292524",
            strokeWidth: 1.4,
            kind: "drawer",
            handlePos: "bottom-center",
            grainLookupKeys: [`${drw.id}_front`],
          });
        });
    });

    // ⑩ Left & Right Curved Acoustic-Felt Backed Tambour Slat Curtains (exploded forward-left & forward-right)
    if (!mod.isOpenFront) {
      const leftDoorRef = mod.bays[0]?.door;
      const rightDoorRef = mod.bays[mod.bays.length - 1]?.door;
      const curtainEndLeftX =
        mod.bays.length >= 3 && mod.bays[1]?.door?.type === "open"
          ? bayRanges[0]?.x1 ?? W * 0.35
          : W * 0.49;
      const curtainStartRightX =
        mod.bays.length >= 3 && mod.bays[1]?.door?.type === "open"
          ? bayRanges[bayRanges.length - 1]?.x0 ?? W * 0.65
          : W * 0.51;

      boxes.push({
        id: "tambour-curtain-left",
        code: "⑩",
        x0: 8 - explodeX * 0.24,
        y0: plinthH + T + 2,
        z0: D * 0.44 + explodeDoorZ * 0.68,
        x1: curtainEndLeftX - explodeX * 0.24,
        y1: carcassTopY - T - 2,
        z1: D - 8 + explodeDoorZ * 0.68,
        frontFill: "#CFA372",
        sideFill: "#B58654",
        topFill: "#E5C399",
        stroke: "#292524",
        strokeWidth: 1.55,
        opacity: 0.92,
        kind: "door",
        shapeVariant: "tambour_curtain_left",
        cornerRadiusMm: Math.max(55, cornerR - 10),
        slatCount: 16,
        hingeSide: "none",
        handlePos: "tambour-recessed",
        grainLookupKeys: leftDoorRef ? [leftDoorRef.id, `${leftDoorRef.id}_left`] : undefined,
      });

      boxes.push({
        id: "tambour-curtain-right",
        code: "⑩",
        x0: curtainStartRightX + explodeX * 0.24,
        y0: plinthH + T + 2,
        z0: D * 0.44 + explodeDoorZ * 0.68,
        x1: W - 8 + explodeX * 0.24,
        y1: carcassTopY - T - 2,
        z1: D - 8 + explodeDoorZ * 0.68,
        frontFill: "#CFA372",
        sideFill: "#B58654",
        topFill: "#E5C399",
        stroke: "#292524",
        strokeWidth: 1.55,
        opacity: 0.92,
        kind: "door",
        shapeVariant: "tambour_curtain_right",
        cornerRadiusMm: Math.max(55, cornerR - 10),
        slatCount: 16,
        hingeSide: "none",
        handlePos: "tambour-recessed",
        grainLookupKeys: rightDoorRef ? [rightDoorRef.id, `${rightDoorRef.id}_right`] : undefined,
      });
    }

    // ④ Stadium / R-Corner Top Slab with Matching 8.5x7.5mm CNC Tambour Track Groove (exploded up)
    boxes.push({
      id: "capsule-top-slab",
      code: "④",
      x0: 0,
      y0: carcassTopY - T + explodeY * 0.95,
      z0: 0,
      x1: W,
      y1: carcassTopY + explodeY * 0.95,
      z1: D,
      frontFill: "#D8B892",
      sideFill: "#C39B6E",
      topFill: "#EAD2B3",
      stroke: "#57534E",
      strokeWidth: 1.7,
      kind: "carcass",
      shapeVariant: "stadium_slab",
      cornerRadiusMm: cornerR,
      hasTambourTrackGroove: true,
    });

    // ⑪ Recessed 20mm Marble / Quartz Countertop Tray (exploded further up)
    if (hasTray) {
      boxes.push({
        id: "capsule-marble-tray",
        code: "⑪",
        x0: 14,
        y0: carcassTopY + explodeY * 1.62,
        z0: 14,
        x1: W - 14,
        y1: carcassTopY + trayT + explodeY * 1.62,
        z1: D - 14,
        frontFill: "#EDEBE6",
        sideFill: "#D6D3CD",
        topFill: "#FAF9F6",
        stroke: "#64748B",
        strokeWidth: 1.5,
        kind: "tray",
        shapeVariant: "stadium_slab",
        cornerRadiusMm: Math.max(45, cornerR - 14),
      });
    }

    boxes.sort((a, b) => {
      const da = ((a.z0 + a.z1) / 2) * 1.0 + ((a.y0 + a.y1) / 2) * 0.25 + ((a.x0 + a.x1) / 2) * 0.18;
      const db = ((b.z0 + b.z1) / 2) * 1.0 + ((b.y0 + b.y1) / 2) * 0.25 + ((b.x0 + b.x1) / 2) * 0.18;
      return da - db;
    });

    return { boxes, explodeX, explodeY, explodeZ, explodeDrawerZ, explodeDoorZ, bayRanges };
  }

  // =========================================================================
  // 3. STANDARD RECTANGULAR CABINET (WITH HINGED, SLIDING, LIFT OR TAMBOUR DOORS)
  // =========================================================================
  // ⑥ Back panel (exploded rear + slightly up)
  boxes.push({
    id: "back-panel",
    code: "⑥",
    x0: T - 6,
    y0: plinthH + T - 6 + 90,
    z0: -explodeZ,
    x1: W - T + 6,
    y1: H - T + 6 + 90,
    z1: -explodeZ + backT,
    frontFill: "#E2DDD3",
    sideFill: "#CBD5E1",
    topFill: "#EDE9E0",
    stroke: "#475569",
    strokeWidth: 1.4,
    kind: "back",
  });

  // ⑦ Plinth (exploded down)
  if (!isWallCab && plinthH > 0) {
    boxes.push({
      id: "plinth-base",
      code: "⑦",
      x0: 18,
      y0: -explodeY,
      z0: 36,
      x1: W - 18,
      y1: plinthH - explodeY,
      z1: D - 24,
      frontFill: "#CBD5E1",
      sideFill: "#94A3B8",
      topFill: "#E2E8F0",
      stroke: "#334155",
      strokeWidth: 1.5,
      opacity: 0.9,
      kind: "plinth",
    });
  }

  // ① Left side panel (exploded left)
  boxes.push({
    id: "left-side",
    code: "①",
    x0: -explodeX,
    y0: plinthH,
    z0: 0,
    x1: T - explodeX,
    y1: H,
    z1: D,
    frontFill: "#D8B892",
    sideFill: "#C7A379",
    topFill: "#E5CBA8",
    stroke: "#57534E",
    strokeWidth: 1.6,
    kind: "carcass",
    hasSys32: true,
  });

  // ② Right side panel (exploded right)
  boxes.push({
    id: "right-side",
    code: "②",
    x0: W - T + explodeX,
    y0: plinthH,
    z0: 0,
    x1: W + explodeX,
    y1: H,
    z1: D,
    frontFill: "#D8B892",
    sideFill: "#C7A379",
    topFill: "#E5CBA8",
    stroke: "#57534E",
    strokeWidth: 1.6,
    kind: "carcass",
  });

  // ③ Bottom panel
  boxes.push({
    id: "bottom-panel",
    code: "③",
    x0: T,
    y0: plinthH,
    z0: 0,
    x1: W - T,
    y1: plinthH + T,
    z1: D,
    frontFill: "#D8B892",
    sideFill: "#C7A379",
    topFill: "#E7CFAF",
    stroke: "#57534E",
    strokeWidth: 1.6,
    kind: "carcass",
  });

  // ④ Top panel or 90mm stretchers (exploded up)
  if (topStretcherMode) {
    boxes.push({
      id: "top-stretcher-rear",
      code: "④",
      x0: T,
      y0: H - T + explodeY,
      z0: 0,
      x1: W - T,
      y1: H + explodeY,
      z1: 90,
      frontFill: "#DFC3A0",
      sideFill: "#C7A379",
      topFill: "#EAD2B3",
      stroke: "#57534E",
      strokeWidth: 1.5,
      kind: "carcass",
    });
    boxes.push({
      id: "top-stretcher-front",
      code: "④",
      x0: T,
      y0: H - T + explodeY,
      z0: D - 90,
      x1: W - T,
      y1: H + explodeY,
      z1: D,
      frontFill: "#DFC3A0",
      sideFill: "#C7A379",
      topFill: "#EAD2B3",
      stroke: "#57534E",
      strokeWidth: 1.5,
      kind: "carcass",
    });
  } else {
    boxes.push({
      id: "top-panel",
      code: "④",
      x0: T,
      y0: H - T + explodeY,
      z0: 0,
      x1: W - T,
      y1: H + explodeY,
      z1: D,
      frontFill: "#D8B892",
      sideFill: "#C7A379",
      topFill: "#EAD2B3",
      stroke: "#57534E",
      strokeWidth: 1.6,
      kind: "carcass",
    });
  }

  // ⑤ Vertical dividers between bays
  for (let i = 0; i < bayRanges.length - 1; i++) {
    const divX = bayRanges[i].x1;
    boxes.push({
      id: `divider-${i}`,
      code: "⑤",
      x0: divX,
      y0: plinthH + T,
      z0: 18,
      x1: divX + T,
      y1: H - T,
      z1: D - 18,
      frontFill: "#DFC4A2",
      sideFill: "#C9A67D",
      topFill: "#EAD2B3",
      stroke: "#57534E",
      strokeWidth: 1.4,
      kind: "carcass",
    });
  }

  // Bay interiors + doors
  const innerBottomY = plinthH + T;
  const innerTopY = H - T;

  mod.bays.forEach((bay, bIdx) => {
    const range = bayRanges[bIdx];
    if (!range) return;

    // ⑧ Shelves
    (bay.shelves || []).forEach((shelf, sIdx) => {
      if (shelf.isHidden) return;
      const shT = shelf.thickness || T;
      const sy = Math.min(innerTopY - shT, Math.max(innerBottomY, innerBottomY + shelf.elevationY));
      boxes.push({
        id: `shelf-${bIdx}-${sIdx}`,
        code: "⑧",
        x0: range.x0 + 2,
        y0: sy,
        z0: 22,
        x1: range.x1 - 2,
        y1: sy + shT,
        z1: D - (shelf.frontSetbackMm ?? 16),
        frontFill: shelf.isGlass ? "#BAE6FD" : "#EFE6D8",
        sideFill: shelf.isGlass ? "#7DD3FC" : "#DDD0BE",
        topFill: shelf.isGlass ? "#E0F2FE" : "#F5EFE6",
        stroke: "#64748B",
        strokeWidth: 1.1,
        opacity: shelf.isGlass ? 0.65 : 0.96,
        kind: "shelf",
      });
    });

    // Hanging rails (tagged under ⑧)
    (bay.hangingRails || []).forEach((rail, rIdx) => {
      if (rail.isHidden) return;
      const ry = Math.min(innerTopY - 30, Math.max(innerBottomY + 20, innerBottomY + rail.elevationY));
      boxes.push({
        id: `rail-${bIdx}-${rIdx}`,
        code: "⑧",
        x0: range.x0 + 4,
        y0: ry,
        z0: D * 0.48,
        x1: range.x1 - 4,
        y1: ry + 26,
        z1: D * 0.48 + 16,
        frontFill: "#94A3B8",
        sideFill: "#64748B",
        topFill: "#CBD5E1",
        stroke: "#334155",
        strokeWidth: 1.1,
        kind: "rail",
      });
    });

    // ⑨ Drawers (exploded forward)
    let externalDrawerMaxTopY = 0;
    const visibleDrawers = (bay.drawers || []).filter((d) => !d.isHidden);
    visibleDrawers.forEach((drw, dIdx) => {
      const dh = Math.max(100, drw.height || 180);
      const dy0 = innerBottomY + drw.elevationY;
      const dy1 = Math.min(innerTopY, dy0 + dh);
      if (!drw.isInternal && dy1 > externalDrawerMaxTopY) {
        externalDrawerMaxTopY = dy1;
      }
      const zShift = drw.isInternal ? explodeDrawerZ * 0.72 : explodeDrawerZ + dIdx * 24;
      const boxDepth = Math.min(D - 40, 460);

      boxes.push({
        id: `drawer-box-${bIdx}-${dIdx}`,
        code: "⑨",
        x0: range.x0 + 8,
        y0: dy0 + 8,
        z0: D - boxDepth + zShift,
        x1: range.x1 - 8,
        y1: dy1 - 14,
        z1: D - 18 + zShift,
        frontFill: "#FDBA74",
        sideFill: "#FB923C",
        topFill: "#FDE68A",
        stroke: "#9A3412",
        strokeWidth: 1.2,
        kind: "drawer",
      });

      boxes.push({
        id: `drawer-front-${bIdx}-${dIdx}`,
        code: "⑨",
        x0: drw.isInternal ? range.x0 + 10 : range.x0 - (bIdx === 0 ? T - 2 : T / 2 - 1),
        y0: dy0 + 2,
        z0: D - 18 + zShift,
        x1: drw.isInternal ? range.x1 - 10 : range.x1 + (bIdx === mod.bays.length - 1 ? T - 2 : T / 2 - 1),
        y1: dy1 - 2,
        z1: D + zShift,
        frontFill: drw.isInternal ? "#FEF3C7" : "#D6AE7E",
        sideFill: "#B88C5A",
        topFill: "#E8C99E",
        stroke: drw.isInternal ? "#9A3412" : "#292524",
        strokeWidth: 1.4,
        kind: "drawer",
        handlePos: drw.isInternal ? "none" : "bottom-center",
        grainLookupKeys: drw.isInternal ? undefined : [`${drw.id}_front`],
      });
    });

    // ⑩ Doors (exploded furthest forward)
    const door = bay.door;
    if (!mod.isOpenFront && door && door.type !== "open" && door.doorSystemId !== "open") {
      const doorX0 = range.x0 - (bIdx === 0 ? T - 2 : T / 2 - 1);
      const doorX1 = range.x1 + (bIdx === mod.bays.length - 1 ? T - 2 : T / 2 - 1);
      const doorY0 = externalDrawerMaxTopY > innerBottomY ? externalDrawerMaxTopY + 3 : plinthH + 2;
      const doorY1 = H - 2;

      if (doorY1 - doorY0 > 80) {
        const dSysId = door.doorSystemId || "";
        const isTambour = isTambourDoor(door);
        const isBiFoldLift = door.type === "lift_bi_fold" || dSysId === "lift_bi_fold";
        const isSingleLift =
          !isBiFoldLift &&
          (String(door.type) === "flap_up" ||
            door.type === "lift_parallel" ||
            dSysId === "lift_up_stay" ||
            dSysId === "lift_parallel");
        const isDouble =
          door.type === "double" ||
          door.doorSystemId === "hinged_double" ||
          door.type === "sliding";

        if (isTambour) {
          // Upper roll-up tambour cassette valance + slatted vertical curtain (zero hinge cups!)
          const cassetteH = Math.min(115, Math.max(70, (doorY1 - doorY0) * 0.14));
          boxes.push({
            id: `tambour-valance-${bIdx}`,
            code: "⑩",
            x0: range.x0 + 2,
            y0: innerTopY - cassetteH,
            z0: D - 140 + explodeDoorZ * 0.48,
            x1: range.x1 - 2,
            y1: innerTopY - 2,
            z1: D - 10 + explodeDoorZ * 0.48,
            frontFill: "#94A3B8",
            sideFill: "#64748B",
            topFill: "#CBD5E1",
            stroke: "#334155",
            strokeWidth: 1.3,
            kind: "rail",
          });
          boxes.push({
            id: `door-tambour-${bIdx}`,
            code: "⑩",
            x0: range.x0 + 3,
            y0: Math.max(innerBottomY + 2, doorY0),
            z0: D - 14 + explodeDoorZ,
            x1: range.x1 - 3,
            y1: innerTopY - cassetteH,
            z1: D + explodeDoorZ,
            frontFill: "#D2A777",
            sideFill: "#B68856",
            topFill: "#E8C99E",
            stroke: "#1E293B",
            strokeWidth: 1.6,
            opacity: 0.88,
            kind: "door",
            shapeVariant: "tambour_curtain_vertical",
            slatCount: Math.max(10, Math.min(26, Math.round((innerTopY - cassetteH - doorY0) / 28))),
            hingeSide: "none",
            handlePos: "bottom-center",
            grainLookupKeys: [door.id, `${door.id}_tambour_curtain`],
          });
        } else if (isBiFoldLift) {
          const midY = (doorY0 + doorY1) / 2;
          boxes.push({
            id: `door-hf-bot-${bIdx}`,
            code: "⑩",
            x0: doorX0,
            y0: doorY0,
            z0: D - T + explodeDoorZ,
            x1: doorX1,
            y1: midY - 1,
            z1: D + explodeDoorZ,
            frontFill: "#D6AE7E",
            sideFill: "#B88C5A",
            topFill: "#E8C99E",
            stroke: "#1E293B",
            strokeWidth: 1.6,
            opacity: 0.78,
            kind: "door",
            hingeSide: "none",
            handlePos: "bottom-center",
            grainLookupKeys: [`${door.id}_lift_bifold_bot`, door.id],
          });
          boxes.push({
            id: `door-hf-top-${bIdx}`,
            code: "⑩",
            x0: doorX0,
            y0: midY + 1,
            z0: D - T + explodeDoorZ,
            x1: doorX1,
            y1: doorY1,
            z1: D + explodeDoorZ,
            frontFill: "#D6AE7E",
            sideFill: "#B88C5A",
            topFill: "#E8C99E",
            stroke: "#1E293B",
            strokeWidth: 1.6,
            opacity: 0.78,
            kind: "door",
            hingeSide: "none",
            handlePos: "none",
            grainLookupKeys: [`${door.id}_lift_bifold_top`, door.id],
          });
        } else if (isSingleLift) {
          boxes.push({
            id: `door-lift-${bIdx}`,
            code: "⑩",
            x0: doorX0,
            y0: doorY0,
            z0: D - T + explodeDoorZ,
            x1: doorX1,
            y1: doorY1,
            z1: D + explodeDoorZ,
            frontFill: "#D6AE7E",
            sideFill: "#B88C5A",
            topFill: "#E8C99E",
            stroke: "#1E293B",
            strokeWidth: 1.6,
            opacity: 0.78,
            kind: "door",
            hingeSide: "none",
            handlePos: "bottom-center",
            grainLookupKeys: [door.id, `${door.id}_lift_stay`, `${door.id}_lift_parallel`],
          });
        } else if (isDouble) {
          const midX = (doorX0 + doorX1) / 2;
          boxes.push({
            id: `door-l-${bIdx}`,
            code: "⑩",
            x0: doorX0,
            y0: doorY0,
            z0: D - T + explodeDoorZ,
            x1: midX - 2,
            y1: doorY1,
            z1: D + explodeDoorZ,
            frontFill: "#D6AE7E",
            sideFill: "#B88C5A",
            topFill: "#E8C99E",
            stroke: "#1E293B",
            strokeWidth: 1.6,
            opacity: 0.78,
            kind: "door",
            hingeSide: door.type === "sliding" ? "none" : "left",
            handlePos: "right",
            grainLookupKeys: [`${door.id}_leaf_left`, `${door.id}_left`],
          });
          boxes.push({
            id: `door-r-${bIdx}`,
            code: "⑩",
            x0: midX + 2,
            y0: doorY0,
            z0: D - T + explodeDoorZ + (door.type === "sliding" ? 28 : 0),
            x1: doorX1,
            y1: doorY1,
            z1: D + explodeDoorZ + (door.type === "sliding" ? 28 : 0),
            frontFill: "#D6AE7E",
            sideFill: "#B88C5A",
            topFill: "#E8C99E",
            stroke: "#1E293B",
            strokeWidth: 1.6,
            opacity: 0.78,
            kind: "door",
            hingeSide: door.type === "sliding" ? "none" : "right",
            handlePos: "left",
            grainLookupKeys: [`${door.id}_leaf_right`, `${door.id}_right`],
          });
        } else {
          const hingeRight = door.type === "single_right" || door.type === "inset_right";
          boxes.push({
            id: `door-s-${bIdx}`,
            code: "⑩",
            x0: doorX0,
            y0: doorY0,
            z0: D - T + explodeDoorZ,
            x1: doorX1,
            y1: doorY1,
            z1: D + explodeDoorZ,
            frontFill: "#D6AE7E",
            sideFill: "#B88C5A",
            topFill: "#E8C99E",
            stroke: "#1E293B",
            strokeWidth: 1.6,
            opacity: 0.78,
            kind: "door",
            hingeSide: hingeRight ? "right" : "left",
            handlePos: hingeRight ? "left" : "right",
            grainLookupKeys: [door.id, `${door.id}_left`, `${door.id}_right`],
          });
        }
      }
    }
  });

  // Painter's algorithm sort: back-left-bottom first, front-right-top last
  boxes.sort((a, b) => {
    const da = ((a.z0 + a.z1) / 2) * 1.0 + ((a.x0 + a.x1) / 2) * 0.35 + ((a.y0 + a.y1) / 2) * 0.12;
    const db = ((b.z0 + b.z1) / 2) * 1.0 + ((b.x0 + b.x1) / 2) * 0.35 + ((b.y0 + b.y1) / 2) * 0.12;
    return da - db;
  });

  return { boxes, explodeX, explodeY, explodeZ, explodeDrawerZ, explodeDoorZ, bayRanges };
}

interface AssemblyDiagramModalProps {
  isOpen: boolean;
  project: DesignProject;
  bom: ManufacturingBOM;
  activeModuleIndex: number;
  onClose: () => void;
}

export const AssemblyDiagramModal: React.FC<AssemblyDiagramModalProps> = ({
  isOpen,
  project,
  bom,
  activeModuleIndex,
  onClose,
}) => {
  const [selectedModIdx, setSelectedModIdx] = useState<number>(activeModuleIndex);
  const [activeStep, setActiveStep] = useState<number>(0);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const mainModules = useMemo(
    () => project.modules.filter((m) => m.category !== "complementary"),
    [project.modules]
  );

  const mod =
    mainModules[Math.min(selectedModIdx, Math.max(0, mainModules.length - 1))] || project.modules[0];

  const engReport = useMemo(() => evaluateUnifiedEngineeringModel(project), [project]);
  const canonicalFactorySteps = useMemo(
    () => (bom ? generateAssemblyInstructions(project, bom) : []),
    [project, bom]
  );
  const grainNeighborMap = useMemo(() => computeProjectGrainNeighborMap(project), [project]);
  const moduleGrainSequenceList = useMemo(() => {
    if (!mod) return [] as GrainPartNeighborInfo[];
    const uniq = new Map<string, GrainPartNeighborInfo>();
    grainNeighborMap.forEach((info) => {
      if (info.moduleId === mod.id) {
        uniq.set(info.componentId, info);
      }
    });
    return Array.from(uniq.values()).sort(
      (a, b) => a.grainGroupId.localeCompare(b.grainGroupId) || a.sequenceIndex - b.sequenceIndex
    );
  }, [grainNeighborMap, mod]);

  const assemblyData = useMemo(() => {
    if (!mod) return null;
    const W = mod.dimensions.width;
    const H = mod.dimensions.height;
    const D = mod.dimensions.depth;
    const T = mod.carcass.panelThickness || 18;
    const hull = mod.carcass.hullShape || "rectangular";
    const isCapsuleTambour = hull === "capsule_stadium" || hull === "rounded_corners";
    const isCapsuleTable = hull === "capsule_table";
    const hasTambourBays = mod.bays.some((b) => isTambourDoor(b.door));
    const hasTray =
      isCapsuleTambour &&
      mod.carcass.hasCountertopTray !== false &&
      Boolean(mod.carcass.countertopMaterialId || hull === "capsule_stadium");

    const plinthH = mod.carcass.plinthHeight ?? 80;
    const bayCount = Math.max(1, mod.bays.length);
    const dividerCount = Math.max(0, bayCount - 1);
    const shelfCount = mod.bays.reduce((s, b) => s + (b.shelves?.length || 0), 0);
    const drawerCount = mod.bays.reduce((s, b) => s + (b.drawers?.length || 0), 0);
    const railCount = mod.bays.reduce((s, b) => s + (b.hangingRails?.length || 0), 0);
    const hasDoors =
      !isCapsuleTable &&
      !mod.isOpenFront &&
      (isCapsuleTambour ||
        mod.bays.some((b) => b.door && b.door.type !== "open" && b.door.doorSystemId !== "open"));
    const doorLeavesCount = isCapsuleTambour
      ? mod.isOpenFront
        ? 0
        : 2
      : mod.bays.reduce((acc, b) => {
          if (mod.isOpenFront || !b.door || b.door.type === "open" || b.door.doorSystemId === "open")
            return acc;
          return (
            acc +
            (b.door.type === "double" ||
            b.door.doorSystemId === "hinged_double" ||
            b.door.type === "sliding"
              ? 2
              : 1)
          );
        }, 0);

    const isWallCab =
      !isCapsuleTable && (mod.category === "kitchen_wall" || (mod.position.y || 0) >= 1100);
    const topStretcherMode =
      !isCapsuleTambour &&
      !isCapsuleTable &&
      mod.category === "kitchen_base" &&
      mod.carcass.topConstruction === "stretcher_90mm";
    const jointTopology: string =
      mod.carcass.carcassJoineryTopology || "type_a_top_bottom_between_sides";
    const isMiter45 = jointTopology === "type_c_miter_45_clamex";

    const modCutPieces = (bom?.cutList || []).filter((p) => p.moduleId === mod.id);
    const totalHoles = modCutPieces.reduce((acc, p) => acc + (p.holes?.length || 0), 0);
    const cornerR =
      hull === "capsule_stadium"
        ? Math.round(D / 2)
        : Math.max(65, Math.min(mod.carcass.cornerRadiusMm || 100, Math.round(D / 2 - 10)));

    const joineryLabel = isCapsuleTable
      ? "Kapsül Masa — Silindirik Kerf Sütun Ayak + Dairesel M8 Flanş Disk & Çelik Sarkma Traversi"
      : isCapsuleTambour
      ? `${hull === "capsule_stadium" ? "Kapsül Stadyum" : `R${cornerR}mm Köşeli`} Tambur Sistemi — 8.5×7.5mm CNC Ray Kanalı + 32mm Kavisli Kerf Cep`
      : hasTambourBays
      ? "Tambur Kapaklı Modül — Üst Sarım Kaseti + Alüminyum Gömme Kılavuz Ray + Lamel Perde"
      : isMiter45
      ? "Tip C — 45° Gönye Birleşim (Lamello Clamex P-14)"
      : topStretcherMode
      ? "Tip D — 90mm Ön/Arka Kayıtlı Alt Dolap Karkası"
      : jointTopology === "type_b_sides_on_top_bottom"
      ? "Tip B — Alt/Üst Tabla Üzerine Oturan Dikme (Minifiks + Ø8 Kavela)"
      : "Tip A — Yan Dikmeler Arası Alt/Üst Tabla (Ø15 Minifiks + Ø8×35 Kavela)";

    let steps: Array<{ num: number; title: string; partCodes: string[]; detail: string }>;

    if (isCapsuleTable) {
      steps = [
        {
          num: 1,
          title: "Alt Dairesel CNC Kalıp Diskleri & Terazi Pabuçları",
          partCodes: ["⑦"],
          detail: `Her iki sütun ayak için alt dairesel CNC kalıp disklerine (⑦) M8 terazi ayar pabuçlarını vidalayın ve zemin üzerinde aks mesafesini hizalayın.`,
        },
        {
          num: 2,
          title: "Silindirik Yivli CNC Kerf Sütun Ayakların Kilitlenmesi",
          partCodes: ["①", "②", "⑦"],
          detail: `Arka yüzü esneme çentikli (CNC Kerf) sol (①) ve sağ (②) sütun gövde açınımlarını dairesel kalıp diskleri etrafına sararak kavelalı birleşim hattından poliüretan D4 tutkal ile kilitleyin.`,
        },
        {
          num: 3,
          title: "Üst Taşıyıcı Dairesel Flanş Disklerinin Montajı",
          partCodes: ["③", "①", "②"],
          detail: `Üst dairesel taşıyıcı CNC diskleri (③) ve lazer kesim M8 çelik bağlantı flanşlarını sütunların üst boğazına sabitleyin.`,
        },
        {
          num: 4,
          title: "Masa Altı Çelik Sarkma Önleyici Travers Bağlantısı",
          partCodes: ["⑤", "③"],
          detail: `İki sütun flanşı arasına 40×20×2 mm elektrostatik boyalı çelik sarkma önleyici travers profilini (⑤) M8 havşa başlı cıvatalarla bağlayın.`,
        },
        {
          num: 5,
          title: "5-Eksen Swiss-Edge Kapsül Masa Üst Tablasının Sabitlenmesi",
          partCodes: ["④", "③", "⑤"],
          detail: `${W}×${D} mm kapsül üst tablayı (④) ters yüzündeki M8 gömme somun (rampamuffe) yuvalarına flanş ve travers deliklerinden cıvatalayarak sıkın.`,
        },
        {
          num: 6,
          title: "Zemin Su Terazisi Kalibrasyonu & Son Kontrol",
          partCodes: ["④", "⑦"],
          detail: `Masayı nihai konumuna alıp alt terazi pabuçlarıyla (⑦) sallantıyı sıfırlayın ve 45° Swiss-Edge pah kenarlarını kontrol edin.`,
        },
      ];
    } else if (isCapsuleTambour) {
      steps = [
        {
          num: 1,
          title: "Torna Ayak / Baza & CNC Tambur Kanallı Alt Tabla Kurulumu",
          partCodes: ["⑦", "③"],
          detail: `${plinthH > 0 ? `${plinthH} mm masif/metal torna ayak flanşlarını (⑦) alt tablaya bağlayıp su terazisine alın. ` : ""}Alt tabladaki (③) R=${cornerR} mm sürekli 8.5×7.5 mm CNC tambur kılavuz oluğunu tozdan arındırıp kuru PTFE/silikon kaydırıcı uygulayın.`,
        },
        {
          num: 2,
          title: "Kavisli CNC Kerf İç Cep Gövdeleri & Taşıyıcı Dikmeler",
          partCodes: ["①", "②", "⑤", "③"],
          detail: `Dış tambur kanalıyla arasında net 32 mm cep koridoru kalacak şekilde sol (①) ve sağ (②) kavisli CNC kerf iç gövde kabuklarını, yan taşıyıcı dikmeleri ve ${dividerCount > 0 ? `${dividerCount} adet bölme dikmesini (⑤)` : "iç dikmeleri (⑤)"} alt tablaya kilitleyin.`,
        },
        {
          num: 3,
          title: `Orta Arkalık${drawerCount > 0 ? ", Medya Çekmecesi" : ""} & Bölme Rafları Montajı`,
          partCodes: ["⑥", "⑧", ...(drawerCount > 0 ? ["⑨"] : [])],
          detail: `Orta düz arkalığı (⑥, TV ünitelerinde kablo menfezli) arka kanala oturtun. ${shelfCount > 0 ? `${shelfCount} adet bölme rafını (⑧)` : "İç rafları"}${drawerCount > 0 ? ` ve ${drawerCount} adet frenli çekmece kasasını (⑨)` : ""} monte edin.`,
        },
        {
          num: 4,
          title: "Esnek Keçe Sırtlı Kavisli Tambur Lamel Perdelerin Sürülmesi",
          partCodes: ["⑩", "③"],
          detail: `Akustik keçe sırtlı sol ve sağ tambur lamel panellerin (⑩) alt kılavuz pimlerini alt tabladaki 8.5×7.5 mm CNC ray oluğuna teğetsel olarak sürün; 32 mm yan kavis koridoru boyunca takılmadan kaydığını doğrulayın.`,
        },
        {
          num: 5,
          title: "CNC Tambur Kanallı Üst Tabla Kilitleme & Gömme Kulp/Stoper Ayarı",
          partCodes: ["④", "⑩", "⑤"],
          detail: `Üst tabladaki (④) eşlenik 8.5×7.5 mm CNC tambur ray oluğunu tambur perdelerin üst kılavuz pimlerine geçirerek dikme minifikslerini 180° kilitleyin; orta kapanma mıknatısı/stoperini ve gömme çekme kulpunu sabitleyin.`,
        },
        {
          num: 6,
          title: hasTray
            ? "20 mm Gömme Mermer/Kuvars Tabla Montajı & Son Akış Testi"
            : "Devrilme Emniyeti & Tambur Akış Kalibrasyonu",
          partCodes: hasTray ? ["⑪", "④"] : ["④", "⑩"],
          detail: hasTray
            ? `Üst tabla havuzuna titreşim sönümleyici silikon pedleri yerleştirip 20 mm mermer/kuvars üst tablayı (⑪) oturtun ve her iki tambur kapağın tam açılıp kapanma senkronunu kontrol edin.`
            : `Üniteyi orta arka dikmeden duvara emniyetleyin ve her iki tambur kapağın tam açılıp kapanma senkronunu kontrol edin.`,
        },
      ];
    } else {
      steps = [
        {
          num: 1,
          title: "Baza / Ayak Teraziye Alma & Gövde Hazırlığı",
          partCodes: ["⑦", "①", "②", "③"],
          detail: isWallCab
            ? `Üst dolap yan panellerindeki 45×65 mm askı kertmelerine (NOTCH_WALL_HANGER) çelik duvar askı elemanlarını takın; Ø8×35 mm kavela ve minifiks milleri dikmelere vidalayın.`
            : `${plinthH} mm yüksekliğindeki baza/ayarlı ayak grubunu su terazisiyle hizalayın. Sol (①) ve sağ (②) dikmelerin iç yüzlerindeki Ø8 mm kavela ve Ø15 mm minifiks yuvalarına bağlantı millerini takın.`,
        },
        {
          num: 2,
          title: `Ana Karkas & ${dividerCount > 0 ? `${dividerCount} Adet Ara Dikme` : "Üst Tabla"} Kilitleme`,
          partCodes: ["①", "②", "③", "④", ...(dividerCount > 0 ? ["⑤"] : [])],
          detail: `${joineryLabel}. Alt tabla (③)${dividerCount > 0 ? `, ${dividerCount} adet ara dikme (⑤)` : ""} ve ${topStretcherMode ? "90 mm ön/arka kayıtları (④)" : "üst tablayı (④)"} birleştirip minifiks eksantriklerini saat yönünde 180° kilitleyin.`,
        },
        {
          num: 3,
          title: "8 mm Kanallı Arkalık (GROOVE_W8.5_Z6) & Gönye Kontrolü",
          partCodes: ["⑥"],
          detail: `Arkalık panelini (⑥) yan ve üst panellerdeki 18 mm içeriden açılmış 8.5×6 mm kanala sürerek oturtun. Köşegen (diyagonal) ölçü eşitliğini kontrol edip arkalık sabitleme kamalarını sıkın.`,
        },
        {
          num: 4,
          title:
            drawerCount > 0
              ? `${drawerCount} Adet Kanallı Çekmece Kasası & Gizli Ray Montajı`
              : `${shelfCount} Adet Raf & Sistem 32 Donanım Montajı`,
          partCodes: ["⑧", ...(drawerCount > 0 ? ["⑨"] : [])],
          detail:
            drawerCount > 0
              ? `Sistem 32 (37 mm ön set) deliklerine gizli rayları vidalayın. Çekmece yan/ön Z=6 mm kanallarına 8 mm alt tabanı (LW − 30 mm) sürün, 16 mm çekmece arkalığını Ø6 mm arka kancalara oturtup T51.1700 mandallarla raylara kilitleyin.`
              : `Sistem 32 Ø5 mm delik sıralarına raf pimlerini takın; sabit rafları minifiks gövde kilitleriyle, hareketli rafları (⑧)${railCount > 0 ? ` ve ${railCount} adet askı borusunu` : ""} yerleştirin.`,
        },
        {
          num: 5,
          title: hasTambourBays
            ? "Tambur Lamel Perde, Alüminyum Gömme Ray & Üst Sarım Kaseti Montajı"
            : hasDoors
            ? `${doorLeavesCount} Kanat Kapak, Ø35 mm Menteşe & Kulp (C-C) Montajı`
            : "İç Aksesuar & Raf Emniyet Kontrolü",
          partCodes: hasDoors ? ["⑩"] : ["⑧"],
          detail: hasTambourBays
            ? `Yan dikmelere alüminyum gömme kılavuz rayları ve üst bölmeye yaylı dengeleme tambur mekanizmasını sabitleyin. Esnek lamel perdeyi (⑩) raylara sürüp üst sarım kapama alnını ve alt çekme profilini bağlayın.`
            : hasDoors
            ? `Kapaklardaki Ø35×13 mm tas deliklerine frenli menteşeleri oturtup gövdedeki 37 mm taban plakalarına klipsleyin. 3 eksenli (±2 mm) vidalarla kapaklar arası 2 mm fuga boşluğunu hizalayın ve M4 vidalarla kulpları bağlayın.`
            : `Açık modül raflarının pimleri ve iç aksesuar bağlantılarının tam oturduğunu doğrulayın.`,
        },
        {
          num: 6,
          title:
            mainModules.length > 1
              ? "Modüller Arası M4 Gövde Birleştirme & Duvara Sabitleme"
              : "Devrilme Önleyici Duvar Sabitlemesi & Son Kontrol",
          partCodes: ["①", "②", "④"],
          detail:
            mainModules.length > 1
              ? `Yan yana gelen ${mainModules.length} modülü gönyeye alıp Ø5 mm boydan boya deliklerden M4×32 mm kovanlı birleştirme civatalarıyla birbirine sıkın ve L-braketle duvara emniyetleyin.`
              : `Dolabı nihai konumunda teraziye alıp üst arka kayıt/tabladan devrilme önleyici L-braket ile duvara sabitleyin.`,
        },
      ];
    }

    return {
      W,
      H,
      D,
      T,
      hull,
      isCapsuleTambour,
      isCapsuleTable,
      hasTambourBays,
      hasTray,
      cornerR,
      plinthH,
      bayCount,
      dividerCount,
      shelfCount,
      drawerCount,
      railCount,
      hasDoors,
      doorLeavesCount,
      isWallCab,
      topStretcherMode,
      joineryLabel,
      modCutPieces,
      totalHoles,
      steps,
    };
  }, [mod, bom?.cutList, mainModules.length]);

  const isoScene = useMemo(() => {
    if (!mod || !assemblyData) return null;
    const { boxes, explodeX, explodeY, explodeZ, explodeDrawerZ, explodeDoorZ } = buildExplodedIsoBoxes(
      mod,
      assemblyData.isWallCab,
      assemblyData.topStretcherMode
    );

    let minU = Infinity;
    let maxU = -Infinity;
    let minV = Infinity;
    let maxV = -Infinity;

    for (const b of boxes) {
      const corners = [
        [b.x0, b.y0, b.z0],
        [b.x1, b.y0, b.z0],
        [b.x0, b.y1, b.z0],
        [b.x1, b.y1, b.z0],
        [b.x0, b.y0, b.z1],
        [b.x1, b.y0, b.z1],
        [b.x0, b.y1, b.z1],
        [b.x1, b.y1, b.z1],
      ];
      for (const [cx, cy, cz] of corners) {
        const p = projectIsoPoint(cx, cy, cz);
        if (p.u < minU) minU = p.u;
        if (p.u > maxU) maxU = p.u;
        if (p.v < minV) minV = p.v;
        if (p.v > maxV) maxV = p.v;
      }
    }

    const svgW = 680;
    const svgH = 460;
    const padX = 82;
    const padY = 52;
    const spanU = Math.max(1, maxU - minU);
    const spanV = Math.max(1, maxV - minV);
    const scale = Math.min((svgW - 2 * padX) / spanU, (svgH - 2 * padY) / spanV);
    const offsetX = (svgW - spanU * scale) / 2 - minU * scale;
    const offsetY = (svgH - spanV * scale) / 2 - minV * scale;

    const toSvg = (x: number, y: number, z: number) => {
      const p = projectIsoPoint(x, y, z);
      return {
        x: Math.round((p.u * scale + offsetX) * 10) / 10,
        y: Math.round((p.v * scale + offsetY) * 10) / 10,
      };
    };

    const ptsStr = (pts: Array<{ x: number; y: number }>) =>
      pts.map((p) => `${p.x},${p.y}`).join(" ");

    const renderedBoxes = boxes.map((b) => {
      const variant = b.shapeVariant || "box";
      let frontPoly = "";
      let rightPoly = "";
      let topPoly = "";
      let trackGroovePoly = "";
      const slatLines: Array<{ x1: number; y1: number; x2: number; y2: number; dashed?: boolean }> = [];

      if (variant === "stadium_slab" || variant === "pedestal_disc") {
        const r = b.cornerRadiusMm ?? Math.min(b.x1 - b.x0, b.z1 - b.z0) / 2;
        const loop = sampleRoundedRectLoopXZ(b.x0, b.z0, b.x1, b.z1, r, 7);
        const topPts = loop.map((pt) => toSvg(pt.x, b.y1, pt.z));
        topPoly = ptsStr(topPts);

        // Visible front-right rim band in isometric projection (angles where x or z faces viewer)
        const visLoop = loop.slice(0, Math.floor(loop.length * 0.62));
        const rimPts = [
          ...visLoop.map((pt) => toSvg(pt.x, b.y1, pt.z)),
          ...[...visLoop].reverse().map((pt) => toSvg(pt.x, b.y0, pt.z)),
        ];
        frontPoly = ptsStr(rimPts);

        if (b.hasTambourTrackGroove) {
          const inset = 18;
          const grooveLoop = sampleRoundedRectLoopXZ(
            b.x0 + inset,
            b.z0 + inset,
            b.x1 - inset,
            b.z1 - inset,
            Math.max(8, r - inset),
            6
          );
          trackGroovePoly = ptsStr(grooveLoop.map((pt) => toSvg(pt.x, b.y1 + 0.5, pt.z)));
        }
      } else if (variant === "pedestal_cylinder") {
        const cx = (b.x0 + b.x1) / 2;
        const cz = (b.z0 + b.z1) / 2;
        const rx = Math.max(8, (b.x1 - b.x0) / 2);
        const rz = Math.max(8, (b.z1 - b.z0) / 2);
        const segs = 20;
        const topCircle: Array<{ x: number; y: number }> = [];
        for (let i = 0; i <= segs; i++) {
          const a = (Math.PI * 2 * i) / segs;
          topCircle.push(toSvg(cx + Math.cos(a) * rx, b.y1, cz + Math.sin(a) * rz));
        }
        topPoly = ptsStr(topCircle);

        // Visible front half of cylinder: angle -0.45 to PI - 0.45 in iso projection
        const frontArcTop: Array<{ x: number; y: number }> = [];
        const frontArcBot: Array<{ x: number; y: number }> = [];
        const arcSteps = 12;
        for (let i = 0; i <= arcSteps; i++) {
          const a = -0.38 + ((Math.PI + 0.38) * i) / arcSteps;
          const px = cx + Math.cos(a) * rx;
          const pz = cz + Math.sin(a) * rz;
          frontArcTop.push(toSvg(px, b.y1, pz));
          frontArcBot.push(toSvg(px, b.y0, pz));
          if (b.slatCount && i > 0 && i < arcSteps) {
            const sTop = toSvg(px, b.y1 - 4, pz);
            const sBot = toSvg(px, b.y0 + 4, pz);
            slatLines.push({ x1: sTop.x, y1: sTop.y, x2: sBot.x, y2: sBot.y });
          }
        }
        frontPoly = ptsStr([...frontArcTop, ...frontArcBot.reverse()]);
      } else if (variant === "curved_kerf_left" || variant === "curved_kerf_right") {
        const isLeft = variant === "curved_kerf_left";
        const cz = (b.z0 + b.z1) / 2;
        const rz = Math.max(24, (b.z1 - b.z0) / 2);
        const cx = isLeft ? b.x1 : b.x0;
        const rx = Math.max(24, b.x1 - b.x0);
        const steps = 12;
        const outerTop: Array<{ x: number; y: number }> = [];
        const outerBot: Array<{ x: number; y: number }> = [];
        const innerTop: Array<{ x: number; y: number }> = [];
        for (let i = 0; i <= steps; i++) {
          const a = isLeft
            ? Math.PI / 2 + (Math.PI * i) / steps
            : -Math.PI / 2 + (Math.PI * i) / steps;
          const ox = cx + Math.cos(a) * rx;
          const oz = cz + Math.sin(a) * rz;
          const ix = cx + Math.cos(a) * Math.max(10, rx - 16);
          const iz = cz + Math.sin(a) * Math.max(10, rz - 16);
          outerTop.push(toSvg(ox, b.y1, oz));
          outerBot.push(toSvg(ox, b.y0, oz));
          innerTop.push(toSvg(ix, b.y1, iz));
          if (i > 0 && i < steps) {
            const pT = toSvg(ox, b.y1 - 6, oz);
            const pB = toSvg(ox, b.y0 + 6, oz);
            slatLines.push({ x1: pT.x, y1: pT.y, x2: pB.x, y2: pB.y, dashed: true });
          }
        }
        topPoly = ptsStr([...outerTop, ...innerTop.reverse()]);
        frontPoly = ptsStr([...outerTop, ...outerBot.reverse()]);
      } else if (variant === "tambour_curtain_left" || variant === "tambour_curtain_right") {
        const isLeft = variant === "tambour_curtain_left";
        const r = Math.min(b.cornerRadiusMm ?? 120, (b.x1 - b.x0) * 0.65, b.z1 - b.z0);
        const pathXZ: Array<{ x: number; z: number }> = [];
        const arcSegs = 8;
        if (isLeft) {
          // Side curve from z0 around left end to front z1, then straight to x1
          const cx = b.x0 + r;
          const cz = b.z1 - r;
          for (let i = 0; i <= arcSegs; i++) {
            const a = Math.PI + (-Math.PI / 2 * i) / arcSegs; // PI -> PI/2
            pathXZ.push({ x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r });
          }
          const straightSteps = 8;
          for (let s = 1; s <= straightSteps; s++) {
            const sx = cx + ((b.x1 - cx) * s) / straightSteps;
            pathXZ.push({ x: sx, z: b.z1 });
          }
        } else {
          // Straight from x0 to right curve start, then curve around right end
          const cx = b.x1 - r;
          const cz = b.z1 - r;
          const straightSteps = 8;
          for (let s = 0; s <= straightSteps; s++) {
            const sx = b.x0 + ((cx - b.x0) * s) / straightSteps;
            pathXZ.push({ x: sx, z: b.z1 });
          }
          for (let i = 1; i <= arcSegs; i++) {
            const a = Math.PI / 2 - ((Math.PI / 2) * i) / arcSegs; // PI/2 -> 0
            pathXZ.push({ x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r });
          }
        }

        const topOuter = pathXZ.map((pt) => toSvg(pt.x, b.y1, pt.z));
        const botOuter = pathXZ.map((pt) => toSvg(pt.x, b.y0, pt.z));
        const topInner = [...pathXZ].reverse().map((pt) => toSvg(pt.x, b.y1, pt.z - 12));
        topPoly = ptsStr([...topOuter, ...topInner]);
        frontPoly = ptsStr([...topOuter, ...[...botOuter].reverse()]);

        pathXZ.forEach((pt, idx) => {
          if (idx > 0 && idx < pathXZ.length - 1) {
            const pT = toSvg(pt.x, b.y1 - 2, pt.z + 0.5);
            const pB = toSvg(pt.x, b.y0 + 2, pt.z + 0.5);
            slatLines.push({ x1: pT.x, y1: pT.y, x2: pB.x, y2: pB.y });
          }
        });
      } else {
        const p001 = toSvg(b.x0, b.y0, b.z1);
        const p101 = toSvg(b.x1, b.y0, b.z1);
        const p111 = toSvg(b.x1, b.y1, b.z1);
        const p011 = toSvg(b.x0, b.y1, b.z1);

        const p100 = toSvg(b.x1, b.y0, b.z0);
        const p110 = toSvg(b.x1, b.y1, b.z0);
        const p010 = toSvg(b.x0, b.y1, b.z0);

        frontPoly = ptsStr([p001, p101, p111, p011]);
        rightPoly = ptsStr([p101, p100, p110, p111]);
        topPoly = ptsStr([p011, p111, p110, p010]);

        if (variant === "tambour_curtain_vertical") {
          const count = b.slatCount ?? 14;
          for (let s = 1; s < count; s++) {
            const sy = b.y0 + ((b.y1 - b.y0) * s) / count;
            const l0 = toSvg(b.x0 + 2, sy, b.z1 + 0.5);
            const l1 = toSvg(b.x1 - 2, sy, b.z1 + 0.5);
            slatLines.push({ x1: l0.x, y1: l0.y, x2: l1.x, y2: l1.y });
          }
        }
      }

      // Optional handle & hinge cups on doors / drawer fronts
      let handleLine: { x1: number; y1: number; x2: number; y2: number } | null = null;
      const hingeCups: Array<{ cx: number; cy: number }> = [];

      if (b.handlePos === "bottom-center") {
        const hx0 = b.x0 + (b.x1 - b.x0) * 0.36;
        const hx1 = b.x0 + (b.x1 - b.x0) * 0.64;
        const hy =
          variant === "tambour_curtain_vertical"
            ? b.y0 + Math.min(28, (b.y1 - b.y0) * 0.1)
            : b.y0 + (b.y1 - b.y0) * 0.55;
        const hStart = toSvg(hx0, hy, b.z1 + 2);
        const hEnd = toSvg(hx1, hy, b.z1 + 2);
        handleLine = { x1: hStart.x, y1: hStart.y, x2: hEnd.x, y2: hEnd.y };
      } else if (b.handlePos === "tambour-recessed") {
        const hx = variant === "tambour_curtain_left" ? b.x1 - 26 : b.x0 + 26;
        const midY = (b.y0 + b.y1) * 0.5;
        const span = Math.min(70, (b.y1 - b.y0) * 0.22);
        const hStart = toSvg(hx, midY - span, b.z1 + 2);
        const hEnd = toSvg(hx, midY + span, b.z1 + 2);
        handleLine = { x1: hStart.x, y1: hStart.y, x2: hEnd.x, y2: hEnd.y };
      } else if (b.handlePos === "left" || b.handlePos === "right") {
        const hx = b.handlePos === "left" ? b.x0 + 36 : b.x1 - 36;
        const midY = Math.min(b.y1 - 90, Math.max(b.y0 + 180, (b.y0 + b.y1) * 0.42));
        const hStart = toSvg(hx, midY - 95, b.z1 + 2);
        const hEnd = toSvg(hx, midY + 95, b.z1 + 2);
        handleLine = { x1: hStart.x, y1: hStart.y, x2: hEnd.x, y2: hEnd.y };
      }

      if (b.kind === "door" && b.hingeSide && b.hingeSide !== "none") {
        const cupX = b.hingeSide === "left" ? b.x0 + 26 : b.x1 - 26;
        const hSpan = b.y1 - b.y0;
        const cupCount = hSpan > 1500 ? 4 : hSpan > 900 ? 3 : 2;
        for (let ci = 0; ci < cupCount; ci++) {
          const frac = 0.1 + (0.8 * ci) / (cupCount - 1);
          const cp = toSvg(cupX, b.y0 + hSpan * frac, b.z1 + 2);
          hingeCups.push({ cx: cp.x, cy: cp.y });
        }
      }

      const sys32Pts: Array<{ cx: number; cy: number }> = [];
      let grooveLine: { x1: number; y1: number; x2: number; y2: number } | null = null;
      if (b.hasSys32) {
        const ySpan = Math.max(120, b.y1 - b.y0 - 120);
        for (let i = 0; i < 5; i++) {
          const sy = b.y0 + 60 + (ySpan * i) / 4;
          const sp = toSvg(b.x1 + 1, sy, b.z1 - 35);
          sys32Pts.push({ cx: sp.x, cy: sp.y });
        }
        const g1 = toSvg(b.x1 + 1, b.y0 + 10, b.z0 + 20);
        const g2 = toSvg(b.x1 + 1, b.y1 - 10, b.z0 + 20);
        grooveLine = { x1: g1.x, y1: g1.y, x2: g2.x, y2: g2.y };
      }

      let grainInfo: GrainPartNeighborInfo | undefined;
      if (b.grainLookupKeys) {
        for (const k of b.grainLookupKeys) {
          const hit = grainNeighborMap.get(k) || grainNeighborMap.get(`P_${mod.id}_${k}`);
          if (hit && hit.moduleId === mod.id) {
            grainInfo = hit;
            break;
          }
        }
      }

      let grainBadgeOverlay: {
        cx: number;
        cy: number;
        seqBadge: string;
        arrowFrom: { x: number; y: number };
        arrowTo: { x: number; y: number };
        dirSymbol: string;
      } | null = null;

      if (grainInfo) {
        const midX = (b.x0 + b.x1) / 2;
        const midY = (b.y0 + b.y1) / 2;
        const centerPt = toSvg(midX, midY, b.z1 + 3);
        const spanX = Math.max(40, (b.x1 - b.x0) * 0.26);
        const spanY = Math.max(36, Math.min(140, (b.y1 - b.y0) * 0.24));
        const arrowFrom =
          grainInfo.grainDirection === "crosswise"
            ? toSvg(midX - spanX, midY, b.z1 + 3)
            : toSvg(midX, midY - spanY, b.z1 + 3);
        const arrowTo =
          grainInfo.grainDirection === "crosswise"
            ? toSvg(midX + spanX, midY, b.z1 + 3)
            : toSvg(midX, midY + spanY, b.z1 + 3);

        grainBadgeOverlay = {
          cx: centerPt.x,
          cy: centerPt.y,
          seqBadge: grainInfo.shortSeqBadge,
          arrowFrom,
          arrowTo,
          dirSymbol: grainInfo.arrowSymbol,
        };
      }

      return {
        ...b,
        frontPoly,
        rightPoly,
        topPoly,
        trackGroovePoly,
        slatLines,
        handleLine,
        hingeCups,
        sys32Pts,
        grooveLine,
        grainInfo,
        grainBadgeOverlay,
      };
    });

    // Desen takibi komşu cepheler arası akış bağlantı okları ([k/N] -> [k+1/N])
    const grainFlowLinks: Array<{
      id: string;
      from: { x: number; y: number };
      to: { x: number; y: number };
    }> = [];
    const grainBoxesBySeq = renderedBoxes
      .filter((rb) => rb.grainInfo && rb.grainBadgeOverlay)
      .sort(
        (a, b) =>
          a.grainInfo!.grainGroupId.localeCompare(b.grainInfo!.grainGroupId) ||
          a.grainInfo!.sequenceIndex - b.grainInfo!.sequenceIndex
      );
    for (let i = 0; i + 1 < grainBoxesBySeq.length; i++) {
      const curB = grainBoxesBySeq[i];
      const nxtB = grainBoxesBySeq[i + 1];
      if (
        curB.grainInfo!.grainGroupId === nxtB.grainInfo!.grainGroupId &&
        nxtB.grainInfo!.sequenceIndex === curB.grainInfo!.sequenceIndex + 1
      ) {
        grainFlowLinks.push({
          id: `gflow-${curB.id}-${nxtB.id}`,
          from: { x: curB.grainBadgeOverlay!.cx, y: curB.grainBadgeOverlay!.cy },
          to: { x: nxtB.grainBadgeOverlay!.cx, y: nxtB.grainBadgeOverlay!.cy },
        });
      }
    }

    const W = mod.dimensions.width;
    const H = mod.dimensions.height;
    const D = mod.dimensions.depth;
    const plinthH = assemblyData.isWallCab ? 0 : assemblyData.plinthH;
    const midY = (plinthH + H) / 2;

    let arrows: Array<{ code: string; from: { x: number; y: number }; to: { x: number; y: number } }>;
    let callouts: Array<{ code: string; num: string; label: string; x: number; y: number }>;

    if (assemblyData.isCapsuleTable) {
      arrows = [
        { code: "①", from: toSvg(W * 0.22 - explodeX * 0.42, H * 0.45, D / 2), to: toSvg(W * 0.24, H * 0.45, D / 2) },
        { code: "②", from: toSvg(W * 0.78 + explodeX * 0.42, H * 0.45, D / 2), to: toSvg(W * 0.76, H * 0.45, D / 2) },
        { code: "④", from: toSvg(W / 2, H + explodeY * 1.1, D / 2), to: toSvg(W / 2, H - 20, D / 2) },
        { code: "⑦", from: toSvg(W * 0.24, -explodeY * 0.65, D / 2), to: toSvg(W * 0.24, 10, D / 2) },
      ];
      callouts = [
        { code: "①", num: "1", label: "Sol Yivli Kerf Sütun", ...toSvg(-explodeX * 0.36, H * 0.62, D * 0.5) },
        { code: "②", num: "2", label: "Sağ Yivli Kerf Sütun", ...toSvg(W + explodeX * 0.25, H * 0.62, D * 0.4) },
        { code: "③", num: "3", label: "Üst Flanş & Kalıp Diski", ...toSvg(W * 0.18, H + explodeY * 0.42, D * 0.3) },
        { code: "④", num: "4", label: "5-Eksen Kapsül Tabla", ...toSvg(W * 0.35, H + explodeY * 1.38, D * 0.45) },
        { code: "⑤", num: "5", label: "Çelik Sarkma Traversi", ...toSvg(W * 0.52, H + explodeY * 0.65, D * 0.5) },
        { code: "⑦", num: "7", label: "Alt Disk & M8 Pabuç", ...toSvg(W * 0.22, -explodeY * 0.85, D * 0.65) },
      ];
    } else if (assemblyData.isCapsuleTambour) {
      arrows = [
        { code: "①", from: toSvg(-explodeX * 0.55, midY, D / 2), to: toSvg(40, midY, D / 2) },
        { code: "②", from: toSvg(W + explodeX * 0.55, midY, D / 2), to: toSvg(W - 40, midY, D / 2) },
        { code: "④", from: toSvg(W / 2, H + explodeY * 0.85, D / 2), to: toSvg(W / 2, H - 20, D / 2) },
        ...(assemblyData.hasTray
          ? [{ code: "⑪", from: toSvg(W * 0.62, H + explodeY * 1.55, D / 2), to: toSvg(W * 0.62, H + explodeY * 0.98, D / 2) }]
          : []),
        { code: "⑥", from: toSvg(W / 2, midY, -explodeZ * 0.8), to: toSvg(W / 2, midY, 10) },
        ...(assemblyData.hasDoors
          ? [
              { code: "⑩", from: toSvg(W * 0.22, midY, D + explodeDoorZ * 0.62), to: toSvg(W * 0.24, midY, D) },
              { code: "⑩", from: toSvg(W * 0.78, midY, D + explodeDoorZ * 0.62), to: toSvg(W * 0.76, midY, D) },
            ]
          : []),
        ...(!assemblyData.isWallCab && plinthH > 0
          ? [{ code: "⑦", from: toSvg(W * 0.5, -explodeY * 0.75, D / 2), to: toSvg(W * 0.5, plinthH, D / 2) }]
          : []),
      ];

      callouts = [
        { code: "①", num: "1", label: "Sol Kavisli Kerf Cep", ...toSvg(-explodeX * 0.78, H * 0.72, D * 0.45) },
        { code: "②", num: "2", label: "Sağ Kavisli Kerf Cep", ...toSvg(W + explodeX * 0.52, H * 0.72, D * 0.35) },
        { code: "③", num: "3", label: "CNC Ray Oluklu Alt Tabla", ...toSvg(W * 0.12, plinthH - 22, D * 1.04) },
        { code: "④", num: "4", label: "CNC Ray Oluklu Üst Tabla", ...toSvg(W * 0.16, H + explodeY * 1.05, D * 0.35) },
        { code: "⑤", num: "5", label: "Taşıyıcı & Bölme Dikmesi", ...toSvg(W * 0.45, H * 0.78, D * 0.45) },
        { code: "⑥", num: "6", label: "Orta Düz Arkalık", ...toSvg(W * 0.68, H + 85, -explodeZ * 0.85) },
        ...(!assemblyData.isWallCab && plinthH > 0
          ? [{ code: "⑦", num: "7", label: `Torna Ayak (${plinthH}mm)`, ...toSvg(W * 0.45, -explodeY * 0.95, D * 0.75) }]
          : []),
        ...(assemblyData.shelfCount > 0
          ? [{ code: "⑧", num: "8", label: `Bölme Rafı (${assemblyData.shelfCount}x)`, ...toSvg(W * 0.36, midY - 10, D * 0.5) }]
          : []),
        ...(assemblyData.drawerCount > 0
          ? [{ code: "⑨", num: "9", label: `Çekmece (${assemblyData.drawerCount}x)`, ...toSvg(W * 0.48, plinthH + 35, D + explodeDrawerZ * 0.9) }]
          : []),
        ...(assemblyData.hasDoors
          ? [{ code: "⑩", num: "10", label: "Kavisli Tambur Perde (2x)", ...toSvg(W * 0.74, H * 0.36, D + explodeDoorZ * 0.75) }]
          : []),
        ...(assemblyData.hasTray
          ? [{ code: "⑪", num: "11", label: "20mm Mermer Üst Tabla", ...toSvg(W * 0.54, H + explodeY * 1.82, D * 0.45) }]
          : []),
      ];
    } else {
      arrows = [
        { code: "①", from: toSvg(-explodeX + 20, midY, D / 2), to: toSvg(0, midY, D / 2) },
        { code: "②", from: toSvg(W + explodeX - 20, midY, D / 2), to: toSvg(W, midY, D / 2) },
        { code: "④", from: toSvg(W / 2, H + explodeY - 20, D / 2), to: toSvg(W / 2, H, D / 2) },
        { code: "⑥", from: toSvg(W / 2, midY, -explodeZ + 20), to: toSvg(W / 2, midY, 0) },
        ...(assemblyData.hasDoors
          ? [{ code: "⑩", from: toSvg(W * 0.72, midY, D + explodeDoorZ - 25), to: toSvg(W * 0.72, midY, D + 10) }]
          : []),
        ...(assemblyData.drawerCount > 0
          ? [{ code: "⑨", from: toSvg(W * 0.65, plinthH + 180, D + explodeDrawerZ - 20), to: toSvg(W * 0.65, plinthH + 180, D + 10) }]
          : []),
        ...(!assemblyData.isWallCab && plinthH > 0
          ? [{ code: "⑦", from: toSvg(W / 2, plinthH - explodeY + 15, D / 2), to: toSvg(W / 2, plinthH, D / 2) }]
          : []),
      ];

      callouts = [
        { code: "①", num: "1", label: `Sol Dikme (${assemblyData.T}mm)`, ...toSvg(-explodeX - 40, H * 0.85, D * 0.35) },
        { code: "②", num: "2", label: `Sağ Dikme (${assemblyData.T}mm)`, ...toSvg(W + explodeX + 35, H * 0.82, D * 0.2) },
        { code: "③", num: "3", label: "Alt Tabla", ...toSvg(W * 0.15, plinthH - 25, D * 1.05) },
        {
          code: "④",
          num: "4",
          label: assemblyData.topStretcherMode ? "90mm Kayıt" : "Üst Tabla",
          ...toSvg(W * 0.25, H + explodeY + 95, D * 0.4),
        },
        ...(assemblyData.dividerCount > 0
          ? [{ code: "⑤", num: "5", label: `Ara Dikme (${assemblyData.dividerCount}x)`, ...toSvg(W * 0.45, H + 55, D * 0.5) }]
          : []),
        { code: "⑥", num: "6", label: "8mm Arkalık", ...toSvg(W * 0.72, H + 145, -explodeZ) },
        ...(!assemblyData.isWallCab && plinthH > 0
          ? [{ code: "⑦", num: "7", label: `Baza (${plinthH}mm)`, ...toSvg(W * 0.5, -explodeY - 75, D * 0.7) }]
          : []),
        ...(assemblyData.shelfCount > 0
          ? [{ code: "⑧", num: "8", label: `Raf (${assemblyData.shelfCount}x)`, ...toSvg(W * 0.2, midY + 90, D * 0.35) }]
          : []),
        ...(assemblyData.drawerCount > 0
          ? [{ code: "⑨", num: "9", label: `Çekmece (${assemblyData.drawerCount}x)`, ...toSvg(W * 0.78, plinthH + 40, D + explodeDrawerZ + 80) }]
          : []),
        ...(assemblyData.hasDoors
          ? [
              {
                code: "⑩",
                num: "10",
                label: assemblyData.hasTambourBays
                  ? "Tambur Lamel Perde"
                  : `Kapak (${assemblyData.doorLeavesCount}x)`,
                ...toSvg(W * 0.78, H * 0.45, D + explodeDoorZ + 90),
              },
            ]
          : []),
      ];
    }

    return { renderedBoxes, arrows, callouts, grainFlowLinks };
  }, [mod, assemblyData, grainNeighborMap]);

  if (!isOpen || !mod || !assemblyData || !isoScene) return null;

  const isHighlighted = (code: string) => {
    if (activeStep === 0) return true;
    const st = assemblyData.steps[activeStep - 1];
    return st ? st.partCodes.includes(code) : true;
  };

  const downloadSvgDiagram = () => {
    if (!svgRef.current) return;
    const raw = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([raw], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Birim_Montaj_Semasi_${mod.id}.svg`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (a.parentNode) a.parentNode.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
  };

  const printAssemblySheet = () => {
    if (!svgRef.current) return;
    const svgMarkup = new XMLSerializer().serializeToString(svgRef.current);
    const hwRows = (bom?.hardwareList || [])
      .map(
        (h) =>
          `<tr><td><code>${h.sku}</code></td><td>${h.name}</td><td style="text-align:right"><b>${h.quantity} ${h.unit}</b></td></tr>`
      )
      .join("");
    const stepRows = assemblyData.steps
      .map(
        (s) =>
          `<div style="margin-bottom:10px;padding:10px 12px;border:1px solid #cbd5e1;border-radius:10px;">
            <div style="font-weight:800;font-size:13px;color:#0f172a;">Adım ${s.num}: ${s.title} <span style="color:#0369a1;">[${s.partCodes.join(" ")}]</span></div>
            <div style="font-size:12px;color:#334155;margin-top:4px;">${s.detail}</div>
          </div>`
      )
      .join("");

    const html = `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"/><title>Birim Montaj Şeması — ${mod.name}</title>
      <style>body{font-family:-apple-system,Segoe UI,sans-serif;margin:24px;color:#141413}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:left}th{background:#f1f5f9}</style>
      </head><body>
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #141413;padding-bottom:12px;margin-bottom:16px;">
        <div><div style="font-size:22px;font-weight:900;letter-spacing:1px;">BİRİM® MONTAJ ŞEMASI &amp; KURULUM KILAVUZU</div>
        <div style="font-size:12px;color:#475569;">${project.title} • ${mod.name} (${assemblyData.W}×${assemblyData.H}×${assemblyData.D} mm) • ${assemblyData.joineryLabel}</div></div>
        <div style="font-family:monospace;font-size:12px;text-align:right;">Parça: ${assemblyData.modCutPieces.length} Adet<br/>CNC Delik: ${assemblyData.totalHoles} Adet</div>
      </div>
      <div style="text-align:center;margin-bottom:18px;border:1px solid #e2e8f0;border-radius:12px;padding:12px;background:#f8fafc;">${svgMarkup}</div>
      ${
        moduleGrainSequenceList.length > 0
          ? `<h3 style="margin:12px 0 8px;font-size:15px;color:#92400e;">Desen Takibi Cephe Montaj Sırası ve Suyolu Yön Tablosu</h3>
             <table style="margin-bottom:14px;"><thead><tr><th>Sıra</th><th>Cephe Parçası</th><th>Damar / Suyolu Yönü</th><th>Bitişik Komşu Parçalar</th></tr></thead><tbody>
             ${moduleGrainSequenceList
               .map(
                 (g) =>
                   `<tr><td><b>${g.shortSeqBadge}</b></td><td>${g.partShortLabel}</td><td><b>${g.directionLabelTr}</b></td><td>${g.compactNeighborTextTr}</td></tr>`
               )
               .join("")}
             </tbody></table>`
          : ""
      }
      <h3 style="margin:12px 0 8px;font-size:15px;">Montaj Adımları</h3>
      ${stepRows}
      <h3 style="margin:16px 0 8px;font-size:15px;">Hırdavat &amp; Bağlantı Elemanı Paketi</h3>
      <table><thead><tr><th>SKU</th><th>Bağlantı / Donanım Adı</th><th style="text-align:right">Miktar</th></tr></thead><tbody>${hwRows}</tbody></table>
      <script>window.onload=()=>setTimeout(()=>window.print(),250);</script></body></html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const hardwareItems = bom?.hardwareList || [];
  const totalHardwareQty = hardwareItems.reduce((acc, hw) => acc + (hw.quantity || 0), 0);

  return (
    <div
      data-testid="assembly-diagram-modal"
      onClick={onClose}
      className="fixed inset-0 z-[158] flex items-center justify-center bg-[#141413]/55 backdrop-blur-xs p-3 sm:p-5"
    >
      <div
        data-draggable-shell="assembly-diagram-modal"
        onClick={(e) => e.stopPropagation()}
        className="relative birim-ice-modal rounded-[28px] max-w-6xl w-full max-h-[92vh] flex flex-col overflow-hidden text-[#141413]"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Kapat"
          title="Kapat"
          className="absolute top-3.5 right-3.5 z-20 w-8 h-8 rounded-full bg-white/95 border border-[#D8D1C4] shadow-2xs flex items-center justify-center text-[#57534E] hover:text-[#141413] hover:bg-white cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header with Official Birim Logo */}
        <div
          onPointerDown={(e) => startZeroLagModalDrag(e)}
          title="Pencereyi taşımak için sürükleyin"
          className="px-5 py-3.5 pr-14 birim-ice-shell-header flex items-center justify-between gap-3 cursor-grab active:cursor-grabbing select-none"
        >
          <div className="flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
            <BirimLogo className="h-5 w-auto text-[#141413] shrink-0" />
            <div className="h-4 w-px bg-slate-900/15 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-bold text-[#141413] truncate">
                  Patlatılmış İzometrik Montaj Şeması &amp; Kurulum Kılavuzu
                </h2>
                {assemblyData.isCapsuleTambour && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-950 text-[10px] font-bold">
                    Kapsül / R-Köşeli Tambur Üretim Modeli
                  </span>
                )}
                {assemblyData.isCapsuleTable && (
                  <span className="px-2 py-0.5 rounded-full bg-sky-100 border border-sky-300 text-sky-950 text-[10px] font-bold">
                    Silindirik Sütunlu Kapsül Masa Modeli
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#57534E] truncate">
                {assemblyData.joineryLabel} • {assemblyData.modCutPieces.length} Kesim Parçası •{" "}
                {assemblyData.totalHoles} CNC Delik İşlemi
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {mainModules.length > 1 && (
              <V3PremiumDropdown
                variant="popover"
                size="sm"
                className="w-[210px]"
                value={String(selectedModIdx)}
                onChange={(val) => {
                  setSelectedModIdx(Number(val));
                  setActiveStep(0);
                }}
                options={mainModules.map((m, idx) => ({
                  value: String(idx),
                  label: `#${idx + 1} ${m.name}`,
                  badge: `${m.dimensions.width}mm`,
                }))}
              />
            )}
            <button
              type="button"
              onClick={downloadSvgDiagram}
              className="px-3 py-1.5 rounded-xl birim-ice-btn text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              title="Montaj Şemasını Vektörel SVG Olarak İndir"
            >
              <Download className="w-3.5 h-3.5" />
              <span>.SVG</span>
            </button>
            <button
              type="button"
              data-testid="print-assembly-manual-btn"
              onClick={printAssemblySheet}
              className="px-3.5 py-1.5 rounded-xl birim-ice-charcoal-pill text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-amber-300" />
              <span>A4 Montaj Föyü Yazdır</span>
            </button>
          </div>
        </div>

        {/* Body: Left Exploded Isometric CAD Diagram + Full-Height Hardware Bag | Right Step-by-Step Sequence */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 grid grid-cols-1 lg:grid-cols-12 items-stretch gap-4 text-xs">
          {/* Left 7 cols: Interactive Exploded Isometric SVG + Full-Stretch Hardware Bag */}
          <div className="lg:col-span-7 flex flex-col gap-3.5 h-full min-h-0">
            <div className="shrink-0 p-3.5 rounded-2xl bg-white border border-[#E5DFD3] shadow-2xs flex flex-col items-center">
              <div className="w-full flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#ECE7DC] mb-2">
                <span className="font-bold text-[#141413] flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-sky-700" />
                  <span>
                    {mod.name} — İzometrik Patlatılmış Parça Diyagramı ({assemblyData.W}×{assemblyData.H}×
                    {assemblyData.D} mm)
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setActiveStep(0)}
                  className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold cursor-pointer transition ${
                    activeStep === 0
                      ? "bg-[#141413] text-white"
                      : "bg-[#EFECE4] hover:bg-[#E5E0D5] text-[#44403C]"
                  }`}
                >
                  Tüm Parçaları Göster
                </button>
              </div>

              <svg
                ref={svgRef}
                viewBox="0 0 680 460"
                className="w-full h-auto max-h-[410px] select-none"
              >
                <defs>
                  <marker
                    id="asm-arrow"
                    viewBox="0 0 10 10"
                    refX="7"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#0284c7" />
                  </marker>
                  <marker
                    id="grain-vein-arrow"
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="5.5"
                    markerHeight="5.5"
                    orient="auto"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#b45309" />
                  </marker>
                  <marker
                    id="grain-flow-arrow"
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="5"
                    markerHeight="5"
                    orient="auto"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#d97706" />
                  </marker>
                </defs>

                {/* Subtle Warm Architectural CAD Grid Backdrop */}
                <rect x="8" y="8" width="664" height="444" rx="16" fill="#FAF8F4" stroke="#E5DFD3" />

                {/* Dynamic 3D-to-2D Isometric Exploded Parts (Painter's Order) */}
                {isoScene.renderedBoxes.map((box) => {
                  const active = isHighlighted(box.code);
                  const baseOpacity = box.opacity ?? 1;
                  return (
                    <g key={box.id} opacity={active ? baseOpacity : 0.16}>
                      {box.topPoly && (
                        <polygon
                          points={box.topPoly}
                          fill={box.topFill}
                          stroke={box.stroke}
                          strokeWidth={box.strokeWidth ?? 1.4}
                          strokeLinejoin="round"
                        />
                      )}
                      {box.rightPoly && (
                        <polygon
                          points={box.rightPoly}
                          fill={box.sideFill}
                          stroke={box.stroke}
                          strokeWidth={box.strokeWidth ?? 1.4}
                          strokeLinejoin="round"
                        />
                      )}
                      {box.frontPoly && (
                        <polygon
                          points={box.frontPoly}
                          fill={box.frontFill}
                          stroke={box.stroke}
                          strokeWidth={box.strokeWidth ?? 1.5}
                          strokeLinejoin="round"
                        />
                      )}
                      {box.trackGroovePoly && (
                        <polygon
                          points={box.trackGroovePoly}
                          fill="none"
                          stroke="#0369a1"
                          strokeWidth="1.35"
                          strokeDasharray="4 2.5"
                        />
                      )}
                      {box.slatLines.map((sl, sIdx) => (
                        <line
                          key={`slat-${sIdx}`}
                          x1={sl.x1}
                          y1={sl.y1}
                          x2={sl.x2}
                          y2={sl.y2}
                          stroke={sl.dashed ? "#7c2d12" : "#57534E"}
                          strokeWidth={sl.dashed ? "1" : "0.95"}
                          strokeDasharray={sl.dashed ? "3 2" : undefined}
                          opacity={0.78}
                        />
                      ))}
                      {box.grooveLine && (
                        <line
                          x1={box.grooveLine.x1}
                          y1={box.grooveLine.y1}
                          x2={box.grooveLine.x2}
                          y2={box.grooveLine.y2}
                          stroke="#7c2d12"
                          strokeWidth="1.2"
                          strokeDasharray="3 2"
                        />
                      )}
                      {box.sys32Pts.map((pt, idx) => (
                        <circle key={idx} cx={pt.cx} cy={pt.cy} r="1.7" fill="#0369a1" />
                      ))}
                      {box.hingeCups.map((cup, idx) => (
                        <circle
                          key={idx}
                          cx={cup.cx}
                          cy={cup.cy}
                          r="3.6"
                          fill="#f59e0b"
                          stroke="#78350f"
                          strokeWidth="1"
                        />
                      ))}
                      {box.handleLine && (
                        <line
                          x1={box.handleLine.x1}
                          y1={box.handleLine.y1}
                          x2={box.handleLine.x2}
                          y2={box.handleLine.y2}
                          stroke="#141413"
                          strokeWidth="2.8"
                          strokeLinecap="round"
                        />
                      )}
                      {box.grainBadgeOverlay && (
                        <g data-testid={`grain-seq-overlay-${box.id}`}>
                          <line
                            x1={box.grainBadgeOverlay.arrowFrom.x}
                            y1={box.grainBadgeOverlay.arrowFrom.y}
                            x2={box.grainBadgeOverlay.arrowTo.x}
                            y2={box.grainBadgeOverlay.arrowTo.y}
                            stroke="#b45309"
                            strokeWidth="1.8"
                            markerEnd="url(#grain-vein-arrow)"
                          />
                          <rect
                            x={box.grainBadgeOverlay.cx - 21}
                            y={box.grainBadgeOverlay.cy - 9}
                            width="42"
                            height="18"
                            rx="5"
                            fill="#78350f"
                            stroke="#fde68a"
                            strokeWidth="1.1"
                          />
                          <text
                            x={box.grainBadgeOverlay.cx}
                            y={box.grainBadgeOverlay.cy + 3.5}
                            textAnchor="middle"
                            fill="#fffbeb"
                            fontSize="9"
                            fontFamily="monospace"
                            fontWeight="900"
                          >
                            {box.grainBadgeOverlay.dirSymbol}
                            {box.grainBadgeOverlay.seqBadge}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}

                {/* Continuous Wood-Grain Inter-Panel Sequence Flow Arrows */}
                {isoScene.grainFlowLinks.map((lnk) => (
                  <line
                    key={lnk.id}
                    x1={lnk.from.x}
                    y1={lnk.from.y}
                    x2={lnk.to.x}
                    y2={lnk.to.y}
                    stroke="#d97706"
                    strokeWidth="1.35"
                    strokeDasharray="3 2.5"
                    markerEnd="url(#grain-flow-arrow)"
                    opacity={activeStep === 0 || activeStep === 4 || activeStep === 5 ? 0.88 : 0.15}
                  />
                ))}

                {/* Exploded Assembly Direction Arrows */}
                {isoScene.arrows.map((arr, idx) => (
                  <line
                    key={`arrow-${idx}`}
                    x1={arr.from.x}
                    y1={arr.from.y}
                    x2={arr.to.x}
                    y2={arr.to.y}
                    stroke="#0284c7"
                    strokeWidth="1.3"
                    strokeDasharray="4 3"
                    markerEnd="url(#asm-arrow)"
                    opacity={isHighlighted(arr.code) ? 0.9 : 0.18}
                  />
                ))}

                {/* Dynamic Part Number Callouts */}
                {isoScene.callouts.map((c) => {
                  const clampedX = Math.max(24, Math.min(545, c.x));
                  const clampedY = Math.max(24, Math.min(436, c.y));
                  return (
                    <g key={`callout-${c.num}`} opacity={isHighlighted(c.code) ? 1 : 0.2}>
                      <circle cx={clampedX} cy={clampedY} r="10.5" fill="#141413" />
                      <text
                        x={clampedX}
                        y={clampedY + 3.5}
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize="9.5"
                        fontWeight="800"
                      >
                        {c.num}
                      </text>
                      <rect
                        x={clampedX + 12}
                        y={clampedY - 8}
                        width={Math.min(138, Math.max(58, c.label.length * 5.6 + 10))}
                        height="16"
                        rx="4"
                        fill="#ffffff"
                        fillOpacity="0.88"
                        stroke="#E5DFD3"
                        strokeWidth="0.8"
                      />
                      <text
                        x={clampedX + 16}
                        y={clampedY + 3.2}
                        fill="#141413"
                        fontSize="9.2"
                        fontWeight="700"
                      >
                        {c.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Hardware & Fastener Bag Table — Stretches cleanly to bottom of modal! */}
            <div className="flex-1 min-h-[240px] p-4 rounded-2xl bg-white border border-[#E5DFD3] shadow-2xs flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#ECE7DC] shrink-0">
                <div className="font-bold text-[#141413] flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5 text-[#8C7A6B]" />
                  <span>Montaj Hırdavat &amp; Donanım Paketi Kontrol Listesi</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-[#F5F2EA] border border-[#E5DFD3] text-[10.5px] font-mono font-bold text-[#44403C]">
                  {hardwareItems.length} Kalem • {totalHardwareQty} Adet/Birim
                </span>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 auto-rows-max content-start gap-2">
                {hardwareItems.map((hw) => (
                  <div
                    key={hw.sku}
                    className="px-3 py-2 rounded-xl bg-[#FAF8F4] border border-[#E5DFD3] hover:border-[#C7BCAE] transition flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-[#141413] truncate text-[11px]" title={hw.name}>
                        {hw.name}
                      </div>
                      <div className="font-mono text-[9.5px] text-[#78716C]">{hw.sku}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded-lg bg-[#141413] text-white font-mono font-bold text-[10.5px] shrink-0">
                      {hw.quantity} {hw.unit}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right 5 cols: Interactive 6-Step Sequence + Canonical Safety Notes + Cartonization */}
          <div className="lg:col-span-5 flex flex-col gap-2.5 h-full">
            {!engReport.canExportToCncAndSaw && (
              <div
                data-testid="assembly-engineering-gate-alert"
                className="p-3 rounded-2xl bg-red-50 border border-red-300 text-red-950 text-[11px] space-y-1"
              >
                <div className="font-bold text-red-800">
                  Üretim &amp; Montaj Uyarısı ({engReport.blockingSafetyAndEngineeringErrors.length} Kritik Mühendislik Bulgusu)
                </div>
                <p className="leading-relaxed text-red-900">
                  {engReport.blockingSafetyAndEngineeringErrors[0]?.message}
                </p>
              </div>
            )}
            {canonicalFactorySteps
              .filter((cs) => cs.safetyWarning)
              .map((cs) => (
                <div
                  key={`canon-safe-${cs.stepNumber}`}
                  className="p-3 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 text-[11px]"
                >
                  <div className="font-bold text-amber-900">{cs.title}</div>
                  <div className="mt-0.5 leading-snug text-amber-900/90">{cs.safetyWarning}</div>
                </div>
              ))}
            {moduleGrainSequenceList.length > 0 && (
              <div
                data-testid="assembly-grain-sequence-card"
                className="p-3 rounded-2xl bg-amber-50/95 border border-amber-300 text-[#141413] space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-xs text-amber-950">
                    Desen Takibi Cephe Montaj Dizilimi ({moduleGrainSequenceList.length} Parça)
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-amber-900 text-amber-50 font-mono text-[10px] font-bold">
                    {moduleGrainSequenceList[0].directionLabelTr}
                  </span>
                </div>
                <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                  {moduleGrainSequenceList.map((g) => (
                    <div
                      key={g.componentId}
                      className="px-2 py-1 rounded-lg bg-white border border-amber-200 flex items-center justify-between gap-2 text-[10.5px]"
                    >
                      <span className="font-semibold text-slate-900">
                        <span className="font-mono font-black text-amber-900 mr-1">
                          {g.arrowSymbol} {g.shortSeqBadge}
                        </span>
                        {g.partShortLabel}
                      </span>
                      <span className="font-mono text-[9.5px] text-amber-900 shrink-0">
                        {g.compactNeighborTextTr}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#57534E] px-1">
              Adım Adım Kurulum Sırası (Diyagramda Vurgulamak İçin Adıma Tıklayın)
            </div>
            <div className="space-y-2">
              {assemblyData.steps.map((st) => {
                const selected = activeStep === st.num;
                return (
                  <button
                    key={st.num}
                    type="button"
                    data-testid={`assembly-step-card-${st.num}`}
                    onClick={() => setActiveStep(selected ? 0 : st.num)}
                    className={`w-full text-left p-3 rounded-2xl border transition cursor-pointer space-y-1 ${
                      selected
                        ? "bg-[#141413] text-white border-[#141413] shadow-md"
                        : "bg-white hover:bg-[#FAF8F4] text-[#141413] border-[#E5DFD3]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs flex items-center gap-1.5">
                        <span
                          className={`w-5 h-5 rounded-full text-[10px] font-mono font-black flex items-center justify-center shrink-0 ${
                            selected ? "bg-amber-400 text-[#141413]" : "bg-[#141413] text-white"
                          }`}
                        >
                          {st.num}
                        </span>
                        <span>{st.title}</span>
                      </span>
                      <span
                        className={`font-mono text-[10px] font-bold shrink-0 ${
                          selected ? "text-amber-300" : "text-sky-700"
                        }`}
                      >
                        {st.partCodes.join(" ")}
                      </span>
                    </div>
                    <p
                      className={`text-[11px] leading-relaxed pl-6 ${
                        selected ? "text-slate-200" : "text-[#57534E]"
                      }`}
                    >
                      {st.detail}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* V5 Flat-Pack Cartonization & Carrier Manifest */}
            {bom &&
              (() => {
                const manifest = computeProjectCartonization(project, bom);
                return (
                  <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="font-bold text-xs text-[#141413]">
                          Sevkiyat &amp; Koli Optimizasyonu ({manifest.totalCartons} Koli •{" "}
                          {manifest.totalGrossWeightKg} kg)
                        </div>
                        <div className="text-[10px] text-[#78716C]">
                          Maks. 28 kg tek kişi ergonomik paket sınırı + petek köşe koruyucu hesabı
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const csv = exportCartonManifestCsv(manifest);
                          const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `${project.title.replace(/[^a-zA-Z0-9_-]/g, "_")}_Koli_Sevkiyat_Listesi.csv`;
                          document.body.appendChild(a);
                          a.click();
                          setTimeout(() => {
                            if (a.parentNode) a.parentNode.removeChild(a);
                            URL.revokeObjectURL(url);
                          }, 500);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-[#141413] text-white text-[10.5px] font-bold cursor-pointer"
                      >
                        Koli .CSV İndir
                      </button>
                    </div>
                    <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                      {manifest.cartons.map((c) => (
                        <div
                          key={c.cartonCode}
                          className="px-2.5 py-1.5 rounded-xl bg-[#FAF8F4] border border-[#E5DFD3] flex items-center justify-between text-[10.5px]"
                        >
                          <div className="min-w-0">
                            <span className="font-mono font-bold text-[#141413]">{c.cartonCode}</span>{" "}
                            <span className="text-[#57534E]">• {c.moduleName}</span>
                          </div>
                          <span className="font-mono font-semibold text-[#44403C] shrink-0">
                            {c.outerLengthMm}×{c.outerWidthMm}mm • {c.grossWeightKg}kg
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

            <div className="mt-auto p-3 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-[11px] flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <span>
                {assemblyData.isCapsuleTambour
                  ? "Alt/üst tablalardaki 8.5×7.5 mm CNC tambur ray olukları (TAMBOUR_TRACK_W8_5_Z7_5), 32 mm kavisli kerf cep koridorları ve lamel açınımları CNC kesim paketiyle birebir senkronizedir."
                  : assemblyData.isCapsuleTable
                  ? "Silindirik kerf sütun açınımları, iç dairesel CNC kalıp diskleri, çelik sarkma traversi ve 5-eksen Swiss-Edge kapsül tabla koordinatları CNC kesim paketiyle birebir senkronizedir."
                  : "Tüm gövde kavela/minifiks eksenleri, 8 mm arkalık ve çekmece taban kanalları (LW − 30 mm) ile kapak/tambur ray koordinatları CNC kesim paketiyle birebir senkronizedir."}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
