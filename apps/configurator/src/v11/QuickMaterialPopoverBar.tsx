"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  ChevronDown,
  PaintBucket,
  Pipette,
  Sparkles,
  Sun,
  Moon,
  Search,
  Check,
  Palette,
  SlidersHorizontal,
  Download,
  Plus,
  Focus,
} from "lucide-react";
import type { DesignProject, MaterialDefinition, ModuleInstance } from "@birim/core";
import { useConfiguratorStore } from "../store/useConfiguratorStore";
import { getEffectiveSpaceWalls } from "../v3/engine/kitchenSpatialEngine";
import {
  getMaterialSwatchStyle,
  classifyPhysicalMaterial,
  setProceduralTextureQualityTier,
  type ProceduralTextureQualityTier,
} from "../v3/materials/pbrMaterialSystem";
import {
  BIRIM_CURATED_MOODBOARDS,
  dispatchLive3DMaterialPreview,
  dispatchLive3DMoodboardPreview,
  pushRecentMaterialId,
  type QuickZoneScope,
  type CuratedBirimMoodboard,
  type PaintTool3DState,
} from "./quickMaterialAndMoodboardEngine";
import { AnimatedPopoverPresence } from "./AnimatedWindowPresence";

export type ViewportQualityTier = "performance" | "hd" | "ultra";

export interface QuickMaterialPopoverBarProps {
  project: DesignProject;
  activeModule?: ModuleInstance;
  activeModuleIndex: number;
  materials: MaterialDefinition[];
  leftSafePx?: number;
  rightSafePx?: number;
  topOffsetPx?: number;
  paintToolState: PaintTool3DState;
  onChangePaintToolState: (next: PaintTool3DState) => void;
  onApplyZoneMaterial: (scope: QuickZoneScope, materialId: string) => void;
  onApplyCuratedMoodboard: (moodboard: CuratedBirimMoodboard) => void;
  onSetSurfaceFinish?: (finish: "matte" | "satin" | "gloss", allModules: boolean) => void;
  onOpenFullPaletteDock?: () => void;
  onShowToast?: (msg: string) => void;
}

type OpenMenuId =
  | null
  | "wall"
  | "doors"
  | "carcass"
  | "countertop"
  | "handles"
  | "moodboards"
  | "render";

function shortenMaterialName(name?: string): string {
  if (!name) return "Seçiniz";
  return name
    .replace(/^Kastamonu Entegre\s+/i, "")
    .replace(/^Yıldız Entegre\s+/i, "")
    .replace(/^Çamsan Entegre\s+/i, "")
    .replace(/^Variodor\s+/i, "")
    .replace(/^AGT\s+/i, "")
    .replace(/^Neolith\s+/i, "")
    .replace(/^Dekton\s+/i, "")
    .replace(/^İpek Mat Lake\s+/i, "Lake ")
    .split(" (")[0]
    .trim();
}

