"use client";

import React from "react";

export interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html lang="tr">
      <body className="min-h-screen w-full flex items-center justify-center bg-[#1A1E26] text-slate-100 p-6 font-sans">
        <div className="max-w-md w-full rounded-3xl bg-white border border-[#E5DFD3] shadow-xl p-8 space-y-4">
          <h1 className="text-lg font-bold">Uygulama kritik bir hatayla karşılaştı</h1>
          <p className="text-sm text-[#57534E]">
            Sayfa kök düzeni yeniden başlatılmalıdır. Yerel tarayıcı taslaklarınız silinmemiştir.
          </p>
          <div className="rounded-xl bg-[#FAF8F4] border border-[#E7E1D4] p-3 text-xs font-mono text-[#57534E] break-words">
            {error?.message || "Kritik çalışma zamanı hatası"}
          </div>
          <button
            type="button"
            onClick={reset}
            className="px-4 py-2.5 rounded-xl bg-[#141413] text-white text-xs font-semibold hover:bg-[#292524] transition cursor-pointer"
          >
            Uygulamayı Yeniden Başlat
          </button>
        </div>
      </body>
    </html>
  );
}
