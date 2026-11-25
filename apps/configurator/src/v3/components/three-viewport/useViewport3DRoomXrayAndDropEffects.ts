"use client";

import { build3DArchitecturalCeilingGroup, computeWallTopProfileForCeiling } from "../../materials/ceilingAndMultiHole3DBuilder";
import { useEffect } from "react";
import * as THREE from "three";
import { getWallRoomBasis } from "../../engine/angledWallSnapEngine";
import { getEffectiveSpaceWalls } from "../../engine/kitchenSpatialEngine";
import { createModuleGroup } from "../../../components/componentMesh";
import { calculateFourSpaceDimensions } from "@birim/core";
import { getArchitecturalFloorTexture, getArchitecturalFloorNormalMap, getArchitecturalWallTexture, getArchitecturalWallNormalMap } from "../../materials/pbrMaterialSystem";
import { disposeObject3DTree } from "../../materials/webglResourceGuard";
import { createActiveWallBadgeMesh } from "./viewport3DSharedAssets";
import { type DimensionAnchor, addDimensionSegment } from "./viewport3DSceneHelpers";
import { useViewport3DDragAndDropEffects } from "./useViewport3DDragAndDropEffects";

import type { UseViewport3DRoomXrayAndDropEffectsCtx } from "./viewport3DTypes";

