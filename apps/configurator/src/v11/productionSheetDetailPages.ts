import type { ModuleInstance } from "@birim/core";
import type { CutPiece } from "@birim/manufacturing";
import { buildExplodedIsoScene } from "../v3/utils/explodedIsoScene";
import {
  CAD_COLORS,
  escXml,
  getMaterialName,
  isDoorLeafRole,
  renderClosedVerticalChain,
  renderDimLine,
  renderViewCaption,
  type SheetBuildContext,
  type ViewportBox,
} from "./productionSheetTypes";
import {
  getDetailD4Title,
  renderHingeDrillingDetail1to1Svg,
  renderHingeSectionDetailSvg,
  resolveModuleHingeProfile,
} from "./hingeTechnicalDrawings";

function formatEdgeBandLabel(c: CutPiece): string {
  const edges: string[] = [];
  if (c.edgeBanding.top) edges.push("Ü");
  if (c.edgeBanding.bottom) edges.push("A");
  if (c.edgeBanding.left) edges.push("Sl");
  if (c.edgeBanding.right) edges.push("Sğ");
  if (edges.length === 0) return "Bantsız";
  const th = c.edgeBanding.thickness || 1;
  if (edges.length === 4) return `4 Kenar (${th}mm)`;
  return `${edges.join("+")} (${th}mm)`;
}

function renderLeaderLabel(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  label: string,
  align: "start" | "end" = "start"
): string {
  const elbowX = align === "start" ? x2 + 16 : x2 - 16;
  const tx = align === "start" ? elbowX + 4 : elbowX - 4;
  return `
    <g>
      <circle cx="${x1.toFixed(1)}" cy="${y1.toFixed(1)}" r="2.2" fill="${CAD_COLORS.ink}" />
      <polyline points="${x1.toFixed(1)},${y1.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)} ${elbowX.toFixed(1)},${y2.toFixed(1)}" fill="none" stroke="${CAD_COLORS.ink}" stroke-width="0.85" />
      <text x="${tx.toFixed(1)}" y="${(y2 + 3).toFixed(1)}" text-anchor="${align}" font-family="Segoe UI, sans-serif" font-size="10.5" font-weight="700" fill="${CAD_COLORS.ink}">${escXml(label)}</text>
    </g>
  `;
}

/**
 * PAFTA 03 — 1:2 DÜĞÜM & BAĞLANTI DETAYLARI (DETAY D1..D4)
 * Tüm ölçüler gerçek modül kalınlıkları ve delik parametreleriyle birebir ölçekli çizilir.
 */
