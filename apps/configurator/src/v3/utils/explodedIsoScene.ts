import {
  calculateBayWidths,
  type GrainPartNeighborInfo,
  type ModuleInstance,
} from "@birim/core";

export type IsoShapeVariant =
  | "box"
  | "stadium_slab"
  | "curved_kerf_left"
  | "curved_kerf_right"
  | "tambour_curtain_left"
  | "tambour_curtain_right"
  | "tambour_curtain_vertical"
  | "pedestal_cylinder"
  | "pedestal_disc";

export interface IsoBoxSpec {
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
  bomRoleHint?: string;
}

export function projectIsoPoint(x: number, y: number, z: number): { u: number; v: number } {
  return {
    u: x - z * 0.42,
    v: -y + z * 0.24,
  };
}

export function computeModuleBayRanges(
  mod: ModuleInstance
): Array<{ x0: number; x1: number; width: number }> {
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

export function sampleRoundedRectLoopXZ(
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

export function isTambourDoor(door: ModuleInstance["bays"][number]["door"]): boolean {
  if (!door) return false;
  return (
    String(door.type) === "tambour" ||
    door.doorSystemId === "tambour_roller" ||
    String(door.doorSystemId) === "tambour"
  );
}

export function buildExplodedIsoBoxes(
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

  // 1. CAPSULE DINING / CONFERENCE TABLE (`capsule_table`)
  if (hull === "capsule_table") {
    const topThick = Math.max(25, Math.min(42, mod.carcass.panelThickness || 30));
    const colH = Math.max(420, H - topThick);
    const colD = Math.min(Math.round(D * 0.46), 420);
    const colR = colD / 2;
    const colOffset = Math.max(colR + 80, Math.round(W * 0.24));
    const leftCx = colOffset;
    const rightCx = W - colOffset;
    const stadiumR = D / 2;

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

  // 2. CAPSULE STADIUM & R-CORNER TAMBOUR CABINET / TV UNIT
  if (hull === "capsule_stadium" || hull === "rounded_corners") {
    const cornerR =
      hull === "capsule_stadium"
        ? D / 2
        : Math.max(65, Math.min(mod.carcass.cornerRadiusMm || 100, D / 2 - 10, W / 4));
    const hasTray =
      mod.carcass.hasCountertopTray !== false &&
      Boolean(mod.carcass.countertopMaterialId || hull === "capsule_stadium");
    const trayT = hasTray ? 20 : 0;
    const carcassTopY = H - trayT;
    const pocketCorridorMm = 32;
    const innerR = Math.max(40, cornerR - pocketCorridorMm);
    const straightX0 = cornerR;
    const straightX1 = Math.max(straightX0 + 80, W - cornerR);

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

    const innerBottomY = plinthH + T;
    const innerTopY = carcassTopY - T;
    mod.bays.forEach((bay, bIdx) => {
      const range = bayRanges[bIdx];
      if (!range) return;

      (bay.shelves || []).forEach((shelf, sIdx) => {
        if (shelf.isHidden) return;
        const shT = shelf.thickness || T;
        const sy = Math.min(
          innerTopY - shT,
          Math.max(innerBottomY + 24, innerBottomY + shelf.elevationY)
        );
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

  // 2B. TRUE L-CORNER CABINET / WALK-IN L WARDROBE (`isCorner`, non-blind, non-diagonal)
  const tplLcCheck = (mod.templateId || "").toLowerCase();
  const nameLcCheck = (mod.name || "").toLowerCase();
  const isDiagCorner =
    Boolean(mod.isCorner) &&
    (tplLcCheck.includes("diagonal") || nameLcCheck.includes("diyagonal") || nameLcCheck.includes("45°")) &&
    W >= 500 &&
    D >= 500;
  const isTrueLCorner =
    Boolean(mod.isCorner) &&
    !tplLcCheck.includes("blind") &&
    !nameLcCheck.includes("kör") &&
    !isDiagCorner &&
    W >= 600 &&
    D >= 600;

  if (isTrueLCorner || isDiagCorner) {
    const isWardrobeL =
      mod.category.startsWith("wardrobe") ||
      mod.moduleFamilyId === "fam_wardrobe" ||
      H >= 1400;
    const minArm = Math.min(W, D);
    const wingD = isWallCab
      ? minArm >= 580
        ? 350
        : Math.min(350, Math.round(minArm * 0.56))
      : isWardrobeL
      ? minArm >= 920
        ? 600
        : Math.min(600, Math.round(minArm * 0.58))
      : minArm >= 780
      ? 580
      : Math.min(580, Math.round(minArm * 0.64));
    const retZ0 = wingD;
    const retZ1 = D - T;
    const exX = Math.round(explodeX * 0.55);
    const exY = Math.round(explodeY * 0.65);
    const exZ = Math.round(explodeZ * 0.55);

    // ⑥ L-Arkalık (Ana Kol X + Dönüş Kolu Z)
    if (mod.carcass.backPanelType !== "none") {
      boxes.push({
        id: "l-back-main",
        code: "⑥",
        x0: T,
        y0: plinthH + T,
        z0: -exZ,
        x1: W - T,
        y1: H - T,
        z1: -exZ + backT,
        frontFill: "#E7E2D8",
        sideFill: "#D6CFC2",
        topFill: "#F2EFE9",
        stroke: "#57534E",
        strokeWidth: 1.2,
        kind: "back",
      });
      boxes.push({
        id: "l-back-return",
        code: "⑥",
        x0: -exX * 1.15,
        y0: plinthH + T,
        z0: T,
        x1: -exX * 1.15 + backT,
        y1: H - T,
        z1: D - T,
        frontFill: "#DDD7CB",
        sideFill: "#CFC8BA",
        topFill: "#EAE6DD",
        stroke: "#57534E",
        strokeWidth: 1.2,
        kind: "back",
      });
    }

    // ⑦ L-Köşe Baza (Ana X Kolu + Dönüş Z Kolu)
    if (!isWallCab && plinthH > 0) {
      const pSet = 35;
      boxes.push(
        {
          id: "l-plinth-x",
          code: "⑦",
          x0: 0,
          y0: -exY * 0.85,
          z0: 0,
          x1: W,
          y1: plinthH - exY * 0.85,
          z1: Math.max(120, wingD - pSet),
          frontFill: "#CBD5E1",
          sideFill: "#94A3B8",
          topFill: "#E2E8F0",
          stroke: "#334155",
          strokeWidth: 1.3,
          kind: "plinth",
        },
        {
          id: "l-plinth-z",
          code: "⑦",
          x0: 0,
          y0: -exY * 0.85,
          z0: Math.max(120, wingD - pSet),
          x1: Math.max(120, wingD - pSet),
          y1: plinthH - exY * 0.85,
          z1: D,
          frontFill: "#CBD5E1",
          sideFill: "#94A3B8",
          topFill: "#E2E8F0",
          stroke: "#334155",
          strokeWidth: 1.3,
          kind: "plinth",
        }
      );
    }

    // ③ L-Köşe Alt Tabla (Ana Kol + Dönüş Kolu)
    boxes.push(
      {
        id: "l-bottom-main",
        code: "③",
        x0: T,
        y0: plinthH - exY * 0.35,
        z0: 0,
        x1: W - T,
        y1: plinthH + T - exY * 0.35,
        z1: wingD,
        frontFill: "#D6B792",
        sideFill: "#BE9B72",
        topFill: "#E7CFAF",
        stroke: "#44403C",
        strokeWidth: 1.4,
        kind: "carcass",
      },
      {
        id: "l-bottom-return",
        code: "③",
        x0: T,
        y0: plinthH - exY * 0.35,
        z0: retZ0,
        x1: wingD,
        y1: plinthH + T - exY * 0.35,
        z1: retZ1,
        frontFill: "#D6B792",
        sideFill: "#BE9B72",
        topFill: "#E7CFAF",
        stroke: "#44403C",
        strokeWidth: 1.4,
        kind: "carcass",
      }
    );

    // ④ L-Köşe Üst Tabla (Ana Kol + Dönüş Kolu)
    boxes.push(
      {
        id: "l-top-main",
        code: "④",
        x0: T,
        y0: H - T + exY * 0.55,
        z0: 0,
        x1: W - T,
        y1: H + exY * 0.55,
        z1: wingD,
        frontFill: "#D6B792",
        sideFill: "#BE9B72",
        topFill: "#E7CFAF",
        stroke: "#44403C",
        strokeWidth: 1.4,
        kind: "carcass",
      },
      {
        id: "l-top-return",
        code: "④",
        x0: T,
        y0: H - T + exY * 0.55,
        z0: retZ0,
        x1: wingD,
        y1: H + exY * 0.55,
        z1: retZ1,
        frontFill: "#D6B792",
        sideFill: "#BE9B72",
        topFill: "#E7CFAF",
        stroke: "#44403C",
        strokeWidth: 1.4,
        kind: "carcass",
      }
    );

    // ① Köşe Sol Dış Boy Dikme (tam derinlik D)
    boxes.push({
      id: "l-side-left-outer",
      code: "①",
      x0: -exX * 0.58,
      y0: plinthH,
      z0: 0,
      x1: T - exX * 0.58,
      y1: H,
      z1: D,
      frontFill: "#C9A276",
      sideFill: "#B2885A",
      topFill: "#DFC19C",
      stroke: "#44403C",
      strokeWidth: 1.5,
      kind: "carcass",
    });

    // ② Köşe Sağ Bitiş Dikmesi (X Kolu)
    boxes.push({
      id: "l-side-right-end",
      code: "②",
      x0: W - T + exX * 0.62,
      y0: plinthH,
      z0: 0,
      x1: W + exX * 0.62,
      y1: H,
      z1: wingD,
      frontFill: "#C9A276",
      sideFill: "#B2885A",
      topFill: "#DFC19C",
      stroke: "#44403C",
      strokeWidth: 1.5,
      kind: "carcass",
    });

    // ⑤ Köşe Ön Dönüş Bitiş Dikmesi (Z Kolu)
    boxes.push({
      id: "l-side-front-return",
      code: "⑤",
      x0: T,
      y0: plinthH,
      z0: D - T + exZ * 0.65,
      x1: wingD,
      y1: H,
      z1: D + exZ * 0.65,
      frontFill: "#C9A276",
      sideFill: "#B2885A",
      topFill: "#DFC19C",
      stroke: "#44403C",
      strokeWidth: 1.5,
      kind: "carcass",
    });

    // ⑧ L-Köşe Rafları & Askı Boruları
    const b0 = mod.bays[0];
    (b0?.shelves || []).forEach((sh, sIdx) => {
      const sy = plinthH + T + sh.elevationY;
      const shT = sh.thickness || T;
      boxes.push(
        {
          id: `l-shelf-main-${sIdx}`,
          code: "⑧",
          x0: T + 2,
          y0: sy,
          z0: 14,
          x1: W - T - 2,
          y1: sy + shT,
          z1: wingD - 14,
          frontFill: "#E2E8F0",
          sideFill: "#CBD5E1",
          topFill: "#F8FAFC",
          stroke: "#475569",
          strokeWidth: 1.2,
          kind: "shelf",
        },
        {
          id: `l-shelf-return-${sIdx}`,
          code: "⑧",
          x0: T + 14,
          y0: sy,
          z0: wingD - 14,
          x1: wingD - 14,
          y1: sy + shT,
          z1: D - T - 2,
          frontFill: "#E2E8F0",
          sideFill: "#CBD5E1",
          topFill: "#F8FAFC",
          stroke: "#475569",
          strokeWidth: 1.2,
          kind: "shelf",
        }
      );
    });
    (b0?.hangingRails || []).forEach((rl, rIdx) => {
      const ry = plinthH + T + rl.elevationY;
      boxes.push({
        id: `l-rail-${rIdx}`,
        code: "⑧",
        x0: T + 16,
        y0: ry,
        z0: wingD * 0.5 - 12,
        x1: W - T - 16,
        y1: ry + 26,
        z1: wingD * 0.5 + 12,
        frontFill: "#94A3B8",
        sideFill: "#64748B",
        topFill: "#CBD5E1",
        stroke: "#334155",
        strokeWidth: 1.2,
        kind: "rail",
      });
    });

    // ⑩ L-Köşe Kapaklar (açık giyinme değilse)
    const hasCornerDoors = !mod.isOpenFront && b0?.door?.type !== "open" && b0?.door?.doorSystemId !== "open";
    if (hasCornerDoors) {
      boxes.push(
        {
          id: "l-door-x",
          code: "⑩",
          x0: wingD,
          y0: plinthH + 2,
          z0: wingD + exZ * 0.85,
          x1: W - 2,
          y1: H - 2,
          z1: wingD + exZ * 0.85 + 18,
          frontFill: "#F8FAFC",
          sideFill: "#E2E8F0",
          topFill: "#FFFFFF",
          stroke: "#0284C7",
          strokeWidth: 1.3,
          opacity: 0.46,
          kind: "door",
        },
        {
          id: "l-door-z",
          code: "⑩",
          x0: wingD + exX * 0.85,
          y0: plinthH + 2,
          z0: wingD,
          x1: wingD + exX * 0.85 + 18,
          y1: H - 2,
          z1: D - 2,
          frontFill: "#F8FAFC",
          sideFill: "#E2E8F0",
          topFill: "#FFFFFF",
          stroke: "#0284C7",
          strokeWidth: 1.3,
          opacity: 0.46,
          kind: "door",
        }
      );
    }

    boxes.sort((a, b) => {
      const da = ((a.z0 + a.z1) / 2) * 1.0 + ((a.y0 + a.y1) / 2) * 0.35 + ((a.x0 + a.x1) / 2) * 0.12;
      const db = ((b.z0 + b.z1) / 2) * 1.0 + ((b.y0 + b.y1) / 2) * 0.35 + ((b.x0 + b.x1) / 2) * 0.12;
      return da - db;
    });

    return { boxes, explodeX, explodeY, explodeZ, explodeDrawerZ, explodeDoorZ, bayRanges };
  }

  // 3. STANDARD RECTANGULAR CABINET (WITH HINGED, SLIDING, LIFT OR TAMBOUR DOORS)
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
    bomRoleHint: "carcass_back",
  });

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
      bomRoleHint: "plinth",
    });
  }

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
    bomRoleHint: "carcass_side_left",
  });

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
    hasSys32: true,
    bomRoleHint: "carcass_side_right",
  });

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
    bomRoleHint: "carcass_bottom",
  });

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
      bomRoleHint: "carcass_top",
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
      bomRoleHint: "carcass_top",
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
      bomRoleHint: "carcass_top",
    });
  }

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
      hasSys32: true,
      bomRoleHint: "carcass_divider",
    });
  }

  const innerBottomY = plinthH + T;
  const innerTopY = H - T;

  mod.bays.forEach((bay, bIdx) => {
    const range = bayRanges[bIdx];
    if (!range) return;

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
        bomRoleHint: "shelf",
      });
    });

    (bay.hangingRails || []).forEach((rail, rIdx) => {
      if (rail.isHidden) return;
      const ry = Math.min(
        innerTopY - 30,
        Math.max(innerBottomY + 20, innerBottomY + rail.elevationY)
      );
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
        bomRoleHint: "drawer_side",
      });

      boxes.push({
        id: `drawer-front-${bIdx}-${dIdx}`,
        code: "⑨",
        x0: drw.isInternal ? range.x0 + 10 : range.x0 - (bIdx === 0 ? T - 2 : T / 2 - 1),
        y0: dy0 + 2,
        z0: D - 18 + zShift,
        x1: drw.isInternal
          ? range.x1 - 10
          : range.x1 + (bIdx === mod.bays.length - 1 ? T - 2 : T / 2 - 1),
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
        bomRoleHint: "drawer_front",
      });
    });

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
            slatCount: Math.max(
              10,
              Math.min(26, Math.round((innerTopY - cassetteH - doorY0) / 28))
            ),
            hingeSide: "none",
            handlePos: "bottom-center",
            grainLookupKeys: [door.id, `${door.id}_tambour_curtain`],
            bomRoleHint: "door_sliding",
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
            bomRoleHint: "door_left",
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
            bomRoleHint: "door_left",
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
            bomRoleHint: "door_left",
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
            bomRoleHint: door.type === "sliding" ? "door_sliding" : "door_left",
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
            bomRoleHint: door.type === "sliding" ? "door_sliding" : "door_right",
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
            bomRoleHint: hingeRight ? "door_right" : "door_left",
          });
        }
      }
    }
  });

  // Mutfak Adası: üstte patlatılmış 38mm Kuvars Tezgâh plakası
  if (mod.category === "kitchen_island") {
    boxes.push({
      id: "island-countertop-slab",
      code: "④",
      x0: -25,
      y0: H + explodeY * 1.15,
      z0: -25,
      x1: W + 25,
      y1: H + 38 + explodeY * 1.15,
      z1: D + 25,
      frontFill: "#E2E8F0",
      sideFill: "#CBD5E1",
      topFill: "#F8FAFC",
      stroke: "#334155",
      strokeWidth: 1.5,
      kind: "carcass",
    });
  }

  // Kör Köşe Dolabı: kör tarafta sabit ön kapama paneli
  if (tplLcCheck.includes("blind") || nameLcCheck.includes("kör köşe") || nameLcCheck.includes("lemans")) {
    boxes.push({
      id: "blind-corner-front-filler",
      code: "⑤",
      x0: 0,
      y0: plinthH,
      z0: D + explodeDoorZ * 0.45,
      x1: Math.round(W * 0.48),
      y1: H,
      z1: D + explodeDoorZ * 0.45 + T,
      frontFill: "#CBD5E1",
      sideFill: "#94A3B8",
      topFill: "#E2E8F0",
      stroke: "#475569",
      strokeWidth: 1.3,
      kind: "carcass",
    });
  }

  boxes.sort((a, b) => {
    const da = ((a.z0 + a.z1) / 2) * 1.0 + ((a.x0 + a.x1) / 2) * 0.35 + ((a.y0 + a.y1) / 2) * 0.12;
    const db = ((b.z0 + b.z1) / 2) * 1.0 + ((b.x0 + b.x1) / 2) * 0.35 + ((b.y0 + b.y1) / 2) * 0.12;
    return da - db;
  });

  return { boxes, explodeX, explodeY, explodeZ, explodeDrawerZ, explodeDoorZ, bayRanges };
}

