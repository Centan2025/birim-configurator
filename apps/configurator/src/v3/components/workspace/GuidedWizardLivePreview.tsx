"use client";

import React, { useState } from "react";
import { Eye, Layers, Sparkles } from "lucide-react";

export interface WizardSwatchVisual {
  id: "cashmere" | "white" | "oak" | "walnut" | "anthracite";
  name: string;
  sub: string;
  hex: string;
  borderHex: string;
  interiorHex: string;
  hasWoodGrain?: boolean;
}

export interface GuidedWizardLivePreviewProps {
  step: 1 | 2 | 3 | 4;
  spaceCategory: "wardrobe" | "walkin" | "kitchen" | "living";
  roomShape: "rectangular" | "l_shape" | "u_shape";
  wallWidthMm: number;
  targetHeightMm: number;
  targetDepthMm: number;
  autoFiller50Mm: boolean;
  interiorFocus: "hanging" | "balanced" | "shelves";
  doorStyle: "hinged" | "sliding" | "glass" | "open";
  activeSwatch: WizardSwatchVisual;
  addLed: boolean;
  addTrouserRack: boolean;
  addJewelryTray: boolean;
}

export const GuidedWizardLivePreview: React.FC<GuidedWizardLivePreviewProps> = ({
  step,
  spaceCategory,
  roomShape,
  wallWidthMm,
  targetHeightMm,
  targetDepthMm,
  autoFiller50Mm,
  interiorFocus,
  doorStyle,
  activeSwatch,
  addLed,
  addTrouserRack,
  addJewelryTray,
}) => {
  const [viewCutawayMode, setViewCutawayMode] = useState<"split" | "interior" | "exterior">(
    "split"
  );

  // Force interior visibility when user is actively editing interior on Step 3 unless they explicitly picked exterior
  const effectiveMode =
    doorStyle === "open"
      ? "interior"
      : viewCutawayMode === "split" && step === 3
      ? "split"
      : viewCutawayMode;

  const safeWallW = Math.max(1200, Math.min(5200, wallWidthMm));
  const fillerMm = autoFiller50Mm && safeWallW >= 1400 ? 50 : 0;
  const usableSpanMm = Math.max(800, safeWallW - fillerMm * 2);

  const mainModCount =
    usableSpanMm < 1300 ? 1 : usableSpanMm < 2200 ? 2 : usableSpanMm < 3300 ? 3 : 4;
  const returnWingCount = roomShape === "u_shape" ? 2 : roomShape === "l_shape" ? 1 : 0;
  const totalModCount = mainModCount + returnWingCount;

  const baseModW = Math.floor(usableSpanMm / mainModCount / 10) * 10;
  const lastModW = usableSpanMm - baseModW * (mainModCount - 1);

  // Proportional Architectural Elevation Mapping inside 400 x 236 SVG canvas
  // Reference max wall = 5200mm -> 308px; min 1200mm -> 136px so width slider visibly grows/shrinks!
  const wallDrawW = Math.round(136 + ((safeWallW - 1200) / 4000) * 172);
  const wallStartX = Math.round((392 - wallDrawW) / 2);
  const floorY = 198;
  const ceilingY = 22;
  const fullRoomHeightPx = floorY - ceilingY; // represents 2750 mm ceiling

  const effectiveCabHeightMm =
    spaceCategory === "kitchen"
      ? 900
      : Math.max(1800, Math.min(2680, targetHeightMm));

  const cabHeightPx = Math.round((effectiveCabHeightMm / 2750) * fullRoomHeightPx);
  const cabTopY = floorY - cabHeightPx;
  const plinthPx = spaceCategory === "kitchen" ? 7 : 8;
  const bodyHeightPx = cabHeightPx - plinthPx;

  const fillerPx = fillerMm > 0 ? Math.max(5, Math.round((fillerMm / safeWallW) * wallDrawW)) : 0;
  const modulesSpanPx = Math.max(80, wallDrawW - fillerPx * 2);
  const modulesStartX = wallStartX + fillerPx;

  const isWood =
    activeSwatch.id === "oak" ||
    activeSwatch.id === "walnut" ||
    Boolean(activeSwatch.hasWoodGrain);
  const isDarkDoor = activeSwatch.id === "anthracite" || activeSwatch.id === "walnut";
  const handleStroke = isDarkDoor ? "#D6C7B2" : "#292524";

  const renderBayInterior = (
    bx: number,
    by: number,
    bw: number,
    bh: number,
    bayIdx: number,
    isFirstModule: boolean
  ) => {
    const pad = 2.5;
    const ix = bx + pad;
    const iw = Math.max(12, bw - pad * 2);

    if (spaceCategory === "kitchen") {
      // Kitchen base interior: shelves or 3-drawer stack
      return (
        <g>
          <rect x={ix} y={by + 2} width={iw} height={bh - 4} fill={activeSwatch.interiorHex} />
          <line
            x1={ix}
            y1={by + bh * 0.5}
            x2={ix + iw}
            y2={by + bh * 0.5}
            stroke={activeSwatch.borderHex}
            strokeWidth="1.3"
          />
        </g>
      );
    }

    const showHangingHere =
      interiorFocus === "hanging" || (interiorFocus === "balanced" && bayIdx === 0);
    const showDrawersHere =
      (interiorFocus === "balanced" && bayIdx > 0) ||
      (interiorFocus === "shelves" && bayIdx === 0);

    const topShelfY = by + Math.max(14, bh * 0.16);
    const railY = topShelfY + 7;

    return (
      <g>
        {/* Warm Interior Backboard */}
        <rect
          x={ix}
          y={by + 1.5}
          width={iw}
          height={bh - 3}
          rx="1"
          fill={activeSwatch.interiorHex}
        />

        {/* 3000K Recessed Vertical & Top LED Glow */}
        {addLed && (
          <>
            <line
              x1={ix + 2}
              y1={by + 3}
              x2={ix + iw - 2}
              y2={by + 3}
              stroke="#F59E0B"
              strokeWidth="2.4"
            />
            <line
              x1={ix + 1.5}
              y1={by + 4}
              x2={ix + 1.5}
              y2={by + bh - 4}
              stroke="#FCD34D"
              strokeWidth="1.6"
              strokeOpacity="0.85"
            />
          </>
        )}

        {/* Top Luggage Shelf */}
        <line
          x1={ix}
          y1={topShelfY}
          x2={ix + iw}
          y2={topShelfY}
          stroke={activeSwatch.borderHex}
          strokeWidth="1.6"
        />

        {showHangingHere ? (
          <>
            {/* Chrome Hanging Bar */}
            <line
              x1={ix + 2}
              y1={railY}
              x2={ix + iw - 2}
              y2={railY}
              stroke="#57534E"
              strokeWidth="1.8"
            />
            {/* Hanging Garment Silhouettes */}
            {Array.from({ length: Math.max(2, Math.min(5, Math.floor(iw / 8))) }).map(
              (_, gIdx, arr) => {
                const gx = ix + 4 + (gIdx * (iw - 11)) / Math.max(1, arr.length - 1);
                const gh =
                  addTrouserRack && isFirstModule && bayIdx === 0
                    ? bh * 0.36
                    : gIdx % 2 === 0
                    ? bh * 0.48
                    : bh * 0.4;
                return (
                  <rect
                    key={gIdx}
                    x={gx}
                    y={railY + 2}
                    width="4.2"
                    height={Math.max(14, gh)}
                    rx="1.5"
                    fill={gIdx % 2 === 0 ? "#D6CFC4" : "#C2B8A8"}
                    stroke="#8C7A6B"
                    strokeWidth="0.6"
                  />
                );
              }
            )}

            {/* Telescopic Trouser Rack (Raylı Pantolonluk) */}
            {addTrouserRack && isFirstModule && bayIdx === 0 && (
              <g>
                <line
                  x1={ix + 1}
                  y1={by + bh * 0.64}
                  x2={ix + iw - 1}
                  y2={by + bh * 0.64}
                  stroke="#44403C"
                  strokeWidth="1.8"
                />
                {[0.22, 0.48, 0.74].map((ratio, tIdx) => (
                  <rect
                    key={tIdx}
                    x={ix + iw * ratio}
                    y={by + bh * 0.65}
                    width={Math.max(3, iw * 0.16)}
                    height={bh * 0.24}
                    rx="1"
                    fill="#94A3B8"
                    fillOpacity="0.75"
                  />
                ))}
              </g>
            )}
          </>
        ) : (
          /* Multi-Shelf Stack */
          <>
            {[0.34, 0.52, 0.68].map((ratio, sIdx) => {
              if (showDrawersHere && ratio > 0.62) return null;
              const sy = by + bh * ratio;
              return (
                <g key={sIdx}>
                  <line
                    x1={ix}
                    y1={sy}
                    x2={ix + iw}
                    y2={sy}
                    stroke={activeSwatch.borderHex}
                    strokeWidth="1.4"
                  />
                  {/* Folded Knitwear Stack */}
                  <rect
                    x={ix + iw * 0.18}
                    y={sy - 6}
                    width={iw * 0.64}
                    height="5"
                    rx="1"
                    fill="#DFD9CE"
                  />
                </g>
              );
            })}
          </>
        )}

        {/* Velvet Jewelry Tray (Kadife Takı Çekmecesi) */}
        {addJewelryTray && isFirstModule && (bayIdx === 1 || bw > 48) && (
          <g>
            <rect
              x={ix + 1}
              y={by + bh * 0.66}
              width={iw - 2}
              height="6.5"
              rx="1"
              fill="#C7B299"
              stroke="#785A37"
              strokeWidth="0.9"
            />
            <line
              x1={ix + iw * 0.35}
              y1={by + bh * 0.66}
              x2={ix + iw * 0.35}
              y2={by + bh * 0.66 + 6.5}
              stroke="#785A37"
              strokeWidth="0.7"
            />
            <line
              x1={ix + iw * 0.68}
              y1={by + bh * 0.66}
              x2={ix + iw * 0.68}
              y2={by + bh * 0.66 + 6.5}
              stroke="#785A37"
              strokeWidth="0.7"
            />
          </g>
        )}

        {/* Bottom Drawers */}
        {showDrawersHere && (
          <g>
            {[0, 1].map((dIdx) => {
              const dh = Math.max(9, bh * 0.12);
              const dy = by + bh - (dIdx + 1) * (dh + 1.5) - 1;
              return (
                <g key={dIdx}>
                  <rect
                    x={ix + 0.5}
                    y={dy}
                    width={iw - 1}
                    height={dh}
                    rx="1"
                    fill={activeSwatch.hex}
                    stroke={activeSwatch.borderHex}
                    strokeWidth="1"
                  />
                  <line
                    x1={ix + iw * 0.35}
                    y1={dy + dh * 0.5}
                    x2={ix + iw * 0.65}
                    y2={dy + dh * 0.5}
                    stroke={handleStroke}
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />
                </g>
              );
            })}
          </g>
        )}
      </g>
    );
  };

  const renderModuleDoorFace = (mx: number, my: number, mw: number, mh: number) => {
    if (doorStyle === "sliding") {
      // Sliding Door System: Top & Bottom Aluminum Tracks + Overlapping Panels + Arrows
      const halfW = mw / 2;
      return (
        <g>
          {/* Left Rear Sliding Leaf */}
          <rect
            x={mx + 1.5}
            y={my + 3}
            width={halfW + 2}
            height={mh - 6}
            fill={activeSwatch.hex}
            stroke={activeSwatch.borderHex}
            strokeWidth="1.2"
          />
          {/* Right Front Overlapping Sliding Leaf */}
          <rect
            x={mx + halfW - 2}
            y={my + 2}
            width={halfW + 0.5}
            height={mh - 4}
            fill={activeSwatch.hex}
            stroke="#141413"
            strokeWidth="1.3"
          />
          {isWood && (
            <line
              x1={mx + halfW + 6}
              y1={my + 6}
              x2={mx + halfW + 6}
              y2={my + mh - 6}
              stroke={activeSwatch.borderHex}
              strokeOpacity="0.35"
              strokeWidth="1"
            />
          )}
          {/* Top & Bottom Sliding Rails */}
          <rect x={mx + 1} y={my} width={mw - 2} height="3" fill="#57534E" />
          <rect x={mx + 1} y={my + mh - 3} width={mw - 2} height="3" fill="#57534E" />
          {/* Recessed Vertical Edge Profile Handle */}
          <line
            x1={mx + halfW + 1.5}
            y1={my + mh * 0.34}
            x2={mx + halfW + 1.5}
            y2={my + mh * 0.64}
            stroke={handleStroke}
            strokeWidth="1.8"
          />
          {/* Sliding Direction Arrows */}
          <path
            d={`M ${mx + halfW * 0.35} ${my + mh * 0.5} L ${mx + halfW * 0.65} ${my + mh * 0.5}`}
            stroke={handleStroke}
            strokeWidth="1.1"
            strokeOpacity="0.65"
          />
          <path
            d={`M ${mx + halfW + halfW * 0.35} ${my + mh * 0.54} L ${mx + halfW + halfW * 0.65} ${my + mh * 0.54}`}
            stroke={handleStroke}
            strokeWidth="1.1"
            strokeOpacity="0.65"
          />
        </g>
      );
    }

    if (doorStyle === "glass") {
      // Smoked Glass Aluminum-Framed Vitrine Doors (Translucent over interior!)
      const halfW = mw / 2;
      return (
        <g>
          {[0, 1].map((leafIdx) => {
            const lx = mx + 1.5 + leafIdx * (halfW - 0.75);
            const lw = halfW - 1.5;
            return (
              <g key={leafIdx}>
                <rect
                  x={lx}
                  y={my + 1.5}
                  width={lw}
                  height={mh - 3}
                  rx="1"
                  fill="rgba(28, 25, 23, 0.24)"
                  stroke="#292524"
                  strokeWidth="1.8"
                />
                {/* Glass Diagonal Reflection */}
                <line
                  x1={lx + 3}
                  y1={my + mh * 0.22}
                  x2={lx + lw - 3}
                  y2={my + mh * 0.08}
                  stroke="#FFFFFF"
                  strokeOpacity="0.55"
                  strokeWidth="1.3"
                />
              </g>
            );
          })}
          {/* Slim Anodized Handles */}
          <line
            x1={mx + halfW - 3.5}
            y1={my + mh * 0.42}
            x2={mx + halfW - 3.5}
            y2={my + mh * 0.58}
            stroke="#141413"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <line
            x1={mx + halfW + 3.5}
            y1={my + mh * 0.42}
            x2={mx + halfW + 3.5}
            y2={my + mh * 0.58}
            stroke="#141413"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </g>
      );
    }

    // Default Hinged Doors (Menteşeli 90° Frenli Kapak)
    const halfW = mw / 2;
    return (
      <g>
        <rect
          x={mx + 1}
          y={my + 1}
          width={mw - 2}
          height={mh - 2}
          rx="1.5"
          fill={activeSwatch.hex}
          stroke={activeSwatch.borderHex}
          strokeWidth="1.4"
        />
        {isWood && (
          <>
            <line
              x1={mx + mw * 0.24}
              y1={my + 4}
              x2={mx + mw * 0.24}
              y2={my + mh - 4}
              stroke={activeSwatch.borderHex}
              strokeOpacity="0.3"
              strokeWidth="0.9"
            />
            <line
              x1={mx + mw * 0.76}
              y1={my + 4}
              x2={mx + mw * 0.76}
              y2={my + mh - 4}
              stroke={activeSwatch.borderHex}
              strokeOpacity="0.3"
              strokeWidth="0.9"
            />
          </>
        )}
        {/* Center 2mm Reveal Seam */}
        <line
          x1={mx + halfW}
          y1={my + 1.5}
          x2={mx + halfW}
          y2={my + mh - 1.5}
          stroke={activeSwatch.borderHex}
          strokeWidth="1.2"
        />
        {/* Subtle Architectural Opening Swing Dashed Lines */}
        <polyline
          points={`${mx + 2},${my + 4} ${mx + halfW - 2},${my + mh * 0.5} ${mx + 2},${my + mh - 4}`}
          fill="none"
          stroke={activeSwatch.borderHex}
          strokeWidth="0.7"
          strokeDasharray="2.5 2.5"
          opacity="0.55"
        />
        <polyline
          points={`${mx + mw - 2},${my + 4} ${mx + halfW + 2},${my + mh * 0.5} ${mx + mw - 2},${my + mh - 4}`}
          fill="none"
          stroke={activeSwatch.borderHex}
          strokeWidth="0.7"
          strokeDasharray="2.5 2.5"
          opacity="0.55"
        />
        {/* Minimalist Architectural Linear Handles */}
        <line
          x1={mx + halfW - 4}
          y1={my + mh * 0.43}
          x2={mx + halfW - 4}
          y2={my + mh * 0.57}
          stroke={handleStroke}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <line
          x1={mx + halfW + 4}
          y1={my + mh * 0.43}
          x2={mx + halfW + 4}
          y2={my + mh * 0.57}
          stroke={handleStroke}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </g>
    );
  };

  return (
    <div className="space-y-2.5">
      {/* Top Header + Interactive View Toggle + Mini Top-Down Plan */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-[#141413]">Canlı Mimari Önizleme</span>
          <span className="px-2 py-0.5 rounded-md bg-[#EFECE5] text-[#44403C] text-[10px] font-mono font-semibold border border-[#DED8CC]">
            {totalModCount} Modül • D:{targetDepthMm / 10}cm
          </span>
        </div>

        {doorStyle !== "open" && spaceCategory !== "kitchen" && (
          <div className="inline-flex rounded-lg bg-[#EFECE5] p-0.5 border border-[#E4DFD5] text-[10px] font-semibold">
            {[
              { id: "split" as const, label: "Yarı Kesit" },
              { id: "interior" as const, label: "İç Düzen" },
              { id: "exterior" as const, label: "Dış Kapak" },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setViewCutawayMode(m.id)}
                className={`px-2 py-0.5 rounded-md transition cursor-pointer ${
                  viewCutawayMode === m.id
                    ? "bg-[#141413] text-white"
                    : "text-[#57534E] hover:text-[#141413]"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Proportional Elevation + Room Shape Canvas */}
      <div
        data-testid="wizard-live-svg-preview"
        className="bg-[#FAF9F6] rounded-xl border border-[#DED8CC] p-2.5 relative overflow-hidden"
      >
        {/* Top-Right Mini Architectural Plan (I / L / U Duvar Şekli) */}
        <div className="absolute right-2.5 top-2.5 z-10 bg-white/95 backdrop-blur-xs rounded-lg border border-[#DED8CC] px-2 py-1 shadow-2xs flex items-center gap-2">
          <svg viewBox="0 0 56 38" className="w-11 h-7 shrink-0">
            {/* Main Back Wall */}
            <rect x="8" y="5" width="40" height="6" rx="1" fill="#141413" />
            {/* Left Return Wing (L or U) */}
            {(roomShape === "l_shape" || roomShape === "u_shape") && (
              <>
                <rect x="8" y="11" width="7" height="22" rx="1" fill="#8C7A6B" />
                {/* 50mm Corner Filler Safe Joint */}
                <rect x="8" y="11" width="7" height="4" fill="#2E6F40" />
              </>
            )}
            {/* Right Return Wing (U) */}
            {roomShape === "u_shape" && (
              <>
                <rect x="41" y="11" width="7" height="22" rx="1" fill="#8C7A6B" />
                <rect x="41" y="11" width="7" height="4" fill="#2E6F40" />
              </>
            )}
          </svg>
          <div className="leading-tight">
            <div className="text-[9px] font-bold uppercase tracking-wider text-[#78716C]">
              Üst Plan
            </div>
            <div className="text-[10px] font-bold text-[#141413]">
              {roomShape === "rectangular"
                ? "Düz (I)"
                : roomShape === "l_shape"
                ? "L Köşe"
                : "U Oda"}
            </div>
          </div>
        </div>

        <svg viewBox="0 0 400 232" className="w-full h-48 block select-none">
          {/* Room Ceiling & Floor Architectural Reference Lines */}
          <line
            x1="14"
            y1={ceilingY}
            x2="386"
            y2={ceilingY}
            stroke="#D6D1C7"
            strokeWidth="1"
            strokeDasharray="4 3"
          />
          <text
            x="18"
            y={ceilingY - 4}
            fill="#8C7A6B"
            fontSize="8.5"
            fontFamily="monospace"
            fontWeight="600"
          >
            TAVAN (275 cm)
          </text>

          {/* Back Architectural Wall Surface */}
          <rect
            x={wallStartX}
            y={ceilingY}
            width={wallDrawW}
            height={fullRoomHeightPx}
            fill="#EFECE5"
            stroke="#D6D1C7"
            strokeWidth="1.2"
          />

          {/* L-Shape / U-Shape Perspective Side Return Wings */}
          {(roomShape === "l_shape" || roomShape === "u_shape") && (
            <g>
              <polygon
                points={`${wallStartX - 18},${cabTopY + 12} ${wallStartX},${cabTopY} ${wallStartX},${floorY} ${wallStartX - 18},${floorY + 12}`}
                fill={activeSwatch.hex}
                stroke={activeSwatch.borderHex}
                strokeWidth="1.3"
                opacity="0.92"
              />
              <line
                x1={wallStartX - 9}
                y1={cabTopY + 6}
                x2={wallStartX - 9}
                y2={floorY + 6}
                stroke={activeSwatch.borderHex}
                strokeWidth="0.9"
                strokeDasharray="2 2"
              />
            </g>
          )}
          {roomShape === "u_shape" && (
            <g>
              <polygon
                points={`${wallStartX + wallDrawW},${cabTopY} ${wallStartX + wallDrawW + 18},${cabTopY + 12} ${wallStartX + wallDrawW + 18},${floorY + 12} ${wallStartX + wallDrawW},${floorY}`}
                fill={activeSwatch.hex}
                stroke={activeSwatch.borderHex}
                strokeWidth="1.3"
                opacity="0.92"
              />
            </g>
          )}

          {/* Floor Line */}
          <line x1="12" y1={floorY} x2="388" y2={floorY} stroke="#8C7A6B" strokeWidth="1.5" />

          {/* Left & Right 5 cm Blind Filler Strips (Kör Çıta) */}
          {fillerPx > 0 && (
            <>
              <rect
                x={wallStartX}
                y={cabTopY}
                width={fillerPx}
                height={cabHeightPx}
                fill="#DED8CC"
                stroke="#8C7A6B"
                strokeWidth="0.9"
              />
              <rect
                x={wallStartX + wallDrawW - fillerPx}
                y={cabTopY}
                width={fillerPx}
                height={cabHeightPx}
                fill="#DED8CC"
                stroke="#8C7A6B"
                strokeWidth="0.9"
              />
            </>
          )}

          {/* SPECIAL CASE A: KITCHEN SYSTEM (Base + Countertop + Sink/Hob + Upper Wall Units) */}
          {spaceCategory === "kitchen" ? (
            <g>
              {(() => {
                const baseH = 58;
                const baseY = floorY - baseH - plinthPx;
                const upperH = 48;
                const upperY = baseY - 38 - upperH;
                const unitPx = modulesSpanPx / mainModCount;

                return (
                  <>
                    {/* Plinth */}
                    <rect
                      x={modulesStartX}
                      y={floorY - plinthPx}
                      width={modulesSpanPx}
                      height={plinthPx}
                      fill="#44403C"
                    />
                    {/* Base Modules */}
                    {Array.from({ length: mainModCount }).map((_, mIdx) => {
                      const mx = modulesStartX + mIdx * unitPx;
                      const isDrawerMod = mIdx === 1 || (mainModCount === 1 && interiorFocus === "shelves");
                      return (
                        <g key={`kb_${mIdx}`}>
                          <rect
                            x={mx + 0.8}
                            y={baseY}
                            width={unitPx - 1.6}
                            height={baseH}
                            fill={activeSwatch.hex}
                            stroke={activeSwatch.borderHex}
                            strokeWidth="1.3"
                          />
                          {isDrawerMod ? (
                            <>
                              <line
                                x1={mx + 1}
                                y1={baseY + baseH * 0.28}
                                x2={mx + unitPx - 1}
                                y2={baseY + baseH * 0.28}
                                stroke={activeSwatch.borderHex}
                                strokeWidth="1.1"
                              />
                              <line
                                x1={mx + 1}
                                y1={baseY + baseH * 0.64}
                                x2={mx + unitPx - 1}
                                y2={baseY + baseH * 0.64}
                                stroke={activeSwatch.borderHex}
                                strokeWidth="1.1"
                              />
                              {[0.14, 0.46, 0.82].map((ry, rI) => (
                                <line
                                  key={rI}
                                  x1={mx + unitPx * 0.36}
                                  y1={baseY + baseH * ry}
                                  x2={mx + unitPx * 0.64}
                                  y2={baseY + baseH * ry}
                                  stroke={handleStroke}
                                  strokeWidth="1.4"
                                  strokeLinecap="round"
                                />
                              ))}
                            </>
                          ) : (
                            renderModuleDoorFace(mx, baseY, unitPx, baseH)
                          )}
                        </g>
                      );
                    })}

                    {/* Quartz Countertop Slab */}
                    <rect
                      x={modulesStartX - 1}
                      y={baseY - 4}
                      width={modulesSpanPx + 2}
                      height="4"
                      rx="1"
                      fill="#FAF9F6"
                      stroke="#57534E"
                      strokeWidth="1.2"
                    />

                    {/* Sink & Mixer Faucet on Module 0 */}
                    <path
                      d={`M ${modulesStartX + unitPx * 0.5} ${baseY - 4} L ${modulesStartX + unitPx * 0.5} ${baseY - 15} Q ${modulesStartX + unitPx * 0.58} ${baseY - 19} ${modulesStartX + unitPx * 0.58} ${baseY - 11}`}
                      fill="none"
                      stroke="#44403C"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />

                    {/* Induction Hob on Module 1 */}
                    {mainModCount >= 2 && (
                      <rect
                        x={modulesStartX + unitPx * 1.22}
                        y={baseY - 5.5}
                        width={unitPx * 0.56}
                        height="2.2"
                        fill="#141413"
                      />
                    )}

                    {/* Upper Wall Cabinets + Under-Cabinet LED */}
                    {Array.from({ length: mainModCount }).map((_, mIdx) => {
                      const mx = modulesStartX + mIdx * unitPx;
                      return (
                        <g key={`kw_${mIdx}`}>
                          <rect
                            x={mx + 0.8}
                            y={upperY}
                            width={unitPx - 1.6}
                            height={upperH}
                            fill={
                              doorStyle === "glass" || doorStyle === "open"
                                ? activeSwatch.interiorHex
                                : activeSwatch.hex
                            }
                            stroke={activeSwatch.borderHex}
                            strokeWidth="1.3"
                          />
                          {doorStyle !== "open" &&
                            renderModuleDoorFace(mx, upperY, unitPx, upperH)}
                          {addLed && (
                            <line
                              x1={mx + 3}
                              y1={upperY + upperH + 1.5}
                              x2={mx + unitPx - 3}
                              y2={upperY + upperH + 1.5}
                              stroke="#F59E0B"
                              strokeWidth="2.4"
                            />
                          )}
                        </g>
                      );
                    })}
                  </>
                );
              })()}
            </g>
          ) : spaceCategory === "living" ? (
            /* SPECIAL CASE B: LIVING ROOM TV & VITRINE SYSTEM */
            <g>
              {(() => {
                const towerW = Math.max(32, modulesSpanPx * 0.24);
                const centerW = Math.max(48, modulesSpanPx - towerW * 2);
                const centerX = modulesStartX + towerW;
                const lowConsoleH = 42;
                const lowConsoleY = floorY - plinthPx - lowConsoleH;
                return (
                  <>
                    <rect
                      x={modulesStartX}
                      y={floorY - plinthPx}
                      width={modulesSpanPx}
                      height={plinthPx}
                      fill={activeSwatch.borderHex}
                    />
                    {/* Left Bookcase / Vitrine Tower */}
                    <rect
                      x={modulesStartX}
                      y={cabTopY}
                      width={towerW - 1}
                      height={bodyHeightPx}
                      fill={activeSwatch.interiorHex}
                      stroke={activeSwatch.borderHex}
                      strokeWidth="1.4"
                    />
                    {renderBayInterior(modulesStartX, cabTopY, towerW - 1, bodyHeightPx, 1, true)}
                    {doorStyle !== "open" && effectiveMode === "exterior" &&
                      renderModuleDoorFace(modulesStartX, cabTopY, towerW - 1, bodyHeightPx)}

                    {/* Center Low Media Console + Architectural TV Screen */}
                    <rect
                      x={centerX + 1}
                      y={lowConsoleY}
                      width={centerW - 2}
                      height={lowConsoleH}
                      fill={activeSwatch.hex}
                      stroke={activeSwatch.borderHex}
                      strokeWidth="1.4"
                    />
                    <line
                      x1={centerX + centerW * 0.5}
                      y1={lowConsoleY + 2}
                      x2={centerX + centerW * 0.5}
                      y2={lowConsoleY + lowConsoleH - 2}
                      stroke={activeSwatch.borderHex}
                      strokeWidth="1.1"
                    />
                    {/* Top Display Bridge Shelf */}
                    <rect
                      x={centerX + 2}
                      y={cabTopY + 12}
                      width={centerW - 4}
                      height="4"
                      fill={activeSwatch.hex}
                      stroke={activeSwatch.borderHex}
                      strokeWidth="1"
                    />
                    {addLed && (
                      <line
                        x1={centerX + 5}
                        y1={cabTopY + 17.5}
                        x2={centerX + centerW - 5}
                        y2={cabTopY + 17.5}
                        stroke="#F59E0B"
                        strokeWidth="2.2"
                      />
                    )}
                    {/* 65" TV Frame Silhouette */}
                    <rect
                      x={centerX + centerW * 0.14}
                      y={cabTopY + 34}
                      width={centerW * 0.72}
                      height={Math.max(36, lowConsoleY - cabTopY - 50)}
                      rx="2"
                      fill="#1C1917"
                      stroke="#44403C"
                      strokeWidth="1.5"
                    />

                    {/* Right Vitrine / Storage Tower */}
                    <rect
                      x={centerX + centerW + 1}
                      y={cabTopY}
                      width={towerW - 1}
                      height={bodyHeightPx}
                      fill={activeSwatch.interiorHex}
                      stroke={activeSwatch.borderHex}
                      strokeWidth="1.4"
                    />
                    {renderBayInterior(
                      centerX + centerW + 1,
                      cabTopY,
                      towerW - 1,
                      bodyHeightPx,
                      1,
                      false
                    )}
                    {doorStyle !== "open" &&
                      renderModuleDoorFace(
                        centerX + centerW + 1,
                        cabTopY,
                        towerW - 1,
                        bodyHeightPx
                      )}
                  </>
                );
              })()}
            </g>
          ) : (
            /* STANDARD WARDROBE & WALK-IN DRESSING SYSTEM */
            <g>
              {/* Continuous Recessed Plinth */}
              <rect
                x={modulesStartX + 1}
                y={floorY - plinthPx}
                width={modulesSpanPx - 2}
                height={plinthPx}
                fill={activeSwatch.borderHex}
              />

              {Array.from({ length: mainModCount }).map((_, mIdx) => {
                const unitPx = modulesSpanPx / mainModCount;
                const mx = modulesStartX + mIdx * unitPx;
                const thisModWMm = mIdx === mainModCount - 1 ? lastModW : baseModW;
                const bayCount = thisModWMm >= 750 ? 2 : 1;
                const bayPx = (unitPx - 2) / bayCount;

                // Determine whether this module shows interior, exterior, or split
                const showInteriorFull =
                  effectiveMode === "interior" ||
                  doorStyle === "open" ||
                  (effectiveMode === "split" && mainModCount > 1 && mIdx === 0);
                const showSplitSingleModule =
                  effectiveMode === "split" && mainModCount === 1 && doorStyle !== "open";

                return (
                  <g key={mIdx}>
                    {/* Outer Module Carcass */}
                    <rect
                      x={mx + 1}
                      y={cabTopY}
                      width={unitPx - 2}
                      height={bodyHeightPx}
                      rx="1.5"
                      fill={activeSwatch.interiorHex}
                      stroke={activeSwatch.borderHex}
                      strokeWidth="1.5"
                    />

                    {/* Per-Module Width Label Above Roof */}
                    <text
                      x={mx + unitPx * 0.5}
                      y={cabTopY - 4}
                      textAnchor="middle"
                      fill="#57534E"
                      fontSize="8.5"
                      fontFamily="monospace"
                      fontWeight="700"
                    >
                      {Math.round(thisModWMm / 10)}cm
                    </text>

                    {/* Render Interior Bays (always visible under glass, open, full interior, or split cutaway!) */}
                    {Array.from({ length: bayCount }).map((__, bIdx) => {
                      const bx = mx + 1 + bIdx * bayPx;
                      return (
                        <g key={bIdx}>
                          {bIdx > 0 && (
                            <line
                              x1={bx}
                              y1={cabTopY + 1}
                              x2={bx}
                              y2={cabTopY + bodyHeightPx - 1}
                              stroke={activeSwatch.borderHex}
                              strokeWidth="1.2"
                            />
                          )}
                          {(showInteriorFull ||
                            doorStyle === "glass" ||
                            (showSplitSingleModule && bIdx === 0)) &&
                            renderBayInterior(
                              bx,
                              cabTopY,
                              bayPx,
                              bodyHeightPx,
                              bIdx,
                              mIdx === 0
                            )}
                        </g>
                      );
                    })}

                    {/* Render Exterior Door System when applicable */}
                    {!showInteriorFull && !showSplitSingleModule && (
                      renderModuleDoorFace(mx + 1, cabTopY, unitPx - 2, bodyHeightPx)
                    )}

                    {/* Single-Module Split Mode: Right Half Shows Exact Chosen Door Leaf */}
                    {showSplitSingleModule && (
                      <g>
                        {renderModuleDoorFace(
                          mx + 1 + (unitPx - 2) * 0.5,
                          cabTopY,
                          (unitPx - 2) * 0.5,
                          bodyHeightPx
                        )}
                      </g>
                    )}
                  </g>
                );
              })}
            </g>
          )}

          {/* Right-Side Live Vertical Height Dimension Line */}
          <g>
            <line
              x1={wallStartX + wallDrawW + (roomShape === "u_shape" ? 24 : 10)}
              y1={cabTopY}
              x2={wallStartX + wallDrawW + (roomShape === "u_shape" ? 24 : 10)}
              y2={floorY}
              stroke="#141413"
              strokeWidth="1.2"
            />
            <line
              x1={wallStartX + wallDrawW + (roomShape === "u_shape" ? 21 : 7)}
              y1={cabTopY}
              x2={wallStartX + wallDrawW + (roomShape === "u_shape" ? 27 : 13)}
              y2={cabTopY}
              stroke="#141413"
              strokeWidth="1.2"
            />
            <line
              x1={wallStartX + wallDrawW + (roomShape === "u_shape" ? 21 : 7)}
              y1={floorY}
              x2={wallStartX + wallDrawW + (roomShape === "u_shape" ? 27 : 13)}
              y2={floorY}
              stroke="#141413"
              strokeWidth="1.2"
            />
            <rect
              x={Math.min(352, wallStartX + wallDrawW + (roomShape === "u_shape" ? 16 : 4))}
              y={(cabTopY + floorY) * 0.5 - 8}
              width="42"
              height="16"
              rx="4"
              fill="#141413"
            />
            <text
              x={Math.min(352, wallStartX + wallDrawW + (roomShape === "u_shape" ? 16 : 4)) + 21}
              y={(cabTopY + floorY) * 0.5 + 3}
              textAnchor="middle"
              fill="#FAF9F6"
              fontSize="8.5"
              fontFamily="monospace"
              fontWeight="700"
            >
              {Math.round(effectiveCabHeightMm / 10)}cm
            </text>
          </g>

          {/* Bottom Total Wall Span Dimension Bar */}
          <line
            x1={wallStartX}
            y1="214"
            x2={wallStartX + wallDrawW}
            y2="214"
            stroke="#141413"
            strokeWidth="1.3"
          />
          <line x1={wallStartX} y1="210" x2={wallStartX} y2="218" stroke="#141413" strokeWidth="1.3" />
          <line
            x1={wallStartX + wallDrawW}
            y1="210"
            x2={wallStartX + wallDrawW}
            y2="218"
            stroke="#141413"
            strokeWidth="1.3"
          />
          <rect x="122" y="205" width="156" height="18" rx="5" fill="#141413" />
          <text
            x="200"
            y="217"
            textAnchor="middle"
            fill="#FAF9F6"
            fontSize="9.5"
            fontWeight="700"
            fontFamily="monospace"
          >
            {safeWallW / 10} cm • {totalModCount} Modül{fillerMm > 0 ? " (+2×5cm)" : ""}
          </text>
        </svg>

        {/* Active Configuration Live Status Chips */}
        <div className="mt-2 pt-2 border-t border-[#E4DFD5] flex flex-wrap items-center gap-1 text-[10px]">
          <span className="px-2 py-0.5 rounded-md bg-white border border-[#DED8CC] font-semibold text-[#141413]">
            {doorStyle === "hinged"
              ? "Menteşeli 90°"
              : doorStyle === "sliding"
              ? "Raylı Sürme"
              : doorStyle === "glass"
              ? "Füme Cam Vitrin"
              : "Açık Walk-In"}
          </span>
          <span className="px-2 py-0.5 rounded-md bg-white border border-[#DED8CC] font-semibold text-[#44403C]">
            {interiorFocus === "hanging"
              ? "Bol Askılı"
              : interiorFocus === "balanced"
              ? "Dengeli Aile"
              : "Bol Raflı"}
          </span>
          {addLed && (
            <span className="px-2 py-0.5 rounded-md bg-[#FDF8EE] border border-[#E6D2AE] font-semibold text-[#78531E]">
              3000K LED
            </span>
          )}
          {addTrouserRack && (
            <span className="px-2 py-0.5 rounded-md bg-white border border-[#DED8CC] font-semibold text-[#44403C]">
              Pantolonluk
            </span>
          )}
          {addJewelryTray && (
            <span className="px-2 py-0.5 rounded-md bg-white border border-[#DED8CC] font-semibold text-[#44403C]">
              Takı Çekmecesi
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
