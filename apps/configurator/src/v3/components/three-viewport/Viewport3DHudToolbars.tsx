"use client";
import React from "react";
import { CeilingAndEngineeringQuickPopover } from "../workspace/CeilingAndGrain2DOverlays";
import * as THREE from "three";
import { type ArchitecturalFloorStyle, type ArchitecturalWallTone } from "../../materials/pbrMaterialSystem";
import { WardrobeGlbLibraryModal } from "../WardrobeGlbLibraryModal";
import { RotateCw, Columns, Eye, EyeOff } from "lucide-react";
import { computeHeroStudioFraming } from "./viewport3DSharedAssets";
import { computeFastParametricSceneBounds } from "./viewport3DSceneHelpers";

import type { Viewport3DHudToolbarsProps } from "./viewport3DTypes";
export type { Viewport3DHudToolbarsProps };

export const Viewport3DHudToolbars: React.FC<Viewport3DHudToolbarsProps> = (props) => {
  const {
    activeBayIndex,
    activeCamPill,
    activeModule,
    addAdjacentModule,
    addStackedTopModule,
    controlsRef,
    cutawayActiveBay,
    depth,
    doorOpenAngleDeg,
    doorsHiddenIn3D,
    effectiveShowDimensions,
    explode3DMenuOpen,
    explodedFactor,
    flipActiveDoorDirection,
    floorStyle,
    glbLibraryOpen,
    handleToggleDimensions,
    hardwareViewMenuOpen,
    hardwareViewMode,
    isSimpleTier,
    isXrayActive,
    lightingPreset,
    materialModeActive,
    materialPaintTool,
    minimalChrome,
    moveObjectMode3D,
    orthoCamRef,
    perspCamRef,
    project,
    removeBayAt,
    renderEdgeMode,
    renderMenuOpen,
    requestRender,
    resetModuleMaterialOverrides,
    rotateActiveModule90,
    section3DAxis,
    section3DMenuOpen,
    section3DRatio,
    setActiveCamPill,
    setCncXrayMode,
    setCutawayActiveBay,
    setDismissedBayPopover,
    setDoorOpenAngleDeg,
    setDoorsHiddenIn3D,
    setExplode3DMenuOpen,
    setExplodedFactor,
    setFacadeGrainContinuityStore,
    setFloorStyle,
    setGlbLibraryOpen,
    setHardwareViewMenuOpen,
    setHardwareViewMode,
    setLightingPreset,
    setMaterialPaintTool,
    setMoveObjectMode3D,
    setRenderEdgeMode,
    setRenderMenuOpen,
    setRoomDimensionsStore,
    setSection3DAxis,
    setSection3DMenuOpen,
    setSection3DRatio,
    setShowInteriorProps3D,
    setShowRoomArchitecture3D,
    setSnapBannerDedup,
    setUltraRenderProgress,
    setViewportRenderStyle,
    setWallTone,
    showInCanvasHud,
    showInteriorProps3D,
    showRoomArchitecture3D,
    snapBadgeDomRef,
    snapBadgeLabelRef,
    snapBadgeYRef,
    spaceWalls,
    splitBayIntoTwo,
    stageSafeInsets,
    toggleDoorOpen,
    ultraRenderProgress,
    updateCarcassStore,
    updateCeilingConfigStore,
    viewportRenderStyle,
    wallTone,
    width,
  } = props;
  return (
    <>
        {/* Live Cross-Module / Cross-Bay Elevation Snap Badge during 3D Drag */}
        <div
          ref={snapBadgeDomRef}
          data-testid="in-canvas-snap-badge"
          style={{ display: "none" }}
          className="absolute top-16 left-1/2 -translate-x-1/2 z-20 pointer-events-none px-3.5 py-1.5 rounded-full birim-ice-pill text-[#1C1917] text-xs font-bold items-center gap-2"
        >
          <span ref={snapBadgeLabelRef} />
          <span ref={snapBadgeYRef} className="px-2 py-0.5 rounded-full bg-[#F1F5F9] text-[#1C1917] font-mono" />
        </div>

        {/* LEFT VERTICAL VIEW & CAMERA PILL (Design Studio: 3D | 2D Plan | Ön | Yan | Üst | İç Görünüm | Fit) */}
        <div
          data-testid="viewport-3d-visual-quality-bar"
          className="sr-only"
        >
          {[
            {
              id: "3d",
              label: "3D",
              icon: (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 3L4 7.5v9L12 21l8-4.5v-9L12 3z" />
                  <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
                </svg>
              ),
              onClick: () => {
                setActiveCamPill("3d");
                const controls = controlsRef.current,
                  perspective = perspCamRef.current;
                if (controls && perspective) {
                  const bounds = computeFastParametricSceneBounds(project.modules);
                  if (!bounds.isEmpty()) {
                    const framed = computeHeroStudioFraming(
                      bounds,
                      perspective.fov,
                      perspective.aspect,
                      "hero"
                    );
                    controls.target.copy(framed.target);
                    perspective.position.copy(framed.position);
                    perspective.lookAt(framed.target);
                    perspective.updateProjectionMatrix();
                    controls.update();
                    requestRender();
                  }
                }
              },
            },
            {
              id: "2d-elevation",
              label: "2D Cephe",
              icon: (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M12 3v18M3 15h18" />
                </svg>
              ),
              onClick: () => {
                if (typeof window !== "undefined") {
                  window.dispatchEvent(
                    new CustomEvent("birim:studio-view-change", { detail: "2d-elevation" })
                  );
                }
              },
            },
            {
              id: "2d-section",
              label: "2D Kesit",
              icon: (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="5" y="3" width="14" height="18" rx="2" />
                  <path d="M5 9h14M5 15h14" />
                </svg>
              ),
              onClick: () => {
                if (typeof window !== "undefined") {
                  window.dispatchEvent(
                    new CustomEvent("birim:studio-view-change", { detail: "2d-section" })
                  );
                }
              },
            },
            {
              id: "2d",
              label: "2D Plan",
              icon: (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 9h18M9 9v12" />
                </svg>
              ),
              onClick: () => {
                setActiveCamPill("2d");
                if (typeof window !== "undefined") {
                  window.dispatchEvent(new CustomEvent("birim:studio-view-change", { detail: "plan" }));
                }
              },
            },
            {
              id: "front",
              label: "Ön",
              icon: (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                  <path d="M4 9h16" />
                </svg>
              ),
              onClick: () => {
                setActiveCamPill("front");
                const controls = controlsRef.current,
                  perspective = perspCamRef.current;
                if (controls && perspective) {
                  const bounds = computeFastParametricSceneBounds(project.modules);
                  if (!bounds.isEmpty()) {
                    const center = bounds.getCenter(new THREE.Vector3());
                    const radius = bounds.getSize(new THREE.Vector3()).length() / 2;
                    const dist = Math.max(1200, radius * 2.3);
                    controls.target.copy(center);
                    perspective.position.set(center.x, center.y + 80, center.z + dist);
                    perspective.lookAt(center);
                    perspective.updateProjectionMatrix();
                    controls.update();
                    requestRender();
                  }
                }
              },
            },
            {
              id: "side",
              label: "Yan",
              icon: (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                  <path d="M12 4v16" />
                </svg>
              ),
              onClick: () => {
                setActiveCamPill("side");
                const controls = controlsRef.current,
                  perspective = perspCamRef.current;
                if (controls && perspective) {
                  const bounds = computeFastParametricSceneBounds(project.modules);
                  if (!bounds.isEmpty()) {
                    const center = bounds.getCenter(new THREE.Vector3());
                    const radius = bounds.getSize(new THREE.Vector3()).length() / 2;
                    const dist = Math.max(1200, radius * 2.3);
                    controls.target.copy(center);
                    perspective.position.set(center.x + dist, center.y + 80, center.z + 180);
                    perspective.lookAt(center);
                    perspective.updateProjectionMatrix();
                    controls.update();
                    requestRender();
                  }
                }
              },
            },
            {
              id: "top",
              label: "Üst",
              icon: (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                  <path d="M4 15h16" />
                </svg>
              ),
              onClick: () => {
                setActiveCamPill("top");
                const controls = controlsRef.current,
                  perspective = perspCamRef.current;
                if (controls && perspective) {
                  const bounds = computeFastParametricSceneBounds(project.modules);
                  if (!bounds.isEmpty()) {
                    const center = bounds.getCenter(new THREE.Vector3());
                    const radius = bounds.getSize(new THREE.Vector3()).length() / 2;
                    const dist = Math.max(1400, radius * 2.4);
                    controls.target.copy(center);
                    perspective.position.set(center.x, center.y + dist, center.z + 120);
                    perspective.lookAt(center);
                    perspective.updateProjectionMatrix();
                    controls.update();
                    requestRender();
                  }
                }
              },
            },
            {
              id: "interior",
              label: doorsHiddenIn3D || cutawayActiveBay ? "Kapak Göster" : "İç Görünüm",
              icon: (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
              ),
              onClick: () => {
                const currentlyHidden = doorsHiddenIn3D || cutawayActiveBay;
                if (currentlyHidden) {
                  setDoorsHiddenIn3D(false);
                  setCutawayActiveBay(false);
                  setActiveCamPill("3d");
                } else {
                  setDoorsHiddenIn3D(true);
                  setCutawayActiveBay(true);
                  setDismissedBayPopover(false);
                  setActiveCamPill("interior");
                }
              },
            },
            {
              id: "hide-doors",
              label: doorsHiddenIn3D || cutawayActiveBay ? "Kapak Göster" : "Kapakları Gizle",
              icon: (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ),
              onClick: () => {
                const currentlyHidden = doorsHiddenIn3D || cutawayActiveBay;
                if (currentlyHidden) {
                  setDoorsHiddenIn3D(false);
                  setCutawayActiveBay(false);
                  setActiveCamPill("3d");
                } else {
                  setDoorsHiddenIn3D(true);
                  setCutawayActiveBay(false);
                }
              },
            },
          ]
            .filter((btn) => !btn.id.startsWith("2d"))
            .map((btn) => {
            const isDupOfBottomDock = btn.id === "interior" || btn.id === "hide-doors";
            const isActive =
              btn.id === "interior"
                ? doorOpenAngleDeg > 10 || activeCamPill === "interior"
                : activeCamPill === btn.id;
            return (
              <button
                key={btn.id}
                type="button"
                title={btn.label}
                data-testid={`viewport-3d-pill-${btn.id}`}
                onClick={btn.onClick}
                className={
                  isDupOfBottomDock || !showInCanvasHud
                    ? "sr-only"
                    : `w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer ${
                        isActive
                          ? "birim-ice-btn-active"
                          : "text-[#44403C] hover:bg-white/70 hover:text-[#141413]"
                      }`
                }
              >
                {btn.icon}
                <span className="sr-only">{btn.label}</span>
              </button>
            );
          })}

          <div className="w-8 h-px bg-[#E2E8F0] my-0.5" />

          <button
            type="button"
            data-testid="in-canvas-fit-scene"
            title="Sahneye Sığdır"
            onClick={() => {
              const controls = controlsRef.current,
                perspective = perspCamRef.current,
                orthographic = orthoCamRef.current;
              if (!controls || !perspective || !orthographic) return;
              const bounds = computeFastParametricSceneBounds(project.modules);
              if (bounds.isEmpty()) return;
              const framed = computeHeroStudioFraming(
                bounds,
                perspective.fov,
                perspective.aspect,
                "hero"
              );
              controls.maxDistance = Math.max(14000, framed.dist * 3);
              controls.target.copy(framed.target);
              for (const camera of [perspective, orthographic]) {
                camera.position.copy(framed.position);
                camera.far = Math.max(25000, framed.dist * 5);
                camera.lookAt(framed.target);
              }
              perspective.updateProjectionMatrix();
              orthographic.updateProjectionMatrix();
              controls.update();
              requestRender();
            }}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-[#44403C] hover:bg-white/70 hover:text-[#141413] transition cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
          </button>

          <button
            type="button"
            data-testid="viewport-3d-pill-props"
            onClick={() => {
              const next = !showInteriorProps3D;
              setShowInteriorProps3D(next);
              if (next && !doorsHiddenIn3D && doorOpenAngleDeg < 15) {
                setDoorsHiddenIn3D(true);
              }
            }}
            className="sr-only"
          >
            Eşyalar
          </button>
        </div>

        {/* TOP-CENTER FROSTED ICE ICON DOCK */}
        {!minimalChrome && showInCanvasHud && (
          <div
            data-testid="in-canvas-direct-hud"
            style={
              !(isSimpleTier && !materialModeActive) && stageSafeInsets
                ? {
                    top: `${stageSafeInsets.topPx ?? 12}px`,
                    left: `${stageSafeInsets.leftPx ?? 8}px`,
                    right: `${stageSafeInsets.rightPx ?? 8}px`,
                  }
                : undefined
            }
            className={
              !materialModeActive
                ? "sr-only"
                : "absolute top-3 left-2 right-2 mx-auto w-fit max-w-[calc(100%-16px)] z-20 flex flex-wrap items-center justify-center gap-1 birim-ice-pill p-1 rounded-[22px] text-[#141413] transition-[left,right,top] duration-200"
            }
          >
            {materialModeActive && (
              <>
                {[
                  {
                    id: "select" as const,
                    label: "Seç",
                    testId: "hud-mat-tool-select",
                    icon: (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M5 3l14 8-6.5 2L9 19.5 5 3z" />
                      </svg>
                    ),
                  },
                  {
                    id: "paint" as const,
                    label: "Boya",
                    testId: "hud-mat-tool-paint",
                    icon: (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M19 11l-8-8-8.6 8.6a2 2 0 000 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11z" />
                        <path d="M20 14c1.1 1.5 2 3.2 2 4.5a2 2 0 01-4 0c0-1.3.9-3 2-4.5z" />
                      </svg>
                    ),
                  },
                  {
                    id: "group" as const,
                    label: "Bölge",
                    testId: "hud-mat-tool-group",
                    icon: (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <rect x="4" y="4" width="16" height="16" rx="2" strokeDasharray="3 3" />
                      </svg>
                    ),
                  },
                  {
                    id: "same_material" as const,
                    label: "Aynı Malzeme",
                    testId: "hud-mat-tool-same-mat",
                    icon: (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <rect x="8" y="8" width="12" height="12" rx="2" />
                        <path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" />
                      </svg>
                    ),
                  },
                ].map((mTool) => (
                  <button
                    key={mTool.id}
                    type="button"
                    title={mTool.label}
                    data-testid={mTool.testId}
                    onClick={() => setMaterialPaintTool(mTool.id)}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer ${
                      materialPaintTool === mTool.id
                        ? "birim-ice-btn-active"
                        : "text-[#44403C] hover:bg-white/70 hover:text-[#141413]"
                    }`}
                  >
                    {mTool.icon}
                    <span className="sr-only">{mTool.label}</span>
                  </button>
                ))}
                <button
                  type="button"
                  data-testid="hud-mat-tool-clear"
                  onClick={() => {
                    resetModuleMaterialOverrides();
                    setSnapBannerDedup("🧹 Özel parça malzeme atamaları temizlendi");
                    setTimeout(() => setSnapBannerDedup(null), 2000);
                  }}
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-red-600 hover:bg-red-500/15 transition cursor-pointer"
                  title="Özel parça malzeme atamalarını sıfırla"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                  </svg>
                  <span className="sr-only">Temizle</span>
                </button>
              </>
            )}

            <div className="sr-only">
            <button
              type="button"
              data-testid="hud-tool-select"
              onClick={() => setMoveObjectMode3D(false)}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer ${
                !moveObjectMode3D
                  ? "birim-ice-btn-active"
                  : "text-[#44403C] hover:bg-white/70 hover:text-[#141413]"
              }`}
              title="Seçim ve İnceleme Modu"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5 3l14 8-6.5 2L9 19.5 5 3z" />
              </svg>
              <span className="sr-only">Seç</span>
            </button>

            <button
              type="button"
              data-testid="viewport-3d-move-mode-toggle"
              onClick={() => setMoveObjectMode3D((v) => !v)}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer ${
                moveObjectMode3D
                  ? "birim-ice-btn-active"
                  : "text-[#44403C] hover:bg-white/70 hover:text-[#141413]"
              }`}
              title="Modülü 3D Sahnede Tutup Taşı"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" />
              </svg>
              <span className="sr-only">Taşı</span>
            </button>

            <button
              type="button"
              data-testid="in-canvas-toggle-dimensions"
              onClick={handleToggleDimensions}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer ${
                effectiveShowDimensions
                  ? "birim-ice-btn-active"
                  : "text-[#44403C] hover:bg-white/70 hover:text-[#141413]"
              }`}
              title="3D Ölçü Çizgilerini Göster / Gizle"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 8v8M20 8v8M4 12h16" />
              </svg>
              <span className="sr-only">Ölçü</span>
            </button>

            <button
              type="button"
              data-testid="hud-tool-split-bay"
              onClick={() => {
                splitBayIntoTwo(activeBayIndex);
                setCutawayActiveBay(true);
              }}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-[#44403C] hover:bg-white/70 hover:text-[#141413] transition cursor-pointer"
              title="Modüle Yeni Dikey Bölme (Ara Dikme) Ekle"
            >
              <Columns className="w-4 h-4" />
              <span className="sr-only">Böl</span>
            </button>

            <button
              type="button"
              data-testid="hud-tool-merge-bay"
              disabled={activeModule.bays.length <= 1}
              onClick={() => {
                if (activeModule.bays.length > 1) {
                  removeBayAt(activeBayIndex);
                }
              }}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-[#44403C] hover:bg-white/70 hover:text-[#141413] disabled:opacity-35 transition cursor-pointer"
              title="Seçili Ara Dikmeyi Kaldır ve Bölmeleri Birleştir"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <path d="M9 12h6M8 9l-3 3 3 3M16 9l3 3-3 3" />
              </svg>
              <span className="sr-only">Birleştir</span>
            </button>

            <button
              type="button"
              data-testid="in-canvas-add-module"
              onClick={addAdjacentModule}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-[#44403C] hover:bg-white/70 hover:text-[#141413] transition cursor-pointer"
              title="Seçili Modülü Yanına Kopyala"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
              <span className="sr-only">Kopyala</span>
            </button>

            <button
              type="button"
              data-testid="in-canvas-add-stacked-module"
              onClick={addStackedTopModule}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-[#44403C] hover:bg-white/70 hover:text-[#141413] transition cursor-pointer"
              title="Seçili Modülün Üstüne Yüklük Modülü Ekle"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="4" y="13" width="16" height="8" rx="1.5" />
                <rect x="4" y="3" width="16" height="7" rx="1.5" strokeDasharray="2.5 2" />
                <path d="M12 5v3m-1.5-1.5L12 5l1.5 1.5" />
              </svg>
              <span className="sr-only">Üst Yüklük Ekle</span>
            </button>

            <button
              type="button"
              data-testid="hud-tool-toggle-doors"
              onClick={() => {
                toggleDoorOpen();
                setSnapBannerDedup(
                  doorOpenAngleDeg > 0
                    ? "🚪 Kapaklar Kapatıldı"
                    : "🚪 Kapaklar Açıldı (İç Donanım Görünümü)"
                );
                setTimeout(() => setSnapBannerDedup(null), 2000);
              }}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer ${
                doorOpenAngleDeg > 0
                  ? "birim-ice-btn-active"
                  : "text-[#44403C] hover:bg-white/70 hover:text-[#141413]"
              }`}
              title={doorOpenAngleDeg > 0 ? "Kapakları Kapat" : "Kapakları Aç / İçini Göster"}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M5 3h11a2 2 0 012 2v14a2 2 0 01-2 2H5V3z" />
                <path d="M5 3l9 3v15l-9-3V3z" />
                <circle cx="11.5" cy="12" r="1" fill="currentColor" />
              </svg>
              <span className="sr-only">{doorOpenAngleDeg > 0 ? "Kapağı Kapat" : "Kapak Aç"}</span>
            </button>

            <button
              type="button"
              data-testid="in-canvas-flip-door-dir"
              onClick={() => {
                flipActiveDoorDirection(activeBayIndex);
                setSnapBannerDedup("⇄ Kapak Açılış Yönü Aynalandı (Sol ⇄ Sağ)");
                setTimeout(() => setSnapBannerDedup(null), 2200);
              }}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-[#44403C] hover:bg-white/70 hover:text-[#141413] transition cursor-pointer"
              title="Kapak Açılış Yönünü Aynala (Sol ⇄ Sağ)"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 3v18M4 7l5 5-5 5V7zM20 7l-5 5 5 5V7z" />
              </svg>
              <span className="sr-only">Aynala</span>
            </button>

            <div className="h-5 w-px bg-slate-900/12 mx-0.5" />

            <button
              type="button"
              data-testid="hud-tool-delete"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.dispatchEvent(new CustomEvent("birim:delete-active-selection"));
                }
              }}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-red-600 hover:bg-red-500/15 transition cursor-pointer"
              title="Seçili Parçayı veya Modülü Sil"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
              </svg>
              <span className="sr-only">Sil</span>
            </button>
            </div>
          </div>
        )}

        {/* BOTTOM-LEFT 3D COORDINATE AXIS GIZMO (Z Blue, Y Green, X Red) */}
        <div
          data-testid="viewport-3d-axis-gizmo"
          className={
            isSimpleTier
              ? "hidden"
              : "absolute left-5 bottom-5 z-10 pointer-events-none select-none opacity-75"
          }
        >
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            {/* Z Vertical Axis (Blue) */}
            <line x1="20" y1="44" x2="20" y2="12" stroke="#2563EB" strokeWidth="2" />
            <polygon points="20,8 17,14 23,14" fill="#2563EB" />
            <text x="16" y="7" fill="#2563EB" fontSize="10" fontWeight="700">Z</text>
            {/* Y Depth Axis (Green) */}
            <line x1="20" y1="44" x2="42" y2="28" stroke="#16A34A" strokeWidth="2" />
            <polygon points="46,25 39,27 42,31" fill="#16A34A" />
            <text x="47" y="26" fill="#16A34A" fontSize="10" fontWeight="700">Y</text>
            {/* X Horizontal Axis (Red) */}
            <line x1="20" y1="44" x2="50" y2="52" stroke="#DC2626" strokeWidth="2" />
            <polygon points="54,53 48,49 47,54" fill="#DC2626" />
            <text x="55" y="56" fill="#DC2626" fontSize="10" fontWeight="700">X</text>
            <circle cx="20" cy="44" r="2.5" fill="#2B2927" />
          </svg>
        </div>

        {/* BOTTOM-CENTER FROSTED ICE ICON CAPSULE (Orbit | Pan | Kapak | Sığdır | Donanım | Kesit | Ölçü | Stüdyo) */}
        {isXrayActive && (
          <div
            data-testid="cnc-xray-legend-pill"
            className="absolute bottom-[68px] left-1/2 -translate-x-1/2 z-20 max-w-[calc(100%-24px)] pl-2.5 pr-1.5 py-1 rounded-full bg-[#1C222E]/92 backdrop-blur-xl border border-white/15 shadow-[0_10px_28px_rgba(0,0,0,0.45)] flex items-center gap-1.5 text-[10px] sm:text-[10.5px] font-semibold text-slate-100"
          >
            <div className="flex items-center gap-x-2.5 overflow-x-auto no-scrollbar py-0.5">
              <span className="inline-flex items-center gap-1 whitespace-nowrap shrink-0"><span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "#10b981" }} />Ø5 Sistem32</span>
              <span className="inline-flex items-center gap-1 whitespace-nowrap shrink-0"><span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "#3b82f6" }} />Ø8 Kavela</span>
              <span className="inline-flex items-center gap-1 whitespace-nowrap shrink-0"><span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "#ef4444" }} />Ø15 Minifiks</span>
              <span className="inline-flex items-center gap-1 whitespace-nowrap shrink-0"><span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "#f59e0b" }} />Ø35 Menteşe</span>
              <span className="inline-flex items-center gap-1 whitespace-nowrap shrink-0"><span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "#a855f7" }} />Kanal</span>
              <span className="inline-flex items-center gap-1 whitespace-nowrap shrink-0"><span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "#facc15" }} />LED Kanal</span>
              <span className="inline-flex items-center gap-1 whitespace-nowrap shrink-0"><span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "#06b6d4" }} />Ray / Kablo</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setCncXrayMode(false);
                setHardwareViewMode("normal");
                setRenderEdgeMode("photoreal");
              }}
              className="shrink-0 w-5 h-5 rounded-full bg-white/12 hover:bg-white/25 text-slate-200 flex items-center justify-center text-[10px] cursor-pointer"
              title="CNC X-Ray Görünümünü Kapat"
            >
              ✕
            </button>
          </div>
        )}

        {!minimalChrome && (
        <div
          data-testid="viewport-3d-bottom-nav-bar"
          style={
            stageSafeInsets
              ? {
                  bottom: `${stageSafeInsets.bottomPx ?? 14}px`,
                  left: `${stageSafeInsets.leftPx ?? 8}px`,
                  right: `${stageSafeInsets.rightPx ?? 8}px`,
                }
              : undefined
          }
          className="absolute bottom-3.5 left-2 right-2 mx-auto w-fit max-w-[calc(100%-16px)] z-20 flex flex-wrap items-center justify-center gap-1.5 transition-[left,right,bottom] duration-200"
        >
          <div className="birim-ice-pill p-1 rounded-2xl flex items-center gap-1 text-[#141413]">
            <button
              type="button"
              onClick={() => setMoveObjectMode3D(false)}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer ${
                !moveObjectMode3D ? "birim-ice-btn-active" : "text-[#44403C] hover:bg-white/70"
              }`}
              title="Sahneyi Çevir (Orbit)"
            >
              <RotateCw className="w-4 h-4" />
              <span className="sr-only">{isSimpleTier ? "Çevir" : "Orbit"}</span>
            </button>
            <button
              type="button"
              onClick={() => setMoveObjectMode3D(true)}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer ${
                moveObjectMode3D ? "birim-ice-btn-active" : "text-[#44403C] hover:bg-white/70"
              }`}
              title="Dolabı Duvar Boyunca Taşı (Pan)"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M18 11V6a2 2 0 00-2-2v0a2 2 0 00-2 2v0M14 10V4a2 2 0 00-2-2v0a2 2 0 00-2 2v6M10 10.5V6a2 2 0 00-2-2v0a2 2 0 00-2 2v8" />
                <path d="M18 8a2 2 0 114 0v6a8 8 0 01-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 012.83-2.82L7 15" />
              </svg>
              <span className="sr-only">{isSimpleTier ? "Taşı" : "Pan"}</span>
            </button>
            {showInCanvasHud && project.modules.length > 0 && (
              <button
                type="button"
                data-testid="quick-bar-rotate-module-btn"
                onClick={() => rotateActiveModule90(90)}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-[#44403C] hover:bg-white/70 hover:text-[#141413] transition cursor-pointer"
                data-tooltip="Seçili Modülü 90° Çevir"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="10" width="10" height="10" rx="1.5" />
                  <path d="M14 5h4a2 2 0 012 2v4" />
                  <path d="M16 3l-2 2 2 2" />
                </svg>
                <span className="sr-only">Modülü 90° Çevir</span>
              </button>
            )}

            <div className="h-5 w-px bg-slate-900/12 mx-0.5" />

            <button
              type="button"
              onClick={() => toggleDoorOpen()}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer ${
                doorOpenAngleDeg > 5
                  ? "birim-ice-btn-active"
                  : "text-[#44403C] hover:bg-white/70"
              }`}
              title={doorOpenAngleDeg > 5 ? "Kapakları Kapat" : "Kapakları Aç / İçini Gör"}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M5 3h11a2 2 0 012 2v14a2 2 0 01-2 2H5V3z" />
                <path d="M5 3l9 3v15l-9-3V3z" />
                <circle cx="11.5" cy="12" r="1" fill="currentColor" />
              </svg>
              <span className="sr-only">{doorOpenAngleDeg > 5 ? "Kapağı Kapat" : "İçini Gör"}</span>
            </button>
            {showInCanvasHud && project.modules.length > 0 && (
              <button
                type="button"
                data-testid="quick-bar-hide-doors-btn"
                onClick={() => setDoorsHiddenIn3D((prev) => !prev)}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer ${
                  doorsHiddenIn3D
                    ? "birim-ice-btn-active"
                    : "text-[#44403C] hover:bg-white/70 hover:text-[#141413]"
                }`}
                data-tooltip={doorsHiddenIn3D ? "Kapakları Göster" : "Kapakları Gizle (İç Düzenle)"}
              >
                {doorsHiddenIn3D ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                <span className="sr-only">
                  {doorsHiddenIn3D ? "Kapakları Göster" : "Kapakları Gizle (İç Düzenle)"}
                </span>
              </button>
            )}



            <div className="h-5 w-px bg-slate-900/12 mx-0.5" />

            {/* Ölçü İkon Anahtarı */}
            <button
              type="button"
              data-active={effectiveShowDimensions ? "true" : "false"}
              onClick={handleToggleDimensions}
              data-tooltip={effectiveShowDimensions ? "Ölçü Çizgilerini Gizle" : "3D Ölçü Çizgilerini Göster"}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer ${
                effectiveShowDimensions
                  ? "birim-ice-btn-active"
                  : "text-[#44403C] hover:bg-white/70 hover:text-[#141413]"
              }`}
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 8h18M3 16h18M7 8v8M12 8v5M17 8v8" />
              </svg>
              <span className="sr-only">Ölçüler</span>
            </button>

            {/* İç Eşyalar (Elbise, Kutu, Ayakkabı) Aç / Gizle */}
            <button
              type="button"
              data-testid="toggle-interior-props-btn"
              data-active={showInteriorProps3D ? "true" : "false"}
              onClick={() => {
                const next = !showInteriorProps3D;
                setShowInteriorProps3D(next);
                if (next && !doorsHiddenIn3D && doorOpenAngleDeg < 15) {
                  setDoorOpenAngleDeg(75);
                }
              }}
              data-tooltip={
                showInteriorProps3D
                  ? "İç Eşyalar: Açık (Gizlemek için tıklayın)"
                  : "İç Eşyalar: Gizli (Göstermek için tıklayın)"
              }
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer ${
                showInteriorProps3D
                  ? "birim-ice-btn-active"
                  : "text-[#44403C] hover:bg-white/70 hover:text-[#141413]"
              }`}
            >
              <span className="text-sm leading-none shrink-0">👔</span>
              <span className="sr-only">{showInteriorProps3D ? "Eşyalar Açık" : "Eşyalar Gizli"}</span>
            </button>

            {/* Görüntü / Donanım Etiketleri (Unified into Sahne & Katman Ayarları; test hook preserved) */}
            {showInCanvasHud && (
              <div className="sr-only">
                <button
                  type="button"
                  data-testid="viewport-3d-hardware-view-mode-btn"
                  title="3D Donanım & Teknik Tel Kafes Görünüm Modu"
                  onClick={() => setHardwareViewMenuOpen((v) => !v)}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer ${
                    hardwareViewMode !== "normal"
                      ? "birim-ice-btn-active"
                      : "text-[#44403C] hover:bg-white/70 hover:text-[#141413]"
                  }`}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="3" y="4" width="18" height="14" rx="2" />
                    <circle cx="8.5" cy="10.5" r="2" />
                    <path d="M14 9h4M14 13h4" />
                  </svg>
                  <span className="sr-only">Görüntü</span>
                </button>

                {hardwareViewMenuOpen && (
                  <div
                    data-testid="viewport-3d-hardware-view-menu"
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 w-56 birim-ice-popover rounded-2xl p-2 space-y-1 z-30 text-xs"
                  >
                    <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                      3D Görünüm Katmanı
                    </div>
                    {[
                      {
                        id: "normal" as const,
                        label: "Normal Görünüm",
                        sub: "Temiz sunum görünümü",
                      },
                      {
                        id: "hardware" as const,
                        label: "Donanımları Göster",
                        sub: "Menteşe, ray ve LED etiketleri",
                      },
                      {
                        id: "technical" as const,
                        label: "Teknik CAD",
                        sub: "Tel kafes + CNC eksenleri",
                      },
                    ].map((vm) => (
                      <button
                        key={vm.id}
                        type="button"
                        data-testid={`viewport-3d-hw-mode-${vm.id}`}
                        onClick={() => {
                          setHardwareViewMode(vm.id);
                          setHardwareViewMenuOpen(false);
                          if (vm.id === "hardware" || vm.id === "technical") {
                            if (doorOpenAngleDeg < 15 && !doorsHiddenIn3D) {
                              setDoorOpenAngleDeg(65);
                            }
                          }
                          if (vm.id === "technical") {
                            setRenderEdgeMode("cad");
                          } else {
                            setRenderEdgeMode("photoreal");
                          }
                        }}
                        className={`w-full px-2.5 py-1.5 rounded-xl text-left transition cursor-pointer ${
                          hardwareViewMode === vm.id
                            ? "birim-ice-btn-active"
                            : "hover:bg-white/70 text-[#111827]"
                        }`}
                      >
                        <div className="text-[11px] font-bold">{vm.label}</div>
                        <div className={`text-[9px] ${hardwareViewMode === vm.id ? "text-stone-300" : "text-[#64748B]"}`}>{vm.sub}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 2-Yönlü Canlı Kesit İkonu */}
            <div className={isSimpleTier ? "sr-only" : "relative"}>
              <button
                type="button"
                data-testid="viewport-3d-section-toggle-btn"
                onClick={() => { setSection3DMenuOpen((v) => !v); setExplode3DMenuOpen(false); setHardwareViewMenuOpen(false); setRenderMenuOpen(false); }}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer ${
                  section3DAxis
                    ? "birim-ice-btn-active"
                    : "text-[#44403C] hover:bg-white/70 hover:text-[#141413]"
                }`}
                title="2-Yönlü Canlı 3D Dolap Kesiti (X / Z)"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="6" cy="6" r="3" />
                  <circle cx="6" cy="18" r="3" />
                  <path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12" />
                </svg>
                <span className="sr-only">{section3DAxis ? `Kesit (${section3DAxis})` : "Kesit"}</span>
              </button>

              {section3DMenuOpen && (
                <div
                  data-testid="viewport-3d-section-popover"
                  onClick={(e) => e.stopPropagation()}
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 w-60 birim-ice-popover rounded-2xl p-3 space-y-2.5 z-30 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-slate-900">✂️ Canlı Kesit</span>
                    <button
                      type="button"
                      onClick={() => setSection3DMenuOpen(false)}
                      className="text-slate-500 hover:text-slate-900 font-bold cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      { id: null, label: "Kapalı" },
                      { id: "X" as const, label: "X Ekseni" },
                      { id: "Z" as const, label: "Z Ekseni" },
                    ].map((sOpt) => (
                      <button
                        key={String(sOpt.id)}
                        type="button"
                        onClick={() => setSection3DAxis(sOpt.id)}
                        className={`py-1.5 px-2 rounded-xl font-bold text-[11px] transition cursor-pointer ${
                          section3DAxis === sOpt.id
                            ? "birim-ice-btn-active"
                            : "birim-ice-btn text-slate-800"
                        }`}
                      >
                        {sOpt.label}
                      </button>
                    ))}
                  </div>
                  {section3DAxis && (
                    <div className="space-y-1 pt-1 border-t border-slate-200/70">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-slate-600">Konum</span>
                        <span className="font-mono font-extrabold text-slate-900">
                          {Math.round((section3DAxis === "X" ? width : depth) * section3DRatio)} mm
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.1}
                        max={0.95}
                        step={0.02}
                        data-visual-slider="true"
                        value={section3DRatio}
                        onChange={(e) => setSection3DRatio(Number(e.target.value))}
                        className="w-full accent-[#141413] h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Gündüz / Gece LED Ambiyans Anahtarı */}
            <button
              type="button"
              data-testid="viewport-3d-day-night-led-btn"
              onClick={() =>
                setLightingPreset((prev) => (prev === "night_led" ? "daylight" : "night_led"))
              }
              data-tooltip={
                lightingPreset === "night_led"
                  ? "Gündüz Stüdyo Işığına Geç"
                  : "Gece Ambiyans & İç LED Işığını Gör"
              }
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer ${
                lightingPreset === "night_led"
                  ? "birim-ice-btn-active"
                  : "text-[#44403C] hover:bg-white/70 hover:text-[#141413]"
              }`}
            >
              <span className="text-sm leading-none">{lightingPreset === "night_led" ? "🌙" : "☀️"}</span>
              <span className="sr-only">
                {lightingPreset === "night_led" ? "Gece LED Modu" : "Gündüz Modu"}
              </span>
            </button>

            {/* Canlı 3D Patlatma (Exploded View) Slider Popover — Mimar/Üretim Modunda Görünür */}
            <div className={isSimpleTier ? "sr-only" : "relative"}>
              <button
                type="button"
                data-testid="viewport-3d-explode-toggle-btn"
                onClick={() => {
                  setExplode3DMenuOpen((v) => !v);
                  setSection3DMenuOpen(false);
                  setHardwareViewMenuOpen(false);
                  setRenderMenuOpen(false);
                }}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer ${
                  explodedFactor > 0.01
                    ? "birim-ice-btn-active"
                    : "text-[#44403C] hover:bg-white/70 hover:text-[#141413]"
                }`}
                data-tooltip={
                  explodedFactor > 0.01
                    ? `Canlı Patlatma: %${Math.round(explodedFactor * 100)}`
                    : "3D Canlı Patlatma Görünümü"
                }
                title="3D Canlı Patlatma Görünümü"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L3 7l9 5 9-5-9-5z" />
                  <path d="M3 12l9 5 9-5" />
                  <path d="M3 17l9 5 9-5" />
                </svg>
                <span className="sr-only">
                  {explodedFactor > 0.01
                    ? `Patlatma (%${Math.round(explodedFactor * 100)})`
                    : "Canlı Patlatma"}
                </span>
              </button>

              {explode3DMenuOpen && (
                <div
                  data-testid="viewport-3d-explode-popover"
                  onClick={(e) => e.stopPropagation()}
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 w-60 birim-ice-popover rounded-2xl p-3 space-y-2.5 z-30 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-slate-900">💥 Canlı Patlatma</span>
                    <button
                      type="button"
                      onClick={() => setExplode3DMenuOpen(false)}
                      aria-label="Patlatma panelini kapat"
                      className="text-slate-500 hover:text-slate-900 font-bold cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-600">Ayrılma Oranı</span>
                      <span
                        data-testid="viewport-3d-explode-value"
                        className="font-mono font-extrabold text-slate-900"
                      >
                        %{Math.round(explodedFactor * 100)}
                      </span>
                    </div>
                    <input
                      type="range"
                      data-testid="viewport-3d-explode-slider"
                      data-visual-slider="true"
                      aria-label="Canlı patlatma oranı"
                      min={0}
                      max={1}
                      step={0.02}
                      value={explodedFactor}
                      onChange={(e) => setExplodedFactor(Number(e.target.value))}
                      className="w-full accent-[#141413] h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-1 pt-1 border-t border-slate-200/70">
                    {[
                      { value: 0, label: "Normal" },
                      { value: 0.5, label: "%50" },
                      { value: 1, label: "%100" },
                    ].map((preset) => {
                      const isActive = Math.abs(explodedFactor - preset.value) < 0.015;
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setExplodedFactor(preset.value)}
                          className={`py-1.5 px-2 rounded-xl font-bold text-[11px] transition cursor-pointer ${
                            isActive
                              ? "birim-ice-btn-active"
                              : "birim-ice-btn text-slate-800"
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Stüdyo Ortam, Işık, Zemin & 2K Render İkonu */}
            <div className="relative">
              <button
                type="button"
                data-testid="viewport-3d-edge-mode-toggle"
                title="Stüdyo Işığı, Duvar/Zemin Yüzeyi ve 2K Fotoğraf Render"
                onClick={() => { setRenderMenuOpen((v) => !v); setSection3DMenuOpen(false); setExplode3DMenuOpen(false); setHardwareViewMenuOpen(false); }}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer ${
                  renderMenuOpen || renderEdgeMode === "cad"
                    ? "birim-ice-btn-active"
                    : "text-[#44403C] hover:bg-white/70 hover:text-[#141413]"
                }`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
                <span className="sr-only">{renderEdgeMode === "photoreal" ? "Gerçekçi" : "Teknik CAD"}</span>
              </button>

              {renderMenuOpen && (
                <div className="absolute bottom-full right-0 mb-2.5 w-64 birim-ice-popover rounded-2xl p-3 space-y-3 z-30 text-xs">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#57534E]">
                        Görünüm
                      </span>
                      <button
                        type="button"
                        onClick={() => setRenderMenuOpen(false)}
                        title="Kapat"
                        aria-label="Render panelini kapat"
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-[#57534E] hover:text-[#141413] hover:bg-black/5 cursor-pointer transition"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setViewportRenderStyle("solid");
                          setHardwareViewMode("normal");
                          setRenderEdgeMode("photoreal");
                        }}
                        className={`py-1.5 px-1.5 rounded-xl text-[10.5px] font-semibold cursor-pointer ${
                          renderEdgeMode === "photoreal" && hardwareViewMode === "normal" && viewportRenderStyle === "solid"
                            ? "birim-ice-btn-active"
                            : "birim-ice-btn text-[#1C1917]"
                        }`}
                      >
                        Sunum PBR
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setHardwareViewMode("hardware");
                          setRenderEdgeMode("photoreal");
                          if (doorOpenAngleDeg < 15 && !doorsHiddenIn3D) {
                            setDoorOpenAngleDeg(65);
                          }
                        }}
                        className={`py-1.5 px-1.5 rounded-xl text-[10.5px] font-semibold cursor-pointer ${
                          hardwareViewMode === "hardware"
                            ? "birim-ice-btn-active"
                            : "birim-ice-btn text-[#1C1917]"
                        }`}
                      >
                        Donanım
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setHardwareViewMode("technical");
                          setRenderEdgeMode("cad");
                        }}
                        className={`py-1.5 px-1.5 rounded-xl text-[10.5px] font-semibold cursor-pointer ${
                          renderEdgeMode === "cad" || hardwareViewMode === "technical"
                            ? "birim-ice-btn-active"
                            : "birim-ice-btn text-[#1C1917]"
                        }`}
                      >
                        Teknik CAD
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-1 mt-1">
                      <button
                        type="button"
                        onClick={() => setViewportRenderStyle(viewportRenderStyle === "wireframe" ? "solid" : "wireframe")}
                        className={`py-1 px-1.5 rounded-xl text-[10px] font-semibold cursor-pointer ${
                          viewportRenderStyle === "wireframe" ? "birim-ice-btn-active" : "birim-ice-btn text-[#1C1917]"
                        }`}
                      >
                        Tel Kafes
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewportRenderStyle(viewportRenderStyle === "carcass_only" ? "solid" : "carcass_only")}
                        className={`py-1 px-1.5 rounded-xl text-[10px] font-semibold cursor-pointer ${
                          viewportRenderStyle === "carcass_only" ? "birim-ice-btn-active" : "birim-ice-btn text-[#1C1917]"
                        }`}
                      >
                        Kapaksız
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewportRenderStyle(viewportRenderStyle === "exploded" ? "solid" : "exploded")}
                        className={`py-1 px-1.5 rounded-xl text-[10px] font-semibold cursor-pointer ${
                          viewportRenderStyle === "exploded" ? "birim-ice-btn-active" : "birim-ice-btn text-[#1C1917]"
                        }`}
                      >
                        Patlatılmış
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#57534E] mb-1.5">
                      Işık
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { id: "daylight", label: "Gün" },
                        { id: "showroom_warm", label: "3000K" },
                        { id: "night_led", label: "Gece" },
                      ].map((lp) => (
                        <button
                          key={lp.id}
                          type="button"
                          data-testid={`viewport-3d-light-${lp.id}`}
                          onClick={() =>
                            setLightingPreset(lp.id as "daylight" | "showroom_warm" | "night_led")
                          }
                          className={`py-1 px-1.5 rounded-xl text-[10px] font-semibold cursor-pointer ${
                            lightingPreset === lp.id
                              ? "birim-ice-btn-active"
                              : "birim-ice-btn text-[#1C1917]"
                          }`}
                        >
                          {lp.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#57534E] mb-1.5">
                      Duvar
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { id: "brut_concrete", label: "Brüt Beton", swatch: "#9E9991" },
                        { id: "anthracite_gallery", label: "Koyu Galeri", swatch: "#444341" },
                        { id: "warm_taupe", label: "Sıcak Grej", swatch: "#ACA396" },
                        { id: "soft_plaster", label: "Mimari Gri Sıva", swatch: "#CDD3DA" },
                      ].map((wt) => (
                        <button
                          key={wt.id}
                          type="button"
                          title={wt.label}
                          data-testid={`viewport-3d-wall-${wt.id}`}
                          onClick={() => setWallTone(wt.id as ArchitecturalWallTone)}
                          className={`h-8 rounded-xl flex items-center justify-center cursor-pointer border transition ${
                            wallTone === wt.id
                              ? "ring-2 ring-[#141413] border-white scale-105"
                              : "border-white/70 hover:scale-105"
                          }`}
                          style={{ backgroundColor: wt.swatch }}
                        >
                          <span className="sr-only">{wt.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#57534E] mb-1.5">
                      Zemin
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {[
                        { id: "oak_parquet", label: "Meşe" },
                        { id: "herringbone_oak", label: "Balıksırtı" },
                        { id: "walnut_parquet", label: "Ceviz" },
                        { id: "travertine", label: "Traverten" },
                        { id: "neolith_calacatta", label: "Mermer" },
                        { id: "microcement", label: "Beton" },
                        { id: "studio", label: "Stüdyo" },
                      ].map((fl) => (
                        <button
                          key={fl.id}
                          type="button"
                          data-testid={`viewport-3d-floor-${fl.id}`}
                          onClick={() => setFloorStyle(fl.id as ArchitecturalFloorStyle)}
                          className={`py-1 px-2 rounded-xl text-[10px] font-semibold text-left cursor-pointer ${
                            floorStyle === fl.id
                              ? "birim-ice-btn-active"
                              : "birim-ice-btn text-[#1C1917]"
                          }`}
                        >
                          {fl.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    data-testid="viewport-open-glb-library-btn"
                    onClick={() => {
                      setRenderMenuOpen(false);
                      setGlbLibraryOpen(true);
                    }}
                    className="w-full py-2 px-2.5 rounded-xl birim-ice-btn text-[#141413] font-bold text-[11px] flex items-center justify-between cursor-pointer"
                  >
                    <span>📦 Hazır 3D İç Modeller (.GLB)</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-600/15 text-emerald-800 font-mono">GLTF</span>
                  </button>

                  <button
                    type="button"
                    data-testid="viewport-open-path-trace-studio-btn"
                    onClick={() => {
                      setRenderMenuOpen(false);
                      window.dispatchEvent(new CustomEvent("birim:open-studio-render-modal"));
                    }}
                    className="w-full py-2 px-2.5 rounded-xl bg-[#141413] hover:bg-[#27272A] text-white font-bold text-[11px] flex items-center justify-between cursor-pointer shadow-sm"
                  >
                    <span>🎬 2K vs Path-Trace Stüdyosu</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 font-mono">A/B</span>
                  </button>

                  <div className="pt-2 border-t border-slate-900/10 flex items-center gap-1.5">
                    <button
                      type="button"
                      data-testid="viewport-3d-ultra-studio-render-btn"
                      disabled={ultraRenderProgress !== null}
                      title="2K Stüdyo Fotoğraf İndir (.PNG)"
                      onClick={async () => {
                        const win = window as unknown as {
                          __birimRenderUltraStudioPhoto?: (opts?: {
                            angle?: "current" | "iso" | "front";
                            width?: number;
                            height?: number;
                            onProgress?: (pct: number) => void;
                          }) => Promise<string>;
                        };
                        if (!win.__birimRenderUltraStudioPhoto) return;
                        setUltraRenderProgress(0);
                        const dataUrl = await win.__birimRenderUltraStudioPhoto({
                          angle: "current",
                          width: 2048,
                          height: 1280,
                          onProgress: (p) => setUltraRenderProgress(p),
                        });
                        setUltraRenderProgress(null);
                        setRenderMenuOpen(false);
                        if (dataUrl) {
                          const a = document.createElement("a");
                          a.href = dataUrl;
                          a.download = `Birim_Studyo_Render_${project.id}.png`;
                          document.body.appendChild(a);
                          a.click();
                          setTimeout(() => {
                            if (a.parentNode) a.parentNode.removeChild(a);
                          }, 1000);
                          setSnapBannerDedup("2K Ultra Stüdyo Render indirildi");
                          setTimeout(() => setSnapBannerDedup(null), 2800);
                        }
                      }}
                      className="flex-1 h-8 px-2.5 rounded-xl birim-ice-btn-active disabled:opacity-60 font-semibold text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <span>📸</span>
                      <span>{ultraRenderProgress !== null ? `%${ultraRenderProgress}` : "2K PNG"}</span>
                    </button>

                    {activeModule && (
                      <CeilingAndEngineeringQuickPopover
                        project={project}
                        activeModule={activeModule}
                        surface="3d"
                        onUpdateCeiling={updateCeilingConfigStore}
                        onUpdateCeilingHeightMm={(h) =>
                          setRoomDimensionsStore(spaceWalls?.[0]?.length || 3600, h)
                        }
                        onUpdateCarcass={updateCarcassStore}
                        onSetFacadeGrainContinuity={setFacadeGrainContinuityStore}
                      />
                    )}

                    <button
                      type="button"
                      data-testid="viewport-3d-room-toggle"
                      title={showRoomArchitecture3D ? "Oda Duvarlarını Gizle" : "Oda Duvarlarını Göster"}
                      onClick={() => setShowRoomArchitecture3D((prev) => !prev)}
                      className={`w-8 h-8 rounded-xl flex items-center justify-center cursor-pointer ${
                        showRoomArchitecture3D ? "birim-ice-btn-active" : "birim-ice-btn text-[#1C1917]"
                      }`}
                    >
                      <span>🧱</span>
                      <span className="sr-only">{showRoomArchitecture3D ? "Duvarlar: Açık" : "Duvarlar: Gizli"}</span>
                    </button>

                    <button
                      type="button"
                      data-testid="viewport-3d-rotate-mod-90"
                      title="Aktif Modülü 90° Döndür"
                      onClick={() => rotateActiveModule90(90)}
                      className="sr-only"
                    >
                      <span>↻</span>
                      <span className="sr-only">90° Döndür</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        )}
        <WardrobeGlbLibraryModal
          open={glbLibraryOpen}
          onClose={() => setGlbLibraryOpen(false)}
        />
    </>
  );
};
