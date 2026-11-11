"use client";

import React, { useEffect, useState } from "react";
import {
  DEFAULT_WARDROBE_GLB_CATALOG,
  type WardrobeGlbCategory,
  getActiveWardrobeGlbUrl,
  isWardrobeGlbPropsEnabled,
  registerCustomWardrobeGlbFile,
  registerCustomWardrobeGlbUrl,
  resetWardrobeGlbCategoryToDefault,
  setWardrobeGlbPropsEnabled,
  subscribeWardrobeGlbCatalogChange,
} from "../materials/wardrobeGlbAssetLoader";

interface WardrobeGlbLibraryModalProps {
  open: boolean;
  onClose: () => void;
}

const ORDERED_CATEGORIES: WardrobeGlbCategory[] = [
  "jacket",
  "shirt",
  "shoe",
  "folded_cloth",
  "silk_pouf",
  "sunglasses",
  "watch",
];

export const WardrobeGlbLibraryModal: React.FC<WardrobeGlbLibraryModalProps> = ({
  open,
  onClose,
}) => {
  const [, setTick] = useState(0);
  const [editingUrlCat, setEditingUrlCat] = useState<WardrobeGlbCategory | null>(null);
  const [urlDraft, setUrlDraft] = useState("");

  useEffect(() => {
    if (!open) return;
    return subscribeWardrobeGlbCatalogChange(() => {
      setTick((t) => t + 1);
    });
  }, [open]);

  if (!open) return null;

  const enabled = isWardrobeGlbPropsEnabled();

  return (
    <div
      className="fixed inset-0 z-[260] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-3xl bg-[#F8F6F1] border border-stone-300/80 shadow-2xl overflow-hidden text-[#1C1917]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-white/80">
          <div>
            <h3 className="text-sm font-bold tracking-tight text-[#141413]">
              Hazır 3D İç Aksesuar Kütüphanesi (.GLB / .GLTF)
            </h3>
            <p className="text-[11px] text-stone-500 mt-0.5">
              El çizimi yerine doğrulanmış hazır 3D taranmış modeller (GLTFLoader + DRACOLoader) ve özel .GLB yükleme desteği
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setWardrobeGlbPropsEnabled(!enabled)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold cursor-pointer transition ${
                enabled
                  ? "bg-emerald-700 text-white"
                  : "bg-stone-200 text-stone-700 hover:bg-stone-300"
              }`}
            >
              {enabled ? "3D Modeller: Açık" : "3D Modeller: Kapalı"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-stone-200/70 hover:bg-stone-300/80 text-stone-700 font-bold text-xs cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="px-6 py-3 bg-stone-100/80 border-b border-stone-200 flex flex-wrap items-center gap-2 text-[11px] text-stone-600">
          <span className="font-semibold text-stone-800">Hazır ücretsiz .GLB model siteleri:</span>
          <a
            href="https://polyhaven.com/models"
            target="_blank"
            rel="noreferrer"
            className="px-2 py-0.5 rounded-lg bg-white border border-stone-300 hover:border-stone-500 text-stone-800 font-medium"
          >
            Poly Haven (CC0) ↗
          </a>
          <a
            href="https://github.com/KhronosGroup/glTF-Sample-Assets"
            target="_blank"
            rel="noreferrer"
            className="px-2 py-0.5 rounded-lg bg-white border border-stone-300 hover:border-stone-500 text-stone-800 font-medium"
          >
            Khronos glTF Sample Assets ↗
          </a>
          <a
            href="https://sketchfab.com/features/gltf"
            target="_blank"
            rel="noreferrer"
            className="px-2 py-0.5 rounded-lg bg-white border border-stone-300 hover:border-stone-500 text-stone-800 font-medium"
          >
            Sketchfab glTF/GLB ↗
          </a>
        </div>

        <div className="max-h-[60vh] overflow-y-auto divide-y divide-stone-200/80 px-6 py-2">
          {ORDERED_CATEGORIES.map((cat) => {
            const meta = DEFAULT_WARDROBE_GLB_CATALOG[cat];
            const activeInfo = getActiveWardrobeGlbUrl(cat);
            const isUrlOpen = editingUrlCat === cat;

            return (
              <div key={cat} className="py-3 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#141413] truncate">
                        {meta.label}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          activeInfo.error
                            ? "bg-amber-100 text-amber-800"
                            : activeInfo.isLoaded
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-stone-200 text-stone-700"
                        }`}
                      >
                        {activeInfo.error
                          ? "Yükleme Bekleniyor"
                          : activeInfo.isLoaded
                            ? "Hazır 3D .GLB Aktif"
                            : "İndiriliyor..."}
                      </span>
                      {activeInfo.isCustom && (
                        <span className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 text-[10px] font-semibold">
                          Özel: {activeInfo.customLabel}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-stone-500 mt-0.5 flex items-center gap-2">
                      <span>
                        Hedef Ölçü: {meta.targetMm.w}×{meta.targetMm.h}×{meta.targetMm.d} mm
                      </span>
                      <span>•</span>
                      <a
                        href={meta.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="underline hover:text-stone-800 truncate"
                      >
                        {meta.sourceTitle}
                      </a>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <label className="px-2.5 py-1.5 rounded-xl bg-[#141413] hover:bg-stone-800 text-white text-[11px] font-semibold cursor-pointer">
                      .GLB Seç
                      <input
                        type="file"
                        accept=".glb,.gltf"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            registerCustomWardrobeGlbFile(cat, file);
                          }
                          e.currentTarget.value = "";
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (isUrlOpen) {
                          setEditingUrlCat(null);
                        } else {
                          setEditingUrlCat(cat);
                          setUrlDraft(activeInfo.isCustom ? activeInfo.url : "");
                        }
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 text-[11px] font-semibold cursor-pointer"
                    >
                      URL
                    </button>
                    {activeInfo.isCustom && (
                      <button
                        type="button"
                        onClick={() => resetWardrobeGlbCategoryToDefault(cat)}
                        className="px-2 py-1.5 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-800 text-[11px] font-semibold cursor-pointer"
                      >
                        Sıfırla
                      </button>
                    )}
                  </div>
                </div>

                {isUrlOpen && (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="url"
                      value={urlDraft}
                      onChange={(e) => setUrlDraft(e.target.value)}
                      placeholder="Doğrudan .glb URL'si yapıştırın (örn. https://.../blazer.glb)"
                      className="flex-1 px-3 py-1.5 rounded-xl bg-white border border-stone-300 text-xs text-stone-900"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        registerCustomWardrobeGlbUrl(cat, urlDraft);
                        setEditingUrlCat(null);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer"
                    >
                      Uygula
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="px-6 py-3 bg-white/90 border-t border-stone-200 flex items-center justify-between text-[11px] text-stone-500">
          <span>
            İpucu: İndirdiğiniz herhangi bir .glb modelini seçtiğinizde milimetre ölçeğine otomatik oturtulur.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-[#141413] text-white font-semibold cursor-pointer"
          >
            Tamam
          </button>
        </div>
      </div>
    </div>
  );
};
