import { DEFAULT_MATERIALS } from "@birim/core";
import {
  calculateBayWidths,
  calculateModulePlacement,
  type DesignProject,
  type ModuleInstance,
  type WallDefinition,
} from "@birim/core";
import {
  generateCrossSection2D,
  generateElevation2D,
  generateModuleGeometry,
  generateTopPlan2D,
  type Elevation2DData,
  type ModuleGeometryBreakdown,
} from "@birim/geometry";
import {
  CAD_COLORS,
  escXml,
  formatSheetDim,
  isDoorLeafRole,
  renderClosedHorizontalChain,
  renderClosedVerticalChain,
  renderDatumMarker,
  renderDimLine,
  renderIsoSheetChromeAndTitleBlock,
  renderIsometricViewport,
  renderViewCaption,
  SHEET_PAPER_SPECS,
  type SheetBuildContext,
  type SheetDisplayOptions,
  type SheetPageDescriptor,
  type ViewportBox,
} from "./productionSheetTypes";
import {
  renderCuttingEdgebandSheet,
  renderExplodedBomSheet,
  renderJoineryDetailsSheet,
  renderPanelDrillingSheet,
} from "./productionSheetDetailPages";

export * from "./productionSheetTypes";

function countActiveWallGroups(project: DesignProject): number {
  const dirs = new Set<string>();
  project.modules.forEach((m) => {
    const r = (((m.rotation?.y || 0) % 360) + 360) % 360;
    if (r < 45 || r > 315) dirs.add("main");
    else if (r >= 45 && r < 135) dirs.add("left");
    else if (r >= 225 && r <= 315) dirs.add("right");
    else dirs.add("front");
  });
  return dirs.size;
}

export function buildSheetPages(project: DesignProject): SheetPageDescriptor[] {
  const wallCount = countActiveWallGroups(project);
  const hasMultiWall = wallCount >= 2;
  const total = Math.max(1, 1 + (hasMultiWall ? 1 : 0) + project.modules.length * 6);
  const pad = (n: number) => String(n).padStart(2, "0");
  const pages: SheetPageDescriptor[] = [
    {
      id: "overview",
      kind: "overview",
      sheetNo: `${pad(1)}/${pad(total)}`,
      title: "GENEL YERLEŞİM & MEKÂN PAFTASI",
      subtitle: `${project.modules.length} Modül • Mekân Planı, Ön Cephe, 3B Perspektif & Proje Özeti`,
    },
  ];
  if (hasMultiWall) {
    pages.push({
      id: "wall_elevations",
      kind: "wall_elevations",
      sheetNo: `${pad(2)}/${pad(total)}`,
      title: "DUVAR CEPHE GÖRÜNÜŞLERİ (L / U SİSTEM)",
      subtitle: `${wallCount} Duvar Cephesi • Ayrı Ölçülendirilmiş Görünüşler`,
    });
  }
  project.modules.forEach((mod, idx) => {
    const b = (hasMultiWall ? 3 : 2) + idx * 6;
    const tag = `M${idx + 1} (${mod.name.toUpperCase()})`;
    const shortTag = tag.length > 26 ? `M${idx + 1}` : tag;
    pages.push(
      {
        id: `views_${mod.id}`,
        kind: "module_views",
        sheetNo: `${pad(b)}/${pad(total)}`,
        title: `${shortTag} — GÖRÜNÜŞLER & KESİTLER`,
        subtitle: "Kapalı Ön Görünüş, Kapaksız İç Görünüş, A-A Düşey Kesit & B-B Yatay Plan Kesiti",
        moduleIndex: idx,
        moduleId: mod.id,
      },
      {
        id: `joinery_${mod.id}`,
        kind: "joinery_details",
        sheetNo: `${pad(b + 1)}/${pad(total)}`,
        title: `${shortTag} — 1:2 DÜĞÜM DETAYLARI`,
        subtitle: "Minifiks+Kavela, Kanallı Arkalık, Baza/Ayak & Ø35 Menteşe Detayları",
        moduleIndex: idx,
        moduleId: mod.id,
      },
      {
        id: `exploded_${mod.id}`,
        kind: "exploded_bom",
        sheetNo: `${pad(b + 2)}/${pad(total)}`,
        title: `${shortTag} — PATLATILMIŞ MONTAJ & BOM`,
        subtitle: "Patlatılmış 3B Montaj Perspektifi, Poz Balonları (P1..Pn) & Montaj Sırası",
        moduleIndex: idx,
        moduleId: mod.id,
      },
      {
        id: `drilling_${mod.id}`,
        kind: "panel_drilling",
        sheetNo: `${pad(b + 3)}/${pad(total)}`,
        title: `${shortTag} — PANEL İŞLEME & DELİK PLANI`,
        subtitle: "Yan Dikme & Kapak Delik Detayları, Ø35 Tas (1:1) & Delik Koordinat Tablosu",
        moduleIndex: idx,
        moduleId: mod.id,
      },
      {
        id: `cutting_${mod.id}`,
        kind: "cutting_edgeband",
        sheetNo: `${pad(b + 4)}/${pad(total)}`,
        title: `${shortTag} — KESİM LİSTESİ & KENAR BANT`,
        subtitle: "Tam Testere Kesim Listesi (mm), Hırdavat Listesi & Suyolu/Kenar Bandı Şeması",
        moduleIndex: idx,
        moduleId: mod.id,
      },
      {
        id: `iso_dims_${mod.id}`,
        kind: "isometric_dimensions",
        sheetNo: `${pad(b + 5)}/${pad(total)}`,
        title: `${shortTag} — 3B İZOMETRİK ÖLÇÜ PAFTASI`,
        subtitle: "3B Dış Ölçülü Perspektif (Kapalı) & İç Detay Ölçülü Şeffaf Perspektif",
        moduleIndex: idx,
        moduleId: mod.id,
      }
    );
  });
  return pages;
}

function getElementStyle(
  role: string,
  mode: "elevation" | "interior" | "plan" | "section",
  showSectionHatch: boolean,
  hatchId: string,
  sectionDir: "Z" | "X" = "Z"
): { fill: string; stroke: string; strokeWidth: number; opacity: number; skip?: boolean } {
  if (role === "door_hinge" || role === "drawer_slide" || role === "special_fitting") {
    return { fill: "none", stroke: "none", strokeWidth: 0, opacity: 0, skip: true };
  }
  if (isDoorLeafRole(role) || role === "drawer_front" || role === "door_handle" || role === "drawer_handle") {
    if (mode === "interior") {
      return { fill: "none", stroke: "none", strokeWidth: 0, opacity: 0, skip: true };
    }
    return {
      fill: role.includes("handle") ? "#475569" : "#FFFFFF",
      stroke: CAD_COLORS.ink,
      strokeWidth: role.includes("handle") ? 0.85 : 1.0,
      opacity: 1,
    };
  }
  if (role === "hanging_rail") {
    return { fill: "#CBD5E1", stroke: CAD_COLORS.ink, strokeWidth: 0.9, opacity: 1 };
  }
  if (role === "plinth") {
    return {
      fill: mode === "section" && showSectionHatch ? `url(#${hatchId})` : "#E2E8F0",
      stroke: CAD_COLORS.ink,
      strokeWidth: mode === "section" ? 1.5 : 1.0,
      opacity: 1,
    };
  }
  if (role === "carcass_back") {
    const isCutBack = mode === "plan" || (mode === "section" && sectionDir === "Z");
    return {
      fill: isCutBack && showSectionHatch ? `url(#${hatchId})` : "#F8FAFC",
      stroke: isCutBack ? CAD_COLORS.ink : "#94A3B8",
      strokeWidth: isCutBack ? 1.4 : 0.7,
      opacity: 1,
    };
  }
  if (role.startsWith("carcass_") || role === "shelf" || role === "sub_divider" || role === "countertop") {
    const isCutPanel = mode === "section" || mode === "plan";
    return {
      fill: isCutPanel && showSectionHatch ? `url(#${hatchId})` : "#F1F5F9",
      stroke: CAD_COLORS.ink,
      strokeWidth: isCutPanel ? 1.55 : 0.95,
      opacity: 1,
    };
  }
  if (role.startsWith("drawer_")) {
    return { fill: "#F8FAFC", stroke: "#475569", strokeWidth: 0.85, opacity: 1 };
  }
  return { fill: "#FFFFFF", stroke: "#475569", strokeWidth: 0.8, opacity: 1 };
}

