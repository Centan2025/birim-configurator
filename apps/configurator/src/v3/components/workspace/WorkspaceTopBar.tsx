"use client";

import React, { startTransition, useEffect, useRef, useState } from "react";
import { V3BrandBadge } from "../../design-system";
import type { UserExperienceTier } from "../../../store/useConfiguratorStore";
import {
  Undo,
  Redo,
  Maximize2,
  Sparkles,
  FileSpreadsheet,
  FolderOpen,
  AlertTriangle,
  CheckCircle,
  LayoutGrid,
  Smartphone,
  Box,
  Compass,
  Eye,
  User,
  DraftingCompass,
  Factory,
  Square,
  Scissors,
  Grid,
  ReceiptText,
  SlidersHorizontal,
  Columns2,
  ScanLine,
  Wrench,
  Camera,
  Zap,
  Clock,
  Share2,
  ChevronDown,
} from "lucide-react";

interface WorkspaceTopBarProps {
  projectTitle: string;
  mode: "studio" | "plan" | "showroom";
  studioView: "3d" | "2d";
  studio2DMode: "elevation" | "section" | "plan";
  studioSplitView?: boolean;
  cncXrayMode?: boolean;
  experienceTier: UserExperienceTier;
  leadTimeLabel?: string;
  livePriceLabel?: string;
  canUndo: boolean;
  canRedo: boolean;
  canApproveProduction: boolean;
  humanCompatStatusLabel: string;
  floating?: boolean;
  onOpenProjectModal: () => void;
  onOpenStepWizard: () => void;
  onOpenQuickSell: () => void;
  onOpenBomModal: () => void;
  onOpenStoreErpModal?: () => void;
  onOpenMepModal?: () => void;
  onOpenAssemblyModal?: () => void;
  onOpenStudioRenderModal?: () => void;
  onOpenCustomHardwareModal?: () => void;
  onOpenIslandTableModal?: () => void;
  onOpenSceneHubModal?: () => void;
  onOpenVisualCatalog: () => void;
  onOpenArAnd3DModal?: () => void;
  onOpenRulesModal: () => void;
  onOpenAdminModal: () => void;
  onChangeExperienceTier: (tier: UserExperienceTier) => void;
  onSetMode: (mode: "studio" | "plan" | "showroom") => void;
  onSetStudioView: (view: "3d" | "2d", mode2d?: "elevation" | "section" | "plan") => void;
  onToggleStudioSplitView?: () => void;
  onToggleCncXrayMode?: () => void;
  onSetCameraPreset: (preset: "front" | "side" | "top" | "iso") => void;
  onToggleDimensions: () => void;
  onEnterZenShowroom: () => void;
  onUndo: () => void;
  onRedo: () => void;
}

