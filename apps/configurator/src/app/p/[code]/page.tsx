"use client";

import React, { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useConfiguratorStore } from "../../../store/useConfiguratorStore";
import { V3UnifiedWorkspace } from "../../../v3/components/V3UnifiedWorkspace";
import { V3BrandBadge } from "../../../v3/design-system";
import { decodeSharePayloadBase64Url, type VerifiedQuoteRecord } from "../../../lib/quote-codec";
import { ShieldCheck, AlertCircle } from "lucide-react";

export default function SharedProjectQuotePage() {
  const params = useParams<{ code: string }>();
  const searchParams = useSearchParams();
  const importProjectJSON = useConfiguratorStore((s) => s.importProjectJSON);

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorText, setErrorText] = useState<string>("");
  const [verifiedBadge, setVerifiedBadge] = useState<{
    code: string;
    totalEur: number;
    hmacShort: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const code = String(params?.code || "").toUpperCase();
    const fallbackToken = searchParams?.get("d");

    async function loadSharedQuote() {
      try {
        const res = await fetch(`/api/quotes/${encodeURIComponent(code)}`);
        if (res.ok) {
          const data = (await res.json()) as { ok: boolean; quote?: VerifiedQuoteRecord };
          if (!cancelled && data.ok && data.quote?.projectSnapshot) {
            const imported = importProjectJSON(JSON.stringify(data.quote.projectSnapshot));
            if (imported.success) {
              setVerifiedBadge({
                code: data.quote.code,
                totalEur: data.quote.serverVerifiedDiscountedTotalEur,
                hmacShort: data.quote.hmacSignature.slice(0, 10),
              });
              setStatus("ready");
              return;
            }
          }
        }

        if (fallbackToken) {
          const decoded = decodeSharePayloadBase64Url<{
            code: string;
            verifiedTotalEur: number;
            sig: string;
            project: unknown;
          }>(fallbackToken);
          if (!cancelled && decoded?.project) {
            const imported = importProjectJSON(JSON.stringify(decoded.project));
            if (imported.success) {
              setVerifiedBadge({
                code: decoded.code || code,
                totalEur: decoded.verifiedTotalEur || 0,
                hmacShort: decoded.sig || "stateless",
              });
              setStatus("ready");
              return;
            }
          }
        }

        if (!cancelled) {
          setErrorText("Paylaşılan Birim proje bağlantısı bulunamadı veya süresi dolmuş.");
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
  }, [params, searchParams, importProjectJSON]);

  if (status === "loading") {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-[#F5F3EE] text-[#141413] gap-3">
        <V3BrandBadge subtitle="PAYLAŞIM" />
        <p className="text-xs text-[#57534E]">Paylaşılan 3D tasarım ve doğrulanmış teklif yükleniyor...</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-[#F5F3EE] text-[#141413] p-6">
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
    <div className="relative h-screen w-screen overflow-hidden flex flex-col">
      {verifiedBadge && (
        <div className="h-8 bg-[#141413] text-white px-4 flex items-center justify-between text-[11px] shrink-0 z-40">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              Doğrulanmış Birim Teklif Kodu: <strong className="font-mono">{verifiedBadge.code}</strong>
            </span>
          </div>
          <div className="font-mono text-stone-300">
            Net Teklif: <strong className="text-white">€{verifiedBadge.totalEur.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</strong> • İmza: #{verifiedBadge.hmacShort}
          </div>
        </div>
      )}
      <div className="flex-1 min-h-0 relative">
        <V3UnifiedWorkspace initialMode="showroom" />
      </div>
    </div>
  );
}
