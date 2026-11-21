"use client";

import { createPortal } from "react-dom";
import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  SlidersHorizontal,
  Plus,
  Minus,
  Trash2,
  Check,
  Sparkles,
  Copy,
  RotateCw,
  ArrowUpFromLine,
  MoreHorizontal,
  Lightbulb,
  Scissors,
  BookmarkPlus,
  Lock,
  ArrowUpDown,
} from "lucide-react";
import {
  calculateFourSpaceDimensions,
  classifyCabinetPlacementZone,
  getCompatibleInteriorElementsForModuleBay,
  isHandleProfileCompatibleWithModuleBay,
  resolveMultiHoleSpec,
  type CompatibleInteriorElementKey,
  type BackPanelType,
  type CarcassJoineryTopology,
  type DoorCrossSectionProfile,
  type DrawerBoxSystemType,
  type EngineeringValidationFinding,
  type FixedShelfConnectorType,
  type HandleCategory,
  type HangingRailConfig,
  type JointType,
  type MaterialDefinition,
  type ModuleInstance,
  type MultiHoleBoringMode,
  type PlinthConstructionType,
  type RemediationProposal,
  type SpecialFittingConfig,
} from "@birim/core";
import { calculateSlopedCeilingGeometry } from "@birim/core";
import type { HandleProfileDefinition } from "@birim/catalog";
import { useConfiguratorStore, type UserExperienceTier } from "../store/useConfiguratorStore";
import {
  V11_DOOR_PROFILES,
  V11_INTERIOR_PRESETS,
  V11_MATERIAL_GROUPS,
  filterMaterialsByGroup,
  formatFindingForTier,
  type V11InspectorTab,
  type V11MaterialGroup,
} from "./v11Constants";
import {
  CustomDoorSketchEditor,
  type CustomDoorProfilePreset,
} from "./CustomDoorSketchEditor";
import { getBayShelfIntervalsForSubDivider } from "../v3/adapter/useV3Adapter";
import { InspectorSelectedPartCard } from "./InspectorSelectedPartCard";
import { HandleCrossSectionSvg, getHandleCrossSectionMeta } from "./HandleCrossSectionSvg";
import { RightHardwareLibraryPanel } from "./RightHardwareLibraryPanel";

export interface RightParametricInspectorProps {
  selectedPartSlot?: React.ReactNode;
  isOpen: boolean;
  onToggleOpen: () => void;
  activeTab: V11InspectorTab;
  onChangeTab: (tab: V11InspectorTab) => void;
  experienceTier: UserExperienceTier;
  onChangeExperienceTier?: (tier: UserExperienceTier) => void;
  modules: ModuleInstance[];
  activeModule: ModuleInstance;
  activeModuleIndex: number;
  activeBayIndex: number;
  materials: MaterialDefinition[];
  handleProfiles: HandleProfileDefinition[];
  engineeringFindings: EngineeringValidationFinding[];
  facadeGrainContinuity: boolean;
  onToggleFacadeGrainContinuity: (enabled: boolean) => void;
  onRunAutoFillersAndCrown: () => void;
  onOpenCutoutModal: () => void;
  onSaveModuleAsTemplate: (name: string) => void;
  onAddCustomMaterial: (input: {
    name: string;
    category: MaterialDefinition["category"];
    colorHex: string;
    roughness: number;
    costPerM2: number;
    hasGrain?: boolean;
  }) => void;
  onSelectModuleIndex: (idx: number) => void;
  onSelectBayIndex: (idx: number) => void;
  onSetDimensions: (w: number, h: number, d: number) => void;
  onBeginSliderDrag?: () => void;
  onCommitSliderDrag?: () => void;
  onSetPlinthHeight: (h: number) => void;
  onSplitBayIntoTwo: (bayIdx: number) => void;
  onEqualizeBaysAndShelves: () => void;
  onRemoveBayAt: (bayIdx: number) => void;
  onSetBayCustomWidth: (bayIdx: number, widthMm: number | null) => void;
  onApplyBayPreset: (
    bayIdx: number,
    presetId: "rail_double" | "shelves_5" | "rail_drawers_3" | "mixed_combo",
    options?: {
      shelfCount?: number;
      shelfMountMode?: "auto" | "all_adjustable" | "all_fixed";
      shelfThicknessMm?: 18 | 25;
    }
  ) => void;
  onAddShelf: (bayIdx: number) => void;
  onAddFixedShelf: (bayIdx: number) => void;
  onSetShelfMountType: (
    bayIdx: number,
    shelfId: string,
    isAdjustable: boolean,
    fixedConnectorType?: FixedShelfConnectorType
  ) => void;
  onRemoveShelf: (bayIdx: number, shelfId: string) => void;
  onSetShelfElevation: (bayIdx: number, shelfId: string, elevMm: number) => void;
  onSetShelfThickness: (bayIdx: number, shelfId: string | "all", thicknessMm: number) => void;
  onAddDrawer: (bayIdx: number) => void;
  onAddInternalDrawer: (bayIdx: number) => void;
  onSetDrawerPlacement?: (
    bayIdx: number,
    drawerId: string,
    newElevationY?: number,
    newHeight?: number,
    pushHistory?: boolean,
    hardwareUpdates?: { isInternal?: boolean }
  ) => void;
  onRemoveDrawer: (bayIdx: number, drawerId: string) => void;
  onAddHangingRail: (bayIdx: number) => void;
  onRemoveHangingRail: (bayIdx: number, railId: string) => void;
  onSetHangingRailProfile?: (
    bayIdx: number,
    railId: string,
    profileType: HangingRailConfig["profileType"]
  ) => void;
  onAddSpecialFitting: (bayIdx: number, fittingType: SpecialFittingConfig["type"]) => void;
  onRemoveSpecialFitting: (bayIdx: number, fittingId: string) => void;
  onAddSubDivider: (bayIdx: number) => void;
  onSetSubDividerPlacement?: (
    bayIdx: number,
    subId: string,
    updates: { offsetX?: number; elevationY?: number; height?: number; targetMidY?: number }
  ) => void;
  onRemoveSubDivider: (bayIdx: number, subId: string) => void;
  onSetBayDoorType: (
    bayIdx: number,
    type: "single_left" | "single_right" | "double" | "sliding" | "tambour" | "open"
  ) => void;
  onSetSlidingMountingType: (
    mode: "inset_inside" | "top_hung_exposed" | "top_hung_pelmet" | "coplanar_flush"
  ) => void;
  onSetBayV4DoorConfig: (
    bayIdx: number,
    updates: {
      crossSectionProfile?: DoorCrossSectionProfile;
      customCadPolygon?: Array<{ x: number; y: number }>;
      customCadProfileName?: string;
      isGlassFramed?: boolean;
      handleCategory?: HandleCategory;
      handleProfileId?: string;
      handleMaterialId?: string;
      handleLengthMm?: number;
      handleOrientation?: "auto" | "vertical" | "horizontal";
      softClose?: boolean;
      frontFillerLeftMm?: number;
      frontFillerRightMm?: number;
      frontFillerPosition?: "coplanar_front" | "recessed_inner";
      hardwareProductId?: string;
    }
  ) => void;
  onCopyDoorToAllBays: (sourceBayIdx: number) => void;
  onCopyBayInteriorToAllBays?: (sourceBayIdx: number) => void;
  onMirrorModuleBays?: () => void;
  onUpdateCarcassConfig: (patch: Partial<ModuleInstance["carcass"]>) => void;
  onApplyMaterialScope: (
    scope: "doors" | "carcass" | "all_module",
    materialId: string
  ) => void;
  onToggleModuleLed: (
    enabled: boolean,
    opts?: {
      ledType?: "led_profile" | "led_vertical_strip" | "led_rod_strip" | "full_showcase";
      colorTempK?: 2700 | 3000 | 4000;
      sensorType?: "ir_door" | "pir_motion" | "manual_switch";
      frontSetbackMm?: number;
      shelfSetbackMm?: number;
      alignShelfAndSide?: boolean;
      channelWidthMm?: number;
      channelDepthMm?: number;
    }
  ) => void;
  onApplyApprovedFix: (proposal: RemediationProposal) => void;
  onDuplicateActiveModule: () => void;
  onAddStackedTopModule: () => void;
  onRotateActiveModule90: () => void;
  onRemoveActiveModule: () => void;
  onOpenCustomHardwareModal: () => void;
}

function renderPresetSvg(kind: "double_hang" | "shelves" | "hang_drawers" | "combo") {
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


type InteriorVisualKind =
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


function renderPhotorealDoorProfileArt(profileId: string) {
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
  const isCenterGlass = profileId === "center_glass_frame" || profileId === "u_glass_open_top";

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

function renderInteriorItemSvg(kind: InteriorVisualKind, itemId?: string) {
  const isWardrobeLift = itemId === "lib_wardrobe_lift";
  const isLedRail = itemId === "lib_led_rail";
  const isTieBelt = itemId === "lib_tie_belt";
  return (
    <svg viewBox="0 0 88 58" className="w-[92px] h-[62px] shrink-0 pointer-events-none" fill="none">
      {kind === "shelf" && (
        <>
          <polygon points="10,30 28,16 78,22 60,36" fill="#E8CFA8" stroke="#B68B56" strokeWidth="2" />
          <polygon points="10,30 60,36 60,43 10,37" fill="#C49E6E" stroke="#9C7443" strokeWidth="2" />
          <polygon points="60,36 78,22 78,29 60,43" fill="#A58052" stroke="#8C673A" strokeWidth="1.8" />
          {/* 32mm Cyan Shelf Support Pins */}
          <circle cx="18" cy="43" r="3.4" fill="#38BDF8" stroke="#0F172A" strokeWidth="1.4" />
          <circle cx="52" cy="47" r="3.4" fill="#38BDF8" stroke="#0F172A" strokeWidth="1.4" />
          <circle cx="71" cy="34" r="2.8" fill="#38BDF8" stroke="#0F172A" strokeWidth="1.4" />
        </>
      )}
      {kind === "fixed_shelf" && (
        <>
          <polygon points="10,27 28,13 78,19 60,33" fill="#DFBE8F" stroke="#8C673A" strokeWidth="2.1" />
          <polygon points="10,27 60,33 60,43 10,37" fill="#B58D59" stroke="#75532B" strokeWidth="2.1" />
          <polygon points="60,33 78,19 78,29 60,43" fill="#926E41" stroke="#6B4A24" strokeWidth="1.8" />
          {/* Heavy Minifix Cam Lock & Dowel Indicators */}
          <circle cx="22" cy="34" r="4" fill="#38BDF8" stroke="#0F172A" strokeWidth="1.6" />
          <path d="M20 34 H24 M22 32 V36" stroke="#0F172A" strokeWidth="1.5" />
          <circle cx="48" cy="37" r="4" fill="#38BDF8" stroke="#0F172A" strokeWidth="1.6" />
          <path d="M46 37 H50 M48 35 V39" stroke="#0F172A" strokeWidth="1.5" />
        </>
      )}
      {kind === "drawer" && (
        <>
          <polygon points="12,19 30,8 74,14 56,25" fill="#475569" stroke="#94A3B8" strokeWidth="1.8" />
          <polygon points="12,19 56,25 56,48 12,42" fill="#E8CFA8" stroke="#9C7443" strokeWidth="2" />
          <polygon points="56,25 74,14 74,37 56,48" fill="#C49E6E" stroke="#8C673A" strokeWidth="1.8" />
          <rect x="26" y="30" width="16" height="4" rx="2" fill="#38BDF8" stroke="#0F172A" strokeWidth="1.1" />
        </>
      )}
      {kind === "internal_drawer" && (
        <>
          <rect x="8" y="8" width="72" height="42" rx="4" stroke="#64748B" strokeWidth="1.5" strokeDasharray="4 3" />
          <polygon points="16,23 32,14 72,19 56,28" fill="#334155" stroke="#94A3B8" strokeWidth="1.6" />
          <path d="M16,23 L29,25 C31,30 41,31 43,27 L56,28 L56,44 L16,39 Z" fill="#CBD5E1" stroke="#475569" strokeWidth="1.9" />
          <polygon points="56,28 72,19 72,35 56,44" fill="#94A3B8" stroke="#475569" strokeWidth="1.6" />
        </>
      )}
      {kind === "rail" && isWardrobeLift && (
        <>
          {/* Telescopic Pull-Down Wardrobe Lift Arms + Down Arrow */}
          <path d="M16 48 L22 16 H66 L72 48" stroke="#94A3B8" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="22" y1="16" x2="66" y2="16" stroke="#38BDF8" strokeWidth="4.5" strokeLinecap="round" />
          <line x1="44" y1="18" x2="44" y2="44" stroke="#38BDF8" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M38 38 L44 46 L50 38" stroke="#38BDF8" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="16" cy="48" r="4" fill="#475569" stroke="#CBD5E1" strokeWidth="1.5" />
          <circle cx="72" cy="48" r="4" fill="#475569" stroke="#CBD5E1" strokeWidth="1.5" />
        </>
      )}
      {kind === "rail" && isLedRail && (
        <>
          {/* Glowing 3000K Warm LED Cone under Hanging Rail */}
          <polygon points="16,20 72,20 82,52 6,52" fill="#FDE047" fillOpacity="0.22" />
          <line x1="12" y1="18" x2="76" y2="18" stroke="#CBD5E1" strokeWidth="5.5" strokeLinecap="round" />
          <line x1="16" y1="20.5" x2="72" y2="20.5" stroke="#FDE047" strokeWidth="3.2" strokeLinecap="round" />
          <path d="M44 21 C44 26 40 27 40 30" stroke="#CBD5E1" strokeWidth="2" />
          <polygon points="44,30 27,45 61,45" fill="#E8CFA8" stroke="#FDE047" strokeWidth="1.8" />
        </>
      )}
      {kind === "rail" && !isWardrobeLift && !isLedRail && (
        <>
          <line x1="10" y1="14" x2="78" y2="14" stroke="#CBD5E1" strokeWidth="5" strokeLinecap="round" />
          <rect x="8" y="9" width="5" height="10" rx="1.5" fill="#38BDF8" />
          <rect x="75" y="9" width="5" height="10" rx="1.5" fill="#38BDF8" />
          <path d="M44,14 C44,20 40,21 40,24" stroke="#94A3B8" strokeWidth="2.2" />
          <polygon points="44,24 22,46 66,46" fill="#E8CFA8" stroke="#B68B56" strokeWidth="2.1" />
        </>
      )}
      {kind === "trouser_rack" && isTieBelt && (
        <>
          {/* Side-Mount Pull-Out Tie & Belt Hook Rack */}
          <rect x="10" y="10" width="8" height="38" rx="2" fill="#475569" stroke="#94A3B8" strokeWidth="1.6" />
          <line x1="18" y1="18" x2="76" y2="18" stroke="#38BDF8" strokeWidth="3.6" strokeLinecap="round" />
          {[28, 40, 52, 64].map((hx) => (
            <g key={hx}>
              <line x1={hx} y1="18" x2={hx} y2="26" stroke="#CBD5E1" strokeWidth="2" />
              <polygon points={`${hx},26 ${hx - 4},46 ${hx},50 ${hx + 4},46`} fill="#E8CFA8" stroke="#9C7443" strokeWidth="1.4" />
            </g>
          ))}
        </>
      )}
      {kind === "trouser_rack" && !isTieBelt && (
        <>
          <polygon points="10,17 26,8 78,14 62,23" fill="none" stroke="#38BDF8" strokeWidth="2.6" />
          <rect x="20" y="18" width="11" height="30" rx="2" fill="#E2E8F0" stroke="#475569" strokeWidth="1.7" />
          <rect x="37" y="20" width="11" height="30" rx="2" fill="#CBD5E1" stroke="#475569" strokeWidth="1.7" />
          <rect x="54" y="22" width="11" height="29" rx="2" fill="#94A3B8" stroke="#334155" strokeWidth="1.7" />
        </>
      )}
      {kind === "shoe_rack" && (
        <>
          <line x1="12" y1="29" x2="76" y2="19" stroke="#38BDF8" strokeWidth="3.6" strokeLinecap="round" />
          <line x1="12" y1="47" x2="76" y2="37" stroke="#38BDF8" strokeWidth="3.6" strokeLinecap="round" />
          <path d="M22 25 C22 18 34 18 38 23 Z" fill="#E8CFA8" stroke="#9C7443" strokeWidth="1.8" />
          <path d="M46 21 C46 14 58 14 62 19 Z" fill="#E8CFA8" stroke="#9C7443" strokeWidth="1.8" />
          <path d="M24 43 C24 36 36 36 40 41 Z" fill="#CBD5E1" stroke="#475569" strokeWidth="1.8" />
          <path d="M48 39 C48 32 60 32 64 37 Z" fill="#CBD5E1" stroke="#475569" strokeWidth="1.8" />
        </>
      )}
      {kind === "sub_divider" && (
        <>
          <rect x="10" y="8" width="68" height="7" rx="2" fill="#E8CFA8" stroke="#9C7443" strokeWidth="1.8" />
          <rect x="10" y="43" width="68" height="7" rx="2" fill="#E8CFA8" stroke="#9C7443" strokeWidth="1.8" />
          <rect x="39" y="15" width="10" height="28" rx="1.5" fill="#38BDF8" stroke="#0284C7" strokeWidth="1.8" />
        </>
      )}
      {kind === "jewelry_tray" && (
        <>
          <polygon points="10,27 28,12 78,18 60,33" fill="#334155" stroke="#38BDF8" strokeWidth="2" />
          <line x1="26" y1="29" x2="44" y2="14" stroke="#94A3B8" strokeWidth="1.6" />
          <line x1="43" y1="31" x2="61" y2="16" stroke="#94A3B8" strokeWidth="1.6" />
          <line x1="19" y1="19.5" x2="69" y2="25.5" stroke="#94A3B8" strokeWidth="1.6" />
          <circle cx="34" cy="21" r="2.6" fill="#FDE047" />
          <circle cx="52" cy="23" r="2.6" fill="#38BDF8" />
          <polygon points="10,27 60,33 60,42 10,36" fill="#C49E6E" stroke="#8C673A" strokeWidth="1.9" />
        </>
      )}
      {kind === "waste_bin" && (
        <>
          <rect x="16" y="12" width="24" height="34" rx="3" fill="#475569" stroke="#CBD5E1" strokeWidth="2" />
          <rect x="46" y="12" width="24" height="34" rx="3" fill="#334155" stroke="#38BDF8" strokeWidth="2" />
          <line x1="10" y1="48" x2="78" y2="48" stroke="#94A3B8" strokeWidth="3" strokeLinecap="round" />
        </>
      )}
      {kind === "spice_pullout" && (
        <>
          <rect x="26" y="6" width="36" height="46" rx="3" fill="#334155" stroke="#38BDF8" strokeWidth="2" />
          <line x1="28" y1="22" x2="60" y2="22" stroke="#94A3B8" strokeWidth="2.2" />
          <line x1="28" y1="37" x2="60" y2="37" stroke="#94A3B8" strokeWidth="2.2" />
          <rect x="33" y="11" width="7" height="10" rx="1.5" fill="#E8CFA8" />
          <rect x="44" y="11" width="7" height="10" rx="1.5" fill="#38BDF8" />
          <rect x="33" y="26" width="7" height="10" rx="1.5" fill="#CBD5E1" />
          <rect x="44" y="26" width="7" height="10" rx="1.5" fill="#E8CFA8" />
        </>
      )}
      {kind === "pantry_pullout" && (
        <>
          <line x1="44" y1="5" x2="44" y2="53" stroke="#38BDF8" strokeWidth="3.2" />
          <rect x="20" y="10" width="48" height="8" rx="2" fill="#CBD5E1" stroke="#475569" strokeWidth="1.8" />
          <rect x="20" y="25" width="48" height="8" rx="2" fill="#CBD5E1" stroke="#475569" strokeWidth="1.8" />
          <rect x="20" y="40" width="48" height="8" rx="2" fill="#CBD5E1" stroke="#475569" strokeWidth="1.8" />
        </>
      )}
      {kind === "corner_lemans" && (
        <>
          <path d="M16 34 C24 14, 64 14, 70 32 C74 44, 42 48, 22 38 Z" fill="#CBD5E1" stroke="#38BDF8" strokeWidth="2.4" />
          <circle cx="30" cy="32" r="4" fill="#2563EB" stroke="#FFFFFF" strokeWidth="1.5" />
        </>
      )}
      {kind === "wire_basket" && (
        <>
          <polygon points="14,18 74,18 66,44 22,44" fill="#334155" fillOpacity="0.6" stroke="#CBD5E1" strokeWidth="2.4" />
          <line x1="28" y1="18" x2="30" y2="44" stroke="#94A3B8" strokeWidth="1.8" />
          <line x1="44" y1="18" x2="44" y2="44" stroke="#94A3B8" strokeWidth="1.8" />
          <line x1="60" y1="18" x2="58" y2="44" stroke="#94A3B8" strokeWidth="1.8" />
          <line x1="18" y1="31" x2="70" y2="31" stroke="#38BDF8" strokeWidth="1.6" />
        </>
      )}
    </svg>
  );
}

function startLiveMaterialDrag(
  e: React.PointerEvent<HTMLElement>,
  mat: MaterialDefinition,
  onClickFallback: () => void
) {
  if (e.button !== 0) return;
  const startX = e.clientX;
  const startY = e.clientY;
  let dragging = false;
  let swatchEl: HTMLDivElement | null = null;

  const ensureSwatch = () => {
    if (swatchEl || typeof document === "undefined") return;
    const el = document.createElement("div");
    el.setAttribute("data-testid", "live-material-cursor-swatch");
    el.style.position = "fixed";
    el.style.left = "0px";
    el.style.top = "0px";
    el.style.width = "38px";
    el.style.height = "38px";
    el.style.borderRadius = "12px";
    el.style.backgroundColor = mat.colorHex;
    if (mat.hasGrain) {
      el.style.backgroundImage =
        "repeating-linear-gradient(90deg, rgba(255,255,255,0.12) 0px, rgba(0,0,0,0.1) 3px, transparent 8px)";
    }
    el.style.border = "2.5px solid #2563EB";
    el.style.boxShadow = "0 10px 24px rgba(20, 20, 19, 0.28)";
    el.style.pointerEvents = "none";
    el.style.zIndex = "99999";
    el.style.willChange = "transform";
    document.body.appendChild(el);
    swatchEl = el;
  };

  const onMove = (ev: PointerEvent) => {
    if (!dragging) {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 6) return;
      dragging = true;
      document.body.dataset.birimUiDragging = "1";
      document.body.style.cursor = "copy";
      ensureSwatch();
    }
    if (swatchEl) {
      swatchEl.style.transform = `translate3d(${Math.round(ev.clientX - 19)}px, ${Math.round(ev.clientY - 19)}px, 0)`;
    }
  };

  const cleanup = () => {
    if (swatchEl) {
      swatchEl.remove();
      swatchEl = null;
    }
    delete document.body.dataset.birimUiDragging;
    document.body.style.cursor = "";
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", cleanup);
  };

  const onUp = (ev: PointerEvent) => {
    const wasDragging = dragging;
    cleanup();
    if (!wasDragging) {
      onClickFallback();
      return;
    }
    window.dispatchEvent(
      new CustomEvent("birim:live-material-drop", {
        detail: {
          materialId: mat.id,
          materialName: mat.name,
          clientX: ev.clientX,
          clientY: ev.clientY,
        },
      })
    );
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", cleanup);
}

function startLive3DPartGrab(
  e: React.PointerEvent<HTMLElement>,
  spec: { id: string; title: string; visual: string },
  onClickFallback: () => void
) {
  if (e.button !== 0) return;
  e.preventDefault();
  const startX = e.clientX;
  const startY = e.clientY;
  let dragging3D = false;
  let rafId = 0;
  let latestX = startX;
  let latestY = startY;

  const inspectorAside = (e.currentTarget as HTMLElement).closest("aside");
  const sourceBtn = e.currentTarget as HTMLElement;
  let cursorGhostEl: HTMLDivElement | null = null;

  const ensureCursorGhost = () => {
    if (cursorGhostEl || typeof document === "undefined") return;
    const ghost = document.createElement("div");
    ghost.setAttribute("data-testid", "live-part-cursor-ghost");
    ghost.style.position = "fixed";
    ghost.style.left = "0px";
    ghost.style.top = "0px";
    ghost.style.pointerEvents = "none";
    ghost.style.zIndex = "99999";
    ghost.style.filter = "drop-shadow(0 8px 16px rgba(20, 20, 19, 0.24))";
    ghost.style.willChange = "transform";

    const v = spec.visual;
    const isFixed = spec.id === "lib_fixed_shelf";
    let svgMarkup = "";
    if (v === "sub_divider") {
      // 3D isometric miniature vertical divider panel
      svgMarkup = `<svg width="46" height="84" viewBox="0 0 46 84" fill="none">
        <polygon points="8,14 24,4 38,10 22,20" fill="#F5EFE6" stroke="#2563EB" stroke-width="1.5"/>
        <polygon points="8,14 22,20 22,80 8,74" fill="#E6DAC8" stroke="#2563EB" stroke-width="1.5"/>
        <polygon points="22,20 38,10 38,70 22,80" fill="#D5C4AC" stroke="#2563EB" stroke-width="1.5"/>
      </svg>`;
    } else if (v === "rail") {
      // 3D isometric chrome hanging rail with end flanges
      svgMarkup = `<svg width="118" height="36" viewBox="0 0 118 36" fill="none">
        <ellipse cx="10" cy="24" rx="5" ry="7" fill="#64748B" stroke="#1E293B" stroke-width="1.4"/>
        <path d="M10 21 L104 7 L108 13 L14 27 Z" fill="#E2E8F0" stroke="#2563EB" stroke-width="1.6"/>
        <ellipse cx="106" cy="10" rx="5" ry="7" fill="#475569" stroke="#1E293B" stroke-width="1.4"/>
      </svg>`;
    } else if (v === "drawer" || v === "internal_drawer") {
      // 3D isometric drawer box with front + handle
      const frontFill = v === "internal_drawer" ? "#EDE7DC" : "#E5D3BA";
      const sideFill = "#CBB597";
      svgMarkup = `<svg width="124" height="64" viewBox="0 0 124 64" fill="none">
        <polygon points="6,20 34,6 118,6 90,20" fill="#F7F3EB" stroke="#2563EB" stroke-width="1.6"/>
        <polygon points="90,20 118,6 118,40 90,56" fill="${sideFill}" stroke="#2563EB" stroke-width="1.6"/>
        <rect x="6" y="20" width="84" height="36" rx="2" fill="${frontFill}" stroke="#2563EB" stroke-width="1.8"/>
        <rect x="34" y="35" width="28" height="4.5" rx="2" fill="#1E293B"/>
      </svg>`;
    } else if (v === "trouser_rack" || v === "shoe_rack" || v === "jewelry_tray") {
      // 3D isometric pullout rack / tray
      svgMarkup = `<svg width="120" height="44" viewBox="0 0 120 44" fill="none">
        <polygon points="8,18 34,6 114,6 88,18" fill="#E2E8F0" stroke="#2563EB" stroke-width="1.6"/>
        <line x1="28" y1="12" x2="100" y2="12" stroke="#64748B" stroke-width="2"/>
        <rect x="8" y="18" width="80" height="14" rx="2" fill="#CBD5E1" stroke="#2563EB" stroke-width="1.6"/>
        <polygon points="88,18 114,6 114,20 88,32" fill="#94A3B8" stroke="#2563EB" stroke-width="1.6"/>
      </svg>`;
    } else {
      // 3D isometric shelf plank (Hareketli Raf / Sabit Raf)
      const h = isFixed ? 12 : 9;
      svgMarkup = `<svg width="126" height="42" viewBox="0 0 126 42" fill="none">
        <polygon points="6,20 34,6 120,6 92,20" fill="#F6F1E7" stroke="#2563EB" stroke-width="1.6"/>
        <rect x="6" y="20" width="86" height="${h}" rx="1.5" fill="#E6DAC8" stroke="#2563EB" stroke-width="1.7"/>
        <polygon points="92,20 120,6 120,${6 + h} 92,${20 + h}" fill="#CEBCA3" stroke="#2563EB" stroke-width="1.6"/>
      </svg>`;
    }
    ghost.style.transition = "opacity 120ms ease";
    ghost.innerHTML = svgMarkup;
    void sourceBtn;
    document.body.appendChild(ghost);
    cursorGhostEl = ghost;
  };

  const updateCursorGhostPos = (x: number, y: number) => {
    if (!cursorGhostEl) return;
    const w = cursorGhostEl.offsetWidth || 100;
    const h = cursorGhostEl.offsetHeight || 24;
    cursorGhostEl.style.transform = `translate3d(${Math.round(x - w / 2)}px, ${Math.round(y - h / 2)}px, 0)`;
  };

  const flushMove = () => {
    rafId = 0;
    window.dispatchEvent(
      new CustomEvent("birim:live-3d-part-move", {
        detail: {
          id: spec.id,
          title: spec.title,
          visual: spec.visual,
          clientX: latestX,
          clientY: latestY,
        },
      })
    );
  };

  const onSnappedInBay = (ev: Event) => {
    const active = Boolean((ev as CustomEvent<{ active?: boolean }>).detail?.active);
    if (cursorGhostEl) {
      cursorGhostEl.style.opacity = active ? "0" : "1";
    }
  };

  const onMove = (ev: PointerEvent) => {
    latestX = ev.clientX;
    latestY = ev.clientY;
    if (!dragging3D) {
      if (Math.hypot(latestX - startX, latestY - startY) < 6) return;
      dragging3D = true;
      document.body.dataset.birimUiDragging = "1";
      document.body.style.cursor = "grabbing";
      ensureCursorGhost();
      window.addEventListener("birim:live-part-snapped-in-bay", onSnappedInBay);
    }
    updateCursorGhostPos(latestX, latestY);
    if (!rafId) {
      rafId = window.requestAnimationFrame(flushMove);
    }
  };

  const cleanup = () => {
    if (rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    }
    if (cursorGhostEl) {
      cursorGhostEl.remove();
      cursorGhostEl = null;
    }
    delete document.body.dataset.birimUiDragging;
    document.body.style.cursor = "";
    window.removeEventListener("birim:live-part-snapped-in-bay", onSnappedInBay);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onCancel);
    window.removeEventListener("keydown", onKeyDown);
  };

  let dropFinished = false;
  const onCancel = () => {
    if (dropFinished) return;
    dropFinished = true;
    cleanup();
    if (dragging3D) {
      window.dispatchEvent(new CustomEvent("birim:live-3d-part-cancel"));
    }
  };

  const onKeyDown = (ke: KeyboardEvent) => {
    if (ke.key === "Escape") {
      onCancel();
    }
  };

  const onUp = (ev: PointerEvent) => {
    const wasDragging = dragging3D;
    cleanup();
    if (!wasDragging) {
      onClickFallback();
      return;
    }
    // If dropped back onto the right inspector panel itself, cancel instead of placing
    if (inspectorAside) {
      const r = inspectorAside.getBoundingClientRect();
      if (
        ev.clientX >= r.left &&
        ev.clientX <= r.right &&
        ev.clientY >= r.top &&
        ev.clientY <= r.bottom
      ) {
        window.dispatchEvent(new CustomEvent("birim:live-3d-part-cancel"));
        return;
      }
    }
    window.dispatchEvent(
      new CustomEvent("birim:live-3d-part-drop", {
        detail: {
          id: spec.id,
          title: spec.title,
          visual: spec.visual,
          clientX: ev.clientX,
          clientY: ev.clientY,
          dropId: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        },
      })
    );
  };

  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onCancel);
  window.addEventListener("keydown", onKeyDown);
}

