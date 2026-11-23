import type {
  ArchitecturalElement,
  DesignProject,
  ModuleInstance,
  WallDefinition,
} from "@birim/core";
import {
  calculateModulePlacement,
  DEFAULT_MATERIALS,
} from "@birim/core";
import {
  generateModuleGeometry,
  type ComponentGeometry,
} from "@birim/geometry";
import type { ManufacturingBOM } from "@birim/manufacturing";

export type SheetPaperFormat =
  | "A3_LANDSCAPE"
  | "A4_LANDSCAPE"
  | "A2_LANDSCAPE"
  | "A1_LANDSCAPE";

export type SheetScaleOption = "auto" | "1:10" | "1:20" | "1:25" | "1:50";

export interface SheetPaperSpec {
  id: SheetPaperFormat;
  label: string;
  widthMm: number;
  heightMm: number;
  cssPageSize: string;
  svgWidth: number;
  svgHeight: number;
}

export const SHEET_PAPER_SPECS: Record<SheetPaperFormat, SheetPaperSpec> = {
  A4_LANDSCAPE: {
    id: "A4_LANDSCAPE",
    label: "A4 Yatay (297 × 210 mm)",
    widthMm: 297,
    heightMm: 210,
    cssPageSize: "A4 landscape",
    svgWidth: 1188,
    svgHeight: 840,
  },
  A3_LANDSCAPE: {
    id: "A3_LANDSCAPE",
    label: "A3 Yatay (420 × 297 mm)",
    widthMm: 420,
    heightMm: 297,
    cssPageSize: "A3 landscape",
    svgWidth: 1680,
    svgHeight: 1188,
  },
  A2_LANDSCAPE: {
    id: "A2_LANDSCAPE",
    label: "A2 Yatay (594 × 420 mm)",
    widthMm: 594,
    heightMm: 420,
    cssPageSize: "A2 landscape",
    svgWidth: 2376,
    svgHeight: 1680,
  },
  A1_LANDSCAPE: {
    id: "A1_LANDSCAPE",
    label: "A1 Yatay (841 × 594 mm)",
    widthMm: 841,
    heightMm: 594,
    cssPageSize: "A1 landscape",
    svgWidth: 3364,
    svgHeight: 2376,
  },
};

export interface SheetDisplayOptions {
  paperFormat: SheetPaperFormat;
  scale: SheetScaleOption;
  unit: "mm" | "cm";
  showDimensions: boolean;
  showSectionHatch: boolean;
  showXrayInterior: boolean;
  showBomTable: boolean;
  showGridTicks: boolean;
  isoCameraSide?: "front_right" | "front_left";
}

export interface SheetTitleBlockMeta {
  companyName: string;
  projectTitle: string;
  customerOrOrderNo: string;
  drawnBy: string;
  approvedBy: string;
  revisionNote: string;
  sheetCodePrefix: string;
}

export type SheetPageKind =
  | "overview"
  | "wall_elevations"
  | "module_views"
  | "joinery_details"
  | "exploded_bom"
  | "panel_drilling"
  | "cutting_edgeband"
  | "isometric_dimensions";

export interface SheetPageDescriptor {
  id: string;
  kind: SheetPageKind;
  sheetNo: string;
  title: string;
  subtitle: string;
  moduleIndex?: number;
  moduleId?: string;
}

export interface SheetBuildContext {
  project: DesignProject;
  bom: ManufacturingBOM;
  spaceWalls: WallDefinition[];
  spaceObstacles: ArchitecturalElement[];
  options: SheetDisplayOptions;
  meta: SheetTitleBlockMeta;
}

export interface ViewportBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const CAD_COLORS = {
  ink: "#0F172A",
  subInk: "#334155",
  muted: "#64748B",
  dim: "#991B1B",      // DIN / ISO crisp crimson dimension lines
  dimExt: "#7F1D1D",   // Extension lines
  plane: "#1D4ED8",    // Section plane & centerlines (blue dash-dot)
  hatch: "#64748B",
  fillCut: "#E2E8F0",
  fillBody: "#F8FAFC",
  fillDoor: "#FFFFFF",
} as const;

export function isDoorLeafRole(role: string): boolean {
  return (
    role === "door_left" ||
    role === "door_right" ||
    role === "door_sliding" ||
    role === "door_lift"
  );
}

