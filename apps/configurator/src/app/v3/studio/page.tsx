"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import {
  useV3Adapter,
  DEFAULT_MATERIALS,
  WARDROBE_TEMPLATES,
} from "../../../v3/adapter/useV3Adapter";
import {
  V3BrandBadge,
  V3PrototypeSwitcher,
  V3Button,
  V3DimensionControl,
  V3MaterialSwatch,
  V3CollapsibleSection,
  V3AlertBanner,
} from "../../../v3/design-system";
import { V3CadViewport2D } from "../../../v3/components/V3CadViewport2D";
import { V3ProjectModal } from "../../../v3/components/V3ProjectModal";
import BomModal from "../../../components/BomModal";
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
  LayoutGrid,
  Shirt,
} from "lucide-react";

const V3ThreeViewport = dynamic(
  () => import("../../../v3/components/V3ThreeViewport"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-[#F4F2EC] text-stone-500 text-xs font-medium">
        3D Tasarım Sahnesi Hazırlanıyor...
      </div>
    ),
  }
);

export default function V3StudioPage() {
  const {
    project,
    activeModule,
    activeModuleIndex,
    setActiveModuleIndex,
    activeBay,
    activeBayIndex,
    setActiveBayIndex,
    doorOpenAngleDeg,
    toggleDoorOpen,
    pricing,
    canUndo,
    canRedo,
    undo,
    redo,
    setDimensions,
    setMaterials,
    setBayCount,
    setBayDoorType,
    addShelf,
    removeShelf,
    addDrawer,
    removeDrawer,
    addHangingRail,
    removeHangingRail,
    addAdjacentModule,
    applyTemplate,
    loadLinearKitchen,
    applySmartSpan,
    approveProduction,
    resetToDefault,
  } = useV3Adapter();

  const [leftOpen, setLeftOpen] = useState(true);
  const [leftSection, setLeftSection] = useState<"templates" | "materials">("templates");
  const [canvasView, setCanvasView] = useState<"3d" | "2d">("3d");
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isBomModalOpen, setIsBomModalOpen] = useState(false);
  const [approvalBanner, setApprovalBanner] = useState<string | null>(null);

  if (!activeModule) {
    return (
      <div
        data-testid="v3-studio-root"
        className="flex flex-col items-center justify-center h-screen w-screen bg-[#F5F3EE] text-[#141413] p-6"
      >
        <div className="max-w-md w-full bg-white border border-[#E4DFD5] rounded-2xl p-8 text-center shadow-sm space-y-4">
          <V3BrandBadge subtitle="STUDIO" />
          <h1 className="text-lg font-bold">Sahnede henüz bir modül yok</h1>
          <p className="text-xs text-[#57534E] leading-relaxed">
            Yeni bir Birim gardırop şablonu ile hemen başlayabilir veya son işleminizi geri alabilirsiniz.
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            {canUndo && (
              <V3Button variant="outline" onClick={undo}>
                Geri Al
              </V3Button>
            )}
            <V3Button variant="primary" onClick={resetToDefault}>
              Standart Gardırop Ekle
            </V3Button>
          </div>
        </div>
      </div>
    );
  }
  const { width, height, depth } = activeModule.dimensions;

  const handleApprove = () => {
    const res = approveProduction();
    setApprovalBanner(res.message);
    setTimeout(() => setApprovalBanner(null), 4000);
  };

  return (
    <div
      data-testid="v3-studio-root"
      className="flex flex-col h-screen w-screen overflow-hidden bg-[#F7F6F2] text-stone-900 font-sans select-none"
    >
      {/* 1. MINIMAL TOP COMMAND BAR */}
      <header className="h-14 bg-white/95 backdrop-blur-md border-b border-stone-200/90 flex items-center justify-between px-4 shrink-0 z-30">
        <div className="flex items-center gap-4">
          <V3BrandBadge subtitle="STUDIO" />
          <div className="h-4 w-px bg-stone-200 hidden sm:block" />
          <div className="hidden md:flex items-center gap-2 text-xs">
            <span className="font-semibold text-stone-800" data-testid="studio-project-title">
              {project.title}
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
              Canlı Model
            </span>
          </div>
        </div>

        {/* Center: Unified Single View Selector + Prototype Switcher */}
        <div className="flex items-center gap-3">
          {/* Unified View Selector */}
          <div
            data-testid="studio-view-selector"
            className="inline-flex items-center p-1 rounded-xl bg-stone-100 border border-stone-200/90 text-xs"
          >
            <button
              type="button"
              data-testid="studio-view-3d"
              onClick={() => setCanvasView("3d")}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                canvasView === "3d"
                  ? "bg-white text-stone-900 shadow-2xs border border-stone-200/80"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              <Box className="w-3.5 h-3.5 text-amber-700" />
              <span>3D Sahne</span>
            </button>
            <button
              type="button"
              data-testid="studio-view-2d"
              onClick={() => setCanvasView("2d")}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                canvasView === "2d"
                  ? "bg-white text-stone-900 shadow-2xs border border-stone-200/80"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5 text-amber-700" />
              <span>2D Teknik Cephe</span>
            </button>
          </div>

          <div className="hidden lg:block">
            <V3PrototypeSwitcher />
          </div>
        </div>

        {/* Right: Minimal Project Actions */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-stone-100 rounded-xl border border-stone-200 p-0.5">
            <button
              type="button"
              onClick={undo}
              disabled={!canUndo}
              title="Geri Al"
              className="p-1.5 rounded-lg hover:bg-white text-stone-700 disabled:opacity-35 transition cursor-pointer"
            >
              <Undo className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={!canRedo}
              title="İleri Al"
              className="p-1.5 rounded-lg hover:bg-white text-stone-700 disabled:opacity-35 transition cursor-pointer"
            >
              <Redo className="w-3.5 h-3.5" />
            </button>
          </div>

          <V3Button
            variant="outline"
            size="md"
            data-testid="studio-open-projects-btn"
            onClick={() => setIsProjectModalOpen(true)}
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-700" />
            <span>Kaydet / Aç</span>
          </V3Button>
        </div>
      </header>

      {approvalBanner && (
        <div className="bg-emerald-700 text-white px-5 py-2 text-xs font-semibold flex items-center justify-between z-30">
          <span>{approvalBanner}</span>
          <button onClick={() => setApprovalBanner(null)} className="cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* 2. MAIN WORKSPACE */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* COLLAPSIBLE LEFT TOOL LIBRARY */}
        <aside
          data-testid="studio-left-library"
          className={`m-2.5 birim-ice-rail-pill birim-ice-unified-shell rounded-[28px] overflow-hidden flex flex-col z-20 shrink-0 ${
            leftOpen ? "w-80" : "w-14"
          }`}
        >
          <div className="h-11 border-b border-stone-200/80 flex items-center justify-between px-3">
            {leftOpen && (
              <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl w-full mr-2">
                <button
                  type="button"
                  data-testid="studio-tab-templates"
                  onClick={() => setLeftSection("templates")}
                  className={`flex-1 py-1 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    leftSection === "templates"
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
                  onClick={() => setLeftSection("materials")}
                  className={`flex-1 py-1 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    leftSection === "materials"
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
              title={leftOpen ? "Kütüphaneyi Daralt" : "Kütüphaneyi Aç"}
            >
              {leftOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>

          {leftOpen ? (
            <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
              {leftSection === "templates" ? (
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
                        className="w-full text-left p-3 rounded-xl bg-stone-50 hover:bg-amber-50/60 border border-stone-200/90 hover:border-amber-700/50 transition group cursor-pointer"
                      >
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
                      </button>
                    ))}
                  </div>

                  <div className="pt-3 border-t border-stone-200/80 space-y-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-stone-500 px-1">
                      Mutfak Yerleşim Seti
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
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                      Kapak / Ön Cephe Malzemesi
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
                  setLeftSection("templates");
                  setLeftOpen(true);
                }}
                className="w-10 h-10 rounded-xl bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-700 cursor-pointer"
                title="Şablonlar"
              >
                <Package className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setLeftSection("materials");
                  setLeftOpen(true);
                }}
                className="w-10 h-10 rounded-xl bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-700 cursor-pointer"
                title="Malzemeler"
              >
                <Palette className="w-4 h-4" />
              </button>
            </div>
          )}
        </aside>

        {/* LARGE CENTRAL 3D / 2D CANVAS */}
        <main className="flex-1 relative flex flex-col overflow-hidden bg-[#F4F2EC]">
          {canvasView === "3d" ? (
            <V3ThreeViewport theme="warm-light" showGrid={true} />
          ) : (
            <V3CadViewport2D mode="elevation" />
          )}

          {/* Subtle Floating Quick Action Pill (Door Open/Close & Module Switcher) */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-white/95 backdrop-blur-md px-3 py-2 rounded-2xl border border-stone-200/90 shadow-lg">
            {/* Direct Module Switcher Pills */}
            <div className="flex items-center gap-1 pr-2 border-r border-stone-200">
              {project.modules.map((m, idx) => (
                <button
                  key={m.id}
                  type="button"
                  data-testid={`studio-mod-pill-${idx}`}
                  onClick={() => setActiveModuleIndex(idx)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    activeModuleIndex === idx
                      ? "bg-stone-900 text-white"
                      : "bg-stone-100 hover:bg-stone-200 text-stone-700"
                  }`}
                >
                  {m.name}
                </button>
              ))}
              <button
                type="button"
                data-testid="studio-add-module-btn"
                onClick={addAdjacentModule}
                className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300/80 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                title="Yanına Modül Ekle"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Modül</span>
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
        </main>

        {/* CONTEXTUAL RIGHT PROPERTY INSPECTOR */}
        <aside
          data-testid="studio-right-inspector"
          className="w-88 border-l border-stone-200/90 bg-white flex flex-col z-20 shrink-0"
          style={{ width: "348px" }}
        >
          <div className="h-11 border-b border-stone-200/80 px-4 flex items-center justify-between bg-stone-50/70">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-700" />
              <span className="text-xs font-bold uppercase tracking-wider text-stone-800">
                {activeModule.name} Özellikleri
              </span>
            </div>
            <span className="text-[11px] font-mono text-stone-500">
              {width}×{height}×{depth}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
            {/* Smart Span Warning if > 1200mm with single bay */}
            {width > 1200 && activeModule.bays.length < 2 && (
              <V3AlertBanner
                type="warning"
                title="Geniş Açıklık Sehim Uyarısı"
                message={`${width} mm genişlikte tek bölme raflarda esneme yapabilir. Otomatik bölme önerilir.`}
                actionLabel="Optimum Bölmeye Ayır"
                onAction={() => applySmartSpan(width)}
              />
            )}

            {/* 1. Parametric Dimensions */}
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
            </V3CollapsibleSection>

            {/* 2. Compartment & Interior Layout */}
            <V3CollapsibleSection
              title="2. Bölme & İç Düzen"
              badge={`${activeModule.bays.length} Bölme`}
              defaultOpen={true}
            >
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-stone-600 block">
                  Kabin İçi Bölme Sayısı
                </span>
                <div className="grid grid-cols-5 gap-1.5">
                  {[1, 2, 3, 4, 5].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      data-testid={`studio-bay-count-${cnt}`}
                      onClick={() => setBayCount(cnt)}
                      className={`h-10 rounded-xl font-mono text-xs font-bold transition cursor-pointer ${
                        activeModule.bays.length === cnt
                          ? "bg-stone-900 text-white shadow-xs"
                          : "bg-stone-100 hover:bg-stone-200 text-stone-700"
                      }`}
                    >
                      {cnt}
                    </button>
                  ))}
                </div>
              </div>

              {activeModule.bays.length > 1 && (
                <div className="flex gap-1 pt-1 overflow-x-auto">
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
                      Bölme {idx + 1}
                    </button>
                  ))}
                </div>
              )}

              {activeBay && (
                <div className="space-y-2.5 pt-2 border-t border-stone-200/80">
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      data-testid="studio-add-shelf-btn"
                      onClick={() => addShelf(activeBayIndex)}
                      className="min-h-[42px] px-2 py-2 rounded-xl bg-stone-100 hover:bg-amber-50 border border-stone-200 hover:border-amber-700/50 text-stone-800 text-xs font-semibold flex flex-col items-center justify-center gap-0.5 transition cursor-pointer"
                    >
                      <Layers className="w-3.5 h-3.5 text-amber-700" />
                      <span>+ Raf ({activeBay.shelves.length})</span>
                    </button>
                    <button
                      type="button"
                      data-testid="studio-add-drawer-btn"
                      onClick={() => addDrawer(activeBayIndex)}
                      className="min-h-[42px] px-2 py-2 rounded-xl bg-stone-100 hover:bg-amber-50 border border-stone-200 hover:border-amber-700/50 text-stone-800 text-xs font-semibold flex flex-col items-center justify-center gap-0.5 transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-amber-700" />
                      <span>+ Çekmece ({activeBay.drawers.length})</span>
                    </button>
                    <button
                      type="button"
                      data-testid="studio-add-rail-btn"
                      onClick={() => addHangingRail(activeBayIndex)}
                      className="min-h-[42px] px-2 py-2 rounded-xl bg-stone-100 hover:bg-amber-50 border border-stone-200 hover:border-amber-700/50 text-stone-800 text-xs font-semibold flex flex-col items-center justify-center gap-0.5 transition cursor-pointer"
                    >
                      <Shirt className="w-3.5 h-3.5 text-amber-700" />
                      <span>+ Askı ({activeBay.hangingRails.length})</span>
                    </button>
                  </div>

                  {/* Door Type Quick Selector */}
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

                  {/* Active Fittings List */}
                  {(activeBay.shelves.length > 0 || activeBay.drawers.length > 0) && (
                    <div className="space-y-1 max-h-32 overflow-y-auto pt-1">
                      {activeBay.shelves.map((s, i) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-stone-50 border border-stone-200/80 text-[11px]"
                        >
                          <span className="text-stone-700 font-medium">
                            Raf #{i + 1} ({s.elevationY} mm)
                          </span>
                          <button
                            type="button"
                            onClick={() => removeShelf(activeBayIndex, s.id)}
                            className="text-stone-400 hover:text-red-600 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      {activeBay.drawers.map((d, i) => (
                        <div
                          key={d.id}
                          className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-stone-50 border border-stone-200/80 text-[11px]"
                        >
                          <span className="text-stone-700 font-medium">
                            Çekmece #{i + 1} ({d.height} mm)
                          </span>
                          <button
                            type="button"
                            onClick={() => removeDrawer(activeBayIndex, d.id)}
                            className="text-stone-400 hover:text-red-600 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      {activeBay.hangingRails.map((r, i) => (
                        <div
                          key={r.id}
                          className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-stone-50 border border-stone-200/80 text-[11px]"
                        >
                          <span className="text-stone-700 font-medium">
                            Askı Borusu #{i + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeHangingRail(activeBayIndex, r.id)}
                            className="text-stone-400 hover:text-red-600 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </V3CollapsibleSection>

            {/* 3. Quick Surface Material Selector in Right Panel */}
            <V3CollapsibleSection title="3. Kapak Yüzey Seçimi" defaultOpen={false}>
              <div className="grid grid-cols-1 gap-1.5">
                {DEFAULT_MATERIALS.slice(0, 5).map((mat) => (
                  <V3MaterialSwatch
                    key={mat.id}
                    id={mat.id}
                    compact
                    testId={`studio-inspector-mat-${mat.id}`}
                    name={mat.name}
                    colorHex={mat.colorHex}
                    costPerM2={mat.costPerM2}
                    category={mat.category}
                    selected={activeModule.carcass.doorMaterialId === mat.id}
                    onSelect={() => setMaterials(undefined, mat.id)}
                  />
                ))}
              </div>
            </V3CollapsibleSection>
          </div>
        </aside>
      </div>

      {/* 3. CLEAN BOTTOM STATUS & PRICE BAR */}
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
            <span className="font-semibold text-stone-800">{project.modules.length} Adet</span>
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
                €{pricing.totalWithVatEur.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
              </span>
              <span className="text-[11px] font-mono text-stone-500">
                ({pricing.totalWithVatTry.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL)
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

      <V3ProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
      />
      <BomModal isOpen={isBomModalOpen} onClose={() => setIsBomModalOpen(false)} />
    </div>
  );
}