function renderOrthographic2D(
  data: Elevation2DData,
  box: ViewportBox,
  mode: "elevation" | "interior" | "plan" | "section",
  options: SheetDisplayOptions,
  hatchId: string,
  pxPerMm: number,
  overlayFn?: (mapX: (x: number) => number, mapY: (y: number) => number) => string,
  sectionDir: "Z" | "X" = "Z",
  backgroundElementIds?: Set<string>
): string {
  let gMinX = Infinity, gMaxX = -Infinity, gMinY = Infinity, gMaxY = -Infinity;
  data.elements.forEach((el) => {
    if (el.x < gMinX) gMinX = el.x;
    if (el.x + el.width > gMaxX) gMaxX = el.x + el.width;
    if (el.y < gMinY) gMinY = el.y;
    if (el.y + el.height > gMaxY) gMaxY = el.y + el.height;
  });
  if (!Number.isFinite(gMinX)) {
    gMinX = 0; gMaxX = 1000; gMinY = 0; gMaxY = 1000;
  }

  const geomW = (gMaxX - gMinX) * pxPerMm;
  const geomH = (gMaxY - gMinY) * pxPerMm;
  const offX = box.x + (box.w - geomW) / 2 - gMinX * pxPerMm;
  const offY = box.y + (box.h - geomH) / 2 - gMinY * pxPerMm;
  const mapX = (x: number) => offX + x * pxPerMm;
  const mapY = (y: number) => offY + y * pxPerMm;

  // Draw background-bay projected elements first (thin dashed light-grey), then active cut-plane elements solidly on top
  const bgRects: string[] = [];
  const fgRects: string[] = [];
  data.elements.forEach((el) => {
    const st = getElementStyle(el.role, mode, options.showSectionHatch, hatchId, sectionDir);
    if (st.skip) return;
    const rx = mapX(el.x);
    const ry = mapY(el.y);
    const rw = Math.max(0.8, el.width * pxPerMm);
    const rh = Math.max(0.8, el.height * pxPerMm);
    const isBg = mode === "section" && backgroundElementIds && backgroundElementIds.has(el.id);
    if (isBg) {
      bgRects.push(
        `<rect x="${rx.toFixed(2)}" y="${ry.toFixed(2)}" width="${rw.toFixed(2)}" height="${rh.toFixed(2)}" fill="none" stroke="#94A3B8" stroke-width="0.65" stroke-dasharray="4 3" opacity="0.55" />`
      );
      return;
    }
    let swing = "";
    if (mode === "elevation" && (el.role === "door_left" || el.role === "door_right")) {
      const hx = el.role === "door_left" ? rx : rx + rw;
      const ox = el.role === "door_left" ? rx + rw : rx;
      swing = `<polyline points="${hx.toFixed(1)},${ry.toFixed(1)} ${ox.toFixed(1)},${(ry + rh / 2).toFixed(1)} ${hx.toFixed(1)},${(ry + rh).toFixed(1)}" fill="none" stroke="#64748B" stroke-width="0.6" stroke-dasharray="3 3" opacity="0.65" />`;
    }
    fgRects.push(
      `<rect x="${rx.toFixed(2)}" y="${ry.toFixed(2)}" width="${rw.toFixed(2)}" height="${rh.toFixed(2)}" fill="${st.fill}" stroke="${st.stroke}" stroke-width="${st.strokeWidth}" />${swing}`
    );
  });
  const rects = bgRects.join("") + fgRects.join("");

  const overlay = overlayFn ? overlayFn(mapX, mapY) : "";
  return `<g>${rects}${overlay}</g>`;
}

function extractBayInteriorStops(
  bd: ModuleGeometryBreakdown,
  bayX0: number,
  bayX1: number,
  H: number,
  plinth: number
): number[] {
  const stops = new Set<number>([0, H]);
  if (plinth > 0 && plinth < H) stops.add(H - plinth);

  bd.components.forEach((c) => {
    const cx0 = c.position.x;
    const cx1 = cx0 + c.dimensions.width;
    const overlap = Math.min(cx1, bayX1) - Math.max(cx0, bayX0);
    if (overlap < 20) return;
    if (
      c.role === "carcass_top" ||
      c.role === "carcass_bottom" ||
      c.role === "shelf"
    ) {
      // Convert 3D Y (0=floor..H=top) to 2D elevation Y (0=top..H=floor)
      const yTop2D = Math.round(H - (c.position.y + c.dimensions.height));
      const yBot2D = Math.round(H - c.position.y);
      if (yTop2D >= 0 && yTop2D <= H) stops.add(yTop2D);
      if (yBot2D >= 0 && yBot2D <= H) stops.add(yBot2D);
    } else if (c.role === "drawer_front") {
      // Only add drawer top edge when it clears carcass_bottom / shelf by >24mm (avoids 16mm overlap sliver)
      const yTop2D = Math.round(H - (c.position.y + c.dimensions.height));
      const carcassFloor2D = H - plinth - 18;
      if (yTop2D >= 24 && yTop2D <= carcassFloor2D - 24) {
        stops.add(yTop2D);
      }
    }
  });

  const sorted = Array.from(stops).sort((a, b) => a - b);
  const cleaned: number[] = [];
  for (const s of sorted) {
    if (cleaned.length === 0 || s - cleaned[cleaned.length - 1] >= 4) {
      cleaned.push(s);
    }
  }
  return cleaned;
}

function extractFrontSplitStops(
  elevData: Elevation2DData,
  targetX: number,
  H: number,
  plinth: number
): number[] {
  const stops = new Set<number>([0, H]);
  if (plinth > 0 && plinth < H) stops.add(H - plinth);
  elevData.elements.forEach((el) => {
    if (isDoorLeafRole(el.role) || el.role === "drawer_front") {
      if (targetX >= el.x - 2 && targetX <= el.x + el.width + 2) {
        stops.add(Math.round(el.y));
        stops.add(Math.round(el.y + el.height));
      }
    }
  });
  const sorted = Array.from(stops).sort((a, b) => a - b);
  const cleaned: number[] = [];
  for (const s of sorted) {
    if (cleaned.length === 0 || s - cleaned[cleaned.length - 1] >= 6) {
      cleaned.push(s);
    }
  }
  return cleaned;
}

function renderInteriorBayVerticalDim(
  stops: number[],
  cx: number,
  my: (y: number) => number,
  unit: "mm" | "cm",
  stroke = "#0F766E"
): string {
  if (stops.length < 2) return "";
  const parts: string[] = [];
  const yTop = my(stops[0]);
  const yBot = my(stops[stops.length - 1]);
  parts.push(`<line x1="${cx.toFixed(1)}" y1="${yTop.toFixed(1)}" x2="${cx.toFixed(1)}" y2="${yBot.toFixed(1)}" stroke="${stroke}" stroke-width="0.75" stroke-dasharray="3 2" />`);
  for (let i = 0; i < stops.length - 1; i++) {
    const span = stops[i + 1] - stops[i];
    if (span < 35) continue; // Only label clear openings & drawer heights inside bay
    const yA = my(stops[i]);
    const yB = my(stops[i + 1]);
    if (yB - yA < 18) continue;
    const midY = (yA + yB) / 2;
    const lbl = formatSheetDim(span, unit);
    const pw = Math.max(20, lbl.length * 6.5 + 8);
    parts.push(`<line x1="${(cx - 5).toFixed(1)}" y1="${yA.toFixed(1)}" x2="${(cx + 5).toFixed(1)}" y2="${yA.toFixed(1)}" stroke="${stroke}" stroke-width="1" />`);
    parts.push(`<line x1="${(cx - 5).toFixed(1)}" y1="${yB.toFixed(1)}" x2="${(cx + 5).toFixed(1)}" y2="${yB.toFixed(1)}" stroke="${stroke}" stroke-width="1" />`);
    parts.push(`<rect x="${(cx - pw / 2).toFixed(1)}" y="${(midY - 6.5).toFixed(1)}" width="${pw.toFixed(1)}" height="13" rx="2" fill="#FFFFFF" opacity="0.94" />`);
    parts.push(`<text x="${cx.toFixed(1)}" y="${(midY + 3.2).toFixed(1)}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" font-weight="800" fill="${stroke}">${escXml(lbl)}</text>`);
  }
  return `<g class="cad-interior-bay-dim">${parts.join("")}</g>`;
}