export function renderJoineryDetailsSheet(
  ctx: SheetBuildContext,
  mod: ModuleInstance,
  area: ViewportBox,
  hatchId: string
): string {
  const T = mod.carcass.panelThickness || 18;
  const backT = mod.carcass.backPanelThickness || 8;
  const backOff = mod.carcass.backOffsetMm ?? 12;
  const plinth = mod.carcass.plinthHeight || 80;
  const plinthRecess = mod.carcass.plinthSetbackMm ?? 35;
  const doorT = mod.carcass.doorThickness || 18;
  const modPieces = ctx.bom.cutList.filter((p) => p.moduleId === mod.id);
  const sampleHinge = modPieces.flatMap((p) => p.holes || []).find((h) => h.purpose === "hinge_cup");
  const hingeProfile = resolveModuleHingeProfile(mod, ctx.bom.hardwareList);
  const hingeSetback = sampleHinge ? Math.round(sampleHinge.x * 10) / 10 : 21.5;

  const colW = Math.round(area.w / 2) - 16;
  const rowH = Math.round(area.h / 2) - 16;
  const R = Math.min(182, Math.round(Math.min(colW, rowH) * 0.39));

  const centers = [
    { x: area.x + colW * 0.5, y: area.y + rowH * 0.45, code: "DETAY D1", title: "MİNİFİKS + KAVELA GÖVDE BİRLEŞİMİ (ÖLÇEK 1:2)" },
    { x: area.x + colW * 1.54, y: area.y + rowH * 0.45, code: "DETAY D2", title: "KANALLI ARKALIK BİRLEŞİMİ (ÖLÇEK 1:2)" },
    { x: area.x + colW * 0.5, y: area.y + rowH * 1.49, code: "DETAY D3", title: "BAZA, ALT TABLA & AYARLI AYAK DETAYI (ÖLÇEK 1:2)" },
    { x: area.x + colW * 1.54, y: area.y + rowH * 1.49, code: "DETAY D4", title: getDetailD4Title(hingeProfile) },
  ];

  const circleFrame = (idx: number, body: string) => {
    const c = centers[idx];
    const clipId = `detail_clip_${idx}`;
    return `
      <defs><clipPath id="${clipId}"><circle cx="${c.x}" cy="${c.y}" r="${R - 2}" /></clipPath></defs>
      <circle cx="${c.x}" cy="${c.y}" r="${R}" fill="#FFFFFF" stroke="${CAD_COLORS.ink}" stroke-width="1.4" />
      <g clip-path="url(#${clipId})">${body}</g>
      ${renderViewCaption(c.x, c.y + R + 20, c.code, c.title)}
    `;
  };

  // D1: Vertical side/divider (width T) + Horizontal shelf/top (height T) + true 34mm Minifix cam Ø15 + dowel line
  const d1 = (() => {
    const { x, y } = centers[0];
    const s = 2.6;
    const pT = T * s;
    const camDist = 34 * s;
    const camR = 7.5 * s;
    const camDepth = 13.5 * s;
    const vx0 = x - 85;
    const hy0 = y - pT / 2;
    const camCx = vx0 + pT + camDist;
    return `
      <!-- Vertical panel -->
      <rect x="${vx0}" y="${y - R}" width="${pT}" height="${R * 2}" fill="url(#${hatchId})" stroke="${CAD_COLORS.ink}" stroke-width="1.6" />
      <!-- Horizontal shelf/panel (butted cleanly against vertical inner face) -->
      <rect x="${vx0 + pT}" y="${hy0}" width="${R + 40}" height="${pT}" fill="url(#${hatchId})" stroke="${CAD_COLORS.ink}" stroke-width="1.6" />
      <!-- Minifix bolt axis -->
      <line x1="${vx0 + pT * 0.4}" y1="${y}" x2="${camCx + camR + 10}" y2="${y}" stroke="${CAD_COLORS.plane}" stroke-width="0.9" stroke-dasharray="6 2 1.5 2" />
      <!-- Threaded dowel sleeve inside vertical panel -->
      <rect x="${vx0 + pT - 10 * s}" y="${y - 4 * s}" width="${10 * s}" height="${8 * s}" fill="#94A3B8" stroke="${CAD_COLORS.ink}" stroke-width="0.9" />
      <!-- Minifix bolt shaft -->
      <rect x="${vx0 + pT}" y="${y - 2.8 * s}" width="${camDist}" height="${5.6 * s}" fill="#CBD5E1" stroke="${CAD_COLORS.ink}" stroke-width="0.9" />
      <!-- Ø15 Minifix Cam Housing (seen from top dashed / pocket) -->
      <rect x="${camCx - camR}" y="${hy0 + pT - camDepth}" width="${camR * 2}" height="${camDepth}" fill="#FFFFFF" stroke="${CAD_COLORS.ink}" stroke-width="1.3" />
      <line x1="${camCx}" y1="${hy0 - 12}" x2="${camCx}" y2="${hy0 + pT + 10}" stroke="${CAD_COLORS.plane}" stroke-width="0.8" stroke-dasharray="4 2 1.5 2" />
      <!-- Dimensions -->
      ${renderDimLine(vx0, hy0 - 44, vx0 + pT, hy0 - 44, `${T}`, "horizontal", hy0)}
      ${renderDimLine(vx0 + pT, hy0 + pT + 36, camCx, hy0 + pT + 36, "34 (Eks.)", "horizontal", hy0 + pT)}
      ${renderDimLine(vx0 + pT + camDist + 48, hy0, vx0 + pT + camDist + 48, hy0 + pT, `${T}`, "vertical", vx0 + pT + camDist)}
      ${renderLeaderLabel(camCx, hy0 + pT - camDepth, camCx + 18, hy0 - 44, "Ø15 Minifiks (Der. 13.5)", "start")}
      ${renderLeaderLabel(vx0 + pT - 5 * s, y + 3 * s, vx0 - 18, y + 58, "Ø8 Dübel / Mil", "end")}
    `;
  })();

  // D2: Side panel (T) + grooved back panel (backT) inset by backOff
  const d2 = (() => {
    const { x, y } = centers[1];
    const s = 3.0;
    const pT = T * s;
    const bT = backT * s;
    const bOff = backOff * s;
    const grooveD = 8 * s;
    const sx0 = x - 78;
    const rearY = y + 58;
    const grooveTopY = rearY - bOff - bT;
    const backEndX = sx0 + pT + 96;
    return `
      <!-- Side Panel Top View (U-shaped with back groove cut out) -->
      <polygon points="${sx0},${y - R} ${sx0 + pT},${y - R} ${sx0 + pT},${grooveTopY - 2} ${sx0 + pT - grooveD},${grooveTopY - 2} ${sx0 + pT - grooveD},${rearY - bOff + 2} ${sx0 + pT},${rearY - bOff + 2} ${sx0 + pT},${rearY} ${sx0},${rearY}" fill="url(#${hatchId})" stroke="${CAD_COLORS.ink}" stroke-width="1.6" />
      <!-- Back Panel seated into groove (ends cleanly before dim line!) -->
      <rect x="${sx0 + pT - grooveD + 2}" y="${grooveTopY}" width="${backEndX - (sx0 + pT - grooveD + 2)}" height="${bT}" fill="#FFFFFF" stroke="${CAD_COLORS.ink}" stroke-width="1.5" />
      <!-- Clean vertical dimensions placed RIGHT of backEndX -->
      ${renderDimLine(sx0, y - 82, sx0 + pT, y - 82, `${T}`, "horizontal", y - 60)}
      ${renderDimLine(sx0 + pT - grooveD, rearY + 30, sx0 + pT, rearY + 30, "8 (Kanal)", "horizontal", rearY)}
      ${renderDimLine(backEndX + 18, grooveTopY, backEndX + 18, rearY - bOff, `${backT}`, "vertical", backEndX)}
      ${renderDimLine(backEndX + 18, rearY - bOff, backEndX + 18, rearY, `${backOff}`, "vertical", backEndX)}
      ${renderLeaderLabel(sx0 + pT - grooveD / 2, grooveTopY, sx0 + pT + 26, grooveTopY - 46, `Kanal ${(backT + 0.5).toFixed(1)}×8 mm`, "start")}
    `;
  })();

  // D3: Side Panel (goes down to floor/plinth) + Bottom Panel (starts after side panel!) + Recessed Plinth + Adjustable Foot
  const d3 = (() => {
    const { x, y } = centers[2];
    const s = 1.65;
    const pT = T * s;
    const pH = plinth * s;
    const pRec = plinthRecess * s;
    const floorY = y + pH * 0.65;
    const frontX = x - 62;
    const botY = floorY - pH - pT;
    return `
      <!-- Floor line -->
      <line x1="${x - R + 18}" y1="${floorY}" x2="${x + R - 18}" y2="${floorY}" stroke="${CAD_COLORS.ink}" stroke-width="1.8" />
      <!-- Side Panel (front edge at frontX, depth shown as cross-section/elevation edge) -->
      <rect x="${frontX}" y="${botY - 82}" width="${pT}" height="${82 + pT + pH}" fill="url(#${hatchId})" stroke="${CAD_COLORS.ink}" stroke-width="1.5" />
      <!-- Bottom Carcass Panel (butts cleanly to side panel inner face!) -->
      <rect x="${frontX + pT}" y="${botY}" width="${R + 18}" height="${pT}" fill="#FFFFFF" stroke="${CAD_COLORS.ink}" stroke-width="1.5" />
      <!-- Recessed Front Plinth Board -->
      <rect x="${frontX + pRec}" y="${floorY - pH}" width="${pT}" height="${pH}" fill="url(#${hatchId})" stroke="${CAD_COLORS.ink}" stroke-width="1.5" />
      <!-- Adjustable Leveler Foot -->
      <rect x="${frontX + pRec + pT + 26}" y="${floorY - pH}" width="16" height="${Math.max(12, pH - 10)}" fill="#CBD5E1" stroke="${CAD_COLORS.ink}" stroke-width="1" />
      <rect x="${frontX + pRec + pT + 18}" y="${floorY - 10}" width="32" height="10" rx="1.5" fill="#475569" stroke="${CAD_COLORS.ink}" stroke-width="1" />
      <!-- Dimensions -->
      ${renderDimLine(frontX, botY - 26, frontX + pRec, botY - 26, `${plinthRecess}`, "horizontal", botY)}
      ${renderDimLine(frontX - 28, floorY - pH, frontX - 28, floorY, `${plinth}`, "vertical", frontX)}
      ${renderDimLine(frontX - 28, botY, frontX - 28, floorY - pH, `${T}`, "vertical", frontX)}
      ${renderLeaderLabel(frontX + pRec + pT + 34, floorY - 18, frontX + pRec + pT + 64, floorY - 48, "Ayarlı Ayak", "start")}
    `;
  })();

  // D4: Seçili menteşe modeli için gerçek üretici teknik kesit çizimi (Blum / Hettich / Salice / Grass)
  const d4 = renderHingeSectionDetailSvg({
    cx: centers[3].x,
    cy: centers[3].y,
    R,
    panelT: T,
    doorT,
    hingeSetbackMm: hingeSetback,
    hatchId,
    profile: hingeProfile,
  });

  return circleFrame(0, d1) + circleFrame(1, d2) + circleFrame(2, d3) + circleFrame(3, d4);
}

/**
 * PAFTA 04 — PATLATILMIŞ MONTAJ PERSPEKTİFİ & POZ LİSTESİ (BOM)
 * Paylaşılan `buildExplodedIsoScene` motoru üzerine DIN/ISO teknik detaylandırma.
 */
