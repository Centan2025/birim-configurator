"use client";

import React from "react";
import { calculateNetInnerHeight } from "@birim/core";
import type { ArchitecturalElement, DesignProject, ModuleInstance } from "@birim/core";
import { getBayShelfIntervalsForSubDivider } from "../../adapter/useV3Adapter";
import { CeilingAndEngineeringQuickPopover } from "./CeilingAndGrain2DOverlays";
import {
  type ElevationDetailLevel,
  type ElevationDisplayUnit,
  type ElevationSelectedContext,
  formatElevationValue,
  toCanonicalMm,
  toDisplayUnitNumber,
} from "./elevation2dHelpers";

interface ElevationTopBarProps {
  project: DesignProject;
  activeModule: ModuleInstance;
  activeModuleIndex: number;
  hasSceneModules: boolean;
  spaceWallsLength: number;
  detailLevel: ElevationDetailLevel;
  onChangeDetailLevel: (level: ElevationDetailLevel) => void;
  displayUnit: ElevationDisplayUnit;
  onChangeDisplayUnit: (unit: ElevationDisplayUnit) => void;
  interiorMoveMode: boolean;
  onToggleInteriorMoveMode: () => void;
  elevPanMode: boolean;
  onToggleElevPanMode?: () => void;
  showRoomContextInElev: boolean;
  onToggleRoomContext: () => void;
  showDoorsIn2D: boolean;
  onToggleDoorsIn2D: () => void;
  showAllDimensions?: boolean;
  onToggleShowAllDimensions?: () => void;
  coordMode?: "global" | "local";
  onChangeCoordMode?: (mode: "global" | "local") => void;
  selectedObstacle: ArchitecturalElement | null;
  onUpdateObstacle: (id: string, patch: Partial<ArchitecturalElement>) => void;
  onUpdateObstaclePosition: (id: string, x: number) => void;
  onRemoveObstacle: (id: string) => void;
  onSwapModule: (idx: number, dir: "left" | "right") => void;
  onSetModulePosition: (idx: number, x: number, z: number, wallId: number, y: number) => void;
  onUpdateCeiling: (patch: Partial<NonNullable<DesignProject["space"]["ceilingConfig"]>>) => void;
  onUpdateCeilingHeightMm: (h: number) => void;
  onUpdateCarcass: (patch: Partial<ModuleInstance["carcass"]>) => void;
  onSetFacadeGrainContinuity: (mode: NonNullable<DesignProject["facadeGrainContinuity"]>) => void;
}