function buildModuleViewsSheet(
  ctx: SheetBuildContext,
  mod: ModuleInstance,
  area: ViewportBox,
  hatchId: string,
  paperWidthMm: number,
  paperSvgW: number
): { svg: string; scaleLabel: string } {
  const { options } = ctx;
  const bd = generateModuleGeometry(mod);
  const planData = generateTopPlan2D(bd);
  const elevData = generateElevation2D(bd);
  const secAData = generateCrossSection2D(bd, undefined, { direction: "Z" });

  const T = mod.carcass.panelThickness || 18;
  const plinth = mod.carcass.plinthHeight || 0;
  const W = bd.overall.width;
  const H = bd.overall.height;
  const D = bd.overall.depth;
  const bayWidths = calculateBayWidths(mod);

  const xStops: number[] = [0];
  const bayRanges: { x0: number; x1: number; w: number }[] = [];
  let cxMm = 0;
  bayWidths.forEach((bw) => {
    cxMm += T;
    xStops.push(cxMm);
    const bx0 = cxMm;
    cxMm += bw;
    xStops.push(cxMm);
    bayRanges.push({ x0: bx0, x1: cxMm, w: bw });
  });
  xStops.push(W);

  // Per-bay vertical stops (Left bay, Middle bays, Right bay)
  const bayStopLists = bayRanges.map((br) => extractBayInteriorStops(bd, br.x0, br.x1, H, plinth));
  const leftBayStops = bayStopLists[0] ?? [0, H];
  const rightBayStops = bayStopLists[bayStopLists.length - 1] ?? [0, H];
  const rightDiffersFromLeft =
    bayStopLists.length > 1 &&
    JSON.stringify(rightBayStops) !== JSON.stringify(leftBayStops);

  // 4 cleanly proportioned views with generous dimension gutters
  const col1W = Math.round(area.w * 0.34);
  const col2W = Math.round(area.w * 0.35);
  const col3W = area.w - col1W - col2W - 24;
  const tallH = area.h - 52;
  const planH = Math.round(area.h * 0.35);
  const secAH = area.h - planH - 42;

  const closedBox: ViewportBox = { x: area.x + 48, y: area.y + 18, w: col1W - 88, h: tallH - 52 };
  const openBox: ViewportBox = { x: area.x + col1W + 56, y: area.y + 18, w: col2W - 102, h: tallH - 52 };
  const planBox: ViewportBox = { x: area.x + col1W + col2W + 60, y: area.y + 18, w: col3W - 96, h: planH - 50 };
  const secABox: ViewportBox = { x: area.x + col1W + col2W + 60, y: area.y + planH + 34, w: col3W - 96, h: secAH - 50 };

  const fitPx = Math.min(
    (closedBox.w - 20) / Math.max(400, W + 80),
    (closedBox.h - 30) / Math.max(400, H + 80),
    (openBox.w - 20) / Math.max(400, W + 80),
    (secABox.h - 30) / Math.max(400, H + 80),
    (planBox.w - 20) / Math.max(400, W + 80)
  );
  const unitsPerMmPaper = paperSvgW / paperWidthMm;
  const reqDenom = options.scale === "auto" ? null : Number(options.scale.split(":")[1]) || 20;
  const pxPerMm = reqDenom ? Math.min(fitPx * 1.1, unitsPerMmPaper / reqDenom) : fitPx;
  const denom = Math.max(5, Math.round(unitsPerMmPaper / Math.max(0.01, pxPerMm)));
  const scaleLabel = options.scale === "auto" ? `1:${denom} (Oto)` : `1:${denom}`;

  // 1. KAPALI ÖN GÖRÜNÜŞ (with left AND right front split dimensions when asymmetric)
  const closedSvg =
    renderOrthographic2D(elevData, closedBox, "elevation", options, hatchId, pxPerMm, (mx, my) => {
      const parts: string[] = [];
      const cutBayIdx = Math.min(bayRanges.length - 1, Math.floor(bayRanges.length * 0.72));
      const cutXMm = bayRanges[cutBayIdx] ? (bayRanges[cutBayIdx].x0 + bayRanges[cutBayIdx].x1) / 2 : W * 0.72;
      const ax = mx(cutXMm);
      parts.push(`
        <g class="iso-section-plane">
          <line x1="${ax.toFixed(1)}" y1="${(my(0) - 18).toFixed(1)}" x2="${ax.toFixed(1)}" y2="${(my(H) + 18).toFixed(1)}" stroke="${CAD_COLORS.plane}" stroke-width="1" stroke-dasharray="10 3 2 3" />
          <polygon points="${(ax - 10).toFixed(1)},${(my(0) - 18).toFixed(1)} ${ax.toFixed(1)},${(my(0) - 21).toFixed(1)} ${ax.toFixed(1)},${(my(0) - 15).toFixed(1)}" fill="${CAD_COLORS.plane}" />
          <polygon points="${(ax - 10).toFixed(1)},${(my(H) + 18).toFixed(1)} ${ax.toFixed(1)},${(my(H) + 15).toFixed(1)} ${ax.toFixed(1)},${(my(H) + 21).toFixed(1)}" fill="${CAD_COLORS.plane}" />
          <text x="${(ax + 5).toFixed(1)}" y="${(my(0) - 14).toFixed(1)}" font-family="ui-monospace, monospace" font-size="10.5" font-weight="900" fill="${CAD_COLORS.plane}">A</text>
          <text x="${(ax + 5).toFixed(1)}" y="${(my(H) + 20).toFixed(1)}" font-family="ui-monospace, monospace" font-size="10.5" font-weight="900" fill="${CAD_COLORS.plane}">A</text>
        </g>
      `);
      if (options.showDimensions) {
        const leftFrontStops = extractFrontSplitStops(elevData, bayRanges[0]?.x0 ?? 25, H, plinth);
        const rightFrontStops = extractFrontSplitStops(
          elevData,
          bayRanges[bayRanges.length - 1]?.x1 - 10 || W - 25,
          H,
          plinth
        );
        if (leftFrontStops.length > 2) {
          parts.push(renderClosedVerticalChain(leftFrontStops, my, mx(0) - 22, mx(0), options.unit));
          parts.push(renderDimLine(mx(0) - 52, my(0), mx(0) - 52, my(H), formatSheetDim(H, options.unit), "vertical", mx(0)));
        } else {
          parts.push(renderDimLine(mx(0) - 22, my(0), mx(0) - 22, my(H), formatSheetDim(H, options.unit), "vertical", mx(0)));
        }
        if (rightFrontStops.length > 2 && JSON.stringify(rightFrontStops) !== JSON.stringify(leftFrontStops)) {
          parts.push(renderClosedVerticalChain(rightFrontStops, my, mx(W) + 24, mx(W), options.unit));
        } else if (plinth > 0) {
          parts.push(renderClosedVerticalChain([0, H - plinth, H], my, mx(W) + 24, mx(W), options.unit));
        }
        parts.push(renderDimLine(mx(0), my(H) + 24, mx(W), my(H) + 24, formatSheetDim(W, options.unit), "horizontal", my(H)));
        // Kapak malzemesinin desenli/suyollu (hasGrain) olup olmadığını belirle
        const doorMatId = mod.bays[0]?.door?.doorMaterialId || mod.carcass.doorMaterialId;
        const doorMatDef = DEFAULT_MATERIALS.find((m) => m.id === doorMatId);
        const isGrainedDoor = Boolean(
          doorMatDef?.hasGrain ||
            doorMatDef?.category === "wood" ||
            /meşe|ceviz|ahşap|tik|mermer|damar|wood|oak|walnut|marble|veneer|freze/i.test(
              `${doorMatDef?.name || ""} ${doorMatId || ""}`
            )
        );
        const isHorizGrain = mod.componentGrainOverrides?.__all__ === "crosswise";

        let kIdx = 1;
        let cIdx = 1;
        elevData.elements.forEach((el) => {
          if (isDoorLeafRole(el.role) || el.role === "drawer_front") {
            const rw = el.width * pxPerMm;
            const rh = el.height * pxPerMm;
            if (rw > 34 && rh > 18) {
              const cx = mx(el.x + el.width / 2);
              const cy = my(el.y + el.height * 0.28);
              const tag = el.role === "drawer_front" ? `Ç${cIdx++}` : `K${kIdx++}`;
              // Desenli malzemede önce YÜKSEKLİK (suyolu/boy), sonra GENİŞLİK; desensizde önce GENİŞLİK, sonra YÜKSEKLİK
              const firstDim = isGrainedDoor
                ? formatSheetDim(el.height, options.unit)
                : formatSheetDim(el.width, options.unit);
              const secondDim = isGrainedDoor
                ? formatSheetDim(el.width, options.unit)
                : formatSheetDim(el.height, options.unit);
              const txt = `${tag}: ${firstDim}×${secondDim}`;
              const bw = txt.length * 6.4 + 8;
              parts.push(`<rect x="${(cx - bw / 2).toFixed(1)}" y="${(cy - 8).toFixed(1)}" width="${bw.toFixed(1)}" height="14" rx="2" fill="#FFFFFF" opacity="0.93" />
                <text x="${cx.toFixed(1)}" y="${(cy + 2.5).toFixed(1)}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" font-weight="800" fill="${CAD_COLORS.ink}">${escXml(txt)}</text>`);

              // Desenli malzemede kapak üzerinde suyolu (desen yönü) oku çiz
              if (isGrainedDoor) {
                const gy = my(el.y + el.height * 0.62);
                const gStroke = "#78716C";
                if (isHorizGrain && rw > 40) {
                  const halfLen = Math.min(22, rw * 0.26);
                  parts.push(`
                    <g class="cad-door-grain-arrow" opacity="0.82">
                      <line x1="${(cx - halfLen).toFixed(1)}" y1="${gy.toFixed(1)}" x2="${(cx + halfLen).toFixed(1)}" y2="${gy.toFixed(1)}" stroke="${gStroke}" stroke-width="1.1" />
                      <polyline points="${(cx - halfLen + 4).toFixed(1)},${(gy - 3).toFixed(1)} ${(cx - halfLen).toFixed(1)},${gy.toFixed(1)} ${(cx - halfLen + 4).toFixed(1)},${(gy + 3).toFixed(1)}" fill="none" stroke="${gStroke}" stroke-width="1.1" />
                      <polyline points="${(cx + halfLen - 4).toFixed(1)},${(gy - 3).toFixed(1)} ${(cx + halfLen).toFixed(1)},${gy.toFixed(1)} ${(cx + halfLen - 4).toFixed(1)},${(gy + 3).toFixed(1)}" fill="none" stroke="${gStroke}" stroke-width="1.1" />
                    </g>
                  `);
                } else if (rh > 26) {
                  const halfLen = Math.min(26, rh * 0.22);
                  parts.push(`
                    <g class="cad-door-grain-arrow" opacity="0.82">
                      <line x1="${cx.toFixed(1)}" y1="${(gy - halfLen).toFixed(1)}" x2="${cx.toFixed(1)}" y2="${(gy + halfLen).toFixed(1)}" stroke="${gStroke}" stroke-width="1.1" />
                      <polyline points="${(cx - 3).toFixed(1)},${(gy - halfLen + 4).toFixed(1)} ${cx.toFixed(1)},${(gy - halfLen).toFixed(1)} ${(cx + 3).toFixed(1)},${(gy - halfLen + 4).toFixed(1)}" fill="none" stroke="${gStroke}" stroke-width="1.1" />
                      <polyline points="${(cx - 3).toFixed(1)},${(gy + halfLen - 4).toFixed(1)} ${cx.toFixed(1)},${(gy + halfLen).toFixed(1)} ${(cx + 3).toFixed(1)},${(gy + halfLen - 4).toFixed(1)}" fill="none" stroke="${gStroke}" stroke-width="1.1" />
                    </g>
                  `);
                }
              }
            }
          }
        });
      }
      return parts.join("");
    }) +
    renderViewCaption(closedBox.x + closedBox.w / 2, area.y + area.h - 22, "ÖN GÖRÜNÜŞ (KAPALI)", `ÖLÇEK 1:${denom}`);

  // 2. KAPAKSIZ İÇ GÖRÜNÜŞ (Sol, Orta ve Sağ Bölmeler İçin Ayrı Düşey Ölçüler)
  const openSvg =
    renderOrthographic2D(elevData, openBox, "interior", options, hatchId, pxPerMm, (mx, my) => {
      if (!options.showDimensions) return "";
      const parts: string[] = [];
      parts.push(renderClosedHorizontalChain(xStops, mx, my(H) + 20, my(H), options.unit));
      parts.push(renderDimLine(mx(0), my(H) + 46, mx(W), my(H) + 46, formatSheetDim(W, options.unit), "horizontal", my(H)));

      // Leftmost bay vertical chain on LEFT + Total H
      parts.push(renderClosedVerticalChain(leftBayStops, my, mx(0) - 22, mx(0), options.unit));
      parts.push(renderDimLine(mx(0) - 52, my(0), mx(0) - 52, my(H), formatSheetDim(H, options.unit), "vertical", mx(0)));

      // Rightmost bay vertical chain on RIGHT (when 2+ bays and layout differs or >1 bay)
      if (rightDiffersFromLeft) {
        parts.push(renderClosedVerticalChain(rightBayStops, my, mx(W) + 24, mx(W), options.unit));
      } else {
        parts.push(renderDatumMarker(mx(W) + 10, my(H), "±0"));
        parts.push(renderDatumMarker(mx(W) + 10, my(0), `+${formatSheetDim(H, options.unit)}`));
      }

      // Middle bays (bays 1..N-2, or any bay with interior rails/shelves when 3+ bays)
      for (let bIdx = 1; bIdx < bayRanges.length - 1; bIdx++) {
        const br = bayRanges[bIdx];
        const stops = bayStopLists[bIdx];
        if (stops && stops.length > 2) {
          parts.push(renderInteriorBayVerticalDim(stops, mx((br.x0 + br.x1) / 2), my, options.unit));
        }
      }

      // Hanging rail elevations inside each bay where present
      bd.components
        .filter((c) => c.role === "hanging_rail")
        .forEach((r) => {
          const rx = mx(r.position.x + r.dimensions.width / 2);
          const ry = my(H - r.position.y);
          const lbl = `Askı +${formatSheetDim(r.position.y, options.unit)}`;
          const pw = lbl.length * 5.8 + 8;
          parts.push(`<rect x="${(rx - pw / 2).toFixed(1)}" y="${(ry + 5).toFixed(1)}" width="${pw.toFixed(1)}" height="12" rx="2" fill="#FFFFFF" opacity="0.94" />`);
          parts.push(`<text x="${rx.toFixed(1)}" y="${(ry + 14).toFixed(1)}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" font-weight="800" fill="${CAD_COLORS.plane}">${escXml(lbl)}</text>`);
        });

      return parts.join("");
    }) +
    renderViewCaption(openBox.x + openBox.w / 2, area.y + area.h - 22, "İÇ GÖRÜNÜŞ (KAPAKSIZ)", `ÖLÇEK 1:${denom}`);

  // 3. B-B YATAY PLAN KESİTİ
  const planScalePx = Math.min(pxPerMm * 1.15, (planBox.w - 30) / (W + 100), (planBox.h - 30) / (D + 100));
  const planSvg =
    renderOrthographic2D(planData, planBox, "plan", options, hatchId, planScalePx, (mx, my) => {
      const parts: string[] = [];
      const cutBayIdx = Math.min(bayRanges.length - 1, Math.floor(bayRanges.length * 0.72));
      const cutXMm = bayRanges[cutBayIdx] ? (bayRanges[cutBayIdx].x0 + bayRanges[cutBayIdx].x1) / 2 : W * 0.72;
      const ax = mx(cutXMm);
      parts.push(`
        <g class="iso-section-plane">
          <line x1="${ax.toFixed(1)}" y1="${(my(0) - 12).toFixed(1)}" x2="${ax.toFixed(1)}" y2="${(my(D) + 12).toFixed(1)}" stroke="${CAD_COLORS.plane}" stroke-width="1" stroke-dasharray="10 3 2 3" />
          <text x="${(ax + 5).toFixed(1)}" y="${(my(0) - 6).toFixed(1)}" font-family="ui-monospace, monospace" font-size="10" font-weight="900" fill="${CAD_COLORS.plane}">A</text>
          <text x="${(ax + 5).toFixed(1)}" y="${(my(D) + 12).toFixed(1)}" font-family="ui-monospace, monospace" font-size="10" font-weight="900" fill="${CAD_COLORS.plane}">A</text>
        </g>
      `);
      if (options.showDimensions) {
        parts.push(renderClosedHorizontalChain(xStops, mx, my(D) + 20, my(D), options.unit));
        parts.push(renderDimLine(mx(0), my(0) - 22, mx(W), my(0) - 22, formatSheetDim(W, options.unit), "horizontal", my(0)));
        parts.push(renderDimLine(mx(W) + 20, my(0), mx(W) + 20, my(D), formatSheetDim(D, options.unit), "vertical", mx(W)));
      }
      return parts.join("");
    }) +
    renderViewCaption(planBox.x + planBox.w / 2, planBox.y + planBox.h + 22, "B-B YATAY PLAN KESİTİ", `DERİNLİK: ${formatSheetDim(D, options.unit, true)}`);

  // 4. DÜŞEY KESİT A-A (Kesit Düzlemindeki Bölme Kalın Kesit, Gerideki Bölmeler Kesikli İzdüşüm + Baza Girinti Ölçüsü)
  const cutBayIdx = Math.min(bayRanges.length - 1, Math.floor(bayRanges.length * 0.72));
  const cutXMm = bayRanges[cutBayIdx] ? (bayRanges[cutBayIdx].x0 + bayRanges[cutBayIdx].x1) / 2 : W * 0.72;
  const cutBayStops = bayStopLists[cutBayIdx] ?? leftBayStops;

  // Kesit düzlemi A-A (cutXMm) dışında kalan diğer bölme elemanlarını (raf, askı, çekmece, kapak) gerideki izdüşüm olarak ayır
  const bgSectionIds = new Set<string>();
  const shellRoles = new Set([
    "carcass_top",
    "carcass_bottom",
    "carcass_back",
    "carcass_side_left",
    "carcass_side_right",
    "carcass_divider",
    "plinth",
    "leveling_foot",
    "countertop",
  ]);
  bd.components.forEach((c) => {
    if (shellRoles.has(c.role)) return;
    const cx0 = c.position.x;
    const cx1 = cx0 + c.dimensions.width;
    if (cutXMm < cx0 - 2 || cutXMm > cx1 + 2) {
      bgSectionIds.add(c.id);
    }
  });

  // Gerçek ön baza girintisi (plinthSetbackMm) — ön baza parçasının Z koordinatından hesapla
  const plinthComps = bd.components.filter((c) => c.role === "plinth");
  const frontPlinthZ = plinthComps.reduce(
    (maxZ, c) => Math.max(maxZ, c.position.z + c.dimensions.depth),
    0
  );
  const plinthRecessMm =
    plinth > 0
      ? frontPlinthZ > 0 && frontPlinthZ < D - 2
        ? Math.round(D - frontPlinthZ)
        : Math.round(mod.carcass.plinthSetbackMm ?? 35)
      : 0;

  const secAPx = Math.min(pxPerMm, (secABox.h - 36) / (H + 110));
  const secASvg =
    renderOrthographic2D(secAData, secABox, "section", options, hatchId, secAPx, (mx, my) => {
      const parts: string[] = [];
      if (options.showDimensions) {
        parts.push(renderDimLine(mx(0), my(0) - 22, mx(D), my(0) - 22, formatSheetDim(D, options.unit), "horizontal", my(0)));
        parts.push(renderDimLine(mx(0) - 22, my(0), mx(0) - 22, my(H), formatSheetDim(H, options.unit), "vertical", mx(0)));
        parts.push(renderClosedVerticalChain(cutBayStops, my, mx(D) + 24, mx(D), options.unit));
        parts.push(renderDatumMarker(mx(D) + 86, my(H), "±0"));
        parts.push(renderDatumMarker(mx(D) + 86, my(0), `+${formatSheetDim(H, options.unit)}`));
        if (plinthRecessMm > 0 && plinthRecessMm < D - 20) {
          const plX = D - plinthRecessMm;
          parts.push(
            renderDimLine(
              mx(plX),
              my(H) + 18,
              mx(D),
              my(H) + 18,
              `Baza ${formatSheetDim(plinthRecessMm, options.unit)}`,
              "horizontal",
              my(H)
            )
          );
        }
      }
      return parts.join("");
    }, "Z", bgSectionIds) +
    renderViewCaption(secABox.x + secABox.w / 2, area.y + area.h - 22, "DÜŞEY KESİT A-A", `ÖLÇEK 1:${denom}`);

  return {
    svg: closedSvg + openSvg + planSvg + secASvg,
    scaleLabel,
  };
}

