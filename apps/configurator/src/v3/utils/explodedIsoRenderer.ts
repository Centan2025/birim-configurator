import { type GrainPartNeighborInfo, type ModuleInstance } from "@birim/core";
import {
  type IsoBoxSpec,
  projectIsoPoint,
  sampleRoundedRectLoopXZ,
  isTambourDoor,
  buildExplodedIsoBoxes,
} from "./explodedIsoScene";

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
    const backT = mod.carcass.backPanelThickness || 8;
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

