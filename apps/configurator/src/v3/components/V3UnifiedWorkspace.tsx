"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import {
  useV3Adapter,
  DEFAULT_MATERIALS,
  WARDROBE_TEMPLATES,
  KITCHEN_ENGINEERING_RULE_REGISTRY,
  generateModuleGeometry,
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
    applyWardrobeWizard,
    applySmartWallProposal,
    distributeAlongWall,
    autoGenerateKitchenComplementary,
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
  const [selectedV4Family, setSelectedV4Family] = useState<ModuleFamilyId>("fam_wardrobe");
  const [studioView, setStudioView] = useState<"3d" | "2d">("3d");
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
  const familyTemplates = v4ModuleTemplates.filter((t) => t.familyId === selectedV4Family);
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
        <header className="h-14 bg-white/95 backdrop-blur-md border-b border-stone-200/90 flex items-center justify-between px-4 shrink-0 z-30">
          {/* Left: Brand & Project Title */}
          <div className="flex items-center gap-3">
            <V3BrandBadge subtitle="V4.0" />
            <div className="h-4 w-px bg-stone-200 hidden sm:block" />
            <div className="hidden md:flex items-center gap-2 text-xs">
              <span
                data-testid="v3-project-title"
                className="font-bold text-stone-800 truncate max-w-[220px]"
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
              className="inline-flex items-center p-1 rounded-xl bg-stone-100 border border-stone-200/90 text-xs"
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
                    ? "bg-white text-stone-900 shadow-2xs border border-stone-200/80"
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
                    ? "bg-white text-stone-900 shadow-2xs border border-stone-200/80"
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
                    ? "bg-white text-stone-900 shadow-2xs border border-stone-200/80"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                <span>Showroom</span>
              </button>
            </nav>

            {/* Studio 3D / 2D Elevation Sub-Toggle */}
            {mode === "studio" && (
              <div className="hidden sm:inline-flex items-center p-1 rounded-xl bg-stone-100 border border-stone-200/90 text-xs">
                <button
                  type="button"
                  data-testid="studio-view-3d"
                  onClick={() => setStudioView("3d")}
                  className={`px-2.5 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                    studioView === "3d"
                      ? "bg-stone-900 text-white"
                      : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  3D
                </button>
                <button
                  type="button"
                  data-testid="studio-view-2d"
                  onClick={() => setStudioView("2d")}
                  className={`px-2.5 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                    studioView === "2d"
                      ? "bg-stone-900 text-white"
                      : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  2D Cephe
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
            className={`transition-all duration-200 border-r border-stone-200/90 bg-white flex flex-col z-20 shrink-0 ${
              leftOpen ? "w-72" : "w-14"
            }`}
          >
            <div className="h-11 border-b border-stone-200/80 flex items-center justify-between px-3">
              {leftOpen && (
                <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl w-full mr-2">
                  <button
                    type="button"
                    data-testid="studio-tab-templates"
                    onClick={() => setLeftTab("templates")}
                    className={`flex-1 py-1 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      leftTab === "templates"
                        ? "bg-white text-stone-900 shadow-2xs"
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
                        ? "bg-white text-stone-900 shadow-2xs"
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
                    <div className="space-y-2">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-stone-500 px-1">
                        Hazır Dolap Sistemleri
                      </div>
                      {WARDROBE_TEMPLATES.map((tpl) => (
                        <button
                          key={tpl.templateId}
                          type="button"
                          data-testid={`studio-tpl-${tpl.templateId}`}
                          onClick={() => applyTemplate(tpl.templateId)}
                          className="w-full text-left p-3 rounded-xl bg-stone-50 hover:bg-amber-50/60 border border-stone-200/90 hover:border-amber-700/50 transition group flex items-start gap-2.5 cursor-pointer"
                        >
                          <div className="p-1.5 rounded-lg bg-white border border-stone-200/80 shadow-2xs shrink-0 mt-0.5">
                            <V3IsometricModuleIcon
                              widthMm={tpl.defaultDimensions.width}
                              heightMm={tpl.defaultDimensions.height}
                              depthMm={tpl.defaultDimensions.depth}
                              bayCount={tpl.defaultDimensions.width >= 1600 ? 2 : 1}
                              hasDrawers={tpl.templateId.includes("master")}
                              isOpenFront={tpl.templateId.includes("walkin")}
                              size="md"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-stone-900 group-hover:text-amber-800">
                              {tpl.name}
                            </div>
                            <div className="text-[11px] text-stone-500 mt-0.5 leading-snug">
                              {tpl.description}
                            </div>
                            <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-mono text-stone-600 bg-white px-2 py-0.5 rounded border border-stone-200">
                              {tpl.defaultDimensions.width} × {tpl.defaultDimensions.height} ×{" "}
                              {tpl.defaultDimensions.depth} mm
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>

                    <div className="pt-3 border-t border-stone-200/80 space-y-2">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-stone-500 px-1">
                        Mutfak Mekân Şablonları
                      </div>
                      <button
                        type="button"
                        data-testid="studio-tpl-kitchen-linear"
                        onClick={loadLinearKitchen}
                        className="w-full text-left p-3 rounded-xl bg-stone-50 hover:bg-amber-50/60 border border-stone-200/90 hover:border-amber-700/50 transition cursor-pointer"
                      >
                        <div className="text-xs font-bold text-stone-900">
                          Doğrusal Mutfak (3.2m)
                        </div>
                        <div className="text-[11px] text-stone-500 mt-0.5">
                          Evye + Çekmeceli Modül + Boy Kiler + Üst Dolaplar
                        </div>
                      </button>
                      <button
                        type="button"
                        data-testid="studio-tpl-kitchen-l"
                        onClick={loadLKitchen}
                        className="w-full text-left p-3 rounded-xl bg-stone-50 hover:bg-amber-50/60 border border-stone-200/90 hover:border-amber-700/50 transition cursor-pointer"
                      >
                        <div className="text-xs font-bold text-stone-900">
                          L Tipi Mutfak (90° Köşe Dönüşlü)
                        </div>
                        <div className="text-[11px] text-stone-500 mt-0.5">
                          90° köşe dönüş modülü, pencere & tesisat kontrolü
                        </div>
                      </button>
                    </div>

                    {/* V4 SMART WALL LAYOUT BUILDER & COMPLEMENTARY GENERATOR */}
                    <div className="pt-3 border-t border-stone-200/80 space-y-2">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-amber-800 px-1 flex items-center gap-1">
                        <Wand2 className="w-3 h-3" />
                        <span>V4 Akıllı Duvar & Modül Dizilimi</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          data-testid="v4-smart-wall-4carcass"
                          onClick={() => applySmartWallProposal("smart_layout_4_equal", 3600)}
                          className="p-2 rounded-xl bg-amber-50/80 hover:bg-amber-100 border border-amber-300 text-left text-[11px] cursor-pointer"
                        >
                          <div className="font-bold text-stone-900">3.6m → 4 Gövde</div>
                          <div className="text-[10px] text-stone-600">Simetrik 4 Karkas</div>
                        </button>
                        <button
                          type="button"
                          data-testid="v4-smart-wall-mixed"
                          onClick={() => applySmartWallProposal("smart_layout_mixed_wardrobe", 3600)}
                          className="p-2 rounded-xl bg-amber-50/80 hover:bg-amber-100 border border-amber-300 text-left text-[11px] cursor-pointer"
                        >
                          <div className="font-bold text-stone-900">3.6m → Karma</div>
                          <div className="text-[10px] text-stone-600">Asimetrik Dizilim</div>
                        </button>
                      </div>
                      <button
                        type="button"
                        data-testid="v4-auto-complementary-btn"
                        onClick={autoGenerateKitchenComplementary}
                        className="w-full py-2 px-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3 text-amber-400" />
                        <span>Otomatik Tezgâh / Backsplash / Yan Bitiş Üret</span>
                      </button>
                    </div>

                    {/* V4 UNIVERSAL 6-FAMILY / 92-TEMPLATE CATALOG BROWSER */}
                    <div className="pt-3 border-t border-stone-200/80 space-y-2">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-stone-500 px-1">
                        V4 Evrensel Modül Kütüphanesi (92 Şablon)
                      </div>
                      <select
                        aria-label="V4 Modül Ailesi Seçin"
                        data-testid="v4-family-selector"
                        value={selectedV4Family}
                        onChange={(e) => setSelectedV4Family(e.target.value as ModuleFamilyId)}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-stone-100 border border-stone-200 text-xs font-bold text-stone-800 cursor-pointer"
                      >
                        {v4ModuleFamilies.map((fam) => (
                          <option key={fam.id} value={fam.id}>
                            {fam.name} ({fam.targetTemplateCount})
                          </option>
                        ))}
                      </select>

                      <div
                        data-testid="v4-template-list"
                        className="space-y-1.5 max-h-64 overflow-y-auto pr-0.5"
                      >
                        {familyTemplates.map((vt) => (
                          <div
                            key={vt.templateId}
                            className="p-2 rounded-xl bg-stone-50 border border-stone-200/90 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <div className="text-[11px] font-bold text-stone-900 truncate">
                                {vt.name}
                              </div>
                              <div className="text-[10px] font-mono text-stone-500">
                                {vt.defaultDimensions.width}×{vt.defaultDimensions.height}×
                                {vt.defaultDimensions.depth}mm
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                data-testid={`v4-apply-tpl-${vt.templateId}`}
                                onClick={() => applyV4Template(vt.templateId, false)}
                                className="px-2 py-1 rounded-lg bg-white hover:bg-amber-50 border border-stone-300 text-[10px] font-bold text-stone-800 cursor-pointer"
                                title="Aktif modülü bu şablonla değiştir"
                              >
                                Seç
                              </button>
                              <button
                                type="button"
                                data-testid={`v4-append-tpl-${vt.templateId}`}
                                onClick={() => applyV4Template(vt.templateId, true)}
                                className="px-2 py-1 rounded-lg bg-amber-700 hover:bg-amber-800 text-[10px] font-bold text-white cursor-pointer"
                                title="Projeye yan modül olarak ekle"
                              >
                                +Ekle
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                        Kapak / Ön Cephe PBR Malzemesi
                      </div>
                      {DEFAULT_MATERIALS.map((mat) => (
                        <V3MaterialSwatch
                          key={mat.id}
                          id={mat.id}
                          testId={`studio-door-mat-${mat.id}`}
                          name={mat.name}
                          colorHex={mat.colorHex}
                          costPerM2={mat.costPerM2}
                          category={mat.category}
                          selected={activeModule.carcass.doorMaterialId === mat.id}
                          onSelect={() => setMaterials(undefined, mat.id)}
                        />
                      ))}
                    </div>

                    <div className="pt-3 border-t border-stone-200 space-y-2">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                        Gövde İç Malzemesi
                      </div>
                      {DEFAULT_MATERIALS.slice(0, 4).map((mat) => (
                        <V3MaterialSwatch
                          key={mat.id}
                          id={mat.id}
                          testId={`studio-body-mat-${mat.id}`}
                          name={mat.name}
                          colorHex={mat.colorHex}
                          costPerM2={mat.costPerM2}
                          category={mat.category}
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
              mode === "plan" ? "w-[58%] border-r border-stone-300" : "flex-1"
            } h-full relative flex flex-col shrink-0`}
          >
            <V3CadViewport2D
              mode={mode === "plan" ? "plan" : "elevation"}
              interactivePlan={mode === "plan"}
              snapMm={snapMm}
            />

            {mode === "plan" && (
              <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-white/95 backdrop-blur-md p-1.5 rounded-xl border border-stone-200 shadow-sm flex-wrap max-w-[92%]">
                {project.modules.map((m, idx) => (
                  <button
                    key={m.id}
                    type="button"
                    data-testid={`plan-mod-tab-${idx}`}
                    onClick={() => setActiveModuleIndex(idx)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer ${
                      activeModuleIndex === idx
                        ? "bg-amber-700 text-white shadow-xs"
                        : "bg-stone-100 hover:bg-stone-200 text-stone-800"
                    }`}
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
                ))}
                <button
                  type="button"
                  data-testid="plan-add-module-btn"
                  onClick={addAdjacentModule}
                  className="px-3 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Modül Ekle
                </button>
              </div>
            )}
          </div>
        )}

        {/* PERSISTENT 3D WEBGL VIEWPORT */}
        <main
          className={`${
            mode === "studio" && studioView === "2d"
              ? "hidden"
              : mode === "plan"
              ? "w-[42%]"
              : "flex-1"
          } relative h-full flex flex-col overflow-hidden`}
        >
          <V3ThreeViewport
            theme={
              canvasTheme === "dark"
                ? "dark"
                : mode === "showroom"
                ? "showroom-neutral"
                : "warm-light"
            }
            showGrid={!(mode === "showroom" && zenMode)}
            showInCanvasHud={mode !== "showroom"}
          />

          {/* STUDIO FLOATING MODULE & DOOR PILL */}
          {mode === "studio" && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-white/95 backdrop-blur-md px-3 py-2 rounded-2xl border border-stone-200/90 shadow-lg max-w-[95%] overflow-x-auto">
              <div className="flex items-center gap-1.5 pr-2 border-r border-stone-200">
                {project.modules.map((m, idx) => (
                  <button
                    key={m.id}
                    type="button"
                    data-testid={`studio-mod-pill-${idx}`}
                    onClick={() => setActiveModuleIndex(idx)}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition shrink-0 cursor-pointer ${
                      activeModuleIndex === idx
                        ? "bg-stone-900 text-white shadow-xs"
                        : "bg-stone-100 hover:bg-stone-200 text-stone-800"
                    }`}
                  >
                    <V3IsometricModuleIcon module={m} size="sm" />
                    <div className="text-left leading-tight">
                      <div className="font-bold">{m.name}</div>
                      <div
                        className={`text-[10px] font-mono ${
                          activeModuleIndex === idx ? "text-amber-300" : "text-stone-500"
                        }`}
                      >
                        {m.dimensions.width}×{m.dimensions.height}×{m.dimensions.depth}
                      </div>
                    </div>
                  </button>
                ))}
                <button
                  type="button"
                  data-testid="studio-pill-add-module"
                  onClick={addAdjacentModule}
                  className="px-2.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                  title="Yanına Yeni Modül Ekle"
                >
                  <Plus className="w-3.5 h-3.5 text-amber-700" />
                  <span>+ Modül</span>
                </button>
              </div>
              <button
                type="button"
                data-testid="studio-door-toggle"
                onClick={toggleDoorOpen}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  doorOpenAngleDeg > 0
                    ? "bg-amber-700 text-white"
                    : "bg-stone-100 hover:bg-stone-200 text-stone-800"
                }`}
              >
                <DoorOpen className="w-3.5 h-3.5" />
                <span>{doorOpenAngleDeg > 0 ? "Kapakları Kapat" : "İçini Göster"}</span>
              </button>
            </div>
          )}

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

        {/* CONTEXTUAL RIGHT PROPERTY INSPECTOR */}
        {mode === "studio" && (
          <aside
            data-testid="studio-right-inspector"
            className="border-l border-stone-200/90 bg-white flex flex-col z-20 shrink-0"
            style={{ width: "356px" }}
          >
            <div className="h-11 border-b border-stone-200/80 px-4 flex items-center justify-between bg-stone-50/70">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-700" />
                <span className="text-xs font-bold uppercase tracking-wider text-stone-800 truncate">
                  {activeModule.name}
                </span>
              </div>
              <span className="text-[11px] font-mono text-stone-500">
                {width}×{height}×{depth}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
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
                    <div className="flex flex-wrap gap-1">
                      {wardrobeWizards.map((wiz) => (
                        <button
                          key={wiz.id}
                          type="button"
                          data-testid={`v4-wizard-${wiz.id}`}
                          onClick={() => applyWardrobeWizard(wiz.id)}
                          className="px-2 py-1 rounded-lg bg-stone-100 hover:bg-amber-50 border border-stone-200 text-[10px] font-semibold text-stone-700 cursor-pointer"
                        >
                          {wiz.name}
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
                      activeBay.hangingRails.length > 0) && (
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

                        {/* DRAWERS */}
                        {activeBay.drawers.map((d, i) => (
                          <div
                            key={d.id}
                            data-testid={`studio-drawer-item-${i}`}
                            className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-300/90 space-y-2 text-[11px]"
                          >
                            <div className="flex items-center justify-between gap-1">
                              <div>
                                <span className="text-stone-900 font-bold block">
                                  Çekmece #{i + 1} Ölçüleri
                                </span>
                                <span className="text-[10px] font-mono text-stone-600">
                                  Genişlik (W): {currentBayWidthMm - 4}mm • Derinlik (D):{" "}
                                  {Math.min(500, depth - 70)}mm
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
                          </div>
                        ))}

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

              {/* 3. V4 UNIVERSAL DOOR, HANDLE, OPENING & HARDWARE SYSTEM */}
              {activeBay && (
                <V3CollapsibleSection
                  title="3. Kapak, Kulp & Donanım (V4)"
                  badge={activeBay.door.doorSystemId || activeBay.door.type}
                  defaultOpen={true}
                >
                  <div className="space-y-2.5 text-xs">
                    <div>
                      <label className="text-[11px] font-bold text-stone-700 block mb-1">
                        1. Kapak Hareket Sistemi (12 Kategori)
                      </label>
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
                      <label className="text-[11px] font-bold text-stone-700 block mb-1">
                        2. Kulp & Profil Sistemi (10 Kategori)
                      </label>
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
                  </div>
                </V3CollapsibleSection>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* 3. BOTTOM CONTEXTUAL BAR */}
      {mode === "studio" && (
        <footer className="h-14 bg-white border-t border-stone-200/90 flex items-center justify-between px-5 shrink-0 z-30">
          <div className="flex items-center gap-4 text-xs text-stone-600">
            <div>
              <span className="text-stone-400 mr-1.5">Modül Ölçüsü:</span>
              <span
                data-testid="studio-footer-dimensions"
                className="font-mono font-bold text-stone-900"
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

              <div className="space-y-1.5">
                {adminRecords.slice(0, 25).map((rec) => (
                  <div
                    key={rec.id}
                    className="flex items-center justify-between p-2 rounded-xl bg-stone-50 border border-stone-200"
                  >
                    <div>
                      <span className="font-bold text-stone-900">{rec.name}</span>
                      <span className="ml-2 text-[10px] font-mono text-stone-500">
                        [{rec.entityType} • v{rec.semver}]
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        rec.lifecycleState === "PUBLISHED"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {rec.lifecycleState}
                    </span>
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
