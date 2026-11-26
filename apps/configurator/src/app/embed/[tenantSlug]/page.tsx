"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  checkTenantEntitlement,
  getTenantProfileByIdOrSlug,
  isOriginAllowedForTenantEmbed,
  sanitizeHttpOrigin,
} from "@birim/core";
import { useConfiguratorStore, type ConfiguratorState } from "../../../store/useConfiguratorStore";
import { BirimStudioWorkspace } from "../../../v11/BirimStudioWorkspace";
import { Lock } from "lucide-react";

function TenantWhiteLabelEmbedPageInner() {
  const params = useParams<{ tenantSlug: string }>();
  const searchParams = useSearchParams();
  const slug = String(params?.tenantSlug || "birim").toLowerCase();
  const currencyParam = searchParams?.get("currency");
  const parentOriginParam = searchParams?.get("parentOrigin");

  const switchActiveTenant = useConfiguratorStore((s: ConfiguratorState) => s.switchActiveTenant);
  const setUserExperienceTier = useConfiguratorStore((s: ConfiguratorState) => s.setUserExperienceTier);
  const updateActiveTenantProfile = useConfiguratorStore((s: ConfiguratorState) => s.updateActiveTenantProfile);
  const activeTenantProfile = useConfiguratorStore((s: ConfiguratorState) => s.activeTenantProfile);
  const pricing = useConfiguratorStore((s: ConfiguratorState) => s.pricing);
  const project = useConfiguratorStore((s: ConfiguratorState) => s.project);

  const [verifiedParentOrigin, setVerifiedParentOrigin] = useState<string | null>(null);

  const resolvedInitialOrigin = useMemo(() => {
    const fromParam = sanitizeHttpOrigin(parentOriginParam);
    if (fromParam) return fromParam;
    if (typeof document !== "undefined" && document.referrer) {
      return sanitizeHttpOrigin(document.referrer);
    }
    return null;
  }, [parentOriginParam]);

  useEffect(() => {
    const resolved = getTenantProfileByIdOrSlug(slug);
    switchActiveTenant(resolved.tenantId, "external_guest");
    setUserExperienceTier("simple");
    if (currencyParam === "EUR" || currencyParam === "TRY") {
      updateActiveTenantProfile({
        pricing: { ...resolved.pricing, currency: currencyParam },
      });
    }

    const onHostHandshake = (ev: MessageEvent) => {
      if (!ev || !ev.data || typeof ev.data !== "object") return;
      if (ev.data.namespace !== "modul-embed-v1" || ev.data.type !== "MODUL_HOST_HANDSHAKE") return;
      const cleanOrigin = sanitizeHttpOrigin(ev.origin);
      if (cleanOrigin && isOriginAllowedForTenantEmbed(cleanOrigin, resolved)) {
        setVerifiedParentOrigin(cleanOrigin);
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("message", onHostHandshake);
    }

    if (typeof window !== "undefined" && window.parent && window.parent !== window) {
      const candidateOrigin = verifiedParentOrigin || resolvedInitialOrigin;
      const hasExplicitAllowlist = Boolean(
        resolved.allowedEmbedOrigins && resolved.allowedEmbedOrigins.length > 0
      );
      if (!hasExplicitAllowlist || isOriginAllowedForTenantEmbed(candidateOrigin, resolved)) {
        window.parent.postMessage(
          {
            namespace: "modul-embed-v1",
            type: "MODUL_READY",
            tenantSlug: resolved.slug,
          },
          candidateOrigin || "*"
        );
      }
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("message", onHostHandshake);
      }
    };
  }, [
    slug,
    currencyParam,
    resolvedInitialOrigin,
    verifiedParentOrigin,
    switchActiveTenant,
    setUserExperienceTier,
    updateActiveTenantProfile,
  ]);

  const embedCheck = checkTenantEntitlement(activeTenantProfile, "allowWhiteLabelEmbed");
  if (!embedCheck.allowed) {
    return (
      <div className="h-dvh w-screen flex items-center justify-center bg-[#FAF9F6] text-[#141413] p-6">
        <div className="max-w-md bg-white border border-[#E4DFD5] rounded-2xl p-6 text-center space-y-2">
          <Lock className="w-6 h-6 text-amber-700 mx-auto" />
          <h1 className="text-sm font-bold">White-Label Embed Özelliği Kapalı</h1>
          <p className="text-xs text-[#57534E]">{embedCheck.reasonTr}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-dvh w-screen overflow-hidden">
      <BirimStudioWorkspace initialMode="studio" />
      <button
        type="button"
        data-testid="embed-send-to-cart-btn"
        onClick={() => {
          if (typeof window !== "undefined" && window.parent) {
            const targetOrigin = verifiedParentOrigin || resolvedInitialOrigin;
            const hasExplicitAllowlist = Boolean(
              activeTenantProfile.allowedEmbedOrigins &&
                activeTenantProfile.allowedEmbedOrigins.length > 0
            );
            if (hasExplicitAllowlist && !isOriginAllowedForTenantEmbed(targetOrigin, activeTenantProfile)) {
              return;
            }
            window.parent.postMessage(
              {
                namespace: "modul-embed-v1",
                type: "MODUL_ADD_TO_CART",
                payload: {
                  tenantId: activeTenantProfile.tenantId,
                  tenantSlug: activeTenantProfile.slug,
                  projectId: project.id,
                  projectTitle: project.title,
                  currency: activeTenantProfile.pricing.currency,
                  totalWithVatEur: pricing.totalWithVatEur,
                  totalWithVatTry: pricing.totalWithVatTry,
                },
              },
              targetOrigin || "*"
            );
          }
        }}
        className="fixed bottom-4 right-4 z-50 px-4 py-2.5 rounded-full bg-[#141413] text-white text-xs font-bold shadow-lg hover:bg-stone-800 cursor-pointer"
      >
        Sepete / Teklife Aktar
      </button>
    </div>
  );
}

export default function TenantWhiteLabelEmbedPage() {
  return (
    <React.Suspense fallback={null}>
      <TenantWhiteLabelEmbedPageInner />
    </React.Suspense>
  );
}
