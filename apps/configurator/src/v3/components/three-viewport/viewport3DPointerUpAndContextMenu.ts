"use client";

import * as THREE from "three";
import { getEffectiveSpaceWalls } from "../../engine/kitchenSpatialEngine";
import { DEFAULT_MATERIALS } from "../../adapter/useV3Adapter";
import { calculateBayWidths, type MaterialDefinition } from "@birim/core";
import { disposeObject3DTree } from "../../materials/webglResourceGuard";
import { useConfiguratorStore, selectModuleBayComponentSafe } from "../../../store/useConfiguratorStore";
import { applyZoneMaterialToProjectDraft, replaceExistingMaterialAcrossProjectDraft, resolveSmartPaintScopeForClickedRole, type PaintTool3DState } from "../../../v11/quickMaterialAndMoodboardEngine";

import type { CreateViewport3DPointerUpAndContextMenuCtx } from "./viewport3DTypes";

export function createViewport3DPointerUpAndContextMenu(ctx: CreateViewport3DPointerUpAndContextMenuCtx) {
  const {
    flushPendingPointerDragRaf,
    getActiveDrag3D,
    setActiveDrag3D,
    getDownPos,
    setDownPos,
    getRightDownPos,
    setRightDownPos,
    activeModFrameGroupRef, activeTouchPointerIds, canvasRectRef, controlsRef, dimGroupRef, getCachedSolidMeshes, ghostSnapGroupRef, interiorPropsGroupRef, latestStateRef, liveDimDeltaRef, meshGroupRef, minimalChromeRef, needsRenderRef, paintTool3DRef, perspCamRef, pointer, raycaster, rendererRef, restoreHoverPreviewMaterials, roomArchGroupRef, selectionFrameGroupRef, setActive3DSnap, setActiveBrushMaterialId, setClicked3DContext, setContextMenuTarget, setDoorMenuSubSection, setPaintTool3D, setSnapBannerDedup, setWallFocusHighlight, touchLongPress
  } = ctx;
      const handlePointerUp = (e: PointerEvent) => {
        if (e.pointerType === "touch") {
          activeTouchPointerIds.delete(e.pointerId);
          touchLongPress.cancel();
        }
        flushPendingPointerDragRaf();
        let activeDrag3D = getActiveDrag3D();
        let downPos = getDownPos();
        delete document.body.dataset.birimUiDragging;

        const curRenderer = rendererRef.current;
        const curControls = controlsRef.current;
        if (curControls) {
          curControls.enabled = true;
          curControls.enablePan = true;
          curControls.mouseButtons.LEFT = THREE.MOUSE.PAN;
        }

        if (activeDrag3D) {
          const moved = activeDrag3D.hasMoved;
          const dragKind = activeDrag3D.kind;
          const dragModIdx = activeDrag3D.modIdx;
          const dragBayIdx = activeDrag3D.bayIdx;
          const dragTargetId = activeDrag3D.targetId;
          const dragStartX = activeDrag3D.startValueMm;
          const pendingGpuX = activeDrag3D.liveGpuX;
          const pendingGpuY = activeDrag3D.liveGpuY;
          const pendingGpuZ = activeDrag3D.liveGpuZ;
          const pendingTargetWallId = activeDrag3D.liveTargetWallId;
          const pendingTargetRotY = activeDrag3D.liveTargetRotY;
          const pendingSnappedY = activeDrag3D.liveSnappedY;
          const pendingDestModIdx = activeDrag3D.liveDestModIdx;
          const pendingDestBayIdx = activeDrag3D.liveDestBayIdx;
          const pendingSubDivider = activeDrag3D.liveSubDivider;
          activeDrag3D = null; setActiveDrag3D(null);
          setActive3DSnap(null);
          if (curRenderer) {
            curRenderer.domElement.style.cursor = (e.ctrlKey || e.metaKey) ? "move" : "grab";
          }
          if (selectionFrameGroupRef.current) {
            selectionFrameGroupRef.current.position.set(0, 0, 0);
          }
          if (activeModFrameGroupRef.current) {
            activeModFrameGroupRef.current.position.set(0, 0, 0);
          }
          const state = latestStateRef.current;
          if (dragKind === "scene_object_3d") {
            if (moved && (typeof pendingGpuX === "number" || typeof pendingGpuZ === "number")) {
              const curSobj = (state.project.sceneObjects || []).find((o) => o.id === dragTargetId);
              if (curSobj) {
                state.updateSceneObject(dragTargetId, {
                  position: {
                    x: typeof pendingGpuX === "number" ? pendingGpuX : curSobj.position.x,
                    y: curSobj.position.y,
                    z: typeof pendingGpuZ === "number" ? pendingGpuZ : curSobj.position.z,
                  },
                });
              }
            }
            setSnapBannerDedup(null);
            state.commitHistoryTransaction();
          } else if (dragKind === "module_3d" || dragKind === "obstacle_3d") {
            if (dragKind === "module_3d") {
              liveDimDeltaRef.current = { dx: 0, dz: 0 };
              if (!moved) {
                const actDim = dimGroupRef.current?.children.find((c) => c.userData?.isActiveModuleDim);
                if (actDim && actDim.userData.baseOrigin instanceof THREE.Vector3) {
                  actDim.position.copy(actDim.userData.baseOrigin);
                }
              }
            }
            if (ghostSnapGroupRef.current) {
              disposeObject3DTree(ghostSnapGroupRef.current);
              ghostSnapGroupRef.current.clear();
              needsRenderRef.current = true;
            }
            if (dragKind === "obstacle_3d") {
              roomArchGroupRef.current?.traverse((node) => {
                delete node.userData.__dragBaseX;
                delete node.userData.__dragBaseY;
                delete node.userData.__dragBaseZ;
              });
              if (moved && typeof pendingGpuX === "number" && typeof pendingGpuY === "number" && typeof pendingGpuZ === "number") {
                state.updateObstaclePosition(dragTargetId, pendingGpuX, pendingGpuZ, pendingGpuY);
              }
              setSnapBannerDedup(null);
              state.commitHistoryTransaction();
            } else if (dragKind === "module_3d" && moved) {
              if (selectionFrameGroupRef.current) selectionFrameGroupRef.current.visible = true;
              if (activeModFrameGroupRef.current) activeModFrameGroupRef.current.visible = true;
              if (pendingTargetWallId && typeof pendingTargetRotY === "number") {
                const stCross = useConfiguratorStore.getState();
                stCross.applyBatchProjectUpdate((draft) => {
                  const dm = draft.modules[dragModIdx];
                  if (dm) {
                    if (typeof pendingGpuX === "number") dm.position.x = pendingGpuX;
                    if (typeof pendingGpuZ === "number") dm.position.z = pendingGpuZ;
                    dm.rotation = { x: 0, y: pendingTargetRotY, z: 0 };
                  }
                }, "Modül başka duvara taşındı");
                stCross.setActiveWallId(pendingTargetWallId);
                state.commitHistoryTransaction();
                const movedWallName =
                  getEffectiveSpaceWalls(stCross.project).find((w) => w.id === pendingTargetWallId)
                    ?.name || "Hedef Duvar";
                setSnapBannerDedup(`✓ Modül "${movedWallName}" üzerine taşındı`);
                setTimeout(() => setSnapBannerDedup(null), 2800);
                return;
              }
              if (typeof pendingGpuX === "number" || typeof pendingGpuZ === "number") {
                const mCur = state.project.modules[dragModIdx];
                if (mCur) {
                  state.setModulePosition(
                    dragModIdx,
                    typeof pendingGpuX === "number" ? pendingGpuX : mCur.position.x,
                    typeof pendingGpuZ === "number" ? pendingGpuZ : mCur.position.z,
                    1
                  );
                }
              }
              const swapMsg = state.finishModuleDragWithSmartSwap(dragModIdx, dragStartX);
              state.commitHistoryTransaction();
              if (swapMsg) {
                setSnapBannerDedup(swapMsg);
                setTimeout(() => setSnapBannerDedup(null), 2800);
              } else {
                setSnapBannerDedup(null);
              }
            } else {
              state.commitHistoryTransaction();
            }
          } else {
            if (dragKind === "resize_3d" && ghostSnapGroupRef.current) {
              disposeObject3DTree(ghostSnapGroupRef.current);
              ghostSnapGroupRef.current.clear();
              needsRenderRef.current = true;
            }
            // Clear temporary __dragBaseY markers and commit final snapped elevation once on pointerup!
            const modContainer3D = meshGroupRef.current?.children.find(
              (ch) => ch.userData?.moduleIndex === dragModIdx
            );
            if (modContainer3D) {
              for (const child of modContainer3D.children) {
                delete child.userData.__dragBaseX;
                delete child.userData.__dragBaseY;
                delete child.userData.__dragBaseZ;
                delete child.userData.__dragBaseH;
                child.scale.y = 1;
              }
            }
            const modPropsCleanup = interiorPropsGroupRef.current?.children.find(
              (ch) => ch.userData?.moduleIndex === dragModIdx
            );
            if (modPropsCleanup) {
              for (const bayGrp of modPropsCleanup.children) {
                for (const propItem of bayGrp.children) {
                  if (
                    typeof propItem.userData?.__dragBaseY === "number" ||
                    typeof propItem.userData?.__dragBaseX === "number"
                  ) {
                    if (typeof propItem.userData.__dragBaseX === "number") {
                      propItem.position.x = propItem.userData.__dragBaseX;
                      delete propItem.userData.__dragBaseX;
                    }
                    if (typeof propItem.userData.__dragBaseY === "number") {
                      propItem.position.y = propItem.userData.__dragBaseY;
                      delete propItem.userData.__dragBaseY;
                    }
                    if (typeof propItem.userData.__dragBaseZ === "number") {
                      propItem.position.z = propItem.userData.__dragBaseZ;
                      delete propItem.userData.__dragBaseZ;
                    }
                    propItem.updateMatrix();
                  }
                }
              }
              modPropsCleanup.updateMatrixWorld(true);
            }
            if (selectionFrameGroupRef.current) {
              selectionFrameGroupRef.current.visible = true;
            }
            setSnapBannerDedup(null);
            // V51: Cross-Module Interior Component Drop — check if cursor was released over another module & bay!
            let transferredCrossModule = false;
            if (
              moved &&
              curRenderer &&
              meshGroupRef.current &&
              (dragKind === "shelf" || dragKind === "drawer" || dragKind === "rail" || dragKind === "special_fitting" || dragKind === "sub_divider")
            ) {
              const dropRect = canvasRectRef.current && canvasRectRef.current.width > 0 ? canvasRectRef.current : curRenderer.domElement.getBoundingClientRect();
              const dropCam = (curControls?.object as THREE.Camera) || perspCamRef.current;
              if (dropCam && dropRect.width > 0 && dropRect.height > 0) {
                const ndcDrop = new THREE.Vector2(
                  ((e.clientX - dropRect.left) / dropRect.width) * 2 - 1,
                  -((e.clientY - dropRect.top) / dropRect.height) * 2 + 1
                );
                raycaster.setFromCamera(ndcDrop, dropCam);
                const dropHits = raycaster.intersectObjects(meshGroupRef.current.children, true);
                const liveHitOverride =
                  typeof pendingDestModIdx === "number" &&
                  typeof pendingDestBayIdx === "number" &&
                  (pendingDestModIdx !== dragModIdx || pendingDestBayIdx !== dragBayIdx)
                    ? [{ object: { userData: { moduleIndex: pendingDestModIdx, bayIndex: pendingDestBayIdx, componentId: "" } }, point: new THREE.Vector3(0, 0, 0) }]
                    : null;
                for (const dh of (liveHitOverride || dropHits)) {
                  // Skip the dragged component itself & door leaves so we detect the bay/module behind the cursor!
                  const hitCid = String(dh.object?.userData?.componentId || "");
                  const hitRole = String((dh.object?.userData as Record<string, unknown> | undefined)?.role || "");
                  if (hitCid && (hitCid === dragTargetId || hitCid.includes(dragTargetId))) continue;
                  if (hitRole === "door_left" || hitRole === "door_right" || hitRole === "door_handle") continue;
                  const dModIdx = typeof dh.object?.userData?.moduleIndex === "number" ? dh.object.userData.moduleIndex : -1;
                  if (dModIdx >= 0) {
                    const destMod = state.project.modules[dModIdx];
                    if (destMod && destMod.category !== "complementary" && destMod.bays.length > 0) {
                      // Compute exact destination bay from hit point local X (works even when dropping on back panel or across bays of the SAME module!)
                      let dBayIdx =
                        typeof dh.object?.userData?.bayIndex === "number" && dh.object.userData.bayIndex >= 0
                          ? Math.max(0, Math.min(destMod.bays.length - 1, dh.object.userData.bayIndex))
                          : -1;
                      if (!liveHitOverride && (dBayIdx < 0 || destMod.bays.length > 1)) {
                        const rotRad = -((destMod.rotation?.y || 0) * Math.PI) / 180;
                        const dxW = dh.point.x - destMod.position.x;
                        const dzW = dh.point.z - destMod.position.z;
                        const localHitX = dxW * Math.cos(-rotRad) - dzW * Math.sin(-rotRad);
                        const pT = destMod.carcass.panelThickness || 18;
                        const netW = Math.max(100, destMod.dimensions.width - (destMod.bays.length + 1) * pT);
                        const fixedSum = destMod.bays.reduce((acc, b) => acc + (b.customWidth || 0), 0);
                        const autoCount = destMod.bays.filter((b) => !b.customWidth).length;
                        const autoBw = autoCount > 0 ? Math.max(100, (netW - fixedSum) / autoCount) : netW / Math.max(1, destMod.bays.length);
                        let cursorX = pT;
                        for (let bi = 0; bi < destMod.bays.length; bi += 1) {
                          const bw = destMod.bays[bi]?.customWidth || autoBw;
                          if (localHitX >= cursorX - pT && localHitX <= cursorX + bw + pT) {
                            dBayIdx = bi;
                            break;
                          }
                          cursorX += bw + pT;
                        }
                        if (dBayIdx < 0) {
                          dBayIdx = localHitX < destMod.dimensions.width * 0.5 ? 0 : destMod.bays.length - 1;
                        }
                      }
                      if (dModIdx === dragModIdx && dBayIdx === dragBayIdx) {
                        break;
                      }
                      const destPlinth = destMod.carcass.plinthHeight ?? 100;
                      const destT = destMod.carcass.panelThickness || 18;
                      const destMaxY = Math.max(200, destMod.dimensions.height - destPlinth - 2 * destT - 60);
                      const rawDropY = Math.max(64, Math.min(destMaxY, Math.round((dh.point.y - destMod.position.y - destPlinth - destT) / 32) * 32));
                      const targetElevY = typeof pendingSnappedY === "number" ? Math.max(64, Math.min(destMaxY, pendingSnappedY)) : rawDropY;
                      const stStore = useConfiguratorStore.getState();
                      stStore.applyBatchProjectUpdate((draft) => {
                        const srcBay = draft.modules[dragModIdx]?.bays[dragBayIdx];
                        const dstBay = draft.modules[dModIdx]?.bays[dBayIdx];
                        if (!srcBay || !dstBay) return;
                        if (dragKind === "shelf") {
                          const idx = srcBay.shelves.findIndex((s) => s.id === dragTargetId || dragTargetId.includes(s.id));
                          if (idx >= 0) {
                            const [movedItem] = srcBay.shelves.splice(idx, 1);
                            movedItem.elevationY = targetElevY;
                            dstBay.shelves.push(movedItem);
                            transferredCrossModule = true;
                          }
                        } else if (dragKind === "drawer") {
                          const idx = srcBay.drawers.findIndex((d) => d.id === dragTargetId || dragTargetId.includes(d.id));
                          if (idx >= 0) {
                            const [movedItem] = srcBay.drawers.splice(idx, 1);
                            movedItem.elevationY = targetElevY;
                            dstBay.drawers.push(movedItem);
                            transferredCrossModule = true;
                          }
                        } else if (dragKind === "rail") {
                          const idx = srcBay.hangingRails.findIndex((r) => r.id === dragTargetId || dragTargetId.includes(r.id));
                          if (idx >= 0) {
                            const [movedItem] = srcBay.hangingRails.splice(idx, 1);
                            movedItem.elevationY = targetElevY;
                            dstBay.hangingRails.push(movedItem);
                            transferredCrossModule = true;
                          }
                        } else if (dragKind === "special_fitting" && srcBay.specialFittings) {
                          const idx = srcBay.specialFittings.findIndex((f) => f.id === dragTargetId || dragTargetId.includes(f.id));
                          if (idx >= 0) {
                            const [movedItem] = srcBay.specialFittings.splice(idx, 1);
                            movedItem.elevationY = targetElevY;
                            if (!dstBay.specialFittings) dstBay.specialFittings = [];
                            dstBay.specialFittings.push(movedItem);
                            transferredCrossModule = true;
                          }
                        } else if (dragKind === "sub_divider" && srcBay.subDividers) {
                          const idx = srcBay.subDividers.findIndex((sd) => sd.id === dragTargetId || dragTargetId.includes(sd.id));
                          if (idx >= 0) {
                            const [movedItem] = srcBay.subDividers.splice(idx, 1);
                            movedItem.elevationY = targetElevY;
                            if (!dstBay.subDividers) dstBay.subDividers = [];
                            dstBay.subDividers.push(movedItem);
                            transferredCrossModule = true;
                          }
                        }
                      }, "Donanım başka modüle taşındı");
                      if (transferredCrossModule) {
                        stStore.setActiveModuleIndex(dModIdx);
                        stStore.setActiveBayIndex(dBayIdx);
                        setSnapBannerDedup(dModIdx === dragModIdx ? `✓ ${dBayIdx + 1}. Bölmeye taşındı` : `✓ Modül #${dModIdx + 1} · ${dBayIdx + 1}. Bölmeye taşındı`);
                        setTimeout(() => setSnapBannerDedup(null), 2600);
                      }
                    }
                    break;
                  }
                }
              }
            }
            if (!transferredCrossModule && moved && dragKind === "sub_divider" && pendingSubDivider) {
              state.setSubDividerPlacement(dragBayIdx, dragTargetId, pendingSubDivider, false);
              if (
                typeof pendingSubDivider.targetBayIndex === "number" &&
                pendingSubDivider.targetBayIndex !== dragBayIdx
              ) {
                state.setActiveBayIndex(pendingSubDivider.targetBayIndex);
              }
            } else if (!transferredCrossModule && moved && typeof pendingSnappedY === "number") {
              if (dragKind === "shelf") {
                state.setShelfElevation(dragBayIdx, dragTargetId, pendingSnappedY, false);
              } else if (dragKind === "drawer") {
                state.setDrawerPlacement(dragBayIdx, dragTargetId, pendingSnappedY, undefined, false);
              } else if (dragKind === "rail") {
                state.setHangingRailElevation(dragBayIdx, dragTargetId, pendingSnappedY, false);
              } else if (dragKind === "special_fitting") {
                state.setSpecialFittingPlacement?.(
                  dragBayIdx,
                  dragTargetId,
                  { elevationY: pendingSnappedY },
                  false
                );
              }
            }
            state.commitHistoryTransaction();
          }
          if (moved) return;
        }

        const clickTravel = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
        downPos = { x: -99999, y: -99999 };
        if (e.button !== 0) return;
        if (!curRenderer || e.target !== curRenderer.domElement) return;
        if (clickTravel > 8) return;
        const curGroup = meshGroupRef.current;
        if (!curGroup) return;

        const rect =
          canvasRectRef.current && canvasRectRef.current.width > 0
            ? canvasRectRef.current
            : curRenderer.domElement.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        const curCam = (controlsRef.current?.object as THREE.Camera) || perspCamRef.current;
        if (!curCam) return;

        raycaster.setFromCamera(pointer, curCam);
        const state = latestStateRef.current;
        const anyDoorsOpen =
          state.doorsHiddenIn3D ||
          state.doorOpenAngleDeg > 5 ||
          state.project.modules.some(
            (m) =>
              Boolean(m.isOpenFront) ||
              m.bays.some((b) => b.door.type === "open" || b.door.doorSystemId === "open")
          );
        const solidMeshes = getCachedSolidMeshes(curGroup, anyDoorsOpen);
        const hits = raycaster.intersectObjects(solidMeshes, false);
        for (const h of hits) {
          const hitObj = h.object;
          if (hitObj?.userData?.componentId || typeof hitObj?.userData?.moduleIndex === "number") {
            const hitModIdx =
              typeof hitObj.userData.moduleIndex === "number"
                ? hitObj.userData.moduleIndex
                : state.activeModuleIndex;
            const hitMod = state.project.modules[hitModIdx];
            const roleStr = String(hitObj.userData.role || "");

            // Determine bayIndex either from mesh userData or fast O(1) bay widths without full 3D mesh generation!
            let resolvedBayIdx =
              typeof hitObj.userData.bayIndex === "number" ? hitObj.userData.bayIndex : -1;
            if (resolvedBayIdx < 0 && hitMod && hitMod.bays.length > 0) {
              const bayWidths = calculateBayWidths(hitMod);
              const T = hitMod.carcass.panelThickness || 18;
              const localX = h.point.x - hitMod.position.x;
              let accX = T;
              for (let bIdx = 0; bIdx < hitMod.bays.length; bIdx++) {
                const bw = bayWidths[bIdx] || 500;
                if (localX <= accX + bw + T * 0.5 || bIdx === hitMod.bays.length - 1) {
                  resolvedBayIdx = bIdx;
                  break;
                }
                accX += bw + T;
              }
            }

            const rawCompId = String(hitObj.userData.componentId);
            const resolvedCompId =
              roleStr === "door_handle" && hitObj.userData.parentComponentId
                ? String(hitObj.userData.parentComponentId)
                : rawCompId;

            // V15 3B Damlalık (Eyedropper: Alt+Tık veya Damlalık Modu) & 3B Boya Kovası (Paint Bucket: B)
            const activePaintState = paintTool3DRef.current;
            if (activePaintState.mode === "eyedropper" || e.altKey) {
              const sampledDef = hitObj.userData?.matDef as MaterialDefinition | undefined;
              const fallbackMatId =
                sampledDef?.id ||
                (roleStr === "countertop"
                  ? hitMod?.carcass.countertopMaterialId
                  : roleStr.includes("door") || roleStr === "drawer_front"
                  ? hitMod?.carcass.doorMaterialId
                  : hitMod?.carcass.bodyMaterialId) ||
                "mat_veneer_oak";
              const allMats = [...DEFAULT_MATERIALS, ...(state.project.customMaterials || [])];
              const foundMat = allMats.find((m) => m.id === fallbackMatId);
              const nextToolState: PaintTool3DState = {
                ...activePaintState,
                mode: "paint",
                materialId: fallbackMatId,
              };
              setPaintTool3D(nextToolState);
              setActiveBrushMaterialId(fallbackMatId);
              if (typeof window !== "undefined") {
                window.dispatchEvent(
                  new CustomEvent("birim:material-sampled-3d", {
                    detail: {
                      materialId: fallbackMatId,
                      materialName: foundMat?.name || fallbackMatId,
                      moduleIndex: hitModIdx,
                      bayIndex: Math.max(0, resolvedBayIdx),
                      role: roleStr,
                      toolState: nextToolState,
                    },
                  })
                );
              }
              return;
            }

            if (activePaintState.mode === "paint" && activePaintState.materialId) {
              restoreHoverPreviewMaterials();
              const targetMatId = activePaintState.materialId;
              const allMats = [...DEFAULT_MATERIALS, ...(state.project.customMaterials || [])];
              const targetMatDef = allMats.find((m) => m.id === targetMatId);
              const clickedCurMatId =
                (hitObj.userData?.matDef as MaterialDefinition | undefined)?.id ||
                hitMod?.componentMaterialOverrides?.[resolvedCompId] ||
                (roleStr.includes("door") || roleStr === "drawer_front"
                  ? hitMod?.carcass.doorMaterialId
                  : hitMod?.carcass.bodyMaterialId);

              let paintedTargetLabel = targetMatDef?.name || "Malzeme";
              if (
                (e.shiftKey || activePaintState.clickBehavior === "replace_matching_project") &&
                clickedCurMatId
              ) {
                useConfiguratorStore.getState().applyBatchProjectUpdate((draft) => {
                  replaceExistingMaterialAcrossProjectDraft(draft, clickedCurMatId, targetMatId);
                }, `${targetMatDef?.name || "Malzeme"} tüm eşleşen yüzeylere uygulandı`);
                paintedTargetLabel = `${targetMatDef?.name || "Malzeme"} → Tüm Eşleşen Yüzeyler`;
              } else if (e.ctrlKey || e.metaKey || activePaintState.clickBehavior === "clicked_module") {
                useConfiguratorStore.getState().applyBatchProjectUpdate((draft) => {
                  applyZoneMaterialToProjectDraft(draft, hitModIdx, "active_module", targetMatId, allMats);
                }, `${targetMatDef?.name || "Malzeme"} modüle uygulandı`);
                paintedTargetLabel = `${targetMatDef?.name || "Malzeme"} → Tüm Dolap`;
              } else if (activePaintState.clickBehavior === "clicked_part") {
                useConfiguratorStore.getState().applyBatchProjectUpdate((draft) => {
                  const targetDraftMod = draft.modules[hitModIdx];
                  if (!targetDraftMod) return;
                  if (!targetDraftMod.componentMaterialOverrides) {
                    targetDraftMod.componentMaterialOverrides = {};
                  }
                  targetDraftMod.componentMaterialOverrides[resolvedCompId] = targetMatId;
                  targetDraftMod.componentMaterialOverrides[rawCompId] = targetMatId;
                }, `${targetMatDef?.name || "Malzeme"} tek parçaya uygulandı`);
                paintedTargetLabel = `${targetMatDef?.name || "Malzeme"} → Tek Parça`;
              } else {
                // True Surface-Aware Smart Brush Routing: doors paint fronts, side/top/shelf paints carcass!
                const resolvedSmart = resolveSmartPaintScopeForClickedRole(
                  roleStr,
                  activePaintState.zoneScope
                );
                useConfiguratorStore.getState().applyBatchProjectUpdate((draft) => {
                  applyZoneMaterialToProjectDraft(
                    draft,
                    hitModIdx,
                    resolvedSmart.scope,
                    targetMatId,
                    allMats
                  );
                }, `${targetMatDef?.name || "Malzeme"} (${resolvedSmart.surfaceLabelTr})`);
                paintedTargetLabel = `${targetMatDef?.name || "Malzeme"} → ${resolvedSmart.surfaceLabelTr}`;
              }
              if (typeof window !== "undefined") {
                window.dispatchEvent(
                  new CustomEvent("birim:material-painted-3d", {
                    detail: {
                      materialId: targetMatId,
                      materialName: paintedTargetLabel,
                      moduleIndex: hitModIdx,
                    },
                  })
                );
              }
              return;
            }

            // Single atomic Zustand update (instead of 3 sequential setState calls!)
            setWallFocusHighlight(false);
            useConfiguratorStore.getState().setSelectedSceneObjectId(null);
            selectModuleBayComponentSafe({
              activeModuleIndex: hitModIdx,
              ...(resolvedBayIdx >= 0 ? { activeBayIndex: resolvedBayIdx } : {}),
              selectedComponentId: resolvedCompId || null,
            });

            const safeBay = Math.max(0, resolvedBayIdx);

            // Doğrudan 3B donanıma (menteşe, kulp, çekmece rayı, askı borusu) tıklandığında hızlı değiştirme kartını aç
            const directHwGroup: "hinge" | "handle" | "drawer_slide" | "rail" | null =
              roleStr === "door_hinge"
                ? "hinge"
                : roleStr === "door_handle" || roleStr === "drawer_handle"
                ? "handle"
                : roleStr === "drawer_slide"
                ? "drawer_slide"
                : roleStr === "hanging_rail"
                ? "rail"
                : null;
            if (directHwGroup && typeof window !== "undefined") {
              window.dispatchEvent(
                new CustomEvent("birim:select-hardware-3d", {
                  detail: {
                    group: directHwGroup,
                    bayIndex: safeBay,
                    componentId: rawCompId,
                    moduleIndex: hitModIdx,
                  },
                })
              );
            }

            const isDoorHit =
              roleStr === "door" ||
              roleStr.startsWith("door_") ||
              rawCompId.includes("_door_") ||
              resolvedCompId.includes("door_");

            if (isDoorHit && !state.doorsHiddenIn3D) {
              if (!minimalChromeRef.current) {
                const leafSideLabel = resolvedCompId.includes("right") ? "Sağ Kapak" : "Sol Kapak";
                setDoorMenuSubSection(null);
                setClicked3DContext({
                  kind: "door",
                  bayIndex: safeBay,
                  role: roleStr,
                  componentId: resolvedCompId,
                  label: `Bölme ${safeBay + 1} • ${leafSideLabel}`,
                });
              }
              if (typeof window !== "undefined") {
                window.dispatchEvent(
                  new CustomEvent("birim:select-door-3d", {
                    detail: {
                      bayIndex: safeBay,
                      componentId: resolvedCompId,
                      moduleIndex: hitModIdx,
                    },
                  })
                );
              }
            } else {
              if (!minimalChromeRef.current) {
                setClicked3DContext({
                  kind: "bay",
                  bayIndex: safeBay,
                  role: roleStr,
                  label: `Bölme ${safeBay + 1}`,
                });
              }
              if (typeof window !== "undefined") {
                window.dispatchEvent(
                  new CustomEvent("birim:select-bay-3d", {
                    detail: { bayIndex: safeBay, role: roleStr, componentId: resolvedCompId, moduleIndex: hitModIdx },
                  })
                );
              }
            }
            return;
          }
        }
        // If user clicked directly on a 3D Wall (without hitting any cabinet in front), select it as activeWallId!
        if (roomArchGroupRef.current && paintTool3DRef.current.mode === "none") {
          const wallHits = raycaster.intersectObjects(roomArchGroupRef.current.children, true);
          for (const wh of wallHits) {
            if (wh.object?.userData?.isRoomWall && wh.object.userData.wallId) {
              const pickedWallId = String(wh.object.userData.wallId);
              const pickedWallName = String(wh.object.userData.wallName || "Duvar");
              const stWall = useConfiguratorStore.getState();
              if (!stWall.project.space.walls.some((w) => w.id === pickedWallId)) {
                const eff = getEffectiveSpaceWalls(stWall.project);
                if (eff.some((w) => w.id === pickedWallId)) {
                  stWall.applyBatchProjectUpdate((draft) => {
                    draft.space.walls = eff.map((ew) => ({ ...ew, position: { ...ew.position } }));
                  }, "Hedef duvar etkinleştirildi");
                }
              }
              state.setSelectedComponentId(null);
              setClicked3DContext(null);
              setWallFocusHighlight(true);
              useConfiguratorStore.getState().setActiveWallId(pickedWallId);
              setSnapBannerDedup(`✓ Hedef Duvar: ${pickedWallName} — Yeni modüller bu duvara yerleşir`);
              setTimeout(() => setSnapBannerDedup(null), 3200);
              if (typeof window !== "undefined") {
                window.dispatchEvent(
                  new CustomEvent("birim:wall-selected-3d", {
                    detail: { wallId: pickedWallId, wallName: pickedWallName },
                  })
                );
              }
              return;
            }
          }
        }
        state.setSelectedComponentId(null);
        setClicked3DContext(null);
        setWallFocusHighlight(false);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("birim:clear-3d-selection"));
        }
      };

      const handleContextMenu = (e: MouseEvent) => {
        let rightDownPos = getRightDownPos();
        e.preventDefault();
        if (rightDownPos && Math.hypot(e.clientX - rightDownPos.x, e.clientY - rightDownPos.y) > 6) {
          rightDownPos = null; setRightDownPos(null);
          return;
        }
        rightDownPos = null; setRightDownPos(null);
        const curRenderer = rendererRef.current;
        const curGroup = meshGroupRef.current;
        const curRoomGroup = roomArchGroupRef.current;
        const curControls = controlsRef.current;
        if (!curRenderer || !curGroup || !curControls) return;

        const rect = curRenderer.domElement.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        const curCam = (curControls.object as THREE.Camera) || perspCamRef.current;
        if (!curCam) return;

        raycaster.setFromCamera(pointer, curCam);
        const state = latestStateRef.current;
        const anyDoorsOpen =
          state.doorsHiddenIn3D ||
          state.doorOpenAngleDeg > 5 ||
          state.project.modules.some(
            (m) =>
              Boolean(m.isOpenFront) ||
              m.bays.some((b) => b.door.type === "open" || b.door.doorSystemId === "open")
          );
        const solidMeshes = getCachedSolidMeshes(curGroup, anyDoorsOpen);
        const hits = raycaster.intersectObjects(solidMeshes, false);

        if (hits.length > 0 && hits[0].object instanceof THREE.Mesh) {
          const hitMesh = hits[0].object;
          const clickedCompId = String(hitMesh.userData?.componentId || "");
          let modIdx = typeof hitMesh.userData?.moduleIndex === "number" ? hitMesh.userData.moduleIndex : -1;
          if (modIdx < 0) {
            modIdx = state.project.modules.findIndex((m) => clickedCompId.startsWith(m.id));
          }
          if (modIdx >= 0) {
            const mod = state.project.modules[modIdx];
            const bayIndex =
              typeof hitMesh.userData?.bayIndex === "number" ? hitMesh.userData.bayIndex : 0;
            const role = String(hitMesh.userData?.role || "");
            const label = String(hitMesh.userData?.label || mod?.name || "Parça");
            const dimsText = hitMesh.userData?.dimsText ? String(hitMesh.userData.dimsText) : undefined;
            const plinthH = mod?.carcass.plinthHeight ?? 0;
            const T = mod?.carcass.panelThickness || 18;
            const hitElevationY = Math.max(
              64,
              Math.round((hits[0].point.y - ((mod?.position.y || 0) + plinthH + T)) / 32) * 32
            );

            useConfiguratorStore.getState().setSelectedSceneObjectId(null);
            state.setActiveModuleIndex(modIdx);
            state.setActiveBayIndex(bayIndex);
            (state.setSelectedComponentId as (id: string | null, mIdx?: number) => void)(
              clickedCompId || null,
              modIdx
            );
            setContextMenuTarget({
              kind: "component",
              modIdx,
              bayIndex,
              componentId: clickedCompId,
              role,
              label,
              dimsText,
              hitElevationY,
              clientX: e.clientX,
              clientY: e.clientY,
            });
            return;
          }
        }

        if (curRoomGroup) {
          const roomHits = raycaster.intersectObjects(curRoomGroup.children, true);
          for (const rh of roomHits) {
            if (rh.object instanceof THREE.Line || rh.object instanceof THREE.LineSegments) continue;
            let cand: THREE.Object3D | null = rh.object;
            while (cand && !cand.userData?.obstacleId) {
              cand = cand.parent;
            }
            if (cand?.userData?.obstacleId) {
              const obsId = String(cand.userData.obstacleId);
              const obsObj = (state.spaceObstacles || []).find((o) => o.id === obsId);
              setContextMenuTarget({
                kind: "obstacle",
                obstacleId: obsId,
                label: obsObj?.name || obsObj?.type || "Mimari Engel",
                clientX: e.clientX,
                clientY: e.clientY,
              });
              return;
            }
            if (rh.object?.userData?.isRoomWall && rh.object.userData.wallId) {
              setContextMenuTarget({
                kind: "wall",
                wallId: String(rh.object.userData.wallId),
                wallName: String(rh.object.userData.wallName || "Duvar"),
                clientX: e.clientX,
                clientY: e.clientY,
              });
              return;
            }
          }
        }

        setContextMenuTarget({
          kind: "scene",
          clientX: e.clientX,
          clientY: e.clientY,
        });
      };

  return {
    handlePointerUp,
    handleContextMenu,
  };
}
