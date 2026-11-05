"use client";

import React, { useMemo } from "react";
import { ModuleInstance, DEFAULT_MATERIALS, calculateBayWidths } from "@birim/core";
import { V4ModuleTemplateDefinition } from "@birim/catalog";

export interface V3IsometricModuleIconProps {
  module?: ModuleInstance;
  template?: V4ModuleTemplateDefinition;
  bayCount?: number;
  widthMm?: number;
  heightMm?: number;
  depthMm?: number;
  hasDrawers?: boolean;
  isOpenFront?: boolean;
  doorColorHex?: string;
  size?: "sm" | "md" | "lg";
  testId?: string;
}

/**
 * Renders an architectural 3D isometric SVG miniature of a furniture module or V4 template,
 * accurately depicting its proportions (W/H/D), family (kitchen base/wall/tall, wardrobe,
 * special/corner, complementary), appliance cutouts (sink, oven, cooktop, hood, microwave, fridge),
 * door kinematics (hinged, sliding, lift-up, pocket, glass showcase), sloped/stepped geometry,
 * internal shelves, hanging rails, and drawer stacks.
 */
export const V3IsometricModuleIcon: React.FC<V3IsometricModuleIconProps> = React.memo(
  ({
    module: propModule,
    template,
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
            resolvedModule.bays.every((b) => b.door.type === "open")
        ) &&
        !resolvedModule.bays.some(
          (b) => b.drawers.length > 0 && !b.drawers[0]?.isInternal
        )
      : Boolean(propOpen);

    const externalDrawers = resolvedModule
      ? resolvedModule.bays.flatMap((b) => b.drawers.filter((d) => !d.isInternal))
      : [];
    const internalDrawers = resolvedModule
      ? resolvedModule.bays.flatMap((b) => b.drawers.filter((d) => d.isInternal))
      : [];

    const drawerCount = resolvedModule
      ? externalDrawers.length
      : propDrawers
      ? 2
      : 0;

    const shelfCount = resolvedModule
      ? Math.max(0, ...resolvedModule.bays.map((b) => b.shelves.length))
      : 2;

    const railCount = resolvedModule
      ? Math.max(0, ...resolvedModule.bays.map((b) => b.hangingRails.length))
      : 0;

    const specialFittingType =
      resolvedModule?.bays[0]?.specialFittings?.[0]?.type;

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
      (familyId?.startsWith("fam_kitchen") ? "#A7B89E" : "#C8A273");

    const dimClass =
      size === "sm" ? "w-8 h-7" : size === "lg" ? "w-14 h-12" : "w-11 h-10";

    // Special rendering for Family F: Complementary modules
    if (familyId === "fam_complementary" || compRole) {
      return (
        <svg
          viewBox="0 0 64 54"
          data-testid={testId}
          className={`${dimClass} shrink-0 overflow-visible`}
          aria-hidden="true"
        >
          {compRole === "leveling_feet" ? (
            <g>
              {[16, 26, 38, 48].map((lx, idx) => (
                <g key={idx}>
                  <rect
                    x={lx - 2}
                    y={16}
                    width={4}
                    height={18}
                    rx={1}
                    fill="#374151"
                    stroke="#111827"
                    strokeWidth="1"
                  />
                  <ellipse
                    cx={lx}
                    cy={36}
                    rx={5}
                    ry={2.2}
                    fill="#1F2937"
                    stroke="#111827"
                    strokeWidth="1"
                  />
                </g>
              ))}
            </g>
          ) : compRole === "led_channel" ? (
            <g>
              <polygon
                points="10,32 50,18 54,22 14,36"
                fill="#FEF08A"
                stroke="#CA8A04"
                strokeWidth="1.3"
              />
              <line
                x1="12"
                y1="34"
                x2="52"
                y2="20"
                stroke="#F59E0B"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </g>
          ) : compRole === "countertop" ? (
            <g>
              <polygon
                points="8,26 18,17 56,17 46,26"
                fill="#F5F5F4"
                stroke="#292524"
                strokeWidth="1.4"
              />
              <rect
                x="8"
                y="26"
                width="38"
                height="5"
                fill="#E7E5E4"
                stroke="#292524"
                strokeWidth="1.4"
              />
              <polygon
                points="46,26 56,17 56,22 46,31"
                fill="#D6D3D1"
                stroke="#292524"
                strokeWidth="1.4"
              />
              <path
                d="M16,23 Q26,20 34,24 T48,19"
                fill="none"
                stroke="#A8A29E"
                strokeWidth="0.9"
              />
            </g>
          ) : compRole === "waterfall_edge" ||
            compRole === "end_panel" ||
            compRole === "wall_filler" ? (
            <g>
              <polygon
                points="24,10 33,5 38,5 29,10"
                fill="#F5F5F4"
                stroke="#292524"
                strokeWidth="1.3"
              />
              <rect
                x="24"
                y="10"
                width="5"
                height="36"
                fill={compRole === "waterfall_edge" ? "#F5F5F4" : frontColor}
                stroke="#292524"
                strokeWidth="1.3"
              />
              <polygon
                points="29,10 38,5 38,41 29,46"
                fill="#D6D3CB"
                stroke="#292524"
                strokeWidth="1.3"
              />
            </g>
          ) : (
            <g>
              <polygon
                points="10,28 16,24 54,24 48,28"
                fill="#F5F5F4"
                stroke="#292524"
                strokeWidth="1.3"
              />
              <rect
                x="10"
                y="28"
                width="38"
                height={compRole === "backsplash" || compRole === "back_cladding" ? 16 : 7}
                fill={compRole === "backsplash" ? "#F5F5F4" : frontColor}
                stroke="#292524"
                strokeWidth="1.3"
              />
            </g>
          )}
        </svg>
      );
    }

    // Normalize cabinet visual dimensions inside a 64x54 viewBox
    const isWallCab = familyId === "fam_kitchen_wall";
    const isBaseCab =
      familyId === "fam_kitchen_base" || tplId.includes("island");

    const normW = Math.max(
      14,
      Math.min(36, Math.round(14 + (wMm / 2600) * 22))
    );
    const normH = isWallCab
      ? Math.max(13, Math.min(22, Math.round((hMm / 900) * 19)))
      : isBaseCab
      ? 22
      : Math.max(24, Math.min(34, Math.round((hMm / 2400) * 32)));
    const isoDx = Math.max(5, Math.min(10, Math.round((dMm / 650) * 8)));
    const isoDy = Math.round(isoDx * 0.55);

    const x0 = Math.round((64 - (normW + isoDx)) / 2);
    const y0 = isWallCab
      ? 11
      : Math.round((54 - (normH + isoDy)) / 2) + isoDy;

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
    const isPocket =
      doorSystemId === "pocket_retractable" || tplId.includes("pocket");
    const isSliding =
      doorSystemId.startsWith("sliding") || tplId.includes("sliding");
    const isLift = doorSystemId.startsWith("lift_");
    const isSloped = tplId.includes("sloped_ceiling");
    const isStairs = tplId.includes("under_stairs");
    const hasLed =
      specialFittingType === "led_profile" ||
      tplId.includes("led") ||
      tplId.includes("niche_tall");

    return (
      <svg
        viewBox="0 0 64 54"
        data-testid={testId}
        className={`${dimClass} shrink-0 overflow-visible`}
        aria-hidden="true"
      >
        {/* Floor or Wall Shadow */}
        <polygon
          points={`${x0 + 2},${y0 + normH + 2} ${x0 + normW + isoDx + 2},${
            y0 + normH - isoDy + 2
          } ${x0 + normW + 1},${y0 + normH + 4} ${x0 - 1},${y0 + normH + 4}`}
          fill="#000000"
          opacity={isWallCab ? 0.08 : 0.15}
        />

        {/* Sloped Ceiling or Under-Stairs Special Geometry */}
        {isSloped ? (
          <g>
            <polygon
              points={`${x0},${y0 + 9} ${x0 + normW * 0.55},${y0} ${
                x0 + normW
              },${y0} ${x0 + normW},${y0 + normH} ${x0},${y0 + normH}`}
              fill={frontColor}
              stroke="#1C1917"
              strokeWidth="1.5"
            />
            <polygon
              points={`${x0 + normW * 0.55},${y0} ${
                x0 + normW * 0.55 + isoDx
              },${y0 - isoDy} ${x0 + normW + isoDx},${y0 - isoDy} ${
                x0 + normW
              },${y0}`}
              fill="#F5F5F4"
              stroke="#292524"
              strokeWidth="1.3"
            />
            <polygon
              points={sidePoints}
              fill="#D6D3CB"
              stroke="#292524"
              strokeWidth="1.3"
            />
          </g>
        ) : isStairs ? (
          <g>
            {[0, 1, 2].map((step) => {
              const sw = normW / 3;
              const sh = normH * (0.48 + step * 0.26);
              const sx = x0 + step * sw;
              const sy = y0 + normH - sh;
              return (
                <g key={step}>
                  <polygon
                    points={`${sx},${sy} ${sx + isoDx * 0.7},${
                      sy - isoDy * 0.7
                    } ${sx + sw + isoDx * 0.7},${sy - isoDy * 0.7} ${
                      sx + sw
                    },${sy}`}
                    fill="#F5F5F4"
                    stroke="#292524"
                    strokeWidth="1.2"
                  />
                  <rect
                    x={sx}
                    y={sy}
                    width={sw}
                    height={sh}
                    fill={frontColor}
                    stroke="#1C1917"
                    strokeWidth="1.3"
                  />
                </g>
              );
            })}
          </g>
        ) : (
          <>
            {/* Top 3D Perspective Face */}
            <polygon
              points={topPoints}
              fill={isBaseCab ? "#FAF8F5" : "#F5F5F4"}
              stroke="#292524"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />

            {/* Right Side 3D Perspective Face */}
            <polygon
              points={sidePoints}
              fill="#D6D3CB"
              stroke="#292524"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />

            {/* L-Corner Return Wing Indicator */}
            {isCorner && (
              <polygon
                points={`${x0 - 5},${y0 + 3} ${x0},${y0} ${x0},${y0 + normH} ${
                  x0 - 5
                },${y0 + normH + 3}`}
                fill="#E7E5E4"
                stroke="#1C1917"
                strokeWidth="1.3"
                strokeLinejoin="round"
              />
            )}

            {/* Front Carcass / Door Frame */}
            <rect
              x={x0}
              y={y0}
              width={normW}
              height={normH}
              fill={
                isOpen
                  ? "#FAF8F5"
                  : isGlassDoor
                  ? "#334155"
                  : frontColor
              }
              fillOpacity={isGlassDoor ? 0.82 : 1}
              stroke="#1C1917"
              strokeWidth="1.6"
              rx="1"
            />
          </>
        )}

        {/* Kitchen Base Countertop Lip */}
        {isBaseCab && !isSloped && !isStairs && (
          <line
            x1={x0 - 0.5}
            y1={y0}
            x2={x0 + normW + 0.5}
            y2={y0}
            stroke="#57534E"
            strokeWidth="2.2"
          />
        )}

        {/* Sink Basin & Faucet on Top Face */}
        {isSink && (
          <g>
            <polygon
              points={`${x0 + 5},${y0 - 1} ${x0 + 8},${y0 - isoDy + 1} ${
                x0 + normW - 3
              },${y0 - isoDy + 1} ${x0 + normW - 6},${y0 - 1}`}
              fill="#94A3B8"
              stroke="#334155"
              strokeWidth="1"
            />
            <path
              d={`M ${x0 + normW * 0.55} ${y0 - isoDy + 1} C ${
                x0 + normW * 0.55
              } ${y0 - isoDy - 6}, ${x0 + normW * 0.42} ${
                y0 - isoDy - 6
              }, ${x0 + normW * 0.42} ${y0 - isoDy - 2}`}
              fill="none"
              stroke="#475569"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </g>
        )}

        {/* Cooktop Induction Burners on Top Face */}
        {isCooktop && (
          <g>
            <ellipse
              cx={x0 + normW * 0.36}
              cy={y0 - isoDy * 0.48}
              rx={2.6}
              ry={1.3}
              fill="#1E293B"
              stroke="#EF4444"
              strokeWidth="0.9"
            />
            <ellipse
              cx={x0 + normW * 0.68}
              cy={y0 - isoDy * 0.48}
              rx={2.6}
              ry={1.3}
              fill="#1E293B"
              stroke="#EF4444"
              strokeWidth="0.9"
            />
          </g>
        )}

        {/* Built-in Oven / Microwave Windows */}
        {isOvenBase && (
          <g>
            <rect
              x={x0 + 2.5}
              y={y0 + 3}
              width={normW - 5}
              height={normH - 8}
              rx={1}
              fill="#1E293B"
              stroke="#475569"
              strokeWidth="1.1"
            />
            <line
              x1={x0 + 4.5}
              y1={y0 + 5.5}
              x2={x0 + normW - 4.5}
              y2={y0 + 5.5}
              stroke="#F59E0B"
              strokeWidth="1.1"
            />
          </g>
        )}

        {isOvenTower && (
          <g>
            {tplId.includes("microwave") && (
              <rect
                x={x0 + 2.2}
                y={y0 + normH * 0.22}
                width={normW - 4.4}
                height={5.5}
                rx={0.8}
                fill="#0F172A"
                stroke="#64748B"
                strokeWidth="0.9"
              />
            )}
            <rect
              x={x0 + 2.2}
              y={y0 + normH * 0.42}
              width={normW - 4.4}
              height={8}
              rx={0.8}
              fill="#0F172A"
              stroke="#64748B"
              strokeWidth="1"
            />
            <line
              x1={x0 + 4}
              y1={y0 + normH * 0.46}
              x2={x0 + normW - 4}
              y2={y0 + normH * 0.46}
              stroke="#F59E0B"
              strokeWidth="1"
            />
          </g>
        )}

        {isMicrowaveWall && (
          <rect
            x={x0 + 2.5}
            y={y0 + normH * 0.45}
            width={normW - 5}
            height={normH * 0.44}
            rx={0.8}
            fill="#0F172A"
            stroke="#64748B"
            strokeWidth="1"
          />
        )}

        {/* Extractor Hood Chimney & Visor */}
        {isHood && (
          <g>
            <rect
              x={x0 + normW * 0.32}
              y={y0 - isoDy - 4}
              width={normW * 0.36}
              height={4}
              fill="#94A3B8"
              stroke="#334155"
              strokeWidth="1"
            />
            <polygon
              points={`${x0},${y0 + normH} ${x0 + normW},${y0 + normH} ${
                x0 + normW + 2
              },${y0 + normH + 3} ${x0 - 2},${y0 + normH + 3}`}
              fill="#64748B"
              stroke="#1E293B"
              strokeWidth="1"
            />
          </g>
        )}

        {/* Fridge Split Line & Vent Grille */}
        {isFridge && (
          <g>
            <line
              x1={x0 + 1}
              y1={y0 + normH * 0.62}
              x2={x0 + normW - 1}
              y2={y0 + normH * 0.62}
              stroke="#1C1917"
              strokeWidth="1.4"
            />
            <line
              x1={x0 + 4}
              y1={y0 + normH - 3.5}
              x2={x0 + normW - 4}
              y2={y0 + normH - 3.5}
              stroke="#475569"
              strokeWidth="1"
              strokeDasharray="2 1.5"
            />
          </g>
        )}

        {/* Pocket Door (REVEGO) Open Appliance Niche */}
        {isPocket && (
          <g>
            <rect
              x={x0 + 3}
              y={y0 + 3}
              width={normW - 6}
              height={normH * 0.48}
              fill="#FAF8F5"
              stroke="#78716C"
              strokeWidth="1"
            />
            <line
              x1={x0 + 2}
              y1={y0 + 2}
              x2={x0 + 2}
              y2={y0 + normH - 2}
              stroke="#B45309"
              strokeWidth="1.6"
            />
            <line
              x1={x0 + normW - 2}
              y1={y0 + 2}
              x2={x0 + normW - 2}
              y2={y0 + normH - 2}
              stroke="#B45309"
              strokeWidth="1.6"
            />
          </g>
        )}

        {/* Warm LED Lighting Glow Strip */}
        {hasLed && (
          <line
            x1={x0 + 2}
            y1={y0 + 2.5}
            x2={x0 + normW - 2}
            y2={y0 + 2.5}
            stroke="#F59E0B"
            strokeWidth="2"
            strokeLinecap="round"
          />
        )}

        {/* Glass Door Diagonal Reflection Lines */}
        {isGlassDoor && (
          <g stroke="#E2E8F0" strokeWidth="1" opacity={0.75}>
            <line
              x1={x0 + 4}
              y1={y0 + 4}
              x2={x0 + 10}
              y2={y0 + 12}
            />
            <line
              x1={x0 + normW - 9}
              y1={y0 + 5}
              x2={x0 + normW - 4}
              y2={y0 + 12}
            />
          </g>
        )}

        {/* Hanging Rail + Coat Hanger Silhouette */}
        {railCount > 0 && !isSloped && !isStairs && (
          <g opacity={isOpen || isGlassDoor ? 0.95 : 0.55}>
            <line
              x1={x0 + 2}
              y1={y0 + 5.5}
              x2={x0 + normW - 2}
              y2={y0 + 5.5}
              stroke="#475569"
              strokeWidth="1.3"
            />
            <polygon
              points={`${x0 + normW * 0.5},${y0 + 6} ${
                x0 + normW * 0.5 - 3.5
              },${y0 + 9.5} ${x0 + normW * 0.5 + 3.5},${y0 + 9.5}`}
              fill="none"
              stroke="#475569"
              strokeWidth="1"
            />
          </g>
        )}

        {/* Internal Shelves */}
        {!isOvenBase &&
          !isOvenTower &&
          !isSloped &&
          !isStairs &&
          Array.from({ length: Math.min(4, shelfCount) }).map((_, sIdx) => {
            const topOffset = railCount > 0 ? normH * 0.32 : 0;
            const usableSpan =
              normH * (drawerCount > 0 ? 0.52 : 0.78) - topOffset;
            const sy =
              y0 +
              topOffset +
              ((sIdx + 1) * Math.max(6, usableSpan)) /
                (Math.min(4, shelfCount) + 1);
            return (
              <line
                key={`sh_${sIdx}`}
                x1={x0 + 1.5}
                y1={sy}
                x2={x0 + normW - 1.5}
                y2={sy}
                stroke={isGlassDoor ? "#FDE68A" : "#B45309"}
                strokeWidth="1.2"
                opacity={isOpen || isGlassDoor ? 0.95 : 0.4}
              />
            );
          })}

        {/* Internal Drawers Cutaway Hint (SPACE TOWER / Internal Drawer) */}
        {internalDrawers.length > 0 && drawerCount === 0 && (
          <g opacity={0.65}>
            {Array.from({ length: Math.min(3, internalDrawers.length) }).map(
              (_, idx) => {
                const dh = 3.5;
                const dy = y0 + normH - 4 - (idx + 1) * (dh + 1);
                return (
                  <rect
                    key={`int_drw_${idx}`}
                    x={x0 + 3}
                    y={dy}
                    width={normW - 6}
                    height={dh}
                    fill="#FEF3C7"
                    stroke="#B45309"
                    strokeWidth="0.9"
                    strokeDasharray="2 1"
                  />
                );
              }
            )}
          </g>
        )}

        {/* Per-Bay External Drawers, Door Leaf Split Lines & Per-Leaf Handles */}
        {(() => {
          const plinthPx = isWallCab ? 0 : 2;
          const usableH = normH - plinthPx;
          const bayWidthsMm = resolvedModule
            ? calculateBayWidths(resolvedModule)
            : Array.from({ length: bays }, () => wMm / bays);
          const totalBayW = Math.max(1, bayWidthsMm.reduce((s, w) => s + w, 0));

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
            const bayExtDrawers = bayObj
              ? bayObj.drawers.filter((d) => !d.isInternal)
              : propDrawers && bIdx === bays - 1
              ? [
                  { id: "d0", elevationY: 0, height: 180 },
                  { id: "d1", elevationY: 185, height: 180 },
                ]
              : [];

            const isTopCombo =
              bayExtDrawers.length > 0 &&
              bayExtDrawers.every((d) => d.elevationY >= (hMm - 100) * 0.55);
            const dCount = Math.min(4, bayExtDrawers.length);
            const hasDoorInBay =
              !isOpen &&
              bayDoorType !== "open" &&
              bayDoorSys !== "open" &&
              !isOvenBase;

            const drawerZoneH =
              dCount === 0
                ? 0
                : !hasDoorInBay
                ? usableH - 1
                : isTopCombo
                ? Math.max(4.2, usableH * 0.26)
                : Math.min(usableH * 0.45, Math.max(5.5, dCount * 3.8));

            const doorTopY = isTopCombo
              ? y0 + drawerZoneH
              : y0 + 0.5;
            const doorBottomY =
              !isTopCombo && dCount > 0
                ? y0 + usableH - drawerZoneH
                : isOvenTower
                ? y0 + normH * 0.21
                : isMicrowaveWall
                ? y0 + normH * 0.43
                : y0 + usableH;

            const leafCount = !hasDoorInBay
              ? 0
              : bayDoorType === "double" ||
                bayDoorSys === "hinged_double" ||
                bayDoorSys === "folding_side"
              ? 2
              : 1;

            return (
              <g key={`bay_front_${bIdx}`}>
                {/* Bay right divider line */}
                {bIdx < bayWidthsMm.length - 1 && !isSloped && !isStairs && (
                  <line
                    x1={bx0 + bw}
                    y1={y0 + 0.8}
                    x2={bx0 + bw}
                    y2={y0 + usableH}
                    stroke="#1C1917"
                    strokeWidth="1.25"
                  />
                )}

                {/* Double-door center split line inside this bay */}
                {leafCount === 2 &&
                  !isLift &&
                  !isSliding &&
                  !isSloped &&
                  !isStairs &&
                  doorBottomY - doorTopY > 3 && (
                    <line
                      x1={bx0 + bw / 2}
                      y1={doorTopY}
                      x2={bx0 + bw / 2}
                      y2={doorBottomY}
                      stroke="#1C1917"
                      strokeWidth="1.15"
                    />
                  )}

                {/* Per-leaf vertical door handle marks */}
                {hasDoorInBay &&
                  !isLift &&
                  !isSliding &&
                  !isSloped &&
                  !isStairs &&
                  doorBottomY - doorTopY > 5 &&
                  (leafCount === 2 ? (
                    <>
                      <line
                        x1={bx0 + bw / 2 - 1.6}
                        y1={
                          isWallCab
                            ? doorBottomY - 4.5
                            : doorTopY + (doorBottomY - doorTopY) * 0.48
                        }
                        x2={bx0 + bw / 2 - 1.6}
                        y2={
                          isWallCab
                            ? doorBottomY - 1.8
                            : doorTopY + (doorBottomY - doorTopY) * 0.48 + 3.8
                        }
                        stroke="#1C1917"
                        strokeWidth="1.15"
                        strokeLinecap="round"
                      />
                      <line
                        x1={bx0 + bw / 2 + 1.6}
                        y1={
                          isWallCab
                            ? doorBottomY - 4.5
                            : doorTopY + (doorBottomY - doorTopY) * 0.48
                        }
                        x2={bx0 + bw / 2 + 1.6}
                        y2={
                          isWallCab
                            ? doorBottomY - 1.8
                            : doorTopY + (doorBottomY - doorTopY) * 0.48 + 3.8
                        }
                        stroke="#1C1917"
                        strokeWidth="1.15"
                        strokeLinecap="round"
                      />
                    </>
                  ) : (
                    <line
                      x1={
                        bayDoorType === "single_right" ||
                        bayDoorType === "inset_right"
                          ? bx0 + 2.2
                          : bx0 + bw - 2.2
                      }
                      y1={
                        isWallCab
                          ? doorBottomY - 4.5
                          : doorTopY + (doorBottomY - doorTopY) * 0.48
                      }
                      x2={
                        bayDoorType === "single_right" ||
                        bayDoorType === "inset_right"
                          ? bx0 + 2.2
                          : bx0 + bw - 2.2
                      }
                      y2={
                        isWallCab
                          ? doorBottomY - 1.8
                          : doorTopY + (doorBottomY - doorTopY) * 0.48 + 3.8
                      }
                      stroke="#1C1917"
                      strokeWidth="1.15"
                      strokeLinecap="round"
                    />
                  ))}

                {/* External drawers in this bay */}
                {dCount > 0 &&
                  !isOvenBase &&
                  Array.from({ length: dCount }).map((_, dIdx) => {
                    const dh = Math.max(3.2, drawerZoneH / dCount);
                    const dy = isTopCombo
                      ? y0 + 0.8 + dIdx * dh
                      : y0 + usableH - (dIdx + 1) * dh;
                    const hw = Math.max(3, Math.min(7, bw * 0.38));
                    return (
                      <g key={`drw_${bIdx}_${dIdx}`}>
                        <rect
                          x={bx0 + 0.9}
                          y={dy}
                          width={Math.max(2, bw - 1.8)}
                          height={Math.max(2, dh - 0.5)}
                          fill={frontColor}
                          stroke="#1C1917"
                          strokeWidth="1"
                        />
                        <line
                          x1={bx0 + bw / 2 - hw / 2}
                          y1={dy + (dh - 0.5) / 2}
                          x2={bx0 + bw / 2 + hw / 2}
                          y2={dy + (dh - 0.5) / 2}
                          stroke="#292524"
                          strokeWidth="1"
                          strokeLinecap="round"
                        />
                      </g>
                    );
                  })}
              </g>
            );
          });
        })()}

        {/* Lift-Up Door Horizontal Split & Upward Arrow (AVENTOS) */}
        {isLift && (
          <g>
            {doorSystemId === "lift_bi_fold" && (
              <line
                x1={x0 + 1}
                y1={y0 + normH / 2}
                x2={x0 + normW - 1}
                y2={y0 + normH / 2}
                stroke="#1C1917"
                strokeWidth="1.2"
                strokeDasharray="2.5 1.5"
              />
            )}
            <path
              d={`M ${x0 + normW / 2} ${y0 + normH - 3.5} L ${
                x0 + normW / 2
              } ${y0 + 4.5} M ${x0 + normW / 2 - 2.5} ${y0 + 7} L ${
                x0 + normW / 2
              } ${y0 + 4} L ${x0 + normW / 2 + 2.5} ${y0 + 7}`}
              fill="none"
              stroke="#78350F"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        )}

        {/* Sliding Door Track & Horizontal Arrows */}
        {isSliding && (
          <g>
            <line
              x1={x0 + 3}
              y1={y0 + normH * 0.5}
              x2={x0 + normW - 3}
              y2={y0 + normH * 0.5}
              stroke="#78350F"
              strokeWidth="1.1"
              strokeDasharray="2 2"
            />
          </g>
        )}

        {/* Plinth / Baza Line for Floor-Standing Cabinets (side panels extend to floor on wardrobes) */}
        {!isWallCab && !isSloped && !isStairs && (
          <g>
            <line
              x1={familyId?.startsWith("fam_kitchen") ? x0 : x0 + 1.8}
              y1={y0 + normH - 2}
              x2={familyId?.startsWith("fam_kitchen") ? x0 + normW : x0 + normW - 1.8}
              y2={y0 + normH - 2}
              stroke="#1C1917"
              strokeWidth="1.2"
            />
            {!familyId?.startsWith("fam_kitchen") && (
              <>
                <line
                  x1={x0 + 1.8}
                  y1={y0 + normH - 2}
                  x2={x0 + 1.8}
                  y2={y0 + normH}
                  stroke="#1C1917"
                  strokeWidth="1.1"
                />
                <line
                  x1={x0 + normW - 1.8}
                  y1={y0 + normH - 2}
                  x2={x0 + normW - 1.8}
                  y2={y0 + normH}
                  stroke="#1C1917"
                  strokeWidth="1.1"
                />
              </>
            )}
          </g>
        )}
      </svg>
    );
  }
);

V3IsometricModuleIcon.displayName = "V3IsometricModuleIcon";
export default V3IsometricModuleIcon;
