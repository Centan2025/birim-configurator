"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Upload,
  Download,
  Undo2,
  Trash2,
  MousePointer,
  PenTool,
  X,
  Ruler,
  Layers,
  Plus,
  Scissors,
  ZoomIn,
  ZoomOut,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import type { DoorCrossSectionProfile } from "@birim/core";

export interface CadPtMm {
  x: number; // 0..80 mm inward from outer door edge
  y: number; // 0..thicknessMm (0 = back face, thicknessMm = front face)
}

export interface CustomDoorProfilePreset {
  id: string;
  label: string;
  target?: "door" | "drawer";
  baseProfile: DoorCrossSectionProfile;
  isGlass?: boolean;
  svgPaths?: string[];
  customCadPolygon?: Array<{ x: number; y: number }>;
  thicknessMm?: number;
}

interface CustomDoorSketchEditorProps {
  defaultTarget?: "door" | "drawer";
  onSave: (preset: CustomDoorProfilePreset) => void;
  onCancel: () => void;
}

type CadMode = "edit" | "polyline";

const MAX_PROF_W_MM = 80;
const PAD_L = 34;
const PAD_R = 20;
const PAD_T = 26;
const PAD_B = 28;
const VB_W = 460;
const VB_H = 260;

const SECTION_STARTERS: Record<
  "flat" | "bevel_45" | "j_pull" | "shaker" | "cove" | "glass_rabbet",
  {
    label: string;
    baseProfile: DoorCrossSectionProfile;
    isGlass: boolean;
    pts: (t: number) => CadPtMm[];
  }
> = {
  flat: {
    label: "Düz",
    baseProfile: "flat_slab",
    isGlass: false,
    pts: (t) => [
      { x: 0, y: t },
      { x: 60, y: t },
    ],
  },
  bevel_45: {
    label: "45° Pah",
    baseProfile: "custom_cad_profile",
    isGlass: false,
    pts: (t) => [
      { x: 0, y: Math.max(4, t - 10) },
      { x: 10, y: t },
      { x: 60, y: t },
    ],
  },
  j_pull: {
    label: "J-Kulp",
    baseProfile: "custom_cad_profile",
    isGlass: false,
    pts: (t) => [
      { x: 0, y: Math.max(5, t - 11) },
      { x: 16, y: Math.max(5, t - 11) },
      { x: 24, y: t },
      { x: 60, y: t },
    ],
  },
  shaker: {
    label: "Shaker",
    baseProfile: "custom_cad_profile",
    isGlass: false,
    pts: (t) => [
      { x: 0, y: t },
      { x: 45, y: t },
      { x: 48, y: Math.max(6, t - 6) },
      { x: 75, y: Math.max(6, t - 6) },
    ],
  },
  cove: {
    label: "Kavisli",
    baseProfile: "custom_cad_profile",
    isGlass: false,
    pts: (t) => [
      { x: 0, y: Math.max(6, t - 1) },
      { x: 10, y: t },
      { x: 22, y: Math.max(6, t - 5) },
      { x: 38, y: Math.max(5, t - 9) },
      { x: 54, y: Math.max(5, t - 10) },
      { x: 70, y: Math.max(5, t - 10) },
    ],
  },
  glass_rabbet: {
    label: "Cam Lamba",
    baseProfile: "center_glass_frame",
    isGlass: true,
    pts: (t) => [
      { x: 0, y: t },
      { x: 44, y: t },
      { x: 44, y: Math.max(4, t - 9) },
      { x: 65, y: Math.max(4, t - 9) },
    ],
  },
};

function appendBulgeArc(
  out: Array<[number, number]>,
  p1: [number, number],
  p2: [number, number],
  bulge: number
) {
  if (Math.abs(bulge) < 1e-4) {
    out.push(p2);
    return;
  }
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  const chord = Math.hypot(dx, dy);
  if (chord < 1e-4) {
    out.push(p2);
    return;
  }
  const theta = 4 * Math.atan(bulge);
  const r = chord / (2 * Math.sin(Math.abs(theta) / 2));
  const mx = (p1[0] + p2[0]) / 2;
  const my = (p1[1] + p2[1]) / 2;
  const h = Math.sqrt(Math.max(0, r * r - (chord * chord) / 4)) * (bulge > 0 ? 1 : -1);
  const nx = -dy / chord;
  const ny = dx / chord;
  const cx = mx + h * nx;
  const cy = my + h * ny;
  const a1 = Math.atan2(p1[1] - cy, p1[0] - cx);
  const steps = 6;
  for (let s = 1; s <= steps; s++) {
    const ang = a1 + (theta * s) / steps;
    out.push([cx + r * Math.cos(ang), cy + r * Math.sin(ang)]);
  }
}

