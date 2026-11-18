"use client";

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
  resolveMultiHoleSpec,
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
    <svg
      viewBox="0 0 40 48"
      className="w-8 h-10 text-[#57534E] shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="4" y="3" width="32" height="42" rx="3" />
      {kind === "double_hang" && (
        <>
          <line x1="6" y1="11" x2="34" y2="11" />
          <line x1="6" y1="26" x2="34" y2="26" />
          <path d="M15 11v8M25 11v8M15 26v8M25 26v8" strokeOpacity="0.55" />
        </>
      )}
      {kind === "shelves" && (
        <>
          <line x1="5" y1="12" x2="35" y2="12" />
          <line x1="5" y1="20" x2="35" y2="20" />
          <line x1="5" y1="28" x2="35" y2="28" />
          <line x1="5" y1="36" x2="35" y2="36" />
        </>
      )}
      {kind === "hang_drawers" && (
        <>
          <line x1="6" y1="11" x2="34" y2="11" />
          <line x1="5" y1="27" x2="35" y2="27" />
          <line x1="5" y1="33" x2="35" y2="33" />
          <line x1="5" y1="39" x2="35" y2="39" />
        </>
      )}
      {kind === "combo" && (
        <>
          <line x1="5" y1="11" x2="35" y2="11" />
          <line x1="6" y1="17" x2="34" y2="17" strokeDasharray="2 2" />
          <line x1="5" y1="31" x2="35" y2="31" />
          <line x1="5" y1="38" x2="35" y2="38" />
        </>
      )}
    </svg>
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
  | "jewelry_tray";

