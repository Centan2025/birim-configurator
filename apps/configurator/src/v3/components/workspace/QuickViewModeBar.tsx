"use client";

import React from "react";
import type { ToolbarLabelMode, ViewportRenderStyle } from "../../../store/useConfiguratorStore";
import { Box, Grid, Eye, DoorClosed, Layers, Compass, Square, Columns2, Ruler } from "lucide-react";

interface QuickViewModeBarProps {
  studioView: "3d" | "2d";
  studio2DMode: "elevation" | "section" | "plan";
  viewportRenderStyle: ViewportRenderStyle;
  toolbarLabelMode: ToolbarLabelMode;
  showDimensions: boolean;
  onSelect3DStyle: (style: ViewportRenderStyle) => void;
  onSelect2DView: (mode2d: "plan" | "elevation" | "section") => void;
  onSelectCameraView: (preset: "front" | "side" | "iso") => void;
  onToggleDimensions: () => void;
}

/**
 * Sıfır WebGL Sıfırlamalı Hızlı Çalışma Görünümleri Çubuğu (Bölüm 9).
 * 3D Katı Model, Tel Kafes, Şeffaf Görünüm, Kapaksız Gövde, Patlatılmış Görünüm,
 * 2D Plan, Ön Görünüş, Yan Görünüş ve Teknik Ölçülendirme arasında anında geçiş sağlar.
 */
export const QuickViewModeBar: React.FC<QuickViewModeBarProps> = React.memo(
  ({
    studioView,
    studio2DMode,
    viewportRenderStyle,
    toolbarLabelMode,
    showDimensions,
    onSelect3DStyle,
    onSelect2DView,
    onSelectCameraView,
    onToggleDimensions,
  }) => {
    const showText = toolbarLabelMode === "labeled";

    const items3D: {
      id: ViewportRenderStyle;
      label: string;
      icon: React.ComponentType<{ className?: string }>;
    }[] = [
      { id: "solid", label: "3D Katı", icon: Box },
      { id: "wireframe", label: "Tel Kafes", icon: Grid },
      { id: "transparent", label: "Şeffaf", icon: Eye },
      { id: "carcass_only", label: "Kapaksız Gövde", icon: DoorClosed },
      { id: "exploded", label: "Patlatılmış", icon: Layers },
    ];

    return (
      <div
        data-testid="quick-view-mode-bar"
        className="pointer-events-auto inline-flex items-center gap-1 p-1 rounded-2xl birim-ice-pill shadow-sm max-w-[95vw] overflow-x-auto"
      >
        {items3D.map((item) => {
          const Icon = item.icon;
          const active = studioView === "3d" && viewportRenderStyle === item.id;
          return (
            <button
              key={item.id}
              type="button"
              data-testid={`view-style-${item.id}`}
              title={item.label}
              onClick={() => onSelect3DStyle(item.id)}
              className={`h-7 px-2 rounded-xl inline-flex items-center gap-1.5 text-[11px] font-semibold transition cursor-pointer shrink-0 ${
                active
                  ? "bg-[#141413] text-white"
                  : "text-[#44403C] hover:bg-white/70 hover:text-[#141413]"
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              {showText && <span>{item.label}</span>}
            </button>
          );
        })}

        <div className="h-4 w-px bg-black/10 mx-0.5 shrink-0" />

        <button
          type="button"
          data-testid="view-mode-2d-plan"
          title="2D Plan Görünümü"
          onClick={() => onSelect2DView("plan")}
          className={`h-7 px-2 rounded-xl inline-flex items-center gap-1.5 text-[11px] font-semibold transition cursor-pointer shrink-0 ${
            studioView === "2d" && studio2DMode === "plan"
              ? "bg-[#141413] text-white"
              : "text-[#44403C] hover:bg-white/70 hover:text-[#141413]"
          }`}
        >
          <Compass className="w-3.5 h-3.5 shrink-0" />
          {showText && <span>2D Plan</span>}
        </button>

        <button
          type="button"
          data-testid="view-mode-front"
          title="Ön Görünüş (Cephe)"
          onClick={() => {
            onSelectCameraView("front");
            onSelect2DView("elevation");
          }}
          className={`h-7 px-2 rounded-xl inline-flex items-center gap-1.5 text-[11px] font-semibold transition cursor-pointer shrink-0 ${
            studioView === "2d" && studio2DMode === "elevation"
              ? "bg-[#141413] text-white"
              : "text-[#44403C] hover:bg-white/70 hover:text-[#141413]"
          }`}
        >
          <Square className="w-3.5 h-3.5 shrink-0" />
          {showText && <span>Ön Görünüş</span>}
        </button>

        <button
          type="button"
          data-testid="view-mode-side"
          title="Yan Görünüş (Kesit)"
          onClick={() => {
            onSelectCameraView("side");
            onSelect2DView("section");
          }}
          className={`h-7 px-2 rounded-xl inline-flex items-center gap-1.5 text-[11px] font-semibold transition cursor-pointer shrink-0 ${
            studioView === "2d" && studio2DMode === "section"
              ? "bg-[#141413] text-white"
              : "text-[#44403C] hover:bg-white/70 hover:text-[#141413]"
          }`}
        >
          <Columns2 className="w-3.5 h-3.5 shrink-0" />
          {showText && <span>Yan Görünüş</span>}
        </button>

        <button
          type="button"
          data-testid="view-mode-tech-dimensions"
          title="Teknik Ölçülendirme"
          onClick={onToggleDimensions}
          className={`h-7 px-2 rounded-xl inline-flex items-center gap-1.5 text-[11px] font-semibold transition cursor-pointer shrink-0 ${
            showDimensions
              ? "bg-emerald-800 text-white"
              : "text-[#44403C] hover:bg-white/70 hover:text-[#141413]"
          }`}
        >
          <Ruler className="w-3.5 h-3.5 shrink-0" />
          {showText && <span>Teknik Ölçü</span>}
        </button>
      </div>
    );
  }
);
QuickViewModeBar.displayName = "QuickViewModeBar";