export function renderExplodedBomSheet(
  ctx: SheetBuildContext,
  mod: ModuleInstance,
  area: ViewportBox
): string {
  const leftW = Math.round(area.w * 0.58);
  const rightX = area.x + leftW + 14;
  const rightW = area.w - leftW - 14;
  const isoBox: ViewportBox = { x: area.x + 8, y: area.y + 12, w: leftW - 16, h: area.h - 46 };

  const modPieces = ctx.bom.cutList.filter((p) => p.moduleId === mod.id);
  const isoScene = buildExplodedIsoScene(mod, {
    svgX: isoBox.x,
    svgY: isoBox.y,
    svgW: isoBox.w,
    svgH: isoBox.h,
    padX: 118,
    padY: 34,
    sys32Count: 9,
  });

  // Map componentRole -> exact BOM Poz codes ("P6", "P14,P40", etc.)
  const pozByRole = new Map<string, string[]>();
  modPieces.forEach((p, idx) => {
    const arr = pozByRole.get(p.componentRole) || [];
    arr.push(`P${idx + 1}`);
    pozByRole.set(p.componentRole, arr);
  });

  const codeToPoz = (code: string): string => {
    const joinPoz = (roles: string[]) => {
      const list = roles.flatMap((r) => pozByRole.get(r) || []);
      if (list.length === 0) return "";
      if (list.length === 1) return list[0];
      return list.length <= 2 ? list.join(",") : `${list[0]}..${list[list.length - 1]}`;
    };
    switch (code) {
      case "⑦":
        return joinPoz(["plinth"]);
      case "①":
        return joinPoz(["carcass_side_left"]);
      case "②":
        return joinPoz(["carcass_side_right"]);
      case "③":
        return joinPoz(["carcass_bottom"]);
      case "④":
        return joinPoz(["carcass_top"]);
      case "⑤":
        return joinPoz(["carcass_divider", "sub_divider"]);
      case "⑥":
        return joinPoz(["carcass_back"]);
      case "⑧":
        return joinPoz(["shelf", "hanging_rail"]);
      case "⑨":
        return joinPoz(["drawer_front", "drawer_side", "drawer_box"]);
      case "⑩":
        return joinPoz(["door_left", "door_right", "door_sliding"]);
      default:
        return "";
    }
  };

  const markerId = `pafta4-asm-arrow-${mod.id}`;
  const defsSvg = `
    <defs>
      <marker id="${markerId}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1.2 L 9.2 5 L 0 8.8 z" fill="${CAD_COLORS.plane}" />
      </marker>
    </defs>
  `;

  // Render clean CAD vector faces + machining details (Sistem 32, grooves, Ø35 hinge cups, handles)
  const boxesSvg = isoScene.renderedBoxes
    .map((b) => {
      const isDoor = b.kind === "door";
      const isPlinth = b.kind === "plinth";
      const isBack = b.kind === "back";
      const isDrawer = b.kind === "drawer";
      const isRail = b.kind === "rail";

      const front = isDoor
        ? "#FFFFFF"
        : isPlinth
        ? "#CBD5E1"
        : isBack
        ? "#F1F5F9"
        : isDrawer
        ? "#FEF3C7"
        : isRail
        ? "#94A3B8"
        : "#F8FAFC";
      const side = isDoor
        ? "#E2E8F0"
        : isPlinth
        ? "#94A3B8"
        : isBack
        ? "#CBD5E1"
        : isDrawer
        ? "#FDE68A"
        : isRail
        ? "#64748B"
        : "#E2E8F0";
      const top = isDoor ? "#FFFFFF" : isPlinth ? "#E2E8F0" : isDrawer ? "#FFFBEB" : "#FFFFFF";
      const op = isDoor ? 0.86 : b.opacity ?? 1;

      const polys = `
        ${b.topPoly ? `<polygon points="${b.topPoly}" fill="${top}" stroke="${CAD_COLORS.ink}" stroke-width="0.85" stroke-linejoin="round" />` : ""}
        ${b.rightPoly ? `<polygon points="${b.rightPoly}" fill="${side}" stroke="${CAD_COLORS.ink}" stroke-width="0.85" stroke-linejoin="round" />` : ""}
        ${b.frontPoly ? `<polygon points="${b.frontPoly}" fill="${front}" stroke="${CAD_COLORS.ink}" stroke-width="0.95" stroke-linejoin="round" />` : ""}
        ${b.trackGroovePoly ? `<polygon points="${b.trackGroovePoly}" fill="none" stroke="${CAD_COLORS.plane}" stroke-width="1" stroke-dasharray="4 2" />` : ""}
      `;
      const slats = b.slatLines
        .map(
          (sl) =>
            `<line x1="${sl.x1}" y1="${sl.y1}" x2="${sl.x2}" y2="${sl.y2}" stroke="${CAD_COLORS.subInk}" stroke-width="${sl.dashed ? "0.8" : "0.7"}" ${sl.dashed ? 'stroke-dasharray="3 2"' : ""} opacity="0.7" />`
        )
        .join("");
      const groove = b.grooveLine
        ? `<line x1="${b.grooveLine.x1}" y1="${b.grooveLine.y1}" x2="${b.grooveLine.x2}" y2="${b.grooveLine.y2}" stroke="${CAD_COLORS.dim}" stroke-width="0.95" stroke-dasharray="3.5 2" />`
        : "";
      const sys32 = b.sys32Pts
        .map(
          (pt) =>
            `<circle cx="${pt.cx}" cy="${pt.cy}" r="1.45" fill="${CAD_COLORS.plane}" />`
        )
        .join("");
      const cups = b.hingeCups
        .map(
          (cup) =>
            `<circle cx="${cup.cx}" cy="${cup.cy}" r="2.8" fill="#FEE2E2" stroke="${CAD_COLORS.dim}" stroke-width="0.95" />`
        )
        .join("");
      const handle = b.handleLine
        ? `<line x1="${b.handleLine.x1}" y1="${b.handleLine.y1}" x2="${b.handleLine.x2}" y2="${b.handleLine.y2}" stroke="${CAD_COLORS.ink}" stroke-width="2.1" stroke-linecap="round" />`
        : "";

      return `<g opacity="${op}">${polys}${slats}${groove}${sys32}${cups}${handle}</g>`;
    })
    .join("");

  // Dashed blue assembly axis arrows + numbered step badges [1]..[6]
  const arrowsSvg = isoScene.arrows
    .map((arr) => {
      const mx = (arr.from.x + arr.to.x) / 2;
      const my = (arr.from.y + arr.to.y) / 2;
      return `
        <line x1="${arr.from.x}" y1="${arr.from.y}" x2="${arr.to.x}" y2="${arr.to.y}" stroke="${CAD_COLORS.plane}" stroke-width="1.1" stroke-dasharray="4.5 2.5" marker-end="url(#${markerId})" />
        <circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="7.5" fill="${CAD_COLORS.plane}" stroke="#FFFFFF" stroke-width="1.1" />
        <text x="${mx.toFixed(1)}" y="${(my + 2.8).toFixed(1)}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.5" font-weight="800" fill="#FFFFFF">${arr.stepNo}</text>
      `;
    })
    .join("");

  // Non-overlapping outer left/right callout pills with BOM Poz cross-reference
  const midIsoX = isoBox.x + isoBox.w * 0.5;
  const leftCalls = isoScene.callouts.filter((c) => c.x <= midIsoX).sort((a, b) => a.y - b.y);
  const rightCalls = isoScene.callouts.filter((c) => c.x > midIsoX).sort((a, b) => a.y - b.y);

  const distributeCalloutY = (items: typeof isoScene.callouts) => {
    const minGap = 28;
    const topMin = isoBox.y + 18;
    const botMax = isoBox.y + isoBox.h - 18;
    const ys = items.map((it) => Math.max(topMin, Math.min(botMax, it.y)));
    for (let i = 1; i < ys.length; i++) {
      if (ys[i] - ys[i - 1] < minGap) ys[i] = ys[i - 1] + minGap;
    }
    if (ys.length > 0 && ys[ys.length - 1] > botMax) {
      const shift = ys[ys.length - 1] - botMax;
      for (let i = 0; i < ys.length; i++) ys[i] -= shift;
      for (let i = ys.length - 2; i >= 0; i--) {
        if (ys[i + 1] - ys[i] < minGap) ys[i] = ys[i + 1] - minGap;
      }
    }
    return ys;
  };

  const renderCalloutCol = (items: typeof isoScene.callouts, side: "left" | "right") => {
    const ys = distributeCalloutY(items);
    const pillW = 114;
    const pillH = 21;
    return items
      .map((c, idx) => {
        const ly = ys[idx];
        const ax = Math.max(isoBox.x + pillW + 18, Math.min(isoBox.x + isoBox.w - pillW - 18, c.x));
        const ay = Math.max(isoBox.y + 12, Math.min(isoBox.y + isoBox.h - 12, c.y));
        const pillX = side === "left" ? isoBox.x + 2 : isoBox.x + isoBox.w - 2 - pillW;
        const edgeX = side === "left" ? pillX + pillW : pillX;
        const elbowX = side === "left" ? edgeX + 10 : edgeX - 10;
        const pozTag = codeToPoz(c.code);
        const badgeText = pozTag ? `${c.num} • ${pozTag}` : c.num;
        return `
          <polyline points="${edgeX.toFixed(1)},${ly.toFixed(1)} ${elbowX.toFixed(1)},${ly.toFixed(1)} ${ax.toFixed(1)},${ay.toFixed(1)}" fill="none" stroke="${CAD_COLORS.subInk}" stroke-width="0.9" stroke-dasharray="3 2" />
          <circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="2.6" fill="${CAD_COLORS.ink}" stroke="#FFFFFF" stroke-width="0.9" />
          <rect x="${pillX}" y="${(ly - pillH / 2).toFixed(1)}" width="${pillW}" height="${pillH}" rx="4" fill="#FFFFFF" stroke="${CAD_COLORS.ink}" stroke-width="0.9" />
          <rect x="${pillX + 2}" y="${(ly - pillH / 2 + 2).toFixed(1)}" width="36" height="${pillH - 4}" rx="2.5" fill="${CAD_COLORS.ink}" />
          <text x="${pillX + 20}" y="${(ly + 2.8).toFixed(1)}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.5" font-weight="800" fill="#FFFFFF">${escXml(badgeText.slice(0, 8))}</text>
          <text x="${pillX + 42}" y="${(ly + 3).toFixed(1)}" font-family="Segoe UI, sans-serif" font-size="9.5" font-weight="700" fill="${CAD_COLORS.ink}">${escXml(c.label.slice(0, 15))}</text>
        `;
      })
      .join("");
  };

  // Right column: Full BOM table + Assembly sequence + Hardware Fastener strip
  const stepsReserveH = 148;
  const availTblH = Math.max(220, area.h - stepsReserveH - 36);
  const rowH = Math.max(12.5, Math.min(17.5, Math.floor((availTblH - 22) / Math.max(1, modPieces.length))));
  const fontSz = rowH <= 13.5 ? 7.9 : 8.6;
  const tblY = area.y + 22;

  const tblHeader = `
    <text x="${rightX}" y="${area.y + 14}" font-family="Segoe UI, sans-serif" font-size="11" font-weight="800" fill="${CAD_COLORS.ink}">PARÇA POZ LİSTESİ (BOM — ${modPieces.length} KALEM)</text>
    <rect x="${rightX}" y="${tblY}" width="${rightW}" height="17" fill="#E2E8F0" stroke="${CAD_COLORS.ink}" stroke-width="0.9" />
    <text x="${rightX + 6}" y="${tblY + 12}" font-family="ui-monospace, monospace" font-size="9.5" font-weight="800" fill="${CAD_COLORS.ink}">POZ</text>
    <text x="${rightX + 38}" y="${tblY + 12}" font-family="Segoe UI, sans-serif" font-size="9.5" font-weight="800" fill="${CAD_COLORS.ink}">PARÇA ADI</text>
    <text x="${rightX + rightW - 38}" y="${tblY + 12}" text-anchor="end" font-family="ui-monospace, monospace" font-size="9.5" font-weight="800" fill="${CAD_COLORS.ink}">ÖLÇÜ (mm)</text>
    <text x="${rightX + rightW - 6}" y="${tblY + 12}" text-anchor="end" font-family="ui-monospace, monospace" font-size="9.5" font-weight="800" fill="${CAD_COLORS.ink}">AD</text>
  `;
  const rows = modPieces
    .map((p, i) => {
      const y = tblY + 17 + i * rowH;
      const l = Math.round(p.netCutLengthMm ?? p.lengthMm);
      const w = Math.round(p.netCutWidthMm ?? p.widthMm);
      return `
        <rect x="${rightX}" y="${y}" width="${rightW}" height="${rowH}" fill="${i % 2 ? "#F8FAFC" : "#FFFFFF"}" stroke="#CBD5E1" stroke-width="0.55" />
        <text x="${rightX + 6}" y="${y + rowH - 3.2}" font-family="ui-monospace, monospace" font-size="${fontSz}" font-weight="800" fill="${CAD_COLORS.ink}">P${i + 1}</text>
        <text x="${rightX + 38}" y="${y + rowH - 3.2}" font-family="Segoe UI, sans-serif" font-size="${fontSz}" font-weight="600" fill="${CAD_COLORS.ink}">${escXml(p.pieceName.slice(0, 34))}</text>
        <text x="${rightX + rightW - 38}" y="${y + rowH - 3.2}" text-anchor="end" font-family="ui-monospace, monospace" font-size="${fontSz}" fill="${CAD_COLORS.subInk}">${l}×${w}×${p.thicknessMm}</text>
        <text x="${rightX + rightW - 6}" y="${y + rowH - 3.2}" text-anchor="end" font-family="ui-monospace, monospace" font-size="${fontSz}" font-weight="800" fill="${CAD_COLORS.ink}">${p.quantity}</text>
      `;
    })
    .join("");

  const stepsY = tblY + 17 + modPieces.length * rowH + 16;
  const steps = [
    "1. Baza çerçevesini (⑦) kurup ayarlı ayakları terazileyin.",
    "2. Sol/Sağ yan dikme (①,②) + ara dikmeyi (⑤) alt tablaya (③) minifiks + kavela ile bağlayın.",
    "3. 8 mm arkalığı (⑥) dikme kanallarına sürüp üst tablayı (④) kilitleyin.",
    "4. Rafları (⑧ • Ø5 raf pimi) ve askı borusu flanşlarını yerleştirin.",
    "5. Çekmece raylarını vidalayıp çekmece kasalarını (⑨) oturtun.",
    "6. Kapakları (⑩ • Ø35 tas) asıp 2 mm derz boşluklarını ayarlayın.",
  ];
  const hwSummary = ctx.bom.hardwareList
    .slice(0, 4)
    .map((h) => `${h.sku} ×${h.quantity}`)
    .join("  •  ");
  const stepsSvg = `
    <text x="${rightX}" y="${stepsY}" font-family="Segoe UI, sans-serif" font-size="10" font-weight="800" fill="${CAD_COLORS.ink}">ATÖLYE MONTAJ SIRASI (OK NUMARALARI İLE EŞLEŞİR):</text>
    ${steps
      .map(
        (st, idx) =>
          `<text x="${rightX}" y="${stepsY + 14.5 + idx * 13.5}" font-family="Segoe UI, sans-serif" font-size="9.5" fill="${CAD_COLORS.subInk}">${escXml(st)}</text>`
      )
      .join("")}
    ${
      hwSummary
        ? `<rect x="${rightX}" y="${stepsY + 99}" width="${rightW}" height="18" rx="3" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="0.7" />
           <text x="${rightX + 6}" y="${stepsY + 111}" font-family="ui-monospace, monospace" font-size="9.5" font-weight="700" fill="${CAD_COLORS.ink}">HIRDAVAT: ${escXml(hwSummary)}</text>`
        : ""
    }
  `;

  return (
    defsSvg +
    `<rect x="${isoBox.x}" y="${isoBox.y}" width="${isoBox.w}" height="${isoBox.h}" rx="6" fill="#FCFCFD" stroke="#E2E8F0" stroke-width="0.8" />` +
    boxesSvg +
    arrowsSvg +
    renderCalloutCol(leftCalls, "left") +
    renderCalloutCol(rightCalls, "right") +
    renderViewCaption(
      isoBox.x + isoBox.w / 2,
      area.y + area.h - 18,
      "PATLATILMIŞ MONTAJ PERSPEKTİFİ",
      "SİSTEM 32 • KANAL • Ø35 TAS • MONTAJ ADIMI [1..6] & POZ NO EŞLEŞTİRME"
    ) +
    tblHeader +
    rows +
    stepsSvg
  );
}