function renderInteriorItemSvg(kind: InteriorVisualKind) {
  return (
    <svg viewBox="0 0 44 30" className="w-9 h-6 shrink-0 pointer-events-none" fill="none">
      {kind === "shelf" && (
        <>
          <polygon points="4,15 15,8 40,11 29,18" fill="#E6D5B8" stroke="#8C6D46" strokeWidth="1.35" />
          <polygon points="4,15 29,18 29,21.5 4,18.5" fill="#C8AD82" stroke="#8C6D46" strokeWidth="1.35" />
          <circle cx="8" cy="21" r="1.4" fill="#64748B" />
          <circle cx="25" cy="23" r="1.4" fill="#64748B" />
        </>
      )}
      {kind === "fixed_shelf" && (
        <>
          <polygon points="4,14 15,7 40,10 29,17" fill="#DEC8A4" stroke="#5C4428" strokeWidth="1.45" />
          <polygon points="4,14 29,17 29,22 4,19" fill="#B59669" stroke="#5C4428" strokeWidth="1.45" />
          <circle cx="10" cy="18.2" r="1.8" fill="#141413" />
          <circle cx="24" cy="19.8" r="1.8" fill="#141413" />
        </>
      )}
      {kind === "drawer" && (
        <>
          <polygon points="6,10 15,5 37,8 28,13" fill="#EFE8DC" stroke="#785A37" strokeWidth="1.2" />
          <polygon points="6,10 28,13 28,24 6,21" fill="#E5D3B3" stroke="#785A37" strokeWidth="1.35" />
          <polygon points="28,13 37,8 37,19 28,24" fill="#C8AD82" stroke="#785A37" strokeWidth="1.2" />
          <line x1="13" y1="16" x2="21" y2="17.2" stroke="#141413" strokeWidth="2.1" strokeLinecap="round" />
        </>
      )}
      {kind === "internal_drawer" && (
        <>
          <polygon points="6,11 15,6 37,9 28,14" fill="#F3EFE6" stroke="#64748B" strokeWidth="1.2" />
          <path d="M6,11 L13,12 C14.5,14.5 19.5,15 21,13 L28,14 L28,23 L6,20 Z" fill="#DFD7C8" stroke="#475569" strokeWidth="1.35" />
          <polygon points="28,14 37,9 37,18 28,23" fill="#C7BFB0" stroke="#475569" strokeWidth="1.2" />
        </>
      )}
      {kind === "rail" && (
        <>
          <line x1="5" y1="8" x2="39" y2="8" stroke="#64748B" strokeWidth="3" strokeLinecap="round" />
          <path d="M22,8 C22,10.5 20,11 20,12.5" stroke="#475569" strokeWidth="1.3" />
          <polygon points="22,12.5 12,23 32,23" fill="#E6D5B8" stroke="#8C6D46" strokeWidth="1.3" />
        </>
      )}
      {kind === "trouser_rack" && (
        <>
          <polygon points="6,9 15,4 38,7 29,12" fill="none" stroke="#475569" strokeWidth="1.45" />
          <rect x="12" y="10" width="5.5" height="14" rx="1" fill="#D6C7B2" stroke="#44403C" strokeWidth="1.1" />
          <rect x="20" y="11" width="5.5" height="14" rx="1" fill="#E8E1D5" stroke="#44403C" strokeWidth="1.1" />
          <rect x="28" y="12" width="5" height="13" rx="1" fill="#CFC4B4" stroke="#44403C" strokeWidth="1.1" />
        </>
      )}
      {kind === "shoe_rack" && (
        <>
          <line x1="6" y1="15" x2="38" y2="11" stroke="#64748B" strokeWidth="2" strokeLinecap="round" />
          <line x1="6" y1="23" x2="38" y2="19" stroke="#64748B" strokeWidth="2" strokeLinecap="round" />
          <ellipse cx="16" cy="11.5" rx="4.5" ry="2.3" fill="#C8AD82" stroke="#5C4428" strokeWidth="1.1" />
          <ellipse cx="27" cy="10.2" rx="4.5" ry="2.3" fill="#C8AD82" stroke="#5C4428" strokeWidth="1.1" />
        </>
      )}
      {kind === "sub_divider" && (
        <>
          <rect x="6" y="4" width="32" height="3.2" rx="0.8" fill="#DFD8C8" stroke="#57534E" strokeWidth="1.1" />
          <rect x="6" y="22.8" width="32" height="3.2" rx="0.8" fill="#DFD8C8" stroke="#57534E" strokeWidth="1.1" />
          <rect x="20" y="7.2" width="4.5" height="15.6" fill="#C8AD82" stroke="#5C4428" strokeWidth="1.35" />
        </>
      )}
      {kind === "jewelry_tray" && (
        <>
          <polygon points="5,13 15,6 39,9 29,16" fill="#EFEAE0" stroke="#785A37" strokeWidth="1.3" />
          <line x1="13" y1="14" x2="23" y2="7" stroke="#8C7A6B" strokeWidth="1.1" />
          <line x1="21" y1="15" x2="31" y2="8" stroke="#8C7A6B" strokeWidth="1.1" />
          <line x1="10" y1="9.5" x2="34" y2="12.5" stroke="#8C7A6B" strokeWidth="1.1" />
          <polygon points="5,13 29,16 29,20 5,17" fill="#C8AD82" stroke="#785A37" strokeWidth="1.3" />
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

  const onCancel = () => {
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
      className="inline-flex items-center gap-1.5 shrink-0 select-none cursor-pointer group"
    >
      {label && (
        <span className="text-[10.5px] font-semibold text-[#44403C] group-hover:text-[#141413]">
          {label}
        </span>
      )}
      <span
        className={`relative inline-flex items-center rounded-full border transition-colors duration-200 ${
          isSm ? "w-8 h-[18px] p-[1.5px]" : "w-10 h-[22px] p-[2px]"
        } ${
          checked
            ? "bg-[#141413] border-[#141413]"
            : "bg-[#E2DDD2] border-[#D3CCC0] group-hover:bg-[#D6D0C3]"
        }`}
      >
        <span
          className={`rounded-full bg-white shadow-xs transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
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
    const [batchApplyHandlesToAllModules, setBatchApplyHandlesToAllModules] = useState(false);
    const [batchApplyDoorModelToModule, setBatchApplyDoorModelToModule] = useState(true);
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
            if (b.door?.type !== "open") {
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
          if (b.door?.type !== "open") {
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
          className={`fixed right-4 top-1/2 -translate-y-1/2 z-30 py-3.5 px-2.5 rounded-full bg-[#FAF8F4]/94 backdrop-blur-xl border border-[#DFD9CE] shadow-[0_10px_30px_rgba(20,20,19,0.1)] text-xs font-semibold text-[#141413] flex flex-col items-center gap-2 hover:bg-white cursor-pointer origin-right transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isOpen
              ? "opacity-0 scale-90 translate-x-4 pointer-events-none"
              : "opacity-100 scale-100 translate-x-0 pointer-events-auto"
          }`}
        >
          <ChevronLeft className="w-4 h-4 text-[#57534E]" />
          <SlidersHorizontal className="w-4 h-4 text-[#8C7A6B]" />
          <span className="[writing-mode:vertical-rl] rotate-180 text-[11px] font-bold tracking-wide py-0.5">
            Özellikler
          </span>
        </button>

        <aside
          aria-label="Modül Parametreleri"
          aria-hidden={!isOpen}
          data-testid="v11-right-inspector"
          className={`fixed right-4 top-[78px] bottom-[84px] w-[412px] max-w-[calc(100vw-32px)] z-30 rounded-3xl bg-[#FAF8F4]/94 backdrop-blur-2xl border border-[#DFD9CE] shadow-[0_24px_60px_rgba(20,20,19,0.12)] flex flex-col overflow-hidden text-[#141413] origin-right transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isOpen
              ? "opacity-100 scale-100 translate-x-0 pointer-events-auto"
              : "opacity-0 scale-95 translate-x-6 pointer-events-none"
          }`}
        >
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

              {moduleMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-56 rounded-2xl bg-white border border-[#DFD9CE] shadow-xl p-1.5 z-50 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setModuleMenuOpen(false);
                      onDuplicateActiveModule();
                    }}
                    className="w-full px-3 py-2 rounded-xl hover:bg-[#F5F2EA] flex items-center gap-2 text-left font-medium cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5 text-[#57534E]" />
                    <span>Yanına Kopyala</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModuleMenuOpen(false);
                      onAddStackedTopModule();
                    }}
                    className="w-full px-3 py-2 rounded-xl hover:bg-[#F5F2EA] flex items-center gap-2 text-left font-medium cursor-pointer"
                  >
                    <ArrowUpFromLine className="w-3.5 h-3.5 text-[#57534E]" />
                    <span>Üst Yüklük Modülü Ekle</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModuleMenuOpen(false);
                      onRotateActiveModule90();
                    }}
                    className="w-full px-3 py-2 rounded-xl hover:bg-[#F5F2EA] flex items-center gap-2 text-left font-medium cursor-pointer"
                  >
                    <RotateCw className="w-3.5 h-3.5 text-[#57534E]" />
                    <span>90° Döndür</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModuleMenuOpen(false);
                      onOpenCutoutModal();
                    }}
                    className="w-full px-3 py-2 rounded-xl hover:bg-[#F5F2EA] flex items-center gap-2 text-left font-medium cursor-pointer"
                  >
                    <Scissors className="w-3.5 h-3.5 text-[#57534E]" />
                    <span>Panel Kertme & Priz Kesimi</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModuleMenuOpen(false);
                      onSaveModuleAsTemplate(`${activeModule.name} (Özel)`);
                    }}
                    className="w-full px-3 py-2 rounded-xl hover:bg-[#F5F2EA] flex items-center gap-2 text-left font-medium cursor-pointer"
                  >
                    <BookmarkPlus className="w-3.5 h-3.5 text-[#57534E]" />
                    <span>Özel �?ablon Olarak Kaydet</span>
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
                </div>
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
                          ? "bg-white text-[#141413] shadow-2xs border border-[#DFD9CE]"
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

          <div className="grid grid-cols-4 gap-1 p-1 rounded-2xl bg-[#ECE7DD]/85 border border-[#DFD9CE]">
            {(
              [
                { id: "dimensions", label: "Boyut" },
                { id: "interior", label: "İç Düzen" },
                { id: "doors", label: "Kapak" },
                { id: "materials", label: "Yüzey" },
              ] as const
            ).map((tb) => {
              const active = activeTab === tb.id;
              return (
                <button
                  key={tb.id}
                  type="button"
                  data-testid={`v11-tab-${tb.id}`}
                  onClick={() => onChangeTab(tb.id)}
                  className={`py-2 px-1 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    active
                      ? "bg-[#141413] text-white shadow-2xs"
                      : "text-[#57534E] hover:text-[#141413]"
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
                        unitMode === u ? "bg-white text-[#141413] shadow-2xs" : "text-[#57534E]"
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


              {/* Gövde Yan Dikme, Baza Tipi, Çoklu Delik & Karkas Yapısı */}
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

          {/* ==================== SEKME 2: İÇ DÜZEN ==================== */}
          {activeTab === "interior" && (
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

                <div className="flex flex-wrap gap-1.5">
                  {activeModule.bays.map((b, idx) => {
                    const isSel = idx === safeBayIdx;
                    const clearCm = Math.round((bayClearWidths[idx] || 600) / 10);
                    return (
                      <button
                        key={b.index}
                        type="button"
                        onClick={() => onSelectBayIndex(idx)}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                          isSel
                            ? "bg-[#141413] text-white shadow-2xs"
                            : "bg-[#F5F2EA] hover:bg-[#EAE3D5] text-[#44403C]"
                        }`}
                      >
                        <span>{idx + 1}. Bölme</span>
                        <span
                          className={`font-mono text-[10px] ${
                            isSel ? "text-[#D6C7B2]" : "text-[#78716C]"
                          }`}
                        >
                          {unitMode === "cm" ? `${clearCm} cm` : `${Math.round(bayClearWidths[idx] || 600)} mm`}
                        </span>
                      </button>
                    );
                  })}
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
                            <div className="font-bold text-[#141413] text-xs">{pr.title}</div>
                            <div className="text-[10.5px] text-[#78716C] leading-tight mt-0.5">
                              {pr.subtitle}
                            </div>
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
                  <span className="text-[11px] font-bold text-[#57534E]">+ İç Eleman Ekle</span>
                  <span className="text-[10px] text-[#8C7A6B]">Tıkla veya 3B dolaba sürükle</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    {
                      id: "lib_shelf",
                      label: "Hareketli Raf",
                      visual: "shelf" as const,
                      dragVisual: "shelf",
                      count:
                        activeBay?.shelves.filter(
                          (s) => !s.isHidden && s.isAdjustable !== false && !s.isFixed
                        ).length || 0,
                      onClick: () => onAddShelf(safeBayIdx),
                    },
                    {
                      id: "lib_fixed_shelf",
                      label: "Sabit Taşıyıcı Raf",
                      visual: "fixed_shelf" as const,
                      dragVisual: "shelf",
                      count:
                        activeBay?.shelves.filter(
                          (s) => !s.isHidden && (s.isAdjustable === false || Boolean(s.isFixed))
                        ).length || 0,
                      onClick: () => onAddFixedShelf(safeBayIdx),
                    },
                    ...(isSlidingBay
                      ? []
                      : [
                          {
                            id: "lib_drawer",
                            label: "Dış Çekmece",
                            visual: "drawer" as const,
                            dragVisual: "drawer",
                            count: activeBay?.drawers.filter((d) => !d.isInternal).length || 0,
                            onClick: () => onAddDrawer(safeBayIdx),
                          },
                        ]),
                    {
                      id: "lib_internal_drawer",
                      label: isSlidingBay ? "Sürgü İçi Çekmece" : "Gizli İç Çekmece",
                      visual: "internal_drawer" as const,
                      dragVisual: "internal_drawer",
                      count:
                        activeBay?.drawers.filter((d) => Boolean(d.isInternal) || isSlidingBay)
                          .length || 0,
                      onClick: () => onAddInternalDrawer(safeBayIdx),
                    },
                    {
                      id: "lib_rail",
                      label: "Elbise Askısı",
                      visual: "rail" as const,
                      dragVisual: "rail",
                      count: activeBay?.hangingRails.length || 0,
                      onClick: () => onAddHangingRail(safeBayIdx),
                    },
                    {
                      id: "lib_sub_divider",
                      label: "Raf Arası Dikme",
                      visual: "sub_divider" as const,
                      dragVisual: "sub_divider",
                      count: activeBay?.subDividers?.length || 0,
                      onClick: () => onAddSubDivider(safeBayIdx),
                    },
                    {
                      id: "lib_trouser_rack",
                      label: "Pantolonluk",
                      visual: "trouser_rack" as const,
                      dragVisual: "trouser_rack",
                      count:
                        activeBay?.specialFittings.filter((f) => f.type === "trouser_rack")
                          .length || 0,
                      onClick: () => onAddSpecialFitting(safeBayIdx, "trouser_rack"),
                    },
                    {
                      id: "lib_shoe_rack",
                      label: "Ayakkabılık",
                      visual: "shoe_rack" as const,
                      dragVisual: "shoe_rack",
                      count:
                        activeBay?.specialFittings.filter((f) => f.type === "shoe_rack").length ||
                        0,
                      onClick: () => onAddSpecialFitting(safeBayIdx, "shoe_rack"),
                    },
                    {
                      id: "lib_jewelry_tray",
                      label: "Takı Çekmecesi",
                      visual: "jewelry_tray" as const,
                      dragVisual: "jewelry_tray",
                      count:
                        activeBay?.specialFittings.filter((f) => f.type === "jewelry_tray")
                          .length || 0,
                      onClick: () => onAddSpecialFitting(safeBayIdx, "jewelry_tray"),
                    },
                  ].map((item) => (
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
                      className="p-2.5 rounded-2xl bg-white hover:bg-[#F5F2EA] border border-[#E5DFD3] hover:border-[#8C7A6B] flex items-center justify-between gap-2 text-left transition cursor-grab active:cursor-grabbing touch-none select-none"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {renderInteriorItemSvg(item.visual)}
                        <span className="font-semibold text-[#141413] text-[11px] leading-tight">
                          {item.label}
                        </span>
                      </div>
                      <span className="w-5 h-5 rounded-full bg-[#F5F2EA] text-[#141413] text-[10.5px] font-bold flex items-center justify-center shrink-0">
                        {item.count > 0 ? item.count : "+"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Donanım & Askı Boru Sistemleri (Görselli + Sürükle-Bırak) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-0.5">
                  <span className="text-[11px] font-bold text-[#57534E]">
                    Donanım &amp; Askı Sistemleri
                  </span>
                  <span className="text-[10px] text-[#8C7A6B]">Tıkla veya 3B&apos;ye sürükle</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    {
                      id: "lib_rail_lift",
                      icon: "lift_pantograph",
                      label: "Asansörlü Askı",
                      dragVisual: "rail",
                      onClick: () => onAddHangingRail(safeBayIdx),
                    },
                    {
                      id: "lib_rail_led",
                      icon: "led_black_30x15",
                      label: "LED'li Askı Borusu",
                      dragVisual: "rail",
                      onClick: () => {
                        onAddHangingRail(safeBayIdx);
                        onToggleModuleLed(true, { ledType: "led_rod_strip" });
                      },
                    },
                    {
                      id: "lib_hw_legrabox",
                      icon: "metal_box_legrabox",
                      label: "Blum Legrabox",
                      dragVisual: "drawer",
                      onClick: () => {
                        onUpdateCarcassConfig({ drawerBoxSystem: "metal_box_legrabox" });
                        if ((activeBay?.drawers.length || 0) === 0) onAddDrawer(safeBayIdx);
                      },
                    },
                    {
                      id: "lib_hw_tandembox",
                      icon: "metal_box_tandembox",
                      label: "Blum Tandembox",
                      dragVisual: "drawer",
                      onClick: () => {
                        onUpdateCarcassConfig({ drawerBoxSystem: "metal_box_tandembox" });
                        if ((activeBay?.drawers.length || 0) === 0) onAddDrawer(safeBayIdx);
                      },
                    },
                    {
                      id: "lib_hw_movento",
                      icon: "wooden_undermount",
                      label: "Movento Gizli Ray",
                      dragVisual: "drawer",
                      onClick: () => {
                        onUpdateCarcassConfig({ drawerBoxSystem: "wooden_undermount" });
                        if ((activeBay?.drawers.length || 0) === 0) onAddDrawer(safeBayIdx);
                      },
                    },
                    {
                      id: "lib_tie_belt",
                      icon: "tie_belt_rack",
                      label: "Kemer & Kravatlık",
                      dragVisual: "trouser_rack",
                      onClick: () => onAddSpecialFitting(safeBayIdx, "tie_rack"),
                    },
                  ].map((hw) => (
                    <button
                      key={hw.id}
                      type="button"
                      draggable={false}
                      onPointerDown={(e) =>
                        startLive3DPartGrab(
                          e,
                          {
                            id: hw.id,
                            title: hw.label,
                            visual: hw.dragVisual,
                          },
                          hw.onClick
                        )
                      }
                      title={`${hw.label} — Tıklayın veya 3B dolabın içine sürükleyin`}
                      className="p-2 rounded-2xl bg-white hover:bg-[#F5F2EA] border border-[#E5DFD3] hover:border-[#8C7A6B] flex items-center gap-2 text-left transition cursor-grab active:cursor-grabbing touch-none select-none"
                    >
                      {renderHardwareTechnicalSvg(hw.icon)}
                      <span className="font-semibold text-[#141413] text-[10.5px] leading-tight truncate">
                        {hw.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

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
                                className="w-24"
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
                                options={[120, 140, 160, 180, 220, 280].map((dh) => ({
                                  value: String(dh),
                                  label: `${dh} mm`,
                                }))}
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

                    {activeBay.specialFittings.map((sf, i) => (
                      <span
                        key={sf.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F5F2EA] text-[11px] font-medium"
                      >
                        <span>Aksesuar {i + 1}</span>
                        <button
                          type="button"
                          onClick={() => onRemoveSpecialFitting(safeBayIdx, sf.id)}
                          className="text-[#78716C] hover:text-red-600 cursor-pointer"
                        >
                          ✕
                        </button>
                      </span>
                    ))}

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

          {/* ==================== SEKME 3: KAPAK & DONANIM ==================== */}
          {activeTab === "doors" && (
            <>
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
                  {(
                    [
                      { id: "double", label: "Çift Kapak" },
                      { id: "single_left", label: "Sol Kapak" },
                      { id: "single_right", label: "Sağ Kapak" },
                      { id: "sliding", label: "Sürgü" },
                      { id: "tambour", label: "Tambur" },
                      { id: "open", label: "Açık Raf" },
                    ] as const
                  ).map((dt) => {
                    const active = curDoorType === dt.id;
                    return (
                      <button
                        key={dt.id}
                        type="button"
                        onClick={() => onSetBayDoorType(safeBayIdx, dt.id)}
                        className={`py-2 px-1 rounded-xl text-[10.5px] font-semibold transition cursor-pointer flex flex-col items-center gap-1 ${
                          active
                            ? "bg-[#141413] text-white"
                            : "bg-[#F5F2EA] hover:bg-[#EAE3D5] text-[#44403C]"
                        }`}
                      >
                        {renderDoorTypeIcon(dt.id)}
                        <span>{dt.label}</span>
                      </button>
                    );
                  })}
                </div>

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

              {curDoorType !== "open" && (
                <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-[#141413]">Kapak Modeli</span>
                    <div className="flex items-center gap-2">
                      {activeModule.bays.length > 1 && (
                        <StudioToggleSwitch
                          size="sm"
                          label="Tüm Bölmelere"
                          checked={batchApplyDoorModelToModule}
                          onChange={setBatchApplyDoorModelToModule}
                          title="Açıkken seçtiğiniz kapak modeli bu dolaptaki tüm kapaklara uygulanır"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => setCustomDoorOpen(true)}
                        className="px-2 py-1 rounded-lg bg-[#F5F2EA] hover:bg-[#EAE3D5] text-[#141413] text-[10.5px] font-semibold cursor-pointer"
                      >
                        + Kesit Çiz
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {V11_DOOR_PROFILES.filter((pf) => pf.id !== "u_glass_open_top").map((pf) => {
                      const active = !selectedCustomDoorId && curDoorProfile === pf.id;
                      return (
                        <button
                          key={pf.id}
                          type="button"
                          onClick={() => {
                            setSelectedCustomDoorId(null);
                            applyDoorPatchAcrossScope(
                              {
                                crossSectionProfile: pf.id,
                                isGlassFramed: Boolean(pf.isGlass),
                              },
                              batchApplyDoorModelToModule,
                              batchApplyHandlesToAllModules
                            );
                          }}
                          className={`p-2 rounded-2xl border text-left transition cursor-pointer flex items-center gap-2 ${
                            active
                              ? "bg-[#141413] text-white border-[#141413]"
                              : "bg-[#FAF8F4] hover:bg-[#F2EEE4] border-[#E5DFD3] text-[#141413]"
                          }`}
                        >
                          {renderDoorProfileIcon(pf.id)}
                          <div className="font-bold text-[11px] leading-tight truncate">{pf.label}</div>
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

              {activeBay.drawers.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-[#141413]">Çekmece Klapası Modeli</span>
                    <button
                      type="button"
                      onClick={() => setCustomDoorOpen(true)}
                      className="px-2 py-1 rounded-lg bg-[#F5F2EA] hover:bg-[#EAE3D5] text-[#141413] text-[10.5px] font-semibold cursor-pointer"
                    >
                      + Klapa Kesiti Çiz
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {V11_DOOR_PROFILES.filter(
                      (pf) => pf.id !== "mirror_door" && pf.id !== "mirror_frameless"
                    ).map((pf) => {
                      const curDrawerProf =
                        activeModule.carcass.drawerFrontProfile || "flat_slab";
                      const isDrSel = curDrawerProf === pf.id;
                      return (
                        <button
                          key={`dr_${pf.id}`}
                          type="button"
                          onClick={() =>
                            onUpdateCarcassConfig({ drawerFrontProfile: pf.id })
                          }
                          className={`p-2 rounded-2xl border text-left transition cursor-pointer flex items-center gap-2 ${
                            isDrSel
                              ? "bg-[#141413] text-white border-[#141413]"
                              : "bg-[#FAF8F4] hover:bg-[#F2EEE4] border-[#E5DFD3] text-[#141413]"
                          }`}
                        >
                          {renderDoorProfileIcon(pf.id)}
                          <div className="font-bold text-[11px] leading-tight truncate">
                            {pf.label}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {curDoorType !== "open" && !isSlidingBay && (
                <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-[#141413]">Kulp Stili &amp; Toplu Uygulama</span>
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

                  <div className="grid grid-cols-2 gap-1.5">
                    {handleProfiles.map((hp) => {
                      const active = (activeBay?.door?.handleProfileId || "K019") === hp.id;
                      const strokeCol = active ? "#FAF8F4" : "#292524";
                      const renderHandleIcon = () => {
                        switch (String(hp.category)) {
                          case "handleless":
                            return (
                              <svg viewBox="0 0 28 20" className="w-7 h-5 shrink-0" fill="none">
                                <rect x="3" y="2" width="22" height="16" rx="2" stroke={strokeCol} strokeWidth="1.4" />
                                <circle cx="20" cy="10" r="1.5" fill={strokeCol} />
                              </svg>
                            );
                          case "gola_profile":
                            return (
                              <svg viewBox="0 0 28 20" className="w-7 h-5 shrink-0" fill="none">
                                <path d="M4 3H24V7H8V17H4V3Z" fill={strokeCol} fillOpacity="0.25" stroke={strokeCol} strokeWidth="1.4" />
                              </svg>
                            );
                          case "j_pull":
                            return (
                              <svg viewBox="0 0 28 20" className="w-7 h-5 shrink-0" fill="none">
                                <path d="M6 17V5L10 3H23V17H6Z" stroke={strokeCol} strokeWidth="1.4" />
                                <path d="M6 7H14" stroke={strokeCol} strokeWidth="1.6" />
                              </svg>
                            );
                          case "knob":
                            return (
                              <svg viewBox="0 0 28 20" className="w-7 h-5 shrink-0" fill="none">
                                <rect x="3" y="2" width="22" height="16" rx="2" stroke={strokeCol} strokeWidth="1.1" strokeOpacity="0.4" />
                                <circle cx="14" cy="10" r="4" fill={strokeCol} />
                              </svg>
                            );
                          case "recessed_grip":
                            return (
                              <svg viewBox="0 0 28 20" className="w-7 h-5 shrink-0" fill="none">
                                <rect x="3" y="2" width="22" height="16" rx="2" stroke={strokeCol} strokeWidth="1.1" strokeOpacity="0.4" />
                                <rect x="11" y="4" width="6" height="12" rx="1.5" stroke={strokeCol} strokeWidth="1.5" />
                              </svg>
                            );
                          case "milled_wood_grip":
                            return (
                              <svg viewBox="0 0 28 20" className="w-7 h-5 shrink-0" fill="none">
                                <rect x="3" y="2" width="22" height="16" rx="2" stroke={strokeCol} strokeWidth="1.2" />
                                <rect x="12" y="4" width="4" height="12" rx="1" fill={strokeCol} />
                              </svg>
                            );
                          default:
                            return (
                              <svg viewBox="0 0 28 20" className="w-7 h-5 shrink-0" fill="none">
                                <rect x="3" y="2" width="22" height="16" rx="2" stroke={strokeCol} strokeWidth="1.1" strokeOpacity="0.4" />
                                <path d="M14 4V16" stroke={strokeCol} strokeWidth="2.4" strokeLinecap="round" />
                                <circle cx="14" cy="5.5" r="1.2" fill={strokeCol} />
                                <circle cx="14" cy="14.5" r="1.2" fill={strokeCol} />
                              </svg>
                            );
                        }
                      };
                      return (
                        <button
                          key={hp.id}
                          type="button"
                          onClick={() =>
                            applyDoorPatchAcrossScope(
                              {
                                handleProfileId: hp.id,
                                handleCategory: hp.category,
                              },
                              batchApplyHandlesToModule,
                              batchApplyHandlesToAllModules
                            )
                          }
                          className={`py-2 px-2 rounded-xl text-[11px] font-semibold flex items-center gap-2 text-left transition cursor-pointer ${
                            active
                              ? "bg-[#141413] text-white"
                              : "bg-[#F5F2EA] hover:bg-[#EAE3D5] text-[#44403C]"
                          }`}
                        >
                          {renderHandleIcon()}
                          <span className="truncate">{hp.name}</span>
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
                            className="w-full h-12 rounded-xl border border-black/10 relative mb-1.5 shadow-inner overflow-hidden"
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
