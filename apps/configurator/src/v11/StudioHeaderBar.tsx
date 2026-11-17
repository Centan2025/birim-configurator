"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Undo2,
  Redo2,
  Search,
  ChevronDown,
  Sparkles,
  FileSpreadsheet,
  Camera,
  FileText,
  Smartphone,
  ShieldCheck,
  Store,
  Building2,
  Layers,
  FolderOpen,
  Zap,
  Scissors,
  Box,
  AlertTriangle,
} from "lucide-react";
import type { EngineeringValidationFinding, RemediationProposal } from "@birim/core";
import { BirimLogo } from "../v3/design-system";
import type { UserExperienceTier } from "../store/useConfiguratorStore";
import { formatFindingForTier, type V11WorkspaceMode, type V11CadSubMode } from "./v11Constants";

export interface StudioHeaderBarProps {
  projectTitle: string;
  workspaceMode: V11WorkspaceMode;
  onChangeWorkspaceMode: (mode: V11WorkspaceMode) => void;
  cadSubMode: V11CadSubMode;
  onChangeCadSubMode: (sub: V11CadSubMode) => void;
  split2DViewMode?: "elevation" | "plan" | "section";
  onChangeSplit2DViewMode?: (mode: "elevation" | "plan" | "section") => void;
  experienceTier: UserExperienceTier;
  onChangeExperienceTier?: (tier: UserExperienceTier) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  totalPriceEur: number;
  blockingIssueCount: number;
  engineeringFindings?: EngineeringValidationFinding[];
  onApplyFindingFix?: (proposal: RemediationProposal) => void;
  onFocusFinding?: (finding: EngineeringValidationFinding) => void;
  onOpenProjectModal: () => void;
  onOpenWizardModal: () => void;
  onOpenCommandSearch: () => void;
  onOpenQuoteModal: () => void;
  onOpenBomModal: (tab?: "cutlist" | "nesting" | "cnc_mpr_cix" | "blum_bxf") => void;
  onOpenAssemblyModal: () => void;
  onOpenStudioRenderModal: () => void;
  onOpenArModal: () => void;
  onOpenStoreErpModal: () => void;
  onOpenStandardsModal: () => void;
  onOpenSaasModal: () => void;
  onOpenMepModal: () => void;
  onOpenCutoutModal: () => void;
  onOpenSceneHubModal: () => void;
  isReadOnlyCustomer?: boolean;
}

