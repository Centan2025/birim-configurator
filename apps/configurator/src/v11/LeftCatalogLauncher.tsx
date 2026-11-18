"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
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
  Maximize2,
  UtensilsCrossed,
  RotateCw,
  Tv,
  Armchair,
  Box,
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
import { SceneObjectThumbnail } from "../v3/components/SceneObjectThumbnail";
import {
  V11_CATALOG_GROUPS,
  classifyTemplateGroup,
  type V11CatalogGroup,
  type V11LeftDrawerTab,
} from "./v11Constants";
import { useConfiguratorStore } from "../store/useConfiguratorStore";
import { getEffectiveSpaceWalls } from "../v3/engine/kitchenSpatialEngine";

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
  onAppendTemplateAdjacent: (templateId: string) => void;
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
  }) => {
    const [activeGroup, setActiveGroup] = useState<V11CatalogGroup["id"]>("wardrobe");
    const [objectFilter, setObjectFilter] = useState<
      "all" | "appliance" | "furniture" | "plants" | "decor"
    >("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [discoveredTick, setDiscoveredTick] = useState(0);
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
      elevYMm: number
    ) => {
      const targetWall =
        spaceWalls.find((w) => w.id === activeWallId) || spaceWalls[0] || {
          id: "wall_main",
          name: "Ana Duvar",
          length: wallWidthMm,
          position: { x: 0, y: 0, z: 0 },
          rotationY: 0,
        };
      const wallRot = (((targetWall.rotationY || 0) % 360) + 360) % 360;
      const rad = (wallRot * Math.PI) / 180;
      const dirX = Math.cos(rad);
      const dirZ = Math.sin(rad);
      const maxStart = Math.max(0, (targetWall.length || wallWidthMm) - wMm);

      // Project existing obstacles on this same wall so sequential additions advance cleanly along the wall vector
      const sameWallIntervals: Array<[number, number]> = [];
      for (const ex of obstacles) {
        const exRot = (((ex.rotationY || 0) % 360) + 360) % 360;
        const rotDiff = Math.min(Math.abs(exRot - wallRot), 360 - Math.abs(exRot - wallRot));
        if (rotDiff > 12) continue;
        const relX = ex.position.x - targetWall.position.x;
        const relZ = ex.position.z - targetWall.position.z;
        const along = relX * dirX + relZ * dirZ;
        const perp = Math.abs(-relX * dirZ + relZ * dirX);
        if (perp <= 220 && along >= -100 && along <= (targetWall.length || wallWidthMm) + 100) {
          sameWallIntervals.push([along, along + (ex.dimensions.width || 300)]);
        }
      }
      sameWallIntervals.sort((a, b) => a[0] - b[0]);

      let chosenOffset =
        obsType === "column"
          ? 0
          : obsType === "door"
          ? Math.max(150, Math.min(maxStart, (targetWall.length || wallWidthMm) - wMm - 150))
          : Math.min(maxStart, Math.max(150, Math.round(((targetWall.length || wallWidthMm) - wMm) * 0.45)));

      const overlaps = (cand: number) =>
        sameWallIntervals.some(([s, e]) => cand < e + 60 && cand + wMm > s - 60);

      if (overlaps(chosenOffset)) {
        let cursor = 120;
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
        return classifyTemplateGroup(tpl) === activeGroup;
      });
    }, [templates, activeGroup, searchQuery]);

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

    const toggleDrawer = (tab: Exclude<V11LeftDrawerTab, null>) => {
      onChangeDrawer(activeDrawer === tab ? null : tab);
    };

    const totalItemsBadge = mainModules.length + sceneObjects.length;

    return (
      <>
        {/* SOL DİKEY HAFİF KAPSÜL BAŞLATICI */}
        <aside
          aria-label="Modül ve Mekân Araçları"
          data-testid="v11-left-launcher"
          className="fixed left-4 top-1/2 -translate-y-1/2 z-30 p-1.5 rounded-full bg-[#FAF8F4]/92 backdrop-blur-xl border border-[#DFD9CE] shadow-[0_10px_30px_rgba(20,20,19,0.08)] flex flex-col items-center gap-1.5"
        >
          <button
            type="button"
            data-testid="v11-launcher-catalog"
            onClick={() => toggleDrawer("catalog")}
            title="Ürün, Modül, TV Ünitesi, Ada & Masa Kataloğu"
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-250 cursor-pointer ${
              activeDrawer === "catalog"
                ? "bg-[#141413] text-white shadow-sm scale-105"
                : "text-[#44403C] hover:bg-[#EFECE4] hover:text-[#141413]"
            }`}
          >
            <Plus className={`w-5 h-5 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${activeDrawer === "catalog" ? "rotate-45" : "rotate-0"}`} />
          </button>

          <button
            type="button"
            data-testid="v11-launcher-modules"
            onClick={() => toggleDrawer("modules")}
            title="Sahnedeki Modüller ve 3B Eşyalar"
            className={`relative w-10 h-10 rounded-full flex items-center justify-center transition cursor-pointer ${
              activeDrawer === "modules"
                ? "bg-[#141413] text-white shadow-sm"
                : "text-[#44403C] hover:bg-[#EFECE4] hover:text-[#141413]"
            }`}
          >
            <LayoutList className="w-4 h-4" />
            <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 rounded-full bg-[#8C7A6B] text-white text-[10px] font-bold flex items-center justify-center">
              {totalItemsBadge}
            </span>
          </button>

          <button
            type="button"
            data-testid="v11-launcher-space"
            onClick={() => toggleDrawer("space")}
            title="Oda Ölçüleri, Hazır Mutfak Planları ve Ada/Masa"
            className={`w-10 h-10 rounded-full flex items-center justify-center transition cursor-pointer ${
              activeDrawer === "space"
                ? "bg-[#141413] text-white shadow-sm"
                : "text-[#44403C] hover:bg-[#EFECE4] hover:text-[#141413]"
            }`}
          >
            <Home className="w-4 h-4" />
          </button>

          <div className="w-5 h-px bg-[#DFD9CE] my-0.5" />

          <button
            type="button"
            data-testid="v11-launcher-wizard"
            onClick={() => {
              onChangeDrawer(null);
              onOpenWizardModal();
            }}
            title="Hızlı Dolap ve Mekân Kurulum Sihirbazı"
            className="w-10 h-10 rounded-full flex items-center justify-center text-[#8C7A6B] hover:bg-[#EFECE4] hover:text-[#141413] transition cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
          </button>
        </aside>

        {/* YÜZEN KÜTÜPHANE / DİZİLİM / MEKÂN ÇEKMECESİ (Yumuşak Açılış & Kapanış Animasyonlu) */}
          <section
            aria-hidden={!isDrawerOpen}
            data-testid={activeDrawer ? `v11-left-popover-${activeDrawer}` : "v11-left-popover-closed"}
            className={`fixed left-[76px] top-[78px] bottom-[84px] w-[396px] max-w-[calc(100vw-96px)] z-30 rounded-3xl bg-[#FAF8F4]/95 backdrop-blur-2xl border border-[#DFD9CE] shadow-[0_24px_60px_rgba(20,20,19,0.14)] flex flex-col overflow-hidden text-[#141413] origin-left will-change-[transform,opacity] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              isDrawerOpen
                ? "opacity-100 scale-100 translate-x-0 pointer-events-auto"
                : "opacity-0 scale-95 -translate-x-6 pointer-events-none"
            }`}
          >
            <div className="px-5 pt-4 pb-3 border-b border-[#E6E1D6] flex items-center justify-between gap-2 shrink-0">
              <div>
                <h2 className="text-sm font-bold tracking-tight">
                  {renderedDrawer === "catalog"
                    ? "Ürün, Modül & Eşya Kataloğu"
                    : renderedDrawer === "modules"
                    ? "Sahnedeki Modüller ve Eşyalar"
                    : "Oda, Hazır Mutfak & Mimari"}
                </h2>
                <p className="text-[11px] text-[#78716C] mt-0.5">
                  {renderedDrawer === "catalog"
                    ? "Gardırop, Mutfak Adası, TV Bench, Masa ve 3B Cihazlar"
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

            {/* SEKME 1: ÜRÜN & EŞYA KATALOĞU */}
            {renderedDrawer === "catalog" && (
              <>
                <div className="px-4 pt-3 pb-2 space-y-2.5 shrink-0">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-[#78716C] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Ara: TV konsolu, ada, masa, sürgülü, fırın..."
                      className="w-full h-9 pl-9 pr-8 rounded-full bg-white border border-[#DED8CC] text-xs text-[#141413] placeholder:text-[#A8A29E] focus:outline-none focus:border-[#141413]"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#78716C] hover:text-[#141413] text-xs cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* 4 Ana Ürün Ailesi Sekmesi */}
                  <div className="grid grid-cols-4 gap-1 p-1 rounded-2xl bg-[#ECE7DD]/80 border border-[#DFD9CE]">
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
                          className={`py-1.5 px-1 rounded-xl text-[10.5px] font-semibold transition cursor-pointer ${
                            active
                              ? "bg-[#141413] text-white shadow-2xs"
                              : "text-[#57534E] hover:text-[#141413]"
                          }`}
                        >
                          {grp.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-4 pb-4 pt-1 space-y-3">
                  {/* MUTFAK & ADA ÖZEL HIZLI KARTLARI */}
                  {!searchQuery && activeGroup === "kitchen" && (
                    <div className="p-3 rounded-2xl bg-[#F2EEE4] border border-[#DED7C8] space-y-2">
                      <div className="text-[11px] font-bold text-[#141413] flex items-center gap-1.5">
                        <UtensilsCrossed className="w-3.5 h-3.5 text-[#8C7A6B]" />
                        <span>Mutfak Adası, Masa ve Hazır Setler</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            onChangeDrawer(null);
                            onOpenKitchenIslandModal();
                          }}
                          className="p-2.5 rounded-xl bg-[#141413] hover:bg-[#292524] text-white text-left transition cursor-pointer"
                        >
                          <div className="text-[11px] font-bold">Şelale Mutfak Adası & Masa</div>
                          <div className="text-[10px] text-[#D6C7B2] mt-0.5">
                            Ada + 0°/30°/45°/90° bağlı yemek/bar masası
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => onAddCompositeAssembly("comp_island_social_set")}
                          className="p-2.5 rounded-xl bg-white hover:bg-[#FAF8F4] border border-[#DED8CC] text-left transition cursor-pointer"
                        >
                          <div className="text-[11px] font-bold text-[#141413]">
                            Sosyal Ada + 3 Tabure Seti
                          </div>
                          <div className="text-[10px] text-[#78716C] mt-0.5">
                            180 cm ada + ocak + sarkıt + bar tabureleri
                          </div>
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <button
                          type="button"
                          onClick={() => onAddCompositeAssembly("comp_appliance_wall_trio")}
                          className="flex-1 py-1.5 px-2.5 rounded-full bg-white hover:bg-[#FAF8F4] border border-[#DED8CC] text-[10.5px] font-semibold cursor-pointer"
                        >
                          + Ankastre Kule Seti
                        </button>
                        <button
                          type="button"
                          onClick={() => onLoadKitchenPreset("l")}
                          className="py-1.5 px-2.5 rounded-full bg-white hover:bg-[#FAF8F4] border border-[#DED8CC] text-[10.5px] font-semibold cursor-pointer"
                        >
                          L-Mutfak
                        </button>
                        <button
                          type="button"
                          onClick={() => onLoadKitchenPreset("u")}
                          className="py-1.5 px-2.5 rounded-full bg-white hover:bg-[#FAF8F4] border border-[#DED8CC] text-[10.5px] font-semibold cursor-pointer"
                        >
                          U-Mutfak
                        </button>
                      </div>
                    </div>
                  )}

                  {/* TV BENCH, YEMEK MASASI & KAPSÜL ÜNİTE ÖZEL HIZLI KARTLARI */}
                  {!searchQuery && activeGroup === "living" && (
                    <div className="p-3 rounded-2xl bg-[#F2EEE4] border border-[#DED7C8] space-y-2">
                      <div className="text-[11px] font-bold text-[#141413] flex items-center gap-1.5">
                        <Tv className="w-3.5 h-3.5 text-[#8C7A6B]" />
                        <span>TV Duvar Seti, Yemek Masası & Kapsül Tasarım</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => onAddCompositeAssembly("comp_living_tv_wall_set")}
                          className="p-2.5 rounded-xl bg-[#141413] hover:bg-[#292524] text-white text-left transition cursor-pointer"
                        >
                          <div className="text-[11px] font-bold">Salon TV Bench + 65&quot; TV Seti</div>
                          <div className="text-[10px] text-[#D6C7B2] mt-0.5">
                            240 cm 45° gönye konsol + 65&quot; ekran + vitrin
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onChangeDrawer(null);
                            onOpenCapsuleAndGlbHub("capsule_curved");
                          }}
                          className="p-2.5 rounded-xl bg-white hover:bg-[#FAF8F4] border border-[#DED8CC] text-left transition cursor-pointer"
                        >
                          <div className="text-[11px] font-bold text-[#141413]">
                            Özel Kapsül Masa & Bar Tasarla
                          </div>
                          <div className="text-[10px] text-[#78716C] mt-0.5">
                            Oval stadyum yemek masası ve tamburlu büfe
                          </div>
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        <button
                          type="button"
                          onClick={() => onAddSceneObject("obj_birim_dining_table_1800")}
                          className="py-1.5 px-2.5 rounded-full bg-white hover:bg-[#FAF8F4] border border-[#DED8CC] text-[10.5px] font-semibold cursor-pointer"
                        >
                          + Masif Meşe Masa (180×90)
                        </button>
                        <button
                          type="button"
                          onClick={() => onAddSceneObject("obj_birim_dining_chair")}
                          className="py-1.5 px-2.5 rounded-full bg-white hover:bg-[#FAF8F4] border border-[#DED8CC] text-[10.5px] font-semibold cursor-pointer"
                        >
                          + Sandalye
                        </button>
                        <button
                          type="button"
                          onClick={() => onAddSceneObject("obj_birim_bar_stool")}
                          className="py-1.5 px-2.5 rounded-full bg-white hover:bg-[#FAF8F4] border border-[#DED8CC] text-[10.5px] font-semibold cursor-pointer"
                        >
                          + Bar Taburesi
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 3B CİHAZLAR, MASALAR VE SAHNE EŞYALARI SEKMESİ */}
                  {(activeGroup === "objects" || Boolean(searchQuery)) &&
                    filteredSceneObjects.length > 0 && (
                      <div className="space-y-2.5">
                        {!searchQuery && (
                          <div className="flex flex-wrap gap-1">
                            {(
                              [
                                { id: "all", label: "Tümü" },
                                { id: "appliance", label: "Mutfak Cihazları" },
                                { id: "furniture", label: "Masa, Koltuk & Yatak" },
                                { id: "plants", label: "İç Mekân Bitkileri" },
                                { id: "decor", label: "TV, Işık & Dekor" },
                              ] as const
                            ).map((flt) => (
                              <button
                                key={flt.id}
                                type="button"
                                onClick={() => setObjectFilter(flt.id)}
                                className={`px-2.5 py-1 rounded-full text-[10.5px] font-semibold cursor-pointer ${
                                  objectFilter === flt.id
                                    ? "bg-[#141413] text-white"
                                    : "bg-white border border-[#E5DFD3] text-[#57534E]"
                                }`}
                              >
                                {flt.label}
                              </button>
                            ))}
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
                              className="group p-3 rounded-2xl bg-white/90 hover:bg-white border border-[#E5DFD3] hover:border-[#141413]/40 flex flex-col justify-between gap-2 transition shadow-2xs"
                            >
                              <button
                                type="button"
                                onClick={() => onAddSceneObject(obj.catalogId)}
                                className="w-full text-left flex flex-col cursor-pointer"
                              >
                                <div className="w-full h-24 rounded-xl bg-[#F6F3EC] flex items-center justify-center mb-2 overflow-hidden p-1.5">
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

                  {/* PARAMETRİK MODÜL KARTLARI */}
                  {(activeGroup !== "objects" || Boolean(searchQuery)) &&
                    filteredTemplates.length > 0 && (
                      <div className="grid grid-cols-2 gap-2.5 content-start">
                        {filteredTemplates.map((tpl) => {
                          const minVal = fmtLen(tpl.dimensionLimits.minW, false);
                          const maxVal = fmtLen(tpl.dimensionLimits.maxW, false);
                          return (
                            <div
                              key={tpl.templateId}
                              data-testid={`v11-tpl-${tpl.templateId}`}
                              className="group rounded-2xl bg-white/90 hover:bg-white border border-[#E5DFD3] hover:border-[#141413]/40 p-3 flex flex-col justify-between transition shadow-2xs"
                            >
                              <button
                                type="button"
                                onClick={() => onApplyTemplateToActive(tpl.templateId)}
                                className="w-full text-left flex flex-col items-center cursor-pointer"
                              >
                                <div className="w-full h-24 rounded-xl bg-[#F6F3EC] flex items-center justify-center mb-2 overflow-hidden">
                                  <V3IsometricModuleIcon template={tpl} size="lg" />
                                </div>
                                <div className="w-full text-xs font-semibold text-[#141413] leading-snug line-clamp-2">
                                  {tpl.name}
                                </div>
                                <div className="w-full text-[10.5px] font-mono text-[#78716C] mt-0.5">
                                  {minVal === maxVal ? `${minVal} ${displayUnit}` : `${minVal}–${maxVal} ${displayUnit}`}
                                </div>
                              </button>

                              <div className="mt-2.5 pt-2 border-t border-[#F0ECE3] flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => onApplyTemplateToActive(tpl.templateId)}
                                  className="flex-1 h-7 rounded-full bg-[#F3EFE6] hover:bg-[#141413] text-[#141413] hover:text-white text-[10.5px] font-semibold transition cursor-pointer"
                                >
                                  Değiştir
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onAppendTemplateAdjacent(tpl.templateId)}
                                  title="Mevcut dolabın yanına yeni modül olarak ekle"
                                  className="h-7 px-2.5 rounded-full bg-[#141413] hover:bg-[#292524] text-white text-[10.5px] font-semibold flex items-center gap-1 transition cursor-pointer"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>Ekle</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
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
                      <Maximize2 className="w-3.5 h-3.5 text-[#D6C7B2]" />
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
                              isSelected ? "text-[#D6C7B2]" : "text-[#78716C]"
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
                    {spaceWalls.length > 1 && (
                      <select
                        aria-label="Hedef Duvar Seçimi"
                        value={spaceWalls.some((w) => w.id === activeWallId) ? (activeWallId || spaceWalls[0].id) : spaceWalls[0].id}
                        onChange={(e) => setActiveWallId(e.target.value)}
                        className="px-2 py-1 rounded-lg bg-[#F5F2EA] border border-[#DED8CC] text-[11px] font-semibold text-[#141413] cursor-pointer"
                      >
                        {spaceWalls.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name} ({Math.round(w.rotationY || 0)}°)
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        placeOnSelectedWall("window", "Pencere", 900, 1200, 180, 900)
                      }
                      className="py-2 px-2 rounded-xl bg-[#F5F2EA] hover:bg-[#EAE4D7] font-semibold transition cursor-pointer"
                    >
                      + Pencere
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        placeOnSelectedWall("column", "Kolon", 300, ceilingHeightMm, 300, 0)
                      }
                      className="py-2 px-2 rounded-xl bg-[#F5F2EA] hover:bg-[#EAE4D7] font-semibold transition cursor-pointer"
                    >
                      + Kolon
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        placeOnSelectedWall("door", "Oda Kapısı", 900, 2100, 120, 0)
                      }
                      className="py-2 px-2 rounded-xl bg-[#F5F2EA] hover:bg-[#EAE4D7] font-semibold transition cursor-pointer"
                    >
                      + Kapı
                    </button>
                  </div>

                  {obstacles.length > 0 && (
                    <div className="pt-2 space-y-1.5 border-t border-[#F0ECE3]">
                      {obstacles.map((obs) => (
                        <div
                          key={obs.id}
                          className="flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#FAF8F4]"
                        >
                          <span className="font-medium truncate">
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
                    <UtensilsCrossed className="w-4 h-4 text-[#D6C7B2]" />
                    <span>Şelale Mutfak Adası & Açılı Masa Stüdyosu</span>
                  </span>
                  <span className="text-[#D6C7B2]">›</span>
                </button>
              </div>
            )}
          </section>
      </>
    );
  }
);

LeftCatalogLauncher.displayName = "LeftCatalogLauncher";
