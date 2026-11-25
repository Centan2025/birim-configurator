"use client";
import React from "react";
import { X, UtensilsCrossed } from "lucide-react";
import {
  CEILING_TYPE_CATALOG,
  resolveSpaceCeilingConfig,
  type ArchitecturalElement,
  type CeilingType,
  type DesignProject,
  type ModuleInstance,
  type SpaceCeilingConfig,
  type WallDefinition,
} from "@birim/core";
import { useConfiguratorStore } from "../../store/useConfiguratorStore";
import { PremiumSelect } from "../PremiumSelect";
import { getEffectiveSpaceWalls } from "../../v3/engine/kitchenSpatialEngine";
import type { V11LeftDrawerTab } from "../v11Constants";

export interface LeftRoomAndSpaceDrawerTabProps {
  activeWallId: string | null;
  ceilingHeightMm: number;
  currentTargetWall: WallDefinition | undefined;
  effectiveWalls: WallDefinition[];
  fmtLen: (mm: number, withUnit?: boolean) => string;
  mainModules: Array<{ mod: ModuleInstance; idx: number }>;
  obstacles: ArchitecturalElement[];
  onChangeDrawer: (tab: V11LeftDrawerTab) => void;
  onLoadKitchenPreset: (kind: "linear" | "l" | "u") => void;
  onOpenKitchenIslandModal: () => void;
  onRemoveSpaceObstacle: (id: string) => void;
  onSetRoomDimensions: (wallW: number, ceilH: number) => void;
  placeOnSelectedWall: (
    kind: ArchitecturalElement["type"],
    name: string,
    widthMm: number,
    heightMm: number,
    depthMm: number,
    elevationY: number,
    explicitWallId?: string
  ) => void;
  renderedDrawer: V11LeftDrawerTab;
  setActiveWallId: (wallId: string) => void;
  spaceWalls: WallDefinition[];
  storeProject: DesignProject;
  updateSpaceObstacleStore: (id: string, patch: Partial<ArchitecturalElement>) => void;
  wallWidthMm: number;
}

