"use client";

import React, { useState, useMemo, useRef } from "react";
import type { DesignProject, ModuleInstance } from "@birim/core";
import type { ManufacturingBOM } from "@birim/manufacturing";
import { BirimLogo } from "../../design-system";
import { startZeroLagModalDrag } from "../../design-system/zeroLagDrag";
import { Printer, Download, CheckCircle2, X, Layers, Wrench } from "lucide-react";

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
  kind?: "carcass" | "back" | "plinth" | "shelf" | "drawer" | "door" | "rail";
  hingeSide?: "left" | "right" | "none";
  handlePos?: "left" | "right" | "bottom-center" | "none";
  hasSys32?: boolean;
}

function projectIsoPoint(x: number, y: number, z: number): { u: number; v: number } {
  return {
    u: x - z * 0.42,
    v: -y + z * 0.24,
  };
}

function computeModuleBayRanges(mod: ModuleInstance): Array<{ x0: number; x1: number; width: number }> {
  const W = mod.dimensions.width;
  const T = mod.carcass.panelThickness || 18;
  const bayCount = Math.max(1, mod.bays.length);
  const innerW = Math.max(100, W - 2 * T - Math.max(0, bayCount - 1) * T);

  let fixedSum = 0;
  let flexWeightSum = 0;
  const rawWidths = mod.bays.map((b) => {
    if (typeof b.customWidth === "number" && b.customWidth > 0) {
      fixedSum += b.customWidth;
      return b.customWidth;
    }
    const w = typeof b.widthRatio === "number" && b.widthRatio > 0 ? b.widthRatio : 1 / bayCount;
    flexWeightSum += w;
    return -w;
  });

  const remainingW = Math.max(60, innerW - fixedSum);
  const widths = rawWidths.map((rw) =>
    rw > 0 ? rw : (Math.abs(rw) / Math.max(0.001, flexWeightSum)) * remainingW
  );

  const ranges: Array<{ x0: number; x1: number; width: number }> = [];
  let cursorX = T;
  for (let i = 0; i < mod.bays.length; i++) {
    const bw = widths[i] ?? innerW / bayCount;
    ranges.push({ x0: cursorX, x1: cursorX + bw, width: bw });
    cursorX += bw + T;
  }
  return ranges;
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
  const plinthH = isWallCab ? 0 : mod.carcass.plinthHeight ?? 80;

  const explodeX = Math.max(460, Math.round(W * 0.36));
  const explodeY = Math.max(200, Math.round(H * 0.14));
  const explodeZ = Math.max(320, Math.round(D * 0.72));
  const explodeDrawerZ = Math.max(360, Math.round(D * 0.80));
  const explodeDoorZ = Math.max(660, Math.round(D * 1.38));

  const bayRanges = computeModuleBayRanges(mod);
  const boxes: IsoBoxSpec[] = [];

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

      // Drawer carcass box
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

      // Drawer front panel
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
        const isDouble =
          door.type === "double" ||
          door.doorSystemId === "hinged_double" ||
          door.type === "sliding";
        if (isDouble) {
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
            hingeSide: "left",
            handlePos: "right",
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
            hingeSide: "right",
            handlePos: "left",
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
  const [activeStep, setActiveStep] = useState<number>(0); // 0 = All Steps Overview, 1..6 = Specific Step
  const svgRef = useRef<SVGSVGElement | null>(null);

  const mainModules = useMemo(
    () => project.modules.filter((m) => m.category !== "complementary"),
    [project.modules]
  );

  const mod = mainModules[Math.min(selectedModIdx, Math.max(0, mainModules.length - 1))] || project.modules[0];

  const assemblyData = useMemo(() => {
    if (!mod) return null;
    const W = mod.dimensions.width;
    const H = mod.dimensions.height;
    const D = mod.dimensions.depth;
    const T = mod.carcass.panelThickness || 18;
    const plinthH = mod.carcass.plinthHeight ?? 80;
    const bayCount = Math.max(1, mod.bays.length);
    const dividerCount = Math.max(0, bayCount - 1);
    const shelfCount = mod.bays.reduce((s, b) => s + (b.shelves?.length || 0), 0);
    const drawerCount = mod.bays.reduce((s, b) => s + (b.drawers?.length || 0), 0);
    const railCount = mod.bays.reduce((s, b) => s + (b.hangingRails?.length || 0), 0);
    const hasDoors =
      !mod.isOpenFront &&
      mod.bays.some((b) => b.door && b.door.type !== "open" && b.door.doorSystemId !== "open");
    const doorLeavesCount = mod.bays.reduce((acc, b) => {
      if (mod.isOpenFront || !b.door || b.door.type === "open" || b.door.doorSystemId === "open") return acc;
      return acc + (b.door.type === "double" || b.door.doorSystemId === "hinged_double" || b.door.type === "sliding" ? 2 : 1);
    }, 0);
    const isWallCab = mod.category === "kitchen_wall" || (mod.position.y || 0) >= 1100;
    const topStretcherMode = mod.category === "kitchen_base" && mod.carcass.topConstruction === "stretcher_90mm";
    const jointTopology = mod.carcass.carcassJoineryTopology || "type_a_top_bottom_between_sides";
    const isMiter45 = jointTopology === "type_c_miter_45_clamex";

    const modCutPieces = (bom?.cutList || []).filter((p) => p.moduleId === mod.id);
    const totalHoles = modCutPieces.reduce((acc, p) => acc + (p.holes?.length || 0), 0);

    const joineryLabel = isMiter45
      ? "Tip C — 45° Gönye Birleşim (Lamello Clamex P-14)"
      : topStretcherMode
      ? "Tip D — 90mm Ön/Arka Kayıtlı Alt Dolap Karkası"
      : jointTopology === "type_b_sides_on_top_bottom"
      ? "Tip B — Alt/Üst Tabla Üzerine Oturan Dikme (Minifiks + Ø8 Kavela)"
      : "Tip A — Yan Dikmeler Arası Alt/Üst Tabla (Ø15 Minifiks + Ø8×35 Kavela)";

    const steps = [
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
        title: hasDoors
          ? `${doorLeavesCount} Kanat Kapak, Ø35 mm Menteşe & Kulp (C-C) Montajı`
          : "İç Aksesuar & Raf Emniyet Kontrolü",
        partCodes: hasDoors ? ["⑩"] : ["⑧"],
        detail: hasDoors
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

    return {
      W,
      H,
      D,
      T,
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
  }, [mod, bom.cutList, mainModules.length]);

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
    const padX = 76;
    const padY = 48;
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
      const p001 = toSvg(b.x0, b.y0, b.z1);
      const p101 = toSvg(b.x1, b.y0, b.z1);
      const p111 = toSvg(b.x1, b.y1, b.z1);
      const p011 = toSvg(b.x0, b.y1, b.z1);

      const p100 = toSvg(b.x1, b.y0, b.z0);
      const p110 = toSvg(b.x1, b.y1, b.z0);
      const p010 = toSvg(b.x0, b.y1, b.z0);

      const frontPoly = ptsStr([p001, p101, p111, p011]);
      const rightPoly = ptsStr([p101, p100, p110, p111]);
      const topPoly = ptsStr([p011, p111, p110, p010]);

      // Optional handle & hinge cups on doors / drawer fronts
      let handleLine: { x1: number; y1: number; x2: number; y2: number } | null = null;
      const hingeCups: Array<{ cx: number; cy: number }> = [];

      if (b.handlePos === "bottom-center") {
        const hx0 = b.x0 + (b.x1 - b.x0) * 0.36;
        const hx1 = b.x0 + (b.x1 - b.x0) * 0.64;
        const hy = b.y0 + (b.y1 - b.y0) * 0.55;
        const hStart = toSvg(hx0, hy, b.z1 + 2);
        const hEnd = toSvg(hx1, hy, b.z1 + 2);
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
        for (let i = 0; i < 6; i++) {
          const sy = b.y0 + 120 + ((b.y1 - b.y0 - 240) * i) / 5;
          const sp = toSvg(b.x1 + 1, sy, b.z1 - 45);
          sys32Pts.push({ cx: sp.x, cy: sp.y });
        }
        const g1 = toSvg(b.x1 + 1, b.y0 + 10, b.z0 + 20);
        const g2 = toSvg(b.x1 + 1, b.y1 - 10, b.z0 + 20);
        grooveLine = { x1: g1.x, y1: g1.y, x2: g2.x, y2: g2.y };
      }

      return {
        ...b,
        frontPoly,
        rightPoly,
        topPoly,
        handleLine,
        hingeCups,
        sys32Pts,
        grooveLine,
      };
    });

    const W = mod.dimensions.width;
    const H = mod.dimensions.height;
    const D = mod.dimensions.depth;
    const plinthH = assemblyData.isWallCab ? 0 : assemblyData.plinthH;
    const midY = (plinthH + H) / 2;

    const arrows = [
      {
        code: "①",
        from: toSvg(-explodeX + 20, midY, D / 2),
        to: toSvg(0, midY, D / 2),
      },
      {
        code: "②",
        from: toSvg(W + explodeX - 20, midY, D / 2),
        to: toSvg(W, midY, D / 2),
      },
      {
        code: "④",
        from: toSvg(W / 2, H + explodeY - 20, D / 2),
        to: toSvg(W / 2, H, D / 2),
      },
      {
        code: "⑥",
        from: toSvg(W / 2, midY, -explodeZ + 20),
        to: toSvg(W / 2, midY, 0),
      },
      ...(assemblyData.hasDoors
        ? [
            {
              code: "⑩",
              from: toSvg(W * 0.72, midY, D + explodeDoorZ - 25),
              to: toSvg(W * 0.72, midY, D + 10),
            },
          ]
        : []),
      ...(assemblyData.drawerCount > 0
        ? [
            {
              code: "⑨",
              from: toSvg(W * 0.65, plinthH + 180, D + explodeDrawerZ - 20),
              to: toSvg(W * 0.65, plinthH + 180, D + 10),
            },
          ]
        : []),
      ...(!assemblyData.isWallCab && plinthH > 0
        ? [
            {
              code: "⑦",
              from: toSvg(W / 2, plinthH - explodeY + 15, D / 2),
              to: toSvg(W / 2, plinthH, D / 2),
            },
          ]
        : []),
    ];

    const callouts: Array<{ code: string; num: string; label: string; x: number; y: number }> = [
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
        ? [{ code: "⑩", num: "10", label: `Kapak (${assemblyData.doorLeavesCount}x)`, ...toSvg(W * 0.78, H * 0.45, D + explodeDoorZ + 90) }]
        : []),
    ];

    return { renderedBoxes, arrows, callouts };
  }, [mod, assemblyData]);

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
      <h3 style="margin:12px 0 8px;font-size:15px;">Montaj Adımları</h3>
      ${stepRows}
      <h3 style="margin:16px 0 8px;font-size:15px;">Hırdavat &amp; Bağlantı Elemanı Paketi</h3>
      <table><thead><tr><th>SKU</th><th>Bağlantı / Donanım Adı</th><th style="text-align:right">Miktar</th></tr></thead><tbody>${hwRows}</tbody></table>
      <script>window.onload=()=>setTimeout(()=>window.print(),250);</script></body></html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      data-testid="assembly-diagram-modal"
      onClick={onClose}
      className="fixed inset-0 z-[158] flex items-center justify-center bg-slate-950/55 backdrop-blur-xs p-3 sm:p-5"
    >
      <div
        data-draggable-shell="assembly-diagram-modal"
        onClick={(e) => e.stopPropagation()}
        className="relative birim-ice-modal rounded-[28px] max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden text-[#141413]"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Kapat"
          title="Kapat"
          className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-white/95 border border-slate-300 shadow-sm flex items-center justify-center text-slate-700 hover:text-slate-950 hover:bg-white cursor-pointer"
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
              <h2 className="text-sm font-bold text-[#141413] truncate">
                Patlatılmış İzometrik Montaj Şeması &amp; Kurulum Kılavuzu
              </h2>
              <p className="text-[11px] text-[#475569] truncate">
                {assemblyData.joineryLabel} • {assemblyData.modCutPieces.length} Kesim Parçası • {assemblyData.totalHoles} CNC Delik İşlemi
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {mainModules.length > 1 && (
              <select
                value={selectedModIdx}
                onChange={(e) => setSelectedModIdx(Number(e.target.value))}
                className="max-w-[160px] px-2.5 py-1.5 rounded-xl bg-white/80 border border-slate-300 text-xs font-bold text-[#141413] truncate"
              >
                {mainModules.map((m, idx) => (
                  <option key={m.id} value={idx}>
                    #{idx + 1} {m.name} ({m.dimensions.width}mm)
                  </option>
                ))}
              </select>
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

        {/* Body: Left Exploded Isometric CAD Diagram + Right Step-by-Step Assembly & Hardware Bag */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 grid grid-cols-1 lg:grid-cols-12 gap-4 text-xs">
          {/* Left 7 cols: Interactive Exploded Isometric SVG Assembly Diagram */}
          <div className="lg:col-span-7 flex flex-col gap-3">
            <div className="p-3 rounded-2xl bg-white/80 border border-white/90 shadow-inner flex flex-col items-center">
              <div className="w-full flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200/80 mb-2">
                <span className="font-bold text-[#141413] flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-sky-700" />
                  <span>İzometrik Patlatılmış Parça &amp; Bağlantı Diyagramı ({assemblyData.W}×{assemblyData.H}×{assemblyData.D} mm)</span>
                </span>
                <button
                  type="button"
                  onClick={() => setActiveStep(0)}
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer ${
                    activeStep === 0 ? "bg-[#141413] text-white" : "bg-slate-200/80 text-slate-700"
                  }`}
                >
                  Tüm Parçaları Göster
                </button>
              </div>

              <svg
                ref={svgRef}
                viewBox="0 0 680 460"
                className="w-full h-auto max-h-[400px] select-none"
              >
                <defs>
                  <marker id="asm-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#0284c7" />
                  </marker>
                </defs>

                {/* Subtle Technical Grid Backdrop */}
                <rect x="8" y="8" width="664" height="444" rx="16" fill="#F8FAFC" stroke="#E2E8F0" />

                {/* Dynamic 3D-to-2D Isometric Exploded Parts (Painter's Order) */}
                {isoScene.renderedBoxes.map((box) => {
                  const active = isHighlighted(box.code);
                  const baseOpacity = box.opacity ?? 1;
                  return (
                    <g key={box.id} opacity={active ? baseOpacity : 0.16}>
                      <polygon
                        points={box.topPoly}
                        fill={box.topFill}
                        stroke={box.stroke}
                        strokeWidth={box.strokeWidth ?? 1.4}
                        strokeLinejoin="round"
                      />
                      <polygon
                        points={box.rightPoly}
                        fill={box.sideFill}
                        stroke={box.stroke}
                        strokeWidth={box.strokeWidth ?? 1.4}
                        strokeLinejoin="round"
                      />
                      <polygon
                        points={box.frontPoly}
                        fill={box.frontFill}
                        stroke={box.stroke}
                        strokeWidth={box.strokeWidth ?? 1.5}
                        strokeLinejoin="round"
                      />
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
                    </g>
                  );
                })}

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
                  const clampedX = Math.max(24, Math.min(585, c.x));
                  const clampedY = Math.max(24, Math.min(436, c.y));
                  return (
                    <g key={`callout-${c.num}`} opacity={isHighlighted(c.code) ? 1 : 0.2}>
                      <circle cx={clampedX} cy={clampedY} r="10.5" fill="#0f172a" />
                      <text
                        x={clampedX}
                        y={clampedY + 3.5}
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize="10"
                        fontWeight="800"
                      >
                        {c.num}
                      </text>
                      <text
                        x={clampedX + 14}
                        y={clampedY + 3.5}
                        fill="#0f172a"
                        fontSize="9.5"
                        fontWeight="700"
                      >
                        {c.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Hardware & Fastener Bag Table */}
            <div className="p-3.5 rounded-2xl birim-ice-card space-y-2">
              <div className="font-bold text-[#141413] flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-slate-700" />
                <span>Montaj Hırdavat &amp; Donanım Paketi Kontrol Listesi</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-1">
                {(bom?.hardwareList || []).map((hw) => (
                  <div
                    key={hw.sku}
                    className="px-2.5 py-1.5 rounded-xl bg-white/70 border border-white/85 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-[#141413] truncate text-[11px]">{hw.name}</div>
                      <div className="font-mono text-[9.5px] text-slate-500">{hw.sku}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded-lg bg-[#141413] text-white font-mono font-bold text-[10.5px] shrink-0">
                      {hw.quantity} {hw.unit}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right 5 cols: Interactive 6-Step Sequence */}
          <div className="lg:col-span-5 space-y-2.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600 px-1">
              Adım Adım Kurulum Sırası (Diyagramda Vurgulamak İçin Adıma Tıklayın)
            </div>
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
                      : "bg-white/72 hover:bg-white/90 text-[#141413] border-white/85"
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
                      selected ? "text-slate-200" : "text-slate-600"
                    }`}
                  >
                    {st.detail}
                  </p>
                </button>
              );
            })}

            <div className="p-3 rounded-2xl bg-emerald-950/90 text-emerald-100 text-[11px] flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                Tüm gövde kavela/minifiks eksenleri, 8 mm arkalık ve çekmece taban kanalları (LW − 30 mm) ile Ø35 mm menteşe tas koordinatları CNC kesim paketiyle birebir senkronizedir.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
