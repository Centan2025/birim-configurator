"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { DesignProject, ModuleInstance } from "@birim/core";

type BayDoorKind = ModuleInstance["bays"][number]["door"]["type"];

export type Viewport3DContextTarget =
  | {
      kind: "component";
      modIdx: number;
      bayIndex: number;
      componentId: string;
      role: string;
      label: string;
      dimsText?: string;
      hitElevationY?: number;
      clientX: number;
      clientY: number;
    }
  | {
      kind: "obstacle";
      obstacleId: string;
      label: string;
      clientX: number;
      clientY: number;
    }
  | {
      kind: "scene";
      clientX: number;
      clientY: number;
    };

export interface Viewport3DContextMenuProps {
  target: Viewport3DContextTarget | null;
  project: DesignProject;
  doorOpenAngleDeg: number;
  drawerOpenMm: number;
  doorsHiddenIn3D: boolean;
  showDimensions: boolean;
  showInteriorProps3D: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onClose: () => void;
  onToggleDoorOpen: () => void;
  onToggleDoorsHidden: () => void;
  onToggleDrawerOpen: () => void;
  onToggleDimensions: () => void;
  onToggleInteriorProps: () => void;
  onFitScene: () => void;
  onFlipDoorDirection: () => void;
  onSetBayDoorType: (bayIndex: number, type: BayDoorKind) => void;
  onApplyMaterialToSimilar: (
    materialId: string | null,
    explicitComponentId?: string | null,
    scope?: "single" | "module_similar" | "project_similar"
  ) => void;
  onAddInteriorItemAtElevation: (bayIdx: number, itemKind: string, elevationY: number) => void;
  onApplyBayInteriorPreset: (
    bayIdx: number,
    preset: "rail_double" | "shelves_5" | "rail_drawers_3"
  ) => void;
  onSetShelfElevation: (bayIdx: number, shelfId: string, elevationY: number) => void;
  onSetShelfThickness: (bayIdx: number, shelfId: string | "all", thicknessMm: number) => void;
  onSetDrawerPlacement: (
    bayIdx: number,
    drawerId: string,
    elevationY: number,
    height?: number
  ) => void;
  onSetHangingRailElevation: (bayIdx: number, railId: string, elevationY: number) => void;
  onMoveInteriorItemToBay: (
    itemType: "shelf" | "drawer" | "rail",
    fromBayIdx: number,
    itemId: string,
    toBayIdx: number
  ) => void;
  onSplitBayIntoTwo: (bayIdx: number) => void;
  onEqualizeBaysAndShelves: (bayIdx?: number) => void;
  onRemoveBayAt: (bayIdx: number) => void;
  onRemoveSelectedInteriorComponent: (compId?: string | null) => void;
  onAddAdjacentModule: (side?: "left" | "right") => void;
  onDuplicateActiveModule: () => void;
  onRotateActiveModule90: (deltaDeg?: number) => void;
  onSwapModuleWithNeighbor: (modIdx: number, direction: -1 | 1) => void;
  onToggleModuleLedLighting: (enabled: boolean) => void;
  onSetPlinthHeight: (heightMm: number) => void;
  onRemoveActiveModule: () => void;
  onRemoveSpaceObstacle: (obstacleId: string) => void;
  onUndo: () => void;
  onRedo: () => void;
}

interface MenuItemProps {
  label: string;
  shortcut?: string;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

const MenuItem: React.FC<MenuItemProps> = ({
  label,
  shortcut,
  active,
  danger,
  disabled,
  onClick,
}) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className={`w-full flex items-center justify-between gap-3 px-2.5 py-1.5 rounded-lg text-[11.5px] font-medium text-left transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
      danger
        ? "text-rose-700 hover:bg-rose-500/12"
        : active
        ? "bg-[#141413] text-white"
        : "text-[#1C1917] hover:bg-black/6"
    }`}
  >
    <span className="truncate">{label}</span>
    {shortcut && (
      <span
        className={`text-[10px] font-mono shrink-0 ${
          active ? "text-stone-300" : "text-[#78716C]"
        }`}
      >
        {shortcut}
      </span>
    )}
  </button>
);

const MenuSectionTitle: React.FC<{ title: string }> = ({ title }) => (
  <div className="px-2.5 pt-1.5 pb-0.5 text-[9.5px] font-bold uppercase tracking-wider text-[#78716C]">
    {title}
  </div>
);

