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
          <polygon points="14,108 148,108 156,98 24,98" fill="#CBD5E1" opacity="0.1" />
          {/* Tall Oven/Fridge Tower (Left) */}
          <polygon points="18,24 28,16 50,16 40,24" fill="#f5f5f4" stroke="#CBD5E1" strokeWidth="1.2" />
          <rect x="18" y="24" width="22" height="82" fill="#cfc6b8" stroke="#CBD5E1" strokeWidth="1.3" />
          {/* Built-in Oven & Microwave in Tower */}
          <rect x="20.5" y="42" width="17" height="11" rx="1" fill="#111827" stroke="#475569" strokeWidth="1" />
          <rect x="20.5" y="55" width="17" height="18" rx="1" fill="#0f172a" stroke="#475569" strokeWidth="1" />
          <line x1="23" y1="58" x2="35" y2="58" stroke="#f59e0b" strokeWidth="1.2" />

          {/* Base Cabinets Row (Sink + 3-Drawer + Hob Base) */}
          <rect x="40" y="66" width="96" height="40" fill="#cfc6b8" stroke="#CBD5E1" strokeWidth="1.3" />
          <polygon points="136,66 146,58 146,98 136,106" fill="#b3a898" stroke="#CBD5E1" strokeWidth="1.2" />
          {/* Plinth */}
          <rect x="18" y="102" width="118" height="4" fill="#94A3B8" />
          {/* Vertical module dividers */}
          <line x1="72" y1="66" x2="72" y2="102" stroke="#CBD5E1" strokeWidth="1.2" />
          <line x1="104" y1="66" x2="104" y2="102" stroke="#CBD5E1" strokeWidth="1.2" />
          {/* Sink Base Double Doors */}
          <line x1="56" y1="66" x2="56" y2="102" stroke="#CBD5E1" strokeWidth="1" />
          {/* Middle 3-Drawer Stack */}
          <line x1="72" y1="76" x2="104" y2="76" stroke="#CBD5E1" strokeWidth="1" />
          <line x1="72" y1="88" x2="104" y2="88" stroke="#CBD5E1" strokeWidth="1" />
          <line x1="84" y1="71" x2="92" y2="71" stroke="#E2E8F0" strokeWidth="1.3" strokeLinecap="round" />
          <line x1="84" y1="82" x2="92" y2="82" stroke="#E2E8F0" strokeWidth="1.3" strokeLinecap="round" />
          <line x1="84" y1="95" x2="92" y2="95" stroke="#E2E8F0" strokeWidth="1.3" strokeLinecap="round" />

          {/* Continuous Quartz Countertop + Backsplash */}
          <polygon points="40,66 50,58 146,58 136,66" fill="#fafaf9" stroke="#CBD5E1" strokeWidth="1.3" />
          <polygon points="48,58 48,40 144,40 144,58" fill="#f5f5f4" stroke="#a8a29e" strokeWidth="0.9" />
          {/* Sink Bowl & Faucet */}
          <polygon points="46,64 51,60 66,60 61,64" fill="#94a3b8" stroke="#94A3B8" strokeWidth="1" />
          <path d="M58,60 C58,51 53,51 53,56" fill="none" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" />
          {/* Hob Burners */}
          <ellipse cx="116" cy="62" rx="4.5" ry="2" fill="#0f172a" stroke="#ef4444" strokeWidth="0.9" />
          <ellipse cx="127" cy="62" rx="4.5" ry="2" fill="#0f172a" stroke="#ef4444" strokeWidth="0.9" />

          {/* Upper Wall Cabinets (3 Modules) */}
          <polygon points="44,24 52,18 142,18 134,24" fill="#f5f5f4" stroke="#CBD5E1" strokeWidth="1.2" />
          <rect x="44" y="24" width="90" height="22" fill="#e7e5e4" stroke="#CBD5E1" strokeWidth="1.3" />
          <polygon points="134,24 142,18 142,40 134,46" fill="#d6d3d1" stroke="#CBD5E1" strokeWidth="1.2" />
          <line x1="74" y1="24" x2="74" y2="46" stroke="#CBD5E1" strokeWidth="1.1" />
          <line x1="104" y1="24" x2="104" y2="46" stroke="#CBD5E1" strokeWidth="1.1" />
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
          <polygon points="18,112 146,104 146,72 56,72 18,98" fill="#CBD5E1" opacity="0.1" />
          {/* Back Main Wall Base Run */}
          <polygon points="48,58 58,50 144,50 134,58" fill="#fafaf9" stroke="#CBD5E1" strokeWidth="1.3" />
          <rect x="48" y="58" width="86" height="38" fill="#cfc6b8" stroke="#CBD5E1" strokeWidth="1.3" />
          <polygon points="134,58 144,50 144,88 134,96" fill="#b3a898" stroke="#CBD5E1" strokeWidth="1.2" />
          <line x1="78" y1="58" x2="78" y2="96" stroke="#CBD5E1" strokeWidth="1.1" />
          <line x1="106" y1="58" x2="106" y2="96" stroke="#CBD5E1" strokeWidth="1.1" />
          <line x1="78" y1="70" x2="106" y2="70" stroke="#CBD5E1" strokeWidth="1" />
          <line x1="78" y1="82" x2="106" y2="82" stroke="#CBD5E1" strokeWidth="1" />

          {/* 90-Degree Left Return Wing (Isometric Forward Return) */}
          <polygon points="20,78 48,58 66,58 38,78" fill="#fafaf9" stroke="#CBD5E1" strokeWidth="1.3" />
          <polygon points="20,78 38,78 38,114 20,114" fill="#b3a898" stroke="#CBD5E1" strokeWidth="1.3" />
          <polygon points="38,78 66,58 66,94 38,114" fill="#cfc6b8" stroke="#CBD5E1" strokeWidth="1.3" />
          <line x1="52" y1="68" x2="52" y2="104" stroke="#CBD5E1" strokeWidth="1.1" />
          {/* Sink on Back Run + Cooktop on Return Wing */}
          <polygon points="84,56 88,52 102,52 98,56" fill="#94a3b8" stroke="#94A3B8" strokeWidth="1" />
          <path d="M94,52 C94,44 89,44 89,49" fill="none" stroke="#94A3B8" strokeWidth="1.4" strokeLinecap="round" />
          <ellipse cx="42" cy="68" rx="4.5" ry="2.2" fill="#0f172a" stroke="#ef4444" strokeWidth="0.9" />

          {/* Back Wall Upper Cabinets */}
          <polygon points="52,20 60,14 142,14 134,20" fill="#f5f5f4" stroke="#CBD5E1" strokeWidth="1.2" />
          <rect x="52" y="20" width="82" height="20" fill="#e7e5e4" stroke="#CBD5E1" strokeWidth="1.3" />
          <polygon points="134,20 142,14 142,34 134,40" fill="#d6d3d1" stroke="#CBD5E1" strokeWidth="1.2" />
          <line x1="80" y1="20" x2="80" y2="40" stroke="#CBD5E1" strokeWidth="1.1" />
          <line x1="108" y1="20" x2="108" y2="40" stroke="#CBD5E1" strokeWidth="1.1" />
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
    // Modern architectural default palette: Warm Cashmere Greige (#CFC6B8) for kitchen, Natural Smoked Oak (#C8AD88) for wardrobe/living
    const rawMatHex =
      matDef?.id === "mat_lacquer_sage" && !resolvedModule ? "#cfc6b8" : matDef?.colorHex;
    const frontColor =
      propColor ||
      (isGlassDoor ? "#334155" : rawMatHex) ||
      (familyId?.startsWith("fam_kitchen") ? "#cfc6b8" : "#c8ad88");

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
              <polygon points="22,64 44,44 138,44 116,64" fill="#f5f5f4" stroke="#CBD5E1" strokeWidth="1.5" />
              <rect x="22" y="64" width="94" height="16" fill={frontColor} stroke="#CBD5E1" strokeWidth="1.5" />
              <polygon points="116,64 138,44 138,60 116,80" fill="#d6d3d1" stroke="#CBD5E1" strokeWidth="1.5" />
            </g>
          )}
        </svg>
      );
    }

    // 3B. DEDICATED 3D ISOMETRIC CORNER CABINET ILLUSTRATION (90° L-Corner & Blind Corner)
    const nameLower = (resolvedModule?.name || template?.name || "").toLowerCase();
    if (isCorner || familyId === "fam_special_corner" || tplId.includes("corner") || nameLower.includes("köşe")) {
      const isBlind = tplId.includes("blind") || nameLower.includes("kör");
      const isUpperCorner =
        resolvedModule?.category === "kitchen_wall" ||
        familyId === "fam_kitchen_wall" ||
        tplId.includes("kw_") ||
        tplId.includes("wall") ||
        nameLower.includes("üst");
      const isKitchenCornerIcon =
        Boolean(familyId?.startsWith("fam_kitchen")) ||
        resolvedModule?.category?.startsWith("kitchen") ||
        tplId.includes("kb_") ||
        tplId.includes("kw_");
      const topY = isUpperCorner ? 12 : 30;
      const botY = isUpperCorner ? 64 : 106;
      const hSpan = botY - topY;

      if (isBlind) {
        // Blind Corner (Kör Köşe): Left fixed blind panel + kidney LeMans tray preview + Right hinged access door
        return (
          <svg
            viewBox="0 0 160 128"
            data-testid={testId}
            className={`${dimClass} shrink-0 overflow-visible`}
            aria-hidden="true"
          >
            <polygon points="22,108 142,108 150,96 32,96" fill="#0f172a" opacity="0.07" />
            {/* Top Countertop / Roof Slab */}
            <polygon
              points="24,28 38,16 138,16 124,28"
              fill="#f8fafc"
              stroke="#94A3B8"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
            {/* Right Side 3D Face */}
            <polygon
              points="124,28 138,16 138,92 124,104"
              fill="#cbd5e1"
              stroke="#94A3B8"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
            {/* Left Fixed Blind Panel (Shaded with dashed inner corner & LeMans kidney curve) */}
            <rect
              x="24"
              y="28"
              width="48"
              height="70"
              fill="#e2e8f0"
              stroke="#94A3B8"
              strokeWidth="1.4"
            />
            <line
              x1="28"
              y1="32"
              x2="68"
              y2="94"
              stroke="#64748b"
              strokeWidth="1.1"
              strokeDasharray="3 2"
            />
            <path
              d="M 34 54 C 46 46, 64 48, 66 58 C 68 66, 50 68, 36 62 Z"
              fill="#EEF3F8"
              stroke="#475569"
              strokeWidth="1.1"
            />
            <path
              d="M 34 76 C 46 68, 64 70, 66 80 C 68 88, 50 90, 36 84 Z"
              fill="#EEF3F8"
              stroke="#475569"
              strokeWidth="1.1"
            />
            {/* Center Corner Filler Stile (Kör Köşe Dönüş Çıtası) */}
            <rect
              x="72"
              y="28"
              width="6"
              height="70"
              fill={frontColor}
              stroke="#94A3B8"
              strokeWidth="1.2"
            />
            {/* Right Hinged Access Door */}
            <rect
              x="78"
              y="28"
              width="46"
              height="70"
              fill={frontColor}
              stroke="#94A3B8"
              strokeWidth="1.4"
            />
            {/* Handle on Left Edge of Right Access Door */}
            <line
              x1="84"
              y1="54"
              x2="84"
              y2="70"
              stroke="#111827"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            {/* Plinth */}
            <rect
              x="26"
              y="98"
              width="96"
              height="6"
              fill="#64748b"
              stroke="#94A3B8"
              strokeWidth="1.1"
            />
          </svg>
        );
      }

      // True 90° L-Corner Cabinet (L-Köşe Dolabı): Unmistakable 3D L-Shaped Top + Left Forward Return Wing + Right Main Wing + Inner 90° Bi-Fold Doors
      return (
        <svg
          viewBox="0 0 160 128"
          data-testid={testId}
          className={`${dimClass} shrink-0 overflow-visible`}
          aria-hidden="true"
        >
          {/* L-Shaped Floor Shadow */}
          <polygon
            points={`22,${botY + 12} 68,${botY + 12} 68,${botY + 2} 134,${botY + 2} 144,${botY - 8} 44,${botY - 8}`}
            fill="#0f172a"
            opacity="0.08"
          />

          {/* Right Main Wing Front Door (Back-Right Arm of the L) */}
          <rect
            x="72"
            y={topY + 14}
            width="54"
            height={hSpan - 12}
            fill={frontColor}
            stroke="#94A3B8"
            strokeWidth="1.4"
          />
          {/* Right Wing 3D Side Face */}
          <polygon
            points={`126,${topY + 14} 140,${topY + 2} 140,${botY - 10} 126,${botY + 2}`}
            fill="#cbd5e1"
            stroke="#94A3B8"
            strokeWidth="1.35"
            strokeLinejoin="round"
          />
          {/* Right Wing Plinth */}
          {!isUpperCorner && (
            <rect
              x="72"
              y={botY - 4}
              width="54"
              height="6"
              fill="#64748b"
              stroke="#94A3B8"
              strokeWidth="1.1"
            />
          )}

          {/* Left Forward 90° Return Wing — Inner Z-Return Door Face (Angled toward inner corner) */}
          <polygon
            points={`54,${topY + 30} 72,${topY + 14} 72,${botY + 2} 54,${botY + 16}`}
            fill={frontColor}
            stroke="#94A3B8"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <polygon
            points={`54,${topY + 30} 72,${topY + 14} 72,${botY + 2} 54,${botY + 16}`}
            fill="#0f172a"
            opacity="0.1"
          />

          {/* Left Forward 90° Return Wing — Front End Panel (Gable Face at Z-max) */}
          <rect
            x="24"
            y={topY + 30}
            width="30"
            height={hSpan - 12}
            fill="#e2e8f0"
            stroke="#94A3B8"
            strokeWidth="1.4"
          />
          {!isUpperCorner && (
            <rect
              x="24"
              y={botY + 10}
              width="30"
              height="6"
              fill="#64748b"
              stroke="#94A3B8"
              strokeWidth="1.1"
            />
          )}

          {/* Unmistakable 3D L-Shaped Top Roof / Countertop Polygon */}
          <polygon
            points={`24,${topY + 30} 54,${topY + 2} 140,${topY + 2} 126,${topY + 14} 72,${topY + 14} 54,${topY + 30}`}
            fill="#f8fafc"
            stroke="#94A3B8"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />

          {/* 90° Inner-Corner Bi-Fold Meeting Seam & Ergonomic Handles */}
          <line
            x1="72"
            y1={topY + 14}
            x2="72"
            y2={botY - 4}
            stroke="#111827"
            strokeWidth="1.8"
          />
          <line
            x1="78"
            y1={isUpperCorner ? botY - 16 : topY + 20}
            x2="78"
            y2={isUpperCorner ? botY - 6 : topY + 31}
            stroke="#111827"
            strokeWidth="2.1"
            strokeLinecap="round"
          />
          <line
            x1="66"
            y1={isUpperCorner ? botY - 12 : topY + 24}
            x2="66"
            y2={isUpperCorner ? botY - 2 : topY + 35}
            stroke="#111827"
            strokeWidth="2.1"
            strokeLinecap="round"
          />

          {/* Upper Corner Reference Countertop Below vs Base Corner Floor Line */}
          {isUpperCorner ? (
            <g>
              <polygon
                points="26,74 134,68 142,102 22,108"
                fill="#fef3c7"
                opacity="0.28"
              />
              <polygon
                points="20,108 50,90 142,90 126,102 68,102 48,116 20,116"
                fill="none"
                stroke="#a8a29e"
                strokeWidth="1.2"
                strokeDasharray="3 2"
              />
              <rect x="8" y="6" width="32" height="14" rx="4" fill="#334155" />
              <text x="24" y="15.5" textAnchor="middle" fontSize="8" fontWeight="800" fill="#ffffff">
                ÜST
              </text>
            </g>
          ) : isKitchenCornerIcon ? (
            <g>
              <line x1="16" y1="118" x2="146" y2="118" stroke="#78716c" strokeWidth="1.2" strokeDasharray="4 2" />
              <rect x="8" y="6" width="32" height="14" rx="4" fill="#CBD5E1" />
              <text x="24" y="15.5" textAnchor="middle" fontSize="8" fontWeight="800" fill="#ffffff">
                ALT
              </text>
            </g>
          ) : null}
        </svg>
      );
    }

    // 4. STANDARD & SPECIAL CABINET GEOMETRY IN 160x128 VIEWBOX
    const isWallCab =
      familyId === "fam_kitchen_wall" || resolvedModule?.category === "kitchen_wall";
    const isIslandCab =
      tplId.includes("island") || resolvedModule?.category === "kitchen_island";
    const isBaseCab =
      familyId === "fam_kitchen_base" ||
      resolvedModule?.category === "kitchen_base" ||
      isIslandCab;
    const isTallKitchenCab =
      familyId === "fam_kitchen_tall" || resolvedModule?.category === "kitchen_tall";

    const normW = Math.max(
      52,
      Math.min(108, Math.round(48 + (wMm / 2400) * 60))
    );
    const normH = isWallCab
      ? Math.max(38, Math.min(50, Math.round((hMm / 900) * 44)))
      : isBaseCab
      ? 64
      : Math.max(78, Math.min(96, Math.round((hMm / 2400) * 92)));
    const isoDx = isWallCab
      ? 12
      : isBaseCab
      ? 20
      : Math.max(15, Math.min(23, Math.round((dMm / 650) * 20)));
    const isoDy = Math.round(isoDx * 0.55);

    const x0 = Math.round((160 - (normW + isoDx)) / 2);
    // Upper cabinet sits HIGH near ceiling (y0=18) with countertop reference below;
    // Base cabinet sits LOW on the floor (y0=48) with stone countertop slab & open upper wall space above!
    const y0 = isWallCab
      ? 18
      : isBaseCab
      ? 48
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

    const hasPlinthIcon = !isWallCab && (resolvedModule?.carcass?.plinthHeight ?? 80) > 0;
    const isGableRailsIcon =
      hasPlinthIcon && resolvedModule?.carcass?.plinthConstruction === "gable_rails";
    const plinthPx = isWallCab || !hasPlinthIcon ? 0 : 6;
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
        {/* Architectural Wall & Elevation Context for Upper vs Base vs Tall Kitchen Modules */}
        {isWallCab && (
          <g>
            {/* Subtle Backsplash Wall Zone + Warm Under-Cabinet LED Cone + Lower Countertop Reference */}
            <rect
              x={Math.max(14, x0 - 10)}
              y={10}
              width={Math.min(134, normW + isoDx + 20)}
              height={106}
              rx={5}
              fill="#f5f2eb"
              opacity="0.72"
            />
            <polygon
              points={`${x0 + 3},${y0 + normH + 1} ${x0 + normW - 3},${y0 + normH + 1} ${x0 + normW + 10},102 ${x0 - 10},102`}
              fill="#fde68a"
              opacity="0.34"
            />
            <line
              x1={x0 + 4}
              y1={y0 + normH + 1.5}
              x2={x0 + normW - 4}
              y2={y0 + normH + 1.5}
              stroke="#f59e0b"
              strokeWidth="2"
              strokeLinecap="round"
            />
            {/* Dashed Lower Countertop Slab Reference so Upper Mount is 100% Unmistakable */}
            <polygon
              points={`${x0 - 8},106 ${x0 + isoDx - 2},${106 - isoDy} ${x0 + normW + isoDx + 6},${106 - isoDy} ${x0 + normW + 6},106`}
              fill="#ebe6dc"
              fillOpacity="0.65"
              stroke="#8c8275"
              strokeWidth="1.15"
              strokeDasharray="3.5 2"
            />
            <line
              x1={x0 - 8}
              y1={110}
              x2={x0 + normW + 6}
              y2={110}
              stroke="#a8a29e"
              strokeWidth="1.1"
              strokeDasharray="3 2"
            />
          </g>
        )}

        {isBaseCab && (
          <g>
            {/* Subtle Upper Wall Reference Zone Above Base Cabinet + Solid Floor Baseline Below */}
            <rect
              x={Math.max(16, x0 - 6)}
              y={10}
              width={Math.min(128, normW + isoDx + 12)}
              height={22}
              rx={3}
              fill="none"
              stroke="#d6d0c4"
              strokeWidth="1"
              strokeDasharray="3 2.5"
            />
            <line
              x1={Math.max(10, x0 - 12)}
              y1={y0 + normH + 1}
              x2={Math.min(150, x0 + normW + isoDx + 10)}
              y2={y0 + normH + 1}
              stroke="#78716c"
              strokeWidth="1.4"
            />
          </g>
        )}

        {/* Soft Multi-Layer Studio Floor Shadow */}
        {!isWallCab && (
          <>
            <polygon
              points={`${x0 + 2},${y0 + normH + 5} ${x0 + normW + isoDx + 8},${
                y0 + normH - isoDy + 5
              } ${x0 + normW + 4},${y0 + normH + 10} ${x0 - 6},${y0 + normH + 10}`}
              fill="#0c0a09"
              opacity={0.08}
            />
            <polygon
              points={`${x0 + 4},${y0 + normH + 3} ${x0 + normW + isoDx + 4},${
                y0 + normH - isoDy + 3
              } ${x0 + normW + 2},${y0 + normH + 7} ${x0 - 2},${y0 + normH + 7}`}
              fill="#CBD5E1"
              opacity={0.14}
            />
          </>
        )}

        {/* Top 3D Face — Projecting 38mm Calacatta Quartz Countertop Slab + Rear Upstand on Base Cabinets! */}
        {isBaseCab ? (
          <g>
            {/* Projecting Stone Countertop Top Plane */}
            <polygon
              points={`${x0 - 2.5},${y0 - 4} ${x0 + isoDx},${y0 - isoDy - 4} ${
                x0 + normW + isoDx + 2.5
              },${y0 - isoDy - 4} ${x0 + normW + 2.5},${y0 - 4}`}
              fill="#faf9f6"
              stroke="#CBD5E1"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
            {/* 38mm Stone Countertop Front Edge Thickness */}
            <rect
              x={x0 - 2.5}
              y={y0 - 4}
              width={normW + 5}
              height={4.2}
              fill="#e7e2d8"
              stroke="#CBD5E1"
              strokeWidth="1.25"
            />
            {/* Stone Countertop Right Side Thickness */}
            <polygon
              points={`${x0 + normW + 2.5},${y0 - 4} ${x0 + normW + isoDx + 2.5},${
                y0 - isoDy - 4
              } ${x0 + normW + isoDx + 2.5},${y0 - isoDy} ${x0 + normW + 2.5},${y0}`}
              fill="#d6cfc2"
              stroke="#CBD5E1"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
            {/* Rear Wall Backsplash Lip (Tezgâh Süpürgeliği) */}
            {!isIslandCab && (
              <polygon
                points={`${x0 + isoDx},${y0 - isoDy - 8} ${x0 + normW + isoDx + 2},${
                  y0 - isoDy - 8
                } ${x0 + normW + isoDx + 2},${y0 - isoDy - 4} ${x0 + isoDx},${y0 - isoDy - 4}`}
                fill="#ece8df"
                stroke="#94A3B8"
                strokeWidth="1"
              />
            )}
          </g>
        ) : (
          <polygon
            points={topPoints}
            fill="url(#iso_top_grad)"
            stroke="#CBD5E1"
            strokeWidth="1.45"
            strokeLinejoin="round"
          />
        )}

        {/* Right Side 3D Face with Depth Gradient */}
        <polygon
          points={sidePoints}
          fill="url(#iso_side_grad)"
          stroke="#CBD5E1"
          strokeWidth="1.45"
          strokeLinejoin="round"
        />

        {/* L-Corner 90-Degree Forward Return Wing */}
        {isCorner && (
          <g>
            <polygon
              points={`${x0 - 16},${y0 + 12} ${x0},${y0} ${x0 + 22},${y0} ${x0 + 6},${y0 + 12}`}
              fill="#fafaf9"
              stroke="#CBD5E1"
              strokeWidth="1.3"
            />
            <polygon
              points={`${x0 - 16},${y0 + 12} ${x0 + 6},${y0 + 12} ${x0 + 6},${y0 + normH + 10} ${x0 - 16},${y0 + normH + 10}`}
              fill={frontColor}
              stroke="#CBD5E1"
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
          stroke="#CBD5E1"
          strokeWidth="1.55"
        />

        {/* Plinth / Baza (with floor-descending side uprights when gable_rails is active!) */}
        {!isWallCab && plinthPx > 0 && (
          <g>
            <rect
              x={isGableRailsIcon ? x0 + 3.5 : x0 + 2}
              y={y0 + usableH}
              width={Math.max(4, normW - (isGableRailsIcon ? 7 : 4))}
              height={plinthPx}
              fill="#94A3B8"
              stroke="#CBD5E1"
              strokeWidth="1.2"
            />
            {isGableRailsIcon && (
              <>
                <rect
                  x={x0}
                  y={y0 + usableH}
                  width={3.5}
                  height={plinthPx}
                  fill="#dfd9ce"
                  stroke="#CBD5E1"
                  strokeWidth="1.2"
                />
                <rect
                  x={x0 + normW - 3.5}
                  y={y0 + usableH}
                  width={3.5}
                  height={plinthPx}
                  fill="#dfd9ce"
                  stroke="#CBD5E1"
                  strokeWidth="1.2"
                />
              </>
            )}
          </g>
        )}

        {/* Kitchen Countertop Lip */}
        {isBaseCab && (
          <line
            x1={x0 - 1}
            y1={y0}
            x2={x0 + normW + 1}
            y2={y0}
            stroke="#94A3B8"
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
              stroke="#94A3B8"
              strokeWidth="1.2"
            />
            <path
              d={`M ${x0 + normW * 0.55} ${y0 - isoDy + 3} C ${
                x0 + normW * 0.55
              } ${y0 - isoDy - 12}, ${x0 + normW * 0.42} ${
                y0 - isoDy - 12
              }, ${x0 + normW * 0.42} ${y0 - isoDy - 3}`}
              fill="none"
              stroke="#94A3B8"
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

            // Only show open interior when the bay is genuinely open or glass-doored (matches 3D product 1-to-1!)
            const showInteriorInUpperBay = !hasDoorInBay || isGlassDoor;

            return (
              <g key={`bay_${bIdx}`}>
                {/* Vertical Carcass Divider between Bays */}
                {bIdx < bayWidthsMm.length - 1 && (
                  <line
                    x1={bx0 + bw}
                    y1={y0}
                    x2={bx0 + bw}
                    y2={y0 + usableH}
                    stroke="#CBD5E1"
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
                      stroke="#CBD5E1"
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
                      stroke="#CBD5E1"
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
                    {/* Double Door Center Split (also when bay width > 600mm on hinged) */}
                    {(bayDoorType === "double" ||
                      bayDoorSys === "hinged_double" ||
                      (!isLift && !isSliding && bwMm > 600)) && (
                      <line
                        x1={bx0 + bw / 2}
                        y1={upperTopY}
                        x2={bx0 + bw / 2}
                        y2={upperBottomY}
                        stroke="#CBD5E1"
                        strokeWidth="1.2"
                      />
                    )}
                    {/* Ergonomic World-Standard Handle Position: Bottom on Upper Wall, Top on Base, Hand-Height on Tall! */}
                    {!isLift && !isSliding && (() => {
                      const hLen = Math.min(10, Math.max(6, upperH * 0.22));
                      const hy1 = isWallCab
                        ? Math.max(upperTopY + 3, upperBottomY - hLen - 4.5)
                        : isBaseCab
                        ? upperTopY + 5
                        : upperTopY + upperH * 0.44;
                      const hy2 = hy1 + hLen;
                      return bayDoorType === "double" ||
                        bayDoorSys === "hinged_double" ||
                        bwMm > 600 ? (
                        <>
                          <line
                            x1={bx0 + bw / 2 - 2.4}
                            y1={hy1}
                            x2={bx0 + bw / 2 - 2.4}
                            y2={hy2}
                            stroke="#E2E8F0"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                          />
                          <line
                            x1={bx0 + bw / 2 + 2.4}
                            y1={hy1}
                            x2={bx0 + bw / 2 + 2.4}
                            y2={hy2}
                            stroke="#E2E8F0"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                          />
                        </>
                      ) : (
                        <line
                          x1={
                            bayDoorType === "single_right" ||
                            bayDoorType === "inset_right" ||
                            bayDoorType === "half_overlay_right"
                              ? bx0 + 3.8
                              : bx0 + Math.max(4, bw - 3.8)
                          }
                          y1={hy1}
                          x2={
                            bayDoorType === "single_right" ||
                            bayDoorType === "inset_right" ||
                            bayDoorType === "half_overlay_right"
                              ? bx0 + 3.8
                              : bx0 + Math.max(4, bw - 3.8)
                          }
                          y2={hy2}
                          stroke="#E2E8F0"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        />
                      );
                    })()}
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
                          stroke="#CBD5E1"
                          strokeWidth="1.2"
                          rx="0.8"
                        />
                        <line
                          x1={bx0 + bw / 2 - hw / 2}
                          y1={dy + dh / 2}
                          x2={bx0 + bw / 2 + hw / 2}
                          y2={dy + dh / 2}
                          stroke="#E2E8F0"
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

        {/* Crisp Architectural Zone Micro-Badge (ÜST / ALT / BOY / ADA) */}
        {(isWallCab || isBaseCab || isTallKitchenCab) && (
          <g>
            <rect
              x="6"
              y="6"
              width={isIslandCab ? 32 : 30}
              height="14"
              rx="4"
              fill={isWallCab ? "#334155" : isTallKitchenCab ? "#1c1917" : "#57534e"}
            />
            <text
              x={isIslandCab ? 22 : 21}
              y="15.5"
              textAnchor="middle"
              fontSize="7.8"
              fontWeight="800"
              letterSpacing="0.3"
              fill="#ffffff"
            >
              {isWallCab ? "ÜST" : isIslandCab ? "ADA" : isTallKitchenCab ? "BOY" : "ALT"}
            </text>
          </g>
        )}
      </svg>
    );
  },
  (prev, next) => {
    if (
      prev.template !== next.template ||
      prev.presetLayout !== next.presetLayout ||
      prev.bayCount !== next.bayCount ||
      prev.widthMm !== next.widthMm ||
      prev.heightMm !== next.heightMm ||
      prev.depthMm !== next.depthMm ||
      prev.hasDrawers !== next.hasDrawers ||
      prev.isOpenFront !== next.isOpenFront ||
      prev.doorColorHex !== next.doorColorHex ||
      prev.size !== next.size ||
      prev.testId !== next.testId
    ) {
      return false;
    }
    const pm = prev.module;
    const nm = next.module;
    if (pm === nm) return true;
    if (!pm || !nm) return false;
    if (
      pm.id !== nm.id ||
      pm.category !== nm.category ||
      pm.moduleSubType !== nm.moduleSubType ||
      pm.isOpenFront !== nm.isOpenFront ||
      pm.dimensions.width !== nm.dimensions.width ||
      pm.dimensions.height !== nm.dimensions.height ||
      pm.dimensions.depth !== nm.dimensions.depth ||
      pm.carcass.plinthHeight !== nm.carcass.plinthHeight ||
      pm.carcass.plinthConstruction !== nm.carcass.plinthConstruction ||
      pm.carcass.bodyMaterialId !== nm.carcass.bodyMaterialId ||
      pm.carcass.frontMaterialId !== nm.carcass.frontMaterialId ||
      pm.bays.length !== nm.bays.length
    ) {
      return false;
    }
    for (let i = 0; i < pm.bays.length; i++) {
      const pb = pm.bays[i];
      const nb = nm.bays[i];
      if (
        pb.customWidth !== nb.customWidth ||
        pb.door?.type !== nb.door?.type ||
        pb.door?.doorSystemId !== nb.door?.doorSystemId ||
        pb.door?.doorMaterialId !== nb.door?.doorMaterialId ||
        pb.shelves.length !== nb.shelves.length ||
        pb.drawers.length !== nb.drawers.length ||
        pb.hangingRails.length !== nb.hangingRails.length
      ) {
        return false;
      }
    }
    return true;
  }
);

V3IsometricModuleIcon.displayName = "V3IsometricModuleIcon";
export default V3IsometricModuleIcon;