export function escXml(val: string | number | undefined | null): string {
  return String(val ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatSheetDim(mm: number, unit: "mm" | "cm", withUnit = false): string {
  if (!Number.isFinite(mm)) return "0";
  if (unit === "cm") {
    const cm = Math.round(mm) / 10;
    const num = Number.isInteger(cm) ? `${cm}` : cm.toFixed(1);
    return withUnit ? `${num} cm` : num;
  }
  const val = `${Math.round(mm)}`;
  return withUnit ? `${val} mm` : val;
}

export function getMaterialName(project: DesignProject, materialId?: string): string {
  if (!materialId) return "Belirtilmedi";
  const all = [...DEFAULT_MATERIALS, ...(project.customMaterials || [])];
  const found = all.find((m) => m.id === materialId);
  return found ? found.name : materialId;
}

export function renderViewCaption(
  cx: number,
  y: number,
  title: string,
  subtitle?: string
): string {
  return `
    <g>
      <text x="${cx.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" font-family="Segoe UI, system-ui, sans-serif" font-size="13" font-weight="800" fill="${CAD_COLORS.ink}" letter-spacing="0.4">${escXml(title)}</text>
      <line x1="${(cx - 75).toFixed(1)}" y1="${(y + 4).toFixed(1)}" x2="${(cx + 75).toFixed(1)}" y2="${(y + 4).toFixed(1)}" stroke="${CAD_COLORS.ink}" stroke-width="0.9" />
      ${subtitle ? `<text x="${cx.toFixed(1)}" y="${(y + 17).toFixed(1)}" text-anchor="middle" font-family="ui-monospace, Consolas, monospace" font-size="10" font-weight="600" fill="${CAD_COLORS.subInk}">${escXml(subtitle)}</text>` : ""}
    </g>
  `;
}

export function renderDimLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  label: string,
  orientation: "horizontal" | "vertical",
  anchorCoord?: number,
  stroke: string = CAD_COLORS.dim
): string {
  const pillW = Math.max(22, label.length * 7.2 + 8);
  const gap = 4;
  const overshoot = 6;
  const extStroke = stroke === CAD_COLORS.dim ? "#991B1B" : "#475569";

  if (orientation === "horizontal") {
    const midX = (x1 + x2) / 2;
    const textY = y1 - 5;
    let extLines = "";
    if (typeof anchorCoord === "number") {
      const dir = y1 >= anchorCoord ? 1 : -1;
      const startY = anchorCoord + dir * gap;
      const endY = y1 + dir * overshoot;
      extLines = `
        <line x1="${x1.toFixed(1)}" y1="${startY.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${endY.toFixed(1)}" stroke="${extStroke}" stroke-width="0.6" opacity="0.8" />
        <line x1="${x2.toFixed(1)}" y1="${startY.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${endY.toFixed(1)}" stroke="${extStroke}" stroke-width="0.6" opacity="0.8" />
      `;
    }
    return `
      <g class="cad-dim">
        ${extLines}
        <line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${stroke}" stroke-width="0.85" />
        <line x1="${(x1 - 3.2).toFixed(1)}" y1="${(y1 + 3.2).toFixed(1)}" x2="${(x1 + 3.2).toFixed(1)}" y2="${(y1 - 3.2).toFixed(1)}" stroke="${stroke}" stroke-width="1.4" />
        <line x1="${(x2 - 3.2).toFixed(1)}" y1="${(y2 + 3.2).toFixed(1)}" x2="${(x2 + 3.2).toFixed(1)}" y2="${(y2 - 3.2).toFixed(1)}" stroke="${stroke}" stroke-width="1.4" />
        <rect x="${(midX - pillW / 2).toFixed(1)}" y="${(textY - 11.5).toFixed(1)}" width="${pillW.toFixed(1)}" height="14" rx="2" fill="#FFFFFF" opacity="0.95" />
        <text x="${midX.toFixed(1)}" y="${textY.toFixed(1)}" text-anchor="middle" font-family="ui-monospace, Consolas, monospace" font-size="11.5" font-weight="800" fill="${stroke}">${escXml(label)}</text>
      </g>
    `;
  }
  const midY = (y1 + y2) / 2;
  let extLines = "";
  if (typeof anchorCoord === "number") {
    const dir = x1 >= anchorCoord ? 1 : -1;
    const startX = anchorCoord + dir * gap;
    const endX = x1 + dir * overshoot;
    extLines = `
      <line x1="${startX.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${endX.toFixed(1)}" y2="${y1.toFixed(1)}" stroke="${extStroke}" stroke-width="0.6" opacity="0.8" />
      <line x1="${startX.toFixed(1)}" y1="${y2.toFixed(1)}" x2="${endX.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${extStroke}" stroke-width="0.6" opacity="0.8" />
    `;
  }
  return `
    <g class="cad-dim">
      ${extLines}
      <line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${stroke}" stroke-width="0.85" />
      <line x1="${(x1 - 3.2).toFixed(1)}" y1="${(y1 + 3.2).toFixed(1)}" x2="${(x1 + 3.2).toFixed(1)}" y2="${(y1 - 3.2).toFixed(1)}" stroke="${stroke}" stroke-width="1.4" />
      <line x1="${(x2 - 3.2).toFixed(1)}" y1="${(y2 + 3.2).toFixed(1)}" x2="${(x2 + 3.2).toFixed(1)}" y2="${(y2 - 3.2).toFixed(1)}" stroke="${stroke}" stroke-width="1.4" />
      <g transform="translate(${(x1 - 6).toFixed(1)}, ${midY.toFixed(1)}) rotate(-90)">
        <rect x="${(-pillW / 2).toFixed(1)}" y="-11.5" width="${pillW.toFixed(1)}" height="14" rx="2" fill="#FFFFFF" opacity="0.95" />
        <text x="0" y="0" text-anchor="middle" font-family="ui-monospace, Consolas, monospace" font-size="11.5" font-weight="800" fill="${stroke}">${escXml(label)}</text>
      </g>
    </g>
  `;
}

export function renderClosedHorizontalChain(
  mmStops: number[],
  mapX: (x: number) => number,
  lineY: number,
  anchorY: number,
  unit: "mm" | "cm",
  stroke: string = CAD_COLORS.dim
): string {
  if (mmStops.length < 2) return "";
  const dir = lineY >= anchorY ? 1 : -1;
  const startY = anchorY + dir * 4;
  const endY = lineY + dir * 6;
  const parts: string[] = [];

  const firstX = mapX(mmStops[0]);
  const lastX = mapX(mmStops[mmStops.length - 1]);
  parts.push(`<line x1="${firstX.toFixed(1)}" y1="${lineY.toFixed(1)}" x2="${lastX.toFixed(1)}" y2="${lineY.toFixed(1)}" stroke="${stroke}" stroke-width="0.85" />`);

  mmStops.forEach((mm) => {
    const px = mapX(mm);
    parts.push(`<line x1="${px.toFixed(1)}" y1="${startY.toFixed(1)}" x2="${px.toFixed(1)}" y2="${endY.toFixed(1)}" stroke="${stroke}" stroke-width="0.55" opacity="0.75" />`);
    parts.push(`<line x1="${(px - 3).toFixed(1)}" y1="${(lineY + 3).toFixed(1)}" x2="${(px + 3).toFixed(1)}" y2="${(lineY - 3).toFixed(1)}" stroke="${stroke}" stroke-width="1.4" />`);
  });

  let narrowToggle = 0;
  for (let i = 0; i < mmStops.length - 1; i++) {
    const aMm = mmStops[i];
    const bMm = mmStops[i + 1];
    const spanMm = bMm - aMm;
    if (spanMm <= 0.5) continue;
    const xA = mapX(aMm);
    const xB = mapX(bMm);
    const segPx = xB - xA;
    const midX = (xA + xB) / 2;
    const lbl = formatSheetDim(spanMm, unit);
    if (segPx >= 26) {
      const ty = lineY - 5;
      const pw = Math.max(20, lbl.length * 7.2 + 8);
      parts.push(`<rect x="${(midX - pw / 2).toFixed(1)}" y="${(ty - 11.5).toFixed(1)}" width="${pw.toFixed(1)}" height="13.5" rx="2" fill="#FFFFFF" opacity="0.96" />`);
      parts.push(`<text x="${midX.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="11.5" font-weight="800" fill="${stroke}">${escXml(lbl)}</text>`);
    } else {
      const ty = dir > 0 ? lineY + 14 + (narrowToggle % 2) * 11 : lineY - 12 - (narrowToggle % 2) * 11;
      narrowToggle++;
      const pw = Math.max(14, lbl.length * 5.8 + 6);
      parts.push(`<rect x="${(midX - pw / 2).toFixed(1)}" y="${(ty - 9).toFixed(1)}" width="${pw.toFixed(1)}" height="11" rx="1.5" fill="#FFFFFF" opacity="0.94" />`);
      parts.push(`<text x="${midX.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10.5" font-weight="800" fill="${stroke}">${escXml(lbl)}</text>`);
    }
  }
  return `<g class="cad-dim-chain">${parts.join("")}</g>`;
}

export function renderClosedVerticalChain(
  mmStops: number[],
  mapY: (y: number) => number,
  lineX: number,
  anchorX: number,
  unit: "mm" | "cm",
  stroke: string = CAD_COLORS.dim
): string {
  if (mmStops.length < 2) return "";
  const dir = lineX >= anchorX ? 1 : -1;
  const startX = anchorX + dir * 4;
  const endX = lineX + dir * 6;
  const parts: string[] = [];

  const firstY = mapY(mmStops[0]);
  const lastY = mapY(mmStops[mmStops.length - 1]);
  parts.push(`<line x1="${lineX.toFixed(1)}" y1="${firstY.toFixed(1)}" x2="${lineX.toFixed(1)}" y2="${lastY.toFixed(1)}" stroke="${stroke}" stroke-width="0.85" />`);

  mmStops.forEach((mm) => {
    const py = mapY(mm);
    parts.push(`<line x1="${startX.toFixed(1)}" y1="${py.toFixed(1)}" x2="${endX.toFixed(1)}" y2="${py.toFixed(1)}" stroke="${stroke}" stroke-width="0.55" opacity="0.75" />`);
    parts.push(`<line x1="${(lineX - 3).toFixed(1)}" y1="${(py + 3).toFixed(1)}" x2="${(lineX + 3).toFixed(1)}" y2="${(py - 3).toFixed(1)}" stroke="${stroke}" stroke-width="1.4" />`);
  });

  let lastNarrowY = -Infinity;
  let narrowCol = 0;
  for (let i = 0; i < mmStops.length - 1; i++) {
    const aMm = mmStops[i];
    const bMm = mmStops[i + 1];
    const spanMm = Math.abs(bMm - aMm);
    if (spanMm <= 0.5) continue;
    const yA = mapY(aMm);
    const yB = mapY(bMm);
    const segPx = Math.abs(yB - yA);
    const midY = (yA + yB) / 2;
    const lbl = formatSheetDim(spanMm, unit);
    if (segPx >= 22) {
      const pw = Math.max(20, lbl.length * 7.4 + 8);
      // Place rotated dimension text on the OUTER side of the dimension line so it never touches the cabinet drawing
      const textOffsetX = dir > 0 ? lineX + 12.5 : lineX - 5.5;
      parts.push(`<g transform="translate(${textOffsetX.toFixed(1)}, ${midY.toFixed(1)}) rotate(-90)">
        <rect x="${(-pw / 2).toFixed(1)}" y="-11.5" width="${pw.toFixed(1)}" height="13.5" rx="2" fill="#FFFFFF" opacity="0.96" />
        <text x="0" y="0" text-anchor="middle" font-family="ui-monospace, monospace" font-size="11.5" font-weight="800" fill="${stroke}">${escXml(lbl)}</text>
      </g>`);
    } else if (spanMm >= 5) {
      narrowCol = Math.abs(midY - lastNarrowY) < 14 ? (narrowCol + 1) % 2 : 0;
      lastNarrowY = midY;
      const xOff = dir > 0 ? 11 + narrowCol * 24 : -11 - narrowCol * 24;
      const tx = lineX + xOff;
      const pw = Math.max(18, lbl.length * 6.5 + 6);
      const rx = dir > 0 ? tx - 2 : tx - pw + 2;
      parts.push(`<rect x="${rx.toFixed(1)}" y="${(midY - 8.5).toFixed(1)}" width="${pw.toFixed(1)}" height="12.5" rx="1.5" fill="#FFFFFF" opacity="0.96" />`);
      parts.push(`<text x="${tx.toFixed(1)}" y="${(midY + 3.2).toFixed(1)}" text-anchor="${dir > 0 ? "start" : "end"}" font-family="ui-monospace, monospace" font-size="10.5" font-weight="800" fill="${stroke}">${escXml(lbl)}</text>`);
    }
  }
  return `<g class="cad-dim-chain">${parts.join("")}</g>`;
}

export function renderDatumMarker(x: number, y: number, label: string): string {
  return `
    <g>
      <polygon points="${x.toFixed(1)},${y.toFixed(1)} ${(x - 5).toFixed(1)},${(y - 7).toFixed(1)} ${(x + 5).toFixed(1)},${(y - 7).toFixed(1)}" fill="${CAD_COLORS.ink}" />
      <line x1="${(x - 7).toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x + 32).toFixed(1)}" y2="${y.toFixed(1)}" stroke="${CAD_COLORS.ink}" stroke-width="0.85" />
      <text x="${(x + 7).toFixed(1)}" y="${(y - 3).toFixed(1)}" font-family="ui-monospace, monospace" font-size="10" font-weight="800" fill="${CAD_COLORS.ink}">${escXml(label)}</text>
    </g>
  `;
}

export function renderBalloon(
  cx: number,
  cy: number,
  code: string,
  targetX?: number,
  targetY?: number
): string {
  const leader =
    typeof targetX === "number" && typeof targetY === "number"
      ? `<line x1="${cx.toFixed(1)}" y1="${cy.toFixed(1)}" x2="${targetX.toFixed(1)}" y2="${targetY.toFixed(1)}" stroke="${CAD_COLORS.ink}" stroke-width="0.85" />
         <circle cx="${targetX.toFixed(1)}" cy="${targetY.toFixed(1)}" r="2" fill="${CAD_COLORS.ink}" />`
      : "";
  return `
    <g>
      ${leader}
      <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="12" fill="#FFFFFF" stroke="${CAD_COLORS.ink}" stroke-width="1.2" />
      <text x="${cx.toFixed(1)}" y="${(cy + 3.5).toFixed(1)}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10.5" font-weight="800" fill="${CAD_COLORS.ink}">${escXml(code)}</text>
    </g>
  `;
}

interface IsoBoxItem {
  x0: number;
  y0: number;
  z0: number;
  x1: number;
  y1: number;
  z1: number;
  role: string;
  id: string;
  label: string;
  depthScore: number;
}

export function projectIsoPoint(
  x: number,
  y: number,
  z: number,
  cameraSide: "front_right" | "front_left" = "front_right"
): { u: number; v: number } {
  return {
    u: cameraSide === "front_left" ? x + z * 0.52 : x - z * 0.52,
    v: -y + z * 0.30,
  };
}

function transformBoxToWorld(
  comp: ComponentGeometry,
  mod: ModuleInstance,
  cameraSide: "front_right" | "front_left" = "front_right"
): IsoBoxItem {
  const hw = comp.dimensions.width / 2;
  const hh = comp.dimensions.height / 2;
  const hd = comp.dimensions.depth / 2;
  const cxLocal = comp.position.x + hw;
  const cyLocal = comp.position.y + hh;
  const czLocal = comp.position.z + hd;

  // Use @birim/core calculateModulePlacement so 90°/180°/270° rotated modules face INTO the room accurately!
  const pl = calculateModulePlacement(mod);
  const rotRad = ((mod.rotation?.y || 0) * Math.PI) / 180;
  const cos = Math.cos(rotRad);
  const sin = Math.sin(rotRad);

  const wx = pl.origin.x + cxLocal * cos + czLocal * sin;
  const wy = (mod.position?.y || 0) + cyLocal;
  const wz = pl.origin.z - cxLocal * sin + czLocal * cos;

  const effHw = Math.abs(hw * cos) + Math.abs(hd * sin);
  const effHd = Math.abs(hw * sin) + Math.abs(hd * cos);

  return {
    x0: wx - effHw,
    y0: wy - hh,
    z0: wz - effHd,
    x1: wx + effHw,
    y1: wy + hh,
    z1: wz + effHd,
    role: comp.role,
    id: comp.id,
    label: comp.label,
    depthScore: (cameraSide === "front_left" ? -wx : wx) * 0.52 + wy * 0.38 + wz * 0.88,
  };
}

function sortIsoBoxesPainterOrder(
  items: IsoBoxItem[],
  cameraSide: "front_right" | "front_left" = "front_right"
): IsoBoxItem[] {
  const n = items.length;
  if (n <= 1) return items;
  const eps = 0.5;
  const screenBounds = items.map((it) => {
    const pts = [
      projectIsoPoint(it.x0, it.y0, it.z0, cameraSide),
      projectIsoPoint(it.x1, it.y0, it.z0, cameraSide),
      projectIsoPoint(it.x0, it.y1, it.z0, cameraSide),
      projectIsoPoint(it.x1, it.y1, it.z0, cameraSide),
      projectIsoPoint(it.x0, it.y0, it.z1, cameraSide),
      projectIsoPoint(it.x1, it.y0, it.z1, cameraSide),
      projectIsoPoint(it.x0, it.y1, it.z1, cameraSide),
      projectIsoPoint(it.x1, it.y1, it.z1, cameraSide),
    ];
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const q of pts) {
      if (q.u < u0) u0 = q.u;
      if (q.u > u1) u1 = q.u;
      if (q.v < v0) v0 = q.v;
      if (q.v > v1) v1 = q.v;
    }
    return { u0, u1, v0, v1 };
  });

  const adj: number[][] = Array.from({ length: n }, () => []);
  const indeg = new Int32Array(n);

  for (let i = 0; i < n; i++) {
    const a = items[i];
    const sa = screenBounds[i];
    for (let j = i + 1; j < n; j++) {
      const b = items[j];
      const sb = screenBounds[j];
      if (sa.u1 <= sb.u0 || sb.u1 <= sa.u0 || sa.v1 <= sb.v0 || sb.v1 <= sa.v0) continue;
      const aBehindX = cameraSide === "front_left" ? a.x0 >= b.x1 - eps : a.x1 <= b.x0 + eps;
      const bBehindX = cameraSide === "front_left" ? b.x0 >= a.x1 - eps : b.x1 <= a.x0 + eps;
      const aBehindB = aBehindX || a.y1 <= b.y0 + eps || a.z1 <= b.z0 + eps;
      const bBehindA = bBehindX || b.y1 <= a.y0 + eps || b.z1 <= a.z0 + eps;
      if (aBehindB && !bBehindA) {
        adj[i].push(j);
        indeg[j]++;
      } else if (bBehindA && !aBehindB) {
        adj[j].push(i);
        indeg[i]++;
      }
    }
  }

  const result: IsoBoxItem[] = [];
  const available: number[] = [];
  for (let i = 0; i < n; i++) if (indeg[i] === 0) available.push(i);
  available.sort((i, j) => items[i].depthScore - items[j].depthScore);

  const visited = new Uint8Array(n);
  while (result.length < n) {
    if (available.length === 0) {
      // Break localized overlap cycle one node at a time by picking the deepest remaining box
      let bestIdx = -1;
      let bestScore = Infinity;
      for (let i = 0; i < n; i++) {
        if (!visited[i] && items[i].depthScore < bestScore) {
          bestScore = items[i].depthScore;
          bestIdx = i;
        }
      }
      if (bestIdx < 0) break;
      available.push(bestIdx);
    }
    const u = available.shift()!;
    if (visited[u]) continue;
    visited[u] = 1;
    result.push(items[u]);
    for (const v of adj[u]) {
      indeg[v]--;
      if (indeg[v] <= 0 && !visited[v]) {
        available.push(v);
      }
    }
    available.sort((i, j) => items[i].depthScore - items[j].depthScore);
  }
  return result;
}

