"use client";


import React from "react";
import { formatElevationValue, toDisplayUnitNumber, toCanonicalMm, resolveSelectedElevationContext } from "../workspace/elevation2dHelpers";
import { ElevationTopBar, ElevationContextualPanel, ElevationBottomBar } from "../workspace/Elevation2DChrome";
import { CadContextMenu2D } from "../workspace/CadContextMenu2D";
import { getModuleOrientedFootprint } from "../../adapter/useV3Adapter";
import { CadElevationAndSectionSvgCanvas } from "./CadElevationAndSectionSvgCanvas";
import { createCadElevationPointerAndDropHandlers } from "./cadElevationPointerAndDropHandlers";



import type { CadElevationAndSection2DViewProps } from "./cad2dTypes";
export type { CadElevationAndSection2DViewProps };

export const CadElevationAndSection2DView: React.FC<CadElevationAndSection2DViewProps> = (props) => {
  const {
    activeBayIndex,
    activeElevSnap,
    activeHaloGroupRef,
    activeModGroupRef,
    activeModule,
    activeModule2DData,
    activeModuleBreakdown,
    activeModuleIndex,
    addDrawer,
    addFixedShelf,
    addHangingRail,
    addInteriorItemAtElevation,
    addInternalDrawer,
    addShelf,
    addStackedTopModule,
    applyMaterialToSimilarComponents,
    beginHistoryTransaction,
    cadContextMenu,
    canvasFontScale,
    commitHistoryTransaction,
    dragGhostPreview,
    dropV4TemplateWithSnap,
    duplicateActiveModule,
    duplicateSceneObject,
    effectiveInteriorMoveMode,
    effectiveShowAllDims,
    elevContainerRef,
    elevCoordMode,
    elevDetailLevel,
    elevDisplayUnit,
    elevDragPreviewRef,
    elevDraggingMod,
    elevDraggingObs,
    elevDraggingSceneObj,
    elevDropRuntimeRef,
    elevInteriorLiveRef,
    elevPanMode,
    elevResizingMod,
    elevSnapBannerDomRef,
    elevVbZoomRef,
    equalizeBaysAndShelves,
    finishModuleDragWithSmartSwap,
    getElevScaleMmPerPx,
    grainContinuityMap2D,
    handleChangeElevDetailLevel,
    handleChangeElevDisplayUnit,
    handleWheelZoom,
    hideLegacySectionBar,
    hoveredElevationItem,
    hoveredHeightHandle,
    interiorDrag,
    interiorSnapTargetsRef,
    isCtrlHeldElev,
    lastAccessoryDropTarget2DRef,
    lastDividerCommitValRef,
    lastInteriorCommitRef,
    lastModElevCommitRef,
    lastPointerMoveTsRef,
    liveAccessoryGhost2D,
    liveSpatialAlerts,
    lockedElevModIdRef,
    lockedElevOriginRef,
    lockedElevVbRef,
    longPress2DRef,
    magnetEnabled,
    mode,
    panPx,
    panPxRef,
    panning2D,
    pinchTrackerRef,
    planRowSnapBanner,
    printActive2DCadSheet,
    project,
    removeActiveModule,
    removeSceneObject,
    removeSelectedInteriorComponent,
    removeSpaceObstacle,
    resizeModuleParametric,
    sectionCutCoordMm,
    sectionCutRatio2D,
    sectionDirection2D,
    selectedComponentId,
    selectedPlanObject,
    selectedSceneObjectId,
    setActiveBayIndex,
    setActiveElevSnap,
    setActiveModuleIndex,
    setBayCustomWidth,
    setCadContextMenu,
    setDragGhostPreview,
    setDrawerPlacement,
    setElevCoordMode,
    setElevDraggingMod,
    setElevDraggingObs,
    setElevDraggingSceneObj,
    setElevInteriorMoveMode,
    setElevPanMode,
    setElevResizingMod,
    setFacadeGrainContinuity,
    setHangingRailElevation,
    setHoveredElevationItem,
    setHoveredHeightHandle,
    setInteriorDrag,
    setModuleOffsetFromLeftWall,
    setModulePosition,
    setPanPx,
    setPanning2D,
    setPlanRowSnapBanner,
    setRoomDimensions,
    setSectionCutRatio2D,
    setSectionDirection2D,
    setSelectedComponentId,
    setSelectedPlanObject,
    setSelectedSceneObjectId,
    setShelfElevation,
    setShelfMountType,
    setShelfThickness,
    setShowAllDimensions,
    setShowDoorsIn2D,
    setShowRoomContextInElev,
    setSpecialFittingPlacement,
    setSubDividerPlacement,
    setZoom,
    showDoorsIn2D,
    showRoomContextInElev,
    snapXBadgeRef,
    snapXCircleRef,
    snapXGroupRef,
    snapXLineRef,
    snapXTextRef,
    snapYBadgeRef,
    snapYGroupRef,
    snapYLineRef,
    snapYTextRef,
    spaceObstacles,
    spaceWalls,
    splitBayIntoTwo,
    studioSafeInsets,
    swapModuleWithNeighbor,
    updateCarcassConfig,
    updateCeilingConfig,
    updateObstaclePosition,
    updateSceneObject,
    updateSpaceObstacle,
    zoom,
    zoomRef,
  } = props;
    const hasSceneModules =
      project.modules.length > 0 && activeModule.id !== "empty_scene_placeholder";
    const breakdown = activeModuleBreakdown;
    const data = activeModule2DData;

    type ElevWallKey = "main" | "left" | "right" | "front";
    const getModElevWallKey = (m: typeof activeModule): ElevWallKey => {
      const r = (((m.rotation?.y || 0) % 360) + 360) % 360;
      if (r < 45 || r > 315) return "main";
      if (r >= 45 && r < 135) return "left";
      if (r >= 225 && r <= 315) return "right";
      return "front";
    };
    const activeElevWallKey: ElevWallKey = getModElevWallKey(activeModule);
    const elevWallMeta: Record<ElevWallKey, { label: string; length: number; indices: number[] }> = {
      main: { label: "Ana Duvar", length: spaceWalls[0]?.length || 3600, indices: [] },
      left: {
        label: "Sol Duvar",
        length:
          spaceWalls.find((w) => {
            const wr = (((w.rotationY || 0) % 360) + 360) % 360;
            return wr >= 45 && wr < 135 && (w.position?.x || 0) <= 200;
          })?.length || 2500,
        indices: [],
      },
      right: {
        label: "Sağ Duvar",
        length:
          spaceWalls.find((w) => {
            const wr = (((w.rotationY || 0) % 360) + 360) % 360;
            return (wr >= 45 && wr < 135 && (w.position?.x || 0) > 200) || (wr >= 225 && wr <= 315);
          })?.length || 2500,
        indices: [],
      },
      front: {
        label: "Karşı Duvar",
        length: spaceWalls[0]?.length || 3600,
        indices: [],
      },
    };
    project.modules.forEach((m, idx) => {
      elevWallMeta[getModElevWallKey(m)].indices.push(idx);
    });
    const activeElevWallTabs = (["main", "left", "right", "front"] as ElevWallKey[]).filter(
      (k) => elevWallMeta[k].indices.length > 0
    );
    const leftMaxExtentZ = Math.max(
      elevWallMeta.left.length,
      ...elevWallMeta.left.indices.map((i) => {
        const mm = project.modules[i];
        const f = getModuleOrientedFootprint(mm, i);
        return (mm.position.z || 0) + f.planDepth;
      })
    );
    const frontMaxExtentX = Math.max(
      elevWallMeta.front.length,
      ...elevWallMeta.front.indices.map((i) => {
        const mm = project.modules[i];
        const f = getModuleOrientedFootprint(mm, i);
        return (mm.position.x || 0) + f.planWidth;
      })
    );
    elevWallMeta.left.length = leftMaxExtentZ;
    elevWallMeta.front.length = frontMaxExtentX;
    const getModWallAlongX = (m: typeof activeModule, wk: ElevWallKey): number => {
      const fp = getModuleOrientedFootprint(m, 0);
      if (wk === "main") return m.position.x;
      if (wk === "left") return Math.max(0, leftMaxExtentZ - ((m.position.z || 0) + fp.planDepth));
      if (wk === "right") return m.position.z || 0;
      return Math.max(0, frontMaxExtentX - ((m.position.x || 0) + fp.planWidth));
    };
    const sameWallModules = project.modules.filter((m) => getModElevWallKey(m) === activeElevWallKey);
    const mainWallLen = elevWallMeta[activeElevWallKey].length;
    const ceilingH = project.space.ceilingHeight || 2600;
    const activeModOffX =
      mode === "elevation" && showRoomContextInElev
        ? getModWallAlongX(activeModule, activeElevWallKey)
        : 0;
    const activeModOffY = mode === "elevation" && showRoomContextInElev ? activeModule.position.y : 0;
    const padX = mode === "elevation" ? 340 : 260;
    const padY = mode === "elevation" ? 280 : 220;
    const maxWallSpanX = Math.max(
      mainWallLen,
      ...sameWallModules.map((m) => getModWallAlongX(m, activeElevWallKey) + m.dimensions.width),
      ...(activeElevWallKey === "main" ? spaceObstacles.map((o) => o.position.x + o.dimensions.width) : [])
    );
    const floorSvgY = breakdown.overall.height + activeModOffY;
    const maxWorldTopY = Math.max(
      ceilingH,
      ...project.modules.map((m) => m.position.y + m.dimensions.height),
      ...spaceObstacles.map((o) => o.position.y + o.dimensions.height)
    );
    const minSvgY = floorSvgY - maxWorldTopY - padY;
    const totalElevH = maxWorldTopY + padY * 2;
    const computedElevVb =
      mode === "elevation" && showRoomContextInElev
        ? {
            x: -activeModOffX - padX,
            y: minSvgY,
            width: maxWallSpanX + padX * 2,
            height: totalElevH,
          }
        : {
            x: -padX,
            y: -padY,
            width: data.viewBox.width - 300 + padX * 2,
            height: data.viewBox.height - 300 + padY * 2,
          };
    const isAnyElevDragActive =
      Boolean(interiorDrag) ||
      Boolean(elevDraggingObs) ||
      Boolean(elevDraggingMod) ||
      Boolean(elevResizingMod);
    if (
      !isAnyElevDragActive ||
      !lockedElevVbRef.current ||
      lockedElevModIdRef.current !== activeModule.id
    ) {
      lockedElevVbRef.current = computedElevVb;
      lockedElevOriginRef.current = {
        x: activeModOffX,
        y: activeModOffY,
        modH: breakdown.overall.height,
      };
      lockedElevModIdRef.current = activeModule.id;
    }
    const vb = lockedElevVbRef.current;
    const elevLabelScale = Math.max(1.05, Math.min(3.6, ((vb.width || 2200) / 1050) * canvasFontScale));
    const roomOffX =
      mode === "elevation" && showRoomContextInElev
        ? (lockedElevOriginRef.current?.x ?? activeModOffX)
        : activeModOffX;
    const roomOffY =
      mode === "elevation" && showRoomContextInElev
        ? (lockedElevOriginRef.current?.y ?? activeModOffY)
        : activeModOffY;
    const roomModH =
      mode === "elevation" && showRoomContextInElev
        ? (lockedElevOriginRef.current?.modH ?? breakdown.overall.height)
        : breakdown.overall.height;
    const activeModVisualDx =
      mode === "elevation" && showRoomContextInElev ? activeModOffX - roomOffX : 0;
    const activeModVisualDy =
      mode === "elevation" && showRoomContextInElev
        ? roomOffY + roomModH - (activeModOffY + breakdown.overall.height)
        : 0;
    const activeModTransform =
      activeModVisualDx !== 0 || activeModVisualDy !== 0
        ? `translate(${activeModVisualDx}, ${activeModVisualDy})`
        : undefined;

    elevVbZoomRef.current = { vbWidth: vb.width, vbHeight: vb.height, zoom };

    // Collect hanging rails for 2D elevation (only when scene actually has modules!)
    const railComponents =
      hasSceneModules && mode === "elevation"
        ? breakdown.components.filter((c) => c.role === "hanging_rail")
        : [];

    // Filter or show doors in 2D elevation so interior blocks are unobstructed and easy to drag,
    // and return empty array when all modules have been deleted from the scene!
    const visibleElements = !hasSceneModules
      ? []
      : data.elements.filter((el) => {
      if (mode === "elevation") {
        if (!showDoorsIn2D && el.role.startsWith("door") && el.role !== "door_hinge") return false;
        if (
          el.role.startsWith("drawer_") &&
          el.role !== "drawer_front" &&
          el.role !== "drawer_handle"
        ) {
          return false;
        }
      }
      return true;
    });


    elevDropRuntimeRef.current =
      mode === "elevation"
        ? {
            vb,
            roomOffX,
            roomOffY,
            roomModH,
            mod: activeModule || project.modules[0],
            addInteriorItemAtElevation,
          }
        : null;


    const { handleElevationPointerMove, handleElevationPointerUp, findInteriorDragTarget, openElevationContextMenu, handleElevDragOver, handleElevDrop } = createCadElevationPointerAndDropHandlers({ activeBayIndex, activeHaloGroupRef, activeModGroupRef, activeModOffX, activeModule, activeModuleIndex, addDrawer, addFixedShelf, addHangingRail, addInteriorItemAtElevation, addInternalDrawer, addShelf, addStackedTopModule, applyMaterialToSimilarComponents, breakdown, commitHistoryTransaction, dropV4TemplateWithSnap, duplicateActiveModule, elevDisplayUnit, elevDragPreviewRef, elevDraggingMod, elevDraggingObs, elevDraggingSceneObj, elevInteriorLiveRef, elevResizingMod, elevSnapBannerDomRef, equalizeBaysAndShelves, finishModuleDragWithSmartSwap, floorSvgY, getElevScaleMmPerPx, handleChangeElevDisplayUnit, hasSceneModules, interiorDrag, interiorSnapTargetsRef, lastAccessoryDropTarget2DRef, lastDividerCommitValRef, lastInteriorCommitRef, lastModElevCommitRef, lastPointerMoveTsRef, magnetEnabled, mode, planRowSnapBanner, project, removeActiveModule, removeSelectedInteriorComponent, resizeModuleParametric, roomModH, roomOffX, roomOffY, sectionDirection2D, setActiveBayIndex, setActiveElevSnap, setBayCustomWidth, setCadContextMenu, setDragGhostPreview, setDrawerPlacement, setElevDraggingMod, setElevDraggingObs, setElevDraggingSceneObj, setElevPanMode, setElevResizingMod, setHangingRailElevation, setInteriorDrag, setModulePosition, setPanPx, setPlanRowSnapBanner, setSectionCutRatio2D, setSectionDirection2D, setSelectedComponentId, setShelfElevation, setShelfMountType, setShelfThickness, setShowDoorsIn2D, setShowRoomContextInElev, setSpecialFittingPlacement, setSubDividerPlacement, setZoom, showDoorsIn2D, showRoomContextInElev, snapXBadgeRef, snapXCircleRef, snapXGroupRef, snapXLineRef, snapXTextRef, snapYBadgeRef, snapYGroupRef, snapYLineRef, snapYTextRef, spaceObstacles, splitBayIntoTwo, updateObstaclePosition, updateSceneObject, vb });
    return (
      <div
        ref={elevContainerRef}
        data-testid={`v3-cad-${mode}`}
        onWheel={handleWheelZoom}
        onDragOver={handleElevDragOver}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setDragGhostPreview(null);
            setPlanRowSnapBanner(null);
          }
        }}
        onDrop={handleElevDrop}
        className="relative w-full h-full bg-[#F0EDE6] overflow-hidden select-none flex flex-col"
      >
        {(planRowSnapBanner || elevDraggingMod !== null) && (
          <div
            ref={elevSnapBannerDomRef}
            data-testid="elev-row-snap-banner"
            style={{ display: planRowSnapBanner ? "block" : "none" }}
            className="absolute bottom-14 left-1/2 -translate-x-1/2 z-30 pointer-events-none px-4 py-1.5 rounded-xl bg-[#141413]/95 text-[#FAF9F6] border border-[#D8D3C8]/40 shadow-xl font-mono text-xs font-semibold max-w-[90%] truncate"
          >
            {planRowSnapBanner || ""}
          </div>
        )}
        {mode === "elevation" ? (
          studioSafeInsets ? (
            <div
              style={{ height: `${(studioSafeInsets.topPx ?? 58) + 40}px` }}
              className="shrink-0 pointer-events-none"
            />
          ) : null
        ) : (
        <div
          style={
            studioSafeInsets
              ? {
                  marginTop: `${studioSafeInsets.topPx ?? 58}px`,
                  paddingLeft: `${studioSafeInsets.leftPx ?? 84}px`,
                  paddingRight: `${studioSafeInsets.rightPx ?? 20}px`,
                }
              : undefined
          }
          className="px-4 py-1.5 flex items-center justify-center shrink-0 z-10 pointer-events-none transition-[padding] duration-300"
        >
          <div className="pointer-events-auto max-w-full px-2.5 py-1 rounded-full bg-[#FBF9F5]/95 backdrop-blur-md border border-[#E6E0D3] shadow-[0_6px_22px_rgba(28,25,23,0.08)] flex flex-wrap items-center justify-center gap-1.5">
          {false ? null : (
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-1 rounded-lg bg-[#141413] text-[#FAF9F6] text-xs font-semibold tracking-tight">
                {mode === "plan"
                  ? "2D Üst Plan Kesiti"
                  : sectionDirection2D === "Z"
                  ? `2D A-A Yan Kesit (X: ${formatElevationValue(sectionCutCoordMm, elevDisplayUnit)})`
                  : `2D B-B Boyuna Kesit (Z: ${formatElevationValue(sectionCutCoordMm, elevDisplayUnit)})`}
              </span>
              {mode === "section" && !hideLegacySectionBar && (
                <div className="flex items-center gap-2 flex-wrap bg-white/80 backdrop-blur-md px-2.5 py-1 rounded-xl border border-stone-300 shadow-2xs text-xs">
                  <div className="inline-flex items-center rounded-lg bg-slate-100 p-0.5">
                    <button
                      type="button"
                      data-testid="section-dir-z-btn"
                      onClick={() => setSectionDirection2D("Z")}
                      className={`px-2 py-0.5 rounded-md font-bold text-[11px] transition cursor-pointer ${
                        sectionDirection2D === "Z"
                          ? "bg-blue-600 text-white shadow-2xs"
                          : "text-slate-700 hover:bg-white"
                      }`}
                      title="A-A Enine Yan Kesit (Derinlik × Yükseklik)"
                    >
                      ↔ A-A Yan Kesit (X)
                    </button>
                    <button
                      type="button"
                      data-testid="section-dir-x-btn"
                      onClick={() => setSectionDirection2D("X")}
                      className={`px-2 py-0.5 rounded-md font-bold text-[11px] transition cursor-pointer ${
                        sectionDirection2D === "X"
                          ? "bg-blue-600 text-white shadow-2xs"
                          : "text-slate-700 hover:bg-white"
                      }`}
                      title="B-B Boyuna Cephe Kesit (Genişlik × Yükseklik)"
                    >
                      ↕ B-B Boyuna Kesit (Z)
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-slate-600">
                      Kesit Noktası ({sectionDirection2D === "Z" ? "X" : "Z"}):
                    </span>
                    <input
                      type="range"
                      data-testid="section-cut-slider"
                      min={0.05}
                      max={0.95}
                      step={0.02}
                      value={sectionCutRatio2D}
                      onChange={(e) => setSectionCutRatio2D(Number(e.target.value))}
                      className="w-28 accent-blue-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                    />
                    <span className="font-mono font-extrabold text-blue-700 text-[11px] min-w-[54px]">
                      {formatElevationValue(sectionCutCoordMm, elevDisplayUnit)}
                    </span>
                  </div>
                  {sectionDirection2D === "Z" && activeModule.bays.length > 1 && (
                    <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
                      {activeModule.bays.map((b, bIdx) => {
                        const ratio = (bIdx + 0.5) / activeModule.bays.length;
                        return (
                          <button
                            key={b.index}
                            type="button"
                            onClick={() => setSectionCutRatio2D(Number(ratio.toFixed(2)))}
                            className="px-1.5 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold text-[10px] border border-blue-200 cursor-pointer"
                            title={`Bölme ${bIdx + 1} ortasından kesit al`}
                          >
                            B{bIdx + 1}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          </div>
        </div>
        )}

        {/* Bottom-Right Frosted Ice Zoom & Pan Capsule (non-elevation uses absolute; elevation uses flex-flow above bottom toolbar) */}
        {mode !== "elevation" && (
        <div
          style={
            studioSafeInsets
              ? {
                  bottom: `${(studioSafeInsets.bottomPx ?? 66) + 2}px`,
                  right: `${studioSafeInsets.rightPx ?? 20}px`,
                }
              : undefined
          }
          className="absolute bottom-4 right-4 z-10 flex items-center gap-1 birim-ice-pill p-1 rounded-2xl text-xs text-stone-800 transition-[right,bottom] duration-300"
        >
          <button
            type="button"
            title="Uzaklaştır (−)"
            onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.15).toFixed(2)))}
            className="w-7 h-7 rounded-xl hover:bg-white/75 font-mono font-bold flex items-center justify-center cursor-pointer"
          >
            −
          </button>
          <span className="font-mono text-[11px] font-bold min-w-[42px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            title="Yakınlaştır (+)"
            onClick={() => setZoom((z) => Math.min(3.5, +(z + 0.15).toFixed(2)))}
            className="w-7 h-7 rounded-xl hover:bg-white/75 font-mono font-bold flex items-center justify-center cursor-pointer"
          >
            +
          </button>
          <div className="h-4 w-px bg-slate-900/12 mx-0.5" />
          <button
            type="button"
            data-testid="elev-pan-mode-toggle"
            onClick={() => setElevPanMode((p) => !p)}
            className={`w-7 h-7 rounded-xl text-xs flex items-center justify-center transition cursor-pointer ${
              elevPanMode
                ? "birim-ice-btn-active"
                : "hover:bg-white/75 text-stone-700"
            }`}
            title="Çalışma Alanını Sürükle (Pan Modu)"
          >
            <span>🖐️</span>
            <span className="sr-only">Kaydır</span>
          </button>
          <button
            type="button"
            title="Yakınlaştırmayı ve Konumu Sıfırla"
            onClick={() => { setZoom(1); setPanPx({ x: 0, y: 0 }); setElevPanMode(false); }}
            className="w-7 h-7 rounded-xl hover:bg-white/75 text-stone-700 font-bold flex items-center justify-center cursor-pointer"
          >
            <span>↺</span>
            <span className="sr-only">Sıfırla</span>
          </button>
          <div className="h-4 w-px bg-white/15 mx-0.5" />
          <button
            type="button"
            data-testid="elev-print-a4-btn"
            onClick={() => printActive2DCadSheet("elevation")}
            title="2B Teknik Görünüş Paftasını A4 Yatay Olarak Yazdır / PDF Kaydet"
            className="h-7 px-2.5 rounded-xl hover:bg-white/15 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
          >
            <span>🖨</span>
            <span>Yazdır</span>
          </button>
        </div>
        )}

        {/* 2B TEKNİK ÇALIŞMA EKRANI — SADE DUVAR SEÇİCİ */}
        {mode === "elevation" && activeElevWallTabs.length > 1 && (
          <div
            data-testid="v11-2d-wall-switcher"
            className="fixed top-[116px] left-1/2 -translate-x-1/2 z-30 inline-flex items-center gap-0.5 p-0.5 rounded-full bg-[#1C222E]/80 backdrop-blur-xl border border-white/12 shadow-md"
          >
            {activeElevWallTabs.map((wk) => {
              const meta = elevWallMeta[wk];
              const isAct = wk === activeElevWallKey;
              const modTags = meta.indices.map((i) => `M${i + 1}`).join(", ");
              const shortLbl = wk === "main" ? "Ana" : wk === "left" ? "Sol" : wk === "right" ? "Sağ" : "Karşı";
              return (
                <button
                  key={wk}
                  type="button"
                  title={`${meta.label} (${modTags})`}
                  onClick={() => {
                    const targetIdx = meta.indices[0];
                    if (typeof targetIdx === "number") {
                      setActiveModuleIndex(targetIdx);
                    }
                  }}
                  className={`h-6 px-2.5 rounded-full text-[11px] font-semibold transition cursor-pointer ${
                    isAct
                      ? "bg-white/20 text-white"
                      : "text-slate-400 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {shortLbl}
                </button>
              );
            })}
          </div>
        )}

        <CadElevationAndSectionSvgCanvas activeElevSnap={activeElevSnap} activeElevWallKey={activeElevWallKey} activeHaloGroupRef={activeHaloGroupRef} activeModGroupRef={activeModGroupRef} activeModOffX={activeModOffX} activeModTransform={activeModTransform} activeModule={activeModule} activeModuleIndex={activeModuleIndex} beginHistoryTransaction={beginHistoryTransaction} breakdown={breakdown} ceilingH={ceilingH} data={data} dragGhostPreview={dragGhostPreview} duplicateSceneObject={duplicateSceneObject} effectiveInteriorMoveMode={effectiveInteriorMoveMode} effectiveShowAllDims={effectiveShowAllDims} elevCoordMode={elevCoordMode} elevDetailLevel={elevDetailLevel} elevDisplayUnit={elevDisplayUnit} elevDraggingMod={elevDraggingMod} elevInteriorLiveRef={elevInteriorLiveRef} elevLabelScale={elevLabelScale} elevPanMode={elevPanMode} elevResizingMod={elevResizingMod} elevWallMeta={elevWallMeta} findInteriorDragTarget={findInteriorDragTarget} getElevScaleMmPerPx={getElevScaleMmPerPx} getModElevWallKey={getModElevWallKey} getModWallAlongX={getModWallAlongX} grainContinuityMap2D={grainContinuityMap2D} handleElevationPointerMove={handleElevationPointerMove} handleElevationPointerUp={handleElevationPointerUp} hasSceneModules={hasSceneModules} hoveredElevationItem={hoveredElevationItem} hoveredHeightHandle={hoveredHeightHandle} interiorDrag={interiorDrag} lastDividerCommitValRef={lastDividerCommitValRef} lastInteriorCommitRef={lastInteriorCommitRef} liveAccessoryGhost2D={liveAccessoryGhost2D} liveSpatialAlerts={liveSpatialAlerts} longPress2DRef={longPress2DRef} mainWallLen={mainWallLen} maxWallSpanX={maxWallSpanX} mode={mode} openElevationContextMenu={openElevationContextMenu} panPx={panPx} panPxRef={panPxRef} panning2D={panning2D} pinchTrackerRef={pinchTrackerRef} project={project} railComponents={railComponents} removeSceneObject={removeSceneObject} removeSpaceObstacle={removeSpaceObstacle} roomModH={roomModH} roomOffX={roomOffX} roomOffY={roomOffY} sectionDirection2D={sectionDirection2D} selectedComponentId={selectedComponentId} selectedPlanObject={selectedPlanObject} selectedSceneObjectId={selectedSceneObjectId} setActiveBayIndex={setActiveBayIndex} setActiveModuleIndex={setActiveModuleIndex} setCadContextMenu={setCadContextMenu} setElevDraggingMod={setElevDraggingMod} setElevDraggingObs={setElevDraggingObs} setElevDraggingSceneObj={setElevDraggingSceneObj} setElevResizingMod={setElevResizingMod} setHoveredElevationItem={setHoveredElevationItem} setHoveredHeightHandle={setHoveredHeightHandle} setInteriorDrag={setInteriorDrag} setPanPx={setPanPx} setPanning2D={setPanning2D} setSelectedComponentId={setSelectedComponentId} setSelectedPlanObject={setSelectedPlanObject} setSelectedSceneObjectId={setSelectedSceneObjectId} setZoom={setZoom} showDoorsIn2D={showDoorsIn2D} showRoomContextInElev={showRoomContextInElev} snapXBadgeRef={snapXBadgeRef} snapXCircleRef={snapXCircleRef} snapXGroupRef={snapXGroupRef} snapXLineRef={snapXLineRef} snapXTextRef={snapXTextRef} snapYBadgeRef={snapYBadgeRef} snapYGroupRef={snapYGroupRef} snapYLineRef={snapYLineRef} snapYTextRef={snapYTextRef} spaceObstacles={spaceObstacles} spaceWalls={spaceWalls} updateSceneObject={updateSceneObject} updateSpaceObstacle={updateSpaceObstacle} vb={vb} visibleElements={visibleElements} zoom={zoom} zoomRef={zoomRef} />

        {/* Bölge C & D: Bağlamsal Düzenleme Araçları ve Birleşik Alt Bilgi Çubuğu (2D Cephe) */}
        {mode === "elevation" && hasSceneModules && (() => {
          const selectedElevContext = resolveSelectedElevationContext(
            activeModule,
            activeModuleIndex,
            selectedComponentId,
            data.elements
          );
          const elevStatus = interiorDrag
            ? { text: "İç Parça Taşınıyor", tone: "orange" as const }
            : elevDraggingMod || elevResizingMod
            ? { text: "Modül Düzenleniyor", tone: "orange" as const }
            : elevPanMode
            ? { text: "Kaydır (Pan)", tone: "neutral" as const }
            : effectiveInteriorMoveMode
            ? { text: isCtrlHeldElev ? "İç Taşıma (Ctrl)" : "İç Taşıma Modu", tone: "orange" as const }
            : selectedComponentId
            ? { text: "Parça Seçili", tone: "blue" as const }
            : { text: "Hazır", tone: "green" as const };

          return (
            <>
              <ElevationContextualPanel
                activeModule={activeModule}
                context={selectedElevContext}
                displayUnit={elevDisplayUnit}
                topOffsetPx={(studioSafeInsets?.topPx ?? 0) + 56}
                rightOffsetPx={studioSafeInsets?.rightPx ?? 16}
                onCloseSelection={() => setSelectedComponentId(null)}
                onDeleteSelected={() => removeSelectedInteriorComponent()}
                onSetShelfElevation={(bIdx, id, elevY) => setShelfElevation(bIdx, id, elevY, true)}
                onSetDrawerPlacement={(bIdx, id, elevY, h) => setDrawerPlacement(bIdx, id, elevY, h, true)}
                onSetHangingRailElevation={(bIdx, id, elevY) => setHangingRailElevation(bIdx, id, elevY, true)}
                onSetSpecialFittingPlacement={(bIdx, id, patch) => setSpecialFittingPlacement(bIdx, id, patch, true)}
                onSetSubDividerPlacement={(bIdx, id, upd) => setSubDividerPlacement(bIdx, id, upd, true)}
                onResizeModule={(modIdx, w, h, d) => resizeModuleParametric(modIdx, w, undefined, d, h)}
                onSetModulePosition={(modIdx, x, z, wallId, y) => setModulePosition(modIdx, x, z, wallId, y)}
              />
                    {/* Sağ Altta Yüzen Buzlu Cam Canlı Kot Müfettiş HUD Kartı */}
      {mode === "elevation" && hoveredElevationItem && (
        <div
          data-testid="elev-floating-inspector-hud"
          className="pointer-events-none absolute bottom-16 right-4 z-30 w-[290px] sm:w-[315px] rounded-xl bg-[#0D1117]/88 backdrop-blur-xl border border-white/15 p-3 shadow-2xl text-zinc-100"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0" />
                <span className="text-xs font-semibold truncate">{hoveredElevationItem.title}</span>
              </div>
              {hoveredElevationItem.subtitle && (
                <div className="text-[11px] text-slate-400 mt-0.5 truncate">{hoveredElevationItem.subtitle}</div>
              )}
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-white/10 grid grid-cols-2 gap-2 font-mono">
            <div className="px-2 py-1.5 rounded-lg bg-white/[0.04]">
              <div className="text-[9px] uppercase text-slate-400">Global Y</div>
              <div className="text-xs font-bold text-cyan-300 tabular-nums">{Math.round(hoveredElevationItem.globalY)} mm</div>
            </div>
            <div className="px-2 py-1.5 rounded-lg bg-white/[0.04]">
              <div className="text-[9px] uppercase text-slate-400">Kapak İçi (Lokal)</div>
              <div className={`text-xs font-bold tabular-nums ${
                hoveredElevationItem.doorBaseY && hoveredElevationItem.doorBaseY > 0 ? "text-amber-300" : "text-slate-300"
              }`}>
                {typeof hoveredElevationItem.doorLocalY === "number" ? `${Math.round(hoveredElevationItem.doorLocalY)} mm` : "—"}
              </div>
            </div>
          </div>
          {hoveredElevationItem.datumNote && (
            <div className="mt-2 text-[10px] text-slate-400 truncate">{hoveredElevationItem.datumNote}</div>
          )}
        </div>
      )}

      <ElevationBottomBar
                activeModule={activeModule}
                activeModuleIndex={activeModuleIndex}
                selectedContext={selectedElevContext}
                displayUnit={elevDisplayUnit}
                statusText={elevStatus.text}
                statusTone={elevStatus.tone}
                studioSafeInsets={studioSafeInsets}
                onSetModuleOffsetFromLeftWall={(modId, xMm) => setModuleOffsetFromLeftWall(modId, xMm)}
                onResizeModuleWidth={(wMm) =>
                  resizeModuleParametric(
                    activeModuleIndex,
                    wMm,
                    undefined,
                    activeModule.dimensions.depth,
                    activeModule.dimensions.height
                  )
                }
              />
              {/* Unified Bottom Floating 2D Elevation Pill Dock (matches 3D BottomSceneDock glass capsule) */}
              <div
                style={
                  studioSafeInsets
                    ? {
                        paddingLeft: `${Math.max(16, studioSafeInsets.leftPx ?? 84)}px`,
                        paddingRight: `${Math.max(16, studioSafeInsets.rightPx ?? 20)}px`,
                        paddingBottom: "max(0.9rem, env(safe-area-inset-bottom))",
                      }
                    : undefined
                }
                className="px-4 pb-3.5 flex items-center justify-center shrink-0 z-10 pointer-events-none transition-[padding] duration-300"
              >
                <div className="pointer-events-auto max-w-full overflow-x-auto no-scrollbar h-12 max-sm:h-11 px-2.5 rounded-full bg-[#1C222E]/88 backdrop-blur-2xl border border-white/[0.18] ring-1 ring-black/55 shadow-[0_20px_50px_rgba(0,0,0,0.52)] flex items-center gap-1.5 text-xs text-[#F3F4F6]">
                  <ElevationTopBar
                    project={project}
                    activeModule={activeModule}
                    activeModuleIndex={activeModuleIndex}
                    hasSceneModules={hasSceneModules}
                    spaceWallsLength={spaceWalls?.[0]?.length || 3600}
                    detailLevel={elevDetailLevel}
                    onChangeDetailLevel={(lvl) => {
                      handleChangeElevDetailLevel(lvl);
                      setShowAllDimensions(lvl === "technical");
                    }}
                    displayUnit={elevDisplayUnit}
                    onChangeDisplayUnit={handleChangeElevDisplayUnit}
                    interiorMoveMode={effectiveInteriorMoveMode}
                    onToggleInteriorMoveMode={() => setElevInteriorMoveMode((v) => !v)}
                    elevPanMode={elevPanMode}
                    onToggleElevPanMode={() => setElevPanMode((p) => !p)}
                    showRoomContextInElev={showRoomContextInElev}
                    onToggleRoomContext={() => setShowRoomContextInElev((v) => !v)}
                    showDoorsIn2D={showDoorsIn2D}
                    onToggleDoorsIn2D={() => setShowDoorsIn2D((v) => !v)}
                    showAllDimensions={effectiveShowAllDims}
                    onToggleShowAllDimensions={() => {
                      const next = !effectiveShowAllDims;
                      setShowAllDimensions(next);
                      handleChangeElevDetailLevel(next ? "technical" : "selected");
                    }}
                    coordMode={elevCoordMode}
                    onChangeCoordMode={(m) => {
                      setElevCoordMode(m);
                      if (!effectiveShowAllDims) {
                        setShowAllDimensions(true);
                      }
                    }}
                    selectedObstacle={
                      selectedPlanObject?.kind === "obstacle"
                        ? spaceObstacles.find((o) => o.id === selectedPlanObject.id) ?? null
                        : null
                    }
                    onUpdateObstacle={updateSpaceObstacle}
                    onUpdateObstaclePosition={updateObstaclePosition}
                    onRemoveObstacle={(id) => {
                      removeSpaceObstacle(id);
                      setSelectedPlanObject(null);
                    }}
                    onSwapModule={(idx, dir) => {
                      const res = swapModuleWithNeighbor(idx, dir);
                      if (res) {
                        setPlanRowSnapBanner(
                          `🔄 ${dir === "left" ? "Solundaki" : "Sağındaki"} "${res.swappedWithName}" ile yer değiştirdi`
                        );
                        setTimeout(() => setPlanRowSnapBanner(null), 2500);
                      }
                    }}
                    onSetModulePosition={setModulePosition}
                    onUpdateCeiling={updateCeilingConfig}
                    onUpdateCeilingHeightMm={(h) =>
                      setRoomDimensions(spaceWalls?.[0]?.length || 3600, h)
                    }
                    onUpdateCarcass={updateCarcassConfig}
                    onSetFacadeGrainContinuity={setFacadeGrainContinuity}
                  />

                  <span className="h-4 w-px bg-white/[0.14] mx-0.5 hidden sm:inline-block shrink-0" />

                  {/* Integrated Zoom & Pan Controls */}
                  <div className="inline-flex items-center gap-0.5 rounded-full bg-black/35 border border-white/[0.12] p-0.5 text-xs text-slate-200 shrink-0">
                    <button
                      type="button"
                      title="Uzaklaştır (−)"
                      onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.15).toFixed(2)))}
                      className="w-7 h-7 rounded-full hover:bg-white/[0.14] hover:text-white font-mono font-bold flex items-center justify-center transition cursor-pointer"
                    >
                      −
                    </button>
                    <span className="font-mono text-[11px] font-semibold min-w-[38px] text-center text-slate-200">
                      {Math.round(zoom * 100)}%
                    </span>
                    <button
                      type="button"
                      title="Yakınlaştır (+)"
                      onClick={() => setZoom((z) => Math.min(3.5, +(z + 0.15).toFixed(2)))}
                      className="w-7 h-7 rounded-full hover:bg-white/[0.14] hover:text-white font-mono font-bold flex items-center justify-center transition cursor-pointer"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      title="Yakınlaştırmayı ve Konumu Sıfırla"
                      onClick={() => { setZoom(1); setPanPx({ x: 0, y: 0 }); setElevPanMode(false); }}
                      className="w-7 h-7 rounded-full hover:bg-white/[0.14] text-slate-300 hover:text-white font-bold flex items-center justify-center transition cursor-pointer"
                    >
                      <span>↺</span>
                      <span className="sr-only">Sıfırla</span>
                    </button>
                  </div>
                </div>
              </div>
            </>
          );
        })()}

        {/* V5 Interactive 2D Live Dimension Chain Quick-Editor (Section / non-elevation fallback) */}
        {mode !== "elevation" && activeModule && (
          <div
            data-testid="v5-2d-live-dimension-chain-bar"
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 max-w-[calc(100vw-24px)] overflow-x-auto no-scrollbar px-3.5 py-1.5 rounded-full bg-[#1C222E]/88 backdrop-blur-2xl border border-white/[0.18] ring-1 ring-black/55 shadow-[0_20px_50px_rgba(0,0,0,0.52)] flex items-center gap-3 text-[11px] text-slate-200 whitespace-nowrap"
          >
            <span className="font-bold text-white truncate max-w-[160px]">{activeModule.name}</span>
            <label className="inline-flex items-center gap-1.5">
              <span className="text-slate-400 font-medium">Sol Mesafe:</span>
              <input
                type="number" inputMode="decimal"
                step={elevDisplayUnit === "cm" ? 1 : 10}
                value={toDisplayUnitNumber(activeModule.position.x, elevDisplayUnit)}
                onChange={(e) =>
                  setModuleOffsetFromLeftWall(
                    activeModule.id,
                    toCanonicalMm(Number(e.target.value) || 0, elevDisplayUnit)
                  )
                }
                className="w-16 px-1.5 py-0.5 rounded-full bg-white/[0.08] border border-white/[0.16] font-mono font-bold text-white text-center focus:outline-none focus:border-sky-400"
              />
              <span className="font-mono text-[10px] text-slate-400">{elevDisplayUnit}</span>
            </label>
            <label className="inline-flex items-center gap-1.5">
              <span className="text-slate-400 font-medium">Genişlik:</span>
              <input
                type="number" inputMode="decimal"
                step={elevDisplayUnit === "cm" ? 1 : 10}
                min={elevDisplayUnit === "cm" ? 15 : 150}
                max={elevDisplayUnit === "cm" ? 360 : 3600}
                value={toDisplayUnitNumber(activeModule.dimensions.width, elevDisplayUnit)}
                onChange={(e) =>
                  resizeModuleParametric(
                    activeModuleIndex,
                    toCanonicalMm(Number(e.target.value) || 0, elevDisplayUnit) || activeModule.dimensions.width,
                    undefined,
                    activeModule.dimensions.depth,
                    activeModule.dimensions.height
                  )
                }
                className="w-16 px-1.5 py-0.5 rounded-full bg-white/[0.08] border border-white/[0.16] font-mono font-bold text-white text-center focus:outline-none focus:border-sky-400"
              />
              <span className="font-mono text-[10px] text-slate-400">{elevDisplayUnit}</span>
            </label>
          </div>
        )}
        <CadContextMenu2D menu={cadContextMenu} onClose={() => setCadContextMenu(null)} />
      </div>
    );
};