export const WorkspaceTopBar: React.FC<WorkspaceTopBarProps> = React.memo(({
  projectTitle,
  mode,
  studioView,
  studio2DMode,
  studioSplitView = false,
  cncXrayMode = false,
  experienceTier,
  leadTimeLabel,
  livePriceLabel,
  canUndo,
  canRedo,
  canApproveProduction,
  humanCompatStatusLabel,
  floating = true,
  onOpenProjectModal,
  onOpenStepWizard,
  onOpenQuickSell,
  onOpenBomModal,
  onOpenStoreErpModal,
  onOpenMepModal,
  onOpenAssemblyModal,
  onOpenStudioRenderModal,
  onOpenSceneHubModal,
  onOpenVisualCatalog,
  onOpenArAnd3DModal,
  onOpenRulesModal,
  onOpenAdminModal,
  onChangeExperienceTier,
  onSetMode,
  onSetStudioView,
  onToggleStudioSplitView,
  onToggleCncXrayMode,
  onSetCameraPreset,
  onToggleDimensions,
  onEnterZenShowroom,
  onUndo,
  onRedo,
}) => {
  const isCustomerMode = experienceTier === "simple";
  const isFactoryMode = experienceTier === "factory";
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
  const toolsMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!toolsMenuOpen) return;
    const handleOutside = (ev: MouseEvent) => {
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(ev.target as Node)) {
        setToolsMenuOpen(false);
      }
    };
    const handleEsc = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setToolsMenuOpen(false);
    };
    window.addEventListener("mousedown", handleOutside);
    window.addEventListener("keydown", handleEsc);
    return () => {
      window.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("keydown", handleEsc);
    };
  }, [toolsMenuOpen]);

  return (
    <header
      className={
        floating
          ? "absolute top-2.5 left-3.5 right-3.5 h-[48px] bg-transparent pointer-events-none flex items-center justify-between gap-2 z-40"
          : "h-[52px] bg-transparent px-3.5 pt-2 pb-1 flex items-center justify-between gap-2 shrink-0 z-40"
      }
    >
      {/* 1. Sol Kapsül: Marka + Proje Kayıt/QR Paylaşım + Kurulum Sihirbazı */}
      <div className="pointer-events-auto inline-flex items-center gap-1.5 p-1 rounded-[22px] birim-ice-pill min-w-0">
        <div className="pl-2 pr-0.5">
          <V3BrandBadge subtitle="V6.6" dark={false} />
        </div>

        <div className="h-4 w-px bg-slate-900/10 mx-0.5 hidden sm:block" />

        <button
          type="button"
          onClick={onOpenProjectModal}
          data-tooltip={`Proje Kayıt & Mobil QR Paylaşım — "${projectTitle}" tasarımını kaydedin, yükleyin veya QR/link ile paylaşın.`}
          data-tooltip-badge="PROJE & PAYLAŞIM"
          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-2xl birim-ice-btn text-xs text-[#141413] cursor-pointer max-w-[185px]"
        >
          {isCustomerMode ? (
            <Share2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
          ) : (
            <FolderOpen className="w-3.5 h-3.5 text-[#8C7A6B] shrink-0" />
          )}
          <span
            data-testid="v3-project-title"
            className="font-semibold text-[11px] text-[#141413] truncate hidden sm:inline"
          >
            {projectTitle}
          </span>
          <Share2 className="w-3 h-3 text-emerald-700/80 shrink-0 hidden md:inline" />
        </button>

        {/* Legacy test hook preserved without visual duplication */}
        <button
          type="button"
          data-testid="topbar-share-qr-btn"
          onClick={onOpenProjectModal}
          className="sr-only"
        >
          Paylaş
        </button>

        <button
          type="button"
          data-testid="open-step-wizard-btn"
          onClick={onOpenStepWizard}
          className="h-8 w-8 sm:w-auto sm:px-3 rounded-2xl font-semibold text-[11px] inline-flex items-center justify-center gap-1.5 birim-ice-charcoal-pill cursor-pointer shrink-0"
          data-tooltip="4 Adımda Akıllı Kurulum Sihirbazı"
          aria-label="Kolay Sihirbaz"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#E5D3B8]" />
          <span className="hidden lg:inline">Sihirbaz</span>
        </button>

        {isCustomerMode && leadTimeLabel && (
          <div
            data-testid="customer-lead-time-pill"
            data-tooltip="Seçilen gövde/kapak malzemesine göre gerçek fabrika üretim ve teslimat termin tahmini."
            data-tooltip-badge="TESLİMAT TERMİNİ"
            className="hidden xl:inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-emerald-600/12 text-emerald-900 text-[10px] font-bold"
          >
            <Clock className="w-3 h-3 text-emerald-700 shrink-0" />
            <span>Termin: {leadTimeLabel}</span>
          </div>
        )}
      </div>

      {/* 2. Orta Kapsül: Ana Çalışma Aşaması (3D / Odam / Sunum) + Teknik Görünüm Modu */}
      <div className="pointer-events-auto flex items-center gap-1.5">
        <nav
          aria-label="Tasarım Aşaması"
          data-testid="v3-mode-switcher"
          className="inline-flex items-center p-1 rounded-[22px] birim-ice-pill text-xs gap-0.5"
        >
          {[
            { id: "studio" as const, short: "Tasarım", full: "3D & 2D Modül Tasarım Sahnesi", testId: "v3-mode-studio", Icon: Box },
            { id: "plan" as const, short: isCustomerMode ? "Odam" : "Oda Planı", full: "Oda & Yerleşim Planı", testId: "v3-mode-plan", Icon: Compass },
            { id: "showroom" as const, short: "Sunum", full: "Tam Ekran Müşteri Sunumu", testId: "v3-mode-showroom", Icon: Eye },
          ].map((item) => {
            const active = mode === item.id;
            const ItemIcon = item.Icon;
            return (
              <button
                key={item.id}
                type="button"
                data-testid={item.testId}
                data-tooltip={item.full}
                onClick={() => {
                  startTransition(() => {
                    onSetMode(item.id);
                  });
                }}
                className={`h-8 px-3 rounded-2xl font-semibold inline-flex items-center gap-1.5 transition cursor-pointer ${
                  active
                    ? "birim-ice-charcoal-pill"
                    : "text-[#44403C] hover:text-[#141413] hover:bg-white/65"
                }`}
              >
                <ItemIcon className="w-3.5 h-3.5 shrink-0" />
                <span className="text-[11px]">{item.short}</span>
                <span className="sr-only">{item.full}</span>
              </button>
            );
          })}
        </nav>

        {mode === "studio" && (
          <div
            data-testid="studio-view-switcher"
            className={`${
              isCustomerMode ? "sr-only" : "inline-flex"
            } items-center p-1 rounded-[22px] birim-ice-pill gap-0.5 birim-expand-all-group`}
          >
            <button
              type="button"
              data-testid="studio-view-3d"
              data-active={studioView === "3d" && !studioSplitView ? "true" : "false"}
              data-tooltip="3D Perspektif Sahne"
              onClick={() => {
                if (studioSplitView && onToggleStudioSplitView) onToggleStudioSplitView();
                onSetStudioView("3d");
                onSetCameraPreset("iso");
              }}
              className={`h-8 rounded-2xl birim-expand-btn cursor-pointer ${
                studioView === "3d" && !studioSplitView
                  ? "birim-ice-charcoal-pill"
                  : "text-[#57534E] hover:text-[#141413] hover:bg-white/65"
              }`}
            >
              <Box className="w-3.5 h-3.5 shrink-0" />
              <span className="birim-expand-label">3D</span>
            </button>

            <button
              type="button"
              data-testid="studio-view-2d"
              data-active={studioView === "2d" && studio2DMode === "elevation" && !studioSplitView ? "true" : "false"}
              data-tooltip="2D Ön Cephe Teknik Görünüş"
              onClick={() => {
                if (studioSplitView && onToggleStudioSplitView) onToggleStudioSplitView();
                onSetStudioView("2d", "elevation");
              }}
              className={`h-8 rounded-2xl birim-expand-btn cursor-pointer ${
                studioView === "2d" && studio2DMode === "elevation" && !studioSplitView
                  ? "birim-ice-charcoal-pill"
                  : "text-[#57534E] hover:text-[#141413] hover:bg-white/65"
              }`}
            >
              <Square className="w-3.5 h-3.5 shrink-0" />
              <span className="birim-expand-label">Cephe</span>
            </button>

            <button
              type="button"
              data-testid="studio-view-2d-section"
              data-active={studioView === "2d" && studio2DMode === "section" && !studioSplitView ? "true" : "false"}
              data-tooltip="2D Yan Kesit Görünüş"
              onClick={() => {
                if (studioSplitView && onToggleStudioSplitView) onToggleStudioSplitView();
                onSetStudioView("2d", "section");
              }}
              className={`h-8 rounded-2xl birim-expand-btn cursor-pointer ${
                studioView === "2d" && studio2DMode === "section" && !studioSplitView
                  ? "birim-ice-charcoal-pill"
                  : "text-[#57534E] hover:text-[#141413] hover:bg-white/65"
              }`}
            >
              <Scissors className="w-3.5 h-3.5 shrink-0" />
              <span className="birim-expand-label">Kesit</span>
            </button>

            {/* Keep studio-view-2d-plan hook sr-only so it doesn't duplicate main 'Oda Planı' button right beside it */}
            <button
              type="button"
              data-testid="studio-view-2d-plan"
              onClick={() => {
                if (studioSplitView && onToggleStudioSplitView) onToggleStudioSplitView();
                onSetStudioView("2d", "plan");
              }}
              className="sr-only"
            >
              <Grid className="w-3.5 h-3.5 shrink-0" />
              <span>Plan</span>
            </button>

            {onToggleStudioSplitView && (
              <button
                type="button"
                data-testid="studio-view-split"
                data-active={studioSplitView ? "true" : "false"}
                data-tooltip="Bölünmüş 3D + 2D CAD Ekranı"
                onClick={() => {
                  if (!studioSplitView) {
                    onSetStudioView("3d");
                  }
                  onToggleStudioSplitView();
                }}
                className={`h-8 rounded-2xl birim-expand-btn cursor-pointer ${
                  studioSplitView
                    ? "birim-ice-charcoal-pill"
                    : "text-[#57534E] hover:text-[#141413] hover:bg-white/65"
                }`}
              >
                <Columns2 className="w-3.5 h-3.5 shrink-0" />
                <span className="birim-expand-label">2D|3D</span>
              </button>
            )}

            {onToggleCncXrayMode && (
              <>
                <div className={isFactoryMode ? "h-4 w-px bg-slate-900/10 mx-0.5" : "sr-only"} />
                <button
                  type="button"
                  data-testid="studio-toggle-xray"
                  data-active={cncXrayMode ? "true" : "false"}
                  data-tooltip="CNC X-Ray Delik & Bağlantı Görünümü"
                  onClick={onToggleCncXrayMode}
                  className={`${
                    isFactoryMode ? "inline-flex" : "sr-only"
                  } h-8 rounded-2xl birim-expand-btn cursor-pointer ${
                    cncXrayMode
                      ? "bg-sky-600 text-white shadow-sm"
                      : "text-[#57534E] hover:text-[#141413] hover:bg-white/65"
                  }`}
                >
                  <ScanLine className="w-3.5 h-3.5 shrink-0" />
                  <span className="birim-expand-label">CNC X-Ray</span>
                </button>
              </>
            )}

            <button
              type="button"
              data-testid="studio-view-3d-front"
              className="hidden"
              onClick={() => {
                onSetStudioView("3d");
                onSetCameraPreset("front");
              }}
            >
              Ön
            </button>
            <button
              type="button"
              data-testid="studio-view-3d-side"
              className="hidden"
              onClick={() => {
                onSetStudioView("3d");
                onSetCameraPreset("side");
              }}
            >
              Yan
            </button>
            <button
              type="button"
              data-testid="studio-view-3d-top"
              className="hidden"
              onClick={() => {
                onSetStudioView("3d");
                onSetCameraPreset("top");
              }}
            >
              Üst
            </button>
            <button
              type="button"
              data-testid="studio-toggle-dimensions"
              className="hidden"
              onClick={onToggleDimensions}
            >
              Ölçü
            </button>
          </div>
        )}
      </div>

      {/* 3. Sağ Kapsüller: Rol Modu + Geri/İleri + Çıktı/Standartlar/Üretim + Teklif CTA */}
      <div className="pointer-events-auto flex items-center gap-1.5 shrink-0">
        <div
          role="group"
          aria-label="Kullanıcı Deneyim Seviyesi"
          className="inline-flex items-center p-1 rounded-[22px] birim-ice-pill gap-0.5 birim-expand-all-group"
        >
          {[
            { id: "simple" as const, short: "Müşteri", label: "Müşteri / Vitrin Modu — Sade ölçü (cm), malzeme, iç düzen, termin ve canlı fiyat sunar.", Icon: User },
            { id: "architect" as const, short: "Mimar", label: "İç Mimar Modu — 2D cephe/kesit, şantiye MEP paftası, donanım ve AutoCAD .DXF araçlarını açar.", Icon: DraftingCompass },
            { id: "factory" as const, short: "Üretim", label: "Üretici / CNC Modu — CNC X-Ray delik kontrolü, plaka nesting, barkod etiketi ve ERP üretim emrini açar.", Icon: Factory },
          ].map((tier) => {
            const active = experienceTier === tier.id;
            const TierIcon = tier.Icon;
            return (
              <button
                key={tier.id}
                type="button"
                data-active={active ? "true" : "false"}
                data-tooltip={tier.label}
                data-tooltip-badge="AKTİF ROL MODU"
                data-testid={
                  tier.id === "architect"
                    ? "toggle-simple-blum-mode-btn"
                    : `experience-tier-${tier.id}`
                }
                onClick={() =>
                  onChangeExperienceTier(active && tier.id === "architect" ? "simple" : tier.id)
                }
                className={`h-8 px-2.5 rounded-2xl inline-flex items-center gap-1.5 font-bold text-[11px] transition cursor-pointer ${
                  active
                    ? "birim-ice-charcoal-pill"
                    : "text-[#57534E] hover:text-[#141413] hover:bg-white/65"
                }`}
              >
                <TierIcon className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">{tier.short}</span>
                <span className="sr-only">{tier.label}</span>
              </button>
            );
          })}
        </div>

        <div className="hidden sm:inline-flex items-center rounded-[22px] birim-ice-pill p-1 gap-0.5">
          <button
            type="button"
            data-testid="v3-undo-btn"
            onClick={onUndo}
            disabled={!canUndo}
            data-tooltip="Geri Al (Ctrl+Z)"
            className="w-8 h-8 rounded-2xl flex items-center justify-center text-[#44403C] hover:text-[#141413] hover:bg-white/75 disabled:opacity-30 cursor-pointer"
          >
            <Undo className="w-3.5 h-3.5 shrink-0" />
            <span className="sr-only">Geri</span>
          </button>
          <button
            type="button"
            data-testid="v3-redo-btn"
            onClick={onRedo}
            disabled={!canRedo}
            data-tooltip="İleri Al (Ctrl+Y)"
            className="w-8 h-8 rounded-2xl flex items-center justify-center text-[#44403C] hover:text-[#141413] hover:bg-white/75 disabled:opacity-30 cursor-pointer"
          >
            <Redo className="w-3.5 h-3.5 shrink-0" />
            <span className="sr-only">İleri</span>
          </button>
        </div>

        {/* Standartlaştırılmış Çıktı, Standartlar & Üretim Kapsülü (Sıfır Tekrar!) */}
        <div ref={toolsMenuRef} className="relative inline-flex items-center rounded-[22px] birim-ice-pill p-1 gap-0.5">
          <button
            type="button"
            data-testid="topbar-studio-outputs-btn"
            onClick={() => setToolsMenuOpen((v) => !v)}
            data-tooltip="Render, 1:1 AR Görünüm, Montaj Şeması ve Teknik Pafta Araçları"
            className={`h-8 px-2.5 rounded-2xl inline-flex items-center gap-1.5 text-[11px] font-semibold transition cursor-pointer ${
              toolsMenuOpen
                ? "birim-ice-charcoal-pill"
                : "text-[#44403C] hover:text-[#141413] hover:bg-white/75"
            }`}
          >
            <Camera className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden lg:inline">Çıktı &amp; Stüdyo</span>
            <ChevronDown className="w-3 h-3 opacity-70 shrink-0" />
          </button>

          {toolsMenuOpen && (
            <div
              data-testid="topbar-studio-outputs-menu"
              className="absolute right-0 top-11 w-64 birim-ice-popover rounded-2xl p-2 z-50 space-y-1 text-xs shadow-2xl"
            >
              <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                Görselleştirme &amp; Sunum
              </div>
              {onOpenStudioRenderModal && (
                <button
                  type="button"
                  onClick={() => {
                    setToolsMenuOpen(false);
                    onOpenStudioRenderModal();
                  }}
                  className="w-full px-2.5 py-2 rounded-xl hover:bg-white/80 text-left font-semibold text-[#141413] flex items-center gap-2.5 cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5 text-[#57534E] shrink-0" />
                  <span>2K Fotoğraf &amp; Path-Trace Render</span>
                </button>
              )}
              {onOpenArAnd3DModal && (
                <button
                  type="button"
                  onClick={() => {
                    setToolsMenuOpen(false);
                    onOpenArAnd3DModal();
                  }}
                  className="w-full px-2.5 py-2 rounded-xl hover:bg-white/80 text-left font-semibold text-[#141413] flex items-center gap-2.5 cursor-pointer"
                >
                  <Smartphone className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  <span>Odamda Gör (1:1 AR &amp; .GLB)</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setToolsMenuOpen(false);
                  onEnterZenShowroom();
                }}
                className="w-full px-2.5 py-2 rounded-xl hover:bg-white/80 text-left font-semibold text-[#141413] flex items-center gap-2.5 cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5 text-[#57534E] shrink-0" />
                <span>Tam Ekran Kiosk Sunumu (F)</span>
              </button>

              {!isCustomerMode && (
                <>
                  <div className="h-px bg-slate-900/10 my-1" />
                  <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                    Teknik Pafta &amp; Parametreler
                  </div>
                  {onOpenAssemblyModal && (
                    <button
                      type="button"
                      onClick={() => {
                        setToolsMenuOpen(false);
                        onOpenAssemblyModal();
                      }}
                      className="w-full px-2.5 py-2 rounded-xl hover:bg-white/80 text-left font-semibold text-[#141413] flex items-center gap-2.5 cursor-pointer"
                    >
                      <Wrench className="w-3.5 h-3.5 text-[#57534E] shrink-0" />
                      <span>Montaj Şeması &amp; Kurulum Kılavuzu</span>
                    </button>
                  )}
                  {onOpenMepModal && (
                    <button
                      type="button"
                      onClick={() => {
                        setToolsMenuOpen(false);
                        onOpenMepModal();
                      }}
                      className="w-full px-2.5 py-2 rounded-xl hover:bg-white/80 text-left font-semibold text-[#141413] flex items-center gap-2.5 cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                      <span>Şantiye Elektrik &amp; Su (MEP) Paftası</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setToolsMenuOpen(false);
                      onOpenAdminModal();
                    }}
                    className="w-full px-2.5 py-2 rounded-xl hover:bg-white/80 text-left font-semibold text-[#141413] flex items-center gap-2.5 cursor-pointer"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-[#57534E] shrink-0" />
                    <span>B1 Kütüphane &amp; Fiyat Parametreleri</span>
                  </button>
                </>
              )}
            </div>
          )}

          {/* Standartlar & Kurallar Merkezi */}
          <button
            type="button"
            data-testid="v3-engineering-badge"
            onClick={onOpenRulesModal}
            data-tooltip={`Standartlar & Kurallar Merkezi — Aktif EN/DIN/Birim standartlarını inceleyin veya yeni kural ekleyin (${humanCompatStatusLabel})`}
            data-tooltip-badge="STANDARTLAR & KURALLAR"
            className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-2xl text-[11px] font-semibold transition cursor-pointer ${
              canApproveProduction
                ? "bg-emerald-500/15 text-[#2E6F40] hover:bg-emerald-500/25"
                : "bg-amber-500/15 text-[#8C5A2B] hover:bg-amber-500/25"
            }`}
          >
            {canApproveProduction ? (
              <CheckCircle className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            )}
            <span className="hidden xl:inline">Standartlar</span>
            <span className="sr-only">{humanCompatStatusLabel}</span>
          </button>

          {/* Mimar & Üretim Modunda: BOM/CNC ve Store/ERP */}
          <button
            type="button"
            data-testid="open-bom-modal-btn"
            onClick={onOpenBomModal}
            data-tooltip="BOM Kesim & Bant Listesi, Nesting Plaka Şeması, CNC ve Barkod Etiketi"
            className={`${
              isCustomerMode ? "sr-only" : "inline-flex"
            } items-center gap-1.5 h-8 px-2.5 rounded-2xl text-[11px] font-semibold text-[#141413] bg-amber-500/15 hover:bg-amber-500/25 cursor-pointer`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#8C5A2B] shrink-0" />
            <span className="hidden xl:inline">BOM &amp; CNC</span>
          </button>

          {onOpenStoreErpModal && (
            <button
              type="button"
              data-testid="open-store-erp-rpc-btn"
              onClick={onOpenStoreErpModal}
              data-tooltip="Canlı Birim-Store Teklif ve Birim-Portal ERP Nesting Köprüsü"
              data-tooltip-badge="SUPABASE RPC"
              className={`${
                isCustomerMode ? "sr-only" : "inline-flex"
              } items-center gap-1.5 h-8 px-2.5 rounded-2xl text-[11px] font-semibold text-[#141413] bg-sky-500/15 hover:bg-sky-500/25 cursor-pointer`}
            >
              <Factory className="w-3.5 h-3.5 text-sky-800 shrink-0" />
              <span className="hidden 2xl:inline">ERP</span>
            </button>
          )}

          {/* Preserved E2E test hooks for consolidated items */}
          <div className="sr-only">
            <button type="button" data-testid="v4-header-catalog-btn" onClick={onOpenVisualCatalog}>Katalog</button>
            {onOpenArAnd3DModal && <button type="button" data-testid="open-ar-3d-modal-btn" onClick={onOpenArAnd3DModal}>AR</button>}
            {onOpenAssemblyModal && <button type="button" data-testid="open-assembly-diagram-header-btn" onClick={onOpenAssemblyModal}>Montaj</button>}
            {onOpenStudioRenderModal && <button type="button" data-testid="open-studio-render-header-btn" onClick={onOpenStudioRenderModal}>Render</button>}
            {onOpenMepModal && <button type="button" data-testid="open-mep-plan-header-btn" onClick={onOpenMepModal}>Tesisat MEP</button>}
            <button type="button" data-testid="showroom-zen-toggle" onClick={onEnterZenShowroom}>Sunum</button>
            {onOpenSceneHubModal && <button type="button" data-testid="open-v5-scene-hub-btn" onClick={onOpenSceneHubModal}>+ Modül &amp; Obje</button>}
            <button type="button" data-testid="v4-library-admin-btn" onClick={onOpenAdminModal}>B1 Kurallar</button>
          </div>
        </div>

        <button
          type="button"
          data-testid="open-quick-sell-header-btn"
          onClick={onOpenQuickSell}
          className="h-10 px-3.5 rounded-[22px] font-semibold text-[11px] inline-flex items-center gap-1.5 birim-ice-charcoal-pill cursor-pointer"
          data-tooltip="Müşteri Teklif & Sipariş Özeti — KDV, nakliye/montaj ve termin dahil teklif föyü."
          data-tooltip-badge="SATIŞ & TEKLİF"
        >
          <ReceiptText className="w-3.5 h-3.5 text-[#E5D3B8] shrink-0" />
          {livePriceLabel && (
            <span className="font-mono font-extrabold text-[#FAF9F6] tracking-tight">
              {livePriceLabel}
            </span>
          )}
          <span className="hidden xl:inline">
            {livePriceLabel ? `• ${isCustomerMode ? "Fiyat & Sipariş" : "Teklif"}` : isCustomerMode ? "Fiyat & Sipariş" : "Teklif"}
          </span>
        </button>
      </div>
    </header>
  );
});
WorkspaceTopBar.displayName = "WorkspaceTopBar";
