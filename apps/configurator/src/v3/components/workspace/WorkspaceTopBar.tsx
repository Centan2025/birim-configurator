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
    <header className="h-[52px] bg-[#FAF9F6]/98 backdrop-blur-md text-[#141413] border-b border-[#DED8CC] flex items-center justify-between px-4 gap-3 shrink-0 z-30">
      {/* Left: Authentic B1R1M Brand + Architectural Project Selector + Guided Wizard */}
      <div className="flex items-center gap-2 min-w-0">
        <V3BrandBadge subtitle="STUDIO" dark={false} />

        <div className="h-4 w-px bg-[#DED8CC] mx-0.5 hidden sm:block" />

        <button
          type="button"
          onClick={onOpenProjectModal}
          title="Projeyi Kaydet / Kayıtlı Projeleri Aç"
          className="hidden sm:inline-flex items-center gap-2 h-8 px-3 rounded-lg bg-white hover:bg-[#F3F0E8] border border-[#DED8CC] text-xs text-[#44403C] transition cursor-pointer max-w-[230px]"
        >
          <FolderOpen className="w-3.5 h-3.5 text-[#8C7A6B] shrink-0" />
          <span
            data-testid="v3-project-title"
            className="font-semibold text-[#141413] truncate"
          >
            {projectTitle}
          </span>
        </button>

        <button
          type="button"
          data-testid="open-step-wizard-btn"
          onClick={onOpenStepWizard}
          className="h-8 px-3 rounded-lg font-semibold text-xs inline-flex items-center gap-1.5 bg-[#141413] hover:bg-[#292524] text-[#FAF9F6] border border-[#141413] transition cursor-pointer shrink-0"
          title="4 Adımda Canlı Önizlemeli Kurulum Sihirbazı"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#D6C7B2]" />
          <span>Kolay Sihirbaz</span>
        </button>
      </div>

      {/* Center: Unified Architectural Segmented Switcher (Consistent 8px Radius Grammar) */}
      <div className="flex items-center gap-2">
        <nav
          aria-label="Tasarım Aşaması"
          data-testid="v3-mode-switcher"
          className="inline-flex items-center p-0.5 rounded-lg bg-[#EFECE5] border border-[#DED8CC] text-xs"
        >
          {[
            { id: "studio" as const, label: "3D Stüdyo", testId: "v3-mode-studio" },
            { id: "plan" as const, label: "Mekân & Plan", testId: "v3-mode-plan" },
            { id: "showroom" as const, label: "Sunum", testId: "v3-mode-showroom" },
          ].map((item) => {
            const active = mode === item.id;
            return (
              <button
                key={item.id}
                type="button"
                data-testid={item.testId}
                onClick={() => {
                  startTransition(() => {
                    onSetMode(item.id);
                  });
                }}
                className={`h-7 px-3 rounded-md font-semibold transition cursor-pointer ${
                  active
                    ? "bg-white text-[#141413] shadow-2xs border border-[#D6D0C4]"
                    : "text-[#57534E] hover:text-[#141413]"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {mode === "studio" && (
          <div
            data-testid="studio-view-switcher"
            className="hidden lg:inline-flex items-center p-0.5 rounded-lg bg-white border border-[#DED8CC] text-[11px]"
          >
            <button
              type="button"
              data-testid="studio-view-3d"
              onClick={() => {
                onSetStudioView("3d");
                onSetCameraPreset("iso");
              }}
              className={`h-7 px-2.5 rounded-md font-semibold transition cursor-pointer ${
                studioView === "3d"
                  ? "bg-[#141413] text-[#FAF9F6]"
                  : "text-[#57534E] hover:text-[#141413]"
              }`}
            >
              3D
            </button>
            <button
              type="button"
              data-testid="studio-view-2d"
              onClick={() => onSetStudioView("2d", "elevation")}
              className={`h-7 px-2.5 rounded-md font-semibold transition cursor-pointer ${
                studioView === "2d" && studio2DMode === "elevation"
                  ? "bg-[#141413] text-[#FAF9F6]"
                  : "text-[#57534E] hover:text-[#141413]"
              }`}
            >
              Cephe
            </button>
            <button
              type="button"
              data-testid="studio-view-2d-section"
              onClick={() => onSetStudioView("2d", "section")}
              className={`h-7 px-2.5 rounded-md font-semibold transition cursor-pointer ${
                studioView === "2d" && studio2DMode === "section"
                  ? "bg-[#141413] text-[#FAF9F6]"
                  : "text-[#57534E] hover:text-[#141413]"
              }`}
            >
              Kesit
            </button>
            <button
              type="button"
              data-testid="studio-view-2d-plan"
              onClick={() => onSetStudioView("2d", "plan")}
              className={`h-7 px-2.5 rounded-md font-semibold transition cursor-pointer ${
                studioView === "2d" && studio2DMode === "plan"
                  ? "bg-[#141413] text-[#FAF9F6]"
                  : "text-[#57534E] hover:text-[#141413]"
              }`}
            >
              Plan
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

      {/* Right: 3-Persona Mode Switcher + Clean Architectural Action Cluster */}
      <div className="flex items-center gap-1.5 shrink-0">
        <div
          role="group"
          aria-label="Kullanıcı Deneyim Seviyesi"
          className="hidden md:inline-flex items-center p-0.5 rounded-lg bg-[#EFECE5] border border-[#DED8CC] text-[11px]"
        >
          {[
            { id: "simple" as const, label: "Kolay" },
            { id: "architect" as const, label: "Mimar" },
            { id: "factory" as const, label: "Üretim" },
          ].map((tier) => {
            const active = experienceTier === tier.id;
            return (
              <button
                key={tier.id}
                type="button"
                data-testid={
                  tier.id === "architect"
                    ? "toggle-simple-blum-mode-btn"
                    : `experience-tier-${tier.id}`
                }
                onClick={() =>
                  onChangeExperienceTier(active && tier.id === "architect" ? "simple" : tier.id)
                }
                className={`h-7 px-2.5 rounded-md font-semibold transition cursor-pointer ${
                  active
                    ? "bg-[#141413] text-[#FAF9F6] shadow-2xs"
                    : "text-[#57534E] hover:text-[#141413]"
                }`}
              >
                {tier.label}
              </button>
            );
          })}
        </div>

        <div className="h-4 w-px bg-[#DED8CC] mx-0.5 hidden md:block" />

        <div className="inline-flex items-center rounded-lg bg-white border border-[#DED8CC] p-0.5">
          <button
            type="button"
            data-testid="v3-undo-btn"
            onClick={onUndo}
            disabled={!canUndo}
            title="Geri Al (Ctrl+Z)"
            className="w-7 h-7 rounded-md flex items-center justify-center text-[#44403C] hover:text-[#141413] hover:bg-[#EFECE5] disabled:opacity-30 transition cursor-pointer"
          >
            <Undo className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            data-testid="v3-redo-btn"
            onClick={onRedo}
            disabled={!canRedo}
            title="İleri Al (Ctrl+Y)"
            className="w-7 h-7 rounded-md flex items-center justify-center text-[#44403C] hover:text-[#141413] hover:bg-[#EFECE5] disabled:opacity-30 transition cursor-pointer"
          >
            <Redo className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          type="button"
          data-testid="v4-header-catalog-btn"
          onClick={onOpenVisualCatalog}
          title="Görsel Modül Kataloğu"
          className="w-8 h-8 rounded-lg bg-white hover:bg-[#F3F0E8] border border-[#DED8CC] text-[#44403C] hover:text-[#141413] flex items-center justify-center transition cursor-pointer"
        >
          <LayoutGrid className="w-3.5 h-3.5" />
        </button>

        {onOpenArAnd3DModal && (
          <button
            type="button"
            data-testid="open-ar-3d-modal-btn"
            onClick={onOpenArAnd3DModal}
            title="Odamda Gör (1:1 AR), QR Kod ve 3D Model İndir (.GLB / .OBJ / .USDA)"
            className="h-8 px-2.5 rounded-lg bg-white hover:bg-[#F3F0E8] border border-[#DED8CC] text-[11px] font-semibold text-[#141413] inline-flex items-center gap-1.5 transition cursor-pointer"
          >
            <Smartphone className="w-3.5 h-3.5 text-[#8C7A6B]" />
            <span className="hidden xl:inline">AR &amp; 3D</span>
          </button>
        )}

        <button
          type="button"
          data-testid="showroom-zen-toggle"
          onClick={onEnterZenShowroom}
          title="Tam Ekran Sunum Modu"
          className="w-8 h-8 rounded-lg bg-white hover:bg-[#F3F0E8] border border-[#DED8CC] text-[#44403C] hover:text-[#141413] flex items-center justify-center transition cursor-pointer"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>

        {experienceTier === "factory" && (
          <button
            type="button"
            onClick={onOpenBomModal}
            title="Kesim Listesi, Nesting, DXF, .MPR/.CIX ve Blum .BXF Üretim Merkezi"
            className="h-8 px-3 rounded-lg bg-white hover:bg-[#F3F0E8] border border-[#DED8CC] text-xs font-semibold text-[#141413] inline-flex items-center gap-1.5 transition cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#8C7A6B]" />
            <span className="hidden lg:inline">BOM &amp; CNC</span>
          </button>
        )}

        <button
          type="button"
          data-testid="v3-engineering-badge"
          onClick={onOpenRulesModal}
          title={humanCompatStatusLabel}
          className={`${
            experienceTier === "simple" ? "sr-only" : "inline-flex"
          } h-8 px-2.5 rounded-lg border text-[11px] font-semibold items-center gap-1.5 transition cursor-pointer ${
            canApproveProduction
              ? "bg-[#EFF5F1] text-[#1E3F2F] border-[#C9DEC9]"
              : "bg-white text-[#44403C] border-[#DED8CC] hover:bg-[#F5F3EE]"
          }`}
        >
          {canApproveProduction ? (
            <CheckCircle className="w-3.5 h-3.5 text-[#2E6F40] shrink-0" />
          ) : (
            <AlertTriangle className="w-3.5 h-3.5 text-[#8C7A6B] shrink-0" />
          )}
          <span className="hidden 2xl:inline truncate max-w-[140px]">
            {humanCompatStatusLabel}
          </span>
        </button>

        <button
          type="button"
          data-testid="open-quick-sell-header-btn"
          onClick={onOpenQuickSell}
          className="h-8 px-3.5 rounded-lg font-semibold text-xs inline-flex items-center gap-1.5 bg-[#8C7A6B] hover:bg-[#766557] text-white border border-[#7A695B] transition cursor-pointer"
          title="Müşteri Teklif Föyü, Kapasite Özeti ve Oto-Dizilim"
        >
          <span>Teklif &amp; Özet</span>
        </button>

        {experienceTier !== "simple" ? (
          <button
            type="button"
            data-testid="v4-library-admin-btn"
            onClick={onOpenAdminModal}
            title="Kütüphane Yönetimi"
            className="w-8 h-8 rounded-lg bg-white hover:bg-[#EFECE5] border border-[#DED8CC] text-[11px] font-bold text-[#141413] flex items-center justify-center cursor-pointer"
          >
            B1
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
    </header>
  );
};
