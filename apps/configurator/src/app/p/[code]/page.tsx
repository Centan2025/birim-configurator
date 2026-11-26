"use client";

import React, { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { getTenantProfileByIdOrSlug, type TenantBrandTheme } from "@birim/core";
import { useConfiguratorStore, type ConfiguratorState } from "../../../store/useConfiguratorStore";
import { BirimStudioWorkspace } from "../../../v11/BirimStudioWorkspace";
import { V3BrandBadge } from "../../../v3/design-system";
import { decodeSharePayloadBase64Url, type VerifiedQuoteRecord } from "../../../lib/quote-codec";
import { ShieldCheck, AlertCircle } from "lucide-react";

function SharedProjectQuotePageInner() {
  const params = useParams<{ code: string }>();
  const searchParams = useSearchParams();
  const importProjectJSON = useConfiguratorStore((s: ConfiguratorState) => s.importProjectJSON);
  const switchActiveTenant = useConfiguratorStore((s: ConfiguratorState) => s.switchActiveTenant);

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorText, setErrorText] = useState<string>("");
  const [verifiedBadge, setVerifiedBadge] = useState<{
    code: string;
    brandName: string;
    currency: "EUR" | "TRY";
    totalFormatted: string;
    hmacShort: string;
    isServerVerified: boolean;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const code = String(params?.code || "").toUpperCase();
    const fallbackToken = searchParams?.get("d");

    async function loadSharedQuote() {
      try {
        const res = await fetch(`/api/quotes/${encodeURIComponent(code)}`);
        if (res.ok) {
          const data = (await res.json()) as {
            ok: boolean;
            quote?: VerifiedQuoteRecord;
            brand?: TenantBrandTheme;
            currency?: "EUR" | "TRY";
          };
          if (!cancelled && data.ok && data.quote?.projectSnapshot) {
            const tenantProfile = getTenantProfileByIdOrSlug(data.quote.tenantId);
            switchActiveTenant(tenantProfile.tenantId);
            const imported = importProjectJSON(JSON.stringify(data.quote.projectSnapshot));
            if (imported.success) {
              const cur = data.currency || tenantProfile.pricing.currency;
              const formatted =
                cur === "TRY"
                  ? `₺ ${Math.round(data.quote.serverVerifiedTotalWithVatTry).toLocaleString("tr-TR")}`
                  : `€ ${data.quote.serverVerifiedDiscountedTotalEur.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`;
              setVerifiedBadge({
                code: data.quote.code,
                brandName: (data.brand || tenantProfile.brand).displayName,
                currency: cur,
                totalFormatted: formatted,
                hmacShort: data.quote.hmacSignature.slice(0, 10),
                isServerVerified: true,
              });
              setStatus("ready");
              return;
            }
          }
        }

        if (fallbackToken) {
          const decoded = decodeSharePayloadBase64Url<{
            code: string;
            tenantId?: string;
            project: unknown;
          }>(fallbackToken);
          if (!cancelled && decoded?.project) {
            const tenantProfile = getTenantProfileByIdOrSlug(decoded.tenantId);
            switchActiveTenant(tenantProfile.tenantId);
            const imported = importProjectJSON(JSON.stringify(decoded.project));
            if (imported.success) {
              const cur = tenantProfile.pricing.currency;
              setVerifiedBadge({
                code: decoded.code || code,
                brandName: tenantProfile.brand.displayName,
                currency: cur,
                totalFormatted: "Sunucu doğrulaması gerekli",
                hmacShort: "DOĞRULANMADI",
                isServerVerified: false,
              });
              setStatus("ready");
              return;
            }
          }
        }

        if (!cancelled) {
          setErrorText("Paylaşılan proje bağlantısı bulunamadı veya geçerlilik süresi dolmuş.");
          setStatus("error");
        }
      } catch {
        if (!cancelled) {
          setErrorText("Proje yüklenirken bağlantı hatası oluştu.");
          setStatus("error");
        }
      }
    }

    void loadSharedQuote();
    return () => {
      cancelled = true;
    };
  }, [params, searchParams, importProjectJSON, switchActiveTenant]);

  if (status === "loading") {
    return (
      <div className="flex flex-col items-center justify-center h-dvh w-screen bg-[#F5F3EE] text-[#141413] gap-3">
        <V3BrandBadge subtitle="PAYLAŞIM" />
        <p className="text-xs text-[#57534E]">Paylaşılan 3D tasarım ve imzalı teklif yükleniyor...</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex flex-col items-center justify-center h-dvh w-screen bg-[#F5F3EE] text-[#141413] p-6">
        <div className="max-w-md w-full bg-white border border-[#E4DFD5] rounded-2xl p-6 text-center space-y-3">
          <AlertCircle className="w-7 h-7 text-[#9E2A2B] mx-auto" />
          <div className="text-sm font-bold">{errorText}</div>
          <a
            href="/"
            className="inline-block px-4 py-2 rounded-full bg-[#141413] text-white text-xs font-semibold"
          >
            Yeni Tasarım Başlat
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-dvh w-screen overflow-hidden flex flex-col">
      {verifiedBadge && (
        <div
          className={`h-8 px-4 flex items-center justify-between text-[11px] shrink-0 z-40 ${
            verifiedBadge.isServerVerified
              ? "bg-[#141413] text-white"
              : "bg-amber-900 text-amber-50"
          }`}
        >
          <div className="flex items-center gap-2">
            {verifiedBadge.isServerVerified ? (
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 text-amber-300" />
            )}
            <span>
              {verifiedBadge.isServerVerified
                ? `Doğrulanmış ${verifiedBadge.brandName} Teklif Kodu:`
                : `Doğrulanmamış Yerel Önizleme (${verifiedBadge.brandName}):`}{" "}
              <strong className="font-mono">{verifiedBadge.code}</strong>
            </span>
          </div>
          <div className="flex items-center gap-3 font-mono">
            <span>
              {verifiedBadge.isServerVerified
                ? `KDV Dahil: ${verifiedBadge.totalFormatted}`
                : verifiedBadge.totalFormatted}
            </span>
            <span className="text-stone-300 hidden sm:inline">
              {verifiedBadge.isServerVerified ? `HMAC:${verifiedBadge.hmacShort}` : "İMZASIZ"}
            </span>
          </div>
        </div>
      )}
      <div className="flex-1 relative overflow-hidden">
        <BirimStudioWorkspace initialMode="showroom" />
      </div>
    </div>
  );
}

export default function SharedProjectQuotePage() {
  return (
    <React.Suspense fallback={null}>
      <SharedProjectQuotePageInner />
    </React.Suspense>
  );
}
