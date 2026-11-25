import { calculateBayWidths, type ModuleInstance } from "@birim/core";

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

export * from "./explodedIsoRenderer";