function wallSegmentEndpoints(w: WallDefinition): { x1: number; z1: number; x2: number; z2: number } {
  const rad = ((w.rotationY || 0) * Math.PI) / 180;
  const x1 = w.position?.x || 0;
  const z1 = w.position?.z || 0;
  return { x1, z1, x2: x1 + Math.cos(rad) * w.length, z2: z1 + Math.sin(rad) * w.length };
}

function computeRoomPlanBounds(project: DesignProject, spaceWalls: WallDefinition[]) {
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  spaceWalls.forEach((w) => {
    const seg = wallSegmentEndpoints(w);
    minX = Math.min(minX, seg.x1, seg.x2);
    maxX = Math.max(maxX, seg.x1, seg.x2);
    minZ = Math.min(minZ, seg.z1, seg.z2);
    maxZ = Math.max(maxZ, seg.z1, seg.z2);
  });
  project.modules.forEach((m) => {
    const x0 = m.position?.x || 0;
    const z0 = m.position?.z || 0;
    minX = Math.min(minX, x0);
    minZ = Math.min(minZ, z0);
    maxX = Math.max(maxX, x0 + m.dimensions.width);
    maxZ = Math.max(maxZ, z0 + m.dimensions.depth);
  });
  if (!Number.isFinite(minX)) return { minX: 0, minZ: 0, maxX: 4000, maxZ: 3200 };
  return { minX, minZ, maxX, maxZ };
}

