"use client";

import React, { useMemo, useState } from "react";
import { useConfiguratorStore } from "../store/useConfiguratorStore";
import { MockStoreAdapter, MockERPAdapter } from "@birim/integrations";
import { DEFAULT_MATERIALS } from "@birim/core";
import { buildBirimErpNestingBundle } from "@birim/manufacturing";
import {
  X,
  CheckCircle,
  ShieldCheck,
  ArrowRight,
  Store,
  Factory,
  Download,
  Scissors,
} from "lucide-react";

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
  const [erpError, setErpError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"store" | "erp" | null>(null);

  const liveErpNesting = useMemo(() => {
    if (!isOpen) return null;
    const matMap = new Map(DEFAULT_MATERIALS.map((m) => [m.id, m]));
    return buildBirimErpNestingBundle(project, bom, matMap, {
      organizationId: project.branchId || "org_birim_fabrika",
      orderRef: `SIPARIS_${project.id}_v${project.version}`,
      sheetWidthMm: 2800,
      sheetHeightMm: 2100,
      kerfMm: 4,
      edgeMarginMm: 15,
      algorithm: "Auto",
      useNetCutDimensions: true,
    });
  }, [isOpen, project, bom]);

  if (!isOpen) return null;

  const triggerDownload = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (a.parentNode) a.parentNode.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1500);
  };

  const handleExportStore = async () => {
    setLoading("store");
    try {
      const adapter = new MockStoreAdapter();
      const res = await adapter.createOrUpdateQuoteItem(
        project,
        bom,
        pricing,
        "TEKLIF_2026_0412"
      );
      setStoreStatus(
        `Birim Store CPQ Teklif Kalemi Başarıyla Güncellendi! Snapshot ID: ${res.snapshotId}`
      );
    } finally {
      setLoading(null);
    }
  };

  const handleExportERP = async () => {
    setLoading("erp");
    setErpError(null);
    try {
      const adapter = new MockERPAdapter();
      const res = await adapter.publishProductionBlueprint(
        project,
        bom,
        "SIPARIS_2026_9941"
      );
      setErpStatus(
        `Birim ERP Üretim Reçetesi & Nesting Paketi Oluşturuldu! Blueprint: ${res.blueprintId} • ${res.itemsCount} Parça • ${res.nestingJobsCount} Levha Grubu • ${res.totalSheetsUsed} Plaka`
      );
    } catch (err) {
      setErpError(err instanceof Error ? err.message : "ERP aktarım hatası");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-2xl p-4">
      <div className="flex flex-col w-full max-w-3xl birim-ice-dark-bar border border-white/20 rounded-3xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950/70 backdrop-blur-2xl border-b border-white/10">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-slate-100">
              Birim Store & ERP Nesting Entegrasyon Köprüsü
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Isolation Notice */}
        <div className="p-4 bg-amber-950/30 border-b border-amber-800/40 text-xs text-amber-300 flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-amber-400" />
          <div>
            <strong>Birim Portal ERP Nesting Tam Uyum Modu:</strong> Üretilen JSON, Selco WNT 600 CSV
            ve CNC Router G-Code çıktıları <code>nesting_projects</code>, <code>nesting_sheets</code>,{" "}
            <code>nesting_parts</code> (<code>serializeEdgeBanding</code> U1/U2/K1/K2 + Arkalık Kanalı)
            ve <code>nesting_placements</code> şemalarıyla %100 birebir uyumludur.
          </div>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Birim Store CPQ */}
          <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-600/20 text-blue-400">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-200">
                    Birim Store (Mağaza & Satış CPQ)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Tasarım kilitlenir, fiyat ve malzeme özeti teklif sepetine eklenir
                  </p>
                </div>
              </div>
              <button
                onClick={handleExportStore}
                disabled={loading === "store"}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow transition-all disabled:opacity-50 cursor-pointer"
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

          {/* Birim ERP Production Blueprint & Nesting Bridge */}
          <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-600/20 text-amber-400">
                  <Factory className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-200">
                    Birim ERP (Üretim Reçetesi & CNC Panel Nesting)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Malzeme/kalınlık bazlı <code>nesting_projects</code> iş emirleri, 2800×2100mm plaka
                    optimizasyonu ve artık plaka geri kazanımı
                  </p>
                </div>
              </div>
              <button
                onClick={handleExportERP}
                disabled={loading === "erp"}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold shadow transition-all disabled:opacity-50 cursor-pointer"
              >
                {loading === "erp" ? "İşleniyor..." : "Üretime Gönder"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {liveErpNesting && (
              <div className="p-3.5 rounded-lg bg-slate-900/90 border border-slate-800 space-y-3">
                <div className="grid grid-cols-4 gap-2 text-center font-mono text-xs">
                  <div className="p-2 rounded bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400 font-sans">Levha Grubu</div>
                    <div className="font-bold text-slate-100">
                      {liveErpNesting.summary.board_groups_count} İş Emri
                    </div>
                  </div>
                  <div className="p-2 rounded bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400 font-sans">Toplam Plaka</div>
                    <div className="font-bold text-amber-400">
                      {liveErpNesting.summary.total_sheets_used} Adet
                    </div>
                  </div>
                  <div className="p-2 rounded bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400 font-sans">Doluluk / Verim</div>
                    <div className="font-bold text-emerald-400">
                      %{liveErpNesting.summary.overall_utilization_percent}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400 font-sans">Artık Plaka (≥400)</div>
                    <div className="font-bold text-cyan-400">
                      {liveErpNesting.summary.reclaimable_remnants_count} ({liveErpNesting.summary.reclaimable_remnants_area_m2} m²)
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      triggerDownload(
                        JSON.stringify(liveErpNesting, null, 2),
                        `Birim_ERP_Nesting_Payload_${project.id}_v${project.version}.json`,
                        "application/json;charset=utf-8"
                      )
                    }
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    ERP Nesting JSON Paketi (.json)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      triggerDownload(
                        liveErpNesting.combined_selco_csv,
                        `NST_${project.id}_SELCO_WNT600.csv`,
                        "text/csv;charset=utf-8"
                      )
                    }
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold cursor-pointer"
                  >
                    <Scissors className="w-3.5 h-3.5" />
                    ERP Selco CSV (.csv)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      triggerDownload(
                        liveErpNesting.combined_cnc_gcode,
                        `NST_${project.id}_all.nc`,
                        "text/plain;charset=utf-8"
                      )
                    }
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-100 text-xs font-bold cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    ERP G-Code (.nc)
                  </button>
                </div>
              </div>
            )}

            {erpStatus && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-lg text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{erpStatus}</span>
              </div>
            )}
            {erpError && (
              <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-lg text-rose-300 text-xs">
                {erpError}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
