"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  DoorOpen,
  DoorClosed,
  Eye,
  EyeOff,
  FlipHorizontal,
  Copy,
  ClipboardPaste,
  Plus,
  Files,
  RotateCw,
  Lightbulb,
  Trash2,
  Layers,
  Globe,
  Sparkles,
  Palette,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  ArrowLeftRight,
  ArrowUpDown,
  Columns2,
  Undo2,
  Redo2,
  Focus,
  RefreshCw,
  SlidersHorizontal,
  Lock,
  Unlock,
  AlignVerticalSpaceAround,
} from "lucide-react";
import {
  DEFAULT_MATERIALS,
  computeBayDoorZones,
  resolveDoorZoneKeyFromComponentId,
  type DesignProject,
  type ModuleInstance,
} from "@birim/core";
import { V4_MODULE_TEMPLATES } from "@birim/catalog";
import { useConfiguratorStore } from "../../store/useConfiguratorStore";
import {
  getCopiedModuleStyleClipboard,
  setCopiedModuleStyleClipboard,
  extractModuleStyleSnapshot,
  applyCopiedStyleToProjectDraft,
  dispatchLive3DMaterialPreview,
} from "../../v11/quickMaterialAndMoodboardEngine";

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
      kind: "wall";
      wallId: string;
      wallName: string;
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
    height?: number,
    pushHistory?: boolean,
    hardwareUpdates?: { isInternal?: boolean }
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

function resolveContextMenuIcon(
  label: string,
  danger?: boolean,
  active?: boolean
): React.ReactNode {
  const cls = `w-3.5 h-3.5 shrink-0 ${
    danger ? "text-rose-300" : active ? "text-sky-300" : "opacity-80"
  }`;
  if (danger) return <Trash2 className={cls} />;
  const l = label.toLowerCase();
  if (l.includes("eşitle")) return <AlignVerticalSpaceAround className={cls} />;
  if (l.includes("geri al")) return <Undo2 className={cls} />;
  if (l.includes("ileri al")) return <Redo2 className={cls} />;
  if (l.includes("çekmece") && (l.includes("aç") || l.includes("kapat"))) {
    return <ArrowUpDown className={cls} />;
  }
  if (l.includes("kapat")) return <DoorClosed className={cls} />;
  if (l.includes("aç")) return <DoorOpen className={cls} />;
  if (l.includes("gizle")) return <EyeOff className={cls} />;
  if (l.includes("göster")) return <Eye className={cls} />;
  if (l.includes("iç → dış") || l.includes("dış → iç") || l.includes("çevir")) {
    return <ArrowLeftRight className={cls} />;
  }
  if (l.includes("sol bölme") || l.startsWith("←")) return <ArrowLeft className={cls} />;
  if (l.includes("sağ bölme") || l.startsWith("→")) return <ArrowRight className={cls} />;
  if (l.includes("sabit") || l.includes("kilitle")) return <Lock className={cls} />;
  if (l.includes("hareketli")) return <Unlock className={cls} />;
  if (l.includes("ayna") || l.includes("simetri")) return <FlipHorizontal className={cls} />;
  if (l.includes("döndür") || l.includes("90°")) return <RotateCw className={cls} />;
  if (l.includes("çoğalt") || l.includes("kopyala")) return <Copy className={cls} />;
  if (l.includes("yapıştır")) return <ClipboardPaste className={cls} />;
  if (l.includes("ikiye") || l.includes("böl") || l.includes("dikme")) return <Columns2 className={cls} />;
  if (l.includes("raf") || l.includes("çekmece") || l.includes("askı")) return <Layers className={cls} />;
  if (l.includes("ekle") || l.startsWith("+")) return <Plus className={cls} />;
  if (l.includes("odak") || l.includes("sığdır") || l.includes("kamera")) return <Focus className={cls} />;
  if (l.includes("değiştir") || l.includes("şablon")) return <RefreshCw className={cls} />;
  if (l.includes("renk") || l.includes("malzeme") || l.includes("boya")) return <Palette className={cls} />;
  if (l.includes("led") || l.includes("ışık")) return <Lightbulb className={cls} />;
  if (l.includes("kot") || l.includes("yükseklik") || l.includes("ölçü")) return <ArrowUpDown className={cls} />;
  if (l.includes("ayar") || l.includes("panel") || l.includes("özellik")) return <SlidersHorizontal className={cls} />;
  if (l.includes("hazır") || l.includes("düzen")) return <Sparkles className={cls} />;
  return <ChevronRight className={cls} />;
}