function renderOverviewSheet(ctx: SheetBuildContext, area: ViewportBox): string {
  const { project, bom, spaceWalls, spaceObstacles, options } = ctx;
  const leftW = Math.round(area.w * 0.56);
  const rightX = area.x + leftW + 20;
  const rightW = area.w - leftW - 20;
  const topH = Math.round(area.h * 0.52);
  const botH = area.h - topH - 18;

  const planBox: ViewportBox = { x: area.x + 24, y: area.y + 18, w: leftW - 48, h: topH - 42 };
  const elevBox: ViewportBox = { x: area.x + 24, y: area.y + topH + 14, w: leftW - 48, h: botH - 42 };
  const isoBox: ViewportBox = { x: rightX + 10, y: area.y + 18, w: rightW - 20, h: topH - 42 };
  const sumBox: ViewportBox = { x: rightX + 10, y: area.y + topH + 14, w: rightW - 20, h: botH - 22 };

  // 1. Mekân Planı
  const { minX, minZ, maxX, maxZ } = computeRoomPlanBounds(project, spaceWalls);
  const padMm = 260;
  const spanX = Math.max(1000, maxX - minX + padMm * 2);
  const spanZ = Math.max(1000, maxZ - minZ + padMm * 2);
  const pScale = Math.min((planBox.w * 0.85) / spanX, (planBox.h * 0.85) / spanZ);
  const offX = planBox.x + (planBox.w - spanX * pScale) / 2 - (minX - padMm) * pScale;
  const offZ = planBox.y + (planBox.h - spanZ * pScale) / 2 - (minZ - padMm) * pScale;
  const mx = (x: number) => offX + x * pScale;
  const mz = (z: number) => offZ + z * pScale;

  const wallsSvg =
    spaceWalls.length > 0
      ? spaceWalls
          .map((w) => {
            const seg = wallSegmentEndpoints(w);
            return `<line x1="${mx(seg.x1).toFixed(1)}" y1="${mz(seg.z1).toFixed(1)}" x2="${mx(seg.x2).toFixed(1)}" y2="${mz(seg.z2).toFixed(1)}" stroke="${CAD_COLORS.ink}" stroke-width="${Math.max(3, (w.thickness || 150) * pScale).toFixed(1)}" stroke-linecap="square" />`;
          })
          .join("")
      : `<rect x="${mx(minX).toFixed(1)}" y="${mz(minZ).toFixed(1)}" width="${(Math.max(1200, maxX - minX) * pScale).toFixed(1)}" height="${(Math.max(1200, maxZ - minZ) * pScale).toFixed(1)}" fill="#FAFAFA" stroke="${CAD_COLORS.ink}" stroke-width="3" />`;

  const obsSvg = spaceObstacles
    .map((obs) => {
      const ox = mx(obs.position?.x || 0);
      const oz = mz(obs.position?.z || 0);
      const ow = Math.max(5, (obs.dimensions?.width || 300) * pScale);
      const od = Math.max(5, (obs.dimensions?.depth || 200) * pScale);
      const lbl = `${obs.name || obs.type} (${Math.round(obs.dimensions?.width || 0)}×${Math.round(obs.dimensions?.depth || 0)})`;
      return `<rect x="${ox.toFixed(1)}" y="${oz.toFixed(1)}" width="${ow.toFixed(1)}" height="${od.toFixed(1)}" fill="#CBD5E1" stroke="${CAD_COLORS.ink}" stroke-width="1" />
              <text x="${(ox + ow / 2).toFixed(1)}" y="${(oz + od + 13).toFixed(1)}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" font-weight="700" fill="${CAD_COLORS.subInk}">${escXml(lbl)}</text>`;
    })
    .join("");

  const modsPlanSvg = project.modules
    .map((m, idx) => {
      const pl = calculateModulePlacement(m);
      const rad = ((m.rotation?.y || 0) * Math.PI) / 180;
      const cosR = Math.cos(rad);
      const sinR = Math.sin(rad);
      const toWorld = (lx: number, lz: number) => ({
        x: pl.origin.x + lx * cosR + lz * sinR,
        z: pl.origin.z - lx * sinR + lz * cosR,
      });
      const W = m.dimensions.width;
      const D = m.dimensions.depth;
      const H = m.dimensions.height;
      const tplLc = (m.templateId || "").toLowerCase();
      const nameLc = (m.name || "").toLowerCase();
      const hull = m.carcass.hullShape || "rectangular";
      const isBlind = tplLc.includes("blind") || nameLc.includes("kör köşe") || nameLc.includes("lemans");
      const isDiagonal =
        Boolean(m.isCorner) &&
        (tplLc.includes("diagonal") || nameLc.includes("diyagonal") || nameLc.includes("45°")) &&
        W >= 500 &&
        D >= 500;
      const isLCorner = Boolean(m.isCorner) && !isBlind && !isDiagonal && W >= 620 && D >= 620;
      const minArm = Math.min(W, D);
      const isWallL = m.category === "kitchen_wall" || m.moduleFamilyId === "fam_kitchen_wall" || (m.position?.y || 0) >= 1100;
      const isWardrobe = m.category.startsWith("wardrobe") || m.moduleFamilyId === "fam_wardrobe" || H >= 1400;
      const wingD = isWallL
        ? (minArm >= 580 ? 350 : Math.min(350, Math.round(minArm * 0.56)))
        : isWardrobe
        ? (minArm >= 920 ? 600 : Math.min(600, Math.round(minArm * 0.58)))
        : (minArm >= 780 ? 580 : Math.min(580, Math.round(minArm * 0.64)));

      if (isDiagonal) {
        // 5-kenarlı 45° Diyagonal Köşe poligonu
        const pts = [toWorld(0, 0), toWorld(W, 0), toWorld(W, wingD), toWorld(wingD, D), toWorld(0, D)];
        const polyPts = pts.map((p) => `${mx(p.x).toFixed(1)},${mz(p.z).toFixed(1)}`).join(" ");
        const lblW = toWorld(W * 0.42, D * 0.42);
        const cx = mx(lblW.x);
        const cz = mz(lblW.z);
        return `<g>
          <polygon points="${polyPts}" fill="#E2E8F0" stroke="${CAD_COLORS.ink}" stroke-width="1.2" />
          <line x1="${mx(pts[2].x).toFixed(1)}" y1="${mz(pts[2].z).toFixed(1)}" x2="${mx(pts[3].x).toFixed(1)}" y2="${mz(pts[3].z).toFixed(1)}" stroke="${CAD_COLORS.plane}" stroke-width="2.4" />
          <text x="${cx.toFixed(1)}" y="${(cz - 2).toFixed(1)}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="11" font-weight="800" fill="${CAD_COLORS.ink}">M${idx + 1}</text>
          <text x="${cx.toFixed(1)}" y="${(cz + 10).toFixed(1)}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.5" font-weight="700" fill="${CAD_COLORS.subInk}">${W}×${D} 45°</text>
        </g>`;
      }

      if (isLCorner) {
        const pts = [
          toWorld(0, 0),
          toWorld(W, 0),
          toWorld(W, wingD),
          toWorld(wingD, wingD),
          toWorld(wingD, D),
          toWorld(0, D),
        ];
        const polyPts = pts.map((p) => `${mx(p.x).toFixed(1)},${mz(p.z).toFixed(1)}`).join(" ");
        const lblW = toWorld(wingD * 0.52, wingD * 0.52);
        const cx = mx(lblW.x);
        const cz = mz(lblW.z);
        return `<g>
          <polygon points="${polyPts}" fill="#E2E8F0" stroke="${CAD_COLORS.ink}" stroke-width="1.2" />
          <line x1="${mx(pts[2].x).toFixed(1)}" y1="${mz(pts[2].z).toFixed(1)}" x2="${mx(pts[3].x).toFixed(1)}" y2="${mz(pts[3].z).toFixed(1)}" stroke="${CAD_COLORS.plane}" stroke-width="2.2" />
          <line x1="${mx(pts[3].x).toFixed(1)}" y1="${mz(pts[3].z).toFixed(1)}" x2="${mx(pts[4].x).toFixed(1)}" y2="${mz(pts[4].z).toFixed(1)}" stroke="${CAD_COLORS.plane}" stroke-width="2.2" />
          <text x="${cx.toFixed(1)}" y="${(cz - 2).toFixed(1)}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="11" font-weight="800" fill="${CAD_COLORS.ink}">M${idx + 1}</text>
          <text x="${cx.toFixed(1)}" y="${(cz + 10).toFixed(1)}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.5" font-weight="700" fill="${CAD_COLORS.subInk}">${W}×${D} L</text>
        </g>`;
      }

      if (hull === "capsule_table" || hull === "capsule_stadium" || hull === "rounded_corners") {
        // Stadyum / Kapsül / R-Köşe gerçek yuvarlatılmış plan poligonu (24-noktalı yumuşak yay)
        const rMm =
          hull === "rounded_corners"
            ? Math.max(40, Math.min(m.carcass.cornerRadiusMm || 100, D / 2 - 4, W / 4))
            : Math.min(D / 2, W / 2);
        const arcPts: { x: number; z: number }[] = [];
        const addArc = (cxL: number, czL: number, a0: number, a1: number, steps = 6) => {
          for (let s = 0; s <= steps; s++) {
            const a = a0 + ((a1 - a0) * s) / steps;
            arcPts.push(toWorld(cxL + Math.cos(a) * rMm, czL + Math.sin(a) * rMm));
          }
        };
        addArc(W - rMm, rMm, -Math.PI / 2, 0);
        addArc(W - rMm, D - rMm, 0, Math.PI / 2);
        addArc(rMm, D - rMm, Math.PI / 2, Math.PI);
        addArc(rMm, rMm, Math.PI, Math.PI * 1.5);
        const polyPts = arcPts.map((p) => `${mx(p.x).toFixed(1)},${mz(p.z).toFixed(1)}`).join(" ");
        const cW = toWorld(W * 0.5, D * 0.5);
        const cx = mx(cW.x);
        const cz = mz(cW.z);
        return `<g>
          <polygon points="${polyPts}" fill="#E2E8F0" stroke="${CAD_COLORS.ink}" stroke-width="1.2" />
          <text x="${cx.toFixed(1)}" y="${(cz - 2).toFixed(1)}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="11" font-weight="800" fill="${CAD_COLORS.ink}">M${idx + 1}</text>
          <text x="${cx.toFixed(1)}" y="${(cz + 10).toFixed(1)}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.5" font-weight="700" fill="${CAD_COLORS.subInk}">${W}×${D}</text>
        </g>`;
      }

      const pBL = toWorld(0, 0);
      const pBR = toWorld(W, 0);
      const pFR = toWorld(W, D);
      const pFL = toWorld(0, D);
      const polyPts = [pBL, pBR, pFR, pFL].map((p) => `${mx(p.x).toFixed(1)},${mz(p.z).toFixed(1)}`).join(" ");
      const cx = mx((pBL.x + pFR.x) * 0.5);
      const cz = mz((pBL.z + pFR.z) * 0.5);
      const blindZoneSvg = isBlind
        ? (() => {
            const b1 = toWorld(0, 0);
            const b2 = toWorld(W * 0.5, 0);
            const b3 = toWorld(W * 0.5, D);
            const b4 = toWorld(0, D);
            const bp = [b1, b2, b3, b4].map((p) => `${mx(p.x).toFixed(1)},${mz(p.z).toFixed(1)}`).join(" ");
            return `<polygon points="${bp}" fill="#CBD5E1" fill-opacity="0.55" stroke="${CAD_COLORS.muted}" stroke-width="0.8" stroke-dasharray="3 2" />`;
          })()
        : "";
      const islandOutlineSvg =
        m.category === "kitchen_island"
          ? (() => {
              const i1 = toWorld(-20, -20);
              const i2 = toWorld(W + 20, -20);
              const i3 = toWorld(W + 20, D + 20);
              const i4 = toWorld(-20, D + 20);
              const ip = [i1, i2, i3, i4].map((p) => `${mx(p.x).toFixed(1)},${mz(p.z).toFixed(1)}`).join(" ");
              return `<polygon points="${ip}" fill="none" stroke="${CAD_COLORS.plane}" stroke-width="1" stroke-dasharray="4 3" />`;
            })()
          : "";
      return `<g>
        ${islandOutlineSvg}
        <polygon points="${polyPts}" fill="#E2E8F0" stroke="${CAD_COLORS.ink}" stroke-width="1.2" />
        ${blindZoneSvg}
        <line x1="${mx(pFL.x).toFixed(1)}" y1="${mz(pFL.z).toFixed(1)}" x2="${mx(pFR.x).toFixed(1)}" y2="${mz(pFR.z).toFixed(1)}" stroke="${CAD_COLORS.plane}" stroke-width="2.2" />
        <text x="${cx.toFixed(1)}" y="${(cz - 2).toFixed(1)}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="11" font-weight="800" fill="${CAD_COLORS.ink}">M${idx + 1}</text>
        <text x="${cx.toFixed(1)}" y="${(cz + 10).toFixed(1)}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" font-weight="700" fill="${CAD_COLORS.subInk}">${W}×${D}${m.category === "kitchen_island" ? " ADA" : isBlind ? " KÖR" : ""}</text>
      </g>`;
    })
    .join("");

  const planDims = options.showDimensions
    ? renderDimLine(mx(minX), mz(minZ) - 28, mx(maxX), mz(minZ) - 28, formatSheetDim(maxX - minX, options.unit), "horizontal", mz(minZ)) +
      renderDimLine(mx(minX) - 28, mz(minZ), mx(minX) - 28, mz(maxZ), formatSheetDim(maxZ - minZ, options.unit), "vertical", mx(minX))
    : "";

  // 2. Ön Cephe Görünüşü (Ana Duvar + varsa Sol/Sağ Yan Duvar cepheleri yan yana tam detayla çizilir)
  type WallElevGroup = { title: string; items: { m: ModuleInstance; idx: number; along: number }[]; minA: number; maxA: number; maxH: number };
  const wallBuckets: Record<string, { title: string; items: { m: ModuleInstance; idx: number; along: number }[] }> = {
    main: { title: "ANA DUVAR", items: [] },
    left: { title: "SOL DUVAR", items: [] },
    right: { title: "SAĞ DUVAR", items: [] },
    front: { title: "KARŞI DUVAR", items: [] },
  };
  project.modules.forEach((m, idx) => {
    const r = (((m.rotation?.y || 0) % 360) + 360) % 360;
    const pl = calculateModulePlacement(m);
    if (r < 45 || r > 315) {
      wallBuckets.main.items.push({ m, idx, along: m.position?.x || 0 });
    } else if (r >= 45 && r < 135) {
      wallBuckets.left.items.push({ m, idx, along: -((m.position?.z || 0) + pl.depth) });
    } else if (r >= 225 && r <= 315) {
      wallBuckets.right.items.push({ m, idx, along: m.position?.z || 0 });
    } else {
      wallBuckets.front.items.push({ m, idx, along: -((m.position?.x || 0) + pl.width) });
    }
  });
  const wallGroups: WallElevGroup[] = Object.values(wallBuckets)
    .filter((g) => g.items.length > 0)
    .map((g) => {
      g.items.sort((a, b) => a.along - b.along);
      const minA = Math.min(...g.items.map((it) => it.along));
      const maxA = Math.max(...g.items.map((it) => it.along + it.m.dimensions.width));
      const maxH = Math.max(...g.items.map((it) => (it.m.position?.y || 0) + it.m.dimensions.height));
      return { title: g.title, items: g.items, minA, maxA, maxH };
    });

  const ceilingH = project.space?.ceilingHeight || 2600;
  const groupGapMm = wallGroups.length > 1 ? 450 : 0;
  const totalSpanMm = Math.max(
    800,
    wallGroups.reduce((s, g) => s + Math.max(300, g.maxA - g.minA), 0) + groupGapMm * Math.max(0, wallGroups.length - 1)
  );
  const maxModH = Math.max(1000, ...wallGroups.map((g) => g.maxH));
  const maxY = Math.max(ceilingH, maxModH);
  const eScale = Math.min((elevBox.w * 0.84) / (totalSpanMm + 260), (elevBox.h * 0.80) / Math.max(1000, maxY + 260));
  const startPx = elevBox.x + (elevBox.w - totalSpanMm * eScale) / 2;
  const floorY = elevBox.y + elevBox.h - 24;
  const ey = (yFloor: number) => floorY - yFloor * eScale;

  let cursorMm = 0;
  const elevGroupSvgs: string[] = [];
  const elevGroupDims: string[] = [];
  wallGroups.forEach((grp, gIdx) => {
    const grpOriginPx = startPx + cursorMm * eScale;
    const gx = (alongVal: number) => grpOriginPx + (alongVal - grp.minA) * eScale;
    const grpSpanMm = Math.max(300, grp.maxA - grp.minA);

    grp.items.forEach(({ m, idx, along }) => {
      const bd: ModuleGeometryBreakdown = generateModuleGeometry(m);
      const elev = generateElevation2D(bd);
      const by = m.position?.y || 0;
      const rects = elev.elements
        .map((el) => {
          const st = getElementStyle(el.role, "elevation", false, "none");
          if (st.skip) return "";
          const rx = gx(along + el.x);
          const yBot = bd.overall.height - (el.y + el.height);
          const ry = ey(by + yBot + el.height);
          return `<rect x="${rx.toFixed(1)}" y="${ry.toFixed(1)}" width="${Math.max(0.8, el.width * eScale).toFixed(1)}" height="${Math.max(0.8, el.height * eScale).toFixed(1)}" fill="${st.fill}" stroke="${st.stroke}" stroke-width="${st.strokeWidth}" />`;
        })
        .join("");
      elevGroupSvgs.push(
        rects +
          `<text x="${gx(along + m.dimensions.width / 2).toFixed(1)}" y="${(ey(by + m.dimensions.height) - 7).toFixed(1)}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.5" font-weight="800" fill="${CAD_COLORS.ink}">M${idx + 1}</text>`
      );
    });

    if (options.showDimensions) {
      elevGroupDims.push(
        renderDimLine(
          gx(grp.minA),
          ey(grp.maxH) - 26,
          gx(grp.maxA),
          ey(grp.maxH) - 26,
          formatSheetDim(grpSpanMm, options.unit),
          "horizontal",
          ey(grp.maxH)
        )
      );
      if (gIdx === 0) {
        elevGroupDims.push(
          renderDimLine(
            gx(grp.minA) - 20,
            ey(grp.maxH),
            gx(grp.minA) - 20,
            floorY,
            formatSheetDim(grp.maxH, options.unit),
            "vertical",
            gx(grp.minA)
          )
        );
      }
    }
    if (wallGroups.length > 1) {
      elevGroupDims.push(
        `<text x="${gx((grp.minA + grp.maxA) * 0.5).toFixed(1)}" y="${(floorY + 13).toFixed(1)}" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="9" font-weight="800" fill="${CAD_COLORS.subInk}">${grp.title}</text>`
      );
    }
    cursorMm += grpSpanMm + groupGapMm;
  });

  const elevModsSvg = elevGroupSvgs.join("");
  const lastRightPx = startPx + totalSpanMm * eScale;
  const elevChrome = `
    <line x1="${elevBox.x}" y1="${floorY}" x2="${elevBox.x + elevBox.w}" y2="${floorY}" stroke="${CAD_COLORS.ink}" stroke-width="1.5" />
    <line x1="${elevBox.x}" y1="${ey(ceilingH)}" x2="${elevBox.x + elevBox.w}" y2="${ey(ceilingH)}" stroke="${CAD_COLORS.muted}" stroke-width="0.9" stroke-dasharray="6 4" />
    ${elevGroupDims.join("")}
    ${renderDatumMarker(lastRightPx + 12, floorY, "±0")}
    ${renderDatumMarker(lastRightPx + 12, ey(ceilingH), `+${formatSheetDim(ceilingH, options.unit)}`)}
  `;

  // 3. 3B Referans & Proje Özeti
  const isoSvg = renderIsometricViewport(project.modules, isoBox, options, false);
  const sumRows = project.modules
    .map(
      (m, idx) => `
      <rect x="${sumBox.x}" y="${sumBox.y + 42 + idx * 20}" width="${sumBox.w}" height="20" fill="${idx % 2 ? "#F8FAFC" : "#FFFFFF"}" stroke="#CBD5E1" stroke-width="0.6" />
      <text x="${sumBox.x + 8}" y="${sumBox.y + 56 + idx * 20}" font-family="ui-monospace, monospace" font-size="10" font-weight="800" fill="${CAD_COLORS.ink}">M${idx + 1}</text>
      <text x="${sumBox.x + 44}" y="${sumBox.y + 56 + idx * 20}" font-family="Segoe UI, sans-serif" font-size="10" font-weight="600" fill="${CAD_COLORS.ink}">${escXml(m.name.slice(0, 32))}</text>
      <text x="${sumBox.x + sumBox.w - 8}" y="${sumBox.y + 56 + idx * 20}" text-anchor="end" font-family="ui-monospace, monospace" font-size="10" font-weight="700" fill="${CAD_COLORS.dim}">${m.dimensions.width}×${m.dimensions.height}×${m.dimensions.depth} mm</text>
    `
    )
    .join("");
  const sumSvg = `
    <text x="${sumBox.x}" y="${sumBox.y + 14}" font-family="Segoe UI, sans-serif" font-size="11.5" font-weight="800" fill="${CAD_COLORS.ink}">PROJE MODÜL &amp; ÜRETİM ÖZETİ</text>
    <rect x="${sumBox.x}" y="${sumBox.y + 22}" width="${sumBox.w}" height="20" fill="#E2E8F0" stroke="${CAD_COLORS.ink}" stroke-width="0.9" />
    <text x="${sumBox.x + 8}" y="${sumBox.y + 36}" font-size="10" font-weight="800" fill="${CAD_COLORS.ink}">KOD</text>
    <text x="${sumBox.x + 44}" y="${sumBox.y + 36}" font-size="10" font-weight="800" fill="${CAD_COLORS.ink}">MODÜL ADI</text>
    <text x="${sumBox.x + sumBox.w - 8}" y="${sumBox.y + 36}" text-anchor="end" font-size="10" font-weight="800" fill="${CAD_COLORS.ink}">DIŞ ÖLÇÜ (G×Y×D)</text>
    ${sumRows}
    <text x="${sumBox.x}" y="${sumBox.y + 62 + project.modules.length * 20}" font-family="ui-monospace, monospace" font-size="10" font-weight="700" fill="${CAD_COLORS.subInk}">Toplam: ${bom.summary.totalPiecesCount} Parça • ${bom.summary.totalPanelAreaM2.toFixed(2)} m² Panel • ${bom.summary.totalEdgeBandMeters.toFixed(1)} mt PVC Bant</text>
  `;

  return (
    wallsSvg +
    obsSvg +
    modsPlanSvg +
    planDims +
    renderViewCaption(planBox.x + planBox.w / 2, planBox.y + planBox.h + 18, "MEKÂN YERLEŞİM PLANI", `${Math.round(maxX - minX)} × ${Math.round(maxZ - minZ)} mm`) +
    elevChrome +
    elevModsSvg +
    renderViewCaption(elevBox.x + elevBox.w / 2, elevBox.y + elevBox.h + 18, "ÖN CEPHE GÖRÜNÜŞÜ", `TAVAN +${formatSheetDim(ceilingH, options.unit, true)}`) +
    isoSvg +
    renderViewCaption(isoBox.x + isoBox.w / 2, isoBox.y + isoBox.h + 18, "3B İZOMETRİK PERSPEKTİF", "REFERANS GÖRÜNÜM") +
    sumSvg
  );
}