function parseDxfToPointsMm(text: string, thicknessMm: number): CadPtMm[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  let unitScale = 1;
  for (let k = 0; k < lines.length - 3; k++) {
    if (lines[k] === "$INSUNITS" && lines[k + 2] === "70") {
      const u = Number(lines[k + 3]);
      if (u === 5) unitScale = 10; // cm -> mm
      else if (u === 6) unitScale = 1000; // m -> mm
    }
  }
  const rawPts: Array<[number, number]> = [];
  let i = 0;
  while (i < lines.length - 1) {
    if (lines[i] === "0" && lines[i + 1] === "LWPOLYLINE") {
      const verts: Array<{ x: number; y: number; bulge: number }> = [];
      let curX: number | null = null;
      let curY: number | null = null;
      i += 2;
      while (i < lines.length - 1 && lines[i] !== "0") {
        const code = lines[i];
        const val = Number(lines[i + 1]);
        if (code === "10") {
          if (curX !== null && curY !== null) verts.push({ x: curX, y: curY, bulge: 0 });
          curX = val * unitScale;
          curY = null;
        } else if (code === "20" && curX !== null) {
          curY = val * unitScale;
        } else if (code === "42" && verts.length > 0) {
          verts[verts.length - 1].bulge = Number(lines[i + 1]) || 0;
        } else if (code === "42" && curX !== null && curY !== null) {
          verts.push({ x: curX, y: curY, bulge: Number(lines[i + 1]) || 0 });
          curX = null;
          curY = null;
        }
        i += 2;
      }
      if (curX !== null && curY !== null) verts.push({ x: curX, y: curY, bulge: 0 });
      if (verts.length >= 2) {
        rawPts.push([verts[0].x, verts[0].y]);
        for (let v = 0; v < verts.length - 1; v++) {
          appendBulgeArc(
            rawPts,
            [verts[v].x, verts[v].y],
            [verts[v + 1].x, verts[v + 1].y],
            verts[v].bulge
          );
        }
        break;
      }
      continue;
    }
    if (lines[i] === "0" && lines[i + 1] === "ARC") {
      let cx = 0, cy = 0, r = 10, a1 = 0, a2 = 90;
      i += 2;
      while (i < lines.length - 1 && lines[i] !== "0") {
        const code = lines[i];
        const val = Number(lines[i + 1]);
        if (code === "10") cx = val * unitScale;
        else if (code === "20") cy = val * unitScale;
        else if (code === "40") r = val * unitScale;
        else if (code === "50") a1 = val;
        else if (code === "51") a2 = val;
        i += 2;
      }
      const sweep = ((a2 - a1 + 360) % 360) || 360;
      for (let s = 0; s <= 6; s++) {
        const rad = ((a1 + (sweep * s) / 6) * Math.PI) / 180;
        rawPts.push([cx + r * Math.cos(rad), cy + r * Math.sin(rad)]);
      }
      continue;
    }
    if (lines[i] === "0" && lines[i + 1] === "LINE") {
      let x1 = 0, y1 = 0, x2 = 0, y2 = 0;
      i += 2;
      while (i < lines.length - 1 && lines[i] !== "0") {
        const code = lines[i];
        const val = Number(lines[i + 1]) * unitScale;
        if (code === "10") x1 = val;
        else if (code === "20") y1 = val;
        else if (code === "11") x2 = val;
        else if (code === "21") y2 = val;
        i += 2;
      }
      rawPts.push([x1, y1], [x2, y2]);
      continue;
    }
    i += 1;
  }
  if (rawPts.length < 2) return [];
  const minX = Math.min(...rawPts.map((p) => p[0]));
  const maxX = Math.max(...rawPts.map((p) => p[0]));
  const minY = Math.min(...rawPts.map((p) => p[1]));
  const maxY = Math.max(...rawPts.map((p) => p[1]));
  const spanX = Math.max(1e-3, maxX - minX);
  const spanY = Math.max(1e-3, maxY - minY);
  const targetW = Math.min(MAX_PROF_W_MM, Math.max(20, spanX));
  return rawPts.slice(0, 36).map(([x, y]) => ({
    x: Number((((x - minX) / spanX) * targetW).toFixed(1)),
    y: Number((((y - minY) / spanY) * thicknessMm).toFixed(1)),
  }));
}

function parseSvgToPointsMm(text: string, thicknessMm: number): CadPtMm[] {
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  const pts: Array<[number, number]> = [];
  doc.querySelectorAll("polyline,polygon").forEach((el) => {
    const nums = (el.getAttribute("points") || "").trim().split(/[\s,]+/).map(Number);
    for (let k = 0; k + 1 < nums.length; k += 2) pts.push([nums[k], nums[k + 1]]);
  });
  doc.querySelectorAll("line").forEach((el) => {
    pts.push(
      [Number(el.getAttribute("x1") || 0), Number(el.getAttribute("y1") || 0)],
      [Number(el.getAttribute("x2") || 0), Number(el.getAttribute("y2") || 0)]
    );
  });
  if (pts.length < 2) return [];
  const minX = Math.min(...pts.map((p) => p[0]));
  const maxX = Math.max(...pts.map((p) => p[0]));
  const minY = Math.min(...pts.map((p) => p[1]));
  const maxY = Math.max(...pts.map((p) => p[1]));
  const spanX = Math.max(1e-3, maxX - minX);
  const spanY = Math.max(1e-3, maxY - minY);
  return pts.slice(0, 24).map(([x, y]) => ({
    x: Number((((x - minX) / spanX) * 65).toFixed(1)),
    y: Number((((maxY - y) / spanY) * thicknessMm).toFixed(1)),
  }));
}

