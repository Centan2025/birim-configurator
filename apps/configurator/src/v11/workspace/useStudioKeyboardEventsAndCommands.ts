"use client";


import type React from "react";
import { useEffect, useMemo } from "react";
import type { DoorConfig } from "@birim/core";
import { useConfiguratorStore } from "../../store/useConfiguratorStore";
import type { CommandPaletteAction } from "../../v3/components/workspace/CommandSearchModal";
import type { Selected3DPartKind } from "../OnObjectQuickToolbar";
import type { HardwareSwapGroup, HardwareSwapTarget } from "../HardwareQuickSwapPopover";
import {
  BIRIM_CURATED_MOODBOARDS,
  type CuratedBirimMoodboard,
  type PaintTool3DState,
  type QuickZoneScope,
} from "../quickMaterialAndMoodboardEngine";
import type { V11CadSubMode, V11InspectorTab, V11LeftDrawerTab, V11WorkspaceMode } from "../v11Constants";

export interface StudioKeyboardEventsAndCommandsCtx {
  handleApplyCuratedMoodboard: (mb: CuratedBirimMoodboard) => void;
  handleApplyZoneMaterial: (scope: QuickZoneScope, materialId: string) => void;
  handleChangePaintToolState: (next: PaintTool3DState) => void;
  latestRef: React.MutableRefObject<{ showToast: (msg: string) => void }>;
  paintToolState: PaintTool3DState;
  redo: () => void;
  removeBayAt: (bayIdx: number) => void;
  removeModuleAt: (idx: number) => void;
  removeSelectedInteriorComponent: () => boolean;
  setActiveBayIndex: (idx: number) => void;
  setActiveModuleIndex: (idx: number) => void;
  setBayDoorType: (
    bayIdx: number,
    doorType: "single_left" | "single_right" | "double" | "sliding" | "open" | "tambour"
  ) => void;
  setBomModalTab: React.Dispatch<
    React.SetStateAction<"cutlist" | "nesting" | "cnc_mpr_cix" | "blum_bxf" | null>
  >;
  setCadSubMode: React.Dispatch<React.SetStateAction<V11CadSubMode>>;
  setCommandSearchOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setCutoutModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setDoorShowcaseOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setHardwareSwapTarget: React.Dispatch<React.SetStateAction<HardwareSwapTarget | null>>;
  setInspectorTab: React.Dispatch<React.SetStateAction<V11InspectorTab>>;
  setIsInspectorOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setKitchenIslandOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setLeftDrawer: React.Dispatch<React.SetStateAction<V11LeftDrawerTab>>;
  setMepModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setPaintToolState: React.Dispatch<React.SetStateAction<PaintTool3DState>>;
  setProductionSheetModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setQuickPaletteOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setQuoteModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSceneHubTab: React.Dispatch<
    React.SetStateAction<
      "modules" | "capsule_curved" | "custom_glb" | "automation" | "appliances" | "furniture" | null
    >
  >;
  setSelected3DCompId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelected3DContextLabel: React.Dispatch<React.SetStateAction<string | null>>;
  setSelected3DPartKind: React.Dispatch<React.SetStateAction<Selected3DPartKind>>;
  setStoreErpOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setStudioRenderOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setWizardModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setWorkspaceMode: React.Dispatch<React.SetStateAction<V11WorkspaceMode>>;
  showToast: (msg: string) => void;
  undo: () => void;
  workspaceModeRef: React.MutableRefObject<V11WorkspaceMode>;
}