/**
 * PAFTA 07 — 3B İZOMETRİK ÖLÇÜ & İÇ DETAY PAFTASI
 * Sol yarıda kapalı dış ölçülü 3B perspektif, sağ yarıda şeffaf/açık kapak iç detay ölçülü 3B perspektif.
 */
function renderIsometricDimensionsSheet(
  ctx: SheetBuildContext,
  mod: ModuleInstance,
  area: ViewportBox
): string {
  const { options } = ctx;
  const summaryH = 68;
  const viewH = area.h - summaryH - 16;
  const gap = 16;
  const colW = Math.round((area.w - gap) / 2);

  const leftBox: ViewportBox = { x: area.x, y: area.y, w: colW, h: viewH - 28 };
  const rightBox: ViewportBox = { x: area.x + colW + gap, y: area.y, w: colW, h: viewH - 28 };

  const closedOpts: SheetDisplayOptions = { ...options, showDimensions: true, showXrayInterior: false };
  const openOpts: SheetDisplayOptions = { ...options, showDimensions: true, showXrayInterior: true };

  const closedIso = renderIsometricViewport([mod], leftBox, closedOpts, true);
  const openIso = renderIsometricViewport([mod], rightBox, openOpts, true);

  const T = mod.carcass.panelThickness || 18;
  const doorT = mod.carcass.doorThickness || 18;
  const plinth = mod.carcass.plinthHeight || 0;
  const backT = mod.carcass.backPanelThickness || 8;
  const backOff = mod.carcass.backOffsetMm ?? 12;
  const netInnerD = Math.max(50, Math.round(mod.dimensions.depth - backOff - backT));
  const shelfCount = mod.bays.reduce((s, b) => s + (b.shelves?.length || 0), 0);
  const drawerCount = mod.bays.reduce((s, b) => s + (b.drawers?.length || 0), 0);
  const railCount = mod.bays.reduce((s, b) => s + (b.hangingRails?.length || 0), 0);

  const sumY = area.y + viewH + 10;
  const cards = [
    { lbl: "DIŞ ÖLÇÜ (G×Y×D)", val: `${mod.dimensions.width} × ${mod.dimensions.height} × ${mod.dimensions.depth} mm` },
    { lbl: "NET İÇ DERİNLİK", val: `${netInnerD} mm (Arkalık ${backT}mm)` },
    { lbl: "BAZA & PANEL", val: `Baza ${plinth}mm • Gövde ${T}mm • Kapak ${doorT}mm` },
    { lbl: "İÇ DONANIM", val: `${mod.bays.length} Bölme • ${shelfCount} Raf • ${drawerCount} Çekmece • ${railCount} Askı` },
  ];
  const cardW = (area.w - 3 * 12) / 4;
  const summaryBar = cards
    .map((c, idx) => {
      const cx = area.x + idx * (cardW + 12);
      return `
        <rect x="${cx.toFixed(1)}" y="${sumY.toFixed(1)}" width="${cardW.toFixed(1)}" height="${summaryH - 12}" rx="4" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="0.9" />
        <text x="${(cx + 10).toFixed(1)}" y="${(sumY + 18).toFixed(1)}" font-family="Segoe UI, sans-serif" font-size="9.5" font-weight="800" fill="${CAD_COLORS.subInk}">${escXml(c.lbl)}</text>
        <text x="${(cx + 10).toFixed(1)}" y="${(sumY + 38).toFixed(1)}" font-family="ui-monospace, monospace" font-size="10.5" font-weight="800" fill="${CAD_COLORS.ink}">${escXml(c.val)}</text>
      `;
    })
    .join("");

  return `
    <rect x="${leftBox.x}" y="${leftBox.y}" width="${leftBox.w}" height="${viewH}" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="0.9" />
    <rect x="${rightBox.x}" y="${rightBox.y}" width="${rightBox.w}" height="${viewH}" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="0.9" />
    ${closedIso}
    ${openIso}
    ${renderViewCaption(leftBox.x + leftBox.w / 2, leftBox.y + viewH - 10, "3B İZOMETRİK DIŞ ÖLÇÜLENDİRME", "KAPALI GÖRÜNÜM — GENİŞLİK / YÜKSEKLİK / DERİNLİK")}
    ${renderViewCaption(rightBox.x + rightBox.w / 2, rightBox.y + viewH - 10, "3B İZOMETRİK İÇ DETAY ÖLÇÜLENDİRME", "ŞEFFAF KAPAK — NET BÖLME, RAF, ASKI & ÇEKMECE ÖLÇÜLERİ")}
    ${summaryBar}
  `;
}


