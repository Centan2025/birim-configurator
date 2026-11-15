"use client";

import React, { useEffect } from "react";
import { Undo2, CheckCircle2, AlertTriangle, X } from "lucide-react";
import type { LiveChangeImpactSummary } from "../../../store/useConfiguratorStore";

interface LiveChangeImpactPillProps {
  impact: LiveChangeImpactSummary | null;
  canUndo: boolean;
  onUndo: () => void;
  onDismiss: () => void;
}

/**
 * Canlı Değişiklik Özeti Rozeti.
 * Kullanıcının yaptığı son işlemin parça sayısına, plaka adedine, toplam maliyete
 * ve üretilebilirlik durumuna etkisini anında şeffaf biçimde gösterir.
 */
export const LiveChangeImpactPill: React.FC<LiveChangeImpactPillProps> = React.memo(
  ({ impact, canUndo, onUndo, onDismiss }) => {
    useEffect(() => {
      if (!impact) return;
      const timer = window.setTimeout(() => {
        onDismiss();
      }, 2600);
      return () => window.clearTimeout(timer);
    }, [impact, onDismiss]);

    if (!impact) return null;

    const formatSigned = (n: number, decimals = 0, suffix = "") => {
      const rounded = Number(n.toFixed(decimals));
      if (Math.abs(rounded) < (decimals > 0 ? 0.01 : 1)) return `0${suffix}`;
      return `${rounded > 0 ? "+" : ""}${rounded}${suffix}`;
    };

    const hasSignificantDelta =
      impact.piecesDelta !== 0 ||
      impact.sheetsDelta !== 0 ||
      Math.abs(impact.priceDeltaEur) >= 0.5 ||
      impact.blockingIssueCount > 0;

    if (!hasSignificantDelta) return null;

    return (
      <div
        data-testid="live-change-impact-pill"
        className="fixed bottom-16 left-4 z-20 pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-full birim-ice-popover border border-white/60 shadow-sm text-[11px] text-[#141413] max-w-[420px]"
      >
        {impact.blockingIssueCount > 0 ? (
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        ) : (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-[11px] text-[#141413]">{impact.actionLabel}</span>
          <span className="text-[#8C7A6B]">•</span>
          <span className="text-[11px] font-medium text-[#44403C]">
            Parça: <strong>{impact.totalPieces}</strong> ({formatSigned(impact.piecesDelta)})
          </span>
          <span className="text-[11px] font-medium text-[#44403C]">
            Plaka: <strong>{impact.totalSheets}</strong> ({formatSigned(impact.sheetsDelta)})
          </span>
          <span
            className={`text-[11px] font-bold ${
              impact.priceDeltaEur > 0
                ? "text-amber-800"
                : impact.priceDeltaEur < 0
                ? "text-emerald-800"
                : "text-[#141413]"
            }`}
          >
            {formatSigned(impact.priceDeltaEur, 0, " €")}
          </span>
          {impact.blockingIssueCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-semibold text-[10px]">
              {impact.blockingIssueCount} teknik uyarı
            </span>
          )}
        </div>

        {canUndo && (
          <button
            type="button"
            onClick={onUndo}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#141413] hover:bg-[#292524] text-white text-[10.5px] font-semibold transition cursor-pointer shrink-0"
          >
            <Undo2 className="w-3 h-3" />
            <span>Geri Al</span>
          </button>
        )}

        <button
          type="button"
          onClick={onDismiss}
          aria-label="Özeti kapat"
          className="p-1 rounded-full hover:bg-black/5 text-[#57534E] cursor-pointer shrink-0"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }
);
LiveChangeImpactPill.displayName = "LiveChangeImpactPill";
