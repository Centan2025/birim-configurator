"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import {
  useConfiguratorStore,
} from "../store/useConfiguratorStore";
import { DEFAULT_MATERIALS } from "@birim/core";
import { WARDROBE_TEMPLATES } from "@birim/catalog";
import Elevation2D from "../components/Elevation2D";
import TopPlan2D from "../components/TopPlan2D";
import BomModal from "../components/BomModal";
import StoreErpModal from "../components/StoreErpModal";
import {
  Undo,
  Redo,
  Box,
  Layers,
  FileSpreadsheet,
  Network,
  RotateCcw,
  Plus,
  Trash2,
  AlertCircle,
  Eye,
  Settings2,
  Package,
  Sparkles,
  Scissors,
  CheckCircle,
  X,
} from "lucide-react";
import { generateCrossSection2D, generateModuleGeometry } from "@birim/geometry";

const ThreeCanvas = dynamic(() => import("../components/ThreeCanvas"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-950 text-slate-400 text-sm">
      3D WebGL Sahnesi Yükleniyor...
    </div>
  ),
});

export default function ConfiguratorPage() {
  const [isBomOpen, setIsBomOpen] = useState(false);
  const [isStoreErpOpen, setIsStoreErpOpen] = useState(false);
  const [leftTab, setLeftTab] = useState<"templates" | "materials" | "advisor" | "alternatives">("templates");
  const [approvalMessage, setApprovalMessage] = useState<string | null>(null);

  const project = useConfiguratorStore((s) => s.project);
  const activeModIndex = useConfiguratorStore((s) => s.activeModuleIndex);
  const setActiveModuleIndex = useConfiguratorStore((s) => s.setActiveModuleIndex);
  const viewMode = useConfiguratorStore((s) => s.viewMode);
  const setViewMode = useConfiguratorStore((s) => s.setViewMode);
  const validationIssues = useConfiguratorStore((s) => s.validationIssues);
  const pricing = useConfiguratorStore((s) => s.pricing);
  const bom = useConfiguratorStore((s) => s.bom);
  const smartAdvice = useConfiguratorStore((s) => s.smartAdvice);
  const history = useConfiguratorStore((s) => s.history);
  const future = useConfiguratorStore((s) => s.future);

  const undo = useConfiguratorStore((s) => s.undo);
  const redo = useConfiguratorStore((s) => s.redo);
  const setDimensions = useConfiguratorStore((s) => s.setDimensions);
  const setPlinthHeight = useConfiguratorStore((s) => s.setPlinthHeight);
  const setMaterials = useConfiguratorStore((s) => s.setMaterials);
  const setBayCount = useConfiguratorStore((s) => s.setBayCount);
  const setBayDoorType = useConfiguratorStore((s) => s.setBayDoorType);
  const addShelf = useConfiguratorStore((s) => s.addShelf);
  const removeShelf = useConfiguratorStore((s) => s.removeShelf);
  const addHangingRail = useConfiguratorStore((s) => s.addHangingRail);
  const removeHangingRail = useConfiguratorStore((s) => s.removeHangingRail);
  const addDrawer = useConfiguratorStore((s) => s.addDrawer);
  const removeDrawer = useConfiguratorStore((s) => s.removeDrawer);
  const addSpecialFitting = useConfiguratorStore((s) => s.addSpecialFitting);
  const removeSpecialFitting = useConfiguratorStore((s) => s.removeSpecialFitting);
  const addAdjacentModule = useConfiguratorStore((s) => s.addAdjacentModule);
  const removeActiveModule = useConfiguratorStore((s) => s.removeActiveModule);
  const approveProduction = useConfiguratorStore((s) => s.approveProduction);
  const applySmartSpan = useConfiguratorStore((s) => s.applySmartSpan);
  const applyTemplate = useConfiguratorStore((s) => s.applyTemplate);
  const loadLinearKitchen = useConfiguratorStore((s) => s.loadLinearKitchen);
  const resetToDefault = useConfiguratorStore((s) => s.resetToDefault);

  const activeMod = project.modules[activeModIndex] || project.modules[0];
  const { width, height, depth } = activeMod.dimensions;

  const handleApprove = () => {
    const res = approveProduction();
    setApprovalMessage(res.message);
    setTimeout(() => setApprovalMessage(null), 5000);
  };

  // Cross section rendering helper
  const renderSectionView = () => {
    const breakdown = generateModuleGeometry(activeMod);
    const secData = generateCrossSection2D(breakdown);
    const vb = secData.viewBox;

    return (
      <div className="relative w-full h-full bg-slate-900 overflow-hidden flex items-center justify-center">
        <div className="absolute top-4 left-4 z-10 bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800 text-xs text-amber-400 font-semibold uppercase">
          Düşey Kesit Çizimi (Depth x Height Cross-Section)
        </div>
        <svg viewBox={`${vb.x} ${vb.y} ${vb.width} ${vb.height}`} className="w-full h-full">
          {secData.elements.map((el) => (
            <rect
              key={el.id}
              x={el.x}
              y={el.y}
              width={Math.max(1, el.width)}
              height={Math.max(1, el.height)}
              fill="#334155"
              stroke="#94a3b8"
              strokeWidth="2"
            />
          ))}
          {secData.dimensionLines.map((dim) => (
            <g key={dim.id}>
              <line x1={dim.x1} y1={dim.y1} x2={dim.x2} y2={dim.y2} stroke="#f59e0b" strokeWidth="1.5" />
              <text
                x={(dim.x1 + dim.x2) / 2}
                y={dim.y1 - 6}
                textAnchor="middle"
                fill="#fbbf24"
                fontSize="12"
                fontFamily="monospace"
              >
                {dim.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 font-sans select-none">
      {/* 1. TOP HEADER */}
      <header className="h-14 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-5 shrink-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center font-black text-slate-950 text-base shadow-md">
            B
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-tight text-white">BİRİM CONFIGURATOR V2</h1>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono font-medium">
                Professional
              </span>
              {project.status === "production_approved" && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono font-bold flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Üretim Onaylı
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">{project.title}</p>
          </div>
        </div>

        {/* View Switcher */}
        <div className="flex items-center bg-slate-950/80 p-1 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => setViewMode("3d")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors ${
              viewMode === "3d" ? "bg-amber-600 text-white font-medium shadow-sm" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            3D WebGL
          </button>
          <button
            onClick={() => setViewMode("2d_elevation")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors ${
              viewMode === "2d_elevation" ? "bg-amber-600 text-white font-medium shadow-sm" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            2D Ön Görünüş
          </button>
          <button
            onClick={() => setViewMode("2d_plan")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors ${
              viewMode === "2d_plan" ? "bg-amber-600 text-white font-medium shadow-sm" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            2D Üst Plan
          </button>
          <button
            onClick={() => setViewMode("2d_section")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors ${
              viewMode === "2d_section" ? "bg-amber-600 text-white font-medium shadow-sm" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Scissors className="w-3.5 h-3.5" />
            2D Kesit
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center bg-slate-950/80 rounded-lg border border-slate-800 p-0.5 mr-1">
            <button
              onClick={undo}
              disabled={history.length === 0}
              title="Geri Al (Ctrl+Z)"
              className="p-1.5 rounded hover:bg-slate-800 text-slate-300 disabled:opacity-30"
            >
              <Undo className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={redo}
              disabled={future.length === 0}
              title="Yinele (Ctrl+Y)"
              className="p-1.5 rounded hover:bg-slate-800 text-slate-300 disabled:opacity-30"
            >
              <Redo className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={() => setIsBomOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 font-medium transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400" />
            BOM & Üretim Portalı
          </button>

          <button
            onClick={() => setIsStoreErpOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-600 hover:to-indigo-600 text-white rounded-lg shadow-sm font-medium transition-colors"
          >
            <Network className="w-3.5 h-3.5" />
            Store / ERP Köprüsü
          </button>

          <button
            onClick={resetToDefault}
            title="Tasarımı Sıfırla"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 ml-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Approval Notification Banner */}
      {approvalMessage && (
        <div className="bg-emerald-950/80 border-b border-emerald-800/80 text-emerald-200 text-xs px-6 py-2 flex items-center justify-between z-40">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span>{approvalMessage}</span>
          </div>
          <button onClick={() => setApprovalMessage(null)} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. MAIN WORKSPACE */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT SIDEBAR: KÜTÜPHANE, MALZEME, AKILLI DANIŞMAN, ALTERNATİF FİYATLAR */}
        <aside className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 z-20">
          <div className="flex border-b border-slate-800 text-[11px] font-semibold">
            <button
              onClick={() => setLeftTab("templates")}
              className={`flex-1 py-2.5 text-center border-b-2 transition-colors ${
                leftTab === "templates" ? "border-amber-500 text-amber-400 bg-slate-800/40" : "border-transparent text-slate-400"
              }`}
            >
              Şablonlar
            </button>
            <button
              onClick={() => setLeftTab("materials")}
              className={`flex-1 py-2.5 text-center border-b-2 transition-colors ${
                leftTab === "materials" ? "border-amber-500 text-amber-400 bg-slate-800/40" : "border-transparent text-slate-400"
              }`}
            >
              Malzemeler
            </button>
            <button
              onClick={() => setLeftTab("advisor")}
              className={`flex-1 py-2.5 text-center border-b-2 transition-colors ${
                leftTab === "advisor" ? "border-amber-500 text-amber-400 bg-slate-800/40" : "border-transparent text-slate-400"
              }`}
            >
              Danışman
            </button>
            <button
              onClick={() => setLeftTab("alternatives")}
              className={`flex-1 py-2.5 text-center border-b-2 transition-colors ${
                leftTab === "alternatives" ? "border-amber-500 text-amber-400 bg-slate-800/40" : "border-transparent text-slate-400"
              }`}
            >
              Fiyat Karşılaştır
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            {/* TAB 1: TEMPLATES */}
            {leftTab === "templates" && (
              <>
                <div>
                  <h3 className="text-slate-400 uppercase tracking-wider text-[11px] font-bold mb-2 flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-amber-400" />
                    Gardırop Şablonları
                  </h3>
                  <div className="space-y-2">
                    {WARDROBE_TEMPLATES.map((tpl) => (
                      <button
                        key={tpl.templateId}
                        onClick={() => applyTemplate(tpl.templateId)}
                        className="w-full text-left p-3 rounded-lg bg-slate-950/80 hover:bg-slate-800/80 border border-slate-800 hover:border-amber-500/50 transition-all group"
                      >
                        <div className="font-semibold text-slate-200 group-hover:text-amber-400">
                          {tpl.name}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1 leading-snug">
                          {tpl.description}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800">
                  <h3 className="text-slate-400 uppercase tracking-wider text-[11px] font-bold mb-2 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-blue-400" />
                    Mutfak Mekân Şablonu
                  </h3>
                  <button
                    onClick={loadLinearKitchen}
                    className="w-full text-left p-3 rounded-lg bg-slate-950/80 hover:bg-slate-800/80 border border-slate-800 hover:border-blue-500/50 transition-all group"
                  >
                    <div className="font-semibold text-slate-200 group-hover:text-blue-400">
                      Doğrusal Mutfak Yerleşimi (3.2m)
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 leading-snug">
                      Evye + Çekmeceli alt modül + Boy kiler dolabı + Üst dolaplar
                    </div>
                  </button>
                </div>
              </>
            )}

            {/* TAB 2: MATERIALS */}
            {leftTab === "materials" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-slate-400 mb-1.5 font-medium">Gövde Malzemesi:</label>
                  <div className="space-y-1.5">
                    {DEFAULT_MATERIALS.map((mat) => {
                      const isSelected = activeMod.carcass.bodyMaterialId === mat.id;
                      return (
                        <button
                          key={mat.id}
                          onClick={() => setMaterials(mat.id, undefined)}
                          className={`w-full flex items-center justify-between p-2 rounded-lg border text-left transition-colors ${
                            isSelected
                              ? "bg-amber-950/30 border-amber-500 text-amber-200"
                              : "bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="w-4 h-4 rounded-full border border-slate-600 shrink-0"
                              style={{ backgroundColor: mat.colorHex }}
                            />
                            <span>{mat.name}</span>
                          </div>
                          <span className="font-mono text-[11px] text-slate-400">€{mat.costPerM2}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800">
                  <label className="block text-slate-400 mb-1.5 font-medium">Kapak / Ön Yüzey Malzemesi:</label>
                  <div className="space-y-1.5">
                    {DEFAULT_MATERIALS.map((mat) => {
                      const isSelected = activeMod.carcass.doorMaterialId === mat.id;
                      return (
                        <button
                          key={mat.id}
                          onClick={() => setMaterials(undefined, mat.id)}
                          className={`w-full flex items-center justify-between p-2 rounded-lg border text-left transition-colors ${
                            isSelected
                              ? "bg-amber-950/30 border-amber-500 text-amber-200"
                              : "bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="w-4 h-4 rounded-full border border-slate-600 shrink-0"
                              style={{ backgroundColor: mat.colorHex }}
                            />
                            <span>{mat.name}</span>
                          </div>
                          <span className="font-mono text-[11px] text-slate-400">€{mat.costPerM2}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: SMART ADVISOR */}
            {leftTab === "advisor" && (
              <div className="space-y-4">
                <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-amber-400 font-bold">
                    <Sparkles className="w-4 h-4" />
                    <span>Akıllı Açıklık & Yerleşim Danışmanı</span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Mevcut açıklık: <strong className="text-amber-400">{width} mm</strong>
                  </p>
                </div>

                <div>
                  <h4 className="text-slate-400 uppercase tracking-wider text-[10px] font-bold mb-2">
                    Önerilen Gövde Bölümleri:
                  </h4>
                  <div className="space-y-2">
                    {smartAdvice.recommendedPartitions.map((p) => (
                      <div key={p.id} className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-slate-200">{p.name}</span>
                          <button
                            onClick={() => applySmartSpan(width)}
                            className="px-2 py-0.5 rounded bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-semibold"
                          >
                            Uygula
                          </button>
                        </div>
                        <p className="text-[11px] text-slate-400">{p.explanation}</p>
                        <div className="text-[10px] text-emerald-400">
                          {p.pros.map((pr, i) => (
                            <div key={i}>✓ {pr}</div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Hinge and Drawer Advice */}
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-[11px]">
                  <div className="font-semibold text-slate-300">Teknik Donanım Uyumluluk Özeti:</div>
                  <div className="text-slate-400">
                    • Menteşe: {smartAdvice.hingeAdvice.reason}
                  </div>
                  <div className="text-slate-400">
                    • Çekmece: {smartAdvice.drawerAdvice.reason}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: MATERIAL ALTERNATIVE COMPARISON */}
            {leftTab === "alternatives" && (
              <div className="space-y-3">
                <div className="p-2.5 bg-blue-950/40 border border-blue-800/60 rounded-lg text-blue-300 text-xs">
                  Aynı tasarımın farklı hammadde seçenekleri ile karşılaştırmalı KDV dahil satış fiyatları:
                </div>
                {pricing.materialAlternatives?.map((alt) => (
                  <div key={alt.materialId} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-slate-200">{alt.materialName}</span>
                      <span className="font-mono text-amber-400 font-bold">€{alt.totalWithVatEur}</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                      <span>({alt.totalWithVatTry.toLocaleString()} TL)</span>
                      <span className={alt.diffEur > 0 ? "text-amber-500" : "text-emerald-400"}>
                        {alt.diffEur > 0 ? `+€${alt.diffEur}` : `${alt.diffEur} €`} (%{alt.diffPercent})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* CENTER VIEWPORT (CANVAS / 2D / 3D) */}
        <main className="flex-1 relative bg-slate-950 overflow-hidden">
          {viewMode === "3d" && <ThreeCanvas />}
          {viewMode === "2d_elevation" && <Elevation2D />}
          {viewMode === "2d_plan" && <TopPlan2D />}
          {viewMode === "2d_section" && renderSectionView()}
        </main>

        {/* RIGHT SIDEBAR: PARAMETRİK ÖZELLİKLER & BÖLME YÖNETİMİ */}
        <aside className="w-84 bg-slate-900 border-l border-slate-800 flex flex-col shrink-0 z-20">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-amber-400" />
              Parametrik Özellikler
            </h2>
            <div className="flex items-center gap-1">
              <button
                onClick={addAdjacentModule}
                className="px-2 py-1 rounded bg-blue-700 hover:bg-blue-600 text-white text-[10px] font-semibold flex items-center gap-1 shadow"
                title="Yanına yeni bağımsız kabin ekle"
              >
                <Plus className="w-3 h-3" /> Kabin Ekle
              </button>
            </div>
          </div>

          {/* Module Selector if multiple modules exist */}
          {project.modules.length > 1 && (
            <div className="px-4 py-2 bg-slate-950 border-b border-slate-800 flex items-center gap-2 overflow-x-auto text-xs">
              <span className="text-slate-400 text-[11px]">Aktif Kabin:</span>
              {project.modules.map((m, idx) => (
                <button
                  key={m.id}
                  onClick={() => setActiveModuleIndex(idx)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold whitespace-nowrap transition-colors ${
                    activeModIndex === idx ? "bg-amber-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                  }`}
                >
                  {m.name}
                </button>
              ))}
              <button
                onClick={removeActiveModule}
                className="p-1 rounded text-slate-500 hover:text-red-400 ml-auto"
                title="Aktif kabini sil"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            {/* Dimensions Control */}
            <div className="space-y-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
              <h3 className="font-semibold text-slate-300 text-[11px] uppercase tracking-wider">
                Gövde Ölçüleri (mm)
              </h3>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-400">Genişlik (W):</span>
                  <span className="font-mono text-amber-400 font-bold">{width} mm</span>
                </div>
                <input
                  type="range"
                  min={300}
                  max={3600}
                  step={50}
                  value={width}
                  onChange={(e) => setDimensions(Number(e.target.value), height, depth)}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-400">Yükseklik (H):</span>
                  <span className="font-mono text-amber-400 font-bold">{height} mm</span>
                </div>
                <input
                  type="range"
                  min={400}
                  max={2800}
                  step={50}
                  value={height}
                  onChange={(e) => setDimensions(width, Number(e.target.value), depth)}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-400">Derinlik (D):</span>
                  <span className="font-mono text-amber-400 font-bold">{depth} mm</span>
                </div>
                <input
                  type="range"
                  min={250}
                  max={900}
                  step={10}
                  value={depth}
                  onChange={(e) => setDimensions(width, height, Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-400">Baza Yüksekliği:</span>
                  <span className="font-mono text-slate-300 font-bold">{activeMod.carcass.plinthHeight} mm</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={150}
                  step={10}
                  value={activeMod.carcass.plinthHeight}
                  onChange={(e) => setPlinthHeight(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Bay / Compartment Management */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-300 text-[11px] uppercase tracking-wider">
                  Bölme Sayısı ({activeMod.bays.length})
                </h3>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5, 6].map((cnt) => (
                    <button
                      key={cnt}
                      onClick={() => setBayCount(cnt)}
                      className={`w-6 h-6 rounded flex items-center justify-center font-mono font-bold text-xs transition-colors ${
                        activeMod.bays.length === cnt
                          ? "bg-amber-600 text-white"
                          : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                      }`}
                    >
                      {cnt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bay Editors */}
              <div className="space-y-3">
                {activeMod.bays.map((bay, bayIdx) => (
                  <div key={bay.index} className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                      <span className="font-bold text-amber-400">Bölme {bayIdx + 1}</span>
                      <select
                        value={bay.door.type}
                        onChange={(e) =>
                          setBayDoorType(
                            bayIdx,
                            e.target.value as "single_left" | "single_right" | "double" | "sliding" | "open"
                          )
                        }
                        className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-[11px] focus:outline-none focus:border-amber-500"
                      >
                        <option value="open">Açık (Kapak Yok)</option>
                        <option value="single_left">Tek Kapak (Sol)</option>
                        <option value="single_right">Tek Kapak (Sağ)</option>
                        <option value="double">Çift Kapak</option>
                        <option value="sliding">Sürgülü Kapak</option>
                      </select>
                    </div>

                    {/* Shelves Control */}
                    <div>
                      <div className="flex items-center justify-between mb-1 text-[11px]">
                        <span className="text-slate-400">Raflar ({bay.shelves.length})</span>
                        <button
                          onClick={() => addShelf(bayIdx)}
                          className="flex items-center gap-1 text-amber-400 hover:text-amber-300 font-medium"
                        >
                          <Plus className="w-3 h-3" /> Ekle
                        </button>
                      </div>
                      <div className="space-y-1">
                        {bay.shelves.map((shelf, sIdx) => (
                          <div
                            key={shelf.id}
                            className="flex items-center justify-between bg-slate-900 px-2 py-1 rounded text-[11px] border border-slate-800/60"
                          >
                            <span className="text-slate-300 font-mono">
                              Raf {sIdx + 1} ({shelf.elevationY} mm)
                            </span>
                            <button
                              onClick={() => removeShelf(bayIdx, shelf.id)}
                              className="text-slate-500 hover:text-red-400"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Hanging Rail Control */}
                    <div>
                      <div className="flex items-center justify-between mb-1 text-[11px]">
                        <span className="text-slate-400">Askı Borusu ({bay.hangingRails.length})</span>
                        <button
                          onClick={() => addHangingRail(bayIdx)}
                          className="flex items-center gap-1 text-amber-400 hover:text-amber-300 font-medium"
                        >
                          <Plus className="w-3 h-3" /> Ekle
                        </button>
                      </div>
                      <div className="space-y-1">
                        {bay.hangingRails.map((rail, rIdx) => (
                          <div
                            key={rail.id}
                            className="flex items-center justify-between bg-slate-900 px-2 py-1 rounded text-[11px] border border-slate-800/60"
                          >
                            <span className="text-slate-300 font-mono">
                              Askı {rIdx + 1} ({rail.elevationY} mm)
                            </span>
                            <button
                              onClick={() => removeHangingRail(bayIdx, rail.id)}
                              className="text-slate-500 hover:text-red-400"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Drawers Control */}
                    <div>
                      <div className="flex items-center justify-between mb-1 text-[11px]">
                        <span className="text-slate-400">Çekmeceler ({bay.drawers.length})</span>
                        <button
                          onClick={() => addDrawer(bayIdx)}
                          className="flex items-center gap-1 text-amber-400 hover:text-amber-300 font-medium"
                        >
                          <Plus className="w-3 h-3" /> Ekle
                        </button>
                      </div>
                      <div className="space-y-1">
                        {bay.drawers.map((drw, dIdx) => (
                          <div
                            key={drw.id}
                            className="flex items-center justify-between bg-slate-900 px-2 py-1 rounded text-[11px] border border-slate-800/60"
                          >
                            <span className="text-slate-300 font-mono">
                              Çekmece {dIdx + 1} (h:{drw.height}mm)
                            </span>
                            <button
                              onClick={() => removeDrawer(bayIdx, drw.id)}
                              className="text-slate-500 hover:text-red-400"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Special Fittings (Trouser rack, shoe rack, etc.) */}
                    <div>
                      <div className="flex items-center justify-between mb-1 text-[11px]">
                        <span className="text-slate-400">Özel Donanımlar ({bay.specialFittings?.length || 0})</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => addSpecialFitting(bayIdx, "trouser_rack")}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                            title="Pantolonluk Ekle"
                          >
                            + Pantolon
                          </button>
                          <button
                            onClick={() => addSpecialFitting(bayIdx, "shoe_rack")}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                            title="Ayakkabılık Ekle"
                          >
                            + Ayakkabı
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        {bay.specialFittings?.map((fit) => (
                          <div
                            key={fit.id}
                            className="flex items-center justify-between bg-slate-900 px-2 py-1 rounded text-[11px] border border-slate-800/60"
                          >
                            <span className="text-slate-300 font-mono capitalize">
                              {fit.type.replace("_", " ")}
                            </span>
                            <button
                              onClick={() => removeSpecialFitting(bayIdx, fit.id)}
                              className="text-slate-500 hover:text-red-400"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Validation Issues / Alerts */}
            {validationIssues.length > 0 && (
              <div className="p-3 bg-red-950/30 border border-red-800/50 rounded-xl space-y-1.5">
                <div className="flex items-center gap-1.5 text-red-400 font-semibold text-[11px] uppercase tracking-wider">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  Mühendislik / Üretim Uyarıları
                </div>
                {validationIssues.map((issue, idx) => (
                  <p key={idx} className="text-[11px] text-red-300 leading-tight">
                    • {issue.message}
                  </p>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* 3. BOTTOM SUMMARY BAR */}
      <footer className="h-14 bg-slate-900 border-t border-slate-800 flex items-center justify-between px-6 shrink-0 z-30">
        <div className="flex items-center gap-6 text-xs">
          <div>
            <span className="text-slate-400">Parça Sayısı: </span>
            <span className="font-mono text-slate-200 font-bold">{bom.summary.totalPiecesCount} adet</span>
          </div>
          <div>
            <span className="text-slate-400">Net Alan: </span>
            <span className="font-mono text-amber-400 font-bold">{bom.summary.totalPanelAreaM2} m²</span>
          </div>
          <div>
            <span className="text-slate-400">Kenar Bandı: </span>
            <span className="font-mono text-blue-400 font-bold">{bom.summary.totalEdgeBandMeters} mt</span>
          </div>
          <div>
            <span className="text-slate-400">CNC Delik: </span>
            <span className="font-mono text-purple-400 font-bold">{bom.summary.totalDrillingHolesCount} delik</span>
          </div>
          <div>
            <span className="text-slate-400">Hırdavat: </span>
            <span className="font-mono text-emerald-400 font-bold">{bom.summary.totalHardwareCount} adet</span>
          </div>
        </div>

        {/* Pricing Display & Approval Action */}
        <div className="flex items-center gap-5">
          <div className="text-right">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
              KDV Dahil Satış Tutarı
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-black text-amber-400 font-mono">
                €{pricing.totalWithVatEur.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                ({pricing.totalWithVatTry.toLocaleString("tr-TR", { minimumFractionDigits: 0 })} TL)
              </span>
            </div>
          </div>

          <button
            onClick={handleApprove}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-md transition-colors"
          >
            <CheckCircle className="w-4 h-4" />
            Üretime Onayla
          </button>

          <button
            onClick={() => setIsBomOpen(true)}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold shadow-md transition-colors"
          >
            BOM & Kesim Gör
          </button>
        </div>
      </footer>

      {/* Modals */}
      <BomModal isOpen={isBomOpen} onClose={() => setIsBomOpen(false)} />
      <StoreErpModal isOpen={isStoreErpOpen} onClose={() => setIsStoreErpOpen(false)} />
    </div>
  );
}
