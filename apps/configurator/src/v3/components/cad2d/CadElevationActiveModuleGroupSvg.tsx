"use client";


import React from "react";
import { ElevationMultiHoleAndGrainSvg } from "../workspace/CeilingAndGrain2DOverlays";
import { formatElevationValue, truncateCadLabel, resolveElevationLabelVisibility, computeElevationHingeAnnotation, formatHoveredElevationHud } from "../workspace/elevation2dHelpers";
import { selectModuleBayComponentSafe } from "../../../store/useConfiguratorStore";

import type { CadElevationAndSectionSvgCanvasProps } from "./cad2dTypes";

export const CadElevationActiveModuleGroupSvg: React.FC<CadElevationAndSectionSvgCanvasProps> = (props) => {
  const { activeElevSnap, activeModGroupRef, activeModTransform, activeModule, activeModuleIndex, beginHistoryTransaction, breakdown, data, effectiveInteriorMoveMode, effectiveShowAllDims, elevCoordMode, elevDetailLevel, elevDisplayUnit, elevInteriorLiveRef, elevPanMode, elevResizingMod, findInteriorDragTarget, getElevScaleMmPerPx, grainContinuityMap2D, hasSceneModules, hoveredElevationItem, hoveredHeightHandle, interiorDrag, lastDividerCommitValRef, lastInteriorCommitRef, mode, openElevationContextMenu, railComponents, sectionDirection2D, selectedComponentId, setActiveBayIndex, setElevDraggingMod, setElevResizingMod, setHoveredElevationItem, setHoveredHeightHandle, setInteriorDrag, setSelectedComponentId, vb, visibleElements } = props;
  return (
          <g ref={activeModGroupRef} transform={activeModTransform || ""}>
          {mode === "elevation" && hasSceneModules && (
            <rect
              x={0}
              y={0}
              width={breakdown.overall.width}
              height={breakdown.overall.height}
              fill="transparent"
              data-testid="elev-active-mod-grab-hitbox"
              className={
                elevPanMode || effectiveInteriorMoveMode
                  ? "cursor-default"
                  : "cursor-grab active:cursor-grabbing"
              }
              onPointerDown={(e) => {
                if (elevPanMode || effectiveInteriorMoveMode || e.button !== 0 || e.altKey) {
                  if (e.button === 0 && !elevPanMode) setSelectedComponentId(null);
                  return;
                }
                e.stopPropagation();
                setSelectedComponentId(null);
                const svgEl = (e.currentTarget as Element).closest("svg") as SVGSVGElement | null;
                const scale = svgEl ? getElevScaleMmPerPx(svgEl) : { x: 4, y: 4 };
                beginHistoryTransaction();
                setElevDraggingMod({
                  modIdx: activeModuleIndex,
                  startClientX: e.clientX,
                  startClientY: e.clientY,
                  startModX: activeModule.position.x,
                  startModY: activeModule.position.y,
                  mmPerPxX: scale.x,
                  mmPerPxY: scale.y,
                });
              }}
            />
          )}
          {/* Valid Drop Target Bay Highlight during Interior Drag */}
          {mode === "elevation" &&
            interiorDrag &&
            (() => {
              const bWidths = breakdown.bayWidths;
              const panelT = activeModule.carcass.panelThickness || 18;
              const plinthH = activeModule.carcass.plinthHeight || 0;
              let bayX = panelT;
              for (let i = 0; i < interiorDrag.bayIdx && i < bWidths.length; i++) {
                bayX += bWidths[i] + panelT;
              }
              const bayW = bWidths[interiorDrag.bayIdx] ?? 0;
              const innerH = Math.max(40, breakdown.overall.height - plinthH - panelT * 2);
              return (
                <rect
                  data-testid="elev-interior-drag-target-bay"
                  x={bayX + 4}
                  y={panelT + 4}
                  width={Math.max(10, bayW - 8)}
                  height={Math.max(20, innerH - 8)}
                  rx={8}
                  fill="rgba(16, 185, 129, 0.09)"
                  stroke="#059669"
                  strokeWidth="4"
                  strokeDasharray="14 8"
                  className="pointer-events-none"
                />
              );
            })()}
          {visibleElements.map((el) => {
            const isSelected = el.isSelected;
            const isHinge = el.role === "door_hinge";
            const isSpecialFitting = el.role === "special_fitting";
            const isDoor = el.role.startsWith("door") && !isHinge && el.role !== "door_handle";
            const isDrawer = el.role.startsWith("drawer");
            const isShelf = el.role === "shelf";
            const shelfLookupMeta = isShelf ? findInteriorDragTarget(el.id) : null;
            const shelfModelObj =
              shelfLookupMeta?.kind === "shelf"
                ? activeModule.bays[shelfLookupMeta.bayIdx]?.shelves.find(
                    (s) => s.id === shelfLookupMeta.targetId
                  )
                : undefined;
            const isFixedShelf = Boolean(
              shelfModelObj && (shelfModelObj.isAdjustable === false || shelfModelObj.isFixed === true)
            );
            const isDivider = el.role === "carcass_divider";
            const isSubDivider = el.role === "carcass_sub_divider";
            const isDrawerHandle = el.role === "drawer_handle" || el.role === "door_handle" || el.role === "gola_profile";
            const dragMeta = mode === "elevation" ? findInteriorDragTarget(el.id) : null;
            const isActiveDrag = interiorDrag?.targetId === dragMeta?.targetId && Boolean(dragMeta);
            const elVis = resolveElevationLabelVisibility(elevDetailLevel, {
              isActiveModule: true,
              isSelected: Boolean(isSelected),
              isHovered: false,
              isDragging: isActiveDrag,
              hasInteriorSelection: Boolean(selectedComponentId),
            });

            const isPlinth = el.role === "plinth";
            const isPlinthSeal = el.role === "plinth_seal" || el.id.includes("_plinth_seal_");
            const isHiddenLeg = el.role === "plinth_leg_hidden";
            const isSectionLegOrClip =
              mode === "section" &&
              (el.id.includes("_plastic_leg_") || el.id.includes("_plinth_clip_") || el.id.includes("_plinth_glide_"));
            let fill = "#FFFFFF";
            let stroke = "#1C1917";
            if (isDoor) {
              fill = "#F5F5F4";
              stroke = "#57534E";
            } else if (isPlinthSeal) {
              fill = "#27272A";
              stroke = "#18181B";
            } else if (isPlinth) {
              fill = "#E7E5E4";
              stroke = "#1C1917";
            } else if (isHiddenLeg) {
              fill = "none";
              stroke = "#64748B";
            } else if (isSectionLegOrClip) {
              fill = "#CBD5E1";
              stroke = "#334155";
            } else if (isDrawerHandle) {
              fill = "#44403C";
              stroke = "#1C1917";
            } else if (mode === "section" && el.role === "drawer_bottom") {
              fill = "#D97706";
              stroke = "#451A03";
            } else if ((mode === "section" || mode === "plan") && el.role === "carcass_back") {
              fill = "#94A3B8";
              stroke = "#0F172A";
            } else if (mode === "section" && el.role === "drawer_back") {
              fill = "#FDBA74";
              stroke = "#7C2D12";
            } else if (mode === "section" && sectionDirection2D === "Z" && (el.role === "drawer_side_left" || el.role === "drawer_slide")) {
              fill = el.role === "drawer_slide" ? "#CBD5E1" : "#F8FAFC";
              stroke = "#64748B";
            } else if (isDrawer) {
              fill = "#FEF3C7";
              stroke = "#9A3412";
            } else if (isShelf) {
              fill = isFixedShelf ? "#FDBA74" : "#FEF3C7";
              stroke = isFixedShelf ? "#9A3412" : "#B45309";
            } else if (isDivider) {
              fill = "#E7E5E4";
              stroke = "#1C1917";
            } else if (isSubDivider) {
              fill = "#FDBA74";
              stroke = "#9A3412";
            } else if (isHinge) {
              fill = "#0284C7";
              stroke = "#0F172A";
            } else if (isSpecialFitting) {
              fill = "#A7F3D0";
              stroke = "#047857";
            }
            if (isActiveDrag) {
              fill = "#FFEDD5";
              stroke = "#EA580C";
            } else if (isSelected) {
              fill = "#DBEAFE";
              stroke = "#2563EB";
            }

            // Compute elevation badge text for shelves and drawers
            const elevMm = dragMeta && (dragMeta.kind === "shelf" || dragMeta.kind === "drawer")
              ? dragMeta.startVal
              : null;

            return (
              <g
                key={el.id}
                data-testid={`cad-el-${el.id}`}
                data-interior-owner={dragMeta?.targetId}
                onMouseEnter={() => {
                  if (mode !== "elevation") return;
                  if (isShelf && elevMm !== null) {
                    setHoveredElevationItem({
                      id: el.id,
                      kind: "shelf",
                      title: isFixedShelf ? "Sabit Raf" : "Hareketli Raf",
                      globalY: elevMm,
                      svgY: el.y + el.height / 2,
                    });
                  } else if (isDrawer && el.role === "drawer_front" && elevMm !== null) {
                    setHoveredElevationItem({
                      id: el.id,
                      kind: "drawer",
                      title: "Çekmece",
                      globalY: elevMm,
                      svgY: el.y + el.height / 2,
                    });
                  }
                }}
                onMouseLeave={() => {
                  if (mode !== "elevation") return;
                  setHoveredElevationItem((prev) => (prev?.id === el.id ? null : prev));
                }}
                onContextMenu={(e) => {
                  const ctxMeta = dragMeta ?? findInteriorDragTarget(el.id);
                  if (ctxMeta) {
                    openElevationContextMenu(e, {
                      kind: "interior",
                      meta: ctxMeta,
                      compId: el.id,
                    });
                  } else {
                    openElevationContextMenu(e, { kind: "module" });
                  }
                }}
                onPointerDown={(e) => {
                  if (dragMeta && !elevPanMode && e.button === 0 && !e.altKey) {
                    e.stopPropagation();
                    const svgEl = (e.currentTarget as Element).closest("svg") as SVGSVGElement | null;
                    const scale = svgEl ? getElevScaleMmPerPx(svgEl) : { x: 4, y: 4 };
                    document.body.dataset.birimUiDragging = "1";
                    elevInteriorLiveRef.current = null;
                    lastInteriorCommitRef.current = "";
                    lastDividerCommitValRef.current = "";
                    selectModuleBayComponentSafe({
                      activeBayIndex: dragMeta.bayIdx,
                      selectedComponentId: el.id,
                      beginBatch: true,
                    });
                    setInteriorDrag({
                      kind: dragMeta.kind,
                      bayIdx: dragMeta.bayIdx,
                      targetId: dragMeta.targetId,
                      startClientX: e.clientX,
                      startClientY: e.clientY,
                      startValueMm: dragMeta.startVal,
                      startElevY: dragMeta.startElevY,
                      itemHeightMm: dragMeta.itemHeightMm,
                      mmPerPxX: scale.x,
                      mmPerPxY: scale.y,
                    });
                  } else if (!dragMeta && !effectiveInteriorMoveMode && mode === "elevation" && e.button === 0 && !elevPanMode && !e.altKey) {
                    e.stopPropagation();
                    const svgEl = (e.currentTarget as Element).closest("svg") as SVGSVGElement | null;
                    const scale = svgEl ? getElevScaleMmPerPx(svgEl) : { x: 4, y: 4 };
                    document.body.dataset.birimUiDragging = "1";
                    selectModuleBayComponentSafe({
                      selectedComponentId: el.id,
                      beginBatch: true,
                    });
                    setElevDraggingMod({
                      modIdx: activeModuleIndex,
                      startClientX: e.clientX,
                      startClientY: e.clientY,
                      startModX: activeModule.position.x,
                      startModY: activeModule.position.y,
                      mmPerPxX: scale.x,
                      mmPerPxY: scale.y,
                    });
                  } else {
                    setSelectedComponentId(el.id);
                  }
                }}
                className={`group/el ${
                  elevPanMode
                    ? "cursor-grab"
                    : dragMeta
                    ? dragMeta.kind === "sub_divider"
                      ? "cursor-move"
                      : dragMeta.kind === "divider"
                      ? "cursor-ew-resize"
                      : "cursor-ns-resize"
                    : "cursor-grab"
                }`}
              >
                {/* Invisible wider hit target for thin shelves & dividers so dragging is effortless */}
                {dragMeta && (
                  <rect
                    x={el.x - (isDivider || isSubDivider ? 30 : 0)}
                    y={el.y - (isShelf || isSubDivider ? 24 : 0)}
                    width={Math.max(1, el.width + (isDivider || isSubDivider ? 60 : 0))}
                    height={Math.max(1, el.height + (isShelf || isSubDivider ? 48 : 0))}
                    fill="transparent"
                  />
                )}

                <rect
                  data-elev-bg={!dragMeta ? "true" : undefined}
                  x={el.x}
                  y={el.y}
                  width={Math.max(1, el.width)}
                  height={Math.max(1, el.height)}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={
                    isSelected || isActiveDrag
                      ? 6
                      : isFixedShelf
                      ? 4.5
                      : mode === "section" && (el.role === "drawer_back" || el.role === "drawer_bottom")
                      ? 3.8
                      : (mode === "section" || mode === "plan") && el.role === "carcass_back"
                      ? 3.5
                      : isHiddenLeg || (mode === "section" && sectionDirection2D === "Z" && el.role === "drawer_side_left")
                      ? 2
                      : 3
                  }
                  strokeDasharray={
                    isHiddenLeg
                      ? "10 7"
                      : mode === "section" && sectionDirection2D === "Z" && el.role === "drawer_side_left"
                      ? "8 5"
                      : undefined
                  }
                  opacity={
                    isDoor
                      ? 0.35
                      : mode === "section" && sectionDirection2D === "Z" && el.role === "drawer_side_left"
                      ? 0.36
                      : isHiddenLeg
                      ? 0.7
                      : 0.98
                  }
                />
                {isFixedShelf && el.width >= 80 && (
                  <g className="pointer-events-none">
                    <circle cx={el.x + 12} cy={el.y + el.height / 2} r={5} fill="#7C2D12" stroke="#FFFBEB" strokeWidth="1.5" />
                    <circle cx={el.x + el.width - 12} cy={el.y + el.height / 2} r={5} fill="#7C2D12" stroke="#FFFBEB" strokeWidth="1.5" />
                    <rect
                      x={el.x + el.width / 2 - 32}
                      y={el.y - 18}
                      width={64}
                      height={16}
                      rx={4}
                      fill="#9A3412"
                    />
                    <text
                      x={el.x + el.width / 2}
                      y={el.y - 6}
                      textAnchor="middle"
                      fill="#FFFBEB"
                      fontSize="11"
                      fontWeight="800"
                      fontFamily="Inter, 'Plus Jakarta Sans', system-ui, sans-serif"
                    >
                      ●
                    </text>
                  </g>
                )}
                {mode === "elevation" && activeModule && elevDetailLevel !== "clean" &&
                  el.role !== "carcass_side_left" &&
                  el.role !== "carcass_side_right" &&
                  el.role !== "carcass_divider" && (
                  <ElevationMultiHoleAndGrainSvg
                    el={el}
                    activeModule={activeModule}
                    grainAssignment={grainContinuityMap2D.get(el.id)}
                  />
                )}
                {mode === "section" && el.role === "drawer_back" && el.height >= 36 && (
                  <text
                    x={sectionDirection2D === "Z" ? el.x + el.width + 14 : el.x + el.width / 2}
                    y={el.y + el.height / 2 + 6}
                    textAnchor={sectionDirection2D === "Z" ? "start" : "middle"}
                    fill="#7C2D12"
                    fontSize="18"
                    fontWeight="800"
                    fontFamily="Inter, 'Plus Jakarta Sans', system-ui, sans-serif"
                    className="pointer-events-none"
                  >
                    {sectionDirection2D === "Z" ? "← Çekmece Arkalığı (16mm)" : "Çekmece Arkalığı"}
                  </text>
                )}
                {/* Architectural Recessed Toe-Kick Shadow Strip & Label on Front Plinth */}
                {isPlinth && el.id.includes("_plinth_front") && el.height >= 35 && (
                  <g className="pointer-events-none">
                    <rect
                      x={el.x + 1.5}
                      y={el.y + 1.5}
                      width={Math.max(1, el.width - 3)}
                      height={Math.min(14, el.height * 0.2)}
                      fill="#1C1917"
                      opacity={0.14}
                    />
                    {mode === "elevation" && elVis.showPlinthLabel && el.width >= 360 && (
                      <text
                        x={el.x + el.width / 2}
                        y={el.y + el.height / 2 + 8}
                        textAnchor="middle"
                        fill="#44403C"
                        fontSize="20"
                        fontWeight="700"
                        fontFamily="Inter, 'Plus Jakarta Sans', system-ui, sans-serif"
                      >
                        {`BAZA H:${formatElevationValue(activeModule.carcass.plinthHeight, elevDisplayUnit)}`}
                      </text>
                    )}
                  </g>
                )}

                {/* Middle Divider Left/Right Drag Grip Badge (◀ ▶) */}
                {mode === "elevation" && isDivider && elevDetailLevel !== "clean" && (
                  <g className="pointer-events-none">
                    <rect
                      x={el.x + el.width / 2 - 28}
                      y={el.y + el.height / 2 - 16}
                      width={56}
                      height={32}
                      rx={8}
                      fill={isActiveDrag ? "#EA580C" : isSelected ? "#1D4ED8" : "#059669"}
                      stroke="#FFFFFF"
                      strokeWidth="2.5"
                    />
                    <text
                      x={el.x + el.width / 2}
                      y={el.y + el.height / 2 + 6}
                      textAnchor="middle"
                      fill="#FFFFFF"
                      fontSize="18"
                      fontWeight="900"
                    >
                      ◀▶
                    </text>
                  </g>
                )}

                {/* Readable Label + Elevation Pill on Shelves & Drawers */}
                {mode === "elevation" && (isShelf || (isDrawer && el.role === "drawer_front")) && (el.width > 160 || isActiveDrag) && (
                  <g
                    className={`pointer-events-none transition-opacity duration-75 ${
                      effectiveShowAllDims || isActiveDrag || isSelected || hoveredElevationItem?.id === el.id
                        ? "opacity-100"
                        : elevDetailLevel === "clean"
                        ? "opacity-0 group-hover/el:opacity-100"
                        : "opacity-35 group-hover/el:opacity-100"
                    }`}
                  >
                    <rect
                      x={el.x + el.width / 2 - Math.max(isActiveDrag ? 110 : 0, Math.min(195, el.width * 0.48))}
                      y={isShelf ? el.y - 54 : el.y + Math.round(el.height * 0.76) - 21}
                      width={Math.max(isActiveDrag ? 220 : 0, Math.min(390, el.width * 0.96))}
                      height={42}
                      rx={10}
                      fill={
                        isActiveDrag
                          ? "#EA580C"
                          : isSelected
                          ? "#1D4ED8"
                          : isShelf && el.label.includes("Sabit")
                          ? "#6B4F28"
                          : "#0F172A"
                      }
                      opacity={0.94}
                    />
                    <text
                      x={el.x + el.width / 2}
                      y={isShelf ? el.y - 26 : el.y + Math.round(el.height * 0.76) + 7}
                      textAnchor="middle"
                      fill="#FFFFFF"
                      fontSize="23"
                      fontWeight="700"
                      fontFamily="Inter, 'Plus Jakarta Sans', system-ui, sans-serif"
                    >
                      {truncateCadLabel(
                        isShelf
                          ? `${el.label.includes("Sabit") ? "Sabit Raf" : "↕ Hareketli Raf"} (Y:${formatElevationValue(elevMm ?? 0, elevDisplayUnit)})`
                          : `↕ Çekmece (H:${formatElevationValue(el.height + 3, elevDisplayUnit, false)} • Y:${formatElevationValue(elevMm ?? 0, elevDisplayUnit)})`,
                        Math.max(isActiveDrag ? 200 : 0, el.width * 0.9),
                        13
                      )}
                    </text>
                  </g>
                )}

                {/* Detailed 2D CAD Technical Drawing for Hinges (Ø35mm Cup + 2xØ8mm Boss Holes + Global/Local Y & Inward Smart Label) */}
                {(mode === "elevation" || mode === "section") && isHinge && (() => {
                  const hcx = el.x + el.width / 2;
                  const hcy = el.y + el.height / 2;
                  const isHettich = el.label.includes("Hettich");
                  const isSalice = el.label.includes("Salice");
                  const halfPitch = isHettich ? 26 : isSalice ? 24 : 22.5;
                  const pxScale = Math.max(1.1, Math.min(2.6, (vb.width || 2200) / 1050));
                  const sameBayObstacleSvgYs: number[] = [];
                  visibleElements.forEach((oEl) => {
                    if (oEl.role === "shelf" && Math.abs((oEl.x + oEl.width / 2) - hcx) < Math.max(420, oEl.width * 0.65)) {
                      sameBayObstacleSvgYs.push(oEl.y + oEl.height / 2);
                    }
                  });
                  const hingeAnn = computeElevationHingeAnnotation({
                    el,
                    activeModule,
                    moduleHeightMm: breakdown.overall.height,
                    sameBayObstacleSvgYs,
                    svgMmPerPx: pxScale,
                  });
                  const isHingeHovered = hoveredElevationItem?.id === el.id;
                  const showCompactLabel = mode === "elevation" && (effectiveShowAllDims || Boolean(isSelected));
                  const useLocalCoord = elevCoordMode === "local" && hingeAnn.doorBaseY > 0;
                  const lblText = elevCoordMode === "local" ? `L:${hingeAnn.doorLocalY}` : `Y:${hingeAnn.globalY}`;
                  const lblFs = Math.round(10 * pxScale);
                  const lblH = Math.round(18 * pxScale);
                  const lblPadX = Math.round(6 * pxScale);
                  const lblW = Math.round(lblText.length * lblFs * 0.64 + lblPadX * 2);
                  const lblOffsetX = Math.round(12 * pxScale);
                  const lblAnchorX = hingeAnn.labelDirection === 1 ? hcx + lblOffsetX : hcx - lblOffsetX;
                  const lblRectX = hingeAnn.labelDirection === 1 ? lblAnchorX : lblAnchorX - lblW;
                  const lblCenterY = hcy + hingeAnn.verticalNudgeSvgY;
                  const mountSideLabel =
                    hingeAnn.mountSide === "left-wall"
                      ? "Sol Yan Panel"
                      : hingeAnn.mountSide === "right-wall"
                      ? "Sağ Yan Panel"
                      : hingeAnn.mountSide === "divider-left"
                      ? "Orta Dikme (Sol Yüz)"
                      : "Orta Dikme (Sağ Yüz)";
                  return (
                    <g
                      data-testid={`cad-hinge-marker-${el.id}`}
                      className="cursor-pointer"
                      onMouseEnter={() => {
                        if (mode !== "elevation") return;
                        setHoveredElevationItem({
                          id: el.id,
                          kind: "hinge",
                          title: `${hingeAnn.brand} Menteşe`,
                          subtitle: `Bölme ${hingeAnn.bayIndex + 1} · ${mountSideLabel}`,
                          datumNote:
                            hingeAnn.doorBaseY > 0
                              ? `Üst kapak referansı: +${hingeAnn.doorBaseY} mm sabit raf üstü`
                              : "Gövde tabanından (Tam Boy Kapak · Baza üstü 0 mm)",
                          globalY: hingeAnn.globalY,
                          doorLocalY: hingeAnn.doorLocalY,
                          doorBaseY: hingeAnn.doorBaseY,
                          svgY: hcy,
                        });
                      }}
                      onMouseLeave={() => {
                        if (mode !== "elevation") return;
                        setHoveredElevationItem((prev) => (prev?.id === el.id ? null : prev));
                      }}
                    >
                      {/* Invisible hover hit area around hinge icon */}
                      <circle cx={hcx} cy={hcy} r={Math.max(28, Math.round(16 * pxScale))} fill="transparent" />
                      {/* Cruciform Mounting Plate Wing & Arm */}
                      <rect
                        x={hcx - 22}
                        y={hcy - 8}
                        width={44}
                        height={16}
                        rx={3}
                        fill={isHingeHovered ? "#FDE68A" : "#BAE6FD"}
                        stroke={isHingeHovered ? "#D97706" : "#0369A1"}
                        strokeWidth="2.5"
                      />
                      {/* Ø35mm Hinge Cup Circle (radius 17.5mm) */}
                      <circle
                        cx={hcx}
                        cy={hcy}
                        r={17.5}
                        fill={isHingeHovered ? "#F59E0B" : "#38BDF8"}
                        stroke="#0F172A"
                        strokeWidth="3"
                      />
                      {/* 2x Ø8mm Dowel/Boss Holes at exact manufacturer pitch (45mm Blum / 52mm Hettich TH52 / 48mm Salice) */}
                      <circle cx={hcx} cy={hcy - halfPitch} r={4} fill="#0F172A" stroke="#FFFFFF" strokeWidth="1.5" />
                      <circle cx={hcx} cy={hcy + halfPitch} r={4} fill="#0F172A" stroke="#FFFFFF" strokeWidth="1.5" />
                      {/* CAD Centerline Crosshair (+) */}
                      <line x1={hcx - 24} y1={hcy} x2={hcx + 24} y2={hcy} stroke="#0F172A" strokeWidth="1.8" strokeDasharray="4 2" />
                      <line x1={hcx} y1={hcy - 30} x2={hcx} y2={hcy + 30} stroke="#0F172A" strokeWidth="1.8" strokeDasharray="4 2" />
                      {showCompactLabel && (
                        <g className="pointer-events-none" data-mount-side={hingeAnn.mountSide}>
                          {/* İnce lider çizgisi (Temiz CAD stili) */}
                          <line
                            x1={hingeAnn.labelDirection === 1 ? hcx + 18 : hcx - 18}
                            y1={hcy}
                            x2={hingeAnn.labelDirection === 1 ? lblRectX : lblRectX + lblW}
                            y2={lblCenterY}
                            stroke={useLocalCoord ? "#F59E0B" : "#38BDF8"}
                            strokeWidth={1.3}
                            strokeOpacity={0.75}
                          />
                          <rect
                            x={lblRectX}
                            y={lblCenterY - lblH / 2}
                            width={lblW}
                            height={lblH}
                            rx={Math.round(4 * pxScale)}
                            fill={isHingeHovered ? "#1E40AF" : "#0F172A"}
                            fillOpacity={0.93}
                            stroke={useLocalCoord ? "#F59E0B" : "#38BDF8"}
                            strokeOpacity={useLocalCoord ? 0.8 : 0.55}
                            strokeWidth={1.2}
                          />
                          <text
                            x={hingeAnn.labelDirection === 1 ? lblRectX + lblPadX : lblRectX + lblW - lblPadX}
                            y={lblCenterY + Math.round(lblFs * 0.36)}
                            textAnchor={hingeAnn.labelAnchor}
                            fill={useLocalCoord ? "#FDE68A" : "#E0F2FE"}
                            fontSize={lblFs}
                            fontWeight="700"
                            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                          >
                            {lblText}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })()}

                {/* Detailed 2D CAD Technical Vector Schematic for World-Brand Interior Accessories */}
                {(mode === "elevation" || mode === "section") && isSpecialFitting && el.width > 100 && (() => {
                  const lbl = el.label;
                  const cx = el.x + el.width / 2;
                  const cy = el.y + el.height / 2;
                  return (
                    <g className="pointer-events-none" data-testid={`cad-fitting-marker-${el.id}`}>
                      {/* 1. Häfele Trouser Rack (Teleskopik Pantolonluk): Left/Right Slide Channels + Spaced Hanger Rods */}
                      {lbl.includes("Pantolonluk") && (() => {
                        const rods = 7;
                        const step = (el.width - 60) / (rods - 1);
                        return (
                          <g>
                            <rect x={el.x + 6} y={el.y + 8} width={16} height={el.height - 16} fill="#047857" />
                            <rect x={el.x + el.width - 22} y={el.y + 8} width={16} height={el.height - 16} fill="#047857" />
                            <line x1={el.x + 22} y1={cy} x2={el.x + el.width - 22} y2={cy} stroke="#065F46" strokeWidth="6" />
                            {Array.from({ length: rods }, (_, idx) => (
                              <circle
                                key={idx}
                                cx={el.x + 30 + idx * step}
                                cy={cy}
                                r={9}
                                fill="#ECFDF5"
                                stroke="#065F46"
                                strokeWidth="3.5"
                              />
                            ))}
                          </g>
                        );
                      })()}

                      {/* 2. Häfele Inclined Shoe Rack (Eğimli Ayakkabılık): 3 Stepped/Inclined Bars + Front Heel Guard */}
                      {lbl.includes("Ayakkabılık") && (
                        <g>
                          <line x1={el.x + 16} y1={el.y + el.height - 18} x2={el.x + el.width - 16} y2={el.y + el.height - 18} stroke="#065F46" strokeWidth="7" />
                          <line x1={el.x + 24} y1={cy} x2={el.x + el.width - 24} y2={cy - 10} stroke="#047857" strokeWidth="5" strokeDasharray="16 8" />
                          <line x1={el.x + 32} y1={el.y + 24} x2={el.x + el.width - 32} y2={el.y + 14} stroke="#047857" strokeWidth="5" />
                        </g>
                      )}

                      {/* 3. Servetto / Häfele Wardrobe Lift (Gardırop Asansörü): Side Dampers + Arms + Hanger Bar + Center Pull Wand */}
                      {lbl.includes("Asansörü") && (
                        <g>
                          {/* Left & Right Side Damper Boxes */}
                          <rect x={el.x + 4} y={el.y + el.height - 150} width={34} height={140} rx={6} fill="#065F46" stroke="#FFFFFF" strokeWidth="2" />
                          <rect x={el.x + el.width - 38} y={el.y + el.height - 150} width={34} height={140} rx={6} fill="#065F46" stroke="#FFFFFF" strokeWidth="2" />
                          {/* Left & Right Articulated Lift Arms */}
                          <line x1={el.x + 20} y1={el.y + el.height - 140} x2={el.x + 35} y2={el.y + 35} stroke="#047857" strokeWidth="10" />
                          <line x1={el.x + el.width - 20} y1={el.y + el.height - 140} x2={el.x + el.width - 35} y2={el.y + 35} stroke="#047857" strokeWidth="10" />
                          {/* Top Horizontal Clothes Rail */}
                          <line x1={el.x + 30} y1={el.y + 35} x2={el.x + el.width - 30} y2={el.y + 35} stroke="#064E3B" strokeWidth="14" />
                          {/* Central Vertical Pull-Down Wand & Handle */}
                          <line x1={cx} y1={el.y + 35} x2={cx} y2={el.y + el.height - 30} stroke="#0F172A" strokeWidth="8" />
                          <rect x={cx - 28} y={el.y + el.height - 38} width={56} height={22} rx={8} fill="#0F172A" />
                        </g>
                      )}

                      {/* 4. Häfele Wire Basket (Frenli Tel Sepet): Wire Mesh Hatching Grid */}
                      {lbl.includes("Tel Sepet") && (() => {
                        const cols = Math.max(5, Math.min(12, Math.floor(el.width / 55)));
                        const stepX = (el.width - 32) / cols;
                        return (
                          <g>
                            {Array.from({ length: cols + 1 }, (_, idx) => (
                              <line
                                key={idx}
                                x1={el.x + 16 + idx * stepX}
                                y1={el.y + 10}
                                x2={el.x + 16 + idx * stepX}
                                y2={el.y + el.height - 10}
                                stroke="#047857"
                                strokeWidth="2.5"
                              />
                            ))}
                            <line x1={el.x + 10} y1={el.y + el.height * 0.35} x2={el.x + el.width - 10} y2={el.y + el.height * 0.35} stroke="#047857" strokeWidth="3" />
                            <line x1={el.x + 10} y1={el.y + el.height * 0.7} x2={el.x + el.width - 10} y2={el.y + el.height * 0.7} stroke="#047857" strokeWidth="3" />
                          </g>
                        );
                      })()}

                      {/* 5. Kesseböhmer LeMans II Corner Mechanism: Pivot Pole + 2 Kidney Trays */}
                      {lbl.includes("LeMans") && (
                        <g>
                          <rect x={el.x + el.width * 0.22} y={el.y + 8} width={22} height={el.height - 16} fill="#064E3B" />
                          <rect x={el.x + 20} y={el.y + el.height * 0.22} width={el.width - 40} height={42} rx={18} fill="#34D399" stroke="#064E3B" strokeWidth="4" />
                          <rect x={el.x + 20} y={el.y + el.height * 0.72} width={el.width - 40} height={42} rx={18} fill="#34D399" stroke="#064E3B" strokeWidth="4" />
                        </g>
                      )}

                      {/* 6. Kesseböhmer Dispensa Tall Pantry Pullout: Center Column + 5 Wire Baskets */}
                      {lbl.includes("Dispensa") && (
                        <g>
                          <rect x={cx - 12} y={el.y + 10} width={24} height={el.height - 20} fill="#064E3B" />
                          {[0.12, 0.3, 0.48, 0.66, 0.84].map((ratio, idx) => (
                            <rect
                              key={idx}
                              x={el.x + 18}
                              y={el.y + el.height * ratio}
                              width={el.width - 36}
                              height={54}
                              rx={6}
                              fill="#6EE7B7"
                              stroke="#064E3B"
                              strokeWidth="3.5"
                            />
                          ))}
                        </g>
                      )}

                      {/* 8. Häfele Loox5 3000K LED Channel / Strip */}
                      {lbl.includes("LED") && (
                        <g>
                          <rect
                            x={el.x + 4}
                            y={el.y + 2}
                            width={Math.max(12, el.width - 8)}
                            height={Math.max(10, el.height - 4)}
                            rx={6}
                            fill="#FDE047"
                            stroke="#CA8A04"
                            strokeWidth="3.5"
                          />
                        </g>
                      )}

                      {/* 9. Countertop Sink / Cooktop CNC Cut-out & Ventilation Grille */}
                      {(lbl.includes("Cut-out") || lbl.includes("Menfezi")) && (
                        <g>
                          <rect
                            x={el.x + 8}
                            y={el.y + 4}
                            width={Math.max(20, el.width - 16)}
                            height={Math.max(12, el.height - 8)}
                            rx={6}
                            fill="none"
                            stroke="#DC2626"
                            strokeWidth="4"
                            strokeDasharray="12 6"
                          />
                        </g>
                      )}

                      {/* 7. Häfele Dual Waste Bin (30L + 15L) */}
                      {lbl.includes("Çöp") && (
                        <g>
                          <rect
                            x={el.x + 18}
                            y={el.y + 28}
                            width={Math.max(40, el.width * 0.54 - 24)}
                            height={Math.max(60, el.height - 40)}
                            rx={8}
                            fill="#334155"
                            stroke="#0F172A"
                            strokeWidth="4"
                          />
                          <rect
                            x={el.x + el.width * 0.56}
                            y={el.y + 28}
                            width={Math.max(36, el.width * 0.44 - 24)}
                            height={Math.max(60, el.height - 40)}
                            rx={8}
                            fill="#475569"
                            stroke="#0F172A"
                            strokeWidth="4"
                          />
                          <line x1={el.x + 10} y1={el.y + 18} x2={el.x + el.width - 10} y2={el.y + 18} stroke="#064E3B" strokeWidth="6" />
                        </g>
                      )}

                      {/* Brand & SKU Engineering Callout Pill */}
                      {mode === "elevation" && elVis.showHardwareLabel && (
                        <>
                          <rect
                            x={cx - Math.min(220, el.width * 0.48)}
                            y={cy - 20}
                            width={Math.min(440, el.width * 0.96)}
                            height={40}
                            rx={8}
                            fill="#064E3B"
                            opacity={0.94}
                          />
                          <text
                            x={cx}
                            y={cy + 6}
                            textAnchor="middle"
                            fill="#ECFDF5"
                            fontSize="19"
                            fontWeight="800"
                            fontFamily="Inter, 'Plus Jakarta Sans', system-ui, sans-serif"
                          >
                            {truncateCadLabel(`🛠️ ${lbl}`, el.width * 0.9, 12)}
                          </text>
                        </>
                      )}
                    </g>
                  );
                })()}

                {/* Drag Handle Badge on Intermediate Dividers (Full-Height or Partial Shelf-Between Sub-Divider) */}
                {mode === "elevation" && elVis.showDividerBadge && (isDivider || isSubDivider) && (
                  <g className="pointer-events-none">
                    <rect
                      x={el.x + el.width / 2 - (isSubDivider ? 98 : 85)}
                      y={el.y + el.height / 2 - 24}
                      width={isSubDivider ? 196 : 170}
                      height={48}
                      rx={12}
                      fill={isSubDivider ? "#9A3412" : "#B86B2B"}
                      stroke="#FFFFFF"
                      strokeWidth="3"
                    />
                    <text
                      x={el.x + el.width / 2}
                      y={el.y + el.height / 2 + 8}
                      textAnchor="middle"
                      fill="#FFFFFF"
                      fontSize="22"
                      fontWeight="800"
                      fontFamily="Inter, 'Plus Jakarta Sans', system-ui, sans-serif"
                    >
                      {isSubDivider
                        ? `✥ Raf Dikme (${formatElevationValue(dragMeta?.startVal ?? 0, elevDisplayUnit)})`
                        : "↔ Ana Dikme"}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Render Draggable Hanging Rails in 2D Elevation */}
          {railComponents.map((rail) => {
            const svgY = breakdown.overall.height - (rail.position.y + rail.dimensions.height);
            const bIdx = rail.bayIndex ?? 0;
            const bay = activeModule.bays[bIdx];
            const railCfg = bay?.hangingRails.find((r) => r.id === rail.id);
            const elevY = railCfg?.elevationY ?? 1700;
            const isRailSelected = selectedComponentId === rail.id;
            const isRailDragging = interiorDrag?.kind === "rail" && interiorDrag.targetId === rail.id;
            const railVis = resolveElevationLabelVisibility(elevDetailLevel, {
              isActiveModule: true,
              isSelected: isRailSelected,
              isHovered: false,
              isDragging: isRailDragging,
              hasInteriorSelection: Boolean(selectedComponentId),
            });

            return (
              <g
                key={rail.id}
                data-testid={`cad-el-${rail.id}`}
                data-interior-owner={rail.id}
                onMouseEnter={() => {
                  if (mode !== "elevation") return;
                  setHoveredElevationItem({
                    id: rail.id,
                    kind: "rail",
                    title: "Askı Borusu",
                    globalY: elevY,
                    svgY: svgY + rail.dimensions.height / 2,
                  });
                }}
                onMouseLeave={() => {
                  if (mode !== "elevation") return;
                  setHoveredElevationItem((prev) => (prev?.id === rail.id ? null : prev));
                }}
                onContextMenu={(e) =>
                  openElevationContextMenu(e, {
                    kind: "rail",
                    bayIdx: bIdx,
                    railId: rail.id,
                  })
                }
                onPointerDown={(e) => {
                  e.stopPropagation();
                  const svgEl = (e.currentTarget as Element).closest("svg") as SVGSVGElement | null;
                  const scale = svgEl ? getElevScaleMmPerPx(svgEl) : { x: 4, y: 4 };
                  document.body.dataset.birimUiDragging = "1";
                  elevInteriorLiveRef.current = null;
                  beginHistoryTransaction();
                  setSelectedComponentId(rail.id);
                  setActiveBayIndex(bIdx);
                  setInteriorDrag({
                    kind: "rail",
                    bayIdx: bIdx,
                    targetId: rail.id,
                    startClientX: e.clientX,
                    startClientY: e.clientY,
                    startValueMm: elevY,
                    mmPerPxX: scale.x,
                    mmPerPxY: scale.y,
                  });
                }}
                className="group/el cursor-ns-resize"
              >
                {(() => {
                  const rx0 = rail.position.x;
                  const rw = Math.max(24, rail.dimensions.width);
                  const rodH = 26;
                  const rodY = svgY;
                  const plateW = Math.min(7, rw * 0.04);
                  const socketW = Math.min(15, rw * 0.07);
                  const rodX = rx0 + plateW + socketW - 2;
                  const rodW = Math.max(10, rw - 2 * (plateW + socketW - 2));
                  const hasCenterSupport = rw >= 850;
                  const railFill = isRailDragging
                    ? "url(#v3_chrome_rail_drag_grad)"
                    : isRailSelected
                      ? "url(#v3_chrome_rail_selected_grad)"
                      : "url(#v3_chrome_rail_grad)";
                  const railStroke = isRailDragging
                    ? "#C2410C"
                    : isRailSelected
                      ? "#1D4ED8"
                      : "#334155";
                  const flangeStroke = isRailDragging
                    ? "#9A3412"
                    : isRailSelected
                      ? "#1E40AF"
                      : "#334155";
                  const badgeW = Math.min(288, rw * 0.9);
                  const badgeCenterX = hasCenterSupport ? rx0 + rw * 0.28 : rx0 + rw / 2;
                  const clampedBadgeX = Math.max(
                    rx0 + 8,
                    Math.min(rx0 + rw - badgeW - 8, badgeCenterX - badgeW / 2)
                  );
                  return (
                    <>
                      {/* Generous invisible hit area for effortless vertical drag */}
                      <rect
                        x={rx0}
                        y={rodY - 26}
                        width={rw}
                        height={76}
                        fill="transparent"
                      />
                      {/* Subtle underside ambient shadow */}
                      <rect
                        x={rodX + 2}
                        y={rodY + 5}
                        width={rodW - 4}
                        height={rodH}
                        rx={rodH / 2}
                        fill="#0F172A"
                        opacity={0.18}
                        pointerEvents="none"
                      />
                      {/* Center vertical chrome support bracket for wide wardrobe spans (>= 850 mm) */}
                      {hasCenterSupport && (
                        <g pointerEvents="none">
                          <rect
                            x={rx0 + rw / 2 - 14}
                            y={rodY - 46}
                            width={28}
                            height={6}
                            rx={2}
                            fill="url(#v3_chrome_flange_grad)"
                            stroke={flangeStroke}
                            strokeWidth="1.6"
                          />
                          <rect
                            x={rx0 + rw / 2 - 4}
                            y={rodY - 40}
                            width={8}
                            height={40}
                            fill="url(#v3_chrome_flange_grad)"
                            stroke={flangeStroke}
                            strokeWidth="1.6"
                          />
                        </g>
                      )}
                      {/* Main cylindrical oval chrome wardrobe hanging rod */}
                      <rect
                        x={rodX}
                        y={rodY}
                        width={rodW}
                        height={rodH}
                        rx={rodH / 2}
                        fill={railFill}
                        stroke={railStroke}
                        strokeWidth={isRailSelected || isRailDragging ? "3.2" : "2.2"}
                      />
                      {/* Crisp upper specular chrome highlight */}
                      <line
                        x1={rodX + 10}
                        y1={rodY + 6.5}
                        x2={rodX + rodW - 10}
                        y2={rodY + 6.5}
                        stroke="#FFFFFF"
                        strokeOpacity={0.82}
                        strokeWidth="2.6"
                        strokeLinecap="round"
                        pointerEvents="none"
                      />
                      {/* Subtle underside metallic reflection line */}
                      <line
                        x1={rodX + 10}
                        y1={rodY + rodH - 5.5}
                        x2={rodX + rodW - 10}
                        y2={rodY + rodH - 5.5}
                        stroke="#0F172A"
                        strokeOpacity={0.28}
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        pointerEvents="none"
                      />
                      {/* Center support ring collar gripping the rod */}
                      {hasCenterSupport && (
                        <rect
                          x={rx0 + rw / 2 - 9}
                          y={rodY - 3}
                          width={18}
                          height={rodH + 6}
                          rx={4}
                          fill="url(#v3_chrome_flange_grad)"
                          stroke={flangeStroke}
                          strokeWidth="1.8"
                          pointerEvents="none"
                        />
                      )}
                      {/* Left wall-mount flange bracket (flanş taşıyıcı + vidalar) */}
                      <g pointerEvents="none">
                        <rect
                          x={rx0}
                          y={rodY - 12}
                          width={plateW}
                          height={rodH + 24}
                          rx={2}
                          fill="url(#v3_chrome_flange_grad)"
                          stroke={flangeStroke}
                          strokeWidth="1.8"
                        />
                        <circle cx={rx0 + plateW / 2} cy={rodY - 6} r={1.9} fill="#1E293B" />
                        <circle cx={rx0 + plateW / 2} cy={rodY + rodH + 6} r={1.9} fill="#1E293B" />
                        <rect
                          x={rx0 + plateW - 1}
                          y={rodY - 3.5}
                          width={socketW}
                          height={rodH + 7}
                          rx={3.5}
                          fill="url(#v3_chrome_flange_grad)"
                          stroke={flangeStroke}
                          strokeWidth="1.8"
                        />
                      </g>
                      {/* Right wall-mount flange bracket (flanş taşıyıcı + vidalar) */}
                      <g pointerEvents="none">
                        <rect
                          x={rx0 + rw - plateW}
                          y={rodY - 12}
                          width={plateW}
                          height={rodH + 24}
                          rx={2}
                          fill="url(#v3_chrome_flange_grad)"
                          stroke={flangeStroke}
                          strokeWidth="1.8"
                        />
                        <circle cx={rx0 + rw - plateW / 2} cy={rodY - 6} r={1.9} fill="#1E293B" />
                        <circle cx={rx0 + rw - plateW / 2} cy={rodY + rodH + 6} r={1.9} fill="#1E293B" />
                        <rect
                          x={rx0 + rw - plateW - socketW + 1}
                          y={rodY - 3.5}
                          width={socketW}
                          height={rodH + 7}
                          rx={3.5}
                          fill="url(#v3_chrome_flange_grad)"
                          stroke={flangeStroke}
                          strokeWidth="1.8"
                        />
                      </g>
                      {/* Clean non-overlapping elevation badge */}
                      {rw > 140 && (
                        <g
                          className={`pointer-events-none transition-opacity duration-75 ${
                            effectiveShowAllDims || isRailDragging || isRailSelected || hoveredElevationItem?.id === rail.id
                              ? "opacity-100"
                              : elevDetailLevel === "clean"
                              ? "opacity-0 group-hover/el:opacity-100"
                              : "opacity-35 group-hover/el:opacity-100"
                          }`}
                        >
                          <rect
                            x={clampedBadgeX}
                            y={rodY + rodH + 10}
                            width={badgeW}
                            height={40}
                            rx={10}
                            fill={isRailDragging ? "#EA580C" : isRailSelected ? "#1D4ED8" : "#0F172A"}
                            opacity={0.94}
                          />
                          <text
                            x={clampedBadgeX + badgeW / 2}
                            y={rodY + rodH + 37}
                            textAnchor="middle"
                            fill="#FFFFFF"
                            fontSize="22"
                            fontWeight="700"
                            fontFamily="Inter, 'Plus Jakarta Sans', system-ui, sans-serif"
                            pointerEvents="none"
                          >
                            {truncateCadLabel(
                              `↕ Askı (Y:${formatElevationValue(elevY, elevDisplayUnit)})`,
                              badgeW - 18,
                              13
                            )}
                          </text>
                        </g>
                      )}
                    </>
                  );
                })()}
              </g>
            );
          })}

          {/* 1+3 Hibrit Hover Lazer Kot Çizgisi ve Buzlu Cam HUD Kartı */}
          {mode === "elevation" && hoveredElevationItem && (() => {
            const pxScaleHud = Math.max(1.1, Math.min(2.6, (vb.width || 2200) / 1050));
            const hudText = formatHoveredElevationHud(hoveredElevationItem);
            const hudW = Math.max(210, Math.round(hudText.length * 8.2 + 34)) * pxScaleHud;
            const hudH = Math.round(30 * pxScaleHud);
            const hudX = breakdown.overall.width / 2 - hudW / 2;
            const hudY = hoveredElevationItem.svgY - hudH - Math.round(8 * pxScaleHud);
            return (
              <g className="pointer-events-none" data-testid="elev-hover-laser-hud">
                <line
                  x1={-16}
                  y1={hoveredElevationItem.svgY}
                  x2={breakdown.overall.width + 16}
                  y2={hoveredElevationItem.svgY}
                  stroke="#38BDF8"
                  strokeWidth={Math.max(1.5, 1.4 * pxScaleHud)}
                  strokeDasharray="4 3"
                  className="pointer-events-none"
                />
                {/* Sol Global Y Rozeti */}
                <rect
                  x={-16 - Math.round(68 * pxScaleHud)}
                  y={hoveredElevationItem.svgY - Math.round(10 * pxScaleHud)}
                  width={Math.round(66 * pxScaleHud)}
                  height={Math.round(20 * pxScaleHud)}
                  rx={Math.round(4 * pxScaleHud)}
                  fill="#083344"
                  stroke="#38BDF8"
                  strokeWidth={1.2}
                />
                <text
                  x={-16 - Math.round(35 * pxScaleHud)}
                  y={hoveredElevationItem.svgY + Math.round(3.5 * pxScaleHud)}
                  textAnchor="middle"
                  fill="#67E8F9"
                  fontSize={Math.round(9.5 * pxScaleHud)}
                  fontWeight="700"
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                >
                  {`G-Y:${Math.round(hoveredElevationItem.globalY)}`}
                </text>
                {/* Sağ Kapak İçi Lokal Y Rozeti (sadece kısmi kapaklarda) */}
                {hoveredElevationItem.doorBaseY && hoveredElevationItem.doorBaseY > 0 && typeof hoveredElevationItem.doorLocalY === "number" ? (
                  <>
                    <rect
                      x={breakdown.overall.width + 18}
                      y={hoveredElevationItem.svgY - Math.round(10 * pxScaleHud)}
                      width={Math.round(66 * pxScaleHud)}
                      height={Math.round(20 * pxScaleHud)}
                      rx={Math.round(4 * pxScaleHud)}
                      fill="#451A03"
                      stroke="#F59E0B"
                      strokeWidth={1.2}
                    />
                    <text
                      x={breakdown.overall.width + 18 + Math.round(33 * pxScaleHud)}
                      y={hoveredElevationItem.svgY + Math.round(3.5 * pxScaleHud)}
                      textAnchor="middle"
                      fill="#FDE68A"
                      fontSize={Math.round(9.5 * pxScaleHud)}
                      fontWeight="700"
                      fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                    >
                      {`L-Y:${Math.round(hoveredElevationItem.doorLocalY)}`}
                    </text>
                  </>
                ) : (
                  <circle cx={breakdown.overall.width + 16} cy={hoveredElevationItem.svgY} r={Math.round(3.5 * pxScaleHud)} fill="#38BDF8" />
                )}
                <foreignObject
                  x={hudX}
                  y={hudY}
                  width={hudW}
                  height={hudH + 8}
                  className="pointer-events-none overflow-visible"
                >
                  <div className="w-full h-full flex items-center justify-center">
                    <div
                      style={{ fontSize: `${Math.round(11.5 * pxScaleHud)}px`, padding: `${Math.round(3 * pxScaleHud)}px ${Math.round(10 * pxScaleHud)}px` }}
                      className="rounded-lg bg-slate-900/80 backdrop-blur-md border border-sky-400/30 text-sky-100 font-semibold font-mono whitespace-nowrap shadow-lg"
                    >
                      {hudText}
                    </div>
                  </div>
                </foreignObject>
              </g>
            );
          })()}

          {/* System 32 Multi-Hole Dots rendered above shelves so shelf fills never hide them */}
          {mode === "elevation" &&
            activeModule &&
            elevDetailLevel !== "clean" &&
            visibleElements
              .filter(
                (el) =>
                  el.role === "carcass_side_left" ||
                  el.role === "carcass_side_right" ||
                  el.role === "carcass_divider"
              )
              .map((el) => (
                <ElevationMultiHoleAndGrainSvg
                  key={`mh_top_${el.id}`}
                  el={el}
                  activeModule={activeModule}
                  draggedShelfId={interiorDrag?.kind === "shelf" ? interiorDrag.targetId : undefined}
                />
              ))}

          {/* Cross-Module & Cross-Bay Elevation Snap Alignment Line in 2D Front View */}
          {mode === "elevation" &&
            activeElevSnap &&
            (() => {
              const snapWorldFromModuleBottom =
                activeModule.carcass.plinthHeight +
                activeModule.carcass.panelThickness +
                activeElevSnap.elevationY;
              const snapSvgY = breakdown.overall.height - snapWorldFromModuleBottom;
              const hasElevInLabel = activeElevSnap.label.includes(`${activeElevSnap.elevationY}`);
              const badgeText = hasElevInLabel
                ? `🎯 Hizalandı: ${activeElevSnap.label}`
                : `🎯 Hizalandı: ${activeElevSnap.label} (${activeElevSnap.elevationY}mm)`;
              const badgeW = Math.max(420, badgeText.length * 16 + 44);
              const placeBadgeBelow = interiorDrag?.kind === "shelf";
              return (
                <g data-testid="cad-elevation-snap-guide" className="pointer-events-none">
                  <line
                    x1={-120}
                    y1={snapSvgY}
                    x2={breakdown.overall.width + 120}
                    y2={snapSvgY}
                    stroke="#0284C7"
                    strokeWidth="6"
                    strokeDasharray="18 10"
                  />
                  <rect
                    x={breakdown.overall.width / 2 - badgeW / 2}
                    y={placeBadgeBelow ? snapSvgY + 14 : snapSvgY - 58}
                    width={badgeW}
                    height={46}
                    rx={12}
                    fill="#0369A1"
                    stroke="#FFFFFF"
                    strokeWidth="3"
                  />
                  <text
                    x={breakdown.overall.width / 2}
                    y={placeBadgeBelow ? snapSvgY + 45 : snapSvgY - 27}
                    textAnchor="middle"
                    fill="#FFFFFF"
                    fontSize="24"
                    fontWeight="800"
                    fontFamily="Inter, 'Plus Jakarta Sans', system-ui, sans-serif"
                  >
                    {badgeText}
                  </text>
                </g>
              );
            })()}

          {/* High-Contrast, Large Architectural Dimension Callouts with Pill Backgrounds */}
          {(hasSceneModules && (mode !== "elevation" || elevDetailLevel !== "clean") ? data.dimensionLines : []).map((dim) => {
            const isH = dim.orientation === "horizontal";
            const midX = (dim.x1 + dim.x2) / 2;
            const midY = (dim.y1 + dim.y2) / 2;
            const dimText =
              typeof dim.value === "number" && dim.value > 0
                ? formatElevationValue(dim.value, elevDisplayUnit)
                : dim.label;
            const pillW = Math.max(200, dimText.length * 24 + 40);
            const pillH = 54;

            return (
              <g key={dim.id} className="pointer-events-none">
                <line
                  x1={dim.x1}
                  y1={dim.y1}
                  x2={dim.x2}
                  y2={dim.y2}
                  stroke="#9A3412"
                  strokeWidth="4"
                />
                {isH ? (
                  <>
                    <line
                      x1={dim.x1}
                      y1={dim.y1 - 18}
                      x2={dim.x1}
                      y2={dim.y1 + 18}
                      stroke="#9A3412"
                      strokeWidth="4"
                    />
                    <line
                      x1={dim.x2}
                      y1={dim.y2 - 18}
                      x2={dim.x2}
                      y2={dim.y2 + 18}
                      stroke="#9A3412"
                      strokeWidth="4"
                    />
                    <rect
                      x={midX - pillW / 2}
                      y={dim.offset < 0 ? dim.y1 - pillH - 14 : dim.y1 + 14}
                      width={pillW}
                      height={pillH}
                      rx={12}
                      fill="#FFFFFF"
                      stroke="#B86B2B"
                      strokeWidth="3"
                    />
                    <text
                      x={midX}
                      y={dim.offset < 0 ? dim.y1 - 26 : dim.y1 + 52}
                      textAnchor="middle"
                      fill="#7C2D12"
                      fontSize="36"
                      fontWeight="800"
                      fontFamily="Inter, 'Plus Jakarta Sans', system-ui, sans-serif"
                    >
                      {dimText}
                    </text>
                  </>
                ) : (
                  <>
                    <line
                      x1={dim.x1 - 18}
                      y1={dim.y1}
                      x2={dim.x1 + 18}
                      y2={dim.y1}
                      stroke="#9A3412"
                      strokeWidth="4"
                    />
                    <line
                      x1={dim.x2 - 18}
                      y1={dim.y2}
                      x2={dim.x2 + 18}
                      y2={dim.y2}
                      stroke="#9A3412"
                      strokeWidth="4"
                    />
                    <g transform={`translate(${dim.x1 - 55}, ${midY}) rotate(-90)`}>
                      <rect
                        x={-pillW / 2}
                        y={-pillH / 2}
                        width={pillW}
                        height={pillH}
                        rx={12}
                        fill="#FFFFFF"
                        stroke="#B86B2B"
                        strokeWidth="3"
                      />
                      <text
                        x={0}
                        y={12}
                        textAnchor="middle"
                        fill="#7C2D12"
                        fontSize="36"
                        fontWeight="800"
                        fontFamily="Inter, 'Plus Jakarta Sans', system-ui, sans-serif"
                      >
                        {dimText}
                      </text>
                    </g>
                  </>
                )}
              </g>
            );
          })}

          {/* V74: 4-EDGE PARAMETRIC RESIZE HANDLES IN 2D ELEVATION — ALWAYS ACTIVE ON SELECTED MODULE! */}
          {hasSceneModules &&
            mode === "elevation" && (
            <g data-testid="elev-parametric-4edge-resize-handles">
              <rect
                x={-10}
                y={-10}
                width={breakdown.overall.width + 20}
                height={breakdown.overall.height + 20}
                rx={10}
                fill="none"
                stroke="#D97706"
                strokeWidth="5"
                strokeDasharray="16 8"
                className="pointer-events-none"
              />
              {/* 1. Top Edge Parametric Height Resize Handle (▲ Üstten Boy Uzat/Kısalt) */}
              <g
                data-testid="elev-mod-resize-height-handle"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  const svgEl = (e.currentTarget as Element).closest("svg") as SVGSVGElement | null;
                  const scale = svgEl ? getElevScaleMmPerPx(svgEl) : { x: 4, y: 4 };
                  beginHistoryTransaction();
                  setElevResizingMod({
                    modIdx: activeModuleIndex,
                    axis: "height_top",
                    startClientX: e.clientX,
                    startClientY: e.clientY,
                    startW: activeModule.dimensions.width,
                    startH: activeModule.dimensions.height,
                    startX: activeModule.position.x,
                    startY: activeModule.position.y,
                    mmPerPxX: scale.x,
                    mmPerPxY: scale.y,
                  });
                }}
                className="cursor-ns-resize"
              >
                {/* Full top-edge invisible grab zone so dragging anywhere along the top edge resizes height */}
                <rect
                  x={24}
                  y={-28}
                  width={Math.max(80, breakdown.overall.width - 48)}
                  height={56}
                  fill="transparent"
                />
                {(() => {
                  const pxS = Math.max(1.1, Math.min(2.6, (vb.width || 2200) / 1050));
                  const hw = Math.round(28 * pxS);
                  const hh = Math.round(14 * pxS);
                  const showTip = hoveredHeightHandle === "top" || elevResizingMod?.axis === "height_top";
                  const tipW = Math.round(78 * pxS);
                  const tipH = Math.round(20 * pxS);
                  return (
                    <g
                      onMouseEnter={() => setHoveredHeightHandle("top")}
                      onMouseLeave={() => setHoveredHeightHandle((prev) => (prev === "top" ? null : prev))}
                    >
                      <rect
                        x={breakdown.overall.width / 2 - hw / 2}
                        y={-hh / 2}
                        width={hw}
                        height={hh}
                        rx={Math.round(4 * pxS)}
                        fill="#0F172A"
                        fillOpacity="0.92"
                        stroke="#38BDF8"
                        strokeWidth={1.6}
                      />
                      <text
                        x={breakdown.overall.width / 2}
                        y={Math.round(3.5 * pxS)}
                        textAnchor="middle"
                        fill="#E0F2FE"
                        fontSize={Math.round(9.5 * pxS)}
                        fontWeight="800"
                      >
                        ▲
                      </text>
                      {showTip && (
                        <g className="pointer-events-none">
                          <rect
                            x={breakdown.overall.width / 2 - tipW / 2}
                            y={-hh / 2 - tipH - Math.round(4 * pxS)}
                            width={tipW}
                            height={tipH}
                            rx={Math.round(5 * pxS)}
                            fill="#0F172A"
                            fillOpacity="0.94"
                            stroke="#38BDF8"
                            strokeWidth={1.2}
                          />
                          <text
                            x={breakdown.overall.width / 2}
                            y={-hh / 2 - tipH / 2 - Math.round(0.5 * pxS)}
                            textAnchor="middle"
                            fill="#E0F2FE"
                            fontSize={Math.round(10.5 * pxS)}
                            fontWeight="700"
                            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                          >
                            {formatElevationValue(activeModule.dimensions.height, elevDisplayUnit)}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })()}
              </g>

              {/* 2. Bottom Edge Parametric Height/Elevation Resize Handle (▼ Alttan Boy/Kot Değiştir) */}
              <g
                data-testid="elev-mod-resize-bottom-handle"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  const svgEl = (e.currentTarget as Element).closest("svg") as SVGSVGElement | null;
                  const scale = svgEl ? getElevScaleMmPerPx(svgEl) : { x: 4, y: 4 };
                  beginHistoryTransaction();
                  setElevResizingMod({
                    modIdx: activeModuleIndex,
                    axis: "height_bottom",
                    startClientX: e.clientX,
                    startClientY: e.clientY,
                    startW: activeModule.dimensions.width,
                    startH: activeModule.dimensions.height,
                    startX: activeModule.position.x,
                    startY: activeModule.position.y,
                    mmPerPxX: scale.x,
                    mmPerPxY: scale.y,
                  });
                }}
                className="cursor-ns-resize"
              >
                {/* Full bottom-edge invisible grab zone so dragging anywhere along the bottom edge resizes */}
                <rect
                  x={24}
                  y={breakdown.overall.height - 28}
                  width={Math.max(80, breakdown.overall.width - 48)}
                  height={56}
                  fill="transparent"
                />
                {(() => {
                  const pxS = Math.max(1.1, Math.min(2.6, (vb.width || 2200) / 1050));
                  const hw = Math.round(28 * pxS);
                  const hh = Math.round(14 * pxS);
                  const showTip = hoveredHeightHandle === "bottom" || elevResizingMod?.axis === "height_bottom";
                  const tipW = Math.round(78 * pxS);
                  const tipH = Math.round(20 * pxS);
                  return (
                    <g
                      onMouseEnter={() => setHoveredHeightHandle("bottom")}
                      onMouseLeave={() => setHoveredHeightHandle((prev) => (prev === "bottom" ? null : prev))}
                    >
                      <rect
                        x={breakdown.overall.width / 2 - hw / 2}
                        y={breakdown.overall.height - hh / 2}
                        width={hw}
                        height={hh}
                        rx={Math.round(4 * pxS)}
                        fill="#0F172A"
                        fillOpacity="0.92"
                        stroke="#38BDF8"
                        strokeWidth={1.6}
                      />
                      <text
                        x={breakdown.overall.width / 2}
                        y={breakdown.overall.height + Math.round(3.5 * pxS)}
                        textAnchor="middle"
                        fill="#E0F2FE"
                        fontSize={Math.round(9.5 * pxS)}
                        fontWeight="800"
                      >
                        ▼
                      </text>
                      {showTip && (
                        <g className="pointer-events-none">
                          <rect
                            x={breakdown.overall.width / 2 - tipW / 2}
                            y={breakdown.overall.height + hh / 2 + Math.round(4 * pxS)}
                            width={tipW}
                            height={tipH}
                            rx={Math.round(5 * pxS)}
                            fill="#0F172A"
                            fillOpacity="0.94"
                            stroke="#38BDF8"
                            strokeWidth={1.2}
                          />
                          <text
                            x={breakdown.overall.width / 2}
                            y={breakdown.overall.height + hh / 2 + tipH / 2 + Math.round(7.5 * pxS)}
                            textAnchor="middle"
                            fill="#E0F2FE"
                            fontSize={Math.round(10.5 * pxS)}
                            fontWeight="700"
                            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                          >
                            {formatElevationValue(activeModule.dimensions.height, elevDisplayUnit)}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })()}
              </g>

              {/* 3. Left Edge Parametric Width Resize Handle (◀ Soldan Genişlet/Daralt) */}
              <g
                data-testid="elev-mod-resize-left-handle"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  const svgEl = (e.currentTarget as Element).closest("svg") as SVGSVGElement | null;
                  const scale = svgEl ? getElevScaleMmPerPx(svgEl) : { x: 4, y: 4 };
                  beginHistoryTransaction();
                  setElevResizingMod({
                    modIdx: activeModuleIndex,
                    axis: "width_left",
                    startClientX: e.clientX,
                    startClientY: e.clientY,
                    startW: activeModule.dimensions.width,
                    startH: activeModule.dimensions.height,
                    startX: activeModule.position.x,
                    startY: activeModule.position.y,
                    mmPerPxX: scale.x,
                    mmPerPxY: scale.y,
                  });
                }}
                className="cursor-ew-resize"
              >
                <rect x={-28} y={24} width={56} height={Math.max(80, breakdown.overall.height - 48)} fill="transparent" />
                <rect
                  x={-26}
                  y={breakdown.overall.height / 2 - 42}
                  width={38}
                  height={84}
                  rx={10}
                  fill="#059669"
                  stroke="#FFFFFF"
                  strokeWidth="3.5"
                />
                <text
                  x={-7}
                  y={breakdown.overall.height / 2 + 8}
                  textAnchor="middle"
                  fill="#FFFFFF"
                  fontSize="24"
                  fontWeight="900"
                >
                  ◀
                </text>
              </g>

              {/* 4. Right Edge Parametric Width Resize Handle (▶ Sağdan Genişlet/Daralt) */}
              <g
                data-testid="elev-mod-resize-width-handle"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  const svgEl = (e.currentTarget as Element).closest("svg") as SVGSVGElement | null;
                  const scale = svgEl ? getElevScaleMmPerPx(svgEl) : { x: 4, y: 4 };
                  beginHistoryTransaction();
                  setElevResizingMod({
                    modIdx: activeModuleIndex,
                    axis: "width_right",
                    startClientX: e.clientX,
                    startClientY: e.clientY,
                    startW: activeModule.dimensions.width,
                    startH: activeModule.dimensions.height,
                    startX: activeModule.position.x,
                    startY: activeModule.position.y,
                    mmPerPxX: scale.x,
                    mmPerPxY: scale.y,
                  });
                }}
                className="cursor-ew-resize"
              >
                <rect
                  x={breakdown.overall.width - 12}
                  y={breakdown.overall.height / 2 - 42}
                  width={38}
                  height={84}
                  rx={10}
                  fill="#059669"
                  stroke="#FFFFFF"
                  strokeWidth="3.5"
                />
                <text
                  x={breakdown.overall.width + 7}
                  y={breakdown.overall.height / 2 + 8}
                  textAnchor="middle"
                  fill="#FFFFFF"
                  fontSize="24"
                  fontWeight="900"
                >
                  ▶
                </text>
              </g>
            </g>
          )}
          </g>
  );
};
