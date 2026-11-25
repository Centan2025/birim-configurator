"use client";
import React from "react";
import { X, AlertTriangle, ShieldAlert } from "lucide-react";
import type { DesignProject } from "@birim/core";
import type { PricingBreakdown } from "@birim/pricing";
import {
  generateProjectCncPostProcessorBundle,
  mapCutPieceToCncPieceInput,
  simulateCncPostProcessorBundle,
  generateCncToolpathSimulationSvg,
  type CncPieceInput,
  type ManufacturingBOM,
  type ShelfDeflectionBOMEntry,
  type calculateBlumEngineeringSummary,
  type generateAssemblyInstructions,
  type generateSelcoExportPackage,
} from "@birim/manufacturing";

export interface BomSecondaryTabsProps {
  activeTab: string;
  assemblySteps: ReturnType<typeof generateAssemblyInstructions>;
  blumBxfXml: string;
  blumCabinetSummaries: Array<ReturnType<typeof calculateBlumEngineeringSummary>>;
  bom: ManufacturingBOM;
  checkGateBeforeProductionExport: (actionLabel: string) => boolean;
  downloadBlumBxf: () => void;
  downloadCustomerQuoteHtml: () => void;
  downloadFile: (content: string, filename: string, mimeType: string) => void;
  gateChecks: NonNullable<ManufacturingBOM["productionGate"]>["checks"];
  pricing: PricingBreakdown;
  project: DesignProject;
  selcoPackage: ReturnType<typeof generateSelcoExportPackage> | null;
  selectedSimulatedPieceId: string | null;
  setSelectedSimulatedPieceId: React.Dispatch<React.SetStateAction<string | null>>;
  shelfDeflections: ShelfDeflectionBOMEntry[];
  totalHardwareEur: number;
}