function renderWallElevationsSheet(ctx: SheetBuildContext, area: ViewportBox): string {
  const { project, options } = ctx;

  type WallGroup = { key: string; title: string; items: { m: ModuleInstance; idx: number; along: number }[]; minA: number; maxA: number; maxH: number };
  const buckets: Record<string, { key: string; title: string; items: { m: ModuleInstance; idx: number; along: number }[] }> = {
    main: { key: "main", title: "ANA DUVAR CEPHE GÖRÜNÜŞÜ", items: [] },
    left: { key: "left", title: "SOL DUVAR CEPHE GÖRÜNÜŞÜ", items: [] },
    right: { key: "right", title: "SAĞ DUVAR CEPHE GÖRÜNÜŞÜ", items: [] },
    front: { key: "front", title: "KARŞI DUVAR CEPHE GÖRÜNÜŞÜ", items: [] },
  };
  project.modules.forEach((m, idx) => {
    const r = (((m.rotation?.y || 0) % 360) + 360) % 360;
    const pl = calculateModulePlacement(m);
    if (r < 45 || r > 315) {
      buckets.main.items.push({ m, idx, along: m.position?.x || 0 });
    } else if (r >= 45 && r < 135) {
      buckets.left.items.push({ m, idx, along: -((m.position?.z || 0) + pl.depth) });
    } else if (r >= 225 && r <= 315) {
      buckets.right.items.push({ m, idx, along: m.position?.z || 0 });
    } else {
      buckets.front.items.push({ m, idx, along: -((m.position?.x || 0) + pl.width) });
    }
  });
  const groups: WallGroup[] = Object.values(buckets)
    .filter((b) => b.items.length > 0)
    .map((b) => {
      b.items.sort((a, c) => a.along - c.along);
      const minA = Math.min(...b.items.map((it) => it.along));
      const maxA = Math.max(...b.items.map((it) => it.along + it.m.dimensions.width));
      const maxH = Math.max(...b.items.map((it) => (it.m.position?.y || 0) + it.m.dimensions.height));
      return { key: b.key, title: b.title, items: b.items, minA, maxA, maxH };
    });

  const ceilingH = project.space?.ceilingHeight || 2600;
  const cols = groups.length <= 2 ? 1 : 2;
  const rows = Math.ceil(Math.max(1, groups.length) / cols);
  const gapX = 24;
  const gapY = 22;
  const cellW = (area.w - gapX * (cols - 1)) / cols;
  const cellH = (area.h - gapY * (rows - 1)) / rows;

  const cellsSvg = groups
    .map((grp, gIdx) => {
      const col = gIdx % cols;
      const row = Math.floor(gIdx / cols);
      const bx = area.x + col * (cellW + gapX);
      const by = area.y + row * (cellH + gapY);
      const inner: ViewportBox = { x: bx + 16, y: by + 26, w: cellW - 32, h: cellH - 64 };
      const spanMm = Math.max(600, grp.maxA - grp.minA);
      const maxY = Math.max(ceilingH, grp.maxH);
      const scale = Math.min((inner.w * 0.84) / (spanMm + 280), (inner.h * 0.78) / (maxY + 260));
      const offX = inner.x + (inner.w - spanMm * scale) / 2;
      const floorY = inner.y + inner.h - 14;
      const gx = (a: number) => offX + (a - grp.minA) * scale;
      const gy = (yFloor: number) => floorY - yFloor * scale;

      const modsSvg = grp.items
        .map(({ m, idx, along }) => {
          const bd: ModuleGeometryBreakdown = generateModuleGeometry(m);
          const elev = generateElevation2D(bd);
          const my = m.position?.y || 0;
          const rects = elev.elements
            .map((el) => {
              const st = getElementStyle(el.role, "elevation", false, "none");
              if (st.skip) return "";
              const rx = gx(along + el.x);
              const yBot = bd.overall.height - (el.y + el.height);
              const ry = gy(my + yBot + el.height);
              return `<rect x="${rx.toFixed(1)}" y="${ry.toFixed(1)}" width="${Math.max(0.9, el.width * scale).toFixed(1)}" height="${Math.max(0.9, el.height * scale).toFixed(1)}" fill="${st.fill}" stroke="${st.stroke}" stroke-width="${st.strokeWidth}" />`;
            })
            .join("");
          const modWDim = options.showDimensions
            ? renderDimLine(
                gx(along),
                gy(my + m.dimensions.height) - 18,
                gx(along + m.dimensions.width),
                gy(my + m.dimensions.height) - 18,
                formatSheetDim(m.dimensions.width, options.unit),
                "horizontal",
                gy(my + m.dimensions.height)
              )
            : "";
          return (
            rects +
            modWDim +
            `<text x="${gx(along + m.dimensions.width / 2).toFixed(1)}" y="${(gy(my + m.dimensions.height) - 4).toFixed(1)}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10.5" font-weight="800" fill="${CAD_COLORS.ink}">M${idx + 1}</text>`
          );
        })
        .join("");

      const totalDim = options.showDimensions
        ? renderDimLine(gx(grp.minA), gy(grp.maxH) - 40, gx(grp.maxA), gy(grp.maxH) - 40, formatSheetDim(spanMm, options.unit), "horizontal", gy(grp.maxH)) +
          renderDimLine(gx(grp.minA) - 24, gy(grp.maxH), gx(grp.minA) - 24, floorY, formatSheetDim(grp.maxH, options.unit), "vertical", gx(grp.minA))
        : "";
      const modCodes = grp.items.map((it) => `M${it.idx + 1}`).join(", ");
      const cap = renderViewCaption(
        bx + cellW / 2,
        by + cellH - 18,
        grp.title,
        `${modCodes} • Toplam ${formatSheetDim(spanMm, options.unit)} × ${formatSheetDim(grp.maxH, options.unit)}`
      );

      return `
        <rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${cellW.toFixed(1)}" height="${cellH.toFixed(1)}" rx="4" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1" />
        <line x1="${(bx + 14).toFixed(1)}" y1="${floorY.toFixed(1)}" x2="${(bx + cellW - 14).toFixed(1)}" y2="${floorY.toFixed(1)}" stroke="${CAD_COLORS.ink}" stroke-width="1.5" />
        <line x1="${(bx + 14).toFixed(1)}" y1="${gy(ceilingH).toFixed(1)}" x2="${(bx + cellW - 14).toFixed(1)}" y2="${gy(ceilingH).toFixed(1)}" stroke="${CAD_COLORS.muted}" stroke-width="0.9" stroke-dasharray="6 4" />
        ${modsSvg}
        ${totalDim}
        ${renderDatumMarker(gx(grp.maxA) + 14, floorY, "±0")}
        ${renderDatumMarker(gx(grp.maxA) + 14, gy(ceilingH), `+${formatSheetDim(ceilingH, options.unit)}`)}
        ${cap}
      `;
    })
    .join("");

  return cellsSvg;
}

