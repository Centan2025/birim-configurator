"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  useV3Adapter,
  DEFAULT_MATERIALS,
  WARDROBE_TEMPLATES,
  KITCHEN_ENGINEERING_RULE_REGISTRY,
  generateModuleGeometry,
  startModuleSilhouetteDrag,
  setActiveDraggedTemplateId,
} from "../adapter/useV3Adapter";
import {
  DoorSystemId,
  DoorOverlayType,
  HandleCategory,
  OpeningTechnology,
  ModuleFamilyId,
} from "@birim/core";
import {
  V3BrandBadge,
  V3Button,
  V3DimensionControl,
  V3MaterialSwatch,
  V3CollapsibleSection,
  V3AlertBanner,
} from "../design-system";
import { V3CadViewport2D } from "./V3CadViewport2D";
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
} from "lucide-react";

const V3ThreeViewport = dynamic(() => import("./V3ThreeViewport"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#F4F2EC] text-stone-500 text-xs font-medium">
      3D PBR Sahnesi Hazırlanıyor...
    </div>
  ),
});

export type V3WorkspaceMode = "studio" | "plan" | "showroom";

export const V3UnifiedWorkspace: React.FC<{
  initialMode?: V3WorkspaceMode;
}> = ({ initialMode = "studio" }) => {
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
    fourSpaceDimensions,
    spaceWalls,
    pricing,
    canUndo,
    canRedo,
    undo,
    redo,
    setDimensions,
    setMaterials,
    setBayCount,
    setBayDoorType,
    setBayV4DoorConfig,
    applyV4Template,
    dropV4TemplateWithSnap,
    applyWardrobeWizard,
    applySmartWallProposal,
    distributeAlongWall,
    autoGenerateKitchenComplementary,
    attachComplementaryToActiveModule,
    applyProjectSegmentPreset,
    v4ModuleFamilies,
    v4ModuleTemplates,
    doorSystemDefinitions,
    handleProfiles,
    openingMechanisms,
    hardwareCatalog,
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
    selectedComponentId,
    moveActiveModule,
    rotateActiveModule90,
    applyTemplate,
    loadLinearKitchen,
    loadLKitchen,
    loadUKitchen,
    applySmartSpan,
    approveProduction,
  } = useV3Adapter();

  const [mode, setMode] = useState<V3WorkspaceMode>(initialMode);
  const [canvasTheme, setCanvasTheme] = useState<"warm-light" | "dark">("warm-light");
  const [leftOpen, setLeftOpen] = useState(true);
  const [leftTab, setLeftTab] = useState<"templates" | "materials">("templates");
  const [studioInspectorTab, setStudioInspectorTab] = useState<"all" | "dimensions" | "interior" | "door">("all");
  const [selectedV4Family, setSelectedV4Family] = useState<ModuleFamilyId>("fam_wardrobe");
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
  const [approvalBanner, setApprovalBanner] = useState<{
    text: string;
    ok: boolean;
  } | null>(null);
  const [adminRefreshTick, setAdminRefreshTick] = useState(0);
  const [newDraftName, setNewDraftName] = useState("Özel V4.2 Dolap Şablonu");
  const [newDraftWidth, setNewDraftWidth] = useState<number>(800);
  const [newDraftHeight, setNewDraftHeight] = useState<number>(720);
  const [newDraftDepth, setNewDraftDepth] = useState<number>(580);
  const [newDraftDoorSys, setNewDraftDoorSys] = useState<DoorSystemId>("hinged_double");
  const [studioLeftWidthPx, setStudioLeftWidthPx] = useState<number>(384);
  const [isVisualCatalogOpen, setIsVisualCatalogOpen] = useState<boolean>(false);
  const [catalogSearchQuery, setCatalogSearchQuery] = useState<string>("");
  const [catalogWidthFilter, setCatalogWidthFilter] = useState<"all" | "narrow" | "medium" | "wide">("all");
  const [studioRightWidthPx, setStudioRightWidthPx] = useState<number>(356);
  const [planSplitRatioPct, setPlanSplitRatioPct] = useState<number>(58);
  const [resizingPanel, setResizingPanel] = useState<
    "studio-left" | "studio-right" | "plan-split" | null
  >(null);
  const [planRightView, setPlanRightView] = useState<
    "3d-iso" | "3d-front" | "3d-side" | "3d-top" | "2d-elevation" | "2d-section"
  >("3d-iso");

  useEffect(() => {
    if (!resizingPanel) return;
    const onMouseMove = (ev: MouseEvent) => {
      if (resizingPanel === "studio-left") {
        setStudioLeftWidthPx(Math.max(220, Math.min(520, ev.clientX)));
      } else if (resizingPanel === "studio-right") {
        setStudioRightWidthPx(
          Math.max(280, Math.min(580, window.innerWidth - ev.clientX))
        );
      } else if (resizingPanel === "plan-split") {
        const pct = Math.round(
          (ev.clientX / Math.max(1, window.innerWidth)) * 100
        );
        setPlanSplitRatioPct(Math.max(18, Math.min(82, pct)));
      }
    };
    const onMouseUp = () => setResizingPanel(null);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [resizingPanel]);

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
        if (!removeSelectedInteriorComponent() && project.modules.length > 1) {
          removeActiveModule();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    mode,
    undo,
    redo,
    removeSelectedInteriorComponent,
    project.modules.length,
    removeActiveModule,
  ]);

  if (!activeModule) return null;
  const { width, height, depth } = activeModule.dimensions;
  const activeBreakdown = generateModuleGeometry(activeModule, { doorOpenAngleDeg: 0 });
  const currentBayWidthMm = activeBreakdown.bayWidths[activeBayIndex] || 0;
  const netInnerHeightMm = activeBreakdown.netInnerHeight || Math.max(400, height - 116);
  const mainWall = spaceWalls[0] || { length: 3600, height: 2700 };
  const usedSpanMm = project.modules.reduce(
    (max, m) => Math.max(max, m.position.x + m.dimensions.width),
    0
  );
  const remainingWallMm = Math.max(0, mainWall.length - usedSpanMm);

  const errorIssues = validationIssues.filter((i) => i.severity === "error");
  const familyTemplates = v4ModuleTemplates.filter((t) => {
    if (t.familyId !== selectedV4Family) return false;
    if (catalogSearchQuery.trim()) {
      const q = catalogSearchQuery.toLowerCase().trim();
      const matchName = t.name.toLowerCase().includes(q) || t.code.toLowerCase().includes(q);
      const matchDim = `${t.defaultDimensions.width}x${t.defaultDimensions.height}`.includes(q) || String(t.defaultDimensions.width).includes(q);
      if (!matchName && !matchDim) return false;
    }
    if (catalogWidthFilter === "narrow" && t.defaultDimensions.width > 600) return false;
    if (catalogWidthFilter === "medium" && (t.defaultDimensions.width <= 600 || t.defaultDimensions.width > 1000)) return false;
    if (catalogWidthFilter === "wide" && t.defaultDimensions.width <= 1000) return false;
    return true;
  });
  const adminRecords = libraryAdminStore.getAllEntries();

  const handleApprove = () => {
    const res = approveProduction();
    setApprovalBanner({ text: res.message, ok: res.success });
    setTimeout(() => setApprovalBanner(null), 4500);
  };

  return (
    <div
      data-testid="v3-unified-root"
      data-active-mode={mode}
      className="flex flex-col h-screen w-screen overflow-hidden bg-[#F7F6F2] text-stone-900 font-sans select-none"
    >
      {/* 1. UNIFIED TOP COMMAND BAR (Hidden only in Showroom Zen Mode) */}
      {!(mode === "showroom" && zenMode) && (
        <header className="h-14 bg-white text-stone-900 border-b border-stone-200 flex items-center justify-between px-4 shrink-0 z-30 shadow-2xs">
          {/* Left: Brand & Project Title */}
          <div className="flex items-center gap-3">
            <V3BrandBadge subtitle="V4.1" />
            <div className="h-4 w-px bg-stone-200 hidden sm:block" />
            <div className="hidden md:flex items-center gap-2 text-xs">
              <span
                data-testid="v3-project-title"
                className="font-bold text-stone-900 truncate max-w-[220px]"
              >
                {project.title}
              </span>
              {errorIssues.length > 0 ? (
                <button
                  type="button"
                  data-testid="v3-engineering-badge"
                  onClick={() => setShowRulesModal(true)}
                  className="text-[11px] px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <AlertTriangle className="w-3 h-3" />
                  <span>{errorIssues.length} Çakışma</span>
                </button>
              ) : (
                <button
                  type="button"
                  data-testid="v3-engineering-badge"
                  onClick={() => setShowRulesModal(true)}
                  className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium flex items-center gap-1 cursor-pointer"
                >
                  <ShieldCheck className="w-3 h-3" />
                  <span>Geometri Doğrulandı</span>
                </button>
              )}
              <button
                type="button"
                data-testid="v4-header-catalog-btn"
                onClick={() => setIsVisualCatalogOpen(true)}
                className="text-[11px] px-2.5 py-1 rounded-full bg-amber-700 hover:bg-amber-800 text-white font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer"
                title="Büyük İkonlu Görsel Modül Kataloğunu Aç"
              >
                <Package className="w-3.5 h-3.5" />
                <span>📦 Modül Kataloğu</span>
              </button>
              <button
                type="button"
                data-testid="v4-library-admin-btn"
                onClick={() => setShowAdminModal(true)}
                className="text-[11px] px-2 py-0.5 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Wrench className="w-3 h-3 text-amber-700" />
                <span>V4 Kütüphane ({v4ModuleTemplates.length})</span>
              </button>
            </div>
          </div>

          {/* Center: Seamless Single-Page Mode Switcher (Studio | Plan | Showroom) */}
          <div className="flex items-center gap-2">
            <nav
              aria-label="V3.1 Çalışma Modu"
              data-testid="v3-mode-switcher"
              className="inline-flex items-center p-1 rounded-xl bg-stone-100 border border-stone-200 text-xs"
            >
              <button
                type="button"
                data-testid="v3-mode-studio"
                onClick={() => {
                  setMode("studio");
                  setZenMode(false);
                }}
                className={`px-3.5 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  mode === "studio"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                <Box className="w-3.5 h-3.5 text-amber-700" />
                <span>Studio</span>
              </button>
              <button
                type="button"
                data-testid="v3-mode-plan"
                onClick={() => {
                  setMode("plan");
                  setZenMode(false);
                }}
                className={`px-3.5 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  mode === "plan"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                <Columns className="w-3.5 h-3.5 text-amber-700" />
                <span>Plan (2D+3D)</span>
              </button>
              <button
                type="button"
                data-testid="v3-mode-showroom"
                onClick={() => setMode("showroom")}
                className={`px-3.5 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  mode === "showroom"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                <span>Showroom</span>
              </button>
            </nav>

            {/* Studio View Options (3D Perspective/Front/Side/Top + 2D Elevation/Section/Plan + Dimensions) */}
            {mode === "studio" && (
              <div
                data-testid="studio-view-switcher"
                className="hidden sm:inline-flex items-center gap-0.5 p-1 rounded-xl bg-stone-100 border border-stone-200 text-xs"
              >
                <button
                  type="button"
                  data-testid="studio-view-3d"
                  onClick={() => {
                    setStudioView("3d");
                    setCameraPreset("iso");
                  }}
                  className={`px-2 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                    studioView === "3d" && cameraPreset === "iso"
                      ? "bg-amber-600 text-white"
                      : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  3D Perspektif
                </button>
                <button
                  type="button"
                  data-testid="studio-view-3d-front"
                  onClick={() => {
                    setStudioView("3d");
                    setCameraPreset("front");
                  }}
                  className={`px-2 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                    studioView === "3d" && cameraPreset === "front"
                      ? "bg-amber-600 text-white"
                      : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  3D Ön
                </button>
                <button
                  type="button"
                  data-testid="studio-view-3d-side"
                  onClick={() => {
                    setStudioView("3d");
                    setCameraPreset("side");
                  }}
                  className={`px-2 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                    studioView === "3d" && cameraPreset === "side"
                      ? "bg-amber-600 text-white"
                      : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  3D Yan
                </button>
                <button
                  type="button"
                  data-testid="studio-view-3d-top"
                  onClick={() => {
                    setStudioView("3d");
                    setCameraPreset("top");
                  }}
                  className={`px-2 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                    studioView === "3d" && cameraPreset === "top"
                      ? "bg-amber-600 text-white"
                      : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  3D Üst
                </button>
                <button
                  type="button"
                  data-testid="studio-view-2d"
                  onClick={() => {
                    setStudioView("2d");
                    setStudio2DMode("elevation");
                  }}
                  className={`px-2 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                    studioView === "2d" && studio2DMode === "elevation"
                      ? "bg-amber-600 text-white"
                      : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  2D Cephe
                </button>
                <button
                  type="button"
                  data-testid="studio-view-2d-section"
                  onClick={() => {
                    setStudioView("2d");
                    setStudio2DMode("section");
                  }}
                  className={`px-2 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                    studioView === "2d" && studio2DMode === "section"
                      ? "bg-amber-600 text-white"
                      : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  2D Kesit
                </button>
                <button
                  type="button"
                  data-testid="studio-view-2d-plan"
                  onClick={() => {
                    setStudioView("2d");
                    setStudio2DMode("plan");
                  }}
                  className={`px-2 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                    studioView === "2d" && studio2DMode === "plan"
                      ? "bg-amber-600 text-white"
                      : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  2D Plan
                </button>
                <button
                  type="button"
                  data-testid="studio-toggle-dimensions"
                  onClick={() => setShow3DDimensions((prev) => !prev)}
                  className={`px-2 py-1.5 rounded-lg font-semibold flex items-center gap-1 transition cursor-pointer ${
                    show3DDimensions
                      ? "bg-amber-700 text-white"
                      : "text-stone-600 hover:text-stone-900"
                  }`}
                  title="3D Perspektif Ölçü Çizgilerini Göster / Gizle"
                >
                  <Ruler className="w-3 h-3" />
                  <span>Ölçü</span>
                </button>
              </div>
            )}
          </div>

          {/* Right: Canvas Contrast Toggle, Undo/Redo, Save/Load, Showroom Zen Button */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="v3-canvas-contrast-toggle"
              onClick={() =>
                setCanvasTheme((prev) => (prev === "warm-light" ? "dark" : "warm-light"))
              }
              title="Sahne Arka Fon Kontrastını Değiştir (Mimari Gri / Koyu Stüdyo)"
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                canvasTheme === "dark"
                  ? "bg-stone-900 border-stone-800 text-amber-400"
                  : "bg-stone-100 hover:bg-stone-200 border-stone-200 text-stone-700"
              }`}
            >
              {canvasTheme === "dark" ? "Koyu Fon" : "Gri Fon"}
            </button>

            <div className="flex items-center bg-stone-100 rounded-xl border border-stone-200 p-0.5">
              <button
                type="button"
                data-testid="v3-undo-btn"
                onClick={undo}
                disabled={!canUndo}
                title="Geri Al"
                className="p-1.5 rounded-lg hover:bg-white text-stone-700 disabled:opacity-35 transition cursor-pointer"
              >
                <Undo className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                data-testid="v3-redo-btn"
                onClick={redo}
                disabled={!canRedo}
                title="İleri Al"
                className="p-1.5 rounded-lg hover:bg-white text-stone-700 disabled:opacity-35 transition cursor-pointer"
              >
                <Redo className="w-3.5 h-3.5" />
              </button>
            </div>

            {mode === "showroom" && (
              <V3Button
                variant="outline"
                size="md"
                data-testid="showroom-zen-toggle"
                onClick={() => setZenMode(true)}
              >
                <Maximize2 className="w-3.5 h-3.5 text-amber-700" />
                <span>Tam Ekran Sunum</span>
              </V3Button>
            )}

            <V3Button
              variant="outline"
              size="md"
              data-testid="v3-open-projects-btn"
              onClick={() => setIsProjectModalOpen(true)}
            >
              <FolderOpen className="w-3.5 h-3.5 text-amber-700" />
              <span>Kaydet / Aç</span>
            </V3Button>
          </div>
        </header>
      )}

      {/* Approval / Validation Notification Banner */}
      {approvalBanner && (
        <div
          className={`${
            approvalBanner.ok ? "bg-emerald-700" : "bg-red-700"
          } text-white px-5 py-2 text-xs font-semibold flex items-center justify-between z-30`}
        >
          <span>{approvalBanner.text}</span>
          <button onClick={() => setApprovalBanner(null)} className="cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* PLAN MODE RIBBON TOOLBAR */}
      {mode === "plan" && (
        <div
          data-testid="plan-ribbon-toolbar"
          className="h-11 bg-stone-100/95 border-b border-stone-200 px-4 flex items-center justify-between gap-3 overflow-x-auto shrink-0 z-20 text-xs"
        >
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 mr-1">
              Mekân Şablonu:
            </span>
            <button
              type="button"
              data-testid="plan-preset-linear-kitchen"
              onClick={loadLinearKitchen}
              className="px-2.5 py-1 rounded-lg bg-white hover:bg-amber-50 border border-stone-200 text-stone-800 font-semibold transition cursor-pointer"
            >
              Doğrusal Mutfak (3.2m)
            </button>
            <button
              type="button"
              data-testid="plan-preset-l-kitchen"
              onClick={loadLKitchen}
              className="px-2.5 py-1 rounded-lg bg-white hover:bg-amber-50 border border-stone-200 text-stone-800 font-semibold transition cursor-pointer"
            >
              L Tipi Mutfak (90° Köşe)
            </button>
            <button
              type="button"
              data-testid="plan-preset-u-kitchen"
              onClick={loadUKitchen}
              className="px-2.5 py-1 rounded-lg bg-white hover:bg-amber-50 border border-stone-200 text-stone-800 font-semibold transition cursor-pointer"
            >
              U Tipi Mutfak (Çift Köşe)
            </button>
            <button
              type="button"
              data-testid="plan-preset-wardrobe"
              onClick={() => applyTemplate(WARDROBE_TEMPLATES[1].templateId)}
              className="px-2.5 py-1 rounded-lg bg-white hover:bg-amber-50 border border-stone-200 text-stone-800 font-semibold transition cursor-pointer"
            >
              Master Gardırop
            </button>
            <button
              type="button"
              data-testid="plan-distribute-wall-btn"
              onClick={distributeAlongWall}
              className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 font-semibold transition cursor-pointer"
            >
              Duvara Eşit Dağıt
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-stone-200">
              <Magnet className="w-3.5 h-3.5 text-amber-700" />
              <span className="text-[11px] text-stone-600 font-medium">Snap:</span>
              {[0, 50, 100].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSnapMm(s)}
                  className={`px-2 py-0.5 rounded font-mono text-[11px] font-bold cursor-pointer ${
                    snapMm === s
                      ? "bg-amber-700 text-white"
                      : "text-stone-600 hover:bg-stone-100"
                  }`}
                >
                  {s === 0 ? "Kapalı" : `${s}mm`}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 font-mono text-xs text-stone-700">
              <Ruler className="w-3.5 h-3.5 text-amber-700" />
              <span>Duvar: {mainWall.length}mm</span>
              <span className="text-stone-300">|</span>
              <span className="text-sky-800 font-bold">Boşluk: {remainingWallMm}mm</span>
            </div>
          </div>
        </div>
      )}

      {/* 2. MAIN UNIFIED WORKSPACE STAGE (Persists WebGL Canvas without unmounting!) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* LEFT TOOL LIBRARY (Visible in Studio Mode) */}
        {mode === "studio" && (
          <aside
            data-testid="studio-left-library"
            className="border-r border-stone-200 bg-[#F8F7F4] text-stone-900 flex flex-col z-20 shrink-0 relative"
            style={{ width: leftOpen ? `${studioLeftWidthPx}px` : "56px" }}
          >
            {leftOpen && (
              <div
                data-testid="studio-left-resize-handle"
                title="Sol panel genişliğini değiştirmek için sürükleyin"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setResizingPanel("studio-left");
                }}
                className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-amber-600/40 active:bg-amber-700/60 z-30 transition-colors"
              />
            )}
            <div className="h-12 border-b border-stone-200 flex items-center justify-between px-3 bg-white">
              {leftOpen && (
                <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl border border-stone-200 w-full mr-2">
                  <button
                    type="button"
                    data-testid="studio-tab-templates"
                    onClick={() => setLeftTab("templates")}
                    className={`flex-1 py-1 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      leftTab === "templates"
                        ? "bg-amber-600 text-white shadow-2xs"
                        : "text-stone-600 hover:text-stone-900"
                    }`}
                  >
                    <Package className="w-3.5 h-3.5 text-amber-700" />
                    <span>Şablon</span>
                  </button>
                  <button
                    type="button"
                    data-testid="studio-tab-materials"
                    onClick={() => setLeftTab("materials")}
                    className={`flex-1 py-1 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      leftTab === "materials"
                        ? "bg-amber-600 text-white shadow-2xs"
                        : "text-stone-600 hover:text-stone-900"
                    }`}
                  >
                    <Palette className="w-3.5 h-3.5 text-amber-700" />
                    <span>Yüzey</span>
                  </button>
                </div>
              )}
              <button
                type="button"
                data-testid="studio-toggle-left"
                onClick={() => setLeftOpen(!leftOpen)}
                className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition cursor-pointer mx-auto"
              >
                {leftOpen ? (
                  <ChevronLeft className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
            </div>

            {leftOpen ? (
              <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
                {leftTab === "templates" ? (
                  <>
                    {/* Floating Full-Screen Visual Catalog Trigger */}
                    <button
                      type="button"
                      data-testid="v4-open-floating-catalog-btn"
                      onClick={() => setIsVisualCatalogOpen(true)}
                      className="w-full py-2.5 px-3 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold flex items-center justify-between shadow-sm transition cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <Maximize2 className="w-3.5 h-3.5 text-amber-200" />
                        <span>Büyük İkonlu Modül Vitrinini Aç</span>
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-amber-900/60 text-[10px] font-mono">
                        92 Modül
                      </span>
                    </button>

                    {/* 1. Hazır Dolap & Mutfak Şablonları — 2 Sütunlu Büyük İkon Kartları */}
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500 px-1">
                        Hızlı Başlangıç Şablonları
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {WARDROBE_TEMPLATES.map((tpl) => (
                          <button
                            key={tpl.templateId}
                            type="button"
                            draggable={true}
                            onDragStart={(e) => startModuleSilhouetteDrag(e, tpl.templateId)}
                            onDragEnd={() => setActiveDraggedTemplateId(null)}
                            data-testid={`studio-tpl-${tpl.templateId}`}
                            onClick={() => applyTemplate(tpl.templateId)}
                            title={`${tpl.name} — Tıklayın veya 3D/2D Sahneye Sürükleyip Bırakın (Otomatik Snap)`}
                            className="p-2.5 rounded-xl bg-white hover:bg-amber-50/60 border border-stone-200 hover:border-amber-500 transition group flex flex-col items-center text-center cursor-grab active:cursor-grabbing shadow-2xs"
                          >
                            <div className="w-full py-2 rounded-lg bg-white border border-stone-200/70 flex items-center justify-center shadow-2xs group-hover:scale-[1.03] transition-transform">
                              <V3IsometricModuleIcon
                                module={tpl.createInstance(`preview_${tpl.templateId}`)}
                                size="xl"
                              />
                            </div>
                            <div className="text-xs font-extrabold text-stone-900 group-hover:text-amber-800 mt-1.5 line-clamp-1">
                              {tpl.name}
                            </div>
                            <div className="text-[10px] font-mono text-stone-500">
                              {tpl.defaultDimensions.width}×{tpl.defaultDimensions.height}
                            </div>
                          </button>
                        ))}

                        <button
                          type="button"
                          data-testid="studio-tpl-kitchen-linear"
                          onClick={loadLinearKitchen}
                          title="Doğrusal Mutfak (3.2m) — Evye + Çekmeceli Modül + Boy Kiler + Üst Dolaplar"
                          className="p-2.5 rounded-xl bg-white hover:bg-amber-50/60 border border-stone-200 hover:border-amber-500 transition group flex flex-col items-center text-center cursor-pointer shadow-2xs"
                        >
                          <div className="w-full py-2 rounded-lg bg-white border border-stone-200/70 flex items-center justify-center shadow-2xs group-hover:scale-[1.03] transition-transform">
                            <V3IsometricModuleIcon presetLayout="linear_kitchen" size="xl" />
                          </div>
                          <div className="text-xs font-extrabold text-stone-900 group-hover:text-amber-800 mt-1.5 line-clamp-1">
                            Doğrusal Mutfak
                          </div>
                          <div className="text-[10px] font-mono text-stone-500">3200×2200</div>
                        </button>

                        <button
                          type="button"
                          data-testid="studio-tpl-kitchen-l"
                          onClick={loadLKitchen}
                          title="L Tipi Mutfak (90° Köşe Dönüşlü)"
                          className="p-2.5 rounded-xl bg-white hover:bg-amber-50/60 border border-stone-200 hover:border-amber-500 transition group flex flex-col items-center text-center cursor-pointer shadow-2xs"
                        >
                          <div className="w-full py-2 rounded-lg bg-white border border-stone-200/70 flex items-center justify-center shadow-2xs group-hover:scale-[1.03] transition-transform">
                            <V3IsometricModuleIcon presetLayout="l_kitchen" size="xl" />
                          </div>
                          <div className="text-xs font-extrabold text-stone-900 group-hover:text-amber-800 mt-1.5 line-clamp-1">
                            L Tipi Mutfak (90°)
                          </div>
                          <div className="text-[10px] font-mono text-stone-500">Köşe Dizilim</div>
                        </button>
                      </div>
                    </div>

                    {/* V4 SMART WALL LAYOUT BUILDER & COMPLEMENTARY GENERATOR */}
                    <div className="pt-2.5 border-t border-stone-200/80 space-y-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800 px-1 flex items-center gap-1">
                        <Wand2 className="w-3 h-3" />
                        <span>Akıllı Duvar & Otomatik Tamamlayıcı</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          data-testid="v4-smart-wall-4carcass"
                          onClick={() => applySmartWallProposal("smart_layout_4_equal", 3600)}
                          className="p-2 rounded-xl bg-amber-50/80 hover:bg-amber-100 border border-amber-300 text-center text-[11px] flex flex-col items-center gap-1 cursor-pointer"
                        >
                          <V3IsometricModuleIcon
                            widthMm={2000}
                            heightMm={2200}
                            depthMm={600}
                            bayCount={4}
                            size="lg"
                          />
                          <div className="font-bold text-stone-900">3.6m → 4 Gövde</div>
                        </button>
                        <button
                          type="button"
                          data-testid="v4-smart-wall-mixed"
                          onClick={() => applySmartWallProposal("smart_layout_mixed_wardrobe", 3600)}
                          className="p-2 rounded-xl bg-amber-50/80 hover:bg-amber-100 border border-amber-300 text-center text-[11px] flex flex-col items-center gap-1 cursor-pointer"
                        >
                          <V3IsometricModuleIcon
                            widthMm={2000}
                            heightMm={2200}
                            depthMm={600}
                            bayCount={3}
                            hasDrawers={true}
                            size="lg"
                          />
                          <div className="font-bold text-stone-900">3.6m → Karma</div>
                        </button>
                      </div>
                      <button
                        type="button"
                        data-testid="v4-auto-complementary-btn"
                        onClick={autoGenerateKitchenComplementary}
                        className="w-full py-2 px-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3 text-amber-400" />
                        <span>Otomatik Tezgâh / Backsplash / Yan Bitiş</span>
                      </button>
                    </div>

                    {/* V4 UNIVERSAL 6-FAMILY / 92-TEMPLATE VISUAL ICON CATALOG */}
                    <div className="pt-2.5 border-t border-stone-200/80 space-y-2">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                          Görsel Modül Kütüphanesi ({familyTemplates.length})
                        </span>
                      </div>

                      {/* 1-Click Quick Family Filter Chips (Icon + Clear Label + Count) */}
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          {
                            id: "fam_kitchen_base",
                            icon: "🗄️",
                            short: "Mutfak Alt Dolap",
                            sub: "Evye, Çekmece, Ocak, Fırın (20)",
                            desc: "Tezgâh altı mutfak modülleri: evye dolabı, 2/3 çekmeceli modül, ankastre fırın, bulaşık makinesi ve şişelik.",
                          },
                          {
                            id: "fam_kitchen_wall",
                            icon: "⬆️",
                            short: "Mutfak Üst Dolap",
                            sub: "AVENTOS Kalkar, Camlı, Aspiratör (15)",
                            desc: "Duvara asılan üst dolaplar (Y: 1400mm): Blum AVENTOS yukarı kalkar kapak, tek/çift kapaklı ve aspiratör modülleri.",
                          },
                          {
                            id: "fam_kitchen_tall",
                            icon: "🏢",
                            short: "Boy / Kiler / Ankastre",
                            sub: "Boy Kiler, Ankastre Fırın/Buzdolabı (12)",
                            desc: "Tam boy (2100–2400mm) mutfak kolonları: Dispensa kiler, boy fırın+mikrodalga kulesi ve ankastre buzdolabı dolabı.",
                          },
                          {
                            id: "fam_wardrobe",
                            icon: "🚪",
                            short: "Gardırop Modülleri",
                            sub: "1–6 Kapaklı, Sürgülü, Yüklük (20)",
                            desc: "Yatak odası ve giyinme odası gardıropları: askılı, raflı, iç çekmeceli, pantolonluklu ve sürgü kapaklı gövdeler.",
                          },
                          {
                            id: "fam_special_corner",
                            icon: "📐",
                            short: "Köşe Dönüş Modülleri",
                            sub: "90° L Köşe, Kör Köşe, LeMans (10)",
                            desc: "L ve U tipi yerleşimler için 90° köşe dönüş dolapları, LeMans mekanizmalı kör köşe ve diyagonal köşe modülleri.",
                          },
                          {
                            id: "fam_complementary",
                            icon: "🧩",
                            short: "Tamamlayıcı (Dolaba Bağlı)",
                            sub: "Yan Bitiş, Taç, Tezgâh, Backsplash (15)",
                            desc: "Önce sahneden bir dolap seçin, ardından buradan tıklayın: seçili dolabın sağına/soluna/üstüne otomatik entegre olur ve dolapla birlikte hareket eder.",
                          },
                        ].map((fChip) => {
                          const isAct = selectedV4Family === fChip.id;
                          return (
                            <button
                              key={fChip.id}
                              type="button"
                              data-testid={`v4-family-chip-${fChip.id}`}
                              onClick={() => setSelectedV4Family(fChip.id as ModuleFamilyId)}
                              title={fChip.desc}
                              className={`p-2 rounded-xl text-left transition cursor-pointer border flex flex-col justify-between gap-0.5 ${
                                isAct
                                  ? "bg-amber-700 text-white border-amber-800 shadow-sm ring-2 ring-amber-300"
                                  : "bg-white hover:bg-amber-50/70 text-stone-900 border-stone-200 hover:border-amber-400"
                              }`}
                            >
                              <div className="flex items-center gap-1.5 text-xs font-extrabold leading-tight">
                                <span>{fChip.icon}</span>
                                <span className="truncate">{fChip.short}</span>
                              </div>
                              <div
                                className={`text-[10px] font-medium truncate ${
                                  isAct ? "text-amber-100" : "text-stone-500"
                                }`}
                              >
                                {fChip.sub}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Active Category Clear Explanation Banner */}
                      <div
                        data-testid="v4-active-family-explainer"
                        className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-stone-800 leading-snug"
                      >
                        {selectedV4Family === "fam_kitchen_base" && (
                          <span>
                            <strong>🗄️ Mutfak Alt Dolapları ({familyTemplates.length} Ürün):</strong> Zemine oturan (Y:0mm) evye, çekmeceli, fırın ve bulaşık makinesi modülleri. Üzerlerinde otomatik 38mm kuvars tezgâh bulunur.
                          </span>
                        )}
                        {selectedV4Family === "fam_kitchen_wall" && (
                          <span>
                            <strong>⬆️ Mutfak Üst Dolapları ({familyTemplates.length} Ürün):</strong> Duvara 1400mm kotta asılan AVENTOS yukarı açılır, tek/çift kapaklı ve aspiratörlü üst dolaplar.
                          </span>
                        )}
                        {selectedV4Family === "fam_kitchen_tall" && (
                          <span>
                            <strong>🏢 Boy / Kiler & Ankastre Kuleler ({familyTemplates.length} Ürün):</strong> Tam boy erzak kileri, boy ankastre fırın+mikrodalga ve buzdolabı modülleri.
                          </span>
                        )}
                        {selectedV4Family === "fam_wardrobe" && (
                          <span>
                            <strong>🚪 Gardırop Modülleri ({familyTemplates.length} Ürün):</strong> 1–6 kapaklı menteşeli, sürgülü ve açık giyinme odası gardıropları.
                          </span>
                        )}
                        {selectedV4Family === "fam_special_corner" && (
                          <span>
                            <strong>📐 90° Köşe Dönüş Modülleri ({familyTemplates.length} Ürün):</strong> L ve U mutfak/gardırop dönüşleri için kör köşe, LeMans ve 90° L köşe dolapları.
                          </span>
                        )}
                        {selectedV4Family === "fam_complementary" && (
                          <span>
                            <strong>🧩 Seçili Dolaba Bağlı Tamamlayıcılar ({familyTemplates.length} Ürün):</strong> Bu parçalar <strong>aktif seçili dolaba (#{activeModuleIndex + 1} {activeModule.name})</strong> doğrudan bağlanır ve dolap taşındığında birlikte hareket eder!
                          </span>
                        )}
                      </div>

                      <select
                        aria-label="V4 Modül Ailesi Seçin"
                        data-testid="v4-family-selector"
                        value={selectedV4Family}
                        onChange={(e) => setSelectedV4Family(e.target.value as ModuleFamilyId)}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs font-bold text-stone-900 cursor-pointer shadow-2xs"
                      >
                        {v4ModuleFamilies.map((fam) => (
                          <option key={fam.id} value={fam.id}>
                            {fam.name} ({fam.targetTemplateCount})
                          </option>
                        ))}
                      </select>

                      <input
                        type="text"
                        data-testid="v4-catalog-search-input"
                        value={catalogSearchQuery}
                        onChange={(e) => setCatalogSearchQuery(e.target.value)}
                        placeholder="Modül veya ölçü ara (ör: evye, 600, çekmece)..."
                        className="w-full px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs font-medium text-stone-900 placeholder:text-stone-400 shadow-2xs"
                      />

                      <div
                        data-testid="v4-template-list"
                        className="grid grid-cols-2 gap-2 pr-0.5"
                      >
                        {familyTemplates.map((vt) => (
                          <div
                            key={vt.templateId}
                            draggable={true}
                            onDragStart={(e) => startModuleSilhouetteDrag(e, vt.templateId)}
                            onDragEnd={() => setActiveDraggedTemplateId(null)}
                            title={`${vt.name} (${vt.defaultDimensions.width}×${vt.defaultDimensions.height}×${vt.defaultDimensions.depth}mm) — 3D veya 2D Sahneye Sürükleyip Bırakın (Sıraya Otomatik Snap)`}
                            className="p-2.5 rounded-2xl bg-white hover:bg-amber-50/50 border border-stone-200 hover:border-amber-500 flex flex-col items-center text-center justify-between gap-1.5 transition group cursor-grab active:cursor-grabbing shadow-2xs"
                          >
                            <button
                              type="button"
                              onClick={() => dropV4TemplateWithSnap(vt.templateId)}
                              className="w-full py-2.5 rounded-xl bg-white border border-stone-200/90 shadow-xs flex items-center justify-center group-hover:scale-[1.04] transition-transform cursor-grab active:cursor-grabbing"
                            >
                              <V3IsometricModuleIcon
                                template={vt}
                                size="xl"
                                testId={`v4-tpl-visual-${vt.templateId}`}
                              />
                            </button>
                            <div className="w-full min-w-0">
                              <div className="text-xs font-extrabold text-stone-900 truncate leading-tight">
                                {vt.name}
                              </div>
                              <div className="text-[10px] font-mono text-amber-800 font-bold mt-0.5">
                                {vt.defaultDimensions.width}×{vt.defaultDimensions.height}×{vt.defaultDimensions.depth} • ✋ Sürükle/Snap
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-1 w-full">
                              <button
                                type="button"
                                data-testid={`v4-apply-tpl-${vt.templateId}`}
                                onClick={() => applyV4Template(vt.templateId, false)}
                                className="py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 border border-stone-300 text-[11px] font-bold text-stone-800 cursor-pointer"
                                title="Aktif modülü bu şablonla değiştir"
                              >
                                Değiştir
                              </button>
                              <button
                                type="button"
                                data-testid={`v4-append-tpl-${vt.templateId}`}
                                onClick={() => dropV4TemplateWithSnap(vt.templateId)}
                                className="py-1 rounded-lg bg-amber-700 hover:bg-amber-800 text-[10px] font-bold text-white cursor-pointer"
                                title="Sıraya mıknatıslı (Snap) olarak yanına ekle"
                              >
                                🧲 +Sıraya Snap
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-4">
                    {/* ONE-CLICK BUDGET / SEGMENT SWITCHER */}
                    <div
                      data-testid="v4-segment-switcher"
                      className="p-2.5 rounded-xl bg-amber-50/90 border border-amber-300 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900">
                          Tek Tıkla Bütçe & Segment Dönüşümü
                        </span>
                        <span className="text-[9px] font-mono text-stone-600">
                          Malzeme + Ray + Menteşe + LED
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        {[
                          {
                            id: "economy",
                            label: "Ekonomik",
                            sub: "Suntalam + Tandembox",
                          },
                          {
                            id: "standard",
                            label: "Standart",
                            sub: "Kastamonu MDF + Movento",
                          },
                          {
                            id: "premium",
                            label: "Premium + LED",
                            sub: "AGT Supramat + Legrabox",
                          },
                        ].map((seg) => (
                          <button
                            key={seg.id}
                            type="button"
                            data-testid={`v4-segment-btn-${seg.id}`}
                            onClick={() =>
                              applyProjectSegmentPreset(
                                seg.id as "economy" | "standard" | "premium"
                              )
                            }
                            className="p-2 rounded-xl bg-white hover:bg-amber-700 hover:text-white border border-amber-300 text-stone-900 transition flex flex-col items-center text-center cursor-pointer group"
                          >
                            <span className="text-[11px] font-bold">{seg.label}</span>
                            <span className="text-[9px] text-stone-500 group-hover:text-amber-100 leading-tight mt-0.5">
                              {seg.sub}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-stone-600">
                          Kapak & Ön Cephe (Kastamonu / Yıldız / AGT / Çamsan)
                        </span>
                      </div>
                      {DEFAULT_MATERIALS.filter((m) => m.id !== "mat_led_warm_3000k").map((mat) => (
                        <V3MaterialSwatch
                          key={mat.id}
                          id={mat.id}
                          testId={`studio-door-mat-${mat.id}`}
                          name={mat.decorCode ? `${mat.name} [${mat.decorCode}]` : mat.name}
                          colorHex={mat.colorHex}
                          costPerM2={mat.costPerM2}
                          category={mat.brand ? `${mat.brand} • ${mat.category}` : mat.category}
                          selected={activeModule.carcass.doorMaterialId === mat.id}
                          onSelect={() => setMaterials(undefined, mat.id)}
                        />
                      ))}
                    </div>

                    <div className="pt-3 border-t border-stone-200 space-y-2">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-stone-600">
                        Gövde İç Levhası (Kastamonu / Yıldız / Çamsan)
                      </div>
                      {DEFAULT_MATERIALS.filter(
                        (m) =>
                          m.category === "laminate" ||
                          m.category === "wood" ||
                          m.category === "lacquer"
                      ).map((mat) => (
                        <V3MaterialSwatch
                          key={mat.id}
                          id={mat.id}
                          testId={`studio-body-mat-${mat.id}`}
                          name={mat.decorCode ? `${mat.name} [${mat.decorCode}]` : mat.name}
                          colorHex={mat.colorHex}
                          costPerM2={mat.costPerM2}
                          category={mat.brand ? `${mat.brand} • ${mat.category}` : mat.category}
                          selected={activeModule.carcass.bodyMaterialId === mat.id}
                          onSelect={() => setMaterials(mat.id, undefined)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center py-4 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setLeftTab("templates");
                    setLeftOpen(true);
                  }}
                  className="w-10 h-10 rounded-xl bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-700 cursor-pointer"
                >
                  <Package className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLeftTab("materials");
                    setLeftOpen(true);
                  }}
                  className="w-10 h-10 rounded-xl bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-700 cursor-pointer"
                >
                  <Palette className="w-4 h-4" />
                </button>
              </div>
            )}
          </aside>
        )}

        {/* 2D ARCHITECTURAL PLAN PANE */}
        {(mode === "plan" || (mode === "studio" && studioView === "2d")) && (
          <div
            className={`${
              mode === "plan" ? "" : "flex-1"
            } h-full relative flex flex-col shrink-0`}
            style={
              mode === "plan" ? { width: `calc(${planSplitRatioPct}% - 7px)` } : undefined
            }
          >
            <V3CadViewport2D
              mode={mode === "plan" ? "plan" : studio2DMode}
              interactivePlan={mode === "plan" || (mode === "studio" && studio2DMode === "plan")}
              snapMm={snapMm}
            />

            {mode === "plan" && (
              <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-white/95 backdrop-blur-md p-1.5 rounded-xl border border-stone-200 shadow-sm flex-wrap max-w-[96%]">
                {project.modules.map((m, idx) => (
                  <div
                    key={m.id}
                    className={`rounded-xl text-xs font-semibold flex items-center gap-1 transition ${
                      activeModuleIndex === idx
                        ? "bg-amber-700 text-white shadow-xs"
                        : "bg-stone-100 hover:bg-stone-200 text-stone-800"
                    }`}
                  >
                    <button
                      type="button"
                      data-testid={`plan-mod-tab-${idx}`}
                      onClick={() => setActiveModuleIndex(idx)}
                      className="px-2.5 py-1 flex items-center gap-2 cursor-pointer"
                    >
                      <V3IsometricModuleIcon module={m} size="sm" />
                      <div className="text-left leading-tight">
                        <div className="font-bold">
                          {idx + 1}. {m.name}
                        </div>
                        <div
                          className={`text-[10px] font-mono ${
                            activeModuleIndex === idx ? "text-amber-100" : "text-stone-500"
                          }`}
                        >
                          {m.dimensions.width}×{m.dimensions.height}mm • {m.bays.length} Bölme
                        </div>
                      </div>
                    </button>
                    {project.modules.length > 1 && (
                      <button
                        type="button"
                        data-testid={`plan-delete-mod-${idx}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeModuleAt(idx);
                        }}
                        title="Bu modülü sil"
                        className={`mr-1.5 p-1 rounded-lg transition cursor-pointer ${
                          activeModuleIndex === idx
                            ? "hover:bg-amber-800 text-amber-100 hover:text-white"
                            : "hover:bg-red-100 text-stone-400 hover:text-red-700"
                        }`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  data-testid="plan-add-module-btn"
                  onClick={addAdjacentModule}
                  title="Aktif modülün bir kopyasını yanına bitişik ekle"
                  className="px-2.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Aynı Modülden Ekle
                </button>
                <button
                  type="button"
                  data-testid="plan-quick-open-wall-elevation-btn"
                  onClick={() =>
                    setPlanRightView((prev) =>
                      prev === "2d-elevation" ? "3d-iso" : "2d-elevation"
                    )
                  }
                  title="Sağ panelde Duvar Cephe Görünüşünü (Pencere, Tesisat, Priz, Kapı ve Modüller) aç/kapat"
                  className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer ${
                    planRightView === "2d-elevation"
                      ? "bg-sky-700 text-white ring-2 ring-sky-300"
                      : "bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-300"
                  }`}
                >
                  <span>🏠 {planRightView === "2d-elevation" ? "3D Perspektife Dön" : "Duvar Cephe Görünüşü"}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* VISIBLE INTERACTIVE DRAGGABLE SPLITTER BAR BETWEEN 2D PLAN AND 3D/ELEVATION PANE */}
        {mode === "plan" && (
          <div
            data-testid="plan-split-resize-handle"
            title="Fareyle basılı tutup sağa/sola kaydırarak 2D Plan ve 3D/Duvar Görünüşü ekran oranını değiştirin"
            onMouseDown={(e) => {
              e.preventDefault();
              setResizingPanel("plan-split");
            }}
            className={`w-3.5 h-full shrink-0 cursor-col-resize flex flex-col items-center justify-center relative z-30 select-none transition-colors border-x ${
              resizingPanel === "plan-split"
                ? "bg-amber-600 border-amber-700"
                : "bg-stone-200 hover:bg-amber-500/80 border-stone-300"
            }`}
          >
            <div className="w-5 h-16 rounded-full bg-stone-900 text-white shadow-md flex flex-col items-center justify-center gap-0.5 pointer-events-none border border-stone-600">
              <span className="text-[10px] leading-none font-bold text-amber-400">⟷</span>
              <span className="text-[8px] font-mono leading-none">{planSplitRatioPct}%</span>
            </div>
          </div>
        )}

        {/* PERSISTENT 3D WEBGL VIEWPORT & PLAN RIGHT PANE */}
        <main
          className={`${
            mode === "studio" && studioView === "2d"
              ? "hidden"
              : "flex-1"
          } relative h-full flex flex-col overflow-hidden`}
          style={
            mode === "plan"
              ? { width: `calc(${100 - planSplitRatioPct}% - 7px)` }
              : undefined
          }
        >
          {/* DEDICATED NON-OVERLAPPING TOP BAR IN PLAN MODE FOR SWITCHING BETWEEN 3D PERSPECTIVE & 2D WALL ELEVATION */}
          {mode === "plan" && (
            <div
              data-testid="plan-right-view-switcher"
              className="min-h-[46px] px-3 py-1.5 bg-stone-900 text-white border-b border-stone-700 flex items-center justify-between gap-2 shrink-0 z-20 flex-wrap"
            >
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mr-1">
                  Sağ Ekran:
                </span>
                {[
                  { id: "2d-elevation", label: "🏠 2D Duvar Görünüşü (Tesisat/Pencere)" },
                  { id: "2d-section", label: "📐 2D Yan Kesit" },
                  { id: "3d-iso", label: "🧊 3D Perspektif", cam: "iso" as const },
                  { id: "3d-front", label: "⬆️ 3D Ön", cam: "front" as const },
                  { id: "3d-side", label: "➡️ 3D Yan", cam: "side" as const },
                  { id: "3d-top", label: "⬇️ 3D Üst", cam: "top" as const },
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
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                      planRightView === opt.id
                        ? "bg-amber-600 text-white shadow-xs"
                        : "bg-stone-800 hover:bg-stone-700 text-stone-200"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1">
                {[35, 50, 65].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    data-testid={`plan-split-preset-${pct}`}
                    onClick={() => setPlanSplitRatioPct(pct)}
                    title={`Sol Plan / Sağ Görünüş oranını %${pct} / %${100 - pct} yap`}
                    className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold cursor-pointer ${
                      Math.abs(planSplitRatioPct - pct) <= 3
                        ? "bg-sky-600 text-white"
                        : "bg-stone-800 hover:bg-stone-700 text-stone-300"
                    }`}
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
                      ? "bg-amber-700 text-white"
                      : "bg-stone-800 hover:bg-stone-700 text-stone-300"
                  }`}
                  title="3D Perspektif Ölçülerini Göster / Gizle"
                >
                  <Ruler className="w-3 h-3" />
                  <span>Ölçü</span>
                </button>
                <button
                  type="button"
                  data-testid="plan-right-door-toggle"
                  onClick={toggleDoorOpen}
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer ${
                    doorOpenAngleDeg > 0
                      ? "bg-amber-700 text-white"
                      : "bg-stone-800 hover:bg-stone-700 text-stone-300"
                  }`}
                >
                  <DoorOpen className="w-3 h-3" />
                  <span>{doorOpenAngleDeg > 0 ? "Kapat" : "İçini Aç"}</span>
                </button>
              </div>
            </div>
          )}

          {/* DEDICATED NON-OVERLAPPING TOP MODULE & DOOR BAR IN STUDIO MODE (Zero Bottom Button Overlap!) */}
          {mode === "studio" && (
            <div
              data-testid="studio-top-module-bar"
              className="min-h-[50px] px-3 py-1.5 bg-white text-stone-900 border-b border-stone-200 flex items-center justify-between gap-2 shrink-0 z-20 overflow-x-auto shadow-2xs"
            >
              <div className="flex items-center gap-1.5 min-w-0 overflow-x-auto pr-2">
                {project.modules.map((m, idx) => (
                  <div
                    key={m.id}
                    className={`rounded-xl text-xs font-semibold flex items-center gap-1 transition shrink-0 border ${
                      activeModuleIndex === idx
                        ? "bg-amber-600 text-white border-amber-500 shadow-xs"
                        : "bg-stone-100 hover:bg-stone-200 text-stone-800 border-stone-200"
                    }`}
                  >
                    <button
                      type="button"
                      data-testid={`studio-mod-pill-${idx}`}
                      onClick={() => setActiveModuleIndex(idx)}
                      className="px-2.5 py-1 flex items-center gap-2 cursor-pointer"
                    >
                      <V3IsometricModuleIcon module={m} size="sm" />
                      <div className="text-left leading-tight">
                        <div className="font-bold">{idx + 1}. {m.name}</div>
                        <div
                          className={`text-[10px] font-mono ${
                            activeModuleIndex === idx ? "text-amber-100" : "text-stone-500"
                          }`}
                        >
                          {m.dimensions.width}×{m.dimensions.height}×{m.dimensions.depth}
                        </div>
                      </div>
                    </button>
                    {project.modules.length > 1 && (
                      <button
                        type="button"
                        data-testid={`studio-delete-mod-${idx}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeModuleAt(idx);
                        }}
                        title="Bu modülü sil"
                        className={`mr-1.5 p-1 rounded-lg transition cursor-pointer ${
                          activeModuleIndex === idx
                            ? "hover:bg-amber-700 text-amber-100 hover:text-white"
                            : "hover:bg-red-100 text-stone-400 hover:text-red-700"
                        }`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  data-testid="studio-pill-add-module"
                  onClick={addAdjacentModule}
                  className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                  title="Aktif modülün bir kopyasını yanına bitişik ekle"
                >
                  <Plus className="w-3.5 h-3.5 text-amber-400" />
                  <span>+ Aynı Modülden Ekle</span>
                </button>
                <button
                  type="button"
                  data-testid="studio-door-toggle"
                  onClick={toggleDoorOpen}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
                    doorOpenAngleDeg > 0
                      ? "bg-amber-600 text-white"
                      : "bg-stone-100 hover:bg-stone-200 border border-stone-300 text-stone-800"
                  }`}
                >
                  <DoorOpen className="w-3.5 h-3.5 text-amber-400" />
                  <span>{doorOpenAngleDeg > 0 ? "Kapakları Kapat" : "İçini Göster"}</span>
                </button>
              </div>
            </div>
          )}

          <div className="relative flex-1 w-full h-full overflow-hidden flex flex-col">
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
              onToggleDimensions={() => setShow3DDimensions((prev) => !prev)}
            />

            {mode === "plan" &&
              (planRightView === "2d-elevation" ||
                planRightView === "2d-section") && (
                <div
                  data-testid="plan-right-2d-overlay"
                  className="absolute inset-0 z-10 bg-[#F7F6F2] flex flex-col"
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



          {/* SHOWROOM FLOATING OVERLAYS */}
          {mode === "showroom" && (
            <>
              {zenMode ? (
                <div className="absolute top-5 right-6 z-30">
                  <button
                    type="button"
                    data-testid="showroom-exit-zen"
                    onClick={() => setZenMode(false)}
                    className="px-4 py-2.5 rounded-2xl bg-stone-900/85 hover:bg-stone-900 text-white backdrop-blur-md text-xs font-semibold shadow-lg flex items-center gap-2 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-amber-400" />
                    <span>Sunum Modundan Çık</span>
                  </button>
                </div>
              ) : (
                <>
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-2 bg-white/90 backdrop-blur-md p-2.5 rounded-2xl border border-stone-200/90 shadow-lg">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 text-center">
                      Kamera
                    </div>
                    {[
                      { id: "iso", label: "Perspektif" },
                      { id: "front", label: "Ön Cephe" },
                      { id: "side", label: "Yan Bakış" },
                      { id: "top", label: "Üst Bakış" },
                    ].map((cam) => (
                      <button
                        key={cam.id}
                        type="button"
                        data-testid={`showroom-cam-${cam.id}`}
                        onClick={() =>
                          setCameraPreset(cam.id as "iso" | "front" | "side" | "top")
                        }
                        className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                          cameraPreset === cam.id
                            ? "bg-stone-900 text-white shadow-xs"
                            : "text-stone-700 hover:bg-stone-100"
                        }`}
                      >
                        <Camera className="w-3.5 h-3.5 text-amber-700" />
                        <span>{cam.label}</span>
                      </button>
                    ))}

                    <div className="h-px bg-stone-200 my-1" />

                    <button
                      type="button"
                      data-testid="showroom-door-toggle"
                      onClick={toggleDoorOpen}
                      className={`px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        doorOpenAngleDeg > 0
                          ? "bg-amber-700 text-white"
                          : "bg-stone-100 hover:bg-stone-200 text-stone-800"
                      }`}
                    >
                      {doorOpenAngleDeg > 0 ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5" />
                          <span>Kapakları Kapat</span>
                        </>
                      ) : (
                        <>
                          <DoorOpen className="w-3.5 h-3.5" />
                          <span>Kapakları Aç</span>
                        </>
                      )}
                    </button>

                    <div className="px-2 py-1 space-y-1">
                      <div className="flex justify-between text-[10px] text-stone-500 font-medium">
                        <span>Kapak</span>
                        <span className="font-mono font-bold text-stone-800">
                          {doorOpenAngleDeg}°
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={90}
                        value={doorOpenAngleDeg}
                        onChange={(e) => setDoorOpenAngleDeg(Number(e.target.value))}
                        className="w-28 accent-amber-700 h-1.5 bg-stone-200 rounded-lg cursor-pointer"
                      />
                    </div>

                    <div className="px-2 py-1 space-y-1">
                      <div className="flex justify-between text-[10px] text-stone-500 font-medium">
                        <span>Çekmece</span>
                        <span className="font-mono font-bold text-stone-800">
                          {drawerOpenMm}mm
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={350}
                        data-testid="showroom-drawer-open-slider"
                        aria-label="Çekmece açılma mesafesi"
                        step={25}
                        value={drawerOpenMm}
                        onChange={(e) => setDrawerOpenMm(Number(e.target.value))}
                        className="w-28 accent-amber-700 h-1.5 bg-stone-200 rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="absolute bottom-5 left-6 right-6 z-20 flex flex-wrap items-center justify-between gap-4 pointer-events-none">
                    <div className="pointer-events-auto flex items-center gap-2 bg-white/95 backdrop-blur-md px-4 py-2 rounded-2xl border border-stone-200/90 shadow-lg overflow-x-auto max-w-full">
                      <div className="flex items-center gap-1.5 pr-2 border-r border-stone-200 text-xs font-bold text-stone-700 shrink-0">
                        <Palette className="w-3.5 h-3.5 text-amber-700" />
                        <span>PBR Yüzey:</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {DEFAULT_MATERIALS.map((mat) => {
                          const isSelected =
                            activeModule.carcass.doorMaterialId === mat.id;
                          return (
                            <button
                              key={mat.id}
                              type="button"
                              data-testid={`showroom-mat-${mat.id}`}
                              onClick={() => setMaterials(undefined, mat.id)}
                              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-xs transition shrink-0 cursor-pointer ${
                                isSelected
                                  ? "bg-amber-50 border-amber-700 text-stone-900 font-bold shadow-2xs"
                                  : "bg-white hover:bg-stone-50 border-stone-200 text-stone-600"
                              }`}
                            >
                              <span
                                className="w-5 h-5 rounded-full border border-stone-300 flex items-center justify-center shrink-0"
                                style={{ backgroundColor: mat.colorHex }}
                              >
                                {isSelected && (
                                  <Check
                                    className={`w-3 h-3 ${
                                      mat.colorHex.toLowerCase() === "#f3f4f6" ||
                                      mat.colorHex.toLowerCase() === "#ede8d0"
                                        ? "text-stone-900"
                                        : "text-white"
                                    }`}
                                  />
                                )}
                              </span>
                              <span className="hidden xl:inline">
                                {mat.name.split(" (")[0]}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="pointer-events-auto flex items-center gap-4 bg-white/95 backdrop-blur-md px-5 py-2.5 rounded-2xl border border-stone-200/90 shadow-lg">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
                          Anahtar Teslim Fiyat
                        </span>
                        <div className="flex items-baseline gap-1.5">
                          <span
                            data-testid="showroom-total-price"
                            className="text-lg font-black font-mono text-stone-900"
                          >
                            €
                            {pricing.totalWithVatEur.toLocaleString("tr-TR", {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                          <span className="text-[11px] font-mono text-stone-500">
                            (
                            {pricing.totalWithVatTry.toLocaleString("tr-TR", {
                              maximumFractionDigits: 0,
                            })}{" "}
                            TL)
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </main>

        {/* CONTEXTUAL RIGHT PROPERTY INSPECTOR (DARK ARCHITECTURAL STUDIO UI) */}
        {mode === "studio" && (
          <aside
            data-testid="studio-right-inspector"
            className="border-l border-stone-200 bg-[#F8F7F4] text-stone-900 flex flex-col z-20 shrink-0 relative"
            style={{ width: `${studioRightWidthPx}px` }}
          >
            <div
              data-testid="studio-right-resize-handle"
              title="Sağ panel genişliğini değiştirmek için sürükleyin"
              onMouseDown={(e) => {
                e.preventDefault();
                setResizingPanel("studio-right");
              }}
              className="absolute top-0 left-0 w-1.5 h-full cursor-col-resize hover:bg-amber-600/40 active:bg-amber-700/60 z-30 transition-colors"
            />
            <div className="h-14 border-b border-stone-200 px-3.5 flex items-center justify-between gap-2 bg-white">
              <div className="flex items-center gap-2 min-w-0">
                <V3IsometricModuleIcon
                  module={activeModule}
                  size="sm"
                  testId="studio-active-module-visual"
                />
                <div className="min-w-0">
                  <div className="text-sm font-extrabold uppercase tracking-tight text-stone-900 truncate">
                    {activeModule.name}
                  </div>
                  <div className="text-xs font-mono font-bold text-amber-800">
                    {width}×{height}×{depth} mm
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  data-testid="studio-duplicate-active-module-btn"
                  onClick={duplicateActiveModule}
                  title="Aktif modülü yanına kopyala"
                  className="px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 border border-stone-300 text-stone-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3 h-3 text-amber-400" />
                  <span>Kopyala</span>
                </button>
                <button
                  type="button"
                  data-testid="studio-delete-active-module-btn"
                  disabled={project.modules.length <= 1}
                  onClick={removeActiveModule}
                  title={
                    project.modules.length <= 1
                      ? "Projede en az 1 modül kalmalıdır"
                      : "Aktif modülü sil (Delete)"
                  }
                  className="px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 disabled:opacity-40 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Sil</span>
                </button>
              </div>
            </div>

            {/* 1-CLICK QUICK SECTION FILTER BAR (Tümü | 📐 Ölçü | 🗄️ İç & LED | 🚪 Kapak) */}
            <div className="px-3 py-2 border-b border-stone-200 bg-stone-100/80 grid grid-cols-4 gap-1.5 shrink-0">
              {[
                { id: "all", label: "Tümü" },
                { id: "dimensions", label: "📐 Ölçü" },
                { id: "interior", label: "🗄️ İç & LED" },
                { id: "door", label: "🚪 Kapak" },
              ].map((sec) => (
                <button
                  key={sec.id}
                  type="button"
                  data-testid={`studio-sec-tab-${sec.id}`}
                  onClick={() =>
                    setStudioInspectorTab(
                      sec.id as "all" | "dimensions" | "interior" | "door"
                    )
                  }
                  className={`py-1.5 px-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer text-center truncate ${
                    studioInspectorTab === sec.id
                      ? "bg-amber-600 text-white shadow-xs"
                      : "bg-white hover:bg-stone-50 text-stone-700 hover:text-stone-900 border border-stone-200 shadow-2xs"
                  }`}
                >
                  {sec.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
              {selectedComponentId && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <div className="font-bold text-amber-900">Seçili Parça</div>
                    <div className="text-[10px] font-mono text-amber-800 truncate">
                      {selectedComponentId}
                    </div>
                  </div>
                  <button
                    type="button"
                    data-testid="studio-delete-selected-component-btn"
                    onClick={() => {
                      removeSelectedInteriorComponent();
                    }}
                    className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                    title="Seçili iç parçayı (raf, çekmece, askı, ara dikme) sil"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Parçayı Sil</span>
                  </button>
                </div>
              )}
              {/* V4 Universal Compatibility Status Banner */}
              <div
                data-testid="v4-compatibility-card"
                className={`p-2.5 rounded-xl border text-xs ${
                  v4CompatibilityReport.overallStatus === "COMPATIBLE"
                    ? "bg-emerald-50/80 border-emerald-200 text-emerald-900"
                    : v4CompatibilityReport.overallStatus === "COMPATIBLE_WITH_CONDITIONS"
                    ? "bg-amber-50 border-amber-300 text-amber-900"
                    : "bg-red-50 border-red-300 text-red-900"
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span>V4 Uyumluluk: {v4CompatibilityReport.overallStatus}</span>
                  <span className="text-[10px] font-mono">
                    {v4CompatibilityReport.canApproveProduction ? "Üretime Uygun" : "Bloklu"}
                  </span>
                </div>
                {v4CompatibilityReport.issues.length > 0 && (
                  <div className="mt-1.5 space-y-1">
                    {v4CompatibilityReport.issues.slice(0, 2).map((iss, idx) => (
                      <div
                        key={idx}
                        className="text-[11px] bg-white/80 px-2 py-1 rounded border border-stone-200/80"
                      >
                        <div className="font-semibold">{iss.message}</div>
                        {iss.suggestions && iss.suggestions[0] && (
                          <div className="text-[10px] text-amber-800 mt-0.5">
                            Öneri: {iss.suggestions[0]}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Spatial / Collision Alerts if any */}
              {errorIssues.length > 0 && (
                <V3AlertBanner
                  type="warning"
                  title="Mimari / Mekân Çakışma Uyarısı"
                  message={errorIssues[0].message}
                />
              )}

              {width > 1200 && activeModule.bays.length < 2 && (
                <V3AlertBanner
                  type="warning"
                  title="Geniş Açıklık Sehim Uyarısı"
                  message={`${width} mm genişlikte tek bölme raflarda esneme yapabilir.`}
                  actionLabel="Optimum Bölmeye Ayır"
                  onAction={() => applySmartSpan(width)}
                />
              )}

              {/* DIRECT QUICK-ACTION CARD: İSTEDİĞİNİZ RAFLAR ARASINA ARA DİKME & DOLAP İÇİ LED EKLEME */}
              {activeBay && (studioInspectorTab === "all" || studioInspectorTab === "interior") && (() => {
                const sortedShelves = [...activeBay.shelves].sort((a, b) => a.elevationY - b.elevationY);
                const T_p = activeModule.carcass.panelThickness || 18;
                const intervals: { label: string; elevY: number; height: number }[] = [];
                if (sortedShelves.length === 0) {
                  intervals.push({
                    label: "Alt Taban ↔ Üst Tavan",
                    elevY: 0,
                    height: netInnerHeightMm,
                  });
                } else {
                  if (sortedShelves[0].elevationY >= 60) {
                    intervals.push({
                      label: "Alt Taban ↔ Raf 1",
                      elevY: 0,
                      height: sortedShelves[0].elevationY,
                    });
                  }
                  for (let k = 0; k < sortedShelves.length - 1; k++) {
                    const botY = sortedShelves[k].elevationY + T_p;
                    const topY = sortedShelves[k + 1].elevationY;
                    if (topY - botY >= 60) {
                      intervals.push({
                        label: `Raf ${k + 1} ↔ Raf ${k + 2}`,
                        elevY: botY,
                        height: topY - botY,
                      });
                    }
                  }
                  const lastShelf = sortedShelves[sortedShelves.length - 1];
                  const lastBotY = lastShelf.elevationY + T_p;
                  if (netInnerHeightMm - lastBotY >= 60) {
                    intervals.push({
                      label: `Raf ${sortedShelves.length} ↔ Üst Tavan`,
                      elevY: lastBotY,
                      height: netInnerHeightMm - lastBotY,
                    });
                  }
                }
                const activeLeds = (activeBay.specialFittings || []).filter((f) => f.type.startsWith("led_"));
                return (
                  <div className="space-y-3">
                    <div
                      data-testid="studio-quick-subdivider-and-led-card"
                      className="p-3.5 rounded-2xl bg-white border-2 border-amber-300 space-y-3 shadow-xs"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-stone-900 flex items-center gap-1.5">
                            <Columns className="w-4 h-4 text-amber-700" />
                            <span>İstediğiniz Raflar Arasına Ara Dikme Ekle</span>
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[11px] font-mono font-bold">
                            {activeBay.subDividers?.length || 0} Dikme
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {intervals.map((iv, ivIdx) => (
                            <button
                              key={iv.label}
                              type="button"
                              data-testid={`studio-quick-add-subdivider-span-${ivIdx}`}
                              onClick={() =>
                                addSubDivider(activeBayIndex, {
                                  elevationY: iv.elevY,
                                  height: iv.height,
                                })
                              }
                              className="py-2 px-2.5 rounded-xl bg-stone-100 hover:bg-amber-700 text-stone-900 hover:text-white border border-stone-300 hover:border-amber-800 text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer shadow-2xs"
                              title={`${iv.label} arasına dikey ara dikme (bölücü) ekle`}
                            >
                              <span>➕ {iv.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="pt-2.5 border-t border-stone-200 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-stone-900 flex items-center gap-1">
                            <span>💡 Dolap İçi 3000K LED Aydınlatma</span>
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[11px] font-mono font-bold">
                            {activeLeds.length} Aktif LED
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {[
                            { type: "led_profile", label: "+ Raf/Üst LED" },
                            { type: "led_vertical_strip", label: "+ Yan Boy LED" },
                            { type: "led_rod_strip", label: "+ Askı LED" },
                          ].map((lo) => (
                            <button
                              key={lo.type}
                              type="button"
                              data-testid={`studio-quick-led-${lo.type}`}
                              onClick={() =>
                                addSpecialFitting(
                                  activeBayIndex,
                                  lo.type as import("@birim/core").SpecialFittingConfig["type"]
                                )
                              }
                              className="py-2 px-2 rounded-xl bg-amber-50 hover:bg-amber-700 text-amber-950 hover:text-white border border-amber-300 text-[11px] font-bold transition cursor-pointer shadow-2xs"
                            >
                              💡 {lo.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* OBJECT-LINKED COMPLEMENTARY PARTS FOR THE SELECTED CABINET */}
                    {activeModule.category !== "complementary" && (
                      <div
                        data-testid="studio-attached-complementary-card"
                        className="p-3.5 rounded-2xl bg-white border-2 border-stone-200 space-y-2 shadow-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-stone-900 flex items-center gap-1.5">
                            <span>🧩 Seçili Dolaba Tamamlayıcı Parça Bağla</span>
                          </span>
                          <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                            Dolapla Birlikte Hareket Eder
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-600 leading-snug">
                          Aşağıdaki tamamlayıcı parçalar doğrudan <strong>{activeModule.name}</strong> modülüne kilitlenir; dolabı taşıdığınızda veya büyüttüğünüzde otomatik uyum sağlar:
                        </p>
                        <div className="grid grid-cols-2 gap-1.5">
                          {[
                            { id: "panel_left", icon: "⬅️", label: "Sol Yan Bitiş Paneli (18mm)" },
                            { id: "panel_right", icon: "➡️", label: "Sağ Yan Bitiş Paneli (18mm)" },
                            { id: "crown_top", icon: "⬆️", label: "Üst Taç / Alın Çıtası (60mm)" },
                            { id: "filler_left", icon: "📏", label: "Duvar Kör Dolgu Çıtası (50mm)" },
                            { id: "worktop", icon: "🪨", label: "Üst Kuvars Tezgâh (38mm)" },
                            { id: "backsplash", icon: "🧱", label: "Tezgâh Arası Backsplash" },
                            { id: "waterfall_right", icon: "🌊", label: "Şelale Yan Tezgâh İnişi" },
                            { id: "plinth_front", icon: "⬛", label: "Baza Ön Bandı (100mm)" },
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
                                className={`py-2 px-2.5 rounded-xl border text-left text-[11px] font-bold flex items-center justify-between gap-1 transition cursor-pointer ${
                                  isAttached
                                    ? "bg-emerald-700 text-white border-emerald-800 shadow-xs"
                                    : "bg-stone-50 hover:bg-amber-50 text-stone-800 border-stone-300 hover:border-amber-500"
                                }`}
                              >
                                <span className="truncate">
                                  {cp.icon} {cp.label}
                                </span>
                                <span className="text-[10px] font-mono shrink-0">
                                  {isAttached ? "✓ Bağlı" : "+ Ekle"}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {(studioInspectorTab === "all" || studioInspectorTab === "dimensions") && (
              <V3CollapsibleSection
                title="1. Ölçülendirme"
                badge={`${width} × ${height} mm`}
                defaultOpen={true}
              >
                <V3DimensionControl
                  label="Genişlik"
                  code="W"
                  testIdPrefix="studio-width"
                  value={width}
                  min={300}
                  max={3600}
                  step={50}
                  presets={[1200, 1600, 1800, 2000, 2400]}
                  onChange={(w) => setDimensions(w, height, depth)}
                />
                <V3DimensionControl
                  label="Yükseklik"
                  code="H"
                  testIdPrefix="studio-height"
                  value={height}
                  min={400}
                  max={2800}
                  step={50}
                  presets={[2000, 2200, 2400, 2600]}
                  onChange={(h) => setDimensions(width, h, depth)}
                />
                <V3DimensionControl
                  label="Derinlik"
                  code="D"
                  testIdPrefix="studio-depth"
                  value={depth}
                  min={250}
                  max={900}
                  step={50}
                  presets={[450, 550, 600, 650]}
                  onChange={(d) => setDimensions(width, height, d)}
                />

                {fourSpaceDimensions && (
                  <div
                    data-testid="v4-four-space-summary"
                    className="p-2 rounded-xl bg-stone-50 border border-stone-200/90 text-[10px] font-mono text-stone-600 space-y-0.5"
                  >
                    <div>
                      Net İç: {fourSpaceDimensions.usableInternal.bayClearWidthsMm.join("+")} ×{" "}
                      {fourSpaceDimensions.usableInternal.netInnerHeightMm} ×{" "}
                      {fourSpaceDimensions.usableInternal.netInnerDepthMm} mm
                    </div>
                    {fourSpaceDimensions.doorLeaves[activeBayIndex] && (
                      <div>
                        Kapak ({fourSpaceDimensions.doorLeaves[activeBayIndex].leafCount} kanat):{" "}
                        {fourSpaceDimensions.doorLeaves[activeBayIndex].leafWidthMm}×
                        {fourSpaceDimensions.doorLeaves[activeBayIndex].leafHeightMm}mm •{" "}
                        {fourSpaceDimensions.doorLeaves[activeBayIndex].leafWeightKg}kg •{" "}
                        {fourSpaceDimensions.doorLeaves[activeBayIndex].recommendedHingesPerLeaf}{" "}
                        Menteşe
                      </div>
                    )}
                  </div>
                )}
              </V3CollapsibleSection>
              )}

              {(studioInspectorTab === "all" || studioInspectorTab === "interior") && (
              <V3CollapsibleSection
                title="2. Ara Dikme (Bölme) & İç Düzen"
                badge={`${Math.max(0, activeModule.bays.length - 1)} Ara Dikme • ${activeModule.bays.length} Bölme`}
                defaultOpen={true}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-stone-700">
                      Ara Dikme (Dikey Bölme) Yönetimi
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        data-testid="studio-remove-divider-btn"
                        disabled={activeModule.bays.length <= 1}
                        onClick={() => setBayCount(Math.max(1, activeModule.bays.length - 1))}
                        className="px-2 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 disabled:opacity-40 text-stone-700 text-[11px] font-bold cursor-pointer"
                        title="Son ara dikmeyi kaldır"
                      >
                        − Dikme Sil
                      </button>
                      <button
                        type="button"
                        data-testid="studio-add-divider-btn"
                        disabled={activeModule.bays.length >= 6}
                        onClick={() => setBayCount(Math.min(6, activeModule.bays.length + 1))}
                        className="px-2.5 py-1 rounded-lg bg-amber-700 hover:bg-amber-800 disabled:opacity-40 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
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
                        className={`h-9 rounded-xl font-mono text-[11px] font-bold transition cursor-pointer ${
                          activeModule.bays.length === cnt
                            ? "bg-stone-900 text-white shadow-xs"
                            : "bg-stone-100 hover:bg-stone-200 text-stone-700"
                        }`}
                      >
                        {cnt} Bölme
                      </button>
                    ))}
                  </div>

                  {/* V4 Wardrobe Interior Wizards */}
                  <div className="pt-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1">
                      Hızlı İç Düzen Sihirbazı (V4):
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {wardrobeWizards.map((wiz, wIdx) => (
                        <button
                          key={wiz.id}
                          type="button"
                          data-testid={`v4-wizard-${wiz.id}`}
                          onClick={() => applyWardrobeWizard(wiz.id)}
                          className="p-2 rounded-xl bg-stone-50 hover:bg-amber-50 border border-stone-200 hover:border-amber-600 text-[10px] font-bold text-stone-800 flex flex-col items-center text-center gap-1 transition cursor-pointer"
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
                              ? "bg-amber-700 text-white"
                              : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                          }`}
                        >
                          Bölme {idx + 1} ({activeBreakdown.bayWidths[idx] || 0}mm)
                        </button>
                      ))}
                    </div>

                    <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/90 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
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
                          <span className="font-mono text-[10px] text-stone-500">mm</span>
                          <button
                            type="button"
                            onClick={() => setBayCustomWidth(activeBayIndex, null)}
                            title="Tüm bölmeleri eşit genişliğe sıfırla"
                            className="ml-1 px-1.5 py-0.5 rounded bg-stone-200 hover:bg-stone-300 text-[10px] font-semibold text-stone-700 cursor-pointer"
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
                        className="w-full accent-amber-700 h-1.5 bg-stone-200 rounded-lg cursor-pointer"
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
                        className="min-h-[42px] px-2 py-2 rounded-xl bg-stone-100 hover:bg-amber-50 border border-stone-200 text-stone-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <Layers className="w-3.5 h-3.5 text-amber-700" />
                        <span>+ Raf ({activeBay.shelves.length})</span>
                      </button>
                      <button
                        type="button"
                        data-testid="studio-add-subdivider-btn"
                        onClick={() => addSubDivider(activeBayIndex)}
                        className="min-h-[42px] px-2 py-2 rounded-xl bg-amber-50/90 hover:bg-amber-100 border border-amber-300 text-stone-900 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                        title="İki raf arasına dikey ara dikme (bölücü) ekle"
                      >
                        <Columns className="w-3.5 h-3.5 text-amber-700" />
                        <span>+ Raf Arası Dikme ({activeBay.subDividers?.length || 0})</span>
                      </button>
                      <button
                        type="button"
                        data-testid="studio-add-drawer-btn"
                        onClick={() => addDrawer(activeBayIndex)}
                        className="min-h-[42px] px-2 py-2 rounded-xl bg-stone-100 hover:bg-amber-50 border border-stone-200 text-stone-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 text-amber-700" />
                        <span>+ Çekmece ({activeBay.drawers.length})</span>
                      </button>
                      <button
                        type="button"
                        data-testid="studio-add-rail-btn"
                        onClick={() => addHangingRail(activeBayIndex)}
                        className="min-h-[42px] px-2 py-2 rounded-xl bg-stone-100 hover:bg-amber-50 border border-stone-200 text-stone-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <Shirt className="w-3.5 h-3.5 text-amber-700" />
                        <span>+ Askı ({activeBay.hangingRails.length})</span>
                      </button>
                    </div>

                    {/* CABINET LED LIGHTING SYSTEM PICKER (HÄFELE LOOX5 3000K + 24V TRAFO & IR SENSOR) */}
                    <div
                      data-testid="studio-led-system-picker"
                      className="p-2.5 rounded-xl bg-amber-50/90 border border-amber-300 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900">
                          💡 Dolap İçi LED Aydınlatma (Häfele Loox5 3000K)
                        </span>
                        <span className="text-[9px] font-mono text-amber-800 font-bold">
                          +24V Trafo & IR Sensör Otomatik
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
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
                            className="p-2 rounded-xl bg-white hover:bg-amber-600 hover:text-white border border-amber-300 text-stone-900 flex flex-col items-center text-center transition cursor-pointer group"
                          >
                            <span className="text-[10px] font-bold">💡 + {ledOpt.label}</span>
                            <span className="text-[8px] text-stone-500 group-hover:text-amber-100 mt-0.5">
                              {ledOpt.sub}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* WORLD-BRAND INTERIOR ACCESSORIES VISUAL PICKER */}
                    <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/90 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900">
                          Dünya Markaları İç Aksesuarlar ({activeBay.specialFittings?.length || 0})
                        </span>
                        <span className="text-[9px] font-mono text-stone-500">
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
                            className="p-1.5 rounded-xl bg-white hover:bg-amber-50 border border-stone-200/90 hover:border-amber-600/60 flex items-center gap-1.5 text-left transition cursor-pointer"
                            title={`${acc.brand} ${acc.label} [${acc.sku}] Ekle`}
                          >
                            <div className="w-7 h-7 rounded-lg bg-amber-100/70 border border-amber-300 flex items-center justify-center shrink-0">
                              <svg viewBox="0 0 24 24" className="w-4 h-4 text-amber-900">
                                <rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
                                <line x1="6" y1="10" x2="18" y2="10" stroke="currentColor" strokeWidth="1.6" />
                                <line x1="6" y1="14" x2="18" y2="14" stroke="currentColor" strokeWidth="1.6" />
                              </svg>
                            </div>
                            <div className="min-w-0">
                              <span className="text-[9px] font-bold uppercase text-amber-800 block leading-none">
                                + {acc.brand}
                              </span>
                              <span className="text-[10px] font-bold text-stone-900 truncate block">
                                {acc.label}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-stone-600">
                        Bölme {activeBayIndex + 1} Kapak Tipi
                      </span>
                      <div className="grid grid-cols-3 gap-1">
                        {[
                          { id: "single_left", label: "Sol Kapak" },
                          { id: "double", label: "Çift Kapak" },
                          { id: "open", label: "Açık Modül" },
                        ].map((dt) => (
                          <button
                            key={dt.id}
                            type="button"
                            onClick={() =>
                              setBayDoorType(
                                activeBayIndex,
                                dt.id as "single_left" | "double" | "open"
                              )
                            }
                            className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                              activeBay.door.type === dt.id
                                ? "bg-stone-900 text-white"
                                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                            }`}
                          >
                            {dt.label}
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
                        <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                          İç Eleman Konum & Ölçü Ayarları (Bölme {activeBayIndex + 1})
                        </div>

                        {/* SUB-DIVIDERS */}
                        {(activeBay.subDividers || []).map((sd, i) => {
                          const sortedShelves = [...activeBay.shelves].sort(
                            (a, b) => a.elevationY - b.elevationY
                          );
                          const shelfSpans: {
                            label: string;
                            elevY: number;
                            height: number;
                          }[] = [];
                          if (sortedShelves.length === 0) {
                            shelfSpans.push({
                              label: "Alt Taban ↔ Üst Tavan",
                              elevY: 0,
                              height: netInnerHeightMm,
                            });
                          } else {
                            if (sortedShelves[0].elevationY > 40) {
                              shelfSpans.push({
                                label: "Alt ↔ Raf 1",
                                elevY: 0,
                                height: sortedShelves[0].elevationY,
                              });
                            }
                            for (let k = 0; k < sortedShelves.length - 1; k++) {
                              const botY = sortedShelves[k].elevationY + 18;
                              const topY = sortedShelves[k + 1].elevationY;
                              if (topY - botY >= 60) {
                                shelfSpans.push({
                                  label: `Raf ${k + 1} ↔ Raf ${k + 2}`,
                                  elevY: botY,
                                  height: topY - botY,
                                });
                              }
                            }
                            const lastShelf = sortedShelves[sortedShelves.length - 1];
                            const lastBotY = lastShelf.elevationY + 18;
                            if (netInnerHeightMm - lastBotY >= 60) {
                              shelfSpans.push({
                                label: `Raf ${sortedShelves.length} ↔ Üst`,
                                elevY: lastBotY,
                                height: netInnerHeightMm - lastBotY,
                              });
                            }
                          }

                          return (
                            <div
                              key={sd.id}
                              data-testid={`studio-subdivider-item-${i}`}
                              className="p-2.5 rounded-xl bg-amber-100/70 border border-amber-400 space-y-2 text-[11px]"
                            >
                              <div className="flex items-center justify-between gap-1">
                                <div>
                                  <span className="text-stone-900 font-bold block">
                                    Raf Arası Dikme #{i + 1}
                                  </span>
                                  <span className="text-[10px] font-mono text-stone-600">
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
                                  <span className="text-[10px] font-semibold text-stone-700 block">
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
                                          data-testid={`studio-subdivider-span-${i}-${spIdx}`}
                                          onClick={() =>
                                            setSubDividerPlacement(activeBayIndex, sd.id, {
                                              elevationY: sp.elevY,
                                              height: sp.height,
                                            })
                                          }
                                          className={`px-2 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                                            isSelected
                                              ? "bg-amber-700 text-white"
                                              : "bg-white hover:bg-stone-100 border border-stone-300 text-stone-700"
                                          }`}
                                        >
                                          {sp.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              <div className="grid grid-cols-3 gap-1">
                                <div className="bg-white px-1.5 py-1 rounded-lg border border-stone-300">
                                  <span className="text-[9px] font-semibold text-stone-500 block">
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
                                    <span className="text-[9px] text-stone-400">mm</span>
                                  </div>
                                </div>

                                <div className="bg-white px-1.5 py-1 rounded-lg border border-stone-300">
                                  <span className="text-[9px] font-semibold text-stone-500 block">
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
                                    <span className="text-[9px] text-stone-400">mm</span>
                                  </div>
                                </div>

                                <div className="bg-white px-1.5 py-1 rounded-lg border border-stone-300">
                                  <span className="text-[9px] font-semibold text-stone-500 block">
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
                                    <span className="text-[9px] text-stone-400">mm</span>
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
                                className="w-full accent-amber-700 h-1.5 bg-stone-200 rounded-lg cursor-pointer"
                              />
                            </div>
                          );
                        })}

                        {/* SHELVES */}
                        {activeBay.shelves.map((s, i) => (
                          <div
                            key={s.id}
                            data-testid={`studio-shelf-item-${i}`}
                            className="p-2 rounded-xl bg-amber-50/50 border border-amber-200/80 space-y-1.5 text-[11px]"
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-stone-800 font-bold">
                                Raf #{i + 1}
                              </span>
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-stone-500">Y:</span>
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
                                <span className="font-mono text-[10px] text-stone-500">mm</span>
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
                                    className="px-1 py-0.5 rounded bg-white border border-stone-300 text-[10px] font-semibold text-stone-700 cursor-pointer"
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
                              className="w-full accent-amber-700 h-1.5 bg-stone-200 rounded-lg cursor-pointer"
                            />
                          </div>
                        ))}

                        {/* SPECIAL FITTINGS (WORLD-BRAND ACCESSORIES) */}
                        {(activeBay.specialFittings || []).map((fit, fIdx) => (
                          <div
                            key={fit.id}
                            data-testid={`studio-fitting-item-${fIdx}`}
                            className="p-2 rounded-xl bg-emerald-50/70 border border-emerald-300 space-y-1.5 text-[11px]"
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-emerald-950 font-bold">
                                🛠️ Aksesuar #{fIdx + 1}: {fit.type}
                              </span>
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-stone-600">Y:</span>
                                <input
                                  type="number"
                                  data-testid={`studio-fitting-elev-input-${fIdx}`}
                                  min={40}
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
                                <span className="text-[9px] text-stone-500">mm</span>
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
                          </div>
                        ))}

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
                            className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-300/90 space-y-2 text-[11px]"
                          >
                            <div className="flex items-center justify-between gap-1">
                              <div>
                                <span className="text-stone-900 font-bold block">
                                  Çekmece #{i + 1} ({runnerFormula.brand})
                                </span>
                                <span
                                  data-testid={`studio-drawer-net-cut-${i}`}
                                  className="text-[10px] font-mono text-amber-900 font-bold block"
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
                                    className="px-1.5 py-0.5 rounded bg-white border border-stone-300 text-[10px] font-semibold text-stone-700 cursor-pointer"
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
                              <span className="text-[10px] font-semibold text-stone-600 block">
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
                                    className={`py-1 rounded-lg font-mono text-[10px] font-bold transition cursor-pointer ${
                                      d.height === presetH
                                        ? "bg-amber-700 text-white"
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
                                <span className="text-[10px] font-semibold text-stone-600">
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
                                <span className="text-[9px] text-stone-400">mm</span>
                              </div>

                              <div className="flex items-center justify-between bg-white px-2 py-1 rounded-lg border border-stone-300">
                                <span className="text-[10px] font-semibold text-stone-600">
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
                                <span className="text-[9px] text-stone-400">mm</span>
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
                              className="w-full accent-amber-700 h-1.5 bg-stone-200 rounded-lg cursor-pointer"
                            />

                            {/* Runner Brand & Cutting Deduction Selector */}
                            <div className="pt-1 border-t border-amber-200/80 space-y-1.5">
                              <span className="text-[10px] font-bold text-stone-700 block">
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
                                    className={`px-1.5 py-1 rounded-lg text-[9px] font-bold transition cursor-pointer ${
                                      activeRunnerId === runOpt.id
                                        ? "bg-stone-900 text-white"
                                        : "bg-white hover:bg-stone-100 border border-stone-300 text-stone-700"
                                    }`}
                                  >
                                    {runOpt.label}
                                  </button>
                                ))}
                              </div>
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-[9px] font-semibold text-stone-600">
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
                                        className={`px-1.5 py-0.5 rounded font-mono text-[9px] font-bold cursor-pointer ${
                                          activeNl === nl
                                            ? "bg-amber-700 text-white"
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
                            className="p-2 rounded-xl bg-stone-50 border border-stone-200/90 space-y-1.5 text-[11px]"
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-stone-800 font-bold">
                                Askı Borusu #{i + 1}
                              </span>
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-stone-500">Y:</span>
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
                                <span className="font-mono text-[10px] text-stone-500">mm</span>
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
                                    className="px-1 py-0.5 rounded bg-white border border-stone-300 text-[10px] font-semibold text-stone-700 cursor-pointer"
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
                              className="w-full accent-amber-700 h-1.5 bg-stone-200 rounded-lg cursor-pointer"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </V3CollapsibleSection>
              )}

              {/* 3. V4 UNIVERSAL DOOR, HANDLE, OPENING & HARDWARE SYSTEM */}
              {activeBay && (studioInspectorTab === "all" || studioInspectorTab === "door") && (
                <V3CollapsibleSection
                  title="3. Kapak, Kulp & Donanım (V4)"
                  badge={activeBay.door.doorSystemId || activeBay.door.type}
                  defaultOpen={true}
                >
                  <div className="space-y-2.5 text-xs">
                    <div>
                      <label className="text-[11px] font-bold text-stone-700 block mb-1.5">
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
                                  ? "bg-amber-700 border-amber-800 text-white shadow-xs"
                                  : "bg-stone-50 hover:bg-amber-50/70 border-stone-200 text-stone-800"
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
                              <span className="text-[10px] font-bold leading-tight">{dsItem.label}</span>
                            </button>
                          );
                        })}
                      </div>
                      <select
                        aria-label="V4 Kapak Hareket Sistemi"
                        data-testid="v4-door-system-select"
                        value={activeBay.door.doorSystemId || "hinged_single"}
                        onChange={(e) =>
                          setBayV4DoorConfig(activeBayIndex, {
                            doorSystemId: e.target.value as DoorSystemId,
                          })
                        }
                        className="w-full px-2.5 py-1.5 rounded-xl bg-stone-50 border border-stone-200 text-xs font-semibold text-stone-800 cursor-pointer"
                      >
                        {doorSystemDefinitions.map((ds) => (
                          <option key={ds.id} value={ds.id}>
                            {ds.name} {ds.verifiedForProduction ? "" : "(Önizleme)"}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-stone-700 block mb-1">
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
                            className={`py-1 px-2 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                              (activeBay.door.overlayType || "full_overlay") === ov.id
                                ? "bg-amber-700 text-white"
                                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                            }`}
                          >
                            {ov.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-stone-700 block mb-1.5">
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
                                  ? "bg-amber-700 border-amber-800 text-white shadow-xs"
                                  : "bg-stone-50 hover:bg-amber-50/70 border-stone-200 text-stone-800"
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
                              <span className="text-[10px] font-bold leading-tight">{hItem.label}</span>
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-[10px] text-amber-800 mb-1">Geometriler temsilidir. Kulp montajı ve gelişmiş kapak hareketleri teknik doğrulama bekliyor.</p>
                      <select
                        aria-label="V4 Kulp Kategorisi"
                        data-testid="v4-handle-select"
                        value={activeBay.door.handleCategory || "bar_handle"}
                        onChange={(e) =>
                          setBayV4DoorConfig(activeBayIndex, {
                            handleCategory: e.target.value as HandleCategory,
                          })
                        }
                        className="w-full px-2.5 py-1.5 rounded-xl bg-stone-50 border border-stone-200 text-xs font-semibold text-stone-800 cursor-pointer"
                      >
                        {handleProfiles.map((hp) => (
                          <option key={hp.id} value={hp.category}>
                            {hp.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-stone-700 block mb-1">
                        3. Açılma Konforu & Mekanizma
                      </label>
                      <select
                        aria-label="V4 Açılma Teknolojisi"
                        data-testid="v4-opening-select"
                        value={activeBay.door.openingTechnology || "soft_close"}
                        onChange={(e) =>
                          setBayV4DoorConfig(activeBayIndex, {
                            openingTechnology: e.target.value as OpeningTechnology,
                          })
                        }
                        className="w-full px-2.5 py-1.5 rounded-xl bg-stone-50 border border-stone-200 text-xs font-semibold text-stone-800 cursor-pointer"
                      >
                        {openingMechanisms.map((om) => (
                          <option key={om.id} value={om.id}>
                            {om.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-stone-700 block mb-1">
                        4. Üretici Donanım Profili (Blum / Hettich / Salice / Hawa)
                      </label>
                      <select
                        aria-label="V4 Üretici Donanım Seçimi"
                        data-testid="v4-hardware-sku-select"
                        value={activeBay.door.hardwareProductId || "hw_blum_71b3550"}
                        onChange={(e) =>
                          setBayV4DoorConfig(activeBayIndex, {
                            hardwareProductId: e.target.value,
                          })
                        }
                        className="w-full px-2.5 py-1.5 rounded-xl bg-amber-50/70 border border-amber-300 text-xs font-bold text-stone-900 cursor-pointer"
                      >
                        {hardwareCatalog
                          .filter(
                            (h) =>
                              h.familyId === "fam_hinge_concealed" ||
                              h.familyId === "fam_lift_system" ||
                              h.familyId === "fam_sliding_system" ||
                              h.familyId === "fam_pocket_system"
                          )
                          .map((hw) => (
                            <option key={hw.id} value={hw.id}>
                              {hw.name} [{hw.sku}]
                            </option>
                          ))}
                      </select>
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
                          className="p-2.5 rounded-xl bg-sky-50/70 border border-sky-200 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-sky-950">
                              5. Menteşe Sayısı & Kenar Aralıkları (CNC/3D/2D)
                            </span>
                            <span
                              data-testid="v4-hinge-count-badge"
                              className="px-1.5 py-0.5 rounded bg-sky-800 text-white font-mono text-[10px] font-bold"
                            >
                              {leafSpec.effectiveHingeCount} Menteşe / Kanat
                            </span>
                          </div>

                          <div className="p-1.5 rounded-lg bg-white/90 border border-sky-200 text-[9px] text-stone-700 leading-tight">
                            <span className="font-bold text-sky-900 block">
                              📐 Blum CLIP top / Hettich Sensys / DIN 68856 (System 32) Standardı:
                            </span>
                            <span>
                              ≤1000mm (≤9kg): <b>2 Ad.</b> • 1001–1600mm (≤13kg): <b>3 Ad.</b> • 1601–2200mm (≤18kg): <b>4 Ad.</b> • &gt;2200mm (&gt;18kg): <b>5 Ad.</b> (Eşit aralıklı + raf çakışma korumalı)
                            </span>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] font-semibold text-stone-600 block">
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
                                    className={`py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                                      isSel
                                        ? "bg-sky-800 text-white"
                                        : "bg-white hover:bg-sky-100 border border-sky-200 text-stone-700"
                                    }`}
                                  >
                                    {hOpt.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-1.5">
                            <div className="bg-white p-1.5 rounded-lg border border-sky-200 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] font-bold text-stone-600">
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
                                    className={`flex-1 py-0.5 rounded font-mono text-[9px] font-bold cursor-pointer ${
                                      curBotOff === presetOff
                                        ? "bg-sky-700 text-white"
                                        : "bg-stone-100 text-stone-700"
                                    }`}
                                  >
                                    {presetOff}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="bg-white p-1.5 rounded-lg border border-sky-200 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] font-bold text-stone-600">
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
                                    className={`flex-1 py-0.5 rounded font-mono text-[9px] font-bold cursor-pointer ${
                                      curTopOff === presetOff
                                        ? "bg-sky-700 text-white"
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
                            className="px-2 py-1 rounded-lg bg-white border border-sky-200 font-mono text-[10px] text-sky-950 flex items-center justify-between"
                          >
                            <span>🔩 Y: {hyList.join(" • ")} mm</span>
                            <span className="font-bold text-sky-700">ΔY: {avgPitch} mm</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </V3CollapsibleSection>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* 3. BOTTOM CONTEXTUAL BAR */}
      {mode === "studio" && (
        <footer className="h-14 bg-white text-stone-900 border-t border-stone-200 flex items-center justify-between px-5 shrink-0 z-30 shadow-2xs">
          <div className="flex items-center gap-4 text-xs text-stone-600">
            <div>
              <span className="text-stone-400 mr-1.5">Modül Ölçüsü:</span>
              <span
                data-testid="studio-footer-dimensions"
                className="font-mono font-bold text-amber-800"
              >
                {width} × {height} × {depth} mm
              </span>
            </div>
            <span className="text-stone-300">•</span>
            <div>
              <span className="text-stone-400 mr-1.5">Toplam Modül:</span>
              <span className="font-semibold text-stone-800">
                {project.modules.length} Adet
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-[10px] uppercase tracking-wider text-stone-400 font-bold block">
                KDV Dahil Toplam
              </span>
              <div className="flex items-baseline gap-1.5">
                <span
                  data-testid="studio-total-price"
                  className="text-base font-black font-mono text-stone-900"
                >
                  €
                  {pricing.totalWithVatEur.toLocaleString("tr-TR", {
                    minimumFractionDigits: 2,
                  })}
                </span>
                <span className="text-[11px] font-mono text-stone-500">
                  (
                  {pricing.totalWithVatTry.toLocaleString("tr-TR", {
                    maximumFractionDigits: 0,
                  })}{" "}
                  TL)
                </span>
              </div>
            </div>

            <V3Button
              variant="outline"
              size="md"
              onClick={() => setIsBomModalOpen(true)}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-amber-700" />
              <span>Kesim & BOM</span>
            </V3Button>

            <V3Button
              variant="primary"
              size="md"
              data-testid="studio-approve-btn"
              onClick={handleApprove}
            >
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>Üretime Onayla</span>
            </V3Button>
          </div>
        </footer>
      )}

      {mode === "plan" && (
        <footer
          data-testid="plan-contextual-bar"
          className="min-h-[76px] bg-white border-t border-stone-200 px-5 py-2.5 flex flex-wrap items-center justify-between gap-4 shrink-0 z-30 text-xs"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-1 rounded-lg bg-stone-50 border border-stone-200 shrink-0">
              <V3IsometricModuleIcon
                module={activeModule}
                size="sm"
                testId="plan-active-module-visual"
              />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
                Seçili Modül ({activeModuleIndex + 1}/{project.modules.length})
              </span>
              <span className="font-bold text-stone-900 text-sm">{activeModule.name}</span>
            </div>

            <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl border border-stone-200">
              <button
                type="button"
                onClick={() => moveActiveModule(-snapMm || -50)}
                className="p-1.5 rounded-lg hover:bg-white text-stone-700 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 font-mono text-[11px] font-bold text-stone-700">
                X: {activeModule.position.x}mm
              </span>
              <button
                type="button"
                onClick={() => moveActiveModule(snapMm || 50)}
                className="p-1.5 rounded-lg hover:bg-white text-stone-700 cursor-pointer"
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              data-testid="plan-rotate-mod-btn"
              onClick={rotateActiveModule90}
              className="px-2.5 py-2 rounded-xl bg-stone-100 hover:bg-amber-50 border border-stone-200 text-stone-800 font-semibold flex items-center gap-1 cursor-pointer"
              title="90° Köşe Dönüşü"
            >
              <RotateCw className="w-3.5 h-3.5 text-amber-700" />
              <span>{activeModule.rotation?.y || 0}°</span>
            </button>

            <button
              type="button"
              onClick={duplicateActiveModule}
              className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            {project.modules.length > 1 && (
              <button
                type="button"
                onClick={removeActiveModule}
                className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 bg-stone-50 px-3 py-1.5 rounded-xl border border-stone-200">
              <span className="text-stone-500 font-semibold">Genişlik (W):</span>
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
                className="w-20 px-2 py-1 bg-white border border-stone-300 rounded-lg font-mono font-bold text-center text-stone-900"
              />
              <div className="flex gap-1">
                {[600, 800, 1200, 1800, 2000].map((pw) => (
                  <button
                    key={pw}
                    type="button"
                    data-testid={`plan-width-preset-${pw}`}
                    onClick={() => setDimensions(pw, height, depth)}
                    className={`px-2 py-1 rounded-md font-mono text-[11px] font-semibold cursor-pointer ${
                      width === pw
                        ? "bg-amber-700 text-white"
                        : "bg-white border border-stone-200 text-stone-600 hover:bg-stone-100"
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
              className="px-3 py-2 rounded-xl bg-stone-100 hover:bg-amber-50 border border-stone-200 text-stone-800 font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-amber-700" />
              <span>+ Raf ({activeBay?.shelves.length || 0})</span>
            </button>

            <div className="flex items-center gap-1.5 bg-stone-50 px-2.5 py-1.5 rounded-xl border border-stone-200">
              {DEFAULT_MATERIALS.slice(0, 5).map((mat) => (
                <button
                  key={mat.id}
                  type="button"
                  data-testid={`plan-mat-${mat.id}`}
                  onClick={() => setMaterials(undefined, mat.id)}
                  title={mat.name}
                  className={`w-5 h-5 rounded-full border transition cursor-pointer ${
                    activeModule.carcass.doorMaterialId === mat.id
                      ? "ring-2 ring-amber-700 border-white scale-110"
                      : "border-stone-300"
                  }`}
                  style={{ backgroundColor: mat.colorHex }}
                />
              ))}
            </div>
          </div>

          <div className="text-right ml-auto">
            <span className="text-[10px] uppercase tracking-wider text-stone-400 font-bold block">
              Proje Toplamı
            </span>
            <span
              data-testid="plan-total-price"
              className="text-base font-black font-mono text-stone-900"
            >
              €
              {pricing.totalWithVatEur.toLocaleString("tr-TR", {
                minimumFractionDigits: 2,
              })}
            </span>
          </div>
        </footer>
      )}

      {/* KITCHEN & SPATIAL ENGINEERING COMPLIANCE MODAL */}
      {showRulesModal && (
        <div
          data-testid="v3-engineering-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 backdrop-blur-xs p-4"
        >
          <div className="bg-white border border-stone-200 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden text-stone-900">
            <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-700" />
                <h2 className="text-sm font-bold">
                  Mutfak & Mekân Mühendisliği Doğrulama Durumu
                </h2>
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
              {validationIssues.length > 0 && (
                <div className="space-y-1.5">
                  <div className="font-bold text-stone-700 uppercase tracking-wider text-[11px]">
                    Aktif Proje Kontrolleri ({validationIssues.length})
                  </div>
                  {validationIssues.map((iss, idx) => (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-xl border font-medium ${
                        iss.severity === "error"
                          ? "bg-red-50 border-red-200 text-red-800"
                          : iss.severity === "warning"
                          ? "bg-amber-50 border-amber-200 text-amber-800"
                          : "bg-sky-50 border-sky-200 text-sky-800"
                      }`}
                    >
                      [{iss.code}] {iss.message}
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
                          : "bg-amber-100 text-amber-800"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 backdrop-blur-xs p-4"
        >
          <div className="bg-white border border-stone-200 rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden text-stone-900">
            <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-amber-700" />
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

              <p className="text-amber-800">Katalog teknik inceleme bekliyor. Kulp geometrileri ve gelişmiş mekanizma hareketleri temsilidir; montaj/CNC onayı değildir.</p>

              {/* WP-08 & WP-08.1 Interactive Local Library Authoring & Rollback Controls */}
              <div
                data-testid="v4-library-authoring-bar"
                className="flex flex-col gap-2.5 p-3 rounded-xl bg-amber-50/70 border border-amber-200"
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
                      className="px-3 py-1 rounded-lg bg-stone-900 hover:bg-stone-800 text-white font-semibold cursor-pointer"
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
                            : "bg-amber-100 text-amber-800"
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
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-stone-200 rounded-2xl shadow-2xl max-w-5xl w-full h-[85vh] flex flex-col overflow-hidden text-stone-900"
          >
            {/* Header */}
            <div className="px-5 py-3.5 border-b border-stone-200 bg-stone-50 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-700 text-white flex items-center justify-center font-bold">
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
                        ? "bg-stone-900 text-white shadow-xs"
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
                        ? "bg-amber-700 text-white"
                        : "text-stone-600 hover:text-stone-900"
                    }`}
                  >
                    {wf.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Large 4-Column Visual Icon Grid (size="2xl" = 128x112px) */}
            <div className="flex-1 overflow-y-auto p-5 bg-[#F7F6F2]">
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
                    className="p-3 rounded-2xl bg-white hover:bg-amber-50/40 border border-stone-200/90 hover:border-amber-700 shadow-xs hover:shadow-md flex flex-col items-center text-center justify-between gap-2 transition group cursor-grab active:cursor-grabbing"
                  >
                    <div className="w-full flex items-center justify-between text-[10px] font-mono text-stone-400 px-1">
                      <span className="font-bold text-amber-800">{vt.code}</span>
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
                        className="py-1.5 px-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-[11px] font-bold cursor-pointer"
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

      <V3ProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
      />
      <BomModal isOpen={isBomModalOpen} onClose={() => setIsBomModalOpen(false)} />
    </div>
  );
};

export default V3UnifiedWorkspace;
