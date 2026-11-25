"use client";

import { useEffect, useCallback } from "react";
import * as THREE from "three";
import { createModuleGroup } from "../../../components/componentMesh";
import { DEFAULT_MATERIALS, getModuleOrientedFootprint } from "../../adapter/useV3Adapter";
import { calculateFourSpaceDimensions } from "@birim/core";
import { GEOMETRY_ENGINE_REV } from "@birim/geometry";
import { getV3PbrMaterial, getStudioPmremEnvironment } from "../../materials/pbrMaterialSystem";
import { disposeObject3DTree } from "../../materials/webglResourceGuard";
import { buildJPullCrossSectionLoop } from "../../materials/capsuleAndProfileGeometry";
import { computeHeroStudioFraming, xrayIcePanelMat, cadHardwareMat, cadTechnicalMat, cadSelectedMat, getCachedEdgeMaterial } from "./viewport3DSharedAssets";
import { traverseCabinetObjectsOnly } from "./viewport3DSceneHelpers";

import type { UseViewport3DCameraSectionAndFramesCtx } from "./viewport3DTypes";

export function useViewport3DCameraSectionAndFrames(ctx: UseViewport3DCameraSectionAndFramesCtx) {
  const { activeBayIndex, activeBayWorldAnchorRef, activeDoorWorldAnchorRef, activeModFrameGroupRef, activeModuleIndex, cameraPreset, controlsRef, cutawayActiveBay, doorOpenAngleDeg, doorsHiddenIn3D, floorStyle, gallerySpotLightRef, gridRef, hemiLightRef, isOrthographic, isXrayActive, keyLightRef, latestStateRef, lightingPreset, markShadowsAndRender, meshGroupRef, orthoCamRef, perspCamRef, project, renderEdgeMode, rendererRef, requestRender, rimLightRef, roomArchGroupRef, sceneRef, section3DAxis, section3DRatio, sectionCapGroupRef, selectedComponentId, selectionFrameGroupRef, showGrid, showRoomArchitecture3D, theme, wallTone } = ctx;
    // Update Theme, Lighting Atmosphere Preset & CAD Shadow Fast-Path
    useEffect(() => {
      if (sceneRef.current) {
        const bgHex =
          renderEdgeMode === "cad"
            ? 0xf8fafc
            : lightingPreset === "night_led"
            ? 0x11151d
            : lightingPreset === "showroom_warm"
            ? 0x201f25
            : 0x1d222b;
        sceneRef.current.background = new THREE.Color(bgHex);
        sceneRef.current.fog =
          renderEdgeMode === "cad" ? null : new THREE.FogExp2(bgHex, 0.000032);
        sceneRef.current.environment =
          renderEdgeMode === "cad" || !rendererRef.current
            ? null
            : getStudioPmremEnvironment(rendererRef.current);
      }
      if (roomArchGroupRef.current) {
        roomArchGroupRef.current.visible = showRoomArchitecture3D && renderEdgeMode !== "cad";
      }
      if (rendererRef.current) {
        const enableShadows = renderEdgeMode !== "cad";
        if (rendererRef.current.shadowMap.enabled !== enableShadows) {
          rendererRef.current.shadowMap.enabled = enableShadows;
        }
      }
      if (hemiLightRef.current && keyLightRef.current && rimLightRef.current && rendererRef.current) {
        keyLightRef.current.castShadow = renderEdgeMode !== "cad";
        const sceneWithEnv = sceneRef.current as (THREE.Scene & { environmentIntensity?: number }) | null;
        if (lightingPreset === "night_led") {
          if (sceneWithEnv) sceneWithEnv.environmentIntensity = 0.10;
          hemiLightRef.current.color.setHex(0x3b4d6b);
          hemiLightRef.current.groundColor.setHex(0x07090e);
          hemiLightRef.current.intensity = 0.08;
          keyLightRef.current.color.setHex(0x93c5fd);
          keyLightRef.current.intensity = 0.32;
          rimLightRef.current.color.setHex(0x38bdf8);
          rimLightRef.current.intensity = 0.55;
          if (gallerySpotLightRef.current) {
            gallerySpotLightRef.current.color.setHex(0xffc985);
            gallerySpotLightRef.current.intensity = 1.25;
          }
          rendererRef.current.toneMappingExposure = 1.02;
        } else if (lightingPreset === "showroom_warm") {
          if (sceneWithEnv) sceneWithEnv.environmentIntensity = 0.28;
          hemiLightRef.current.color.setHex(0xffdfa8);
          hemiLightRef.current.groundColor.setHex(0x1e1610);
          hemiLightRef.current.intensity = 0.14;
          keyLightRef.current.color.setHex(0xffd296);
          keyLightRef.current.intensity = 2.45;
          rimLightRef.current.color.setHex(0x7dd3fc);
          rimLightRef.current.intensity = 0.72;
          if (gallerySpotLightRef.current) {
            gallerySpotLightRef.current.color.setHex(0xffbe6b);
            gallerySpotLightRef.current.intensity = 5.4;
          }
          rendererRef.current.toneMappingExposure = 1.00;
        } else {
          if (sceneWithEnv) sceneWithEnv.environmentIntensity = 0.42;
          hemiLightRef.current.color.setHex(0xd8e8ff);
          hemiLightRef.current.groundColor.setHex(0x1b1917);
          hemiLightRef.current.intensity = 0.16;
          keyLightRef.current.color.setHex(0xfff4e4);
          keyLightRef.current.intensity = 2.65;
          rimLightRef.current.color.setHex(0x93c5fd);
          rimLightRef.current.intensity = 0.92;
          if (gallerySpotLightRef.current) {
            gallerySpotLightRef.current.color.setHex(0xfff1dc);
            gallerySpotLightRef.current.intensity = 3.4;
          }
          rendererRef.current.toneMappingExposure = 1.02;
        }
      }
      if (gridRef.current) {
        gridRef.current.visible =
          renderEdgeMode === "cad" || (showGrid && floorStyle === "studio");
      }
      markShadowsAndRender();
    }, [theme, showGrid, lightingPreset, wallTone, floorStyle, renderEdgeMode, showRoomArchitecture3D, markShadowsAndRender]);

    // Camera Projection Mode
    useEffect(() => {
      const controls = controlsRef.current;
      const perspCam = perspCamRef.current;
      const orthoCam = orthoCamRef.current;
      if (!controls || !perspCam || !orthoCam) return;

      if (isOrthographic) {
        const offset = new THREE.Vector3().subVectors(perspCam.position, controls.target);
        const dist = offset.length();
        const fovRad = (perspCam.fov * Math.PI) / 180;
        const visibleHeight = 2 * dist * Math.tan(fovRad / 2);
        if (visibleHeight > 0) orthoCam.zoom = 3600 / visibleHeight;
        orthoCam.position.copy(perspCam.position);
        orthoCam.quaternion.copy(perspCam.quaternion);
        orthoCam.updateProjectionMatrix();
        controls.object = orthoCam;
      } else {
        const dir = new THREE.Vector3().subVectors(orthoCam.position, controls.target).normalize();
        if (dir.lengthSq() < 0.001) dir.set(0, 0, 1);
        const fovRad = (perspCam.fov * Math.PI) / 180;
        const visibleHeight = 3600 / Math.max(0.01, orthoCam.zoom);
        const dist = visibleHeight / (2 * Math.tan(fovRad / 2));
        perspCam.position.copy(controls.target).addScaledVector(dir, dist);
        perspCam.quaternion.copy(orthoCam.quaternion);
        perspCam.updateProjectionMatrix();
        controls.object = perspCam;
      }
      controls.update();
      requestRender();
    }, [isOrthographic, requestRender]);

    // Camera Preset Transitions (triggered ONLY when cameraPreset changes — never on module selection or property edits)
    useEffect(() => {
      const controls = controlsRef.current;
      const perspCam = perspCamRef.current;
      const orthoCam = orthoCamRef.current;
      const { project: curProj, activeModuleIndex: curModIdx } = latestStateRef.current;
      const activeMod = curProj.modules[curModIdx] || curProj.modules[0];
      if (!controls || !perspCam || !orthoCam || !activeMod) return;

      const mainMods = curProj.modules.filter((m) => m.category !== "complementary");
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
      (mainMods.length > 0 ? mainMods : [activeMod]).forEach((m, idx) => {
        const mFp = getModuleOrientedFootprint(m, idx);
        minX = Math.min(minX, mFp.x);
        maxX = Math.max(maxX, mFp.x + mFp.planWidth);
        minY = Math.min(minY, mFp.yBottom);
        maxY = Math.max(maxY, mFp.yBottom + mFp.rawHeight);
        minZ = Math.min(minZ, mFp.z);
        maxZ = Math.max(maxZ, mFp.z + mFp.planDepth);
      });
      const roomCeilH = curProj.space?.ceilingHeight || 2800;
      const mainWallLen = curProj.space?.walls?.[0]?.length || 3600;
      const sceneBox = new THREE.Box3(
        new THREE.Vector3(Math.min(minX, 0), Math.min(minY, 0), minZ),
        new THREE.Vector3(Math.max(maxX, Math.min(mainWallLen, maxX + 450)), Math.max(maxY, roomCeilH), maxZ)
      );
      const framed = computeHeroStudioFraming(
        sceneBox,
        perspCam.fov,
        perspCam.aspect,
        cameraPreset === "front" ? "front" : "hero"
      );
      const cx = framed.target.x;
      const cy = framed.target.y;
      const cz = framed.target.z;
      controls.target.set(cx, cy, cz);

      const targetPos = new THREE.Vector3();
      if (cameraPreset === "front") {
        targetPos.copy(framed.position);
      } else if (cameraPreset === "side") {
        targetPos.set(cx - framed.dist * 0.92, cy, cz + 120);
      } else if (cameraPreset === "top") {
        targetPos.set(cx, cy + framed.dist * 1.05, cz + 1);
      } else {
        targetPos.copy(framed.position);
      }

      perspCam.position.copy(targetPos);
      perspCam.lookAt(cx, cy, cz);
      perspCam.updateProjectionMatrix();

      orthoCam.position.copy(targetPos);
      orthoCam.lookAt(cx, cy, cz);
      controls.update();
      requestRender();
    }, [cameraPreset, requestRender]);

    // 2-Directional Interactive 3D Section Clipping Plane (X Boyuna Kesit & Z Enine Kesit) + Solid MDF Section Caps
    useEffect(() => {
      const curRenderer = rendererRef.current;
      const curScene = sceneRef.current;
      const curMeshGroup = meshGroupRef.current;
      if (!curRenderer) return;

      // Clean up any previous section cap group
      if (sectionCapGroupRef.current) {
        if (curScene) curScene.remove(sectionCapGroupRef.current);
        sectionCapGroupRef.current.clear();
        sectionCapGroupRef.current = null;
      }

      // Hide fake dark fuga shadow backing plates while 3D section cut is active so doors/drawers show clean pure panels
      if (curMeshGroup) {
        traverseCabinetObjectsOnly(curMeshGroup, (obj) => {
          if (obj.userData?.isFugaBacking) {
            obj.visible = !section3DAxis;
          }
        });
      }

      if (!section3DAxis) {
        curRenderer.localClippingEnabled = false;
        curRenderer.clippingPlanes = [];
        requestRender();
        return;
      }
      const mod = project.modules[activeModuleIndex] || project.modules[0];
      if (!mod) return;
      curRenderer.localClippingEnabled = true;
      let cutVal = 0;
      if (section3DAxis === "X") {
        cutVal = mod.position.x + Math.round(mod.dimensions.width * section3DRatio);
        curRenderer.clippingPlanes = [new THREE.Plane(new THREE.Vector3(-1, 0, 0), cutVal)];
      } else {
        cutVal = mod.position.z + Math.round(mod.dimensions.depth * section3DRatio);
        curRenderer.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, 0, -1), cutVal)];
      }

      // Generate solid MDF / metal / LED section-cut caps AFTER main scene effect rebuilds meshes
      let rafCapId = 0;
      const buildSectionCaps = () => {
        if (sectionCapGroupRef.current) {
          if (curScene) curScene.remove(sectionCapGroupRef.current);
          sectionCapGroupRef.current.clear();
          sectionCapGroupRef.current = null;
        }
        if (!curScene || !curMeshGroup) return;

        const capGroup = new THREE.Group();
        capGroup.name = "birim_3d_section_caps";
        const unitPlaneGeo = new THREE.PlaneGeometry(1, 1);
        const unitEdgeGeo = new THREE.EdgesGeometry(unitPlaneGeo);
        const mdfCoreMat = new THREE.MeshStandardMaterial({
          color: 0xc29e70, // Natural raw MDF / particleboard core tone
          roughness: 0.92,
          metalness: 0.02,
          side: THREE.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        });
        const innerBoxCoreMat = new THREE.MeshStandardMaterial({
          color: 0xb38b5c, // Slightly deeper core tone for inner drawer sub-front so 18mm klapa vs 16mm inner sub-front reads crisply in section
          roughness: 0.92,
          metalness: 0.02,
          side: THREE.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        });
        const dadoBoardCoreMat = new THREE.MeshStandardMaterial({
          color: 0x9c7446, // Distinct deeper core tone so 8mm grooved back panel & drawer bottom dado slots stand out unmistakably inside 18mm panels
          roughness: 0.9,
          metalness: 0.02,
          side: THREE.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
        });
        const metalCoreMat = new THREE.MeshStandardMaterial({
          color: 0x475569,
          roughness: 0.38,
          metalness: 0.68,
          side: THREE.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        });
        const ledCoreMat = new THREE.MeshBasicMaterial({
          color: 0xfff1c4,
          side: THREE.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: -3,
          polygonOffsetUnits: -3,
        });
        const capOutlineMat = new THREE.LineBasicMaterial({
          color: 0x2d1f10,
          transparent: true,
          opacity: 0.88,
          polygonOffset: true,
          polygonOffsetFactor: -3,
          polygonOffsetUnits: -3,
        });

        const tmpBox = new THREE.Box3();
        curMeshGroup.updateMatrixWorld(true);

        traverseCabinetObjectsOnly(curMeshGroup, (obj) => {
          if (obj.userData?.isFugaBacking) {
            obj.visible = false;
            return;
          }
          if (!(obj instanceof THREE.Mesh) || !obj.visible) return;
          if (!obj.userData?.componentId) return;
          if (obj.userData.isSelectionHelper || obj.userData.isInteriorAo) return;
          const role = String(obj.userData.role || "");
          if (role === "door_hinge" || role === "led_strip") return;

          tmpBox.setFromObject(obj);
          if (tmpBox.isEmpty()) return;

          const compIdStr = String(obj.userData.componentId || "");
          const isLedCap =
            String(obj.userData.matDef?.id || "").startsWith("mat_led_") ||
            compIdStr.includes("_recessed_led_");
          const isWoodGolaBoxCap =
            role === "gola_profile" &&
            (compIdStr.includes("gola_moulded_box") ||
              compIdStr.includes("gola_melamine_box") ||
              compIdStr.includes("gola_bevel_backing"));
          const isMetal =
            !isLedCap &&
            !isWoodGolaBoxCap &&
            (role === "hanging_rail" ||
              role === "drawer_slide" ||
              role === "gola_profile" ||
              role === "door_handle" ||
              role === "drawer_handle" ||
              role === "special_fitting" ||
              String(obj.userData.matDef?.id || "").includes("metal"));
          const isDadoBoard = role === "drawer_bottom" || role === "carcass_back";
          const isInnerDrawerBox = role === "drawer_box" || isWoodGolaBoxCap;
          const capMat = isLedCap
            ? ledCoreMat
            : isMetal
            ? metalCoreMat
            : isDadoBoard
            ? dadoBoardCoreMat
            : isInnerDrawerBox
            ? innerBoxCoreMat
            : mdfCoreMat;
          const planeBias = isLedCap ? 0.12 : isDadoBoard ? 0.17 : 0.25;

          if (section3DAxis === "X") {
            if (tmpBox.min.x < cutVal - 0.3 && tmpBox.max.x > cutVal + 0.3) {
              const capD = tmpBox.max.z - tmpBox.min.z;
              const capH = tmpBox.max.y - tmpBox.min.y;
              if (capD >= 2 && capH >= 2) {
                const bevelEdge = obj.userData?.bevelPullEdge as "top" | "bottom" | undefined;
                const isJPullCap = obj.userData?.crossSectionProfile === "j_pull_bevel";
                if (isJPullCap && capH >= 60 && capD >= 12) {
                  const xCap = cutVal - planeBias;
                  const jEdge: "top" | "bottom" = obj.userData?.jPullEdge === "bottom" ? "bottom" : "top";
                  const worldFrontDir = new THREE.Vector3(0, 0, 1).transformDirection(obj.matrixWorld);
                  const zFlip = worldFrontDir.z >= 0 ? 1 : -1;
                  const midY = (tmpBox.min.y + tmpBox.max.y) * 0.5;
                  const midZ = (tmpBox.min.z + tmpBox.max.z) * 0.5;
                  const yzLoop = buildJPullCrossSectionLoop(capH, capD, jEdge);
                  const contour2D = yzLoop.map(([py, pz]) => new THREE.Vector2(py, pz));
                  const faces = THREE.ShapeUtils.triangulateShape(contour2D, []);
                  const triPositions: number[] = [];
                  for (const [ia, ib, ic] of faces) {
                    const [ya, za] = yzLoop[ia];
                    const [yb, zb] = yzLoop[ib];
                    const [yc, zc] = yzLoop[ic];
                    triPositions.push(
                      xCap, midY + ya, midZ + za * zFlip,
                      xCap, midY + yb, midZ + zb * zFlip,
                      xCap, midY + yc, midZ + zc * zFlip
                    );
                  }
                  const jpCapGeo = new THREE.BufferGeometry();
                  jpCapGeo.setAttribute("position", new THREE.Float32BufferAttribute(triPositions, 3));
                  jpCapGeo.computeVertexNormals();
                  const cap = new THREE.Mesh(jpCapGeo, capMat);
                  cap.raycast = () => {};
                  if (!isLedCap) {
                    const xLine = xCap + 0.04;
                    const linePositions: number[] = [];
                    for (let i = 0; i < yzLoop.length; i++) {
                      const [y0, z0] = yzLoop[i];
                      const [y1, z1] = yzLoop[(i + 1) % yzLoop.length];
                      linePositions.push(
                        xLine, midY + y0, midZ + z0 * zFlip,
                        xLine, midY + y1, midZ + z1 * zFlip
                      );
                    }
                    const jpOutlineGeo = new THREE.BufferGeometry();
                    jpOutlineGeo.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3));
                    cap.add(new THREE.LineSegments(jpOutlineGeo, capOutlineMat));
                  }
                  capGroup.add(cap);
                } else if (bevelEdge === "top" || bevelEdge === "bottom") {
                  const xCap = cutVal - planeBias;
                  const worldFrontDir = new THREE.Vector3(0, 0, 1).transformDirection(obj.matrixWorld);
                  const zFront = worldFrontDir.z >= 0 ? tmpBox.max.z : tmpBox.min.z;
                  const zBack = worldFrontDir.z >= 0 ? tmpBox.min.z : tmpBox.max.z;
                  const drop = Math.min(capH * 0.45, Number(obj.userData?.bevelDropMm) || capD);
                  const y0 = tmpBox.min.y;
                  const y1 = tmpBox.max.y;
                  const yBackBot = bevelEdge === "bottom" ? y0 + drop : y0;
                  const yBackTop = bevelEdge === "top" ? y1 - drop : y1;
                  const p0: [number, number, number] = [xCap, y0, zFront];
                  const p1: [number, number, number] = [xCap, y1, zFront];
                  const p2: [number, number, number] = [xCap, yBackTop, zBack];
                  const p3: [number, number, number] = [xCap, yBackBot, zBack];
                  const trapGeo = new THREE.BufferGeometry();
                  trapGeo.setAttribute(
                    "position",
                    new THREE.Float32BufferAttribute([...p0, ...p1, ...p2, ...p0, ...p2, ...p3], 3)
                  );
                  trapGeo.computeVertexNormals();
                  const cap = new THREE.Mesh(trapGeo, capMat);
                  cap.raycast = () => {};
                  if (!isLedCap) {
                    const xLine = xCap + 0.04;
                    const l0: [number, number, number] = [xLine, y0, zFront];
                    const l1: [number, number, number] = [xLine, y1, zFront];
                    const l2: [number, number, number] = [xLine, yBackTop, zBack];
                    const l3: [number, number, number] = [xLine, yBackBot, zBack];
                    const trapOutlineGeo = new THREE.BufferGeometry();
                    trapOutlineGeo.setAttribute(
                      "position",
                      new THREE.Float32BufferAttribute(
                        [...l0, ...l1, ...l1, ...l2, ...l2, ...l3, ...l3, ...l0],
                        3
                      )
                    );
                    cap.add(new THREE.LineSegments(trapOutlineGeo, capOutlineMat));
                  }
                  capGroup.add(cap);
                } else {
                  const cap = new THREE.Mesh(unitPlaneGeo, capMat);
                  cap.scale.set(capD, capH, 1);
                  cap.rotation.y = Math.PI / 2;
                  cap.position.set(
                    cutVal - planeBias,
                    (tmpBox.min.y + tmpBox.max.y) * 0.5,
                    (tmpBox.min.z + tmpBox.max.z) * 0.5
                  );
                  cap.raycast = () => {};
                  if (!isLedCap) {
                    const outline = new THREE.LineSegments(unitEdgeGeo, capOutlineMat);
                    outline.position.z = 0.04;
                    cap.add(outline);
                  }
                  capGroup.add(cap);
                }
              }
            }
          } else {
            if (tmpBox.min.z < cutVal - 0.3 && tmpBox.max.z > cutVal + 0.3) {
              const capW = tmpBox.max.x - tmpBox.min.x;
              const capH = tmpBox.max.y - tmpBox.min.y;
              if (capW >= 2 && capH >= 2) {
                const cap = new THREE.Mesh(unitPlaneGeo, capMat);
                cap.scale.set(capW, capH, 1);
                cap.position.set(
                  (tmpBox.min.x + tmpBox.max.x) * 0.5,
                  (tmpBox.min.y + tmpBox.max.y) * 0.5,
                  cutVal - planeBias
                );
                cap.raycast = () => {};
                if (!isLedCap) {
                  const outline = new THREE.LineSegments(unitEdgeGeo, capOutlineMat);
                  outline.position.z = 0.04;
                  cap.add(outline);
                }
                capGroup.add(cap);
              }
            }
          }
        });

        curScene.add(capGroup);
        sectionCapGroupRef.current = capGroup;
        requestRender();
      };

      buildSectionCaps();
      rafCapId = window.requestAnimationFrame(buildSectionCaps);
      return () => {
        if (rafCapId) window.cancelAnimationFrame(rafCapId);
      };
    }, [section3DAxis, section3DRatio, project, activeModuleIndex, requestRender, GEOMETRY_ENGINE_REV]);

    // Fast Selection & Active Module Highlight & Selection Frame Synchronization
    const updateSelectionAndActiveFrames = useCallback(() => {
      const meshGroup = meshGroupRef.current;
      if (!meshGroup) return;
      const isLight = theme !== "dark";

      traverseCabinetObjectsOnly(meshGroup, (obj) => {
        if (obj instanceof THREE.Mesh && obj.userData?.componentId) {
          const isSel = obj.userData.componentId === selectedComponentId;
          const isActMod = obj.userData.moduleIndex === activeModuleIndex;
          const isLedObj =
            String(obj.userData.matDef?.id || "").startsWith("mat_led_") ||
            String(obj.userData.componentId || "").includes("_recessed_led_");
          const isRail =
            !isLedObj &&
            (obj.userData.role === "hanging_rail" ||
              ((obj.userData.role === "door_handle" || obj.userData.role === "drawer_handle") &&
                obj.userData.handleCategory !== "milled_wood_grip" &&
                obj.userData.handleCategory !== "j_pull") ||
              obj.userData.role === "gola_profile" ||
              obj.userData.role === "drawer_slide" ||
              obj.userData.role === "door_hinge" ||
              obj.userData.role?.includes("fit"));
          if (!obj.userData.preserveCustomMaterial) {
            if (isXrayActive && !isLedObj) {
              obj.material = xrayIcePanelMat;
            } else if (renderEdgeMode === "cad") {
              const isHandleRole =
                obj.userData.role === "door_handle" ||
                obj.userData.role === "drawer_handle" ||
                obj.userData.role === "gola_profile";
              obj.material = isSel
                ? cadSelectedMat
                : isHandleRole
                ? cadHardwareMat
                : cadTechnicalMat;
            } else {
              const matDef = obj.userData.matDef || DEFAULT_MATERIALS[0];
              const grainDir = obj.userData.grainDir || "lengthwise";
              const surfFin = obj.userData.surfFin;
              obj.material = getV3PbrMaterial(matDef, isSel, isRail, grainDir, surfFin);
            }
          }

          for (let cIdx = 0; cIdx < obj.children.length; cIdx++) {
            const ch = obj.children[cIdx];
            if (ch instanceof THREE.LineSegments) {
              if (ch.userData?.isCadSwingLine) {
                ch.visible = renderEdgeMode === "cad";
              } else if (ch.userData?.isRevealSeam) {
                ch.visible = renderEdgeMode === "photoreal";
              } else {
                ch.visible = isSel || renderEdgeMode !== "photoreal";
                if (ch.visible) {
                  ch.material = getCachedEdgeMaterial(
                    isSel,
                    isActMod,
                    isLight,
                    renderEdgeMode === "photoreal"
                  );
                }
              }
            }
          }
        }
      });

      const actModGroup = activeModFrameGroupRef.current;
      if (actModGroup) {
        disposeObject3DTree(actModGroup);
        actModGroup.clear();
        actModGroup.position.set(0, 0, 0);
        const mainModsCount = project.modules.filter((m) => m.category !== "complementary").length;
        const activeMod = project.modules[activeModuleIndex];
        if (activeMod && activeMod.category !== "complementary") {
          const modAnchor = createModuleGroup(activeMod);
          if (mainModsCount > 1 || renderEdgeMode === "cad") {
            const selW = activeMod.dimensions.width + 12;
            const selD = activeMod.dimensions.depth + 12;
            const baseRingGeo = new THREE.BoxGeometry(selW, 4, selD);
            const baseRingEdges = new THREE.EdgesGeometry(baseRingGeo);
            baseRingGeo.dispose();
            const baseOutline = new THREE.LineSegments(
              baseRingEdges,
              new THREE.LineBasicMaterial({
                color: 0x141413,
                transparent: true,
                opacity: 0.45,
              })
            );
            baseOutline.raycast = () => {};
            baseOutline.position.set(
              activeMod.dimensions.width / 2,
              2,
              activeMod.dimensions.depth / 2
            );
            modAnchor.add(baseOutline);
          }

          // V96: SketchUp-style 3D Live Resize Handles (◀ Left, ▶ Right, ▲ Top) — hidden while 3D Section Cut is active!
          if (!activeMod.isFixedWidth && !section3DAxis) {
            const wM = activeMod.dimensions.width;
            const hM = activeMod.dimensions.height;
            const dM = activeMod.dimensions.depth;
            const add3DResizePill = (
              axis: "width_left" | "width_right" | "height_top" | "depth_front",
              px: number,
              py: number,
              pz: number,
              colorHex: number,
              isVertical: boolean
            ) => {
              const handleGrp = new THREE.Group();
              handleGrp.position.set(px, py, pz);
              const pillMat = new THREE.MeshBasicMaterial({
                color: colorHex,
                depthTest: false,
                depthWrite: false,
                transparent: true,
                opacity: 0.92,
                toneMapped: false,
              });
              const pillGeo = isVertical
                ? new THREE.CapsuleGeometry(13, 46, 8, 12)
                : new THREE.CapsuleGeometry(13, 46, 8, 12).rotateZ(Math.PI / 2);
              const pillMesh = new THREE.Mesh(pillGeo, pillMat);
              pillMesh.renderOrder = 1002;
              pillMesh.userData = { isResizeHandle3D: true, resizeAxis: axis, modIdx: activeModuleIndex };
              handleGrp.add(pillMesh);

              const rimMat = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                depthTest: false,
                depthWrite: false,
                transparent: true,
                opacity: 0.72,
                wireframe: true,
              });
              const rimMesh = new THREE.Mesh(pillGeo, rimMat);
              rimMesh.scale.setScalar(1.12);
              rimMesh.renderOrder = 1001;
              rimMesh.raycast = () => {};
              handleGrp.add(rimMesh);

              // Generous invisible grab sphere for effortless 3D picking
              const hitMesh = new THREE.Mesh(
                new THREE.SphereGeometry(52, 8, 8),
                new THREE.MeshBasicMaterial({ visible: false })
              );
              hitMesh.userData = { isResizeHandle3D: true, resizeAxis: axis, modIdx: activeModuleIndex };
              handleGrp.add(hitMesh);

              modAnchor.add(handleGrp);
            };
            add3DResizePill("width_left", -28, hM * 0.5, dM * 0.85, 0x10b981, true);
            add3DResizePill("width_right", wM + 28, hM * 0.5, dM * 0.85, 0x10b981, true);
            add3DResizePill("height_top", wM * 0.5, hM + 30, dM * 0.85, 0x0ea5e9, false);
            add3DResizePill("depth_front", wM * 0.5, Math.min(hM * 0.5, 420), dM + 34, 0xf59e0b, false);
          }

          // Lightweight Active Bay Highlight Frame in actModGroup (0ms update on bay/module click!)
          const isCapsuleHull =
            activeMod.carcass.hullShape === "capsule_stadium" ||
            activeMod.carcass.hullShape === "capsule_table";
          const safeBayIdx = Math.max(0, Math.min(activeMod.bays.length - 1, activeBayIndex));
          const activeBayObj = activeMod.bays[safeBayIdx];
          const activeBayHasExternalDrawers = Boolean(
            activeBayObj?.drawers?.some((d) => !d.isInternal && !d.isHidden)
          );
          const activeBayIsTrulyOpen =
            !activeBayHasExternalDrawers &&
            (Boolean(activeMod.isOpenFront) ||
              activeBayObj?.door?.type === "open" ||
              activeBayObj?.door?.doorSystemId === "open");
          const showBayOverlay =
            !isCapsuleHull &&
            (cutawayActiveBay ||
              doorsHiddenIn3D ||
              (Boolean(selectedComponentId) &&
                (doorOpenAngleDeg > 5 || activeBayIsTrulyOpen)));
          if (showBayOverlay && activeMod.bays.length >= 1) {
            const T = activeMod.carcass.panelThickness || 18;
            const plinthH = activeMod.carcass.plinthHeight ?? 100;
            const fsAct = calculateFourSpaceDimensions(activeMod);
            const innerH =
              fsAct.usableInternal.netInnerHeightMm ||
              Math.max(300, activeMod.dimensions.height - plinthH - 2 * T);
            let curBayX = T;
            for (let bI = 0; bI < safeBayIdx; bI++) {
              curBayX += (fsAct.usableInternal.bayClearWidthsMm[bI] || 500) + T;
            }
            const bw =
              fsAct.usableInternal.bayClearWidthsMm[safeBayIdx] ||
              Math.round(
                (activeMod.dimensions.width - (activeMod.bays.length + 1) * T) /
                  activeMod.bays.length
              );
            // Clamp active bay highlight frame height to sloped ceiling if module has roofSlope / slopedCeiling
            let bayEffectiveInnerH = innerH;
            const rsFrame = activeMod.carcass.roofSlope;
            const scFrame = activeMod.carcass.slopedCeiling;
            if ((rsFrame && rsFrame.side !== "none") || (scFrame && scFrame.mode !== "none")) {
              const modW = activeMod.dimensions.width;
              const modH = activeMod.dimensions.height;
              const fSide =
                rsFrame && rsFrame.side !== "none"
                  ? rsFrame.side
                  : scFrame!.mode === "left_slope"
                  ? "left"
                  : scFrame!.mode === "right_slope"
                  ? "right"
                  : "rear";
              const fKnee =
                rsFrame && rsFrame.side !== "none"
                  ? Math.max(400, Math.min(modH - 120, rsFrame.kneeWallHeightMm))
                  : Math.max(400, Math.min(modH - 120, scFrame!.kneeHeightMm));
              const fRun =
                rsFrame && rsFrame.side !== "none"
                  ? Math.max(150, Math.min(modW, rsFrame.slopeRunMm))
                  : Math.max(
                      150,
                      Math.min(
                        modW,
                        Math.round(
                          (modH - fKnee) /
                            Math.max(0.15, Math.tan(((scFrame!.slopeAngleDeg || 35) * Math.PI) / 180))
                        )
                      )
                    );
              const fRad = Math.atan2(modH - fKnee, fRun);
              const sampleSlopeY = (xMm: number) => {
                if (fSide === "left") return xMm >= fRun ? modH : fKnee + (xMm / fRun) * (modH - fKnee);
                if (fSide === "right") {
                  const dR = modW - xMm;
                  return dR >= fRun ? modH : fKnee + (dR / fRun) * (modH - fKnee);
                }
                return modH;
              };
              const minBayTop =
                Math.min(sampleSlopeY(curBayX), sampleSlopeY(curBayX + bw)) -
                T / Math.max(0.4, Math.cos(fRad));
              bayEffectiveInnerH = Math.max(120, Math.min(innerH, minBayTop - plinthH - T));
            }

            const bayFrameGeo = new THREE.BoxGeometry(
              Math.max(80, bw - 4),
              Math.max(120, bayEffectiveInnerH - 4),
              Math.max(100, activeMod.dimensions.depth - T - 8)
            );
            const bayFrameEdgesGeo = new THREE.EdgesGeometry(bayFrameGeo);
            bayFrameGeo.dispose();
            const bayFrameLines = new THREE.LineSegments(
              bayFrameEdgesGeo,
              new THREE.LineBasicMaterial({
                color: 0x0284c7,
                transparent: true,
                opacity: 0.95,
              })
            );
            bayFrameLines.raycast = () => {};
            bayFrameLines.position.set(
              curBayX + bw / 2,
              plinthH + T + bayEffectiveInnerH / 2,
              T + (activeMod.dimensions.depth - T) / 2
            );
            modAnchor.add(bayFrameLines);

            const frontRectGeo = new THREE.BoxGeometry(
              Math.max(80, bw + 6),
              Math.max(120, bayEffectiveInnerH + 6),
              12
            );
            const frontRectEdgesGeo = new THREE.EdgesGeometry(frontRectGeo);
            frontRectGeo.dispose();
            const frontRectLines = new THREE.LineSegments(
              frontRectEdgesGeo,
              new THREE.LineBasicMaterial({
                color: 0x2563eb,
                transparent: true,
                opacity: 1,
              })
            );
            frontRectLines.raycast = () => {};
            frontRectLines.position.set(
              curBayX + bw / 2,
              plinthH + T + bayEffectiveInnerH / 2,
              activeMod.dimensions.depth + 2
            );
            modAnchor.add(frontRectLines);

            const localAnchor = new THREE.Vector3(
              curBayX + bw,
              plinthH + T + innerH * 0.48,
              activeMod.dimensions.depth
            );
            modAnchor.updateMatrixWorld(true);
            activeBayWorldAnchorRef.current = localAnchor.applyMatrix4(modAnchor.matrixWorld);
          } else {
            activeBayWorldAnchorRef.current = null;
          }

          actModGroup.add(modAnchor);
        } else {
          activeBayWorldAnchorRef.current = null;
        }
      }

      // Update 3D Blue Selection Frame using Oriented Bounding Box (OBB) so angled/open doors match 1-to-1!
      const selGroup = selectionFrameGroupRef.current;
      if (selGroup) {
        disposeObject3DTree(selGroup);
        selGroup.clear();
        selGroup.position.set(0, 0, 0);
        if (selectedComponentId) {
          meshGroup.updateMatrixWorld(true);
          let matchedMesh: THREE.Mesh | null = null;
          traverseCabinetObjectsOnly(meshGroup, (obj) => {
            if (
              !matchedMesh &&
              obj instanceof THREE.Mesh &&
              obj.userData?.componentId === selectedComponentId &&
              (obj.userData?.moduleIndex === activeModuleIndex || obj.userData?.moduleIndex === undefined)
            ) {
              matchedMesh = obj;
            }
          });
          if (matchedMesh) {
            const targetMesh = matchedMesh as THREE.Mesh;
            targetMesh.updateWorldMatrix(true, false);
            if (!targetMesh.geometry.boundingBox) {
              targetMesh.geometry.computeBoundingBox();
            }
            const lBox = targetMesh.geometry.boundingBox;
            if (lBox && !lBox.isEmpty()) {
              const lCenter = new THREE.Vector3();
              const lSize = new THREE.Vector3();
              lBox.getCenter(lCenter);
              lBox.getSize(lSize);
              const wCenter = lCenter.clone().applyMatrix4(targetMesh.matrixWorld);
              const wQuat = new THREE.Quaternion();
              targetMesh.getWorldQuaternion(wQuat);
              const wScale = new THREE.Vector3();
              targetMesh.getWorldScale(wScale);

              const isBoxGeo = targetMesh.geometry instanceof THREE.BoxGeometry;
              if (isBoxGeo) {
                const dFrameGeo = new THREE.BoxGeometry(
                  Math.max(12, lSize.x * Math.abs(wScale.x) + 8),
                  Math.max(12, lSize.y * Math.abs(wScale.y) + 8),
                  Math.max(12, lSize.z * Math.abs(wScale.z) + 8)
                );
                const dFrameLines = new THREE.LineSegments(
                  new THREE.EdgesGeometry(dFrameGeo),
                  new THREE.LineBasicMaterial({ color: 0x1d4ed8, linewidth: 2 })
                );
                dFrameLines.raycast = () => {};
                const dFrameFill = new THREE.Mesh(
                  dFrameGeo,
                  new THREE.MeshBasicMaterial({
                    color: 0x3b82f6,
                    transparent: true,
                    opacity: 0.2,
                    depthWrite: false,
                  })
                );
                dFrameFill.raycast = () => {};
                dFrameLines.position.copy(wCenter);
                dFrameLines.quaternion.copy(wQuat);
                dFrameFill.position.copy(wCenter);
                dFrameFill.quaternion.copy(wQuat);
                selGroup.add(dFrameLines);
                selGroup.add(dFrameFill);
              } else {
                const wPos = new THREE.Vector3();
                targetMesh.getWorldPosition(wPos);
                const clonedGeo = targetMesh.geometry.clone();
                const dFrameLines = new THREE.LineSegments(
                  new THREE.EdgesGeometry(clonedGeo, 18),
                  new THREE.LineBasicMaterial({ color: 0x1d4ed8, linewidth: 2 })
                );
                dFrameLines.raycast = () => {};
                const dFrameFill = new THREE.Mesh(
                  clonedGeo,
                  new THREE.MeshBasicMaterial({
                    color: 0x3b82f6,
                    transparent: true,
                    opacity: 0.22,
                    depthWrite: false,
                    polygonOffset: true,
                    polygonOffsetFactor: -2,
                    polygonOffsetUnits: -2,
                  })
                );
                dFrameFill.raycast = () => {};
                dFrameLines.position.copy(wPos);
                dFrameLines.quaternion.copy(wQuat);
                dFrameLines.scale.copy(wScale);
                dFrameFill.position.copy(wPos);
                dFrameFill.quaternion.copy(wQuat);
                dFrameFill.scale.copy(wScale);
                selGroup.add(dFrameLines);
                selGroup.add(dFrameFill);
              }

              activeDoorWorldAnchorRef.current = wCenter.clone();
            }
          } else {
            activeDoorWorldAnchorRef.current = null;
          }
        } else {
          activeDoorWorldAnchorRef.current = null;
        }
      }

      requestRender();
    }, [activeModuleIndex, activeBayIndex, cutawayActiveBay, doorsHiddenIn3D, doorOpenAngleDeg, selectedComponentId, section3DAxis, project, theme, renderEdgeMode, isXrayActive, requestRender]);
  return { updateSelectionAndActiveFrames };
}
