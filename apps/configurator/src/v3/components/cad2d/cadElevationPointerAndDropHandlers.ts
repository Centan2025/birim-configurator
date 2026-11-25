"use client";


import React from "react";
import { calculateNetInnerHeight, calculateBayWidths } from "@birim/core";
import { formatElevationValue } from "../workspace/elevation2dHelpers";
import { computeResizeWidthSnap } from "../../engine/cabinetResizeAndStackEngine";
import { type CadContextMenuState } from "../workspace/CadContextMenu2D";
import { getActiveDraggedTemplateId, setActiveDraggedTemplateId, computeRowSnapPreview, getBayShelfIntervalsForSubDivider } from "../../adapter/useV3Adapter";
import { computeElevationSnapTargets, resolveElevationSnap, snapShelfToMultiHoleOrElevationTargets, findDraggableInteriorComponent } from "../../engine/elevationSnapEngine";
import { useConfiguratorStore } from "../../../store/useConfiguratorStore";

import type { CreateCadElevationPointerAndDropHandlersCtx } from "./cad2dTypes";

export function createCadElevationPointerAndDropHandlers(ctx: CreateCadElevationPointerAndDropHandlersCtx) {
  const { activeBayIndex, activeHaloGroupRef, activeModGroupRef, activeModOffX, activeModule, activeModuleIndex, addDrawer, addFixedShelf, addHangingRail, addInteriorItemAtElevation, addInternalDrawer, addShelf, addStackedTopModule, applyMaterialToSimilarComponents, breakdown, commitHistoryTransaction, dropV4TemplateWithSnap, duplicateActiveModule, elevDisplayUnit, elevDragPreviewRef, elevDraggingMod, elevDraggingObs, elevDraggingSceneObj, elevInteriorLiveRef, elevResizingMod, elevSnapBannerDomRef, equalizeBaysAndShelves, finishModuleDragWithSmartSwap, floorSvgY, getElevScaleMmPerPx, handleChangeElevDisplayUnit, hasSceneModules, interiorDrag, interiorSnapTargetsRef, lastAccessoryDropTarget2DRef, lastDividerCommitValRef, lastInteriorCommitRef, lastModElevCommitRef, lastPointerMoveTsRef, magnetEnabled, mode, planRowSnapBanner, project, removeActiveModule, removeSelectedInteriorComponent, resizeModuleParametric, roomModH, roomOffX, roomOffY, sectionDirection2D, setActiveBayIndex, setActiveElevSnap, setBayCustomWidth, setCadContextMenu, setDragGhostPreview, setDrawerPlacement, setElevDraggingMod, setElevDraggingObs, setElevDraggingSceneObj, setElevPanMode, setElevResizingMod, setHangingRailElevation, setInteriorDrag, setModulePosition, setPanPx, setPlanRowSnapBanner, setSectionCutRatio2D, setSectionDirection2D, setSelectedComponentId, setShelfElevation, setShelfMountType, setShelfThickness, setShowDoorsIn2D, setShowRoomContextInElev, setSpecialFittingPlacement, setSubDividerPlacement, setZoom, showDoorsIn2D, showRoomContextInElev, snapXBadgeRef, snapXCircleRef, snapXGroupRef, snapXLineRef, snapXTextRef, snapYBadgeRef, snapYGroupRef, snapYLineRef, snapYTextRef, spaceObstacles, splitBayIntoTwo, updateObstaclePosition, updateSceneObject, vb } = ctx;
    const handleElevationPointerMove = (e: React.MouseEvent<SVGSVGElement>) => {
      if (elevDraggingObs || elevDraggingSceneObj || elevResizingMod || elevDraggingMod || interiorDrag) {
        const nowTs = performance.now();
        if (nowTs - lastPointerMoveTsRef.current < 16) return;
        lastPointerMoveTsRef.current = nowTs;
      }
      const svgEl = e.currentTarget;
      if (elevDraggingSceneObj) {
        const dxMm = (e.clientX - elevDraggingSceneObj.startClientX) * elevDraggingSceneObj.mmPerPxX;
        const dyMm = -(e.clientY - elevDraggingSceneObj.startClientY) * elevDraggingSceneObj.mmPerPxY;
        const step = magnetEnabled && !e.altKey ? 10 : 1;
        const nextX = Math.max(0, Math.round((elevDraggingSceneObj.startX + dxMm) / step) * step);
        const nextY = Math.max(0, Math.round((elevDraggingSceneObj.startY + dyMm) / step) * step);
        updateSceneObject(elevDraggingSceneObj.id, {
          position: { x: nextX, y: nextY, z: elevDraggingSceneObj.startZ },
        });
        return;
      }
      if (elevDraggingObs) {
        const dxMm = (e.clientX - elevDraggingObs.startClientX) * elevDraggingObs.mmPerPxX;
        const dyMm = -(e.clientY - elevDraggingObs.startClientY) * elevDraggingObs.mmPerPxY;
        const nextX = Math.max(0, Math.round((elevDraggingObs.startX + dxMm) / 10) * 10);
        const nextY = Math.max(0, Math.round((elevDraggingObs.startY + dyMm) / 10) * 10);
        updateObstaclePosition(elevDraggingObs.id, nextX, undefined, nextY);
        return;
      }
      if (elevResizingMod) {
        if (elevResizingMod.axis === "width_right" || elevResizingMod.axis === "width_left") {
          const dxMm = (e.clientX - elevResizingMod.startClientX) * elevResizingMod.mmPerPxX;
          const rawW =
            elevResizingMod.axis === "width_right"
              ? elevResizingMod.startW + dxMm
              : elevResizingMod.startW - dxMm;
          const widthSnap = computeResizeWidthSnap({
            modules: project.modules,
            activeModIdx: elevResizingMod.modIdx,
            axis: elevResizingMod.axis,
            rawWidthMm: rawW,
            startX: elevResizingMod.startX,
            startW: elevResizingMod.startW,
            minW: 300,
            maxW: 3600,
            toleranceMm: 35,
            disableSnap: !magnetEnabled || e.altKey,
          });
          const res =
            elevResizingMod.axis === "width_left"
              ? resizeModuleParametric(elevResizingMod.modIdx, widthSnap.width, widthSnap.positionX)
              : resizeModuleParametric(elevResizingMod.modIdx, widthSnap.width);
          if (widthSnap.snapBanner) {
            setPlanRowSnapBanner(widthSnap.snapBanner);
          } else if (res) {
            setPlanRowSnapBanner(
              elevResizingMod.axis === "width_left"
                ? `📐 Parametrik Genişlik (W): ${widthSnap.width}mm (X:${widthSnap.positionX}) → ${res.bayCount} Bölme • ${res.totalLeafCount} Kapak`
                : `📐 Parametrik Genişlik (W): ${widthSnap.width}mm → ${res.bayCount} Bölme (${res.bayCount - 1} Dikme) • ${res.totalLeafCount} Kapak`
            );
          }
        } else if (elevResizingMod.axis === "height_top") {
          const dyMm = -(e.clientY - elevResizingMod.startClientY) * elevResizingMod.mmPerPxY;
          const rawH = Math.max(350, Math.min(2800, elevResizingMod.startH + dyMm));
          const rawTopWorldY = elevResizingMod.startY + rawH;

          // V55: Magnetic Height Alignment Snapping to Neighbor Modules, Obstacles & Ceiling!
          const snapTargets: Array<{ worldY: number; label: string }> = [];
          const ceilH = project.space?.ceilingHeight || 2600;
          snapTargets.push({ worldY: ceilH, label: "Tavan Hizası" });
          if (ceilH > 400) {
            snapTargets.push({ worldY: ceilH - 30, label: "Tavan Gölge Boşluğu (-30mm)" });
          }
          project.modules.forEach((other, oIdx) => {
            if (oIdx === elevResizingMod.modIdx || other.category === "complementary") return;
            const oTop = other.position.y + other.dimensions.height;
            snapTargets.push({ worldY: oTop, label: `#${oIdx + 1} ${other.name} Üstü` });
            if (other.position.y >= 120) {
              snapTargets.push({ worldY: other.position.y, label: `#${oIdx + 1} ${other.name} Altı` });
            }
          });
          (spaceObstacles || []).forEach((obs) => {
            const obsName =
              obs.type === "window"
                ? "Pencere"
                : obs.type === "door"
                ? "Kapı"
                : obs.type === "beam"
                ? "Kiriş"
                : "Engel";
            if (obs.position.y >= 200) {
              snapTargets.push({ worldY: obs.position.y, label: `${obsName} Altı` });
            }
            snapTargets.push({
              worldY: obs.position.y + obs.dimensions.height,
              label: `${obsName} Üstü`,
            });
          });

          const MAGNET_MM = 42;
          let bestSnap: { worldY: number; label: string; dist: number } | null = null;
          for (const cand of snapTargets) {
            const dist = Math.abs(rawTopWorldY - cand.worldY);
            if (dist <= MAGNET_MM && (!bestSnap || dist < bestSnap.dist)) {
              bestSnap = { ...cand, dist };
            }
          }

          const newH = bestSnap
            ? Math.max(350, Math.min(2800, bestSnap.worldY - elevResizingMod.startY))
            : rawH;

          // Visual Horizontal Alignment Laser Guide across entire 2D Elevation
          if (snapYGroupRef.current) {
            if (bestSnap) {
              const sy = floorSvgY - bestSnap.worldY;
              snapYGroupRef.current.style.display = "inline";
              if (snapYLineRef.current) {
                snapYLineRef.current.setAttribute("y1", String(sy));
                snapYLineRef.current.setAttribute("y2", String(sy));
              }
              if (snapYBadgeRef.current) snapYBadgeRef.current.setAttribute("y", String(sy - 26));
              if (snapYTextRef.current) {
                snapYTextRef.current.setAttribute("y", String(sy + 9));
                snapYTextRef.current.textContent = `🧲 ${Math.round(bestSnap.worldY)}mm`;
              }
            } else {
              snapYGroupRef.current.style.display = "none";
            }
          }

          const res = resizeModuleParametric(
            elevResizingMod.modIdx,
            elevResizingMod.startW,
            undefined,
            undefined,
            newH
          );
          setPlanRowSnapBanner(
            bestSnap
              ? `🧲 Hizalandı: ${bestSnap.label} (${Math.round(bestSnap.worldY)} mm) • Boy H: ${Math.round(newH)} mm`
              : `📐 Parametrik Yükseklik (Boy H): ${Math.round(newH / 10) * 10}mm${res ? ` → ${res.shelfCount} Raf` : ""}`
          );
        } else if (elevResizingMod.axis === "height_bottom") {
          const dyMm = -(e.clientY - elevResizingMod.startClientY) * elevResizingMod.mmPerPxY;
          const topWorldY = elevResizingMod.startY + elevResizingMod.startH;
          const nextBottomY = Math.max(0, Math.min(topWorldY - 350, elevResizingMod.startY + dyMm));
          const newH = Math.max(350, Math.min(2800, topWorldY - nextBottomY));
          const res = resizeModuleParametric(
            elevResizingMod.modIdx,
            elevResizingMod.startW,
            undefined,
            undefined,
            newH,
            undefined,
            nextBottomY
          );
          setPlanRowSnapBanner(
            `📐 Parametrik Yükseklik (Boy H): ${Math.round(newH / 10) * 10}mm (Alt Kot Y:${Math.round(nextBottomY / 10) * 10}mm)${res ? ` → ${res.shelfCount} Raf` : ""}`
          );
        }
        return;
      }
      if (elevDraggingMod) {
        const dxMm = (e.clientX - elevDraggingMod.startClientX) * elevDraggingMod.mmPerPxX;
        const dyMm = -(e.clientY - elevDraggingMod.startClientY) * elevDraggingMod.mmPerPxY;
        const rawNextX = Math.max(0, elevDraggingMod.startModX + dxMm);
        let snappedX = magnetEnabled && !e.altKey ? Math.round(rawNextX / 10) * 10 : Math.round(rawNextX);
        let snapXLine: number | undefined;
        let snapXMsg: string | null = null;
        const targetMod = project.modules[elevDraggingMod.modIdx];
        if (targetMod) {
          const ceilingH = project.space.ceilingHeight || 2600;
          const roomWallLen = project.space.walls?.[0]?.length || 4200;
          const maxY = Math.max(0, ceilingH - targetMod.dimensions.height);
          const rawNextY = Math.max(0, Math.min(maxY, elevDraggingMod.startModY + dyMm));

          if (magnetEnabled && !e.altKey) {
            const hCandidates: { x: number; lineX: number; label: string }[] = [
              { x: 0, lineX: 0, label: "Duvar Başlangıcı (X: 0 mm)" },
            ];
            const maxWallX = Math.max(0, roomWallLen - targetMod.dimensions.width);
            if (maxWallX > 0) {
              hCandidates.push({
                x: maxWallX,
                lineX: roomWallLen,
                label: `Duvar Sonu (${Math.round(roomWallLen)} mm)`,
              });
            }
            project.modules.forEach((other, oIdx) => {
              if (oIdx === elevDraggingMod.modIdx) return;
              const oLeft = other.position.x;
              const oRight = other.position.x + other.dimensions.width;
              hCandidates.push({
                x: oRight,
                lineX: oRight,
                label: `"${other.name}" Sağına Bitiştir (${Math.round(oRight)} mm)`,
              });
              if (oLeft - targetMod.dimensions.width >= 0) {
                hCandidates.push({
                  x: oLeft - targetMod.dimensions.width,
                  lineX: oLeft,
                  label: `"${other.name}" Soluna Bitiştir (${Math.round(oLeft)} mm)`,
                });
              }
              hCandidates.push({
                x: oLeft,
                lineX: oLeft,
                label: `"${other.name}" Sol Hizası (${Math.round(oLeft)} mm)`,
              });
              if (oRight - targetMod.dimensions.width >= 0) {
                hCandidates.push({
                  x: oRight - targetMod.dimensions.width,
                  lineX: oRight,
                  label: `"${other.name}" Sağ Hizası (${Math.round(oRight)} mm)`,
                });
              }
            });

            let bestDistX = 28;
            for (const cand of hCandidates) {
              if (cand.x < 0) continue;
              const d = Math.abs(rawNextX - cand.x);
              if (d < bestDistX) {
                bestDistX = d;
                snappedX = Math.round(cand.x);
                snapXLine = cand.lineX;
                snapXMsg = `🧲 Yatay Hiza: ${cand.label}`;
              }
            }
          }

          let snappedY =
            magnetEnabled && !e.altKey ? Math.round(rawNextY / 10) * 10 : Math.round(rawNextY);
          let snapYLine: number | undefined;
          let snapBannerMsg: string | null = null;

          if (magnetEnabled && !e.altKey) {
            const vCandidates: { y: number; lineY: number; label: string }[] = [
              { y: 0, lineY: 0, label: "Zemin (0 mm)" },
              { y: maxY, lineY: ceilingH, label: `Tavan Hizası (${Math.round(maxY)} mm)` },
              { y: 860, lineY: 860, label: "Tezgâh Üstü (860 mm)" },
              { y: 1400, lineY: 1400, label: "Üst Dolap Kotu (1400 mm)" },
              { y: 1450, lineY: 1450, label: "Üst Dolap Kotu (1450 mm)" },
            ];
            project.modules.forEach((other, oIdx) => {
              if (oIdx === elevDraggingMod.modIdx) return;
              const oBot = other.position.y;
              const oTop = other.position.y + other.dimensions.height;
              vCandidates.push({
                y: oBot,
                lineY: oBot,
                label: `"${other.name}" Alt Hizası (${Math.round(oBot)} mm)`,
              });
              vCandidates.push({
                y: oTop,
                lineY: oTop,
                label: `"${other.name}" Üstüne Oturt (${Math.round(oTop)} mm)`,
              });
              const topAlignY = oTop - targetMod.dimensions.height;
              if (topAlignY >= 0) {
                vCandidates.push({
                  y: topAlignY,
                  lineY: oTop,
                  label: `"${other.name}" Üst Hizası (${Math.round(topAlignY)} mm)`,
                });
              }
            });

            let bestDist = 28;
            for (const cand of vCandidates) {
              if (cand.y < 0 || cand.y > maxY) continue;
              const d = Math.abs(rawNextY - cand.y);
              if (d < bestDist) {
                bestDist = d;
                snappedY = Math.round(cand.y);
                snapYLine = cand.lineY;
                snapBannerMsg = `🧲 Dikey Hiza: ${cand.label}`;
              }
            }
          }

          // Live store sync on snap change so the 3D viewport on the left mirrors 2D elevation drags in real time
          elevDragPreviewRef.current = {
            modIdx: elevDraggingMod.modIdx,
            x: snappedX,
            y: snappedY,
            snapXLine,
            snapYLine,
          };
          const modCommitKey = `${elevDraggingMod.modIdx}_${snappedX}_${snappedY}`;
          if (lastModElevCommitRef.current !== modCommitKey) {
            lastModElevCommitRef.current = modCommitKey;
            setModulePosition(
              elevDraggingMod.modIdx,
              snappedX,
              targetMod.position.z,
              1,
              snappedY
            );
          }

          const snapWallLeftSvgX = -roomOffX;
          const snapFloorSvgY = roomModH + roomOffY;
          if (snapXGroupRef.current) {
            if (snapXLine !== undefined) {
              const sx = snapWallLeftSvgX + snapXLine;
              snapXGroupRef.current.style.display = "inline";
              if (snapXLineRef.current) {
                snapXLineRef.current.setAttribute("x1", String(sx));
                snapXLineRef.current.setAttribute("x2", String(sx));
              }
              if (snapXCircleRef.current) {
                snapXCircleRef.current.setAttribute("cx", String(sx));
                snapXCircleRef.current.setAttribute("cy", String(snapFloorSvgY - snappedY));
              }
              if (snapXBadgeRef.current) snapXBadgeRef.current.setAttribute("x", String(sx - 80));
              if (snapXTextRef.current) {
                snapXTextRef.current.setAttribute("x", String(sx));
                snapXTextRef.current.textContent = `X:${Math.round(snapXLine)}`;
              }
            } else {
              snapXGroupRef.current.style.display = "none";
            }
          }
          if (snapYGroupRef.current) {
            if (snapYLine !== undefined) {
              const sy = snapFloorSvgY - snapYLine;
              snapYGroupRef.current.style.display = "inline";
              if (snapYLineRef.current) {
                snapYLineRef.current.setAttribute("y1", String(sy));
                snapYLineRef.current.setAttribute("y2", String(sy));
              }
              if (snapYBadgeRef.current) snapYBadgeRef.current.setAttribute("y", String(sy - 26));
              if (snapYTextRef.current) {
                snapYTextRef.current.setAttribute("y", String(sy + 9));
                snapYTextRef.current.textContent = `Y:${Math.round(snapYLine)}`;
              }
            } else {
              snapYGroupRef.current.style.display = "none";
            }
          }

          const combinedSnap = [snapXMsg, snapBannerMsg].filter(Boolean).join(" • ");
          const nextBanner = combinedSnap || `📐 Konum X: ${snappedX} mm • Kot Y: ${snappedY} mm`;
          if (elevSnapBannerDomRef.current) {
            elevSnapBannerDomRef.current.style.display = "block";
            elevSnapBannerDomRef.current.textContent = nextBanner;
          }
        }
        return;
      }
      if (!interiorDrag) return;
      const mmPerPxY = interiorDrag.mmPerPxY ?? getElevScaleMmPerPx(svgEl).y;
      const mmPerPxX = interiorDrag.mmPerPxX ?? getElevScaleMmPerPx(svgEl).x;

      if (interiorDrag.kind === "divider") {
        const dxMm = (e.clientX - interiorDrag.startClientX) * mmPerPxX;
        const snappedW = Math.round((interiorDrag.startValueMm + dxMm) / 10) * 10;
        const divKey = `div_${interiorDrag.bayIdx}_${snappedW}`;
        if (lastDividerCommitValRef.current !== divKey) {
          lastDividerCommitValRef.current = divKey;
          setBayCustomWidth(interiorDrag.bayIdx, snappedW, false);
        }
        return;
      }

      if (interiorDrag.kind === "sub_divider") {
        const dxMm = (e.clientX - interiorDrag.startClientX) * mmPerPxX;
        const dyMm = -(e.clientY - interiorDrag.startClientY) * mmPerPxY;
        const snappedX = Math.round((interiorDrag.startValueMm + dxMm) / 10) * 10;
        const startMidY =
          (interiorDrag.startElevY ?? 0) + (interiorDrag.itemHeightMm ?? 300) / 2;
        const targetMidY = Math.round(startMidY / 10) * 10 + Math.round(dyMm / 10) * 10;
        const subKey = `sub_${interiorDrag.targetId}_${snappedX}_${targetMidY}`;
        if (lastDividerCommitValRef.current !== subKey) {
          lastDividerCommitValRef.current = subKey;
          setSubDividerPlacement(
            interiorDrag.bayIdx,
            interiorDrag.targetId,
            { offsetX: snappedX, targetMidY },
            false
          );
        }
        const curBay = activeModule.bays[interiorDrag.bayIdx];
        if (curBay) {
          const ivs = getBayShelfIntervalsForSubDivider(
            curBay,
            calculateNetInnerHeight(activeModule),
            activeModule.carcass.panelThickness || 18
          );
          const freeIvs = ivs.filter((iv) => !iv.hasConflict);
          const hoveredConflictIv = ivs.find(
            (iv) => iv.hasConflict && targetMidY >= iv.botY && targetMidY <= iv.topY
          );
          const bestIv =
            freeIvs.find((iv) => targetMidY >= iv.botY - 18 && targetMidY <= iv.topY + 18) ||
            freeIvs.reduce(
              (best, iv) =>
                !best ||
                Math.abs((iv.botY + iv.topY) / 2 - targetMidY) <
                  Math.abs((best.botY + best.topY) / 2 - targetMidY)
                  ? iv
                  : best,
              null as (typeof freeIvs)[number] | null
            );
          if (hoveredConflictIv && bestIv) {
            setPlanRowSnapBanner(
              `⚠️ Bu aralıkta ${hoveredConflictIv.conflictReason}! Dikme en yakın boş aralığa (${bestIv.label} • Y:${bestIv.botY}mm) kilitlendi`
            );
          } else if (bestIv) {
            setPlanRowSnapBanner(
              `✥ Raf Arası Dikme • ${bestIv.label} • Sol X: ${snappedX}mm (Alt Y: ${bestIv.botY}mm • Boy: ${bestIv.height}mm)`
            );
          }
        }
        return;
      }

      // In SVG, moving cursor UP (negative clientY delta) increases elevationY from bottom panel
      const dyMm = -(e.clientY - interiorDrag.startClientY) * mmPerPxY;
      const rawElevY = interiorDrag.startValueMm + dyMm;
      const snapTargets = interiorSnapTargetsRef.current.length > 0
        ? interiorSnapTargetsRef.current
        : computeElevationSnapTargets(
            project,
            activeModuleIndex,
            interiorDrag.bayIdx,
            interiorDrag.targetId,
            interiorDrag.itemHeightMm
          );
      const { elevationY: rawSnappedY, snappedTarget } =
        interiorDrag.kind === "shelf"
          ? snapShelfToMultiHoleOrElevationTargets({
              project,
              moduleIndex: activeModuleIndex,
              bayIndex: interiorDrag.bayIdx,
              shelfId: interiorDrag.targetId,
              rawElevationY: rawElevY,
              snapTargets,
              bypassMultiHole: false,
            })
          : resolveElevationSnap(rawElevY, snapTargets, 18);
      setActiveElevSnap((prev) =>
        prev?.elevationY === snappedTarget?.elevationY && prev?.label === snappedTarget?.label
          ? prev
          : snappedTarget
      );

      const TClamp = activeModule.carcass.panelThickness || 18;
      const plinthClamp = activeModule.carcass.plinthHeight ?? 100;
      const netHClamp = Math.max(200, activeModule.dimensions.height - plinthClamp - 2 * TClamp);
      const itemH = interiorDrag.itemHeightMm || TClamp;
      const snappedY =
        interiorDrag.kind === "shelf"
          ? snappedTarget?.kind === "system32_hole"
            ? Math.round(rawSnappedY)
            : Math.max(60, Math.min(Math.max(100, netHClamp - 60), Math.round(rawSnappedY)))
          : interiorDrag.kind === "drawer"
          ? Math.max(0, Math.min(Math.max(0, netHClamp - itemH), Math.round(rawSnappedY)))
          : interiorDrag.kind === "rail"
          ? Math.max(120, Math.min(Math.max(160, netHClamp - 40), Math.round(rawSnappedY)))
          : Math.max(40, Math.min(Math.max(80, netHClamp - itemH), Math.round(rawSnappedY)));

      // V83: Detect horizontal cross-bay / cross-module drag in 2D Front Elevation!
      const dxMm2D = (e.clientX - interiorDrag.startClientX) * mmPerPxX;
      const srcBws = breakdown.bayWidths;
      const srcBayCenterSvgX = (() => {
        let cx = TClamp;
        for (let i = 0; i < interiorDrag.bayIdx; i += 1) cx += (srcBws[i] || 500) + TClamp;
        return cx + (srcBws[interiorDrag.bayIdx] || 500) * 0.5;
      })();
      const curSvgX = srcBayCenterSvgX + dxMm2D;

      let destModIdx2D = activeModuleIndex;
      let destBayIdx2D = interiorDrag.bayIdx;
      let destCenterSvgX = srcBayCenterSvgX;

      const resolveBayInMod = (m: typeof activeModule, localX: number) => {
        const pt = m.carcass.panelThickness || 18;
        const bws = calculateBayWidths(m);
        let cx = pt;
        for (let bi = 0; bi < m.bays.length; bi += 1) {
          const bw = bws[bi] || 500;
          if (localX <= cx + bw + pt * 0.5 || bi === m.bays.length - 1) {
            return { bayIdx: bi, centerLocalX: cx + bw * 0.5 };
          }
          cx += bw + pt;
        }
        return { bayIdx: 0, centerLocalX: pt + (bws[0] || 500) * 0.5 };
      };

      if (curSvgX >= -25 && curSvgX <= activeModule.dimensions.width + 25) {
        const res = resolveBayInMod(activeModule, Math.max(0, curSvgX));
        destModIdx2D = activeModuleIndex;
        destBayIdx2D = res.bayIdx;
        destCenterSvgX = res.centerLocalX;
      } else if (showRoomContextInElev) {
        let matchedOther = false;
        project.modules.forEach((otherMod, oIdx) => {
          if (matchedOther || otherMod.category === "complementary" || otherMod.bays.length === 0) return;
          const relLeft = otherMod.position.x - activeModule.position.x;
          if (curSvgX >= relLeft - 25 && curSvgX <= relLeft + otherMod.dimensions.width + 25) {
            const res = resolveBayInMod(otherMod, Math.max(0, curSvgX - relLeft));
            destModIdx2D = oIdx;
            destBayIdx2D = res.bayIdx;
            destCenterSvgX = relLeft + res.centerLocalX;
            matchedOther = true;
          }
        });
        if (!matchedOther) {
          const res = resolveBayInMod(activeModule, Math.max(0, Math.min(activeModule.dimensions.width, curSvgX)));
          destModIdx2D = activeModuleIndex;
          destBayIdx2D = res.bayIdx;
          destCenterSvgX = res.centerLocalX;
        }
      } else {
        const res = resolveBayInMod(activeModule, Math.max(0, Math.min(activeModule.dimensions.width, curSvgX)));
        destModIdx2D = activeModuleIndex;
        destBayIdx2D = res.bayIdx;
        destCenterSvgX = res.centerLocalX;
      }

      const isCrossBay2D = destModIdx2D !== activeModuleIndex || destBayIdx2D !== interiorDrag.bayIdx;

      if (elevSnapBannerDomRef.current) {
        elevSnapBannerDomRef.current.style.display = "block";
        elevSnapBannerDomRef.current.textContent = isCrossBay2D
          ? destModIdx2D !== activeModuleIndex
            ? `⇄ Modül #${destModIdx2D + 1} · ${destBayIdx2D + 1}. Bölmeye Taşı • Y: ${snappedY} mm`
            : `⇄ ${destBayIdx2D + 1}. Bölmeye Taşı • Y: ${snappedY} mm`
          : snappedTarget
            ? `🧲 ${snappedTarget.label}`
            : `📐 Yükseklik Kotu Y: ${snappedY} mm`;
      }

      if (isCrossBay2D) {
        const deltaSvgX = destCenterSvgX - srcBayCenterSvgX;
        const deltaSvgY = -(snappedY - interiorDrag.startValueMm);
        let liveInt = elevInteriorLiveRef.current;
        if (!liveInt) {
          const foundEls = Array.from(
            svgEl.querySelectorAll(`[data-interior-owner="${interiorDrag.targetId}"], [data-testid="cad-el-${interiorDrag.targetId}"]`)
          ) as SVGGElement[];
          liveInt = {
            els: foundEls.map((el) => ({ el, baseTransform: el.getAttribute("transform") || "" })),
            snappedY,
            hasMoved: true,
            destModIdx: destModIdx2D,
            destBayIdx: destBayIdx2D,
          };
          elevInteriorLiveRef.current = liveInt;
        }
        liveInt.snappedY = snappedY;
        liveInt.hasMoved = true;
        liveInt.destModIdx = destModIdx2D;
        liveInt.destBayIdx = destBayIdx2D;
        for (const item of liveInt.els) {
          const prefix = item.baseTransform ? `${item.baseTransform} ` : "";
          item.el.setAttribute("transform", `${prefix}translate(${deltaSvgX}, ${deltaSvgY})`);
        }
        return;
      }

      if (elevInteriorLiveRef.current) {
        for (const item of elevInteriorLiveRef.current.els) {
          if (item.baseTransform) item.el.setAttribute("transform", item.baseTransform);
          else item.el.removeAttribute("transform");
        }
        elevInteriorLiveRef.current = null;
      }

      const intCommitKey = `${interiorDrag.kind}_${interiorDrag.bayIdx}_${interiorDrag.targetId}_${snappedY}`;
      if (lastInteriorCommitRef.current === intCommitKey) {
        return;
      }
      lastInteriorCommitRef.current = intCommitKey;

      if (interiorDrag.kind === "shelf") {
        setShelfElevation(interiorDrag.bayIdx, interiorDrag.targetId, snappedY, false);
      } else if (interiorDrag.kind === "drawer") {
        setDrawerPlacement(
          interiorDrag.bayIdx,
          interiorDrag.targetId,
          snappedY,
          undefined,
          false
        );
      } else if (interiorDrag.kind === "rail") {
        setHangingRailElevation(interiorDrag.bayIdx, interiorDrag.targetId, snappedY, false);
      } else if (interiorDrag.kind === "special_fitting") {
        setSpecialFittingPlacement(interiorDrag.bayIdx, interiorDrag.targetId, { elevationY: snappedY }, false);
      }
    };

    const handleElevationPointerUp = () => {
      if (typeof document !== "undefined") {
        delete document.body.dataset.birimUiDragging;
      }
      if (elevSnapBannerDomRef.current && !planRowSnapBanner) {
        elevSnapBannerDomRef.current.style.display = "none";
      }
      if (elevResizingMod) {
        setElevResizingMod(null); if (snapYGroupRef.current) snapYGroupRef.current.style.display = "none";
        setPlanRowSnapBanner(null);
        commitHistoryTransaction();
      }
      if (elevDraggingObs) {
        setElevDraggingObs(null);
        commitHistoryTransaction();
      }
      if (elevDraggingSceneObj) {
        setElevDraggingSceneObj(null);
        commitHistoryTransaction();
      }
      if (elevDraggingMod) {
        const preview = elevDragPreviewRef.current;
        const draggedMod = project.modules[elevDraggingMod.modIdx];
        if (draggedMod && preview && preview.modIdx === elevDraggingMod.modIdx) {
          setModulePosition(
            elevDraggingMod.modIdx,
            preview.x,
            draggedMod.position.z,
            1,
            preview.y
          );
        }
        elevDragPreviewRef.current = null;
        if (activeModGroupRef.current) activeModGroupRef.current.removeAttribute("transform");
        if (activeHaloGroupRef.current) activeHaloGroupRef.current.removeAttribute("transform");
        const swapMsg = finishModuleDragWithSmartSwap(
          elevDraggingMod.modIdx,
          elevDraggingMod.startModX
        );
        setElevDraggingMod(null);
        commitHistoryTransaction();
        if (swapMsg) {
          setPlanRowSnapBanner(swapMsg);
          setTimeout(() => setPlanRowSnapBanner(null), 2800);
        } else {
          setPlanRowSnapBanner(null);
        }
      }
      if (interiorDrag) {
        const liveInt = elevInteriorLiveRef.current;
        if (liveInt) {
          for (const item of liveInt.els) {
            if (item.baseTransform) item.el.setAttribute("transform", item.baseTransform);
            else item.el.removeAttribute("transform");
          }
          if (liveInt.hasMoved) {
            const dstModIdx = typeof liveInt.destModIdx === "number" ? liveInt.destModIdx : activeModuleIndex;
            const dstBayIdx = typeof liveInt.destBayIdx === "number" ? liveInt.destBayIdx : interiorDrag.bayIdx;
            if (dstModIdx !== activeModuleIndex || dstBayIdx !== interiorDrag.bayIdx) {
              let movedCross = false;
              const st2d = useConfiguratorStore.getState();
              st2d.applyBatchProjectUpdate((draft) => {
                const srcBay = draft.modules[activeModuleIndex]?.bays[interiorDrag.bayIdx];
                const dstBay = draft.modules[dstModIdx]?.bays[dstBayIdx];
                if (!srcBay || !dstBay) return;
                if (interiorDrag.kind === "shelf") {
                  const idx = srcBay.shelves.findIndex((s) => s.id === interiorDrag.targetId || interiorDrag.targetId.includes(s.id));
                  if (idx >= 0) {
                    const [mItem] = srcBay.shelves.splice(idx, 1);
                    mItem.elevationY = liveInt.snappedY;
                    dstBay.shelves.push(mItem);
                    movedCross = true;
                  }
                } else if (interiorDrag.kind === "drawer") {
                  const idx = srcBay.drawers.findIndex((d) => d.id === interiorDrag.targetId || interiorDrag.targetId.includes(d.id));
                  if (idx >= 0) {
                    const [mItem] = srcBay.drawers.splice(idx, 1);
                    mItem.elevationY = liveInt.snappedY;
                    dstBay.drawers.push(mItem);
                    movedCross = true;
                  }
                } else if (interiorDrag.kind === "rail") {
                  const idx = srcBay.hangingRails.findIndex((r) => r.id === interiorDrag.targetId || interiorDrag.targetId.includes(r.id));
                  if (idx >= 0) {
                    const [mItem] = srcBay.hangingRails.splice(idx, 1);
                    mItem.elevationY = liveInt.snappedY;
                    dstBay.hangingRails.push(mItem);
                    movedCross = true;
                  }
                } else if (interiorDrag.kind === "special_fitting" && srcBay.specialFittings) {
                  const idx = srcBay.specialFittings.findIndex((f) => f.id === interiorDrag.targetId || interiorDrag.targetId.includes(f.id));
                  if (idx >= 0) {
                    const [mItem] = srcBay.specialFittings.splice(idx, 1);
                    mItem.elevationY = liveInt.snappedY;
                    if (!dstBay.specialFittings) dstBay.specialFittings = [];
                    dstBay.specialFittings.push(mItem);
                    movedCross = true;
                  }
                }
              }, "İç eleman bölme değiştirildi");
              if (movedCross) {
                if (dstModIdx !== activeModuleIndex) st2d.setActiveModuleIndex(dstModIdx);
                st2d.setActiveBayIndex(dstBayIdx);
              }
            } else if (interiorDrag.kind === "shelf") {
              setShelfElevation(interiorDrag.bayIdx, interiorDrag.targetId, liveInt.snappedY, false);
            } else if (interiorDrag.kind === "drawer") {
              setDrawerPlacement(
                interiorDrag.bayIdx,
                interiorDrag.targetId,
                liveInt.snappedY,
                undefined,
                false
              );
            } else if (interiorDrag.kind === "rail") {
              setHangingRailElevation(
                interiorDrag.bayIdx,
                interiorDrag.targetId,
                liveInt.snappedY,
                false
              );
            } else if (interiorDrag.kind === "special_fitting") {
              setSpecialFittingPlacement(
                interiorDrag.bayIdx,
                interiorDrag.targetId,
                { elevationY: liveInt.snappedY },
                false
              );
            }
          }
          elevInteriorLiveRef.current = null;
        }
        setInteriorDrag(null);
        lastInteriorCommitRef.current = "";
        setPlanRowSnapBanner(null);
        commitHistoryTransaction();
      }
      setActiveElevSnap(null);
    };

    // Map component IDs to interior draggable items
    const findInteriorDragTarget = (compId: string) =>
      findDraggableInteriorComponent(activeModule, compId, breakdown.bayWidths);

    type ElevationContextTarget =
      | { kind: "canvas" }
      | { kind: "module" }
      | {
          kind: "interior";
          meta: NonNullable<ReturnType<typeof findDraggableInteriorComponent>>;
          compId: string;
        }
      | { kind: "rail"; bayIdx: number; railId: string };

    const openElevationContextMenu = (e: React.MouseEvent, target: ElevationContextTarget) => {
      e.preventDefault();
      e.stopPropagation();

      const sectionControlsSection =
        mode === "section"
          ? {
              title: "Kesit Düzlemi",
              items: [
                {
                  id: "sec-toggle-dir",
                  label:
                    sectionDirection2D === "Z"
                      ? "Kesit Yönü: B-B Boyuna Geç"
                      : "Kesit Yönü: A-A Yan Geç",
                  onClick: () => setSectionDirection2D(sectionDirection2D === "Z" ? "X" : "Z"),
                },
                {
                  id: "sec-center-plane",
                  label: "Kesit Düzlemini Ortala (0.5)",
                  onClick: () => setSectionCutRatio2D(0.5),
                },
              ],
            }
          : null;

      if (target.kind === "interior") {
        const { meta, compId } = target;
        const bay = activeModule.bays?.[meta.bayIdx];
        setActiveBayIndex(meta.bayIdx);
        setSelectedComponentId(compId);

        if (meta.kind === "shelf") {
          const shelf = bay?.shelves?.find((s) => s.id === meta.targetId);
          const isAdj = shelf?.isAdjustable ?? true;
          const thick = shelf?.thickness ?? activeModule.carcass?.panelThickness ?? 18;
          const sections: CadContextMenuState["sections"] = [
            {
              title: "Raf İşlemleri",
              items: [
                {
                  id: "elev-shelf-mount",
                  label: isAdj ? "Sabit Rafa Çevir (Minifiks)" : "Ayarlı Rafa Çevir (Pim)",
                  onClick: () => setShelfMountType(meta.bayIdx, meta.targetId, !isAdj),
                },
                {
                  id: "elev-shelf-thick",
                  label: thick >= 25 ? "Raf Kalınlığını 18mm Yap" : "Raf Kalınlığını 25mm Yap",
                  onClick: () => setShelfThickness(meta.bayIdx, meta.targetId, thick >= 25 ? 18 : 25),
                },
                {
                  id: "elev-shelf-add",
                  label: "Bu Bölmeye Ayarlı Raf Ekle",
                  onClick: () => addShelf(meta.bayIdx),
                },
              ],
            },
            {
              title: "Malzeme İşlemleri",
              items: [
                {
                  id: "elev-shelf-mat-oak",
                  label: "Bu Rafa Meşe Kaplama Ata",
                  onClick: () => applyMaterialToSimilarComponents("mat_veneer_oak", compId, "single"),
                },
                {
                  id: "elev-shelf-mat-white",
                  label: "Bu Rafa Beyaz Gövde Ata",
                  onClick: () => applyMaterialToSimilarComponents("mat_melamine_white", compId, "single"),
                },
                {
                  id: "elev-shelf-mat-spread",
                  label: "Malzemesini Modüldeki Tüm Raflara Yay",
                  onClick: () => {
                    const curMat =
                      activeModule.componentMaterialOverrides?.[compId] ||
                      activeModule.carcass.bodyMaterialId;
                    applyMaterialToSimilarComponents(curMat, compId, "module_similar");
                  },
                },
              ],
            },
            ...(sectionControlsSection ? [sectionControlsSection] : []),
            {
              items: [
                {
                  id: "elev-shelf-del",
                  label: "Rafı Sil",
                  shortcut: "Del",
                  danger: true,
                  onClick: () => {
                    setSelectedComponentId(compId);
                    removeSelectedInteriorComponent();
                  },
                },
              ],
            },
          ];
          setCadContextMenu({
            x: e.clientX,
            y: e.clientY,
            headerTitle: isAdj ? "Ayarlı Raf" : "Sabit Raf",
            headerSubtitle: `Bölme ${meta.bayIdx + 1} • ${formatElevationValue(meta.startVal, elevDisplayUnit)} • ${formatElevationValue(thick, elevDisplayUnit)}`,
            sections,
          });
          return;
        }

        if (meta.kind === "drawer") {
          const sections: CadContextMenuState["sections"] = [
            {
              title: "Çekmece İşlemleri",
              items: [
                {
                  id: "elev-drawer-add",
                  label: "Üstüne Çekmece Ekle",
                  onClick: () => addDrawer(meta.bayIdx),
                },
                {
                  id: "elev-drawer-internal",
                  label: "İç Çekmece Ekle",
                  onClick: () => addInternalDrawer(meta.bayIdx),
                },
              ],
            },
            ...(sectionControlsSection ? [sectionControlsSection] : []),
            {
              items: [
                {
                  id: "elev-drawer-del",
                  label: "Çekmeceyi Sil",
                  shortcut: "Del",
                  danger: true,
                  onClick: () => {
                    setSelectedComponentId(compId);
                    removeSelectedInteriorComponent();
                  },
                },
              ],
            },
          ];
          setCadContextMenu({
            x: e.clientX,
            y: e.clientY,
            headerTitle: "Çekmece",
            headerSubtitle: `Bölme ${meta.bayIdx + 1} • ${formatElevationValue(meta.startVal, elevDisplayUnit)}`,
            sections,
          });
          return;
        }

        if (meta.kind === "divider" || meta.kind === "sub_divider") {
          const sections: CadContextMenuState["sections"] = [
            {
              title: "Dikme & Bölme Düzeni",
              items: [
                {
                  id: "elev-div-eq",
                  label: "Bölmeleri ve Rafları Eşitle",
                  onClick: () => equalizeBaysAndShelves(),
                },
                {
                  id: "elev-div-split",
                  label: "Bölmeyi İkiye Böl",
                  onClick: () => splitBayIntoTwo(meta.bayIdx),
                },
              ],
            },
            ...(sectionControlsSection ? [sectionControlsSection] : []),
          ];
          if (meta.kind === "sub_divider") {
            sections.push({
              items: [
                {
                  id: "elev-subdiv-del",
                  label: "Ara Dikmeyi Sil",
                  shortcut: "Del",
                  danger: true,
                  onClick: () => {
                    setSelectedComponentId(compId);
                    removeSelectedInteriorComponent();
                  },
                },
              ],
            });
          }
          setCadContextMenu({
            x: e.clientX,
            y: e.clientY,
            headerTitle: meta.kind === "divider" ? "Orta Dikme" : "İç Ara Dikme",
            headerSubtitle: `Bölme ${meta.bayIdx + 1}`,
            sections,
          });
          return;
        }

        // special_fitting or other interior item
        setCadContextMenu({
          x: e.clientX,
          y: e.clientY,
          headerTitle: "İç Aksesuar / Donanım",
          headerSubtitle: `Bölme ${meta.bayIdx + 1}`,
          sections: [
            ...(sectionControlsSection ? [sectionControlsSection] : []),
            {
              items: [
                {
                  id: "elev-fitting-del",
                  label: "Parçayı Sil",
                  shortcut: "Del",
                  danger: true,
                  onClick: () => {
                    setSelectedComponentId(compId);
                    removeSelectedInteriorComponent();
                  },
                },
              ],
            },
          ],
        });
        return;
      }

      if (target.kind === "rail") {
        setActiveBayIndex(target.bayIdx);
        setSelectedComponentId(target.railId);
        setCadContextMenu({
          x: e.clientX,
          y: e.clientY,
          headerTitle: "Askı Borusu",
          headerSubtitle: `Bölme ${target.bayIdx + 1}`,
          sections: [
            {
              title: "Bölme Hızlı Ekleme",
              items: [
                {
                  id: "elev-rail-shelf",
                  label: "Üstüne Ayarlı Raf Ekle",
                  onClick: () => addShelf(target.bayIdx),
                },
              ],
            },
            ...(sectionControlsSection ? [sectionControlsSection] : []),
            {
              items: [
                {
                  id: "elev-rail-del",
                  label: "Askı Borusunu Sil",
                  shortcut: "Del",
                  danger: true,
                  onClick: () => {
                    setSelectedComponentId(target.railId);
                    removeSelectedInteriorComponent();
                  },
                },
              ],
            },
          ],
        });
        return;
      }

      if (target.kind === "module" && hasSceneModules) {
        const bayIdx = Math.max(0, Math.min(activeBayIndex, (activeModule.bays?.length || 1) - 1));
        const sections: CadContextMenuState["sections"] = [
          {
            title: `Bölme ${bayIdx + 1} Hızlı Ekle`,
            items: [
              { id: "elev-add-shelf", label: "Ayarlı Raf Ekle", onClick: () => addShelf(bayIdx) },
              { id: "elev-add-fixed", label: "Sabit Raf Ekle", onClick: () => addFixedShelf(bayIdx) },
              { id: "elev-add-drawer", label: "Dış Çekmece Ekle", onClick: () => addDrawer(bayIdx) },
              { id: "elev-add-idrawer", label: "İç Çekmece Ekle", onClick: () => addInternalDrawer(bayIdx) },
              { id: "elev-add-rail", label: "Askı Borusu Ekle", onClick: () => addHangingRail(bayIdx) },
              { id: "elev-split-bay", label: "Bölmeyi İkiye Böl", onClick: () => splitBayIntoTwo(bayIdx) },
              { id: "elev-eq-bays", label: "Bölmeleri & Rafları Eşitle", onClick: () => equalizeBaysAndShelves() },
            ],
          },
          {
            title: "Modül İşlemleri",
            items: [
              { id: "elev-mod-dup", label: "Modülü Çoğalt", onClick: () => duplicateActiveModule() },
              { id: "elev-mod-top", label: "Üstüne Modül Ekle", onClick: () => addStackedTopModule() },
              {
                id: "elev-mod-floor",
                label: "Zemine İndir (Kot Y=0)",
                disabled: Math.round(activeModule.position.y) === 0,
                onClick: () =>
                  setModulePosition(
                    activeModuleIndex,
                    activeModule.position.x,
                    activeModule.position.z,
                    1,
                    0
                  ),
              },
            ],
          },
          ...(sectionControlsSection ? [sectionControlsSection] : []),
          {
            title: "Görünüm",
            items: [
              {
                id: "elev-toggle-doors",
                label: showDoorsIn2D ? "Kapakları Gizle" : "Kapakları Göster",
                onClick: () => setShowDoorsIn2D((v) => !v),
              },
              {
                id: "elev-toggle-room",
                label: showRoomContextInElev ? "Oda Bağlamını Gizle" : "Oda Bağlamını Göster",
                onClick: () => setShowRoomContextInElev((v) => !v),
              },
              {
                id: "elev-toggle-unit",
                label: `Ölçü Birimi: ${elevDisplayUnit === "mm" ? "cm'ye Geç" : "mm'ye Geç"}`,
                onClick: () => handleChangeElevDisplayUnit(elevDisplayUnit === "mm" ? "cm" : "mm"),
              },
            ],
          },
          {
            items: [
              {
                id: "elev-mod-del",
                label: "Modülü Sil",
                shortcut: "Del",
                danger: true,
                onClick: () => removeActiveModule(),
              },
            ],
          },
        ];
        setCadContextMenu({
          x: e.clientX,
          y: e.clientY,
          headerTitle: activeModule.name || `Modül ${activeModuleIndex + 1}`,
          headerSubtitle: `${formatElevationValue(activeModule.dimensions.width, elevDisplayUnit, false)}×${formatElevationValue(activeModule.dimensions.height, elevDisplayUnit, false)}×${formatElevationValue(activeModule.dimensions.depth, elevDisplayUnit)}`,
          sections,
        });
        return;
      }

      // Empty canvas
      setCadContextMenu({
        x: e.clientX,
        y: e.clientY,
        headerTitle: mode === "section" ? "Kesit Görünümü" : "Ön Cephe Görünümü",
        sections: [
          ...(sectionControlsSection ? [sectionControlsSection] : []),
          {
            title: "Görünüm & Ölçü",
            items: [
              {
                id: "elev-canvas-reset",
                label: "Yakınlaştırmayı ve Konumu Sıfırla",
                onClick: () => {
                  setZoom(1);
                  setPanPx({ x: 0, y: 0 });
                  setElevPanMode(false);
                },
              },
              {
                id: "elev-canvas-doors",
                label: showDoorsIn2D ? "Kapakları Gizle" : "Kapakları Göster",
                onClick: () => setShowDoorsIn2D((v) => !v),
              },
              {
                id: "elev-canvas-room",
                label: showRoomContextInElev ? "Oda Bağlamını Gizle" : "Oda Bağlamını Göster",
                onClick: () => setShowRoomContextInElev((v) => !v),
              },
              {
                id: "elev-canvas-unit",
                label: `Ölçü Birimi: ${elevDisplayUnit === "mm" ? "cm'ye Geç" : "mm'ye Geç"}`,
                onClick: () => handleChangeElevDisplayUnit(elevDisplayUnit === "mm" ? "cm" : "mm"),
              },
            ],
          },
        ],
      });
    };

    const handleElevDragOver = (e: React.DragEvent<HTMLDivElement>) => {
      if (mode !== "elevation") return;
      const activeAcc = typeof window !== "undefined" ? (window as any).__birimActiveDraggedAccessory : null;
      const hasAccessoryMime = e.dataTransfer.types.includes("application/x-birim-accessory-id");

      if (hasAccessoryMime || activeAcc) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        const mod = activeModule || project.modules[0];
        if (!mod) return;

        const svgEl = e.currentTarget.querySelector("svg");
        const rect = (svgEl || e.currentTarget).getBoundingClientRect();
        const relX = Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)));
        const relY = Math.max(0, Math.min(1, (e.clientY - rect.top) / Math.max(1, rect.height)));
        const svgX = vb.x + relX * vb.width;
        const svgY = vb.y + relY * vb.height;

        const carcassT = mod.carcass?.panelThickness || 18;
        const plinthH = mod.carcass?.plinthHeight || 0;
        const netH = calculateNetInnerHeight(mod);
        const bayWidths = calculateBayWidths(mod);

        const modX = mod.position?.x || 0;
        const localX = svgX - modX;
        let targetBayIdx = 0;
        let accX = carcassT;
        let bayStartX = carcassT;
        let curBayWidth = bayWidths[0] || 500;
        for (let i = 0; i < bayWidths.length; i++) {
          const bw = bayWidths[i];
          if (localX >= accX && localX <= accX + bw + carcassT) {
            targetBayIdx = i;
            bayStartX = accX;
            curBayWidth = bw;
            break;
          }
          accX += bw + carcassT;
        }
        targetBayIdx = Math.max(0, Math.min(mod.bays.length - 1, targetBayIdx));
        const localBayX = Math.max(48, Math.min(curBayWidth - 48, Math.round((localX - bayStartX) / 10) * 10));

        const rawY = mod.dimensions.height - svgY - plinthH - carcassT;
        const snappedElevY = Math.max(64, Math.min(netH - 64, Math.round(rawY / 32) * 32));

        const accObj = activeAcc || { id: "lib_shelf", title: "Raf" };
        const isSubDivAcc =
          accObj.id === "lib_sub_divider" ||
          accObj.id === "sub_divider" ||
          accObj.visual === "sub_divider";

        if (isSubDivAcc && mod.bays[targetBayIdx]) {
          const ivs = getBayShelfIntervalsForSubDivider(
            mod.bays[targetBayIdx],
            netH,
            carcassT
          );
          const hoveredIv = ivs.find(
            (iv) => snappedElevY >= iv.botY - 24 && snappedElevY <= iv.topY + 24
          );
          const freeIvs = ivs.filter((iv) => !iv.hasConflict);
          if (hoveredIv?.hasConflict) {
            if (freeIvs.length > 0) {
              const nearestFree = freeIvs.reduce((best, iv) =>
                Math.abs((iv.botY + iv.topY) / 2 - snappedElevY) <
                Math.abs((best.botY + best.topY) / 2 - snappedElevY)
                  ? iv
                  : best
              );
              lastAccessoryDropTarget2DRef.current = {
                bayIndex: targetBayIdx,
                elevationY: Math.round((nearestFree.botY + nearestFree.topY) / 2),
                offsetX: localBayX,
                accessory: accObj,
              };
              setPlanRowSnapBanner(
                `⚠️ Bu aralıkta ${hoveredIv.conflictReason}! Boş raf aralığına (${nearestFree.label}) hizalandı • X: ${localBayX}mm`
              );
            } else {
              lastAccessoryDropTarget2DRef.current = {
                bayIndex: targetBayIdx,
                elevationY: snappedElevY,
                offsetX: localBayX,
                accessory: accObj,
              };
              setPlanRowSnapBanner(
                `⛔ Bölme ${targetBayIdx + 1} içinde ${hoveredIv.conflictReason} ve boş raf aralığı yok! Önce raf ekleyin.`
              );
            }
            return;
          }
        }

        lastAccessoryDropTarget2DRef.current = {
          bayIndex: targetBayIdx,
          elevationY: snappedElevY,
          offsetX: localBayX,
          accessory: accObj,
        };

        setPlanRowSnapBanner(`📐 ${accObj.title || "Aksesuar"} • Bölme ${targetBayIdx + 1} • Y: ${snappedElevY} mm`);
        return;
      }

      const hasMime = e.dataTransfer.types.includes("application/x-birim-template-id");
      const activeTplId = getActiveDraggedTemplateId();
      if (!hasMime && !activeTplId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      const svgEl = e.currentTarget.querySelector("svg");
      const rect = (svgEl || e.currentTarget).getBoundingClientRect();
      const relX = Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)));
      const svgX = vb.x + relX * vb.width;
      const wallLeftSvgX = -activeModOffX;
      const worldX = Math.max(0, Math.round(svgX - wallLeftSvgX));
      const tplId = activeTplId || "v4_kb_01_single_door";
      const preview = computeRowSnapPreview(project, tplId, worldX);
      if (preview) {
        setDragGhostPreview(preview);
        setPlanRowSnapBanner(
          `🧲 CEPHE SİLUET SNAP: ${preview.previewModule.name} (${preview.previewModule.dimensions.width}×${preview.previewModule.dimensions.height}mm) → ${preview.snapLabel}`
        );
      }
    };

    const handleElevDrop = (e: React.DragEvent<HTMLDivElement>) => {
      if (mode !== "elevation") return;
      const activeAcc = typeof window !== "undefined" ? (window as any).__birimActiveDraggedAccessory : null;
      const hasAccessoryMime = e.dataTransfer.types.includes("application/x-birim-accessory-id");

      if (hasAccessoryMime || activeAcc || lastAccessoryDropTarget2DRef.current) {
        e.preventDefault();
        const dropInfo = lastAccessoryDropTarget2DRef.current;
        const acc = dropInfo?.accessory || activeAcc || { id: "lib_shelf", title: "Raf" };
        const bayIdx = dropInfo ? dropInfo.bayIndex : 0;
        const elevY = dropInfo ? dropInfo.elevationY : 400;

        const modBefore = activeModule || project.modules[0];
        const bayBefore = modBefore?.bays[bayIdx];
        const isSubDivDrop =
          acc.id === "lib_sub_divider" ||
          acc.id === "sub_divider" ||
          acc.visual === "sub_divider";
        if (isSubDivDrop && modBefore && bayBefore) {
          const ivs = getBayShelfIntervalsForSubDivider(
            bayBefore,
            calculateNetInnerHeight(modBefore),
            modBefore.carcass.panelThickness || 18
          );
          const freeIvs = ivs.filter((iv) => !iv.hasConflict);
          if (freeIvs.length === 0) {
            setPlanRowSnapBanner(
              `⛔ Bölme ${bayIdx + 1} içinde Askılık/Çekmece var ve boş raf aralığı yok! Önce raf ekleyin veya askılığı kaldırın.`
            );
            setTimeout(() => setPlanRowSnapBanner(null), 4200);
            lastAccessoryDropTarget2DRef.current = null;
            if (typeof window !== "undefined") {
              (window as any).__birimActiveDraggedAccessory = null;
            }
            return;
          }
        }
        addInteriorItemAtElevation(bayIdx, acc.id, elevY, { offsetX: dropInfo?.offsetX });
        setPlanRowSnapBanner(`✓ ${acc.title} yerleştirildi: Bölme ${bayIdx + 1}`);
        setTimeout(() => setPlanRowSnapBanner(null), 3500);

        lastAccessoryDropTarget2DRef.current = null;
        if (typeof window !== "undefined") {
          (window as any).__birimActiveDraggedAccessory = null;
        }
        return;
      }

      const tplId =
        e.dataTransfer.getData("application/x-birim-template-id") ||
        getActiveDraggedTemplateId();
      setDragGhostPreview(null);
      setActiveDraggedTemplateId(null);
      if (!tplId) return;
      e.preventDefault();
      const svgEl = e.currentTarget.querySelector("svg");
      const rect = (svgEl || e.currentTarget).getBoundingClientRect();
      const relX = Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)));
      const svgX = vb.x + relX * vb.width;
      const wallLeftSvgX = -activeModOffX;
      const worldX = Math.max(0, Math.round(svgX - wallLeftSvgX));
      const res = dropV4TemplateWithSnap(tplId, worldX);
      if (res) {
        setPlanRowSnapBanner(`✓ ${res.placedName} → ${res.snapLabel}`);
        setTimeout(() => setPlanRowSnapBanner(null), 3200);
      } else {
        setPlanRowSnapBanner(null);
      }
    };


  return {
    handleElevationPointerMove,
    handleElevationPointerUp,
    findInteriorDragTarget,
    openElevationContextMenu,
    handleElevDragOver,
    handleElevDrop,
  };
}
