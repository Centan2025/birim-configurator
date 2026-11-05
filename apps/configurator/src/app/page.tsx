"use client";

import React, { useState, useEffect } from "react";
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
import { ProjectSaveLoadModal } from "../components/ProjectSaveLoadModal";
import { EasyInspector } from "../components/EasyInspector";
import { TechnicalInspector } from "../components/TechnicalInspector";
import {
  Undo,
  Redo,
  Box,
  Layers,
  FileSpreadsheet,
  Network,
  RotateCcw,
  Eye,
  Settings2,
  Package,
  Sparkles,
  Scissors,
  CheckCircle,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  Zap,
  Wrench,
  DoorOpen,
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
  const [isProjectsModalOpen, setIsProjectsModalOpen] = useState(false);
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [leftTab, setLeftTab] = useState<"templates" | "materials" | "advisor">("templates");
  const [approvalMessage, setApprovalMessage] = useState<string | null>(null);

  // Store hooks
  const project = useConfiguratorStore((s) => s.project);
  const activeModIndex = useConfiguratorStore((s) => s.activeModuleIndex);
  const viewMode = useConfiguratorStore((s) => s.viewMode);
  const setViewMode = useConfiguratorStore((s) => s.setViewMode);
  const uiMode = useConfiguratorStore((s) => s.uiMode);
  const setUiMode = useConfiguratorStore((s) => s.setUiMode);
  const pricing = useConfiguratorStore((s) => s.pricing);
  const history = useConfiguratorStore((s) => s.history);
  const future = useConfiguratorStore((s) => s.future);
  const undo = useConfiguratorStore((s) => s.undo);
  const redo = useConfiguratorStore((s) => s.redo);
  const toggleDoorOpen = useConfiguratorStore((s) => s.toggleDoorOpen);
  const doorOpenAngleDeg = useConfiguratorStore((s) => s.doorOpenAngleDeg);
  const setMaterials = useConfiguratorStore((s) => s.setMaterials);
  const approveProduction = useConfiguratorStore((s) => s.approveProduction);
  const applySmartSpan = useConfiguratorStore((s) => s.applySmartSpan);
  const applyTemplate = useConfiguratorStore((s) => s.applyTemplate);
  const loadLinearKitchen = useConfiguratorStore((s) => s.loadLinearKitchen);
  const loadLKitchen = useConfiguratorStore((s) => s.loadLKitchen);
  const loadUKitchen = useConfiguratorStore((s) => s.loadUKitchen);
  const resetToDefault = useConfiguratorStore((s) => s.resetToDefault);
  const autoSaveStatus = useConfiguratorStore((s) => s.autoSaveStatus);

  const activeMod = project.modules[activeModIndex] || project.modules[0];
  const { width } = activeMod.dimensions;

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if (e.key === "1") {
        setViewMode("3d");
      } else if (e.key === "2") {
        setViewMode("2d_elevation");
      } else if (e.key === "3") {
        setViewMode("2d_plan");
      } else if (e.key === "4") {
        setViewMode("2d_section");
      } else if (e.key === " " && !e.repeat) {
        e.preventDefault();
        toggleDoorOpen();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo, setViewMode, toggleDoorOpen]);

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
        {/* Brand & Project Info */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center font-black text-slate-950 text-base shadow-md">
            B
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-tight text-white">BİRİM CONFIGURATOR V2</h1>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono font-medium">
                V2.5 Pro
              </span>
              {project.status === "production_approved" && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono font-bold flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Üretim Onaylı
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span>{project.title}</span>
              <span>•</span>
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                {autoSaveStatus === "saved" ? "Kaydedildi" : autoSaveStatus === "saving" ? "Kaydediliyor..." : "Kaydedilmedi"}
              </span>
            </div>
          </div>
        </div>

        {/* Center: Mode Switcher (⚡ Kolay Tasarım vs 🛠 Teknik Düzenleme) */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 shadow-inner">
          <button
            onClick={() => setUiMode("simple")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              uiMode === "simple"
                ? "bg-amber-600 text-white shadow-md"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            Kolay Tasarım (Mağaza)
          </button>
          <button
            onClick={() => setUiMode("technical")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              uiMode === "technical"
                ? "bg-blue-600 text-white shadow-md"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            Teknik Düzenleme (Mühendislik)
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center bg-slate-950/80 rounded-lg border border-slate-800 p-0.5 mr-1">
            <button
              onClick={undo}
              disabled={history.length === 0}
              title="Geri Al (Ctrl+Z)"
              className="p-1.5 rounded hover:bg-slate-800 text-slate-300 disabled:opacity-30 transition"
            >
              <Undo className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={redo}
              disabled={future.length === 0}
              title="Yinele (Ctrl+Y)"
              className="p-1.5 rounded hover:bg-slate-800 text-slate-300 disabled:opacity-30 transition"
            >
              <Redo className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={() => setIsProjectsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 font-medium transition-colors"
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
            Projeler / Kayıtlar
          </button>

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
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 ml-1 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Approval Notification Banner */}
      {approvalMessage && (
        <div className="bg-emerald-600/90 text-white px-4 py-2 text-xs font-semibold flex items-center justify-between z-30 shadow-md">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            <span>{approvalMessage}</span>
          </div>
          <button onClick={() => setApprovalMessage(null)} className="text-white/80 hover:text-white">✕</button>
        </div>
      )}

      {/* 2. MAIN WORKSPACE */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* LEFT DOCK / SIDEBAR */}
        <div
          className={`transition-all duration-300 ease-in-out border-r border-slate-800 bg-slate-900/95 flex flex-col z-20 shrink-0 ${
            isLeftPanelOpen ? "w-72" : "w-12"
          }`}
        >
          {/* Dock Header & Toggle */}
          <div className="h-10 border-b border-slate-800 flex items-center justify-between px-3 bg-slate-950/80">
            {isLeftPanelOpen ? (
              <span className="font-bold text-slate-300 text-xs uppercase tracking-wider">Kütüphane</span>
            ) : (
              <span className="text-xs text-slate-500 font-mono">•••</span>
            )}
            <button
              onClick={() => setIsLeftPanelOpen(!isLeftPanelOpen)}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title={isLeftPanelOpen ? "Paneli Daralt" : "Paneli Genişlet"}
            >
              {isLeftPanelOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>

          {/* Dock Tabs */}
          <div className="flex border-b border-slate-800 bg-slate-950 text-xs">
            <button
              onClick={() => { setLeftTab("templates"); setIsLeftPanelOpen(true); }}
              className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 transition ${
                leftTab === "templates" ? "text-amber-400 border-b-2 border-amber-500 font-bold bg-slate-900/60" : "text-slate-400 hover:text-slate-200"
              }`}
              title="Şablonlar"
            >
              <Package className="w-3.5 h-3.5" />
              {isLeftPanelOpen && <span>Şablonlar</span>}
            </button>
            <button
              onClick={() => { setLeftTab("materials"); setIsLeftPanelOpen(true); }}
              className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 transition ${
                leftTab === "materials" ? "text-amber-400 border-b-2 border-amber-500 font-bold bg-slate-900/60" : "text-slate-400 hover:text-slate-200"
              }`}
              title="Malzemeler"
            >
              <Settings2 className="w-3.5 h-3.5" />
              {isLeftPanelOpen && <span>Malzemeler</span>}
            </button>
            <button
              onClick={() => { setLeftTab("advisor"); setIsLeftPanelOpen(true); }}
              className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 transition ${
                leftTab === "advisor" ? "text-amber-400 border-b-2 border-amber-500 font-bold bg-slate-900/60" : "text-slate-400 hover:text-slate-200"
              }`}
              title="Akıllı Danışman"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isLeftPanelOpen && <span>Danışman</span>}
            </button>
          </div>

          {/* Left Panel Body */}
          {isLeftPanelOpen && (
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
                      Mutfak Mekân Şablonları
                    </h3>
                    <div className="space-y-2">
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
                      <button
                        onClick={loadLKitchen}
                        className="w-full text-left p-3 rounded-lg bg-slate-950/80 hover:bg-slate-800/80 border border-slate-800 hover:border-blue-500/50 transition-all group"
                      >
                        <div className="font-semibold text-slate-200 group-hover:text-blue-400">
                          L Tipi Mutfak (2.4m x 2.4m)
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1 leading-snug">
                          Kör köşe alt dolap, ocak & evye modülleri ve duvar üst üniteleri
                        </div>
                      </button>
                      <button
                        onClick={loadUKitchen}
                        className="w-full text-left p-3 rounded-lg bg-slate-950/80 hover:bg-slate-800/80 border border-slate-800 hover:border-blue-500/50 transition-all group"
                      >
                        <div className="font-semibold text-slate-200 group-hover:text-blue-400">
                          U Tipi Mutfak (2.4m x 3.0m x 2.4m)
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1 leading-snug">
                          Çift köşe dönüşlü U hat, ada ünitesi, boy kiler ve tam donanım
                        </div>
                      </button>
                    </div>
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
                      <span>Akıllı Açıklık & Sehim Danışmanı</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Mevcut açıklık: <strong className="text-amber-400">{width} mm</strong>
                    </p>
                    {width > 1200 && (
                      <div className="space-y-2">
                        <p className="text-[11px] text-amber-300/90 leading-relaxed">
                          1200mm üzeri açıklıklarda raflarda zamanla sehim (eğilme) riski oluşur. Otomatik ara dikme bölünmesi önerilir.
                        </p>
                        <button
                          onClick={() => applySmartSpan(width)}
                          className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold shadow transition"
                        >
                          Otomatik Ara Dikme Ekle
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* CENTER VIEWPORT (CANVAS / 2D VIEWS) */}
        <div className="flex-1 relative flex flex-col overflow-hidden bg-slate-950">
          {viewMode === "3d" && <ThreeCanvas />}
          {viewMode === "2d_elevation" && <Elevation2D />}
          {viewMode === "2d_plan" && <TopPlan2D />}
          {viewMode === "2d_section" && renderSectionView()}

          {/* Floating View Switcher & Quick Tool Overlay */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-slate-950/85 backdrop-blur-md p-1.5 rounded-xl border border-slate-800 shadow-2xl">
            <button
              onClick={() => setViewMode("3d")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                viewMode === "3d" ? "bg-amber-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              3D WebGL
            </button>
            <button
              onClick={() => setViewMode("2d_elevation")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                viewMode === "2d_elevation" ? "bg-amber-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              2D Ön Görünüş
            </button>
            <button
              onClick={() => setViewMode("2d_plan")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                viewMode === "2d_plan" ? "bg-amber-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              2D Üst Plan
            </button>
            <button
              onClick={() => setViewMode("2d_section")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                viewMode === "2d_section" ? "bg-amber-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Scissors className="w-3.5 h-3.5" />
              2D Kesit
            </button>

            <div className="h-4 w-px bg-slate-800 mx-1"></div>

            {/* Quick Door Toggle Button */}
            <button
              onClick={toggleDoorOpen}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                doorOpenAngleDeg > 0 ? "bg-blue-600 text-white" : "bg-slate-900 text-slate-300 hover:bg-slate-800"
              }`}
              title="Kapakları Aç/Kapa (Space)"
            >
              <DoorOpen className="w-3.5 h-3.5" />
              <span>{doorOpenAngleDeg > 0 ? "Kapakları Kapat" : "Kapakları Aç"}</span>
            </button>
          </div>
        </div>

        {/* RIGHT INSPECTOR (EASY VS TECHNICAL) */}
        <div
          className={`transition-all duration-300 ease-in-out border-l border-slate-800 bg-slate-900/95 flex flex-col z-20 shrink-0 ${
            isRightPanelOpen ? "w-84" : "w-12"
          }`}
          style={{ width: isRightPanelOpen ? "340px" : "48px" }}
        >
          {/* Panel Header & Toggle */}
          <div className="h-10 border-b border-slate-800 flex items-center justify-between px-3 bg-slate-950/80">
            <button
              onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title={isRightPanelOpen ? "Paneli Daralt" : "Paneli Genişlet"}
            >
              {isRightPanelOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
            {isRightPanelOpen && (
              <span className="font-bold text-slate-300 text-xs uppercase tracking-wider">
                {uiMode === "simple" ? "Kolay Tasarım Paneli" : "Teknik Mühendislik Paneli"}
              </span>
            )}
          </div>

          {/* Panel Content */}
          {isRightPanelOpen && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {uiMode === "simple" ? (
                <EasyInspector />
              ) : (
                <TechnicalInspector
                  onOpenBom={() => setIsBomOpen(true)}
                  onOpenStoreErp={() => setIsStoreErpOpen(true)}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* 3. BOTTOM SUMMARY & PRICE BAR */}
      <footer className="h-16 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 flex items-center justify-between px-6 shrink-0 z-30">
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <span className="text-slate-500">Kabin Boyutu:</span>
            <span className="font-mono text-amber-400 font-bold">{width} x {activeMod.dimensions.height} x {activeMod.dimensions.depth} mm</span>
          </div>
          <span className="text-slate-700">•</span>
          <div className="flex items-center gap-2 text-slate-300">
            <span className="text-slate-500">Bölmeler:</span>
            <span className="font-semibold text-slate-200">{activeMod.bays.length} Bölme</span>
          </div>
          <span className="text-slate-700">•</span>
          <div className="flex items-center gap-2 text-slate-300">
            <span className="text-slate-500">Gövde Malzemesi:</span>
            <span className="text-slate-200">Melamin / Lake</span>
          </div>
        </div>

        {/* Pricing Display & Actions */}
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
            className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md transition-colors"
          >
            <CheckCircle className="w-4 h-4" />
            Üretime Onayla
          </button>

          <button
            onClick={() => setIsBomOpen(true)}
            className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-md transition-colors"
          >
            BOM & Kesim Gör
          </button>
        </div>
      </footer>

      {/* Modals */}
      <BomModal isOpen={isBomOpen} onClose={() => setIsBomOpen(false)} />
      <StoreErpModal isOpen={isStoreErpOpen} onClose={() => setIsStoreErpOpen(false)} />
      <ProjectSaveLoadModal isOpen={isProjectsModalOpen} onClose={() => setIsProjectsModalOpen(false)} />
    </div>
  );
}
