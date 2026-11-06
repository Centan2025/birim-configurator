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
  V3PremiumDropdown,
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
    setPlinthHeight,
    setPlinthMaterial,
    updateProjectTitle,
    setMaterials,
    setBayCount,
    setBayDoorType,
    flipActiveDoorDirection,
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
    setSelectedComponentMaterial,
    setCountertopMaterial,
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
  const [leftTab, setLeftTab] = useState<"templates" | "accessories" | "materials">("templates");
  const [leftSubCat, setLeftSubCat] = useState<string>("dolap");
  const [openRightDrawer, setOpenRightDrawer] = useState<null | "material" | "handle" | "soket" | "more_menu">(null);
  const [adjustableLegsEnabled, setAdjustableLegsEnabled] = useState<boolean>(true);
  const [studioInspectorTab, setStudioInspectorTab] = useState<"all" | "dimensions" | "interior" | "door">("dimensions");
  const [selectedV4Family, setSelectedV4Family] = useState<ModuleFamilyId>("fam_wardrobe");
  const [doorCrossSectionProfile, setDoorCrossSectionProfile] = useState<
    "flat_slab" | "shaker_frame" | "fluted_ribbed" | "bevel_45" | "custom_cad_profile"
  >("flat_slab");
  const [customCadProfileName, setCustomCadProfileName] = useState<string | null>(null);
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
    const onViewChange = (ev: Event) => {
      const detail = (ev as CustomEvent<string>).detail;
      if (detail === "2d-elevation") {
        setMode("studio");
        setStudioView("2d");
        setStudio2DMode("elevation");
      } else if (detail === "2d-section") {
        setMode("studio");
        setStudioView("2d");
        setStudio2DMode("section");
      } else if (detail === "2d-plan") {
        setMode("studio");
        setStudioView("2d");
        setStudio2DMode("plan");
      } else if (detail === "3d") {
        setMode("studio");
        setStudioView("3d");
      } else if (detail === "plan") {
        setMode("plan");
      }
    };
    const onToggleInterior = () => {
      toggleDoorOpen();
    };
    const onDeleteActive = () => {
      if (!removeSelectedInteriorComponent() && project.modules.length > 1) {
        removeActiveModule();
      }
    };
    window.addEventListener("birim:studio-view-change", onViewChange);
    window.addEventListener("birim:toggle-interior-view", onToggleInterior);
    window.addEventListener("birim:delete-active-selection", onDeleteActive);
    return () => {
      window.removeEventListener("birim:studio-view-change", onViewChange);
      window.removeEventListener("birim:toggle-interior-view", onToggleInterior);
      window.removeEventListener("birim:delete-active-selection", onDeleteActive);
    };
  }, [toggleDoorOpen, removeSelectedInteriorComponent, project.modules.length, removeActiveModule]);

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
      className="flex flex-col h-screen w-screen overflow-hidden bg-[#F5F3EE] text-stone-900 font-sans select-none"
    >
      {/* 1. DESIGN STUDIO TOP HEADER BAR (Matches Reference Design 1-to-1) */}
      {!(mode === "showroom" && zenMode) && (
        <header className="h-13 bg-[#242321] text-white border-b border-[#181715] flex items-center justify-between px-4 shrink-0 z-30 shadow-xs">
          {/* Left: BİRİM Logo | Konfigüratör | Project Breadcrumb Pill */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2.5 shrink-0">
              <V3BrandBadge subtitle="Konfigüratör" dark={true} />
            </div>

            <div className="hidden md:flex items-center gap-1.5 bg-[#312F2C] hover:bg-[#3A3835] px-3 py-1.5 rounded-full text-xs text-stone-200 border border-stone-700/70 transition">
              <svg className="w-3.5 h-3.5 text-stone-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1v-9.5z" />
              </svg>
              <span className="text-stone-500">›</span>
              <span className="text-stone-300 font-medium">Veli İstanbul Villa</span>
              <span className="text-stone-500">›</span>
              <span
                data-testid="v3-project-title"
                className="font-semibold text-white truncate max-w-[190px]"
              >
                {project.title.includes("-")
                  ? project.title.split("-")[1].trim()
                  : project.title}
              </span>
              <button
                type="button"
                onClick={() => setIsProjectModalOpen(true)}
                title="Proje Adını Düzenle / Kayıtlı Projeler"
                className="ml-1 text-stone-400 hover:text-white cursor-pointer"
              >
                ✎
              </button>
            </div>
          </div>

          {/* Center-Right: 3-Mode Pill Switcher (Tasarım | Plan (2D) | Sunum) */}
          <div className="flex items-center gap-3">
            <nav
              aria-label="Design Studio Çalışma Modu"
              data-testid="v3-mode-switcher"
              className="inline-flex items-center p-1 rounded-full bg-[#312F2C] border border-stone-700/80 text-xs"
            >
              <button
                type="button"
                data-testid="v3-mode-studio"
                onClick={() => {
                  setMode("studio");
                  setStudioView("3d");
                  setZenMode(false);
                }}
                className={`px-5 py-1.5 rounded-full font-semibold transition cursor-pointer ${
                  mode === "studio"
                    ? "bg-white text-[#1C1917] shadow-xs"
                    : "text-stone-300 hover:text-white"
                }`}
              >
                Tasarım
              </button>
              <button
                type="button"
                data-testid="v3-mode-plan"
                onClick={() => {
                  setMode("plan");
                  setZenMode(false);
                }}
                className={`px-5 py-1.5 rounded-full font-semibold transition cursor-pointer ${
                  mode === "plan"
                    ? "bg-white text-[#1C1917] shadow-xs"
                    : "text-stone-300 hover:text-white"
                }`}
              >
                Plan (2D)
              </button>
              <button
                type="button"
                data-testid="v3-mode-showroom"
                onClick={() => setMode("showroom")}
                className={`px-5 py-1.5 rounded-full font-semibold transition cursor-pointer ${
                  mode === "showroom"
                    ? "bg-white text-[#1C1917] shadow-xs"
                    : "text-stone-300 hover:text-white"
                }`}
              >
                Sunum
              </button>
            </nav>

            {/* Visible 3D / 2D Karşıdan Cephe Çizimi Switcher in Studio Mode */}
            {mode === "studio" && (
              <div
                data-testid="studio-view-switcher"
                className="inline-flex items-center p-1 rounded-full bg-[#312F2C] border border-stone-700/80 text-xs gap-0.5"
              >
                <button
                  type="button"
                  data-testid="studio-view-3d"
                  onClick={() => {
                    setStudioView("3d");
                    setCameraPreset("iso");
                  }}
                  className={`px-3.5 py-1.5 rounded-full font-semibold transition cursor-pointer ${
                    studioView === "3d"
                      ? "bg-white text-[#1C1917] shadow-xs"
                      : "text-stone-300 hover:text-white"
                  }`}
                  title="3D Perspektif Sahnesi"
                >
                  🧊 3D Sahne
                </button>
                <button
                  type="button"
                  data-testid="studio-view-2d"
                  onClick={() => {
                    setStudioView("2d");
                    setStudio2DMode("elevation");
                  }}
                  className={`px-3.5 py-1.5 rounded-full font-semibold transition cursor-pointer ${
                    studioView === "2d" && studio2DMode === "elevation"
                      ? "bg-white text-[#1C1917] shadow-xs"
                      : "text-stone-300 hover:text-white"
                  }`}
                  title="Tam Karşıdan 2D Cephe Çizimi (Raf, Çekmece, Dikme, Modül ve Pencere/Kapı Taşıma)"
                >
                  📐 2D Cephe (Çizim)
                </button>
                <button
                  type="button"
                  data-testid="studio-view-2d-section"
                  onClick={() => {
                    setStudioView("2d");
                    setStudio2DMode("section");
                  }}
                  className={`px-3 py-1.5 rounded-full font-semibold transition cursor-pointer ${
                    studioView === "2d" && studio2DMode === "section"
                      ? "bg-white text-[#1C1917] shadow-xs"
                      : "text-stone-300 hover:text-white"
                  }`}
                  title="2D Yan Kesit Çizimi"
                >
                  ✂️ 2D Kesit
                </button>
                <button
                  type="button"
                  data-testid="studio-view-2d-plan"
                  onClick={() => {
                    setStudioView("2d");
                    setStudio2DMode("plan");
                  }}
                  className={`px-3 py-1.5 rounded-full font-semibold transition cursor-pointer ${
                    studioView === "2d" && studio2DMode === "plan"
                      ? "bg-white text-[#1C1917] shadow-xs"
                      : "text-stone-300 hover:text-white"
                  }`}
                  title="2D Üst Plan Çizimi"
                >
                  🗺️ 2D Üst Plan
                </button>
                {/* Keep camera & dimension hooks for tests */}
                <button type="button" data-testid="studio-view-3d-front" className="hidden" onClick={() => { setStudioView("3d"); setCameraPreset("front"); }}>Ön</button>
                <button type="button" data-testid="studio-view-3d-side" className="hidden" onClick={() => { setStudioView("3d"); setCameraPreset("side"); }}>Yan</button>
                <button type="button" data-testid="studio-view-3d-top" className="hidden" onClick={() => { setStudioView("3d"); setCameraPreset("top"); }}>Üst</button>
                <button type="button" data-testid="studio-toggle-dimensions" className="hidden" onClick={() => setShow3DDimensions((prev) => !prev)}>Ölçü</button>
              </div>
            )}
          </div>

          {/* Right Utility Icons: Undo / Redo | Fullscreen / Camera / Rules / Profile */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              data-testid="v3-undo-btn"
              onClick={undo}
              disabled={!canUndo}
              title="Geri Al (Ctrl+Z)"
              className="p-2 rounded-lg text-stone-300 hover:text-white hover:bg-[#312F2C] disabled:opacity-35 transition cursor-pointer"
            >
              <Undo className="w-4 h-4" />
            </button>
            <button
              type="button"
              data-testid="v3-redo-btn"
              onClick={redo}
              disabled={!canRedo}
              title="İleri Al (Ctrl+Y)"
              className="p-2 rounded-lg text-stone-300 hover:text-white hover:bg-[#312F2C] disabled:opacity-35 transition cursor-pointer"
            >
              <Redo className="w-4 h-4" />
            </button>

            <div className="h-4 w-px bg-stone-700 mx-1" />

            <button
              type="button"
              data-testid="showroom-zen-toggle"
              onClick={() => {
                setMode("showroom");
                setZenMode(true);
              }}
              title="Tam Ekran Sunum"
              className="p-2 rounded-lg text-stone-300 hover:text-white hover:bg-[#312F2C] transition cursor-pointer"
            >
              <Maximize2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              data-testid="v4-header-catalog-btn"
              onClick={() => setIsVisualCatalogOpen(true)}
              title="Tam Ekran Modül Vitrinini Aç"
              className="p-2 rounded-lg text-stone-300 hover:text-white hover:bg-[#312F2C] transition cursor-pointer"
            >
              <Camera className="w-4 h-4" />
            </button>

            <button
              type="button"
              data-testid="v3-engineering-badge"
              onClick={() => setShowRulesModal(true)}
              title="Mühendislik Doğrulaması ve Yardım"
              className={`p-2 rounded-lg transition cursor-pointer relative ${
                errorIssues.length > 0
                  ? "text-amber-400 hover:bg-[#312F2C]"
                  : "text-stone-300 hover:text-white hover:bg-[#312F2C]"
              }`}
            >
              <span className="w-4 h-4 rounded-full border border-current flex items-center justify-center text-[10px] font-bold">
                ?
              </span>
            </button>

            <button
              type="button"
              data-testid="v4-library-admin-btn"
              onClick={() => setShowAdminModal(true)}
              title="Kütüphane Yönetimi & Kullanıcı Profili"
              className="ml-1 w-8 h-8 rounded-full bg-[#3A3835] hover:bg-[#4A4743] border border-stone-600 text-xs font-bold text-white flex items-center justify-center cursor-pointer"
            >
              CT
            </button>
          </div>
        </header>
      )}

            {/* Approval / Validation Notification Banner */}
      {approvalBanner && (
        <div
          className={`${
            approvalBanner.ok ? "bg-[#E5EFEA] text-[#1E3F2F]" : "bg-red-100 text-red-900"
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
              className="px-2.5 py-1 rounded-lg bg-white hover:bg-[#F5F2EB] border border-stone-200 text-stone-800 font-semibold transition cursor-pointer"
            >
              Doğrusal Mutfak (3.2m)
            </button>
            <button
              type="button"
              data-testid="plan-preset-l-kitchen"
              onClick={loadLKitchen}
              className="px-2.5 py-1 rounded-lg bg-white hover:bg-[#F5F2EB] border border-stone-200 text-stone-800 font-semibold transition cursor-pointer"
            >
              L Tipi Mutfak (90° Köşe)
            </button>
            <button
              type="button"
              data-testid="plan-preset-u-kitchen"
              onClick={loadUKitchen}
              className="px-2.5 py-1 rounded-lg bg-white hover:bg-[#F5F2EB] border border-stone-200 text-stone-800 font-semibold transition cursor-pointer"
            >
              U Tipi Mutfak (Çift Köşe)
            </button>
            <button
              type="button"
              data-testid="plan-preset-wardrobe"
              onClick={() => applyTemplate(WARDROBE_TEMPLATES[1].templateId)}
              className="px-2.5 py-1 rounded-lg bg-white hover:bg-[#F5F2EB] border border-stone-200 text-stone-800 font-semibold transition cursor-pointer"
            >
              Master Gardırop
            </button>
            <button
              type="button"
              data-testid="plan-distribute-wall-btn"
              onClick={distributeAlongWall}
              className="px-2.5 py-1 rounded-lg bg-[#F5F2EB] hover:bg-amber-100 border border-[#DED8CC] text-[#2C2A29] font-semibold transition cursor-pointer"
            >
              Duvara Eşit Dağıt
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-stone-200">
              <Magnet className="w-3.5 h-3.5 text-[#57534E]" />
              <span className="text-[11px] text-stone-600 font-medium">Snap:</span>
              {[0, 50, 100].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSnapMm(s)}
                  className={`px-2 py-0.5 rounded font-mono text-[11px] font-bold cursor-pointer ${
                    snapMm === s
                      ? "bg-[#E8E2D5] text-[#1C1917] border border-[#BFB5A2]"
                      : "text-stone-600 hover:bg-stone-100"
                  }`}
                >
                  {s === 0 ? "Kapalı" : `${s}mm`}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 font-mono text-xs text-stone-700">
              <Ruler className="w-3.5 h-3.5 text-[#57534E]" />
              <span>Duvar: {mainWall.length}mm</span>
              <span className="text-stone-300">|</span>
              <span className="text-sky-800 font-bold">Boşluk: {remainingWallMm}mm</span>
            </div>
          </div>
        </div>
      )}

      {/* 2. MAIN UNIFIED WORKSPACE STAGE (Persists WebGL Canvas without unmounting!) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* LEFT PANEL — DESIGN STUDIO: MODÜLLER | AKSESUARLAR | MALZEMELER */}
        {mode === "studio" && (
          <aside
            data-testid="studio-left-library"
            className="border-r border-[#E6E2D8] bg-[#FAF9F6] text-[#1C1917] flex flex-col z-20 shrink-0 relative"
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
                className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-stone-400/40 z-30 transition-colors"
              />
            )}

            {/* Top 3 Studio Library Tabs: Modüller | Aksesuarlar | Malzemeler */}
            <div className="p-2.5 border-b border-[#E6E2D8] bg-[#F4F2ED] flex items-center justify-between gap-1.5">
              {leftOpen && (
                <div className="grid grid-cols-3 gap-1.5 w-full">
                  <button
                    type="button"
                    data-testid="studio-tab-templates"
                    onClick={() => setLeftTab("templates")}
                    className={`py-2 px-2 rounded-xl text-[11px] font-semibold flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                      leftTab === "templates"
                        ? "bg-[#2B2927] text-white shadow-xs"
                        : "text-[#57534E] hover:bg-[#EAE6DD] hover:text-[#1C1917]"
                    }`}
                  >
                    <Package className="w-4 h-4" />
                    <span>Modüller</span>
                  </button>
                  <button
                    type="button"
                    data-testid="studio-tab-accessories"
                    onClick={() => setLeftTab("accessories")}
                    className={`py-2 px-2 rounded-xl text-[11px] font-semibold flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                      leftTab === "accessories"
                        ? "bg-[#2B2927] text-white shadow-xs"
                        : "text-[#57534E] hover:bg-[#EAE6DD] hover:text-[#1C1917]"
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Aksesuarlar</span>
                  </button>
                  <button
                    type="button"
                    data-testid="studio-tab-materials"
                    onClick={() => setLeftTab("materials")}
                    className={`py-2 px-2 rounded-xl text-[11px] font-semibold flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                      leftTab === "materials"
                        ? "bg-[#2B2927] text-white shadow-xs"
                        : "text-[#57534E] hover:bg-[#EAE6DD] hover:text-[#1C1917]"
                    }`}
                  >
                    <Palette className="w-4 h-4" />
                    <span>Malzemeler</span>
                  </button>
                </div>
              )}
              <button
                type="button"
                data-testid="studio-toggle-left"
                onClick={() => setLeftOpen(!leftOpen)}
                title={leftOpen ? "Sol Paneli Daralt" : "Sol Paneli Aç"}
                className="p-1.5 rounded-lg text-[#57534E] hover:text-[#1C1917] hover:bg-[#EAE6DD] transition cursor-pointer shrink-0"
              >
                {leftOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            </div>

            {leftOpen ? (
              leftTab === "templates" ? (
                <div className="flex-1 flex flex-col min-h-0">
                  {/* Search Input Box */}
                  <div className="px-3 py-2.5 bg-[#FAF9F6] border-b border-[#ECE8DF]">
                    <div className="relative flex items-center">
                      <svg
                        className="w-3.5 h-3.5 text-[#78716C] absolute left-3 pointer-events-none"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <circle cx="11" cy="11" r="8" />
                        <path d="M21 21l-4.35-4.35" />
                      </svg>
                      <input
                        type="text"
                        data-testid="v4-catalog-search-input"
                        value={catalogSearchQuery}
                        onChange={(e) => setCatalogSearchQuery(e.target.value)}
                        placeholder="Modül ara..."
                        className="w-full pl-8 pr-3 py-2 rounded-xl bg-white border border-[#E2DDD3] text-xs font-medium text-[#1C1917] placeholder:text-[#A8A29E] focus:outline-none focus:border-[#2B2927]"
                      />
                    </div>
                  </div>

                  {/* Split Body: Left Vertical Category Rail + Right 2-Column 3D Thumbnail Grid */}
                  <div className="flex-1 flex min-h-0">
                    {/* Vertical Category Sub-Rail */}
                    <div className="w-[136px] bg-[#F4F2ED] border-r border-[#ECE8DF] p-1.5 flex flex-col justify-between overflow-y-auto shrink-0">
                      <div className="space-y-0.5">
                        {[
                          {
                            id: "dolap",
                            label: "Dolap Modülleri",
                            fam: "fam_wardrobe" as ModuleFamilyId,
                            testId: "v4-family-chip-fam_wardrobe",
                          },
                          {
                            id: "giyinme",
                            label: "Giyinme Modülleri",
                            fam: "fam_wardrobe" as ModuleFamilyId,
                            testId: "v4-subcat-giyinme",
                          },
                          {
                            id: "cekmeceler",
                            label: "Çekmeceler",
                            fam: "fam_kitchen_base" as ModuleFamilyId,
                            testId: "v4-subcat-cekmeceler",
                          },
                          {
                            id: "acik",
                            label: "Açık Sistemler",
                            fam: "fam_wardrobe" as ModuleFamilyId,
                            testId: "v4-subcat-acik",
                          },
                          {
                            id: "kose",
                            label: "Köşe Çözümleri",
                            fam: "fam_special_corner" as ModuleFamilyId,
                            testId: "v4-family-chip-fam_special_corner",
                          },
                          {
                            id: "ust",
                            label: "Üst Modüller",
                            fam: "fam_kitchen_wall" as ModuleFamilyId,
                            testId: "v4-family-chip-fam_kitchen_wall",
                          },
                          {
                            id: "alt",
                            label: "Alt Modüller",
                            fam: "fam_kitchen_base" as ModuleFamilyId,
                            testId: "v4-family-chip-fam_kitchen_base",
                          },
                          {
                            id: "ozel",
                            label: "Özel Modül",
                            fam: "fam_kitchen_tall" as ModuleFamilyId,
                            testId: "v4-family-chip-fam_kitchen_tall",
                          },
                        ].map((cat) => {
                          const isSelected = leftSubCat === cat.id;
                          return (
                            <button
                              key={cat.id}
                              type="button"
                              data-testid={cat.testId}
                              onClick={() => {
                                setLeftSubCat(cat.id);
                                setSelectedV4Family(cat.fam);
                              }}
                              className={`w-full px-2.5 py-2 rounded-lg text-[11px] font-medium flex items-center gap-2 text-left transition cursor-pointer ${
                                isSelected
                                  ? "bg-[#2B2927] text-white font-semibold shadow-2xs"
                                  : "text-[#44403C] hover:bg-[#EAE6DD] hover:text-[#1C1917]"
                              }`}
                            >
                              <span className="w-3.5 h-3.5 rounded-xs border border-current flex items-center justify-center shrink-0 opacity-80">
                                <span className="w-1.5 h-2 border-r border-current" />
                              </span>
                              <span className="truncate leading-tight">{cat.label}</span>
                            </button>
                          );
                        })}

                        {/* Complementary chip hook for automated test compatibility */}
                        <button
                          type="button"
                          data-testid="v4-family-chip-fam_complementary"
                          onClick={() => {
                            setSelectedV4Family("fam_complementary");
                            setLeftTab("accessories");
                          }}
                          className="w-full px-2.5 py-1.5 rounded-lg text-[10px] font-medium text-[#57534E] hover:bg-[#EAE6DD] text-left truncate cursor-pointer"
                        >
                          🧩 Tamamlayıcılar
                        </button>
                      </div>

                      <div className="pt-2 border-t border-[#E2DDD3] space-y-1">
                        <button
                          type="button"
                          data-testid="v4-open-floating-catalog-btn"
                          onClick={() => setIsVisualCatalogOpen(true)}
                          className="w-full px-2.5 py-2 rounded-xl bg-white hover:bg-[#EAE6DD] border border-[#DED8CC] text-[10px] font-semibold text-[#2B2927] flex items-center gap-1.5 shadow-2xs cursor-pointer"
                        >
                          <Maximize2 className="w-3 h-3 shrink-0" />
                          <span className="truncate">Tam Katalog (92)</span>
                        </button>
                        <button
                          type="button"
                          data-testid="v3-open-projects-btn"
                          onClick={() => setIsProjectModalOpen(true)}
                          className="w-full px-2.5 py-2 rounded-xl bg-white hover:bg-[#EAE6DD] border border-[#DED8CC] text-[10px] font-semibold text-[#2B2927] flex items-center gap-1.5 shadow-2xs cursor-pointer"
                        >
                          <Box className="w-3.5 h-3.5 shrink-0 text-[#57534E]" />
                          <span className=" leading-tight">Kaydedilen Modüller</span>
                        </button>
                      </div>
                    </div>

                    {/* Right 2-Column 3D Visual Module Grid */}
                    <div className="flex-1 overflow-y-auto p-3 bg-[#FAF9F6] space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#1C1917]">
                          {leftSubCat === "dolap"
                            ? "Dolap Modülleri"
                            : leftSubCat === "giyinme"
                            ? "Giyinme Modülleri"
                            : leftSubCat === "cekmeceler"
                            ? "Çekmeceli Modüller"
                            : leftSubCat === "acik"
                            ? "Açık Sistemler"
                            : leftSubCat === "kose"
                            ? "Köşe Çözümleri"
                            : leftSubCat === "ust"
                            ? "Üst Modüller"
                            : leftSubCat === "alt"
                            ? "Alt Modüller"
                            : "Özel & Boy Modüller"}
                        </span>
                        <span className="text-[11px] text-[#78716C] font-medium">
                          {familyTemplates.length} modül
                        </span>
                      </div>

                      <div data-testid="v4- active-family-explainer" className="hidden" />

                      {/* 2-Column Visual Module Cards */}
                      <div data-testid="v4-template-list" className="grid grid-cols-2 gap-2">
                        {familyTemplates.map((vt, idx) => {
                          const isSelectedCard =
                            activeModule.templateId === vt.templateId ||
                            (idx === 1 && !activeModule.templateId);
                          const minCm = Math.max(30, Math.round((vt.defaultDimensions.width - 200) / 10));
                          const maxCm = Math.round((vt.defaultDimensions.width + 200) / 10);
                          return (
                            <div
                              key={vt.templateId}
                              draggable={true}
                              onDragStart={(e) => startModuleSilhouetteDrag(e, vt.templateId)}
                              onDragEnd={() => setActiveDraggedTemplateId(null)}
                              onClick={() => applyV4Template(vt.templateId, false)}
                              title={`${vt.name} — Seçili modüle uygula (Sürükleyerek sahneye yeni ekle)`}
                              className={`p-2 rounded-2xl border flex flex-col items-center text-center justify-between gap-1.5 transition cursor-pointer relative group ${
                                isSelectedCard
                                  ? "bg-[#F7F5F0] border-[#2B2927] ring-1 ring-[#2B2927] shadow-xs"
                                  : "bg-white hover:bg-[#F7F5F0] border-[#E6E2D8] hover:border-[#BDB6A8]"
                              }`}
                            >
                              {isSelectedCard && (
                                <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#2B2927] text-white flex items-center justify-center text-[9px] font-bold">
                                  ✓
                                </span>
                              )}

                              <button
                                type="button"
                                data-testid={`v4-append-tpl-${vt.templateId}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  dropV4TemplateWithSnap(vt.templateId);
                                }}
                                title="Yanına Yeni Modül Olarak Ekle (+)"
                                className="opacity-0 group-hover:opacity-100 absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-[#2B2927] text-white flex items-center justify-center text-xs font-bold transition cursor-pointer"
                              >
                                +
                              </button>

                              <div className="w-full py-1.5 flex items-center justify-center">
                                <V3IsometricModuleIcon
                                  template={vt}
                                  size="lg"
                                  testId={`v4-tpl-visual-${vt.templateId}`}
                                />
                              </div>

                              <div className="w-full min-w-0">
                                <div
                                  data-testid={`v4-apply-tpl-${vt.templateId}`}
                                  className="text-[11px] font-bold text-[#1C1917] truncate leading-tight"
                                >
                                  {vt.name.replace(/^V4\s+/i, "")}
                                </div>
                                <div className="text-[10px] text-[#78716C] mt-0.5">
                                  {minCm}–{maxCm} cm
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ) : leftTab === "accessories" ? (
                /* TAB 2: AKSESUARLAR (Tamamlayıcılar, Hazır Oda Şablonları, İç Aksesuarlar) */
                <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-[#1C1917]">
                      Hazır Oda & Mutfak Dizilimleri
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {WARDROBE_TEMPLATES.map((tpl) => (
                        <button
                          key={tpl.templateId}
                          type="button"
                          data-testid={`studio-tpl-${tpl.templateId}`}
                          onClick={() => applyTemplate(tpl.templateId)}
                          className="p-2 rounded-xl bg-white hover:bg-[#F4F2ED] border border-[#E6E2D8] flex flex-col items-center text-center gap-1 cursor-pointer"
                        >
                          <V3IsometricModuleIcon
                            module={tpl.createInstance(`preview_${tpl.templateId}`)}
                            size="md"
                          />
                          <span className="text-[11px] font-bold text-[#1C1917] line-clamp-1">
                            {tpl.name}
                          </span>
                        </button>
                      ))}
                      <button
                        type="button"
                        data-testid="studio-tpl-kitchen-linear"
                        onClick={loadLinearKitchen}
                        className="p-2 rounded-xl bg-white hover:bg-[#F4F2ED] border border-[#E6E2D8] flex flex-col items-center text-center gap-1 cursor-pointer"
                      >
                        <V3IsometricModuleIcon presetLayout="linear_kitchen" size="md" />
                        <span className="text-[11px] font-bold text-[#1C1917]">Doğrusal Mutfak</span>
                      </button>
                      <button
                        type="button"
                        data-testid="studio-tpl-kitchen-l"
                        onClick={loadLKitchen}
                        className="p-2 rounded-xl bg-white hover:bg-[#F4F2ED] border border-[#E6E2D8] flex flex-col items-center text-center gap-1 cursor-pointer"
                      >
                        <V3IsometricModuleIcon presetLayout="l_kitchen" size="md" />
                        <span className="text-[11px] font-bold text-[#1C1917]">L Tipi Mutfak</span>
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      <button
                        type="button"
                        data-testid="v4-smart-wall-4carcass"
                        onClick={() => applySmartWallProposal("smart_layout_4_equal", 3600)}
                        className="py-2 px-2.5 rounded-xl bg-white hover:bg-[#F4F2ED] border border-[#E6E2D8] text-[11px] font-semibold text-[#1C1917] cursor-pointer"
                      >
                        3.6m → 4 Eşit Gövde
                      </button>
                      <button
                        type="button"
                        data-testid="v4-smart-wall-mixed"
                        onClick={() => applySmartWallProposal("smart_layout_mixed_wardrobe", 3600)}
                        className="py-2 px-2.5 rounded-xl bg-white hover:bg-[#F4F2ED] border border-[#E6E2D8] text-[11px] font-semibold text-[#1C1917] cursor-pointer"
                      >
                        3.6m → Karma Dizilim
                      </button>
                    </div>
                    <button
                      type="button"
                      data-testid="v4-auto-complementary-btn"
                      onClick={autoGenerateKitchenComplementary}
                      className="w-full py-2 px-3 rounded-xl bg-[#2B2927] text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Otomatik Tezgâh / Backsplash / Yan Bitiş</span>
                    </button>
                  </div>

                  {/* Dünya Markaları İç Aksesuarlar */}
                  {activeBay && (
                    <div className="pt-3 border-t border-[#ECE8DF] space-y-2">
                      <div className="text-xs font-bold text-[#1C1917]">
                        İç Aksesuarlar (Häfele • Kesseböhmer • Servetto)
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { type: "trouser_rack", brand: "Häfele", label: "Pantolonluk" },
                          { type: "shoe_rack", brand: "Häfele", label: "Ayakkabılık" },
                          { type: "wardrobe_lift", brand: "Servetto", label: "Asansör 10kg" },
                          { type: "wire_basket", brand: "Häfele", label: "Tel Sepet" },
                          { type: "corner_lemans", brand: "Kesseböhmer", label: "LeMans II Köşe" },
                          { type: "pantry_pullout", brand: "Kesseböhmer", label: "Dispensa Kiler" },
                          { type: "waste_bin", brand: "Häfele", label: "Çöp Sistemi" },
                          { type: "spice_pullout", brand: "Kesseböhmer", label: "Dar Şişelik" },
                        ].map((acc) => (
                          <button
                            key={acc.type}
                            type="button"
                            onClick={() =>
                              addSpecialFitting(
                                activeBayIndex,
                                acc.type as import("@birim/core").SpecialFittingConfig["type"]
                              )
                            }
                            className="p-2 rounded-xl bg-white hover:bg-[#F4F2ED] border border-[#E6E2D8] text-left transition cursor-pointer"
                          >
                            <div className="text-[9px] font-bold uppercase text-[#78716C]">
                              + {acc.brand}
                            </div>
                            <div className="text-[11px] font-semibold text-[#1C1917]">
                              {acc.label}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* TAB 3: MALZEMELER (Kapak, Gövde, Neolith/Dekton/Mermer Tezgâh ve 7 Zemin) */
                <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
                  {/* ONE-CLICK BUDGET / SEGMENT SWITCHER */}
                  <div
                    data-testid="v4-segment-switcher"
                    className="p-2.5 rounded-xl bg-[#F4F2ED] border border-[#E6E2D8] space-y-1.5"
                  >
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#57534E]">
                      Hızlı Segment Dönüşümü
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { id: "economy", label: "Ekonomik", sub: "Suntalam" },
                        { id: "standard", label: "Standart", sub: "MDFLam" },
                        { id: "premium", label: "Premium", sub: "Supramat+LED" },
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
                          className="p-2 rounded-xl bg-white hover:bg-[#2B2927] hover:text-white border border-[#E2DDD3] text-[#1C1917] transition flex flex-col items-center text-center cursor-pointer"
                        >
                          <span className="text-[11px] font-bold">{seg.label}</span>
                          <span className="text-[9px] opacity-75">{seg.sub}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {selectedComponentId && (
                    <V3CollapsibleSection
                      title="🎯 Seçili Parçanın Özel Malzemesi"
                      badge={selectedComponentId}
                      defaultOpen={true}
                      testId="left-selected-component-material-sec"
                    >
                      <V3PremiumDropdown
                        label="Seçili Parça Malzemesi"
                        testId="left-selected-component-material-dropdown"
                        value={
                          activeModule.componentMaterialOverrides?.[selectedComponentId] || ""
                        }
                        options={[
                          {
                            value: "",
                            label: "Modül Varsayılan Malzemesi (Sıfırla)",
                            subLabel: "Genel gövde/kapak malzemesini kullan",
                          },
                          ...DEFAULT_MATERIALS.filter((m) => m.id !== "mat_led_warm_3000k").map(
                            (m) => ({
                              value: m.id,
                              label: m.decorCode ? `${m.name} [${m.decorCode}]` : m.name,
                              subLabel: m.brand ? `${m.brand} • ${m.category}` : m.category,
                              badge: `${m.costPerM2} ₺/m²`,
                            })
                          ),
                        ]}
                        onChange={(val) => setSelectedComponentMaterial(val || null)}
                      />
                    </V3CollapsibleSection>
                  )}

                  <V3CollapsibleSection
                    title="🪨 Tezgâh & Üst Tabla (Neolith / Dekton / Mermer)"
                    badge="Sinterlenmiş Taş"
                    defaultOpen={true}
                    testId="left-countertop-material-sec"
                  >
                    <div className="space-y-1.5">
                      {DEFAULT_MATERIALS.filter(
                        (m) =>
                          m.category === "stone" ||
                          m.id.includes("neolith") ||
                          m.id.includes("dekton") ||
                          m.id.includes("marble") ||
                          m.id.includes("belenco") ||
                          m.id.includes("cimstone")
                      ).map((mat) => (
                        <V3MaterialSwatch
                          key={mat.id}
                          id={mat.id}
                          testId={`studio-countertop-mat-${mat.id}`}
                          name={mat.decorCode ? `${mat.name} [${mat.decorCode}]` : mat.name}
                          colorHex={mat.colorHex}
                          costPerM2={mat.costPerM2}
                          category={mat.brand ? `${mat.brand} • Tezgâh` : "Tezgâh"}
                          selected={
                            (activeModule.carcass.countertopMaterialId ||
                              "mat_neolith_calacatta_luxe") === mat.id
                          }
                          onSelect={() => setCountertopMaterial(mat.id)}
                        />
                      ))}
                    </div>
                  </V3CollapsibleSection>

                  <V3CollapsibleSection
                    title="🪵 Mimari Zemin Alternatifleri (7 Zemin)"
                    badge="Parke • Mermer"
                    defaultOpen={true}
                    testId="left-floor-alternatives-sec"
                  >
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { id: "oak_parquet", label: "Doğal Meşe Parke", sub: "İskandinav Şerit" },
                        { id: "herringbone_oak", label: "Macar Balıksırtı", sub: "Chevron Meşe" },
                        { id: "walnut_parquet", label: "Amerikan Ceviz", sub: "Sıcak Ceviz" },
                        { id: "travertine", label: "Bej Traverten Taş", sub: "60×60 Doğal Taş" },
                        { id: "neolith_calacatta", label: "Neolith Calacatta", sub: "Mermer Karo" },
                        { id: "microcement", label: "Mimari Mikrobeton", sub: "İpek Mat Zemin" },
                        { id: "studio", label: "Stüdyo Sonsuz Fon", sub: "Katalog Zemini" },
                      ].map((fl) => (
                        <button
                          key={fl.id}
                          type="button"
                          data-testid={`studio-floor-style-${fl.id}`}
                          onClick={() => {
                            if (typeof window !== "undefined") {
                              window.dispatchEvent(
                                new CustomEvent("birim:set-floor-style", { detail: fl.id })
                              );
                            }
                          }}
                          className="p-2 rounded-xl bg-white hover:bg-[#F4F2ED] border border-[#E6E2D8] text-left transition cursor-pointer"
                        >
                          <div className="text-[11px] font-bold text-[#1C1917]">{fl.label}</div>
                          <div className="text-[9px] text-[#78716C] leading-tight mt-0.5">{fl.sub}</div>
                        </button>
                      ))}
                    </div>
                  </V3CollapsibleSection>

                  <V3CollapsibleSection
                    title="Kapak & Ön Cephe Malzemeleri"
                    badge="Ahşap • Lake"
                    defaultOpen={true}
                  >
                    <div className="space-y-1.5">
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
                  </V3CollapsibleSection>

                  <V3CollapsibleSection
                    title="Gövde İç Levhası"
                    badge="18mm MDFLam"
                    defaultOpen={false}
                  >
                    <div className="space-y-1.5">
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
                  </V3CollapsibleSection>
                </div>
              )
            ) : (
              <div className="flex-1 flex flex-col items-center py-4 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setLeftTab("templates");
                    setLeftOpen(true);
                  }}
                  className="w-10 h-10 rounded-xl bg-white border border-[#E6E2D8] hover:bg-[#F4F2ED] flex items-center justify-center text-[#1C1917] cursor-pointer"
                >
                  <Package className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLeftTab("materials");
                    setLeftOpen(true);
                  }}
                  className="w-10 h-10 rounded-xl bg-white border border-[#E6E2D8] hover:bg-[#F4F2ED] flex items-center justify-center text-[#1C1917] cursor-pointer"
                >
                  <Palette className="w-4 h-4" />
                </button>
              </div>
            )}
          </aside>
        )}

                {/* 2D ARCHITECTURAL PLAN / ELEVATION PANE */}
        {(mode === "plan" || (mode === "studio" && studioView === "2d")) && (
          <div
            className={`${
              mode === "plan" ? "" : "flex-1"
            } h-full relative flex flex-col shrink-0`}
            style={
              mode === "plan" ? { width: `calc(${planSplitRatioPct}% - 7px)` } : undefined
            }
          >
            {mode === "studio" && studioView === "2d" && (
              <div className="absolute left-4 top-14 z-30 flex flex-col items-center gap-1 bg-white/95 backdrop-blur-md p-1.5 rounded-2xl border border-[#E6E2D8] shadow-md text-[#2B2927] w-[62px]">
                {[
                  {
                    id: "3d",
                    label: "3D Sahne",
                    active: false,
                    onClick: () => setStudioView("3d"),
                  },
                  {
                    id: "elevation",
                    label: "2D Cephe",
                    active: studio2DMode === "elevation",
                    onClick: () => setStudio2DMode("elevation"),
                  },
                  {
                    id: "section",
                    label: "2D Kesit",
                    active: studio2DMode === "section",
                    onClick: () => setStudio2DMode("section"),
                  },
                  {
                    id: "plan",
                    label: "2D Plan",
                    active: studio2DMode === "plan",
                    onClick: () => setStudio2DMode("plan"),
                  },
                ].map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={b.onClick}
                    className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-0.5 transition cursor-pointer ${
                      b.active
                        ? "bg-[#2B2927] text-white font-bold shadow-xs"
                        : "text-[#57534E] hover:bg-[#F4F2ED] hover:text-[#1C1917] font-semibold"
                    }`}
                  >
                    <span className="text-[10px] leading-tight text-center">{b.label}</span>
                  </button>
                ))}
              </div>
            )}
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
                        ? "bg-[#E8E2D5] text-[#1C1917] border border-[#BFB5A2] shadow-xs"
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
                  className="px-2.5 py-2 rounded-xl bg-[#E8E2D5] hover:bg-[#EFECE6] text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
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
                      ? "bg-[#EAF0F6] text-[#1E3A5F] text-white ring-2 ring-sky-300"
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
                : "bg-stone-200 hover:bg-[#F5F2EB]0/80 border-stone-300"
            }`}
          >
            <div className="w-5 h-16 rounded-full bg-[#E8E2D5] text-white shadow-md flex flex-col items-center justify-center gap-0.5 pointer-events-none border border-stone-600">
              <span className="text-[10px] leading-none font-bold text-[#1C1917]">⟷</span>
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
              className="min-h-[46px] px-3 py-1.5 bg-[#E8E2D5] text-white border-b border-stone-700 flex items-center justify-between gap-2 shrink-0 z-20 flex-wrap"
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
                        ? "bg-[#E8E2D5] text-[#1C1917] border border-[#BFB5A2] shadow-xs"
                        : "bg-[#EFECE6] hover:bg-stone-700 text-stone-200"
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
                        : "bg-[#EFECE6] hover:bg-stone-700 text-stone-300"
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
                      ? "bg-[#E8E2D5] text-[#1C1917] border border-[#BFB5A2]"
                      : "bg-[#EFECE6] hover:bg-stone-700 text-stone-300"
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
                      ? "bg-[#E8E2D5] text-[#1C1917] border border-[#BFB5A2]"
                      : "bg-[#EFECE6] hover:bg-stone-700 text-stone-300"
                  }`}
                >
                  <DoorOpen className="w-3 h-3" />
                  <span>{doorOpenAngleDeg > 0 ? "Kapat" : "İçini Aç"}</span>
                </button>
              </div>
            </div>
          )}

          {/* Hidden Studio Door Toggle Hook (In Design Studio, modules are in the bottom film strip and Interior View is on the left 3D pill) */}
          {mode === "studio" && (
            <div data-testid="studio-top-module-bar" className="hidden">
              <button type="button" data-testid="studio-door-toggle" onClick={toggleDoorOpen}>
                {doorOpenAngleDeg > 0 ? "Kapakları Kapat" : "İçini Göster"}
              </button>
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
                  className="absolute inset-0 z-10 bg-[#F5F3EE] flex flex-col"
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
                    className="px-4 py-2.5 rounded-2xl bg-[#E8E2D5]/85 hover:bg-[#E8E2D5] text-white backdrop-blur-md text-xs font-semibold shadow-lg flex items-center gap-2 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-[#1C1917]" />
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
                            ? "bg-[#E8E2D5] text-white shadow-xs"
                            : "text-stone-700 hover:bg-stone-100"
                        }`}
                      >
                        <Camera className="w-3.5 h-3.5 text-[#57534E]" />
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
                          ? "bg-[#E8E2D5] text-[#1C1917] border border-[#BFB5A2]"
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
                        className="w-28 accent-[#2C2A29] h-1.5 bg-stone-200 rounded-lg cursor-pointer"
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
                        className="w-28 accent-[#2C2A29] h-1.5 bg-stone-200 rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="absolute bottom-5 left-6 right-6 z-20 flex flex-wrap items-center justify-between gap-4 pointer-events-none">
                    <div className="pointer-events-auto flex items-center gap-2 bg-white/95 backdrop-blur-md px-4 py-2 rounded-2xl border border-stone-200/90 shadow-lg overflow-x-auto max-w-full">
                      <div className="flex items-center gap-1.5 pr-2 border-r border-stone-200 text-xs font-bold text-stone-700 shrink-0">
                        <Palette className="w-3.5 h-3.5 text-[#57534E]" />
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
                                  ? "bg-[#F5F2EB] border-amber-700 text-stone-900 font-bold shadow-2xs"
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

        {/* RIGHT PANEL — DESIGN STUDIO SMART PROPERTY EDITOR */}
        {mode === "studio" && (
          <aside
            data-testid="studio-right-inspector"
            className="border-l border-[#E6E2D8] bg-[#FAF9F6] text-[#1C1917] flex flex-col z-20 shrink-0 relative"
            style={{ width: `${studioRightWidthPx}px` }}
          >
            <div
              data-testid="studio-right-resize-handle"
              title="Sağ panel genişliğini değiştirmek için sürükleyin"
              onMouseDown={(e) => {
                e.preventDefault();
                setResizingPanel("studio-right");
              }}
              className="absolute top-0 left-0 w-1.5 h-full cursor-col-resize hover:bg-stone-400/40 z-30 transition-colors"
            />

            {/* Module Title Header (Matches Design Studio Reference 1-to-1) */}
            <div className="px-4 pt-3.5 pb-2.5 bg-white border-b border-[#ECE8DF] flex items-start justify-between gap-2 relative">
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="mt-0.5 text-[#57534E] shrink-0">
                  <Box className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-[#1C1917] truncate leading-tight">
                    {activeModule.name}
                  </div>
                  <div className="text-[11px] font-mono text-[#78716C] mt-0.5">
                    MOD-{activeModule.bays.length}K-{width}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  data-testid="studio-duplicate-active-module-btn"
                  onClick={duplicateActiveModule}
                  title="Modülü Kopyala"
                  className="p-1.5 rounded-lg hover:bg-[#F4F2ED] text-[#57534E] hover:text-[#1C1917] transition cursor-pointer"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setOpenRightDrawer((prev) => (prev === "more_menu" ? null : "more_menu"))
                  }
                  title="Teknik Araçlar & Modül İşlemleri"
                  className="p-1.5 rounded-lg hover:bg-[#F4F2ED] text-[#57534E] hover:text-[#1C1917] transition cursor-pointer font-bold text-sm leading-none"
                >
                  ⋮
                </button>
              </div>

              {openRightDrawer === "more_menu" && (
                <div className="absolute right-4 top-12 w-56 bg-white rounded-2xl border border-[#E6E2D8] shadow-xl p-2 z-40 space-y-1 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setIsBomModalOpen(true);
                      setOpenRightDrawer(null);
                    }}
                    className="w-full px-3 py-2 rounded-xl hover:bg-[#F4F2ED] text-left font-semibold text-[#1C1917] flex items-center gap-2 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-[#57534E]" />
                    <span>BOM & Kesim Listesi (CNC)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowRulesModal(true);
                      setOpenRightDrawer(null);
                    }}
                    className="w-full px-3 py-2 rounded-xl hover:bg-[#F4F2ED] text-left font-semibold text-[#1C1917] flex items-center gap-2 cursor-pointer"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-[#57534E]" />
                    <span>Mühendislik Doğrulaması</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAdminModal(true);
                      setOpenRightDrawer(null);
                    }}
                    className="w-full px-3 py-2 rounded-xl hover:bg-[#F4F2ED] text-left font-semibold text-[#1C1917] flex items-center gap-2 cursor-pointer"
                  >
                    <Wrench className="w-3.5 h-3.5 text-[#57534E]" />
                    <span>V4 Kütüphane Yönetimi</span>
                  </button>
                  <div className="h-px bg-[#ECE8DF] my-1" />
                  <button
                    type="button"
                    data-testid="studio-delete-active-module-btn"
                    disabled={project.modules.length <= 1}
                    onClick={() => {
                      removeActiveModule();
                      setOpenRightDrawer(null);
                    }}
                    className="w-full px-3 py-2 rounded-xl hover:bg-red-50 disabled:opacity-40 text-left font-semibold text-red-600 flex items-center gap-2 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Bu Modülü Sil</span>
                  </button>
                </div>
              )}
            </div>

            {/* 4 SMART PROPERTY TABS: Ölçüler | Konstrüksiyon | Kapak | İç Donanım */}
            <div className="px-4 bg-white border-b border-[#ECE8DF] grid grid-cols-4 gap-1 shrink-0">
              {[
                { id: "dimensions", label: "Ölçüler" },
                { id: "all", label: "Konstrüksiyon" },
                { id: "door", label: "Kapak" },
                { id: "interior", label: "İç Donanım" },
              ].map((sec) => {
                const isAct = studioInspectorTab === sec.id;
                return (
                  <button
                    key={sec.id}
                    type="button"
                    data-testid={`studio-sec-tab-${sec.id}`}
                    onClick={() =>
                      setStudioInspectorTab(
                        sec.id as "all" | "dimensions" | "interior" | "door"
                      )
                    }
                    className={`py-2.5 px-1 text-[11px] transition cursor-pointer text-center truncate border-b-2 ${
                      isAct
                        ? "border-[#2B2927] text-[#1C1917] font-bold"
                        : "border-transparent text-[#78716C] hover:text-[#1C1917] font-medium"
                    }`}
                  >
                    {sec.label}
                  </button>
                );
              })}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Contextual Selected Part Banner (Shown whenever a single door, shelf, divider, or countertop is clicked in 3D/2D) */}
              {selectedComponentId && (
                <div
                  data-testid="studio-selected-component-card"
                  className="p-3 rounded-2xl bg-white border border-[#DED8CC] space-y-2.5 text-xs shadow-2xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-[#1C1917]">🎯 Seçili Parça Malzemesi</div>
                      <div className="text-[10px] font-mono text-[#78716C] truncate">
                        {selectedComponentId}
                      </div>
                    </div>
                    <button
                      type="button"
                      data-testid="studio-delete-selected-component-btn"
                      onClick={() => {
                        removeSelectedInteriorComponent();
                      }}
                      className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[11px] font-semibold flex items-center gap-1 shrink-0 cursor-pointer"
                      title="Seçili iç parçayı sil"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Sil</span>
                    </button>
                  </div>
                  <V3PremiumDropdown
                    label="Yalnızca Bu Parçanın Malzemesi"
                    testId="studio-selected-component-material-dropdown"
                    value={
                      activeModule.componentMaterialOverrides?.[selectedComponentId] || ""
                    }
                    placeholder="Modül Varsayılan Malzemesini Kullan"
                    options={[
                      {
                        value: "",
                        label: "Modül Varsayılan Malzemesi (Sıfırla)",
                        subLabel: "Genel kapak/gövde malzemesini miras alır",
                      },
                      ...DEFAULT_MATERIALS.filter((m) => m.id !== "mat_led_warm_3000k").map(
                        (m) => ({
                          value: m.id,
                          label: m.decorCode ? `${m.name} [${m.decorCode}]` : m.name,
                          subLabel: m.brand ? `${m.brand} • ${m.category}` : m.category,
                          badge: `${m.costPerM2} ₺/m²`,
                        })
                      ),
                    ]}
                    onChange={(val) => setSelectedComponentMaterial(val || null)}
                  />
                </div>
              )}

              {/* TAB 1: ÖLÇÜLER (Matches Design Studio Reference Image 1-to-1) */}
              {studioInspectorTab === "dimensions" && (() => {
                const activeDoorMat =
                  DEFAULT_MATERIALS.find((m) => m.id === activeModule.carcass.doorMaterialId) ||
                  DEFAULT_MATERIALS[2];
                const activePlinthMatId =
                  activeModule.componentMaterialOverrides?.__plinth__ || "mat_lacquer_sage";
                const activePlinthMat =
                  DEFAULT_MATERIALS.find((m) => m.id === activePlinthMatId) ||
                  DEFAULT_MATERIALS.find((m) => m.id === "mat_lacquer_sage") ||
                  DEFAULT_MATERIALS[5];
                const activeHandleCat = activeBay?.door?.handleCategory || "bar_handle";
                const handleDisplay =
                  activeHandleCat === "bar_handle"
                    ? { code: "K019", sub: "Mat Siyah" }
                    : activeHandleCat === "knob"
                    ? { code: "D008", sub: "Antik Bronz Düğme" }
                    : activeHandleCat === "long_profile_handle"
                    ? { code: "L100", sub: "100cm Boy Profil" }
                    : activeHandleCat === "gola_profile"
                    ? { code: "GOLA-L", sub: "Alüminyum Gola Kanal" }
                    : activeHandleCat === "j_pull"
                    ? { code: "J-PULL", sub: "45° Kendinden Kulplu" }
                    : { code: "TIP-ON", sub: "Kulpsuz Bas-Aç" };

                return (
                  <div className="space-y-4">
                    {/* 3-Column Dimension Inputs: Genişlik | Yükseklik | Derinlik */}
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        {
                          label: "Genişlik",
                          val: width,
                          min: 300,
                          max: 3600,
                          step: 50,
                          testId: "studio-width-input",
                          onChange: (v: number) => setDimensions(v, height, depth),
                        },
                        {
                          label: "Yükseklik",
                          val: height,
                          min: 400,
                          max: 2800,
                          step: 50,
                          testId: "studio-height-input",
                          onChange: (v: number) => setDimensions(width, v, depth),
                        },
                        {
                          label: "Derinlik",
                          val: depth,
                          min: 250,
                          max: 900,
                          step: 50,
                          testId: "studio-depth-input",
                          onChange: (v: number) => setDimensions(width, height, v),
                        },
                      ].map((dim) => (
                        <div key={dim.label} className="space-y-1">
                          <label className="text-[11px] font-medium text-[#57534E] block">
                            {dim.label}
                          </label>
                          <div className="flex items-center justify-between bg-white rounded-xl border border-[#E2DDD3] px-2.5 py-2 shadow-2xs">
                            <input
                              type="number"
                              data-testid={dim.testId}
                              min={dim.min}
                              max={dim.max}
                              step={dim.step}
                              value={dim.val}
                              onChange={(e) => {
                                const n = Number(e.target.value);
                                if (!Number.isNaN(n)) dim.onChange(n);
                              }}
                              className="w-11 text-xs font-bold text-[#1C1917] bg-transparent focus:outline-none"
                            />
                            <span className="text-[10px] text-[#78716C] mr-1">mm</span>
                            <div className="flex flex-col text-[8px] leading-none text-[#78716C]">
                              <button
                                type="button"
                                onClick={() => dim.onChange(Math.min(dim.max, dim.val + dim.step))}
                                className="hover:text-[#1C1917] cursor-pointer"
                              >
                                ▲
                              </button>
                              <button
                                type="button"
                                onClick={() => dim.onChange(Math.max(dim.min, dim.val - dim.step))}
                                className="hover:text-[#1C1917] cursor-pointer"
                              >
                                ▼
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Soket Yüksekliği + Ayarlı Ayak Toggle */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-[#57534E] block">
                        Soket Yüksekliği
                      </label>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 flex items-center justify-between bg-white rounded-xl border border-[#E2DDD3] px-3 py-2 shadow-2xs">
                          <input
                            type="number"
                            min={0}
                            max={200}
                            step={10}
                            value={activeModule.carcass.plinthHeight ?? 100}
                            onChange={(e) =>
                              setPlinthHeight(Math.max(0, Math.min(200, Number(e.target.value) || 0)))
                            }
                            className="w-14 text-xs font-bold text-[#1C1917] bg-transparent focus:outline-none"
                          />
                          <span className="text-[11px] text-[#78716C] mr-auto">mm</span>
                          <div className="flex flex-col text-[8px] leading-none text-[#78716C]">
                            <button
                              type="button"
                              onClick={() =>
                                setPlinthHeight(
                                  Math.min(200, (activeModule.carcass.plinthHeight ?? 100) + 10)
                                )
                              }
                              className="hover:text-[#1C1917] cursor-pointer"
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setPlinthHeight(
                                  Math.max(0, (activeModule.carcass.plinthHeight ?? 100) - 10)
                                )
                              }
                              className="hover:text-[#1C1917] cursor-pointer"
                            >
                              ▼
                            </button>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const next = !adjustableLegsEnabled;
                            setAdjustableLegsEnabled(next);
                            if (next && (activeModule.carcass.plinthHeight ?? 0) === 0) {
                              setPlinthHeight(100);
                            }
                          }}
                          className="flex items-center gap-2 shrink-0 cursor-pointer"
                        >
                          <div
                            className={`w-9 h-5 rounded-full p-0.5 transition flex items-center ${
                              adjustableLegsEnabled
                                ? "bg-[#2B2927] justify-end"
                                : "bg-[#D6D1C7] justify-start"
                            }`}
                          >
                            <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
                          </div>
                          <span className="text-xs font-medium text-[#1C1917]">Ayarlı Ayak</span>
                        </button>
                      </div>
                    </div>

                    <div className="h-px bg-[#ECE8DF]" />

                    {/* Kapak Tipi (4 Visual Line-Art Cards: Düz Kapak | Çerçeve | Fitilli | Cam + 45° Pahlı) */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#1C1917]">Kapak Tipi</span>
                        <button
                          type="button"
                          onClick={() => {
                            const nextProf =
                              doorCrossSectionProfile === "bevel_45" ? "flat_slab" : "bevel_45";
                            setDoorCrossSectionProfile(nextProf);
                            if (typeof window !== "undefined") {
                              (
                                window as unknown as { __birimDoorCrossSection?: string }
                              ).__birimDoorCrossSection = nextProf;
                            }
                            if (activeBay) {
                              setBayV4DoorConfig(activeBayIndex, {
                                softClose: activeBay.door.softClose,
                              });
                            }
                          }}
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition cursor-pointer ${
                            doorCrossSectionProfile === "bevel_45"
                              ? "bg-[#2B2927] text-white border-[#2B2927]"
                              : "bg-white text-[#57534E] border-[#E2DDD3] hover:border-[#2B2927]"
                          }`}
                        >
                          📐 45° Pahlı Kesit
                        </button>
                      </div>

                      <div className="grid grid-cols-4 gap-1.5">
                        {[
                          {
                            id: "flat_slab",
                            label: "Düz Kapak",
                            svg: (
                              <svg viewBox="0 0 36 44" className="w-8 h-10" fill="none">
                                <rect x="6" y="4" width="24" height="36" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                                <line x1="9" y1="20" x2="9" y2="25" stroke="currentColor" strokeWidth="1.6" />
                              </svg>
                            ),
                          },
                          {
                            id: "shaker_frame",
                            label: "Çerçeve",
                            svg: (
                              <svg viewBox="0 0 36 44" className="w-8 h-10" fill="none">
                                <rect x="6" y="4" width="24" height="36" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                                <rect x="10" y="8" width="16" height="28" rx="1" stroke="currentColor" strokeWidth="1.2" />
                              </svg>
                            ),
                          },
                          {
                            id: "fluted_ribbed",
                            label: "Fitilli",
                            svg: (
                              <svg viewBox="0 0 36 44" className="w-8 h-10" fill="none">
                                <rect x="6" y="4" width="24" height="36" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                                <line x1="11" y1="4" x2="11" y2="40" stroke="currentColor" strokeWidth="1.1" />
                                <line x1="15.5" y1="4" x2="15.5" y2="40" stroke="currentColor" strokeWidth="1.1" />
                                <line x1="20" y1="4" x2="20" y2="40" stroke="currentColor" strokeWidth="1.1" />
                                <line x1="24.5" y1="4" x2="24.5" y2="40" stroke="currentColor" strokeWidth="1.1" />
                              </svg>
                            ),
                          },
                          {
                            id: "glass",
                            label: "Cam",
                            svg: (
                              <svg viewBox="0 0 36 44" className="w-8 h-10" fill="none">
                                <rect x="6" y="4" width="24" height="36" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                                <rect x="9" y="7" width="18" height="30" stroke="currentColor" strokeWidth="1" />
                                <line x1="18" y1="7" x2="18" y2="37" stroke="currentColor" strokeWidth="1" />
                                <line x1="12" y1="15" x2="16" y2="11" stroke="currentColor" strokeWidth="1" />
                              </svg>
                            ),
                          },
                        ].map((card) => {
                          const isGlassMat =
                            activeModule.carcass.doorMaterialId === "mat_smoked_glass" ||
                            activeModule.carcass.doorMaterialId === "mat_bronze_mirror";
                          const isSelected =
                            card.id === "glass"
                              ? isGlassMat
                              : !isGlassMat && doorCrossSectionProfile === card.id;
                          return (
                            <button
                              key={card.id}
                              type="button"
                              onClick={() => {
                                if (card.id === "glass") {
                                  setMaterials(undefined, "mat_smoked_glass");
                                } else {
                                  if (isGlassMat) {
                                    setMaterials(undefined, "mat_veneer_oak");
                                  }
                                  const prof = card.id as
                                    | "flat_slab"
                                    | "shaker_frame"
                                    | "fluted_ribbed";
                                  setDoorCrossSectionProfile(prof);
                                  if (typeof window !== "undefined") {
                                    (
                                      window as unknown as { __birimDoorCrossSection?: string }
                                    ).__birimDoorCrossSection = prof;
                                  }
                                  if (activeBay) {
                                    setBayV4DoorConfig(activeBayIndex, {
                                      softClose: activeBay.door.softClose,
                                    });
                                  }
                                }
                              }}
                              className={`py-2.5 px-1.5 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition cursor-pointer ${
                                isSelected
                                  ? "bg-white border-2 border-[#2B2927] text-[#1C1917] shadow-xs"
                                  : "bg-white hover:bg-[#F4F2ED] border-[#E2DDD3] text-[#57534E]"
                              }`}
                            >
                              {card.svg}
                              <span className="text-[11px] font-semibold leading-tight text-center">
                                {card.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="h-px bg-[#ECE8DF]" />

                    {/* Malzeme ve Renk Drill-Down Row */}
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-[#1C1917] block">
                        Malzeme ve Renk
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setOpenRightDrawer((prev) => (prev === "material" ? null : "material"))
                        }
                        className="w-full p-2.5 rounded-2xl bg-white hover:bg-[#F7F5F0] border border-[#E2DDD3] flex items-center justify-between gap-3 transition cursor-pointer shadow-2xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-14 h-9 rounded-lg border border-stone-300/80 shrink-0 shadow-inner"
                            style={{ backgroundColor: activeDoorMat.colorHex }}
                          />
                          <div className="text-left min-w-0">
                            <div className="text-xs font-bold text-[#1C1917] truncate">
                              {activeDoorMat.name.split(" (")[0]}
                            </div>
                            <div className="text-[11px] text-[#78716C] capitalize">
                              {activeDoorMat.category === "wood"
                                ? "Veneer / Doğal Ahşap"
                                : activeDoorMat.category === "lacquer"
                                ? "Lake / Supramat"
                                : activeDoorMat.brand || activeDoorMat.category}
                            </div>
                          </div>
                        </div>
                        <ChevronRight
                          className={`w-4 h-4 text-[#78716C] transition-transform ${
                            openRightDrawer === "material" ? "rotate-90" : ""
                          }`}
                        />
                      </button>

                      {openRightDrawer === "material" && (
                        <div className="p-2.5 rounded-2xl bg-white border border-[#E2DDD3] space-y-2 max-h-60 overflow-y-auto shadow-sm">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-[#78716C]">
                            Kapak Malzemesi Seçin
                          </div>
                          {DEFAULT_MATERIALS.filter((m) => m.id !== "mat_led_warm_3000k").map(
                            (mat) => (
                              <V3MaterialSwatch
                                key={mat.id}
                                id={mat.id}
                                name={mat.name.split(" (")[0]}
                                colorHex={mat.colorHex}
                                costPerM2={mat.costPerM2}
                                category={mat.brand || mat.category}
                                selected={activeModule.carcass.doorMaterialId === mat.id}
                                onSelect={() => setMaterials(undefined, mat.id)}
                              />
                            )
                          )}
                        </div>
                      )}
                    </div>

                    {/* Kulp Drill-Down Row */}
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-[#1C1917] block">Kulp</span>
                      <button
                        type="button"
                        onClick={() =>
                          setOpenRightDrawer((prev) => (prev === "handle" ? null : "handle"))
                        }
                        className="w-full p-2.5 rounded-2xl bg-white hover:bg-[#F7F5F0] border border-[#E2DDD3] flex items-center justify-between gap-3 transition cursor-pointer shadow-2xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-14 h-9 rounded-lg bg-[#F7F5F0] border border-[#EAE6DD] flex items-center justify-center shrink-0">
                            <svg viewBox="0 0 48 24" className="w-10 h-5" fill="none">
                              <path
                                d="M8 15L38 7M12 14l2 4M34 8l2 4"
                                stroke="#1C1917"
                                strokeWidth="3"
                                strokeLinecap="round"
                              />
                            </svg>
                          </div>
                          <div className="text-left min-w-0">
                            <div className="text-xs font-bold text-[#1C1917]">
                              {handleDisplay.code}
                            </div>
                            <div className="text-[11px] text-[#78716C]">{handleDisplay.sub}</div>
                          </div>
                        </div>
                        <ChevronRight
                          className={`w-4 h-4 text-[#78716C] transition-transform ${
                            openRightDrawer === "handle" ? "rotate-90" : ""
                          }`}
                        />
                      </button>

                      {openRightDrawer === "handle" && activeBay && (
                        <div className="p-2.5 rounded-2xl bg-white border border-[#E2DDD3] grid grid-cols-2 gap-1.5 shadow-sm">
                          {[
                            { cat: "bar_handle", code: "K019", label: "Mat Siyah Çubuk" },
                            { cat: "knob", code: "D008", label: "Düğme Kulp" },
                            { cat: "long_profile_handle", code: "L100", label: "100cm Boy Profil" },
                            { cat: "gola_profile", code: "GOLA", label: "Gola Kanal Profil" },
                            { cat: "j_pull", code: "J-PULL", label: "J-Pull Kendinden" },
                            { cat: "handleless_plain", code: "TIP-ON", label: "Kulpsuz Bas-Aç" },
                          ].map((hOpt) => {
                            const isSel =
                              (activeBay.door.handleCategory || "bar_handle") === hOpt.cat;
                            return (
                              <button
                                key={hOpt.cat}
                                type="button"
                                onClick={() =>
                                  setBayV4DoorConfig(activeBayIndex, {
                                    handleCategory: hOpt.cat as HandleCategory,
                                  })
                                }
                                className={`p-2 rounded-xl border text-left transition cursor-pointer ${
                                  isSel
                                    ? "bg-[#2B2927] text-white border-[#2B2927]"
                                    : "bg-[#FAF9F6] hover:bg-[#F4F2ED] text-[#1C1917] border-[#E6E2D8]"
                                }`}
                              >
                                <div className="text-[11px] font-bold">{hOpt.code}</div>
                                <div className="text-[9px] opacity-80">{hOpt.label}</div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Soket (Baza) Drill-Down Row */}
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-[#1C1917] block">Soket</span>
                      <button
                        type="button"
                        onClick={() =>
                          setOpenRightDrawer((prev) => (prev === "soket" ? null : "soket"))
                        }
                        className="w-full p-2.5 rounded-2xl bg-white hover:bg-[#F7F5F0] border border-[#E2DDD3] flex items-center justify-between gap-3 transition cursor-pointer shadow-2xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-14 h-9 rounded-lg border border-stone-300/80 shrink-0 shadow-inner"
                            style={{ backgroundColor: activePlinthMat.colorHex }}
                          />
                          <div className="text-left min-w-0">
                            <div className="text-xs font-bold text-[#1C1917]">
                              {activePlinthMat.id === "mat_lacquer_sage"
                                ? "Lake"
                                : activePlinthMat.name.split(" (")[0]}
                            </div>
                            <div className="text-[11px] text-[#78716C]">
                              {activePlinthMat.id === "mat_lacquer_sage"
                                ? "NCS S 6020-G30Y"
                                : activePlinthMat.decorCode || activePlinthMat.brand || "Baza Yüzeyi"}
                            </div>
                          </div>
                        </div>
                        <ChevronRight
                          className={`w-4 h-4 text-[#78716C] transition-transform ${
                            openRightDrawer === "soket" ? "rotate-90" : ""
                          }`}
                        />
                      </button>

                      {openRightDrawer === "soket" && (
                        <div className="p-2.5 rounded-2xl bg-white border border-[#E2DDD3] space-y-1.5 shadow-sm">
                          {[
                            {
                              id: "mat_lacquer_sage",
                              label: "Lake Adaçayı (NCS S 6020-G30Y)",
                              hex: "#8F9779",
                            },
                            {
                              id: "mat_veneer_oak",
                              label: "Meşe Doğal (A426)",
                              hex: "#b58d59",
                            },
                            {
                              id: "mat_lacquer_cream",
                              label: "Sahra Kumu Lake (AGT-3014)",
                              hex: "#ede8d0",
                            },
                            {
                              id: "mat_melamine_anthracite",
                              label: "Antrasit Mat (D149)",
                              hex: "#374151",
                            },
                            {
                              id: "mat_melamine_white",
                              label: "Mat Beyaz (D129)",
                              hex: "#f3f4f6",
                            },
                          ].map((sk) => (
                            <button
                              key={sk.id}
                              type="button"
                              onClick={() => setPlinthMaterial(sk.id)}
                              className={`w-full p-2 rounded-xl border flex items-center gap-2.5 text-left transition cursor-pointer ${
                                activePlinthMatId === sk.id
                                  ? "bg-[#F4F2ED] border-[#2B2927] font-bold"
                                  : "bg-white hover:bg-[#FAF9F6] border-[#E6E2D8]"
                              }`}
                            >
                              <span
                                className="w-6 h-6 rounded-md border border-stone-300 shrink-0"
                                style={{ backgroundColor: sk.hex }}
                              />
                              <span className="text-xs text-[#1C1917]">{sk.label}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Hidden/Compact V4 Compatibility Card & Dimension Presets for Automated Test Hooks */}
              <div
                data-testid="v4-compatibility-card"
                className={studioInspectorTab === "all" ? "p-2.5 rounded-xl border text-xs bg-white border-[#E6E2D8]" : "hidden"}
              >
                <div className="flex items-center justify-between font-bold">
                  <span>V4 Uyumluluk: {v4CompatibilityReport.overallStatus}</span>
                  <span className="text-[10px] font-mono">
                    {v4CompatibilityReport.canApproveProduction ? "Üretime Uygun" : "Bloklu"}
                  </span>
                </div>
              </div>

              {studioInspectorTab === "all" && (
                <V3CollapsibleSection
                  title="Tezgâh (Neolith / Mermer) & Tamamlayıcı Parçalar"
                  badge={`#${activeModuleIndex + 1} Dolap`}
                  defaultOpen={true}
                >
                  <div data-testid="studio-attached-complementary-card" className="space-y-3">
                    <div className="text-[11px] font-bold text-[#57534E]">
                      🪨 Mutfak Tezgâhı & Üst Tabla (Neolith / Dekton / Mermer)
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {DEFAULT_MATERIALS.filter(
                        (m) =>
                          m.category === "stone" ||
                          m.id.includes("neolith") ||
                          m.id.includes("dekton") ||
                          m.id.includes("marble")
                      ).map((mat) => (
                        <button
                          key={mat.id}
                          type="button"
                          onClick={() => setCountertopMaterial(mat.id)}
                          className={`p-2 rounded-xl border flex items-center gap-2 text-left transition cursor-pointer ${
                            (activeModule.carcass.countertopMaterialId ||
                              "mat_neolith_calacatta_luxe") === mat.id
                              ? "bg-[#F4F2ED] border-[#2B2927] font-bold"
                              : "bg-white hover:bg-[#FAF9F6] border-[#E6E2D8]"
                          }`}
                        >
                          <span
                            className="w-5 h-5 rounded-md border border-stone-300 shrink-0"
                            style={{ backgroundColor: mat.colorHex }}
                          />
                          <span className="text-[10px] text-[#1C1917] truncate">
                            {mat.name.split(" (")[0]}
                          </span>
                        </button>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-[#ECE8DF]">
                      <div className="text-[11px] font-bold text-[#57534E] mb-1.5">
                        🧩 Seçili Dolaba Tamamlayıcı Parça Kilitli Ekle
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[
                          { id: "panel_left", short: "Sol Bitiş" },
                          { id: "panel_right", short: "Sağ Bitiş" },
                          { id: "crown_top", short: "Üst Taç" },
                          { id: "filler_left", short: "Kör Dolgu" },
                          { id: "worktop", short: "Tezgâh" },
                          { id: "backsplash", short: "Backsplash" },
                          { id: "waterfall_right", short: "Şelale Yan" },
                          { id: "plinth_front", short: "Ön Baza" },
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
                              className={`py-2 px-1.5 rounded-xl border text-[10px] font-semibold transition cursor-pointer ${
                                isAttached
                                  ? "bg-[#2B2927] text-white border-[#2B2927]"
                                  : "bg-white hover:bg-[#F4F2ED] text-[#1C1917] border-[#E6E2D8]"
                              }`}
                            >
                              {cp.short}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
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
                        className="px-2.5 py-1 rounded-lg bg-[#E8E2D5] hover:bg-[#DDD5C5] text-[#1C1917] disabled:opacity-40 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
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
                            ? "bg-[#E8E2D5] text-white shadow-xs"
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
                          className="p-2 rounded-xl bg-stone-50 hover:bg-[#F5F2EB] border border-stone-200 hover:border-amber-600 text-[10px] font-bold text-stone-800 flex flex-col items-center text-center gap-1 transition cursor-pointer"
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
                              ? "bg-[#E8E2D5] text-[#1C1917] border border-[#BFB5A2]"
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
                        className="w-full accent-[#2C2A29] h-1.5 bg-stone-200 rounded-lg cursor-pointer"
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
                        className="min-h-[42px] px-2 py-2 rounded-xl bg-stone-100 hover:bg-[#F5F2EB] border border-stone-200 text-stone-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <Layers className="w-3.5 h-3.5 text-[#57534E]" />
                        <span>+ Raf ({activeBay.shelves.length})</span>
                      </button>
                      <button
                        type="button"
                        data-testid="studio-add-subdivider-btn"
                        onClick={() => addSubDivider(activeBayIndex)}
                        className="min-h-[42px] px-2 py-2 rounded-xl bg-[#F5F2EB] hover:bg-amber-100 border border-[#DED8CC] text-stone-900 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                        title="İki raf arasına dikey ara dikme (bölücü) ekle"
                      >
                        <Columns className="w-3.5 h-3.5 text-[#57534E]" />
                        <span>+ Raf Arası Dikme ({activeBay.subDividers?.length || 0})</span>
                      </button>
                      <button
                        type="button"
                        data-testid="studio-add-drawer-btn"
                        onClick={() => addDrawer(activeBayIndex)}
                        className="min-h-[42px] px-2 py-2 rounded-xl bg-stone-100 hover:bg-[#F5F2EB] border border-stone-200 text-stone-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 text-[#57534E]" />
                        <span>+ Çekmece ({activeBay.drawers.length})</span>
                      </button>
                      <button
                        type="button"
                        data-testid="studio-add-rail-btn"
                        onClick={() => addHangingRail(activeBayIndex)}
                        className="min-h-[42px] px-2 py-2 rounded-xl bg-stone-100 hover:bg-[#F5F2EB] border border-stone-200 text-stone-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <Shirt className="w-3.5 h-3.5 text-[#57534E]" />
                        <span>+ Askı ({activeBay.hangingRails.length})</span>
                      </button>
                    </div>

                    {/* CABINET LED LIGHTING SYSTEM PICKER (HÄFELE LOOX5 3000K + 24V TRAFO & IR SENSOR) */}
                    <div
                      data-testid="studio-led-system-picker"
                      className="p-2.5 rounded-xl bg-[#F5F2EB] border border-[#DED8CC] space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#2C2A29]">
                          💡 Dolap İçi LED Aydınlatma (Häfele Loox5 3000K)
                        </span>
                        <span className="text-[9px] font-mono text-[#57534E] font-bold">
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
                            className="p-2 rounded-xl bg-white hover:bg-amber-600 hover:text-white border border-[#DED8CC] text-stone-900 flex flex-col items-center text-center transition cursor-pointer group"
                          >
                            <span className="text-[10px] font-bold">💡 + {ledOpt.label}</span>
                            <span className="text-[8px] text-stone-500 group-hover:text-[#57534E] mt-0.5">
                              {ledOpt.sub}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* WORLD-BRAND INTERIOR ACCESSORIES VISUAL PICKER */}
                    <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/90 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#2C2A29]">
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
                            className="p-1.5 rounded-xl bg-white hover:bg-[#F5F2EB] border border-stone-200/90 hover:border-amber-600/60 flex items-center gap-1.5 text-left transition cursor-pointer"
                            title={`${acc.brand} ${acc.label} [${acc.sku}] Ekle`}
                          >
                            <div className="w-7 h-7 rounded-lg bg-amber-100/70 border border-[#DED8CC] flex items-center justify-center shrink-0">
                              <svg viewBox="0 0 24 24" className="w-4 h-4 text-[#2C2A29]">
                                <rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
                                <line x1="6" y1="10" x2="18" y2="10" stroke="currentColor" strokeWidth="1.6" />
                                <line x1="6" y1="14" x2="18" y2="14" stroke="currentColor" strokeWidth="1.6" />
                              </svg>
                            </div>
                            <div className="min-w-0">
                              <span className="text-[9px] font-bold uppercase text-[#57534E] block leading-none">
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

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-stone-800">
                          🚪 Bölme {activeBayIndex + 1} Kapak Açılış Yönü
                        </span>
                        <button
                          type="button"
                          data-testid="studio-flip-door-direction-btn"
                          onClick={() => flipActiveDoorDirection(activeBayIndex)}
                          className="px-2 py-0.5 rounded-lg bg-[#F2EFE9] hover:bg-[#E6E1D6] border border-[#DED8CC] text-[#1C1917] text-[10px] font-extrabold cursor-pointer"
                          title="Kapak menteşe ve açılış yönünü (Sol ⇄ Sağ) tek tıkla çevir"
                        >
                          🔄 Yön Çevir (Sol ⇄ Sağ)
                        </button>
                      </div>
                      <div className="grid grid-cols-4 gap-1">
                        {[
                          { id: "single_left", label: "⬅️ Sol Açılır", sub: "Sol Menteşe" },
                          { id: "single_right", label: "➡️ Sağ Açılır", sub: "Sağ Menteşe" },
                          { id: "double", label: "↔️ Çift Kapak", sub: "2 Kanat" },
                          { id: "open", label: "☐ Açık", sub: "Kapaksız" },
                        ].map((dt) => (
                          <button
                            key={dt.id}
                            type="button"
                            data-testid={`studio-door-dir-${dt.id}`}
                            onClick={() =>
                              setBayDoorType(
                                activeBayIndex,
                                dt.id as "single_left" | "single_right" | "double" | "open"
                              )
                            }
                            className={`py-1.5 px-1.5 rounded-xl text-[10px] font-bold transition cursor-pointer flex flex-col items-center text-center border ${
                              activeBay.door.type === dt.id
                                ? "bg-[#E8E2D5] text-[#1C1917] border border-[#BFB5A2] border-[#1C1917] shadow-2xs"
                                : "bg-white hover:bg-[#F5F2EB] text-stone-700 border-stone-200"
                            }`}
                          >
                            <span>{dt.label}</span>
                            <span className={`text-[8px] font-normal ${activeBay.door.type === dt.id ? "text-emerald-100" : "text-stone-400"}`}>
                              {dt.sub}
                            </span>
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
                                              ? "bg-[#E8E2D5] text-[#1C1917] border border-[#BFB5A2]"
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
                                className="w-full accent-[#2C2A29] h-1.5 bg-stone-200 rounded-lg cursor-pointer"
                              />
                            </div>
                          );
                        })}

                        {/* SHELVES */}
                        {activeBay.shelves.map((s, i) => (
                          <div
                            key={s.id}
                            data-testid={`studio-shelf-item-${i}`}
                            className="p-2 rounded-xl bg-[#F5F2EB]/50 border border-[#E5E0D5]/80 space-y-1.5 text-[11px]"
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
                              className="w-full accent-[#2C2A29] h-1.5 bg-stone-200 rounded-lg cursor-pointer"
                            />
                          </div>
                        ))}

                        {/* SPECIAL FITTINGS (WORLD-BRAND ACCESSORIES & RECESSED LEDS) */}
                        {(activeBay.specialFittings || []).map((fit, fIdx) => {
                          const isLedItem = fit.type.startsWith("led_");
                          const isVertLed = fit.type === "led_vertical_strip";
                          const itemW = fit.width ?? (isVertLed ? 14 : Math.max(60, currentBayWidthMm - 12));
                          const itemD = fit.depth ?? (isVertLed ? 75 : 18);
                          return (
                            <div
                              key={fit.id}
                              data-testid={`studio-fitting-item-${fIdx}`}
                              className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-300 space-y-1.5 text-[11px]"
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-emerald-950 font-bold">
                                  {isLedItem ? "💡 Gömme LED" : "🛠️ Aksesuar"} #{fIdx + 1}: {fit.type}
                                </span>
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-stone-600">Y:</span>
                                  <input
                                    type="number"
                                    data-testid={`studio-fitting-elev-input-${fIdx}`}
                                    min={20}
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
                              {isLedItem && (
                                <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-emerald-200/80">
                                  <label className="flex items-center justify-between bg-white px-2 py-1 rounded border border-stone-200">
                                    <span className="text-[10px] font-bold text-stone-600">Genişlik(W):</span>
                                    <input
                                      type="number"
                                      min={6}
                                      max={2400}
                                      step={isVertLed ? 2 : 10}
                                      value={itemW}
                                      onChange={(e) =>
                                        setSpecialFittingPlacement(activeBayIndex, fit.id, {
                                          width: Number(e.target.value),
                                        })
                                      }
                                      className="w-14 font-mono text-xs font-bold text-stone-900 text-right"
                                    />
                                  </label>
                                  <label className="flex items-center justify-between bg-white px-2 py-1 rounded border border-stone-200">
                                    <span className="text-[10px] font-bold text-stone-600">Derinlik(D):</span>
                                    <input
                                      type="number"
                                      min={6}
                                      max={800}
                                      step={isVertLed ? 5 : 2}
                                      value={itemD}
                                      onChange={(e) =>
                                        setSpecialFittingPlacement(activeBayIndex, fit.id, {
                                          depth: Number(e.target.value),
                                        })
                                      }
                                      className="w-14 font-mono text-xs font-bold text-stone-900 text-right"
                                    />
                                  </label>
                                </div>
                              )}
                            </div>
                          );
                        })}

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
                            className="p-2.5 rounded-xl bg-[#F5F2EB] border border-[#DED8CC]/90 space-y-2 text-[11px]"
                          >
                            <div className="flex items-center justify-between gap-1">
                              <div>
                                <span className="text-stone-900 font-bold block">
                                  Çekmece #{i + 1} ({runnerFormula.brand})
                                </span>
                                <span
                                  data-testid={`studio-drawer-net-cut-${i}`}
                                  className="text-[10px] font-mono text-[#2C2A29] font-bold block"
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
                                        ? "bg-[#E8E2D5] text-[#1C1917] border border-[#BFB5A2]"
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
                              className="w-full accent-[#2C2A29] h-1.5 bg-stone-200 rounded-lg cursor-pointer"
                            />

                            {/* Runner Brand & Cutting Deduction Selector */}
                            <div className="pt-1 border-t border-[#E5E0D5]/80 space-y-1.5">
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
                                        ? "bg-[#E8E2D5] text-white"
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
                                            ? "bg-[#E8E2D5] text-[#1C1917] border border-[#BFB5A2]"
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
                              className="w-full accent-[#2C2A29] h-1.5 bg-stone-200 rounded-lg cursor-pointer"
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
                    {/* PROMINENT DOOR OPENING DIRECTION SWITCHER (SOL AÇILIR vs SAĞ AÇILIR vs ÇİFT) */}
                    <div
                      data-testid="studio-sec3-door-direction-box"
                      className="p-2.5 rounded-xl bg-[#FAF9F6] border border-[#DED8CC] space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-extrabold text-[#1C1917]">
                          🚪 Kapak Açılış Yönü (Menteşe Tarafı)
                        </span>
                        <button
                          type="button"
                          onClick={() => flipActiveDoorDirection(activeBayIndex)}
                          className="px-2 py-0.5 rounded-md bg-[#E8E2D5] hover:bg-[#DDD5C5] text-[#1C1917] text-white text-[10px] font-bold cursor-pointer"
                        >
                          🔄 Yönü Ters Çevir
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          {
                            id: "single_left",
                            title: "Sol Menteşeli (Sola Doğru Açılır, Kulp Sağda)",
                            label: "⬅️ Sola Açılır",
                            svg: (
                              <svg viewBox="0 0 28 24" className="w-6 h-5" fill="none">
                                <rect x="4" y="3" width="20" height="18" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
                                <line x1="6" y1="6" x2="6" y2="18" stroke="#5B8A72" strokeWidth="2.5" />
                                <circle cx="20" cy="12" r="1.6" fill="#D97706" />
                              </svg>
                            ),
                          },
                          {
                            id: "single_right",
                            title: "Sağ Menteşeli (Sağa Doğru Açılır, Kulp Solda)",
                            label: "➡️ Sağa Açılır",
                            svg: (
                              <svg viewBox="0 0 28 24" className="w-6 h-5" fill="none">
                                <rect x="4" y="3" width="20" height="18" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
                                <line x1="22" y1="6" x2="22" y2="18" stroke="#5B8A72" strokeWidth="2.5" />
                                <circle cx="8" cy="12" r="1.6" fill="#D97706" />
                              </svg>
                            ),
                          },
                          {
                            id: "double",
                            title: "Çift Kanatlı (Ortadan İki Yana Açılır)",
                            label: "↔️ Çift Kanat",
                            svg: (
                              <svg viewBox="0 0 28 24" className="w-6 h-5" fill="none">
                                <rect x="3" y="3" width="22" height="18" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
                                <line x1="14" y1="3" x2="14" y2="21" stroke="currentColor" strokeWidth="1.4" />
                                <circle cx="11.5" cy="12" r="1.3" fill="#D97706" />
                                <circle cx="16.5" cy="12" r="1.3" fill="#D97706" />
                              </svg>
                            ),
                          },
                        ].map((dirOpt) => {
                          const isCurrentDir =
                            dirOpt.id === "double"
                              ? activeBay.door.type === "double" || activeBay.door.type === "inset_double"
                              : dirOpt.id === "single_right"
                              ? activeBay.door.type.includes("right")
                              : activeBay.door.type.includes("left");
                          return (
                            <button
                              key={dirOpt.id}
                              type="button"
                              data-testid={`studio-sec3-dir-${dirOpt.id}`}
                              title={dirOpt.title}
                              onClick={() =>
                                setBayDoorType(
                                  activeBayIndex,
                                  dirOpt.id as "single_left" | "single_right" | "double"
                                )
                              }
                              className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 text-[10px] font-extrabold transition cursor-pointer ${
                                isCurrentDir
                                  ? "bg-[#E8E2D5] text-[#1C1917] border border-[#BFB5A2] border-[#1C1917] shadow-2xs"
                                  : "bg-white hover:bg-[#F5F2EB] text-stone-800 border-stone-200"
                              }`}
                            >
                              {dirOpt.svg}
                              <span>{dirOpt.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

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
                                  ? "bg-[#E8E2D5] border-[#1C1917] text-white shadow-xs"
                                  : "bg-stone-50 hover:bg-[#F5F2EB] border-stone-200 text-stone-800"
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
                      <V3PremiumDropdown
                        label="Kapak Hareket Sistemi"
                        testId="v4-door-system-select"
                        value={activeBay.door.doorSystemId || "hinged_single"}
                        onChange={(val) =>
                          setBayV4DoorConfig(activeBayIndex, {
                            doorSystemId: val as DoorSystemId,
                          })
                        }
                        options={doorSystemDefinitions.map((ds) => ({
                          value: ds.id,
                          label: ds.name,
                          badge: ds.verifiedForProduction ? "CNC Onaylı" : "Önizleme",
                        }))}
                      />
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
                                ? "bg-[#E8E2D5] text-[#1C1917] border border-[#BFB5A2]"
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
                                  ? "bg-[#E8E2D5] border-[#1C1917] text-white shadow-xs"
                                  : "bg-stone-50 hover:bg-[#F5F2EB] border-stone-200 text-stone-800"
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
                      <p className="text-[10px] text-[#57534E] mb-1">Geometriler temsilidir. Kulp montajı ve gelişmiş kapak hareketleri teknik doğrulama bekliyor.</p>
                      <V3PremiumDropdown
                        label="Kulp & Profil Kategorisi"
                        testId="v4-handle-select"
                        value={activeBay.door.handleCategory || "bar_handle"}
                        onChange={(val) =>
                          setBayV4DoorConfig(activeBayIndex, {
                            handleCategory: val as HandleCategory,
                          })
                        }
                        options={handleProfiles.map((hp) => ({
                          value: hp.category,
                          label: hp.name,
                        }))}
                      />
                    </div>

                    <div>
                      <V3PremiumDropdown
                        label="3. Açılma Konforu & Mekanizma"
                        testId="v4-opening-select"
                        value={activeBay.door.openingTechnology || "soft_close"}
                        onChange={(val) =>
                          setBayV4DoorConfig(activeBayIndex, {
                            openingTechnology: val as OpeningTechnology,
                          })
                        }
                        options={openingMechanisms.map((om) => ({
                          value: om.id,
                          label: om.name,
                        }))}
                      />
                    </div>

                    <div>
                      <V3PremiumDropdown
                        label="4. Üretici Donanım Profili (Blum / Hettich / Salice)"
                        testId="v4-hardware-sku-select"
                        value={activeBay.door.hardwareProductId || "hw_blum_71b3550"}
                        onChange={(val) =>
                          setBayV4DoorConfig(activeBayIndex, {
                            hardwareProductId: val,
                          })
                        }
                        options={hardwareCatalog
                          .filter(
                            (h) =>
                              h.familyId === "fam_hinge_concealed" ||
                              h.familyId === "fam_lift_system" ||
                              h.familyId === "fam_sliding_system" ||
                              h.familyId === "fam_pocket_system"
                          )
                          .map((hw) => ({
                            value: hw.id,
                            label: hw.name,
                            badge: hw.sku,
                          }))}
                      />
                    </div>

                    {/* 5. KAPAK KESİT PROFİLİ & ÖZEL CAD ÇİZİM (DXF / SVG) SİSTEMİ */}
                    <div
                      data-testid="studio-door-cross-section-picker"
                      className="p-3 rounded-xl bg-[#FAF9F6] border border-[#DED8CC] space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-extrabold text-[#1C1917]">
                          📐 5. Kapak Kesit Profili & Özel CAD Çizim (DXF/SVG)
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#EBE6DC] text-[#2C2A29] font-bold">
                          CNC Kesit
                        </span>
                      </div>

                      <V3PremiumDropdown
                        label="Aktif Kapak Kesit Profili"
                        testId="v4-door-cross-section-select"
                        value={doorCrossSectionProfile}
                        onChange={(val) => {
                          const nextProf = val as
                            | "flat_slab"
                            | "shaker_frame"
                            | "fluted_ribbed"
                            | "bevel_45"
                            | "custom_cad_profile";
                          setDoorCrossSectionProfile(nextProf);
                          if (typeof window !== "undefined") {
                            (window as unknown as { __birimDoorCrossSection?: string }).__birimDoorCrossSection = nextProf;
                          }
                          setBayV4DoorConfig(activeBayIndex, {
                            softClose: activeBay.door.softClose,
                          } as Parameters<typeof setBayV4DoorConfig>[1]);
                        }}
                        options={[
                          {
                            value: "flat_slab",
                            label: "Düz Modern Plaka Kesit (18mm/22mm)",
                            sub: "1mm ABS kenar bantlı standart düz kapak kesiti",
                            badge: "Standart",
                          },
                          {
                            value: "shaker_frame",
                            label: "5 Parçalı Çıtalı / Shaker Çerçeve Kesit",
                            sub: "65mm dış kayıt çerçevesi + 6mm çökertmeli orta göbek",
                            badge: "CNC Çerçeve",
                          },
                          {
                            value: "fluted_ribbed",
                            label: "Dikey Mikro-Çıtalı (Fluted / Derzli) Kesit",
                            sub: "36mm adımlı CNC dikey derz kanallı mimari yüzey",
                            badge: "CNC Derz",
                          },
                          {
                            value: "bevel_45",
                            label: "45° Pahlı / Kademeli Kenar Kesiti",
                            sub: "Çevre kenarları 45° CNC pah bıçağı ile işlenmiş kesit",
                            badge: "45° Pah",
                          },
                          {
                            value: "custom_cad_profile",
                            label: customCadProfileName
                              ? `Özel CAD Kesiti: ${customCadProfileName}`
                              : "Özel DXF / SVG Kapak Kesit Çizimi",
                            sub: "Dışarıdan yüklenen 2D kesit eğrisinin (Extrude/Sweep) uygulanması",
                            badge: "DXF / SVG",
                          },
                        ]}
                      />

                      {/* Live 2D Technical Cross-Section Diagram (X-Z Kesit Önizleme) */}
                      <div className="p-2.5 rounded-xl bg-white border border-[#E5E0D5] flex items-center justify-between gap-3">
                        <svg viewBox="0 0 120 44" className="w-28 h-11 shrink-0 bg-[#FAF9F6] rounded-lg border border-[#E5E0D5] p-1">
                          {doorCrossSectionProfile === "flat_slab" && (
                            <rect x="10" y="12" width="100" height="20" rx="1.5" fill="#D6CFC2" stroke="#2C2A29" strokeWidth="2" />
                          )}
                          {doorCrossSectionProfile === "shaker_frame" && (
                            <path
                              d="M10 10 H32 V18 H88 V10 H110 V32 H10 Z"
                              fill="#D6CFC2"
                              stroke="#2C2A29"
                              strokeWidth="2"
                            />
                          )}
                          {doorCrossSectionProfile === "fluted_ribbed" && (
                            <path
                              d="M10 32 V16 H20 V22 H30 V16 H40 V22 H50 V16 H60 V22 H70 V16 H80 V22 H90 V16 H100 V22 H110 V32 Z"
                              fill="#D6CFC2"
                              stroke="#2C2A29"
                              strokeWidth="1.8"
                            />
                          )}
                          {doorCrossSectionProfile === "bevel_45" && (
                            <path
                              d="M10 32 L22 12 H98 L110 32 Z"
                              fill="#D6CFC2"
                              stroke="#2C2A29"
                              strokeWidth="2"
                            />
                          )}
                          {doorCrossSectionProfile === "custom_cad_profile" && (
                            <path
                              d="M10 32 V18 L20 12 H35 V18 H85 V12 H100 L110 18 V32 Z"
                              fill="#D6CFC2"
                              stroke="#2C2A29"
                              strokeWidth="2"
                            />
                          )}
                        </svg>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="text-[10px] font-bold text-[#1C1917]">
                            2D Kesit Mantığı (Extrude & CNC Göbek)
                          </div>
                          <p className="text-[9px] text-[#57534E] leading-snug">
                            Yüklenen .dxf/.svg 2D kesit poligonu dış çerçevede (Sweep) ve orta göbekte (CNC Pocket) parametrik ölçeklenir.
                          </p>
                          <label className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#E8E2D5] hover:bg-[#DDD5C5] text-[#1C1917] text-white text-[10px] font-bold cursor-pointer">
                            <span>📂 .DXF / .SVG Kesit Yükle</span>
                            <input
                              type="file"
                              accept=".dxf,.svg,.json"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                setCustomCadProfileName(file.name);
                                setDoorCrossSectionProfile("custom_cad_profile");
                                if (typeof window !== "undefined") {
                                  (window as unknown as { __birimDoorCrossSection?: string }).__birimDoorCrossSection = "custom_cad_profile";
                                }
                                setBayV4DoorConfig(activeBayIndex, {
                                  softClose: activeBay.door.softClose,
                                } as Parameters<typeof setBayV4DoorConfig>[1]);
                              }}
                            />
                          </label>
                        </div>
                      </div>
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
                                        ? "bg-[#EAF0F6] text-[#1E3A5F] text-white"
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
                                        ? "bg-[#EAF0F6] text-[#1E3A5F] text-white"
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

      {/* 3. DESIGN STUDIO BOTTOM STATUS, MODULE STRIP & COMMERCIAL BAR */}
      {mode === "studio" && (() => {
        const mainModules = project.modules.filter((m) => m.category !== "complementary");
        const totalWidthMm = mainModules.reduce((acc, m) => acc + m.dimensions.width, 0);
        const totalVolM3 = mainModules.reduce(
          (acc, m) =>
            acc +
            (m.dimensions.width / 1000) *
              (m.dimensions.height / 1000) *
              (m.dimensions.depth / 1000),
          0
        );
        const estWeightKg = Math.max(
          18,
          Math.round(totalVolM3 * 103)
        );
        const unitPriceEur =
          mainModules.length > 0
            ? pricing.totalWithVatEur / mainModules.length
            : pricing.totalWithVatEur;

        return (
          <footer className="h-16 bg-white text-[#1C1917] border-t border-[#E6E2D8] flex items-center justify-between px-4 shrink-0 z-30 shadow-2xs gap-4">
            {/* Left: Module Count + Thumbnail Film Strip + "+ Modül Ekle" */}
            <div className="flex items-center gap-2.5 min-w-0 overflow-x-auto">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#1C1917] shrink-0 pr-1">
                <Box className="w-4 h-4 text-[#57534E]" />
                <span>{mainModules.length} Modül</span>
              </div>

              <div className="flex items-center gap-1.5">
                {project.modules.map((m, idx) => (
                  <button
                    key={m.id}
                    type="button"
                    data-testid={`studio-mod-pill-${idx}`}
                    onClick={() => setActiveModuleIndex(idx)}
                    title={`#${idx + 1} ${m.name} (${m.dimensions.width}×${m.dimensions.height}mm)`}
                    className={`h-11 px-2 rounded-xl border flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
                      activeModuleIndex === idx
                        ? "bg-[#F7F5F0] border-[#2B2927] ring-1 ring-[#2B2927]"
                        : "bg-white hover:bg-[#FAF9F6] border-[#E2DDD3]"
                    }`}
                  >
                    <V3IsometricModuleIcon module={m} size="sm" />
                    {project.modules.length > 1 && (
                      <span className="text-[10px] font-bold text-[#1C1917] max-w-[80px] truncate">
                        {idx + 1}. {m.dimensions.width}
                      </span>
                    )}
                  </button>
                ))}

                <button
                  type="button"
                  data-testid="studio-pill-add-module"
                  onClick={addAdjacentModule}
                  className="h-11 px-3 rounded-xl border border-dashed border-[#C7C1B6] hover:border-[#2B2927] hover:bg-[#FAF9F6] flex flex-col items-center justify-center text-[10px] font-semibold text-[#57534E] hover:text-[#1C1917] transition cursor-pointer shrink-0"
                  title="Yanına yeni modül ekle"
                >
                  <span className="text-sm leading-none font-normal">+</span>
                  <span>Modül Ekle</span>
                </button>
              </div>
            </div>

            {/* Center-Right: Physical Metrics (Toplam Genişlik | Hacim | Tahmini Ağırlık) + Pricing */}
            <div className="flex items-center gap-5 shrink-0 ml-auto">
              <div className="hidden lg:flex items-center gap-5 text-xs">
                <div>
                  <span className="text-[10px] text-[#78716C] block">Toplam Genişlik</span>
                  <span
                    data-testid="studio-footer-dimensions"
                    className="font-bold text-[#1C1917]"
                  >
                    {totalWidthMm} mm
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#78716C] block">Hacim</span>
                  <span className="font-bold text-[#1C1917]">
                    {totalVolM3.toLocaleString("tr-TR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    m³
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#78716C] block">Tahmini Ağırlık</span>
                  <span className="font-bold text-[#1C1917]">{estWeightKg} kg</span>
                </div>
              </div>

              <div className="h-8 w-px bg-[#ECE8DF] hidden sm:block" />

              <div className="flex items-center gap-4">
                <div className="hidden sm:block text-right">
                  <span className="text-[10px] text-[#78716C] block">Birim Fiyat</span>
                  <span className="text-xs font-bold text-[#1C1917]">
                    €{" "}
                    {unitPriceEur.toLocaleString("tr-TR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-[#78716C] font-semibold block">Toplam</span>
                  <span
                    data-testid="studio-total-price"
                    className="text-base font-black text-[#1C1917]"
                  >
                    €{" "}
                    {pricing.totalWithVatEur.toLocaleString("tr-TR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>

              {/* Right Action Buttons: ••• (BOM/CNC) | Kaydet | Teklife Ekle > */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsBomModalOpen(true)}
                  title="Kesim Listesi, BOM & CNC Paketi"
                  className="h-10 w-10 rounded-xl border border-[#E2DDD3] bg-white hover:bg-[#F4F2ED] text-[#1C1917] font-bold flex items-center justify-center transition cursor-pointer"
                >
                  •••
                </button>
                <button
                  type="button"
                  onClick={() => setIsProjectModalOpen(true)}
                  className="h-10 px-4 rounded-xl border border-[#E2DDD3] bg-white hover:bg-[#F4F2ED] text-xs font-semibold text-[#1C1917] transition cursor-pointer"
                >
                  Kaydet
                </button>
                <button
                  type="button"
                  data-testid="studio-approve-btn"
                  onClick={handleApprove}
                  className="h-10 px-5 rounded-xl bg-[#2B2927] hover:bg-[#1C1917] text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition cursor-pointer"
                >
                  <span>Teklife Ekle</span>
                  <span>›</span>
                </button>
              </div>
            </div>
          </footer>
        );
      })()}

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
              className="px-2.5 py-2 rounded-xl bg-stone-100 hover:bg-[#F5F2EB] border border-stone-200 text-stone-800 font-semibold flex items-center gap-1 cursor-pointer"
              title="90° Köşe Dönüşü"
            >
              <RotateCw className="w-3.5 h-3.5 text-[#57534E]" />
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
                        ? "bg-[#E8E2D5] text-[#1C1917] border border-[#BFB5A2]"
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
              className="px-3 py-2 rounded-xl bg-stone-100 hover:bg-[#F5F2EB] border border-stone-200 text-stone-800 font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-[#57534E]" />
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
                <ShieldCheck className="w-4 h-4 text-[#57534E]" />
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
                          ? "bg-[#F5F2EB] border-[#E5E0D5] text-[#57534E]"
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
                          : "bg-amber-100 text-[#57534E]"
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
                <Wrench className="w-4 h-4 text-[#57534E]" />
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

              <p className="text-[#57534E]">Katalog teknik inceleme bekliyor. Kulp geometrileri ve gelişmiş mekanizma hareketleri temsilidir; montaj/CNC onayı değildir.</p>

              {/* WP-08 & WP-08.1 Interactive Local Library Authoring & Rollback Controls */}
              <div
                data-testid="v4-library-authoring-bar"
                className="flex flex-col gap-2.5 p-3 rounded-xl bg-[#F5F2EB] border border-[#E5E0D5]"
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
                      className="px-3 py-1 rounded-lg bg-[#E8E2D5] hover:bg-[#EFECE6] text-white font-semibold cursor-pointer"
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
                            : "bg-amber-100 text-[#57534E]"
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
                <div className="w-8 h-8 rounded-xl bg-[#E8E2D5] text-[#1C1917] border border-[#BFB5A2] flex items-center justify-center font-bold">
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
                        ? "bg-[#E8E2D5] text-white shadow-xs"
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
                        ? "bg-[#E8E2D5] text-[#1C1917] border border-[#BFB5A2]"
                        : "text-stone-600 hover:text-stone-900"
                    }`}
                  >
                    {wf.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Large 4-Column Visual Icon Grid (size="2xl" = 128x112px) */}
            <div className="flex-1 overflow-y-auto p-5 bg-[#F5F3EE]">
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
                    className="p-3 rounded-2xl bg-white hover:bg-[#F5F2EB]/40 border border-stone-200/90 hover:border-amber-700 shadow-xs hover:shadow-md flex flex-col items-center text-center justify-between gap-2 transition group cursor-grab active:cursor-grabbing"
                  >
                    <div className="w-full flex items-center justify-between text-[10px] font-mono text-stone-400 px-1">
                      <span className="font-bold text-[#57534E]">{vt.code}</span>
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
                        className="py-1.5 px-2 rounded-xl bg-[#E8E2D5] hover:bg-[#DDD5C5] text-[#1C1917] text-white text-[11px] font-bold cursor-pointer"
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
