"use client";

import React, { useEffect, useState } from "react";
import { useConfiguratorStore } from "../store/useConfiguratorStore";

export interface AppErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AppErrorBoundary({ error, reset }: AppErrorProps) {
  const [backupNotice, setBackupNotice] = useState<string | null>(null);

  useEffect(() => {
    console.error("[AppErrorBoundary] Unhandled route error:", error);
  }, [error]);

  const handleEmergencyExport = () => {
    try {
      const json = useConfiguratorStore.getState().exportProjectJSON();
      const blob = new Blob([json], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `modul-acil-yedek-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setBackupNotice("Proje JSON yedeği indirildi.");
    } catch {
      setBackupNotice("Acil yedek indirilemedi; tarayıcı otomatik taslağı korunmaktadır.");
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#1A1E26] text-slate-100 p-6">
      <div className="max-w-lg w-full rounded-3xl bg-white border border-[#E5DFD3] shadow-xl p-8 space-y-5">
        <div className="space-y-1.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
            Modül Studio Kurtarma Ekranı
          </p>
          <h1 className="text-xl font-bold text-[#141413]">
            Beklenmeyen bir uygulama hatası oluştu
          </h1>
          <p className="text-sm text-[#57534E]">
            Çalışmanız bellek ve yerel taslak katmanında korunmaya çalışıldı. Devam etmek için
            ekranı yeniden yükleyebilir veya önce acil JSON yedeği indirebilirsiniz.
          </p>
        </div>

        <div className="rounded-xl bg-[#FAF8F4] border border-[#E7E1D4] p-3 text-xs font-mono text-[#57534E] break-words">
          {error?.message || "Bilinmeyen çalışma zamanı hatası"}
          {error?.digest ? ` (Kod: ${error.digest})` : ""}
        </div>

        {backupNotice && (
          <div className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
            {backupNotice}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={reset}
            className="px-4 py-2.5 rounded-xl bg-[#141413] text-white text-xs font-semibold hover:bg-[#292524] transition cursor-pointer"
          >
            Stüdyoyu Yeniden Yükle
          </button>
          <button
            type="button"
            onClick={handleEmergencyExport}
            className="px-4 py-2.5 rounded-xl bg-[#F5F2EA] text-[#141413] border border-[#DED8CC] text-xs font-semibold hover:bg-[#E7E1D4] transition cursor-pointer"
          >
            Acil Proje JSON Yedeği İndir
          </button>
        </div>
      </div>
    </div>
  );
}