export function buildProductionSheetSvgDocument(
  ctx: SheetBuildContext,
  page: SheetPageDescriptor
): string {
  const { project, options } = ctx;
  const paper = SHEET_PAPER_SPECS[options.paperFormat];
  const W = paper.svgWidth;
  const H = paper.svgHeight;
  const hatchId = `cad_hatch_${page.id.replace(/[^a-zA-Z0-9_]/g, "_")}`;

  const frameW = W - 28 * 2 - 14;
  const frameH = H - 28 * 2;
  const area: ViewportBox = { x: 42 + 12, y: 28 + 10, w: frameW - 24, h: frameH - 98 - 22 };

  let bodySvg = "";
  let scaleLabel = options.scale === "auto" ? "Oto" : options.scale;
  const mod = project.modules[page.moduleIndex || 0];

  if (page.kind === "overview") {
    bodySvg = renderOverviewSheet(ctx, area);
  } else if (page.kind === "wall_elevations") {
    bodySvg = renderWallElevationsSheet(ctx, area);
  } else if (page.kind === "module_views" && mod) {
    const res = buildModuleViewsSheet(ctx, mod, area, hatchId, paper.widthMm, paper.svgWidth);
    bodySvg = res.svg;
    scaleLabel = res.scaleLabel;
  } else if (page.kind === "joinery_details" && mod) {
    bodySvg = renderJoineryDetailsSheet(ctx, mod, area, hatchId);
    scaleLabel = "1:2";
  } else if (page.kind === "exploded_bom" && mod) {
    bodySvg = renderExplodedBomSheet(ctx, mod, area);
    scaleLabel = "İZOMETRİK";
  } else if (page.kind === "panel_drilling" && mod) {
    bodySvg = renderPanelDrillingSheet(ctx, mod, area);
    scaleLabel = "1:10 / 1:1";
  } else if (page.kind === "cutting_edgeband" && mod) {
    bodySvg = renderCuttingEdgebandSheet(ctx, mod, area);
    scaleLabel = "TABLO (mm)";
  } else if (page.kind === "isometric_dimensions" && mod) {
    bodySvg = renderIsometricDimensionsSheet(ctx, mod, area);
    scaleLabel = "İZOMETRİK";
  }

  const { chromeSvg } = renderIsoSheetChromeAndTitleBlock(ctx, page, scaleLabel);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%" style="background:#FFFFFF;display:block;">
    <defs>
      <pattern id="${hatchId}" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
        <rect width="8" height="8" fill="#F8FAFC" />
        <line x1="0" y1="0" x2="0" y2="8" stroke="${CAD_COLORS.hatch}" stroke-width="0.9" />
      </pattern>
    </defs>
    ${chromeSvg}
    ${bodySvg}
  </svg>`;
}

export function buildPrintableSheetsHtml(
  ctx: SheetBuildContext,
  pages: SheetPageDescriptor[]
): string {
  const paper = SHEET_PAPER_SPECS[ctx.options.paperFormat];
  const svgsHtml = pages
    .map((p) => `<section class="pafta-page">${buildProductionSheetSvgDocument(ctx, p)}</section>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>${escXml(ctx.meta.projectTitle || ctx.project.title)} — Üretim Paftaları</title>
  <style>
    @page { size: ${paper.cssPageSize}; margin: 5mm; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; font-family: -apple-system, Segoe UI, sans-serif; background: #FFFFFF; color: #0F172A; }
    .pafta-page { width: 100%; height: 100vh; page-break-after: always; break-after: page; display: flex; align-items: center; justify-content: center; padding: 2px; }
    .pafta-page:last-child { page-break-after: auto; break-after: auto; }
    .pafta-page svg { width: 100%; height: 100%; max-height: 98vh; object-fit: contain; }
    @media print { .pafta-page { height: calc(100vh - 2mm); } }
  </style>
</head>
<body>
  ${svgsHtml}
  <script>window.onload = () => setTimeout(() => window.print(), 260);</script>
</body>
</html>`;
}