export const ElevationTopBar: React.FC<ElevationTopBarProps> = ({
  project,
  activeModule,
  activeModuleIndex,
  hasSceneModules,
  spaceWallsLength,
  detailLevel,
  onChangeDetailLevel,
  displayUnit,
  onChangeDisplayUnit,
  interiorMoveMode,
  onToggleInteriorMoveMode,
  elevPanMode,
  onToggleElevPanMode,
  showRoomContextInElev,
  onToggleRoomContext,
  showDoorsIn2D,
  onToggleDoorsIn2D,
  showAllDimensions = false,
  onToggleShowAllDimensions,
  coordMode = "global",
  onChangeCoordMode,
  selectedObstacle,
  onUpdateObstacle,
  onUpdateObstaclePosition,
  onRemoveObstacle,
  onSwapModule,
  onSetModulePosition,
  onUpdateCeiling,
  onUpdateCeilingHeightMm,
  onUpdateCarcass,
  onSetFacadeGrainContinuity,
}) => {
  const modeBadge = elevPanMode
    ? { label: "Kaydır", cls: "bg-[#1C1917] text-[#FAF9F6] border-[#1C1917]" }
    : interiorMoveMode
    ? { label: "İç Parça Taşıma", cls: "bg-[#1C1917] text-[#FAF9F6] border-[#1C1917]" }
    : { label: "Seçim & Düzenleme", cls: "bg-[#F2EDE3] text-[#44403C] border-[#E6E0D3] hover:bg-[#EAE3D6]" };

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {/* Sol Grup: Etkileşim Modu (Seçim/İç Taşıma + Kaydır/Pan) */}
      <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-black/35 border border-white/[0.12]">
        <button
          type="button"
          data-testid="elev-interior-move-mode-btn"
          onClick={() => {
            if (elevPanMode && onToggleElevPanMode) onToggleElevPanMode();
            onToggleInteriorMoveMode();
          }}
          title="İç Parça Taşıma Modu (Kısayol: Ctrl basılı tutun)"
          className={`h-7 px-2.5 rounded-full text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 whitespace-nowrap ${
            !elevPanMode
              ? interiorMoveMode
                ? "bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] text-white shadow-[0_0_14px_rgba(29,78,216,0.48)]"
                : "bg-white/[0.14] text-white border border-white/[0.16]"
              : "text-slate-300 hover:text-white"
          }`}
        >
          <span>{interiorMoveMode ? "↕" : "⌖"}</span>
          <span>{interiorMoveMode ? "İç Parça Taşıma" : "Seçim & Düzenleme"}</span>
        </button>
        {onToggleElevPanMode && (
          <button
            type="button"
            data-testid="elev-pan-mode-toggle"
            onClick={onToggleElevPanMode}
            title="Çalışma Alanını Sürükle (Pan Modu)"
            className={`h-7 px-2.5 rounded-full text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 whitespace-nowrap ${
              elevPanMode
                ? "bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] text-white shadow-[0_0_14px_rgba(29,78,216,0.48)]"
                : "text-slate-300 hover:text-white"
            }`}
          >
            <span>🖐️</span>
            <span className="hidden sm:inline">Kaydır</span>
          </button>
        )}
      </div>

      <span className="h-4 w-px bg-white/[0.14] mx-0.5 hidden sm:inline-block" />

      {/* Orta & Sağ Grup: Modül Sırası, Kot, Tavan/Delik, Görünüm Seviyesi & Birim */}
      <div className="flex items-center gap-1.5 shrink-0">
        {selectedObstacle && (
          <div
            data-testid="elev-selected-obstacle-controls"
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-sky-900 text-white text-[11px] font-semibold"
          >
            <span>🎯 {selectedObstacle.name}:</span>
            <button
              type="button"
              onClick={() =>
                onUpdateObstacle(selectedObstacle.id, {
                  rotationY: ((selectedObstacle.rotationY || 0) + 90) % 360,
                })
              }
              className="px-1.5 py-0.5 rounded bg-amber-700 hover:bg-amber-700 text-white font-bold cursor-pointer"
              title="90° Döndür"
            >
              🔄 {selectedObstacle.rotationY || 0}°
            </button>
            <label className="flex items-center gap-0.5">
              <span>Genişlik:</span>
              <input
                type="number" inputMode="decimal"
                step={50}
                value={selectedObstacle.dimensions.width}
                onChange={(e) =>
                  onUpdateObstacle(selectedObstacle.id, {
                    dimensions: {
                      ...selectedObstacle.dimensions,
                      width: Math.max(100, Number(e.target.value) || 300),
                    },
                  })
                }
                className="w-12 px-1 py-0.5 rounded bg-white text-stone-900 font-mono text-[11px]"
              />
            </label>
            <label className="flex items-center gap-0.5">
              <span>Yükseklik:</span>
              <input
                type="number" inputMode="decimal"
                step={50}
                value={selectedObstacle.dimensions.height}
                onChange={(e) =>
                  onUpdateObstacle(selectedObstacle.id, {
                    dimensions: {
                      ...selectedObstacle.dimensions,
                      height: Math.max(100, Number(e.target.value) || 300),
                    },
                  })
                }
                className="w-12 px-1 py-0.5 rounded bg-white text-stone-900 font-mono text-[11px]"
              />
            </label>
            <label className="flex items-center gap-0.5">
              <span>Yerden Kot:</span>
              <input
                type="number" inputMode="decimal"
                step={50}
                value={selectedObstacle.position.y}
                onChange={(e) =>
                  onUpdateObstacle(selectedObstacle.id, {
                    position: {
                      ...selectedObstacle.position,
                      y: Math.max(0, Number(e.target.value) || 0),
                    },
                  })
                }
                className="w-12 px-1 py-0.5 rounded bg-white text-stone-900 font-mono text-[11px]"
              />
            </label>
            <label className="flex items-center gap-0.5">
              <span>Sol Duvara Mesafe:</span>
              <input
                type="number" inputMode="decimal"
                step={50}
                value={selectedObstacle.position.x}
                onChange={(e) =>
                  onUpdateObstaclePosition(selectedObstacle.id, Number(e.target.value) || 0)
                }
                className="w-12 px-1 py-0.5 rounded bg-white text-stone-900 font-mono text-[11px]"
              />
            </label>
            <button
              type="button"
              onClick={() => onRemoveObstacle(selectedObstacle.id)}
              className="px-1.5 py-0.5 rounded bg-red-600 hover:bg-red-700 text-white font-bold cursor-pointer"
            >
              🗑
            </button>
          </div>
        )}

        {/* Grup 1: Modül Sıra & Kot */}
        {project.modules.length > 1 && (
          <div className="flex items-center gap-0.5 bg-black/35 px-1.5 py-0.5 rounded-full border border-white/[0.12] text-[11px]">
            <span className="font-semibold text-slate-300 mr-0.5">Sıra:</span>
            <button
              type="button"
              data-testid="elev-swap-mod-left-btn"
              onClick={() => onSwapModule(activeModuleIndex, "left")}
              className="px-1.5 py-0.5 rounded-full bg-white/[0.10] hover:bg-white/[0.22] text-white font-bold cursor-pointer transition"
              title="Seçili modülü solundaki modülle yer değiştir"
            >
              ⇤
            </button>
            <button
              type="button"
              data-testid="elev-swap-mod-right-btn"
              onClick={() => onSwapModule(activeModuleIndex, "right")}
              className="px-1.5 py-0.5 rounded-full bg-white/[0.10] hover:bg-white/[0.22] text-white font-bold cursor-pointer transition"
              title="Seçili modülü sağındaki modülle yer değiştir"
            >
              ⇥
            </button>
          </div>
        )}

        {hasSceneModules && (
          <div className="flex items-center gap-1 bg-black/35 px-2.5 py-0.5 rounded-full border border-white/[0.12] text-[11px] h-8">
            <span className="font-semibold text-slate-300">Kot:</span>
            <input
              type="number" inputMode="decimal"
              step={displayUnit === "cm" ? 5 : 50}
              value={toDisplayUnitNumber(activeModule.position.y, displayUnit)}
              onChange={(e) => {
                const newY = Math.max(0, toCanonicalMm(Number(e.target.value) || 0, displayUnit));
                onSetModulePosition(
                  activeModuleIndex,
                  activeModule.position.x,
                  activeModule.position.z,
                  1,
                  newY
                );
              }}
              className="w-12 px-1.5 py-0.5 rounded-full bg-white/[0.10] border border-white/[0.16] text-white font-mono text-[11px] font-bold text-center focus:outline-none focus:border-sky-400"
            />
            <span className="text-[10px] text-slate-400 font-mono">{displayUnit}</span>
            {activeModule.position.y > 0 && (
              <button
                type="button"
                data-testid="elev-drop-to-floor-btn"
                onClick={() =>
                  onSetModulePosition(
                    activeModuleIndex,
                    activeModule.position.x,
                    activeModule.position.z,
                    1,
                    0
                  )
                }
                className="px-2 py-0.5 rounded-full bg-white/[0.10] hover:bg-white/[0.20] text-slate-100 border border-white/[0.14] text-[10px] font-semibold cursor-pointer transition"
                title="Zemine İndir (Kot Y = 0)"
              >
                ⬇ Zemine
              </button>
            )}
          </div>
        )}

        {/* Grup 2: Tavan & Delik */}
        {activeModule && (
          <CeilingAndEngineeringQuickPopover
            project={project}
            activeModule={activeModule}
            surface="2d_elevation"
            onUpdateCeiling={onUpdateCeiling}
            onUpdateCeilingHeightMm={onUpdateCeilingHeightMm}
            onUpdateCarcass={onUpdateCarcass}
            onSetFacadeGrainContinuity={onSetFacadeGrainContinuity}
          />
        )}

        {/* 1+3 Hibrit Kot Görünürlüğü (Kısayol: T) */}
        {onToggleShowAllDimensions && (
          <button
            type="button"
            data-testid="elev-toggle-all-dimensions-btn"
            onClick={onToggleShowAllDimensions}
            title="Tüm Menteşe ve Raf Kotlarını Göster / Gizle (Kısayol: T)"
            className={`h-7 px-2.5 rounded-full text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 border whitespace-nowrap ${
              showAllDimensions
                ? "bg-sky-600 text-white border-sky-400/60 shadow-[0_0_12px_rgba(2,132,199,0.45)]"
                : "bg-black/35 text-slate-200 border-white/[0.12] hover:bg-white/[0.14]"
            }`}
          >
            <span>📏</span>
            <span>{showAllDimensions ? "Kotlar Açık" : "Kotlar"}</span>
            <kbd className="px-1 py-0.2 rounded bg-black/30 text-[9.5px] font-mono opacity-80">T</kbd>
          </button>
        )}
        {onChangeCoordMode && (
          <div
            data-testid="elev-coord-mode-switcher"
            title="Menteşe kot referansı: Global Y (Baza üstü 0 mm) veya Kapak İçi Lokal Y"
            className="inline-flex items-center p-0.5 rounded-full bg-black/35 border border-white/[0.12] text-[10.5px] font-medium shrink-0"
          >
            <button
              type="button"
              onClick={() => onChangeCoordMode("global")}
              className={`h-6 px-2 rounded-full transition cursor-pointer whitespace-nowrap ${
                coordMode === "global"
                  ? "bg-sky-600 text-white font-semibold shadow-xs"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              Global Y
            </button>
            <button
              type="button"
              onClick={() => onChangeCoordMode("local")}
              className={`h-6 px-2 rounded-full transition cursor-pointer whitespace-nowrap ${
                coordMode === "local"
                  ? "bg-amber-700 text-white font-semibold shadow-xs"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              Kapak İçi
            </button>
          </div>
        )}

        {/* Grup 3: 3 Seviyeli Görünüm Sistemi */}
        <div
          data-testid="elev-detail-level-switcher"
          className="inline-flex items-center rounded-full bg-black/35 p-0.5 border border-white/[0.12] text-[11px]"
          title="2D Cephe Detay Seviyesi"
        >
          {(
            [
              { id: "clean", label: "Sade" },
              { id: "selected", label: "Seçili" },
              { id: "technical", label: "Teknik" },
            ] as const
          ).map((lvl) => (
            <button
              key={lvl.id}
              type="button"
              data-testid={`elev-detail-${lvl.id}-btn`}
              onClick={() => onChangeDetailLevel(lvl.id)}
              className={`h-7 px-2.5 rounded-full font-semibold transition cursor-pointer ${
                detailLevel === lvl.id
                  ? "bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] text-white shadow-[0_0_12px_rgba(29,78,216,0.48)]"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              {lvl.label}
            </button>
          ))}
        </div>

        {/* Grup 4: Ölçü Birimi (mm / cm) */}
        <div
          data-testid="elev-unit-switcher"
          className="inline-flex items-center rounded-full bg-black/35 p-0.5 border border-white/[0.12] text-[11px]"
          title="Gösterim Ölçü Birimi (BOM ve üretim verisi her zaman mm kalır)"
        >
          {(["mm", "cm"] as const).map((u) => (
            <button
              key={u}
              type="button"
              data-testid={`elev-unit-${u}-btn`}
              onClick={() => onChangeDisplayUnit(u)}
              className={`h-7 px-2 py-0.5 rounded-full font-mono font-semibold transition cursor-pointer ${
                displayUnit === u
                  ? "bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] text-white shadow-[0_0_12px_rgba(29,78,216,0.48)]"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              {u}
            </button>
          ))}
        </div>

        {/* Grup 5: Oda Bağlamı & Kapak Çizgisi */}
        <button
          type="button"
          data-testid="cad-elevation-toggle-room"
          onClick={onToggleRoomContext}
          className={`h-8 px-2.5 rounded-full text-[11px] font-semibold flex items-center gap-1 border transition cursor-pointer ${
            showRoomContextInElev
              ? "bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] text-white border-sky-400/50 shadow-[0_0_12px_rgba(29,78,216,0.45)]"
              : "bg-white/[0.08] hover:bg-white/[0.16] text-slate-200 border-white/[0.12]"
          }`}
          title={
            showRoomContextInElev
              ? "Tüm Modüller & Duvar Gösteriliyor (Tek Modüle Geç)"
              : "Tek Modül Odağı (Tüm Duvarı Göster)"
          }
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M3 10h18M9 4v6M15 10v10" />
          </svg>
          <span>Duvar</span>
        </button>
        <button
          type="button"
          data-testid="cad-elevation-toggle-doors"
          onClick={onToggleDoorsIn2D}
          title={showDoorsIn2D ? "Kapak Çizgisini Gizle (İç Düzeni Gör)" : "Kapak Çizgisini Göster"}
          className={`h-8 px-2.5 rounded-full text-[11px] font-semibold flex items-center gap-1 border transition cursor-pointer ${
            showDoorsIn2D
              ? "bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] text-white border-sky-400/50 shadow-[0_0_12px_rgba(29,78,216,0.45)]"
              : "bg-white/[0.08] hover:bg-white/[0.16] text-slate-200 border-white/[0.12]"
          }`}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="5" y="3" width="14" height="18" rx="1.5" />
            <circle cx="15.5" cy="12" r="1" fill="currentColor" />
          </svg>
          <span>Kapak</span>
        </button>
      </div>
    </div>
  );
};

interface ElevationContextualPanelProps {
  activeModule?: ModuleInstance;
  context: ElevationSelectedContext | null;
  displayUnit: ElevationDisplayUnit;
  topOffsetPx: number;
  rightOffsetPx: number;
  onCloseSelection: () => void;
  onDeleteSelected: () => void;
  onSetShelfElevation: (bayIdx: number, id: string, elevY: number) => void;
  onSetDrawerPlacement: (bayIdx: number, id: string, elevY?: number, height?: number) => void;
  onSetHangingRailElevation: (bayIdx: number, id: string, elevY: number) => void;
  onSetSpecialFittingPlacement: (bayIdx: number, id: string, patch: { elevationY?: number }) => void;
  onSetSubDividerPlacement?: (
    bayIdx: number,
    id: string,
    updates: { offsetX?: number; elevationY?: number; height?: number; targetMidY?: number }
  ) => void;
  onResizeModule: (modIdx: number, w: number, h: number, d: number) => void;
  onSetModulePosition: (modIdx: number, x: number, z: number, wallId: number, y: number) => void;
}

export const ElevationContextualPanel: React.FC<ElevationContextualPanelProps> = ({
  activeModule,
  context,
  displayUnit,
  topOffsetPx,
  rightOffsetPx,
  onCloseSelection,
  onDeleteSelected,
  onSetShelfElevation,
  onSetDrawerPlacement,
  onSetHangingRailElevation,
  onSetSpecialFittingPlacement,
  onSetSubDividerPlacement,
  onResizeModule,
  onSetModulePosition,
}) => {
  if (!context || context.kind === "module") return null;

  const unitStep = displayUnit === "cm" ? 1 : 10;

  return (
    <div
      data-testid="elev-contextual-inspector"
      style={{
        top: `${Math.max(128, topOffsetPx)}px`,
        right: `${Math.max(rightOffsetPx, 416)}px`,
      }}
      className="fixed z-[38] w-[248px] birim-stretch-pop-in rounded-2xl bg-white/95 backdrop-blur-2xl border border-sky-400/45 shadow-2xl p-3 text-xs text-stone-900 space-y-2.5"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
            #{context.moduleIndex + 1} · {context.moduleName}
          </div>
          <div className="font-extrabold text-sm text-stone-900 truncate">{context.title}</div>
          <div className="text-[11px] text-stone-500 truncate">{context.subtitle}</div>
        </div>
        <button
          type="button"
          onClick={onCloseSelection}
          title="Seçimi Temizle"
          className="px-1.5 py-0.5 rounded-md bg-stone-100 hover:bg-stone-200 text-stone-600 font-bold cursor-pointer"
        >
          ✕
        </button>
      </div>

      <div className="flex items-center justify-between text-[11px] bg-slate-50 px-2 py-1 rounded-lg border border-slate-200 font-mono">
        <span className="text-stone-500">Ölçü:</span>
        <span className="font-bold">
          {formatElevationValue(context.widthMm, displayUnit, false)} ×{" "}
          {formatElevationValue(context.heightMm, displayUnit, false)} {displayUnit}
        </span>
      </div>

      {/* Raf Kontrolleri */}
      {context.kind === "shelf" &&
        context.bayIndex !== undefined &&
        context.targetId &&
        context.elevationYMm !== undefined && (
          <div className="space-y-1.5">
            <label className="flex items-center justify-between gap-2">
              <span className="font-semibold text-stone-700">Kot (Y):</span>
              <div className="flex items-center gap-1">
                <input
                  type="number" inputMode="decimal"
                  step={unitStep}
                  value={toDisplayUnitNumber(context.elevationYMm, displayUnit)}
                  onChange={(e) =>
                    onSetShelfElevation(
                      context.bayIndex!,
                      context.targetId!,
                      Math.max(32, toCanonicalMm(Number(e.target.value) || 0, displayUnit))
                    )
                  }
                  className="w-16 px-1.5 py-0.5 rounded border border-blue-300 font-mono font-bold text-right"
                />
                <span className="text-[10px] text-stone-500">{displayUnit}</span>
              </div>
            </label>
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() =>
                  onSetShelfElevation(
                    context.bayIndex!,
                    context.targetId!,
                    Math.max(32, context.elevationYMm! - 32)
                  )
                }
                className="py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 font-mono font-bold border border-blue-200 cursor-pointer"
              >
                −32mm
              </button>
              <button
                type="button"
                onClick={() =>
                  onSetShelfElevation(
                    context.bayIndex!,
                    context.targetId!,
                    context.elevationYMm! + 32
                  )
                }
                className="py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 font-mono font-bold border border-blue-200 cursor-pointer"
              >
                +32mm
              </button>
            </div>
          </div>
        )}

      {/* Çekmece Kontrolleri */}
      {context.kind === "drawer" &&
        context.bayIndex !== undefined &&
        context.targetId &&
        context.elevationYMm !== undefined && (
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold text-stone-700">Kapak Yüksekliği:</div>
            <div className="grid grid-cols-4 gap-1">
              {[140, 180, 240, 300].map((presetH) => (
                <button
                  key={presetH}
                  type="button"
                  onClick={() =>
                    onSetDrawerPlacement(context.bayIndex!, context.targetId!, undefined, presetH)
                  }
                  className={`py-1 rounded-md font-mono text-[10px] font-bold cursor-pointer border ${
                    context.heightMm === presetH
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white hover:bg-blue-50 text-stone-800 border-stone-300"
                  }`}
                >
                  {formatElevationValue(presetH, displayUnit, false)}
                </button>
              ))}
            </div>
            <label className="flex items-center justify-between gap-2">
              <span className="font-semibold text-stone-700">Kot (Y):</span>
              <div className="flex items-center gap-1">
                <input
                  type="number" inputMode="decimal"
                  step={unitStep}
                  value={toDisplayUnitNumber(context.elevationYMm, displayUnit)}
                  onChange={(e) =>
                    onSetDrawerPlacement(
                      context.bayIndex!,
                      context.targetId!,
                      Math.max(0, toCanonicalMm(Number(e.target.value) || 0, displayUnit))
                    )
                  }
                  className="w-16 px-1.5 py-0.5 rounded border border-blue-300 font-mono font-bold text-right"
                />
                <span className="text-[10px] text-stone-500">{displayUnit}</span>
              </div>
            </label>
          </div>
        )}

      {/* Askılık Kontrolleri */}
      {context.kind === "rail" &&
        context.bayIndex !== undefined &&
        context.targetId &&
        context.elevationYMm !== undefined && (
          <label className="flex items-center justify-between gap-2">
            <span className="font-semibold text-stone-700">Askı Kotu (Y):</span>
            <div className="flex items-center gap-1">
              <input
                type="number" inputMode="decimal"
                step={unitStep}
                value={toDisplayUnitNumber(context.elevationYMm, displayUnit)}
                onChange={(e) =>
                  onSetHangingRailElevation(
                    context.bayIndex!,
                    context.targetId!,
                    Math.max(200, toCanonicalMm(Number(e.target.value) || 0, displayUnit))
                  )
                }
                className="w-16 px-1.5 py-0.5 rounded border border-blue-300 font-mono font-bold text-right"
              />
              <span className="text-[10px] text-stone-500">{displayUnit}</span>
            </div>
          </label>
        )}

      {/* Özel Donanım Kontrolleri */}
      {context.kind === "special_fitting" &&
        context.bayIndex !== undefined &&
        context.targetId &&
        context.elevationYMm !== undefined && (
          <label className="flex items-center justify-between gap-2">
            <span className="font-semibold text-stone-700">Donanım Yüksekliği:</span>
            <div className="flex items-center gap-1">
              <input
                type="number" inputMode="decimal"
                step={unitStep}
                value={toDisplayUnitNumber(context.elevationYMm, displayUnit)}
                onChange={(e) =>
                  onSetSpecialFittingPlacement(context.bayIndex!, context.targetId!, {
                    elevationY: Math.max(0, toCanonicalMm(Number(e.target.value) || 0, displayUnit)),
                  })
                }
                className="w-16 px-1.5 py-0.5 rounded border border-blue-300 font-mono font-bold text-right"
              />
              <span className="text-[10px] text-stone-500">{displayUnit}</span>
            </div>
          </label>
        )}

      {/* Raf Arası Dikme Kontrolleri (İstenilen Raf Aralığına Taşıma + Ofset X) */}
      {context.kind === "sub_divider" &&
        activeModule &&
        context.bayIndex !== undefined &&
        context.targetId &&
        onSetSubDividerPlacement && (() => {
          const bayObj = activeModule.bays[context.bayIndex];
          const pT = activeModule.carcass.panelThickness || 18;
          const ivs = bayObj
            ? getBayShelfIntervalsForSubDivider(bayObj, calculateNetInnerHeight(activeModule), pT)
            : [];
          const sdObj = bayObj?.subDividers?.find((s) => s.id === context.targetId);
          return (
            <div className="space-y-1.5">
              {ivs.length > 0 && (
                <label className="block space-y-1">
                  <span className="text-[11px] font-semibold text-stone-700">Bulunduğu Raf Aralığı:</span>
                  <select
                    value={Math.max(
                      0,
                      ivs.findIndex(
                        (iv) =>
                          sdObj &&
                          (Math.abs(iv.botY - sdObj.elevationY) <= 22 ||
                            (sdObj.elevationY + sdObj.height / 2 >= iv.botY &&
                              sdObj.elevationY + sdObj.height / 2 <= iv.topY))
                      )
                    )}
                    onChange={(e) => {
                      const targetIv = ivs[Number(e.target.value)];
                      if (targetIv) {
                        onSetSubDividerPlacement(context.bayIndex!, context.targetId!, {
                          elevationY: targetIv.botY,
                          height: targetIv.height,
                          targetMidY: Math.round((targetIv.botY + targetIv.topY) / 2),
                        });
                      }
                    }}
                    className="w-full px-2 py-1 rounded border border-stone-300 bg-white text-[11px] font-semibold"
                  >
                    {ivs.map((iv, idx) => (
                      <option key={idx} value={idx}>
                        {iv.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {sdObj && (
                <label className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-stone-700">Bölme Solundan Mesafe:</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number" inputMode="decimal"
                      step={unitStep}
                      value={toDisplayUnitNumber(sdObj.offsetX, displayUnit)}
                      onChange={(e) =>
                        onSetSubDividerPlacement(context.bayIndex!, context.targetId!, {
                          offsetX: Math.max(40, toCanonicalMm(Number(e.target.value) || 40, displayUnit)),
                        })
                      }
                      className="w-16 px-1.5 py-0.5 rounded border border-blue-300 font-mono font-bold text-right"
                    />
                    <span className="text-[10px] text-stone-500">{displayUnit}</span>
                  </div>
                </label>
              )}
            </div>
          );
        })()}

      {/* Blum / Menteşe Bilgi Kartı */}
      {context.kind === "hinge" && (
        <div className="text-[11px] bg-sky-50 border border-sky-200 rounded-lg p-2 text-sky-900 space-y-0.5">
          <div className="font-bold">🔩 {context.hardwareBrand} Menteşe Konumu</div>
          {context.elevationYMm !== undefined && (
            <div className="font-mono">
              Eksen Kotu: {formatElevationValue(context.elevationYMm, displayUnit)}
            </div>
          )}
          <div className="text-[10px] text-sky-700">
            Menteşe konumu kapak/sistem kuralından otomatik hesaplanır.
          </div>
        </div>
      )}

      {/* Hızlı İşlemler */}
      {context.canDelete && (
        <div className="pt-1 border-t border-stone-200 flex justify-end">
          <button
            type="button"
            data-testid="elev-contextual-delete-btn"
            onClick={onDeleteSelected}
            className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-[11px] cursor-pointer"
          >
            🗑 Parçayı Sil
          </button>
        </div>
      )}
    </div>
  );
};

interface ElevationBottomBarProps {
  activeModule: ModuleInstance;
  activeModuleIndex: number;
  selectedContext: ElevationSelectedContext | null;
  displayUnit: ElevationDisplayUnit;
  statusText: string;
  statusTone: "neutral" | "blue" | "orange" | "green" | "red";
  studioSafeInsets?: {
    topPx?: number;
    leftPx?: number;
    rightPx?: number;
    bottomPx?: number;
  };
  onSetModuleOffsetFromLeftWall: (modId: string, xMm: number) => void;
  onResizeModuleWidth: (widthMm: number) => void;
}

export const ElevationBottomBar: React.FC<ElevationBottomBarProps> = ({
  activeModule,
  activeModuleIndex,
  selectedContext,
  displayUnit,
  statusText,
  statusTone,
  studioSafeInsets,
  onSetModuleOffsetFromLeftWall,
  onResizeModuleWidth,
}) => {
  const toneCls =
    statusTone === "orange"
      ? "bg-amber-500/20 text-amber-200 border-amber-400/40"
      : statusTone === "green"
      ? "bg-emerald-500/20 text-emerald-200 border-emerald-400/40"
      : statusTone === "red"
      ? "bg-red-500/20 text-red-200 border-red-400/40"
      : statusTone === "blue"
      ? "bg-sky-500/20 text-sky-200 border-sky-400/40"
      : "bg-white/[0.08] text-slate-200 border-white/[0.16]";

  const selectedLabel =
    selectedContext && selectedContext.kind !== "module"
      ? `${selectedContext.title} · #${activeModuleIndex + 1}`
      : `#${activeModuleIndex + 1} ${activeModule.name}`;

  return (
    <div
      style={
        studioSafeInsets
          ? {
              paddingLeft: `${Math.max(16, studioSafeInsets.leftPx ?? 84)}px`,
              paddingRight: `${Math.max(16, studioSafeInsets.rightPx ?? 20)}px`,
            }
          : undefined
      }
      className="px-4 pb-1 flex items-center justify-center shrink-0 z-10 pointer-events-none transition-[padding] duration-300"
    >
      <div
        data-testid="v5-2d-live-dimension-chain-bar"
        className="pointer-events-auto max-w-full overflow-x-auto no-scrollbar px-3.5 py-1 rounded-full bg-[#181D27]/86 backdrop-blur-xl border border-white/[0.14] ring-1 ring-black/45 shadow-[0_10px_26px_rgba(0,0,0,0.40)] flex items-center justify-between gap-3 text-[11px] text-slate-200 whitespace-nowrap"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-bold text-white truncate max-w-[180px]" title={selectedLabel}>
            {selectedLabel}
          </span>
          <span className="font-mono text-slate-400 hidden sm:inline">
            {formatElevationValue(activeModule.dimensions.width, displayUnit, false)}×
            {formatElevationValue(activeModule.dimensions.height, displayUnit, false)}×
            {formatElevationValue(activeModule.dimensions.depth, displayUnit, false)} {displayUnit}
          </span>
          <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold shrink-0 ${toneCls}`}>
            {statusText}
          </span>
        </div>

        <span className="h-3.5 w-px bg-white/[0.14] hidden sm:inline-block" />

        <div className="flex items-center gap-2.5 shrink-0">
          <label className="inline-flex items-center gap-1" title="Modülün sol kenarının sol duvara olan uzaklığı">
            <span className="text-slate-400 font-medium">Sol Mesafe:</span>
            <input
              type="number" inputMode="decimal"
              step={displayUnit === "cm" ? 1 : 10}
              value={toDisplayUnitNumber(activeModule.position.x, displayUnit)}
              onChange={(e) =>
                onSetModuleOffsetFromLeftWall(
                  activeModule.id,
                  toCanonicalMm(Number(e.target.value) || 0, displayUnit)
                )
              }
              className="w-14 px-1.5 py-0.5 rounded-full bg-white/[0.08] border border-white/[0.16] font-mono font-bold text-white text-center focus:outline-none focus:border-sky-400"
            />
            <span className="font-mono text-[10px] text-slate-400">{displayUnit}</span>
          </label>
          <label className="inline-flex items-center gap-1" title="Seçili modülün dıştan dışa toplam genişliği (konumu sabit kalır)">
            <span className="text-slate-400 font-medium">Genişlik:</span>
            <input
              type="number" inputMode="decimal"
              step={displayUnit === "cm" ? 1 : 10}
              min={displayUnit === "cm" ? 15 : 150}
              max={displayUnit === "cm" ? 360 : 3600}
              value={toDisplayUnitNumber(activeModule.dimensions.width, displayUnit)}
              onChange={(e) =>
                onResizeModuleWidth(
                  toCanonicalMm(Number(e.target.value) || activeModule.dimensions.width, displayUnit)
                )
              }
              className="w-14 px-1.5 py-0.5 rounded-full bg-white/[0.08] border border-white/[0.16] font-mono font-bold text-white text-center focus:outline-none focus:border-sky-400"
            />
            <span className="font-mono text-[10px] text-slate-400">{displayUnit}</span>
          </label>
        </div>
      </div>
    </div>
  );
};
