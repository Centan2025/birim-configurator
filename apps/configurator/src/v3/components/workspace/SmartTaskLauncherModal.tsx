"use client";

import React from "react";
import { V3BrandBadge } from "../../design-system";
import { Box, Compass, FolderOpen, Sparkles, ArrowRight, CheckSquare, Square, X } from "lucide-react";

export interface SmartTaskLauncherModalProps {
  isOpen: boolean;
  skipByDefault: boolean;
  onToggleSkipByDefault: (skip: boolean) => void;
  onSelectReadyModule: () => void;
  onSelectDesignFromScratch: () => void;
  onSelectDesignSpace: () => void;
  onSelectOpenProject: () => void;
  onContinueToWorkspace: () => void;
}

/**
 * Akıllı Görev Akışı Başlangıç Ekranı ("Ne tasarlamak istersiniz?").
 * Acemi kullanıcıyı onlarca teknik araçla karşılaştırmak yerine 4 net görev akışı sunar;
 * deneyimli kullanıcılar ise "Varsayılan olarak doğrudan çalışma alanına geç" tercihiyle
 * hiçbir yavaşlama yaşamadan doğrudan 3B/2B sahneye geçebilir.
 */
export const SmartTaskLauncherModal: React.FC<SmartTaskLauncherModalProps> = React.memo(
  ({
    isOpen,
    skipByDefault,
    onToggleSkipByDefault,
    onSelectReadyModule,
    onSelectDesignFromScratch,
    onSelectDesignSpace,
    onSelectOpenProject,
    onContinueToWorkspace,
  }) => {
    React.useEffect(() => {
      if (!isOpen) return;
      const onKey = (ev: KeyboardEvent) => {
        if (ev.key === "Escape") onContinueToWorkspace();
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [isOpen, onContinueToWorkspace]);

    if (!isOpen) return null;

    return (
      <div
        data-testid="smart-task-launcher-modal"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 select-none"
      >
        <div className="max-w-2xl w-full rounded-3xl bg-[#FAF9F6] border border-[#E4DFD5] shadow-2xl p-6 sm:p-8 space-y-6 text-[#141413]">
          <div className="flex items-center justify-between border-b border-[#EAE5DC] pb-4">
            <V3BrandBadge subtitle="Akıllı Görev Akışı" />
            <button
              type="button"
              onClick={onContinueToWorkspace}
              data-testid="smart-launcher-close-btn"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-[#EFECE5] border border-[#DED8CC] text-xs font-semibold text-[#44403C] transition cursor-pointer"
            >
              <span>Çalışma Alanına Geç</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1.5">
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#141413]">
              Ne tasarlamak istersiniz?
            </h2>
            <p className="text-xs sm:text-sm text-[#57534E]">
              Bir seçenekle başlayın. Tüm araçlara daha sonra ulaşabilirsiniz.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <button
              type="button"
              data-testid="smart-launcher-ready-module"
              onClick={onSelectReadyModule}
              className="group p-4 sm:p-5 rounded-2xl bg-white hover:bg-[#141413] hover:text-white border border-[#E4DFD5] hover:border-[#141413] text-left transition-all flex flex-col justify-between gap-4 cursor-pointer shadow-2xs"
            >
              <div className="w-10 h-10 rounded-xl bg-[#F5F3EE] group-hover:bg-white/15 flex items-center justify-center transition">
                <Box className="w-5 h-5 text-[#141413] group-hover:text-[#E5D3B8]" />
              </div>
              <div>
                <div className="text-sm font-bold">Hazır modül</div>
                <div className="text-xs text-[#57534E] group-hover:text-stone-300 mt-0.5">
                  Seç ve özelleştir
                </div>
              </div>
            </button>

            <button
              type="button"
              data-testid="smart-launcher-from-scratch"
              onClick={onSelectDesignFromScratch}
              className="group p-4 sm:p-5 rounded-2xl bg-white hover:bg-[#141413] hover:text-white border border-[#E4DFD5] hover:border-[#141413] text-left transition-all flex flex-col justify-between gap-4 cursor-pointer shadow-2xs"
            >
              <div className="w-10 h-10 rounded-xl bg-[#F5F3EE] group-hover:bg-white/15 flex items-center justify-center transition">
                <Sparkles className="w-5 h-5 text-[#141413] group-hover:text-[#E5D3B8]" />
              </div>
              <div>
                <div className="text-sm font-bold">Sıfırdan tasarla</div>
                <div className="text-xs text-[#57534E] group-hover:text-stone-300 mt-0.5">
                  Kendi modülünü oluştur
                </div>
              </div>
            </button>

            <button
              type="button"
              data-testid="smart-launcher-design-space"
              onClick={onSelectDesignSpace}
              className="group p-4 sm:p-5 rounded-2xl bg-white hover:bg-[#141413] hover:text-white border border-[#E4DFD5] hover:border-[#141413] text-left transition-all flex flex-col justify-between gap-4 cursor-pointer shadow-2xs"
            >
              <div className="w-10 h-10 rounded-xl bg-[#F5F3EE] group-hover:bg-white/15 flex items-center justify-center transition">
                <Compass className="w-5 h-5 text-[#141413] group-hover:text-[#E5D3B8]" />
              </div>
              <div>
                <div className="text-sm font-bold">Mekân tasarla</div>
                <div className="text-xs text-[#57534E] group-hover:text-stone-300 mt-0.5">
                  Oda ve yerleşim
                </div>
              </div>
            </button>

            <button
              type="button"
              data-testid="smart-launcher-open-project"
              onClick={onSelectOpenProject}
              className="group p-4 sm:p-5 rounded-2xl bg-white hover:bg-[#141413] hover:text-white border border-[#E4DFD5] hover:border-[#141413] text-left transition-all flex flex-col justify-between gap-4 cursor-pointer shadow-2xs"
            >
              <div className="w-10 h-10 rounded-xl bg-[#F5F3EE] group-hover:bg-white/15 flex items-center justify-center transition">
                <FolderOpen className="w-5 h-5 text-[#141413] group-hover:text-[#E5D3B8]" />
              </div>
              <div>
                <div className="text-sm font-bold">Projeyi aç</div>
                <div className="text-xs text-[#57534E] group-hover:text-stone-300 mt-0.5">
                  Kaldığın yerden devam et
                </div>
              </div>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[#EAE5DC]">
            <button
              type="button"
              data-testid="smart-launcher-skip-default-toggle"
              onClick={() => onToggleSkipByDefault(!skipByDefault)}
              className="inline-flex items-center gap-2 text-xs text-[#44403C] hover:text-[#141413] cursor-pointer"
            >
              {skipByDefault ? (
                <CheckSquare className="w-4 h-4 text-emerald-700 shrink-0" />
              ) : (
                <Square className="w-4 h-4 text-[#8C7A6B] shrink-0" />
              )}
              <span>Deneyimli kullanıcı modu: Varsayılan olarak doğrudan çalışma alanına geç</span>
            </button>

            <button
              type="button"
              onClick={onContinueToWorkspace}
              className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-[#57534E] hover:text-[#141413] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Kapat (Esc)</span>
            </button>
          </div>
        </div>
      </div>
    );
  }
);
SmartTaskLauncherModal.displayName = "SmartTaskLauncherModal";