export interface RenderedExplodedIsoBox extends IsoBoxSpec {
  frontPoly: string;
  rightPoly: string;
  topPoly: string;
  trackGroovePoly: string;
  slatLines: Array<{ x1: number; y1: number; x2: number; y2: number; dashed?: boolean }>;
  handleLine: { x1: number; y1: number; x2: number; y2: number } | null;
  hingeCups: Array<{ cx: number; cy: number }>;
  sys32Pts: Array<{ cx: number; cy: number }>;
  grooveLine: { x1: number; y1: number; x2: number; y2: number } | null;
  grainInfo?: GrainPartNeighborInfo;
  grainBadgeOverlay: {
    cx: number;
    cy: number;
    seqBadge: string;
    arrowFrom: { x: number; y: number };
    arrowTo: { x: number; y: number };
    dirSymbol: string;
  } | null;
  anchorSvg: { x: number; y: number };
}

export interface ExplodedIsoArrow {
  code: string;
  stepNo: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

export interface ExplodedIsoCallout {
  code: string;
  num: string;
  label: string;
  x: number;
  y: number;
}

export interface ExplodedIsoSceneResult {
  renderedBoxes: RenderedExplodedIsoBox[];
  arrows: ExplodedIsoArrow[];
  callouts: ExplodedIsoCallout[];
  grainFlowLinks: Array<{ id: string; from: { x: number; y: number }; to: { x: number; y: number } }>;
  explodeX: number;
  explodeY: number;
  explodeZ: number;
  explodeDrawerZ: number;
  explodeDoorZ: number;
  toSvg: (x: number, y: number, z: number) => { x: number; y: number };
}

export interface ExplodedIsoSceneOptions {
  svgX?: number;
  svgY?: number;
  svgW: number;
  svgH: number;
  padX: number;
  padY: number;
  grainNeighborMap?: Map<string, GrainPartNeighborInfo>;
  sys32Count?: number;
}

export function buildExplodedIsoScene(
  mod: ModuleInstance,
  options: ExplodedIsoSceneOptions
): ExplodedIsoSceneResult {
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
  const isWallCab = !isCapsuleTable && (mod.category === "kitchen_wall" || (mod.position.y || 0) >= 1100);
  const plinthH = isWallCab ? 0 : mod.carcass.plinthHeight ?? 80;
  const topStretcherMode =
    !isCapsuleTambour &&
    !isCapsuleTable &&
    mod.category === "kitchen_base" &&
    mod.carcass.topConstruction === "stretcher_90mm";
  const bayCount = Math.max(1, mod.bays.length);
  const dividerCount = Math.max(0, bayCount - 1);
  const shelfCount = mod.bays.reduce((s, b) => s + (b.shelves?.length || 0), 0);
  const drawerCount = mod.bays.reduce((s, b) => s + (b.drawers?.length || 0), 0);
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
          (b.door.type === "double" || b.door.doorSystemId === "hinged_double" || b.door.type === "sliding"
            ? 2
            : 1)
        );
      }, 0);

  const { boxes, explodeX, explodeY, explodeZ, explodeDrawerZ, explodeDoorZ } =
    buildExplodedIsoBoxes(mod, isWallCab, topStretcherMode);

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

  const baseX = options.svgX ?? 0;
  const baseY = options.svgY ?? 0;
  const { svgW, svgH, padX, padY } = options;
  const spanU = Math.max(1, maxU - minU);
  const spanV = Math.max(1, maxV - minV);
  const scale = Math.min((svgW - 2 * padX) / spanU, (svgH - 2 * padY) / spanV);
  const offsetX = baseX + (svgW - spanU * scale) / 2 - minU * scale;
  const offsetY = baseY + (svgH - spanV * scale) / 2 - minV * scale;

  const toSvg = (x: number, y: number, z: number) => {
    const p = projectIsoPoint(x, y, z);
    return {
      x: Math.round((p.u * scale + offsetX) * 10) / 10,
      y: Math.round((p.v * scale + offsetY) * 10) / 10,
    };
  };

  const ptsStr = (pts: Array<{ x: number; y: number }>) => pts.map((p) => `${p.x},${p.y}`).join(" ");
  const grainNeighborMap = options.grainNeighborMap;
  const sys32DotsCount = options.sys32Count ?? 5;

  const renderedBoxes: RenderedExplodedIsoBox[] = boxes.map((b) => {
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
        const a = isLeft ? Math.PI / 2 + (Math.PI * i) / steps : -Math.PI / 2 + (Math.PI * i) / steps;
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
        const cx = b.x0 + r;
        const cz = b.z1 - r;
        for (let i = 0; i <= arcSegs; i++) {
          const a = Math.PI + ((-Math.PI / 2) * i) / arcSegs;
          pathXZ.push({ x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r });
        }
        const straightSteps = 8;
        for (let s = 1; s <= straightSteps; s++) {
          const sx = cx + ((b.x1 - cx) * s) / straightSteps;
          pathXZ.push({ x: sx, z: b.z1 });
        }
      } else {
        const cx = b.x1 - r;
        const cz = b.z1 - r;
        const straightSteps = 8;
        for (let s = 0; s <= straightSteps; s++) {
          const sx = b.x0 + ((cx - b.x0) * s) / straightSteps;
          pathXZ.push({ x: sx, z: b.z1 });
        }
        for (let i = 1; i <= arcSegs; i++) {
          const a = Math.PI / 2 - ((Math.PI / 2) * i) / arcSegs;
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
        const frac = 0.06 + (0.88 * ci) / (cupCount - 1);
        const cp = toSvg(cupX, b.y0 + hSpan * frac, b.z1 + 2);
        hingeCups.push({ cx: cp.x, cy: cp.y });
      }
    }

    const sys32Pts: Array<{ cx: number; cy: number }> = [];
    let grooveLine: { x1: number; y1: number; x2: number; y2: number } | null = null;
    if (b.hasSys32) {
      const ySpan = Math.max(120, b.y1 - b.y0 - 120);
      for (let i = 0; i < sys32DotsCount; i++) {
        const sy = b.y0 + 60 + (ySpan * i) / Math.max(1, sys32DotsCount - 1);
        const sp = toSvg(b.x1 + 1, sy, b.z1 - 35);
        sys32Pts.push({ cx: sp.x, cy: sp.y });
      }
      const g1 = toSvg(b.x1 + 1, b.y0 + 10, b.z0 + 20);
      const g2 = toSvg(b.x1 + 1, b.y1 - 10, b.z0 + 20);
      grooveLine = { x1: g1.x, y1: g1.y, x2: g2.x, y2: g2.y };
    }

    let grainInfo: GrainPartNeighborInfo | undefined;
    if (grainNeighborMap && b.grainLookupKeys) {
      for (const k of b.grainLookupKeys) {
        const hit = grainNeighborMap.get(k) || grainNeighborMap.get(`P_${mod.id}_${k}`);
        if (hit && hit.moduleId === mod.id) {
          grainInfo = hit;
          break;
        }
      }
    }

    let grainBadgeOverlay: RenderedExplodedIsoBox["grainBadgeOverlay"] = null;
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

    const anchorSvg = toSvg((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, b.z1);

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
      anchorSvg,
    };
  });

  const grainFlowLinks: ExplodedIsoSceneResult["grainFlowLinks"] = [];
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

  const midY = (plinthH + H) / 2;
  let arrows: ExplodedIsoArrow[];
  let callouts: ExplodedIsoCallout[];

  if (isCapsuleTable) {
    arrows = [
      { code: "①", stepNo: 2, from: toSvg(W * 0.22 - explodeX * 0.42, H * 0.45, D / 2), to: toSvg(W * 0.24, H * 0.45, D / 2) },
      { code: "②", stepNo: 2, from: toSvg(W * 0.78 + explodeX * 0.42, H * 0.45, D / 2), to: toSvg(W * 0.76, H * 0.45, D / 2) },
      { code: "④", stepNo: 5, from: toSvg(W / 2, H + explodeY * 1.1, D / 2), to: toSvg(W / 2, H - 20, D / 2) },
      { code: "⑦", stepNo: 1, from: toSvg(W * 0.24, -explodeY * 0.65, D / 2), to: toSvg(W * 0.24, 10, D / 2) },
    ];
    callouts = [
      { code: "①", num: "1", label: "Sol Yivli Kerf Sütun", ...toSvg(-explodeX * 0.36, H * 0.62, D * 0.5) },
      { code: "②", num: "2", label: "Sağ Yivli Kerf Sütun", ...toSvg(W + explodeX * 0.25, H * 0.62, D * 0.4) },
      { code: "③", num: "3", label: "Üst Flanş & Kalıp Diski", ...toSvg(W * 0.18, H + explodeY * 0.42, D * 0.3) },
      { code: "④", num: "4", label: "5-Eksen Kapsül Tabla", ...toSvg(W * 0.35, H + explodeY * 1.38, D * 0.45) },
      { code: "⑤", num: "5", label: "Çelik Sarkma Traversi", ...toSvg(W * 0.52, H + explodeY * 0.65, D * 0.5) },
      { code: "⑦", num: "7", label: "Alt Disk & M8 Pabuç", ...toSvg(W * 0.22, -explodeY * 0.85, D * 0.65) },
    ];
  } else if (isCapsuleTambour) {
    arrows = [
      { code: "①", stepNo: 2, from: toSvg(-explodeX * 0.55, midY, D / 2), to: toSvg(40, midY, D / 2) },
      { code: "②", stepNo: 2, from: toSvg(W + explodeX * 0.55, midY, D / 2), to: toSvg(W - 40, midY, D / 2) },
      { code: "④", stepNo: 3, from: toSvg(W / 2, H + explodeY * 0.85, D / 2), to: toSvg(W / 2, H - 20, D / 2) },
      ...(hasTray
        ? [{ code: "⑪", stepNo: 6, from: toSvg(W * 0.62, H + explodeY * 1.55, D / 2), to: toSvg(W * 0.62, H + explodeY * 0.98, D / 2) }]
        : []),
      { code: "⑥", stepNo: 3, from: toSvg(W / 2, midY, -explodeZ * 0.8), to: toSvg(W / 2, midY, 10) },
      ...(hasDoors
        ? [
            { code: "⑩", stepNo: 6, from: toSvg(W * 0.22, midY, D + explodeDoorZ * 0.62), to: toSvg(W * 0.24, midY, D) },
            { code: "⑩", stepNo: 6, from: toSvg(W * 0.78, midY, D + explodeDoorZ * 0.62), to: toSvg(W * 0.76, midY, D) },
          ]
        : []),
      ...(!isWallCab && plinthH > 0
        ? [{ code: "⑦", stepNo: 1, from: toSvg(W * 0.5, -explodeY * 0.75, D / 2), to: toSvg(W * 0.5, plinthH, D / 2) }]
        : []),
    ];
    callouts = [
      { code: "①", num: "1", label: "Sol Kavisli Kerf Cep", ...toSvg(-explodeX * 0.78, H * 0.72, D * 0.45) },
      { code: "②", num: "2", label: "Sağ Kavisli Kerf Cep", ...toSvg(W + explodeX * 0.52, H * 0.72, D * 0.35) },
      { code: "③", num: "3", label: "CNC Ray Oluklu Alt Tabla", ...toSvg(W * 0.12, plinthH - 22, D * 1.04) },
      { code: "④", num: "4", label: "CNC Ray Oluklu Üst Tabla", ...toSvg(W * 0.16, H + explodeY * 1.05, D * 0.35) },
      { code: "⑤", num: "5", label: "Taşıyıcı & Bölme Dikmesi", ...toSvg(W * 0.45, H * 0.78, D * 0.45) },
      { code: "⑥", num: "6", label: "Orta Düz Arkalık", ...toSvg(W * 0.68, H + 85, -explodeZ * 0.85) },
      ...(!isWallCab && plinthH > 0
        ? [{ code: "⑦", num: "7", label: `Torna Ayak (${plinthH}mm)`, ...toSvg(W * 0.45, -explodeY * 0.95, D * 0.75) }]
        : []),
      ...(shelfCount > 0
        ? [{ code: "⑧", num: "8", label: `Bölme Rafı (${shelfCount}x)`, ...toSvg(W * 0.36, midY - 10, D * 0.5) }]
        : []),
      ...(drawerCount > 0
        ? [{ code: "⑨", num: "9", label: `Çekmece (${drawerCount}x)`, ...toSvg(W * 0.48, plinthH + 35, D + explodeDrawerZ * 0.9) }]
        : []),
      ...(hasDoors
        ? [{ code: "⑩", num: "10", label: "Kavisli Tambur Perde (2x)", ...toSvg(W * 0.74, H * 0.36, D + explodeDoorZ * 0.75) }]
        : []),
      ...(hasTray
        ? [{ code: "⑪", num: "11", label: "20mm Mermer Üst Tabla", ...toSvg(W * 0.54, H + explodeY * 1.82, D * 0.45) }]
        : []),
    ];
  } else if (
    Boolean(mod.isCorner) &&
    !(mod.templateId || "").toLowerCase().includes("blind") &&
    !(mod.name || "").toLowerCase().includes("kör") &&
    W >= 500 &&
    D >= 500
  ) {
    const exX = Math.round(explodeX * 0.55);
    const exY = Math.round(explodeY * 0.65);
    const exZ = Math.round(explodeZ * 0.55);
    arrows = [
      { code: "①", stepNo: 2, from: toSvg(-exX * 0.58 + 20, midY, D * 0.5), to: toSvg(0, midY, D * 0.5) },
      { code: "②", stepNo: 2, from: toSvg(W + exX * 0.62 - 20, midY, D * 0.3), to: toSvg(W, midY, D * 0.3) },
      { code: "⑤", stepNo: 2, from: toSvg(W * 0.3, midY, D + exZ * 0.65 - 20), to: toSvg(W * 0.3, midY, D) },
      { code: "④", stepNo: 2, from: toSvg(W * 0.45, H + exY * 0.55 - 15, D * 0.3), to: toSvg(W * 0.45, H, D * 0.3) },
      { code: "⑥", stepNo: 3, from: toSvg(W * 0.5, midY, -exZ + 20), to: toSvg(W * 0.5, midY, 0) },
      ...(!isWallCab && plinthH > 0
        ? [{ code: "⑦", stepNo: 1, from: toSvg(W * 0.4, plinthH - exY * 0.85 + 15, D * 0.3), to: toSvg(W * 0.4, plinthH, D * 0.3) }]
        : []),
    ];
    callouts = [
      { code: "①", num: "1", label: `Sol Dış Boy Dikme (${T}mm)`, ...toSvg(-exX * 0.58 - 25, H * 0.78, D * 0.45) },
      { code: "②", num: "2", label: `Sağ X Bitiş Dikmesi`, ...toSvg(W + exX * 0.62 + 25, H * 0.76, D * 0.25) },
      { code: "③", num: "3", label: "L-Alt Tabla (Tek Parça CNC)", ...toSvg(W * 0.2, plinthH - exY * 0.35, D * 0.75) },
      { code: "④", num: "4", label: "L-Üst Tabla (Tek Parça CNC)", ...toSvg(W * 0.3, H + exY * 0.55 + 45, D * 0.3) },
      { code: "⑤", num: "5", label: "Ön Z Dönüş Dikmesi", ...toSvg(W * 0.35, H * 0.36, D + exZ * 0.65) },
      ...(mod.carcass.backPanelType !== "none"
        ? [{ code: "⑥", num: "6", label: `${backT}mm L-Arkalık (2x)`, ...toSvg(W * 0.65, H * 0.88, -exZ) }]
        : []),
      ...(!isWallCab && plinthH > 0
        ? [{ code: "⑦", num: "7", label: `L-Köşe Baza (${plinthH}mm)`, ...toSvg(W * 0.35, -exY * 0.85, D * 0.4) }]
        : []),
      ...(shelfCount > 0
        ? [{ code: "⑧", num: "8", label: `L-Raf Tek Parça CNC (${shelfCount}x)`, ...toSvg(W * 0.42, H * 0.56, D * 0.42) }]
        : []),
      ...(hasDoors
        ? [{ code: "⑩", num: "10", label: "L-Köşe Kapak (2x)", ...toSvg(W * 0.72, H * 0.42, D + exZ * 0.85) }]
        : []),
    ];
  } else {
    arrows = [
      { code: "①", stepNo: 2, from: toSvg(-explodeX + 20, midY, D / 2), to: toSvg(0, midY, D / 2) },
      { code: "②", stepNo: 2, from: toSvg(W + explodeX - 20, midY, D / 2), to: toSvg(W, midY, D / 2) },
      { code: "④", stepNo: 3, from: toSvg(W / 2, H + explodeY - 20, D / 2), to: toSvg(W / 2, H, D / 2) },
      { code: "⑥", stepNo: 3, from: toSvg(W / 2, midY, -explodeZ + 20), to: toSvg(W / 2, midY, 0) },
      ...(hasDoors
        ? [{ code: "⑩", stepNo: 6, from: toSvg(W * 0.72, midY, D + explodeDoorZ - 25), to: toSvg(W * 0.72, midY, D + 10) }]
        : []),
      ...(drawerCount > 0
        ? [{ code: "⑨", stepNo: 5, from: toSvg(W * 0.65, plinthH + 180, D + explodeDrawerZ - 20), to: toSvg(W * 0.65, plinthH + 180, D + 10) }]
        : []),
      ...(!isWallCab && plinthH > 0
        ? [{ code: "⑦", stepNo: 1, from: toSvg(W / 2, plinthH - explodeY + 15, D / 2), to: toSvg(W / 2, plinthH, D / 2) }]
        : []),
    ];

    callouts = [
      { code: "①", num: "1", label: `Sol Dikme (${T}mm)`, ...toSvg(-explodeX - 40, H * 0.85, D * 0.35) },
      { code: "②", num: "2", label: `Sağ Dikme (${T}mm)`, ...toSvg(W + explodeX + 35, H * 0.82, D * 0.2) },
      { code: "③", num: "3", label: "Alt Tabla", ...toSvg(W * 0.15, plinthH - 25, D * 1.05) },
      {
        code: "④",
        num: "4",
        label: topStretcherMode ? "90mm Kayıt" : "Üst Tabla",
        ...toSvg(W * 0.25, H + explodeY + 95, D * 0.4),
      },
      ...(dividerCount > 0
        ? [{ code: "⑤", num: "5", label: `Ara Dikme (${dividerCount}x)`, ...toSvg(W * 0.45, H + 55, D * 0.5) }]
        : []),
      { code: "⑥", num: "6", label: "8mm Arkalık", ...toSvg(W * 0.72, H + 145, -explodeZ) },
      ...(!isWallCab && plinthH > 0
        ? [{ code: "⑦", num: "7", label: `Baza (${plinthH}mm)`, ...toSvg(W * 0.5, -explodeY - 75, D * 0.7) }]
        : []),
      ...(shelfCount > 0
        ? [{ code: "⑧", num: "8", label: `Raf (${shelfCount}x)`, ...toSvg(W * 0.2, midY + 90, D * 0.35) }]
        : []),
      ...(drawerCount > 0
        ? [{ code: "⑨", num: "9", label: `Çekmece (${drawerCount}x)`, ...toSvg(W * 0.78, plinthH + 40, D + explodeDrawerZ + 80) }]
        : []),
      ...(hasDoors
        ? [
            {
              code: "⑩",
              num: "10",
              label: hasTambourBays ? "Tambur Lamel Perde" : `Kapak (${doorLeavesCount}x)`,
              ...toSvg(W * 0.78, H * 0.45, D + explodeDoorZ + 90),
            },
          ]
        : []),
    ];
  }

  return {
    renderedBoxes,
    arrows,
    callouts,
    grainFlowLinks,
    explodeX,
    explodeY,
    explodeZ,
    explodeDrawerZ,
    explodeDoorZ,
    toSvg,
  };
}
