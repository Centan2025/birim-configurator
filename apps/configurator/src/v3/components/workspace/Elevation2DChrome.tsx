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
  selectedObstacle: ArchitecturalElement | null;
  onUpdateObstacle: (id: string, patch: Partial<ArchitecturalElement>) => void;
  onUpdateObstaclePosition: (id: string, x: number) => void;
  onRemoveObstacle: (id: string) => void;
  onSwapModule: (idx: number, dir: "left" | "right") => void;
  onSetModulePosition: (idx: number, x: number, z: number, wallId: number, y: number) => void;
  onUpdateCeiling: (patch: any) => void;
  onUpdateCeilingHeightMm: (h: number) => void;
  onUpdateCarcass: (patch: any) => void;
  onSetFacadeGrainContinuity: (mode: any) => void;
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
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      {/* Sol Grup: Etkileşim Modu (Seçim/İç Taşıma + Kaydır/Pan) */}
      <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-[#F2EDE3] border border-[#E6E0D3]">
        <button
          type="button"
          data-testid="elev-interior-move-mode-btn"
          onClick={() => {
            if (elevPanMode && onToggleElevPanMode) onToggleElevPanMode();
            onToggleInteriorMoveMode();
          }}
          title="İç Parça Taşıma Modu (Kısayol: Ctrl basılı tutun)"
          className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 ${
            !elevPanMode
              ? interiorMoveMode
                ? "bg-[#1C1917] text-[#FAF9F6] shadow-2xs"
                : "bg-white text-[#1C1917] shadow-2xs"
              : "text-[#57534E] hover:text-[#1C1917]"
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
            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 ${
              elevPanMode
                ? "bg-[#1C1917] text-[#FAF9F6] shadow-2xs"
                : "text-[#57534E] hover:text-[#1C1917]"
            }`}
          >
            <span>🖐️</span>
            <span className="hidden sm:inline">Kaydır</span>
          </button>
        )}
      </div>

      <span className="h-4 w-px bg-[#E6E0D3] mx-0.5 hidden sm:inline-block" />

      {/* Orta & Sağ Grup: Modül Sırası, Kot, Tavan/Delik, Görünüm Seviyesi & Birim */}
      <div className="flex items-center gap-1.5 flex-wrap">
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
              className="px-1.5 py-0.5 rounded bg-amber-600 hover:bg-amber-500 text-white font-bold cursor-pointer"
              title="90° Döndür"
            >
              🔄 {selectedObstacle.rotationY || 0}°
            </button>
            <label className="flex items-center gap-0.5">
              <span>W:</span>
              <input
                type="number"
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
              <span>H:</span>
              <input
                type="number"
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
              <span>Y:</span>
              <input
                type="number"
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
              <span>X:</span>
              <input
                type="number"
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
          <div className="flex items-center gap-0.5 bg-[#F2EDE3] px-1.5 py-0.5 rounded-full border border-[#E6E0D3] text-[11px]">
            <span className="font-semibold text-[#57534E] mr-0.5">Sıra:</span>
            <button
              type="button"
              data-testid="elev-swap-mod-left-btn"
              onClick={() => onSwapModule(activeModuleIndex, "left")}
              className="px-1.5 py-0.5 rounded-full bg-white hover:bg-[#1C1917] hover:text-white text-[#1C1917] font-bold cursor-pointer transition"
              title="Seçili modülü solundaki modülle yer değiştir"
            >
              ⇤
            </button>
            <button
              type="button"
              data-testid="elev-swap-mod-right-btn"
              onClick={() => onSwapModule(activeModuleIndex, "right")}
              className="px-1.5 py-0.5 rounded-full bg-white hover:bg-[#1C1917] hover:text-white text-[#1C1917] font-bold cursor-pointer transition"
              title="Seçili modülü sağındaki modülle yer değiştir"
            >
              ⇥
            </button>
          </div>
        )}

        {hasSceneModules && (
          <div className="flex items-center gap-1 bg-[#F2EDE3] px-2.5 py-0.5 rounded-full border border-[#E6E0D3] text-[11px]">
            <span className="font-semibold text-[#57534E]">Kot:</span>
            <input
              type="number"
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
              className="w-12 px-1.5 py-0.5 rounded-full bg-white border border-[#DED8CC] text-[#1C1917] font-mono text-[11px] font-bold text-center"
            />
            <span className="text-[10px] text-[#78716C]">{displayUnit}</span>
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
                className="px-2 py-0.5 rounded-full bg-white hover:bg-[#1C1917] hover:text-white text-[#1C1917] border border-[#DED8CC] text-[10px] font-semibold cursor-pointer transition"
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

        {/* Grup 3: 3 Seviyeli Görünüm Sistemi */}
        <div
          data-testid="elev-detail-level-switcher"
          className="inline-flex items-center rounded-full bg-[#F2EDE3] p-0.5 border border-[#E6E0D3] text-[11px]"
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
              className={`px-2.5 py-0.5 rounded-full font-semibold transition cursor-pointer ${
                detailLevel === lvl.id
                  ? "bg-[#1C1917] text-[#FAF9F6] shadow-2xs"
                  : "text-[#57534E] hover:text-[#1C1917]"
              }`}
            >
              {lvl.label}
            </button>
          ))}
        </div>

        {/* Grup 4: Ölçü Birimi (mm / cm) */}
        <div
          data-testid="elev-unit-switcher"
          className="inline-flex items-center rounded-full bg-[#F2EDE3] p-0.5 border border-[#E6E0D3] text-[11px]"
          title="Gösterim Ölçü Birimi (BOM ve üretim verisi her zaman mm kalır)"
        >
          {(["mm", "cm"] as const).map((u) => (
            <button
              key={u}
              type="button"
              data-testid={`elev-unit-${u}-btn`}
              onClick={() => onChangeDisplayUnit(u)}
              className={`px-2 py-0.5 rounded-full font-mono font-semibold transition cursor-pointer ${
                displayUnit === u
                  ? "bg-[#1C1917] text-[#FAF9F6] shadow-2xs"
                  : "text-[#57534E] hover:text-[#1C1917]"
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
          className={`h-7 px-2.5 rounded-full text-[11px] font-semibold flex items-center gap-1 border transition cursor-pointer ${
            showRoomContextInElev
              ? "bg-[#1C1917] text-[#FAF9F6] border-[#1C1917]"
              : "bg-[#F2EDE3] text-[#44403C] border-[#E6E0D3] hover:bg-[#EAE3D6] hover:text-[#1C1917]"
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
          className={`h-7 px-2.5 rounded-full text-[11px] font-semibold flex items-center gap-1 border transition cursor-pointer ${
            showDoorsIn2D
              ? "bg-[#1C1917] text-[#FAF9F6] border-[#1C1917]"
              : "bg-[#F2EDE3] text-[#44403C] border-[#E6E0D3] hover:bg-[#EAE3D6] hover:text-[#1C1917]"
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
      style={{ top: `${topOffsetPx}px`, right: `${rightOffsetPx}px` }}
      className="absolute z-20 w-[248px] rounded-2xl bg-white/95 backdrop-blur-md border border-blue-300 shadow-lg p-3 text-xs text-stone-900 space-y-2.5"
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
                  type="number"
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
                  type="number"
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
                type="number"
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
            <span className="font-semibold text-stone-700">Donanım Kotu (Y):</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
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
                  <span className="font-semibold text-stone-700">Sol Ofset (X):</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
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
      ? "bg-amber-100 text-amber-900 border-amber-300"
      : statusTone === "green"
      ? "bg-emerald-100 text-emerald-900 border-emerald-300"
      : statusTone === "red"
      ? "bg-red-100 text-red-900 border-red-300"
      : statusTone === "blue"
      ? "bg-blue-100 text-blue-900 border-blue-300"
      : "bg-stone-100 text-stone-700 border-stone-300";

  const selectedLabel =
    selectedContext && selectedContext.kind !== "module"
      ? `${selectedContext.title} · #${activeModuleIndex + 1}`
      : `#${activeModuleIndex + 1} ${activeModule.name}`;

  return (
    <div
      data-testid="v5-2d-live-dimension-chain-bar"
      style={
        studioSafeInsets
          ? {
              marginBottom: `${(studioSafeInsets.bottomPx ?? 66) + 6}px`,
              paddingLeft: `${studioSafeInsets.leftPx ?? 84}px`,
              paddingRight: `${studioSafeInsets.rightPx ?? 20}px`,
            }
          : undefined
      }
      className="shrink-0 z-10 px-4 py-1.5 bg-[#FAF9F6]/95 border-t border-[#DED8CC] flex items-center justify-between gap-3 text-[11px] text-[#141413] overflow-x-auto whitespace-nowrap"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-bold truncate max-w-[180px]" title={selectedLabel}>
          {selectedLabel}
        </span>
        <span className="font-mono text-stone-600 hidden sm:inline">
          {formatElevationValue(activeModule.dimensions.width, displayUnit, false)}×
          {formatElevationValue(activeModule.dimensions.height, displayUnit, false)}×
          {formatElevationValue(activeModule.dimensions.depth, displayUnit, false)} {displayUnit}
        </span>
        <span className="font-mono text-stone-500 hidden md:inline">
          Kot: {formatElevationValue(activeModule.position.y, displayUnit)}
        </span>
        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold shrink-0 ${toneCls}`}>
          {statusText}
        </span>
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        <label className="inline-flex items-center gap-1 font-mono">
          <span className="text-stone-500">X:</span>
          <input
            type="number"
            step={displayUnit === "cm" ? 1 : 10}
            value={toDisplayUnitNumber(activeModule.position.x, displayUnit)}
            onChange={(e) =>
              onSetModuleOffsetFromLeftWall(
                activeModule.id,
                toCanonicalMm(Number(e.target.value) || 0, displayUnit)
              )
            }
            className="w-16 px-1.5 py-0.5 rounded-lg bg-white border border-stone-300 font-bold text-[#141413]"
          />
          <span>{displayUnit}</span>
        </label>
        <label className="inline-flex items-center gap-1 font-mono">
          <span className="text-stone-500">W:</span>
          <input
            type="number"
            step={displayUnit === "cm" ? 1 : 10}
            min={displayUnit === "cm" ? 15 : 150}
            max={displayUnit === "cm" ? 360 : 3600}
            value={toDisplayUnitNumber(activeModule.dimensions.width, displayUnit)}
            onChange={(e) =>
              onResizeModuleWidth(
                toCanonicalMm(Number(e.target.value) || activeModule.dimensions.width, displayUnit)
              )
            }
            className="w-16 px-1.5 py-0.5 rounded-lg bg-white border border-stone-300 font-bold text-[#141413]"
          />
          <span>{displayUnit}</span>
        </label>
      </div>
    </div>
  );
};
