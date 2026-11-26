"use client";

import React, { useEffect, useMemo, useState } from "react";
import { formatIssueHumanTitle } from "@birim/core";
import { useConfiguratorStore } from "../store/useConfiguratorStore";
import {
  DEFAULT_BIRIM_ORG_UUID,
  computeCanonicalRequestHash,
} from "@birim/integrations";
import {
  DEFAULT_MATERIALS,
  evaluateProjectCompatibility,
  evaluateUnifiedEngineeringModel,
} from "@birim/core";
import {
  buildBirimErpNestingBundle,
  exportIndustrialCamZipArchive,
  generateThermalPartLabelsHtml,
  generateThermalPartLabelsZpl,
} from "@birim/manufacturing";
import { BirimLogo } from "../v3/design-system";
import { startZeroLagModalDrag } from "../v3/design-system/zeroLagDrag";
import {
  X,
  CheckCircle,
  ShieldCheck,
  ArrowRight,
  Store,
  Factory,
  Download,
  Scissors,
  Database,
  AlertTriangle,
  CloudUpload,
  Tag,
} from "lucide-react";

interface StoreErpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface BridgeConfigStatus {
  configured: boolean;
  mode: "live_supabase_rpc" | "offline_simulation";
  defaultOrganizationId: string;
  defaultBranchId: string | null;
  prodSafetyLockActive: boolean;
}

interface SharedR2Status {
  configured: boolean;
  source: "configurator_env" | "birim_portal_shared_env" | "unconfigured";
  bucketName: string | null;
  publicDomain: string | null;
  prodBucketLockActive: boolean;
}

export default function StoreErpModal(props: StoreErpModalProps) {
  if (!props.isOpen) return null;
  return <StoreErpModalInner {...props} />;
}

