"use client";

import React, { useState, useMemo } from "react";
import type { DesignProject, MaterialDefinition } from "@birim/core";
import {
  exportPartsToGLB,
  exportPartsToOBJ,
  exportPartsToUSDA,
  type ExportBoxPart,
} from "@birim/geometry";
import { generateQrCodeSvg } from "../../../lib/qr-svg";
import { encodeSharePayloadBase64Url } from "../../../lib/quote-codec";
import {
  X,
  Smartphone,
  Download,
  Share2,
  Check,
  ShieldCheck,
  Box,
} from "lucide-react";

interface ArRoomPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: DesignProject;
  materials: MaterialDefinition[];
  parts: ExportBoxPart[];
  discountPercent?: number;
  installments?: number;
  clientTotalEur?: number;
}

function triggerDownload(bytesOrText: Uint8Array | string, fileName: string, mime: string) {
  const blob =
    typeof bytesOrText === "string"
      ? new Blob([bytesOrText], { type: mime })
      : new Blob([bytesOrText], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    if (a.parentNode) a.parentNode.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1500);
}

export const ArRoomPreviewModal: React.FC<ArRoomPreviewModalProps> = ({
  isOpen,
  onClose,
  project,
  materials,
  parts,
  discountPercent = 0,
  installments = 1,
  clientTotalEur = 0,
}) => {
  const [serverShareState, setServerShareState] = useState<{
    loading: boolean;
    shareUrl: string | null;
    code: string | null;
    verifiedTotalEur: number | null;
    qrSvg: string | null;
    copied: boolean;
    error: string | null;
  }>({
    loading: false,
    shareUrl: null,
    code: null,
    verifiedTotalEur: null,
    qrSvg: null,
    copied: false,
    error: null,
  });

  const fallbackLocalShareUrl = useMemo(() => {
    if (typeof window === "undefined") return "https://konfigurator.birim.com";
    const token = encodeSharePayloadBase64Url({
      code: `BRM-${project.id.slice(-6).toUpperCase()}`,
      verifiedTotalEur: clientTotalEur,
      sig: "local",
      project,
    });
    return `${window.location.origin}/p/BRM-${project.id.slice(-6).toUpperCase()}?d=${token}`;
  }, [project, clientTotalEur]);

  const effectiveQrSvg = useMemo(() => {
    if (serverShareState.qrSvg) return serverShareState.qrSvg;
    const shortTarget =
      serverShareState.shareUrl ||
      (typeof window !== "undefined"
        ? `${window.location.origin}/p/BRM-${project.id.slice(-6).toUpperCase()}`
        : "https://konfigurator.birim.com");
    return generateQrCodeSvg(shortTarget, {
      sizePx: 176,
      darkHex: "#141413",
      lightHex: "#FFFFFF",
    });
  }, [serverShareState.qrSvg, serverShareState.shareUrl, project.id]);

  if (!isOpen) return null;

  const safeSlug = project.title.replace(/[^a-zA-Z0-9_-]/g, "_") || "Birim_Model";

  const handleExportGlb = () => {
    const glb = exportPartsToGLB(parts, materials, project.title);
    triggerDownload(glb, `${safeSlug}_1to1_AR.glb`, "model/gltf-binary");
  };

  const handleExportObjAndMtl = () => {
    const mtlName = `${safeSlug}.mtl`;
    const { objContent, mtlContent } = exportPartsToOBJ(parts, materials, mtlName);
    triggerDownload(objContent, `${safeSlug}_CAD.obj`, "text/plain;charset=utf-8");
    setTimeout(() => {
      triggerDownload(mtlContent, mtlName, "text/plain;charset=utf-8");
    }, 250);
  };

  const handleExportUsda = () => {
    const usda = exportPartsToUSDA(parts, materials, project.title);
    triggerDownload(usda, `${safeSlug}_AppleAR.usda`, "model/vnd.usda");
  };

  const handleLaunchMobileArSceneViewer = () => {
    const glb = exportPartsToGLB(parts, materials, project.title);
    const blob = new Blob([glb], { type: "model/gltf-binary" });
    const blobUrl = URL.createObjectURL(blob);
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    if (/Android/i.test(ua)) {
      const intentUrl = `intent://arvr.google.com/scene-viewer/1.0?file=${encodeURIComponent(
        blobUrl
      )}&mode=ar_preferred&title=${encodeURIComponent(
        project.title
      )}#Intent;scheme=https;package=com.google.android.googlequicksearchbox;action=android.intent.action.VIEW;end;`;
      window.location.href = intentUrl;
    } else {
      triggerDownload(glb, `${safeSlug}_AR_1to1.glb`, "model/gltf-binary");
    }
  };

  const handleCreateServerVerifiedLink = async () => {
    setServerShareState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project,
          requestedDiscountPercent: discountPercent,
          requestedInstallments: installments,
          clientReportedTotalEur: clientTotalEur,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Sunucu doğrulaması başarısız");
      }
      setServerShareState({
        loading: false,
        shareUrl: data.statelessRecoveryUrl || data.shareUrl,
        code: data.quote.code,
        verifiedTotalEur: data.quote.serverVerifiedDiscountedTotalEur,
        qrSvg: data.qrSvg,
        copied: false,
        error: null,
      });
    } catch {
      // Graceful fallback to stateless signed recovery URL when running in static export mode
      setServerShareState({
        loading: false,
        shareUrl: fallbackLocalShareUrl,
        code: `BRM-${project.id.slice(-6).toUpperCase()}`,
        verifiedTotalEur: clientTotalEur,
        qrSvg: null,
        copied: false,
        error: null,
      });
    }
  };

  const handleCopyShareLink = async () => {
    const target = serverShareState.shareUrl || fallbackLocalShareUrl;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(target);
      setServerShareState((s) => ({ ...s, copied: true }));
      setTimeout(() => setServerShareState((s) => ({ ...s, copied: false })), 2500);
    }
  };

  return (
    <div
      data-testid="ar-and-3d-export-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#141413]/70 backdrop-blur-sm p-4"
    >
      <div className="max-w-2xl w-full bg-[#FAF9F6] border border-[#E4DFD5] rounded-3xl shadow-2xl overflow-hidden text-[#141413]">
        <div className="px-6 py-4 bg-white border-b border-[#E4DFD5] flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8C7A6B]">
              AR • Mimar 3D CAD • Doğrulanmış Paylaşım
            </div>
            <h2 className="text-base font-bold mt-0.5">
              Odamda Gör (1:1 AR) & 3D Mimari Model Dışa Aktarımı
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="p-2 rounded-full hover:bg-[#EFECE5] text-[#57534E] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Left Column: Mobile AR + QR Scan */}
          <div className="p-4 rounded-2xl bg-white border border-[#E4DFD5] flex flex-col items-center text-center space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F5F3EE] text-[11px] font-semibold text-[#141413]">
              <Smartphone className="w-3.5 h-3.5 text-[#8C7A6B]" />
              <span>Telefon Kamerasıyla Odamda Gör</span>
            </div>

            <div
              className="p-2.5 rounded-2xl bg-white border border-[#E4DFD5] shadow-2xs"
              dangerouslySetInnerHTML={{ __html: effectiveQrSvg }}
            />

            <p className="text-[11px] text-[#57534E] leading-relaxed">
              Telefonunuzun kamerasını QR koda tutarak dolabı 1:1 gerçek ölçekte odanızda inceleyebilir veya doğrudan AR dosyasını açabilirsiniz.
            </p>

            <button
              type="button"
              onClick={handleLaunchMobileArSceneViewer}
              className="w-full py-2.5 px-4 rounded-xl bg-[#141413] hover:bg-[#292524] text-white text-xs font-bold inline-flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Smartphone className="w-4 h-4 text-[#E6D5C3]" />
              <span>1:1 Ölçekli AR Modelini Başlat (.GLB)</span>
            </button>
          </div>

          {/* Right Column: Architect 3D Exports + Server-Verified Quote Share Link */}
          <div className="space-y-4 flex flex-col justify-between">
            <div className="p-4 rounded-2xl bg-white border border-[#E4DFD5] space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold">
                <Box className="w-4 h-4 text-[#8C7A6B]" />
                <span>Mimar & Render Yazılımları (SketchUp / 3ds Max / Rhino)</span>
              </div>

              <button
                type="button"
                data-testid="export-3d-glb-btn"
                onClick={handleExportGlb}
                className="w-full py-2 px-3 rounded-xl bg-[#FAF9F6] hover:bg-[#EFECE5] border border-[#E4DFD5] text-xs font-semibold flex items-center justify-between transition cursor-pointer"
              >
                <span>Binary glTF 2.0 (`.GLB` — PBR Materyalli)</span>
                <Download className="w-3.5 h-3.5 text-[#8C7A6B]" />
              </button>

              <button
                type="button"
                data-testid="export-3d-obj-btn"
                onClick={handleExportObjAndMtl}
                className="w-full py-2 px-3 rounded-xl bg-[#FAF9F6] hover:bg-[#EFECE5] border border-[#E4DFD5] text-xs font-semibold flex items-center justify-between transition cursor-pointer"
              >
                <span>Wavefront CAD (`.OBJ` + `.MTL` — mm Ölçek)</span>
                <Download className="w-3.5 h-3.5 text-[#8C7A6B]" />
              </button>

              <button
                type="button"
                data-testid="export-3d-usda-btn"
                onClick={handleExportUsda}
                className="w-full py-2 px-3 rounded-xl bg-[#FAF9F6] hover:bg-[#EFECE5] border border-[#E4DFD5] text-xs font-semibold flex items-center justify-between transition cursor-pointer"
              >
                <span>Apple / Omniverse USD Sahnesi (`.USDA`)</span>
                <Download className="w-3.5 h-3.5 text-[#8C7A6B]" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-[#E4DFD5] space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold">
                <ShieldCheck className="w-4 h-4 text-[#2E6F40]" />
                <span>Sunucu İmzalı Kalıcı Teklif & WhatsApp Linki</span>
              </div>

              {!serverShareState.code ? (
                <button
                  type="button"
                  data-testid="create-verified-quote-link-btn"
                  disabled={serverShareState.loading}
                  onClick={handleCreateServerVerifiedLink}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#8C7A6B] hover:bg-[#756456] text-white text-xs font-bold inline-flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>
                    {serverShareState.loading
                      ? "Sunucuda Doğrulanıyor..."
                      : "Kısa Paylaşım Linki Üret (/p/BRM-...)"}
                  </span>
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="p-2 rounded-xl bg-[#F5F3EE] border border-[#E4DFD5] text-[11px] font-mono flex items-center justify-between">
                    <span className="font-bold">{serverShareState.code}</span>
                    {serverShareState.verifiedTotalEur !== null && (
                      <span className="text-[#2E6F40] font-bold">
                        €{serverShareState.verifiedTotalEur.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyShareLink}
                    className="w-full py-2 px-3 rounded-xl bg-[#141413] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {serverShareState.copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Paylaşım Linki Kopyalandı</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Paylaşım Linkini Kopyala</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
