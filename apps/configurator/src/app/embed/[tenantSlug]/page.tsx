"use client";

import React, { useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { checkTenantEntitlement, getTenantProfileByIdOrSlug } from "@birim/core";
import { useConfiguratorStore } from "../../../store/useConfiguratorStore";
import { V3UnifiedWorkspace } from "../../../v3/components/V3UnifiedWorkspace";
import { Lock } from "lucide-react";

function TenantWhiteLabelEmbedPageInner() {
  const params = useParams<{ tenantSlug: string }>();
  const searchParams = useSearchParams();
  const slug = String(params?.tenantSlug || "birim").toLowerCase();
  const currencyParam = searchParams?.get("currency");

  const switchActiveTenant = useConfiguratorStore((s) => s.switchActiveTenant);
  const setUserExperienceTier = useConfiguratorStore((s) => s.setUserExperienceTier);
  const updateActiveTenantProfile = useConfiguratorStore((s) => s.updateActiveTenantProfile);
  const activeTenantProfile = useConfiguratorStore((s) => s.activeTenantProfile);
  const pricing = useConfiguratorStore((s) => s.pricing);
  const project = useConfiguratorStore((s) => s.project);

  useEffect(() => {
    const resolved = getTenantProfileByIdOrSlug(slug);
    switchActiveTenant(resolved.tenantId, "external_guest");
    setUserExperienceTier("simple");
    if (currencyParam === "EUR" || currencyParam === "TRY") {
      updateActiveTenantProfile({
        pricing: { ...resolved.pricing, currency: currencyParam },
      });
    }
    if (typeof window !== "undefined" && window.parent && window.parent !== window) {
      window.parent.postMessage(
        {
          namespace: "modul-embed-v1",
          type: "MODUL_READY",
          tenantSlug: resolved.slug,
        },
        "*"
      );
    }
  }, [slug, currencyParam, switchActiveTenant, setUserExperienceTier, updateActiveTenantProfile]);

  const embedCheck = checkTenantEntitlement(activeTenantProfile, "allowWhiteLabelEmbed");
  if (!embedCheck.allowed) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#FAF9F6] text-[#141413] p-6">
        <div className="max-w-md bg-white border border-[#E4DFD5] rounded-2xl p-6 text-center space-y-2">
          <Lock className="w-6 h-6 text-amber-700 mx-auto" />
          <h1 className="text-sm font-bold">White-Label Embed Özelliği Kapalı</h1>
          <p className="text-xs text-[#57534E]">{embedCheck.reasonTr}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <V3UnifiedWorkspace initialMode="studio" />
      <button
        type="button"
        data-testid="embed-send-to-cart-btn"
        onClick={() => {
          if (typeof window !== "undefined" && window.parent) {
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
              "*"
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