export const StudioHeaderBar: React.FC<StudioHeaderBarProps> = React.memo(
  ({
    projectTitle,
    workspaceMode,
    onChangeWorkspaceMode,
    cadSubMode,
    onChangeCadSubMode,
    split2DViewMode = "elevation",
    onChangeSplit2DViewMode,
    experienceTier,
    onChangeExperienceTier,
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    totalPriceEur,
    blockingIssueCount,
    engineeringFindings = [],
    onApplyFindingFix,
    onFocusFinding,
    onOpenProjectModal,
    onOpenWizardModal,
    onOpenCommandSearch,
    onOpenQuoteModal,
    onOpenBomModal,
    onOpenAssemblyModal,
    onOpenStudioRenderModal,
    onOpenArModal,
    onOpenStoreErpModal,
    onOpenStandardsModal,
    onOpenSaasModal,
    onOpenMepModal,
    onOpenCutoutModal,
    onOpenSceneHubModal,
    isReadOnlyCustomer = false,
  }) => {
    const isShowroom = workspaceMode === "showroom";
    const [outputsOpen, setOutputsOpen] = useState(false);
    const [issuesOpen, setIssuesOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const issuesRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (!outputsOpen && !issuesOpen) return;
      const onDown = (e: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
          setOutputsOpen(false);
        }
        if (issuesRef.current && !issuesRef.current.contains(e.target as Node)) {
          setIssuesOpen(false);
        }
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setOutputsOpen(false);
          setIssuesOpen(false);
        }
      };
      document.addEventListener("mousedown", onDown);
      window.addEventListener("keydown", onKey);
      return () => {
        document.removeEventListener("mousedown", onDown);
        window.removeEventListener("keydown", onKey);
      };
    }, [outputsOpen, issuesOpen]);

    const formattedPrice = new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(Math.max(0, totalPriceEur || 0));

    return (
      <header
        data-testid="v11-studio-header"
        className="pointer-events-none fixed top-0 left-0 right-0 z-40 px-4 pt-3 flex flex-col items-center gap-2"
      >
        <div className="pointer-events-auto w-full max-w-[1920px] h-[54px] px-3.5 rounded-full bg-[#FAF8F4]/92 backdrop-blur-xl border border-[#DFD9CE] shadow-[0_8px_28px_rgba(20,20,19,0.06)] flex items-center justify-between gap-3">
          {/* SOL BÖLGE */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="pl-1.5 pr-1 flex items-center select-none">
              <BirimLogo className="h-[19px] w-auto" />
            </div>

            <span className="h-4 w-px bg-[#DFD9CE] shrink-0" />

            {!isReadOnlyCustomer ? (
              <button
                type="button"
                data-testid="v11-open-project-btn"
                onClick={onOpenProjectModal}
                className="h-9 px-3 rounded-full bg-white/80 hover:bg-white border border-[#E5DFD3] text-[#141413] text-xs font-semibold flex items-center gap-2 max-w-[220px] transition cursor-pointer"
                title="Proje Kaydet, Aç veya Bulut Bağlantısı Paylaş"
              >
                <FolderOpen className="w-3.5 h-3.5 text-[#78716C] shrink-0" />
                <span className="truncate">{projectTitle || "Yeni Dolap Projesi"}</span>
                <ChevronDown className="w-3.5 h-3.5 text-[#78716C] shrink-0" />
              </button>
            ) : (
              <div className="h-9 px-3 rounded-full bg-white/80 border border-[#E5DFD3] text-[#141413] text-xs font-semibold flex items-center gap-2 max-w-[240px]">
                <span className="truncate">{projectTitle || "Özel Dolap Tasarımı"}</span>
              </div>
            )}

            {!isShowroom && (
              <button
                type="button"
                data-testid="v11-open-wizard-btn"
                onClick={onOpenWizardModal}
                className="hidden md:inline-flex h-9 px-3.5 rounded-full bg-[#F1EDE4] hover:bg-[#E7E1D5] border border-[#DED7C8] text-[#141413] text-xs font-semibold items-center gap-1.5 transition cursor-pointer shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#8C7A6B]" />
                <span>Hızlı Kurulum</span>
              </button>
            )}
          </div>

          {/* ORTA BÖLGE */}
          {!isReadOnlyCustomer ? (
            <nav
              aria-label="Çalışma Modu"
              className="p-1 rounded-full bg-[#ECE7DD]/90 border border-[#DFD9CE] flex items-center gap-0.5 shrink-0"
            >
              {(
                [
                  { id: "3d", label: "3B Tasarım" },
                  { id: "2d", label: "2B Teknik" },
                  { id: "plan", label: "Mekân Planı" },
                  { id: "showroom", label: "Sunum" },
                ] as const
              ).map((item) => {
                const active = workspaceMode === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-testid={`v11-mode-${item.id}`}
                    onClick={() => onChangeWorkspaceMode(item.id)}
                    className={`h-8 px-3.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                      active
                        ? "bg-[#141413] text-white shadow-xs"
                        : "text-[#57534E] hover:text-[#141413] hover:bg-white/60"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>
          ) : (
            <div className="px-4 h-8 rounded-full bg-[#141413] text-white text-xs font-semibold flex items-center">
              Müşteri Sunumu
            </div>
          )}

          {/* SAĞ BÖLGE */}
          {isShowroom ? (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onOpenQuoteModal}
                className="h-9 px-3.5 rounded-full bg-[#141413] hover:bg-[#292524] text-white text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
              >
                <span>Teklif Özeti</span>
                <span className="font-mono text-[#E7E5E4]">{formattedPrice}</span>
              </button>
              {!isReadOnlyCustomer && (
                <button
                  type="button"
                  onClick={() => onChangeWorkspaceMode("3d")}
                  className="h-9 px-3.5 rounded-full bg-white/85 hover:bg-white border border-[#DFD9CE] text-[#141413] text-xs font-semibold transition cursor-pointer"
                >
                  Düzenlemeye Dön
                </button>
              )}
            </div>
          ) : (
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex items-center p-0.5 rounded-full bg-[#ECE7DD]/75 border border-[#DFD9CE]">
              <button
                type="button"
                onClick={onUndo}
                disabled={!canUndo}
                title="Geri Al (Ctrl+Z)"
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#44403C] hover:bg-white hover:text-[#141413] disabled:opacity-35 transition cursor-pointer"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={onRedo}
                disabled={!canRedo}
                title="İleri Al (Ctrl+Y)"
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#44403C] hover:bg-white hover:text-[#141413] disabled:opacity-35 transition cursor-pointer"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={onOpenCommandSearch}
                title="Hızlı Komut ve Özellik Arama (Ctrl+K)"
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#44403C] hover:bg-white hover:text-[#141413] transition cursor-pointer"
              >
                <Search className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Aktif Mühendislik Hata / Uyarı Açıklama Menüsü */}
            {engineeringFindings.length > 0 && (
              <div ref={issuesRef} className="relative">
                <button
                  type="button"
                  data-testid="v11-header-issues-btn"
                  onClick={() => setIssuesOpen((v) => !v)}
                  className={`h-9 px-3 rounded-full border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                    blockingIssueCount > 0
                      ? "bg-red-50 hover:bg-red-100 border-red-300 text-red-800"
                      : "bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-900"
                  }`}
                  title="Projede tespit edilen hata ve önerilerin açıklamalarını gör"
                >
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {blockingIssueCount > 0
                      ? `${blockingIssueCount} Hata`
                      : `${engineeringFindings.length} Öneri`}
                  </span>
                </button>

                {issuesOpen && (
                  <div
                    data-testid="v11-header-issues-popover"
                    className="absolute right-0 top-full mt-2 w-96 max-w-[calc(100vw-24px)] max-h-[76vh] overflow-y-auto rounded-3xl bg-[#FAF8F4]/98 backdrop-blur-xl border border-[#DFD9CE] shadow-[0_24px_56px_rgba(20,20,19,0.18)] p-3.5 z-50 text-xs text-[#141413] space-y-2.5"
                  >
                    <div className="flex items-center justify-between pb-1.5 border-b border-[#E6E1D6]">
                      <span className="font-bold text-[13px]">
                        Tasarım Kontrol & Hata Açıklamaları ({engineeringFindings.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => setIssuesOpen(false)}
                        className="w-6 h-6 rounded-full hover:bg-[#EFECE4] flex items-center justify-center cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>

                    {engineeringFindings.slice(0, 12).map((fd, idx) => {
                      const fmt = formatFindingForTier(fd, experienceTier);
                      const isErr = fd.severity === "error";
                      return (
                        <div
                          key={`${fd.code}_${fd.targetId || idx}`}
                          className={`p-3 rounded-2xl border space-y-1.5 ${
                            isErr
                              ? "bg-red-50/70 border-red-200"
                              : "bg-white border-[#E5DFD3]"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold flex items-center gap-1.5">
                              <span
                                className={`w-2 h-2 rounded-full shrink-0 ${
                                  isErr ? "bg-red-600" : "bg-amber-500"
                                }`}
                              />
                              <span>{fmt.title}</span>
                            </span>
                            {onFocusFinding && (
                              <button
                                type="button"
                                onClick={() => {
                                  onFocusFinding(fd);
                                  setIssuesOpen(false);
                                }}
                                className="text-[10.5px] font-semibold text-[#6B4F28] hover:underline cursor-pointer shrink-0"
                              >
                                Göster →
                              </button>
                            )}
                          </div>
                          <p className="text-[11px] text-[#57534E] leading-relaxed">
                            {fmt.detail}
                          </p>
                          {fd.remediationProposals &&
                            fd.remediationProposals.length > 0 &&
                            onApplyFindingFix && (
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {fd.remediationProposals.slice(0, 2).map((prop) => (
                                  <button
                                    key={prop.id}
                                    type="button"
                                    onClick={() => {
                                      onApplyFindingFix(prop);
                                      setIssuesOpen(false);
                                    }}
                                    className="px-3 py-1 rounded-full bg-[#141413] hover:bg-[#292524] text-white text-[10.5px] font-semibold cursor-pointer transition"
                                  >
                                    ✓ Uygula: {prop.label}
                                  </button>
                                ))}
                              </div>
                            )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Çıktılar, Teknik Araçlar ve ERP Menüsü */}
            <div ref={menuRef} className="relative">
              <button
                type="button"
                data-testid="v11-outputs-menu-btn"
                onClick={() => setOutputsOpen((v) => !v)}
                className="h-9 px-3.5 rounded-full bg-white/85 hover:bg-white border border-[#DFD9CE] text-[#141413] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <span>Araçlar & Çıktılar</span>
                {blockingIssueCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                )}
                <ChevronDown className="w-3.5 h-3.5 text-[#78716C]" />
              </button>

              {outputsOpen && (
                <div
                  data-testid="v11-outputs-dropdown"
                  className="absolute right-0 top-full mt-2 w-76 max-h-[82vh] overflow-y-auto rounded-3xl bg-[#FAF8F4]/98 backdrop-blur-xl border border-[#DFD9CE] shadow-[0_20px_48px_rgba(20,20,19,0.14)] p-2 z-50 text-xs text-[#141413]"
                >
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#8C7A6B]">
                    Tasarım &amp; Sahne
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setOutputsOpen(false);
                      onOpenSceneHubModal();
                    }}
                    className="group w-full px-2.5 py-2 rounded-2xl hover:bg-[#EFECE4] flex items-center gap-3 text-left transition cursor-pointer"
                  >
                    <span className="w-8 h-8 rounded-xl bg-[#EFECE4]/80 group-hover:bg-white flex items-center justify-center shrink-0 transition">
                      <Box className="w-4 h-4 text-[#44403C]" />
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold">3B Nesne &amp; Masa</div>
                      <div className="text-[11px] text-[#78716C] truncate">Hazır eşyalar ve özel üniteler</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOutputsOpen(false);
                      onOpenMepModal();
                    }}
                    className="group w-full px-2.5 py-2 rounded-2xl hover:bg-[#EFECE4] flex items-center gap-3 text-left transition cursor-pointer"
                  >
                    <span className="w-8 h-8 rounded-xl bg-[#EFECE4]/80 group-hover:bg-white flex items-center justify-center shrink-0 transition">
                      <Zap className="w-4 h-4 text-[#44403C]" />
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold">Tesisat Planı</div>
                      <div className="text-[11px] text-[#78716C] truncate">Elektrik ve su noktaları</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOutputsOpen(false);
                      onOpenCutoutModal();
                    }}
                    className="group w-full px-2.5 py-2 rounded-2xl hover:bg-[#EFECE4] flex items-center gap-3 text-left transition cursor-pointer"
                  >
                    <span className="w-8 h-8 rounded-xl bg-[#EFECE4]/80 group-hover:bg-white flex items-center justify-center shrink-0 transition">
                      <Scissors className="w-4 h-4 text-[#44403C]" />
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold">Panel Kesimi</div>
                      <div className="text-[11px] text-[#78716C] truncate">Priz ve boru boşaltmaları</div>
                    </div>
                  </button>

                  <div className="my-1.5 h-px bg-[#E6E1D6]" />

                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#8C7A6B]">
                    Görselleştirme
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setOutputsOpen(false);
                      onOpenStudioRenderModal();
                    }}
                    className="group w-full px-2.5 py-2 rounded-2xl hover:bg-[#EFECE4] flex items-center gap-3 text-left transition cursor-pointer"
                  >
                    <span className="w-8 h-8 rounded-xl bg-[#EFECE4]/80 group-hover:bg-white flex items-center justify-center shrink-0 transition">
                      <Camera className="w-4 h-4 text-[#44403C]" />
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold">Stüdyo Render</div>
                      <div className="text-[11px] text-[#78716C] truncate">Yüksek kaliteli fotoğraf çıktısı</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOutputsOpen(false);
                      onOpenArModal();
                    }}
                    className="group w-full px-2.5 py-2 rounded-2xl hover:bg-[#EFECE4] flex items-center gap-3 text-left transition cursor-pointer"
                  >
                    <span className="w-8 h-8 rounded-xl bg-[#EFECE4]/80 group-hover:bg-white flex items-center justify-center shrink-0 transition">
                      <Smartphone className="w-4 h-4 text-[#44403C]" />
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold">AR Önizleme</div>
                      <div className="text-[11px] text-[#78716C] truncate">Telefonda mekânda gör</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOutputsOpen(false);
                      onOpenAssemblyModal();
                    }}
                    className="group w-full px-2.5 py-2 rounded-2xl hover:bg-[#EFECE4] flex items-center gap-3 text-left transition cursor-pointer"
                  >
                    <span className="w-8 h-8 rounded-xl bg-[#EFECE4]/80 group-hover:bg-white flex items-center justify-center shrink-0 transition">
                      <Layers className="w-4 h-4 text-[#44403C]" />
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold">Montaj Şeması</div>
                      <div className="text-[11px] text-[#78716C] truncate">Adım adım kurulum planı</div>
                    </div>
                  </button>

                  <div className="my-1.5 h-px bg-[#E6E1D6]" />

                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#8C7A6B]">
                    Üretim &amp; Yönetim
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setOutputsOpen(false);
                      onOpenBomModal("cutlist");
                    }}
                    className="group w-full px-2.5 py-2 rounded-2xl hover:bg-[#EFECE4] flex items-center gap-3 text-left transition cursor-pointer"
                  >
                    <span className="w-8 h-8 rounded-xl bg-[#EFECE4]/80 group-hover:bg-white flex items-center justify-center shrink-0 transition">
                      <FileSpreadsheet className="w-4 h-4 text-[#44403C]" />
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold">Kesim &amp; CNC</div>
                      <div className="text-[11px] text-[#78716C] truncate">Parça listesi ve makine çıktısı</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOutputsOpen(false);
                      onOpenStoreErpModal();
                    }}
                    className="group w-full px-2.5 py-2 rounded-2xl hover:bg-[#EFECE4] flex items-center gap-3 text-left transition cursor-pointer"
                  >
                    <span className="w-8 h-8 rounded-xl bg-[#EFECE4]/80 group-hover:bg-white flex items-center justify-center shrink-0 transition">
                      <Store className="w-4 h-4 text-[#44403C]" />
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold">Mağaza &amp; ERP</div>
                      <div className="text-[11px] text-[#78716C] truncate">Sipariş ve üretim aktarımı</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOutputsOpen(false);
                      onOpenStandardsModal();
                    }}
                    className="group w-full px-2.5 py-2 rounded-2xl hover:bg-[#EFECE4] flex items-center gap-3 text-left transition cursor-pointer"
                  >
                    <span className="w-8 h-8 rounded-xl bg-[#EFECE4]/80 group-hover:bg-white flex items-center justify-center shrink-0 transition">
                      <ShieldCheck className="w-4 h-4 text-[#44403C]" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold flex items-center justify-between gap-2">
                        <span>Kalite Kontrol</span>
                        {blockingIssueCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                            {blockingIssueCount}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#78716C] truncate">Ölçü ve uyumluluk denetimi</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOutputsOpen(false);
                      onOpenSaasModal();
                    }}
                    className="group w-full px-2.5 py-2 rounded-2xl hover:bg-[#EFECE4] flex items-center gap-3 text-left transition cursor-pointer"
                  >
                    <span className="w-8 h-8 rounded-xl bg-[#EFECE4]/80 group-hover:bg-white flex items-center justify-center shrink-0 transition">
                      <Building2 className="w-4 h-4 text-[#44403C]" />
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold">Firma Ayarları</div>
                      <div className="text-[11px] text-[#78716C] truncate">Fiyat, şube ve katalog yönetimi</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              data-testid="v11-open-quote-cta"
              onClick={onOpenQuoteModal}
              className="h-9 px-4 rounded-full bg-[#141413] hover:bg-[#292524] text-white text-xs font-semibold flex items-center gap-2 shadow-sm transition cursor-pointer"
            >
              <span className="font-mono font-bold tracking-tight">{formattedPrice}</span>
              <span className="opacity-45">•</span>
              <FileText className="w-3.5 h-3.5 text-[#D6C7B2]" />
              <span>Teklif</span>
            </button>
          </div>
          )}
        </div>

        {workspaceMode === "2d" && (
          <div className="pointer-events-auto px-1.5 py-1 rounded-full bg-[#FAF8F4]/95 backdrop-blur-xl border border-[#DFD9CE] shadow-md flex items-center gap-1 text-xs">
            {(
              [
                { id: "elevation", label: "Ön Cephe Görünüşü" },
                { id: "section", label: "A-A Yan Kesit" },
                { id: "split", label: "3B + 2B Bölünmüş Ekran" },
              ] as const
            ).map((sub) => {
              const active = cadSubMode === sub.id;
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => onChangeCadSubMode(sub.id)}
                  className={`h-7 px-3 rounded-full font-semibold transition cursor-pointer ${
                    active
                      ? "bg-[#141413] text-white"
                      : "text-[#57534E] hover:text-[#141413] hover:bg-[#EFECE4]"
                  }`}
                >
                  {sub.label}
                </button>
              );
            })}
            {cadSubMode === "split" && onChangeSplit2DViewMode && (
              <>
                <span className="h-4 w-px bg-[#DFD9CE] mx-1" />
                <div
                  data-testid="split-2d-view-switcher"
                  className="inline-flex items-center gap-0.5 bg-[#EFECE4] p-0.5 rounded-full"
                >
                  {(
                    [
                      { id: "elevation", label: "Cephe" },
                      { id: "plan", label: "Plan" },
                      { id: "section", label: "Kesit" },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      data-testid={`split-2d-mode-${item.id}-btn`}
                      onClick={() => onChangeSplit2DViewMode(item.id)}
                      className={`h-6 px-2.5 rounded-full text-[11px] font-semibold transition cursor-pointer ${
                        split2DViewMode === item.id
                          ? "bg-[#141413] text-white shadow-2xs"
                          : "text-[#57534E] hover:text-[#141413]"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </header>
    );
  }
);

StudioHeaderBar.displayName = "StudioHeaderBar";
