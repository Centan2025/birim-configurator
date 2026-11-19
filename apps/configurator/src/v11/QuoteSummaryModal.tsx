"use client";

import React, { useState, useEffect } from "react";
import { X, Printer, FileSpreadsheet, Store, CheckCircle2 } from "lucide-react";
import type { DesignProject, MaterialDefinition } from "@birim/core";
import type { PricingBreakdown } from "@birim/pricing";
import { BirimLogo } from "../v3/design-system";

export interface QuoteSummaryModalProps {
  isOpen: boolean;
  project: DesignProject;
  materials: MaterialDefinition[];
  pricing: PricingBreakdown;
  onClose: () => void;
  onOpenBomModal: (tab?: "cutlist" | "nesting" | "cnc_mpr_cix") => void;
  onOpenStoreErpModal: () => void;
}

export const QuoteSummaryModal: React.FC<QuoteSummaryModalProps> = React.memo(
  ({
    isOpen,
    project,
    materials,
    pricing,
    onClose,
    onOpenBomModal,
    onOpenStoreErpModal,
  }) => {
    const [clientName, setClientName] = useState("");
    const [projectNote, setProjectNote] = useState("");
    const [discountPct, setDiscountPct] = useState(0);
    const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
    const [selectedPackageTier, setSelectedPackageTier] = useState<"eco" | "std" | "pro">("std");
    const [sampleRequested, setSampleRequested] = useState(false);

    useEffect(() => {
      if (!isOpen || typeof window === "undefined") return;
      const win = window as unknown as {
        __birimCapture3DSnapshot?: (opts?: {
          angle?: "current" | "iso" | "front";
          hideOverlays?: boolean;
        }) => string | null;
      };
      if (typeof win.__birimCapture3DSnapshot === "function") {
        try {
          const snap = win.__birimCapture3DSnapshot({ angle: "current", hideOverlays: true });
          if (snap) setSnapshotUrl(snap);
        } catch {
          // ignore snapshot error
        }
      }
    }, [isOpen]);

    if (!isOpen) return null;

    const mainModules = project.modules.filter((m) => m.category !== "complementary");
    const rawTotal = pricing?.totalWithVatEur || 0;
    const packageMultiplier =
      selectedPackageTier === "eco" ? 0.88 : selectedPackageTier === "pro" ? 1.18 : 1;
    const discountedTotal = Math.max(0, rawTotal * packageMultiplier * (1 - discountPct / 100));

    const fmtEur = (v: number) =>
      new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(v || 0);

    const resolveMatName = (id?: string) =>
      materials.find((m) => m.id === id)?.name || id || "Standart";

    const handlePrintOffer = () => {
      if (typeof window === "undefined") return;
      const w = window.open("", "_blank", "width=960,height=780");
      if (!w) return;
      const rowsHtml = mainModules
        .map(
          (m, i) => `
          <tr>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e0d5;">${i + 1}. ${m.name}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e0d5;font-family:monospace;">${Math.round(
              m.dimensions.width / 10
            )} × ${Math.round(m.dimensions.height / 10)} × ${Math.round(
            m.dimensions.depth / 10
          )} cm</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e0d5;">${resolveMatName(
              m.carcass.doorMaterialId
            )} / ${resolveMatName(m.carcass.bodyMaterialId)}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e0d5;text-align:center;">${
              m.bays.length
            }</td>
          </tr>`
        )
        .join("");

      w.document.write(`<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>BİRİM Teklif — ${project.title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #141413; background: #fff; margin: 36px; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 18px; }
    th { text-align: left; padding: 10px 12px; background: #f5f2ea; border-bottom: 2px solid #ded8cc; }
  </style>
</head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #141413;padding-bottom:16px;">
    <div>
      <h1>BİRİM® Mimari Modüler Mobilya Teklifi</h1>
      <div style="font-size:13px;color:#57534e;">Proje: ${project.title} ${
        clientName ? `• Müşteri: ${clientName}` : ""
      }</div>
    </div>
    <div style="font-size:12px;color:#78716c;">Tarih: ${new Date().toLocaleDateString("tr-TR")}</div>
  </div>
  ${
    snapshotUrl
      ? `<div style="margin:20px 0;text-align:center;"><img src="${snapshotUrl}" style="max-width:100%;max-height:340px;border-radius:16px;border:1px solid #e5dfd3;" /></div>`
      : ""
  }
  <table>
    <thead>
      <tr><th>Modül</th><th>Ölçüler (G×Y×D)</th><th>Kapak / Gövde Yüzeyi</th><th style="text-align:center;">Bölme</th></tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  ${projectNote ? `<p style="margin-top:16px;font-size:13px;color:#44403c;"><strong>Proje Notu:</strong> ${projectNote}</p>` : ""}
  <div style="margin-top:24px;padding:18px;border-radius:14px;background:#f5f2ea;display:flex;justify-content:space-between;align-items:center;">
    <span style="font-size:14px;font-weight:600;">KDV Dahil Toplam Teklif Bedeli${
      discountPct > 0 ? ` (%${discountPct} İskontolu)` : ""
    }</span>
    <span style="font-size:22px;font-weight:800;font-family:monospace;">${fmtEur(
      discountedTotal
    )}</span>
  </div>
</body>
</html>`);
      w.document.close();
      w.focus();
      w.print();
    };

    return (
      <div
        data-testid="v11-quote-summary-modal"
        className="fixed inset-0 z-[154] bg-[#141413]/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-2xl max-h-[90vh] flex flex-col birim-ice-modal rounded-[28px] overflow-hidden text-[#141413]"
        >
          <div className="px-6 py-4 birim-ice-shell-header flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <BirimLogo className="h-[18px] w-auto" />
              <span className="h-4 w-px bg-[#DFD9CE]" />
              <span className="text-sm font-bold">Fiyat Özeti, Teklif ve Sipariş</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-[#EFECE4] flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto text-xs">
            {/* Sahne Görseli + Toplam Fiyat Kartı */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl bg-[#EFECE4] border border-[#DFD9CE] h-44 flex items-center justify-center overflow-hidden">
                {snapshotUrl ? (
                  <img
                    src={snapshotUrl}
                    alt="3B Dolap Önizlemesi"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-[#78716C]">Canlı 3B Tasarım Özeti</span>
                )}
              </div>

              <div className="p-4 rounded-2xl bg-white border border-[#E5DFD3] flex flex-col justify-between">
                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold text-[#8C7A6B] uppercase tracking-wider">
                    Maliyet Dağılımı
                  </div>
                  <div className="flex justify-between text-[#57534E]">
                    <span>Panel & Yüzeyler</span>
                    <span className="font-mono">{fmtEur(pricing?.materialCostEur || 0)}</span>
                  </div>
                  <div className="flex justify-between text-[#57534E]">
                    <span>Donanım & Mekanizma</span>
                    <span className="font-mono">{fmtEur(pricing?.hardwareCostEur || 0)}</span>
                  </div>
                  <div className="flex justify-between text-[#57534E]">
                    <span>Üretim & Kenar Bandı</span>
                    <span className="font-mono">
                      {fmtEur((pricing?.laborCostEur || 0) + (pricing?.edgeBandCostEur || 0))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[#57534E]">Özel İskonto (%)</span>
                    <input
                      type="number"
                      min={0}
                      max={40}
                      value={discountPct}
                      onChange={(e) =>
                        setDiscountPct(Math.min(40, Math.max(0, Number(e.target.value) || 0)))
                      }
                      className="w-16 h-7 px-2 rounded-lg bg-[#FAF8F4] border border-[#DED8CC] font-mono text-right"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-[#F0ECE3] flex items-baseline justify-between">
                  <span className="font-bold text-[#141413]">KDV Dahil Toplam</span>
                  <span className="text-xl font-black font-mono text-[#141413]">
                    {fmtEur(discountedTotal)}
                  </span>
                </div>
              </div>
            </div>

            {/* Modül Özeti Listesi */}
            <div className="p-4 rounded-2xl bg-white border border-[#E5DFD3] space-y-2">
              <div className="font-bold text-[#141413]">
                Projede Yer Alan Modüller ({mainModules.length})
              </div>
              <div className="divide-y divide-[#F0ECE3]">
                {mainModules.map((m, i) => (
                  <div key={m.id} className="py-2 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold">
                        {i + 1}. {m.name}
                      </div>
                      <div className="text-[11px] text-[#78716C]">
                        Kapak: {resolveMatName(m.carcass.doorMaterialId)} • Gövde:{" "}
                        {resolveMatName(m.carcass.bodyMaterialId)}
                      </div>
                    </div>
                    <span className="font-mono text-[11px] px-2.5 py-1 rounded-full bg-[#F5F2EA]">
                      {Math.round(m.dimensions.width / 10)}×{Math.round(m.dimensions.height / 10)}×
                      {Math.round(m.dimensions.depth / 10)} cm
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 3-Katmanlı Donanım & Yüzey Paketi Kıyaslama */}
            <div className="p-4 rounded-2xl bg-white border border-[#E5DFD3] space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="font-bold text-[#141413]">Donanım Paketi Kıyaslama</div>
                <span className="text-[11px] text-[#78716C]">Tek tıkla fiyat farkını inceleyin</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(
                  [
                    {
                      id: "eco",
                      title: "Ekonomik Paket",
                      desc: "Standart frenli menteşe · Kısmi açılım ray",
                      mult: 0.88,
                      tag: "-12%",
                    },
                    {
                      id: "std",
                      title: "Standart (Seçili)",
                      desc: "Tam açılım teleskopik · System 32 pim",
                      mult: 1,
                      tag: "Mevcut",
                    },
                    {
                      id: "pro",
                      title: "Premium Blum/Hettich",
                      desc: "LEGRABOX / TIP-ON · LED & köşe mekanizma",
                      mult: 1.18,
                      tag: "+18%",
                    },
                  ] as const
                ).map((pkg) => {
                  const active = selectedPackageTier === pkg.id;
                  const pkgPrice = Math.max(0, rawTotal * pkg.mult * (1 - discountPct / 100));
                  return (
                    <button
                      key={pkg.id}
                      type="button"
                      onClick={() => setSelectedPackageTier(pkg.id)}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                        active
                          ? "bg-[#141413] text-white border-[#141413] shadow-xs"
                          : "bg-[#FAF8F4] hover:bg-[#F3EFE6] text-[#141413] border-[#E5DFD3]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold">{pkg.title}</span>
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                            active ? "bg-white/15 text-white" : "bg-[#EAE4D8] text-[#57534E]"
                          }`}
                        >
                          {pkg.tag}
                        </span>
                      </div>
                      <div
                        className={`text-[10px] mt-1 leading-snug ${
                          active ? "text-[#D6D3D1]" : "text-[#78716C]"
                        }`}
                      >
                        {pkg.desc}
                      </div>
                      <div className="font-mono text-xs font-bold mt-2">
                        {fmtEur(pkgPrice)}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Ücretsiz 3 Yüzey Numunesi Talebi */}
              <div className="pt-2.5 border-t border-[#F0ECE3] flex flex-wrap items-center justify-between gap-2">
                <div className="text-[11px] text-[#57534E]">
                  <strong className="text-[#141413]">Ücretsiz 3 Malzeme Numunesi:</strong>{" "}
                  Seçili kapak ve gövde renklerini sipariş öncesi evinizde inceleyin.
                </div>
                <button
                  type="button"
                  onClick={() => setSampleRequested(true)}
                  className={`h-8 px-3.5 rounded-full text-[11px] font-semibold transition cursor-pointer ${
                    sampleRequested
                      ? "bg-emerald-700 text-white"
                      : "bg-[#F1EDE4] hover:bg-[#E7E1D5] text-[#141413] border border-[#DED7C8]"
                  }`}
                >
                  {sampleRequested ? "✓ Numune Kutusu Talebe Eklendi" : "3 Ücretsiz Numune İste"}
                </button>
              </div>
            </div>

            {/* Müşteri Bilgisi */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Müşteri Adı Soyadı / Firma..."
                className="h-10 px-3.5 rounded-2xl bg-white border border-[#DED8CC] text-xs"
              />
              <input
                type="text"
                value={projectNote}
                onChange={(e) => setProjectNote(e.target.value)}
                placeholder="Teslimat veya montaj notu..."
                className="h-10 px-3.5 rounded-2xl bg-white border border-[#DED8CC] text-xs"
              />
            </div>
          </div>

          <div className="px-6 py-4 bg-[#F3EFE6] border-t border-[#E6E1D6] flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenBomModal("cutlist");
                }}
                className="h-10 px-4 rounded-full bg-white hover:bg-[#EFECE4] border border-[#DED8CC] font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#57534E]" />
                <span>Kesim & CNC Listesi</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenStoreErpModal();
                }}
                className="h-10 px-4 rounded-full bg-white hover:bg-[#EFECE4] border border-[#DED8CC] font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Store className="w-3.5 h-3.5 text-[#57534E]" />
                <span>Birim Store / ERP Aktar</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handlePrintOffer}
              className="h-10 px-5 rounded-full bg-[#141413] hover:bg-[#292524] text-white font-semibold text-xs flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-[#D6C7B2]" />
              <span>Görselli Teklif Yazdır / PDF</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </button>
          </div>
        </div>
      </div>
    );
  }
);

QuoteSummaryModal.displayName = "QuoteSummaryModal";
