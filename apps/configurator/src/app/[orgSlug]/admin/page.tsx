"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  CreditCard,
  FileSpreadsheet,
  Shield,
  Users,
} from "lucide-react";
import {
  PLAN_ENTITLEMENTS_MATRIX,
  getTenantProfileByIdOrSlug,
  type MaterialDefinition,
  type SaasPlanId,
  type SaasRoleId,
} from "@birim/core";
import { useConfiguratorStore } from "../../../store/useConfiguratorStore";

const SAMPLE_CSV = [
  "code,name,brand,category,thicknessMm,costPerM2Eur,edgeBandCostPerMEur,colorHex",
  "egger_h3170,Egger H3170 ST12 Kendal Meşe 19mm,Egger,wood,19,24.50,1.75,#B69876",
  "kastamonu_a428,Kastamonu A428 Antrasit Mat 18mm,Kastamonu,laminate,18,17.90,1.35,#3A3D40",
].join("\n");

export default function TenantBackofficeAdminPage() {
  const params = useParams<{ orgSlug: string }>();
  const slug = String(params?.orgSlug || "birim").toLowerCase();

  const activeTenantProfile = useConfiguratorStore((s) => s.activeTenantProfile);
  const switchActiveTenant = useConfiguratorStore((s) => s.switchActiveTenant);

  const [csvText, setCsvText] = useState(SAMPLE_CSV);
  const [importedMaterials, setImportedMaterials] = useState<MaterialDefinition[]>([]);
  const [csvFeedback, setCsvFeedback] = useState("");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<SaasRoleId>("architect");
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState("");

  const [checkoutUrl, setCheckoutUrl] = useState("");
  const [supabaseHealthResult, setSupabaseHealthResult] = useState<string>("");

  useEffect(() => {
    const resolved = getTenantProfileByIdOrSlug(slug);
    if (resolved.tenantId !== activeTenantProfile.tenantId) {
      switchActiveTenant(resolved.tenantId);
    }
  }, [slug, activeTenantProfile.tenantId, switchActiveTenant]);

  const entitlements = PLAN_ENTITLEMENTS_MATRIX[activeTenantProfile.planId];

  async function handleCsvImport() {
    setCsvFeedback("");
    const token =
      typeof window !== "undefined" ? window.localStorage.getItem("modul_saas_session_token") : null;
    const res = await fetch("/api/saas/catalog", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "x-modul-session-token": token } : { "x-modul-tenant-id": activeTenantProfile.tenantId }),
      },
      body: JSON.stringify({ action: "import_materials_csv", csvText }),
    });
    const data = (await res.json()) as {
      ok: boolean;
      importedCount?: number;
      materials?: MaterialDefinition[];
      error?: string;
    };
    if (data.ok && data.materials) {
      setImportedMaterials(data.materials);
      setCsvFeedback(`${data.importedCount} malzeme ve m² fiyat kartı başarıyla içe aktarıldı.`);
    } else {
      setCsvFeedback(data.error || "CSV içe aktarma başarısız.");
    }
  }

  async function handleCreateInvite(e: React.FormEvent) {
    e.preventDefault();
    const token =
      typeof window !== "undefined" ? window.localStorage.getItem("modul_saas_session_token") : null;
    const res = await fetch("/api/saas/auth", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "x-modul-session-token": token } : { "x-modul-tenant-id": activeTenantProfile.tenantId }),
      },
      body: JSON.stringify({
        action: "create_invite",
        tenantId: activeTenantProfile.tenantId,
        invitedEmail: inviteEmail,
        invitedRole: inviteRole,
      }),
    });
    const data = (await res.json()) as { ok: boolean; invite?: { inviteToken: string } };
    if (data.ok && data.invite) {
      setGeneratedInviteUrl(
        `${typeof window !== "undefined" ? window.location.origin : ""}/login?invite=${data.invite.inviteToken}`
      );
      setInviteEmail("");
    }
  }

  async function handleStartBillingCheckout(targetPlanId: SaasPlanId, provider: "iyzico_tr" | "stripe_global") {
    const token =
      typeof window !== "undefined" ? window.localStorage.getItem("modul_saas_session_token") : null;
    const res = await fetch("/api/saas/billing", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "x-modul-session-token": token } : { "x-modul-tenant-id": activeTenantProfile.tenantId }),
      },
      body: JSON.stringify({ targetPlanId, provider, billingCycle: "annual" }),
    });
    const data = (await res.json()) as { ok: boolean; checkout?: { checkoutUrl: string } };
    if (data.ok && data.checkout) {
      setCheckoutUrl(data.checkout.checkoutUrl);
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F3EE] text-[#141413] p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="bg-white border border-[#DED8CC] rounded-3xl p-6 flex flex-wrap items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#141413] text-[#E5D3B8] flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight">
                  {activeTenantProfile.brand.legalName} — Firma Yönetim Konsolu
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-600/12 text-emerald-900 text-[10px] font-bold uppercase">
                  {entitlements.planNameTr}
                </span>
              </div>
              <p className="text-xs text-[#57534E]">
                Domain: <strong>{activeTenantProfile.brand.customDomain}</strong> • Teklif Öneki:{" "}
                <strong>{activeTenantProfile.brand.quoteCodePrefix}-</strong> • CNC:{" "}
                <strong>{activeTenantProfile.machine.primaryCncFormat.toUpperCase()}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              data-testid="test-live-supabase-btn"
              onClick={async () => {
                setSupabaseHealthResult("Test ediliyor...");
                try {
                  const r = await fetch("/api/saas/supabase-health");
                  const j = await r.json();
                  setSupabaseHealthResult(
                    j.ok
                      ? `✓ Bağlantı Başarılı (${j.latencyMs}ms) • ${j.plansCount} Plan • ${j.organizationsCount} Firma • Yazma Testi OK`
                      : `✗ Hata (${j.stage}): ${j.message}`
                  );
                } catch {
                  setSupabaseHealthResult("✗ Sunucuya ulaşılamadı.");
                }
              }}
              className="h-9 px-4 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold cursor-pointer"
            >
              Supabase Bağlantısını Test Et
            </button>
            <Link
              href="/v3/studio"
              className="h-9 px-4 rounded-2xl bg-[#141413] text-white text-xs font-bold inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>3B Tasarım Stüdyosuna Dön</span>
            </Link>
          </div>
        </div>

        {supabaseHealthResult && (
          <div className="p-3.5 rounded-2xl bg-white border border-[#DED8CC] text-xs font-mono font-semibold text-[#141413]">
            {supabaseHealthResult}
          </div>
        )}

        {/* Grid Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
          {/* 1. CSV Material & Pricing Importer */}
          <section className="bg-white border border-[#DED8CC] rounded-3xl p-6 space-y-4">
            <div className="flex items-center gap-2 font-bold text-sm">
              <FileSpreadsheet className="w-4 h-4 text-[#8C7A6B]" />
              <h2>CSV Toplu Malzeme Kartelası ve m² Fiyat Listesi Aktarımı</h2>
            </div>
            <p className="text-[#57534E]">
              Egger, Kastamonu, Yıldız Entegre veya özel boyahane kartelalarınızı tek adımda organizasyon kütüphanenize aktarın.
            </p>
            <textarea
              rows={5}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              className="w-full p-3 rounded-2xl border border-[#DED8CC] bg-[#FAF9F6] font-mono text-[11px]"
            />
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleCsvImport}
                className="h-9 px-4 rounded-xl bg-[#141413] text-white font-bold cursor-pointer"
              >
                CSV Malzeme Listesini Doğrula ve İçe Aktar
              </button>
              {csvFeedback && (
                <span className="text-emerald-800 font-semibold inline-flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> {csvFeedback}
                </span>
              )}
            </div>
            {importedMaterials.length > 0 && (
              <div className="border-t border-[#EFECE5] pt-3 space-y-1">
                {importedMaterials.map((m) => (
                  <div key={m.id} className="flex items-center justify-between py-1 text-[11px]">
                    <span className="font-semibold">{m.name} ({m.thickness}mm)</span>
                    <span className="font-mono">€ {m.costPerM2.toFixed(2)} / m²</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 2. Team Members & Invitations */}
          <section className="bg-white border border-[#DED8CC] rounded-3xl p-6 space-y-4">
            <div className="flex items-center gap-2 font-bold text-sm">
              <Users className="w-4 h-4 text-[#8C7A6B]" />
              <h2>Ekip Üyeleri, Bayi Kullanıcıları ve Rol Daveti</h2>
            </div>
            <p className="text-[#57534E]">
              İç mimar, üretim sorumlusu, mağaza satış temsilcisi veya B2B bayilerinizi rol bazlı yetki sınırıyla davet edin (Kota: maks. {entitlements.maxUsers} kullanıcı).
            </p>
            <form onSubmit={handleCreateInvite} className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <input
                type="email"
                required
                placeholder="mimar@firma.com.tr"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="h-9 px-3 rounded-xl border border-[#DED8CC] bg-[#FAF9F6]"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as SaasRoleId)}
                className="h-9 px-2.5 rounded-xl border border-[#DED8CC] bg-[#FAF9F6] font-semibold"
              >
                <option value="architect">İç Mimar</option>
                <option value="production_lead">Üretim &amp; CAM Müdürü</option>
                <option value="sales_rep">Satış Temsilcisi</option>
                <option value="dealer_admin">B2B Bayi Yöneticisi</option>
                <option value="readonly_viewer">Salt-Okunur</option>
              </select>
              <button
                type="submit"
                className="h-9 px-4 rounded-xl bg-[#141413] text-white font-bold cursor-pointer"
              >
                Davet Bağlantısı Üret
              </button>
            </form>
            {generatedInviteUrl && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 font-mono text-[11px] break-all text-emerald-950">
                Davet Hazır: {generatedInviteUrl}
              </div>
            )}
          </section>

          {/* 3. Billing, Quotas & İyzico / Stripe */}
          <section className="bg-white border border-[#DED8CC] rounded-3xl p-6 space-y-4 lg:col-span-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 font-bold text-sm">
                <CreditCard className="w-4 h-4 text-[#8C7A6B]" />
                <h2>Abonelik Paketi, Kota Sınırları ve Faturalama (İyzico TR &amp; Stripe Global)</h2>
              </div>
              <div className="inline-flex items-center gap-1.5 text-[11px] text-[#57534E]">
                <Shield className="w-3.5 h-3.5 text-emerald-700" />
                <span>Ödeme gecikmesinde 7 gün veri kayıpsız salt-okunur koruma aktif</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl bg-[#FAF9F6] border border-[#E4DFD5]">
                <div className="text-[10px] uppercase font-bold text-[#78716C]">Aktif Proje Limiti</div>
                <div className="text-sm font-mono font-bold mt-0.5">{entitlements.maxActiveProjects} Proje</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#FAF9F6] border border-[#E4DFD5]">
                <div className="text-[10px] uppercase font-bold text-[#78716C]">Aylık Bulut Render</div>
                <div className="text-sm font-mono font-bold mt-0.5">{entitlements.monthlyCloudRenderCredits} Kredi</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#FAF9F6] border border-[#E4DFD5]">
                <div className="text-[10px] uppercase font-bold text-[#78716C]">Aylık CNC / CAM İhracı</div>
                <div className="text-sm font-mono font-bold mt-0.5">{entitlements.monthlyCamExports} Paket</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#FAF9F6] border border-[#E4DFD5]">
                <div className="text-[10px] uppercase font-bold text-[#78716C]">Bulut Depolama</div>
                <div className="text-sm font-mono font-bold mt-0.5">{entitlements.storageQuotaGb} GB (R2 İzole)</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => handleStartBillingCheckout("business", "iyzico_tr")}
                className="h-9 px-4 rounded-xl bg-[#141413] text-white font-bold cursor-pointer"
              >
                İyzico (TL + %20 KDV) ile Business Yıllık Pakete Geç
              </button>
              <button
                type="button"
                onClick={() => handleStartBillingCheckout("enterprise", "stripe_global")}
                className="h-9 px-4 rounded-xl bg-white border border-[#141413] text-[#141413] font-bold cursor-pointer"
              >
                Stripe (EUR) ile Enterprise Kurumsal Pakete Geç
              </button>
            </div>

            {checkoutUrl && (
              <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-950 font-mono text-[11px]">
                Güvenli Ödeme Oturumu Oluşturuldu: {checkoutUrl}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
