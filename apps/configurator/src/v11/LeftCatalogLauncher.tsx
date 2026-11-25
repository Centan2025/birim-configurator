"use client";
import React, { useState, useMemo, useEffect, useRef } from "react";
import { Plus, Sparkles, Home, LayoutList, Search, X, Palette } from "lucide-react";
import { type ArchitecturalElement, type ModuleInstance, type SceneObjectInstance } from "@birim/core";
import { V5_SCENE_OBJECT_CATALOG, registerDiscoveredSceneObjectCatalogItems, type V4ModuleTemplateDefinition } from "@birim/catalog";
import { classifyTemplateGroup, type V11CatalogGroup, type V11LeftDrawerTab } from "./v11Constants";
import { useConfiguratorStore } from "../store/useConfiguratorStore";
import { getEffectiveSpaceWalls, setActiveDraggedTemplateId } from "../v3/engine/kitchenSpatialEngine";
import { setActiveDraggedSceneCatalogId } from "../v3/engine/multiWallSnapAndBvhEngine";
import { type KitchenSubFilterId, type WardrobeSubFilterId } from "./catalog/catalogFilterSvgs";
import { LeftLauncherSubmenuPopover } from "./catalog/LeftLauncherSubmenuPopover";
import { LeftCatalogDrawerTab } from "./catalog/LeftCatalogDrawerTab";
import { LeftSceneModulesDrawerTab } from "./catalog/LeftSceneModulesDrawerTab";
import { LeftRoomAndSpaceDrawerTab } from "./catalog/LeftRoomAndSpaceDrawerTab";

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

        <LeftLauncherSubmenuPopover activeDrawer={activeDrawer} activeModuleIndex={activeModuleIndex} activeWallId={activeWallId} ceilingHeightMm={ceilingHeightMm} effectiveWalls={effectiveWalls} latchedLeftSubmenu={latchedLeftSubmenu} mainModules={mainModules} onAddStackedTopModule={onAddStackedTopModule} onChangeDrawer={onChangeDrawer} onDuplicateActiveModule={onDuplicateActiveModule} onFillRemainingWallGap={onFillRemainingWallGap} onOpenKitchenIslandModal={onOpenKitchenIslandModal} onOpenWizardModal={onOpenWizardModal} onSelectModuleIndex={onSelectModuleIndex} onSetRoomDimensions={onSetRoomDimensions} openLeftSubmenu={openLeftSubmenu} setActiveGroup={setActiveGroup} setActiveWallId={setActiveWallId} setOpenLeftSubmenu={setOpenLeftSubmenu} totalItemsBadge={totalItemsBadge} wallWidthMm={wallWidthMm} />

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
                    title={`Hedef Duvar: ${currentTargetWall?.name || "Ana Duvar"} — Kesikli (+): Duvar Ekle · Dolu: Seç`}
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
                          points="16,10 25,10 16,41 5,41"
                          fill={wallFill(isLeftSel, Boolean(leftWall))}
                          stroke={wallStroke(isLeftSel, Boolean(leftWall))}
                          strokeWidth={isLeftSel ? "2" : leftWall ? "1.5" : "1.2"}
                          strokeDasharray={leftWall ? undefined : "3 2"}
                          style={{ filter: wallFilter(isLeftSel) }}
                          strokeLinejoin="round"
                        />
                        {!leftWall && (
                          <g pointerEvents="none">
                            <circle cx="15.5" cy="25.5" r="5.5" fill="#0F172A" stroke="#38BDF8" strokeWidth="1.2" />
                            <path d="M15.5 22.9v5.2M12.9 25.5h5.2" stroke="#7DD3FC" strokeWidth="1.4" strokeLinecap="round" />
                          </g>
                        )}
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
                          points="71,10 80,10 91,41 80,41"
                          fill={wallFill(isRightSel, Boolean(rightWall))}
                          stroke={wallStroke(isRightSel, Boolean(rightWall))}
                          strokeWidth={isRightSel ? "2" : rightWall ? "1.5" : "1.2"}
                          strokeDasharray={rightWall ? undefined : "3 2"}
                          style={{ filter: wallFilter(isRightSel) }}
                          strokeLinejoin="round"
                        />
                        {!rightWall && (
                          <g pointerEvents="none">
                            <circle cx="80.5" cy="25.5" r="5.5" fill="#0F172A" stroke="#38BDF8" strokeWidth="1.2" />
                            <path d="M80.5 22.9v5.2M77.9 25.5h5.2" stroke="#7DD3FC" strokeWidth="1.4" strokeLinecap="round" />
                          </g>
                        )}
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
                          x="27"
                          y="4"
                          width="42"
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
                        <rect x="20" y="38" width="56" height="11" fill="transparent" />
                        <rect
                          x="20"
                          y="39"
                          width="20"
                          height="9"
                          rx="1.8"
                          fill={wallFill(isFrontSel, Boolean(frontWall))}
                          stroke={wallStroke(isFrontSel, Boolean(frontWall))}
                          strokeWidth={isFrontSel ? "2" : frontWall ? "1.5" : "1.2"}
                          strokeDasharray={frontWall ? undefined : "3 2"}
                          style={{ filter: wallFilter(isFrontSel) }}
                        />
                        <rect
                          x="56"
                          y="39"
                          width="20"
                          height="9"
                          rx="1.8"
                          fill={wallFill(isFrontSel, Boolean(frontWall))}
                          stroke={wallStroke(isFrontSel, Boolean(frontWall))}
                          strokeWidth={isFrontSel ? "2" : frontWall ? "1.5" : "1.2"}
                          strokeDasharray={frontWall ? undefined : "3 2"}
                          style={{ filter: wallFilter(isFrontSel) }}
                        />
                        {!frontWall && (
                          <g pointerEvents="none">
                            <circle cx="48" cy="43.5" r="5.5" fill="#0F172A" stroke="#38BDF8" strokeWidth="1.2" />
                            <path d="M48 40.9v5.2M45.4 43.5h5.2" stroke="#7DD3FC" strokeWidth="1.4" strokeLinecap="round" />
                          </g>
                        )}
                      </g>
                    </svg>
                    <div className="flex items-center justify-center gap-1 mt-0.5">
                      <span className="text-[9px] font-bold text-[#7DD3FC] leading-tight truncate max-w-[74px]">
                        {currentTargetWall?.name || "Ana Duvar"}
                      </span>
                      <span className="text-[8px] font-mono text-slate-300/80">
                        ({effectiveWalls.length}/4)
                      </span>
                      {!isMainSel && currentTargetWall && effectiveWalls.length > 1 && (
                        <button
                          type="button"
                          data-testid="v25-delete-active-wall-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSecondaryWall(currentTargetWall.id);
                          }}
                          title={`${currentTargetWall.name} duvarını sil`}
                          aria-label={`${currentTargetWall.name} duvarını sil`}
                          className="ml-0.5 w-4 h-4 rounded-full bg-rose-600/90 hover:bg-rose-500 text-white flex items-center justify-center shrink-0 transition cursor-pointer"
                        >
                          <X className="w-2.5 h-2.5" strokeWidth={2.5} />
                        </button>
                      )}
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

            <LeftCatalogDrawerTab activeGroup={activeGroup} classifyKitchenSub={classifyKitchenSub} classifyWardrobeSub={classifyWardrobeSub} displayUnit={displayUnit} filteredSceneObjects={filteredSceneObjects} filteredTemplates={filteredTemplates} fmtLen={fmtLen} groupBaseTemplates={groupBaseTemplates} kitchenSubFilter={kitchenSubFilter} objectFilter={objectFilter} onAddCompositeAssembly={onAddCompositeAssembly} onAddSceneObject={onAddSceneObject} onAppendTemplateAdjacent={onAppendTemplateAdjacent} onApplyTemplateToActive={onApplyTemplateToActive} onChangeDrawer={onChangeDrawer} onLoadKitchenPreset={onLoadKitchenPreset} onOpenCapsuleAndGlbHub={onOpenCapsuleAndGlbHub} onOpenKitchenIslandModal={onOpenKitchenIslandModal} renderedDrawer={renderedDrawer} searchQuery={searchQuery} setActiveGroup={setActiveGroup} setIsDraggingCatalogItem={setIsDraggingCatalogItem} setKitchenSubFilter={setKitchenSubFilter} setObjectFilter={setObjectFilter} setSearchQuery={setSearchQuery} setWardrobeSubFilter={setWardrobeSubFilter} wardrobeSubFilter={wardrobeSubFilter} />
            <LeftSceneModulesDrawerTab activeModuleIndex={activeModuleIndex} fmtLen={fmtLen} mainModules={mainModules} modules={modules} onAddStackedTopModule={onAddStackedTopModule} onChangeDrawer={onChangeDrawer} onDuplicateActiveModule={onDuplicateActiveModule} onFillRemainingWallGap={onFillRemainingWallGap} onOpenCapsuleAndGlbHub={onOpenCapsuleAndGlbHub} onOpenWizardModal={onOpenWizardModal} onRemoveModuleAt={onRemoveModuleAt} onRemoveSceneObject={onRemoveSceneObject} onRotateSceneObject={onRotateSceneObject} onSelectModuleIndex={onSelectModuleIndex} remainingWallGapMm={remainingWallGapMm} renderedDrawer={renderedDrawer} sceneObjects={sceneObjects} />
            <LeftRoomAndSpaceDrawerTab activeWallId={activeWallId} ceilingHeightMm={ceilingHeightMm} currentTargetWall={currentTargetWall} effectiveWalls={effectiveWalls} fmtLen={fmtLen} mainModules={mainModules} obstacles={obstacles} onChangeDrawer={onChangeDrawer} onLoadKitchenPreset={onLoadKitchenPreset} onOpenKitchenIslandModal={onOpenKitchenIslandModal} onRemoveSpaceObstacle={onRemoveSpaceObstacle} onSetRoomDimensions={onSetRoomDimensions} placeOnSelectedWall={placeOnSelectedWall} renderedDrawer={renderedDrawer} setActiveWallId={setActiveWallId} spaceWalls={spaceWalls} storeProject={storeProject} updateSpaceObstacleStore={updateSpaceObstacleStore} wallWidthMm={wallWidthMm} />
          </section>
      </>
    );
  }
);

LeftCatalogLauncher.displayName = "LeftCatalogLauncher";