function StoreErpModalInner({ isOpen, onClose }: StoreErpModalProps) {
  const project = useConfiguratorStore((s) => s.project);
  const bom = useConfiguratorStore((s) => s.bom);
  const pricing = useConfiguratorStore((s) => s.pricing);

  const [bridgeStatus, setBridgeStatus] = useState<BridgeConfigStatus | null>(null);
  const [organizationId, setOrganizationId] = useState<string>(DEFAULT_BIRIM_ORG_UUID);
  const [branchIdOrCode, setBranchIdOrCode] = useState<string>(
    project.branchId || "8407bbdf-c03d-4aba-bcfc-17ef28c54d63"
  );
  const [existingQuotationId, setExistingQuotationId] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>(project.customerName || "");
  const [discountRatePercent, setDiscountRatePercent] = useState<number>(0);
  const [autoConvertToOrder, setAutoConvertToOrder] = useState<boolean>(false);
  const [allowSimWhenEnvMissing, setAllowSimWhenEnvMissing] = useState<boolean>(false);

  const [lastQuotationId, setLastQuotationId] = useState<string | null>(null);
  const [, setLastQuotationNo] = useState<string | null>(null);
  const [lastSalesCardId, setLastSalesCardId] = useState<string | null>(null);
  const [lastSalesNo, setLastSalesNo] = useState<string | null>(null);
  const [orderRefInput, setOrderRefInput] = useState<string>("");

  const [storeStatus, setStoreStatus] = useState<string | null>(null);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [erpStatus, setErpStatus] = useState<string | null>(null);
  const [erpJobsResult, setErpJobsResult] = useState<
    Array<{
      projectNo: string;
      materialName: string;
      thicknessMm: number;
      partsInserted: number;
      placementsInserted: number;
      sheetsUsed: number;
      utilizationPercent: number;
    }>
  >([]);
  const [erpError, setErpError] = useState<string | null>(null);
  const [r2Status, setR2Status] = useState<SharedR2Status | null>(null);
  const [sharePortalR2Bucket, setSharePortalR2Bucket] = useState<boolean>(true);
  const [lastR2ArchiveUrl, setLastR2ArchiveUrl] = useState<string | null>(null);
  const [lastR2ObjectKey, setLastR2ObjectKey] = useState<string | null>(null);
  const [r2UploadMessage, setR2UploadMessage] = useState<string | null>(null);
  const [r2UploadError, setR2UploadError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"store" | "erp" | "r2" | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    fetch("/api/integrations/store-quote", { method: "GET" })
      .then((r) => r.json())
      .then((json) => {
        if (!active || !json?.ok) return;
        setBridgeStatus({
          configured: Boolean(json.configured),
          mode: json.mode,
          defaultOrganizationId: json.defaultOrganizationId || DEFAULT_BIRIM_ORG_UUID,
          defaultBranchId: json.defaultBranchId || null,
          prodSafetyLockActive: Boolean(json.prodSafetyLockActive),
        });
        if (json.defaultOrganizationId) {
          setOrganizationId(json.defaultOrganizationId);
        }
        if (json.defaultBranchId) {
          setBranchIdOrCode(json.defaultBranchId);
        }
      })
      .catch(() => {
        // Ignore offline health probe errors
      });
    fetch("/api/integrations/r2-upload", { method: "GET" })
      .then((r) => r.json())
      .then((json) => {
        if (!active || !json?.ok) return;
        setR2Status({
          configured: Boolean(json.configured),
          source: json.source || "unconfigured",
          bucketName: json.bucketName || null,
          publicDomain: json.publicDomain || null,
          prodBucketLockActive: Boolean(json.prodBucketLockActive),
        });
      })
      .catch(() => {
        // Ignore offline R2 health probe errors
      });
    return () => {
      active = false;
    };
  }, [isOpen]);

  const unifiedGate = useMemo(() => evaluateUnifiedEngineeringModel(project), [project]);
  const compatibility = useMemo(() => evaluateProjectCompatibility(project), [project]);
  const canExportProduction =
    unifiedGate.canExportToCncAndSaw &&
    unifiedGate.canApproveFinalErpRelease &&
    compatibility.overallStatus !== "INCOMPATIBLE" &&
    compatibility.overallStatus !== "UNVERIFIED";

  const liveErpNesting = useMemo(() => {
    if (!isOpen) return null;
    const matMap = new Map(
      [...DEFAULT_MATERIALS, ...(project.customMaterials || [])].map((m) => [m.id, m])
    );
    return buildBirimErpNestingBundle(project, bom, matMap, {
      organizationId: organizationId || DEFAULT_BIRIM_ORG_UUID,
      orderRef: orderRefInput || lastSalesNo || `SIP_${project.id}_v${project.version}`,
      sheetWidthMm: 2800,
      sheetHeightMm: 2100,
      kerfMm: 4,
      edgeMarginMm: 15,
      algorithm: "Auto",
      useNetCutDimensions: true,
    });
  }, [isOpen, project, bom, organizationId, orderRefInput, lastSalesNo]);

  if (!isOpen) return null;

  const triggerDownload = (content: string, filename: string, mimeType: string) => {
    if (!canExportProduction) {
      const firstErr =
        unifiedGate.blockingSafetyAndEngineeringErrors[0] ||
        unifiedGate.verificationRequiredFindings[0];
      setErpError(
        `Üretim kapısı kilitli (${compatibility.overallStatus}): [${
          firstErr?.code ? formatIssueHumanTitle(firstErr.code, "studio") : "Kontrol Gerekli"
        }] ${firstErr?.message || ""}`
      );
      return;
    }
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (a.parentNode) a.parentNode.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1500);
  };

  const handleExportStore = async () => {
    setLoading("store");
    setStoreError(null);
    setStoreStatus(null);
    try {
      const idemSeed = computeCanonicalRequestHash({
        projectId: project.id,
        version: project.version,
        quotationId: existingQuotationId.trim() || null,
        discountRatePercent,
        autoConvertToOrder,
        totalTry: pricing.totalWithVatTry,
      }).slice(0, 20);
      const idempotencyKey = `cfg_quote_${project.id}_v${project.version}_${idemSeed}`;

      const res = await fetch("/api/integrations/store-quote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          project,
          quotationId: existingQuotationId.trim() || null,
          customerName: customerName.trim() || project.customerName || null,
          currency: "TRY",
          discountRatePercent,
          autoConvertToOrder,
          orderDraft: lastR2ArchiveUrl
            ? { camArchiveR2Url: lastR2ArchiveUrl, camArchiveR2Key: lastR2ObjectKey }
            : null,
          organizationId: organizationId.trim(),
          branchIdOrCode: branchIdOrCode.trim() || project.branchId,
          allowOfflineSimulationFallback: allowSimWhenEnvMissing,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || `Birim-Store RPC hatası (HTTP ${res.status})`);
      }

      const d = json.data;
      setLastQuotationId(d.quotationId || null);
      setLastQuotationNo(d.quotationNo || null);
      if (d.quotationId && !existingQuotationId) {
        setExistingQuotationId(d.quotationId);
      }
      if (d.salesCardId) setLastSalesCardId(d.salesCardId);
      if (d.salesNo) {
        setLastSalesNo(d.salesNo);
        setOrderRefInput(d.salesNo);
      }

      const modeTag =
        json.mode === "live_supabase_rpc" ? "Canlı Supabase RPC" : "Yerel Simülasyon";
      const orderSuffix = d.salesNo ? ` → Sipariş: ${d.salesNo}` : "";
      setStoreStatus(
        `[${modeTag}] Teklif kaydedildi: ${d.quotationNo} (${d.lineCount} kalem • Toplam: ${Number(
          d.totalAmount || 0
        ).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ${d.currency})${orderSuffix}`
      );
    } catch (err) {
      setStoreError(err instanceof Error ? err.message : "Birim-Store aktarım hatası");
    } finally {
      setLoading(null);
    }
  };

  const handleExportERP = async () => {
    setLoading("erp");
    setErpError(null);
    setErpStatus(null);
    try {
      if (!canExportProduction) {
        const firstErr =
          unifiedGate.blockingSafetyAndEngineeringErrors[0] ||
          unifiedGate.verificationRequiredFindings[0];
        throw new Error(
          `Üretim kapısı kilitli (${compatibility.overallStatus}): [${
            firstErr?.code || "ERR_PRODUCTION_GATE"
          }] ${firstErr?.message || "Doğrulanmamış tasarım ERP Nesting'e gönderilemez."}`
        );
      }

      const effectiveOrderRef =
        orderRefInput.trim() || lastSalesNo || `SIP_${project.id}_v${project.version}`;
      const idemSeed = computeCanonicalRequestHash({
        projectId: project.id,
        version: project.version,
        orderRef: effectiveOrderRef,
        pieces: bom.summary.totalPiecesCount,
      }).slice(0, 20);
      const idempotencyKey = `cfg_erp_${project.id}_v${project.version}_${idemSeed}`;

      const res = await fetch("/api/integrations/erp-nesting", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          project,
          orderRef: effectiveOrderRef,
          salesCardId: lastSalesCardId,
          quotationId: lastQuotationId || existingQuotationId.trim() || null,
          organizationId: organizationId.trim(),
          branchIdOrCode: branchIdOrCode.trim() || project.branchId,
          allowOfflineSimulationFallback: allowSimWhenEnvMissing,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(
          json?.error || `Birim-Portal ERP Nesting RPC hatası (HTTP ${res.status})`
        );
      }

      const d = json.data;
      const modeTag =
        json.mode === "live_supabase_rpc" ? "Canlı Supabase RPC" : "Yerel Simülasyon";
      setErpJobsResult(Array.isArray(d.nestingJobs) ? d.nestingJobs : []);
      setErpStatus(
        `[${modeTag}] ERP Nesting iş emirleri yazıldı: ${(d.nestingProjectNos || []).join(
          ", "
        )} • ${d.totalPartsInserted} Parça • ${d.totalPlacementsInserted} Yerleşim • ${
          d.totalSheetsUsed
        } Plaka (Blueprint: ${d.blueprintId})`
      );
    } catch (err) {
      setErpError(err instanceof Error ? err.message : "ERP Nesting aktarım hatası");
    } finally {
      setLoading(null);
    }
  };

  const handleUploadCamZipToSharedR2 = async () => {
    setLoading("r2");
    setR2UploadError(null);
    setR2UploadMessage(null);
    try {
      if (!canExportProduction) {
        const firstErr =
          unifiedGate.blockingSafetyAndEngineeringErrors[0] ||
          unifiedGate.verificationRequiredFindings[0];
        throw new Error(
          `Üretim kapısı kilitli (${compatibility.overallStatus}): [${
            firstErr?.code || "ERR_PRODUCTION_GATE"
          }] ${firstErr?.message || "Doğrulanmamış tasarım R2 üretim arşivine yüklenemez."}`
        );
      }
      const zipBytes = exportIndustrialCamZipArchive(project, bom);
      const fileName = `Birim_CAM_Etiket_${project.id}_v${project.version}.zip`;
      const res = await fetch("/api/integrations/r2-upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/zip",
          "x-birim-filename": fileName,
          "x-birim-folder": "configurator/cam-packages",
          "x-birim-org-id": organizationId.trim() || DEFAULT_BIRIM_ORG_UUID,
          "x-birim-share-portal-r2": sharePortalR2Bucket ? "true" : "false",
        },
        body: zipBytes as unknown as BodyInit,
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || `Ortak R2 yükleme hatası (HTTP ${res.status})`);
      }
      setLastR2ArchiveUrl(json.url || null);
      setLastR2ObjectKey(json.key || null);
      setR2UploadMessage(
        `CAM + 100×50mm Desen Sıralı Termal Etiket Arşivi ortak R2'ye yüklendi (${json.bucketName} → ${json.key})`
      );
    } catch (err) {
      setR2UploadError(err instanceof Error ? err.message : "Ortak R2 yükleme hatası");
    } finally {
      setLoading(null);
    }
  };

  const isLiveRpcConfigured = Boolean(bridgeStatus?.configured);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[156] flex items-center justify-center bg-[#141413]/52 backdrop-blur-xs p-0 md:p-5"
    >
      <div
        data-draggable-shell="store-erp"
        onClick={(e) => e.stopPropagation()}
        className="flex flex-col w-full max-w-4xl max-h-[90dvh] birim-ice-modal rounded-[28px] max-md:rounded-none max-md:h-[100dvh] max-md:max-h-[100dvh] overflow-hidden text-[#141413]"
      >
        {/* Header */}
        <div
          onPointerDown={(e) => startZeroLagModalDrag(e)}
          title="Pencereyi taşımak için basılı tutup sürükleyin"
          className="flex items-center justify-between gap-3 px-6 py-4 birim-ice-shell-header cursor-grab active:cursor-grabbing select-none"
        >
          <div className="flex items-center gap-3 min-w-0">
            <BirimLogo className="h-5 w-auto text-[#141413] shrink-0" />
            <div className="h-4 w-px bg-[#141413]/15 shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Database className="w-4 h-4 text-emerald-700 shrink-0" />
                <h2 className="text-sm sm:text-base font-bold text-[#141413] truncate">
                  <span className="hidden sm:inline">Mağaza &amp; ERP Aktarımı</span><span className="sm:hidden">Mağaza &amp; ERP</span>
                </h2>
              </div>
              <div className="text-[11px] text-[#57534E] truncate">
                Teklif ve üretim senkronizasyonu
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold border ${
                isLiveRpcConfigured
                  ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                  : "bg-amber-50 border-amber-300 text-amber-950"
              }`}
            >
              {isLiveRpcConfigured
                ? (<><span className="hidden sm:inline">Canlı Supabase RPC Aktif</span><span className="sm:hidden">RPC Aktif</span></>)
                : "Yerel / Ortam Anahtarı Bekleniyor"}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Kapat"
              className="w-8 h-8 rounded-full birim-ice-btn flex items-center justify-center text-[#57534E] hover:text-[#141413] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Prod Lock Banner */}
        {bridgeStatus?.prodSafetyLockActive && (
          <div className="px-6 py-2.5 bg-rose-50 border-b border-rose-200 text-xs text-rose-950 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              <strong>Canlı Üretim Koruması Aktif:</strong> Hedef URL canlı veritabanı (
              <code>qchmdyiakmrfyvphbbok</code>) olduğu için yazma kilitlidir. Önce staging (
              <code>gmxzpwufdsjtwzshxomd</code>) üzerinde doğrulayın.
            </span>
          </div>
        )}

        <div className="p-5 sm:p-6 space-y-4 flex-1 overflow-y-auto bg-[#FAF8F4] text-xs">
          {/* Ortak Kiracı & Şube Bağlamı */}
          <div className="p-4 rounded-2xl bg-white border border-[#E5DFD3] shadow-2xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-extrabold text-[#141413]">
                Ortak Supabase Kiracı &amp; Mağaza Oturum Bağlamı
              </span>
              {!isLiveRpcConfigured && (
                <label className="flex items-center gap-1.5 text-[11px] text-amber-900 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowSimWhenEnvMissing}
                    onChange={(e) => setAllowSimWhenEnvMissing(e.target.checked)}
                    className="rounded border-[#C7BCAE]"
                  />
                  Ortam değişkeni yoksa yerel simülasyon yedeğine izin ver
                </label>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-[#57534E] mb-1">
                  Organizasyon UUID (<code>organization_id</code>)
                </label>
                <input
                  type="text"
                  value={organizationId}
                  onChange={(e) => setOrganizationId(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-[#FAF8F4] border border-[#D8D1C4] text-[#141413] font-mono text-[11px]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#57534E] mb-1">
                  Mağaza / Şube UUID veya Kodu (<code>branch_id</code>)
                </label>
                <input
                  type="text"
                  value={branchIdOrCode}
                  onChange={(e) => setBranchIdOrCode(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-[#FAF8F4] border border-[#D8D1C4] text-[#141413] font-mono text-[11px]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#57534E] mb-1">
                  Müşteri Adı / Cari Başlığı
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Örn: Mimarlık Atölyesi A.Ş."
                  className="w-full px-3 py-1.5 rounded-xl bg-[#FAF8F4] border border-[#D8D1C4] text-[#141413] text-xs"
                />
              </div>
            </div>
          </div>

          {/* 1. Birim Store CPQ Teklif Akışı */}
          <div className="p-5 rounded-2xl bg-white border border-[#E5DFD3] shadow-2xs space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-700">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-[#141413] text-xs sm:text-sm">
                    1. Birim Store — Atomik Teklif &amp; Sipariş Akışı (<code>saved_quotations</code>)
                  </h3>
                  <p className="text-[11px] text-[#57534E]">
                    Sunucu tarafında yetkili fiyat yeniden hesaplanır,{" "}
                    <code>convert_store_quotation_to_order_atomic</code> ile sıfır kuruş farkı garantili kalemler yazılır
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleExportStore}
                disabled={loading === "store"}
                className="flex items-center gap-2 px-4 py-2 bg-[#141413] hover:bg-stone-800 text-white rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-50 cursor-pointer shrink-0"
              >
                {loading === "store"
                  ? "RPC Çalışıyor..."
                  : autoConvertToOrder
                  ? "Teklif + Sipariş (SPR) Oluştur"
                  : existingQuotationId.trim()
                  ? "Mevcut Teklifi Güncelle"
                  : "Yeni Teklif (TKL) Oluştur"}
                <ArrowRight className="w-4 h-4 text-amber-300" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs pt-1">
              <div>
                <label className="block text-[11px] font-semibold text-[#57534E] mb-1">
                  Mevcut Teklif UUID (Boşsa yeni <code>TKL-YYYY-XXXX</code> üretir)
                </label>
                <input
                  type="text"
                  value={existingQuotationId}
                  onChange={(e) => setExistingQuotationId(e.target.value)}
                  placeholder="Yeni teklif için boş bırakın"
                  className="w-full px-3 py-1.5 rounded-xl bg-[#FAF8F4] border border-[#D8D1C4] text-[#141413] font-mono text-[11px]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#57534E] mb-1">
                  Satır İskonto Oranı (%)
                </label>
                <input
                  type="number" inputMode="decimal"
                  min={0}
                  max={40}
                  step={1}
                  value={discountRatePercent}
                  onChange={(e) =>
                    setDiscountRatePercent(Math.max(0, Math.min(40, Number(e.target.value) || 0)))
                  }
                  className="w-full px-3 py-1.5 rounded-xl bg-[#FAF8F4] border border-[#D8D1C4] text-[#141413] font-mono text-xs font-bold"
                />
              </div>
              <div className="flex items-end pb-1.5">
                <label className="flex items-center gap-2 text-xs text-[#141413] font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoConvertToOrder}
                    onChange={(e) => setAutoConvertToOrder(e.target.checked)}
                    className="rounded border-[#C7BCAE]"
                  />
                  <span>
                    Aynı işlemde siparişe dönüştür (<code>SPR-</code>)
                  </span>
                </label>
              </div>
            </div>

            {storeStatus && (
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-950 text-xs font-medium flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>{storeStatus}</span>
              </div>
            )}
            {storeError && (
              <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-950 text-xs font-medium">
                {storeError}
              </div>
            )}
          </div>

          {/* 2. Birim Portal ERP Production Blueprint & Nesting Bridge */}
          <div className="p-5 rounded-2xl bg-white border border-[#E5DFD3] shadow-2xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800">
                  <Factory className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-[#141413] text-xs sm:text-sm">
                    2. Birim Portal ERP — Atomik CNC Panel Nesting (<code>nesting_projects</code>)
                  </h3>
                  <p className="text-[11px] text-[#57534E]">
                    <code>nesting_sheets</code> + <code>nesting_projects</code> (
                    <code>NST-YYYY-XXXX</code>) + <code>nesting_parts</code> +{" "}
                    <code>nesting_placements</code> tek işlemde yazılır
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleExportERP}
                disabled={loading === "erp" || !canExportProduction}
                title={
                  !canExportProduction
                    ? "P0 veya doğrulanmamış mühendislik bulguları çözülmeden ERP Nesting'e aktarılamaz"
                    : undefined
                }
                className="flex items-center gap-2 px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-45 cursor-pointer shrink-0"
              >
                {loading === "erp" ? "RPC Çalışıyor..." : "ERP Nesting Tablolarına Yaz"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-[#57534E] mb-1">
                  Üretim / Sipariş Referansı (<code>source_ref</code>)
                </label>
                <input
                  type="text"
                  value={orderRefInput}
                  onChange={(e) => setOrderRefInput(e.target.value)}
                  placeholder={lastSalesNo || `SIP_${project.id}_v${project.version}`}
                  className="w-full px-3 py-1.5 rounded-xl bg-[#FAF8F4] border border-[#D8D1C4] text-[#141413] font-mono text-[11px]"
                />
              </div>
              <div className="flex items-end">
                <div
                  className={`w-full px-3 py-1.5 rounded-xl border text-[11px] flex items-center gap-2 ${
                    canExportProduction
                      ? "bg-emerald-50 border-emerald-300 text-emerald-950"
                      : "bg-rose-50 border-rose-300 text-rose-950"
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>
                    Mühendislik Kapısı: <strong>{compatibility.overallStatus}</strong> (
                    {canExportProduction
                      ? "ERP & CNC Aktarımına Uygun"
                      : `${unifiedGate.blockingSafetyAndEngineeringErrors.length} P0 Engel, ${unifiedGate.verificationRequiredFindings.length} Doğrulama Bekleyen`}
                    )
                  </span>
                </div>
              </div>
            </div>

            {liveErpNesting && (
              <div className="p-3.5 rounded-2xl bg-[#FAF8F4] border border-[#E5DFD3] space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center font-mono text-xs">
                  <div className="p-2.5 rounded-xl bg-white border border-[#E5DFD3]">
                    <div className="text-[10px] text-[#78716C] font-sans font-semibold">
                      Levha Grubu
                    </div>
                    <div className="font-extrabold text-[#141413]">
                      {liveErpNesting.summary.board_groups_count} İş Emri
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-[#E5DFD3]">
                    <div className="text-[10px] text-[#78716C] font-sans font-semibold">
                      Toplam Plaka
                    </div>
                    <div className="font-extrabold text-amber-800">
                      {liveErpNesting.summary.total_sheets_used} Adet
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-[#E5DFD3]">
                    <div className="text-[10px] text-[#78716C] font-sans font-semibold">
                      Doluluk / Verim
                    </div>
                    <div className="font-extrabold text-emerald-800">
                      %{liveErpNesting.summary.overall_utilization_percent}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-[#E5DFD3]">
                    <div className="text-[10px] text-[#78716C] font-sans font-semibold">
                      Artık Plaka (≥400)
                    </div>
                    <div className="font-extrabold text-cyan-300">
                      {liveErpNesting.summary.reclaimable_remnants_count} (
                      {liveErpNesting.summary.reclaimable_remnants_area_m2} m²)
                    </div>
                  </div>
                </div>

                {erpJobsResult.length > 0 && (
                  <div className="rounded-xl border border-[#E5DFD3] bg-white overflow-hidden text-[11px]">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-[#F4F0E8] text-[#57534E]">
                        <tr>
                          <th className="px-2.5 py-1.5 font-bold">Proje No</th>
                          <th className="px-2.5 py-1.5 font-bold">Malzeme</th>
                          <th className="px-2.5 py-1.5 font-bold">Parça / Yerleşim</th>
                          <th className="px-2.5 py-1.5 font-bold">Plaka &amp; Verim</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#ECE7DC] text-[#141413] font-mono">
                        {erpJobsResult.map((j) => (
                          <tr key={j.projectNo}>
                            <td className="px-2.5 py-1.5 font-bold text-amber-900">
                              {j.projectNo}
                            </td>
                            <td className="px-2.5 py-1.5 font-sans font-medium">
                              {j.materialName} ({j.thicknessMm}mm)
                            </td>
                            <td className="px-2.5 py-1.5">
                              {j.partsInserted} parça / {j.placementsInserted} yerleşim
                            </td>
                            <td className="px-2.5 py-1.5 text-emerald-800 font-bold">
                              {j.sheetsUsed} plaka (%{j.utilizationPercent})
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      triggerDownload(
                        JSON.stringify(liveErpNesting, null, 2),
                        `Birim_ERP_Nesting_Payload_${project.id}_v${project.version}.json`,
                        "application/json;charset=utf-8"
                      )
                    }
                    className="flex-1 min-w-[180px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#141413] hover:bg-stone-800 text-white text-xs font-bold cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-300" />
                    ERP Nesting JSON Paketi (.json)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      triggerDownload(
                        liveErpNesting.combined_selco_csv,
                        `NST_${project.id}_SELCO_WNT600.csv`,
                        "text/csv;charset=utf-8"
                      )
                    }
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl birim-ice-btn text-[#141413] text-xs font-bold cursor-pointer"
                  >
                    <Scissors className="w-3.5 h-3.5 text-emerald-700" />
                    ERP Selco CSV (.csv)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      triggerDownload(
                        liveErpNesting.combined_cnc_gcode,
                        `NST_${project.id}_all.nc`,
                        "text/plain;charset=utf-8"
                      )
                    }
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl birim-ice-btn text-[#141413] text-xs font-bold cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-indigo-700" />
                    ERP G-Code (.nc)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      triggerDownload(
                        generateThermalPartLabelsHtml(project, bom),
                        `Termal_Etiketler_100x50mm_DesenSirali_${project.id}.html`,
                        "text/html;charset=utf-8"
                      )
                    }
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl birim-ice-btn text-[#141413] text-xs font-bold cursor-pointer"
                  >
                    <Tag className="w-3.5 h-3.5 text-amber-700" />
                    100×50 Termal Etiket (.html)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      triggerDownload(
                        generateThermalPartLabelsZpl(project, bom),
                        `Zebra_203dpi_DesenSirali_${project.id}.zpl`,
                        "text/plain;charset=utf-8"
                      )
                    }
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl birim-ice-btn text-[#141413] text-xs font-bold cursor-pointer"
                  >
                    <Tag className="w-3.5 h-3.5 text-stone-700" />
                    Zebra Barkod (.zpl)
                  </button>
                </div>
              </div>
            )}

            {erpStatus && (
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-950 text-xs font-medium flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>{erpStatus}</span>
              </div>
            )}
            {erpError && (
              <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-950 text-xs font-medium">
                {erpError}
              </div>
            )}
          </div>

          {/* 3. Ortak Birim-Portal Cloudflare R2 Depolama Köprüsü */}
          <div className="p-5 rounded-2xl bg-white border border-[#E5DFD3] shadow-2xs space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-sky-500/20 border border-sky-400/45 text-cyan-300">
                  <CloudUpload className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-extrabold text-[#141413] text-xs sm:text-sm">
                      3. Ortak Birim-Portal Cloudflare R2 Arşivi (<code>configurator/</code> İzole Önek)
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        r2Status?.configured
                          ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                          : "bg-[#F4F0E8] border-[#D8D1C4] text-[#57534E]"
                      }`}
                    >
                      {r2Status?.configured
                        ? `Aktif Bucket: ${r2Status.bucketName} (${
                            r2Status.source === "birim_portal_shared_env"
                              ? "birim-portal .env Ortak"
                              : "configurator .env"
                          })`
                        : "R2 Ortam Değişkeni Bekleniyor"}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#57534E]">
                    <code>birim-portal/lib/r2.ts</code> ile aynı R2 kimlik bilgilerini kullanır; tüm 3D{" "}
                    <code>.glb</code> varlıklarını ve CNC + Zebra etiket <code>.zip</code> paketlerini{" "}
                    <code>{"${orgId}/configurator/..."}</code> altında izole saklar
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleUploadCamZipToSharedR2}
                disabled={loading === "r2" || !canExportProduction}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-700 hover:bg-cyan-800 text-white rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-45 cursor-pointer shrink-0"
              >
                <CloudUpload className="w-4 h-4" />
                <span>
                  {loading === "r2"
                    ? "R2'ye Yükleniyor..."
                    : "CAM + Etiket Paketini (.ZIP) Ortak R2'ye Yükle"}
                </span>
              </button>
            </div>

            <div className="flex items-center justify-between flex-wrap gap-2 text-xs pt-0.5">
              <label className="flex items-center gap-2 text-[#44403C] font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={sharePortalR2Bucket}
                  onChange={(e) => setSharePortalR2Bucket(e.target.checked)}
                  className="rounded border-[#C7BCAE]"
                />
                <span>
                  Ortak <code>birim-portal</code> R2 bucket paylaşımını kullan (yalnızca{" "}
                  <code>configurator/</code> alt klasörüne yazma izni)
                </span>
              </label>
              {lastR2ArchiveUrl && (
                <a
                  href={lastR2ArchiveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[11px] text-cyan-300 font-semibold underline hover:text-cyan-100 truncate max-w-md"
                >
                  {lastR2ArchiveUrl}
                </a>
              )}
            </div>

            {r2UploadMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-950 text-xs font-medium flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>{r2UploadMessage}</span>
              </div>
            )}
            {r2UploadError && (
              <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-950 text-xs font-medium">
                {r2UploadError}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