export const CustomDoorSketchEditor: React.FC<CustomDoorSketchEditorProps> = ({
  defaultTarget = "door",
  onSave,
  onCancel,
}) => {
  const [name, setName] = useState("");
  const [target, setTarget] = useState<"door" | "drawer">(defaultTarget);
  const [thicknessMm, setThicknessMm] = useState(18);
  const [snapStepMm, setSnapStepMm] = useState<0.5 | 1>(1);
  const [mode, setMode] = useState<CadMode>("edit");
  const [baseProfile, setBaseProfile] = useState<DoorCrossSectionProfile>("custom_cad_profile");
  const [isGlass, setIsGlass] = useState(false);

  const [pointsMm, setPointsMm] = useState<CadPtMm[]>(() => SECTION_STARTERS.shaker.pts(18));
  const [history, setHistory] = useState<CadPtMm[][]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(1);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [polyDraft, setPolyDraft] = useState<CadPtMm[]>([]);
  const [hoverPt, setHoverPt] = useState<CadPtMm | null>(null);
  const [chamferMm, setChamferMm] = useState(4);
  const [filletMm, setFilletMm] = useState(3);
  const [zoom, setZoom] = useState<1 | 1.5 | 2>(1);
  const [shiftHeld, setShiftHeld] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      setShiftHeld(e.shiftKey);
      if (e.key === "Escape") {
        if (polyDraft.length > 0) setPolyDraft([]);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, [polyDraft.length]);

  const pushHistory = (prev: CadPtMm[]) => setHistory((h) => [...h.slice(-15), prev]);

  const drawW = VB_W - PAD_L - PAD_R;
  const drawH = VB_H - PAD_T - PAD_B;
  const toSvgX = (mmX: number) => PAD_L + (mmX / MAX_PROF_W_MM) * drawW;
  const toSvgY = (mmY: number) => PAD_T + ((thicknessMm - mmY) / thicknessMm) * drawH;

  const snapVal = (v: number, min: number, max: number) =>
    Math.max(min, Math.min(max, Math.round(v / snapStepMm) * snapStepMm));

  const getMmCoords = (e: React.MouseEvent<SVGSVGElement>, anchor?: CadPtMm): CadPtMm => {
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * VB_W;
    const sy = ((e.clientY - rect.top) / rect.height) * VB_H;
    let mx = snapVal(((sx - PAD_L) / drawW) * MAX_PROF_W_MM, 0, MAX_PROF_W_MM);
    let my = snapVal(thicknessMm - ((sy - PAD_T) / drawH) * thicknessMm, 2, thicknessMm);
    if ((shiftHeld || e.shiftKey) && anchor) {
      const dx = Math.abs(mx - anchor.x);
      const dy = Math.abs(my - anchor.y);
      if (dx > dy * 2) my = anchor.y;
      else if (dy > dx * 2) mx = anchor.x;
      else {
        const d = Math.min(dx, dy);
        mx = snapVal(anchor.x + Math.sign(mx - anchor.x) * d, 0, MAX_PROF_W_MM);
        my = snapVal(anchor.y + Math.sign(my - anchor.y) * d, 2, thicknessMm);
      }
    }
    return { x: Number(mx.toFixed(1)), y: Number(my.toFixed(1)) };
  };

  const applyChamferToSelected = () => {
    if (selectedIdx === null || selectedIdx <= 0 || selectedIdx >= pointsMm.length - 1) return;
    const pPrev = pointsMm[selectedIdx - 1];
    const pCur = pointsMm[selectedIdx];
    const pNext = pointsMm[selectedIdx + 1];
    const d1 = Math.hypot(pCur.x - pPrev.x, pCur.y - pPrev.y);
    const d2 = Math.hypot(pNext.x - pCur.x, pNext.y - pCur.y);
    const c = Math.min(chamferMm, d1 * 0.45, d2 * 0.45);
    if (c < 0.5) return;
    const a: CadPtMm = {
      x: Number((pCur.x - ((pCur.x - pPrev.x) / d1) * c).toFixed(1)),
      y: Number((pCur.y - ((pCur.y - pPrev.y) / d1) * c).toFixed(1)),
    };
    const b: CadPtMm = {
      x: Number((pCur.x + ((pNext.x - pCur.x) / d2) * c).toFixed(1)),
      y: Number((pCur.y + ((pNext.y - pCur.y) / d2) * c).toFixed(1)),
    };
    pushHistory(pointsMm);
    const next = [...pointsMm.slice(0, selectedIdx), a, b, ...pointsMm.slice(selectedIdx + 1)];
    setPointsMm(next);
    setSelectedIdx(selectedIdx);
  };

  const applyFilletToSelected = () => {
    if (selectedIdx === null || selectedIdx <= 0 || selectedIdx >= pointsMm.length - 1) return;
    const pPrev = pointsMm[selectedIdx - 1];
    const pCur = pointsMm[selectedIdx];
    const pNext = pointsMm[selectedIdx + 1];
    const d1 = Math.hypot(pCur.x - pPrev.x, pCur.y - pPrev.y);
    const d2 = Math.hypot(pNext.x - pCur.x, pNext.y - pCur.y);
    const r = Math.min(filletMm, d1 * 0.45, d2 * 0.45);
    if (r < 0.5) return;
    const a: CadPtMm = {
      x: pCur.x - ((pCur.x - pPrev.x) / d1) * r,
      y: pCur.y - ((pCur.y - pPrev.y) / d1) * r,
    };
    const b: CadPtMm = {
      x: pCur.x + ((pNext.x - pCur.x) / d2) * r,
      y: pCur.y + ((pNext.y - pCur.y) / d2) * r,
    };
    const arcPts: CadPtMm[] = [];
    const steps = 4;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const mt = 1 - t;
      arcPts.push({
        x: Number((mt * mt * a.x + 2 * mt * t * pCur.x + t * t * b.x).toFixed(1)),
        y: Number((mt * mt * a.y + 2 * mt * t * pCur.y + t * t * b.y).toFixed(1)),
      });
    }
    pushHistory(pointsMm);
    const next = [...pointsMm.slice(0, selectedIdx), ...arcPts, ...pointsMm.slice(selectedIdx + 1)];
    setPointsMm(next);
    setSelectedIdx(selectedIdx + 2);
  };

  const exportCrossSectionDxf = () => {
    const closed = [
      ...pointsMm,
      { x: pointsMm[pointsMm.length - 1]?.x ?? 60, y: 0 },
      { x: pointsMm[0]?.x ?? 0, y: 0 },
    ];
    const dxf = [
      "0", "SECTION", "2", "HEADER", "9", "$INSUNITS", "70", "4", "0", "ENDSEC",
      "0", "SECTION", "2", "ENTITIES",
      "0", "LWPOLYLINE", "8", "KESIT_PROFIL", "90", String(closed.length), "70", "1",
      ...closed.flatMap((p) => ["10", p.x.toFixed(2), "20", p.y.toFixed(2)]),
      "0", "ENDSEC", "0", "EOF",
    ].join("\n");
    const blob = new Blob([dxf], { type: "application/dxf;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(name.trim() || "kapak_kesit").replace(/\s+/g, "_")}.dxf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    const text = await file.text();
    const ext = file.name.toLowerCase();
    const parsed = ext.endsWith(".dxf")
      ? parseDxfToPointsMm(text, thicknessMm)
      : parseSvgToPointsMm(text, thicknessMm);
    if (parsed.length < 2) {
      setImportError("Geçerli kesit geometrisi bulunamadı (.dxf LINE/LWPOLYLINE veya .svg polyline/line).");
    } else {
      pushHistory(pointsMm);
      setPointsMm(parsed);
      setBaseProfile("custom_cad_profile");
      if (!name.trim()) setName(file.name.replace(/\.(svg|dxf)$/i, ""));
    }
    e.target.value = "";
  };

  // Closed polygon path for rendering the solid cross-section
  const closedSectionSvgD = useMemo(() => {
    if (pointsMm.length < 2) return "";
    const topStr = pointsMm
      .map((p, idx) => `${idx === 0 ? "M" : "L"} ${toSvgX(p.x).toFixed(1)} ${toSvgY(p.y).toFixed(1)}`)
      .join(" ");
    const lastX = pointsMm[pointsMm.length - 1].x;
    const firstX = pointsMm[0].x;
    return `${topStr} L ${toSvgX(lastX).toFixed(1)} ${toSvgY(0).toFixed(1)} L ${toSvgX(firstX).toFixed(1)} ${toSvgY(0).toFixed(1)} Z`;
  }, [pointsMm, thicknessMm]);

  // Normalized 0..1 polygon for 3D Extrude/Sweep in componentMesh.ts
  const normalizedPolygon = useMemo(() => {
    const maxX = Math.max(10, ...pointsMm.map((p) => p.x));
    return pointsMm.map((p) => ({
      x: Number(Math.max(0, Math.min(1, p.x / maxX)).toFixed(4)),
      y: Number(Math.max(0.05, Math.min(1, p.y / thicknessMm)).toFixed(4)),
    }));
  }, [pointsMm, thicknessMm]);

  // Compact icon SVG path for card thumbnail
  const iconSvgPaths = useMemo(() => {
    const maxX = Math.max(10, ...pointsMm.map((p) => p.x));
    const d = pointsMm
      .map((p, idx) => {
        const ix = (10 + (p.x / maxX) * 100).toFixed(1);
        const iy = (130 - (p.y / thicknessMm) * 90).toFixed(1);
        return `${idx === 0 ? "M" : "L"} ${ix} ${iy}`;
      })
      .join(" ");
    return [d];
  }, [pointsMm, thicknessMm]);

  const minWallMm = useMemo(
    () => Number(Math.min(...pointsMm.map((p) => p.y)).toFixed(1)),
    [pointsMm]
  );
  const maxDepthCutMm = useMemo(
    () => Number((thicknessMm - minWallMm).toFixed(1)),
    [thicknessMm, minWallMm]
  );
  const profileSpanMm = useMemo(
    () => Number(Math.max(...pointsMm.map((p) => p.x)).toFixed(1)),
    [pointsMm]
  );

  const selectedPt = selectedIdx !== null ? pointsMm[selectedIdx] : null;

  const modalContent = (
    <div className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-5xl rounded-3xl bg-[#FAF8F4] border border-[#DFD9CE] shadow-[0_28px_80px_rgba(20,20,19,0.3)] overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-white border-b border-[#E5DFD3] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-[#141413] text-white flex items-center justify-center">
              <Ruler className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#141413]">
                CAD Kapak & Klapa Kesit Editörü (1:1 mm)
              </h3>
              <p className="text-[11px] text-[#78716C]">
                Gerçek kesit poligonu 3B sahnede profil süpürme (sweep) ile işlenir • Shift: Dik/45° Kilit
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="w-8 h-8 rounded-full hover:bg-[#F5F2EA] flex items-center justify-center text-[#57534E] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Precision mm Cross-Section Canvas */}
          <div className="lg:col-span-8 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="inline-flex items-center gap-1 bg-white p-1 rounded-xl border border-[#DED8CC]">
                <button
                  type="button"
                  onClick={() => {
                    setMode("edit");
                    setPolyDraft([]);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                    mode === "edit" ? "bg-[#141413] text-white" : "text-[#57534E] hover:bg-[#F5F2EA]"
                  }`}
                >
                  <MousePointer className="w-3.5 h-3.5" />
                  <span>Nokta Düzenle</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("polyline");
                    setPolyDraft([]);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                    mode === "polyline" ? "bg-[#141413] text-white" : "text-[#57534E] hover:bg-[#F5F2EA]"
                  }`}
                >
                  <PenTool className="w-3.5 h-3.5" />
                  <span>Polyline Çiz</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  title="Yakınlaştır / Sıfırla"
                  onClick={() => setZoom((z) => (z === 1 ? 1.5 : z === 1.5 ? 2 : 1))}
                  className="h-8 px-2.5 rounded-xl bg-white border border-[#DED8CC] text-[11px] font-mono font-semibold inline-flex items-center gap-1 hover:bg-[#F5F2EA] cursor-pointer"
                >
                  {zoom > 1 ? <ZoomOut className="w-3.5 h-3.5" /> : <ZoomIn className="w-3.5 h-3.5" />}
                  <span>{zoom}x</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSnapStepMm((s) => (s === 1 ? 0.5 : 1))}
                  className="h-8 px-2.5 rounded-xl bg-white border border-[#DED8CC] text-[11px] font-mono font-semibold hover:bg-[#F5F2EA] cursor-pointer"
                >
                  Snap: {snapStepMm} mm
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const prev = history[history.length - 1];
                    if (prev) {
                      setHistory((h) => h.slice(0, -1));
                      setPointsMm(prev);
                    }
                  }}
                  disabled={history.length === 0}
                  className="h-8 px-2.5 rounded-xl bg-white border border-[#DED8CC] text-xs font-semibold inline-flex items-center gap-1 hover:bg-[#F5F2EA] disabled:opacity-35 cursor-pointer"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span>Geri</span>
                </button>
                <button
                  type="button"
                  title="Kesiti 1:1 mm .DXF olarak indir"
                  onClick={exportCrossSectionDxf}
                  className="h-8 px-2.5 rounded-xl bg-white border border-[#DED8CC] text-xs font-semibold inline-flex items-center gap-1 hover:bg-[#F5F2EA] cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>.DXF</span>
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".svg,.dxf"
                  onChange={handleFileImport}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="h-8 px-3 rounded-xl bg-[#141413] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Yükle</span>
                </button>
              </div>
            </div>

            <div className="rounded-2xl bg-white border border-[#DED8CC] p-3 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold text-[#57534E]">
                <span>KESİT GÖRÜNÜŞÜ (SOL: DIŞ KENAR 0 mm • ALT: ARKA YÜZEY 0 mm • ÜST: ÖN YÜZEY {thicknessMm} mm)</span>
                {hoverPt && (
                  <span className="font-mono text-[#141413]">
                    X: {hoverPt.x} mm • Y: {hoverPt.y} mm
                  </span>
                )}
              </div>

              <div className="overflow-auto rounded-xl border border-[#E5DFD3] bg-[#FCFBF8]">
                <svg
                  viewBox={`0 0 ${VB_W} ${VB_H}`}
                  style={{ width: `${zoom * 100}%` }}
                  onPointerMove={(e) => {
                  const anchor =
                    mode === "polyline" && polyDraft.length > 0
                      ? polyDraft[polyDraft.length - 1]
                      : draggingIdx !== null && draggingIdx > 0
                      ? pointsMm[draggingIdx - 1]
                      : undefined;
                  const pt = getMmCoords(e, anchor);
                  setHoverPt(pt);
                  if (mode === "edit" && draggingIdx !== null) {
                    setPointsMm((prev) =>
                      prev.map((p, idx) =>
                        idx === draggingIdx
                          ? {
                              x: idx === 0 ? 0 : pt.x,
                              y: pt.y,
                            }
                          : p
                      )
                    );
                  }
                }}
                onPointerUp={() => {
                  if (draggingIdx !== null) setDraggingIdx(null);
                }}
                onClick={(e) => {
                  if (mode !== "polyline") return;
                  const anchor = polyDraft.length > 0 ? polyDraft[polyDraft.length - 1] : undefined;
                  const pt = getMmCoords(e, anchor);
                  const nextPt = polyDraft.length === 0 ? { x: 0, y: pt.y } : pt;
                  setPolyDraft((prev) => [...prev, nextPt]);
                }}
                className="w-full h-72 rounded-xl bg-[#FCFBF8] border border-[#E5DFD3] touch-none select-none cursor-crosshair"
              >
                {/* 5mm vertical grid + 2mm horizontal grid */}
                {[0, 10, 20, 30, 40, 50, 60, 70, 80].map((gx) => (
                  <g key={`gx_${gx}`}>
                    <line
                      x1={toSvgX(gx)}
                      y1={PAD_T}
                      x2={toSvgX(gx)}
                      y2={VB_H - PAD_B}
                      stroke="#EDE7DB"
                      strokeWidth="0.8"
                    />
                    <text
                      x={toSvgX(gx)}
                      y={VB_H - 10}
                      textAnchor="middle"
                      fontSize="8"
                      fill="#78716C"
                      fontFamily="monospace"
                    >
                      {gx}
                    </text>
                  </g>
                ))}
                {[0, 4, 8, 12, 16, thicknessMm].map((gy) => (
                  <g key={`gy_${gy}`}>
                    <line
                      x1={PAD_L}
                      y1={toSvgY(gy)}
                      x2={VB_W - PAD_R}
                      y2={toSvgY(gy)}
                      stroke={gy === thicknessMm || gy === 0 ? "#C7BFA9" : "#F1ECE2"}
                      strokeWidth={gy === thicknessMm || gy === 0 ? "1.1" : "0.7"}
                    />
                    <text
                      x={PAD_L - 6}
                      y={toSvgY(gy) + 3}
                      textAnchor="end"
                      fontSize="8"
                      fill="#78716C"
                      fontFamily="monospace"
                    >
                      {gy}
                    </text>
                  </g>
                ))}

                {/* Solid Cross-Section Fill */}
                {closedSectionSvgD && (
                  <path
                    d={closedSectionSvgD}
                    fill="#D6C7B2"
                    fillOpacity="0.45"
                    stroke="#141413"
                    strokeWidth="2.2"
                    strokeLinejoin="round"
                  />
                )}

                {/* Segment length labels & midpoint insert handles in edit mode */}
                {mode === "edit" &&
                  pointsMm.slice(0, -1).map((p, idx) => {
                    const q = pointsMm[idx + 1];
                    const mx = (p.x + q.x) / 2;
                    const my = (p.y + q.y) / 2;
                    const len = Math.hypot(q.x - p.x, q.y - p.y).toFixed(1);
                    return (
                      <g key={`seg_${idx}`}>
                        <text
                          x={toSvgX(mx)}
                          y={toSvgY(my) - 7}
                          textAnchor="middle"
                          fontSize="7.5"
                          fontWeight="700"
                          fill="#57534E"
                          fontFamily="monospace"
                        >
                          {len}mm
                        </text>
                        <circle
                          cx={toSvgX(mx)}
                          cy={toSvgY(my)}
                          r="3.2"
                          fill="#FFFFFF"
                          stroke="#78716C"
                          strokeWidth="1"
                          className="cursor-pointer hover:fill-amber-400"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            pushHistory(pointsMm);
                            const ins = { x: Number(mx.toFixed(1)), y: Number(my.toFixed(1)) };
                            setPointsMm([
                              ...pointsMm.slice(0, idx + 1),
                              ins,
                              ...pointsMm.slice(idx + 1),
                            ]);
                            setSelectedIdx(idx + 1);
                          }}
                        />
                      </g>
                    );
                  })}

                {/* Vertices */}
                {mode === "edit" &&
                  pointsMm.map((p, idx) => {
                    const isSel = selectedIdx === idx;
                    return (
                      <circle
                        key={`pt_${idx}`}
                        cx={toSvgX(p.x)}
                        cy={toSvgY(p.y)}
                        r={isSel ? 6 : 4.5}
                        fill={isSel ? "#D97706" : "#141413"}
                        stroke="#FFFFFF"
                        strokeWidth="1.5"
                        className="cursor-grab active:cursor-grabbing"
                        onPointerDown={(ev) => {
                          ev.stopPropagation();
                          pushHistory(pointsMm);
                          setSelectedIdx(idx);
                          setDraggingIdx(idx);
                        }}
                      />
                    );
                  })}

                {/* Polyline Draft */}
                {mode === "polyline" && polyDraft.length > 0 && (
                  <>
                    <path
                      d={polyDraft
                        .map(
                          (p, idx) =>
                            `${idx === 0 ? "M" : "L"} ${toSvgX(p.x).toFixed(1)} ${toSvgY(p.y).toFixed(1)}`
                        )
                        .join(" ")}
                      fill="none"
                      stroke="#D97706"
                      strokeWidth="2.2"
                    />
                    {hoverPt && (
                      <line
                        x1={toSvgX(polyDraft[polyDraft.length - 1].x)}
                        y1={toSvgY(polyDraft[polyDraft.length - 1].y)}
                        x2={toSvgX(hoverPt.x)}
                        y2={toSvgY(hoverPt.y)}
                        stroke="#D97706"
                        strokeWidth="1.6"
                        strokeDasharray="4 2"
                      />
                    )}
                  </>
                )}
              </svg>
              </div>

              {mode === "polyline" && polyDraft.length >= 2 && (
                <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-xs">
                  <span className="font-semibold text-amber-900">
                    {polyDraft.length} nokta çizildi
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPolyDraft([])}
                      className="px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-amber-900 font-semibold cursor-pointer"
                    >
                      İptal
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        pushHistory(pointsMm);
                        setPointsMm(polyDraft);
                        setPolyDraft([]);
                        setMode("edit");
                        setBaseProfile("custom_cad_profile");
                      }}
                      className="px-3 py-1 rounded-lg bg-[#141413] text-white font-semibold cursor-pointer"
                    >
                      Kesiti Uygula
                    </button>
                  </div>
                </div>
              )}

              {/* Starters + Vertex Precision Controls */}
              <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[10.5px] font-semibold text-[#78716C] mr-1">Şablon:</span>
                  {(Object.entries(SECTION_STARTERS) as Array<
                    [keyof typeof SECTION_STARTERS, (typeof SECTION_STARTERS)[keyof typeof SECTION_STARTERS]]
                  >).map(([key, st]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        pushHistory(pointsMm);
                        setPointsMm(st.pts(thicknessMm));
                        setBaseProfile(st.baseProfile);
                        setIsGlass(st.isGlass);
                        setSelectedIdx(1);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-[#F5F2EA] hover:bg-[#EAE3D5] text-[10.5px] font-semibold text-[#141413] cursor-pointer"
                    >
                      {st.label}
                    </button>
                  ))}
                </div>

                {selectedPt && selectedIdx !== null && (
                  <div className="flex items-center gap-1.5 bg-[#F5F2EA] px-2.5 py-1 rounded-xl text-[11px]">
                    <span className="font-bold text-[#141413]">N{selectedIdx + 1}:</span>
                    <input
                      type="number"
                      step={0.5}
                      min={0}
                      max={MAX_PROF_W_MM}
                      disabled={selectedIdx === 0}
                      value={selectedPt.x}
                      onChange={(e) => {
                        const nx = Math.max(0, Math.min(MAX_PROF_W_MM, Number(e.target.value) || 0));
                        setPointsMm((prev) =>
                          prev.map((p, i) => (i === selectedIdx ? { ...p, x: nx } : p))
                        );
                      }}
                      className="w-14 h-7 px-1.5 rounded-lg bg-white border border-[#DED8CC] font-mono text-center font-semibold"
                    />
                    <span className="text-[#78716C]">×</span>
                    <input
                      type="number"
                      step={0.5}
                      min={2}
                      max={thicknessMm}
                      value={selectedPt.y}
                      onChange={(e) => {
                        const ny = Math.max(2, Math.min(thicknessMm, Number(e.target.value) || 2));
                        setPointsMm((prev) =>
                          prev.map((p, i) => (i === selectedIdx ? { ...p, y: ny } : p))
                        );
                      }}
                      className="w-14 h-7 px-1.5 rounded-lg bg-white border border-[#DED8CC] font-mono text-center font-semibold"
                    />
                    <button
                      type="button"
                      title="Seçili köşeye pah kır"
                      onClick={applyChamferToSelected}
                      disabled={selectedIdx <= 0 || selectedIdx >= pointsMm.length - 1}
                      className="h-7 px-2 rounded-lg bg-white border border-[#DED8CC] hover:bg-[#141413] hover:text-white font-semibold inline-flex items-center gap-1 disabled:opacity-35 cursor-pointer"
                    >
                      <Scissors className="w-3 h-3" />
                      <span>Pah {chamferMm}mm</span>
                    </button>
                    <button
                      type="button"
                      title="Seçili köşeye R radyüs ver"
                      onClick={applyFilletToSelected}
                      disabled={selectedIdx <= 0 || selectedIdx >= pointsMm.length - 1}
                      className="h-7 px-2 rounded-lg bg-white border border-[#DED8CC] hover:bg-[#141413] hover:text-white font-semibold inline-flex items-center gap-1 disabled:opacity-35 cursor-pointer"
                    >
                      <span>R{filletMm}</span>
                    </button>
                    {pointsMm.length > 2 && selectedIdx > 0 && (
                      <button
                        type="button"
                        title="Noktayı Sil"
                        onClick={() => {
                          pushHistory(pointsMm);
                          setPointsMm((prev) => prev.filter((_, i) => i !== selectedIdx));
                          setSelectedIdx(Math.max(0, selectedIdx - 1));
                        }}
                        className="w-7 h-7 rounded-lg bg-white border border-[#DED8CC] hover:bg-rose-50 hover:text-rose-700 flex items-center justify-center cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
              {importError && <div className="text-xs text-rose-700 font-medium">{importError}</div>}
            </div>
          </div>

          {/* Right: Parameters + Synchronized Elevation Preview */}
          <div className="lg:col-span-4 space-y-3">
            <div className="rounded-2xl bg-white border border-[#DED8CC] p-4 space-y-3">
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-[#57534E]">Model Adı</span>
                <input
                  type="text"
                  placeholder="ör. 18mm Özel J-Pah Kesit"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl bg-[#FAF8F4] border border-[#DED8CC] text-xs font-semibold"
                />
              </label>

              <div className="space-y-1">
                <span className="text-xs font-semibold text-[#57534E] block">Kullanım Alanı</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    [
                      { id: "door", label: "Dolap Kapağı" },
                      { id: "drawer", label: "Çekmece Klapası" },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTarget(t.id)}
                      className={`h-9 rounded-xl text-xs font-semibold cursor-pointer ${
                        target === t.id
                          ? "bg-[#141413] text-white"
                          : "bg-[#F5F2EA] hover:bg-[#EAE3D5] text-[#44403C]"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <label className="space-y-1">
                  <span className="text-[11px] text-[#57534E]">Kalınlık</span>
                  <select
                    value={thicknessMm}
                    onChange={(e) => setThicknessMm(Number(e.target.value))}
                    className="w-full h-9 px-2 rounded-xl bg-[#FAF8F4] border border-[#DED8CC] font-mono text-xs font-semibold"
                  >
                    <option value={18}>18 mm</option>
                    <option value={20}>20 mm</option>
                    <option value={22}>22 mm</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] text-[#57534E]">Pah (mm)</span>
                  <input
                    type="number"
                    min={1}
                    max={15}
                    step={0.5}
                    value={chamferMm}
                    onChange={(e) => setChamferMm(Math.max(1, Math.min(15, Number(e.target.value) || 4)))}
                    className="w-full h-9 px-2 rounded-xl bg-[#FAF8F4] border border-[#DED8CC] font-mono text-xs font-semibold text-center"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] text-[#57534E]">Radyüs (R)</span>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    step={0.5}
                    value={filletMm}
                    onChange={(e) => setFilletMm(Math.max(1, Math.min(12, Number(e.target.value) || 3)))}
                    className="w-full h-9 px-2 rounded-xl bg-[#FAF8F4] border border-[#DED8CC] font-mono text-xs font-semibold text-center"
                  />
                </label>
              </div>

              <div
                className={`px-3 py-2 rounded-xl border text-[11px] font-semibold flex items-center gap-2 ${
                  minWallMm < 4
                    ? "bg-rose-50 border-rose-200 text-rose-800"
                    : "bg-emerald-50 border-emerald-200 text-emerald-800"
                }`}
              >
                {minWallMm < 4 ? (
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>
                  {minWallMm < 4
                    ? `Et kalınlığı ${minWallMm} mm (min. 4 mm önerilir)`
                    : `CNC Üretime Uygun (Min. Et: ${minWallMm} mm)`}
                </span>
              </div>

              <label className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#F5F2EA] text-xs font-semibold cursor-pointer">
                <span>Ortası Camlı / Vitrin</span>
                <input
                  type="checkbox"
                  checked={isGlass}
                  onChange={(e) => setIsGlass(e.target.checked)}
                  className="accent-[#141413] w-4 h-4"
                />
              </label>

              {/* Synchronized Front Elevation Preview */}
              <div className="pt-2 border-t border-[#F0ECE3] flex items-center gap-3">
                <svg viewBox="0 0 80 100" className="w-20 h-24 shrink-0 rounded-xl bg-[#FCFBF8] border border-[#E5DFD3]">
                  <rect x="6" y="6" width="68" height="88" rx="2" fill="#F5F2EA" stroke="#141413" strokeWidth="2" />
                  {(() => {
                    const inset = Math.min(24, Math.max(6, Math.round(profileSpanMm * 0.25)));
                    return (
                      <rect
                        x={6 + inset}
                        y={6 + inset}
                        width={Math.max(16, 68 - inset * 2)}
                        height={Math.max(16, 88 - inset * 2)}
                        fill={isGlass ? "#94A3B8" : "#E6DEC8"}
                        fillOpacity={isGlass ? 0.35 : 0.65}
                        stroke="#141413"
                        strokeWidth="1.2"
                      />
                    );
                  })()}
                </svg>
                <div className="text-[11px] text-[#57534E] space-y-1">
                  <div className="font-bold text-[#141413] inline-flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5" />
                    <span>Ön Görünüş &amp; Kesit Özeti</span>
                  </div>
                  <div>Profil Genişliği: <span className="font-mono font-semibold text-[#141413]">{profileSpanMm} mm</span></div>
                  <div>Maks. Freze Derinliği: <span className="font-mono font-semibold text-[#141413]">{maxDepthCutMm} mm</span></div>
                  <div>Nokta Sayısı: <span className="font-mono font-semibold text-[#141413]">{pointsMm.length}</span></div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  pushHistory(pointsMm);
                  const last = pointsMm[pointsMm.length - 1] || { x: 40, y: thicknessMm };
                  setPointsMm([...pointsMm, { x: Math.min(MAX_PROF_W_MM, last.x + 10), y: last.y }]);
                  setSelectedIdx(pointsMm.length);
                }}
                className="w-full h-8 rounded-xl bg-[#F5F2EA] hover:bg-[#EAE3D5] text-[11px] font-semibold inline-flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Sona Yeni Kesit Noktası Ekle</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-white border-t border-[#E5DFD3] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl bg-[#EAE3D5] text-[#44403C] text-xs font-semibold cursor-pointer"
          >
            İptal
          </button>
          <button
            type="button"
            disabled={!name.trim() || pointsMm.length < 2}
            onClick={() =>
              onSave({
                id: `custom_door_${Date.now()}`,
                label: name.trim(),
                target,
                baseProfile: isGlass ? "center_glass_frame" : baseProfile,
                isGlass,
                svgPaths: iconSvgPaths,
                customCadPolygon: normalizedPolygon,
                thicknessMm,
              })
            }
            className="px-5 py-2 rounded-xl bg-[#141413] text-white text-xs font-semibold disabled:opacity-40 cursor-pointer"
          >
            Kaydet &amp; 3B&apos;ye Uygula
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modalContent, document.body);
};
