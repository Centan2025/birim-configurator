"use client";

import React, { useState } from "react";
import { useConfiguratorStore } from "../store/useConfiguratorStore";
import { X, Download, CheckCircle, AlertTriangle } from "lucide-react";

interface BomModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function BomModal({ isOpen, onClose }: BomModalProps) {
  const [activeTab, setActiveTab] = useState<"cutlist" | "hardware" | "sheets">("cutlist");
  const bom = useConfiguratorStore((s) => s.bom);
  const project = useConfiguratorStore((s) => s.project);

  if (!isOpen) return null;

  const downloadJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(bom, null, 2));
    const a = document.createElement("a");
    a.href = dataStr;
    a.download = `BOM_${project.id}_v${project.version}.json`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="flex flex-col w-full max-w-5xl h-[85vh] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <span>BOM & Üretim Kesim Listesi</span>
              <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono">
                v{project.version}
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Parametrik modelden türetilmiş net panel kesim, kenar bandı ve hırdavat verileri
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={downloadJson}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
            >
              <Download className="w-3.5 h-3.5" />
              JSON İndir
            </button>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Summary Badges */}
        <div className="grid grid-cols-4 gap-4 px-6 py-3 bg-slate-950/60 border-b border-slate-800/80 text-xs">
          <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
            <span className="text-slate-400">Toplam Parça:</span>
            <div className="text-base font-bold text-slate-200">{bom.summary.totalPiecesCount} adet</div>
          </div>
          <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
            <span className="text-slate-400">Net Panel Alanı:</span>
            <div className="text-base font-bold text-amber-400">{bom.summary.totalPanelAreaM2} m²</div>
          </div>
          <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
            <span className="text-slate-400">Kenar Bandı:</span>
            <div className="text-base font-bold text-blue-400">{bom.summary.totalEdgeBandMeters} mt</div>
          </div>
          <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
            <span className="text-slate-400">Hırdavat Kalemi:</span>
            <div className="text-base font-bold text-emerald-400">{bom.summary.totalHardwareCount} adet</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-6 pt-3 border-b border-slate-800 gap-4 text-xs font-medium">
          <button
            onClick={() => setActiveTab("cutlist")}
            className={`pb-2 border-b-2 transition-colors ${activeTab === "cutlist" ? "border-amber-500 text-amber-400 font-semibold" : "border-transparent text-slate-400 hover:text-slate-200"}`}
          >
            Panel Parça Kesim Listesi ({bom.cutList.length})
          </button>
          <button
            onClick={() => setActiveTab("hardware")}
            className={`pb-2 border-b-2 transition-colors ${activeTab === "hardware" ? "border-amber-500 text-amber-400 font-semibold" : "border-transparent text-slate-400 hover:text-slate-200"}`}
          >
            Hırdavat & Aksesuar Listesi ({bom.hardwareList.length})
          </button>
          <button
            onClick={() => setActiveTab("sheets")}
            className={`pb-2 border-b-2 transition-colors ${activeTab === "sheets" ? "border-amber-500 text-amber-400 font-semibold" : "border-transparent text-slate-400 hover:text-slate-200"}`}
          >
            Plaka Optimizasyon & Fire ({bom.materialUsage.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-auto p-6 text-xs">
          {activeTab === "cutlist" && (
            <div className="border border-slate-800 rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="p-3">Parça Adı</th>
                    <th className="p-3">Malzeme</th>
                    <th className="p-3 text-right">Boy (mm)</th>
                    <th className="p-3 text-right">En (mm)</th>
                    <th className="p-3 text-right">Kalınlık (mm)</th>
                    <th className="p-3 text-center">Kenar Bantları</th>
                    <th className="p-3 text-right">Alan (m²)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {bom.cutList.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-sans font-medium text-slate-200">{p.pieceName}</td>
                      <td className="p-3 text-slate-300 font-sans">{p.materialName}</td>
                      <td className="p-3 text-right text-amber-400 font-bold">{p.lengthMm}</td>
                      <td className="p-3 text-right text-amber-400 font-bold">{p.widthMm}</td>
                      <td className="p-3 text-right text-slate-300">{p.thicknessMm}</td>
                      <td className="p-3 text-center">
                        <div className="flex justify-center gap-1 text-[10px]">
                          <span className={`px-1.5 py-0.5 rounded ${p.edgeBanding.top ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-500"}`}>Ü</span>
                          <span className={`px-1.5 py-0.5 rounded ${p.edgeBanding.bottom ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-500"}`}>A</span>
                          <span className={`px-1.5 py-0.5 rounded ${p.edgeBanding.left ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-500"}`}>S</span>
                          <span className={`px-1.5 py-0.5 rounded ${p.edgeBanding.right ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-500"}`}>Sa</span>
                        </div>
                      </td>
                      <td className="p-3 text-right text-slate-300">{p.areaM2}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "hardware" && (
            <div className="border border-slate-800 rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="p-3">SKU</th>
                    <th className="p-3">Hırdavat Tanımı</th>
                    <th className="p-3">Kategori</th>
                    <th className="p-3 text-right">Miktar</th>
                    <th className="p-3 text-right">Birim Fiyat (€)</th>
                    <th className="p-3 text-right">Toplam (€)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {bom.hardwareList.map((hw) => (
                    <tr key={hw.sku} className="hover:bg-slate-800/40">
                      <td className="p-3 text-slate-400">{hw.sku}</td>
                      <td className="p-3 font-sans font-medium text-slate-200">{hw.name}</td>
                      <td className="p-3 font-sans text-slate-400">{hw.category}</td>
                      <td className="p-3 text-right text-emerald-400 font-bold">
                        {hw.quantity} {hw.unit}
                      </td>
                      <td className="p-3 text-right text-slate-300">{hw.unitPrice.toFixed(2)}</td>
                      <td className="p-3 text-right text-emerald-400 font-bold">{hw.totalPrice.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "sheets" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {bom.materialUsage.map((m) => (
                  <div key={m.materialId} className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                    <h3 className="font-semibold text-slate-200 mb-2">{m.materialName}</h3>
                    <div className="space-y-1.5 text-slate-400">
                      <div className="flex justify-between">
                        <span>Net Panel Alanı:</span>
                        <span className="font-mono text-slate-200">{m.netAreaM2} m²</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Fire Dahil Brüt (%12):</span>
                        <span className="font-mono text-amber-400 font-bold">{m.grossAreaM2} m²</span>
                      </div>
                      <div className="flex justify-between border-t border-slate-800 pt-1.5 mt-1.5">
                        <span>Gerekli Standart Plaka (2800x2070):</span>
                        <span className="font-mono text-emerald-400 font-bold">{m.estimatedSheetsCount} Plaka</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Manufacturing / CNC Compliance Note */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
                <h4 className="font-semibold text-slate-200 flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  Birim Fabrika & Selco WNT 600 Ebatlama Uyumluluk Özeti
                </h4>
                <p className="text-slate-400 leading-relaxed">
                  Tüm parçalar Selco testere bıçak kalınlığı (4.4mm kerf) ve asgari tutucu kıskanç ölçüsü (70mm) sınırlarına uygun olarak parametrik hesaplanmıştır. Üretim onayından sonra ERP üzerinden kesim optimizasyon şeması (sawing pattern) oluşturulabilir.
                </p>
                {bom.validationWarnings.length > 0 && (
                  <div className="mt-3 p-3 bg-red-950/40 border border-red-800/60 rounded-lg text-red-300 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <div>
                      {bom.validationWarnings.map((w, idx) => (
                        <div key={idx}>{w}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