const MenuItem: React.FC<MenuItemProps> = ({
  label,
  shortcut,
  active,
  danger,
  disabled,
  onClick,
}) => {
  const cleanLabel = label.replace(/^[←→]\s*/, "");
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-3 px-2.5 py-1.5 rounded-lg text-[11.5px] text-left transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
        danger
          ? "mt-0.5 bg-rose-500/18 hover:bg-rose-500/32 border border-rose-400/35 text-rose-200 hover:text-white font-semibold"
          : active
          ? "bg-[#141413] text-white font-medium"
          : "text-[#1C1917] hover:bg-black/6 font-medium"
      }`}
    >
      <span className="leading-snug inline-flex items-center gap-2 min-w-0">
        {resolveContextMenuIcon(label, danger, active)}
        <span className="truncate">{cleanLabel}</span>
      </span>
      {shortcut && (
        <span
          className={`text-[10px] font-mono shrink-0 ${
            danger ? "text-rose-200/90" : active ? "text-stone-300" : "text-[#78716C]"
          }`}
        >
          {shortcut}
        </span>
      )}
    </button>
  );
};

const MenuSectionTitle: React.FC<{ title: string }> = ({ title }) => {
  const t = title.toLowerCase();
  const isBaySection = t.includes("bölme") || t.includes("ekle") || t.includes("iç düzen");
  const isMatSection = t.includes("malzeme") || t.includes("renk") || t.includes("kaplama");
  const isModuleSection = t.includes("modül") || t.includes("dolap") || t.includes("gövde");
  const isSceneSection = t.includes("sahne") || t.includes("görünüm") || t.includes("kamera");

  const badgeStyle = isBaySection
    ? "bg-amber-500/20 border-amber-400/40 border-l-amber-400 text-amber-100"
    : isMatSection
    ? "bg-emerald-500/20 border-emerald-400/40 border-l-emerald-400 text-emerald-100"
    : isModuleSection
    ? "bg-violet-500/20 border-violet-400/40 border-l-violet-400 text-violet-100"
    : isSceneSection
    ? "bg-slate-500/20 border-slate-400/35 border-l-slate-300 text-slate-100"
    : "bg-sky-500/20 border-sky-400/40 border-l-sky-400 text-sky-100";

  const pillTag = isBaySection
    ? "BÖLME"
    : isMatSection
    ? "YÜZEY"
    : isModuleSection
    ? "MODÜL"
    : isSceneSection
    ? "SAHNE"
    : "PARÇA";

  const pillStyle = isBaySection
    ? "bg-amber-400 text-[#141413]"
    : isMatSection
    ? "bg-emerald-400 text-[#141413]"
    : isModuleSection
    ? "bg-violet-400 text-[#141413]"
    : isSceneSection
    ? "bg-slate-300 text-[#141413]"
    : "bg-sky-400 text-[#141413]";

  const SectionIcon = isBaySection
    ? Columns2
    : isMatSection
    ? Palette
    : isModuleSection
    ? Sparkles
    : isSceneSection
    ? Globe
    : SlidersHorizontal;

  return (
    <div
      className={`mt-2 mb-1.5 px-2 py-1.5 rounded-lg border border-l-[3px] flex items-center justify-between gap-1.5 text-[9.5px] font-bold uppercase tracking-wider ${badgeStyle}`}
    >
      <span className="inline-flex items-center gap-1.5 min-w-0">
        <SectionIcon className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate">{title}</span>
      </span>
      <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold tracking-widest shrink-0 ${pillStyle}`}>
        {pillTag}
      </span>
    </div>
  );
};

