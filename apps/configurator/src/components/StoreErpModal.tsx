"use client";

import React, { useEffect, useMemo, useState } from "react";
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

export default function StoreErpModal({ isOpen, onClose }: StoreErpModalProps) {
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
  const [lastQuotationNo, setLastQuotationNo] = useState<string | null>(null);
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
          firstErr?.code || "HATA"
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
        throw new Error(
          json?.error || `Birim-Store RPC hatası (HTTP ${res.status})`
        );
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
        body: zipBytes,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 backdrop-blur-md p-4">
      <div className="flex flex-col w-full max-w-4xl birim-ice-dark-bar border birim-ice-modal rounded-[28px] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Database className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-base font-bold text-slate-100">
                Birim Store & Birim Portal ERP — Canlı Supabase RPC Köprüsü (V7.3)
              </h2>
              <div className="text-[11px] text-slate-400">
                <code>upsert_configurator_store_quotation_atomic</code> &bull;{" "}
                <code>publish_configurator_erp_nesting_atomic</code>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                isLiveRpcConfigured
                  ? "bg-emerald-950/60 border-emerald-700 text-emerald-300"
                  : "bg-amber-950/60 border-amber-700 text-amber-300"
              }`}
            >
              {isLiveRpcConfigured
                ? "Canlı Supabase RPC Aktif (service_role)"
                : "SUPABASE_SERVICE_ROLE_KEY Bekleniyor"}
            </span>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Prod Lock / Env Banner */}
        {bridgeStatus?.prodSafetyLockActive && (
          <div className="px-5 py-2.5 bg-rose-950/50 border-b border-rose-800/60 text-xs text-rose-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              <strong>Canlı Üretim Koruması Aktif:</strong> Hedef URL canlı veritabanı (
              <code>qchmdyiakmrfyvphbbok</code>) olduğu için yazma kilitlidir. Önce staging (
              <code>gmxzpwufdsjtwzshxomd</code>) üzerinde doğrulayın.
            </span>
          </div>
        )}

        <div className="p-6 space-y-5 max-h-[78vh] overflow-y-auto">
          {/* Ortak Kiracı & Şube Bağlamı */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">
                Ortak Supabase Kiracı & Mağaza Oturum Bağlamı
              </span>
              {!isLiveRpcConfigured && (
                <label className="flex items-center gap-1.5 text-[11px] text-amber-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowSimWhenEnvMissing}
                    onChange={(e) => setAllowSimWhenEnvMissing(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-900"
                  />
                  Ortam değişkeni yoksa yerel simülasyon yedeğine izin ver
                </label>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Organizasyon UUID (<code>organization_id</code>)
                </label>
                <input
                  type="text"
                  value={organizationId}
                  onChange={(e) => setOrganizationId(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 font-mono text-[11px]"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Mağaza / Şube UUID veya Kodu (<code>branch_id</code>)
                </label>
                <input
                  type="text"
                  value={branchIdOrCode}
                  onChange={(e) => setBranchIdOrCode(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 font-mono text-[11px]"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Müşteri Adı / Cari Başlığı
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Örn: Mimarlık Atölyesi A.Ş."
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs"
                />
              </div>
            </div>
          </div>

          {/* 1. Birim Store CPQ Teklif Akışı */}
          <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-600/20 text-blue-400">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-200">
                    1. Birim Store — Atomik Teklif & Sipariş Akışı (<code>saved_quotations</code>)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Sunucu tarafında yetkili fiyat yeniden hesaplanır,{" "}
                    <code>convert_store_quotation_to_order_atomic</code> ile sıfır kuruş farkı
                    garantili kalemler yazılır
                  </p>
                </div>
              </div>
              <button
                onClick={handleExportStore}
                disabled={loading === "store"}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow transition-all disabled:opacity-50 cursor-pointer shrink-0"
              >
                {loading === "store"
                  ? "RPC Çalışıyor..."
                  : autoConvertToOrder
                  ? "Teklif + Sipariş (SPR) Oluştur"
                  : existingQuotationId.trim()
                  ? "Mevcut Teklifi Güncelle"
                  : "Yeni Teklif (TKL) Oluştur"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs pt-1">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Mevcut Teklif UUID (Boşsa yeni <code>TKL-YYYY-XXXX</code> üretir)
                </label>
                <input
                  type="text"
                  value={existingQuotationId}
                  onChange={(e) => setExistingQuotationId(e.target.value)}
                  placeholder="Yeni teklif için boş bırakın"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 font-mono text-[11px]"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Satır İskonto Oranı (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={40}
                  step={1}
                  value={discountRatePercent}
                  onChange={(e) =>
                    setDiscountRatePercent(Math.max(0, Math.min(40, Number(e.target.value) || 0)))
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 font-mono text-xs"
                />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoConvertToOrder}
                    onChange={(e) => setAutoConvertToOrder(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-900"
                  />
                  <span>
                    Aynı işlemde siparişe dönüştür (<code>SPR-</code>)
                  </span>
                </label>
              </div>
            </div>

            {storeStatus && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-lg text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{storeStatus}</span>
              </div>
            )}
            {storeError && (
              <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-lg text-rose-300 text-xs">
                {storeError}
              </div>
            )}
          </div>

          {/* 2. Birim Portal ERP Production Blueprint & Nesting Bridge */}
          <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-600/20 text-amber-400">
                  <Factory className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-200">
                    2. Birim Portal ERP — Atomik CNC Panel Nesting (
                    <code>nesting_projects</code>)
                  </h3>
                  <p className="text-xs text-slate-400">
                    <code>nesting_sheets</code> + <code>nesting_projects</code> (
                    <code>NST-YYYY-XXXX</code>) + <code>nesting_parts</code> +{" "}
                    <code>nesting_placements</code> (UUID FK) tek işlemde yazılır
                  </p>
                </div>
              </div>
              <button
                onClick={handleExportERP}
                disabled={loading === "erp" || !canExportProduction}
                title={
                  !canExportProduction
                    ? "P0 veya doğrulanmamış mühendislik bulguları çözülmeden ERP Nesting'e aktarılamaz"
                    : undefined
                }
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold shadow transition-all disabled:opacity-45 cursor-pointer shrink-0"
              >
                {loading === "erp" ? "RPC Çalışıyor..." : "ERP Nesting Tablolarına Yaz"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Üretim / Sipariş Referansı (<code>source_ref</code>)
                </label>
                <input
                  type="text"
                  value={orderRefInput}
                  onChange={(e) => setOrderRefInput(e.target.value)}
                  placeholder={lastSalesNo || `SIP_${project.id}_v${project.version}`}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 font-mono text-[11px]"
                />
              </div>
              <div className="flex items-end">
                <div
                  className={`w-full px-3 py-1.5 rounded-lg border text-[11px] flex items-center gap-2 ${
                    canExportProduction
                      ? "bg-emerald-950/30 border-emerald-800/50 text-emerald-300"
                      : "bg-rose-950/40 border-rose-800/60 text-rose-300"
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>
                    Mühendislik Kapısı:{" "}
                    <strong>{compatibility.overallStatus}</strong> (
                    {canExportProduction
                      ? "ERP & CNC Aktarımına Uygun"
                      : `${unifiedGate.blockingSafetyAndEngineeringErrors.length} P0 Engel, ${unifiedGate.verificationRequiredFindings.length} Doğrulama Bekleyen`}
                    )
                  </span>
                </div>
              </div>
            </div>

            {liveErpNesting && (
              <div className="p-3.5 rounded-lg bg-slate-900/90 border border-slate-800 space-y-3">
                <div className="grid grid-cols-4 gap-2 text-center font-mono text-xs">
                  <div className="p-2 rounded bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400 font-sans">Levha Grubu</div>
                    <div className="font-bold text-slate-100">
                      {liveErpNesting.summary.board_groups_count} İş Emri
                    </div>
                  </div>
                  <div className="p-2 rounded bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400 font-sans">Toplam Plaka</div>
                    <div className="font-bold text-amber-400">
                      {liveErpNesting.summary.total_sheets_used} Adet
                    </div>
                  </div>
                  <div className="p-2 rounded bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400 font-sans">Doluluk / Verim</div>
                    <div className="font-bold text-emerald-400">
                      %{liveErpNesting.summary.overall_utilization_percent}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400 font-sans">Artık Plaka (≥400)</div>
                    <div className="font-bold text-cyan-400">
                      {liveErpNesting.summary.reclaimable_remnants_count} (
                      {liveErpNesting.summary.reclaimable_remnants_area_m2} m²)
                    </div>
                  </div>
                </div>

                {erpJobsResult.length > 0 && (
                  <div className="rounded-lg border border-slate-800 overflow-hidden text-[11px]">
                    <table className="w-full text-left">
                      <thead className="bg-slate-950 text-slate-400">
                        <tr>
                          <th className="px-2.5 py-1.5">Proje No</th>
                          <th className="px-2.5 py-1.5">Malzeme</th>
                          <th className="px-2.5 py-1.5">Parça / Yerleşim</th>
                          <th className="px-2.5 py-1.5">Plaka & Verim</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-slate-200 font-mono">
                        {erpJobsResult.map((j) => (
                          <tr key={j.projectNo}>
                            <td className="px-2.5 py-1.5 font-bold text-amber-300">
                              {j.projectNo}
                            </td>
                            <td className="px-2.5 py-1.5 font-sans">
                              {j.materialName} ({j.thicknessMm}mm)
                            </td>
                            <td className="px-2.5 py-1.5">
                              {j.partsInserted} parça / {j.placementsInserted} yerleşim
                            </td>
                            <td className="px-2.5 py-1.5 text-emerald-300">
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
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
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
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold cursor-pointer"
                  >
                    <Scissors className="w-3.5 h-3.5" />
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
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-100 text-xs font-bold cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
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
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-amber-700 hover:bg-amber-600 text-white text-xs font-bold cursor-pointer"
                  >
                    <Tag className="w-3.5 h-3.5" />
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
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-amber-600/60 text-amber-200 text-xs font-bold cursor-pointer"
                  >
                    <Tag className="w-3.5 h-3.5" />
                    Zebra Barkod (.zpl)
                  </button>
                </div>
              </div>
            )}

            {erpStatus && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-lg text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{erpStatus}</span>
              </div>
            )}
            {erpError && (
              <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-lg text-rose-300 text-xs">
                {erpError}
              </div>
            )}
          </div>

          {/* 3. Ortak Birim-Portal Cloudflare R2 Depolama Köprüsü */}
          <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyan-600/20 text-cyan-400">
                  <CloudUpload className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-slate-200">
                      3. Ortak Birim-Portal Cloudflare R2 Arşivi (<code>configurator/</code> İzole Önek)
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        r2Status?.configured
                          ? "bg-emerald-950/60 border-emerald-700 text-emerald-300"
                          : "bg-slate-900 border-slate-700 text-slate-400"
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
                  <p className="text-xs text-slate-400">
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
                className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold shadow transition-all disabled:opacity-45 cursor-pointer shrink-0"
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
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sharePortalR2Bucket}
                  onChange={(e) => setSharePortalR2Bucket(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900"
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
                  className="font-mono text-[11px] text-cyan-300 underline hover:text-cyan-200 truncate max-w-md"
                >
                  {lastR2ArchiveUrl}
                </a>
              )}
            </div>

            {r2UploadMessage && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-lg text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{r2UploadMessage}</span>
              </div>
            )}
            {r2UploadError && (
              <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-lg text-rose-300 text-xs">
                {r2UploadError}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