/**
 * PAFTA 05 — PANEL İŞLEME, SİSTEM 32 & DELİK KOORDİNATLARI
 */
export function renderPanelDrillingSheet(
  ctx: SheetBuildContext,
  mod: ModuleInstance,
  area: ViewportBox
): string {
  const modPieces = ctx.bom.cutList.filter((p) => p.moduleId === mod.id);
  const sidePiece =
    modPieces.find((p) => p.componentRole === "carcass_side_left") ||
    modPieces.find((p) => p.componentRole.includes("side")) ||
    modPieces[0];
  const doorPiece = modPieces.find(
    (p) =>
      p.componentRole === "door_left" ||
      p.componentRole === "door_right" ||
      p.componentRole === "door_sliding"
  );

  const p1Box: ViewportBox = { x: area.x + 28, y: area.y + 28, w: Math.round(area.w * 0.25), h: area.h - 72 };
  const p2Box: ViewportBox = { x: area.x + Math.round(area.w * 0.31), y: area.y + 28, w: Math.round(area.w * 0.26), h: area.h - 72 };
  const rightX = area.x + Math.round(area.w * 0.60);
  const rightW = area.w - Math.round(area.w * 0.60) - 8;

  const isDoorPiece = (p?: CutPiece) => Boolean(p && isDoorLeafRole(p.componentRole));

  const drawPanelWithHoles = (piece: CutPiece | undefined, box: ViewportBox, label: string) => {
    if (!piece) return "";
    const pw = piece.widthMm;
    const ph = piece.lengthMm;
    const s = Math.min((box.w - 94) / Math.max(100, pw), (box.h - 86) / Math.max(100, ph));
    const rx = box.x + (box.w - pw * s) / 2 - (isDoorPiece(piece) ? 14 : 0);
    const ry = box.y + (box.h - ph * s) / 2;
    const rw = pw * s;
    const rh = ph * s;
    const mapY = (yMm: number) => ry + rh - yMm * s;

    const grooveSvg = piece.hasBackGroove
      ? (() => {
          const gOff = piece.backGrooveOffsetMm ?? 12;
          const gWmm = piece.backGrooveWidthMm ?? 8.5;
          const gW = gWmm * s;
          const gx = rx + rw - (gOff + gWmm) * s;
          return `<rect x="${gx.toFixed(1)}" y="${ry.toFixed(1)}" width="${Math.max(2, gW).toFixed(1)}" height="${rh.toFixed(1)}" fill="#E2E8F0" stroke="${CAD_COLORS.ink}" stroke-width="0.9" />
                  <line x1="${(gx + gW / 2).toFixed(1)}" y1="${(ry + rh).toFixed(1)}" x2="${(gx + gW / 2).toFixed(1)}" y2="${(ry + rh + 16).toFixed(1)}" stroke="${CAD_COLORS.ink}" stroke-width="0.7" />
                  <text x="${(rx + rw).toFixed(1)}" y="${(ry + rh + 26).toFixed(1)}" text-anchor="end" font-family="ui-monospace, monospace" font-size="9.5" font-weight="700" fill="${CAD_COLORS.ink}">Kanal ${gWmm} (${gOff}mm)</text>`;
        })()
      : "";

    const rawHoles = piece.holes || [];
    const drawHoles = rawHoles.slice(0, 140);
    const cupHoles = rawHoles
      .filter((h) => h.purpose === "hinge_cup" && h.diameter >= 20)
      .sort((a, b) => a.y - b.y);
    const uniqueCupYs = Array.from(new Set(cupHoles.map((h) => Math.round(h.y))));
    const cupXMm = cupHoles[0]?.x;

    // Hinge Y centerlines & setback X axis on doors; Sistem 32 & Minifix axes on sides
    let axesSvg = "";
    let hingeChainSvg = "";
    let topSubDimSvg = "";
    if (isDoorPiece(piece) && cupHoles.length > 0 && typeof cupXMm === "number") {
      const cupOnLeft = cupXMm < pw / 2;
      const cupSvgX = rx + cupXMm * s;
      axesSvg += `<line x1="${cupSvgX.toFixed(1)}" y1="${(ry - 8).toFixed(1)}" x2="${cupSvgX.toFixed(1)}" y2="${(ry + rh + 8).toFixed(1)}" stroke="${CAD_COLORS.plane}" stroke-width="0.8" stroke-dasharray="5 2 1.5 2" />`;
      uniqueCupYs.forEach((cyMm) => {
        const hy = mapY(cyMm);
        axesSvg += `<line x1="${(rx - 8).toFixed(1)}" y1="${hy.toFixed(1)}" x2="${(rx + rw + 10).toFixed(1)}" y2="${hy.toFixed(1)}" stroke="${CAD_COLORS.plane}" stroke-width="0.85" stroke-dasharray="6 2 1.5 2" />`;
      });
      // Closed vertical hinge Y-axis dimension chain on right side of door
      hingeChainSvg = renderClosedVerticalChain(
        [0, ...uniqueCupYs, ph],
        mapY,
        rx + rw + 24,
        rx + rw,
        ctx.options.unit
      );
      // Horizontal hinge setback X dimension at top (inside overall width dim)
      const setbackEdgeX = cupOnLeft ? rx : rx + rw;
      const setbackVal = Math.round((cupOnLeft ? cupXMm : pw - cupXMm) * 10) / 10;
      topSubDimSvg = renderDimLine(
        Math.min(setbackEdgeX, cupSvgX),
        ry - 14,
        Math.max(setbackEdgeX, cupSvgX),
        ry - 14,
        `${setbackVal}`,
        "horizontal",
        ry
      );
    } else if (piece.componentRole.includes("side") || piece.componentRole.includes("divider")) {
      axesSvg += `<line x1="${(rx + 37 * s).toFixed(1)}" y1="${(ry - 6).toFixed(1)}" x2="${(rx + 37 * s).toFixed(1)}" y2="${(ry + rh + 6).toFixed(1)}" stroke="${CAD_COLORS.plane}" stroke-width="0.8" stroke-dasharray="5 2 1.5 2" />`;
      topSubDimSvg = renderDimLine(rx, ry - 14, rx + 37 * s, ry - 14, "37", "horizontal", ry);
      // Key fixed horizontal joinery Y axes (bottom/top/fixed shelves)
      const structuralYs = Array.from(
        new Set(rawHoles.filter((h) => h.purpose === "minifix_bolt").map((h) => Math.round(h.y)))
      ).sort((a, b) => a - b);
      structuralYs.forEach((sy) => {
        const hy = mapY(sy);
        axesSvg += `<line x1="${(rx - 5).toFixed(1)}" y1="${hy.toFixed(1)}" x2="${(rx + rw + 5).toFixed(1)}" y2="${hy.toFixed(1)}" stroke="${CAD_COLORS.plane}" stroke-width="0.65" stroke-dasharray="5 2 1.5 2" opacity="0.7" />`;
      });
    }

    const holesSvg = drawHoles
      .map((h) => {
        const hx = rx + Math.max(0, Math.min(pw, h.x)) * s;
        const hy = mapY(Math.max(0, Math.min(ph, h.y)));
        const hr = Math.max(2, (h.diameter / 2) * s);
        const col = h.purpose === "hinge_cup" ? CAD_COLORS.dim : CAD_COLORS.ink;
        return `<circle cx="${hx.toFixed(1)}" cy="${hy.toFixed(1)}" r="${hr.toFixed(1)}" fill="#FFFFFF" stroke="${col}" stroke-width="1" />`;
      })
      .join("");

    const originSvg = `
      <circle cx="${rx.toFixed(1)}" cy="${(ry + rh).toFixed(1)}" r="4.5" fill="none" stroke="${CAD_COLORS.dim}" stroke-width="1.2" />
      <text x="${(rx - 8).toFixed(1)}" y="${(ry + rh + 14).toFixed(1)}" text-anchor="end" font-family="ui-monospace, monospace" font-size="9.5" font-weight="800" fill="${CAD_COLORS.dim}">(0,0)</text>
    `;

    return `
      <rect x="${rx.toFixed(1)}" y="${ry.toFixed(1)}" width="${rw.toFixed(1)}" height="${rh.toFixed(1)}" fill="#FFFFFF" stroke="${CAD_COLORS.ink}" stroke-width="1.4" />
      ${grooveSvg}
      ${axesSvg}
      ${holesSvg}
      ${originSvg}
      ${topSubDimSvg}
      ${renderDimLine(rx, ry - 34, rx + rw, ry - 34, `${Math.round(pw)}`, "horizontal", ry)}
      ${renderDimLine(rx - 22, ry, rx - 22, ry + rh, `${Math.round(ph)}`, "vertical", rx)}
      ${hingeChainSvg}
      ${renderViewCaption(rx + rw / 2, box.y + box.h + 2, label, `${Math.round(pw)} × ${Math.round(ph)} × ${piece.thicknessMm} mm`)}
    `;
  };

  // True 1:1 Hinge Cup Drilling Detail driven directly by doorPiece hole coordinates
  const doorHoles = doorPiece?.holes || [];
  const firstCup = doorHoles.find((h) => h.purpose === "hinge_cup" && h.diameter >= 20);
  const cupDiaMm = firstCup?.diameter ?? 35;
  const cupDepthMm = firstCup?.depth ?? 13;
  const cupSetbackMm =
    firstCup && doorPiece
      ? Math.round((firstCup.x < doorPiece.widthMm / 2 ? firstCup.x : doorPiece.widthMm - firstCup.x) * 10) / 10
      : 22;
  const nearbyDowels = firstCup
    ? doorHoles.filter(
        (h) => h.purpose === "hinge_cup" && h.diameter < 20 && Math.abs(h.y - firstCup.y) <= 35
      )
    : [];
  const dowelPitchMm =
    nearbyDowels.length >= 2
      ? Math.round(Math.abs(nearbyDowels[0].y - nearbyDowels[1].y) * 10) / 10
      : 45;
  const dowelOffsetMm =
    nearbyDowels.length >= 1 && firstCup
      ? Math.round(Math.abs(nearbyDowels[0].x - firstCup.x) * 10) / 10
      : 9.5;
  const kMarginMm = Math.round((cupSetbackMm - cupDiaMm / 2) * 10) / 10;

  const hCx = rightX + rightW * 0.5;
  const hCy = area.y + 98;
  const hR = 78;
  const hingeProfile = resolveModuleHingeProfile(mod, ctx.bom.hardwareList);
  const hingeDetailSvg = renderHingeDrillingDetail1to1Svg({
    hCx,
    hCy,
    hR,
    modId: mod.id,
    cupDiaMm,
    cupDepthMm,
    cupSetbackMm,
    dowelPitchMm,
    dowelOffsetMm,
    kMarginMm,
    profile: hingeProfile,
  });

  // Structured Non-Truncated Hole Coordinate Rows (All Hinge Cups + Key Carcass Joinery)
  interface CoordRow {
    piece: string;
    purpose: string;
    xLabel: string;
    yLabel: string;
    spec: string;
  }
  const coordRows: CoordRow[] = [];
  const allDoorCups = doorHoles
    .filter((h) => h.purpose === "hinge_cup" && h.diameter >= 20)
    .sort((a, b) => a.y - b.y);
  allDoorCups.forEach((h, idx) => {
    coordRows.push({
      piece: `Kapak Tas #${idx + 1}`,
      purpose: "Menteşe Tas",
      xLabel: `${Math.round(h.x * 10) / 10}`,
      yLabel: `${Math.round(h.y)}`,
      spec: `Ø${h.diameter} / ${h.depth}`,
    });
  });
  if (allDoorCups.length > 0) {
    coordRows.push({
      piece: "Kapak Tas Dübel",
      purpose: `${dowelPitchMm}mm Ara`,
      xLabel: `${Math.round((cupSetbackMm + dowelOffsetMm) * 10) / 10}`,
      yLabel: `Tas Y ± ${dowelPitchMm / 2}`,
      spec: `Ø${nearbyDowels[0]?.diameter ?? 8} / ${nearbyDowels[0]?.depth ?? 11}`,
    });
  }
  const handleHoles = doorHoles.filter((h) => h.purpose === "handle").sort((a, b) => a.y - b.y);
  handleHoles.forEach((h, idx) => {
    coordRows.push({
      piece: `Kapak Kulp #${idx + 1}`,
      purpose: "Kulp Vidası",
      xLabel: `${Math.round(h.x)}`,
      yLabel: `${Math.round(h.y)}`,
      spec: `Ø${h.diameter} / ${h.depth}`,
    });
  });

  const sideHoles = sidePiece?.holes || [];
  const sideJoineryYs = Array.from(
    new Set(sideHoles.filter((h) => h.purpose === "minifix_bolt" || h.purpose === "dowel").map((h) => Math.round(h.y)))
  ).sort((a, b) => a - b);
  sideJoineryYs.slice(0, 8).forEach((yVal) => {
    const xs = Array.from(
      new Set(
        sideHoles
          .filter((h) => (h.purpose === "minifix_bolt" || h.purpose === "dowel") && Math.round(h.y) === yVal)
          .map((h) => Math.round(h.x))
      )
    ).sort((a, b) => a - b);
    coordRows.push({
      piece: "Yan Dikme",
      purpose: "Minifiks+Kavela",
      xLabel: xs.length > 4 ? `${xs[0]}..${xs[xs.length - 1]}` : xs.join(","),
      yLabel: `${yVal}`,
      spec: "Ø8 / 11-12",
    });
  });
  const sys32Ys = sideHoles
    .filter((h) => h.purpose === "shelf_pin" || (h.diameter <= 5.5 && Math.abs(h.x - 37) < 2))
    .map((h) => Math.round(h.y))
    .sort((a, b) => a - b);
  if (sys32Ys.length > 0) {
    coordRows.push({
      piece: `Yan Dikme (${sys32Ys.length}×)`,
      purpose: "Sistem 32 Raf",
      xLabel: "37",
      yLabel: `${sys32Ys[0]}..${sys32Ys[sys32Ys.length - 1]} (32)`,
      spec: "Ø5 / 12",
    });
  }

  const tblY = area.y + 232;
  const maxRows = Math.min(coordRows.length, Math.max(8, Math.floor((area.h - 252) / 19)));
  const rowH = 19;
  const coordTbl = `
    <text x="${rightX}" y="${tblY - 8}" font-family="Segoe UI, sans-serif" font-size="11" font-weight="800" fill="${CAD_COLORS.ink}">DELİK KOORDİNAT TABLOSU (ELLE &amp; CNC)</text>
    <rect x="${rightX}" y="${tblY}" width="${rightW}" height="20" fill="#E2E8F0" stroke="${CAD_COLORS.ink}" stroke-width="0.9" />
    <text x="${rightX + 6}" y="${tblY + 14.5}" font-size="9.5" font-weight="800" fill="${CAD_COLORS.ink}">PARÇA</text>
    <text x="${rightX + 104}" y="${tblY + 14.5}" font-size="9.5" font-weight="800" fill="${CAD_COLORS.ink}">AMAÇ</text>
    <text x="${rightX + 196}" y="${tblY + 14.5}" font-family="ui-monospace, monospace" font-size="9.5" font-weight="800" fill="${CAD_COLORS.ink}">X (mm)</text>
    <text x="${rightX + 270}" y="${tblY + 14.5}" font-family="ui-monospace, monospace" font-size="9.5" font-weight="800" fill="${CAD_COLORS.ink}">Y (mm)</text>
    <text x="${rightX + rightW - 6}" y="${tblY + 14.5}" text-anchor="end" font-family="ui-monospace, monospace" font-size="9.5" font-weight="800" fill="${CAD_COLORS.ink}">Ø / DER.</text>
    ${coordRows
      .slice(0, maxRows)
      .map((h, i) => {
        const y = tblY + 20 + i * rowH;
        const isCup = h.piece.startsWith("Kapak Tas #");
        return `
          <rect x="${rightX}" y="${y}" width="${rightW}" height="${rowH}" fill="${isCup ? "#FEF2F2" : i % 2 ? "#F8FAFC" : "#FFFFFF"}" stroke="#CBD5E1" stroke-width="0.6" />
          <text x="${rightX + 6}" y="${y + 13.8}" font-size="9.5" font-weight="${isCup ? "800" : "700"}" fill="${CAD_COLORS.ink}">${escXml(h.piece)}</text>
          <text x="${rightX + 104}" y="${y + 13.8}" font-size="9.5" fill="${CAD_COLORS.subInk}">${escXml(h.purpose)}</text>
          <text x="${rightX + 196}" y="${y + 13.8}" font-family="ui-monospace, monospace" font-size="9.5" fill="${CAD_COLORS.ink}">${escXml(h.xLabel)}</text>
          <text x="${rightX + 270}" y="${y + 13.8}" font-family="ui-monospace, monospace" font-size="9.5" fill="${CAD_COLORS.ink}">${escXml(h.yLabel)}</text>
          <text x="${rightX + rightW - 6}" y="${y + 13.8}" text-anchor="end" font-family="ui-monospace, monospace" font-size="9.5" font-weight="800" fill="${isCup ? CAD_COLORS.dim : CAD_COLORS.ink}">${escXml(h.spec)}</text>
        `;
      })
      .join("")}
  `;

  return (
    drawPanelWithHoles(sidePiece, p1Box, `YAN DİKME İŞLEME DETAYI`) +
    drawPanelWithHoles(doorPiece, p2Box, `KAPAK DELİK DETAYI`) +
    hingeDetailSvg +
    coordTbl
  );
}

