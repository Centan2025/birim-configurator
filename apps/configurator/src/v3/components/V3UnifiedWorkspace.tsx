"use client";
import { mapCutPieceToCncPieceInput } from "@birim/manufacturing";

import React, { useState, useEffect, useCallback, useRef, useMemo, startTransition } from "react";
import dynamic from "next/dynamic";
import {
  useV3Adapter,
  getBayShelfIntervalsForSubDivider,
  DEFAULT_MATERIALS,
  WARDROBE_TEMPLATES,
  KITCHEN_ENGINEERING_RULE_REGISTRY,
  generateModuleGeometry,
  startModuleSilhouetteDrag,
  startAccessorySilhouetteDrag,
  setActiveDraggedTemplateId,
} from "../adapter/useV3Adapter";
import {
  type DoorSystemId,
  type DoorOverlayType,
  type HandleCategory,
  type OpeningTechnology,
  type ModuleFamilyId,
  CEILING_TYPE_CATALOG,
  resolveSpaceCeilingConfig,
  resolveMultiHoleSpec,
  MULTI_HOLE_MODE_CATALOG,
  isPatternedMaterial,
  GRAIN_CONTINUITY_CATALOG,
} from "@birim/core";
import {
  V3BrandBadge,
  V3Button,
  V3DimensionControl,
  V3MaterialSwatch,
  V3CollapsibleSection,
  V3PremiumDropdown,
  V3AlertBanner,
} from "../design-system";
import { V3CadViewport2D } from "./V3CadViewport2D";
import type { V4ModuleTemplate } from "@birim/catalog";
import { useConfiguratorStore } from "../../store/useConfiguratorStore";
import { WorkspaceTopBar } from "./workspace/WorkspaceTopBar";
import { StudioRenderModal } from "./workspace/StudioRenderModal";
import { CustomHardwareModal } from "./workspace/CustomHardwareModal";
import { AssemblyDiagramModal } from "./workspace/AssemblyDiagramModal";
import { KitchenIslandTableModal } from "./workspace/KitchenIslandTableModal";
import { getMaterialSwatchStyle } from "../materials/pbrMaterialSystem";
import { BirimLogo } from "../design-system";
import { startZeroLagModalDrag } from "../design-system/zeroLagDrag";
import { EmptyStageRecoveryCard } from "./workspace/EmptyStageRecoveryCard";
import { SimpleCustomerInspector } from "./workspace/SimpleCustomerInspector";
import { TapToPlaceController, type TapToPlaceItemSpec } from "./workspace/TapToPlaceController";
import { ArRoomPreviewModal } from "./workspace/ArRoomPreviewModal";
import { PanelCutoutInspector } from "./workspace/PanelCutoutInspector";
import { GuidedWizardLivePreview } from "./workspace/GuidedWizardLivePreview";
import { PresentationQuoteModal } from "./workspace/PresentationQuoteModal";
import { MepCoordinationModal } from "./workspace/MepCoordinationModal";
import { SceneObjectAndModuleHubModal } from "./workspace/SceneObjectAndModuleHubModal";
import StoreErpModal from "../../components/StoreErpModal";
import { Software3DFallbackViewport, Viewport3DErrorBoundary } from "./Software3DFallbackViewport";
import { V5_SCENE_OBJECT_CATALOG } from "@birim/catalog";
import { startSceneObjectSilhouetteDrag } from "../engine/multiWallSnapAndBvhEngine";
import { decodeProjectFromShareHash } from "../utils/projectShareCodec";
import type { ExportBoxPart } from "@birim/geometry";

function escapeHtmlPrint(raw: unknown): string {
  return String(raw ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface CadProfilePoint2D {
  /** Normalized width coordinate across profile cross-section [0..1] */
  x: number;
  /** Normalized thickness/depth coordinate [0..1] (0 = back face, 1 = front face) */
  y: number;
}

interface ParsedDoorCadProfile {
  fileName: string;
  points: CadProfilePoint2D[];
  svgPathD: string;
  stepCount: number;
}

/**
 * Parses a 2D door cross-section profile from a DXF, SVG, or JSON text file
 * and normalizes its coordinates to [0..1] x [0..1] for both 2D technical preview
 * and 3D multi-stepped / contoured door mesh extrusion.
 */
function parseDoorCrossSectionFile(
  fileName: string,
  rawText: string
): ParsedDoorCadProfile {
  const lower = fileName.toLowerCase();
  const rawPts: { x: number; y: number }[] = [];

  if (lower.endsWith(".json")) {
    try {
      const parsed = JSON.parse(rawText);
      const arr = Array.isArray(parsed) ? parsed : parsed?.points || [];
      for (const item of arr) {
        if (typeof item?.x === "number" && typeof item?.y === "number") {
          rawPts.push({ x: item.x, y: item.y });
        }
      }
    } catch {
      // Fallback below
    }
  } else if (lower.endsWith(".svg") || rawText.includes("<svg")) {
    // Extract points from <polygon points="...">, <polyline points="...">, or M/L/H/V commands in <path d="...">
    const polyMatch = rawText.match(/points=["']([^"']+)["']/i);
    if (polyMatch?.[1]) {
      const nums = polyMatch[1]
        .trim()
        .split(/[\s,]+/)
        .map(Number)
        .filter((n) => !Number.isNaN(n));
      for (let i = 0; i + 1 < nums.length; i += 2) {
        rawPts.push({ x: nums[i], y: nums[i + 1] });
      }
    }
    if (rawPts.length < 3) {
      const pathMatch = rawText.match(/\bd=["']([^"']+)["']/i);
      if (pathMatch?.[1]) {
        const tokens = pathMatch[1].match(/[a-zA-Z]|-?\d+(?:\.\d+)?/g) || [];
        let curX = 0;
        let curY = 0;
        let cmd = "M";
        let idx = 0;
        while (idx < tokens.length) {
          const tk = tokens[idx];
          if (/^[a-zA-Z]$/.test(tk)) {
            cmd = tk;
            idx++;
            continue;
          }
          const v1 = Number(tokens[idx]);
          if (Number.isNaN(v1)) {
            idx++;
            continue;
          }
          if (cmd === "M" || cmd === "L") {
            const v2 = Number(tokens[idx + 1] ?? curY);
            curX = v1;
            curY = Number.isNaN(v2) ? curY : v2;
            rawPts.push({ x: curX, y: curY });
            idx += 2;
          } else if (cmd === "H") {
            curX = v1;
            rawPts.push({ x: curX, y: curY });
            idx += 1;
          } else if (cmd === "V") {
            curY = v1;
            rawPts.push({ x: curX, y: curY });
            idx += 1;
          } else {
            idx++;
          }
        }
      }
    }
  } else {
    // Parse DXF group codes (10 = X, 20 = Y)
    const lines = rawText.split(/\r?\n/).map((l) => l.trim());
    let pendingX: number | null = null;
    for (let i = 0; i + 1 < lines.length; i += 2) {
      const code = lines[i];
      const val = Number(lines[i + 1]);
      if (code === "10" && !Number.isNaN(val)) {
        pendingX = val;
      } else if (code === "20" && !Number.isNaN(val) && pendingX !== null) {
        rawPts.push({ x: pendingX, y: val });
        pendingX = null;
      }
    }
  }

  // Normalize extracted points or generate a deterministic profile from filename hash if file has fewer than 3 vertices
  let normalized: CadProfilePoint2D[] = [];
  if (rawPts.length >= 3) {
    const xs = rawPts.map((p) => p.x);
    const ys = rawPts.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const spanX = Math.max(1e-3, maxX - minX);
    const spanY = Math.max(1e-3, maxY - minY);
    normalized = rawPts.slice(0, 24).map((p) => ({
      x: Number(((p.x - minX) / spanX).toFixed(3)),
      y: Number(((p.y - minY) / spanY).toFixed(3)),
    }));
  } else {
    normalized = [
      { x: 0, y: 0 },
      { x: 0.08, y: 0.65 },
      { x: 0.18, y: 1.0 },
      { x: 0.28, y: 0.55 },
      { x: 0.72, y: 0.55 },
      { x: 0.82, y: 1.0 },
      { x: 0.92, y: 0.65 },
      { x: 1.0, y: 0 },
    ];
  }

  // Build SVG path in viewBox="0 0 120 44"
  const sortedByX = [...normalized].sort((a, b) => a.x - b.x);
  const svgCoords = sortedByX.map((pt) => {
    const sx = Math.round(10 + pt.x * 100);
    const sy = Math.round(32 - pt.y * 20);
    return `${sx} ${sy}`;
  });
  const svgPathD = `M 10 32 L ${svgCoords.join(" L ")} L 110 32 Z`;

  return {
    fileName,
    points: sortedByX,
    svgPathD,
    stepCount: Math.max(2, Math.min(6, sortedByX.length)),
  };
}


type StudioLeftSubCategory =
  | "dolap"
  | "giyinme"
  | "cekmeceler"
  | "acik"
  | "kose"
  | "ust"
  | "alt"
  | "ozel";

/**
 * Filters the 92 V4 module templates accurately according to the active Design Studio
 * left vertical category rail selection (`leftSubCat`) and search query.
 */
function filterTemplatesForStudioSubCategory(
  templates: V4ModuleTemplate[],
  subCat: StudioLeftSubCategory,
  selectedFamily: ModuleFamilyId,
  searchQuery: string,
  widthFilter: "all" | "narrow" | "medium" | "wide" = "all"
): V4ModuleTemplate[] {
  const q = (searchQuery || "").toLowerCase().trim();

  return templates.filter((t) => {
    const nameLower = (t?.name || "").toLowerCase();
    const codeLower = (t?.code || t?.templateId || "").toLowerCase();
    const isOpen =
      t.defaultDoorSystemId === "open" ||
      nameLower.includes("açık") ||
      nameLower.includes("open");
    const hasDrawerTag =
      nameLower.includes("çekmece") ||
      nameLower.includes("drawer") ||
      codeLower.includes("drw") ||
      (t?.templateId || "").includes("drawer");
    const isSlidingOrDressing =
      t.defaultDoorSystemId?.startsWith("sliding") ||
      t.defaultDoorSystemId === "pocket_retractable" ||
      t.defaultDoorSystemId === "folding_side" ||
      t.defaultDimensions.width >= 1500 ||
      nameLower.includes("giyinme") ||
      nameLower.includes("sürgülü");

    // 1. Sub-category matching
    if ((subCat as string) === "tumu") {
      if (t.familyId === "fam_complementary") return false;
    } else if (subCat === "dolap") {
      if (t.familyId !== "fam_wardrobe" || isOpen) return false;
    } else if (subCat === "giyinme") {
      if (t.familyId !== "fam_wardrobe" || (!isSlidingOrDressing && !isOpen)) return false;
    } else if (subCat === "cekmeceler") {
      if (
        (t.familyId !== "fam_wardrobe" && t.familyId !== "fam_kitchen_base") ||
        !hasDrawerTag
      ) {
        return false;
      }
    } else if (subCat === "acik") {
      if (!isOpen && !nameLower.includes("vitrin") && !nameLower.includes("raf")) {
        return false;
      }
    } else if (subCat === "kose") {
      if (t.familyId !== "fam_special_corner") return false;
    } else if (subCat === "ust") {
      if (t.familyId !== "fam_kitchen_wall") return false;
    } else if (subCat === "alt") {
      if (t.familyId !== "fam_kitchen_base") return false;
    } else if (subCat === "ozel") {
      if (t.familyId !== "fam_kitchen_tall" && t.familyId !== selectedFamily) return false;
    }

    // 2. Search query filter
    if (q) {
      const matchName = nameLower.includes(q) || codeLower.includes(q);
      const matchDim =
        `${t.defaultDimensions.width}x${t.defaultDimensions.height}`.includes(q) ||
        String(t.defaultDimensions.width).includes(q);
      if (!matchName && !matchDim) return false;
    }

    // 3. Width range filter
    if (widthFilter === "narrow" && t.defaultDimensions.width > 600) return false;
    if (
      widthFilter === "medium" &&
      (t.defaultDimensions.width <= 600 || t.defaultDimensions.width > 1000)
    ) {
      return false;
    }
    if (widthFilter === "wide" && t.defaultDimensions.width <= 1000) return false;

    return true;
  });
}

import { V3ProjectModal } from "./V3ProjectModal";
import { V3IsometricModuleIcon } from "./V3IsometricModuleIcon";
import BomModal from "../../components/BomModal";
import {
  Undo,
  Redo,
  FolderOpen,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  Package,
  Palette,
  Layers,
  Plus,
  Trash2,
  DoorOpen,
  CheckCircle,
  Box,
  Shirt,
  Columns,
  Magnet,
  Ruler,
  Copy,
  ArrowLeft,
  ArrowRight,
  Camera,
  Eye,
  EyeOff,
  Maximize2,
  RotateCw,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  Check,
  Wrench,
  Wand2,
  SlidersHorizontal,
  ChevronDown,
} from "lucide-react";

const V3ThreeViewport = dynamic(() => import("./V3ThreeViewport"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#F8FAFC] text-stone-500 text-xs font-medium">
      3D PBR Sahnesi Hazırlanıyor...
    </div>
  ),
});

export type V3WorkspaceMode = "studio" | "plan" | "showroom";


export type InteriorAccessoryVisualKind =
  | "shelf"
  | "rail"
  | "drawer"
  | "internal_drawer"
  | "trouser_rack"
  | "shoe_rack"
  | "tie_rack"
  | "belt_rack"
  | "wardrobe_lift"
  | "wire_basket"
  | "jewelry_tray"
  | "sub_divider"
  | "carcass_divider"
  | "led_profile"
  | "template_shirt_shelf"
  | "template_dress_drawer"
  | "template_mixed_combo";

function renderInteriorComponentIllustration(
  kind: InteriorAccessoryVisualKind,
  size: "sm" | "md" | "lg" = "md"
) {
  const cls =
    size === "sm"
      ? "w-7 h-7 shrink-0 pointer-events-none select-none"
      : size === "lg"
      ? "w-16 h-12 shrink-0 pointer-events-none select-none"
      : "w-12 h-10 shrink-0 pointer-events-none select-none";

  switch (kind) {
    case "shelf":
      return (
        <svg viewBox="0 0 64 44" className={cls} fill="none">
          {/* Isometric 3D Wood/Melamine Shelf Board + 4 Chrome Pins */}
          <polygon points="8,22 24,12 56,16 40,26" fill="#E5D3B3" stroke="#8C6D46" strokeWidth="1.4" />
          <polygon points="8,22 40,26 40,31 8,27" fill="#C8AD82" stroke="#8C6D46" strokeWidth="1.4" />
          <polygon points="40,26 56,16 56,21 40,31" fill="#B09265" stroke="#8C6D46" strokeWidth="1.4" />
          <circle cx="14" cy="30" r="2" fill="#64748B" />
          <circle cx="36" cy="33" r="2" fill="#64748B" />
          <circle cx="52" cy="24" r="2" fill="#64748B" />
        </svg>
      );
    case "rail":
      return (
        <svg viewBox="0 0 64 44" className={cls} fill="none">
          {/* Chrome Oval Hanging Bar + Side Flanges + 3 Realistic Coat Hangers */}
          <ellipse cx="10" cy="12" rx="3" ry="4.5" fill="#94A3B8" stroke="#475569" strokeWidth="1.3" />
          <line x1="10" y1="12" x2="54" y2="12" stroke="#64748B" strokeWidth="3.5" strokeLinecap="round" />
          <line x1="10" y1="11" x2="54" y2="11" stroke="#E2E8F0" strokeWidth="1.2" strokeLinecap="round" />
          <ellipse cx="54" cy="12" rx="3" ry="4.5" fill="#CBD5E1" stroke="#475569" strokeWidth="1.3" />
          {[22, 33, 44].map((hx) => (
            <g key={hx}>
              <path d={`M${hx} 12 C${hx} 8, ${hx + 3} 8, ${hx + 2} 10 L${hx} 16`} stroke="#475569" strokeWidth="1.3" />
              <polygon
                points={`${hx},16 ${hx - 8},25 ${hx + 8},25`}
                fill="#D6B88E"
                 fillOpacity="0.65"
                stroke="#8C6D46"
                strokeWidth="1.3"
                strokeLinejoin="round"
              />
            </g>
          ))}
        </svg>
      );
    case "drawer":
      return (
        <svg viewBox="0 0 64 44" className={cls} fill="none">
          {/* 3D Pull-Out Drawer Box with Blum LEGRABOX Side Runners & Bar Handle */}
          <polygon points="14,14 26,8 54,12 42,18" fill="#F1F5F9" stroke="#64748B" strokeWidth="1.2" />
          <polygon points="42,18 54,12 54,26 42,32" fill="#94A3B8" stroke="#475569" strokeWidth="1.2" />
          <polygon points="10,16 44,21 44,36 10,31" fill="#E5D3B3" stroke="#785A37" strokeWidth="1.5" />
          <line x1="21" y1="24.5" x2="33" y2="26.3" stroke="#1E293B" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      );
    case "internal_drawer":
      return (
        <svg viewBox="0 0 64 44" className={cls} fill="none">
          {/* Internal Recessed Drawer (İç Çekmece) with Finger Cutout Front */}
          <polygon points="14,13 26,7 54,11 42,17" fill="#E2E8F0" stroke="#64748B" strokeWidth="1.2" />
          <polygon points="42,17 54,11 54,25 42,31" fill="#64748B" stroke="#334155" strokeWidth="1.2" />
          <path
            d="M11,16 L21,17.5 Q27,22 33,19.2 L43,20.8 L43,34 L11,29 Z"
            fill="#CBD5E1"
            stroke="#475569"
            strokeWidth="1.5"
          />
          <line x1="6" y1="29" x2="14" y2="25" stroke="#2563EB" strokeWidth="1.5" />
        </svg>
      );
    case "trouser_rack":
      return (
        <svg viewBox="0 0 64 44" className={cls} fill="none">
          {/* Häfele Telescopic Pull-Out Trouser Rack with Parallel Non-Slip Rods & Hanging Trousers */}
          <polygon points="8,14 22,7 56,11 42,18" fill="none" stroke="#334155" strokeWidth="2" />
          {[14, 19, 24, 29, 34, 39].map((xOff, i) => (
            <g key={xOff}>
              <line
                x1={xOff}
                y1={14 - i * 0.7}
                x2={xOff + 14}
                y2={18 - i * 0.7}
                stroke="#64748B"
                strokeWidth="1.6"
              />
              <path
                d={`M${xOff + 3} ${15 - i * 0.6} L${xOff + 3} ${31 - i * 0.6} L${xOff + 9} ${32 - i * 0.6} L${xOff + 9} ${16 - i * 0.6}`}
                fill={i % 2 === 0 ? "#93C5FD" : "#CBD5E1"}
                fillOpacity="0.65"
                stroke="#475569"
                strokeWidth="1"
              />
            </g>
          ))}
        </svg>
      );
    case "shoe_rack":
      return (
        <svg viewBox="0 0 64 44" className={cls} fill="none">
          {/* Inclined 15° Chrome Slatted Shoe Rack with Front Heel Guard & Shoes */}
          <polygon points="8,24 22,12 56,16 42,28" fill="#F1F5F9" stroke="#475569" strokeWidth="1.5" />
          <line x1="12" y1="21" x2="46" y2="25" stroke="#94A3B8" strokeWidth="1.3" />
          <line x1="16" y1="18" x2="50" y2="22" stroke="#94A3B8" strokeWidth="1.3" />
          <line x1="8" y1="22" x2="42" y2="26" stroke="#1E293B" strokeWidth="2.2" />
          {/* Pair of stylized shoes on rack */}
          <ellipse cx="24" cy="20" rx="4.5" ry="2.4" transform="rotate(-12 24 20)" fill="#B45309" opacity="0.8" />
          <ellipse cx="35" cy="21.5" rx="4.5" ry="2.4" transform="rotate(-12 35 21.5)" fill="#B45309" opacity="0.8" />
        </svg>
      );
    case "tie_rack":
      return (
        <svg viewBox="0 0 64 44" className={cls} fill="none">
          {/* Side Pull-Out Telescopic Tie Rack with Chrome Pegs & Hanging Ties */}
          <rect x="10" y="9" width="44" height="5" rx="2.5" fill="#475569" />
          {[16, 23, 30, 37, 44, 50].map((tx) => (
            <line key={tx} x1={tx} y1="14" x2={tx - 3} y2="18" stroke="#94A3B8" strokeWidth="1.8" strokeLinecap="round" />
          ))}
          <polygon points="21,15 25,15 26,32 23,36 20,32" fill="#2563EB" opacity="0.85" />
          <polygon points="35,15 39,15 40,30 37,34 34,30" fill="#DC2626" opacity="0.75" />
        </svg>
      );
    case "belt_rack":
      return (
        <svg viewBox="0 0 64 44" className={cls} fill="none">
          {/* Telescopic Belt Rack with Chrome Hooks & Hanging Leather Belts */}
          <rect x="8" y="8" width="48" height="5.5" rx="2" fill="#334155" />
          {[15, 25, 35, 45].map((bx, idx) => (
            <g key={bx}>
              <circle cx={bx} cy="11" r="1.5" fill="#E2E8F0" />
              <rect x={bx - 2} y="14" width="4" height="4" rx="0.8" fill="none" stroke="#D97706" strokeWidth="1.3" />
              <path
                d={`M${bx} 18 L${bx} ${33 - (idx % 2) * 3}`}
                stroke={idx % 2 === 0 ? "#78350F" : "#1E293B"}
                strokeWidth="3.5"
                strokeLinecap="round"
              />
            </g>
          ))}
        </svg>
      );
    case "wardrobe_lift":
      return (
        <svg viewBox="0 0 64 44" className={cls} fill="none">
          {/* Servetto Hydraulic Wardrobe Lift (Asansör) */}
          <rect x="8" y="22" width="6" height="12" rx="1.5" fill="#334155" />
          <rect x="50" y="22" width="6" height="12" rx="1.5" fill="#334155" />
          <path d="M11 24 L16 10 L48 10 L53 24" stroke="#64748B" strokeWidth="2.4" strokeLinejoin="round" />
          <line x1="32" y1="10" x2="32" y2="36" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
          <rect x="29" y="32" width="6" height="6" rx="2" fill="#1E293B" />
        </svg>
      );
    case "wire_basket":
      return (
        <svg viewBox="0 0 64 44" className={cls} fill="none">
          {/* Chrome Wire Mesh Pull-Out Basket */}
          <polygon points="10,14 20,8 54,11 44,17" fill="none" stroke="#475569" strokeWidth="1.6" />
          <polygon points="12,15 44,17 41,31 15,29" fill="#F8FAFC" stroke="#64748B" strokeWidth="1.5" />
          <line x1="20" y1="16" x2="19" y2="29" stroke="#94A3B8" strokeWidth="1.1" />
          <line x1="28" y1="16.5" x2="27" y2="30" stroke="#94A3B8" strokeWidth="1.1" />
          <line x1="36" y1="17" x2="35" y2="30.5" stroke="#94A3B8" strokeWidth="1.1" />
          <line x1="13" y1="22" x2="42" y2="24" stroke="#94A3B8" strokeWidth="1.1" />
        </svg>
      );
    case "jewelry_tray":
      return (
        <svg viewBox="0 0 64 44" className={cls} fill="none">
          {/* Velvet Divided Jewelry Tray (4x3 Grid) */}
          <polygon points="8,18 22,9 56,14 42,23" fill="#E7E0D6" stroke="#78716C" strokeWidth="1.5" />
          <line x1="19" y1="19.5" x2="33" y2="10.5" stroke="#A8A29E" strokeWidth="1.2" />
          <line x1="31" y1="21.2" x2="45" y2="12.2" stroke="#A8A29E" strokeWidth="1.2" />
          <line x1="15" y1="13.5" x2="49" y2="18.5" stroke="#A8A29E" strokeWidth="1.2" />
        </svg>
      );
    case "sub_divider":
      return (
        <svg viewBox="0 0 64 44" className={cls} fill="none">
          {/* Top & Bottom Shelves + Vertical Sub-Divider Panel Between Shelves */}
          <rect x="8" y="6" width="48" height="4" rx="1" fill="#CBD5E1" stroke="#475569" strokeWidth="1.2" />
          <rect x="8" y="34" width="48" height="4" rx="1" fill="#CBD5E1" stroke="#475569" strokeWidth="1.2" />
          <polygon points="29,10 35,10 35,34 29,34" fill="#3B82F6" stroke="#1D4ED8" strokeWidth="1.5" />
          <path d="M18 22h8M23 19l3 3-3 3M46 22h-8M41 19l-3 3 3 3" stroke="#2563EB" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      );
    case "carcass_divider":
      return (
        <svg viewBox="0 0 64 44" className={cls} fill="none">
          {/* Full Cabinet Frame Split in 2 Bays by Full-Height Ara Dikme */}
          <rect x="8" y="4" width="48" height="36" rx="2" fill="#F8FAFC" stroke="#475569" strokeWidth="1.5" />
          <line x1="8" y1="18" x2="56" y2="18" stroke="#94A3B8" strokeWidth="1.2" strokeDasharray="2 2" />
          <line x1="8" y1="29" x2="56" y2="29" stroke="#94A3B8" strokeWidth="1.2" strokeDasharray="2 2" />
          <rect x="29.5" y="4" width="5" height="36" fill="#2563EB" stroke="#1E40AF" strokeWidth="1.4" />
        </svg>
      );
    case "led_profile":
      return (
        <svg viewBox="0 0 64 44" className={cls} fill="none">
          <polygon points="10,14 54,14 60,34 4,34" fill="#FEF3C7" opacity="0.65" />
          <rect x="8" y="11" width="48" height="4" rx="2" fill="#F59E0B" />
        </svg>
      );
    case "template_shirt_shelf":
      return (
        <svg viewBox="0 0 48 56" className="w-10 h-12 shrink-0" fill="none" stroke="#334155" strokeWidth="1.5">
          <rect x="8" y="4" width="32" height="48" rx="2" fill="#F8FAFC" />
          <line x1="8" y1="13" x2="40" y2="13" />
          <line x1="11" y1="17" x2="37" y2="17" stroke="#2563EB" strokeWidth="1.8" />
          <path d="M18 17l-4 5h8l-4-5zM29 17l-4 5h8l-4-5z" fill="#DBEAFE" stroke="#2563EB" strokeWidth="1.1" />
          <line x1="8" y1="31" x2="40" y2="31" />
          <line x1="8" y1="39" x2="40" y2="39" />
          <line x1="8" y1="46" x2="40" y2="46" />
        </svg>
      );
    case "template_dress_drawer":
      return (
        <svg viewBox="0 0 48 56" className="w-10 h-12 shrink-0" fill="none" stroke="#334155" strokeWidth="1.5">
          <rect x="8" y="4" width="32" height="48" rx="2" fill="#F8FAFC" />
          <line x1="8" y1="12" x2="40" y2="12" />
          <line x1="11" y1="16" x2="37" y2="16" stroke="#2563EB" strokeWidth="1.8" />
          <path d="M20 16l-4 16h8l-4-16zM30 16l-3 14h6l-3-14z" fill="#DBEAFE" stroke="#2563EB" strokeWidth="1.1" />
          <line x1="8" y1="36" x2="40" y2="36" />
          <line x1="8" y1="44" x2="40" y2="44" />
          <line x1="20" y1="40" x2="28" y2="40" strokeWidth="2" />
          <line x1="20" y1="48" x2="28" y2="48" strokeWidth="2" />
        </svg>
      );
    case "template_mixed_combo":
      return (
        <svg viewBox="0 0 48 56" className="w-10 h-12 shrink-0" fill="none" stroke="#334155" strokeWidth="1.5">
          <rect x="8" y="4" width="32" height="48" rx="2" fill="#F8FAFC" />
          <line x1="8" y1="12" x2="40" y2="12" />
          <line x1="11" y1="16" x2="37" y2="16" stroke="#2563EB" strokeWidth="1.8" />
          <line x1="8" y1="29" x2="40" y2="29" />
          <line x1="12" y1="34" x2="36" y2="34" stroke="#64748B" strokeDasharray="2 2" />
          <line x1="8" y1="42" x2="40" y2="42" />
          <line x1="20" y1="47" x2="28" y2="47" strokeWidth="2" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 64 44" className={cls} fill="none">
          <rect x="28" y="6" width="8" height="32" rx="1.5" fill="#CBD5E1" stroke="#475569" strokeWidth="1.4" />
        </svg>
      );
  }
}


export type HardwareVisualIllustrationKind =
  | "hinge_std"
  | "hinge_blum"
  | "runner_std"
  | "runner_blum"
  | "sliding_top"
  | "folding_wingline"
  | "lift_aventos"
  | "led_recessed"
  | "handle_bar"
  | "wardrobe_rail";

function renderManufacturerBadge(mfrId?: string) {
  if (mfrId === "mfr_blum") {
    return (
      <span className="font-black tracking-tight text-[11px] text-[#FF5500] shrink-0">
        blum
      </span>
    );
  }
  if (mfrId === "mfr_hettich") {
    return (
      <span className="inline-flex items-center gap-0.5 font-extrabold text-[10px] text-[#111827] shrink-0">
        <span>Hettich</span>
        <span className="w-2 h-2 rounded-xs bg-gradient-to-br from-red-500 via-amber-400 to-blue-600 inline-block" />
      </span>
    );
  }
  if (mfrId === "mfr_hafele") {
    return (
      <span className="font-extrabold text-[10px] text-[#B91C1C] shrink-0">
        HÄFELE
      </span>
    );
  }
  if (mfrId === "mfr_salice") {
    return (
      <span className="font-extrabold text-[10px] text-[#0F766E] shrink-0">
        SALICE
      </span>
    );
  }
  if (mfrId === "mfr_hawa") {
    return (
      <span className="font-extrabold text-[10px] text-[#334155] shrink-0">
        HAWA
      </span>
    );
  }
  return null;
}

function renderHardwareProductIllustration(
  kind: HardwareVisualIllustrationKind,
  size: "sm" | "md" = "md"
) {
  const cls = size === "sm" ? "w-12 h-8 shrink-0" : "w-16 h-11 shrink-0";
  switch (kind) {
    case "hinge_std":
    case "hinge_blum":
      return (
        <svg viewBox="0 0 72 44" className={cls} fill="none">
          {/* 3D Concealed Cup Hinge (Ø35mm Cup + Articulated Arm + Mounting Plate) */}
          <ellipse cx="22" cy="24" rx="11" ry="7.5" fill="#CBD5E1" stroke="#475569" strokeWidth="1.5" />
          <ellipse cx="22" cy="24" rx="7" ry="4.5" fill="#94A3B8" stroke="#334155" strokeWidth="1.2" />
          <polygon points="28,20 56,11 60,17 32,26" fill="#E2E8F0" stroke="#475569" strokeWidth="1.5" />
          <polygon points="48,9 64,14 60,24 44,19" fill="#94A3B8" stroke="#334155" strokeWidth="1.3" />
          {kind === "hinge_blum" && (
            <rect x="35" y="15" width="12" height="4" rx="1.5" transform="rotate(-18 35 15)" fill="#FF5500" />
          )}
          <circle cx="14" cy="18" r="1.6" fill="#334155" />
          <circle cx="29" cy="29" r="1.6" fill="#334155" />
        </svg>
      );
    case "runner_std":
    case "runner_blum":
      return (
        <svg viewBox="0 0 72 44" className={cls} fill="none">
          {/* 3D Full-Extension Telescopic Drawer Runner Pair */}
          <polygon points="8,29 54,9 60,12 14,32" fill="#CBD5E1" stroke="#475569" strokeWidth="1.4" />
          <polygon points="14,34 60,14 65,17 19,37" fill="#94A3B8" stroke="#334155" strokeWidth="1.4" />
          <line x1="16" y1="27" x2="52" y2="12" stroke="#F8FAFC" strokeWidth="1.2" />
          {kind === "runner_blum" && (
            <rect x="22" y="25" width="10" height="3.2" rx="1" transform="rotate(-23 22 25)" fill="#FF5500" />
          )}
        </svg>
      );
    case "sliding_top":
      return (
        <svg viewBox="0 0 72 44" className={cls} fill="none">
          {/* Top-Hung Sliding Track & Twin Roller Damper Carriage */}
          <polygon points="8,30 60,10 64,14 12,34" fill="#94A3B8" stroke="#334155" strokeWidth="1.5" />
          <circle cx="24" cy="22" r="4" fill="#E2E8F0" stroke="#1E293B" strokeWidth="1.5" />
          <circle cx="46" cy="14" r="4" fill="#E2E8F0" stroke="#1E293B" strokeWidth="1.5" />
          <rect x="20" y="24" width="12" height="5" rx="1" transform="rotate(-21 20 24)" fill="#334155" />
        </svg>
      );
    case "folding_wingline":
      return (
        <svg viewBox="0 0 72 44" className={cls} fill="none">
          {/* Bi-Fold Wardrobe Door Mechanism (WingLine L) */}
          <polygon points="14,8 38,6 38,36 14,38" fill="#E2E8F0" stroke="#475569" strokeWidth="1.4" />
          <polygon points="38,6 48,14 48,40 38,36" fill="#CBD5E1" stroke="#334155" strokeWidth="1.4" />
          <polygon points="48,14 58,9 58,35 48,40" fill="#94A3B8" stroke="#334155" strokeWidth="1.4" />
          <line x1="14" y1="7" x2="58" y2="8" stroke="#1E293B" strokeWidth="2.5" />
        </svg>
      );
    case "lift_aventos":
      return (
        <svg viewBox="0 0 72 44" className={cls} fill="none">
          {/* Upward Lift-Stay / Bi-Fold Mechanism (AVENTOS HF / HK) */}
          <polygon points="14,12 46,8 46,34 14,38" fill="#F1F5F9" stroke="#64748B" strokeWidth="1.3" />
          <polygon points="46,8 62,3 58,18 42,22" fill="#E2E8F0" stroke="#334155" strokeWidth="1.5" />
          <path d="M24,22 L38,16 L52,14" stroke="#FF5500" strokeWidth="2.2" strokeLinecap="round" />
          <rect x="20" y="19" width="8" height="6" rx="1" fill="#334155" />
        </svg>
      );
    case "led_recessed":
      return (
        <svg viewBox="0 0 72 44" className={cls} fill="none">
          {/* Warm 3000K/4000K Recessed Aluminum LED Strip Profile */}
          <rect x="6" y="6" width="60" height="32" rx="5" fill="#FDE68A" fillOpacity="0.35" />
          <polygon points="8,28 64,12 66,17 10,33" fill="#F59E0B" />
          <line x1="9" y1="30" x2="65" y2="14" stroke="#FFFBEB" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      );
    case "handle_bar":
      return (
        <svg viewBox="0 0 72 44" className={cls} fill="none">
          <line x1="18" y1="26" x2="18" y2="33" stroke="#334155" strokeWidth="3.5" strokeLinecap="round" />
          <line x1="54" y1="14" x2="54" y2="21" stroke="#334155" strokeWidth="3.5" strokeLinecap="round" />
          <line x1="10" y1="29" x2="62" y2="11" stroke="#1E293B" strokeWidth="5" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 72 44" className={cls} fill="none">
          <ellipse cx="14" cy="22" rx="4" ry="6" fill="#94A3B8" stroke="#334155" strokeWidth="1.5" />
          <line x1="14" y1="22" x2="58" y2="22" stroke="#64748B" strokeWidth="4" strokeLinecap="round" />
          <ellipse cx="58" cy="22" rx="4" ry="6" fill="#CBD5E1" stroke="#334155" strokeWidth="1.5" />
        </svg>
      );
  }
}


function renderMaterialSwatchBox(
  mat: import("@birim/core").MaterialDefinition,
  size: "sm" | "md" | "lg" = "md",
  grainDir: "lengthwise" | "crosswise" | "custom" = "lengthwise"
) {
  const cls =
    size === "sm"
      ? "w-10 h-10 rounded-xl"
      : size === "lg"
      ? "w-full h-16 rounded-xl"
      : "w-14 h-12 rounded-xl";

  return (
    <div
      className={`${cls} border border-stone-300/90 shadow-inner relative overflow-hidden shrink-0`}
      data-material-swatch="true" style={getMaterialSwatchStyle(mat)}
    >
      {(mat.category === "wood" || (mat.category === "laminate" && mat.hasGrain)) && (
        <svg
          viewBox="0 0 60 60"
          className="absolute inset-0 w-full h-full opacity-30 pointer-events-none"
          style={{
            transform:
              grainDir === "crosswise"
                ? "rotate(90deg)"
                : grainDir === "custom"
                ? "rotate(45deg)"
                : "none",
          }}
        >
          <path
            d="M8 0 Q12 30 8 60 M18 0 Q24 28 18 60 M30 0 Q25 32 30 60 M42 0 Q48 26 42 60 M52 0 Q49 30 52 60"
            fill="none"
            stroke="#2C1810"
            strokeWidth="1.4"
          />
        </svg>
      )}
      {mat.category === "stone" && (
        <svg
          viewBox="0 0 60 60"
          className="absolute inset-0 w-full h-full opacity-35 pointer-events-none"
        >
          <path
            d="M0 14 Q24 22 60 8 M10 54 Q32 34 60 44"
            fill="none"
            stroke="#64748B"
            strokeWidth="1.5"
          />
        </svg>
      )}
    </div>
  );
}

function renderVariationMiniWardrobeSvg(doorHex: string, bodyHex: string) {
  return (
    <svg viewBox="0 0 76 62" className="w-16 h-14 shrink-0" fill="none">
      {/* Outer Carcass Side/Top Frame */}
      <polygon points="10,8 66,8 66,56 10,56" fill={bodyHex} stroke="#475569" strokeWidth="1.5" />
      {/* 4 Door Leaves + 2 Bottom Drawers */}
      <rect x="12" y="10" width="12.5" height="42" fill={doorHex} stroke="#334155" strokeWidth="1" />
      <rect x="25" y="10" width="12.5" height="30" fill={doorHex} stroke="#334155" strokeWidth="1" />
      <rect x="38" y="10" width="12.5" height="30" fill={doorHex} stroke="#334155" strokeWidth="1" />
      <rect x="51" y="10" width="13" height="42" fill={doorHex} stroke="#334155" strokeWidth="1" />
      {/* 2 Middle Drawers */}
      <rect x="25" y="40.5" width="25.5" height="5.5" fill={doorHex} stroke="#334155" strokeWidth="1" />
      <rect x="25" y="46.5" width="25.5" height="5.5" fill={doorHex} stroke="#334155" strokeWidth="1" />
      {/* Plinth */}
      <rect x="11" y="52.5" width="54" height="3" fill={bodyHex} stroke="#475569" strokeWidth="0.9" />
      {/* Handles */}
      <line x1="22" y1="26" x2="22" y2="33" stroke="#1E293B" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="35" y1="24" x2="35" y2="30" stroke="#1E293B" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="40.5" y1="24" x2="40.5" y2="30" stroke="#1E293B" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="53.5" y1="26" x2="53.5" y2="33" stroke="#1E293B" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export const V3UnifiedWorkspace: React.FC<{
  initialMode?: V3WorkspaceMode;
}> = ({ initialMode = "studio" }) => {
  const [priceCurrency, setPriceCurrency] = useState<"TRY" | "EUR">("TRY");
  const eurToTryRate = 41.8;
  const {
    project,
    activeModule,
    activeModuleIndex,
    setActiveModuleIndex,
    activeBay,
    activeBayIndex,
    setActiveBayIndex,
    doorOpenAngleDeg,
    setDoorOpenAngleDeg,
    drawerOpenMm,
    setDrawerOpenMm,
    toggleDoorOpen,
    cameraPreset,
    setCameraPreset,
    validationIssues,
    v4CompatibilityReport,
    unifiedEngineeringReport,
    ergonomicProfileId,
    setErgonomicProfileId,
    applyApprovedEngineeringFix,
    regionalErgonomicProfiles,
    fourSpaceDimensions,
    spaceWalls,
    bom,
    pricing,
    canUndo,
    canRedo,
    undo,
    redo,
    setDimensions,
    setPlinthHeight,
    setPlinthMaterial,
    setDoorCrossSectionProfile: setModuleDoorCrossSection,
    addCustomMaterialToProject,
    addCustomCapsuleModule,
    setAdjustableLegsEnabled: setModuleAdjustableLegs,
    updateCarcassConfig,
    setSelectedComponentId,
    updateProjectTitle,
    setMaterials,
    setBayCount,
    setBayDoorType,
    setModuleSlidingMountingType,
    flipActiveDoorDirection,
    setBayV4DoorConfig,
    copyDoorConfigToAllBays,
    applyV4Template,
    dropV4TemplateWithSnap,
    selectedSceneObjectId,
    setSelectedSceneObjectId,
    appendModuleWithMultiWallSnap,
    fillWallGapWithParametricModule,
    addCompositeAssemblyPreset,
    saveActiveModuleAsCustomTemplate,
    deleteCustomModuleTemplate,
    addSceneObjectFromCatalog,
    addCustomSceneObject,
    updateSceneObject,
    duplicateSceneObject,
    removeSceneObject,
    runAutoFillersAndCrown,
    runAutoNotchObstacles,
    importRoomPlanLiDARJson,
    applyWardrobeWizard,
    applyBayInteriorPreset,
    restoreModuleBaysSnapshot,
    applyMaterialByTargetScope,
    setModuleMaterialDetails,
    resetModuleMaterialOverrides,
    restoreModuleMaterialSnapshot,
    toggleInteriorItemHidden,
    setShelfThickness,
    equalizeBaysAndShelves,
    addInternalDrawer,
    removeBayAt,
    removeBayAndShrinkModule,
    shrinkDoubleBayToSingle,
    setModuleHingeHardware,
    setModuleDrawerRunnerHardware,
    toggleModuleLedLighting,
    applySmartWallProposal,
    distributeAlongWall,
    autoGenerateKitchenComplementary,
    attachComplementaryToActiveModule,
    applyProjectSegmentPreset,
    applyGuidedWizardLayout,
    v4ModuleFamilies,
    v4ModuleTemplates,
    doorSystemDefinitions,
    handleProfiles,
    openingMechanisms,
    hardwareCatalog,
    drillingTemplates,
    wardrobeWizards,
    libraryAdminStore,
    addShelf,
    removeShelf,
    addDrawer,
    removeDrawer,
    addHangingRail,
    removeHangingRail,
    addSpecialFitting,
    removeSpecialFitting,
    setSpecialFittingPlacement,
    addSubDivider,
    splitBayIntoTwo,
    setSubDividerPlacement,
    removeSubDivider,
    setShelfElevation,
    setDrawerPlacement,
    setHangingRailElevation,
    setBayCustomWidth,
    moveInteriorItemToBay,
    addAdjacentModule,
    duplicateActiveModule,
    removeActiveModule,
    removeModuleAt,
    removeSelectedInteriorComponent,
    deleteActiveSelectionSmart,
    selectedComponentId,
    setSelectedComponentMaterial,
    applyMaterialToSimilarComponents,
    setCountertopMaterial,
    activeBlumEngineering,
    exportBlumBxfString,
    exportAllPanelsDxfString,
    exportNestingDxfString,
    exportErpNestingJsonString,
    exportErpSelcoCsvString,
    importBlumBxfFile,
    applyBlumQuickWizardPreset,
    activeSpatialMetrics,
    alignActiveModuleOnWall,
    distributeModulesWithGap,
    applyRoomShapePreset,
    setAllWallsSettings,
    moveActiveModule,
    rotateActiveModule90,
    snapModuleToAngledWall,
    addKitchenIslandUnit,
    addOrUpdateAttachedTable,
    applyTemplate,
    loadLinearKitchen,
    loadLKitchen,
    loadUKitchen,
    applySmartSpan,
    approveProduction,
    resetToDefault,
    beginHistoryTransaction,
    commitHistoryTransaction,
    setModuleUtilityCutouts,
    autoResolveCornerCollisions,
    cncXrayMode,
    toggleCncXrayMode,
    studioSplitView,
    toggleStudioSplitView,
    autoFixProjectIssues,
    spaceObstacles,
    addInteriorItemAtElevation,
    explodedFactor,
    updateCeilingConfig,
    setFacadeGrainContinuity,
  } = useV3Adapter();

  const experienceTier = useConfiguratorStore((s) => s.userExperienceTier);
  const setExperienceTier = useConfiguratorStore((s) => s.setUserExperienceTier);

  const [mode, setMode] = useState<V3WorkspaceMode>(initialMode);
  const [canvasTheme, setCanvasTheme] = useState<"warm-light" | "dark">("warm-light");
  const [leftOpen, setLeftOpen] = useState(false);
  const [selectedPartMatScope, setSelectedPartMatScope] = useState<"single" | "module_similar" | "project_similar">("single");
  const [leftTab, setLeftTab] = useState<
    "quick_wizard" | "templates" | "interior" | "materials" | "accessories" | "hardware"
  >("quick_wizard");
  const [quickCabinetType, setQuickCabinetType] = useState<
    "base" | "wall" | "tall" | "wardrobe" | "drawers_3" | "corner"
  >("base");
  const [quickCabinetWidth, setQuickCabinetWidth] = useState<number>(600);
  const [quickCabinetHeight, setQuickCabinetHeight] = useState<number>(720);
  const [quickCabinetDepth, setQuickCabinetDepth] = useState<number>(580);
  const [quickFrontType, setQuickFrontType] = useState<
    | "single_door_left"
    | "single_door_right"
    | "double_door"
    | "drawers_2"
    | "drawers_3"
    | "aventos_hf"
    | "space_tower"
    | "open"
  >("double_door");
  const [quickLiveSync, setQuickLiveSync] = useState<boolean>(true);
  const isSimpleBlumMode = experienceTier === "simple";
  const setIsSimpleBlumMode = useCallback(
    (simple: boolean) => {
      setExperienceTier(simple ? "simple" : "architect");
    },
    [setExperienceTier]
  );

  useEffect(() => {
    const onGlobalKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        setShowRulesModal(false);
        setShowAdminModal(false);
        setIsVisualCatalogOpen(false);
        setOpenRightDrawer(null);
        setShowCompatPopover(false);
        setApprovalBanner(null);
        setPendingDeletePrompt(null);
        setHardwareValidationErrorMsg(null);
        setMaterialValidationErrorMsg(null);
      }
    };
    let rangeTxActive = false;
    const onRangePointerDown = (ev: PointerEvent) => {
      const t = ev.target as HTMLInputElement | null;
      if (t && t.tagName === "INPUT" && t.type === "range") {
        // Skip purely visual camera/door angle sliders that don't mutate project history
        if (t.dataset.testid === "showroom-drawer-open-slider") return;
        rangeTxActive = true;
        beginHistoryTransaction();
      }
    };
    const onRangePointerUp = () => {
      if (rangeTxActive) {
        rangeTxActive = false;
        commitHistoryTransaction();
      }
    };
    window.addEventListener("pointerdown", onRangePointerDown, true);
    window.addEventListener("pointerup", onRangePointerUp, true);
    window.addEventListener("pointercancel", onRangePointerUp, true);
    window.addEventListener("keydown", onGlobalKeyDown);
    return () => {
      window.removeEventListener("keydown", onGlobalKeyDown);
      window.removeEventListener("pointerdown", onRangePointerDown, true);
      window.removeEventListener("pointerup", onRangePointerUp, true);
      window.removeEventListener("pointercancel", onRangePointerUp, true);
    };
  }, []);
  const [leftSubCat, setLeftSubCat] = useState<string>("dolap");
  const [openRightDrawer, setOpenRightDrawer] = useState<null | "material" | "handle" | "soket" | "more_menu">(null);
  const [adjustableLegsEnabled, setAdjustableLegsEnabled] = useState<boolean>(true);
  const [studioInspectorTab, setStudioInspectorTab] = useState<
    "all" | "dimensions" | "carcass" | "interior" | "door" | "material"
  >("carcass");
  const [studioRightOpen, setStudioRightOpen] = useState<boolean>(true);
  const [selectedV4Family, setSelectedV4Family] = useState<ModuleFamilyId>("fam_wardrobe");
  const [doorCrossSectionProfile, setDoorCrossSectionProfile] = useState<
    import("@birim/core").DoorCrossSectionProfile
  >("flat_slab");
  const [doorMaterialApplyScope, setDoorMaterialApplyScope] = useState<
    "single_door" | "active_bay" | "all_doors"
  >("active_bay");
  const [doorCompatWarningMsg, setDoorCompatWarningMsg] = useState<string | null>(null);
  const [customCadProfileName, setCustomCadProfileName] = useState<string | null>(null);
  const [showNewSurfaceCreator, setShowNewSurfaceCreator] = useState<boolean>(false);
  const [newSurfName, setNewSurfName] = useState<string>("Özel İtalyan Ceviz / RAL Lake");
  const [newSurfCode, setNewSurfCode] = useState<string>("RAL-7016");
  const [newSurfCat, setNewSurfCat] = useState<"lacquer" | "wood" | "laminate" | "stone" | "metal">("lacquer");
  const [newSurfHex, setNewSurfHex] = useState<string>("#383E42");
  const [newSurfRough, setNewSurfRough] = useState<number>(0.32);
  const [newSurfCost, setNewSurfCost] = useState<number>(78);
  const [newSurfTexUrl, setNewSurfTexUrl] = useState<string>("");
  const [customCadSvgPath, setCustomCadSvgPath] = useState<string | null>(null);
  const [showInspectorInPlan, setShowInspectorInPlan] = useState<boolean>(false);
  const [studioView, setStudioView] = useState<"3d" | "2d">("3d");
  const [studio2DMode, setStudio2DMode] = useState<"elevation" | "section" | "plan">(
    "elevation"
  );
  const [show3DDimensions, setShow3DDimensions] = useState<boolean>(true);
  const [snapMm, setSnapMm] = useState<number>(50);
  const [zenMode, setZenMode] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isBomModalOpen, setIsBomModalOpen] = useState(false);
  const [isStoreErpModalOpen, setIsStoreErpModalOpen] = useState(false);
  const [showAssemblyModal, setShowAssemblyModal] = useState(false);
  const [showStudioRenderModal, setShowStudioRenderModal] = useState(false);
  const [showCustomHardwareModal, setShowCustomHardwareModal] = useState(false);
  const [showIslandTableModal, setShowIslandTableModal] = useState(false);
  const [showMepModal, setShowMepModal] = useState(false);
  const [showSceneHubModal, setShowSceneHubModal] = useState(false);
  const [sceneHubInitialTab, setSceneHubInitialTab] = useState<"modules" | "appliances" | "furniture" | "custom_glb" | "automation">("modules");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const applyHashIfPresent = () => {
      const sharedProj = decodeProjectFromShareHash(window.location.hash);
      if (sharedProj) {
        useConfiguratorStore.setState({ project: sharedProj, activeModuleIndex: 0, activeBayIndex: 0 });
      }
    };
    applyHashIfPresent();
    window.addEventListener("hashchange", applyHashIfPresent);
    return () => window.removeEventListener("hashchange", applyHashIfPresent);
  }, []);
  const [interiorPropsVisible, setInteriorPropsVisible] = useState(true);
  const [customCatalogTick, setCustomCatalogTick] = useState(0);
  void customCatalogTick;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onOpenRender = () => setShowStudioRenderModal(true);
    const onPropsChanged = (ev: Event) => {
      const vis = (ev as CustomEvent<{ visible?: boolean }>).detail?.visible;
      if (typeof vis === "boolean") setInteriorPropsVisible(vis);
    };
    window.addEventListener("birim:open-studio-render-modal", onOpenRender);
    window.addEventListener("birim:interior-props-changed", onPropsChanged);
    return () => {
      window.removeEventListener("birim:open-studio-render-modal", onOpenRender);
      window.removeEventListener("birim:interior-props-changed", onPropsChanged);
    };
  }, []);
  const [bomModalInitialTab, setBomModalInitialTab] = useState<
    "cutlist" | "hardware" | "nesting" | "validation" | "assembly" | "selco" | "cnc_mpr_cix" | "quote" | "blum_bxf"
  >("cutlist");
  const [approvalBanner, setApprovalBanner] = useState<{
    text: string;
    ok: boolean;
  } | null>(null);
  const [pendingDeletePrompt, setPendingDeletePrompt] = useState<{
    kind: "door" | "structural";
    partName: string;
    bayIndex: number;
    canRemoveDoor: boolean;
    canDeleteBay: boolean;
    canShrinkDouble: boolean;
    canDeleteModule: boolean;
    shrunkOuterCm: number;
    halfShrunkOuterCm: number;
  } | null>(null);
  const [adminRefreshTick, setAdminRefreshTick] = useState(0);
  const [newDraftName, setNewDraftName] = useState("Özel V4.2 Dolap Şablonu");
  const [newDraftWidth, setNewDraftWidth] = useState<number>(800);
  const [newDraftHeight, setNewDraftHeight] = useState<number>(720);
  const [newDraftDepth, setNewDraftDepth] = useState<number>(580);
  const [newDraftDoorSys, setNewDraftDoorSys] = useState<DoorSystemId>("hinged_double");
  const [studioLeftWidthPx, setStudioLeftWidthPx] = useState<number>(348);
  const [isVisualCatalogOpen, setIsVisualCatalogOpen] = useState<boolean>(false);
  const [catalogSearchQuery, setCatalogSearchQuery] = useState<string>("");
  const [catalogWidthFilter, setCatalogWidthFilter] = useState<"all" | "narrow" | "medium" | "wide">("all");
  const [catalogViewMode, setCatalogViewMode] = useState<"grid" | "list">("grid");
  const [favoriteTemplateIds, setFavoriteTemplateIds] = useState<string[]>([
    "v4_wd_04_two_door_standard",
    "v4_wd_10_sliding_2door",
    "v4_kb_04_three_drawer",
    "v4_sc_01_l_corner_base",
  ]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState<boolean>(false);
  const [catalogFeatureFilter, setCatalogFeatureFilter] = useState<"all" | "sliding" | "drawer">("all");
  const [doorsHiddenStudio, setDoorsHiddenStudio] = useState<boolean>(false);
  const [showAdvancedCncLevel, setShowAdvancedCncLevel] = useState<boolean>(false);
  const [showCompatPopover, setShowCompatPopover] = useState<boolean>(false);
  const [interiorPreviewBanner, setInteriorPreviewBanner] = useState<null | {
    templateName: string;
    bayIndex: number;
    snapshotBays: import("@birim/core").BayConfig[];
  }>(null);
  const [interiorLibSearch, setInteriorLibSearch] = useState<string>("");
  const [interiorLibCat, setInteriorLibCat] = useState<
    "all" | "raf" | "dikme" | "askilik" | "cekmece" | "pantolonluk" | "ayakkabilik" | "kravatlik" | "kemerlik"
  >("all");
  const [editingInteriorItemId, setEditingInteriorItemId] = useState<string | null>(null);
  const [autoEqualSpacingEnabled, setAutoEqualSpacingEnabled] = useState<boolean>(true);
  const [showMoreInteriorAddGrid, setShowMoreInteriorAddGrid] = useState<boolean>(false);
  const [hardwareLibSearch, setHardwareLibSearch] = useState<string>("");
  const [hardwareLibCat, setHardwareLibCat] = useState<
    "all" | "hinge" | "runner" | "opening" | "lighting" | "handle" | "interior_acc"
  >("all");
  const [hardwareLibOnlyCompatible, setHardwareLibOnlyCompatible] = useState<boolean>(false);
  const [expandedHwGroup, setExpandedHwGroup] = useState<
    null | "hinge" | "runner" | "lighting" | "accessories" | "technical"
  >(null);
  const [hardwareValidationErrorMsg, setHardwareValidationErrorMsg] = useState<string | null>(null);
  const [materialLibSearch, setMaterialLibSearch] = useState<string>("");
  const [materialLibCat, setMaterialLibCat] = useState<
    "all" | "suntalam" | "mdf" | "lacquer" | "wood" | "glass_mirror" | "stone"
  >("all");
  const [materialLibOnlyGrain, setMaterialLibOnlyGrain] = useState<boolean>(false);
  const [materialTargetScope, setMaterialTargetScope] = useState<
    | "all_module"
    | "carcass"
    | "doors"
    | "drawers"
    | "plinth"
    | "back"
    | "countertop"
    | "selected_part"
    | "same_material_parts"
  >("doors");
  const [materialValidationErrorMsg, setMaterialValidationErrorMsg] = useState<string | null>(null);
  const [materialVariationPreview, setMaterialVariationPreview] = useState<null | {
    variationId: string;
    variationName: string;
    snapshot: {
      carcass: import("@birim/core").CarcassConfig;
      bays: import("@birim/core").BayConfig[];
      componentMaterialOverrides?: Record<string, string>;
      componentGrainOverrides?: Record<string, "lengthwise" | "crosswise" | "custom">;
      surfaceFinishOverride?: "matte" | "satin" | "gloss";
      edgeBandMaterialId?: string;
    };
  }>(null);
  const [showroomMaterialPreview, setShowroomMaterialPreview] = useState<null | {
    label: string;
    snapshot: {
      carcass: import("@birim/core").CarcassConfig;
      bays: import("@birim/core").BayConfig[];
      componentMaterialOverrides?: Record<string, string>;
    };
  }>(null);
  const [studioRightWidthPx, setStudioRightWidthPx] = useState<number>(396);
  const [planLeftWidthPx, setPlanLeftWidthPx] = useState<number>(330);
  const [planSplitRatioPct, setPlanSplitRatioPct] = useState<number>(58);
  const [resizingPanel, setResizingPanel] = useState<
    "studio-left" | "studio-right" | "plan-left" | "plan-split" | null
  >(null);
  const [planRightView, setPlanRightView] = useState<
    "3d-iso" | "3d-front" | "3d-side" | "3d-top" | "2d-elevation" | "2d-section"
  >("3d-iso");
  const [planLeftOpen, setPlanLeftOpen] = useState<boolean>(true);
  const [planLeftRailTab, setPlanLeftRailTab] = useState<
    "mekan" | "moduller" | "olcu" | "katmanlar" | "gorunum" | "dxf" | "ayarlar"
  >("mekan");
  const [planLeftWorkflowTab, setPlanLeftWorkflowTab] = useState<
    "wall_structure" | "furniture_placement"
  >("wall_structure");
  const [planActiveDrawingTool, setPlanActiveDrawingTool] = useState<
    "select" | "wall" | "room" | "partition" | "door" | "window" | "niche" | "column" | "beam" | "protrusion"
  >("wall");
  const [planRoomShapePreset, setPlanRoomShapePreset] = useState<
    "rectangular" | "l_shape" | "u_shape"
  >("rectangular");
  const [planTopAlignMenuOpen, setPlanTopAlignMenuOpen] = useState<boolean>(false);
  const [planTopDistributeMenuOpen, setPlanTopDistributeMenuOpen] = useState<boolean>(false);
  const [planViewLayout, setPlanViewLayout] = useState<"split" | "2d_only" | "3d_only">("split");
  const [planEditingModuleDims, setPlanEditingModuleDims] = useState<boolean>(false);
  const [planShowQuickControls, setPlanShowQuickControls] = useState<boolean>(false);
  const [planModDropdownOpen, setPlanModDropdownOpen] = useState<boolean>(false);
  const [isCompactViewport, setIsCompactViewport] = useState<boolean>(false);
  const splitDragStartRef = useRef<{ startX: number; startPct: number; containerW: number } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleViewportCheck = () => {
      setIsCompactViewport(window.innerWidth < 1180);
    };
    handleViewportCheck();
    window.addEventListener("resize", handleViewportCheck);
    return () => window.removeEventListener("resize", handleViewportCheck);
  }, []);

  const dispatchPlanToolAction = (detail: Record<string, unknown>) => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("birim:plan-tool-action", { detail }));
    }
  };

  useEffect(() => {
    if (!resizingPanel) return;
    const onMouseMove = (ev: MouseEvent) => {
      if (resizingPanel === "studio-left") {
        setStudioLeftWidthPx(Math.max(360, Math.min(640, ev.clientX - 14)));
      } else if (resizingPanel === "plan-left") {
        setPlanLeftWidthPx(Math.max(240, Math.min(540, ev.clientX - 12)));
      } else if (resizingPanel === "studio-right") {
        setStudioRightWidthPx(
          Math.max(320, Math.min(560, window.innerWidth - ev.clientX - 14))
        );
      } else if (resizingPanel === "plan-split") {
        const dragState = splitDragStartRef.current;
        if (dragState) {
          const deltaX = ev.clientX - dragState.startX;
          const deltaPct = (deltaX / Math.max(320, dragState.containerW)) * 100;
          const nextPct = Math.round(dragState.startPct + deltaPct);
          setPlanSplitRatioPct(Math.max(22, Math.min(78, nextPct)));
        } else {
          const pct = Math.round(
            (ev.clientX / Math.max(1, window.innerWidth)) * 100
          );
          setPlanSplitRatioPct(Math.max(22, Math.min(78, pct)));
        }
      }
    };
    const onMouseUp = () => {
      splitDragStartRef.current = null;
      setResizingPanel(null);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [resizingPanel]);

  useEffect(() => {
    const onViewChange = (ev: Event) => {
      const detail = (ev as CustomEvent<string>).detail;
      startTransition(() => {
        if (detail === "2d-elevation") {
          setMode("studio");
          setStudioView("2d");
          setStudio2DMode("elevation");
        } else if (detail === "2d-section") {
          setMode("studio");
          setStudioView("2d");
          setStudio2DMode("section");
        } else if (detail === "2d-plan") {
          setMode("studio");
          setStudioView("2d");
          setStudio2DMode("plan");
        } else if (detail === "3d") {
          setMode("studio");
          setStudioView("3d");
        } else if (detail === "plan") {
          setMode("plan");
        }
      });
    };
    const onToggleInterior = () => {
      toggleDoorOpen();
    };
    const onToggleDrawer = () => {
      setDrawerOpenMm(drawerOpenMm > 10 ? 0 : 280);
    };
    const onDeleteActive = () => {
      const res = deleteActiveSelectionSmart();
      if (res.action === "prompt") {
        setPendingDeletePrompt(res);
      } else {
        setPendingDeletePrompt(null);
        setApprovalBanner({ ok: res.ok, text: res.message });
        setTimeout(() => setApprovalBanner(null), 2800);
      }
    };
    const onSelectBay3D = (ev: Event) => {
      const detail = (ev as CustomEvent<{ bayIndex: number; role: string }>).detail;
      if (detail && typeof detail.bayIndex === "number") {
        setActiveBayIndex(detail.bayIndex);
        setStudioInspectorTab("interior");
      }
    };
    const onSelectDoor3D = (ev: Event) => {
      const detail = (ev as CustomEvent<{ bayIndex: number; componentId?: string }>).detail;
      if (detail && typeof detail.bayIndex === "number") {
        setActiveBayIndex(detail.bayIndex);
        setStudioInspectorTab("door");
      }
    };
    const onSelectHardware3D = (ev: Event) => {
      const detail = (
        ev as CustomEvent<{
          pinId: string;
          group: "hinge" | "runner" | "lighting" | "accessories";
          bayIndex: number;
          sku?: string;
        }>
      ).detail;
      if (detail) {
        if (typeof detail.bayIndex === "number") {
          setActiveBayIndex(detail.bayIndex);
        }
        setStudioInspectorTab("all");
        setExpandedHwGroup(detail.group);
      }
    };
    window.addEventListener("birim:select-bay-3d", onSelectBay3D);
    window.addEventListener("birim:select-door-3d", onSelectDoor3D);
    const onSelectMaterialPart3D = (ev: Event) => {
      const detail = (
        ev as CustomEvent<{
          componentId: string;
          scope:
            | "all_module"
            | "carcass"
            | "doors"
            | "drawers"
            | "plinth"
            | "back"
            | "selected_part";
          title?: string;
        }>
      ).detail;
      if (detail) {
        setStudioInspectorTab("material");
        setMaterialTargetScope(detail.scope || "selected_part");
      }
    };
    window.addEventListener("birim:select-hardware-3d", onSelectHardware3D);
    window.addEventListener("birim:select-material-part-3d", onSelectMaterialPart3D);
    window.addEventListener("birim:studio-view-change", onViewChange);
    window.addEventListener("birim:toggle-interior-view", onToggleInterior);
    window.addEventListener("birim:toggle-drawer-open", onToggleDrawer);
    window.addEventListener("birim:delete-active-selection", onDeleteActive);
    return () => {
      window.removeEventListener("birim:select-bay-3d", onSelectBay3D);
      window.removeEventListener("birim:select-door-3d", onSelectDoor3D);
      window.removeEventListener("birim:select-hardware-3d", onSelectHardware3D);
      window.removeEventListener("birim:select-material-part-3d", onSelectMaterialPart3D);
      window.removeEventListener("birim:studio-view-change", onViewChange);
      window.removeEventListener("birim:toggle-interior-view", onToggleInterior);
      window.removeEventListener("birim:toggle-drawer-open", onToggleDrawer);
      window.removeEventListener("birim:delete-active-selection", onDeleteActive);
    };
  }, [toggleDoorOpen, deleteActiveSelectionSmart]);

  useEffect(() => {
    if (mode === "plan") return;
    const onKeyDown = (ev: KeyboardEvent) => {
      const tag = (ev.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "z") {
        ev.preventDefault();
        if (ev.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "y") {
        ev.preventDefault();
        redo();
      } else if (ev.key === "Delete" || ev.key === "Backspace") {
        ev.preventDefault();
        const res = deleteActiveSelectionSmart();
        if (res.action === "prompt") {
          setPendingDeletePrompt(res);
        } else {
          setPendingDeletePrompt(null);
          setApprovalBanner({ ok: res.ok, text: res.message });
          setTimeout(() => setApprovalBanner(null), 2800);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    mode,
    undo,
    redo,
    deleteActiveSelectionSmart,
  ]);

  // V4 Showroom Hızlı Satış, Oto-Dizilim, 3'lü Bütçe Paketi ve Müşteri Teklif Föyü Durumları
  useEffect(() => {
    setPendingDeletePrompt(null);
  }, [selectedComponentId, activeModuleIndex, activeBayIndex]);

  const [showQuickSellModal, setShowQuickSellModal] = useState(false);
  const [showArAnd3DModal, setShowArAnd3DModal] = useState(false);
  const [armedTapItem, setArmedTapItem] = useState<TapToPlaceItemSpec | null>(null);

  // V4 5-Adımda Kolay Tasarım Sihirbazı (Step-by-Step Guided Wizard) Durumları
  const [showStepWizardModal, setShowStepWizardModal] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [wizSpaceCategory, setWizSpaceCategory] = useState<"wardrobe" | "walkin" | "kitchen" | "living">("wardrobe");
  const [wizRoomShape, setWizRoomShape] = useState<"rectangular" | "l_shape" | "u_shape">("rectangular");
  const [wizWallWidthMm, setWizWallWidthMm] = useState<number>(3600);
  const [wizTargetHeightMm, setWizTargetHeightMm] = useState<number>(2400);
  const [wizTargetDepthMm, setWizTargetDepthMm] = useState<number>(600);
  const [wizAutoFiller50Mm, setWizAutoFiller50Mm] = useState<boolean>(true);
  const [wizInteriorFocus, setWizInteriorFocus] = useState<"hanging" | "balanced" | "shelves">("balanced");
  const [wizDoorStyle, setWizDoorStyle] = useState<"hinged" | "sliding" | "glass" | "open">("hinged");
  const [wizConceptTier, setWizConceptTier] = useState<"eco" | "smart" | "signature">("smart");
  const [wizColorSwatch, setWizColorSwatch] = useState<"cashmere" | "white" | "oak" | "walnut" | "anthracite">("cashmere");
  const [wizAddLed, setWizAddLed] = useState<boolean>(true);
  const [wizAddTrouserRack, setWizAddTrouserRack] = useState<boolean>(true);
  const [wizAddJewelryTray, setWizAddJewelryTray] = useState<boolean>(false);
  const [quoteDiscountPct, setQuoteDiscountPct] = useState<number>(10);
  const [quoteInstallments, setQuoteInstallments] = useState<number>(6);
  const [activeConceptTier, setActiveConceptTier] = useState<"eco" | "smart" | "signature">("smart");
  const [copiedWhatsappQuote, setCopiedWhatsappQuote] = useState(false);

  const handleToggle3DDimensions = useCallback(() => {
    setShow3DDimensions((prev) => !prev);
  }, []);

  const viewportSafeInsets = useMemo(() => {
    if (mode === "studio") {
      return {
        topPx: 64,
        bottomPx: 66,
        leftPx: studioSplitView
          ? 14
          : leftOpen && !isCompactViewport
          ? Math.min(studioLeftWidthPx, 460) + 28
          : 82,
        rightPx:
          studioRightOpen && !isCompactViewport
            ? studioRightWidthPx + 28
            : 18,
      };
    }
    if (mode === "showroom" && !zenMode) {
      return { topPx: 66, bottomPx: 72, leftPx: 20, rightPx: 84 };
    }
    return undefined;
  }, [
    mode,
    studioSplitView,
    leftOpen,
    isCompactViewport,
    studioLeftWidthPx,
    studioRightOpen,
    studioRightWidthPx,
    zenMode,
  ]);

  const cad2DSafeInsets = useMemo(() => {
    if (mode !== "studio") return undefined;
    return {
      topPx: 58,
      bottomPx: 66,
      leftPx: leftOpen
        ? isCompactViewport
          ? 84
          : Math.min(studioLeftWidthPx, 460) + 28
        : 84,
      rightPx: studioSplitView
        ? 16
        : studioRightOpen && !isCompactViewport
        ? Math.min(520, Math.max(376, studioRightWidthPx)) + 28
        : 64,
    };
  }, [
    mode,
    leftOpen,
    isCompactViewport,
    studioLeftWidthPx,
    studioSplitView,
    studioRightOpen,
    studioRightWidthPx,
  ]);

  // Canlı Müşteri Depolama Kapasitesi ve Gerçek BOM/Nesting Plaka & Kenar Bandı Özeti
  const liveCustomerAndFactoryStats = useMemo(() => {
    let hangerWidthMm = 0;
    let shelfAreaM2 = 0;
    let drawerCount = 0;

    project.modules.forEach((m) => {
      if (m.category === "complementary") return;
      const w = m.dimensions.width;
      const d = m.dimensions.depth;
      const T = m.carcass?.panelThickness || 18;
      const bays = m.bays || [];
      const bayCount = Math.max(1, bays.length);
      const bayW = Math.max(120, (w - (bayCount + 1) * T) / bayCount);

      bays.forEach((b) => {
        const rails = b.hangingRails?.length || 0;
        const shelves = b.shelves?.length || 0;
        const drawers = b.drawers?.length || 0;
        hangerWidthMm += rails * bayW;
        shelfAreaM2 += ((shelves + 1) * bayW * Math.max(200, d - T)) / 1_000_000;
        drawerCount += drawers;
      });
    });

    const hangingGarments = Math.max(0, Math.round(hangerWidthMm / 34));
    const foldedGarments = Math.max(0, Math.round(shelfAreaM2 * 22));
    const shoePairs = Math.max(
      0,
      Math.round(
        (project.modules
          .filter((m) => m.category !== "complementary")
          .reduce((s, m) => s + m.dimensions.width, 0) /
          240) *
          2
      )
    );

    const realPanelAreaM2 = bom?.summary?.totalPanelAreaM2 ?? 0;
    const realEdgeBandMeters = bom?.summary?.totalEdgeBandMeters ?? 0;
    const realNestedSheets =
      bom?.nestingResults && bom.nestingResults.length > 0
        ? bom.nestingResults.reduce((sum, nr) => sum + (nr.totalSheetsCount || 0), 0)
        : project.modules.length === 0
        ? 0
        : Math.max(1, Math.ceil(realPanelAreaM2 / 4.8));

    const mainWallLen = spaceWalls[0]?.length || 3600;
    const mainModules = project.modules.filter((m) => m.category !== "complementary");
    const usedWallLen = mainModules.reduce(
      (acc, m) => Math.max(acc, (m.position?.x || 0) + m.dimensions.width),
      0
    );
    const totalModWidth = mainModules.reduce((acc, m) => acc + m.dimensions.width, 0);
    const remainingWallGapMm = Math.max(0, Math.round(mainWallLen - totalModWidth));
    const leftFillerMm = Math.min(100, Math.max(0, Math.round(mainModules[0]?.position?.x ?? 0)));
    const rightFillerMm = Math.max(0, Math.round(mainWallLen - usedWallLen));

    return {
      hangingGarments,
      foldedGarments,
      drawerCount,
      shoePairs,
      totalPanelAreaM2: Math.round(realPanelAreaM2 * 10) / 10,
      sheetCount2800x2070: realNestedSheets,
      edgeBandingMeters: Math.round(realEdgeBandMeters),
      mainWallLen,
      totalModWidth,
      remainingWallGapMm,
      leftFillerMm,
      rightFillerMm,
    };
  }, [project.modules, spaceWalls, bom]);

  // 30 Saniyede Akıllı Duvar Otomatik Doldurma (%100 Çakışmasız Atomik Yerleşim)
  const handleSmartWallAutoFill = useCallback(
    (preset: "wardrobe_max" | "his_hers" | "kitchen_smart" | "zero_gap_filler") => {
      const wallLen = spaceWalls[0]?.length || 3600;
      if (preset === "zero_gap_filler") {
        distributeAlongWall();
        setApprovalBanner({
          text: `📏 Duvar (${wallLen}mm) üzerindeki modüller çakışmasız şekilde sıfır boşlukla hizalandı.`,
          ok: true,
        });
        setTimeout(() => setApprovalBanner(null), 4500);
        return;
      }

      applyGuidedWizardLayout({
        spaceCategory:
          preset === "kitchen_smart"
            ? "kitchen"
            : preset === "his_hers"
            ? "walkin"
            : "wardrobe",
        roomShape: "rectangular",
        wallWidthMm: wallLen,
        targetHeightMm: preset === "kitchen_smart" ? 900 : 2400,
        targetDepthMm: preset === "kitchen_smart" ? 580 : 600,
        autoFiller50Mm: true,
        interiorFocus: preset === "wardrobe_max" ? "hanging" : "balanced",
        doorStyle: preset === "his_hers" ? "sliding" : "hinged",
        conceptTier: activeConceptTier,
        colorSwatchId: "cashmere",
        addLed: true,
        addTrouserRack: preset !== "kitchen_smart",
        addJewelryTray: preset === "his_hers",
      });

      setApprovalBanner({
        text: `✨ ${wallLen / 10} cm duvar için çakışmasız (2×5 cm kör çıtalı) otomatik dizilim oluşturuldu!`,
        ok: true,
      });
      setTimeout(() => setApprovalBanner(null), 4500);
    },
    [spaceWalls, distributeAlongWall, applyGuidedWizardLayout, activeConceptTier]
  );

    // 3'lü Bütçe & İç Mimari Konsept Paketi Uygulayıcı (Ekonomik / Smart / Signature)
  const handleApplyConceptTier = useCallback(
    (tier: "eco" | "smart" | "signature") => {
      setActiveConceptTier(tier);
      if (tier === "eco") {
        applyProjectSegmentPreset("economy");
        toggleModuleLedLighting(false);
      } else if (tier === "smart") {
        applyProjectSegmentPreset("standard");
        toggleModuleLedLighting(true, {
          ledType: "led_vertical_strip",
          colorTempK: 3000,
          sensorType: "ir_door",
        });
      } else {
        applyProjectSegmentPreset("premium");
        toggleModuleLedLighting(true, {
          ledType: "led_vertical_strip",
          colorTempK: 3000,
          sensorType: "ir_door",
        });
      }
      const label =
        tier === "eco"
          ? "Essential Seri (18mm MDFLam + Standart Donanım)"
          : tier === "smart"
            ? "Studio Seri (Supramat İpek Mat + Blum Frenli + 3000K İç LED)"
            : "Signature Seri (Doğal Meşe/Ceviz Kaplama + Füme Cam + Tam Donanım)";
      setApprovalBanner({ text: `${label} tüm modüllere uygulandı.`, ok: true });
      setTimeout(() => setApprovalBanner(null), 4000);
    },
    [applyProjectSegmentPreset, toggleModuleLedLighting]
  );

  // Fabrika 32mm Menteşe Deliği & Raf Çakışması Otomatik Düzeltici
  const handleFix32mmHingeShelfCollisions = useCallback(() => {
    equalizeBaysAndShelves();
    setApprovalBanner({
      text: "Tüm iç raf ve çekmece kotları System 32 delik aksına hizalandı.",
      ok: true,
    });
    setTimeout(() => setApprovalBanner(null), 4000);
  }, [equalizeBaysAndShelves]);

  // Tek Sayfa Görsel Müşteri Sunum & Teklif PDF'i (3D Stüdyo + 2D Tüm-Modül İç Cephe Şeması + Gerçek Malzeme Adları)
  const handlePrintVisualCustomerPresentation = useCallback(
    (meta?: { clientName?: string; projectNote?: string; snapshotDataUrl?: string }) => {
      if (typeof window === "undefined") return;
      let snapshot3DDataUrl = meta?.snapshotDataUrl || "";
      try {
        const winCap = (
          window as unknown as {
            __birimCapture3DSnapshot?: (opts?: {
              angle?: "current" | "iso" | "front";
              hideOverlays?: boolean;
            }) => string;
          }
        ).__birimCapture3DSnapshot;
        if (!snapshot3DDataUrl && typeof winCap === "function") {
          snapshot3DDataUrl = winCap({ angle: "iso", hideOverlays: true });
        } else {
          const canvasEl = document.querySelector("canvas") as HTMLCanvasElement | null;
          if (canvasEl) {
            snapshot3DDataUrl = canvasEl.toDataURL("image/png");
          }
        }
      } catch {
        // ignore cross-origin or context loss
      }

      const matNameById = new Map(DEFAULT_MATERIALS.map((m) => [m.id, m.name.split(" (")[0]]));
      const mainMods = project.modules.filter((m) => m.category !== "complementary");
      const maxH = mainMods.length > 0 ? Math.max(...mainMods.map((m) => m.dimensions.height)) : 2200;
      const spanW = Math.max(
        liveCustomerAndFactoryStats.totalModWidth + 160,
        ...mainMods.map((m) => (m.position?.x || 0) + m.dimensions.width + 80),
        1200
      );

      const netTotal = (pricing.totalWithVatEur * (1 - quoteDiscountPct / 100)).toLocaleString(
        "tr-TR",
        { minimumFractionDigits: 2, maximumFractionDigits: 2 }
      );
      const monthlyPay = (
        (pricing.totalWithVatEur * (1 - quoteDiscountPct / 100)) /
        Math.max(1, quoteInstallments)
      ).toLocaleString("tr-TR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

      const elevModulesSvg = mainMods
        .map((m, idx) => {
          const mx = m.position?.x || 0;
          const mw = m.dimensions.width;
          const mh = m.dimensions.height;
          const my = maxH - (m.position?.y || 0) - mh;
          const T = m.carcass.panelThickness || 18;
          const plinthH = m.carcass.plinthHeight ?? 80;
          const innerBottomY = my + mh - plinthH - T;
          const innerH = Math.max(200, mh - plinthH - 2 * T);
          const bayCount = Math.max(1, m.bays?.length || 1);
          const bw = Math.round((mw - (bayCount + 1) * T) / bayCount);
          const baysMarkup = (m.bays || [])
            .map((bay, bIdx) => {
              const bx = mx + T + bIdx * (bw + T);
              const divLine =
                bIdx > 0
                  ? `<rect x="${bx - T}" y="${my + T}" width="${T}" height="${innerH}" fill="#E5E0D5" stroke="#44403C" stroke-width="2" />`
                  : "";
              const shelves = (bay.shelves || [])
                .map(
                  (sh) =>
                    `<rect x="${bx}" y="${innerBottomY - sh.elevationY - T}" width="${bw}" height="${T}" fill="#D6C7B2" stroke="#57534E" stroke-width="2" />`
                )
                .join("");
              const rails = (bay.hangingRails || [])
                .map(
                  (rl) =>
                    `<line x1="${bx + 8}" y1="${innerBottomY - rl.elevationY}" x2="${bx + bw - 8}" y2="${innerBottomY - rl.elevationY}" stroke="#78716C" stroke-width="6" />`
                )
                .join("");
              const drawers = (bay.drawers || [])
                .map(
                  (dr) =>
                    `<rect x="${bx + 3}" y="${innerBottomY - dr.elevationY - dr.height + 2}" width="${Math.max(20, bw - 6)}" height="${Math.max(20, dr.height - 4)}" fill="#F4F1EA" stroke="#57534E" stroke-width="2.5" />`
                )
                .join("");
              return `${divLine}${shelves}${rails}${drawers}`;
            })
            .join("");

          return `
            <g>
              <rect x="${mx}" y="${my}" width="${mw}" height="${mh}" fill="#FFFFFF" stroke="#141413" stroke-width="5" />
              ${plinthH > 0 ? `<rect x="${mx + T}" y="${my + mh - plinthH}" width="${Math.max(40, mw - 2 * T)}" height="${plinthH}" fill="#ECE8DF" stroke="#57534E" stroke-width="2.5" />` : ""}
              ${baysMarkup}
              <text x="${mx + mw / 2}" y="${my - 28}" text-anchor="middle" fill="#141413" font-size="38" font-weight="700" font-family="monospace">${Math.round(mw / 10)} cm</text>
              <text x="${mx + mw / 2}" y="${my + mh + 52}" text-anchor="middle" fill="#57534E" font-size="34" font-weight="600" font-family="sans-serif">#0${idx + 1}</text>
            </g>`;
        })
        .join("");

      const elevSvgMarkup = `
        <svg viewBox="-80 -110 ${spanW + 140} ${maxH + 220}" style="width:100%;height:215px;background:#F7F5F0;border-radius:10px;border:1px solid #E5E0D5;">
          <line x1="-40" y1="${maxH}" x2="${spanW}" y2="${maxH}" stroke="#78716C" stroke-width="5" />
          ${elevModulesSvg}
        </svg>
      `;

      const tierLabel =
        activeConceptTier === "eco"
          ? "Essential Seri"
          : activeConceptTier === "signature"
          ? "Signature Seri"
          : "Studio Seri";

      const printHtml = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<title>B1R1M — Mimari Sunum & Teklif Föyü (${escapeHtmlPrint(project.title)})</title>
<style>
  @page { size: A4 portrait; margin: 13mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif; color: #141413; background: #FFFFFF; margin: 0; padding: 0; }
  .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 1.5px solid #141413; padding-bottom: 12px; margin-bottom: 16px; }
  .brand { font-size: 24px; font-weight: 900; letter-spacing: 0.2em; color: #141413; }
  .sub { font-size: 10px; color: #78716C; text-transform: uppercase; letter-spacing: 0.14em; margin-top: 3px; }
  .visual-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
  .card { border: 1px solid #E5E0D5; border-radius: 10px; padding: 10px; background: #FAF9F6; }
  .card-title { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #78716C; margin-bottom: 7px; }
  .cap-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 14px; }
  .cap-pill { border: 1px solid #E5E0D5; border-radius: 8px; padding: 8px 10px; background: #FAF9F6; }
  .cap-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; color: #78716C; }
  .cap-val { font-size: 12px; font-weight: 700; color: #141413; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 10.5px; }
  th, td { border-bottom: 1px solid #EAE6DC; padding: 7px 8px; text-align: left; }
  th { background: #F4F1EA; font-weight: 700; text-transform: uppercase; font-size: 9.5px; letter-spacing: 0.08em; color: #57534E; }
  .quote-footer { display: flex; justify-content: space-between; align-items: center; background: #141413; color: #FAF9F6; padding: 16px 20px; border-radius: 10px; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">B1R1M</div>
      <div class="sub">Mimari Tasarım &amp; Özel Üretim Teklif Föyü</div>
    </div>
    <div style="text-align:right;font-size:10.5px;color:#44403C;line-height:1.45;">
      ${meta?.clientName ? `<strong>Müşteri:</strong> ${escapeHtmlPrint(meta.clientName)}<br/>` : ""}
      <strong>Proje:</strong> ${escapeHtmlPrint(project.title)} • <strong>Seri:</strong> ${escapeHtmlPrint(tierLabel)}<br/>
      <strong>Tarih:</strong> ${new Date().toLocaleDateString("tr-TR")}
    </div>
  </div>

  <div class="visual-grid">
    <div class="card">
      <div class="card-title">01 • 3D Stüdyo Görünümü</div>
      ${
        snapshot3DDataUrl
          ? `<img src="${snapshot3DDataUrl}" style="width:100%;height:215px;object-fit:contain;background:#EDEAE4;border-radius:8px;border:1px solid #E5E0D5;" />`
          : `<div style="height:215px;display:flex;align-items:center;justify-content:center;background:#EDEAE4;border-radius:8px;font-size:11px;color:#57534E;">3D Stüdyo Görünümü</div>`
      }
    </div>
    <div class="card">
      <div class="card-title">02 • 2D Tüm-Modül İç Cephe Şeması</div>
      ${elevSvgMarkup}
    </div>
  </div>

  <div class="cap-strip">
    <div class="cap-pill"><div class="cap-label">Toplam Uzunluk</div><div class="cap-val">${Math.round(liveCustomerAndFactoryStats.totalModWidth / 10)} cm (${mainMods.length} Modül)</div></div>
    <div class="cap-pill"><div class="cap-label">Askı Kapasitesi</div><div class="cap-val">~${liveCustomerAndFactoryStats.hangingGarments} Askılı Kıyafet</div></div>
    <div class="cap-pill"><div class="cap-label">Raf &amp; Çekmece</div><div class="cap-val">~${liveCustomerAndFactoryStats.foldedGarments} Katlı • ${liveCustomerAndFactoryStats.drawerCount} Çekmece</div></div>
    <div class="cap-pill"><div class="cap-label">Donanım Standartı</div><div class="cap-val">Blum Frenli • System 32</div></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Kod</th>
        <th>Modül Tanımı</th>
        <th>Ölçüler (G×Y×D)</th>
        <th>Bölme</th>
        <th>Gövde / Kapak Yüzeyi</th>
      </tr>
    </thead>
    <tbody>
      ${project.modules
        .map((m, i) => {
          const bName = matNameById.get(m.carcass.bodyMaterialId) || "Beyaz Melamin";
          const dName = matNameById.get(m.carcass.doorMaterialId) || "Özel Yüzey";
          return `
        <tr>
          <td style="font-family:monospace;"><strong>${String(i + 1).padStart(2, "0")}</strong></td>
          <td><strong>${escapeHtmlPrint(m.name)}</strong></td>
          <td style="font-family:monospace;font-weight:600;">${Math.round(m.dimensions.width / 10)} × ${Math.round(m.dimensions.height / 10)} × ${Math.round(m.dimensions.depth / 10)} cm</td>
          <td>${escapeHtmlPrint(m.bays?.length || 1)} Bölme</td>
          <td>${escapeHtmlPrint(bName)} / ${escapeHtmlPrint(dName)}</td>
        </tr>`;
        })
        .join("")}
    </tbody>
  </table>

  ${meta?.projectNote ? `<div style="font-size:10.5px;color:#44403C;margin-bottom:12px;padding:8px 12px;background:#FAF9F6;border:1px solid #E5E0D5;border-radius:8px;"><strong>Proje Notu:</strong> ${escapeHtmlPrint(meta.projectNote)}</div>` : ""}

  <div class="quote-footer">
    <div>
      ${quoteDiscountPct > 0 ? `<div style="font-size:10.5px;color:#A8A29E;">Liste Toplamı: <span style="text-decoration:line-through;">€${pricing.totalWithVatEur.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</span> • Proje İskontosu: %${quoteDiscountPct}</div>` : ""}
      <div style="font-size:11.5px;color:#E7E5E4;margin-top:3px;">Ödeme Planı: <strong>${quoteInstallments === 1 ? "Peşin" : `${quoteInstallments} × €${monthlyPay} / ay`}</strong> • Teslimat: 14 İş Günü (Birim Uzman Montaj Dahil)</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:9.5px;text-transform:uppercase;letter-spacing:0.12em;color:#D6C7B2;">KDV Dahil Net Teklif</div>
      <div style="font-size:22px;font-weight:800;color:#FAF9F6;font-family:monospace;">€${netTotal}</div>
    </div>
  </div>
</body>
</html>`;

    const printWin = window.open("", "_blank", "width=980,height=860");
    if (printWin) {
      printWin.document.open();
      printWin.document.write(printHtml);
      printWin.document.close();
      setTimeout(() => {
        printWin.focus();
        printWin.print();
      }, 350);
    } else {
      // Fallback: download as HTML if popup blocked
      const blob = new Blob([printHtml], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `B1R1M_Gorsel_Sunum_Teklif_${project.id}.html`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (a.parentNode) a.parentNode.removeChild(a);
        URL.revokeObjectURL(url);
      }, 1500);
    }
  }, [
    spaceWalls,
    pricing.totalWithVatEur,
    quoteDiscountPct,
    quoteInstallments,
    project.modules,
    project.title,
    project.id,
    activeConceptTier,
    liveCustomerAndFactoryStats,
  ]);

  // Adım Adım Kolay Tasarım Sihirbazı Uygulayıcı (Atomik ve %100 Çakışmasız Yerleşim)
  const handleFinishStepWizard = useCallback(
    (targetDestination: "studio_3d" | "plan_2d" | "print_pdf") => {
      applyGuidedWizardLayout({
        spaceCategory: wizSpaceCategory,
        roomShape: wizRoomShape,
        wallWidthMm: wizWallWidthMm,
        targetHeightMm: wizTargetHeightMm,
        targetDepthMm: wizTargetDepthMm,
        autoFiller50Mm: wizAutoFiller50Mm,
        interiorFocus: wizInteriorFocus,
        doorStyle: wizDoorStyle,
        conceptTier: wizConceptTier,
        colorSwatchId: wizColorSwatch,
        addLed: wizAddLed,
        addTrouserRack: wizAddTrouserRack,
        addJewelryTray: wizAddJewelryTray,
      });

      setShowStepWizardModal(false);
      if (targetDestination === "plan_2d") {
        setMode("plan");
      } else {
        setMode("studio");
        setStudioView("3d");
      }

      setApprovalBanner({
        ok: true,
        text: `✨ Tasarımınız (${wizWallWidthMm / 10} cm duvar, sıfır çakışma ve ${
          wizAutoFiller50Mm ? "2×5 cm kör çıta payı ile" : "tam ölçüyle"
        }) oluşturuldu!`,
      });
      setTimeout(() => setApprovalBanner(null), 4500);

      if (targetDestination === "print_pdf") {
        setTimeout(() => {
          handlePrintVisualCustomerPresentation();
        }, 250);
      }
    },
    [
      applyGuidedWizardLayout,
      wizSpaceCategory,
      wizRoomShape,
      wizWallWidthMm,
      wizTargetHeightMm,
      wizTargetDepthMm,
      wizAutoFiller50Mm,
      wizInteriorFocus,
      wizDoorStyle,
      wizConceptTier,
      wizColorSwatch,
      wizAddLed,
      wizAddTrouserRack,
      wizAddJewelryTray,
      handlePrintVisualCustomerPresentation,
    ]
  );

  const activeBreakdown = useMemo(
    () => (activeModule ? generateModuleGeometry(activeModule, { doorOpenAngleDeg: 0 }) : null),
    [activeModule]
  );
  if (!activeModule || !activeBreakdown) {
    return (
      <EmptyStageRecoveryCard
        canUndo={canUndo}
        onUndo={undo}
        onCreateDefaultWardrobe={resetToDefault}
        onOpenStepWizard={() => {
          resetToDefault();
          setWizardStep(1);
          setShowStepWizardModal(true);
        }}
        onLoadKitchen={loadLinearKitchen}
        onApplyWalkIn={() => applyTemplate("tpl_wardrobe_walkin_open")}
      />
    );
  }
  const { width, height, depth } = activeModule.dimensions;
  const currentBayWidthMm = activeBreakdown.bayWidths[activeBayIndex] || 0;
  const netInnerHeightMm = activeBreakdown.netInnerHeight || Math.max(400, height - 116);
  const mainWall = spaceWalls[0] || { length: 3600, height: 2700 };
  const usedSpanMm = project.modules.reduce(
    (max, m) => Math.max(max, m.position.x + m.dimensions.width),
    0
  );
  const remainingWallMm = Math.max(0, mainWall.length - usedSpanMm);

  const errorIssues = validationIssues.filter((i) => i.severity === "error");
  const baseFamilyTemplates = filterTemplatesForStudioSubCategory(
    v4ModuleTemplates,
    leftSubCat as StudioLeftSubCategory,
    selectedV4Family,
    catalogSearchQuery,
    catalogWidthFilter
  );
  const familyTemplates = baseFamilyTemplates.filter((vt) => {
    if (showFavoritesOnly && !favoriteTemplateIds.includes(vt.templateId)) return false;
    if (catalogFeatureFilter === "sliding") {
      return (
        vt.defaultDoorSystemId?.startsWith("sliding") ||
        vt.name.toLowerCase().includes("sürgü")
      );
    }
    if (catalogFeatureFilter === "drawer") {
      return (
        vt.name.toLowerCase().includes("çekmece") ||
        vt.templateId.includes("drawer") ||
        vt.code.toLowerCase().includes("drw")
      );
    }
    return true;
  });

  const toggleFavoriteTemplate = (tplId: string) => {
    setFavoriteTemplateIds((prev) =>
      prev.includes(tplId) ? prev.filter((id) => id !== tplId) : [...prev, tplId]
    );
  };

  const humanCompatStatusLabel =
    v4CompatibilityReport.overallStatus === "UNVERIFIED"
      ? "Üretim uygunluğu doğrulanmadı"
      : v4CompatibilityReport.overallStatus === "INCOMPATIBLE"
      ? "Üretime uygun değil (Ölçü/Çakışma)"
      : v4CompatibilityReport.overallStatus === "COMPATIBLE_WITH_CONDITIONS"
      ? "Koşullu üretime uygun"
      : "Üretim kontrolü tamamlandı";
  const adminRecords = libraryAdminStore.getAllEntries();

  const handleApprove = () => {
    const res = approveProduction();
    setApprovalBanner({ text: res.message, ok: res.success });
    setShowQuickSellModal(true);
    setTimeout(() => setApprovalBanner(null), 4500);
  };

  const handleApplyQuickCabinet = useCallback(
    (isAppend: boolean) => {
      let targetTplId = "tpl_kb_02_double_door";

      if (quickCabinetType === "base") {
        if (quickFrontType === "single_door_left" || quickFrontType === "single_door_right")
          targetTplId = "tpl_kb_01_single_door";
        else if (quickFrontType === "double_door") targetTplId = "tpl_kb_02_double_door";
        else if (quickFrontType === "drawers_2") targetTplId = "tpl_kb_04_two_drawers";
        else if (quickFrontType === "drawers_3") targetTplId = "tpl_kb_05_three_drawers";
        else if (quickFrontType === "open") targetTplId = "tpl_kb_16_open_shelf";
        else targetTplId = "tpl_kb_02_double_door";
      } else if (quickCabinetType === "drawers_3") {
        targetTplId = "tpl_kb_05_three_drawers";
      } else if (quickCabinetType === "wall") {
        if (quickFrontType === "aventos_hf") targetTplId = "tpl_kw_06_lift_bifold";
        else if (quickFrontType === "single_door_left" || quickFrontType === "single_door_right")
          targetTplId = "tpl_kw_01_single_door";
        else if (quickFrontType === "open") targetTplId = "tpl_kw_03_open_shelf";
        else targetTplId = "tpl_kw_02_double_door";
      } else if (quickCabinetType === "tall") {
        if (quickFrontType === "space_tower") targetTplId = "tpl_kt_03_pantry_internal_drawers";
        else targetTplId = "tpl_kt_01_pantry_shelved";
      } else if (quickCabinetType === "wardrobe") {
        if (quickFrontType === "single_door_left" || quickFrontType === "single_door_right")
          targetTplId = "tpl_wd_01_single_door";
        else if (quickCabinetWidth >= 1600) targetTplId = "tpl_wd_04_four_door";
        else if (quickCabinetWidth >= 1200) targetTplId = "tpl_wd_03_three_door";
        else targetTplId = "tpl_wd_02_two_door";
      } else if (quickCabinetType === "corner") {
        targetTplId =
          quickCabinetHeight > 1500 ? "tpl_wd_13_corner_wardrobe" : "tpl_kb_14_l_corner";
      }

      // Single atomic history transaction: zero setTimeout race conditions and single Undo step!
      beginHistoryTransaction();
      applyV4Template(targetTplId, isAppend);
      setDimensions(quickCabinetWidth, quickCabinetHeight, quickCabinetDepth);
      if (quickFrontType === "double_door") {
        setBayDoorType(0, "double");
        setBayV4DoorConfig(0, { doorSystemId: "hinged_double" });
      } else if (quickFrontType === "single_door_left") {
        setBayDoorType(0, "single_left");
        setBayV4DoorConfig(0, { doorSystemId: "hinged_single" });
      } else if (quickFrontType === "single_door_right") {
        setBayDoorType(0, "single_right");
        setBayV4DoorConfig(0, { doorSystemId: "hinged_single" });
      } else if (quickFrontType === "open") {
        setBayDoorType(0, "open");
        setBayV4DoorConfig(0, { doorSystemId: "open" });
      } else if (quickFrontType === "space_tower") {
        applyBlumQuickWizardPreset("blum_space_tower");
      } else if (quickFrontType === "aventos_hf") {
        applyBlumQuickWizardPreset("blum_aventos_wall");
      } else if (quickFrontType === "drawers_3") {
        applyBlumQuickWizardPreset("blum_legrabox_base");
      }
      commitHistoryTransaction();

      setApprovalBanner({
        ok: true,
        text: `✓ Hızlı Gövde Uygulandı: ${quickCabinetWidth}×${quickCabinetHeight}×${quickCabinetDepth} mm`,
      });
      setTimeout(() => setApprovalBanner(null), 3000);
    },
    [
      quickCabinetType,
      quickCabinetWidth,
      quickCabinetHeight,
      quickCabinetDepth,
      quickFrontType,
      beginHistoryTransaction,
      commitHistoryTransaction,
      applyV4Template,
      setDimensions,
      setBayDoorType,
      setBayV4DoorConfig,
      applyBlumQuickWizardPreset,
    ]
  );

  // Instant Live Sync helper so clicking options in Hızlı Gövde Sihirbazı immediately updates the 3D cabinet on the right!
  const syncQuickCabinetTo3D = useCallback(
    (next: {
      type: "base" | "wall" | "tall" | "wardrobe" | "drawers_3" | "corner";
      w: number;
      h: number;
      d: number;
      front:
        | "single_door_left"
        | "single_door_right"
        | "double_door"
        | "drawers_2"
        | "drawers_3"
        | "aventos_hf"
        | "space_tower"
        | "open";
    }) => {
      if (!quickLiveSync) return;
      let targetTplId = "tpl_kb_02_double_door";
      if (next.type === "base") {
        if (next.front === "single_door_left" || next.front === "single_door_right")
          targetTplId = "tpl_kb_01_single_door";
        else if (next.front === "drawers_2") targetTplId = "tpl_kb_04_two_drawers";
        else if (next.front === "drawers_3") targetTplId = "tpl_kb_05_three_drawers";
        else if (next.front === "open") targetTplId = "tpl_kb_16_open_shelf";
        else targetTplId = "tpl_kb_02_double_door";
      } else if (next.type === "drawers_3") {
        targetTplId = "tpl_kb_05_three_drawers";
      } else if (next.type === "wall") {
        if (next.front === "aventos_hf") targetTplId = "tpl_kw_06_lift_bifold";
        else if (next.front === "single_door_left" || next.front === "single_door_right")
          targetTplId = "tpl_kw_01_single_door";
        else if (next.front === "open") targetTplId = "tpl_kw_03_open_shelf";
        else targetTplId = "tpl_kw_02_double_door";
      } else if (next.type === "tall") {
        targetTplId =
          next.front === "space_tower"
            ? "tpl_kt_03_pantry_internal_drawers"
            : "tpl_kt_01_pantry_shelved";
      } else if (next.type === "wardrobe") {
        if (next.front === "single_door_left" || next.front === "single_door_right")
          targetTplId = "tpl_wd_01_single_door";
        else if (next.w >= 1600) targetTplId = "tpl_wd_04_four_door";
        else if (next.w >= 1200) targetTplId = "tpl_wd_03_three_door";
        else targetTplId = "tpl_wd_02_two_door";
      } else if (next.type === "corner") {
        targetTplId = next.h > 1500 ? "tpl_wd_13_corner_wardrobe" : "tpl_kb_14_l_corner";
      }

      beginHistoryTransaction();
      applyV4Template(targetTplId, false);
      setDimensions(next.w, next.h, next.d);
      if (next.front === "double_door") {
        setBayDoorType(0, "double");
        setBayV4DoorConfig(0, { doorSystemId: "hinged_double" });
      } else if (next.front === "single_door_left") {
        setBayDoorType(0, "single_left");
        setBayV4DoorConfig(0, { doorSystemId: "hinged_single" });
      } else if (next.front === "single_door_right") {
        setBayDoorType(0, "single_right");
        setBayV4DoorConfig(0, { doorSystemId: "hinged_single" });
      } else if (next.front === "open") {
        setBayDoorType(0, "open");
        setBayV4DoorConfig(0, { doorSystemId: "open" });
      } else if (next.front === "space_tower") {
        applyBlumQuickWizardPreset("blum_space_tower");
      } else if (next.front === "aventos_hf") {
        applyBlumQuickWizardPreset("blum_aventos_wall");
      } else if (next.front === "drawers_3") {
        applyBlumQuickWizardPreset("blum_legrabox_base");
      }
      commitHistoryTransaction();
    },
    [
      quickLiveSync,
      beginHistoryTransaction,
      commitHistoryTransaction,
      applyV4Template,
      setDimensions,
      setBayDoorType,
      setBayV4DoorConfig,
      applyBlumQuickWizardPreset,
    ]
  );

  // Live synthesized ModuleInstance for Hızlı Gövde Sihirbazı preview icon
  const quickWizardPreviewModule = useMemo(() => {
    const clone = JSON.parse(JSON.stringify(activeModule)) as typeof activeModule;
    clone.dimensions = {
      width: quickCabinetWidth,
      height: quickCabinetHeight,
      depth: quickCabinetDepth,
    };
    clone.isCorner = quickCabinetType === "corner";
    clone.category =
      quickCabinetType === "wall"
        ? "kitchen_wall"
        : quickCabinetType === "base" || quickCabinetType === "drawers_3"
        ? "kitchen_base"
        : "wardrobe";
    clone.moduleFamilyId =
      quickCabinetType === "wall"
        ? "fam_kitchen_wall"
        : quickCabinetType === "base" || quickCabinetType === "drawers_3"
        ? "fam_kitchen_base"
        : quickCabinetType === "corner"
        ? "fam_special_corner"
        : "fam_wardrobe";
    clone.isOpenFront = quickFrontType === "open";
    const targetBays = quickCabinetType === "wardrobe" && quickCabinetWidth >= 1200 ? 2 : 1;
    clone.bays = Array.from({ length: targetBays }).map((_, idx) => {
      const baseBay = clone.bays?.[0] || activeModule.bays?.[0];
      const baseDoor = baseBay?.door ?? {
        id: `qp_door_${idx}`,
        bayIndex: idx,
        type: "double" as const,
        softClose: true,
      };
      const drawerCount =
        quickFrontType === "drawers_3"
          ? 3
          : quickFrontType === "drawers_2"
          ? 2
          : quickFrontType === "space_tower"
          ? 4
          : 0;
      return {
        ...baseBay,
        index: idx,
        customWidth: undefined,
        specialFittings: baseBay?.specialFittings ?? [],
        shelves:
          drawerCount > 0 && quickFrontType !== "space_tower"
            ? []
            : [
                { id: `qp_sh_${idx}_1`, bayIndex: idx, elevationY: Math.round(quickCabinetHeight * 0.35), isAdjustable: true },
                { id: `qp_sh_${idx}_2`, bayIndex: idx, elevationY: Math.round(quickCabinetHeight * 0.68), isAdjustable: true },
              ],
        hangingRails:
          quickCabinetType === "wardrobe"
            ? [{ id: `qp_rl_${idx}`, bayIndex: idx, elevationY: Math.round(quickCabinetHeight * 0.76) }]
            : [],
        drawers: Array.from({ length: drawerCount }).map((__, dI) => ({
          id: `qp_drw_${idx}_${dI}`,
          bayIndex: idx,
          height: 180,
          elevationY: dI * 190,
          isInternal: quickFrontType === "space_tower",
          slideType: "soft_close" as const,
        })),
        door: {
          ...baseDoor,
          id: baseDoor.id || `qp_door_${idx}`,
          bayIndex: idx,
          type:
            quickFrontType === "open"
              ? "open"
              : quickFrontType === "single_door_left"
              ? "single_left"
              : quickFrontType === "single_door_right"
              ? "single_right"
              : "double",
          doorSystemId:
            quickFrontType === "open"
              ? "open"
              : quickFrontType === "aventos_hf"
              ? "lift_bi_fold"
              : quickFrontType === "single_door_left" || quickFrontType === "single_door_right"
              ? "hinged_single"
              : "hinged_double",
        },
      };
    });
    return clone;
  }, [
    activeModule,
    quickCabinetType,
    quickCabinetWidth,
    quickCabinetHeight,
    quickCabinetDepth,
    quickFrontType,
  ]);

  return (
    <div
      data-testid="v3-unified-root"
      data-active-mode={mode}
      className="relative flex flex-col h-screen w-screen overflow-hidden bg-[#B8B0A4] text-[#141413] font-sans select-none"
    >
      {/* 1. BİRİM ARCHITECTURAL STUDIO TOP BAR (3-Persona Progressive Disclosure) */}
      {!(mode === "showroom" && zenMode) && (
        <WorkspaceTopBar
          projectTitle={project.title}
          mode={mode}
          studioView={studioView}
          studio2DMode={studio2DMode}
          studioSplitView={studioSplitView}
          cncXrayMode={cncXrayMode}
          floating={mode !== "plan"}
          onOpenSceneHubModal={() => { setSceneHubInitialTab("modules"); setShowSceneHubModal(true); }}
          onToggleStudioSplitView={toggleStudioSplitView}
          onToggleCncXrayMode={toggleCncXrayMode}
          experienceTier={experienceTier}
          leadTimeLabel={pricing.leadTime?.label}
          canUndo={canUndo}
          canRedo={canRedo}
          canApproveProduction={v4CompatibilityReport.canApproveProduction && unifiedEngineeringReport.canExportToCncAndSaw && unifiedEngineeringReport.canApproveFinalErpRelease}
          humanCompatStatusLabel={humanCompatStatusLabel}
          onOpenProjectModal={() => setIsProjectModalOpen(true)}
          onOpenStepWizard={() => {
            setWizardStep(1);
            setShowStepWizardModal(true);
          }}
          onOpenQuickSell={() => setShowQuickSellModal(true)}
          onOpenBomModal={() => setIsBomModalOpen(true)}
          onOpenStoreErpModal={() => setIsStoreErpModalOpen(true)}
          onOpenMepModal={() => setShowMepModal(true)}
          onOpenAssemblyModal={() => setShowAssemblyModal(true)}
          onOpenStudioRenderModal={() => setShowStudioRenderModal(true)}
          onOpenCustomHardwareModal={() => setShowCustomHardwareModal(true)}
          onOpenIslandTableModal={() => setShowIslandTableModal(true)}
          onOpenVisualCatalog={() => setIsVisualCatalogOpen(true)}
          onOpenArAnd3DModal={() => setShowArAnd3DModal(true)}
          onOpenRulesModal={() => setShowRulesModal(true)}
          onOpenAdminModal={() => setShowAdminModal(true)}
          onChangeExperienceTier={(tier) => {
            setExperienceTier(tier);
            if (tier === "simple") {
              if (cncXrayMode) toggleCncXrayMode();
              if (studioSplitView) toggleStudioSplitView();
              setStudioView("3d");
            } else if (tier === "factory") {
              setStudioRightOpen(true);
              setStudioInspectorTab("all");
            } else if (tier === "architect") {
              setStudioRightOpen(true);
            }
          }}
          onSetMode={(nextMode) => {
            startTransition(() => {
              setMode(nextMode);
              if (nextMode === "studio") setStudioView("3d");
              if (nextMode !== "showroom") setZenMode(false);
            });
          }}
          onSetStudioView={(v, m2d) => {
            startTransition(() => {
              setStudioView(v);
              if (m2d) setStudio2DMode(m2d);
            });
          }}
          onSetCameraPreset={setCameraPreset}
          onToggleDimensions={() => setShow3DDimensions((prev) => !prev)}
          onEnterZenShowroom={() => {
            setMode("showroom");
            setZenMode(true);
          }}
          onUndo={undo}
          onRedo={redo}
        />
      )}

            {/* SMART 1-LINE DELETE INTENT CHOICE BAR (Appears when pressing Delete on Door or Carcass Panel) */}
      {pendingDeletePrompt && (
        <div
          data-draggable-shell="delete-bar"
          data-testid="smart-delete-choice-bar"
          onPointerDown={(e) => startZeroLagModalDrag(e)}
          className="fixed top-[72px] left-1/2 -translate-x-1/2 z-[70] max-w-[92vw] px-4 py-2.5 rounded-full birim-ice-popover flex flex-wrap items-center gap-2 text-xs text-[#141413] cursor-grab active:cursor-grabbing"
        >
          <span className="font-semibold text-[#141413] mr-1">
            {pendingDeletePrompt.kind === "door"
              ? `"${pendingDeletePrompt.partName}" seçili — ne yapmak istersiniz?`
              : `"${pendingDeletePrompt.partName}" sabit gövdedir — ne yapmak istersiniz?`}
          </span>

          {pendingDeletePrompt.canRemoveDoor && (
            <button
              type="button"
              data-testid="smart-delete-opt-remove-door"
              onClick={() => {
                const bIdx = pendingDeletePrompt.bayIndex;
                setPendingDeletePrompt(null);
                setBayDoorType(bIdx, "open");
                setApprovalBanner({
                  ok: true,
                  text: `${bIdx + 1}. Bölme kapağı kaldırıldı (Açık bölme • Ctrl+Z ile geri al).`,
                });
                setTimeout(() => setApprovalBanner(null), 2600);
              }}
              className="px-2.5 py-1 rounded-xl bg-[#141413] hover:bg-[#292524] text-white font-semibold transition cursor-pointer"
            >
              Kapağı Kaldır (Açık Yap)
            </button>
          )}

          {pendingDeletePrompt.canShrinkDouble && (
            <button
              type="button"
              data-testid="smart-delete-opt-shrink-double"
              onClick={() => {
                const bIdx = pendingDeletePrompt.bayIndex;
                const nextCm = pendingDeletePrompt.halfShrunkOuterCm;
                setPendingDeletePrompt(null);
                shrinkDoubleBayToSingle(bIdx);
                setApprovalBanner({
                  ok: true,
                  text: `${bIdx + 1}. Bölme tek kapağa düşürüldü (Dolap ~${nextCm} cm oldu • Ctrl+Z ile geri al).`,
                });
                setTimeout(() => setApprovalBanner(null), 2600);
              }}
              className="px-2.5 py-1 rounded-xl bg-white hover:bg-[#EFECE5] border border-[#DED8CC] text-[#141413] font-semibold transition cursor-pointer"
            >
              Tek Kapağa Düşür (~{pendingDeletePrompt.halfShrunkOuterCm} cm)
            </button>
          )}

          {pendingDeletePrompt.canDeleteBay && (
            <button
              type="button"
              data-testid="smart-delete-opt-delete-bay"
              onClick={() => {
                const bIdx = pendingDeletePrompt.bayIndex;
                const nextCm = pendingDeletePrompt.shrunkOuterCm;
                setPendingDeletePrompt(null);
                removeBayAndShrinkModule(bIdx);
                setApprovalBanner({
                  ok: true,
                  text: `${bIdx + 1}. Bölme silindi ve dolap ~${nextCm} cm genişliğe daraltıldı (Ctrl+Z ile geri al).`,
                });
                setTimeout(() => setApprovalBanner(null), 2600);
              }}
              className="px-2.5 py-1 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-semibold transition cursor-pointer"
            >
              {pendingDeletePrompt.bayIndex + 1}. Bölmeyi Sil (~{pendingDeletePrompt.shrunkOuterCm} cm)
            </button>
          )}

          {pendingDeletePrompt.canDeleteModule && (
            <button
              type="button"
              data-testid="smart-delete-opt-delete-module"
              onClick={() => {
                const modName = activeModule?.name || "Modül";
                setPendingDeletePrompt(null);
                removeActiveModule();
                setApprovalBanner({
                  ok: true,
                  text: `"${modName}" sahneden kaldırıldı (Ctrl+Z ile geri al).`,
                });
                setTimeout(() => setApprovalBanner(null), 2600);
              }}
              className="px-2.5 py-1 rounded-xl bg-white hover:bg-red-50 border border-[#DED8CC] hover:border-red-200 text-[#57534E] hover:text-red-700 font-semibold transition cursor-pointer"
            >
              Tüm Dolabı Sil
            </button>
          )}

          <button
            type="button"
            data-testid="smart-delete-opt-cancel"
            onClick={() => setPendingDeletePrompt(null)}
            title="Vazgeç (Esc)"
            className="px-2 py-1 rounded-xl hover:bg-[#EFECE5] text-[#78716C] hover:text-[#141413] font-medium transition cursor-pointer"
          >
            Vazgeç
          </button>
        </div>
      )}

      {/* Approval / Validation Notification Banner */}
      {approvalBanner && (
        <div
          className={`${
            approvalBanner.ok
              ? "bg-[#E5EFEA] text-[#1E3F2F] border-[#B9D6C8]"
              : "bg-red-100 text-red-900 border-red-300"
          } ${
            mode !== "plan"
              ? "fixed top-[62px] left-1/2 -translate-x-1/2 z-40 rounded-2xl border shadow-lg px-4 py-2 max-w-[90vw]"
              : "px-5 py-2 border-b z-30"
          } text-xs font-semibold flex items-center justify-between gap-3`}
        >
          <span>{approvalBanner.text}</span>
          <button
            type="button"
            onClick={() => setApprovalBanner(null)}
            className="cursor-pointer opacity-70 hover:opacity-100 px-1"
            aria-label="Bildirimi kapat"
          >
            ✕
          </button>
        </div>
      )}

      {/* EKRAN 7 (FAZ 4): PLAN MODU ÜST BAĞLAMSAL ARAÇ ÇUBUĞU (Matches image_da6ae9.jpg: Seç | Çizgi | Ofset | Ölçü | Hizala | Dağıt | Snaps | Izgara) */}
      {mode === "plan" && (
        <div
          data-testid="plan-ribbon-toolbar"
          className="min-h-[44px] birim-ice-bar border-b px-3.5 py-1 flex items-center justify-between gap-2 shrink-0 z-30 text-xs relative"
        >
          {/* Sol: Buzlu Cam Saf İkon Çizim & Hizalama Kapsülü */}
          <div className="flex items-center gap-1 flex-wrap">
            <div className="inline-flex items-center p-0.5 rounded-2xl birim-ice-pill gap-0.5">
              <button
                type="button"
                data-testid="plan-top-tool-select"
                title="Seçim Modu"
                onClick={() => {
                  setPlanActiveDrawingTool("select");
                  dispatchPlanToolAction({ action: "select_mode" });
                }}
                className={`w-8 h-8 rounded-xl font-bold flex items-center justify-center transition cursor-pointer ${
                  planActiveDrawingTool === "select"
                    ? "birim-ice-btn-active"
                    : "text-[#334155] hover:bg-white/75"
                }`}
              >
                <span>↖</span>
                <span className="sr-only">Seç</span>
              </button>

              <button
                type="button"
                data-testid="plan-top-tool-line"
                title="Duvar / Çizgi Çiz"
                onClick={() => {
                  setPlanActiveDrawingTool("wall");
                  dispatchPlanToolAction({ action: "draw_wall" });
                }}
                className={`w-8 h-8 rounded-xl font-bold flex items-center justify-center transition cursor-pointer ${
                  planActiveDrawingTool === "wall"
                    ? "birim-ice-btn-active"
                    : "text-[#334155] hover:bg-white/75"
                }`}
              >
                <span>╱</span>
                <span className="sr-only">Çizgi</span>
              </button>

              <button
                type="button"
                data-testid="plan-top-tool-offset"
                onClick={() => dispatchPlanToolAction({ action: "offset_wall", offsetMm: 100 })}
                title="Ana Duvarı +100 mm Ofsetle / Uzat"
                className="w-8 h-8 rounded-xl font-semibold flex items-center justify-center text-[#334155] hover:bg-white/75 transition cursor-pointer"
              >
                <span>⧉</span>
                <span className="sr-only">Ofset</span>
              </button>

              <button
                type="button"
                data-testid="plan-top-tool-measure"
                title="Ölçü Çizgilerini Göster / Gizle"
                onClick={() => {
                  setShow3DDimensions((prev) => !prev);
                  dispatchPlanToolAction({ action: "toggle_dimensions" });
                }}
                className={`w-8 h-8 rounded-xl font-semibold flex items-center justify-center transition cursor-pointer ${
                  show3DDimensions
                    ? "birim-ice-btn-active"
                    : "text-[#334155] hover:bg-white/75"
                }`}
              >
                <Ruler className="w-3.5 h-3.5" />
                <span className="sr-only">Ölçü</span>
              </button>
            </div>

            <div className="inline-flex items-center p-0.5 rounded-2xl birim-ice-pill gap-0.5">
              {/* Hizala Popover İkonu */}
              <div className="relative">
                <button
                  type="button"
                  data-testid="plan-top-tool-align"
                  title="Modül Hizalama Araçları"
                  onClick={() => {
                    setPlanTopAlignMenuOpen((v) => !v);
                    setPlanTopDistributeMenuOpen(false);
                  }}
                  className={`w-8 h-8 rounded-xl font-semibold flex items-center justify-center transition cursor-pointer ${
                    planTopAlignMenuOpen ? "birim-ice-btn-active" : "text-[#334155] hover:bg-white/75"
                  }`}
                >
                  <span>╟</span>
                  <span className="sr-only">Hizala</span>
                </button>
                {planTopAlignMenuOpen && (
                  <div
                    data-testid="plan-top-align-menu"
                    className="absolute left-0 top-10 w-44 birim-ice-popover rounded-2xl p-1.5 z-50 space-y-1"
                  >
                    <button
                      type="button"
                      data-testid="plan-align-left"
                      onClick={() => {
                        alignActiveModuleOnWall("left");
                        setPlanTopAlignMenuOpen(false);
                      }}
                      className="w-full px-2.5 py-1.5 rounded-xl hover:bg-white/80 text-left font-semibold text-[#111827] flex items-center justify-between cursor-pointer"
                    >
                      <span>⬅ Sol</span>
                      <span className="text-[10px] font-mono text-[#64748B]">0mm</span>
                    </button>
                    <button
                      type="button"
                      data-testid="plan-align-center"
                      onClick={() => {
                        alignActiveModuleOnWall("center");
                        setPlanTopAlignMenuOpen(false);
                      }}
                      className="w-full px-2.5 py-1.5 rounded-xl hover:bg-white/80 text-left font-semibold text-[#111827] flex items-center justify-between cursor-pointer"
                    >
                      <span>↔ Merkez</span>
                      <span className="text-[10px] font-mono text-[#64748B]">Eşit</span>
                    </button>
                    <button
                      type="button"
                      data-testid="plan-align-right"
                      onClick={() => {
                        alignActiveModuleOnWall("right");
                        setPlanTopAlignMenuOpen(false);
                      }}
                      className="w-full px-2.5 py-1.5 rounded-xl hover:bg-white/80 text-left font-semibold text-[#111827] flex items-center justify-between cursor-pointer"
                    >
                      <span>➡ Sağ</span>
                      <span className="text-[10px] font-mono text-[#64748B]">Son</span>
                    </button>
                    <button
                      type="button"
                      data-testid="plan-align-flush-back"
                      onClick={() => {
                        alignActiveModuleOnWall("flush_back");
                        setPlanTopAlignMenuOpen(false);
                      }}
                      className="w-full px-2.5 py-1.5 rounded-xl hover:bg-white/80 text-left font-semibold text-[#111827] flex items-center justify-between cursor-pointer"
                    >
                      <span>⬆ Duvara Yasla</span>
                      <span className="text-[10px] font-mono text-[#64748B]">Z:0</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Dağıt Popover İkonu */}
              <div className="relative">
                <button
                  type="button"
                  data-testid="plan-top-tool-distribute"
                  title="Modülleri Duvar Boyunca Dağıt"
                  onClick={() => {
                    setPlanTopDistributeMenuOpen((v) => !v);
                    setPlanTopAlignMenuOpen(false);
                  }}
                  className={`w-8 h-8 rounded-xl font-semibold flex items-center justify-center transition cursor-pointer ${
                    planTopDistributeMenuOpen ? "birim-ice-btn-active" : "text-[#334155] hover:bg-white/75"
                  }`}
                >
                  <span>⫼</span>
                  <span className="sr-only">Dağıt</span>
                </button>
                {planTopDistributeMenuOpen && (
                  <div
                    data-testid="plan-top-distribute-menu"
                    className="absolute left-0 top-10 w-48 birim-ice-popover rounded-2xl p-1.5 z-50 space-y-1"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        distributeAlongWall();
                        setPlanTopDistributeMenuOpen(false);
                      }}
                      className="w-full px-2.5 py-1.5 rounded-xl hover:bg-white/80 text-left font-semibold text-[#111827] cursor-pointer"
                    >
                      ↔ Eşit Dağıt
                    </button>
                    <button
                      type="button"
                      data-testid="plan-distribute-gap-0"
                      onClick={() => {
                        distributeModulesWithGap(0);
                        setPlanTopDistributeMenuOpen(false);
                      }}
                      className="w-full px-2.5 py-1.5 rounded-xl hover:bg-white/80 text-left font-semibold text-[#111827] cursor-pointer"
                    >
                      🔗 Bitiştir (0 mm)
                    </button>
                    <button
                      type="button"
                      data-testid="plan-distribute-gap-50"
                      onClick={() => {
                        distributeModulesWithGap(50);
                        setPlanTopDistributeMenuOpen(false);
                      }}
                      className="w-full px-2.5 py-1.5 rounded-xl hover:bg-white/80 text-left font-semibold text-[#111827] cursor-pointer"
                    >
                      📐 50 mm Boşluk
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                data-testid="plan-top-tool-grid"
                title="2D Izgarayı (Grid) Göster / Gizle"
                onClick={() => dispatchPlanToolAction({ action: "toggle_grid" })}
                className="w-8 h-8 rounded-xl font-bold flex items-center justify-center text-[#334155] hover:bg-white/75 transition cursor-pointer"
              >
                <span>#</span>
                <span className="sr-only">Izgara</span>
              </button>
            </div>

            {/* Mıknatıs (Snap) İkon Kapsülü */}
            <div className="inline-flex items-center gap-0.5 birim-ice-pill p-0.5 rounded-2xl">
              <button
                type="button"
                data-testid="plan-top-tool-snaps"
                onClick={() => dispatchPlanToolAction({ action: "toggle_snaps" })}
                className="w-7 h-7 rounded-xl flex items-center justify-center text-[#1E293B] hover:bg-white/75 cursor-pointer"
                title="Mıknatıslı Yakalamayı (Snap) Aç/Kapat"
              >
                <Magnet className="w-3.5 h-3.5 text-[#2563EB]" />
                <span className="sr-only">Snaps</span>
              </button>
              {[0, 50, 100].map((s) => (
                <button
                  key={s}
                  type="button"
                  title={s === 0 ? "Mıknatıs Kapalı" : `${s} mm Mıknatıs Adımı`}
                  onClick={() => setSnapMm(s)}
                  className={`px-1.5 h-7 rounded-xl font-mono text-[10px] font-bold cursor-pointer transition ${
                    snapMm === s
                      ? "birim-ice-btn-active"
                      : "text-[#64748B] hover:bg-white/75"
                  }`}
                >
                  {s === 0 ? "Ø" : s}
                </button>
              ))}
            </div>
          </div>

          {/* Sağ: Kompakt Mimari Dizilim Şablon İkonları + Özellik Düzenleyici */}
          <div className="inline-flex items-center gap-0.5 p-0.5 rounded-2xl birim-ice-pill overflow-x-auto no-scrollbar">
            <button
              type="button"
              data-testid="plan-preset-linear-kitchen"
              title="Doğrusal (I-Tipi) Mutfak Şablonu"
              onClick={loadLinearKitchen}
              className="w-8 h-7 rounded-xl hover:bg-white/80 text-[#334155] text-xs font-extrabold flex items-center justify-center transition cursor-pointer shrink-0"
            >
              <span>━</span>
              <span className="sr-only">Doğrusal Mutfak</span>
            </button>
            <button
              type="button"
              data-testid="plan-preset-l-kitchen"
              title="L-Tipi Köşe Mutfak Şablonu"
              onClick={loadLKitchen}
              className="w-8 h-7 rounded-xl hover:bg-white/80 text-[#334155] text-xs font-extrabold flex items-center justify-center transition cursor-pointer shrink-0"
            >
              <span>┗</span>
              <span className="sr-only">L Tipi Mutfak</span>
            </button>
            <button
              type="button"
              data-testid="plan-preset-u-kitchen"
              title="U-Tipi Mutfak Şablonu"
              onClick={loadUKitchen}
              className="w-8 h-7 rounded-xl hover:bg-white/80 text-[#334155] text-xs font-extrabold flex items-center justify-center transition cursor-pointer shrink-0"
            >
              <span>⊔</span>
              <span className="sr-only">U Tipi Mutfak</span>
            </button>
            <button
              type="button"
              data-testid="plan-preset-wardrobe"
              title="Master Gardırop Şablonu"
              onClick={() => applyTemplate(WARDROBE_TEMPLATES[1].templateId)}
              className="w-8 h-7 rounded-xl hover:bg-white/80 text-[#334155] text-xs font-bold flex items-center justify-center transition cursor-pointer shrink-0"
            >
              <span>🚪</span>
              <span className="sr-only">Master Gardırop</span>
            </button>
            <div className="h-4 w-px bg-slate-900/12 mx-0.5" />
            <button
              type="button"
              data-testid="plan-distribute-wall-btn"
              title="Modülleri Duvara Eşit Dağıt"
              onClick={distributeAlongWall}
              className="w-8 h-7 rounded-xl hover:bg-white/80 text-[#1D4ED8] text-xs font-bold flex items-center justify-center transition cursor-pointer shrink-0"
            >
              <span>⇹</span>
              <span className="sr-only">Duvara Eşit Dağıt</span>
            </button>
            <button
              type="button"
              data-testid="plan-toggle-inspector-btn"
              title={showInspectorInPlan ? "Özellik Panelini Gizle" : "Özellik Düzenleyiciyi Aç"}
              onClick={() => setShowInspectorInPlan((prev) => !prev)}
              className={`w-8 h-7 rounded-xl text-xs font-bold flex items-center justify-center transition cursor-pointer shrink-0 ${
                showInspectorInPlan
                  ? "birim-ice-btn-active"
                  : "hover:bg-white/80 text-[#334155]"
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="sr-only">{showInspectorInPlan ? "Paneli Gizle" : "Özellik Düzenleyici"}</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. MAIN UNIFIED WORKSPACE STAGE (Persists WebGL Canvas without unmounting!) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* EKRAN 7 (FAZ 1, 2 & 3): PLAN MODU SOL İKON SÜTUNU + MEKÂN ÇİZİMİ PANELİ (Matches image_da6ae9.jpg 1-to-1) */}
        {mode === "plan" && (
          <aside
            data-testid="plan-left-panel"
            className="bg-transparent p-2.5 text-[#111827] flex flex-row items-stretch z-30 shrink-0 relative"
          >
            <div
              data-draggable-shell="plan-left-shell"
              className={`relative h-full birim-ice-rail-pill rounded-[28px] overflow-hidden flex flex-row items-stretch max-w-[calc(100vw-24px)] ${
                resizingPanel === "plan-left" ? "birim-ice-resizing-none" : "birim-ice-unified-shell"
              }`}
              style={{
                width: planLeftOpen
                  ? isCompactViewport
                    ? "min(376px, calc(100vw - 24px))"
                    : `${planLeftWidthPx}px`
                  : "56px",
              }}
            >
            {/* FAR-LEFT INTEGRATED ICON RAIL FOR PLAN MODE */}
            <div
              data-testid="plan-left-icon-rail"
              className={`w-[56px] h-full py-2.5 px-1.5 flex flex-col items-center justify-between shrink-0 select-none transition-colors duration-300 ${
                planLeftOpen ? "border-r border-white/60 bg-white/14" : "border-r border-transparent"
              }`}
            >
              <div className="w-full space-y-1.5 flex flex-col items-center">
                {[
                  {
                    id: "mekan" as const,
                    label: "Mekân",
                    testId: "plan-rail-mekan",
                    onClick: () => {
                      if (planLeftOpen && planLeftRailTab === "mekan") {
                        setPlanLeftOpen(false);
                      } else {
                        setPlanLeftRailTab("mekan");
                        setPlanLeftWorkflowTab("wall_structure");
                        setPlanLeftOpen(true);
                      }
                    },
                    icon: (
                      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.9">
                        <path d="M3 21V3h18v12h-9v6H3z" />
                      </svg>
                    ),
                  },
                  {
                    id: "moduller" as const,
                    label: "Modüller",
                    testId: "plan-rail-moduller",
                    onClick: () => {
                      if (planLeftOpen && planLeftRailTab === "moduller") {
                        setPlanLeftOpen(false);
                      } else {
                        setPlanLeftRailTab("moduller");
                        setPlanLeftWorkflowTab("furniture_placement");
                        setPlanLeftOpen(true);
                      }
                    },
                    icon: <Package className="w-4 h-4" />,
                  },
                  {
                    id: "olcu" as const,
                    label: "Ölçü",
                    testId: "plan-rail-olcu",
                    onClick: () => {
                      if (planLeftOpen && planLeftRailTab === "olcu") {
                        setPlanLeftOpen(false);
                      } else {
                        setPlanLeftRailTab("olcu");
                        setPlanLeftOpen(true);
                      }
                    },
                    icon: <Ruler className="w-4 h-4" />,
                  },
                  {
                    id: "katmanlar" as const,
                    label: "Katmanlar",
                    testId: "plan-rail-katmanlar",
                    onClick: () => {
                      if (planLeftOpen && planLeftRailTab === "katmanlar") {
                        setPlanLeftOpen(false);
                      } else {
                        setPlanLeftRailTab("katmanlar");
                        setPlanLeftOpen(true);
                      }
                    },
                    icon: <Layers className="w-4 h-4" />,
                  },
                  {
                    id: "gorunum" as const,
                    label: "Görünüm",
                    testId: "plan-rail-gorunum",
                    onClick: () => {
                      if (planLeftOpen && planLeftRailTab === "gorunum") {
                        setPlanLeftOpen(false);
                      } else {
                        setPlanLeftRailTab("gorunum");
                        setPlanLeftOpen(true);
                      }
                    },
                    icon: <Eye className="w-4 h-4" />,
                  },
                  {
                    id: "dxf" as const,
                    label: "DXF / DWG",
                    testId: "plan-rail-dxf",
                    onClick: () => {
                      if (planLeftOpen && planLeftRailTab === "dxf") {
                        setPlanLeftOpen(false);
                      } else {
                        setPlanLeftRailTab("dxf");
                        setPlanLeftOpen(true);
                      }
                    },
                    icon: <FileSpreadsheet className="w-4 h-4" />,
                  },
                  {
                    id: "ayarlar" as const,
                    label: "Ayarlar",
                    testId: "plan-rail-ayarlar",
                    onClick: () => {
                      if (planLeftOpen && planLeftRailTab === "ayarlar") {
                        setPlanLeftOpen(false);
                      } else {
                        setPlanLeftRailTab("ayarlar");
                        setPlanLeftOpen(true);
                      }
                    },
                    icon: <Wrench className="w-4 h-4" />,
                  },
                ].map((railItem) => {
                  const isAct = planLeftRailTab === railItem.id;
                  return (
                    <button
                      key={railItem.id}
                      type="button"
                      title={railItem.label}
                      data-testid={railItem.testId}
                      onClick={railItem.onClick}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition cursor-pointer ${
                        isAct
                          ? "birim-ice-btn-active"
                          : "text-[#475569] hover:bg-white/75 hover:text-[#111827]"
                      }`}
                    >
                      {railItem.icon}
                      <span className="sr-only">{railItem.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-col items-center gap-1.5">
                <button
                  type="button"
                  data-testid="plan-toggle-left-panel-btn"
                  onClick={() => setPlanLeftOpen((v) => !v)}
                  title={planLeftOpen ? "Sol Paneli Daralt" : "Sol Paneli Aç"}
                  className="w-10 h-10 rounded-2xl bg-white/72 hover:bg-white/92 border border-white/88 shadow-2xs flex items-center justify-center text-[#3A3632] hover:text-[#141413] transition cursor-pointer"
                >
                  <ChevronRight
                    className={`w-4 h-4 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                      planLeftOpen ? "rotate-180" : "rotate-0"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* PLAN LEFT PANEL MAIN CONTENT — ALWAYS MOUNTED INSIDE UNIFIED FROSTED SHELL */}
            <div className="flex-1 min-w-0 h-full overflow-hidden">
              <div
                aria-hidden={!planLeftOpen}
                className={`h-full flex flex-col min-h-0 ${
                  planLeftOpen ? "birim-ice-drawer-open" : "birim-ice-drawer-closed"
                }`}
                style={{
                  width: isCompactViewport
                    ? "min(320px, calc(100vw - 80px))"
                    : `${Math.max(240, planLeftWidthPx - 56)}px`,
                }}
              >
                {(planLeftRailTab === "mekan" || planLeftRailTab === "moduller") ? (
                  <>
                {/* Title + 2 Workflow Tabs */}
                <div className="px-3.5 pt-3 pb-2 border-b border-[#E2E8F0] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-extrabold text-[#111827]">Mekân Çizimi</h2>
                    <span className="text-[11px] font-mono text-[#64748B]">
                      {activeSpatialMetrics.roomAreaM2.toLocaleString("tr-TR", {
                        minimumFractionDigits: 2,
                      })}{" "}
                      m²
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#F1F5F9] border border-[#E2E8F0]">
                    <button
                      type="button"
                      data-testid="plan-tab-wall-structure"
                      onClick={() => {
                        setPlanLeftWorkflowTab("wall_structure");
                        setPlanLeftRailTab("mekan");
                      }}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                        planLeftWorkflowTab === "wall_structure"
                          ? "bg-[#2563EB] text-white shadow-xs"
                          : "text-[#475569] hover:text-[#111827]"
                      }`}
                    >
                      Duvar & Yapı
                    </button>
                    <button
                      type="button"
                      data-testid="plan-tab-furniture-placement"
                      onClick={() => {
                        setPlanLeftWorkflowTab("furniture_placement");
                        setPlanLeftRailTab("moduller");
                      }}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                        planLeftWorkflowTab === "furniture_placement"
                          ? "bg-[#2563EB] text-white shadow-xs"
                          : "text-[#475569] hover:text-[#111827]"
                      }`}
                    >
                      Mobilya Yerleşimi
                    </button>
                  </div>
                </div>

                {planLeftWorkflowTab === "wall_structure" ? (
                  /* TAB 1: DUVAR & YAPI (Matches image_da6ae9.jpg 1-to-1) */
                  <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-4 text-xs">
                    {/* SECTION A: ÇİZİM ARAÇLARI (3x3 Visual Grid) */}
                    <section className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#111827]">Çizim Araçları</span>
                        <span className="text-[11px] text-[#64748B]">Tıkla & Yerleştir</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 p-0.5">
                        {[
                          {
                            id: "wall" as const,
                            label: "Duvar",
                            testId: "plan-tool-wall",
                            onClick: () => {
                              startTransition(() => {
                                setPlanActiveDrawingTool("wall");
                                dispatchPlanToolAction({ action: "draw_wall" });
                              });
                            },
                            svg: (
                              <svg viewBox="0 0 36 28" className="w-7 h-6" fill="none">
                                <rect x="4" y="10" width="28" height="8" rx="1.5" fill="#DBEAFE" stroke="currentColor" strokeWidth="1.8" />
                                <line x1="12" y1="10" x2="12" y2="18" stroke="currentColor" strokeWidth="1.4" />
                                <line x1="24" y1="10" x2="24" y2="18" stroke="currentColor" strokeWidth="1.4" />
                              </svg>
                            ),
                          },
                          {
                            id: "room" as const,
                            label: "Oda",
                            testId: "plan-tool-room",
                            onClick: () => {
                              startTransition(() => {
                                setPlanActiveDrawingTool("room");
                                dispatchPlanToolAction({ action: "draw_room" });
                              });
                            },
                            svg: (
                              <svg viewBox="0 0 36 28" className="w-7 h-6" fill="none">
                                <rect x="6" y="4" width="24" height="20" rx="1.5" stroke="currentColor" strokeWidth="2" />
                                <rect x="9" y="7" width="18" height="14" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 2" />
                              </svg>
                            ),
                          },
                          {
                            id: "partition" as const,
                            label: "Bölme",
                            testId: "plan-tool-partition",
                            onClick: () => {
                              startTransition(() => {
                                setPlanActiveDrawingTool("partition");
                                dispatchPlanToolAction({
                                  action: "place_obstacle",
                                  obstacleType: "partition",
                                  immediate: true,
                                });
                              });
                            },
                            svg: (
                              <svg viewBox="0 0 36 28" className="w-7 h-6" fill="none">
                                <rect x="5" y="4" width="26" height="20" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
                                <line x1="18" y1="4" x2="18" y2="24" stroke="#2563EB" strokeWidth="2.5" />
                              </svg>
                            ),
                          },
                          {
                            id: "door" as const,
                            label: "Kapı",
                            testId: "plan-tool-door",
                            onClick: () => {
                              startTransition(() => {
                                setPlanActiveDrawingTool("door");
                                dispatchPlanToolAction({
                                  action: "place_obstacle",
                                  obstacleType: "door",
                                  immediate: true,
                                });
                              });
                            },
                            svg: (
                              <svg viewBox="0 0 36 28" className="w-7 h-6" fill="none">
                                <line x1="8" y1="22" x2="8" y2="6" stroke="currentColor" strokeWidth="2.2" />
                                <path d="M8 6 A 16 16 0 0 1 24 22" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" />
                                <line x1="4" y1="22" x2="30" y2="22" stroke="currentColor" strokeWidth="1.8" />
                              </svg>
                            ),
                          },
                          {
                            id: "window" as const,
                            label: "Pencere",
                            testId: "plan-tool-window",
                            onClick: () => {
                              startTransition(() => {
                                setPlanActiveDrawingTool("window");
                                dispatchPlanToolAction({
                                  action: "place_obstacle",
                                  obstacleType: "window",
                                  immediate: true,
                                });
                              });
                            },
                            svg: (
                              <svg viewBox="0 0 36 28" className="w-7 h-6" fill="none">
                                <rect x="6" y="6" width="24" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
                                <line x1="18" y1="6" x2="18" y2="22" stroke="currentColor" strokeWidth="1.5" />
                                <line x1="6" y1="14" x2="30" y2="14" stroke="currentColor" strokeWidth="1.5" />
                              </svg>
                            ),
                          },
                          {
                            id: "niche" as const,
                            label: "Niş",
                            testId: "plan-tool-niche",
                            onClick: () => {
                              startTransition(() => {
                                setPlanActiveDrawingTool("niche");
                                dispatchPlanToolAction({
                                  action: "place_obstacle",
                                  obstacleType: "niche",
                                  immediate: true,
                                });
                              });
                            },
                            svg: (
                              <svg viewBox="0 0 36 28" className="w-7 h-6" fill="none">
                                <path d="M4 18 H11 V8 H25 V18 H32" stroke="currentColor" strokeWidth="2" />
                              </svg>
                            ),
                          },
                          {
                            id: "column" as const,
                            label: "Kolon",
                            testId: "plan-tool-column",
                            onClick: () => {
                              startTransition(() => {
                                setPlanActiveDrawingTool("column");
                                dispatchPlanToolAction({
                                  action: "place_obstacle",
                                  obstacleType: "column",
                                  immediate: true,
                                });
                              });
                            },
                            svg: (
                              <svg viewBox="0 0 36 28" className="w-7 h-6" fill="none">
                                <rect x="10" y="6" width="16" height="16" rx="1.5" fill="#E2E8F0" stroke="currentColor" strokeWidth="2" />
                                <line x1="10" y1="6" x2="26" y2="22" stroke="currentColor" strokeWidth="1.3" />
                                <line x1="26" y1="6" x2="10" y2="22" stroke="currentColor" strokeWidth="1.3" />
                              </svg>
                            ),
                          },
                          {
                            id: "beam" as const,
                            label: "Kiriş",
                            testId: "plan-tool-beam",
                            onClick: () => {
                              startTransition(() => {
                                setPlanActiveDrawingTool("beam");
                                dispatchPlanToolAction({
                                  action: "place_obstacle",
                                  obstacleType: "beam",
                                  immediate: true,
                                });
                              });
                            },
                            svg: (
                              <svg viewBox="0 0 36 28" className="w-7 h-6" fill="none">
                                <rect x="5" y="9" width="26" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.8" strokeDasharray="3 2" />
                                <line x1="5" y1="14" x2="31" y2="14" stroke="currentColor" strokeWidth="1.4" />
                              </svg>
                            ),
                          },
                          {
                            id: "protrusion" as const,
                            label: "Çıkıntı",
                            testId: "plan-tool-protrusion",
                            onClick: () => {
                              startTransition(() => {
                                setPlanActiveDrawingTool("protrusion");
                                dispatchPlanToolAction({
                                  action: "place_obstacle",
                                  obstacleType: "protrusion",
                                  immediate: true,
                                });
                              });
                            },
                            svg: (
                              <svg viewBox="0 0 36 28" className="w-7 h-6" fill="none">
                                <path d="M4 10 H12 V20 H24 V10 H32" stroke="currentColor" strokeWidth="2" />
                              </svg>
                            ),
                          },
                        ].map((tool) => {
                          const isActTool = planActiveDrawingTool === tool.id;
                          return (
                            <button
                              key={tool.id}
                              type="button"
                              data-testid={tool.testId}
                              onClick={tool.onClick}
                              className={`p-2.5 rounded-2xl border flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                                isActTool
                                  ? "bg-[#EFF6FF] border-2 border-[#2563EB] text-[#1D4ED8] font-bold shadow-2xs"
                                  : "bg-[#F8FAFC] hover:bg-[#EFF6FF]/40 border-[#E2E8F0] text-[#1E293B] font-semibold"
                              }`}
                            >
                              {tool.svg}
                              <span className="text-[11px] leading-tight">{tool.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </section>

                    {/* SECTION B: DUVAR AYARLARI (Matches image_da6ae9.jpg: Kalınlık | Yükseklik | Duvar Tipi) */}
                    <section
                      data-testid="plan-wall-settings-section"
                      className="pt-3 border-t border-[#E2E8F0] space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#111827]">Duvar Ayarları</span>
                        <span className="text-[11px] font-mono text-[#64748B]">
                          {activeSpatialMetrics.hostWallName}
                        </span>
                      </div>

                      {/* Kalınlık */}
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-[13px] font-medium text-[#475569]">Kalınlık</label>
                        <select
                          data-testid="plan-wall-thickness-select"
                          value={activeSpatialMetrics.hostWallThicknessMm}
                          onChange={(e) =>
                            setAllWallsSettings({
                              thickness: Number(e.target.value) || 200,
                            })
                          }
                          className="w-36 px-2.5 py-1.5 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] text-[13px] font-bold text-[#111827] cursor-pointer"
                        >
                          <option value={100}>100 mm</option>
                          <option value={120}>120 mm</option>
                          <option value={150}>150 mm</option>
                          <option value={200}>200 mm</option>
                          <option value={250}>250 mm</option>
                        </select>
                      </div>

                      {/* Yükseklik */}
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-[13px] font-medium text-[#475569]">Yükseklik</label>
                        <select
                          data-testid="plan-wall-height-select"
                          value={activeSpatialMetrics.roomHeightMm}
                          onChange={(e) =>
                            setAllWallsSettings({
                              height: Number(e.target.value) || 2700,
                            })
                          }
                          className="w-36 px-2.5 py-1.5 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] text-[13px] font-bold text-[#111827] cursor-pointer"
                        >
                          <option value={2400}>2400 mm</option>
                          <option value={2600}>2600 mm</option>
                          <option value={2700}>2700 mm</option>
                          <option value={2800}>2800 mm</option>
                          <option value={3000}>3000 mm</option>
                        </select>
                      </div>

                      {/* Duvar Tipi */}
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-[13px] font-medium text-[#475569]">Duvar Tipi</label>
                        <select
                          data-testid="plan-wall-type-select"
                          value={activeSpatialMetrics.hostWallType}
                          onChange={(e) =>
                            setAllWallsSettings({
                              wallType: e.target.value as
                                | "standard"
                                | "concrete"
                                | "drywall"
                                | "niche_wall",
                            })
                          }
                          className="w-36 px-2.5 py-1.5 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] text-[13px] font-bold text-[#111827] cursor-pointer"
                        >
                          <option value="standard">Standart</option>
                          <option value="concrete">Taşıyıcı Betonarme</option>
                          <option value="drywall">Alçıpan Bölme</option>
                          <option value="niche_wall">Niş Duvarı</option>
                        </select>
                      </div>
                    </section>

                    {/* SECTION C: HAZIR MEKÂN ŞABLONLARI (Matches image_da6ae9.jpg: Dikdörtgen | L Tipi | U Tipi) */}
                    <section
                      data-testid="plan-room-templates-section"
                      className="pt-3 border-t border-[#E2E8F0] space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#111827]">
                          Hazır Mekân Şablonları
                        </span>
                        <span className="text-[10px] text-[#64748B]">Oda Geometrisi</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 p-0.5">
                        {[
                          {
                            id: "rectangular" as const,
                            label: "Dikdörtgen",
                            testId: "plan-room-shape-rectangular",
                            svg: (
                              <svg viewBox="0 0 44 34" className="w-9 h-7" fill="none">
                                <rect
                                  x="6"
                                  y="5"
                                  width="32"
                                  height="24"
                                  rx="2"
                                  fill="#DBEAFE"
                                  stroke="currentColor"
                                  strokeWidth="2.2"
                                />
                              </svg>
                            ),
                          },
                          {
                            id: "l_shape" as const,
                            label: "L Tipi",
                            testId: "plan-room-shape-l_shape",
                            svg: (
                              <svg viewBox="0 0 44 34" className="w-9 h-7" fill="none">
                                <path
                                  d="M6 5 H38 V17 H22 V29 H6 Z"
                                  fill="#DBEAFE"
                                  stroke="currentColor"
                                  strokeWidth="2.2"
                                />
                              </svg>
                            ),
                          },
                          {
                            id: "u_shape" as const,
                            label: "U Tipi",
                            testId: "plan-room-shape-u_shape",
                            svg: (
                              <svg viewBox="0 0 44 34" className="w-9 h-7" fill="none">
                                <path
                                  d="M6 5 H38 V29 H28 V15 H16 V29 H6 Z"
                                  fill="#DBEAFE"
                                  stroke="currentColor"
                                  strokeWidth="2.2"
                                />
                              </svg>
                            ),
                          },
                        ].map((sh) => {
                          const isSelShape = planRoomShapePreset === sh.id;
                          return (
                            <button
                              key={sh.id}
                              type="button"
                              data-testid={sh.testId}
                              onClick={() => {
                                setPlanRoomShapePreset(sh.id);
                                applyRoomShapePreset(sh.id);
                              }}
                              className={`p-2.5 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition cursor-pointer ${
                                isSelShape
                                  ? "bg-[#EFF6FF] border-2 border-[#2563EB] text-[#1D4ED8] font-bold shadow-2xs"
                                  : "bg-[#F8FAFC] hover:bg-[#EFF6FF]/40 border-[#E2E8F0] text-[#1E293B] font-semibold"
                              }`}
                            >
                              {sh.svg}
                              <span className="text-[11px] leading-tight">{sh.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </section>

                    {/* SECTION D: DXF / DWG / PDF ALT PLAN YÜKLEME KARTI */}
                    <section className="pt-3 border-t border-[#E2E8F0] space-y-2">
                      <button
                        type="button"
                        data-testid="plan-left-dxf-upload-btn"
                        onClick={() => dispatchPlanToolAction({ action: "open_dxf_upload" })}
                        className="w-full py-2 px-3 rounded-xl bg-[#F8FAFC] hover:bg-[#EFF6FF] border border-[#CBD5E1] text-xs font-bold text-[#1E293B] flex items-center justify-center gap-2 transition cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-[#2563EB]" />
                        <span>DXF / DWG / PDF Altlık Yükle</span>
                      </button>
                    </section>
                  </div>
                ) : (
                  /* TAB 2: MOBİLYA YERLEŞİMİ (FAZ 2: Module Placement + Search + Alignment) */
                  <div className="flex-1 flex flex-col min-h-0">
                    <div className="px-3.5 pt-2.5 pb-2 space-y-2 border-b border-[#E2E8F0]">
                      <input
                        type="text"
                        data-testid="plan-furniture-search-input"
                        value={catalogSearchQuery}
                        onChange={(e) => setCatalogSearchQuery(e.target.value)}
                        placeholder="Plana eklenecek modül ara..."
                        className="w-full px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] text-xs font-medium text-[#111827]"
                      />
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { id: "dolap", label: "Gardırop", fam: "fam_wardrobe" as ModuleFamilyId },
                          { id: "kose", label: "Köşe", fam: "fam_special_corner" as ModuleFamilyId },
                          { id: "alt", label: "Alt Dolap", fam: "fam_kitchen_base" as ModuleFamilyId },
                          { id: "ust", label: "Üst Dolap", fam: "fam_kitchen_wall" as ModuleFamilyId },
                          { id: "ozel", label: "Boy Dolap", fam: "fam_kitchen_tall" as ModuleFamilyId },
                        ].map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => {
                              setLeftSubCat(cat.id);
                              setSelectedV4Family(cat.fam);
                            }}
                            className={`px-2.5 py-1 rounded-full text-[11px] shrink-0 transition cursor-pointer border ${
                              leftSubCat === cat.id
                                ? "bg-[#2563EB] text-white border-[#1D4ED8] font-bold"
                                : "bg-[#F8FAFC] text-[#475569] border-[#E2E8F0] font-medium"
                            }`}
                          >
                            {cat.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto px-3.5 py-2.5 space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        {familyTemplates.slice(0, 12).map((vt) => (
                          <div
                            key={vt.templateId}
                            draggable={true}
                            onDragStart={(e) => startModuleSilhouetteDrag(e, vt.templateId)}
                            onDragEnd={() => setActiveDraggedTemplateId(null)}
                            onClick={() => dropV4TemplateWithSnap(vt.templateId)}
                            className="p-2 rounded-2xl border border-[#E2E8F0] hover:border-[#2563EB] bg-[#F8FAFC]/80 hover:bg-[#EFF6FF]/50 flex flex-col items-center text-center justify-between gap-1 transition cursor-pointer"
                          >
                            <V3IsometricModuleIcon template={vt} size="md" />
                            <div className="text-[11px] font-bold text-[#111827] line-clamp-1">
                              {vt.name.replace(/^V4\s+/i, "")}
                            </div>
                            <span className="px-2 py-0.5 rounded-lg bg-[#EFF6FF] text-[#1D4ED8] text-[10px] font-bold">
                              + Plana Ekle
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                  </>
                ) : planLeftRailTab === "olcu" ? (
                  <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3 text-xs">
                    <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2">
                      <h2 className="text-sm font-extrabold text-[#111827]">Ölçü & Hizalama</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShow3DDimensions((prev) => !prev);
                        dispatchPlanToolAction({ action: "toggle_dimensions" });
                      }}
                      className={`w-full px-3 py-2 rounded-xl border text-left font-bold flex items-center justify-between cursor-pointer transition ${
                        show3DDimensions
                          ? "bg-[#EFF6FF] border-[#93C5FD] text-[#1D4ED8]"
                          : "bg-white border-[#E2E8F0] text-[#334155] hover:bg-slate-50"
                      }`}
                    >
                      <span>📏 2D / 3D Ölçü Çizgileri</span>
                      <span>{show3DDimensions ? "Açık" : "Kapalı"}</span>
                    </button>
                    <div className="p-2.5 rounded-xl bg-white/80 border border-[#E2E8F0] space-y-2">
                      <div className="font-bold text-[#334155]">Izgara / Adım Hassasiyeti (mm)</div>
                      <div className="grid grid-cols-5 gap-1">
                        {[1, 10, 25, 50, 100].map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setSnapMm(s)}
                            className={`py-1.5 rounded-lg font-mono font-bold border cursor-pointer transition ${
                              snapMm === s
                                ? "bg-[#2563EB] text-white border-[#2563EB]"
                                : "bg-white text-[#334155] border-[#E2E8F0] hover:bg-slate-50"
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => dispatchPlanToolAction({ action: "toggle_snaps" })}
                      className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] bg-white hover:bg-slate-50 text-left font-bold text-[#111827] cursor-pointer transition"
                    >
                      🧲 Mıknatıslı Yapışmayı Aç / Kapat
                    </button>
                    <button
                      type="button"
                      onClick={() => dispatchPlanToolAction({ action: "offset_wall", offsetMm: 100 })}
                      className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] bg-white hover:bg-slate-50 text-left font-bold text-[#111827] cursor-pointer transition"
                    >
                      ↔️ Duvar Ofseti (+100 mm)
                    </button>
                  </div>
                ) : planLeftRailTab === "katmanlar" ? (
                  <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3 text-xs">
                    <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2">
                      <h2 className="text-sm font-extrabold text-[#111827]">Katmanlar</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => dispatchPlanToolAction({ action: "toggle_grid" })}
                      className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] bg-white hover:bg-slate-50 text-left font-bold text-[#111827] cursor-pointer transition"
                    >
                      ⊞ Zemin Izgarasını (Grid) Aç / Kapat
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShow3DDimensions((prev) => !prev);
                        dispatchPlanToolAction({ action: "toggle_dimensions" });
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] bg-white hover:bg-slate-50 text-left font-bold flex items-center justify-between text-[#111827] cursor-pointer transition"
                    >
                      <span>📐 Ölçü Katmanı</span>
                      <span className="text-[#2563EB]">{show3DDimensions ? "Görünür" : "Gizli"}</span>
                    </button>
                    <div className="p-2.5 rounded-xl bg-white/80 border border-[#E2E8F0] space-y-1.5 text-[#334155]">
                      <div className="font-bold text-[#111827]">Sahne Özeti</div>
                      <div className="flex justify-between"><span>Duvarlar</span><span className="font-mono font-bold">{project.space.walls.length}</span></div>
                      <div className="flex justify-between"><span>Yapı Elemanları</span><span className="font-mono font-bold">{project.space.elements.length}</span></div>
                      <div className="flex justify-between"><span>Dolap / Modüller</span><span className="font-mono font-bold">{project.modules.length}</span></div>
                    </div>
                  </div>
                ) : planLeftRailTab === "gorunum" ? (
                  <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3 text-xs">
                    <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2">
                      <h2 className="text-sm font-extrabold text-[#111827]">Görünüm Düzeni</h2>
                    </div>
                    <div className="space-y-1.5">
                      {[
                        { id: "split" as const, label: "◫ 2D Plan + 3D Bölünmüş" },
                        { id: "2d_only" as const, label: "🗺️ Tam Ekran 2D Plan" },
                        { id: "3d_only" as const, label: "🧊 Tam Ekran 3D Sahne" },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setPlanViewLayout(opt.id)}
                          className={`w-full px-3 py-2 rounded-xl border text-left font-bold cursor-pointer transition ${
                            planViewLayout === opt.id
                              ? "bg-[#2563EB] text-white border-[#2563EB]"
                              : "bg-white text-[#111827] border-[#E2E8F0] hover:bg-slate-50"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {planViewLayout === "split" && (
                      <div className="p-2.5 rounded-xl bg-white/80 border border-[#E2E8F0] space-y-2">
                        <div className="flex justify-between font-bold text-[#334155]">
                          <span>2D / 3D Bölme Oranı</span>
                          <span className="font-mono">%{planSplitRatioPct}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                          {[40, 50, 60].map((pct) => (
                            <button
                              key={pct}
                              type="button"
                              onClick={() => setPlanSplitRatioPct(pct)}
                              className={`py-1.5 rounded-lg font-mono font-bold border cursor-pointer transition ${
                                Math.round(planSplitRatioPct) === pct
                                  ? "bg-[#2563EB] text-white border-[#2563EB]"
                                  : "bg-white text-[#334155] border-[#E2E8F0] hover:bg-slate-50"
                              }`}
                            >
                              %{pct}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : planLeftRailTab === "dxf" ? (
                  <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3 text-xs">
                    <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2">
                      <h2 className="text-sm font-extrabold text-[#111827]">DXF / DWG & Altlık</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => dispatchPlanToolAction({ action: "open_dxf_upload" })}
                      className="w-full px-3 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold cursor-pointer transition"
                    >
                      📂 DXF / DWG veya Kroki Yükle
                    </button>
                    <p className="text-[11px] text-[#475569] leading-relaxed">
                      Mimari DXF/DWG planınızı veya PNG/JPG krokinizi yükleyerek duvarları ölçekli olarak sahneye aktarabilirsiniz.
                    </p>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3 text-xs">
                    <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2">
                      <h2 className="text-sm font-extrabold text-[#111827]">Plan Ayarları</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => dispatchPlanToolAction({ action: "toggle_cad_bar" })}
                      className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] bg-white hover:bg-slate-50 text-left font-bold text-[#111827] cursor-pointer transition"
                    >
                      🧰 Alt CAD Araç Çubuğunu Aç / Gizle
                    </button>
                    <button
                      type="button"
                      onClick={() => dispatchPlanToolAction({ action: "toggle_snaps" })}
                      className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] bg-white hover:bg-slate-50 text-left font-bold text-[#111827] cursor-pointer transition"
                    >
                      🧲 Mıknatıslı Snap Aç / Kapat
                    </button>
                    <div className="p-2.5 rounded-xl bg-white/80 border border-[#E2E8F0] space-y-2 text-[#334155]">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#111827]">Mimari Tavan Sistemi</span>
                        <input
                          type="checkbox"
                          checked={Boolean(project.space.ceilingConfig?.enabled)}
                          onChange={(e) =>
                            updateCeilingConfig({
                              enabled: e.target.checked,
                              showIn3D: true,
                              showInElevation2D: true,
                            })
                          }
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        {CEILING_TYPE_CATALOG.map((ct) => {
                          const cCfg = resolveSpaceCeilingConfig(project.space);
                          const isAct = cCfg.enabled && cCfg.ceilingType === ct.id;
                          return (
                            <button
                              key={ct.id}
                              type="button"
                              onClick={() =>
                                updateCeilingConfig({
                                  enabled: true,
                                  ceilingType: ct.id,
                                  dropHeightMm:
                                    ct.defaultDropHeightMm > 0
                                      ? ct.defaultDropHeightMm
                                      : cCfg.dropHeightMm,
                                })
                              }
                              className={`px-2 py-1 rounded-lg border text-left text-[10.5px] font-bold cursor-pointer ${
                                isAct
                                  ? "bg-slate-900 text-white border-slate-900"
                                  : "bg-white hover:bg-slate-50 text-slate-800 border-slate-200"
                              }`}
                            >
                              {ct.icon} {ct.shortLabel}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex justify-between pt-1 border-t border-slate-200">
                        <span>Tavan Yüksekliği</span>
                        <span className="font-mono font-bold">{project.space.ceilingHeight} mm</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Snap Adımı</span>
                        <span className="font-mono font-bold">{snapMm} mm</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            </div>
          </aside>
        )}

        {/* LEFT PANEL — DESIGN STUDIO: UNIFIED SMOOTH-EXPANDING FROSTED ICE SHELL (image_cf849e.png <-> image_cd45e6.png) */}
        {mode === "studio" && (
          <aside
            data-testid="studio-left-library"
            className="absolute left-3.5 top-[62px] bottom-[64px] bg-transparent pointer-events-none text-[#111827] flex flex-row items-stretch z-30"
          >
            {/* SINGLE UNIFIED ROUNDED-[28px] FROSTED-ICE GLASS SHELL (Smoothly expands 56px <-> ~396px!) */}
            <div
              data-draggable-shell="studio-left-shell"
              className={`pointer-events-auto relative h-full birim-ice-rail-pill rounded-[28px] overflow-hidden flex flex-row items-stretch max-w-[calc(100vw-28px)] ${
                resizingPanel === "studio-left"
                  ? "birim-ice-resizing-none"
                  : !leftOpen
                  ? "birim-rail-expandable birim-ice-unified-shell"
                  : "birim-ice-unified-shell"
              }`}
              style={
                leftOpen
                  ? {
                      width: isCompactViewport
                        ? "min(392px, calc(100vw - 28px))"
                        : `min(${studioLeftWidthPx}px, clamp(368px, 29vw, 460px))`,
                    }
                  : undefined
              }
            >
              {leftOpen && !isCompactViewport && (
                <div
                  data-testid="studio-left-resize-handle"
                  title="Sol panel genişliğini değiştirmek için sürükleyin"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setResizingPanel("studio-left");
                  }}
                  className="pointer-events-auto absolute top-4 right-0 w-2.5 bottom-4 rounded-full cursor-col-resize hover:bg-white/60 z-40 transition-colors"
                />
              )}

              {/* INTEGRATED 56px ICON COLUMN INSIDE UNIFIED FROSTED SHELL */}
              <div
                data-testid="studio-left-icon-rail"
                onPointerDown={(e) => startZeroLagModalDrag(e, "[data-draggable-shell='studio-left-shell']")}
                className={`${
                  leftOpen ? "w-[56px] items-center border-r border-white/60 bg-white/14" : "w-full items-stretch border-r border-transparent"
                } h-full py-2.5 px-1.5 flex flex-col justify-between shrink-0 select-none cursor-grab active:cursor-grabbing transition-colors duration-300`}
              >
                <div className={`w-full space-y-1.5 flex flex-col ${leftOpen ? "items-center" : "items-stretch"}`}>
                  <button
                    type="button"
                    data-testid="studio-tab-quick-wizard"
                    onClick={() => {
                      startTransition(() => {
                        if (leftOpen && leftTab === "quick_wizard") {
                          setLeftOpen(false);
                        } else {
                          setLeftTab("quick_wizard");
                          setLeftOpen(true);
                        }
                      });
                    }}
                    className={`${leftOpen ? "w-10 justify-center" : "w-full px-2.5 justify-start"} h-10 rounded-2xl flex items-center transition cursor-pointer ${
                      leftOpen && leftTab === "quick_wizard"
                        ? "birim-ice-btn-active"
                        : !leftOpen && leftTab === "quick_wizard"
                        ? "birim-ice-rail-icon-active"
                        : "text-[#44403C] hover:bg-white/70 hover:text-[#141413]"
                    }`}
                    title="Hızlı Gövde Sihirbazı"
                  >
                    <Sparkles className="w-4 h-4" />
                    {!leftOpen ? <span className="birim-rail-item-label text-[11px] font-bold">Sihirbaz</span> : <span className="sr-only">Sihirbaz</span>}
                  </button>

                  <button
                    type="button"
                    data-testid="studio-tab-templates"
                    title="Modül Şablonları"
                    onClick={() => {
                      startTransition(() => {
                        if (leftOpen && leftTab === "templates") {
                          setLeftOpen(false);
                        } else {
                          setLeftTab("templates");
                          setStudioInspectorTab("dimensions");
                          setLeftOpen(true);
                        }
                      });
                    }}
                    className={`${leftOpen ? "w-10 justify-center" : "w-full px-2.5 justify-start"} h-10 rounded-2xl flex items-center transition cursor-pointer ${
                      leftOpen && leftTab === "templates"
                        ? "birim-ice-btn-active"
                        : !leftOpen && leftTab === "templates"
                        ? "birim-ice-rail-icon-active"
                        : "text-[#57534E] hover:bg-white/70 hover:text-[#141413]"
                    }`}
                  >
                    <Package className="w-4 h-4" />
                    {!leftOpen ? <span className="birim-rail-item-label text-[11px] font-bold">Modüller</span> : <span className="sr-only">Modüller</span>}
                  </button>

                  <button
                    type="button"
                    data-testid="studio-tab-interior"
                    onClick={() => {
                      startTransition(() => {
                        if (leftOpen && leftTab === "interior") {
                          setLeftOpen(false);
                        } else {
                          setLeftTab("interior");
                          setStudioInspectorTab("interior");
                          setLeftOpen(true);
                          if (doorOpenAngleDeg === 0 && !doorsHiddenStudio) {
                            setDoorOpenAngleDeg(85);
                          }
                        }
                      });
                    }}
                    className={`${leftOpen ? "w-10 justify-center" : "w-full px-2.5 justify-start"} h-10 rounded-2xl flex items-center transition cursor-pointer ${
                      leftOpen && leftTab === "interior"
                        ? "birim-ice-btn-active"
                        : !leftOpen && leftTab === "interior"
                        ? "birim-ice-rail-icon-active"
                        : "text-[#57534E] hover:bg-white/70 hover:text-[#141413]"
                    }`}
                    title="İç Düzen (Raf, Çekmece, Askılık ve Bölme)"
                  >
                    <Layers className="w-4 h-4" />
                    {!leftOpen ? <span className="birim-rail-item-label text-[11px] font-bold">İç Düzen</span> : <span className="sr-only">İç Düzen</span>}
                  </button>

                  <button
                    type="button"
                    data-testid="studio-tab-materials"
                    title="Malzeme, Renk ve Doku Kütüphanesi"
                    onClick={() => {
                      startTransition(() => {
                        if (leftOpen && leftTab === "materials") {
                          setLeftOpen(false);
                        } else {
                          setLeftTab("materials");
                          setStudioInspectorTab("material");
                          setLeftOpen(true);
                        }
                      });
                    }}
                    className={`${leftOpen ? "w-10 justify-center" : "w-full px-2.5 justify-start"} h-10 rounded-2xl flex items-center transition cursor-pointer ${
                      leftOpen && leftTab === "materials"
                        ? "birim-ice-btn-active"
                        : !leftOpen && leftTab === "materials"
                        ? "birim-ice-rail-icon-active"
                        : "text-[#57534E] hover:bg-white/70 hover:text-[#141413]"
                    }`}
                  >
                    <Palette className="w-4 h-4" />
                    {!leftOpen ? <span className="birim-rail-item-label text-[11px] font-bold">Malzeme</span> : <span className="sr-only">Malzeme</span>}
                  </button>

                  <button
                    type="button"
                    data-testid="studio-tab-hardware"
                    onClick={() => {
                      startTransition(() => {
                        if (leftOpen && leftTab === "hardware") {
                          setLeftOpen(false);
                        } else {
                          setLeftTab("hardware");
                          setStudioInspectorTab("all");
                          setLeftOpen(true);
                        }
                      });
                    }}
                    className={`${
                      isSimpleBlumMode ? "sr-only" : `${leftOpen ? "w-10 justify-center" : "w-full px-2.5 justify-start"} h-10 rounded-2xl flex items-center transition cursor-pointer`
                    } ${
                      leftOpen && leftTab === "hardware"
                        ? "birim-ice-btn-active"
                        : !leftOpen && leftTab === "hardware"
                        ? "birim-ice-rail-icon-active"
                        : "text-[#57534E] hover:bg-white/70 hover:text-[#141413]"
                    }`}
                    title="Blum, Hettich & Häfele Donanım Kütüphanesi"
                  >
                    <Wrench className="w-4 h-4" />
                    {!leftOpen ? <span className="birim-rail-item-label text-[11px] font-bold">Donanım</span> : <span className="sr-only">Donanım</span>}
                  </button>

                  <div className="w-7 h-px bg-slate-900/10 my-1" />

                  <button
                    type="button"
                    data-testid="open-custom-hardware-btn"
                    data-tooltip="Yeni Kulp & Özel Donanım Tanımla"
                    onClick={() => setShowCustomHardwareModal(true)}
                    className={`${leftOpen ? "w-10 justify-center" : "w-full px-2.5 justify-start"} h-10 rounded-2xl flex items-center text-[#57534E] hover:bg-white/75 hover:text-[#141413] transition cursor-pointer`}
                  >
                    <span className="text-sm leading-none">🔩</span>
                    {!leftOpen ? <span className="birim-rail-item-label text-[11px] font-bold">Yeni Kulp</span> : <span className="sr-only">Yeni Kulp &amp; Donanım</span>}
                  </button>

                  <button
                    type="button"
                    data-testid="open-island-table-btn"
                    data-tooltip="Şelale Ada Mutfak & Çok Açılı Masa Stüdyosu"
                    onClick={() => setShowIslandTableModal(true)}
                    className={`${leftOpen ? "w-10 justify-center" : "w-full px-2.5 justify-start"} h-10 rounded-2xl flex items-center text-[#57534E] hover:bg-white/75 hover:text-[#141413] transition cursor-pointer`}
                  >
                    <span className="text-sm leading-none">🏝️</span>
                    {!leftOpen ? <span className="birim-rail-item-label text-[11px] font-bold">Ada &amp; Masa</span> : <span className="sr-only">Ada Mutfak &amp; Masa</span>}
                  </button>

                  <button
                    type="button"
                    data-testid="v4-open-floating-catalog-btn"
                    data-tooltip="Tam Ekran Görsel Katalog"
                    onClick={() => setIsVisualCatalogOpen(true)}
                    className={`${leftOpen ? "w-10 justify-center" : "w-full px-2.5 justify-start"} h-10 rounded-2xl flex items-center text-[#57534E] hover:bg-white/75 hover:text-[#141413] transition cursor-pointer`}
                  >
                    <Maximize2 className="w-4 h-4" />
                    {!leftOpen ? <span className="birim-rail-item-label text-[11px] font-bold">Katalog</span> : <span className="sr-only">Katalog</span>}
                  </button>

                  <button
                    type="button"
                    data-testid="v3-open-projects-btn"
                    title="Kayıtlı Projeler"
                    onClick={() => setIsProjectModalOpen(true)}
                    className={`${leftOpen ? "w-10 justify-center" : "w-full px-2.5 justify-start"} h-10 rounded-2xl flex items-center text-[#57534E] hover:bg-white/75 hover:text-[#141413] transition cursor-pointer`}
                  >
                    <FolderOpen className="w-4 h-4" />
                    {!leftOpen ? <span className="birim-rail-item-label text-[11px] font-bold">Projeler</span> : <span className="sr-only">Projeler</span>}
                  </button>
                </div>

                <div className="flex flex-col items-center gap-1.5">
                  <button
                    type="button"
                    data-testid="studio-toggle-left"
                    onClick={() => setLeftOpen((v) => !v)}
                    title={leftOpen ? "Sol Paneli Daralt" : "Sol Paneli Aç"}
                    className="w-10 h-10 rounded-2xl bg-white/72 hover:bg-white/92 border border-white/88 shadow-2xs flex items-center justify-center text-[#3A3632] hover:text-[#141413] transition cursor-pointer"
                  >
                    <ChevronRight
                      className={`w-4 h-4 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                        leftOpen ? "rotate-180" : "rotate-0"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* ALWAYS-MOUNTED EXPANDING CONTENT PANE INSIDE UNIFIED FROSTED SHELL */}
              <div className="flex-1 min-w-0 h-full overflow-hidden">
                <div
                  aria-hidden={!leftOpen}
                  className={`h-full flex flex-col min-h-0 ${
                    leftOpen ? "birim-ice-drawer-open" : "birim-ice-drawer-closed"
                  }`}
                  style={{
                    width: isCompactViewport
                      ? "min(336px, calc(100vw - 84px))"
                      : `calc(min(${studioLeftWidthPx}px, clamp(368px, 29vw, 460px)) - 56px)`,
                  }}
                >

                {(() => {
                  if (leftTab === "quick_wizard") {
                    return (
                      /* HIZLI GÖVDE SİHİRBAZI (CANLI ÖNİZLEME + ANINDA 3D SENKRONİZASYON) */
                  <div
                    data-testid="quick-cabinet-wizard-panel"
                    className="flex-1 flex flex-col min-h-0 bg-transparent"
                  >
                    {/* Header (Zero-Lag Draggable) */}
                    <div
                      onPointerDown={(e) => startZeroLagModalDrag(e, "[data-draggable-shell='studio-left-shell']")}
                      className="px-4 py-3 birim-ice-shell-header cursor-grab active:cursor-grabbing select-none"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <h2 className="text-xs font-bold uppercase tracking-wider text-[#141413]">
                            Hızlı Gövde Sihirbazı
                          </h2>
                          <p className="text-[11px] text-[#78716C] mt-0.5">
                            Seçimleriniz anında sağdaki 3D modele yansır
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setQuickLiveSync((v) => !v)}
                          className={`px-2 py-1 rounded-md border text-[10px] font-semibold transition cursor-pointer ${
                            quickLiveSync
                              ? "bg-[#141413] text-[#FAF9F6] border-[#141413]"
                              : "bg-white text-[#57534E] border-[#DED8CC]"
                          }`}
                          title="Seçimleri tıkladığınız anda sağdaki 3D sahneye uygular"
                        >
                          {quickLiveSync ? "Canlı 3D: Açık" : "Canlı 3D: Kapalı"}
                        </button>
                      </div>

                      {/* Live Isometric Preview Card inside Wizard */}
                      <div className="mt-2.5 p-2.5 rounded-xl bg-white border border-[#DED8CC] flex items-center gap-3">
                        <V3IsometricModuleIcon module={quickWizardPreviewModule} size="md" />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-[#141413] truncate">
                            {quickCabinetWidth / 10} × {quickCabinetHeight / 10} × {quickCabinetDepth / 10} cm
                          </div>
                          <div className="text-[10px] font-mono text-[#78716C] mt-0.5">
                            {quickCabinetWidth}×{quickCabinetHeight}×{quickCabinetDepth} mm
                          </div>
                          <div className="text-[10px] font-semibold text-[#8C7A6B] mt-0.5">
                            {quickFrontType === "double_door"
                              ? "Çift Kapak • Frenli 110°"
                              : quickFrontType === "single_door_left"
                              ? "Sol Tek Kapak • 110°"
                              : quickFrontType === "single_door_right"
                              ? "Sağ Tek Kapak • 110°"
                              : quickFrontType === "drawers_3"
                              ? "3 Çekmeceli • LEGRABOX"
                              : quickFrontType === "drawers_2"
                              ? "2 Derin Çekmece"
                              : quickFrontType === "aventos_hf"
                              ? "AVENTOS HF Katlanır Kalkar"
                              : quickFrontType === "space_tower"
                              ? "SPACE TOWER 4 İç Çekmece"
                              : "Kapaksız Açık Raf"}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Content (Scrollable) */}
                    <div className="flex-1 overflow-y-auto p-3.5 space-y-4 text-xs">
                      {/* ADIM 1: GÖVDE TİPİ */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[#141413] text-xs flex items-center gap-1.5">
                            <span className="w-4 h-4 rounded-xs bg-[#141413] text-white text-[10px] flex items-center justify-center font-bold">1</span>
                            Gövde Tipi
                          </span>
                          <span className="text-[10px] text-[#78716C]">Standart Modül</span>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5">
                          {[
                            {
                              id: "base" as const,
                              title: "Alt Dolap",
                              sub: "Tezgâh Altı • 72 cm",
                              defW: 600, defH: 720, defD: 580,
                              defFront: "double_door" as const,
                            },
                            {
                              id: "drawers_3" as const,
                              title: "3 Çekmeceli Alt",
                              sub: "1+2 Derin Çekmece",
                              defW: 600, defH: 720, defD: 580,
                              defFront: "drawers_3" as const,
                            },
                            {
                              id: "wall" as const,
                              title: "Üst Dolap",
                              sub: "Duvara Asma • 72 cm",
                              defW: 600, defH: 720, defD: 350,
                              defFront: "double_door" as const,
                            },
                            {
                              id: "tall" as const,
                              title: "Boy Dolap / Kiler",
                              sub: "Yüksek • 210 cm",
                              defW: 600, defH: 2100, defD: 580,
                              defFront: "single_door_left" as const,
                            },
                            {
                              id: "wardrobe" as const,
                              title: "Gardırop",
                              sub: "Giyinme • 220 cm",
                              defW: 1000, defH: 2200, defD: 600,
                              defFront: "double_door" as const,
                            },
                            {
                              id: "corner" as const,
                              title: "Köşe Dolap",
                              sub: "90° L Dönüş • 90 cm",
                              defW: 900, defH: 720, defD: 900,
                              defFront: "single_door_left" as const,
                            },
                          ].map((c) => {
                            const isSelected = quickCabinetType === c.id;
                            return (
                              <button
                                key={c.id}
                                type="button"
                                data-testid={`quick-type-${c.id}`}
                                onClick={() => {
                                  setQuickCabinetType(c.id);
                                  setQuickCabinetWidth(c.defW);
                                  setQuickCabinetHeight(c.defH);
                                  setQuickCabinetDepth(c.defD);
                                  setQuickFrontType(c.defFront);
                                  syncQuickCabinetTo3D({
                                    type: c.id,
                                    w: c.defW,
                                    h: c.defH,
                                    d: c.defD,
                                    front: c.defFront,
                                  });
                                }}
                                className={`p-2.5 rounded-lg border text-left flex flex-col justify-between transition cursor-pointer ${
                                  isSelected
                                    ? "bg-[#141413] text-[#FAF9F6] border-[#141413]"
                                    : "bg-[#FAF9F6] hover:bg-[#EFECE5] text-[#141413] border-[#DED8CC]"
                                }`}
                              >
                                <div className="flex items-center justify-between w-full">
                                  <span className="font-bold text-xs leading-tight">{c.title}</span>
                                  {isSelected && (
                                    <span className="text-[10px] font-bold text-[#D6C7B2]">✓</span>
                                  )}
                                </div>
                                <div className={`text-[10px] mt-1 ${isSelected ? "text-[#D6C7B2]" : "text-[#78716C]"}`}>
                                  {c.sub}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* ADIM 2: STANDART EBATLAR */}
                      <div className="space-y-2 pt-2 border-t border-[#EFECE5]">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[#141413] text-xs flex items-center gap-1.5">
                            <span className="w-4 h-4 rounded-xs bg-[#141413] text-white text-[10px] flex items-center justify-center font-bold">2</span>
                            Modüler Genişlik
                          </span>
                          <span className="text-[11px] font-mono font-bold text-[#141413]">
                            {quickCabinetWidth / 10} cm ({quickCabinetWidth} mm)
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-1">
                          {[300, 450, 600, 800, 900, 1000, 1200, 1600].map((w) => (
                            <button
                              key={w}
                              type="button"
                              data-testid={`quick-width-${w}`}
                              onClick={() => {
                                setQuickCabinetWidth(w);
                                syncQuickCabinetTo3D({
                                  type: quickCabinetType,
                                  w,
                                  h: quickCabinetHeight,
                                  d: quickCabinetDepth,
                                  front: quickFrontType,
                                });
                              }}
                              className={`h-7 px-2.5 rounded-lg font-mono font-semibold text-xs transition cursor-pointer border ${
                                quickCabinetWidth === w
                                  ? "bg-[#141413] text-white border-[#141413]"
                                  : "bg-[#FAF9F6] hover:bg-[#EFECE5] text-[#44403C] border-[#DED8CC]"
                              }`}
                            >
                              {w / 10} cm
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* ADIM 3: ÖN CEPHE & DONANIM */}
                      <div className="space-y-2 pt-2 border-t border-[#EFECE5]">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[#141413] text-xs flex items-center gap-1.5">
                            <span className="w-4 h-4 rounded-xs bg-[#141413] text-white text-[10px] flex items-center justify-center font-bold">3</span>
                            Ön Cephe &amp; Fonksiyon
                          </span>
                          <span className="text-[10px] text-[#78716C]">Blum Standart</span>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5">
                          {[
                            {
                              id: "single_door_left" as const,
                              title: "Tek Kapak (Sol)",
                              sub: "Blum 110° Frenli",
                              badge: "CLIP top",
                            },
                            {
                              id: "single_door_right" as const,
                              title: "Tek Kapak (Sağ)",
                              sub: "Blum 110° Frenli",
                              badge: "CLIP top",
                            },
                            {
                              id: "double_door" as const,
                              title: "Çift Kapak",
                              sub: "2 Kapaklı Eşit Açılım",
                              badge: "CLIP top",
                            },
                            {
                              id: "drawers_3" as const,
                              title: "3 Çekmece",
                              sub: "1 Çatal-Kaşık + 2 Derin",
                              badge: "LEGRABOX",
                            },
                            {
                              id: "drawers_2" as const,
                              title: "2 Derin Çekmece",
                              sub: "Tencere/Kiler Çekmecesi",
                              badge: "LEGRABOX",
                            },
                            {
                              id: "aventos_hf" as const,
                              title: "AVENTOS HF",
                              sub: "İki Parçalı Kalkar Kapak",
                              badge: "AVENTOS",
                            },
                            {
                              id: "space_tower" as const,
                              title: "SPACE TOWER",
                              sub: "4 İç Çekmeceli Kiler",
                              badge: "155°",
                            },
                            {
                              id: "open" as const,
                              title: "Açık Gövde",
                              sub: "Kapaksız Raf Ünitesi",
                              badge: "Açık",
                            },
                          ].map((f) => {
                            const isSelected = quickFrontType === f.id;
                            return (
                              <button
                                key={f.id}
                                type="button"
                                data-testid={`quick-front-${f.id}`}
                                onClick={() => {
                                  setQuickFrontType(f.id);
                                  syncQuickCabinetTo3D({
                                    type: quickCabinetType,
                                    w: quickCabinetWidth,
                                    h: quickCabinetHeight,
                                    d: quickCabinetDepth,
                                    front: f.id,
                                  });
                                }}
                                className={`p-2.5 rounded-lg border text-left flex flex-col justify-between transition cursor-pointer ${
                                  isSelected
                                    ? "bg-[#141413] text-[#FAF9F6] border-[#141413]"
                                    : "bg-[#FAF9F6] hover:bg-[#EFECE5] text-[#141413] border-[#DED8CC]"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-bold text-[11px] truncate">{f.title}</span>
                                  <span
                                    className={`text-[9px] px-1.5 py-0.5 rounded-xs font-semibold shrink-0 ${
                                      isSelected
                                        ? "bg-[#292524] text-[#D6C7B2]"
                                        : "bg-white text-[#57534E] border border-[#DED8CC]"
                                    }`}
                                  >
                                    {f.badge}
                                  </span>
                                </div>
                                <div
                                  className={`text-[10px] mt-1 leading-tight ${
                                    isSelected ? "text-[#D6C7B2]" : "text-[#78716C]"
                                  }`}
                                >
                                  {f.sub}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Footer Action Buttons */}
                    <div className="p-3.5 border-t border-[#EFECE5] bg-[#FAF9F6] space-y-1.5">
                      <button
                        type="button"
                        data-testid="quick-wizard-apply-btn"
                        onClick={() => handleApplyQuickCabinet(false)}
                        className="w-full h-9 px-4 rounded-lg bg-[#141413] hover:bg-[#292524] text-[#FAF9F6] font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                      >
                        <CheckCircle className="w-3.5 h-3.5 text-[#D6C7B2]" />
                        <span>Seçili Modüle Uygula</span>
                      </button>
                      <button
                        type="button"
                        data-testid="quick-wizard-add-new-btn"
                        onClick={() => handleApplyQuickCabinet(true)}
                        className="w-full h-8 px-4 rounded-lg bg-white hover:bg-[#EFECE5] text-[#141413] font-semibold text-xs flex items-center justify-center gap-1.5 border border-[#DED8CC] transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 text-[#8C7A6B]" />
                        <span>Yanına Yeni Modül Olarak Ekle</span>
                      </button>
                    </div>
                  </div>
                    );
                  }
                  if (leftTab === "interior" || (leftTab === "templates" && studioInspectorTab === "interior")) {
                    return (
                      /* 🚪 İÇ DÜZEN KÜTÜPHANESİ (FULL HEIGHT) */
                  <div className="flex-1 flex flex-col min-h-0 bg-white">
                    {(() => {
                      const interiorLibraryCatalog = [
                        {
                          id: "lib_shelf",
                          cat: "raf" as const,
                          title: "Raf",
                          spec: "18–36 mm • Sürükle/Tıkla",
                          visual: "shelf" as const,
                          minW: 150,
                          maxW: 1200,
                          onAdd: () => addShelf(activeBayIndex),
                        },
                        {
                          id: "lib_sub_divider",
                          cat: "dikme" as const,
                          title: "Raf Arası Dikme",
                          spec: "2 Raf Arası Dikey Bölücü",
                          visual: "sub_divider" as const,
                          minW: 240,
                          maxW: 1200,
                          onAdd: () => addSubDivider(activeBayIndex),
                        },
                        {
                          id: "lib_carcass_divider",
                          cat: "dikme" as const,
                          title: "Ara Dikme (2'ye Böl)",
                          spec: "Seçili Bölmeyi 2'ye Böler",
                          visual: "carcass_divider" as const,
                          minW: 300,
                          maxW: 2400,
                          onAdd: () => splitBayIntoTwo(activeBayIndex),
                        },
                        {
                          id: "lib_rail",
                          cat: "askilik" as const,
                          title: "Askılık",
                          spec: "Ø25 mm",
                          visual: "rail" as const,
                          minW: 250,
                          maxW: 1200,
                          onAdd: () => addHangingRail(activeBayIndex),
                        },
                        {
                          id: "lib_drawer",
                          cat: "cekmece" as const,
                          title: "Çekmece",
                          spec: "H: 100–300 mm",
                          visual: "drawer" as const,
                          minW: 300,
                          maxW: 1200,
                          onAdd: () => addDrawer(activeBayIndex),
                        },
                        {
                          id: "lib_internal_drawer",
                          cat: "cekmece" as const,
                          title: "İç Çekmece",
                          spec: "H: 80–200 mm",
                          visual: "internal_drawer" as const,
                          minW: 300,
                          maxW: 1200,
                          onAdd: () => addInternalDrawer(activeBayIndex, 140),
                        },
                        {
                          id: "lib_trouser_rack",
                          cat: "pantolonluk" as const,
                          title: "Pantolonluk",
                          spec: "G: 600–900 mm",
                          visual: "trouser_rack" as const,
                          minW: 380,
                          maxW: 1000,
                          onAdd: () => addSpecialFitting(activeBayIndex, "trouser_rack"),
                        },
                        {
                          id: "lib_shoe_rack",
                          cat: "ayakkabilik" as const,
                          title: "Ayakkabılık",
                          spec: "Eğimli / Düz",
                          visual: "shoe_rack" as const,
                          minW: 350,
                          maxW: 1100,
                          onAdd: () => addSpecialFitting(activeBayIndex, "shoe_rack"),
                        },
                        {
                          id: "lib_tie_rack",
                          cat: "kravatlik" as const,
                          title: "Kravatlık",
                          spec: "G: 300–600 mm",
                          visual: "tie_rack" as const,
                          minW: 250,
                          maxW: 1200,
                          onAdd: () => addSpecialFitting(activeBayIndex, "tie_rack"),
                        },
                        {
                          id: "lib_belt_rack",
                          cat: "kemerlik" as const,
                          title: "Kemerlik",
                          spec: "G: 300–600 mm",
                          visual: "belt_rack" as const,
                          minW: 250,
                          maxW: 1200,
                          onAdd: () => addSpecialFitting(activeBayIndex, "belt_rack"),
                        },
                        {
                          id: "lib_wardrobe_lift",
                          cat: "askilik" as const,
                          title: "Gardırop Asansörü",
                          spec: "Servetto 10 kg",
                          visual: "wardrobe_lift" as const,
                          minW: 450,
                          maxW: 1150,
                          onAdd: () => addSpecialFitting(activeBayIndex, "wardrobe_lift"),
                        },
                        {
                          id: "lib_wire_basket",
                          cat: "cekmece" as const,
                          title: "Tel Sepet",
                          spec: "H: 150 mm",
                          visual: "wire_basket" as const,
                          minW: 350,
                          maxW: 1000,
                          onAdd: () => addSpecialFitting(activeBayIndex, "wire_basket"),
                        },
                        {
                          id: "lib_jewelry_tray",
                          cat: "cekmece" as const,
                          title: "Takı Çekmecesi",
                          spec: "Kadife Bölümlü",
                          visual: "jewelry_tray" as const,
                          minW: 350,
                          maxW: 1000,
                          onAdd: () => addSpecialFitting(activeBayIndex, "jewelry_tray"),
                        },
                        {
                          id: "lib_led_profile",
                          cat: "raf" as const,
                          title: "Loox5 LED",
                          spec: "3000K + Sensör",
                          visual: "led_profile" as const,
                          minW: 200,
                          maxW: 2400,
                          onAdd: () => addSpecialFitting(activeBayIndex, "led_profile"),
                        },
                      ];

                      const qLib = interiorLibSearch.trim().toLowerCase();
                      const filteredInteriorCatalog = interiorLibraryCatalog.filter((it) => {
                        if (interiorLibCat !== "all" && it.cat !== interiorLibCat) return false;
                        if (
                          qLib &&
                          !it.title.toLowerCase().includes(qLib) &&
                          !it.spec.toLowerCase().includes(qLib)
                        ) {
                          return false;
                        }
                        return true;
                      });

                      return (
                        <div
                          data-testid="interior-library-panel"
                          className="bg-white flex flex-col flex-1 min-h-0"
                        >
                          {/* Header: İç Düzen Kütüphanesi */}
                          <div className="px-3.5 pt-3 pb-1.5 flex items-center justify-between gap-2">
                            <div>
                              <h2 className="text-sm font-bold text-[#111827]">
                                İç Düzen Kütüphanesi
                              </h2>
                              <span className="text-[10px] text-[#2563EB] font-semibold">
                                Seçili: Bölme {activeBayIndex + 1} ({currentBayWidthMm} mm)
                              </span>
                            </div>
                            <span className="px-2 py-0.5 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] text-[10px] font-bold text-[#1D4ED8]">
                              🖐️ Sürükle-Bırak veya Tıkla
                            </span>
                          </div>

                          {/* Search Bar */}
                          <div className="px-3.5 pb-2 flex items-center gap-1.5">
                            <div className="relative flex-1 flex items-center">
                              <svg
                                className="w-3.5 h-3.5 text-[#64748B] absolute left-3 pointer-events-none"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <circle cx="11" cy="11" r="8" />
                                <path d="M21 21l-4.35-4.35" />
                              </svg>
                              <input
                                type="text"
                                data-testid="interior-library-search-input"
                                value={interiorLibSearch}
                                onChange={(e) => setInteriorLibSearch(e.target.value)}
                                placeholder="Raf, çekmece, askılık ara..."
                                className="w-full pl-8 pr-2.5 py-1.5 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] text-xs font-medium text-[#111827] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#2563EB]"
                              />
                            </div>
                          </div>

                          {/* Category Pills: Tümü | Raf | Askılık | Çekmece | Pantolonluk | Ayakkabılık | Kravatlık | Kemerlik */}
                          <div className="px-3.5 py-2.5 flex flex-wrap gap-1.5 border-b border-[#E2E8F0] bg-[#F8FAFC]">
                            {[
                              { id: "all" as const, label: "Tümü" },
                              { id: "raf" as const, label: "Raf" },
                              { id: "dikme" as const, label: "Dikme & Bölücü" },
                              { id: "askilik" as const, label: "Askılık" },
                              { id: "cekmece" as const, label: "Çekmece" },
                              { id: "pantolonluk" as const, label: "Pantolonluk" },
                              { id: "ayakkabilik" as const, label: "Ayakkabılık" },
                              { id: "kravatlik" as const, label: "Kravatlık" },
                              { id: "kemerlik" as const, label: "Kemerlik" },
                            ].map((cPill) => {
                              const activePill = interiorLibCat === cPill.id;
                              return (
                                <button
                                  key={cPill.id}
                                  type="button"
                                  data-testid={`interior-lib-cat-${cPill.id}`}
                                  onClick={() => setInteriorLibCat(cPill.id)}
                                  className={`px-2.5 py-1 rounded-full text-[11px] shrink-0 transition cursor-pointer border ${
                                    activePill
                                      ? "bg-[#EFF6FF] text-[#1D4ED8] border-[#2563EB] font-bold shadow-2xs"
                                      : "bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#475569] border-[#E2E8F0] font-medium"
                                  }`}
                                >
                                  {cPill.label}
                                </button>
                              );
                            })}
                          </div>

                          {/* Scrollable 2-Column Realistic Accessory Cards + Hazır İç Düzen Şablonları */}
                          <div className="flex-1 overflow-y-auto px-3.5 py-2.5 space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                              {filteredInteriorCatalog.map((item) => {
                                const isWidthCompatible =
                                  currentBayWidthMm >= item.minW && currentBayWidthMm <= item.maxW;
                                return (
                                  <div
                                    key={item.id}
                                    role="button"
                                    tabIndex={0}
                                    data-testid={`interior-lib-card-${item.id}`}
                                    draggable={true}
                                    onDragStart={(e) =>
                                      startAccessorySilhouetteDrag(e, {
                                        id: item.id,
                                        visual: item.visual,
                                        title: item.title,
                                        cat: item.cat,
                                        spec: item.spec,
                                      })
                                    }
                                    onDragEnd={() => {
                                      if (typeof window !== "undefined") {
                                        (window as any).__birimActiveDraggedAccessory = null;
                                      }
                                    }}
                                    onClick={item.onAdd}
                                    title={`${item.title} (${item.spec}) — Gövde üzerine sürükleyip istediğiniz yüksekliğe bırakın veya tıklayın`}
                                    className="p-2.5 rounded-2xl border bg-[#F8FAFC]/80 hover:bg-[#EFF6FF]/60 border-[#E2E8F0] hover:border-[#2563EB] flex flex-col items-center text-center justify-between gap-1 transition cursor-grab active:cursor-grabbing select-none relative group"
                                  >
                                    <span className="pointer-events-none opacity-0 group-hover:opacity-100 absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full bg-[#2563EB] text-white flex items-center justify-center text-[9px] font-bold transition">
                                      ⠿ Sürükle
                                    </span>
                                    <div className="pointer-events-none py-0.5 flex items-center justify-center">
                                      {renderInteriorComponentIllustration(item.visual, "md")}
                                    </div>
                                    <div className="pointer-events-none w-full min-w-0">
                                      <div className="text-[11px] font-bold text-[#111827] leading-tight truncate">
                                        {item.title}
                                      </div>
                                      <div className="text-[10px] text-[#64748B] mt-0.5">
                                        {item.spec}
                                      </div>
                                      {!isWidthCompatible && (
                                        <div className="text-[9px] text-amber-700 font-semibold mt-0.5">
                                          Önerilen: {item.minW}–{item.maxW}mm
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Hazır İç Düzen Şablonları (Gömlek + Raf | Elbise + Çekmece | Karma Düzen) */}
                            <div className="pt-2 border-t border-[#E2E8F0] space-y-2">
                              <div className="flex items-center justify-between text-xs font-bold text-[#111827]">
                                <span>⌄ Hazır İç Düzen Şablonları</span>
                                <span className="text-[10px] font-normal text-[#64748B]">
                                  Bölme {activeBayIndex + 1}
                                </span>
                              </div>
                              <div className="grid grid-cols-3 gap-2 p-1">
                                {[
                                  {
                                    id: "shirt_shelf" as const,
                                    title: "Gömlek + Raf",
                                    visual: "template_shirt_shelf" as const,
                                  },
                                  {
                                    id: "dress_drawer" as const,
                                    title: "Elbise + Çekmece",
                                    visual: "template_dress_drawer" as const,
                                  },
                                  {
                                    id: "mixed_combo" as const,
                                    title: "Karma Düzen",
                                    visual: "template_mixed_combo" as const,
                                  },
                                ].map((tpl) => {
                                  const isPreviewingThis =
                                    interiorPreviewBanner?.templateName.includes(tpl.title) &&
                                    interiorPreviewBanner?.bayIndex === activeBayIndex;
                                  return (
                                    <button
                                      key={tpl.id}
                                      type="button"
                                      data-testid={`interior-lib-template-${tpl.id}`}
                                      onClick={() => {
                                        const snapshot =
                                          interiorPreviewBanner?.snapshotBays ||
                                          JSON.parse(JSON.stringify(activeModule.bays));
                                        applyBayInteriorPreset(activeBayIndex, tpl.id);
                                        setInteriorPreviewBanner({
                                          templateName: `Bölme ${activeBayIndex + 1}: ${tpl.title}`,
                                          bayIndex: activeBayIndex,
                                          snapshotBays: snapshot,
                                        });
                                      }}
                                      className={`p-2 rounded-2xl border flex flex-col items-center text-center gap-1 transition cursor-pointer ${
                                        isPreviewingThis
                                          ? "bg-[#EFF6FF] border-2 border-[#2563EB] text-[#111827] shadow-2xs"
                                          : "bg-white hover:bg-[#F8FAFC] border-[#E2E8F0] text-[#111827]"
                                      }`}
                                    >
                                      {renderInteriorComponentIllustration(tpl.visual, "sm")}
                                      <span className="text-[10px] font-bold text-[#111827] leading-tight">
                                        {tpl.title}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                    );
                  }
                  if (leftTab === "materials" || (leftTab === "templates" && studioInspectorTab === "material")) {
                    return (
                      /* 🎨 MALZEME KÜTÜPHANESİ (FULL HEIGHT) */
                  <div className="flex-1 flex flex-col min-h-0 bg-white">
                    {(() => {
                      const classifyMatTab = (m: import("@birim/core").MaterialDefinition) => {
                        const n = m.name.toLowerCase();
                        if (m.category === "stone" || m.category === "compact") return "stone";
                        if (m.category === "glass" || m.category === "mirror") return "glass_mirror";
                        if (m.category === "lacquer") return "lacquer";
                        if (m.category === "wood") return "wood";
                        if (n.includes("mdf")) return "mdf";
                        return "suntalam";
                      };

                      const formatMatTypeBadge = (m: import("@birim/core").MaterialDefinition) => {
                        const n = m.name.toLowerCase();
                        if (m.category === "wood") return "Doğal Kaplama";
                        if (m.category === "lacquer") {
                          return n.includes("gloss") ? "Lake Parlak" : "Lake Mat";
                        }
                        if (m.category === "stone") return "Kuvars / Mermer";
                        if (m.category === "glass") return "Vitrin Cam";
                        if (m.category === "mirror") return "Bronz Ayna";
                        if (n.includes("mdf")) return "MDFLam";
                        return "Suntalam";
                      };

                      const cleanMatShortTitle = (m: import("@birim/core").MaterialDefinition) => {
                        return m.name
                          .replace(/^Kastamonu Entegre\s+/i, "")
                          .replace(/^Yıldız Entegre\s+/i, "")
                          .replace(/^Çamsan Entegre\s+/i, "")
                          .replace(/^AGT\s+\d+\s+Supramat\s+/i, "")
                          .replace(/^Belenco\s+\d+\s+/i, "")
                          .replace(/^Çimstone\s+\d+\s+/i, "")
                          .replace(/^Neolith\s+/i, "")
                          .replace(/^Cosentino\s+Dekton\s+/i, "Dekton ")
                          .replace(/^Doğal\s+Mermer\s+/i, "")
                          .split(" (")[0];
                      };

                      const qMat = materialLibSearch.trim().toLowerCase();
                      const filteredMaterials = DEFAULT_MATERIALS.filter(
                        (m) => m.id !== "mat_led_warm_3000k"
                      ).filter((m) => {
                        if (materialLibCat !== "all" && classifyMatTab(m) !== materialLibCat) {
                          return false;
                        }
                        if (materialLibOnlyGrain && !m.hasGrain) return false;
                        if (
                          qMat &&
                          !m.name.toLowerCase().includes(qMat) &&
                          !(m.decorCode || "").toLowerCase().includes(qMat) &&
                          !(m.brand || "").toLowerCase().includes(qMat)
                        ) {
                          return false;
                        }
                        return true;
                      });

                      const currentTargetMatId =
                        materialTargetScope === "carcass"
                          ? activeModule.carcass.bodyMaterialId
                          : materialTargetScope === "plinth"
                          ? activeModule.carcass.plinthMaterialId ||
                            activeModule.componentMaterialOverrides?.__plinth__ ||
                            activeModule.carcass.bodyMaterialId
                          : materialTargetScope === "back"
                          ? activeModule.componentMaterialOverrides?.[`${activeModule.id}_back`] ||
                            activeModule.carcass.bodyMaterialId
                          : materialTargetScope === "selected_part" && selectedComponentId
                          ? activeModule.componentMaterialOverrides?.[selectedComponentId] ||
                            activeModule.carcass.doorMaterialId
                          : activeModule.carcass.doorMaterialId;

                      return (
                        <div
                          data-testid="material-library-panel"
                          className="bg-white flex flex-col flex-1 min-h-0"
                        >
                          {/* Header: Malzeme Kütüphanesi */}
                          <div className="px-3.5 pt-3 pb-1.5 flex items-center justify-between gap-2">
                            <div>
                              <h2 className="text-sm font-bold text-[#111827]">
                                Malzeme Kütüphanesi
                              </h2>
                              <span className="text-xs text-[#2563EB] font-semibold">
                                Hedef:{" "}
                                {materialTargetScope === "all_module"
                                  ? "Tüm Modül"
                                  : materialTargetScope === "carcass"
                                  ? "Gövde Panelleri"
                                  : materialTargetScope === "doors"
                                  ? "Kapaklar"
                                  : materialTargetScope === "drawers"
                                  ? "Çekmece Önleri"
                                  : materialTargetScope === "plinth"
                                  ? "Soket / Kaide"
                                  : materialTargetScope === "back"
                                  ? "Arkalık"
                                  : materialTargetScope === "selected_part"
                                  ? "Seçili Parça"
                                  : "Aynı Malzemeli Parçalar"}
                              </span>
                            </div>
                            <button
                              type="button"
                              data-testid="add-custom-material-btn"
                              onClick={() => setShowNewSurfaceCreator((v) => !v)}
                              className="px-2.5 py-1.5 rounded-xl bg-[#141413] hover:bg-slate-800 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer shrink-0"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Yeni Yüzey / Doku</span>
                            </button>
                          </div>

                          {showNewSurfaceCreator && (
                            <div className="mx-3.5 mb-2.5 p-3 rounded-2xl bg-[#F8FAFC] border border-[#CBD5E1] space-y-2 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="font-extrabold text-[#111827]">
                                  🎨 Yeni Kapak Yüzeyi / RAL / .JPG Doku Tanımla
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setShowNewSurfaceCreator(false)}
                                  className="text-slate-500 hover:text-slate-900 cursor-pointer"
                                >
                                  ✕
                                </button>
                              </div>
                              <div className="grid grid-cols-2 gap-1.5">
                                <input
                                  type="text"
                                  value={newSurfName}
                                  onChange={(e) => setNewSurfName(e.target.value)}
                                  placeholder="Yüzey Adı"
                                  className="col-span-2 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 font-semibold"
                                />
                                <input
                                  type="text"
                                  value={newSurfCode}
                                  onChange={(e) => setNewSurfCode(e.target.value)}
                                  placeholder="Kod (örn. RAL-7016)"
                                  className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 font-mono"
                                />
                                <select
                                  value={newSurfCat}
                                  onChange={(e) =>
                                    setNewSurfCat(
                                      e.target.value as "lacquer" | "wood" | "laminate" | "stone" | "metal"
                                    )
                                  }
                                  className="px-2 py-1.5 rounded-lg bg-white border border-slate-300 font-semibold"
                                >
                                  <option value="lacquer">Lake / RAL</option>
                                  <option value="wood">Ahşap Kaplama</option>
                                  <option value="laminate">MDFLam / Suntalam</option>
                                  <option value="stone">Mermer / Kuvars</option>
                                  <option value="metal">Fırçalı Metal</option>
                                </select>
                                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white border border-slate-300">
                                  <input
                                    type="color"
                                    value={newSurfHex}
                                    onChange={(e) => setNewSurfHex(e.target.value)}
                                    className="w-6 h-6 rounded cursor-pointer border-0"
                                  />
                                  <span className="font-mono text-[11px]">{newSurfHex}</span>
                                </div>
                                <input
                                  type="number"
                                  value={newSurfCost}
                                  min={10}
                                  max={600}
                                  onChange={(e) => setNewSurfCost(Number(e.target.value) || 65)}
                                  placeholder="€/m²"
                                  className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 font-mono"
                                />
                              </div>
                              <div className="flex items-center justify-between gap-2 pt-0.5">
                                <label className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 font-bold text-[11px] cursor-pointer truncate">
                                  <span>{newSurfTexUrl ? "✅ Doku Görseli Hazır" : "📷 .JPG / .PNG Doku Yükle"}</span>
                                  <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    className="hidden"
                                    onChange={(e) => {
                                      const f = e.target.files?.[0];
                                      if (!f) return;
                                      const reader = new FileReader();
                                      reader.onload = () => {
                                        if (typeof reader.result !== "string") return;
                                        const img = new Image();
                                        img.onload = () => {
                                          const c = document.createElement("canvas");
                                          const s = 384;
                                          c.width = s;
                                          c.height = s;
                                          const ctx = c.getContext("2d");
                                          if (ctx) {
                                            ctx.drawImage(img, 0, 0, s, s);
                                            setNewSurfTexUrl(c.toDataURL("image/jpeg", 0.84));
                                          }
                                        };
                                        img.src = reader.result;
                                      };
                                      reader.readAsDataURL(f);
                                    }}
                                  />
                                </label>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const created = addCustomMaterialToProject({
                                      name: newSurfName,
                                      decorCode: newSurfCode,
                                      category: newSurfCat,
                                      colorHex: newSurfHex,
                                      roughness: newSurfRough,
                                      costPerM2: newSurfCost,
                                      textureUrl: newSurfTexUrl || undefined,
                                    });
                                    applyMaterialByTargetScope(created.id, materialTargetScope);
                                    setNewSurfTexUrl("");
                                    setShowNewSurfaceCreator(false);
                                    setApprovalBanner({
                                      ok: true,
                                      text: `🎨 "${created.name}" yüzeyi kataloğa eklendi ve seçili kapsama uygulandı.`,
                                    });
                                  }}
                                  className="px-3 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-[11px] cursor-pointer shrink-0"
                                >
                                  Kaydet &amp; Uygula
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Search Bar + Filter Button */}
                          <div className="px-3.5 pb-2 flex items-center gap-1.5">
                            <div className="relative flex-1 flex items-center">
                              <svg
                                className="w-3.5 h-3.5 text-[#64748B] absolute left-3 pointer-events-none"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <circle cx="11" cy="11" r="8" />
                                <path d="M21 21l-4.35-4.35" />
                              </svg>
                              <input
                                type="text"
                                data-testid="material-library-search-input"
                                value={materialLibSearch}
                                onChange={(e) => setMaterialLibSearch(e.target.value)}
                                placeholder="Malzeme, renk veya kod ara..."
                                className="w-full pl-8 pr-2.5 py-1.5 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] text-xs font-medium text-[#111827] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#2563EB]"
                              />
                            </div>
                            <button
                              type="button"
                              data-testid="material-library-filter-btn"
                              onClick={() => setMaterialLibOnlyGrain((v) => !v)}
                              title="Desenli / Damarlı malzemeleri filtrele"
                              className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 transition cursor-pointer ${
                                materialLibOnlyGrain
                                  ? "bg-[#EFF6FF] text-[#1D4ED8] border-[#2563EB]"
                                  : "bg-white hover:bg-[#F8FAFC] text-[#475569] border-[#CBD5E1]"
                              }`}
                            >
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                              </svg>
                            </button>
                          </div>

                          {/* Category Pills: Tümü | Suntalam | MDF | Lake | Ahşap Kaplama | Cam & Ayna | Mermer & Taş */}
                          <div className="px-3.5 py-2.5 flex flex-wrap gap-1.5 border-b border-[#E2E8F0] bg-[#F8FAFC]">
                            {[
                              { id: "all" as const, label: "Tümü" },
                              { id: "suntalam" as const, label: "Suntalam" },
                              { id: "mdf" as const, label: "MDF" },
                              { id: "lacquer" as const, label: "Lake" },
                              { id: "wood" as const, label: "Ahşap Kaplama" },
                              { id: "glass_mirror" as const, label: "Cam & Ayna" },
                              { id: "stone" as const, label: "Mermer & Taş" },
                            ].map((pill) => {
                              const isAct = materialLibCat === pill.id;
                              return (
                                <button
                                  key={pill.id}
                                  type="button"
                                  data-testid={`material-lib-cat-${pill.id}`}
                                  onClick={() => setMaterialLibCat(pill.id)}
                                  className={`px-2.5 py-1 rounded-full text-xs shrink-0 transition cursor-pointer border ${
                                    isAct
                                      ? "bg-[#2563EB] text-white border-[#1D4ED8] font-bold shadow-2xs"
                                      : "bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#475569] border-[#E2E8F0] font-medium"
                                  }`}
                                >
                                  {pill.label}
                                </button>
                              );
                            })}
                          </div>

                          {/* 3-Column Swatch Grid (Matches image_dad0ff.jpg: Swatch Box + Decor Code + Name + Type) */}
                          <div className="flex-1 overflow-y-auto px-3.5 py-2.5">
                            <div className="grid grid-cols-3 gap-2">
                              {filteredMaterials.map((mat) => {
                                const isSelSwatch = currentTargetMatId === mat.id;
                                const shortTitle = cleanMatShortTitle(mat);
                                const typeBadge = formatMatTypeBadge(mat);
                                return (
                                  <button
                                    key={mat.id}
                                    type="button"
                                    data-testid={`material-lib-swatch-${mat.id}`}
                                    onClick={() => {
                                      if (typeof window !== "undefined") {
                                        window.dispatchEvent(
                                          new CustomEvent("birim:set-brush-material", {
                                            detail: mat.id,
                                          })
                                        );
                                      }
                                      const res = applyMaterialByTargetScope(
                                        materialTargetScope,
                                        mat.id,
                                        selectedComponentId || undefined
                                      );
                                      if (!res.ok) {
                                        setMaterialValidationErrorMsg(res.error || null);
                                      } else {
                                        setMaterialValidationErrorMsg(null);
                                      }
                                    }}
                                    title={`${mat.name} (${mat.brand || "Birim"} • €${mat.costPerM2}/m²)`}
                                    className={`p-2 rounded-2xl border flex flex-col items-center text-center justify-between gap-1.5 transition cursor-pointer ${
                                      isSelSwatch
                                        ? "bg-[#EFF6FF] border-2 border-[#2563EB] shadow-xs"
                                        : "bg-[#F8FAFC]/70 hover:bg-[#EFF6FF]/40 border-[#E2E8F0] hover:border-[#2563EB]"
                                    }`}
                                  >
                                    {renderMaterialSwatchBox(mat, "lg")}
                                    <div className="w-full min-w-0">
                                      {mat.decorCode && (
                                        <div className="text-[11px] font-extrabold text-[#111827] leading-tight truncate">
                                          {mat.decorCode}
                                        </div>
                                      )}
                                      <div className="text-xs font-bold text-[#111827] leading-tight truncate">
                                        {shortTitle.replace(new RegExp(`^${mat.decorCode}\s*`, "i"), "")}
                                      </div>
                                      <div className="text-[11px] text-[#64748B] leading-tight mt-0.5 truncate">
                                        {typeBadge}
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                    );
                  }
                  if (leftTab === "hardware" || (leftTab === "templates" && studioInspectorTab === "all")) {
                    return (
                      /* ⚙️ DONANIM KÜTÜPHANESİ (FULL HEIGHT) */
                  <div className="flex-1 flex flex-col min-h-0 bg-white">
                    {(() => {
                      const T_door =
                        activeBay?.door.doorThicknessMm || activeModule.carcass.doorThickness || 18;
                      const netInnerD = fourSpaceDimensions.usableInternal.netInnerDepthMm;
                      const optimalNl = Math.min(
                        600,
                        Math.max(270, Math.floor((netInnerD - 10) / 50) * 50)
                      );
                      const isLiftModCompatible =
                        height <= 1150 ||
                        activeModule.category === "kitchen_wall" ||
                        activeModule.moduleFamilyId === "fam_kitchen_wall";
                      const isSlidingModCompatible =
                        activeModule.bays.length >= 2 || width >= 900;

                      const curHingeId = activeBay?.door.hardwareProductId || "hw_blum_71b3550";
                      const curRunnerId =
                        activeBay?.drawers[0]?.hardwareProductId || "hw_blum_tandembox_m30";
                      const curDoorSys = activeBay?.door.doorSystemId || "hinged_single";
                      const hasActiveLed = activeModule.bays.some((b) =>
                        (b.specialFittings || []).some((f) => f.type.startsWith("led_"))
                      );

                      const hwLibraryCards: {
                        id: string;
                        cat: "hinge" | "runner" | "opening" | "lighting" | "handle" | "interior_acc";
                        title: string;
                        subtitle: string;
                        sku: string;
                        mfrId?: string;
                        mfrName: string;
                        visual: HardwareVisualIllustrationKind;
                        isSelected: boolean;
                        isCompatible: boolean;
                        incompatibilityReason?: string;
                        isVerified: boolean;
                        priceEur: number;
                        onSelect: () => void;
                      }[] = [
                        // 1. MENTEŞELER (Real V4_HARDWARE_CATALOG records)
                        {
                          id: "hw_lib_salice_std",
                          cat: "hinge",
                          title: "Menteşe",
                          subtitle: "Standart 110° (Salice Silentia+)",
                          sku: "C7P6AE9",
                          mfrId: "mfr_salice",
                          mfrName: "Arturo Salice S.p.A.",
                          visual: "hinge_std",
                          isSelected: curHingeId === "hw_salice_c7p6ae9" && curDoorSys.startsWith("hinged"),
                          isCompatible: T_door >= 16 && T_door <= 26,
                          isVerified: false,
                          priceEur: 4.0,
                          onSelect: () => {
                            const res = setModuleHingeHardware("hw_salice_c7p6ae9", true);
                            if (!res.ok) setHardwareValidationErrorMsg(res.error || null);
                            else setHardwareValidationErrorMsg(null);
                          },
                        },
                        {
                          id: "hw_lib_blum_110",
                          cat: "hinge",
                          title: "Menteşe",
                          subtitle: "Blum Clip-Top 110°",
                          sku: "71B3550",
                          mfrId: "mfr_blum",
                          mfrName: "Julius Blum GmbH",
                          visual: "hinge_blum",
                          isSelected: curHingeId === "hw_blum_71b3550" && curDoorSys.startsWith("hinged"),
                          isCompatible: T_door >= 16 && T_door <= 24,
                          incompatibilityReason:
                            T_door > 24
                              ? `${T_door}mm kapak kalınlığı için 95° Kalın Kapak menteşesi (71B9550) gereklidir.`
                              : undefined,
                          isVerified: true,
                          priceEur: 3.8,
                          onSelect: () => {
                            const res = setModuleHingeHardware("hw_blum_71b3550", true);
                            if (!res.ok) setHardwareValidationErrorMsg(res.error || null);
                            else setHardwareValidationErrorMsg(null);
                          },
                        },
                        {
                          id: "hw_lib_blum_155",
                          cat: "hinge",
                          title: "Menteşe (155°)",
                          subtitle: "Blum Sıfır Çıkıntı (İç Çekmece)",
                          sku: "71B7550",
                          mfrId: "mfr_blum",
                          mfrName: "Julius Blum GmbH",
                          visual: "hinge_blum",
                          isSelected: curHingeId === "hw_blum_71b7550" && curDoorSys.startsWith("hinged"),
                          isCompatible: T_door >= 16 && T_door <= 26,
                          isVerified: true,
                          priceEur: 6.4,
                          onSelect: () => {
                            const res = setModuleHingeHardware("hw_blum_71b7550", true);
                            if (!res.ok) setHardwareValidationErrorMsg(res.error || null);
                            else setHardwareValidationErrorMsg(null);
                          },
                        },
                        {
                          id: "hw_lib_hettich_sensys",
                          cat: "hinge",
                          title: "Menteşe (TH52)",
                          subtitle: "Hettich Sensys 8645i 110°",
                          sku: "9071205",
                          mfrId: "mfr_hettich",
                          mfrName: "Hettich Holding GmbH",
                          visual: "hinge_std",
                          isSelected: curHingeId === "hw_hettich_9071205" && curDoorSys.startsWith("hinged"),
                          isCompatible: T_door >= 15 && T_door <= 24,
                          isVerified: false,
                          priceEur: 3.6,
                          onSelect: () => {
                            const res = setModuleHingeHardware("hw_hettich_9071205", true);
                            if (!res.ok) setHardwareValidationErrorMsg(res.error || null);
                            else setHardwareValidationErrorMsg(null);
                          },
                        },

                        // 2. ÇEKMECE RAYLARI (Real V4_HARDWARE_CATALOG records)
                        {
                          id: "hw_lib_runner_movento",
                          cat: "runner",
                          title: "Çekmece Rayı",
                          subtitle: "Standart Gizli Ray (Movento 760H)",
                          sku: "760H5000S",
                          mfrId: "mfr_blum",
                          mfrName: "Julius Blum GmbH",
                          visual: "runner_std",
                          isSelected: curRunnerId === "hw_blum_movento_760h",
                          isCompatible: netInnerD >= 280,
                          isVerified: true,
                          priceEur: 24.5,
                          onSelect: () => {
                            const res = setModuleDrawerRunnerHardware(
                              "hw_blum_movento_760h",
                              optimalNl,
                              true
                            );
                            if (!res.ok) setHardwareValidationErrorMsg(res.error || null);
                            else setHardwareValidationErrorMsg(null);
                          },
                        },
                        {
                          id: "hw_lib_runner_tandem",
                          cat: "runner",
                          title: "Çekmece Rayı",
                          subtitle: "Blum Tandem / Antaro",
                          sku: "578.5001M+378M",
                          mfrId: "mfr_blum",
                          mfrName: "Julius Blum GmbH",
                          visual: "runner_blum",
                          isSelected: curRunnerId === "hw_blum_tandembox_m30",
                          isCompatible: netInnerD >= 280,
                          isVerified: true,
                          priceEur: 28.0,
                          onSelect: () => {
                            const res = setModuleDrawerRunnerHardware(
                              "hw_blum_tandembox_m30",
                              optimalNl,
                              true
                            );
                            if (!res.ok) setHardwareValidationErrorMsg(res.error || null);
                            else setHardwareValidationErrorMsg(null);
                          },
                        },
                        {
                          id: "hw_lib_runner_legrabox",
                          cat: "runner",
                          title: "Çekmece Rayı",
                          subtitle: "Blum LEGRABOX pure (40kg)",
                          sku: "750.5001S+770M",
                          mfrId: "mfr_blum",
                          mfrName: "Julius Blum GmbH",
                          visual: "runner_blum",
                          isSelected: curRunnerId === "hw_blum_legrabox_m40",
                          isCompatible: netInnerD >= 280,
                          isVerified: true,
                          priceEur: 46.0,
                          onSelect: () => {
                            const res = setModuleDrawerRunnerHardware(
                              "hw_blum_legrabox_m40",
                              optimalNl,
                              true
                            );
                            if (!res.ok) setHardwareValidationErrorMsg(res.error || null);
                            else setHardwareValidationErrorMsg(null);
                          },
                        },
                        {
                          id: "hw_lib_runner_avantech",
                          cat: "runner",
                          title: "Çekmece Rayı",
                          subtitle: "Hettich AvanTech YOU (40kg)",
                          sku: "ActroYOU_101",
                          mfrId: "mfr_hettich",
                          mfrName: "Hettich Holding GmbH",
                          visual: "runner_std",
                          isSelected: curRunnerId === "hw_hettich_avantech_m",
                          isCompatible: netInnerD >= 280,
                          isVerified: false,
                          priceEur: 44.0,
                          onSelect: () => {
                            const res = setModuleDrawerRunnerHardware(
                              "hw_hettich_avantech_m",
                              optimalNl,
                              true
                            );
                            if (!res.ok) setHardwareValidationErrorMsg(res.error || null);
                            else setHardwareValidationErrorMsg(null);
                          },
                        },

                        // 3. AÇILMA SİSTEMLERİ (Sürgü, Katlanır, Kalkar, Pocket)
                        {
                          id: "hw_lib_sliding_topline",
                          cat: "opening",
                          title: "Sürgü Mekanizması",
                          subtitle: "Üstten Taşıyıcılı (TopLine L)",
                          sku: "TopLineL_50",
                          mfrId: "mfr_hettich",
                          mfrName: "Hettich Holding GmbH",
                          visual: "sliding_top",
                          isSelected: curDoorSys === "sliding_top_hung",
                          isCompatible: isSlidingModCompatible && depth >= 580,
                          incompatibilityReason: !isSlidingModCompatible
                            ? "Sürgülü sistem için en az 2 bölme ve ≥900mm genişlik gerekir."
                            : depth < 580
                            ? "Üstten taşımalı sürgü sistemi en az 580mm gövde derinliği gerektirir."
                            : undefined,
                          isVerified: true,
                          priceEur: 135.0,
                          onSelect: () => {
                            if (!isSlidingModCompatible || depth < 580) {
                              setHardwareValidationErrorMsg(
                                `Hettich TopLine L [TopLineL_50] için en az 2 bölme, ≥900mm genişlik ve ≥580mm derinlik gereklidir (Mevcut: ${activeModule.bays.length} bölme, ${width}×${depth}mm).`
                              );
                              return;
                            }
                            setHardwareValidationErrorMsg(null);
                            setBayV4DoorConfig(activeBayIndex, {
                              doorSystemId: "sliding_top_hung",
                              hardwareProductId: "hw_hettich_topline_l",
                            });
                          },
                        },
                        {
                          id: "hw_lib_folding_wingline",
                          cat: "opening",
                          title: "Katlanır Kapak",
                          subtitle: "Hettich WingLine L (25kg)",
                          sku: "WingLineL_25",
                          mfrId: "mfr_hettich",
                          mfrName: "Hettich Holding GmbH",
                          visual: "folding_wingline",
                          isSelected: curDoorSys === "folding_side",
                          isCompatible: depth >= 500,
                          incompatibilityReason:
                            depth < 500
                              ? "Hettich WingLine L katlanır kapak en az 500mm derinlik gerektirir."
                              : undefined,
                          isVerified: false,
                          priceEur: 110.0,
                          onSelect: () => {
                            if (depth < 500) {
                              setHardwareValidationErrorMsg(
                                `Hettich WingLine L [WingLineL_25] en az 500mm gövde derinliği gerektirir (Mevcut: ${depth}mm).`
                              );
                              return;
                            }
                            setHardwareValidationErrorMsg(null);
                            setBayV4DoorConfig(activeBayIndex, {
                              doorSystemId: "folding_side",
                              hardwareProductId: "hw_hettich_wingline_l",
                            });
                          },
                        },
                        {
                          id: "hw_lib_lift_aventos_hf",
                          cat: "opening",
                          title: "Kalkar Kapak",
                          subtitle: "Aventos HF (Katlanır Kalkar)",
                          sku: "22F2510+22F3500",
                          mfrId: "mfr_blum",
                          mfrName: "Julius Blum GmbH",
                          visual: "lift_aventos",
                          isSelected: curDoorSys === "lift_bi_fold" || curDoorSys === "lift_up_stay",
                          isCompatible: isLiftModCompatible,
                          incompatibilityReason: !isLiftModCompatible
                            ? `Blum AVENTOS HF yüksekliği ≤1150mm olan üst dolaplar içindir (Mevcut H: ${height}mm).`
                            : undefined,
                          isVerified: true,
                          priceEur: 78.0,
                          onSelect: () => {
                            if (!isLiftModCompatible) {
                              setHardwareValidationErrorMsg(
                                `Blum AVENTOS HF [22F2510+22F3500] yüksekliği ≤1150mm olan üst dolaplar içindir (Mevcut modül boyu: ${height}mm). Seçim engellendi.`
                              );
                              return;
                            }
                            setHardwareValidationErrorMsg(null);
                            setBayV4DoorConfig(activeBayIndex, {
                              doorSystemId: height <= 650 ? "lift_up_stay" : "lift_bi_fold",
                              hardwareProductId:
                                height <= 650 ? "hw_blum_aventos_hk_27" : "hw_blum_aventos_hf_25",
                            });
                          },
                        },

                        // 4. AYDINLATMA (Häfele Loox5)
                        {
                          id: "hw_lib_led_profile",
                          cat: "lighting",
                          title: "LED Aydınlatma",
                          subtitle: "Profil (Gömme) Loox5",
                          sku: "833.74.700",
                          mfrId: "mfr_hafele",
                          mfrName: "Häfele SE & Co KG",
                          visual: "led_recessed",
                          isSelected: hasActiveLed,
                          isCompatible: true,
                          isVerified: true,
                          priceEur: 16.5,
                          onSelect: () => {
                            setHardwareValidationErrorMsg(null);
                            toggleModuleLedLighting(!hasActiveLed, {
                              ledType: "led_profile",
                              colorTempK: activeModule.carcass.ledColorTempK || 4000,
                            });
                          },
                        },

                        // 5. KULP VE PROFİLLER (+ Özel Kulp Tanımlama Kartı)
                        {
                          id: "hw_lib_custom_creator",
                          cat: "handle",
                          title: "+ Yeni Kulp / Donanım Ekle",
                          subtitle: "Özel Boy, C-C Delik Aksı & Fiyat",
                          sku: "CUSTOM_HW",
                          mfrName: "Birim Özel Üretim",
                          visual: "handle_bar",
                          isSelected: false,
                          isCompatible: true,
                          isVerified: true,
                          priceEur: 0,
                          onSelect: () => {
                            setShowCustomHardwareModal(true);
                          },
                        },
                        {
                          id: "hw_lib_handle_bar",
                          cat: "handle",
                          title: "Çubuk & Boy Kulp",
                          subtitle: "C-C 160 / 960mm Profil",
                          sku: "HW_HANDLE_BAR",
                          mfrName: "Birim Donanım",
                          visual: "handle_bar",
                          isSelected: (activeBay?.door.handleCategory || "bar_handle") === "bar_handle",
                          isCompatible: true,
                          isVerified: true,
                          priceEur: 6.5,
                          onSelect: () => {
                            setBayV4DoorConfig(activeBayIndex, {
                              handleCategory: "bar_handle",
                            });
                          },
                        },
                        {
                          id: "hw_lib_gola_profile",
                          cat: "handle",
                          title: "Gola Kanal Profil",
                          subtitle: "Kulpsuz Gövde Profili (-30mm)",
                          sku: "HW_GOLA_PROFILE_L",
                          mfrName: "Birim Donanım",
                          visual: "handle_bar",
                          isSelected: activeBay?.door.handleCategory === "gola_profile",
                          isCompatible: curDoorSys !== "hinged_inset",
                          incompatibilityReason:
                            curDoorSys === "hinged_inset"
                              ? "Gola profil içerlek (inset) kapaklarla kullanılamaz."
                              : undefined,
                          isVerified: true,
                          priceEur: 14.5,
                          onSelect: () => {
                            if (curDoorSys === "hinged_inset") {
                              setHardwareValidationErrorMsg(
                                "Gola profil kanalı içerlek (inset) kapaklarla kullanılamaz."
                              );
                              return;
                            }
                            setHardwareValidationErrorMsg(null);
                            setBayV4DoorConfig(activeBayIndex, {
                              handleCategory: "gola_profile",
                            });
                          },
                        },

                        // 6. ASKILIK & İÇ DONANIM MEKANİZMALARI
                        {
                          id: "hw_lib_oval_rail",
                          cat: "interior_acc",
                          title: "Askılık Borusu",
                          subtitle: "Oval – Krom (Ø25mm + Flanş)",
                          sku: "HW_HANGING_RAIL",
                          mfrId: "mfr_hafele",
                          mfrName: "Häfele SE & Co KG",
                          visual: "wardrobe_rail",
                          isSelected: (activeBay?.hangingRails.length || 0) > 0,
                          isCompatible: currentBayWidthMm >= 250,
                          isVerified: true,
                          priceEur: 6.3,
                          onSelect: () => addHangingRail(activeBayIndex),
                        },
                        {
                          id: "hw_lib_servetto_lift",
                          cat: "interior_acc",
                          title: "Gardırop Asansörü",
                          subtitle: "Servetto Hidrolik 10 kg",
                          sku: "805.20.232",
                          mfrId: "mfr_hafele",
                          mfrName: "Häfele / Servetto",
                          visual: "wardrobe_rail",
                          isSelected: Boolean(
                            activeBay?.specialFittings?.some((f) => f.type === "wardrobe_lift")
                          ),
                          isCompatible: currentBayWidthMm >= 450 && currentBayWidthMm <= 1150,
                          isVerified: true,
                          priceEur: 64.0,
                          onSelect: () => addSpecialFitting(activeBayIndex, "wardrobe_lift"),
                        },
                      ];

                      const qHw = hardwareLibSearch.trim().toLowerCase();
                      const filteredHwCards = hwLibraryCards.filter((c) => {
                        if (hardwareLibCat !== "all" && c.cat !== hardwareLibCat) return false;
                        if (hardwareLibOnlyCompatible && !c.isCompatible) return false;
                        if (
                          qHw &&
                          !c.title.toLowerCase().includes(qHw) &&
                          !c.subtitle.toLowerCase().includes(qHw) &&
                          !c.sku.toLowerCase().includes(qHw) &&
                          !c.mfrName.toLowerCase().includes(qHw)
                        ) {
                          return false;
                        }
                        return true;
                      });

                      return (
                        <div
                          data-testid="hardware-library-panel"
                          className="bg-white flex flex-col flex-1 min-h-0"
                        >
                          {/* Header: Donanım Kütüphanesi */}
                          <div className="px-3.5 pt-3 pb-1.5 flex items-center justify-between gap-2">
                            <div>
                              <h2 className="text-sm font-bold text-[#111827]">
                                Donanım Kütüphanesi
                              </h2>
                              <span className="text-[10px] text-[#64748B]">
                                {hardwareCatalog.length} gerçek katalog SKU • BOM & Fiyat senkron
                              </span>
                            </div>
                          </div>

                          {/* Search Bar + Filter Funnel Button */}
                          <div className="px-3.5 pb-2 flex items-center gap-1.5">
                            <div className="relative flex-1 flex items-center">
                              <svg
                                className="w-3.5 h-3.5 text-[#64748B] absolute left-3 pointer-events-none"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <circle cx="11" cy="11" r="8" />
                                <path d="M21 21l-4.35-4.35" />
                              </svg>
                              <input
                                type="text"
                                data-testid="hardware-library-search-input"
                                value={hardwareLibSearch}
                                onChange={(e) => setHardwareLibSearch(e.target.value)}
                                placeholder="Donanım, mekanizma veya marka ara..."
                                className="w-full pl-8 pr-2.5 py-1.5 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] text-xs font-medium text-[#111827] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#2563EB]"
                              />
                            </div>
                            <button
                              type="button"
                              data-testid="hardware-library-filter-compatible"
                              onClick={() => setHardwareLibOnlyCompatible((v) => !v)}
                              title="Sadece mevcut modül ölçüleriyle uyumlu donanımları filtrele"
                              className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 transition cursor-pointer ${
                                hardwareLibOnlyCompatible
                                  ? "bg-[#EFF6FF] text-[#1D4ED8] border-[#2563EB]"
                                  : "bg-white hover:bg-[#F8FAFC] text-[#475569] border-[#CBD5E1]"
                              }`}
                            >
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                              </svg>
                            </button>
                          </div>

                          {/* Category Pills: Tümü | Menteşe | Ray | Açılma Sistemi | Aydınlatma | Kulp | İç Donanım */}
                          <div className="px-3.5 py-2.5 flex flex-wrap gap-1.5 border-b border-[#E2E8F0] bg-[#F8FAFC]">
                            {[
                              { id: "all" as const, label: "Tümü" },
                              { id: "hinge" as const, label: "Menteşe" },
                              { id: "runner" as const, label: "Ray" },
                              { id: "opening" as const, label: "Açılma Sistemi" },
                              { id: "lighting" as const, label: "Aydınlatma" },
                              { id: "handle" as const, label: "Kulp & Profil" },
                              { id: "interior_acc" as const, label: "Askılık & İç" },
                            ].map((pill) => {
                              const isActPill = hardwareLibCat === pill.id;
                              return (
                                <button
                                  key={pill.id}
                                  type="button"
                                  data-testid={`hardware-lib-cat-${pill.id}`}
                                  onClick={() => setHardwareLibCat(pill.id)}
                                  className={`px-2.5 py-1 rounded-full text-[11px] shrink-0 transition cursor-pointer border ${
                                    isActPill
                                      ? "bg-[#2563EB] text-white border-[#1D4ED8] font-bold shadow-2xs"
                                      : "bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#475569] border-[#E2E8F0] font-medium"
                                  }`}
                                >
                                  {pill.label}
                                </button>
                              );
                            })}
                          </div>

                          {/* 2-Column Visual Hardware Product Cards */}
                          <div className="flex-1 overflow-y-auto px-3.5 py-2.5 space-y-2.5">
                            <div className="grid grid-cols-2 gap-2">
                              {filteredHwCards.map((hwCard) => (
                                <button
                                  key={hwCard.id}
                                  type="button"
                                  data-testid={`hardware-lib-card-${hwCard.id}`}
                                  draggable={hwCard.cat === "interior_acc" || hwCard.cat === "lighting"}
                                  onDragStart={(e) => {
                                    if (hwCard.cat !== "interior_acc" && hwCard.cat !== "lighting") return;
                                    const mapKind =
                                      hwCard.id.includes("rail")
                                        ? "rail"
                                        : hwCard.id.includes("trouser")
                                        ? "trouser_rack"
                                        : hwCard.id.includes("shoe")
                                        ? "shoe_rack"
                                        : hwCard.id.includes("basket")
                                        ? "wire_basket"
                                        : hwCard.id.includes("lift")
                                        ? "wardrobe_lift"
                                        : hwCard.id.includes("jewelry")
                                        ? "jewelry_tray"
                                        : "led_profile";
                                    startAccessorySilhouetteDrag(e, {
                                      id: mapKind,
                                      visual: mapKind,
                                      title: hwCard.title,
                                      cat: hwCard.cat,
                                      spec: hwCard.subtitle,
                                    });
                                  }}
                                  onDragEnd={() => {
                                    if (typeof window !== "undefined") {
                                      (window as any).__birimActiveDraggedAccessory = null;
                                    }
                                  }}
                                  onClick={hwCard.onSelect}
                                  title={
                                    hwCard.isCompatible
                                      ? `${hwCard.title} — ${hwCard.subtitle} [${hwCard.sku}] (€${hwCard.priceEur})`
                                      : hwCard.incompatibilityReason || "Mevcut modül ölçüleriyle uyumsuz"
                                  }
                                  className={`p-2.5 rounded-2xl border flex flex-col items-center text-center justify-between gap-1 transition cursor-pointer relative ${
                                    hwCard.isSelected
                                      ? "bg-[#EFF6FF] border-2 border-[#2563EB] shadow-xs"
                                      : hwCard.isCompatible
                                      ? "bg-[#F8FAFC]/80 hover:bg-[#EFF6FF]/50 border-[#E2E8F0] hover:border-[#2563EB]"
                                      : "bg-stone-50/70 border-stone-200 opacity-75"
                                  }`}
                                >
                                  <div className="w-full flex items-center justify-between px-0.5">
                                    <span className="font-mono text-[9px] text-[#64748B] truncate">
                                      {hwCard.sku}
                                    </span>
                                    {renderManufacturerBadge(hwCard.mfrId)}
                                  </div>

                                  <div className="py-0.5 flex items-center justify-center">
                                    {renderHardwareProductIllustration(hwCard.visual, "md")}
                                  </div>

                                  <div className="w-full min-w-0">
                                    <div className="text-[11px] font-bold text-[#111827] leading-tight truncate">
                                      {hwCard.title}
                                    </div>
                                    <div className="text-[10px] text-[#475569] mt-0.5 truncate">
                                      {hwCard.subtitle}
                                    </div>
                                    <div className="flex items-center justify-center gap-1 mt-1">
                                      <span
                                        className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                                          hwCard.isVerified
                                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                            : "bg-amber-50 text-amber-800 border border-amber-200"
                                        }`}
                                      >
                                        {hwCard.isVerified ? "Doğrulandı" : "Doğrulanmadı"}
                                      </span>
                                      {!hwCard.isCompatible && (
                                        <span className="px-1 py-0.5 rounded bg-red-50 text-red-700 text-[8px] font-bold">
                                          Ölçü Dışı
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                    );
                  }
                  if (leftTab === "accessories") {
                    return (
                      /* TAB 2: AKSESUARLAR */
                  <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-[#111827]">
                        Hazır Oda & Mutfak Dizilimleri
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {WARDROBE_TEMPLATES.map((tpl) => (
                          <button
                            key={tpl.templateId}
                            type="button"
                            data-testid={`studio-tpl-${tpl.templateId}`}
                            draggable={true}
                            onDragStart={(e) => startModuleSilhouetteDrag(e, tpl.templateId)}
                            onDragEnd={() => setActiveDraggedTemplateId(null)}
                            onClick={() => applyTemplate(tpl.templateId)}
                            className="p-2 rounded-xl bg-white hover:bg-[#F1F5F9] border border-[#E2E8F0] flex flex-col items-center text-center gap-1 cursor-pointer"
                          >
                            <V3IsometricModuleIcon
                              module={tpl.createInstance(`preview_${tpl.templateId}`)}
                              size="md"
                            />
                            <span className="text-[11px] font-bold text-[#111827] line-clamp-1">
                              {tpl.name}
                            </span>
                          </button>
                        ))}
                        <button
                          type="button"
                          data-testid="studio-tpl-kitchen-linear"
                          onClick={loadLinearKitchen}
                          className="p-2 rounded-xl bg-white hover:bg-[#F1F5F9] border border-[#E2E8F0] flex flex-col items-center text-center gap-1 cursor-pointer"
                        >
                          <V3IsometricModuleIcon presetLayout="linear_kitchen" size="md" />
                          <span className="text-[11px] font-bold text-[#111827]">Doğrusal Mutfak</span>
                        </button>
                        <button
                          type="button"
                          data-testid="studio-tpl-kitchen-l"
                          onClick={loadLKitchen}
                          className="p-2 rounded-xl bg-white hover:bg-[#F1F5F9] border border-[#E2E8F0] flex flex-col items-center text-center gap-1 cursor-pointer"
                        >
                          <V3IsometricModuleIcon presetLayout="l_kitchen" size="md" />
                          <span className="text-[11px] font-bold text-[#111827]">L Tipi Mutfak</span>
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 pt-1">
                        <button
                          type="button"
                          data-testid="v4-smart-wall-4carcass"
                          onClick={() => applySmartWallProposal("smart_layout_4_equal", 3600)}
                          className="py-2 px-2.5 rounded-xl bg-white hover:bg-[#F1F5F9] border border-[#E2E8F0] text-[11px] font-semibold text-[#111827] cursor-pointer"
                        >
                          3.6m → 4 Eşit Gövde
                        </button>
                        <button
                          type="button"
                          data-testid="v4-smart-wall-mixed"
                          onClick={() => applySmartWallProposal("smart_layout_mixed_wardrobe", 3600)}
                          className="py-2 px-2.5 rounded-xl bg-white hover:bg-[#F1F5F9] border border-[#E2E8F0] text-[11px] font-semibold text-[#111827] cursor-pointer"
                        >
                          3.6m → Karma Dizilim
                        </button>
                      </div>
                      <button
                        type="button"
                        data-testid="v4-auto-complementary-btn"
                        onClick={autoGenerateKitchenComplementary}
                        className="w-full py-2 px-3 rounded-xl bg-[#EEF3F8] text-[#111827] border border-[#CBD5E1] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Otomatik Tezgâh / Backsplash / Yan Bitiş</span>
                      </button>
                      <button
                        type="button"
                        data-testid="v5-open-hub-from-accessories-btn"
                        onClick={() => {
                          setSceneHubInitialTab("appliances");
                          setShowSceneHubModal(true);
                        }}
                        className="w-full py-2 px-3 rounded-xl bg-[#141413] hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 text-emerald-300" />
                        <span>+ Cihaz, Mobilya &amp; Özel .GLB Ekle</span>
                      </button>
                      <div className="pt-2 border-t border-[#E2E8F0] space-y-1.5">
                        <div className="text-xs font-bold text-[#111827]">
                          Hızlı 3D Cihaz &amp; Mobilya Ekle (Sürükle veya Tıkla)
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {V5_SCENE_OBJECT_CATALOG.slice(0, 8).map((soItem) => (
                            <button
                              key={soItem.catalogId}
                              type="button"
                              draggable={true}
                              onDragStart={(ev) => startSceneObjectSilhouetteDrag(ev, soItem.catalogId)}
                              onClick={() => addSceneObjectFromCatalog(soItem.catalogId)}
                              className="p-2 rounded-xl bg-white hover:bg-[#F1F5F9] border border-[#E2E8F0] text-left cursor-pointer"
                            >
                              <div className="text-[10.5px] font-bold text-[#111827] line-clamp-1">{soItem.name}</div>
                              <div className="text-[9.5px] font-mono text-[#64748B]">
                                {soItem.defaultDimensions.width}×{soItem.defaultDimensions.height}mm
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                    );
                  }
                  return (
                    /* 📦 MODÜL KÜTÜPHANESİ (FULL HEIGHT) */
                  <div className="flex-1 flex flex-col min-h-0 bg-white">
                    {/* Header: Modül Kütüphanesi + Kart/Liste Switcher */}
                    <div className="px-3.5 pt-3 pb-2 flex items-center justify-between gap-2">
                      <h2 className="text-sm font-bold text-[#111827]">Modül Kütüphanesi</h2>
                      <div className="inline-flex items-center p-0.5 rounded-lg bg-[#F1F5F9] border border-[#E2E8F0] shrink-0">
                        <button
                          type="button"
                          data-testid="catalog-view-grid"
                          onClick={() => setCatalogViewMode("grid")}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer transition ${
                            catalogViewMode === "grid"
                              ? "bg-[#EEF3F8] text-[#111827] border border-[#CBD5E1]"
                              : "text-[#64748B] hover:text-[#111827]"
                          }`}
                        >
                          ⊞ Kart
                        </button>
                        <button
                          type="button"
                          data-testid="catalog-view-list"
                          onClick={() => setCatalogViewMode("list")}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer transition ${
                            catalogViewMode === "list"
                              ? "bg-[#EEF3F8] text-[#111827] border border-[#CBD5E1]"
                              : "text-[#64748B] hover:text-[#111827]"
                          }`}
                        >
                          ☰ Liste
                        </button>
                      </div>
                    </div>

                    {/* Search Bar + Filter Funnel Button */}
                    <div className="px-3.5 pb-2 flex items-center gap-1.5">
                      <div className="relative flex-1 flex items-center">
                        <svg
                          className="w-3.5 h-3.5 text-[#64748B] absolute left-3 pointer-events-none"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <circle cx="11" cy="11" r="8" />
                          <path d="M21 21l-4.35-4.35" />
                        </svg>
                        <input
                          type="text"
                          data-testid="v4-catalog-search-input"
                          value={catalogSearchQuery}
                          onChange={(e) => setCatalogSearchQuery(e.target.value)}
                          placeholder="Modül, dolap, çekmece ara..."
                          className="w-full pl-8 pr-2.5 py-1.5 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] text-xs font-medium text-[#111827] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#64748B]"
                        />
                      </div>
                      <button
                        type="button"
                        data-testid="catalog-filter-favorites"
                        onClick={() => setShowFavoritesOnly((v) => !v)}
                        title="Favori Modülleri Filtrele"
                        className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 transition cursor-pointer ${
                          showFavoritesOnly
                            ? "bg-[#EEF3F8] text-[#111827] border-[#3B82F6] font-bold"
                            : "bg-white hover:bg-[#F8FAFC] text-[#475569] border-[#CBD5E1]"
                        }`}
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                        </svg>
                      </button>
                    </div>

                    {/* Horizontal Category Chips (Tümü | Dolap | Giyinme | Çekmece | Köşe | Üst | Alt) */}
                    <div className="px-3.5 py-2.5 flex flex-wrap gap-1.5 border-b border-[#E2E8F0] bg-[#F8FAFC]">
                      {[
                        {
                          id: "tumu",
                          label: "Tümü",
                          fam: "fam_wardrobe" as ModuleFamilyId,
                          testId: "v4-subcat-tumu",
                        },
                        {
                          id: "dolap",
                          label: "Dolap",
                          fam: "fam_wardrobe" as ModuleFamilyId,
                          testId: "v4-family-chip-fam_wardrobe",
                        },
                        {
                          id: "giyinme",
                          label: "Giyinme",
                          fam: "fam_wardrobe" as ModuleFamilyId,
                          testId: "v4-subcat-giyinme",
                        },
                        {
                          id: "cekmeceler",
                          label: "Çekmece",
                          fam: "fam_kitchen_base" as ModuleFamilyId,
                          testId: "v4-subcat-cekmeceler",
                        },
                        {
                          id: "kose",
                          label: "Köşe",
                          fam: "fam_special_corner" as ModuleFamilyId,
                          testId: "v4-family-chip-fam_special_corner",
                        },
                        {
                          id: "ust",
                          label: "Üst",
                          fam: "fam_kitchen_wall" as ModuleFamilyId,
                          testId: "v4-family-chip-fam_kitchen_wall",
                        },
                        {
                          id: "alt",
                          label: "Alt",
                          fam: "fam_kitchen_base" as ModuleFamilyId,
                          testId: "v4-family-chip-fam_kitchen_base",
                        },
                        {
                          id: "ozel",
                          label: "Boy",
                          fam: "fam_kitchen_tall" as ModuleFamilyId,
                          testId: "v4-family-chip-fam_kitchen_tall",
                        },
                      ].map((cat) => {
                        const isSelected = leftSubCat === cat.id;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            data-testid={cat.testId}
                            onClick={() => {
                              setLeftSubCat(cat.id);
                              setSelectedV4Family(cat.fam);
                            }}
                            className={`px-2.5 py-1 rounded-full text-[11px] shrink-0 transition cursor-pointer border ${
                              isSelected
                                ? "bg-[#EEF3F8] text-[#111827] border-[#94A3B8] font-bold shadow-2xs"
                                : "bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#475569] border-[#E2E8F0] font-medium"
                            }`}
                          >
                            {cat.label}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        data-testid="v4-family-chip-fam_complementary"
                        onClick={() => {
                          setSelectedV4Family("fam_complementary");
                          setLeftTab("accessories");
                        }}
                        className="hidden"
                      >
                        Tamamlayıcılar
                      </button>
                    </div>

                    <div data-testid="v4- active-family-explainer" className="hidden" />

                    {/* Scrollable Module Cards + Hazır Şablonlar Section */}
                    <div className="flex-1 overflow-y-auto px-3.5 py-2.5 space-y-3">
                      <div
                        data-testid="v4-template-list"
                        className={
                          catalogViewMode === "list"
                            ? "flex flex-col gap-2"
                            : "grid grid-cols-2 gap-2"
                        }
                      >
                        {familyTemplates.map((vt, idx) => {
                          const isSelectedCard =
                            activeModule.templateId === vt.templateId ||
                            (idx === 0 && !activeModule.templateId);
                          const isFav = favoriteTemplateIds.includes(vt.templateId);
                          const minCm = Math.max(30, Math.round((vt.defaultDimensions.width - 200) / 10));
                          const maxCm = Math.round((vt.defaultDimensions.width + 200) / 10);
                          const cleanTitle = vt.name.replace(/^V4\s+/i, "");

                          if (catalogViewMode === "list") {
                            return (
                              <div
                                key={vt.templateId}
                                draggable={true}
                                onDragStart={(e) => startModuleSilhouetteDrag(e, vt.templateId)}
                                onDragEnd={() => setActiveDraggedTemplateId(null)}
                                onClick={() => applyV4Template(vt.templateId, false)}
                                className={`p-2.5 rounded-2xl border flex items-center justify-between gap-2.5 transition cursor-pointer relative group ${
                                  isSelectedCard
                                    ? "bg-[#EEF3F8] border-[#3B82F6] ring-1 ring-[#3B82F6] shadow-xs"
                                    : "bg-white hover:bg-[#F8FAFC] border-[#E2E8F0] hover:border-[#CBD5E1]"
                                }`}
                              >
                                <div className="p-1 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] shrink-0">
                                  <V3IsometricModuleIcon
                                    template={vt}
                                    size="md"
                                    testId={`v4-tpl-visual-${vt.templateId}`}
                                  />
                                </div>
                                <div className="flex-1 min-w-0 text-left">
                                  <div
                                    data-testid={`v4-apply-tpl-${vt.templateId}`}
                                    className="text-[11px] font-bold text-[#111827] leading-snug"
                                  >
                                    {cleanTitle}
                                  </div>
                                  <div className="text-[10px] text-[#475569] mt-0.5">
                                    {minCm} – {maxCm} cm • {vt.defaultDimensions.width}×{vt.defaultDimensions.height} mm
                                  </div>
                                  <div className="flex items-center gap-1 mt-1">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        applyV4Template(vt.templateId, false);
                                      }}
                                      className="px-2 py-0.5 rounded-lg bg-[#EEF3F8] text-[#111827] border border-[#CBD5E1] text-[10px] font-bold cursor-pointer"
                                    >
                                      Uygula
                                    </button>
                                    <button
                                      type="button"
                                      data-testid={`v4-append-tpl-${vt.templateId}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        dropV4TemplateWithSnap(vt.templateId);
                                      }}
                                      className="px-2 py-0.5 rounded-lg bg-white text-[#111827] border border-[#CBD5E1] text-[10px] font-bold cursor-pointer"
                                    >
                                      + Ekle
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div
                              key={vt.templateId}
                              draggable={true}
                              onDragStart={(e) => startModuleSilhouetteDrag(e, vt.templateId)}
                              onDragEnd={() => setActiveDraggedTemplateId(null)}
                              onClick={() => applyV4Template(vt.templateId, false)}
                              title={`${cleanTitle} (${minCm} – ${maxCm} cm) — Tıklayarak uygula veya sahneye sürükle`}
                              className={`p-2.5 rounded-2xl border flex flex-col items-center text-center justify-between gap-1.5 transition cursor-pointer relative group ${
                                isSelectedCard
                                  ? "bg-[#EEF3F8] border-2 border-[#3B82F6] shadow-xs"
                                  : "bg-[#F8FAFC]/60 hover:bg-[#F8FAFC] border-[#E2E8F0] hover:border-[#CBD5E1]"
                              }`}
                            >
                              <button
                                type="button"
                                data-testid={`v4-fav-toggle-${vt.templateId}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleFavoriteTemplate(vt.templateId);
                                }}
                                title={isFav ? "Favorilerden Çıkar" : "Favorilere Ekle"}
                                className={`absolute top-1.5 left-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[11px] transition cursor-pointer ${
                                  isFav
                                    ? "text-amber-500"
                                    : "text-[#CBD5E1] opacity-0 group-hover:opacity-100 hover:text-[#111827]"
                                }`}
                              >
                                ★
                              </button>

                              <button
                                type="button"
                                data-testid={`v4-append-tpl-${vt.templateId}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  dropV4TemplateWithSnap(vt.templateId);
                                }}
                                title="Yanına Yeni Modül Olarak Ekle (+)"
                                className="opacity-0 group-hover:opacity-100 absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#EEF3F8] text-[#111827] border border-[#94A3B8] flex items-center justify-center text-xs font-bold transition cursor-pointer"
                              >
                                +
                              </button>

                              <div className="w-full py-1 flex items-center justify-center">
                                <V3IsometricModuleIcon
                                  template={vt}
                                  size="lg"
                                  testId={`v4-tpl-visual-${vt.templateId}`}
                                />
                              </div>

                              <div className="w-full min-w-0">
                                <div
                                  data-testid={`v4-apply-tpl-${vt.templateId}`}
                                  className="text-[11px] font-bold text-[#111827] line-clamp-2 leading-tight"
                                >
                                  {cleanTitle}
                                </div>
                                <div className="text-[10px] text-[#64748B] mt-0.5">
                                  {minCm} – {maxCm} cm
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Hazır Şablonlar Section (Matches image_e719c6.jpg bottom-left: Giyinme Dolabı 3 Bölme | Elbise Dolabı 2 Bölme) */}
                      <div className="pt-2 border-t border-[#E2E8F0] space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-[#111827]">
                          <span>⌄ Hazır Şablonlar</span>
                          <span className="text-[10px] font-normal text-[#64748B]">İç Düzenli</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            {
                              tpl: WARDROBE_TEMPLATES[1] || WARDROBE_TEMPLATES[0],
                              title: "Giyinme Dolabı",
                              sub: "(3 Bölme)",
                              bays: 3,
                            },
                            {
                              tpl: WARDROBE_TEMPLATES[0],
                              title: "Elbise Dolabı",
                              sub: "(2 Bölme)",
                              bays: 2,
                            },
                          ].map((item, sIdx) => {
                            const isSelPreset = activeModule.bays.length === item.bays;
                            return (
                              <button
                                key={item.title}
                                type="button"
                                data-testid={`studio-ready-wardrobe-${sIdx}`}
                                onClick={() => {
                                  if (item.tpl) applyTemplate(item.tpl.templateId);
                                  setBayCount(item.bays);
                                  setActiveBayIndex(item.bays - 1);
                                }}
                                className={`p-2 rounded-2xl border flex flex-col items-center text-center gap-1 transition cursor-pointer ${
                                  isSelPreset
                                    ? "bg-[#EEF3F8] border-2 border-[#3B82F6] text-[#111827] shadow-2xs"
                                    : "bg-white hover:bg-[#F8FAFC] border-[#E2E8F0] text-[#111827]"
                                }`}
                              >
                                <V3IsometricModuleIcon
                                  widthMm={item.bays * 600}
                                  heightMm={2200}
                                  depthMm={600}
                                  bayCount={item.bays}
                                  hasDrawers={true}
                                  isOpenFront={true}
                                  size="md"
                                />
                                <div className="text-[11px] font-bold text-[#111827] leading-tight">
                                  {item.title}
                                </div>
                                <div className="text-[10px] text-[#475569] leading-none">
                                  {item.sub}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Buttons: V5 Modül/Obje Merkezi + Kütüphaneye Ekle */}
                    <div className="p-3 border-t border-[#E2E8F0] bg-white shrink-0 space-y-1.5">
                      <button
                        type="button"
                        data-testid="v5-left-footer-open-hub-btn"
                        onClick={() => {
                          setSceneHubInitialTab("modules");
                          setShowSceneHubModal(true);
                        }}
                        className="w-full py-2 px-3 rounded-xl bg-[#141413] hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 text-emerald-300" />
                        <span>+ Yeni Modül / Cihaz / .GLB Obje Ekle</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAdminModal(true)}
                        className="w-full py-2 px-3 rounded-xl bg-[#F8FAFC] hover:bg-[#EEF3F8] border border-[#CBD5E1] text-xs font-semibold text-[#111827] flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <Package className="w-3.5 h-3.5 text-[#475569]" />
                        <span>Kütüphaneye Ekle</span>
                      </button>
                    </div>
                  </div>
                  );
                })()}
                </div>
              </div>
            </div>
          </aside>
        )}

        {/* UNIFIED ARCHITECTURAL SPLITTER BAR BETWEEN PLAN LEFT PANEL AND 2D DRAWING PANE */}
        {mode === "plan" && planLeftOpen && !isCompactViewport && (
          <div
            data-testid="plan-left-resize-handle"
            data-tooltip="Sol Panel Ayırıcı — Sürükleyerek genişliği ayarlayın (Çift tık: 330px sıfırla)."
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setResizingPanel("plan-left");
            }}
            onDoubleClick={() => setPlanLeftWidthPx(330)}
            className={`birim-unified-splitter ${
              resizingPanel === "plan-left" ? "birim-unified-splitter-active" : ""
            }`}
          >
            <div className="birim-unified-splitter-grip">⋮</div>
          </div>
        )}

        {/* 2D ARCHITECTURAL PLAN / ELEVATION PANE (Supports Studio 2D & Studio 2D|3D Split View!) */}
        {((mode === "plan" && planViewLayout !== "3d_only") ||
          (mode === "studio" && (studioView === "2d" || studioSplitView))) && (
          <div
            className={`${
              mode === "plan"
                ? planViewLayout === "2d_only"
                  ? "flex-1 h-full relative"
                  : "h-full relative"
                : studioSplitView
                ? "absolute top-0 bottom-0 left-0 w-1/2 z-10"
                : "absolute inset-0 z-10"
            } flex flex-col shrink-0 min-w-0 overflow-hidden`}
            style={
              mode === "plan" && planViewLayout === "split"
                ? { width: `calc(${planSplitRatioPct}% - 12px)` }
                : undefined
            }
          >
            {/* DOCKED TOP MODULE BAR IN PLAN 2D (Never floats over the canvas or collides with spatial warnings!) */}
            {mode === "plan" && (
              <div
                data-testid="plan-hybrid-module-dock"
                className="shrink-0 relative z-30 w-full px-2.5 py-1 birim-ice-bar border-b flex items-center justify-between gap-1.5"
              >
                <div className="flex items-center gap-1 min-w-0 flex-1 birim-ice-pill px-1.5 py-1 rounded-2xl overflow-hidden">
                  {/* Prev/Next Quick Stepper when > 1 module */}
                  {project.modules.length > 1 && (
                    <div className="inline-flex items-center bg-slate-100/90 rounded-lg p-0.5 border border-slate-200/80 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setActiveModuleIndex(
                            (activeModuleIndex - 1 + project.modules.length) %
                              project.modules.length
                          )
                        }
                        title="Önceki Modül"
                        className="w-6 h-6 rounded-md hover:bg-white text-slate-700 flex items-center justify-center transition active:scale-95 cursor-pointer"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setActiveModuleIndex(
                            (activeModuleIndex + 1) % project.modules.length
                          )
                        }
                        title="Sonraki Modül"
                        className="w-6 h-6 rounded-md hover:bg-white text-slate-700 flex items-center justify-center transition active:scale-95 cursor-pointer"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Scrollable Module Pills Strip (Scrollbar strictly hidden on all browsers) */}
                  <div className="flex items-center gap-1 overflow-x-auto min-w-0 flex-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden py-0.5">
                    {project.modules.map((m, idx) => {
                      const isAct = activeModuleIndex === idx;
                      return (
                        <div
                          key={m.id}
                          className={`group rounded-lg text-xs font-semibold inline-flex items-center shrink-0 whitespace-nowrap transition-all duration-150 ${
                            isAct
                              ? "bg-[#EFF6FF] text-[#0F172A] border-2 border-[#2563EB] shadow-2xs pr-1"
                              : "bg-slate-100/85 hover:bg-white text-slate-800 border border-slate-200/80 hover:border-blue-300"
                          }`}
                        >
                          <button
                            type="button"
                            data-testid={`plan-mod-tab-${idx}`}
                            onClick={() => setActiveModuleIndex(idx)}
                            title={`#${idx + 1} ${m.name} (${m.dimensions.width}×${m.dimensions.height}×${m.dimensions.depth}mm • ${m.bays.length} Bölme)`}
                            className="px-1.5 py-0.5 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <V3IsometricModuleIcon module={m} size="sm" />
                            <span
                              className={`font-mono font-extrabold text-[10px] px-1 py-0.5 rounded ${
                                isAct
                                  ? "bg-[#2563EB] text-white"
                                  : "bg-white/90 text-[#0F172A] border border-slate-200/80"
                              }`}
                            >
                              #{idx + 1}
                            </span>

                            {isAct && (
                              <span className="font-bold text-[11px] text-[#0F172A] max-w-[90px] xl:max-w-[140px] truncate ml-0.5">
                                {m.name}
                              </span>
                            )}
                          </button>

                          {isAct && project.modules.length >= 1 && (
                            <button
                              type="button"
                              data-testid={`plan-delete-mod-${idx}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                removeModuleAt(idx);
                              }}
                              title="Bu modülü sil"
                              className="w-5 h-5 rounded flex items-center justify-center text-slate-500 hover:bg-red-100 hover:text-red-700 transition cursor-pointer shrink-0"
                            >
                              <Trash2 className="w-3 h-3 shrink-0" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Pinned Right Action Cluster */}
                  <div className="flex items-center gap-1 pl-1 border-l border-slate-200/90 shrink-0">
                    <button
                      type="button"
                      data-testid="plan-mod-hybrid-dropdown-btn"
                      onClick={() => setPlanModDropdownOpen((v) => !v)}
                      title="Tüm Dolaplar Listesini Aç / Kapat"
                      className={`px-2 py-1 rounded-lg border text-[11px] font-bold inline-flex items-center gap-1 shrink-0 whitespace-nowrap transition active:scale-95 cursor-pointer ${
                        planModDropdownOpen
                          ? "bg-[#2563EB] text-white border-[#1D4ED8] shadow-2xs"
                          : "bg-white/90 hover:bg-blue-50 text-[#0F172A] border-slate-200/90"
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>{project.modules.length}</span>
                      <ChevronDown
                        className={`w-3 h-3 transition-transform duration-200 ${
                          planModDropdownOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    <button
                      type="button"
                      data-testid="plan-add-module-btn"
                      onClick={addAdjacentModule}
                      title="Aktif modülün bir kopyasını yanına bitişik ekle"
                      className="px-2 py-1 rounded-lg bg-white hover:bg-blue-50 text-[#0F172A] border border-slate-200/90 text-[11px] font-bold inline-flex items-center gap-1 shrink-0 whitespace-nowrap shadow-2xs transition active:scale-95 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-blue-600" />
                      <span className="sr-only">Kopyala</span>
                    </button>

                    <button
                      type="button"
                      data-testid="plan-quick-open-wall-elevation-btn"
                      onClick={() =>
                        setPlanRightView((prev) =>
                          prev === "2d-elevation" ? "3d-iso" : "2d-elevation"
                        )
                      }
                      title="Sağ panelde Duvar Cephe Görünüşünü aç/kapat"
                      className={`px-2 py-1 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 shrink-0 whitespace-nowrap shadow-2xs transition active:scale-95 cursor-pointer ${
                        planRightView === "2d-elevation"
                          ? "bg-[#2563EB] text-white border border-[#1D4ED8]"
                          : "bg-white hover:bg-blue-50 text-[#0F172A] border border-slate-200/90"
                      }`}
                    >
                      <span>🏠</span>
                      <span className="sr-only">{planRightView === "2d-elevation" ? "3D" : "Cephe"}</span>
                    </button>
                  </div>
                </div>

                {/* DROPDOWN MENU ANCHORED CLEANLY BELOW DOCKED TOP BAR */}
                {planModDropdownOpen && (
                  <div
                    data-testid="plan-mod-hybrid-dropdown-menu"
                    className="absolute top-full left-2.5 mt-1 z-50 w-80 max-w-[calc(100%-20px)] bg-white/95 backdrop-blur-xl rounded-2xl border border-slate-200 ring-1 ring-slate-900/10 shadow-[0_18px_40px_rgba(15,23,42,0.18)] p-2 space-y-1 max-h-72 overflow-y-auto"
                  >
                    <div className="flex items-center justify-between px-2 py-1 border-b border-slate-200/70">
                      <span className="text-[11px] font-extrabold text-[#0F172A]">
                        📦 Sahnedeki Modüller ({project.modules.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => setPlanModDropdownOpen(false)}
                        className="text-slate-400 hover:text-slate-800 text-xs font-bold cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                    {project.modules.map((m, idx) => {
                      const isAct = activeModuleIndex === idx;
                      return (
                        <div
                          key={m.id}
                          onClick={() => {
                            setActiveModuleIndex(idx);
                            setPlanModDropdownOpen(false);
                          }}
                          className={`p-2 rounded-xl flex items-center justify-between gap-2 transition cursor-pointer ${
                            isAct
                              ? "bg-[#EFF6FF] border border-[#2563EB] text-[#0F172A] shadow-2xs"
                              : "hover:bg-slate-100/90 text-[#0F172A] border border-transparent"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="p-1 rounded-lg bg-white border border-slate-200/90 shrink-0">
                              <V3IsometricModuleIcon module={m} size="sm" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-extrabold text-[#0F172A] truncate">
                                #{idx + 1} {m.name}
                              </div>
                              <div className="text-[10px] font-mono font-semibold text-slate-600">
                                {m.dimensions.width}×{m.dimensions.height}×{m.dimensions.depth}mm • {m.bays.length} Bölme
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {isAct && (
                              <span className="px-1.5 py-0.5 rounded-md bg-[#2563EB] text-white text-[9px] font-extrabold">
                                Seçili
                              </span>
                            )}
                            {project.modules.length > 1 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeModuleAt(idx);
                                }}
                                title="Bu modülü sil"
                                className="p-1.5 rounded-lg text-slate-400 hover:bg-red-100 hover:text-red-700 transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 2D VIEWPORT BODY (Automatically offset outside left/top/right floating frosted glass panels!) */}
            <div className="flex-1 min-h-0 relative w-full">
              {mode === "studio" && (studioView === "2d" || studioSplitView) && (
                <div
                  style={{
                    left: studioSplitView
                      ? leftOpen
                        ? isCompactViewport
                          ? "16px"
                          : `calc(min(${studioLeftWidthPx}px, clamp(368px, 29vw, 460px)) + 26px)`
                        : "84px"
                      : leftOpen
                      ? isCompactViewport
                        ? "84px"
                        : `calc(min(${studioLeftWidthPx}px, clamp(368px, 29vw, 460px)) + 26px)`
                      : "84px",
                  }}
                  className="absolute top-[112px] z-20 inline-flex flex-row items-center gap-1 birim-ice-pill p-1 rounded-[22px] text-[#141413] transition-[left] duration-[380ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
                >
                  {[
                    {
                      id: "3d",
                      label: "3D Sahne",
                      active: false,
                      onClick: () => {
                        startTransition(() => {
                          if (studioSplitView) toggleStudioSplitView();
                          setStudioView("3d");
                        });
                      },
                    },
                    {
                      id: "elevation",
                      label: "2D Cephe",
                      active: studio2DMode === "elevation",
                      onClick: () => {
                        startTransition(() => {
                          setStudio2DMode("elevation");
                        });
                      },
                    },
                    {
                      id: "section",
                      label: "2D Kesit",
                      active: studio2DMode === "section",
                      onClick: () => {
                        startTransition(() => {
                          setStudio2DMode("section");
                        });
                      },
                    },
                    {
                      id: "plan",
                      label: "2D Plan",
                      active: studio2DMode === "plan",
                      onClick: () => {
                        startTransition(() => {
                          setStudio2DMode("plan");
                        });
                      },
                    },
                  ].map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={b.onClick}
                      className={`px-3 py-1.5 rounded-2xl text-[11px] leading-none transition cursor-pointer whitespace-nowrap ${
                        b.active
                          ? "birim-ice-charcoal-pill font-bold"
                          : "text-[#44403C] hover:bg-white/75 hover:text-[#141413] font-semibold"
                      }`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              )}
              <V3CadViewport2D
                mode={mode === "plan" ? "plan" : studio2DMode}
                interactivePlan={mode === "plan" || (mode === "studio" && studio2DMode === "plan")}
                snapMm={snapMm}
                studioSafeInsets={cad2DSafeInsets}
              />
            </div>
          </div>
        )}

        {/* UNIFIED ARCHITECTURAL SPLITTER BAR BETWEEN 2D PLAN AND 3D/ELEVATION PANE (Identical across Plan & Studio!) */}
        {mode === "plan" && planViewLayout === "split" && (
          <div
            data-testid="plan-split-resize-handle"
            data-tooltip={`2D / 3D Ekran Ayırıcı (%${planSplitRatioPct}) — Sürükleyerek sahne oranını değiştirin (Çift tık: %50-%50).`}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const parentW =
                e.currentTarget.parentElement?.getBoundingClientRect().width ||
                Math.max(600, window.innerWidth - 444);
              splitDragStartRef.current = {
                startX: e.clientX,
                startPct: planSplitRatioPct,
                containerW: parentW,
              };
              setResizingPanel("plan-split");
            }}
            onDoubleClick={() => setPlanSplitRatioPct(50)}
            className={`birim-unified-splitter ${
              resizingPanel === "plan-split" ? "birim-unified-splitter-active" : ""
            }`}
          >
            <div className="birim-unified-splitter-grip">⋮</div>
          </div>
        )}

        {/* IDENTICAL UNIFIED SPLITTER BAR IN STUDIO 2D|3D SPLIT VIEW */}
        {mode === "studio" && studioSplitView && (
          <div
            data-testid="studio-split-resize-handle"
            style={{ left: "calc(50% - 5px)" }}
            className="birim-unified-splitter !absolute top-0 bottom-0 z-25 pointer-events-none"
          >
            <div className="birim-unified-splitter-grip">⋮</div>
          </div>
        )}

        {/* PERSISTENT FULL-BLEED 3D WEBGL VIEWPORT & PLAN RIGHT PANE */}
        <main
          className={`${
            mode === "studio" && studioView === "2d" && !studioSplitView
              ? "hidden"
              : mode === "studio" && studioSplitView
              ? "absolute top-0 bottom-0 right-0 w-1/2 z-0"
              : mode === "studio" || mode === "showroom"
              ? "absolute inset-0 z-0"
              : "flex-1 relative h-full"
          } flex flex-col overflow-hidden`}
          style={
            mode === "plan"
              ? { width: `calc(${100 - planSplitRatioPct}% - 7px)` }
              : undefined
          }
        >
          {/* EKRAN 7 (FAZ 7): SAĞ ÜST GÖRÜNÜM SEÇİCİ (2D Plan | 3D Görünüm | Kamera & Cephe Modları) */}
          {mode === "plan" && (
            <div
              data-testid="plan-right-view-switcher"
              className="min-h-[42px] px-3 py-1 birim-ice-bar border-b flex items-center justify-between gap-2 shrink-0 z-20 flex-wrap"
            >
              {/* Primary Frosted Ice 2D | 2D+3D | 3D Switcher Pills */}
              <div className="inline-flex items-center p-0.5 rounded-2xl birim-ice-pill gap-0.5">
                <button
                  type="button"
                  data-testid="plan-layout-2d-only"
                  onClick={() => {
                    startTransition(() => {
                      setPlanViewLayout("2d_only");
                    });
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    planViewLayout === "2d_only"
                      ? "bg-white text-[#111827] shadow-2xs"
                      : "text-[#64748B] hover:text-[#111827]"
                  }`}
                 title="Yalnız 2D Plan">
                  2D
                </button>
                <button
                  type="button"
                  data-testid="plan-layout-split"
                  onClick={() => {
                    startTransition(() => {
                      setPlanViewLayout("split");
                    });
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    planViewLayout === "split"
                      ? "bg-[#2563EB] text-white shadow-2xs"
                      : "text-[#64748B] hover:text-[#111827]"
                  }`}
                 title="Bölünmüş 2D + 3D Görünüm">
                  2D|3D
                </button>
                <button
                  type="button"
                  data-testid="plan-layout-3d-only"
                  onClick={() => {
                    startTransition(() => {
                      setPlanViewLayout("3d_only");
                    });
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    planViewLayout === "3d_only"
                      ? "bg-[#2563EB] text-white shadow-2xs"
                      : "text-[#64748B] hover:text-[#111827]"
                  }`}
                 title="Tam Ekran 3D Görünüm">
                  3D
                </button>
              </div>

              {/* Camera & 2D Elevation Sub-Buttons (Preserves all existing testids) */}
              <div className="flex items-center gap-1 flex-wrap">
                {[
                  { id: "3d-iso", label: "3D", cam: "iso" as const },
                  { id: "2d-elevation", label: "Cephe" },
                  { id: "2d-section", label: "Kesit" },
                  { id: "3d-front", label: "Ön", cam: "front" as const },
                  { id: "3d-side", label: "Yan", cam: "side" as const },
                  { id: "3d-top", label: "Üst", cam: "top" as const },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    data-testid={`plan-right-view-${opt.id}`}
                    onClick={() => {
                      setPlanRightView(
                        opt.id as
                          | "3d-iso"
                          | "3d-front"
                          | "3d-side"
                          | "3d-top"
                          | "2d-elevation"
                          | "2d-section"
                      );
                      if (opt.cam) {
                        setCameraPreset(opt.cam);
                      }
                    }}
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                      planRightView === opt.id
                        ? "bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]"
                        : "bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#475569]"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
                {[35, 50, 65].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    data-testid={`plan-split-preset-${pct}`}
                    onClick={() => setPlanSplitRatioPct(pct)}
                    className="hidden"
                  >
                    %{pct}
                  </button>
                ))}
                <button
                  type="button"
                  data-testid="plan-right-toggle-dimensions"
                  onClick={() => setShow3DDimensions((prev) => !prev)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer ${
                    show3DDimensions
                      ? "bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]"
                      : "bg-[#F8FAFC] text-[#475569]"
                  }`}
                >
                  <Ruler className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  data-testid="plan-right-door-toggle"
                  onClick={toggleDoorOpen}
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer ${
                    doorOpenAngleDeg > 0
                      ? "bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]"
                      : "bg-[#F8FAFC] text-[#475569]"
                  }`}
                >
                  <DoorOpen className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  data-testid="plan-3d-expand-toggle"
                  onClick={() =>
                    setPlanViewLayout((prev) => (prev === "3d_only" ? "split" : "3d_only"))
                  }
                  title="3D Görünümü Büyüt / Bölünmüş Görünüme Dön"
                  className="p-1.5 rounded-lg bg-[#F8FAFC] hover:bg-[#EFF6FF] text-[#334155] border border-[#E2E8F0] cursor-pointer"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Hidden Studio Door Toggle Hook (In Design Studio, modules are in the bottom film strip and Interior View is on the left 3D pill) */}
          {mode === "studio" && (
            <div data-testid="studio-top-module-bar" className="hidden">
              <button type="button" data-testid="studio-door-toggle" onClick={toggleDoorOpen}>
                {doorOpenAngleDeg > 0 ? "Kapakları Kapat" : "İçini Göster"}
              </button>
            </div>
          )}

                    <div className="relative flex-1 w-full h-full overflow-hidden flex flex-col">
            <Viewport3DErrorBoundary
              fallback={
                <Software3DFallbackViewport
                  project={project}
                  activeModuleIndex={activeModuleIndex}
                  selectedComponentId={selectedComponentId}
                  selectedSceneObjectId={selectedSceneObjectId}
                  doorOpenAngleDeg={doorOpenAngleDeg}
                  drawerOpenMm={drawerOpenMm}
                  explodedFactor={explodedFactor}
                  onSelectModule={(idx) => setActiveModuleIndex(idx)}
                  onSelectComponent={(cid) => setSelectedComponentId(cid)}
                  onSelectSceneObject={(oid) => setSelectedSceneObjectId(oid)}
                  onToggleDoorOpen={toggleDoorOpen}
                  onSwitchTo2DCad={() => {
                    if (mode === "plan") setPlanRightView("2d-elevation");
                  }}
                />
              }
            >
              <V3ThreeViewport
                theme={
                  canvasTheme === "dark"
                    ? "dark"
                    : mode === "showroom"
                    ? "showroom-neutral"
                    : "warm-light"
                }
                showGrid={!(mode === "showroom" && zenMode)}
                showInCanvasHud={mode === "studio"}
                showDimensions={show3DDimensions}
                stageSafeInsets={viewportSafeInsets}
                onToggleDimensions={handleToggle3DDimensions}
                onRequest2DElevation={() => {
                  if (mode === "plan") setPlanRightView("2d-elevation");
                }}
              />
            </Viewport3DErrorBoundary>

            {mode === "plan" &&
              (planRightView === "2d-elevation" ||
                planRightView === "2d-section") && (
                <div
                  data-testid="plan-right-2d-overlay"
                  className="absolute inset-0 z-10 bg-[#F8FAFC] flex flex-col"
                >
                  <V3CadViewport2D
                    mode={
                      planRightView === "2d-elevation" ? "elevation" : "section"
                    }
                    interactivePlan={false}
                    snapMm={snapMm}
                  />
                </div>
              )}
          </div>

          {/* EKRAN 7 (FAZ 8): KOMPAKT İKON ODAKLI BUZLU CAM SEÇİLİ MODÜL PANELİ */}
          {mode === "plan" && planViewLayout !== "3d_only" && (
            <div
              data-testid="plan-selected-module-card"
              className="border-t birim-ice-bar px-3.5 py-2 space-y-2 shrink-0 z-20"
            >
              {/* Single-Row Icon-First Module Strip */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-1.5 rounded-xl bg-white/90 border border-slate-200/90 shadow-2xs shrink-0">
                    <V3IsometricModuleIcon module={activeModule} size="sm" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        data-testid="plan-card-module-name"
                        className="text-xs font-extrabold text-[#0F172A] truncate"
                      >
                        {activeModule.name}
                      </span>
                      <span
                        data-testid="plan-card-module-code"
                        className="text-[10px] font-mono text-slate-500 bg-slate-100/90 px-1.5 py-0.5 rounded-md border border-slate-200/80"
                      >
                        MOD-{activeModule.bays.length}K-{width}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px]">
                      <span
                        data-testid="plan-card-dimensions-text"
                        className="font-mono font-bold text-slate-700"
                        title="Genişlik × Derinlik × Yükseklik"
                      >
                        📐 {width}×{depth}×{height}
                      </span>
                      <span
                        data-testid="plan-card-wall-name"
                        className="font-semibold text-blue-700 bg-blue-50/90 px-1.5 py-0.5 rounded-md border border-blue-200/60"
                        title="Yerleştiği Duvar"
                      >
                        🧱 {activeSpatialMetrics.hostWallName}
                      </span>
                      <span
                        data-testid="plan-card-right-gap"
                        className="font-mono font-bold text-emerald-700 bg-emerald-50/90 px-1.5 py-0.5 rounded-md border border-emerald-200/60"
                        title="Sağ Duvar Boşluğu"
                      >
                        ⇥ {activeSpatialMetrics.rightClearanceMm}mm
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tactile Icon Action Bar */}
                <div className="flex items-center gap-1 ml-auto">
                  <div className="inline-flex items-center rounded-xl bg-slate-100/90 p-0.5 border border-slate-200/80">
                    <button
                      type="button"
                      onClick={() => alignActiveModuleOnWall("left")}
                      className="px-2 py-1 rounded-lg hover:bg-white text-[11px] font-bold text-slate-700 hover:shadow-2xs transition cursor-pointer"
                      title="Duvar Soluna Yasla"
                    >
                      ⇤
                    </button>
                    <button
                      type="button"
                      onClick={() => alignActiveModuleOnWall("center")}
                      className="px-2 py-1 rounded-lg hover:bg-white text-[11px] font-bold text-slate-700 hover:shadow-2xs transition cursor-pointer"
                      title="Duvar Merkezine Hizala"
                    >
                      ⇹
                    </button>
                    <button
                      type="button"
                      onClick={() => alignActiveModuleOnWall("right")}
                      className="px-2 py-1 rounded-lg hover:bg-white text-[11px] font-bold text-slate-700 hover:shadow-2xs transition cursor-pointer"
                      title="Duvar Sağına Yasla"
                    >
                      ⇥
                    </button>
                  </div>

                  <button
                    type="button"
                    data-testid="plan-card-edit-dims-btn"
                    onClick={() => setPlanEditingModuleDims((v) => !v)}
                    title="Ölçü, Boşluk ve Baza Ayarlarını Aç/Kapat"
                    className={`h-8 px-2.5 rounded-xl border text-xs font-bold flex items-center gap-1 transition-all active:scale-[0.97] cursor-pointer ${
                      planEditingModuleDims
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                        : "bg-white hover:bg-blue-50/80 text-slate-700 border-slate-200/90 shadow-2xs"
                    }`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span className="sr-only">Ölçü</span>
                  </button>

                  <button
                    type="button"
                    onClick={rotateActiveModule90}
                    title="90° Köşe Dönüşü"
                    className="w-8 h-8 rounded-xl bg-white hover:bg-slate-100 border border-slate-200/90 text-slate-700 flex items-center justify-center shadow-2xs transition active:scale-95 cursor-pointer"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={duplicateActiveModule}
                    title="Modülü Kopyala"
                    className="w-8 h-8 rounded-xl bg-white hover:bg-slate-100 border border-slate-200/90 text-slate-700 flex items-center justify-center shadow-2xs transition active:scale-95 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  {project.modules.length > 1 && (
                    <button
                      type="button"
                      onClick={removeActiveModule}
                      title="Modülü Sil"
                      className="w-8 h-8 rounded-xl bg-white hover:bg-red-50 border border-slate-200/90 text-slate-500 hover:text-red-600 flex items-center justify-center shadow-2xs transition active:scale-95 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    type="button"
                    data-testid="plan-edit-module-detail-btn"
                    onClick={() => setMode("studio")}
                    title="Tasarım Stüdyosunda Detaylı Düzenle"
                    className="h-8 px-3 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-[0.98] cursor-pointer"
                  >
                    <span>↗</span>
                    <span className="sr-only">Detay</span>
                  </button>
                </div>
              </div>

              {/* Smooth Stretch-Animated Dimension & Clearance Drawer */}
              <div
                className={`grid transition-all duration-200 ease-out origin-top ${
                  planEditingModuleDims
                    ? "grid-rows-[1fr] opacity-100 scale-y-100 pt-1"
                    : "grid-rows-[0fr] opacity-0 scale-y-95 pointer-events-none"
                }`}
              >
                <div className="overflow-hidden">
                  <div
                    data-testid="plan-card-inline-dims-box"
                    className="p-2.5 rounded-2xl bg-slate-50/90 border border-slate-200/90 grid grid-cols-5 gap-2 text-xs"
                  >
                    <label className="space-y-0.5">
                      <span className="text-[10px] font-bold text-slate-500 block">↔ Genişlik</span>
                      <input
                        type="number"
                        data-testid="plan-card-width-input"
                        min={300}
                        max={3600}
                        step={10}
                        value={width}
                        onChange={(e) =>
                          setDimensions(
                            Math.max(300, Math.min(3600, Number(e.target.value) || 300)),
                            height,
                            depth
                          )
                        }
                        className="w-full px-2 py-1 rounded-lg bg-white border border-slate-300 font-mono font-bold text-[#0F172A]"
                      />
                    </label>
                    <label className="space-y-0.5">
                      <span className="text-[10px] font-bold text-slate-500 block">↗ Derinlik</span>
                      <input
                        type="number"
                        data-testid="plan-card-depth-input"
                        min={250}
                        max={900}
                        step={10}
                        value={depth}
                        onChange={(e) =>
                          setDimensions(
                            width,
                            height,
                            Math.max(250, Math.min(900, Number(e.target.value) || 600))
                          )
                        }
                        className="w-full px-2 py-1 rounded-lg bg-white border border-slate-300 font-mono font-bold text-[#0F172A]"
                      />
                    </label>
                    <label className="space-y-0.5">
                      <span className="text-[10px] font-bold text-slate-500 block">↕ Yükseklik</span>
                      <input
                        type="number"
                        data-testid="plan-card-height-input"
                        min={350}
                        max={2800}
                        step={10}
                        value={height}
                        onChange={(e) =>
                          setDimensions(
                            width,
                            Math.max(350, Math.min(2800, Number(e.target.value) || 2200)),
                            depth
                          )
                        }
                        className="w-full px-2 py-1 rounded-lg bg-white border border-slate-300 font-mono font-bold text-[#0F172A]"
                      />
                    </label>
                    <label className="space-y-0.5">
                      <span className="text-[10px] font-bold text-slate-500 block">⇤ Sol Boşluk</span>
                      <input
                        type="number"
                        data-testid="plan-card-left-gap-input"
                        min={0}
                        max={5000}
                        step={10}
                        value={activeSpatialMetrics.leftClearanceMm}
                        onChange={(e) =>
                          alignActiveModuleOnWall("custom_left", Number(e.target.value) || 0)
                        }
                        className="w-full px-2 py-1 rounded-lg bg-white border border-slate-300 font-mono font-bold text-[#0F172A]"
                      />
                    </label>
                    <label className="space-y-0.5">
                      <span className="text-[10px] font-bold text-slate-500 block">▬ Baza</span>
                      <select
                        data-testid="plan-card-plinth-select"
                        value={activeModule.carcass.plinthHeight ?? 60}
                        onChange={(e) => setPlinthHeight(Number(e.target.value))}
                        className="w-full px-2 py-1 rounded-lg bg-white border border-slate-300 font-mono font-bold text-[#0F172A] cursor-pointer"
                      >
                        <option value={0}>0 mm</option>
                        <option value={60}>60 mm</option>
                        <option value={80}>80 mm</option>
                        <option value={100}>100 mm</option>
                        <option value={120}>120 mm</option>
                      </select>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* B1R1M GALLERY SHOWROOM FROSTED ICE ICON PRESENTATION HUD */}
          {mode === "showroom" && (
            <>
              {zenMode ? (
                <div className="absolute top-[64px] right-5 z-30">
                  <button
                    type="button"
                    data-testid="showroom-exit-zen"
                    title="Tam Ekrandan Çık"
                    onClick={() => setZenMode(false)}
                    className="w-10 h-10 rounded-2xl birim-ice-pill text-[#141413] flex items-center justify-center cursor-pointer hover:scale-105 transition"
                  >
                    <Eye className="w-4 h-4 text-[#141413]" />
                    <span className="sr-only">Tam Ekrandan Çık</span>
                  </button>
                </div>
              ) : (
                <>
                  {/* Top-Left Compact Frosted Ice Project & Quote Pill */}
                  <div className="absolute top-[64px] left-5 z-20 birim-ice-pill px-3.5 py-2 rounded-2xl flex items-center gap-3">
                    <div>
                      <div className="text-xs font-bold text-[#141413] leading-tight">{project.title}</div>
                      <div className="text-[10px] font-mono text-[#57534E]">
                        {project.modules.length} Modül • {(liveCustomerAndFactoryStats.totalModWidth / 10).toFixed(0)} cm
                      </div>
                    </div>
                    <button
                      type="button"
                      title="Teklif Föyü Oluştur"
                      onClick={() => setShowQuickSellModal(true)}
                      className="w-9 h-9 rounded-xl birim-ice-btn-active flex items-center justify-center transition cursor-pointer"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      <span className="sr-only">Teklif Föyü Oluştur</span>
                    </button>
                  </div>

                  {/* Right Vertical Frosted Ice Camera & Door Icon Dock */}
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-1.5 birim-ice-pill p-1.5 rounded-2xl w-[54px]">
                    {[
                      { id: "iso", label: "Perspektif", tag: "3D" },
                      { id: "front", label: "Ön Cephe", tag: "ÖN" },
                      { id: "side", label: "Yan Bakış", tag: "YAN" },
                      { id: "top", label: "Üst Bakış", tag: "ÜST" },
                    ].map((cam) => (
                      <button
                        key={cam.id}
                        type="button"
                        title={cam.label}
                        data-testid={`showroom-cam-${cam.id}`}
                        onClick={() =>
                          setCameraPreset(cam.id as "iso" | "front" | "side" | "top")
                        }
                        className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center gap-0.5 transition cursor-pointer ${
                          cameraPreset === cam.id
                            ? "birim-ice-btn-active"
                            : "text-[#44403C] hover:bg-white/75"
                        }`}
                      >
                        <Camera className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-[8px] font-mono font-bold leading-none">{cam.tag}</span>
                      </button>
                    ))}

                    <div className="w-7 h-px bg-slate-900/12 my-0.5" />

                    <button
                      type="button"
                      data-testid="showroom-door-toggle"
                      title={doorOpenAngleDeg > 0 ? "Kapakları Kapat" : "İç Düzeni Göster"}
                      onClick={toggleDoorOpen}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition cursor-pointer ${
                        doorOpenAngleDeg > 0
                          ? "birim-ice-btn-active"
                          : "birim-ice-btn text-[#141413]"
                      }`}
                    >
                      {doorOpenAngleDeg > 0 ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <DoorOpen className="w-4 h-4" />
                      )}
                      <span className="sr-only">
                        {doorOpenAngleDeg > 0 ? "Kapakları Kapat" : "İç Düzeni Göster"}
                      </span>
                    </button>

                    <div className="w-full px-1 pt-0.5 flex flex-col items-center gap-1" title={`Kapak Açısı: ${doorOpenAngleDeg}°`}>
                      <span className="text-[8px] font-mono font-bold text-[#44403C]">{doorOpenAngleDeg}°</span>
                      <input
                        type="range"
                        min={0}
                        max={90}
                        value={doorOpenAngleDeg}
                        onChange={(e) => setDoorOpenAngleDeg(Number(e.target.value))}
                        className="w-9 accent-[#141413] h-1 bg-slate-300/80 rounded-lg cursor-pointer"
                      />
                    </div>

                    <div className="w-full px-1 pb-0.5 flex flex-col items-center gap-1" title={`Çekmece Açıklığı: ${drawerOpenMm} mm`}>
                      <span className="text-[8px] font-mono font-bold text-[#44403C]">{drawerOpenMm}</span>
                      <input
                        type="range"
                        min={0}
                        max={350}
                        data-testid="showroom-drawer-open-slider"
                        aria-label="Çekmece açılma mesafesi"
                        step={25}
                        value={drawerOpenMm}
                        onChange={(e) => setDrawerOpenMm(Number(e.target.value))}
                        className="w-9 accent-[#141413] h-1 bg-slate-300/80 rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Bottom Pure Swatch Frosted Ice Dock + Price Pill */}
                  <div className="absolute bottom-4 left-5 right-5 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
                    <div className="pointer-events-auto flex items-center gap-2 birim-ice-pill px-3 py-2 rounded-2xl overflow-x-auto max-w-full">
                      <Palette className="w-4 h-4 text-[#8C7A6B] shrink-0" />
                      <div className="flex items-center gap-1.5">
                        {DEFAULT_MATERIALS.map((mat) => {
                          const isSelected =
                            activeModule.carcass.doorMaterialId === mat.id;
                          return (
                            <button
                              key={mat.id}
                              type="button"
                              title={mat.name.split(" (")[0]}
                              data-testid={`showroom-mat-${mat.id}`}
                              onClick={() => {
                                const savedSnap =
                                  showroomMaterialPreview?.snapshot || {
                                    carcass: JSON.parse(JSON.stringify(activeModule.carcass)),
                                    bays: JSON.parse(JSON.stringify(activeModule.bays)),
                                    componentMaterialOverrides: activeModule.componentMaterialOverrides
                                      ? { ...activeModule.componentMaterialOverrides }
                                      : {},
                                  };
                                applyMaterialByTargetScope("doors", mat.id, undefined, false);
                                setShowroomMaterialPreview({
                                  label: mat.name.split(" (")[0],
                                  snapshot: savedSnap,
                                });
                              }}
                              className={`w-7 h-7 rounded-full flex items-center justify-center transition shrink-0 cursor-pointer ${
                                isSelected
                                  ? "ring-2 ring-[#141413] ring-offset-2 ring-offset-white/60 scale-110"
                                  : "border border-white/80 hover:scale-110 shadow-xs"
                              }`}
                              data-material-swatch="true" style={getMaterialSwatchStyle(mat)}
                            >
                              <span className="sr-only">{mat.name.split(" (")[0]}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {showroomMaterialPreview && (
                      <div
                        data-testid="showroom-material-preview-bar"
                        className="pointer-events-auto flex items-center gap-2 birim-ice-pill px-3 py-1.5 rounded-2xl text-xs"
                      >
                        <span className="font-semibold text-[#141413] truncate max-w-[140px]">
                          {showroomMaterialPreview.label}
                        </span>
                        <button
                          type="button"
                          title="Kalıcı Uygula"
                          data-testid="showroom-confirm-material-btn"
                          onClick={() => setShowroomMaterialPreview(null)}
                          className="w-7 h-7 rounded-xl birim-ice-btn-active flex items-center justify-center cursor-pointer"
                        >
                          ✓
                        </button>
                        <button
                          type="button"
                          title="Geri Al"
                          data-testid="showroom-cancel-material-btn"
                          onClick={() => {
                            restoreModuleMaterialSnapshot(showroomMaterialPreview.snapshot);
                            setShowroomMaterialPreview(null);
                          }}
                          className="w-7 h-7 rounded-xl birim-ice-btn text-[#44403C] flex items-center justify-center cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    )}

                    <div className="pointer-events-auto flex items-center gap-2.5 birim-ice-pill px-4 py-2 rounded-2xl">
                      <span
                        data-testid="showroom-total-price"
                        className="text-base font-black font-mono text-stone-900"
                      >
                        €
                        {pricing.totalWithVatEur.toLocaleString("tr-TR", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                      <span className="text-[11px] font-mono text-stone-600">
                        (
                        {pricing.totalWithVatTry.toLocaleString("tr-TR", {
                          maximumFractionDigits: 0,
                        })}{" "}
                        TL)
                      </span>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </main>

        {/* Mobile/Tablet Floating Button to Reopen Right Inspector when collapsed */}
        {mode === "studio" && !studioRightOpen && (
          <button
            type="button"
            title="Özellikler Panelini Aç"
            data-testid="studio-reopen-right-inspector-btn"
            onClick={() => setStudioRightOpen(true)}
            className="fixed right-3.5 top-16 z-40 w-10 h-10 rounded-2xl birim-ice-pill text-[#111827] flex items-center justify-center cursor-pointer hover:scale-105 transition"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="sr-only">Gövde & Özellikler</span>
          </button>
        )}

        {/* RIGHT PANEL — FLOATING ROUNDED-CORNER FROSTED ICE SHELL OVER TRANSPARENT CONTAINER (Matches image_cf8426.png 1-to-1!) */}
        {(mode === "studio" || (mode === "plan" && showInspectorInPlan)) && (
          <aside
            data-testid="studio-right-inspector"
            aria-hidden={mode === "studio" ? !studioRightOpen : false}
            className={`${
              mode === "studio"
                ? `absolute right-3.5 top-[62px] bottom-[64px] bg-transparent pointer-events-none ${
                    studioRightOpen ? "birim-ice-right-open" : "birim-ice-right-closed"
                  }`
                : "bg-transparent p-2.5 pointer-events-none shrink-0 relative"
            } text-[#111827] flex flex-col z-30 max-w-[92vw]`}
            style={{
              width: isCompactViewport
                ? "min(396px, 92vw)"
                : `clamp(376px, ${studioRightWidthPx}px, min(520px, 92vw))`,
            }}
          >
            {!isCompactViewport && (
              <div
                data-testid="studio-right-resize-handle"
                title="Sağ panel genişliğini değiştirmek için sürükleyin"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setResizingPanel("studio-right");
                }}
                className="pointer-events-auto absolute top-4 -left-1.5 bottom-4 w-3 rounded-full cursor-col-resize hover:bg-white/55 z-40 transition-colors"
              />
            )}

            <div data-draggable-shell="studio-right-shell" className="pointer-events-auto flex-1 min-h-0 flex flex-col birim-ice-floating-shell rounded-[28px] overflow-hidden relative">
            {/* Module Title Header (Matches image_cf8426.png 1-to-1 • Zero-Lag Draggable) */}
            <div onPointerDown={(e) => startZeroLagModalDrag(e)} title="Paneli taşımak için basılı tutup sürükleyin" className="px-4 pt-3.5 pb-2.5 birim-ice-shell-header flex items-start justify-between gap-2 relative cursor-grab active:cursor-grabbing select-none">
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="mt-0.5 text-[#57534E] shrink-0">
                  <Box className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-[#141413] truncate leading-tight">
                    {activeModule.name}
                  </div>
                  {isSimpleBlumMode ? (
                    <>
                      <div className="text-[11px] font-medium text-[#78716C] mt-0.5 truncate">
                        {width / 10} × {height / 10} × {depth / 10} cm • {activeModule.bays.length} Bölmeli Tasarım
                      </div>
                      <span data-testid="studio-active-module-id" className="sr-only">
                        ID: {activeModule.id} • MOD-{activeModule.bays.length}K-{width}
                      </span>
                    </>
                  ) : (
                    <div
                      data-testid="studio-active-module-id"
                      className="text-[11px] font-mono text-[#57534E] mt-0.5 truncate"
                    >
                      ID: {activeModule.id} • MOD-{activeModule.bays.length}K-{width}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setStudioRightOpen(false)}
                  title="Sağ Paneli Daralt"
                  className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#57534E] hover:text-[#111827] transition cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  data-testid="studio-duplicate-active-module-btn"
                  onClick={duplicateActiveModule}
                  title="Modülü Kopyala"
                  className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#57534E] hover:text-[#1C1917] transition cursor-pointer"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setOpenRightDrawer((prev) => (prev === "more_menu" ? null : "more_menu"))
                  }
                  title="Teknik Araçlar & Modül İşlemleri"
                  className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#57534E] hover:text-[#1C1917] transition cursor-pointer font-bold text-sm leading-none"
                >
                  ⋮
                </button>
              </div>

            </div>

            {openRightDrawer === "more_menu" && (
              <div
                data-testid="studio-right-more-dropdown"
                className="absolute right-3 top-12 w-64 birim-ice-popover rounded-2xl p-2 z-[140] space-y-1 text-xs shadow-2xl"
              >
                <button
                  type="button"
                  data-testid="more-menu-assembly-diagram-btn"
                  onClick={() => {
                    setShowAssemblyModal(true);
                    setOpenRightDrawer(null);
                  }}
                  className="w-full px-3 py-2 rounded-xl hover:bg-white/80 text-left font-semibold text-[#141413] flex items-center gap-2.5 cursor-pointer"
                >
                  <span className="text-sm leading-none">🔧</span>
                  <span>Montaj Şeması &amp; Kurulum Kılavuzu</span>
                </button>
                <button
                  type="button"
                  data-testid="more-menu-studio-render-btn"
                  onClick={() => {
                    setShowStudioRenderModal(true);
                    setOpenRightDrawer(null);
                  }}
                  className="w-full px-3 py-2 rounded-xl hover:bg-white/80 text-left font-semibold text-[#141413] flex items-center gap-2.5 cursor-pointer"
                >
                  <span className="text-sm leading-none">🎬</span>
                  <span>2K Render &amp; Path-Tracing Stüdyosu</span>
                </button>
                <button
                  type="button"
                  data-testid="more-menu-custom-hardware-btn"
                  onClick={() => {
                    setShowCustomHardwareModal(true);
                    setOpenRightDrawer(null);
                  }}
                  className="w-full px-3 py-2 rounded-xl hover:bg-white/80 text-left font-semibold text-[#141413] flex items-center gap-2.5 cursor-pointer"
                >
                  <span className="text-sm leading-none">🔩</span>
                  <span>Yeni Kulp &amp; Özel Donanım Ekle</span>
                </button>
                <button
                  type="button"
                  data-testid="more-menu-island-table-btn"
                  onClick={() => {
                    setShowIslandTableModal(true);
                    setOpenRightDrawer(null);
                  }}
                  className="w-full px-3 py-2 rounded-xl hover:bg-white/80 text-left font-semibold text-[#141413] flex items-center gap-2.5 cursor-pointer"
                >
                  <span className="text-sm leading-none">🏝️</span>
                  <span>Ada Mutfak &amp; Çok Açılı Masa</span>
                </button>
                <button
                  type="button"
                  data-testid="more-menu-snap-angled-wall-btn"
                  onClick={() => {
                    const sol = snapModuleToAngledWall(activeModuleIndex);
                    setOpenRightDrawer(null);
                    if (sol) {
                      setApprovalBanner({
                        ok: true,
                        text: `📐 Modül "${sol.wallName}" duvarına paralel (${sol.moduleRotationYDeg}°) yaslandı.`,
                      });
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl hover:bg-white/80 text-left font-semibold text-[#141413] flex items-center gap-2.5 cursor-pointer"
                >
                  <span className="text-sm leading-none">📐</span>
                  <span>Dolabı Duvara Paralel Yasla</span>
                </button>
                <div className="h-px bg-slate-900/10 my-1" />
                <button
                  type="button"
                  onClick={() => {
                    setIsBomModalOpen(true);
                    setOpenRightDrawer(null);
                  }}
                  className="w-full px-3 py-2 rounded-xl hover:bg-white/80 text-left font-semibold text-[#1C1917] flex items-center gap-2 cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-[#57534E]" />
                  <span>BOM &amp; Kesim Listesi (CNC)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowRulesModal(true);
                    setOpenRightDrawer(null);
                  }}
                  className="w-full px-3 py-2 rounded-xl hover:bg-white/80 text-left font-semibold text-[#1C1917] flex items-center gap-2 cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-[#57534E]" />
                  <span>Mühendislik Doğrulaması</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAdminModal(true);
                    setOpenRightDrawer(null);
                  }}
                  className="w-full px-3 py-2 rounded-xl hover:bg-white/80 text-left font-semibold text-[#1C1917] flex items-center gap-2 cursor-pointer"
                >
                  <Wrench className="w-3.5 h-3.5 text-[#57534E]" />
                  <span>V4 Kütüphane Yönetimi</span>
                </button>
                <div className="h-px bg-slate-900/10 my-1" />
                <button
                  type="button"
                  data-testid="studio-delete-active-module-btn"
                  disabled={project.modules.length === 0}
                  onClick={() => {
                    removeActiveModule();
                    setOpenRightDrawer(null);
                  }}
                  className="w-full px-3 py-2 rounded-xl hover:bg-red-50 disabled:opacity-40 text-left font-semibold text-red-600 flex items-center gap-2 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Bu Modülü Sil</span>
                </button>
              </div>
            )}

            {/* 6 ICON-DRIVEN TABS: Shown in Mimar & Üretim modes (hidden in Kolay mode for zero clutter) */}
            {!isSimpleBlumMode && (
            <div className="mx-3 mt-2 p-1 birim-ice-pill rounded-2xl grid grid-cols-6 gap-1 shrink-0">
              {[
                { id: "dimensions", label: "Ölçü", Icon: Ruler },
                { id: "carcass", label: "Gövde", Icon: Box },
                { id: "door", label: "Kapak", Icon: DoorOpen },
                { id: "interior", label: "İç", Icon: Layers },
                { id: "all", label: "Donanım", Icon: Wrench },
                { id: "material", label: "Renk", Icon: Palette },
              ].map((sec) => {
                const isAct = studioInspectorTab === sec.id;
                const TabIcon = sec.Icon;
                return (
                  <button
                    key={sec.id}
                    type="button"
                    data-testid={`studio-sec-tab-${sec.id}`}
                    title={`${sec.label}`}
                    onClick={() => {
                      const nextTab = sec.id as
                        | "all"
                        | "dimensions"
                        | "carcass"
                        | "interior"
                        | "door"
                        | "material";
                      setStudioInspectorTab(nextTab);
                      if (nextTab === "interior") {
                        setLeftTab("interior");
                        setLeftOpen(true);
                        if (doorOpenAngleDeg === 0 && !doorsHiddenStudio) {
                          setDoorOpenAngleDeg(85);
                        }
                      } else if (nextTab === "material") {
                        setLeftTab("materials");
                        setLeftOpen(true);
                      } else if (nextTab === "all") {
                        setLeftTab("hardware");
                        setLeftOpen(true);
                      }
                      if (nextTab === "all") {
                        if (doorOpenAngleDeg === 0 && !doorsHiddenStudio) {
                          setDoorOpenAngleDeg(65);
                        }
                        if (typeof window !== "undefined") {
                          window.dispatchEvent(
                            new CustomEvent("birim:set-hardware-view-mode", {
                              detail: "hardware",
                            })
                          );
                          window.dispatchEvent(
                            new CustomEvent("birim:set-material-mode", {
                              detail: { active: false },
                            })
                          );
                        }
                      } else if (nextTab === "material") {
                        if (doorOpenAngleDeg > 0) {
                          setDoorOpenAngleDeg(0);
                        }
                        if (typeof window !== "undefined") {
                          window.dispatchEvent(
                            new CustomEvent("birim:set-hardware-view-mode", {
                              detail: "normal",
                            })
                          );
                          window.dispatchEvent(
                            new CustomEvent("birim:set-material-mode", {
                              detail: { active: true },
                            })
                          );
                        }
                      } else if (typeof window !== "undefined") {
                        window.dispatchEvent(
                          new CustomEvent("birim:set-hardware-view-mode", {
                            detail: "normal",
                          })
                        );
                        window.dispatchEvent(
                          new CustomEvent("birim:set-material-mode", {
                            detail: { active: false },
                          })
                        );
                      }
                    }}
                    className={`h-9 rounded-xl transition cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                      isAct
                        ? "birim-ice-btn-active font-bold"
                        : "text-[#44403C] hover:text-[#141413] hover:bg-white/65"
                    }`}
                  >
                    <TabIcon className={`w-4 h-4 shrink-0 ${isAct ? "text-[#E5D3B8]" : "text-[#57534E]"}`} />
                    <span className="sr-only">{sec.label}</span>
                  </button>
                );
              })}
            </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {isSimpleBlumMode && (
                <SimpleCustomerInspector
                  activeModule={activeModule}
                  activeBay={activeBay}
                  activeBayIndex={activeBayIndex}
                  bayWidths={activeBreakdown.bayWidths}
                  materials={DEFAULT_MATERIALS}
                  doorOpenAngleDeg={doorOpenAngleDeg}
                  onSelectBay={setActiveBayIndex}
                  onSplitBay={splitBayIntoTwo}
                  onMergeBay={removeBayAt}
                  onRemoveBayAndShrink={removeBayAndShrinkModule}
                  onShrinkDoubleBay={shrinkDoubleBayToSingle}
                  onSetDimensions={setDimensions}
                  onUpdatePlinthConfig={(patch) => updateCarcassConfig(patch)}
                  onToggleDoorOpen={toggleDoorOpen}
                  onSetBayDoorType={setBayDoorType}
                  onSetSlidingMountingType={setModuleSlidingMountingType}
                  onSetBayV4DoorConfig={setBayV4DoorConfig}
                  onApplyBayPreset={(bIdx, preset) => applyBayInteriorPreset(bIdx, preset)}
                  onAddShelf={addShelf}
                  onRemoveShelf={removeShelf}
                  onAddSubDivider={addSubDivider}
                  onRemoveSubDivider={removeSubDivider}
                  onAddDrawer={addDrawer}
                  onRemoveDrawer={removeDrawer}
                  onAddInternalDrawer={addInternalDrawer}
                  onAddHangingRail={addHangingRail}
                  onRemoveHangingRail={removeHangingRail}
                  onAddSpecialFitting={(bIdx, fType) => addSpecialFitting(bIdx, fType)}
                  onSetMaterials={setMaterials}
                  onToggleLed={(en, opts) => toggleModuleLedLighting(en, opts)}
                  onSwitchTier={setExperienceTier}
                  onArmTapToPlace={(spec) => setArmedTapItem(spec)}
                  renderInteriorIcon={(kind, sz) => renderInteriorComponentIllustration(kind, sz)}
                />
              )}

              {!isSimpleBlumMode &&
                (studioInspectorTab === "carcass" || studioInspectorTab === "all") && (
                  <div
                    data-testid="carcass-parametric-engineering-card"
                    className="p-3.5 rounded-[24px] birim-ice-card space-y-3 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-extrabold text-[#141413]">
                          Karkas Topolojisi, 5 Arkalık Modu &amp; CNC Ön Freze
                        </div>
                        <div className="text-[10.5px] text-[#57534E]">
                          Net iç derinlik, birleşim kertmeleri ve bant düşümü anında güncellenir
                        </div>
                      </div>
                      {validationIssues.length > 0 && (
                        <button
                          type="button"
                          data-testid="studio-autofix-issues-btn"
                          onClick={() => {
                            if (
                              unifiedEngineeringReport.blockingSafetyAndEngineeringErrors.some(
                                (e) => e.remediationProposals && e.remediationProposals.length > 0
                              )
                            ) {
                              setShowRulesModal(true);
                              return;
                            }
                            const fixed = autoFixProjectIssues();
                            setApprovalBanner({
                              ok: true,
                              text:
                                fixed > 0
                                  ? `✓ ${fixed} mühendislik uyarısı otomatik düzeltildi.`
                                  : "Tüm modül parametreleri güncel.",
                            });
                            setTimeout(() => setApprovalBanner(null), 3000);
                          }}
                          className="px-2.5 py-1 rounded-full birim-ice-charcoal-pill text-[10.5px] font-bold shrink-0 cursor-pointer"
                        >
                          ⚡ Oto-Düzelt ({validationIssues.length})
                        </button>
                      )}
                    </div>

                    {/* Birleşim Topolojisi: Tip A / B / C / D */}
                    <div className="space-y-1">
                      <span className="text-[11px] font-bold text-[#44403C] block">
                        Gövde Birleşim Topolojisi
                      </span>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { id: "sides_through" as const, label: "Tip A • Yanlar Tam Boy" },
                          { id: "top_bottom_through" as const, label: "Tip B • Alt/Üst Tam" },
                          { id: "miter_45" as const, label: "Tip C • 45° Gönye" },
                          { id: "kitchen_stretchers" as const, label: "Tip D • 90mm Kayıtlı" },
                        ].map((jt) => {
                          const curTopo =
                            activeModule.carcass.carcassJoineryTopology ||
                            (activeModule.category === "base" ? "kitchen_stretchers" : "sides_through");
                          const act = curTopo === jt.id;
                          return (
                            <button
                              key={jt.id}
                              type="button"
                              onClick={() =>
                                updateCarcassConfig({ carcassJoineryTopology: jt.id })
                              }
                              className={`py-1.5 px-2.5 rounded-2xl border text-left text-[11px] font-semibold transition cursor-pointer ${
                                act ? "birim-ice-charcoal-pill" : "birim-ice-btn text-[#141413]"
                              }`}
                            >
                              {jt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 5 Arkalık Modu */}
                    <div className="space-y-1">
                      <span className="text-[11px] font-bold text-[#44403C] block">
                        Arkalık Konstrüksiyonu (5 Mod)
                      </span>
                      <div className="grid grid-cols-5 gap-1">
                        {[
                          { id: "grooved" as const, label: "Kanallı" },
                          { id: "rebated" as const, label: "Lambalı" },
                          { id: "nailed" as const, label: "Çakma" },
                          { id: "flush" as const, label: "18mm Tam" },
                          { id: "none" as const, label: "Arkalıksız" },
                        ].map((bp) => {
                          const curBp = activeModule.carcass.backPanelType || "grooved";
                          const act = curBp === bp.id;
                          return (
                            <button
                              key={bp.id}
                              type="button"
                              onClick={() =>
                                updateCarcassConfig({
                                  backPanelType: bp.id,
                                  backThickness: bp.id === "flush" ? 18 : bp.id === "none" ? 0 : 8,
                                })
                              }
                              className={`py-1.5 px-1 rounded-xl border text-center text-[10.5px] font-bold transition cursor-pointer ${
                                act ? "birim-ice-charcoal-pill" : "birim-ice-btn text-[#141413]"
                              }`}
                            >
                              {bp.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* V7.4 Çoklu Delik Sistemi (System 32 Line Boring) */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-[#44403C]">
                          Çoklu Delik Sistemi (System 32)
                        </span>
                        <div className="flex items-center gap-1.5">
                          <select
                            value={resolveMultiHoleSpec(activeModule).rowCount}
                            onChange={(e) =>
                              updateCarcassConfig({
                                multiHoleRowCount: Number(e.target.value) === 3 ? 3 : 2,
                              })
                            }
                            className="px-1.5 py-0.5 rounded-lg bg-white border border-slate-300 text-[10px] font-bold"
                          >
                            <option value={2}>2 Sıra (Ön+Arka)</option>
                            <option value={3}>3 Sıra (Derin Gövde)</option>
                          </select>
                          <label
                            title="Orta dikmelerde Ø5mm delikleri iki yüzden kör delmek yerine tek seferde boydan boya (18mm) del"
                            className="flex items-center gap-1 text-[10px] font-semibold text-[#44403C] cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={Boolean(activeModule.carcass.multiHoleDividerThroughBore)}
                              onChange={(e) =>
                                updateCarcassConfig({
                                  multiHoleDividerThroughBore: e.target.checked,
                                })
                              }
                            />
                            <span>Boydan</span>
                          </label>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        {MULTI_HOLE_MODE_CATALOG.map((mh) => {
                          const curMode = resolveMultiHoleSpec(activeModule).mode;
                          const act = curMode === mh.id;
                          return (
                            <button
                              key={mh.id}
                              type="button"
                              title={mh.description}
                              onClick={() => updateCarcassConfig({ multiHoleMode: mh.id })}
                              className={`py-1.5 px-1.5 rounded-xl border text-center text-[10.5px] font-bold transition cursor-pointer ${
                                act ? "birim-ice-charcoal-pill" : "birim-ice-btn text-[#141413]"
                              }`}
                            >
                              {mh.shortLabel}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Ön Freze (Pre-Milling) + Şelale Tezgâh & Görünen Yan & Baza Çekmecesi */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div className="p-2 rounded-2xl birim-ice-btn flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-[#44403C]">Ön Freze</span>
                        <select
                          value={activeModule.carcass.preMillingMm ?? 0}
                          onChange={(e) =>
                            updateCarcassConfig({ preMillingMm: Number(e.target.value) })
                          }
                          className="bg-transparent font-mono font-bold text-xs text-[#141413] cursor-pointer focus:outline-none"
                        >
                          <option value={0}>0 mm</option>
                          <option value={0.5}>0.5 mm</option>
                          <option value={1}>1.0 mm</option>
                          <option value={2}>2.0 mm</option>
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          updateCarcassConfig({
                            hasPlinthDrawer: !activeModule.carcass.hasPlinthDrawer,
                          })
                        }
                        className={`p-2 rounded-2xl border text-[11px] font-bold transition cursor-pointer ${
                          activeModule.carcass.hasPlinthDrawer
                            ? "birim-ice-charcoal-pill"
                            : "birim-ice-btn text-[#141413]"
                        }`}
                      >
                        {activeModule.carcass.hasPlinthDrawer ? "✓ Baza Çekmecesi" : "+ Baza Çekmecesi"}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          updateCarcassConfig({
                            appliedEndPanelLeft:
                              activeModule.carcass.appliedEndPanelLeft === "floor_to_top"
                                ? "none"
                                : "floor_to_top",
                            appliedEndPanelRight:
                              activeModule.carcass.appliedEndPanelRight === "floor_to_top"
                                ? "none"
                                : "floor_to_top",
                          })
                        }
                        className={`p-2 rounded-2xl border text-[11px] font-bold transition cursor-pointer ${
                          activeModule.carcass.appliedEndPanelLeft &&
                          activeModule.carcass.appliedEndPanelLeft !== "none"
                            ? "birim-ice-charcoal-pill"
                            : "birim-ice-btn text-[#141413]"
                        }`}
                      >
                        Görünen Yan Panel
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          updateCarcassConfig({
                            hasWaterfallLeft: !activeModule.carcass.hasWaterfallLeft,
                            hasWaterfallRight: !activeModule.carcass.hasWaterfallRight,
                          })
                        }
                        className={`p-2 rounded-2xl border text-[11px] font-bold transition cursor-pointer ${
                          activeModule.carcass.hasWaterfallLeft
                            ? "birim-ice-charcoal-pill"
                            : "birim-ice-btn text-[#141413]"
                        }`}
                      >
                        Şelale Yan Tezgâh
                      </button>

                      {/* Süpürgelik Kertmesi (MD §2.1) */}
                      <button
                        type="button"
                        onClick={() =>
                          updateCarcassConfig({
                            baseboardNotch: activeModule.carcass.baseboardNotch?.enabled
                              ? { enabled: false, heightMm: 80, depthMm: 15 }
                              : { enabled: true, heightMm: 80, depthMm: 15 },
                          })
                        }
                        className={`p-2 rounded-2xl border text-[11px] font-bold transition cursor-pointer ${
                          activeModule.carcass.baseboardNotch?.enabled
                            ? "birim-ice-charcoal-pill"
                            : "birim-ice-btn text-[#141413]"
                        }`}
                        title="Yan dikme alt arka köşesine 80×15mm duvar süpürgeliği kertmesi açar"
                      >
                        {activeModule.carcass.baseboardNotch?.enabled
                          ? "✓ Süpürgelik Kertme"
                          : "Süpürgelik Kertme"}
                      </button>

                      {/* Çatı Eğimli Kesim (MD §2.1 & §7.4) */}
                      <button
                        type="button"
                        onClick={() =>
                          updateCarcassConfig({
                            slopedCeiling: activeModule.carcass.slopedCeiling?.enabled
                              ? {
                                  enabled: false,
                                  slopeType: "side_gable",
                                  kneeWallHeightMm: 1500,
                                  slopeAngleDeg: 32,
                                }
                              : {
                                  enabled: true,
                                  slopeType: "side_gable",
                                  kneeWallHeightMm: Math.max(1100, height - 600),
                                  slopeAngleDeg: 32,
                                },
                          })
                        }
                        className={`p-2 rounded-2xl border text-[11px] font-bold transition cursor-pointer ${
                          activeModule.carcass.slopedCeiling?.enabled
                            ? "birim-ice-charcoal-pill"
                            : "birim-ice-btn text-[#141413]"
                        }`}
                        title="Çatı arası / mansard eğimli tavan açılı karkas ve kapak kesimi"
                      >
                        {activeModule.carcass.slopedCeiling?.enabled
                          ? "✓ Çatı Eğimi (32°)"
                          : "Çatı Eğimli Kesim"}
                      </button>
                    </div>

                    {/* Çekmece Kasa Tipi & İç Çekmece Menteşe Çözümü (MD §5.1 & §5.2) */}
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/60">
                      <div className="space-y-1">
                        <span className="text-[10.5px] font-bold text-[#44403C] block">
                          Çekmece Kasa Sistemi
                        </span>
                        <select
                          value={activeModule.carcass.drawerBoxSystem || "metal_box_legrabox"}
                          onChange={(e) =>
                            updateCarcassConfig({
                              drawerBoxSystem: e.target.value as
                                | "wooden_undermount"
                                | "metal_box_legrabox"
                                | "metal_box_tandembox"
                                | "ball_bearing_side",
                            })
                          }
                          className="w-full p-1.5 rounded-xl birim-ice-btn text-[11px] font-bold text-[#141413] cursor-pointer"
                        >
                          <option value="metal_box_legrabox">LEGRABOX Metal (LW-38)</option>
                          <option value="metal_box_tandembox">TANDEMBOX Metal (LW-75)</option>
                          <option value="wooden_undermount">Ahşap Gizli Ray (LW-42)</option>
                          <option value="ball_bearing_side">Bilyalı Teleskopik (LW-26)</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10.5px] font-bold text-[#44403C] block">
                          İç Çekmece Menteşe Çözümü
                        </span>
                        <select
                          value={
                            activeModule.carcass.internalDrawerHingeSolution ||
                            "spacer_block_25mm"
                          }
                          onChange={(e) =>
                            updateCarcassConfig({
                              internalDrawerHingeSolution: e.target.value as
                                | "spacer_block_25mm"
                                | "zero_protrusion_155deg",
                            })
                          }
                          className="w-full p-1.5 rounded-xl birim-ice-btn text-[11px] font-bold text-[#141413] cursor-pointer"
                        >
                          <option value="spacer_block_25mm">25mm Besleme Çıtası</option>
                          <option value="zero_protrusion_155deg">155° Sıfır Çıkıntı Menteşe</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

              {!isSimpleBlumMode &&
                (studioInspectorTab === "carcass" || studioInspectorTab === "all") && (
                  <PanelCutoutInspector
                    activeModule={activeModule}
                    canExportProduction={unifiedEngineeringReport.canExportToCncAndSaw}
                    allModules={project.modules}
                    roomObstacles={spaceObstacles}
                    bomCutPieces={(bom?.cutList || []).filter((cp) => cp.moduleId === activeModule.id).map((cp) => mapCutPieceToCncPieceInput(cp))}
                    onChangeCutouts={(nextCo) => setModuleUtilityCutouts(nextCo)}
                    onAutoResolveCornerCollisions={() => {
                      const fixedCount = autoResolveCornerCollisions();
                      setApprovalBanner({
                        ok: true,
                        text:
                          fixedCount > 0
                            ? `✓ ${fixedCount} köşe birleşimine otomatik 50 mm kör çıta eklendi ve açılım çakışması giderildi.`
                            : "Çözülecek köşe çakışması bulunamadı.",
                      });
                      setTimeout(() => setApprovalBanner(null), 3500);
                    }}
                  />
                )}

              {/* ARCHITECT / FACTORY CONTEXTUAL BAY & DRAG PALETTE (Shown only on Interior tab, never burying Ölçü/Gövde/Kapak!) */}
              {!isSimpleBlumMode && studioInspectorTab === "interior" && (
              <div
                data-testid="blum-clean-inspector-card"
                className="space-y-3"
              >
                {/* 1. BÖLME SEÇİCİ & SEÇİLİ BÖLMEYİ 2'YE BÖL (ARA DİKME - SÜRÜKLE VEYA TIKLA) */}
                <div className="p-3 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Columns className="w-4 h-4 text-blue-600" />
                      <span className="text-xs font-extrabold text-slate-900">
                        Bölmeler ({activeModule.bays.length})
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {activeModule.bays.length > 1 && (
                        <>
                          <button
                            type="button"
                            onClick={() => removeBayAt(activeBayIndex)}
                            title="Ara dikmeyi kaldırıp yan bölmeyle birleştir (dolap dış genişliği sabit kalır)"
                            className="px-2 py-1 rounded-lg bg-[#FAF9F6] hover:bg-[#EFECE5] border border-[#DED8CC] text-[#44403C] text-[11px] font-semibold transition cursor-pointer"
                          >
                            Birleştir
                          </button>
                          <button
                            type="button"
                            onClick={() => removeBayAndShrinkModule(activeBayIndex)}
                            title="Seçili bölmeyi kapak ve iç düzeniyle çıkar ve dolap genişliğini daralt"
                            className="px-2 py-1 rounded-lg bg-[#FAF9F6] hover:bg-red-50 border border-[#DED8CC] hover:border-red-200 text-red-700 text-[11px] font-semibold transition cursor-pointer"
                          >
                            Bölmeyi Sil (Daralt)
                          </button>
                        </>
                      )}
                      <div
                        role="button"
                        tabIndex={0}
                        data-testid="simple-split-selected-bay-btn"
                        draggable={true}
                        onDragStart={(e) =>
                          startAccessorySilhouetteDrag(e, {
                            id: "lib_carcass_divider",
                            visual: "carcass_divider",
                            title: "Ara Dikme (2'ye Böl)",
                            cat: "dikme",
                            spec: "Seçili Bölmeyi 2'ye Böler",
                          })
                        }
                        onDragEnd={() => {
                          if (typeof window !== "undefined") {
                            (window as any).__birimActiveDraggedAccessory = null;
                          }
                        }}
                        onClick={() => splitBayIntoTwo(activeBayIndex)}
                        title="Seçili bölmeyi iç düzenini koruyarak ortadan 2'ye böler (veya 3D gövdeye sürükleyin)"
                        className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold flex items-center gap-1 shadow-2xs transition cursor-grab active:cursor-grabbing select-none"
                      >
                        <div className="pointer-events-none flex items-center gap-1">
                          <Columns className="w-3.5 h-3.5" />
                          <span>+ 2&apos;ye Böl</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {activeModule.bays.map((b, idx) => {
                      const isActB = idx === activeBayIndex;
                      const bw = activeBreakdown.bayWidths[idx] || currentBayWidthMm;
                      return (
                        <button
                          key={b.index}
                          type="button"
                          onClick={() => setActiveBayIndex(idx)}
                          className={`py-1.5 px-2 rounded-xl border flex flex-col items-center justify-center transition cursor-pointer ${
                            isActB
                              ? "bg-blue-50 border-2 border-blue-600 text-blue-950 font-extrabold shadow-2xs"
                              : "bg-slate-50/80 hover:bg-slate-100 border-slate-200 text-slate-700 font-semibold"
                          }`}
                        >
                          <span className="text-xs">Bölme {idx + 1}</span>
                          <span className="text-[10px] font-mono text-slate-500">{bw} mm</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. 8'Lİ BÜYÜK 3D İKON SÜRÜKLE-BIRAK PALETİ (HER ZAMAN GÖRÜNÜR, <div draggable={true}>) */}
                <div className="p-3 rounded-2xl bg-gradient-to-b from-blue-50/50 to-white border-2 border-blue-200/90 shadow-2xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-blue-600" />
                      <span>Parça Paleti (Sürükle veya Tıkla)</span>
                    </span>
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-full">
                      🖐️ 3D&apos;ye Sürükle
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      {
                        id: "lib_shelf",
                        title: "Raf",
                        visual: "shelf" as const,
                        count: activeBay?.shelves.length || 0,
                        onClick: () => addShelf(activeBayIndex),
                      },
                      {
                        id: "lib_sub_divider",
                        title: "Raf Arası Dikme",
                        visual: "sub_divider" as const,
                        count: activeBay?.subDividers?.length || 0,
                        onClick: () => addSubDivider(activeBayIndex),
                      },
                      {
                        id: "lib_carcass_divider",
                        title: "Ara Dikme",
                        visual: "carcass_divider" as const,
                        count: Math.max(0, activeModule.bays.length - 1),
                        onClick: () => splitBayIntoTwo(activeBayIndex),
                      },
                      {
                        id: "lib_drawer",
                        title: "Çekmece",
                        visual: "drawer" as const,
                        count: activeBay?.drawers.filter((d) => !d.isInternal).length || 0,
                        onClick: () => addDrawer(activeBayIndex),
                      },
                      {
                        id: "lib_internal_drawer",
                        title: "İç Çekmece",
                        visual: "internal_drawer" as const,
                        count: activeBay?.drawers.filter((d) => d.isInternal).length || 0,
                        onClick: () => addInternalDrawer(activeBayIndex, 140),
                      },
                      {
                        id: "lib_rail",
                        title: "Askılık",
                        visual: "rail" as const,
                        count: activeBay?.hangingRails.length || 0,
                        onClick: () => addHangingRail(activeBayIndex),
                      },
                      {
                        id: "lib_trouser_rack",
                        title: "Pantolonluk",
                        visual: "trouser_rack" as const,
                        count:
                          activeBay?.specialFittings?.filter((f) => f.type === "trouser_rack")
                            .length || 0,
                        onClick: () => addSpecialFitting(activeBayIndex, "trouser_rack"),
                      },
                      {
                        id: "lib_shoe_rack",
                        title: "Ayakkabılık",
                        visual: "shoe_rack" as const,
                        count:
                          activeBay?.specialFittings?.filter((f) => f.type === "shoe_rack")
                            .length || 0,
                        onClick: () => addSpecialFitting(activeBayIndex, "shoe_rack"),
                      },
                    ].map((tile) => (
                      <div
                        key={tile.id}
                        role="button"
                        tabIndex={0}
                        data-testid={`right-quick-drag-${tile.id}`}
                        draggable={true}
                        onDragStart={(e) =>
                          startAccessorySilhouetteDrag(e, {
                            id: tile.id,
                            visual: tile.visual,
                            title: tile.title,
                            cat: "all",
                            spec: tile.title,
                          })
                        }
                        onDragEnd={() => {
                          if (typeof window !== "undefined") {
                            (window as any).__birimActiveDraggedAccessory = null;
                          }
                        }}
                        onClick={tile.onClick}
                        title={`${tile.title} — 3D dolap üzerine sürükleyip bırakın veya tıklayın`}
                        className="p-2 rounded-2xl bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-500 flex flex-col items-center justify-between gap-1 transition cursor-grab active:cursor-grabbing select-none relative group shadow-2xs"
                      >
                        <span className="pointer-events-none opacity-0 group-hover:opacity-100 absolute top-1 left-1 px-1 rounded bg-blue-600 text-white text-[8px] font-bold">
                          ⠿
                        </span>
                        {tile.count > 0 && (
                          <span className="pointer-events-none absolute top-1 right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center">
                            {tile.count}
                          </span>
                        )}
                        <div className="pointer-events-none py-0.5 flex items-center justify-center">
                          {renderInteriorComponentIllustration(tile.visual, "sm")}
                        </div>
                        <span className="pointer-events-none text-[10px] font-bold text-slate-900 leading-tight text-center line-clamp-2">
                          {tile.title}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Active Bay Compact Item Chips (1-Click Delete) */}
                  {activeBay &&
                    (activeBay.shelves.length > 0 ||
                      (activeBay.subDividers?.length || 0) > 0 ||
                      activeBay.drawers.length > 0 ||
                      activeBay.hangingRails.length > 0) && (
                      <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-1.5">
                        {activeBay.shelves.map((sh, sIdx) => (
                          <span
                            key={sh.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 text-[11px] font-semibold text-slate-800"
                          >
                            <span>Raf {sIdx + 1}</span>
                            <button
                              type="button"
                              onClick={() => removeShelf(activeBayIndex, sh.id)}
                              className="text-slate-400 hover:text-red-600 font-bold cursor-pointer ml-0.5"
                              title="Rafı sil"
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                        {(activeBay.subDividers || []).map((sd, sdIdx) => (
                          <span
                            key={sd.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 border border-blue-200 text-[11px] font-bold text-blue-900"
                          >
                            <span>Dikme {sdIdx + 1}</span>
                            <button
                              type="button"
                              onClick={() => removeSubDivider(activeBayIndex, sd.id)}
                              className="text-blue-400 hover:text-red-600 font-bold cursor-pointer ml-0.5"
                              title="Raf arası dikmeyi sil"
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                        {activeBay.drawers.map((dr, dIdx) => (
                          <span
                            key={dr.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 text-[11px] font-semibold text-slate-800"
                          >
                            <span>Çekmece {dIdx + 1}</span>
                            <button
                              type="button"
                              onClick={() => removeDrawer(activeBayIndex, dr.id)}
                              className="text-slate-400 hover:text-red-600 font-bold cursor-pointer ml-0.5"
                              title="Çekmeceyi sil"
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                        {activeBay.hangingRails.map((rl, rIdx) => (
                          <span
                            key={rl.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 text-[11px] font-semibold text-slate-800"
                          >
                            <span>Askı {rIdx + 1}</span>
                            <button
                              type="button"
                              onClick={() => removeHangingRail(activeBayIndex, rl.id)}
                              className="text-slate-400 hover:text-red-600 font-bold cursor-pointer ml-0.5"
                              title="Askılığı sil"
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                </div>

                {/* 3. SADE GÖRÜNÜM İKON KARTLARI (ÖLÇÜ & KAPAK & RENK) */}
                {isSimpleBlumMode && (
                  <>
                    <div className="p-3 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2.5">
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          {
                            lbl: "G (En)",
                            val: width,
                            onChange: (v: number) => setDimensions(v, height, depth),
                          },
                          {
                            lbl: "Y (Boy)",
                            val: height,
                            onChange: (v: number) => setDimensions(width, v, depth),
                          },
                          {
                            lbl: "D (Derinlik)",
                            val: depth,
                            onChange: (v: number) => setDimensions(width, height, v),
                          },
                        ].map((dItem) => (
                          <div
                            key={dItem.lbl}
                            className="p-2 rounded-xl bg-slate-50 border border-slate-200/90 text-center"
                          >
                            <div className="text-[10px] font-bold text-slate-500">{dItem.lbl}</div>
                            <input
                              type="number"
                              step={50}
                              value={dItem.val}
                              onChange={(e) => dItem.onChange(Number(e.target.value))}
                              className="w-full text-center font-mono text-sm font-black text-slate-900 bg-transparent focus:outline-none mt-0.5"
                            />
                          </div>
                        ))}
                      </div>

                      {/* 4-Icon Door Picker for Selected Bay */}
                      <div className="grid grid-cols-4 gap-1.5 pt-1">
                        {[
                          {
                            id: "single_left" as const,
                            label: "Sol Kapak",
                            active: activeBay?.door?.type === "single_left",
                            onClick: () => setBayDoorType(activeBayIndex, "single_left"),
                          },
                          {
                            id: "single_right" as const,
                            label: "Sağ Kapak",
                            active: activeBay?.door?.type === "single_right",
                            onClick: () => setBayDoorType(activeBayIndex, "single_right"),
                          },
                          {
                            id: "double" as const,
                            label: "Çift Kapak",
                            active: activeBay?.door?.type === "double",
                            onClick: () => setBayDoorType(activeBayIndex, "double"),
                          },
                          {
                            id: "open" as const,
                            label: "Açık",
                            active: activeBay?.door?.type === "open" || Boolean(activeModule.isOpenFront),
                            onClick: () => setBayDoorType(activeBayIndex, "open"),
                          },
                        ].map((dBtn) => (
                          <button
                            key={dBtn.id}
                            type="button"
                            onClick={dBtn.onClick}
                            className={`py-2 px-1 rounded-xl border flex flex-col items-center gap-1 transition cursor-pointer ${
                              dBtn.active
                                ? "bg-blue-50 border-2 border-blue-600 text-blue-950 font-bold"
                                : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 font-medium"
                            }`}
                          >
                            <DoorOpen className={`w-4 h-4 ${dBtn.active ? "text-blue-600" : "text-slate-500"}`} />
                            <span className="text-[10px] leading-none">{dBtn.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* HIZLI RENK DAMLALARI (KAPAK & GÖVDE) */}
                    <div className="p-3 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                          <Palette className="w-4 h-4 text-blue-600" />
                          <span>Renk Seçimi</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsSimpleBlumMode(false)}
                          className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                        >
                          ⚙️ Teknik CNC Detayları
                        </button>
                      </div>
                      {/* V7.4 Desenli Malzemede Desen Takibi (Suyolu & Damar Sürekliliği) */}
                      {(() => {
                        const curDoorMat =
                          [...DEFAULT_MATERIALS, ...(project.customMaterials || [])].find(
                            (m) => m.id === activeModule.carcass.doorMaterialId
                          ) || DEFAULT_MATERIALS[0];
                        const curGrainMode = project.facadeGrainContinuity
                          ? "facade_continuous"
                          : activeModule.carcass.grainContinuityMode || "none";
                        return (
                          <div className="p-2 rounded-2xl bg-amber-50/55 border border-amber-200/80 space-y-1.5 mb-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[10.5px] font-extrabold text-amber-950">
                                🪵 Desen Takibi ({isPatternedMaterial(curDoorMat) ? "Desenli Yüzey Aktif" : "Düz Yüzey"})
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-1">
                              {GRAIN_CONTINUITY_CATALOG.map((gc) => {
                                const isAct = curGrainMode === gc.id;
                                return (
                                  <button
                                    key={gc.id}
                                    type="button"
                                    title={gc.description}
                                    onClick={() => {
                                      if (gc.id === "facade_continuous") {
                                        setFacadeGrainContinuity(true);
                                      } else {
                                        setFacadeGrainContinuity(false);
                                        updateCarcassConfig({ grainContinuityMode: gc.id });
                                      }
                                    }}
                                    className={`px-2 py-1 rounded-xl border text-left text-[10px] font-bold transition cursor-pointer ${
                                      isAct
                                        ? "bg-amber-900 text-white border-amber-950"
                                        : "bg-white/85 hover:bg-white text-stone-800 border-amber-200"
                                    }`}
                                  >
                                    {gc.shortLabel}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}

                      <div className="flex items-center gap-2 flex-wrap">
                        {DEFAULT_MATERIALS.filter((m) => m.id !== "mat_led_warm_3000k")
                          .slice(0, 8)
                          .map((mat) => {
                            const isDoorActive = activeModule.carcass.doorMaterialId === mat.id;
                            return (
                              <button
                                key={mat.id}
                                type="button"
                                onClick={() =>
                                  setMaterials(activeModule.carcass.bodyMaterialId, mat.id)
                                }
                                title={`${mat.name} — Tıkla: Kapak Rengi Yap`}
                                data-material-swatch="true" style={getMaterialSwatchStyle(mat)}
                                className={`w-7 h-7 rounded-full border transition cursor-pointer ${
                                  isDoorActive
                                    ? "ring-2 ring-blue-600 ring-offset-2 border-white scale-110"
                                    : "border-slate-300 hover:scale-105"
                                }`}
                              />
                            );
                          })}
                      </div>
                    </div>
                  </>
                )}
              </div>
              )}
              {/* Smart Mechanism-Aware Door & Drawer Motion Simulation Card (Fixes image_c01e8a.png!) */}
              {(studioInspectorTab === "door" ||
                studioInspectorTab === "interior" ||
                doorOpenAngleDeg > 0 ||
                drawerOpenMm > 0) &&
                (() => {
                  const hasDoorsOnMod =
                    !activeModule.isOpenFront &&
                    activeModule.bays.some(
                      (b) => b.door && b.door.type !== "open" && b.door.doorSystemId !== "open"
                    );
                  const isSlidingMod = activeModule.bays.some(
                    (b) =>
                      b.door?.type === "sliding" ||
                      b.door?.type === "sliding_bottom" ||
                      Boolean(b.door?.doorSystemId?.startsWith("sliding"))
                  );
                  const isLiftMod = activeModule.bays.some((b) =>
                    Boolean(b.door?.doorSystemId?.startsWith("lift"))
                  );
                  const has155ZeroHinge =
                    activeModule.carcass.internalDrawerHingeSolution === "zero_protrusion_155deg" ||
                    activeModule.bays.some((b) => b.door?.hardwareProductId?.includes("155"));
                  const maxDoorDeg = isSlidingMod || isLiftMod ? 90 : has155ZeroHinge ? 155 : 110;
                  const allDrawers = activeModule.bays.flatMap((b) => b.drawers || []);
                  const hasDrawersOnMod = allDrawers.length > 0;
                  const maxRunnerMm = hasDrawersOnMod
                    ? Math.max(
                        270,
                        ...allDrawers.map((d) =>
                          Math.min(550, d.nominalLengthMm || Math.max(300, activeModule.dimensions.depth - 80))
                        )
                      )
                    : 400;
                  const hasCoveredDrawers = activeModule.bays.some(
                    (b) =>
                      (b.drawers?.length || 0) > 0 &&
                      !activeModule.isOpenFront &&
                      b.door &&
                      b.door.type !== "open" &&
                      b.door.doorSystemId !== "open" &&
                      b.drawers.some((d) => d.isInternal || b.door.type === "sliding" || (activeModule.dimensions.height > 1200 && !b.door.doorSystemId?.startsWith("lift")))
                  );
                  const anyOpenNow = doorOpenAngleDeg > 0 || drawerOpenMm > 0;
                  const doorReadout = !hasDoorsOnMod
                    ? "Kapaksız"
                    : isSlidingMod || isLiftMod
                    ? `%${Math.min(100, Math.round((doorOpenAngleDeg / 90) * 100))}`
                    : `${doorOpenAngleDeg}°`;
                  const drawerPct = Math.min(100, Math.round((drawerOpenMm / maxRunnerMm) * 100));

                  const quickActionLabel = anyOpenNow
                    ? "Tümünü Kapat"
                    : !hasDoorsOnMod && hasDrawersOnMod
                    ? "Çekmeceleri Aç"
                    : isSlidingMod
                    ? "Sürgüyü Aç (%100)"
                    : isLiftMod
                    ? "Kapağı Kaldır"
                    : "Kapakları Aç (90°)";

                  return (
                    <div className="p-3.5 rounded-[24px] birim-ice-card space-y-2.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-[#141413] flex items-center gap-1.5">
                          <DoorOpen className="w-4 h-4 text-[#57534E]" />
                          <span>Açılım Simülasyonu</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (anyOpenNow) {
                              setDoorOpenAngleDeg(0);
                              setDrawerOpenMm(0);
                            } else if (!hasDoorsOnMod && hasDrawersOnMod) {
                              setDrawerOpenMm(Math.round(maxRunnerMm * 0.8));
                            } else {
                              setDoorOpenAngleDeg(90);
                            }
                          }}
                          className={`px-3 py-1 rounded-full text-[11px] font-bold transition cursor-pointer ${
                            anyOpenNow
                              ? "birim-ice-charcoal-pill"
                              : "birim-ice-btn text-[#141413]"
                          }`}
                        >
                          {quickActionLabel}
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-0.5">
                        <div className={!hasDoorsOnMod ? "opacity-45" : ""}>
                          <div className="flex justify-between text-[11px] text-[#57534E] mb-1">
                            <span>
                              {isSlidingMod
                                ? "Sürgü Açılımı"
                                : isLiftMod
                                ? "Kalkar Açılım"
                                : "Kapak Açılma Açısı"}
                            </span>
                            <span className="font-mono font-bold text-[#141413]">{doorReadout}</span>
                          </div>
                          <input
                            type="range"
                            disabled={!hasDoorsOnMod}
                            min={0}
                            max={maxDoorDeg}
                            step={5}
                            value={Math.min(maxDoorDeg, doorOpenAngleDeg)}
                            onChange={(e) => {
                              const nextDeg = Number(e.target.value);
                              setDoorOpenAngleDeg(nextDeg);
                              // Physical interlock: closing a door in front of internal/covered drawers retracts the drawers first!
                              if (hasCoveredDrawers && nextDeg < 80 && drawerOpenMm > 0) {
                                setDrawerOpenMm(0);
                              }
                            }}
                            className="w-full accent-[#141413] h-1.5 bg-black/15 rounded-lg cursor-pointer disabled:cursor-not-allowed"
                          />
                        </div>

                        <div className={!hasDrawersOnMod ? "opacity-45" : ""}>
                          <div className="flex justify-between text-[11px] text-[#57534E] mb-1">
                            <span>Çekmece Açılımı</span>
                            <span className="font-mono font-bold text-[#141413]">
                              {hasDrawersOnMod ? `%${drawerPct} (${drawerOpenMm} mm)` : "Yok"}
                            </span>
                          </div>
                          <input
                            type="range"
                            disabled={!hasDrawersOnMod}
                            min={0}
                            max={maxRunnerMm}
                            step={10}
                            value={hasDrawersOnMod ? Math.min(maxRunnerMm, drawerOpenMm) : 0}
                            onChange={(e) => {
                              const nextMm = Number(e.target.value);
                              // Physical interlock: pulling a covered drawer automatically opens closed doors so it never ghosts through!
                              if (hasCoveredDrawers && nextMm > 0 && doorOpenAngleDeg < 90) {
                                setDoorOpenAngleDeg(has155ZeroHinge ? 120 : 95);
                              }
                              setDrawerOpenMm(nextMm);
                            }}
                            className="w-full accent-[#141413] h-1.5 bg-black/15 rounded-lg cursor-pointer disabled:cursor-not-allowed"
                          />
                        </div>
                      </div>

                      <div className="pt-2 border-t border-black/8 flex items-center justify-between gap-2">
                        <span className="text-[11px] font-medium text-[#57534E]">
                          👔 İç Giysi, Kutu &amp; Ayakkabı Objeleri
                        </span>
                        <button
                          type="button"
                          data-testid="inspector-toggle-interior-props-btn"
                          onClick={() => {
                            if (typeof window !== "undefined") {
                              window.dispatchEvent(new CustomEvent("birim:toggle-interior-props"));
                            }
                          }}
                          data-tooltip="İç Eşyaları (Giysi, Kutu, Ayakkabı) Göster / Gizle"
                          className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold transition cursor-pointer ${
                            interiorPropsVisible
                              ? "birim-ice-charcoal-pill"
                              : "birim-ice-btn text-[#44403C]"
                          }`}
                        >
                          {interiorPropsVisible ? "✓ Görünür" : "Gizli"}
                        </button>
                      </div>
                    </div>
                  );
                })()}

                            {/* Contextual Selected Part Banner (Shown whenever a single door, shelf, divider, or countertop is clicked in 3D/2D) */}
              {selectedComponentId && (() => {
                const matchedPart = activeBreakdown.components.find((c) => c.id === selectedComponentId);
                let matchedDrawer: (typeof activeModule.bays)[0]["drawers"][0] | null = null;
                let matchedDrawerBayIdx = -1;

                for (let bIdx = 0; bIdx < activeModule.bays.length; bIdx++) {
                  const bay = activeModule.bays[bIdx];
                  const drw = bay.drawers.find(
                    (d) => selectedComponentId === d.id || selectedComponentId.startsWith(`${d.id}_`)
                  );
                  if (drw) {
                    matchedDrawer = drw;
                    matchedDrawerBayIdx = bIdx;
                    break;
                  }
                }

                return (
                <div
                  data-testid="studio-selected-component-card"
                  className="p-3.5 rounded-2xl bg-blue-50/70 border-2 border-blue-500 space-y-2.5 text-xs shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-extrabold text-blue-950 text-sm">
                        🎯 {matchedPart ? matchedPart.label : "Seçili Parça"}
                      </div>
                      <div className="text-[11px] font-medium text-blue-700 truncate mt-0.5">
                        {matchedPart
                          ? `Ölçü: ${matchedPart.dimensions.width} × ${matchedPart.dimensions.height} × ${matchedPart.dimensions.depth} mm`
                          : selectedComponentId}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        data-testid="studio-delete-selected-component-btn"
                        onClick={() => {
                          removeSelectedInteriorComponent();
                        }}
                        className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-semibold flex items-center gap-1 shrink-0 cursor-pointer"
                        title="Seçili iç parçayı sil"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Sil</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedComponentId(null)}
                        title="Seçili parça kartını kapat"
                        className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 font-bold text-xs cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {matchedDrawer && (
                    <div className="pt-2 border-t border-blue-200/80 space-y-2">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-semibold text-blue-950">
                          <span>Çekmece Kapak Yüksekliği (H):</span>
                          <span className="font-mono text-blue-700 font-bold">{matchedDrawer.height} mm</span>
                        </div>
                        <div className="grid grid-cols-4 gap-1">
                          {[140, 180, 240, 300].map((presetH) => (
                            <button
                              key={presetH}
                              type="button"
                              data-testid={`studio-selected-drawer-preset-${presetH}`}
                              onClick={() =>
                                setDrawerPlacement(
                                  matchedDrawerBayIdx,
                                  matchedDrawer!.id,
                                  undefined,
                                  presetH
                                )
                              }
                              className={`py-1 rounded-lg font-mono text-xs font-bold transition cursor-pointer ${
                                matchedDrawer!.height === presetH
                                  ? "bg-blue-600 text-white shadow-xs"
                                  : "bg-white hover:bg-blue-100/70 border border-blue-200 text-blue-900"
                              }`}
                            >
                              {presetH}mm
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5">
                        <div className="flex items-center justify-between bg-white px-2 py-1 rounded-lg border border-blue-200">
                          <span className="text-xs font-semibold text-stone-600">
                            Yükseklik (H):
                          </span>
                          <input
                            type="number"
                            data-testid="studio-selected-drawer-height-input"
                            min={100}
                            max={420}
                            step={10}
                            value={matchedDrawer.height}
                            onChange={(e) =>
                              setDrawerPlacement(
                                matchedDrawerBayIdx,
                                matchedDrawer!.id,
                                undefined,
                                Number(e.target.value)
                              )
                            }
                            className="w-14 font-mono text-xs font-bold text-stone-900 text-right bg-transparent outline-none focus:ring-1 focus:ring-blue-500 rounded px-1"
                          />
                          <span className="text-xs text-stone-400">mm</span>
                        </div>

                        <div className="flex items-center justify-between bg-white px-2 py-1 rounded-lg border border-blue-200">
                          <span className="text-xs font-semibold text-stone-600">
                            Yerden (Y):
                          </span>
                          <input
                            type="number"
                            data-testid="studio-selected-drawer-elev-input"
                            min={0}
                            max={Math.max(0, netInnerHeightMm - matchedDrawer.height)}
                            step={10}
                            value={matchedDrawer.elevationY}
                            onChange={(e) =>
                              setDrawerPlacement(
                                matchedDrawerBayIdx,
                                matchedDrawer!.id,
                                Number(e.target.value),
                                undefined
                              )
                            }
                            className="w-14 font-mono text-xs font-bold text-stone-900 text-right bg-transparent outline-none focus:ring-1 focus:ring-blue-500 rounded px-1"
                          />
                          <span className="text-xs text-stone-400">mm</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2 pt-1.5 border-t border-blue-200/80">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-blue-950">Malzeme Uygulama Kapsamı</span>
                      {activeModule.componentMaterialOverrides?.[selectedComponentId] && (
                        <button
                          type="button"
                          onClick={() =>
                            applyMaterialToSimilarComponents(
                              activeModule.componentMaterialOverrides?.[selectedComponentId] || null,
                              selectedComponentId,
                              "project_similar"
                            )
                          }
                          className="px-2 py-0.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold cursor-pointer"
                          title="Bu parçadaki malzemeyi sahnedeki tüm benzer elemanlara uygula"
                        >
                          ⚡ Tüm Benzerlere Yay
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-white/80 border border-blue-200">
                      {[
                        { id: "single" as const, lbl: "Sadece Bu Parça" },
                        { id: "module_similar" as const, lbl: "Modüldeki Benzerler" },
                        { id: "project_similar" as const, lbl: "Tüm Dolaplarda" },
                      ].map((sc) => (
                        <button
                          key={sc.id}
                          type="button"
                          data-testid={`selected-part-mat-scope-${sc.id}`}
                          onClick={() => setSelectedPartMatScope(sc.id)}
                          className={`py-1.5 px-1.5 rounded-lg text-[10.5px] font-bold transition cursor-pointer ${
                            selectedPartMatScope === sc.id
                              ? "bg-[#141413] text-white shadow-2xs"
                              : "text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          {sc.lbl}
                        </button>
                      ))}
                    </div>
                    <V3PremiumDropdown
                      label={
                        selectedPartMatScope === "project_similar"
                          ? "Tüm Projedeki Benzer Elemanların Malzemesi"
                          : selectedPartMatScope === "module_similar"
                          ? "Bu Modüldeki Benzer Elemanların Malzemesi"
                          : "Seçili Parçanın Malzemesi"
                      }
                      testId="studio-selected-component-material-dropdown"
                      value={
                        activeModule.componentMaterialOverrides?.[selectedComponentId] ||
                        matchedPart?.materialId ||
                        ""
                      }
                      placeholder="Malzeme Seçin"
                      options={[
                        {
                          value: "",
                          label: "Özel Atamayı Sıfırla (Varsayılan)",
                          subLabel: "Genel kapak/gövde malzemesini miras alır",
                        },
                        ...DEFAULT_MATERIALS.filter((m) => m.id !== "mat_led_warm_3000k").map(
                          (m) => ({
                            value: m.id,
                            label: m.decorCode ? `${m.name} [${m.decorCode}]` : m.name,
                            subLabel: m.brand ? `${m.brand} • ${m.category}` : m.category,
                            badge: `€${m.costPerM2}/m²`,
                          })
                        ),
                      ]}
                      onChange={(val) =>
                        applyMaterialToSimilarComponents(
                          val || null,
                          selectedComponentId,
                          selectedPartMatScope
                        )
                      }
                    />
                  </div>
                </div>
                );
              })()}

              {/* DETAILED TECHNICAL TABS (Rendered only when Detailed Mode is active) */}
              {!isSimpleBlumMode && (
                <>
              {/* TAB 1: ÖLÇÜLER (Matches Design Studio Reference Image 1-to-1) */}
              {studioInspectorTab === "dimensions" && (() => {
                const activeDoorMat =
                  DEFAULT_MATERIALS.find((m) => m.id === activeModule.carcass.doorMaterialId) ||
                  DEFAULT_MATERIALS[2];
                const activePlinthMatId =
                  activeModule.componentMaterialOverrides?.__plinth__ || "mat_lacquer_sage";
                const activePlinthMat =
                  DEFAULT_MATERIALS.find((m) => m.id === activePlinthMatId) ||
                  DEFAULT_MATERIALS.find((m) => m.id === "mat_lacquer_sage") ||
                  DEFAULT_MATERIALS[5];
                const activeHandleCat = activeBay?.door?.handleCategory || "bar_handle";
                const handleDisplay =
                  activeHandleCat === "bar_handle"
                    ? { code: "K019", sub: "Mat Siyah" }
                    : activeHandleCat === "knob"
                    ? { code: "D008", sub: "Antik Bronz Düğme" }
                    : activeHandleCat === "long_profile_handle"
                    ? { code: "L100", sub: "100cm Boy Profil" }
                    : activeHandleCat === "gola_profile"
                    ? { code: "GOLA-L", sub: "Alüminyum Gola Kanal" }
                    : activeHandleCat === "j_pull"
                    ? { code: "J-PULL", sub: "45° Kendinden Kulplu" }
                    : { code: "TIP-ON", sub: "Kulpsuz Bas-Aç" };

                return (
                  <div className="space-y-4">
                    {/* 3-Column Dimension Inputs: Genişlik | Yükseklik | Derinlik */}
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        {
                          label: "Genişlik",
                          val: width,
                          min: 300,
                          max: 3600,
                          step: 50,
                          testId: "studio-width-input",
                          onChange: (v: number) => setDimensions(v, height, depth),
                        },
                        {
                          label: "Yükseklik",
                          val: height,
                          min: 400,
                          max: 2800,
                          step: 50,
                          testId: "studio-height-input",
                          onChange: (v: number) => setDimensions(width, v, depth),
                        },
                        {
                          label: "Derinlik",
                          val: depth,
                          min: 250,
                          max: 900,
                          step: 50,
                          testId: "studio-depth-input",
                          onChange: (v: number) => setDimensions(width, height, v),
                        },
                      ].map((dim) => (
                        <div key={dim.label} className="space-y-1">
                          <label className="text-[13px] font-medium text-[#57534E] block">
                            {dim.label}
                          </label>
                          <div className="flex items-center justify-between bg-white rounded-xl border border-[#CBD5E1] px-2.5 py-2 shadow-2xs">
                            <input
                              type="number"
                              data-testid={dim.testId}
                              min={dim.min}
                              max={dim.max}
                              step={dim.step}
                              value={dim.val}
                              onChange={(e) => {
                                const n = Number(e.target.value);
                                if (!Number.isNaN(n)) dim.onChange(n);
                              }}
                              className="w-11 text-xs font-bold text-[#1C1917] bg-transparent focus:outline-none"
                            />
                            <span className="text-xs text-[#78716C] mr-1">mm</span>
                            <div className="flex flex-col text-xs leading-none text-[#78716C]">
                              <button
                                type="button"
                                onClick={() => dim.onChange(Math.min(dim.max, dim.val + dim.step))}
                                className="hover:text-[#1C1917] cursor-pointer"
                              >
                                ▲
                              </button>
                              <button
                                type="button"
                                onClick={() => dim.onChange(Math.max(dim.min, dim.val - dim.step))}
                                className="hover:text-[#1C1917] cursor-pointer"
                              >
                                ▼
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Soket Yüksekliği + Ayarlı Ayak Toggle */}
                    <div className="space-y-1">
                      <label className="text-[13px] font-medium text-[#57534E] block">
                        Soket Yüksekliği
                      </label>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 flex items-center justify-between bg-white rounded-xl border border-[#CBD5E1] px-3 py-2 shadow-2xs">
                          <input
                            type="number"
                            min={0}
                            max={200}
                            step={10}
                            value={activeModule.carcass.plinthHeight ?? 100}
                            onChange={(e) =>
                              setPlinthHeight(Math.max(0, Math.min(200, Number(e.target.value) || 0)))
                            }
                            className="w-14 text-xs font-bold text-[#1C1917] bg-transparent focus:outline-none"
                          />
                          <span className="text-[13px] text-[#78716C] mr-auto">mm</span>
                          <div className="flex flex-col text-xs leading-none text-[#78716C]">
                            <button
                              type="button"
                              onClick={() =>
                                setPlinthHeight(
                                  Math.min(200, (activeModule.carcass.plinthHeight ?? 100) + 10)
                                )
                              }
                              className="hover:text-[#1C1917] cursor-pointer"
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setPlinthHeight(
                                  Math.max(0, (activeModule.carcass.plinthHeight ?? 100) - 10)
                                )
                              }
                              className="hover:text-[#1C1917] cursor-pointer"
                            >
                              ▼
                            </button>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const next = !(activeModule.carcass.hasAdjustableLegs ?? adjustableLegsEnabled);
                            setAdjustableLegsEnabled(next);
                            setModuleAdjustableLegs(next);
                          }}
                          className="flex items-center gap-2 shrink-0 cursor-pointer"
                        >
                          <div
                            className={`w-9 h-5 rounded-full p-0.5 transition flex items-center ${
                              (activeModule.carcass.hasAdjustableLegs ?? adjustableLegsEnabled)
                                ? "bg-[#94A3B8] justify-end"
                                : "bg-[#D6D1C7] justify-start"
                            }`}
                          >
                            <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
                          </div>
                          <span className="text-xs font-medium text-[#1C1917]">Ayarlı Ayak</span>
                        </button>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#EEF3F8] border border-[#CBD5E1] text-[13px] text-[#111827] flex items-center justify-between gap-2">
                      <span>💡 <b>İpucu:</b> 3D sahnedeki <b>{width} mm</b> gibi ölçü etiketlerine doğrudan tıklayarak da yeni değer girebilirsiniz.</span>
                    </div>

                    <div className="h-px bg-[#E2E8F0]" />

                    {/* Gövde Levha Malzemesi */}
                    <V3PremiumDropdown
                      label="Gövde İç & Yan Panel Malzemesi (18mm)"
                      value={activeModule.carcass.bodyMaterialId}
                      options={DEFAULT_MATERIALS.filter(
                        (m) =>
                          m.category === "laminate" ||
                          m.category === "wood" ||
                          m.category === "lacquer"
                      ).map((m) => ({
                        value: m.id,
                        label: m.decorCode ? `${m.name} [${m.decorCode}]` : m.name,
                        subLabel: m.brand ? `${m.brand} • ${m.category}` : m.category,
                        badge: `${m.costPerM2} ₺/m²`,
                      }))}
                      onChange={(val) => setMaterials(val, undefined)}
                    />
                  </div>
                );
              })()}

              {/* TAB: GÖVDE (4 Ana Grup: Ana Ölçüler | Gövde Yapısı | Kaide / Ayak | Malzeme) */}
              {studioInspectorTab === "carcass" && (() => {
                const activeTpl = activeModule.templateId
                  ? v4ModuleTemplates.find((t) => t.templateId === activeModule.templateId)
                  : undefined;
                const minW = activeTpl?.dimensionLimits?.minW ?? 200;
                const maxW = activeTpl?.dimensionLimits?.maxW ?? 3600;
                const minH = activeTpl?.dimensionLimits?.minH ?? 300;
                const maxH = activeTpl?.dimensionLimits?.maxH ?? 2800;
                const minD = activeTpl?.dimensionLimits?.minD ?? 200;
                const maxD = activeTpl?.dimensionLimits?.maxD ?? 950;

                const T = activeModule.carcass.panelThickness || 18;
                const T_back = activeModule.carcass.backPanelThickness || 8;
                const plinthH = activeModule.carcass.plinthHeight ?? 100;
                const hasLegs = activeModule.carcass.hasAdjustableLegs !== false;
                const edgeBandMm = activeModule.carcass.edgeBandThickness || 1;
                const backType = activeModule.carcass.backPanelType || "grooved";
                const jointType = activeModule.carcass.jointType || "minifix_dowel";

                const findPanel = (suffix: string) =>
                  activeBreakdown.components.find((c) => c.id === `${activeModule.id}_${suffix}`);
                const sideLeftPanel = findPanel("side_left");
                const sideRightPanel = findPanel("side_right");
                const topPanel = findPanel("top");
                const bottomPanel = findPanel("bottom");
                const backPanel = findPanel("back");

                const structuralPanels = [
                  {
                    key: "side_left",
                    id: `${activeModule.id}_side_left`,
                    label: "Sol yan panel",
                    dims: sideLeftPanel
                      ? `${sideLeftPanel.dimensions.depth} × ${sideLeftPanel.dimensions.height} × ${T} mm`
                      : `${depth} × ${height} × ${T} mm`,
                  },
                  {
                    key: "side_right",
                    id: `${activeModule.id}_side_right`,
                    label: "Sağ yan panel",
                    dims: sideRightPanel
                      ? `${sideRightPanel.dimensions.depth} × ${sideRightPanel.dimensions.height} × ${T} mm`
                      : `${depth} × ${height} × ${T} mm`,
                  },
                  {
                    key: "top",
                    id: `${activeModule.id}_top`,
                    label: "Üst panel",
                    dims: topPanel
                      ? `${topPanel.dimensions.width} × ${topPanel.dimensions.depth} × ${T} mm`
                      : `${Math.max(100, width - 2 * T)} × ${depth} × ${T} mm`,
                  },
                  {
                    key: "bottom",
                    id: `${activeModule.id}_bottom`,
                    label: "Alt panel",
                    dims: bottomPanel
                      ? `${bottomPanel.dimensions.width} × ${bottomPanel.dimensions.depth} × ${T} mm`
                      : `${Math.max(100, width - 2 * T)} × ${depth} × ${T} mm`,
                  },
                  {
                    key: "back",
                    id: `${activeModule.id}_back`,
                    label: "Arkalık",
                    dims: backPanel
                      ? `${backPanel.dimensions.width} × ${backPanel.dimensions.height} × ${T_back} mm`
                      : `${Math.max(100, width - 2 * T + 16)} × ${Math.max(200, height - plinthH - 2 * T + 16)} × ${T_back} mm`,
                  },
                ];

                const bodyMatDef =
                  DEFAULT_MATERIALS.find((m) => m.id === activeModule.carcass.bodyMaterialId) ||
                  DEFAULT_MATERIALS[0];
                const backMatId =
                  activeModule.componentMaterialOverrides?.[`${activeModule.id}_back`] ||
                  activeModule.carcass.bodyMaterialId;
                const innerSurfaceMatId =
                  activeModule.componentMaterialOverrides?.[`${activeModule.id}_top`] ||
                  activeModule.carcass.bodyMaterialId;
                const plinthMatId =
                  activeModule.carcass.plinthMaterialId ||
                  activeModule.componentMaterialOverrides?.__plinth__ ||
                  activeModule.carcass.bodyMaterialId;

                const carcassMaterialsList = DEFAULT_MATERIALS.filter(
                  (m) =>
                    m.category === "laminate" ||
                    m.category === "wood" ||
                    m.category === "lacquer" ||
                    m.category === "compact"
                );

                return (
                  <div data-testid="studio-carcass-tab-content" className="space-y-4 text-xs">
                    {/* GRUP 1: ANA ÖLÇÜLER */}
                    <section
                      data-testid="carcass-group-dimensions"
                      className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-[#111827]">1. Ana Ölçüler</h3>
                        <span className="text-xs font-mono text-[#475569]">
                          3D Sahne ile Senkron
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        {/* Genişlik */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="text-[13px] font-semibold text-[#111827]">
                              Genişlik
                            </label>
                            <span className="text-xs font-mono text-[#64748B]">
                              {minW}–{maxW} mm
                            </span>
                          </div>
                          <div className="flex items-center justify-between bg-white rounded-xl border border-[#CBD5E1] px-2.5 py-1.5">
                            <input
                              type="number"
                              data-testid="carcass-width-input"
                              disabled={Boolean(activeModule.isFixedWidth)}
                              min={minW}
                              max={maxW}
                              step={50}
                              value={width}
                              onChange={(e) => {
                                const v = Number(e.target.value);
                                if (!Number.isNaN(v) && v >= minW && v <= maxW) {
                                  setDimensions(v, height, depth);
                                }
                              }}
                              className="w-16 font-mono text-xs font-bold text-[#111827] bg-transparent focus:outline-none disabled:opacity-50"
                            />
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-[#64748B]">mm</span>
                              <button
                                type="button"
                                disabled={Boolean(activeModule.isFixedWidth) || width - 50 < minW}
                                onClick={() => setDimensions(Math.max(minW, width - 50), height, depth)}
                                className="px-1 rounded bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#111827] font-bold cursor-pointer disabled:opacity-40"
                              >
                                −
                              </button>
                              <button
                                type="button"
                                disabled={Boolean(activeModule.isFixedWidth) || width + 50 > maxW}
                                onClick={() => setDimensions(Math.min(maxW, width + 50), height, depth)}
                                className="px-1 rounded bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#111827] font-bold cursor-pointer disabled:opacity-40"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Yükseklik */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="text-[13px] font-semibold text-[#111827]">
                              Yükseklik
                            </label>
                            <span className="text-xs font-mono text-[#64748B]">
                              {minH}–{maxH} mm
                            </span>
                          </div>
                          <div className="flex items-center justify-between bg-white rounded-xl border border-[#CBD5E1] px-2.5 py-1.5">
                            <input
                              type="number"
                              data-testid="carcass-height-input"
                              min={minH}
                              max={maxH}
                              step={50}
                              value={height}
                              onChange={(e) => {
                                const v = Number(e.target.value);
                                if (!Number.isNaN(v) && v >= minH && v <= maxH) {
                                  setDimensions(width, v, depth);
                                }
                              }}
                              className="w-16 font-mono text-xs font-bold text-[#111827] bg-transparent focus:outline-none"
                            />
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-[#64748B]">mm</span>
                              <button
                                type="button"
                                disabled={height - 50 < minH}
                                onClick={() => setDimensions(width, Math.max(minH, height - 50), depth)}
                                className="px-1 rounded bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#111827] font-bold cursor-pointer disabled:opacity-40"
                              >
                                −
                              </button>
                              <button
                                type="button"
                                disabled={height + 50 > maxH}
                                onClick={() => setDimensions(width, Math.min(maxH, height + 50), depth)}
                                className="px-1 rounded bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#111827] font-bold cursor-pointer disabled:opacity-40"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Derinlik */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="text-[13px] font-semibold text-[#111827]">
                              Derinlik
                            </label>
                            <span className="text-xs font-mono text-[#64748B]">
                              {minD}–{maxD} mm
                            </span>
                          </div>
                          <div className="flex items-center justify-between bg-white rounded-xl border border-[#CBD5E1] px-2.5 py-1.5">
                            <input
                              type="number"
                              data-testid="carcass-depth-input"
                              min={minD}
                              max={maxD}
                              step={50}
                              value={depth}
                              onChange={(e) => {
                                const v = Number(e.target.value);
                                if (!Number.isNaN(v) && v >= minD && v <= maxD) {
                                  setDimensions(width, height, v);
                                }
                              }}
                              className="w-16 font-mono text-xs font-bold text-[#111827] bg-transparent focus:outline-none"
                            />
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-[#64748B]">mm</span>
                              <button
                                type="button"
                                disabled={depth - 50 < minD}
                                onClick={() => setDimensions(width, height, Math.max(minD, depth - 50))}
                                className="px-1 rounded bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#111827] font-bold cursor-pointer disabled:opacity-40"
                              >
                                −
                              </button>
                              <button
                                type="button"
                                disabled={depth + 50 > maxD}
                                onClick={() => setDimensions(width, height, Math.min(maxD, depth + 50))}
                                className="px-1 rounded bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#111827] font-bold cursor-pointer disabled:opacity-40"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Soket / Kaide Yüksekliği */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="text-[13px] font-semibold text-[#111827]">
                              Soket / Kaide
                            </label>
                            <span className="text-xs font-mono text-[#64748B]">
                              0–200 mm
                            </span>
                          </div>
                          <div className="flex items-center justify-between bg-white rounded-xl border border-[#CBD5E1] px-2.5 py-1.5">
                            <input
                              type="number"
                              data-testid="carcass-plinth-input"
                              min={0}
                              max={200}
                              step={10}
                              value={plinthH}
                              onChange={(e) => {
                                const v = Number(e.target.value);
                                if (!Number.isNaN(v) && v >= 0 && v <= 200) {
                                  setPlinthHeight(v);
                                }
                              }}
                              className="w-16 font-mono text-xs font-bold text-[#111827] bg-transparent focus:outline-none"
                            />
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-[#64748B]">mm</span>
                              <button
                                type="button"
                                disabled={plinthH - 10 < 0}
                                onClick={() => setPlinthHeight(Math.max(0, plinthH - 10))}
                                className="px-1 rounded bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#111827] font-bold cursor-pointer disabled:opacity-40"
                              >
                                −
                              </button>
                              <button
                                type="button"
                                disabled={plinthH + 10 > 200}
                                onClick={() => setPlinthHeight(Math.min(200, plinthH + 10))}
                                className="px-1 rounded bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#111827] font-bold cursor-pointer disabled:opacity-40"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </section>

                    {/* GRUP 2: GÖVDE YAPISI (Sol yan, Sağ yan, Üst, Alt, Arkalık, Panel Kalınlıkları) */}
                    <section
                      data-testid="carcass-group-structure"
                      className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-[#111827]">2. Gövde Yapısı</h3>
                        <span className="text-xs text-[#475569]">
                          3D Sahnede Vurgulamak İçin Tıklayın
                        </span>
                      </div>

                      {/* 5 Structural Panels List (Sol yan, Sağ yan, Üst, Alt, Arkalık) */}
                      <div className="space-y-1.5">
                        {structuralPanels.map((p) => {
                          const isSelPanel = selectedComponentId === p.id;
                          const hasCustomMat = Boolean(
                            activeModule.componentMaterialOverrides?.[p.id]
                          );
                          return (
                            <button
                              key={p.id}
                              type="button"
                              data-testid={`carcass-panel-row-${p.key}`}
                              onClick={() =>
                                (setSelectedComponentId as (id: string | null, mIdx?: number) => void)(
                                  isSelPanel ? null : p.id,
                                  activeModuleIndex
                                )
                              }
                              className={`w-full px-3 py-2 rounded-xl border flex items-center justify-between gap-2 text-left transition cursor-pointer ${
                                isSelPanel
                                  ? "bg-[#EEF3F8] border-2 border-[#3B82F6] text-[#111827] shadow-2xs"
                                  : "bg-white hover:bg-[#F1F5F9] border-[#CBD5E1] text-[#111827]"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="w-2 h-2 rounded-full bg-[#3B82F6] shrink-0" />
                                <span className="font-bold text-[13px] truncate">{p.label}</span>
                                {hasCustomMat && (
                                  <span className="px-1.5 py-0.5 rounded bg-[#EEF3F8] border border-[#CBD5E1] text-xs font-semibold">
                                    Özel Yüzey
                                  </span>
                                )}
                              </div>
                              <span className="font-mono text-xs font-semibold text-[#475569] shrink-0">
                                {p.dims}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Panel Kalınlıkları (Gövde & Arkalık) */}
                      <div className="pt-2 border-t border-[#E2E8F0] grid grid-cols-2 gap-2.5">
                        <div className="space-y-1">
                          <label className="text-xs font-bold uppercase tracking-wider text-[#475569] block">
                            Gövde Panel Kalınlığı
                          </label>
                          <div className="grid grid-cols-3 gap-1">
                            {[18, 22, 25].map((tk) => (
                              <button
                                key={tk}
                                type="button"
                                data-testid={`carcass-panel-thickness-${tk}`}
                                onClick={() => updateCarcassConfig({ panelThickness: tk })}
                                className={`py-1.5 rounded-lg font-mono text-[13px] font-bold border transition cursor-pointer ${
                                  T === tk
                                    ? "bg-[#EEF3F8] border-2 border-[#3B82F6] text-[#111827]"
                                    : "bg-white hover:bg-[#F1F5F9] border-[#CBD5E1] text-[#475569]"
                                }`}
                              >
                                {tk} mm
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold uppercase tracking-wider text-[#475569] block">
                            Arkalık Kalınlığı
                          </label>
                          <div className="grid grid-cols-2 gap-1">
                            {[8, 18].map((btk) => (
                              <button
                                key={btk}
                                type="button"
                                data-testid={`carcass-back-thickness-${btk}`}
                                onClick={() => updateCarcassConfig({ backPanelThickness: btk })}
                                className={`py-1.5 rounded-lg font-mono text-[13px] font-bold border transition cursor-pointer ${
                                  T_back === btk
                                    ? "bg-[#EEF3F8] border-2 border-[#3B82F6] text-[#111827]"
                                    : "bg-white hover:bg-[#F1F5F9] border-[#CBD5E1] text-[#475569]"
                                }`}
                              >
                                {btk} mm
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Arkalık Montaj Tipi & Gövde Birleşim Tipi */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-[#475569] block">
                            Arkalık Yuvası
                          </label>
                          <select
                            data-testid="carcass-back-type-select"
                            value={backType}
                            onChange={(e) =>
                              updateCarcassConfig({
                                backPanelType: e.target.value as import("@birim/core").BackPanelType,
                              })
                            }
                            className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-[#CBD5E1] text-[13px] font-semibold text-[#111827]"
                          >
                            <option value="grooved">Kanallı Geçme (Grooved)</option>
                            <option value="rebated">Lambalı (Rebated)</option>
                            <option value="flush">Tam Kapama (Flush)</option>
                            <option value="nailed">Çivili / Vidalı</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-[#475569] block">
                            Gövde Birleşim Tipi
                          </label>
                          <select
                            data-testid="carcass-joint-type-select"
                            value={jointType}
                            onChange={(e) =>
                              updateCarcassConfig({
                                jointType: e.target.value as import("@birim/core").JointType,
                              })
                            }
                            className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-[#CBD5E1] text-[13px] font-semibold text-[#111827]"
                          >
                            <option value="minifix_dowel">Minifix + Kavela</option>
                            <option value="confirmat">Konfirmat Vida</option>
                            <option value="dowel_only">Sadece Kavela</option>
                          </select>
                        </div>
                      </div>
                    </section>

                    {/* GRUP 3: KAİDE / AYAK */}
                    <section
                      data-testid="carcass-group-plinth"
                      className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-[#111827]">3. Kaide / Ayak</h3>
                        <span className="text-xs font-mono text-[#475569]">
                          {plinthH === 0
                            ? "Bazasız (0 mm)"
                            : hasLegs
                            ? `Baza + Ayarlı Ayak (${plinthH} mm)`
                            : `Kapalı Baza (${plinthH} mm)`}
                        </span>
                      </div>

                      {/* 4 World-Standard Plinth Construction Cards in Architect Mode */}
                      <div className="grid grid-cols-2 gap-2 p-0.5">
                        {[
                          {
                            id: "plinth_pedestal_box",
                            title: "Kutu Baza Kasası (Gardırop)",
                            sub: "4 kenar kapalı + ara kayıt + PVC nem fitili",
                            active:
                              plinthH > 0 &&
                              (activeModule.carcass.plinthConstruction ||
                                (activeModule.category === "wardrobe" ||
                                activeModule.category === "vestiyer" ||
                                activeModule.category === "living" ||
                                activeModule.category === "tall"
                                  ? "pedestal_box"
                                  : "adjustable_legs_clip")) === "pedestal_box",
                            onSelect: () => {
                              const nextH = plinthH > 0 ? plinthH : 80;
                              updateCarcassConfig({
                                plinthHeight: nextH,
                                plinthConstruction: "pedestal_box",
                                plinthSetbackMm: 35,
                                hasAdjustableLegs: true,
                              });
                              setAdjustableLegsEnabled(true);
                            },
                          },
                          {
                            id: "plinth_with_legs",
                            title: "Klipsli Ayaklı Baza (DIN 68935)",
                            sub: "Häfele Axilo 78 ayak + C-klips + su contası",
                            active:
                              plinthH > 0 &&
                              (activeModule.carcass.plinthConstruction ||
                                (activeModule.category === "wardrobe" ||
                                activeModule.category === "vestiyer" ||
                                activeModule.category === "living" ||
                                activeModule.category === "tall"
                                  ? "pedestal_box"
                                  : "adjustable_legs_clip")) === "adjustable_legs_clip",
                            onSelect: () => {
                              const nextH = plinthH > 0 ? plinthH : 100;
                              updateCarcassConfig({
                                plinthHeight: nextH,
                                plinthConstruction: "adjustable_legs_clip",
                                plinthSetbackMm: 55,
                                hasAdjustableLegs: true,
                              });
                              setAdjustableLegsEnabled(true);
                            },
                          },
                          {
                            id: "plinth_closed_only",
                            title: "Yan Dikme İnişli Kayıtlı",
                            sub: "Zemine inen yanlar + ön/arka çift kayıt",
                            active:
                              plinthH > 0 &&
                              activeModule.carcass.plinthConstruction === "gable_rails",
                            onSelect: () => {
                              const nextH = plinthH > 0 ? plinthH : 80;
                              updateCarcassConfig({
                                plinthHeight: nextH,
                                plinthConstruction: "gable_rails",
                                plinthSetbackMm: 26,
                                hasAdjustableLegs: false,
                              });
                              setAdjustableLegsEnabled(false);
                            },
                          },
                          {
                            id: "plinth_none",
                            title: "Bazasız (0 mm)",
                            sub: "Zemine sıfır veya duvara asma",
                            active: plinthH === 0,
                            onSelect: () => {
                              setPlinthHeight(0);
                              setAdjustableLegsEnabled(false);
                              setModuleAdjustableLegs(false);
                            },
                          },
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            data-testid={`carcass-plinth-card-${opt.id}`}
                            onClick={opt.onSelect}
                            className={`p-2.5 rounded-xl border flex flex-col items-start text-left justify-between gap-1 transition cursor-pointer ${
                              opt.active
                                ? "bg-[#EEF3F8] border-2 border-[#3B82F6] text-[#111827] shadow-2xs"
                                : "bg-white hover:bg-[#F1F5F9] border-[#CBD5E1] text-[#475569]"
                            }`}
                          >
                            <span className="text-[13px] font-bold text-[#111827] leading-tight">
                              {opt.title}
                            </span>
                            <span className="text-xs text-[#64748B] leading-tight">
                              {opt.sub}
                            </span>
                          </button>
                        ))}
                      </div>

                      {/* Conditional Sub-Parameters when Plinth > 0 */}
                      {plinthH > 0 ? (
                        <div className="pt-2 border-t border-[#E2E8F0] space-y-2.5">
                          <div className="space-y-1">
                            <span className="text-xs font-bold text-[#475569] block">
                              Hazır Kaide Yüksekliği Seçenekleri:
                            </span>
                            <div className="grid grid-cols-5 gap-1">
                              {[60, 80, 100, 120, 150].map((ph) => (
                                <button
                                  key={ph}
                                  type="button"
                                  data-testid={`carcass-plinth-preset-${ph}`}
                                  onClick={() => setPlinthHeight(ph)}
                                  className={`py-1 rounded-lg font-mono text-xs font-bold border transition cursor-pointer ${
                                    plinthH === ph
                                      ? "bg-[#EEF3F8] border-[#3B82F6] text-[#111827]"
                                      : "bg-white hover:bg-[#F1F5F9] border-[#CBD5E1] text-[#475569]"
                                  }`}
                                >
                                  {ph} mm
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs font-bold text-[#475569]">
                              <span>Ön Girinti (Ayak Boşluğu / Toe-Kick):</span>
                              <span className="font-mono text-[#0F172A]">
                                {activeModule.carcass.plinthSetbackMm ??
                                  ((activeModule.carcass.plinthConstruction ||
                                    (activeModule.category === "wardrobe"
                                      ? "pedestal_box"
                                      : "adjustable_legs_clip")) === "adjustable_legs_clip"
                                    ? 55
                                    : 35)}{" "}
                                mm
                              </span>
                            </div>
                            <input
                              type="range"
                              min={15}
                              max={85}
                              step={1}
                              value={
                                activeModule.carcass.plinthSetbackMm ??
                                ((activeModule.carcass.plinthConstruction ||
                                  (activeModule.category === "wardrobe"
                                    ? "pedestal_box"
                                    : "adjustable_legs_clip")) === "adjustable_legs_clip"
                                  ? 55
                                  : 35)
                              }
                              onChange={(e) =>
                                updateCarcassConfig({ plinthSetbackMm: Number(e.target.value) })
                              }
                              className="w-full accent-[#2563EB] h-1.5 bg-[#CBD5E1] rounded-lg cursor-pointer"
                            />
                          </div>

                          <V3PremiumDropdown
                            label="Kaide / Ön Baza Malzemesi"
                            value={plinthMatId}
                            options={carcassMaterialsList.map((m) => ({
                              value: m.id,
                              label: m.decorCode ? `${m.name} [${m.decorCode}]` : m.name,
                              subLabel: m.brand ? `${m.brand} • ${m.category}` : m.category,
                              badge: `${m.costPerM2} €/m²`,
                            }))}
                            onChange={(val) => setPlinthMaterial(val)}
                          />
                        </div>
                      ) : (
                        <div className="p-2 rounded-xl bg-white border border-[#E2E8F0] text-[13px] text-[#475569]">
                          Modül bazasız (0 mm) olarak yapılandırıldı; alt panel doğrudan tabana oturur.
                        </div>
                      )}
                    </section>

                    {/* GRUP 4: MALZEME (Gövde malzemesi, İç yüzey, Arkalık, Kenar bandı — Gerçek Katalog) */}
                    <section
                      data-testid="carcass-group-materials"
                      className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-[#111827]">4. Malzeme & Kenar Bandı</h3>
                        <span className="text-xs font-mono text-[#475569]">
                          {bodyMatDef.decorCode || bodyMatDef.brand || "Katalog"}
                        </span>
                      </div>

                      {/* 4.1 Gövde Malzemesi */}
                      <V3PremiumDropdown
                        label="Gövde Ana Malzemesi (Yan, Üst ve Alt Paneller)"
                        testId="carcass-body-material-select"
                        value={activeModule.carcass.bodyMaterialId}
                        options={carcassMaterialsList.map((m) => ({
                          value: m.id,
                          label: m.decorCode ? `${m.name} [${m.decorCode}]` : m.name,
                          subLabel: m.brand ? `${m.brand} • ${m.thickness}mm` : `${m.category} • ${m.thickness}mm`,
                          badge: `${m.costPerM2} €/m²`,
                        }))}
                        onChange={(val) => setMaterials(val, undefined)}
                      />

                      {/* 4.2 İç Yüzey Malzemesi */}
                      <V3PremiumDropdown
                        label="İç Yüzey (Üst / Alt İç Tablalar)"
                        testId="carcass-inner-surface-select"
                        value={innerSurfaceMatId}
                        options={[
                          {
                            value: activeModule.carcass.bodyMaterialId,
                            label: `Gövde Malzemesi ile Aynı (${bodyMatDef.name.split(" (")[0]})`,
                            subLabel: "Varsayılan üretim standardı",
                          },
                          ...carcassMaterialsList
                            .filter((m) => m.id !== activeModule.carcass.bodyMaterialId)
                            .map((m) => ({
                            value: m.id,
                            label: m.decorCode ? `${m.name} [${m.decorCode}]` : m.name,
                            subLabel: m.brand || m.category,
                            badge: `${m.costPerM2} €/m²`,
                          })),
                        ]}
                        onChange={(val) => {
                          const targetMat =
                            val === activeModule.carcass.bodyMaterialId ? null : val;
                          setSelectedComponentMaterial(targetMat, `${activeModule.id}_top`);
                          setSelectedComponentMaterial(targetMat, `${activeModule.id}_bottom`);
                        }}
                      />

                      {/* 4.3 Arkalık Malzemesi */}
                      <V3PremiumDropdown
                        label={`Arkalık Levha Malzemesi (${T_back} mm)`}
                        testId="carcass-back-material-select"
                        value={backMatId}
                        options={[
                          {
                            value: activeModule.carcass.bodyMaterialId,
                            label: `Gövde Malzemesi ile Aynı (${bodyMatDef.name.split(" (")[0]})`,
                            subLabel: `${T_back} mm uyumlu arkalık levhası`,
                          },
                          ...carcassMaterialsList
                            .filter((m) => m.id !== activeModule.carcass.bodyMaterialId)
                            .map((m) => ({
                            value: m.id,
                            label: m.decorCode ? `${m.name} [${m.decorCode}]` : m.name,
                            subLabel: m.brand || m.category,
                            badge: `${m.costPerM2} €/m²`,
                          })),
                        ]}
                        onChange={(val) => {
                          const targetMat =
                            val === activeModule.carcass.bodyMaterialId ? null : val;
                          setSelectedComponentMaterial(targetMat, `${activeModule.id}_back`);
                        }}
                      />

                      {/* 4.4 Kenar Bandı (ABS) */}
                      <div className="space-y-1.5 pt-1 border-t border-[#E2E8F0]">
                        <div className="flex items-center justify-between">
                          <label className="text-[13px] font-bold text-[#111827]">
                            Kenar Bandı Kalınlığı (ABS)
                          </label>
                          <span className="text-xs font-mono text-[#475569]">
                            Birim Maliyet: €{(bodyMatDef.edgeBandCostPerM ?? 0).toFixed(2)}/m
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 p-0.5">
                          {[
                            { val: 0.8, label: "0.8 mm ABS", sub: "İç kenar" },
                            { val: 1, label: "1.0 mm ABS", sub: "Standart gövde" },
                            { val: 2, label: "2.0 mm ABS", sub: "Darbe dayanımlı" },
                          ].map((eb) => (
                            <button
                              key={eb.val}
                              type="button"
                              data-testid={`carcass-edgeband-${eb.val}`}
                              onClick={() => updateCarcassConfig({ edgeBandThickness: eb.val })}
                              className={`p-2 rounded-xl border flex flex-col items-center text-center transition cursor-pointer ${
                                edgeBandMm === eb.val
                                  ? "bg-[#EEF3F8] border-2 border-[#3B82F6] text-[#111827] shadow-2xs"
                                  : "bg-white hover:bg-[#F1F5F9] border-[#CBD5E1] text-[#475569]"
                              }`}
                            >
                              <span className="font-mono text-[13px] font-bold text-[#111827]">
                                {eb.label}
                              </span>
                              <span className="text-xs text-[#64748B] mt-0.5">{eb.sub}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </section>
                  </div>
                );
              })()}

              {/* TAB 2: KAPAK (Kapak Tipi, Kapak Rengi, Açılış Yönü, Kapak Hareket Sistemi) */}
              {studioInspectorTab === "door" && (() => {
                const activeDoorMat =
                  DEFAULT_MATERIALS.find((m) => m.id === activeModule.carcass.doorMaterialId) ||
                  DEFAULT_MATERIALS[2];
                const activePlinthMatId =
                  activeModule.componentMaterialOverrides?.__plinth__ || "mat_lacquer_sage";
                const activePlinthMat =
                  DEFAULT_MATERIALS.find((m) => m.id === activePlinthMatId) ||
                  DEFAULT_MATERIALS[5];
                const activeHandleCat = activeBay?.door?.handleCategory || "bar_handle";
                const handleDisplay =
                  activeHandleCat === "bar_handle"
                    ? { code: "K019", sub: "Mat Siyah" }
                    : activeHandleCat === "knob"
                    ? { code: "D008", sub: "Antik Bronz Düğme" }
                    : activeHandleCat === "long_profile_handle"
                    ? { code: "L100", sub: "100cm Boy Profil" }
                    : activeHandleCat === "gola_profile"
                    ? { code: "GOLA-L", sub: "Alüminyum Gola Kanal" }
                    : activeHandleCat === "j_pull"
                    ? { code: "J-PULL", sub: "45° Kendinden Kulplu" }
                    : { code: "TIP-ON", sub: "Kulpsuz Bas-Aç" };

                return (
                  <div className="space-y-4">
                    {/* Quick Hide Doors Toggle for Wardrobe Interior Workflow */}
                    <div className="p-2.5 rounded-2xl bg-[#EEF3F8] border border-[#CBD5E1] flex items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-[#111827]">
                        👁️ 3D Sahnede Kapak Görünürlüğü
                      </span>
                      <button
                        type="button"
                        data-testid="studio-hide-doors-toggle-btn"
                        onClick={() => {
                          const next = !doorsHiddenStudio;
                          setDoorsHiddenStudio(next);
                          if (typeof window !== "undefined") {
                            window.dispatchEvent(
                              new CustomEvent("birim:set-doors-hidden", { detail: next })
                            );
                          }
                        }}
                        className="px-3 py-1 rounded-xl bg-white hover:bg-[#E4ECF4] text-[#111827] border border-[#94A3B8] text-[13px] font-bold cursor-pointer transition"
                      >
                        {doorsHiddenStudio ? "🚪 Kapakları Göster" : "👁️ Kapakları Gizle"}
                      </button>
                    </div>

                    {/* Kapak Tipi (4 Visual Line-Art Cards: Düz Kapak | Çerçeve | Fitilli | Cam + 45° Pahlı) */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#1C1917]">Kapak Tipi</span>
                        <button
                          type="button"
                          onClick={() => {
                            const nextProf =
                              doorCrossSectionProfile === "bevel_45" ? "flat_slab" : "bevel_45";
                            setDoorCrossSectionProfile(nextProf);
                            setModuleDoorCrossSection(nextProf);
                            if (typeof window !== "undefined") {
                              (
                                window as unknown as { __birimDoorCrossSection?: string }
                              ).__birimDoorCrossSection = nextProf;
                            }
                          }}
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full border transition cursor-pointer ${
                            doorCrossSectionProfile === "bevel_45"
                              ? "bg-[#EEF3F8] text-[#111827] border border-[#CBD5E1] border-[#94A3B8]"
                              : "bg-white text-[#57534E] border-[#CBD5E1] hover:border-[#94A3B8]"
                          }`}
                        >
                          📐 45° Pahlı Kesit
                        </button>
                      </div>

                      <div className="grid grid-cols-4 gap-1.5">
                        {[
                          {
                            id: "flat_slab",
                            label: "Düz Kapak",
                            svg: (
                              <svg viewBox="0 0 36 44" className="w-8 h-10" fill="none">
                                <rect x="6" y="4" width="24" height="36" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                                <line x1="9" y1="20" x2="9" y2="25" stroke="currentColor" strokeWidth="1.6" />
                              </svg>
                            ),
                          },
                          {
                            id: "shaker_frame",
                            label: "Çerçeve",
                            svg: (
                              <svg viewBox="0 0 36 44" className="w-8 h-10" fill="none">
                                <rect x="6" y="4" width="24" height="36" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                                <rect x="10" y="8" width="16" height="28" rx="1" stroke="currentColor" strokeWidth="1.2" />
                              </svg>
                            ),
                          },
                          {
                            id: "fluted_ribbed",
                            label: "Fitilli",
                            svg: (
                              <svg viewBox="0 0 36 44" className="w-8 h-10" fill="none">
                                <rect x="6" y="4" width="24" height="36" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                                <line x1="11" y1="4" x2="11" y2="40" stroke="currentColor" strokeWidth="1.1" />
                                <line x1="15.5" y1="4" x2="15.5" y2="40" stroke="currentColor" strokeWidth="1.1" />
                                <line x1="20" y1="4" x2="20" y2="40" stroke="currentColor" strokeWidth="1.1" />
                                <line x1="24.5" y1="4" x2="24.5" y2="40" stroke="currentColor" strokeWidth="1.1" />
                              </svg>
                            ),
                          },
                          {
                            id: "glass",
                            label: "Cam",
                            svg: (
                              <svg viewBox="0 0 36 44" className="w-8 h-10" fill="none">
                                <rect x="6" y="4" width="24" height="36" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                                <rect x="9" y="7" width="18" height="30" stroke="currentColor" strokeWidth="1" />
                                <line x1="18" y1="7" x2="18" y2="37" stroke="currentColor" strokeWidth="1" />
                                <line x1="12" y1="15" x2="16" y2="11" stroke="currentColor" strokeWidth="1" />
                              </svg>
                            ),
                          },
                        ].map((card) => {
                          const isGlassMat =
                            activeModule.carcass.doorMaterialId === "mat_smoked_glass" ||
                            activeModule.carcass.doorMaterialId === "mat_bronze_mirror";
                          const isSelected =
                            card.id === "glass"
                              ? isGlassMat
                              : !isGlassMat && doorCrossSectionProfile === card.id;
                          return (
                            <button
                              key={card.id}
                              type="button"
                              onClick={() => {
                                if (card.id === "glass") {
                                  setDoorCrossSectionProfile("glass_frame");
                                  setModuleDoorCrossSection("glass_frame");
                                } else {
                                  const prof = card.id as
                                    | "flat_slab"
                                    | "shaker_frame"
                                    | "fluted_ribbed";
                                  setDoorCrossSectionProfile(prof);
                                  setModuleDoorCrossSection(prof);
                                  if (typeof window !== "undefined") {
                                    (
                                      window as unknown as { __birimDoorCrossSection?: string }
                                    ).__birimDoorCrossSection = prof;
                                  }
                                }
                              }}
                              className={`py-2.5 px-1.5 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition cursor-pointer ${
                                isSelected
                                  ? "bg-white border-2 border-[#94A3B8] bg-[#F8FAFC] text-[#1C1917] shadow-xs"
                                  : "bg-white hover:bg-[#F1F5F9] border-[#CBD5E1] text-[#57534E]"
                              }`}
                            >
                              {card.svg}
                              <span className="text-[13px] font-semibold leading-tight text-center">
                                {card.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="h-px bg-[#E2E8F0]" />

                    {/* Malzeme ve Renk Drill-Down Row */}
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-[#1C1917] block">
                        Malzeme ve Renk
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setOpenRightDrawer((prev) => (prev === "material" ? null : "material"))
                        }
                        className="w-full p-2.5 rounded-2xl bg-white hover:bg-[#F8FAFC] border border-[#CBD5E1] flex items-center justify-between gap-3 transition cursor-pointer shadow-2xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-14 h-9 rounded-lg border border-stone-300/80 shrink-0 shadow-inner"
                            style={{ backgroundColor: activeDoorMat.colorHex }}
                          />
                          <div className="text-left min-w-0">
                            <div className="text-xs font-bold text-[#1C1917] truncate">
                              {activeDoorMat.name.split(" (")[0]}
                            </div>
                            <div className="text-[13px] text-[#78716C] capitalize">
                              {activeDoorMat.category === "wood"
                                ? "Veneer / Doğal Ahşap"
                                : activeDoorMat.category === "lacquer"
                                ? "Lake / Supramat"
                                : activeDoorMat.brand || activeDoorMat.category}
                            </div>
                          </div>
                        </div>
                        <ChevronRight
                          className={`w-4 h-4 text-[#78716C] transition-transform ${
                            openRightDrawer === "material" ? "rotate-90" : ""
                          }`}
                        />
                      </button>

                      {openRightDrawer === "material" && (
                        <div className="p-2.5 rounded-2xl bg-white border border-[#CBD5E1] space-y-2 max-h-60 overflow-y-auto shadow-sm">
                          <div className="text-xs font-bold uppercase tracking-wider text-[#78716C]">
                            Kapak Malzemesi Seçin
                          </div>
                          {DEFAULT_MATERIALS.filter((m) => m.id !== "mat_led_warm_3000k").map(
                            (mat) => (
                              <V3MaterialSwatch
                                key={mat.id}
                                id={mat.id}
                                name={mat.name.split(" (")[0]}
                                colorHex={mat.colorHex}
                                costPerM2={mat.costPerM2}
                                category={mat.brand || mat.category}
                                selected={activeModule.carcass.doorMaterialId === mat.id}
                                onSelect={() => setMaterials(undefined, mat.id)}
                              />
                            )
                          )}
                        </div>
                      )}
                    </div>

                    {/* Kulp Drill-Down Row */}
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-[#1C1917] block">Kulp</span>
                      <button
                        type="button"
                        onClick={() =>
                          setOpenRightDrawer((prev) => (prev === "handle" ? null : "handle"))
                        }
                        className="w-full p-2.5 rounded-2xl bg-white hover:bg-[#F8FAFC] border border-[#CBD5E1] flex items-center justify-between gap-3 transition cursor-pointer shadow-2xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-14 h-9 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center shrink-0">
                            <svg viewBox="0 0 48 24" className="w-10 h-5" fill="none">
                              <path
                                d="M8 15L38 7M12 14l2 4M34 8l2 4"
                                stroke="#1C1917"
                                strokeWidth="3"
                                strokeLinecap="round"
                              />
                            </svg>
                          </div>
                          <div className="text-left min-w-0">
                            <div className="text-xs font-bold text-[#1C1917]">
                              {handleDisplay.code}
                            </div>
                            <div className="text-[13px] text-[#78716C]">{handleDisplay.sub}</div>
                          </div>
                        </div>
                        <ChevronRight
                          className={`w-4 h-4 text-[#78716C] transition-transform ${
                            openRightDrawer === "handle" ? "rotate-90" : ""
                          }`}
                        />
                      </button>

                      {openRightDrawer === "handle" && activeBay && (
                        <div className="p-2.5 rounded-2xl bg-white border border-[#CBD5E1] grid grid-cols-2 gap-1.5 shadow-sm">
                          {[
                            { cat: "bar_handle", code: "K019", label: "Mat Siyah Çubuk" },
                            { cat: "knob", code: "D008", label: "Düğme Kulp" },
                            { cat: "long_profile_handle", code: "L100", label: "100cm Boy Profil" },
                            { cat: "gola_profile", code: "GOLA", label: "Gola Kanal Profil" },
                            { cat: "j_pull", code: "J-PULL", label: "J-Pull Kendinden" },
                            { cat: "handleless_plain", code: "TIP-ON", label: "Kulpsuz Bas-Aç" },
                          ].map((hOpt) => {
                            const isSel =
                              (activeBay.door.handleCategory || "bar_handle") === hOpt.cat;
                            return (
                              <button
                                key={hOpt.cat}
                                type="button"
                                onClick={() =>
                                  setBayV4DoorConfig(activeBayIndex, {
                                    handleCategory: hOpt.cat as HandleCategory,
                                  })
                                }
                                className={`p-2 rounded-xl border text-left transition cursor-pointer ${
                                  isSel
                                    ? "bg-[#EEF3F8] text-[#111827] border border-[#CBD5E1] border-[#94A3B8]"
                                    : "bg-[#FFFFFF] hover:bg-[#F1F5F9] text-[#1C1917] border-[#E2E8F0]"
                                }`}
                              >
                                <div className="text-[13px] font-bold">{hOpt.code}</div>
                                <div className="text-xs opacity-80">{hOpt.label}</div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Soket (Baza) Drill-Down Row */}
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-[#1C1917] block">Soket</span>
                      <button
                        type="button"
                        onClick={() =>
                          setOpenRightDrawer((prev) => (prev === "soket" ? null : "soket"))
                        }
                        className="w-full p-2.5 rounded-2xl bg-white hover:bg-[#F8FAFC] border border-[#CBD5E1] flex items-center justify-between gap-3 transition cursor-pointer shadow-2xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-14 h-9 rounded-lg border border-stone-300/80 shrink-0 shadow-inner"
                            style={{ backgroundColor: activePlinthMat.colorHex }}
                          />
                          <div className="text-left min-w-0">
                            <div className="text-xs font-bold text-[#1C1917]">
                              {activePlinthMat.id === "mat_lacquer_sage"
                                ? "Lake"
                                : activePlinthMat.name.split(" (")[0]}
                            </div>
                            <div className="text-[13px] text-[#78716C]">
                              {activePlinthMat.id === "mat_lacquer_sage"
                                ? "NCS S 6020-G30Y"
                                : activePlinthMat.decorCode || activePlinthMat.brand || "Baza Yüzeyi"}
                            </div>
                          </div>
                        </div>
                        <ChevronRight
                          className={`w-4 h-4 text-[#78716C] transition-transform ${
                            openRightDrawer === "soket" ? "rotate-90" : ""
                          }`}
                        />
                      </button>

                      {openRightDrawer === "soket" && (
                        <div className="p-2.5 rounded-2xl bg-white border border-[#CBD5E1] space-y-1.5 shadow-sm">
                          {[
                            {
                              id: "mat_lacquer_sage",
                              label: "Lake Adaçayı (NCS S 6020-G30Y)",
                              hex: "#8F9779",
                            },
                            {
                              id: "mat_veneer_oak",
                              label: "Meşe Doğal (A426)",
                              hex: "#b58d59",
                            },
                            {
                              id: "mat_lacquer_cream",
                              label: "Sahra Kumu Lake (AGT-3014)",
                              hex: "#ede8d0",
                            },
                            {
                              id: "mat_melamine_anthracite",
                              label: "Antrasit Mat (D149)",
                              hex: "#374151",
                            },
                            {
                              id: "mat_melamine_white",
                              label: "Mat Beyaz (D129)",
                              hex: "#f3f4f6",
                            },
                          ].map((sk) => (
                            <button
                              key={sk.id}
                              type="button"
                              onClick={() => setPlinthMaterial(sk.id)}
                              className={`w-full p-2 rounded-xl border flex items-center gap-2.5 text-left transition cursor-pointer ${
                                activePlinthMatId === sk.id
                                  ? "bg-[#F1F5F9] border-[#94A3B8] font-bold"
                                  : "bg-white hover:bg-[#FFFFFF] border-[#E2E8F0]"
                              }`}
                            >
                              <span
                                className="w-6 h-6 rounded-md border border-stone-300 shrink-0"
                                style={{ backgroundColor: sk.hex }}
                              />
                              <span className="text-xs text-[#1C1917]">{sk.label}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* HUMAN-FRIENDLY PRODUCTION CHECK BANNER (Replaces developer-centric UNVERIFIED label) */}
              {!isSimpleBlumMode && (
              <div
                data-testid="v4-compatibility-card"
                className="p-3 rounded-2xl border text-xs bg-[#F8FAFC] border-[#CBD5E1] space-y-2 shadow-2xs"
              >
                <button
                  type="button"
                  onClick={() => setShowCompatPopover((v) => !v)}
                  className="w-full flex items-center justify-between gap-2 text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-[#EEF3F8] border border-[#CBD5E1] flex items-center justify-center shrink-0 text-[#111827] font-bold">
                      !
                    </span>
                    <div className="min-w-0">
                      <div className="font-bold text-[#111827] leading-tight">
                        {humanCompatStatusLabel}
                        <span className="sr-only"> ({v4CompatibilityReport.overallStatus})</span>
                      </div>
                      <div className="text-xs text-[#475569] leading-tight mt-0.5">
                        Hangi kuralların doğrulanmadığını ve üretime etkisini görmek için tıklayın
                      </div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-[#EEF3F8] text-[#111827] border border-[#CBD5E1] text-xs font-bold shrink-0">
                    {showCompatPopover ? "Gizle ▲" : "Detay ▼"}
                  </span>
                </button>

                {showCompatPopover && (
                  <div className="pt-2 border-t border-[#E2E8F0] space-y-2 text-[13px]">
                    <div className="p-2 rounded-xl bg-white border border-[#E2E8F0] space-y-1">
                      <div className="font-bold text-[#111827]">
                        1. CNC Kesim & Testere Payı (Biesse Selco WNT 600)
                      </div>
                      <div className="text-xs text-[#475569]">
                        <b>Durum:</b> Fabrika kesim parametreleri (4.4 mm testere kerf, 70 mm min. kıskaç) fiziksel makine onayı bekliyor.
                      </div>
                      <div className="text-xs text-[#111827] bg-[#EEF3F8] px-2 py-1 rounded-lg border border-[#CBD5E1]">
                        <b>Üretime Etkisi:</b> 3D tasarım ve teklif fiyatı doğrudur; ancak .CIX/.XML kesim dosyası makineye gönderilmeden önce üretim şefi tarafından onaylanmalıdır.
                      </div>
                    </div>

                    <div className="p-2 rounded-xl bg-white border border-[#E2E8F0] space-y-1">
                      <div className="font-bold text-[#111827]">
                        2. Kulp & Donanım Delik Şablonları ({activeBay?.door?.hardwareProductId || "Blum / Hettich"})
                      </div>
                      <div className="text-xs text-[#475569]">
                        <b>Durum:</b> Kulp montaj koordinatları ve özel mekanizma delik şablonları fiziksel numune doğrulaması bekliyor.
                      </div>
                      <div className="text-xs text-[#111827] bg-[#EEF3F8] px-2 py-1 rounded-lg border border-[#CBD5E1]">
                        <b>Üretime Etkisi:</b> BOM malzeme listesi üretilebilir; seri CNC delik işleminden önce 1 adet numune kapak üzerinde kontrol yapılmalıdır.
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowRulesModal(true)}
                      className="w-full py-1.5 px-3 rounded-xl bg-[#EEF3F8] hover:bg-[#E4ECF4] text-[#111827] border border-[#CBD5E1] font-bold text-[13px] cursor-pointer"
                    >
                      Tüm Mühendislik & Üretim Kontrol Tablosunu Aç ({v4CompatibilityReport.issues.length} Kayıt) ›
                    </button>
                  </div>
                )}
              </div>
              )}

              {studioInspectorTab === "all" && (
                <V3CollapsibleSection
                  title="Tezgâh (Neolith / Mermer) & Tamamlayıcı Parçalar"
                  badge={`#${activeModuleIndex + 1} Dolap`}
                  defaultOpen={true}
                >
                  <div data-testid="studio-attached-complementary-card" className="space-y-3">
                    <div className="text-[13px] font-bold text-[#57534E]">
                      🪨 Mutfak Tezgâhı & Üst Tabla (Neolith / Dekton / Mermer)
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {DEFAULT_MATERIALS.filter(
                        (m) =>
                          m.category === "stone" ||
                          m.id.includes("neolith") ||
                          m.id.includes("dekton") ||
                          m.id.includes("marble")
                      ).map((mat) => (
                        <button
                          key={mat.id}
                          type="button"
                          onClick={() => setCountertopMaterial(mat.id)}
                          className={`p-2 rounded-xl border flex items-center gap-2 text-left transition cursor-pointer ${
                            (activeModule.carcass.countertopMaterialId ||
                              "mat_neolith_calacatta_luxe") === mat.id
                              ? "bg-[#F1F5F9] border-[#94A3B8] font-bold"
                              : "bg-white hover:bg-[#FFFFFF] border-[#E2E8F0]"
                          }`}
                        >
                          <span
                            className="w-5 h-5 rounded-md border border-stone-300 shrink-0"
                            data-material-swatch="true" style={getMaterialSwatchStyle(mat)}
                          />
                          <span className="text-xs text-[#1C1917] truncate">
                            {mat.name.split(" (")[0]}
                          </span>
                        </button>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-[#E2E8F0]">
                      <div className="text-[13px] font-bold text-[#57534E] mb-1.5">
                        🧩 Seçili Dolaba Tamamlayıcı Parça Kilitli Ekle
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[
                          { id: "panel_left", short: "Sol Bitiş" },
                          { id: "panel_right", short: "Sağ Bitiş" },
                          { id: "crown_top", short: "Üst Taç" },
                          { id: "filler_left", short: "Kör Dolgu" },
                          { id: "worktop", short: "Tezgâh" },
                          { id: "backsplash", short: "Backsplash" },
                          { id: "waterfall_right", short: "Şelale Yan" },
                          { id: "plinth_front", short: "Ön Baza" },
                        ].map((cp) => {
                          const attId = `comp_att_${activeModule.id}__${cp.id}`;
                          const isAttached = project.modules.some((m) => m.id === attId);
                          return (
                            <button
                              key={cp.id}
                              type="button"
                              data-testid={`studio-attach-comp-${cp.id}`}
                              onClick={() =>
                                attachComplementaryToActiveModule(
                                  cp.id as
                                    | "panel_left"
                                    | "panel_right"
                                    | "crown_top"
                                    | "filler_left"
                                    | "worktop"
                                    | "backsplash"
                                    | "waterfall_right"
                                    | "plinth_front"
                                )
                              }
                              className={`py-2 px-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                                isAttached
                                  ? "bg-[#EEF3F8] text-[#111827] border border-[#CBD5E1] border-[#94A3B8]"
                                  : "bg-white hover:bg-[#F1F5F9] text-[#1C1917] border-[#E2E8F0]"
                              }`}
                            >
                              {cp.short}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </V3CollapsibleSection>
              )}

                            {studioInspectorTab === "interior" && (
              <V3CollapsibleSection
                title={`🎯 Bölme ${activeBayIndex + 1} İç Düzeni (${currentBayWidthMm} mm)`}
                badge={`${activeBayIndex + 1} / ${activeModule.bays.length} Bölme`}
                defaultOpen={true}
              >
                {/* EKRAN 4 REFERENCE MOCKUP 1-TO-1: 1. Bölme Seçimi | 2. Bölme X – İç Düzen (👁️ / ✏️ / 🗑️) | 3. Öğe Ekle (2x4 Grid) | 4. Bölme Ayarları */}
                <div className="space-y-4 mb-4">
                  {/* 1. Bölme Seçimi */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#111827]">Bölme Seçimi</span>
                      <span className="text-xs text-[#64748B]">3D sahneden veya buradan seçin</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {activeModule.bays.map((b, idx) => {
                        const isSel = activeBayIndex === idx;
                        const bw = activeBreakdown.bayWidths[idx] || 600;
                        return (
                          <button
                            key={b.index}
                            type="button"
                            data-testid={`studio-bay-pill-top-${idx}`}
                            onClick={() => setActiveBayIndex(idx)}
                            className={`py-2 px-1.5 rounded-xl border flex flex-col items-center justify-center text-center transition cursor-pointer ${
                              isSel
                                ? "bg-[#EFF6FF] border-2 border-[#2563EB] text-[#111827] shadow-2xs"
                                : "bg-[#F8FAFC] hover:bg-[#F1F5F9] border-[#E2E8F0] text-[#475569]"
                            }`}
                          >
                            <span className="text-[13px] font-bold text-[#111827] leading-tight">
                              Bölme {idx + 1}
                            </span>
                            <span className="text-xs text-[#475569] leading-tight mt-0.5 font-mono">
                              {bw} mm
                            </span>
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        data-testid="studio-bay-pill-add"
                        onClick={() => {
                          splitBayIntoTwo(activeBayIndex);
                        }}
                        className="py-2 px-1.5 rounded-xl border border-dashed border-[#CBD5E1] hover:border-[#2563EB] hover:bg-[#EFF6FF] flex flex-col items-center justify-center text-center transition cursor-pointer text-[#111827]"
                      >
                        <span className="text-xs font-bold leading-none">+</span>
                        <span className="text-xs font-semibold leading-tight mt-0.5">
                          Bölme Ekle
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* 2. Bölme X – İç Düzen (Active Compartment Component List with 👁️ Gizle/Göster, ✏️ Düzenle, 🗑️ Sil, ⋮⋮) */}
                  {activeBay && (() => {
                    const fittingNameMap: Record<string, { label: string; vis: InteriorAccessoryVisualKind }> = {
                      trouser_rack: { label: "Pantolonluk (Häfele)", vis: "trouser_rack" },
                      shoe_rack: { label: "Ayakkabılık (Eğimli/Düz)", vis: "shoe_rack" },
                      tie_rack: { label: "Kravatlık (Teleskopik)", vis: "tie_rack" },
                      belt_rack: { label: "Kemerlik (Teleskopik)", vis: "belt_rack" },
                      wardrobe_lift: { label: "Gardırop Asansörü (Servetto)", vis: "wardrobe_lift" },
                      wire_basket: { label: "Tel Sepet (Häfele)", vis: "wire_basket" },
                      jewelry_tray: { label: "Kadife Takı Çekmecesi", vis: "jewelry_tray" },
                      led_profile: { label: "Üst & Raf Gömme LED", vis: "led_profile" },
                      led_vertical_strip: { label: "Dikme Boy LED Şerit", vis: "led_profile" },
                      led_rod_strip: { label: "Sensörlü Askı LED", vis: "led_profile" },
                    };

                    const bayItemsList: {
                      id: string;
                      kind: "rail" | "shelf" | "drawer" | "fitting";
                      title: string;
                      subtitle: string;
                      visual: InteriorAccessoryVisualKind;
                      isHidden: boolean;
                      elevY: number;
                      heightMm?: number;
                      thicknessMm?: number;
                      onDelete: () => void;
                    }[] = [
                      ...activeBay.hangingRails.map((r, rIdx) => ({
                        id: r.id,
                        kind: "rail" as const,
                        title: activeBay.hangingRails.length > 1 ? `Askılık ${rIdx + 1}` : "Askılık",
                        subtitle: `Ø25 mm Krom · Y: ${r.elevationY} mm`,
                        visual: "rail" as const,
                        isHidden: Boolean(r.isHidden),
                        elevY: r.elevationY,
                        onDelete: () => removeHangingRail(activeBayIndex, r.id),
                      })),
                      ...[...activeBay.shelves]
                        .sort((a, b) => b.elevationY - a.elevationY)
                        .map((s, sIdx) => ({
                          id: s.id,
                          kind: "shelf" as const,
                          title: sIdx === 0 && activeBay.hangingRails.length > 0 ? "Üst Raf" : `Raf ${sIdx + 1}`,
                          subtitle: `Kalınlık: ${s.thickness || activeModule.carcass.panelThickness || 18} mm · Y: ${s.elevationY} mm`,
                          visual: "shelf" as const,
                          isHidden: Boolean(s.isHidden),
                          elevY: s.elevationY,
                          thicknessMm: s.thickness || activeModule.carcass.panelThickness || 18,
                          onDelete: () => removeShelf(activeBayIndex, s.id),
                        })),
                      ...activeBay.drawers.map((d, dIdx) => ({
                        id: d.id,
                        kind: "drawer" as const,
                        title: d.isInternal ? `İç Çekmece ${dIdx + 1}` : `Çekmece ${dIdx + 1}`,
                        subtitle: `Yükseklik: ${d.height} mm · Y: ${d.elevationY} mm`,
                        visual: (d.isInternal ? "internal_drawer" : "drawer") as InteriorAccessoryVisualKind,
                        isHidden: Boolean(d.isHidden),
                        elevY: d.elevationY,
                        heightMm: d.height,
                        onDelete: () => removeDrawer(activeBayIndex, d.id),
                      })),
                      ...(activeBay.specialFittings || []).map((f) => {
                        const meta = fittingNameMap[f.type] || {
                          label: f.type,
                          vis: "trouser_rack" as InteriorAccessoryVisualKind,
                        };
                        return {
                          id: f.id,
                          kind: "fitting" as const,
                          title: meta.label,
                          subtitle: `Y: ${f.elevationY} mm · H: ${f.height} mm`,
                          visual: meta.vis,
                          isHidden: Boolean(f.isHidden),
                          elevY: f.elevationY,
                          heightMm: f.height,
                          onDelete: () => removeSpecialFitting(activeBayIndex, f.id),
                        };
                      }),
                    ];

                    return (
                      <div
                        data-testid="studio-bay-interior-stack-list"
                        className="space-y-2 pt-2 border-t border-[#E2E8F0]"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#111827]">
                            Bölme {activeBayIndex + 1} – İç Düzen
                          </span>
                          <span className="text-xs font-semibold text-[#64748B]">
                            {bayItemsList.length} bileşen
                          </span>
                        </div>

                        {bayItemsList.length === 0 ? (
                          <div className="p-3 rounded-xl bg-[#F8FAFC] border border-dashed border-[#CBD5E1] text-center text-[13px] text-[#64748B]">
                            Bu bölmede henüz iç donanım yok. Aşağıdaki <b>Öğe Ekle</b> kartlarından veya sol kütüphaneden bileşen ekleyebilirsiniz.
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {bayItemsList.map((item) => {
                              const isEditingRow = editingInteriorItemId === item.id;
                              return (
                                <div
                                  key={item.id}
                                  data-testid={`studio-interior-row-${item.id}`}
                                  className={`rounded-xl border transition ${
                                    item.isHidden
                                      ? "bg-[#F8FAFC]/60 border-[#E2E8F0] opacity-60"
                                      : isEditingRow
                                      ? "bg-[#EFF6FF]/60 border-[#2563EB] shadow-2xs"
                                      : "bg-white hover:bg-[#F8FAFC] border-[#CBD5E1]"
                                  }`}
                                >
                                  <div className="px-2.5 py-2 flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                      {renderInteriorComponentIllustration(item.visual, "sm")}
                                      <div className="min-w-0">
                                        <div className="text-[13px] font-bold text-[#111827] leading-tight truncate">
                                          {item.title}
                                        </div>
                                        <div className="text-xs text-[#64748B] leading-tight mt-0.5 truncate">
                                          {item.subtitle}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0">
                                      {/* 1. 👁️ Gizle / Göster */}
                                      <button
                                        type="button"
                                        data-testid={`interior-row-toggle-hide-${item.id}`}
                                        onClick={() =>
                                          toggleInteriorItemHidden(activeBayIndex, item.kind, item.id)
                                        }
                                        title={item.isHidden ? "3D Modelde Göster" : "3D Modelde Gizle (Veriyi Korur)"}
                                        className={`p-1.5 rounded-lg border transition cursor-pointer ${
                                          item.isHidden
                                            ? "bg-amber-50 border-amber-300 text-amber-700"
                                            : "bg-[#F8FAFC] hover:bg-[#EFF6FF] border-[#E2E8F0] text-[#475569] hover:text-[#111827]"
                                        }`}
                                      >
                                        {item.isHidden ? (
                                          <EyeOff className="w-3.5 h-3.5" />
                                        ) : (
                                          <Eye className="w-3.5 h-3.5" />
                                        )}
                                      </button>

                                      {/* 2. ✏️ Düzenle */}
                                      <button
                                        type="button"
                                        data-testid={`interior-row-edit-${item.id}`}
                                        onClick={() =>
                                          setEditingInteriorItemId((prev) =>
                                            prev === item.id ? null : item.id
                                          )
                                        }
                                        title="Yükseklik, konum ve kalınlık parametrelerini düzenle"
                                        className={`p-1.5 rounded-lg border transition cursor-pointer ${
                                          isEditingRow
                                            ? "bg-[#2563EB] border-[#1D4ED8] text-white"
                                            : "bg-[#F8FAFC] hover:bg-[#EFF6FF] border-[#E2E8F0] text-[#475569] hover:text-[#111827]"
                                        }`}
                                      >
                                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                                          <path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                                        </svg>
                                      </button>

                                      {/* 3. 🗑️ Sil */}
                                      <button
                                        type="button"
                                        data-testid={`interior-row-delete-${item.id}`}
                                        onClick={item.onDelete}
                                        title="Bileşeni sil"
                                        className="p-1.5 rounded-lg bg-[#F8FAFC] hover:bg-red-50 border border-[#E2E8F0] hover:border-red-200 text-[#475569] hover:text-red-600 transition cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>

                                      <span
                                        className="text-[#94A3B8] text-xs px-0.5 select-none"
                                        title="3D sahnede dikey sürükleyerek de taşıyabilirsiniz"
                                      >
                                        ⋮⋮
                                      </span>
                                    </div>
                                  </div>

                                  {/* Inline Parametric Editor when ✏️ Düzenle is clicked */}
                                  {isEditingRow && (
                                    <div className="px-2.5 pb-2.5 pt-1.5 border-t border-[#E2E8F0] bg-[#F8FAFC] rounded-b-xl space-y-2 text-[13px]">
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="font-semibold text-[#475569]">
                                          Yerden Kot (Y):
                                        </span>
                                        <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-[#CBD5E1]">
                                          <input
                                            type="number"
                                            min={0}
                                            max={Math.max(100, netInnerHeightMm - 40)}
                                            step={10}
                                            value={item.elevY}
                                            onChange={(e) => {
                                              const nextY = Number(e.target.value) || 0;
                                              if (item.kind === "shelf") {
                                                setShelfElevation(activeBayIndex, item.id, nextY);
                                              } else if (item.kind === "rail") {
                                                setHangingRailElevation(activeBayIndex, item.id, nextY);
                                              } else if (item.kind === "drawer") {
                                                setDrawerPlacement(activeBayIndex, item.id, nextY, undefined);
                                              } else if (item.kind === "fitting") {
                                                setSpecialFittingPlacement(activeBayIndex, item.id, {
                                                  elevationY: nextY,
                                                });
                                              }
                                            }}
                                            className="w-16 font-mono text-xs font-bold text-[#111827] text-right focus:outline-none"
                                          />
                                          <span className="text-xs text-[#64748B]">mm</span>
                                        </div>
                                      </div>

                                      {item.kind === "shelf" && (
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="font-semibold text-[#475569]">
                                            Raf Kalınlığı:
                                          </span>
                                          <div className="flex items-center gap-1">
                                            {[18, 22, 25, 36].map((tk) => (
                                              <button
                                                key={tk}
                                                type="button"
                                                onClick={() =>
                                                  setShelfThickness(activeBayIndex, item.id, tk)
                                                }
                                                className={`px-2 py-0.5 rounded-md font-mono text-xs font-bold border cursor-pointer ${
                                                  item.thicknessMm === tk
                                                    ? "bg-[#2563EB] text-white border-[#1D4ED8]"
                                                    : "bg-white text-[#475569] border-[#CBD5E1]"
                                                }`}
                                              >
                                                {tk}mm
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {item.kind === "drawer" && (
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="font-semibold text-[#475569]">
                                            Çekmece Yüksekliği:
                                          </span>
                                          <div className="flex items-center gap-1">
                                            {[120, 160, 200, 260].map((dh) => (
                                              <button
                                                key={dh}
                                                type="button"
                                                onClick={() =>
                                                  setDrawerPlacement(
                                                    activeBayIndex,
                                                    item.id,
                                                    undefined,
                                                    dh
                                                  )
                                                }
                                                className={`px-2 py-0.5 rounded-md font-mono text-xs font-bold border cursor-pointer ${
                                                  item.heightMm === dh
                                                    ? "bg-[#2563EB] text-white border-[#1D4ED8]"
                                                    : "bg-white text-[#475569] border-[#CBD5E1]"
                                                }`}
                                              >
                                                {dh}mm
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* 3. Öğe Ekle (2x4 Realistic Visual Grid matching image_e548e6.jpg: Raf | Askılık | Çekmece | Pantolonluk | Ayakkabılık | Kravatlık | Kemerlik | + Diğer) */}
                  {activeBay && (
                    <div className="space-y-2 pt-2 border-t border-[#E2E8F0]">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#111827]">Öğe Ekle</span>
                        <span className="text-xs text-[#64748B]">
                          Bölme {activeBayIndex + 1} içine doğrudan ekler
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[
                          {
                            id: "lib_shelf",
                            label: "Raf",
                            vis: "shelf" as const,
                            onClick: () => addShelf(activeBayIndex),
                          },
                          {
                            id: "lib_sub_divider",
                            label: "Raf Arası Dikme",
                            vis: "sub_divider" as const,
                            onClick: () => addSubDivider(activeBayIndex),
                          },
                          {
                            id: "lib_carcass_divider",
                            label: "Ara Dikme",
                            vis: "carcass_divider" as const,
                            onClick: () => splitBayIntoTwo(activeBayIndex),
                          },
                          {
                            id: "lib_drawer",
                            label: "Çekmece",
                            vis: "drawer" as const,
                            onClick: () => addDrawer(activeBayIndex),
                          },
                          {
                            id: "lib_rail",
                            label: "Askılık",
                            vis: "rail" as const,
                            onClick: () => addHangingRail(activeBayIndex),
                          },
                          {
                            id: "lib_trouser_rack",
                            label: "Pantolonluk",
                            vis: "trouser_rack" as const,
                            onClick: () => addSpecialFitting(activeBayIndex, "trouser_rack"),
                          },
                          {
                            id: "lib_shoe_rack",
                            label: "Ayakkabılık",
                            vis: "shoe_rack" as const,
                            onClick: () => addSpecialFitting(activeBayIndex, "shoe_rack"),
                          },
                        ].map((btn) => (
                          <div
                            key={btn.id}
                            role="button"
                            tabIndex={0}
                            data-testid={`studio-quick-grid-${btn.id}`}
                            draggable={true}
                            onDragStart={(e) =>
                              startAccessorySilhouetteDrag(e, {
                                id: btn.id,
                                visual: btn.vis,
                                title: btn.label,
                                cat: "all",
                                spec: btn.label,
                              })
                            }
                            onDragEnd={() => {
                              if (typeof window !== "undefined") {
                                (window as any).__birimActiveDraggedAccessory = null;
                              }
                            }}
                            onClick={btn.onClick}
                            className="p-2 rounded-2xl bg-white hover:bg-[#EFF6FF] border border-[#CBD5E1] hover:border-[#2563EB] flex flex-col items-center justify-center text-center gap-1 transition cursor-grab active:cursor-grabbing select-none shadow-2xs"
                          >
                            <div className="pointer-events-none flex flex-col items-center gap-1 w-full">
                              {renderInteriorComponentIllustration(btn.vis, "sm")}
                              <span className="text-[11px] font-bold text-[#111827] leading-tight truncate w-full">
                                {btn.label}
                              </span>
                            </div>
                          </div>
                        ))}

                        {/* 8th Card: + Diğer */}
                        <button
                          type="button"
                          data-testid="studio-quick-grid-more"
                          onClick={() => setShowMoreInteriorAddGrid((v) => !v)}
                          className={`p-2 rounded-2xl border flex flex-col items-center justify-center text-center gap-1 transition cursor-pointer ${
                            showMoreInteriorAddGrid
                              ? "bg-[#EFF6FF] border-2 border-[#2563EB] text-[#1D4ED8]"
                              : "bg-[#F8FAFC] hover:bg-[#EFF6FF] border-[#CBD5E1] text-[#111827]"
                          }`}
                        >
                          <span className="w-7 h-7 rounded-full bg-white border border-[#CBD5E1] flex items-center justify-center text-sm font-bold text-[#111827]">
                            +
                          </span>
                          <span className="text-xs font-bold leading-tight">Diğer</span>
                        </button>
                      </div>

                      {showMoreInteriorAddGrid && (
                        <div className="grid grid-cols-3 gap-1.5 p-2 rounded-2xl bg-[#F8FAFC] border border-[#CBD5E1]">
                          {[
                            {
                              id: "internal_drawer",
                              label: "İç Çekmece",
                              vis: "internal_drawer" as const,
                              onClick: () => addInternalDrawer(activeBayIndex, 140),
                            },
                            {
                              id: "wardrobe_lift",
                              label: "Asansör",
                              vis: "wardrobe_lift" as const,
                              onClick: () => addSpecialFitting(activeBayIndex, "wardrobe_lift"),
                            },
                            {
                              id: "wire_basket",
                              label: "Tel Sepet",
                              vis: "wire_basket" as const,
                              onClick: () => addSpecialFitting(activeBayIndex, "wire_basket"),
                            },
                            {
                              id: "jewelry_tray",
                              label: "Takı Çekmecesi",
                              vis: "jewelry_tray" as const,
                              onClick: () => addSpecialFitting(activeBayIndex, "jewelry_tray"),
                            },
                            {
                              id: "sub_divider",
                              label: "Ara Dikme",
                              vis: "sub_divider" as const,
                              onClick: () => addSubDivider(activeBayIndex),
                            },
                            {
                              id: "led_profile",
                              label: "Loox5 LED",
                              vis: "led_profile" as const,
                              onClick: () => addSpecialFitting(activeBayIndex, "led_profile"),
                            },
                          ].map((extra) => (
                            <button
                              key={extra.id}
                              type="button"
                              data-testid={`studio-quick-extra-${extra.id}`}
                              onClick={extra.onClick}
                              className="p-1.5 rounded-xl bg-white hover:bg-[#EFF6FF] border border-[#E2E8F0] hover:border-[#2563EB] flex flex-col items-center text-center gap-0.5 cursor-pointer"
                            >
                              {renderInteriorComponentIllustration(extra.vis, "sm")}
                              <span className="text-xs font-bold text-[#111827] leading-tight">
                                {extra.label}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 4. Bölme Ayarları (Matches image_e548e6.jpg bottom-right: Bölme Genişliği | Serbest Yükseklik | Raf Kalınlığı | Otomatik Aralık Eşit Dağıt) */}
                  {activeBay && (() => {
                    const maxDrawerTopMm =
                      activeBay.drawers.length > 0
                        ? Math.max(...activeBay.drawers.map((d) => d.elevationY + d.height))
                        : 0;
                    const freeHeightMm = Math.max(120, netInnerHeightMm - maxDrawerTopMm);
                    const curShelfThicknessMm =
                      activeBay.shelves[0]?.thickness || activeModule.carcass.panelThickness || 18;

                    return (
                      <div
                        data-testid="studio-bay-settings-section"
                        className="space-y-2.5 pt-2 border-t border-[#E2E8F0] text-xs"
                      >
                        <span className="text-xs font-bold text-[#111827] block">
                          Bölme Ayarları
                        </span>

                        {/* Bölme Genişliği */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-medium text-[#475569]">
                            Bölme Genişliği
                          </span>
                          <div className="flex items-center bg-white rounded-xl border border-[#CBD5E1] px-2.5 py-1.5">
                            <input
                              type="number"
                              min={220}
                              max={Math.max(300, width - 200)}
                              step={10}
                              value={currentBayWidthMm}
                              onChange={(e) =>
                                setBayCustomWidth(activeBayIndex, Number(e.target.value))
                              }
                              className="w-14 font-mono text-xs font-bold text-[#111827] text-right focus:outline-none"
                            />
                            <span className="text-xs text-[#64748B] ml-1">mm</span>
                          </div>
                        </div>

                        {/* Serbest Yükseklik */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-medium text-[#475569]">
                            Serbest Yükseklik
                          </span>
                          <div className="flex items-center bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] px-2.5 py-1.5">
                            <span className="font-mono text-xs font-bold text-[#111827]">
                              {freeHeightMm}
                            </span>
                            <span className="text-xs text-[#64748B] ml-1">mm</span>
                          </div>
                        </div>

                        {/* Raf Kalınlığı */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-medium text-[#475569]">
                            Raf Kalınlığı
                          </span>
                          <select
                            data-testid="studio-bay-shelf-thickness-select"
                            value={curShelfThicknessMm}
                            onChange={(e) =>
                              setShelfThickness(
                                activeBayIndex,
                                "all",
                                Number(e.target.value) || 18
                              )
                            }
                            className="bg-white rounded-xl border border-[#CBD5E1] px-2.5 py-1.5 font-mono text-xs font-bold text-[#111827] cursor-pointer"
                          >
                            <option value={18}>18 mm</option>
                            <option value={22}>22 mm</option>
                            <option value={25}>25 mm</option>
                            <option value={36}>36 mm</option>
                          </select>
                        </div>

                        {/* Otomatik Aralık (Eşit Dağıt) */}
                        <div className="flex items-center justify-between gap-2 pt-0.5">
                          <span className="text-[13px] font-medium text-[#475569]">
                            Otomatik Aralık (Eşit Dağıt)
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              data-testid="studio-bay-equalize-btn"
                              onClick={() => {
                                setAutoEqualSpacingEnabled((v) => !v);
                                equalizeBaysAndShelves(activeBayIndex);
                              }}
                              className={`w-10 h-5 rounded-full p-0.5 flex items-center transition cursor-pointer ${
                                autoEqualSpacingEnabled
                                  ? "bg-[#2563EB] justify-end"
                                  : "bg-[#CBD5E1] justify-start"
                              }`}
                              title="Rafları ve bölmeleri eşit aralıklarla dağıt"
                            >
                              <span className="w-4 h-4 rounded-full bg-white shadow-2xs" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Wardrobe Interior Workflow Step 1–3 Banner: Hide Doors + Click Compartment in 3D */}
                <div className="p-2.5 rounded-2xl bg-[#EEF3F8] border border-[#CBD5E1] space-y-2 mb-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold text-[#111827]">
                        Seçili Bölme: Bölme {activeBayIndex + 1} ({currentBayWidthMm} mm)
                      </div>
                      <div className="text-xs text-[#475569]">
                        3D modelde doğrudan istediğiniz bölmeye tıklayarak seçebilirsiniz
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const next = !doorsHiddenStudio;
                        setDoorsHiddenStudio(next);
                        if (typeof window !== "undefined") {
                          window.dispatchEvent(
                            new CustomEvent("birim:set-doors-hidden", { detail: next })
                          );
                        }
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-[#E4ECF4] text-[#111827] border border-[#94A3B8] text-xs font-bold shrink-0 cursor-pointer"
                    >
                      {doorsHiddenStudio ? "🚪 Kapakları Göster" : "👁️ Kapakları Gizle"}
                    </button>
                  </div>

                  {/* Step 4: Sadece Seçili Bölmeye Ait 5 Ana Seçenek (Raf, Askılık, Çekmece, Pantolonluk, Ayakkabılık) */}
                  {activeBay && (
                    <div className="space-y-1.5 pt-1 border-t border-[#CBD5E1]/70">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#111827] block">
                        Bölme {activeBayIndex + 1} İçin Hızlı Eleman Ekle:
                      </span>
                      <div className="grid grid-cols-5 gap-1">
                        <button
                          type="button"
                          onClick={() => addShelf(activeBayIndex)}
                          className="py-2 px-1 rounded-xl bg-white hover:bg-[#E4ECF4] border border-[#CBD5E1] text-[#111827] flex flex-col items-center justify-center gap-0.5 cursor-pointer transition shadow-2xs"
                        >
                          <Layers className="w-3.5 h-3.5" />
                          <span className="text-xs font-bold">+ Raf</span>
                          <span className="text-xs text-[#64748B]">{activeBay.shelves.length} ad.</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => addHangingRail(activeBayIndex)}
                          className="py-2 px-1 rounded-xl bg-white hover:bg-[#E4ECF4] border border-[#CBD5E1] text-[#111827] flex flex-col items-center justify-center gap-0.5 cursor-pointer transition shadow-2xs"
                        >
                          <Shirt className="w-3.5 h-3.5" />
                          <span className="text-xs font-bold">+ Askılık</span>
                          <span className="text-xs text-[#64748B]">{activeBay.hangingRails.length} ad.</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => addDrawer(activeBayIndex)}
                          className="py-2 px-1 rounded-xl bg-white hover:bg-[#E4ECF4] border border-[#CBD5E1] text-[#111827] flex flex-col items-center justify-center gap-0.5 cursor-pointer transition shadow-2xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span className="text-xs font-bold">+ Çekmece</span>
                          <span className="text-xs text-[#64748B]">{activeBay.drawers.length} ad.</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => addSpecialFitting(activeBayIndex, "trouser_rack")}
                          className="py-2 px-1 rounded-xl bg-white hover:bg-[#E4ECF4] border border-[#CBD5E1] text-[#111827] flex flex-col items-center justify-center gap-0.5 cursor-pointer transition shadow-2xs"
                        >
                          <Columns className="w-3.5 h-3.5" />
                          <span className="text-xs font-bold">Pantolonluk</span>
                          <span className="text-xs text-[#64748B]">Häfele</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => addSpecialFitting(activeBayIndex, "shoe_rack")}
                          className="py-2 px-1 rounded-xl bg-white hover:bg-[#E4ECF4] border border-[#CBD5E1] text-[#111827] flex flex-col items-center justify-center gap-0.5 cursor-pointer transition shadow-2xs"
                        >
                          <Box className="w-3.5 h-3.5" />
                          <span className="text-xs font-bold">Ayakkabılık</span>
                          <span className="text-xs text-[#64748B]">Häfele</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Step 5: Seçili Bölme Şablonları (Anında 3D Önizleme + Uygula ile Onayla) */}
                  <div className="space-y-1.5 pt-1 border-t border-[#CBD5E1]/70">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#111827] block">
                      Bölme {activeBayIndex + 1} Hazır Şablonları (Tıkla → 3D Önizle → Uygula):
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { id: "shelves_5", label: "5 Raflı İstif Düzeni", sub: "Katlı kıyafet bölmesi" },
                        { id: "rail_double", label: "Çift Askılık (Alt + Üst)", sub: "Gömlek & ceket bölmesi" },
                        { id: "rail_drawers_3", label: "Üst Askı + 3 Çekmece", sub: "Günlük kombine bölme" },
                        { id: "rail_trouser", label: "Askı + Pantolonluk", sub: "Häfele raylı pantolonluk" },
                        { id: "shoe_tower", label: "3 Raylı Ayakkabılık + Raf", sub: "Alt ayakkabı, üst raf" },
                      ].map((bp) => (
                        <button
                          key={bp.id}
                          type="button"
                          data-testid={`studio-bay-preset-${bp.id}`}
                          onClick={() => {
                            const snapshot =
                              interiorPreviewBanner?.snapshotBays ||
                              JSON.parse(JSON.stringify(activeModule.bays));
                            applyBayInteriorPreset(
                              activeBayIndex,
                              bp.id as
                                | "shelves_5"
                                | "rail_double"
                                | "rail_drawers_3"
                                | "rail_trouser"
                                | "shoe_tower"
                            );
                            setInteriorPreviewBanner({
                              templateName: `Bölme ${activeBayIndex + 1}: ${bp.label}`,
                              bayIndex: activeBayIndex,
                              snapshotBays: snapshot,
                            });
                          }}
                          className="p-2 rounded-xl bg-white hover:bg-[#E4ECF4] border border-[#CBD5E1] text-left transition cursor-pointer shadow-2xs"
                        >
                          <div className="text-[13px] font-bold text-[#111827] leading-tight">
                            {bp.label}
                          </div>
                          <div className="text-xs text-[#475569] mt-0.5">{bp.sub}</div>
                        </button>
                      ))}
                    </div>

                    {interiorPreviewBanner && (
                      <div
                        data-testid="studio-interior-preview-confirm-bar"
                        className="p-2.5 rounded-xl bg-white border-2 border-[#94A3B8] flex items-center justify-between gap-2 shadow-sm"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold uppercase text-[#475569]">
                            👁️ 3D Modelde Önizleniyor
                          </div>
                          <div className="text-[13px] font-bold text-[#111827] truncate">
                            {interiorPreviewBanner.templateName}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            data-testid="studio-confirm-interior-preview-btn"
                            onClick={() => setInteriorPreviewBanner(null)}
                            className="px-3 py-1.5 rounded-lg bg-[#EEF3F8] hover:bg-[#E4ECF4] text-[#111827] border border-[#94A3B8] text-[13px] font-bold cursor-pointer"
                          >
                            ✓ Uygula
                          </button>
                          <button
                            type="button"
                            data-testid="studio-cancel-interior-preview-btn"
                            onClick={() => {
                              restoreModuleBaysSnapshot(interiorPreviewBanner.snapshotBays);
                              setInteriorPreviewBanner(null);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#475569] text-[13px] font-semibold cursor-pointer"
                          >
                            ✕ Vazgeç
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-bold text-stone-700">
                      Ara Dikme (Dikey Bölme) Yönetimi
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        data-testid="studio-remove-divider-btn"
                        disabled={activeModule.bays.length <= 1}
                        onClick={() => removeBayAt(activeBayIndex)}
                        className="px-2 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 disabled:opacity-40 text-stone-700 text-[13px] font-bold cursor-pointer"
                        title="Son ara dikmeyi kaldır"
                      >
                        − Dikme Sil
                      </button>
                      <button
                        type="button"
                        data-testid="studio-add-divider-btn"
                        disabled={activeModule.bays.length >= 6}
                        onClick={() => splitBayIntoTwo(activeBayIndex)}
                        className="px-2.5 py-1 rounded-lg bg-[#EEF3F8] hover:bg-[#E4ECF4] text-[#1C1917] disabled:opacity-40 text-[#111827] text-[13px] font-bold flex items-center gap-1 cursor-pointer"
                        title="Dolap içine dikey ara dikme (bölme) ekle"
                      >
                        <Columns className="w-3 h-3" />
                        <span>+ Ara Dikme Ekle</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-5 gap-1.5">
                    {[1, 2, 3, 4, 5].map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        data-testid={`studio-bay-count-${cnt}`}
                        onClick={() => setBayCount(cnt)}
                        className={`h-9 rounded-xl font-mono text-[13px] font-bold transition cursor-pointer ${
                          activeModule.bays.length === cnt
                            ? "bg-[#EEF3F8] text-[#111827] shadow-xs"
                            : "bg-stone-100 hover:bg-stone-200 text-stone-700"
                        }`}
                      >
                        {cnt} Bölme
                      </button>
                    ))}
                  </div>

                  {/* V4 Wardrobe Interior Wizards */}
                  <div className="pt-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-stone-400 block mb-1">
                      Hızlı İç Düzen Sihirbazı (V4):
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {wardrobeWizards.map((wiz, wIdx) => (
                        <button
                          key={wiz.id}
                          type="button"
                          data-testid={`v4-wizard-${wiz.id}`}
                          onClick={() => {
                            const snapshot =
                              interiorPreviewBanner?.snapshotBays ||
                              JSON.parse(JSON.stringify(activeModule.bays));
                            applyWardrobeWizard(wiz.id);
                            setInteriorPreviewBanner({
                              templateName: wiz.name,
                              bayIndex: activeBayIndex,
                              snapshotBays: snapshot,
                            });
                          }}
                          className="p-2 rounded-xl bg-stone-50 hover:bg-[#F8FAFC] border border-stone-200 hover:border-amber-600 text-xs font-bold text-stone-800 flex flex-col items-center text-center gap-1 transition cursor-pointer"
                        >
                          <div className="p-1 rounded-lg bg-white border border-stone-200/80">
                            <V3IsometricModuleIcon
                              widthMm={800}
                              heightMm={2100}
                              depthMm={600}
                              bayCount={1}
                              hasDrawers={wIdx % 2 === 1}
                              isOpenFront={true}
                              size="md"
                            />
                          </div>
                          <span className="line-clamp-1">{wiz.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {activeModule.bays.length > 1 && (
                  <div className="space-y-2 pt-1">
                    <div className="flex gap-1 overflow-x-auto">
                      {activeModule.bays.map((b, idx) => (
                        <button
                          key={b.index}
                          type="button"
                          data-testid={`studio-select-bay-${idx}`}
                          onClick={() => setActiveBayIndex(idx)}
                          className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                            activeBayIndex === idx
                              ? "bg-[#EEF3F8] text-[#1C1917] border border-[#CBD5E1]"
                              : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                          }`}
                        >
                          Bölme {idx + 1} ({activeBreakdown.bayWidths[idx] || 0}mm)
                        </button>
                      ))}
                    </div>

                    <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/90 space-y-1.5">
                      <div className="flex items-center justify-between text-[13px]">
                        <span className="font-semibold text-stone-700">
                          Bölme {activeBayIndex + 1} İç Genişlik:
                        </span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            data-testid="studio-bay-width-input"
                            min={220}
                            max={Math.max(300, width - 260)}
                            step={10}
                            value={currentBayWidthMm}
                            onChange={(e) =>
                              setBayCustomWidth(activeBayIndex, Number(e.target.value))
                            }
                            className="w-16 px-1.5 py-0.5 rounded bg-white border border-stone-300 font-mono text-xs font-bold text-stone-900 text-center"
                          />
                          <span className="font-mono text-xs text-stone-500">mm</span>
                          <button
                            type="button"
                            onClick={() => setBayCustomWidth(activeBayIndex, null)}
                            title="Tüm bölmeleri eşit genişliğe sıfırla"
                            className="ml-1 px-1.5 py-0.5 rounded bg-stone-200 hover:bg-stone-300 text-xs font-semibold text-stone-700 cursor-pointer"
                          >
                            Eşitle
                          </button>
                        </div>
                      </div>
                      <input
                        type="range"
                        data-testid="studio-bay-width-slider"
                        min={220}
                        max={Math.max(300, width - 260)}
                        step={10}
                        value={currentBayWidthMm}
                        onChange={(e) =>
                          setBayCustomWidth(activeBayIndex, Number(e.target.value))
                        }
                        className="w-full accent-[#64748B] h-1.5 bg-stone-200 rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>
                )}

                {activeBay && (
                  <div className="space-y-2.5 pt-2 border-t border-stone-200/80">
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        data-testid="studio-add-shelf-btn"
                        onClick={() => addShelf(activeBayIndex)}
                        className="min-h-[42px] px-2 py-2 rounded-xl bg-stone-100 hover:bg-[#F8FAFC] border border-stone-200 text-stone-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <Layers className="w-3.5 h-3.5 text-[#57534E]" />
                        <span>+ Raf ({activeBay.shelves.length})</span>
                      </button>
                      <button
                        type="button"
                        data-testid="studio-add-subdivider-btn"
                        onClick={() => addSubDivider(activeBayIndex)}
                        className="min-h-[42px] px-2 py-2 rounded-xl bg-[#F8FAFC] hover:bg-amber-100 border border-[#CBD5E1] text-stone-900 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                        title="İki raf arasına dikey ara dikme (bölücü) ekle"
                      >
                        <Columns className="w-3.5 h-3.5 text-[#57534E]" />
                        <span>+ Raf Arası Dikme ({activeBay.subDividers?.length || 0})</span>
                      </button>
                      <button
                        type="button"
                        data-testid="studio-add-drawer-btn"
                        onClick={() => addDrawer(activeBayIndex)}
                        className="min-h-[42px] px-2 py-2 rounded-xl bg-stone-100 hover:bg-[#F8FAFC] border border-stone-200 text-stone-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 text-[#57534E]" />
                        <span>+ Çekmece ({activeBay.drawers.length})</span>
                      </button>
                      <button
                        type="button"
                        data-testid="studio-add-rail-btn"
                        onClick={() => addHangingRail(activeBayIndex)}
                        className="min-h-[42px] px-2 py-2 rounded-xl bg-stone-100 hover:bg-[#F8FAFC] border border-stone-200 text-stone-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <Shirt className="w-3.5 h-3.5 text-[#57534E]" />
                        <span>+ Askı ({activeBay.hangingRails.length})</span>
                      </button>
                    </div>

                    {/* CABINET LED LIGHTING SYSTEM PICKER (HÄFELE LOOX5 3000K + 24V TRAFO & IR SENSOR) */}
                    <div
                      data-testid="studio-led-system-picker"
                      className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-[#2C2A29]">
                          💡 Dolap İçi LED Aydınlatma (Häfele Loox5 3000K)
                        </span>
                        <span className="text-xs font-mono text-[#57534E] font-bold">
                          +24V Trafo & IR Sensör Otomatik
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 p-0.5">
                        {[
                          {
                            type: "led_profile",
                            label: "Raf & Üst LED",
                            sub: "Yatay Gömme Kanal",
                          },
                          {
                            type: "led_vertical_strip",
                            label: "Dikme Boy LED",
                            sub: "Sağ/Sol Dikey Kanal",
                          },
                          {
                            type: "led_rod_strip",
                            label: "LED Askı Borusu",
                            sub: "Sensörlü Askı LED",
                          },
                        ].map((ledOpt) => (
                          <button
                            key={ledOpt.type}
                            type="button"
                            data-testid={`studio-add-led-${ledOpt.type}`}
                            onClick={() =>
                              addSpecialFitting(
                                activeBayIndex,
                                ledOpt.type as import("@birim/core").SpecialFittingConfig["type"]
                              )
                            }
                            className="p-2 rounded-xl bg-white hover:bg-amber-600 hover:text-white border border-[#CBD5E1] text-stone-900 flex flex-col items-center text-center transition cursor-pointer group"
                          >
                            <span className="text-xs font-bold">💡 + {ledOpt.label}</span>
                            <span className="text-xs text-stone-500 group-hover:text-[#57534E] mt-0.5">
                              {ledOpt.sub}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* WORLD-BRAND INTERIOR ACCESSORIES VISUAL PICKER */}
                    <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/90 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-[#2C2A29]">
                          Dünya Markaları İç Aksesuarlar ({activeBay.specialFittings?.length || 0})
                        </span>
                        <span className="text-xs font-mono text-stone-500">
                          Häfele • Kesseböhmer • Blum • Servetto
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { type: "trouser_rack", brand: "Häfele", label: "Pantolonluk", sku: "807.95.122" },
                          { type: "shoe_rack", brand: "Häfele", label: "Ayakkabılık", sku: "807.96.310" },
                          { type: "wardrobe_lift", brand: "Servetto", label: "Asansör 10kg", sku: "805.20.232" },
                          { type: "wire_basket", brand: "Häfele", label: "Tel Sepet", sku: "807.52.220" },
                          { type: "corner_lemans", brand: "Kesseböhmer", label: "LeMans II Köşe", sku: "541.32.240" },
                          { type: "pantry_pullout", brand: "Kesseböhmer", label: "Dispensa Kiler", sku: "545.13.251" },
                          { type: "waste_bin", brand: "Häfele", label: "Çöp Sistemi", sku: "502.70.252" },
                          { type: "spice_pullout", brand: "Kesseböhmer", label: "Dar Şişelik", sku: "545.61.211" },
                        ].map((acc) => (
                          <button
                            key={acc.type}
                            type="button"
                            data-testid={`studio-add-fitting-${acc.type}`}
                            onClick={() =>
                              addSpecialFitting(
                                activeBayIndex,
                                acc.type as import("@birim/core").SpecialFittingConfig["type"]
                              )
                            }
                            className="p-1.5 rounded-xl bg-white hover:bg-[#F8FAFC] border border-stone-200/90 hover:border-amber-600/60 flex items-center gap-1.5 text-left transition cursor-pointer"
                            title={`${acc.brand} ${acc.label} [${acc.sku}] Ekle`}
                          >
                            <div className="w-7 h-7 rounded-lg bg-amber-100/70 border border-[#CBD5E1] flex items-center justify-center shrink-0">
                              <svg viewBox="0 0 24 24" className="w-4 h-4 text-[#2C2A29]">
                                <rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
                                <line x1="6" y1="10" x2="18" y2="10" stroke="currentColor" strokeWidth="1.6" />
                                <line x1="6" y1="14" x2="18" y2="14" stroke="currentColor" strokeWidth="1.6" />
                              </svg>
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-bold uppercase text-[#57534E] block leading-none">
                                + {acc.brand}
                              </span>
                              <span className="text-xs font-bold text-stone-900 truncate block">
                                {acc.label}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-stone-800">
                          🚪 Bölme {activeBayIndex + 1} Kapak Açılış Yönü
                        </span>
                        <button
                          type="button"
                          data-testid="studio-flip-door-direction-btn"
                          onClick={() => flipActiveDoorDirection(activeBayIndex)}
                          className="px-2 py-0.5 rounded-lg bg-[#F1F5F9] hover:bg-[#E6E1D6] border border-[#CBD5E1] text-[#1C1917] text-xs font-extrabold cursor-pointer"
                          title="Kapak menteşe ve açılış yönünü (Sol ⇄ Sağ) tek tıkla çevir"
                        >
                          🔄 Yön Çevir (Sol ⇄ Sağ)
                        </button>
                      </div>
                      <div className="grid grid-cols-4 gap-1">
                        {[
                          { id: "single_left", label: "⬅️ Sol Açılır", sub: "Sol Menteşe" },
                          { id: "single_right", label: "➡️ Sağ Açılır", sub: "Sağ Menteşe" },
                          { id: "double", label: "↔️ Çift Kapak", sub: "2 Kanat" },
                          { id: "open", label: "☐ Açık", sub: "Kapaksız" },
                        ].map((dt) => (
                          <button
                            key={dt.id}
                            type="button"
                            data-testid={`studio-door-dir-${dt.id}`}
                            onClick={() =>
                              setBayDoorType(
                                activeBayIndex,
                                dt.id as "single_left" | "single_right" | "double" | "open"
                              )
                            }
                            className={`py-1.5 px-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex flex-col items-center text-center border ${
                              activeBay.door.type === dt.id
                                ? "bg-[#EEF3F8] text-[#1C1917] border border-[#CBD5E1] border-[#1C1917] shadow-2xs"
                                : "bg-white hover:bg-[#F8FAFC] text-stone-700 border-stone-200"
                            }`}
                          >
                            <span>{dt.label}</span>
                            <span className={`text-xs font-normal ${activeBay.door.type === dt.id ? "text-emerald-100" : "text-stone-400"}`}>
                              {dt.sub}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Interactive Interior Element Position & Dimension Controls */}
                    {(activeBay.shelves.length > 0 ||
                      (activeBay.subDividers?.length || 0) > 0 ||
                      activeBay.drawers.length > 0 ||
                      activeBay.hangingRails.length > 0 ||
                      (activeBay.specialFittings?.length || 0) > 0) && (
                      <div className="space-y-2 max-h-72 overflow-y-auto pt-1 pr-0.5">
                        <div className="text-xs font-bold uppercase tracking-wider text-stone-400">
                          İç Eleman Konum & Ölçü Ayarları (Bölme {activeBayIndex + 1})
                        </div>

                        {/* SUB-DIVIDERS */}
                        {(activeBay.subDividers || []).map((sd, i) => {
                          const rawIvs = getBayShelfIntervalsForSubDivider(
                            activeBay,
                            netInnerHeightMm,
                            activeModule.carcass.panelThickness || 18
                          );
                          const shelfSpans = rawIvs.map((iv) => ({
                            label: iv.label,
                            elevY: iv.botY,
                            height: iv.height,
                            hasConflict: iv.hasConflict,
                            conflictReason: iv.conflictReason,
                          }));

                          return (
                            <div
                              key={sd.id}
                              data-testid={`studio-subdivider-item-${i}`}
                              className="p-2.5 rounded-xl bg-amber-100/70 border border-amber-400 space-y-2 text-[13px]"
                            >
                              <div className="flex items-center justify-between gap-1">
                                <div>
                                  <span className="text-stone-900 font-bold block">
                                    Raf Arası Dikme #{i + 1}
                                  </span>
                                  <span className="text-xs font-mono text-stone-600">
                                    Sol X: {sd.offsetX}mm • Alt Y: {sd.elevationY}mm • Boy H:{" "}
                                    {sd.height}mm
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeSubDivider(activeBayIndex, sd.id)}
                                  className="text-stone-400 hover:text-red-600 p-0.5 cursor-pointer"
                                  title="Raf Arası Dikmeyi Sil"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              {shelfSpans.length > 0 && (
                                <div className="space-y-1">
                                  <span className="text-xs font-semibold text-stone-700 block">
                                    Hangi Raflar Arasında? (Tek Tıkla Oturt):
                                  </span>
                                  <div className="flex flex-wrap gap-1">
                                    {shelfSpans.map((sp, spIdx) => {
                                      const isSelected =
                                        Math.abs(sd.elevationY - sp.elevY) <= 5 &&
                                        Math.abs(sd.height - sp.height) <= 5;
                                      return (
                                        <button
                                          key={sp.label}
                                          type="button"
                                          disabled={sp.hasConflict}
                                          data-testid={`studio-subdivider-span-${i}-${spIdx}`}
                                          onClick={() => {
                                            if (sp.hasConflict) return;
                                            setSubDividerPlacement(activeBayIndex, sd.id, {
                                              elevationY: sp.elevY,
                                              height: sp.height,
                                            });
                                          }}
                                          title={
                                            sp.hasConflict
                                              ? `Bu aralıkta ${sp.conflictReason} bulunduğu için dikme konulamaz`
                                              : `${sp.label} aralığına taşı`
                                          }
                                          className={`px-2 py-1 rounded-lg text-xs font-bold transition ${
                                            sp.hasConflict
                                              ? "bg-red-50 text-red-400 border border-red-200 cursor-not-allowed line-through"
                                              : isSelected
                                              ? "bg-blue-600 text-white border border-blue-700 cursor-pointer shadow-2xs"
                                              : "bg-white hover:bg-stone-100 border border-stone-300 text-stone-700 cursor-pointer"
                                          }`}
                                        >
                                          {sp.hasConflict ? `🔒 ${sp.label}` : sp.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              <div className="grid grid-cols-3 gap-1">
                                <div className="bg-white px-1.5 py-1 rounded-lg border border-stone-300">
                                  <span className="text-xs font-semibold text-stone-500 block">
                                    Sol Konum (X)
                                  </span>
                                  <div className="flex items-center justify-between">
                                    <input
                                      type="number"
                                      data-testid={`studio-subdivider-x-input-${i}`}
                                      min={50}
                                      max={Math.max(80, currentBayWidthMm - 68)}
                                      step={10}
                                      value={sd.offsetX}
                                      onChange={(e) =>
                                        setSubDividerPlacement(activeBayIndex, sd.id, {
                                          offsetX: Number(e.target.value),
                                        })
                                      }
                                      className="w-12 font-mono text-xs font-bold text-stone-900"
                                    />
                                    <span className="text-xs text-stone-400">mm</span>
                                  </div>
                                </div>

                                <div className="bg-white px-1.5 py-1 rounded-lg border border-stone-300">
                                  <span className="text-xs font-semibold text-stone-500 block">
                                    Alt Başlangıç (Y)
                                  </span>
                                  <div className="flex items-center justify-between">
                                    <input
                                      type="number"
                                      data-testid={`studio-subdivider-y-input-${i}`}
                                      min={0}
                                      max={Math.max(0, netInnerHeightMm - 80)}
                                      step={10}
                                      value={sd.elevationY}
                                      onChange={(e) =>
                                        setSubDividerPlacement(activeBayIndex, sd.id, {
                                          elevationY: Number(e.target.value),
                                        })
                                      }
                                      className="w-12 font-mono text-xs font-bold text-stone-900"
                                    />
                                    <span className="text-xs text-stone-400">mm</span>
                                  </div>
                                </div>

                                <div className="bg-white px-1.5 py-1 rounded-lg border border-stone-300">
                                  <span className="text-xs font-semibold text-stone-500 block">
                                    Dikme Boyu (H)
                                  </span>
                                  <div className="flex items-center justify-between">
                                    <input
                                      type="number"
                                      data-testid={`studio-subdivider-h-input-${i}`}
                                      min={80}
                                      max={Math.max(80, netInnerHeightMm - sd.elevationY)}
                                      step={10}
                                      value={sd.height}
                                      onChange={(e) =>
                                        setSubDividerPlacement(activeBayIndex, sd.id, {
                                          height: Number(e.target.value),
                                        })
                                      }
                                      className="w-12 font-mono text-xs font-bold text-stone-900"
                                    />
                                    <span className="text-xs text-stone-400">mm</span>
                                  </div>
                                </div>
                              </div>

                              <input
                                type="range"
                                data-testid={`studio-subdivider-x-slider-${i}`}
                                min={50}
                                max={Math.max(80, currentBayWidthMm - 68)}
                                step={10}
                                value={sd.offsetX}
                                onChange={(e) =>
                                  setSubDividerPlacement(activeBayIndex, sd.id, {
                                    offsetX: Number(e.target.value),
                                  })
                                }
                                className="w-full accent-[#64748B] h-1.5 bg-stone-200 rounded-lg cursor-pointer"
                              />
                            </div>
                          );
                        })}

                        {/* SHELVES */}
                        {activeBay.shelves.map((s, i) => (
                          <div
                            key={s.id}
                            data-testid={`studio-shelf-item-${i}`}
                            className="p-2 rounded-xl bg-[#F8FAFC]/50 border border-[#E2E8F0]/80 space-y-1.5 text-[13px]"
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-stone-800 font-bold">
                                Raf #{i + 1}
                              </span>
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-stone-500">Y:</span>
                                <input
                                  type="number"
                                  data-testid={`studio-shelf-elev-input-${i}`}
                                  min={60}
                                  max={Math.max(100, netInnerHeightMm - 60)}
                                  step={10}
                                  value={s.elevationY}
                                  onChange={(e) =>
                                    setShelfElevation(
                                      activeBayIndex,
                                      s.id,
                                      Number(e.target.value)
                                    )
                                  }
                                  className="w-16 px-1 py-0.5 rounded bg-white border border-stone-300 font-mono text-xs font-bold text-stone-900 text-center"
                                />
                                <span className="font-mono text-xs text-stone-500">mm</span>
                                {activeModule.bays.length > 1 && (
                                  <select
                                    aria-label="Rafı başka bölmeye taşı"
                                    value={activeBayIndex}
                                    onChange={(e) =>
                                      moveInteriorItemToBay(
                                        "shelf",
                                        activeBayIndex,
                                        s.id,
                                        Number(e.target.value)
                                      )
                                    }
                                    className="px-1 py-0.5 rounded bg-white border border-stone-300 text-xs font-semibold text-stone-700 cursor-pointer"
                                  >
                                    {activeModule.bays.map((b, bIdx) => (
                                      <option key={b.index} value={bIdx}>
                                        B{bIdx + 1}
                                      </option>
                                    ))}
                                  </select>
                                )}
                                <button
                                  type="button"
                                  onClick={() => removeShelf(activeBayIndex, s.id)}
                                  className="text-stone-400 hover:text-red-600 p-0.5 cursor-pointer"
                                  title="Rafı Sil"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            <input
                              type="range"
                              data-testid={`studio-shelf-elev-slider-${i}`}
                              min={60}
                              max={Math.max(100, netInnerHeightMm - 60)}
                              step={10}
                              value={s.elevationY}
                              onChange={(e) =>
                                setShelfElevation(
                                  activeBayIndex,
                                  s.id,
                                  Number(e.target.value)
                                )
                              }
                              className="w-full accent-[#64748B] h-1.5 bg-stone-200 rounded-lg cursor-pointer"
                            />
                          </div>
                        ))}

                        {/* SPECIAL FITTINGS (WORLD-BRAND ACCESSORIES & RECESSED LEDS) */}
                        {(activeBay.specialFittings || []).map((fit, fIdx) => {
                          const isLedItem = fit.type.startsWith("led_");
                          const isVertLed = fit.type === "led_vertical_strip";
                          const itemW = fit.width ?? (isVertLed ? 14 : Math.max(60, currentBayWidthMm - 12));
                          const itemD = fit.depth ?? (isVertLed ? 75 : 18);
                          return (
                            <div
                              key={fit.id}
                              data-testid={`studio-fitting-item-${fIdx}`}
                              className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-300 space-y-1.5 text-[13px]"
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-emerald-950 font-bold">
                                  {isLedItem ? "💡 Gömme LED" : "🛠️ Aksesuar"} #{fIdx + 1}: {fit.type}
                                </span>
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-stone-600">Y:</span>
                                  <input
                                    type="number"
                                    data-testid={`studio-fitting-elev-input-${fIdx}`}
                                    min={20}
                                    max={Math.max(100, netInnerHeightMm - fit.height)}
                                    step={10}
                                    value={fit.elevationY}
                                    onChange={(e) =>
                                      setSpecialFittingPlacement(activeBayIndex, fit.id, {
                                        elevationY: Number(e.target.value),
                                      })
                                    }
                                    className="w-14 px-1 py-0.5 rounded bg-white border border-stone-300 font-mono text-xs font-bold text-stone-900 text-center"
                                  />
                                  <span className="text-xs text-stone-500">mm</span>
                                  <button
                                    type="button"
                                    onClick={() => removeSpecialFitting(activeBayIndex, fit.id)}
                                    className="text-stone-400 hover:text-red-600 p-0.5 cursor-pointer"
                                    title="Aksesuarı Kaldır"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                              {isLedItem && (
                                <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-emerald-200/80">
                                  <label className="flex items-center justify-between bg-white px-2 py-1 rounded border border-stone-200">
                                    <span className="text-xs font-bold text-stone-600">Genişlik(W):</span>
                                    <input
                                      type="number"
                                      min={6}
                                      max={2400}
                                      step={isVertLed ? 2 : 10}
                                      value={itemW}
                                      onChange={(e) =>
                                        setSpecialFittingPlacement(activeBayIndex, fit.id, {
                                          width: Number(e.target.value),
                                        })
                                      }
                                      className="w-14 font-mono text-xs font-bold text-stone-900 text-right"
                                    />
                                  </label>
                                  <label className="flex items-center justify-between bg-white px-2 py-1 rounded border border-stone-200">
                                    <span className="text-xs font-bold text-stone-600">Derinlik(D):</span>
                                    <input
                                      type="number"
                                      min={6}
                                      max={800}
                                      step={isVertLed ? 5 : 2}
                                      value={itemD}
                                      onChange={(e) =>
                                        setSpecialFittingPlacement(activeBayIndex, fit.id, {
                                          depth: Number(e.target.value),
                                        })
                                      }
                                      className="w-14 font-mono text-xs font-bold text-stone-900 text-right"
                                    />
                                  </label>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* DRAWERS */}
                        {activeBay.drawers.map((d, i) => {
                          const activeRunnerId = d.hardwareProductId || "hw_blum_legrabox_m40";
                          const activeNl = d.nominalLengthMm || Math.min(500, Math.max(350, Math.floor((depth - 50) / 50) * 50));
                          const runnerFormula =
                            activeRunnerId === "hw_hettich_avantech_m"
                              ? { brand: "Hettich AvanTech YOU", botDed: 24, backDed: 24, lenDed: 21 }
                              : activeRunnerId.includes("tandembox")
                              ? { brand: "Blum TANDEMBOX", botDed: 75, backDed: 87, lenDed: 24 }
                              : activeRunnerId.includes("movento")
                              ? { brand: "Blum MOVENTO 760H", botDed: 42, backDed: 42, lenDed: 10 }
                              : { brand: "Blum LEGRABOX pure", botDed: 35, backDed: 38, lenDed: 10 };
                          const netBottomW = Math.max(80, currentBayWidthMm - runnerFormula.botDed);
                          const netBackW = Math.max(80, currentBayWidthMm - runnerFormula.backDed);
                          const netBottomD = Math.max(120, Math.min(depth - 35, activeNl - runnerFormula.lenDed));
                          return (
                          <div
                            key={d.id}
                            data-testid={`studio-drawer-item-${i}`}
                            className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1]/90 space-y-2 text-[13px]"
                          >
                            <div className="flex items-center justify-between gap-1">
                              <div>
                                <span className="text-stone-900 font-bold block">
                                  Çekmece #{i + 1} ({runnerFormula.brand})
                                </span>
                                <span
                                  data-testid={`studio-drawer-net-cut-${i}`}
                                  className="text-xs font-mono text-[#2C2A29] font-bold block"
                                >
                                  Taban Kesim: {netBottomW}×{netBottomD}mm (LW-{runnerFormula.botDed}) • Arkalık: {netBackW}mm
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                {activeModule.bays.length > 1 && (
                                  <select
                                    aria-label="Çekmeceyi başka bölmeye taşı"
                                    value={activeBayIndex}
                                    onChange={(e) =>
                                      moveInteriorItemToBay(
                                        "drawer",
                                        activeBayIndex,
                                        d.id,
                                        Number(e.target.value)
                                      )
                                    }
                                    className="px-1.5 py-0.5 rounded bg-white border border-stone-300 text-xs font-semibold text-stone-700 cursor-pointer"
                                  >
                                    {activeModule.bays.map((b, bIdx) => (
                                      <option key={b.index} value={bIdx}>
                                        Bölme {bIdx + 1}
                                      </option>
                                    ))}
                                  </select>
                                )}
                                <button
                                  type="button"
                                  onClick={() => removeDrawer(activeBayIndex, d.id)}
                                  className="text-stone-400 hover:text-red-600 p-0.5 cursor-pointer"
                                  title="Çekmeceyi Sil"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <div className="space-y-1">
                              <span className="text-xs font-semibold text-stone-600 block">
                                Çekmece Kapak Yüksekliği (H):
                              </span>
                              <div className="grid grid-cols-4 gap-1">
                                {[140, 180, 240, 300].map((presetH) => (
                                  <button
                                    key={presetH}
                                    type="button"
                                    onClick={() =>
                                      setDrawerPlacement(
                                        activeBayIndex,
                                        d.id,
                                        undefined,
                                        presetH
                                      )
                                    }
                                    className={`py-1 rounded-lg font-mono text-xs font-bold transition cursor-pointer ${
                                      d.height === presetH
                                        ? "bg-[#EEF3F8] text-[#1C1917] border border-[#CBD5E1]"
                                        : "bg-white hover:bg-stone-100 border border-stone-200 text-stone-700"
                                    }`}
                                  >
                                    {presetH}mm
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-1.5">
                              <div className="flex items-center justify-between bg-white px-2 py-1 rounded-lg border border-stone-300">
                                <span className="text-xs font-semibold text-stone-600">
                                  Yükseklik (H):
                                </span>
                                <input
                                  type="number"
                                  data-testid={`studio-drawer-height-input-${i}`}
                                  min={100}
                                  max={420}
                                  step={10}
                                  value={d.height}
                                  onChange={(e) =>
                                    setDrawerPlacement(
                                      activeBayIndex,
                                      d.id,
                                      undefined,
                                      Number(e.target.value)
                                    )
                                  }
                                  className="w-14 font-mono text-xs font-bold text-stone-900 text-right"
                                />
                                <span className="text-xs text-stone-400">mm</span>
                              </div>

                              <div className="flex items-center justify-between bg-white px-2 py-1 rounded-lg border border-stone-300">
                                <span className="text-xs font-semibold text-stone-600">
                                  Yerden (Y):
                                </span>
                                <input
                                  type="number"
                                  data-testid={`studio-drawer-elev-input-${i}`}
                                  min={0}
                                  max={Math.max(0, netInnerHeightMm - d.height)}
                                  step={10}
                                  value={d.elevationY}
                                  onChange={(e) =>
                                    setDrawerPlacement(
                                      activeBayIndex,
                                      d.id,
                                      Number(e.target.value),
                                      undefined
                                    )
                                  }
                                  className="w-14 font-mono text-xs font-bold text-stone-900 text-right"
                                />
                                <span className="text-xs text-stone-400">mm</span>
                              </div>
                            </div>

                            <input
                              type="range"
                              data-testid={`studio-drawer-elev-slider-${i}`}
                              min={0}
                              max={Math.max(0, netInnerHeightMm - d.height)}
                              step={10}
                              value={d.elevationY}
                              onChange={(e) =>
                                setDrawerPlacement(
                                  activeBayIndex,
                                  d.id,
                                  Number(e.target.value),
                                  undefined
                                )
                              }
                              className="w-full accent-[#64748B] h-1.5 bg-stone-200 rounded-lg cursor-pointer"
                            />

                            {/* Runner Brand & Cutting Deduction Selector */}
                            <div className="pt-1 border-t border-[#E2E8F0]/80 space-y-1.5">
                              <span className="text-xs font-bold text-stone-700 block">
                                Ray Sistemi Markası (Kesim & Çizim Ölçüsünü Değiştirir):
                              </span>
                              <div className="grid grid-cols-2 gap-1">
                                {[
                                  { id: "hw_blum_legrabox_m40", label: "Blum LEGRABOX (-35mm)" },
                                  { id: "hw_hettich_avantech_m", label: "Hettich AvanTech (-24mm)" },
                                  { id: "hw_blum_movento_760h", label: "Blum MOVENTO (-42mm)" },
                                  { id: "hw_blum_tandembox_m30", label: "Blum TANDEMBOX (-75mm)" },
                                ].map((runOpt) => (
                                  <button
                                    key={runOpt.id}
                                    type="button"
                                    data-testid={`studio-drawer-runner-${i}-${runOpt.id}`}
                                    onClick={() =>
                                      setDrawerPlacement(
                                        activeBayIndex,
                                        d.id,
                                        undefined,
                                        undefined,
                                        true,
                                        {
                                          hardwareProductId: runOpt.id,
                                          nominalLengthMm: activeNl,
                                        }
                                      )
                                    }
                                    className={`px-1.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                                      activeRunnerId === runOpt.id
                                        ? "bg-[#EEF3F8] text-[#111827]"
                                        : "bg-white hover:bg-stone-100 border border-stone-300 text-stone-700"
                                    }`}
                                  >
                                    {runOpt.label}
                                  </button>
                                ))}
                              </div>
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-xs font-semibold text-stone-600">
                                  Ray Boyu (NL):
                                </span>
                                <div className="flex gap-1">
                                  {[350, 400, 450, 500, 550]
                                    .filter((nl) => nl <= depth - 20)
                                    .map((nl) => (
                                      <button
                                        key={nl}
                                        type="button"
                                        data-testid={`studio-drawer-nl-${i}-${nl}`}
                                        onClick={() =>
                                          setDrawerPlacement(
                                            activeBayIndex,
                                            d.id,
                                            undefined,
                                            undefined,
                                            true,
                                            {
                                              hardwareProductId: activeRunnerId,
                                              nominalLengthMm: nl,
                                            }
                                          )
                                        }
                                        className={`px-1.5 py-0.5 rounded font-mono text-xs font-bold cursor-pointer ${
                                          activeNl === nl
                                            ? "bg-[#EEF3F8] text-[#1C1917] border border-[#CBD5E1]"
                                            : "bg-white border border-stone-300 text-stone-700"
                                        }`}
                                      >
                                        {nl}
                                      </button>
                                    ))}
                                </div>
                              </div>
                            </div>
                          </div>
                          );
                        })}

                        {/* HANGING RAILS */}
                        {activeBay.hangingRails.map((r, i) => (
                          <div
                            key={r.id}
                            data-testid={`studio-rail-item-${i}`}
                            className="p-2 rounded-xl bg-stone-50 border border-stone-200/90 space-y-1.5 text-[13px]"
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-stone-800 font-bold">
                                Askı Borusu #{i + 1}
                              </span>
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-stone-500">Y:</span>
                                <input
                                  type="number"
                                  data-testid={`studio-rail-elev-input-${i}`}
                                  min={300}
                                  max={Math.max(400, netInnerHeightMm - 40)}
                                  step={10}
                                  value={r.elevationY}
                                  onChange={(e) =>
                                    setHangingRailElevation(
                                      activeBayIndex,
                                      r.id,
                                      Number(e.target.value)
                                    )
                                  }
                                  className="w-16 px-1 py-0.5 rounded bg-white border border-stone-300 font-mono text-xs font-bold text-stone-900 text-center"
                                />
                                <span className="font-mono text-xs text-stone-500">mm</span>
                                {activeModule.bays.length > 1 && (
                                  <select
                                    aria-label="Askı borusunu başka bölmeye taşı"
                                    value={activeBayIndex}
                                    onChange={(e) =>
                                      moveInteriorItemToBay(
                                        "rail",
                                        activeBayIndex,
                                        r.id,
                                        Number(e.target.value)
                                      )
                                    }
                                    className="px-1 py-0.5 rounded bg-white border border-stone-300 text-xs font-semibold text-stone-700 cursor-pointer"
                                  >
                                    {activeModule.bays.map((b, bIdx) => (
                                      <option key={b.index} value={bIdx}>
                                        B{bIdx + 1}
                                      </option>
                                    ))}
                                  </select>
                                )}
                                <button
                                  type="button"
                                  onClick={() => removeHangingRail(activeBayIndex, r.id)}
                                  className="text-stone-400 hover:text-red-600 p-0.5 cursor-pointer"
                                  title="Askı Borusunu Sil"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            <input
                              type="range"
                              data-testid={`studio-rail-elev-slider-${i}`}
                              min={300}
                              max={Math.max(400, netInnerHeightMm - 40)}
                              step={10}
                              value={r.elevationY}
                              onChange={(e) =>
                                setHangingRailElevation(
                                  activeBayIndex,
                                  r.id,
                                  Number(e.target.value)
                                )
                              }
                              className="w-full accent-[#64748B] h-1.5 bg-stone-200 rounded-lg cursor-pointer"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </V3CollapsibleSection>
              )}

              {/* EKRAN 3: KAPAK VE KULP — YENİDEN TASARLANMIŞ SAĞ PANEL (Matches image_e5c524.jpg 1-to-1) */}
              {!isSimpleBlumMode && activeBay && studioInspectorTab === "door" && (() => {
                const curProf =
                  activeBay.door.crossSectionProfile ||
                  activeModule.carcass.crossSectionProfile ||
                  "flat_slab";
                const curSys = activeBay.door.doorSystemId || "hinged_single";
                const curDir = activeBay.door.type || "single_left";
                const curHandleSku = activeBay.door.handleProfileId || "K019";
                const curHandleCat = activeBay.door.handleCategory || "bar_handle";
                const curHandleOrient = activeBay.door.handleOrientation || "auto";
                const curHandleLen = activeBay.door.handleLengthMm || (height >= 1400 ? 256 : 192);
                const curHandleOffY =
                  activeBay.door.handleOffsetY ??
                  (height >= 1400 ? Math.max(120, Math.min(height - 260, 1020)) : Math.round(height * 0.5));
                const curHandleInsetX = activeBay.door.handleEdgeInsetX ?? 42;
                const curDoorThick =
                  activeBay.door.doorThicknessMm || activeModule.carcass.doorThickness || 18;
                const curDoorEdgeBand =
                  activeBay.door.doorEdgeBandThicknessMm ||
                  activeModule.carcass.edgeBandThickness ||
                  1;
                const isSoftClose =
                  activeBay.door.softClose !== false &&
                  activeBay.door.openingTechnology !== "manual_standard" &&
                  activeBay.door.openingTechnology !== "push_to_open";

                const selectedDoorLeafId =
                  selectedComponentId && selectedComponentId.includes("door")
                    ? selectedComponentId
                    : `${activeBay.door.id}_${curDir.includes("right") ? "right" : curDir === "double" ? "leaf_left" : "left"}`;

                const effectiveDoorMatId =
                  (selectedComponentId &&
                    selectedComponentId.includes("door") &&
                    activeModule.componentMaterialOverrides?.[selectedComponentId]) ||
                  activeBay.door.doorMaterialId ||
                  activeModule.carcass.doorMaterialId ||
                  "mat_veneer_oak";
                const activeDoorMatObj =
                  DEFAULT_MATERIALS.find((m) => m.id === effectiveDoorMatId) ||
                  DEFAULT_MATERIALS.find((m) => m.id === "mat_veneer_oak") ||
                  DEFAULT_MATERIALS[2];

                const isLiftCompatible =
                  height <= 1150 ||
                  activeModule.category === "kitchen_wall" ||
                  activeModule.moduleFamilyId === "fam_kitchen_wall";
                const isSlidingCompatible = activeModule.bays.length >= 2 || width >= 900;

                return (
                  <div
                    data-testid="studio-door-screen3-panel"
                    className="space-y-4 text-xs"
                  >
                    {/* Seçili Kapak & Bölme Senkronizasyon Barı */}
                    <div className="p-2.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-xs font-bold uppercase tracking-wider text-[#64748B] block">
                            3D Seçili Kapak Senkronu
                          </span>
                          <span className="text-xs font-bold text-[#111827] truncate block">
                            Bölme {activeBayIndex + 1} Kapağı{" "}
                            {selectedComponentId && selectedComponentId.includes("door")
                              ? selectedComponentId.includes("right")
                                ? "(Sağ Kanat)"
                                : "(Sol Kanat)"
                              : `(${currentBayWidthMm} mm)`}
                          </span>
                        </div>
                        <button
                          type="button"
                          data-testid="door-screen3-apply-all-btn"
                          onClick={() => {
                            copyDoorConfigToAllBays(activeBayIndex);
                            setDoorCompatWarningMsg(null);
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-[#EEF3F8] hover:bg-[#E2E8F0] text-[#111827] border border-[#CBD5E1] text-xs font-bold shrink-0 cursor-pointer transition"
                          title="Seçili kapağın tip, kulp ve malzeme ayarlarını modüldeki tüm uygun kapaklara kopyala"
                        >
                          Tüm Kapaklara Uygula
                        </button>
                      </div>

                      {activeModule.bays.length > 1 && (
                        <div className="flex items-center gap-1 overflow-x-auto pt-1 border-t border-[#E2E8F0]">
                          {activeModule.bays.map((b, bIdx) => {
                            const isSelBay = activeBayIndex === bIdx;
                            return (
                              <button
                                key={b.index}
                                type="button"
                                data-testid={`door-screen3-bay-tab-${bIdx}`}
                                onClick={() => setActiveBayIndex(bIdx)}
                                className={`flex-1 py-1 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                                  isSelBay
                                    ? "bg-[#2563EB] text-white shadow-2xs"
                                    : "bg-white hover:bg-[#EEF3F8] text-[#475569] border border-[#E2E8F0]"
                                }`}
                              >
                                Kapak {bIdx + 1}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* GRUP 1: KAPAK TİPİ (5 Görselli Kart: Düz | Çerçeve | Fitilli | Cam | Ayna — Matches image_e5c524.jpg) */}
                    <section data-testid="door-group-type" className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-[#111827]">Kapak Tipi</h3>
                        <span className="text-xs font-medium text-[#64748B]">
                          {curProf === "flat_slab"
                            ? "Düz Plaka"
                            : curProf === "shaker_frame"
                            ? "Shaker Çerçeve"
                            : curProf === "fluted_ribbed"
                            ? "CNC Fitilli / Çıtalı"
                            : curProf === "glass_frame"
                            ? "Cam Vitrin"
                            : curProf === "mirror_door"
                            ? "Boy Aynalı"
                            : "Özel Kesit"}
                        </span>
                      </div>
                      <div className="grid grid-cols-5 gap-1.5">
                        {[
                          {
                            id: "flat_slab",
                            label: "Düz",
                            svg: (
                              <svg viewBox="0 0 36 48" className="w-7 h-9" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <rect x="6" y="4" width="24" height="40" rx="2" />
                                <line x1="12" y1="6" x2="12" y2="42" strokeOpacity="0.35" />
                                <line x1="18" y1="6" x2="18" y2="42" strokeOpacity="0.35" />
                                <line x1="24" y1="6" x2="24" y2="42" strokeOpacity="0.35" />
                              </svg>
                            ),
                          },
                          {
                            id: "shaker_frame",
                            label: "Çerçeve",
                            svg: (
                              <svg viewBox="0 0 36 48" className="w-7 h-9" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <rect x="6" y="4" width="24" height="40" rx="2" />
                                <rect x="11" y="9" width="14" height="30" rx="1" />
                              </svg>
                            ),
                          },
                          {
                            id: "fluted_ribbed",
                            label: "Fitilli",
                            svg: (
                              <svg viewBox="0 0 36 48" className="w-7 h-9" fill="none" stroke="currentColor" strokeWidth="1.4">
                                <rect x="6" y="4" width="24" height="40" rx="2" />
                                <line x1="10" y1="5" x2="10" y2="43" />
                                <line x1="14" y1="5" x2="14" y2="43" />
                                <line x1="18" y1="5" x2="18" y2="43" />
                                <line x1="22" y1="5" x2="22" y2="43" />
                                <line x1="26" y1="5" x2="26" y2="43" />
                              </svg>
                            ),
                          },
                          {
                            id: "glass_frame",
                            label: "Cam",
                            svg: (
                              <svg viewBox="0 0 36 48" className="w-7 h-9" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <rect x="6" y="4" width="24" height="40" rx="2" />
                                <rect x="9.5" y="7.5" width="17" height="33" rx="1" strokeOpacity="0.5" />
                                <line x1="13" y1="20" x2="21" y2="12" />
                                <line x1="15" y1="25" x2="22" y2="18" />
                              </svg>
                            ),
                          },
                          {
                            id: "mirror_door",
                            label: "Ayna",
                            svg: (
                              <svg viewBox="0 0 36 48" className="w-7 h-9" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <rect x="6" y="4" width="24" height="40" rx="2" />
                                <line x1="11" y1="34" x2="23" y2="14" />
                                <line x1="16" y1="36" x2="24" y2="22" />
                              </svg>
                            ),
                          },
                        ].map((dtCard) => {
                          const isSel = curProf === dtCard.id;
                          return (
                            <button
                              key={dtCard.id}
                              type="button"
                              data-testid={`door-type-card-${dtCard.id}`}
                              onClick={() => {
                                setDoorCrossSectionProfile(
                                  dtCard.id as import("@birim/core").DoorCrossSectionProfile
                                );
                                setBayV4DoorConfig(activeBayIndex, {
                                  crossSectionProfile:
                                    dtCard.id as import("@birim/core").DoorCrossSectionProfile,
                                  isGlassFramed: dtCard.id === "glass_frame",
                                });
                              }}
                              className={`py-2.5 px-1 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition cursor-pointer ${
                                isSel
                                  ? "bg-[#EEF3F8] border-2 border-[#2563EB] text-[#111827] font-bold shadow-2xs"
                                  : "bg-white hover:bg-[#F8FAFC] border-[#CBD5E1] text-[#475569]"
                              }`}
                            >
                              {dtCard.svg}
                              <span className="text-[13px] font-bold text-[#111827] leading-tight">
                                {dtCard.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </section>

                    {/* GRUP 2: AÇILMA SİSTEMİ (Segmented Pills: Klasik (Sağa/Sola) | Sürgülü | Katlanır | Yukarı Açılır) */}
                    <section data-testid="door-group-opening-system" className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-[#111827]">Açılma Sistemi</h3>
                        <span className="text-xs font-mono text-[#64748B]">
                          {curSys === "open" ? "Kapaksız" : "EN 15570"}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[
                          {
                            id: "classic_hinged",
                            label: "Klasik (Sağa/Sola)",
                            active:
                              curSys === "hinged_single" ||
                              curSys === "hinged_double" ||
                              curSys === "hinged_inset" ||
                              curSys === "hinged_overlay_variant",
                            compatible: true,
                            onSelect: () => {
                              setDoorCompatWarningMsg(null);
                              setBayV4DoorConfig(activeBayIndex, {
                                doorSystemId:
                                  currentBayWidthMm >= 700 ? "hinged_double" : "hinged_single",
                              });
                            },
                          },
                          {
                            id: "sliding",
                            label: "Sürgülü",
                            active: curSys.startsWith("sliding"),
                            compatible: isSlidingCompatible,
                            onSelect: () => {
                              if (!isSlidingCompatible) {
                                setDoorCompatWarningMsg(
                                  "Sürgülü kapak sistemi için modül genişliği en az 900 mm veya en az 2 bölme olmalıdır. Mevcut geçerli konfigürasyon korundu."
                                );
                                return;
                              }
                              setDoorCompatWarningMsg(null);
                              setBayV4DoorConfig(activeBayIndex, {
                                doorSystemId: "sliding_top_hung",
                                hardwareProductId: "hw_hettich_topline_l",
                              });
                            },
                          },
                          {
                            id: "folding",
                            label: "Katlanır",
                            active: curSys === "folding_side",
                            compatible: true,
                            onSelect: () => {
                              setDoorCompatWarningMsg(null);
                              setBayV4DoorConfig(activeBayIndex, {
                                doorSystemId: "folding_side",
                                hardwareProductId: "hw_hettich_wingline_l",
                              });
                            },
                          },
                          {
                            id: "lift_up",
                            label: "Yukarı Açılır",
                            active: curSys.startsWith("lift_"),
                            compatible: isLiftCompatible,
                            onSelect: () => {
                              if (!isLiftCompatible) {
                                setDoorCompatWarningMsg(
                                  `Yukarı açılır (Blum AVENTOS) mekanizmalar yüksekliği ≤ 1150 mm olan üst dolaplar içindir (Mevcut boy: ${height} mm). Mevcut geçerli kapak sistemi korundu.`
                                );
                                return;
                              }
                              setDoorCompatWarningMsg(null);
                              setBayV4DoorConfig(activeBayIndex, {
                                doorSystemId: "lift_up_stay",
                                hardwareProductId: "hw_blum_aventos_hk_27",
                              });
                            },
                          },
                        ].map((sysPill) => (
                          <button
                            key={sysPill.id}
                            type="button"
                            data-testid={`door-sys-pill-${sysPill.id}`}
                            onClick={sysPill.onSelect}
                            className={`py-2 px-1.5 rounded-xl text-xs font-bold leading-tight text-center transition cursor-pointer border ${
                              sysPill.active
                                ? "bg-[#2563EB] text-white border-[#2563EB] shadow-xs"
                                : sysPill.compatible
                                ? "bg-white hover:bg-[#F8FAFC] text-[#111827] border-[#CBD5E1]"
                                : "bg-[#F8FAFC] text-[#94A3B8] border-[#E2E8F0]"
                            }`}
                          >
                            {sysPill.label}
                          </button>
                        ))}
                      </div>

                      {doorCompatWarningMsg && (
                        <div
                          data-testid="door-compat-warning-banner"
                          className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-[13px] font-medium flex items-start justify-between gap-2"
                        >
                          <span>⚠️ {doorCompatWarningMsg}</span>
                          <button
                            type="button"
                            onClick={() => setDoorCompatWarningMsg(null)}
                            className="text-amber-800 hover:text-amber-950 font-bold cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </section>

                    {/* GRUP 3: AÇILMA YÖNÜ (Matches image_e5c524.jpg: "Açılma Yönü" + Dropdown "Sol | Sağ | Çift Kapak") */}
                    <section
                      data-testid="door-group-direction"
                      className="flex items-center justify-between gap-3 pt-1"
                    >
                      <label className="text-xs font-bold text-[#111827] shrink-0">
                        Açılma Yönü
                      </label>
                      <div className="flex items-center gap-1.5 flex-1 justify-end">
                        <select
                          aria-label="Açılma Yönü"
                          data-testid="door-screen3-direction-select"
                          value={
                            curDir === "double" || curDir === "inset_double"
                              ? "double"
                              : curDir.includes("right")
                              ? "single_right"
                              : curDir === "open"
                              ? "open"
                              : "single_left"
                          }
                          onChange={(e) => {
                            const nextVal = e.target.value as
                              | "single_left"
                              | "single_right"
                              | "double"
                              | "open";
                            setBayDoorType(activeBayIndex, nextVal);
                          }}
                          className="w-40 px-3 py-2 rounded-xl bg-white border border-[#CBD5E1] text-xs font-bold text-[#111827] focus:outline-none focus:border-[#2563EB] cursor-pointer"
                        >
                          <option value="single_left">Sol (Sol Menteşe)</option>
                          <option value="single_right">Sağ (Sağ Menteşe)</option>
                          <option value="double">Çift Kapak (2 Kanat)</option>
                          <option value="open">Açık (Kapaksız)</option>
                        </select>
                      </div>
                    </section>

                    {/* GRUP 4: KULP VE PROFİL (5 Görselli Kart: K019 Mat Siyah | K020 Inox | K021 Pirinç | K022 Antrasit | + Kulp Ekle — Matches image_e5c524.jpg) */}
                    <section data-testid="door-group-handle" className="space-y-2 pt-1">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-[#111827]">Kulp</h3>
                        <span className="text-xs font-mono text-[#64748B]">
                          {curHandleCat === "handleless_plain"
                            ? "Kulpsuz (TIP-ON)"
                            : `${curHandleSku} • ${curHandleLen}mm`}
                        </span>
                      </div>
                      <div className="grid grid-cols-5 gap-1.5">
                        {[
                          {
                            sku: "K019",
                            sub: "Mat Siyah",
                            matId: "mat_handle_matte_black",
                            barColor: "#1E293B",
                          },
                          {
                            sku: "K020",
                            sub: "Inox",
                            matId: "mat_handle_inox",
                            barColor: "#94A3B8",
                          },
                          {
                            sku: "K021",
                            sub: "Pirinç",
                            matId: "mat_handle_brass",
                            barColor: "#D4AF37",
                          },
                          {
                            sku: "K022",
                            sub: "Antrasit",
                            matId: "mat_handle_anthracite",
                            barColor: "#374151",
                          },
                        ].map((hk) => {
                          const isSel =
                            curHandleCat !== "handleless_plain" && curHandleSku === hk.sku;
                          return (
                            <button
                              key={hk.sku}
                              type="button"
                              data-testid={`door-handle-sku-${hk.sku}`}
                              onClick={() =>
                                setBayV4DoorConfig(activeBayIndex, {
                                  handleCategory:
                                    curHandleCat === "handleless_plain" ||
                                    curHandleCat === "gola_profile" ||
                                    curHandleCat === "j_pull"
                                      ? "bar_handle"
                                      : curHandleCat,
                                  handleProfileId: hk.sku,
                                  handleMaterialId: hk.matId,
                                })
                              }
                              className={`p-2 rounded-2xl border flex flex-col items-center justify-between text-center gap-1 transition cursor-pointer ${
                                isSel
                                  ? "bg-[#EEF3F8] border-2 border-[#2563EB] text-[#111827] shadow-2xs"
                                  : "bg-white hover:bg-[#F8FAFC] border-[#CBD5E1] text-[#475569]"
                              }`}
                            >
                              <svg viewBox="0 0 44 26" className="w-10 h-6" fill="none">
                                {/* 3D Angled Bar Handle Illustration with Standoff Feet */}
                                <line x1="11" y1="17" x2="11" y2="21" stroke={hk.barColor} strokeWidth="3" strokeLinecap="round" />
                                <line x1="33" y1="9" x2="33" y2="13" stroke={hk.barColor} strokeWidth="3" strokeLinecap="round" />
                                <line x1="6" y1="19" x2="38" y2="7" stroke={hk.barColor} strokeWidth="4.2" strokeLinecap="round" />
                              </svg>
                              <div>
                                <div className="text-xs font-extrabold text-[#111827] leading-tight">
                                  {hk.sku}
                                </div>
                                <div className="text-xs text-[#64748B] leading-tight">
                                  {hk.sub}
                                </div>
                              </div>
                            </button>
                          );
                        })}

                        {/* + Kulp Ekle (Opens Extended Handle & Profile Customizer) */}
                        <button
                          type="button"
                          data-testid="door-screen3-more-handles-btn"
                          onClick={() =>
                            setOpenRightDrawer((prev) =>
                              prev === "handle" ? null : "handle"
                            )
                          }
                          className={`p-2 rounded-2xl border flex flex-col items-center justify-center text-center gap-1 transition cursor-pointer ${
                            openRightDrawer === "handle"
                              ? "bg-[#EEF3F8] border-2 border-[#2563EB] text-[#111827]"
                              : "bg-white hover:bg-[#F8FAFC] border-[#CBD5E1] text-[#111827]"
                          }`}
                        >
                          <span className="text-base font-bold leading-none">+</span>
                          <span className="text-xs font-bold leading-tight">
                            Kulp Ekle
                          </span>
                        </button>
                      </div>

                      {/* Expandable Kulp & Profil Detay Ayarları (Dikey/Yatay Yerleşim, Boy, Mesafe, Gola, J-Pull, Gömme, Kulpsuz) */}
                      {openRightDrawer === "handle" && (
                        <div
                          data-testid="door-screen3-handle-customizer"
                          className="p-3 rounded-2xl bg-[#F8FAFC] border border-[#CBD5E1] space-y-2.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[13px] font-bold text-[#111827]">
                              Kulp Modeli, Yönü & Konum Parametreleri
                            </span>
                            <button
                              type="button"
                              onClick={() => setOpenRightDrawer(null)}
                              className="text-xs text-[#64748B] hover:text-[#111827] cursor-pointer"
                            >
                              Kapat ▲
                            </button>
                          </div>

                          {/*Dikey / Yatay / Otomatik Yerleşim */}
                          <div className="grid grid-cols-3 gap-1">
                            {[
                              { id: "auto", label: "Otomatik Yön" },
                              { id: "vertical", label: "↕ Dikey Kulp" },
                              { id: "horizontal", label: "↔ Yatay Kulp" },
                            ].map((orOpt) => (
                              <button
                                key={orOpt.id}
                                type="button"
                                data-testid={`door-handle-orient-${orOpt.id}`}
                                onClick={() =>
                                  setBayV4DoorConfig(activeBayIndex, {
                                    handleOrientation: orOpt.id as
                                      | "auto"
                                      | "vertical"
                                      | "horizontal",
                                  })
                                }
                                className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                                  curHandleOrient === orOpt.id
                                    ? "bg-[#2563EB] text-white border-[#2563EB]"
                                    : "bg-white hover:bg-[#EEF3F8] text-[#111827] border-[#E2E8F0]"
                                }`}
                              >
                                {orOpt.label}
                              </button>
                            ))}
                          </div>

                          {/* Kulp Boyu (Span mm) */}
                          <div className="space-y-1">
                            <span className="text-xs font-semibold text-[#475569] block">
                              Kulp Uzunluğu / Aks Mesafesi (mm):
                            </span>
                            <div className="grid grid-cols-5 gap-1">
                              {[160, 192, 256, 320, 600].map((lenMm) => (
                                <button
                                  key={lenMm}
                                  type="button"
                                  data-testid={`door-handle-len-${lenMm}`}
                                  onClick={() =>
                                    setBayV4DoorConfig(activeBayIndex, {
                                      handleLengthMm: lenMm,
                                    })
                                  }
                                  className={`py-1 rounded-lg font-mono text-xs font-bold border cursor-pointer ${
                                    curHandleLen === lenMm
                                      ? "bg-[#EEF3F8] text-[#111827] border-[#2563EB]"
                                      : "bg-white text-[#475569] border-[#E2E8F0]"
                                  }`}
                                >
                                  {lenMm}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Konum & Mesafe Parametreleri (Yerden Y ve Kenar X) */}
                          <div className="grid grid-cols-2 gap-2">
                            <label className="bg-white px-2.5 py-1.5 rounded-xl border border-[#CBD5E1] flex items-center justify-between">
                              <span className="text-xs font-semibold text-[#475569]">
                                Alt Mesafe (Y):
                              </span>
                              <div className="flex items-center gap-0.5">
                                <input
                                  type="number"
                                  data-testid="door-handle-offset-y-input"
                                  min={40}
                                  max={Math.max(100, height - 120)}
                                  step={20}
                                  value={curHandleOffY}
                                  onChange={(e) =>
                                    setBayV4DoorConfig(activeBayIndex, {
                                      handleOffsetY: Number(e.target.value),
                                    })
                                  }
                                  className="w-12 font-mono text-xs font-bold text-[#111827] text-right focus:outline-none"
                                />
                                <span className="text-xs text-[#64748B]">mm</span>
                              </div>
                            </label>
                            <label className="bg-white px-2.5 py-1.5 rounded-xl border border-[#CBD5E1] flex items-center justify-between">
                              <span className="text-xs font-semibold text-[#475569]">
                                Kenar Payı (X):
                              </span>
                              <div className="flex items-center gap-0.5">
                                <input
                                  type="number"
                                  data-testid="door-handle-inset-x-input"
                                  min={22}
                                  max={120}
                                  step={5}
                                  value={curHandleInsetX}
                                  onChange={(e) =>
                                    setBayV4DoorConfig(activeBayIndex, {
                                      handleEdgeInsetX: Number(e.target.value),
                                    })
                                  }
                                  className="w-10 font-mono text-xs font-bold text-[#111827] text-right focus:outline-none"
                                />
                                <span className="text-xs text-[#64748B]">mm</span>
                              </div>
                            </label>
                          </div>
                        </div>
                      )}
                    </section>

                    {/* GRUP 5: KAPAK MALZEMESİ VE RENK (Matches image_e5c524.jpg: Large Swatch Card "Meşe Doğal / Veneer >") */}
                    <section data-testid="door-group-material" className="space-y-2 pt-1">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-[#111827]">
                          Kapak Malzemesi ve Renk
                        </h3>
                        <span className="text-xs font-mono text-[#64748B]">
                          {activeDoorMatObj.costPerM2} €/m²
                        </span>
                      </div>

                      <button
                        type="button"
                        data-testid="door-screen3-material-card-btn"
                        onClick={() =>
                          setOpenRightDrawer((prev) =>
                            prev === "material" ? null : "material"
                          )
                        }
                        className="w-full p-2.5 rounded-2xl bg-white hover:bg-[#F8FAFC] border border-[#CBD5E1] flex items-center justify-between gap-3 transition cursor-pointer shadow-2xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className="w-12 h-8 rounded-xl border border-stone-300 shrink-0 shadow-inner"
                            style={{ backgroundColor: activeDoorMatObj.colorHex }}
                          />
                          <div className="text-left min-w-0">
                            <div className="text-xs font-bold text-[#111827] truncate">
                              {activeDoorMatObj.name.split(" (")[0]}
                            </div>
                            <div className="text-xs text-[#64748B] truncate">
                              {activeDoorMatObj.category === "wood"
                                ? "Veneer / Doğal Ahşap Doku"
                                : activeDoorMatObj.category === "lacquer"
                                ? "Supramat / İpek Mat Lake"
                                : activeDoorMatObj.category === "glass"
                                ? "Alüminyum Çerçeveli Vitrin Cam"
                                : activeDoorMatObj.category === "mirror"
                                ? "Aynalı Kapak Yüzeyi"
                                : "MDFLam / Dekor Yüzey"}
                            </div>
                          </div>
                        </div>
                        <ChevronRight
                          className={`w-4 h-4 text-[#64748B] transition-transform ${
                            openRightDrawer === "material" ? "rotate-90" : ""
                          }`}
                        />
                      </button>

                      {openRightDrawer === "material" && (
                        <div
                          data-testid="door-screen3-material-picker-drawer"
                          className="p-3 rounded-2xl bg-[#F8FAFC] border border-[#CBD5E1] space-y-2.5"
                        >
                          {/* Scope Selector: Tek Kapak | Seçili Bölme | Tüm Kapaklar */}
                          <div className="grid grid-cols-3 gap-1">
                            {[
                              { id: "single_door", label: "Sadece Seçili Kapak" },
                              { id: "active_bay", label: `Bölme ${activeBayIndex + 1}` },
                              { id: "all_doors", label: "Tüm Kapaklar" },
                            ].map((sc) => (
                              <button
                                key={sc.id}
                                type="button"
                                data-testid={`door-mat-scope-${sc.id}`}
                                onClick={() =>
                                  setDoorMaterialApplyScope(
                                    sc.id as "single_door" | "active_bay" | "all_doors"
                                  )
                                }
                                className={`py-1 px-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                                  doorMaterialApplyScope === sc.id
                                    ? "bg-[#2563EB] text-white"
                                    : "bg-white hover:bg-[#EEF3F8] text-[#475569] border border-[#E2E8F0]"
                                }`}
                              >
                                {sc.label}
                              </button>
                            ))}
                          </div>

                          <div className="grid grid-cols-2 gap-1.5 max-h-52 overflow-y-auto pr-0.5">
                            {DEFAULT_MATERIALS.filter(
                              (m) =>
                                m.category === "wood" ||
                                m.category === "lacquer" ||
                                m.category === "laminate" ||
                                m.category === "glass" ||
                                m.category === "mirror"
                            ).map((mat) => {
                              const isSelMat = effectiveDoorMatId === mat.id;
                              return (
                                <button
                                  key={mat.id}
                                  type="button"
                                  data-testid={`door-screen3-mat-option-${mat.id}`}
                                  onClick={() => {
                                    if (doorMaterialApplyScope === "single_door") {
                                      setSelectedComponentMaterial(mat.id, selectedDoorLeafId);
                                    } else if (doorMaterialApplyScope === "active_bay") {
                                      setBayV4DoorConfig(activeBayIndex, {
                                        doorMaterialId: mat.id,
                                      });
                                    } else {
                                      setMaterials(undefined, mat.id);
                                      activeModule.bays.forEach((_, bIdx) => {
                                        setBayV4DoorConfig(bIdx, { doorMaterialId: mat.id });
                                      });
                                    }
                                  }}
                                  className={`p-2 rounded-xl border flex items-center gap-2 text-left transition cursor-pointer ${
                                    isSelMat
                                      ? "bg-[#EEF3F8] border-2 border-[#2563EB] font-bold"
                                      : "bg-white hover:bg-[#F8FAFC] border-[#E2E8F0]"
                                  }`}
                                >
                                  <span
                                    className="w-6 h-6 rounded-lg border border-stone-300 shrink-0"
                                    data-material-swatch="true" style={getMaterialSwatchStyle(mat)}
                                  />
                                  <div className="min-w-0">
                                    <div className="text-xs font-bold text-[#111827] truncate">
                                      {mat.name.split(" (")[0]}
                                    </div>
                                    <div className="text-xs text-[#64748B] truncate">
                                      {mat.decorCode || mat.category} • {mat.costPerM2} €/m²
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </section>

                    {/* GRUP 6: KAPAK DETAYLARI (Matches image_e5c524.jpg: Kalınlık 18mm | Kenar Bandı 1mm | Yavaş Kapanma (Blumotion) Toggle) */}
                    <section data-testid="door-group-details" className="space-y-2 pt-1">
                      <h3 className="text-xs font-bold text-[#111827]">Kapak Detayları</h3>
                      <div className="grid grid-cols-3 gap-2 items-end">
                        {/* Kalınlık */}
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-[#64748B] block">
                            Kalınlık
                          </label>
                          <select
                            aria-label="Kapak Kalınlığı"
                            data-testid="door-screen3-thickness-select"
                            value={curDoorThick}
                            onChange={(e) => {
                              const nextT = Number(e.target.value) || 18;
                              setBayV4DoorConfig(activeBayIndex, {
                                doorThicknessMm: nextT,
                              });
                              updateCarcassConfig({ doorThickness: nextT });
                            }}
                            className="w-full px-2.5 py-2 rounded-xl bg-white border border-[#CBD5E1] text-xs font-bold text-[#111827] cursor-pointer"
                          >
                            <option value={18}>18 mm</option>
                            <option value={19}>19 mm</option>
                            <option value={22}>22 mm</option>
                          </select>
                        </div>

                        {/* Kenar Bandı */}
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-[#64748B] block">
                            Kenar Bandı
                          </label>
                          <select
                            aria-label="Kapak Kenar Bandı"
                            data-testid="door-screen3-edgeband-select"
                            value={curDoorEdgeBand}
                            onChange={(e) => {
                              const nextEb = Number(e.target.value) || 1;
                              setBayV4DoorConfig(activeBayIndex, {
                                doorEdgeBandThicknessMm: nextEb,
                              });
                              updateCarcassConfig({ edgeBandThickness: nextEb });
                            }}
                            className="w-full px-2.5 py-2 rounded-xl bg-white border border-[#CBD5E1] text-xs font-bold text-[#111827] cursor-pointer"
                          >
                            <option value={0.8}>0.8 mm</option>
                            <option value={1}>1 mm</option>
                            <option value={2}>2 mm</option>
                          </select>
                        </div>

                        {/* Yavaş Kapanma (Blumotion) */}
                        <div className="flex items-center justify-between gap-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-[#CBD5E1]">
                          <div className="leading-tight">
                            <span className="text-xs font-bold text-[#111827] block">
                              Yavaş Kapanma
                            </span>
                            <span className="text-xs text-[#64748B] block">
                              (Blumotion)
                            </span>
                          </div>
                          <button
                            type="button"
                            data-testid="door-screen3-softclose-toggle"
                            onClick={() =>
                              setBayV4DoorConfig(activeBayIndex, {
                                softClose: !isSoftClose,
                                openingTechnology: !isSoftClose
                                  ? "soft_close"
                                  : "manual_standard",
                              })
                            }
                            className={`w-9 h-5 rounded-full p-0.5 flex items-center transition shrink-0 cursor-pointer ${
                              isSoftClose
                                ? "bg-[#2563EB] justify-end"
                                : "bg-[#CBD5E1] justify-start"
                            }`}
                          >
                            <span className="w-4 h-4 rounded-full bg-white shadow-2xs" />
                          </button>
                        </div>
                      </div>
                    </section>
                  </div>
                );
              })()}

              {/* EKRAN 6 (FAZ 3, 4 & 5): SAĞ ÖZELLİK PANELİ — MALZEME VE YÜZEYLER (Matches image_dad0ff.jpg 1-to-1 with Enlarged Readable Typography) */}
              {activeBay && studioInspectorTab === "material" && (() => {
                const carcassPanelsCount = activeBreakdown.components.filter(
                  (c) =>
                    c.role === "carcass_side_left" ||
                    c.role === "carcass_side_right" ||
                    c.role === "carcass_top" ||
                    c.role === "carcass_bottom" ||
                    c.role === "carcass_divider" ||
                    c.role === "shelf"
                ).length;
                const doorPanelsCount = activeBreakdown.components.filter(
                  (c) => c.role === "door_left" || c.role === "door_right"
                ).length;
                const drawerFrontsCount = activeBreakdown.components.filter(
                  (c) => c.role === "drawer_front"
                ).length;
                const plinthCount = Math.max(
                  1,
                  activeBreakdown.components.filter((c) => c.role === "plinth").length
                );
                const backCount = Math.max(
                  1,
                  activeBreakdown.components.filter((c) => c.role === "carcass_back").length
                );
                const totalPanelsCount = activeBreakdown.components.filter(
                  (c) => c.isManufacturablePanel !== false
                ).length;

                const selectedCompObj = selectedComponentId
                  ? activeBreakdown.components.find((c) => c.id === selectedComponentId)
                  : undefined;

                const activeTargetMatId =
                  materialTargetScope === "carcass"
                    ? activeModule.carcass.bodyMaterialId
                    : materialTargetScope === "plinth"
                    ? activeModule.carcass.plinthMaterialId ||
                      activeModule.componentMaterialOverrides?.__plinth__ ||
                      activeModule.carcass.bodyMaterialId
                    : materialTargetScope === "back"
                    ? activeModule.componentMaterialOverrides?.[`${activeModule.id}_back`] ||
                      activeModule.carcass.bodyMaterialId
                    : materialTargetScope === "drawers"
                    ? activeBay.drawers[0]?.frontMaterialId || activeModule.carcass.doorMaterialId
                    : materialTargetScope === "selected_part" && selectedCompObj
                    ? activeModule.componentMaterialOverrides?.[selectedCompObj.id] ||
                      selectedCompObj.materialId
                    : activeModule.carcass.doorMaterialId;

                const activeMatObj =
                  DEFAULT_MATERIALS.find((m) => m.id === activeTargetMatId) ||
                  DEFAULT_MATERIALS.find((m) => m.id === "mat_veneer_oak") ||
                  DEFAULT_MATERIALS[0];

                const grainKey =
                  materialTargetScope === "doors"
                    ? "__doors__"
                    : materialTargetScope === "drawers"
                    ? "__drawers__"
                    : materialTargetScope === "selected_part" && selectedCompObj
                    ? selectedCompObj.id
                    : "__all__";
                const curGrainDir =
                  activeModule.componentGrainOverrides?.[grainKey] ||
                  activeModule.componentGrainOverrides?.__all__ ||
                  "lengthwise";

                const curSurfaceFinish =
                  activeModule.surfaceFinishOverride ||
                  (activeMatObj.roughness <= 0.15
                    ? "gloss"
                    : activeMatObj.roughness <= 0.36
                    ? "satin"
                    : "matte");

                const curEdgeBandMatId =
                  activeModule.edgeBandMaterialId || activeTargetMatId || "mat_veneer_oak";
                const curEdgeBandMatObj =
                  DEFAULT_MATERIALS.find((m) => m.id === curEdgeBandMatId) || activeMatObj;

                const curTargetThicknessMm =
                  materialTargetScope === "carcass"
                    ? activeModule.carcass.panelThickness || 18
                    : activeBay.door.doorThicknessMm || activeModule.carcass.doorThickness || 18;

                const scopeRows: {
                  id:
                    | "all_module"
                    | "carcass"
                    | "doors"
                    | "drawers"
                    | "plinth"
                    | "back"
                    | "selected_part"
                    | "same_material_parts";
                  label: string;
                  count: number;
                }[] = [
                  { id: "all_module", label: "Tüm Modül", count: totalPanelsCount },
                  { id: "carcass", label: `Gövde (${carcassPanelsCount})`, count: carcassPanelsCount },
                  { id: "doors", label: `Kapaklar (${doorPanelsCount})`, count: doorPanelsCount },
                  {
                    id: "drawers",
                    label: `Çekmeceler (${drawerFrontsCount})`,
                    count: drawerFrontsCount,
                  },
                  {
                    id: "plinth",
                    label: `Soket / Kaide (${plinthCount})`,
                    count: plinthCount,
                  },
                  { id: "back", label: `Arkalık (${backCount})`, count: backCount },
                  ...(selectedCompObj
                    ? [
                        {
                          id: "selected_part" as const,
                          label: `Seçili: ${selectedCompObj.label.split(" B")[0]}`,
                          count: 1,
                        },
                        {
                          id: "same_material_parts" as const,
                          label: "Aynı Malzemeliler",
                          count: activeBreakdown.components.filter(
                            (c) =>
                              c.isManufacturablePanel !== false &&
                              c.materialId === selectedCompObj.materialId
                          ).length,
                        },
                      ]
                    : []),
                ];

                const variationsList = [
                  {
                    id: "var_oak_white",
                    label: "Meşe & Beyaz",
                    doorMatId: "mat_veneer_oak",
                    bodyMatId: "mat_melamine_white",
                    doorHex: "#b58d59",
                    bodyHex: "#f3f4f6",
                  },
                  {
                    id: "var_walnut_anthracite",
                    label: "Ceviz & Antrasit",
                    doorMatId: "mat_veneer_walnut",
                    bodyMatId: "mat_melamine_anthracite",
                    doorHex: "#5c4033",
                    bodyHex: "#374151",
                  },
                  {
                    id: "var_cream_oak",
                    label: "Krem & Meşe",
                    doorMatId: "mat_lacquer_cream",
                    bodyMatId: "mat_veneer_oak",
                    doorHex: "#ede8d0",
                    bodyHex: "#b58d59",
                  },
                  {
                    id: "var_sage_white",
                    label: "Yeşil & Beyaz",
                    doorMatId: "mat_lacquer_sage",
                    bodyMatId: "mat_melamine_white",
                    doorHex: "#9caf88",
                    bodyHex: "#f3f4f6",
                  },
                ];

                return (
                  <div
                    data-testid="studio-material-screen6-panel"
                    className="space-y-4 text-xs"
                  >
                    {materialValidationErrorMsg && (
                      <div
                        data-testid="material-validation-error-banner"
                        className="p-3 rounded-2xl bg-red-50 border border-red-300 text-red-900 text-xs font-medium flex items-start justify-between gap-2"
                      >
                        <span>⚠️ {materialValidationErrorMsg}</span>
                        <button
                          type="button"
                          onClick={() => setMaterialValidationErrorMsg(null)}
                          className="text-red-700 hover:text-red-950 font-bold cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    )}

                    {/* BÖLÜM 1: MALZEME ATAMASI (Sol Kapsam Listesi + Sağ Aktif Malzeme & Yüzey Ayarları — Matches image_dad0ff.jpg) */}
                    <section
                      data-testid="material-assignment-section"
                      className="space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-[#111827]">Malzeme Ataması</h3>
                        <span className="text-xs text-[#64748B]">
                          Kapsam seçin ve sol kütüphaneden tıklayın
                        </span>
                      </div>

                      <div className="grid grid-cols-12 gap-2.5 items-start">
                        {/* Left Column (5 cols): Scope & Part Group Buttons */}
                        <div className="col-span-5 space-y-1.5">
                          {scopeRows.map((sc) => {
                            const isSelScope = materialTargetScope === sc.id;
                            return (
                              <button
                                key={sc.id}
                                type="button"
                                data-testid={`material-scope-btn-${sc.id}`}
                                onClick={() => setMaterialTargetScope(sc.id)}
                                className={`w-full px-2.5 py-2 rounded-xl border flex items-center justify-between gap-1.5 text-left transition cursor-pointer ${
                                  isSelScope
                                    ? "bg-[#EFF6FF] border-2 border-[#2563EB] text-[#1D4ED8] font-bold shadow-2xs"
                                    : "bg-[#F8FAFC] hover:bg-[#F1F5F9] border-[#E2E8F0] text-[#111827] font-medium"
                                }`}
                              >
                                <span className="text-xs leading-tight truncate">{sc.label}</span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Right Column (7 cols): Active Material Card + Yüzey ve Detay Ayarları */}
                        <div className="col-span-7 space-y-3">
                          {/* Active Material Card */}
                          <div
                            data-testid="material-active-target-card"
                            className="p-2.5 rounded-2xl bg-white border border-[#CBD5E1] flex items-center justify-between gap-2.5 shadow-2xs"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {renderMaterialSwatchBox(activeMatObj, "sm", curGrainDir)}
                              <div className="min-w-0">
                                <div className="text-xs font-extrabold text-[#111827] leading-tight truncate">
                                  {activeMatObj.decorCode
                                    ? `${activeMatObj.decorCode} ${activeMatObj.name.split(" (")[0].replace(/^Kastamonu Entegre\s+/i, "").replace(/^Yıldız Entegre\s+/i, "").replace(new RegExp(`^${activeMatObj.decorCode}\s*`, "i"), "")}`
                                    : activeMatObj.name.split(" (")[0]}
                                </div>
                                <div className="text-xs text-[#64748B] truncate mt-0.5">
                                  {activeMatObj.category === "wood"
                                    ? "Doğal Kaplama"
                                    : activeMatObj.category === "lacquer"
                                    ? "Lake / Supramat"
                                    : "Suntalam / MDFLam"}{" "}
                                  • €{activeMatObj.costPerM2}/m²
                                </div>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-[#64748B] shrink-0" />
                          </div>

                          {/* Yüzey ve Detay Ayarları */}
                          <div
                            data-testid="material-surface-details-box"
                            className="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2.5"
                          >
                            <div className="text-xs font-bold text-[#111827]">
                              Yüzey ve Detay Ayarları
                            </div>

                            {/* 1. Doku Yönü (Dikey | Yatay | Özel) */}
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-medium text-[#475569] shrink-0">
                                Doku Yönü
                              </span>
                              <div className="grid grid-cols-3 gap-1 flex-1 max-w-[168px]">
                                {[
                                  { id: "lengthwise" as const, label: "Dikey", sym: "||" },
                                  { id: "crosswise" as const, label: "Yatay", sym: "═" },
                                  { id: "custom" as const, label: "Özel", sym: "⟋" },
                                ].map((gr) => {
                                  const isActGr = curGrainDir === gr.id;
                                  return (
                                    <button
                                      key={gr.id}
                                      type="button"
                                      data-testid={`material-grain-btn-${gr.id}`}
                                      onClick={() =>
                                        setModuleMaterialDetails({
                                          grainDirection: gr.id,
                                          grainTargetKey: grainKey,
                                        })
                                      }
                                      className={`py-1.5 px-1 rounded-xl border flex flex-col items-center justify-center gap-0.5 transition cursor-pointer ${
                                        isActGr
                                          ? "bg-[#EFF6FF] border-2 border-[#2563EB] text-[#1D4ED8] font-bold"
                                          : "bg-white hover:bg-[#F1F5F9] border-[#CBD5E1] text-[#475569]"
                                      }`}
                                    >
                                      <span className="font-mono text-xs leading-none">
                                        {gr.sym}
                                      </span>
                                      <span className="text-[13px] leading-tight">{gr.label}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* 2. Yüzey (Mat / İpek Mat / Parlak) */}
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-medium text-[#475569] shrink-0">
                                Yüzey
                              </span>
                              <select
                                data-testid="material-surface-finish-select"
                                value={curSurfaceFinish}
                                onChange={(e) =>
                                  setModuleMaterialDetails({
                                    surfaceFinishOverride: e.target.value as
                                      | "matte"
                                      | "satin"
                                      | "gloss",
                                  })
                                }
                                className="w-40 px-2.5 py-1.5 rounded-xl bg-white border border-[#CBD5E1] text-xs font-bold text-[#111827] cursor-pointer"
                              >
                                <option value="matte">Mat</option>
                                <option value="satin">İpek Mat (Soft-Touch)</option>
                                <option value="gloss">Parlak (High Gloss)</option>
                              </select>
                            </div>

                            {/* 3. Kenar Bandı (Gerçek Malzeme Eşleşmesi + Kalınlık) */}
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-medium text-[#475569] shrink-0">
                                Kenar Bandı
                              </span>
                              <div className="flex items-center gap-1.5 w-40">
                                <span
                                  className="w-5 h-5 rounded-md border border-stone-300 shrink-0"
                                  style={{ backgroundColor: curEdgeBandMatObj.colorHex }}
                                />
                                <select
                                  data-testid="material-edgeband-color-select"
                                  value={curEdgeBandMatId}
                                  onChange={(e) =>
                                    setModuleMaterialDetails({
                                      edgeBandMaterialId: e.target.value,
                                    })
                                  }
                                  className="flex-1 min-w-0 px-2 py-1.5 rounded-xl bg-white border border-[#CBD5E1] text-xs font-bold text-[#111827] cursor-pointer truncate"
                                >
                                  {DEFAULT_MATERIALS.filter(
                                    (m) =>
                                      m.category === "wood" ||
                                      m.category === "laminate" ||
                                      m.category === "lacquer"
                                  ).map((em) => (
                                    <option key={em.id} value={em.id}>
                                      {em.decorCode ? `${em.decorCode} - ` : ""}
                                      {em.name.split(" (")[0].replace(/^Kastamonu Entegre\s+/i, "").replace(/^Yıldız Entegre\s+/i, "")}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            {/* 4. Kalınlık (Kapak / Gövde) */}
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-medium text-[#475569] shrink-0">
                                Kalınlık ({materialTargetScope === "carcass" ? "Gövde" : "Kapak"})
                              </span>
                              <select
                                data-testid="material-panel-thickness-select"
                                value={curTargetThicknessMm}
                                onChange={(e) => {
                                  const nextT = Number(e.target.value) || 18;
                                  if (materialTargetScope === "carcass") {
                                    setModuleMaterialDetails({ panelThickness: nextT });
                                  } else {
                                    setModuleMaterialDetails({ doorThickness: nextT });
                                  }
                                }}
                                className="w-40 px-2.5 py-1.5 rounded-xl bg-white border border-[#CBD5E1] text-xs font-bold text-[#111827] cursor-pointer"
                              >
                                <option value={18}>18 mm</option>
                                <option value={19}>19 mm</option>
                                <option value={22}>22 mm</option>
                                <option value={25}>25 mm (Kalın Menteşe)</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      </div>
                    </section>

                    {/* BÖLÜM 2 (FAZ 5): MALZEME VARYASYONLARI (HIZLI ÖNİZLEME — Önizle → Uygula / İptal) */}
                    <section
                      data-testid="material-variations-section"
                      className="space-y-2.5 pt-2 border-t border-[#E2E8F0]"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-[#111827]">
                          Malzeme Varyasyonları (Hızlı Önizleme)
                        </h3>
                        <span className="text-xs text-[#64748B]">Tıkla → 3D Önizle</span>
                      </div>

                      <div className="grid grid-cols-4 gap-2">
                        {variationsList.map((vCard) => {
                          const isPreviewingThis =
                            materialVariationPreview?.variationId === vCard.id;
                          const isCurrentSaved =
                            !materialVariationPreview &&
                            activeModule.carcass.doorMaterialId === vCard.doorMatId &&
                            activeModule.carcass.bodyMaterialId === vCard.bodyMatId;

                          return (
                            <button
                              key={vCard.id}
                              type="button"
                              data-testid={`material-variation-card-${vCard.id}`}
                              onClick={() => {
                                const savedSnapshot =
                                  materialVariationPreview?.snapshot || {
                                    carcass: JSON.parse(JSON.stringify(activeModule.carcass)),
                                    bays: JSON.parse(JSON.stringify(activeModule.bays)),
                                    componentMaterialOverrides: activeModule.componentMaterialOverrides
                                      ? { ...activeModule.componentMaterialOverrides }
                                      : {},
                                    componentGrainOverrides: activeModule.componentGrainOverrides
                                      ? { ...activeModule.componentGrainOverrides }
                                      : {},
                                    surfaceFinishOverride: activeModule.surfaceFinishOverride,
                                    edgeBandMaterialId: activeModule.edgeBandMaterialId,
                                  };
                                // Apply preview without pushing history until confirmed
                                applyMaterialByTargetScope("carcass", vCard.bodyMatId, undefined, false);
                                applyMaterialByTargetScope("doors", vCard.doorMatId, undefined, false);
                                applyMaterialByTargetScope("drawers", vCard.doorMatId, undefined, false);
                                applyMaterialByTargetScope("plinth", vCard.bodyMatId, undefined, false);
                                setMaterialVariationPreview({
                                  variationId: vCard.id,
                                  variationName: vCard.label,
                                  snapshot: savedSnapshot,
                                });
                              }}
                              className={`p-2 rounded-2xl border flex flex-col items-center justify-between text-center gap-1.5 transition cursor-pointer ${
                                isPreviewingThis || isCurrentSaved
                                  ? "bg-[#EFF6FF] border-2 border-[#2563EB] text-[#111827] shadow-xs"
                                  : "bg-white hover:bg-[#F8FAFC] border-[#CBD5E1] text-[#111827]"
                              }`}
                            >
                              {renderVariationMiniWardrobeSvg(vCard.doorHex, vCard.bodyHex)}
                              <span className="text-xs font-bold leading-tight">
                                {vCard.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {materialVariationPreview && (
                        <div
                          data-testid="material-variation-confirm-bar"
                          className="p-3 rounded-2xl bg-[#EFF6FF] border-2 border-[#2563EB] flex items-center justify-between gap-2 shadow-sm"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-[#1D4ED8]">
                              👁️ Varyasyon 3D Sahnede Önizleniyor
                            </div>
                            <div className="text-xs font-bold text-[#111827] truncate">
                              {materialVariationPreview.variationName} (Onaylanana kadar kayıtlı proje değişmez)
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              data-testid="material-variation-apply-btn"
                              onClick={() => setMaterialVariationPreview(null)}
                              className="px-3 py-1.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold cursor-pointer"
                            >
                              ✓ Uygula
                            </button>
                            <button
                              type="button"
                              data-testid="material-variation-cancel-btn"
                              onClick={() => {
                                restoreModuleMaterialSnapshot(materialVariationPreview.snapshot);
                                setMaterialVariationPreview(null);
                              }}
                              className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-[#F1F5F9] text-[#475569] border border-[#CBD5E1] text-xs font-semibold cursor-pointer"
                            >
                              ✕ İptal
                            </button>
                          </div>
                        </div>
                      )}
                    </section>
                  </div>
                );
              })()}

              {/* EKRAN 5 (FAZ 3–7): SAĞ ÖZELLİK PANELİ — DONANIM VE MEKANİZMALAR (Matches Birim_Tasarim_5_Donanim_Mekanizmalar.png 1-to-1) */}
              {activeBay && studioInspectorTab === "all" && (() => {
                const curDoorSys = activeBay.door.doorSystemId || "hinged_single";
                const curHingeId = activeBay.door.hardwareProductId || "hw_blum_71b3550";
                const activeHingeObj =
                  hardwareCatalog.find((h) => h.id === curHingeId) ||
                  hardwareCatalog.find((h) => h.id === "hw_blum_71b3550")!;
                const leafSpec = fourSpaceDimensions?.doorLeaves[activeBayIndex];
                const totalModuleHinges = (fourSpaceDimensions?.doorLeaves || []).reduce(
                  (sum, lf) => sum + (lf.effectiveHingeCount || 0) * (lf.leafCount || 0),
                  0
                );

                const firstDrw =
                  activeBay.drawers[0] ||
                  activeModule.bays.find((b) => b.drawers.length > 0)?.drawers[0];
                const curRunnerId = firstDrw?.hardwareProductId || "hw_blum_tandembox_m30";
                const activeRunnerObj =
                  hardwareCatalog.find((h) => h.id === curRunnerId) ||
                  hardwareCatalog.find((h) => h.id === "hw_blum_tandembox_m30")!;
                const netInnerDepth = fourSpaceDimensions.usableInternal.netInnerDepthMm;
                const optimalNl =
                  firstDrw?.nominalLengthMm ||
                  Math.min(600, Math.max(270, Math.floor((netInnerDepth - 10) / 50) * 50));

                const hasActiveLed = activeModule.bays.some((b) =>
                  (b.specialFittings || []).some((f) => f.type.startsWith("led_"))
                );
                const activeLedFitting = activeModule.bays
                  .flatMap((b) => b.specialFittings || [])
                  .find((f) => f.type.startsWith("led_"));
                const activeLedType = (activeLedFitting?.type || "led_profile") as
                  | "led_profile"
                  | "led_vertical_strip"
                  | "led_rod_strip";
                const ledKelvin = activeModule.carcass.ledColorTempK || 4000;
                const ledSensor = activeModule.carcass.ledSensorType || "ir_door";

                const curDrillTplId =
                  activeModule.carcass.hingeDrillingTemplateId ||
                  activeHingeObj.drillingTemplateId ||
                  "tpl_drill_blum_hinge_45x95";
                const curDrawerDrillSet =
                  activeModule.carcass.drawerDrillingSetId ||
                  (curRunnerId.includes("hettich")
                    ? "hettich_avantech"
                    : curRunnerId.includes("tandembox")
                    ? "blum_tandembox"
                    : curRunnerId.includes("movento")
                    ? "blum_movento"
                    : "blum_legrabox");
                const cncNote = activeModule.carcass.cncProductionNote ?? "Özel işlem yok";

                const isLiftCompatible =
                  height <= 1150 ||
                  activeModule.category === "kitchen_wall" ||
                  activeModule.moduleFamilyId === "fam_kitchen_wall";
                const isSlidingCompatible = activeModule.bays.length >= 2 || width >= 900;

                const isHingeFullyVerified = Boolean(
                  activeHingeObj.verification?.physicalFactorySampleTested
                );
                const isRunnerFullyVerified = Boolean(
                  activeRunnerObj.verification?.physicalFactorySampleTested
                );

                return (
                  <div
                    data-testid="studio-hardware-screen5-panel"
                    className="space-y-3.5 text-xs"
                  >
                    {/* Explanatory Compatibility Error / Warning Banner */}
                    {hardwareValidationErrorMsg && (
                      <div
                        data-testid="hardware-validation-error-banner"
                        className="p-2.5 rounded-2xl bg-red-50 border border-red-300 text-red-900 text-[13px] font-medium flex items-start justify-between gap-2 shadow-2xs"
                      >
                        <span>⚠️ {hardwareValidationErrorMsg}</span>
                        <button
                          type="button"
                          onClick={() => setHardwareValidationErrorMsg(null)}
                          className="text-red-700 hover:text-red-950 font-bold cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    )}

                    {/* GRUP A: MENTEŞE (KAPAKLAR) */}
                    <section
                      data-testid="hardware-group-hinges"
                      className="space-y-1.5"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedHwGroup((prev) => (prev === "hinge" ? null : "hinge"))
                        }
                        className="w-full flex items-center justify-between text-left cursor-pointer"
                      >
                        <span className="text-xs font-bold text-[#111827]">
                          Menteşe (Kapaklar)
                        </span>
                        <span className="text-[13px] text-[#64748B]">
                          {expandedHwGroup === "hinge" ? "▴" : "▾"}
                        </span>
                      </button>

                      {/* Active Hinge Summary Card (Matches Birim_Tasarim_5_Donanim_Mekanizmalar.png) */}
                      <div
                        data-testid="hardware-active-hinge-card"
                        onClick={() =>
                          setExpandedHwGroup((prev) => (prev === "hinge" ? null : "hinge"))
                        }
                        className={`p-2.5 rounded-2xl border bg-white hover:bg-[#F8FAFC] flex items-center justify-between gap-2.5 transition cursor-pointer shadow-2xs ${
                          expandedHwGroup === "hinge"
                            ? "border-2 border-[#2563EB]"
                            : "border-[#CBD5E1]"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="p-1 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] shrink-0">
                            {renderHardwareProductIllustration(
                              activeHingeObj.manufacturerId === "mfr_blum"
                                ? "hinge_blum"
                                : "hinge_std",
                              "sm"
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-[#111827] truncate">
                              {activeHingeObj.id === "hw_blum_71b3550"
                                ? "Blum Clip-Top 110°"
                                : activeHingeObj.name.split(" Menteşe")[0]}
                            </div>
                            <div className="text-xs text-[#64748B] truncate mt-0.5">
                              {activeBay.door.softClose ? "Yavaş kapanma" : "Standart yaylı"} • 3D ayar •{" "}
                              {leafSpec?.effectiveHingeCount || 4} adet/kanat (Toplam {totalModuleHinges} ad.)
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {renderManufacturerBadge(activeHingeObj.manufacturerId)}
                          <ChevronRight className="w-4 h-4 text-[#64748B]" />
                        </div>
                      </div>

                      {expandedHwGroup === "hinge" && (
                        <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-[#CBD5E1] space-y-2.5">
                          <div className="flex items-center justify-between text-xs text-[#475569]">
                            <span>
                              SKU: <b className="font-mono text-[#111827]">{activeHingeObj.sku}</b> • Birim: <b>€{(activeHingeObj.unitPriceEur ?? 0).toFixed(2)}</b>
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded font-bold ${
                                isHingeFullyVerified
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-amber-100 text-amber-900"
                              }`}
                            >
                              {isHingeFullyVerified
                                ? "Fabrika Doğrulandı"
                                : "Doğrulanmadı (Numune Bekliyor)"}
                            </span>
                          </div>

                          <div className="space-y-1">
                            <span className="text-xs font-bold text-[#111827] block">
                              Menteşe Modeli Seçin (V4 Katalog):
                            </span>
                            <div className="space-y-1">
                              {hardwareCatalog
                                .filter((h) => h.familyId === "fam_hinge_concealed")
                                .map((hItem) => {
                                  const isSelH = curHingeId === hItem.id;
                                  return (
                                    <button
                                      key={hItem.id}
                                      type="button"
                                      data-testid={`hardware-select-hinge-${hItem.id}`}
                                      onClick={() => {
                                        const res = setModuleHingeHardware(hItem.id, true);
                                        if (!res.ok) {
                                          setHardwareValidationErrorMsg(res.error || null);
                                        } else {
                                          setHardwareValidationErrorMsg(null);
                                        }
                                      }}
                                      className={`w-full px-2.5 py-1.5 rounded-xl border flex items-center justify-between gap-2 text-left transition cursor-pointer ${
                                        isSelH
                                          ? "bg-[#EFF6FF] border-[#2563EB] font-bold text-[#111827]"
                                          : "bg-white hover:bg-[#F1F5F9] border-[#E2E8F0] text-[#111827]"
                                      }`}
                                    >
                                      <div className="min-w-0">
                                        <div className="text-[13px] truncate">{hItem.name}</div>
                                        <div className="text-xs text-[#64748B] font-mono">
                                          SKU: {hItem.sku} • Kapak: {hItem.doorThicknessLimitsMm?.[0]}–{hItem.doorThicknessLimitsMm?.[1]}mm • €{(hItem.unitPriceEur ?? 0).toFixed(2)}/ad.
                                        </div>
                                      </div>
                                      {renderManufacturerBadge(hItem.manufacturerId)}
                                    </button>
                                  );
                                })}
                            </div>
                          </div>
                        </div>
                      )}
                    </section>

                    {/* GRUP B: ÇEKMECE RAYI */}
                    <section
                      data-testid="hardware-group-runners"
                      className="space-y-1.5 pt-1 border-t border-[#E2E8F0]"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedHwGroup((prev) => (prev === "runner" ? null : "runner"))
                        }
                        className="w-full flex items-center justify-between text-left cursor-pointer"
                      >
                        <span className="text-xs font-bold text-[#111827]">Çekmece Rayı</span>
                        <span className="text-[13px] text-[#64748B]">
                          {expandedHwGroup === "runner" ? "▴" : "▾"}
                        </span>
                      </button>

                      <div
                        data-testid="hardware-active-runner-card"
                        onClick={() =>
                          setExpandedHwGroup((prev) => (prev === "runner" ? null : "runner"))
                        }
                        className={`p-2.5 rounded-2xl border bg-white hover:bg-[#F8FAFC] flex items-center justify-between gap-2.5 transition cursor-pointer shadow-2xs ${
                          expandedHwGroup === "runner"
                            ? "border-2 border-[#2563EB]"
                            : "border-[#CBD5E1]"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="p-1 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] shrink-0">
                            {renderHardwareProductIllustration(
                              activeRunnerObj.manufacturerId === "mfr_blum"
                                ? "runner_blum"
                                : "runner_std",
                              "sm"
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-[#111827] truncate">
                              {activeRunnerObj.id.includes("tandembox")
                                ? "Blum Tandem"
                                : activeRunnerObj.id.includes("movento")
                                ? "Blum Movento 760H"
                                : activeRunnerObj.id.includes("hettich")
                                ? "Hettich AvanTech YOU"
                                : "Blum LEGRABOX pure"}
                            </div>
                            <div className="text-xs text-[#64748B] truncate mt-0.5">
                              Tam açılım • Yavaş kapanma • NL {optimalNl} mm • {activeRunnerObj.loadCapacityKg} kg
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {renderManufacturerBadge(activeRunnerObj.manufacturerId)}
                          <ChevronRight className="w-4 h-4 text-[#64748B]" />
                        </div>
                      </div>

                      {expandedHwGroup === "runner" && (
                        <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-[#CBD5E1] space-y-2.5">
                          <div className="flex items-center justify-between text-xs text-[#475569]">
                            <span>
                              SKU: <b className="font-mono text-[#111827]">{activeRunnerObj.sku}</b> • Kapasite: <b>{activeRunnerObj.loadCapacityKg} kg</b>
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded font-bold ${
                                isRunnerFullyVerified
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-amber-100 text-amber-900"
                              }`}
                            >
                              {isRunnerFullyVerified ? "Fabrika Doğrulandı" : "Doğrulanmadı"}
                            </span>
                          </div>

                          <div className="space-y-1">
                            <span className="text-xs font-bold text-[#111827] block">
                              Ray & Çekmece Sistemi Seçin:
                            </span>
                            <div className="space-y-1">
                              {hardwareCatalog
                                .filter(
                                  (h) =>
                                    h.familyId === "fam_drawer_box" ||
                                    h.familyId === "fam_runner_concealed"
                                )
                                .map((rItem) => {
                                  const isSelR = curRunnerId === rItem.id;
                                  return (
                                    <button
                                      key={rItem.id}
                                      type="button"
                                      data-testid={`hardware-select-runner-${rItem.id}`}
                                      onClick={() => {
                                        const res = setModuleDrawerRunnerHardware(
                                          rItem.id,
                                          optimalNl,
                                          true
                                        );
                                        if (!res.ok) {
                                          setHardwareValidationErrorMsg(res.error || null);
                                        } else {
                                          setHardwareValidationErrorMsg(null);
                                        }
                                      }}
                                      className={`w-full px-2.5 py-1.5 rounded-xl border flex items-center justify-between gap-2 text-left transition cursor-pointer ${
                                        isSelR
                                          ? "bg-[#EFF6FF] border-[#2563EB] font-bold text-[#111827]"
                                          : "bg-white hover:bg-[#F1F5F9] border-[#E2E8F0] text-[#111827]"
                                      }`}
                                    >
                                      <div className="min-w-0">
                                        <div className="text-[13px] truncate">{rItem.name}</div>
                                        <div className="text-xs text-[#64748B] font-mono">
                                          SKU: {rItem.sku} • {rItem.loadCapacityKg}kg • Taban Düşümü: LW-{rItem.drawerCuttingFormula?.bottomWidthDeductionMm || 35}mm • €{(rItem.unitPriceEur ?? 0).toFixed(2)}
                                        </div>
                                      </div>
                                      {renderManufacturerBadge(rItem.manufacturerId)}
                                    </button>
                                  );
                                })}
                            </div>
                          </div>

                          {/* Nominal Runner Length (NL mm) Picker with Depth Compatibility Check */}
                          <div className="space-y-1 pt-1 border-t border-[#E2E8F0]">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-[#111827]">
                                Ray Uzunluğu (NL mm):
                              </span>
                              <span className="text-xs font-mono text-[#64748B]">
                                Net İç Derinlik: {netInnerDepth} mm
                              </span>
                            </div>
                            <div className="grid grid-cols-6 gap-1">
                              {[350, 400, 450, 500, 550, 600].map((nlVal) => {
                                const fitsDepth = nlVal <= netInnerDepth - 10;
                                const isSelNl = optimalNl === nlVal;
                                return (
                                  <button
                                    key={nlVal}
                                    type="button"
                                    data-testid={`hardware-runner-nl-${nlVal}`}
                                    onClick={() => {
                                      const res = setModuleDrawerRunnerHardware(
                                        curRunnerId,
                                        nlVal,
                                        true
                                      );
                                      if (!res.ok) {
                                        setHardwareValidationErrorMsg(res.error || null);
                                      } else {
                                        setHardwareValidationErrorMsg(null);
                                      }
                                    }}
                                    className={`py-1 rounded-lg font-mono text-xs font-bold border transition cursor-pointer ${
                                      isSelNl
                                        ? "bg-[#2563EB] text-white border-[#1D4ED8]"
                                        : fitsDepth
                                        ? "bg-white hover:bg-[#EFF6FF] text-[#111827] border-[#CBD5E1]"
                                        : "bg-red-50/70 text-red-400 border-red-200"
                                    }`}
                                  >
                                    {nlVal}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </section>

                    {/* GRUP C: AÇILMA MEKANİZMALARI (Standart | Sürgülü | Katlanır | Kalkar — Synced with Kapak Screen) */}
                    <section
                      data-testid="hardware-group-opening-mechanisms"
                      className="space-y-2 pt-1 border-t border-[#E2E8F0]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#111827]">
                          Açılma Mekanizmaları
                        </span>
                        <span className="text-xs text-[#64748B]">Kapak ekranıyla senkron</span>
                      </div>

                      <div className="grid grid-cols-4 gap-1.5">
                        {[
                          {
                            id: "standart",
                            label: "Standart",
                            active: curDoorSys.startsWith("hinged"),
                            compatible: true,
                            svg: (
                              <svg viewBox="0 0 36 28" className="w-8 h-6" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <rect x="4" y="3" width="28" height="22" rx="1.5" />
                                <line x1="18" y1="3" x2="18" y2="25" />
                              </svg>
                            ),
                            onSelect: () => {
                              setHardwareValidationErrorMsg(null);
                              setBayV4DoorConfig(activeBayIndex, {
                                doorSystemId:
                                  currentBayWidthMm >= 700 ? "hinged_double" : "hinged_single",
                                hardwareProductId: "hw_blum_71b3550",
                              });
                            },
                          },
                          {
                            id: "surgulu",
                            label: "Sürgülü",
                            active: curDoorSys.startsWith("sliding"),
                            compatible: isSlidingCompatible && depth >= 580,
                            svg: (
                              <svg viewBox="0 0 36 28" className="w-8 h-6" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <rect x="4" y="3" width="28" height="22" rx="1.5" />
                                <line x1="18" y1="3" x2="18" y2="25" strokeDasharray="2 2" />
                                <path d="M12 14h12M21 11l3 3-3 3" />
                              </svg>
                            ),
                            onSelect: () => {
                              if (!isSlidingCompatible || depth < 580) {
                                setHardwareValidationErrorMsg(
                                  "Sürgülü kapak mekanizması (Hettich TopLine L) için en az 2 bölme, ≥900mm genişlik ve ≥580mm derinlik gerekir."
                                );
                                return;
                              }
                              setHardwareValidationErrorMsg(null);
                              setBayV4DoorConfig(activeBayIndex, {
                                doorSystemId: "sliding_top_hung",
                                hardwareProductId: "hw_hettich_topline_l",
                              });
                            },
                          },
                          {
                            id: "katlanir",
                            label: "Katlanır",
                            active: curDoorSys === "folding_side",
                            compatible: depth >= 500,
                            svg: (
                              <svg viewBox="0 0 36 28" className="w-8 h-6" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <rect x="4" y="3" width="28" height="22" rx="1.5" />
                                <polyline points="14,3 20,14 14,25" />
                              </svg>
                            ),
                            onSelect: () => {
                              if (depth < 500) {
                                setHardwareValidationErrorMsg(
                                  "Katlanır kapak mekanizması (Hettich WingLine L) en az 500mm gövde derinliği gerektirir."
                                );
                                return;
                              }
                              setHardwareValidationErrorMsg(null);
                              setBayV4DoorConfig(activeBayIndex, {
                                doorSystemId: "folding_side",
                                hardwareProductId: "hw_hettich_wingline_l",
                              });
                            },
                          },
                          {
                            id: "kalkar",
                            label: "Kalkar",
                            active: curDoorSys.startsWith("lift"),
                            compatible: isLiftCompatible,
                            svg: (
                              <svg viewBox="0 0 36 28" className="w-8 h-6" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <rect x="4" y="5" width="28" height="18" rx="1.5" />
                                <path d="M18 19V9M14 13l4-4 4 4" />
                              </svg>
                            ),
                            onSelect: () => {
                              if (!isLiftCompatible) {
                                setHardwareValidationErrorMsg(
                                  `Kalkar kapak mekanizması (Blum AVENTOS) yüksekliği ≤1150mm olan üst dolaplar içindir (Mevcut boy: ${height}mm).`
                                );
                                return;
                              }
                              setHardwareValidationErrorMsg(null);
                              setBayV4DoorConfig(activeBayIndex, {
                                doorSystemId: height <= 650 ? "lift_up_stay" : "lift_bi_fold",
                                hardwareProductId:
                                  height <= 650
                                    ? "hw_blum_aventos_hk_27"
                                    : "hw_blum_aventos_hf_25",
                              });
                            },
                          },
                        ].map((mCard) => (
                          <button
                            key={mCard.id}
                            type="button"
                            data-testid={`hardware-opening-card-${mCard.id}`}
                            onClick={mCard.onSelect}
                            className={`py-2 px-1 rounded-2xl border flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                              mCard.active
                                ? "bg-[#EFF6FF] border-2 border-[#2563EB] text-[#111827] shadow-2xs"
                                : mCard.compatible
                                ? "bg-white hover:bg-[#F8FAFC] border-[#CBD5E1] text-[#475569]"
                                : "bg-stone-50 border-stone-200 text-stone-400"
                            }`}
                          >
                            {mCard.svg}
                            <span className="text-xs font-bold text-[#111827]">
                              {mCard.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </section>

                    {/* GRUP D: AYDINLATMA (Matches Birim_Tasarim_5_Donanim_Mekanizmalar.png: Toggle + "LED Profil (Gömme) 4000K • 24 V • Sensörlü") */}
                    <section
                      data-testid="hardware-group-lighting"
                      className="space-y-2 pt-1 border-t border-[#E2E8F0]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#111827]">Aydınlatma</span>
                        <button
                          type="button"
                          data-testid="hardware-led-master-toggle"
                          onClick={() =>
                            toggleModuleLedLighting(!hasActiveLed, {
                              ledType: activeLedType,
                              colorTempK: ledKelvin,
                              sensorType: ledSensor,
                            })
                          }
                          className={`w-10 h-5 rounded-full p-0.5 flex items-center transition cursor-pointer ${
                            hasActiveLed
                              ? "bg-[#2563EB] justify-end"
                              : "bg-[#CBD5E1] justify-start"
                          }`}
                          title="Dolap içi LED aydınlatmayı aç / kapat"
                        >
                          <span className="w-4 h-4 rounded-full bg-white shadow-2xs" />
                        </button>
                      </div>

                      <div
                        data-testid="hardware-active-led-card"
                        onClick={() =>
                          setExpandedHwGroup((prev) =>
                            prev === "lighting" ? null : "lighting"
                          )
                        }
                        className={`p-2.5 rounded-2xl border bg-white hover:bg-[#F8FAFC] flex items-center justify-between gap-2.5 transition cursor-pointer shadow-2xs ${
                          expandedHwGroup === "lighting"
                            ? "border-2 border-[#2563EB]"
                            : "border-[#CBD5E1]"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {renderHardwareProductIllustration("led_recessed", "sm")}
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-[#111827] truncate">
                              {activeLedType === "led_vertical_strip"
                                ? "LED Profil (Dikey Yan Dikme)"
                                : activeLedType === "led_rod_strip"
                                ? "LED Askı Borusu (Sensörlü)"
                                : "LED Profil (Gömme)"}
                            </div>
                            <div className="text-xs text-[#64748B] truncate mt-0.5">
                              {ledKelvin}K • 24 V •{" "}
                              {ledSensor === "ir_door"
                                ? "Kapak IR Sensörlü"
                                : ledSensor === "pir_motion"
                                ? "PIR Hareket Sensörlü"
                                : "Manuel Anahtarlı"}{" "}
                              {hasActiveLed ? "(Aktif)" : "(Pasif)"}
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-[#64748B] shrink-0" />
                      </div>

                      {expandedHwGroup === "lighting" && (
                        <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-[#CBD5E1] space-y-2.5">
                          <div className="grid grid-cols-3 gap-1">
                            {[
                              { id: "led_profile" as const, label: "Üst & Raf Gömme" },
                              { id: "led_vertical_strip" as const, label: "Dikme Boy LED" },
                              { id: "led_rod_strip" as const, label: "Askı Borusu LED" },
                            ].map((lt) => (
                              <button
                                key={lt.id}
                                type="button"
                                data-testid={`hardware-led-type-${lt.id}`}
                                onClick={() =>
                                  toggleModuleLedLighting(true, {
                                    ledType: lt.id,
                                    colorTempK: ledKelvin,
                                    sensorType: ledSensor,
                                  })
                                }
                                className={`py-1.5 px-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
                                  hasActiveLed && activeLedType === lt.id
                                    ? "bg-[#2563EB] text-white border-[#1D4ED8]"
                                    : "bg-white text-[#111827] border-[#CBD5E1]"
                                }`}
                              >
                                {lt.label}
                              </button>
                            ))}
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <span className="text-xs font-semibold text-[#475569] block">
                                Renk Sıcaklığı:
                              </span>
                              <div className="grid grid-cols-2 gap-1">
                                {[3000, 4000].map((kelvin) => (
                                  <button
                                    key={kelvin}
                                    type="button"
                                    data-testid={`hardware-led-kelvin-${kelvin}`}
                                    onClick={() =>
                                      toggleModuleLedLighting(true, {
                                        ledType: activeLedType,
                                        colorTempK: kelvin as 3000 | 4000,
                                        sensorType: ledSensor,
                                      })
                                    }
                                    className={`py-1 rounded-lg font-mono text-xs font-bold border cursor-pointer ${
                                      ledKelvin === kelvin
                                        ? "bg-[#EFF6FF] border-[#2563EB] text-[#1D4ED8]"
                                        : "bg-white border-[#CBD5E1] text-[#475569]"
                                    }`}
                                  >
                                    {kelvin}K
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="space-y-1">
                              <span className="text-xs font-semibold text-[#475569] block">
                                Sensör Tipi:
                              </span>
                              <select
                                value={ledSensor}
                                onChange={(e) =>
                                  toggleModuleLedLighting(true, {
                                    ledType: activeLedType,
                                    colorTempK: ledKelvin,
                                    sensorType: e.target.value as
                                      | "ir_door"
                                      | "pir_motion"
                                      | "manual_switch",
                                  })
                                }
                                className="w-full px-2 py-1 rounded-lg bg-white border border-[#CBD5E1] text-xs font-bold text-[#111827]"
                              >
                                <option value="ir_door">Kapak IR Sensör (833.89.142)</option>
                                <option value="pir_motion">PIR Hareket Sensörü</option>
                                <option value="manual_switch">Manuel Dokunmatik</option>
                              </select>
                            </div>
                          </div>

                          {/* Parametric CNC Setback & Channel Dimensions in Architect Mode */}
                          <div className="pt-2 border-t border-[#CBD5E1] space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-[#334155]">
                                Önden Mesafe (Setback):
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    toggleModuleLedLighting(true, {
                                      alignShelfAndSide:
                                        activeModule.carcass.ledAlignShelfAndSide === false,
                                    })
                                  }
                                  className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold border cursor-pointer ${
                                    activeModule.carcass.ledAlignShelfAndSide !== false
                                      ? "bg-[#1E293B] text-white border-[#1E293B]"
                                      : "bg-white text-[#475569] border-[#CBD5E1]"
                                  }`}
                                >
                                  {activeModule.carcass.ledAlignShelfAndSide !== false
                                    ? "Raf+Dikme Ortak Aks"
                                    : "Ayrı Aks"}
                                </button>
                                <span className="font-mono text-xs font-bold text-[#0F172A]">
                                  {activeModule.carcass.ledFrontSetbackMm ?? 75} mm
                                </span>
                              </div>
                            </div>
                            <input
                              type="range"
                              min={35}
                              max={Math.max(60, Math.min(240, activeModule.dimensions.depth - 45))}
                              step={1}
                              value={activeModule.carcass.ledFrontSetbackMm ?? 75}
                              onChange={(e) =>
                                toggleModuleLedLighting(true, {
                                  frontSetbackMm: Number(e.target.value),
                                })
                              }
                              className="w-full accent-[#2563EB] h-1.5 bg-[#CBD5E1] rounded-lg cursor-pointer"
                            />

                            <div className="grid grid-cols-2 gap-2 pt-1">
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[11px] font-semibold text-[#475569]">
                                  <span>Kanal Genişliği</span>
                                  <span className="font-mono font-bold text-[#0F172A]">
                                    {activeModule.carcass.ledChannelWidthMm ?? 12} mm
                                  </span>
                                </div>
                                <input
                                  type="range"
                                  min={6}
                                  max={30}
                                  step={1}
                                  value={activeModule.carcass.ledChannelWidthMm ?? 12}
                                  onChange={(e) =>
                                    toggleModuleLedLighting(true, {
                                      channelWidthMm: Number(e.target.value),
                                    })
                                  }
                                  className="w-full accent-[#2563EB] h-1.5 bg-[#CBD5E1] rounded-lg cursor-pointer"
                                />
                              </div>

                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[11px] font-semibold text-[#475569]">
                                  <span>Kanal Derinliği</span>
                                  <span className="font-mono font-bold text-[#0F172A]">
                                    {activeModule.carcass.ledChannelDepthMm ?? 8} mm
                                  </span>
                                </div>
                                <input
                                  type="range"
                                  min={4}
                                  max={Math.max(5, (activeModule.carcass.panelThickness || 18) - 4)}
                                  step={1}
                                  value={activeModule.carcass.ledChannelDepthMm ?? 8}
                                  onChange={(e) =>
                                    toggleModuleLedLighting(true, {
                                      channelDepthMm: Number(e.target.value),
                                    })
                                  }
                                  className="w-full accent-[#2563EB] h-1.5 bg-[#CBD5E1] rounded-lg cursor-pointer"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="p-2 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-amber-950">
                            <b>⚡ CNC &amp; Elektriksel Doğrulama:</b> BOM listesine seçilen{" "}
                            <b>
                              {activeModule.carcass.ledChannelWidthMm ?? 12}×
                              {activeModule.carcass.ledChannelDepthMm ?? 8} mm
                            </b>{" "}
                            gömme profil (önden {activeModule.carcass.ledFrontSetbackMm ?? 75} mm aks),
                            24V trafo ve sensör otomatik işlenir.
                          </div>
                        </div>
                      )}
                    </section>

                    {/* GRUP E: ASKILIK VE AKSESUARLAR */}
                    <section
                      data-testid="hardware-group-accessories"
                      className="space-y-1.5 pt-1 border-t border-[#E2E8F0]"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedHwGroup((prev) =>
                            prev === "accessories" ? null : "accessories"
                          )
                        }
                        className="w-full flex items-center justify-between text-left cursor-pointer"
                      >
                        <span className="text-xs font-bold text-[#111827]">
                          Askılık ve Aksesuarlar (Bölme {activeBayIndex + 1})
                        </span>
                        <span className="text-[13px] text-[#64748B]">
                          {expandedHwGroup === "accessories" ? "▴" : "▾"}
                        </span>
                      </button>

                      {expandedHwGroup === "accessories" && (
                        <div className="p-2.5 rounded-2xl bg-[#F8FAFC] border border-[#CBD5E1] space-y-2">
                          <div className="grid grid-cols-3 gap-2 p-0.5">
                            {[
                              {
                                id: "rail",
                                label: "Oval Askılık",
                                sku: "HW_HANGING_RAIL",
                                onClick: () => addHangingRail(activeBayIndex),
                              },
                              {
                                id: "lift",
                                label: "Asansör 10kg",
                                sku: "805.20.232",
                                onClick: () => addSpecialFitting(activeBayIndex, "wardrobe_lift"),
                              },
                              {
                                id: "trouser",
                                label: "Pantolonluk",
                                sku: "807.95.122",
                                onClick: () => addSpecialFitting(activeBayIndex, "trouser_rack"),
                              },
                              {
                                id: "shoe",
                                label: "Ayakkabılık",
                                sku: "807.96.310",
                                onClick: () => addSpecialFitting(activeBayIndex, "shoe_rack"),
                              },
                              {
                                id: "tie",
                                label: "Kravatlık",
                                sku: "HW_FITTING_TIE",
                                onClick: () => addSpecialFitting(activeBayIndex, "tie_rack"),
                              },
                              {
                                id: "belt",
                                label: "Kemerlik",
                                sku: "HW_FITTING_BELT",
                                onClick: () => addSpecialFitting(activeBayIndex, "belt_rack"),
                              },
                            ].map((accItem) => (
                              <button
                                key={accItem.id}
                                type="button"
                                data-testid={`hardware-acc-add-${accItem.id}`}
                                onClick={accItem.onClick}
                                className="p-2 rounded-xl bg-white hover:bg-[#EFF6FF] border border-[#E2E8F0] hover:border-[#2563EB] text-left transition cursor-pointer"
                              >
                                <div className="text-xs font-bold text-[#111827] truncate">
                                  + {accItem.label}
                                </div>
                                <div className="text-xs font-mono text-[#64748B] truncate">
                                  {accItem.sku}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </section>

                    {/* GRUP F: TEKNİK AYARLAR (Matches Birim_Tasarim_5_Donanim_Mekanizmalar.png bottom-right: Menteşe Delik Şablonu | Çekmece Delik Seti | CNC / Üretim Notu) */}
                    <section
                      data-testid="hardware-group-technical-settings"
                      className="space-y-2.5 pt-2 border-t border-[#E2E8F0]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#111827]">Teknik Ayarlar</span>
                        <span className="text-xs font-mono text-[#64748B]">
                          System 32 • CNC
                        </span>
                      </div>

                      {/* Menteşe Delik Şablonu */}
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-[13px] font-medium text-[#475569] shrink-0">
                          Menteşe Delik Şablonu
                        </label>
                        <select
                          data-testid="hardware-tech-hinge-drilling-select"
                          value={curDrillTplId}
                          onChange={(e) =>
                            updateCarcassConfig({
                              hingeDrillingTemplateId: e.target.value,
                            })
                          }
                          className="w-44 px-2.5 py-1.5 rounded-xl bg-white border border-[#CBD5E1] text-[13px] font-semibold text-[#111827] cursor-pointer"
                        >
                          <option value="tpl_drill_blum_hinge_45x95">
                            Birim Standart (Blum 45×9.5)
                          </option>
                          <option value="tpl_drill_blum_155_zero">
                            Blum 155° Sıfır Çıkıntı (11.7mm)
                          </option>
                          <option value="tpl_drill_hettich_th52">
                            Hettich Sensys TH52 (52×5.5)
                          </option>
                          <option value="tpl_drill_salice_48x9">
                            Salice Silentia+ (48×9.0)
                          </option>
                          <option value="tpl_drill_grass_tiomos">
                            Grass Tiomos (45×9.5)
                          </option>
                        </select>
                      </div>

                      {/* Çekmece Delik Seti */}
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-[13px] font-medium text-[#475569] shrink-0">
                          Çekmece Delik Seti
                        </label>
                        <select
                          data-testid="hardware-tech-drawer-drilling-select"
                          value={curDrawerDrillSet}
                          onChange={(e) =>
                            updateCarcassConfig({
                              drawerDrillingSetId: e.target.value,
                            })
                          }
                          className="w-44 px-2.5 py-1.5 rounded-xl bg-white border border-[#CBD5E1] text-[13px] font-semibold text-[#111827] cursor-pointer"
                        >
                          <option value="blum_tandembox">Blum Tandem (LW-75mm)</option>
                          <option value="blum_legrabox">Blum LEGRABOX (LW-35mm)</option>
                          <option value="blum_movento">Blum Movento 760H (LW-42mm)</option>
                          <option value="hettich_avantech">Hettich AvanTech (LW-24mm)</option>
                        </select>
                      </div>

                      {/* CNC / Üretim Notu */}
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-[13px] font-medium text-[#475569] shrink-0">
                          CNC / Üretim Notu
                        </label>
                        <input
                          type="text"
                          data-testid="hardware-tech-cnc-note-input"
                          value={cncNote}
                          onChange={(e) =>
                            updateCarcassConfig({
                              cncProductionNote: e.target.value,
                            })
                          }
                          placeholder="Özel işlem yok"
                          className="w-44 px-2.5 py-1.5 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] text-[13px] font-medium text-[#111827] focus:bg-white focus:outline-none focus:border-[#2563EB]"
                        />
                      </div>
                    </section>

                    {/* GRUP G: BLUM GÖVDE TASARLAYICI (CABINET CONFIGURATOR / E-SERVICES) & BXF ÜRETİM PAKETİ */}
                    {activeBlumEngineering && (
                      <section
                        data-testid="hardware-group-blum-bxf"
                        className="p-3 rounded-2xl bg-[#EFF6FF]/60 border border-[#BFDBFE] space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <span className="text-xs font-extrabold text-[#1E3A8A] block">
                              🟦 Blum Gövde & Donanım Asistanı (BXF / EASYSTICK)
                            </span>
                            <span className="text-[11px] text-[#475569]">
                              KB/LW İç-Dış Ölçü • Kapak Ağırlığı (kg) & LF • MINIPRESS BXF
                            </span>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                              activeBlumEngineering.collisionFree
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                : "bg-amber-100 text-amber-900 border border-amber-300"
                            }`}
                          >
                            {activeBlumEngineering.collisionFree ? "✓ Çakışma Yok" : "⚠ Uyarı"}
                          </span>
                        </div>

                        {/* 1-Click Blum Cabinet Application Wizards */}
                        <div className="space-y-1">
                          <span className="text-[11px] font-bold text-[#334155] block">
                            Hızlı Blum Gövde Uygulamaları (Tek Tıkla Kurulum):
                          </span>
                          <div className="grid grid-cols-2 gap-1.5">
                            {[
                              {
                                id: "blum_space_tower" as const,
                                title: "SPACE TOWER",
                                sub: "155° Menteşe + 4 İç LEGRABOX",
                              },
                              {
                                id: "blum_aventos_wall" as const,
                                title: "AVENTOS HF top",
                                sub: "Katlanır Kalkar Üst Dolap",
                              },
                              {
                                id: "blum_legrabox_base" as const,
                                title: "LEGRABOX 3 Çekmece",
                                sub: "40kg Tam Açılım Kasa Seti",
                              },
                              {
                                id: "blum_155_wardrobe" as const,
                                title: "CLIP top 155°",
                                sub: "Sıfır Çıkıntı Gardırop Seti",
                              },
                            ].map((wp) => (
                              <button
                                key={wp.id}
                                type="button"
                                data-testid={`blum-wizard-preset-${wp.id}`}
                                onClick={() => applyBlumQuickWizardPreset(wp.id)}
                                className="p-2 rounded-xl bg-white hover:bg-[#DBEAFE] border border-[#BFDBFE] text-left transition cursor-pointer"
                              >
                                <div className="text-xs font-bold text-[#1E3A8A] truncate">
                                  {wp.title}
                                </div>
                                <div className="text-[10px] text-[#475569] truncate">{wp.sub}</div>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Live Blum KB/LW, Door Weight & AVENTOS LF Matrix */}
                        <div className="p-2.5 rounded-xl bg-white border border-[#E2E8F0] space-y-1.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-[#475569]">Dış (KB×KH×KT):</span>
                            <span className="font-mono font-bold text-[#111827]">
                              {activeBlumEngineering.outerDimensions.KB}×
                              {activeBlumEngineering.outerDimensions.KH}×
                              {activeBlumEngineering.outerDimensions.KT} mm
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[#475569]">Net İç (LW×LH×LT):</span>
                            <span className="font-mono font-bold text-[#2563EB]">
                              {activeBlumEngineering.innerDimensions.LW}×
                              {activeBlumEngineering.innerDimensions.LH}×
                              {activeBlumEngineering.innerDimensions.LT} mm
                            </span>
                          </div>
                          {activeBlumEngineering.doors[activeBayIndex] && (
                            <>
                              <div className="flex items-center justify-between">
                                <span className="text-[#475569]">
                                  Kapak Ağırlığı (Bölme {activeBayIndex + 1}):
                                </span>
                                <span className="font-mono font-bold text-emerald-700">
                                  {activeBlumEngineering.doors[activeBayIndex].estimatedWeightKg} kg •{" "}
                                  {activeBlumEngineering.doors[activeBayIndex].recommendedHingeCount}×{" "}
                                  {activeBlumEngineering.doors[activeBayIndex].hingeSku}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-[#475569]">AVENTOS Güç Faktörü (LF):</span>
                                <span className="font-mono font-bold text-[#1E3A8A]">
                                  LF = {activeBlumEngineering.doors[activeBayIndex].aventosPowerFactorLf}
                                </span>
                              </div>
                            </>
                          )}
                          {activeBlumEngineering.drawers[0] && (
                            <div className="flex items-center justify-between pt-1 border-t border-[#F1F5F9]">
                              <span className="text-[#475569]">Çekmece Ahşap Taban:</span>
                              <span className="font-mono font-bold text-[#111827]">
                                {activeBlumEngineering.drawers[0].woodenBottomWidthMm}×
                                {activeBlumEngineering.drawers[0].woodenBottomDepthMm} mm
                              </span>
                            </div>
                          )}
                        </div>

                        {activeBlumEngineering.collisionWarnings.length > 0 && (
                          <div className="p-2 rounded-xl bg-amber-50 border border-amber-300 text-[11px] text-amber-900 space-y-1">
                            {activeBlumEngineering.collisionWarnings.map((cw, ci) => (
                              <div key={ci}>• {cw}</div>
                            ))}
                          </div>
                        )}

                        {/* 1-Click Blum .BXF Download & Import Buttons */}
                        <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                          <button
                            type="button"
                            data-testid="studio-export-blum-bxf-btn"
                            onClick={() => {
                              const xml = exportBlumBxfString();
                              const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = `Blum_Easystick_${project.id}_v${project.version}.bxf`;
                              document.body.appendChild(a);
                              a.click();
                              setTimeout(() => {
                                if (a.parentNode) a.parentNode.removeChild(a);
                                URL.revokeObjectURL(url);
                              }, 1500);
                            }}
                            className="py-2 px-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition cursor-pointer"
                          >
                            <span>🟦 .BXF İndir (EASYSTICK)</span>
                          </button>

                          <button
                            type="button"
                            data-testid="studio-export-cutlist-dxf-btn"
                            onClick={() => {
                              const dxf = exportAllPanelsDxfString();
                              const blob = new Blob([dxf], { type: "application/dxf" });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = `Parca_Kesim_Listesi_CNC_${project.id}_v${project.version}.dxf`;
                              document.body.appendChild(a);
                              a.click();
                              setTimeout(() => {
                                if (a.parentNode) a.parentNode.removeChild(a);
                                URL.revokeObjectURL(url);
                              }, 1500);
                            }}
                            className="col-span-2 py-2 px-2.5 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition cursor-pointer"
                          >
                            <span>📐 Parça Listesi Kesim & CNC Delik İndir (.DXF)</span>
                          </button>

                          <button
                            type="button"
                            data-testid="studio-export-erp-nesting-json-btn"
                            onClick={() => {
                              const jsonStr = exportErpNestingJsonString();
                              const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = `Birim_ERP_Nesting_${project.id}_v${project.version}.json`;
                              document.body.appendChild(a);
                              a.click();
                              setTimeout(() => {
                                if (a.parentNode) a.parentNode.removeChild(a);
                                URL.revokeObjectURL(url);
                              }, 1500);
                            }}
                            className="py-2 px-2.5 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition cursor-pointer"
                            title="Birim Portal ERP Nesting modülüyle %100 uyumlu proje, plaka, parça, U1/U2/K1/K2 kenar bandı ve kanal JSON paketini indir"
                          >
                            <span>📦 ERP Nesting (.JSON)</span>
                          </button>

                          <button
                            type="button"
                            data-testid="studio-open-erp-nesting-modal-btn"
                            onClick={() => {
                              setBomModalInitialTab("nesting");
                              setIsBomModalOpen(true);
                            }}
                            className="py-2 px-2.5 rounded-xl bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition cursor-pointer"
                            title="Canlı 2D Birim ERP Plaka Yerleşimi, Kesim Reçetesi, Selco CSV ve CNC G-Code merkezini aç"
                          >
                            <span>🪚 ERP Plaka & Selco</span>
                          </button>

                          <label
                            data-testid="studio-import-blum-bxf-btn"
                            className="py-2 px-2.5 rounded-xl bg-white hover:bg-[#F8FAFC] border border-[#2563EB] text-[#1D4ED8] text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                          >
                            <span>📥 .BXF İçe Aktar</span>
                            <input
                              type="file"
                              accept=".bxf,.xml"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const text = await file.text();
                                const res = importBlumBxfFile(text, false);
                                if (res.ok) {
                                  setApprovalBanner({
                                    ok: true,
                                    text: `✓ Blum BXF dosyası başarıyla yüklendi: ${res.name}`,
                                  });
                                } else {
                                  setApprovalBanner({
                                    ok: false,
                                    text: res.error || "BXF dosyası okunamadı.",
                                  });
                                }
                                e.target.value = "";
                              }}
                            />
                          </label>
                        </div>
                      </section>
                    )}
                  </div>
                );
              })()}

              {/* 3. V4 UNIVERSAL DOOR, HANDLE, OPENING & HARDWARE SYSTEM */}
              {!isSimpleBlumMode && activeBay && (studioInspectorTab === "all" || studioInspectorTab === "door") && (
                <V3CollapsibleSection
                  title="3. Kapak, Kulp & Donanım (V4)"
                  badge={activeBay.door.doorSystemId || activeBay.door.type}
                  defaultOpen={true}
                >
                  <div className="space-y-2.5 text-xs">
                    {/* PROMINENT DOOR OPENING DIRECTION SWITCHER (SOL AÇILIR vs SAĞ AÇILIR vs ÇİFT) */}
                    <div
                      data-testid="studio-sec3-door-direction-box"
                      className="p-2.5 rounded-xl bg-[#FFFFFF] border border-[#CBD5E1] space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-extrabold text-[#1C1917]">
                          🚪 Kapak Açılış Yönü (Menteşe Tarafı)
                        </span>
                        <button
                          type="button"
                          onClick={() => flipActiveDoorDirection(activeBayIndex)}
                          className="px-2 py-0.5 rounded-md bg-[#EEF3F8] hover:bg-[#E4ECF4] text-[#1C1917] text-[#111827] text-xs font-bold cursor-pointer"
                        >
                          🔄 Yönü Ters Çevir
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2 p-0.5">
                        {[
                          {
                            id: "single_left",
                            title: "Sol Menteşeli (Sola Doğru Açılır, Kulp Sağda)",
                            label: "⬅️ Sola Açılır",
                            svg: (
                              <svg viewBox="0 0 28 24" className="w-6 h-5" fill="none">
                                <rect x="4" y="3" width="20" height="18" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
                                <line x1="6" y1="6" x2="6" y2="18" stroke="#5B8A72" strokeWidth="2.5" />
                                <circle cx="20" cy="12" r="1.6" fill="#D97706" />
                              </svg>
                            ),
                          },
                          {
                            id: "single_right",
                            title: "Sağ Menteşeli (Sağa Doğru Açılır, Kulp Solda)",
                            label: "➡️ Sağa Açılır",
                            svg: (
                              <svg viewBox="0 0 28 24" className="w-6 h-5" fill="none">
                                <rect x="4" y="3" width="20" height="18" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
                                <line x1="22" y1="6" x2="22" y2="18" stroke="#5B8A72" strokeWidth="2.5" />
                                <circle cx="8" cy="12" r="1.6" fill="#D97706" />
                              </svg>
                            ),
                          },
                          {
                            id: "double",
                            title: "Çift Kanatlı (Ortadan İki Yana Açılır)",
                            label: "↔️ Çift Kanat",
                            svg: (
                              <svg viewBox="0 0 28 24" className="w-6 h-5" fill="none">
                                <rect x="3" y="3" width="22" height="18" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
                                <line x1="14" y1="3" x2="14" y2="21" stroke="currentColor" strokeWidth="1.4" />
                                <circle cx="11.5" cy="12" r="1.3" fill="#D97706" />
                                <circle cx="16.5" cy="12" r="1.3" fill="#D97706" />
                              </svg>
                            ),
                          },
                        ].map((dirOpt) => {
                          const isCurrentDir =
                            dirOpt.id === "double"
                              ? activeBay.door.type === "double" || activeBay.door.type === "inset_double"
                              : dirOpt.id === "single_right"
                              ? activeBay.door.type.includes("right")
                              : activeBay.door.type.includes("left");
                          return (
                            <button
                              key={dirOpt.id}
                              type="button"
                              data-testid={`studio-sec3-dir-${dirOpt.id}`}
                              title={dirOpt.title}
                              onClick={() =>
                                setBayDoorType(
                                  activeBayIndex,
                                  dirOpt.id as "single_left" | "single_right" | "double"
                                )
                              }
                              className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 text-xs font-extrabold transition cursor-pointer ${
                                isCurrentDir
                                  ? "bg-[#EEF3F8] text-[#1C1917] border border-[#CBD5E1] border-[#1C1917] shadow-2xs"
                                  : "bg-white hover:bg-[#F8FAFC] text-stone-800 border-stone-200"
                              }`}
                            >
                              {dirOpt.svg}
                              <span>{dirOpt.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="text-[13px] font-bold text-stone-700 block mb-1.5">
                        1. Kapak Hareket Sistemi (Görsel Seçim)
                      </label>
                      <div className="grid grid-cols-3 gap-1.5 mb-2">
                        {[
                          { id: "hinged_single", label: "Tek Kapak", sym: "◧" },
                          { id: "hinged_double", label: "Çift Kapak", sym: "◫" },
                          { id: "hinged_inset", label: "İçerlek", sym: "▣" },
                          { id: "sliding_top_hung", label: "Üst Sürgü", sym: "⇄" },
                          { id: "sliding_bottom_rolling", label: "Alt Sürgü", sym: "⇆" },
                          { id: "lift_up_stay", label: "Kalkar HK", sym: "⇈" },
                          { id: "lift_parallel", label: "Paralel HL", sym: "uparrow" },
                          { id: "lift_bi_fold", label: "Katlanır HF", sym: "⋀" },
                          { id: "folding_side", label: "Yan Katlanır", sym: "⋈" },
                          { id: "pocket_retractable", label: "Pocket", sym: "◰" },
                          { id: "open", label: "Açık Modül", sym: "☐" },
                        ].map((dsItem) => {
                          const isSel = (activeBay.door.doorSystemId || "hinged_single") === dsItem.id;
                          return (
                            <button
                              key={dsItem.id}
                              type="button"
                              data-testid={`v4-door-visual-btn-${dsItem.id}`}
                              onClick={() =>
                                setBayV4DoorConfig(activeBayIndex, {
                                  doorSystemId: dsItem.id as DoorSystemId,
                                })
                              }
                              className={`p-2 rounded-xl border flex flex-col items-center justify-center text-center gap-1 transition cursor-pointer ${
                                isSel
                                  ? "bg-[#EEF3F8] border-[#1C1917] text-[#111827] shadow-xs"
                                  : "bg-stone-50 hover:bg-[#F8FAFC] border-stone-200 text-stone-800"
                              }`}
                            >
                              <svg viewBox="0 0 40 32" className="w-8 h-6">
                                <rect
                                  x="4"
                                  y="2"
                                  width="32"
                                  height="28"
                                  rx="2"
                                  fill={isSel ? "#92400E" : "#FFFFFF"}
                                  stroke="currentColor"
                                  strokeWidth="2"
                                />
                                {dsItem.id === "hinged_double" || dsItem.id === "folding_side" ? (
                                  <>
                                    <line x1="20" y1="2" x2="20" y2="30" stroke="currentColor" strokeWidth="1.8" />
                                    <circle cx="17" cy="16" r="1.5" fill="currentColor" />
                                    <circle cx="23" cy="16" r="1.5" fill="currentColor" />
                                  </>
                                ) : dsItem.id.startsWith("sliding") ? (
                                  <>
                                    <line x1="20" y1="2" x2="20" y2="30" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2" />
                                    <path d="M10 16 H30 M14 12 L10 16 L14 20 M26 12 L30 16 L26 20" stroke="currentColor" strokeWidth="1.8" fill="none" />
                                  </>
                                ) : dsItem.id.startsWith("lift") ? (
                                  <>
                                    {dsItem.id === "lift_bi_fold" && (
                                      <line x1="4" y1="16" x2="36" y2="16" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2" />
                                    )}
                                    <path d="M20 26 V7 M15 12 L20 7 L25 12" stroke="currentColor" strokeWidth="1.8" fill="none" />
                                  </>
                                ) : dsItem.id === "open" ? (
                                  <>
                                    <line x1="6" y1="11" x2="34" y2="11" stroke="currentColor" strokeWidth="1.6" />
                                    <line x1="6" y1="21" x2="34" y2="21" stroke="currentColor" strokeWidth="1.6" />
                                  </>
                                ) : (
                                  <>
                                    <line x1="6" y1="4" x2="32" y2="16" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 2" />
                                    <line x1="6" y1="28" x2="32" y2="16" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 2" />
                                    <circle cx="31" cy="16" r="1.8" fill="currentColor" />
                                  </>
                                )}
                              </svg>
                              <span className="text-xs font-bold leading-tight">{dsItem.label}</span>
                            </button>
                          );
                        })}
                      </div>
                      <V3PremiumDropdown
                        label="Kapak Hareket Sistemi"
                        testId="v4-door-system-select"
                        value={activeBay.door.doorSystemId || "hinged_single"}
                        onChange={(val) =>
                          setBayV4DoorConfig(activeBayIndex, {
                            doorSystemId: val as DoorSystemId,
                          })
                        }
                        options={doorSystemDefinitions.map((ds) => ({
                          value: ds.id,
                          label: ds.name,
                          badge: ds.verifiedForProduction ? "CNC Onaylı" : "Önizleme",
                        }))}
                      />
                    </div>

                    <div>
                      <label className="text-[13px] font-bold text-stone-700 block mb-1">
                        Kapak Bini / Yerleşim Tipi
                      </label>
                      <div className="grid grid-cols-3 gap-1">
                        {[
                          { id: "full_overlay", label: "Tam Bini" },
                          { id: "half_overlay", label: "Yarım Bini" },
                          { id: "inset", label: "İçerde (Inset)" },
                        ].map((ov) => (
                          <button
                            key={ov.id}
                            type="button"
                            data-testid={`v4-overlay-${ov.id}`}
                            onClick={() =>
                              setBayV4DoorConfig(activeBayIndex, {
                                overlayType: ov.id as DoorOverlayType,
                              })
                            }
                            className={`py-1 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                              (activeBay.door.overlayType || "full_overlay") === ov.id
                                ? "bg-[#EEF3F8] text-[#1C1917] border border-[#CBD5E1]"
                                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                            }`}
                          >
                            {ov.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[13px] font-bold text-stone-700 block mb-1.5">
                        2. Kulp & Profil Sistemi (Görsel Seçim)
                      </label>
                      <div className="grid grid-cols-2 gap-1.5 mb-2">
                        {[
                          { cat: "bar_handle", label: "Çubuk Kulp (Bar)" },
                          { cat: "knob", label: "Düğme Kulp (Knob)" },
                          { cat: "long_profile_handle", label: "Boy Profil (100cm)" },
                          { cat: "gola_profile", label: "Gola Kanal Profil" },
                          { cat: "j_pull", label: "J-Pull (Kendinden)" },
                          { cat: "recessed_grip", label: "Gömme Kulp" },
                          { cat: "edge_profile", label: "Üst Kenar Profil" },
                          { cat: "handleless_plain", label: "Kulpsuz Düz (Bas-Aç)" },
                        ].map((hItem) => {
                          const isSel = (activeBay.door.handleCategory || "bar_handle") === hItem.cat;
                          return (
                            <button
                              key={hItem.cat}
                              type="button"
                              data-testid={`v4-handle-visual-btn-${hItem.cat}`}
                              onClick={() =>
                                setBayV4DoorConfig(activeBayIndex, {
                                  handleCategory: hItem.cat as HandleCategory,
                                })
                              }
                              className={`p-2 rounded-xl border flex items-center gap-2 text-left transition cursor-pointer ${
                                isSel
                                  ? "bg-[#EEF3F8] border-[#1C1917] text-[#111827] shadow-xs"
                                  : "bg-stone-50 hover:bg-[#F8FAFC] border-stone-200 text-stone-800"
                              }`}
                            >
                              <svg viewBox="0 0 36 28" className="w-8 h-6 shrink-0">
                                <rect
                                  x="2"
                                  y="2"
                                  width="32"
                                  height="24"
                                  rx="2"
                                  fill={isSel ? "#92400E" : "#FFFFFF"}
                                  stroke="currentColor"
                                  strokeWidth="1.6"
                                />
                                {hItem.cat === "knob" ? (
                                  <circle cx="26" cy="14" r="3.5" fill="currentColor" />
                                ) : hItem.cat === "bar_handle" ? (
                                  <rect x="25" y="7" width="3" height="14" rx="1" fill="currentColor" />
                                ) : hItem.cat === "long_profile_handle" ? (
                                  <rect x="26" y="3" width="3" height="22" rx="1" fill="currentColor" />
                                ) : hItem.cat === "gola_profile" || hItem.cat === "j_pull" || hItem.cat === "edge_profile" ? (
                                  <rect x="3" y="3" width="30" height="4" fill="currentColor" />
                                ) : hItem.cat === "recessed_grip" ? (
                                  <rect x="12" y="5" width="12" height="5" rx="1" fill="none" stroke="currentColor" strokeWidth="1.8" />
                                ) : null}
                              </svg>
                              <span className="text-xs font-bold leading-tight">{hItem.label}</span>
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-xs text-[#57534E] mb-1">Geometriler temsilidir. Kulp montajı ve gelişmiş kapak hareketleri teknik doğrulama bekliyor.</p>
                      <V3PremiumDropdown
                        label="Kulp & Profil Kategorisi"
                        testId="v4-handle-select"
                        value={activeBay.door.handleCategory || "bar_handle"}
                        onChange={(val) =>
                          setBayV4DoorConfig(activeBayIndex, {
                            handleCategory: val as HandleCategory,
                          })
                        }
                        options={handleProfiles.map((hp) => ({
                          value: hp.category,
                          label: hp.name,
                        }))}
                      />
                    </div>

                    <div>
                      <V3PremiumDropdown
                        label="3. Açılma Konforu & Mekanizma"
                        testId="v4-opening-select"
                        value={activeBay.door.openingTechnology || "soft_close"}
                        onChange={(val) =>
                          setBayV4DoorConfig(activeBayIndex, {
                            openingTechnology: val as OpeningTechnology,
                          })
                        }
                        options={openingMechanisms.map((om) => ({
                          value: om.id,
                          label: om.name,
                        }))}
                      />
                    </div>

                    <div>
                      <V3PremiumDropdown
                        label="4. Üretici Donanım Profili (Blum / Hettich / Salice)"
                        testId="v4-hardware-sku-select"
                        value={activeBay.door.hardwareProductId || "hw_blum_71b3550"}
                        onChange={(val) =>
                          setBayV4DoorConfig(activeBayIndex, {
                            hardwareProductId: val,
                          })
                        }
                        options={hardwareCatalog
                          .filter(
                            (h) =>
                              h.familyId === "fam_hinge_concealed" ||
                              h.familyId === "fam_lift_system" ||
                              h.familyId === "fam_sliding_system" ||
                              h.familyId === "fam_pocket_system"
                          )
                          .map((hw) => ({
                            value: hw.id,
                            label: hw.name,
                            badge: hw.sku,
                          }))}
                      />
                    </div>

                    {/* 5. KAPAK KESİT PROFİLİ & ÖZEL CAD ÇİZİM (DXF / SVG) SİSTEMİ */}
                    <div
                      data-testid="studio-door-cross-section-picker"
                      className="p-3 rounded-xl bg-[#FFFFFF] border border-[#CBD5E1] space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-extrabold text-[#1C1917]">
                          📐 5. Kapak Kesit Profili & Özel CAD Çizim (DXF/SVG)
                        </span>
                        <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-[#EBE6DC] text-[#2C2A29] font-bold">
                          CNC Kesit
                        </span>
                      </div>

                      <V3PremiumDropdown
                        label="Aktif Kapak Kesit Profili"
                        testId="v4-door-cross-section-select"
                        value={doorCrossSectionProfile}
                        onChange={(val) => {
                          const nextProf = val as
                            | "flat_slab"
                            | "shaker_frame"
                            | "fluted_ribbed"
                            | "bevel_45"
                            | "j_pull_bevel"
                            | "cove_arch"
                            | "custom_cad_profile";
                          setDoorCrossSectionProfile(nextProf);
                          setModuleDoorCrossSection(nextProf);
                          if (typeof window !== "undefined") {
                            (window as unknown as { __birimDoorCrossSection?: string }).__birimDoorCrossSection = nextProf;
                          }
                          setBayV4DoorConfig(activeBayIndex, {
                            softClose: activeBay.door.softClose,
                          } as Parameters<typeof setBayV4DoorConfig>[1]);
                        }}
                        options={[
                          {
                            value: "flat_slab",
                            label: "Düz Modern Plaka Kesit (18mm/22mm)",
                            sub: "1mm ABS kenar bantlı standart düz kapak kesiti",
                            badge: "Standart",
                          },
                          {
                            value: "shaker_frame",
                            label: "5 Parçalı Çıtalı / Shaker Çerçeve Kesit",
                            sub: "65mm dış kayıt çerçevesi + 6mm çökertmeli orta göbek",
                            badge: "CNC Çerçeve",
                          },
                          {
                            value: "fluted_ribbed",
                            label: "Dikey Mikro-Çıtalı (Fluted / Derzli) Kesit",
                            sub: "36mm adımlı CNC dikey derz kanallı mimari yüzey",
                            badge: "CNC Derz",
                          },
                          {
                            value: "bevel_45",
                            label: "45° Pahlı / Kademeli Kenar Kesiti",
                            sub: "Çevre kenarları 45° CNC pah bıçağı ile işlenmiş kesit",
                            badge: "45° Pah",
                          },
                          {
                            value: "j_pull_bevel",
                            label: "Gizli Eğimli J-Kulp Parmak Kanallı Kesit",
                            sub: "Kulpsuz kapaklar için üst kenarı 45° içe oyuk J-kulp profili",
                            badge: "J-Kulp",
                          },
                          {
                            value: "cove_arch",
                            label: "İçbükey Kavisli (Cove) Çok Kademeli Çerçeve",
                            sub: "5 eksen CNC kavisli içbükey çevre geçişli tasarım kapak",
                            badge: "Kavisli",
                          },
                          {
                            value: "custom_cad_profile",
                            label: customCadProfileName
                              ? `Özel CAD Kesiti: ${customCadProfileName}`
                              : "Özel DXF / SVG Kapak Kesit Çizimi",
                            sub: "Dışarıdan yüklenen 2D kesit eğrisinin (Extrude/Sweep) uygulanması",
                            badge: "DXF / SVG",
                          },
                        ]}
                      />

                      {/* Live 2D Technical Cross-Section Diagram (X-Z Kesit Önizleme) */}
                      <div className="p-2.5 rounded-xl bg-white border border-[#E2E8F0] flex items-center justify-between gap-3">
                        <svg viewBox="0 0 120 44" className="w-28 h-11 shrink-0 bg-[#FFFFFF] rounded-lg border border-[#E2E8F0] p-1">
                          {doorCrossSectionProfile === "flat_slab" && (
                            <rect x="10" y="12" width="100" height="20" rx="1.5" fill="#D6CFC2" stroke="#2C2A29" strokeWidth="2" />
                          )}
                          {doorCrossSectionProfile === "shaker_frame" && (
                            <path
                              d="M10 10 H32 V18 H88 V10 H110 V32 H10 Z"
                              fill="#D6CFC2"
                              stroke="#2C2A29"
                              strokeWidth="2"
                            />
                          )}
                          {doorCrossSectionProfile === "fluted_ribbed" && (
                            <path
                              d="M10 32 V16 H20 V22 H30 V16 H40 V22 H50 V16 H60 V22 H70 V16 H80 V22 H90 V16 H100 V22 H110 V32 Z"
                              fill="#D6CFC2"
                              stroke="#2C2A29"
                              strokeWidth="1.8"
                            />
                          )}
                          {doorCrossSectionProfile === "bevel_45" && (
                            <path
                              d="M10 32 L22 12 H98 L110 32 Z"
                              fill="#D6CFC2"
                              stroke="#2C2A29"
                              strokeWidth="2"
                            />
                          )}
                          {doorCrossSectionProfile === "j_pull_bevel" && (
                            <path
                              d="M10 32 V12 H82 L94 24 H110 V32 Z"
                              fill="#D6CFC2"
                              stroke="#2C2A29"
                              strokeWidth="2"
                            />
                          )}
                          {doorCrossSectionProfile === "cove_arch" && (
                            <path
                              d="M10 32 V12 H24 Q36 22 46 22 H74 Q84 22 96 12 H110 V32 Z"
                              fill="#D6CFC2"
                              stroke="#2C2A29"
                              strokeWidth="2"
                            />
                          )}
                          {doorCrossSectionProfile === "custom_cad_profile" && (
                            <path
                              d={customCadSvgPath || "M10 32 V18 L20 12 H35 V18 H85 V12 H100 L110 18 V32 Z"}
                              fill="#D6CFC2"
                              stroke="#2C2A29"
                              strokeWidth="2"
                            />
                          )}
                        </svg>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="text-xs font-bold text-[#1C1917]">
                            2D Kesit Mantığı (Extrude & CNC Göbek)
                          </div>
                          <p className="text-xs text-[#57534E] leading-snug">
                            Yüklenen .dxf/.svg 2D kesit poligonu dış çerçevede (Sweep) ve orta göbekte (CNC Pocket) parametrik ölçeklenir.
                          </p>
                          <label className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#EEF3F8] hover:bg-[#E4ECF4] text-[#1C1917] text-[#111827] text-xs font-bold cursor-pointer">
                            <span>📂 .DXF / .SVG Kesit Yükle</span>
                            <input
                              type="file"
                              accept=".dxf,.svg,.json"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const reader = new FileReader();
                                reader.onload = () => {
                                  const text = typeof reader.result === "string" ? reader.result : "";
                                  const parsed = parseDoorCrossSectionFile(file.name, text);
                                  setCustomCadProfileName(file.name);
                                  setCustomCadSvgPath(parsed.svgPathD);
                                  setDoorCrossSectionProfile("custom_cad_profile");
                                  setModuleDoorCrossSection("custom_cad_profile", file.name, parsed.points);
                                  if (typeof window !== "undefined") {
                                    (window as unknown as { __birimDoorCrossSection?: string }).__birimDoorCrossSection = "custom_cad_profile";
                                  }
                                };
                                reader.readAsText(file);
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* ADVANCED PRODUCTION & CNC SETTINGS TOGGLE (Separates Basic Design from Factory/CNC Level) */}
                    <div className="pt-2 border-t border-[#E2E8F0]">
                      <button
                        type="button"
                        data-testid="studio-toggle-advanced-cnc-btn"
                        onClick={() => setShowAdvancedCncLevel((v) => !v)}
                        className="w-full p-2.5 rounded-xl bg-[#EEF3F8] hover:bg-[#E4ECF4] border border-[#CBD5E1] flex items-center justify-between text-xs font-bold text-[#111827] cursor-pointer transition"
                      >
                        <span className="flex items-center gap-1.5">
                          <Wrench className="w-3.5 h-3.5 text-[#475569]" />
                          <span>İleri Üretim & CNC Ayarları (Menteşe Delik & Kesit)</span>
                        </span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white border border-[#CBD5E1]">
                          {showAdvancedCncLevel ? "Daralt ▲" : "Göster ▼"}
                        </span>
                      </button>
                    </div>

                    {/* 5. HINGE COUNT & TOP/BOTTOM EDGE SPACING CONTROLS */}
                    {(() => {
                      const leafSpec = fourSpaceDimensions?.doorLeaves[activeBayIndex];
                      const dSys = activeBay.door.doorSystemId || "hinged_single";
                      const isHingedSys =
                        !dSys.startsWith("sliding") &&
                        !dSys.startsWith("lift") &&
                        dSys !== "open" &&
                        dSys !== "tambour_roller";
                      if (!isHingedSys || !leafSpec) return null;
                      const hyList = leafSpec.hingePositionsY || [];
                      const avgPitch =
                        hyList.length >= 2
                          ? Math.round((hyList[hyList.length - 1] - hyList[0]) / (hyList.length - 1))
                          : 0;
                      const curBotOff = activeBay.door.hingeBottomOffsetMm ?? 100;
                      const curTopOff = activeBay.door.hingeTopOffsetMm ?? 100;
                      return (
                        <div
                          data-testid="v4-hinge-spacing-panel"
                          className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[13px] font-bold text-[#111827]">
                              5. Menteşe Sayısı & Kenar Aralıkları (CNC/3D/2D)
                            </span>
                            <span
                              data-testid="v4-hinge-count-badge"
                              className="px-1.5 py-0.5 rounded bg-[#EEF3F8] text-[#111827] border border-[#CBD5E1] font-mono text-xs font-bold"
                            >
                              {leafSpec.effectiveHingeCount} Menteşe / Kanat
                            </span>
                          </div>

                          <div className="p-1.5 rounded-lg bg-white/90 border border-[#E2E8F0] text-xs text-stone-700 leading-tight">
                            <span className="font-bold text-[#111827] block">
                              📐 Blum CLIP top / Hettich Sensys / DIN 68856 (System 32) Standardı:
                            </span>
                            <span>
                              ≤1000mm (≤9kg): <b>2 Ad.</b> • 1001–1600mm (≤13kg): <b>3 Ad.</b> • 1601–2200mm (≤18kg): <b>4 Ad.</b> • &gt;2200mm (&gt;18kg): <b>5 Ad.</b> (Eşit aralıklı + raf çakışma korumalı)
                            </span>
                          </div>
                          <div className="space-y-1">
                            <span className="text-xs font-semibold text-stone-600 block">
                              Kanat Başına Menteşe Sayısı (Kapak H:{leafSpec.leafHeightMm}mm • {leafSpec.leafWeightKg}kg):
                            </span>
                            <div className="grid grid-cols-5 gap-1">
                              {[
                                { val: undefined, label: `Oto (${leafSpec.recommendedHingesPerLeaf})` },
                                { val: 2, label: "2 Adet" },
                                { val: 3, label: "3 Adet" },
                                { val: 4, label: "4 Adet" },
                                { val: 5, label: "5 Adet" },
                              ].map((hOpt) => {
                                const isSel = activeBay.door.hingeCount === hOpt.val;
                                return (
                                  <button
                                    key={hOpt.label}
                                    type="button"
                                    data-testid={`v4-hinge-count-btn-${hOpt.val ?? "auto"}`}
                                    onClick={() =>
                                      setBayV4DoorConfig(activeBayIndex, {
                                        hingeCount: hOpt.val,
                                      })
                                    }
                                    className={`py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                                      isSel
                                        ? "bg-[#EEF3F8] text-[#111827] border border-[#CBD5E1]"
                                        : "bg-white hover:bg-[#F1F5F9] border border-[#E2E8F0] text-stone-700"
                                    }`}
                                  >
                                    {hOpt.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-1.5">
                            <div className="bg-white p-1.5 rounded-lg border border-[#E2E8F0] space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-stone-600">
                                  Alt Kenar Payı:
                                </span>
                                <input
                                  type="number"
                                  data-testid="v4-hinge-bottom-offset-input"
                                  min={50}
                                  max={350}
                                  step={10}
                                  value={curBotOff}
                                  onChange={(e) =>
                                    setBayV4DoorConfig(activeBayIndex, {
                                      hingeBottomOffsetMm: Number(e.target.value),
                                    })
                                  }
                                  className="w-12 font-mono text-xs font-bold text-stone-900 text-right"
                                />
                              </div>
                              <div className="flex gap-1">
                                {[80, 100, 120, 150].map((presetOff) => (
                                  <button
                                    key={presetOff}
                                    type="button"
                                    data-testid={`v4-hinge-bot-preset-${presetOff}`}
                                    onClick={() =>
                                      setBayV4DoorConfig(activeBayIndex, {
                                        hingeBottomOffsetMm: presetOff,
                                      })
                                    }
                                    className={`flex-1 py-0.5 rounded font-mono text-xs font-bold cursor-pointer ${
                                      curBotOff === presetOff
                                        ? "bg-[#2563EB] text-white"
                                        : "bg-stone-100 text-stone-700"
                                    }`}
                                  >
                                    {presetOff}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="bg-white p-1.5 rounded-lg border border-[#E2E8F0] space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-stone-600">
                                  Üst Kenar Payı:
                                </span>
                                <input
                                  type="number"
                                  data-testid="v4-hinge-top-offset-input"
                                  min={50}
                                  max={350}
                                  step={10}
                                  value={curTopOff}
                                  onChange={(e) =>
                                    setBayV4DoorConfig(activeBayIndex, {
                                      hingeTopOffsetMm: Number(e.target.value),
                                    })
                                  }
                                  className="w-12 font-mono text-xs font-bold text-stone-900 text-right"
                                />
                              </div>
                              <div className="flex gap-1">
                                {[80, 100, 120, 150].map((presetOff) => (
                                  <button
                                    key={presetOff}
                                    type="button"
                                    data-testid={`v4-hinge-top-preset-${presetOff}`}
                                    onClick={() =>
                                      setBayV4DoorConfig(activeBayIndex, {
                                        hingeTopOffsetMm: presetOff,
                                      })
                                    }
                                    className={`flex-1 py-0.5 rounded font-mono text-xs font-bold cursor-pointer ${
                                      curTopOff === presetOff
                                        ? "bg-[#2563EB] text-white"
                                        : "bg-stone-100 text-stone-700"
                                    }`}
                                  >
                                    {presetOff}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div
                            data-testid="v4-hinge-positions-readout"
                            className="px-2 py-1 rounded-lg bg-white border border-[#E2E8F0] font-mono text-xs text-[#111827] flex items-center justify-between"
                          >
                            <span>🔩 Y: {hyList.join(" • ")} mm</span>
                            <span className="font-bold text-[#111827]">ΔY: {avgPitch} mm</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </V3CollapsibleSection>
              )}
                </>
              )}
            </div>
            </div>
          </aside>
        )}
      </div>

      {/* 3. DESIGN STUDIO BOTTOM STATUS, MODULE STRIP & COMMERCIAL BAR */}
      {mode === "studio" && (() => {
        const mainModules = project.modules.filter((m) => m.category !== "complementary");
        const totalWidthMm = mainModules.reduce((acc, m) => acc + m.dimensions.width, 0);
        const totalVolM3 = mainModules.reduce(
          (acc, m) =>
            acc +
            (m.dimensions.width / 1000) *
              (m.dimensions.height / 1000) *
              (m.dimensions.depth / 1000),
          0
        );
        const estWeightKg =
          bom?.summary?.totalWeightKg ||
          Math.max(18, Math.round(totalVolM3 * 103));
        const unitPriceEur =
          mainModules.length > 0
            ? pricing.totalWithVatEur / mainModules.length
            : pricing.totalWithVatEur;

        return (
          <footer className="absolute bottom-2.5 left-3.5 right-3.5 h-[48px] bg-transparent pointer-events-none text-[#141413] flex items-center justify-between z-30 gap-2.5">
            {/* Sol: Yüzen Buzlu Cam Modül Film Şeridi + İkon "+" Ekleme */}
            <div className="pointer-events-auto flex items-center gap-1.5 min-w-0 overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-1 p-0.5 rounded-2xl birim-ice-pill">
                {project.modules.map((m, idx) => (
                  <div
                    key={m.id}
                    className={`h-8 px-2 rounded-xl flex items-center gap-1 transition shrink-0 ${
                      activeModuleIndex === idx
                        ? "birim-ice-btn-active"
                        : "hover:bg-white/70 text-[#141413]"
                    }`}
                  >
                    <button
                      type="button"
                      data-testid={`studio-mod-pill-${idx}`}
                      onClick={() => setActiveModuleIndex(idx)}
                      title={`#${idx + 1} ${m.name} (${m.dimensions.width}×${m.dimensions.height}mm)`}
                      className="flex items-center gap-1 cursor-pointer"
                    >
                      <V3IsometricModuleIcon module={m} size="sm" />
                      <span className="text-[11px] font-mono font-bold">
                        {isSimpleBlumMode ? `${m.dimensions.width / 10}` : m.dimensions.width}
                      </span>
                    </button>
                    {project.modules.length > 1 && (
                      <button
                        type="button"
                        data-testid={`studio-delete-mod-${idx}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeModuleAt(idx);
                        }}
                        title="Bu modülü sahneden sil"
                        className="w-4 h-4 rounded-full hover:bg-red-500/20 opacity-70 hover:opacity-100 flex items-center justify-center text-xs leading-none cursor-pointer"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}

                <button
                  type="button"
                  data-testid="studio-pill-add-module"
                  onClick={addAdjacentModule}
                  className="w-8 h-8 rounded-xl birim-ice-btn flex items-center justify-center text-[#141413] cursor-pointer shrink-0"
                  title="Yanına Yeni Modül Ekle"
                >
                  <Plus className="w-4 h-4" />
                  <span className="sr-only">+ Modül Ekle</span>
                </button>
              </div>
            </div>

            {/* Sağ: Yüzen Buzlu Cam Açılım Sürgüsü, Kapasite, Fiyat ve Aksiyon Kapsülü */}
            <div className="pointer-events-auto flex items-center gap-2 shrink-0 ml-auto">
              <div
                title="Kapak ve Çekmece Açılma Oranı (%0 – %100 • Kısayol: Space)"
                className="hidden md:inline-flex items-center gap-2 px-3 h-9 rounded-[20px] birim-ice-pill text-[11px] font-semibold text-[#141413]"
              >
                <DoorOpen className="w-3.5 h-3.5 text-[#57534E]" />
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(Math.max(doorOpenAngleDeg / 0.85, drawerOpenMm / 3.2))}
                  onChange={(e) => {
                    const pct = Number(e.target.value);
                    setDoorOpenAngleDeg(Math.round(pct * 0.85));
                    setDrawerOpenMm(Math.round(pct * 3.2));
                  }}
                  className="w-20 accent-[#141413] h-1.5 bg-black/15 rounded-lg cursor-pointer"
                />
                <span className="font-mono text-[10px] w-7 text-right">
                  %{Math.min(100, Math.round(Math.max(doorOpenAngleDeg / 0.85, drawerOpenMm / 3.2)))}
                </span>
              </div>
              <div className="hidden lg:flex items-center gap-2 px-2.5 h-8 rounded-xl birim-ice-btn text-[11px] font-mono font-bold text-[#141413]" title="Toplam Dolap Genişliği">
                <span>↔ {isSimpleBlumMode ? `${totalWidthMm / 10}cm` : `${totalWidthMm}mm`}</span>
                {!isSimpleBlumMode && (
                  <span className="text-[#78716C] font-normal">• {estWeightKg}kg</span>
                )}
                <span data-testid="studio-footer-dimensions" className="sr-only">
                  {width} × {height} × {depth} mm ({totalWidthMm} mm)
                </span>
              </div>

              <button
                type="button"
                data-testid="studio-capacity-summary-pill"
                onClick={() => setShowQuickSellModal(true)}
                title={`Depolama Kapasitesi: ~${liveCustomerAndFactoryStats.hangingGarments} Askı • ~${liveCustomerAndFactoryStats.foldedGarments} Katlı Raf • ${liveCustomerAndFactoryStats.sheetCount2800x2070} Plaka`}
                className="hidden xl:flex items-center gap-1.5 h-8 px-2.5 rounded-xl birim-ice-btn text-[11px] font-mono font-semibold text-[#44403C] cursor-pointer"
              >
                <span>👔{liveCustomerAndFactoryStats.hangingGarments}</span>
                <span>📚{liveCustomerAndFactoryStats.foldedGarments}</span>
                {!isSimpleBlumMode && (
                  <span>🪵{liveCustomerAndFactoryStats.sheetCount2800x2070}</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setPriceCurrency((c) => (c === "TRY" ? "EUR" : "TRY"))}
                className="px-2.5 h-8 rounded-xl birim-ice-pill flex items-center gap-1.5 cursor-pointer hover:bg-white/70 transition"
                title="KDV Dahil Toplam Fiyat (₺ TL / € EUR değiştirmek için tıklayın)"
              >
                <span
                  data-testid="studio-total-price"
                  className="text-sm font-black font-mono text-[#141413]"
                >
                  {priceCurrency === "TRY"
                    ? `₺ ${Math.round(pricing.totalWithVatEur * eurToTryRate).toLocaleString("tr-TR")}`
                    : `€ ${pricing.totalWithVatEur.toLocaleString("tr-TR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`}
                </span>
              </button>

              <div className="inline-flex items-center gap-1 p-0.5 rounded-2xl birim-ice-pill">
                {!isSimpleBlumMode && (
                  <>
                    <button
                      type="button"
                      data-testid="studio-bottom-download-dxf-btn"
                      onClick={() => {
                        const dxf = exportAllPanelsDxfString();
                        const blob = new Blob([dxf], { type: "application/dxf" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `Parca_Kesim_Listesi_CNC_${project.id}_v${project.version}.dxf`;
                        document.body.appendChild(a);
                        a.click();
                        setTimeout(() => {
                          if (a.parentNode) a.parentNode.removeChild(a);
                          URL.revokeObjectURL(url);
                        }, 1500);
                      }}
                      title="Parça Kesim Listesi ve CNC Delik Çizimlerini DXF Olarak İndir"
                      className="w-8 h-8 rounded-xl hover:bg-white/75 text-[10px] font-mono font-extrabold text-[#141413] flex items-center justify-center transition cursor-pointer"
                    >
                      <span>DXF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsBomModalOpen(true)}
                      title="BOM, Birim ERP Nesting ve CNC Merkezi"
                      className="w-8 h-8 rounded-xl hover:bg-white/75 text-[#141413] flex items-center justify-center transition cursor-pointer"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      <span className="sr-only">BOM</span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  title="Projeyi Kaydet / Aç"
                  onClick={() => setIsProjectModalOpen(true)}
                  className="w-8 h-8 rounded-xl hover:bg-white/75 text-[#141413] flex items-center justify-center transition cursor-pointer"
                >
                  <FolderOpen className="w-4 h-4" />
                  <span className="sr-only">Kaydet</span>
                </button>

                <button
                  type="button"
                  data-testid="studio-approve-btn"
                  title="Sunum Stüdyosu ve Müşteri Teklifine Geç"
                  onClick={handleApprove}
                  className="h-8 px-3 rounded-xl birim-ice-btn-active text-xs font-semibold flex items-center gap-1 transition active:scale-[0.99] cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-[#E5D3B8]" />
                  <span className="hidden sm:inline">Sunum</span>
                  <span className="sr-only">Sunum &amp; Teklif</span>
                </button>
              </div>
            </div>
          </footer>
        );
      })()}

      {mode === "plan" && (
        <footer
          data-testid="plan-contextual-bar"
          className="birim-ice-bar border-t px-3.5 py-1.5 flex flex-col gap-1.5 shrink-0 z-30 text-xs"
        >
          {/* PRIMARY ROW: ICON-FIRST COMPACT SPATIAL BADGES + QUICK TRAY TOGGLE */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {/* Left: Quick Controls Toggle + Active Module Pill */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPlanShowQuickControls((v) => !v)}
                className={`px-2.5 py-1.5 rounded-xl border font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
                  planShowQuickControls
                    ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                    : "bg-white hover:bg-slate-50 text-[#0F172A] border-slate-200/90 shadow-2xs"
                }`}
                title="Hızlı Modül, Raf ve Renk Araçlarını Aç/Kapat"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span className="sr-only">Hızlı Araçlar</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    planShowQuickControls ? "rotate-180" : ""
                  }`}
                />
              </button>

              <div className="flex items-center gap-2 bg-slate-100/85 px-2.5 py-1 rounded-xl border border-slate-200/80">
                <V3IsometricModuleIcon
                  module={activeModule}
                  size="sm"
                  testId="plan-active-module-visual"
                />
                <span className="font-bold text-[#0F172A]">
                  {project.modules.filter((m) => m.category !== "complementary").length} Modül
                </span>
                <span className="text-slate-400">•</span>
                <span className="font-mono font-bold text-slate-700">
                  {width}×{height}×{depth}
                </span>
              </div>
            </div>

            {/* Center: Icon-First Spatial Pill Badges (Minimal Text, Scannable) */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <div
                className="px-2.5 py-1 rounded-xl bg-slate-100/80 border border-slate-200/75 flex items-center gap-1.5"
                title="Oda Alanı (m²)"
              >
                <span>📐</span>
                <span
                  data-testid="plan-summary-room-area"
                  className="font-mono font-bold text-[#0F172A]"
                >
                  {activeSpatialMetrics.roomAreaM2.toLocaleString("tr-TR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  m²
                </span>
              </div>

              <div
                className="px-2.5 py-1 rounded-xl bg-slate-100/80 border border-slate-200/75 flex items-center gap-1.5"
                title="Net Duvar Uzunluğu"
              >
                <span>🧱</span>
                <span
                  data-testid="plan-summary-wall-net"
                  className="font-mono font-bold text-[#0F172A]"
                >
                  {activeSpatialMetrics.hostWallNetLengthMm} mm
                </span>
              </div>

              <div
                className="px-2.5 py-1 rounded-xl bg-slate-100/80 border border-slate-200/75 flex items-center gap-1.5"
                title="Oda Tavan Yüksekliği"
              >
                <span>↕</span>
                <span
                  data-testid="plan-summary-room-height"
                  className="font-mono font-bold text-[#0F172A]"
                >
                  {activeSpatialMetrics.roomHeightMm} mm
                </span>
              </div>

              <div
                className="px-2.5 py-1 rounded-xl bg-slate-100/80 border border-slate-200/75 flex items-center gap-1.5"
                title="Toplam Modül Uzunluğu"
              >
                <span>📦</span>
                <span
                  data-testid="plan-summary-total-mod-len"
                  className="font-mono font-bold text-[#0F172A]"
                >
                  {activeSpatialMetrics.totalModuleLengthOnWallMm} mm
                </span>
              </div>

              <div
                className="px-2.5 py-1 rounded-xl bg-emerald-50/90 border border-emerald-200/80 flex items-center gap-1.5"
                title="Duvarda Kalan Boşluk"
              >
                <span>✨</span>
                <span
                  data-testid="plan-summary-remaining-gap"
                  className="font-mono font-extrabold text-emerald-700"
                >
                  {activeSpatialMetrics.remainingWallClearanceMm} mm
                </span>
              </div>
            </div>

            {/* Right: Price Pill + Ortam + Tasarıma Dön CTA */}
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                data-testid="plan-open-step-wizard-btn"
                onClick={() => {
                  setWizardStep(1);
                  setShowStepWizardModal(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#141413] text-xs font-extrabold flex items-center gap-1.5 shadow-2xs transition active:scale-95 cursor-pointer"
                title="5 Adımda Kolay Tasarım Sihirbazı"
              >
                <span>🪄</span>
                <span className="sr-only">Sihirbaz</span>
              </button>
              <button
                type="button"
                data-testid="plan-quick-sell-btn"
                onClick={() => setShowQuickSellModal(true)}
                className="px-3 py-1.5 rounded-xl bg-[#141413] hover:bg-[#292524] text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition active:scale-95 cursor-pointer"
                title="30 Saniyede Oto-Dizilim, 3'lü Bütçe Paketi, 2D Plaka Nesting ve Görsel Müşteri Sunum PDF'i"
              >
                <Wand2 className="w-3.5 h-3.5 text-amber-300" />
                <span className="sr-only">Showroom & Teklif</span>
              </button>
              <span
                data-testid="plan-total-price"
                className="px-2.5 py-1.5 rounded-xl bg-slate-100/90 border border-slate-200/80 text-xs font-black font-mono text-[#0F172A]"
                title="KDV Dahil Proje Toplamı"
              >
                €
                {pricing.totalWithVatEur.toLocaleString("tr-TR", {
                  minimumFractionDigits: 2,
                })}
              </span>

              <button
                type="button"
                data-testid="plan-env-properties-btn"
                onClick={() => dispatchPlanToolAction({ action: "toggle_cad_bar" })}
                title="Ortam ve Oda Özellikleri"
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/90 text-xs font-bold text-[#0F172A] flex items-center gap-1.5 shadow-2xs transition active:scale-95 cursor-pointer"
              >
                <span>⚙️</span>
                <span className="sr-only">Ortam</span>
              </button>

              <button
                type="button"
                data-testid="plan-return-to-studio-btn"
                onClick={() => setMode("studio")}
                className="px-3.5 py-1.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition active:scale-[0.98] cursor-pointer"
              >
                <span>3D</span>
                <span>→</span>
              </button>
            </div>
          </div>

          {/* COLLAPSIBLE QUICK CONTROLS TRAY (Smooth stretch animation on click) */}
          <div
            className={`grid transition-all duration-200 ease-out origin-top ${
              planShowQuickControls
                ? "grid-rows-[1fr] opacity-100 scale-y-100 pt-1.5 border-t border-slate-200/70"
                : "grid-rows-[0fr] opacity-0 scale-y-95 pointer-events-none"
            }`}
          >
            <div className="overflow-hidden flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-lg bg-white border border-slate-200 shrink-0">
                  <V3IsometricModuleIcon
                    module={activeModule}
                    size="sm"
                    testId="plan-active-module-visual-sub"
                  />
                </div>
                <span className="font-bold text-slate-800 text-xs">
                  #{activeModuleIndex + 1} {activeModule.name}
                </span>

                <div className="flex items-center gap-1 bg-slate-100/90 p-0.5 rounded-xl border border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => moveActiveModule(-snapMm || -50)}
                    className="p-1 rounded-lg hover:bg-white text-slate-700 cursor-pointer"
                    title="Sola Kaydır"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-1.5 font-mono text-[11px] font-bold text-slate-700">
                    X:{activeModule.position.x}
                  </span>
                  <button
                    type="button"
                    onClick={() => moveActiveModule(snapMm || 50)}
                    className="p-1 rounded-lg hover:bg-white text-slate-700 cursor-pointer"
                    title="Sağa Kaydır"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  type="button"
                  data-testid="plan-rotate-mod-btn"
                  onClick={rotateActiveModule90}
                  className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-800 font-bold flex items-center gap-1 shadow-2xs cursor-pointer"
                  title="90° Köşe Dönüşü"
                >
                  <RotateCw className="w-3.5 h-3.5 text-blue-600" />
                  <span>{activeModule.rotation?.y || 0}°</span>
                </button>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 bg-slate-100/90 px-2 py-1 rounded-xl border border-slate-200/80">
                  <span className="text-[11px] font-bold text-slate-500">↔</span>
                  <input
                    type="number"
                    data-testid="plan-width-input"
                    min={300}
                    max={3600}
                    step={50}
                    value={width}
                    onChange={(e) =>
                      setDimensions(
                        Math.min(3600, Math.max(300, Number(e.target.value) || 300)),
                        height,
                        depth
                      )
                    }
                    className="w-16 px-1.5 py-0.5 bg-white border border-slate-300 rounded-lg font-mono font-bold text-center text-slate-900"
                  />
                  <div className="flex gap-1">
                    {[600, 800, 1200, 1800, 2000].map((pw) => (
                      <button
                        key={pw}
                        type="button"
                        data-testid={`plan-width-preset-${pw}`}
                        onClick={() => setDimensions(pw, height, depth)}
                        className={`px-2 py-0.5 rounded-lg font-mono text-[11px] font-bold transition cursor-pointer ${
                          width === pw
                            ? "bg-blue-600 text-white shadow-2xs"
                            : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {pw}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  data-testid="plan-add-shelf-btn"
                  onClick={() => addShelf(activeBayIndex)}
                  className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-blue-50 border border-slate-200/90 text-slate-800 font-bold flex items-center gap-1 shadow-2xs cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5 text-blue-600" />
                  <span>+ Raf ({activeBay?.shelves.length || 0})</span>
                </button>

                <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-xl border border-slate-200/90 shadow-2xs">
                  {DEFAULT_MATERIALS.slice(0, 5).map((mat) => (
                    <button
                      key={mat.id}
                      type="button"
                      data-testid={`plan-mat-${mat.id}`}
                      onClick={() => setMaterials(undefined, mat.id)}
                      title={mat.name}
                      className={`w-5 h-5 rounded-full border transition cursor-pointer ${
                        activeModule.carcass.doorMaterialId === mat.id
                          ? "ring-2 ring-blue-600 border-white scale-110"
                          : "border-slate-300"
                      }`}
                      data-material-swatch="true" style={getMaterialSwatchStyle(mat)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </footer>
      )}

      {/* KITCHEN & SPATIAL ENGINEERING COMPLIANCE MODAL */}
      {showRulesModal && (
        <div
          data-testid="v3-engineering-modal"
          onClick={() => setShowRulesModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 backdrop-blur-xs p-4"
        >
          <div
            data-draggable-shell="rules"
            onClick={(e) => e.stopPropagation()}
            className="birim-ice-modal rounded-[28px] max-w-2xl w-full overflow-hidden text-stone-900"
          >
            <div onPointerDown={(e) => startZeroLagModalDrag(e)} title="Taşımak için sürükleyin" className="px-5 py-4 birim-ice-shell-header flex items-center justify-between cursor-grab active:cursor-grabbing select-none">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#57534E]" />
                <div>
                  <h2 className="text-sm font-bold text-[#111827]">
                    Üretim Kontrolü & Mühendislik Doğrulama Raporu ({humanCompatStatusLabel})
                  </h2>
                  <p className="text-[11px] text-[#475569]">
                    Doğrulanmamış kuralların listesi ve CNC / fabrika üretimine etkisi
                  </p>
                </div>
              </div>
              <button
                type="button"
                data-testid="v3-engineering-modal-close"
                onClick={() => setShowRulesModal(false)}
                className="px-2 py-1 rounded text-stone-500 hover:text-stone-900 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              {/* Bölgesel ve Erişilebilirlik Ergonomi Profili Seçicisi (Bölüm 5) */}
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-stone-900 text-[11px] uppercase tracking-wider">
                    Standart ve Erişilebilirlik Profili
                  </div>
                  <div className="text-[11px] text-stone-500">
                    Zorunlu güvenlik kuralları sabit tutulur; erişim ve koridor sınırları seçili profile göre doğrulanır.
                  </div>
                </div>
                <select
                  data-testid="v3-ergonomic-profile-select"
                  value={ergonomicProfileId}
                  onChange={(e) =>
                    setErgonomicProfileId(
                      e.target.value as "TR_RESIDENTIAL" | "EU_EN_STANDARD" | "ACCESSIBLE_EN17210"
                    )
                  }
                  className="px-2.5 py-1.5 rounded-lg bg-white border border-stone-300 text-stone-900 font-semibold text-xs"
                >
                  {Object.values(regionalErgonomicProfiles).map((prof) => (
                    <option key={prof.id} value={prof.id}>
                      {prof.name}
                    </option>
                  ))}
                </select>
              </div>

              {unifiedEngineeringReport.findings.length > 0 && (
                <div className="space-y-1.5">
                  <div className="font-bold text-stone-700 uppercase tracking-wider text-[11px]">
                    Merkezi Mühendislik, Güvenlik ve Doğrulama Kontrolleri ({unifiedEngineeringReport.findings.length})
                  </div>
                  {unifiedEngineeringReport.findings.map((iss, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border space-y-1.5 ${
                        iss.severity === "error"
                          ? "bg-red-50 border-red-200 text-red-900"
                          : "bg-[#F8FAFC] border-[#CBD5E1] text-[#111827]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-[#111827]">{iss.message}</span>
                        <span className="px-2 py-0.5 rounded-full bg-[#EEF3F8] border border-[#CBD5E1] text-[10px] font-bold text-[#111827] shrink-0">
                          {iss.ruleNature === "MANDATORY_SAFETY"
                            ? "Zorunlu Güvenlik Engeli"
                            : iss.ruleNature === "ENGINEERING_VALIDITY" && iss.severity === "error"
                            ? "Mühendislik / Üretim Engeli"
                            : iss.ruleNature === "VERIFICATION_REQUIRED"
                            ? "Doğrulama Gerektirir"
                            : "Ergonomi Önerisi"}
                        </span>
                      </div>
                      {iss.worldPositionMm && (
                        <div className="font-mono text-[10px] text-stone-500">
                          3B Sahne Konumu: X={iss.worldPositionMm.x} • Y={iss.worldPositionMm.y} • Z={iss.worldPositionMm.z} mm • Kod: {iss.code}
                        </div>
                      )}
                      {iss.remediationProposals && iss.remediationProposals.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {iss.remediationProposals.map((prop) => (
                            <button
                              key={prop.id}
                              type="button"
                              onClick={() => {
                                applyApprovedEngineeringFix(prop);
                                setApprovalBanner({
                                  ok: true,
                                  text: `✓ Onaylı düzeltme uygulandı: ${prop.label}`,
                                });
                                setTimeout(() => setApprovalBanner(null), 3000);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-[11px] cursor-pointer transition"
                            >
                              ✓ Onayla ve Uygula: {prop.label}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="text-[11px] bg-[#EEF3F8] text-[#111827] px-2.5 py-1.5 rounded-lg border border-[#CBD5E1]">
                        <b>Üretime Etkisi:</b>{" "}
                        {iss.code.includes("FACTORY") || iss.code.includes("CNC")
                          ? "3D görselleştirme ve müşteri fiyat teklifi oluşturulabilir; ancak CNC kesim/delik dosyası (.CIX/.XML) makineye aktarılmadan önce üretim şefi onayı gerekir."
                          : iss.code.includes("HARDWARE") || iss.code.includes("SOURCE")
                          ? "BOM malzeme listesine dahil edilir; seri üretim öncesi 1 adet fiziksel numune kapak/çekmece üzerinde delik ekseni doğrulanmalıdır."
                          : "Saha montajı ve net kesim ölçüleri için üretim mühendisliği kontrolü önerilir."}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <div className="font-bold text-stone-700 uppercase tracking-wider text-[11px]">
                  Mühendislik Kuralları (Doğrulanmış vs Doğrulanmamış)
                </div>
                {KITCHEN_ENGINEERING_RULE_REGISTRY.map((rule) => (
                  <div
                    key={rule.code}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-stone-50 border border-stone-200"
                  >
                    <div>
                      <div className="font-bold text-stone-900">{rule.label}</div>
                      <div className="text-[11px] text-stone-500">{rule.standardRef}</div>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 ${
                        rule.verified
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-[#57534E]"
                      }`}
                    >
                      {rule.verified ? "DOĞRULANDI" : "SAHA ONAYI GEREKLİ"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* V4 LIBRARY ADMIN & GOVERNANCE MODAL */}
      {showAdminModal && (
        <div
          data-testid="v4-library-admin-modal"
          onClick={() => setShowAdminModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 backdrop-blur-xs p-4"
        >
          <div
            data-draggable-shell="admin"
            onClick={(e) => e.stopPropagation()}
            className="birim-ice-modal rounded-[28px] max-w-3xl w-full overflow-hidden text-stone-900"
          >
            <div onPointerDown={(e) => startZeroLagModalDrag(e)} title="Taşımak için sürükleyin" className="px-5 py-4 birim-ice-shell-header flex items-center justify-between cursor-grab active:cursor-grabbing select-none">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-[#57534E]" />
                <h2 className="text-sm font-bold">
                  Birim V4 Kütüphane Yönetimi (DRAFT → REVIEW → VERIFIED → PUBLISHED)
                </h2>
              </div>
              <button
                type="button"
                data-testid="v4-library-admin-close"
                onClick={() => setShowAdminModal(false)}
                className="px-2 py-1 rounded text-stone-500 hover:text-stone-900 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-5 space-y-3 max-h-[75vh] overflow-y-auto text-xs">
              <div className="grid grid-cols-3 gap-2">
                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                  <div className="text-[10px] text-stone-500 uppercase font-bold">
                    Modül Şablonları
                  </div>
                  <div className="text-lg font-black font-mono">
                    {v4ModuleTemplates.length} Şablon (6 Aile)
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                  <div className="text-[10px] text-stone-500 uppercase font-bold">
                    Donanım Profilleri
                  </div>
                  <div className="text-lg font-black font-mono">
                    {hardwareCatalog.length} Üretici SKU
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                  <div className="text-[10px] text-stone-500 uppercase font-bold">
                    Kapak & Kulp Sistemleri
                  </div>
                  <div className="text-lg font-black font-mono">
                    {doorSystemDefinitions.length} Kapak / {handleProfiles.length} Kulp
                  </div>
                </div>
              </div>

              <p className="text-[#57534E]">Katalog teknik inceleme bekliyor. Kulp geometrileri ve gelişmiş mekanizma hareketleri temsilidir; montaj/CNC onayı değildir.</p>

              {/* WP-08 & WP-08.1 Interactive Local Library Authoring & Rollback Controls */}
              <div
                data-testid="v4-library-authoring-bar"
                className="flex flex-col gap-2.5 p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="p-1 rounded-lg bg-white border border-stone-200">
                      <V3IsometricModuleIcon
                        widthMm={newDraftWidth}
                        heightMm={newDraftHeight}
                        depthMm={newDraftDepth}
                        bayCount={newDraftWidth >= 900 ? 2 : 1}
                        isOpenFront={newDraftDoorSys === "open"}
                        size="sm"
                      />
                    </div>
                    <input
                      data-testid="v4-library-draft-name-input"
                      type="text"
                      value={newDraftName}
                      onChange={(e) => setNewDraftName(e.target.value)}
                      placeholder="Yeni şablon adı..."
                      className="px-2.5 py-1 rounded-lg border border-stone-300 bg-white text-xs font-medium text-stone-900"
                    />
                    <input
                      data-testid="v4-library-draft-width-input"
                      type="number"
                      min={150}
                      max={3600}
                      step={50}
                      value={newDraftWidth}
                      onChange={(e) => setNewDraftWidth(Number(e.target.value) || 600)}
                      title="Genişlik W (mm)"
                      className="w-16 px-2 py-1 rounded-lg border border-stone-300 bg-white text-xs font-mono font-bold text-stone-900"
                    />
                    <input
                      data-testid="v4-library-draft-height-input"
                      type="number"
                      min={100}
                      max={2800}
                      step={50}
                      value={newDraftHeight}
                      onChange={(e) => setNewDraftHeight(Number(e.target.value) || 720)}
                      title="Yükseklik H (mm)"
                      className="w-16 px-2 py-1 rounded-lg border border-stone-300 bg-white text-xs font-mono font-bold text-stone-900"
                    />
                    <input
                      data-testid="v4-library-draft-depth-input"
                      type="number"
                      min={16}
                      max={1000}
                      step={20}
                      value={newDraftDepth}
                      onChange={(e) => setNewDraftDepth(Number(e.target.value) || 580)}
                      title="Derinlik D (mm)"
                      className="w-16 px-2 py-1 rounded-lg border border-stone-300 bg-white text-xs font-mono font-bold text-stone-900"
                    />
                    <select
                      data-testid="v4-library-draft-doorsys-select"
                      value={newDraftDoorSys}
                      onChange={(e) => setNewDraftDoorSys(e.target.value as DoorSystemId)}
                      className="px-2 py-1 rounded-lg border border-stone-300 bg-white text-xs font-semibold text-stone-800"
                    >
                      {doorSystemDefinitions.map((ds) => (
                        <option key={ds.id} value={ds.id}>
                          {ds.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      data-testid="v4-library-create-draft-btn"
                      onClick={() => {
                        const cleanName = newDraftName.trim() || "Özel Taslak Şablon";
                        libraryAdminStore.createDraftTemplateEntry({
                          id: `tpl_draft_${Date.now()}`,
                          code: `TPL-DRAFT-${adminRefreshTick + 1}`,
                          name: cleanName,
                          familyId: selectedV4Family,
                          sourceId: "SRC_BIRIM_V4_SPEC",
                          defaultDimensions: {
                            width: newDraftWidth,
                            height: newDraftHeight,
                            depth: newDraftDepth,
                          },
                          defaultDoorSystemId: newDraftDoorSys,
                        });
                        libraryAdminStore.saveToLocalStorage();
                        setAdminRefreshTick((t) => t + 1);
                      }}
                      className="px-3 py-1 rounded-lg bg-[#EEF3F8] hover:bg-[#F1F5F9] text-[#111827] font-semibold cursor-pointer"
                    >
                      + Taslak Şablon Oluştur (DRAFT)
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-stone-600">
                    <span>Toplam Kayıt: {adminRecords.length}</span>
                    {libraryAdminStore.getReleases().length > 0 && (
                      <button
                        type="button"
                        data-testid="v4-library-rollback-btn"
                        onClick={() => {
                          const rels = libraryAdminStore.getReleases();
                          const lastRel = rels[rels.length - 1];
                          if (lastRel) {
                            libraryAdminStore.rollbackToRelease(lastRel.releaseId);
                            libraryAdminStore.saveToLocalStorage();
                            setAdminRefreshTick((t) => t + 1);
                          }
                        }}
                        className="px-2 py-1 rounded bg-white border border-stone-300 hover:bg-stone-100 font-semibold text-stone-700 cursor-pointer"
                      >
                        Son Sürüme Geri Dön (Rollback)
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                {adminRecords.slice(0, 25).map((rec) => {
                  const matchedTpl = v4ModuleTemplates.find((t) => t.templateId === rec.id);
                  return (
                    <div
                      key={rec.id}
                      className="flex items-center justify-between p-2 rounded-xl bg-stone-50 border border-stone-200"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {rec.entityType === "MODULE_TEMPLATE" && (
                          <div className="p-0.5 rounded bg-white border border-stone-200 shrink-0">
                            <V3IsometricModuleIcon
                              template={matchedTpl}
                              widthMm={rec.defaultDimensions?.width}
                              heightMm={rec.defaultDimensions?.height}
                              depthMm={rec.defaultDimensions?.depth}
                              size="sm"
                            />
                          </div>
                        )}
                        <div className="truncate">
                          <span className="font-bold text-stone-900">{rec.name}</span>
                          <span className="ml-2 text-[10px] font-mono text-stone-500">
                            [{rec.entityType} • v{rec.semver}]
                          </span>
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                          rec.lifecycleState === "PUBLISHED"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-[#57534E]"
                        }`}
                      >
                        {rec.lifecycleState}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}


      {/* CLICK-TO-OPEN FLOATING LARGE VISUAL ICON MODULE CATALOG */}
      {isVisualCatalogOpen && (
        <div
          data-testid="v4-floating-catalog-modal"
          onClick={() => setIsVisualCatalogOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 backdrop-blur-xs p-4 sm:p-6"
        >
          <div
            data-draggable-shell="catalog"
            onClick={(e) => e.stopPropagation()}
            className="birim-ice-modal rounded-[28px] max-w-5xl w-full h-[85vh] flex flex-col overflow-hidden text-stone-900"
          >
            {/* Header (Zero-Lag Draggable) */}
            <div onPointerDown={(e) => startZeroLagModalDrag(e)} title="Taşımak için sürükleyin" className="px-5 py-3.5 birim-ice-shell-header flex flex-wrap items-center justify-between gap-3 cursor-grab active:cursor-grabbing select-none">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#EEF3F8] text-[#1C1917] border border-[#CBD5E1] flex items-center justify-center font-bold">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-stone-900">
                    Görsel Modül Kataloğu — Büyük İkon Vitrini (92 Şablon)
                  </h2>
                  <p className="text-[11px] text-stone-500">
                    İkona veya &quot;Değiştir&quot; butonuna tıklayarak mevcut modülü değiştirin, &quot;+ Yanına Ekle&quot; ile dizilime yeni modül ekleyin
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  data-testid="v4-floating-catalog-search"
                  value={catalogSearchQuery}
                  onChange={(e) => setCatalogSearchQuery(e.target.value)}
                  placeholder="Modül veya ölçü ara (ör: 600, evye, fırın)..."
                  className="w-56 px-3 py-1.5 rounded-xl bg-white border border-stone-300 text-xs font-medium text-stone-900"
                />
                <button
                  type="button"
                  data-testid="v4-floating-catalog-close"
                  onClick={() => setIsVisualCatalogOpen(false)}
                  className="px-3 py-1.5 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-bold cursor-pointer"
                >
                  Kapat ✕
                </button>
              </div>
            </div>

            {/* Category Pills + Width Filter */}
            <div className="px-5 py-2.5 border-b border-stone-200 bg-white flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                {v4ModuleFamilies.map((fam) => (
                  <button
                    key={fam.id}
                    type="button"
                    data-testid={`v4-floating-fam-${fam.id}`}
                    onClick={() => setSelectedV4Family(fam.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      selectedV4Family === fam.id
                        ? "bg-[#EEF3F8] text-[#111827] shadow-xs"
                        : "bg-stone-100 hover:bg-stone-200 text-stone-700"
                    }`}
                  >
                    {fam.name} ({fam.targetTemplateCount})
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl text-[11px]">
                {[
                  { id: "all", label: "Tüm Ölçüler" },
                  { id: "narrow", label: "≤ 60 cm" },
                  { id: "medium", label: "65–100 cm" },
                  { id: "wide", label: "100 cm+" },
                ].map((wf) => (
                  <button
                    key={wf.id}
                    type="button"
                    onClick={() =>
                      setCatalogWidthFilter(wf.id as "all" | "narrow" | "medium" | "wide")
                    }
                    className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
                      catalogWidthFilter === wf.id
                        ? "bg-[#EEF3F8] text-[#1C1917] border border-[#CBD5E1]"
                        : "text-stone-600 hover:text-stone-900"
                    }`}
                  >
                    {wf.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Large 4-Column Visual Icon Grid (size="2xl" = 128x112px) */}
            <div className="flex-1 overflow-y-auto p-5 bg-[#F8FAFC]">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
                {familyTemplates.map((vt) => (
                  <div
                    key={vt.templateId}
                    draggable={true}
                    onDragStart={(e) => {
                      startModuleSilhouetteDrag(e, vt.templateId);
                      setTimeout(() => setIsVisualCatalogOpen(false), 120);
                    }}
                    onDragEnd={() => setActiveDraggedTemplateId(null)}
                    className="p-3 rounded-2xl bg-white hover:bg-[#F8FAFC]/40 border border-stone-200/90 hover:border-amber-700 shadow-xs hover:shadow-md flex flex-col items-center text-center justify-between gap-2 transition group cursor-grab active:cursor-grabbing"
                  >
                    <div className="w-full flex items-center justify-between text-[10px] font-mono text-stone-400 px-1">
                      <span className="font-bold text-[#57534E]">{vt.code}</span>
                      <span>
                        {vt.defaultDimensions.width}×{vt.defaultDimensions.height}×
                        {vt.defaultDimensions.depth}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        applyV4Template(vt.templateId, false);
                        setIsVisualCatalogOpen(false);
                      }}
                      className="w-full py-3 rounded-xl bg-stone-50/80 border border-stone-200/70 flex items-center justify-center group-hover:scale-105 transition-transform cursor-pointer"
                      title={`${vt.name} — Aktif modülü değiştir`}
                    >
                      <V3IsometricModuleIcon template={vt} size="2xl" />
                    </button>

                    <div className="w-full">
                      <div className="text-xs font-bold text-stone-900 line-clamp-1">
                        {vt.name}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 w-full pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          applyV4Template(vt.templateId, false);
                          setIsVisualCatalogOpen(false);
                        }}
                        className="py-1.5 px-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-900 text-[11px] font-bold cursor-pointer"
                      >
                        Değiştir
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          dropV4TemplateWithSnap(vt.templateId);
                          setIsVisualCatalogOpen(false);
                        }}
                        className="py-1.5 px-2 rounded-xl bg-[#EEF3F8] hover:bg-[#E4ECF4] text-[#1C1917] text-[#111827] text-[11px] font-bold cursor-pointer"
                      >
                        🧲 + Sıraya Snap
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showStepWizardModal && (() => {
        const safeStep = Math.min(4, Math.max(1, wizardStep)) as 1 | 2 | 3 | 4;
        const fillerMm = wizAutoFiller50Mm && wizWallWidthMm >= 1400 ? 50 : 0;
        const estUsableMm = Math.max(800, wizWallWidthMm - fillerMm * 2);
        const mainModCount =
          estUsableMm < 1300 ? 1 : estUsableMm < 2200 ? 2 : estUsableMm < 3300 ? 3 : 4;
        const wingModCount = wizRoomShape === "u_shape" ? 2 : wizRoomShape === "l_shape" ? 1 : 0;
        const estModCount = mainModCount + wingModCount;
        const totalEffectiveSpanMm = estUsableMm + wingModCount * 1000;
        const heightScale =
          wizSpaceCategory === "kitchen" ? 0.65 : Math.max(0.82, wizTargetHeightMm / 2400);
        const estBays = estModCount * 2;
        const estHanging =
          wizSpaceCategory === "kitchen"
            ? 0
            : wizInteriorFocus === "hanging"
            ? Math.round((totalEffectiveSpanMm * 0.82) / 32)
            : wizInteriorFocus === "balanced"
            ? Math.round((totalEffectiveSpanMm * 0.58) / 32)
            : Math.round((totalEffectiveSpanMm * 0.32) / 32);
        const estFolded = Math.round(
          (wizInteriorFocus === "shelves"
            ? estBays * 28
            : wizInteriorFocus === "balanced"
            ? estBays * 20
            : estBays * 12) * heightScale
        );

        const swatchDefs = [
          {
            id: "cashmere" as const,
            name: "İpeksi Kaşmir Mat",
            sub: "Sıcak bej-gri soft-touch",
            hex: "#D8D0C5",
            borderHex: "#A89F91",
            interiorHex: "#F5F2EB",
            tier: "smart" as const,
          },
          {
            id: "white" as const,
            name: "Alabaster Saf Beyaz",
            sub: "Ferah modern mat beyaz",
            hex: "#F8FAFC",
            borderHex: "#CBD5E1",
            interiorHex: "#FFFFFF",
            tier: "eco" as const,
          },
          {
            id: "oak" as const,
            name: "Doğal Safir Meşe",
            sub: "Sıcak İskandinav ahşap dokusu",
            hex: "#C89F70",
            borderHex: "#9A6B3B",
            interiorHex: "#F5EBE0",
            tier: "smart" as const,
          },
          {
            id: "walnut" as const,
            name: "Amerikan Doğal Ceviz",
            sub: "Zengin koyu ceviz kaplama",
            hex: "#6E473B",
            borderHex: "#4A2E25",
            interiorHex: "#EDE4DF",
            tier: "signature" as const,
          },
          {
            id: "anthracite" as const,
            name: "Antrasit İpek Mat",
            sub: "Modern mimari koyu gri",
            hex: "#334155",
            borderHex: "#1E293B",
            interiorHex: "#E2E8F0",
            tier: "signature" as const,
          },
        ];
        const activeSwatch =
          swatchDefs.find((s) => s.id === wizColorSwatch) || swatchDefs[0];

        const basePricePerMeter =
          wizConceptTier === "eco" ? 540 : wizConceptTier === "smart" ? 720 : 960;
        const doorMultiplier =
          wizDoorStyle === "glass"
            ? 1.18
            : wizDoorStyle === "sliding"
            ? 1.08
            : wizDoorStyle === "open"
            ? 0.82
            : 1.0;
        const accExtra =
          (wizAddLed ? 85 : 0) +
          (wizAddTrouserRack ? 65 : 0) +
          (wizAddJewelryTray ? 75 : 0);
        const depthMultiplier = Math.max(0.88, wizTargetDepthMm / 600);
        const estTotalEur = Math.round(
          ((wizWallWidthMm + wingModCount * 1000) / 1000) *
            basePricePerMeter *
            doorMultiplier *
            heightScale *
            depthMultiplier +
            accExtra
        );

        const stepsList = [
          { num: 1 as const, title: "Mekân Seçimi" },
          { num: 2 as const, title: "Duvar Ölçüsü" },
          { num: 3 as const, title: "İç Düzen & Kapak" },
          { num: 4 as const, title: "Renk & Konfor" },
        ];

        return (
          <div
            data-testid="v4-step-wizard-modal"
            className="fixed inset-0 z-[130] bg-slate-900/45 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
            onClick={() => setShowStepWizardModal(false)}
          >
            <div
              data-draggable-shell="wizard"
              className="birim-ice-modal rounded-[28px] max-w-5xl w-full overflow-hidden text-slate-900 flex flex-col max-h-[92vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* B1R1M Mimari Sihirbaz Başlığı ve Adım Çubuğu (Zero-Lag Draggable) */}
              <div onPointerDown={(e) => startZeroLagModalDrag(e)} title="Taşımak için sürükleyin" className="px-6 pt-5 pb-4 birim-ice-shell-header cursor-grab active:cursor-grabbing select-none">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#141413] text-[#FAF9F6] flex items-center justify-center shrink-0">
                      <Wand2 className="w-4 h-4 text-[#D6C7B2]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#8C7A6B]">
                          B1R1M Akıllı Tasarım Sihirbazı
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-[#EFECE5] text-[#44403C] text-[10px] font-semibold border border-[#DED8CC]">
                          Çakışmasız Parametrik Yerleşim
                        </span>
                      </div>
                      <h2 className="text-base sm:text-lg font-bold text-[#141413]">
                        4 Adımda Mekânınıza Özel Dolap Tasarlayın
                      </h2>
                    </div>
                  </div>
                  <button
                    type="button"
                    data-testid="close-step-wizard-btn"
                    onClick={() => setShowStepWizardModal(false)}
                    className="w-8 h-8 rounded-lg bg-white hover:bg-[#EFECE5] text-[#57534E] hover:text-[#141413] font-bold text-sm flex items-center justify-center border border-[#DED8CC] transition cursor-pointer"
                    title="Kapat"
                  >
                    ✕
                  </button>
                </div>

                {/* 4 Adımlı Mimari İlerleme Sekmeleri */}
                <div className="grid grid-cols-4 gap-2 mt-4">
                  {stepsList.map((st) => {
                    const isCur = safeStep === st.num;
                    const isPassed = safeStep > st.num;
                    return (
                      <button
                        key={st.num}
                        type="button"
                        data-testid={`wizard-step-tab-${st.num}`}
                        onClick={() => setWizardStep(st.num)}
                        className={`py-2 px-3 rounded-lg border text-left transition flex items-center gap-2 cursor-pointer ${
                          isCur
                            ? "bg-[#141413] text-[#FAF9F6] border-[#141413]"
                            : isPassed
                            ? "bg-white text-[#141413] border-[#8C7A6B]"
                            : "bg-white/80 text-[#57534E] border-[#DED8CC] hover:bg-white"
                        }`}
                      >
                        <span
                          className={`w-5 h-5 rounded-xs text-[11px] font-bold flex items-center justify-center shrink-0 ${
                            isCur
                              ? "bg-[#FAF9F6] text-[#141413]"
                              : isPassed
                              ? "bg-[#8C7A6B] text-white"
                              : "bg-[#EFECE5] text-[#57534E]"
                          }`}
                        >
                          {isPassed ? "✓" : st.num}
                        </span>
                        <span className="text-xs font-semibold truncate">{st.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2 Sütunlu Ana Gövde: Sol = Görsel Seçimler (7 birim), Sağ = Canlı İnteraktif Dolap Önizlemesi (5 birim) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 min-h-0 overflow-y-auto">
                {/* SOL SÜTUN: ADIM İÇERİKLERİ */}
                <div className="lg:col-span-7 p-6 space-y-5 overflow-y-auto">
                  {/* ADIM 1: MEKÂN SEÇİMİ (Görsel SVG İkonlu Ferah Kartlar) */}
                  {safeStep === 1 && (
                    <div data-testid="wizard-step-1-content" className="space-y-4">
                      <div>
                        <span className="text-xs font-bold text-[#8C7A6B] uppercase tracking-wider">
                          Adım 1 / 4
                        </span>
                        <h3 className="text-lg font-extrabold text-slate-900 mt-0.5">
                          Hangi Odaya Dolap Yapıyoruz?
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Birini seçin; ideal ölçüler ve iç bölmeler otomatik hazırlansın.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                          {
                            id: "wardrobe" as const,
                            title: "Yatak Odası Gardırobu",
                            desc: "Askılık, katlı raf ve çekmeceli yatak odası dolabı",
                            badge: "En Popüler",
                            defaultW: 3000,
                            defaultH: 2400,
                            defaultD: 600,
                            svg: (
                              <svg viewBox="0 0 64 52" className="w-12 h-10 shrink-0">
                                <rect x="6" y="4" width="52" height="44" rx="4" fill="#FAF9F6" stroke="#141413" strokeWidth="2.5" />
                                <line x1="24" y1="4" x2="24" y2="48" stroke="#141413" strokeWidth="2" />
                                <line x1="41" y1="4" x2="41" y2="48" stroke="#141413" strokeWidth="2" />
                                <line x1="20" y1="24" x2="20" y2="30" stroke="#141413" strokeWidth="2.5" strokeLinecap="round" />
                                <line x1="37" y1="24" x2="37" y2="30" stroke="#141413" strokeWidth="2.5" strokeLinecap="round" />
                              </svg>
                            ),
                          },
                          {
                            id: "walkin" as const,
                            title: "Giyinme Odası (Walk-In)",
                            desc: "Çift kişilik geniş askı, pantolonluk, takı çekmecesi ve iç LED",
                            badge: "Konfor Serisi",
                            defaultW: 3600,
                            defaultH: 2400,
                            defaultD: 600,
                            svg: (
                              <svg viewBox="0 0 64 52" className="w-12 h-10 shrink-0">
                                <rect x="4" y="4" width="56" height="44" rx="4" fill="#ECFDF5" stroke="#059669" strokeWidth="2.5" />
                                <line x1="22" y1="4" x2="22" y2="48" stroke="#059669" strokeWidth="2" />
                                <line x1="42" y1="4" x2="42" y2="48" stroke="#059669" strokeWidth="2" />
                                <line x1="6" y1="14" x2="58" y2="14" stroke="#10B981" strokeWidth="2" />
                                <line x1="22" y1="34" x2="42" y2="34" stroke="#10B981" strokeWidth="2" />
                                <line x1="22" y1="41" x2="42" y2="41" stroke="#10B981" strokeWidth="2" />
                              </svg>
                            ),
                          },
                          {
                            id: "kitchen" as const,
                            title: "Mutfak Dolabı Sistemi",
                            desc: "Eviye altı, çekmeceli ocak altı ve hazırlık modülleri",
                            badge: "Tesisat Uyumlu",
                            defaultW: 3600,
                            defaultH: 900,
                            defaultD: 580,
                            svg: (
                              <svg viewBox="0 0 64 52" className="w-12 h-10 shrink-0">
                                <rect x="6" y="18" width="52" height="30" rx="3" fill="#FFFBEB" stroke="#D97706" strokeWidth="2.5" />
                                <line x1="24" y1="18" x2="24" y2="48" stroke="#D97706" strokeWidth="2" />
                                <line x1="42" y1="18" x2="42" y2="48" stroke="#D97706" strokeWidth="2" />
                                <line x1="24" y1="28" x2="42" y2="28" stroke="#D97706" strokeWidth="2" />
                                <line x1="24" y1="38" x2="42" y2="38" stroke="#D97706" strokeWidth="2" />
                              </svg>
                            ),
                          },
                          {
                            id: "living" as const,
                            title: "TV Ünitesi & Kitaplık",
                            desc: "Füme cam vitrinli, açık raflı ve alt çekmeceli yaşam ünitesi",
                            badge: "Salon & Ofis",
                            defaultW: 2800,
                            defaultH: 2200,
                            defaultD: 450,
                            svg: (
                              <svg viewBox="0 0 64 52" className="w-12 h-10 shrink-0">
                                <rect x="6" y="6" width="52" height="42" rx="4" fill="#F5F3FF" stroke="#7C3AED" strokeWidth="2.5" />
                                <line x1="20" y1="6" x2="20" y2="48" stroke="#7C3AED" strokeWidth="2" />
                                <line x1="44" y1="6" x2="44" y2="48" stroke="#7C3AED" strokeWidth="2" />
                                <rect x="23" y="16" width="18" height="14" rx="2" fill="#DDD6FE" stroke="#7C3AED" strokeWidth="1.8" />
                              </svg>
                            ),
                          },
                        ].map((item) => {
                          const sel = wizSpaceCategory === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              data-testid={`wizard-cat-${item.id}`}
                              onClick={() => {
                                setWizSpaceCategory(item.id);
                                setWizWallWidthMm(item.defaultW);
                                setWizTargetHeightMm(item.defaultH);
                                setWizTargetDepthMm(item.defaultD);
                                if (item.id === "walkin") setWizDoorStyle("open");
                                else if (item.id === "living") setWizDoorStyle("glass");
                                else setWizDoorStyle("hinged");
                              }}
                              className={`p-4 rounded-xl border-2 text-left transition-all flex items-start gap-3.5 cursor-pointer ${
                                sel
                                  ? "bg-[#FAF9F6] border-[#141413] ring-1 ring-[#141413]"
                                  : "bg-[#FAF9F6]/70 hover:bg-white border-[#DED8CC] hover:border-[#8C7A6B]"
                              }`}
                            >
                              <div className="p-2 rounded-xl bg-white border border-[#DED8CC]/80 shadow-2xs">
                                {item.svg}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-[#141413] border border-[#DED8CC]">
                                    {item.badge}
                                  </span>
                                  {sel && (
                                    <span className="text-xs font-extrabold text-[#8C7A6B]">
                                      ✓ Seçili
                                    </span>
                                  )}
                                </div>
                                <div className="text-sm font-extrabold text-slate-900 mt-1.5">
                                  {item.title}
                                </div>
                                <p className="text-xs text-slate-500 mt-0.5 leading-snug">
                                  {item.desc}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ADIM 2: DUVAR ÖLÇÜSÜ (Tek Tıkla Hazır Santimetre Hapları + Yumuşak Sürgü) */}
                  {safeStep === 2 && (
                    <div data-testid="wizard-step-2-content" className="space-y-5">
                      <div>
                        <span className="text-xs font-bold text-[#8C7A6B] uppercase tracking-wider">
                          Adım 2 / 4
                        </span>
                        <h3 className="text-lg font-extrabold text-slate-900 mt-0.5">
                          Duvarınızın Genişliği ve Yüksekliği Kaç cm?
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Sağdaki canlı çizimde modül sayısının duvarınıza göre nasıl bölündüğünü anında görebilirsiniz.
                        </p>
                      </div>

                      {/* Genişlik */}
                      <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#DED8CC] space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700">
                            1. Duvar Genişliği (Soldan Sağa)
                          </span>
                          <span className="text-base font-black font-mono text-[#141413] bg-[#FAF9F6] px-3 py-1 rounded-lg border border-[#DED8CC]">
                            {wizWallWidthMm / 10} cm
                          </span>
                        </div>
                        <input
                          type="range"
                          data-testid="wizard-wall-width-slider"
                          min={1200}
                          max={5200}
                          step={100}
                          value={wizWallWidthMm}
                          onChange={(e) => setWizWallWidthMm(Number(e.target.value))}
                          className="w-full accent-[#141413] h-2 bg-slate-200 rounded-lg cursor-pointer"
                        />
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                          {[1800, 2400, 3000, 3600, 4200, 4800].map((w) => (
                            <button
                              key={w}
                              type="button"
                              onClick={() => setWizWallWidthMm(w)}
                              className={`py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                                wizWallWidthMm === w
                                  ? "bg-[#141413] text-[#FAF9F6] border-[#141413] shadow-2xs"
                                  : "bg-white text-slate-700 border-[#DED8CC] hover:border-[#8C7A6B]"
                              }`}
                            >
                              {w / 10} cm
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Yükseklik ve Oda Tipi */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#DED8CC]">
                          <div className="text-xs font-bold text-slate-700 mb-2.5">
                            2. Dolap Yüksekliği
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { h: 2100, label: "210 cm", sub: "Standart" },
                              { h: 2400, label: "240 cm", sub: "Yüksek" },
                              { h: 2600, label: "260 cm", sub: "Tavana Tam" },
                            ].map((opt) => (
                              <button
                                key={opt.h}
                                type="button"
                                onClick={() => setWizTargetHeightMm(opt.h)}
                                className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                                  wizTargetHeightMm === opt.h
                                    ? "bg-[#141413] text-[#FAF9F6] border-[#141413] shadow-2xs"
                                    : "bg-white text-slate-700 border-[#DED8CC] hover:border-[#8C7A6B]"
                                }`}
                              >
                                <div className="text-xs font-extrabold">{opt.label}</div>
                                <div className="text-[10px] opacity-80 mt-0.5">{opt.sub}</div>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#DED8CC]">
                          <div className="text-xs font-bold text-slate-700 mb-2.5">
                            3. Duvar Şekli
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { id: "rectangular" as const, label: "Düz Duvar", sub: "I Tipi" },
                              { id: "l_shape" as const, label: "L Köşe", sub: "2 Duvar" },
                              { id: "u_shape" as const, label: "U Tipi", sub: "3 Duvar" },
                            ].map((sh) => (
                              <button
                                key={sh.id}
                                type="button"
                                data-testid={`wizard-shape-${sh.id}`}
                                onClick={() => setWizRoomShape(sh.id)}
                                className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                                  wizRoomShape === sh.id
                                    ? "bg-[#141413] text-[#FAF9F6] border-[#141413] shadow-2xs"
                                    : "bg-white text-slate-700 border-[#DED8CC] hover:border-[#8C7A6B]"
                                }`}
                              >
                                <div className="text-xs font-extrabold">{sh.label}</div>
                                <div className="text-[10px] opacity-80 mt-0.5">{sh.sub}</div>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <label className="flex items-center gap-3 p-3.5 rounded-xl bg-[#FAF9F6] border border-[#DED8CC] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={wizAutoFiller50Mm}
                          onChange={(e) => setWizAutoFiller50Mm(e.target.checked)}
                          className="w-4 h-4 accent-[#141413] rounded"
                        />
                        <div>
                          <div className="text-xs font-extrabold text-[#141413]">
                            Sağ ve Sol Duvarda 5 cm Kör Çıta Payı Bırak (Önerilen)
                          </div>
                          <div className="text-[11px] text-[#57534E]">
                            Kapakların duvara sürtmeden 90° rahat açılmasını sağlar ve çakışmayı önler.
                          </div>
                        </div>
                      </label>
                    </div>
                  )}

                  {/* ADIM 3: İÇ DÜZEN VE KAPAK TİPİ (Görsel İç Şemalı Kartlar) */}
                  {safeStep === 3 && (
                    <div data-testid="wizard-step-3-content" className="space-y-5">
                      <div>
                        <span className="text-xs font-bold text-[#8C7A6B] uppercase tracking-wider">
                          Adım 3 / 4
                        </span>
                        <h3 className="text-lg font-extrabold text-slate-900 mt-0.5">
                          İç Bölme Düzeni ve Kapak Tipi Nasıl Olsun?
                        </h3>
                      </div>

                      <div>
                        <div className="text-xs font-bold text-slate-700 mb-2">
                          1. Dolap İçi Yerleşim Tarzı
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {[
                            {
                              id: "hanging" as const,
                              title: "Bol Askılı",
                              desc: "Elbise, gömlek ve ceket ağırlıklı",
                              svg: (
                                <svg viewBox="0 0 60 44" className="w-full h-11">
                                  <rect x="4" y="2" width="52" height="40" rx="3" fill="#F8FAFC" stroke="#64748B" strokeWidth="2" />
                                  <line x1="4" y1="10" x2="56" y2="10" stroke="#64748B" strokeWidth="2" />
                                  <line x1="6" y1="15" x2="54" y2="15" stroke="#141413" strokeWidth="2.5" />
                                  {[14, 22, 30, 38, 46].map((x) => (
                                    <rect key={x} x={x} y="16" width="5" height="20" rx="1.5" fill="#C2B8A8" />
                                  ))}
                                </svg>
                              ),
                            },
                            {
                              id: "balanced" as const,
                              title: "Dengeli Aile (Önerilen)",
                              desc: "Sol bölme askılık, sağ bölme raf ve çekmece",
                              svg: (
                                <svg viewBox="0 0 60 44" className="w-full h-11">
                                  <rect x="4" y="2" width="52" height="40" rx="3" fill="#F8FAFC" stroke="#64748B" strokeWidth="2" />
                                  <line x1="30" y1="2" x2="30" y2="42" stroke="#64748B" strokeWidth="2" />
                                  <line x1="6" y1="14" x2="28" y2="14" stroke="#141413" strokeWidth="2.5" />
                                  {[10, 17, 23].map((x) => (
                                    <rect key={x} x={x} y="15" width="4" height="19" rx="1" fill="#C2B8A8" />
                                  ))}
                                  <line x1="30" y1="14" x2="56" y2="14" stroke="#64748B" strokeWidth="2" />
                                  <line x1="30" y1="24" x2="56" y2="24" stroke="#64748B" strokeWidth="2" />
                                  <rect x="32" y="31" width="22" height="9" rx="1" fill="#FDE68A" stroke="#D97706" strokeWidth="1.5" />
                                </svg>
                              ),
                            },
                            {
                              id: "shelves" as const,
                              title: "Bol Raflı & Çekmeceli",
                              desc: "Katlı kazak, tişört ve kutu düzeni",
                              svg: (
                                <svg viewBox="0 0 60 44" className="w-full h-11">
                                  <rect x="4" y="2" width="52" height="40" rx="3" fill="#F8FAFC" stroke="#64748B" strokeWidth="2" />
                                  <line x1="30" y1="2" x2="30" y2="42" stroke="#64748B" strokeWidth="2" />
                                  {[11, 20, 29].map((y) => (
                                    <line key={y} x1="4" y1={y} x2="56" y2={y} stroke="#64748B" strokeWidth="2" />
                                  ))}
                                  <rect x="6" y="31" width="22" height="9" rx="1" fill="#FDE68A" stroke="#D97706" strokeWidth="1.5" />
                                </svg>
                              ),
                            },
                          ].map((foc) => {
                            const sel = wizInteriorFocus === foc.id;
                            return (
                              <button
                                key={foc.id}
                                type="button"
                                data-testid={`wizard-focus-${foc.id}`}
                                onClick={() => setWizInteriorFocus(foc.id)}
                                className={`p-3 rounded-xl border-2 text-left transition cursor-pointer ${
                                  sel
                                    ? "bg-[#FAF9F6] border-[#141413] ring-1 ring-[#141413]"
                                    : "bg-[#FAF9F6]/70 hover:bg-white border-[#DED8CC] hover:border-[#8C7A6B]"
                                }`}
                              >
                                {foc.svg}
                                <div className="text-xs font-extrabold text-slate-900 mt-2">
                                  {foc.title}
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                                  {foc.desc}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs font-bold text-slate-700 mb-2">
                          2. Kapak Açılım Tercihi
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          {[
                            { id: "hinged" as const, title: "Menteşeli Kapak", sub: "90° Frenli Açılır" },
                            { id: "sliding" as const, title: "Sürme Kapak", sub: "Raylı, Yer Kaplamaz" },
                            { id: "glass" as const, title: "Füme Cam Vitrin", sub: "Alüminyum Çerçeve" },
                            { id: "open" as const, title: "Açık Giyinme", sub: "Kapaksız Walk-In" },
                          ].map((dr) => (
                            <button
                              key={dr.id}
                              type="button"
                              data-testid={`wizard-door-${dr.id}`}
                              onClick={() => setWizDoorStyle(dr.id)}
                              className={`p-3 rounded-xl border-2 text-left transition cursor-pointer ${
                                wizDoorStyle === dr.id
                                  ? "bg-[#141413] text-[#FAF9F6] border-[#141413] shadow-2xs"
                                  : "bg-white text-slate-800 border-[#DED8CC] hover:border-[#8C7A6B]"
                              }`}
                            >
                              <div className="text-xs font-extrabold">{dr.title}</div>
                              <div
                                className={`text-[10px] mt-0.5 ${
                                  wizDoorStyle === dr.id ? "text-[#D6C7B2]" : "text-slate-500"
                                }`}
                              >
                                {dr.sub}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ADIM 4: GERÇEK RENK KARTELASI & KONFOR PAKETİ */}
                  {safeStep === 4 && (
                    <div data-testid="wizard-step-4-content" className="space-y-5">
                      <div>
                        <span className="text-xs font-bold text-[#8C7A6B] uppercase tracking-wider">
                          Adım 4 / 4
                        </span>
                        <h3 className="text-lg font-extrabold text-slate-900 mt-0.5">
                          Kapak Renginizi ve Konfor Eklentilerinizi Seçin
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Seçtiğiniz renk sağdaki canlı dolap önizlemesine anında uygulanır.
                        </p>
                      </div>

                      {/* Gerçek Renk Kartelası */}
                      <div>
                        <div className="text-xs font-bold text-slate-700 mb-2">
                          1. Gövde & Kapak Renk Kartelası
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {swatchDefs.map((sw) => {
                            const sel = wizColorSwatch === sw.id;
                            return (
                              <button
                                key={sw.id}
                                type="button"
                                data-testid={`wizard-swatch-${sw.id}`}
                                onClick={() => {
                                  setWizColorSwatch(sw.id);
                                  setWizConceptTier(sw.tier);
                                }}
                                className={`p-3 rounded-xl border-2 flex items-center gap-3 text-left transition cursor-pointer ${
                                  sel
                                    ? "bg-[#FAF9F6] border-[#141413] ring-1 ring-[#141413]"
                                    : "bg-white border-[#DED8CC] hover:border-[#8C7A6B]"
                                }`}
                              >
                                <span
                                  className="w-10 h-10 rounded-full shrink-0 shadow-inner border-2"
                                  style={{
                                    backgroundColor: sw.hex,
                                    borderColor: sw.borderHex,
                                  }}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-extrabold text-slate-900 flex items-center justify-between">
                                    <span>{sw.name}</span>
                                    {sel && <span className="text-[#8C7A6B]">✓</span>}
                                  </div>
                                  <div className="text-[11px] text-slate-500 truncate">
                                    {sw.sub}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Konfor Aksesuarları */}
                      <div>
                        <div className="text-xs font-bold text-slate-700 mb-2">
                          2. Dolap İçi Konfor Aksesuarları
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          {[
                            {
                              id: "led",
                              checked: wizAddLed,
                              toggle: () => setWizAddLed((v) => !v),
                              title: "Sensörlü İç LED",
                              sub: "3000K Sıcak Günışığı (+€85)",
                            },
                            {
                              id: "trouser",
                              checked: wizAddTrouserRack,
                              toggle: () => setWizAddTrouserRack((v) => !v),
                              title: "Raylı Pantolonluk",
                              sub: "Frenli Teleskopik (+€65)",
                            },
                            {
                              id: "jewelry",
                              checked: wizAddJewelryTray,
                              toggle: () => setWizAddJewelryTray((v) => !v),
                              title: "Takı Çekmecesi",
                              sub: "Kadife Bölmeli (+€75)",
                            },
                          ].map((acc) => (
                            <button
                              key={acc.id}
                              type="button"
                              onClick={acc.toggle}
                              className={`p-3 rounded-xl border-2 text-left transition cursor-pointer ${
                                acc.checked
                                  ? "bg-[#FAF9F6] border-[#141413] text-[#141413] ring-1 ring-[#141413]"
                                  : "bg-white border-[#DED8CC] text-slate-700 hover:border-slate-300"
                              }`}
                            >
                              <div className="flex items-center justify-between text-xs font-extrabold">
                                <span>{acc.title}</span>
                                <span
                                  className={`w-5 h-5 rounded-md flex items-center justify-center text-[11px] ${
                                    acc.checked
                                      ? "bg-[#141413] text-[#FAF9F6]"
                                      : "bg-slate-100 text-slate-400"
                                  }`}
                                >
                                  {acc.checked ? "✓" : "+"}
                                </span>
                              </div>
                              <div className="text-[10px] opacity-80 mt-0.5">{acc.sub}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* SAĞ SÜTUN: TÜM SEÇİMLERE ANINDA TEPKİ VEREN CANLI MİMARİ ÖNİZLEME */}
                <div className="lg:col-span-5 bg-[#F5F3EE] border-t lg:border-t-0 lg:border-l border-[#DED8CC] p-5 flex flex-col justify-between">
                  <div className="space-y-3">
                    <GuidedWizardLivePreview
                      step={safeStep}
                      spaceCategory={wizSpaceCategory}
                      roomShape={wizRoomShape}
                      wallWidthMm={wizWallWidthMm}
                      targetHeightMm={wizTargetHeightMm}
                      targetDepthMm={wizTargetDepthMm}
                      autoFiller50Mm={wizAutoFiller50Mm}
                      interiorFocus={wizInteriorFocus}
                      doorStyle={wizDoorStyle}
                      activeSwatch={activeSwatch}
                      addLed={wizAddLed}
                      addTrouserRack={wizAddTrouserRack}
                      addJewelryTray={wizAddJewelryTray}
                    />

                    {/* Canlı Kapasite & Ölçü Kartları */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-xl bg-white border border-[#DED8CC]">
                        <div className="text-[10px] font-medium text-[#78716C]">Net Ölçü &amp; Doku</div>
                        <div className="font-bold text-[#141413] truncate mt-0.5">
                          {wizWallWidthMm / 10}×{wizSpaceCategory === "kitchen" ? 90 : wizTargetHeightMm / 10} cm • {activeSwatch.name.split(" ")[0]}
                        </div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white border border-[#DED8CC]">
                        <div className="text-[10px] font-medium text-[#78716C]">Tahmini Kapasite</div>
                        <div className="font-bold text-[#141413] mt-0.5">
                          {wizSpaceCategory === "kitchen"
                            ? `${estModCount} Alt + ${mainModCount} Üst Modül`
                            : `~${estHanging} Askı • ~${estFolded} Katlı`}
                        </div>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white border border-[#DED8CC] flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-bold text-[#8C7A6B] uppercase tracking-wider">
                          KDV Dahil Tahmini Toplam
                        </div>
                        <div className="text-[11px] text-[#57534E] mt-0.5">
                          {wizRoomShape === "rectangular"
                            ? "Düz duvar yerleşimi"
                            : wizRoomShape === "l_shape"
                            ? "L köşe dönüşlü yerleşim"
                            : "U tipi 3 duvar yerleşimi"}
                        </div>
                      </div>
                      <div className="text-xl font-bold font-mono text-[#141413]">
                        ~€{estTotalEur.toLocaleString("tr-TR")}
                      </div>
                    </div>
                  </div>

                  {/* Her Adımda Aktif "Hemen Oluştur" Aksiyon Butonları */}
                  <div className="space-y-2 mt-4 pt-3 border-t border-[#DED8CC]">
                    <button
                      type="button"
                      data-testid="wizard-finish-3d-btn"
                      onClick={() => handleFinishStepWizard("studio_3d")}
                      className="w-full h-10 px-4 rounded-lg bg-[#141413] hover:bg-[#292524] text-[#FAF9F6] font-semibold text-xs flex items-center justify-center gap-2 transition active:scale-[0.99] cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4 text-[#D6C7B2]" />
                      <span>Tasarımı Oluştur ve 3D Stüdyoda Aç</span>
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        data-testid="wizard-finish-2d-btn"
                        onClick={() => handleFinishStepWizard("plan_2d")}
                        className="h-9 px-3 rounded-lg bg-white hover:bg-[#EFECE5] text-[#141413] border border-[#DED8CC] font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <span>2D Planda Aç</span>
                      </button>

                      <button
                        type="button"
                        data-testid="wizard-finish-pdf-btn"
                        onClick={() => handleFinishStepWizard("print_pdf")}
                        className="h-9 px-3 rounded-lg bg-[#8C7A6B] hover:bg-[#766557] text-white border border-[#7A695B] font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <span>Sunum PDF&apos;i Al</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Alt İleri / Geri Navigasyon Çubuğu */}
              <div className="px-6 py-3 bg-[#FAF9F6] border-t border-[#DED8CC] flex items-center justify-between">
                <button
                  type="button"
                  data-testid="wizard-prev-btn"
                  disabled={safeStep === 1}
                  onClick={() => setWizardStep((s) => Math.max(1, s - 1) as 1 | 2 | 3 | 4 | 5)}
                  className={`h-9 px-4 rounded-lg text-xs font-semibold border transition ${
                    safeStep === 1
                      ? "opacity-40 cursor-not-allowed bg-[#EFECE5] text-[#78716C] border-[#DED8CC]"
                      : "bg-white hover:bg-[#EFECE5] text-[#141413] border-[#DED8CC] cursor-pointer"
                  }`}
                >
                  ‹ Önceki Adım
                </button>

                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4].map((dot) => (
                    <span
                      key={dot}
                      className={`h-1.5 rounded-full transition-all ${
                        safeStep === dot ? "w-6 bg-[#141413]" : "w-2 bg-[#D6D0C4]"
                      }`}
                    />
                  ))}
                </div>

                {safeStep < 4 ? (
                  <button
                    type="button"
                    data-testid="wizard-next-btn"
                    onClick={() => setWizardStep((s) => Math.min(4, s + 1) as 1 | 2 | 3 | 4 | 5)}
                    className="h-9 px-5 rounded-lg bg-[#141413] hover:bg-[#292524] text-[#FAF9F6] text-xs font-semibold transition cursor-pointer"
                  >
                    Sonraki Adım ›
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleFinishStepWizard("studio_3d")}
                    className="h-9 px-5 rounded-lg bg-[#141413] hover:bg-[#292524] text-[#FAF9F6] text-xs font-semibold transition cursor-pointer"
                  >
                    ✓ Tamamla ve 3D Aç
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      <MepCoordinationModal
        isOpen={showMepModal}
        project={project}
        onClose={() => setShowMepModal(false)}
      />

      <PresentationQuoteModal
        isOpen={showQuickSellModal}
        onClose={() => setShowQuickSellModal(false)}
        project={project}
        materials={DEFAULT_MATERIALS}
        pricing={pricing}
        stats={liveCustomerAndFactoryStats}
        activeConceptTier={activeConceptTier}
        onApplyConceptTier={handleApplyConceptTier}
        onSmartWallAutoFill={handleSmartWallAutoFill}
        quoteDiscountPct={quoteDiscountPct}
        onChangeDiscountPct={setQuoteDiscountPct}
        quoteInstallments={quoteInstallments}
        onChangeInstallments={setQuoteInstallments}
        ledEnabled={Boolean(activeModule.carcass.ledLightingEnabled)}
        onToggleLedUpsell={() =>
          toggleModuleLedLighting(!activeModule.carcass.ledLightingEnabled, {
            ledType: "led_vertical_strip",
            colorTempK: 3000,
            sensorType: "ir_door",
          })
        }
        onAddTrouserUpsell={() => addSpecialFitting(activeBayIndex, "trouser_pullout")}
        onAddJewelryUpsell={() => addSpecialFitting(activeBayIndex, "jewelry_tray")}
        onApplyGlassDoorUpsell={() => {
          setBayV4DoorConfig(activeBayIndex, {
            doorSubType: "alu_frame_smoked_glass",
          });
          copyDoorConfigToAllBays(activeBayIndex);
        }}
        onFix32mmCollisions={handleFix32mmHingeShelfCollisions}
        compatibilityStatus={v4CompatibilityReport.overallStatus}
        onPrintVisualPdf={(meta) => handlePrintVisualCustomerPresentation(meta)}
        onOpenNestingModal={() => {
          setShowQuickSellModal(false);
          setBomModalInitialTab("nesting");
          setIsBomModalOpen(true);
        }}
        onOpenBomModal={() => {
          setShowQuickSellModal(false);
          setBomModalInitialTab("cutlist");
          setIsBomModalOpen(true);
        }}
      />

      <V3ProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
      />

      <StudioRenderModal
        isOpen={showStudioRenderModal}
        projectId={project.id}
        projectTitle={project.title}
        onClose={() => setShowStudioRenderModal(false)}
      />

      <CustomHardwareModal
        isOpen={showCustomHardwareModal}
        onClose={() => setShowCustomHardwareModal(false)}
        onApplyHandleToActiveBay={(spec) => {
          setBayV4DoorConfig(activeBayIndex, {
            handleCategory: spec.handleCategory,
            handleProfileId: spec.handleProfileId,
            handleLengthMm: spec.handleLengthMm,
            handleMaterialId: spec.handleMaterialId,
          });
          setApprovalBanner({
            ok: true,
            text: `🔩 Özel kulp (${spec.handleProfileId} • ${spec.handleLengthMm}mm) seçili bölmeye uygulandı.`,
          });
        }}
        onApplyHandleToAllBays={(spec) => {
          setBayV4DoorConfig(activeBayIndex, {
            handleCategory: spec.handleCategory,
            handleProfileId: spec.handleProfileId,
            handleLengthMm: spec.handleLengthMm,
            handleMaterialId: spec.handleMaterialId,
          });
          copyDoorConfigToAllBays(activeBayIndex);
          setApprovalBanner({
            ok: true,
            text: `🔩 Özel kulp (${spec.handleProfileId} • ${spec.handleLengthMm}mm) modüldeki tüm bölmelere uygulandı.`,
          });
        }}
        onCatalogChanged={() => setCustomCatalogTick((t) => t + 1)}
      />

      <AssemblyDiagramModal
        isOpen={showAssemblyModal}
        project={project}
        bom={bom}
        activeModuleIndex={activeModuleIndex}
        onClose={() => setShowAssemblyModal(false)}
      />

      <KitchenIslandTableModal
        isOpen={showIslandTableModal}
        project={project}
        materials={DEFAULT_MATERIALS}
        activeModuleIndex={activeModuleIndex}
        onAddIsland={(spec) => {
          addKitchenIslandUnit(spec);
          setApprovalBanner({
            ok: true,
            text: `🏝️ Şelale tezgâhlı ada mutfak (${spec.widthMm}×${spec.depthMm}mm) sahneye eklendi.`,
          });
        }}
        onAddOrUpdateAttachedTable={(spec) => {
          addOrUpdateAttachedTable(spec);
          setApprovalBanner({
            ok: true,
            text: `🍽️ ${spec.angleDeg}° açılı masa (${spec.lengthMm}×${spec.widthMm}mm) seçili modüle bağlandı.`,
          });
        }}
        onClose={() => setShowIslandTableModal(false)}
      />

      <SceneObjectAndModuleHubModal
        isOpen={showSceneHubModal}
        initialTab={sceneHubInitialTab}
        project={project}
        totalWithVatEur={pricing.totalWithVatEur}
        selectedSceneObjectId={selectedSceneObjectId}
        onSelectSceneObject={setSelectedSceneObjectId}
        onAppendModule={(tplId, opts) => {
          appendModuleWithMultiWallSnap(tplId, opts);
        }}
        onFillWallGap={(gap, tplId) => {
          fillWallGapWithParametricModule(gap, tplId);
        }}
        onAddCompositeAssembly={(presetId) => {
          addCompositeAssemblyPreset(presetId);
        }}
        onSaveActiveModuleAsTemplate={(name, fam) => {
          saveActiveModuleAsCustomTemplate(name, fam);
          setCustomCatalogTick((t) => t + 1);
        }}
        onDeleteCustomTemplate={(tplId) => {
          deleteCustomModuleTemplate(tplId);
          setCustomCatalogTick((t) => t + 1);
        }}
        onAddSceneObjectCatalog={(catId) => {
          addSceneObjectFromCatalog(catId);
        }}
        onAddCustomSceneObject={(obj) => {
          addCustomSceneObject(obj);
        }}
        onUpdateSceneObject={(id, patch) => {
          updateSceneObject(id, patch);
        }}
        onDuplicateSceneObject={(id) => {
          duplicateSceneObject(id);
        }}
        onRemoveSceneObject={(id) => {
          removeSceneObject(id);
        }}
        onAutoFillersAndCrown={runAutoFillersAndCrown}
        onAutoNotchObstacles={runAutoNotchObstacles}
        onImportRoomPlanJson={importRoomPlanLiDARJson}
        onClose={() => setShowSceneHubModal(false)}
      />

      <BirimLogo className="hidden" />
      <BomModal isOpen={isBomModalOpen} onClose={() => setIsBomModalOpen(false)} initialTab={bomModalInitialTab} />
      <StoreErpModal isOpen={isStoreErpModalOpen} onClose={() => setIsStoreErpModalOpen(false)} />
      <TapToPlaceController
        armedItem={armedTapItem}
        bayCount={activeModule.bays.length}
        bayWidthsMm={activeBreakdown.bayWidths}
        netInnerHeightMm={netInnerHeightMm}
        onCancel={() => setArmedTapItem(null)}
        onAppendModuleTemplate={(tplId) => applyV4Template(tplId, true)}
        onPlaceInBay={(item, bayIdx, zone) => {
          setActiveBayIndex(bayIdx);
          if (item.kind === "carcass_divider") {
            splitBayIntoTwo(bayIdx);
            return;
          }
          if (item.kind === "sub_divider") {
            addSubDivider(bayIdx);
            return;
          }
          const targetElev =
            zone === "low"
              ? Math.round(netInnerHeightMm * 0.16)
              : zone === "high"
              ? Math.round(netInnerHeightMm * 0.8)
              : Math.round(netInnerHeightMm * 0.48);
          addInteriorItemAtElevation(bayIdx, item.id, targetElev);
        }}
      />

      {showArAnd3DModal && (() => {
        const exportParts: ExportBoxPart[] = [];
        project.modules.forEach((m) => {
          const geo = generateModuleGeometry(m, { doorOpenAngleDeg: 0 });
          const rotDeg = ((m.rotation?.y ?? 0) % 360 + 360) % 360;
          const rad = (rotDeg * Math.PI) / 180;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          geo.components.forEach((c) => {
            const lx = c.position.x + c.dimensions.width / 2;
            const ly = c.position.y + c.dimensions.height / 2;
            const lz = c.position.z + c.dimensions.depth / 2;
            exportParts.push({
              id: c.id,
              name: c.label || c.role,
              role: c.role,
              moduleId: m.id,
              moduleName: m.name,
              materialId: c.materialId,
              positionMm: {
                x: m.position.x + lx * cos + lz * sin,
                y: m.position.y + ly,
                z: m.position.z - lx * sin + lz * cos,
              },
              dimensionsMm: { ...c.dimensions },
              rotationYDeg: rotDeg,
            });
          });
        });
        return (
          <ArRoomPreviewModal
            isOpen={showArAnd3DModal}
            onClose={() => setShowArAnd3DModal(false)}
            project={project}
            materials={[...DEFAULT_MATERIALS, ...(project.customMaterials || [])]}
            parts={exportParts}
            discountPercent={quoteDiscountPct}
            installments={quoteInstallments}
            clientTotalEur={pricing.totalWithVatEur}
          />
        );
      })()}
    </div>
  );
};

export default V3UnifiedWorkspace;
