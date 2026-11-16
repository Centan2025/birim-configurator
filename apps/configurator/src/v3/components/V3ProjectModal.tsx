"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { TENANT_BIRIM_ENTERPRISE, buildTenantScopedStorageKey } from "@birim/core";
import { useV3Adapter } from "../adapter/useV3Adapter";
import { SavedProjectMeta, useConfiguratorStore } from "../../store/useConfiguratorStore";
import { FolderOpen, Save, Trash2, Check, X, Share2, Copy, Cloud, Lock } from "lucide-react";
import { startZeroLagModalDrag } from "../design-system/zeroLagDrag";
import { buildProjectShareQrSvg } from "../utils/projectShareCodec";

interface CloudVersionItem {
  id: string;
  versionNo: number;
  isOrderLocked: boolean;
  createdAt: string;
  designDocument: unknown;
}

export const V3ProjectModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const { project, saveToStorage, loadFromStorage, getSavedProjects } = useV3Adapter();
  const activeTenantId = useConfiguratorStore((s) => s.activeTenantId);
  const activeTenantProfile = useConfiguratorStore((s) => s.activeTenantProfile);
  const pricing = useConfiguratorStore((s) => s.pricing);
  const importProjectJSON = useConfiguratorStore((s) => s.importProjectJSON);

  const [saveTitle, setSaveTitle] = useState(project.title);
  const [savedList, setSavedList] = useState<SavedProjectMeta[]>([]);
  const [cloudVersions, setCloudVersions] = useState<CloudVersionItem[]>([]);
  const [lockAsOrder, setLockAsOrder] = useState(false);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackIsError, setFeedbackIsError] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const tenantStorageKey = useMemo(
    () =>
      !activeTenantId || activeTenantId === TENANT_BIRIM_ENTERPRISE.tenantId
        ? "birim_saved_projects"
        : buildTenantScopedStorageKey(activeTenantId, "saved_projects"),
    [activeTenantId]
  );

  const buildAuthHeaders = useCallback((): Record<string, string> => {
    const token =
      typeof window !== "undefined" ? window.localStorage.getItem("modul_saas_session_token") : null;
    return {
      "Content-Type": "application/json",
      ...(token
        ? { "x-modul-session-token": token }
        : { "x-modul-tenant-id": activeTenantId }),
    };
  }, [activeTenantId]);

  const refreshCloudVersions = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/saas/projects?projectId=${encodeURIComponent(project.id)}`,
        { headers: buildAuthHeaders(), credentials: "same-origin" }
      );
      if (!res.ok) return;
      const data = (await res.json()) as { ok: boolean; versions?: CloudVersionItem[] };
      if (data.ok && Array.isArray(data.versions)) {
        setCloudVersions(data.versions);
      }
    } catch {
      // Offline local mode fallback
    }
  }, [project.id, buildAuthHeaders]);

  const refresh = useCallback(() => {
    setSavedList(getSavedProjects());
    void refreshCloudVersions();
  }, [getSavedProjects, refreshCloudVersions]);

  useEffect(() => {
    if (isOpen) {
      setSaveTitle(project.title);
      refresh();
      setFeedback(null);
      setFeedbackIsError(false);
      setCopiedLink(false);
    }
  }, [isOpen, project.title, refresh]);

  const shareBundle = useMemo(
    () => (isOpen ? buildProjectShareQrSvg(project) : null),
    [isOpen, project]
  );

  if (!isOpen) return null;

  const handleSave = () => {
    try {
      const id = saveToStorage(saveTitle.trim() || project.title);
      setFeedbackIsError(false);
      setFeedback(`Tasarım cihaz belleğine (${activeTenantProfile.brand.displayName}) kaydedildi (${id.slice(0, 10)})`);
      refresh();
    } catch (error) {
      setFeedbackIsError(true);
      setFeedback(error instanceof Error ? error.message : "Kayıt başarısız.");
    }
  };

  const handleCloudSave = async () => {
    setCloudBusy(true);
    try {
      const nextProj = { ...project, title: saveTitle.trim() || project.title };
      const res = await fetch("/api/saas/projects", {
        method: "POST",
        headers: buildAuthHeaders(),
        credentials: "same-origin",
        body: JSON.stringify({
          project: nextProj,
          lockAsOrder,
          pricingSnapshot: {
            currency: activeTenantProfile.pricing.currency,
            totalWithVatEur: pricing.totalWithVatEur,
            totalWithVatTry: pricing.totalWithVatTry,
            dealerNetWithVatTry: pricing.dealerNetWithVatTry,
          },
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        versionRecord?: { versionNo: number; isOrderLocked: boolean };
      };
      if (!res.ok || !data.ok) {
        setFeedbackIsError(true);
        setFeedback(data.error || "Bulut versiyon kaydı başarısız.");
      } else {
        setFeedbackIsError(false);
        setFeedback(
          `Bulut v${data.versionRecord?.versionNo ?? 1} kaydedildi${
            data.versionRecord?.isOrderLocked ? " (Sipariş Kilidi Aktif)" : ""
          }.`
        );
        setLockAsOrder(false);
        await refreshCloudVersions();
      }
    } catch {
      setFeedbackIsError(true);
      setFeedback("Bulut sunucusuna ulaşılamadı.");
    } finally {
      setCloudBusy(false);
    }
  };

  const handleCloudDeleteVersion = async (versionNo: number) => {
    try {
      const res = await fetch(
        `/api/saas/projects?projectId=${encodeURIComponent(project.id)}&versionNo=${versionNo}`,
        { method: "DELETE", headers: buildAuthHeaders(), credentials: "same-origin" }
      );
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setFeedbackIsError(true);
        setFeedback(data.error || "Kilitli sipariş versiyonu silinemez.");
        return;
      }
      setFeedbackIsError(false);
      setFeedback(`Bulut versiyon v${versionNo} silindi.`);
      await refreshCloudVersions();
    } catch {
      setFeedbackIsError(true);
      setFeedback("Versiyon silinirken hata oluştu.");
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
      const raw = localStorage.getItem(tenantStorageKey);
      if (raw) {
        const parsed: SavedProjectMeta[] = JSON.parse(raw);
        localStorage.setItem(
          tenantStorageKey,
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
            <h2 className="text-sm font-bold">Proje Kayıt, Bulut Versiyon &amp; Mobil QR Paylaşım</h2>
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
          {/* 1. Canlı Taşınabilir Link & Mobil QR Paylaşım */}
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
                  Mağazada hazırladığınız bu tasarımı müşterinin telefonunda veya evdeki bilgisayarında doğrudan açar.
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

          {/* 2. Yerel & Bulut SaaS Versiyon Kaydı */}
          <div className="space-y-2">
            <label
              htmlFor="v3-save-input"
              className="block text-xs font-semibold text-stone-600"
            >
              Proje Başlığı ({activeTenantProfile.brand.displayName})
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                id="v3-save-input"
                data-testid="v3-save-title-input"
                type="text"
                value={saveTitle}
                onChange={(e) => setSaveTitle(e.target.value)}
                placeholder="Örn: Ebeveyn Yatak Odası Gardırop"
                className="flex-1 min-w-[180px] bg-white border border-stone-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-700"
              />
              <button
                type="button"
                data-testid="v3-save-confirm-btn"
                onClick={handleSave}
                className="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Cihaza Kaydet</span>
              </button>
              <button
                type="button"
                data-testid="v3-cloud-save-btn"
                disabled={cloudBusy}
                onClick={handleCloudSave}
                className="px-3.5 py-2 rounded-xl bg-sky-800 hover:bg-sky-900 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>{cloudBusy ? "Kaydediliyor..." : "Buluta Versiyon Kaydet"}</span>
              </button>
            </div>
            <label className="inline-flex items-center gap-2 text-[11px] text-stone-600 cursor-pointer pt-0.5">
              <input
                type="checkbox"
                checked={lockAsOrder}
                onChange={(e) => setLockAsOrder(e.target.checked)}
                className="rounded border-stone-300"
              />
              <span>Bu bulut versiyonunu onaylı sipariş olarak kilitle (değiştirilemez / silinemez)</span>
            </label>
          </div>

          {/* 3. Bulut Proje Versiyon Geçmişi (`/api/saas/projects`) */}
          {cloudVersions.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-stone-600 mb-1.5 flex items-center gap-1.5">
                <Cloud className="w-3.5 h-3.5 text-sky-700" />
                <span>Bulut Versiyon Geçmişi ({cloudVersions.length})</span>
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {cloudVersions.map((ver) => (
                  <div
                    key={ver.id}
                    className="p-2.5 rounded-xl border border-sky-200/80 bg-sky-50/40 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono font-bold text-sky-950">v{ver.versionNo}</span>
                      {ver.isOrderLocked && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold">
                          <Lock className="w-2.5 h-2.5" /> Kilitli Sipariş
                        </span>
                      )}
                      <span className="text-[11px] text-stone-500 truncate">
                        {new Date(ver.createdAt).toLocaleString("tr-TR")}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          const ok = importProjectJSON(JSON.stringify(ver.designDocument));
                          if (ok.success) {
                            setFeedback(`Bulut versiyon v${ver.versionNo} sahneye yüklendi.`);
                            onClose();
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-[11px] font-semibold cursor-pointer"
                      >
                        Yükle
                      </button>
                      <button
                        type="button"
                        disabled={ver.isOrderLocked}
                        title={ver.isOrderLocked ? "Sipariş kilitli versiyon silinemez" : "Versiyonu sil"}
                        onClick={() => void handleCloudDeleteVersion(ver.versionNo)}
                        className="p-1 rounded-lg text-stone-400 hover:text-red-600 disabled:opacity-30 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. Cihazdaki Kayıtlı Tasarımlar Listesi */}
          <div>
            <div className="text-xs font-semibold text-stone-600 mb-2">
              Bu Cihazdaki Kayıtlı Tasarımlarım ({savedList.length})
            </div>
            {savedList.length === 0 ? (
              <div className="p-5 text-center border border-dashed border-stone-300 rounded-2xl text-xs text-stone-400">
                Henüz bu organizasyonda kayıtlı yerel bir projeniz bulunmuyor.
              </div>
            ) : (
              <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
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
                        {new Date(item.date).toLocaleDateString("tr-TR")} • € {Math.round(item.priceEur)}
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