/**
 * PAFTA 06 — TAM KESİM LİSTESİ, SUYOLU (GRAIN) & KENAR BANTLAMA ŞEMASI
 */
export function renderCuttingEdgebandSheet(
  ctx: SheetBuildContext,
  mod: ModuleInstance,
  area: ViewportBox
): string {
  const modPieces = ctx.bom.cutList.filter((p) => p.moduleId === mod.id);
  const leftW = Math.round(area.w * 0.65);
  const rightX = area.x + leftW + 16;
  const rightW = area.w - leftW - 16;

  const tblY = area.y + 24;
  const rowH = Math.max(13.5, Math.min(19, Math.floor((area.h - 52) / Math.max(1, modPieces.length))));
  const fontSz = rowH <= 15 ? 8.3 : 9;
  const col = {
    no: area.x + 8,
    name: area.x + 28,
    dim: area.x + Math.round(leftW * 0.56),
    qty: area.x + Math.round(leftW * 0.63),
    mat: area.x + Math.round(leftW * 0.66),
    pvc: area.x + leftW - 8,
  };

  const cutHeader = `
    <text x="${area.x}" y="${area.y + 16}" font-family="Segoe UI, sans-serif" font-size="11.5" font-weight="800" fill="${CAD_COLORS.ink}">TAM NET KESİM LİSTESİ (${modPieces.length} KALEM — TESTERE ÖLÇÜSÜ mm)</text>
    <rect x="${area.x}" y="${tblY}" width="${leftW}" height="20" fill="#E2E8F0" stroke="${CAD_COLORS.ink}" stroke-width="0.9" />
    <text x="${col.no}" y="${tblY + 14}" font-family="ui-monospace, monospace" font-size="10" font-weight="800" fill="${CAD_COLORS.ink}">#</text>
    <text x="${col.name}" y="${tblY + 14}" font-family="Segoe UI, sans-serif" font-size="10" font-weight="800" fill="${CAD_COLORS.ink}">PARÇA ADI</text>
    <text x="${col.dim}" y="${tblY + 14}" text-anchor="end" font-family="ui-monospace, monospace" font-size="10" font-weight="800" fill="${CAD_COLORS.ink}">KESİM (mm)*</text>
    <text x="${col.qty}" y="${tblY + 14}" text-anchor="end" font-family="ui-monospace, monospace" font-size="10" font-weight="800" fill="${CAD_COLORS.ink}">AD</text>
    <text x="${col.mat}" y="${tblY + 14}" font-family="Segoe UI, sans-serif" font-size="10" font-weight="800" fill="${CAD_COLORS.ink}">MALZEME</text>
    <text x="${col.pvc}" y="${tblY + 14}" text-anchor="end" font-family="ui-monospace, monospace" font-size="10" font-weight="800" fill="${CAD_COLORS.ink}">KENAR BANDI</text>
  `;

  const cutRows = modPieces
    .map((p, i) => {
      const y = tblY + 20 + i * rowH;
      const l = Math.round(p.netCutLengthMm ?? p.lengthMm);
      const w = Math.round(p.netCutWidthMm ?? p.widthMm);
      return `
        <rect x="${area.x}" y="${y}" width="${leftW}" height="${rowH}" fill="${i % 2 ? "#F8FAFC" : "#FFFFFF"}" stroke="#CBD5E1" stroke-width="0.55" />
        <text x="${col.no}" y="${y + rowH - 3.5}" font-family="ui-monospace, monospace" font-size="${fontSz}" fill="${CAD_COLORS.muted}">${i + 1}</text>
        <text x="${col.name}" y="${y + rowH - 3.5}" font-family="Segoe UI, sans-serif" font-size="${fontSz}" font-weight="700" fill="${CAD_COLORS.ink}">${escXml(p.pieceName.slice(0, 34))}</text>
        <text x="${col.dim}" y="${y + rowH - 3.5}" text-anchor="end" font-family="ui-monospace, monospace" font-size="${fontSz}" font-weight="700" fill="${CAD_COLORS.ink}">${l}×${w}×${p.thicknessMm}</text>
        <text x="${col.qty}" y="${y + rowH - 3.5}" text-anchor="end" font-family="ui-monospace, monospace" font-size="${fontSz}" font-weight="800" fill="${CAD_COLORS.ink}">${p.quantity}</text>
        <text x="${col.mat}" y="${y + rowH - 3.5}" font-family="Segoe UI, sans-serif" font-size="${fontSz - 0.5}" fill="${CAD_COLORS.subInk}">${escXml(p.materialName.slice(0, 20))}</text>
        <text x="${col.pvc}" y="${y + rowH - 3.5}" text-anchor="end" font-family="ui-monospace, monospace" font-size="${fontSz - 0.5}" font-weight="700" fill="${CAD_COLORS.plane}">${escXml(formatEdgeBandLabel(p))}</text>
      `;
    })
    .join("");

  const hwItems = ctx.bom.hardwareList.slice(0, 12);
  const hwRowH = 18.5;
  const hwRows = hwItems
    .map((h, i) => {
      const y = tblY + 20 + i * hwRowH;
      return `
        <rect x="${rightX}" y="${y}" width="${rightW}" height="${hwRowH}" fill="${i % 2 ? "#F8FAFC" : "#FFFFFF"}" stroke="#CBD5E1" stroke-width="0.6" />
        <text x="${rightX + 8}" y="${y + 13}" font-family="Segoe UI, sans-serif" font-size="10" font-weight="600" fill="${CAD_COLORS.ink}">${escXml(h.name.slice(0, 34))}</text>
        <text x="${rightX + rightW - 8}" y="${y + 13}" text-anchor="end" font-family="ui-monospace, monospace" font-size="10" font-weight="800" fill="${CAD_COLORS.ink}">${h.quantity} ${escXml(h.unit)}</text>
      `;
    })
    .join("");

  const hwSvg = `
    <text x="${rightX}" y="${area.y + 16}" font-family="Segoe UI, sans-serif" font-size="11.5" font-weight="800" fill="${CAD_COLORS.ink}">HIRDAVAT &amp; AKSESUAR LİSTESİ</text>
    <rect x="${rightX}" y="${tblY}" width="${rightW}" height="20" fill="#E2E8F0" stroke="${CAD_COLORS.ink}" stroke-width="0.9" />
    <text x="${rightX + 8}" y="${tblY + 14}" font-size="10" font-weight="800" fill="${CAD_COLORS.ink}">DONANIM</text>
    <text x="${rightX + rightW - 8}" y="${tblY + 14}" text-anchor="end" font-size="10" font-weight="800" fill="${CAD_COLORS.ink}">MİKTAR</text>
    ${hwRows}
  `;

  const diagY = tblY + 20 + Math.max(hwItems.length, 6) * hwRowH + 24;
  const doorSample = modPieces.find(
    (p) => p.componentRole === "door_left" || p.componentRole === "door_right" || p.componentRole === "door_sliding"
  );
  const shelfSample = modPieces.find((p) => p.componentRole === "shelf");
  const bodyMat = getMaterialName(ctx.project, mod.carcass.bodyMaterialId);

  const diagSvg = `
    <text x="${rightX}" y="${diagY}" font-family="Segoe UI, sans-serif" font-size="11" font-weight="800" fill="${CAD_COLORS.ink}">SUYOLU (GRAIN) &amp; KENAR BANTLAMA ŞEMASI</text>
    <line x1="${rightX + 8}" y1="${diagY + 20}" x2="${rightX + 42}" y2="${diagY + 20}" stroke="${CAD_COLORS.ink}" stroke-width="1" />
    <polygon points="${rightX + 42},${diagY + 20} ${rightX + 36},${diagY + 17} ${rightX + 36},${diagY + 23}" fill="${CAD_COLORS.ink}" />
    <text x="${rightX + 52}" y="${diagY + 23}" font-size="10" fill="${CAD_COLORS.subInk}">Doku (Suyolu) Yönü (${escXml(bodyMat.slice(0, 20))})</text>
    <line x1="${rightX + 8}" y1="${diagY + 38}" x2="${rightX + 42}" y2="${diagY + 38}" stroke="${CAD_COLORS.plane}" stroke-width="3" />
    <text x="${rightX + 52}" y="${diagY + 41}" font-size="10" fill="${CAD_COLORS.subInk}">PVC Kenar Bandı Uygulanacak Kenar (${mod.carcass.edgeBandThickness || 1} mm)</text>
    ${
      doorSample
        ? `<rect x="${rightX + 20}" y="${diagY + 58}" width="74" height="120" fill="#FFFFFF" stroke="${CAD_COLORS.plane}" stroke-width="3" />
           <line x1="${rightX + 57}" y1="${diagY + 80}" x2="${rightX + 57}" y2="${diagY + 156}" stroke="${CAD_COLORS.ink}" stroke-width="1.2" />
           <polygon points="${rightX + 57},${diagY + 76} ${rightX + 54},${diagY + 84} ${rightX + 60},${diagY + 84}" fill="${CAD_COLORS.ink}" />
           <text x="${rightX + 57}" y="${diagY + 194}" text-anchor="middle" font-size="10" font-weight="700" fill="${CAD_COLORS.ink}">Kapak (4 Kenar PVC)</text>`
        : ""
    }
    ${
      shelfSample
        ? `<rect x="${rightX + 150}" y="${diagY + 76}" width="110" height="72" fill="#FFFFFF" stroke="${CAD_COLORS.ink}" stroke-width="0.9" stroke-dasharray="3 2" />
           <line x1="${rightX + 150}" y1="${diagY + 148}" x2="${rightX + 260}" y2="${diagY + 148}" stroke="${CAD_COLORS.plane}" stroke-width="3.2" />
           <line x1="${rightX + 170}" y1="${diagY + 112}" x2="${rightX + 240}" y2="${diagY + 112}" stroke="${CAD_COLORS.ink}" stroke-width="1.2" />
           <text x="${rightX + 205}" y="${diagY + 170}" text-anchor="middle" font-size="10" font-weight="700" fill="${CAD_COLORS.ink}">Raf / Dikme (Ön PVC)</text>`
        : ""
    }
  `;

  return cutHeader + cutRows + hwSvg + diagSvg;
}
