"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { AnimatedPopoverPresence } from "./AnimatedWindowPresence";
import {
  Plus,
  Sparkles,
  Home,
  LayoutList,
  Search,
  X,
  Copy,
  Trash2,
  ArrowUpFromLine,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Shuffle,
  Maximize2,
  UtensilsCrossed,
  RotateCw,
  Tv,
  Armchair,
  Box,
  Palette,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type {
  ArchitecturalElement,
  ModuleInstance,
  SceneObjectInstance,
} from "@birim/core";
import {
  V5_SCENE_OBJECT_CATALOG,
  registerDiscoveredSceneObjectCatalogItems,
  type V4ModuleTemplateDefinition,
} from "@birim/catalog";
import { V3IsometricModuleIcon } from "../v3/components/V3IsometricModuleIcon";
import { V3StudioModuleThumbnail } from "../v3/components/V3StudioModuleThumbnail";
import { SceneObjectThumbnail } from "../v3/components/SceneObjectThumbnail";
import {
  V11_CATALOG_GROUPS,
  classifyTemplateGroup,
  type V11CatalogGroup,
  type V11LeftDrawerTab,
} from "./v11Constants";
import { useConfiguratorStore } from "../store/useConfiguratorStore";
import { PremiumSelect } from "./PremiumSelect";
import {
  getEffectiveSpaceWalls,
  startModuleSilhouetteDrag,
  setActiveDraggedTemplateId,
} from "../v3/engine/kitchenSpatialEngine";
import {
  startSceneObjectSilhouetteDrag,
  setActiveDraggedSceneCatalogId,
} from "../v3/engine/multiWallSnapAndBvhEngine";

type KitchenSubFilterId = "all" | "base" | "wall" | "tall" | "corner";
type WardrobeSubFilterId = "all" | "hinged" | "sliding" | "corner_open";

function renderPrimaryGroupVisualSvg(id: V11CatalogGroup["id"], active: boolean) {
  const fillTone = active ? "#F8FAFC" : "#E2E8F0";
  const accentTone = active ? "#BAE6FD" : "#94A3B8";
  const strokeTone = active ? "#FFFFFF" : "#0F172A";
  return (
    <svg viewBox="0 0 36 26" className="w-11 h-8 shrink-0" fill="none" aria-hidden="true">
      {id === "wardrobe" && (
        <>
          <rect x="7" y="2.5" width="22" height="21" rx="1.8" fill={fillTone} stroke={strokeTone} strokeWidth="1.4" />
          <line x1="18" y1="2.5" x2="18" y2="23.5" stroke={strokeTone} strokeWidth="1.2" />
          <line x1="15.8" y1="10" x2="15.8" y2="15" stroke={strokeTone} strokeWidth="1.4" strokeLinecap="round" />
          <line x1="20.2" y1="10" x2="20.2" y2="15" stroke={strokeTone} strokeWidth="1.4" strokeLinecap="round" />
        </>
      )}
      {id === "kitchen" && (
        <>
          {/* Upper cabinet */}
          <rect x="5" y="3" width="17" height="7" rx="1.2" fill={accentTone} stroke={strokeTone} strokeWidth="1.3" />
          <line x1="13.5" y1="3" x2="13.5" y2="10" stroke={strokeTone} strokeWidth="1" />
          {/* Tall tower right */}
          <rect x="23.5" y="3" width="7.5" height="20.5" rx="1.2" fill={fillTone} stroke={strokeTone} strokeWidth="1.3" />
          {/* Countertop + Base */}
          <line x1="4" y1="14" x2="22.5" y2="14" stroke={strokeTone} strokeWidth="1.8" strokeLinecap="round" />
          <rect x="5" y="14.5" width="17" height="9" rx="1" fill={fillTone} stroke={strokeTone} strokeWidth="1.3" />
          <line x1="5" y1="19" x2="22" y2="19" stroke={strokeTone} strokeWidth="1" />
        </>
      )}
      {id === "living" && (
        <>
          {/* Wall TV */}
          <rect x="9" y="3.5" width="18" height="9.5" rx="1.4" fill="#334155" stroke={strokeTone} strokeWidth="1.3" />
          {/* Low Floating / Plinth Console */}
          <rect x="4" y="16" width="28" height="6.5" rx="1.2" fill={fillTone} stroke={strokeTone} strokeWidth="1.3" />
          <line x1="13.3" y1="16" x2="13.3" y2="22.5" stroke={strokeTone} strokeWidth="1.1" />
          <line x1="22.6" y1="16" x2="22.6" y2="22.5" stroke={strokeTone} strokeWidth="1.1" />
        </>
      )}
      {id === "objects" && (
        <>
          {/* Appliance + Table Silhouette */}
          <rect x="5" y="4" width="11" height="19" rx="1.5" fill={accentTone} stroke={strokeTone} strokeWidth="1.3" />
          <rect x="7" y="7" width="7" height="5" rx="0.8" fill="#1E293B" />
          <ellipse cx="25.5" cy="14" rx="6.5" ry="2.6" fill={fillTone} stroke={strokeTone} strokeWidth="1.3" />
          <line x1="21.5" y1="16" x2="20.5" y2="23" stroke={strokeTone} strokeWidth="1.3" strokeLinecap="round" />
          <line x1="29.5" y1="16" x2="30.5" y2="23" stroke={strokeTone} strokeWidth="1.3" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

function renderKitchenSubFilterSvg(kind: KitchenSubFilterId, active: boolean) {
  const cabFill = active ? "#F1F5F9" : "#E2E8F0";
  const strk = active ? "#FFFFFF" : "#0F172A";
  const muted = active ? "#A8A29E" : "#A8A29E";
  return (
    <svg viewBox="0 0 34 26" className="w-10 h-7 shrink-0" fill="none" aria-hidden="true">
      {kind === "all" && (
        <>
          <rect x="5" y="3" width="15" height="6.5" rx="1" fill={cabFill} stroke={strk} strokeWidth="1.25" />
          <rect x="5" y="14.5" width="15" height="8.5" rx="1" fill={cabFill} stroke={strk} strokeWidth="1.25" />
          <line x1="4" y1="14" x2="21" y2="14" stroke={strk} strokeWidth="1.6" />
          <rect x="22" y="3" width="7" height="20" rx="1" fill={cabFill} stroke={strk} strokeWidth="1.25" />
        </>
      )}
      {kind === "base" && (
        <>
          <rect x="6" y="3" width="22" height="5" rx="1" stroke={muted} strokeWidth="1" strokeDasharray="2 2" />
          <line x1="4.5" y1="12" x2="29.5" y2="12" stroke={strk} strokeWidth="2" strokeLinecap="round" />
          <rect x="6" y="12.5" width="22" height="9.5" rx="1" fill={cabFill} stroke={strk} strokeWidth="1.35" />
          <line x1="17" y1="12.5" x2="17" y2="22" stroke={strk} strokeWidth="1.1" />
          <rect x="7.5" y="22" width="19" height="2" fill={strk} opacity="0.7" />
        </>
      )}
      {kind === "wall" && (
        <>
          <rect x="6" y="2.5" width="22" height="10" rx="1.2" fill={cabFill} stroke={strk} strokeWidth="1.35" />
          <line x1="17" y1="2.5" x2="17" y2="12.5" stroke={strk} strokeWidth="1.1" />
          <line x1="8" y1="13.8" x2="26" y2="13.8" stroke="#F59E0B" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="5" y1="21.5" x2="29" y2="21.5" stroke={muted} strokeWidth="1.3" strokeDasharray="2.5 2" />
        </>
      )}
      {kind === "tall" && (
        <>
          <rect x="10" y="2.5" width="14" height="20.5" rx="1.3" fill={cabFill} stroke={strk} strokeWidth="1.35" />
          <rect x="12" y="9" width="10" height="5.5" rx="0.8" fill="#1E293B" />
          <line x1="10" y1="16.5" x2="24" y2="16.5" stroke={strk} strokeWidth="1.1" />
        </>
      )}
      {kind === "corner" && (
        <>
          <polygon points="6,13 15,6 29,6 29,17 18,17 12,22 6,22" fill={cabFill} stroke={strk} strokeWidth="1.3" strokeLinejoin="round" />
          <polyline points="6,13 12,13 18,8 29,8" stroke={strk} strokeWidth="1.1" />
          <line x1="18" y1="8" x2="18" y2="17" stroke={strk} strokeWidth="1.2" />
        </>
      )}
    </svg>
  );
}

function renderWardrobeSubFilterSvg(kind: WardrobeSubFilterId, active: boolean) {
  const cabFill = active ? "#F1F5F9" : "#E2E8F0";
  const strk = active ? "#FFFFFF" : "#0F172A";
  return (
    <svg viewBox="0 0 34 24" className="w-10 h-7 shrink-0" fill="none" aria-hidden="true">
      {kind === "all" && (
        <>
          <rect x="5" y="2.5" width="24" height="19" rx="1.4" fill={cabFill} stroke={strk} strokeWidth="1.3" />
          <line x1="13" y1="2.5" x2="13" y2="21.5" stroke={strk} strokeWidth="1.1" />
          <line x1="21" y1="2.5" x2="21" y2="21.5" stroke={strk} strokeWidth="1.1" />
        </>
      )}
      {kind === "hinged" && (
        <>
          <rect x="7" y="2.5" width="20" height="19" rx="1.4" fill={cabFill} stroke={strk} strokeWidth="1.3" />
          <line x1="17" y1="2.5" x2="17" y2="21.5" stroke={strk} strokeWidth="1.2" />
          <line x1="15" y1="10" x2="15" y2="14" stroke={strk} strokeWidth="1.4" strokeLinecap="round" />
          <line x1="19" y1="10" x2="19" y2="14" stroke={strk} strokeWidth="1.4" strokeLinecap="round" />
        </>
      )}
      {kind === "sliding" && (
        <>
          <rect x="5" y="2.5" width="24" height="19" rx="1.4" fill={cabFill} stroke={strk} strokeWidth="1.3" />
          <line x1="17" y1="2.5" x2="17" y2="21.5" stroke={strk} strokeWidth="1.1" />
          <path d="M9 12h4m-1.5-1.5L13 12l-1.5 1.5M25 12h-4m1.5-1.5L21 12l1.5 1.5" stroke={strk} strokeWidth="1.2" strokeLinecap="round" />
        </>
      )}
      {kind === "corner_open" && (
        <>
          <rect x="6" y="2.5" width="22" height="19" rx="1.4" fill="#F5F1E8" stroke={strk} strokeWidth="1.3" />
          <line x1="8" y1="7.5" x2="26" y2="7.5" stroke={strk} strokeWidth="1.3" />
          <line x1="8" y1="15" x2="26" y2="15" stroke={strk} strokeWidth="1.1" />
          <path d="M14 7.5l-2.5 4h5L14 7.5zM21 7.5l-2.5 4h5L21 7.5z" stroke={strk} strokeWidth="1" />
        </>
      )}
    </svg>
  );
}

export interface LeftCatalogLauncherProps {
  activeDrawer: V11LeftDrawerTab;
  onChangeDrawer: (tab: V11LeftDrawerTab) => void;
  templates: V4ModuleTemplateDefinition[];
  modules: ModuleInstance[];
  sceneObjects: SceneObjectInstance[];
  activeModuleIndex: number;
  wallWidthMm: number;
  ceilingHeightMm: number;
  obstacles: ArchitecturalElement[];
  onApplyTemplateToActive: (templateId: string) => void;
  onAppendTemplateAdjacent: (templateId: string, side?: "left" | "right" | "above") => void;
  onAddCompositeAssembly: (presetId: string) => void;
  onAddSceneObject: (catalogId: string) => void;
  onRotateSceneObject: (id: string) => void;
  onRemoveSceneObject: (id: string) => void;
  onSelectModuleIndex: (idx: number) => void;
  onDuplicateActiveModule: () => void;
  onAddStackedTopModule: () => void;
  onFillRemainingWallGap: () => void;
  onRemoveModuleAt: (idx: number) => void;
  onSetRoomDimensions: (wallW: number, ceilH: number) => void;
  onAddSpaceObstacle: (obs: Omit<ArchitecturalElement, "id">) => void;
  onRemoveSpaceObstacle: (id: string) => void;
  onLoadKitchenPreset: (kind: "linear" | "l" | "u") => void;
  onOpenWizardModal: () => void;
  onOpenKitchenIslandModal: () => void;
  onOpenCapsuleAndGlbHub: (tab: "modules" | "capsule_curved" | "custom_glb" | "automation") => void;
  isQuickPaletteOpen?: boolean;
  onToggleQuickPalette?: () => void;
}

export const LeftCatalogLauncher: React.FC<LeftCatalogLauncherProps> = React.memo(
  ({
    activeDrawer,
    onChangeDrawer,
    templates,
    modules,
    sceneObjects,
    activeModuleIndex,
    wallWidthMm,
    ceilingHeightMm,
    obstacles,
    onApplyTemplateToActive,
    onAppendTemplateAdjacent,
    onAddCompositeAssembly,
    onAddSceneObject,
    onRotateSceneObject,
    onRemoveSceneObject,
    onSelectModuleIndex,
    onDuplicateActiveModule,
    onAddStackedTopModule,
    onFillRemainingWallGap,
    onRemoveModuleAt,
    onSetRoomDimensions,
    onAddSpaceObstacle,
    onRemoveSpaceObstacle,
    onLoadKitchenPreset,
    onOpenWizardModal,
    onOpenKitchenIslandModal,
    onOpenCapsuleAndGlbHub,
    isQuickPaletteOpen = false,
    onToggleQuickPalette,
  }) => {
    const [activeGroup, setActiveGroup] = useState<V11CatalogGroup["id"]>("wardrobe");
    const [kitchenSubFilter, setKitchenSubFilter] = useState<KitchenSubFilterId>("all");
    const [wardrobeSubFilter, setWardrobeSubFilter] = useState<WardrobeSubFilterId>("all");
    const [objectFilter, setObjectFilter] = useState<
      "all" | "appliance" | "furniture" | "plants" | "decor"
    >("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [discoveredTick, setDiscoveredTick] = useState(0);
    const [isDraggingCatalogItem, setIsDraggingCatalogItem] = useState(false);

    useEffect(() => {
      if (!isDraggingCatalogItem) return;
      const clearDrag = () => {
        setIsDraggingCatalogItem(false);
        setActiveDraggedTemplateId(null);
        setActiveDraggedSceneCatalogId(null);
      };
      window.addEventListener("dragend", clearDrag);
      window.addEventListener("drop", clearDrag);
      return () => {
        window.removeEventListener("dragend", clearDrag);
        window.removeEventListener("drop", clearDrag);
      };
    }, [isDraggingCatalogItem]);
    const displayUnit = useConfiguratorStore((s) => s.displayUnit);
    const activeWallId = useConfiguratorStore((s) => s.activeWallId);
    const setActiveWallId = useConfiguratorStore((s) => s.setActiveWallId);
    const storeProject = useConfiguratorStore((s) => s.project);
    const updateSpaceObstacleStore = useConfiguratorStore((s) => s.updateSpaceObstacle);
    const spaceWalls = useMemo(() => getEffectiveSpaceWalls(storeProject), [storeProject]);
    const lastDrawerRef = useRef<Exclude<V11LeftDrawerTab, null>>(activeDrawer ?? "catalog");
    if (activeDrawer) {
      lastDrawerRef.current = activeDrawer;
    }
    const renderedDrawer = activeDrawer ?? lastDrawerRef.current;
    const addWallSegment = useConfiguratorStore((s) => s.addWallSegment);
    const effectiveWalls = spaceWalls;
    const currentTargetWall =
      effectiveWalls.find((w) => w.id === activeWallId) || effectiveWalls[0];
    const hasLeftReturnWall = effectiveWalls.some(
      (w) => (((w.rotationY || 0) % 360) + 360) % 360 === 90 && w.position.x <= 100
    );
    const hasRightReturnWall = effectiveWalls.some((w) => {
      const r = (((w.rotationY || 0) % 360) + 360) % 360;
      return (r === 90 || r === 270) && w.position.x >= Math.max(800, wallWidthMm - 250);
    });
    const hasFrontReturnWall = effectiveWalls.some((w) => w.position.z >= 1000);

    const handleSelectOrCreateDrawerWall = (
      mode: { kind: "existing"; id: string } | { kind: "create"; side: "left" | "right" | "front" }
    ) => {
      if (mode.kind === "existing") {
        const st = useConfiguratorStore.getState();
        if (!st.project.space.walls.some((w) => w.id === mode.id)) {
          const eff = getEffectiveSpaceWalls(st.project);
          st.applyBatchProjectUpdate((draft) => {
            draft.space.walls = eff.map((ew) => ({ ...ew, position: { ...ew.position } }));
          }, "Duvar etkinleştirildi");
        }
        setActiveWallId(mode.id);
      } else {
        const wName =
          mode.side === "left"
            ? "Sol Yan Duvar"
            : mode.side === "right"
            ? "Sağ Yan Duvar"
            : "Karşı Ön Duvar";
        const newId = addWallSegment({
          name: wName,
          length: mode.side === "front" ? wallWidthMm : 2400,
          height: ceilingHeightMm,
          thickness: 150,
          position:
            mode.side === "left"
              ? { x: 0, y: 0, z: 0 }
              : mode.side === "right"
              ? { x: wallWidthMm, y: 0, z: 0 }
              : { x: 0, y: 0, z: 2400 },
          rotationY: mode.side === "front" ? 0 : 90,
        });
        setActiveWallId(newId);
      }
      if (typeof window !== "undefined") {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("birim:fit-camera-3d", { detail: "room_front_persp" }));
        }, 25);
      }
    };

    const isDrawerOpen = Boolean(activeDrawer);

    const fmtLen = (mm: number, withUnit = true) => {
      if (displayUnit === "cm") {
        const v = Number((mm / 10).toFixed(1));
        return withUnit ? `${v} cm` : `${v}`;
      }
      const v = Math.round(mm);
      return withUnit ? `${v} mm` : `${v}`;
    };

    const placeOnSelectedWall = (
      obsType: ArchitecturalElement["type"],
      obsName: string,
      wMm: number,
      hMm: number,
      dMm: number,
      elevYMm: number,
      explicitWallId?: string
    ) => {
      // V90: Always read live activeWallId and walls from Zustand store (zero stale closure)
      const liveSt = useConfiguratorStore.getState();
      const liveWalls = getEffectiveSpaceWalls(liveSt.project);
      const chosenWallId = explicitWallId || liveSt.activeWallId || activeWallId;
      const targetWall =
        liveWalls.find((w) => w.id === chosenWallId) || liveWalls[0] || {
          id: "wall_main",
          name: "Ana Duvar",
          length: wallWidthMm,
          position: { x: 0, y: 0, z: 0 },
          rotationY: 0,
        };
      const wallLen = Math.max(600, targetWall.length || wallWidthMm);
      const wallRot = (((targetWall.rotationY || 0) % 360) + 360) % 360;
      const rad = (wallRot * Math.PI) / 180;
      const dirX = Math.cos(rad);
      const dirZ = Math.sin(rad);
      const maxStart = Math.max(0, wallLen - wMm);

      // Project existing obstacles on this same wall so sequential additions advance cleanly along the wall vector
      const liveObstacles = liveSt.project.space.elements || obstacles;
      const sameWallIntervals: Array<[number, number]> = [];
      for (const ex of liveObstacles) {
        const exRot = (((ex.rotationY || 0) % 360) + 360) % 360;
        const rotDiff = Math.min(Math.abs(exRot - wallRot), 360 - Math.abs(exRot - wallRot));
        if (rotDiff > 12) continue;
        const relX = ex.position.x - targetWall.position.x;
        const relZ = ex.position.z - targetWall.position.z;
        const along = relX * dirX + relZ * dirZ;
        const perp = Math.abs(-relX * dirZ + relZ * dirX);
        if (perp <= 220 && along >= -100 && along <= wallLen + 100) {
          sameWallIntervals.push([along, along + (ex.dimensions.width || 300)]);
        }
      }
      sameWallIntervals.sort((a, b) => a[0] - b[0]);

      // V90: Place columns cleanly along the selected wall (not buried at (0,0) corner of main wall!)
      let chosenOffset =
        obsType === "column"
          ? Math.min(maxStart, Math.max(350, Math.round((wallLen - wMm) * 0.45)))
          : obsType === "door"
          ? Math.max(200, Math.min(maxStart, wallLen - wMm - 200))
          : Math.min(maxStart, Math.max(200, Math.round((wallLen - wMm) * 0.45)));

      const overlaps = (cand: number) =>
        sameWallIntervals.some(([s, e]) => cand < e + 60 && cand + wMm > s - 60);

      if (overlaps(chosenOffset)) {
        let cursor = 160;
        for (const [s, e] of sameWallIntervals) {
          if (cursor + wMm + 60 <= s) break;
          cursor = Math.max(cursor, e + 120);
        }
        chosenOffset = Math.max(0, Math.min(maxStart, Math.round(cursor / 50) * 50));
      }

      onAddSpaceObstacle({
        type: obsType,
        name: obsName,
        rotationY: wallRot,
        doorSwing: "left",
        doorOpenSide: "inward",
        metadata: { wallId: targetWall.id, wallName: targetWall.name },
        position: {
          x: Math.round(targetWall.position.x + dirX * chosenOffset),
          y: elevYMm,
          z: Math.round(targetWall.position.z + dirZ * chosenOffset),
        },
        dimensions: { width: wMm, height: hMm, depth: dMm },
      });
    };

    useEffect(() => {
      if (activeDrawer !== "catalog") return;
      let cancelled = false;
      fetch("/api/scene-objects/local-glbs", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!cancelled && Array.isArray(data?.items)) {
            const added = registerDiscoveredSceneObjectCatalogItems(data.items);
            if (added > 0) setDiscoveredTick((t) => t + 1);
          }
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [activeDrawer]);

    useEffect(() => {
      if (!activeDrawer) return;
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") onChangeDrawer(null);
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [activeDrawer, onChangeDrawer]);

    const mainModules = useMemo(
      () =>
        modules
          .map((mod, idx) => ({ mod, idx }))
          .filter((entry) => entry.mod.category !== "complementary"),
      [modules]
    );

    const occupiedSpanMm = useMemo(
      () =>
        mainModules.reduce((acc, { mod }) => {
          const rightEdge = Math.max(mod.position.x + mod.dimensions.width, acc);
          return rightEdge;
        }, 0),
      [mainModules]
    );
    const remainingWallGapMm = Math.max(0, Math.round(wallWidthMm - occupiedSpanMm));

    const classifyKitchenSub = (tpl: V4ModuleTemplateDefinition): Exclude<KitchenSubFilterId, "all"> => {
      const tid = tpl.templateId.toLowerCase();
      const nm = tpl.name.toLowerCase();
      if (tpl.isCorner || tid.includes("corner") || nm.includes("köşe")) return "corner";
      if (tpl.familyId === "fam_kitchen_wall" || tid.startsWith("tpl_kw_")) return "wall";
      if (tpl.familyId === "fam_kitchen_tall" || tid.startsWith("tpl_kt_")) return "tall";
      return "base";
    };

    const classifyWardrobeSub = (tpl: V4ModuleTemplateDefinition): Exclude<WardrobeSubFilterId, "all"> => {
      const tid = tpl.templateId.toLowerCase();
      const nm = tpl.name.toLowerCase();
      if (tpl.isCorner || tid.includes("corner") || nm.includes("köşe") || tpl.defaultDoorSystemId === "open" || nm.includes("açık") || nm.includes("giyinme")) {
        return "corner_open";
      }
      if (tpl.defaultDoorSystemId.startsWith("sliding") || tid.includes("sliding") || nm.includes("sürgü")) {
        return "sliding";
      }
      return "hinged";
    };

    const groupBaseTemplates = useMemo(
      () =>
        templates.filter(
          (tpl) =>
            !tpl.complementaryRole &&
            tpl.templateId !== "tpl_sc_10_custom_geometry" &&
            classifyTemplateGroup(tpl) === activeGroup
        ),
      [templates, activeGroup]
    );

    const filteredTemplates = useMemo(() => {
      const q = searchQuery.trim().toLowerCase();
      return templates.filter((tpl) => {
        if (tpl.complementaryRole) return false;
        if (tpl.templateId === "tpl_sc_10_custom_geometry") return false;
        if (q) {
          return (
            tpl.name.toLowerCase().includes(q) ||
            tpl.description.toLowerCase().includes(q) ||
            tpl.templateId.toLowerCase().includes(q)
          );
        }
        if (activeGroup === "objects") return false;
        if (classifyTemplateGroup(tpl) !== activeGroup) return false;
        if (activeGroup === "kitchen" && kitchenSubFilter !== "all") {
          return classifyKitchenSub(tpl) === kitchenSubFilter;
        }
        if (activeGroup === "wardrobe" && wardrobeSubFilter !== "all") {
          return classifyWardrobeSub(tpl) === wardrobeSubFilter;
        }
        return true;
      });
    }, [templates, activeGroup, kitchenSubFilter, wardrobeSubFilter, searchQuery]);

    const filteredSceneObjects = useMemo(() => {
      const q = searchQuery.trim().toLowerCase();
      return V5_SCENE_OBJECT_CATALOG.filter((item) => {
        if (q) {
          return (
            item.name.toLowerCase().includes(q) ||
            item.description.toLowerCase().includes(q)
          );
        }
        if (objectFilter === "all") return true;
        if (objectFilter === "appliance") {
          return item.category === "appliance" || item.category === "plumbing_fixture";
        }
        if (objectFilter === "furniture") {
          return item.category === "freestanding_furniture";
        }
        if (objectFilter === "plants") {
          return (
            item.visualKind === "plant_olive_tree" ||
            item.catalogId.includes("plant") ||
            item.catalogId.includes("olive")
          );
        }
        return (
          item.category === "lighting_electronics" ||
          item.category === "custom_glb" ||
          item.category === "architectural_prop"
        );
      });
    }, [searchQuery, objectFilter, discoveredTick]);

    const [openLeftSubmenu, setOpenLeftSubmenu] = useState<null | "add" | "modules" | "room">(null);
    const [latchedLeftSubmenu, setLatchedLeftSubmenu] = useState<"add" | "modules" | "room">("add");
    useEffect(() => {
      if (openLeftSubmenu) setLatchedLeftSubmenu(openLeftSubmenu);
    }, [openLeftSubmenu]);
    useEffect(() => {
      if (isQuickPaletteOpen) setOpenLeftSubmenu(null);
    }, [isQuickPaletteOpen]);
    const closeQuickPaletteIfOpen = () => {
      if (isQuickPaletteOpen && onToggleQuickPalette) {
        onToggleQuickPalette();
      }
    };
    const toggleDrawer = (tab: Exclude<V11LeftDrawerTab, null>) => {
      onChangeDrawer(activeDrawer === tab ? null : tab);
    };

    const totalItemsBadge = mainModules.length + sceneObjects.length;

    return (
      <>
        {/* SOL İNCE DİKEY YÜZEN İKON ÇUBUĞU — Düğmelere Tıklayınca Yanından Alt Menü Açılır */}
        <aside
          aria-label="Modül ve Mekân Araçları"
          data-testid="v11-left-launcher"
          className={`fixed left-4 max-md:left-2 top-1/2 -translate-y-1/2 z-30 p-1.5 max-md:p-1 rounded-full bg-[#1C222E]/84 backdrop-blur-2xl border border-white/[0.18] ring-1 ring-black/50 shadow-[0_20px_50px_rgba(0,0,0,0.52)] flex flex-col items-center gap-1.5 max-md:gap-1 transition-opacity duration-200 ${isDrawerOpen ? "max-lg:opacity-0 max-lg:pointer-events-none" : ""}`}
        >
          <button
            type="button"
            data-testid="v11-launcher-catalog"
            onClick={() => {
              closeQuickPaletteIfOpen();
              if (activeDrawer === "catalog") {
                onChangeDrawer(null);
                setOpenLeftSubmenu(null);
              } else if (activeDrawer !== null) {
                setOpenLeftSubmenu(null);
                onChangeDrawer("catalog");
              } else {
                setOpenLeftSubmenu((cur) => (cur === "add" ? null : "add"));
              }
            }}
            title="Modül Ekle — Katalog Alt Menüsü"
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${
              activeDrawer === "catalog" || openLeftSubmenu === "add"
                ? "bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] text-white shadow-[0_0_18px_rgba(29,78,216,0.55)] scale-105"
                : "bg-white/[0.10] hover:bg-white/[0.18] text-[#F3F4F6] border border-white/[0.14]"
            }`}
          >
            <Plus className={`w-5 h-5 transition-transform duration-200 ${openLeftSubmenu === "add" || activeDrawer === "catalog" ? "rotate-45" : ""}`} />
          </button>

          <button
            type="button"
            data-testid="v11-launcher-modules"
            onClick={() => {
              closeQuickPaletteIfOpen();
              if (activeDrawer === "modules") {
                onChangeDrawer(null);
                setOpenLeftSubmenu(null);
              } else if (activeDrawer !== null) {
                setOpenLeftSubmenu(null);
                onChangeDrawer("modules");
              } else {
                setOpenLeftSubmenu((cur) => (cur === "modules" ? null : "modules"));
              }
            }}
            title="Modül Listesi — Sahnedeki Modüller"
            className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${
              activeDrawer === "modules" || openLeftSubmenu === "modules"
                ? "bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] text-white shadow-[0_0_18px_rgba(29,78,216,0.55)] scale-105"
                : "bg-white/[0.10] hover:bg-white/[0.18] text-[#F3F4F6] border border-white/[0.14]"
            }`}
          >
            <LayoutList className="w-4 h-4" />
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[#0284C7] text-white text-[9.5px] font-bold flex items-center justify-center shadow-sm">
              {totalItemsBadge}
            </span>
          </button>

          <button
            type="button"
            data-testid="v11-launcher-space"
            onClick={() => {
              closeQuickPaletteIfOpen();
              if (activeDrawer === "space") {
                onChangeDrawer(null);
                setOpenLeftSubmenu(null);
              } else if (activeDrawer !== null) {
                setOpenLeftSubmenu(null);
                onChangeDrawer("space");
              } else {
                setOpenLeftSubmenu((cur) => (cur === "room" ? null : "room"));
              }
            }}
            title="Oda / Duvar Ayarları"
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${
              activeDrawer === "space" || openLeftSubmenu === "room"
                ? "bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] text-white shadow-[0_0_18px_rgba(29,78,216,0.55)] scale-105"
                : "bg-white/[0.10] hover:bg-white/[0.18] text-[#F3F4F6] border border-white/[0.14]"
            }`}
          >
            <Home className="w-4 h-4" />
          </button>

          {onToggleQuickPalette && (
            <>
              <span className="w-5 h-px bg-white/15 my-0.5" />
              <button
                type="button"
                data-testid="v11-launcher-palette"
                onClick={() => {
                  setOpenLeftSubmenu(null);
                  onChangeDrawer(null);
                  onToggleQuickPalette();
                }}
                title="Kartela — Hızlı Malzeme & Yüzey Seçimi (M)"
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${
                  isQuickPaletteOpen
                    ? "bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] text-white shadow-[0_0_18px_rgba(29,78,216,0.55)] scale-105"
                    : "bg-white/[0.10] hover:bg-white/[0.18] text-[#F3F4F6] border border-white/[0.14]"
                }`}
              >
                <Palette className="w-4 h-4" />
              </button>
            </>
          )}

          <span className="w-5 h-px bg-white/15 my-0.5" />

          <button
            type="button"
            data-testid="v11-launcher-wizard"
            onClick={() => {
              closeQuickPaletteIfOpen();
              setOpenLeftSubmenu(null);
              onChangeDrawer(null);
              onOpenWizardModal();
            }}
            title="Akıllı Kurulum Sihirbazı"
            className="w-10 h-10 rounded-full bg-white/[0.10] hover:bg-white/[0.18] text-sky-300 border border-white/[0.14] flex items-center justify-center transition cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
          </button>
        </aside>

        {/* İNCE DİKEY ÇUBUKTAN ANİMASYONLA AÇILAN YAN ALT MENÜ POPOVER'I */}
        <AnimatedPopoverPresence
          isOpen={Boolean(openLeftSubmenu && !activeDrawer)}
          origin="left"
          durationMs={220}
          className="fixed left-[72px] max-md:left-[56px] top-1/2 -translate-y-1/2 z-40 pointer-events-none"
        >
          <div
            data-testid={`v11-left-submenu-${openLeftSubmenu || latchedLeftSubmenu}`}
            style={{ width: openLeftSubmenu === "modules" ? "264px" : openLeftSubmenu === "room" ? "236px" : "248px", transition: "width 320ms cubic-bezier(0.16, 1, 0.3, 1)" }} className="pointer-events-auto max-w-[calc(100vw-68px)] p-3 rounded-2xl bg-[#1C222E]/94 backdrop-blur-2xl border border-white/[0.18] ring-1 ring-black/55 shadow-[0_24px_60px_rgba(0,0,0,0.62)] text-xs text-slate-100 space-y-2"
          >
            <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-white/10">
              <span className="text-[11.5px] font-bold text-white">
                {(openLeftSubmenu || latchedLeftSubmenu) === "add"
                  ? "Modül Ekle"
                  : (openLeftSubmenu || latchedLeftSubmenu) === "modules"
                  ? `Modül Listesi (${totalItemsBadge})`
                  : "Oda / Duvar Ayarları"}
              </span>
              <button
                type="button"
                aria-label="Alt Menüyü Kapat"
                onClick={() => setOpenLeftSubmenu(null)}
                className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {(openLeftSubmenu || latchedLeftSubmenu) === "add" && (
              <div className="space-y-1 text-[11.5px]">
                {(
                  [
                    { id: "wardrobe", label: "Gardırop & Dolap" },
                    { id: "kitchen", label: "Mutfak Modülleri" },
                    { id: "living", label: "TV Ünitesi & Salon" },
                    { id: "objects", label: "3B Eşya & Aksesuar" },
                  ] as const
                ).map((grp) => (
                  <button
                    key={grp.id}
                    type="button"
                    onClick={() => {
                      setActiveGroup(grp.id);
                      setOpenLeftSubmenu(null);
                      onChangeDrawer("catalog");
                    }}
                    className="w-full px-2.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.12] text-left text-slate-100 font-semibold flex items-center justify-between cursor-pointer transition"
                  >
                    <span>{grp.label}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-sky-300" />
                  </button>
                ))}
                <div className="pt-1.5 mt-1 border-t border-white/10 grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setOpenLeftSubmenu(null);
                      onOpenWizardModal();
                    }}
                    className="py-1.5 px-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 font-semibold text-[11px] flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Sihirbaz</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenLeftSubmenu(null);
                      onOpenKitchenIslandModal();
                    }}
                    className="py-1.5 px-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.16] text-slate-200 font-semibold text-[11px] text-center cursor-pointer"
                  >
                    Ada / Masa
                  </button>
                </div>
              </div>
            )}

            {(openLeftSubmenu || latchedLeftSubmenu) === "room" && (
              <div className="space-y-2.5 text-[11px]">
                <div className="grid grid-cols-2 gap-2">
                  {effectiveWalls.map((w, idx) => {
                    const isMain = idx === 0;
                    const wallLbl = w.name || `Duvar ${idx + 1}`;
                    return (
                      <label key={w.id} className="space-y-1">
                        <span className="text-[10px] text-slate-400 block truncate" title={`${wallLbl} Uzunluğu (mm)`}>
                          {wallLbl} (mm)
                        </span>
                        <input
                          type="number" inputMode="decimal"
                          min={600}
                          max={12000}
                          step={100}
                          value={w.length}
                          onChange={(e) => {
                            const nextLen = Math.max(600, Math.min(12000, Number(e.target.value) || w.length));
                            if (isMain) {
                              onSetRoomDimensions(nextLen, ceilingHeightMm);
                            } else {
                              const st = useConfiguratorStore.getState();
                              if (!st.project.space.walls.some((sw) => sw.id === w.id)) {
                                st.applyBatchProjectUpdate((draft) => {
                                  draft.space.walls = effectiveWalls.map((ew) => ({
                                    ...ew,
                                    position: { ...ew.position },
                                  }));
                                }, "Oda duvarları hazırlandı");
                              }
                              useConfiguratorStore.getState().updateWallSegment(w.id, { length: nextLen });
                            }
                          }}
                          className="w-full h-7 px-2 rounded-lg bg-black/40 border border-white/15 font-mono text-[11px] text-white"
                        />
                      </label>
                    );
                  })}
                  <label className="space-y-1">
                    <span className="text-[10px] text-slate-400 block">Tavan (mm)</span>
                    <input
                      type="number" inputMode="decimal"
                      min={2000}
                      max={4500}
                      step={50}
                      value={ceilingHeightMm}
                      onChange={(e) =>
                        onSetRoomDimensions(
                          wallWidthMm,
                          Math.max(2000, Number(e.target.value) || ceilingHeightMm)
                        )
                      }
                      className="w-full h-7 px-2 rounded-lg bg-black/40 border border-white/15 font-mono text-[11px] text-white"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {(
                    [
                      { id: "linear", label: "Düz" },
                      { id: "l", label: "L Tipi" },
                      { id: "u", label: "U Tipi" },
                    ] as const
                  ).map((kp) => {
                    const isActiveWallShape =
                      (kp.id === "linear" && effectiveWalls.length === 1) ||
                      (kp.id === "l" && effectiveWalls.length === 2) ||
                      (kp.id === "u" && effectiveWalls.length >= 3);
                    return (
                      <button
                        key={kp.id}
                        type="button"
                        onClick={() => {
                          const st = useConfiguratorStore.getState();
                          const mainW = effectiveWalls[0]?.length || wallWidthMm || 3600;
                          const ceilH = ceilingHeightMm || st.project.space?.ceilingHeight || 2600;
                          const thick = effectiveWalls[0]?.thickness || 150;
                          const existingLeft = effectiveWalls.find(
                            (w) => Math.abs((((w.rotationY || 0) % 180) + 180) % 180 - 90) <= 15 && w.position.x <= 80
                          );
                          const existingRight = effectiveWalls.find(
                            (w) =>
                              Math.abs((((w.rotationY || 0) % 180) + 180) % 180 - 90) <= 15 &&
                              w.position.x > 80
                          );
                          const mainWall = {
                            id: effectiveWalls[0]?.id || "wall_main",
                            name: effectiveWalls[0]?.name || "Ana Duvar",
                            length: mainW,
                            height: ceilH,
                            thickness: thick,
                            position: { x: 0, y: 0, z: 0 },
                            rotationY: 0,
                            elements: effectiveWalls[0]?.elements || [],
                          };
                          const leftWall = {
                            id: existingLeft?.id || "wall_left",
                            name: existingLeft?.name || "Sol Yan Duvar",
                            length: existingLeft?.length || 2400,
                            height: ceilH,
                            thickness: thick,
                            position: { x: 0, y: 0, z: 0 },
                            rotationY: 90,
                            elements: existingLeft?.elements || [],
                          };
                          const rightWall = {
                            id: existingRight?.id || "wall_right",
                            name: existingRight?.name || "Sağ Yan Duvar",
                            length: existingRight?.length || 2400,
                            height: ceilH,
                            thickness: thick,
                            position: { x: mainW, y: 0, z: 0 },
                            rotationY: 90,
                            elements: existingRight?.elements || [],
                          };
                          const nextWalls =
                            kp.id === "linear"
                              ? [mainWall]
                              : kp.id === "l"
                              ? [mainWall, leftWall]
                              : [mainWall, leftWall, rightWall];
                          st.applyBatchProjectUpdate((draft) => {
                            draft.space.walls = nextWalls;
                          }, `Duvar tipi: ${kp.label}`);
                          if (!nextWalls.some((w) => w.id === activeWallId)) {
                            setActiveWallId(mainWall.id);
                          }
                        }}
                        className={`py-1.5 rounded-lg text-[10.5px] font-semibold cursor-pointer transition border ${
                          isActiveWallShape
                            ? "bg-sky-500/25 border-sky-400/70 text-sky-200"
                            : "bg-white/[0.08] hover:bg-white/[0.16] border-transparent text-slate-200"
                        }`}
                      >
                        {kp.label}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setOpenLeftSubmenu(null);
                    onChangeDrawer("space");
                  }}
                  className="w-full py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 font-semibold text-[11px] cursor-pointer"
                >
                  Tüm Engel &amp; Duvar Ayarları →
                </button>
              </div>
            )}

            {(openLeftSubmenu || latchedLeftSubmenu) === "modules" && (
              <div className="space-y-2">
                <div className="space-y-1 max-h-[220px] overflow-y-auto pr-0.5">
                  {mainModules.map(({ mod, idx }) => {
                    const isSel = idx === activeModuleIndex;
                    return (
                      <button
                        key={mod.id}
                        type="button"
                        onClick={() => onSelectModuleIndex(idx)}
                        className={`w-full px-2.5 py-1.5 rounded-xl text-left border flex items-center justify-between gap-2 transition cursor-pointer ${
                          isSel
                            ? "bg-[#0284C7]/25 border-sky-400/50 text-white"
                            : "bg-white/[0.04] hover:bg-white/[0.10] border-transparent text-slate-300"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-[11px] font-semibold truncate">{mod.name}</div>
                          <div className="text-[9.5px] font-mono text-slate-400">
                            {mod.dimensions.width}×{mod.dimensions.height}×{mod.dimensions.depth}
                          </div>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                      </button>
                    );
                  })}
                </div>
                <div className="pt-1.5 border-t border-white/10 grid grid-cols-2 gap-1 text-[10.5px]">
                  <button
                    type="button"
                    onClick={onDuplicateActiveModule}
                    className="py-1.5 px-2 rounded-lg bg-white/[0.08] hover:bg-white/[0.16] text-slate-200 font-semibold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3 h-3 text-sky-300" />
                    <span>Çoğalt</span>
                  </button>
                  <button
                    type="button"
                    onClick={onAddStackedTopModule}
                    className="py-1.5 px-2 rounded-lg bg-white/[0.08] hover:bg-white/[0.16] text-slate-200 font-semibold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <ArrowUpFromLine className="w-3 h-3 text-sky-300" />
                    <span>Üst Modül</span>
                  </button>
                  <button
                    type="button"
                    onClick={onFillRemainingWallGap}
                    className="py-1.5 px-2 rounded-lg bg-white/[0.08] hover:bg-white/[0.16] text-slate-200 font-semibold text-center cursor-pointer"
                  >
                    Boşluk Doldur
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenLeftSubmenu(null);
                      onChangeDrawer("modules");
                    }}
                    className="py-1.5 px-2 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 font-semibold text-center cursor-pointer"
                  >
                    Tüm Liste →
                  </button>
                </div>
              </div>
            )}
          </div>
        </AnimatedPopoverPresence>

        {/* YÜZEN KÜTÜPHANE / DİZİLİM / MEKÂN ÇEKMECESİ (Dramatik Füme Arduvaz Buzlu Cam + Yay Animasyonlu Açılış/Kapanış) */}
          <section
            inert={!isDrawerOpen ? true : undefined}
            data-testid={activeDrawer ? `v11-left-popover-${activeDrawer}` : "v11-left-popover-closed"}
            style={
              {
                paddingBottom: "env(safe-area-inset-bottom)",
                width:
                  renderedDrawer === "catalog"
                    ? "432px"
                    : renderedDrawer === "modules"
                    ? "348px"
                    : "388px",
                "--birim-left-sheet-h":
                  renderedDrawer === "catalog"
                    ? "68dvh"
                    : renderedDrawer === "modules"
                    ? "52dvh"
                    : "60dvh",
                transition:
                  "width 360ms cubic-bezier(0.16, 1, 0.3, 1), height 360ms cubic-bezier(0.16, 1, 0.3, 1), transform 360ms cubic-bezier(0.16, 1, 0.3, 1), opacity 240ms ease",
              } as React.CSSProperties
            }
            className={`birim-dramatic-panel fixed left-[76px] top-[72px] bottom-[84px] max-w-[calc(100vw-96px)] max-lg:!w-auto max-lg:left-2.5 max-lg:right-2.5 max-lg:top-auto max-lg:bottom-2.5 max-lg:h-[var(--birim-left-sheet-h)] max-lg:max-w-none max-lg:rounded-t-3xl max-lg:rounded-b-2xl max-lg:origin-bottom max-lg:z-[60] z-30 rounded-3xl bg-[#2A313F]/66 backdrop-blur-2xl border border-white/[0.22] ring-1 ring-black/60 shadow-[0_28px_68px_rgba(0,0,0,0.62)] flex flex-col overflow-hidden text-[#F3F4F6] origin-left will-change-[width,height,transform,opacity] ${
              !isDrawerOpen
                ? "opacity-0 scale-95 -translate-x-6 max-lg:translate-x-0 max-lg:translate-y-6 pointer-events-none"
                : isDraggingCatalogItem
                ? "opacity-15 scale-[0.97] -translate-x-4 pointer-events-none"
                : "opacity-100 scale-100 translate-x-0 max-lg:translate-y-0 pointer-events-auto"
            }`}
          >
            {/* MOBİL / TABLET ALT ÇEKMECE TUTAMAÇ GÖSTERGESİ (<1024px) */}
            <div className="lg:hidden w-full pt-2 pb-1 flex justify-center shrink-0">
              <span className="w-10 h-1 rounded-full bg-[#CFC7B9]" />
            </div>
            <div className="px-5 pt-4 pb-3 border-b border-[#E6E1D6] flex items-center justify-between gap-2 shrink-0">
              <div key={renderedDrawer} className="birim-drawer-content-morph">
                <h2 className="text-sm font-bold tracking-tight">
                  {renderedDrawer === "catalog"
                    ? "Katalog"
                    : renderedDrawer === "modules"
                    ? "Sahnedeki Modüller ve Eşyalar"
                    : "Oda, Hazır Mutfak & Mimari"}
                </h2>
                <p className="text-[11px] text-[#78716C] mt-0.5">
                  {renderedDrawer === "catalog"
                    ? ""
                    : renderedDrawer === "modules"
                    ? `${mainModules.length} modül • ${sceneObjects.length} sahne eşyası`
                    : "Duvar ölçüleri, hazır mutfak yerleşimleri ve engeller"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onChangeDrawer(null)}
                aria-label="Paneli kapat"
                className="w-8 h-8 rounded-full hover:bg-[#EFECE4] text-[#57534E] hover:text-[#141413] flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* V56 MİNİ 3B ODA DUVAR SEÇİCİSİ + YANINDA ARAMA ÇUBUĞU */}
            <div
              data-testid="v25-drawer-target-wall-bar"
              className="px-3.5 py-2.5 bg-black/30 border-b border-white/[0.10] flex items-center gap-2.5 shrink-0"
            >
              {(() => {
                const activeId = currentTargetWall?.id || "wall_main";
                const normRot = (w: typeof effectiveWalls[number]) => (((w.rotationY || 0) % 360) + 360) % 360;
                const mainWall = effectiveWalls.find((w) => w.id === "wall_main") || effectiveWalls[0];
                const frontWall = effectiveWalls.find((w) => {
                  if (w.id === mainWall?.id) return false;
                  const n = (w.name || "").toLowerCase();
                  return w.id.includes("front") || n.includes("karşı") || n.includes("ön") || normRot(w) === 180 || ((w.position?.z || 0) > 800 && normRot(w) === 0);
                });
                const rightWall = effectiveWalls.find((w) => {
                  if (w.id === mainWall?.id || w.id === frontWall?.id) return false;
                  const n = (w.name || "").toLowerCase();
                  return w.id.includes("right") || n.includes("sağ") || normRot(w) === 270 || (w.position?.x || 0) > 400;
                });
                const leftWall = effectiveWalls.find((w) => {
                  if (w.id === mainWall?.id || w.id === frontWall?.id || w.id === rightWall?.id) return false;
                  const n = (w.name || "").toLowerCase();
                  return w.id.includes("left") || n.includes("sol") || normRot(w) === 90;
                });

                const isMainSel = activeId === (mainWall?.id || "wall_main");
                const isLeftSel = Boolean(leftWall && activeId === leftWall.id);
                const isRightSel = Boolean(rightWall && activeId === rightWall.id);
                const isFrontSel = Boolean(frontWall && activeId === frontWall.id);

                const wallFill = (sel: boolean, exists: boolean) =>
                  sel ? "#0EA5E9" : exists ? "#526075" : "rgba(15,23,42,0.28)";
                const wallStroke = (sel: boolean, exists: boolean) =>
                  sel ? "#BAE6FD" : exists ? "#CBD5E1" : "#64748B";
                const wallFilter = (sel: boolean) =>
                  sel ? "drop-shadow(0 0 6px rgba(56,189,248,0.9))" : "none";
                const deleteSecondaryWall = (wallIdToDel: string) => {
                  const st = useConfiguratorStore.getState();
                  st.applyBatchProjectUpdate((draft) => {
                    draft.space.walls = (draft.space.walls || []).filter((w) => w.id !== wallIdToDel);
                    if (draft.space.walls.length === 1) (draft.space as unknown as { shape?: string }).shape = "rectangular";
                    else if (draft.space.walls.length === 2) (draft.space as unknown as { shape?: string }).shape = "l_shape";
                  }, "Duvar silindi");
                  if (activeId === wallIdToDel) st.setActiveWallId("wall_main");
                };

                return (
                  <div
                    className="relative shrink-0 rounded-xl bg-black/40 border border-white/15 p-1.5"
                    title={`Hedef Duvar: ${currentTargetWall?.name || "Ana Duvar"} — Kesikli (+): Duvar Ekle · Dolu: Seç · Kırmızı (×): Duvarı Sil`}
                  >
                    <svg viewBox="0 0 96 54" className="w-[104px] h-[58px] block" fill="none">
                      {/* Zemin */}
                      <polygon points="10,45 86,45 76,10 20,10" fill="rgba(15,23,42,0.52)" />

                      {/* Sol Duvar (90°) */}
                      <g
                        onClick={() =>
                          leftWall
                            ? handleSelectOrCreateDrawerWall({ kind: "existing", id: leftWall.id })
                            : handleSelectOrCreateDrawerWall({ kind: "create", side: "left" })
                        }
                        className="cursor-pointer transition-opacity hover:opacity-95"
                      >
                        <title>{leftWall ? `${leftWall.name} (Seç)` : "+ Sol Duvar Ekle"}</title>
                        <polygon
                          points="19,10 26,10 17,43 8,43"
                          fill={wallFill(isLeftSel, Boolean(leftWall))}
                          stroke={wallStroke(isLeftSel, Boolean(leftWall))}
                          strokeWidth={isLeftSel ? "2" : leftWall ? "1.5" : "1.2"}
                          strokeDasharray={leftWall ? undefined : "3 2"}
                          style={{ filter: wallFilter(isLeftSel) }}
                          strokeLinejoin="round"
                        />
                        {!leftWall ? (
                          <g pointerEvents="none">
                            <circle cx="17" cy="26" r="5.5" fill="#0F172A" stroke="#38BDF8" strokeWidth="1.2" />
                            <path d="M17 23.4v5.2M14.4 26h5.2" stroke="#7DD3FC" strokeWidth="1.4" strokeLinecap="round" />
                          </g>
                        ) : effectiveWalls.length > 1 ? (
                          <g
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSecondaryWall(leftWall.id);
                            }}
                            className="cursor-pointer"
                          >
                            <title>Sol Duvarı Sil</title>
                            <circle cx="11" cy="26" r="5" fill="#E11D48" stroke="#FFFFFF" strokeWidth="1" />
                            <path d="M9 24l4 4M13 24l-4 4" stroke="#FFFFFF" strokeWidth="1.25" strokeLinecap="round" />
                          </g>
                        ) : null}
                      </g>

                      {/* Sağ Duvar (270°) */}
                      <g
                        onClick={() =>
                          rightWall
                            ? handleSelectOrCreateDrawerWall({ kind: "existing", id: rightWall.id })
                            : handleSelectOrCreateDrawerWall({ kind: "create", side: "right" })
                        }
                        className="cursor-pointer transition-opacity hover:opacity-95"
                      >
                        <title>{rightWall ? `${rightWall.name} (Seç)` : "+ Sağ Duvar Ekle"}</title>
                        <polygon
                          points="70,10 77,10 88,43 79,43"
                          fill={wallFill(isRightSel, Boolean(rightWall))}
                          stroke={wallStroke(isRightSel, Boolean(rightWall))}
                          strokeWidth={isRightSel ? "2" : rightWall ? "1.5" : "1.2"}
                          strokeDasharray={rightWall ? undefined : "3 2"}
                          style={{ filter: wallFilter(isRightSel) }}
                          strokeLinejoin="round"
                        />
                        {!rightWall ? (
                          <g pointerEvents="none">
                            <circle cx="79" cy="26" r="5.5" fill="#0F172A" stroke="#38BDF8" strokeWidth="1.2" />
                            <path d="M79 23.4v5.2M76.4 26h5.2" stroke="#7DD3FC" strokeWidth="1.4" strokeLinecap="round" />
                          </g>
                        ) : effectiveWalls.length > 1 ? (
                          <g
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSecondaryWall(rightWall.id);
                            }}
                            className="cursor-pointer"
                          >
                            <title>Sağ Duvarı Sil</title>
                            <circle cx="85" cy="26" r="5" fill="#E11D48" stroke="#FFFFFF" strokeWidth="1" />
                            <path d="M83 24l4 4M87 24l-4 4" stroke="#FFFFFF" strokeWidth="1.25" strokeLinecap="round" />
                          </g>
                        ) : null}
                      </g>

                      {/* Ana Arka Duvar (0°) */}
                      <g
                        onClick={() =>
                          mainWall &&
                          handleSelectOrCreateDrawerWall({ kind: "existing", id: mainWall.id })
                        }
                        className="cursor-pointer transition-opacity hover:opacity-95"
                      >
                        <title>{mainWall?.name || "Ana Duvar"}</title>
                        <rect
                          x="26"
                          y="5"
                          width="44"
                          height="13"
                          rx="2.2"
                          fill={wallFill(isMainSel, true)}
                          stroke={wallStroke(isMainSel, true)}
                          strokeWidth={isMainSel ? "2" : "1.5"}
                          style={{ filter: wallFilter(isMainSel) }}
                        />
                      </g>

                      {/* Karşı Ön Duvar (180°) */}
                      <g
                        onClick={() =>
                          frontWall
                            ? handleSelectOrCreateDrawerWall({ kind: "existing", id: frontWall.id })
                            : handleSelectOrCreateDrawerWall({ kind: "create", side: "front" })
                        }
                        className="cursor-pointer transition-opacity hover:opacity-95"
                      >
                        <title>{frontWall ? `${frontWall.name} (Seç)` : "+ Karşı Duvar Ekle"}</title>
                        <rect
                          x="8"
                          y="38"
                          width="28"
                          height="9"
                          rx="1.8"
                          fill={wallFill(isFrontSel, Boolean(frontWall))}
                          stroke={wallStroke(isFrontSel, Boolean(frontWall))}
                          strokeWidth={isFrontSel ? "2" : frontWall ? "1.5" : "1.2"}
                          strokeDasharray={frontWall ? undefined : "3 2"}
                          style={{ filter: wallFilter(isFrontSel) }}
                        />
                        <rect
                          x="60"
                          y="38"
                          width="28"
                          height="9"
                          rx="1.8"
                          fill={wallFill(isFrontSel, Boolean(frontWall))}
                          stroke={wallStroke(isFrontSel, Boolean(frontWall))}
                          strokeWidth={isFrontSel ? "2" : frontWall ? "1.5" : "1.2"}
                          strokeDasharray={frontWall ? undefined : "3 2"}
                          style={{ filter: wallFilter(isFrontSel) }}
                        />
                        {!frontWall ? (
                          <g pointerEvents="none">
                            <circle cx="48" cy="42.5" r="5.5" fill="#0F172A" stroke="#38BDF8" strokeWidth="1.2" />
                            <path d="M48 39.9v5.2M45.4 42.5h5.2" stroke="#7DD3FC" strokeWidth="1.4" strokeLinecap="round" />
                          </g>
                        ) : effectiveWalls.length > 1 ? (
                          <g
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSecondaryWall(frontWall.id);
                            }}
                            className="cursor-pointer"
                          >
                            <title>Karşı Duvarı Sil</title>
                            <circle cx="48" cy="42.5" r="5" fill="#E11D48" stroke="#FFFFFF" strokeWidth="1" />
                            <path d="M46 40.5l4 4M50 40.5l-4 4" stroke="#FFFFFF" strokeWidth="1.25" strokeLinecap="round" />
                          </g>
                        ) : null}
                      </g>
                    </svg>
                    <div className="flex items-center justify-center gap-1 mt-0.5">
                      <span className="text-[9px] font-bold text-[#7DD3FC] leading-tight truncate max-w-[78px]">
                        {currentTargetWall?.name || "Ana Duvar"}
                      </span>
                      <span className="text-[8px] font-mono text-slate-300/80">
                        ({effectiveWalls.length}/4)
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Arama İkonu + Şık Arama Girişi (Mini Oda Yanında) */}
              <div className="flex-1 flex items-center gap-2 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#D6A874]/90 text-[#18181B] flex items-center justify-center shrink-0 shadow-sm">
                  <Search className="w-4 h-4" />
                </div>
                <div className="relative flex-1 min-w-0">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Modül veya eşya ara..."
                    className="w-full h-9 pl-3 pr-7 rounded-xl bg-white/[0.08] border border-white/15 text-xs text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-[#D6A874]/70"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-white text-xs cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* SEKME 1: ÜRÜN & EŞYA KATALOĞU */}
            {renderedDrawer === "catalog" && (
              <>
                <div className="px-4 pt-3 pb-2 space-y-2.5 shrink-0">
                  {/* 4 Görsel Ağırlıklı Ana Kategori Kartı (Kayarak Giden Gölgeli Seçici) */}
                  <div className="relative grid grid-cols-4 gap-1.5 p-1.5 rounded-2xl bg-slate-900/[0.07] border border-white/55 shadow-inner">
                    {!searchQuery && (
                      <span
                        aria-hidden="true"
                        style={{
                          width: "calc((100% - 12px - 18px) / 4)",
                          transform: `translate3d(calc(${Math.max(
                            0,
                            V11_CATALOG_GROUPS.findIndex((g) => g.id === activeGroup)
                          )} * (100% + 6px)), 0, 0)`,
                        }}
                        className="pointer-events-none absolute top-1.5 bottom-1.5 left-1.5 rounded-xl bg-[#18181B] shadow-[0_6px_16px_rgba(15,23,42,0.30)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                      />
                    )}
                    {V11_CATALOG_GROUPS.map((grp) => {
                      const active = !searchQuery && activeGroup === grp.id;
                      return (
                        <button
                          key={grp.id}
                          type="button"
                          onClick={() => {
                            setSearchQuery("");
                            setActiveGroup(grp.id);
                          }}
                          className={`relative z-10 py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all duration-250 cursor-pointer ${
                            active
                              ? "text-white"
                              : "bg-white/70 hover:bg-white/95 text-slate-700 hover:text-[#18181B] shadow-[0_2px_8px_rgba(15,23,42,0.08)]"
                          }`}
                        >
                          {renderPrimaryGroupVisualSvg(grp.id, active)}
                          <span className="text-[10px] font-bold leading-tight text-center">
                            {grp.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Görsel Alt Dolap / Üst Dolap / Boy / Köşe Filtre Düğmeleri (Kayarak Giden Gölgeli Seçici) */}
                  {!searchQuery && activeGroup === "kitchen" && (() => {
                    const kTabs = [
                      { id: "all", label: "Tümü" },
                      { id: "base", label: "Alt Dolap" },
                      { id: "wall", label: "Üst Dolap" },
                      { id: "tall", label: "Boy Kule" },
                      { id: "corner", label: "Köşe" },
                    ] as const;
                    const kIdx = Math.max(0, kTabs.findIndex((x) => x.id === kitchenSubFilter));
                    return (
                      <div className="relative grid grid-cols-5 gap-1 p-1 rounded-2xl bg-slate-900/[0.06] border border-white/55">
                        <span
                          aria-hidden="true"
                          style={{
                            width: "calc((100% - 8px - 16px) / 5)",
                            transform: `translate3d(calc(${kIdx} * (100% + 4px)), 0, 0)`,
                          }}
                          className="pointer-events-none absolute top-1 bottom-1 left-1 rounded-xl bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] shadow-[0_5px_16px_rgba(56,189,248,0.38)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                        />
                        {kTabs.map((sf) => {
                          const active = kitchenSubFilter === sf.id;
                          const cnt =
                            sf.id === "all"
                              ? groupBaseTemplates.length
                              : groupBaseTemplates.filter((t) => classifyKitchenSub(t) === sf.id).length;
                          return (
                            <button
                              key={sf.id}
                              type="button"
                              data-testid={`v11-kitchen-subfilter-${sf.id}`}
                              onClick={() => setKitchenSubFilter(sf.id)}
                              className={`relative z-10 py-1.5 px-1 rounded-xl flex flex-col items-center gap-0.5 transition-all duration-250 cursor-pointer ${
                                active
                                  ? "text-white"
                                  : "bg-white/75 hover:bg-white text-slate-700 shadow-[0_2px_6px_rgba(15,23,42,0.08)]"
                              }`}
                            >
                              {renderKitchenSubFilterSvg(sf.id, active)}
                              <span className="text-[9.5px] font-bold leading-none mt-0.5">{sf.label}</span>
                              <span
                                className={`text-[8.5px] font-mono ${
                                  active ? "text-slate-300" : "text-slate-500"
                                }`}
                              >
                                {cnt}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {!searchQuery && activeGroup === "wardrobe" && (() => {
                    const wTabs = [
                      { id: "all", label: "Tümü" },
                      { id: "hinged", label: "Menteşeli" },
                      { id: "sliding", label: "Sürgülü" },
                      { id: "corner_open", label: "Köşe" },
                    ] as const;
                    const wIdx = Math.max(0, wTabs.findIndex((x) => x.id === wardrobeSubFilter));
                    return (
                      <div className="relative grid grid-cols-4 gap-1.5 p-1 rounded-2xl bg-slate-900/[0.06] border border-white/55">
                        <span
                          aria-hidden="true"
                          style={{
                            width: "calc((100% - 8px - 18px) / 4)",
                            transform: `translate3d(calc(${wIdx} * (100% + 6px)), 0, 0)`,
                          }}
                          className="pointer-events-none absolute top-1 bottom-1 left-1 rounded-xl bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] shadow-[0_5px_16px_rgba(56,189,248,0.38)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                        />
                        {wTabs.map((wf) => {
                          const active = wardrobeSubFilter === wf.id;
                          const cnt =
                            wf.id === "all"
                              ? groupBaseTemplates.length
                              : groupBaseTemplates.filter((t) => classifyWardrobeSub(t) === wf.id).length;
                          return (
                            <button
                              key={wf.id}
                              type="button"
                              data-testid={`v11-wardrobe-subfilter-${wf.id}`}
                              onClick={() => setWardrobeSubFilter(wf.id)}
                              className={`relative z-10 py-1.5 px-1 rounded-xl flex flex-col items-center gap-0.5 transition-all duration-250 cursor-pointer ${
                                active
                                  ? "text-white"
                                  : "bg-white/75 hover:bg-white text-slate-700 shadow-[0_2px_6px_rgba(15,23,42,0.08)]"
                              }`}
                            >
                              {renderWardrobeSubFilterSvg(wf.id, active)}
                              <span className="text-[9.5px] font-bold leading-none mt-0.5">{wf.label}</span>
                              <span
                                className={`text-[8.5px] font-mono ${
                                  active ? "text-slate-300" : "text-slate-500"
                                }`}
                              >
                                {cnt}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

                <div className="flex-1 overflow-y-auto px-4 pb-4 pt-1 space-y-3">
                  {/* MUTFAK & ADA ÖZEL GÖRSEL HIZLI KARTLARI */}
                  {!searchQuery && activeGroup === "kitchen" && (
                    <div className="p-2.5 rounded-2xl bg-black/25 border border-white/12 space-y-2">
                      <div className="text-[11px] font-bold text-slate-100 flex items-center gap-1.5 px-0.5">
                        <UtensilsCrossed className="w-3.5 h-3.5 text-sky-300" />
                        <span>Mutfak Adası, Masa ve Hazır Setler</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          title="Şelale Tezgâhlı Ada + 0°/30°/45°/90° bağlı yemek/bar masası"
                          onClick={() => {
                            onChangeDrawer(null);
                            onOpenKitchenIslandModal();
                          }}
                          className="p-2.5 rounded-xl bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] text-white flex flex-col items-center justify-center gap-1.5 text-center shadow-[0_6px_16px_rgba(29,78,216,0.45)] transition hover:scale-[1.02] cursor-pointer"
                        >
                          <svg viewBox="0 0 88 44" className="w-20 h-10" fill="none">
                            {/* Waterfall island body */}
                            <path d="M8 14 H52 V38 H47 V19 H13 V38 H8 Z" stroke="#FFFFFF" strokeWidth="1.5" fill="rgba(255,255,255,0.22)" strokeLinejoin="round" />
                            <rect x="14" y="20" width="32" height="16" rx="1" stroke="#BAE6FD" strokeWidth="1.1" fill="rgba(186,230,253,0.14)" />
                            <line x1="30" y1="20" x2="30" y2="36" stroke="#BAE6FD" strokeWidth="1" />
                            <line x1="14" y1="28" x2="46" y2="28" stroke="#BAE6FD" strokeWidth="1" />
                            {/* Attached extending dining/bar table */}
                            <rect x="48" y="20" width="32" height="4.5" rx="1.5" stroke="#FDE68A" strokeWidth="1.4" fill="rgba(253,230,138,0.28)" />
                            <line x1="76" y1="24.5" x2="76" y2="38" stroke="#FDE68A" strokeWidth="1.8" strokeLinecap="round" />
                            <line x1="4" y1="39" x2="84" y2="39" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
                          </svg>
                          <div>
                            <div className="text-[11px] font-bold leading-tight">Şelale Ada &amp; Masa</div>
                            <div className="text-[9.5px] text-sky-200/90 mt-0.5">0°/30°/45°/90° bağlı masa</div>
                          </div>
                        </button>

                        <button
                          type="button"
                          title="180 cm ada + 80 cm indüksiyon ocak + lineer sarkıt + 3 bar taburesi"
                          onClick={() => onAddCompositeAssembly("comp_island_social_set")}
                          className="p-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] border border-white/15 text-slate-100 flex flex-col items-center justify-center gap-1.5 text-center transition hover:scale-[1.02] cursor-pointer"
                        >
                          <svg viewBox="0 0 88 44" className="w-20 h-10" fill="none">
                            {/* Linear ceiling pendant */}
                            <line x1="30" y1="2" x2="30" y2="9" stroke="#94A3B8" strokeWidth="1.1" />
                            <line x1="58" y1="2" x2="58" y2="9" stroke="#94A3B8" strokeWidth="1.1" />
                            <line x1="25" y1="9" x2="63" y2="9" stroke="#FBBF24" strokeWidth="2.2" strokeLinecap="round" />
                            {/* Island + cooktop */}
                            <rect x="14" y="18" width="60" height="19" rx="2" stroke="#E2E8F0" strokeWidth="1.4" fill="rgba(148,163,184,0.16)" />
                            <line x1="36" y1="16.5" x2="52" y2="16.5" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />
                            {/* 3 Bar stools */}
                            {[24, 44, 64].map((sx) => (
                              <g key={sx}>
                                <rect x={sx - 5} y="27" width="10" height="3.2" rx="1.2" fill="#D6A874" stroke="#FDE68A" strokeWidth="0.9" />
                                <line x1={sx - 3.5} y1="30.2" x2={sx - 4.5} y2="39" stroke="#CBD5E1" strokeWidth="1.2" strokeLinecap="round" />
                                <line x1={sx + 3.5} y1="30.2" x2={sx + 4.5} y2="39" stroke="#CBD5E1" strokeWidth="1.2" strokeLinecap="round" />
                              </g>
                            ))}
                            <line x1="6" y1="39.5" x2="82" y2="39.5" stroke="rgba(255,255,255,0.20)" strokeWidth="1" />
                          </svg>
                          <div>
                            <div className="text-[11px] font-bold leading-tight">Sosyal Ada + 3 Tabure</div>
                            <div className="text-[9.5px] text-slate-300/90 mt-0.5">180 cm + ocak + sarkıt</div>
                          </div>
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          title="Buzdolabı + Fırın/Mikrodalga Kulesi + Boy Kiler Seti"
                          onClick={() => onAddCompositeAssembly("comp_appliance_wall_trio")}
                          className="py-2 px-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.16] border border-white/15 text-slate-100 flex flex-col items-center justify-center gap-1 transition cursor-pointer"
                        >
                          <svg viewBox="0 0 54 30" className="w-12 h-7" fill="none">
                            {/* Fridge */}
                            <rect x="4" y="3" width="15" height="24" rx="1.5" stroke="#CBD5E1" strokeWidth="1.3" fill="rgba(148,163,184,0.16)" />
                            <line x1="11.5" y1="3" x2="11.5" y2="18" stroke="#94A3B8" strokeWidth="0.9" />
                            <line x1="4" y1="18" x2="19" y2="18" stroke="#94A3B8" strokeWidth="0.9" />
                            {/* Oven + MW tower */}
                            <rect x="21" y="3" width="13" height="24" rx="1.5" stroke="#E2E8F0" strokeWidth="1.3" fill="rgba(148,163,184,0.12)" />
                            <rect x="23" y="9" width="9" height="4.5" rx="0.8" fill="#0F172A" stroke="#38BDF8" strokeWidth="0.9" />
                            <rect x="23" y="15" width="9" height="6" rx="0.8" fill="#0F172A" stroke="#38BDF8" strokeWidth="0.9" />
                            {/* Pantry column */}
                            <rect x="36" y="3" width="14" height="24" rx="1.5" stroke="#CBD5E1" strokeWidth="1.3" fill="rgba(148,163,184,0.14)" />
                            <line x1="39" y1="10" x2="47" y2="10" stroke="#94A3B8" strokeWidth="0.9" />
                            <line x1="39" y1="16" x2="47" y2="16" stroke="#94A3B8" strokeWidth="0.9" />
                            <line x1="39" y1="22" x2="47" y2="22" stroke="#94A3B8" strokeWidth="0.9" />
                          </svg>
                          <span className="text-[10px] font-bold leading-tight">Ankastre Kule</span>
                        </button>

                        <button
                          type="button"
                          title="Hazır L-Tipi Köşe Mutfak Planı"
                          onClick={() => onLoadKitchenPreset("l")}
                          className="py-2 px-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.16] border border-white/15 text-slate-100 flex flex-col items-center justify-center gap-1 transition cursor-pointer"
                        >
                          <svg viewBox="0 0 54 30" className="w-12 h-7" fill="none">
                            <path d="M11 25 V5 H44" stroke="#E2E8F0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M14 8 H42 V15 H21 V24 H14 Z" stroke="#38BDF8" strokeWidth="1.3" fill="rgba(56,189,248,0.22)" strokeLinejoin="round" />
                          </svg>
                          <span className="text-[10px] font-bold leading-tight">L-Mutfak</span>
                        </button>

                        <button
                          type="button"
                          title="Hazır U-Tipi Üç Duvar Mutfak Planı"
                          onClick={() => onLoadKitchenPreset("u")}
                          className="py-2 px-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.16] border border-white/15 text-slate-100 flex flex-col items-center justify-center gap-1 transition cursor-pointer"
                        >
                          <svg viewBox="0 0 54 30" className="w-12 h-7" fill="none">
                            <path d="M9 25 V5 H45 V25" stroke="#E2E8F0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M12 8 H42 V24 H35 V15 H19 V24 H12 Z" stroke="#38BDF8" strokeWidth="1.3" fill="rgba(56,189,248,0.22)" strokeLinejoin="round" />
                          </svg>
                          <span className="text-[10px] font-bold leading-tight">U-Mutfak</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* V64 İKON AĞIRLIKLI TV, KAPSÜL, MASA & SANDALYE HIZLI KARTLARI */}
                  {!searchQuery && activeGroup === "living" && (
                    <div className="p-2.5 rounded-2xl bg-black/25 border border-white/12 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          title="Salon TV Bench + 65 inç TV Seti (240 cm gönye konsol + ekran + vitrin)"
                          onClick={() => onAddCompositeAssembly("comp_living_tv_wall_set")}
                          className="py-2.5 px-2 rounded-xl bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] text-white flex flex-col items-center justify-center gap-1.5 shadow-[0_6px_16px_rgba(29,78,216,0.45)] transition hover:scale-[1.02] cursor-pointer"
                        >
                          <svg viewBox="0 0 72 42" className="w-16 h-10" fill="none">
                            <rect x="14" y="4" width="32" height="19" rx="2" stroke="#FFFFFF" strokeWidth="1.6" fill="rgba(255,255,255,0.14)" />
                            <rect x="6" y="27" width="48" height="10" rx="2" stroke="#BAE6FD" strokeWidth="1.5" fill="rgba(186,230,253,0.18)" />
                            <line x1="22" y1="27" x2="22" y2="37" stroke="#BAE6FD" strokeWidth="1.1" />
                            <line x1="38" y1="27" x2="38" y2="37" stroke="#BAE6FD" strokeWidth="1.1" />
                            <rect x="57" y="5" width="10" height="32" rx="1.5" stroke="#E0F2FE" strokeWidth="1.3" fill="rgba(255,255,255,0.10)" />
                            <line x1="57" y1="16" x2="67" y2="16" stroke="#E0F2FE" strokeWidth="1" />
                            <line x1="57" y1="26" x2="67" y2="26" stroke="#E0F2FE" strokeWidth="1" />
                          </svg>
                          <span className="text-[11px] font-bold">TV Seti</span>
                        </button>

                        <button
                          type="button"
                          title="Özel Kapsül Masa & Tamburlu Bar Tasarla"
                          onClick={() => {
                            onChangeDrawer(null);
                            onOpenCapsuleAndGlbHub("capsule_curved");
                          }}
                          className="py-2.5 px-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] border border-white/15 text-slate-100 flex flex-col items-center justify-center gap-1.5 transition hover:scale-[1.02] cursor-pointer"
                        >
                          <svg viewBox="0 0 72 42" className="w-16 h-10" fill="none">
                            <rect x="10" y="9" width="52" height="14" rx="7" stroke="#E2E8F0" strokeWidth="1.6" fill="rgba(214,168,116,0.22)" />
                            <rect x="20" y="23" width="8" height="14" rx="3" stroke="#CBD5E1" strokeWidth="1.4" fill="rgba(148,163,184,0.18)" />
                            <rect x="44" y="23" width="8" height="14" rx="3" stroke="#CBD5E1" strokeWidth="1.4" fill="rgba(148,163,184,0.18)" />
                            <line x1="24" y1="25" x2="24" y2="35" stroke="#94A3B8" strokeWidth="1" />
                            <line x1="48" y1="25" x2="48" y2="35" stroke="#94A3B8" strokeWidth="1" />
                          </svg>
                          <span className="text-[11px] font-bold">Kapsül & Bar</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          draggable={true}
                          onDragStart={(e) => { startSceneObjectSilhouetteDrag(e, "obj_birim_dining_table_1800"); requestAnimationFrame(() => setIsDraggingCatalogItem(true)); }}
                          onDragEnd={() => { setActiveDraggedSceneCatalogId(null); setIsDraggingCatalogItem(false); }}
                          title="Masif Meşe Yemek Masası (180×90 cm) — Tıkla veya sahneye sürükle"
                          onClick={() => onAddSceneObject("obj_birim_dining_table_1800")}
                          className="py-2 px-1 rounded-xl bg-white/[0.08] hover:bg-white/[0.16] border border-white/15 text-slate-200 flex flex-col items-center justify-center gap-1 transition cursor-pointer"
                        >
                          <svg viewBox="0 0 44 28" className="w-10 h-6" fill="none">
                            <rect x="5" y="7" width="34" height="4.5" rx="1.5" stroke="#E2E8F0" strokeWidth="1.5" fill="rgba(214,168,116,0.25)" />
                            <line x1="9" y1="11.5" x2="9" y2="24" stroke="#CBD5E1" strokeWidth="1.8" strokeLinecap="round" />
                            <line x1="35" y1="11.5" x2="35" y2="24" stroke="#CBD5E1" strokeWidth="1.8" strokeLinecap="round" />
                          </svg>
                          <span className="text-[10px] font-bold">Masa</span>
                        </button>

                        <button
                          type="button"
                          draggable={true}
                          onDragStart={(e) => { startSceneObjectSilhouetteDrag(e, "obj_birim_dining_chair"); requestAnimationFrame(() => setIsDraggingCatalogItem(true)); }}
                          onDragEnd={() => { setActiveDraggedSceneCatalogId(null); setIsDraggingCatalogItem(false); }}
                          title="Yemek Sandalyesi — Tıkla veya sahneye sürükle"
                          onClick={() => onAddSceneObject("obj_birim_dining_chair")}
                          className="py-2 px-1 rounded-xl bg-white/[0.08] hover:bg-white/[0.16] border border-white/15 text-slate-200 flex flex-col items-center justify-center gap-1 transition cursor-pointer"
                        >
                          <svg viewBox="0 0 44 28" className="w-10 h-6" fill="none">
                            <path d="M15 5 V15 H29" stroke="#E2E8F0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            <line x1="15" y1="15" x2="15" y2="24" stroke="#CBD5E1" strokeWidth="1.8" strokeLinecap="round" />
                            <line x1="29" y1="15" x2="29" y2="24" stroke="#CBD5E1" strokeWidth="1.8" strokeLinecap="round" />
                          </svg>
                          <span className="text-[10px] font-bold">Sandalye</span>
                        </button>

                        <button
                          type="button"
                          draggable={true}
                          onDragStart={(e) => { startSceneObjectSilhouetteDrag(e, "obj_birim_bar_stool"); requestAnimationFrame(() => setIsDraggingCatalogItem(true)); }}
                          onDragEnd={() => { setActiveDraggedSceneCatalogId(null); setIsDraggingCatalogItem(false); }}
                          title="Bar Taburesi — Tıkla veya sahneye sürükle"
                          onClick={() => onAddSceneObject("obj_birim_bar_stool")}
                          className="py-2 px-1 rounded-xl bg-white/[0.08] hover:bg-white/[0.16] border border-white/15 text-slate-200 flex flex-col items-center justify-center gap-1 transition cursor-pointer"
                        >
                          <svg viewBox="0 0 44 28" className="w-10 h-6" fill="none">
                            <rect x="14" y="6" width="16" height="4" rx="2" stroke="#E2E8F0" strokeWidth="1.6" fill="rgba(214,168,116,0.25)" />
                            <line x1="17" y1="10" x2="15" y2="24" stroke="#CBD5E1" strokeWidth="1.6" strokeLinecap="round" />
                            <line x1="27" y1="10" x2="29" y2="24" stroke="#CBD5E1" strokeWidth="1.6" strokeLinecap="round" />
                            <line x1="16" y1="18" x2="28" y2="18" stroke="#94A3B8" strokeWidth="1.4" />
                          </svg>
                          <span className="text-[10px] font-bold">Tabure</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 3B CİHAZLAR, MASALAR VE SAHNE EŞYALARI SEKMESİ */}
                  {(activeGroup === "objects" || Boolean(searchQuery)) &&
                    filteredSceneObjects.length > 0 && (
                      <div className="space-y-2.5">
                        {!searchQuery && (
                          <div className="grid grid-cols-5 gap-1">
                            {(
                              [
                                { id: "all", label: "Tümü" },
                                { id: "appliance", label: "Cihazlar" },
                                { id: "furniture", label: "Mobilya" },
                                { id: "plants", label: "Bitkiler" },
                                { id: "decor", label: "TV & Işık" },
                              ] as const
                            ).map((flt) => {
                              const active = objectFilter === flt.id;
                              const strk = active ? "#FAF8F4" : "#292524";
                              const fill = active ? "#CFC6B8" : "#E5DDD0";
                              return (
                                <button
                                  key={flt.id}
                                  type="button"
                                  onClick={() => setObjectFilter(flt.id)}
                                  className={`py-1.5 px-1 rounded-xl border flex flex-col items-center gap-1 transition cursor-pointer ${
                                    active
                                      ? "bg-[#292524] text-white border-[#141413]"
                                      : "bg-white/90 hover:bg-white border-[#E5DFD3] text-[#44403C]"
                                  }`}
                                >
                                  <svg viewBox="0 0 28 20" className="w-6 h-4.5" fill="none" aria-hidden="true">
                                    {flt.id === "all" && (
                                      <>
                                        <rect x="4" y="3" width="8" height="14" rx="1" fill={fill} stroke={strk} strokeWidth="1.2" />
                                        <ellipse cx="19" cy="11" rx="5.5" ry="2.2" fill={fill} stroke={strk} strokeWidth="1.2" />
                                        <line x1="16" y1="13" x2="15" y2="17.5" stroke={strk} strokeWidth="1.2" />
                                        <line x1="22" y1="13" x2="23" y2="17.5" stroke={strk} strokeWidth="1.2" />
                                      </>
                                    )}
                                    {flt.id === "appliance" && (
                                      <>
                                        <rect x="7" y="2" width="14" height="16" rx="1.5" fill={fill} stroke={strk} strokeWidth="1.3" />
                                        <rect x="9.5" y="5" width="9" height="6" rx="0.8" fill="#1E293B" />
                                        <circle cx="11.5" cy="14.5" r="1" fill={strk} />
                                        <circle cx="16.5" cy="14.5" r="1" fill={strk} />
                                      </>
                                    )}
                                    {flt.id === "furniture" && (
                                      <>
                                        <ellipse cx="14" cy="9.5" rx="9" ry="3.2" fill={fill} stroke={strk} strokeWidth="1.3" />
                                        <line x1="8" y1="12" x2="7" y2="18" stroke={strk} strokeWidth="1.3" strokeLinecap="round" />
                                        <line x1="20" y1="12" x2="21" y2="18" stroke={strk} strokeWidth="1.3" strokeLinecap="round" />
                                      </>
                                    )}
                                    {flt.id === "plants" && (
                                      <>
                                        <polygon points="10,13 18,13 16.5,18.5 11.5,18.5" fill={fill} stroke={strk} strokeWidth="1.2" />
                                        <path d="M14 13V6M14 9c-3-3-5.5-2-5.5 0.5S12 11 14 10M14 8c3-3 5.5-2 5.5 0.5S16 10 14 9" stroke={strk} strokeWidth="1.25" strokeLinecap="round" />
                                      </>
                                    )}
                                    {flt.id === "decor" && (
                                      <>
                                        <line x1="14" y1="2" x2="14" y2="8" stroke={strk} strokeWidth="1.2" />
                                        <path d="M9 12a5 4 0 0 1 10 0H9z" fill="#FDE68A" stroke={strk} strokeWidth="1.2" />
                                        <circle cx="14" cy="13.5" r="1.4" fill="#F59E0B" />
                                      </>
                                    )}
                                  </svg>
                                  <span className="text-[9.5px] font-bold leading-none">{flt.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {searchQuery && (
                          <div className="text-[11px] font-bold text-[#78716C] pt-1">
                            3B Cihazlar, Masalar ve Mekân Eşyaları
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2.5">
                          {filteredSceneObjects.map((obj) => (
                            <div
                              key={obj.catalogId}
                              draggable={true}
                              onDragStart={(e) => {
                                startSceneObjectSilhouetteDrag(e, obj.catalogId);
                                requestAnimationFrame(() => setIsDraggingCatalogItem(true));
                              }}
                              onDragEnd={() => {
                                setActiveDraggedSceneCatalogId(null);
                                setIsDraggingCatalogItem(false);
                              }}
                              title="Sahneye sürükleyip bırakın veya tıklayarak ekleyin"
                              className="group relative p-3 rounded-2xl bg-white/90 hover:bg-white border border-[#E5DFD3] hover:border-[#141413]/40 flex flex-col justify-between gap-2 transition shadow-2xs cursor-grab active:cursor-grabbing"
                            >
                              <span className="absolute top-4 right-4 z-10 px-1.5 py-0.5 rounded-md bg-[#141413]/75 text-white text-[9px] font-semibold opacity-0 group-hover:opacity-100 transition pointer-events-none">
                                ⠿ Sürükle
                              </span>
                              <button
                                type="button"
                                draggable={false}
                                onClick={() => onAddSceneObject(obj.catalogId)}
                                className="w-full text-left flex flex-col cursor-pointer"
                              >
                                <div className="w-full h-24 rounded-xl bg-[#F6F3EC] flex items-center justify-center mb-2 overflow-hidden p-1.5 pointer-events-none">
                                  <SceneObjectThumbnail item={obj} />
                                </div>
                                <div className="text-xs font-semibold text-[#141413] leading-snug line-clamp-2">
                                  {obj.name}
                                </div>
                                <div className="text-[10px] font-mono text-[#78716C] mt-0.5">
                                  {fmtLen(obj.defaultDimensions.width, false)}×{fmtLen(obj.defaultDimensions.depth)}
                                </div>
                              </button>
                              <button
                                type="button"
                                draggable={false}
                                onClick={() => onAddSceneObject(obj.catalogId)}
                                className="w-full h-7 rounded-full bg-[#141413] hover:bg-[#292524] text-white text-[10.5px] font-semibold flex items-center justify-center gap-1 cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Sahneye Ekle</span>
                              </button>
                            </div>
                          ))}
                        </div>

                        {!searchQuery && (
                          <button
                            type="button"
                            onClick={() => {
                              onChangeDrawer(null);
                              onOpenCapsuleAndGlbHub("custom_glb");
                            }}
                            className="w-full py-2.5 px-3.5 rounded-2xl bg-white hover:bg-[#EFECE4] border border-[#DED8CC] text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Box className="w-3.5 h-3.5 text-[#8C7A6B]" />
                            <span>+ Dışarıdan Özel 3B Model (.GLB) Yükle</span>
                          </button>
                        )}
                      </div>
                    )}

                  {/* PARAMETRİK MODÜL KARTLARI — 3B & 2B Mıknatıslı Sürükle-Bırak Destekli */}
                  {(activeGroup !== "objects" || Boolean(searchQuery)) &&
                    filteredTemplates.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between px-1 text-[10px] text-[#78716C]">
                          <span></span>
                          <span className="font-mono font-semibold text-[#57534E]">
                            {filteredTemplates.length} model
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2.5 content-start">
                          {filteredTemplates.map((tpl) => {
                            const minVal = fmtLen(tpl.dimensionLimits.minW, false);
                            const maxVal = fmtLen(tpl.dimensionLimits.maxW, false);
                            const isKitchenTpl =
                              tpl.familyId === "fam_kitchen_base" ||
                              tpl.familyId === "fam_kitchen_wall" ||
                              tpl.familyId === "fam_kitchen_tall" ||
                              (tpl.familyId as string) === "fam_kitchen_island" ||
                              tpl.templateId.includes("kitchen");
                            const kSub = isKitchenTpl ? classifyKitchenSub(tpl) : null;
                            const isWallUpper =
                              kSub === "wall" || tpl.familyId === "fam_kitchen_wall";
                            const kitchenBadge =
                              kSub === "wall"
                                ? {
                                    label: "⬆ ÜST DOLAP",
                                    cls: "bg-violet-500/30 border-violet-400/80 text-violet-100",
                                    cardRing: "border-violet-400/40",
                                  }
                                : kSub === "base"
                                ? {
                                    label: "⬇ ALT DOLAP",
                                    cls: "bg-sky-500/28 border-sky-400/80 text-sky-100",
                                    cardRing: "border-sky-400/40",
                                  }
                                : kSub === "tall"
                                ? {
                                    label: "↕ BOY KULE",
                                    cls: "bg-amber-500/28 border-amber-400/80 text-amber-100",
                                    cardRing: "border-amber-400/40",
                                  }
                                : kSub === "corner"
                                ? {
                                    label: "◢ KÖŞE DOLAP",
                                    cls: "bg-emerald-500/28 border-emerald-400/80 text-emerald-100",
                                    cardRing: "border-emerald-400/40",
                                  }
                                : null;

                            return (
                              <div
                                key={tpl.templateId}
                                data-testid={`v11-tpl-${tpl.templateId}`}
                                draggable={true}
                                onDragStart={(e) => {
                                  startModuleSilhouetteDrag(e, tpl.templateId);
                                  requestAnimationFrame(() => setIsDraggingCatalogItem(true));
                                }}
                                onDragEnd={() => {
                                  setActiveDraggedTemplateId(null);
                                  setIsDraggingCatalogItem(false);
                                }}
                                title="3B sahneye veya 2B plana sürükleyip bırakın (mıknatıslı hizalama aktif)"
                                className={`group relative rounded-2xl bg-white/90 hover:bg-white border p-2.5 flex flex-col justify-between transition shadow-[0_10px_24px_rgba(0,0,0,0.30)] hover:shadow-[0_14px_30px_rgba(0,0,0,0.42)] cursor-grab active:cursor-grabbing ${
                                  kitchenBadge ? kitchenBadge.cardRing : "border-[#E5DFD3]"
                                }`}
                              >
                                {kitchenBadge ? (
                                  <span
                                    className={`absolute top-3.5 left-3.5 z-10 px-2 py-0.5 rounded-md border text-[9.5px] font-extrabold tracking-wide backdrop-blur-md shadow-sm pointer-events-none ${kitchenBadge.cls}`}
                                  >
                                    {kitchenBadge.label}
                                  </span>
                                ) : (
                                  <span className="absolute top-3.5 left-3.5 z-10 px-2 py-0.5 rounded-md bg-black/55 border border-white/25 text-slate-100 text-[9px] font-bold backdrop-blur-md shadow-sm pointer-events-none">
                                    {tpl.name.toLowerCase().includes("sürgü") || tpl.templateId.includes("sliding")
                                      ? "↔ Sürgülü"
                                      : tpl.name.toLowerCase().includes("açık") || tpl.templateId.includes("open")
                                      ? "▦ Açık Raf"
                                      : "▯ Menteşeli"}
                                  </span>
                                )}
                                <span title="Sürükleyip sahneye bırak" className="absolute top-3 right-3 z-10 w-6 h-6 rounded-lg bg-black/65 border border-white/20 text-white text-xs font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition pointer-events-none">
                                  ⠿
                                </span>
                                <button
                                  type="button"
                                  draggable={false}
                                  onClick={() => onApplyTemplateToActive(tpl.templateId)}
                                  className="w-full text-left flex flex-col items-center cursor-pointer"
                                >
                                  {/* REAL 3D PBR ARCHITECTURAL SHOWROOM RENDER THUMBNAIL */}
                                  <V3StudioModuleThumbnail template={tpl} isWallUpper={isWallUpper} />
                                  <div className="w-full text-xs font-bold text-[#141413] leading-snug line-clamp-2">
                                    {tpl.name}
                                  </div>
                                  <div className="w-full text-[10.5px] font-mono text-[#78716C] mt-0.5">
                                    {minVal === maxVal ? `${minVal} ${displayUnit}` : `${minVal}–${maxVal} ${displayUnit}`}
                                  </div>
                                </button>

                                {/* V89 KAPSÜL DÜĞME BAR: [ ← ]  ( 🔀 )  [ → ] */}
                                <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between gap-1.5">
                                  <button
                                    type="button"
                                    draggable={false}
                                    data-testid={`v40-add-left-${tpl.templateId}`}
                                    onClick={() => onAppendTemplateAdjacent(tpl.templateId, "left")}
                                    title="Seçili modülün SOL tarafına ekle"
                                    className="flex-1 h-9 rounded-full bg-gradient-to-b from-[#444C5C] to-[#2C3341] hover:from-[#525B6E] hover:to-[#353E4F] hover:scale-[1.03] active:scale-95 text-slate-100 leading-none flex items-center justify-center border border-white/15 shadow-[0_6px_14px_rgba(0,0,0,0.42),inset_0_1px_0.5px_rgba(255,255,255,0.22)] transition cursor-pointer"
                                  >
                                    <ArrowLeft className="w-[16px] h-[16px] stroke-[2.35] block" />
                                  </button>
                                  <button
                                    type="button"
                                    draggable={false}
                                    onClick={() => onApplyTemplateToActive(tpl.templateId)}
                                    title="Seçili mevcut modülü bu modelle değiştir"
                                    className="w-11 h-9 rounded-full bg-gradient-to-b from-[#343B49] to-[#1F2531] hover:from-[#3F4758] hover:to-[#272F3E] hover:scale-105 active:scale-95 border-[1.5px] border-[#C99F78]/85 text-[#E4BC96] leading-none flex items-center justify-center shadow-[0_0_14px_rgba(201,159,120,0.42),0_6px_14px_rgba(0,0,0,0.48),inset_0_1px_0.5px_rgba(255,255,255,0.18)] transition cursor-pointer shrink-0"
                                  >
                                    <Shuffle className="w-[15px] h-[15px] stroke-[2.25] block" />
                                  </button>
                                  {isWallUpper && (
                                    <button
                                      type="button"
                                      draggable={false}
                                      data-testid={`v40-add-above-${tpl.templateId}`}
                                      onClick={() => onAppendTemplateAdjacent(tpl.templateId, "above")}
                                      title="Seçili alt dolabın ÜSTÜNE (145 cm duvar kotuna) ekle"
                                      className="w-9 h-9 rounded-full bg-gradient-to-b from-[#444C5C] to-[#2C3341] hover:from-violet-600 hover:to-indigo-700 hover:scale-105 active:scale-95 border border-violet-300/45 text-violet-200 leading-none flex items-center justify-center shadow-[0_6px_14px_rgba(0,0,0,0.42),inset_0_1px_0.5px_rgba(255,255,255,0.2)] transition cursor-pointer shrink-0"
                                    >
                                      <ArrowUp className="w-[15px] h-[15px] stroke-[2.35] block" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    draggable={false}
                                    data-testid={`v40-add-right-${tpl.templateId}`}
                                    onClick={() => onAppendTemplateAdjacent(tpl.templateId, "right")}
                                    title="Seçili modülün SAĞ tarafına ekle"
                                    className="flex-1 h-9 rounded-full bg-gradient-to-b from-[#444C5C] to-[#2C3341] hover:from-[#525B6E] hover:to-[#353E4F] hover:scale-[1.03] active:scale-95 text-slate-100 leading-none flex items-center justify-center border border-white/15 shadow-[0_6px_14px_rgba(0,0,0,0.42),inset_0_1px_0.5px_rgba(255,255,255,0.22)] transition cursor-pointer"
                                  >
                                    <ArrowRight className="w-[16px] h-[16px] stroke-[2.35] block" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                </div>
              </>
            )}

            {/* SEKME 2: SAHNEDEKİ MODÜLLER & EŞYALAR */}
            {renderedDrawer === "modules" && (
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={onDuplicateActiveModule}
                    className="h-10 px-3 rounded-2xl bg-white hover:bg-[#EFECE4] border border-[#DED8CC] text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5 text-[#57534E]" />
                    <span>Yanına Kopyala</span>
                  </button>
                  <button
                    type="button"
                    onClick={onAddStackedTopModule}
                    className="h-10 px-3 rounded-2xl bg-white hover:bg-[#EFECE4] border border-[#DED8CC] text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <ArrowUpFromLine className="w-3.5 h-3.5 text-[#57534E]" />
                    <span>Üst Yüklük Ekle</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      onChangeDrawer(null);
                      onOpenWizardModal();
                    }}
                    className="py-2 px-2.5 rounded-xl bg-[#141413] hover:bg-[#292524] text-white text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Yeni Modül / Sihirbaz</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onChangeDrawer(null);
                      onOpenCapsuleAndGlbHub("automation");
                    }}
                    className="py-2 px-2.5 rounded-xl bg-white hover:bg-[#F5F2EA] border border-[#DED8CC] text-[#141413] text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Oda Planı / LiDAR Yükle</span>
                  </button>
                </div>

                {remainingWallGapMm >= 350 && (
                  <button
                    type="button"
                    onClick={onFillRemainingWallGap}
                    className="w-full py-2.5 px-3.5 rounded-2xl bg-[#141413] hover:bg-[#292524] text-white text-xs font-semibold flex items-center justify-between transition cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Maximize2 className="w-3.5 h-3.5 text-[#7DD3FC]" />
                      <span>Kalan Boşluğu Dolapla Tamamla</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-white/15 font-mono text-[11px]">
                      +{fmtLen(remainingWallGapMm)}
                    </span>
                  </button>
                )}

                <div className="space-y-2 pt-1">
                  <div className="text-[11px] font-bold text-[#78716C]">
                    Dolap & Modüller ({mainModules.length})
                  </div>
                  {mainModules.map(({ mod, idx }, order) => {
                    const isSelected = idx === activeModuleIndex;
                    return (
                      <div
                        key={mod.id}
                        onClick={() => onSelectModuleIndex(idx)}
                        className={`p-3 rounded-2xl border flex items-center justify-between gap-2.5 transition cursor-pointer ${
                          isSelected
                            ? "bg-[#141413] text-white border-[#141413] shadow-sm"
                            : "bg-white hover:bg-[#F5F2EA] text-[#141413] border-[#E5DFD3]"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold truncate">
                            {order + 1}. {mod.name}
                          </div>
                          <div
                            className={`text-[11px] font-mono mt-0.5 ${
                              isSelected ? "text-[#7DD3FC]" : "text-[#78716C]"
                            }`}
                          >
                            {fmtLen(mod.dimensions.width, false)} × {fmtLen(mod.dimensions.height, false)} × {fmtLen(mod.dimensions.depth)} • {mod.bays.length} Bölme
                          </div>
                        </div>
                        {mainModules.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveModuleAt(idx);
                            }}
                            title="Bu modülü sil"
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition cursor-pointer ${
                              isSelected
                                ? "hover:bg-white/15 text-stone-300 hover:text-white"
                                : "hover:bg-red-50 text-[#78716C] hover:text-red-600"
                            }`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {modules.some((m) => m.category === "complementary") && (
                  <div className="space-y-1.5 pt-2 border-t border-[#E6E1D6]">
                    <div className="text-[11px] font-bold text-[#78716C]">
                      Kör Paneller &amp; Tamamlayıcı Parçalar ({modules.filter((m) => m.category === "complementary").length})
                    </div>
                    {modules.map((mod, idx) => {
                      if (mod.category !== "complementary") return null;
                      const isSelected = idx === activeModuleIndex;
                      return (
                        <div
                          key={mod.id}
                          onClick={() => onSelectModuleIndex(idx)}
                          className={`p-2.5 rounded-2xl border flex items-center justify-between gap-2 transition cursor-pointer ${
                            isSelected
                              ? "bg-[#141413] text-white border-[#141413]"
                              : "bg-white hover:bg-[#F5F2EA] text-[#141413] border-[#E5DFD3]"
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-bold truncate">{mod.name}</div>
                            <div className={`text-[10.5px] font-mono ${isSelected ? "text-[#7DD3FC]" : "text-[#78716C]"}`}>
                              {fmtLen(mod.dimensions.width, false)} × {fmtLen(mod.dimensions.height, false)} × {fmtLen(mod.dimensions.depth)}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveModuleAt(idx);
                            }}
                            title="Bu kör paneli / tamamlayıcı parçayı sil"
                            className={`w-7 h-7 rounded-full flex items-center justify-center transition cursor-pointer ${
                              isSelected
                                ? "hover:bg-white/15 text-stone-300 hover:text-white"
                                : "hover:bg-red-50 text-[#78716C] hover:text-red-600"
                            }`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {sceneObjects.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-[#E6E1D6]">
                    <div className="text-[11px] font-bold text-[#78716C] flex items-center gap-1.5">
                      <Armchair className="w-3.5 h-3.5" />
                      <span>Sahnedeki Masalar, Cihazlar ve Eşyalar ({sceneObjects.length})</span>
                    </div>
                    {sceneObjects.map((so) => (
                      <div
                        key={so.id}
                        className="p-2.5 rounded-2xl bg-white border border-[#E5DFD3] flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{so.name}</div>
                          <div className="text-[10.5px] font-mono text-[#78716C]">
                            {fmtLen(so.dimensions.width, false)}×{fmtLen(so.dimensions.depth)}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => onRotateSceneObject(so.id)}
                            title="90° Döndür"
                            className="w-7 h-7 rounded-full hover:bg-[#EFECE4] flex items-center justify-center cursor-pointer"
                          >
                            <RotateCw className="w-3.5 h-3.5 text-[#57534E]" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onRemoveSceneObject(so.id)}
                            title="Sahne eşyasını kaldır"
                            className="w-7 h-7 rounded-full hover:bg-red-50 text-[#78716C] hover:text-red-600 flex items-center justify-center cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* SEKME 3: ODA ÖLÇÜLERİ, HAZIR MUTFAK PLANLARI, ADA & ENGELLER */}
            {renderedDrawer === "space" && (
              <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
                <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] space-y-3">
                  <div className="font-bold text-[#141413]">Oda Duvar ve Tavan Ölçüleri</div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[#57534E]">Duvar Genişliği</span>
                      <span className="font-mono font-bold">
                        {fmtLen(wallWidthMm)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1200}
                      max={6000}
                      step={50}
                      value={wallWidthMm}
                      onChange={(e) =>
                        onSetRoomDimensions(Number(e.target.value), ceilingHeightMm)
                      }
                      className="w-full accent-[#141413] cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[#57534E]">Tavan Yüksekliği</span>
                      <span className="font-mono font-bold">
                        {fmtLen(ceilingHeightMm)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={2100}
                      max={3400}
                      step={20}
                      value={ceilingHeightMm}
                      onChange={(e) =>
                        onSetRoomDimensions(wallWidthMm, Number(e.target.value))
                      }
                      className="w-full accent-[#141413] cursor-pointer"
                    />
                  </div>
                </div>

                {/* V102: Duvar Süpürgeliği Ayarları + Canlı Çakışma Uyarısı */}
                {(() => {
                  const sk = storeProject.space?.skirtingConfig;
                  const skEnabled = sk ? sk.enabled !== false : true;
                  const skH = sk?.heightMm ?? 114;
                  const skT = sk?.thicknessMm ?? 16;
                  const skColor = sk?.colorHex || "#F1EFEA";
                  const updateSkirting = (patch: Partial<{ enabled: boolean; heightMm: number; thicknessMm: number; colorHex: string }>) => {
                    const st = useConfiguratorStore.getState();
                    st.applyBatchProjectUpdate((draft) => {
                      const prev = draft.space.skirtingConfig || {
                        enabled: true,
                        heightMm: 114,
                        thicknessMm: 16,
                        colorHex: "#F1EFEA",
                      };
                      draft.space.skirtingConfig = { ...prev, ...patch };
                    }, "Duvar süpürgeliği güncellendi");
                  };
                  const clashingMods = skEnabled
                    ? mainModules.filter((m) => (m.mod.position?.y || 0) < skH && (m.mod.position?.z || 0) < skT - 1)
                    : [];
                  return (
                    <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-bold text-[#141413]">Duvar Süpürgeliği</div>
                        <button
                          type="button"
                          onClick={() => updateSkirting({ enabled: !skEnabled })}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition cursor-pointer ${
                            skEnabled
                              ? "bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] text-white shadow-xs"
                              : "bg-white/[0.10] text-slate-300 border border-white/15"
                          }`}
                        >
                          {skEnabled ? "Var (Açık)" : "Yok (Kapalı)"}
                        </button>
                      </div>

                      {skEnabled && (
                        <>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-[#57534E]">Süpürgelik Yüksekliği</span>
                              <span className="font-mono font-bold">{fmtLen(skH)}</span>
                            </div>
                            <input
                              type="range"
                              min={60}
                              max={200}
                              step={5}
                              value={skH}
                              onChange={(e) => updateSkirting({ heightMm: Number(e.target.value) })}
                              className="w-full accent-[#0284C7] cursor-pointer"
                            />
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-[#57534E]">Süpürgelik Kalınlığı</span>
                              <span className="font-mono font-bold">{fmtLen(skT)}</span>
                            </div>
                            <input
                              type="range"
                              min={10}
                              max={30}
                              step={2}
                              value={skT}
                              onChange={(e) => updateSkirting({ thicknessMm: Number(e.target.value) })}
                              className="w-full accent-[#0284C7] cursor-pointer"
                            />
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-0.5">
                            <span className="text-[11px] text-[#57534E]">Renk</span>
                            <div className="flex items-center gap-1.5">
                              {[
                                { hex: "#F1EFEA", label: "Kırık Beyaz" },
                                { hex: "#CBD5E1", label: "Açık Gri" },
                                { hex: "#B08968", label: "Doğal Meşe" },
                                { hex: "#27272A", label: "Antrasit" },
                              ].map((sw) => (
                                <button
                                  key={sw.hex}
                                  type="button"
                                  title={sw.label}
                                  onClick={() => updateSkirting({ colorHex: sw.hex })}
                                  style={{ backgroundColor: sw.hex }}
                                  className={`w-6 h-6 rounded-full border-2 transition cursor-pointer ${
                                    skColor.toLowerCase() === sw.hex.toLowerCase()
                                      ? "border-[#38BDF8] scale-110 shadow-[0_0_8px_rgba(56,189,248,0.65)]"
                                      : "border-white/30 hover:scale-105"
                                  }`}
                                />
                              ))}
                            </div>
                          </div>

                          {clashingMods.length > 0 && (
                            <div className="p-2.5 rounded-xl bg-amber-500/18 border border-amber-400/45 text-amber-100 space-y-1.5">
                              <div className="text-[11px] font-bold flex items-center gap-1.5">
                                <span>⚠️ Süpürgelik Çakışması ({clashingMods.length} dolap)</span>
                              </div>
                              <p className="text-[10px] leading-snug opacity-90">
                                Zemin dolapları {skH}×{skT} mm duvar süpürgeliği ile kesişiyor.
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  const st = useConfiguratorStore.getState();
                                  st.applyBatchProjectUpdate((draft) => {
                                    draft.modules.forEach((m) => {
                                      if (m.category !== "complementary" && (m.position?.y || 0) < skH && (m.position?.z || 0) < skT) {
                                        m.position.z = skT;
                                      }
                                    });
                                  }, "Dolaplar süpürgelik kadar öne alındı");
                                }}
                                className="w-full py-1.5 px-2.5 rounded-lg bg-amber-500/30 hover:bg-amber-500/45 border border-amber-300/50 text-white text-[10.5px] font-bold transition cursor-pointer"
                              >
                                Dolapları +{skT} mm Öne Al (Çakışmayı Gider)
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })()}

                {/* Hazır Mutfak Planları */}
                <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] space-y-2.5">
                  <div className="font-bold text-[#141413]">Hazır Mutfak Yerleşimleri</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => onLoadKitchenPreset("linear")}
                      className="py-2 px-2 rounded-xl bg-[#F5F2EA] hover:bg-[#EAE4D7] font-semibold cursor-pointer"
                    >
                      Düz Mutfak
                    </button>
                    <button
                      type="button"
                      onClick={() => onLoadKitchenPreset("l")}
                      className="py-2 px-2 rounded-xl bg-[#F5F2EA] hover:bg-[#EAE4D7] font-semibold cursor-pointer"
                    >
                      L-Tipi Mutfak
                    </button>
                    <button
                      type="button"
                      onClick={() => onLoadKitchenPreset("u")}
                      className="py-2 px-2 rounded-xl bg-[#F5F2EA] hover:bg-[#EAE4D7] font-semibold cursor-pointer"
                    >
                      U-Tipi Mutfak
                    </button>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-bold text-[#141413]">Mimari Eleman Ekle</div>
                    {spaceWalls.length >= 1 && (
                      <PremiumSelect
                        ariaLabel="Hedef Duvar Seçimi"
                        title="Mimari elemanın ekleneceği duvarı seçin"
                        value={
                          spaceWalls.some((w) => w.id === activeWallId)
                            ? activeWallId || spaceWalls[0].id
                            : spaceWalls[0].id
                        }
                        options={spaceWalls.map((w) => ({
                          value: w.id,
                          label: w.name,
                          hint: `${Math.round(w.rotationY || 0)}°`,
                        }))}
                        onChange={(val) => setActiveWallId(val)}
                        menuWidthClass="min-w-[185px]"
                      />
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        {
                          type: "window" as const,
                          label: "Pencere",
                          name: "Pencere",
                          w: 900,
                          h: 1200,
                          d: 180,
                          y: 900,
                          svg: (
                            <svg viewBox="0 0 40 32" className="w-10 h-8" fill="none">
                              <rect x="6" y="4" width="28" height="24" rx="2" fill="#1E293B" stroke="#7DD3FC" strokeWidth="1.6" />
                              <rect x="9" y="7" width="10" height="18" rx="1" fill="#38BDF8" fillOpacity="0.28" stroke="#BAE6FD" strokeWidth="1.1" />
                              <rect x="21" y="7" width="10" height="18" rx="1" fill="#38BDF8" fillOpacity="0.28" stroke="#BAE6FD" strokeWidth="1.1" />
                              <line x1="4" y1="28.5" x2="36" y2="28.5" stroke="#E2E8F0" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                          ),
                        },
                        {
                          type: "column" as const,
                          label: "Kolon",
                          name: "Kolon",
                          w: 300,
                          h: ceilingHeightMm,
                          d: 300,
                          y: 0,
                          svg: (
                            <svg viewBox="0 0 40 32" className="w-10 h-8" fill="none">
                              <polygon points="12,5 24,5 28,8 28,27 16,27 12,24" fill="#334155" stroke="#CBD5E1" strokeWidth="1.5" strokeLinejoin="round" />
                              <rect x="12" y="5" width="12" height="22" fill="#475569" stroke="#F1F5F9" strokeWidth="1.4" />
                              <line x1="15" y1="9" x2="21" y2="15" stroke="#94A3B8" strokeWidth="1.1" />
                              <line x1="15" y1="15" x2="21" y2="21" stroke="#94A3B8" strokeWidth="1.1" />
                            </svg>
                          ),
                        },
                        {
                          type: "door" as const,
                          label: "Kapı",
                          name: "Oda Kapısı",
                          w: 900,
                          h: 2100,
                          d: 120,
                          y: 0,
                          svg: (
                            <svg viewBox="0 0 40 32" className="w-10 h-8" fill="none">
                              <rect x="10" y="3" width="20" height="26" rx="1.5" fill="#78350F" fillOpacity="0.65" stroke="#FCD34D" strokeWidth="1.5" />
                              <rect x="13" y="6" width="14" height="9" rx="1" stroke="#FDE68A" strokeWidth="1" opacity="0.7" />
                              <rect x="13" y="17" width="14" height="8" rx="1" stroke="#FDE68A" strokeWidth="1" opacity="0.7" />
                              <circle cx="26.5" cy="16" r="1.6" fill="#FBBF24" />
                            </svg>
                          ),
                        },
                        {
                          type: "beam" as const,
                          label: "Kiriş",
                          name: "Tavan Kirişi",
                          w: 1200,
                          h: 320,
                          d: 260,
                          y: Math.max(1800, ceilingHeightMm - 320),
                          svg: (
                            <svg viewBox="0 0 40 32" className="w-10 h-8" fill="none">
                              <rect x="4" y="5" width="32" height="10" rx="1.5" fill="#475569" stroke="#CBD5E1" strokeWidth="1.5" />
                              <line x1="8" y1="15" x2="14" y2="5" stroke="#94A3B8" strokeWidth="1.1" />
                              <line x1="17" y1="15" x2="23" y2="5" stroke="#94A3B8" strokeWidth="1.1" />
                              <line x1="26" y1="15" x2="32" y2="5" stroke="#94A3B8" strokeWidth="1.1" />
                              <line x1="4" y1="26" x2="36" y2="26" stroke="#64748B" strokeWidth="1.2" strokeDasharray="3 2" />
                            </svg>
                          ),
                        },
                        {
                          type: "plumbing" as const,
                          label: "Tesisat",
                          name: "Su Tesisatı",
                          w: 220,
                          h: 220,
                          d: 80,
                          y: 550,
                          svg: (
                            <svg viewBox="0 0 40 32" className="w-10 h-8" fill="none">
                              <circle cx="14" cy="14" r="5" fill="#0284C7" fillOpacity="0.35" stroke="#38BDF8" strokeWidth="1.6" />
                              <circle cx="26" cy="14" r="5" fill="#DC2626" fillOpacity="0.35" stroke="#FCA5A5" strokeWidth="1.6" />
                              <circle cx="20" cy="24" r="4" fill="#334155" stroke="#CBD5E1" strokeWidth="1.5" />
                            </svg>
                          ),
                        },
                        {
                          type: "electrical" as const,
                          label: "Priz",
                          name: "Elektrik Prizi",
                          w: 160,
                          h: 90,
                          d: 40,
                          y: 1100,
                          svg: (
                            <svg viewBox="0 0 40 32" className="w-10 h-8" fill="none">
                              <rect x="7" y="8" width="26" height="16" rx="3" fill="#1E293B" stroke="#FBBF24" strokeWidth="1.5" />
                              <circle cx="20" cy="16" r="5" stroke="#FDE68A" strokeWidth="1.2" />
                              <circle cx="18" cy="16" r="1.2" fill="#FEF08A" />
                              <circle cx="22" cy="16" r="1.2" fill="#FEF08A" />
                            </svg>
                          ),
                        },
                      ]
                    ).map((item) => {
                      const chosenWallId = spaceWalls.some((w) => w.id === activeWallId)
                        ? activeWallId || spaceWalls[0]?.id
                        : spaceWalls[0]?.id;
                      return (
                        <button
                          key={item.type}
                          type="button"
                          onClick={() =>
                            placeOnSelectedWall(
                              item.type,
                              item.name,
                              item.w,
                              item.h,
                              item.d,
                              item.y,
                              chosenWallId
                            )
                          }
                          className="py-2 px-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.16] border border-white/15 flex flex-col items-center justify-center gap-1 transition cursor-pointer"
                        >
                          {item.svg}
                          <span className="text-[10.5px] font-semibold leading-none">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {obstacles.length > 0 && (
                    <div className="pt-2 space-y-1.5 border-t border-[#F0ECE3]">
                      {obstacles.map((obs) => (
                        <div
                          key={obs.id}
                          className="flex flex-col gap-1.5 px-2.5 py-2 rounded-xl bg-[#FAF8F4] border border-[#EAE4D8]"
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="font-semibold text-[#141413] truncate">
                              {obs.name || obs.type} ({fmtLen(obs.dimensions.width, false)}×{fmtLen(obs.dimensions.height)})
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              {(obs.type === "door" || obs.type === "window") && (
                                <button
                                  type="button"
                                  title="Kanat / Menteşe Yönünü Aynala (Sol ↔ Sağ)"
                                  onClick={() =>
                                    updateSpaceObstacleStore(obs.id, {
                                      doorSwing: obs.doorSwing === "right" ? "left" : "right",
                                    })
                                  }
                                  className="px-1.5 py-0.5 rounded-md bg-white border border-[#DED8CC] hover:bg-[#EFECE4] text-[10px] font-bold text-[#141413] cursor-pointer"
                                >
                                  ⇄ {obs.doorSwing === "right" ? "Sağ" : "Sol"}
                                </button>
                              )}
                              {obs.type === "door" && (
                                <button
                                  type="button"
                                  title="İçe / Dışa Açılımı Aynala"
                                  onClick={() =>
                                    updateSpaceObstacleStore(obs.id, {
                                      doorOpenSide: obs.doorOpenSide === "outward" ? "inward" : "outward",
                                    })
                                  }
                                  className="px-1.5 py-0.5 rounded-md bg-white border border-[#DED8CC] hover:bg-[#EFECE4] text-[10px] font-bold text-[#141413] cursor-pointer"
                                >
                                  ⇅ {obs.doorOpenSide === "outward" ? "Dışa" : "İçe"}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => onRemoveSpaceObstacle(obs.id)}
                                className="w-6 h-6 rounded-full hover:bg-red-50 text-[#78716C] hover:text-red-600 flex items-center justify-center cursor-pointer"
                              >
                                ✕
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                            <label className="space-y-0.5">
                              <span className="text-[#78716C] block">En (mm)</span>
                              <input
                                type="number" inputMode="decimal"
                                min={40}
                                max={6000}
                                step={10}
                                value={Math.round(obs.dimensions.width)}
                                onChange={(e) => {
                                  const w = Math.max(40, Math.min(6000, Number(e.target.value) || obs.dimensions.width));
                                  updateSpaceObstacleStore(obs.id, {
                                    dimensions: { ...obs.dimensions, width: w },
                                  });
                                }}
                                className="w-full h-6 px-1.5 rounded-md bg-white border border-[#DED8CC] font-mono text-[10.5px] text-[#141413]"
                              />
                            </label>
                            <label className="space-y-0.5">
                              <span className="text-[#78716C] block">Boy (mm)</span>
                              <input
                                type="number" inputMode="decimal"
                                min={40}
                                max={4000}
                                step={10}
                                value={Math.round(obs.dimensions.height)}
                                onChange={(e) => {
                                  const h = Math.max(40, Math.min(4000, Number(e.target.value) || obs.dimensions.height));
                                  updateSpaceObstacleStore(obs.id, {
                                    dimensions: { ...obs.dimensions, height: h },
                                  });
                                }}
                                className="w-full h-6 px-1.5 rounded-md bg-white border border-[#DED8CC] font-mono text-[10.5px] text-[#141413]"
                              />
                            </label>
                            <label className="space-y-0.5">
                              <span className="text-[#78716C] block" title="Zeminden yükseklik (Kot)">Yerden (mm)</span>
                              <input
                                type="number" inputMode="decimal"
                                min={0}
                                max={4000}
                                step={10}
                                value={Math.round(obs.position.y)}
                                onChange={(e) => {
                                  const y = Math.max(0, Math.min(4000, Number(e.target.value) || 0));
                                  updateSpaceObstacleStore(obs.id, {
                                    position: { ...obs.position, y },
                                  });
                                }}
                                className="w-full h-6 px-1.5 rounded-md bg-white border border-[#DED8CC] font-mono text-[10.5px] text-[#141413]"
                              />
                            </label>
                            {(() => {
                              const isSideWall =
                                Math.abs((((obs.rotationY || 0) % 180) + 180) % 180 - 90) <= 15;
                              const alongVal = isSideWall ? obs.position.z : obs.position.x;
                              return (
                                <label className="space-y-0.5">
                                  <span
                                    className="text-[#78716C] block"
                                    title={isSideWall ? "Duvar boyunca konum (Z ekseni)" : "Duvar boyunca konum (X ekseni)"}
                                  >
                                    Konum (mm)
                                  </span>
                                  <input
                                    type="number" inputMode="decimal"
                                    min={-2000}
                                    max={12000}
                                    step={50}
                                    value={Math.round(alongVal)}
                                    onChange={(e) => {
                                      const nextAlong = Number(e.target.value) || 0;
                                      updateSpaceObstacleStore(obs.id, {
                                        position: isSideWall
                                          ? { ...obs.position, z: nextAlong }
                                          : { ...obs.position, x: nextAlong },
                                      });
                                    }}
                                    className="w-full h-6 px-1.5 rounded-md bg-white border border-[#DED8CC] font-mono text-[10.5px] text-[#141413]"
                                  />
                                </label>
                              );
                            })()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onChangeDrawer(null);
                    onOpenKitchenIslandModal();
                  }}
                  className="w-full py-3 px-4 rounded-2xl bg-[#141413] hover:bg-[#292524] text-white font-semibold flex items-center justify-between transition cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <UtensilsCrossed className="w-4 h-4 text-[#7DD3FC]" />
                    <span>Şelale Mutfak Adası & Açılı Masa Stüdyosu</span>
                  </span>
                  <span className="text-[#7DD3FC]">›</span>
                </button>
              </div>
            )}
          </section>
      </>
    );
  }
);

LeftCatalogLauncher.displayName = "LeftCatalogLauncher";
