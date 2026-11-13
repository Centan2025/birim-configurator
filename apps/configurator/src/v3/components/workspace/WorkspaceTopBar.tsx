"use client";

import React, { startTransition } from "react";
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
  canUndo: boolean;
  canRedo: boolean;
  canApproveProduction: boolean;
  humanCompatStatusLabel: string;
  floating?: boolean;
  onOpenProjectModal: () => void;
  onOpenStepWizard: () => void;
  onOpenQuickSell: () => void;
  onOpenBomModal: () => void;
  onOpenMepModal?: () => void;
  onOpenAssemblyModal?: () => void;
  onOpenStudioRenderModal?: () => void;
  onOpenCustomHardwareModal?: () => void;
  onOpenIslandTableModal?: () => void;
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

export const WorkspaceTopBar: React.FC<WorkspaceTopBarProps> = ({
  projectTitle,
  mode,
  studioView,
  studio2DMode,
  studioSplitView = false,
  cncXrayMode = false,
  experienceTier,
  leadTimeLabel,
  canUndo,
  canRedo,
  canApproveProduction,
  humanCompatStatusLabel,
  floating = true,
  onOpenProjectModal,
  onOpenStepWizard,
  onOpenQuickSell,
  onOpenBomModal,
  onOpenMepModal,
  onOpenAssemblyModal,
  onOpenStudioRenderModal,
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

  return (
    <header
      className={
        floating
          ? "absolute top-2.5 left-3.5 right-3.5 h-[48px] bg-transparent pointer-events-none flex items-center justify-between gap-2 z-40"
          : "h-[52px] bg-transparent px-3.5 pt-2 pb-1 flex items-center justify-between gap-2 shrink-0 z-40"
      }
    >
      {/* Sol Yüzen Füme Cam Kapsülü: Marka + Proje/QR Paylaşım + Sihirbaz */}
      <div className="pointer-events-auto inline-flex items-center gap-1.5 p-1 rounded-[22px] birim-ice-pill min-w-0">
        <div className="pl-2 pr-0.5">
          <V3BrandBadge subtitle="V6.6" dark={false} />
        </div>

        <div className="h-4 w-px bg-slate-900/10 mx-0.5 hidden sm:block" />

        <button
          type="button"
          onClick={onOpenProjectModal}
          data-tooltip={`Proje Kayıt & Mobil QR Paylaşım — "${projectTitle}" tasarımını kaydedin veya QR/link ile telefonda açın.`}
          data-tooltip-badge="KAYIT & QR LİNK"
          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-2xl birim-ice-btn text-xs text-[#141413] cursor-pointer max-w-[165px]"
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

        <button
          type="button"
          data-testid="topbar-share-qr-btn"
          onClick={onOpenProjectModal}
          className="hidden md:inline-flex h-8 px-2.5 rounded-2xl font-semibold text-[11px] items-center justify-center gap-1.5 birim-ice-btn text-[#141413] cursor-pointer shrink-0"
          data-tooltip="Taşınabilir Proje Linki (#birim_share) & Mobil QR Paylaşım"
        >
          <Share2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
          <span>Paylaş</span>
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

      {/* Orta Yüzen Kapsüller: Müşteri Modunda Sadeleştirilmiş, Mimar/Üretim Modunda Tam CAD/X-Ray */}
      <div className="pointer-events-auto flex items-center gap-1.5">
        <nav
          aria-label="Tasarım Aşaması"
          data-testid="v3-mode-switcher"
          className="inline-flex items-center p-1 rounded-[22px] birim-ice-pill text-xs gap-0.5"
        >
          {[
            { id: "studio" as const, short: "3D", full: "3D Tasarım Sahnesi", testId: "v3-mode-studio", Icon: Box },
            { id: "plan" as const, short: isCustomerMode ? "Odam" : "Plan", full: "Oda & Yerleşim Planı", testId: "v3-mode-plan", Icon: Compass },
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

            <button
              type="button"
              data-testid="studio-view-2d-plan"
              data-active={studioView === "2d" && studio2DMode === "plan" && !studioSplitView ? "true" : "false"}
              data-tooltip="2D Üstten Kat Planı"
              onClick={() => {
                if (studioSplitView && onToggleStudioSplitView) onToggleStudioSplitView();
                onSetStudioView("2d", "plan");
              }}
              className={`h-8 rounded-2xl birim-expand-btn cursor-pointer ${
                studioView === "2d" && studio2DMode === "plan" && !studioSplitView
                  ? "birim-ice-charcoal-pill"
                  : "text-[#57534E] hover:text-[#141413] hover:bg-white/65"
              }`}
            >
              <Grid className="w-3.5 h-3.5 shrink-0" />
              <span className="birim-expand-label">Plan</span>
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
                <span className="birim-expand-label">2D|3D Bölünmüş</span>
              </button>
            )}

            {onOpenMepModal && (
              <button
                type="button"
                data-testid="open-mep-plan-header-btn"
                data-tooltip="Şantiye Elektrik & Sıhhi Tesisat Aks Paftası (Priz, Su, Gider, Baca + AutoCAD .DXF)"
                data-tooltip-badge="MİMARİ MEP PAFTASI"
                onClick={onOpenMepModal}
                className="h-8 rounded-2xl birim-expand-btn text-amber-900 bg-amber-500/15 hover:bg-amber-500/25 cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span className="birim-expand-label">Tesisat MEP</span>
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

      {/* Sağ Yüzen Füme Cam Aksiyon Kapsülleri: 3 Rol (Müşteri / Mimar / Üretim) Keskin Ayrımı */}
      <div className="pointer-events-auto flex items-center gap-1.5 shrink-0">
        <div
          role="group"
          aria-label="Kullanıcı Deneyim Seviyesi"
          className="inline-flex items-center p-1 rounded-[22px] birim-ice-pill gap-0.5 birim-expand-all-group"
        >
          {[
            { id: "simple" as const, short: "Müşteri", label: "Müşteri / Vitrin Modu — Mühendislik terimlerini gizler; malzeme, iç düzen, termin ve net fiyat sunar.", Icon: User },
            { id: "architect" as const, short: "Mimar", label: "İç Mimar Modu — 2D cephe/kesit, şantiye MEP elektrik/su paftası, ada & açılı masa ve AutoCAD .DXF araçlarını açar.", Icon: DraftingCompass },
            { id: "factory" as const, short: "Üretim", label: "Üretici / CNC Modu — CNC X-Ray delik kontrolü, plaka nesting, Zebra .ZPL barkod etiketi ve ERP üretim emrini açar.", Icon: Factory },
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

        <div className="hidden sm:inline-flex items-center rounded-[22px] birim-ice-pill p-1 gap-0.5 birim-expand-group">
          <button
            type="button"
            data-testid="v3-undo-btn"
            onClick={onUndo}
            disabled={!canUndo}
            data-tooltip="Geri Al — Son tasarım işlemini geri alır (50 adım geçmiş)."
            data-tooltip-shortcut="Ctrl+Z"
            className="h-8 rounded-2xl birim-expand-btn text-[#44403C] hover:text-[#141413] hover:bg-white/75 disabled:opacity-30 cursor-pointer"
          >
            <Undo className="w-3.5 h-3.5 shrink-0" />
            <span className="birim-expand-label">Geri</span>
          </button>
          <button
            type="button"
            data-testid="v3-redo-btn"
            onClick={onRedo}
            disabled={!canRedo}
            data-tooltip="İleri Al — Geri alınan işlemi yeniden uygular."
            data-tooltip-shortcut="Ctrl+Y"
            className="h-8 rounded-2xl birim-expand-btn text-[#44403C] hover:text-[#141413] hover:bg-white/75 disabled:opacity-30 cursor-pointer"
          >
            <Redo className="w-3.5 h-3.5 shrink-0" />
            <span className="birim-expand-label">İleri</span>
          </button>
        </div>

        <div className="inline-flex items-center rounded-[22px] birim-ice-pill p-1 gap-0.5 birim-expand-group">
          <button
            type="button"
            data-testid="v4-header-catalog-btn"
            onClick={onOpenVisualCatalog}
            data-tooltip="Görsel Modül Kataloğu — Gardırop, mutfak alt/üst, boy dolap, ada mutfak ve köşe şablonlarını sahneye ekler."
            data-tooltip-badge="MODÜL KÜTÜPHANESİ"
            className="h-8 rounded-2xl birim-expand-btn text-[#44403C] hover:text-[#141413] hover:bg-white/75 cursor-pointer"
          >
            <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
            <span className="birim-expand-label">Katalog</span>
          </button>

          {onOpenArAnd3DModal && (
            <button
              type="button"
              data-testid="open-ar-3d-modal-btn"
              onClick={onOpenArAnd3DModal}
              data-tooltip="Odamda Gör (1:1 AR) & 3D Model — QR kod ile mobil AR önizleme ve .GLB / .OBJ / .USDA çıktısı."
              data-tooltip-badge="AR & 3D DIŞA AKTAR"
              className="h-8 rounded-2xl birim-expand-btn text-[#44403C] hover:text-[#141413] hover:bg-white/75 cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5 shrink-0" />
              <span className="birim-expand-label">AR &amp; 3D</span>
            </button>
          )}

          {onOpenAssemblyModal && (
            <button
              type="button"
              data-testid="open-assembly-diagram-header-btn"
              onClick={onOpenAssemblyModal}
              data-tooltip="Patlatılmış İzometrik Montaj Şeması"
              className={`${
                isCustomerMode ? "sr-only" : "inline-flex"
              } h-8 rounded-2xl birim-expand-btn text-[#141413] hover:bg-white/75 cursor-pointer`}
            >
              <Wrench className="w-3.5 h-3.5 text-[#0F172A] shrink-0" />
              <span className="birim-expand-label">Montaj</span>
            </button>
          )}

          {onOpenStudioRenderModal && (
            <button
              type="button"
              data-testid="open-studio-render-header-btn"
              onClick={onOpenStudioRenderModal}
              data-tooltip="2K Stüdyo Render & GPU Path-Tracing"
              className="h-8 rounded-2xl birim-expand-btn text-[#141413] hover:bg-white/75 cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5 text-[#0F172A] shrink-0" />
              <span className="birim-expand-label">Render</span>
            </button>
          )}

          <button
            type="button"
            data-testid="showroom-zen-toggle"
            onClick={onEnterZenShowroom}
            data-tooltip="Tam Ekran Tablet / Kiosk Sunum Modu — Yan panelleri gizleyerek dolabı tam ekran inceler."
            data-tooltip-shortcut="F"
            className="h-8 rounded-2xl birim-expand-btn text-[#44403C] hover:text-[#141413] hover:bg-white/75 cursor-pointer"
          >
            <Maximize2 className="w-3.5 h-3.5 shrink-0" />
            <span className="birim-expand-label">Sunum</span>
          </button>

          <button
            type="button"
            data-testid="open-bom-modal-btn"
            onClick={onOpenBomModal}
            data-tooltip="BOM Kesim & Bant Listesi, Nesting Plaka Şeması, Homag/Biesse CNC ve Zebra .ZPL Barkod Etiketi"
            className={`${
              isCustomerMode ? "sr-only" : "inline-flex"
            } h-8 rounded-2xl birim-expand-btn text-[#141413] bg-amber-500/15 hover:bg-amber-500/25 cursor-pointer`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#8C5A2B] shrink-0" />
            <span className="birim-expand-label">BOM &amp; CNC</span>
          </button>

          <button
            type="button"
            data-testid="v3-engineering-badge"
            onClick={onOpenRulesModal}
            data-tooltip={`Üretim & Statik Denetimi — ${humanCompatStatusLabel}`}
            data-tooltip-badge="MÜHENDİSLİK ONAYI"
            className={`${
              isCustomerMode ? "sr-only" : "inline-flex"
            } h-8 rounded-2xl birim-expand-btn cursor-pointer ${
              canApproveProduction
                ? "bg-emerald-500/15 text-[#2E6F40] hover:bg-emerald-500/25"
                : "text-[#8C7A6B] hover:bg-white/75"
            }`}
          >
            {canApproveProduction ? (
              <CheckCircle className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            )}
            <span className="birim-expand-label">Denetim</span>
            <span className="sr-only">{humanCompatStatusLabel}</span>
          </button>

          {!isCustomerMode ? (
            <button
              type="button"
              data-testid="v4-library-admin-btn"
              onClick={onOpenAdminModal}
              data-tooltip="B1 Kütüphane & Kurallar Yönetimi — Malzeme fiyatları, kenar bandı kuralları ve fabrika parametreleri."
              data-tooltip-badge="YÖNETİM PANELİ"
              className="h-8 rounded-2xl birim-expand-btn text-[#141413] hover:bg-white/75 cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
              <span className="birim-expand-label">B1 Kurallar</span>
            </button>
          ) : (
            <button
              type="button"
              data-testid="v4-library-admin-btn"
              onClick={onOpenAdminModal}
              className="sr-only"
            >
              B1
            </button>
          )}
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
          <span className="hidden xl:inline">{isCustomerMode ? "Fiyat & Sipariş" : "Teklif"}</span>
        </button>
      </div>
    </header>
  );
};
