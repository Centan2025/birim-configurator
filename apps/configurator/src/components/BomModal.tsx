"use client";

import React, { useState } from "react";
import { useConfiguratorStore } from "../store/useConfiguratorStore";
import {
  X,
  Download,
  CheckCircle,
  AlertTriangle,
  FileCode,
  ListOrdered,
  Layers,
  Cpu,
  ShieldAlert,
} from "lucide-react";
import {
  exportCutListToCSV,
  generateAssemblyInstructions,
  generateSelcoExportPackage,
  generatePanelDXF,
} from "@birim/manufacturing";

interface BomModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function BomModal({ isOpen, onClose }: BomModalProps) {
  const [activeTab, setActiveTab] = useState<"cutlist" | "hardware" | "nesting" | "assembly" | "selco">("cutlist");
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

  const downloadCsv = () => {
    const csvContent = exportCutListToCSV(bom);
    const dataStr = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
    const a = document.createElement("a");
    a.href = dataStr;
    a.download = `Kesim_Listesi_${project.id}_v${project.version}.csv`;
    a.click();
  };

  const downloadSampleDXF = () => {
    const piece = bom.cutList[0];
    if (!piece) return;
    const dxfContent = generatePanelDXF(piece);
    const dataStr = "data:application/dxf;charset=utf-8," + encodeURIComponent(dxfContent);
    const a = document.createElement("a");
    a.href = dataStr;
    a.download = `${piece.id}.dxf`;
    a.click();
  };

