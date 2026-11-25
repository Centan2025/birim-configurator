"use client";

import React from "react";
import { ArchitecturalElement } from "@birim/core";
import { toDisplayUnitNumber, toCanonicalMm } from "../workspace/elevation2dHelpers";
import { V3PremiumDropdown } from "../../design-system";

import type { CadPlan2DChromeOverlaysProps } from "./cad2dTypes";
export type { CadPlan2DChromeOverlaysProps };

export const CadPlan2DChromeOverlays: React.FC<CadPlan2DChromeOverlaysProps> = (props) => {
  const {
    activeModuleIndex,
    activeSpatialAlertIdx,
    addSpaceObstacle,
    addWallSegment,
    batchMoveSelectedModules,
    cadDrawerTab,
    drawWallStart,
    dropV4TemplateWithSnap,
    elevDisplayUnit,
    floorPlanInputRef,
    fmtPlanDim,
    handleAddObstacleClick,
    handleDeleteSelectedObject,
    handleFloorPlanFileChange,
    importWallsFromUnderlay,
    inlineEditWallId,
    inlineEditWallLength,
    isDrawingWall,
    isPlacingObstacle,
    liveSpatialAlerts,
    magnetEnabled,
    mainWall,
    newObstacleH,
    newObstacleRotY,
    newObstacleType,
    newObstacleW,
    newObstacleX,
    newObstacleY,
    newObstacleZ,
    obstacleTargetWallId,
    planRowSnapBanner,
    planScaleRatio,
    planSnapBannerTextRef,
    planSnapBannerWrapRef,
    printActive2DCadSheet,
    project,
    redo,
    removeWallSegment,
    resizeModuleParametric,
    resolveWallPlacementAlongTarget,
    selectAllModules,
    selectWallAndSyncObstacleTarget,
    selectedModuleIds,
    selectedModuleObj,
    selectedObstacleObj,
    selectedPlanObject,
    selectedWallObj,
    setActiveModuleIndex,
    setActiveSnapTarget,
    setActiveSpatialAlertIdx,
    setCadDrawerTab,
    setChainOriginPoint,
    setDrawWallCursor,
    setDrawWallStart,
    setFloorPlanUnderlay,
    setInlineEditWallId,
    setInlineEditWallLength,
    setIsDrawingWall,
    setIsPlacingObstacle,
    setMagnetEnabled,
    setModulePosition,
    setNewObstacleH,
    setNewObstacleRotY,
    setNewObstacleType,
    setNewObstacleW,
    setNewObstacleX,
    setNewObstacleY,
    setNewObstacleZ,
    setObstacleTargetWallId,
    setPanPx,
    setPlanRowSnapBanner,
    setPlanScaleRatio,
    setRoomDimensions,
    setSelectedPlanObject,
    setShowAdvancedCadBar,
    setShowPlanDimensions,
    setShowWallCoordsInPill,
    setSpatialAlertsMinimized,
    setWallDimDisplayMode,
    setZoom,
    showAdvancedCadBar,
    showPlanDimensions,
    showWallCoordsInPill,
    snapModuleToAngledWall,
    spaceObstacles,
    spaceWalls,
    spatialAlertsMinimized,
    swapModuleWithNeighbor,
    underlay,
    undo,
    updateSpaceObstacle,
    updateWallSegment,
    wallDimDisplayMode,
    zoom,
  } = props;
  return (
    <>
          {/* SINGLE-CARD CAROUSEL & MINIMIZABLE SPATIAL WARNING BAR (Never stacks vertically, never sits under top module dock) */}
          {liveSpatialAlerts.length > 0 && (() => {
            const safeIdx = Math.min(activeSpatialAlertIdx, liveSpatialAlerts.length - 1);
            const al = liveSpatialAlerts[safeIdx];
            const totalAlerts = liveSpatialAlerts.length;

            const handleAutoFixAllAlerts = (e: React.MouseEvent) => {
              e.stopPropagation();
              let curX = 50; // 50mm sol kör çıta payı
              const winObs = spaceObstacles.find((o) => o.type === "window");
              project.modules.forEach((m, mIdx) => {
                if (m.category === "complementary") return;
                const colObs = spaceObstacles.find(
                  (o) =>
                    (o.type === "column" || o.type === "beam") &&
                    curX < o.position.x + o.dimensions.width &&
                    curX + m.dimensions.width > o.position.x
                );
                if (colObs) {
                  curX = colObs.position.x + colObs.dimensions.width + 15;
                }
                setModulePosition(mIdx, curX, m.position.z, 1);
                if (
                  winObs &&
                  curX < winObs.position.x + winObs.dimensions.width &&
                  curX + m.dimensions.width > winObs.position.x &&
                  m.dimensions.height > winObs.position.y
                ) {
                  const safeH = Math.max(450, winObs.position.y - 10);
                  resizeModuleParametric(mIdx, m.dimensions.width, undefined, undefined, safeH);
                }
                curX += m.dimensions.width;
              });
              setPlanRowSnapBanner("✨ Tüm çakışma, kolon, pencere ve kör çıta uyarıları tek tıkla otomatik çözüldü!");
              setTimeout(() => setPlanRowSnapBanner(null), 3500);
            };

            return (
              <div
                data-testid="plan-live-spatial-warnings"
                style={{ left: "84px" }}
                className="fixed bottom-[104px] max-w-[320px] z-40 pointer-events-auto transition-[left] duration-200"
              >
                {spatialAlertsMinimized ? (
                  /* Ultra-Compact Single-Line Pill Mode */
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-2xl birim-dramatic-panel bg-[#252C3A]/68 backdrop-blur-2xl text-slate-100 border border-red-400/55 shadow-lg text-[11px]">
                    <span className="font-extrabold text-red-300 whitespace-nowrap">
                      ⚠️ {totalAlerts} Çakışma
                    </span>
                    <button
                      type="button"
                      data-testid="plan-autofix-all-minimized-btn"
                      onClick={handleAutoFixAllAlerts}
                      className="px-2 py-0.5 rounded-lg bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] text-white font-bold shadow-[0_0_12px_rgba(29,78,216,0.46)] text-[10px] whitespace-nowrap cursor-pointer transition"
                    >
                      🪄 Tümünü Çöz
                    </button>
                    <button
                      type="button"
                      data-testid="plan-alert-expand-btn"
                      onClick={() => setSpatialAlertsMinimized(false)}
                      className="px-1.5 py-0.5 rounded-lg bg-white/15 hover:bg-white/25 text-white font-bold text-[10px] cursor-pointer transition"
                      title="Uyarı detayını göster"
                    >
                      Aç ▾
                    </button>
                  </div>
                ) : (
                  /* Single-Card Carousel Mode (Shows 1 alert at a time with Prev/Next & Auto-Fix) */
                  <div
                    key={al.id}
                    onClick={() => {
                      if (typeof al.modIdx === "number") {
                        setActiveModuleIndex(al.modIdx);
                      }
                    }}
                    className={`px-3 py-2 rounded-2xl backdrop-blur-xl border shadow-xl text-[11px] leading-snug transition ${
                      al.severity === "error"
                        ? "birim-dramatic-panel bg-[#252C3A]/68 text-slate-100 border-red-400/55 ring-1 ring-red-500/25"
                        : "birim-dramatic-panel bg-[#252C3A]/68 text-slate-100 border-sky-400/55 ring-1 ring-sky-400/25"
                    }`}
                  >
                    {/* Carousel Header: Alert Count + Prev/Next Stepper + Fix All + Minimize */}
                    <div className="flex items-center justify-between gap-1.5 pb-1.5 mb-1.5 border-b border-white/15">
                      <div className="flex items-center gap-1">
                        <span className="px-1.5 py-0.5 rounded bg-red-500/30 text-red-200 font-black text-[10px] whitespace-nowrap">
                          ⚠️ {safeIdx + 1}/{totalAlerts} Uyarı
                        </span>
                        {totalAlerts > 1 && (
                          <div className="inline-flex items-center bg-white/10 rounded-lg p-0.5">
                            <button
                              type="button"
                              data-testid="plan-alert-prev-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveSpatialAlertIdx((prev) => (prev - 1 + totalAlerts) % totalAlerts);
                              }}
                              title="Önceki Uyarı"
                              className="px-1.5 py-0.2 rounded hover:bg-white/20 text-white font-bold text-[10px] cursor-pointer"
                            >
                              ‹
                            </button>
                            <button
                              type="button"
                              data-testid="plan-alert-next-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveSpatialAlertIdx((prev) => (prev + 1) % totalAlerts);
                              }}
                              title="Sonraki Uyarı"
                              className="px-1.5 py-0.2 rounded hover:bg-white/20 text-white font-bold text-[10px] cursor-pointer"
                            >
                              ›
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        {totalAlerts > 1 && (
                          <button
                            type="button"
                            data-testid="plan-autofix-all-btn"
                            onClick={handleAutoFixAllAlerts}
                            className="px-1.5 py-0.5 rounded-md bg-emerald-500/25 hover:bg-emerald-500/40 text-emerald-200 border border-emerald-400/40 font-extrabold text-[9px] whitespace-nowrap cursor-pointer transition"
                            title="Tüm çakışmaları tek tıkla otomatik çöz"
                          >
                            🪄 Tümünü Çöz
                          </button>
                        )}
                        <button
                          type="button"
                          data-testid="plan-alert-minimize-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSpatialAlertsMinimized(true);
                          }}
                          className="px-1.5 py-0.5 rounded-md bg-white/10 hover:bg-white/20 text-slate-200 font-bold text-[9px] cursor-pointer transition"
                          title="Uyarı kartını tek satıra küçült"
                        >
                          Küçült ▴
                        </button>
                      </div>
                    </div>

                    {/* Active Alert Title & Detail */}
                    <div className="font-extrabold flex items-center justify-between gap-2">
                      <span className="truncate">{al.title}</span>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/15 shrink-0">
                        X:{al.x}mm
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-200 mt-0.5 line-clamp-2">{al.detail}</div>

                    {/* 1-Click Auto-Resolve Actions for Active Alert */}
                    <div className="mt-1.5 pt-1.5 border-t border-white/15 flex flex-wrap items-center gap-1.5">
                      {al.kind === "window" && typeof al.modIdx === "number" && (
                        <>
                          <button
                            type="button"
                            data-testid={`plan-autofix-win-move-${al.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              const targetMod = project.modules[al.modIdx!];
                              const winObs = spaceObstacles.find((o) => o.type === "window");
                              if (targetMod && winObs) {
                                const rightCandidateX = winObs.position.x + winObs.dimensions.width + 20;
                                const leftCandidateX = Math.max(0, winObs.position.x - targetMod.dimensions.width - 20);
                                const nextX =
                                  rightCandidateX + targetMod.dimensions.width <= mainWall.length
                                    ? rightCandidateX
                                    : leftCandidateX;
                                setModulePosition(al.modIdx!, nextX, targetMod.position.z, 1);
                                setPlanRowSnapBanner(`✨ "${targetMod.name}" pencere açıklığının yanına (X:${nextX}mm) kaydırıldı`);
                                setTimeout(() => setPlanRowSnapBanner(null), 3000);
                              }
                            }}
                            className="px-2 py-1 rounded-lg bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] text-white font-bold shadow-[0_0_12px_rgba(29,78,216,0.46)] text-[10px] inline-flex items-center gap-1 cursor-pointer transition active:scale-95"
                          >
                            <span>🪄</span>
                            <span>Pencere Kenarına Kaydır</span>
                          </button>
                          <button
                            type="button"
                            data-testid={`plan-autofix-win-lower-${al.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              const targetMod = project.modules[al.modIdx!];
                              const winObs = spaceObstacles.find((o) => o.type === "window");
                              if (targetMod && winObs) {
                                const safeH = Math.max(450, winObs.position.y - (targetMod.category === "kitchen_base" ? 40 : 0) - 10);
                                resizeModuleParametric(al.modIdx!, targetMod.dimensions.width, undefined, undefined, safeH);
                                setPlanRowSnapBanner(`✨ "${targetMod.name}" yüksekliği pencere denizlik altına (${safeH}mm) indirildi`);
                                setTimeout(() => setPlanRowSnapBanner(null), 3000);
                              }
                            }}
                            className="px-2 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white font-bold text-[10px] inline-flex items-center gap-1 cursor-pointer transition"
                          >
                            <span>↕ Denizlik Altına İndir</span>
                          </button>
                        </>
                      )}

                      {al.kind === "plumbing" && (
                        <button
                          type="button"
                          data-testid={`plan-autofix-plumbing-${al.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            const plumbObs = spaceObstacles.find((o) => o.type === "plumbing");
                            if (typeof al.modIdx === "number") {
                              setActiveModuleIndex(al.modIdx);
                              dropV4TemplateWithSnap("tpl_kb_08_sink_base", plumbObs ? plumbObs.position.x : al.x);
                              setPlanRowSnapBanner("✨ Tesisat önüne uyumlu Eviye (Sink) Alt Modülü yerleştirildi");
                              setTimeout(() => setPlanRowSnapBanner(null), 3000);
                            } else if (plumbObs) {
                              dropV4TemplateWithSnap("tpl_kb_08_sink_base", Math.max(0, plumbObs.position.x - 200));
                              setPlanRowSnapBanner("✨ Açıkta kalan tesisat aksına Eviye (Sink) Alt Modülü eklendi");
                              setTimeout(() => setPlanRowSnapBanner(null), 3000);
                            }
                          }}
                          className="px-2 py-1 rounded-lg bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] text-white font-bold shadow-[0_0_12px_rgba(29,78,216,0.46)] text-[10px] inline-flex items-center gap-1 cursor-pointer transition active:scale-95"
                        >
                          <span>🪄</span>
                          <span>Tesisat Önüne Eviye Modülü Yerleştir</span>
                        </button>
                      )}

                      {al.kind === "door_swing" && typeof al.modIdx === "number" && (
                        <button
                          type="button"
                          data-testid={`plan-autofix-doorswing-${al.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            const targetMod = project.modules[al.modIdx!];
                            setActiveModuleIndex(al.modIdx!);
                            if (targetMod && targetMod.position.x < 50) {
                              setModulePosition(al.modIdx!, 50, targetMod.position.z, 1);
                            }
                            setPlanRowSnapBanner("✨ 50mm Kör Çıta (Duvar Açılım Payı) bırakılarak kapak sıkışması giderildi");
                            setTimeout(() => setPlanRowSnapBanner(null), 3000);
                          }}
                          className="px-2 py-1 rounded-lg bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] text-white font-bold shadow-[0_0_12px_rgba(29,78,216,0.46)] text-[10px] inline-flex items-center gap-1 cursor-pointer transition active:scale-95"
                        >
                          <span>🪄</span>
                          <span>50mm Kör Çıta Payı Bırak & Çöz</span>
                        </button>
                      )}

                      {(al.kind === "module_overlap" || al.kind === "column") && typeof al.modIdx === "number" && (
                        <button
                          type="button"
                          data-testid={`plan-autofix-overlap-${al.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            let curX = 0;
                            project.modules.forEach((m, mIdx) => {
                              if (m.category === "complementary") return;
                              const colObs = spaceObstacles.find(
                                (o) =>
                                  (o.type === "column" || o.type === "beam") &&
                                  curX < o.position.x + o.dimensions.width &&
                                  curX + m.dimensions.width > o.position.x
                              );
                              if (colObs) {
                                curX = colObs.position.x + colObs.dimensions.width + 10;
                              }
                              setModulePosition(mIdx, curX, m.position.z, 1);
                              curX += m.dimensions.width;
                            });
                            setPlanRowSnapBanner("✨ Modüller çakışmayacak şekilde sırayla duvara dizildi");
                            setTimeout(() => setPlanRowSnapBanner(null), 3000);
                          }}
                          className="px-2 py-1 rounded-lg bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] text-white font-bold shadow-[0_0_12px_rgba(29,78,216,0.46)] text-[10px] inline-flex items-center gap-1 cursor-pointer transition active:scale-95"
                        >
                          <span>🪄</span>
                          <span>Çakışmayı Otomatik Ayır & Hizala</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

                    {/* Inline Wall Dimension Click-to-Edit Popover */}
          {inlineEditWallId && (
            <div
              data-testid="plan-inline-wall-dim-editor"
              className="absolute top-14 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-white/95 backdrop-blur-xl px-3.5 py-2 rounded-2xl border-2 border-[#2563EB] shadow-xl text-xs"
            >
              <span className="font-bold text-[#111827]">Duvar Ölçüsü ({elevDisplayUnit}):</span>
              <input
                type="number" inputMode="decimal"
                data-testid="plan-inline-wall-dim-input"
                min={elevDisplayUnit === "cm" ? 50 : 500}
                max={elevDisplayUnit === "cm" ? 1500 : 15000}
                step={elevDisplayUnit === "cm" ? 5 : 50}
                value={toDisplayUnitNumber(inlineEditWallLength, elevDisplayUnit)}
                onChange={(e) =>
                  setInlineEditWallLength(
                    toCanonicalMm(Number(e.target.value) || (elevDisplayUnit === "cm" ? 360 : 3600), elevDisplayUnit)
                  )
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (inlineEditWallId === (spaceWalls[0]?.id || "wall_main")) {
                      setRoomDimensions(inlineEditWallLength, project.space.ceilingHeight || 2700);
                    } else {
                      updateWallSegment(inlineEditWallId, { length: inlineEditWallLength });
                    }
                    setInlineEditWallId(null);
                  } else if (e.key === "Escape") {
                    setInlineEditWallId(null);
                  }
                }}
                className="w-24 px-2 py-1 rounded-lg border border-[#CBD5E1] font-mono font-bold text-[#111827]"
              />
              <button
                type="button"
                data-testid="plan-inline-wall-dim-apply-btn"
                onClick={() => {
                  if (inlineEditWallId === (spaceWalls[0]?.id || "wall_main")) {
                    setRoomDimensions(inlineEditWallLength, project.space.ceilingHeight || 2700);
                  } else {
                    updateWallSegment(inlineEditWallId, { length: inlineEditWallLength });
                  }
                  setInlineEditWallId(null);
                }}
                className="px-3 py-1 rounded-lg bg-[#2563EB] text-white font-bold cursor-pointer"
              >
                Uygula
              </button>
              <button
                type="button"
                onClick={() => setInlineEditWallId(null)}
                className="px-2 py-1 rounded-lg bg-[#F1F5F9] text-[#475569] font-semibold cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* UNIFIED NON-OVERLAPPING BOTTOM DOCK STACK (Snap Toast + Selected Object Pill + CAD Drawer + Scale Bar) */}
          <div className="absolute bottom-2.5 left-2 right-2 z-20 flex flex-col items-center gap-1.5 pointer-events-none">
            {/* 0. Snap / Action Toast Banner (Ref-driven for 0-re-render 120fps plan drag) */}
            <div
              ref={planSnapBannerWrapRef}
              data-testid="plan-row-snap-banner"
              style={{ display: planRowSnapBanner ? "flex" : "none" }}
              className="pointer-events-none max-w-[calc(100%-16px)] px-3.5 py-1.5 rounded-2xl bg-slate-900/92 text-white border border-emerald-400/80 shadow-xl ring-1 ring-black/15 font-mono text-xs font-bold items-center gap-2 truncate"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              <span ref={planSnapBannerTextRef} className="truncate">
                {planRowSnapBanner || ""}
              </span>
            </div>

            {/* A. CONTEXTUAL FROSTED GLASS SELECTION PILL (Single-Row, Icon-First, Never Overlaps Scale Bar!) */}
            {selectedPlanObject && !showAdvancedCadBar && !isDrawingWall && !isPlacingObstacle && (
              <div
                data-testid="plan-selected-object-floating-pill"
                className="pointer-events-auto w-fit max-w-[calc(100%-8px)] flex flex-wrap items-center justify-center gap-1.5 birim-ice-pill px-2 py-1 rounded-2xl text-xs text-[#0F172A]"
              >
                {/* 1. SELECTED MODULE CONTEXT PILL */}
                {selectedModuleObj && (
                  <>
                    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-xl bg-blue-50/90 border border-blue-200/80 text-[#0F172A] shrink-0 whitespace-nowrap">
                      <span>📦</span>
                      <span className="font-extrabold">#{activeModuleIndex + 1}</span>
                      <span className="font-bold max-w-[120px] truncate">{selectedModuleObj.name}</span>
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-600 text-white">
                        {fmtPlanDim(selectedModuleObj.dimensions.width, false)}×{fmtPlanDim(selectedModuleObj.dimensions.depth)}
                      </span>
                    </div>

                    {project.modules.length > 1 && (
                      <div className="inline-flex items-center gap-0.5 bg-slate-100/90 p-0.5 rounded-xl border border-slate-200/80 shrink-0 whitespace-nowrap">
                        <button
                          type="button"
                          data-testid="plan-swap-mod-left-btn"
                          onClick={() => {
                            const res = swapModuleWithNeighbor(activeModuleIndex, "left");
                            if (res) {
                              setPlanRowSnapBanner(`🔄 Solundaki "${res.swappedWithName}" ile yer değiştirdi`);
                              setTimeout(() => setPlanRowSnapBanner(null), 2500);
                            }
                          }}
                          className="px-2 py-1 rounded-lg hover:bg-white text-[#0F172A] font-bold text-[11px] inline-flex items-center gap-1 transition active:scale-95 cursor-pointer"
                          title="Solundaki modülle yer değiştir"
                        >
                          <span>⇤</span><span className="sr-only">Sol</span>
                        </button>
                        <button
                          type="button"
                          data-testid="plan-swap-mod-right-btn"
                          onClick={() => {
                            const res = swapModuleWithNeighbor(activeModuleIndex, "right");
                            if (res) {
                              setPlanRowSnapBanner(`🔄 Sağındaki "${res.swappedWithName}" ile yer değiştirdi`);
                              setTimeout(() => setPlanRowSnapBanner(null), 2500);
                            }
                          }}
                          className="px-2 py-1 rounded-lg hover:bg-white text-[#0F172A] font-bold text-[11px] inline-flex items-center gap-1 transition active:scale-95 cursor-pointer"
                          title="Sağındaki modülle yer değiştir"
                        >
                          <span>⇥</span><span className="sr-only">Sağ</span>
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setMagnetEnabled((m) => !m)}
                      className={`px-2 py-1 rounded-xl font-bold text-[11px] inline-flex items-center gap-1 border transition active:scale-95 cursor-pointer shrink-0 whitespace-nowrap ${
                        magnetEnabled
                          ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                          : "bg-slate-100 text-slate-600 border-slate-200"
                      }`}
                      title="Mıknatıslı yapışmayı (Snap) aç/kapat"
                    >
                      <span>{magnetEnabled ? "🧲" : "🔓"}</span><span className="sr-only">{magnetEnabled ? "Snap" : "Serbest"}</span>
                    </button>

                    {spaceWalls.some((w) => ((w.rotationY || 0) % 90 + 90) % 90 !== 0) && (
                      <button
                        type="button"
                        data-testid="plan-selected-mod-snap-wall-btn"
                        onClick={() => {
                          const sol = snapModuleToAngledWall(activeModuleIndex);
                          if (sol) {
                            setPlanRowSnapBanner(
                              `📐 "${sol.wallName}" duvarına paralel (${sol.moduleRotationYDeg}°) hizalandı`
                            );
                            setTimeout(() => setPlanRowSnapBanner(null), 2600);
                          }
                        }}
                        className="px-2 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] inline-flex items-center gap-1 shadow-2xs transition active:scale-95 cursor-pointer shrink-0 whitespace-nowrap"
                        title="Seçili dolabı eğimli duvara paralel yasla"
                      >
                        <span>📐</span>
                        <span>Duvara Yasla</span>
                      </button>
                    )}
                  </>
                )}

                {/* 2. SELECTED WALL CONTEXT PILL */}
                {selectedWallObj && (
                  <>
                    <div className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-slate-100/90 border border-slate-200/80 font-extrabold text-[#0F172A] shrink-0 whitespace-nowrap">
                      <span>🧱</span>
                      <span>{selectedWallObj.name}</span>
                    </div>

                    <label className="inline-flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-xl border border-slate-200/90 text-[11px] shrink-0 whitespace-nowrap">
                      <span className="font-bold text-slate-500">↔</span>
                      <input
                        type="number" inputMode="decimal"
                        step={50}
                        min={200}
                        value={selectedWallObj.length}
                        onChange={(e) =>
                          updateWallSegment(selectedWallObj.id, {
                            length: Number(e.target.value) || 500,
                          })
                        }
                        className="w-15 px-1 py-0.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-[#0F172A]"
                      />
                    </label>

                    <label className="inline-flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-xl border border-slate-200/90 text-[11px] shrink-0 whitespace-nowrap">
                      <span className="font-bold text-slate-500">🔄</span>
                      <input
                        type="number" inputMode="decimal"
                        step={45}
                        value={selectedWallObj.rotationY}
                        onChange={(e) =>
                          updateWallSegment(selectedWallObj.id, {
                            rotationY: Number(e.target.value) || 0,
                          })
                        }
                        className="w-12 px-1 py-0.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-[#0F172A]"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => setShowWallCoordsInPill((v) => !v)}
                      className={`px-2 py-1 rounded-xl border text-[11px] font-bold transition cursor-pointer shrink-0 whitespace-nowrap ${
                        showWallCoordsInPill
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-slate-600 border-slate-200"
                      }`}
                      title="Duvar Başlangıç Konumunu Göster"
                    >
                      📍 Konum
                    </button>

                    {showWallCoordsInPill && (
                      <div className="inline-flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-xl border border-slate-200/90 text-[11px] shrink-0 whitespace-nowrap">
                        <span className="font-semibold text-slate-600">Yatay:</span>
                        <input
                          type="number" inputMode="decimal"
                          step={50}
                          value={selectedWallObj.position.x}
                          onChange={(e) =>
                            updateWallSegment(selectedWallObj.id, {
                              position: { x: Number(e.target.value) || 0 },
                            })
                          }
                          className="w-13 px-1 py-0.5 rounded border border-slate-300 bg-white font-mono font-bold"
                        />
                        <span className="font-semibold text-slate-600">Derinlik:</span>
                        <input
                          type="number" inputMode="decimal"
                          step={50}
                          value={selectedWallObj.position.z}
                          onChange={(e) =>
                            updateWallSegment(selectedWallObj.id, {
                              position: { z: Number(e.target.value) || 0 },
                            })
                          }
                          className="w-13 px-1 py-0.5 rounded border border-slate-300 bg-white font-mono font-bold"
                        />
                      </div>
                    )}

                    <div className="inline-flex items-center gap-1 bg-blue-50/90 px-1.5 py-0.5 rounded-xl border border-blue-200/80 shrink-0 whitespace-nowrap">
                      <button
                        type="button"
                        data-testid="plan-selected-wall-add-window-btn"
                        onClick={() => {
                          const placed = resolveWallPlacementAlongTarget(selectedWallObj, 950);
                          const cid = addSpaceObstacle({
                            type: "window",
                            name: "Pencere",
                            rotationY: placed.rotationY,
                            doorSwing: "left",
                            doorOpenSide: "inward",
                            position: { x: placed.x, y: 1000, z: placed.z },
                            dimensions: { width: 950, height: 1100, depth: 150 },
                          });
                          setSelectedPlanObject({ kind: "obstacle", id: cid });
                        }}
                        className="px-1.5 py-0.5 rounded-lg hover:bg-white text-[#0F172A] font-bold text-[10.5px] cursor-pointer"
                        title="Bu duvara paralel pencere ekle"
                      >
                        +🪟 Pencere
                      </button>
                      <button
                        type="button"
                        data-testid="plan-selected-wall-add-door-btn"
                        onClick={() => {
                          const placed = resolveWallPlacementAlongTarget(selectedWallObj, 900);
                          const cid = addSpaceObstacle({
                            type: "door",
                            name: "Oda Kapısı",
                            rotationY: placed.rotationY,
                            doorSwing: "left",
                            doorOpenSide: "inward",
                            position: { x: placed.x, y: 0, z: placed.z },
                            dimensions: { width: 900, height: 2100, depth: 150 },
                          });
                          setSelectedPlanObject({ kind: "obstacle", id: cid });
                        }}
                        className="px-1.5 py-0.5 rounded-lg hover:bg-white text-[#0F172A] font-bold text-[10.5px] cursor-pointer"
                        title="Bu duvara paralel kapı ekle"
                      >
                        +🚪 Kapı
                      </button>
                    </div>

                    {project.modules[activeModuleIndex] && (
                      <button
                        type="button"
                        data-testid="plan-selected-wall-snap-mod-btn"
                        onClick={() => {
                          const sol = snapModuleToAngledWall(activeModuleIndex, selectedWallObj.id);
                          if (sol) {
                            setPlanRowSnapBanner(
                              `📐 Seçili dolap "${sol.wallName}" duvarına paralel (${sol.moduleRotationYDeg}°) hizalandı`
                            );
                            setTimeout(() => setPlanRowSnapBanner(null), 2600);
                          }
                        }}
                        className="px-2 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] inline-flex items-center gap-1 shadow-2xs transition active:scale-95 cursor-pointer shrink-0 whitespace-nowrap"
                        title="Aktif dolabı bu duvara paralel yasla"
                      >
                        <span>📐</span>
                        <span>Dolabı Yasla</span>
                      </button>
                    )}
                  </>
                )}

                {/* 3. SELECTED OBSTACLE CONTEXT PILL */}
                {selectedObstacleObj && (
                  <>
                    <div className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-amber-50/90 border border-amber-200/90 font-extrabold text-amber-950 shrink-0 whitespace-nowrap">
                      <span>🎯</span>
                      <span>{selectedObstacleObj.name}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const nextRot = ((selectedObstacleObj.rotationY || 0) + 90) % 360;
                        const isNextSide = nextRot === 90 || nextRot === 270;
                        const nextPos = { ...selectedObstacleObj.position };
                        if (isNextSide && nextPos.z <= 50 && nextPos.x > 50) {
                          nextPos.z = Math.min(1000, Math.max(200, Math.round(nextPos.x * 0.35)));
                          nextPos.x = 0;
                        } else if (!isNextSide && nextPos.x <= 50 && nextPos.z > 50) {
                          nextPos.x = Math.max(400, nextPos.z);
                          nextPos.z = 0;
                        }
                        updateSpaceObstacle(selectedObstacleObj.id, {
                          rotationY: nextRot,
                          position: nextPos,
                        });
                      }}
                      className="px-2 py-1 rounded-xl bg-white hover:bg-blue-50 border border-slate-200/90 text-[#0F172A] font-bold text-[11px] inline-flex items-center gap-1 shadow-2xs transition active:scale-95 cursor-pointer shrink-0 whitespace-nowrap"
                      title="90° Döndür"
                    >
                      <span>🔄</span>
                      <span>{selectedObstacleObj.rotationY || 0}°</span>
                    </button>

                    {(selectedObstacleObj.type === "door" ||
                      selectedObstacleObj.type === "window" ||
                      selectedObstacleObj.type === "partition" ||
                      selectedObstacleObj.type === "niche") && (
                      <button
                        type="button"
                        data-testid="plan-pill-mirror-swing-btn"
                        onClick={() =>
                          updateSpaceObstacle(selectedObstacleObj.id, {
                            doorSwing:
                              selectedObstacleObj.doorSwing === "right" ? "left" : "right",
                          })
                        }
                        className="px-2 py-1 rounded-xl bg-white hover:bg-blue-50 border border-slate-200/90 text-[#0F172A] font-bold text-[11px] inline-flex items-center gap-1 shadow-2xs cursor-pointer shrink-0 whitespace-nowrap"
                        title="Kanat / Menteşe Yönünü Aynala (Kısayol: M)"
                      >
                        <span>⇄</span>
                        <span>Aynala ({selectedObstacleObj.doorSwing === "right" ? "Sağ" : "Sol"})</span>
                      </button>
                    )}

                    {selectedObstacleObj.type === "door" && (
                      <button
                        type="button"
                        data-testid="plan-pill-mirror-openside-btn"
                        onClick={() =>
                          updateSpaceObstacle(selectedObstacleObj.id, {
                            doorOpenSide:
                              selectedObstacleObj.doorOpenSide === "outward"
                                ? "inward"
                                : "outward",
                          })
                        }
                        className="px-2 py-1 rounded-xl bg-white hover:bg-amber-50 border border-slate-200/90 text-[#0F172A] font-bold text-[11px] inline-flex items-center gap-1 shadow-2xs cursor-pointer shrink-0 whitespace-nowrap"
                        title="Kapı İçe / Dışa Açılım Tarafını Aynala (Kısayol: Shift+M)"
                      >
                        <span>⇅</span>
                        <span>{selectedObstacleObj.doorOpenSide === "outward" ? "Dışa Açılır" : "İçe Açılır"}</span>
                      </button>
                    )}

                    <div className="inline-flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-xl border border-slate-200/90 text-[11px] shrink-0 whitespace-nowrap">
                      <label className="inline-flex items-center gap-0.5" title="Genişlik (W mm)">
                        <span className="font-bold text-slate-500">En:</span>
                        <input
                          type="number" inputMode="decimal"
                          step={50}
                          value={selectedObstacleObj.dimensions.width}
                          onChange={(e) =>
                            updateSpaceObstacle(selectedObstacleObj.id, {
                              dimensions: {
                                ...selectedObstacleObj.dimensions,
                                width: Math.max(100, Number(e.target.value) || 300),
                              },
                            })
                          }
                          className="w-13 px-1 py-0.5 rounded border border-slate-300 bg-white font-mono font-bold text-[#0F172A]"
                        />
                      </label>
                      <label className="inline-flex items-center gap-0.5" title="Yükseklik (H mm)">
                        <span className="font-bold text-slate-500">Boy:</span>
                        <input
                          type="number" inputMode="decimal"
                          step={50}
                          value={selectedObstacleObj.dimensions.height}
                          onChange={(e) =>
                            updateSpaceObstacle(selectedObstacleObj.id, {
                              dimensions: {
                                ...selectedObstacleObj.dimensions,
                                height: Math.max(50, Number(e.target.value) || 200),
                              },
                            })
                          }
                          className="w-13 px-1 py-0.5 rounded border border-slate-300 bg-white font-mono font-bold text-[#0F172A]"
                        />
                      </label>
                      <label className="inline-flex items-center gap-0.5" title="Yerden Kot (Y mm)">
                        <span className="font-bold text-slate-500">Kot:</span>
                        <input
                          type="number" inputMode="decimal"
                          step={50}
                          value={selectedObstacleObj.position.y}
                          onChange={(e) =>
                            updateSpaceObstacle(selectedObstacleObj.id, {
                              position: {
                                ...selectedObstacleObj.position,
                                y: Math.max(0, Number(e.target.value) || 0),
                              },
                            })
                          }
                          className="w-13 px-1 py-0.5 rounded border border-slate-300 bg-white font-mono font-bold text-[#0F172A]"
                        />
                      </label>
                    </div>
                  </>
                )}

                {/* Shared Delete + Close Pill Buttons */}
                <button
                  type="button"
                  onClick={handleDeleteSelectedObject}
                  className="px-2 py-1 rounded-xl bg-red-50 hover:bg-red-600 text-red-700 hover:text-white border border-red-200 font-bold text-[11px] inline-flex items-center gap-1 transition active:scale-95 cursor-pointer shrink-0 whitespace-nowrap"
                  title="Seçili objeyi sil (Delete / Backspace)"
                >
                  <span>🗑</span><span className="sr-only">Sil</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedPlanObject(null)}
                  className="w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 font-bold text-xs flex items-center justify-center transition cursor-pointer shrink-0"
                  title="Seçim Çubuğunu Kapat"
                >
                  ✕
                </button>
              </div>
            )}

            {/* B. CLEAN TABBED FROSTED GLASS CAD DRAWER (Stacked above Scale Bar, never overlaps!) */}
            <div
              data-testid="plan-room-architecture-bar"
              className={`pointer-events-auto w-fit max-w-[calc(100%-8px)] flex flex-col gap-2 birim-ice-popover px-3 py-2 rounded-2xl text-[11px] text-[#0F172A] transition-all duration-200 origin-bottom ${
                showAdvancedCadBar || isDrawingWall || isPlacingObstacle
                  ? "opacity-100 scale-y-100"
                  : "opacity-0 pointer-events-none h-0 overflow-hidden py-0 my-0 border-0 scale-y-95"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-slate-200/80">
                <div className="inline-flex items-center gap-1 bg-slate-100/90 p-0.5 rounded-xl border border-slate-200/80">
                  {[
                    { id: "wall" as const, icon: "🧱", label: "Oda & Duvar" },
                    { id: "obstacle" as const, icon: "🪟", label: "Yapı Elemanı" },
                    { id: "dxf" as const, icon: "📐", label: "Kat Planı (DXF)" },
                  ].map((tb) => (
                    <button
                      key={tb.id}
                      type="button"
                      onClick={() => setCadDrawerTab(tb.id)}
                      className={`px-2.5 py-1 rounded-lg font-bold text-[11px] inline-flex items-center gap-1 transition cursor-pointer ${
                        cadDrawerTab === tb.id
                          ? "bg-[#2563EB] text-white shadow-2xs"
                          : "text-slate-700 hover:bg-white"
                      }`}
                    >
                      <span>{tb.icon}</span>
                      <span>{tb.label}</span>
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    data-testid="plan-undo-btn"
                    onClick={undo}
                    className="px-2 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 font-bold cursor-pointer"
                    title="Geri Al (Ctrl+Z)"
                  >
                    ↶
                  </button>
                  <button
                    type="button"
                    data-testid="plan-redo-btn"
                    onClick={redo}
                    className="px-2 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 font-bold cursor-pointer"
                    title="İleri Al (Ctrl+Y)"
                  >
                    ↷
                  </button>
                  <button
                    type="button"
                    data-testid="plan-magnet-toggle-btn"
                    onClick={() => setMagnetEnabled((m) => !m)}
                    className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer ${
                      magnetEnabled
                        ? "bg-emerald-600 text-white shadow-2xs"
                        : "bg-slate-200 text-slate-800 hover:bg-slate-300"
                    }`}
                  >
                    {magnetEnabled ? "🧲 Snap" : "🔓 Serbest"}
                  </button>
                  <button
                    type="button"
                    data-testid="plan-select-all-modules-btn"
                    onClick={selectAllModules}
                    className="px-2 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold cursor-pointer"
                  >
                    Tümünü Seç ({selectedModuleIds.length}/{project.modules.length})
                  </button>
                  {selectedModuleIds.length > 1 && (
                    <>
                      <button
                        type="button"
                        data-testid="plan-batch-move-left-btn"
                        onClick={() => batchMoveSelectedModules(-100, 0)}
                        className="px-1.5 py-1 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 font-mono font-bold cursor-pointer"
                      >
                        ◀ -100
                      </button>
                      <button
                        type="button"
                        data-testid="plan-batch-move-right-btn"
                        onClick={() => batchMoveSelectedModules(100, 0)}
                        className="px-1.5 py-1 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 font-mono font-bold cursor-pointer"
                      >
                        +100 ▶
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setShowAdvancedCadBar(false);
                      setIsDrawingWall(false);
                      setIsPlacingObstacle(false);
                    }}
                    className="ml-1 w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* TAB 1: ODA & DUVAR ÇİZİMİ */}
              <div
                className={`flex flex-wrap items-center gap-2 ${
                  cadDrawerTab === "wall" || isDrawingWall ? "" : "hidden"
                }`}
              >
                <label className="inline-flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-600">↔ Duvar Boyu:</span>
                  <input
                    data-testid="plan-wall-length-input"
                    type="number" inputMode="decimal"
                    min={800}
                    max={12000}
                    step={100}
                    value={mainWall.length}
                    onChange={(e) =>
                      setRoomDimensions(
                        Number(e.target.value) || 3600,
                        project.space.ceilingHeight || 2600
                      )
                    }
                    className="w-16 px-1.5 py-0.5 rounded-lg bg-white border border-slate-300 font-mono font-bold text-[#0F172A]"
                  />
                </label>
                <label className="inline-flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-600">↕ Tavan:</span>
                  <input
                    data-testid="plan-ceiling-height-input"
                    type="number" inputMode="decimal"
                    min={1800}
                    max={5000}
                    step={50}
                    value={project.space.ceilingHeight || 2600}
                    onChange={(e) =>
                      setRoomDimensions(
                        mainWall.length,
                        Number(e.target.value) || 2600
                      )
                    }
                    className="w-16 px-1.5 py-0.5 rounded-lg bg-white border border-slate-300 font-mono font-bold text-[#0F172A]"
                  />
                </label>

                <button
                  type="button"
                  data-testid="plan-draw-wall-toggle"
                  onClick={() => {
                    setIsDrawingWall((v) => !v);
                    setIsPlacingObstacle(false);
                    setDrawWallStart(null);
                    setDrawWallCursor(null);
                    setChainOriginPoint(null);
                    setActiveSnapTarget(null);
                  }}
                  className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                    isDrawingWall
                      ? "bg-[#2563EB] text-white shadow-xs"
                      : "bg-white hover:bg-blue-50 text-[#0F172A] border border-slate-200"
                  }`}
                >
                  {isDrawingWall
                    ? drawWallStart
                      ? "🔗 Sonraki Noktayı Tıklayın..."
                      : "1. Başlangıç Noktasını Tıklayın..."
                    : "✏️ Serbest Duvar Çiz"}
                </button>

                <button
                  type="button"
                  data-testid="plan-add-45deg-wall-btn"
                  onClick={() => {
                    addWallSegment({
                      name: `Açılı Duvar ${spaceWalls.length + 1}`,
                      length: 1800,
                      height: project.space.ceilingHeight || 2600,
                      thickness: 150,
                      position: { x: mainWall.length, y: 0, z: 0 },
                      rotationY: 45,
                    });
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-amber-50 text-[#0F172A] border border-slate-200 font-bold cursor-pointer"
                  data-tooltip="+45° Açılı Duvar Segmenti Ekle"
                >
                  + 45° Açılı Duvar
                </button>

                <button
                  type="button"
                  data-testid="plan-snap-module-parallel-wall-btn"
                  onClick={() => {
                    const targetWallId =
                      selectedPlanObject?.kind === "wall" ? selectedPlanObject.id : undefined;
                    const sol = snapModuleToAngledWall(activeModuleIndex, targetWallId);
                    if (sol) {
                      setPlanRowSnapBanner(
                        `📐 Seçili dolap "${sol.wallName}" duvarına paralel (${sol.moduleRotationYDeg}°) hizalandı`
                      );
                      setTimeout(() => setPlanRowSnapBanner(null), 2600);
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer"
                  data-tooltip="Dolabı Açılı Duvara Paralel Yasla"
                >
                  📐 Dolabı Duvara Paralel Yasla
                </button>

                {isDrawingWall && drawWallStart && (
                  <button
                    type="button"
                    data-testid="plan-finish-wall-chain-btn"
                    onClick={() => {
                      setDrawWallStart(null);
                      setDrawWallCursor(null);
                      setChainOriginPoint(null);
                      setActiveSnapTarget(null);
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                  >
                    ✓ Bitir (Esc)
                  </button>
                )}

                {spaceWalls.length > 1 && (
                  <button
                    type="button"
                    data-testid="plan-remove-last-wall-btn"
                    onClick={() => removeWallSegment(spaceWalls[spaceWalls.length - 1].id)}
                    className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-red-50 border border-slate-200 text-slate-600 hover:text-red-700 font-bold cursor-pointer"
                  >
                    🗑 Son Duvarı Sil ({spaceWalls.length})
                  </button>
                )}
              </div>

              {/* TAB 2: YAPI ELEMANI EKLE */}
              <div
                className={`flex flex-wrap items-center gap-1.5 ${
                  cadDrawerTab === "obstacle" || isPlacingObstacle ? "" : "hidden"
                }`}
              >
                <div className="inline-flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                  {[
                    { id: "plumbing", icon: "🚰", label: "Tesisat" },
                    { id: "electrical", icon: "⚡", label: "Priz" },
                    { id: "window", icon: "🪟", label: "Pencere" },
                    { id: "door", icon: "🚪", label: "Kapı" },
                    { id: "column", icon: "🏛️", label: "Kolon" },
                    { id: "beam", icon: "🧱", label: "Kiriş" },
                  ].map((ot) => (
                    <button
                      key={ot.id}
                      type="button"
                      data-testid={`plan-obs-quick-${ot.id}`}
                      onClick={() => {
                        const t = ot.id as ArchitecturalElement["type"];
                        setNewObstacleType(t);
                        if (t === "window") {
                          setNewObstacleW(950);
                          setNewObstacleH(1100);
                          setNewObstacleY(1000);
                        } else if (t === "door") {
                          setNewObstacleW(900);
                          setNewObstacleH(2100);
                          setNewObstacleY(0);
                        } else if (t === "plumbing") {
                          setNewObstacleW(200);
                          setNewObstacleH(250);
                          setNewObstacleY(450);
                        } else if (t === "electrical") {
                          setNewObstacleW(160);
                          setNewObstacleH(160);
                          setNewObstacleY(1150);
                        } else if (t === "column") {
                          setNewObstacleW(250);
                          setNewObstacleH(2600);
                          setNewObstacleY(0);
                        } else if (t === "beam") {
                          setNewObstacleW(300);
                          setNewObstacleH(300);
                          setNewObstacleY((project.space.ceilingHeight || 2600) - 300);
                        }
                      }}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition cursor-pointer ${
                        newObstacleType === ot.id
                          ? "bg-[#2563EB] text-white shadow-2xs"
                          : "text-slate-700 hover:bg-white"
                      }`}
                    >
                      <span>{ot.icon}</span>
                      <span>{ot.label}</span>
                    </button>
                  ))}
                </div>

                <select
                  data-testid="plan-obstacle-type-select"
                  value={newObstacleType}
                  onChange={(e) =>
                    setNewObstacleType(e.target.value as ArchitecturalElement["type"])
                  }
                  className="hidden"
                >
                  <option value="column">Kolon</option>
                  <option value="window">Pencere</option>
                  <option value="door">Kapı</option>
                  <option value="beam">Kiriş</option>
                  <option value="plumbing">Tesisat</option>
                  <option value="electrical">Elektrik Prizi (Y:1150mm)</option>
                </select>

                <V3PremiumDropdown
                  variant="popover"
                  size="sm"
                  className="w-40"
                  testId="plan-obstacle-wall-select"
                  value={
                    selectedPlanObject?.kind === "wall" &&
                    spaceWalls.some((w) => w.id === selectedPlanObject.id)
                      ? selectedPlanObject.id
                      : obstacleTargetWallId
                  }
                  onChange={(val) => {
                    setObstacleTargetWallId(val);
                    if (val !== "custom_xz") {
                      selectWallAndSyncObstacleTarget(val);
                    }
                  }}
                  options={[
                    ...spaceWalls.map((w) => ({
                      value: w.id,
                      label: `${w.name} (${Math.round(w.rotationY || 0)}°)`,
                    })),
                    { value: "custom_xz", label: "Serbest (X, Z)" },
                  ]}
                />

                <input
                  data-testid="plan-obstacle-x-input"
                  type="number" inputMode="decimal"
                  step={50}
                  value={newObstacleX}
                  onChange={(e) => setNewObstacleX(Number(e.target.value) || 0)}
                  className="w-14 px-1.5 py-1 rounded-xl border border-slate-300 bg-white font-mono font-bold text-[11px]"
                />
                {obstacleTargetWallId === "custom_xz" && (
                  <input
                    data-testid="plan-obstacle-z-input"
                    type="number" inputMode="decimal"
                    step={50}
                    value={newObstacleZ}
                    onChange={(e) => setNewObstacleZ(Number(e.target.value) || 0)}
                    className="w-14 px-1.5 py-1 rounded-xl border border-slate-300 bg-white font-mono font-bold text-[11px]"
                  />
                )}

                <label className="inline-flex items-center gap-0.5 text-[10px] bg-slate-50 px-1.5 py-0.5 rounded-lg border border-slate-200">
                  <span className="font-bold text-slate-500">En:</span>
                  <input
                    data-testid="plan-obstacle-width-input"
                    type="number" inputMode="decimal"
                    step={50}
                    value={newObstacleW}
                    onChange={(e) => setNewObstacleW(Number(e.target.value) || 250)}
                    className="w-12 px-1 py-0.5 rounded border border-slate-300 bg-white font-mono font-bold text-[11px]"
                  />
                </label>
                <label className="inline-flex items-center gap-0.5 text-[10px] bg-slate-50 px-1.5 py-0.5 rounded-lg border border-slate-200">
                  <span className="font-bold text-slate-500">Boy:</span>
                  <input
                    data-testid="plan-obstacle-height-input"
                    type="number" inputMode="decimal"
                    step={50}
                    value={newObstacleH}
                    onChange={(e) => setNewObstacleH(Number(e.target.value) || 1000)}
                    className="w-12 px-1 py-0.5 rounded border border-slate-300 bg-white font-mono font-bold text-[11px]"
                  />
                </label>
                <label className="inline-flex items-center gap-0.5 text-[10px] bg-slate-50 px-1.5 py-0.5 rounded-lg border border-slate-200">
                  <span className="font-bold text-slate-500">Kot:</span>
                  <input
                    data-testid="plan-obstacle-elevation-input"
                    type="number" inputMode="decimal"
                    step={50}
                    value={newObstacleY}
                    onChange={(e) => setNewObstacleY(Math.max(0, Number(e.target.value) || 0))}
                    className="w-12 px-1 py-0.5 rounded border border-slate-300 bg-white font-mono font-bold text-[11px]"
                  />
                </label>

                <button
                  type="button"
                  data-testid="plan-obstacle-pre-rotate-btn"
                  onClick={() => setNewObstacleRotY((r) => (r + 90) % 360)}
                  className="px-2 py-1 rounded-xl bg-white hover:bg-blue-50 border border-slate-300 font-mono text-[10px] font-bold text-[#0F172A] cursor-pointer"
                >
                  🔄 {newObstacleRotY}°
                </button>
                <button
                  type="button"
                  data-testid="plan-add-obstacle-btn"
                  onClick={handleAddObstacleClick}
                  className="px-2.5 py-1 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold cursor-pointer"
                >
                  + Ekle
                </button>
                <button
                  type="button"
                  data-testid="plan-place-obstacle-click-toggle"
                  onClick={() => {
                    setIsPlacingObstacle((v) => !v);
                    setIsDrawingWall(false);
                    setDrawWallStart(null);
                  }}
                  className={`px-2.5 py-1 rounded-xl font-bold cursor-pointer ${
                    isPlacingObstacle
                      ? "bg-amber-600 text-white"
                      : "bg-white hover:bg-slate-100 text-slate-700 border border-slate-200"
                  }`}
                >
                  {isPlacingObstacle ? "🎯 Planda Tıklayın..." : "🎯 Tıkla Yerleştir"}
                </button>
              </div>

              {/* TAB 3: DWG / DXF / PDF KAT PLANI ALTLIĞI */}
              <div
                className={`flex flex-wrap items-center gap-2 ${
                  cadDrawerTab === "dxf" ? "" : "hidden"
                }`}
              >
                <input
                  ref={floorPlanInputRef}
                  data-testid="plan-upload-floorplan-input"
                  type="file"
                  accept=".dxf,.dwg,.pdf,.svg,.png,.jpg,.jpeg"
                  onChange={handleFloorPlanFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  data-testid="plan-upload-floorplan-btn"
                  onClick={() => floorPlanInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold cursor-pointer"
                >
                  📐 DWG / DXF / PDF Kat Planı Yükle
                </button>
                {underlay && (
                  <>
                    <span
                      data-testid="plan-underlay-badge"
                      className="px-2.5 py-1 rounded-xl bg-slate-100 font-mono text-[10px] font-bold text-slate-700"
                    >
                      {underlay.fileName} ({underlay.polylines?.length || 0} çizgi)
                    </span>
                    {(underlay.polylines?.length || 0) > 0 && (
                      <button
                        type="button"
                        data-testid="plan-import-dxf-walls-btn"
                        onClick={() => importWallsFromUnderlay(false)}
                        className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                      >
                        Duvara Dönüştür
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setFloorPlanUnderlay(null)}
                      className="px-2 py-1 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 font-bold cursor-pointer"
                    >
                      Altlığı Kaldır ✕
                    </button>
                  </>
                )}
              </div>

              {selectedPlanObject && (
                <div data-testid="plan-selected-object-bar" className="hidden">
                  {selectedWallObj && (
                    <>
                      <input data-testid="plan-selected-wall-x-input" type="number" inputMode="decimal" value={selectedWallObj.position.x} onChange={(e) => updateWallSegment(selectedWallObj.id, { position: { x: Number(e.target.value) || 0 } })} />
                      <input data-testid="plan-selected-wall-z-input" type="number" inputMode="decimal" value={selectedWallObj.position.z} onChange={(e) => updateWallSegment(selectedWallObj.id, { position: { z: Number(e.target.value) || 0 } })} />
                      <input data-testid="plan-selected-wall-length-input" type="number" inputMode="decimal" value={selectedWallObj.length} onChange={(e) => updateWallSegment(selectedWallObj.id, { length: Number(e.target.value) || 500 })} />
                      <input data-testid="plan-selected-wall-angle-input" type="number" inputMode="decimal" value={selectedWallObj.rotationY} onChange={(e) => updateWallSegment(selectedWallObj.id, { rotationY: Number(e.target.value) || 0 })} />
                    </>
                  )}
                  {selectedObstacleObj && (
                    <>
                      <button type="button" data-testid="plan-rotate-obstacle-btn" onClick={() => updateSpaceObstacle(selectedObstacleObj.id, { rotationY: ((selectedObstacleObj.rotationY || 0) + 90) % 360 })} />
                      <button type="button" data-testid="plan-flip-door-swing-btn" onClick={() => updateSpaceObstacle(selectedObstacleObj.id, { doorSwing: selectedObstacleObj.doorSwing === "right" ? "left" : "right" })} />
                      <input data-testid="plan-selected-obs-width-input" type="number" inputMode="decimal" value={selectedObstacleObj.dimensions.width} onChange={(e) => updateSpaceObstacle(selectedObstacleObj.id, { dimensions: { ...selectedObstacleObj.dimensions, width: Math.max(100, Number(e.target.value) || 300) } })} />
                      <input data-testid="plan-selected-obs-height-input" type="number" inputMode="decimal" value={selectedObstacleObj.dimensions.height} onChange={(e) => updateSpaceObstacle(selectedObstacleObj.id, { dimensions: { ...selectedObstacleObj.dimensions, height: Math.max(50, Number(e.target.value) || 200) } })} />
                      <input data-testid="plan-selected-obs-elevation-input" type="number" inputMode="decimal" value={selectedObstacleObj.position.y} onChange={(e) => updateSpaceObstacle(selectedObstacleObj.id, { position: { ...selectedObstacleObj.position, y: Math.max(0, Number(e.target.value) || 0) } })} />
                    </>
                  )}
                  <button type="button" data-testid="plan-delete-selected-object-btn" onClick={handleDeleteSelectedObject} />
                </div>
              )}
            </div>

            {/* C. BOTTOM 2D SCALE, PAN & VIEW BAR (Stacked at the bottom of the Unified Dock — Never Overlaps!) */}
            <div
              data-testid="plan-bottom-scale-bar"
              className="pointer-events-auto w-fit max-w-[calc(100%-8px)] flex flex-wrap items-center justify-center gap-1.5 bg-white/88 backdrop-blur-xl px-2.5 py-1.5 rounded-2xl border border-white/90 ring-1 ring-slate-900/10 shadow-[0_10px_28px_rgba(15,23,42,0.14)] text-xs text-[#0F172A]"
            >
              <div
                title="Kuzey Yönü • Sağ Tuş veya Boş Alanı Sürükleyerek Pan Yapabilirsiniz"
                className="w-7 h-7 rounded-full bg-[#F8FAFC] border border-[#CBD5E1] flex items-center justify-center font-extrabold text-[10px] text-[#0F172A] shadow-2xs shrink-0 whitespace-nowrap"
              >
                N▲
              </div>

              <V3PremiumDropdown
                variant="popover"
                size="sm"
                className="w-24 shrink-0"
                testId="plan-scale-select"
                value={String(planScaleRatio)}
                onChange={(val) => {
                  const sc = Number(val) as 20 | 25 | 50;
                  setPlanScaleRatio(sc);
                  setZoom(sc === 20 ? 1.25 : sc === 25 ? 1.0 : 0.65);
                }}
                options={[
                  { value: "20", label: "1:20" },
                  { value: "25", label: "1:25" },
                  { value: "50", label: "1:50" },
                ]}
              />

              <div className="inline-flex items-center birim-ice-btn rounded-xl p-0.5 shrink-0 whitespace-nowrap">
                <button
                  type="button"
                  data-testid="plan-zoom-out-btn"
                  onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.15).toFixed(2)))}
                  className="w-6 h-6 rounded-lg hover:bg-white font-mono font-bold text-sm flex items-center justify-center cursor-pointer"
                  title="Uzaklaştır (−)"
                >
                  −
                </button>
                <span className="font-mono text-[11px] font-bold px-1 min-w-[38px] text-center text-[#0F172A]">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  data-testid="plan-zoom-in-btn"
                  onClick={() => setZoom((z) => Math.min(3.5, +(z + 0.15).toFixed(2)))}
                  className="w-6 h-6 rounded-lg hover:bg-white font-mono font-bold text-sm flex items-center justify-center cursor-pointer"
                  title="Yakınlaştır (+)"
                >
                  +
                </button>
              </div>

              <button
                type="button"
                data-testid="plan-zoom-fit-btn"
                onClick={() => {
                  setZoom(1);
                  setPanPx({ x: 0, y: 0 });
                }}
                title="Plana Sığdır ve Merkeze Al (Sağ Tuş basılı tutarak da kaydırabilirsiniz)"
                className="w-7 h-7 rounded-xl birim-ice-btn text-xs font-bold text-[#0F172A] inline-flex items-center justify-center shrink-0 transition active:scale-95 cursor-pointer"
              >
                <span>⛶</span>
                <span className="sr-only">Sığdır</span>
              </button>

              {/* Ölçü birimi (mm/cm) ve etiket boyutu üst header ayarlarından global olarak yönetilir */}

              <label
                title="Plan Ölçü Çizgilerini Göster / Gizle"
                className={`w-7 h-7 rounded-xl inline-flex items-center justify-center cursor-pointer select-none shrink-0 transition ${
                  showPlanDimensions ? "birim-ice-btn-active" : "birim-ice-btn text-[#0F172A]"
                }`}
              >
                <input
                  type="checkbox"
                  data-testid="plan-toggle-dimensions-checkbox"
                  checked={showPlanDimensions}
                  onChange={(e) => setShowPlanDimensions(e.target.checked)}
                  className="sr-only"
                />
                <span className="text-xs leading-none">📏</span>
                <span className="sr-only">Ölçüler</span>
              </label>

              <V3PremiumDropdown
                variant="popover"
                size="sm"
                className="w-32 shrink-0"
                testId="plan-wall-dim-mode-select"
                value={wallDimDisplayMode}
                onChange={(val) =>
                  setWallDimDisplayMode(val as "net_inner" | "outer" | "plinth")
                }
                options={[
                  { value: "net_inner", label: "Net İç Ölçü" },
                  { value: "outer", label: "Dış Duvar" },
                  { value: "plinth", label: "Baza / Soket" },
                ]}
              />

              <button
                type="button"
                data-testid="plan-toggle-advanced-cad-btn"
                onClick={() => setShowAdvancedCadBar((v) => !v)}
                title="Detaylı CAD & Yapı Elemanı Çubuğunu Aç/Kapat"
                className={`w-7 h-7 rounded-xl text-xs font-bold inline-flex items-center justify-center shrink-0 transition active:scale-95 cursor-pointer ${
                  showAdvancedCadBar
                    ? "birim-ice-btn-active"
                    : "birim-ice-btn text-[#0F172A]"
                }`}
              >
                <span>🛠</span>
                <span className="sr-only">CAD</span>
              </button>
              <button
                type="button"
                data-testid="plan-print-a4-btn"
                onClick={() => printActive2DCadSheet("plan")}
                title="Mekân Yerleşim Planını A4 Yatay Olarak Yazdır / PDF Kaydet"
                className="h-7 px-2.5 rounded-xl birim-ice-btn text-[11px] font-bold text-[#F8FAFC] inline-flex items-center gap-1 shrink-0 transition active:scale-95 cursor-pointer"
              >
                <span>🖨</span>
                <span>Yazdır</span>
              </button>
            </div>
          </div>

    </>
  );
};
