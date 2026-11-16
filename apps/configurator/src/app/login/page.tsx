"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, KeyRound, ArrowRight } from "lucide-react";
import { useConfiguratorStore, type ConfiguratorState } from "../../store/useConfiguratorStore";
import type { SaasRoleId } from "@birim/core";

export default function ModulSaasLoginPage() {
  const router = useRouter();
  const switchActiveTenant = useConfiguratorStore((s: ConfiguratorState) => s.switchActiveTenant);
  const [email, setEmail] = useState("info@birim.com");
  const [password, setPassword] = useState("Birim2026!");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);
    try {
      const res = await fetch("/api/saas/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", email, password }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        sessionToken?: string;
        activeMembership?: { tenantId: string; role: SaasRoleId };
      };
      if (!res.ok || !data.ok || !data.activeMembership) {
        setErrorMsg(data.error || "Giriş başarısız oldu.");
        return;
      }
      if (typeof window !== "undefined" && data.sessionToken) {
        window.localStorage.setItem("modul_saas_session_token", data.sessionToken);
      }
      switchActiveTenant(data.activeMembership.tenantId, data.activeMembership.role);
      router.push("/v3/studio");
    } catch {
      setErrorMsg("Sunucu bağlantısı kurulamadı.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F3EE] text-[#141413] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white border border-[#DED8CC] rounded-3xl p-8 shadow-xl space-y-6">
        <div className="space-y-1.5">
          <div className="w-11 h-11 rounded-2xl bg-[#141413] text-[#E5D3B8] flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </div>
          <h1 className="text-lg font-bold tracking-tight pt-2">Modül SaaS Organizasyon Girişi</h1>
          <p className="text-xs text-[#57534E]">
            Üretici fabrikanız, iç mimarlık ofisiniz veya bayi hesabınızla oturum açın.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <label className="block space-y-1">
            <span className="font-semibold text-[#44403C]">Kurumsal E-Posta</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-10 px-3.5 rounded-xl border border-[#DED8CC] bg-[#FAF9F6] font-medium"
            />
          </label>
          <label className="block space-y-1">
            <span className="font-semibold text-[#44403C]">Parola</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-10 px-3.5 rounded-xl border border-[#DED8CC] bg-[#FAF9F6] font-medium"
            />
          </label>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 font-semibold">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 rounded-xl bg-[#141413] text-white font-bold inline-flex items-center justify-center gap-2 hover:bg-stone-800 cursor-pointer"
          >
            <KeyRound className="w-4 h-4 text-[#E5D3B8]" />
            <span>{loading ? "Doğrulanıyor..." : "Oturum Aç ve Stüdyoya Geç"}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        <div className="pt-3 border-t border-[#EFECE5] flex items-center justify-between text-xs text-[#57534E]">
          <span>Yeni üretici veya tasarım ofisi misiniz?</span>
          <Link href="/onboarding" className="font-bold text-[#141413] underline">
            5 Dakikada Firma Kur
          </Link>
        </div>
      </div>
    </div>
  );
}
