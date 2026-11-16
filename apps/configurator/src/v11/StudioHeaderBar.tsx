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
} from "lucide-react";
import { BirimLogo } from "../v3/design-system";
import type { UserExperienceTier } from "../store/useConfiguratorStore";
import type { V11WorkspaceMode, V11CadSubMode } from "./v11Constants";

export interface StudioHeaderBarProps {
  projectTitle: string;
  workspaceMode: V11WorkspaceMode;
  onChangeWorkspaceMode: (mode: V11WorkspaceMode) => void;
  cadSubMode: V11CadSubMode;
  onChangeCadSubMode: (sub: V11CadSubMode) => void;
  experienceTier: UserExperienceTier;
  onChangeExperienceTier: (tier: UserExperienceTier) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  totalPriceEur: number;
  blockingIssueCount: number;
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
}

export const StudioHeaderBar: React.FC<StudioHeaderBarProps> = React.memo(
  ({
    projectTitle,
    workspaceMode,
    onChangeWorkspaceMode,
    cadSubMode,
    onChangeCadSubMode,
    experienceTier,
    onChangeExperienceTier,
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    totalPriceEur,
    blockingIssueCount,
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
  }) => {
    const [outputsOpen, setOutputsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (!outputsOpen) return;
      const onDown = (e: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
          setOutputsOpen(false);
        }
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") setOutputsOpen(false);
      };
      document.addEventListener("mousedown", onDown);
      window.addEventListener("keydown", onKey);
      return () => {
        document.removeEventListener("mousedown", onDown);
        window.removeEventListener("keydown", onKey);
      };
    }, [outputsOpen]);

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

            <button
              type="button"
              data-testid="v11-open-wizard-btn"
              onClick={onOpenWizardModal}
              className="hidden md:inline-flex h-9 px-3.5 rounded-full bg-[#F1EDE4] hover:bg-[#E7E1D5] border border-[#DED7C8] text-[#141413] text-xs font-semibold items-center gap-1.5 transition cursor-pointer shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#8C7A6B]" />
              <span>Hızlı Kurulum</span>
            </button>
          </div>

          {/* ORTA BÖLGE */}
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

          {/* SAĞ BÖLGE */}
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

            <div
              className="hidden xl:flex items-center p-0.5 rounded-full bg-[#ECE7DD]/75 border border-[#DFD9CE]"
              title="Arayüz Detay Seviyesi"
            >
              {(
                [
                  { id: "simple", label: "Sade" },
                  { id: "architect", label: "Detaylı" },
                  { id: "factory", label: "Üretim" },
                ] as const
              ).map((t) => {
                const active = experienceTier === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    data-testid={`v11-tier-${t.id}`}
                    onClick={() => onChangeExperienceTier(t.id)}
                    className={`h-8 px-2.5 rounded-full text-[11px] font-semibold transition cursor-pointer ${
                      active
                        ? "bg-white text-[#141413] shadow-2xs border border-[#DFD9CE]"
                        : "text-[#57534E] hover:text-[#141413]"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

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
                  className="absolute right-0 top-full mt-2 w-80 max-h-[82vh] overflow-y-auto rounded-3xl bg-[#FAF8F4]/98 backdrop-blur-xl border border-[#DFD9CE] shadow-[0_20px_48px_rgba(20,20,19,0.14)] p-2 z-50 text-xs text-[#141413]"
                >
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#8C7A6B]">
                    Özel Ürün, Tesisat & CNC Kertme
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setOutputsOpen(false);
                      onOpenSceneHubModal();
                    }}
                    className="w-full px-3 py-2 rounded-2xl hover:bg-[#EFECE4] flex items-center gap-3 text-left transition cursor-pointer"
                  >
                    <Box className="w-4 h-4 text-[#57534E] shrink-0" />
                    <div>
                      <div className="font-semibold">Kapsül Masa/Konsol & .GLB 3B Merkezi</div>
                      <div className="text-[11px] text-[#78716C]">Özel kapsül üniteler, 3B eşyalar ve LiDAR</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOutputsOpen(false);
                      onOpenMepModal();
                    }}
                    className="w-full px-3 py-2 rounded-2xl hover:bg-[#EFECE4] flex items-center gap-3 text-left transition cursor-pointer"
                  >
                    <Zap className="w-4 h-4 text-[#57534E] shrink-0" />
                    <div>
                      <div className="font-semibold">Elektrik & Su Tesisat Planı (MEP)</div>
                      <div className="text-[11px] text-[#78716C]">Priz, temiz/atık su kot şeması ve DXF</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOutputsOpen(false);
                      onOpenCutoutModal();
                    }}
                    className="w-full px-3 py-2 rounded-2xl hover:bg-[#EFECE4] flex items-center gap-3 text-left transition cursor-pointer"
                  >
                    <Scissors className="w-4 h-4 text-[#57534E] shrink-0" />
                    <div>
                      <div className="font-semibold">Panel Kertme & Priz/Boru Kesimi</div>
                      <div className="text-[11px] text-[#78716C]">Arkalık/yan panel CNC boşaltma işlemleri</div>
                    </div>
                  </button>

                  <div className="my-1.5 h-px bg-[#E6E1D6]" />

                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#8C7A6B]">
                    Sunum & Görselleştirme
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setOutputsOpen(false);
                      onOpenStudioRenderModal();
                    }}
                    className="w-full px-3 py-2 rounded-2xl hover:bg-[#EFECE4] flex items-center gap-3 text-left transition cursor-pointer"
                  >
                    <Camera className="w-4 h-4 text-[#57534E] shrink-0" />
                    <div>
                      <div className="font-semibold">2K Fotoğraf & Render Stüdyosu</div>
                      <div className="text-[11px] text-[#78716C]">Yüksek çözünürlüklü sahne çıktısı</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOutputsOpen(false);
                      onOpenArModal();
                    }}
                    className="w-full px-3 py-2 rounded-2xl hover:bg-[#EFECE4] flex items-center gap-3 text-left transition cursor-pointer"
                  >
                    <Smartphone className="w-4 h-4 text-[#57534E] shrink-0" />
                    <div>
                      <div className="font-semibold">AR Oda Önizleme (QR / GLB / USDZ)</div>
                      <div className="text-[11px] text-[#78716C]">Telefonda gerçek mekânda incele</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOutputsOpen(false);
                      onOpenAssemblyModal();
                    }}
                    className="w-full px-3 py-2 rounded-2xl hover:bg-[#EFECE4] flex items-center gap-3 text-left transition cursor-pointer"
                  >
                    <Layers className="w-4 h-4 text-[#57534E] shrink-0" />
                    <div>
                      <div className="font-semibold">Patlatılmış Montaj Şeması</div>
                      <div className="text-[11px] text-[#78716C]">Adım adım numaralı kurulum kılavuzu</div>
                    </div>
                  </button>

                  <div className="my-1.5 h-px bg-[#E6E1D6]" />

                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#8C7A6B]">
                    Üretim, CNC, Blum BXF & Mağaza ERP
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setOutputsOpen(false);
                      onOpenBomModal("cutlist");
                    }}
                    className="w-full px-3 py-2 rounded-2xl hover:bg-[#EFECE4] flex items-center gap-3 text-left transition cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-[#57534E] shrink-0" />
                    <div>
                      <div className="font-semibold">Kesim Listesi, Nesting, CNC & Blum BXF</div>
                      <div className="text-[11px] text-[#78716C]">Plaka optimizasyonu, DXF, MPR/CIX ve BXF</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOutputsOpen(false);
                      onOpenStoreErpModal();
                    }}
                    className="w-full px-3 py-2 rounded-2xl hover:bg-[#EFECE4] flex items-center gap-3 text-left transition cursor-pointer"
                  >
                    <Store className="w-4 h-4 text-[#57534E] shrink-0" />
                    <div>
                      <div className="font-semibold">Birim Store & Portal ERP Aktarımı</div>
                      <div className="text-[11px] text-[#78716C]">Tekliften üretime doğrudan senkronizasyon</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOutputsOpen(false);
                      onOpenStandardsModal();
                    }}
                    className="w-full px-3 py-2 rounded-2xl hover:bg-[#EFECE4] flex items-center gap-3 text-left transition cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4 text-[#57534E] shrink-0" />
                    <div className="flex-1">
                      <div className="font-semibold flex items-center justify-between">
                        <span>Mühendislik & Standart Kontrolü</span>
                        {blockingIssueCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                            {blockingIssueCount}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#78716C]">Uyumluluk denetimi ve otomatik çözüm</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOutputsOpen(false);
                      onOpenSaasModal();
                    }}
                    className="w-full px-3 py-2 rounded-2xl hover:bg-[#EFECE4] flex items-center gap-3 text-left transition cursor-pointer"
                  >
                    <Building2 className="w-4 h-4 text-[#57534E] shrink-0" />
                    <div>
                      <div className="font-semibold">Firma & Katalog Yönetimi</div>
                      <div className="text-[11px] text-[#78716C]">Kurumsal fiyat çarpanları ve şube ayarları</div>
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
          </div>
        )}
      </header>
    );
  }
);

StudioHeaderBar.displayName = "StudioHeaderBar";