export const QuickMaterialPopoverBar: React.FC<QuickMaterialPopoverBarProps> = React.memo(
  ({
    project,
    activeModule,
    activeModuleIndex,
    materials,
    leftSafePx = 76,
    rightSafePx = 64,
    topOffsetPx = 74,
    paintToolState,
    onChangePaintToolState,
    onApplyZoneMaterial,
    onApplyCuratedMoodboard,
    onSetSurfaceFinish,
    onOpenFullPaletteDock,
    onShowToast,
  }) => {
    const [openMenu, setOpenMenu] = useState<OpenMenuId>(null);
    const [lastRenderedMatMenu, setLastRenderedMatMenu] = useState<
      "doors" | "carcass" | "countertop" | "handles"
    >("doors");
    const activeWallId = useConfiguratorStore((s) => s.activeWallId);
    const setActiveWallId = useConfiguratorStore((s) => s.setActiveWallId);
    const addWallSegment = useConfiguratorStore((s) => s.addWallSegment);

    const roomWalls = useMemo(() => getEffectiveSpaceWalls(project), [project]);
    const currentTargetWall =
      roomWalls.find((w) => w.id === activeWallId) || roomWalls[0] || null;

    const mainWallLen = roomWalls[0]?.length || 3600;
    const ceilH = project.space?.ceilingHeight || 2600;
    const hasLeftWall = roomWalls.some(
      (w) => Math.abs((((w.rotationY || 0) % 180) + 180) % 180 - 90) <= 15 && w.position.x <= 80
    );
    const hasRightWall = roomWalls.some(
      (w) =>
        Math.abs((((w.rotationY || 0) % 180) + 180) % 180 - 90) <= 15 &&
        Math.abs(w.position.x - mainWallLen) <= 150
    );
    const hasFrontWall = roomWalls.some(
      (w) => Math.abs((((w.rotationY || 0) % 180) + 180) % 180) <= 15 && w.position.z >= 1200
    );

    const [doorScope, setDoorScope] = useState<QuickZoneScope>("active_doors");
    const [carcassScope, setCarcassScope] = useState<QuickZoneScope>("active_carcass");
    const [doorSubFilter, setDoorSubFilter] = useState<"all" | "wood" | "lacquer" | "glass">("all");
    const [searchText, setSearchText] = useState("");
    const [qualityTier, setQualityTier] = useState<ViewportQualityTier>("ultra");
    const [lightPreset, setLightPreset] = useState<"daylight" | "showroom_warm" | "night_led">(
      "daylight"
    );
    const [exporting2K, setExporting2K] = useState(false);
    const barRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (
        openMenu === "doors" ||
        openMenu === "carcass" ||
        openMenu === "countertop" ||
        openMenu === "handles"
      ) {
        setLastRenderedMatMenu(openMenu);
      }
    }, [openMenu]);

    useEffect(() => {
      if (!openMenu) {
        dispatchLive3DMaterialPreview(null);
        dispatchLive3DMoodboardPreview(null);
        setSearchText("");
        return;
      }
      const onDown = (e: MouseEvent) => {
        if (barRef.current && !barRef.current.contains(e.target as Node)) {
          setOpenMenu(null);
        }
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setOpenMenu(null);
        }
      };
      document.addEventListener("mousedown", onDown);
      window.addEventListener("keydown", onKey);
      return () => {
        document.removeEventListener("mousedown", onDown);
        window.removeEventListener("keydown", onKey);
      };
    }, [openMenu]);

    const matById = useMemo(
      () => new Map<string, MaterialDefinition>(materials.map((m) => [m.id, m])),
      [materials]
    );

    const refMod =
      activeModule ||
      project.modules.find((m) => m.category !== "complementary") ||
      project.modules[0];

    const curDoorMat =
      matById.get(
        refMod?.bays?.[0]?.door?.doorMaterialId ||
          refMod?.carcass?.doorMaterialId ||
          "mat_lacquer_cashmere"
      ) || materials[0];

    const curBodyMat =
      matById.get(refMod?.carcass?.bodyMaterialId || "mat_melamine_white") || materials[0];

    const baseModWithCt =
      (refMod?.carcass?.countertopMaterialId ? refMod : undefined) ||
      project.modules.find((m) => Boolean(m.carcass?.countertopMaterialId)) ||
      refMod;
    const curCountertopMat =
      matById.get(baseModWithCt?.carcass?.countertopMaterialId || "mat_neolith_calacatta_luxe") ||
      materials.find((m) => classifyPhysicalMaterial(m) === "stone") ||
      materials[0];

    const curHandleMat =
      matById.get(refMod?.bays?.[0]?.door?.handleMaterialId || "mat_handle_matte_black") ||
      materials.find((m) => classifyPhysicalMaterial(m) === "metal") ||
      materials[0];

    const curFinish: "matte" | "satin" | "gloss" = refMod?.surfaceFinishOverride || "matte";
    const effectiveMatMenu =
      openMenu === "doors" ||
      openMenu === "carcass" ||
      openMenu === "countertop" ||
      openMenu === "handles"
        ? openMenu
        : lastRenderedMatMenu;

    const filteredPopupMaterials = useMemo(() => {
      const q = searchText.trim().toLowerCase();
      let list = materials.filter((m) => !m.id.startsWith("mat_led_"));

      if (effectiveMatMenu === "doors") {
        list = list.filter((m) => {
          const cls = classifyPhysicalMaterial(m);
          if (cls === "stone" || cls === "metal") return false;
          if (doorSubFilter === "wood") return cls === "wood";
          if (doorSubFilter === "lacquer")
            return cls === "lacquer" || cls === "melamine" || cls === "fabric";
          if (doorSubFilter === "glass") return cls === "glass" || cls === "mirror";
          return true;
        });
      } else if (effectiveMatMenu === "carcass") {
        list = list.filter((m) => {
          const cls = classifyPhysicalMaterial(m);
          return cls === "melamine" || cls === "wood" || cls === "lacquer" || cls === "fabric";
        });
      } else if (effectiveMatMenu === "countertop") {
        list = list.filter((m) => {
          const cls = classifyPhysicalMaterial(m);
          return cls === "stone" || cls === "wood";
        });
      } else if (effectiveMatMenu === "handles") {
        list = list.filter(
          (m) => classifyPhysicalMaterial(m) === "metal" || m.id.startsWith("mat_handle_")
        );
      }

      if (q) {
        list = list.filter((m) => `${m.name} ${m.id}`.toLowerCase().includes(q));
      }
      return list;
    }, [materials, effectiveMatMenu, doorSubFilter, searchText]);

    const selectWallAndFocusCamera = (wallId: string, wallName: string) => {
      // Materialize synthesized U-kitchen wall into project.space.walls if needed
      const st = useConfiguratorStore.getState();
      if (!st.project.space.walls.some((w) => w.id === wallId)) {
        const eff = getEffectiveSpaceWalls(st.project);
        const found = eff.find((w) => w.id === wallId);
        if (found) {
          st.applyBatchProjectUpdate((draft) => {
            draft.space.walls = eff.map((ew) => ({ ...ew, position: { ...ew.position } }));
          }, "Oda duvarları etkinleştirildi");
        }
      }
      setActiveWallId(wallId);
      if (typeof window !== "undefined") {
        setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("birim:fit-camera-3d", { detail: "room_front_persp" })
          );
        }, 20);
      }
      onShowToast?.(
        `Hedef duvar seçildi: ${wallName} — Katalogdan seçeceğiniz dolap ve eşyalar bu duvara yerleşir.`
      );
      setOpenMenu(null);
    };

    const handleQuickCreateAndSelectWall = (kind: "left" | "right" | "front") => {
      const name =
        kind === "left"
          ? "Sol Yan Duvar"
          : kind === "right"
          ? "Sağ Yan Duvar"
          : "Karşı Ön Duvar";
      const newId = addWallSegment({
        name,
        length: kind === "front" ? mainWallLen : 2400,
        height: ceilH,
        thickness: 150,
        position:
          kind === "left"
            ? { x: 0, y: 0, z: 0 }
            : kind === "right"
            ? { x: mainWallLen, y: 0, z: 0 }
            : { x: 0, y: 0, z: 2400 },
        rotationY: kind === "front" ? 0 : 90,
      });
      setActiveWallId(newId);
      if (typeof window !== "undefined") {
        setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("birim:fit-camera-3d", { detail: "room_front_persp" })
          );
        }, 30);
      }
      onShowToast?.(`${name} odaya eklendi ve aktif hedef duvar olarak seçildi.`);
      setOpenMenu(null);
    };

    const applyOrLoadMaterial = (scope: QuickZoneScope, mat: MaterialDefinition) => {
      dispatchLive3DMaterialPreview(null);
      pushRecentMaterialId(mat.id);
      if (paintToolState.mode === "paint") {
        onChangePaintToolState({
          ...paintToolState,
          materialId: mat.id,
          zoneScope: scope,
        });
        onShowToast?.(`Fırçaya yüklendi: ${mat.name} — Boyamak istediğiniz 3B yüzeye tıklayın.`);
        setOpenMenu(null);
        return;
      }
      onApplyZoneMaterial(scope, mat.id);
    };

    const handleSelectRenderQuality = (tier: ViewportQualityTier) => {
      setQualityTier(tier);
      const texTier: ProceduralTextureQualityTier =
        tier === "ultra" ? "ultra" : tier === "hd" ? "hd" : "standard";
      setProceduralTextureQualityTier(texTier);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("birim:set-render-quality", { detail: tier }));
      }
      onShowToast?.(
        tier === "ultra"
          ? "Ultra Stüdyo PBR Render (2.5x Keskinlik + 1024px Doku + 4K Gölge) aktif."
          : tier === "hd"
          ? "HD Stüdyo Render modu aktif."
          : "Akıcı Performans modu aktif."
      );
    };

    const handleSelectLighting = (mode: "daylight" | "showroom_warm" | "night_led") => {
      setLightPreset(mode);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("birim:set-lighting-preset", { detail: mode }));
      }
    };

    const activeScopeForOpenMenu: QuickZoneScope =
      effectiveMatMenu === "doors"
        ? doorScope
        : effectiveMatMenu === "carcass"
        ? carcassScope
        : effectiveMatMenu === "countertop"
        ? "countertops"
        : "handles_gola";

    const isMatMenuOpen =
      openMenu === "doors" ||
      openMenu === "carcass" ||
      openMenu === "countertop" ||
      openMenu === "handles";

    const [popoverAnchorX, setPopoverAnchorX] = useState<number>(0);

    const toggleMenuAt = (
      menu: Exclude<QuickPopoverKind, null>,
      ev: React.MouseEvent<HTMLButtonElement>,
      approxPopWidth: number
    ) => {
      if (openMenu === menu) {
        setOpenMenu(null);
        return;
      }
      const barEl = barRef.current;
      const btnEl = ev.currentTarget;
      if (barEl && btnEl && typeof window !== "undefined") {
        const barRect = barEl.getBoundingClientRect();
        const btnRect = btnEl.getBoundingClientRect();
        const rawLeft = btnRect.left - barRect.left;
        const maxLeft = Math.max(0, window.innerWidth - barRect.left - approxPopWidth - 16);
        setPopoverAnchorX(Math.max(0, Math.round(Math.min(rawLeft, maxLeft))));
      } else {
        setPopoverAnchorX(0);
      }
      setOpenMenu(menu);
    };

    const pillBtnClass = (active: boolean) =>
      `h-8 pl-2.5 pr-2.5 rounded-xl inline-flex items-center gap-1.5 font-semibold transition-all duration-200 cursor-pointer ${
        active
          ? "bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] text-white border border-sky-300/45 shadow-[0_0_20px_rgba(29,78,216,0.58),0_4px_14px_rgba(37,99,235,0.45)]"
          : "bg-white/[0.13] hover:bg-white/[0.22] border border-white/[0.22] text-white shadow-[0_4px_12px_rgba(0,0,0,0.34)]"
      }`;

    return (
      <div
        ref={barRef}
        data-testid="v23-quick-material-popover-bar"
        style={{
          top: `${topOffsetPx}px`,
          left: `${leftSafePx}px`,
          maxWidth: `calc(100vw - ${leftSafePx + rightSafePx + 12}px)`,
        }}
        onMouseLeave={() => {
          dispatchLive3DMaterialPreview(null);
          dispatchLive3DMoodboardPreview(null);
        }}
        className="fixed z-30 pointer-events-auto transition-[left,top] duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] max-md:!left-3 max-md:!max-w-[calc(100vw-24px)]"
      >
        {/* DRAMATİK FÜME OBSİDYEN YARI ŞEFFAF BUZLU CAM ÇUBUK */}
        <div className="inline-flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl bg-[#151A24]/92 backdrop-blur-2xl border border-white/[0.22] ring-1 ring-black/65 shadow-[0_18px_48px_rgba(0,0,0,0.58)] text-xs text-white">
          {/* 0. HEDEF YERLEŞTİRME DUVARI SEÇİCİ */}
          <button
            type="button"
            data-testid="v23-quick-btn-target-wall"
            onClick={(e) => toggleMenuAt("wall", e, 368)}
            title="Objelerin ve yeni dolapların yerleşeceği hedef duvar (3B veya 2B ekranda doğrudan duvara tıklayarak da seçebilirsiniz)"
            className={pillBtnClass(openMenu === "wall")}
          >
            <span className="w-2 h-2 rounded-full bg-[#F59E0B] shadow-[0_0_8px_#F59E0B] shrink-0" />
            <span className="text-[10.5px] text-slate-300 font-medium hidden sm:inline">Duvar:</span>
            <span className="text-[11px] max-w-[104px] truncate font-bold">
              {currentTargetWall?.name || "Ana Duvar"}
            </span>
            <ChevronDown
              className={`w-3 h-3 opacity-70 shrink-0 transition-transform duration-200 ${
                openMenu === "wall" ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* 1. KAPAK MALZEMESİ AÇILIR DÜĞME */}
          <button
            type="button"
            data-testid="v23-quick-btn-doors"
            onClick={(e) => toggleMenuAt("doors", e, 480)}
            title="Kapak & Çekmece Cephe Malzemesini Hızlı Seç"
            className={pillBtnClass(openMenu === "doors")}
          >
            <span
              className="w-4 h-4 rounded-full border border-white/35 shrink-0 shadow-xs"
              style={getMaterialSwatchStyle(curDoorMat)}
            />
            <span className="text-[10.5px] text-slate-300 font-medium">Kapak:</span>
            <span className="text-[11px] max-w-[88px] truncate">
              {shortenMaterialName(curDoorMat?.name)}
            </span>
            <ChevronDown
              className={`w-3 h-3 opacity-70 shrink-0 transition-transform duration-200 ${
                openMenu === "doors" ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* 2. GÖVDE MALZEMESİ AÇILIR DÜĞME */}
          <button
            type="button"
            data-testid="v23-quick-btn-carcass"
            onClick={(e) => toggleMenuAt("carcass", e, 480)}
            title="İç Gövde & Raf Malzemesini Hızlı Seç"
            className={pillBtnClass(openMenu === "carcass")}
          >
            <span
              className="w-4 h-4 rounded-full border border-white/35 shrink-0 shadow-xs"
              style={getMaterialSwatchStyle(curBodyMat)}
            />
            <span className="text-[10.5px] text-slate-300 font-medium hidden sm:inline">Gövde:</span>
            <span className="text-[11px] max-w-[80px] truncate">
              {shortenMaterialName(curBodyMat?.name)}
            </span>
            <ChevronDown
              className={`w-3 h-3 opacity-70 shrink-0 transition-transform duration-200 ${
                openMenu === "carcass" ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* 3. TEZGAH TAŞ / PORSELEN AÇILIR DÜĞME */}
          <button
            type="button"
            data-testid="v23-quick-btn-countertop"
            onClick={(e) => toggleMenuAt("countertop", e, 480)}
            title="Mutfak & Ada Tezgâh Taşını Hızlı Seç"
            className={pillBtnClass(openMenu === "countertop")}
          >
            <span
              className="w-4 h-4 rounded-full border border-white/35 shrink-0 shadow-xs"
              style={getMaterialSwatchStyle(curCountertopMat)}
            />
            <span className="text-[10.5px] text-slate-300 font-medium hidden md:inline">Tezgâh:</span>
            <span className="text-[11px] max-w-[80px] truncate">
              {shortenMaterialName(curCountertopMat?.name)}
            </span>
            <ChevronDown
              className={`w-3 h-3 opacity-70 shrink-0 transition-transform duration-200 ${
                openMenu === "countertop" ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* 4. KULP & GOLA METAL AÇILIR DÜĞME */}
          <button
            type="button"
            data-testid="v23-quick-btn-handles"
            onClick={(e) => toggleMenuAt("handles", e, 480)}
            title="Kulp & Gola Eloksal Metal Rengini Hızlı Seç"
            className={pillBtnClass(openMenu === "handles")}
          >
            <span
              className="w-3.5 h-3.5 rounded-full border border-white/35 shrink-0"
              style={getMaterialSwatchStyle(curHandleMat)}
            />
            <span className="text-[11px] hidden lg:inline">Kulp</span>
            <ChevronDown
              className={`w-3 h-3 opacity-70 shrink-0 transition-transform duration-200 ${
                openMenu === "handles" ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* 5. HAZIR ÇİFT TON KOMBİNASYONLAR AÇILIR DÜĞME */}
          <button
            type="button"
            data-testid="v23-quick-btn-moodboards"
            onClick={(e) => toggleMenuAt("moodboards", e, 420)}
            title="Tek Tıkla Hazır Çift Ton Mimari Kombinasyon Uygula"
            className={pillBtnClass(openMenu === "moodboards")}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#7DD3FC]" />
            <span className="hidden sm:inline">Kombinler</span>
            <ChevronDown
              className={`w-3 h-3 opacity-70 transition-transform duration-200 ${
                openMenu === "moodboards" ? "rotate-180" : ""
              }`}
            />
          </button>

          <span className="h-4 w-px bg-white/15 mx-0.5 hidden sm:inline-block" />

          {/* 6. 3B FIRÇA & DAMLALIK */}
          <button
            type="button"
            data-testid="v23-quick-btn-brush"
            onClick={() => {
              const nextMode = paintToolState.mode === "paint" ? "none" : "paint";
              onChangePaintToolState({
                ...paintToolState,
                mode: nextMode,
                materialId: paintToolState.materialId || curDoorMat?.id || "mat_lacquer_cashmere",
              });
              if (nextMode === "paint") {
                setOpenMenu(null);
              }
            }}
            title="3B Fırça Modu (Kısayol: B)"
            className={`h-8 px-2.5 rounded-xl inline-flex items-center gap-1.5 text-[11px] font-semibold transition-all duration-200 cursor-pointer ${
              paintToolState.mode === "paint"
                ? "bg-gradient-to-br from-[#EA580C] to-[#C2410C] text-white shadow-[0_6px_18px_rgba(234,88,12,0.45)] ring-1 ring-orange-300/40"
                : "bg-white/[0.13] hover:bg-white/[0.22] border border-white/[0.22] text-white shadow-[0_4px_12px_rgba(0,0,0,0.32)]"
            }`}
          >
            <PaintBucket className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Fırça</span>
          </button>

          <button
            type="button"
            data-testid="v23-quick-btn-eyedropper"
            onClick={() => {
              const nextMode = paintToolState.mode === "eyedropper" ? "none" : "eyedropper";
              onChangePaintToolState({
                ...paintToolState,
                mode: nextMode,
              });
              if (nextMode === "eyedropper") {
                setOpenMenu(null);
              }
            }}
            title="3B Damlalık (Kısayol: I veya Alt+Tık)"
            className={`h-8 w-8 rounded-xl inline-flex items-center justify-center transition-all duration-200 cursor-pointer ${
              paintToolState.mode === "eyedropper"
                ? "bg-[#2563EB] text-white shadow-[0_6px_18px_rgba(37,99,235,0.45)]"
                : "bg-white/[0.13] hover:bg-white/[0.22] border border-white/[0.22] text-white shadow-[0_4px_12px_rgba(0,0,0,0.32)]"
            }`}
          >
            <Pipette className="w-3.5 h-3.5" />
          </button>

          {/* 7. MODÜLE ODAKLAN HIZLI DÜĞME */}
          <button
            type="button"
            data-testid="v25-quick-btn-focus-module"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.dispatchEvent(
                  new CustomEvent("birim:fit-camera-3d", { detail: "focus_module" })
                );
              }
            }}
            title="Seçili Modülü Karşıdan Perspektif Odakla (Kısayol: F)"
            className="h-8 px-2.5 rounded-xl bg-white/[0.13] hover:bg-white/[0.22] border border-white/[0.22] text-[#BAE6FD] hover:text-white text-[11px] font-semibold inline-flex items-center gap-1 shadow-[0_4px_12px_rgba(0,0,0,0.32)] transition cursor-pointer"
          >
            <Focus className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Modüle Odaklan</span>
          </button>

          {/* 8. STÜDYO RENDER KALİTESİ & IŞIK */}
          <button
            type="button"
            data-testid="v23-quick-btn-render-quality"
            onClick={(e) => toggleMenuAt("render", e, 340)}
            title="Çalışma Alanı 3B Görüntü & PBR Doku Kalitesi Ayarları"
            className={pillBtnClass(openMenu === "render")}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#7DD3FC]" />
            <span>
              {qualityTier === "ultra" ? "Ultra PBR" : qualityTier === "hd" ? "HD" : "Akıcı"}
            </span>
            <ChevronDown
              className={`w-3 h-3 opacity-70 transition-transform duration-200 ${
                openMenu === "render" ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>

        {/* ANİMASYONLU POPOVER 0: HEDEF DUVAR SEÇİCİ + TEK TIKLA YENİ DUVAR EKLE */}
        <AnimatedPopoverPresence isOpen={openMenu === "wall"} origin="top-left" className="absolute top-full z-40" style={{ left: `${popoverAnchorX}px` }}>
          <div
            data-testid="v23-popover-target-wall"
            className="mt-2 w-[min(368px,calc(100vw-28px))] rounded-2xl bg-[#2A313F]/68 backdrop-blur-2xl border border-white/[0.22] ring-1 ring-black/60 shadow-[0_28px_68px_rgba(0,0,0,0.62)] p-3.5 space-y-2.5 text-xs text-[#F3F4F6]"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-[12px] text-white">
                Hedef Yerleştirme Duvarı Seçin
              </span>
              <span className="text-[10px] text-[#7DD3FC]">3B/2B Tıklanabilir</span>
            </div>
            <p className="text-[10.5px] text-slate-300 leading-snug">
              3B sahnede doğrudan bir duvara tıklayarak veya aşağıdan seçerek yeni dolap ve objelerin yerleşeceği duvarı değiştirebilirsiniz.
            </p>
            <div className="space-y-1.5">
              {roomWalls.map((w, idx) => {
                const isSel = (activeWallId || roomWalls[0]?.id) === w.id;
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => selectWallAndFocusCamera(w.id, w.name || `Duvar ${idx + 1}`)}
                    className={`w-full px-3 py-2 rounded-xl border flex items-center justify-between transition cursor-pointer ${
                      isSel
                        ? "bg-gradient-to-r from-[#D6A676] to-[#B58253] border-[#E3B587] text-[#111318] font-bold shadow-sm"
                        : "bg-white/[0.08] hover:bg-white/[0.15] border-white/[0.12] text-[#F3F4F6]"
                    }`}
                  >
                    <span className="font-semibold text-[11px] flex items-center gap-1.5">
                      {isSel && <Check className="w-3.5 h-3.5 shrink-0" />}
                      <span>
                        {idx + 1}. {w.name || `Duvar ${idx + 1}`}
                      </span>
                    </span>
                    <span className="font-mono text-[10px] opacity-80">
                      {Math.round((w.length || 3600) / 10)} cm
                    </span>
                  </button>
                );
              })}
            </div>

            {(!hasLeftWall || !hasRightWall || !hasFrontWall) && (
              <div className="pt-2 border-t border-white/12 space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#7DD3FC]">
                  Odaya Yeni Duvar Ekle &amp; Seç
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {!hasLeftWall && (
                    <button
                      type="button"
                      onClick={() => handleQuickCreateAndSelectWall("left")}
                      className="px-2.5 py-1.5 rounded-xl bg-white/[0.09] hover:bg-white/[0.18] border border-white/15 text-[10.5px] font-semibold text-white inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3 text-[#7DD3FC]" />
                      <span>Sol Yan Duvar (90°)</span>
                    </button>
                  )}
                  {!hasRightWall && (
                    <button
                      type="button"
                      onClick={() => handleQuickCreateAndSelectWall("right")}
                      className="px-2.5 py-1.5 rounded-xl bg-white/[0.09] hover:bg-white/[0.18] border border-white/15 text-[10.5px] font-semibold text-white inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3 text-[#7DD3FC]" />
                      <span>Sağ Yan Duvar (270°)</span>
                    </button>
                  )}
                  {!hasFrontWall && (
                    <button
                      type="button"
                      onClick={() => handleQuickCreateAndSelectWall("front")}
                      className="px-2.5 py-1.5 rounded-xl bg-white/[0.09] hover:bg-white/[0.18] border border-white/15 text-[10.5px] font-semibold text-white inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3 text-[#7DD3FC]" />
                      <span>Karşı Ön Duvar (180°)</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </AnimatedPopoverPresence>

        {/* ANİMASYONLU POPOVER 1–4: KAPAK / GÖVDE / TEZGAH / KULP MALZEME SEÇİCİ */}
        <AnimatedPopoverPresence isOpen={isMatMenuOpen} origin="top-left" className="absolute top-full z-40" style={{ left: `${popoverAnchorX}px` }}>
          <div
            data-testid={`v23-popover-${effectiveMatMenu}`}
            className="mt-2 w-[min(444px,calc(100vw-28px))] rounded-2xl bg-[#2A313F]/68 backdrop-blur-2xl border border-white/[0.22] ring-1 ring-black/60 shadow-[0_28px_68px_rgba(0,0,0,0.62)] p-3.5 space-y-2.5 text-xs text-[#F3F4F6]"
          >
            {effectiveMatMenu === "doors" && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10.5px] font-bold text-[#7DD3FC]">Uygulama Bölgesi:</span>
                  {onSetSurfaceFinish && (
                    <div className="inline-flex items-center p-0.5 rounded-lg bg-black/40 border border-white/12">
                      {(
                        [
                          { id: "matte", label: "İpek Mat" },
                          { id: "satin", label: "Saten" },
                          { id: "gloss", label: "Parlak" },
                        ] as const
                      ).map((fn) => (
                        <button
                          key={fn.id}
                          type="button"
                          onClick={() =>
                            onSetSurfaceFinish(fn.id, doorScope !== "active_doors")
                          }
                          className={`h-5.5 px-2 rounded-md text-[10px] font-semibold transition cursor-pointer ${
                            curFinish === fn.id
                              ? "bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] text-white shadow-xs"
                              : "text-slate-300 hover:text-white"
                          }`}
                        >
                          {fn.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {(
                    [
                      { id: "active_doors", label: "Bu Dolap" },
                      { id: "base_cabinets", label: "Alt Dolaplar" },
                      { id: "wall_cabinets", label: "Üst Dolaplar" },
                      { id: "all_fronts", label: "Tüm Cepheler" },
                    ] as const
                  ).map((sc) => (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => setDoorScope(sc.id)}
                      className={`h-6.5 px-2 rounded-lg text-[10.5px] font-semibold transition cursor-pointer ${
                        doorScope === sc.id
                          ? "bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] text-white font-bold shadow-xs"
                          : "bg-white/[0.08] hover:bg-white/[0.15] border border-white/12 text-slate-200"
                      }`}
                    >
                      {sc.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1 pt-0.5">
                  {(
                    [
                      { id: "all", label: "Tümü" },
                      { id: "lacquer", label: "Lake & Mat" },
                      { id: "wood", label: "Doğal Ahşap" },
                      { id: "glass", label: "Cam & Ayna" },
                    ] as const
                  ).map((sub) => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => setDoorSubFilter(sub.id)}
                      className={`h-6 px-2.5 rounded-full text-[10px] font-semibold transition cursor-pointer ${
                        doorSubFilter === sub.id
                          ? "bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] text-white font-bold border border-[#38BDF8]/65 shadow-[0_0_16px_rgba(29,78,216,0.58)]"
                          : "bg-white/[0.07] hover:bg-white/[0.14] border border-white/12 text-slate-300"
                      }`}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {effectiveMatMenu === "carcass" && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10.5px] font-bold text-[#7DD3FC]">Gövde Kapsamı:</span>
                <div className="inline-flex items-center p-0.5 rounded-xl bg-black/40 border border-white/12">
                  {(
                    [
                      { id: "active_carcass", label: "Yalnızca Seçili Dolap" },
                      { id: "carcass_all", label: "Projedeki Tüm Gövdeler" },
                    ] as const
                  ).map((sc) => (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => setCarcassScope(sc.id)}
                      className={`h-6 px-2.5 rounded-lg text-[10.5px] font-semibold transition cursor-pointer ${
                        carcassScope === sc.id
                          ? "bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] text-white font-bold shadow-xs"
                          : "text-slate-300 hover:text-white"
                      }`}
                    >
                      {sc.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {effectiveMatMenu !== "handles" && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Renk veya doku ara (kaşmir, meşe, ceviz, calacatta...)"
                  className="w-full h-7.5 pl-7 pr-6 rounded-xl bg-black/40 border border-white/15 text-[11px] text-white placeholder:text-slate-400 focus:outline-none focus:border-[#38BDF8]"
                />
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 max-h-[280px] overflow-y-auto pr-0.5">
              {filteredPopupMaterials.map((mat) => {
                const isSelected =
                  (effectiveMatMenu === "doors" && curDoorMat?.id === mat.id) ||
                  (effectiveMatMenu === "carcass" && curBodyMat?.id === mat.id) ||
                  (effectiveMatMenu === "countertop" && curCountertopMat?.id === mat.id) ||
                  (effectiveMatMenu === "handles" && curHandleMat?.id === mat.id);
                return (
                  <button
                    key={mat.id}
                    type="button"
                    onMouseEnter={() =>
                      dispatchLive3DMaterialPreview({
                        materialId: mat.id,
                        scope: activeScopeForOpenMenu,
                        activeModuleIndex,
                      })
                    }
                    onClick={() => applyOrLoadMaterial(activeScopeForOpenMenu, mat)}
                    className={`group p-1.5 rounded-xl border text-left flex flex-col gap-1 transition cursor-pointer ${
                      isSelected
                        ? "bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] border-[#E3B587] text-[#111318] shadow-md"
                        : "bg-white/[0.08] hover:bg-white/[0.16] border-white/12 text-slate-100"
                    }`}
                  >
                    <div
                      className="w-full h-16 rounded-xl border border-white/20 shadow-inner relative overflow-hidden"
                      style={getMaterialSwatchStyle(mat)}
                    >
                      {isSelected && (
                        <span className="absolute right-1 top-1 w-4 h-4 rounded-full bg-[#111318]/90 text-[#7DD3FC] flex items-center justify-center">
                          <Check className="w-2.5 h-2.5" />
                        </span>
                      )}
                    </div>
                    <span className="text-[10.5px] font-bold leading-tight truncate text-center px-0.5">
                      {shortenMaterialName(mat.name)}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="pt-1.5 border-t border-white/12 flex items-center justify-between gap-2 text-[10.5px] text-slate-300">
              <span>
                {paintToolState.mode === "paint"
                  ? "Fırça açık: Seçtiğiniz malzeme fırçaya yüklenir"
                  : "Üzerine gelince 3B canlı önizler, tıklayınca uygular"}
              </span>
              {onOpenFullPaletteDock && (
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenu(null);
                    onOpenFullPaletteDock();
                  }}
                  className="font-bold text-[#7DD3FC] hover:underline inline-flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Palette className="w-3 h-3" />
                  <span>Geniş Kartela</span>
                </button>
              )}
            </div>
          </div>
        </AnimatedPopoverPresence>

        {/* ANİMASYONLU POPOVER 5: HAZIR MİMARİ KOMBİNASYONLAR */}
        <AnimatedPopoverPresence isOpen={openMenu === "moodboards"} origin="top-left" className="absolute top-full z-40" style={{ left: `${popoverAnchorX}px` }}>
          <div
            data-testid="v23-popover-moodboards"
            className="mt-2 w-[min(448px,calc(100vw-28px))] rounded-2xl bg-[#2A313F]/68 backdrop-blur-2xl border border-white/[0.22] ring-1 ring-black/60 shadow-[0_28px_68px_rgba(0,0,0,0.62)] p-3.5 space-y-2.5 text-xs text-[#F3F4F6]"
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-[280px] overflow-y-auto pr-0.5">
              {BIRIM_CURATED_MOODBOARDS.map((mb) => {
                const baseMat = matById.get(mb.baseFrontMaterialId);
                const wallMat = matById.get(mb.wallFrontMaterialId);
                const stoneMat = matById.get(mb.countertopMaterialId);
                const shortTitle = mb.titleTr.split(" &")[0].split(" ").slice(0, 2).join(" ");
                return (
                  <button
                    key={mb.id}
                    type="button"
                    title={`${mb.titleTr} — ${mb.subtitleTr}`}
                    onMouseEnter={() => dispatchLive3DMoodboardPreview(mb)}
                    onClick={() => {
                      dispatchLive3DMoodboardPreview(null);
                      onApplyCuratedMoodboard(mb);
                      setOpenMenu(null);
                    }}
                    className="group p-1.5 rounded-2xl bg-white/[0.08] hover:bg-white/[0.16] border border-white/15 hover:border-[#38BDF8]/70 flex flex-col items-stretch gap-1.5 transition cursor-pointer"
                  >
                    <div className="h-12 w-full rounded-xl overflow-hidden flex border border-white/20 shadow-inner">
                      <span className="flex-[1.3] h-full" style={getMaterialSwatchStyle(baseMat)} />
                      <span className="flex-1 h-full border-l border-white/15" style={getMaterialSwatchStyle(wallMat)} />
                      <span className="flex-[0.8] h-full border-l border-white/15" style={getMaterialSwatchStyle(stoneMat)} />
                    </div>
                    <div className="font-semibold text-[10.5px] text-slate-100 text-center truncate px-0.5">
                      {shortTitle}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </AnimatedPopoverPresence>

        {/* ANİMASYONLU POPOVER 6: STÜDYO RENDER KALİTESİ & IŞIK */}
        <AnimatedPopoverPresence isOpen={openMenu === "render"} origin="top-left" className="absolute top-full z-40" style={{ left: `${popoverAnchorX}px` }}>
          <div
            data-testid="v23-popover-render-quality"
            className="mt-2 w-[min(372px,calc(100vw-28px))] rounded-2xl bg-[#2A313F]/68 backdrop-blur-2xl border border-white/[0.22] ring-1 ring-black/60 shadow-[0_28px_68px_rgba(0,0,0,0.62)] p-3.5 space-y-3 text-xs text-[#F3F4F6]"
          >
            <div className="space-y-1.5">
              <div className="font-bold text-[11.5px] text-white">
                Çalışma Alanı Render &amp; PBR Doku Kalitesi
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    {
                      id: "performance",
                      title: "Akıcı",
                      sub: "1.0x DPR · Hızlı",
                    },
                    {
                      id: "hd",
                      title: "HD Stüdyo",
                      sub: "1.75x · 512px",
                    },
                    {
                      id: "ultra",
                      title: "Ultra PBR",
                      sub: "2.5x · 1024px 4K",
                    },
                  ] as const
                ).map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => handleSelectRenderQuality(q.id)}
                    className={`p-2 rounded-xl border text-left transition cursor-pointer ${
                      qualityTier === q.id
                        ? "bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] border-[#E3B587] text-[#111318] shadow-md"
                        : "bg-white/[0.08] hover:bg-white/[0.15] border-white/12 text-slate-100"
                    }`}
                  >
                    <div className="font-bold text-[11px]">{q.title}</div>
                    <div className="text-[9.5px] opacity-80 mt-0.5">{q.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="text-[10.5px] font-bold text-[#7DD3FC]">Stüdyo Işık Atmosferi</div>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    { id: "daylight", label: "Galeri Işığı", icon: Sun },
                    { id: "showroom_warm", label: "3000K Sıcak", icon: Sun },
                    { id: "night_led", label: "Gece & LED", icon: Moon },
                  ] as const
                ).map((lp) => {
                  const Icon = lp.icon;
                  return (
                    <button
                      key={lp.id}
                      type="button"
                      onClick={() => handleSelectLighting(lp.id)}
                      className={`h-8 px-2 rounded-xl font-semibold text-[10.5px] inline-flex items-center justify-center gap-1 transition cursor-pointer ${
                        lightPreset === lp.id
                          ? "bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] text-white font-bold shadow-sm"
                          : "bg-white/[0.08] hover:bg-white/[0.15] border border-white/12 text-slate-200"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{lp.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              disabled={exporting2K}
              onClick={async () => {
                const win = window as unknown as {
                  __birimRenderUltraStudioPhoto?: (opts?: {
                    angle?: "current" | "iso" | "front";
                    width?: number;
                    height?: number;
                  }) => Promise<string>;
                };
                if (!win.__birimRenderUltraStudioPhoto) return;
                setExporting2K(true);
                try {
                  const url = await win.__birimRenderUltraStudioPhoto({
                    angle: "current",
                    width: 2560,
                    height: 1440,
                  });
                  if (url) {
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `Birim_Ultra_Render_${project.id}.png`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                  }
                } finally {
                  setExporting2K(false);
                }
              }}
              className="w-full h-8.5 rounded-xl bg-gradient-to-r from-[#D6A676] to-[#B58253] hover:brightness-105 disabled:opacity-50 text-[#111318] text-[11px] font-bold flex items-center justify-center gap-1.5 shadow-md transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>
                {exporting2K
                  ? "2.5K Fotoğraf Render Alınıyor..."
                  : "2.5K Ultra Stüdyo Render İndir (.PNG)"}
              </span>
            </button>
          </div>
        </AnimatedPopoverPresence>
      </div>
    );
  }
);
QuickMaterialPopoverBar.displayName = "QuickMaterialPopoverBar";