export function renderIsometricViewport(
  modules: ModuleInstance[],
  box: ViewportBox,
  options: SheetDisplayOptions,
  singleModuleMode: boolean,
  explodedFactor = 0,
  onProjectedItems?: (
    mapped: { item: IsoBoxItem; cx: number; cy: number; x0: number; y0: number; x1: number; y1: number }[]
  ) => string
): string {
  const cameraSide: "front_right" | "front_left" = options.isoCameraSide || "front_right";
  const rawItems: IsoBoxItem[] = [];
  modules.forEach((mod) => {
    const breakdown = generateModuleGeometry(mod, { explodedFactor });
    const pseudoMod: ModuleInstance = singleModuleMode
      ? { ...mod, position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }
      : mod;
    breakdown.components.forEach((comp) => {
      if (
        explodedFactor === 0 &&
        (comp.role === "door_hinge" || comp.role === "drawer_slide" || comp.role === "special_fitting")
      ) {
        return;
      }
      rawItems.push(transformBoxToWorld(comp, pseudoMod, cameraSide));
    });
  });

  if (rawItems.length === 0) {
    return `<text x="${box.x + box.w / 2}" y="${box.y + box.h / 2}" text-anchor="middle" font-size="11" fill="#64748B">Modül bulunamadı</text>`;
  }

  // Only split doors into a front overlay pass in single-module X-ray mode (in multi-module L/U rooms, sort all boxes together!)
  const isXrayDoorRole = (role: string) =>
    role.startsWith("door_") && role !== "door_hinge";
  const items = singleModuleMode && options.showXrayInterior && explodedFactor === 0
    ? [
        ...sortIsoBoxesPainterOrder(rawItems.filter((it) => !isXrayDoorRole(it.role)), cameraSide),
        ...sortIsoBoxesPainterOrder(rawItems.filter((it) => isXrayDoorRole(it.role)), cameraSide),
      ]
    : sortIsoBoxesPainterOrder(rawItems, cameraSide);
  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
  for (const it of items) {
    const corners = [
      projectIsoPoint(it.x0, it.y0, it.z0, cameraSide),
      projectIsoPoint(it.x1, it.y0, it.z0, cameraSide),
      projectIsoPoint(it.x0, it.y1, it.z0, cameraSide),
      projectIsoPoint(it.x1, it.y1, it.z0, cameraSide),
      projectIsoPoint(it.x0, it.y0, it.z1, cameraSide),
      projectIsoPoint(it.x1, it.y0, it.z1, cameraSide),
      projectIsoPoint(it.x0, it.y1, it.z1, cameraSide),
      projectIsoPoint(it.x1, it.y1, it.z1, cameraSide),
    ];
    for (const c of corners) {
      if (c.u < minU) minU = c.u;
      if (c.u > maxU) maxU = c.u;
      if (c.v < minV) minV = c.v;
      if (c.v > maxV) maxV = c.v;
    }
  }

  const spanU = Math.max(100, maxU - minU);
  const spanV = Math.max(100, maxV - minV);
  const showIsoDims = options.showDimensions && explodedFactor === 0 && (singleModuleMode || modules.every((m) => (((m.rotation?.y || 0) % 360) + 360) % 360 < 45));
  const fitRatio = showIsoDims ? 0.68 : 0.84;
  const scale = Math.min((box.w * fitRatio) / spanU, (box.h * fitRatio) / spanV);
  const offX = box.x + (box.w - spanU * scale) / 2 - minU * scale + (showIsoDims ? 12 : 0);
  const offY = box.y + (box.h - spanV * scale) / 2 - minV * scale - (showIsoDims ? 10 : 0);
  const mapP = (x: number, y: number, z: number) => {
    const p = projectIsoPoint(x, y, z, cameraSide);
    return { x: offX + p.u * scale, y: offY + p.v * scale };
  };
  const ptStr = (x: number, y: number, z: number) => {
    const p = mapP(x, y, z);
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  };

  const mappedList: { item: IsoBoxItem; cx: number; cy: number; x0: number; y0: number; x1: number; y1: number }[] = [];
  const polys = items
    .map((it) => {
      const pMin = mapP(it.x0, it.y1, it.z1);
      const pMax = mapP(it.x1, it.y0, it.z0);
      const pCenter = mapP((it.x0 + it.x1) / 2, (it.y0 + it.y1) / 2, (it.z0 + it.z1) / 2);
      mappedList.push({ item: it, cx: pCenter.x, cy: pCenter.y, x0: pMin.x, y0: pMin.y, x1: pMax.x, y1: pMax.y });

      const isDoor = it.role.startsWith("door_") && it.role !== "door_hinge";
      const op = isDoor && options.showXrayInterior ? 0.16 : 1;
      const front = isDoor ? "#FFFFFF" : it.role === "plinth" ? "#94A3B8" : "#F1F5F9";
      const side = isDoor ? "#E2E8F0" : it.role === "plinth" ? "#64748B" : "#CBD5E1";
      const top = isDoor ? "#FFFFFF" : it.role === "plinth" ? "#CBD5E1" : "#F8FAFC";
      const stroke = isDoor && options.showXrayInterior ? "#0284C7" : "#0F172A";

      const frontPts = [ptStr(it.x0, it.y0, it.z1), ptStr(it.x1, it.y0, it.z1), ptStr(it.x1, it.y1, it.z1), ptStr(it.x0, it.y1, it.z1)].join(" ");
      const sideX = cameraSide === "front_left" ? it.x0 : it.x1;
      const sidePts = [ptStr(sideX, it.y0, it.z1), ptStr(sideX, it.y0, it.z0), ptStr(sideX, it.y1, it.z0), ptStr(sideX, it.y1, it.z1)].join(" ");
      const topPts = [ptStr(it.x0, it.y1, it.z1), ptStr(it.x1, it.y1, it.z1), ptStr(it.x1, it.y1, it.z0), ptStr(it.x0, it.y1, it.z0)].join(" ");
      return `
        <g opacity="${op}">
          <polygon points="${topPts}" fill="${top}" stroke="${stroke}" stroke-width="0.7" stroke-linejoin="round" />
          <polygon points="${sidePts}" fill="${side}" stroke="${stroke}" stroke-width="0.7" stroke-linejoin="round" />
          <polygon points="${frontPts}" fill="${front}" stroke="${stroke}" stroke-width="0.75" stroke-linejoin="round" />
        </g>
      `;
    })
    .join("");

  let isoDimsSvg = "";
  if (showIsoDims && modules.length > 0) {
    // 1) Kesin nominal gövde sınırlarını (kulp/hırdavat taşması OLMADAN) modül ölçülerinden hesapla
    let cMinX = Infinity, cMaxX = -Infinity;
    let cMinY = Infinity, cMaxY = -Infinity;
    let cMinZ = Infinity, cMaxZ = -Infinity;
    const modSpansX: { x0: number; x1: number; w: number }[] = [];

    modules.forEach((mod) => {
      const mx0 = singleModuleMode ? 0 : mod.position?.x || 0;
      const my0 = singleModuleMode ? 0 : mod.position?.y || 0;
      const mz0 = singleModuleMode ? 0 : mod.position?.z || 0;
      const rotY = singleModuleMode ? 0 : ((mod.rotation?.y || 0) % 360 + 360) % 360;
      const swapped = rotY === 90 || rotY === 270;
      const mw = swapped ? mod.dimensions.depth : mod.dimensions.width;
      const md = swapped ? mod.dimensions.width : mod.dimensions.depth;
      const mh = mod.dimensions.height;
      if (mx0 < cMinX) cMinX = mx0;
      if (mx0 + mw > cMaxX) cMaxX = mx0 + mw;
      if (my0 < cMinY) cMinY = my0;
      if (my0 + mh > cMaxY) cMaxY = my0 + mh;
      if (mz0 < cMinZ) cMinZ = mz0;
      if (mz0 + md > cMaxZ) cMaxZ = mz0 + md;
      modSpansX.push({ x0: mx0, x1: mx0 + mw, w: Math.round(mw) });
    });

    // Kapak ön yüzü Z konumu (yalnızca kapak/çekmece yüzeyi; kulp hariç!)
    let doorFrontZ = cMaxZ;
    for (const it of items) {
      if ((it.role.startsWith("door_") && it.role !== "door_handle" && it.role !== "door_hinge") || it.role === "drawer_front") {
        if (it.z1 > doorFrontZ) doorFrontZ = it.z1;
      }
    }
    const doorProtrusionMm = Math.round(doorFrontZ - cMaxZ);

    const dimW = Math.round(cMaxX - cMinX);
    const dimH = Math.round(cMaxY - cMinY);
    const dimD = Math.round(cMaxZ - cMinZ);
    const stroke = CAD_COLORS.dim;
    const dimParts: string[] = [];

    const drawTick = (px: number, py: number) =>
      `<line x1="${(px - 3).toFixed(1)}" y1="${(py + 3).toFixed(1)}" x2="${(px + 3).toFixed(1)}" y2="${(py - 3).toFixed(1)}" stroke="${stroke}" stroke-width="1.35" />`;

    // Helper: Yatay alt ön ölçü çizgisi (z = doorFrontZ, y = cMinY)
    const drawBottomHorizChain = (xStops: number[], offsetPx: number) => {
      if (xStops.length < 2) return;
      const pFirst = mapP(xStops[0], cMinY, doorFrontZ);
      const pLast = mapP(xStops[xStops.length - 1], cMinY, doorFrontZ);
      const lineY = Math.max(pFirst.y, pLast.y) + offsetPx;
      dimParts.push(`<line x1="${pFirst.x.toFixed(1)}" y1="${lineY.toFixed(1)}" x2="${pLast.x.toFixed(1)}" y2="${lineY.toFixed(1)}" stroke="${stroke}" stroke-width="0.85" />`);
      xStops.forEach((xv) => {
        const pt = mapP(xv, cMinY, doorFrontZ);
        dimParts.push(`<line x1="${pt.x.toFixed(1)}" y1="${(pt.y + 4).toFixed(1)}" x2="${pt.x.toFixed(1)}" y2="${(lineY + 5).toFixed(1)}" stroke="${stroke}" stroke-width="0.55" opacity="0.75" />`);
        dimParts.push(drawTick(pt.x, lineY));
      });
      for (let i = 0; i < xStops.length - 1; i++) {
        const span = Math.round(xStops[i + 1] - xStops[i]);
        if (span < 10) continue;
        const pA = mapP(xStops[i], cMinY, doorFrontZ);
        const pB = mapP(xStops[i + 1], cMinY, doorFrontZ);
        if (Math.abs(pB.x - pA.x) < 18) continue;
        const midX = (pA.x + pB.x) / 2;
        const lbl = formatSheetDim(span, options.unit);
        const pw = Math.max(24, lbl.length * 6.5 + 8);
        dimParts.push(`<rect x="${(midX - pw / 2).toFixed(1)}" y="${(lineY - 6.8).toFixed(1)}" width="${pw.toFixed(1)}" height="13" rx="2" fill="#FFFFFF" opacity="0.96" />`);
        dimParts.push(`<text x="${midX.toFixed(1)}" y="${(lineY + 3).toFixed(1)}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" font-weight="800" fill="${stroke}">${escXml(lbl)}</text>`);
      }
    };

    // Helper: Dikey ölçü çizgisi (sol veya sağ kenar)
    const drawIsoVertChain = (yStops: number[], xCoord: number, zCoord: number, offsetPx: number, side: "left" | "right") => {
      if (yStops.length < 2) return;
      const dir = side === "left" ? -1 : 1;
      const pBot = mapP(xCoord, yStops[0], zCoord);
      const pTop = mapP(xCoord, yStops[yStops.length - 1], zCoord);
      const lineX = pBot.x + dir * offsetPx;
      dimParts.push(`<line x1="${lineX.toFixed(1)}" y1="${pBot.y.toFixed(1)}" x2="${lineX.toFixed(1)}" y2="${pTop.y.toFixed(1)}" stroke="${stroke}" stroke-width="0.85" />`);
      yStops.forEach((yv) => {
        const pt = mapP(xCoord, yv, zCoord);
        dimParts.push(`<line x1="${(pt.x + dir * 4).toFixed(1)}" y1="${pt.y.toFixed(1)}" x2="${(lineX + dir * 5).toFixed(1)}" y2="${pt.y.toFixed(1)}" stroke="${stroke}" stroke-width="0.55" opacity="0.75" />`);
        dimParts.push(drawTick(lineX, pt.y));
      });
      for (let i = 0; i < yStops.length - 1; i++) {
        const span = Math.round(yStops[i + 1] - yStops[i]);
        if (span < 10) continue;
        const pA = mapP(xCoord, yStops[i], zCoord);
        const pB = mapP(xCoord, yStops[i + 1], zCoord);
        const segPx = Math.abs(pA.y - pB.y);
        const midY = (pA.y + pB.y) / 2;
        const lbl = formatSheetDim(span, options.unit);
        if (segPx >= 22) {
          const pw = Math.max(24, lbl.length * 6.5 + 8);
          const textX = dir < 0 ? lineX - 5.5 : lineX + 12;
          dimParts.push(`<g transform="translate(${textX.toFixed(1)}, ${midY.toFixed(1)}) rotate(-90)">
            <rect x="${(-pw / 2).toFixed(1)}" y="-10" width="${pw.toFixed(1)}" height="13" rx="2" fill="#FFFFFF" opacity="0.96" />
            <text x="0" y="0" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" font-weight="800" fill="${stroke}">${escXml(lbl)}</text>
          </g>`);
        } else {
          const tx = lineX + dir * 10;
          const pw = Math.max(18, lbl.length * 6.2 + 6);
          const rx = dir > 0 ? tx - 2 : tx - pw + 2;
          dimParts.push(`<rect x="${rx.toFixed(1)}" y="${(midY - 7.5).toFixed(1)}" width="${pw.toFixed(1)}" height="12" rx="1.5" fill="#FFFFFF" opacity="0.96" />`);
          dimParts.push(`<text x="${tx.toFixed(1)}" y="${(midY + 3).toFixed(1)}" text-anchor="${dir > 0 ? "start" : "end"}" font-family="ui-monospace, monospace" font-size="10" font-weight="800" fill="${stroke}">${escXml(lbl)}</text>`);
        }
      }
    };

    // A) ALT ÖN GENİŞLİK ZİNCİRİ (Bölmeler / Modüller + Toplam W)
    const subXStops: number[] = [cMinX];
    if (modules.length > 1) {
      modSpansX
        .sort((a, b) => a.x0 - b.x0)
        .forEach((ms) => {
          if (ms.x1 > subXStops[subXStops.length - 1] + 5) subXStops.push(ms.x1);
        });
    } else {
      // Tek modülde ana ara dikme eksenlerini çıkar
      const divCenters = items
        .filter((it) => it.role === "carcass_divider")
        .map((it) => Math.round((it.x0 + it.x1) / 2))
        .sort((a, b) => a - b);
      divCenters.forEach((cxVal) => {
        if (cxVal > cMinX + 40 && cxVal < cMaxX - 40) subXStops.push(cxVal);
      });
      subXStops.push(cMaxX);
    }

    if (subXStops.length > 2) {
      drawBottomHorizChain(subXStops, 20);
      drawBottomHorizChain([cMinX, cMaxX], 42);
    } else {
      drawBottomHorizChain([cMinX, cMaxX], 22);
    }

    // B) SOL ÖN YÜKSEKLİK ZİNCİRİ (Baza + Gövde + Toplam H)
    const refMod = modules[0];
    const plinthH = Math.round(refMod?.carcass?.plinthHeight || 0);
    if (plinthH >= 20 && plinthH < dimH - 100) {
      drawIsoVertChain([cMinY, cMinY + plinthH, cMaxY], cMinX, doorFrontZ, 20, "left");
      drawIsoVertChain([cMinY, cMaxY], cMinX, doorFrontZ, 48, "left");
    } else {
      drawIsoVertChain([cMinY, cMaxY], cMinX, doorFrontZ, 22, "left");
    }

    // C) SAĞ ARKA DİKEY ZİNCİR (Sağ bölmede çekmece/kapak yüksekliği ayrımı varsa)
    const rightMod = modules[modules.length - 1];
    const rightBay = rightMod?.bays?.[rightMod.bays.length - 1];
    const extDrawers = (rightBay?.drawers || []).filter((d) => !d.isInternal).sort((a, b) => a.elevationY - b.elevationY);
    if (extDrawers.length > 0 && rightMod) {
      const rPlinth = rightMod.carcass.plinthHeight || 0;
      const rStops: number[] = [cMinY];
      if (rPlinth > 0) rStops.push(cMinY + rPlinth);
      extDrawers.forEach((dr) => {
        const topY = cMinY + rPlinth + dr.elevationY + dr.height;
        if (topY > rStops[rStops.length - 1] + 20 && topY < cMaxY - 20) {
          rStops.push(Math.round(topY));
        }
      });
      rStops.push(cMaxY);
      if (rStops.length > 2) {
        drawIsoVertChain(rStops, cMaxX, cMinZ, 20, "right");
      }
    }

    // D) SAĞ ALT İZOMETRİK DERİNLİK (Gerçek Gövde Derinliği D + varsa Kapak Kalınlığı)
    const dFront = mapP(cMaxX, cMinY, cMaxZ);
    const dBack = mapP(cMaxX, cMinY, cMinZ);
    const dOffY = 22;
    const df2 = { x: dFront.x, y: dFront.y + dOffY };
    const db2 = { x: dBack.x, y: dBack.y + dOffY };
    const dMidX = (df2.x + db2.x) / 2;
    const dMidY = (df2.y + db2.y) / 2;
    const dAngle = (Math.atan2(db2.y - df2.y, db2.x - df2.x) * 180) / Math.PI;
    const dLbl = formatSheetDim(dimD, options.unit);
    const dPw = Math.max(26, dLbl.length * 6.6 + 10);

    dimParts.push(`
      <line x1="${dFront.x.toFixed(1)}" y1="${(dFront.y + 4).toFixed(1)}" x2="${df2.x.toFixed(1)}" y2="${(df2.y + 5).toFixed(1)}" stroke="${stroke}" stroke-width="0.55" opacity="0.75" />
      <line x1="${dBack.x.toFixed(1)}" y1="${(dBack.y + 4).toFixed(1)}" x2="${db2.x.toFixed(1)}" y2="${(db2.y + 5).toFixed(1)}" stroke="${stroke}" stroke-width="0.55" opacity="0.75" />
      <line x1="${df2.x.toFixed(1)}" y1="${df2.y.toFixed(1)}" x2="${db2.x.toFixed(1)}" y2="${db2.y.toFixed(1)}" stroke="${stroke}" stroke-width="0.85" />
      ${drawTick(df2.x, df2.y)}
      ${drawTick(db2.x, db2.y)}
      <g transform="translate(${dMidX.toFixed(1)}, ${(dMidY + 2).toFixed(1)}) rotate(${dAngle.toFixed(1)})">
        <rect x="${(-dPw / 2).toFixed(1)}" y="-7.5" width="${dPw.toFixed(1)}" height="13" rx="2" fill="#FFFFFF" opacity="0.96" />
        <text x="0" y="2.5" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" font-weight="800" fill="${stroke}">${escXml(dLbl)}</text>
      </g>
    `);

    // Kapak gövde önüne taşıyorsa (+18mm vb.) üst-sağ derinlik kenarında Gövde + Kapak ayrımını göster
    if (doorProtrusionMm >= 8 && doorProtrusionMm <= 40) {
      const tdDoor = mapP(cMaxX, cMaxY, doorFrontZ);
      const tdCarc = mapP(cMaxX, cMaxY, cMaxZ);
      const tdBack = mapP(cMaxX, cMaxY, cMinZ);
      const topOffY = -16;
      const p1 = { x: tdDoor.x, y: tdDoor.y + topOffY };
      const p2 = { x: tdCarc.x, y: tdCarc.y + topOffY };
      const p3 = { x: tdBack.x, y: tdBack.y + topOffY };
      const totDLbl = `${formatSheetDim(dimD, options.unit)}+${formatSheetDim(doorProtrusionMm, options.unit)}`;
      const tPw = Math.max(38, totDLbl.length * 6.2 + 8);
      const tMidX = (p1.x + p3.x) / 2;
      const tMidY = (p1.y + p3.y) / 2;
      dimParts.push(`
        <line x1="${tdDoor.x.toFixed(1)}" y1="${(tdDoor.y - 3).toFixed(1)}" x2="${p1.x.toFixed(1)}" y2="${(p1.y - 4).toFixed(1)}" stroke="${stroke}" stroke-width="0.55" opacity="0.75" />
        <line x1="${tdBack.x.toFixed(1)}" y1="${(tdBack.y - 3).toFixed(1)}" x2="${p3.x.toFixed(1)}" y2="${(p3.y - 4).toFixed(1)}" stroke="${stroke}" stroke-width="0.55" opacity="0.75" />
        <line x1="${p1.x.toFixed(1)}" y1="${p1.y.toFixed(1)}" x2="${p3.x.toFixed(1)}" y2="${p3.y.toFixed(1)}" stroke="${stroke}" stroke-width="0.85" />
        ${drawTick(p1.x, p1.y)}
        ${drawTick(p2.x, p2.y)}
        ${drawTick(p3.x, p3.y)}
        <g transform="translate(${tMidX.toFixed(1)}, ${(tMidY - 2).toFixed(1)}) rotate(${dAngle.toFixed(1)})">
          <rect x="${(-tPw / 2).toFixed(1)}" y="-7.5" width="${tPw.toFixed(1)}" height="13" rx="2" fill="#FFFFFF" opacity="0.96" />
          <text x="0" y="2.5" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.5" font-weight="800" fill="${stroke}">${escXml(totDLbl)}</text>
        </g>
      `);
    }

    // E) İÇ DETAY ÖLÇÜLERİ (Şeffaf Kapak / Açık Kapak aktifken — doğrudan 3B bileşen koordinatlarından)
    const hasOpenFront = modules.some(
      (m) => m.isOpenFront || m.bays.some((b) => b.door?.type === "open" || b.door?.doorSystemId === "open")
    );
    if (singleModuleMode && (options.showXrayInterior || hasOpenFront)) {
      const innerColor = CAD_COLORS.plane;
      const innerParts: string[] = [];

      modules.forEach((mod) => {
        const mx0 = singleModuleMode ? 0 : mod.position?.x || 0;
        const my0 = singleModuleMode ? 0 : mod.position?.y || 0;
        const mz0 = singleModuleMode ? 0 : mod.position?.z || 0;
        const T = mod.carcass.panelThickness || 18;
        const plinth = mod.carcass.plinthHeight || 0;
        const backT = mod.carcass.backPanelThickness || 8;
        const backOff = mod.carcass.backOffsetMm ?? 12;
        const netInnerD = Math.max(50, Math.round(mod.dimensions.depth - backOff - backT));
        const modBottomY = my0 + plinth + T;
        const modTopY = my0 + mod.dimensions.height - T;
        // Tüm bölme genişlik ve raf boşluk ölçülerini gövdenin ÖN düzlemine (frontZ) hizala ki
        // izometrik kayma nedeniyle üst tablaya veya sağ yan dikmeye taşmasın!
        const frontZ = mz0 + mod.dimensions.depth;

        const modItems = items.filter(
          (it) =>
            it.x0 >= mx0 - 5 &&
            it.x1 <= mx0 + mod.dimensions.width + 5 &&
            it.y0 >= my0 - 5 &&
            it.y1 <= my0 + mod.dimensions.height + 5
        );

        const rawDivs = modItems
          .filter((it) => it.role === "carcass_divider")
          .sort((a, b) => a.x0 - b.x0);

        const baySpans: { x0: number; x1: number; bayIdx: number }[] = [];
        let curX = mx0 + T;
        rawDivs.forEach((dv, idx) => {
          if (dv.x0 > curX + 20) {
            baySpans.push({ x0: curX, x1: dv.x0, bayIdx: idx });
            curX = dv.x1;
          }
        });
        const endX = mx0 + mod.dimensions.width - T;
        if (endX > curX + 20) {
          baySpans.push({ x0: curX, x1: endX, bayIdx: baySpans.length });
        }
        if (baySpans.length === 0) {
          baySpans.push({ x0: mx0 + T, x1: mx0 + mod.dimensions.width - T, bayIdx: 0 });
        }

        baySpans.forEach((bs) => {
          const clearW = Math.round(bs.x1 - bs.x0);
          const bayMidX = (bs.x0 + bs.x1) / 2;

          // 1) Bölme Net İç Genişliği — Gövde ön düzleminde (frontZ), üst tablanın hemen altında
          const pL = mapP(bs.x0, modTopY - 42, frontZ);
          const pR = mapP(bs.x1, modTopY - 42, frontZ);
          if (Math.abs(pR.x - pL.x) >= 14) {
            const wLbl = `İç ${formatSheetDim(clearW, options.unit)}`;
            const pw = Math.max(26, wLbl.length * 5.8 + 8);
            const mxMid = (pL.x + pR.x) / 2;
            const myMid = (pL.y + pR.y) / 2;
            innerParts.push(`
              <line x1="${pL.x.toFixed(1)}" y1="${pL.y.toFixed(1)}" x2="${pR.x.toFixed(1)}" y2="${pR.y.toFixed(1)}" stroke="${innerColor}" stroke-width="0.8" stroke-dasharray="3 2" />
              <line x1="${pL.x.toFixed(1)}" y1="${(pL.y - 3.5).toFixed(1)}" x2="${pL.x.toFixed(1)}" y2="${(pL.y + 3.5).toFixed(1)}" stroke="${innerColor}" stroke-width="1" />
              <line x1="${pR.x.toFixed(1)}" y1="${(pR.y - 3.5).toFixed(1)}" x2="${pR.x.toFixed(1)}" y2="${(pR.y + 3.5).toFixed(1)}" stroke="${innerColor}" stroke-width="1" />
              <rect x="${(mxMid - pw / 2).toFixed(1)}" y="${(myMid - 6.5).toFixed(1)}" width="${pw.toFixed(1)}" height="12.5" rx="2" fill="#EFF6FF" stroke="${innerColor}" stroke-width="0.55" opacity="0.96" />
              <text x="${mxMid.toFixed(1)}" y="${(myMid + 3).toFixed(1)}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.5" font-weight="800" fill="${innerColor}">${escXml(wLbl)}</text>
            `);
          }

          // 2) Bölmedeki gerçek 3B raf & çekmece elemanlarından net düşey boşluklar (frontZ düzleminde tam oturur)
          const bayItems = modItems.filter((it) => {
            const ov = Math.min(it.x1, bs.x1) - Math.max(it.x0, bs.x0);
            return ov > Math.min(40, (bs.x1 - bs.x0) * 0.4);
          });
          const bayShelves = bayItems
            .filter((it) => it.role === "shelf")
            .sort((a, b) => a.y0 - b.y0);
          const bayDrawers = bayItems
            .filter((it) => it.role === "drawer_front")
            .sort((a, b) => a.y0 - b.y0);
          const bayRails = bayItems
            .filter((it) => it.role === "hanging_rail")
            .sort((a, b) => a.y0 - b.y0);

          const drwTopY = bayDrawers.reduce((acc, dr) => Math.max(acc, dr.y1), modBottomY);
          const yCuts: { bot: number; top: number }[] = [];
          let prevY = drwTopY > modBottomY + 20 ? drwTopY : modBottomY;
          bayShelves.forEach((sh) => {
            if (sh.y0 - prevY >= 60) yCuts.push({ bot: prevY, top: sh.y0 });
            if (sh.y1 > prevY) prevY = sh.y1;
          });
          if (modTopY - prevY >= 60) yCuts.push({ bot: prevY, top: modTopY });

          // Düşey ekseni bölme genişliğinin %38'inde tut ki üstteki "İç W" etiketi ve ortadaki kulplarla çakışmasın
          const vertAxisX = bs.x0 + (bs.x1 - bs.x0) * 0.36;
          yCuts.forEach((seg) => {
            const spanMm = Math.round(seg.top - seg.bot);
            const pB = mapP(vertAxisX, seg.bot, frontZ);
            const pT = mapP(vertAxisX, seg.top, frontZ);
            if (Math.abs(pB.y - pT.y) >= 16) {
              const gLbl = formatSheetDim(spanMm, options.unit);
              const pw = Math.max(24, gLbl.length * 6.0 + 8);
              const midY = (pB.y + pT.y) / 2;
              innerParts.push(`
                <line x1="${pB.x.toFixed(1)}" y1="${pB.y.toFixed(1)}" x2="${pT.x.toFixed(1)}" y2="${pT.y.toFixed(1)}" stroke="${innerColor}" stroke-width="0.75" stroke-dasharray="3 2" />
                <line x1="${(pB.x - 3.5).toFixed(1)}" y1="${pB.y.toFixed(1)}" x2="${(pB.x + 3.5).toFixed(1)}" y2="${pB.y.toFixed(1)}" stroke="${innerColor}" stroke-width="1" />
                <line x1="${(pT.x - 3.5).toFixed(1)}" y1="${pT.y.toFixed(1)}" x2="${(pT.x + 3.5).toFixed(1)}" y2="${pT.y.toFixed(1)}" stroke="${innerColor}" stroke-width="1" />
                <rect x="${(pB.x - pw / 2).toFixed(1)}" y="${(midY - 6.5).toFixed(1)}" width="${pw.toFixed(1)}" height="12.5" rx="2" fill="#EFF6FF" stroke="${innerColor}" stroke-width="0.55" opacity="0.96" />
                <text x="${pB.x.toFixed(1)}" y="${(midY + 3).toFixed(1)}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.5" font-weight="800" fill="${innerColor}">${escXml(gLbl)}</text>
              `);
            }
          });

          // 3) Askı Borusu Kotu — Bölmenin sağ tarafında (%68) konumlandır, düşey ölçü çizgisiyle çakışmasın
          bayRails.forEach((hr) => {
            const pRail = mapP(bs.x0 + (bs.x1 - bs.x0) * 0.68, (hr.y0 + hr.y1) / 2, frontZ);
            const rLbl = `Askı +${formatSheetDim(Math.round(hr.y0 - my0), options.unit)}`;
            const pw = Math.max(40, rLbl.length * 5.6 + 8);
            innerParts.push(`
              <rect x="${(pRail.x - pw / 2).toFixed(1)}" y="${(pRail.y - 6.5).toFixed(1)}" width="${pw.toFixed(1)}" height="12.5" rx="2" fill="#FFFFFF" stroke="${innerColor}" stroke-width="0.6" opacity="0.96" />
              <text x="${pRail.x.toFixed(1)}" y="${(pRail.y + 3).toFixed(1)}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.5" font-weight="800" fill="${innerColor}">${escXml(rLbl)}</text>
            `);
          });

          // 4) Çekmece Yükseklikleri — Ortadaki çekmece kulpunun soluna (%24) yerleştir
          bayDrawers.forEach((dr, dIdx) => {
            const pDrw = mapP(bs.x0 + (bs.x1 - bs.x0) * 0.24, (dr.y0 + dr.y1) / 2, dr.z1);
            const dLbl = `Ç${dIdx + 1}: ${formatSheetDim(Math.round(dr.y1 - dr.y0), options.unit)}`;
            const pw = Math.max(34, dLbl.length * 5.6 + 8);
            innerParts.push(`
              <rect x="${(pDrw.x - pw / 2).toFixed(1)}" y="${(pDrw.y - 6.5).toFixed(1)}" width="${pw.toFixed(1)}" height="12.5" rx="2" fill="#FFFFFF" stroke="${innerColor}" stroke-width="0.55" opacity="0.95" />
              <text x="${pDrw.x.toFixed(1)}" y="${(pDrw.y + 3).toFixed(1)}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.5" font-weight="800" fill="${innerColor}">${escXml(dLbl)}</text>
            `);
          });
        });

        // 5) Net İç Derinlik Etiketi — Sol yan iç taban köşesi boyunca (-30° izometrik açıya paralel)
        const pInBack = mapP(mx0 + T, modBottomY + 12, mz0 + backOff + backT);
        const pInFront = mapP(mx0 + T, modBottomY + 12, frontZ);
        const idLbl = `İç D: ${formatSheetDim(netInnerD, options.unit)}`;
        const idPw = Math.max(42, idLbl.length * 5.6 + 8);
        const idMidX = (pInBack.x + pInFront.x) / 2;
        const idMidY = (pInBack.y + pInFront.y) / 2;
        const idAng = (Math.atan2(pInBack.y - pInFront.y, pInBack.x - pInFront.x) * 180) / Math.PI;
        innerParts.push(`
          <line x1="${pInBack.x.toFixed(1)}" y1="${pInBack.y.toFixed(1)}" x2="${pInFront.x.toFixed(1)}" y2="${pInFront.y.toFixed(1)}" stroke="${innerColor}" stroke-width="0.8" stroke-dasharray="3 2" />
          <g transform="translate(${idMidX.toFixed(1)}, ${(idMidY - 6).toFixed(1)}) rotate(${idAng.toFixed(1)})">
            <rect x="${(-idPw / 2).toFixed(1)}" y="-6.5" width="${idPw.toFixed(1)}" height="12.5" rx="2" fill="#EFF6FF" stroke="${innerColor}" stroke-width="0.55" opacity="0.96" />
            <text x="0" y="3" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.5" font-weight="800" fill="${innerColor}">${escXml(idLbl)}</text>
          </g>
        `);
      });

      dimParts.push(`<g class="cad-iso-interior-dimensions">${innerParts.join("")}</g>`);
    }

    isoDimsSvg = `<g class="cad-iso-dimensions">${dimParts.join("")}</g>`;
  }

  const extra = onProjectedItems ? onProjectedItems(mappedList) : "";
  return `<g>${polys}${isoDimsSvg}${extra}</g>`;
}

