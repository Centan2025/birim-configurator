"use client";

import React, { useState, useEffect } from "react";
import { useV3Adapter } from "../adapter/useV3Adapter";
import { SavedProjectMeta } from "../../store/useConfiguratorStore";
import { FolderOpen, Save, Trash2, Check, X } from "lucide-react";

export const V3ProjectModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const { project, saveToStorage, loadFromStorage, getSavedProjects } = useV3Adapter();
  const [saveTitle, setSaveTitle] = useState(project.title);
  const [savedList, setSavedList] = useState<SavedProjectMeta[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackIsError, setFeedbackIsError] = useState(false);

  const refresh = () => {
    setSavedList(getSavedProjects());
  };

  useEffect(() => {
    if (isOpen) {
      setSaveTitle(project.title);
      refresh();
      setFeedback(null);
      setFeedbackIsError(false);
    }
  }, [isOpen, project.title]);

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
    >
      <div className="bg-white border border-stone-200 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden text-stone-900">
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-amber-700" />
            <h2 className="text-sm font-bold">Proje Kayıt & Yükleme</h2>
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
            data-testid="v3-modal-feedback"
            className={`px-5 py-2.5 border-b text-xs font-semibold flex items-center gap-1.5 ${feedbackIsError ? "bg-red-50 border-red-200 text-red-800" : "bg-emerald-50 border-emerald-200 text-emerald-800"}`}
          >
            {feedbackIsError ? <X className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
            <span>{feedback}</span>
          </div>
        )}

        <div className="p-5 space-y-5">
          {/* Save Section */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-stone-700 block">
              Aktif Tasarımı Kaydet
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                data-testid="v3-save-input"
                value={saveTitle}
                onChange={(e) => setSaveTitle(e.target.value)}
                placeholder="Proje adı..."
                className="flex-1 px-3 py-2 rounded-xl border border-stone-300 text-xs font-medium text-stone-900 focus:outline-none focus:border-amber-700"
              />
              <button
                type="button"
                data-testid="v3-save-confirm-btn"
                onClick={handleSave}
                className="px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                Kaydet
              </button>
            </div>
          </div>

          {/* Saved List */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-stone-700">
              Kayıtlı Tasarımlar ({savedList.length})
            </div>
            {savedList.length === 0 ? (
              <div className="p-6 text-center rounded-xl border border-dashed border-stone-300 text-xs text-stone-500">
                Henüz kaydedilmiş bir proje yok.
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {savedList.map((item, idx) => (
                  <div
                    key={item.id}
                    data-testid={`v3-saved-item-${idx}`}
                    className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-200"
                  >
                    <div>
                      <div className="text-xs font-bold text-stone-900">{item.title}</div>
                      <div className="text-[11px] font-mono text-amber-800 font-semibold">
                        €{item.priceEur?.toLocaleString("tr-TR", { minimumFractionDigits: 0 })}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        data-testid={`v3-load-btn-${idx}`}
                        onClick={() => handleLoad(item.id)}
                        className="px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold cursor-pointer"
                      >
                        Aç / Yükle
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 cursor-pointer"
                        title="Sil"
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
