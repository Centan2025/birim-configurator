"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useV3Adapter } from "../adapter/useV3Adapter";
import { SavedProjectMeta } from "../../store/useConfiguratorStore";
import { FolderOpen, Save, Trash2, Check, X, Share2, Copy } from "lucide-react";
import { startZeroLagModalDrag } from "../design-system/zeroLagDrag";
import { buildProjectShareQrSvg } from "../utils/projectShareCodec";

export const V3ProjectModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const { project, saveToStorage, loadFromStorage, getSavedProjects } = useV3Adapter();
  const [saveTitle, setSaveTitle] = useState(project.title);
  const [savedList, setSavedList] = useState<SavedProjectMeta[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackIsError, setFeedbackIsError] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const refresh = () => {
    setSavedList(getSavedProjects());
  };

  useEffect(() => {
    if (isOpen) {
      setSaveTitle(project.title);
      refresh();
      setFeedback(null);
      setFeedbackIsError(false);
      setCopiedLink(false);
    }
  }, [isOpen, project.title]);

  const shareBundle = useMemo(
    () => (isOpen ? buildProjectShareQrSvg(project) : null),
    [isOpen, project]
  );

  if (!isOpen) return null;

  const handleSave = () => {
    try {
      const id = saveToStorage(saveTitle.trim() || project.title);
      setFeedbackIsError(false);
      setFeedback(`Tasarım kaydedildi (${id.slice(0, 10)})`);
      refresh();
    } catch (error) {
      setFeedbackIsError(true);
      setFeedback(error instanceof Error ? error.message : "Kayıt başarısız.");
    }
  };

  const handleCopyShareUrl = () => {
    if (!shareBundle) return;
    const copyFallback = (text: string) => {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        // ignore
      }
      document.body.removeChild(ta);
    };
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      navigator.clipboard.writeText(shareBundle.shareUrl).catch(() => copyFallback(shareBundle.shareUrl));
    } else {
      copyFallback(shareBundle.shareUrl);
    }
    setCopiedLink(true);
    setFeedbackIsError(false);
    setFeedback("Paylaşılabilir canlı tasarım linki panoya kopyalandı! Müşteri telefonundan doğrudan açabilir.");
    setTimeout(() => setCopiedLink(false), 2600);
  };

  const handleLoad = (id: string) => {
    const ok = loadFromStorage(id);
    if (ok) {
      setFeedback("Tasarım başarıyla yüklendi.");
      onClose();
    }
  };

  const handleDelete = (id: string) => {
    try {
      const raw = localStorage.getItem("birim_saved_projects");
      if (raw) {
        const parsed: SavedProjectMeta[] = JSON.parse(raw);
        localStorage.setItem(
          "birim_saved_projects",
          JSON.stringify(parsed.filter((p) => p.id !== id))
        );
        refresh();
      }
    } catch {
      // ignore
    }
  };

  return (
    <div
      data-testid="v3-project-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 backdrop-blur-xs p-4 select-none"
      onClick={onClose}
    >
      <div
        data-draggable-shell="project"
        onClick={(e) => e.stopPropagation()}
        className="birim-ice-modal rounded-[28px] max-w-xl w-full overflow-hidden text-stone-900"
      >
        <div
          onPointerDown={(e) => startZeroLagModalDrag(e)}
          title="Taşımak için sürükleyin"
          className="px-5 py-4 birim-ice-shell-header flex items-center justify-between cursor-grab active:cursor-grabbing select-none"
        >
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-amber-700" />
            <h2 className="text-sm font-bold">Proje Kayıt, Bulut Linki &amp; Mobil QR Paylaşım</h2>
          </div>
          <button
            type="button"
            data-testid="v3-modal-close"
            onClick={onClose}
            className="p-1 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-200/60 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {feedback && (
          <div
            role={feedbackIsError ? "alert" : "status"}
            className={`mx-5 mt-3 p-2.5 rounded-xl text-xs font-medium flex items-center gap-1.5 border ${
              feedbackIsError
                ? "bg-red-50 border-red-200 text-red-700"
                : "bg-emerald-50 border-emerald-200 text-emerald-700"
            }`}
          >
            <Check className="w-3.5 h-3.5 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}

        <div className="p-5 space-y-4 max-h-[78vh] overflow-y-auto">
          {/* 1. Canlı Taşınabilir Link & Mobil QR Paylaşım (localStorage sınırını aşar!) */}
          {shareBundle && (
            <div className="p-3.5 rounded-2xl bg-white/90 border border-stone-200/90 flex flex-col sm:flex-row items-center gap-3.5 shadow-2xs">
              <div
                className="w-28 h-28 rounded-xl bg-white p-1.5 border border-stone-200 shrink-0 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
                dangerouslySetInnerHTML={{ __html: shareBundle.qrSvg }}
              />
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-stone-900">
                  <Share2 className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Cihazlar Arası Canlı Tasarım Linki &amp; Mobil QR</span>
                </div>
                <p className="text-[11px] text-stone-500 leading-snug">
                  Mağazada hazırladığınız bu tasarımı müşterinin telefonunda veya evdeki bilgisayarında tarayıcı belleğine bağlı kalmadan doğrudan açar.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareBundle.shareUrl}
                    className="flex-1 px-2.5 py-1.5 rounded-xl bg-stone-100 border border-stone-200 text-[10px] font-mono text-stone-700 truncate"
                  />
                  <button
                    type="button"
                    data-testid="v3-copy-share-link-btn"
                    onClick={handleCopyShareUrl}
                    className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedLink ? "Kopyalandı!" : "Linki Kopyala"}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 2. Yerel Hızlı Kayıt */}
          <div>
            <label
              htmlFor="v3-save-input"
              className="block text-xs font-semibold text-stone-600 mb-1.5"
            >
              Bu Cihaza Tasarım Kaydet
            </label>
            <div className="flex gap-2">
              <input
                id="v3-save-input"
                data-testid="v3-save-title-input"
                type="text"
                value={saveTitle}
                onChange={(e) => setSaveTitle(e.target.value)}
                placeholder="Örn: Ebeveyn Yatak Odası Gardırop"
                className="flex-1 bg-white border border-stone-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-700"
              />
              <button
                type="button"
                data-testid="v3-save-confirm-btn"
                onClick={handleSave}
                className="px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Kaydet</span>
              </button>
            </div>
          </div>

          {/* 3. Kayıtlı Tasarımlar Listesi */}
          <div>
            <div className="text-xs font-semibold text-stone-600 mb-2">
              Kayıtlı Tasarımlarım ({savedList.length})
            </div>
            {savedList.length === 0 ? (
              <div className="p-5 text-center border border-dashed border-stone-300 rounded-2xl text-xs text-stone-400">
                Henüz bu cihazda kayıtlı bir projeniz bulunmuyor.
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {savedList.map((item) => (
                  <div
                    key={item.id}
                    data-testid={`saved-proj-${item.id}`}
                    className="p-2.5 rounded-xl border border-stone-200 hover:border-stone-300 bg-stone-50 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-stone-800 truncate">
                        {item.title}
                      </div>
                      <div className="text-[11px] text-stone-500">
                        {item.dimensionsLabel} •{" "}
                        {new Date(item.updatedAt).toLocaleDateString("tr-TR")}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleLoad(item.id)}
                        className="px-2.5 py-1 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-medium cursor-pointer"
                      >
                        Aç
                      </button>
                      <button
                        type="button"
                        aria-label={`${item.title} sil`}
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