export function renderIsoSheetChromeAndTitleBlock(
  ctx: SheetBuildContext,
  page: SheetPageDescriptor,
  effectiveScale: string,
  notesLines: string[] = []
): { frameX: number; frameY: number; frameW: number; frameH: number; titleH: number; chromeSvg: string } {
  const { project, bom, meta, options } = ctx;
  const paper = SHEET_PAPER_SPECS[options.paperFormat];
  const W = paper.svgWidth;
  const H = paper.svgHeight;
  const margin = 28;
  const frameX = margin + 14;
  const frameY = margin;
  const frameW = W - margin * 2 - 14;
  const frameH = H - margin * 2;
  const titleW = Math.min(590, Math.round(frameW * 0.365));
  const titleH = 98;
  const titleX = frameX + frameW - titleW;
  const titleY = frameY + frameH - titleH;

  let gridTicks = "";
  if (options.showGridTicks) {
    const cols = 8;
    const rows = 6;
    for (let i = 0; i < cols; i++) {
      const cx = frameX + ((i + 0.5) * frameW) / cols;
      const gx = frameX + (i * frameW) / cols;
      if (i > 0) {
        gridTicks += `<line x1="${gx}" y1="${frameY - 8}" x2="${gx}" y2="${frameY}" stroke="#475569" stroke-width="0.8" />`;
        gridTicks += `<line x1="${gx}" y1="${frameY + frameH}" x2="${gx}" y2="${frameY + frameH + 8}" stroke="#475569" stroke-width="0.8" />`;
      }
      gridTicks += `<text x="${cx}" y="${frameY - 3}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" font-weight="700" fill="#475569">${i + 1}</text>`;
      gridTicks += `<text x="${cx}" y="${frameY + frameH + 11}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" font-weight="700" fill="#475569">${i + 1}</text>`;
    }
    const letters = ["A", "B", "C", "D", "E", "F"];
    for (let j = 0; j < rows; j++) {
      const cy = frameY + ((j + 0.5) * frameH) / rows + 3;
      const gy = frameY + (j * frameH) / rows;
      if (j > 0) {
        gridTicks += `<line x1="${frameX - 8}" y1="${gy}" x2="${frameX}" y2="${gy}" stroke="#475569" stroke-width="0.8" />`;
        gridTicks += `<line x1="${frameX + frameW}" y1="${gy}" x2="${frameX + frameW + 8}" y2="${gy}" stroke="#475569" stroke-width="0.8" />`;
      }
      gridTicks += `<text x="${frameX - 10}" y="${cy}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" font-weight="700" fill="#475569">${letters[j]}</text>`;
      gridTicks += `<text x="${frameX + frameW + 10}" y="${cy}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" font-weight="700" fill="#475569">${letters[j]}</text>`;
    }
  }

  const gatePassed = bom.productionGate?.isReadyForErp ?? false;
  const gateText = gatePassed ? "ÜRETİME HAZIR" : "TASLAK — ÜRETİM ONAYI BEKLİYOR";
  const gateColor = gatePassed ? "#15803D" : "#B91C1C";
  const dateStr = new Date().toLocaleDateString("tr-TR");
  const primaryMod = typeof page.moduleIndex === "number" ? project.modules[page.moduleIndex] : project.modules[0];
  const bodyMat = primaryMod ? getMaterialName(project, primaryMod.carcass.bodyMaterialId) : "-";
  const doorMat = primaryMod ? getMaterialName(project, primaryMod.carcass.doorMaterialId) : "-";

  const defaultNotes =
    notesLines.length > 0
      ? notesLines
      : [
          `1. Tüm ölçüler ${options.unit} cinsindendir. Genel imalat toleransı ISO 2768-m (±0.5 mm).`,
          `2. Gövde: ${bodyMat} | Kapak: ${doorMat}.`,
          `3. Kesim listesi ölçüleri 1 mm PVC kenar bandı payı düşülmüş net testere ölçüleridir.`,
        ];

  const notesX = frameX + 14;
  const notesY = titleY + 14;
  const notesSvg = `
    <g>
      <text x="${notesX}" y="${notesY}" font-family="Segoe UI, sans-serif" font-size="10.5" font-weight="800" fill="${CAD_COLORS.ink}">AÇIKLAMALAR &amp; STANDARTLAR:</text>
      ${defaultNotes
        .slice(0, 4)
        .map(
          (ln, i) =>
            `<text x="${notesX}" y="${notesY + 15 + i * 14}" font-family="Segoe UI, sans-serif" font-size="10" fill="${CAD_COLORS.subInk}">${escXml(ln)}</text>`
        )
        .join("")}
      <rect x="${titleX - 245}" y="${titleY + 58}" width="232" height="24" fill="#FFF" stroke="${gateColor}" stroke-width="1.3" />
      <text x="${titleX - 129}" y="${titleY + 73.5}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" font-weight="800" fill="${gateColor}">${escXml(gateText)}</text>
    </g>
  `;

  const cMid = titleX + Math.round(titleW * 0.36);
  const r1 = titleY + 28;
  const r2 = titleY + 52;
  const r3 = titleY + 75;
  const titleSvg = `
    <g>
      <rect x="${titleX}" y="${titleY}" width="${titleW}" height="${titleH}" fill="#FFFFFF" stroke="${CAD_COLORS.ink}" stroke-width="1.6" />
      <line x1="${cMid}" y1="${titleY}" x2="${cMid}" y2="${titleY + titleH}" stroke="${CAD_COLORS.ink}" stroke-width="1" />
      <line x1="${titleX}" y1="${r1}" x2="${titleX + titleW}" y2="${r1}" stroke="${CAD_COLORS.ink}" stroke-width="0.85" />
      <line x1="${titleX}" y1="${r2}" x2="${titleX + titleW}" y2="${r2}" stroke="${CAD_COLORS.ink}" stroke-width="0.85" />
      <line x1="${cMid}" y1="${r3}" x2="${titleX + titleW}" y2="${r3}" stroke="${CAD_COLORS.ink}" stroke-width="0.85" />

      <!-- Brand & Projection Symbol -->
      <text x="${titleX + 10}" y="${titleY + 19}" font-family="Segoe UI, sans-serif" font-size="14" font-weight="900" letter-spacing="1" fill="${CAD_COLORS.ink}">${escXml(meta.companyName || "BİRİM®")}</text>
      <text x="${titleX + 10}" y="${r1 + 16}" font-size="10" font-weight="700" fill="${CAD_COLORS.subInk}">Sipariş: ${escXml(meta.customerOrOrderNo || "-")}</text>
      <text x="${titleX + 10}" y="${r2 + 16}" font-size="10" fill="${CAD_COLORS.subInk}">Çizen: ${escXml(meta.drawnBy)}</text>
      <text x="${titleX + 10}" y="${r2 + 32}" font-size="10" fill="${CAD_COLORS.subInk}">Onay: ${escXml(meta.approvedBy)}</text>
      <!-- ISO 128 First-Angle Projection Symbol -->
      <g transform="translate(${cMid - 34}, ${titleY + 14})" stroke="${CAD_COLORS.ink}" stroke-width="0.95" fill="none">
        <polygon points="-14,-4 -3,-6.5 -3,6.5 -14,4" />
        <circle cx="7" cy="0" r="6.5" />
        <circle cx="7" cy="0" r="3.5" />
        <line x1="-17" y1="0" x2="16" y2="0" stroke-dasharray="4 1.5 1 1.5" stroke-width="0.6" />
        <line x1="7" y1="-9" x2="7" y2="9" stroke-dasharray="4 1.5 1 1.5" stroke-width="0.6" />
      </g>

      <!-- Right Info Columns -->
      <text x="${cMid + 8}" y="${titleY + 18}" font-family="Segoe UI, sans-serif" font-size="11" font-weight="800" fill="${CAD_COLORS.ink}">${escXml((meta.projectTitle || project.title).slice(0, 48))}</text>
      <text x="${cMid + 8}" y="${r1 + 17}" font-family="Segoe UI, sans-serif" font-size="10.5" font-weight="800" fill="${CAD_COLORS.ink}">${escXml(page.title.slice(0, 56))}</text>
      <text x="${cMid + 8}" y="${r2 + 16}" font-family="ui-monospace, monospace" font-size="10.5" font-weight="700" fill="${CAD_COLORS.subInk}">Çizim No: ${escXml(meta.sheetCodePrefix)}-${escXml(page.sheetNo)} • Rev: v${project.version || 1} • ${escXml(dateStr)}</text>
      <text x="${cMid + 8}" y="${r3 + 16}" font-family="ui-monospace, monospace" font-size="10" font-weight="800" fill="${CAD_COLORS.ink}">Ölçek: ${escXml(effectiveScale)}   Birim: ${options.unit}   Pafta: ${escXml(paper.id.replace("_LANDSCAPE", ""))}   Sayfa: ${escXml(page.sheetNo)}</text>
    </g>
  `;

  const chromeSvg = `
    <rect x="2" y="2" width="${W - 4}" height="${H - 4}" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1" />
    <rect x="${frameX}" y="${frameY}" width="${frameW}" height="${frameH}" fill="#FFFFFF" stroke="${CAD_COLORS.ink}" stroke-width="2" />
    ${gridTicks}
    ${notesSvg}
    ${titleSvg}
  `;

  return { frameX, frameY, frameW, frameH, titleH, chromeSvg };
}
