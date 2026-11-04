"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import {
  useConfiguratorStore,
  ViewMode,
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
} from "lucide-react";

// Dynamically load ThreeCanvas with SSR disabled
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
  const [leftTab, setLeftTab] = useState<"templates" | "materials">("templates");

  const project = useConfiguratorStore((s) => s.project);
  const activeModIndex = useConfiguratorStore((s) => s.activeModuleIndex);
  const viewMode = useConfiguratorStore((s) => s.viewMode);
  const setViewMode = useConfiguratorStore((s) => s.setViewMode);
  const validationIssues = useConfiguratorStore((s) => s.validationIssues);
  const pricing = useConfiguratorStore((s) => s.pricing);
  const bom = useConfiguratorStore((s) => s.bom);
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
  const applyTemplate = useConfiguratorStore((s) => s.applyTemplate);
  const loadLinearKitchen = useConfiguratorStore((s) => s.loadLinearKitchen);
  const resetToDefault = useConfiguratorStore((s) => s.resetToDefault);

  const activeMod = project.modules[activeModIndex] || project.modules[0];
  const { width, height, depth } = activeMod.dimensions;

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
              <h1 className="text-sm font-bold tracking-tight text-white">BİRİM CONFIGURATOR</h1>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono font-medium">
                v1.0 Pro
              </span>
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
            3D Perspektif
          </button>
          <button
            onClick={() => setViewMode("2d_elevation")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors ${
              viewMode === "2d_elevation"
                ? "bg-amber-600 text-white font-medium shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            2D Ön Görünüş
          </button>
          <button
            onClick={() => setViewMode("2d_plan")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors ${
              viewMode === "2d_plan"
                ? "bg-amber-600 text-white font-medium shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            2D Üst Plan
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center bg-slate-950/80 rounded-lg border border-slate-800 p-0.5 mr-2">
            <button
              onClick={undo}
              disabled={history.length === 0}
              title="Geri Al (Ctrl+Z)"
              className="p-1.5 rounded hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <Undo className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={redo}
              disabled={future.length === 0}
              title="Yinele (Ctrl+Y)"
              className="p-1.5 rounded hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <Redo className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={() => setIsBomOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 font-medium transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400" />
            BOM & Kesim Listesi
          </button>

          <button
            onClick={() => setIsStoreErpOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-600 hover:to-indigo-600 text-white rounded-lg shadow-sm font-medium transition-colors"
          >
            <Network className="w-3.5 h-3.5" />
            Store / ERP Entegrasyon
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

      {/* 2. MAIN WORKSPACE */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT SIDEBAR: KÜTÜPHANE VE MALZEMELER */}
        <aside className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 z-20">
          <div className="flex border-b border-slate-800 text-xs font-semibold">
            <button
              onClick={() => setLeftTab("templates")}
              className={`flex-1 py-3 text-center border-b-2 transition-colors ${
                leftTab === "templates"
                  ? "border-amber-500 text-amber-400 bg-slate-800/40"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              Şablonlar & Mekân
            </button>
            <button
              onClick={() => setLeftTab("materials")}
              className={`flex-1 py-3 text-center border-b-2 transition-colors ${
                leftTab === "materials"
                  ? "border-amber-500 text-amber-400 bg-slate-800/40"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              Malzeme & Yüzey
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
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
                    Mutfak Modülleri & Yerleşim
                  </h3>
                  <button
                    onClick={loadLinearKitchen}
                    className="w-full text-left p-3 rounded-lg bg-slate-950/80 hover:bg-slate-800/80 border border-slate-800 hover:border-blue-500/50 transition-all group"
                  >
                    <div className="font-semibold text-slate-200 group-hover:text-blue-400">
                      Doğrusal Mutfak Yerleşimi (3.2m)
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 leading-snug">
                      Evye altı + 3 çekmeceli alt modül + boy kiler dolabı + 2 üst dolap
                    </div>
                  </button>
                </div>
              </>
            )}

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
                          <div className="flex items-center gap-2.5">
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
                          <div className="flex items-center gap-2.5">
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
          </div>
        </aside>

        {/* CENTER VIEWPORT (CANVAS / 2D / 3D) */}
        <main className="flex-1 relative bg-slate-950 overflow-hidden">
          {viewMode === "3d" && <ThreeCanvas />}
          {viewMode === "2d_elevation" && <Elevation2D />}
          {viewMode === "2d_plan" && <TopPlan2D />}
        </main>

        {/* RIGHT SIDEBAR: PARAMETRİK ÖZELLİKLER & BÖLME YÖNETİMİ */}
        <aside className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col shrink-0 z-20">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-amber-400" />
              Parametrik Özellikler
            </h2>
            <span className="text-[11px] text-slate-400 font-mono">
              {activeMod.name}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
            {/* Dimensions Control */}
            <div className="space-y-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
              <h3 className="font-semibold text-slate-300 text-[11px] uppercase tracking-wider">
                Ana Gövde Ölçüleri (mm)
              </h3>

              {/* Width */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-400">Genişlik (W):</span>
                  <span className="font-mono text-amber-400 font-bold">{width} mm</span>
                </div>
                <input
                  type="range"
                  min={400}
                  max={3000}
                  step={50}
                  value={width}
                  onChange={(e) => setDimensions(Number(e.target.value), height, depth)}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              {/* Height */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-400">Yükseklik (H):</span>
                  <span className="font-mono text-amber-400 font-bold">{height} mm</span>
                </div>
                <input
                  type="range"
                  min={500}
                  max={2800}
                  step={50}
                  value={height}
                  onChange={(e) => setDimensions(width, Number(e.target.value), depth)}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              {/* Depth */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-400">Derinlik (D):</span>
                  <span className="font-mono text-amber-400 font-bold">{depth} mm</span>
                </div>
                <input
                  type="range"
                  min={300}
                  max={800}
                  step={10}
                  value={depth}
                  onChange={(e) => setDimensions(width, height, Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              {/* Plinth */}
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
                  {[1, 2, 3, 4].map((cnt) => (
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
                      {/* Door Type Selector */}
                      <select
                        value={bay.door.type}
                        onChange={(e) =>
                          setBayDoorType(
                            bayIdx,
                            e.target.value as "single_left" | "single_right" | "double" | "open"
                          )
                        }
                        className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-[11px] focus:outline-none focus:border-amber-500"
                      >
                        <option value="open">Açık (Kapak Yok)</option>
                        <option value="single_left">Tek Kapak (Sol)</option>
                        <option value="single_right">Tek Kapak (Sağ)</option>
                        <option value="double">Çift Kapak</option>
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
            <span className="text-slate-400">Panel Sayısı: </span>
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
            <span className="text-slate-400">Hırdavat: </span>
            <span className="font-mono text-emerald-400 font-bold">{bom.summary.totalHardwareCount} adet</span>
          </div>
        </div>

        {/* Pricing Display */}
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
            onClick={() => setIsBomOpen(true)}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold shadow-md transition-colors"
          >
            Siparişi Hazırla
          </button>
        </div>
      </footer>

      {/* Modals */}
      <BomModal isOpen={isBomOpen} onClose={() => setIsBomOpen(false)} />
      <StoreErpModal isOpen={isStoreErpOpen} onClose={() => setIsStoreErpOpen(false)} />
    </div>
  );
}