export const LeftRoomAndSpaceDrawerTab: React.FC<LeftRoomAndSpaceDrawerTabProps> = (props) => {
  const {
    activeWallId,
    ceilingHeightMm,
    currentTargetWall,
    effectiveWalls,
    fmtLen,
    mainModules,
    obstacles,
    onChangeDrawer,
    onLoadKitchenPreset,
    onOpenKitchenIslandModal,
    onRemoveSpaceObstacle,
    onSetRoomDimensions,
    placeOnSelectedWall,
    renderedDrawer,
    setActiveWallId,
    spaceWalls,
    storeProject,
    updateSpaceObstacleStore,
    wallWidthMm,
  } = props;
  return (
    <>
            {/* SEKME 3: ODA ÖLÇÜLERİ, HAZIR MUTFAK PLANLARI, ADA & ENGELLER */}
            {renderedDrawer === "space" && (
              <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
                {(() => {
                  const mainWallId = effectiveWalls[0]?.id || "wall_main";
                  const selectedWall = currentTargetWall || effectiveWalls[0];
                  const isMainSelected = !selectedWall || selectedWall.id === mainWallId;
                  const selectedWallLabel = selectedWall?.name || "Ana Duvar";
                  const selectedWallLenMm = selectedWall?.length ?? wallWidthMm;
                  const sliderMaxMm = Math.max(6000, Math.ceil(selectedWallLenMm / 50) * 50);

                  const handleSelectedWallLengthChange = (nextLenRaw: number) => {
                    const nextLen = Math.max(600, Math.min(12000, Math.round(nextLenRaw)));
                    if (isMainSelected || !selectedWall) {
                      onSetRoomDimensions(nextLen, ceilingHeightMm);
                      return;
                    }
                    const st = useConfiguratorStore.getState();
                    if (!st.project.space.walls.some((sw) => sw.id === selectedWall.id)) {
                      st.applyBatchProjectUpdate((draft) => {
                        draft.space.walls = effectiveWalls.map((ew) => ({
                          ...ew,
                          position: { ...ew.position },
                        }));
                      }, "Oda duvarları hazırlandı");
                    }
                    useConfiguratorStore.getState().updateWallSegment(selectedWall.id, {
                      length: nextLen,
                    });
                  };

                  return (
                    <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-bold text-[#141413]">Oda Duvar ve Tavan Ölçüleri</div>
                        <span
                          data-testid="v11-space-active-wall-badge"
                          className="px-2 py-0.5 rounded-full bg-sky-500/15 border border-sky-400/35 text-sky-300 text-[10px] font-semibold truncate max-w-[130px]"
                          title={`Aktif duvar: ${selectedWallLabel}`}
                        >
                          {selectedWallLabel}
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[#57534E]">Duvar Genişliği ({selectedWallLabel})</span>
                          <span data-testid="v11-space-wall-length-value" className="font-mono font-bold">
                            {fmtLen(selectedWallLenMm)}
                          </span>
                        </div>
                        <input
                          data-testid="v11-space-wall-length-slider"
                          type="range"
                          min={600}
                          max={sliderMaxMm}
                          step={50}
                          value={selectedWallLenMm}
                          onChange={(e) => handleSelectedWallLengthChange(Number(e.target.value))}
                          className="w-full accent-[#141413] cursor-pointer"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[#57534E]">Tavan Yüksekliği</span>
                          <span className="font-mono font-bold">
                            {fmtLen(ceilingHeightMm)}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={2100}
                          max={3400}
                          step={20}
                          value={ceilingHeightMm}
                          onChange={(e) =>
                            onSetRoomDimensions(wallWidthMm, Number(e.target.value))
                          }
                          className="w-full accent-[#141413] cursor-pointer"
                        />
                      </div>
                    </div>
                  );
                })()}

                {/* Mimari Tavan Tipi Seçimi ve Ayarları */}
                {(() => {
                  const ceilCfg = resolveSpaceCeilingConfig(storeProject.space);
                  const updateCeiling = (patch: Partial<SpaceCeilingConfig>) => {
                    useConfiguratorStore.getState().updateCeilingConfig(patch);
                  };
                  const isSloped = ceilCfg.ceilingType === "sloped_attic";
                  const isBeams = ceilCfg.ceilingType === "exposed_wood_beams";
                  const hasDropControl =
                    ceilCfg.ceilingType !== "flat_plaster" && !isSloped;

                  type SlopeDirId = "left_to_right" | "right_to_left" | "back_to_front";
                  const effWallsForCeil = getEffectiveSpaceWalls(storeProject);
                  const activeSelWall =
                    effWallsForCeil.find((w) => w.id === activeWallId) || effWallsForCeil[0];
                  const inferWallDir = (
                    w?: { position: { x: number; z: number }; rotationY?: number }
                  ): SlopeDirId => {
                    if (!w) return "back_to_front";
                    const mainSpan = Math.max(1600, effWallsForCeil[0]?.length || 3600);
                    const rotNorm = (((w.rotationY || 0) % 360) + 360) % 360;
                    const isSide = Math.abs(rotNorm - 90) < 35 || Math.abs(rotNorm - 270) < 35;
                    if (isSide) {
                      return w.position.x > mainSpan * 0.5 ? "right_to_left" : "left_to_right";
                    }
                    return "back_to_front";
                  };
                  const selectedWallDir: SlopeDirId = inferWallDir(activeSelWall);
                  const selectedWallName =
                    activeSelWall?.name ||
                    (selectedWallDir === "left_to_right"
                      ? "Sol Duvar"
                      : selectedWallDir === "right_to_left"
                        ? "Sağ Duvar"
                        : "Ana Duvar");
                  const rawCeilCfg = storeProject.space?.ceilingConfig;
                  const activeSlopeDirs: SlopeDirId[] =
                    Array.isArray(rawCeilCfg?.slopeDirections) && rawCeilCfg.slopeDirections.length > 0
                      ? Array.from(new Set(rawCeilCfg.slopeDirections))
                      : ceilCfg.slopeDirections && ceilCfg.slopeDirections.length > 0
                        ? ceilCfg.slopeDirections
                        : [ceilCfg.slopeDirection];
                  const rawWallSlopes = rawCeilCfg?.wallSlopes || {};
                  const isSelectedWallSloped =
                    ceilCfg.enabled && isSloped && activeSlopeDirs.includes(selectedWallDir);
                  const selectedWallSlopeSetting = rawWallSlopes[selectedWallDir] || {
                    enabled: isSelectedWallSloped,
                    kneeHeightMm: ceilCfg.slopeKneeHeightMm,
                    angleDeg: ceilCfg.slopeAngleDeg,
                  };

                  const setWallSlopeState = (
                    targetDir: SlopeDirId,
                    nextEnabled: boolean,
                    overrideParams?: { kneeHeightMm?: number; angleDeg?: number }
                  ) => {
                    const liveCfg = useConfiguratorStore.getState().project.space?.ceilingConfig;
                    const liveDirs: SlopeDirId[] =
                      Array.isArray(liveCfg?.slopeDirections) && liveCfg.slopeDirections.length > 0
                        ? Array.from(new Set(liveCfg.slopeDirections))
                        : [liveCfg?.slopeDirection || ceilCfg.slopeDirection || "left_to_right"];
                    const liveMap = { ...(liveCfg?.wallSlopes || {}) };
                    const prevTarget = liveMap[targetDir] || {
                      enabled: liveDirs.includes(targetDir),
                      kneeHeightMm: liveCfg?.slopeKneeHeightMm ?? ceilCfg.slopeKneeHeightMm,
                      angleDeg: liveCfg?.slopeAngleDeg ?? ceilCfg.slopeAngleDeg,
                    };
                    let nextDirs: SlopeDirId[];
                    if (nextEnabled) {
                      nextDirs = liveDirs.includes(targetDir) ? liveDirs : [...liveDirs, targetDir];
                    } else {
                      nextDirs = liveDirs.length > 1 ? liveDirs.filter((d) => d !== targetDir) : liveDirs;
                    }
                    liveMap[targetDir] = {
                      enabled: nextDirs.includes(targetDir),
                      kneeHeightMm: overrideParams?.kneeHeightMm ?? prevTarget.kneeHeightMm,
                      angleDeg: overrideParams?.angleDeg ?? prevTarget.angleDeg,
                    };
                    // Ensure all other active directions preserve their own snapshot in wallSlopes
                    for (const d of nextDirs) {
                      if (!liveMap[d]) {
                        liveMap[d] = {
                          enabled: true,
                          kneeHeightMm: liveCfg?.slopeKneeHeightMm ?? ceilCfg.slopeKneeHeightMm,
                          angleDeg: liveCfg?.slopeAngleDeg ?? ceilCfg.slopeAngleDeg,
                        };
                      }
                    }
                    updateCeiling({
                      enabled: true,
                      showIn3D: true,
                      showInElevation2D: true,
                      ceilingType: "sloped_attic",
                      slopeDirection: nextDirs[0],
                      slopeDirections: nextDirs,
                      wallSlopes: liveMap,
                    });
                  };
                  return (
                    <div
                      data-testid="v11-space-ceiling-type-card"
                      className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-bold text-[#141413]">Mimari Tavan Tipi</div>
                        <button
                          type="button"
                          data-testid="v11-space-ceiling-toggle"
                          onClick={() =>
                            updateCeiling({
                              enabled: !ceilCfg.enabled,
                              showIn3D: true,
                              showInElevation2D: true,
                            })
                          }
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition cursor-pointer ${
                            ceilCfg.enabled
                              ? "bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] text-white shadow-xs"
                              : "bg-white/[0.10] hover:bg-white/[0.16] text-slate-300 border border-white/15"
                          }`}
                        >
                          {ceilCfg.enabled ? "Açık" : "Kapalı"}
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5">
                        {CEILING_TYPE_CATALOG.map((ct) => {
                          const active = ceilCfg.enabled && ceilCfg.ceilingType === ct.id;
                          return (
                            <button
                              key={ct.id}
                              type="button"
                              data-testid={`v11-ceiling-type-${ct.id}`}
                              onClick={() => {
                                if (ct.id === "sloped_attic") {
                                  if (!active) {
                                    // First time enabling sloped roof: start from currently selected wall
                                    const initKnee = ceilCfg.slopeKneeHeightMm;
                                    const initAng = ceilCfg.slopeAngleDeg;
                                    updateCeiling({
                                      enabled: true,
                                      showIn3D: true,
                                      showInElevation2D: true,
                                      ceilingType: "sloped_attic",
                                      slopeDirection: selectedWallDir,
                                      slopeDirections: [selectedWallDir],
                                      wallSlopes: {
                                        [selectedWallDir]: {
                                          enabled: true,
                                          kneeHeightMm: initKnee,
                                          angleDeg: initAng,
                                        },
                                      },
                                    });
                                  } else if (!isSelectedWallSloped) {
                                    // Already sloped on another wall -> clicking "Eğimli Çatı" while a new wall is selected adds slope to this wall too!
                                    setWallSlopeState(selectedWallDir, true);
                                  }
                                  return;
                                }
                                updateCeiling({
                                  enabled: true,
                                  showIn3D: true,
                                  showInElevation2D: true,
                                  ceilingType: ct.id as CeilingType,
                                  dropHeightMm:
                                    ct.defaultDropHeightMm > 0
                                      ? ct.defaultDropHeightMm
                                      : ceilCfg.dropHeightMm,
                                });
                              }}
                              title={ct.description}
                              className={`px-2.5 py-1.5 rounded-xl border text-left text-[11px] font-bold transition cursor-pointer flex items-center gap-1.5 ${
                                active
                                  ? "bg-[#141413] text-white border-[#141413] shadow-xs"
                                  : "bg-white/[0.08] hover:bg-white/[0.15] text-slate-200 border-white/15"
                              }`}
                            >
                              <span>{ct.icon}</span>
                              <span className="truncate">{ct.shortLabel}</span>
                            </button>
                          );
                        })}
                      </div>

                      {ceilCfg.enabled && (
                        <div className="space-y-2.5 pt-2 border-t border-white/10">
                          {isSloped && (
                            <>
                              {/* Seçili Duvar Bağımsız Eğim Kontrol Çubuğu */}
                              <div className="p-2 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="text-[9.5px] font-bold uppercase tracking-wide text-sky-700">
                                    Seçili Duvar Eğimi
                                  </div>
                                  <div className="text-[11px] font-bold text-[#141413] truncate">
                                    {selectedWallName}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  data-testid="v11-selected-wall-slope-toggle"
                                  onClick={() =>
                                    setWallSlopeState(selectedWallDir, !isSelectedWallSloped)
                                  }
                                  className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold border transition cursor-pointer shrink-0 ${
                                    isSelectedWallSloped
                                      ? "bg-[#141413] text-white border-[#141413]"
                                      : "bg-sky-600 hover:bg-sky-700 text-white border-sky-600"
                                  }`}
                                >
                                  {isSelectedWallSloped
                                    ? activeSlopeDirs.length > 1
                                      ? "✓ Eğim Açık · Kaldır"
                                      : "✓ Eğim Açık"
                                    : "+ Bu Duvara Eğim Ekle"}
                                </button>
                              </div>

                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-[#57534E]">
                                    Diz Duvarı Kotu ({selectedWallName})
                                  </span>
                                  <span className="font-mono font-bold">
                                    {fmtLen(selectedWallSlopeSetting.kneeHeightMm)}
                                  </span>
                                </div>
                                <input
                                  type="range"
                                  min={800}
                                  max={Math.max(1200, ceilingHeightMm - 200)}
                                  step={50}
                                  value={selectedWallSlopeSetting.kneeHeightMm}
                                  onChange={(e) =>
                                    setWallSlopeState(selectedWallDir, true, {
                                      kneeHeightMm: Number(e.target.value),
                                    })
                                  }
                                  className="w-full accent-[#141413] cursor-pointer"
                                />
                              </div>

                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-[#57534E]">
                                    Çatı Eğim Açısı ({selectedWallName})
                                  </span>
                                  <span className="font-mono font-bold">
                                    {selectedWallSlopeSetting.angleDeg}°
                                  </span>
                                </div>
                                <input
                                  type="range"
                                  min={10}
                                  max={55}
                                  step={1}
                                  value={selectedWallSlopeSetting.angleDeg}
                                  onChange={(e) =>
                                    setWallSlopeState(selectedWallDir, true, {
                                      angleDeg: Number(e.target.value),
                                    })
                                  }
                                  className="w-full accent-[#141413] cursor-pointer"
                                />
                              </div>

                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[10px] text-[#57534E]">
                                  <span>Eğimli Duvarlar (Çoklu Seçim)</span>
                                  <span className="font-mono font-bold text-[#141413]">
                                    {activeSlopeDirs.length} duvar
                                  </span>
                                </div>
                                <div className="grid grid-cols-3 gap-1">
                                  {(
                                    [
                                      { id: "left_to_right", label: "Sol Duvar" },
                                      { id: "back_to_front", label: "Ana Duvar" },
                                      { id: "right_to_left", label: "Sağ Duvar" },
                                    ] as const
                                  ).map((dir) => {
                                    const isDirOn = activeSlopeDirs.includes(dir.id);
                                    const dirAngle =
                                      rawWallSlopes[dir.id]?.angleDeg ?? ceilCfg.slopeAngleDeg;
                                    return (
                                      <button
                                        key={dir.id}
                                        type="button"
                                        onClick={() => setWallSlopeState(dir.id, !isDirOn)}
                                        className={`py-1 px-1.5 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                                          isDirOn
                                            ? "bg-[#141413] text-white border-[#141413]"
                                            : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300"
                                        }`}
                                      >
                                        {isDirOn ? `✓ ${dir.label} ${dirAngle}°` : dir.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </>
                          )}

                          {hasDropControl && (
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-[#57534E]">
                                  {isBeams ? "Kiriş Yüksekliği" : "Tavan Düşümü"}
                                </span>
                                <span className="font-mono font-bold">
                                  {fmtLen(isBeams ? ceilCfg.beamHeightMm : ceilCfg.dropHeightMm)}
                                </span>
                              </div>
                              <input
                                type="range"
                                min={40}
                                max={500}
                                step={10}
                                value={isBeams ? ceilCfg.beamHeightMm : ceilCfg.dropHeightMm}
                                onChange={(e) =>
                                  updateCeiling(
                                    isBeams
                                      ? { beamHeightMm: Number(e.target.value) }
                                      : { dropHeightMm: Number(e.target.value) }
                                  )
                                }
                                className="w-full accent-[#141413] cursor-pointer"
                              />
                            </div>
                          )}

                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {ceilCfg.ceilingType === "dropped_perimeter_cove" && (
                              <button
                                type="button"
                                onClick={() =>
                                  updateCeiling({ hasHiddenLedCove: !ceilCfg.hasHiddenLedCove })
                                }
                                className={`px-2 py-1 rounded-lg text-[10.5px] font-semibold border transition cursor-pointer ${
                                  ceilCfg.hasHiddenLedCove
                                    ? "bg-amber-50 text-amber-900 border-amber-300"
                                    : "bg-white/[0.08] hover:bg-white/[0.15] text-slate-200 border-white/15"
                                }`}
                              >
                                {ceilCfg.hasHiddenLedCove ? "✓ Gizli LED" : "Gizli LED"}
                              </button>
                            )}
                            {!isSloped && (
                              <button
                                type="button"
                                onClick={() =>
                                  updateCeiling({ hasRecessedSpots: !ceilCfg.hasRecessedSpots })
                                }
                                className={`px-2 py-1 rounded-lg text-[10.5px] font-semibold border transition cursor-pointer ${
                                  ceilCfg.hasRecessedSpots
                                    ? "bg-amber-50 text-amber-900 border-amber-300"
                                    : "bg-white/[0.08] hover:bg-white/[0.15] text-slate-200 border-white/15"
                                }`}
                              >
                                {ceilCfg.hasRecessedSpots ? "✓ Gömme Spot" : "Gömme Spot"}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                updateCeiling({
                                  translucentCutawayIn3D: !ceilCfg.translucentCutawayIn3D,
                                })
                              }
                              className={`px-2 py-1 rounded-lg text-[10.5px] font-semibold border transition cursor-pointer ${
                                ceilCfg.translucentCutawayIn3D
                                  ? "bg-sky-50 text-sky-900 border-sky-300"
                                  : "bg-white/[0.08] hover:bg-white/[0.15] text-slate-200 border-white/15"
                              }`}
                            >
                              {ceilCfg.translucentCutawayIn3D
                                ? "✓ 3B Yarı-Saydam"
                                : "3B Yarı-Saydam"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* V102: Duvar Süpürgeliği Ayarları + Canlı Çakışma Uyarısı */}
                {(() => {
                  const sk = storeProject.space?.skirtingConfig;
                  const skEnabled = sk ? sk.enabled !== false : true;
                  const skH = sk?.heightMm ?? 114;
                  const skT = sk?.thicknessMm ?? 16;
                  const skColor = sk?.colorHex || "#F1EFEA";
                  const updateSkirting = (patch: Partial<{ enabled: boolean; heightMm: number; thicknessMm: number; colorHex: string }>) => {
                    const st = useConfiguratorStore.getState();
                    st.applyBatchProjectUpdate((draft) => {
                      const prev = draft.space.skirtingConfig || {
                        enabled: true,
                        heightMm: 114,
                        thicknessMm: 16,
                        colorHex: "#F1EFEA",
                      };
                      draft.space.skirtingConfig = { ...prev, ...patch };
                    }, "Duvar süpürgeliği güncellendi");
                  };
                  const clashingMods = skEnabled
                    ? mainModules.filter((m) => (m.mod.position?.y || 0) < skH && (m.mod.position?.z || 0) < skT - 1)
                    : [];
                  return (
                    <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-bold text-[#141413]">Duvar Süpürgeliği</div>
                        <button
                          type="button"
                          onClick={() => updateSkirting({ enabled: !skEnabled })}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition cursor-pointer ${
                            skEnabled
                              ? "bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] text-white shadow-xs"
                              : "bg-white/[0.10] text-slate-300 border border-white/15"
                          }`}
                        >
                          {skEnabled ? "Var (Açık)" : "Yok (Kapalı)"}
                        </button>
                      </div>

                      {skEnabled && (
                        <>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-[#57534E]">Süpürgelik Yüksekliği</span>
                              <span className="font-mono font-bold">{fmtLen(skH)}</span>
                            </div>
                            <input
                              type="range"
                              min={60}
                              max={200}
                              step={5}
                              value={skH}
                              onChange={(e) => updateSkirting({ heightMm: Number(e.target.value) })}
                              className="w-full accent-[#0284C7] cursor-pointer"
                            />
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-[#57534E]">Süpürgelik Kalınlığı</span>
                              <span className="font-mono font-bold">{fmtLen(skT)}</span>
                            </div>
                            <input
                              type="range"
                              min={10}
                              max={30}
                              step={2}
                              value={skT}
                              onChange={(e) => updateSkirting({ thicknessMm: Number(e.target.value) })}
                              className="w-full accent-[#0284C7] cursor-pointer"
                            />
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-0.5">
                            <span className="text-[11px] text-[#57534E]">Renk</span>
                            <div className="flex items-center gap-1.5">
                              {[
                                { hex: "#F1EFEA", label: "Kırık Beyaz" },
                                { hex: "#CBD5E1", label: "Açık Gri" },
                                { hex: "#B08968", label: "Doğal Meşe" },
                                { hex: "#27272A", label: "Antrasit" },
                              ].map((sw) => (
                                <button
                                  key={sw.hex}
                                  type="button"
                                  title={sw.label}
                                  onClick={() => updateSkirting({ colorHex: sw.hex })}
                                  style={{ backgroundColor: sw.hex }}
                                  className={`w-6 h-6 rounded-full border-2 transition cursor-pointer ${
                                    skColor.toLowerCase() === sw.hex.toLowerCase()
                                      ? "border-[#38BDF8] scale-110 shadow-[0_0_8px_rgba(56,189,248,0.65)]"
                                      : "border-white/30 hover:scale-105"
                                  }`}
                                />
                              ))}
                            </div>
                          </div>

                          {clashingMods.length > 0 && (
                            <div className="p-2.5 rounded-xl bg-amber-500/18 border border-amber-400/45 text-amber-100 space-y-1.5">
                              <div className="text-[11px] font-bold flex items-center gap-1.5">
                                <span>⚠️ Süpürgelik Çakışması ({clashingMods.length} dolap)</span>
                              </div>
                              <p className="text-[10px] leading-snug opacity-90">
                                Zemin dolapları {skH}×{skT} mm duvar süpürgeliği ile kesişiyor.
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  const st = useConfiguratorStore.getState();
                                  st.applyBatchProjectUpdate((draft) => {
                                    draft.modules.forEach((m) => {
                                      if (m.category !== "complementary" && (m.position?.y || 0) < skH && (m.position?.z || 0) < skT) {
                                        m.position.z = skT;
                                      }
                                    });
                                  }, "Dolaplar süpürgelik kadar öne alındı");
                                }}
                                className="w-full py-1.5 px-2.5 rounded-lg bg-amber-500/30 hover:bg-amber-500/45 border border-amber-300/50 text-white text-[10.5px] font-bold transition cursor-pointer"
                              >
                                Dolapları +{skT} mm Öne Al (Çakışmayı Gider)
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })()}

                {/* Hazır Mutfak Planları */}
                <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] space-y-2.5">
                  <div className="font-bold text-[#141413]">Hazır Mutfak Yerleşimleri</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => onLoadKitchenPreset("linear")}
                      className="py-2 px-2 rounded-xl bg-[#F5F2EA] hover:bg-[#EAE4D7] font-semibold cursor-pointer"
                    >
                      Düz Mutfak
                    </button>
                    <button
                      type="button"
                      onClick={() => onLoadKitchenPreset("l")}
                      className="py-2 px-2 rounded-xl bg-[#F5F2EA] hover:bg-[#EAE4D7] font-semibold cursor-pointer"
                    >
                      L-Tipi Mutfak
                    </button>
                    <button
                      type="button"
                      onClick={() => onLoadKitchenPreset("u")}
                      className="py-2 px-2 rounded-xl bg-[#F5F2EA] hover:bg-[#EAE4D7] font-semibold cursor-pointer"
                    >
                      U-Tipi Mutfak
                    </button>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-bold text-[#141413]">Mimari Eleman Ekle</div>
                    {spaceWalls.length >= 1 && (
                      <PremiumSelect
                        ariaLabel="Hedef Duvar Seçimi"
                        title="Mimari elemanın ekleneceği duvarı seçin"
                        value={
                          spaceWalls.some((w) => w.id === activeWallId)
                            ? activeWallId || spaceWalls[0].id
                            : spaceWalls[0].id
                        }
                        options={spaceWalls.map((w) => ({
                          value: w.id,
                          label: w.name,
                          hint: `${Math.round(w.rotationY || 0)}°`,
                        }))}
                        onChange={(val) => setActiveWallId(val)}
                        menuWidthClass="min-w-[185px]"
                      />
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        {
                          type: "window" as const,
                          label: "Pencere",
                          name: "Pencere",
                          w: 900,
                          h: 1200,
                          d: 180,
                          y: 900,
                          svg: (
                            <svg viewBox="0 0 40 32" className="w-10 h-8" fill="none">
                              <rect x="6" y="4" width="28" height="24" rx="2" fill="#1E293B" stroke="#7DD3FC" strokeWidth="1.6" />
                              <rect x="9" y="7" width="10" height="18" rx="1" fill="#38BDF8" fillOpacity="0.28" stroke="#BAE6FD" strokeWidth="1.1" />
                              <rect x="21" y="7" width="10" height="18" rx="1" fill="#38BDF8" fillOpacity="0.28" stroke="#BAE6FD" strokeWidth="1.1" />
                              <line x1="4" y1="28.5" x2="36" y2="28.5" stroke="#E2E8F0" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                          ),
                        },
                        {
                          type: "column" as const,
                          label: "Kolon",
                          name: "Kolon",
                          w: 300,
                          h: ceilingHeightMm,
                          d: 300,
                          y: 0,
                          svg: (
                            <svg viewBox="0 0 40 32" className="w-10 h-8" fill="none">
                              <polygon points="12,5 24,5 28,8 28,27 16,27 12,24" fill="#334155" stroke="#CBD5E1" strokeWidth="1.5" strokeLinejoin="round" />
                              <rect x="12" y="5" width="12" height="22" fill="#475569" stroke="#F1F5F9" strokeWidth="1.4" />
                              <line x1="15" y1="9" x2="21" y2="15" stroke="#94A3B8" strokeWidth="1.1" />
                              <line x1="15" y1="15" x2="21" y2="21" stroke="#94A3B8" strokeWidth="1.1" />
                            </svg>
                          ),
                        },
                        {
                          type: "door" as const,
                          label: "Kapı",
                          name: "Oda Kapısı",
                          w: 900,
                          h: 2100,
                          d: 120,
                          y: 0,
                          svg: (
                            <svg viewBox="0 0 40 32" className="w-10 h-8" fill="none">
                              <rect x="10" y="3" width="20" height="26" rx="1.5" fill="#78350F" fillOpacity="0.65" stroke="#FCD34D" strokeWidth="1.5" />
                              <rect x="13" y="6" width="14" height="9" rx="1" stroke="#FDE68A" strokeWidth="1" opacity="0.7" />
                              <rect x="13" y="17" width="14" height="8" rx="1" stroke="#FDE68A" strokeWidth="1" opacity="0.7" />
                              <circle cx="26.5" cy="16" r="1.6" fill="#FBBF24" />
                            </svg>
                          ),
                        },
                        {
                          type: "beam" as const,
                          label: "Kiriş",
                          name: "Tavan Kirişi",
                          w: 1200,
                          h: 320,
                          d: 260,
                          y: Math.max(1800, ceilingHeightMm - 320),
                          svg: (
                            <svg viewBox="0 0 40 32" className="w-10 h-8" fill="none">
                              <rect x="4" y="5" width="32" height="10" rx="1.5" fill="#475569" stroke="#CBD5E1" strokeWidth="1.5" />
                              <line x1="8" y1="15" x2="14" y2="5" stroke="#94A3B8" strokeWidth="1.1" />
                              <line x1="17" y1="15" x2="23" y2="5" stroke="#94A3B8" strokeWidth="1.1" />
                              <line x1="26" y1="15" x2="32" y2="5" stroke="#94A3B8" strokeWidth="1.1" />
                              <line x1="4" y1="26" x2="36" y2="26" stroke="#64748B" strokeWidth="1.2" strokeDasharray="3 2" />
                            </svg>
                          ),
                        },
                        {
                          type: "plumbing" as const,
                          label: "Tesisat",
                          name: "Su Tesisatı",
                          w: 220,
                          h: 220,
                          d: 80,
                          y: 550,
                          svg: (
                            <svg viewBox="0 0 40 32" className="w-10 h-8" fill="none">
                              <circle cx="14" cy="14" r="5" fill="#0284C7" fillOpacity="0.35" stroke="#38BDF8" strokeWidth="1.6" />
                              <circle cx="26" cy="14" r="5" fill="#DC2626" fillOpacity="0.35" stroke="#FCA5A5" strokeWidth="1.6" />
                              <circle cx="20" cy="24" r="4" fill="#334155" stroke="#CBD5E1" strokeWidth="1.5" />
                            </svg>
                          ),
                        },
                        {
                          type: "electrical" as const,
                          label: "Priz",
                          name: "Elektrik Prizi",
                          w: 160,
                          h: 90,
                          d: 40,
                          y: 1100,
                          svg: (
                            <svg viewBox="0 0 40 32" className="w-10 h-8" fill="none">
                              <rect x="7" y="8" width="26" height="16" rx="3" fill="#1E293B" stroke="#FBBF24" strokeWidth="1.5" />
                              <circle cx="20" cy="16" r="5" stroke="#FDE68A" strokeWidth="1.2" />
                              <circle cx="18" cy="16" r="1.2" fill="#FEF08A" />
                              <circle cx="22" cy="16" r="1.2" fill="#FEF08A" />
                            </svg>
                          ),
                        },
                      ]
                    ).map((item) => {
                      const chosenWallId = spaceWalls.some((w) => w.id === activeWallId)
                        ? activeWallId || spaceWalls[0]?.id
                        : spaceWalls[0]?.id;
                      return (
                        <button
                          key={item.type}
                          type="button"
                          onClick={() =>
                            placeOnSelectedWall(
                              item.type,
                              item.name,
                              item.w,
                              item.h,
                              item.d,
                              item.y,
                              chosenWallId
                            )
                          }
                          className="py-2 px-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.16] border border-white/15 flex flex-col items-center justify-center gap-1 transition cursor-pointer"
                        >
                          {item.svg}
                          <span className="text-[10.5px] font-semibold leading-none">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {obstacles.length > 0 && (
                    <div className="pt-2 space-y-1.5 border-t border-[#F0ECE3]">
                      {obstacles.map((obs) => (
                        <div
                          key={obs.id}
                          className="flex flex-col gap-1.5 px-2.5 py-2 rounded-xl bg-[#FAF8F4] border border-[#EAE4D8]"
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="font-semibold text-[#141413] truncate">
                              {obs.name || obs.type} ({fmtLen(obs.dimensions.width, false)}×{fmtLen(obs.dimensions.height)})
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              {(obs.type === "door" || obs.type === "window") && (
                                <button
                                  type="button"
                                  title="Kanat / Menteşe Yönünü Aynala (Sol ↔ Sağ)"
                                  onClick={() =>
                                    updateSpaceObstacleStore(obs.id, {
                                      doorSwing: obs.doorSwing === "right" ? "left" : "right",
                                    })
                                  }
                                  className="px-1.5 py-0.5 rounded-md bg-white border border-[#DED8CC] hover:bg-[#EFECE4] text-[10px] font-bold text-[#141413] cursor-pointer"
                                >
                                  ⇄ {obs.doorSwing === "right" ? "Sağ" : "Sol"}
                                </button>
                              )}
                              {obs.type === "door" && (
                                <button
                                  type="button"
                                  title="İçe / Dışa Açılımı Aynala"
                                  onClick={() =>
                                    updateSpaceObstacleStore(obs.id, {
                                      doorOpenSide: obs.doorOpenSide === "outward" ? "inward" : "outward",
                                    })
                                  }
                                  className="px-1.5 py-0.5 rounded-md bg-white border border-[#DED8CC] hover:bg-[#EFECE4] text-[10px] font-bold text-[#141413] cursor-pointer"
                                >
                                  ⇅ {obs.doorOpenSide === "outward" ? "Dışa" : "İçe"}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => onRemoveSpaceObstacle(obs.id)}
                                className="w-6 h-6 rounded-full hover:bg-red-50 text-[#78716C] hover:text-red-600 flex items-center justify-center cursor-pointer"
                              >
                                ✕
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                            <label className="space-y-0.5">
                              <span className="text-[#78716C] block">En (mm)</span>
                              <input
                                type="number" inputMode="decimal"
                                min={40}
                                max={6000}
                                step={10}
                                value={Math.round(obs.dimensions.width)}
                                onChange={(e) => {
                                  const w = Math.max(40, Math.min(6000, Number(e.target.value) || obs.dimensions.width));
                                  updateSpaceObstacleStore(obs.id, {
                                    dimensions: { ...obs.dimensions, width: w },
                                  });
                                }}
                                className="w-full h-6 px-1.5 rounded-md bg-white border border-[#DED8CC] font-mono text-[10.5px] text-[#141413]"
                              />
                            </label>
                            <label className="space-y-0.5">
                              <span className="text-[#78716C] block">Boy (mm)</span>
                              <input
                                type="number" inputMode="decimal"
                                min={40}
                                max={4000}
                                step={10}
                                value={Math.round(obs.dimensions.height)}
                                onChange={(e) => {
                                  const h = Math.max(40, Math.min(4000, Number(e.target.value) || obs.dimensions.height));
                                  updateSpaceObstacleStore(obs.id, {
                                    dimensions: { ...obs.dimensions, height: h },
                                  });
                                }}
                                className="w-full h-6 px-1.5 rounded-md bg-white border border-[#DED8CC] font-mono text-[10.5px] text-[#141413]"
                              />
                            </label>
                            <label className="space-y-0.5">
                              <span className="text-[#78716C] block" title="Zeminden yükseklik (Kot)">Yerden (mm)</span>
                              <input
                                type="number" inputMode="decimal"
                                min={0}
                                max={4000}
                                step={10}
                                value={Math.round(obs.position.y)}
                                onChange={(e) => {
                                  const y = Math.max(0, Math.min(4000, Number(e.target.value) || 0));
                                  updateSpaceObstacleStore(obs.id, {
                                    position: { ...obs.position, y },
                                  });
                                }}
                                className="w-full h-6 px-1.5 rounded-md bg-white border border-[#DED8CC] font-mono text-[10.5px] text-[#141413]"
                              />
                            </label>
                            {(() => {
                              const isSideWall =
                                Math.abs((((obs.rotationY || 0) % 180) + 180) % 180 - 90) <= 15;
                              const alongVal = isSideWall ? obs.position.z : obs.position.x;
                              return (
                                <label className="space-y-0.5">
                                  <span
                                    className="text-[#78716C] block"
                                    title={isSideWall ? "Duvar boyunca konum (Z ekseni)" : "Duvar boyunca konum (X ekseni)"}
                                  >
                                    Konum (mm)
                                  </span>
                                  <input
                                    type="number" inputMode="decimal"
                                    min={-2000}
                                    max={12000}
                                    step={50}
                                    value={Math.round(alongVal)}
                                    onChange={(e) => {
                                      const nextAlong = Number(e.target.value) || 0;
                                      updateSpaceObstacleStore(obs.id, {
                                        position: isSideWall
                                          ? { ...obs.position, z: nextAlong }
                                          : { ...obs.position, x: nextAlong },
                                      });
                                    }}
                                    className="w-full h-6 px-1.5 rounded-md bg-white border border-[#DED8CC] font-mono text-[10.5px] text-[#141413]"
                                  />
                                </label>
                              );
                            })()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onChangeDrawer(null);
                    onOpenKitchenIslandModal();
                  }}
                  className="w-full py-3 px-4 rounded-2xl bg-[#141413] hover:bg-[#292524] text-white font-semibold flex items-center justify-between transition cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <UtensilsCrossed className="w-4 h-4 text-[#7DD3FC]" />
                    <span>Şelale Mutfak Adası & Açılı Masa Stüdyosu</span>
                  </span>
                  <span className="text-[#7DD3FC]">›</span>
                </button>
              </div>
            )}
    </>
  );
};