const MenuDivider: React.FC = () => <div className="my-2.5 h-px bg-white/20" />;

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
    const el = menuRef.current;
    const pad = 12;

    const recalcPosition = () => {
      if (!menuRef.current) return;
      // Use offsetWidth / offsetHeight instead of getBoundingClientRect so pop-in CSS scale animations never under-measure height!
      const rawW = Math.max(menuRef.current.offsetWidth || 256, 220);
      const maxAllowedH = Math.max(200, window.innerHeight - pad * 2);
      const rawH = Math.min(menuRef.current.offsetHeight || 320, maxAllowedH);
      const left = Math.max(
        pad,
        Math.min(window.innerWidth - rawW - pad, target.clientX)
      );
      const top = Math.max(
        pad,
        Math.min(window.innerHeight - rawH - pad, target.clientY)
      );
      setPos({ left, top });
    };

    recalcPosition();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(recalcPosition) : null;
    ro?.observe(el);
    window.addEventListener("resize", recalcPosition);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", recalcPosition);
    };
  }, [target, showAllMaterials, showReplaceTemplates, replaceQuery]);

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

  if (target.kind === "wall") {
    const isMainWall = target.wallId === "wall_main";
    const canDeleteWall = !isMainWall && (project.space?.walls?.length || 0) > 1;
    return (
      <div
        ref={menuRef}
        data-testid="viewport-3d-context-menu"
        style={{ left: pos.left, top: pos.top }}
        onContextMenu={(e) => e.preventDefault()}
        className="fixed z-50 w-56 birim-ice-popover birim-stretch-pop-in rounded-2xl p-2 shadow-2xl border border-white/30 space-y-1.5"
      >
        <div className="px-2 py-1 border-b border-white/12">
          <div className="text-[11.5px] font-bold text-white truncate">{target.wallName}</div>
          <div className="text-[9.5px] text-slate-300">Mimari Oda Duvarı</div>
        </div>
        <button
          type="button"
          onClick={() =>
            run(() => {
              useConfiguratorStore.getState().setActiveWallId(target.wallId);
              if (typeof window !== "undefined") {
                window.dispatchEvent(
                  new CustomEvent("birim:wall-selected-3d", {
                    detail: { wallId: target.wallId, wallName: target.wallName },
                  })
                );
              }
            })
          }
          className="w-full py-1.5 px-2.5 rounded-xl bg-white/10 hover:bg-white/18 text-slate-100 text-[11px] font-bold flex items-center gap-2 cursor-pointer"
        >
          <Layers className="w-4 h-4 text-[#7DD3FC]" />
          <span>Hedef Duvar Yap</span>
        </button>
        {canDeleteWall ? (
          <button
            type="button"
            onClick={() =>
              run(() => {
                const st = useConfiguratorStore.getState();
                st.applyBatchProjectUpdate((draft) => {
                  draft.space.walls = (draft.space.walls || []).filter((w) => w.id !== target.wallId);
                  if (draft.space.walls.length === 1) {
                    (draft.space as unknown as { shape?: string }).shape = "rectangular";
                  } else if (draft.space.walls.length === 2) {
                    (draft.space as unknown as { shape?: string }).shape = "l_shape";
                  }
                }, `${target.wallName} silindi`);
                st.setActiveWallId("wall_main");
              })
            }
            className="w-full py-1.5 px-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/32 border border-rose-400/35 text-rose-200 text-[11px] font-bold flex items-center gap-2 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Duvarı Sahneden Sil</span>
          </button>
        ) : (
          <div className="px-2 py-1 text-[10px] text-slate-400">
            Ana duvar silinemez.
          </div>
        )}
      </div>
    );
  }

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
        <MenuItem
          label="🎨 Hızlı Kartela & Kombinasyonlar"
          shortcut="M"
          onClick={() =>
            run(() => {
              if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("birim:toggle-quick-palette-dock"));
              }
            })
          }
        />
        <MenuItem
          label="🖌️ 3B Boya Kovası Modu"
          shortcut="B"
          onClick={() =>
            run(() => {
              if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("birim:toggle-paint-bucket-shortcut"));
              }
            })
          }
        />
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
  const isSpecialFitting = role === "special_fitting" || target.componentId.includes("_fitting_");
  const matchedFitting = bay?.specialFittings?.find(
    (f) => target.componentId.startsWith(f.id) || target.componentId.includes(f.id)
  );
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
      className="fixed z-50 w-[256px] max-h-[82vh] overflow-y-auto birim-ice-popover birim-stretch-pop-in rounded-2xl p-2 shadow-2xl border border-white/30"
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
            <div className="grid grid-cols-4 gap-1 py-1">
              <button
                type="button"
                title={doorOpenAngleDeg > 5 ? "Kapağı Kapat (Space)" : "Kapağı Aç (Space)"}
                onClick={() => run(onToggleDoorOpen)}
                className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl text-[9.5px] font-bold transition cursor-pointer ${
                  doorOpenAngleDeg > 5 ? "bg-[#0284C7] text-white" : "bg-white/10 hover:bg-white/18 text-slate-200"
                }`}
              >
                {doorOpenAngleDeg > 5 ? <DoorClosed className="w-4 h-4" /> : <DoorOpen className="w-4 h-4" />}
                <span>{doorOpenAngleDeg > 5 ? "Kapat" : "Aç"}</span>
              </button>
              <button
                type="button"
                title={doorsHiddenIn3D ? "Kapakları Göster" : "Kapakları Gizle (İç Düzenle)"}
                onClick={() => run(onToggleDoorsHidden)}
                className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl text-[9.5px] font-bold transition cursor-pointer ${
                  doorsHiddenIn3D ? "bg-[#0284C7] text-white" : "bg-white/10 hover:bg-white/18 text-slate-200"
                }`}
              >
                {doorsHiddenIn3D ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                <span>{doorsHiddenIn3D ? "Göster" : "Gizle"}</span>
              </button>
              {!isTambourDoor && (
                <button
                  type="button"
                  title="Bu Kulbu & Kapak Modelini Tüm Kapaklara Eşitle"
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
                  className="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl text-[9.5px] font-bold bg-white/10 hover:bg-white/18 text-slate-200 transition cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Eşitle</span>
                </button>
              )}
              {isSingleSwingDoor && !isTambourDoor ? (
                <button
                  type="button"
                  title="Açılış Yönünü Çevir (Sol ⇄ Sağ)"
                  onClick={() => run(onFlipDoorDirection)}
                  className="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl text-[9.5px] font-bold bg-white/10 hover:bg-white/18 text-slate-200 transition cursor-pointer"
                >
                  <FlipHorizontal className="w-4 h-4" />
                  <span>Yön</span>
                </button>
              ) : (
                <button
                  type="button"
                  title="Malzemeyi Tüm Projedeki Kapaklara Yay"
                  onClick={() =>
                    run(() =>
                      onApplyMaterialToSimilar(
                        mod?.carcass.doorMaterialId || null,
                        target.componentId,
                        "project_similar"
                      )
                    )
                  }
                  className="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl text-[9.5px] font-bold bg-white/10 hover:bg-white/18 text-slate-200 transition cursor-pointer"
                >
                  <Globe className="w-4 h-4" />
                  <span>Projeye</span>
                </button>
              )}
            </div>
            {!isTambourDoor && (
              <div className="grid grid-cols-4 gap-1 py-1">
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
                    className={`py-1 rounded-lg text-[10px] font-bold cursor-pointer transition ${
                      bay.door.type === dt.id
                        ? "bg-[#141413] text-white"
                        : "bg-black/5 text-[#44403C] hover:bg-black/10"
                    }`}
                  >
                    {dt.label}
                  </button>
                ))}
              </div>
            )}
            {bay.door.type !== "open" && (() => {
              const zones = mod ? computeBayDoorZones(mod, bayIdx) : [];
              const zKey = resolveDoorZoneKeyFromComponentId(target.componentId);
              const delDoorLabel =
                zones.length === 0
                  ? "Bu Kapağı Sil"
                  : zKey === "lower"
                  ? "Alt Kapağı Sil"
                  : zKey.startsWith("mid_")
                  ? `Orta Kapak ${Number(zKey.slice(4)) + 1}'i Sil`
                  : "Üst Kapağı Sil";
              return (
                <MenuItem
                  label={delDoorLabel}
                  shortcut="Del"
                  danger
                  onClick={() =>
                    run(() => {
                      const st = useConfiguratorStore.getState();
                      if (zones.length > 0) {
                        const nextStates: Record<string, "closed" | "open"> = {
                          ...(bay.door.zoneDoorStates || {}),
                          [zKey]: "open",
                        };
                        const anyRemainingClosed = zones.some(
                          (z) => (z.key in nextStates ? nextStates[z.key] !== "open" : !z.isOpen)
                        );
                        if (!anyRemainingClosed) {
                          onSetBayDoorType(bayIdx, "open");
                        } else {
                          st.applyBatchProjectUpdate((draft) => {
                            const b = draft.modules[target.modIdx]?.bays[bayIdx];
                            if (b?.door) {
                              b.door.zoneDoorStates = nextStates;
                              if (zKey === "upper") b.door.upperZoneDoorState = "open";
                              if (zKey === "lower") b.door.lowerZoneDoorState = "open";
                            }
                          }, `${delDoorLabel}`);
                        }
                      } else {
                        onSetBayDoorType(bayIdx, "open");
                      }
                      st.setSelectedComponentId(null);
                    })
                  }
                />
              );
            })()}
          <MenuDivider />
        </>
        );
      })()}

      {isSpecialFitting && matchedFitting && (
        <div className="space-y-1.5 py-1 border-b border-white/12 mb-1">
          <div className="grid grid-cols-3 gap-1">
            <button
              type="button"
              title="Donanımı +32 mm Yukarı Taşı"
              onClick={() =>
                run(() => {
                  useConfiguratorStore.getState().applyBatchProjectUpdate((draft) => {
                    const f = draft.modules[target.modIdx]?.bays[bayIdx]?.specialFittings?.find((x) => x.id === matchedFitting.id);
                    if (f) f.elevationY = Math.round((f.elevationY || 0) + 32);
                  }, "Donanım kotu yükseltildi");
                })
              }
              className="py-1.5 rounded-lg text-[10px] font-bold bg-white/10 hover:bg-white/18 text-slate-200 cursor-pointer"
            >
              ↑ +32mm
            </button>
            <button
              type="button"
              title="Donanımı -32 mm Aşağı Taşı"
              onClick={() =>
                run(() => {
                  useConfiguratorStore.getState().applyBatchProjectUpdate((draft) => {
                    const f = draft.modules[target.modIdx]?.bays[bayIdx]?.specialFittings?.find((x) => x.id === matchedFitting.id);
                    if (f) f.elevationY = Math.max(40, Math.round((f.elevationY || 0) - 32));
                  }, "Donanım kotu indirildi");
                })
              }
              className="py-1.5 rounded-lg text-[10px] font-bold bg-white/10 hover:bg-white/18 text-slate-200 cursor-pointer"
            >
              ↓ -32mm
            </button>
            <button
              type="button"
              title="Bu Donanımı Sil (Del)"
              onClick={() =>
                run(() => {
                  const st = useConfiguratorStore.getState();
                  st.applyBatchProjectUpdate((draft) => {
                    const b = draft.modules[target.modIdx]?.bays[bayIdx];
                    if (b?.specialFittings) {
                      b.specialFittings = b.specialFittings.filter((x) => x.id !== matchedFitting.id);
                    }
                  }, "İç donanım silindi");
                  st.setSelectedComponentId(null);
                })
              }
              className="py-1.5 rounded-lg text-[10px] font-bold bg-rose-500/22 hover:bg-rose-500/35 border border-rose-400/35 text-rose-200 inline-flex items-center justify-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Sil</span>
            </button>
          </div>
        </div>
      )}

      {isShelf && shelf && (
        <>
          <MenuSectionTitle title={`Raf (Kot: ${Math.round(shelf.elevationY)} mm)`} />
          <div className="ml-2 pl-2 border-l-2 border-sky-400/50 space-y-0.5">
          <div className="grid grid-cols-2 gap-1 py-0.5">
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
          </div>
          <MenuDivider />
        </>
      )}

      {isDrawer && drawer && (
        <>
          <MenuSectionTitle
            title={`Çekmece (H:${Math.round(drawer.height)} • Y:${Math.round(drawer.elevationY)})`}
          />
          <div className="ml-2 pl-2 border-l-2 border-sky-400/50 space-y-0.5">
          <MenuItem
            label={drawerOpenMm > 10 ? "Çekmeceyi Kapat" : "Çekmeceyi Aç"}
            active={drawerOpenMm > 10}
            onClick={() => run(onToggleDrawerOpen)}
          />
          {bay?.door?.type !== "sliding" && !mod?.bays.some((b) => b.door?.type === "sliding") && (
            <MenuItem
              label={drawer.isInternal ? "Dış Çekmeceye Çevir (İç → Dış)" : "İç Çekmeceye Çevir (Dış → İç)"}
              active={Boolean(drawer.isInternal)}
              onClick={() =>
                run(() =>
                  onSetDrawerPlacement(bayIdx, drawer.id, drawer.elevationY, drawer.height, true, {
                    isInternal: !drawer.isInternal,
                  })
                )
              }
            />
          )}
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
          </div>
          <MenuDivider />
        </>
      )}

      {isRail && rail && (
        <>
          <MenuSectionTitle title={`Askı Borusu (Kot: ${Math.round(rail.elevationY)} mm)`} />
          <div className="ml-2 pl-2 border-l-2 border-sky-400/50 space-y-0.5">
          <div className="grid grid-cols-2 gap-1 py-0.5">
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
          </div>
          <MenuDivider />
        </>
      )}

      {(isBayInterior || isShelf || isDrawer || isRail) && (
        <>
          <MenuSectionTitle title={`Bölme ${bayIdx + 1} — Hızlı Ekle`} />
          <div className="ml-2 pl-2 border-l-2 border-amber-400/50 space-y-0.5">
          <div className="grid grid-cols-2 gap-1 py-0.5">
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
          </div>
          <MenuDivider />
        </>
      )}

      <MenuSectionTitle title="Parçaya Malzeme Ata" />
      <div className="ml-2 pl-2 border-l-2 border-emerald-400/50 space-y-1">
      <div
        onMouseLeave={() => dispatchLive3DMaterialPreview(null)}
        className={`grid grid-cols-6 gap-1 py-0.5 ${
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
              onMouseEnter={() =>
                dispatchLive3DMaterialPreview({
                  materialId: mat.id,
                  scope: isDoor ? "active_doors" : "active_module",
                  activeModuleIndex: target.modIdx,
                })
              }
              onClick={() => {
                dispatchLive3DMaterialPreview(null);
                run(() => onApplyMaterialToSimilar(mat.id, target.componentId, "single"));
              }}
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
      <div className="grid grid-cols-3 gap-1 py-1">
        {DEFAULT_MATERIALS.length > 12 && (
          <button
            type="button"
            title="Tüm Malzeme Kartelasını Aç/Kapat"
            onClick={() => setShowAllMaterials((v) => !v)}
            className="py-1.5 px-1.5 rounded-lg text-[10px] font-bold bg-white/10 hover:bg-white/18 text-slate-200 inline-flex items-center justify-center gap-1 cursor-pointer"
          >
            <Palette className="w-3.5 h-3.5" />
            <span>{showAllMaterials ? "Az" : `+${DEFAULT_MATERIALS.length - 12}`}</span>
          </button>
        )}
        <button
          type="button"
          title="Bu Malzemeyi Modüldeki Benzer Parçalara Yay"
          onClick={() =>
            run(() => {
              const curMat =
                mod?.componentMaterialOverrides?.[target.componentId] ||
                (isDoor ? mod?.carcass.doorMaterialId : mod?.carcass.bodyMaterialId) ||
                null;
              onApplyMaterialToSimilar(curMat, target.componentId, "module_similar");
            })
          }
          className="py-1.5 px-1.5 rounded-lg text-[10px] font-bold bg-white/10 hover:bg-white/18 text-slate-200 inline-flex items-center justify-center gap-1 cursor-pointer"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Modüle</span>
        </button>
        <button
          type="button"
          title="Bu Malzemeyi Tüm Projedeki Benzer Parçalara Yay"
          onClick={() =>
            run(() => {
              const curMat =
                mod?.componentMaterialOverrides?.[target.componentId] ||
                (isDoor ? mod?.carcass.doorMaterialId : mod?.carcass.bodyMaterialId) ||
                null;
              onApplyMaterialToSimilar(curMat, target.componentId, "project_similar");
            })
          }
          className="py-1.5 px-1.5 rounded-lg text-[10px] font-bold bg-white/10 hover:bg-white/18 text-slate-200 inline-flex items-center justify-center gap-1 cursor-pointer"
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Projeye</span>
        </button>
      </div>
      </div>
      <MenuDivider />

      {mod && (() => {
        const copiedStyle = getCopiedModuleStyleClipboard();
        return (
          <>
          <MenuSectionTitle title={`Modül ${target.modIdx + 1} İşlemleri`} />
          <div className="ml-2 pl-2 border-l-2 border-violet-400/50 space-y-1.5 py-0.5">
            <div className="grid grid-cols-5 gap-1">
              <button
                type="button"
                title="Modül Stilini Kopyala (Yüzey + Model + Kulp)"
                onClick={() =>
                  run(() => {
                    const snap = extractModuleStyleSnapshot(mod);
                    setCopiedModuleStyleClipboard(snap);
                  })
                }
                className="flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl text-[9px] font-bold bg-white/10 hover:bg-white/18 text-slate-200 cursor-pointer"
              >
                <Copy className="w-4 h-4" />
                <span>Stil</span>
              </button>
              <button
                type="button"
                title="Yanına Aynı Modülden Ekle"
                onClick={() => run(() => onAddAdjacentModule("right"))}
                className="flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl text-[9px] font-bold bg-white/10 hover:bg-white/18 text-slate-200 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Ekle</span>
              </button>
              <button
                type="button"
                title="Modülü Çoğalt"
                onClick={() => run(onDuplicateActiveModule)}
                className="flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl text-[9px] font-bold bg-white/10 hover:bg-white/18 text-slate-200 cursor-pointer"
              >
                <Files className="w-4 h-4" />
                <span>Çoğalt</span>
              </button>
              <button
                type="button"
                title="Modülü 90° Çevir"
                onClick={() => run(() => onRotateActiveModule90(90))}
                className="flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl text-[9px] font-bold bg-white/10 hover:bg-white/18 text-slate-200 cursor-pointer"
              >
                <RotateCw className="w-4 h-4" />
                <span>90°</span>
              </button>
              <button
                type="button"
                title={mod.carcass.ledLightingEnabled ? "Dolap İçi LED: Açık" : "Dolap İçi LED: Kapalı"}
                onClick={() => run(() => onToggleModuleLedLighting(!Boolean(mod.carcass.ledLightingEnabled)))}
                className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl text-[9px] font-bold cursor-pointer ${
                  mod.carcass.ledLightingEnabled ? "bg-amber-500/80 text-white" : "bg-white/10 hover:bg-white/18 text-slate-200"
                }`}
              >
                <Lightbulb className="w-4 h-4" />
                <span>LED</span>
              </button>
            </div>
            {copiedStyle && (
              <div className="grid grid-cols-4 gap-1">
                <button
                  type="button"
                  title={`Stili Yapıştır (${copiedStyle.sourceModuleName})`}
                  onClick={() =>
                    run(() => {
                      useConfiguratorStore.getState().applyBatchProjectUpdate((draft) => {
                        applyCopiedStyleToProjectDraft(draft, target.modIdx, "single_module", copiedStyle);
                      }, "Kopyalanan modül stili yapıştırıldı");
                    })
                  }
                  className="py-1 rounded-lg text-[9.5px] font-bold bg-[#0284C7] text-white inline-flex items-center justify-center gap-1 cursor-pointer"
                >
                  <ClipboardPaste className="w-3 h-3" />
                  <span>Yapıştır</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    run(() => {
                      useConfiguratorStore.getState().applyBatchProjectUpdate((draft) => {
                        applyCopiedStyleToProjectDraft(draft, target.modIdx, "base_cabinets", copiedStyle);
                      }, "Stil tüm alt dolaplara uygulandı");
                    })
                  }
                  className="py-1 rounded-lg text-[9.5px] font-bold bg-white/10 hover:bg-white/18 text-slate-200 cursor-pointer"
                >
                  Altlar
                </button>
                <button
                  type="button"
                  onClick={() =>
                    run(() => {
                      useConfiguratorStore.getState().applyBatchProjectUpdate((draft) => {
                        applyCopiedStyleToProjectDraft(draft, target.modIdx, "wall_cabinets", copiedStyle);
                      }, "Stil tüm üst dolaplara uygulandı");
                    })
                  }
                  className="py-1 rounded-lg text-[9.5px] font-bold bg-white/10 hover:bg-white/18 text-slate-200 cursor-pointer"
                >
                  Üstler
                </button>
                <button
                  type="button"
                  onClick={() =>
                    run(() => {
                      useConfiguratorStore.getState().applyBatchProjectUpdate((draft) => {
                        applyCopiedStyleToProjectDraft(draft, target.modIdx, "all_project", copiedStyle);
                      }, "Stil tüm projeye uygulandı");
                    })
                  }
                  className="py-1 rounded-lg text-[9.5px] font-bold bg-white/10 hover:bg-white/18 text-slate-200 cursor-pointer"
                >
                  Tümü
                </button>
              </div>
            )}
          </div>
          </>
        );
      })()}

      {onReplaceModuleWithTemplate && mod && (
        <div className="mb-1">
          <button
            type="button"
            onClick={() => setShowReplaceTemplates((v) => !v)}
            className={`w-full py-1.5 px-2.5 rounded-xl text-[10.5px] font-bold flex items-center justify-between cursor-pointer transition ${
              showReplaceTemplates ? "bg-[#0284C7] text-white" : "bg-white/10 hover:bg-white/18 text-slate-200"
            }`}
          >
            <span>Şablonla Değiştir</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showReplaceTemplates ? "rotate-180" : ""}`} />
          </button>
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
      {project.modules.length > 1 && (
        <div className="grid grid-cols-2 gap-1 py-1">
          <button
            type="button"
            title="Modülü Sola Kaydır"
            disabled={target.modIdx === 0}
            onClick={() => run(() => onSwapModuleWithNeighbor(target.modIdx, -1))}
            className="py-1 rounded-lg text-[10px] font-bold bg-white/10 hover:bg-white/18 disabled:opacity-35 text-slate-200 inline-flex items-center justify-center gap-1 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Sola</span>
          </button>
          <button
            type="button"
            title="Modülü Sağa Kaydır"
            disabled={target.modIdx >= project.modules.length - 1}
            onClick={() => run(() => onSwapModuleWithNeighbor(target.modIdx, 1))}
            className="py-1 rounded-lg text-[10px] font-bold bg-white/10 hover:bg-white/18 disabled:opacity-35 text-slate-200 inline-flex items-center justify-center gap-1 cursor-pointer"
          >
            <span>Sağa</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
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
        <button
          type="button"
          title="Seçili Modülü Sahneden Sil (Del)"
          onClick={() => run(onRemoveActiveModule)}
          className="w-full mt-1 py-1.5 rounded-xl bg-rose-500/18 hover:bg-rose-500/28 border border-rose-400/35 text-rose-200 text-[10.5px] font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Modülü Sil</span>
        </button>
      )}
    </div>
  );
};
