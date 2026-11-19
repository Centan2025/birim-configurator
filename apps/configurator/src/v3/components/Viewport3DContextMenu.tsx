"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { DEFAULT_MATERIALS, type DesignProject, type ModuleInstance } from "@birim/core";
import { V4_MODULE_TEMPLATES } from "@birim/catalog";
import { useConfiguratorStore } from "../../store/useConfiguratorStore";

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
  onReplaceModuleWithTemplate?: (modIdx: number, templateId: string) => void;
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
    <span className="leading-snug">{label}</span>
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
  onReplaceModuleWithTemplate,
  onToggleModuleLedLighting,
  onSetPlinthHeight,
  onRemoveActiveModule,
  onRemoveSpaceObstacle,
  onUndo,
  onRedo,
}) => {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: -9999, top: -9999 });
  const [showAllMaterials, setShowAllMaterials] = useState(false);
  const [showReplaceTemplates, setShowReplaceTemplates] = useState(false);
  const [replaceQuery, setReplaceQuery] = useState("");

  useEffect(() => {
    setShowAllMaterials(false);
  }, [target]);

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
  }, [target, showAllMaterials]);

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
    const obs3d = (project.space.elements || []).find((o) => o.id === target.obstacleId);
    return (
      <div
        ref={menuRef}
        data-testid="viewport-3d-context-menu"
        style={{ left: pos.left, top: pos.top }}
        onContextMenu={(e) => e.preventDefault()}
        className="fixed z-50 w-64 birim-ice-popover rounded-2xl p-1.5 shadow-2xl border border-white/60"
      >
        <div className="px-2.5 py-1.5 border-b border-black/8 mb-1">
          <div className="text-[11px] font-bold text-[#141413] truncate">{target.label}</div>
          <div className="text-[9.5px] text-[#78716C]">Mimari Yapı Elemanı</div>
        </div>
        <MenuItem
          label={`⇄ Yönü Aynala (${obs3d?.doorSwing === "right" ? "Sağ → Sol" : "Sol → Sağ"})`}
          onClick={() =>
            run(() =>
              useConfiguratorStore.getState().updateSpaceObstacle(target.obstacleId, {
                doorSwing: obs3d?.doorSwing === "right" ? "left" : "right",
              })
            )
          }
        />
        {obs3d?.type === "door" && (
          <MenuItem
            label={`⇅ Açılımı Çevir (${obs3d.doorOpenSide === "outward" ? "Dışa → İçe" : "İçe → Dışa"})`}
            onClick={() =>
              run(() =>
                useConfiguratorStore.getState().updateSpaceObstacle(target.obstacleId, {
                  doorOpenSide: obs3d.doorOpenSide === "outward" ? "inward" : "outward",
                })
              )
            }
          />
        )}
        <MenuItem
          label="🔄 90° Döndür"
          onClick={() =>
            run(() =>
              useConfiguratorStore.getState().updateSpaceObstacle(target.obstacleId, {
                rotationY: ((obs3d?.rotationY || 0) + 90) % 360,
              })
            )
          }
        />
        <MenuDivider />
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

      {isDoor && bay && (() => {
        const isTambourDoor =
          bay.door.type === "tambour" ||
          bay.door.doorSystemId === "tambour_roller" ||
          mod?.carcass?.hullShape === "capsule_stadium" ||
          mod?.carcass?.hullShape === "capsule_table";
        const isSingleSwingDoor =
          bay.door.type === "single_left" ||
          bay.door.type === "single_right" ||
          bay.door.type === "inset_left" ||
          bay.door.type === "inset_right";
        return (
          <>
            <MenuSectionTitle title={isTambourDoor ? "Tambur Kapak Kontrolleri" : "Kapak Kontrolleri"} />
            <MenuItem
              label={
                isTambourDoor
                  ? doorOpenAngleDeg > 5
                    ? "Tamburu Kapat"
                    : "Tamburu Kaydırarak Aç"
                  : doorOpenAngleDeg > 5
                  ? "Kapağı Kapat"
                  : "Kapağı Aç (85°)"
              }
              shortcut="Space"
              active={doorOpenAngleDeg > 5}
              onClick={() => run(onToggleDoorOpen)}
            />
            <MenuItem
              label={
                isTambourDoor
                  ? doorsHiddenIn3D
                    ? "Tamburu Göster"
                    : "Tamburu Gizle (İç Düzenle)"
                  : doorsHiddenIn3D
                  ? "Kapakları Göster"
                  : "Kapakları Gizle (İç Düzenle)"
              }
              active={doorsHiddenIn3D}
              onClick={() => run(onToggleDoorsHidden)}
            />
            {isSingleSwingDoor && !isTambourDoor && (
              <MenuItem
                label="Açılış Yönünü Çevir (Sol ⇄ Sağ)"
                onClick={() => run(onFlipDoorDirection)}
              />
            )}
            {!isTambourDoor && (
              <>
                <MenuItem
                  label="Bu Kulbu & Modeli Tüm Kapaklara Eşitle"
                  onClick={() =>
                    run(() => {
                      const st = useConfiguratorStore.getState();
                      const srcDoor = bay.door;
                      const updated = JSON.parse(JSON.stringify(st.project)) as DesignProject;
                      updated.modules.forEach((m) => {
                        if (m.category === "complementary") return;
                        m.bays.forEach((b) => {
                          if (b.door && b.door.type !== "open") {
                            b.door.handleProfileId = srcDoor.handleProfileId;
                            b.door.handleCategory = srcDoor.handleCategory;
                            b.door.handleMaterialId = srcDoor.handleMaterialId;
                            b.door.handleLengthMm = srcDoor.handleLengthMm;
                            b.door.crossSectionProfile = srcDoor.crossSectionProfile;
                            b.door.isGlassFramed = srcDoor.isGlassFramed;
                          }
                        });
                      });
                      st.importProjectJSON(JSON.stringify(updated));
                    })
                  }
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
              </>
            )}
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
        );
      })()}

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

      <MenuSectionTitle title="Parçaya Malzeme Ata" />
      <div
        className={`grid grid-cols-6 gap-1 px-2 py-1 ${
          showAllMaterials ? "max-h-44 overflow-y-auto" : ""
        }`}
      >
        {(showAllMaterials ? DEFAULT_MATERIALS : DEFAULT_MATERIALS.slice(0, 12)).map((mat) => {
          const curOverride = mod?.componentMaterialOverrides?.[target.componentId];
          const isCur = curOverride === mat.id;
          return (
            <button
              key={mat.id}
              type="button"
              title={mat.name}
              onClick={() =>
                run(() => onApplyMaterialToSimilar(mat.id, target.componentId, "single"))
              }
              className={`w-7 h-7 rounded-lg border transition cursor-pointer ${
                isCur
                  ? "border-[#2563EB] ring-2 ring-[#2563EB]/30 scale-105"
                  : "border-black/15 hover:scale-105"
              }`}
              style={{ backgroundColor: mat.colorHex }}
            />
          );
        })}
      </div>
      {DEFAULT_MATERIALS.length > 12 && (
        <div className="px-2 pb-1">
          <button
            type="button"
            onClick={() => setShowAllMaterials((v) => !v)}
            className="w-full py-1 rounded-md text-[10.5px] font-semibold bg-black/5 hover:bg-black/10 text-[#44403C] transition cursor-pointer"
          >
            {showAllMaterials
              ? "Daha Az Göster"
              : `Tüm Malzemeler (+${DEFAULT_MATERIALS.length - 12})`}
          </button>
        </div>
      )}
      <MenuItem
        label="Modüldeki Benzerlere Uygula"
        onClick={() =>
          run(() => {
            const curMat =
              mod?.componentMaterialOverrides?.[target.componentId] ||
              (isDoor ? mod?.carcass.doorMaterialId : mod?.carcass.bodyMaterialId) ||
              null;
            onApplyMaterialToSimilar(curMat, target.componentId, "module_similar");
          })
        }
      />
      <MenuItem
        label="Projedeki Benzerlere Uygula"
        onClick={() =>
          run(() => {
            const curMat =
              mod?.componentMaterialOverrides?.[target.componentId] ||
              (isDoor ? mod?.carcass.doorMaterialId : mod?.carcass.bodyMaterialId) ||
              null;
            onApplyMaterialToSimilar(curMat, target.componentId, "project_similar");
          })
        }
      />
      <MenuDivider />

      <MenuSectionTitle title="Modül İşlemleri" />
      {onReplaceModuleWithTemplate && mod && (
        <div className="mb-1">
          <MenuItem
            label={showReplaceTemplates ? "▾ Modülü Şablonla Değiştir" : "▸ Modülü Hazır Şablonla Değiştir"}
            active={showReplaceTemplates}
            onClick={() => setShowReplaceTemplates((v) => !v)}
          />
          {showReplaceTemplates && (
            <div className="mt-1 mx-1 p-1.5 rounded-xl bg-black/[0.04] border border-black/10 space-y-1.5">
              <input
                type="text"
                value={replaceQuery}
                onChange={(e) => setReplaceQuery(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="Modül ara (fırın, evye, çekmece...)"
                className="w-full h-7 px-2 rounded-lg bg-white border border-black/15 text-[11px] text-[#141413] placeholder:text-[#78716C] focus:outline-none focus:border-[#141413]"
              />
              <div className="max-h-44 overflow-y-auto space-y-0.5 pr-0.5">
                {V4_MODULE_TEMPLATES.filter((t) => {
                  const isWallMod =
                    mod.moduleFamilyId === "fam_kitchen_wall" ||
                    mod.category === "kitchen_wall" ||
                    mod.position.y >= 1100;
                  const isBaseMod =
                    !isWallMod &&
                    (mod.moduleFamilyId === "fam_kitchen_base" ||
                      mod.category === "kitchen_base" ||
                      mod.category === "kitchen_corner" ||
                      mod.dimensions.height <= 1050);
                  const familyOk = isWallMod
                    ? t.familyId === "fam_kitchen_wall"
                    : isBaseMod
                    ? t.familyId === "fam_kitchen_base"
                    : !t.familyId.startsWith("fam_kitchen_base") &&
                      !t.familyId.startsWith("fam_kitchen_wall") &&
                      t.familyId !== "fam_complementary";
                  if (!familyOk) return false;
                  const q = replaceQuery.trim().toLowerCase();
                  return !q || `${t.name} ${t.description || ""}`.toLowerCase().includes(q);
                })
                  .slice(0, 18)
                  .map((tpl) => (
                    <button
                      key={tpl.templateId}
                      type="button"
                      onClick={() =>
                        run(() => onReplaceModuleWithTemplate(target.modIdx, tpl.templateId))
                      }
                      className={`w-full px-2 py-1.5 rounded-lg text-left text-[11px] font-medium transition cursor-pointer flex items-center justify-between gap-2 ${
                        mod.templateId === tpl.templateId
                          ? "bg-[#141413] text-white"
                          : "hover:bg-white text-[#1C1917]"
                      }`}
                    >
                      <span className="truncate">{tpl.name}</span>
                      <span className="text-[9.5px] font-mono opacity-65 shrink-0">Uyumlu</span>
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
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
