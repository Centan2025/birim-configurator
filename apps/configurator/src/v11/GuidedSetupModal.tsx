"use client";

import React, { useState, useMemo } from "react";
import { X, Sparkles, Check, ArrowRight } from "lucide-react";
import { createInitialProject, type DesignProject, type MaterialDefinition } from "@birim/core";
import { generateSmartStarterTemplates } from "../v3/adapter/guidedWizardBuilder";

export interface GuidedSetupWizardPayload {
  spaceCategory: "wardrobe" | "walkin" | "kitchen" | "living";
  roomShape: "rectangular" | "l_shape" | "u_shape";
  wallWidthMm: number;
  targetHeightMm: number;
  targetDepthMm: number;
  autoFiller50Mm: boolean;
  interiorFocus: "hanging" | "balanced" | "shelves";
  doorStyle: "hinged" | "sliding" | "glass" | "open";
  conceptTier: "eco" | "smart" | "signature";
  colorSwatchId?: string;
  addLed: boolean;
  addTrouserRack: boolean;
  addJewelryTray: boolean;
  kitchenGripSystem?: "gola_profile" | "gola_melamine_box" | "bevel_backing" | "j_pull" | "bar_handle" | "push_to_open";
  kitchenWallOpening?: "lift_bi_fold" | "lift_up_stay" | "lift_parallel" | "hinged";
}

export interface GuidedSetupModalProps {
  isOpen: boolean;
  project?: DesignProject;
  materials: MaterialDefinition[];
  onClose: () => void;
  onApply: (payload: GuidedSetupWizardPayload) => void;
}


