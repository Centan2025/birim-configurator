"use client";
import React from "react";
import { type BackPanelType, type MultiHoleBoringMode, type PlinthConstructionType } from "@birim/core";

export function renderPresetSvg(kind: "double_hang" | "shelves" | "hang_drawers" | "combo") {
  return (
    <div className="w-12 h-14 rounded-xl bg-[#181D27]/85 border border-white/15 flex items-center justify-center shrink-0 p-1">
      <svg viewBox="0 0 44 54" className="w-full h-full" fill="none">
        <rect x="4" y="3" width="36" height="48" rx="3.5" fill="#232A38" stroke="#94A3B8" strokeWidth="1.6" />
        {kind === "double_hang" && (
          <>
            <line x1="7" y1="11" x2="37" y2="11" stroke="#38BDF8" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M15 11 L11 19 H19 Z M29 11 L25 19 H33 Z" fill="#38BDF8" fillOpacity="0.28" stroke="#7DD3FC" strokeWidth="1.2" />
            <line x1="6" y1="26" x2="38" y2="26" stroke="#E2B47E" strokeWidth="2.2" />
            <line x1="7" y1="32" x2="37" y2="32" stroke="#38BDF8" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M15 32 L11 40 H19 Z M29 32 L25 40 H33 Z" fill="#38BDF8" fillOpacity="0.28" stroke="#7DD3FC" strokeWidth="1.2" />
          </>
        )}
        {kind === "shelves" && (
          <>
            <rect x="6" y="11" width="32" height="2.6" rx="1" fill="#E2B47E" />
            <rect x="6" y="19.5" width="32" height="2.6" rx="1" fill="#E2B47E" />
            <rect x="6" y="28" width="32" height="3.2" rx="1" fill="#38BDF8" />
            <rect x="6" y="36.5" width="32" height="2.6" rx="1" fill="#E2B47E" />
            <rect x="6" y="44" width="32" height="2.6" rx="1" fill="#E2B47E" />
          </>
        )}
        {kind === "hang_drawers" && (
          <>
            <line x1="7" y1="11" x2="37" y2="11" stroke="#38BDF8" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M22 11 L15 21 H29 Z" fill="#38BDF8" fillOpacity="0.28" stroke="#7DD3FC" strokeWidth="1.3" />
            <rect x="6.5" y="27" width="31" height="6.8" rx="1.4" fill="#334155" stroke="#94A3B8" strokeWidth="1.2" />
            <line x1="18" y1="30.4" x2="26" y2="30.4" stroke="#38BDF8" strokeWidth="1.8" strokeLinecap="round" />
            <rect x="6.5" y="35.2" width="31" height="6.8" rx="1.4" fill="#334155" stroke="#94A3B8" strokeWidth="1.2" />
            <line x1="18" y1="38.6" x2="26" y2="38.6" stroke="#38BDF8" strokeWidth="1.8" strokeLinecap="round" />
            <rect x="6.5" y="43.4" width="31" height="6.2" rx="1.4" fill="#334155" stroke="#94A3B8" strokeWidth="1.2" />
            <line x1="18" y1="46.5" x2="26" y2="46.5" stroke="#38BDF8" strokeWidth="1.8" strokeLinecap="round" />
          </>
        )}
        {kind === "combo" && (
          <>
            <rect x="6" y="11" width="32" height="2.8" rx="1" fill="#E2B47E" />
            <line x1="7" y1="19" x2="37" y2="19" stroke="#38BDF8" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M22 19 L16 28 H28 Z" fill="#38BDF8" fillOpacity="0.28" stroke="#7DD3FC" strokeWidth="1.3" />
            <rect x="6.5" y="33" width="31" height="7.5" rx="1.4" fill="#334155" stroke="#94A3B8" strokeWidth="1.2" />
            <line x1="18" y1="36.8" x2="26" y2="36.8" stroke="#38BDF8" strokeWidth="1.8" strokeLinecap="round" />
            <rect x="6.5" y="42" width="31" height="7.5" rx="1.4" fill="#334155" stroke="#94A3B8" strokeWidth="1.2" />
            <line x1="18" y1="45.8" x2="26" y2="45.8" stroke="#38BDF8" strokeWidth="1.8" strokeLinecap="round" />
          </>
        )}
      </svg>
    </div>
  );
}


export type InteriorVisualKind =
  | "shelf"
  | "fixed_shelf"
  | "drawer"
  | "internal_drawer"
  | "rail"
  | "trouser_rack"
  | "shoe_rack"
  | "sub_divider"
  | "jewelry_tray"
  | "waste_bin"
  | "spice_pullout"
  | "pantry_pullout"
  | "corner_lemans"
  | "wire_basket";


