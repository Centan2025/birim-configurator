"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, ShieldAlert, Server } from "lucide-react";
import { listRegisteredTenantProfiles } from "@birim/core";
import { runBirimTenant1ShadowVerification } from "@birim/integrations";

export default function ModulPlatformSuperAdminPage() {
  const tenants = useMemo(() => listRegisteredTenantProfiles(), []);
  const shadowReport = useMemo(() => runBirimTenant1ShadowVerification(), []);

  return (
    <div className="min-h-screen bg-[#F5F3EE] text-[#141413] p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-6 text-xs">
        <div className="bg-[#141413] text-white rounded-3xl p-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Server className="w-6 h-6 text-[#E5D3B8]" />
            <div>
              <h1 className="text-lg font-bold">Modül SaaS — Platform SuperAdmin Gözlem ve Denetim Merkezi</h1>
              <p className="text-stone-300 text-xs">
                Tüm müşteri organizasyonları, abonelik durumları ve Birim Tenant #1 sıfır-sapma gölge doğrulaması.
              </p>
            </div>
          </div>
          <Link
            href="/v3/studio"
            className="h-9 px-4 rounded-2xl bg-white text-[#141413] font-bold inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Stüdyoya Dön</span>
          </Link>
        </div>

        {/* Birim Tenant #1 Shadow Verification Card */}
        <div className="bg-white border border-[#DED8CC] rounded-3xl p-6 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 font-bold text-sm text-emerald-900">
              {shadowReport.parityVerified ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
              ) : (
                <ShieldAlert className="w-4 h-4 text-amber-700" />
              )}
              <span>Birim Mobilya A.Ş. (Tenant #1) Gölge Çalışma Doğrulaması</span>
            </div>
            <p className="text-[#57534E]">
              Tekil referans motor ile çok kiracılı SaaS motoru karşılaştırması: Fiyat farkı{" "}
              <strong className="font-mono">€ {shadowReport.eurDelta.toFixed(2)}</strong> • Kesim parçası farkı{" "}
              <strong className="font-mono">{shadowReport.cutPieceCountDelta}</strong> • CNC delik farkı{" "}
              <strong className="font-mono">{shadowReport.drillingHoleCountDelta}</strong>
            </p>
          </div>
          <span className="px-3 py-1.5 rounded-xl bg-emerald-600/12 text-emerald-900 font-mono font-bold">
            € {shadowReport.tenant1TotalWithVatEur.toFixed(2)} === € {shadowReport.legacyTotalWithVatEur.toFixed(2)}
          </span>
        </div>

        {/* Tenants Table */}
        <div className="bg-white border border-[#DED8CC] rounded-3xl p-6 space-y-4">
          <h2 className="text-sm font-bold">Kayıtlı Müşteri Organizasyonları ({tenants.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#EFECE5] text-[11px] uppercase text-[#78716C]">
                  <th className="py-2.5 pr-4">Organizasyon</th>
                  <th className="py-2.5 pr-4">Plan</th>
                  <th className="py-2.5 pr-4">Konstrüksiyon</th>
                  <th className="py-2.5 pr-4">CNC / Entegrasyon</th>
                  <th className="py-2.5 pr-4">Para / Bayi</th>
                  <th className="py-2.5">Yönetim</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F5F3EE]">
                {tenants.map((t) => (
                  <tr key={t.tenantId}>
                    <td className="py-3 pr-4">
                      <div className="font-bold">{t.brand.legalName}</div>
                      <div className="font-mono text-[11px] text-[#78716C]">{t.brand.customDomain}</div>
                    </td>
                    <td className="py-3 pr-4 uppercase font-bold">{t.planId}</td>
                    <td className="py-3 pr-4">
                      {t.construction.defaultCarcassThicknessMm}mm / {t.construction.defaultBackThicknessMm}mm ({t.construction.connectorSystem})
                    </td>
                    <td className="py-3 pr-4 font-mono">
                      {t.machine.primaryCncFormat} • {t.integrationMode}
                    </td>
                    <td className="py-3 pr-4 font-mono">
                      {t.pricing.currency} (-%{t.pricing.dealerDiscountPercent})
                    </td>
                    <td className="py-3">
                      <Link
                        href={`/${t.slug}/admin`}
                        className="px-3 py-1.5 rounded-xl bg-[#FAF9F6] border border-[#DED8CC] font-bold hover:bg-[#EFECE5]"
                      >
                        Firma Admin
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
