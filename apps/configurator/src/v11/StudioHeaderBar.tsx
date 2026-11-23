"use client";

import { useConfiguratorStore } from "../store/useConfiguratorStore";

import { createPortal } from "react-dom";
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
  Maximize2,
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
import { AnimatedPopoverPresence } from "./AnimatedWindowPresence";

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
  onOpenProductionSheetModal: () => void;
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
  displayUnit?: "cm" | "mm";
  onOpenDoorShowcase?: () => void;
  onChangeDisplayUnit?: (unit: "cm" | "mm") => void;
  uiFontScale?: number;
  onChangeUiFontScale?: (scale: number) => void;
  activeInspectorTab?: "dimensions" | "interior" | "doors" | "materials" | "hardware";
  onQuickNavigateStep?: (step: "dimensions" | "interior" | "showroom") => void;
  variantSlots?: ReadonlyArray<{
    slot: "A" | "B" | "C";
    saved: boolean;
    priceEur?: number;
    summaryTr?: string;
  }>;
  activeVariantSlot?: "A" | "B" | "C" | null;
  onSelectOrSaveVariantSlot?: (slot: "A" | "B" | "C", forceOverwrite?: boolean) => void;
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
    onOpenProductionSheetModal,
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
    displayUnit = "cm",
    onOpenDoorShowcase,
    onChangeDisplayUnit,
    uiFontScale = 1,
    onChangeUiFontScale,
    activeInspectorTab = "interior",
    onQuickNavigateStep,
    variantSlots,
    activeVariantSlot = null,
    onSelectOrSaveVariantSlot,
  }) => {
    const isShowroom = workspaceMode === "showroom";
    const [outputsOpen, setOutputsOpen] = useState(false);
    const [variantOpen, setVariantOpen] = useState(false);
    const variantBtnRef = useRef<HTMLButtonElement | null>(null);
    const [variantPos, setVariantPos] = useState<{ top: number; left: number }>({ top: 72, left: 260 });
    const [activeCam3D, setActiveCam3D] = useState<"hero" | "room_front_persp" | "focus_module" | "side">("hero");
    const viewportRenderStyle = useConfiguratorStore((s) => s.viewportRenderStyle);
    const setViewportRenderStyle = useConfiguratorStore((s) => s.setViewportRenderStyle);
    const triggerCamera3D = (preset: "hero" | "room_front_persp" | "focus_module" | "side") => {
      setActiveCam3D(preset);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("birim:fit-camera-3d", { detail: preset }));
      }
    };
    useEffect(() => {
      if (typeof window === "undefined") return;
      const onFit = (ev: Event) => {
        const d = (ev as CustomEvent<string>).detail;
        if (d === "hero" || d === "room_front_persp" || d === "focus_module" || d === "side") {
          setActiveCam3D(d);
        }
      };
      window.addEventListener("birim:fit-camera-3d", onFit);
      return () => window.removeEventListener("birim:fit-camera-3d", onFit);
    }, []);
    const [issuesOpen, setIssuesOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const issuesRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (!outputsOpen && !issuesOpen && !variantOpen) return;
      const onDown = (e: MouseEvent) => {
        const target = e.target as HTMLElement | null;
        if (target?.closest?.("[data-birim-portal-menu]")) return;
        if (menuRef.current && !menuRef.current.contains(target as Node)) {
          setOutputsOpen(false);
        }
        if (issuesRef.current && !issuesRef.current.contains(target as Node)) {
          setIssuesOpen(false);
        }
        if (variantBtnRef.current && !variantBtnRef.current.contains(target as Node)) {
          setVariantOpen(false);
        }
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setOutputsOpen(false);
          setIssuesOpen(false);
          setVariantOpen(false);
        }
      };
      document.addEventListener("mousedown", onDown);
      window.addEventListener("keydown", onKey);
      return () => {
        document.removeEventListener("mousedown", onDown);
        window.removeEventListener("keydown", onKey);
      };
    }, [outputsOpen, issuesOpen, variantOpen]);

    useEffect(() => {
      setOutputsOpen(false);
      setIssuesOpen(false);
      setVariantOpen(false);
    }, [workspaceMode]);

    const formattedPrice = new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(Math.max(0, totalPriceEur || 0));

    const baseSlotAPrice =
      variantSlots?.find((v) => v.slot === "A" && v.saved)?.priceEur ?? totalPriceEur;

    const savedVariantCount = variantSlots?.filter((v) => v.saved).length ?? 0;
    const variantSwitcherNode =
      variantSlots && onSelectOrSaveVariantSlot ? (
        <div
          data-testid="v15-header-variant-switcher"
          className="relative shrink-0"
        >
          <button
            ref={variantBtnRef}
            type="button"
            data-testid="v15-variant-menu-trigger"
            onClick={() => {
              if (!variantOpen && variantBtnRef.current) {
                const r = variantBtnRef.current.getBoundingClientRect();
                setVariantPos({
                  top: Math.round(r.bottom + 8),
                  left: Math.max(12, Math.min(window.innerWidth - 296, Math.round(r.left))),
                });
              }
              setOutputsOpen(false);
              setIssuesOpen(false);
              setVariantOpen((v) => !v);
            }}
            title="Tasarım Seçenekleri (A / B / C) — Kaydet & Karşılaştır"
            className={`h-9 px-2.5 rounded-full border text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
              activeVariantSlot
                ? "bg-gradient-to-br from-[#0284C7]/90 via-[#1D4ED8]/90 to-[#1E3A8A]/90 border-[#38BDF8]/50 text-white shadow-[0_3px_12px_rgba(37,99,235,0.38)]"
                : "bg-white/[0.10] hover:bg-white/[0.18] border-white/[0.16] text-[#F3F4F6]"
            }`}
          >
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-black/35 text-[10.5px] font-extrabold text-sky-300">
              {activeVariantSlot || "A"}
            </span>
            <span className="hidden xl:inline text-[11px] font-semibold">Seçenek</span>
            {savedVariantCount > 0 && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-white/15 text-sky-200">
                {savedVariantCount}/3
              </span>
            )}
            <ChevronDown className={`w-3.5 h-3.5 opacity-80 transition-transform ${variantOpen ? "rotate-180" : ""}`} />
          </button>

          {typeof document !== "undefined" &&
            createPortal(
              <AnimatedPopoverPresence
                isOpen={variantOpen}
                origin="top-left"
                style={{ top: variantPos.top, left: variantPos.left }}
                className="fixed z-[9999]"
              >
                <div
                  data-birim-portal-menu="true"
                  data-testid="v15-variant-portal-menu"
                  style={{ width: 284 }}
                  className="rounded-3xl bg-[#2A313F]/68 backdrop-blur-2xl border border-white/[0.22] ring-1 ring-black/60 shadow-[0_26px_64px_rgba(0,0,0,0.62)] p-2.5 text-[#F8FAFC]"
                >
                <div className="flex items-center justify-between gap-2 px-1.5 pb-2 mb-1.5 border-b border-white/10">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-300 truncate">
                    Tasarım Seçenekleri
                  </span>
                  <span className="text-[10px] font-mono text-sky-300 shrink-0 whitespace-nowrap">
                    {savedVariantCount}/3 Kayıtlı
                  </span>
                </div>
                <div className="space-y-1.5">
                  {variantSlots.map((vs) => {
                    const isActive = activeVariantSlot === vs.slot;
                    const deltaEur =
                      vs.saved && typeof vs.priceEur === "number" && vs.slot !== "A"
                        ? Math.round(vs.priceEur - baseSlotAPrice)
                        : 0;
                    const deltaLabel =
                      deltaEur > 0 ? `+€${deltaEur}` : deltaEur < 0 ? `-€${Math.abs(deltaEur)}` : vs.saved ? "Baz" : "";
                    return (
                      <div
                        key={vs.slot}
                        className={`rounded-xl p-2 border transition flex items-center justify-between gap-2 ${
                          isActive
                            ? "bg-[#2563EB]/25 border-[#3B82F6]/65"
                            : "bg-white/[0.05] border-white/[0.08] hover:bg-white/[0.10]"
                        }`}
                      >
                        <button
                          type="button"
                          data-testid={`v15-variant-slot-${vs.slot}`}
                          onClick={(e) => {
                            onSelectOrSaveVariantSlot(vs.slot, e.shiftKey);
                            setVariantOpen(false);
                          }}
                          className="flex-1 min-w-0 text-left flex items-center gap-2 cursor-pointer"
                        >
                          <span
                            className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                              isActive
                                ? "bg-[#2563EB] text-white"
                                : vs.saved
                                ? "bg-sky-500/25 text-sky-200 border border-sky-400/30"
                                : "bg-white/10 text-slate-400"
                            }`}
                          >
                            {vs.slot}
                          </span>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate">
                              {vs.saved ? `Seçenek ${vs.slot}` : `Seçenek ${vs.slot} (Boş)`}
                            </div>
                            <div className="text-[10px] text-slate-300 truncate">
                              {vs.saved
                                ? `${vs.summaryTr || "Kayıtlı tasarım"}${deltaLabel ? ` · ${deltaLabel}` : ""}`
                                : "Mevcut tasarımı kaydet"}
                            </div>
                          </div>
                        </button>
                        {vs.saved && (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectOrSaveVariantSlot(vs.slot, true);
                              setVariantOpen(false);
                            }}
                            title={`Mevcut tasarımı Seçenek ${vs.slot} üzerine yaz`}
                            className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-bold text-slate-200 shrink-0 cursor-pointer"
                          >
                            Güncelle
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                </div>
              </AnimatedPopoverPresence>,
              document.body
            )}
        </div>
      ) : null;

    return (
      <header
        data-testid="v11-studio-header"
        className="pointer-events-none fixed top-0 left-0 right-0 z-40 px-4 pt-3 flex flex-col items-center gap-2"
      >
        <div className="relative pointer-events-auto w-full max-w-[1920px] h-[54px] px-3.5 rounded-full flex items-center justify-between gap-3 text-[#F3F4F6]">
          {/* Sibling frosted glass layer so child dropdowns (issuesOpen / outputsOpen) do NOT inherit a Chromium Backdrop Root */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-full bg-[#2C3341]/66 backdrop-blur-2xl border border-white/[0.22] ring-1 ring-black/50 shadow-[0_18px_48px_rgba(0,0,0,0.46)] -z-10"
          />
          {/* SOL BÖLGE */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="pl-1.5 pr-1 flex items-center select-none brightness-0 invert opacity-95">
              <BirimLogo className="h-[19px] w-auto" />
            </div>

            <span className="h-4 w-px bg-white/15 shrink-0" />

            {!isReadOnlyCustomer ? (
              <button
                type="button"
                data-testid="v11-open-project-btn"
                onClick={onOpenProjectModal}
                className="h-9 px-3 rounded-full bg-white/[0.10] hover:bg-white/[0.18] border border-white/[0.15] text-[#F3F4F6] text-xs font-semibold flex items-center gap-2 max-w-[155px] xl:max-w-[220px] shadow-[0_3px_10px_rgba(0,0,0,0.28)] shrink min-w-0 transition cursor-pointer"
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
                className="inline-flex h-9 px-2.5 sm:px-3.5 rounded-full bg-gradient-to-r from-[#38BDF8]/22 to-[#2563EB]/20 hover:from-[#38BDF8]/34 hover:to-[#2563EB]/30 border border-[#38BDF8]/45 text-[#E0F2FE] text-xs font-semibold items-center gap-1.5 shadow-[0_3px_12px_rgba(0,0,0,0.28)] transition cursor-pointer shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#7DD3FC]" />
                <span className="hidden sm:inline">Kurulum</span><span className="sm:hidden">Kur</span>
              </button>
            )}

            {variantSwitcherNode}
          </div>

          {/* ORTA BÖLGE — Konumu sabit kilitli */}
          {!isReadOnlyCustomer ? (
            <nav
              aria-label="Çalışma Modu"
              className="relative z-20 grid grid-cols-4 gap-1 p-1 rounded-full bg-black/40 border border-white/[0.12] shrink-0"
            >
              <span
                aria-hidden="true"
                style={{
                  width: "calc((100% - 8px - 12px) / 4)",
                  transform: `translate3d(calc(${Math.max(
                    0,
                    ["3d", "2d", "plan", "showroom"].indexOf(workspaceMode)
                  )} * (100% + 4px)), 0, 0)`,
                }}
                className="pointer-events-none absolute top-1 bottom-1 left-1 rounded-full bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] shadow-[0_0_20px_rgba(29,78,216,0.58),0_4px_14px_rgba(37,99,235,0.45)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
              />
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
                    className={`relative z-10 h-8 w-[90px] sm:w-[100px] whitespace-nowrap rounded-full text-xs font-bold text-center transition-colors duration-200 cursor-pointer ${
                      active
                        ? "text-white"
                        : "text-slate-300 hover:text-white"
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
            <div className="flex items-center justify-end gap-2 min-w-0 flex-1">
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
          <div className="flex items-center justify-end gap-1.5 min-w-0 flex-1">
            {/* Küresel cm / mm Ölçü Birimi Seçici (Kolay modda üst çubuk sade tutulur) */}
            {onOpenDoorShowcase && (
              <button
                type="button"
                data-testid="v11-open-door-showcase"
                onClick={onOpenDoorShowcase}
                title="Tüm kapak çeşitleri ve kulpsuz açma kesitlerini paralel karşılaştır"
                className="hidden 2xl:inline-flex items-center h-8 px-2.5 rounded-full bg-white/[0.10] hover:bg-white/[0.18] border border-white/[0.14] text-[#F3F4F6] text-[11px] font-semibold transition cursor-pointer shrink-0"
              >
                Kapaklar
              </button>
            )}
            {onChangeDisplayUnit && (
              <div
                data-testid="v11-global-unit-switcher"
                title="Ölçü Birimi: Tüm 3B, 2B ve Panel ölçülerini cm / mm arasında değiştirir"
                className="hidden lg:inline-flex items-center p-0.5 rounded-full bg-black/40 border border-white/[0.14]"
              >
                {(["cm", "mm"] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => onChangeDisplayUnit(u)}
                    className={`h-7 px-2.5 rounded-full text-[11px] font-mono font-bold transition cursor-pointer ${
                      displayUnit === u
                        ? "bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] text-white shadow-xs"
                        : "text-slate-300 hover:text-white"
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            )}
            {onChangeUiFontScale && (
              <div
                data-testid="v11-font-scale-switcher"
                title="Sahne Ölçü & Etiket Boyutu"
                className="hidden 2xl:inline-flex items-center p-0.5 rounded-full bg-black/40 border border-white/[0.14]"
              >
                <button
                  type="button"
                  onClick={() => onChangeUiFontScale(Math.max(0.75, Number((uiFontScale - 0.15).toFixed(2))))}
                  disabled={uiFontScale <= 0.75}
                  className="h-7 px-2 rounded-full text-[11px] font-bold text-[#44403C] hover:bg-white hover:text-[#141413] disabled:opacity-35 transition cursor-pointer"
                  title="Yazıları Küçült"
                >
                  A-
                </button>
                <button
                  type="button"
                  onClick={() => onChangeUiFontScale(1)}
                  className="h-7 px-1.5 rounded-full text-[10px] font-mono font-semibold text-[#57534E] hover:text-[#141413] cursor-pointer"
                  title="Varsayılan Boyut (%100)"
                >
                  %{Math.round(uiFontScale * 100)}
                </button>
                <button
                  type="button"
                  onClick={() => onChangeUiFontScale(Math.min(1.6, Number((uiFontScale + 0.15).toFixed(2))))}
                  disabled={uiFontScale >= 1.6}
                  className="h-7 px-2 rounded-full text-[11px] font-bold text-[#44403C] hover:bg-white hover:text-[#141413] disabled:opacity-35 transition cursor-pointer"
                  title="Yazıları Büyüt"
                >
                  A+
                </button>
              </div>
            )}
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
                  onClick={() => { setOutputsOpen(false); setVariantOpen(false); setIssuesOpen((v) => !v); }}
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

                {typeof document !== "undefined" && createPortal(
                <AnimatedPopoverPresence isOpen={issuesOpen} origin="top-right" className="fixed right-28 top-[68px] z-[90]">
                  <div
                    data-testid="v11-header-issues-popover"
                    data-birim-portal-menu="true"
                    style={{
                      background: "rgba(30, 36, 48, 0.72)",
                      backdropFilter: "blur(36px) saturate(195%)",
                      WebkitBackdropFilter: "blur(36px) saturate(195%)",
                    }}
                    className="mt-1.5 w-96 max-w-[calc(100vw-24px)] max-h-[76vh] overflow-y-auto rounded-3xl border border-white/[0.22] ring-1 ring-black/50 shadow-[0_28px_64px_rgba(0,0,0,0.62)] p-3.5 text-xs text-[#F3F4F6] space-y-2.5"
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
                </AnimatedPopoverPresence>, document.body)}
              </div>
            )}

            {/* Çıktılar, Teknik Araçlar ve ERP Menüsü */}
            <div ref={menuRef} className="relative">
              <button
                type="button"
                data-testid="v11-outputs-menu-btn"
                onClick={() => { setIssuesOpen(false); setVariantOpen(false); setOutputsOpen((v) => !v); }}
                className="h-9 px-3.5 rounded-full bg-white/[0.10] hover:bg-white/[0.18] border border-white/[0.15] text-[#F3F4F6] text-xs font-semibold flex items-center gap-1.5 shadow-[0_3px_10px_rgba(0,0,0,0.28)] transition cursor-pointer"
              >
                <span>Çıktılar</span>
                {blockingIssueCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                )}
                <ChevronDown className="w-3.5 h-3.5 text-[#78716C]" />
              </button>

              {typeof document !== "undefined" && createPortal(
              <AnimatedPopoverPresence isOpen={outputsOpen} origin="top-right" className="fixed right-4 top-[68px] z-[90]">
                <div
                  data-testid="v11-outputs-dropdown"
                  data-birim-portal-menu="true"
                  style={{
                    background: "rgba(30, 36, 48, 0.72)",
                    backdropFilter: "blur(36px) saturate(195%)",
                    WebkitBackdropFilter: "blur(36px) saturate(195%)",
                  }}
                  className="mt-1.5 w-76 max-h-[82vh] overflow-y-auto rounded-3xl border border-white/[0.22] ring-1 ring-black/50 shadow-[0_26px_64px_rgba(0,0,0,0.62)] p-2 text-xs text-[#F3F4F6]"
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
                  {experienceTier !== "simple" && (<>
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
                  </>)}

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
                    data-testid="v11-open-production-sheet"
                    onClick={() => {
                      setOutputsOpen(false);
                      onOpenProductionSheetModal();
                    }}
                    className="group w-full px-2.5 py-2 rounded-2xl hover:bg-[#EFECE4] flex items-center gap-3 text-left transition cursor-pointer"
                  >
                    <span className="w-8 h-8 rounded-xl bg-sky-50 group-hover:bg-white flex items-center justify-center shrink-0 transition">
                      <FileText className="w-4 h-4 text-sky-700" />
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold">Üretim Paftası</div>
                      <div className="text-[11px] text-[#78716C] truncate">Plan, görünüş, kesit, 3B &amp; antet</div>
                    </div>
                  </button>
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
                  {experienceTier !== "simple" ? (<>
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
                  </>) : onChangeExperienceTier ? (
                    <button
                      type="button"
                      onClick={() => {
                        onChangeExperienceTier("architect");
                      }}
                      className="w-full mt-1 px-3 py-2 rounded-2xl bg-[#F3EFE6] hover:bg-[#E8E1D3] text-[11px] font-bold text-[#6B4F28] text-center transition cursor-pointer"
                    >
                      Profesyonel &amp; Üretim Araçlarını Göster →
                    </button>
                  ) : null}
                </div>
              </AnimatedPopoverPresence>, document.body)}
            </div>

            <button
              type="button"
              data-testid="v11-open-quote-cta"
              onClick={onOpenQuoteModal}
              className="h-9 px-4 rounded-full bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] hover:from-[#0369A1] hover:to-[#1D4ED8] text-white text-xs font-bold flex items-center gap-2 shadow-[0_0_20px_rgba(29,78,216,0.45)] transition cursor-pointer"
            >
              <span className="font-mono font-bold tracking-tight">{formattedPrice}</span>
              <span className="opacity-45">•</span>
              <FileText className="w-3.5 h-3.5 text-[#7DD3FC]" />
              <span>Teklif</span>
            </button>
          </div>
          )}
        </div>

        {/* 3B kamera ve görünüm kontrolleri artık Alt Orta Yüzen Dock içinde birleştirildi */}

        {workspaceMode === "2d" && (
          <div className="pointer-events-auto px-1.5 py-1 rounded-full bg-[#2A313F]/66 backdrop-blur-2xl border border-white/[0.22] ring-1 ring-black/50 shadow-[0_14px_36px_rgba(0,0,0,0.45)] flex items-center gap-1 text-xs text-[#F3F4F6]">
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
                      ? "bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] text-white font-bold shadow-xs"
                      : "text-slate-300 hover:text-white hover:bg-white/[0.08]"
                  }`}
                >
                  {sub.label}
                </button>
              );
            })}
            {cadSubMode === "split" && onChangeSplit2DViewMode && (
              <>
                <span className="h-4 w-px bg-white/15 mx-1" />
                <div
                  data-testid="split-2d-view-switcher"
                  className="inline-flex items-center gap-0.5 bg-black/40 border border-white/12 p-0.5 rounded-full"
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
                          ? "bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] text-white font-bold shadow-2xs"
                          : "text-slate-300 hover:text-white"
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
