"use client";

import { resolveModuleHostWallId } from "../../engine/multiWallSnapAndBvhEngine";
import { useEffect } from "react";
import * as THREE from "three";
import { getWallRoomBasis } from "../../engine/angledWallSnapEngine";
import { getEffectiveSpaceWalls } from "../../engine/kitchenSpatialEngine";
import { DEFAULT_MATERIALS, getModuleOrientedFootprint } from "../../adapter/useV3Adapter";
import { type MaterialDefinition } from "@birim/core";
import { getV3PbrMaterial, type ArchitecturalFloorStyle, type ArchitecturalWallTone } from "../../materials/pbrMaterialSystem";
import { useConfiguratorStore } from "../../../store/useConfiguratorStore";
import { classifyModuleArchitecturalZone, resolveEffectiveScopeForMaterial, type PaintTool3DState, type Live3DMaterialPreviewPayload, type CuratedBirimMoodboard } from "../../../v11/quickMaterialAndMoodboardEngine";
import { computeHeroStudioFraming } from "./viewport3DSharedAssets";
import { computeFastParametricSceneBounds } from "./viewport3DSceneHelpers";

import type { UseViewport3DWindowAndKeyEventsCtx } from "./viewport3DTypes";

export function useViewport3DWindowAndKeyEvents(ctx: UseViewport3DWindowAndKeyEventsCtx) {
  const { cadCopyClipboardRef, cameraFlightRef, controlsRef, deleteActiveSelectionSmartRef, duplicateActiveModuleRef, duplicateSceneObjectRef, meshGroupRef, mountRef, needsRenderRef, pausedRef, perspCamRef, previewOriginalMatsRef, removeSceneObjectRef, restoreHoverPreviewMaterials, setActiveBrushMaterialId, setClicked3DContext, setCutawayActiveBay, setDismissedBayPopover, setDoorsHiddenIn3D, setEditingBadge, setExplode3DMenuOpen, setFloorStyle, setGlbLibraryOpen, setHardwareViewMenuOpen, setHardwareViewMode, setIsCtrlPressed, setLightingPreset, setMaterialModeActive, setMoveObjectMode3D, setPaintTool3D, setRenderEdgeMode, setRenderMenuOpen, setSection3DAxis, setSection3DMenuOpen, setSection3DRatio, setShowRoomArchitecture3D, setSnapBannerDedup, setWallTone } = ctx;
    useEffect(() => {
      const onFloorChange = (ev: Event) => {
        const customEv = ev as CustomEvent<ArchitecturalFloorStyle>;
        if (customEv.detail) setFloorStyle(customEv.detail);
      };
      const onDoorsHiddenChange = (ev: Event) => {
        const customEv = ev as CustomEvent<boolean | "toggle">;
        if (customEv.detail === "toggle") {
          setDoorsHiddenIn3D((prev) => {
            const next = !prev;
            if (!next) setCutawayActiveBay(false);
            return next;
          });
        } else if (typeof customEv.detail === "boolean") {
          setDoorsHiddenIn3D(customEv.detail);
          if (!customEv.detail) setCutawayActiveBay(false);
        }
      };
      const onHwViewModeChange = (ev: Event) => {
        const customEv = ev as CustomEvent<"normal" | "hardware" | "technical">;
        if (customEv.detail) {
          setHardwareViewMode(customEv.detail);
          if (customEv.detail === "technical") {
            setRenderEdgeMode("cad");
          } else if (customEv.detail === "normal") {
            setRenderEdgeMode("photoreal");
          }
        }
      };
      const onMatModeChange = (ev: Event) => {
        const customEv = ev as CustomEvent<{ active: boolean; brushMaterialId?: string }>;
        if (customEv.detail) {
          setMaterialModeActive(Boolean(customEv.detail.active));
          if (customEv.detail.brushMaterialId) {
            setActiveBrushMaterialId(customEv.detail.brushMaterialId);
          }
        }
      };
      const onBrushMatChange = (ev: Event) => {
        const customEv = ev as CustomEvent<string>;
        if (customEv.detail) {
          setActiveBrushMaterialId(customEv.detail);
        }
      };
      const onLightPresetChange = (ev: Event) => {
        const detail = (ev as CustomEvent<"daylight" | "showroom_warm" | "night_led">).detail;
        if (detail) setLightingPreset(detail);
      };
      const onWallToneChange = (ev: Event) => {
        const detail = (ev as CustomEvent<ArchitecturalWallTone>).detail;
        if (detail) setWallTone(detail);
      };
      const onSection3DChange = (ev: Event) => {
        const detail = (ev as CustomEvent<{ axis: null | "X" | "Z"; ratio?: number }>).detail;
        if (detail) {
          setSection3DAxis(detail.axis);
          if (typeof detail.ratio === "number") setSection3DRatio(detail.ratio);
        }
      };
      const onRoomWallsChange = (ev: Event) => {
        const detail = (ev as CustomEvent<boolean | "toggle">).detail;
        if (detail === "toggle") setShowRoomArchitecture3D((p) => !p);
        else if (typeof detail === "boolean") setShowRoomArchitecture3D(detail);
      };
      const onMoveModeChange = (ev: Event) => {
        const detail = (ev as CustomEvent<boolean>).detail;
        if (typeof detail === "boolean") setMoveObjectMode3D(detail);
      };
      const onOpenGlbLib = () => setGlbLibraryOpen(true);
      const onFitCamera3D = (ev: Event) => {
        const preset =
          (
            ev as CustomEvent<
              "hero" | "front" | "room_front_persp" | "focus_module" | "side" | "top"
            >
          ).detail || "hero";
        const controls = controlsRef.current;
        const perspective = perspCamRef.current;
        if (!controls || !perspective) return;
        const stNow = useConfiguratorStore.getState();
        if (stNow.isOrthographic && stNow.toggleOrthographic) {
          stNow.toggleOrthographic();
        }
        controls.object = perspective;
        const curProj = stNow.project;
        const curMods = curProj.modules;
        const bounds = computeFastParametricSceneBounds(curMods);
        if (bounds.isEmpty()) return;
        const tanHalfV = Math.tan(THREE.MathUtils.degToRad(perspective.fov) / 2);
        const tanHalfH = tanHalfV * Math.max(0.55, perspective.aspect || 1.5);

        if (preset === "focus_module") {
          const focusMod = curMods[stNow.activeModuleIndex] || curMods[0];
          if (focusMod) {
            const fp = getModuleOrientedFootprint(focusMod, 0);
            const modCx = fp.x + fp.planWidth * 0.5;
            const modCz = fp.z + fp.planDepth * 0.5;
            const modCy = (focusMod.position.y || 0) + focusMod.dimensions.height * 0.5;
            const rotDeg = (((focusMod.rotation?.y ?? 0) % 360) + 360) % 360;
            const rotRad = (rotDeg * Math.PI) / 180;
            const effWalls = getEffectiveSpaceWalls(curProj);
            const roomCenter = { x: (effWalls[0]?.length || 3600) * 0.5, z: 1200 };
            let frontNx = Math.sin(rotRad);
            let frontNz = Math.cos(rotRad);
            for (const w of effWalls) {
              const wb = getWallRoomBasis(w, roomCenter);
              const rDiff = Math.abs(((((rotDeg - wb.moduleRotationYDeg) % 360) + 540) % 360) - 180);
              if (rDiff <= 12) {
                frontNx = wb.inwardNormal.x;
                frontNz = wb.inwardNormal.z;
                break;
              }
            }
            const spanW = Math.max(700, focusMod.dimensions.width);
            const spanH = Math.max(700, focusMod.dimensions.height);
            const spanD = Math.max(400, focusMod.dimensions.depth);
            const distV = (spanH * 0.5) / (tanHalfV * 0.72);
            const distH = (spanW * 0.5) / (tanHalfH * 0.72);
            const focusDist = Math.max(1250, distV, distH) + spanD * 0.55;
            const targetVec = new THREE.Vector3(modCx, modCy, modCz);
            const endPosVec = new THREE.Vector3(
              modCx + frontNx * focusDist + frontNz * (spanW * 0.08),
              modCy + Math.min(180, spanH * 0.08),
              modCz + frontNz * focusDist - frontNx * (spanW * 0.08)
            );
            cameraFlightRef.current = {
              startPos: perspective.position.clone(),
              endPos: endPosVec,
              startTarget: controls.target.clone(),
              endTarget: targetVec,
              startTime: performance.now(),
              durationMs: 520,
            };
            perspective.updateProjectionMatrix();
            needsRenderRef.current = true;
            return;
          }
        }

        if (preset === "room_front_persp" || preset === "front") {
          const effWalls = getEffectiveSpaceWalls(curProj);
          const activeModForFront = curMods[stNow.activeModuleIndex] || curMods[0];
          const activeModWallId =
            effWalls.length > 1 && activeModForFront
              ? resolveModuleHostWallId(curProj, activeModForFront)
              : null;
          // In L or U layouts, prioritize the wall facade of the currently selected module (unless user explicitly switched to an empty wall)
          const hasModulesOnActiveWall =
            Boolean(stNow.activeWallId) &&
            curMods.some((m) => resolveModuleHostWallId(curProj, m) === stNow.activeWallId);
          const targetFacadeWallId =
            activeModWallId &&
            (activeModWallId === stNow.activeWallId || hasModulesOnActiveWall || !stNow.activeWallId)
              ? activeModWallId
              : stNow.activeWallId || activeModWallId || effWalls[0]?.id;
          const selWall =
            effWalls.find((w) => w.id === targetFacadeWallId) || effWalls[0];
          const ceilH = curProj.space?.ceilingHeight || 2600;
          if (selWall) {
            const roomCenter = { x: (effWalls[0]?.length || 3600) * 0.5, z: 1200 };
            const wb = getWallRoomBasis(selWall, roomCenter);
            const wLen = Math.max(1200, selWall.length || 3600);
            const wallMidX = wb.p0.x + wb.rawTangent.x * (wLen * 0.5);
            const wallMidZ = wb.p0.z + wb.rawTangent.z * (wLen * 0.5);
            const eyeY = Math.min(1260, Math.max(1050, ceilH * 0.48));
            const distV = (ceilH * 0.52) / (tanHalfV * 0.78);
            const distH = (wLen * 0.52) / (tanHalfH * 0.80);
            const roomDist = Math.max(2200, distV, distH) + 320;
            const targetVec = new THREE.Vector3(
              wallMidX + wb.inwardNormal.x * 260,
              eyeY,
              wallMidZ + wb.inwardNormal.z * 260
            );
            const endPosVec = new THREE.Vector3(
              wallMidX + wb.inwardNormal.x * roomDist,
              eyeY + 95,
              wallMidZ + wb.inwardNormal.z * roomDist
            );
            cameraFlightRef.current = {
              startPos: perspective.position.clone(),
              endPos: endPosVec,
              startTarget: controls.target.clone(),
              endTarget: targetVec,
              startTime: performance.now(),
              durationMs: 560,
            };
            perspective.updateProjectionMatrix();
            needsRenderRef.current = true;
            return;
          }
        }

        let endPosVec: THREE.Vector3;
        let endTargetVec: THREE.Vector3;
        if (preset === "side" || preset === "top") {
          const center = bounds.getCenter(new THREE.Vector3());
          const size = bounds.getSize(new THREE.Vector3());
          endTargetVec = center.clone();
          if (preset === "side") {
            const distV = (size.y / 2) / (tanHalfV * 0.68);
            const distH = (size.z / 2) / (tanHalfH * 0.70);
            const dist = Math.max(2000, distV, distH) + size.x / 2;
            endPosVec = new THREE.Vector3(center.x + dist, center.y + 80, center.z + 220);
          } else {
            const distV = (size.z / 2) / (tanHalfV * 0.68);
            const distH = (size.x / 2) / (tanHalfH * 0.70);
            const dist = Math.max(2000, distV, distH) + size.y / 2;
            endPosVec = new THREE.Vector3(center.x, center.y + dist, center.z + 180);
          }
        } else {
          const framed = computeHeroStudioFraming(bounds, perspective.fov, perspective.aspect, "hero");
          endTargetVec = framed.target.clone();
          endPosVec = framed.position.clone();
        }
        cameraFlightRef.current = {
          startPos: perspective.position.clone(),
          endPos: endPosVec,
          startTarget: controls.target.clone(),
          endTarget: endTargetVec,
          startTime: performance.now(),
          durationMs: 540,
        };
        perspective.updateProjectionMatrix();
        needsRenderRef.current = true;
      };
      window.addEventListener("birim:set-floor-style", onFloorChange);
      window.addEventListener("birim:set-doors-hidden", onDoorsHiddenChange);
      window.addEventListener("birim:set-hardware-view-mode", onHwViewModeChange);
      window.addEventListener("birim:set-material-mode", onMatModeChange);
      window.addEventListener("birim:set-brush-material", onBrushMatChange);
      window.addEventListener("birim:set-lighting-preset", onLightPresetChange);
      window.addEventListener("birim:set-wall-tone", onWallToneChange);
      window.addEventListener("birim:set-section-3d", onSection3DChange);
      window.addEventListener("birim:set-room-walls-visible", onRoomWallsChange);
      window.addEventListener("birim:set-move-mode-3d", onMoveModeChange);
      window.addEventListener("birim:open-glb-library", onOpenGlbLib);
      const onPaintTool3D = (ev: Event) => {
        const detail = (ev as CustomEvent<PaintTool3DState>).detail;
        if (!detail) return;
        setPaintTool3D((prev) =>
          prev.mode === detail.mode &&
          prev.materialId === detail.materialId &&
          prev.clickBehavior === detail.clickBehavior &&
          prev.zoneScope === detail.zoneScope
            ? prev
            : detail
        );
        if (detail.materialId) {
          setActiveBrushMaterialId((prev) =>
            prev === detail.materialId ? prev : detail.materialId
          );
        }
      };

      const applyTempMatToCompGroup = (
        compGroup: THREE.Object3D,
        targetMatDef: MaterialDefinition,
        isMetalPart: boolean,
        grainDir: "lengthwise" | "crosswise" | "custom",
        surfFin?: "matte" | "satin" | "gloss"
      ) => {
        const previewMat = getV3PbrMaterial(targetMatDef, false, isMetalPart, grainDir, surfFin);
        compGroup.traverse((sub) => {
          if (
            (sub instanceof THREE.Mesh || sub instanceof THREE.InstancedMesh) &&
            !sub.userData?.preserveCustomMaterial &&
            !sub.userData?.isSelectionHelper &&
            !sub.userData?.isContactShadow
          ) {
            if (!previewOriginalMatsRef.current.has(sub)) {
              previewOriginalMatsRef.current.set(sub, sub.material);
            }
            sub.material = previewMat;
          }
        });
      };

      const onPreviewMaterial3D = (ev: Event) => {
        const payload = (ev as CustomEvent<Live3DMaterialPreviewPayload | null>).detail;
        const restored = restoreHoverPreviewMaterials();
        const mGrp = meshGroupRef.current;
        if (!payload || !payload.materialId || !mGrp) {
          if (restored) needsRenderRef.current = true;
          return;
        }
        const st = useConfiguratorStore.getState();
        const allMats = [...DEFAULT_MATERIALS, ...(st.project.customMaterials || [])];
        const matDef = allMats.find((m) => m.id === payload.materialId);
        if (!matDef) return;
        const { effectiveScope, blockedErrorTr } = resolveEffectiveScopeForMaterial(payload.scope, matDef);
        if (blockedErrorTr) return;
        const actIdx =
          typeof payload.activeModuleIndex === "number"
            ? payload.activeModuleIndex
            : st.activeModuleIndex;

        mGrp.children.forEach((modContainer, mIdx) => {
          const mod = st.project.modules[mIdx];
          if (!mod) return;
          const zone = classifyModuleArchitecturalZone(mod);
          for (const compGroup of modContainer.children) {
            const role = String(compGroup.userData?.role || "");
            if (!role) continue;
            const curMatId = String(compGroup.userData?.matDef?.id || "");
            if (payload.replaceFromMaterialId) {
              if (curMatId === payload.replaceFromMaterialId) {
                const isMetal =
                  role === "door_handle" || role === "drawer_handle" || role === "gola_profile";
                applyTempMatToCompGroup(
                  compGroup,
                  matDef,
                  isMetal,
                  (compGroup.userData?.grainDir as "lengthwise" | "crosswise" | "custom") || "lengthwise",
                  mod.surfaceFinishOverride
                );
              }
              continue;
            }
            const isDoorOrDrawer =
              role === "door" ||
              role.startsWith("door_left") ||
              role.startsWith("door_right") ||
              role === "door_sliding" ||
              role === "drawer_front";
            const isCarcass =
              role.startsWith("carcass_") || role === "shelf" || role === "drawer_box";
            const isCountertop = role === "countertop" || mod.complementaryRole === "countertop";
            const isPlinth = role === "plinth" || (mod.complementaryRole as string) === "plinth" || mod.complementaryRole === "plinth_strip";
            const isHandleOrGola =
              (role === "door_handle" || role === "drawer_handle" || role === "gola_profile") &&
              compGroup.userData?.handleCategory !== "j_pull" &&
              compGroup.userData?.handleCategory !== "milled_wood_grip";

            let match = false;
            if (effectiveScope === "active_doors" && mIdx === actIdx && isDoorOrDrawer) match = true;
            else if (
              effectiveScope === "active_module" &&
              mIdx === actIdx &&
              (isDoorOrDrawer || isCarcass || isPlinth)
            )
              match = true;
            else if (effectiveScope === "base_cabinets" && zone === "base" && isDoorOrDrawer)
              match = true;
            else if (effectiveScope === "wall_cabinets" && zone === "wall" && isDoorOrDrawer)
              match = true;
            else if (
              effectiveScope === "tall_and_island" &&
              zone === "tall_or_island" &&
              isDoorOrDrawer
            )
              match = true;
            else if (effectiveScope === "active_carcass" && mIdx === actIdx && isCarcass) match = true;
            else if (effectiveScope === "active_plinth" && mIdx === actIdx && isPlinth) match = true;
            else if (effectiveScope === "all_fronts" && isDoorOrDrawer) match = true;
            else if (effectiveScope === "countertops" && isCountertop) match = true;
            else if (effectiveScope === "carcass_all" && isCarcass) match = true;
            else if (effectiveScope === "plinths" && isPlinth) match = true;
            else if (effectiveScope === "handles_gola" && isHandleOrGola) match = true;

            if (match) {
              applyTempMatToCompGroup(
                compGroup,
                matDef,
                isHandleOrGola,
                (compGroup.userData?.grainDir as "lengthwise" | "crosswise" | "custom") || "lengthwise",
                mod.surfaceFinishOverride
              );
            }
          }
        });
        needsRenderRef.current = true;
      };

      const onPreviewMoodboard3D = (ev: Event) => {
        const mb = (ev as CustomEvent<CuratedBirimMoodboard | null>).detail;
        const restored = restoreHoverPreviewMaterials();
        const mGrp = meshGroupRef.current;
        if (!mb || !mGrp) {
          if (restored) needsRenderRef.current = true;
          return;
        }
        const st = useConfiguratorStore.getState();
        const matLookup = new Map<string, MaterialDefinition>(
          [...DEFAULT_MATERIALS, ...(st.project.customMaterials || [])].map((m) => [m.id, m])
        );
        const hasWallModules = st.project.modules.some(
          (pm) => classifyModuleArchitecturalZone(pm) === "wall"
        );
        mGrp.children.forEach((modContainer, mIdx) => {
          const mod = st.project.modules[mIdx];
          if (!mod) return;
          const zone = classifyModuleArchitecturalZone(mod);
          const hasDoorsAndExtDrawers =
            (zone === "tall_or_island" || !hasWallModules) &&
            (mod.bays || []).some((b) => b.door && b.door.type !== "open") &&
            (mod.bays || []).some((b) => (b.drawers || []).some((d) => !d.isInternal && !d.isHidden));
          const doorFrontDef = matLookup.get(
            zone === "wall"
              ? mb.wallFrontMaterialId
              : hasDoorsAndExtDrawers
              ? mb.wallFrontMaterialId
              : zone === "tall_or_island"
              ? mb.tallFrontMaterialId
              : mb.baseFrontMaterialId
          );
          const drawerFrontDef = matLookup.get(
            zone === "wall"
              ? mb.wallFrontMaterialId
              : hasDoorsAndExtDrawers
              ? mb.baseFrontMaterialId
              : zone === "tall_or_island"
              ? mb.tallFrontMaterialId
              : mb.baseFrontMaterialId
          );
          const carcDef = matLookup.get(mb.carcassMaterialId);
          const stoneDef = matLookup.get(mb.countertopMaterialId);
          const plinthDef = matLookup.get(mb.plinthMaterialId);
          const handleDef = matLookup.get(mb.handleMaterialId);

          for (const compGroup of modContainer.children) {
            const role = String(compGroup.userData?.role || "");
            if (!role) continue;
            const grainDir =
              (compGroup.userData?.grainDir as "lengthwise" | "crosswise" | "custom") || "lengthwise";
            const isDoor =
              role === "door" ||
              role.startsWith("door_left") ||
              role.startsWith("door_right") ||
              role === "door_sliding";
            const isDrawerFront = role === "drawer_front";
            const isCountertop = role === "countertop" || mod.complementaryRole === "countertop";
            const isPlinth = role === "plinth" || (mod.complementaryRole as string) === "plinth" || mod.complementaryRole === "plinth_strip";
            const isHandleOrGola =
              (role === "door_handle" || role === "drawer_handle" || role === "gola_profile") &&
              compGroup.userData?.handleCategory !== "j_pull" &&
              compGroup.userData?.handleCategory !== "milled_wood_grip";
            const isCarcass = role.startsWith("carcass_") || role === "shelf";

            if (isCountertop && stoneDef) {
              applyTempMatToCompGroup(compGroup, stoneDef, false, grainDir, mb.surfaceFinishOverride);
            } else if (isDoor && doorFrontDef) {
              applyTempMatToCompGroup(compGroup, doorFrontDef, false, grainDir, mb.surfaceFinishOverride);
            } else if (isDrawerFront && drawerFrontDef) {
              applyTempMatToCompGroup(compGroup, drawerFrontDef, false, grainDir, mb.surfaceFinishOverride);
            } else if (isPlinth && plinthDef) {
              applyTempMatToCompGroup(compGroup, plinthDef, false, grainDir, mb.surfaceFinishOverride);
            } else if (isHandleOrGola && handleDef) {
              applyTempMatToCompGroup(compGroup, handleDef, true, grainDir, mb.surfaceFinishOverride);
            } else if (isCarcass && carcDef) {
              applyTempMatToCompGroup(compGroup, carcDef, false, grainDir, mb.surfaceFinishOverride);
            }
          }
        });
        needsRenderRef.current = true;
      };

      const onFocusShortcutKey = (ke: KeyboardEvent) => {
        const tag = (ke.target as HTMLElement | null)?.tagName || "";
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (ke.target as HTMLElement | null)?.isContentEditable) return;
        if (!ke.ctrlKey && !ke.metaKey && !ke.altKey && (ke.key === "f" || ke.key === "F")) {
          ke.preventDefault();
          window.dispatchEvent(new CustomEvent("birim:fit-camera-3d", { detail: "focus_module" }));
        }
      };
      window.addEventListener("birim:fit-camera-3d", onFitCamera3D);
      window.addEventListener("keydown", onFocusShortcutKey);
      window.addEventListener("birim:set-paint-tool-3d", onPaintTool3D);
      window.addEventListener("birim:preview-material-3d", onPreviewMaterial3D);
      window.addEventListener("birim:preview-moodboard-3d", onPreviewMoodboard3D);
      return () => {
        window.removeEventListener("birim:set-floor-style", onFloorChange);
        window.removeEventListener("birim:set-doors-hidden", onDoorsHiddenChange);
        window.removeEventListener("birim:set-hardware-view-mode", onHwViewModeChange);
        window.removeEventListener("birim:set-material-mode", onMatModeChange);
        window.removeEventListener("birim:set-brush-material", onBrushMatChange);
        window.removeEventListener("birim:set-lighting-preset", onLightPresetChange);
        window.removeEventListener("birim:set-wall-tone", onWallToneChange);
        window.removeEventListener("birim:set-section-3d", onSection3DChange);
        window.removeEventListener("birim:set-room-walls-visible", onRoomWallsChange);
        window.removeEventListener("birim:set-move-mode-3d", onMoveModeChange);
        window.removeEventListener("birim:open-glb-library", onOpenGlbLib);
        window.removeEventListener("birim:fit-camera-3d", onFitCamera3D);
        window.removeEventListener("keydown", onFocusShortcutKey);
        window.removeEventListener("birim:set-paint-tool-3d", onPaintTool3D);
        window.removeEventListener("birim:preview-material-3d", onPreviewMaterial3D);
        window.removeEventListener("birim:preview-moodboard-3d", onPreviewMoodboard3D);
      };
    }, []);

    useEffect(() => {
      const onKeyDown = (ev: KeyboardEvent) => {
        if (ev.code === "Space" && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
          const tag = (ev.target as HTMLElement | null)?.tagName?.toLowerCase();
          const isEditable =
            tag === "input" ||
            tag === "textarea" ||
            tag === "select" ||
            Boolean((ev.target as HTMLElement | null)?.isContentEditable);
          if (!isEditable) {
            ev.preventDefault();
            const curSt = useConfiguratorStore.getState();
            const opening = curSt.doorOpenAngleDeg < 15 && curSt.drawerOpenMm < 30;
            curSt.setDoorOpenAngleDeg(opening ? 82 : 0, true);
            curSt.setDrawerOpenMm(opening ? 300 : 0, true);
            return;
          }
        }
        if ((ev.key === "Delete" || ev.key === "Backspace") && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
          const tag = (ev.target as HTMLElement | null)?.tagName?.toLowerCase();
          const isEditable =
            tag === "input" ||
            tag === "textarea" ||
            tag === "select" ||
            Boolean((ev.target as HTMLElement | null)?.isContentEditable);
          if (!isEditable && !pausedRef.current && !(ev as unknown as { __birimDeleteHandled?: boolean }).__birimDeleteHandled) {
            (ev as unknown as { __birimDeleteHandled?: boolean }).__birimDeleteHandled = true;
            const curSt = useConfiguratorStore.getState();
            if (curSt.selectedSceneObjectId) {
              ev.preventDefault();
              removeSceneObjectRef.current(curSt.selectedSceneObjectId);
              return;
            }
            if (curSt.selectedComponentId) {
              ev.preventDefault();
              deleteActiveSelectionSmartRef.current();
              return;
            }
          }
        }
        if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && !ev.shiftKey) {
          const k = ev.key.toLowerCase();
          if (k === "c" || k === "v") {
            const tag = (ev.target as HTMLElement | null)?.tagName?.toLowerCase();
            const isEditable =
              tag === "input" ||
              tag === "textarea" ||
              tag === "select" ||
              Boolean((ev.target as HTMLElement | null)?.isContentEditable);
            if (!isEditable && !pausedRef.current) {
              const curSt = useConfiguratorStore.getState();
              if (k === "c") {
                if (typeof window !== "undefined" && window.getSelection()?.toString()) {
                  return;
                }
                if (curSt.selectedSceneObjectId) {
                  ev.preventDefault();
                  cadCopyClipboardRef.current = {
                    kind: "sceneObject",
                    id: curSt.selectedSceneObjectId,
                  };
                  return;
                }
                const actMod = curSt.project.modules[curSt.activeModuleIndex];
                if (actMod) {
                  ev.preventDefault();
                  cadCopyClipboardRef.current = {
                    kind: "module",
                    moduleId: actMod.id,
                  };
                  return;
                }
              } else if (k === "v" && cadCopyClipboardRef.current) {
                const clip = cadCopyClipboardRef.current;
                if (clip.kind === "sceneObject") {
                  const exists = (curSt.project.sceneObjects || []).some((o) => o.id === clip.id);
                  if (exists) {
                    ev.preventDefault();
                    duplicateSceneObjectRef.current(clip.id);
                    return;
                  }
                } else if (clip.kind === "module") {
                  const mIdx = curSt.project.modules.findIndex((m) => m.id === clip.moduleId);
                  if (mIdx >= 0) {
                    ev.preventDefault();
                    if (curSt.activeModuleIndex !== mIdx) {
                      curSt.setActiveModuleIndex(mIdx);
                    }
                    duplicateActiveModuleRef.current();
                    return;
                  }
                }
              }
            }
          }
        }
        if (ev.key === "Escape") {
          setClicked3DContext(null);
          setEditingBadge(null);
          setRenderMenuOpen(false);
          setHardwareViewMenuOpen(false);
          setSection3DMenuOpen(false);
          setExplode3DMenuOpen(false);
          setDismissedBayPopover(true);
          setSnapBannerDedup(null);
        }
        if ((ev.key === "Control" || ev.key === "Meta") && !ev.shiftKey && !ev.altKey) {
          setIsCtrlPressed(true);
          const canvas = mountRef.current?.querySelector("canvas");
          if (canvas) {
            canvas.style.cursor = "move";
          }
        } else if (ev.shiftKey || ev.altKey) {
          setIsCtrlPressed(false);
        }
      };

      const onKeyUp = (ev: KeyboardEvent) => {
        if (ev.key === "Control" || ev.key === "Meta" || (!ev.ctrlKey && !ev.metaKey)) {
          setIsCtrlPressed(false);
          const canvas = mountRef.current?.querySelector("canvas");
          if (canvas) {
            canvas.style.cursor = "grab";
          }
        }
      };

      const onPointerSyncCtrl = (ev: PointerEvent) => {
        if (!ev.ctrlKey && !ev.metaKey) {
          setIsCtrlPressed((prev) => (prev ? false : prev));
        }
      };

      const onBlur = () => {
        setIsCtrlPressed(false);
        const canvas = mountRef.current?.querySelector("canvas");
        if (canvas) {
          canvas.style.cursor = "grab";
        }
      };

      const onHumanScaleRefChange = (ev: Event) => {
        const show = Boolean((ev as CustomEvent<boolean>).detail);
        const mGrp = meshGroupRef.current;
        const parentScene = mGrp?.parent;
        if (!parentScene) return;
        const existing = parentScene.getObjectByName("birim_human_scale_silhouette_175");
        if (existing) {
          parentScene.remove(existing);
        }
        if (show) {
          const bounds = computeFastParametricSceneBounds(useConfiguratorStore.getState().project.modules);
          const figGroup = new THREE.Group();
          figGroup.name = "birim_human_scale_silhouette_175";
          const silMat = new THREE.MeshStandardMaterial({
            color: 0x334155,
            roughness: 0.85,
            metalness: 0.05,
            transparent: true,
            opacity: 0.42,
            depthWrite: false,
          });
          // Minimalist 1750mm architectural figure (legs + torso + head) placed 280mm left of cabinet row
          const torso = new THREE.Mesh(new THREE.CapsuleGeometry(135, 680, 6, 12), silMat);
          torso.position.set(0, 1080, 0);
          torso.raycast = () => {};
          const legs = new THREE.Mesh(new THREE.CylinderGeometry(105, 80, 740, 12), silMat);
          legs.position.set(0, 370, 0);
          legs.raycast = () => {};
          const head = new THREE.Mesh(new THREE.SphereGeometry(110, 14, 12), silMat);
          head.position.set(0, 1640, 0);
          head.raycast = () => {};
          figGroup.add(legs, torso, head);
          figGroup.position.set((bounds?.min.x ?? 0) - 340, 0, (bounds?.max.z ?? 600) * 0.55);
          parentScene.add(figGroup);
        }
        needsRenderRef.current = true;
      };
      window.addEventListener("birim:set-human-scale-ref", onHumanScaleRefChange);
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      window.addEventListener("pointermove", onPointerSyncCtrl, { passive: true });
      window.addEventListener("blur", onBlur);
      document.addEventListener("visibilitychange", onBlur);
      return () => {
        window.removeEventListener("birim:set-human-scale-ref", onHumanScaleRefChange);
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
        window.removeEventListener("pointermove", onPointerSyncCtrl);
        window.removeEventListener("blur", onBlur);
        document.removeEventListener("visibilitychange", onBlur);
      };
    }, []);
}