export function useViewport3DRoomXrayAndDropEffects(ctx: UseViewport3DRoomXrayAndDropEffectsCtx) {
  const {
    activeBayIndex,
    activeModule,
    activeModuleIndex,
    activeWallId,
    addInteriorItemAtElevation,
    addSceneObjectFromCatalog,
    badgeDraftValue,
    controlsRef,
    dimGroupRef,
    dimWorldAnchorsRef,
    displayUnit,
    doorOpenAngleDeg,
    dropV4TemplateWithSnap,
    editingBadge,
    effectiveShowDimensions,
    floorStyle,
    getCachedSolidMeshes,
    ghostSnapGroupRef,
    hardwareViewMode,
    hasActiveCabinetSelection,
    hwCallouts,
    hwWorldAnchorsRef,
    isDraggingItemOver3D,
    isSimpleTier,
    lastAccessoryDropTargetRef,
    lastGhostKeyRef,
    latestStateRef,
    lightingPreset,
    liveDimDeltaRef,
    markShadowsAndRender,
    matCallouts,
    matWorldAnchorsRef,
    materialModeActive,
    meshGroupRef,
    paused,
    pausedRef,
    perspCamRef,
    project,
    renderEdgeMode,
    rendererRef,
    requestRender,
    roomArchGroupRef,
    sceneObjectsGroupRef,
    setDimensions,
    setDoorOpenAngleDeg,
    setEditingBadge,
    setIsDraggingItemOver3D,
    setPlinthHeight,
    setSnapBannerDedup,
    shadowPlaneRef,
    showInCanvasHud,
    showRoomArchitecture3D,
    spaceObstacles,
    spaceWalls,
    theme,
    updateProjectedDimensionLabels,
    v4ModuleTemplates,
    wallFocusHighlight,
    wallTone,
  } = ctx;

    // Separate useEffect for 3D Room Architecture so cabinet interior edits/drags never rebuild room walls/floors!
    useEffect(() => {
      if (paused) return;
      if (roomArchGroupRef.current) {
        disposeObject3DTree(roomArchGroupRef.current);
        roomArchGroupRef.current.clear();
      }
      const isLight = theme !== "dark";
      // Render 3D Architectural Backdrop Wall & Obstacles (Window, Plumbing, Door, Column, Beam)
      if (showRoomArchitecture3D) {
        const roomGroup = new THREE.Group();
        roomGroup.name = "v3_room_architecture_3d";
        const mainW = spaceWalls?.[0]?.length || 3600;
        const ceilH = project.space?.ceilingHeight || 2600;

        // Architectural Back Wall + Any Side Return Walls (L/U Kitchen or Left/Right Window Wall) + Floor Surface
        const activeWallTone = lightingPreset === "night_led" ? "anthracite_gallery" : wallTone;
        const wallTex = getArchitecturalWallTexture(activeWallTone);
        const wallNorm = getArchitecturalWallNormalMap(activeWallTone);
        const wallMat = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          map: wallTex || null,
          normalMap: wallNorm || null,
          normalScale: new THREE.Vector2(0.28, 0.28),
          roughness: 0.88,
          metalness: 0.02,
          envMapIntensity: 0.42,
          transparent: false,
          side: THREE.DoubleSide,
        });
        const skCfg3D = project.space.skirtingConfig;
        const skEnabled3D = skCfg3D ? skCfg3D.enabled !== false : true;
        const skH3D = Math.max(20, Math.min(260, skCfg3D?.heightMm ?? 114));
        const skT3D = Math.max(6, Math.min(40, skCfg3D?.thicknessMm ?? 16));
        const skirtMat = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(skCfg3D?.colorHex || "#f1efea"),
          roughness: 0.42,
          metalness: 0.02,
          clearcoat: 0.14,
        });

        // Infinite studio backdrop intentionally omitted so the architectural room floats cleanly.

        const effectiveWalls = getEffectiveSpaceWalls(project);

        // Also ensure a Left Side Wall is rendered if any obstacle is rotated 90°/270° at X=0!
        const hasLeftSideObstacle = (spaceObstacles || []).some((o) => {
          const r = (((o.rotationY || 0) % 360) + 360) % 360;
          return (r === 90 || r === 270) && o.position.x <= 50;
        });
        const hasLeftWallAlready = effectiveWalls.some(
          (w) => (((w.rotationY || 0) % 360) + 360) % 360 === 90 && w.position.x <= 50
        );
        const wallsToRender =
          hasLeftSideObstacle && !hasLeftWallAlready
            ? [
                ...effectiveWalls,
                {
                  id: "wall_auto_left_side",
                  name: "Sol Yan Duvar",
                  length: 2200,
                  height: ceilH,
                  thickness: 150,
                  position: { x: 0, y: 0, z: 0 },
                  rotationY: 90,
                  elements: [],
                },
              ]
            : effectiveWalls;

        wallsToRender.forEach((w) => {
          const wLen = Math.max(100, w.length || 3600);
          const wH = Math.max(400, w.height || ceilH);
          const wThick = Math.max(40, w.thickness || 150);
          const rotRad = -((w.rotationY || 0) * Math.PI) / 180;

          const wallSegGroup = new THREE.Group();
          wallSegGroup.position.set(w.position.x, 0, w.position.z);
          wallSegGroup.rotation.y = rotRad;

          const roomCenterForWall = { x: Math.max(900, mainW * 0.5), z: 1200 };
          const wBasis = getWallRoomBasis(w, roomCenterForWall);
          const localZWorldX = Math.sin(rotRad);
          const localZWorldZ = Math.cos(rotRad);
          const dotLocalZInward =
            localZWorldX * wBasis.inwardNormal.x + localZWorldZ * wBasis.inwardNormal.z;
          const inwardIsPositiveLocalZ = dotLocalZInward >= 0;
          const wallLocalZ = inwardIsPositiveLocalZ ? -wThick / 2 : wThick / 2;
          const skirtLocalZ = inwardIsPositiveLocalZ ? 7 : -7;

          wallSegGroup.userData = {
            isRoomWallGroup: true,
            wallId: w.id,
            inwardNormal: wBasis.inwardNormal,
            wallMid: {
              x: wBasis.p0.x + wBasis.rawTangent.x * (wLen * 0.5),
              z: wBasis.p0.z + wBasis.rawTangent.z * (wLen * 0.5),
            },
          };

          const effectiveActiveWallId = activeWallId || wallsToRender[0]?.id || "wall_main";
          const isSelectedTargetWall =
            (wallsToRender.length > 1 || Boolean(activeWallId)) && w.id === effectiveActiveWallId;
          // Option 1 + 3 (refined) + 6: Keep all walls at 100% natural plaster; highlight the active wall with a crisp, non-overlapping architectural frame + corner viewfinders + wall-parallel badge
          const isStrongWallFocus = isSelectedTargetWall && wallFocusHighlight && !hasActiveCabinetSelection;
          const segWallMat = isSelectedTargetWall
            ? (() => {
                const mat = new THREE.MeshStandardMaterial({
                  color: wallMat.color.clone(),
                  map: wallTex || null,
                  normalMap: wallNorm || null,
                  normalScale: new THREE.Vector2(0.28, 0.28),
                  roughness: wallMat.roughness,
                  metalness: 0.02,
                  emissive: new THREE.Color(0x0284c7),
                  emissiveIntensity: 0,
                  envMapIntensity: wallMat.envMapIntensity,
                  side: THREE.DoubleSide,
                });
                mat.userData = {
                  isIsolatedSelectedWallMat: true,
                  baseEmissiveIntensity: 0,
                };
                return mat;
              })()
            : wallMat;
          const wallProfile = computeWallTopProfileForCeiling(project.space, mainW, w);
          const sampleWallTopY = (sQuery: number): number => {
            const pts = wallProfile.points;
            if (pts.length === 0) return wH;
            if (sQuery <= pts[0].s) return pts[0].y;
            for (let pi = 0; pi < pts.length - 1; pi++) {
              const a = pts[pi];
              const b = pts[pi + 1];
              if (sQuery <= b.s) {
                const span = Math.max(1e-4, b.s - a.s);
                const t = (sQuery - a.s) / span;
                return a.y + (b.y - a.y) * t;
              }
            }
            return pts[pts.length - 1].y;
          };

          let wGeo: THREE.BufferGeometry;
          if (wallProfile.isClipped) {
            const wallShape = new THREE.Shape();
            wallShape.moveTo(0, 0);
            wallShape.lineTo(wLen, 0);
            for (let pi = wallProfile.points.length - 1; pi >= 0; pi--) {
              wallShape.lineTo(wallProfile.points[pi].s, wallProfile.points[pi].y);
            }
            wallShape.closePath();
            const extGeo = new THREE.ExtrudeGeometry(wallShape, {
              depth: wThick,
              bevelEnabled: false,
            });
            extGeo.translate(0, 0, -wThick / 2);
            const uvAttr = extGeo.attributes.uv;
            if (uvAttr) {
              for (let ui = 0; ui < uvAttr.count; ui++) {
                uvAttr.setXY(ui, uvAttr.getX(ui) / Math.max(1, wLen), uvAttr.getY(ui) / Math.max(1, wH));
              }
              uvAttr.needsUpdate = true;
            }
            extGeo.computeVertexNormals();
            wGeo = extGeo;
          } else {
            wGeo = new THREE.BoxGeometry(wLen, wH, wThick);
          }

          const wMesh = new THREE.Mesh(wGeo, segWallMat);
          wMesh.userData = {
            isRoomWall: true,
            wallId: w.id,
            wallName: w.name || "Duvar",
          };
          if (wallProfile.isClipped) {
            wMesh.position.set(0, 0, wallLocalZ);
          } else {
            wMesh.position.set(wLen / 2, wH / 2, wallLocalZ);
          }
          wMesh.castShadow = false;
          wMesh.receiveShadow = true;
          if (renderEdgeMode === "cad") {
            wMesh.add(
              new THREE.LineSegments(
                new THREE.EdgesGeometry(wGeo),
                new THREE.LineBasicMaterial({
                  color: 0x94a3b8,
                  transparent: true,
                  opacity: 0.45,
                })
              )
            );
          }
          if (isSelectedTargetWall && showInCanvasHud) {
            // Refined Option 3: Flush, clean CAD viewfinder frame + non-overlapping corner L-brackets (follows sloped ceiling profile)
            const zSign = inwardIsPositiveLocalZ ? 1 : -1;
            const zFrame = zSign * 3.2;
            const zBracket = zSign * 4.8;
            const frameInset = 18;
            const botY = (skEnabled3D ? skH3D : 0) + frameInset;
            const leftX = frameInset;
            const rightX = wLen - frameInset;
            const leftTopY = Math.max(botY + 80, sampleWallTopY(leftX) - frameInset);
            const rightTopY = Math.max(botY + 80, sampleWallTopY(rightX) - frameInset);
            const innerW = Math.max(40, rightX - leftX);
            const minInnerH = Math.max(40, Math.min(leftTopY, rightTopY) - botY);

            const lineThick = 7;
            const armLen = Math.max(60, Math.min(155, innerW * 0.11, minInnerH * 0.12));
            const armThick = 14;

            const railColorHex = isStrongWallFocus ? 0x38bdf8 : 0x0ea5e9;
            const bracketColorHex = isStrongWallFocus ? 0x0ea5e9 : 0x0284c7;
            const railOpacity = isStrongWallFocus ? 0.78 : 0.56;
            const bracketOpacity = isStrongWallFocus ? 0.96 : 0.88;

            const railMat = new THREE.MeshBasicMaterial({
              color: railColorHex,
              transparent: true,
              opacity: railOpacity,
              depthWrite: false,
              side: THREE.DoubleSide,
            });
            const bracketMat = new THREE.MeshBasicMaterial({
              color: bracketColorHex,
              transparent: true,
              opacity: bracketOpacity,
              depthWrite: false,
              side: THREE.DoubleSide,
            });

            // Bottom slim edge line trimmed between bottom brackets
            const hBotSpan = Math.max(0, innerW - armLen * 2);
            if (hBotSpan > 10) {
              const botLine = new THREE.Mesh(new THREE.PlaneGeometry(hBotSpan, lineThick), railMat);
              botLine.position.set(wLen / 2, botY + lineThick / 2, zFrame);
              botLine.raycast = () => {};
              botLine.userData = {
                isWallFocusIndicator: true,
                isWallFocusRail: true,
                railAxis: "horiz",
                baseOpacity: railOpacity,
                baseColorHex: railColorHex,
              };
              wallSegGroup.add(botLine);
            }

            // Top slim edge line(s) following sloped ceiling polyline
            const topPolyPts: { x: number; y: number }[] = [
              { x: leftX, y: leftTopY },
              ...wallProfile.points
                .filter((p) => p.s > leftX + 4 && p.s < rightX - 4)
                .map((p) => ({ x: p.s, y: Math.max(botY + 80, p.y - frameInset) })),
              { x: rightX, y: rightTopY },
            ];
            for (let si = 0; si < topPolyPts.length - 1; si++) {
              const pA = topPolyPts[si];
              const pB = topPolyPts[si + 1];
              const dx = pB.x - pA.x;
              const dy = pB.y - pA.y;
              const segLen = Math.hypot(dx, dy);
              const trimStart = si === 0 ? armLen : 0;
              const trimEnd = si === topPolyPts.length - 2 ? armLen : 0;
              const usableLen = segLen - trimStart - trimEnd;
              if (usableLen > 10 && segLen > 1) {
                const ux = dx / segLen;
                const uy = dy / segLen;
                const midDist = trimStart + usableLen / 2;
                const mx = pA.x + ux * midDist;
                const my = pA.y + uy * midDist - lineThick / 2;
                const segMesh = new THREE.Mesh(new THREE.PlaneGeometry(usableLen, lineThick), railMat);
                segMesh.position.set(mx, my, zFrame);
                segMesh.rotation.z = Math.atan2(dy, dx);
                segMesh.raycast = () => {};
                segMesh.userData = {
                  isWallFocusIndicator: true,
                  isWallFocusRail: true,
                  railAxis: "horiz",
                  baseOpacity: railOpacity,
                  baseColorHex: railColorHex,
                };
                wallSegGroup.add(segMesh);
              }
            }

            // Left & right slim vertical edge lines trimmed between corner brackets
            [
              { rx: leftX + lineThick / 2, topEdge: leftTopY },
              { rx: rightX - lineThick / 2, topEdge: rightTopY },
            ].forEach(({ rx, topEdge }) => {
              const vSpan = Math.max(0, topEdge - botY - armLen * 2);
              if (vSpan > 10) {
                const vLine = new THREE.Mesh(new THREE.PlaneGeometry(lineThick, vSpan), railMat);
                vLine.position.set(rx, (botY + topEdge) / 2, zFrame);
                vLine.raycast = () => {};
                vLine.userData = {
                  isWallFocusIndicator: true,
                  isWallFocusRail: true,
                  railAxis: "vert",
                  baseOpacity: railOpacity,
                  baseColorHex: railColorHex,
                };
                wallSegGroup.add(vLine);
              }
            });

            // 4 precision L-brackets (bottom 2 horizontal + top 2 aligned to local ceiling slope angle)
            const vLegLen = Math.max(12, armLen - armThick);
            const leftSlopeAng =
              topPolyPts.length >= 2
                ? Math.atan2(topPolyPts[1].y - topPolyPts[0].y, Math.max(1, topPolyPts[1].x - topPolyPts[0].x))
                : 0;
            const lastIdx = topPolyPts.length - 1;
            const rightSlopeAng =
              topPolyPts.length >= 2
                ? Math.atan2(
                    topPolyPts[lastIdx].y - topPolyPts[lastIdx - 1].y,
                    Math.max(1, topPolyPts[lastIdx].x - topPolyPts[lastIdx - 1].x)
                  )
                : 0;

            const corners = [
              { cx: leftX, cy: botY, sx: 1, sy: 1, slopeAng: 0 },
              { cx: rightX, cy: botY, sx: -1, sy: 1, slopeAng: 0 },
              { cx: leftX, cy: leftTopY, sx: 1, sy: -1, slopeAng: leftSlopeAng },
              { cx: rightX, cy: rightTopY, sx: -1, sy: -1, slopeAng: rightSlopeAng },
            ];
            corners.forEach((c) => {
              const hLeg = new THREE.Mesh(new THREE.PlaneGeometry(armLen, armThick), bracketMat);
              const cosA = Math.cos(c.slopeAng);
              const sinA = Math.sin(c.slopeAng);
              const alongSign = c.sx;
              hLeg.position.set(
                c.cx + alongSign * cosA * (armLen / 2),
                c.cy + alongSign * sinA * (armLen / 2) + c.sy * (armThick / 2),
                zBracket
              );
              hLeg.rotation.z = c.slopeAng;
              hLeg.raycast = () => {};
              hLeg.userData = {
                isWallFocusIndicator: true,
                isWallFocusRail: true,
                railAxis: "bracket",
                baseOpacity: bracketOpacity,
                baseColorHex: bracketColorHex,
              };
              wallSegGroup.add(hLeg);

              const vLeg = new THREE.Mesh(new THREE.PlaneGeometry(armThick, vLegLen), bracketMat);
              vLeg.position.set(
                c.cx + c.sx * (armThick / 2),
                c.cy + c.sy * (armThick + vLegLen / 2),
                zBracket
              );
              vLeg.raycast = () => {};
              vLeg.userData = {
                isWallFocusIndicator: true,
                isWallFocusRail: true,
                railAxis: "bracket",
                baseOpacity: bracketOpacity,
                baseColorHex: bracketColorHex,
              };
              wallSegGroup.add(vLeg);
            });

            const wallBadge = createActiveWallBadgeMesh(
              w.name || "Ana Duvar",
              wLen,
              displayUnit,
              isStrongWallFocus,
              inwardIsPositiveLocalZ
            );
            if (wallBadge) {
              const midTopY = sampleWallTopY(wLen / 2);
              wallBadge.position.set(wLen / 2, midTopY + 145, zSign * 6);
              wallSegGroup.add(wallBadge);
            }
          }
          wallSegGroup.add(wMesh);

          if (skEnabled3D) {
            const sGeo = new THREE.BoxGeometry(wLen, skH3D, skT3D);
            const sMesh = new THREE.Mesh(sGeo, skirtMat);
            sMesh.userData = {
              isRoomWall: true,
              wallId: w.id,
              wallName: w.name || "Duvar",
            };
            sMesh.position.set(wLen / 2, skH3D / 2, inwardIsPositiveLocalZ ? skT3D / 2 : -skT3D / 2);
            wallSegGroup.add(sMesh);
          }

          roomGroup.add(wallSegGroup);
        });

        if (shadowPlaneRef.current) {
          shadowPlaneRef.current.visible = floorStyle === "studio" || !showRoomArchitecture3D;
        }
        if (floorStyle !== "studio") {
          const baseFloorTex = getArchitecturalFloorTexture(floorStyle);
          const baseFloorNorm = getArchitecturalFloorNormalMap(floorStyle);
          const floorSpanW = Math.max(4600, mainW + 1400);
          const floorSpanD = 4200;
          const floorTex = baseFloorTex ? baseFloorTex.clone() : null;
          if (floorTex) {
            floorTex.wrapS = THREE.RepeatWrapping;
            floorTex.wrapT = THREE.RepeatWrapping;
            floorTex.repeat.set(floorSpanW / 1850, floorSpanD / 1850);
            floorTex.needsUpdate = true;
          }
          const floorNorm = baseFloorNorm ? baseFloorNorm.clone() : null;
          if (floorNorm) {
            floorNorm.wrapS = THREE.RepeatWrapping;
            floorNorm.wrapT = THREE.RepeatWrapping;
            floorNorm.repeat.set(floorSpanW / 1850, floorSpanD / 1850);
            floorNorm.needsUpdate = true;
          }
          const floorGeo = new THREE.BoxGeometry(floorSpanW, 32, floorSpanD);
          const floorMat = new THREE.MeshPhysicalMaterial({
            color: floorStyle === "neolith_calacatta" || floorStyle === "microcement" ? 0xd9d4cb : 0xc9b292,
            map: floorTex,
            normalMap: floorNorm,
            normalScale: new THREE.Vector2(0.38, 0.38),
            roughness:
              floorStyle === "neolith_calacatta"
                ? 0.16
                : floorStyle === "travertine"
                ? 0.30
                : 0.38,
            metalness: 0.04,
            clearcoat: floorStyle === "microcement" ? 0.14 : 0.36,
            clearcoatRoughness: 0.22,
            envMapIntensity: 0.92,
          });
          const floorMesh = new THREE.Mesh(floorGeo, floorMat);
          floorMesh.position.set(mainW / 2, -17.5, floorSpanD / 2 - 220);
          floorMesh.receiveShadow = true;
          roomGroup.add(floorMesh);
        }

        // Render each architectural obstacle (Window, Plumbing, Door, Column, Beam) in 3D
        // Properly respecting 90° / 270° Side-Wall Rotations, Z-axis position along side walls, and Y-axis sill height!
        (spaceObstacles || []).forEach((obs) => {
          const ow = obs.dimensions.width;
          const oh = obs.dimensions.height;
          const od = Math.max(24, obs.dimensions.depth || 80);
          const normRotY = (((obs.rotationY || 0) % 360) + 360) % 360;
          const rad = (normRotY * Math.PI) / 180;
          const dirX = Math.cos(rad);
          const dirZ = Math.sin(rad);
          const midX = obs.position.x + dirX * (ow * 0.5);
          const midZ = obs.position.z + dirZ * (ow * 0.5);
          // With rotation.y = -rad, local +X = (cos rad, 0, sin rad) along wall, local +Z = (-sin rad, 0, cos rad)
          const nLocalPlusZ = { x: -dirZ, z: dirX };
          const toRoomCenter = { x: mainW * 0.5 - midX, z: 1100 - midZ };
          const inwardLocalZSign =
            nLocalPlusZ.x * toRoomCenter.x + nLocalPlusZ.z * toRoomCenter.z >= 0 ? 1 : -1;
          const inwardWorldX = nLocalPlusZ.x * inwardLocalZSign;
          const inwardWorldZ = nLocalPlusZ.z * inwardLocalZSign;
          const cx3D = midX + inwardWorldX * 16;
          const cy3D = obs.position.y + oh / 2;
          const cz3D = midZ + inwardWorldZ * 16;
          const obsRotRad = -rad;
          const isSideWall = Math.abs(normRotY - 90) < 0.5 || Math.abs(normRotY - 270) < 0.5;
          const effectiveWallZ = cz3D;

          if (obs.type === "window") {
            const winGroup = new THREE.Group();
            winGroup.userData = { obstacleId: obs.id };
            winGroup.position.set(cx3D, cy3D, cz3D);
            winGroup.rotation.y = obsRotRad;

            const frameThick = 58;
            const frameDepth = 74;
            const outerFrameMat = new THREE.MeshStandardMaterial({
              color: 0x27272a,
              roughness: 0.38,
              metalness: 0.35,
            });
            const sashFrameMat = new THREE.MeshStandardMaterial({
              color: 0xf8fafc,
              roughness: 0.3,
              metalness: 0.1,
            });

            // 1. 4-Sided Outer Architectural Casing Frame (Pencere Kasası & Pervaz Çerçevesi)
            const topBarGeo = new THREE.BoxGeometry(ow + 24, frameThick, frameDepth);
            const topBar = new THREE.Mesh(topBarGeo, outerFrameMat);
            topBar.userData = { obstacleId: obs.id };
            topBar.position.set(0, oh / 2 - frameThick / 2, 0);
            winGroup.add(topBar);

            const botBar = new THREE.Mesh(topBarGeo, outerFrameMat);
            botBar.userData = { obstacleId: obs.id };
            botBar.position.set(0, -oh / 2 + frameThick / 2, 0);
            winGroup.add(botBar);

            const sideBarGeo = new THREE.BoxGeometry(frameThick, Math.max(80, oh - frameThick * 2), frameDepth);
            const leftBar = new THREE.Mesh(sideBarGeo, outerFrameMat);
            leftBar.userData = { obstacleId: obs.id };
            leftBar.position.set(-ow / 2 + frameThick / 2, 0, 0);
            winGroup.add(leftBar);

            const rightBar = new THREE.Mesh(sideBarGeo, outerFrameMat);
            rightBar.userData = { obstacleId: obs.id };
            rightBar.position.set(ow / 2 - frameThick / 2, 0, 0);
            winGroup.add(rightBar);

            // 2. Inner White Casement Sash Frame + Center Mullion
            const innerW = Math.max(120, ow - frameThick * 2);
            const innerH = Math.max(120, oh - frameThick * 2);
            const sashBarT = 32;
            const sashTopGeo = new THREE.BoxGeometry(innerW, sashBarT, 52);
            const sashTop = new THREE.Mesh(sashTopGeo, sashFrameMat);
            sashTop.userData = { obstacleId: obs.id };
            sashTop.position.set(0, innerH / 2 - sashBarT / 2, 0);
            winGroup.add(sashTop);

            const sashBot = new THREE.Mesh(sashTopGeo, sashFrameMat);
            sashBot.userData = { obstacleId: obs.id };
            sashBot.position.set(0, -innerH / 2 + sashBarT / 2, 0);
            winGroup.add(sashBot);

            const sashSideGeo = new THREE.BoxGeometry(sashBarT, innerH, 52);
            const sashLeft = new THREE.Mesh(sashSideGeo, sashFrameMat);
            sashLeft.userData = { obstacleId: obs.id };
            sashLeft.position.set(-innerW / 2 + sashBarT / 2, 0, 0);
            winGroup.add(sashLeft);

            const sashRight = new THREE.Mesh(sashSideGeo, sashFrameMat);
            sashRight.userData = { obstacleId: obs.id };
            sashRight.position.set(innerW / 2 - sashBarT / 2, 0, 0);
            winGroup.add(sashRight);

            // Center vertical mullion (Orta Kayıt)
            const mullionGeo = new THREE.BoxGeometry(44, innerH, 58);
            const mullionMesh = new THREE.Mesh(mullionGeo, outerFrameMat);
            mullionMesh.renderOrder = 13;
            mullionMesh.userData = { obstacleId: obs.id };
            winGroup.add(mullionMesh);

            // 3. Window Handle (Pencere Kolu) on center sash + Opening Direction V-Lines
            const winHandleMat = new THREE.MeshStandardMaterial({
              color: 0xfbbf24,
              roughness: 0.22,
              metalness: 0.85,
            });
            const winHandleRosette = new THREE.Mesh(
              new THREE.BoxGeometry(22, 64, 14),
              winHandleMat
            );
            winHandleRosette.userData = { obstacleId: obs.id };
            const winMirrorSign = obs.doorSwing === "right" ? -1 : 1;
            winHandleRosette.position.set(20 * winMirrorSign, -20, 34 * inwardLocalZSign);
            winGroup.add(winHandleRosette);

            const winHandleLever = new THREE.Mesh(
              new THREE.BoxGeometry(16, 96, 18),
              winHandleMat
            );
            winHandleLever.userData = { obstacleId: obs.id };
            winHandleLever.position.set(20 * winMirrorSign, -48, 46 * inwardLocalZSign);
            winGroup.add(winHandleLever);

            // Double-glazed reflective glass
            const glassGeo = new THREE.BoxGeometry(innerW - sashBarT * 2, innerH - sashBarT * 2, 28);
            const glassMat = new THREE.MeshBasicMaterial({
              color: 0x38bdf8,
              transparent: true,
              opacity: 0.44,
              polygonOffset: true,
              polygonOffsetFactor: -2,
            });
            const glassMesh = new THREE.Mesh(glassGeo, glassMat);
            glassMesh.renderOrder = 12;
            glassMesh.userData = { obstacleId: obs.id };
            glassMesh.add(
              new THREE.LineSegments(
                new THREE.EdgesGeometry(glassGeo),
                new THREE.LineBasicMaterial({ color: 0x0284c7 })
              )
            );
            winGroup.add(glassMesh);

            // Window Opening Direction V-Lines on Right Sash
            const winVLinePts = new Float32Array([
              innerW / 2 - sashBarT, innerH / 2 - sashBarT, 20,
              22, -20, 20,
              22, -20, 20,
              innerW / 2 - sashBarT, -innerH / 2 + sashBarT, 20,
            ]);
            const winVGeo = new THREE.BufferGeometry();
            winVGeo.setAttribute("position", new THREE.BufferAttribute(winVLinePts, 3));
            winGroup.add(
              new THREE.LineSegments(
                winVGeo,
                new THREE.LineBasicMaterial({ color: 0x0369a1 })
              )
            );

            // 4. Protruding Marble/Stone Window Sill (Denizlik)
            const sillGeo = new THREE.BoxGeometry(ow + 76, 32, 130);
            const sillMat = new THREE.MeshStandardMaterial({
              color: 0xd6d3d1,
              roughness: 0.4,
            });
            const sillMesh = new THREE.Mesh(sillGeo, sillMat);
            sillMesh.renderOrder = 13;
            sillMesh.userData = { obstacleId: obs.id };
            sillMesh.position.set(0, -oh / 2 - 16, 32 * inwardLocalZSign);
            sillMesh.add(
              new THREE.LineSegments(
                new THREE.EdgesGeometry(sillGeo),
                new THREE.LineBasicMaterial({ color: 0x44403c })
              )
            );
            winGroup.add(sillMesh);
            roomGroup.add(winGroup);
          } else if (obs.type === "plumbing") {
            const plumbGroup = new THREE.Group();
            plumbGroup.userData = { obstacleId: obs.id };
            plumbGroup.position.set(cx3D, cy3D, cz3D);
            plumbGroup.rotation.y = obsRotRad;
            const pipeGeo = new THREE.CylinderGeometry(16, 16, 55, 16);
            pipeGeo.rotateX(Math.PI / 2);
            const hotMesh = new THREE.Mesh(
              pipeGeo,
              new THREE.MeshBasicMaterial({ color: 0xdc2626 })
            );
            hotMesh.userData = { obstacleId: obs.id };
            hotMesh.position.set(-45, 15, 25);
            const coldMesh = new THREE.Mesh(
              pipeGeo,
              new THREE.MeshBasicMaterial({ color: 0x2563eb })
            );
            coldMesh.userData = { obstacleId: obs.id };
            coldMesh.position.set(45, 15, 25);
            const drainGeo = new THREE.CylinderGeometry(26, 26, 60, 16);
            drainGeo.rotateX(Math.PI / 2);
            const drainMesh = new THREE.Mesh(
              drainGeo,
              new THREE.MeshBasicMaterial({ color: 0x334155 })
            );
            drainMesh.userData = { obstacleId: obs.id };
            drainMesh.position.set(0, -35, 28);
            plumbGroup.add(hotMesh, coldMesh, drainMesh);
            roomGroup.add(plumbGroup);
          } else if (obs.type === "door") {
            const doorGroup = new THREE.Group();
            doorGroup.userData = { obstacleId: obs.id };
            doorGroup.position.set(cx3D, cy3D, cz3D);
            doorGroup.rotation.y = obsRotRad;

            const jambW = 68;
            const jambD = 76;
            const isRightHinged = obs.doorSwing === "right";
            const openSignZ = (obs.doorOpenSide === "outward" ? -1 : 1) * inwardLocalZSign;
            const frameMat = new THREE.MeshStandardMaterial({
              color: 0x292524,
              roughness: 0.42,
              metalness: 0.15,
            });
            const leafMat = new THREE.MeshStandardMaterial({
              color: 0xb45309,
              roughness: 0.48,
              metalness: 0.08,
            });
            const leafPanelMat = new THREE.MeshStandardMaterial({
              color: 0x92400e,
              roughness: 0.52,
            });
            const handleGoldMat = new THREE.MeshStandardMaterial({
              color: 0xfbbf24,
              roughness: 0.2,
              metalness: 0.9,
            });

            // 1. 3-Sided Outer Architrave Frame (Kapı Kasası & Pervaz Çerçevesi: Sol Dikme, Sağ Dikme, Üst Başlık)
            const jambGeo = new THREE.BoxGeometry(jambW, oh, jambD);
            const leftJamb = new THREE.Mesh(jambGeo, frameMat);
            leftJamb.userData = { obstacleId: obs.id };
            leftJamb.position.set(-ow / 2 + jambW / 2, 0, 0);
            leftJamb.add(
              new THREE.LineSegments(
                new THREE.EdgesGeometry(jambGeo),
                new THREE.LineBasicMaterial({ color: 0x1c1917 })
              )
            );
            doorGroup.add(leftJamb);

            const rightJamb = new THREE.Mesh(jambGeo, frameMat);
            rightJamb.userData = { obstacleId: obs.id };
            rightJamb.position.set(ow / 2 - jambW / 2, 0, 0);
            rightJamb.add(
              new THREE.LineSegments(
                new THREE.EdgesGeometry(jambGeo),
                new THREE.LineBasicMaterial({ color: 0x1c1917 })
              )
            );
            doorGroup.add(rightJamb);

            const headGeo = new THREE.BoxGeometry(ow + 36, jambW, jambD + 8);
            const topHeader = new THREE.Mesh(headGeo, frameMat);
            topHeader.userData = { obstacleId: obs.id };
            topHeader.position.set(0, oh / 2 - jambW / 2, 0);
            topHeader.add(
              new THREE.LineSegments(
                new THREE.EdgesGeometry(headGeo),
                new THREE.LineBasicMaterial({ color: 0x1c1917 })
              )
            );
            doorGroup.add(topHeader);

            // 2. 3D Hinge Barrels on Hinge Side Jamb
            const leafW = Math.max(240, ow - jambW * 2);
            const leafH = Math.max(400, oh - jambW);
            const leafD = 42;
            const hingeX = isRightHinged ? leafW / 2 : -leafW / 2;
            [-leafH * 0.36, 0, leafH * 0.36].forEach((hy) => {
              const barrel = new THREE.Mesh(
                new THREE.CylinderGeometry(10, 10, 68, 14),
                handleGoldMat
              );
              barrel.userData = { obstacleId: obs.id };
              barrel.position.set(hingeX, hy - jambW / 2, 26);
              doorGroup.add(barrel);
            });

            // 3. Pivoted Door Leaf (Supports BOTH Left/Right Hinge Mirror AND Inward/Outward Open Mirror!)
            const leafPivot = new THREE.Group();
            leafPivot.userData = { obstacleId: obs.id };
            leafPivot.position.set(hingeX, -jambW / 2, 18 * openSignZ);
            const swingAngleRad = openSignZ * (isRightHinged ? 1 : -1) * ((22 * Math.PI) / 180);
            leafPivot.rotation.y = swingAngleRad;

            const leafCenterOffsetX = isRightHinged ? -leafW / 2 : leafW / 2;
            const leafGeo = new THREE.BoxGeometry(leafW, leafH, leafD);
            const leafMesh = new THREE.Mesh(leafGeo, leafMat);
            leafMesh.userData = { obstacleId: obs.id };
            leafMesh.position.set(leafCenterOffsetX, 0, 0);
            leafMesh.add(
              new THREE.LineSegments(
                new THREE.EdgesGeometry(leafGeo),
                new THREE.LineBasicMaterial({ color: 0x451a03 })
              )
            );
            leafPivot.add(leafMesh);

            // Decorative Recessed Upper & Lower Door Panels
            const decPanelW = Math.max(120, leafW - 150);
            const decUpperGeo = new THREE.BoxGeometry(decPanelW, leafH * 0.38, leafD + 6);
            const decUpper = new THREE.Mesh(decUpperGeo, leafPanelMat);
            decUpper.userData = { obstacleId: obs.id };
            decUpper.position.set(leafCenterOffsetX, leafH * 0.2, 0);
            leafPivot.add(decUpper);

            const decLowerGeo = new THREE.BoxGeometry(decPanelW, leafH * 0.32, leafD + 6);
            const decLower = new THREE.Mesh(decLowerGeo, leafPanelMat);
            decLower.userData = { obstacleId: obs.id };
            decLower.position.set(leafCenterOffsetX, -leafH * 0.22, 0);
            leafPivot.add(decLower);

            // 4. Prominent 3D Metallic Lever Door Handle & Escutcheon Plate (Kapı Kolu & Aynası) on Latch Edge
            const handleLocalX = isRightHinged ? -leafW + 68 : leafW - 68;
            const handleLocalY = -leafH / 2 + Math.min(leafH - 180, 1020);
            const escutcheonGeo = new THREE.BoxGeometry(34, 165, leafD + 18);
            const escutcheonMesh = new THREE.Mesh(escutcheonGeo, handleGoldMat);
            escutcheonMesh.userData = { obstacleId: obs.id };
            escutcheonMesh.position.set(handleLocalX, handleLocalY, 0);
            leafPivot.add(escutcheonMesh);

            // Front & Back Lever Grips pointing inward toward the center of the door leaf
            const leverDir = isRightHinged ? 1 : -1;
            [leafD / 2 + 28, -(leafD / 2 + 28)].forEach((hz) => {
              const neckMesh = new THREE.Mesh(
                new THREE.CylinderGeometry(11, 11, 34, 16).rotateX(Math.PI / 2),
                handleGoldMat
              );
              neckMesh.userData = { obstacleId: obs.id };
              neckMesh.position.set(handleLocalX, handleLocalY + 18, hz * 0.65);
              leafPivot.add(neckMesh);

              const leverGrip = new THREE.Mesh(
                new THREE.BoxGeometry(135, 22, 22),
                handleGoldMat
              );
              leverGrip.userData = { obstacleId: obs.id };
              leverGrip.position.set(handleLocalX + leverDir * 52, handleLocalY + 18, hz);
              leafPivot.add(leverGrip);
            });

            // 5. Architectural Opening-Direction Triangle V-Lines on Both Faces of the Door Leaf (Hinge -> Handle)
            const hingeLocalX = 0;
            const vLinePts = new Float32Array([
              hingeLocalX, leafH / 2 - 25, leafD / 2 + 5,
              handleLocalX, handleLocalY + 18, leafD / 2 + 5,
              handleLocalX, handleLocalY + 18, leafD / 2 + 5,
              hingeLocalX, -leafH / 2 + 25, leafD / 2 + 5,
            ]);
            const vLineGeo = new THREE.BufferGeometry();
            vLineGeo.setAttribute("position", new THREE.BufferAttribute(vLinePts, 3));
            leafPivot.add(
              new THREE.LineSegments(
                vLineGeo,
                new THREE.LineBasicMaterial({ color: 0xfef08a })
              )
            );

            doorGroup.add(leafPivot);

            // 6. 3D Floor Opening Swing Arc (Zeminde 90° Kapı Açılış Yönü Yayı)
            const arcPoints: number[] = [];
            const steps = 20;
            const floorLocalY = -oh / 2 + 6;
            for (let s = 0; s < steps; s++) {
              const a0 = (s / steps) * (Math.PI / 2);
              const a1 = ((s + 1) / steps) * (Math.PI / 2);
              const x0 = hingeX + (isRightHinged ? -1 : 1) * Math.cos(a0) * leafW;
              const z0 = openSignZ * (18 + Math.sin(a0) * leafW);
              const x1 = hingeX + (isRightHinged ? -1 : 1) * Math.cos(a1) * leafW;
              const z1 = openSignZ * (18 + Math.sin(a1) * leafW);
              arcPoints.push(x0, floorLocalY, z0, x1, floorLocalY, z1);
            }
            const arcGeo = new THREE.BufferGeometry();
            arcGeo.setAttribute("position", new THREE.Float32BufferAttribute(arcPoints, 3));
            doorGroup.add(
              new THREE.LineSegments(
                arcGeo,
                new THREE.LineBasicMaterial({ color: 0xf59e0b })
              )
            );

            roomGroup.add(doorGroup);
          } else if (obs.type === "electrical") {
            // Architectural Flush Matte Anthracite Wall Socket / Switch Plate
            const plateGeo = new THREE.BoxGeometry(Math.min(160, ow), Math.min(90, oh), 10);
            const plateMat = new THREE.MeshStandardMaterial({
              color: 0x27272a,
              roughness: 0.38,
              metalness: 0.15,
            });
            const plateMesh = new THREE.Mesh(plateGeo, plateMat);
            plateMesh.userData = { obstacleId: obs.id };
            plateMesh.position.set(midX + inwardWorldX * 8, cy3D, midZ + inwardWorldZ * 8);
            plateMesh.rotation.y = obsRotRad;
            roomGroup.add(plateMesh);
          } else {
            // Solid Architectural Structural Column, Beam, Niche, or Partition (Matches Wall PBR in Photoreal!)
            const colGeo = new THREE.BoxGeometry(ow, oh, od);
            const colMesh = new THREE.Mesh(
              colGeo,
              renderEdgeMode === "cad"
                ? new THREE.MeshBasicMaterial({
                    color: 0xe2e8f0,
                    transparent: true,
                    opacity: 0.75,
                  })
                : wallMat
            );
            colMesh.userData = { obstacleId: obs.id };
            colMesh.castShadow = renderEdgeMode !== "cad";
            colMesh.receiveShadow = renderEdgeMode !== "cad";
            const colX = midX + inwardWorldX * (od * 0.5);
            const colZ = midZ + inwardWorldZ * (od * 0.5);
            colMesh.position.set(colX, cy3D, colZ);
            colMesh.rotation.y = obsRotRad;
            if (renderEdgeMode === "cad") {
              colMesh.add(
                new THREE.LineSegments(
                  new THREE.EdgesGeometry(colGeo),
                  new THREE.LineBasicMaterial({ color: 0x475569 })
                )
              );
            }
            roomGroup.add(colMesh);

            // Matching architectural baseboard wrap around floor-standing structural columns
            if (renderEdgeMode !== "cad" && (obs.position.y || 0) <= 20 && oh >= 1200) {
              const colSkirtGeo = new THREE.BoxGeometry(ow + 14, 80, od + 14);
              const colSkirt = new THREE.Mesh(colSkirtGeo, skirtMat);
              colSkirt.position.set(colX, 40, colZ);
              colSkirt.rotation.y = obsRotRad;
              colSkirt.receiveShadow = true;
              roomGroup.add(colSkirt);
            }
          }
        });

        const ceiling3DGroup = build3DArchitecturalCeilingGroup(project.space, mainW, lightingPreset);
        if (ceiling3DGroup) {
          roomGroup.add(ceiling3DGroup);
        }

        if (roomArchGroupRef.current) roomArchGroupRef.current.add(roomGroup);
      }
      markShadowsAndRender();
    }, [
      renderEdgeMode,
      showRoomArchitecture3D,
      spaceObstacles,
      spaceWalls,
      activeWallId,
      wallFocusHighlight,
      hasActiveCabinetSelection,
      project.space?.ceilingHeight,
      project.space?.ceilingConfig,
      lightingPreset,
      paused,
      wallTone,
      floorStyle,
      theme,
      displayUnit,
      showInCanvasHud,
      markShadowsAndRender,
    ]);

    const activeModForDim = project.modules[activeModuleIndex] || project.modules[0];
    const activeModuleDimSig = activeModForDim
      ? `${activeModForDim.id}|${activeModForDim.dimensions.width}x${activeModForDim.dimensions.height}x${activeModForDim.dimensions.depth}|${activeModForDim.position.x},${activeModForDim.position.y},${activeModForDim.position.z}|${activeModForDim.rotation?.y || 0}|${activeModForDim.carcass.panelThickness}|${activeModForDim.carcass.plinthHeight}|${activeModForDim.bays.map((b) => `${b.customWidth || 0}_${b.shelves.length}_${b.drawers.length}`).join(",")}`
      : "none";

    // Rebuild 3D Dimension Lines & Labels ONLY when active module dimensions/placement or showDimensions changes (never on unrelated module/shelf drags!)
    useEffect(() => {
      if (paused) return;
      const dimGroup = dimGroupRef.current;
      if (!dimGroup) return;

      // Dispose previous dimension resources (including SpriteMaterial CanvasTextures)
      disposeObject3DTree(dimGroup);
      dimGroup.clear();
      dimGroup.visible = effectiveShowDimensions;
      liveDimDeltaRef.current = { dx: 0, dz: 0 };

      const mod = project.modules[activeModuleIndex] || project.modules[0];
      if (!effectiveShowDimensions || !mod) {
        dimWorldAnchorsRef.current = [];
        requestRender();
        return;
      }

      const modDimContainer = createModuleGroup(mod);
      modDimContainer.userData.isActiveModuleDim = true;
      modDimContainer.userData.baseOrigin = modDimContainer.position.clone();
      const { width: W, height: H, depth: D } = mod.dimensions;
      const T = mod.carcass.panelThickness;
      const fourSpaces = calculateFourSpaceDimensions(mod);
      const localAnchors: DimensionAnchor[] = [];

      const soketW = Math.max(200, W - 2 * T);
      const fmt3DDim = (mmVal: number) =>
        displayUnit === "cm" ? `${Number((mmVal / 10).toFixed(1))} cm` : `${Math.round(mmVal)} mm`;
      // 1. Total Width (Genişlik) — high clean offset above cabinet top (170 mm)
      addDimensionSegment(
        modDimContainer,
        localAnchors,
        "dim_W",
        new THREE.Vector3(0, H, D * 0.85),
        new THREE.Vector3(W, H, D * 0.85),
        new THREE.Vector3(0, 1, 0),
        170,
        "G",
        fmt3DDim(W),
        0x1c1917,
        "#CBD5E1",
        "#141413"
      );

      // 2. Total Height (Yükseklik) — clean right-front vertical offset (150 mm)
      addDimensionSegment(
        modDimContainer,
        localAnchors,
        "dim_H",
        new THREE.Vector3(W, 0, D),
        new THREE.Vector3(W, H, D),
        new THREE.Vector3(1, 0, 0),
        150,
        "Y",
        fmt3DDim(H),
        0x1c1917,
        "#CBD5E1",
        "#141413"
      );

      // 3. Total Depth (Derinlik) — original left-bottom floor position & direction, with crisp high-visibility 3D rods
      addDimensionSegment(
        modDimContainer,
        localAnchors,
        "dim_D",
        new THREE.Vector3(0, 2, 0),
        new THREE.Vector3(0, 2, D),
        new THREE.Vector3(-1, 0, 0),
        125,
        "D",
        fmt3DDim(D),
        0x1c1917,
        "#CBD5E1",
        "#141413"
      );

      // 4. Soket (Plinth width) shown only in Architect / Factory modes
      if (!isSimpleTier) {
        addDimensionSegment(
          modDimContainer,
          localAnchors,
          "dim_SOKET",
          new THREE.Vector3(T, 0, D),
          new THREE.Vector3(W - T, 0, D),
          new THREE.Vector3(0, 0, 1),
          95,
          "Soket",
          fmt3DDim(soketW),
          0x78716c,
          "#D6D0C4",
          "#57534E"
        );
      }

      // 5. Per-Bay Net Width Segments along top-front edge
      if (mod.category !== "complementary" && mod.bays.length >= 1) {
        const bayWidths = fourSpaces.usableInternal.bayClearWidthsMm;
        let curBayX = T;
        mod.bays.forEach((b, bIdx) => {
          const bw =
            bayWidths[bIdx] ||
            Math.round((W - (mod.bays.length + 1) * T) / Math.max(1, mod.bays.length));
          const isSelBay = bIdx === activeBayIndex;
          if (!isSimpleTier || isSelBay) {
            addDimensionSegment(
              modDimContainer,
              localAnchors,
              `dim_BAY_${bIdx}`,
              new THREE.Vector3(curBayX, H, D * 0.94),
              new THREE.Vector3(curBayX + bw, H, D * 0.94),
              new THREE.Vector3(0, 1, 0),
              54,
              `${bIdx + 1}. Bölme`,
              fmt3DDim(bw),
              isSelBay ? 0x1d4ed8 : 0x8c7a6b,
              isSelBay ? "#93C5FD" : "#D6D0C4",
              isSelBay ? "#1D4ED8" : "#78716C"
            );
          }
          curBayX += bw + T;
        });
      }

            dimGroup.add(modDimContainer);
      modDimContainer.updateMatrixWorld(true);

      const allWorldAnchors: { id: string; worldPos: THREE.Vector3; worldStart?: THREE.Vector3; worldEnd?: THREE.Vector3; isActiveMod?: boolean }[] = localAnchors.map((a) => ({
        id: a.id,
        worldPos: a.localMidpoint.clone().applyMatrix4(modDimContainer.matrixWorld),
        worldStart: a.localStart.clone().applyMatrix4(modDimContainer.matrixWorld),
        worldEnd: a.localEnd.clone().applyMatrix4(modDimContainer.matrixWorld),
        isActiveMod: true,
      }));

      // Build 3D Dimension Rods & Anchors for ALL other modules in the scene
      project.modules.forEach((otherMod, mIdx) => {
        if (mIdx === activeModuleIndex || otherMod.category === "complementary") return;
        const otherDimContainer = createModuleGroup(otherMod);
        const oW = otherMod.dimensions.width;
        const oH = otherMod.dimensions.height;
        const oD = otherMod.dimensions.depth;
        const oAnchors: DimensionAnchor[] = [];
        addDimensionSegment(
          otherDimContainer,
          oAnchors,
          `dim_MOD_${mIdx}`,
          new THREE.Vector3(0, oH, oD),
          new THREE.Vector3(oW, oH, oD),
          new THREE.Vector3(0, 1, 0),
          75,
          `#${mIdx + 1} ${otherMod.name}`,
          displayUnit === "cm" ? `${Number((oW / 10).toFixed(1))}×${Number((oH / 10).toFixed(1))} cm` : `${oW}×${oH} mm`,
          0x57534e,
          "#57534e",
          "#44403c"
        );
        dimGroup.add(otherDimContainer);
        otherDimContainer.updateMatrixWorld(true);
        oAnchors.forEach((oa) => {
          allWorldAnchors.push({
            id: oa.id,
            worldPos: oa.localMidpoint.clone().applyMatrix4(otherDimContainer.matrixWorld),
            worldStart: oa.localStart.clone().applyMatrix4(otherDimContainer.matrixWorld),
            worldEnd: oa.localEnd.clone().applyMatrix4(otherDimContainer.matrixWorld),
          });
        });
      });

      // Build Total Row Span 3D Dimension Rod across all main modules
      const mainMods = project.modules.filter((m) => m.category !== "complementary");
      if (mainMods.length > 1) {
        const minX = Math.min(...mainMods.map((m) => m.position.x));
        const maxX = Math.max(...mainMods.map((m) => m.position.x + m.dimensions.width));
        const maxH = Math.max(...mainMods.map((m) => m.position.y + m.dimensions.height));
        const maxD = Math.max(...mainMods.map((m) => m.dimensions.depth));
        const totalAnchors: DimensionAnchor[] = [];
        addDimensionSegment(
          dimGroup,
          totalAnchors,
          "dim_TOTAL_SPAN",
          new THREE.Vector3(minX, maxH, maxD),
          new THREE.Vector3(maxX, maxH, maxD),
          new THREE.Vector3(0, 1, 0),
          260,
          "TOPLAM DİZİLİM",
          fmt3DDim(maxX - minX),
          0x0f766e,
          "#0f766e",
          "#0f766e"
        );
        totalAnchors.forEach((ta) => {
          allWorldAnchors.push({
            id: ta.id,
            worldPos: ta.localMidpoint.clone(),
            worldStart: ta.localStart.clone(),
            worldEnd: ta.localEnd.clone(),
          });
        });
      }

      dimWorldAnchorsRef.current = allWorldAnchors;

      updateProjectedDimensionLabels();
      requestRender();
    }, [
      paused,
      activeModuleDimSig,
      activeModuleIndex,
      activeBayIndex,
      effectiveShowDimensions,
      isSimpleTier,
      displayUnit,
      updateProjectedDimensionLabels,
      requestRender,
    ]);

    useEffect(() => {
      if (paused) return;
      const mod = project.modules[activeModuleIndex] || project.modules[0];
      if (!mod) {
        hwWorldAnchorsRef.current = [];
        return;
      }
      const modContainer = createModuleGroup(mod);
      modContainer.updateMatrixWorld(true);
      hwWorldAnchorsRef.current = hwCallouts.map((hc) => ({
        id: hc.id,
        worldPos: hc.localPos.clone().applyMatrix4(modContainer.matrixWorld),
        offsetPx: hc.offsetPx,
      }));
      matWorldAnchorsRef.current = matCallouts.map((mc) => ({
        id: mc.id,
        worldPos: mc.localPos.clone().applyMatrix4(modContainer.matrixWorld),
        offsetPx: mc.offsetPx,
      }));
      updateProjectedDimensionLabels();
      requestRender();
    }, [paused, activeModuleDimSig, activeModuleIndex, hwCallouts, matCallouts, hardwareViewMode, materialModeActive, updateProjectedDimensionLabels, requestRender]);

    const width = activeModule?.dimensions.width ?? 600;
    const height = activeModule?.dimensions.height ?? 2100;
    const depth = activeModule?.dimensions.depth ?? 600;

    const activeTpl = activeModule?.templateId
      ? v4ModuleTemplates.find((t: { templateId: string }) => t.templateId === activeModule.templateId)
      : undefined;
    const dimBounds = {
      W: {
        min: activeTpl?.dimensionLimits?.minW ?? 200,
        max: activeTpl?.dimensionLimits?.maxW ?? 3600,
        step: 50,
        presets: [450, 600, 800, 900, 1200, 1600, 1800, 2000, 2400],
        current: width,
        label: "Genişlik",
        isFixed: Boolean(activeModule?.isFixedWidth),
      },
      H: {
        min: activeTpl?.dimensionLimits?.minH ?? 300,
        max: activeTpl?.dimensionLimits?.maxH ?? 2800,
        step: 50,
        presets: [720, 900, 1400, 2000, 2100, 2200, 2400, 2600],
        current: height,
        label: "Yükseklik",
        isFixed: false,
      },
      D: {
        min: activeTpl?.dimensionLimits?.minD ?? 200,
        max: activeTpl?.dimensionLimits?.maxD ?? 950,
        step: 50,
        presets: [320, 350, 450, 580, 600, 650, 700],
        presetsLabel: "Derinlik",
        current: depth,
        label: "Derinlik",
        isFixed: false,
      },
      SOKET: {
        min: 0,
        max: 200,
        step: 10,
        presets: [0, 60, 80, 100, 120, 150],
        current: activeModule?.carcass?.plinthHeight ?? 100,
        label: "Soket / Kaide Yüksekliği",
        isFixed: false,
      },
    };

    const commitBadgeEdit = (overrideVal?: number) => {
      if (!editingBadge) return;
      const bInfo = dimBounds[editingBadge as keyof typeof dimBounds];
      if (!bInfo || bInfo.isFixed) {
        setEditingBadge(null);
        return;
      }
      const val = typeof overrideVal === "number" ? overrideVal : Number(badgeDraftValue);
      if (Number.isNaN(val) || !Number.isFinite(val)) return;
      if (val < bInfo.min || val > bInfo.max) {
        // Block invalid dimension outside allowed parametric rules
        return;
      }
      if (editingBadge === "W") {
        setDimensions(Math.round(val), height, depth);
      } else if (editingBadge === "H") {
        setDimensions(width, Math.round(val), depth);
      } else if (editingBadge === "D") {
        setDimensions(width, height, Math.round(val));
      } else if (editingBadge === "SOKET") {
        setPlinthHeight(Math.round(val));
      }
      setEditingBadge(null);
    };

    const { clear3DGhostPreview, handle3DDragOver, handle3DDrop } = useViewport3DDragAndDropEffects({ ghostSnapGroupRef, project, rendererRef, controlsRef, perspCamRef, latestStateRef, width, depth, pausedRef, requestRender, setSnapBannerDedup, sceneObjectsGroupRef, meshGroupRef, setIsDraggingItemOver3D, lastGhostKeyRef, getCachedSolidMeshes, activeModule, spaceWalls, roomArchGroupRef, isDraggingItemOver3D, lastAccessoryDropTargetRef, addInteriorItemAtElevation, doorOpenAngleDeg, setDoorOpenAngleDeg, addSceneObjectFromCatalog, dropV4TemplateWithSnap });
    return {
      width,
      height,
      depth,
      dimBounds,
      commitBadgeEdit,
      clear3DGhostPreview,
      handle3DDragOver,
      handle3DDrop,
    };
}