const MenuDivider: React.FC = () => <div className="my-1 h-px bg-black/8" />;

function findBayItemByComponentId(mod: ModuleInstance | undefined, bayIdx: number, compId: string) {
  const bay = mod?.bays[bayIdx];
  if (!bay) return { shelf: undefined, drawer: undefined, rail: undefined };
  const shelf = bay.shelves.find((s) => compId.includes(s.id));
  const drawer = bay.drawers.find((d) => compId.includes(d.id));
  const rail = bay.hangingRails.find((r) => compId.includes(r.id));
  return { shelf, drawer, rail };
}

export const Viewport3DContextMenu: React.FC<Viewport3DContextMenuProps> = ({
  target,
  project,
  doorOpenAngleDeg,
  drawerOpenMm,
  doorsHiddenIn3D,
  showDimensions,
  showInteriorProps3D,
  canUndo,
  canRedo,
  onClose,
  onToggleDoorOpen,
  onToggleDoorsHidden,
  onToggleDrawerOpen,
  onToggleDimensions,
  onToggleInteriorProps,
  onFitScene,
  onFlipDoorDirection,
  onSetBayDoorType,
  onApplyMaterialToSimilar,
  onAddInteriorItemAtElevation,
  onApplyBayInteriorPreset,
  onSetShelfElevation,
  onSetShelfThickness,
  onSetDrawerPlacement,
  onSetHangingRailElevation,
  onMoveInteriorItemToBay,
  onSplitBayIntoTwo,
  onEqualizeBaysAndShelves,
  onRemoveBayAt,
  onRemoveSelectedInteriorComponent,
  onAddAdjacentModule,
  onDuplicateActiveModule,
  onRotateActiveModule90,
  onSwapModuleWithNeighbor,
  onToggleModuleLedLighting,
  onSetPlinthHeight,
  onRemoveActiveModule,
  onRemoveSpaceObstacle,
  onUndo,
  onRedo,
}) => {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: -9999, top: -9999 });

  useLayoutEffect(() => {
    if (!target || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const pad = 10;
    const left = Math.max(
      pad,
      Math.min(window.innerWidth - rect.width - pad, target.clientX)
    );
    const top = Math.max(
      pad,
      Math.min(window.innerHeight - rect.height - pad, target.clientY)
    );
    setPos({ left, top });
  }, [target]);

  useEffect(() => {
    if (!target) return;
    const handleOutside = (e: PointerEvent) => {
      if (menuRef.current && e.target instanceof Node && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("pointerdown", handleOutside, { capture: true });
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("pointerdown", handleOutside, { capture: true });
      window.removeEventListener("keydown", handleKey);
    };
  }, [target, onClose]);

  if (!target) return null;

  const run = (fn: () => void) => {
    fn();
    onClose();
  };

  if (target.kind === "obstacle") {
    return (
      <div
        ref={menuRef}
        data-testid="viewport-3d-context-menu"
        style={{ left: pos.left, top: pos.top }}
        onContextMenu={(e) => e.preventDefault()}
        className="fixed z-50 w-60 birim-ice-popover rounded-2xl p-1.5 shadow-2xl border border-white/60"
      >
        <div className="px-2.5 py-1.5 border-b border-black/8 mb-1">
          <div className="text-[11px] font-bold text-[#141413] truncate">{target.label}</div>
          <div className="text-[9.5px] text-[#78716C]">Mimari Engel</div>
        </div>
        <MenuItem
          label="Engeli Sahneden Sil"
          shortcut="Del"
          danger
          onClick={() => run(() => onRemoveSpaceObstacle(target.obstacleId))}
        />
      </div>
    );
  }

  if (target.kind === "scene") {
    return (
      <div
        ref={menuRef}
        data-testid="viewport-3d-context-menu"
        style={{ left: pos.left, top: pos.top }}
        onContextMenu={(e) => e.preventDefault()}
        className="fixed z-50 w-60 birim-ice-popover rounded-2xl p-1.5 shadow-2xl border border-white/60"
      >
        <div className="px-2.5 py-1.5 border-b border-black/8 mb-1">
          <div className="text-[11px] font-bold text-[#141413]">3D Sahne Kontrolleri</div>
        </div>
        <MenuItem label="Geri Al" shortcut="Ctrl+Z" disabled={!canUndo} onClick={() => run(onUndo)} />
        <MenuItem label="İleri Al" shortcut="Ctrl+Y" disabled={!canRedo} onClick={() => run(onRedo)} />
        <MenuDivider />
        <MenuItem label="Sahneye Sığdır" onClick={() => run(onFitScene)} />
        <MenuItem
          label={doorOpenAngleDeg > 5 ? "Kapakları Kapat" : "Kapakları Aç"}
          shortcut="Space"
          active={doorOpenAngleDeg > 5}
          onClick={() => run(onToggleDoorOpen)}
        />
        <MenuItem
          label={doorsHiddenIn3D ? "Kapakları Göster" : "Kapakları Gizle"}
          active={doorsHiddenIn3D}
          onClick={() => run(onToggleDoorsHidden)}
        />
        <MenuItem
          label={showDimensions ? "3D Ölçüleri Gizle" : "3D Ölçüleri Göster"}
          active={showDimensions}
          onClick={() => run(onToggleDimensions)}
        />
        <MenuItem
          label={showInteriorProps3D ? "İç Eşyaları Gizle" : "İç Eşyaları Göster"}
          active={showInteriorProps3D}
          onClick={() => run(onToggleInteriorProps)}
        />
      </div>
    );
  }

  const mod = project.modules[target.modIdx];
  const bayIdx = Math.max(0, Math.min((mod?.bays.length || 1) - 1, target.bayIndex));
  const bay = mod?.bays[bayIdx];
  const role = target.role;
  const isDoor = role === "door" || role.startsWith("door_") || role === "gola_profile";
  const isShelf = role === "shelf";
  const isDrawer = role.startsWith("drawer_");
  const isRail = role === "hanging_rail";
  const isBayInterior = role === "bay_compartment";
  const { shelf, drawer, rail } = findBayItemByComponentId(mod, bayIdx, target.componentId);
  const spawnElevationY =
    typeof target.hitElevationY === "number" && target.hitElevationY > 60
      ? target.hitElevationY
      : 640;

  return (
    <div
      ref={menuRef}
      data-testid="viewport-3d-context-menu"
      style={{ left: pos.left, top: pos.top }}
      onContextMenu={(e) => e.preventDefault()}
      className="fixed z-50 w-64 max-h-[82vh] overflow-y-auto birim-ice-popover rounded-2xl p-1.5 shadow-2xl border border-white/60"
    >
      <div className="px-2.5 py-1.5 border-b border-black/8 mb-1">
        <div className="text-[11px] font-bold text-[#141413] truncate">
          {target.label || mod?.name || "Bileşen"}
        </div>
        <div className="text-[9.5px] text-[#78716C] flex items-center justify-between gap-2">
          <span>
            Modül {target.modIdx + 1} • Bölme {bayIdx + 1}
          </span>
          {target.dimsText && <span className="font-mono">{target.dimsText}</span>}
        </div>
      </div>

      {isDoor && bay && (
        <>
          <MenuSectionTitle title="Kapak Kontrolleri" />
          <MenuItem
            label={doorOpenAngleDeg > 5 ? "Kapağı Kapat" : "Kapağı Aç (85°)"}
            shortcut="Space"
            active={doorOpenAngleDeg > 5}
            onClick={() => run(onToggleDoorOpen)}
          />
          <MenuItem
            label={doorsHiddenIn3D ? "Kapakları Göster" : "Kapakları Gizle (İç Düzenle)"}
            active={doorsHiddenIn3D}
            onClick={() => run(onToggleDoorsHidden)}
          />
          <MenuItem
            label="Açılış Yönünü Çevir (Sol ⇄ Sağ)"
            onClick={() => run(onFlipDoorDirection)}
          />
          <div className="grid grid-cols-4 gap-1 px-1.5 py-1">
            {(
              [
                { id: "single_left", label: "Sol" },
                { id: "double", label: "Çift" },
                { id: "sliding", label: "Sürme" },
                { id: "open", label: "Açık" },
              ] as const
            ).map((dt) => (
              <button
                key={dt.id}
                type="button"
                onClick={() => run(() => onSetBayDoorType(bayIdx, dt.id))}
                className={`py-1 rounded-md text-[10px] font-bold cursor-pointer transition ${
                  bay.door.type === dt.id
                    ? "bg-[#141413] text-white"
                    : "bg-black/5 text-[#44403C] hover:bg-black/10"
                }`}
              >
                {dt.label}
              </button>
            ))}
          </div>
          <MenuItem
            label="Malzemeyi Modülün Kapaklarına Yay"
            onClick={() =>
              run(() =>
                onApplyMaterialToSimilar(
                  mod?.carcass.doorMaterialId || null,
                  target.componentId,
                  "module_similar"
                )
              )
            }
          />
          <MenuItem
            label="Malzemeyi Tüm Projedeki Kapaklara Yay"
            onClick={() =>
              run(() =>
                onApplyMaterialToSimilar(
                  mod?.carcass.doorMaterialId || null,
                  target.componentId,
                  "project_similar"
                )
              )
            }
          />
          <MenuDivider />
        </>
      )}

      {isShelf && shelf && (
        <>
          <MenuSectionTitle title={`Raf (Kot: ${Math.round(shelf.elevationY)} mm)`} />
          <div className="grid grid-cols-2 gap-1 px-1.5 py-1">
            <button
              type="button"
              onClick={() => run(() => onSetShelfElevation(bayIdx, shelf.id, shelf.elevationY + 32))}
              className="py-1 rounded-md text-[10.5px] font-semibold bg-black/5 hover:bg-black/10 text-[#1C1917] cursor-pointer"
            >
              ↑ +32 mm
            </button>
            <button
              type="button"
              onClick={() =>
                run(() =>
                  onSetShelfElevation(bayIdx, shelf.id, Math.max(64, shelf.elevationY - 32))
                )
              }
              className="py-1 rounded-md text-[10.5px] font-semibold bg-black/5 hover:bg-black/10 text-[#1C1917] cursor-pointer"
            >
              ↓ -32 mm
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1 px-1.5 pb-1">
            {[18, 25].map((th) => (
              <button
                key={th}
                type="button"
                onClick={() => run(() => onSetShelfThickness(bayIdx, shelf.id, th))}
                className={`py-1 rounded-md text-[10px] font-bold cursor-pointer ${
                  (shelf.thickness || mod?.carcass.panelThickness || 18) === th
                    ? "bg-[#141413] text-white"
                    : "bg-black/5 text-[#44403C] hover:bg-black/10"
                }`}
              >
                {th} mm Kalınlık
              </button>
            ))}
          </div>
          {mod && mod.bays.length > 1 && (
            <>
              {bayIdx > 0 && (
                <MenuItem
                  label={`← Sol Bölmeye Taşı (Bölme ${bayIdx})`}
                  onClick={() =>
                    run(() => onMoveInteriorItemToBay("shelf", bayIdx, shelf.id, bayIdx - 1))
                  }
                />
              )}
              {bayIdx < mod.bays.length - 1 && (
                <MenuItem
                  label={`→ Sağ Bölmeye Taşı (Bölme ${bayIdx + 2})`}
                  onClick={() =>
                    run(() => onMoveInteriorItemToBay("shelf", bayIdx, shelf.id, bayIdx + 1))
                  }
                />
              )}
            </>
          )}
          <MenuItem
            label="Bu Rafı Sil"
            shortcut="Del"
            danger
            onClick={() => run(() => onRemoveSelectedInteriorComponent(target.componentId))}
          />
          <MenuDivider />
        </>
      )}

      {isDrawer && drawer && (
        <>
          <MenuSectionTitle
            title={`Çekmece (H:${Math.round(drawer.height)} • Y:${Math.round(drawer.elevationY)})`}
          />
          <MenuItem
            label={drawerOpenMm > 10 ? "Çekmeceyi Kapat" : "Çekmeceyi Aç"}
            active={drawerOpenMm > 10}
            onClick={() => run(onToggleDrawerOpen)}
          />
          <div className="grid grid-cols-2 gap-1 px-1.5 py-1">
            <button
              type="button"
              onClick={() =>
                run(() =>
                  onSetDrawerPlacement(bayIdx, drawer.id, drawer.elevationY + 32, drawer.height)
                )
              }
              className="py-1 rounded-md text-[10.5px] font-semibold bg-black/5 hover:bg-black/10 text-[#1C1917] cursor-pointer"
            >
              ↑ +32 mm
            </button>
            <button
              type="button"
              onClick={() =>
                run(() =>
                  onSetDrawerPlacement(
                    bayIdx,
                    drawer.id,
                    Math.max(0, drawer.elevationY - 32),
                    drawer.height
                  )
                )
              }
              className="py-1 rounded-md text-[10.5px] font-semibold bg-black/5 hover:bg-black/10 text-[#1C1917] cursor-pointer"
            >
              ↓ -32 mm
            </button>
          </div>
          {mod && mod.bays.length > 1 && (
            <>
              {bayIdx > 0 && (
                <MenuItem
                  label={`← Sol Bölmeye Taşı (Bölme ${bayIdx})`}
                  onClick={() =>
                    run(() => onMoveInteriorItemToBay("drawer", bayIdx, drawer.id, bayIdx - 1))
                  }
                />
              )}
              {bayIdx < mod.bays.length - 1 && (
                <MenuItem
                  label={`→ Sağ Bölmeye Taşı (Bölme ${bayIdx + 2})`}
                  onClick={() =>
                    run(() => onMoveInteriorItemToBay("drawer", bayIdx, drawer.id, bayIdx + 1))
                  }
                />
              )}
            </>
          )}
          <MenuItem
            label="Bu Çekmeceyi Sil"
            shortcut="Del"
            danger
            onClick={() => run(() => onRemoveSelectedInteriorComponent(target.componentId))}
          />
          <MenuDivider />
        </>
      )}

      {isRail && rail && (
        <>
          <MenuSectionTitle title={`Askı Borusu (Kot: ${Math.round(rail.elevationY)} mm)`} />
          <div className="grid grid-cols-2 gap-1 px-1.5 py-1">
            <button
              type="button"
              onClick={() =>
                run(() => onSetHangingRailElevation(bayIdx, rail.id, rail.elevationY + 32))
              }
              className="py-1 rounded-md text-[10.5px] font-semibold bg-black/5 hover:bg-black/10 text-[#1C1917] cursor-pointer"
            >
              ↑ +32 mm
            </button>
            <button
              type="button"
              onClick={() =>
                run(() =>
                  onSetHangingRailElevation(bayIdx, rail.id, Math.max(200, rail.elevationY - 32))
                )
              }
              className="py-1 rounded-md text-[10.5px] font-semibold bg-black/5 hover:bg-black/10 text-[#1C1917] cursor-pointer"
            >
              ↓ -32 mm
            </button>
          </div>
          {mod && mod.bays.length > 1 && (
            <>
              {bayIdx > 0 && (
                <MenuItem
                  label={`← Sol Bölmeye Taşı (Bölme ${bayIdx})`}
                  onClick={() =>
                    run(() => onMoveInteriorItemToBay("rail", bayIdx, rail.id, bayIdx - 1))
                  }
                />
              )}
              {bayIdx < mod.bays.length - 1 && (
                <MenuItem
                  label={`→ Sağ Bölmeye Taşı (Bölme ${bayIdx + 2})`}
                  onClick={() =>
                    run(() => onMoveInteriorItemToBay("rail", bayIdx, rail.id, bayIdx + 1))
                  }
                />
              )}
            </>
          )}
          <MenuItem
            label="Askı Borusunu Sil"
            shortcut="Del"
            danger
            onClick={() => run(() => onRemoveSelectedInteriorComponent(target.componentId))}
          />
          <MenuDivider />
        </>
      )}

      {(isBayInterior || isShelf || isDrawer || isRail) && (
        <>
          <MenuSectionTitle title={`Bölme ${bayIdx + 1} — Hızlı Ekle`} />
          <div className="grid grid-cols-2 gap-1 px-1.5 py-1">
            <button
              type="button"
              onClick={() =>
                run(() => onAddInteriorItemAtElevation(bayIdx, "shelf", spawnElevationY))
              }
              className="py-1 px-2 rounded-md text-[10.5px] font-semibold bg-black/5 hover:bg-black/10 text-[#1C1917] cursor-pointer text-left"
            >
              + Raf Ekle
            </button>
            <button
              type="button"
              onClick={() =>
                run(() => onAddInteriorItemAtElevation(bayIdx, "drawer", spawnElevationY))
              }
              className="py-1 px-2 rounded-md text-[10.5px] font-semibold bg-black/5 hover:bg-black/10 text-[#1C1917] cursor-pointer text-left"
            >
              + Çekmece
            </button>
            <button
              type="button"
              onClick={() =>
                run(() => onAddInteriorItemAtElevation(bayIdx, "hanging_rail", spawnElevationY))
              }
              className="py-1 px-2 rounded-md text-[10.5px] font-semibold bg-black/5 hover:bg-black/10 text-[#1C1917] cursor-pointer text-left"
            >
              + Askı Borusu
            </button>
            <button
              type="button"
              onClick={() =>
                run(() => onAddInteriorItemAtElevation(bayIdx, "sub_divider", spawnElevationY))
              }
              className="py-1 px-2 rounded-md text-[10.5px] font-semibold bg-black/5 hover:bg-black/10 text-[#1C1917] cursor-pointer text-left"
            >
              + Ara Dikme
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1 px-1.5 pb-1">
            <button
              type="button"
              onClick={() => run(() => onApplyBayInteriorPreset(bayIdx, "shelves_5"))}
              className="py-1 rounded-md text-[10px] font-semibold bg-black/5 hover:bg-black/10 text-[#44403C] cursor-pointer"
            >
              5 Raf
            </button>
            <button
              type="button"
              onClick={() => run(() => onApplyBayInteriorPreset(bayIdx, "rail_double"))}
              className="py-1 rounded-md text-[10px] font-semibold bg-black/5 hover:bg-black/10 text-[#44403C] cursor-pointer"
            >
              Çift Askı
            </button>
            <button
              type="button"
              onClick={() => run(() => onApplyBayInteriorPreset(bayIdx, "rail_drawers_3"))}
              className="py-1 rounded-md text-[10px] font-semibold bg-black/5 hover:bg-black/10 text-[#44403C] cursor-pointer"
            >
              Askı+3Çek
            </button>
          </div>
          <MenuItem
            label="Bölmeyi İkiye Böl"
            onClick={() => run(() => onSplitBayIntoTwo(bayIdx))}
          />
          <MenuItem
            label="Bölmeleri & Rafları Eşitle"
            onClick={() => run(() => onEqualizeBaysAndShelves(bayIdx))}
          />
          {mod && mod.bays.length > 1 && (
            <MenuItem
              label={`Bölme ${bayIdx + 1}'i Sil`}
              danger
              onClick={() => run(() => onRemoveBayAt(bayIdx))}
            />
          )}
          <MenuDivider />
        </>
      )}

      <MenuSectionTitle title="Modül İşlemleri" />
      <MenuItem
        label="Yanına Aynı Modülden Ekle"
        onClick={() => run(() => onAddAdjacentModule("right"))}
      />
      <MenuItem label="Modülü Çoğalt" onClick={() => run(onDuplicateActiveModule)} />
      <MenuItem label="Modülü 90° Çevir" onClick={() => run(() => onRotateActiveModule90(90))} />
      {project.modules.length > 1 && (
        <div className="grid grid-cols-2 gap-1 px-1.5 py-1">
          <button
            type="button"
            disabled={target.modIdx === 0}
            onClick={() => run(() => onSwapModuleWithNeighbor(target.modIdx, -1))}
            className="py-1 rounded-md text-[10px] font-semibold bg-black/5 hover:bg-black/10 disabled:opacity-35 text-[#1C1917] cursor-pointer"
          >
            ← Sola Kaydır
          </button>
          <button
            type="button"
            disabled={target.modIdx >= project.modules.length - 1}
            onClick={() => run(() => onSwapModuleWithNeighbor(target.modIdx, 1))}
            className="py-1 rounded-md text-[10px] font-semibold bg-black/5 hover:bg-black/10 disabled:opacity-35 text-[#1C1917] cursor-pointer"
          >
            Sağa Kaydır →
          </button>
        </div>
      )}
      <MenuItem
        label={
          mod?.carcass.ledLightingEnabled ? "Dolap İçi LED: Açık" : "Dolap İçi LED: Kapalı"
        }
        active={Boolean(mod?.carcass.ledLightingEnabled)}
        onClick={() =>
          run(() => onToggleModuleLedLighting(!Boolean(mod?.carcass.ledLightingEnabled)))
        }
      />
      <div className="grid grid-cols-3 gap-1 px-1.5 py-1">
        {[0, 80, 100].map((ph) => (
          <button
            key={ph}
            type="button"
            onClick={() => run(() => onSetPlinthHeight(ph))}
            className={`py-1 rounded-md text-[10px] font-bold cursor-pointer ${
              (mod?.carcass.plinthHeight ?? 80) === ph
                ? "bg-[#141413] text-white"
                : "bg-black/5 text-[#44403C] hover:bg-black/10"
            }`}
          >
            Baza {ph}
          </button>
        ))}
      </div>
      {project.modules.length > 1 && (
        <MenuItem label="Modülü Sil" danger onClick={() => run(onRemoveActiveModule)} />
      )}
    </div>
  );
};
