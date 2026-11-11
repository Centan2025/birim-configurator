"use client";

import React, { useEffect } from "react";
import { Hand, X, Check } from "lucide-react";

export interface TapToPlaceItemSpec {
  id: string;
  kind:
    | "shelf"
    | "drawer"
    | "internal_drawer"
    | "rail"
    | "sub_divider"
    | "carcass_divider"
    | "trouser_rack"
    | "shoe_rack"
    | "module_template";
  label: string;
  templateId?: string;
}

interface TapToPlaceControllerProps {
  armedItem: TapToPlaceItemSpec | null;
  bayCount: number;
  bayWidthsMm: number[];
  netInnerHeightMm: number;
  onCancel: () => void;
  onPlaceInBay: (
    item: TapToPlaceItemSpec,
    bayIndex: number,
    elevationZone: "low" | "mid" | "high"
  ) => void;
  onAppendModuleTemplate?: (templateId: string) => void;
}

/**
 * Touch-first Tap-to-Place HUD for iPad, mobile phones, and effortless mouse-click placement.
 * Replaces HTML5 drag-and-drop friction on touchscreens with 1-tap compartment & elevation zone targeting.
 */
export const TapToPlaceController: React.FC<TapToPlaceControllerProps> = ({
  armedItem,
  bayCount,
  bayWidthsMm,
  netInnerHeightMm,
  onCancel,
  onPlaceInBay,
  onAppendModuleTemplate,
}) => {
  useEffect(() => {
    if (!armedItem) return;
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [armedItem, onCancel]);

  if (!armedItem) return null;

  const isModuleTemplate = armedItem.kind === "module_template" && Boolean(armedItem.templateId);
  const lowMm = Math.round(Math.min(220, netInnerHeightMm * 0.18));
  const midMm = Math.round(netInnerHeightMm * 0.5);
  const highMm = Math.round(Math.max(400, netInnerHeightMm * 0.82));

  return (
    <div
      data-testid="tap-to-place-hud"
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 w-[min(94vw,580px)] rounded-3xl birim-ice-dark-bar text-white border p-4 space-y-3 select-none"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-8 h-8 rounded-2xl bg-[#8C7A6B]/25 border border-[#8C7A6B]/60 flex items-center justify-center shrink-0">
            <Hand className="w-4 h-4 text-[#E6D5C3]" />
          </span>
          <div className="min-w-0">
            <div className="text-xs font-bold truncate">
              Dokun ve Yerleştir: <span className="text-[#E6D5C3]">{armedItem.label}</span>
            </div>
            <div className="text-[11px] text-stone-300">
              {isModuleTemplate
                ? "Yeni modülü mevcut dolabın yanına eklemek için onaylayın"
                : "Yerleştirmek istediğiniz bölmeye ve yüksekliğe dokunun"}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onCancel}
          aria-label="Yerleştirmeyi İptal Et"
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-stone-200 transition cursor-pointer shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {isModuleTemplate ? (
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => {
              if (armedItem.templateId && onAppendModuleTemplate) {
                onAppendModuleTemplate(armedItem.templateId);
              }
              onCancel();
            }}
            className="min-h-[44px] px-5 py-2.5 rounded-2xl bg-[#E6D5C3] hover:bg-white text-[#141413] text-xs font-bold inline-flex items-center gap-2 transition cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Yanına Ekle</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {Array.from({ length: Math.max(1, bayCount) }, (_, bIdx) => {
            const bw = bayWidthsMm[bIdx] || 0;
            return (
              <div
                key={bIdx}
                className="p-2.5 rounded-2xl bg-white/8 border border-white/12 space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold">{bIdx + 1}. Bölme</span>
                  <span className="font-mono text-[10px] text-stone-300">
                    {Math.round(bw / 10)} cm
                  </span>
                </div>

                {armedItem.kind === "carcass_divider" ? (
                  <button
                    type="button"
                    onClick={() => {
                      onPlaceInBay(armedItem, bIdx, "mid");
                      onCancel();
                    }}
                    className="w-full min-h-[40px] rounded-xl bg-[#E6D5C3] hover:bg-white text-[#141413] text-xs font-bold transition cursor-pointer"
                  >
                    Bu Bölmeyi 2&apos;ye Böl
                  </button>
                ) : (
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      { zone: "low" as const, label: "Alt", mm: lowMm },
                      { zone: "mid" as const, label: "Orta", mm: midMm },
                      { zone: "high" as const, label: "Üst", mm: highMm },
                    ].map((z) => (
                      <button
                        key={z.zone}
                        type="button"
                        onClick={() => {
                          onPlaceInBay(armedItem, bIdx, z.zone);
                          onCancel();
                        }}
                        className="min-h-[42px] px-2 py-1.5 rounded-xl bg-white/12 hover:bg-[#E6D5C3] hover:text-[#141413] text-[11px] font-semibold flex flex-col items-center justify-center transition cursor-pointer"
                      >
                        <span>{z.label}</span>
                        <span className="text-[9px] font-mono opacity-75">
                          {Math.round(z.mm / 10)}cm
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
