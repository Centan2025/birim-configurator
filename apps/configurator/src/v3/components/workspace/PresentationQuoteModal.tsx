"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { DesignProject, MaterialDefinition, calculateBayWidths } from "@birim/core";
import { PricingBreakdown } from "@birim/pricing";
import {
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Link2,
  Printer,
  RefreshCw,
  SlidersHorizontal,
  X,
} from "lucide-react";

export interface CustomerAndFactoryStats {
  hangingGarments: number;
  foldedGarments: number;
  drawerCount: number;
  shoePairs: number;
  totalPanelAreaM2: number;
  sheetCount2800x2070: number;
  edgeBandingMeters: number;
  mainWallLen: number;
  totalModWidth: number;
  remainingWallGapMm: number;
  leftFillerMm: number;
  rightFillerMm: number;
}

type StudioPreviewMode = "3d_iso" | "3d_current" | "3d_front" | "elevation";

type SnapshotWindow = Window & {
  __birimCapture3DSnapshot?: (opts?: {
    angle?: "current" | "iso" | "front";
    hideOverlays?: boolean;
  }) => string;
  __birimRenderUltraStudioPhoto?: (opts?: {
    angle?: "current" | "iso" | "front";
    width?: number;
    height?: number;
    onProgress?: (pct: number) => void;
  }) => Promise<string>;
};

export interface PresentationQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: DesignProject;
  materials: MaterialDefinition[];
  pricing: PricingBreakdown;
  stats: CustomerAndFactoryStats;
  activeConceptTier: "eco" | "smart" | "signature";
  onApplyConceptTier: (tier: "eco" | "smart" | "signature") => void;
  onSmartWallAutoFill: (
    preset: "wardrobe_max" | "his_hers" | "kitchen_smart" | "zero_gap_filler"
  ) => void;
  quoteDiscountPct: number;
  onChangeDiscountPct: (pct: number) => void;
  quoteInstallments: number;
  onChangeInstallments: (inst: number) => void;
  ledEnabled: boolean;
  onToggleLedUpsell: () => void;
  onAddTrouserUpsell: () => void;
  onAddJewelryUpsell: () => void;
  onApplyGlassDoorUpsell: () => void;
  onFix32mmCollisions: () => void;
  compatibilityStatus: string;
  onPrintVisualPdf: (meta?: { clientName?: string; projectNote?: string; snapshotDataUrl?: string }) => void;
  onOpenNestingModal: () => void;
  onOpenBomModal: () => void;
}

