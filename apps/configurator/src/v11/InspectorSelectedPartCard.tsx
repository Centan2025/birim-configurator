"use client";

import React from "react";
import { SlidersHorizontal, ArrowUp, ArrowDown, Lock, Unlock } from "lucide-react";

export interface InspectorSelectedPartCardProps {
  partLabel: string;
  partKind: "shelf" | "drawer" | "rail" | "door" | "sub_divider" | "bay";
  isFixedShelf?: boolean;
  elevationMm?: number;
  displayUnit: "cm" | "mm";
  onShiftElevation?: (deltaMm: number) => void;
  onToggleShelfMount?: () => void;
  onJumpToTab?: (tab: "dimensions" | "interior" | "doors" | "materials") => void;
}

/**
 * Isolated React.memo contextual card pinned at the top of RightParametricInspector
 * whenever the user clicks a specific part in 3D/2D. Eliminates vertical scrolling
 * and prevents unrelated inspector sections from re-rendering during rapid adjustments.
 */
export const InspectorSelectedPartCard: React.FC<InspectorSelectedPartCardProps> = React.memo(
  ({
    partLabel,
    partKind,
    isFixedShelf = false,
    elevationMm,
    displayUnit,
    onShiftElevation,
    onToggleShelfMount,
    onJumpToTab,
  }) => {
    const fmtElev =
      typeof elevationMm === "number"
        ? displayUnit === "cm"
          ? `${Number((elevationMm / 10).toFixed(1))} cm`
          : `${Math.round(elevationMm)} mm`
        : null;

    return (
      <div
        data-testid="v11-inspector-selected-part-card"
        className="mx-4 mt-3 mb-1 p-3 rounded-2xl bg-white border border-[#DFD9CE] shadow-[0_4px_14px_rgba(20,20,19,0.04)] space-y-2 shrink-0"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#8C7A6B] shrink-0" />
            <span className="text-xs font-bold text-[#141413] truncate">{partLabel}</span>
          </div>
          {fmtElev && (
            <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#F3EFE6] text-[#141413] shrink-0">
              Y: {fmtElev}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {partKind === "shelf" && onToggleShelfMount && (
            <button
              type="button"
              onClick={onToggleShelfMount}
              className={`h-7 px-2.5 rounded-lg border text-[11px] font-semibold inline-flex items-center gap-1 transition cursor-pointer ${
                isFixedShelf
                  ? "bg-amber-50 border-amber-300 text-amber-900"
                  : "bg-blue-50 border-blue-300 text-blue-900"
              }`}
            >
              {isFixedShelf ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
              <span>{isFixedShelf ? "Sabit Raf (Serbest)" : "Pimli Raf (32 mm)"}</span>
            </button>
          )}

          {partKind === "shelf" && onShiftElevation && (
            <>
              <button
                type="button"
                onClick={() => onShiftElevation(32)}
                title="32 mm yukarı taşı"
                className="h-7 px-2 rounded-lg bg-[#FAF8F4] hover:bg-[#EFEAE0] border border-[#E5DFD3] text-[11px] font-mono font-semibold inline-flex items-center gap-0.5 cursor-pointer"
              >
                <ArrowUp className="w-3 h-3" />
                <span>32</span>
              </button>
              <button
                type="button"
                onClick={() => onShiftElevation(-32)}
                title="32 mm aşağı taşı"
                className="h-7 px-2 rounded-lg bg-[#FAF8F4] hover:bg-[#EFEAE0] border border-[#E5DFD3] text-[11px] font-mono font-semibold inline-flex items-center gap-0.5 cursor-pointer"
              >
                <ArrowDown className="w-3 h-3" />
                <span>32</span>
              </button>
            </>
          )}

          {onJumpToTab && (
            <button
              type="button"
              onClick={() =>
                onJumpToTab(partKind === "door" ? "doors" : "interior")
              }
              className="ml-auto h-7 px-2.5 rounded-lg bg-[#141413] hover:bg-[#292524] text-white text-[11px] font-semibold transition cursor-pointer"
            >
              {partKind === "door" ? "Kapak Ayarları" : "İç & Donanım"}
            </button>
          )}
        </div>
      </div>
    );
  }
);

InspectorSelectedPartCard.displayName = "InspectorSelectedPartCard";