  const assemblySteps = generateAssemblyInstructions(project, bom);
  const selcoPackage = bom.nestingResults[0] ? generateSelcoExportPackage(bom.nestingResults[0].sheets) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="flex flex-col w-full max-w-6xl h-[88vh] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <span>BOM & İmalat Mühendisliği Portalı</span>
              <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono">
                v{project.version} ({bom.approvalStatus === "production_approved" ? "ONAYLANDI" : "TASLAK"})
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Parametrik modelden türetilmiş net panel kesim, System 32 delik operasyonları, gerçek plaka yerleşimi ve montaj adımları
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={downloadCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white shadow transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              CSV Kesim Listesi
            </button>
            <button
              onClick={downloadSampleDXF}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-700 hover:bg-blue-600 text-white shadow transition-all"
            >
              <FileCode className="w-3.5 h-3.5" />
              Örnek DXF
            </button>
            <button
              onClick={downloadJson}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
            >
              <Download className="w-3.5 h-3.5" />
              JSON
            </button>
            <button onClick={onClose} title="Kapat" className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Summary Badges */}
        <div className="grid grid-cols-5 gap-3 px-6 py-3 bg-slate-950/60 border-b border-slate-800/80 text-xs">
          <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
            <span className="text-slate-400">Toplam Parça:</span>
            <div className="text-sm font-bold text-slate-200">{bom.summary.totalPiecesCount} adet</div>
          </div>
          <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
            <span className="text-slate-400">Net Panel Alanı:</span>
            <div className="text-sm font-bold text-amber-400">{bom.summary.totalPanelAreaM2} m²</div>
          </div>
          <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
            <span className="text-slate-400">Kenar Bandı:</span>
            <div className="text-sm font-bold text-blue-400">{bom.summary.totalEdgeBandMeters} mt</div>
          </div>
          <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
            <span className="text-slate-400">Hırdavat:</span>
            <div className="text-sm font-bold text-emerald-400">{bom.summary.totalHardwareCount} adet</div>
          </div>
          <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
            <span className="text-slate-400">CNC Delik Operasyonu:</span>
            <div className="text-sm font-bold text-purple-400">{bom.summary.totalDrillingHolesCount} delik</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-6 pt-2 border-b border-slate-800 gap-5 text-xs font-medium">
          <button
            onClick={() => setActiveTab("cutlist")}
            className={`pb-2.5 border-b-2 transition-colors ${activeTab === "cutlist" ? "border-amber-500 text-amber-400 font-semibold" : "border-transparent text-slate-400 hover:text-slate-200"}`}
          >
            Net Kesim & Delik Tablosu ({bom.cutList.length})
          </button>
          <button
            onClick={() => setActiveTab("hardware")}
            className={`pb-2.5 border-b-2 transition-colors ${activeTab === "hardware" ? "border-amber-500 text-amber-400 font-semibold" : "border-transparent text-slate-400 hover:text-slate-200"}`}
          >
            Hırdavat & Aksesuarlar ({bom.hardwareList.length})
          </button>
          <button
            onClick={() => setActiveTab("nesting")}
            className={`pb-2.5 border-b-2 transition-colors ${activeTab === "nesting" ? "border-amber-500 text-amber-400 font-semibold" : "border-transparent text-slate-400 hover:text-slate-200"}`}
          >
            Gerçek 2D Plaka Optimizasyonu ({bom.nestingResults.reduce((s, r) => s + r.totalSheetsCount, 0)} Plaka)
          </button>
          <button
            onClick={() => setActiveTab("assembly")}
            className={`pb-2.5 border-b-2 transition-colors ${activeTab === "assembly" ? "border-amber-500 text-amber-400 font-semibold" : "border-transparent text-slate-400 hover:text-slate-200"}`}
          >
            <ListOrdered className="w-3.5 h-3.5 inline mr-1" />
            Montaj Kılavuzu ({assemblySteps.length} Adım)
          </button>
          <button
            onClick={() => setActiveTab("selco")}
            className={`pb-2.5 border-b-2 transition-colors ${activeTab === "selco" ? "border-amber-500 text-amber-400 font-semibold" : "border-transparent text-slate-400 hover:text-slate-200"}`}
          >
            <Cpu className="w-3.5 h-3.5 inline mr-1" />
            Selco WNT 600 Postprocessor
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 text-xs">
          {/* TAB 1: CUT LIST & DRILLING */}
          {activeTab === "cutlist" && (
            <div className="border border-slate-800 rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="p-2.5">Parça ID / Adı</th>
                    <th className="p-2.5">Modül</th>
                    <th className="p-2.5">Malzeme</th>
                    <th className="p-2.5 text-right">Boy (mm)</th>
                    <th className="p-2.5 text-right">En (mm)</th>
                    <th className="p-2.5 text-right">Kalınlık (mm)</th>
                    <th className="p-2.5 text-center">Bant (Ü/A/S/Sa)</th>
                    <th className="p-2.5 text-center">CNC Delik</th>
                    <th className="p-2.5 text-right">Alan (m²)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  {bom.cutList.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-800/40">
                      <td className="p-2.5 font-sans">
                        <div className="font-semibold text-slate-200">{p.pieceName}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{p.id}</div>
                      </td>
                      <td className="p-2.5 text-slate-400 font-sans">{p.moduleName}</td>
                      <td className="p-2.5 text-slate-300 font-sans">{p.materialName}</td>
                      <td className="p-2.5 text-right text-amber-400 font-bold">{p.lengthMm}</td>
                      <td className="p-2.5 text-right text-amber-400 font-bold">{p.widthMm}</td>
                      <td className="p-2.5 text-right text-slate-300">{p.thicknessMm}</td>
                      <td className="p-2.5 text-center">
                        <div className="flex justify-center gap-0.5 text-[9px]">
                          <span className={`px-1 py-0.5 rounded ${p.edgeBanding.top ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-600"}`}>Ü</span>
                          <span className={`px-1 py-0.5 rounded ${p.edgeBanding.bottom ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-600"}`}>A</span>
                          <span className={`px-1 py-0.5 rounded ${p.edgeBanding.left ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-600"}`}>S</span>
                          <span className={`px-1 py-0.5 rounded ${p.edgeBanding.right ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-600"}`}>Sa</span>
                        </div>
                      </td>
                      <td className="p-2.5 text-center text-purple-400 font-bold">
                        {p.holes ? `${p.holes.length} delik` : "0"}
                      </td>
                      <td className="p-2.5 text-right text-slate-300">{p.areaM2}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 2: HARDWARE */}
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

          {/* TAB 3: REAL 2D GUILLOTINE NESTING */}
          {activeTab === "nesting" && (
            <div className="space-y-6">
              <div className="p-3 bg-blue-950/30 border border-blue-800/50 rounded-lg text-blue-200 text-xs flex items-center justify-between">
                <div>
                  <strong>Gerçek 2D Giyotin Yerleşim Algoritması:</strong> Standart 2800x2070mm plaka, 4.4mm testere kerf, 15mm kenar düzeltme ve ahşap damar yönü kurallarına göre hesaplanmıştır.
                </div>
              </div>

              {bom.nestingResults.map((nestRes) => (
                <div key={nestRes.materialId} className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <h3 className="font-bold text-slate-200 text-sm">{nestRes.materialName}</h3>
                    <div className="flex gap-4 text-xs font-mono">
                      <span>Plaka: <strong className="text-amber-400">{nestRes.totalSheetsCount} adet</strong></span>
                      <span>Net: <strong className="text-slate-300">{nestRes.totalNetAreaM2} m²</strong></span>
                      <span>Fire: <strong className="text-blue-400">%{nestRes.overallWastePercent}</strong></span>
                    </div>
                  </div>

                  {/* Sheet Visualizations */}
                  <div className="grid grid-cols-2 gap-4">
                    {nestRes.sheets.map((sheet) => (
                      <div key={sheet.sheetIndex} className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-semibold text-slate-300">Plaka #{sheet.sheetIndex} (2800x2070 mm)</span>
                          <span className="font-mono text-amber-400">Fire: %{sheet.wastePercent}</span>
                        </div>

                        {/* 2D Sheet Canvas Representation */}
                        <div className="relative w-full aspect-[280/207] bg-slate-900 border border-slate-700 rounded overflow-hidden">
                          {sheet.placedPieces.map((p) => {
                            const leftPct = (p.x / 2800) * 100;
                            const topPct = (p.y / 2070) * 100;
                            const widthPct = (p.width / 2800) * 100;
                            const heightPct = (p.length / 2070) * 100;

                            return (
                              <div
                                key={p.pieceId}
                                style={{
                                  left: `${leftPct}%`,
                                  top: `${topPct}%`,
                                  width: `${widthPct}%`,
                                  height: `${heightPct}%`,
                                }}
                                title={`${p.pieceName} (${p.length}x${p.width}mm)`}
                                className="absolute bg-amber-600/60 hover:bg-amber-500/80 border border-amber-400/80 p-0.5 overflow-hidden text-[8px] font-mono text-white transition-all cursor-pointer flex flex-col justify-center items-center text-center"
                              >
                                <span className="truncate w-full font-bold">{p.pieceName}</span>
                                <span>{p.length}x{p.width}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 4: ASSEMBLY INSTRUCTIONS */}
          {activeTab === "assembly" && (
            <div className="space-y-4 max-w-3xl">
              <p className="text-slate-400">
                Fabrikada ebatlanan, kenar bantlanan ve System 32 delikleri açılan panellerin sahada montaj sırası:
              </p>
              <div className="space-y-3">
                {assemblySteps.map((st) => (
                  <div key={st.stepNumber} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-amber-600 text-white font-bold text-xs flex items-center justify-center">
                        {st.stepNumber}
                      </span>
                      <h4 className="font-bold text-slate-200">{st.title}</h4>
                    </div>
                    <p className="text-slate-300 leading-relaxed pl-8">{st.description}</p>
                    <div className="pl-8 pt-1 flex flex-wrap gap-2 text-[11px]">
                      <span className="text-slate-400">Parçalar:</span>
                      {st.requiredParts.map((p, i) => (
                        <span key={i} className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {p}
                        </span>
                      ))}
                    </div>
                    {st.safetyNotes && (
                      <div className="pl-8 text-amber-400/90 text-[11px] flex items-center gap-1.5 pt-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>{st.safetyNotes}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: SELCO WNT 600 POSTPROCESSOR */}
          {activeTab === "selco" && (
            <div className="space-y-4">
              <div className="p-4 bg-amber-950/40 border border-amber-800/60 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-amber-400 font-bold">
                  <ShieldAlert className="w-5 h-5" />
                  <span>Biesse Selco WNT 600 Postprocessor (Teknik Uyarı)</span>
                </div>
                <p className="text-slate-300 text-xs leading-relaxed">
                  Gerçek üretim dosyası oluşturulmadan önce fabrika şefi ve Selco OptiPlanning operatörü tarafından takım ve bıçak parametreleri onaylanmalıdır.
                </p>
                {selcoPackage?.unverifiedNotes.map((note, idx) => (
                  <div key={idx} className="text-amber-300/90 text-xs font-mono">
                    • {note}
                  </div>
                ))}
              </div>

              {selcoPackage && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-slate-300">Üretim XML Çıktı Taslağı ({selcoPackage.batchId}):</h4>
                  <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-[11px] font-mono overflow-x-auto max-h-72">
                    {selcoPackage.xmlOutputDraft}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