export const PresentationQuoteModal: React.FC<PresentationQuoteModalProps> = ({
  isOpen,
  onClose,
  project,
  materials,
  pricing,
  stats,
  activeConceptTier,
  onApplyConceptTier,
  onSmartWallAutoFill,
  quoteDiscountPct,
  onChangeDiscountPct,
  quoteInstallments,
  onChangeInstallments,
  ledEnabled,
  onToggleLedUpsell,
  onAddTrouserUpsell,
  onAddJewelryUpsell,
  onApplyGlassDoorUpsell,
  onFix32mmCollisions,
  compatibilityStatus,
  onPrintVisualPdf,
  onOpenNestingModal,
  onOpenBomModal,
}) => {
  const [visualMode, setVisualMode] = useState<StudioPreviewMode>("3d_iso");
  const [snapshotUrl, setSnapshotUrl] = useState<string>("");
  const [ultraProgress, setUltraProgress] = useState<number | null>(null);
  const [isUltraRendered, setIsUltraRendered] = useState<boolean>(false);
  const [showConsultantTools, setShowConsultantTools] = useState<boolean>(false);
  const [clientName, setClientName] = useState<string>("");
  const [projectNote, setProjectNote] = useState<string>("");
  const [copiedWhatsapp, setCopiedWhatsapp] = useState<boolean>(false);
  const [shareState, setShareState] = useState<{
    loading: boolean;
    url: string | null;
    copied: boolean;
  }>({ loading: false, url: null, copied: false });

  const captureCanvasSnapshot = useCallback((modeOverride?: StudioPreviewMode) => {
    if (typeof window === "undefined") return;
    const targetMode = modeOverride ?? visualMode;
    if (targetMode === "elevation") return;
    const angle: "iso" | "current" | "front" =
      targetMode === "3d_current"
        ? "current"
        : targetMode === "3d_front"
        ? "front"
        : "iso";

    const win = window as SnapshotWindow;
    if (typeof win.__birimCapture3DSnapshot === "function") {
      const captured = win.__birimCapture3DSnapshot({
        angle,
        hideOverlays: true,
      });
      if (captured && captured.length > 1600) {
        setSnapshotUrl(captured);
        setIsUltraRendered(false);
        return;
      }
    }
    setSnapshotUrl("");
  }, [visualMode]);

  useEffect(() => {
    if (!isOpen || visualMode === "elevation") return;
    // Wait 1 animation frame so V3ThreeViewport mesh & material effects commit before synchronous WebGL render+capture
    const rafId = window.requestAnimationFrame(() => {
      captureCanvasSnapshot(visualMode);
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [isOpen, visualMode, project.version, activeConceptTier, ledEnabled, captureCanvasSnapshot]);

  const matMap = useMemo(() => new Map(materials.map((m) => [m.id, m])), [materials]);

  const mainModules = useMemo(
    () => project.modules.filter((m) => m.category !== "complementary"),
    [project.modules]
  );

  const maxHeightMm = useMemo(
    () =>
      mainModules.length > 0
        ? Math.max(...mainModules.map((m) => m.dimensions.height))
        : 2200,
    [mainModules]
  );
  const maxDepthMm = useMemo(
    () =>
      mainModules.length > 0
        ? Math.max(...mainModules.map((m) => m.dimensions.depth))
        : 600,
    [mainModules]
  );

  const primaryBodyMat = matMap.get(mainModules[0]?.carcass.bodyMaterialId || "") || materials[0];
  const primaryDoorMat =
    matMap.get(mainModules[0]?.carcass.doorMaterialId || "") || materials[2] || materials[0];

  const listTotalEur = pricing.totalWithVatEur;
  const discountEur = (listTotalEur * quoteDiscountPct) / 100;
  const netTotalEur = listTotalEur - discountEur;
  const monthlyEur = netTotalEur / Math.max(1, quoteInstallments);

  const ecoPrice = Math.round(
    pricing.materialAlternatives?.find((a) => a.tier === "economy")?.estimatedTotalEur ??
      listTotalEur * 0.86
  );
  const smartPrice = Math.round(listTotalEur);
  const signaturePrice = Math.round(
    pricing.materialAlternatives?.find((a) => a.tier === "premium")?.estimatedTotalEur ??
      listTotalEur * 1.18
  );

  const handleCreateShareLink = async () => {
    setShareState((prev) => ({ ...prev, loading: true }));
    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project,
          clientName: clientName.trim() || undefined,
          notes: projectNote.trim() || undefined,
          discountPct: quoteDiscountPct,
          installments: quoteInstallments,
          totalEur: Number(netTotalEur.toFixed(2)),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const code = data.shortCode || data.code || `BRM-${project.id.slice(0, 6).toUpperCase()}`;
        const fullUrl =
          typeof window !== "undefined"
            ? `${window.location.origin}/p/${code}`
            : `/p/${code}`;
        if (typeof navigator !== "undefined" && navigator.clipboard) {
          await navigator.clipboard.writeText(fullUrl).catch(() => {});
        }
        setShareState({ loading: false, url: fullUrl, copied: true });
        setTimeout(() => setShareState((s) => ({ ...s, copied: false })), 3500);
        return;
      }
    } catch {
      // Offline / static fallback
    }
    const fallbackCode = `BRM-${Math.abs(project.version * 7919 + mainModules.length * 131)
      .toString(36)
      .toUpperCase()
      .slice(0, 6)}`;
    const fallbackUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/p/${fallbackCode}`
        : `/p/${fallbackCode}`;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(fallbackUrl).catch(() => {});
    }
    setShareState({ loading: false, url: fallbackUrl, copied: true });
    setTimeout(() => setShareState((s) => ({ ...s, copied: false })), 3500);
  };

  const handleCopyWhatsapp = () => {
    const netStr = netTotalEur.toLocaleString("tr-TR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const monthlyStr = monthlyEur.toLocaleString("tr-TR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const lines = [
      `B1R1M MİMARİ TASARIM & TEKLİF ÖZETİ`,
      clientName.trim() ? `Müşteri: ${clientName.trim()}` : null,
      `Proje: ${project.title}`,
      `Toplam Ölçü: ${(stats.totalModWidth / 10).toFixed(0)} × ${(maxHeightMm / 10).toFixed(0)} × ${(maxDepthMm / 10).toFixed(0)} cm (${mainModules.length} Modül)`,
      `Yüzey Seçimi: ${primaryDoorMat?.name.split(" (")[0] || "Özel Yüzey"} / ${primaryBodyMat?.name.split(" (")[0] || "Beyaz Gövde"}`,
      `İç Kapasite: ~${stats.hangingGarments} Askılı • ~${stats.foldedGarments} Katlı • ${stats.drawerCount} Frenli Çekmece`,
      `Net Teklif Tutarı${quoteDiscountPct > 0 ? ` (%${quoteDiscountPct} İskontolu)` : ""}: €${netStr} (KDV Dahil)`,
      quoteInstallments > 1 ? `Ödeme Planı: ${quoteInstallments} × €${monthlyStr} / ay` : `Ödeme Planı: Peşin`,
      `Teslim & Kurulum: 14 İş Günü (Birim Uzman Montaj Dahil)`,
      projectNote.trim() ? `Not: ${projectNote.trim()}` : null,
      shareState.url ? `3D Online İnceleme: ${shareState.url}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(lines).catch(() => {});
    }
    setCopiedWhatsapp(true);
    setTimeout(() => setCopiedWhatsapp(false), 3200);
  };

  if (!isOpen) return null;

  const elevSpanW = Math.max(
    stats.totalModWidth + 200,
    ...mainModules.map((m) => (m.position?.x || 0) + m.dimensions.width + 100),
    1200
  );
  const elevSpanH = Math.max(maxHeightMm + 280, 2480);

  // Isometric 3D Vector Architectural Studio Fallback (used if WebGL context is unavailable)
  const isoSkewX = Math.round(maxDepthMm * 0.42);
  const isoSkewY = Math.round(maxDepthMm * 0.24);

  return (
    <div
      data-testid="v4-quick-sell-modal"
      className="fixed inset-0 z-[120] bg-[#141413]/55 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-[#FAF9F6] rounded-2xl border border-[#DED8CC] shadow-[0_32px_80px_-20px_rgba(20,20,19,0.42)] max-w-6xl w-full max-h-[93vh] flex flex-col overflow-hidden text-[#141413]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Minimalist B1R1M Architectural Header */}
        <div className="px-6 py-4 bg-white border-b border-[#E5E0D5] flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-4 min-w-0">
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-base font-black tracking-[0.2em] text-[#141413]">B1R1M</span>
              <span className="h-4 w-px bg-[#D6D0C4]" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#78716C]">
                Sunum &amp; Teklif Stüdyosu
              </span>
            </div>
            <div className="hidden md:flex items-center gap-2 text-xs text-[#57534E] truncate">
              <span>•</span>
              <span className="font-medium text-[#141413] truncate">{project.title}</span>
              <span className="px-2 py-0.5 rounded bg-[#F4F1EA] border border-[#E5E0D5] font-mono text-[11px] text-[#57534E]">
                {mainModules.length} Modül • {(stats.totalModWidth / 10).toFixed(0)} cm
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowConsultantTools((v) => !v)}
              className={`h-8 px-3 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
                showConsultantTools
                  ? "bg-[#141413] text-[#FAF9F6] border-[#141413]"
                  : "bg-[#FAF9F6] hover:bg-[#EFECE5] text-[#44403C] border-[#DED8CC]"
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Danışman &amp; Atölye Araçları</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${
                  showConsultantTools ? "rotate-180" : ""
                }`}
              />
            </button>

            <button
              type="button"
              data-testid="close-quick-sell-modal-btn"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-[#FAF9F6] hover:bg-[#EFECE5] border border-[#DED8CC] text-[#44403C] flex items-center justify-center transition cursor-pointer"
              aria-label="Kapat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Editorial Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Collapsible Showroom Consultant & CNC Tools Drawer */}
          <div
            className={`grid transition-all duration-200 ease-out ${
              showConsultantTools
                ? "grid-rows-[1fr] opacity-100"
                : "grid-rows-[0fr] opacity-0 pointer-events-none"
            }`}
          >
            <div className="overflow-hidden">
              <div className="p-4 rounded-xl bg-white border border-[#E5E0D5] space-y-4 mb-1">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#57534E]">
                        Hızlı Duvar Yerleşim Şablonları ({(stats.mainWallLen / 10).toFixed(0)} cm Duvar)
                      </span>
                      <span className="text-[11px] text-[#78716C]">2×5 cm kör çıta paylı</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <button
                        type="button"
                        data-testid="autofill-wardrobe-max-btn"
                        onClick={() => onSmartWallAutoFill("wardrobe_max")}
                        className="p-2.5 rounded-lg bg-[#FAF9F6] hover:bg-[#F2EFE8] border border-[#E5E0D5] text-left transition cursor-pointer"
                      >
                        <div className="text-xs font-semibold text-[#141413]">Ebeveyn Gardırobu</div>
                        <div className="text-[10px] text-[#78716C] mt-0.5">Askı &amp; çekmece dengeli</div>
                      </button>
                      <button
                        type="button"
                        data-testid="autofill-his-hers-btn"
                        onClick={() => onSmartWallAutoFill("his_hers")}
                        className="p-2.5 rounded-lg bg-[#FAF9F6] hover:bg-[#F2EFE8] border border-[#E5E0D5] text-left transition cursor-pointer"
                      >
                        <div className="text-xs font-semibold text-[#141413]">Çift Kişilik Sürme</div>
                        <div className="text-[10px] text-[#78716C] mt-0.5">Simetrik giyinme</div>
                      </button>
                      <button
                        type="button"
                        data-testid="autofill-kitchen-smart-btn"
                        onClick={() => onSmartWallAutoFill("kitchen_smart")}
                        className="p-2.5 rounded-lg bg-[#FAF9F6] hover:bg-[#F2EFE8] border border-[#E5E0D5] text-left transition cursor-pointer"
                      >
                        <div className="text-xs font-semibold text-[#141413]">Mimari Mutfak</div>
                        <div className="text-[10px] text-[#78716C] mt-0.5">Eviye, ankastre &amp; kiler</div>
                      </button>
                      <button
                        type="button"
                        data-testid="autofill-zero-gap-btn"
                        onClick={() => onSmartWallAutoFill("zero_gap_filler")}
                        className="p-2.5 rounded-lg bg-[#FAF9F6] hover:bg-[#F2EFE8] border border-[#D6C7B2] text-left transition cursor-pointer"
                      >
                        <div className="text-xs font-semibold text-[#141413]">Boşluğu Hizala</div>
                        <div className="text-[10px] text-[#78716C] mt-0.5">
                          Kalan {stats.remainingWallGapMm} mm
                        </div>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#57534E]">
                        İç Donanım Eklentileri &amp; Fabrika Doğrulama
                      </span>
                      <span className="text-[11px] font-mono text-[#57534E]">
                        {stats.sheetCount2800x2070} Plaka • {stats.edgeBandingMeters} mt Bant
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        data-testid="upsell-led-btn"
                        onClick={onToggleLedUpsell}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                          ledEnabled
                            ? "bg-[#141413] text-[#FAF9F6] border-[#141413]"
                            : "bg-[#FAF9F6] hover:bg-[#EFECE5] text-[#141413] border-[#DED8CC]"
                        }`}
                      >
                        3000K Sensörlü LED {ledEnabled ? "(Aktif)" : "(+€85)"}
                      </button>
                      <button
                        type="button"
                        data-testid="upsell-trouser-btn"
                        onClick={onAddTrouserUpsell}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#FAF9F6] hover:bg-[#EFECE5] text-[#141413] border border-[#DED8CC] transition cursor-pointer"
                      >
                        + Pantolonluk (+€65)
                      </button>
                      <button
                        type="button"
                        data-testid="upsell-jewelry-btn"
                        onClick={onAddJewelryUpsell}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#FAF9F6] hover:bg-[#EFECE5] text-[#141413] border border-[#DED8CC] transition cursor-pointer"
                      >
                        + Takı Çekmecesi (+€75)
                      </button>
                      <button
                        type="button"
                        data-testid="upsell-glass-door-btn"
                        onClick={onApplyGlassDoorUpsell}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#FAF9F6] hover:bg-[#EFECE5] text-[#141413] border border-[#DED8CC] transition cursor-pointer"
                      >
                        Füme Cam Kapak (+€110)
                      </button>
                      <button
                        type="button"
                        data-testid="fix-32mm-hinge-shelf-btn"
                        onClick={onFix32mmCollisions}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#FAF9F6] hover:bg-[#EFECE5] text-[#44403C] border border-[#DED8CC] transition cursor-pointer"
                      >
                        System 32 Hizala
                      </button>
                      <button
                        type="button"
                        data-testid="open-nesting-from-quicksell-btn"
                        onClick={onOpenNestingModal}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white hover:bg-[#F4F1EA] text-[#141413] border border-[#D6D0C4] transition cursor-pointer"
                      >
                        Plaka Kesim Şeması
                      </button>
                      <button
                        type="button"
                        data-testid="open-bom-from-quicksell-btn"
                        onClick={onOpenBomModal}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white hover:bg-[#F4F1EA] text-[#141413] border border-[#D6D0C4] transition cursor-pointer"
                      >
                        BOM &amp; CNC Paketi
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main 12-Column Editorial Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT 7 COLUMNS: Visual Studio Preview + Spec Cards + 3-Tier Edition Selector */}
            <div className="lg:col-span-7 space-y-5">
              {/* 1. Live 3D Studio Render / 2D All-Module Interior Elevation Card */}
              <div className="rounded-xl bg-white border border-[#E5E0D5] overflow-hidden shadow-2xs">
                <div className="px-4 py-2.5 border-b border-[#EFECE5] flex flex-wrap items-center justify-between gap-2 bg-[#FAF9F6]/70">
                  <div className="inline-flex flex-wrap items-center p-0.5 rounded-lg bg-[#EFECE5] border border-[#E2DDD3] gap-0.5">
                    {[
                      { id: "3d_iso" as const, label: "3D Stüdyo" },
                      { id: "3d_front" as const, label: "3D Ön Cephe" },
                      { id: "3d_current" as const, label: "Mevcut Açı" },
                      { id: "elevation" as const, label: "2D İç Cephe" },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setVisualMode(tab.id)}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                          visualMode === tab.id
                            ? "bg-white text-[#141413] shadow-2xs"
                            : "text-[#57534E] hover:text-[#141413]"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {visualMode !== "elevation" && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        data-testid="quote-ultra-studio-render-btn"
                        disabled={ultraProgress !== null}
                        onClick={async () => {
                          if (typeof window === "undefined") return;
                          const win = window as SnapshotWindow;
                          if (typeof win.__birimRenderUltraStudioPhoto !== "function") {
                            captureCanvasSnapshot(visualMode);
                            return;
                          }
                          const angle: "iso" | "current" | "front" =
                            visualMode === "3d_current"
                              ? "current"
                              : visualMode === "3d_front"
                              ? "front"
                              : "iso";
                          setUltraProgress(0);
                          const ultraUrl = await win.__birimRenderUltraStudioPhoto({
                            angle,
                            width: 2048,
                            height: 1280,
                            onProgress: (p) => setUltraProgress(p),
                          });
                          setUltraProgress(null);
                          if (ultraUrl && ultraUrl.length > 1600) {
                            setSnapshotUrl(ultraUrl);
                            setIsUltraRendered(true);
                          }
                        }}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                          isUltraRendered
                            ? "bg-[#1E3F2F] text-white"
                            : "bg-[#141413] hover:bg-[#292524] text-[#FAF9F6]"
                        } disabled:opacity-60`}
                        title="16 katmanlı yumuşak alan gölgesi ve kenar yumuşatma ile 2K katalog kalitesinde stüdyo fotoğrafı üretir"
                      >
                        <span>
                          {ultraProgress !== null
                            ? `2K Render %${ultraProgress}`
                            : isUltraRendered
                            ? "✓ 2K Stüdyo Hazır"
                            : "Stüdyo Render Al (2K)"}
                        </span>
                      </button>

                      {snapshotUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            const a = document.createElement("a");
                            a.href = snapshotUrl;
                            a.download = `Birim_Teklif_Render_${project.id}.png`;
                            document.body.appendChild(a);
                            a.click();
                            setTimeout(() => {
                              if (a.parentNode) a.parentNode.removeChild(a);
                            }, 1000);
                          }}
                          className="px-2 py-1 rounded-md text-[11px] font-medium bg-white hover:bg-[#EFECE5] border border-[#DED8CC] text-[#141413] transition cursor-pointer"
                          title="Mevcut stüdyo görselini yüksek çözünürlüklü PNG olarak indir"
                        >
                          PNG İndir
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => captureCanvasSnapshot(visualMode)}
                        className="p-1 rounded-md text-[#57534E] hover:text-[#141413] hover:bg-[#EFECE5] transition cursor-pointer"
                        title="Görüntüyü Yenile"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="h-[272px] sm:h-[304px] bg-[#EDEAE4] flex items-center justify-center relative overflow-hidden">
                  {visualMode !== "elevation" && snapshotUrl ? (
                    <img
                      src={snapshotUrl}
                      alt={project.title}
                      data-testid="quote-studio-3d-snapshot-img"
                      className="w-full h-full object-contain"
                    />
                  ) : visualMode !== "elevation" ? (
                    /* Architectural 3D Isometric Studio Fallback if WebGL buffer is unavailable */
                    <svg
                      viewBox={`-120 ${-isoSkewY - 140} ${elevSpanW + isoSkewX + 240} ${maxHeightMm + isoSkewY + 260}`}
                      className="w-full h-full bg-[#EDEAE4] p-3"
                    >
                      <ellipse
                        cx={(stats.totalModWidth + isoSkewX) / 2}
                        cy={maxHeightMm + 28}
                        rx={Math.max(420, stats.totalModWidth * 0.56)}
                        ry={48}
                        fill="rgba(20,20,19,0.12)"
                      />
                      {mainModules.map((mod) => {
                        const mx = mod.position?.x || 0;
                        const mw = mod.dimensions.width;
                        const mh = mod.dimensions.height;
                        const my = maxHeightMm - (mod.position?.y || 0) - mh;
                        const dMat = matMap.get(mod.carcass.doorMaterialId) || primaryDoorMat;
                        const bMat = matMap.get(mod.carcass.bodyMaterialId) || primaryBodyMat;
                        const doorHex = dMat?.colorHex || "#C8A982";
                        const bodyHex = bMat?.colorHex || "#F5F5F4";
                        const bayCnt = Math.max(1, mod.bays.length);
                        const leafW = mw / bayCnt;
                        return (
                          <g key={`iso_${mod.id}`}>
                            {/* Top 3D Extrusion Plane */}
                            <polygon
                              points={`${mx},${my} ${mx + isoSkewX},${my - isoSkewY} ${mx + mw + isoSkewX},${my - isoSkewY} ${mx + mw},${my}`}
                              fill={bodyHex}
                              stroke="#292524"
                              strokeWidth={3}
                            />
                            {/* Right Side 3D Extrusion Plane */}
                            <polygon
                              points={`${mx + mw},${my} ${mx + mw + isoSkewX},${my - isoSkewY} ${mx + mw + isoSkewX},${my + mh - isoSkewY} ${mx + mw},${my + mh}`}
                              fill={bodyHex}
                              stroke="#292524"
                              strokeWidth={3}
                            />
                            {/* Front Door Elevation */}
                            <rect
                              x={mx}
                              y={my}
                              width={mw}
                              height={mh}
                              fill={doorHex}
                              stroke="#141413"
                              strokeWidth={4}
                            />
                            {Array.from({ length: bayCnt }).map((_, bIdx) => {
                              const lx = mx + bIdx * leafW;
                              return (
                                <g key={`leaf_${bIdx}`}>
                                  {bIdx > 0 && (
                                    <line
                                      x1={lx}
                                      y1={my + 6}
                                      x2={lx}
                                      y2={my + mh - (mod.carcass.plinthHeight ?? 80)}
                                      stroke="#292524"
                                      strokeWidth={3}
                                    />
                                  )}
                                  <rect
                                    x={lx + (bIdx % 2 === 0 ? leafW - 32 : 22)}
                                    y={my + mh * 0.44}
                                    width={8}
                                    height={160}
                                    rx={3}
                                    fill="#CFC9BE"
                                    stroke="#57534E"
                                    strokeWidth={1.5}
                                  />
                                </g>
                              );
                            })}
                          </g>
                        );
                      })}
                    </svg>
                  ) : (
                    <svg
                      viewBox={`-100 -160 ${elevSpanW + 160} ${elevSpanH + 80}`}
                      className="w-full h-full bg-[#F7F5F0] p-3"
                    >
                      <line
                        x1={-60}
                        y1={maxHeightMm}
                        x2={elevSpanW}
                        y2={maxHeightMm}
                        stroke="#78716C"
                        strokeWidth={6}
                      />
                      {mainModules.map((mod, mIdx) => {
                        const mx = mod.position?.x || 0;
                        const mw = mod.dimensions.width;
                        const mh = mod.dimensions.height;
                        const my = maxHeightMm - (mod.position?.y || 0) - mh;
                        const T = mod.carcass.panelThickness || 18;
                        const plinthH = mod.carcass.plinthHeight ?? 80;
                        const innerH = Math.max(200, mh - plinthH - 2 * T);
                        const bayWidths = calculateBayWidths(mod);
                        let accBayX = mx + T;
                        return (
                          <g key={mod.id}>
                            <rect
                              x={mx}
                              y={my}
                              width={mw}
                              height={mh}
                              fill="#FFFFFF"
                              stroke="#141413"
                              strokeWidth={6}
                            />
                            {plinthH > 0 && (
                              <rect
                                x={mx + T}
                                y={my + mh - plinthH}
                                width={Math.max(40, mw - 2 * T)}
                                height={plinthH}
                                fill="#ECE8DF"
                                stroke="#57534E"
                                strokeWidth={3}
                              />
                            )}
                            <line
                              x1={mx}
                              y1={my - 38}
                              x2={mx + mw}
                              y2={my - 38}
                              stroke="#44403C"
                              strokeWidth={3}
                            />
                            <text
                              x={mx + mw / 2}
                              y={my - 54}
                              textAnchor="middle"
                              fill="#141413"
                              fontSize="42"
                              fontWeight="700"
                              fontFamily="monospace"
                            >
                              {`${(mw / 10).toFixed(0)} cm`}
                            </text>
                            {mod.bays.map((bay, bIdx) => {
                              const bw =
                                bayWidths[bIdx] ||
                                Math.round((mw - (mod.bays.length + 1) * T) / Math.max(1, mod.bays.length));
                              const bx = accBayX;
                              accBayX += bw + T;
                              const innerBottomY = my + mh - plinthH - T;
                              return (
                                <g key={`${mod.id}_b_${bIdx}`}>
                                  {bIdx > 0 && (
                                    <rect
                                      x={bx - T}
                                      y={my + T}
                                      width={T}
                                      height={innerH}
                                      fill="#E5E0D5"
                                      stroke="#44403C"
                                      strokeWidth={2}
                                    />
                                  )}
                                  {bay.shelves.map((sh) => {
                                    const sy = innerBottomY - sh.elevationY - (sh.thickness || T);
                                    return (
                                      <rect
                                        key={sh.id}
                                        x={bx}
                                        y={sy}
                                        width={bw}
                                        height={sh.thickness || T}
                                        fill="#D6C7B2"
                                        stroke="#57534E"
                                        strokeWidth={2.5}
                                      />
                                    );
                                  })}
                                  {bay.hangingRails.map((rl) => {
                                    const ry = innerBottomY - rl.elevationY;
                                    return (
                                      <line
                                        key={rl.id}
                                        x1={bx + 8}
                                        y1={ry}
                                        x2={bx + bw - 8}
                                        y2={ry}
                                        stroke="#78716C"
                                        strokeWidth={8}
                                      />
                                    );
                                  })}
                                  {bay.drawers.map((dr) => {
                                    const dy = innerBottomY - dr.elevationY - dr.height;
                                    return (
                                      <g key={dr.id}>
                                        <rect
                                          x={bx + 3}
                                          y={dy + 2}
                                          width={Math.max(20, bw - 6)}
                                          height={Math.max(24, dr.height - 4)}
                                          fill="#F4F1EA"
                                          stroke="#57534E"
                                          strokeWidth={3}
                                        />
                                        <line
                                          x1={bx + bw * 0.36}
                                          y1={dy + dr.height * 0.42}
                                          x2={bx + bw * 0.64}
                                          y2={dy + dr.height * 0.42}
                                          stroke="#141413"
                                          strokeWidth={4}
                                        />
                                      </g>
                                    );
                                  })}
                                </g>
                              );
                            })}
                            <text
                              x={mx + mw / 2}
                              y={my + mh + 56}
                              textAnchor="middle"
                              fill="#57534E"
                              fontSize="36"
                              fontWeight="600"
                              fontFamily="sans-serif"
                            >
                              {`M${mIdx + 1}`}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  )}
                </div>

                {/* 4-Column Calm Architectural Spec Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#EFECE5] border-t border-[#EFECE5] bg-white text-xs">
                  <div className="p-3">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#78716C]">
                      Toplam Ebat
                    </div>
                    <div className="font-mono font-bold text-[#141413] mt-0.5">
                      {(stats.totalModWidth / 10).toFixed(0)} × {(maxHeightMm / 10).toFixed(0)} ×{" "}
                      {(maxDepthMm / 10).toFixed(0)} cm
                    </div>
                  </div>

                  <div className="p-3">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#78716C]">
                      Kapak &amp; Gövde
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 truncate">
                      <span
                        className="w-3 h-3 rounded-full border border-[#D6D0C4] shrink-0"
                        style={{ backgroundColor: primaryDoorMat?.colorHex || "#d6c7b2" }}
                      />
                      <span className="font-semibold text-[#141413] truncate">
                        {primaryDoorMat?.name.split(" (")[0] || "Özel Yüzey"}
                      </span>
                    </div>
                  </div>

                  <div className="p-3">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#78716C]">
                      İç Hacim Özeti
                    </div>
                    <div className="font-semibold text-[#141413] mt-0.5 truncate">
                      ~{stats.hangingGarments} Askı • {stats.drawerCount} Çekmece
                    </div>
                  </div>

                  <div className="p-3">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#78716C]">
                      Mühendislik
                    </div>
                    <div className="font-semibold text-[#141413] mt-0.5 truncate">
                      {compatibilityStatus === "INCOMPATIBLE"
                        ? "Kontrol Gerekli"
                        : "Blum • System 32"}
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Calm 3-Tier Architectural Edition Comparison */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#57534E]">
                    Malzeme &amp; Donanım Serisi Seçimi
                  </span>
                  <span className="text-[11px] text-[#78716C]">
                    Tıkladığınız seri 3D modele ve teklife anında uygulanır
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    {
                      id: "eco" as const,
                      testId: "concept-tier-eco-btn",
                      tag: "ESSENTIAL",
                      title: "Essential Seri",
                      desc: "18 mm Kalibre MDFLam Gövde & Kapak, Standart Menteşe",
                      price: ecoPrice,
                      badge: null,
                    },
                    {
                      id: "smart" as const,
                      testId: "concept-tier-smart-btn",
                      tag: "STUDIO",
                      title: "Studio Seri",
                      desc: "İpek Mat Supramat Kapak, Blum Frenli Sistem, 3000K İç LED",
                      price: smartPrice,
                      badge: "Önerilen",
                    },
                    {
                      id: "signature" as const,
                      testId: "concept-tier-signature-btn",
                      tag: "SIGNATURE",
                      title: "Signature Seri",
                      desc: "Doğal Meşe/Ceviz Kaplama, Füme Cam Detay, Tam Aksesuar",
                      price: signaturePrice,
                      badge: null,
                    },
                  ].map((ed) => {
                    const active = activeConceptTier === ed.id;
                    return (
                      <button
                        key={ed.id}
                        type="button"
                        data-testid={ed.testId}
                        onClick={() => onApplyConceptTier(ed.id)}
                        className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          active
                            ? "bg-white border-[#141413] ring-1 ring-[#141413] shadow-xs"
                            : "bg-white/75 hover:bg-white border-[#E5E0D5] hover:border-[#BDB5A6]"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-bold tracking-[0.14em] text-[#8C7A6B]">
                              {ed.tag}
                            </span>
                            {ed.badge ? (
                              <span className="px-1.5 py-0.5 rounded bg-[#141413] text-[#FAF9F6] text-[9px] font-semibold">
                                {ed.badge}
                              </span>
                            ) : active ? (
                              <Check className="w-3.5 h-3.5 text-[#141413]" />
                            ) : null}
                          </div>
                          <div className="text-xs font-bold text-[#141413] mt-1">{ed.title}</div>
                          <p className="text-[11px] text-[#57534E] mt-1 leading-snug">{ed.desc}</p>
                        </div>
                        <div className="mt-3 pt-2 border-t border-[#F0EDE6] flex items-baseline justify-between">
                          <span className="text-[10px] text-[#78716C]">Tahmini Toplam</span>
                          <span className="text-xs font-bold font-mono text-[#141413]">
                            €{ed.price.toLocaleString("tr-TR")}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* RIGHT 5 COLUMNS: Clean Client Info, Itemized Breakdown, Commercial Terms & 1-Click Share */}
            <div className="lg:col-span-5 rounded-xl bg-white border border-[#E5E0D5] shadow-xs overflow-hidden flex flex-col">
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-[#F0EDE6] pb-3">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8C7A6B]">
                      Resmi Teklif Özeti
                    </div>
                    <h3 className="text-sm font-bold text-[#141413] mt-0.5">
                      Modül Listesi &amp; Ticari Koşullar
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono text-[#78716C]">
                    {new Date().toLocaleDateString("tr-TR")}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-[#78716C] mb-1">
                      Müşteri / Muhatap
                    </label>
                    <input
                      type="text"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="Örn: Sn. Ahmet Yılmaz"
                      className="w-full h-8 px-2.5 rounded-lg bg-[#FAF9F6] border border-[#E5E0D5] text-xs text-[#141413] placeholder:text-[#A8A29E] focus:outline-none focus:border-[#141413]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-[#78716C] mb-1">
                      Proje / Teslimat Notu
                    </label>
                    <input
                      type="text"
                      value={projectNote}
                      onChange={(e) => setProjectNote(e.target.value)}
                      placeholder="Örn: İstanbul içi kat teslimi"
                      className="w-full h-8 px-2.5 rounded-lg bg-[#FAF9F6] border border-[#E5E0D5] text-xs text-[#141413] placeholder:text-[#A8A29E] focus:outline-none focus:border-[#141413]"
                    />
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#78716C] mb-1.5">
                    Projeye Dahil Modüller ({project.modules.length})
                  </div>
                  <div className="divide-y divide-[#F0EDE6] border border-[#EFECE5] rounded-lg bg-[#FAF9F6]/60 max-h-40 overflow-y-auto">
                    {project.modules.map((m, idx) => {
                      const dMat = matMap.get(m.carcass.doorMaterialId);
                      return (
                        <div
                          key={m.id}
                          className="px-3 py-2 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-[#141413] truncate">
                              {String(idx + 1).padStart(2, "0")}. {m.name}
                            </div>
                            <div className="text-[10px] text-[#78716C] truncate">
                              {dMat?.name.split(" (")[0] || "Standart Yüzey"} •{" "}
                              {m.bays?.length || 1} Bölme
                            </div>
                          </div>
                          <span className="font-mono text-[11px] font-medium text-[#44403C] shrink-0">
                            {(m.dimensions.width / 10).toFixed(0)}×
                            {(m.dimensions.height / 10).toFixed(0)}×
                            {(m.dimensions.depth / 10).toFixed(0)} cm
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-[#78716C] mb-1">
                      Proje İskontosu
                    </label>
                    <div className="grid grid-cols-4 gap-1 p-0.5 rounded-lg bg-[#F4F1EA] border border-[#E5E0D5]">
                      {[0, 5, 10, 15].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => onChangeDiscountPct(pct)}
                          className={`py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                            quoteDiscountPct === pct
                              ? "bg-[#141413] text-[#FAF9F6]"
                              : "text-[#57534E] hover:text-[#141413]"
                          }`}
                        >
                          %{pct}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-[#78716C] mb-1">
                      Taksit Planı
                    </label>
                    <div className="grid grid-cols-4 gap-1 p-0.5 rounded-lg bg-[#F4F1EA] border border-[#E5E0D5]">
                      {[1, 3, 6, 9].map((inst) => (
                        <button
                          key={inst}
                          type="button"
                          onClick={() => onChangeInstallments(inst)}
                          className={`py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                            quoteInstallments === inst
                              ? "bg-[#141413] text-[#FAF9F6]"
                              : "text-[#57534E] hover:text-[#141413]"
                          }`}
                        >
                          {inst === 1 ? "Peşin" : `${inst}x`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Architectural Dark Charcoal Total & Export Footer */}
              <div className="mt-auto bg-[#141413] text-[#FAF9F6] p-5 space-y-4">
                <div className="space-y-1.5 text-xs">
                  {quoteDiscountPct > 0 && (
                    <>
                      <div className="flex justify-between text-[#A8A29E]">
                        <span>Liste Toplamı (KDV Dahil)</span>
                        <span className="font-mono line-through">
                          €{listTotalEur.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between text-[#D6C7B2]">
                        <span>Proje İskontosu (%{quoteDiscountPct})</span>
                        <span className="font-mono">
                          −€{discountEur.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </>
                  )}

                  <div className="flex items-baseline justify-between pt-1 border-t border-white/10">
                    <div>
                      <span className="text-xs font-semibold text-[#E7E5E4] block">
                        Net Teklif Toplamı
                      </span>
                      <span className="text-[10px] text-[#A8A29E]">
                        %20 KDV, Nakliye &amp; Birim Montaj Dahil • 14 İş Günü
                      </span>
                    </div>
                    <span
                      data-testid="quick-sell-net-total"
                      className="text-xl font-bold font-mono text-[#FAF9F6]"
                    >
                      €{netTotalEur.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {quoteInstallments > 1 && (
                    <div className="flex justify-between text-[11px] text-[#D6C7B2] pt-0.5">
                      <span>{quoteInstallments} Taksit Aylık Ödeme</span>
                      <span className="font-mono font-semibold">
                        €{monthlyEur.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} / ay
                      </span>
                    </div>
                  )}
                </div>

                {shareState.url && (
                  <div className="px-3 py-2 rounded-lg bg-white/10 border border-white/15 flex items-center justify-between gap-2 text-[11px]">
                    <span className="font-mono text-[#E7E5E4] truncate">{shareState.url}</span>
                    <a
                      href={shareState.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#D6C7B2] hover:text-white shrink-0 flex items-center gap-1 font-semibold"
                    >
                      <span>Aç</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}

                <div className="space-y-2">
                  <button
                    type="button"
                    data-testid="print-visual-customer-pdf-btn"
                    onClick={() =>
                      onPrintVisualPdf({
                        clientName: clientName.trim() || undefined,
                        projectNote: projectNote.trim() || undefined,
                      })
                    }
                    className="w-full h-10 px-4 rounded-lg bg-[#FAF9F6] hover:bg-white text-[#141413] font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Görsel Müşteri Sunum &amp; Teklif Föyü (PDF / Yazdır)</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleCreateShareLink}
                      disabled={shareState.loading}
                      className="h-9 px-3 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-[#FAF9F6] text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Link2 className="w-3.5 h-3.5 text-[#D6C7B2]" />
                      <span>
                        {shareState.copied
                          ? "Link Kopyalandı"
                          : shareState.loading
                          ? "Oluşturuluyor..."
                          : "3D Paylaşım Linki"}
                      </span>
                    </button>

                    <button
                      type="button"
                      data-testid="copy-whatsapp-quote-btn"
                      onClick={handleCopyWhatsapp}
                      className="h-9 px-3 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-[#FAF9F6] text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      {copiedWhatsapp ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#D6C7B2]" />
                          <span>Özeti Kopyalandı</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-[#D6C7B2]" />
                          <span>Teklif Metni Kopyala</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PresentationQuoteModal;
