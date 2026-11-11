"use client";

import React, { useState, useEffect, useRef } from "react";
import { useConfiguratorStore, type SavedProjectMeta } from "../store/useConfiguratorStore";

interface ProjectSaveLoadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProjectSaveLoadModal: React.FC<ProjectSaveLoadModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    project,
    saveToStorage,
    loadFromStorage,
    getSavedProjects,
    exportProjectJSON,
    importProjectJSON,
  } = useConfiguratorStore();

  const [savedList, setSavedList] = useState<SavedProjectMeta[]>([]);
  const [saveName, setSaveName] = useState(project.title || "Birim Dolap Tasarımı");
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshList = () => {
    try {
      const list = getSavedProjects();
      setSavedList(list);
    } catch {
      setSavedList([]);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshList();
      setSaveName(project.title || "Birim Dolap Tasarımı");
      setStatusMsg(null);
    }
  }, [isOpen, project.title]);

  if (!isOpen) return null;

  const handleSave = () => {
    try {
      const id = saveToStorage(saveName.trim() || undefined);
      setStatusMsg({ text: `Proje başarıyla kaydedildi (ID: ${id.slice(0, 8)})`, type: "success" });
      refreshList();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Kayıt başarısız";
      setStatusMsg({ text: `Hata: ${message}`, type: "error" });
    }
  };

  const handleLoad = (id: string) => {
    const ok = loadFromStorage(id);
    if (ok) {
      setStatusMsg({ text: "Tasarım başarıyla yüklendi!", type: "success" });
      setTimeout(() => {
        onClose();
      }, 500);
    } else {
      setStatusMsg({ text: "Proje yüklenemedi", type: "error" });
    }
  };

  const handleDelete = (id: string) => {
    try {
      const raw = localStorage.getItem("birim_saved_projects");
      if (raw) {
        const list: SavedProjectMeta[] = JSON.parse(raw);
        const filtered = list.filter((p) => p.id !== id);
        localStorage.setItem("birim_saved_projects", JSON.stringify(filtered));
      }
      refreshList();
      setStatusMsg({ text: "Tasarım silindi", type: "success" });
    } catch {
      setStatusMsg({ text: "Silme işlemi başarısız", type: "error" });
    }
  };

  const handleExport = () => {
    try {
      const json = exportProjectJSON();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${project.title.toLowerCase().replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.birim`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatusMsg({ text: "JSON dosyası indirildi", type: "success" });
    } catch {
      setStatusMsg({ text: "Dışa aktarma hatası", type: "error" });
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;
      const res = importProjectJSON(content);
      if (res.success) {
        setStatusMsg({ text: "Proje başarıyla içe aktarıldı!", type: "success" });
        refreshList();
        setTimeout(() => {
          onClose();
        }, 600);
      } else {
        setStatusMsg({ text: `İçe aktarma hatası: ${res.error || "Geçersiz dosya"}`, type: "error" });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-2xl p-4">
      <div className="birim-ice-dark-bar border border-white/20 rounded-3xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[85vh] overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-950/60 backdrop-blur-2xl">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
              Proje Yönetimi & Kayıtlar
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Tasarımı yerel belleğe kaydedin veya dışa/içe aktarın</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-slate-800 transition"
          >
            ✕
          </button>
        </div>

        {/* Feedback message */}
        {statusMsg && (
          <div
            className={`px-6 py-2.5 text-xs font-semibold flex items-center gap-2 ${
              statusMsg.type === "success"
                ? "bg-emerald-950/70 border-b border-emerald-800/80 text-emerald-300"
                : "bg-red-950/70 border-b border-red-800/80 text-red-300"
            }`}
          >
            <span>{statusMsg.type === "success" ? "✓" : "⚠"}</span>
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Section 1: Save Current */}
          <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/60 space-y-3">
            <h3 className="text-sm font-semibold text-slate-200">Mevcut Tasarımı Kaydet</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="Örn: Salon Dolabı - Müşteri A"
                className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded text-sm font-semibold transition"
              >
                Kaydet
              </button>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={handleExport}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-xs font-medium text-slate-200 rounded transition flex items-center gap-1.5"
              >
                <span>⬇</span> .birim JSON Olarak İndir
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-xs font-medium text-slate-200 rounded transition flex items-center gap-1.5"
              >
                <span>⬆</span> Dosyadan İçe Aktar
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImportFile}
                accept=".birim,.json"
                className="hidden"
              />
            </div>
          </div>

          {/* Section 2: Saved Projects List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-200">Kayıtlı Tasarımlar ({savedList.length})</h3>
              <button
                onClick={refreshList}
                className="text-xs text-slate-400 hover:text-slate-200 underline"
              >
                Yenile
              </button>
            </div>

            {savedList.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-slate-800 rounded-lg text-slate-500 text-xs">
                Henüz yerel kayıt bulunmuyor. Tasarımınızı yukarıdan kaydedebilirsiniz.
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {savedList.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 bg-slate-950/70 border border-slate-800 hover:border-slate-700 rounded-lg transition"
                  >
                    <div>
                      <div className="text-sm font-medium text-slate-200">{item.title}</div>
                      <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-amber-400 font-semibold">€{item.priceEur?.toLocaleString("tr-TR", { minimumFractionDigits: 0 })}</span>
                        <span>•</span>
                        <span>{new Date(item.date).toLocaleDateString("tr-TR")} {new Date(item.date).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleLoad(item.id)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold transition"
                      >
                        Yükle
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="px-2 py-1.5 text-slate-400 hover:text-red-400 rounded text-xs transition"
                        title="Sil"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-medium transition"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
