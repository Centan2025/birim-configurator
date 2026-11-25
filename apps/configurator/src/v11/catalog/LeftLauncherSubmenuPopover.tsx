"use client";
import React from "react";
import { AnimatedPopoverPresence } from "../AnimatedWindowPresence";
import { Sparkles, X, Copy, ArrowUpFromLine, ChevronRight } from "lucide-react";
import type { ModuleInstance, WallDefinition } from "@birim/core";
import type { V11CatalogGroup, V11LeftDrawerTab } from "../v11Constants";
import { useConfiguratorStore } from "../../store/useConfiguratorStore";

export interface LeftLauncherSubmenuPopoverProps {
  activeDrawer: V11LeftDrawerTab;
  activeModuleIndex: number;
  activeWallId: string | null;
  ceilingHeightMm: number;
  effectiveWalls: WallDefinition[];
  latchedLeftSubmenu: "add" | "modules" | "room";
  mainModules: Array<{ mod: ModuleInstance; idx: number }>;
  onAddStackedTopModule: () => void;
  onChangeDrawer: (tab: V11LeftDrawerTab) => void;
  onDuplicateActiveModule: () => void;
  onFillRemainingWallGap: () => void;
  onOpenKitchenIslandModal: () => void;
  onOpenWizardModal: () => void;
  onSelectModuleIndex: (idx: number) => void;
  onSetRoomDimensions: (wallW: number, ceilH: number) => void;
  openLeftSubmenu: null | "add" | "modules" | "room";
  setActiveGroup: React.Dispatch<React.SetStateAction<V11CatalogGroup["id"]>>;
  setActiveWallId: (wallId: string) => void;
  setOpenLeftSubmenu: React.Dispatch<React.SetStateAction<null | "add" | "modules" | "room">>;
  totalItemsBadge: number;
  wallWidthMm: number;
}

export const LeftLauncherSubmenuPopover: React.FC<LeftLauncherSubmenuPopoverProps> = (props) => {
  const {
    activeDrawer,
    activeModuleIndex,
    activeWallId,
    ceilingHeightMm,
    effectiveWalls,
    latchedLeftSubmenu,
    mainModules,
    onAddStackedTopModule,
    onChangeDrawer,
    onDuplicateActiveModule,
    onFillRemainingWallGap,
    onOpenKitchenIslandModal,
    onOpenWizardModal,
    onSelectModuleIndex,
    onSetRoomDimensions,
    openLeftSubmenu,
    setActiveGroup,
    setActiveWallId,
    setOpenLeftSubmenu,
    totalItemsBadge,
    wallWidthMm,
  } = props;
  return (
    <>
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
    </>
  );
};