const StudioToggleSwitch: React.FC<{
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  size?: "sm" | "md";
  testId?: string;
  title?: string;
}> = ({ checked, onChange, label, size = "md", testId, title }) => {
  const isSm = size === "sm";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      data-testid={testId}
      title={title}
      onClick={() => onChange(!checked)}
      className="birim-switch-wrapper inline-flex items-center gap-2 shrink-0 select-none cursor-pointer group bg-transparent border-0 p-0"
    >
      {label && (
        <span className="birim-switch-label text-[11px] font-semibold text-slate-200 group-hover:text-white bg-transparent">
          {label}
        </span>
      )}
      <span
        className={`birim-switch-track relative inline-flex items-center rounded-full border transition-colors duration-200 ${
          isSm ? "w-8 h-[18px] p-[1.5px]" : "w-10 h-[22px] p-[2px]"
        } ${
          checked
            ? "bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] border-[#7DD3FC]/60"
            : "bg-slate-600/80 border-white/25 group-hover:bg-slate-500/85"
        }`}
      >
        <span
          className={`birim-switch-knob rounded-full bg-white shadow-sm transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isSm ? "w-3.5 h-3.5" : "w-4 h-4"
          } ${
            checked
              ? isSm
                ? "translate-x-[13px]"
                : "translate-x-[18px]"
              : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
};

interface StudioSelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

const StudioSelect: React.FC<{
  value: string | number;
  options: readonly StudioSelectOption[];
  onChange: (value: string) => void;
  ariaLabel?: string;
  size?: "sm" | "md";
  className?: string;
}> = ({ value, options, onChange, ariaLabel, size = "md", className = "" }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const strVal = String(value);
  const selected = options.find((o) => o.value === strVal) || options[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const isSm = size === "sm";
  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between rounded-xl border transition cursor-pointer text-left ${
          isSm ? "h-8 px-2 gap-1 text-[11px]" : "h-9 px-2.5 gap-1.5 text-xs"
        } font-semibold ${
          open
            ? "bg-white border-[#141413] text-[#141413] shadow-[0_0_0_2px_rgba(20,20,19,0.08)]"
            : "bg-[#FAF8F4] hover:bg-[#F3EFE6] border-[#DED8CC] text-[#141413]"
        }`}
      >
        <span className="flex items-center gap-1.5 min-w-0">
          {selected?.icon}
          <span className="truncate">{selected?.label ?? strVal}</span>
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 text-[#78716C] transition-transform duration-150 ${
            open ? "rotate-180 text-[#141413]" : ""
          }`}
        />
      </button>
      {open && (
        <div className="absolute left-0 min-w-full w-max max-w-[260px] mt-1.5 z-50 rounded-2xl bg-white/98 backdrop-blur-xl border border-[#DFD9CE] shadow-[0_16px_40px_rgba(20,20,19,0.16)] p-1 max-h-56 overflow-y-auto">
          {options.map((opt) => {
            const isSel = opt.value === strVal;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-left text-xs font-semibold transition cursor-pointer ${
                  isSel
                    ? "bg-[#141413] text-white"
                    : "text-[#141413] hover:bg-[#F5F2EA]"
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  {opt.icon}
                  <span className="truncate">{opt.label}</span>
                </span>
                {isSel && <Check className="w-3.5 h-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

function renderHardwareTechnicalSvg(id: string) {
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

function renderPlinthIcon(id: PlinthConstructionType) {
  return (
    <svg width="26" height="22" viewBox="0 0 26 22" fill="none" className="mx-auto shrink-0">
      <rect x="3" y="2" width="20" height="12" rx="1" stroke="currentColor" strokeWidth="1.4" />
      {id === "pedestal_box" && (
        <>
          <rect x="5" y="14" width="16" height="6" stroke="currentColor" strokeWidth="1.3" fill="currentColor" fillOpacity="0.15" />
          <line x1="2" y1="20" x2="24" y2="20" stroke="currentColor" strokeWidth="1" strokeOpacity="0.5" />
        </>
      )}
      {id === "adjustable_legs_clip" && (
        <>
          <path d="M6 14v5M5 19h2M20 14v5M19 19h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <line x1="8" y1="16.5" x2="18" y2="16.5" stroke="currentColor" strokeWidth="1" strokeDasharray="2 1.5" />
          <line x1="2" y1="20" x2="24" y2="20" stroke="currentColor" strokeWidth="1" strokeOpacity="0.5" />
        </>
      )}
      {id === "gable_rails" && (
        <>
          <path d="M3 14v6M23 14v6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <rect x="5" y="14" width="16" height="2.5" stroke="currentColor" strokeWidth="1.1" />
          <line x1="2" y1="20" x2="24" y2="20" stroke="currentColor" strokeWidth="1" strokeOpacity="0.5" />
        </>
      )}
    </svg>
  );
}

function renderMultiHoleIcon(id: MultiHoleBoringMode) {
  const ys =
    id === "full_system_32"
      ? [4, 7, 10, 13, 16, 19]
      : id === "zone_32"
      ? [7, 10, 13, 16]
      : id === "cluster_5"
      ? [6, 9, 11.5, 14, 17]
      : id === "cluster_3"
      ? [8.5, 11.5, 14.5]
      : id === "single_pin"
      ? [11.5]
      : [];
  return (
    <svg width="20" height="22" viewBox="0 0 20 22" fill="none" className="mx-auto shrink-0">
      <rect x="4" y="1.5" width="12" height="19" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
      {ys.map((y) => (
        <React.Fragment key={y}>
          <circle cx="7.5" cy={y} r="0.9" fill="currentColor" />
          <circle cx="12.5" cy={y} r="0.9" fill="currentColor" />
        </React.Fragment>
      ))}
      {id === "none" && (
        <line x1="6" y1="17" x2="14" y2="5" stroke="currentColor" strokeWidth="1.3" strokeOpacity="0.55" />
      )}
    </svg>
  );
}

function renderBackPanelIcon(id: BackPanelType) {
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

function renderLedPlacementIcon(id: string, isSel: boolean) {
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

function renderDoorTypeIcon(id: string) {
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

function renderDoorProfileIcon(id: string) {
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

export const RightParametricInspector: React.FC<RightParametricInspectorProps> = React.memo(
  (props) => {
    const {
      selectedPartSlot,
      isOpen,
      onToggleOpen,
      activeTab,
      onChangeTab,
      experienceTier,
      onChangeExperienceTier,
      modules,
      activeModule,
      activeModuleIndex,
      activeBayIndex,
      materials,
      handleProfiles,
      engineeringFindings,
      facadeGrainContinuity,
      onToggleFacadeGrainContinuity,
      onRunAutoFillersAndCrown,
      onOpenCutoutModal,
      onSaveModuleAsTemplate,
      onAddCustomMaterial,
      onSelectModuleIndex,
      onSelectBayIndex,
      onSetDimensions,
      onBeginSliderDrag,
      onCommitSliderDrag,
      onSetPlinthHeight,
      onSplitBayIntoTwo,
      onEqualizeBaysAndShelves,
      onRemoveBayAt,
      onSetBayCustomWidth,
      onApplyBayPreset,
      onAddShelf,
      onAddFixedShelf,
      onSetShelfMountType,
      onRemoveShelf,
      onSetShelfElevation,
      onSetShelfThickness,
      onAddDrawer,
      onAddInternalDrawer,
      onSetDrawerPlacement,
      onRemoveDrawer,
      onAddHangingRail,
      onRemoveHangingRail,
      onSetHangingRailProfile,
      onAddSpecialFitting,
      onRemoveSpecialFitting,
      onAddSubDivider,
      onSetSubDividerPlacement,
      onRemoveSubDivider,
      onSetBayDoorType,
      onSetSlidingMountingType,
      onSetBayV4DoorConfig,
      onCopyDoorToAllBays,
      onCopyBayInteriorToAllBays,
      onMirrorModuleBays,
      onUpdateCarcassConfig,
      onApplyMaterialScope,
      onToggleModuleLed,
      onApplyApprovedFix,
      onDuplicateActiveModule,
      onAddStackedTopModule,
      onRotateActiveModule90,
      onRemoveActiveModule,
      onOpenCustomHardwareModal,
    } = props;

    const unitMode = useConfiguratorStore((st) => st.displayUnit);
    const setUnitMode = useConfiguratorStore((st) => st.setDisplayUnit);
    const [moduleMenuOpen, setModuleMenuOpen] = useState(false);
  const [interiorSubTab, setInteriorSubTab] = useState<"layout" | "hardware">("layout");
  useEffect(() => {
    if (activeTab === "hardware") {
      setInteriorSubTab("hardware");
    }
  }, [activeTab]);
  const [panelWidthPx, setPanelWidthPx] = useState<number>(() => {
    if (typeof window === "undefined") return 412;
    try {
      const saved = Number(localStorage.getItem("birim_right_panel_width_v1"));
      if (Number.isFinite(saved) && saved >= 340 && saved <= 680) return saved;
    } catch {
      // ignore
    }
    return 412;
  });
  const startPanelResize = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const startW = panelWidthPx;
    const onMove = (ev: PointerEvent) => {
      const nextW = Math.max(340, Math.min(680, Math.round(startW + (startX - ev.clientX))));
      setPanelWidthPx(nextW);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      try {
        localStorage.setItem("birim_right_panel_width_v1", String(panelWidthPx));
      } catch {
        // ignore
      }
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp);
  };
    const [materialTarget, setMaterialTarget] = useState<"doors" | "carcass" | "all_module">(
      "doors"
    );
    const [materialGroup, setMaterialGroup] = useState<V11MaterialGroup["id"]>("all");
    const [materialSearch, setMaterialSearch] = useState("");
    const [customMatOpen, setCustomMatOpen] = useState(false);
    const [newMatName, setNewMatName] = useState("");
    const [newMatHex, setNewMatHex] = useState("#C8B8A2");
    const [newMatCat, setNewMatCat] = useState<"laminate" | "lacquer" | "wood" | "stone">("laminate");
    const [newMatGrain, setNewMatGrain] = useState(false);
    const [batchApplyHandlesToModule, setBatchApplyHandlesToModule] = useState(true);
    const [handleFilterTab, setHandleFilterTab] = useState<"all" | "pull_handles" | "gola_handleless">("all");
    const [batchApplyHandlesToAllModules, setBatchApplyHandlesToAllModules] = useState(false);
    const [batchApplyDoorModelToModule, setBatchApplyDoorModelToModule] = useState(true);
    const [doorFrontSubTab, setDoorFrontSubTab] = useState<"door" | "drawer">("door");
    const [customDoorProfiles, setCustomDoorProfiles] = useState<CustomDoorProfilePreset[]>(() => {
      if (typeof window === "undefined") return [];
      try {
        const raw = window.localStorage.getItem("birim_custom_door_profiles_v1");
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    });
    const [selectedCustomDoorId, setSelectedCustomDoorId] = useState<string | null>(null);
    const [customDoorOpen, setCustomDoorOpen] = useState(false);
    const [multiShelfOpen, setMultiShelfOpen] = useState(false);
    const [multiShelfCount, setMultiShelfCount] = useState(5);
    const [multiShelfMount, setMultiShelfMount] = useState<
      "auto" | "all_adjustable" | "all_fixed"
    >("auto");
    const [multiShelfThick, setMultiShelfThick] = useState<18 | 25>(18);

    const isSimple = experienceTier === "simple";
    const safeBayIdx = Math.min(activeBayIndex, Math.max(0, activeModule.bays.length - 1));
    const activeBay = activeModule.bays[safeBayIdx] || activeModule.bays[0];

    const fourSpace = useMemo(
      () => calculateFourSpaceDimensions(activeModule),
      [activeModule]
    );
    const bayClearWidths = fourSpace.usableInternal.bayClearWidthsMm;
    const netInnerHeightMm =
      fourSpace.usableInternal.netInnerHeightMm ||
      Math.max(300, activeModule.dimensions.height - (activeModule.carcass.plinthHeight ?? 80) - 2 * (activeModule.carcass.panelThickness || 18));
    const subDividerIntervals = useMemo(
      () =>
        activeBay
          ? getBayShelfIntervalsForSubDivider(
              activeBay,
              netInnerHeightMm,
              activeModule.carcass.panelThickness || 18
            )
          : [],
      [activeBay, netInnerHeightMm, activeModule.carcass.panelThickness]
    );

    const mainModuleIndices = useMemo(
      () =>
        modules
          .map((m, idx) => ({ m, idx }))
          .filter((item) => item.m.category !== "complementary"),
      [modules]
    );
    const currentOrderIdx = Math.max(
      0,
      mainModuleIndices.findIndex((x) => x.idx === activeModuleIndex)
    );

    const visibleMaterials = useMemo(() => {
      const base = filterMaterialsByGroup(materials, materialGroup);
      const q = materialSearch.trim().toLowerCase();
      if (!q) return base;
      return base.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          (m.brand || "").toLowerCase().includes(q) ||
          (m.decorCode || "").toLowerCase().includes(q)
      );
    }, [materials, materialGroup, materialSearch]);

    const applyDoorPatchAcrossScope = (
      patch: Parameters<typeof onSetBayV4DoorConfig>[1],
      applyAllBaysInModule: boolean,
      applyAllModulesInScene: boolean
    ) => {
      if (applyAllModulesInScene) {
        const st = useConfiguratorStore.getState();
        st.beginHistoryTransaction();
        const prevIdx = st.activeModuleIndex;
        st.project.modules.forEach((m, mIdx) => {
          if (m.category === "complementary") return;
          st.setActiveModuleIndex(mIdx);
          m.bays.forEach((b, bIdx) => {
            const bayHasExtDrawers = (b.drawers || []).some((d) => !d.isInternal && !d.isHidden);
            if (b.door?.type !== "open" || bayHasExtDrawers) {
              onSetBayV4DoorConfig(bIdx, patch);
            }
          });
        });
        st.setActiveModuleIndex(prevIdx);
        st.commitHistoryTransaction();
        return;
      }
      if (applyAllBaysInModule && activeModule.bays.length > 1) {
        onBeginSliderDrag?.();
        activeModule.bays.forEach((b, bIdx) => {
          const bayHasExtDrawers = (b.drawers || []).some((d) => !d.isInternal && !d.isHidden);
          if (b.door?.type !== "open" || bayHasExtDrawers) {
            onSetBayV4DoorConfig(bIdx, patch);
          }
        });
        onCommitSliderDrag?.();
        return;
      }
      onSetBayV4DoorConfig(safeBayIdx, patch);
    };

    const activeFinding = engineeringFindings[0] || null;
    const formattedFinding = useMemo(
      () => (activeFinding ? formatFindingForTier(activeFinding, experienceTier) : null),
      [activeFinding, experienceTier]
    );

    const wMm = activeModule.dimensions.width;
    const hMm = activeModule.dimensions.height;
    const dMm = activeModule.dimensions.depth;
    const plinthMm = activeModule.carcass.plinthHeight ?? 80;
    const formatVal = (mm: number) =>
      unitMode === "cm" ? `${Math.round(mm / 10)}` : `${Math.round(mm)}`;

    const curDoorType = activeBay?.door?.type || "double";
    const hasExternalDrawersInActiveBay = Boolean(
      activeBay?.drawers?.some((d) => !d.isInternal && !d.isHidden)
    );
    const isKitchenCornerMod = Boolean(
      activeModule.isCorner ||
        activeModule.category === "kitchen_corner" ||
        activeModule.templateId?.includes("corner") ||
        activeModule.name.toLowerCase().includes("köşe")
    );
    const activeHullShape = activeModule.carcass.hullShape || "rectangular";
    const isCapsuleOrRounded =
      activeHullShape === "capsule_stadium" || activeHullShape === "rounded_corners";
    const isTableOrIslandMod =
      activeHullShape === "capsule_table" ||
      activeModule.category === "kitchen_island" ||
      activeModule.complementaryRole === "attached_table";
    const isSlidingBay =
      !isCapsuleOrRounded && (curDoorType === "sliding" || curDoorType === "sliding_bottom");
    const curDoorProfile =
      activeBay?.door?.crossSectionProfile ||
      activeModule.carcass.crossSectionProfile ||
      "flat_slab";
    const activeMatId =
      materialTarget === "carcass"
        ? activeModule.carcass.bodyMaterialId
        : activeModule.carcass.doorMaterialId;
    const hasBaseboardNotch = Boolean(activeModule.carcass.baseboardNotch?.enabled);

    return (
      <>
        {/* DARALTILMI�? DURUM: Sağ dikey merkezde durur, açılıp kapanırken yumuşak ölçek/opaklık geçişi yapar */}
        <button
          type="button"
          data-testid="v11-expand-inspector-btn"
          aria-hidden={isOpen}
          tabIndex={isOpen ? -1 : 0}
          onClick={onToggleOpen}
          title="Modül Özellikleri Panelini Aç"
          className={`fixed right-4 top-1/2 -translate-y-1/2 z-30 py-3.5 px-2.5 rounded-full bg-[#2C3341]/66 backdrop-blur-2xl border border-white/[0.22] ring-1 ring-black/50 shadow-[0_18px_46px_rgba(0,0,0,0.46)] text-xs font-semibold text-[#F3F4F6] flex flex-col items-center gap-2 hover:bg-[#222631] cursor-pointer origin-right transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isOpen
              ? "opacity-0 scale-90 translate-x-4 pointer-events-none"
              : "opacity-100 scale-100 translate-x-0 pointer-events-auto"
          }`}
        >
          <ChevronLeft className="w-4 h-4 text-[#7DD3FC]" />
          <SlidersHorizontal className="w-4 h-4 text-[#7DD3FC]" />
          <span className="[writing-mode:vertical-rl] rotate-180 text-[11px] font-bold tracking-wide py-0.5">
            Özellikler
          </span>
        </button>

        <aside
          aria-label="Modül Parametreleri"
          aria-hidden={!isOpen}
          data-testid="v11-right-inspector"
          style={{ width: `${panelWidthPx}px` }}
          className={`birim-dramatic-panel fixed right-4 top-[72px] bottom-[84px] max-w-[calc(100vw-32px)] max-lg:!w-auto max-lg:left-2.5 max-lg:right-2.5 max-lg:top-auto max-lg:bottom-2.5 max-lg:h-[58vh] max-lg:max-w-none max-lg:rounded-t-3xl max-lg:rounded-b-2xl max-lg:origin-bottom z-30 rounded-3xl bg-[#2A313F]/66 backdrop-blur-2xl border border-white/[0.22] ring-1 ring-black/60 shadow-[0_28px_68px_rgba(0,0,0,0.62)] flex flex-col overflow-hidden text-[#F3F4F6] origin-right transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isOpen
              ? "opacity-100 scale-100 translate-x-0 pointer-events-auto"
              : "opacity-0 scale-95 translate-x-6 pointer-events-none"
          }`}
        >
        {/* MOBİL / TABLET ALT ÇEKMECE TUTAMAÇ GÖSTERGESİ (<1024px) */}
        <div className="lg:hidden w-full pt-2 pb-1 flex justify-center shrink-0">
          <span className="w-10 h-1 rounded-full bg-[#CFC7B9]" />
        </div>
        {/* SOL KENAR YENİDEN BOYUTLANDIRMA TUTAMACI (340–680px) */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Sağ panel genişliğini ayarla"
          data-testid="v11-right-inspector-resize-handle"
          onPointerDown={startPanelResize}
          title="Panel genişliğini sürükleyerek ayarlayın"
          className="hidden md:flex absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-[#141413]/10 z-40 items-center justify-center group"
        >
          <span className="w-0.5 h-10 rounded-full bg-[#C7BFB0] group-hover:bg-[#141413] transition" />
        </div>
        {/* ÜST MODÜL SEÇİCİ VE AKSİYON BA�?LI�?I */}
        <div className="px-4 pt-3.5 pb-3 border-b border-[#E6E1D6] shrink-0 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#8C7A6B]">
                  Modül {currentOrderIdx + 1} / {Math.max(1, mainModuleIndices.length)}
                </span>
                {mainModuleIndices.length > 1 && (
                  <div className="inline-flex items-center gap-0.5 ml-1">
                    <button
                      type="button"
                      onClick={() => {
                        const prev =
                          mainModuleIndices[
                            (currentOrderIdx - 1 + mainModuleIndices.length) %
                              mainModuleIndices.length
                          ];
                        if (prev) onSelectModuleIndex(prev.idx);
                      }}
                      className="w-5 h-5 rounded-full hover:bg-[#EFECE4] flex items-center justify-center cursor-pointer"
                      title="Önceki Modül"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const next =
                          mainModuleIndices[(currentOrderIdx + 1) % mainModuleIndices.length];
                        if (next) onSelectModuleIndex(next.idx);
                      }}
                      className="w-5 h-5 rounded-full hover:bg-[#EFECE4] flex items-center justify-center cursor-pointer"
                      title="Sonraki Modül"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
              <h2 className="text-sm font-bold truncate mt-0.5">{activeModule.name}</h2>
              <p className="text-[11px] font-mono text-[#78716C]">
                {unitMode === "cm"
                  ? `${Number((wMm / 10).toFixed(1))} × ${Number((hMm / 10).toFixed(1))} × ${Number((dMm / 10).toFixed(1))} cm`
                  : `${Math.round(wMm)} × ${Math.round(hMm)} × ${Math.round(dMm)} mm`} •{" "}
                {activeModule.bays.length} Bölme
              </p>
            </div>

            <div className="relative flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setModuleMenuOpen((v) => !v)}
                title="Modül İşlemleri"
                className="w-8 h-8 rounded-full hover:bg-[#EFECE4] text-[#57534E] hover:text-[#141413] flex items-center justify-center transition cursor-pointer"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onToggleOpen}
                title="Paneli Daralt"
                className="w-8 h-8 rounded-full hover:bg-[#EFECE4] text-[#57534E] hover:text-[#141413] flex items-center justify-center transition cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              {moduleMenuOpen && typeof document !== "undefined" && createPortal(
                <div
                  data-birim-portal-menu="true"
                  onMouseDown={(e) => e.stopPropagation()}
                  style={{
                    position: "fixed",
                    top: "126px",
                    right: "28px",
                    zIndex: 90,
                    background: "rgba(30, 36, 48, 0.72)",
                    backdropFilter: "blur(36px) saturate(195%)",
                    WebkitBackdropFilter: "blur(36px) saturate(195%)",
                  }}
                  className="w-60 rounded-2xl border border-white/[0.22] ring-1 ring-black/50 shadow-[0_24px_60px_rgba(0,0,0,0.62)] p-1.5 text-xs text-slate-100"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setModuleMenuOpen(false);
                      onDuplicateActiveModule();
                    }}
                    className="w-full px-3 py-2 rounded-xl hover:bg-white/[0.14] text-slate-100 flex items-center gap-2 text-left font-medium transition cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5 text-slate-300" />
                    <span>Yanına Kopyala</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModuleMenuOpen(false);
                      onAddStackedTopModule();
                    }}
                    className="w-full px-3 py-2 rounded-xl hover:bg-white/[0.14] text-slate-100 flex items-center gap-2 text-left font-medium transition cursor-pointer"
                  >
                    <ArrowUpFromLine className="w-3.5 h-3.5 text-slate-300" />
                    <span>Üst Yüklük Modülü Ekle</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModuleMenuOpen(false);
                      onRotateActiveModule90();
                    }}
                    className="w-full px-3 py-2 rounded-xl hover:bg-white/[0.14] text-slate-100 flex items-center gap-2 text-left font-medium transition cursor-pointer"
                  >
                    <RotateCw className="w-3.5 h-3.5 text-slate-300" />
                    <span>90° Döndür</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModuleMenuOpen(false);
                      onOpenCutoutModal();
                    }}
                    className="w-full px-3 py-2 rounded-xl hover:bg-white/[0.14] text-slate-100 flex items-center gap-2 text-left font-medium transition cursor-pointer"
                  >
                    <Scissors className="w-3.5 h-3.5 text-slate-300" />
                    <span>Panel Kertme & Priz Kesimi</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModuleMenuOpen(false);
                      onSaveModuleAsTemplate(`${activeModule.name} (Özel)`);
                    }}
                    className="w-full px-3 py-2 rounded-xl hover:bg-white/[0.14] text-slate-100 flex items-center gap-2 text-left font-medium transition cursor-pointer"
                  >
                    <BookmarkPlus className="w-3.5 h-3.5 text-slate-300" />
                    <span>Özel Şablon Olarak Kaydet</span>
                  </button>
                  {mainModuleIndices.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        setModuleMenuOpen(false);
                        onRemoveActiveModule();
                      }}
                      className="w-full px-3 py-2 rounded-xl hover:bg-red-50 text-red-600 flex items-center gap-2 text-left font-medium cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Modülü Sil</span>
                    </button>
                  )}
                </div>,
                document.body
              )}
            </div>
          </div>

          {onChangeExperienceTier && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10.5px] font-semibold text-[#8C7A6B] uppercase tracking-wider">
                Panel Seviyesi
              </span>
              <div
                className="inline-flex items-center p-0.5 rounded-full bg-[#ECE7DD]/80 border border-[#DFD9CE]"
                title="Sağ Panel Detay Seviyesi"
              >
                {(
                  [
                    { id: "simple", label: "Kolay" },
                    { id: "architect", label: "Pro" },
                    { id: "factory", label: "Üretim" },
                  ] as const
                ).map((t) => {
                  const active = experienceTier === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      data-testid={`v11-tier-${t.id}`}
                      onClick={() => onChangeExperienceTier(t.id)}
                      className={`h-6 px-3 rounded-full text-[11px] font-semibold transition cursor-pointer ${
                        active
                          ? "bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] text-white font-bold border border-[#38BDF8]/65 shadow-[0_0_16px_rgba(29,78,216,0.58)]"
                          : "text-[#57534E] hover:text-[#141413]"
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="relative grid grid-cols-4 gap-1 p-1 rounded-2xl bg-slate-900/[0.07] border border-white/55">
            <span
              aria-hidden="true"
              style={{
                width: "calc((100% - 8px - 12px) / 4)",
                transform: `translate3d(calc(${
                  activeTab === "dimensions"
                    ? 0
                    : activeTab === "doors"
                    ? 2
                    : activeTab === "materials"
                    ? 3
                    : 1
                } * (100% + 4px)), 0, 0)`,
              }}
              className="pointer-events-none absolute top-1 bottom-1 left-1 rounded-xl bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] border border-[#38BDF8]/60 shadow-[0_0_20px_rgba(29,78,216,0.58),0_4px_14px_rgba(37,99,235,0.45)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
            />
            {(
              [
                { id: "dimensions", label: "Boyut" },
                { id: "interior", label: "İç & Donanım" },
                { id: "doors", label: "Kapak" },
                { id: "materials", label: "Yüzey" },
              ] as const
            ).map((tb) => {
              const active = activeTab === tb.id || (tb.id === "interior" && activeTab === "hardware");
              return (
                <button
                  key={tb.id}
                  type="button"
                  data-testid={`v11-tab-${tb.id}`}
                  onClick={() => onChangeTab(tb.id)}
                  className={`relative z-10 py-2 px-1 rounded-xl text-xs font-semibold transition-colors duration-200 cursor-pointer ${
                    active
                      ? "text-white"
                      : "text-slate-700 hover:text-[#18181B]"
                  }`}
                >
                  {tb.label}
                </button>
              );
            })}
          </div>
        </div>

        {selectedPartSlot}

        {/* KAYDIRILABİLİR İÇERİK ALANI */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* ==================== SEKME 1: BOYUT & MİMARİ DETAYLAR ==================== */}
          {/* SEÇİLİ PARÇA BAĞLAMSAL HIZLI KARTI (React.memo izole) */}
          {(() => {
            const bay = activeModule.bays[activeBayIndex];
            const storeSelCompId = useConfiguratorStore.getState().selectedComponentId;
            const selComp = storeSelCompId
              ? bay?.components?.find((c) => c.id === storeSelCompId)
              : undefined;
            if (!selComp) return null;
            const isShelf = selComp.type === "shelf";
            const isFixed = isShelf && (selComp.isAdjustable === false || selComp.isFixed);
            const partKind =
              selComp.type === "shelf"
                ? "shelf"
                : selComp.type === "drawer"
                ? "drawer"
                : selComp.type === "hanging_rail"
                ? "rail"
                : "bay";
            return (
              <InspectorSelectedPartCard
                partLabel={`${activeBayIndex + 1}. Bölme · ${
                  isShelf ? "Raf" : selComp.type === "drawer" ? "Çekmece" : selComp.type === "hanging_rail" ? "Askı Borusu" : "İç Eleman"
                }`}
                partKind={partKind}
                isFixedShelf={Boolean(isFixed)}
                elevationMm={Number(selComp.position ?? selComp.y ?? 0)}
                displayUnit={unitMode}
                onJumpToTab={(t) => onChangeTab(t)}
              />
            );
          })()}

          {activeTab === "dimensions" && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[#78716C]">Ölçü Birimi</span>
                <div className="inline-flex p-0.5 rounded-full bg-[#ECE7DD] border border-[#DFD9CE]">
                  {(["cm", "mm"] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setUnitMode(u)}
                      className={`px-3 py-1 rounded-full text-[11px] font-semibold transition cursor-pointer ${
                        unitMode === u ? "bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] text-white font-bold border border-[#38BDF8]/65 shadow-[0_0_16px_rgba(29,78,216,0.58)]" : "text-[#57534E]"
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              {(
                [
                  {
                    key: "width",
                    label: "Genişlik",
                    valMm: wMm,
                    minMm: isSlidingBay ? 1200 : activeHullShape === "capsule_table" ? 900 : isCapsuleOrRounded ? 650 : 280,
                    maxMm: 3600,
                    stepMm: unitMode === "cm" ? 50 : 10,
                    presetsMm: isSlidingBay
                      ? [1500, 1800, 2200, 2600, 3000]
                      : isCapsuleOrRounded
                      ? [1200, 1600, 2000, 2200, 2600]
                      : isTableOrIslandMod
                      ? [1600, 2000, 2200, 2600]
                      : [600, 900, 1200, 1800, 2400],
                    apply: (next: number) => onSetDimensions(next, hMm, dMm),
                  },
                  {
                    key: "height",
                    label: "Yükseklik",
                    valMm: hMm,
                    minMm: 260,
                    maxMm: 2900,
                    stepMm: unitMode === "cm" ? 20 : 10,
                    presetsMm: isCapsuleOrRounded
                      ? [480, 540, 850, 1050, 1400]
                      : isTableOrIslandMod
                      ? [740, 750, 870, 900]
                      : [520, 870, 2200, 2400, 2600],
                    apply: (next: number) => onSetDimensions(wMm, next, dMm),
                  },
                  {
                    key: "depth",
                    label: "Derinlik",
                    valMm: dMm,
                    minMm: isSlidingBay ? 600 : activeHullShape === "capsule_table" ? 650 : isCapsuleOrRounded ? 340 : 240,
                    maxMm: isTableOrIslandMod ? 1400 : 950,
                    stepMm: unitMode === "cm" ? 20 : 10,
                    presetsMm: isSlidingBay
                      ? [600, 650, 700]
                      : isTableOrIslandMod
                      ? [850, 950, 1000, 1150]
                      : isCapsuleOrRounded
                      ? [380, 440, 450, 500, 580]
                      : [400, 500, 600, 650],
                    apply: (next: number) => onSetDimensions(wMm, hMm, next),
                  },
                ] as const
              ).map((dim) => {
                const displayNum =
                  unitMode === "cm" ? Number((dim.valMm / 10).toFixed(1)) : Math.round(dim.valMm);
                return (
                  <div
                    key={dim.key}
                    className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-[#141413] text-[13px]">{dim.label}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            dim.apply(Math.max(dim.minMm, dim.valMm - dim.stepMm))
                          }
                          className="w-7 h-7 rounded-full bg-[#F5F2EA] hover:bg-[#E7E1D4] flex items-center justify-center cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xl bg-[#FAF8F4] border border-[#DED8CC] focus-within:border-[#141413]">
                          <input
                            type="number"
                            key={`${dim.key}-${unitMode}-${dim.valMm}`}
                            defaultValue={displayNum}
                            step={unitMode === "cm" ? 1 : 10}
                            onChange={(e) => {
                              const raw = Number(e.currentTarget.value);
                              if (!Number.isFinite(raw) || raw <= 0) return;
                              const nextMm = unitMode === "cm" ? Math.round(raw * 10) : Math.round(raw);
                              if (nextMm >= dim.minMm && nextMm <= dim.maxMm && nextMm !== dim.valMm) {
                                dim.apply(nextMm);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                (e.currentTarget as HTMLInputElement).blur();
                              }
                            }}
                            onBlur={(e) => {
                              const raw = Number(e.currentTarget.value);
                              if (!Number.isFinite(raw) || raw <= 0) return;
                              const nextMm = unitMode === "cm" ? Math.round(raw * 10) : Math.round(raw);
                              const clamped = Math.max(dim.minMm, Math.min(dim.maxMm, nextMm));
                              if (clamped !== dim.valMm) {
                                dim.apply(clamped);
                              }
                            }}
                            className="w-16 bg-transparent font-mono font-bold text-[14px] text-center text-[#141413] outline-none"
                            title={`${dim.label} değerini (${unitMode}) girin`}
                          />
                          <span className="text-[10px] font-normal text-[#78716C] pr-0.5">{unitMode}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            dim.apply(Math.min(dim.maxMm, dim.valMm + dim.stepMm))
                          }
                          className="w-7 h-7 rounded-full bg-[#F5F2EA] hover:bg-[#E7E1D4] flex items-center justify-center cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <input
                      type="range"
                      min={dim.minMm}
                      max={dim.maxMm}
                      step={unitMode === "cm" ? 10 : 5}
                      value={Math.min(dim.maxMm, Math.max(dim.minMm, dim.valMm))}
                      onPointerDown={() => onBeginSliderDrag?.()}
                      onPointerUp={() => onCommitSliderDrag?.()}
                      onPointerCancel={() => onCommitSliderDrag?.()}
                      onBlur={() => onCommitSliderDrag?.()}
                      onChange={(e) => dim.apply(Number(e.target.value))}
                      className="w-full accent-[#141413] cursor-pointer"
                    />

                    <div className="flex flex-wrap gap-1.5">
                      {dim.presetsMm.map((pMm) => {
                        const active = Math.abs(dim.valMm - pMm) < 5;
                        return (
                          <button
                            key={pMm}
                            type="button"
                            onClick={() => dim.apply(pMm)}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold transition cursor-pointer ${
                              active
                                ? "bg-[#141413] text-white"
                                : "bg-[#F5F2EA] hover:bg-[#EAE3D5] text-[#44403C]"
                            }`}
                          >
                            {unitMode === "cm" ? `${pMm / 10} cm` : `${pMm} mm`}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Baza & Torna Ayak Yüksekliği */}
              {activeHullShape !== "capsule_table" && (
                <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#141413]">
                      {isCapsuleOrRounded ? "Alt Ayak / Baza Yüksekliği" : "Alt Baza Yüksekliği"}
                    </span>
                    <span className="font-mono text-[#78716C]">
                      {plinthMm === 0 ? "Bazasız" : unitMode === "cm" ? `${Number((plinthMm / 10).toFixed(1))} cm` : `${Math.round(plinthMm)} mm`}
                    </span>
                  </div>
                  <div className="grid grid-cols-6 gap-1">
                    {[
                      { mm: 0, label: "Yok" },
                      { mm: 80, label: unitMode === "cm" ? "8 cm" : "80 mm" },
                      { mm: 100, label: unitMode === "cm" ? "10 cm" : "100 mm" },
                      { mm: 150, label: unitMode === "cm" ? "15 cm" : "150 mm" },
                      { mm: 160, label: unitMode === "cm" ? "16 cm" : "160 mm" },
                      { mm: 180, label: unitMode === "cm" ? "18 cm" : "180 mm" },
                    ].map((pl) => (
                      <button
                        key={pl.mm}
                        type="button"
                        onClick={() => onSetPlinthHeight(pl.mm)}
                        className={`py-2 rounded-xl text-[11px] font-semibold transition cursor-pointer ${
                          Math.abs(plinthMm - pl.mm) < 5
                            ? "bg-[#141413] text-white"
                            : "bg-[#F5F2EA] hover:bg-[#EAE3D5] text-[#44403C]"
                        }`}
                      >
                        {pl.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* TAMBUR & KAVİSLİ KAPSÜL GÖVDE MÜHENDİSLİK KARTI — Kolay modda yalnızca kavisli modül seçiliyse gösterilir */}
              {(!isSimple || isCapsuleOrRounded || curDoorType === "tambour") && (
              <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#141413]">Gövde Formu &amp; Tambur Sistemi</span>
                  <span className="text-[10.5px] font-mono text-[#8C7A6B]">
                    {activeHullShape === "capsule_stadium"
                      ? "180° Kapsül"
                      : activeHullShape === "rounded_corners"
                      ? "4×90° R-Köşe"
                      : activeHullShape === "capsule_table"
                      ? "Stadyum Masa"
                      : "Standart Düz"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    [
                      { id: "rectangular", label: "Standart Düz Karkas" },
                      { id: "capsule_stadium", label: "Kapsül Tambur (180°)" },
                      { id: "rounded_corners", label: "R-Köşeli Tambur (90°)" },
                      { id: "capsule_table", label: "Kapsül Stadyum Masa" },
                    ] as const
                  ).map((hs) => {
                    const active = activeHullShape === hs.id;
                    return (
                      <button
                        key={hs.id}
                        type="button"
                        onClick={() => {
                          if (hs.id === "capsule_stadium") {
                            onUpdateCarcassConfig({
                              hullShape: "capsule_stadium",
                              cornerRadiusMm: Math.round(dMm / 2),
                              tambourSlatPitchMm: activeModule.carcass.tambourSlatPitchMm || 22,
                            });
                          } else if (hs.id === "rounded_corners") {
                            onUpdateCarcassConfig({
                              hullShape: "rounded_corners",
                              cornerRadiusMm: Math.min(Math.max(70, Math.floor(dMm / 2) - 30), 110),
                              tambourSlatPitchMm: activeModule.carcass.tambourSlatPitchMm || 20,
                            });
                          } else if (hs.id === "capsule_table") {
                            onUpdateCarcassConfig({
                              hullShape: "capsule_table",
                              cornerRadiusMm: Math.round(dMm / 2),
                              plinthHeight: 0,
                            });
                          } else {
                            onUpdateCarcassConfig({ hullShape: "rectangular" });
                          }
                        }}
                        className={`py-2 px-2.5 rounded-xl text-[11px] font-semibold text-left transition cursor-pointer ${
                          active
                            ? "bg-[#141413] text-white"
                            : "bg-[#F5F2EA] hover:bg-[#EAE3D5] text-[#44403C]"
                        }`}
                      >
                        {hs.label}
                      </button>
                    );
                  })}
                </div>

                {(isCapsuleOrRounded || curDoorType === "tambour") && (
                  <div className="pt-2 border-t border-[#F0ECE3] space-y-2.5">
                    {activeHullShape === "rounded_corners" && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-[#57534E] font-medium">Köşe Dönüş Yarıçapı (R)</span>
                          <span className="font-mono font-bold">
                            {activeModule.carcass.cornerRadiusMm || 110} mm
                          </span>
                        </div>
                        <input
                          type="range"
                          min={65}
                          max={Math.max(75, Math.floor(dMm / 2) - 20)}
                          step={5}
                          value={Math.min(
                            Math.max(75, Math.floor(dMm / 2) - 20),
                            activeModule.carcass.cornerRadiusMm || 110
                          )}
                          onChange={(e) =>
                            onUpdateCarcassConfig({ cornerRadiusMm: Number(e.target.value) })
                          }
                          className="w-full accent-[#141413] cursor-pointer"
                        />
                      </div>
                    )}

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#57534E] font-medium">Tambur Lamel Adımı</span>
                        <span className="font-mono font-bold">
                          {activeModule.carcass.tambourSlatPitchMm || 22} mm
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1">
                        {[18, 20, 24, 30].map((pitch) => {
                          const curP = activeModule.carcass.tambourSlatPitchMm || 22;
                          return (
                            <button
                              key={pitch}
                              type="button"
                              onClick={() => onUpdateCarcassConfig({ tambourSlatPitchMm: pitch })}
                              className={`py-1.5 rounded-lg font-mono text-[11px] font-semibold cursor-pointer ${
                                Math.abs(curP - pitch) <= 1
                                  ? "bg-[#141413] text-white"
                                  : "bg-[#F5F2EA] text-[#44403C]"
                              }`}
                            >
                              {pitch}mm
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {isCapsuleOrRounded && (
                      <div className="w-full py-2 px-3 rounded-xl bg-[#FAF8F4] border border-[#DED8CC] flex items-center justify-between gap-2 text-[11px] font-semibold text-[#141413]">
                        <span>20mm Gömme Mermer / Kuvars Üst Tabla</span>
                        <StudioToggleSwitch
                          checked={Boolean(
                            activeModule.carcass.countertopMaterialId &&
                              activeModule.carcass.hasCountertopTray !== false
                          )}
                          onChange={(nextOn) =>
                            onUpdateCarcassConfig({
                              hasCountertopTray: nextOn,
                              countertopMaterialId: nextOn
                                ? activeModule.carcass.countertopMaterialId || "mat_quartz_calacatta"
                                : activeModule.carcass.countertopMaterialId,
                            })
                          }
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
              )}


              {/* Gövde Yan Dikme, Baza Tipi, Çoklu Delik & Karkas Yapısı (Yalnızca Pro / Üretim) */}
              {!isSimple && (
              <>
              <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] space-y-3">
                <div className="font-bold text-[#141413]">
                  Gövde, Yan Dikme & Çoklu Delik
                </div>

                {/* Yan Dikme Yere Oturuşu / Baza Konstrüksiyonu */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#57534E] font-medium">Baza & Yan Dikme Yapısı</span>
                    <span className="font-mono text-[10px] text-[#78716C]">
                      {activeModule.carcass.plinthHeight ?? 100} mm
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {(
                      [
                        { id: "pedestal_box", label: "Baza" },
                        { id: "adjustable_legs_clip", label: "Ayak" },
                        { id: "gable_rails", label: "Dikme" },
                      ] as const
                    ).map((opt) => {
                      const curPlinth: PlinthConstructionType =
                        activeModule.carcass.plinthConstruction ||
                        (activeModule.moduleFamilyId?.startsWith("fam_kitchen")
                          ? "adjustable_legs_clip"
                          : "pedestal_box");
                      const isSel = curPlinth === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          data-testid={`v11-plinth-${opt.id}`}
                          onClick={() => onUpdateCarcassConfig({ plinthConstruction: opt.id })}
                          className={`py-1.5 px-1.5 rounded-xl text-[10px] font-semibold transition cursor-pointer flex flex-col items-center gap-1 ${
                            isSel
                              ? "bg-[#141413] text-white"
                              : "bg-[#F5F2EA] hover:bg-[#EAE3D5] text-[#44403C]"
                          }`}
                        >
                          {renderPlinthIcon(opt.id)}
                          <span>{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  {(activeModule.carcass.plinthHeight ?? 100) >= 90 && (
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-[#57534E]">Baza Çekmecesi</span>
                      <StudioToggleSwitch
                        size="sm"
                        checked={Boolean(activeModule.carcass.hasPlinthDrawer)}
                        onChange={(next) => onUpdateCarcassConfig({ hasPlinthDrawer: next })}
                      />
                    </div>
                  )}
                </div>

                {/* Çoklu Delik Sistemi (System 32 / 5'li Küme) */}
                {(() => {
                  const mhSpec = resolveMultiHoleSpec(activeModule);
                  const mhModes: Array<{ id: MultiHoleBoringMode; label: string }> = [
                    { id: "full_system_32", label: "Tam Boy 32mm" },
                    { id: "zone_32", label: "Kuşak 32mm" },
                    { id: "cluster_5", label: "5'li Küme" },
                    { id: "cluster_3", label: "3'lü Küme" },
                    { id: "single_pin", label: "Tekli Pim" },
                    { id: "none", label: "Deliksiz" },
                  ];
                  return (
                    <div className="space-y-1.5 pt-2 border-t border-[#F0ECE3]">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#57534E] font-medium">Çoklu Delik Sistemi</span>
                        <span className="font-mono text-[10px] text-[#78716C]">Ø5 mm</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        {mhModes.map((mh) => (
                          <button
                            key={mh.id}
                            type="button"
                            data-testid={`v11-multihole-${mh.id}`}
                            onClick={() => onUpdateCarcassConfig({ multiHoleMode: mh.id })}
                            className={`py-1.5 px-1.5 rounded-xl text-[10px] font-semibold transition cursor-pointer flex flex-col items-center gap-1 ${
                              mhSpec.mode === mh.id
                                ? "bg-[#141413] text-white"
                                : "bg-[#F5F2EA] hover:bg-[#EAE3D5] text-[#44403C]"
                            }`}
                          >
                            {renderMultiHoleIcon(mh.id)}
                            <span>{mh.label}</span>
                          </button>
                        ))}
                      </div>
                      {mhSpec.mode !== "none" && (
                        <div className="space-y-2 pt-2 border-t border-[#F0ECE3]">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1">
                              <span className="text-[11px] text-[#57534E] font-medium">Sıra:</span>
                              {([2, 3] as const).map((rc) => (
                                <button
                                  key={rc}
                                  type="button"
                                  onClick={() => onUpdateCarcassConfig({ multiHoleRowCount: rc })}
                                  className={`px-2.5 py-1 rounded-lg text-[10.5px] font-semibold cursor-pointer ${
                                    mhSpec.rowCount === rc
                                      ? "bg-[#141413] text-white"
                                      : "bg-[#F5F2EA] hover:bg-[#EAE3D5] text-[#44403C]"
                                  }`}
                                >
                                  {rc} Sıra
                                </button>
                              ))}
                            </div>
                            <StudioToggleSwitch
                              size="sm"
                              label="3B Delikler"
                              checked={activeModule.carcass.showMultiHolesIn3D !== false}
                              onChange={(next) =>
                                onUpdateCarcassConfig({ showMultiHolesIn3D: next })
                              }
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="space-y-1">
                              <span className="text-[11px] text-[#57534E]">Ön Mesafe (mm)</span>
                              <input
                                type="number"
                                min={28}
                                max={120}
                                step={1}
                                value={
                                  activeModule.carcass.multiHoleFrontSetbackMm ??
                                  mhSpec.frontSetbackMm
                                }
                                onChange={(e) =>
                                  onUpdateCarcassConfig({
                                    multiHoleFrontSetbackMm: Math.max(
                                      28,
                                      Math.min(120, Number(e.target.value) || 37)
                                    ),
                                  })
                                }
                                className="w-full h-9 px-3 rounded-xl bg-[#FAF8F4] border border-[#DED8CC] font-mono text-xs font-semibold"
                              />
                            </label>
                            <label className="space-y-1">
                              <span className="text-[11px] text-[#57534E]">Kenar Payı (mm)</span>
                              <input
                                type="number"
                                min={48}
                                max={192}
                                step={8}
                                value={
                                  activeModule.carcass.multiHoleEdgeMarginMm ??
                                  mhSpec.edgeMarginMm
                                }
                                onChange={(e) =>
                                  onUpdateCarcassConfig({
                                    multiHoleEdgeMarginMm: Math.max(
                                      48,
                                      Math.min(192, Number(e.target.value) || 96)
                                    ),
                                  })
                                }
                                className="w-full h-9 px-3 rounded-xl bg-[#FAF8F4] border border-[#DED8CC] font-mono text-xs font-semibold"
                              />
                            </label>
                          </div>
                          {!isSimple && (
                            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-[#F5F2EA]">
                              <StudioToggleSwitch
                                size="sm"
                                label="Orta Dikme Çift Yön Delik"
                                checked={Boolean(activeModule.carcass.multiHoleDividerThroughBore)}
                                onChange={(next) =>
                                  onUpdateCarcassConfig({ multiHoleDividerThroughBore: next })
                                }
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Arkalık 5 Mod + Birleşim Tipi + Kenar Bandı (Detaylı / Üretim) */}
                {!isSimple && (
                  <div className="space-y-2.5 pt-2 border-t border-[#F0ECE3]">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#57534E] font-medium">Arkalık Konstrüksiyonu</span>
                        <span className="font-mono text-[10px] text-[#78716C]">
                          {activeModule.carcass.backPanelThickness || 8} mm
                        </span>
                      </div>
                      <div className="grid grid-cols-5 gap-1">
                        {(
                          [
                            { id: "grooved", label: "Kanallı" },
                            { id: "rebated", label: "Lamba" },
                            { id: "flush", label: "Gömme" },
                            { id: "nailed", label: "Çakma" },
                            { id: "none", label: "Yok" },
                          ] as Array<{ id: BackPanelType; label: string }>
                        ).map((bp) => {
                          const curBp = activeModule.carcass.backPanelType || "grooved";
                          return (
                            <button
                              key={bp.id}
                              type="button"
                              onClick={() => onUpdateCarcassConfig({ backPanelType: bp.id })}
                              className={`py-1.5 px-1 rounded-lg text-[9.5px] font-semibold cursor-pointer flex flex-col items-center gap-0.5 ${
                                curBp === bp.id
                                  ? "bg-[#141413] text-white"
                                  : "bg-[#F5F2EA] hover:bg-[#EAE3D5] text-[#44403C]"
                              }`}
                            >
                              {renderBackPanelIcon(bp.id)}
                              <span>{bp.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <span className="text-[11px] text-[#57534E] block">Birleşim Tipi</span>
                        <StudioSelect
                          ariaLabel="Birleşim Tipi"
                          value={activeModule.carcass.jointType || "minifix_dowel"}
                          onChange={(val) =>
                            onUpdateCarcassConfig({ jointType: val as JointType })
                          }
                          options={[
                            { value: "minifix_dowel", label: "Minifiks + Kavela" },
                            { value: "dowel_only", label: "Kavela" },
                            { value: "confirmat", label: "Konfirmat Vida" },
                            { value: "miter_45", label: "45° Gönye" },
                          ]}
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[11px] text-[#57534E] block">PVC Kenar Bandı</span>
                        <div className="grid grid-cols-3 gap-1">
                          {([0.4, 1, 2] as const).map((eb) => {
                            const curEb = activeModule.carcass.edgeBandThickness ?? 1;
                            return (
                              <button
                                key={eb}
                                type="button"
                                onClick={() => onUpdateCarcassConfig({ edgeBandThickness: eb })}
                                className={`h-9 rounded-xl font-mono text-xs font-semibold cursor-pointer ${
                                  Math.abs(curEb - eb) < 0.1
                                    ? "bg-[#141413] text-white"
                                    : "bg-[#F5F2EA] text-[#44403C]"
                                }`}
                              >
                                {eb}mm
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[#F0ECE3] space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="px-2.5 py-2 rounded-xl bg-[#F5F2EA] flex items-center justify-between">
                          <StudioToggleSwitch
                            size="sm"
                            label="�?elale Sol"
                            checked={Boolean(activeModule.carcass.hasWaterfallLeft)}
                            onChange={(next) => onUpdateCarcassConfig({ hasWaterfallLeft: next })}
                          />
                        </div>
                        <div className="px-2.5 py-2 rounded-xl bg-[#F5F2EA] flex items-center justify-between">
                          <StudioToggleSwitch
                            size="sm"
                            label="�?elale Sağ"
                            checked={Boolean(activeModule.carcass.hasWaterfallRight)}
                            onChange={(next) => onUpdateCarcassConfig({ hasWaterfallRight: next })}
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-[#57534E]">CNC Ön Freze (mm)</span>
                        <input
                          type="number"
                          min={0}
                          max={5}
                          step={0.5}
                          value={activeModule.carcass.preMillingMm ?? 0}
                          onChange={(e) =>
                            onUpdateCarcassConfig({
                              preMillingMm: Math.max(0, Math.min(5, Number(e.target.value) || 0)),
                            })
                          }
                          className="w-24 h-9 px-3 rounded-xl bg-[#FAF8F4] border border-[#DED8CC] font-mono text-xs font-semibold text-center"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div className="space-y-1">
                          <span className="text-[11px] text-[#57534E] block">Karkas Topolojisi</span>
                          <StudioSelect
                            ariaLabel="Karkas Topolojisi"
                            value={activeModule.carcass.carcassJoineryTopology || "sides_through"}
                            onChange={(val) =>
                              onUpdateCarcassConfig({
                                carcassJoineryTopology: val as CarcassJoineryTopology,
                              })
                            }
                            options={[
                              { value: "sides_through", label: "Tip A: Yan Dikmeler" },
                              { value: "top_bottom_through", label: "Tip B: Alt/Üst Boyda" },
                              { value: "miter_45", label: "Tip C: 45° Gönye" },
                              { value: "kitchen_stretchers", label: "Tip D: Mutfak Kayıtlı" },
                            ]}
                          />
                        </div>
                        <label className="space-y-1">
                          <span className="text-[11px] text-[#57534E]">Baza Geri Çekme (mm)</span>
                          <input
                            type="number"
                            min={0}
                            max={120}
                            step={5}
                            value={activeModule.carcass.plinthSetbackMm ?? 35}
                            onChange={(e) =>
                              onUpdateCarcassConfig({
                                plinthSetbackMm: Math.max(0, Math.min(120, Number(e.target.value) || 0)),
                              })
                            }
                            className="w-full h-9 px-3 rounded-xl bg-[#FAF8F4] border border-[#DED8CC] font-mono text-xs font-semibold"
                          />
                        </label>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <span className="text-[11px] text-[#57534E] block">Kapak Kalınlığı</span>
                          <StudioSelect
                            ariaLabel="Kapak Kalınlığı"
                            value={activeModule.carcass.doorThickness ?? 18}
                            onChange={(val) =>
                              onUpdateCarcassConfig({ doorThickness: Number(val) || 18 })
                            }
                            options={[
                              { value: "18", label: "18 mm Standart" },
                              { value: "20", label: "20 mm Masif/Lake" },
                              { value: "22", label: "22 mm Kalın" },
                            ]}
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[11px] text-[#57534E] block">Üst Taç Profili</span>
                          <StudioSelect
                            ariaLabel="Üst Taç Profili"
                            value={
                              activeModule.carcass.crownMolding?.enabled
                                ? activeModule.carcass.crownMolding.style
                                : "none"
                            }
                            onChange={(v) => {
                              if (v === "none") {
                                onUpdateCarcassConfig({
                                  crownMolding: {
                                    enabled: false,
                                    style: "modern_flat",
                                    heightMm: 60,
                                    projectionMm: 20,
                                  },
                                });
                              } else {
                                onUpdateCarcassConfig({
                                  crownMolding: {
                                    enabled: true,
                                    style: v as "modern_flat" | "stepped" | "classic_coving" | "led_channel",
                                    heightMm: activeModule.carcass.crownMolding?.heightMm || 60,
                                    projectionMm: activeModule.carcass.crownMolding?.projectionMm || 20,
                                  },
                                });
                              }
                            }}
                            options={[
                              { value: "none", label: "Taç Yok" },
                              { value: "modern_flat", label: "Modern Düz" },
                              { value: "stepped", label: "Basamaklı" },
                              { value: "classic_coving", label: "Klasik" },
                              { value: "led_channel", label: "LED Kanallı Taç" },
                            ]}
                          />
                        </div>
                      </div>

                      <label className="space-y-1 block">
                        <span className="text-[10.5px] text-[#57534E]">CNC Üretim Notu</span>
                        <input
                          type="text"
                          placeholder="Fabrika / atölye kesim notu..."
                          value={activeModule.carcass.cncProductionNote || ""}
                          onChange={(e) =>
                            onUpdateCarcassConfig({ cncProductionNote: e.target.value })
                          }
                          className="w-full h-9 px-3 rounded-xl bg-[#FAF8F4] border border-[#DED8CC] text-xs"
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Mimari Bitişler, Desen Takibi ve Kertme */}
              <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] space-y-2.5">
                <div className="font-bold text-[#141413]">Mimari Detaylar & Desen Takibi</div>

                <div className="flex items-center justify-between py-1">
                  <div>
                    <div className="font-semibold text-[11.5px]">Cephe Ahşap Desen Takibi</div>
                    <div className="text-[10px] text-[#78716C]">
                      Kapak ve çekmecelerde kesintisiz damar sürekliliği
                    </div>
                  </div>
                  <StudioToggleSwitch
                    testId="v11-toggle-grain-continuity"
                    checked={facadeGrainContinuity}
                    onChange={(next) => onToggleFacadeGrainContinuity(next)}
                  />
                </div>

                {!isSimple && (
                <div className="flex items-center justify-between py-1 border-t border-[#F0ECE3]">
                  <div>
                    <div className="font-semibold text-[11.5px]">Arka Süpürgelik Çentiği</div>
                    <div className="text-[10px] text-[#78716C]">
                      Duvara sıfır yanaşma için yan dikme alt çentiği (80×15 mm)
                    </div>
                  </div>
                  <StudioToggleSwitch
                    testId="v11-toggle-baseboard-notch"
                    checked={hasBaseboardNotch}
                    onChange={(next) =>
                      onUpdateCarcassConfig({
                        baseboardNotch: {
                          enabled: next,
                          heightMm: 80,
                          depthMm: 15,
                        },
                      })
                    }
                  />
                </div>
                )}

                <div className={`grid ${isSimple ? "grid-cols-1" : "grid-cols-2"} gap-1.5 pt-1 border-t border-[#F0ECE3]`}>
                  <button
                    type="button"
                    onClick={onRunAutoFillersAndCrown}
                    className="py-2 px-2.5 rounded-xl bg-[#F5F2EA] hover:bg-[#EAE3D5] text-[11px] font-semibold cursor-pointer"
                  >
                    + Otomatik Taç & Bitiş
                  </button>
                  {!isSimple && (
                    <button
                      type="button"
                      onClick={onOpenCutoutModal}
                      className="py-2 px-2.5 rounded-xl bg-[#F5F2EA] hover:bg-[#EAE3D5] text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Scissors className="w-3 h-3" />
                      <span>Panel Kertme</span>
                    </button>
                  )}
                </div>
              </div>
            
                            </>
              )}

              {/* ÇATI EĞİMİ / NİŞ KESİMİ (EĞİMLİ TAVAN) */}
              {(() => {
                const slopeSpec = activeModule.carcass.roofSlope || {
                  side: "none" as const,
                  kneeWallHeightMm: Math.max(900, activeModule.dimensions.height - 550),
                  slopeRunMm: Math.min(activeModule.dimensions.width, 900),
                };
                const slopeGeom = calculateSlopedCeilingGeometry(
                  activeModule.dimensions.width,
                  activeModule.dimensions.height,
                  activeModule.dimensions.depth,
                  slopeSpec
                );
                const setSlope = (patch: Partial<typeof slopeSpec>) => {
                  const next = { ...slopeSpec, ...patch };
                  onUpdateCarcassConfig({ roofSlope: next });
                };
                return (
                  <div
                    data-testid="v11-roof-slope-section"
                    className="p-3 rounded-2xl bg-white/85 border border-[#E5DFD3] space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-[#141413]">
                        Çatı Eğimi / Merdiven Altı Kesimi
                      </span>
                      {slopeGeom.isSloped && (
                        <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-900 border border-blue-200">
                          {slopeGeom.slopeAngleDeg}° Eğim
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      {(
                        [
                          { id: "none", label: "Düz" },
                          { id: "left", label: "Sol Eğim" },
                          { id: "right", label: "Sağ Eğim" },
                          { id: "rear", label: "Arka Eğim" },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setSlope({ side: opt.id })}
                          className={`h-7 rounded-lg text-[11px] font-semibold border transition cursor-pointer ${
                            slopeSpec.side === opt.id
                              ? "bg-[#141413] text-white border-[#141413]"
                              : "bg-[#FAF8F4] hover:bg-[#EFEAE0] text-[#44403C] border-[#E5DFD3]"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {slopeGeom.isSloped && (
                      <div className="space-y-2 pt-1">
                        <div className="grid grid-cols-2 gap-2">
                          <label className="text-[10px] text-[#57534E] space-y-1">
                            <span>Düşük Kenar ({unitMode})</span>
                            <input
                              type="number"
                              min={unitMode === "cm" ? 50 : 500}
                              max={unitMode === "cm" ? Math.round((activeModule.dimensions.height - 150) / 10) : activeModule.dimensions.height - 150}
                              value={unitMode === "cm" ? Math.round(slopeSpec.kneeWallHeightMm / 10) : slopeSpec.kneeWallHeightMm}
                              onChange={(e) => {
                                const raw = Number(e.target.value) || 1200;
                                setSlope({ kneeWallHeightMm: unitMode === "cm" ? raw * 10 : raw });
                              }}
                              className="w-full h-8 px-2.5 rounded-lg bg-[#FAF8F4] border border-[#DDD6C8] font-mono text-xs text-[#141413]"
                            />
                          </label>
                          <label className="text-[10px] text-[#57534E] space-y-1">
                            <span>Eğim Mesafesi ({unitMode})</span>
                            <input
                              type="number"
                              min={unitMode === "cm" ? 20 : 200}
                              max={unitMode === "cm" ? Math.round(activeModule.dimensions.width / 10) : activeModule.dimensions.width}
                              value={unitMode === "cm" ? Math.round(slopeSpec.slopeRunMm / 10) : slopeSpec.slopeRunMm}
                              onChange={(e) => {
                                const raw = Number(e.target.value) || 600;
                                setSlope({ slopeRunMm: unitMode === "cm" ? raw * 10 : raw });
                              }}
                              className="w-full h-8 px-2.5 rounded-lg bg-[#FAF8F4] border border-[#DDD6C8] font-mono text-xs text-[#141413]"
                            />
                          </label>
                        </div>
                        <div className="text-[10px] font-mono text-[#57534E] flex items-center justify-between">
                          <span>Eğimli Üst Tabla: {slopeGeom.slopedTopLengthMm} mm</span>
                          <span>Düz Üst: {slopeGeom.flatTopLengthMm} mm</span>
                        </div>
                        {slopeGeom.warnings.length > 0 && (
                          <p className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                            {slopeGeom.warnings[0]}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </>
          )}

          {/* ==================== SEKME 2: İÇ DÜZEN ==================== */}
          {(activeTab === "interior" || activeTab === "hardware") && (
            <>
              <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-[#ECE7DD]/80 border border-[#DFD9CE]">
                <button
                  type="button"
                  data-testid="v11-interior-subtab-layout"
                  onClick={() => {
                    setInteriorSubTab("layout");
                    if (activeTab === "hardware") onChangeTab("interior");
                  }}
                  className={`py-1.5 px-2 rounded-xl text-[11px] font-semibold transition cursor-pointer ${
                    interiorSubTab === "layout"
                      ? "bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] text-white font-bold border border-[#38BDF8]/65 shadow-[0_0_16px_rgba(29,78,216,0.58)]"
                      : "text-[#57534E] hover:text-[#141413]"
                  }`}
                >
                  Yerleşim
                </button>
                <button
                  type="button"
                  data-testid="v11-interior-subtab-hardware"
                  onClick={() => setInteriorSubTab("hardware")}
                  className={`py-1.5 px-2 rounded-xl text-[11px] font-semibold transition cursor-pointer ${
                    interiorSubTab === "hardware"
                      ? "bg-[#141413] text-white shadow-2xs"
                      : "text-[#57534E] hover:text-[#141413]"
                  }`}
                >
                  Donanım
                </button>
              </div>

              {interiorSubTab === "hardware" ? (
                <RightHardwareLibraryPanel
                  activeModule={activeModule}
                  activeBayIndex={activeBayIndex}
                  experienceTier={experienceTier}
                  onApplyHardware={(bayIdx, hwId, opts) =>
                    useConfiguratorStore.getState().applyHardwareProductToBay(bayIdx, hwId, opts)
                  }
                  onOpenCustomHardwareModal={onOpenCustomHardwareModal}
                />
              ) : (
                <>
              <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#141413]">
                    Bölme Seçimi ({activeModule.bays.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => onSplitBayIntoTwo(safeBayIdx)}
                    className="px-2.5 py-1 rounded-full bg-[#141413] hover:bg-[#292524] text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Bölme Ekle</span>
                  </button>
                </div>

                {/* GERÇEKÇİ DOLAP ÖN GÖRÜNÜŞÜ BÖLME SEÇİCİSİ (Orantılı Gövde + Baza + Canlı İç Yerleşim) */}
                <div className="p-2.5 rounded-2xl bg-[#141923]/90 border border-white/12 flex flex-col items-center">
                  <div
                    className={`w-full ${
                      activeModule.bays.length === 1
                        ? "max-w-[116px]"
                        : activeModule.bays.length === 2
                        ? "max-w-[210px]"
                        : "max-w-full"
                    }`}
                  >
                    {/* Dolap Üst Taç + Gövde Çerçevesi */}
                    <div className="rounded-t-lg border-[3px] border-[#94A3B8]/65 bg-[#475569]/55 p-[2px] shadow-[0_8px_22px_rgba(0,0,0,0.45)]">
                      <div className="flex items-stretch gap-[3px] h-[118px] w-full">
                        {activeModule.bays.map((b, idx) => {
                          const isSel = idx === safeBayIdx;
                          const bwMm = Math.max(150, Math.round(bayClearWidths[idx] || 600));
                          const clearCm = Math.round(bwMm / 10);
                          const modInnerH = Math.max(
                            400,
                            activeModule.dimensions.height - (activeModule.carcass.plinthHeight ?? 100) - 36
                          );
                          const visShelves = (b.shelves || []).filter((s) => !s.isHidden);
                          const visDrawers = (b.drawers || []).filter((d) => !d.isHidden);
                          const visRails = (b.hangingRails || []).filter((r) => !r.isHidden);
                          const visSubDivs = b.subDividers || [];
                          return (
                            <button
                              key={b.index}
                              type="button"
                              onClick={() => onSelectBayIndex(idx)}
                              style={{ flex: `${Math.max(1, bwMm)} 1 0%` }}
                              title={`${idx + 1}. Bölme (${unitMode === "cm" ? `${clearCm} cm` : `${bwMm} mm`})`}
                              className={`group relative h-full overflow-hidden transition-all duration-200 cursor-pointer ${
                                isSel
                                  ? "bg-[#16273B] ring-2 ring-inset ring-[#38BDF8] shadow-[inset_0_0_18px_rgba(56,189,248,0.28)]"
                                  : "bg-[#1A202C] hover:bg-[#232B3A]"
                              }`}
                            >
                              {/* Raf, Askı ve Çekmece Yerleşimi (Gerçek Orantılı Yükseklik) */}
                              <div className="relative w-full h-full pointer-events-none">
                                {visDrawers.map((dr, di) => {
                                  const hPct = Math.max(9, Math.min(28, (dr.height / modInnerH) * 100));
                                  const bPct = Math.max(1, Math.min(96 - hPct, (dr.elevationY / modInnerH) * 100));
                                  return (
                                    <div
                                      key={`dr_${di}`}
                                      style={{ bottom: `${bPct}%`, height: `${hPct}%` }}
                                      className={`absolute left-[4px] right-[4px] rounded-[2px] border flex items-center justify-center ${
                                        isSel
                                          ? "bg-[#0284C7]/35 border-[#7DD3FC]/85"
                                          : "bg-slate-600/45 border-slate-400/65"
                                      }`}
                                    >
                                      <span className="w-5 h-[2px] rounded-full bg-white/85" />
                                    </div>
                                  );
                                })}
                                {visShelves.map((sh, si) => {
                                  const bPct = Math.max(4, Math.min(94, (sh.elevationY / modInnerH) * 100));
                                  const isFixed = sh.isAdjustable === false || Boolean(sh.isFixed);
                                  return (
                                    <div
                                      key={`sh_${si}`}
                                      style={{ bottom: `${bPct}%` }}
                                      className={`absolute left-[2px] right-[2px] rounded-full ${
                                        isFixed
                                          ? "h-[3px] bg-[#38BDF8] shadow-[0_0_6px_rgba(56,189,248,0.6)]"
                                          : "h-[2.5px] bg-[#E2B47E]"
                                      }`}
                                    />
                                  );
                                })}
                                {visRails.map((rl, ri) => {
                                  const bPct = Math.max(14, Math.min(92, (rl.elevationY / modInnerH) * 100));
                                  return (
                                    <div
                                      key={`rl_${ri}`}
                                      style={{ bottom: `${bPct}%` }}
                                      className="absolute left-[4px] right-[4px] flex flex-col items-center"
                                    >
                                      <div className="w-full h-[2.5px] rounded-full bg-[#7DD3FC]" />
                                      <div className="w-4 h-2.5 border-l border-r border-b border-[#7DD3FC]/75 rounded-b-sm -mt-[1px] opacity-80" />
                                    </div>
                                  );
                                })}
                                {visSubDivs.map((sd, sdi) => {
                                  const xPct = Math.max(18, Math.min(82, ((sd.offsetX || bwMm * 0.5) / bwMm) * 100));
                                  const bPct = Math.max(2, Math.min(92, ((sd.elevationY || 0) / modInnerH) * 100));
                                  const hPct = Math.max(8, Math.min(95 - bPct, ((sd.height || 300) / modInnerH) * 100));
                                  return (
                                    <div
                                      key={`sd_${sdi}`}
                                      style={{ left: `${xPct}%`, bottom: `${bPct}%`, height: `${hPct}%` }}
                                      className="absolute w-[2px] bg-slate-300/80"
                                    />
                                  );
                                })}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {/* Dolap Alt Baza (Ayak / Plinth) */}
                    <div className="mx-[3px] h-[8px] rounded-b-sm bg-[#2B3342] border-x border-b border-white/15" />

                    {/* Alt Bölme Etiketleri */}
                    <div className="flex items-center gap-[3px] mt-1.5 w-full">
                      {activeModule.bays.map((b, idx) => {
                        const isSel = idx === safeBayIdx;
                        const bwMm = Math.max(150, Math.round(bayClearWidths[idx] || 600));
                        const clearCm = Math.round(bwMm / 10);
                        return (
                          <button
                            key={`lbl_${b.index}`}
                            type="button"
                            onClick={() => onSelectBayIndex(idx)}
                            style={{ flex: `${Math.max(1, bwMm)} 1 0%` }}
                            className={`py-0.5 px-1 rounded-md text-center transition cursor-pointer ${
                              isSel
                                ? "bg-[#0284C7]/35 border border-[#38BDF8]/70 text-white"
                                : "text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            <div className="text-[10px] font-bold leading-tight">B{idx + 1}</div>
                            <div className="text-[9px] font-mono opacity-85 leading-tight">
                              {unitMode === "cm" ? `${clearCm}cm` : `${bwMm}`}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {activeModule.bays.length > 1 && (
                  <div className="flex items-center gap-2 pt-1 border-t border-[#F0ECE3]">
                    <button
                      type="button"
                      onClick={onEqualizeBaysAndShelves}
                      className="flex-1 py-1.5 rounded-xl bg-[#F5F2EA] hover:bg-[#EAE3D5] text-[11px] font-semibold text-[#44403C] cursor-pointer"
                    >
                      Genişlikleri Eşitle
                    </button>
                    {!(isSlidingBay && activeModule.bays.length <= 2) && (
                      <button
                        type="button"
                        onClick={() => onRemoveBayAt(safeBayIdx)}
                        className="py-1.5 px-3 rounded-xl hover:bg-red-50 text-[11px] font-semibold text-red-600 cursor-pointer"
                      >
                        {safeBayIdx + 1}. Bölmeyi Kaldır
                      </button>
                    )}
                  </div>
                )}
                {activeModule.bays.length > 1 && (onCopyBayInteriorToAllBays || onMirrorModuleBays) && (
                  <div className="flex items-center gap-1.5 pt-1">
                    {onCopyBayInteriorToAllBays && (
                      <button
                        type="button"
                        data-testid="v12-copy-bay-interior-btn"
                        onClick={() => onCopyBayInteriorToAllBays(safeBayIdx)}
                        className="flex-1 py-1.5 px-2 rounded-xl bg-[#EFECE4] hover:bg-[#E5DFD3] text-[10.5px] font-semibold text-[#141413] cursor-pointer"
                        title="Bu bölmedeki raf, çekmece ve askı düzenini diğer tüm bölmelere kopyala"
                      >
                        İç Düzeni Tüm Bölmelere Kopyala
                      </button>
                    )}
                    {onMirrorModuleBays && (
                      <button
                        type="button"
                        data-testid="v12-mirror-bays-btn"
                        onClick={onMirrorModuleBays}
                        className="py-1.5 px-2.5 rounded-xl bg-[#F5F2EA] hover:bg-[#EAE3D5] text-[10.5px] font-semibold text-[#44403C] cursor-pointer"
                        title="Sol ve sağ bölmelerin dizilimini ve kapak yönlerini aynala"
                      >
                        Simetri ⇄
                      </button>
                    )}
                  </div>
                )}

                {!isSimple && activeModule.bays.length > 1 && (
                  <div className="pt-2 border-t border-[#F0ECE3] space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#57534E]">{safeBayIdx + 1}. Bölme İç Genişlik</span>
                      <span className="font-mono font-bold">
                        {unitMode === "cm" ? `${Number(((bayClearWidths[safeBayIdx] || 600) / 10).toFixed(1))} cm` : `${Math.round(bayClearWidths[safeBayIdx] || 600)} mm`}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={280}
                      max={Math.max(400, wMm - 320)}
                      step={10}
                      value={Math.round(bayClearWidths[safeBayIdx] || 600)}
                      onPointerDown={() => onBeginSliderDrag?.()}
                      onPointerUp={() => onCommitSliderDrag?.()}
                      onPointerCancel={() => onCommitSliderDrag?.()}
                      onBlur={() => onCommitSliderDrag?.()}
                      onChange={(e) => onSetBayCustomWidth(safeBayIdx, Number(e.target.value))}
                      className="w-full accent-[#141413] cursor-pointer"
                    />
                  </div>
                )}
              </div>

              {formattedFinding && activeFinding && (
                <div className="p-3.5 rounded-2xl bg-[#F7F2E7] border border-[#E3D5B8] space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-[#6B4F28] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{formattedFinding.title}</span>
                    </span>
                  </div>
                  <p className="text-[11px] text-[#57534E] leading-relaxed">
                    {formattedFinding.detail}
                  </p>
                  {activeFinding.remediationProposals &&
                    activeFinding.remediationProposals.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {activeFinding.remediationProposals.slice(0, 2).map((prop) => (
                          <button
                            key={prop.id}
                            type="button"
                            onClick={() => onApplyApprovedFix(prop)}
                            className="px-3 py-1.5 rounded-full bg-[#141413] hover:bg-[#292524] text-white text-[11px] font-semibold cursor-pointer transition"
                          >
                            Uygula: {prop.label}
                          </button>
                        ))}
                      </div>
                    )}
                </div>
              )}

              <div className="space-y-2">
                <div className="text-[11px] font-bold text-[#57534E] px-0.5">
                  {safeBayIdx + 1}. Bölme Hazır İç Düzeni
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {V11_INTERIOR_PRESETS.map((pr) => {
                    const isMultiShelf = pr.id === "shelves_5";
                    return (
                      <div key={pr.id} className="relative">
                        <button
                          type="button"
                          title={`${pr.title} — ${pr.subtitle}`}
                          onClick={() => {
                            if (isMultiShelf) {
                              setMultiShelfOpen(true);
                              onApplyBayPreset(safeBayIdx, pr.id, {
                                shelfCount: multiShelfCount,
                                shelfMountMode: multiShelfMount,
                                shelfThicknessMm: multiShelfThick,
                              });
                            } else {
                              setMultiShelfOpen(false);
                              onApplyBayPreset(safeBayIdx, pr.id);
                            }
                          }}
                          className={`w-full p-2.5 rounded-2xl bg-white hover:bg-[#F5F2EA] border flex items-center gap-2.5 text-left transition cursor-pointer ${
                            isMultiShelf && multiShelfOpen
                              ? "border-[#141413] ring-1 ring-[#141413]/20"
                              : "border-[#E5DFD3] hover:border-[#141413]/40"
                          }`}
                        >
                          {renderPresetSvg(pr.diagram)}
                          <div className="min-w-0 pr-4">
                            <div className="font-bold text-[#141413] text-[11.5px] leading-tight">{pr.title}</div>
                          </div>
                        </button>
                        {isMultiShelf && (
                          <button
                            type="button"
                            title="Çok Raflı Ayarları"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMultiShelfOpen((v) => !v);
                            }}
                            className={`absolute top-2 right-2 w-6 h-6 rounded-lg flex items-center justify-center transition cursor-pointer ${
                              multiShelfOpen
                                ? "bg-[#141413] text-white"
                                : "bg-[#F5F2EA] text-[#57534E] hover:bg-[#EAE3D5]"
                            }`}
                          >
                            <SlidersHorizontal className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                {multiShelfOpen && (
                  <div className="p-3 rounded-2xl bg-white border border-[#DED8CC] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-[#141413]">
                        Çok Raflı Ayarları
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            const next = Math.max(2, multiShelfCount - 1);
                            setMultiShelfCount(next);
                            onApplyBayPreset(safeBayIdx, "shelves_5", {
                              shelfCount: next,
                              shelfMountMode: multiShelfMount,
                              shelfThicknessMm: multiShelfThick,
                            });
                          }}
                          className="w-7 h-7 rounded-lg bg-[#F5F2EA] hover:bg-[#EAE3D5] flex items-center justify-center cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-12 text-center font-mono text-xs font-bold text-[#141413]">
                          {multiShelfCount} Raf
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const next = Math.min(10, multiShelfCount + 1);
                            setMultiShelfCount(next);
                            onApplyBayPreset(safeBayIdx, "shelves_5", {
                              shelfCount: next,
                              shelfMountMode: multiShelfMount,
                              shelfThicknessMm: multiShelfThick,
                            });
                          }}
                          className="w-7 h-7 rounded-lg bg-[#F5F2EA] hover:bg-[#EAE3D5] flex items-center justify-center cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {(
                        [
                          { id: "auto", label: "Orta Sabit" },
                          { id: "all_adjustable", label: "Tümü Hareketli" },
                          { id: "all_fixed", label: "Tümü Sabit" },
                        ] as const
                      ).map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setMultiShelfMount(m.id);
                            onApplyBayPreset(safeBayIdx, "shelves_5", {
                              shelfCount: multiShelfCount,
                              shelfMountMode: m.id,
                              shelfThicknessMm: multiShelfThick,
                            });
                          }}
                          className={`py-1.5 px-1.5 rounded-lg text-[10.5px] font-semibold cursor-pointer ${
                            multiShelfMount === m.id
                              ? "bg-[#141413] text-white"
                              : "bg-[#F5F2EA] hover:bg-[#EAE3D5] text-[#44403C]"
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {([18, 25] as const).map((th) => (
                        <button
                          key={th}
                          type="button"
                          onClick={() => {
                            setMultiShelfThick(th);
                            onApplyBayPreset(safeBayIdx, "shelves_5", {
                              shelfCount: multiShelfCount,
                              shelfMountMode: multiShelfMount,
                              shelfThicknessMm: th,
                            });
                          }}
                          className={`py-1.5 rounded-lg font-mono text-[11px] font-semibold cursor-pointer ${
                            multiShelfThick === th
                              ? "bg-[#141413] text-white"
                              : "bg-[#F5F2EA] hover:bg-[#EAE3D5] text-[#44403C]"
                          }`}
                        >
                          {th} mm Raf Kalınlığı
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between px-0.5">
                  <span className="text-[11px] font-bold text-[#57534E]">+ İç Eleman</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(() => {
                    const allowedSet = getCompatibleInteriorElementsForModuleBay(
                      activeModule,
                      safeBayIdx
                    );
                    const allCandidates: Array<{
                      compatKey: CompatibleInteriorElementKey;
                      id: string;
                      label: string;
                      visual: InteriorVisualKind;
                      dragVisual: string;
                      count: number;
                      onClick: () => void;
                    }> = [
                      {
                        compatKey: "movable_shelf",
                        id: "lib_shelf",
                        label: "Hareketli Raf",
                        visual: "shelf",
                        dragVisual: "shelf",
                        count:
                          activeBay?.shelves.filter(
                            (s) => !s.isHidden && s.isAdjustable !== false && !s.isFixed
                          ).length || 0,
                        onClick: () => onAddShelf(safeBayIdx),
                      },
                      {
                        compatKey: "fixed_shelf",
                        id: "lib_fixed_shelf",
                        label: "Sabit Taşıyıcı Raf",
                        visual: "fixed_shelf",
                        dragVisual: "shelf",
                        count:
                          activeBay?.shelves.filter(
                            (s) => !s.isHidden && (s.isAdjustable === false || Boolean(s.isFixed))
                          ).length || 0,
                        onClick: () => onAddFixedShelf(safeBayIdx),
                      },
                      {
                        compatKey: "external_drawer",
                        id: "lib_drawer",
                        label: "Dış Çekmece",
                        visual: "drawer",
                        dragVisual: "drawer",
                        count: activeBay?.drawers.filter((d) => !d.isInternal).length || 0,
                        onClick: () => onAddDrawer(safeBayIdx),
                      },
                      {
                        compatKey: "internal_drawer",
                        id: "lib_internal_drawer",
                        label: isSlidingBay ? "Sürgü İçi Çekmece" : "Gizli İç Çekmece",
                        visual: "internal_drawer",
                        dragVisual: "internal_drawer",
                        count:
                          activeBay?.drawers.filter((d) => Boolean(d.isInternal) || isSlidingBay)
                            .length || 0,
                        onClick: () => onAddInternalDrawer(safeBayIdx),
                      },
                      {
                        compatKey: "sub_divider",
                        id: "lib_sub_divider",
                        label: "Raf Arası Dikme",
                        visual: "sub_divider",
                        dragVisual: "sub_divider",
                        count: activeBay?.subDividers?.length || 0,
                        onClick: () => onAddSubDivider(safeBayIdx),
                      },
                      {
                        compatKey: "waste_bin",
                        id: "lib_waste_bin",
                        label: "Raylı Çöp Sistemi",
                        visual: "waste_bin",
                        dragVisual: "drawer",
                        count:
                          activeBay?.specialFittings.filter((f) => f.type === "waste_bin")
                            .length || 0,
                        onClick: () => onAddSpecialFitting(safeBayIdx, "waste_bin"),
                      },
                      {
                        compatKey: "spice_pullout",
                        id: "lib_spice_pullout",
                        label: "Teleskopik Şişelik",
                        visual: "spice_pullout",
                        dragVisual: "drawer",
                        count:
                          activeBay?.specialFittings.filter((f) => f.type === "spice_pullout")
                            .length || 0,
                        onClick: () => onAddSpecialFitting(safeBayIdx, "spice_pullout"),
                      },
                      {
                        compatKey: "pantry_pullout",
                        id: "lib_pantry_pullout",
                        label: "Boy Kiler Mekanizması",
                        visual: "pantry_pullout",
                        dragVisual: "drawer",
                        count:
                          activeBay?.specialFittings.filter((f) => f.type === "pantry_pullout")
                            .length || 0,
                        onClick: () => onAddSpecialFitting(safeBayIdx, "pantry_pullout"),
                      },
                      {
                        compatKey: "corner_lemans",
                        id: "lib_corner_lemans",
                        label: "Kör Köşe LeMans II",
                        visual: "corner_lemans",
                        dragVisual: "shelf",
                        count:
                          activeBay?.specialFittings.filter((f) => f.type === "corner_lemans")
                            .length || 0,
                        onClick: () => onAddSpecialFitting(safeBayIdx, "corner_lemans"),
                      },
                      {
                        compatKey: "wire_basket",
                        id: "lib_wire_basket",
                        label: "Tel Sepet",
                        visual: "wire_basket",
                        dragVisual: "drawer",
                        count:
                          activeBay?.specialFittings.filter((f) => f.type === "wire_basket")
                            .length || 0,
                        onClick: () => onAddSpecialFitting(safeBayIdx, "wire_basket"),
                      },
                      {
                        compatKey: "hanging_rail",
                        id: "lib_rail",
                        label: "Elbise Askısı",
                        visual: "rail",
                        dragVisual: "rail",
                        count: activeBay?.hangingRails.length || 0,
                        onClick: () => onAddHangingRail(safeBayIdx),
                      },
                      {
                        compatKey: "trouser_pullout",
                        id: "lib_trouser_rack",
                        label: "Pantolonluk",
                        visual: "trouser_rack",
                        dragVisual: "trouser_rack",
                        count:
                          activeBay?.specialFittings.filter((f) => f.type === "trouser_rack")
                            .length || 0,
                        onClick: () => onAddSpecialFitting(safeBayIdx, "trouser_rack"),
                      },
                      {
                        compatKey: "shoe_pullout",
                        id: "lib_shoe_rack",
                        label: "Ayakkabılık",
                        visual: "shoe_rack",
                        dragVisual: "shoe_rack",
                        count:
                          activeBay?.specialFittings.filter((f) => f.type === "shoe_rack").length ||
                          0,
                        onClick: () => onAddSpecialFitting(safeBayIdx, "shoe_rack"),
                      },
                      {
                        compatKey: "jewelry_tray",
                        id: "lib_jewelry_tray",
                        label: "Takı Çekmecesi",
                        visual: "jewelry_tray",
                        dragVisual: "jewelry_tray",
                        count:
                          activeBay?.specialFittings.filter((f) => f.type === "jewelry_tray")
                            .length || 0,
                        onClick: () => onAddSpecialFitting(safeBayIdx, "jewelry_tray"),
                      },
                      {
                        compatKey: "pantograph_lift",
                        id: "lib_rail_lift",
                        label: "Asansörlü Askı",
                        visual: "rail",
                        dragVisual: "rail",
                        count: 0,
                        onClick: () => onAddHangingRail(safeBayIdx),
                      },
                      {
                        compatKey: "led_hanging_rail",
                        id: "lib_rail_led",
                        label: "LED'li Askı Borusu",
                        visual: "rail",
                        dragVisual: "rail",
                        count: activeModule.carcass.lighting?.enabled ? 1 : 0,
                        onClick: () => {
                          onAddHangingRail(safeBayIdx);
                          onToggleModuleLed(true, { ledType: "led_rod_strip" });
                        },
                      },
                      {
                        compatKey: "tie_belt_rack",
                        id: "lib_tie_belt",
                        label: "Kemer & Kravatlık",
                        visual: "trouser_rack",
                        dragVisual: "trouser_rack",
                        count:
                          activeBay?.specialFittings.filter((f) => f.type === "tie_rack")
                            .length || 0,
                        onClick: () => onAddSpecialFitting(safeBayIdx, "tie_rack"),
                      },
                    ];
                    return allCandidates.filter((c) => allowedSet.has(c.compatKey));
                  })().map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      draggable={false}
                      onPointerDown={(e) =>
                        startLive3DPartGrab(
                          e,
                          {
                            id: item.id,
                            title: item.label,
                            visual: item.dragVisual,
                          },
                          item.onClick
                        )
                      }
                      onKeyDown={(ke) => {
                        if (ke.key === "Enter" || ke.key === " ") {
                          ke.preventDefault();
                          item.onClick();
                        }
                      }}
                      title={`${item.label} — Tıklayın veya basılı tutup doğrudan 3B dolabın içine taşıyın`}
                      className="group relative p-2 rounded-2xl bg-white hover:bg-[#F5F2EA] border border-[#E5DFD3] hover:border-[#38BDF8]/70 flex flex-col items-stretch gap-1.5 text-left transition cursor-grab active:cursor-grabbing touch-none select-none"
                    >
                      <div className="relative h-[76px] w-full rounded-xl bg-[#181D27]/85 border border-white/12 flex items-center justify-center overflow-hidden">
                        {renderInteriorItemSvg(item.visual, item.id)}
                        <span
                          className={`absolute top-1.5 right-1.5 min-w-[20px] h-5 px-1.5 rounded-full text-[10.5px] font-bold flex items-center justify-center ${
                            item.count > 0
                              ? "bg-gradient-to-br from-[#0284C7] to-[#1E40AF] text-white shadow-[0_0_10px_rgba(29,78,216,0.52)]"
                              : "bg-white/12 text-slate-200 border border-white/15"
                          }`}
                        >
                          {item.count > 0 ? item.count : "+"}
                        </span>
                      </div>
                      <span className="font-bold text-[#141413] text-[11.5px] leading-tight text-center px-0.5 truncate">
                        {item.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Çekmece Ray & Kasa Sistemi (Pro / Üretim — Fiziksel aksesuarlar üstteki İç Eleman Ekle grubundadır) */}
              {!isSimple && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-0.5">
                    <span className="text-[11px] font-bold text-[#57534E]">
                      Çekmece Ray &amp; Kasa Sistemi
                    </span>
                    <span className="text-[10px] text-[#8C7A6B]">Çekmece mekanizma seçimi</span>
                  </div>
                  <div className="grid grid-cols-6 gap-1">
                    {[
                      {
                        id: "metal_box_legrabox" as const,
                        icon: "metal_box_legrabox",
                        label: "Blum Legrabox",
                      },
                      {
                        id: "metal_box_tandembox" as const,
                        icon: "metal_box_tandembox",
                        label: "Blum Tandembox",
                      },
                      {
                        id: "wooden_undermount" as const,
                        icon: "wooden_undermount",
                        label: "Movento Gizli Ray",
                      },
                    ].map((hw) => {
                      const activeSys = activeModule.carcass.drawerBoxSystem === hw.id;
                      return (
                        <button
                          key={hw.id}
                          type="button"
                          onClick={() => {
                            onUpdateCarcassConfig({ drawerBoxSystem: hw.id });
                          }}
                          title={`${hw.label} — Modüldeki çekmecelerin ray ve kasa sistemini günceller`}
                          className={`p-2 rounded-2xl border flex flex-col items-center justify-center gap-1 text-center transition cursor-pointer ${
                            activeSys
                              ? "bg-[#141413] text-white border-[#141413] shadow-xs"
                              : "bg-white hover:bg-[#F5F2EA] text-[#141413] border-[#E5DFD3] hover:border-[#8C7A6B]"
                          }`}
                        >
                          {renderHardwareTechnicalSvg(hw.icon)}
                          <span className="font-semibold text-[10px] leading-tight">
                            {hw.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {activeBay && (
                <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#141413]">
                      {safeBayIdx + 1}. Bölmedeki Elemanlar
                    </span>
                    {!isSimple && activeBay.shelves.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const curThick =
                            activeBay.shelves[0]?.thickness ||
                            activeModule.carcass.panelThickness ||
                            18;
                          onSetShelfThickness(safeBayIdx, "all", curThick === 25 ? 18 : 25);
                        }}
                        className="px-2 py-0.5 rounded-full bg-[#F5F2EA] hover:bg-[#EAE3D5] text-[10.5px] font-semibold cursor-pointer"
                      >
                        Tüm Raflar: {activeBay.shelves[0]?.thickness || activeModule.carcass.panelThickness || 18} mm
                      </button>
                    )}
                  </div>

                  {activeBay.shelves.length > 0 && (
                    <div className="space-y-1.5">
                      {activeBay.shelves.map((sh, i) => {
                        const isFixedSh = sh.isAdjustable === false || Boolean(sh.isFixed);
                        const connType = sh.fixedConnectorType || "minifix_dowel";
                        const shThick = sh.thickness || activeModule.carcass.panelThickness || 18;
                        return (
                          <div
                            key={sh.id}
                            className={`flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] ${
                              isFixedSh
                                ? "bg-[#F6EFE2] border-[#DFCFAF]"
                                : "bg-[#F8F6F1] border-[#E6E1D6]"
                            }`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-bold text-[#141413] shrink-0">
                                Raf {i + 1}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  onSetShelfMountType(safeBayIdx, sh.id, isFixedSh, connType)
                                }
                                title={
                                  isFixedSh
                                    ? "Sabit taşıyıcı raf (gövdeyi birbirine kilitler) — hareketli rafa çevirmek için tıklayın"
                                    : "Hareketli raf (Sistem 32 Ø5mm pimli) — sabit taşıyıcı rafa çevirmek için tıklayın"
                                }
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition cursor-pointer ${
                                  isFixedSh
                                    ? "bg-[#141413] text-[#F5EFE6]"
                                    : "bg-white border border-[#DAD3C5] text-[#44403C] hover:bg-[#EFECE4]"
                                }`}
                              >
                                {isFixedSh ? (
                                  <>
                                    <Lock className="w-2.5 h-2.5" />
                                    <span>Sabit</span>
                                  </>
                                ) : (
                                  <>
                                    <ArrowUpDown className="w-2.5 h-2.5" />
                                    <span>Hareketli</span>
                                  </>
                                )}
                              </button>

                              {!isSimple && isFixedSh && (
                                <StudioSelect
                                  ariaLabel={`Raf ${i + 1} Bağlantı Tipi`}
                                  size="sm"
                                  className="w-28"
                                  value={connType}
                                  onChange={(val) =>
                                    onSetShelfMountType(
                                      safeBayIdx,
                                      sh.id,
                                      false,
                                      val as "minifix_dowel" | "rafix_20"
                                    )
                                  }
                                  options={[
                                    { value: "minifix_dowel", label: "Minifix", icon: renderHardwareTechnicalSvg("minifix_dowel") },
                                    { value: "rafix_20", label: "Rafix 20", icon: renderHardwareTechnicalSvg("rafix_20") },
                                  ]}
                                />
                              )}
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {!isSimple ? (
                                <>
                                  <input
                                    type="number"
                                    step={isFixedSh ? 1 : 32}
                                    value={Math.round(sh.elevationY)}
                                    onChange={(e) =>
                                      onSetShelfElevation(
                                        safeBayIdx,
                                        sh.id,
                                        Math.max(64, Number(e.target.value) || 0)
                                      )
                                    }
                                    className="w-12 px-1 py-0.5 rounded bg-white border border-[#DED8CC] font-mono text-[10px] text-center"
                                    title="Alt tabladan yükseklik (mm)"
                                  />
                                  <span className="text-[9.5px] font-mono text-[#78716C]">
                                    {shThick}mm
                                  </span>
                                </>
                              ) : (
                                <span className="text-[10px] font-mono text-[#78716C]">
                                  {Math.round(sh.elevationY / 10)} cm
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => onRemoveShelf(safeBayIdx, sh.id)}
                                className="w-5 h-5 rounded-full hover:bg-red-50 text-[#78716C] hover:text-red-600 flex items-center justify-center cursor-pointer"
                                title="Rafı Kaldır"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5">

                    {[...activeBay.drawers]
                      .sort((a, b) => (b.elevationY || 0) - (a.elevationY || 0))
                      .map((dr, i) => (
                      <div
                        key={dr.id}
                        className="w-full flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#F5F2EA] text-[11px] font-medium"
                      >
                        <span className="truncate font-semibold text-[#141413]">
                          {dr.isInternal || isSlidingBay ? "İç Çekmece" : "Çekmece"} {i + 1}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {onSetDrawerPlacement && (
                            <>
                              <StudioSelect
                                ariaLabel={`Çekmece ${i + 1} Yüksekliği`}
                                size="sm"
                                className="w-28"
                                value={dr.height}
                                onChange={(val) =>
                                  onSetDrawerPlacement(
                                    safeBayIdx,
                                    dr.id,
                                    dr.elevationY,
                                    Number(val) || dr.height,
                                    true
                                  )
                                }
                                options={
                                  (dr.boxSystemType || activeModule.carcass.drawerBoxSystem) ===
                                  "metal_box_legrabox"
                                    ? [
                                        { value: "90", label: "N · 90 mm" },
                                        { value: "115", label: "M · 115 mm" },
                                        { value: "150", label: "K · 150 mm" },
                                        { value: "200", label: "C · 200 mm" },
                                        { value: "265", label: "F · 265 mm" },
                                      ]
                                    : [120, 140, 160, 180, 220, 280].map((dh) => ({
                                        value: String(dh),
                                        label: `${dh} mm`,
                                      }))
                                }
                              />
                              {!isSlidingBay && (
                                <button
                                  type="button"
                                  title="Dış Çekmece ↔ Gizli İç Çekmece Dönüştür"
                                  onClick={() =>
                                    onSetDrawerPlacement(
                                      safeBayIdx,
                                      dr.id,
                                      dr.elevationY,
                                      dr.height,
                                      true,
                                      { isInternal: !dr.isInternal }
                                    )
                                  }
                                  className="h-6 px-1.5 rounded-md bg-white hover:bg-[#141413] hover:text-white border border-[#DED8CC] text-[9.5px] font-semibold transition cursor-pointer"
                                >
                                  {dr.isInternal ? "İç → Dış" : "Dış → İç"}
                                </button>
                              )}
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => onRemoveDrawer(safeBayIdx, dr.id)}
                            className="w-5 h-5 rounded-full hover:bg-red-50 text-[#78716C] hover:text-red-600 flex items-center justify-center cursor-pointer"
                            title="Çekmeceyi Sil"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}

                    {(activeBay.drawers.length > 0 || !isSimple) && (
                      <div className="w-full grid grid-cols-2 gap-2 pt-2 mt-1 border-t border-[#F0ECE3]">
                        <div className="space-y-1">
                          <span className="text-[11px] text-[#57534E] font-medium block">
                            Çekmece Kasa Sistemi
                          </span>
                          <StudioSelect
                            ariaLabel="Çekmece Kasa Sistemi"
                            value={activeModule.carcass.drawerBoxSystem || "wooden_undermount"}
                            onChange={(val) =>
                              onUpdateCarcassConfig({
                                drawerBoxSystem: val as DrawerBoxSystemType,
                              })
                            }
                            options={[
                              { value: "wooden_undermount", label: "Ahşap + Gizli Ray", icon: renderHardwareTechnicalSvg("wooden_undermount") },
                              { value: "metal_box_legrabox", label: "Blum Legrabox", icon: renderHardwareTechnicalSvg("metal_box_legrabox") },
                              { value: "metal_box_tandembox", label: "Blum Tandembox", icon: renderHardwareTechnicalSvg("metal_box_tandembox") },
                              { value: "metal_box_avantech", label: "Hettich AvanTech", icon: renderHardwareTechnicalSvg("metal_box_avantech") },
                            ]}
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[11px] text-[#57534E] font-medium block">
                            İç Çekmece Menteşesi
                          </span>
                          <StudioSelect
                            ariaLabel="İç Çekmece Menteşesi"
                            value={
                              activeModule.carcass.internalDrawerHingeSolution || "auto_155_hinge"
                            }
                            onChange={(val) =>
                              onUpdateCarcassConfig({
                                internalDrawerHingeSolution: val as
                                  | "auto_155_hinge"
                                  | "spacer_block_25mm",
                              })
                            }
                            options={[
                              { value: "auto_155_hinge", label: "155° Sıfır Çıkıntı", icon: renderHardwareTechnicalSvg("auto_155_hinge") },
                              { value: "spacer_block_25mm", label: "25mm Menteşe Paspayı", icon: renderHardwareTechnicalSvg("spacer_block_25mm") },
                            ]}
                          />
                        </div>
                      </div>
                    )}

                    {activeBay.hangingRails.map((hr, i) => (
                      <div
                        key={hr.id}
                        className="w-full flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#F5F2EA] text-[11px] font-medium"
                      >
                        <span className="font-semibold text-[#141413] shrink-0">
                          Askı {i + 1}
                        </span>
                        <div className="flex items-center gap-1.5 min-w-0">
                          {onSetHangingRailProfile && (
                            <StudioSelect
                              ariaLabel={`Askı ${i + 1} Boru Tipi`}
                              size="sm"
                              className="w-44"
                              value={hr.profileType || "oval_30x15"}
                              onChange={(val) =>
                                onSetHangingRailProfile(
                                  safeBayIdx,
                                  hr.id,
                                  val as HangingRailConfig["profileType"]
                                )
                              }
                              options={[
                                { value: "oval_30x15", label: "Krom Oval 30×15", icon: renderHardwareTechnicalSvg("oval_30x15") },
                                { value: "round_25", label: "Yuvarlak Ø25 Krom", icon: renderHardwareTechnicalSvg("round_25") },
                                { value: "led_black_30x15", label: "LED'li Siyah Askı", icon: renderHardwareTechnicalSvg("led_black_30x15") },
                                { value: "brass_25", label: "Pirinç / Gold Ø25", icon: renderHardwareTechnicalSvg("brass_25") },
                                { value: "lift_pantograph", label: "Asansörlü Pantograf", icon: renderHardwareTechnicalSvg("lift_pantograph") },
                                { value: "pullout_front", label: "Öne Çekilir Askı", icon: renderHardwareTechnicalSvg("pullout_front") },
                              ]}
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => onRemoveHangingRail(safeBayIdx, hr.id)}
                            className="w-6 h-6 rounded-full hover:bg-red-50 text-[#78716C] hover:text-red-600 flex items-center justify-center cursor-pointer shrink-0"
                            title="Askıyı Kaldır"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}

                    {activeBay.specialFittings.map((sf, i) => {
                      const sfLabelMap: Record<string, string> = {
                        waste_bin: "Raylı Çöp Sistemi",
                        spice_pullout: "Teleskopik Şişelik",
                        pantry_pullout: "Boy Kiler Mekanizması",
                        corner_lemans: "LeMans II Fasulye",
                        magic_corner: "Magic Corner",
                        carousel_half_moon: "270° Karusel",
                        trouser_rack: "Pantolonluk",
                        shoe_rack: "Ayakkabılık",
                        jewelry_tray: "Takı Çekmecesi",
                        tie_rack: "Kemer & Kravatlık",
                        wire_basket: "Tel Sepet",
                      };
                      const sfName = sfLabelMap[sf.type] || `Aksesuar ${i + 1}`;
                      return (
                      <span
                        key={sf.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F5F2EA] text-[11px] font-medium"
                      >
                        <span>{sfName}</span>
                        <button
                          type="button"
                          onClick={() => onRemoveSpecialFitting(safeBayIdx, sf.id)}
                          className="text-[#78716C] hover:text-red-600 cursor-pointer"
                        >
                          ✕
                        </button>
                      </span>
                      );
                    })}

                    {(activeBay.subDividers || []).length > 0 && (
                      <div className="w-full space-y-1.5 pt-1">
                        {(activeBay.subDividers || []).map((sd, i) => {
                          const curIvIdx = Math.max(
                            0,
                            subDividerIntervals.findIndex(
                              (iv) =>
                                Math.abs(iv.botY - sd.elevationY) <= 22 ||
                                (sd.elevationY + sd.height / 2 >= iv.botY &&
                                  sd.elevationY + sd.height / 2 <= iv.topY)
                            )
                          );
                          const bayW = bayClearWidths[safeBayIdx] || 600;
                          const panelT = activeModule.carcass.panelThickness || 18;
                          return (
                            <div
                              key={sd.id}
                              data-testid={`v12-subdivider-row-${i}`}
                              className="w-full px-2.5 py-2 rounded-xl bg-[#F8F5EE] border border-[#E2DACB] space-y-1.5 text-[11px]"
                            >
                              <div className="flex items-center justify-between gap-1.5">
                                <span className="font-bold text-[#141413]">
                                  Raf Arası Dikme {i + 1}
                                </span>
                                <div className="flex items-center gap-1">
                                  {onSetSubDividerPlacement && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onSetSubDividerPlacement(safeBayIdx, sd.id, {
                                          offsetX: Math.round((bayW - panelT) / 2),
                                        })
                                      }
                                      className="px-2 py-0.5 rounded-full bg-white border border-[#DED8CC] text-[10px] font-semibold text-[#44403C] hover:text-[#141413] cursor-pointer"
                                      title="Dikmeyi bölme genişliğinin tam ortasına hizala"
                                    >
                                      Ortala
                                    </button>
                                  )}
                                  {!isSimple && onSetSubDividerPlacement && (
                                    <input
                                      type="number"
                                      step={unitMode === "cm" ? 1 : 10}
                                      value={unitMode === "cm" ? Number((sd.offsetX / 10).toFixed(1)) : Math.round(sd.offsetX)}
                                      onChange={(e) => {
                                        const raw = Number(e.target.value) || 0;
                                        const mmVal = unitMode === "cm" ? Math.round(raw * 10) : Math.round(raw);
                                        onSetSubDividerPlacement(safeBayIdx, sd.id, {
                                          offsetX: Math.max(40, mmVal),
                                        });
                                      }}
                                      className="w-20 h-8 px-2 rounded-lg bg-white border border-[#DED8CC] font-mono text-xs font-semibold text-center"
                                      title={`Bölme solundan mesafe (${unitMode})`}
                                    />
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => onRemoveSubDivider(safeBayIdx, sd.id)}
                                    className="w-5 h-5 rounded-full hover:bg-red-50 text-[#78716C] hover:text-red-600 flex items-center justify-center cursor-pointer"
                                    title="Raf Arası Dikmeyi Kaldır"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>

                              {onSetSubDividerPlacement && subDividerIntervals.length > 0 && (
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-[#78716C] shrink-0">Aralık:</span>
                                  <StudioSelect
                                    ariaLabel={`Raf Arası Dikme ${i + 1} Raf Aralığı`}
                                    size="sm"
                                    className="flex-1 min-w-0"
                                    value={curIvIdx}
                                    onChange={(val) => {
                                      const targetIv = subDividerIntervals[Number(val)];
                                      if (targetIv) {
                                        onSetSubDividerPlacement(safeBayIdx, sd.id, {
                                          elevationY: targetIv.botY,
                                          height: targetIv.height,
                                          targetMidY: Math.round((targetIv.botY + targetIv.topY) / 2),
                                        });
                                      }
                                    }}
                                    options={subDividerIntervals.map((iv, ivIdx) => ({
                                      value: String(ivIdx),
                                      label: `${iv.label} (${
                                        unitMode === "cm"
                                          ? `${Number((iv.height / 10).toFixed(1))} cm`
                                          : `${Math.round(iv.height)} mm`
                                      })`,
                                    }))}
                                  />
                                  {subDividerIntervals.length > 1 && (
                                    <>
                                      <button
                                        type="button"
                                        disabled={curIvIdx >= subDividerIntervals.length - 1}
                                        onClick={() => {
                                          const upIv = subDividerIntervals[curIvIdx + 1];
                                          if (upIv) {
                                            onSetSubDividerPlacement(safeBayIdx, sd.id, {
                                              elevationY: upIv.botY,
                                              height: upIv.height,
                                              targetMidY: Math.round((upIv.botY + upIv.topY) / 2),
                                            });
                                          }
                                        }}
                                        title="Üst raf aralığına taşı"
                                        className="px-1.5 h-6 rounded-lg bg-white hover:bg-[#EFECE4] disabled:opacity-35 border border-[#DED8CC] font-bold text-[10px] cursor-pointer"
                                      >
                                        ⬆
                                      </button>
                                      <button
                                        type="button"
                                        disabled={curIvIdx <= 0}
                                        onClick={() => {
                                          const dnIv = subDividerIntervals[curIvIdx - 1];
                                          if (dnIv) {
                                            onSetSubDividerPlacement(safeBayIdx, sd.id, {
                                              elevationY: dnIv.botY,
                                              height: dnIv.height,
                                              targetMidY: Math.round((dnIv.botY + dnIv.topY) / 2),
                                            });
                                          }
                                        }}
                                        title="Alt raf aralığına taşı"
                                        className="px-1.5 h-6 rounded-lg bg-white hover:bg-[#EFECE4] disabled:opacity-35 border border-[#DED8CC] font-bold text-[10px] cursor-pointer"
                                      >
                                        ⬇
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {activeBay.shelves.length === 0 &&
                      activeBay.drawers.length === 0 &&
                      activeBay.hangingRails.length === 0 &&
                      activeBay.specialFittings.length === 0 && (
                        <span className="text-[11px] text-[#78716C]">
                          Bu bölmede henüz iç eleman yok. Yukarıdan ekleyebilirsiniz.
                        </span>
                      )}
                  </div>
                </div>
              )}

              {/* Gömme İç LED Aydınlatma (İç Düzen) */}
              <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#141413] flex items-center gap-1.5">
                    <Lightbulb className="w-4 h-4 text-amber-500" />
                    <span>Gömme İç LED Aydınlatma</span>
                  </span>
                  <StudioToggleSwitch
                    testId="v11-toggle-led-lighting"
                    checked={Boolean(activeModule.carcass.ledLightingEnabled)}
                    onChange={(next) =>
                      onToggleModuleLed(next, {
                        colorTempK: activeModule.carcass.ledColorTempK || 3000,
                      })
                    }
                  />
                </div>

                <div className="space-y-2 pt-1">
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { k: 2700, label: "2700K Sıcak" },
                        { k: 3000, label: "3000K Doğal" },
                        { k: 4000, label: "4000K Gün" },
                      ] as const
                    ).map((temp) => {
                      const active =
                        Boolean(activeModule.carcass.ledLightingEnabled) &&
                        (activeModule.carcass.ledColorTempK || 3000) === temp.k;
                      return (
                        <button
                          key={temp.k}
                          type="button"
                          onClick={() => onToggleModuleLed(true, { colorTempK: temp.k })}
                          className={`py-1.5 rounded-xl text-[10.5px] font-semibold cursor-pointer ${
                            active
                              ? "bg-[#141413] text-white"
                              : "bg-[#F5F2EA] hover:bg-[#EAE3D5] text-[#44403C]"
                          }`}
                        >
                          {temp.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-[#F0ECE3]">
                    {(() => {
                      const activeMode = activeModule.carcass.ledPlacementMode;
                      const ledOn = Boolean(activeModule.carcass.ledLightingEnabled);
                      const hasTopShelf =
                        ledOn && (activeMode === "shelf_underside" || activeMode === "full_showcase");
                      const hasSideVert =
                        ledOn && (activeMode === "vertical_sides" || activeMode === "full_showcase");
                      const hasRod = ledOn && activeMode === "hanging_rod";
                      const cTemp = activeModule.carcass.ledColorTempK || 3000;

                      const toggleTopShelf = () => {
                        const nextTop = !hasTopShelf;
                        if (nextTop && hasSideVert) {
                          onToggleModuleLed(true, { ledType: "full_showcase", colorTempK: cTemp });
                        } else if (nextTop) {
                          onToggleModuleLed(true, { ledType: "led_profile", colorTempK: cTemp });
                        } else if (hasSideVert) {
                          onToggleModuleLed(true, { ledType: "led_vertical_strip", colorTempK: cTemp });
                        } else {
                          onToggleModuleLed(false);
                        }
                      };

                      const toggleSideVert = () => {
                        const nextSide = !hasSideVert;
                        if (hasTopShelf && nextSide) {
                          onToggleModuleLed(true, { ledType: "full_showcase", colorTempK: cTemp });
                        } else if (nextSide) {
                          onToggleModuleLed(true, { ledType: "led_vertical_strip", colorTempK: cTemp });
                        } else if (hasTopShelf) {
                          onToggleModuleLed(true, { ledType: "led_profile", colorTempK: cTemp });
                        } else {
                          onToggleModuleLed(false);
                        }
                      };

                      const items = [
                        { id: "led_profile", label: "Üst & Raf", isSel: hasTopShelf, onClick: toggleTopShelf },
                        { id: "led_vertical_strip", label: "Yan & Dikme", isSel: hasSideVert, onClick: toggleSideVert },
                        {
                          id: "led_rod_strip",
                          label: "Askı LED",
                          isSel: hasRod,
                          onClick: () =>
                            hasRod
                              ? onToggleModuleLed(false)
                              : onToggleModuleLed(true, { ledType: "led_rod_strip", colorTempK: cTemp }),
                        },
                        {
                          id: "full_showcase",
                          label: "Tam Vitrin",
                          isSel: hasTopShelf && hasSideVert,
                          onClick: () =>
                            onToggleModuleLed(true, { ledType: "full_showcase", colorTempK: cTemp }),
                        },
                      ];

                      return items.map((lt) => (
                        <button
                          key={lt.id}
                          type="button"
                          onClick={lt.onClick}
                          className={`py-1.5 px-2 rounded-xl text-[10.5px] font-semibold cursor-pointer flex items-center gap-2 text-left ${
                            lt.isSel
                              ? "bg-amber-600 text-white"
                              : "bg-[#F5F2EA] hover:bg-[#EAE3D5] text-[#44403C]"
                          }`}
                        >
                          {renderLedPlacementIcon(lt.id, lt.isSel)}
                          <span className="truncate">{lt.label}</span>
                        </button>
                      ));
                    })()}
                  </div>

                  {/* Sensör & CNC LED Kanal Ölçüleri (Genişlik, Derinlik, Önden Uzaklık) */}
                  <div className="space-y-2 pt-2 border-t border-[#F0ECE3]">
                    <div className="grid grid-cols-3 gap-1">
                      {(
                        [
                          { id: "ir_door", label: "Kapak Sensör" },
                          { id: "pir_motion", label: "Hareket PIR" },
                          { id: "manual_switch", label: "Anahtar" },
                        ] as const
                      ).map((sn) => {
                        const curSn = activeModule.carcass.ledSensorType || "ir_door";
                        return (
                          <button
                            key={sn.id}
                            type="button"
                            onClick={() => onToggleModuleLed(true, { sensorType: sn.id })}
                            className={`py-1 rounded-lg text-[10px] font-semibold cursor-pointer ${
                              curSn === sn.id
                                ? "bg-[#141413] text-white"
                                : "bg-[#F5F2EA] text-[#44403C]"
                            }`}
                          >
                            {sn.label}
                          </button>
                        );
                      })}
                    </div>

                    {!isSimple && (
                      <div className="space-y-2 pt-1">
                        <div className="grid grid-cols-3 gap-1.5">
                          <label className="space-y-0.5">
                            <span className="text-[9.5px] text-[#57534E] block">Genişlik (mm)</span>
                            <input
                              type="number"
                              min={6}
                              max={32}
                              step={1}
                              value={activeModule.carcass.ledChannelWidthMm ?? 12}
                              onChange={(e) =>
                                onToggleModuleLed(true, {
                                  channelWidthMm: Math.max(6, Math.min(32, Number(e.target.value) || 12)),
                                })
                              }
                              className="w-full h-9 px-2.5 rounded-xl bg-[#FAF8F4] border border-[#DED8CC] font-mono text-xs font-semibold text-center"
                            />
                          </label>
                          <label className="space-y-0.5">
                            <span className="text-[9.5px] text-[#57534E] block">Derinlik (mm)</span>
                            <input
                              type="number"
                              min={4}
                              max={15}
                              step={1}
                              value={activeModule.carcass.ledChannelDepthMm ?? 8}
                              onChange={(e) =>
                                onToggleModuleLed(true, {
                                  channelDepthMm: Math.max(4, Math.min(15, Number(e.target.value) || 8)),
                                })
                              }
                              className="w-full h-9 px-2.5 rounded-xl bg-[#FAF8F4] border border-[#DED8CC] font-mono text-xs font-semibold text-center"
                            />
                          </label>
                          <label className="space-y-0.5">
                            <span className="text-[9.5px] text-[#57534E] block">Önden (mm)</span>
                            <input
                              type="number"
                              min={25}
                              max={200}
                              step={5}
                              value={activeModule.carcass.ledFrontSetbackMm ?? 75}
                              onChange={(e) =>
                                onToggleModuleLed(true, {
                                  frontSetbackMm: Math.max(25, Math.min(200, Number(e.target.value) || 75)),
                                })
                              }
                              className="w-full h-9 px-2.5 rounded-xl bg-[#FAF8F4] border border-[#DED8CC] font-mono text-xs font-semibold text-center"
                            />
                          </label>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] text-[#57534E]">
                            Raf & Dikme LED Aynı Düzlemde
                          </span>
                          <StudioToggleSwitch
                            size="sm"
                            checked={activeModule.carcass.ledAlignShelfAndSide !== false}
                            onChange={(next) =>
                              onToggleModuleLed(true, { alignShelfAndSide: next })
                            }
                          />
                        </div>

                        {activeModule.carcass.ledAlignShelfAndSide === false && (
                          <label className="flex items-center justify-between gap-2">
                            <span className="text-[10px] text-[#57534E]">
                              Raf LED Önden Uzaklık (mm)
                            </span>
                            <input
                              type="number"
                              min={25}
                              max={200}
                              step={5}
                              value={activeModule.carcass.ledShelfSetbackMm ?? 75}
                              onChange={(e) =>
                                onToggleModuleLed(true, {
                                  shelfSetbackMm: Math.max(25, Math.min(200, Number(e.target.value) || 75)),
                                })
                              }
                              className="w-24 h-9 px-3 rounded-xl bg-[#FAF8F4] border border-[#DED8CC] font-mono text-xs font-semibold text-center"
                            />
                          </label>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
              )}
            </>
          )}

          {/* ==================== SEKME 3: KAPAK & DONANIM ==================== */}
          {activeTab === "doors" && (
            <>
              {(activeModule.isOpenFront || activeModule.bays.every((b) => !b.door || b.door.type === "open")) && (
                <div
                  data-testid="v11-open-cabinet-add-doors-card"
                  className="p-3.5 rounded-2xl bg-[#1D4ED8]/15 border border-[#3B82F6]/45 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-sky-200">
                      Açık Dolap Sistemi — Kapak Ekle
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-200 border border-sky-400/30">
                      Kapaksız
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Bu modül şu an açık sistem olarak yapılandırılmış. Tek tıkla tüm bölmelere veya sadece seçili bölmeye kapak ekleyebilirsiniz.
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      data-testid="v11-add-hinged-all-bays-btn"
                      onClick={() => {
                        const T = activeModule.carcass.panelThickness || 18;
                        const innerW = Math.max(300, activeModule.dimensions.width - 2 * T);
                        const avgBayW = innerW / Math.max(1, activeModule.bays.length);
                        activeModule.bays.forEach((b, idx) => {
                          const bw = b.customWidth ?? avgBayW;
                          const bestType =
                            bw > 560 ? "double" : idx % 2 === 0 ? "single_left" : "single_right";
                          onSetBayDoorType(idx, bestType);
                        });
                      }}
                      className="py-2 px-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[11px] font-bold transition cursor-pointer shadow-xs"
                    >
                      + Tümüne Menteşeli Kapak
                    </button>
                    <button
                      type="button"
                      data-testid="v11-add-sliding-doors-btn"
                      onClick={() => onSetBayDoorType(safeBayIdx, "sliding")}
                      className="py-2 px-2.5 rounded-xl bg-white/10 hover:bg-white/18 border border-white/18 text-white text-[11px] font-bold transition cursor-pointer"
                    >
                      + Sürgülü Kapak Ekle
                    </button>
                  </div>
                </div>
              )}
              <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#141413]">
                    {safeBayIdx + 1}. Bölme Kapak Açılışı
                  </span>
                  {activeModule.bays.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onCopyDoorToAllBays(safeBayIdx)}
                      className="px-2.5 py-1 rounded-full bg-[#F5F2EA] hover:bg-[#EAE3D5] text-[10.5px] font-semibold text-[#44403C] cursor-pointer"
                    >
                      Tüm Bölmelere Uygula
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  {(() => {
                    const zone = classifyCabinetPlacementZone(activeModule);
                    const canSlide =
                      curDoorType === "sliding" ||
                      (zone !== "kitchen_wall" &&
                        zone !== "kitchen_corner_wall" &&
                        zone !== "kitchen_corner_base" &&
                        zone !== "kitchen_sink_base" &&
                        zone !== "kitchen_appliance_base" &&
                        activeModule.dimensions.depth >= 450 &&
                        activeModule.dimensions.width >= 900 &&
                        activeModule.bays.length >= 2);
                    const isLCorner90 =
                      isKitchenCornerMod &&
                      !activeModule.templateId?.includes("blind") &&
                      !activeModule.templateId?.includes("diag");
                    const list: Array<{ id: typeof curDoorType; label: string }> = [
                      ...(isLCorner90 ? [{ id: "folding" as const, label: "90° Katlanır" }] : []),
                      { id: "double", label: "Çift" },
                      { id: "single_left", label: "Sol" },
                      { id: "single_right", label: "Sağ" },
                      ...(canSlide ? [{ id: "sliding" as const, label: "Sürgü" }] : []),
                      ...(!isKitchenCornerMod ? [{ id: "tambour" as const, label: "Tambur" }] : []),
                      { id: "open", label: "Açık" },
                    ];
                    return list;
                  })().map((dt) => {
                    const active = curDoorType === dt.id;
                    return (
                      <button
                        key={dt.id}
                        type="button"
                        onClick={() =>
                          dt.id === "folding"
                            ? onSetBayV4DoorConfig(safeBayIdx, { doorSystemId: "folding_side" })
                            : onSetBayDoorType(safeBayIdx, dt.id)
                        }
                        className={`py-2 px-1 rounded-xl text-[10.5px] font-semibold transition cursor-pointer flex flex-col items-center gap-1 ${
                          active
                            ? "bg-[#141413] text-white"
                            : "bg-[#F5F2EA] hover:bg-[#EAE3D5] text-[#44403C]"
                        }`}
                      >
                        <span className="scale-125 my-0.5">{renderDoorTypeIcon(dt.id)}</span>
                        <span className="text-[10px]">{dt.label}</span>
                      </button>
                    );
                  })}
                </div>

                {activeModule.category === "kitchen_wall" && !isKitchenCornerMod && (
                  <div className="pt-2 border-t border-[#F0ECE3] space-y-1.5">
                    <div className="text-[10.5px] font-semibold text-[#57534E]">
                      Üst Dolap Yukarı Kalkar Mekanizma (Blum AVENTOS)
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          { sys: "lift_up_stay", type: "lift_up_stay", label: "Tek Kalkar (HK)" },
                          { sys: "lift_bi_fold", type: "lift_bi_fold", label: "Katlanır (HF)" },
                          { sys: "lift_parallel", type: "lift_parallel", label: "Paralel (HL)" },
                        ] as const
                      ).map((lf) => {
                        const isLiftAct =
                          activeBay?.door?.doorSystemId === lf.sys || curDoorType === lf.type;
                        return (
                          <button
                            key={lf.sys}
                            type="button"
                            onClick={() =>
                              onSetBayV4DoorConfig(safeBayIdx, {
                                doorSystemId: lf.sys,
                              })
                            }
                            className={`py-1.5 px-1.5 rounded-xl text-[10.5px] font-semibold transition cursor-pointer ${
                              isLiftAct
                                ? "bg-[#141413] text-white"
                                : "bg-[#FAF8F4] hover:bg-[#EAE3D5] border border-[#E5DFD3] text-[#44403C]"
                            }`}
                          >
                            {lf.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {isKitchenCornerMod && activeModule.category !== "kitchen_wall" && (
                  <div className="pt-2 border-t border-[#F0ECE3] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10.5px] font-bold text-[#141413]">
                        Köşe Dolap İç Mekanizması
                      </span>
                      <span className="text-[9.5px] text-[#78716C]">Kapakla senkron 3B hareket</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(
                        [
                          { id: "corner_lemans", label: "LeMans II Fasulye", sub: "2×25kg Döner Tabla" },
                          { id: "magic_corner", label: "Magic Corner", sub: "Çift Kademe Çekme Sepet" },
                          { id: "carousel_half_moon", label: "270° Karusel", sub: "3/4 Döner Sepet" },
                          { id: "none_shelves", label: "Sabit Köşe Raf", sub: "Mekanizmasız L/Beşgen" },
                        ] as const
                      ).map((cm) => {
                        const curCornerFit = (activeBay?.specialFittings || []).find(
                          (f) =>
                            f.type === "corner_lemans" ||
                            f.type === "magic_corner" ||
                            f.type === "carousel_half_moon"
                        );
                        const isSel =
                          cm.id === "none_shelves" ? !curCornerFit : curCornerFit?.type === cm.id;
                        return (
                          <button
                            key={cm.id}
                            type="button"
                            onClick={() => {
                              const existingCornerFits = (activeBay?.specialFittings || []).filter(
                                (f) =>
                                  f.type === "corner_lemans" ||
                                  f.type === "magic_corner" ||
                                  f.type === "carousel_half_moon"
                              );
                              existingCornerFits.forEach((ef) =>
                                onRemoveSpecialFitting(safeBayIdx, ef.id)
                              );
                              if (cm.id !== "none_shelves") {
                                onAddSpecialFitting(safeBayIdx, cm.id);
                              }
                            }}
                            className={`p-2 rounded-xl border text-left transition cursor-pointer ${
                              isSel
                                ? "bg-[#141413] text-white border-[#141413]"
                                : "bg-[#FAF8F4] hover:bg-[#EFEAE0] border-[#E5DFD3] text-[#1C1917]"
                            }`}
                          >
                            <div className="text-[10.5px] font-bold leading-tight">{cm.label}</div>
                            <div
                              className={`text-[9px] mt-0.5 ${
                                isSel ? "text-stone-300" : "text-[#78716C]"
                              }`}
                            >
                              {cm.sub}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {curDoorType === "sliding" && (
                  <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-[#F0ECE3]">
                    {(
                      [
                        { id: "top_hung_pelmet", label: "Üstü Kapalı Ray" },
                        { id: "inset_inside", label: "İçten Raylı" },
                        { id: "top_hung_exposed", label: "Üstten Askılı" },
                        { id: "coplanar_flush", label: "Hemzemin Sürgü" },
                      ] as const
                    ).map((sm) => {
                      const curMount = activeBay?.door?.slidingMountingType || "top_hung_pelmet";
                      return (
                        <button
                          key={sm.id}
                          type="button"
                          onClick={() => onSetSlidingMountingType(sm.id)}
                          className={`py-1.5 px-2 rounded-xl text-[11px] font-semibold transition cursor-pointer ${
                            curMount === sm.id
                              ? "bg-[#141413] text-white"
                              : "bg-[#F5F2EA] text-[#44403C]"
                          }`}
                        >
                          {sm.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {customDoorOpen && (
                <CustomDoorSketchEditor
                  defaultTarget={curDoorType === "open" && activeBay.drawers.length > 0 ? "drawer" : "door"}
                  onCancel={() => setCustomDoorOpen(false)}
                  onSave={(created) => {
                    const nextList = [...customDoorProfiles, created];
                    setCustomDoorProfiles(nextList);
                    try {
                      window.localStorage.setItem(
                        "birim_custom_door_profiles_v1",
                        JSON.stringify(nextList)
                      );
                    } catch {}
                    setSelectedCustomDoorId(created.id);
                    if (created.target === "drawer") {
                      onUpdateCarcassConfig({
                        drawerFrontProfile: created.baseProfile,
                        customCadPolygon: created.customCadPolygon,
                        customCadProfileName: created.label,
                      });
                    } else {
                      applyDoorPatchAcrossScope(
                        {
                          crossSectionProfile: created.baseProfile,
                          customCadPolygon: created.customCadPolygon,
                          customCadProfileName: created.label,
                          isGlassFramed: Boolean(created.isGlass),
                        },
                        batchApplyDoorModelToModule,
                        batchApplyHandlesToAllModules
                      );
                    }
                    setCustomDoorOpen(false);
                  }}
                />
              )}

              {(curDoorType !== "open" || activeBay.drawers.length > 0) && (
                <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="inline-flex items-center p-0.5 rounded-full bg-black/35 border border-white/15">
                      {curDoorType !== "open" && (
                        <button
                          type="button"
                          onClick={() => setDoorFrontSubTab("door")}
                          className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold transition cursor-pointer ${
                            doorFrontSubTab === "door" || activeBay.drawers.length === 0
                              ? "bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] text-white"
                              : "text-slate-300 hover:text-white"
                          }`}
                        >
                          Kapak Modeli
                        </button>
                      )}
                      {activeBay.drawers.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setDoorFrontSubTab("drawer")}
                          className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold transition cursor-pointer ${
                            doorFrontSubTab === "drawer" || curDoorType === "open"
                              ? "bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] text-white"
                              : "text-slate-300 hover:text-white"
                          }`}
                        >
                          Çekmece Klapası
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {activeModule.bays.length > 1 && doorFrontSubTab === "door" && curDoorType !== "open" && (
                        <StudioToggleSwitch
                          size="sm"
                          label="Tümü"
                          checked={batchApplyDoorModelToModule}
                          onChange={setBatchApplyDoorModelToModule}
                          title="Açıkken seçtiğiniz kapak modeli bu dolaptaki tüm kapaklara uygulanır"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => setCustomDoorOpen(true)}
                        className="px-2 py-1 rounded-lg bg-[#F5F2EA] hover:bg-[#EAE3D5] text-[#141413] text-[10px] font-semibold cursor-pointer"
                      >
                        + Kesit
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {V11_DOOR_PROFILES.filter((pf) => {
                      const isDrawerMode = (doorFrontSubTab === "drawer" && activeBay.drawers.length > 0) || curDoorType === "open";
                      if (isDrawerMode) return pf.id !== "mirror_door" && pf.id !== "mirror_frameless";
                      return pf.id !== "u_glass_open_top";
                    }).map((pf) => {
                      const isDrawerMode = (doorFrontSubTab === "drawer" && activeBay.drawers.length > 0) || curDoorType === "open";
                      const curDrawerProf = activeModule.carcass.drawerFrontProfile || "flat_slab";
                      const active = isDrawerMode ? curDrawerProf === pf.id : !selectedCustomDoorId && curDoorProfile === pf.id;
                      return (
                        <button
                          key={`${isDrawerMode ? "dr" : "d"}_${pf.id}`}
                          type="button"
                          onClick={() => {
                            if (isDrawerMode) {
                              onUpdateCarcassConfig({ drawerFrontProfile: pf.id });
                            } else {
                              setSelectedCustomDoorId(null);
                              applyDoorPatchAcrossScope(
                                {
                                  crossSectionProfile: pf.id,
                                  isGlassFramed: Boolean(pf.isGlass),
                                },
                                batchApplyDoorModelToModule,
                                batchApplyHandlesToAllModules
                              );
                            }
                          }}
                          title={pf.label}
                          className={`p-1.5 rounded-2xl border text-center transition cursor-pointer flex flex-col items-stretch gap-1 overflow-hidden ${
                            active
                              ? "bg-[#141413] text-white border-[#38BDF8] ring-2 ring-[#38BDF8]/40"
                              : "bg-[#FAF8F4] hover:bg-[#F2EEE4] border-[#E5DFD3] text-[#141413]"
                          }`}
                        >
                          {renderPhotorealDoorProfileArt(pf.id)}
                          <div className="font-semibold text-[10px] leading-tight truncate px-0.5 pb-0.5">{pf.label.split(" (")[0]}</div>
                        </button>
                      );
                    })}
                    {customDoorProfiles.map((cp) => {
                      const active = selectedCustomDoorId === cp.id;
                      return (
                        <div key={cp.id} className="relative group">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCustomDoorId(cp.id);
                              applyDoorPatchAcrossScope(
                                {
                                  crossSectionProfile: cp.baseProfile,
                                  customCadPolygon: cp.customCadPolygon,
                                  customCadProfileName: cp.label,
                                  isGlassFramed: Boolean(cp.isGlass),
                                },
                                batchApplyDoorModelToModule,
                                batchApplyHandlesToAllModules
                              );
                            }}
                            className={`w-full p-2 rounded-2xl border text-left transition cursor-pointer flex items-center gap-2 ${
                              active
                                ? "bg-[#141413] text-white border-[#141413]"
                                : "bg-[#FAF8F4] hover:bg-[#F2EEE4] border-[#E5DFD3] text-[#141413]"
                            }`}
                          >
                            {cp.svgPaths && cp.svgPaths.length > 0 ? (
                              <svg width="24" height="24" viewBox="0 0 120 160" fill="none" className="shrink-0">
                                <rect x="4" y="4" width="112" height="152" rx="6" stroke="currentColor" strokeWidth="8" />
                                {cp.svgPaths.map((d, idx) => (
                                  <path key={idx} d={d} stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
                                ))}
                              </svg>
                            ) : (
                              renderDoorProfileIcon(cp.baseProfile)
                            )}
                            <div className="font-bold text-[11px] leading-tight truncate pr-3">
                              {cp.label}
                            </div>
                          </button>
                          <button
                            type="button"
                            title="Sil"
                            onClick={() => {
                              const nextList = customDoorProfiles.filter((x) => x.id !== cp.id);
                              setCustomDoorProfiles(nextList);
                              if (selectedCustomDoorId === cp.id) setSelectedCustomDoorId(null);
                              try {
                                window.localStorage.setItem(
                                  "birim_custom_door_profiles_v1",
                                  JSON.stringify(nextList)
                                );
                              } catch {}
                            }}
                            className="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/10 hover:bg-rose-600 hover:text-white text-[10px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#F0ECE3]">
                    <div>
                      <div className="text-[11px] font-semibold text-[#141413]">Frenli Yavaş Kapanır Menteşe</div>
                      <div className="text-[10px] text-[#78716C]">Blum CLIP top BLUMOTION entegre fren</div>
                    </div>
                    <StudioToggleSwitch
                      size="sm"
                      checked={activeBay?.door?.softClose !== false}
                      onChange={(next) =>
                        applyDoorPatchAcrossScope(
                          { softClose: next },
                          batchApplyDoorModelToModule,
                          batchApplyHandlesToAllModules
                        )
                      }
                    />
                  </div>
                </div>
              )}

              {(curDoorType !== "open" || hasExternalDrawersInActiveBay) && (
                <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-[#141413]">
                      {curDoorType === "open" && hasExternalDrawersInActiveBay
                        ? "Çekmece Kulp Stili & Toplu Uygulama"
                        : "Kulp Stili & Toplu Uygulama"}
                    </span>
                    <button
                      type="button"
                      onClick={onOpenCustomHardwareModal}
                      className="text-[11px] font-semibold text-[#8C7A6B] hover:text-[#141413] cursor-pointer"
                    >
                      + Özel Kulp
                    </button>
                  </div>

                  {/* Toplu Kulp Uygulama Toggle Switch Kontrolleri */}
                  <div className="p-2.5 rounded-xl bg-[#FAF8F4] border border-[#E6E1D6] space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[11px] font-semibold text-[#141413]">
                          Dolaptaki Tüm Kapaklara Uygula
                        </div>
                        <div className="text-[9.5px] text-[#78716C]">
                          Kapatırsanız yalnızca {safeBayIdx + 1}. bölme kapağı değişir
                        </div>
                      </div>
                      <StudioToggleSwitch
                        size="sm"
                        testId="v11-toggle-batch-handle-module"
                        checked={batchApplyHandlesToModule}
                        onChange={setBatchApplyHandlesToModule}
                      />
                    </div>

                    {mainModuleIndices.length > 1 && (
                      <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-[#ECE7DD]">
                        <div>
                          <div className="text-[11px] font-semibold text-[#141413]">
                            Sahnedeki Tüm Dolaplara Uygula ({mainModuleIndices.length} Modül)
                          </div>
                          <div className="text-[9.5px] text-[#78716C]">
                            Tüm modüllerdeki kapak kulplarını tek seferde eşitler
                          </div>
                        </div>
                        <StudioToggleSwitch
                          size="sm"
                          testId="v11-toggle-batch-handle-project"
                          checked={batchApplyHandlesToAllModules}
                          onChange={(next) => {
                            setBatchApplyHandlesToAllModules(next);
                            if (next) setBatchApplyHandlesToModule(true);
                          }}
                        />
                      </div>
                    )}

                    {(activeModule.bays.length > 1 || mainModuleIndices.length > 1) && (
                      <button
                        type="button"
                        data-testid="v11-sync-current-handle-all-btn"
                        onClick={() => {
                          const curDoor = activeBay?.door;
                          if (!curDoor) return;
                          applyDoorPatchAcrossScope(
                            {
                              handleProfileId: curDoor.handleProfileId || "K019",
                              handleCategory: curDoor.handleCategory,
                              handleMaterialId: curDoor.handleMaterialId,
                              handleLengthMm: curDoor.handleLengthMm,
                              handleOrientation: curDoor.handleOrientation,
                            },
                            true,
                            batchApplyHandlesToAllModules || mainModuleIndices.length > 1
                          );
                        }}
                        className="w-full py-1.5 px-2.5 rounded-lg bg-[#141413] hover:bg-[#292524] text-white text-[10.5px] font-semibold transition cursor-pointer"
                      >
                        ✓ Seçili Kapağın Kulbunu {mainModuleIndices.length > 1 ? "Tüm Dolaplara" : "Diğer Kapaklara"} Eşitle
                      </button>
                    )}
                  </div>

                  {/* Seçili Açma / Kulp Sisteminin Büyük Teknik Kesit Önizlemesi */}
                  {(() => {
                    const activeProfileId = activeBay?.door?.handleProfileId || "hnd_bar_160";
                    const activeHp =
                      handleProfiles.find((h) => h.id === activeProfileId || h.sku === activeProfileId) ||
                      handleProfiles[0];
                    if (!activeHp) return null;
                    const activeMeta = getHandleCrossSectionMeta(
                      activeHp.id,
                      String(activeHp.category),
                      activeHp.name
                    );
                    return (
                      <div
                        data-testid="v11-active-handle-cross-section"
                        className="p-2.5 rounded-xl bg-white border border-[#DFD3BC] flex items-center gap-3 shadow-2xs"
                      >
                        <div className="rounded-lg bg-[#FAF8F4] border border-[#EAE3D5] p-1 flex items-center justify-center">
                          <HandleCrossSectionSvg
                            profileId={activeHp.id}
                            category={String(activeHp.category)}
                            size="lg"
                          />
                        </div>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="text-[10px] font-bold uppercase tracking-wide text-[#8C6D46]">
                            Aktif Açma Kesiti
                          </div>
                          <div className="text-[11.5px] font-bold text-[#141413] leading-snug">
                            {activeMeta.shortTitle}
                          </div>
                          <div className="text-[10px] text-[#57534E] leading-snug">
                            {activeMeta.specLine}
                          </div>
                          <div className="text-[9.5px] text-[#78716C] leading-snug">
                            {activeMeta.surfaceNote}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Hızlı Kulp Grubu Filtresi: Çekme Kulplar kaybolmadan en üstte tek tıkla filtrelenir */}
                  <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#ECE7DD]/80">
                    {(
                      [
                        { id: "all", label: "Tümü" },
                        { id: "pull_handles", label: "Çekme Kulplar" },
                        { id: "gola_handleless", label: "Gola & Kulpsuz" },
                      ] as const
                    ).map((ft) => (
                      <button
                        key={ft.id}
                        type="button"
                        onClick={() => setHandleFilterTab(ft.id)}
                        className={`py-1.5 px-1.5 rounded-lg text-[10.5px] font-semibold transition cursor-pointer ${
                          handleFilterTab === ft.id
                            ? "bg-[#141413] text-white shadow-2xs"
                            : "text-[#57534E] hover:text-[#141413]"
                        }`}
                      >
                        {ft.label}
                      </button>
                    ))}
                  </div>

                  {(() => {
                    const cabZone = classifyCabinetPlacementZone(activeModule);
                    const zoneHint =
                      cabZone === "kitchen_wall" || cabZone === "kitchen_corner_wall"
                        ? "Üst Dolap Ergonomisi: Tezgâh altı L/C-Gola, dikey Gola ve 960 mm boy kulpları gizlendi; yalnızca alttan/yandan açılabilir uyumlu kulplar listelenir."
                        : cabZone === "kitchen_tall" || cabZone === "wardrobe"
                        ? "Boy Dolap & Gardırop Ergonomisi: Üst dolap Gola 268 ve tezgâh altı yatay L-Gola gizlendi; dikey Gola 1020 ve boy kulplar aktiftir."
                        : cabZone.startsWith("kitchen_")
                        ? "Alt Dolap Ergonomisi: Üst dolap Gola 268 ve 960 mm gardırop kulpu gizlendi; sahneye toplu uygulamada üst/boy dolaplar otomatik kendi Gola eşdeğerini alır."
                        : null;
                    return zoneHint ? (
                      <div className="px-2.5 py-1.5 rounded-xl bg-[#F5F2EA] border border-[#E5DFD3] text-[10px] text-[#57534E] leading-snug">
                        {zoneHint}
                      </div>
                    ) : null;
                  })()}

                  <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-0.5">
                    {handleProfiles
                      .filter((hp) => {
                        if (
                          !isHandleProfileCompatibleWithModuleBay(
                            hp.id,
                            hp.category,
                            activeModule,
                            safeBayIdx
                          )
                        ) {
                          return false;
                        }
                        if (handleFilterTab === "pull_handles") {
                          return (
                            hp.category !== "gola_profile" &&
                            hp.category !== "j_pull" &&
                            hp.category !== "handleless_plain"
                          );
                        }
                        if (handleFilterTab === "gola_handleless") {
                          return (
                            hp.category === "gola_profile" ||
                            hp.category === "j_pull" ||
                            hp.category === "handleless_plain"
                          );
                        }
                        return true;
                      })
                      .map((hp) => {
                      const active =
                        (activeBay?.door?.handleProfileId || "K019") === hp.id ||
                        (activeBay?.door?.handleProfileId || "") === hp.sku;
                      const rawMeta = getHandleCrossSectionMeta(hp.id, String(hp.category), hp.name);
                      const isUpperWallZone =
                        activeModule.category === "kitchen_wall" ||
                        activeModule.moduleFamilyId === "fam_kitchen_wall" ||
                        (activeModule.position?.y ?? 0) >= 1100;
                      const meta =
                        isUpperWallZone && hp.id === "hnd_j_pull"
                          ? {
                              ...rawMeta,
                              shortTitle: "Alt Kenar CNC J-Kulp (Üst Dolap)",
                              surfaceNote: "Üst dolap kapağının ALT kenarına CNC J-oyuk açılır; alttan tutularak açılır",
                            }
                          : isUpperWallZone && hp.id === "hnd_edge_profile"
                          ? {
                              ...rawMeta,
                              shortTitle: "Alt Kenar Geçme Alüminyum Kulp",
                              surfaceNote: "Üst dolap kapağının alt cumbasına geçme alüminyum tutamak",
                            }
                          : rawMeta;
                      return (
                        <button
                          key={hp.id}
                          type="button"
                          onClick={() =>
                            applyDoorPatchAcrossScope(
                              {
                                handleProfileId: hp.id,
                                handleCategory: hp.category,
                                crossSectionProfile:
                                  hp.category === "j_pull"
                                    ? "j_pull_bevel"
                                    : hp.id === "hnd_bevel_30_backing"
                                    ? "bevel_45"
                                    : "flat_slab",
                                openingTechnology:
                                  hp.category === "handleless_plain" ? "push_to_open" : "soft_close",
                                handleType:
                                  hp.category === "handleless_plain"
                                    ? "push_to_open"
                                    : hp.category === "gola_profile" || hp.category === "j_pull"
                                    ? "none"
                                    : hp.category === "recessed_grip"
                                    ? "recessed"
                                    : "bar",
                              },
                              batchApplyHandlesToModule,
                              batchApplyHandlesToAllModules
                            )
                          }
                          className={`w-full p-2 rounded-xl border flex items-center gap-2.5 text-left transition cursor-pointer ${
                            active
                              ? "bg-[#141413] text-white border-[#141413]"
                              : "bg-[#F8F5EE] hover:bg-[#EFEAE0] border-[#E5DFD3] text-[#1C1917]"
                          }`}
                        >
                          <div
                            className={`rounded-lg p-1 border shrink-0 ${
                              active
                                ? "bg-[#1F1E1C] border-white/15"
                                : "bg-white border-[#E5DFD3]"
                            }`}
                          >
                            <HandleCrossSectionSvg
                              profileId={hp.id}
                              category={String(hp.category)}
                              active={active}
                              size="sm"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-bold leading-snug">
                              {meta.shortTitle}
                            </div>
                            <div
                              className={`text-[9.5px] leading-snug mt-0.5 ${
                                active ? "text-stone-300" : "text-[#57534E]"
                              }`}
                            >
                              {meta.specLine}
                            </div>
                            <div
                              className={`text-[9px] leading-snug ${
                                active ? "text-stone-400" : "text-[#78716C]"
                              }`}
                            >
                              {meta.surfaceNote}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Kulp Metal Rengi / Yüzeyi */}
                  <div className="pt-2 border-t border-[#F0ECE3] space-y-1.5">
                    <div className="text-[10.5px] font-semibold text-[#57534E]">Kulp Rengi / Metal Yüzeyi</div>
                    <div className="grid grid-cols-4 gap-1">
                      {[
                        { id: "mat_handle_matte_black", label: "Mat Siyah", hex: "#1e293b" },
                        { id: "mat_handle_inox", label: "Inox", hex: "#cbd5e1" },
                        { id: "mat_handle_brass", label: "Pirinç", hex: "#d4af37" },
                        { id: "mat_handle_anthracite", label: "Antrasit", hex: "#374151" },
                      ].map((hm) => {
                        const curHm = activeBay?.door?.handleMaterialId || "mat_handle_matte_black";
                        const active = curHm === hm.id;
                        return (
                          <button
                            key={hm.id}
                            type="button"
                            onClick={() =>
                              applyDoorPatchAcrossScope(
                                { handleMaterialId: hm.id },
                                batchApplyHandlesToModule,
                                batchApplyHandlesToAllModules
                              )
                            }
                            className={`py-1.5 px-1.5 rounded-xl border text-[10px] font-semibold flex items-center justify-center gap-1 transition cursor-pointer ${
                              active
                                ? "bg-[#141413] text-white border-[#141413]"
                                : "bg-[#FAF8F4] hover:bg-[#F2EEE4] text-[#44403C] border-[#E5DFD3]"
                            }`}
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full border border-black/20 shrink-0"
                              style={{ backgroundColor: hm.hex }}
                            />
                            <span className="truncate">{hm.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {!isSimple && (
                <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] space-y-3">
                  <div className="font-bold text-[#141413]">
                    Ön Kör Klapa ve Montaj Tıraş Payı
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-1">
                      <span className="text-[10.5px] text-[#57534E]">Sol Kör Klapa (mm)</span>
                      <input
                        type="number"
                        min={0}
                        max={250}
                        step={5}
                        value={activeBay?.door?.frontFillerLeftMm || 0}
                        onChange={(e) => {
                          const v = Math.max(0, Number(e.target.value) || 0);
                          const pos = activeBay?.door?.frontFillerPosition || "coplanar_front";
                          onSetBayV4DoorConfig(safeBayIdx, {
                            frontFillerLeftMm: v,
                            frontFillerPosition: pos,
                            hardwareProductId:
                              v > 0 && pos === "coplanar_front"
                                ? "hw_blum_79b9458"
                                : "hw_blum_71b3550",
                          });
                        }}
                        className="w-full h-8 px-2.5 rounded-xl bg-[#FAF8F4] border border-[#DED8CC] font-mono text-xs"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[10.5px] text-[#57534E]">Sağ Kör Klapa (mm)</span>
                      <input
                        type="number"
                        min={0}
                        max={250}
                        step={5}
                        value={activeBay?.door?.frontFillerRightMm || 0}
                        onChange={(e) => {
                          const v = Math.max(0, Number(e.target.value) || 0);
                          const pos = activeBay?.door?.frontFillerPosition || "coplanar_front";
                          onSetBayV4DoorConfig(safeBayIdx, {
                            frontFillerRightMm: v,
                            frontFillerPosition: pos,
                          });
                        }}
                        className="w-full h-8 px-2.5 rounded-xl bg-[#FAF8F4] border border-[#DED8CC] font-mono text-xs"
                      />
                    </label>
                  </div>

                  {((activeBay?.door?.frontFillerLeftMm || 0) > 0 ||
                    (activeBay?.door?.frontFillerRightMm || 0) > 0) && (
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          onSetBayV4DoorConfig(safeBayIdx, {
                            frontFillerPosition: "coplanar_front",
                            hardwareProductId: "hw_blum_79b9458",
                          })
                        }
                        className={`py-1.5 px-2 rounded-xl text-[10.5px] font-semibold cursor-pointer ${
                          (activeBay?.door?.frontFillerPosition || "coplanar_front") ===
                          "coplanar_front"
                            ? "bg-[#141413] text-white"
                            : "bg-[#F5F2EA] text-[#44403C]"
                        }`}
                      >
                        Eş-Düzlem (95° Menteşe)
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onSetBayV4DoorConfig(safeBayIdx, {
                            frontFillerPosition: "recessed_inner",
                            hardwareProductId: "hw_blum_71b3550",
                          })
                        }
                        className={`py-1.5 px-2 rounded-xl text-[10.5px] font-semibold cursor-pointer ${
                          activeBay?.door?.frontFillerPosition === "recessed_inner"
                            ? "bg-[#141413] text-white"
                            : "bg-[#F5F2EA] text-[#44403C]"
                        }`}
                      >
                        İçerlek (110° Menteşe)
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#F0ECE3]">
                    <label className="space-y-1">
                      <span className="text-[10.5px] text-[#57534E]">Sol Duvar Tıraş Payı (mm)</span>
                      <input
                        type="number"
                        min={0}
                        max={80}
                        step={5}
                        value={activeModule.carcass.scribeAllowanceLeftMm || 0}
                        onChange={(e) =>
                          onUpdateCarcassConfig({
                            scribeAllowanceLeftMm: Math.max(0, Number(e.target.value) || 0),
                          })
                        }
                        className="w-full h-8 px-2.5 rounded-xl bg-[#FAF8F4] border border-[#DED8CC] font-mono text-xs"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[10.5px] text-[#57534E]">Sağ Duvar Tıraş Payı (mm)</span>
                      <input
                        type="number"
                        min={0}
                        max={80}
                        step={5}
                        value={activeModule.carcass.scribeAllowanceRightMm || 0}
                        onChange={(e) =>
                          onUpdateCarcassConfig({
                            scribeAllowanceRightMm: Math.max(0, Number(e.target.value) || 0),
                          })
                        }
                        className="w-full h-8 px-2.5 rounded-xl bg-[#FAF8F4] border border-[#DED8CC] font-mono text-xs"
                      />
                    </label>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ==================== SEKME 4: YÜZEY, ÖZEL RENK & I�?IK ==================== */}
          {activeTab === "materials" && (
            <>
              <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] space-y-3">
                <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#ECE7DD]/80">
                  {(
                    [
                      { id: "doors", label: "Kapaklar" },
                      { id: "carcass", label: "İç Gövde" },
                      { id: "all_module", label: "Tüm Dolap" },
                    ] as const
                  ).map((sc) => (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => setMaterialTarget(sc.id)}
                      className={`py-1.5 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                        materialTarget === sc.id
                          ? "bg-[#141413] text-white"
                          : "text-[#57534E] hover:text-[#141413]"
                      }`}
                    >
                      {sc.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-2 pt-1.5 border-t border-[#F0ECE3]">
                  <div>
                    <div className="font-semibold text-[#141413] text-[11.5px]">
                      Görünen Yanlar Kapak Rengi Olsun
                    </div>
                    <div className="text-[10px] text-[#78716C]">
                      Ek panel eklemeden yan dikmeleri kapak malzemesiyle üretir
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 pt-0.5">
                    <StudioToggleSwitch
                      size="sm"
                      label="Sol Yan Dikme"
                      checked={Boolean(activeModule.carcass.exposedLeftSideUseDoorMaterial)}
                      onChange={(next) =>
                        onUpdateCarcassConfig({ exposedLeftSideUseDoorMaterial: next })
                      }
                    />
                    <StudioToggleSwitch
                      size="sm"
                      label="Sağ Yan Dikme"
                      checked={Boolean(activeModule.carcass.exposedRightSideUseDoorMaterial)}
                      onChange={(next) =>
                        onUpdateCarcassConfig({ exposedRightSideUseDoorMaterial: next })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-1 flex-wrap">
                  <div className="flex flex-wrap gap-1">
                    {V11_MATERIAL_GROUPS.map((mg) => (
                      <button
                        key={mg.id}
                        type="button"
                        onClick={() => setMaterialGroup(mg.id)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition cursor-pointer ${
                          materialGroup === mg.id
                            ? "bg-[#141413] text-white"
                            : "bg-white border border-[#E5DFD3] text-[#57534E]"
                        }`}
                      >
                        {mg.label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setCustomMatOpen((v) => !v)}
                    className="text-[11px] font-semibold text-[#8C7A6B] hover:text-[#141413] cursor-pointer"
                  >
                    + Özel Renk
                  </button>
                </div>

                {/* Hızlı Marka / Dekor Kodu Arama */}
                <div className="relative">
                  <input
                    type="text"
                    value={materialSearch}
                    onChange={(e) => setMaterialSearch(e.target.value)}
                    placeholder={`Ara (${visibleMaterials.length} kartela): Kaşmir, Meşe, AGT, Kastamonu, Yıldız, Egger...`}
                    className="w-full h-8 px-3 pr-7 rounded-xl bg-white border border-[#DED8CC] text-[11px] text-[#141413] placeholder:text-[#A8A29E] focus:outline-none focus:border-[#141413]"
                  />
                  {materialSearch && (
                    <button
                      type="button"
                      onClick={() => setMaterialSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-[#78716C] hover:text-[#141413] cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {customMatOpen && (
                  <div className="p-3 rounded-2xl bg-white border border-[#DED8CC] space-y-2">
                    <div className="font-bold text-[11.5px]">Özel RAL / MDFLam Kartela Rengi Ekle</div>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={newMatHex}
                        onChange={(e) => setNewMatHex(e.target.value)}
                        className="w-9 h-9 rounded-lg border border-[#DED8CC] cursor-pointer shrink-0"
                      />
                      <input
                        type="text"
                        value={newMatName}
                        onChange={(e) => setNewMatName(e.target.value)}
                        placeholder="Örn: Kastamonu D218 Kaşmir / RAL 7044"
                        className="flex-1 h-9 px-2.5 rounded-xl bg-[#FAF8F4] border border-[#DED8CC] text-xs"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex gap-1 flex-wrap">
                        {(
                          [
                            { id: "laminate", label: "MDFLam" },
                            { id: "lacquer", label: "Supramat/Lake" },
                            { id: "wood", label: "Ahşap" },
                            { id: "stone", label: "Taş" },
                          ] as const
                        ).map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setNewMatCat(c.id);
                              if (c.id === "wood") setNewMatGrain(true);
                            }}
                            className={`px-2 py-1 rounded-lg text-[10.5px] font-semibold cursor-pointer ${
                              newMatCat === c.id
                                ? "bg-[#141413] text-white"
                                : "bg-[#F5F2EA] text-[#44403C]"
                            }`}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                      <StudioToggleSwitch
                        size="sm"
                        label="Damarlı"
                        checked={newMatGrain || newMatCat === "wood"}
                        onChange={setNewMatGrain}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!newMatName.trim()) return;
                        onAddCustomMaterial({
                          name: newMatName.trim(),
                          category: newMatCat,
                          colorHex: newMatHex,
                          roughness: newMatCat === "lacquer" ? 0.28 : 0.5,
                          costPerM2: newMatCat === "laminate" ? 30 : 48,
                          hasGrain: newMatGrain || newMatCat === "wood",
                        });
                        setNewMatName("");
                        setCustomMatOpen(false);
                      }}
                      className="w-full py-1.5 rounded-full bg-[#141413] text-white text-[11px] font-semibold cursor-pointer"
                    >
                      Kartelaya Ekle
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                  {visibleMaterials.map((mat) => {
                    const isSelected = activeMatId === mat.id;
                    return (
                      <button
                        key={mat.id}
                        type="button"
                        draggable={false}
                        onPointerDown={(e) =>
                          startLiveMaterialDrag(e, mat, () =>
                            onApplyMaterialScope(materialTarget, mat.id)
                          )
                        }
                        onKeyDown={(ke) => {
                          if (ke.key === "Enter" || ke.key === " ") {
                            ke.preventDefault();
                            onApplyMaterialScope(materialTarget, mat.id);
                          }
                        }}
                        title={`${mat.name} — Tıkla veya sürükleyip objeye bırak`}
                        className={`p-2 rounded-2xl border text-left transition cursor-grab active:cursor-grabbing flex flex-col justify-between ${
                          isSelected
                            ? "bg-white border-[#141413] ring-2 ring-[#141413]/15"
                            : "bg-white/85 hover:bg-white border-[#E5DFD3]"
                        }`}
                      >
                        <div>
                          <div
                            className="w-full h-[70px] rounded-xl border border-white/20 relative mb-1.5 shadow-inner overflow-hidden"
                            style={{
                              backgroundColor: mat.colorHex,
                              backgroundImage: mat.hasGrain
                                ? "repeating-linear-gradient(90deg, rgba(255,255,255,0.09) 0px, rgba(0,0,0,0.08) 3px, transparent 8px)"
                                : (mat.roughness ?? 0.45) <= 0.14
                                ? "linear-gradient(135deg, rgba(255,255,255,0.42) 0%, transparent 48%, rgba(0,0,0,0.08) 100%)"
                                : undefined,
                            }}
                          >
                            {mat.decorCode && (
                              <span className="absolute bottom-1 left-1 px-1.5 py-0.2 rounded bg-black/55 backdrop-blur-xs text-white font-mono text-[8.5px] font-bold">
                                {mat.decorCode}
                              </span>
                            )}
                            {isSelected && (
                              <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#141413] text-white flex items-center justify-center">
                                <Check className="w-2.5 h-2.5" />
                              </span>
                            )}
                          </div>
                          <div className="text-[10.5px] font-semibold text-[#141413] leading-tight line-clamp-2">
                            {mat.name}
                          </div>
                        </div>
                        {mat.brand && (
                          <div className="text-[9px] text-[#78716C] font-medium truncate mt-1">
                            {mat.brand}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </aside>
      </>
    );
  }
);

RightParametricInspector.displayName = "RightParametricInspector";
