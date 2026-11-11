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
} from "../../../v3/design-system";
import { V3CadViewport2D } from "../../../v3/components/V3CadViewport2D";
import { V3ProjectModal } from "../../../v3/components/V3ProjectModal";
import {
  Ruler,
  Magnet,
  Columns,
  Plus,
  Copy,
  Trash2,
  ArrowLeft,
  ArrowRight,
  FolderOpen,
  Layers,
  Eye,
  Box,
} from "lucide-react";

const V3ThreeViewport = dynamic(
  () => import("../../../v3/components/V3ThreeViewport"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-[#F4F2EC] text-stone-500 text-xs">
        3D Eşzamanlı Önizleme Yükleniyor...
      </div>
    ),
  }
);

export default function V3PlanPage() {
  const {
    project,
    activeModule,
    activeModuleIndex,
    setActiveModuleIndex,
    activeBay,
    activeBayIndex,
    pricing,
    setDimensions,
    setMaterials,
    setBayCount,
    addShelf,
    addDrawer,
    addAdjacentModule,
    duplicateActiveModule,
    removeActiveModule,
    moveActiveModule,
    applyTemplate,
    loadLinearKitchen,
    loadLKitchen,
    loadUKitchen,
    canUndo,
    undo,
    resetToDefault,
  } = useV3Adapter();

  const [layoutMode, setLayoutMode] = useState<"split" | "plan_only" | "3d_only">("split");
  const [planSubView, setPlanSubView] = useState<"top_plan" | "elevation">("top_plan");
  const [snapMm, setSnapMm] = useState<number>(50);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);

  if (!activeModule) {
    return (
      <div
        data-testid="v3-plan-root"
        className="flex flex-col items-center justify-center h-screen w-screen bg-[#F5F3EE] text-[#141413] p-6"
      >
        <div className="max-w-md w-full bg-white border border-[#E4DFD5] rounded-2xl p-8 text-center shadow-sm space-y-4">
          <V3BrandBadge subtitle="PLAN & CAD" />
          <h1 className="text-lg font-bold">Mekânda yerleşik modül bulunmuyor</h1>
          <p className="text-xs text-[#57534E] leading-relaxed">
            Yeni bir dolap veya hazır mutfak yerleşimi seçerek 2D/3D mimari plana devam edebilirsiniz.
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            {canUndo && (
              <V3Button variant="outline" onClick={undo}>
                Geri Al
              </V3Button>
            )}
            <V3Button variant="primary" onClick={resetToDefault}>
              Yeni Modül Ekle
            </V3Button>
          </div>
        </div>
      </div>
    );
  }
  const { width, height, depth } = activeModule.dimensions;
  const mainWall = project.space.walls[0] || { length: 3600, height: 2700 };
  const usedSpanMm = project.modules.reduce(
    (max, m) => Math.max(max, m.position.x + m.dimensions.width),
    0
  );
  const remainingWallMm = Math.max(0, mainWall.length - usedSpanMm);

  return (
    <div
      data-testid="v3-plan-root"
      className="flex flex-col h-screen w-screen overflow-hidden bg-[#F7F6F2] text-stone-900 font-sans select-none"
    >
      {/* 1. ARCHITECTURAL PLAN HEADER */}
      <header className="h-14 bg-white border-b border-stone-200 flex items-center justify-between px-4 shrink-0 z-30">
        <div className="flex items-center gap-3">
          <V3BrandBadge subtitle="PLAN & CAD" />
          <div className="h-4 w-px bg-stone-200 hidden sm:block" />
          <span
            data-testid="plan-project-title"
            className="text-xs font-bold text-stone-800 hidden md:inline"
          >
            {project.title}
          </span>
        </div>

        {/* Center: Split / 2D / 3D Mode Switcher */}
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center p-1 rounded-xl bg-stone-100 border border-stone-200 text-xs">
            <button
              type="button"
              data-testid="plan-mode-split"
              onClick={() => setLayoutMode("split")}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                layoutMode === "split"
                  ? "bg-white text-stone-900 shadow-2xs border border-stone-200/80"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              <Columns className="w-3.5 h-3.5 text-amber-700" />
              <span>2D Plan + 3D Eşzamanlı</span>
            </button>
            <button
              type="button"
              data-testid="plan-mode-2d"
              onClick={() => setLayoutMode("plan_only")}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                layoutMode === "plan_only"
                  ? "bg-white text-stone-900 shadow-2xs border border-stone-200/80"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              <Eye className="w-3.5 h-3.5 text-amber-700" />
              <span>Tam Ekran 2D CAD</span>
            </button>
            <button
              type="button"
              data-testid="plan-mode-3d"
              onClick={() => setLayoutMode("3d_only")}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                layoutMode === "3d_only"
                  ? "bg-white text-stone-900 shadow-2xs border border-stone-200/80"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              <Box className="w-3.5 h-3.5 text-amber-700" />
              <span>3D Görünüm</span>
            </button>
          </div>

          <div className="hidden lg:block">
            <V3PrototypeSwitcher />
          </div>
        </div>

        {/* Right: Save / Load */}
        <div className="flex items-center gap-2">
          <V3Button
            variant="outline"
            size="md"
            data-testid="plan-open-projects-btn"
            onClick={() => setIsProjectModalOpen(true)}
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-700" />
            <span>Kaydet / Aç</span>
          </V3Button>
        </div>
      </header>

      {/* 2. ARCHITECTURAL RIBBON TOOLBAR (Room / Kitchen Presets, Snap, Alignment) */}
      <div className="h-12 bg-stone-100/90 border-b border-stone-200/90 px-4 flex items-center justify-between gap-3 overflow-x-auto shrink-0 z-20 text-xs">
        {/* Left: Kitchen & Wardrobe Spatial Presets */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 mr-1">
            Mekân Şablonu:
          </span>
          <button
            type="button"
            data-testid="plan-preset-linear-kitchen"
            onClick={loadLinearKitchen}
            className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-amber-50 border border-stone-200/90 text-stone-800 font-semibold transition cursor-pointer"
          >
            Doğrusal Mutfak (3.2m)
          </button>
          <button
            type="button"
            data-testid="plan-preset-l-kitchen"
            onClick={loadLKitchen}
            className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-amber-50 border border-stone-200/90 text-stone-800 font-semibold transition cursor-pointer"
          >
            L Tipi Mutfak
          </button>
          <button
            type="button"
            data-testid="plan-preset-u-kitchen"
            onClick={loadUKitchen}
            className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-amber-50 border border-stone-200/90 text-stone-800 font-semibold transition cursor-pointer"
          >
            U Tipi Mutfak
          </button>
          <button
            type="button"
            data-testid="plan-preset-wardrobe"
            onClick={() => applyTemplate(WARDROBE_TEMPLATES[1].templateId)}
            className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-amber-50 border border-stone-200/90 text-stone-800 font-semibold transition cursor-pointer"
          >
            Master Gardırop
          </button>
        </div>

        {/* Center: Snap & Sub-view Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-stone-200">
            <Magnet className="w-3.5 h-3.5 text-amber-700" />
            <span className="text-[11px] text-stone-600 font-medium">Izgara Snap:</span>
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

          <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-stone-200">
            <button
              type="button"
              data-testid="plan-subview-top"
              onClick={() => setPlanSubView("top_plan")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer ${
                planSubView === "top_plan"
                  ? "bg-stone-900 text-white"
                  : "text-stone-600 hover:bg-stone-100"
              }`}
            >
              Üst Mimari Plan
            </button>
            <button
              type="button"
              data-testid="plan-subview-elevation"
              onClick={() => setPlanSubView("elevation")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer ${
                planSubView === "elevation"
                  ? "bg-stone-900 text-white"
                  : "text-stone-600 hover:bg-stone-100"
              }`}
            >
              Ön Cephe Kesiti
            </button>
          </div>
        </div>

        {/* Right: Wall Clearance Status */}
        <div className="flex items-center gap-3 shrink-0 font-mono text-xs">
          <div className="flex items-center gap-1.5 text-stone-700">
            <Ruler className="w-3.5 h-3.5 text-amber-700" />
            <span>Duvar: {mainWall.length} mm</span>
          </div>
          <span className="text-stone-300">|</span>
          <div className="text-sky-800 font-bold">
            Kalan Boşluk: {remainingWallMm} mm
          </div>
        </div>
      </div>

      {/* 3. SPLIT OR FULL WORKSPACE */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* PRIMARY 2D PLAN VIEWPORT */}
        {(layoutMode === "split" || layoutMode === "plan_only") && (
          <div
            className={`${
              layoutMode === "split" ? "w-3/5 border-r border-stone-300" : "w-full"
            } h-full relative flex flex-col`}
          >
            {planSubView === "top_plan" ? (
              <V3CadViewport2D mode="plan" interactivePlan={true} snapMm={snapMm} />
            ) : (
              <V3CadViewport2D mode="elevation" />
            )}

            {/* Module Strip Selector on top of 2D Canvas */}
            <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-white/95 backdrop-blur-md p-1.5 rounded-xl border border-stone-200 shadow-sm flex-wrap max-w-[85%]">
              {project.modules.map((m, idx) => (
                <button
                  key={m.id}
                  type="button"
                  data-testid={`plan-mod-tab-${idx}`}
                  onClick={() => setActiveModuleIndex(idx)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    activeModuleIndex === idx
                      ? "bg-amber-700 text-white shadow-2xs"
                      : "bg-stone-100 hover:bg-stone-200 text-stone-700"
                  }`}
                >
                  {idx + 1}. {m.name} ({m.dimensions.width}mm)
                </button>
              ))}
              <button
                type="button"
                data-testid="plan-add-module-btn"
                onClick={addAdjacentModule}
                className="px-2.5 py-1 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" /> Ekle
              </button>
            </div>
          </div>
        )}

        {/* SYNCHRONIZED 3D PREVIEW */}
        {(layoutMode === "split" || layoutMode === "3d_only") && (
          <div className={`${layoutMode === "split" ? "w-2/5" : "w-full"} h-full relative`}>
            <V3ThreeViewport theme="warm-light" showGrid={true} />
            <div className="absolute top-3 left-3 z-10 px-3 py-1 rounded-lg bg-white/90 border border-stone-200 text-[11px] font-semibold text-stone-700 shadow-2xs">
              Canlı 3D Mekân Simülasyonu
            </div>
          </div>
        )}
      </div>

      {/* 4. CONTEXTUAL BOTTOM PLANNER INSPECTOR BAR */}
      <footer
        data-testid="plan-contextual-bar"
        className="min-h-[84px] bg-white border-t border-stone-200 px-5 py-3 flex flex-wrap items-center justify-between gap-4 shrink-0 z-30 text-xs"
      >
        {/* Active Module Placement & Position Controls */}
        <div className="flex items-center gap-3">
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
              title="Sola Kaydır"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 font-mono text-[11px] font-bold text-stone-700">
              X: {activeModule.position.x} mm
            </span>
            <button
              type="button"
              onClick={() => moveActiveModule(snapMm || 50)}
              className="p-1.5 rounded-lg hover:bg-white text-stone-700 cursor-pointer"
              title="Sağa Kaydır"
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={duplicateActiveModule}
            className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 cursor-pointer"
            title="Modülü Çoğalt"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          {project.modules.length > 1 && (
            <button
              type="button"
              onClick={removeActiveModule}
              className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 cursor-pointer"
              title="Modülü Sil"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Direct Precision Dimension Inputs */}
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

          {/* Quick Shelf & Bay Action */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              data-testid="plan-add-shelf-btn"
              onClick={() => addShelf(activeBayIndex)}
              className="px-3 py-2 rounded-xl bg-stone-100 hover:bg-amber-50 border border-stone-200 text-stone-800 font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-amber-700" />
              <span>+ Raf ({activeBay?.shelves.length || 0})</span>
            </button>
            <button
              type="button"
              data-testid="plan-add-drawer-btn"
              onClick={() => addDrawer(activeBayIndex)}
              className="px-3 py-2 rounded-xl bg-stone-100 hover:bg-amber-50 border border-stone-200 text-stone-800 font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-amber-700" />
              <span>+ Çekmece ({activeBay?.drawers.length || 0})</span>
            </button>
            <select
              aria-label="Bölme Sayısı"
              value={activeModule.bays.length}
              onChange={(e) => setBayCount(Number(e.target.value))}
              className="px-2.5 py-2 rounded-xl bg-stone-100 border border-stone-200 font-semibold text-stone-800 cursor-pointer"
            >
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n} Bölme
                </option>
              ))}
            </select>
          </div>

          {/* Quick Material Dots */}
          <div className="flex items-center gap-1.5 bg-stone-50 px-2.5 py-1.5 rounded-xl border border-stone-200">
            <span className="text-[11px] font-semibold text-stone-500 mr-1">Yüzey:</span>
            {DEFAULT_MATERIALS.slice(0, 5).map((mat) => (
              <button
                key={mat.id}
                type="button"
                data-testid={`plan-mat-${mat.id}`}
                onClick={() => setMaterials(undefined, mat.id)}
                title={mat.name}
                className={`w-6 h-6 rounded-full border transition cursor-pointer ${
                  activeModule.carcass.doorMaterialId === mat.id
                    ? "ring-2 ring-amber-700 border-white scale-110"
                    : "border-stone-300 opacity-85 hover:opacity-100"
                }`}
                style={{ backgroundColor: mat.colorHex }}
              />
            ))}
          </div>
        </div>

        {/* Total Price */}
        <div className="text-right ml-auto">
          <span className="text-[10px] uppercase tracking-wider text-stone-400 font-bold block">
            Proje Toplamı
          </span>
          <span
            data-testid="plan-total-price"
            className="text-base font-black font-mono text-stone-900"
          >
            €{pricing.totalWithVatEur.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
          </span>
        </div>
      </footer>

      <V3ProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
      />
    </div>
  );
}