export const BomSecondaryTabs: React.FC<BomSecondaryTabsProps> = (props) => {
  const {
    activeTab,
    assemblySteps,
    blumBxfXml,
    blumCabinetSummaries,
    bom,
    checkGateBeforeProductionExport,
    downloadBlumBxf,
    downloadCustomerQuoteHtml,
    downloadFile,
    gateChecks,
    pricing,
    project,
    selcoPackage,
    selectedSimulatedPieceId,
    setSelectedSimulatedPieceId,
    shelfDeflections,
    totalHardwareEur,
  } = props;
  return (
    <>
          {/* TAB 2: HARDWARE */}
          {activeTab === "hardware" && (
            <div className="bg-white border border-[#E5DFD3] rounded-2xl shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[#F4F0E8] text-[#57534E] uppercase tracking-wider text-[10.5px] border-b border-[#E5DFD3]">
                    <tr>
                      <th className="p-3 font-bold">SKU</th>
                      <th className="p-3 font-bold">Hırdavat &amp; Mekanizma Tanımı</th>
                      <th className="p-3 font-bold">Kategori</th>
                      <th className="p-3 text-right font-bold">Miktar</th>
                      <th className="p-3 text-right font-bold">Birim Fiyat (€)</th>
                      <th className="p-3 text-right font-bold">Toplam (€)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ECE7DC] font-mono text-[11.5px]">
                    {bom.hardwareList.map((hw) => (
                      <tr key={hw.sku} className="hover:bg-[#FAF7F1] transition-colors">
                        <td className="p-3 text-[#57534E] font-semibold">{hw.sku}</td>
                        <td className="p-3 font-sans font-bold text-[#141413]">{hw.name}</td>
                        <td className="p-3 font-sans text-[#57534E]">{hw.category}</td>
                        <td className="p-3 text-right text-emerald-800 font-bold">
                          {hw.quantity} {hw.unit}
                        </td>
                        <td className="p-3 text-right text-[#44403C]">
                          {(hw.unitPrice ?? 0).toFixed(2)}
                        </td>
                        <td className="p-3 text-right text-[#141413] font-extrabold">
                          {(hw.totalPrice ?? 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-[#F4F0E8] border-t border-[#E5DFD3] font-mono text-xs font-extrabold text-[#141413]">
                    <tr>
                      <td className="p-3 font-sans" colSpan={3}>
                        TOPLAM DONANIM &amp; HIRDAVAT PAKETİ ({bom.hardwareList.length} Kalem)
                      </td>
                      <td className="p-3 text-right text-emerald-800">
                        {bom.summary.totalHardwareCount} birim
                      </td>
                      <td className="p-3" />
                      <td className="p-3 text-right text-amber-900">
                        €{totalHardwareEur.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: FACTORY VALIDATION GATE & SHELF DEFLECTION */}
          {activeTab === "validation" && (
            <div className="space-y-5">
              <div className="space-y-3">
                <h3 className="font-extrabold text-[#141413] text-sm">
                  6 Aşamalı Deterministik Üretim Doğrulama Kapısı (Fail-Closed Gate)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {gateChecks.map((chk) => (
                    <div
                      key={chk.id}
                      className={`p-3.5 rounded-2xl border ${
                        chk.passed
                          ? "bg-emerald-50/75 border-emerald-300 text-emerald-950"
                          : "bg-amber-50/90 border-amber-300 text-amber-950"
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold text-xs mb-1">
                        <span>{chk.label}</span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                            chk.passed
                              ? "bg-emerald-700 text-white"
                              : "bg-amber-700 text-white"
                          }`}
                        >
                          {chk.passed ? "GEÇTİ (PASS)" : "KİLİTLİ (HOLD)"}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#44403C] leading-relaxed">{chk.detail}</p>
                    </div>
                  ))}
                </div>
              </div>

              {shelfDeflections.length > 0 && (
                <div className="space-y-2.5">
                  <h3 className="font-extrabold text-[#141413] text-sm">
                    ISO 7170 Euler-Bernoulli Fiziksel Raf Sehim (Esneme) Analizi
                  </h3>
                  <div className="bg-white border border-[#E5DFD3] rounded-2xl shadow-2xs overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-[#F4F0E8] text-[#57534E] uppercase tracking-wider text-[10.5px] border-b border-[#E5DFD3]">
                        <tr>
                          <th className="p-2.5 font-bold">Modül / Bölme</th>
                          <th className="p-2.5 text-right font-bold">Açıklık (L)</th>
                          <th className="p-2.5 text-right font-bold">Derinlik (D)</th>
                          <th className="p-2.5 text-right font-bold">Kalınlık (T)</th>
                          <th className="p-2.5 text-right font-bold">Hesaplanan Sehim</th>
                          <th className="p-2.5 text-right font-bold">L/300 Sınırı</th>
                          <th className="p-2.5 text-center font-bold">Durum</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#ECE7DC] font-mono text-[11px]">
                        {shelfDeflections.map((sd, idx) => (
                          <tr key={`${sd.moduleId}_${sd.bayIndex}_${idx}`} className="hover:bg-[#FAF7F1]">
                            <td className="p-2.5 font-sans font-bold text-[#141413]">
                              {sd.moduleName} — Bölme {sd.bayIndex + 1}
                            </td>
                            <td className="p-2.5 text-right text-[#44403C]">{sd.spanMm} mm</td>
                            <td className="p-2.5 text-right text-[#44403C]">{sd.depthMm} mm</td>
                            <td className="p-2.5 text-right text-[#44403C]">{sd.thicknessMm} mm</td>
                            <td className="p-2.5 text-right font-bold text-amber-800">
                              {sd.deflectionMm} mm
                            </td>
                            <td className="p-2.5 text-right text-[#78716C]">{sd.maxAllowedMm} mm</td>
                            <td className="p-2.5 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                  sd.passed
                                    ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                                    : "bg-red-100 text-red-900 border border-red-300"
                                }`}
                              >
                                {sd.passed ? "UYGUN" : "SEHİM AŞIMI"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: ASSEMBLY INSTRUCTIONS */}
          {activeTab === "assembly" && (
            <div className="space-y-3.5 max-w-4xl">
              <p className="text-[#57534E] font-medium">
                Fabrikada ebatlanan, kenar bantlanan ve CNC delik/kanal operasyonları açılan panellerin sahada kurulum sırası:
              </p>
              <div className="space-y-2.5">
                {assemblySteps.map((st) => (
                  <div
                    key={st.stepNumber}
                    className="p-4 rounded-2xl bg-white border border-[#E5DFD3] shadow-2xs space-y-2"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-[#141413] text-amber-300 font-mono font-black text-xs flex items-center justify-center">
                        {st.stepNumber}
                      </span>
                      <h4 className="font-extrabold text-[#141413] text-xs">{st.title}</h4>
                    </div>
                    <p className="text-[#44403C] leading-relaxed pl-8">{st.description}</p>
                    <div className="pl-8 pt-1 flex flex-wrap gap-1.5 text-[11px]">
                      <span className="text-[#78716C] font-semibold">Parçalar:</span>
                      {st.requiredParts.map((p, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-lg bg-[#FAF8F4] text-[#141413] border border-[#E5DFD3] font-medium"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                    {st.safetyNotes && (
                      <div className="pl-8 text-amber-900 text-[11px] flex items-center gap-1.5 pt-1 font-medium">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                        <span>{st.safetyNotes}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 6: SELCO WNT 600 POSTPROCESSOR */}
          {activeTab === "selco" && (
            <div className="space-y-4">
              <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-amber-950 font-extrabold">
                  <ShieldAlert className="w-5 h-5 text-amber-700" />
                  <span>Biesse Selco WNT 600 Postprocessor (Teknik Uyarı)</span>
                </div>
                <p className="text-amber-950/90 text-xs leading-relaxed">
                  Gerçek üretim dosyası oluşturulmadan önce fabrika şefi ve Selco OptiPlanning operatörü tarafından takım ve bıçak parametreleri onaylanmalıdır.
                </p>
                {selcoPackage?.unverifiedNotes.map((note, idx) => (
                  <div key={idx} className="text-amber-900 text-xs font-mono">
                    • {note}
                  </div>
                ))}
              </div>

              {selcoPackage && (
                <div className="space-y-2">
                  <h4 className="font-bold text-[#141413]">
                    Üretim XML Çıktı Taslağı ({selcoPackage.batchId}):
                  </h4>
                  <pre className="p-4 rounded-2xl bg-[#1E1D1B] text-[#F5F2EA] text-[11px] font-mono overflow-x-auto max-h-80">
                    {selcoPackage.xmlOutputDraft}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* TAB 8: BLUM BXF & EASYSTICK (MINIPRESS / E-SERVICES) */}
          {activeTab === "blum_bxf" && (
            <div data-testid="bom-blum-bxf-panel" className="space-y-4 text-xs">
              <div className="p-4 rounded-2xl bg-white border border-[#E5DFD3] shadow-2xs flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-extrabold text-[#1D4ED8]">
                    BLUM GÖVDE TASARLAYICI &amp; BXF / EASYSTICK ÜRETİM PAKETİ
                  </h3>
                  <p className="text-[#57534E] mt-0.5">
                    KB/KH/KT Dış Ölçüler • LW/LH/LT Net İç Ölçüler • Kapak Ağırlığı (kg) &amp; AVENTOS Güç Faktörü (LF) • LEGRABOX/TANDEMBOX Kesim Formülleri • MINIPRESS EASYSTICK Delik Matrisi
                  </p>
                </div>
                <button
                  type="button"
                  onClick={downloadBlumBxf}
                  className="px-4 py-2 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold cursor-pointer"
                >
                  🟦 Blum .BXF Dosyasını İndir (EASYSTICK / CAD)
                </button>
              </div>

              {blumCabinetSummaries.map((cab, cIdx) => (
                <div
                  key={cab.moduleId}
                  className="p-4 rounded-2xl bg-white border border-[#E5DFD3] shadow-2xs space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#ECE7DC] pb-2.5">
                    <div>
                      <span className="font-extrabold text-[#141413] text-sm">
                        {cIdx + 1}. {cab.moduleName}
                      </span>
                      <div className="text-[11px] font-mono text-[#57534E] mt-0.5">
                        Dış (KB×KH×KT):{" "}
                        <strong className="text-amber-800">
                          {cab.outerDimensions.KB} × {cab.outerDimensions.KH} ×{" "}
                          {cab.outerDimensions.KT} mm
                        </strong>{" "}
                        • Net İç (LW×LH×LT):{" "}
                        <strong className="text-emerald-800">
                          {cab.innerDimensions.LW} × {cab.innerDimensions.LH} ×{" "}
                          {cab.innerDimensions.LT} mm
                        </strong>{" "}
                        • Panel: {cab.panelThicknessMm}mm • Derz (Fuge): {cab.frontGapFugeMm}mm
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        cab.collisionFree
                          ? "bg-emerald-50 text-emerald-900 border border-emerald-300"
                          : "bg-amber-50 text-amber-950 border border-amber-300"
                      }`}
                    >
                      {cab.collisionFree ? "✓ BLUM ÇAKIŞMA KONTROLÜ: UYGUN" : "⚠ UYARI MEVCUT"}
                    </span>
                  </div>

                  {cab.collisionWarnings.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 space-y-1">
                      {cab.collisionWarnings.map((w, wi) => (
                        <div key={wi}>• {w}</div>
                      ))}
                    </div>
                  )}

                  {cab.doors.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="font-bold text-[#57534E] text-[10.5px] uppercase tracking-wider">
                        Kapak Ağırlığı, CLIP top BLUMOTION Menteşe &amp; AVENTOS Güç Faktörü (LF = KH × kg)
                      </div>
                      <div className="border border-[#ECE7DC] rounded-xl overflow-hidden">
                        <table className="w-full text-left border-collapse font-mono text-[11px]">
                          <thead className="bg-[#F4F0E8] text-[#57534E]">
                            <tr>
                              <th className="p-2">Bölme</th>
                              <th className="p-2">Kapak Ölçüsü</th>
                              <th className="p-2">Ağırlık (kg)</th>
                              <th className="p-2">Menteşe Adedi &amp; Kodu</th>
                              <th className="p-2">Delik Şablonu</th>
                              <th className="p-2">AVENTOS LF &amp; Öneri</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#ECE7DC]">
                            {cab.doors.map((d) => (
                              <tr key={d.bayIndex}>
                                <td className="p-2 text-[#141413] font-bold">Bölme {d.bayIndex + 1}</td>
                                <td className="p-2 text-amber-900">
                                  {d.doorWidthMm}×{d.doorHeightMm}×{d.doorThicknessMm} mm
                                </td>
                                <td className="p-2 text-emerald-800 font-bold">
                                  {d.estimatedWeightKg} kg
                                </td>
                                <td className="p-2 text-[#292524]">
                                  {d.recommendedHingeCount}× {d.hingeSku} + {d.mountingPlateSku}
                                </td>
                                <td className="p-2 text-[#57534E]">{d.cupDrillingPattern}</td>
                                <td className="p-2 text-blue-800 font-semibold">
                                  LF={d.aventosPowerFactorLf} •{" "}
                                  {d.recommendedAventosModel || "Menteşeli"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {cab.drawers.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="font-bold text-[#57534E] text-[10.5px] uppercase tracking-wider">
                        Çekmece Ahşap Kesim Ölçüleri (Taban &amp; Arkalık) ve EASYSTICK Ray Delik Eksenleri
                      </div>
                      <div className="border border-[#ECE7DC] rounded-xl overflow-hidden">
                        <table className="w-full text-left border-collapse font-mono text-[11px]">
                          <thead className="bg-[#F4F0E8] text-[#57534E]">
                            <tr>
                              <th className="p-2">Bölme</th>
                              <th className="p-2">Blum Sistem &amp; Ray SKU</th>
                              <th className="p-2">NL / LW</th>
                              <th className="p-2">Ahşap Taban Kesim</th>
                              <th className="p-2">Ahşap Arkalık Kesim</th>
                              <th className="p-2">EASYSTICK Yan Delik X (mm)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#ECE7DC]">
                            {cab.drawers.map((drw) => (
                              <tr key={drw.drawerId}>
                                <td className="p-2 text-[#141413] font-bold">
                                  Bölme {drw.bayIndex + 1}
                                </td>
                                <td className="p-2 text-[#292524]">
                                  {drw.systemName} [{drw.runnerSku}]
                                </td>
                                <td className="p-2 text-amber-900">
                                  NL:{drw.nominalLengthNlMm} / LW:{drw.netInnerWidthLwMm}
                                </td>
                                <td className="p-2 text-emerald-800 font-bold">
                                  {drw.woodenBottomWidthMm} × {drw.woodenBottomDepthMm} mm (16mm)
                                </td>
                                <td className="p-2 text-emerald-800 font-bold">
                                  {drw.woodenBackWidthMm} × {drw.woodenBackHeightMm} mm (16mm)
                                </td>
                                <td className="p-2 text-purple-800">
                                  Y:{drw.easystickElevationYMm}mm → X:[
                                  {drw.easystickSideHoleXCoordsMm.join(", ")}]
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              <div className="space-y-2">
                <h4 className="font-bold text-[#141413]">
                  Canlı Blum Exchange Format (.BXF / XML) Çıktı Önizlemesi:
                </h4>
                <pre className="p-4 rounded-2xl bg-[#1E1D1B] text-[#F5F2EA] text-[11px] font-mono overflow-x-auto max-h-64">
                  {blumBxfXml}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 7: CUSTOMER QUOTE & PRESENTATION SHEET */}
          {activeTab === "quote" && (
            <div data-testid="bom-quote-panel" className="space-y-4 text-xs">
              <div className="p-4 rounded-2xl bg-white border border-[#E5DFD3] shadow-2xs flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-extrabold text-[#141413]">
                    BİRİM MOBİLYA — KURUMSAL MÜŞTERİ TEKLİF &amp; TEKNİK SUNUM FÖYÜ
                  </h3>
                  <p className="text-[#57534E] mt-0.5">
                    Proje: {project.title} • {project.modules.length} Modül • Toplam Levha:{" "}
                    {bom.summary.totalPanelAreaM2} m² • Kenar Bandı:{" "}
                    {bom.summary.totalEdgeBandMeters} mt
                  </p>
                </div>
                <button
                  type="button"
                  onClick={downloadCustomerQuoteHtml}
                  className="px-4 py-2 rounded-xl birim-ice-charcoal-pill font-bold cursor-pointer"
                >
                  📄 Yazdırılabilir Teklif Föyünü İndir (.HTML)
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-white border border-[#E5DFD3] shadow-2xs space-y-2">
                  <h4 className="font-bold text-[#57534E] uppercase tracking-wider text-[11px]">
                    1. Modül ve Seçilen Levha Dekorları
                  </h4>
                  <div className="divide-y divide-[#ECE7DC]">
                    {project.modules.map((m, idx) => (
                      <div key={m.id} className="py-2.5 flex items-center justify-between gap-2">
                        <div>
                          <div className="font-bold text-[#141413]">
                            {idx + 1}. {m.name}
                          </div>
                          <div className="text-[11px] text-[#78716C] font-mono">
                            Gövde: {m.carcass.bodyMaterialId} • Kapak: {m.carcass.doorMaterialId}
                          </div>
                        </div>
                        <span className="font-mono font-bold text-amber-900 shrink-0">
                          {m.dimensions.width}×{m.dimensions.height}×{m.dimensions.depth} mm
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-[#E5DFD3] shadow-2xs space-y-3">
                  <h4 className="font-bold text-[#57534E] uppercase tracking-wider text-[11px]">
                    2. Maliyet ve Satış Teklif Kırılımı
                  </h4>
                  <div className="space-y-2 font-mono text-[#292524]">
                    <div className="flex justify-between">
                      <span className="font-sans text-[#57534E]">Ahşap / Levha Maliyeti:</span>
                      <span className="font-bold">
                        €{(pricing.materialCost ?? (pricing as any).materialCostEur ?? 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-sans text-[#57534E]">
                        Kenar Bandı (PVC/ABS) Maliyeti:
                      </span>
                      <span className="font-bold">
                        €{(pricing.edgeBandCost ?? (pricing as any).edgeBandCostEur ?? 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-sans text-[#57534E]">
                        Dünya Markaları Aksesuar &amp; LED Donanım:
                      </span>
                      <span className="font-bold">
                        €{(pricing.hardwareCost ?? (pricing as any).hardwareCostEur ?? 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-sans text-[#57534E]">
                        CNC İşçilik, Ebatlama &amp; Montaj:
                      </span>
                      <span className="font-bold">
                        €{(pricing.laborCost ?? (pricing as any).laborCostEur ?? 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="pt-3 border-t border-[#E5DFD3] flex justify-between items-baseline text-sm font-black text-[#141413]">
                      <span className="font-sans">KDV Dahil Müşteri Satış Toplamı:</span>
                      <span className="text-amber-900">
                        €
                        {(pricing.totalWithVatEur ?? 0).toLocaleString("tr-TR", {
                          minimumFractionDigits: 2,
                        })}{" "}
                        (
                        {(pricing.totalWithVatTry ?? 0).toLocaleString("tr-TR", {
                          maximumFractionDigits: 0,
                        })}{" "}
                        TL)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 9: DOUBLE-SIDED CNC POSTPROCESSORS (.MPR / .CIX / .XCS) */}
          {activeTab === "cnc_mpr_cix" &&
            (() => {
              const cncInputs: CncPieceInput[] = bom.cutList.map((cp) =>
                mapCutPieceToCncPieceInput(cp)
              );
              const bundle = generateProjectCncPostProcessorBundle(cncInputs);
              return (
                <div className="space-y-4 text-xs text-[#141413]">
                  <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-white border border-[#E5DFD3] shadow-2xs">
                    <div>
                      <h3 className="text-sm font-extrabold text-[#141413]">
                        Homag WoodWOP (.MPR), BiesseWorks (.CIX) &amp; SCM Maestro (.XCS) Çift Yüzeyli CNC Çıktısı
                      </h3>
                      <p className="text-[#57534E] mt-0.5">
                        Ara dikme gibi çift yüzeyli parçalar otomatik olarak Setup-1 (Üst) ve Setup-2 (X-Simetrik Flip) programlarına ayrılır.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (!checkGateBeforeProductionExport("Homag .MPR")) return;
                          const allMpr = bundle.homagMprFiles
                            .map((f) => `; === ${f.fileName} ===\r\n${f.content}`)
                            .join("\r\n\r\n");
                          downloadFile(
                            allMpr,
                            `Homag_WoodWOP_${project.id}_v${project.version}.mpr`,
                            "text/plain;charset=utf-8"
                          );
                        }}
                        className="px-3.5 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold cursor-pointer"
                      >
                        Homag .MPR İndir ({bundle.homagMprFiles.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!checkGateBeforeProductionExport("Biesse .CIX")) return;
                          const allCix = bundle.biesseCixFiles
                            .map((f) => `// === ${f.fileName} ===\r\n${f.content}`)
                            .join("\r\n\r\n");
                          downloadFile(
                            allCix,
                            `Biesse_Works_${project.id}_v${project.version}.cix`,
                            "text/plain;charset=utf-8"
                          );
                        }}
                        className="px-3.5 py-2 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold cursor-pointer"
                      >
                        Biesse .CIX İndir ({bundle.biesseCixFiles.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!checkGateBeforeProductionExport("SCM Maestro .XCS")) return;
                          const allXcs = bundle.scmXcsFiles
                            .map((f) => `// === ${f.fileName} ===\r\n${f.content}`)
                            .join("\r\n\r\n");
                          downloadFile(
                            allXcs,
                            `SCM_Maestro_${project.id}_v${project.version}.xcs`,
                            "text/plain;charset=utf-8"
                          );
                        }}
                        className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold cursor-pointer"
                      >
                        SCM .XCS İndir ({bundle.scmXcsFiles.length})
                      </button>
                    </div>
                  </div>

                  {(() => {
                    const simReport = simulateCncPostProcessorBundle(project, bom);
                    const simTargetPiece =
                      bom.cutList.find((cp) => cp.id === selectedSimulatedPieceId) ||
                      bom.cutList.find((cp) => (cp.holes?.length || 0) > 0) ||
                      bom.cutList[0];
                    const simSvg = simTargetPiece
                      ? generateCncToolpathSimulationSvg(simTargetPiece)
                      : "";
                    return (
                      <div
                        data-testid="cnc-preflight-simulation-card"
                        className="p-4 rounded-2xl bg-white border border-[#E5DFD3] shadow-2xs space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="text-sm font-extrabold text-[#141413]">
                              CNC Ön Doğrulama &amp; 2B Takım Yolu Simülasyonu (Makine Öncesi Güvenlik Kapısı)
                            </div>
                            <div className="text-[11px] text-amber-800 mt-0.5 font-medium">
                              {simReport.postProcessorDisclaimerTr}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                            <span className="px-2.5 py-1 rounded-xl bg-[#FAF8F4] border border-[#E5DFD3] text-[#141413] font-semibold">
                              İşlenen Panel: {simReport.machinedPanelsCount}/
                              {simReport.totalPanelsSimulated}
                            </span>
                            <span className="px-2.5 py-1 rounded-xl bg-[#FAF8F4] border border-[#E5DFD3] text-emerald-800 font-bold">
                              Tahmini Süre: ~{simReport.totalEstimatedMinutes} dk
                            </span>
                            <span
                              className={`px-2.5 py-1 rounded-xl border font-bold ${
                                simReport.blockingErrorCount === 0
                                  ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                                  : "bg-red-50 border-red-300 text-red-900"
                              }`}
                            >
                              {simReport.blockingErrorCount === 0
                                ? "Z-Derinlik & Et Kalınlığı Uygun"
                                : `${simReport.blockingErrorCount} Kritik CNC Uyarısı`}
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-start">
                          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                            {simReport.pieces.map((sp) => (
                              <button
                                key={sp.pieceId}
                                type="button"
                                onClick={() => setSelectedSimulatedPieceId(sp.pieceId)}
                                className={`w-full text-left p-2.5 rounded-xl border text-[11px] transition cursor-pointer ${
                                  simTargetPiece?.id === sp.pieceId
                                    ? "bg-[#141413] border-[#141413] text-white shadow-xs"
                                    : "bg-[#FAF8F4] border-[#E5DFD3] text-[#141413] hover:bg-[#EFECE4]"
                                }`}
                              >
                                <div className="font-bold truncate">{sp.partName}</div>
                                <div
                                  className={`text-[10px] font-mono ${
                                    simTargetPiece?.id === sp.pieceId
                                      ? "text-amber-300"
                                      : "text-[#78716C]"
                                  }`}
                                >
                                  {sp.lengthMm}×{sp.widthMm}×{sp.thicknessMm}mm • {sp.drillCount}{" "}
                                  delik • ~{sp.estimatedCycleSeconds}s
                                </div>
                              </button>
                            ))}
                          </div>
                          <div
                            className="lg:col-span-2 p-2.5 rounded-xl bg-[#FAF8F4] border border-[#E5DFD3] overflow-hidden"
                            dangerouslySetInnerHTML={{ __html: simSvg }}
                          />
                        </div>
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] shadow-2xs">
                      <div className="font-bold text-amber-900 mb-2">
                        Örnek Homag .MPR ({bundle.homagMprFiles[0]?.fileName || "-"})
                      </div>
                      <pre className="max-h-80 overflow-auto p-3 rounded-xl bg-[#1E1D1B] text-[#F5F2EA] text-[11px] font-mono whitespace-pre-wrap">
                        {bundle.homagMprFiles[0]?.content || "Parça yok"}
                      </pre>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] shadow-2xs">
                      <div className="font-bold text-blue-900 mb-2">
                        Örnek Biesse .CIX ({bundle.biesseCixFiles[0]?.fileName || "-"})
                      </div>
                      <pre className="max-h-80 overflow-auto p-3 rounded-xl bg-[#1E1D1B] text-[#F5F2EA] text-[11px] font-mono whitespace-pre-wrap">
                        {bundle.biesseCixFiles[0]?.content || "Parça yok"}
                      </pre>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] shadow-2xs">
                      <div className="font-bold text-emerald-900 mb-2">
                        Örnek SCM Maestro .XCS ({bundle.scmXcsFiles[0]?.fileName || "-"})
                      </div>
                      <pre className="max-h-80 overflow-auto p-3 rounded-xl bg-[#1E1D1B] text-[#F5F2EA] text-[11px] font-mono whitespace-pre-wrap">
                        {bundle.scmXcsFiles[0]?.content || "Parça yok"}
                      </pre>
                    </div>
                  </div>
                </div>
              );
            })()}
    </>
  );
};