export function useStudioKeyboardEventsAndCommands(ctx: StudioKeyboardEventsAndCommandsCtx) {
  const { handleApplyCuratedMoodboard, handleApplyZoneMaterial, handleChangePaintToolState, latestRef, paintToolState, redo, removeBayAt, removeModuleAt, removeSelectedInteriorComponent, setActiveBayIndex, setActiveModuleIndex, setBayDoorType, setBomModalTab, setCadSubMode, setCommandSearchOpen, setCutoutModalOpen, setDoorShowcaseOpen, setHardwareSwapTarget, setInspectorTab, setIsInspectorOpen, setKitchenIslandOpen, setLeftDrawer, setMepModalOpen, setPaintToolState, setProductionSheetModalOpen, setQuickPaletteOpen, setQuoteModalOpen, setSceneHubTab, setSelected3DCompId, setSelected3DContextLabel, setSelected3DPartKind, setStoreErpOpen, setStudioRenderOpen, setWizardModalOpen, setWorkspaceMode, showToast, undo, workspaceModeRef } = ctx;
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onBay3D = (ev: Event) => {
      const detail = (
        ev as CustomEvent<{ bayIndex?: number; moduleIndex?: number; role?: string; componentId?: string }>
      ).detail;
      if (typeof detail?.moduleIndex === "number" && detail.moduleIndex >= 0) {
        setActiveModuleIndex(detail.moduleIndex);
      }
      const bIdx = typeof detail?.bayIndex === "number" ? detail.bayIndex : 0;
      setActiveBayIndex(bIdx);
      setSelected3DCompId(detail?.componentId || null);
      const r = detail?.role || "";
      const partKind: Selected3DPartKind = r.includes("sub_divider")
        ? "sub_divider"
        : r.includes("shelf")
        ? "shelf"
        : r.includes("drawer")
        ? "drawer"
        : r.includes("rail")
        ? "rail"
        : "bay";
      const roleTr =
        partKind === "sub_divider"
          ? "Raf Arası Dikme"
          : partKind === "shelf"
          ? "Raf"
          : partKind === "drawer"
          ? "Çekmece"
          : partKind === "rail"
          ? "Askı Borusu"
          : "Bölme İçi";
      setSelected3DPartKind(partKind);
      setSelected3DContextLabel(`${bIdx + 1}. Bölme • ${roleTr}`);
      setInspectorTab("interior");
      setIsInspectorOpen(true);
    };
    const onDoor3D = (ev: Event) => {
      const detail = (ev as CustomEvent<{ bayIndex?: number; componentId?: string }>).detail;
      const bIdx = typeof detail?.bayIndex === "number" ? detail.bayIndex : 0;
      setActiveBayIndex(bIdx);
      setSelected3DCompId(detail?.componentId || null);
      setSelected3DPartKind("door");
      setSelected3DContextLabel(`${bIdx + 1}. Bölme • Kapak`);
      setInspectorTab("doors");
      setIsInspectorOpen(true);
    };
    const onMat3D = () => {
      setSelected3DPartKind("door");
      setSelected3DContextLabel("Yüzey & Kartela");
      setInspectorTab("materials");
      setIsInspectorOpen(true);
    };
    const onHardware3D = (ev: Event) => {
      const detail = (
        ev as CustomEvent<{
          group?: string;
          bayIndex?: number;
          componentId?: string;
          moduleIndex?: number;
          sku?: string;
        }>
      ).detail;
      if (typeof detail?.moduleIndex === "number" && detail.moduleIndex >= 0) {
        setActiveModuleIndex(detail.moduleIndex);
      }
      const bIdx = typeof detail?.bayIndex === "number" ? detail.bayIndex : 0;
      setActiveBayIndex(bIdx);
      const rawGroup = detail?.group || "hinge";
      const mappedGroup: HardwareSwapGroup =
        rawGroup === "handle"
          ? "handle"
          : rawGroup === "drawer_slide" || rawGroup === "drawer"
          ? "drawer_slide"
          : rawGroup === "rail" || rawGroup === "accessories"
          ? "rail"
          : "hinge";
      setHardwareSwapTarget({
        group: mappedGroup,
        bayIndex: bIdx,
        componentId: detail?.componentId || null,
        sku: detail?.sku || null,
      });
    };
    const onClear3DSelection = () => {
      setSelected3DContextLabel(null);
      setSelected3DCompId(null);
      setHardwareSwapTarget(null);
    };
    const onOpenStudioRender = () => setStudioRenderOpen(true);
    const onDeleteActiveSelection = () => {
      const stNow = useConfiguratorStore.getState();
      if (stNow.selectedSceneObjectId) {
        stNow.removeSceneObject(stNow.selectedSceneObjectId);
        stNow.setSelectedSceneObjectId(null);
        setSelected3DContextLabel(null);
        latestRef.current.showToast("Seçili 3B obje silindi.");
        return;
      }
      const selComp = stNow.selectedComponentId;
      if (selComp && removeSelectedInteriorComponent()) {
        setSelected3DContextLabel(null);
        return;
      }
      if (stNow.project.modules.length > 1) {
        const delIdx = Math.max(0, Math.min(stNow.activeModuleIndex, stNow.project.modules.length - 1));
        const delName = stNow.project.modules[delIdx]?.name || "Modül";
        removeModuleAt(delIdx);
        setSelected3DContextLabel(null);
        latestRef.current.showToast(`"${delName}" sahneden silindi.`);
      } else {
        latestRef.current.showToast("Sahnede en az 1 ana modül kalmalıdır.");
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandSearchOpen((v) => !v);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
        if (tag !== "input" && tag !== "textarea") {
          e.preventDefault();
          undo();
        }
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))
      ) {
        const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
        if (tag !== "input" && tag !== "textarea") {
          e.preventDefault();
          redo();
        }
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const el = e.target as HTMLElement | null;
        const tag = el?.tagName?.toLowerCase();
        if (tag === "input" || tag === "textarea" || tag === "select" || el?.isContentEditable) {
          return;
        }
        const k = e.key.toLowerCase();
        if (k === "m") {
          e.preventDefault();
          setQuickPaletteOpen((v) => !v);
        } else if (k === "b") {
          e.preventDefault();
          setPaintToolState((prev) => ({
            ...prev,
            mode: prev.mode === "paint" ? "none" : "paint",
          }));
        } else if (k === "i") {
          e.preventDefault();
          setPaintToolState((prev) => ({
            ...prev,
            mode: prev.mode === "eyedropper" ? "none" : "eyedropper",
          }));
        } else if (e.key === "Delete" || e.key === "Backspace") {
          // In 2D Plan mode, let V3CadViewport2D handle deleting selected plan walls, obstacles, or placed items
          if (workspaceModeRef.current === "plan") return;
          if ((e as unknown as { __birimDeleteHandled?: boolean }).__birimDeleteHandled) return;
          (e as unknown as { __birimDeleteHandled?: boolean }).__birimDeleteHandled = true;
          e.preventDefault();
          e.stopImmediatePropagation?.();
          const stDel = useConfiguratorStore.getState();
          // 1. Delete selected 3D scene object (appliance, chair, plant, etc.)
          if (stDel.selectedSceneObjectId) {
            const objId = stDel.selectedSceneObjectId;
            stDel.removeSceneObject(objId);
            stDel.setSelectedSceneObjectId(null);
            latestRef.current.showToast("Seçili 3B obje silindi.");
            return;
          }
          // 2. Delete selected interior cabinet component (shelf, drawer, rail, sub-divider, special_fitting/accessory)
          // Works identically in BOTH 3D Viewport and 2D Front Elevation regardless of selected3DPartKind!
          const selCid = stDel.selectedComponentId || "";
          if (selCid) {
            if (removeSelectedInteriorComponent()) {
              setSelected3DContextLabel(null);
              latestRef.current.showToast("Seçili iç parça silindi (Ctrl+Z ile geri al).");
              return;
            }
            if (selCid.includes("_fitting_") || selCid.includes("_fit_")) {
              let deletedFit = false;
              stDel.applyBatchProjectUpdate((draft) => {
                for (const m of draft.modules) {
                  for (const b of m.bays) {
                    if (!b.specialFittings?.length) continue;
                    const before = b.specialFittings.length;
                    b.specialFittings = b.specialFittings.filter(
                      (f) => !selCid.startsWith(f.id) && !selCid.includes(f.id)
                    );
                    if (b.specialFittings.length < before) deletedFit = true;
                  }
                }
              }, "İç donanım silindi");
              if (deletedFit) {
                stDel.setSelectedComponentId(null);
                setSelected3DContextLabel(null);
                latestRef.current.showToast("Seçili donanım silindi (Ctrl+Z ile geri al).");
                return;
              }
            }
            // 2b. Vertical carcass divider -> remove divider & merge adjacent bays
            const activeMod =
              stDel.project.modules[stDel.activeModuleIndex] || stDel.project.modules[0];
            if (activeMod && (selCid.includes("_divider_") || selCid.includes("carcass_divider"))) {
              if (activeMod.bays.length > 1) {
                const divMatch = selCid.match(/divider_(\d+)/);
                const bIdx = divMatch
                  ? Math.max(0, Math.min(activeMod.bays.length - 1, Number(divMatch[1])))
                  : Math.max(0, Math.min(activeMod.bays.length - 1, stDel.activeBayIndex));
                removeBayAt(bIdx);
                stDel.setSelectedComponentId(null);
                setSelected3DContextLabel(null);
                latestRef.current.showToast("Ara dikme kaldırıldı ve bölmeler birleştirildi.");
                return;
              }
            }
            // 2c. Door leaf / hinge -> remove door from bay (convert to open bay)
            if (activeMod && (selCid.includes("_door_") || selCid.includes("_hinge_"))) {
              const bayMatch = selCid.match(/bay_(\d+)/);
              const bIdx = bayMatch
                ? Math.max(0, Math.min(activeMod.bays.length - 1, Number(bayMatch[1])))
                : Math.max(0, Math.min(activeMod.bays.length - 1, stDel.activeBayIndex));
              if (activeMod.bays[bIdx]?.door?.type && activeMod.bays[bIdx].door.type !== "open") {
                setBayDoorType(bIdx, "open");
                stDel.setSelectedComponentId(null);
                setSelected3DContextLabel(null);
                latestRef.current.showToast("Bölme kapağı kaldırıldı (Açık bölme).");
                return;
              }
            }
          }
          // 3. Delete currently active module (keep at least 1 module in scene)
          if (stDel.project.modules.length > 1) {
            const delIdx = Math.max(
              0,
              Math.min(stDel.activeModuleIndex, stDel.project.modules.length - 1)
            );
            const delName = stDel.project.modules[delIdx]?.name || "Modül";
            removeModuleAt(delIdx);
            setSelected3DContextLabel(null);
            latestRef.current.showToast(`"${delName}" sahneden silindi.`);
          } else {
            latestRef.current.showToast("Sahnede en az 1 ana modül kalmalıdır.");
          }
        } else if (e.key === "Escape") {
          setPaintToolState((prev) =>
            prev.mode === "none" ? prev : { ...prev, mode: "none" }
          );
        }
      }
    };

    const onMaterialSampled3D = (ev: Event) => {
      const detail = (
        ev as CustomEvent<{ materialId: string; materialName: string; toolState?: PaintTool3DState }>
      ).detail;
      if (!detail) return;
      if (detail.toolState) {
        setPaintToolState(detail.toolState);
      }
      showToast(`Damlalık ile alındı: ${detail.materialName} — Boyamaya hazır`);
    };

    const onMaterialPainted3D = (ev: Event) => {
      const detail = (ev as CustomEvent<{ materialName: string }>).detail;
      if (detail?.materialName) {
        showToast(`${detail.materialName} yüzeye uygulandı.`);
      }
    };

    const onTogglePaletteEvt = () => setQuickPaletteOpen((v) => !v);
    const onTogglePaintEvt = () => {
      setPaintToolState((prev) => ({
        ...prev,
        mode: prev.mode === "paint" ? "none" : "paint",
      }));
    };
    const onClearPaintToolEvt = () => {
      setPaintToolState((prev) => (prev.mode === "none" ? prev : { ...prev, mode: "none" }));
    };
    const onSyncPaintToolFrom3DEvt = (ev: Event) => {
      const detail = (ev as CustomEvent<PaintTool3DState>).detail;
      if (detail) setPaintToolState(detail);
    };
    const onWallSelected3DEvt = () => {
      // Selected wall is already highlighted directly in the 3D scene; skip noisy toast banner.
    };
    const onStyleCopiedEvt = (ev: Event) => {
      const detail = (ev as CustomEvent<{ sourceModuleName?: string } | null>).detail;
      if (detail?.sourceModuleName) {
        showToast(`"${detail.sourceModuleName}" stili kopyalandı — Sağ tıkla başka dolaplara yapıştırın.`);
      }
    };

    window.addEventListener("birim:select-bay-3d", onBay3D);
    window.addEventListener("birim:select-door-3d", onDoor3D);
    window.addEventListener("birim:select-hardware-3d", onHardware3D);
    window.addEventListener("birim:select-material-part-3d", onMat3D);
    window.addEventListener("birim:clear-3d-selection", onClear3DSelection);
    window.addEventListener("birim:open-studio-render-modal", onOpenStudioRender);
    window.addEventListener("birim:delete-active-selection", onDeleteActiveSelection);
    window.addEventListener("birim:material-sampled-3d", onMaterialSampled3D);
    window.addEventListener("birim:material-painted-3d", onMaterialPainted3D);
    window.addEventListener("birim:toggle-quick-palette-dock", onTogglePaletteEvt);
    window.addEventListener("birim:toggle-paint-bucket-shortcut", onTogglePaintEvt);
    window.addEventListener("birim:request-clear-paint-tool-3d", onClearPaintToolEvt);
    window.addEventListener("birim:sync-paint-tool-from-3d", onSyncPaintToolFrom3DEvt);
    window.addEventListener("birim:wall-selected-3d", onWallSelected3DEvt);
    window.addEventListener("birim:style-clipboard-changed", onStyleCopiedEvt);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("birim:select-bay-3d", onBay3D);
      window.removeEventListener("birim:select-door-3d", onDoor3D);
      window.removeEventListener("birim:select-hardware-3d", onHardware3D);
      window.removeEventListener("birim:select-material-part-3d", onMat3D);
      window.removeEventListener("birim:clear-3d-selection", onClear3DSelection);
      window.removeEventListener("birim:open-studio-render-modal", onOpenStudioRender);
      window.removeEventListener("birim:delete-active-selection", onDeleteActiveSelection);
      window.removeEventListener("birim:material-sampled-3d", onMaterialSampled3D);
      window.removeEventListener("birim:material-painted-3d", onMaterialPainted3D);
      window.removeEventListener("birim:toggle-quick-palette-dock", onTogglePaletteEvt);
      window.removeEventListener("birim:toggle-paint-bucket-shortcut", onTogglePaintEvt);
      window.removeEventListener("birim:request-clear-paint-tool-3d", onClearPaintToolEvt);
      window.removeEventListener("birim:sync-paint-tool-from-3d", onSyncPaintToolFrom3DEvt);
      window.removeEventListener("birim:wall-selected-3d", onWallSelected3DEvt);
      window.removeEventListener("birim:style-clipboard-changed", onStyleCopiedEvt);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [setActiveBayIndex, undo, redo, showToast]);

  const commandActions = useMemo<CommandPaletteAction[]>(
    () => [
      {
        id: "open_catalog",
        labelTr: "Ürün, Modül, TV Bench ve Masa Kataloğunu Aç",
        categoryTr: "Tasarım",
        keywords: "modül ekle gardırop mutfak tv bench konsol masa kütüphane",
        onExecute: () => setLeftDrawer("catalog"),
      },
      {
        id: "open_island",
        labelTr: "Şelale Mutfak Adası ve Açılı Yemek/Bar Masası Ekle",
        categoryTr: "Mutfak",
        keywords: "ada mutfak şelale masa bar taburesi",
        onExecute: () => setKitchenIslandOpen(true),
      },
      {
        id: "open_capsule",
        labelTr: "Kapsül Stadyum Yemek Masası & Tamburlu Konsol Tasarla",
        categoryTr: "Özel Ürün",
        keywords: "kapsül oval masa konsol bar glb 3d",
        onExecute: () => setSceneHubTab("capsule_curved"),
      },
      {
        id: "open_wizard",
        labelTr: "Hızlı Oda & Dolap Kurulum Sihirbazı",
        categoryTr: "Tasarım",
        keywords: "sihirbaz otomatik kurulum oda",
        onExecute: () => setWizardModalOpen(true),
      },
      {
        id: "open_section_2d",
        labelTr: "Görsel Planlı 2B A-A Yan Kesit Ekranını Aç",
        categoryTr: "Teknik Çizim",
        keywords: "kesit plan aa bb 2d",
        onExecute: () => {
          setWorkspaceMode("2d");
          setCadSubMode("section");
        },
      },
      {
        id: "open_mep",
        labelTr: "Elektrik ve Sıhhi Tesisat (MEP) Koordinasyon Planı",
        categoryTr: "Mühendislik",
        keywords: "tesisat elektrik su priz boru mep dxf",
        onExecute: () => setMepModalOpen(true),
      },
      {
        id: "open_cutout",
        labelTr: "Panel Kertme ve Priz / Boru CNC Kesimi",
        categoryTr: "Mühendislik",
        keywords: "kertme priz boru kolon kesim cnc",
        onExecute: () => setCutoutModalOpen(true),
      },
      {
        id: "open_production_sheet",
        labelTr: "Üretim Paftası & Teknik Çizim Düzeni (Plan, Görünüş, Kesit, 3B)",
        categoryTr: "Üretim",
        keywords: "pafta plan görünüş kesit perspektif antet pdf svg dxf üretim",
        onExecute: () => setProductionSheetModalOpen(true),
      },
      {
        id: "open_bom",
        labelTr: "Kesim Listesi, Plaka Nesting, CNC (.MPR/.CIX) ve Blum BXF",
        categoryTr: "Üretim",
        keywords: "bom kesim nesting cnc dxf mpr cix blum bxf plaka",
        onExecute: () => setBomModalTab("cutlist"),
      },
      {
        id: "open_erp",
        labelTr: "Birim Store & Portal ERP Sipariş Aktarımı",
        categoryTr: "Üretim",
        keywords: "erp mağaza store sipariş portal",
        onExecute: () => setStoreErpOpen(true),
      },
      {
        id: "open_quote",
        labelTr: "Müşteri Fiyat Teklifi ve Görselli PDF",
        categoryTr: "Satış",
        keywords: "fiyat teklif pdf iskonto",
        onExecute: () => setQuoteModalOpen(true),
      },
      {
        id: "toggle_quick_palette",
        labelTr: "Bölgesel Hızlı Kartela ve İmza Kombinasyonlarını Aç (M)",
        categoryTr: "Hızlı Malzeme",
        keywords: "kartela malzeme renk kombinasyon palet m",
        onExecute: () => setQuickPaletteOpen(true),
      },
      {
        id: "activate_paint_bucket",
        labelTr: "3B Boya Kovası Modunu Aç (Kısayol: B)",
        categoryTr: "Hızlı Malzeme",
        keywords: "boya kovası fırça paint bucket b",
        onExecute: () =>
          handleChangePaintToolState({
            ...paintToolState,
            mode: "paint",
          }),
      },
      {
        id: "activate_eyedropper",
        labelTr: "3B Damlalık ile Dolaptan Malzeme Örnekle (Kısayol: I / Alt+Tık)",
        categoryTr: "Hızlı Malzeme",
        keywords: "damlalık eyedropper malzeme seç örnekle i",
        onExecute: () =>
          handleChangePaintToolState({
            ...paintToolState,
            mode: "eyedropper",
          }),
      },
      ...BIRIM_CURATED_MOODBOARDS.map((mb) => ({
        id: `cmd_mb_${mb.id}`,
        labelTr: `Hazır Kombinasyon Uygula: ${mb.titleTr} (${mb.badgeTr})`,
        categoryTr: "İmza Kombinasyon",
        keywords: `kombinasyon çift ton ${mb.titleTr.toLowerCase()} ${mb.subtitleTr.toLowerCase()}`,
        onExecute: () => handleApplyCuratedMoodboard(mb),
      })),
      {
        id: "batch_base_walnut",
        labelTr: "Tüm Alt Dolaplar → Variodor Barok Ceviz",
        categoryTr: "Bölgesel Boyama",
        keywords: "alt dolaplar barok ceviz ahşap",
        onExecute: () => handleApplyZoneMaterial("base_cabinets", "mat_veneer_walnut"),
      },
      {
        id: "batch_base_nordic_oak",
        labelTr: "Tüm Alt Dolaplar → Çamsan İskandinav Meşe",
        categoryTr: "Bölgesel Boyama",
        keywords: "alt dolaplar iskandinav meşe",
        onExecute: () => handleApplyZoneMaterial("base_cabinets", "mat_camsan_iskandinav_mese"),
      },
      {
        id: "batch_wall_cream_lacquer",
        labelTr: "Tüm Üst Dolaplar → İpek Mat Lake Sahra Kumu",
        categoryTr: "Bölgesel Boyama",
        keywords: "üst dolaplar sahra kumu krem lake",
        onExecute: () => handleApplyZoneMaterial("wall_cabinets", "mat_lacquer_cream"),
      },
      {
        id: "batch_wall_sage_lacquer",
        labelTr: "Tüm Üst Dolaplar → İpek Mat Lake Adaçayı Yeşili",
        categoryTr: "Bölgesel Boyama",
        keywords: "üst dolaplar adaçayı yeşili lake",
        onExecute: () => handleApplyZoneMaterial("wall_cabinets", "mat_lacquer_sage"),
      },
      {
        id: "batch_wall_cashmere",
        labelTr: "Tüm Üst Dolaplar → Kaşmir Gri",
        categoryTr: "Bölgesel Boyama",
        keywords: "üst dolaplar kaşmir gri",
        onExecute: () => handleApplyZoneMaterial("wall_cabinets", "mat_ye_kasmir_gri"),
      },
      {
        id: "batch_ct_calacatta_luxe",
        labelTr: " Tüm Tezgâhlar → Neolith Calacatta Luxe Porselen",
        categoryTr: "Tezgâh & Taş",
        keywords: "tezgah neolith calacatta luxe mermer kuvars",
        onExecute: () => handleApplyZoneMaterial("countertops", "mat_neolith_calacatta_luxe"),
      },
      {
        id: "batch_ct_dekton_entzo",
        labelTr: "Tüm Tezgâhlar → Dekton Entzo Calacatta Gold",
        categoryTr: "Tezgâh & Taş",
        keywords: "tezgah dekton entzo gold",
        onExecute: () => handleApplyZoneMaterial("countertops", "mat_dekton_entzo"),
      },
      {
        id: "batch_ct_basalt_black",
        labelTr: "Tüm Tezgâhlar → Neolith Basalt Black",
        categoryTr: "Tezgâh & Taş",
        keywords: "tezgah siyah bazalt basalt black",
        onExecute: () => handleApplyZoneMaterial("countertops", "mat_neolith_basalt_black"),
      },
      {
        id: "batch_handle_black",
        labelTr: "Kulp & Gola Profilleri → K019 Mat Siyah Eloksal",
        categoryTr: "Kulp & Gola",
        keywords: "kulp gola siyah eloksal metal",
        onExecute: () => handleApplyZoneMaterial("handles_gola", "mat_handle_matte_black"),
      },
      {
        id: "batch_handle_brass",
        labelTr: "Kulp & Gola Profilleri → K021 Satine Pirinç",
        categoryTr: "Kulp & Gola",
        keywords: "kulp gola pirinç altın brass",
        onExecute: () => handleApplyZoneMaterial("handles_gola", "mat_handle_brass"),
      },
      {
        id: "open_door_gallery",
        labelTr: "Kapak ve Kulpsuz Sistemler 1:1 Kesit Galerisini Aç",
        categoryTr: "Tasarım",
        keywords: "kapak galerisi gola j kulp kesit aventos",
        onExecute: () => setDoorShowcaseOpen(true),
      },
    ],
    [
      handleChangePaintToolState,
      paintToolState,
      handleApplyCuratedMoodboard,
      handleApplyZoneMaterial,
    ]
  );

  return { commandActions };
}
