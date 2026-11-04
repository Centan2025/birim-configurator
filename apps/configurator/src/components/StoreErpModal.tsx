"use client";

import React, { useState } from "react";
import { useConfiguratorStore } from "../store/useConfiguratorStore";
import { MockStoreAdapter, MockERPAdapter } from "@birim/integrations";
import { X, CheckCircle, ShieldCheck, ArrowRight, Store, Factory } from "lucide-react";

interface StoreErpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function StoreErpModal({ isOpen, onClose }: StoreErpModalProps) {
  const project = useConfiguratorStore((s) => s.project);
  const bom = useConfiguratorStore((s) => s.bom);
  const pricing = useConfiguratorStore((s) => s.pricing);

  const [storeStatus, setStoreStatus] = useState<string | null>(null);
  const [erpStatus, setErpStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState<"store" | "erp" | null>(null);

  if (!isOpen) return null;

  const handleExportStore = async () => {
    setLoading("store");
    try {
      const adapter = new MockStoreAdapter();
      const res = await adapter.createOrUpdateQuoteItem(project, bom, pricing, "TEKLIF_2026_0412");
      setStoreStatus(`Birim Store CPQ Teklif Kalemi Başarıyla Güncellendi! Snapshot ID: ${res.snapshotId}`);
    } finally {
      setLoading(null);
    }
  };

  const handleExportERP = async () => {
    setLoading("erp");
    try {
      const adapter = new MockERPAdapter();
      const res = await adapter.publishProductionBlueprint(project, bom, "SIPARIS_2026_9941");
      setErpStatus(`Birim ERP Üretim Reçetesi (Blueprint) Oluşturuldu! ID: ${res.blueprintId} (${res.itemsCount} İş Emri Parçası)`);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="flex flex-col w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-slate-100">Birim Store & ERP Entegrasyon Köprüsü</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Isolation Notice */}
        <div className="p-4 bg-amber-950/30 border-b border-amber-800/40 text-xs text-amber-300 flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-amber-400" />
          <div>
            <strong>Güvenli İzolasyon Modu:</strong> Canlı üretim veya staging Supabase veritabanlarına doğrudan yazma devre dışıdır.
            Entegrasyon işlemleri doğrulanmış API kontratları ve güvenli adaptör katmanı üzerinden yürütülür.
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Birim Store CPQ */}
          <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-600/20 text-blue-400">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-200">Birim Store (Mağaza & Satış CPQ)</h3>
                  <p className="text-xs text-slate-400">Tasarım kilitlenir, fiyat ve malzeme özeti teklif sepetine eklenir</p>
                </div>
              </div>
              <button
                onClick={handleExportStore}
                disabled={loading === "store"}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow transition-all disabled:opacity-50"
              >
                {loading === "store" ? "İşleniyor..." : "Teklif Kalemine Aktar"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            {storeStatus && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-lg text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{storeStatus}</span>
              </div>
            )}
          </div>

          {/* Birim ERP Production Blueprint */}
          <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-600/20 text-amber-400">
                  <Factory className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-200">Birim ERP (Üretim & Fabrika)</h3>
                  <p className="text-xs text-slate-400">Onaylı sipariş için üretim reçetesi (production_blueprints) ve atölye rotaları oluşturulur</p>
                </div>
              </div>
              <button
                onClick={handleExportERP}
                disabled={loading === "erp"}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold shadow transition-all disabled:opacity-50"
              >
                {loading === "erp" ? "İşleniyor..." : "Üretime Gönder"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            {erpStatus && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-lg text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{erpStatus}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
