"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Cpu, Sparkles } from "lucide-react";
import { useConfiguratorStore, type ConfiguratorState } from "../../store/useConfiguratorStore";
import type {
  BackPanelMountingMode,
  CncMachineFormatId,
  ConnectorSystemType,
  SaasPlanId,
} from "@birim/core";

export default function ModulSaasOnboardingWizardPage() {
  const router = useRouter();
  const switchActiveTenant = useConfiguratorStore((s: ConfiguratorState) => s.switchActiveTenant);

  const [companyDisplayName, setCompanyDisplayName] = useState("NOVA MUTFAK");
  const [companyLegalName, setCompanyLegalName] = useState("Nova Mutfak ve Modüler Mobilya San. A.Ş.");
  const [slug, setSlug] = useState("nova-mutfak");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("kurucu@novamutfak.com.tr");
  const [password, setPassword] = useState("Nova2026!");
  const [planId, setPlanId] = useState<SaasPlanId>("business");
  const [currency, setCurrency] = useState<"TRY" | "EUR">("TRY");
  const [carcassThicknessMm, setCarcassThicknessMm] = useState<number>(18);
  const [backPanelMounting, setBackPanelMounting] = useState<BackPanelMountingMode>("grooved_8mm");
  const [connectorSystem, setConnectorSystem] = useState<ConnectorSystemType>("minifix_dowel");
  const [primaryCncFormat, setPrimaryCncFormat] = useState<CncMachineFormatId>("biesse_cix");
  const [errorMsg, setErrorMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleCreateWorkspace(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/saas/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register_org",
          companyDisplayName,
          companyLegalName,
          slug,
          fullName,
          email,
          password,
          planId,
          currency,
          carcassThicknessMm,
          backPanelMounting,
          connectorSystem,
          primaryCncFormat,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        sessionToken?: string;
        tenant?: { tenantId: string; slug: string };
      };
      if (!res.ok || !data.ok || !data.tenant) {
        setErrorMsg(data.error || "Organizasyon kurulumu tamamlanamadı.");
        return;
      }
      // Session token is kept exclusively in the httpOnly `modul_session` cookie (never stored in localStorage)
      switchActiveTenant(data.tenant.tenantId, "org_owner");
      router.push(`/${data.tenant.slug}/admin`);
    } catch {
      setErrorMsg("Sunucu bağlantısı sırasında hata oluştu.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F3EE] text-[#141413] py-10 px-4 flex items-center justify-center">
      <div className="w-full max-w-3xl bg-white border border-[#DED8CC] rounded-3xl p-8 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-[#EFECE5] pb-4">
          <div>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-600/12 text-emerald-900 text-[10px] font-bold uppercase">
              14 Gün Ücretsiz Deneme • Kredi Kartı Gerekmez
            </span>
            <h1 className="text-xl font-bold tracking-tight mt-1.5">
              Modül SaaS — Yeni Üretici &amp; Mimarlık Ofisi Kurulum Sihirbazı
            </h1>
          </div>
          <Link href="/login" className="text-xs font-bold text-[#57534E] hover:text-[#141413] underline">
            Mevcut Hesapla Giriş
          </Link>
        </div>

        <form onSubmit={handleCreateWorkspace} className="space-y-5 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label className="space-y-1">
              <span className="font-semibold">Marka Kısa Adı</span>
              <input
                required
                value={companyDisplayName}
                onChange={(e) => setCompanyDisplayName(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border border-[#DED8CC] bg-[#FAF9F6] font-semibold"
              />
            </label>
            <label className="space-y-1">
              <span className="font-semibold">Resmi Ticari Unvan</span>
              <input
                required
                value={companyLegalName}
                onChange={(e) => setCompanyLegalName(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border border-[#DED8CC] bg-[#FAF9F6]"
              />
            </label>
            <label className="space-y-1">
              <span className="font-semibold">Alt Alan Adı (Subdomain)</span>
              <input
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                className="w-full h-9 px-3 rounded-xl border border-[#DED8CC] bg-[#FAF9F6] font-mono"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label className="space-y-1">
              <span className="font-semibold">Yönetici Ad Soyad</span>
              <input
                required
                placeholder="Ad Soyad"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border border-[#DED8CC] bg-[#FAF9F6]"
              />
            </label>
            <label className="space-y-1">
              <span className="font-semibold">Kurumsal E-Posta</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border border-[#DED8CC] bg-[#FAF9F6]"
              />
            </label>
            <label className="space-y-1">
              <span className="font-semibold">Yönetici Parolası</span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border border-[#DED8CC] bg-[#FAF9F6]"
              />
            </label>
          </div>

          <div className="p-4 rounded-2xl bg-[#FAF9F6] border border-[#E4DFD5] space-y-3">
            <div className="inline-flex items-center gap-1.5 font-bold text-[#141413]">
              <Cpu className="w-4 h-4 text-[#8C7A6B]" />
              <span>Fabrika Konstrüksiyon, CNC Makine ve Para Birimi Standartları</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <label className="space-y-1">
                <span className="text-[11px] font-semibold">Gövde Levha (mm)</span>
                <select
                  value={carcassThicknessMm}
                  onChange={(e) => setCarcassThicknessMm(Number(e.target.value))}
                  className="w-full h-9 px-2.5 rounded-xl border border-[#DED8CC] bg-white font-semibold"
                >
                  {[16, 18, 19, 22, 25].map((n) => (
                    <option key={n} value={n}>{n} mm</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[11px] font-semibold">Arkalık Tipi</span>
                <select
                  value={backPanelMounting}
                  onChange={(e) => setBackPanelMounting(e.target.value as BackPanelMountingMode)}
                  className="w-full h-9 px-2.5 rounded-xl border border-[#DED8CC] bg-white font-semibold"
                >
                  <option value="grooved_8mm">8mm Kanal</option>
                  <option value="rabbeted_8mm">8mm Lamba</option>
                  <option value="surface_nailed_4mm">4mm HDF Çivili</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[11px] font-semibold">Bağlantı</span>
                <select
                  value={connectorSystem}
                  onChange={(e) => setConnectorSystem(e.target.value as ConnectorSystemType)}
                  className="w-full h-9 px-2.5 rounded-xl border border-[#DED8CC] bg-white font-semibold"
                >
                  <option value="minifix_dowel">Minifiks + Kavela</option>
                  <option value="lamello_cabineo">Lamello Cabineo</option>
                  <option value="confirmat">Konfirmat</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[11px] font-semibold">CNC Makine</span>
                <select
                  value={primaryCncFormat}
                  onChange={(e) => setPrimaryCncFormat(e.target.value as CncMachineFormatId)}
                  className="w-full h-9 px-2.5 rounded-xl border border-[#DED8CC] bg-white font-semibold"
                >
                  <option value="homag_mpr">Homag (.MPR)</option>
                  <option value="biesse_cix">Biesse (.CIX)</option>
                  <option value="scm_xcs">SCM (.XCS)</option>
                  <option value="iso_gcode">ISO G-Code</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[11px] font-semibold">Para Birimi</span>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as "TRY" | "EUR")}
                  className="w-full h-9 px-2.5 rounded-xl border border-[#DED8CC] bg-white font-semibold"
                >
                  <option value="TRY">TRY (₺)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {(["starter", "professional", "business", "enterprise"] as SaasPlanId[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPlanId(p)}
                className={`p-3 rounded-2xl border text-left cursor-pointer ${
                  planId === p
                    ? "bg-[#141413] text-white border-[#141413]"
                    : "bg-[#FAF9F6] border-[#DED8CC] text-[#141413]"
                }`}
              >
                <div className="font-bold uppercase text-[11px] flex items-center justify-between">
                  <span>{p}</span>
                  {planId === p && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </div>
                <div className={`text-[10px] mt-1 ${planId === p ? "text-stone-300" : "text-[#57534E]"}`}>
                  {p === "starter"
                    ? "Temel 3B + BOM"
                    : p === "professional"
                      ? "İç Mimarlık + Embed"
                      : p === "business"
                        ? "Tam CNC + ERP + Bayi"
                        : "Çok Şube + Özel SLA"}
                </div>
              </button>
            ))}
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 font-semibold">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-11 rounded-2xl bg-[#141413] text-white font-bold inline-flex items-center justify-center gap-2 hover:bg-stone-800 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-[#E5D3B8]" />
            <span>{submitting ? "Organizasyon Hazırlanıyor..." : "İzole SaaS Çalışma Alanını Oluştur ve Başlat"}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
