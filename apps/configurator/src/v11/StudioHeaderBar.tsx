"use client";

import { useConfiguratorStore } from "../store/useConfiguratorStore";

import { createPortal } from "react-dom";
import React, { useState, useRef, useEffect } from "react";
import {
  Undo2,
  Redo2,
  Search,
  ChevronDown,
  SlidersHorizontal,
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
  Ruler,
  LayoutGrid,
  Eye,
  Download,
  Columns2,
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
  isInspectorOpen?: boolean;
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
    isInspectorOpen = true,
    onQuickNavigateStep,
    variantSlots,
    activeVariantSlot = null,
    onSelectOrSaveVariantSlot,
  }) => {
    const isShowroom = workspaceMode === "showroom";
    const [outputsOpen, setOutputsOpen] = useState(false);
    const [outputsAnchor, setOutputsAnchor] = useState<{ top: number; right: number }>({ top: 68, right: 16 });
    const [portalMounted, setPortalMounted] = useState(false);
    useEffect(() => {
      setPortalMounted(true);
    }, []);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [settingsPos, setSettingsPos] = useState<{ top: number; left: number }>({ top: 68, left: 12 });
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
    const settingsRef = useRef<HTMLDivElement>(null);
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
      if (!outputsOpen) return;
      const updateAnchor = () => {
        const el = menuRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        setOutputsAnchor({
          top: Math.round(rect.bottom + 6),
          right: Math.max(12, Math.round(window.innerWidth - rect.right)),
        });
      };
      updateAnchor();
      window.addEventListener("resize", updateAnchor);
      window.addEventListener("scroll", updateAnchor, true);
      return () => {
        window.removeEventListener("resize", updateAnchor);
        window.removeEventListener("scroll", updateAnchor, true);
      };
    }, [outputsOpen]);

    useEffect(() => {
      setOutputsOpen(false);
      setIssuesOpen(false);
      setSettingsOpen(false);
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
              setSettingsOpen(false);
              setVariantOpen((v) => !v);
            }}
            title="Tasarım Seçenekleri (A / B / C) — Kaydet & Karşılaştır"
            className={`h-9 max-sm:h-8 px-2.5 max-sm:px-1.5 rounded-full border text-xs font-bold inline-flex items-center gap-1.5 max-sm:gap-0.5 shadow-[0_4px_14px_rgba(0,0,0,0.44),inset_0_1px_0_rgba(255,255,255,0.16)] hover:shadow-[0_6px_18px_rgba(0,0,0,0.56),inset_0_1px_0_rgba(255,255,255,0.22)] transition cursor-pointer shrink-0 ${
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
              <span className="hidden sm:inline text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-white/15 text-sky-200">
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
                                : "bg-white/10 text-slate-200"
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
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
        className="pointer-events-none fixed top-0 left-0 right-0 z-40 px-2 sm:px-4 pt-3 flex flex-col items-center gap-2"
      >
        <div className="relative pointer-events-auto w-full max-w-[1920px] h-[54px] max-xl:h-auto max-xl:py-1.5 px-3.5 max-xl:px-2.5 rounded-full max-xl:rounded-2xl flex max-xl:flex-wrap items-center justify-between gap-3 max-xl:gap-x-2 max-xl:gap-y-1.5 text-[#F3F4F6]">
          {/* Sibling frosted glass layer so child dropdowns (issuesOpen / outputsOpen) do NOT inherit a Chromium Backdrop Root */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-full max-xl:rounded-2xl bg-[#2C3341]/66 backdrop-blur-2xl border border-white/[0.22] ring-1 ring-black/50 shadow-[0_18px_48px_rgba(0,0,0,0.46)] -z-10"
          />
          {/* SOL BÖLGE */}
          <div className="flex items-center gap-2 max-sm:gap-1.5 min-w-0 flex-1">
            <div className="pl-1.5 pr-1 flex items-center select-none brightness-0 invert opacity-95">
              <BirimLogo className="h-[19px] max-sm:h-[15px] w-auto" />
            </div>

            <span className="h-4 w-px bg-white/15 shrink-0" />

            {!isReadOnlyCustomer ? (
              <button
                type="button"
                data-testid="v11-open-project-btn"
                onClick={onOpenProjectModal}
                className={`${isShowroom ? "max-sm:hidden " : ""}h-9 max-sm:h-8 max-sm:w-8 px-3 max-sm:px-0 rounded-full bg-white/[0.10] hover:bg-white/[0.18] border border-white/[0.15] text-[#F3F4F6] text-xs font-semibold flex items-center justify-center gap-2 max-w-[155px] xl:max-w-[220px] shadow-[0_4px_14px_rgba(0,0,0,0.44),inset_0_1px_0_rgba(255,255,255,0.16)] hover:shadow-[0_6px_18px_rgba(0,0,0,0.56),inset_0_1px_0_rgba(255,255,255,0.22)] shrink-0 sm:shrink min-w-0 transition cursor-pointer`}
                title="Proje Kaydet, Aç veya Bulut Bağlantısı Paylaş"
              >
                <FolderOpen className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                <span className="truncate hidden sm:inline">{projectTitle || "Yeni Dolap Projesi"}</span>
                <ChevronDown className="w-3.5 h-3.5 text-[#78716C] shrink-0 hidden sm:inline" />
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
                className="hidden md:inline-flex h-9 px-2.5 sm:px-3.5 rounded-full bg-gradient-to-r from-[#38BDF8]/22 to-[#2563EB]/20 hover:from-[#38BDF8]/34 hover:to-[#2563EB]/30 border border-[#38BDF8]/45 text-[#E0F2FE] text-xs font-semibold items-center gap-1.5 shadow-[0_4px_14px_rgba(0,0,0,0.44),inset_0_1px_0_rgba(255,255,255,0.16)] hover:shadow-[0_6px_18px_rgba(0,0,0,0.56),inset_0_1px_0_rgba(255,255,255,0.22)] transition cursor-pointer shrink-0"
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
              className="relative z-20 grid grid-cols-4 gap-1 p-1 rounded-full bg-black/40 border border-white/[0.14] shadow-[0_4px_14px_rgba(0,0,0,0.42),inset_0_1px_2px_rgba(0,0,0,0.45)] shrink-0 max-xl:order-3 max-xl:w-full"
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
                  { id: "3d", label: "3B", fullLabel: "3B Tasarım", Icon: Box },
                  { id: "2d", label: "2B", fullLabel: "2B Teknik", Icon: Ruler },
                  { id: "plan", label: "Plan", fullLabel: "Mekân Planı", Icon: LayoutGrid },
                  { id: "showroom", label: "Sunum", fullLabel: "Sunum", Icon: Eye },
                ] as const
              ).map((item) => {
                const active = workspaceMode === item.id;
                const ModeIcon = item.Icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-testid={`v11-mode-${item.id}`}
                    title={item.fullLabel}
                    onClick={() => onChangeWorkspaceMode(item.id)}
                    className={`relative z-10 h-8 max-xl:h-7 px-2 xl:px-2.5 max-xl:w-full xl:w-[104px] whitespace-nowrap rounded-full text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1.5 transition-colors duration-200 cursor-pointer ${
                      active
                        ? "text-white"
                        : "text-slate-300 hover:text-white"
                    }`}
                  >
                    <ModeIcon className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden 2xl:inline">{item.fullLabel}</span>
                    <span className="2xl:hidden">{item.label}</span>
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
            <div className="flex items-center justify-end gap-1.5 max-sm:gap-1 xl:flex-1 shrink-0">
              <button
                type="button"
                data-testid="v11-showroom-quote-btn"
                onClick={onOpenQuoteModal}
                className="h-9 max-sm:h-8 px-3.5 max-sm:px-2.5 rounded-full bg-[#141413] hover:bg-[#292524] text-white text-xs max-sm:text-[11px] font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-[0_4px_14px_rgba(0,0,0,0.44),inset_0_1px_0_rgba(255,255,255,0.16)] hover:shadow-[0_6px_18px_rgba(0,0,0,0.56),inset_0_1px_0_rgba(255,255,255,0.22)] transition cursor-pointer"
              >
                <span className="hidden sm:inline">Teklif Özeti</span>
                <span className="sm:hidden">Teklif</span>
                <span className="font-mono text-[#E7E5E4]">{formattedPrice}</span>
              </button>
              {!isReadOnlyCustomer && (
                <button
                  type="button"
                  data-testid="v11-showroom-exit-btn"
                  onClick={() => onChangeWorkspaceMode("3d")}
                  className="h-9 max-sm:h-8 px-3.5 max-sm:px-2.5 rounded-full bg-white/[0.12] hover:bg-white/[0.20] border border-white/[0.18] text-[#F3F4F6] text-xs max-sm:text-[11px] font-semibold whitespace-nowrap shrink-0 shadow-[0_4px_14px_rgba(0,0,0,0.44),inset_0_1px_0_rgba(255,255,255,0.16)] hover:shadow-[0_6px_18px_rgba(0,0,0,0.56),inset_0_1px_0_rgba(255,255,255,0.22)] transition cursor-pointer"
                >
                  <span className="hidden sm:inline">Düzenlemeye Dön</span>
                  <span className="sm:hidden">Düzenle</span>
                </button>
              )}
            </div>
          ) : (
          <div className="flex items-center justify-end gap-1.5 max-sm:gap-1 min-w-0 xl:flex-1 shrink-0">
            {/* Kompakt Arama + Gruplanmış Görünüm/Ölçü Ayarları Popover'ı (Asla orta menüyle çakışmaz) */}
            <button
              type="button"
              onClick={onOpenCommandSearch}
              title="Hızlı Komut ve Özellik Arama (Ctrl+K)"
              className="hidden xl:flex w-9 h-9 rounded-full bg-white/[0.10] hover:bg-white/[0.18] border border-white/[0.14] text-[#F3F4F6] items-center justify-center shadow-[0_4px_14px_rgba(0,0,0,0.44),inset_0_1px_0_rgba(255,255,255,0.16)] hover:shadow-[0_6px_18px_rgba(0,0,0,0.56),inset_0_1px_0_rgba(255,255,255,0.22)] transition cursor-pointer shrink-0"
            >
              <Search className="w-3.5 h-3.5" />
            </button>

            <div ref={settingsRef} className="relative hidden md:block">
              <button
                type="button"
                data-testid="v11-header-settings-btn"
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  const popW = 256;
                  const nextLeft = Math.max(12, Math.min(window.innerWidth - popW - 12, Math.round(r.right - popW)));
                  const nextTop = Math.round(r.bottom + 8);
                  setSettingsPos({ top: nextTop, left: nextLeft });
                  setIssuesOpen(false);
                  setOutputsOpen(false);
                  setVariantOpen(false);
                  setSettingsOpen((v) => !v);
                }}
                title="Ölçü Birimi (cm/mm), Yazı Boyutu, Kapak Çeşitleri ve Geçmiş"
                className={`h-9 px-2.5 rounded-full border text-xs font-semibold flex items-center gap-1.5 shadow-[0_4px_14px_rgba(0,0,0,0.44),inset_0_1px_0_rgba(255,255,255,0.16)] hover:shadow-[0_6px_18px_rgba(0,0,0,0.56),inset_0_1px_0_rgba(255,255,255,0.22)] transition cursor-pointer shrink-0 ${
                  settingsOpen
                    ? "bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] border-[#38BDF8]/50 text-white"
                    : "bg-white/[0.10] hover:bg-white/[0.18] border-white/[0.15] text-[#F3F4F6]"
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-sky-300" />
                {onChangeDisplayUnit && (
                  <span className="font-mono text-[11px] font-bold uppercase">{displayUnit}</span>
                )}
                <ChevronDown className={`w-3 h-3 opacity-75 transition-transform ${settingsOpen ? "rotate-180" : ""}`} />
              </button>

              {settingsOpen && typeof document !== "undefined" &&
                createPortal(
                  <div
                    style={{
                      position: "fixed",
                      top: `${settingsPos.top}px`,
                      left: `${settingsPos.left}px`,
                      zIndex: 90,
                    }}
                  >
                  <AnimatedPopoverPresence
                    isOpen={settingsOpen}
                    origin="top-right"
                  >
                    <div
                      data-testid="v11-header-settings-popover"
                      data-birim-portal-menu="true"
                      style={{
                        background: "rgba(30, 36, 48, 0.92)",
                        backdropFilter: "blur(32px) saturate(180%)",
                        WebkitBackdropFilter: "blur(32px) saturate(180%)",
                      }}
                      className="mt-1.5 w-64 max-w-[calc(100vw-24px)] rounded-3xl border border-white/[0.22] ring-1 ring-black/50 shadow-[0_26px_64px_rgba(0,0,0,0.62)] p-3 text-xs text-[#F3F4F6] space-y-3"
                    >
                      <div className="flex items-center justify-between pb-1.5 border-b border-white/15">
                        <span className="font-bold text-[12.5px]">Görünüm &amp; Birim Ayarları</span>
                        <button
                          type="button"
                          onClick={() => setSettingsOpen(false)}
                          className="w-6 h-6 rounded-full hover:bg-white/10 flex items-center justify-center cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>

                      {onChangeDisplayUnit && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold text-slate-300">Ölçü Birimi</span>
                          <div
                            data-testid="v11-global-unit-switcher"
                            className="inline-flex items-center p-0.5 rounded-full bg-black/40 border border-white/[0.14]"
                          >
                            {(["cm", "mm"] as const).map((u) => (
                              <button
                                key={u}
                                type="button"
                                onClick={() => onChangeDisplayUnit(u)}
                                className={`h-7 px-3 rounded-full text-[11px] font-mono font-bold transition cursor-pointer ${
                                  displayUnit === u
                                    ? "bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] text-white"
                                    : "text-slate-300 hover:text-white"
                                }`}
                              >
                                {u}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {onChangeUiFontScale && (
                        <div
                          data-testid="v11-font-scale-switcher"
                          className="rounded-2xl bg-white/[0.04] border border-white/[0.10] p-2.5 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-semibold text-slate-200 tracking-wide">
                              Etiket Boyutu
                            </span>
                            <button
                              type="button"
                              onClick={() => onChangeUiFontScale(1)}
                              title="Varsayılan boyuta (%100) sıfırla"
                              className={`h-5 px-2 rounded-full text-[10px] font-mono font-bold transition cursor-pointer border ${
                                Math.abs(uiFontScale - 1) < 0.01
                                  ? "bg-sky-500/15 border-sky-400/30 text-sky-300"
                                  : "bg-sky-500/25 border-sky-400/50 text-white hover:bg-sky-500/35"
                              }`}
                            >
                              %{Math.round(uiFontScale * 100)}
                              {Math.abs(uiFontScale - 1) >= 0.01 && <span className="ml-1 opacity-80">↺</span>}
                            </button>
                          </div>
                          <div className="flex items-center gap-2 rounded-xl bg-black/35 border border-white/[0.10] p-1">
                            <button
                              type="button"
                              onClick={() => onChangeUiFontScale(Math.max(0.75, Number((uiFontScale - 0.15).toFixed(2))))}
                              disabled={uiFontScale <= 0.75}
                              title="Etiketleri küçült"
                              className="w-7 h-7 rounded-lg bg-white/[0.07] hover:bg-white/[0.16] active:scale-95 text-[11px] font-bold text-slate-100 disabled:opacity-30 flex items-center justify-center transition cursor-pointer shrink-0"
                            >
                              A−
                            </button>
                            <input
                              type="range"
                              min={0.75}
                              max={1.6}
                              step={0.05}
                              value={uiFontScale}
                              onChange={(e) => onChangeUiFontScale(Number(e.target.value))}
                              aria-label="Etiket Boyutu"
                              className="flex-1 h-1.5 rounded-full accent-sky-400 cursor-pointer bg-white/15"
                            />
                            <button
                              type="button"
                              onClick={() => onChangeUiFontScale(Math.min(1.6, Number((uiFontScale + 0.15).toFixed(2))))}
                              disabled={uiFontScale >= 1.6}
                              title="Etiketleri büyüt"
                              className="w-7 h-7 rounded-lg bg-white/[0.07] hover:bg-white/[0.16] active:scale-95 text-[11.5px] font-bold text-slate-100 disabled:opacity-30 flex items-center justify-center transition cursor-pointer shrink-0"
                            >
                              A+
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-slate-300">Geçmiş</span>
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={onUndo}
                            disabled={!canUndo}
                            title="Geri Al (Ctrl+Z)"
                            className="h-7 px-2.5 rounded-full bg-white/[0.08] hover:bg-white/[0.16] border border-white/[0.12] text-slate-200 disabled:opacity-35 flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
                          >
                            <Undo2 className="w-3 h-3" />
                            <span>Geri</span>
                          </button>
                          <button
                            type="button"
                            onClick={onRedo}
                            disabled={!canRedo}
                            title="İleri Al (Ctrl+Y)"
                            className="h-7 px-2.5 rounded-full bg-white/[0.08] hover:bg-white/[0.16] border border-white/[0.12] text-slate-200 disabled:opacity-35 flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
                          >
                            <Redo2 className="w-3 h-3" />
                            <span>İleri</span>
                          </button>
                        </div>
                      </div>

                      {onOpenDoorShowcase && (
                        <button
                          type="button"
                          data-testid="v11-open-door-showcase"
                          onClick={() => {
                            setSettingsOpen(false);
                            onOpenDoorShowcase();
                          }}
                          className="w-full h-8 px-3 rounded-xl bg-white/[0.09] hover:bg-white/[0.18] border border-white/[0.14] text-[#F3F4F6] text-[11.5px] font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                        >
                          <span>Kapak Çeşitlerini Karşılaştır</span>
                        </button>
                      )}
                    </div>
                  </AnimatedPopoverPresence>
                  </div>,
                  document.body
                )}
            </div>

            {/* Aktif Mühendislik Hata / Uyarı Açıklama Menüsü */}
            {engineeringFindings.length > 0 && (
              <div ref={issuesRef} className="relative">
                <button
                  type="button"
                  data-testid="v11-header-issues-btn"
                  onClick={() => { setOutputsOpen(false); setVariantOpen(false); setSettingsOpen(false); setIssuesOpen((v) => !v); }}
                  className={`h-9 max-sm:h-8 px-3 max-sm:px-2 rounded-full border text-xs max-sm:text-[11px] font-semibold whitespace-nowrap flex items-center gap-1.5 max-sm:gap-1 shadow-[0_4px_14px_rgba(0,0,0,0.44),inset_0_1px_0_rgba(255,255,255,0.16)] hover:shadow-[0_6px_18px_rgba(0,0,0,0.56),inset_0_1px_0_rgba(255,255,255,0.22)] transition cursor-pointer shrink-0 ${
                    blockingIssueCount > 0
                      ? "bg-red-50 hover:bg-red-100 border-red-300 text-red-800"
                      : "bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-900"
                  }`}
                  title="Projede tespit edilen hata ve önerilerin açıklamalarını gör"
                >
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">
                    {blockingIssueCount > 0
                      ? `${blockingIssueCount} Hata`
                      : `${engineeringFindings.length} Öneri`}
                  </span>
                  <span className="sm:hidden font-mono">
                    {blockingIssueCount > 0 ? blockingIssueCount : engineeringFindings.length}
                  </span>
                </button>

                {typeof document !== "undefined" && createPortal(
                <AnimatedPopoverPresence isOpen={issuesOpen} origin="top-right" className="fixed right-28 top-[68px] max-xl:right-3 max-sm:left-3 max-xl:top-[104px] z-[90]">
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
                onClick={() => { setIssuesOpen(false); setVariantOpen(false); setSettingsOpen(false); setOutputsOpen((v) => !v); }}
                className="h-9 max-sm:h-8 px-3.5 max-sm:px-2 rounded-full bg-white/[0.10] hover:bg-white/[0.18] border border-white/[0.15] text-[#F3F4F6] text-xs max-sm:text-[11px] font-semibold flex items-center gap-1.5 max-sm:gap-0.5 shadow-[0_4px_14px_rgba(0,0,0,0.44),inset_0_1px_0_rgba(255,255,255,0.16)] hover:shadow-[0_6px_18px_rgba(0,0,0,0.56),inset_0_1px_0_rgba(255,255,255,0.22)] transition cursor-pointer shrink-0"
              >
                <Download className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                <span className="hidden sm:inline">Çıktılar</span>
                {blockingIssueCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                )}
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:inline shrink-0" />
              </button>

              {portalMounted && createPortal(
              <div
                className="fixed z-[90] pointer-events-none"
                style={{ top: outputsAnchor.top, right: outputsAnchor.right }}
              >
              <AnimatedPopoverPresence isOpen={outputsOpen} origin="top-right" className="pointer-events-auto">
                <div
                  data-testid="v11-outputs-dropdown"
                  data-birim-portal-menu="true"
                  style={{
                    background: "rgba(30, 36, 48, 0.72)",
                    backdropFilter: "blur(36px) saturate(195%)",
                    WebkitBackdropFilter: "blur(36px) saturate(195%)",
                  }}
                  className="mt-1.5 w-76 max-w-[calc(100vw-24px)] max-h-[76dvh] overflow-y-auto rounded-3xl border border-white/[0.22] ring-1 ring-black/50 shadow-[0_26px_64px_rgba(0,0,0,0.62)] p-2 text-xs text-[#F3F4F6]"
                >
                  {experienceTier !== "simple" && (<>
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#8C7A6B]">
                    Teknik Planlama
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setOutputsOpen(false);
                      onOpenMepModal();
                    }}
                    className="group w-full px-2.5 py-2 rounded-2xl hover:bg-[#EFECE4] flex items-center gap-3 text-left transition cursor-pointer"
                  >
                    <span className="w-8 h-8 rounded-xl bg-[#EFECE4]/80 group-hover:bg-[#0284C7]/35 flex items-center justify-center shrink-0 transition">
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
                    <span className="w-8 h-8 rounded-xl bg-[#EFECE4]/80 group-hover:bg-[#0284C7]/35 flex items-center justify-center shrink-0 transition">
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
                    <span className="w-8 h-8 rounded-xl bg-[#EFECE4]/80 group-hover:bg-[#0284C7]/35 flex items-center justify-center shrink-0 transition">
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
                    <span className="w-8 h-8 rounded-xl bg-[#EFECE4]/80 group-hover:bg-[#0284C7]/35 flex items-center justify-center shrink-0 transition">
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
                    <span className="w-8 h-8 rounded-xl bg-[#EFECE4]/80 group-hover:bg-[#0284C7]/35 flex items-center justify-center shrink-0 transition">
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
                    <span className="w-8 h-8 rounded-xl bg-sky-50 group-hover:bg-[#0284C7]/35 flex items-center justify-center shrink-0 transition">
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
                    <span className="w-8 h-8 rounded-xl bg-[#EFECE4]/80 group-hover:bg-[#0284C7]/35 flex items-center justify-center shrink-0 transition">
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
                    <span className="w-8 h-8 rounded-xl bg-[#EFECE4]/80 group-hover:bg-[#0284C7]/35 flex items-center justify-center shrink-0 transition">
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
                    <span className="w-8 h-8 rounded-xl bg-[#EFECE4]/80 group-hover:bg-[#0284C7]/35 flex items-center justify-center shrink-0 transition">
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
                    <span className="w-8 h-8 rounded-xl bg-[#EFECE4]/80 group-hover:bg-[#0284C7]/35 flex items-center justify-center shrink-0 transition">
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
              </AnimatedPopoverPresence>
              </div>, document.body)}
            </div>

            <button
              type="button"
              data-testid="v11-open-quote-cta"
              onClick={onOpenQuoteModal}
              className="h-9 max-sm:h-8 px-4 max-sm:px-2.5 rounded-full bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] hover:from-[#0369A1] hover:to-[#1D4ED8] text-white text-xs max-sm:text-[11px] font-bold flex items-center gap-2 max-sm:gap-1 shadow-[0_0_20px_rgba(29,78,216,0.45)] transition cursor-pointer shrink-0"
            >
              <span className="font-mono font-bold tracking-tight">{formattedPrice}</span>
              <span className="opacity-45 hidden sm:inline">•</span>
              <FileText className="w-3.5 h-3.5 text-[#7DD3FC] shrink-0" />
              <span className="hidden sm:inline">Teklif</span>
            </button>
          </div>
          )}
        </div>

        {/* Kolay Mod Yönlendirici 3 Adım Şeridi — yalnızca sağ denetçi kapalıyken görünür; ilk ekranda çifte bar ve çakışma yaratmaz */}
        {!isShowroom && !isReadOnlyCustomer && experienceTier === "simple" && !isInspectorOpen && onQuickNavigateStep && (
          <div
            data-testid="v12-guided-step-strip"
            className="pointer-events-auto inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#FAF8F4]/95 backdrop-blur-xl border border-[#DFD9CE] shadow-sm text-[11px] text-[#141413]"
          >
            <button
              type="button"
              onClick={() => onQuickNavigateStep("dimensions")}
              className={`h-6 px-2.5 rounded-full font-semibold transition cursor-pointer ${
                activeInspectorTab === "dimensions"
                  ? "bg-[#141413] text-white"
                  : "text-[#57534E] hover:text-[#141413]"
              }`}
            >
              1. Ölçü &amp; Gövde
            </button>
            <span className="text-slate-300 font-bold" aria-hidden="true">→</span>
            <button
              type="button"
              onClick={() => onQuickNavigateStep("interior")}
              className={`h-6 px-2.5 rounded-full font-semibold transition cursor-pointer ${
                activeInspectorTab !== "dimensions"
                  ? "bg-[#141413] text-white"
                  : "text-[#57534E] hover:text-[#141413]"
              }`}
            >
              2. İç Düzen &amp; Yüzey
            </button>
            <span className="text-slate-300 font-bold" aria-hidden="true">→</span>
            <button
              type="button"
              data-testid="v12-one-click-presentation-btn"
              onClick={() => onQuickNavigateStep("showroom")}
              className="h-6 px-2.5 rounded-full bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] hover:brightness-110 border border-[#38BDF8]/65 text-white font-bold shadow-[0_2px_12px_rgba(37,99,235,0.42)] transition cursor-pointer"
            >
              3. Sunumda Gör
            </button>
          </div>
        )}

        {workspaceMode === "2d" && (
          <div className="pointer-events-auto max-w-[calc(100vw-16px)] overflow-x-auto no-scrollbar px-1.5 py-1 rounded-full bg-[#2A313F]/66 backdrop-blur-2xl border border-white/[0.22] ring-1 ring-black/50 shadow-[0_14px_36px_rgba(0,0,0,0.45)] flex items-center gap-1 text-xs text-[#F3F4F6] whitespace-nowrap">
            {(
              [
                { id: "elevation", label: "Ön Cephe", fullLabel: "Ön Cephe Görünüşü", Icon: Eye },
                { id: "section", label: "Kesit", fullLabel: "A-A Yan Kesit", Icon: Scissors },
                { id: "split", label: "3B+2B", fullLabel: "3B + 2B Bölünmüş Ekran", Icon: Columns2 },
              ] as const
            ).map((sub) => {
              const active = cadSubMode === sub.id;
              const SubIcon = sub.Icon;
              return (
                <button
                  key={sub.id}
                  type="button"
                  title={sub.fullLabel}
                  onClick={() => onChangeCadSubMode(sub.id)}
                  className={`h-7 px-2.5 rounded-full font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                    active
                      ? "bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] text-white font-bold shadow-xs"
                      : "text-slate-300 hover:text-white hover:bg-white/[0.08]"
                  }`}
                >
                  <SubIcon className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden md:inline">{sub.fullLabel}</span>
                  <span className="md:hidden">{sub.label}</span>
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
