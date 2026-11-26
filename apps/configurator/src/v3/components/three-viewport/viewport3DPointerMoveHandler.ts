"use client";

import { getBayShelfIntervalsForSubDivider } from "../../adapter/useV3Adapter";
import { resolveModuleHostWallId, wallIntervalToModulePosition, computeRoomDynamicCenter } from "../../engine/multiWallSnapAndBvhEngine";
import * as THREE from "three";
import { getWallRoomBasis } from "../../engine/angledWallSnapEngine";
import { getEffectiveSpaceWalls } from "../../engine/kitchenSpatialEngine";
import { DEFAULT_MATERIALS } from "../../adapter/useV3Adapter";
import { calculateNetInnerHeight, calculateBayWidths, calculateModulePlacement, type MaterialDefinition } from "@birim/core";
import { computeElevationSnapTargets, resolveElevationSnap, snapShelfToMultiHoleOrElevationTargets } from "../../engine/elevationSnapEngine";
import { computeResizeWidthSnap, isKitchenWallModule } from "../../engine/cabinetResizeAndStackEngine";
import { getV3PbrMaterial } from "../../materials/pbrMaterialSystem";
import { disposeObject3DTree } from "../../materials/webglResourceGuard";
import { useConfiguratorStore } from "../../../store/useConfiguratorStore";
import { resolveSmartPaintScopeForClickedRole } from "../../../v11/quickMaterialAndMoodboardEngine";
import { snapSlotActiveRodMat, snapSlotIdleRodMat } from "./viewport3DSharedAssets";
import { add3DRod } from "./viewport3DSceneHelpers";

import type { CreateViewport3DPointerMoveHandlerCtx } from "./viewport3DTypes";

