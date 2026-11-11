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
} from "lucide-react";

interface WorkspaceTopBarProps {
  projectTitle: string;
  mode: "studio" | "plan" | "showroom";
  studioView: "3d" | "2d";
  studio2DMode: "elevation" | "section" | "plan";
  experienceTier: UserExperienceTier;
  canUndo: boolean;
  canRedo: boolean;
  canApproveProduction: boolean;
  humanCompatStatusLabel: string;
  onOpenProjectModal: () => void;
  onOpenStepWizard: () => void;
  onOpenQuickSell: () => void;
  onOpenBomModal: () => void;
  onOpenVisualCatalog: () => void;
  onOpenArAnd3DModal?: () => void;
  onOpenRulesModal: () => void;
  onOpenAdminModal: () => void;
  onChangeExperienceTier: (tier: UserExperienceTier) => void;
  onSetMode: (mode: "studio" | "plan" | "showroom") => void;
  onSetStudioView: (view: "3d" | "2d", mode2d?: "elevation" | "section" | "plan") => void;
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
  experienceTier,
  canUndo,
  canRedo,
  canApproveProduction,
  humanCompatStatusLabel,
  onOpenProjectModal,
  onOpenStepWizard,
  onOpenQuickSell,
  onOpenBomModal,
  onOpenVisualCatalog,
  onOpenArAnd3DModal,
  onOpenRulesModal,
  onOpenAdminModal,
  onChangeExperienceTier,
  onSetMode,
  onSetStudioView,
  onSetCameraPreset,
  onToggleDimensions,
  onEnterZenShowroom,
  onUndo,
  onRedo,
}) => {
  return (
    <header className="h-[50px] birim-ice-bar text-[#141413] border-b flex items-center justify-between px-3.5 gap-2 shrink-0 z-30">
      {/* Sol: Marka + Buzlu Cam Proje Seçici + İkon Ağırlıklı Sihirbaz */}
      <div className="flex items-center gap-1.5 min-w-0">
        <V3BrandBadge subtitle="V5" dark={false} />

        <div className="h-4 w-px bg-slate-900/10 mx-0.5 hidden sm:block" />

        <button
          type="button"
          onClick={onOpenProjectModal}
          title={`Projeler & Kayıt (${projectTitle})`}
          className="hidden sm:inline-flex items-center gap-1.5 h-8 px-2.5 rounded-xl birim-ice-btn text-xs text-[#141413] cursor-pointer max-w-[175px]"
        >
          <FolderOpen className="w-3.5 h-3.5 text-[#8C7A6B] shrink-0" />
          <span
            data-testid="v3-project-title"
            className="font-semibold text-[11px] text-[#141413] truncate"
          >
            {projectTitle}
          </span>
        </button>

        <button
          type="button"
          data-testid="open-step-wizard-btn"
          onClick={onOpenStepWizard}
          className="h-8 w-8 sm:w-auto sm:px-2.5 rounded-xl font-semibold text-[11px] inline-flex items-center justify-center gap-1.5 birim-ice-btn-active cursor-pointer shrink-0"
          title="4 Adımda Canlı Önizlemeli Kurulum Sihirbazı"
          aria-label="Kolay Sihirbaz"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#E5D3B8]" />
          <span className="hidden lg:inline">Sihirbaz</span>
        </button>
      </div>

      {/* Orta: Buzlu Cam İkon Ağırlıklı Mod & Sahne Seçici Kapsülleri */}
      <div className="flex items-center gap-1.5">
        <nav
          aria-label="Tasarım Aşaması"
          data-testid="v3-mode-switcher"
          className="inline-flex items-center p-0.5 rounded-2xl birim-ice-pill text-xs gap-0.5"
        >
          {[
            { id: "studio" as const, short: "3D", full: "3D Stüdyo", testId: "v3-mode-studio", Icon: Box },
            { id: "plan" as const, short: "Plan", full: "Mekân & Plan", testId: "v3-mode-plan", Icon: Compass },
            { id: "showroom" as const, short: "Sunum", full: "Sunum Stüdyosu", testId: "v3-mode-showroom", Icon: Eye },
          ].map((item) => {
            const active = mode === item.id;
            const ItemIcon = item.Icon;
            return (
              <button
                key={item.id}
                type="button"
                data-testid={item.testId}
                title={item.full}
                onClick={() => {
                  startTransition(() => {
                    onSetMode(item.id);
                  });
                }}
                className={`h-7 px-2.5 rounded-xl font-semibold inline-flex items-center gap-1.5 transition cursor-pointer ${
                  active
                    ? "birim-ice-btn-active"
                    : "text-[#44403C] hover:text-[#141413] hover:bg-white/60"
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
            className="hidden lg:inline-flex items-center p-0.5 rounded-2xl birim-ice-pill gap-0.5"
          >
            <button
              type="button"
              data-testid="studio-view-3d"
              title="3D Perspektif Sahne"
              onClick={() => {
                onSetStudioView("3d");
                onSetCameraPreset("iso");
              }}
              className={`w-7 h-7 rounded-xl flex items-center justify-center transition cursor-pointer ${
                studioView === "3d"
                  ? "birim-ice-btn-active"
                  : "text-[#57534E] hover:text-[#141413] hover:bg-white/60"
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              <span className="sr-only">3D</span>
            </button>
            <button
              type="button"
              data-testid="studio-view-2d"
              title="2D Ön Cephe Teknik Görünüş"
              onClick={() => onSetStudioView("2d", "elevation")}
              className={`w-7 h-7 rounded-xl flex items-center justify-center transition cursor-pointer ${
                studioView === "2d" && studio2DMode === "elevation"
                  ? "birim-ice-btn-active"
                  : "text-[#57534E] hover:text-[#141413] hover:bg-white/60"
              }`}
            >
              <Square className="w-3.5 h-3.5" />
              <span className="sr-only">Cephe</span>
            </button>
            <button
              type="button"
              data-testid="studio-view-2d-section"
              title="2D Yan Kesit Görünüş"
              onClick={() => onSetStudioView("2d", "section")}
              className={`w-7 h-7 rounded-xl flex items-center justify-center transition cursor-pointer ${
                studioView === "2d" && studio2DMode === "section"
                  ? "birim-ice-btn-active"
                  : "text-[#57534E] hover:text-[#141413] hover:bg-white/60"
              }`}
            >
              <Scissors className="w-3.5 h-3.5" />
              <span className="sr-only">Kesit</span>
            </button>
            <button
              type="button"
              data-testid="studio-view-2d-plan"
              title="2D Üst Yerleşim Planı"
              onClick={() => onSetStudioView("2d", "plan")}
              className={`w-7 h-7 rounded-xl flex items-center justify-center transition cursor-pointer ${
                studioView === "2d" && studio2DMode === "plan"
                  ? "birim-ice-btn-active"
                  : "text-[#57534E] hover:text-[#141413] hover:bg-white/60"
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span className="sr-only">Plan</span>
            </button>
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

      {/* Sağ: İkon Odaklı Deneyim Modu + Buzlu Cam Aksiyon Kümesi */}
      <div className="flex items-center gap-1 shrink-0">
        <div
          role="group"
          aria-label="Kullanıcı Deneyim Seviyesi"
          className="hidden md:inline-flex items-center p-0.5 rounded-2xl birim-ice-pill gap-0.5"
        >
          {[
            { id: "simple" as const, label: "Kolay Mod (Müşteri)", Icon: User },
            { id: "architect" as const, label: "Mimar Modu (Detaylı Tasarım)", Icon: DraftingCompass },
            { id: "factory" as const, label: "Üretim & ERP Modu (BOM / CNC)", Icon: Factory },
          ].map((tier) => {
            const active = experienceTier === tier.id;
            const TierIcon = tier.Icon;
            return (
              <button
                key={tier.id}
                type="button"
                title={tier.label}
                data-testid={
                  tier.id === "architect"
                    ? "toggle-simple-blum-mode-btn"
                    : `experience-tier-${tier.id}`
                }
                onClick={() =>
                  onChangeExperienceTier(active && tier.id === "architect" ? "simple" : tier.id)
                }
                className={`w-7 h-7 rounded-xl flex items-center justify-center transition cursor-pointer ${
                  active
                    ? "birim-ice-btn-active"
                    : "text-[#57534E] hover:text-[#141413] hover:bg-white/60"
                }`}
              >
                <TierIcon className="w-3.5 h-3.5" />
                <span className="sr-only">{tier.label}</span>
              </button>
            );
          })}
        </div>

        <div className="inline-flex items-center rounded-2xl birim-ice-pill p-0.5 gap-0.5">
          <button
            type="button"
            data-testid="v3-undo-btn"
            onClick={onUndo}
            disabled={!canUndo}
            title="Geri Al (Ctrl+Z)"
            className="w-7 h-7 rounded-xl flex items-center justify-center text-[#44403C] hover:text-[#141413] hover:bg-white/75 disabled:opacity-30 transition cursor-pointer"
          >
            <Undo className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            data-testid="v3-redo-btn"
            onClick={onRedo}
            disabled={!canRedo}
            title="İleri Al (Ctrl+Y)"
            className="w-7 h-7 rounded-xl flex items-center justify-center text-[#44403C] hover:text-[#141413] hover:bg-white/75 disabled:opacity-30 transition cursor-pointer"
          >
            <Redo className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="inline-flex items-center rounded-2xl birim-ice-pill p-0.5 gap-0.5">
          <button
            type="button"
            data-testid="v4-header-catalog-btn"
            onClick={onOpenVisualCatalog}
            title="Görsel Modül Kataloğu"
            className="w-7 h-7 rounded-xl text-[#44403C] hover:text-[#141413] hover:bg-white/75 flex items-center justify-center transition cursor-pointer"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>

          {onOpenArAnd3DModal && (
            <button
              type="button"
              data-testid="open-ar-3d-modal-btn"
              onClick={onOpenArAnd3DModal}
              title="Odamda Gör (1:1 AR), QR Kod ve 3D Model İndir (.GLB / .OBJ / .USDA)"
              className="w-7 h-7 rounded-xl text-[#44403C] hover:text-[#141413] hover:bg-white/75 flex items-center justify-center transition cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="sr-only">AR &amp; 3D</span>
            </button>
          )}

          <button
            type="button"
            data-testid="showroom-zen-toggle"
            onClick={onEnterZenShowroom}
            title="Tam Ekran Sunum Modu"
            className="w-7 h-7 rounded-xl text-[#44403C] hover:text-[#141413] hover:bg-white/75 flex items-center justify-center transition cursor-pointer"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          {experienceTier === "factory" && (
            <button
              type="button"
              onClick={onOpenBomModal}
              title="BOM, Birim ERP Nesting, DXF, .MPR/.CIX ve Blum .BXF Üretim Merkezi"
              className="w-7 h-7 rounded-xl text-[#141413] bg-amber-500/15 hover:bg-amber-500/25 flex items-center justify-center transition cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#8C5A2B]" />
              <span className="sr-only">BOM &amp; CNC</span>
            </button>
          )}

          <button
            type="button"
            data-testid="v3-engineering-badge"
            onClick={onOpenRulesModal}
            title={humanCompatStatusLabel}
            className={`${
              experienceTier === "simple" ? "sr-only" : "flex"
            } w-7 h-7 rounded-xl items-center justify-center transition cursor-pointer ${
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
            <span className="sr-only">{humanCompatStatusLabel}</span>
          </button>

          {experienceTier !== "simple" ? (
            <button
              type="button"
              data-testid="v4-library-admin-btn"
              onClick={onOpenAdminModal}
              title="B1 Kütüphane ve Kurallar Yönetimi"
              className="w-7 h-7 rounded-xl text-[#141413] hover:bg-white/75 flex items-center justify-center transition cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="sr-only">B1</span>
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
          className="h-8 px-2.5 rounded-xl font-semibold text-[11px] inline-flex items-center gap-1.5 bg-[#8C7A6B]/85 hover:bg-[#766557]/90 backdrop-blur-md text-white border border-white/30 shadow-xs transition cursor-pointer"
          title="Müşteri Teklif Föyü, Kapasite Özeti ve Oto-Dizilim"
        >
          <ReceiptText className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden xl:inline">Teklif</span>
        </button>
      </div>
    </header>
  );
};
