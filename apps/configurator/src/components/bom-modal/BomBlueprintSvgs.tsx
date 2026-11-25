"use client";
import React from "react";
import { CutPiece } from "@birim/manufacturing";

export function escapeHtml(raw: unknown): string {
  return String(raw ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function countActiveBands(eb: CutPiece["edgeBanding"]): number {
  return (eb.top ? 1 : 0) + (eb.bottom ? 1 : 0) + (eb.left ? 1 : 0) + (eb.right ? 1 : 0);
}

export function getPieceDxfLayers(p: CutPiece): string[] {
  const layers = ["PANEL_CONTOUR", "NET_CUT_CONTOUR"];
  if (p.hasBackGroove) layers.push("BACK_GROOVE_8MM");
  if (p.tambourTrackGrooveSpec) layers.push("TAMBOUR_TRACK_W8_5_Z7_5");
  if (p.kerfBendingMeta) layers.push("KERF_SLOTS");
  if (p.holes && p.holes.length > 0) {
    if (p.holes.some((h) => h.purpose === "minifix_cam" || h.purpose === "minifix_bolt")) {
      layers.push("MINIFIX_D15");
    }
    if (p.holes.some((h) => h.purpose === "dowel")) {
      layers.push("DOWEL_D8");
    }
    if (p.holes.some((h) => h.purpose === "hinge_cup" || h.purpose === "hinge_mount")) {
      layers.push("HINGE_D35");
    }
    if (p.holes.length >= 6) {
      layers.push("SYSTEM_32_HOLES");
    }
  }
  return layers;
}

export const MiniEdgeBandSvg: React.FC<{ edgeBanding: CutPiece["edgeBanding"] }> = ({ edgeBanding }) => {
  const activeCount = countActiveBands(edgeBanding);
  const strokeColor = activeCount === 4 ? "#D97706" : "#2563EB";
  const labels: string[] = [];
  if (edgeBanding.top) labels.push("Üst");
  if (edgeBanding.bottom) labels.push("Alt");
  if (edgeBanding.left) labels.push("Sol");
  if (edgeBanding.right) labels.push("Sağ");

  return (
    <svg
      width="22"
      height="16"
      viewBox="0 0 22 16"
      className="shrink-0"
      aria-label={labels.length ? `Bantlı Kenarlar: ${labels.join(", ")}` : "Bantsız"}
    >
      <rect
        x="2"
        y="2"
        width="18"
        height="12"
        rx="1.2"
        fill="#F5F2EA"
        stroke="#CBD5E1"
        strokeWidth="1"
      />
      {edgeBanding.top && (
        <line x1="2" y1="2" x2="20" y2="2" stroke={strokeColor} strokeWidth="2.3" strokeLinecap="round" />
      )}
      {edgeBanding.bottom && (
        <line x1="2" y1="14" x2="20" y2="14" stroke={strokeColor} strokeWidth="2.3" strokeLinecap="round" />
      )}
      {edgeBanding.left && (
        <line x1="2" y1="2" x2="2" y2="14" stroke={strokeColor} strokeWidth="2.3" strokeLinecap="round" />
      )}
      {edgeBanding.right && (
        <line x1="20" y1="2" x2="20" y2="14" stroke={strokeColor} strokeWidth="2.3" strokeLinecap="round" />
      )}
    </svg>
  );
};

export const CutPieceBlueprintSvg: React.FC<{
  piece: CutPiece;
  layers: { bant: boolean; cnc: boolean; olcu: boolean };
}> = ({ piece, layers }) => {
  const boxW = 196;
  const boxH = 114;
  const boy = Math.max(1, piece.lengthMm);
  const en = Math.max(1, piece.widthMm);
  const ratio = boy / en;
  let w: number;
  let h: number;
  if (ratio >= boxW / boxH) {
    w = boxW;
    h = Math.max(36, boxW / ratio);
  } else {
    h = boxH;
    w = Math.max(54, boxH * ratio);
  }
  const x = (300 - w) / 2;
  const y = (196 - h) / 2;
  const eb = piece.edgeBanding;
  const bandCount = countActiveBands(eb);
  const bandColor = bandCount === 4 ? "#F59E0B" : "#3B82F6";
  const bandText = bandCount === 4 ? "#FDE68A" : "#93C5FD";
  const netL = piece.netCutLengthMm ?? piece.lengthMm;
  const netW = piece.netCutWidthMm ?? piece.widthMm;
  const topY = y - (eb.top && layers.bant ? 22 : 13);
  const rightX = x + w + (eb.right && layers.bant ? 28 : 13);
  const botY = y + h + (eb.bottom && layers.bant ? 24 : 15);

  return (
    <svg
      viewBox="0 0 300 196"
      className="w-full h-[196px] rounded-xl bg-[#0F131A] border border-slate-800/80 shadow-inner"
      aria-label={`${piece.pieceName} 2D teknik çizim`}
    >
      <defs>
        <pattern id="bomEngGrid" width="15" height="15" patternUnits="userSpaceOnUse">
          <path d="M 15 0 L 0 0 0 15" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.7" />
        </pattern>
      </defs>
      <rect width="300" height="196" fill="url(#bomEngGrid)" />
      {/* Finished contour */}
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill="rgba(255,255,255,0.04)"
        stroke="rgba(255,255,255,0.28)"
        strokeWidth="1"
      />
      {/* Net cut contour */}
      <rect
        x={x + 2.5}
        y={y + 2.5}
        width={Math.max(4, w - 5)}
        height={Math.max(4, h - 5)}
        fill="none"
        stroke="rgba(52,211,153,0.32)"
        strokeWidth="0.7"
        strokeDasharray="2.5 2.5"
      />

      {/* Edge banding layer */}
      {layers.bant && (
        <g>
          {eb.top && (
            <>
              <line x1={x} y1={y} x2={x + w} y2={y} stroke={bandColor} strokeWidth="3" />
              <rect x={x + w / 2 - 11} y={y - 11} width="22" height="10" rx="2.5" fill="#0F131A" stroke={bandColor} strokeWidth="0.75" />
              <text x={x + w / 2} y={y - 3.5} textAnchor="middle" fill={bandText} fontFamily="monospace" fontSize="7.5">Ü</text>
            </>
          )}
          {eb.bottom && (
            <>
              <line x1={x} y1={y + h} x2={x + w} y2={y + h} stroke={bandColor} strokeWidth="3" />
              <rect x={x + w / 2 - 11} y={y + h + 2} width="22" height="10" rx="2.5" fill="#0F131A" stroke={bandColor} strokeWidth="0.75" />
              <text x={x + w / 2} y={y + h + 9.5} textAnchor="middle" fill={bandText} fontFamily="monospace" fontSize="7.5">A</text>
            </>
          )}
          {eb.left && (
            <>
              <line x1={x} y1={y} x2={x} y2={y + h} stroke={bandColor} strokeWidth="3" />
              <rect x={x - 18} y={y + h / 2 - 5} width="15" height="10" rx="2.5" fill="#0F131A" stroke={bandColor} strokeWidth="0.75" />
              <text x={x - 10.5} y={y + h / 2 + 2.5} textAnchor="middle" fill={bandText} fontFamily="monospace" fontSize="7.5">S</text>
            </>
          )}
          {eb.right && (
            <>
              <line x1={x + w} y1={y} x2={x + w} y2={y + h} stroke={bandColor} strokeWidth="3" />
              <rect x={x + w + 3} y={y + h / 2 - 5} width="17" height="10" rx="2.5" fill="#0F131A" stroke={bandColor} strokeWidth="0.75" />
              <text x={x + w + 11.5} y={y + h / 2 + 2.5} textAnchor="middle" fill={bandText} fontFamily="monospace" fontSize="7.5">Sa</text>
            </>
          )}
        </g>
      )}

      {/* CNC holes, back groove & kerf layer */}
      {layers.cnc && (
        <g>
          {piece.hasBackGroove && (
            <line
              x1={x + 3}
              y1={y + h - 8}
              x2={x + w - 3}
              y2={y + h - 8}
              stroke="#F59E0B"
              strokeWidth="1.5"
              strokeDasharray="3.5 2.5"
              opacity="0.85"
            />
          )}
          {piece.kerfBendingMeta &&
            Array.from({ length: Math.min(18, Math.max(6, piece.kerfBendingMeta.kerfCount)) }).map((_, ki, arr) => {
              const kx = x + 6 + (ki / Math.max(1, arr.length - 1)) * (w - 12);
              return (
                <line
                  key={ki}
                  x1={kx}
                  y1={y + 4}
                  x2={kx}
                  y2={y + h - 4}
                  stroke="#F59E0B"
                  strokeOpacity="0.45"
                  strokeWidth="0.8"
                />
              );
            })}
          {(piece.holes || []).slice(0, 48).map((hole, hi) => {
            const normX = Math.max(0.04, Math.min(0.96, hole.y / boy));
            const normY = Math.max(0.06, Math.min(0.94, hole.x / en));
            const hx = x + normX * w;
            const hy = y + normY * h;
            const isCamOrCup = hole.purpose === "minifix_cam" || hole.purpose === "hinge_cup";
            return (
              <circle
                key={hole.id || hi}
                cx={hx}
                cy={hy}
                r={isCamOrCup ? 3.1 : 1.9}
                fill={isCamOrCup ? "rgba(245,158,11,0.22)" : "#38BDF8"}
                stroke={isCamOrCup ? "#F59E0B" : "#E0F2FE"}
                strokeWidth={isCamOrCup ? 1.1 : 0.5}
              />
            );
          })}
        </g>
      )}

      {/* Dimension lines */}
      {layers.olcu && (
        <g>
          <line x1={x} y1={topY} x2={x + w} y2={topY} stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
          <line x1={x} y1={topY - 2.5} x2={x} y2={topY + 2.5} stroke="rgba(255,255,255,0.4)" strokeWidth="0.8" />
          <line x1={x + w} y1={topY - 2.5} x2={x + w} y2={topY + 2.5} stroke="rgba(255,255,255,0.4)" strokeWidth="0.8" />
          <text x={x + w / 2} y={topY - 4} textAnchor="middle" fill="#E2E8F0" fontFamily="monospace" fontSize="8.5">
            {piece.lengthMm} mm
          </text>

          <line x1={rightX} y1={y} x2={rightX} y2={y + h} stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
          <line x1={rightX - 2.5} y1={y} x2={rightX + 2.5} y2={y} stroke="rgba(255,255,255,0.4)" strokeWidth="0.8" />
          <line x1={rightX - 2.5} y1={y + h} x2={rightX + 2.5} y2={y + h} stroke="rgba(255,255,255,0.4)" strokeWidth="0.8" />
          <text x={rightX + 5} y={y + h / 2 + 3} textAnchor="start" fill="#E2E8F0" fontFamily="monospace" fontSize="8">
            {piece.widthMm}
          </text>

          <text x={x + w / 2} y={Math.min(191, botY + 5)} textAnchor="middle" fill="#34D399" fontFamily="monospace" fontSize="7.5">
            NET: {netL} × {netW} mm
          </text>
        </g>
      )}

      <text x={x + w / 2} y={y + h / 2 + 2.5} textAnchor="middle" fill="rgba(255,255,255,0.22)" fontFamily="monospace" fontSize="7.5">
        {piece.grain && piece.grain !== "none" ? "↔ DESEN" : "SERBEST"}
      </text>
    </svg>
  );
};