export function createViewport3DPointerMoveHandler(ctx: CreateViewport3DPointerMoveHandlerCtx) {
  const { getActiveDrag3D, activeModFrameGroupRef, activeTouchPointerIds, canvasRectRef, controlsRef, dimGroupRef, engineeringBeaconGroupRef, getCachedSolidMeshes, getHoverEdgesForGeometry, ghostSnapGroupRef, hoverBadgeDomRef, hoverBadgeTextRef, hoverFillMat, hoverFillMesh, hoverOutlineMat, hoverOutlineSegments, hoverOverlayGroup, interiorPropsGroupRef, isOrbitingRef, latestStateRef, liveDimDeltaRef, meshGroupRef, needsRenderRef, paintTool3DRef, perspCamRef, pointer, previewOriginalMatsRef, raycaster, rendererRef, restoreHoverPreviewMaterials, roomArchGroupRef, sceneObjectsGroupRef, selectionFrameGroupRef, setActive3DSnap, setSnapBannerDedup, touchLongPress } = ctx;
      let lastHoverCheckTime = 0;
      let currentHoveredMesh: THREE.Mesh | null = null;
      const setHoverBadgeDirect = (label: string | null) => {
        const badgeEl = hoverBadgeDomRef.current;
        const textEl = hoverBadgeTextRef.current;
        if (!badgeEl || !textEl) return;
        if (label) {
          textEl.textContent = label;
          badgeEl.style.display = "flex";
        } else {
          badgeEl.style.display = "none";
        }
      };

      let dragMoveRafId = 0;
      let latestDragPointerEvent: PointerEvent | null = null;

      const processPointerMoveImmediate = (e: PointerEvent) => {
        const activeDrag3D = getActiveDrag3D();
        const curRenderer = rendererRef.current;
        if (!curRenderer) return;
        if (document.body.dataset.birimUiDragging === "1" && !activeDrag3D) {
          return;
        }

        if (!activeDrag3D) {
          if (isOrbitingRef.current || e.buttons !== 0) {
            if (currentHoveredMesh) {
              currentHoveredMesh = null;
              hoverOverlayGroup.visible = false;
              setHoverBadgeDirect(null);
              needsRenderRef.current = true;
            }
            return;
          }
          if (e.target !== curRenderer.domElement) {
            if (currentHoveredMesh) {
              currentHoveredMesh = null;
              hoverOverlayGroup.visible = false;
              setHoverBadgeDirect(null);
              needsRenderRef.current = true;
            }
            return;
          }
          if (isOrbitingRef.current) return;
          const now = performance.now();
          if (now - lastHoverCheckTime < 110) return;
          lastHoverCheckTime = now;

          const curGroup = meshGroupRef.current;
          const curCam = (controlsRef.current?.object as THREE.Camera) || perspCamRef.current;
          if (!curGroup || !curCam) return;

          const rect = canvasRectRef.current || curRenderer.domElement.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) return;

          pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
          raycaster.setFromCamera(pointer, curCam);

          // Hovering a 3D Red/Amber Engineering Beacon shows immediate clear explanation tooltip!
          if (engineeringBeaconGroupRef.current && engineeringBeaconGroupRef.current.children.length > 0) {
            const bHover = raycaster
              .intersectObjects(engineeringBeaconGroupRef.current.children, false)
              .find((bh) => bh.object?.userData?.isEngineeringBeacon);
            if (bHover) {
              const ud = bHover.object.userData;
              hoverOverlayGroup.visible = false;
              setHoverBadgeDirect(`⚠️ ${ud.findingTitle || "Hata Noktası"} — Açıklama ve çözüm için tıklayın`);
              curRenderer.domElement.style.cursor = "pointer";
              return;
            }
          }

          const st = latestStateRef.current;
          const anyDoorsOpen =
            st.doorsHiddenIn3D ||
            st.doorOpenAngleDeg > 5 ||
            st.project.modules.some(
              (m) =>
                Boolean(m.isOpenFront) ||
                m.bays.some((b) => b.door.type === "open" || b.door.doorSystemId === "open")
            );
          const solidMeshes = getCachedSolidMeshes(curGroup, anyDoorsOpen);
          const hits = raycaster.intersectObjects(solidMeshes, false);

          let hitMesh: THREE.Mesh | null = null;
          for (const h of hits) {
            if (h.object instanceof THREE.Mesh && h.object.userData?.role !== "bay_compartment") {
              hitMesh = h.object;
              break;
            }
          }
          if (!hitMesh && hits.length > 0 && hits[0].object instanceof THREE.Mesh) {
            hitMesh = hits[0].object;
          }

          if (hitMesh !== currentHoveredMesh) {
            currentHoveredMesh = hitMesh;
            if (hitMesh) {
              hitMesh.updateWorldMatrix(true, false);
              // Her elemanı (L-köşe, 45° beşgen, kapsül, silindir, delikli tezgâh vb.) KENDİ GERÇEK 3B FORMUNDA vurgula!
              if (hitMesh.geometry) {
                const wPos = new THREE.Vector3();
                const wQuat = new THREE.Quaternion();
                const wScale = new THREE.Vector3();
                hitMesh.matrixWorld.decompose(wPos, wQuat, wScale);
                if (hoverFillMesh.geometry !== hitMesh.geometry) {
                  hoverFillMesh.geometry = hitMesh.geometry;
                  hoverOutlineSegments.geometry = getHoverEdgesForGeometry(hitMesh.geometry);
                }
                hoverOverlayGroup.position.copy(wPos);
                hoverOverlayGroup.quaternion.copy(wQuat);
                hoverOverlayGroup.scale.copy(wScale);
                hoverOverlayGroup.visible = true;
              }
              const partLabel = String(hitMesh.userData?.label || hitMesh.userData?.role || "Parça");
              const dimsTxt = hitMesh.userData?.dimsText ? ` (${hitMesh.userData.dimsText})` : "";
              const bayTxt =
                typeof hitMesh.userData?.bayIndex === "number"
                  ? `Bölme ${hitMesh.userData.bayIndex + 1} • `
                  : "";
              const hoverTool = paintTool3DRef.current;
              if (hoverTool.mode === "eyedropper" || e.altKey) {
                const sMat = hitMesh.userData?.matDef as MaterialDefinition | undefined;
                hoverOutlineMat.color.setHex(0x2563eb);
                hoverFillMat.color.setHex(0x3b82f6);
                setHoverBadgeDirect(
                  `Damlalık: ${sMat?.name || partLabel} — Fırçaya kopyalamak için tıklayın`
                );
                curRenderer.domElement.style.cursor = "cell";
              } else if (hoverTool.mode === "paint") {
                const allMatsH = [...DEFAULT_MATERIALS, ...(st.project.customMaterials || [])];
                const brushDef = allMatsH.find((m) => m.id === hoverTool.materialId);
                const roleHover = String(hitMesh.userData?.role || "");
                const hModIdx =
                  typeof hitMesh.userData?.moduleIndex === "number"
                    ? hitMesh.userData.moduleIndex
                    : st.activeModuleIndex;
                hoverOutlineMat.color.setHex(0xea580c);
                hoverFillMat.color.setHex(0xf97316);
                restoreHoverPreviewMaterials();
                if (brushDef) {
                  if (hoverTool.clickBehavior === "clicked_part") {
                    let compNode: THREE.Object3D | null = hitMesh;
                    while (compNode && !compNode.userData?.componentId && compNode.parent) {
                      compNode = compNode.parent;
                    }
                    const pMat = getV3PbrMaterial(
                      brushDef,
                      false,
                      roleHover.includes("handle") || roleHover === "gola_profile",
                      "lengthwise",
                      st.project.modules[hModIdx]?.surfaceFinishOverride
                    );
                    if (!previewOriginalMatsRef.current.has(hitMesh)) {
                      previewOriginalMatsRef.current.set(hitMesh, hitMesh.material);
                    }
                    hitMesh.material = pMat;
                    setHoverBadgeDirect(
                      `Fırça (Tek Parça): ${partLabel} → ${brushDef.name}`
                    );
                  } else {
                    const smartHover =
                      hoverTool.clickBehavior === "clicked_module"
                        ? { scope: "active_module" as const, surfaceLabelTr: "Bu Dolabın Tümü" }
                        : resolveSmartPaintScopeForClickedRole(roleHover, hoverTool.zoneScope);
                    window.dispatchEvent(
                      new CustomEvent("birim:preview-material-3d", {
                        detail: {
                          materialId: brushDef.id,
                          scope: smartHover.scope,
                          activeModuleIndex: hModIdx,
                          ...(hoverTool.clickBehavior === "replace_matching_project" &&
                          hitMesh.userData?.matDef?.id
                            ? { replaceFromMaterialId: String(hitMesh.userData.matDef.id) }
                            : {}),
                        },
                      })
                    );
                    setHoverBadgeDirect(
                      `Fırça: ${smartHover.surfaceLabelTr} → ${brushDef.name}`
                    );
                  }
                }
                curRenderer.domElement.style.cursor = "crosshair";
              } else {
                hoverOutlineMat.color.setHex(0x0284c7);
                hoverFillMat.color.setHex(0x0ea5e9);
                setHoverBadgeDirect(`${bayTxt}${partLabel}${dimsTxt}`);
                curRenderer.domElement.style.cursor = e.ctrlKey || e.metaKey ? "move" : "pointer";
              }
            } else {
              if (paintTool3DRef.current.mode === "paint") {
                restoreHoverPreviewMaterials();
              }
              hoverOverlayGroup.visible = false;
              // Check if hovering over a selectable 3D Room Wall!
              let hoveredWallName: string | null = null;
              let hoveredWallId: string | null = null;
              if (roomArchGroupRef.current && paintTool3DRef.current.mode === "none") {
                const wHits = raycaster.intersectObjects(roomArchGroupRef.current.children, true);
                for (const wh of wHits) {
                  if (wh.object?.userData?.isRoomWall && wh.object.userData.wallId) {
                    hoveredWallId = String(wh.object.userData.wallId);
                    hoveredWallName = String(wh.object.userData.wallName || "Duvar");
                    break;
                  }
                }
              }
              if (hoveredWallId && hoveredWallName) {
                const curActW = useConfiguratorStore.getState().activeWallId || "wall_main";
                setHoverBadgeDirect(
                  curActW === hoveredWallId
                    ? `✓ Seçili Hedef Duvar: ${hoveredWallName}`
                    : `Hedef Duvar Seç: ${hoveredWallName} — Modül/obje yerleştirmek için tıklayın`
                );
                curRenderer.domElement.style.cursor = "pointer";
              } else {
                setHoverBadgeDirect(null);
                curRenderer.domElement.style.cursor =
                  paintTool3DRef.current.mode === "paint"
                    ? "crosshair"
                    : paintTool3DRef.current.mode === "eyedropper"
                    ? "cell"
                    : e.ctrlKey || e.metaKey
                    ? "move"
                    : "grab";
              }
            }
            needsRenderRef.current = true;
          }
          return;
        }
        hoverOverlayGroup.visible = false;
        curRenderer.domElement.style.cursor = "grabbing";
        const dxPx = e.clientX - activeDrag3D.startClientX;
        const dyPx = e.clientY - activeDrag3D.startClientY;
        if (!activeDrag3D.hasMoved && Math.hypot(dxPx, dyPx) < 4) return;
        activeDrag3D.hasMoved = true;

        const state = latestStateRef.current;

        if (activeDrag3D.kind === "scene_object_3d") {
          const curCam = (controlsRef.current?.object as THREE.Camera) || perspCamRef.current;
          // Camera-oriented horizontal XZ fallback (always moves strictly along screen right/forward from ANY orbit angle!)
          let deltaX = dxPx * activeDrag3D.mmPerPx;
          let deltaZ = dyPx * activeDrag3D.mmPerPx;
          if (curCam) {
            const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(curCam.quaternion);
            camRight.y = 0;
            if (camRight.lengthSq() > 1e-6) camRight.normalize();
            const camFwd = new THREE.Vector3(0, 0, -1).applyQuaternion(curCam.quaternion);
            camFwd.y = 0;
            if (camFwd.lengthSq() > 1e-6) camFwd.normalize();
            deltaX = (camRight.x * dxPx - camFwd.x * dyPx) * activeDrag3D.mmPerPx;
            deltaZ = (camRight.z * dxPx - camFwd.z * dyPx) * activeDrag3D.mmPerPx;
          }
          // Exact horizontal floor-plane raycast using cached viewport rect (zero drag layout reflow)
          if (curRenderer && curCam && activeDrag3D.startPlaneHit) {
            const rect =
              canvasRectRef.current && canvasRectRef.current.width > 0
                ? canvasRectRef.current
                : curRenderer.domElement.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              const curNdcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
              const curNdcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
              raycaster.setFromCamera(new THREE.Vector2(curNdcX, curNdcY), curCam);
              const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -activeDrag3D.startPlaneHit.y);
              const curHit = new THREE.Vector3();
              if (raycaster.ray.intersectPlane(floorPlane, curHit)) {
                const rawDx = curHit.x - activeDrag3D.startPlaneHit.x;
                const rawDz = curHit.z - activeDrag3D.startPlaneHit.z;
                if (Math.abs(rawDx) < 9000 && Math.abs(rawDz) < 9000) {
                  deltaX = rawDx;
                  deltaZ = rawDz;
                }
              }
            }
          }
          const nextX = Math.round((activeDrag3D.startValueMm + deltaX) / 10) * 10;
          const nextZ = Math.round(((activeDrag3D.startThirdValueMm || 0) + deltaZ) / 10) * 10;
          activeDrag3D.liveGpuX = nextX;
          activeDrag3D.liveGpuZ = nextZ;
          const sobjNode = sceneObjectsGroupRef.current?.children.find(
            (ch) => ch.userData?.sceneObjectId === activeDrag3D?.targetId
          );
          if (sobjNode) {
            sobjNode.position.set(nextX, activeDrag3D.startSecondValueMm || 0, nextZ);
            needsRenderRef.current = true;
          }
          setSnapBannerDedup(`✋ Sahne Objesi Taşınıyor: X:${nextX}mm • Z:${nextZ}mm`);
          return;
        }

        if (activeDrag3D.kind === "obstacle_3d") {
          let deltaX = dxPx * activeDrag3D.mmPerPx;
          let deltaZ = -dxPx * activeDrag3D.mmPerPx;
          let deltaY = -dyPx * activeDrag3D.mmPerPx;

          const curCam = (controlsRef.current?.object as THREE.Camera) || perspCamRef.current;
          if (curRenderer && curCam && activeDrag3D.dragPlane && activeDrag3D.startPlaneHit) {
            const rect = canvasRectRef.current || curRenderer.domElement.getBoundingClientRect();
            const curNdcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            const curNdcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(new THREE.Vector2(curNdcX, curNdcY), curCam);
            const curHit = new THREE.Vector3();
            if (raycaster.ray.intersectPlane(activeDrag3D.dragPlane, curHit)) {
              const rawDx = curHit.x - activeDrag3D.startPlaneHit.x;
              const rawDz = curHit.z - activeDrag3D.startPlaneHit.z;
              const rawDy = curHit.y - activeDrag3D.startPlaneHit.y;
              if (Math.abs(rawDx) < 9000 && Math.abs(rawDz) < 9000 && Math.abs(rawDy) < 6000) {
                deltaX = rawDx;
                deltaZ = rawDz;
                deltaY = rawDy;
              }
            }
          }

          const nextY = Math.max(
            0,
            Math.round(((activeDrag3D.startSecondValueMm || 0) + deltaY) / 10) * 10
          );
          const nextX = activeDrag3D.isSideWallObs
            ? activeDrag3D.startValueMm
            : Math.max(0, Math.round((activeDrag3D.startValueMm + deltaX) / 10) * 10);
          const nextZ = activeDrag3D.isSideWallObs
            ? Math.max(0, Math.round(((activeDrag3D.startThirdValueMm || 0) + deltaZ) / 10) * 10)
            : activeDrag3D.startThirdValueMm || 0;

          activeDrag3D.liveGpuX = nextX;
          activeDrag3D.liveGpuY = nextY;
          activeDrag3D.liveGpuZ = nextZ;

          let movedOnGpu = false;
          roomArchGroupRef.current?.traverse((node) => {
            if (node.userData?.obstacleId === activeDrag3D?.targetId && node.parent?.userData?.obstacleId !== activeDrag3D?.targetId) {
              if (typeof node.userData.__dragBaseX !== "number") {
                node.userData.__dragBaseX = node.position.x;
                node.userData.__dragBaseY = node.position.y;
                node.userData.__dragBaseZ = node.position.z;
              }
              node.position.set(
                (node.userData.__dragBaseX as number) + (nextX - activeDrag3D!.startValueMm),
                (node.userData.__dragBaseY as number) + (nextY - (activeDrag3D!.startSecondValueMm || 0)),
                (node.userData.__dragBaseZ as number) + (nextZ - (activeDrag3D!.startThirdValueMm || 0))
              );
              movedOnGpu = true;
            }
          });
          if (movedOnGpu) {
            needsRenderRef.current = true;
          } else {
            state.updateObstaclePosition(activeDrag3D.targetId, nextX, nextZ, nextY);
          }
          setSnapBannerDedup(
            activeDrag3D.isSideWallObs
              ? `🎯 Yan Duvar Pencere/Engel Taşınıyor: Z:${nextZ}mm • Yükseklik Kotu Y:${nextY}mm`
              : `🎯 3D Pencere/Engel Taşınıyor: X:${nextX}mm • Yükseklik Kotu Y:${nextY}mm`
          );
          return;
        }

        if (activeDrag3D.kind === "module_3d") {
          // V41: Wall-to-Wall 3D Dragging! Raycast against all room walls so Ctrl+Drag smoothly transfers a module across walls (0°/90°/180°/270°)!
          const curRendererW = rendererRef.current;
          const curCamW = (controlsRef.current?.object as THREE.Camera) || perspCamRef.current;
          const dragModW = state.project.modules[activeDrag3D.modIdx];
          const effWallsW = getEffectiveSpaceWalls(state.project);
          if (
            curRendererW &&
            curCamW &&
            dragModW &&
            roomArchGroupRef.current &&
            effWallsW.length > 1
          ) {
            const rectW =
              canvasRectRef.current && canvasRectRef.current.width > 0
                ? canvasRectRef.current
                : curRendererW.domElement.getBoundingClientRect();
            const ndcXW = ((e.clientX - rectW.left) / rectW.width) * 2 - 1;
            const ndcYW = -((e.clientY - rectW.top) / rectW.height) * 2 + 1;
            const wallRc = new THREE.Raycaster();
            wallRc.setFromCamera(new THREE.Vector2(ndcXW, ndcYW), curCamW);
            const wallHits = wallRc.intersectObjects(roomArchGroupRef.current.children, true);
            const wallHit = wallHits.find(
              (wh) => wh.object?.userData?.isRoomWall && wh.object.userData.wallId
            );
            if (wallHit) {
              const hitWallId = String(wallHit.object.userData.wallId);
              const hitWall = effWallsW.find((w) => w.id === hitWallId);
              const origHostWallId = resolveModuleHostWallId(state.project, dragModW);
              if (hitWall && (hitWallId !== origHostWallId || activeDrag3D.liveTargetWallId)) {
                const roomCenterW = computeRoomDynamicCenter(effWallsW);
                const wb = getWallRoomBasis(hitWall, roomCenterW);
                const rawAlong =
                  (wallHit.point.x - wb.p0.x) * wb.rawTangent.x +
                  (wallHit.point.z - wb.p0.z) * wb.rawTangent.z -
                  dragModW.dimensions.width * 0.5;
                const clampedAlong = Math.max(
                  0,
                  Math.min(
                    Math.max(0, hitWall.length - dragModW.dimensions.width),
                    Math.round(rawAlong / 10) * 10
                  )
                );
                const solvedPos = wallIntervalToModulePosition(
                  hitWall,
                  clampedAlong,
                  dragModW.dimensions.width,
                  dragModW.dimensions.depth,
                  roomCenterW
                );
                activeDrag3D.liveGpuX = solvedPos.x;
                activeDrag3D.liveGpuZ = solvedPos.z;
                activeDrag3D.liveTargetWallId = hitWallId;
                activeDrag3D.liveTargetRotY = solvedPos.rotationYDeg;

                const modObj3DW = meshGroupRef.current?.children.find(
                  (ch) => ch.userData?.moduleIndex === activeDrag3D?.modIdx
                );
                if (modObj3DW) {
                  const previewMod = {
                    ...dragModW,
                    position: { x: solvedPos.x, y: dragModW.position.y, z: solvedPos.z },
                    rotation: { x: 0, y: solvedPos.rotationYDeg, z: 0 },
                  };
                  const placed3D = calculateModulePlacement(previewMod);
                  modObj3DW.position.set(placed3D.origin.x, dragModW.position.y, placed3D.origin.z);
                  modObj3DW.rotation.y = (solvedPos.rotationYDeg * Math.PI) / 180;
                  const propNodeW = interiorPropsGroupRef.current?.children.find(
                    (ch) => ch.userData?.moduleIndex === activeDrag3D?.modIdx
                  );
                  if (propNodeW) {
                    propNodeW.position.copy(modObj3DW.position);
                    propNodeW.rotation.copy(modObj3DW.rotation);
                    propNodeW.updateMatrix();
                    propNodeW.updateMatrixWorld(true);
                  }
                  if (selectionFrameGroupRef.current) selectionFrameGroupRef.current.visible = false;
                  if (activeModFrameGroupRef.current) activeModFrameGroupRef.current.visible = false;
                  needsRenderRef.current = true;
                }
                setSnapBannerDedup(
                  `🧲 Duvardan Duvara Taşıma → "${hitWall.name}" (Konum: ${clampedAlong} mm • ${solvedPos.rotationYDeg}°)`
                );
                return;
              }
            }
          }

          // Compute true 3D raycast delta along the wall plane (with screen-space fallback for side angles)
          let dxMm = dxPx * activeDrag3D.mmPerPx;
          const curRenderer = rendererRef.current;
          const curCam = (controlsRef.current?.object as THREE.Camera) || perspCamRef.current;
          if (curRenderer && curCam) {
            const rect =
              canvasRectRef.current && canvasRectRef.current.width > 0
                ? canvasRectRef.current
                : curRenderer.domElement.getBoundingClientRect();
            const startNdcX = ((activeDrag3D.startClientX - rect.left) / rect.width) * 2 - 1;
            const startNdcY = -((activeDrag3D.startClientY - rect.top) / rect.height) * 2 + 1;
            const curNdcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            const curNdcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            const wallPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -300);
            const rcStart = new THREE.Raycaster();
            const rcCur = new THREE.Raycaster();
            rcStart.setFromCamera(new THREE.Vector2(startNdcX, startNdcY), curCam);
            rcCur.setFromCamera(new THREE.Vector2(curNdcX, curNdcY), curCam);
            const ptStart = new THREE.Vector3();
            const ptCur = new THREE.Vector3();
            if (
              rcStart.ray.intersectPlane(wallPlane, ptStart) &&
              rcCur.ray.intersectPlane(wallPlane, ptCur) &&
              Math.abs(ptCur.x - ptStart.x) < 8000
            ) {
              dxMm = ptCur.x - ptStart.x;
            }
          }

          const dragModObj = state.project.modules[activeDrag3D.modIdx];
          const isRotated90Mod =
            (((dragModObj?.rotation?.y || 0) % 360) + 360) % 360 === 90 ||
            (((dragModObj?.rotation?.y || 0) % 360) + 360) % 360 === 270;
          if (isRotated90Mod) {
            let dzMm = -dxPx * activeDrag3D.mmPerPx;
            if (curRenderer && curCam && activeDrag3D.dragPlane && activeDrag3D.startPlaneHit) {
              const rect =
                canvasRectRef.current && canvasRectRef.current.width > 0
                  ? canvasRectRef.current
                  : curRenderer.domElement.getBoundingClientRect();
              const curNdcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
              const curNdcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
              const rc = new THREE.Raycaster();
              rc.setFromCamera(new THREE.Vector2(curNdcX, curNdcY), curCam);
              const curHit = new THREE.Vector3();
              if (
                rc.ray.intersectPlane(activeDrag3D.dragPlane, curHit) &&
                Math.abs(curHit.z - activeDrag3D.startPlaneHit.z) < 8000
              ) {
                dzMm = curHit.z - activeDrag3D.startPlaneHit.z;
              }
            }
            const nextZ = Math.max(
              0,
              Math.round(((activeDrag3D.startSecondValueMm || 0) + dzMm) / 10) * 10
            );
            setSnapBannerDedup(`✋ 3D Köşe/Yan Modül Taşınıyor: Z: ${nextZ}mm`);
            activeDrag3D.liveGpuX = activeDrag3D.startValueMm;
            activeDrag3D.liveGpuZ = nextZ;
            const modObj3DRot = meshGroupRef.current?.children.find(
              (ch) => ch.userData?.moduleIndex === activeDrag3D?.modIdx
            );
            if (modObj3DRot && dragModObj) {
              const deltaLiveZ = nextZ - dragModObj.position.z;
              const baseOrigin = calculateModulePlacement(dragModObj).origin;
              modObj3DRot.position.set(baseOrigin.x, dragModObj.position.y, baseOrigin.z + deltaLiveZ);
              const propNodeRot = interiorPropsGroupRef.current?.children.find(
                (ch) => ch.userData?.moduleIndex === activeDrag3D?.modIdx
              );
              if (propNodeRot) {
                propNodeRot.position.copy(modObj3DRot.position);
                propNodeRot.updateMatrix();
                propNodeRot.updateMatrixWorld(true);
              }
              if (selectionFrameGroupRef.current) selectionFrameGroupRef.current.position.set(0, 0, deltaLiveZ);
              if (activeModFrameGroupRef.current) activeModFrameGroupRef.current.position.set(0, 0, deltaLiveZ);
              liveDimDeltaRef.current = { dx: 0, dz: deltaLiveZ };
              needsRenderRef.current = true;
            } else {
              state.setModulePosition(activeDrag3D.modIdx, activeDrag3D.startValueMm, nextZ, 1);
            }
            return;
          }
          const rawNextX = Math.max(0, activeDrag3D.startValueMm + dxMm);
          let nextX = Math.round(rawNextX / 10) * 10;
          let lockedSnapX: number | null = null;
          let snapText = `✋ 3D Modül Taşınıyor: X: ${nextX}mm (Diğer modülün üzerine bırakırsanız yer değiştirir • Alt: Serbest)`;

          const dragMod = state.project.modules[activeDrag3D.modIdx];
          if (dragMod && !e.altKey) {
            const dragW = dragMod.dimensions.width;
            if (rawNextX <= 22 && (activeDrag3D.startValueMm > 6 || dxMm <= 0)) {
              nextX = 0;
              lockedSnapX = 0;
              snapText = "🧲 Duvar Başlangıcına Snap (X: 0mm)";
            }
            state.project.modules.forEach((other, oIdx) => {
              if (oIdx === activeDrag3D?.modIdx || other.category === "complementary") return;
              const otherRight = other.position.x + other.dimensions.width;
              const otherLeft = other.position.x;
              const startedAtRight = Math.abs((activeDrag3D?.startValueMm || 0) - otherRight) <= 6;
              const startedAtLeft = Math.abs((activeDrag3D?.startValueMm || 0) + dragW - otherLeft) <= 6;
              if (dragMod.category === "complementary" && Math.abs(rawNextX - otherLeft) <= 35) {
                nextX = otherLeft;
                lockedSnapX = otherLeft;
                snapText = `🧲 ${oIdx + 1}. Modül Hizasına Entegre Snap (X: ${otherLeft}mm)`;
              } else if ((!startedAtRight || Math.abs(dxMm) <= 4) && Math.abs(rawNextX - otherRight) <= 28) {
                nextX = otherRight;
                lockedSnapX = otherRight;
                snapText = `🧲 ${oIdx + 1}. Modül Sağına Snap (X: ${otherRight}mm)`;
              } else if (
                (!startedAtLeft || Math.abs(dxMm) <= 4) &&
                Math.abs(rawNextX + dragW - otherLeft) <= 28 &&
                otherLeft - dragW >= 0
              ) {
                nextX = otherLeft - dragW;
                lockedSnapX = otherLeft;
                snapText = `🧲 ${oIdx + 1}. Modül Soluna Snap (X: ${nextX}mm)`;
              }
            });
          }

          // Render live 3D Vertical Magnetic Snap Laser Lines in ghostSnapGroupRef while dragging module in 3D!
          if (ghostSnapGroupRef.current && dragMod) {
            const gGroup = ghostSnapGroupRef.current;
            disposeObject3DTree(gGroup);
            gGroup.clear();
            const snapXs = [
              0,
              ...state.project.modules.flatMap((m, i) =>
                i === activeDrag3D?.modIdx || m.category === "complementary"
                  ? []
                  : [m.position.x, m.position.x + m.dimensions.width]
              ),
            ];
            snapXs.forEach((sx) => {
              const isLocked = lockedSnapX === sx;
              add3DRod(
                gGroup,
                new THREE.Vector3(sx, 0, 0),
                new THREE.Vector3(sx, dragMod.dimensions.height + 240, 0),
                isLocked ? 7 : 3.5,
                isLocked ? snapSlotActiveRodMat : snapSlotIdleRodMat
              );
              add3DRod(
                gGroup,
                new THREE.Vector3(sx, 0, dragMod.dimensions.depth),
                new THREE.Vector3(sx, dragMod.dimensions.height + 240, dragMod.dimensions.depth),
                isLocked ? 7 : 3.5,
                isLocked ? snapSlotActiveRodMat : snapSlotIdleRodMat
              );
            });
          }

          setSnapBannerDedup(snapText);
          if (dragMod) {
            const targetZ = activeDrag3D.startSecondValueMm || 0;
            (activeDrag3D as { liveGpuX?: number; liveGpuZ?: number }).liveGpuX = nextX;
            (activeDrag3D as { liveGpuX?: number; liveGpuZ?: number }).liveGpuZ = targetZ;
            const modObj3D = meshGroupRef.current?.children.find(
              (ch) => ch.userData?.moduleIndex === activeDrag3D?.modIdx
            );
            if (modObj3D) {
              // Direct 0ms GPU transform during drag — commits to Zustand store on pointerup!
              const deltaLiveX = nextX - dragMod.position.x;
              const deltaLiveZ = targetZ - dragMod.position.z;
              const baseOrigin = calculateModulePlacement(dragMod).origin;
              modObj3D.position.set(
                baseOrigin.x + deltaLiveX,
                dragMod.position.y,
                baseOrigin.z + deltaLiveZ
              );
              const propNode3D = interiorPropsGroupRef.current?.children.find(
                (ch) => ch.userData?.moduleIndex === activeDrag3D?.modIdx
              );
              if (propNode3D) {
                propNode3D.position.copy(modObj3D.position);
                propNode3D.updateMatrix();
                propNode3D.updateMatrixWorld(true);
              }
              if (selectionFrameGroupRef.current) {
                selectionFrameGroupRef.current.position.set(deltaLiveX, 0, deltaLiveZ);
              }
              if (activeModFrameGroupRef.current) {
                activeModFrameGroupRef.current.position.set(deltaLiveX, 0, deltaLiveZ);
              }
              const actDim = dimGroupRef.current?.children.find((c) => c.userData?.isActiveModuleDim);
              if (actDim && actDim.userData.baseOrigin instanceof THREE.Vector3) {
                const base = actDim.userData.baseOrigin as THREE.Vector3;
                actDim.position.set(base.x + deltaLiveX, base.y, base.z + deltaLiveZ);
              }
              liveDimDeltaRef.current = { dx: deltaLiveX, dz: deltaLiveZ };
              needsRenderRef.current = true;
            } else if (nextX !== dragMod.position.x || targetZ !== dragMod.position.z) {
              state.setModulePosition(activeDrag3D.modIdx, nextX, targetZ, 1);
            }
          }
          return;
        }

        if (activeDrag3D.kind === "resize_3d") {
          const rMod = state.project.modules[activeDrag3D.modIdx];
          if (!rMod) return;
          const rAxis = activeDrag3D.targetId;
          const curCamR = (controlsRef.current?.object as THREE.Camera) || perspCamRef.current;
          let worldDelta = new THREE.Vector3(0, 0, 0);
          if (curRenderer && curCamR && activeDrag3D.dragPlane && activeDrag3D.startPlaneHit) {
            const rectR = canvasRectRef.current && canvasRectRef.current.width > 0 ? canvasRectRef.current : curRenderer.domElement.getBoundingClientRect();
            const ndcR = new THREE.Vector2(
              ((e.clientX - rectR.left) / rectR.width) * 2 - 1,
              -((e.clientY - rectR.top) / rectR.height) * 2 + 1
            );
            raycaster.setFromCamera(ndcR, curCamR);
            const curHitR = new THREE.Vector3();
            if (raycaster.ray.intersectPlane(activeDrag3D.dragPlane, curHitR)) {
              worldDelta.subVectors(curHitR, activeDrag3D.startPlaneHit);
            }
          }
          const rotRad = -((rMod.rotation?.y || 0) * Math.PI) / 180;
          const localRight = new THREE.Vector3(Math.cos(rotRad), 0, -Math.sin(rotRad));
          const deltaAlongX = worldDelta.dot(localRight);

          if (rAxis === "height_top") {
            let nextH = Math.max(300, Math.min(2800, Math.round((activeDrag3D.startValueMm + worldDelta.y) / 10) * 10));
            const ceilH = state.project.space.ceilingHeight || 2700;
            if (Math.abs(rMod.position.y + nextH - ceilH) <= 35) nextH = ceilH - rMod.position.y;
            state.project.modules.forEach((other, oi) => {
              if (oi === activeDrag3D?.modIdx) return;
              const oTop = other.position.y + other.dimensions.height;
              if (Math.abs(rMod.position.y + nextH - oTop) <= 35) {
                nextH = Math.max(300, Math.min(2800, oTop - rMod.position.y));
              }
            });
            if (nextH !== rMod.dimensions.height) {
              state.resizeModuleParametric(activeDrag3D.modIdx, rMod.dimensions.width, undefined, undefined, nextH);
            }
            setSnapBannerDedup(`↕ Yükseklik: ${nextH} mm`);
          } else if (rAxis === "depth_front") {
            const localFront = new THREE.Vector3(Math.sin(rotRad), 0, Math.cos(rotRad));
            const deltaAlongZ = worldDelta.dot(localFront);
            let nextD = Math.max(240, Math.min(1200, Math.round((activeDrag3D.startValueMm + deltaAlongZ) / 10) * 10));
            const rIsWall = isKitchenWallModule(rMod);
            let bestDepthDist = 31;
            let snappedDepthName: string | null = null;
            if (!e.altKey) {
              state.project.modules.forEach((other, oi) => {
                if (oi === activeDrag3D?.modIdx || other.category === "complementary") return;
                if (Math.abs((other.rotation?.y || 0) - (rMod.rotation?.y || 0)) > 5) return;
                // Kitchen wall cabinets snap depth to other wall cabinets, not deep base cabinets
                if (rIsWall !== isKitchenWallModule(other)) return;
                const dDist = Math.abs(nextD - other.dimensions.depth);
                if (dDist <= 30 && dDist < bestDepthDist) {
                  bestDepthDist = dDist;
                  nextD = Math.max(240, Math.min(1200, other.dimensions.depth));
                  snappedDepthName = other.name;
                }
              });
            }
            if (nextD !== rMod.dimensions.depth) {
              state.resizeModuleParametric(activeDrag3D.modIdx, rMod.dimensions.width, undefined, nextD);
            }
            setSnapBannerDedup(
              snappedDepthName
                ? `🧲 Derinlik ${snappedDepthName} ile Eşitlendi: ${nextD} mm`
                : `↔ Derinlik: ${nextD} mm`
            );
          } else if (rAxis === "width_right" || rAxis === "width_left") {
            const startW = activeDrag3D.startValueMm;
            const startX = activeDrag3D.startSecondValueMm ?? rMod.position.x;
            const rawW = rAxis === "width_right" ? startW + deltaAlongX : startW - deltaAlongX;
            const widthSnap = computeResizeWidthSnap({
              modules: state.project.modules,
              activeModIdx: activeDrag3D.modIdx,
              axis: rAxis,
              rawWidthMm: rawW,
              startX,
              startW,
              minW: 250,
              maxW: 3600,
              toleranceMm: 35,
              disableSnap: e.altKey,
            });
            const nextW = widthSnap.width;
            const nextX = widthSnap.positionX;
            // Render live 3D Vertical Magnetic Snap Laser Lines during 3D width resize
            if (ghostSnapGroupRef.current) {
              const gGroup = ghostSnapGroupRef.current;
              disposeObject3DTree(gGroup);
              gGroup.clear();
              const laserTopY = Math.max(rMod.position.y + rMod.dimensions.height + 240, 2200);
              const laserDepth = Math.max(rMod.dimensions.depth, 350);
              widthSnap.candidateLinesX.forEach((sx) => {
                const isLocked = widthSnap.snappedEdgeX === sx;
                if (!isLocked && Math.abs(sx - (rAxis === "width_right" ? nextX + nextW : nextX)) > 600) return;
                add3DRod(
                  gGroup,
                  new THREE.Vector3(sx, 0, 0),
                  new THREE.Vector3(sx, laserTopY, 0),
                  isLocked ? 7 : 3,
                  isLocked ? snapSlotActiveRodMat : snapSlotIdleRodMat
                );
                add3DRod(
                  gGroup,
                  new THREE.Vector3(sx, 0, laserDepth),
                  new THREE.Vector3(sx, laserTopY, laserDepth),
                  isLocked ? 7 : 3,
                  isLocked ? snapSlotActiveRodMat : snapSlotIdleRodMat
                );
              });
              needsRenderRef.current = true;
            }
            if (nextW !== rMod.dimensions.width || (rAxis === "width_left" && nextX !== rMod.position.x)) {
              const resP =
                rAxis === "width_left"
                  ? state.resizeModuleParametric(activeDrag3D.modIdx, nextW, nextX)
                  : state.resizeModuleParametric(activeDrag3D.modIdx, nextW);
              if (widthSnap.snapBanner) {
                setSnapBannerDedup(widthSnap.snapBanner);
              } else if (resP) {
                setSnapBannerDedup(
                  `📐 Parametrik Genişlik: ${nextW} mm → ${resP.bayCount} Bölme (${Math.max(0, resP.bayCount - 1)} Dikme) • ${resP.totalLeafCount} Kapak`
                );
              } else {
                setSnapBannerDedup(`↔ Genişlik: ${nextW} mm`);
              }
            } else if (widthSnap.snapBanner) {
              setSnapBannerDedup(widthSnap.snapBanner);
            }
          }
          return;
        }

        if (activeDrag3D.kind === "divider") {
          const rawX = activeDrag3D.startValueMm + dxPx * activeDrag3D.mmPerPx;
          const snappedX = Math.round(rawX / 10) * 10;
          state.setBayCustomWidth(activeDrag3D.bayIdx, snappedX, false);
          return;
        }
        if (activeDrag3D.kind === "sub_divider") {
          const modForSd = state.project.modules[activeDrag3D.modIdx];
          if (!modForSd) return;
          const pTSd = modForSd.carcass.panelThickness || 18;
          const plHSd = modForSd.carcass.plinthHeight ?? 80;
          const netHSd = calculateNetInnerHeight(modForSd);
          const bayWidthsSd = calculateBayWidths(modForSd);

          let targetBayIdx = activeDrag3D.bayIdx;
          let bayStartX =
            pTSd + bayWidthsSd.slice(0, targetBayIdx).reduce((s, w) => s + w + pTSd, 0);
          let curBayWSd = bayWidthsSd[targetBayIdx] || 600;
          let clampedX = activeDrag3D.startValueMm;
          let cursorElevY =
            (activeDrag3D.startSecondValueMm ?? 0) + (activeDrag3D.itemHeightMm ?? 300) / 2;

          const curCamSd = (controlsRef.current?.object as THREE.Camera) || perspCamRef.current;
          if (curRenderer && curCamSd) {
            const rectSd = canvasRectRef.current || curRenderer.domElement.getBoundingClientRect();
            const ndcXSd = ((e.clientX - rectSd.left) / rectSd.width) * 2 - 1;
            const ndcYSd = -((e.clientY - rectSd.top) / rectSd.height) * 2 + 1;
            raycaster.setFromCamera(new THREE.Vector2(ndcXSd, ndcYSd), curCamSd);

            const plSd = calculateModulePlacement(modForSd);
            const rightAxis = new THREE.Vector3(
              Math.cos(plSd.rotationYRad),
              0,
              -Math.sin(plSd.rotationYRad)
            );
            const frontNormal = new THREE.Vector3(
              Math.sin(plSd.rotationYRad),
              0,
              Math.cos(plSd.rotationYRad)
            );
            const midAnchor = new THREE.Vector3(plSd.origin.x, plSd.origin.y, plSd.origin.z).addScaledVector(
              frontNormal,
              modForSd.dimensions.depth * 0.5
            );
            const midPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(frontNormal, midAnchor);
            const hitPt = new THREE.Vector3();
            if (raycaster.ray.intersectPlane(midPlane, hitPt)) {
              const relX = hitPt.clone().sub(plSd.origin).dot(rightAxis);
              const relY = hitPt.y - modForSd.position.y;
              cursorElevY = relY - plHSd - pTSd;

              // Support dragging horizontally into ANY bay as well as within the same bay!
              let accX = pTSd;
              for (let bI = 0; bI < bayWidthsSd.length; bI++) {
                const bw = bayWidthsSd[bI];
                if (relX >= accX - pTSd && relX <= accX + bw + pTSd) {
                  targetBayIdx = bI;
                  bayStartX = accX;
                  curBayWSd = bw;
                  break;
                }
                accX += bw + pTSd;
              }
              clampedX = Math.max(
                40,
                Math.min(Math.max(72, curBayWSd - pTSd - 40), Math.round((relX - bayStartX) / 5) * 5)
              );
            }
          }

          const bayObjSd = modForSd.bays[targetBayIdx];
          const ivsSd = bayObjSd ? getBayShelfIntervalsForSubDivider(bayObjSd, netHSd, pTSd) : [];
          const usableIvs = ivsSd.filter((iv) => !iv.hasConflict);
          const candIvs = usableIvs.length > 0 ? usableIvs : ivsSd;
          const bestIv =
            candIvs.find((iv) => cursorElevY >= iv.botY - 22 && cursorElevY <= iv.topY + 22) ||
            (candIvs.length > 0
              ? candIvs.reduce((best, iv) =>
                  Math.abs((iv.botY + iv.topY) / 2 - cursorElevY) <
                  Math.abs((best.botY + best.topY) / 2 - cursorElevY)
                    ? iv
                    : best
                )
              : {
                  botY: activeDrag3D.startSecondValueMm ?? 0,
                  height: activeDrag3D.itemHeightMm ?? 300,
                  label: "",
                });

          const targetMidY = Math.round(bestIv.botY + bestIv.height / 2);
          activeDrag3D.liveSubDivider = {
            offsetX: clampedX,
            elevationY: bestIv.botY,
            height: bestIv.height,
            targetMidY,
            targetBayIndex: targetBayIdx,
          };

          const modContainer3D = meshGroupRef.current?.children.find(
            (ch) => ch.userData?.moduleIndex === activeDrag3D?.modIdx
          );
          if (modContainer3D) {
            const tId = activeDrag3D.targetId;
            let movedSd = false;
            for (const child of modContainer3D.children) {
              const cid = String(child.userData?.componentId || "");
              if (cid === tId || cid.startsWith(`${tId}_`)) {
                if (typeof child.userData.__dragBaseH !== "number") {
                  child.userData.__dragBaseH = activeDrag3D.itemHeightMm || bestIv.height || 300;
                }
                // compGroup origin is at BOTTOM-LEFT of the sub-divider (x = bayStartX + offsetX, y = plH + T + botY)!
                child.position.x = bayStartX + clampedX;
                child.position.y = plHSd + pTSd + bestIv.botY;
                child.scale.y = Math.max(
                  0.1,
                  bestIv.height / Math.max(40, child.userData.__dragBaseH as number)
                );
                movedSd = true;
              }
            }
            if (movedSd) {
              if (selectionFrameGroupRef.current) {
                selectionFrameGroupRef.current.visible = false;
              }
              setSnapBannerDedup(
                `📐 Raf Arası Dikme • Bölme ${targetBayIdx + 1} (${bestIv.label || "Raf Arası"}) • X: ${clampedX} mm`
              );
              needsRenderRef.current = true;
              return;
            }
          }

          state.setSubDividerPlacement(
            activeDrag3D.bayIdx,
            activeDrag3D.targetId,
            { offsetX: clampedX, elevationY: bestIv.botY, height: bestIv.height, targetMidY, targetBayIndex: targetBayIdx },
            false
          );
          setSnapBannerDedup(`📐 Raf Arası Dikme • Bölme ${targetBayIdx + 1} • X: ${clampedX} mm`);
          return;
        }

        // True 3D ray-plane vertical tracking (1:1 locked to cursor from bottom to top of cabinet!)
        let verticalDeltaMm = -dyPx * activeDrag3D.mmPerPx;
        const curCamElev = (controlsRef.current?.object as THREE.Camera) || perspCamRef.current;
        if (curRenderer && curCamElev && activeDrag3D.dragPlane && activeDrag3D.startPlaneHit) {
          const rectElev = canvasRectRef.current || curRenderer.domElement.getBoundingClientRect();
          const ndcXElev = ((e.clientX - rectElev.left) / rectElev.width) * 2 - 1;
          const ndcYElev = -((e.clientY - rectElev.top) / rectElev.height) * 2 + 1;
          raycaster.setFromCamera(new THREE.Vector2(ndcXElev, ndcYElev), curCamElev);
          const curHitElev = new THREE.Vector3();
          if (raycaster.ray.intersectPlane(activeDrag3D.dragPlane, curHitElev)) {
            const planeDy = curHitElev.y - activeDrag3D.startPlaneHit.y;
            if (Math.abs(planeDy) < 6000) {
              verticalDeltaMm = planeDy;
            }
          }
        }
        const rawElevY = activeDrag3D.startValueMm + verticalDeltaMm;
        const targets =
          activeDrag3D.cachedSnapTargets ||
          computeElevationSnapTargets(
            state.project,
            activeDrag3D.modIdx,
            activeDrag3D.bayIdx,
            activeDrag3D.targetId,
            activeDrag3D.itemHeightMm
          );
        const { elevationY: rawSnappedY, snappedTarget } =
          activeDrag3D.kind === "shelf"
            ? snapShelfToMultiHoleOrElevationTargets({
                project: state.project,
                moduleIndex: activeDrag3D.modIdx,
                bayIndex: activeDrag3D.bayIdx,
                shelfId: activeDrag3D.targetId,
                rawElevationY: rawElevY,
                snapTargets: targets,
                bypassMultiHole: false,
              })
            : resolveElevationSnap(rawElevY, targets, 18);
        setActive3DSnap(snappedTarget);

        const modForClamp = state.project.modules[activeDrag3D.modIdx];
        const TClamp = modForClamp?.carcass.panelThickness || 18;
        const plinthClamp = modForClamp?.carcass.plinthHeight ?? 100;
        const netHClamp = modForClamp
          ? Math.max(200, modForClamp.dimensions.height - plinthClamp - 2 * TClamp)
          : 2000;
        const itemH = activeDrag3D.itemHeightMm || TClamp;
        const clampedSnappedY =
          activeDrag3D.kind === "shelf"
            ? snappedTarget?.kind === "system32_hole"
              ? Math.round(rawSnappedY)
              : Math.max(32, Math.min(Math.max(64, netHClamp - 32), Math.round(rawSnappedY)))
            : activeDrag3D.kind === "drawer"
            ? Math.max(0, Math.min(Math.max(0, netHClamp - itemH), Math.round(rawSnappedY)))
            : activeDrag3D.kind === "rail"
            ? Math.max(120, Math.min(Math.max(160, netHClamp - 32), Math.round(rawSnappedY)))
            : Math.max(32, Math.min(Math.max(64, netHClamp - itemH), Math.round(rawSnappedY)));

        activeDrag3D.liveSnappedY = clampedSnappedY;
        const deltaY = clampedSnappedY - activeDrag3D.startValueMm;

        // V83: Live 3D Cross-Bay & Cross-Module Tracking — detect which bay/module divider gap the cursor is over!
        let destModIdxLive = activeDrag3D.modIdx;
        let destBayIdxLive = activeDrag3D.bayIdx;
        let deltaX = 0;
        let deltaZ = 0;
        if (curRenderer && curCamElev && meshGroupRef.current && modForClamp) {
          const rectLive = canvasRectRef.current && canvasRectRef.current.width > 0 ? canvasRectRef.current : curRenderer.domElement.getBoundingClientRect();
          if (rectLive.width > 0 && rectLive.height > 0) {
            const ndcLive = new THREE.Vector2(
              ((e.clientX - rectLive.left) / rectLive.width) * 2 - 1,
              -((e.clientY - rectLive.top) / rectLive.height) * 2 + 1
            );
            raycaster.setFromCamera(ndcLive, curCamElev);
            const hoverHits = raycaster.intersectObjects(meshGroupRef.current.children, true);
            for (const hh of hoverHits) {
              const hCid = String(hh.object?.userData?.componentId || "");
              const hPid = String(hh.object?.userData?.parentComponentId || "");
              const hRole = String(hh.object?.userData?.role || "");
              if (hCid && (hCid === activeDrag3D.targetId || hCid.startsWith(`${activeDrag3D.targetId}_`) || hPid === activeDrag3D.targetId)) continue;
              if (hRole === "door_left" || hRole === "door_right" || hRole === "door_handle") continue;
              const hModIdx = typeof hh.object?.userData?.moduleIndex === "number" ? hh.object.userData.moduleIndex : -1;
              if (hModIdx >= 0) {
                const hMod = state.project.modules[hModIdx];
                if (hMod && hMod.category !== "complementary" && hMod.bays.length > 0) {
                  const rotRad = -((hMod.rotation?.y || 0) * Math.PI) / 180;
                  const dxW = hh.point.x - hMod.position.x;
                  const dzW = hh.point.z - hMod.position.z;
                  const localHitX = dxW * Math.cos(-rotRad) - dzW * Math.sin(-rotRad);
                  const hBayWidths = calculateBayWidths(hMod);
                  const hPT = hMod.carcass.panelThickness || 18;
                  let cursorX = hPT;
                  let resolvedBay = -1;
                  for (let bi = 0; bi < hMod.bays.length; bi += 1) {
                    const bw = hBayWidths[bi] || 500;
                    if (localHitX >= cursorX - hPT * 0.6 && localHitX <= cursorX + bw + hPT * 0.6) {
                      resolvedBay = bi;
                      break;
                    }
                    cursorX += bw + hPT;
                  }
                  if (resolvedBay < 0) {
                    resolvedBay = localHitX < hMod.dimensions.width * 0.5 ? 0 : hMod.bays.length - 1;
                  }
                  destModIdxLive = hModIdx;
                  destBayIdxLive = resolvedBay;
                  break;
                }
              }
            }
          }
          activeDrag3D.liveDestModIdx = destModIdxLive;
          activeDrag3D.liveDestBayIdx = destBayIdxLive;
          const getBayCenterLocalX = (m: typeof modForClamp, bi: number) => {
            const bws = calculateBayWidths(m);
            const pt = m.carcass.panelThickness || 18;
            let cx = pt;
            for (let i = 0; i < bi; i += 1) cx += (bws[i] || 500) + pt;
            return cx + (bws[bi] || 500) * 0.5;
          };
          const srcCenterLocalX = getBayCenterLocalX(modForClamp, activeDrag3D.bayIdx);
          const dstModObj = state.project.modules[destModIdxLive] || modForClamp;
          const dstCenterLocalX = getBayCenterLocalX(dstModObj, destBayIdxLive);
          if (destModIdxLive === activeDrag3D.modIdx) {
            deltaX = dstCenterLocalX - srcCenterLocalX;
            deltaZ = 0;
          } else {
            const srcRotRad = ((modForClamp.rotation?.y || 0) * Math.PI) / 180;
            const dstRotRad = ((dstModObj.rotation?.y || 0) * Math.PI) / 180;
            const srcWorldX = modForClamp.position.x + srcCenterLocalX * Math.cos(srcRotRad);
            const srcWorldZ = modForClamp.position.z - srcCenterLocalX * Math.sin(srcRotRad);
            const dstWorldX = dstModObj.position.x + dstCenterLocalX * Math.cos(dstRotRad);
            const dstWorldZ = dstModObj.position.z - dstCenterLocalX * Math.sin(dstRotRad);
            const wDx = dstWorldX - srcWorldX;
            const wDz = dstWorldZ - srcWorldZ;
            deltaX = wDx * Math.cos(srcRotRad) - wDz * Math.sin(srcRotRad);
            deltaZ = wDx * Math.sin(srcRotRad) + wDz * Math.cos(srcRotRad);
          }
          if (destModIdxLive !== activeDrag3D.modIdx || destBayIdxLive !== activeDrag3D.bayIdx) {
            setSnapBannerDedup(
              destModIdxLive !== activeDrag3D.modIdx
                ? `⇄ Modül #${destModIdxLive + 1} · ${destBayIdxLive + 1}. Bölmeye Taşı • Y: ${clampedSnappedY} mm`
                : `⇄ ${destBayIdxLive + 1}. Bölmeye Taşı • Y: ${clampedSnappedY} mm`
            );
          }
        }

        // Direct 0.0ms GPU X/Y/Z-translation for shelf, drawer, rail, and special_fitting across dividers!
        // Avoids rebuilding the cabinet's 100+ meshes, clothing props, CNC multi-holes, and 2D/UI trees on 60Hz mousemove.
        const modContainer3D = meshGroupRef.current?.children.find(
          (ch) => ch.userData?.moduleIndex === activeDrag3D?.modIdx
        );
        if (modContainer3D && modForClamp) {
          const bayObj = modForClamp.bays[activeDrag3D.bayIdx];
          const tId = activeDrag3D.targetId;
          const mId = modForClamp.id;
          const bIdx = activeDrag3D.bayIdx;
          const sIdx = bayObj ? bayObj.shelves.findIndex((s) => s.id === tId) : -1;
          const rIdx = bayObj ? bayObj.hangingRails.findIndex((r) => r.id === tId) : -1;
          const fIdx = bayObj ? (bayObj.specialFittings || []).findIndex((f) => f.id === tId) : -1;

          let movedAny = false;
          for (const child of modContainer3D.children) {
            const cid = String(child.userData?.componentId || "");
            const pid = String(child.userData?.parentComponentId || "");
            const shOwner = String(child.userData?.shelfOwnerId || "");
            let match = false;
            if (activeDrag3D.kind === "shelf") {
              match =
                cid === tId ||
                cid.startsWith(`${tId}_pin_`) ||
                cid.startsWith(`${tId}_cam_`) ||
                shOwner === tId ||
                (sIdx >= 0 &&
                  (cid === `${mId}_bay_${bIdx}_shelf_${sIdx}` ||
                    cid === `${mId}_bay_${bIdx}_recessed_led_sh_${sIdx}` ||
                    cid === `${tId}_l_shelf_ret_${sIdx}` ||
                    cid === `${tId}_diag_shelf_ret_${sIdx}`));
            } else if (activeDrag3D.kind === "drawer") {
              match =
                cid === tId ||
                cid.startsWith(`${tId}_`) ||
                pid === tId ||
                pid.startsWith(`${tId}_`);
            } else if (activeDrag3D.kind === "rail") {
              match =
                cid === tId ||
                cid.startsWith(`${tId}_`) ||
                (rIdx >= 0 &&
                  (cid === `${mId}_bay_${bIdx}_rail_${rIdx}` ||
                    cid === `${mId}_bay_${bIdx}_recessed_led_rod_${rIdx}`));
            } else if (activeDrag3D.kind === "special_fitting") {
              const fallbackFitPrefix = fIdx >= 0 ? `${mId}_bay_${bIdx}_fit_${fIdx}` : "";
              match =
                cid === tId ||
                cid.startsWith(`${tId}_`) ||
                (Boolean(fallbackFitPrefix) &&
                  (cid === fallbackFitPrefix || cid.startsWith(`${fallbackFitPrefix}_`)));
            }

            if (match) {
              if (typeof child.userData.__dragBaseX !== "number") {
                child.userData.__dragBaseX = child.position.x;
              }
              if (typeof child.userData.__dragBaseY !== "number") {
                child.userData.__dragBaseY = child.position.y;
              }
              if (typeof child.userData.__dragBaseZ !== "number") {
                child.userData.__dragBaseZ = child.position.z;
              }
              child.position.set(
                (child.userData.__dragBaseX as number) + deltaX,
                (child.userData.__dragBaseY as number) + deltaY,
                (child.userData.__dragBaseZ as number) + deltaZ
              );
              movedAny = true;
            }
          }

          // Also glide clothing, folded stacks, boxes & shoes belonging to this rail/shelf/fitting in real time!
          const modPropsNode = interiorPropsGroupRef.current?.children.find(
            (ch) => ch.userData?.moduleId === mId || ch.userData?.moduleIndex === activeDrag3D?.modIdx
          );
          if (modPropsNode) {
            let movedProp = false;
            for (const bayGrp of modPropsNode.children) {
              for (const propItem of bayGrp.children) {
                const pud = propItem.userData;
                if (!pud || pud.propBayIndex !== bIdx || pud.propOwnerKind !== activeDrag3D.kind) continue;
                const idMatches =
                  pud.propOwnerId === tId ||
                  (activeDrag3D.kind === "shelf" && sIdx >= 0 && pud.propOwnerIdx === sIdx) ||
                  (activeDrag3D.kind === "rail" && rIdx >= 0 && pud.propOwnerIdx === rIdx) ||
                  (activeDrag3D.kind === "special_fitting" && fIdx >= 0 && pud.propOwnerIdx === fIdx);
                if (idMatches) {
                  if (typeof pud.__dragBaseX !== "number") {
                    pud.__dragBaseX = propItem.position.x;
                  }
                  if (typeof pud.__dragBaseY !== "number") {
                    pud.__dragBaseY = propItem.position.y;
                  }
                  if (typeof pud.__dragBaseZ !== "number") {
                    pud.__dragBaseZ = propItem.position.z;
                  }
                  propItem.position.set(
                    (pud.__dragBaseX as number) + deltaX,
                    (pud.__dragBaseY as number) + deltaY,
                    (pud.__dragBaseZ as number) + deltaZ
                  );
                  propItem.updateMatrix();
                  movedProp = true;
                }
              }
            }
            if (movedProp) {
              modPropsNode.updateMatrixWorld(true);
            }
          }

          if (movedAny) {
            if (selectionFrameGroupRef.current) {
              selectionFrameGroupRef.current.position.set(deltaX, deltaY, deltaZ);
            }
            needsRenderRef.current = true;
            return;
          }
        }

        // Fallback if procedural capsule hull or custom structure has no discrete child group
        if (activeDrag3D.kind === "shelf") {
          state.setShelfElevation(activeDrag3D.bayIdx, activeDrag3D.targetId, clampedSnappedY, false);
        } else if (activeDrag3D.kind === "drawer") {
          state.setDrawerPlacement(
            activeDrag3D.bayIdx,
            activeDrag3D.targetId,
            clampedSnappedY,
            undefined,
            false
          );
        } else if (activeDrag3D.kind === "rail") {
          state.setHangingRailElevation(activeDrag3D.bayIdx, activeDrag3D.targetId, clampedSnappedY, false);
        } else if (activeDrag3D.kind === "special_fitting") {
          state.setSpecialFittingPlacement?.(activeDrag3D.bayIdx, activeDrag3D.targetId, { elevationY: clampedSnappedY }, false);
        }
      };

      const handlePointerMove = (e: PointerEvent) => {
        const activeDrag3D = getActiveDrag3D();
        if (e.pointerType === "touch") {
          touchLongPress.move(e);
          if (activeTouchPointerIds.size > 1) return;
        }
        if (!activeDrag3D) {
          processPointerMoveImmediate(e);
          return;
        }
        latestDragPointerEvent = e;
        if (!dragMoveRafId) {
          dragMoveRafId = window.requestAnimationFrame(() => {
            dragMoveRafId = 0;
            if (latestDragPointerEvent) {
              processPointerMoveImmediate(latestDragPointerEvent);
            }
          });
        }
      };


  const flushPendingPointerDragRaf = () => {
    if (dragMoveRafId) {
      window.cancelAnimationFrame(dragMoveRafId);
      dragMoveRafId = 0;
      if (latestDragPointerEvent && getActiveDrag3D()) {
        processPointerMoveImmediate(latestDragPointerEvent);
      }
    }
    latestDragPointerEvent = null;
  };

  const cancelPendingPointerDragRaf = () => {
    if (dragMoveRafId) {
      window.cancelAnimationFrame(dragMoveRafId);
      dragMoveRafId = 0;
    }
    latestDragPointerEvent = null;
  };

  return {
    handlePointerMove,
    flushPendingPointerDragRaf,
    cancelPendingPointerDragRaf,
  };
}