export function renderPhotorealDoorProfileArt(profileId: string) {
  const uid = `dp_${profileId.replace(/[^a-z0-9]/gi, "")}`;
  const isGlass = profileId.includes("glass");
  const isFullGlass = profileId === "full_glass" || profileId === "full_smoked_glass";
  const isMirror = profileId.includes("mirror");
  const isFramelessMirror = profileId === "mirror_frameless";
  const isShaker = profileId === "shaker" || profileId === "framed" || profileId === "classic_frame";
  const isFluted = profileId === "fluted" || profileId === "reeded" || profileId === "slatted";
  const isBevel45 = profileId === "bevel_45" || profileId === "chamfer_45" || profileId === "angled_45";
  const isJPull = profileId === "j_pull" || profileId === "j_handle";
  const isArched = profileId === "arched" || profileId === "arch_frame";
  const isCenterGlass = profileId === "center_glass_frame";
  const isOpenTopUGlass = profileId === "u_glass_open_top";

  return (
    <svg viewBox="0 0 88 56" className="w-full h-[52px] rounded-lg overflow-hidden block" fill="none">
      <defs>
        <linearGradient id={`${uid}_wood`} x1="0" y1="0" x2="1" y2="0.15">
          <stop offset="0%" stopColor="#A6825B" />
          <stop offset="18%" stopColor="#C9A882" />
          <stop offset="52%" stopColor="#D6B996" />
          <stop offset="82%" stopColor="#B8946D" />
          <stop offset="100%" stopColor="#93714C" />
        </linearGradient>
        <linearGradient id={`${uid}_side`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#7C5E3E" />
          <stop offset="100%" stopColor="#9A7853" />
        </linearGradient>
        <linearGradient id={`${uid}_glass`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3B3530" />
          <stop offset="48%" stopColor="#5C554F" />
          <stop offset="52%" stopColor="#7B746E" />
          <stop offset="100%" stopColor="#2B2724" />
        </linearGradient>
        <linearGradient id={`${uid}_mirror`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#CBD5E1" />
          <stop offset="45%" stopColor="#F8FAFC" />
          <stop offset="58%" stopColor="#E2E8F0" />
          <stop offset="100%" stopColor="#94A3B8" />
        </linearGradient>
      </defs>

      {/* Dark recessed studio backdrop */}
      <rect width="88" height="56" fill="#181C24" />

      {/* 3D Left Side Thickness Edge (perspective depth) */}
      <polygon points="12,8 20,5 20,56 12,56" fill={`url(#${uid}_side)`} />

      {/* Main Front Panel Face */}
      {isMirror ? (
        <>
          {!isFramelessMirror && <rect x="20" y="5" width="56" height="51" fill={`url(#${uid}_wood)`} />}
          <rect
            x={isFramelessMirror ? 20 : 25}
            y={isFramelessMirror ? 5 : 10}
            width={isFramelessMirror ? 56 : 46}
            height={isFramelessMirror ? 51 : 46}
            fill={`url(#${uid}_mirror)`}
            stroke="rgba(255,255,255,0.45)"
            strokeWidth="0.8"
          />
          <polygon points="32,10 46,10 26,52 22,52" fill="rgba(255,255,255,0.28)" />
        </>
      ) : isOpenTopUGlass ? (
        <>
          {/* U-Frame Open-Top Glass Drawer Front: Left + Right + Bottom wood rails, NO top wood rail */}
          <rect x="20" y="5" width="9" height="51" fill={`url(#${uid}_wood)`} />
          <rect x="67" y="5" width="9" height="51" fill={`url(#${uid}_wood)`} />
          <rect x="20" y="46" width="56" height="10" fill={`url(#${uid}_wood)`} />
          {/* Exposed Smoked Glass Panel extending all the way to the open top edge */}
          <rect
            x="29"
            y="6"
            width="38"
            height="40"
            fill={`url(#${uid}_glass)`}
            stroke="#64748B"
            strokeWidth="0.9"
          />
          {/* Crisp polished open top glass edge highlight */}
          <line x1="29" y1="6" x2="67" y2="6" stroke="rgba(226,232,240,0.85)" strokeWidth="1.4" />
          <polygon points="44,6 60,6 49,46 36,46" fill="rgba(255,255,255,0.16)" />
        </>
      ) : isGlass ? (
        <>
          {!isFullGlass && <rect x="20" y="5" width="56" height="51" fill={`url(#${uid}_wood)`} />}
          <rect
            x={isFullGlass ? 20 : isCenterGlass ? 29 : 24}
            y={isFullGlass ? 5 : isCenterGlass ? 13 : 9}
            width={isFullGlass ? 56 : isCenterGlass ? 38 : 48}
            height={isFullGlass ? 51 : isCenterGlass ? 43 : 47}
            fill={`url(#${uid}_glass)`}
            stroke={isFullGlass ? "#64748B" : "#524942"}
            strokeWidth="1.2"
          />
          <polygon points="48,9 66,9 54,55 38,55" fill="rgba(255,255,255,0.14)" />
        </>
      ) : (
        <>
          <rect x="20" y="5" width="56" height="51" fill={`url(#${uid}_wood)`} />
          {/* Subtle vertical wood grain lines */}
          <line x1="30" y1="5" x2="30" y2="56" stroke="rgba(90,62,36,0.14)" strokeWidth="0.8" />
          <line x1="46" y1="5" x2="46" y2="56" stroke="rgba(90,62,36,0.12)" strokeWidth="0.8" />
          <line x1="62" y1="5" x2="62" y2="56" stroke="rgba(90,62,36,0.14)" strokeWidth="0.8" />

          {isShaker && (
            <rect x="28" y="13" width="40" height="43" fill="rgba(70,48,28,0.18)" stroke="rgba(65,44,24,0.52)" strokeWidth="1.3" />
          )}

          {isFluted && (
            <g>
              {[24, 29, 34, 39, 44, 49, 54, 59, 64, 69, 73].map((fx) => (
                <g key={fx}>
                  <line x1={fx} y1="5" x2={fx} y2="56" stroke="rgba(52,35,18,0.68)" strokeWidth="1.8" />
                  <line x1={fx + 1.5} y1="5" x2={fx + 1.5} y2="56" stroke="rgba(255,244,228,0.22)" strokeWidth="0.8" />
                </g>
              ))}
            </g>
          )}

          {isBevel45 && (
            <>
              <polygon points="12,8 20,5 76,5 76,17 20,17 12,20" fill="rgba(255,248,236,0.24)" />
              <line x1="20" y1="17" x2="76" y2="17" stroke="rgba(60,40,20,0.55)" strokeWidth="1.3" />
            </>
          )}

          {isJPull && (
            <>
              <path d="M 24 5 V 13 Q 24 18 30 18 H 66 Q 72 18 72 13 V 5" fill="rgba(45,30,16,0.52)" stroke="rgba(255,242,224,0.28)" strokeWidth="1" />
            </>
          )}

          {isArched && (
            <path d="M 28 56 V 30 A 20 20 0 0 1 68 30 V 56" fill="rgba(68,46,24,0.18)" stroke="rgba(55,36,18,0.62)" strokeWidth="1.6" />
          )}
        </>
      )}

      {/* Subtle top specular rim */}
      <line x1="20" y1="5.5" x2="76" y2="5.5" stroke="rgba(255,255,255,0.28)" strokeWidth="0.8" />
    </svg>
  );
}

export function renderInteriorItemSvg(kind: InteriorVisualKind, itemId?: string) {
  const isWardrobeLift = itemId === "lib_wardrobe_lift";
  const isLedRail = itemId === "lib_rail_led" || itemId === "lib_led_rail";
  const isTieBelt = itemId === "lib_tie_belt";
  const uid = `ii_${kind}_${(itemId || "base").replace(/[^a-z0-9]/gi, "")}`;
  return (
    <svg
      viewBox="0 0 96 64"
      className="w-[94px] h-[62px] shrink-0 pointer-events-none"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {kind === "shelf" && (
        <>
          {/* Sistem 32 subtle vertical pin-hole guide on left */}
          <circle cx="15" cy="21" r="1.2" fill="#64748B" fillOpacity="0.65" />
          <circle cx="15" cy="26" r="1.2" fill="#64748B" fillOpacity="0.65" />
          <circle cx="15" cy="45" r="1.2" fill="#64748B" fillOpacity="0.65" />
          {/* 5mm shelf support pins tucked snugly under shelf corners */}
          <path d="M18,37.5 L22,38 L22,41 L18,40.5 Z" fill="#38BDF8" stroke="#0F172A" strokeWidth="1" />
          <path d="M54,42.3 L58,42.8 L58,45.8 L54,45.3 Z" fill="#38BDF8" stroke="#0F172A" strokeWidth="1" />
          <path d="M72,30.5 L76,28 L76,31 L72,33.5 Z" fill="#38BDF8" stroke="#0F172A" strokeWidth="1" />
          {/* Isometric 18mm wooden shelf */}
          <polygon points="14,30 32,18 78,24 60,36" fill="#EAD4B2" stroke="#A67C4E" strokeWidth="1.6" />
          <polygon points="14,30 60,36 60,41.5 14,35.5" fill="#D2AE80" stroke="#8C6438" strokeWidth="1.6" />
          <polygon points="60,36 78,24 78,29.5 60,41.5" fill="#AE8657" stroke="#73502A" strokeWidth="1.5" />
          {/* Crisp top-edge highlight */}
          <polyline points="32,18.8 15,30 59.5,35.8" stroke="#FFF7EB" strokeOpacity="0.45" strokeWidth="0.9" />
        </>
      )}

      {kind === "fixed_shelf" && (
        <>
          {/* Left & right cabinet side-wall structural anchor lines */}
          <line x1="11.5" y1="14" x2="11.5" y2="49" stroke="#475569" strokeWidth="1.5" strokeDasharray="2.5 2.5" />
          <line x1="80.5" y1="10" x2="80.5" y2="42" stroke="#475569" strokeWidth="1.5" strokeDasharray="2.5 2.5" />
          {/* Concealed heavy-duty L-bracket under left edge */}
          <path d="M12,37 L12,44 L19,40.5" stroke="#38BDF8" strokeWidth="2.2" />
          {/* Thick structural isometric shelf */}
          <polygon points="14,27 32,15 78,21 60,33" fill="#E3C496" stroke="#8C6438" strokeWidth="1.7" />
          <polygon points="14,27 60,33 60,41.5 14,35.5" fill="#C49A67" stroke="#73502A" strokeWidth="1.7" />
          <polygon points="60,33 78,21 78,29.5 60,41.5" fill="#9E7749" stroke="#634320" strokeWidth="1.6" />
          {/* Flush Minifix / dowel anchors on right side-wall edge */}
          <ellipse cx="65.5" cy="33.8" rx="2.1" ry="2.6" fill="#38BDF8" stroke="#0F172A" strokeWidth="1.1" />
          <ellipse cx="73.5" cy="28.4" rx="2.1" ry="2.6" fill="#38BDF8" stroke="#0F172A" strokeWidth="1.1" />
          {/* Subtle top chamfer highlight */}
          <polyline points="32,15.8 15,27 59.5,32.8" stroke="#FFF7EB" strokeOpacity="0.38" strokeWidth="0.9" />
        </>
      )}

      {kind === "drawer" && (
        <>
          {/* Inner drawer cavity with depth walls */}
          <polygon points="14,21 32,10 76,16 58,27" fill="#1E293B" stroke="#64748B" strokeWidth="1.4" />
          <polygon points="32,10 76,16 76,22 32,16" fill="#283548" />
          <polygon points="14,21 32,10 32,16 14,27" fill="#334155" />
          {/* Drawer outer rim thickness */}
          <polyline points="14,21 32,10 76,16" stroke="#CBD5E1" strokeWidth="1.4" />
          {/* Drawer front & right side panels */}
          <polygon points="14,21 58,27 58,50 14,44" fill="#EAD4B2" stroke="#8C6438" strokeWidth="1.7" />
          <polygon points="58,27 76,16 76,39 58,50" fill="#BA9363" stroke="#73502A" strokeWidth="1.6" />
          {/* Perspective-aligned modern bar handle matching front face slope (6/44) */}
          <polygon points="27,31.4 45,33.9 45,36.8 27,34.3" fill="#0F172A" fillOpacity="0.32" />
          <polygon points="27,30.2 45,32.7 45,35.6 27,33.1" fill="#38BDF8" stroke="#0F172A" strokeWidth="1.1" />
          <line x1="28.5" y1="31.3" x2="43.5" y2="33.4" stroke="#E0F2FE" strokeWidth="0.9" />
        </>
      )}

      {kind === "internal_drawer" && (
        <>
          {/* Subtle dashed outer cabinet door outline */}
          <rect
            x="9"
            y="8"
            width="78"
            height="48"
            rx="5"
            stroke="#64748B"
            strokeOpacity="0.6"
            strokeWidth="1.3"
            strokeDasharray="3.5 3"
          />
          {/* Inner dark tray cavity */}
          <polygon points="20,23 35,14 74,19 59,28" fill="#1E293B" stroke="#94A3B8" strokeWidth="1.4" />
          <polygon points="35,14 74,19 74,24 35,19" fill="#283548" />
          {/* Aluminum right side & tandem runner */}
          <polygon points="59,28 74,19 74,37 59,46" fill="#94A3B8" stroke="#475569" strokeWidth="1.5" />
          <line x1="60.5" y1="42.5" x2="72.8" y2="35.1" stroke="#38BDF8" strokeWidth="2.2" />
          {/* Front aluminum panel with symmetric perspective-aligned finger-pull notch */}
          <path
            d="M20,23 L32.5,24.6 C34,28.8 44,30.1 45.5,26.3 L59,28 L59,46 L20,41 Z"
            fill="#CBD5E1"
            stroke="#475569"
            strokeWidth="1.6"
          />
          {/* Subtle metallic top edge sheen */}
          <line x1="21" y1="24" x2="31.5" y2="25.4" stroke="#F8FAFC" strokeOpacity="0.65" strokeWidth="1" />
          <line x1="46.5" y1="27.3" x2="58" y2="28.8" stroke="#F8FAFC" strokeOpacity="0.65" strokeWidth="1" />
        </>
      )}

      {kind === "sub_divider" && (
        <>
          {/* Lower isometric wooden shelf */}
          <polygon points="14,43 32,32 78,38 60,49" fill="#EAD4B2" stroke="#A67C4E" strokeWidth="1.5" />
          <polygon points="14,43 60,49 60,53.5 14,47.5" fill="#D2AE80" stroke="#8C6438" strokeWidth="1.5" />
          <polygon points="60,49 78,38 78,42.5 60,53.5" fill="#AE8657" stroke="#73502A" strokeWidth="1.4" />
          {/* Central 3D vertical divider (dikme) sitting cleanly between shelves */}
          <polygon points="41.5,19 59.5,8 59.5,35.5 41.5,46.5" fill="#0284C7" stroke="#0369A1" strokeWidth="1.4" />
          <polygon points="36.5,18.3 41.5,19 41.5,46.5 36.5,45.8" fill="#38BDF8" stroke="#0369A1" strokeWidth="1.4" />
          {/* Upper isometric wooden shelf */}
          <polygon points="14,15 32,4 78,10 60,21" fill="#EAD4B2" stroke="#A67C4E" strokeWidth="1.5" />
          <polygon points="14,15 60,21 60,25.5 14,19.5" fill="#D2AE80" stroke="#8C6438" strokeWidth="1.5" />
          <polygon points="60,21 78,10 78,14.5 60,25.5" fill="#AE8657" stroke="#73502A" strokeWidth="1.4" />
          <polyline points="32,4.8 15,15 59.5,20.8" stroke="#FFF7EB" strokeOpacity="0.4" strokeWidth="0.9" />
        </>
      )}

      {kind === "wire_basket" && (
        <>
          {/* Back wire frame (dimmer for depth) */}
          <polygon points="30,14 76,20 71,39 34,34" fill="#1E293B" fillOpacity="0.45" stroke="#64748B" strokeWidth="1.3" />
          <line x1="45" y1="16" x2="46" y2="35.6" stroke="#64748B" strokeWidth="1.1" />
          <line x1="60" y1="18" x2="58.5" y2="37.3" stroke="#64748B" strokeWidth="1.1" />
          {/* Bottom wire mesh base */}
          <polygon points="19,44 34,34 71,39 56,49" fill="#0F172A" fillOpacity="0.4" stroke="#94A3B8" strokeWidth="1.3" />
          <line x1="31" y1="45.6" x2="46" y2="35.6" stroke="#64748B" strokeWidth="1" />
          <line x1="43.5" y1="47.3" x2="58.5" y2="37.3" stroke="#64748B" strokeWidth="1" />
          {/* Left side rim & telescopic rail */}
          <line x1="14" y1="24" x2="19" y2="44" stroke="#CBD5E1" strokeWidth="1.7" />
          <line x1="22" y1="19" x2="26.5" y2="39" stroke="#94A3B8" strokeWidth="1.1" />
          {/* Front wire face */}
          <polygon points="14,24 60,30 56,49 19,44" fill="#334155" fillOpacity="0.22" stroke="#E2E8F0" strokeWidth="1.8" />
          <line x1="26" y1="25.6" x2="28.5" y2="45.3" stroke="#CBD5E1" strokeWidth="1.2" />
          <line x1="37.5" y1="27.1" x2="37.5" y2="46.5" stroke="#CBD5E1" strokeWidth="1.2" />
          <line x1="49" y1="28.6" x2="46.8" y2="47.8" stroke="#CBD5E1" strokeWidth="1.2" />
          <line x1="16.5" y1="34" x2="58" y2="39.5" stroke="#94A3B8" strokeWidth="1.2" />
          {/* Right wire face */}
          <polygon points="60,30 76,20 71,39 56,49" fill="#1E293B" fillOpacity="0.3" stroke="#CBD5E1" strokeWidth="1.7" />
          <line x1="68" y1="25" x2="63.5" y2="44" stroke="#94A3B8" strokeWidth="1.2" />
          {/* Top chrome perimeter rim & right cyan telescopic runner */}
          <polygon points="14,24 30,14 76,20 60,30" fill="none" stroke="#F1F5F9" strokeWidth="1.9" />
          <line x1="59" y1="35" x2="77" y2="23.8" stroke="#38BDF8" strokeWidth="2.4" />
        </>
      )}

      {kind === "rail" && isWardrobeLift && (
        <>
          {/* Subtle pull-down motion arc */}
          <path d="M21,25 Q18,34 22,42" stroke="#38BDF8" strokeOpacity="0.5" strokeWidth="1.3" strokeDasharray="2.5 2.5" />
          <path d="M75,25 Q78,34 74,42" stroke="#38BDF8" strokeOpacity="0.5" strokeWidth="1.3" strokeDasharray="2.5 2.5" />
          {/* Telescopic pantograph lift arms */}
          <path d="M18,48 L25,16 H71 L78,48" stroke="#94A3B8" strokeWidth="3.2" />
          {/* Top chrome hanging bar */}
          <line x1="25" y1="16" x2="71" y2="16" stroke="#E2E8F0" strokeWidth="4.6" />
          <line x1="27" y1="14.7" x2="69" y2="14.7" stroke="#FFFFFF" strokeOpacity="0.55" strokeWidth="1" />
          {/* Central pull-down handle rod + T-grip */}
          <line x1="48" y1="18.5" x2="48" y2="42" stroke="#38BDF8" strokeWidth="2.4" />
          <line x1="41" y1="42" x2="55" y2="42" stroke="#38BDF8" strokeWidth="3.2" />
          {/* Downward indicator chevron */}
          <path d="M44,48 L48,52 L52,48" stroke="#7DD3FC" strokeWidth="1.8" />
          {/* Left & right side-mount pivot housings */}
          <rect x="13" y="42" width="10" height="12" rx="3" fill="#334155" stroke="#CBD5E1" strokeWidth="1.4" />
          <circle cx="18" cy="48" r="2.2" fill="#38BDF8" />
          <rect x="73" y="42" width="10" height="12" rx="3" fill="#334155" stroke="#CBD5E1" strokeWidth="1.4" />
          <circle cx="78" cy="48" r="2.2" fill="#38BDF8" />
        </>
      )}

      {kind === "rail" && isLedRail && (
        <>
          <defs>
            <linearGradient id={`${uid}_glow`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FDE047" stopOpacity="0.42" />
              <stop offset="65%" stopColor="#FDE047" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#FDE047" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Warm 3000K downward LED light cone */}
          <polygon points="18,19 78,19 90,56 6,56" fill={`url(#${uid}_glow)`} />
          {/* Mounting wall flanges */}
          <rect x="10" y="10" width="5" height="12" rx="1.5" fill="#475569" stroke="#94A3B8" strokeWidth="1.2" />
          <rect x="81" y="10" width="5" height="12" rx="1.5" fill="#475569" stroke="#94A3B8" strokeWidth="1.2" />
          {/* Aluminum oval rail */}
          <rect x="15" y="13" width="66" height="6" rx="3" fill="#CBD5E1" stroke="#64748B" strokeWidth="1.1" />
          {/* Glowing warm LED diffuser strip under rail */}
          <line x1="18" y1="19" x2="78" y2="19" stroke="#FDE047" strokeWidth="3.2" />
          <line x1="20" y1="19" x2="76" y2="19" stroke="#FEF9C3" strokeWidth="1.4" />
          {/* Contoured hollow wooden coat hanger */}
          <path d="M48,19.5 C48,22.5 51,23.5 51,25.2 C51,26.8 48,27.5 48,29.5" stroke="#CBD5E1" strokeWidth="1.8" />
          <path
            d="M48,29.5 L26,43.5 C24.5,44.5 25.2,46.8 27.2,46.8 L68.8,46.8 C70.8,46.8 71.5,44.5 70,43.5 Z"
            fill="none"
            stroke="#EAD4B2"
            strokeWidth="3.2"
          />
          <path
            d="M48,29.5 L26,43.5 C24.5,44.5 25.2,46.8 27.2,46.8 L68.8,46.8 C70.8,46.8 71.5,44.5 70,43.5 Z"
            fill="none"
            stroke="#FDE047"
            strokeOpacity="0.45"
            strokeWidth="1"
          />
        </>
      )}

      {kind === "rail" && !isWardrobeLift && !isLedRail && (
        <>
          {/* Background secondary hanger silhouette for wardrobe depth */}
          <path
            d="M60,29 L43,41.5 C41.8,42.3 42.4,44.2 44,44.2 L76,44.2 C77.6,44.2 78.2,42.3 77,41.5 Z"
            fill="none"
            stroke="#64748B"
            strokeOpacity="0.45"
            strokeWidth="2.4"
          />
          <path d="M60,18.5 C60,22 62.5,23 62.5,25 C62.5,26.5 60,27.2 60,29" stroke="#64748B" strokeOpacity="0.55" strokeWidth="1.5" />
          {/* End-mount wall flanges */}
          <rect x="10" y="10" width="5.5" height="12" rx="1.6" fill="#38BDF8" stroke="#0F172A" strokeWidth="1.1" />
          <rect x="80.5" y="10" width="5.5" height="12" rx="1.6" fill="#38BDF8" stroke="#0F172A" strokeWidth="1.1" />
          {/* Chrome oval hanging rod */}
          <rect x="15.5" y="13" width="65" height="6" rx="3" fill="#CBD5E1" stroke="#64748B" strokeWidth="1.1" />
          <line x1="18" y1="14.7" x2="78" y2="14.7" stroke="#FFFFFF" strokeOpacity="0.6" strokeWidth="1" />
          {/* Foreground contoured hollow wooden coat hanger */}
          <path d="M44,18.5 C44,22 47,23 47,25 C47,26.8 44,27.5 44,29.5" stroke="#E2E8F0" strokeWidth="1.9" />
          <path
            d="M44,29.5 L21,44.5 C19.5,45.5 20.2,48 22.2,48 L65.8,48 C67.8,48 68.5,45.5 67,44.5 Z"
            fill="none"
            stroke="#EAD4B2"
            strokeWidth="3.4"
          />
          <path
            d="M44,29.5 L21,44.5 C19.5,45.5 20.2,48 22.2,48 L65.8,48 C67.8,48 68.5,45.5 67,44.5 Z"
            fill="none"
            stroke="#A67C4E"
            strokeWidth="1.1"
          />
        </>
      )}

      {kind === "trouser_rack" && isTieBelt && (
        <>
          {/* Side-mount anodized backplate */}
          <rect x="10" y="10" width="8" height="44" rx="2.2" fill="#334155" stroke="#94A3B8" strokeWidth="1.5" />
          <circle cx="14" cy="15" r="1.3" fill="#64748B" />
          <circle cx="14" cy="49" r="1.3" fill="#64748B" />
          {/* Pull-out chrome rail + cyan handle tip */}
          <line x1="18" y1="17" x2="82" y2="17" stroke="#CBD5E1" strokeWidth="3.4" />
          <circle cx="83" cy="17" r="2.8" fill="#38BDF8" stroke="#0F172A" strokeWidth="1" />
          {/* Necktie 1 (warm beige) */}
          <line x1="30" y1="18.5" x2="30" y2="23" stroke="#94A3B8" strokeWidth="1.5" />
          <polygon points="27.5,23 32.5,23 31.3,27 28.7,27" fill="#D2AE80" stroke="#73502A" strokeWidth="1.1" />
          <polygon points="28.7,27 31.3,27 34,46 30,52 26,46" fill="#EAD4B2" stroke="#8C6438" strokeWidth="1.2" />
          <line x1="27.5" y1="36" x2="32.5" y2="33" stroke="#A67C4E" strokeWidth="1" />
          <line x1="27" y1="42" x2="33" y2="39" stroke="#A67C4E" strokeWidth="1" />
          {/* Necktie 2 (slate blue) */}
          <line x1="47" y1="18.5" x2="47" y2="23" stroke="#94A3B8" strokeWidth="1.5" />
          <polygon points="44.5,23 49.5,23 48.3,27 45.7,27" fill="#0284C7" stroke="#0F172A" strokeWidth="1.1" />
          <polygon points="45.7,27 48.3,27 51,46 47,52 43,46" fill="#38BDF8" stroke="#0369A1" strokeWidth="1.2" />
          <line x1="44.5" y1="36" x2="49.5" y2="33" stroke="#E0F2FE" strokeOpacity="0.65" strokeWidth="1" />
          <line x1="44" y1="42" x2="50" y2="39" stroke="#E0F2FE" strokeOpacity="0.65" strokeWidth="1" />
          {/* Leather belt with metallic buckle */}
          <line x1="66" y1="18.5" x2="66" y2="22" stroke="#94A3B8" strokeWidth="1.5" />
          <rect x="61.5" y="22" width="9" height="6.5" rx="1.5" fill="none" stroke="#E2E8F0" strokeWidth="1.8" />
          <line x1="66" y1="22" x2="66" y2="26" stroke="#E2E8F0" strokeWidth="1.3" />
          <path d="M62.5,28.5 L69.5,28.5 L69.5,48.5 C69.5,50.5 62.5,50.5 62.5,48.5 Z" fill="#8C6438" stroke="#5C3D1E" strokeWidth="1.3" />
          <circle cx="66" cy="36" r="1" fill="#EAD4B2" />
          <circle cx="66" cy="41" r="1" fill="#EAD4B2" />
          <circle cx="66" cy="46" r="1" fill="#EAD4B2" />
        </>
      )}

      {kind === "trouser_rack" && !isTieBelt && (
        <>
          {/* Back isometric frame rail */}
          <polyline points="12,21 30,10 82,17" stroke="#94A3B8" strokeWidth="2.2" />
          {/* 3 Isometric draped trousers following the exact depth vector (+16, -10) */}
          {[
            { x: 22, y: 20, fill: "#CBD5E1", back: "#64748B", stroke: "#475569" },
            { x: 38, y: 22.2, fill: "#94A3B8", back: "#475569", stroke: "#334155" },
            { x: 54, y: 24.4, fill: "#E2E8F0", back: "#94A3B8", stroke: "#475569" },
          ].map((t, idx) => (
            <g key={idx}>
              {/* Rear trouser leg peek */}
              <polygon
                points={`${t.x + 12},${t.y - 7.5} ${t.x + 21},${t.y - 6.3} ${t.x + 21},${t.y + 19} ${t.x + 12},${t.y + 18}`}
                fill={t.back}
                stroke={t.stroke}
                strokeWidth="1.2"
              />
              {/* Front draped trouser leg */}
              <polygon
                points={`${t.x},${t.y} ${t.x + 12},${t.y - 7.5} ${t.x + 12},${t.y + 24} ${t.x},${t.y + 31.5}`}
                fill={t.fill}
                stroke={t.stroke}
                strokeWidth="1.4"
              />
              {/* Crisp tailored center crease */}
              <line
                x1={t.x + 6}
                y1={t.y - 1.5}
                x2={t.x + 6}
                y2={t.y + 27.5}
                stroke={t.stroke}
                strokeOpacity="0.45"
                strokeWidth="1"
              />
            </g>
          ))}
          {/* Front isometric aluminum frame & cyan right telescopic rail */}
          <line x1="12" y1="21" x2="64" y2="28" stroke="#E2E8F0" strokeWidth="2.4" />
          <line x1="64" y1="28" x2="82" y2="17" stroke="#38BDF8" strokeWidth="2.8" />
        </>
      )}

      {kind === "shoe_rack" && (
        <>
          {/* Side vertical rack posts */}
          <line x1="14" y1="16" x2="14" y2="54" stroke="#64748B" strokeWidth="2.4" />
          <line x1="82" y1="10" x2="82" y2="48" stroke="#64748B" strokeWidth="2.4" />
          {/* Upper angled metal shelf + front heel-stop lip */}
          <line x1="14" y1="30" x2="82" y2="21" stroke="#38BDF8" strokeWidth="3.2" />
          <line x1="14" y1="26.5" x2="14" y2="30" stroke="#7DD3FC" strokeWidth="2.6" />
          {/* Upper tier shoes (tilted flush with shelf angle ~ -7.5 deg) */}
          <g transform="translate(21, 17.5) rotate(-7.5)">
            <path d="M0,9 L1,3 C3,3.5 5,4.5 7,2 L13,5.5 C17,6 20,7.2 21,9.5 L0,9.5 Z" fill="#EAD4B2" stroke="#8C6438" strokeWidth="1.3" />
            <line x1="0" y1="9.5" x2="21" y2="9.5" stroke="#F8FAFC" strokeWidth="1.6" />
          </g>
          <g transform="translate(50, 13.7) rotate(-7.5)">
            <path d="M0,9 L1,3 C3,3.5 5,4.5 7,2 L13,5.5 C17,6 20,7.2 21,9.5 L0,9.5 Z" fill="#EAD4B2" stroke="#8C6438" strokeWidth="1.3" />
            <line x1="0" y1="9.5" x2="21" y2="9.5" stroke="#F8FAFC" strokeWidth="1.6" />
          </g>
          {/* Lower angled metal shelf + front heel-stop lip */}
          <line x1="14" y1="50" x2="82" y2="41" stroke="#38BDF8" strokeWidth="3.2" />
          <line x1="14" y1="46.5" x2="14" y2="50" stroke="#7DD3FC" strokeWidth="2.6" />
          {/* Lower tier shoes */}
          <g transform="translate(21, 37.5) rotate(-7.5)">
            <path d="M0,9 L1,3 C3,3.5 5,4.5 7,2 L13,5.5 C17,6 20,7.2 21,9.5 L0,9.5 Z" fill="#CBD5E1" stroke="#475569" strokeWidth="1.3" />
            <line x1="0" y1="9.5" x2="21" y2="9.5" stroke="#38BDF8" strokeWidth="1.5" />
          </g>
          <g transform="translate(50, 33.7) rotate(-7.5)">
            <path d="M0,9 L1,3 C3,3.5 5,4.5 7,2 L13,5.5 C17,6 20,7.2 21,9.5 L0,9.5 Z" fill="#CBD5E1" stroke="#475569" strokeWidth="1.3" />
            <line x1="0" y1="9.5" x2="21" y2="9.5" stroke="#38BDF8" strokeWidth="1.5" />
          </g>
        </>
      )}

      {kind === "jewelry_tray" && (
        <>
          {/* Complete closed 3D isometric shallow organizer tray */}
          {/* Recessed velvet interior */}
          <polygon points="12,26 30,13 82,20 64,33" fill="#1E293B" stroke="#A67C4E" strokeWidth="1.8" />
          {/* Front wooden frame face */}
          <polygon points="12,26 64,33 64,43 12,36" fill="#D2AE80" stroke="#8C6438" strokeWidth="1.7" />
          {/* Right wooden frame face (closed 3D box!) */}
          <polygon points="64,33 82,20 82,30 64,43" fill="#AE8657" stroke="#73502A" strokeWidth="1.6" />
          {/* Isometric velvet compartment dividers */}
          <line x1="30" y1="28.3" x2="48" y2="15.4" stroke="#64748B" strokeWidth="1.5" />
          <line x1="47.5" y1="30.7" x2="65.5" y2="17.8" stroke="#64748B" strokeWidth="1.5" />
          <line x1="21" y1="19.5" x2="73" y2="26.5" stroke="#64748B" strokeWidth="1.5" />
          {/* Subtle jewelry accents inside compartments */}
          {/* Ring rolls & gold ring */}
          <ellipse cx="30" cy="23.5" rx="3.2" ry="1.9" fill="none" stroke="#FDE047" strokeWidth="1.6" />
          <circle cx="30" cy="21.6" r="1.1" fill="#FEF9C3" />
          {/* Watch / brooch in center */}
          <ellipse cx="47.5" cy="24.5" rx="3.5" ry="2.2" fill="#38BDF8" stroke="#E2E8F0" strokeWidth="1.2" />
          {/* Earrings in back right */}
          <circle cx="57" cy="20.5" r="1.6" fill="#FDE047" />
          <circle cx="62" cy="21.2" r="1.6" fill="#FDE047" />
          {/* Top-edge frame highlight */}
          <polyline points="12.5,26 64,33 81.5,20.3" stroke="#EAD4B2" strokeOpacity="0.6" strokeWidth="1.1" />
        </>
      )}

      {kind === "waste_bin" && (
        <>
          {/* Pull-out base runner frame */}
          <polygon points="10,48 26,38 84,45 68,55" fill="#1E293B" stroke="#38BDF8" strokeWidth="1.8" />
          {/* Left bin (isometric) */}
          <polygon points="18,22 30,15 48,17.5 36,24.5" fill="#475569" stroke="#CBD5E1" strokeWidth="1.4" />
          <polygon points="18,22 36,24.5 35,47 20,45" fill="#64748B" stroke="#CBD5E1" strokeWidth="1.5" />
          <polygon points="36,24.5 48,17.5 46,40 35,47" fill="#334155" stroke="#94A3B8" strokeWidth="1.4" />
          {/* Right bin (isometric, cyan recycling rim) */}
          <polygon points="44,25.5 56,18.5 74,21 62,28" fill="#1E293B" stroke="#38BDF8" strokeWidth="1.6" />
          <polygon points="44,25.5 62,28 61,50.5 46,48.5" fill="#475569" stroke="#94A3B8" strokeWidth="1.5" />
          <polygon points="62,28 74,21 72,43.5 61,50.5" fill="#334155" stroke="#64748B" strokeWidth="1.4" />
        </>
      )}

      {kind === "spice_pullout" && (
        <>
          {/* Narrow isometric 2-tier bottle pullout frame */}
          <polygon points="26,10 42,6 68,10 52,14" fill="none" stroke="#94A3B8" strokeWidth="1.4" />
          <line x1="26" y1="10" x2="26" y2="52" stroke="#CBD5E1" strokeWidth="1.8" />
          <line x1="52" y1="14" x2="52" y2="56" stroke="#38BDF8" strokeWidth="2.1" />
          <line x1="68" y1="10" x2="68" y2="48" stroke="#94A3B8" strokeWidth="1.6" />
          {/* Upper tier tray & bottles */}
          <polygon points="26,28 42,24 68,28 52,32" fill="#334155" stroke="#CBD5E1" strokeWidth="1.5" />
          <rect x="34" y="16" width="6" height="11" rx="1.5" fill="#EAD4B2" stroke="#8C6438" strokeWidth="1.1" />
          <rect x="35.5" y="13" width="3" height="3" fill="#CBD5E1" />
          <rect x="44" y="17.5" width="6" height="11" rx="1.5" fill="#38BDF8" stroke="#0369A1" strokeWidth="1.1" />
          <rect x="45.5" y="14.5" width="3" height="3" fill="#E2E8F0" />
          {/* Lower tier tray & bottles */}
          <polygon points="26,50 42,46 68,50 52,54" fill="#334155" stroke="#38BDF8" strokeWidth="1.6" />
          <rect x="34" y="38" width="6" height="11" rx="1.5" fill="#CBD5E1" stroke="#475569" strokeWidth="1.1" />
          <rect x="44" y="39.5" width="6" height="11" rx="1.5" fill="#EAD4B2" stroke="#8C6438" strokeWidth="1.1" />
        </>
      )}

      {kind === "pantry_pullout" && (
        <>
          {/* Central tall chrome pantry column */}
          <line x1="48" y1="5" x2="48" y2="59" stroke="#38BDF8" strokeWidth="3.2" />
          {/* 3 stacked isometric pull-out baskets */}
          {[14, 30, 46].map((y) => (
            <g key={y}>
              <polygon points={`22,${y} 36,${y - 6} 74,${y - 1} 60,${y + 5}`} fill="#334155" stroke="#CBD5E1" strokeWidth="1.5" />
              <polygon points={`22,${y} 60,${y + 5} 60,${y + 10} 22,${y + 5}`} fill="#94A3B8" stroke="#475569" strokeWidth="1.3" />
              <polygon points={`60,${y + 5} 74,${y - 1} 74,${y + 4} 60,${y + 10}`} fill="#64748B" stroke="#475569" strokeWidth="1.2" />
            </g>
          ))}
        </>
      )}

      {kind === "corner_lemans" && (
        <>
          {/* Pivot swing arm */}
          <path d="M22,48 L34,36" stroke="#38BDF8" strokeWidth="3" />
          <circle cx="22" cy="48" r="3.5" fill="#0284C7" stroke="#E2E8F0" strokeWidth="1.4" />
          {/* Isometric kidney-shaped LeMans II tray (base + raised chrome gallery rail) */}
          <path
            d="M18,36 C24,18 60,16 74,28 C82,36 70,48 48,46 C34,45 24,42 18,36 Z"
            fill="#94A3B8"
            stroke="#475569"
            strokeWidth="1.5"
          />
          <path
            d="M18,32 C24,14 60,12 74,24 C82,32 70,44 48,42 C34,41 24,38 18,32 Z"
            fill="#E2E8F0"
            stroke="#38BDF8"
            strokeWidth="2"
          />
          <circle cx="35" cy="31" r="3" fill="#0284C7" stroke="#FFFFFF" strokeWidth="1.2" />
        </>
      )}
    </svg>
  );
}


export function renderHardwareTechnicalSvg(id: string) {
  return (
    <svg width="20" height="18" viewBox="0 0 20 18" fill="none" className="shrink-0">
      {id === "wooden_undermount" && (
        <>
          <rect x="4" y="2" width="4" height="11" stroke="currentColor" strokeWidth="1.2" />
          <line x1="8" y1="10.5" x2="17" y2="10.5" stroke="currentColor" strokeWidth="1.2" />
          <rect x="5" y="13" width="6" height="3" fill="currentColor" fillOpacity="0.35" stroke="currentColor" strokeWidth="1" />
        </>
      )}
      {id === "metal_box_legrabox" && (
        <>
          <rect x="4" y="2" width="2.2" height="12" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1.2" />
          <line x1="6.2" y1="12" x2="17" y2="12" stroke="currentColor" strokeWidth="1.3" />
          <rect x="4" y="14" width="5" height="2" fill="currentColor" />
        </>
      )}
      {id === "metal_box_tandembox" && (
        <>
          <path d="M4 3h2.2l1.8 9v2H4V3Z" fill="currentColor" fillOpacity="0.22" stroke="currentColor" strokeWidth="1.2" />
          <line x1="8" y1="12" x2="17" y2="12" stroke="currentColor" strokeWidth="1.3" />
          <line x1="5" y1="4.5" x2="16" y2="4.5" stroke="currentColor" strokeWidth="1" strokeDasharray="2 1" />
        </>
      )}
      {id === "metal_box_avantech" && (
        <>
          <rect x="4" y="2.5" width="3" height="11.5" stroke="currentColor" strokeWidth="1.2" />
          <line x1="5.5" y1="3" x2="5.5" y2="13.5" stroke="currentColor" strokeWidth="0.9" strokeOpacity="0.5" />
          <line x1="7" y1="12" x2="17" y2="12" stroke="currentColor" strokeWidth="1.3" />
        </>
      )}
      {id === "auto_155_hinge" && (
        <>
          <rect x="2.5" y="2" width="3" height="14" stroke="currentColor" strokeWidth="1.1" />
          <path d="M5.5 7h5l3.5 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="15.5" cy="13" r="2" stroke="currentColor" strokeWidth="1.2" />
        </>
      )}
      {id === "spacer_block_25mm" && (
        <>
          <rect x="2.5" y="2" width="3" height="14" stroke="currentColor" strokeWidth="1.1" />
          <rect x="5.5" y="6" width="4" height="5" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1" />
          <line x1="9.5" y1="8.5" x2="16.5" y2="8.5" stroke="currentColor" strokeWidth="1.4" />
        </>
      )}
      {id === "blind_panel_filler" && (
        <>
          <rect x="2" y="2" width="2.5" height="14" stroke="currentColor" strokeWidth="1.1" />
          <rect x="7.5" y="4.5" width="2.5" height="11.5" fill="currentColor" fillOpacity="0.22" stroke="currentColor" strokeWidth="1.1" />
          <rect x="4.5" y="2" width="5.5" height="2.5" fill="currentColor" fillOpacity="0.45" stroke="currentColor" strokeWidth="1" />
          <line x1="10" y1="10" x2="17" y2="10" stroke="currentColor" strokeWidth="1.4" />
        </>
      )}
      {id === "minifix_dowel" && (
        <>
          <circle cx="12" cy="9" r="3.5" stroke="currentColor" strokeWidth="1.2" />
          <line x1="3" y1="9" x2="8.5" y2="9" stroke="currentColor" strokeWidth="1.4" />
          <line x1="10.5" y1="7.5" x2="13.5" y2="10.5" stroke="currentColor" strokeWidth="1.1" />
        </>
      )}
      {id === "rafix_20" && (
        <>
          <circle cx="13" cy="9" r="4" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="1.2" />
          <line x1="3" y1="9" x2="9" y2="9" stroke="currentColor" strokeWidth="1.5" />
        </>
      )}
      {id === "oval_30x15" && (
        <>
          <ellipse cx="10" cy="9" rx="3.2" ry="5.5" stroke="currentColor" strokeWidth="1.3" />
          <line x1="2" y1="9" x2="18" y2="9" stroke="currentColor" strokeWidth="1" strokeOpacity="0.4" />
        </>
      )}
      {id === "round_25" && (
        <circle cx="10" cy="9" r="4.5" stroke="currentColor" strokeWidth="1.4" />
      )}
      {id === "led_black_30x15" && (
        <>
          <rect x="4" y="4" width="12" height="6" rx="2" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.2" />
          <line x1="6" y1="11.5" x2="14" y2="11.5" stroke="#D97706" strokeWidth="2" strokeLinecap="round" />
        </>
      )}
      {id === "brass_25" && (
        <circle cx="10" cy="9" r="4.5" fill="#D97706" fillOpacity="0.25" stroke="#B45309" strokeWidth="1.4" />
      )}
      {id === "lift_pantograph" && (
        <>
          <path d="M4 15V7h12v8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M10 7v6M8 11.5L10 13.5l2-2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </>
      )}
      {id === "pullout_front" && (
        <>
          <line x1="3" y1="5" x2="17" y2="5" stroke="currentColor" strokeWidth="1.3" />
          <path d="M7 9h7M12 7l2 2-2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </>
      )}
      {id === "tie_belt_rack" && (
        <>
          <line x1="4" y1="5" x2="16" y2="5" stroke="currentColor" strokeWidth="1.3" />
          <path d="M6 5v7M10 5v8M14 5v7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

export function renderPlinthIcon(id: PlinthConstructionType) {
  return (
    <svg width="52" height="36" viewBox="0 0 52 36" fill="none" className="mx-auto shrink-0">
      {/* Ground line */}
      <line x1="4" y1="32.5" x2="48" y2="32.5" stroke="currentColor" strokeWidth="1.4" strokeOpacity="0.4" strokeLinecap="round" />
      {id === "pedestal_box" && (
        <>
          {/* Cabinet carcass resting ON TOP of recessed pedestal plinth */}
          <rect x="8" y="4" width="36" height="18.5" rx="2" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="1.6" />
          <line x1="26" y1="5" x2="26" y2="21.5" stroke="currentColor" strokeWidth="1" strokeOpacity="0.35" />
          {/* Independent pedestal box underneath */}
          <rect x="13" y="22.5" width="26" height="10" rx="1" fill="currentColor" fillOpacity="0.42" stroke="currentColor" strokeWidth="1.5" />
        </>
      )}
      {id === "adjustable_legs_clip" && (
        <>
          {/* Cabinet carcass on DIN 68935 adjustable legs + clip-on front plinth */}
          <rect x="8" y="4" width="36" height="18.5" rx="2" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="1.6" />
          <line x1="26" y1="5" x2="26" y2="21.5" stroke="currentColor" strokeWidth="1" strokeOpacity="0.35" />
          {/* Left & Right adjustable legs with foot pads */}
          <rect x="13" y="22.5" width="2.8" height="8" rx="0.8" fill="currentColor" fillOpacity="0.88" />
          <rect x="10.5" y="30" width="7.8" height="2.4" rx="1" fill="currentColor" />
          <rect x="36.2" y="22.5" width="2.8" height="8" rx="0.8" fill="currentColor" fillOpacity="0.88" />
          <rect x="33.7" y="30" width="7.8" height="2.4" rx="1" fill="currentColor" />
          {/* Clip-on front plinth strip */}
          <rect x="17.5" y="25.5" width="17" height="3.2" rx="1" fill="currentColor" fillOpacity="0.28" stroke="currentColor" strokeWidth="1.1" strokeDasharray="2.5 1.8" />
        </>
      )}
      {id === "gable_rails" && (
        <>
          {/* Interior carcass cavity */}
          <rect x="12" y="5" width="28" height="17" fill="currentColor" fillOpacity="0.12" />
          {/* Full-height left & right side gables extending ALL THE WAY TO FLOOR */}
          <rect x="8" y="4" width="4.2" height="28.5" rx="1.2" fill="currentColor" fillOpacity="0.92" />
          <rect x="39.8" y="4" width="4.2" height="28.5" rx="1.2" fill="currentColor" fillOpacity="0.92" />
          {/* Top & raised bottom deck between floor-standing gables */}
          <line x1="12" y1="5.2" x2="40" y2="5.2" stroke="currentColor" strokeWidth="1.6" />
          <line x1="12" y1="22" x2="40" y2="22" stroke="currentColor" strokeWidth="1.7" />
          {/* Recessed inset plinth rail between gables */}
          <rect x="12.5" y="22.5" width="27" height="9.5" fill="currentColor" fillOpacity="0.24" stroke="currentColor" strokeWidth="1.1" strokeDasharray="2.5 2" />
        </>
      )}
    </svg>
  );
}

export function renderMultiHoleIcon(id: MultiHoleBoringMode) {
  const ys =
    id === "full_system_32"
      ? [5.5, 9.3, 13.1, 16.9, 20.7, 24.5]
      : id === "zone_32"
      ? [9, 13, 17, 21]
      : id === "cluster_5"
      ? [7, 11, 15, 19, 23]
      : id === "cluster_3"
      ? [10.5, 15, 19.5]
      : id === "single_pin"
      ? [16.5]
      : [];
  const showShelfLine = id === "cluster_5" || id === "cluster_3" || id === "single_pin";
  return (
    <svg width="34" height="30" viewBox="0 0 34 30" fill="none" className="mx-auto shrink-0">
      {/* Side panel frame */}
      <rect
        x="6"
        y="2"
        width="22"
        height="26"
        rx="2.5"
        fill="currentColor"
        fillOpacity="0.1"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      {/* Zone boundary guides for zone_32 */}
      {id === "zone_32" && (
        <>
          <line x1="8.5" y1="6" x2="25.5" y2="6" stroke="currentColor" strokeWidth="1" strokeOpacity="0.35" strokeDasharray="2 2" />
          <line x1="8.5" y1="24" x2="25.5" y2="24" stroke="currentColor" strokeWidth="1" strokeOpacity="0.35" strokeDasharray="2 2" />
        </>
      )}
      {/* Shelf reference bar for cluster / single_pin modes */}
      {showShelfLine && (
        <rect
          x="8.5"
          y={id === "single_pin" ? 11.5 : 13.6}
          width="17"
          height="2.4"
          rx="1"
          fill="currentColor"
          fillOpacity="0.35"
        />
      )}
      {ys.map((y) => {
        const isCenterHole = showShelfLine && Math.abs(y - 15) < 2;
        const r = id === "single_pin" ? 1.85 : isCenterHole ? 1.55 : 1.35;
        return (
          <React.Fragment key={y}>
            <circle cx="12" cy={y} r={r} fill="currentColor" fillOpacity={isCenterHole ? 1 : 0.9} />
            <circle cx="22" cy={y} r={r} fill="currentColor" fillOpacity={isCenterHole ? 1 : 0.9} />
          </React.Fragment>
        );
      })}
      {id === "none" && (
        <line
          x1="10"
          y1="23"
          x2="24"
          y2="7"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeOpacity="0.65"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

export function renderInternalDrawerSolutionIcon(
  id: "blind_panel_filler" | "auto_155_hinge" | "spacer_block_25mm"
) {
  return (
    <svg width="38" height="28" viewBox="0 0 38 28" fill="none" className="mx-auto shrink-0">
      {id === "blind_panel_filler" && (
        <>
          {/* Outer carcass side panel */}
          <rect x="4" y="3" width="4" height="22" rx="1" fill="currentColor" fillOpacity="0.28" stroke="currentColor" strokeWidth="1.4" />
          {/* Blind front filler strip */}
          <rect x="8" y="3" width="9" height="4" rx="0.8" fill="currentColor" fillOpacity="0.88" />
          {/* Inner blind divider */}
          <rect x="13" y="7" width="4" height="18" rx="0.8" fill="currentColor" fillOpacity="0.48" stroke="currentColor" strokeWidth="1.3" />
          {/* Drawer box + runner cleared */}
          <rect x="19" y="10" width="15" height="11" rx="1.5" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="1.4" />
          <line x1="17" y1="15.5" x2="19" y2="15.5" stroke="currentColor" strokeWidth="1.6" />
        </>
      )}
      {id === "auto_155_hinge" && (
        <>
          {/* Side panel */}
          <rect x="4" y="3" width="4.5" height="22" rx="1" fill="currentColor" fillOpacity="0.28" stroke="currentColor" strokeWidth="1.4" />
          {/* 155° articulated zero-protrusion hinge arm */}
          <path d="M8.5 10h7l5.5 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="22.5" cy="18.5" r="3" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1.5" />
          {/* Open arc indicator */}
          <path d="M12 6a9 9 0 0 1 11 4" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 2" strokeOpacity="0.65" />
          {/* Clear pull-out arrow */}
          <path d="M27 12h6m-2.5-2.5L33 12l-2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {id === "spacer_block_25mm" && (
        <>
          {/* Side panel */}
          <rect x="4" y="3" width="4.5" height="22" rx="1" fill="currentColor" fillOpacity="0.28" stroke="currentColor" strokeWidth="1.4" />
          {/* 25mm spacer block under runner */}
          <rect x="8.5" y="10" width="6.5" height="8" rx="1" fill="currentColor" fillOpacity="0.65" stroke="currentColor" strokeWidth="1.3" />
          {/* Drawer box mounted on spacer */}
          <rect x="17" y="9" width="16" height="10" rx="1.5" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="1.4" />
          <line x1="15" y1="14" x2="17" y2="14" stroke="currentColor" strokeWidth="1.6" />
        </>
      )}
    </svg>
  );
}

export function renderBackPanelIcon(id: BackPanelType) {
  return (
    <svg width="24" height="18" viewBox="0 0 24 18" fill="none" className="mx-auto shrink-0">
      {id === "grooved" && (
        <>
          <path d="M4 2v14h4v-3h2v-2H8V2H4Z" stroke="currentColor" strokeWidth="1.2" />
          <rect x="7" y="11" width="13" height="2" fill="currentColor" fillOpacity="0.85" />
        </>
      )}
      {id === "rebated" && (
        <>
          <path d="M4 2v14h2.5v-3H8V2H4Z" stroke="currentColor" strokeWidth="1.2" />
          <rect x="6.5" y="13" width="13.5" height="2.2" fill="currentColor" fillOpacity="0.85" />
        </>
      )}
      {id === "flush" && (
        <>
          <rect x="4" y="2" width="3.5" height="14" stroke="currentColor" strokeWidth="1.2" />
          <rect x="7.5" y="12.5" width="12.5" height="3.5" fill="currentColor" fillOpacity="0.85" />
        </>
      )}
      {id === "nailed" && (
        <>
          <rect x="4" y="2" width="3.5" height="11.5" stroke="currentColor" strokeWidth="1.2" />
          <rect x="4" y="13.5" width="16" height="2.2" fill="currentColor" fillOpacity="0.85" />
        </>
      )}
      {id === "none" && (
        <>
          <rect x="4" y="2" width="3.5" height="13" stroke="currentColor" strokeWidth="1.2" />
          <line x1="8" y1="14.5" x2="20" y2="14.5" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 2" />
        </>
      )}
    </svg>
  );
}

export function renderLedPlacementIcon(id: string, isSel: boolean) {
  const glow = isSel ? "#FEF3C7" : "#D97706";
  return (
    <svg width="24" height="22" viewBox="0 0 24 22" fill="none" className="shrink-0">
      <rect x="3" y="2" width="18" height="18" rx="1.2" stroke="currentColor" strokeWidth="1.3" strokeOpacity="0.65" />
      {(id === "led_profile" || id === "full_showcase") && (
        <>
          <line x1="5" y1="4.5" x2="19" y2="4.5" stroke={glow} strokeWidth="2" strokeLinecap="round" />
          <line x1="5" y1="11.5" x2="19" y2="11.5" stroke={glow} strokeWidth="1.6" strokeLinecap="round" />
        </>
      )}
      {(id === "led_vertical_strip" || id === "full_showcase") && (
        <>
          <line x1="5.5" y1="4.5" x2="5.5" y2="18" stroke={glow} strokeWidth="1.8" strokeLinecap="round" />
          <line x1="18.5" y1="4.5" x2="18.5" y2="18" stroke={glow} strokeWidth="1.8" strokeLinecap="round" />
        </>
      )}
      {id === "led_rod_strip" && (
        <>
          <line x1="4.5" y1="7.5" x2="19.5" y2="7.5" stroke="currentColor" strokeWidth="1.4" />
          <line x1="6" y1="9" x2="18" y2="9" stroke={glow} strokeWidth="2" strokeLinecap="round" />
          <path d="M9 10.5l-1 4M12 10.5v4.5M15 10.5l1 4" stroke={glow} strokeWidth="1" strokeOpacity="0.7" />
        </>
      )}
    </svg>
  );
}

export function renderDoorTypeIcon(id: string) {
  return (
    <svg width="24" height="22" viewBox="0 0 24 22" fill="none" className="mx-auto shrink-0">
      <rect x="3" y="2" width="18" height="18" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
      {id === "double" && (
        <>
          <line x1="12" y1="2" x2="12" y2="20" stroke="currentColor" strokeWidth="1.2" />
          <line x1="10.2" y1="9" x2="10.2" y2="13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <line x1="13.8" y1="9" x2="13.8" y2="13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </>
      )}
      {id === "single_left" && (
        <>
          <path d="M3 2l18 9-18 9" stroke="currentColor" strokeWidth="1" strokeDasharray="2 1.5" strokeOpacity="0.75" />
          <line x1="18.5" y1="9" x2="18.5" y2="13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </>
      )}
      {id === "single_right" && (
        <>
          <path d="M21 2L3 11l18 9" stroke="currentColor" strokeWidth="1" strokeDasharray="2 1.5" strokeOpacity="0.75" />
          <line x1="5.5" y1="9" x2="5.5" y2="13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </>
      )}
      {id === "sliding" && (
        <>
          <line x1="12" y1="2" x2="12" y2="20" stroke="currentColor" strokeWidth="1.1" strokeOpacity="0.6" />
          <path d="M6 11h4M8.5 9.2L10 11l-1.5 1.8M18 11h-4M15.5 9.2L14 11l1.5 1.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {id === "tambour" && (
        <>
          <line x1="5" y1="5.5" x2="19" y2="5.5" stroke="currentColor" strokeWidth="1.1" />
          <line x1="5" y1="8.5" x2="19" y2="8.5" stroke="currentColor" strokeWidth="1.1" />
          <line x1="5" y1="11.5" x2="19" y2="11.5" stroke="currentColor" strokeWidth="1.1" />
          <path d="M12 14v4M10.2 16.2L12 18l1.8-1.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </>
      )}
      {id === "folding" && (
        <>
          <polyline points="4,18 11,10 19,18" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
          <line x1="11" y1="2.5" x2="11" y2="19.5" stroke="currentColor" strokeWidth="1.1" strokeDasharray="2 1.5" />
        </>
      )}
      {id === "open" && (
        <>
          <line x1="3" y1="8" x2="21" y2="8" stroke="currentColor" strokeWidth="1.2" />
          <line x1="3" y1="14" x2="21" y2="14" stroke="currentColor" strokeWidth="1.2" />
        </>
      )}
    </svg>
  );
}

export function renderDoorProfileIcon(id: string) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="shrink-0">
      <rect x="4" y="2" width="16" height="20" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
      {id === "shaker_frame" && (
        <rect x="7" y="5" width="10" height="14" stroke="currentColor" strokeWidth="1.2" />
      )}
      {id === "fluted_ribbed" && (
        <>
          <line x1="7.5" y1="3.5" x2="7.5" y2="20.5" stroke="currentColor" strokeWidth="1.1" />
          <line x1="10.5" y1="3.5" x2="10.5" y2="20.5" stroke="currentColor" strokeWidth="1.1" />
          <line x1="13.5" y1="3.5" x2="13.5" y2="20.5" stroke="currentColor" strokeWidth="1.1" />
          <line x1="16.5" y1="3.5" x2="16.5" y2="20.5" stroke="currentColor" strokeWidth="1.1" />
        </>
      )}
      {id === "bevel_45" && (
        <path d="M4 6h16M7 2v4M17 2v4" stroke="currentColor" strokeWidth="1.2" />
      )}
      {id === "j_pull_bevel" && (
        <path d="M4 6.5h16M7 6.5c0-2.2 1.2-3.5 3.5-3.5h3c2.3 0 3.5 1.3 3.5 3.5" stroke="currentColor" strokeWidth="1.2" />
      )}
      {id === "cove_arch" && (
        <path d="M7 19V9a5 5 0 0 1 10 0v10H7Z" stroke="currentColor" strokeWidth="1.2" />
      )}
      {id === "custom_cad_profile" && (
        <>
          <rect x="6.5" y="4.5" width="11" height="15" stroke="currentColor" strokeWidth="1.1" strokeDasharray="2 1.5" />
          <path d="M9.5 12h5M12 9.5v5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </>
      )}
      {id === "glass_frame" && (
        <>
          <rect x="6.5" y="4.5" width="11" height="15" stroke="currentColor" strokeWidth="1.1" />
          <line x1="9" y1="14" x2="15" y2="8" stroke="currentColor" strokeWidth="1.1" strokeOpacity="0.6" />
          <line x1="11" y1="16" x2="15" y2="12" stroke="currentColor" strokeWidth="1.1" strokeOpacity="0.6" />
        </>
      )}
      {id === "full_smoked_glass" && (
        <>
          <rect x="4" y="2" width="16" height="20" rx="1.2" fill="currentColor" fillOpacity="0.16" />
          <line x1="8" y1="15" x2="16" y2="7" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.7" />
          <line x1="10.5" y1="17" x2="16.5" y2="11" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.7" />
        </>
      )}
      {id === "center_glass_frame" && (
        <>
          <rect x="7.5" y="5.5" width="9" height="13" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="1.2" />
          <line x1="9.5" y1="13" x2="14.5" y2="8" stroke="currentColor" strokeWidth="1" strokeOpacity="0.65" />
        </>
      )}
      {id === "u_glass_open_top" && (
        <>
          <path d="M7.5 2v16.5h9V2" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="1.2" />
          <line x1="9.5" y1="13" x2="14.5" y2="8" stroke="currentColor" strokeWidth="1" strokeOpacity="0.65" />
        </>
      )}
      {(id === "mirror_door" || id === "mirror_frameless") && (
        <>
          {id === "mirror_door" && (
            <rect x="6" y="4" width="12" height="16" stroke="currentColor" strokeWidth="1" strokeOpacity="0.55" />
          )}
          <line x1="8" y1="16" x2="16" y2="8" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.65" />
          <line x1="11" y1="18" x2="17" y2="12" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.65" />
        </>
      )}
    </svg>
  );
}