const renderRoomCategoryArt = (id: "wardrobe" | "walkin" | "kitchen" | "living", active: boolean) => {
  const stroke = active ? "#FFFFFF" : "#CBD5E1";
  const accent = active ? "#93C5FD" : "#38BDF8";
  if (id === "wardrobe") {
    return (
      <svg viewBox="0 0 64 42" className="w-12 h-8 mx-auto mb-1" fill="none">
        <rect x="10" y="4" width="44" height="34" rx="2.5" stroke={stroke} strokeWidth="1.6" fill="rgba(148,163,184,0.10)" />
        <line x1="25" y1="4" x2="25" y2="38" stroke={stroke} strokeWidth="1.2" />
        <line x1="39" y1="4" x2="39" y2="38" stroke={stroke} strokeWidth="1.2" />
        <line x1="22.5" y1="18" x2="22.5" y2="25" stroke={accent} strokeWidth="1.8" strokeLinecap="round" />
        <line x1="27.5" y1="18" x2="27.5" y2="25" stroke={accent} strokeWidth="1.8" strokeLinecap="round" />
        <line x1="41.5" y1="18" x2="41.5" y2="25" stroke={accent} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (id === "walkin") {
    return (
      <svg viewBox="0 0 64 42" className="w-12 h-8 mx-auto mb-1" fill="none">
        <rect x="6" y="4" width="52" height="34" rx="2.5" stroke={stroke} strokeWidth="1.5" fill="rgba(148,163,184,0.08)" />
        <line x1="21" y1="4" x2="21" y2="38" stroke={stroke} strokeWidth="1.1" />
        <line x1="43" y1="4" x2="43" y2="38" stroke={stroke} strokeWidth="1.1" />
        <line x1="9" y1="12" x2="18" y2="12" stroke={accent} strokeWidth="1.7" strokeLinecap="round" />
        <line x1="24" y1="11" x2="40" y2="11" stroke={stroke} strokeWidth="1.1" />
        <line x1="24" y1="18" x2="40" y2="18" stroke={stroke} strokeWidth="1.1" />
        <rect x="24" y="24" width="16" height="5" rx="1" stroke={accent} strokeWidth="1.1" />
        <rect x="24" y="31" width="16" height="5" rx="1" stroke={accent} strokeWidth="1.1" />
        <line x1="46" y1="12" x2="55" y2="12" stroke={accent} strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }
  if (id === "kitchen") {
    return (
      <svg viewBox="0 0 64 42" className="w-12 h-8 mx-auto mb-1" fill="none">
        <rect x="8" y="4" width="48" height="12" rx="1.8" stroke={stroke} strokeWidth="1.4" fill="rgba(148,163,184,0.10)" />
        <line x1="24" y1="4" x2="24" y2="16" stroke={stroke} strokeWidth="1.1" />
        <line x1="40" y1="4" x2="40" y2="16" stroke={stroke} strokeWidth="1.1" />
        <line x1="8" y1="23" x2="56" y2="23" stroke={accent} strokeWidth="2" />
        <rect x="8" y="23" width="48" height="15" rx="1.5" stroke={stroke} strokeWidth="1.5" fill="rgba(148,163,184,0.12)" />
        <line x1="24" y1="23" x2="24" y2="38" stroke={stroke} strokeWidth="1.1" />
        <line x1="40" y1="23" x2="40" y2="38" stroke={stroke} strokeWidth="1.1" />
        <line x1="27" y1="29" x2="37" y2="29" stroke={stroke} strokeWidth="1.1" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 64 42" className="w-12 h-8 mx-auto mb-1" fill="none">
      <rect x="17" y="6" width="30" height="17" rx="2" stroke={accent} strokeWidth="1.5" fill="rgba(56,189,248,0.12)" />
      <rect x="8" y="27" width="48" height="10" rx="2" stroke={stroke} strokeWidth="1.5" fill="rgba(148,163,184,0.12)" />
      <line x1="24" y1="27" x2="24" y2="37" stroke={stroke} strokeWidth="1.1" />
      <line x1="40" y1="27" x2="40" y2="37" stroke={stroke} strokeWidth="1.1" />
    </svg>
  );
};

const renderRoomShapePlanArt = (id: "rectangular" | "l_shape" | "u_shape", active: boolean) => {
  const wall = active ? "#FFFFFF" : "#CBD5E1";
  const cab = active ? "#60A5FA" : "#38BDF8";
  if (id === "rectangular") {
    return (
      <svg viewBox="0 0 56 30" className="w-11 h-6 shrink-0" fill="none">
        <line x1="6" y1="6" x2="50" y2="6" stroke={wall} strokeWidth="2.4" strokeLinecap="round" />
        <rect x="10" y="9" width="36" height="11" rx="2" stroke={cab} strokeWidth="1.4" fill="rgba(56,189,248,0.18)" />
      </svg>
    );
  }
  if (id === "l_shape") {
    return (
      <svg viewBox="0 0 56 30" className="w-11 h-6 shrink-0" fill="none">
        <path d="M10 26 V6 H48" stroke={wall} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13 9 H45 V17 H21 V25 H13 Z" stroke={cab} strokeWidth="1.4" fill="rgba(56,189,248,0.18)" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 56 30" className="w-11 h-6 shrink-0" fill="none">
      <path d="M10 26 V6 H46 V26" stroke={wall} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 9 H43 V25 H36 V16 H20 V25 H13 Z" stroke={cab} strokeWidth="1.4" fill="rgba(56,189,248,0.18)" strokeLinejoin="round" />
    </svg>
  );
};

const renderStarterElevationArt = (
  cardId: string,
  payload: GuidedSetupWizardPayload,
  bayCount: number
) => {
  const {
    spaceCategory,
    roomShape,
    doorStyle,
    addLed,
    addJewelryTray,
    kitchenGripSystem,
    kitchenWallOpening,
  } = payload;
  const hasLed = Boolean(addLed);
  const isL = roomShape === "l_shape";
  const isU = roomShape === "u_shape";
  const isKitchen = spaceCategory === "kitchen";
  const isWalkin = spaceCategory === "walkin";
  const isLiving = spaceCategory === "living";
  const isSliding = doorStyle === "sliding" || cardId.includes("sliding");
  const isGlass =
    !isWalkin && (doorStyle === "glass" || cardId.includes("glass") || cardId.includes("signature"));
  const isDrawerHeavy =
    cardId.includes("drawer") || cardId.includes("shelf") || cardId.includes("maximum");
  const isHangingHeavy = cardId.includes("hanging");

  const w = 248;
  const h = 114;
  const y0 = 12;
  const ch = 90;
  const plinthH = 7;
  const bodyH = ch - plinthH;
  const wingW = isU ? 26 : isL ? 32 : 0;
  const x0 = isU ? 34 : isL ? 14 : 16;
  const cw = isU ? w - 68 : isL ? w - 52 : w - 32;
  const bays = Math.max(2, Math.min(isU ? 3 : isL ? 4 : 5, bayCount || 3));
  const bw = cw / bays;

  // Mini Plan Badge (top-right inside dark frame)
  const planBadgeLabel = isU ? "U-Plan" : isL ? "L-Köşe" : "I-Plan";
  const renderMiniPlanBadge = () => (
    <g transform={`translate(${w - 46}, 4)`}>
      <rect
        x="0"
        y="0"
        width="42"
        height="14"
        rx="4"
        fill="rgba(15,23,42,0.88)"
        stroke="rgba(148,163,184,0.35)"
        strokeWidth="0.9"
      />
      {isU ? (
        <path
          d="M5 10.5 V4.5 H13 V10.5"
          stroke="#38BDF8"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : isL ? (
        <path
          d="M5 4.5 H12.5 V10.5"
          stroke="#38BDF8"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <line x1="5" y1="7.5" x2="13" y2="7.5" stroke="#38BDF8" strokeWidth="1.6" strokeLinecap="round" />
      )}
      <text
        x="16.5"
        y="9.7"
        fill="#CBD5E1"
        fontSize="6.4"
        fontWeight="700"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
      >
        {planBadgeLabel}
      </text>
    </g>
  );

  // Angled perspective side wing for L-Shape (right) and U-Shape (left + right)
  const renderReturnWing = (side: "left" | "right") => {
    const isLeft = side === "left";
    const xNear = isLeft ? x0 : x0 + cw;
    const xFar = isLeft ? x0 - wingW : x0 + cw + wingW;
    const perspTop = y0 - 4;
    const perspBot = y0 + ch + 3;
    const wingFill = isGlass ? "rgba(56,189,248,0.16)" : "rgba(148,163,184,0.18)";

    if (isKitchen) {
      const upTop = y0 + 2;
      const upBot = y0 + 30;
      const cntY = y0 + 51;
      const baseBot = y0 + bodyH;
      return (
        <g key={side}>
          {/* Upper kitchen return wing */}
          <polygon
            points={`${xNear},${upTop} ${xFar},${upTop - 3} ${xFar},${upBot - 2} ${xNear},${upBot}`}
            fill={isGlass ? "rgba(56,189,248,0.18)" : "rgba(148,163,184,0.16)"}
            stroke="#CBD5E1"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          {hasLed && (
            <line
              x1={xNear}
              y1={upBot + 1}
              x2={xFar}
              y2={upBot - 1}
              stroke="#FBBF24"
              strokeWidth="1.8"
              opacity="0.9"
            />
          )}
          {/* Countertop return */}
          <polygon
            points={`${xNear},${cntY} ${xFar},${cntY + 2} ${xFar},${cntY + 6} ${xNear},${cntY + 3.5}`}
            fill="#E2E8F0"
            stroke="#94A3B8"
            strokeWidth="0.9"
          />
          {/* Base kitchen return wing */}
          <polygon
            points={`${xNear},${cntY + 3.5} ${xFar},${cntY + 6} ${xFar},${baseBot + 3} ${xNear},${baseBot}`}
            fill="rgba(148,163,184,0.20)"
            stroke="#CBD5E1"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          <polygon
            points={`${xNear},${baseBot} ${xFar},${baseBot + 3} ${xFar},${perspBot} ${xNear},${y0 + ch}`}
            fill="rgba(100,116,139,0.28)"
            stroke="#64748B"
            strokeWidth="0.9"
          />
        </g>
      );
    }

    return (
      <g key={side}>
        <polygon
          points={`${xNear},${y0} ${xFar},${perspTop} ${xFar},${y0 + bodyH + 3} ${xNear},${y0 + bodyH}`}
          fill={wingFill}
          stroke="#CBD5E1"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        {/* Wing plinth */}
        <polygon
          points={`${xNear},${y0 + bodyH} ${xFar},${y0 + bodyH + 3} ${xFar},${perspBot} ${xNear},${y0 + ch}`}
          fill="rgba(100,116,139,0.26)"
          stroke="#64748B"
          strokeWidth="0.9"
        />
        {/* Wing interior/frame cues */}
        {hasLed && (
          <line
            x1={xNear}
            y1={y0 + 3.5}
            x2={xFar}
            y2={perspTop + 3.5}
            stroke="#FBBF24"
            strokeWidth="2"
            opacity="0.9"
          />
        )}
        {isGlass ? (
          <line
            x1={isLeft ? xFar + 4 : xNear + 4}
            y1={y0 + 10}
            x2={isLeft ? xNear - 4 : xFar - 4}
            y2={y0 + bodyH - 12}
            stroke="#7DD3FC"
            strokeWidth="1.2"
            opacity="0.55"
          />
        ) : (
          <>
            <line
              x1={xNear}
              y1={y0 + 26}
              x2={xFar}
              y2={y0 + 25}
              stroke="#94A3B8"
              strokeWidth="1"
              opacity="0.7"
            />
            <line
              x1={xNear}
              y1={y0 + 54}
              x2={xFar}
              y2={y0 + 55}
              stroke="#94A3B8"
              strokeWidth="1"
              opacity="0.7"
            />
          </>
        )}
      </g>
    );
  };

  // --- KITCHEN ELEVATION ---
  if (isKitchen) {
    const upY = y0 + 2;
    const upH = 28;
    const cntY = y0 + 51;
    const baseY = cntY + 3.5;
    const baseH = y0 + bodyH - baseY;
    const kBays = Math.max(3, Math.min(isU ? 4 : 5, bays));
    const kbw = cw / kBays;
    const isGola = kitchenGripSystem === "gola_profile" || kitchenGripSystem === "gola_melamine_box";
    const isJPull = kitchenGripSystem === "j_pull";
    const isBar = kitchenGripSystem === "bar_handle";
    const isBiFold = kitchenWallOpening === "lift_bi_fold";
    const isParallel = kitchenWallOpening === "lift_parallel";
    const isLiftUp = kitchenWallOpening === "lift_up_stay";

    return (
      <div className="w-full h-[124px] rounded-xl bg-gradient-to-b from-slate-900/85 to-slate-950/90 border border-white/15 p-2 shadow-inner flex items-center justify-center overflow-hidden">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" fill="none">
          <line x1="4" y1={y0 + ch + 2} x2={w - 4} y2={y0 + ch + 2} stroke="rgba(255,255,255,0.16)" strokeWidth="1.2" />
          {/* Upper wall cabinets */}
          <rect
            x={x0}
            y={upY}
            width={cw}
            height={upH}
            rx="2"
            stroke="#E2E8F0"
            strokeWidth="1.6"
            fill={isGlass ? "rgba(56,189,248,0.15)" : "rgba(148,163,184,0.13)"}
          />
          {Array.from({ length: kBays }).map((_, idx) => {
            const bx = x0 + idx * kbw;
            return (
              <g key={`ku-${idx}`}>
                {idx > 0 && <line x1={bx} y1={upY} x2={bx} y2={upY + upH} stroke="#CBD5E1" strokeWidth="1.2" />}
                {isGlass && (
                  <>
                    <rect
                      x={bx + 2.5}
                      y={upY + 2.5}
                      width={kbw - 5}
                      height={upH - 5}
                      rx="1"
                      stroke="#38BDF8"
                      strokeWidth="1.1"
                      fill="rgba(15,23,42,0.45)"
                    />
                    <line x1={bx + 4} y1={upY + upH * 0.52} x2={bx + kbw - 4} y2={upY + upH * 0.52} stroke="#94A3B8" strokeWidth="0.9" opacity="0.7" />
                    <line x1={bx + 4} y1={upY + 4} x2={bx + kbw - 6} y2={upY + upH - 4} stroke="#7DD3FC" strokeWidth="1" opacity="0.55" />
                  </>
                )}
                {isBiFold && (
                  <>
                    <line x1={bx + 2} y1={upY + upH / 2} x2={bx + kbw - 2} y2={upY + upH / 2} stroke="#93C5FD" strokeWidth="1.1" />
                    <path d={`M ${bx + kbw * 0.42} ${upY + upH * 0.32} L ${bx + kbw * 0.5} ${upY + upH * 0.18} L ${bx + kbw * 0.58} ${upY + upH * 0.32}`} stroke="#38BDF8" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </>
                )}
                {isLiftUp && (
                  <path d={`M ${bx + kbw * 0.42} ${upY + upH * 0.62} L ${bx + kbw * 0.5} ${upY + upH * 0.42} L ${bx + kbw * 0.58} ${upY + upH * 0.62}`} stroke="#38BDF8" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                )}
                {isParallel && (
                  <path d={`M ${bx + kbw * 0.5} ${upY + upH * 0.72} V ${upY + upH * 0.28} M ${bx + kbw * 0.42} ${upY + upH * 0.38} L ${bx + kbw * 0.5} ${upY + upH * 0.28} L ${bx + kbw * 0.58} ${upY + upH * 0.38}`} stroke="#7DD3FC" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                )}
                {!isBiFold && !isLiftUp && !isParallel && isBar && (
                  <line x1={bx + kbw - 5} y1={upY + upH * 0.45} x2={bx + kbw - 5} y2={upY + upH - 4} stroke="#E2E8F0" strokeWidth="1.6" strokeLinecap="round" />
                )}
              </g>
            );
          })}
          {/* Under-cabinet LED strip */}
          {hasLed && (
            <line x1={x0 + 3} y1={upY + upH + 2} x2={x0 + cw - 3} y2={upY + upH + 2} stroke="#FBBF24" strokeWidth="2.4" strokeLinecap="round" opacity="0.95" />
          )}
          {/* Backsplash faucet + subtle stove cue */}
          <path
            d={`M ${x0 + kbw * 0.5} ${cntY} V ${cntY - 9} C ${x0 + kbw * 0.5} ${cntY - 13} ${x0 + kbw * 0.68} ${cntY - 13} ${x0 + kbw * 0.68} ${cntY - 8}`}
            stroke="#94A3B8"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          {/* Countertop slab */}
          <rect x={x0 - 2} y={cntY} width={cw + 4} height="3.5" rx="1" fill="#E2E8F0" />
          {/* Base cabinets */}
          <rect x={x0} y={baseY} width={cw} height={baseH} rx="1.5" stroke="#E2E8F0" strokeWidth="1.6" fill="rgba(148,163,184,0.14)" />
          {isGola && (
            <line x1={x0 + 1} y1={baseY + 2.4} x2={x0 + cw - 1} y2={baseY + 2.4} stroke="#38BDF8" strokeWidth="1.8" opacity="0.85" />
          )}
          {Array.from({ length: kBays }).map((_, idx) => {
            const bx = x0 + idx * kbw;
            const isDrawerCol = idx === 1 || (isDrawerHeavy && idx % 2 === 1);
            return (
              <g key={`kb-${idx}`}>
                {idx > 0 && <line x1={bx} y1={baseY} x2={bx} y2={baseY + baseH} stroke="#CBD5E1" strokeWidth="1.2" />}
                {isDrawerCol ? (
                  <>
                    <line x1={bx + 2} y1={baseY + baseH * 0.34} x2={bx + kbw - 2} y2={baseY + baseH * 0.34} stroke="#94A3B8" strokeWidth="1.1" />
                    <line x1={bx + 2} y1={baseY + baseH * 0.67} x2={bx + kbw - 2} y2={baseY + baseH * 0.67} stroke="#94A3B8" strokeWidth="1.1" />
                    {isBar && (
                      <>
                        <line x1={bx + kbw * 0.34} y1={baseY + baseH * 0.17} x2={bx + kbw * 0.66} y2={baseY + baseH * 0.17} stroke="#E2E8F0" strokeWidth="1.5" strokeLinecap="round" />
                        <line x1={bx + kbw * 0.34} y1={baseY + baseH * 0.5} x2={bx + kbw * 0.66} y2={baseY + baseH * 0.5} stroke="#E2E8F0" strokeWidth="1.5" strokeLinecap="round" />
                        <line x1={bx + kbw * 0.34} y1={baseY + baseH * 0.83} x2={bx + kbw * 0.66} y2={baseY + baseH * 0.83} stroke="#E2E8F0" strokeWidth="1.5" strokeLinecap="round" />
                      </>
                    )}
                  </>
                ) : (
                  <>
                    {isJPull && (
                      <line x1={bx + 4} y1={baseY + 3.2} x2={bx + kbw - 4} y2={baseY + 3.2} stroke="#7DD3FC" strokeWidth="1.5" strokeLinecap="round" />
                    )}
                    {isBar && (
                      <line x1={bx + kbw - 5} y1={baseY + 5} x2={bx + kbw - 5} y2={baseY + 15} stroke="#E2E8F0" strokeWidth="1.6" strokeLinecap="round" />
                    )}
                  </>
                )}
              </g>
            );
          })}
          {/* Plinth */}
          <rect x={x0 + 3} y={y0 + bodyH} width={cw - 6} height={plinthH} rx="1" fill="rgba(148,163,184,0.22)" stroke="#64748B" strokeWidth="1" />
          {isL && renderReturnWing("right")}
          {isU && (
            <>
              {renderReturnWing("left")}
              {renderReturnWing("right")}
            </>
          )}
          {renderMiniPlanBadge()}
        </svg>
      </div>
    );
  }

  // --- LIVING / TV / VESTIYER ELEVATION ---
  if (isLiving) {
    const towerW = Math.max(30, cw * 0.24);
    const benchX = x0 + towerW + 4;
    const benchW = cw - towerW * 2 - 8;
    const benchY = y0 + bodyH - 22;
    const tvW = Math.max(46, benchW * 0.78);
    const tvH = 34;
    const tvX = benchX + (benchW - tvW) / 2;
    const tvY = benchY - tvH - 12;

    const renderTower = (tx: number, key: string) => (
      <g key={key}>
        <rect
          x={tx}
          y={y0}
          width={towerW}
          height={bodyH}
          rx="2"
          stroke="#E2E8F0"
          strokeWidth="1.6"
          fill={isGlass ? "rgba(15,23,42,0.72)" : "rgba(148,163,184,0.12)"}
        />
        {hasLed && (
          <line x1={tx + 3} y1={y0 + 3.5} x2={tx + towerW - 3} y2={y0 + 3.5} stroke="#FBBF24" strokeWidth="2.2" strokeLinecap="round" />
        )}
        {[0.25, 0.47, 0.69].map((ratio, rIdx) => (
          <line
            key={rIdx}
            x1={tx + 4}
            y1={y0 + bodyH * ratio}
            x2={tx + towerW - 4}
            y2={y0 + bodyH * ratio}
            stroke="#94A3B8"
            strokeWidth="1.1"
            opacity={isGlass ? "0.7" : "0.85"}
          />
        ))}
        {isGlass ? (
          <>
            <rect
              x={tx + 2.5}
              y={y0 + 2.5}
              width={towerW - 5}
              height={bodyH - 5}
              rx="1.5"
              stroke="#38BDF8"
              strokeWidth="1.4"
              fill="rgba(56,189,248,0.12)"
            />
            <line x1={tx + 5} y1={y0 + 8} x2={tx + towerW - 5} y2={y0 + bodyH - 10} stroke="#7DD3FC" strokeWidth="1.2" opacity="0.55" />
            <line x1={tx + towerW - 5.5} y1={y0 + bodyH * 0.42} x2={tx + towerW - 5.5} y2={y0 + bodyH * 0.58} stroke="#E2E8F0" strokeWidth="1.8" strokeLinecap="round" />
          </>
        ) : (
          <line x1={tx + towerW - 5} y1={y0 + bodyH * 0.42} x2={tx + towerW - 5} y2={y0 + bodyH * 0.58} stroke="#38BDF8" strokeWidth="1.8" strokeLinecap="round" />
        )}
      </g>
    );

    return (
      <div className="w-full h-[124px] rounded-xl bg-gradient-to-b from-slate-900/85 to-slate-950/90 border border-white/15 p-2 shadow-inner flex items-center justify-center overflow-hidden">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" fill="none">
          <line x1="4" y1={y0 + ch + 2} x2={w - 4} y2={y0 + ch + 2} stroke="rgba(255,255,255,0.16)" strokeWidth="1.2" />
          {renderTower(x0, "lt")}
          {renderTower(x0 + cw - towerW, "rt")}
          {/* Upper floating shelf above TV */}
          <rect x={benchX + 4} y={y0 + 4} width={benchW - 8} height="5" rx="1.2" fill="rgba(148,163,184,0.22)" stroke="#CBD5E1" strokeWidth="1.2" />
          {hasLed && (
            <line x1={benchX + 6} y1={y0 + 10.5} x2={benchX + benchW - 6} y2={y0 + 10.5} stroke="#FBBF24" strokeWidth="2" strokeLinecap="round" />
          )}
          {cardId.includes("vestiyer") ? (
            <g>
              {/* Vestiyer coat hooks & back slat panel */}
              <rect x={benchX + 4} y={y0 + 14} width={benchW - 8} height={benchY - y0 - 20} rx="2" fill="rgba(148,163,184,0.08)" stroke="rgba(203,213,225,0.28)" strokeWidth="1" />
              {[0.25, 0.5, 0.75].map((r, hIdx) => (
                <g key={hIdx}>
                  <circle cx={benchX + benchW * r} cy={y0 + 28} r="2.3" stroke="#38BDF8" strokeWidth="1.3" />
                  <path d={`M ${benchX + benchW * r} ${y0 + 30.5} V ${y0 + 38}`} stroke="#94A3B8" strokeWidth="1.3" strokeLinecap="round" />
                </g>
              ))}
              {/* Seating cushion line on top of bench */}
              <rect x={benchX + 2} y={benchY - 4.5} width={benchW - 4} height="4.5" rx="2" fill="rgba(251,191,36,0.28)" stroke="#FBBF24" strokeWidth="1" />
            </g>
          ) : (
            <g>
              {/* Widescreen TV panel */}
              <rect x={tvX} y={tvY} width={tvW} height={tvH} rx="2.5" fill="rgba(15,23,42,0.92)" stroke="#60A5FA" strokeWidth="1.6" />
              <line x1={tvX + 6} y1={tvY + 6} x2={tvX + tvW * 0.42} y2={tvY + tvH - 6} stroke="#38BDF8" strokeWidth="1.1" opacity="0.35" />
            </g>
          )}
          {/* Low TV bench / media console */}
          <rect x={benchX} y={benchY} width={benchW} height={22} rx="2" fill="rgba(148,163,184,0.18)" stroke="#E2E8F0" strokeWidth="1.5" />
          <line x1={benchX + benchW / 3} y1={benchY} x2={benchX + benchW / 3} y2={benchY + 22} stroke="#CBD5E1" strokeWidth="1.1" />
          <line x1={benchX + (benchW * 2) / 3} y1={benchY} x2={benchX + (benchW * 2) / 3} y2={benchY + 22} stroke="#CBD5E1" strokeWidth="1.1" />
          <line x1={benchX + benchW * 0.12} y1={benchY + 6} x2={benchX + benchW * 0.22} y2={benchY + 6} stroke="#BAE6FD" strokeWidth="1.5" strokeLinecap="round" />
          <line x1={benchX + benchW * 0.45} y1={benchY + 6} x2={benchX + benchW * 0.55} y2={benchY + 6} stroke="#BAE6FD" strokeWidth="1.5" strokeLinecap="round" />
          <line x1={benchX + benchW * 0.78} y1={benchY + 6} x2={benchX + benchW * 0.88} y2={benchY + 6} stroke="#BAE6FD" strokeWidth="1.5" strokeLinecap="round" />
          {/* Plinth */}
          <rect x={x0 + 3} y={y0 + bodyH} width={cw - 6} height={plinthH} rx="1" fill="rgba(148,163,184,0.22)" stroke="#64748B" strokeWidth="1" />
          {isL && renderReturnWing("right")}
          {isU && (
            <>
              {renderReturnWing("left")}
              {renderReturnWing("right")}
            </>
          )}
          {renderMiniPlanBadge()}
        </svg>
      </div>
    );
  }

  // --- WARDROBE & WALK-IN CLOSET ELEVATION ---
  return (
    <div className="w-full h-[124px] rounded-xl bg-gradient-to-b from-slate-900/85 to-slate-950/90 border border-white/15 p-2 shadow-inner flex items-center justify-center overflow-hidden">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" fill="none">
        {/* Floor line */}
        <line x1="4" y1={y0 + ch + 2} x2={w - 4} y2={y0 + ch + 2} stroke="rgba(255,255,255,0.16)" strokeWidth="1.2" />
        {/* Recessed Plinth */}
        <rect x={x0 + 3} y={y0 + bodyH} width={cw - 6} height={plinthH} rx="1.2" fill="rgba(148,163,184,0.22)" stroke="#64748B" strokeWidth="1" />
        {/* Main Carcass Shell */}
        <rect
          x={x0}
          y={y0}
          width={cw}
          height={bodyH}
          rx="3"
          stroke={isWalkin ? "#93C5FD" : "#E2E8F0"}
          strokeWidth="1.8"
          fill={isGlass ? "rgba(15,23,42,0.72)" : isWalkin ? "rgba(56,189,248,0.06)" : "rgba(148,163,184,0.10)"}
        />
        {/* Warm Top LED Strip */}
        {hasLed && (
          <line
            x1={x0 + 4}
            y1={y0 + 4}
            x2={x0 + cw - 4}
            y2={y0 + 4}
            stroke="#FBBF24"
            strokeWidth="2.8"
            strokeLinecap="round"
            opacity="0.95"
          />
        )}
        {Array.from({ length: bays }).map((_, idx) => {
          const bx = x0 + idx * bw;
          return (
            <g key={idx}>
              {idx > 0 && (
                <line x1={bx} y1={y0} x2={bx} y2={y0 + bodyH} stroke="#CBD5E1" strokeWidth="1.4" opacity="0.75" />
              )}
              {isSliding ? (
                <>
                  <rect
                    x={bx + 3.5}
                    y={y0 + 3.5}
                    width={bw - 7}
                    height={bodyH - 7}
                    rx="2"
                    stroke="#93C5FD"
                    strokeWidth="1.4"
                    fill="rgba(148,163,184,0.16)"
                  />
                  <line x1={bx + bw - 8} y1={y0 + bodyH * 0.32} x2={bx + bw - 8} y2={y0 + bodyH * 0.68} stroke="#38BDF8" strokeWidth="2.2" strokeLinecap="round" />
                  <path
                    d={`M ${bx + bw * 0.28} ${y0 + bodyH * 0.5} H ${bx + bw * 0.64} M ${bx + bw * 0.35} ${y0 + bodyH * 0.44} L ${bx + bw * 0.28} ${y0 + bodyH * 0.5} L ${bx + bw * 0.35} ${y0 + bodyH * 0.56} M ${bx + bw * 0.57} ${y0 + bodyH * 0.44} L ${bx + bw * 0.64} ${y0 + bodyH * 0.5} L ${bx + bw * 0.57} ${y0 + bodyH * 0.56}`}
                    stroke="#7DD3FC"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.85"
                  />
                </>
              ) : isDrawerHeavy ? (
                <>
                  <line x1={bx + 4} y1={y0 + 18} x2={bx + bw - 4} y2={y0 + 18} stroke="#CBD5E1" strokeWidth="1.4" />
                  <line x1={bx + 4} y1={y0 + 32} x2={bx + bw - 4} y2={y0 + 32} stroke="#CBD5E1" strokeWidth="1.4" />
                  <line x1={bx + 4} y1={y0 + 46} x2={bx + bw - 4} y2={y0 + 46} stroke="#CBD5E1" strokeWidth="1.4" />
                  <rect x={bx + 4} y={y0 + 53} width={bw - 8} height="13" rx="1.8" stroke="#60A5FA" strokeWidth="1.4" fill="rgba(56,189,248,0.18)" />
                  <line x1={bx + bw * 0.35} y1={y0 + 59.5} x2={bx + bw * 0.65} y2={y0 + 59.5} stroke="#BAE6FD" strokeWidth="1.6" strokeLinecap="round" />
                  <rect x={bx + 4} y={y0 + 69} width={bw - 8} height="13" rx="1.8" stroke="#60A5FA" strokeWidth="1.4" fill="rgba(56,189,248,0.18)" />
                  <line x1={bx + bw * 0.35} y1={y0 + 75.5} x2={bx + bw * 0.65} y2={y0 + 75.5} stroke="#BAE6FD" strokeWidth="1.6" strokeLinecap="round" />
                </>
              ) : isHangingHeavy ? (
                <>
                  <line x1={bx + 4} y1={y0 + 16} x2={bx + bw - 4} y2={y0 + 16} stroke="#CBD5E1" strokeWidth="1.4" />
                  <line x1={bx + 5} y1={y0 + 26} x2={bx + bw - 5} y2={y0 + 26} stroke="#38BDF8" strokeWidth="2.2" strokeLinecap="round" />
                  <path
                    d={`M ${bx + bw * 0.5} ${y0 + 26} L ${bx + bw * 0.28} ${y0 + 38} H ${bx + bw * 0.72} Z`}
                    stroke="#E2E8F0"
                    strokeWidth="1.2"
                    opacity="0.9"
                  />
                  <line x1={bx + bw * 0.38} y1={y0 + 38} x2={bx + bw * 0.38} y2={y0 + 68} stroke="#94A3B8" strokeWidth="1.1" opacity="0.65" />
                  <line x1={bx + bw * 0.62} y1={y0 + 38} x2={bx + bw * 0.62} y2={y0 + 68} stroke="#94A3B8" strokeWidth="1.1" opacity="0.65" />
                </>
              ) : (
                <>
                  <line x1={bx + 4} y1={y0 + 16} x2={bx + bw - 4} y2={y0 + 16} stroke="#CBD5E1" strokeWidth="1.4" />
                  {idx % 2 === 0 ? (
                    <>
                      <line x1={bx + 5} y1={y0 + 26} x2={bx + bw - 5} y2={y0 + 26} stroke="#38BDF8" strokeWidth="2.2" strokeLinecap="round" />
                      <path
                        d={`M ${bx + bw * 0.5} ${y0 + 26} L ${bx + bw * 0.28} ${y0 + 37} H ${bx + bw * 0.72} Z`}
                        stroke="#E2E8F0"
                        strokeWidth="1.2"
                        opacity="0.9"
                      />
                    </>
                  ) : (
                    <>
                      <line x1={bx + 4} y1={y0 + 31} x2={bx + bw - 4} y2={y0 + 31} stroke="#CBD5E1" strokeWidth="1.35" />
                      <line x1={bx + 4} y1={y0 + 44} x2={bx + bw - 4} y2={y0 + 44} stroke="#CBD5E1" strokeWidth="1.35" />
                      {addJewelryTray && (
                        <rect
                          x={bx + 4}
                          y={y0 + 52}
                          width={bw - 8}
                          height="8"
                          rx="1.4"
                          stroke="#FBBF24"
                          strokeWidth="1.2"
                          fill="rgba(251,191,36,0.22)"
                        />
                      )}
                    </>
                  )}
                  <rect x={bx + 4} y={y0 + 64} width={bw - 8} height="16" rx="2" stroke="#94A3B8" strokeWidth="1.4" fill="rgba(148,163,184,0.20)" />
                  <line x1={bx + bw * 0.35} y1={y0 + 72} x2={bx + bw * 0.65} y2={y0 + 72} stroke="#E2E8F0" strokeWidth="1.6" strokeLinecap="round" />
                </>
              )}
              {/* Framed Smoked Glass Door Overlay */}
              {isGlass && (
                <g>
                  <rect
                    x={bx + 2.5}
                    y={y0 + 2.5}
                    width={bw - 5}
                    height={bodyH - 5}
                    rx="1.8"
                    stroke="#64748B"
                    strokeWidth="2.2"
                    fill="rgba(15,23,42,0.34)"
                  />
                  <rect
                    x={bx + 4.5}
                    y={y0 + 4.5}
                    width={bw - 9}
                    height={bodyH - 9}
                    rx="1"
                    stroke="rgba(125,211,252,0.55)"
                    strokeWidth="0.9"
                    fill="rgba(56,189,248,0.09)"
                  />
                  {/* Glass specular reflection */}
                  <line x1={bx + 7} y1={y0 + 10} x2={bx + bw - 9} y2={y0 + 36} stroke="#BAE6FD" strokeWidth="1.4" opacity="0.45" />
                  <line x1={bx + 8} y1={y0 + 24} x2={bx + bw - 8} y2={y0 + 56} stroke="#7DD3FC" strokeWidth="1" opacity="0.30" />
                  {/* Vertical handle on framed glass door */}
                  <line
                    x1={idx % 2 === 0 ? bx + bw - 6.5 : bx + 6.5}
                    y1={y0 + bodyH * 0.42}
                    x2={idx % 2 === 0 ? bx + bw - 6.5 : bx + 6.5}
                    y2={y0 + bodyH * 0.58}
                    stroke="#E2E8F0"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </g>
              )}
            </g>
          );
        })}
        {/* Walk-in boutique center jewelry island cue */}
        {isWalkin && addJewelryTray && (
          <g>
            <rect
              x={x0 + cw * 0.30}
              y={y0 + bodyH - 16}
              width={cw * 0.40}
              height="18"
              rx="2.5"
              fill="rgba(15,23,42,0.92)"
              stroke="#FBBF24"
              strokeWidth="1.4"
            />
            <line
              x1={x0 + cw * 0.34}
              y1={y0 + bodyH - 11}
              x2={x0 + cw * 0.66}
              y2={y0 + bodyH - 11}
              stroke="#7DD3FC"
              strokeWidth="1.2"
              opacity="0.75"
            />
            <line
              x1={x0 + cw * 0.44}
              y1={y0 + bodyH - 5}
              x2={x0 + cw * 0.56}
              y2={y0 + bodyH - 5}
              stroke="#E2E8F0"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </g>
        )}
        {isL && renderReturnWing("right")}
        {isU && (
          <>
            {renderReturnWing("left")}
            {renderReturnWing("right")}
          </>
        )}
        {renderMiniPlanBadge()}
      </svg>
    </div>
  );
};

export const GuidedSetupModal: React.FC<GuidedSetupModalProps> = React.memo(
  ({ isOpen, project, materials, onClose, onApply }) => {
    const [spaceCategory, setSpaceCategory] =
      useState<GuidedSetupWizardPayload["spaceCategory"]>("wardrobe");
    const [roomShape, setRoomShape] =
      useState<GuidedSetupWizardPayload["roomShape"]>("rectangular");
    const [wallWidthCm, setWallWidthCm] = useState(240);
    const [heightCm, setHeightCm] = useState(240);
    const [depthCm, setDepthCm] = useState(60);
    const [wallWidthInput, setWallWidthInput] = useState("240");
    const [heightInput, setHeightInput] = useState("240");
    const [depthInput, setDepthInput] = useState("60");
    const [interiorFocus, setInteriorFocus] =
      useState<GuidedSetupWizardPayload["interiorFocus"]>("balanced");
    const [doorStyle, setDoorStyle] =
      useState<GuidedSetupWizardPayload["doorStyle"]>("hinged");
    const [swatchId, setSwatchId] = useState<string>(materials[0]?.id || "mat_veneer_oak");
    const [addLed, setAddLed] = useState(true);
    const [addTrouserRack, setAddTrouserRack] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [kitchenGripSystem, setKitchenGripSystem] = useState<NonNullable<GuidedSetupWizardPayload["kitchenGripSystem"]>>("gola_profile");
    const [kitchenWallOpening, setKitchenWallOpening] = useState<NonNullable<GuidedSetupWizardPayload["kitchenWallOpening"]>>("lift_bi_fold");
    const dispatchApplySmooth = (payload: GuidedSetupWizardPayload) => {
      onClose();
      if (typeof window !== "undefined") {
        window.setTimeout(() => {
          React.startTransition(() => {
            onApply(payload);
          });
        }, 24);
      } else {
        onApply(payload);
      }
    };

    const baseProj = useMemo(() => project || createInitialProject(), [project]);

    const starterProposals = useMemo(() => {
      if (!isOpen) return [];
      return generateSmartStarterTemplates(baseProj, {
        spaceCategory,
        roomShape,
        wallWidthMm: Math.round(wallWidthCm * 10),
        targetHeightMm: Math.round(heightCm * 10),
        targetDepthMm: Math.round(depthCm * 10),
        colorSwatchId: swatchId,
      });
    }, [isOpen, baseProj, spaceCategory, roomShape, wallWidthCm, heightCm, depthCm, swatchId]);

    if (!isOpen) return null;

    const topSwatches = materials.slice(0, 8);
    const isSlidingAllowed =
      spaceCategory !== "kitchen" && spaceCategory !== "walkin" && wallWidthCm >= 130;

    const fmtEur = (val: number) =>
      new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      }).format(Math.max(0, val || 0));

    return (
      <div
        data-testid="v11-guided-setup-modal"
        className="fixed inset-0 z-[152] bg-[#141413]/50 backdrop-blur-xs flex items-center justify-center p-0 md:p-5"
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-2xl max-h-[92dvh] flex flex-col birim-ice-modal rounded-[28px] max-md:rounded-none max-md:h-[100dvh] max-md:max-h-[100dvh] overflow-hidden text-[#141413]"
        >
          <div className="px-6 py-4 birim-ice-shell-header flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-2xl bg-[#141413] text-[#D6C7B2] flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-base font-bold">Akıllı Dolap &amp; Mekân Kurulumu</h2>
                <p className="text-xs text-[#78716C]">
                  Ölçünüzü girin, hazır akıllı şablonlardan birini tek tıkla uygulayın veya özelleştirin
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-[#EFECE4] flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6 space-y-5 max-h-[76dvh] overflow-y-auto text-xs">
            {/* 1. Mekân Tipi ve Oda Formu */}
            <div className="space-y-2.5">
              <div className="font-bold text-[#141413]">1. Mekân Türü ve Plan Tipi</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(
                  [
                    { id: "wardrobe", label: "Gardırop" },
                    { id: "walkin", label: "Giyinme Odası" },
                    { id: "kitchen", label: "Mutfak" },
                    { id: "living", label: "Vestiyer / TV" },
                  ] as const
                ).map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setSpaceCategory(cat.id);
                      if (cat.id === "walkin") setDoorStyle("open");
                      else if (cat.id === "kitchen") {
                        setDoorStyle("hinged");
                        setHeightCm(87);
                        setHeightInput("87");
                        setShowAdvanced(true);
                      } else {
                        if (heightCm < 180) { setHeightCm(240); setHeightInput("240"); }
                        if (doorStyle === "open") setDoorStyle("hinged");
                      }
                    }}
                    className={`py-2.5 px-2 rounded-2xl font-semibold border transition cursor-pointer flex flex-col items-center justify-center ${
                      spaceCategory === cat.id
                        ? "bg-[#141413] text-white border-[#141413]"
                        : "bg-white hover:bg-[#F5F2EA] border-[#E5DFD3]"
                    }`}
                  >
                    {renderRoomCategoryArt(cat.id, spaceCategory === cat.id)}
                    <span>{cat.label}</span>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1">
                {(
                  [
                    { id: "rectangular", label: "Düz Duvar (I-Tipi)" },
                    { id: "l_shape", label: "L-Tipi Köşe" },
                    { id: "u_shape", label: "U-Tipi Üç Duvar" },
                  ] as const
                ).map((sh) => (
                  <button
                    key={sh.id}
                    type="button"
                    onClick={() => setRoomShape(sh.id)}
                    className={`py-2 px-2.5 rounded-xl font-semibold border transition cursor-pointer flex items-center justify-center gap-2 ${
                      roomShape === sh.id
                        ? "bg-[#EFECE4] text-[#141413] border-[#141413]"
                        : "bg-white border-[#E5DFD3] text-[#57534E]"
                    }`}
                  >
                    {renderRoomShapePlanArt(sh.id, roomShape === sh.id)}
                    <span className="truncate">{sh.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Ölçüler */}
            <div className="p-4 rounded-2xl bg-white border border-[#E5DFD3] grid grid-cols-3 gap-3 sm:gap-4">
              <label className="space-y-1.5">
                <span className="font-semibold text-[#57534E] block">Genişlik (cm)</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={wallWidthInput}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/[^0-9]/g, "").slice(0, 3);
                    setWallWidthInput(clean);
                    if (clean !== "") {
                      const n = Number(clean);
                      if (Number.isFinite(n) && n >= 120 && n <= 600) {
                        setWallWidthCm(n);
                        if (n < 130 && doorStyle === "sliding") setDoorStyle("hinged");
                      }
                    }
                  }}
                  onBlur={() => {
                    const n = Number(wallWidthInput);
                    const clamped = Number.isFinite(n) && wallWidthInput !== "" ? Math.max(120, Math.min(600, n)) : 240;
                    setWallWidthCm(clamped);
                    setWallWidthInput(String(clamped));
                    if (clamped < 130 && doorStyle === "sliding") setDoorStyle("hinged");
                  }}
                  className="w-full h-10 px-3 rounded-xl bg-[#FAF8F4] border border-[#DED8CC] font-mono font-bold text-sm"
                />
              </label>
              <label className="space-y-1.5">
                <span className="font-semibold text-[#57534E] block">Yükseklik (cm)</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={heightInput}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/[^0-9]/g, "").slice(0, 3);
                    setHeightInput(clean);
                    const minH = spaceCategory === "kitchen" ? 80 : 180;
                    if (clean !== "") {
                      const n = Number(clean);
                      if (Number.isFinite(n) && n >= minH && n <= 290) {
                        setHeightCm(n);
                      }
                    }
                  }}
                  onBlur={() => {
                    const minH = spaceCategory === "kitchen" ? 80 : 180;
                    const fallbackH = spaceCategory === "kitchen" ? 87 : 240;
                    const n = Number(heightInput);
                    const clamped = Number.isFinite(n) && heightInput !== "" ? Math.max(minH, Math.min(290, n)) : fallbackH;
                    setHeightCm(clamped);
                    setHeightInput(String(clamped));
                  }}
                  className="w-full h-10 px-3 rounded-xl bg-[#FAF8F4] border border-[#DED8CC] font-mono font-bold text-sm"
                />
              </label>
              <label className="space-y-1.5">
                <span className="font-semibold text-[#57534E] block">Derinlik (cm)</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={depthInput}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/[^0-9]/g, "").slice(0, 3);
                    setDepthInput(clean);
                    const minD = doorStyle === "sliding" ? 60 : 45;
                    if (clean !== "") {
                      const n = Number(clean);
                      if (Number.isFinite(n) && n >= minD && n <= 70) {
                        setDepthCm(n);
                      }
                    }
                  }}
                  onBlur={() => {
                    const minD = doorStyle === "sliding" ? 60 : 45;
                    const n = Number(depthInput);
                    const clamped = Number.isFinite(n) && depthInput !== "" ? Math.max(minD, Math.min(70, n)) : 60;
                    setDepthCm(clamped);
                    setDepthInput(String(clamped));
                  }}
                  className="w-full h-10 px-3 rounded-xl bg-[#FAF8F4] border border-[#DED8CC] font-mono font-bold text-sm"
                />
              </label>
            </div>

            {/* 3. ÖZELLİK #2: Ölçüye Uygun 4 Hazır Akıllı Başlangıç Tasarımı */}
            <div className="space-y-2.5" data-testid="v12-smart-starter-cards">
              <div className="flex items-center justify-between">
                <div className="font-bold text-[#141413]">
                  2. Ölçünüze Uygun Hazır Akıllı Tasarımlar ({wallWidthCm}×{heightCm} cm)
                </div>
                <span className="text-[10.5px] font-semibold text-[#8C7A6B]">
                  Tek tıkla sahneye uygula
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {starterProposals.map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    data-testid={`v12-starter-card-${card.id}`}
                    onClick={() => dispatchApplySmooth(card.payload)}
                    className="group p-3.5 rounded-2xl bg-white hover:bg-[#FAF7F0] border border-[#E5DFD3] hover:border-[#141413] text-left transition flex flex-col justify-between gap-2.5 cursor-pointer shadow-2xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2 py-0.5 rounded-full bg-[#EFECE4] text-[#6B4F28] text-[10px] font-bold">
                          {card.badge}
                        </span>
                        <span className="font-mono font-bold text-xs text-[#141413]">
                          {fmtEur(card.estimatedTotalWithVatEur)}
                        </span>
                      </div>
                      {renderStarterElevationArt(card.id, card.payload, card.bayCount)}
                      <div className="font-bold text-[12.5px] text-[#141413] group-hover:underline pt-1">
                        {card.title}
                      </div>
                      <p className="text-[11px] text-[#78716C] leading-snug">{card.subtitle}</p>
                    </div>

                    <div className="pt-2 border-t border-[#F0ECE3] flex items-center justify-between text-[10.5px] text-[#57534E]">
                      <span>
                        {card.moduleCount} Ünite • {card.bayCount} Bölme • {card.shelfCount} Raf
                        {card.drawerCount > 0 ? ` • ${card.drawerCount} Çekmece` : ""}
                      </span>
                      <span className="inline-flex items-center gap-1 font-bold text-[#141413]">
                        <span>Seç</span>
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Yüzey Kartelası */}
            <div className="space-y-2.5">
              <div className="font-bold text-[#141413]">3. Yüzey Kartelası</div>
              <div className="grid grid-cols-4 gap-2">
                {topSwatches.map((m) => {
                  const sel = swatchId === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSwatchId(m.id)}
                      className={`p-2 rounded-2xl border text-left transition cursor-pointer ${
                        sel
                          ? "bg-white border-[#141413] ring-2 ring-[#141413]/15"
                          : "bg-white border-[#E5DFD3]"
                      }`}
                    >
                      <div
                        className="h-14 rounded-xl border border-white/15 shadow-inner relative mb-1.5 overflow-hidden"
                        style={{ backgroundColor: m.colorHex, backgroundImage: "linear-gradient(135deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 55%, rgba(0,0,0,0.16) 100%)" }}
                      >
                        {sel && (
                          <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#141413] text-white flex items-center justify-center">
                            <Check className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </div>
                      <div className="text-[10.5px] font-semibold truncate">{m.name}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 5. İsteğe Bağlı İnce Özelleştirme */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="text-[11px] font-bold text-[#6B4F28] hover:underline cursor-pointer"
              >
                {showAdvanced
                  ? "▾ Kapak ve İç Aksesuar Özelleştirmesini Gizle"
                  : "▸ Kapak Tipi, LED ve İç Aksesuarları Kendim Seçmek İstiyorum"}
              </button>

              {showAdvanced && (
                <div className="mt-3 space-y-4 p-4 rounded-2xl bg-white/80 border border-[#E5DFD3]">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="font-bold text-[#141413]">Kapak Tercihi</div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {(
                          [
                            { id: "hinged", label: "Menteşeli", disabled: spaceCategory === "walkin" },
                            { id: "sliding", label: "Sürgülü", disabled: !isSlidingAllowed },
                            { id: "glass", label: "Füme Cam", disabled: spaceCategory === "walkin" },
                            { id: "open", label: "Kapaksız Açık", disabled: spaceCategory === "kitchen" },
                          ] as const
                        ).map((ds) => (
                          <button
                            key={ds.id}
                            type="button"
                            disabled={ds.disabled}
                            onClick={() => {
                              setDoorStyle(ds.id);
                              if (ds.id === "sliding" && depthCm < 60) setDepthCm(60);
                            }}
                            className={`py-2 px-2 rounded-xl font-semibold border transition cursor-pointer disabled:opacity-35 disabled:pointer-events-none ${
                              doorStyle === ds.id
                                ? "bg-[#141413] text-white border-[#141413]"
                                : "bg-white border-[#E5DFD3]"
                            }`}
                          >
                            {ds.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="font-bold text-[#141413]">İç Kullanım Ağırlığı</div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(
                          [
                            { id: "balanced", label: "Dengeli" },
                            { id: "hanging", label: "Askı" },
                            { id: "shelves", label: "Raf & Çekmece" },
                          ] as const
                        ).map((inf) => (
                          <button
                            key={inf.id}
                            type="button"
                            onClick={() => setInteriorFocus(inf.id)}
                            className={`py-2 px-1.5 rounded-xl font-semibold border transition cursor-pointer ${
                              interiorFocus === inf.id
                                ? "bg-[#141413] text-white border-[#141413]"
                                : "bg-white border-[#E5DFD3]"
                            }`}
                          >
                            {inf.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {spaceCategory === "kitchen" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#EFEAE0]">
                      <div className="space-y-2">
                        <div className="font-bold text-[#141413]">Kulpsuz / Tutamak Sistemi (Alt &amp; Üst)</div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {(
                            [
                              { id: "gola_profile", label: "Alüminyum Gola (L/C)" },
                              { id: "gola_melamine_box", label: "Melamin Gola Kutusu" },
                              { id: "bevel_backing", label: "30°/45° Pah + Arka Bant" },
                              { id: "j_pull", label: "CNC J-Kulp (22 mm Lake)" },
                              { id: "bar_handle", label: "Klasik Kulp" },
                              { id: "push_to_open", label: "Bas-Aç (TIP-ON)" },
                            ] as const
                          ).map((g) => (
                            <button
                              key={g.id}
                              type="button"
                              onClick={() => setKitchenGripSystem(g.id)}
                              className={`py-2 px-2 rounded-xl font-semibold border transition cursor-pointer ${
                                kitchenGripSystem === g.id
                                  ? "bg-[#141413] text-white border-[#141413]"
                                  : "bg-white border-[#E5DFD3]"
                              }`}
                            >
                              {g.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="font-bold text-[#141413]">Üst Dolap Açılım Sistemi</div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {(
                            [
                              { id: "lift_bi_fold", label: "AVENTOS HF (Katlanır)" },
                              { id: "lift_up_stay", label: "AVENTOS HK (Tek Kalkar)" },
                              { id: "lift_parallel", label: "AVENTOS HL (Paralel)" },
                              { id: "hinged", label: "Standart Menteşeli" },
                            ] as const
                          ).map((w) => (
                            <button
                              key={w.id}
                              type="button"
                              onClick={() => setKitchenWallOpening(w.id)}
                              className={`py-2 px-2 rounded-xl font-semibold border transition cursor-pointer ${
                                kitchenWallOpening === w.id
                                  ? "bg-[#141413] text-white border-[#141413]"
                                  : "bg-white border-[#E5DFD3]"
                              }`}
                            >
                              {w.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {spaceCategory !== "kitchen" && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setAddLed((v) => !v)}
                        className={`px-3.5 py-2 rounded-full font-semibold border transition cursor-pointer ${
                          addLed
                            ? "bg-[#141413] text-white border-[#141413]"
                            : "bg-white border-[#E5DFD3]"
                        }`}
                      >
                        {addLed ? "✓ İç LED Aydınlatma Dahil" : "+ İç LED Aydınlatma Ekle"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setAddTrouserRack((v) => !v)}
                        className={`px-3.5 py-2 rounded-full font-semibold border transition cursor-pointer ${
                          addTrouserRack
                            ? "bg-[#141413] text-white border-[#141413]"
                            : "bg-white border-[#E5DFD3]"
                        }`}
                      >
                        {addTrouserRack ? "✓ Teleskopik Pantolonluk Dahil" : "+ Pantolonluk Ekle"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="px-6 py-4 bg-[#F3EFE6] border-t border-[#E6E1D6] flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-full hover:bg-white/80 font-semibold text-xs text-[#57534E] cursor-pointer"
            >
              Vazgeç
            </button>
            <button
              type="button"
              onClick={() =>
                dispatchApplySmooth({
                  spaceCategory,
                  roomShape,
                  wallWidthMm: Math.round(wallWidthCm * 10),
                  targetHeightMm: Math.round(heightCm * 10),
                  targetDepthMm: Math.round(
                    (doorStyle === "sliding" ? Math.max(60, depthCm) : depthCm) * 10
                  ),
                  autoFiller50Mm: true,
                  interiorFocus,
                  doorStyle,
                  conceptTier: "smart",
                  colorSwatchId: swatchId,
                  addLed,
                  addTrouserRack,
                  addJewelryTray: false,
                  kitchenGripSystem: spaceCategory === "kitchen" ? kitchenGripSystem : undefined,
                  kitchenWallOpening: spaceCategory === "kitchen" ? kitchenWallOpening : undefined,
                })
              }
              className="h-10 px-6 rounded-full bg-[#141413] hover:bg-[#292524] text-white font-semibold text-xs shadow-sm cursor-pointer"
            >
              Özel Seçimle Oluştur
            </button>
          </div>
        </div>
      </div>
    );
  }
);

GuidedSetupModal.displayName = "GuidedSetupModal";
