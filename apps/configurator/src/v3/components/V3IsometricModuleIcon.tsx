"use client";

import React, { useMemo } from "react";
import { ModuleInstance, DEFAULT_MATERIALS, calculateBayWidths } from "@birim/core";
import { V4ModuleTemplateDefinition } from "@birim/catalog";

export interface V3IsometricModuleIconProps {
  module?: ModuleInstance;
  template?: V4ModuleTemplateDefinition;
  presetLayout?: "linear_kitchen" | "l_kitchen";
  bayCount?: number;
  widthMm?: number;
  heightMm?: number;
  depthMm?: number;
  hasDrawers?: boolean;
  isOpenFront?: boolean;
  doorColorHex?: string;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  testId?: string;
}

/**
 * High-resolution (viewBox 160x128) architectural 3D isometric CAD illustration for furniture modules.
 * Uses clean thin technical linework, 3D depth shading, bay-by-bay cutaway (open left bay showing
 * interior shelves/rails/drawers, closed right bay showing door leaf & handle — zero overlapping lines),
 * and dedicated multi-cabinet scenes for Linear Kitchen and L-Kitchen presets.
 */
export const V3IsometricModuleIcon: React.FC<V3IsometricModuleIconProps> = React.memo(
  ({
    module: propModule,
    template,
    presetLayout,
    bayCount: propBayCount,
    widthMm: propW,
    heightMm: propH,
    depthMm: propD,
    hasDrawers: propDrawers,
    isOpenFront: propOpen,
    doorColorHex: propColor,
    size = "md",
    testId,
  }) => {
    const resolvedModule = useMemo<ModuleInstance | undefined>(() => {
      if (propModule) return propModule;
      if (template) {
        return template.createInstance(`preview_${template.templateId}`);
      }
      return undefined;
    }, [propModule, template]);

    const dimClass =
      size === "sm"
        ? "w-11 h-9"
        : size === "md"
        ? "w-16 h-14"
        : size === "lg"
        ? "w-28 h-22"
        : size === "xl"
        ? "w-36 h-28"
        : "w-48 h-36";

    // 1. DEDICATED MULTI-MODULE ILLUSTRATION FOR LINEAR KITCHEN (3.2m)
    if (presetLayout === "linear_kitchen") {
      return (
        <svg
          viewBox="0 0 160 128"
          data-testid={testId}
          className={`${dimClass} shrink-0 overflow-visible`}
          aria-hidden="true"
        >
          {/* Floor shadow */}
          <polygon points="14,108 148,108 156,98 24,98" fill="#1c1917" opacity="0.1" />
          {/* Tall Oven/Fridge Tower (Left) */}
          <polygon points="18,24 28,16 50,16 40,24" fill="#f5f5f4" stroke="#292524" strokeWidth="1.2" />
          <rect x="18" y="24" width="22" height="82" fill="#9caf88" stroke="#292524" strokeWidth="1.3" />
          {/* Built-in Oven & Microwave in Tower */}
          <rect x="20.5" y="42" width="17" height="11" rx="1" fill="#1e293b" stroke="#475569" strokeWidth="1" />
          <rect x="20.5" y="55" width="17" height="18" rx="1" fill="#0f172a" stroke="#475569" strokeWidth="1" />
          <line x1="23" y1="58" x2="35" y2="58" stroke="#f59e0b" strokeWidth="1.2" />

          {/* Base Cabinets Row (Sink + 3-Drawer + Hob Base) */}
          <rect x="40" y="66" width="96" height="40" fill="#9caf88" stroke="#292524" strokeWidth="1.3" />
          <polygon points="136,66 146,58 146,98 136,106" fill="#7a8c68" stroke="#292524" strokeWidth="1.2" />
          {/* Plinth */}
          <rect x="18" y="102" width="118" height="4" fill="#44403c" />
          {/* Vertical module dividers */}
          <line x1="72" y1="66" x2="72" y2="102" stroke="#292524" strokeWidth="1.2" />
          <line x1="104" y1="66" x2="104" y2="102" stroke="#292524" strokeWidth="1.2" />
          {/* Sink Base Double Doors */}
          <line x1="56" y1="66" x2="56" y2="102" stroke="#292524" strokeWidth="1" />
          {/* Middle 3-Drawer Stack */}
          <line x1="72" y1="76" x2="104" y2="76" stroke="#292524" strokeWidth="1" />
          <line x1="72" y1="88" x2="104" y2="88" stroke="#292524" strokeWidth="1" />
          <line x1="84" y1="71" x2="92" y2="71" stroke="#1c1917" strokeWidth="1.3" strokeLinecap="round" />
          <line x1="84" y1="82" x2="92" y2="82" stroke="#1c1917" strokeWidth="1.3" strokeLinecap="round" />
          <line x1="84" y1="95" x2="92" y2="95" stroke="#1c1917" strokeWidth="1.3" strokeLinecap="round" />

          {/* Continuous Quartz Countertop + Backsplash */}
          <polygon points="40,66 50,58 146,58 136,66" fill="#fafaf9" stroke="#292524" strokeWidth="1.3" />
          <polygon points="48,58 48,40 144,40 144,58" fill="#f5f5f4" stroke="#a8a29e" strokeWidth="0.9" />
          {/* Sink Bowl & Faucet */}
          <polygon points="46,64 51,60 66,60 61,64" fill="#94a3b8" stroke="#334155" strokeWidth="1" />
          <path d="M58,60 C58,51 53,51 53,56" fill="none" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" />
          {/* Hob Burners */}
          <ellipse cx="116" cy="62" rx="4.5" ry="2" fill="#0f172a" stroke="#ef4444" strokeWidth="0.9" />
          <ellipse cx="127" cy="62" rx="4.5" ry="2" fill="#0f172a" stroke="#ef4444" strokeWidth="0.9" />

          {/* Upper Wall Cabinets (3 Modules) */}
          <polygon points="44,24 52,18 142,18 134,24" fill="#f5f5f4" stroke="#292524" strokeWidth="1.2" />
          <rect x="44" y="24" width="90" height="22" fill="#e7e5e4" stroke="#292524" strokeWidth="1.3" />
          <polygon points="134,24 142,18 142,40 134,46" fill="#d6d3d1" stroke="#292524" strokeWidth="1.2" />
          <line x1="74" y1="24" x2="74" y2="46" stroke="#292524" strokeWidth="1.1" />
          <line x1="104" y1="24" x2="104" y2="46" stroke="#292524" strokeWidth="1.1" />
          {/* Warm Under-Cabinet LED Glow */}
          <line x1="46" y1="47" x2="132" y2="47" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    }

    // 2. DEDICATED MULTI-MODULE ILLUSTRATION FOR L-SHAPED CORNER KITCHEN (90°)
    if (presetLayout === "l_kitchen") {
      return (
        <svg
          viewBox="0 0 160 128"
          data-testid={testId}
          className={`${dimClass} shrink-0 overflow-visible`}
          aria-hidden="true"
        >
          <polygon points="18,112 146,104 146,72 56,72 18,98" fill="#1c1917" opacity="0.1" />
          {/* Back Main Wall Base Run */}
          <polygon points="48,58 58,50 144,50 134,58" fill="#fafaf9" stroke="#292524" strokeWidth="1.3" />
          <rect x="48" y="58" width="86" height="38" fill="#9caf88" stroke="#292524" strokeWidth="1.3" />
          <polygon points="134,58 144,50 144,88 134,96" fill="#7a8c68" stroke="#292524" strokeWidth="1.2" />
          <line x1="78" y1="58" x2="78" y2="96" stroke="#292524" strokeWidth="1.1" />
          <line x1="106" y1="58" x2="106" y2="96" stroke="#292524" strokeWidth="1.1" />
          <line x1="78" y1="70" x2="106" y2="70" stroke="#292524" strokeWidth="1" />
          <line x1="78" y1="82" x2="106" y2="82" stroke="#292524" strokeWidth="1" />

          {/* 90-Degree Left Return Wing (Isometric Forward Return) */}
          <polygon points="20,78 48,58 66,58 38,78" fill="#fafaf9" stroke="#292524" strokeWidth="1.3" />
          <polygon points="20,78 38,78 38,114 20,114" fill="#849673" stroke="#292524" strokeWidth="1.3" />
          <polygon points="38,78 66,58 66,94 38,114" fill="#9caf88" stroke="#292524" strokeWidth="1.3" />
          <line x1="52" y1="68" x2="52" y2="104" stroke="#292524" strokeWidth="1.1" />
          {/* Sink on Back Run + Cooktop on Return Wing */}
          <polygon points="84,56 88,52 102,52 98,56" fill="#94a3b8" stroke="#334155" strokeWidth="1" />
          <path d="M94,52 C94,44 89,44 89,49" fill="none" stroke="#334155" strokeWidth="1.4" strokeLinecap="round" />
          <ellipse cx="42" cy="68" rx="4.5" ry="2.2" fill="#0f172a" stroke="#ef4444" strokeWidth="0.9" />

          {/* Back Wall Upper Cabinets */}
          <polygon points="52,20 60,14 142,14 134,20" fill="#f5f5f4" stroke="#292524" strokeWidth="1.2" />
          <rect x="52" y="20" width="82" height="20" fill="#e7e5e4" stroke="#292524" strokeWidth="1.3" />
          <polygon points="134,20 142,14 142,34 134,40" fill="#d6d3d1" stroke="#292524" strokeWidth="1.2" />
          <line x1="80" y1="20" x2="80" y2="40" stroke="#292524" strokeWidth="1.1" />
          <line x1="108" y1="20" x2="108" y2="40" stroke="#292524" strokeWidth="1.1" />
        </svg>
      );
    }

    const tplId = (
      resolvedModule?.templateId ||
      template?.templateId ||
      ""
    ).toLowerCase();
    const familyId = resolvedModule?.moduleFamilyId || template?.familyId;
    const compRole =
      resolvedModule?.complementaryRole || template?.complementaryRole;
    const isCorner = Boolean(resolvedModule?.isCorner || template?.isCorner);

    const wMm = resolvedModule
      ? resolvedModule.dimensions.width
      : propW || 1200;
    const hMm = resolvedModule
      ? resolvedModule.dimensions.height
      : propH || 2200;
    const dMm = resolvedModule
      ? resolvedModule.dimensions.depth
      : propD || 600;
    const bays = resolvedModule
      ? resolvedModule.bays.length
      : propBayCount || 2;

    const firstDoor = resolvedModule?.bays[0]?.door;
    const doorSystemId =
      firstDoor?.doorSystemId || template?.defaultDoorSystemId || "hinged_double";

    const isOpen = resolvedModule
      ? Boolean(
          resolvedModule.isOpenFront ||
            resolvedModule.bays.every((b) => b.door.type === "open" || b.door.doorSystemId === "open")
        )
      : Boolean(propOpen);

    const matDef = resolvedModule
      ? DEFAULT_MATERIALS.find(
          (m) => m.id === resolvedModule.carcass.doorMaterialId
        )
      : undefined;
    const isGlassDoor =
      resolvedModule?.carcass.doorMaterialId === "mat_smoked_glass" ||
      tplId.includes("glass");
    const frontColor =
      propColor ||
      (isGlassDoor ? "#334155" : matDef?.colorHex) ||
      (familyId?.startsWith("fam_kitchen") ? "#9caf88" : "#c5a075");

    // 3. COMPLEMENTARY PARTS (Countertop, Plinth, Filler, LED, Feet)
    if (familyId === "fam_complementary" || compRole) {
      return (
        <svg
          viewBox="0 0 160 128"
          data-testid={testId}
          className={`${dimClass} shrink-0 overflow-visible`}
          aria-hidden="true"
        >
          {compRole === "leveling_feet" ? (
            <g>
              {[38, 66, 94, 122].map((lx, idx) => (
                <g key={idx}>
                  <rect x={lx - 5} y={38} width={10} height={42} rx={2} fill="#374151" stroke="#111827" strokeWidth="1.5" />
                  <ellipse cx={lx} cy={84} rx={12} ry={5} fill="#1f2937" stroke="#111827" strokeWidth="1.5" />
                </g>
              ))}
            </g>
          ) : compRole === "led_channel" ? (
            <g>
              <polygon points="24,78 124,42 134,52 34,88" fill="#fef08a" stroke="#ca8a04" strokeWidth="1.5" />
              <line x1="28" y1="82" x2="128" y2="46" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" />
            </g>
          ) : (
            <g>
              <polygon points="22,64 44,44 138,44 116,64" fill="#f5f5f4" stroke="#292524" strokeWidth="1.5" />
              <rect x="22" y="64" width="94" height="16" fill={frontColor} stroke="#292524" strokeWidth="1.5" />
              <polygon points="116,64 138,44 138,60 116,80" fill="#d6d3d1" stroke="#292524" strokeWidth="1.5" />
            </g>
          )}
        </svg>
      );
    }

    // 4. STANDARD & SPECIAL CABINET GEOMETRY IN 160x128 VIEWBOX
    const isWallCab = familyId === "fam_kitchen_wall";
    const isBaseCab =
      familyId === "fam_kitchen_base" || tplId.includes("island");

    const normW = Math.max(
      52,
      Math.min(112, Math.round(48 + (wMm / 2400) * 64))
    );
    const normH = isWallCab
      ? Math.max(42, Math.min(62, Math.round((hMm / 900) * 54)))
      : isBaseCab
      ? 68
      : Math.max(76, Math.min(96, Math.round((hMm / 2400) * 92)));
    const isoDx = Math.max(14, Math.min(24, Math.round((dMm / 650) * 20)));
    const isoDy = Math.round(isoDx * 0.55);

    const x0 = Math.round((160 - (normW + isoDx)) / 2);
    const y0 = isWallCab
      ? 26
      : Math.round((122 - (normH + isoDy)) / 2) + isoDy;

    const topPoints = `${x0},${y0} ${x0 + isoDx},${y0 - isoDy} ${
      x0 + normW + isoDx
    },${y0 - isoDy} ${x0 + normW},${y0}`;

    const sidePoints = `${x0 + normW},${y0} ${x0 + normW + isoDx},${
      y0 - isoDy
    } ${x0 + normW + isoDx},${y0 + normH - isoDy} ${x0 + normW},${y0 + normH}`;

    const isSink = tplId.includes("sink");
    const isCooktop = tplId.includes("cooktop");
    const isOvenBase = tplId.includes("kb_09_oven");
    const isOvenTower =
      tplId.includes("oven_tower") || tplId.includes("oven_microwave");
    const isMicrowaveWall = tplId.includes("microwave_wall");
    const isHood = tplId.includes("hood");
    const isFridge = tplId.includes("fridge");
    const isSliding =
      doorSystemId.startsWith("sliding") || tplId.includes("sliding");
    const isLift = doorSystemId.startsWith("lift_");

    const plinthPx = isWallCab ? 0 : 6;
    const usableH = normH - plinthPx;
    const bayWidthsMm = resolvedModule
      ? calculateBayWidths(resolvedModule)
      : Array.from({ length: bays }, () => wMm / bays);
    const totalBayW = Math.max(1, bayWidthsMm.reduce((s, w) => s + w, 0));

    return (
      <svg
        viewBox="0 0 160 128"
        data-testid={testId}
        className={`${dimClass} shrink-0 overflow-visible`}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="iso_top_grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#ebe7df" />
          </linearGradient>
          <linearGradient id="iso_side_grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#dfd9ce" />
            <stop offset="100%" stopColor="#b8b0a2" />
          </linearGradient>
          <linearGradient id="iso_cavity_grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ede4d3" />
            <stop offset="100%" stopColor="#fcf9f2" />
          </linearGradient>
        </defs>
        {/* Soft Multi-Layer Studio Floor Shadow */}
        <polygon
          points={`${x0 + 2},${y0 + normH + 6} ${x0 + normW + isoDx + 8},${
            y0 + normH - isoDy + 6
          } ${x0 + normW + 4},${y0 + normH + 12} ${x0 - 6},${y0 + normH + 12}`}
          fill="#0c0a09"
          opacity={isWallCab ? 0.04 : 0.08}
        />
        <polygon
          points={`${x0 + 4},${y0 + normH + 4} ${x0 + normW + isoDx + 4},${
            y0 + normH - isoDy + 4
          } ${x0 + normW + 2},${y0 + normH + 8} ${x0 - 2},${y0 + normH + 8}`}
          fill="#1c1917"
          opacity={isWallCab ? 0.07 : 0.14}
        />

        {/* Top 3D Face with Studio Gradient */}
        <polygon
          points={topPoints}
          fill="url(#iso_top_grad)"
          stroke="#292524"
          strokeWidth="1.45"
          strokeLinejoin="round"
        />

        {/* Right Side 3D Face with Depth Gradient */}
        <polygon
          points={sidePoints}
          fill="url(#iso_side_grad)"
          stroke="#292524"
          strokeWidth="1.45"
          strokeLinejoin="round"
        />

        {/* L-Corner 90-Degree Forward Return Wing */}
        {isCorner && (
          <g>
            <polygon
              points={`${x0 - 16},${y0 + 12} ${x0},${y0} ${x0 + 22},${y0} ${x0 + 6},${y0 + 12}`}
              fill="#fafaf9"
              stroke="#292524"
              strokeWidth="1.3"
            />
            <polygon
              points={`${x0 - 16},${y0 + 12} ${x0 + 6},${y0 + 12} ${x0 + 6},${y0 + normH + 10} ${x0 - 16},${y0 + normH + 10}`}
              fill={frontColor}
              stroke="#292524"
              strokeWidth="1.3"
            />
          </g>
        )}

        {/* Outer Carcass Frame Background with Interior Studio Gradient */}
        <rect
          x={x0}
          y={y0}
          width={normW}
          height={usableH}
          fill="url(#iso_cavity_grad)"
          stroke="#292524"
          strokeWidth="1.55"
        />

        {/* Plinth / Baza */}
        {!isWallCab && (
          <rect
            x={x0 + 2}
            y={y0 + usableH}
            width={normW - 4}
            height={plinthPx}
            fill="#44403c"
            stroke="#292524"
            strokeWidth="1.2"
          />
        )}

        {/* Kitchen Countertop Lip */}
        {isBaseCab && (
          <line
            x1={x0 - 1}
            y1={y0}
            x2={x0 + normW + 1}
            y2={y0}
            stroke="#44403c"
            strokeWidth="2.8"
          />
        )}

        {/* Sink Basin & Swan-Neck Faucet on Top Face */}
        {isSink && (
          <g>
            <polygon
              points={`${x0 + 10},${y0 - 2} ${x0 + 16},${y0 - isoDy + 3} ${
                x0 + normW - 8
              },${y0 - isoDy + 3} ${x0 + normW - 14},${y0 - 2}`}
              fill="#94a3b8"
              stroke="#334155"
              strokeWidth="1.2"
            />
            <path
              d={`M ${x0 + normW * 0.55} ${y0 - isoDy + 3} C ${
                x0 + normW * 0.55
              } ${y0 - isoDy - 12}, ${x0 + normW * 0.42} ${
                y0 - isoDy - 12
              }, ${x0 + normW * 0.42} ${y0 - isoDy - 3}`}
              fill="none"
              stroke="#334155"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </g>
        )}

        {/* Cooktop Burners on Top Face */}
        {(isCooktop || isOvenBase) && (
          <g>
            <ellipse
              cx={x0 + normW * 0.36}
              cy={y0 - isoDy * 0.48}
              rx={6}
              ry={2.8}
              fill="#0f172a"
              stroke="#ef4444"
              strokeWidth="1.1"
            />
            <ellipse
              cx={x0 + normW * 0.68}
              cy={y0 - isoDy * 0.48}
              rx={6}
              ry={2.8}
              fill="#0f172a"
              stroke="#ef4444"
              strokeWidth="1.1"
            />
          </g>
        )}

        {/* Per-Bay Clean Architectural Rendering:
            - If module is open OR bayIdx === 0 on a multi-bay module (Cutaway Preview Bay!),
              render the 3D interior cavity (shelves, hanging rail + clothes hangers, internal drawers) with ZERO door clutter on top!
            - On closed bays (or right half of single-bay), render the clean door leaf, hinge markers, and handle! */}
        {(() => {
          let curX = x0;
          return bayWidthsMm.map((bwMm, bIdx) => {
            const bw = (bwMm / totalBayW) * normW;
            const bx0 = curX;
            curX += bw;

            const bayObj = resolvedModule?.bays[bIdx];
            const bayDoorSys = bayObj?.door.doorSystemId || doorSystemId;
            const bayDoorType =
              bayObj?.door.type ||
              (bayDoorSys === "hinged_double" ? "double" : "single_left");

            const bayShelves = bayObj ? bayObj.shelves.length : 2;
            const bayRails = bayObj ? bayObj.hangingRails.length : 0;
            const bayExtDrawers = bayObj
              ? bayObj.drawers.filter((d) => !d.isInternal)
              : propDrawers && bIdx === bays - 1
              ? [
                  { id: "d0", elevationY: 0, height: 180 },
                  { id: "d1", elevationY: 185, height: 180 },
                ]
              : [];
            const bayIntDrawers = bayObj
              ? bayObj.drawers.filter((d) => d.isInternal)
              : [];

            const dCount = Math.min(4, bayExtDrawers.length);
            const hasDoorInBay =
              !isOpen &&
              bayDoorType !== "open" &&
              bayDoorSys !== "open" &&
              !isOvenBase;

            // Never stretch bottom drawers over the full wardrobe height when bay is open!
            const isDrawerOnlyModule =
              dCount > 0 && bayShelves === 0 && bayRails === 0 && isBaseCab;
            const drawerZoneH =
              dCount === 0
                ? 0
                : isDrawerOnlyModule
                ? usableH - 2
                : Math.min(usableH * 0.36, Math.max(12, dCount * 10.5));

            const upperTopY = y0 + 1.5;
            const upperBottomY = y0 + usableH - drawerZoneH;
            const upperH = Math.max(8, upperBottomY - upperTopY);

            // Show interior cleanly on open bays OR on the first bay of a multi-bay wardrobe/cabinet
            const showInteriorInUpperBay =
              !hasDoorInBay ||
              isGlassDoor ||
              (bays >= 2 && bIdx === 0 && (bayShelves > 0 || bayRails > 0 || bayIntDrawers.length > 0));

            return (
              <g key={`bay_${bIdx}`}>
                {/* Vertical Carcass Divider between Bays */}
                {bIdx < bayWidthsMm.length - 1 && (
                  <line
                    x1={bx0 + bw}
                    y1={y0}
                    x2={bx0 + bw}
                    y2={y0 + usableH}
                    stroke="#292524"
                    strokeWidth="1.6"
                  />
                )}

                {/* A. UPPER BAY ZONE: EITHER CLEAN 3D INTERIOR CAVITY OR CLEAN CLOSED DOOR LEAF */}
                {isOvenBase ? (
                  <g>
                    <rect
                      x={bx0 + 4}
                      y={y0 + 6}
                      width={bw - 8}
                      height={usableH - 14}
                      rx={2}
                      fill="#0f172a"
                      stroke="#475569"
                      strokeWidth="1.2"
                    />
                    <line
                      x1={bx0 + 8}
                      y1={y0 + 11}
                      x2={bx0 + bw - 8}
                      y2={y0 + 11}
                      stroke="#f59e0b"
                      strokeWidth="1.5"
                    />
                  </g>
                ) : isOvenTower ? (
                  <g>
                    <rect
                      x={bx0 + 1.5}
                      y={y0 + 1.5}
                      width={bw - 3}
                      height={usableH * 0.25}
                      fill={frontColor}
                      stroke="#292524"
                      strokeWidth="1.1"
                    />
                    <rect
                      x={bx0 + 3}
                      y={y0 + usableH * 0.28}
                      width={bw - 6}
                      height={usableH * 0.16}
                      rx={1.5}
                      fill="#0f172a"
                      stroke="#475569"
                      strokeWidth="1.1"
                    />
                    <rect
                      x={bx0 + 3}
                      y={y0 + usableH * 0.46}
                      width={bw - 6}
                      height={usableH * 0.22}
                      rx={1.5}
                      fill="#0f172a"
                      stroke="#475569"
                      strokeWidth="1.1"
                    />
                    <line
                      x1={bx0 + 7}
                      y1={y0 + usableH * 0.5}
                      x2={bx0 + bw - 7}
                      y2={y0 + usableH * 0.5}
                      stroke="#f59e0b"
                      strokeWidth="1.4"
                    />
                  </g>
                ) : showInteriorInUpperBay ? (
                  <g>
                    {/* 3D Inner Depth Wall Shading */}
                    <polygon
                      points={`${bx0 + 1.5},${upperTopY} ${bx0 + Math.min(7, bw * 0.22)},${upperTopY + 4} ${bx0 + Math.min(7, bw * 0.22)},${upperBottomY - 2} ${bx0 + 1.5},${upperBottomY}`}
                      fill="#e2d9c8"
                    />
                    {/* Clothes Hanging Rail + Garment Hangers */}
                    {bayRails > 0 && (
                      <g>
                        <line
                          x1={bx0 + 2}
                          y1={upperTopY + 12}
                          x2={bx0 + bw - 2}
                          y2={upperTopY + 12}
                          stroke="#64748b"
                          strokeWidth="2"
                        />
                        {[0.34, 0.64].map((rx, hIdx) => (
                          <g key={hIdx}>
                            <path
                              d={`M ${bx0 + bw * rx} ${upperTopY + 12} L ${bx0 + bw * rx - 5} ${upperTopY + 19} L ${bx0 + bw * rx + 5} ${upperTopY + 19} Z`}
                              fill="none"
                              stroke="#475569"
                              strokeWidth="1.2"
                            />
                            <rect
                              x={bx0 + bw * rx - 4.5}
                              y={upperTopY + 19}
                              width={9}
                              height={Math.min(18, upperH * 0.32)}
                              rx={1.5}
                              fill={hIdx === 0 ? "#cbd5e1" : "#d6d3d1"}
                              stroke="#64748b"
                              strokeWidth="0.9"
                            />
                          </g>
                        ))}
                      </g>
                    )}

                    {/* Crisp 3D Oak Shelves */}
                    {Array.from({ length: Math.min(4, bayShelves) }).map((_, sIdx) => {
                      const startOffset = bayRails > 0 ? upperH * 0.46 : 4;
                      const span = Math.max(10, upperH - startOffset - 4);
                      const sy =
                        upperTopY +
                        startOffset +
                        ((sIdx + 1) * span) / (Math.min(4, bayShelves) + 1);
                      return (
                        <g key={sIdx}>
                          <polygon
                            points={`${bx0 + 1.5},${sy} ${bx0 + 5},${sy - 2.5} ${bx0 + bw - 1.5},${sy - 2.5} ${bx0 + bw - 1.5},${sy}`}
                            fill="#e7d8c1"
                          />
                          <rect
                            x={bx0 + 1.5}
                            y={sy}
                            width={Math.max(4, bw - 3)}
                            height={2.6}
                            fill="#b45309"
                          />
                        </g>
                      );
                    })}
                  </g>
                ) : (
                  /* CLEAN CLOSED DOOR LEAF(S) IN THIS BAY */
                  <g>
                    <rect
                      x={bx0 + 1.2}
                      y={upperTopY}
                      width={Math.max(4, bw - 2.4)}
                      height={upperH}
                      fill={frontColor}
                      stroke="#292524"
                      strokeWidth="1.25"
                      rx="1"
                    />
                    <rect
                      x={bx0 + 2.8}
                      y={upperTopY + 1.6}
                      width={Math.max(2, bw - 5.6)}
                      height={Math.max(2, upperH - 3.2)}
                      fill="none"
                      stroke="#ffffff"
                      strokeOpacity="0.32"
                      strokeWidth="0.9"
                      rx="0.5"
                    />
                    {/* Double Door Center Split */}
                    {(bayDoorType === "double" || bayDoorSys === "hinged_double") && (
                      <line
                        x1={bx0 + bw / 2}
                        y1={upperTopY}
                        x2={bx0 + bw / 2}
                        y2={upperBottomY}
                        stroke="#292524"
                        strokeWidth="1.2"
                      />
                    )}
                    {/* Clean Metallic Handle */}
                    {!isLift && !isSliding && (
                      <line
                        x1={
                          bayDoorType === "double" || bayDoorSys === "hinged_double"
                            ? bx0 + bw / 2 - 3
                            : bx0 + 5
                        }
                        y1={upperTopY + upperH * 0.44}
                        x2={
                          bayDoorType === "double" || bayDoorSys === "hinged_double"
                            ? bx0 + bw / 2 - 3
                            : bx0 + 5
                        }
                        y2={upperTopY + upperH * 0.44 + 10}
                        stroke="#1c1917"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    )}
                  </g>
                )}

                {/* B. BOTTOM EXTERNAL DRAWERS STACK IN THIS BAY */}
                {dCount > 0 &&
                  !isOvenBase &&
                  Array.from({ length: dCount }).map((_, dIdx) => {
                    const dh = drawerZoneH / dCount;
                    const dy = y0 + usableH - (dIdx + 1) * dh;
                    const hw = Math.max(6, Math.min(16, bw * 0.38));
                    return (
                      <g key={`drw_${bIdx}_${dIdx}`}>
                        <rect
                          x={bx0 + 1.2}
                          y={dy + 0.6}
                          width={Math.max(4, bw - 2.4)}
                          height={Math.max(3, dh - 1.2)}
                          fill={frontColor}
                          stroke="#292524"
                          strokeWidth="1.2"
                          rx="0.8"
                        />
                        <line
                          x1={bx0 + bw / 2 - hw / 2}
                          y1={dy + dh / 2}
                          x2={bx0 + bw / 2 + hw / 2}
                          y2={dy + dh / 2}
                          stroke="#1c1917"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </g>
                    );
                  })}
              </g>
            );
          });
        })()}
      </svg>
    );
  }
);

V3IsometricModuleIcon.displayName = "V3IsometricModuleIcon";
export default V3IsometricModuleIcon;
