"use client";

import React from "react";
import { V3BrandBadge } from "../../design-system";
import { Undo, Sparkles, Box, Layers, LayoutGrid } from "lucide-react";

interface EmptyStageRecoveryCardProps {
  canUndo: boolean;
  onUndo: () => void;
  onCreateDefaultWardrobe: () => void;
  onOpenStepWizard: () => void;
  onLoadKitchen: () => void;
  onApplyWalkIn: () => void;
}

export const EmptyStageRecoveryCard: React.FC<EmptyStageRecoveryCardProps> = ({
  canUndo,
  onUndo,
  onCreateDefaultWardrobe,
  onOpenStepWizard,
  onLoadKitchen,
  onApplyWalkIn,
}) => {
  return (
    <div
      data-testid="v3-unified-root"
      className="flex flex-col items-center justify-center h-screen w-screen bg-[#F5F3EE] text-[#141413] p-6 select-none"
    >
      <div className="max-w-xl w-full birim-ice-popover rounded-3xl p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-[#EFECE5] pb-4">
          <V3BrandBadge subtitle="Konfigüratör" />
          {canUndo && (
            <button
              type="button"
              data-testid="v3-undo-btn"
              onClick={onUndo}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#FAF9F6] hover:bg-[#EFECE5] border border-[#DED8CC] text-xs font-semibold text-[#141413] transition cursor-pointer"
            >
              <Undo className="w-3.5 h-3.5" />
              <span>Son İşlemi Geri Al</span>
            </button>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8C7A6B]">
            Yeni Başlangıç
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[#141413]">
            Nasıl bir mobilya veya mekân tasarlamak istersiniz?
          </h1>
          <p className="text-xs text-[#57534E] leading-relaxed">
            Tek tıkla hazır bir koleksiyon modülüyle başlayabilir veya 4 adımlı görsel kurulum rehberiyle duvar ölçünüze göre otomatik yerleşim oluşturabilirsiniz.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onOpenStepWizard}
            className="p-4 rounded-2xl bg-[#141413] hover:bg-[#292524] text-white text-left transition flex flex-col justify-between gap-3 cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-white/12 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-[#D6C7B2]" />
            </div>
            <div>
              <div className="text-sm font-bold">4 Adımda Kolay Kurulum</div>
              <div className="text-[11px] text-stone-300 mt-0.5">
                Duvar ölçünüzü girin, dolabınız otomatik yerleşsin
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={onCreateDefaultWardrobe}
            className="p-4 rounded-2xl bg-[#FAF9F6] hover:bg-[#EFECE5] border border-[#E4DFD5] text-left transition flex flex-col justify-between gap-3 cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-white border border-[#E4DFD5] flex items-center justify-center">
              <Box className="w-4 h-4 text-[#141413]" />
            </div>
            <div>
              <div className="text-sm font-bold text-[#141413]">Gardırop ile Başla</div>
              <div className="text-[11px] text-[#57534E] mt-0.5">
                Standart çok bölmeli gardırop sahnesi
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={onApplyWalkIn}
            className="p-4 rounded-2xl bg-[#FAF9F6] hover:bg-[#EFECE5] border border-[#E4DFD5] text-left transition flex flex-col justify-between gap-3 cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-white border border-[#E4DFD5] flex items-center justify-center">
              <Layers className="w-4 h-4 text-[#141413]" />
            </div>
            <div>
              <div className="text-sm font-bold text-[#141413]">Giyinme Odası</div>
              <div className="text-[11px] text-[#57534E] mt-0.5">
                Açık modüler askı, raf ve çekmece sistemi
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={onLoadKitchen}
            className="p-4 rounded-2xl bg-[#FAF9F6] hover:bg-[#EFECE5] border border-[#E4DFD5] text-left transition flex flex-col justify-between gap-3 cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-white border border-[#E4DFD5] flex items-center justify-center">
              <LayoutGrid className="w-4 h-4 text-[#141413]" />
            </div>
            <div>
              <div className="text-sm font-bold text-[#141413]">Mutfak Dizilimi</div>
              <div className="text-[11px] text-[#57534E] mt-0.5">
                Alt, üst ve boy dolaplarıyla hazır mutfak hattı
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
