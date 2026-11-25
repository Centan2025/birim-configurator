"use client";

import { getBayShelfIntervalsForSubDivider } from "../../adapter/useV3Adapter";
import { getActiveDraggedSceneCatalogId, setActiveDraggedSceneCatalogId, computeRoomDynamicCenter, computeMultiWallDragPreview } from "../../engine/multiWallSnapAndBvhEngine";
import React, { useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import { getWallRoomBasis } from "../../engine/angledWallSnapEngine";
import { getEffectiveSpaceWalls } from "../../engine/kitchenSpatialEngine";
import { createComponentMesh, createModuleGroup } from "../../../components/componentMesh";
import { generateModuleGeometry, DEFAULT_MATERIALS, getActiveDraggedTemplateId, setActiveDraggedTemplateId } from "../../adapter/useV3Adapter";
import { calculateNetInnerHeight, calculateBayWidths, calculateModulePlacement, evaluateHardwareMountPlacement } from "@birim/core";
import { getHardwareProductById } from "@birim/catalog";
import { computeBaySystem32ShelfHoleElevations } from "../../engine/elevationSnapEngine";
import { getV3PbrMaterial } from "../../materials/pbrMaterialSystem";
import { markSharedGeometry, markSharedMaterial, disposeObject3DTree } from "../../materials/webglResourceGuard";
import { useConfiguratorStore } from "../../../store/useConfiguratorStore";
import { ghostLockedMat, ghostFreeMat, ghostLockedEdgeMat, ghostFreeEdgeMat, snapSlotActiveRodMat, snapSlotIdleRodMat } from "./viewport3DSharedAssets";
import { add3DRod } from "./viewport3DSceneHelpers";

import type { UseViewport3DDragAndDropEffectsCtx } from "./viewport3DTypes";

export function useViewport3DDragAndDropEffects(ctx: UseViewport3DDragAndDropEffectsCtx) {
  const {
    ghostSnapGroupRef,
    project,
    rendererRef,
    controlsRef,
    perspCamRef,
    latestStateRef,
    width,
    depth,
    pausedRef,
    requestRender,
    setSnapBannerDedup,
    sceneObjectsGroupRef,
    meshGroupRef,
    setIsDraggingItemOver3D,
    lastGhostKeyRef,
    getCachedSolidMeshes,
    activeModule,
    spaceWalls,
    roomArchGroupRef,
    isDraggingItemOver3D,
    lastAccessoryDropTargetRef,
    addInteriorItemAtElevation,
    doorOpenAngleDeg,
    setDoorOpenAngleDeg,
    addSceneObjectFromCatalog,
    dropV4TemplateWithSnap,
  } = ctx;
    const livePartPoolRef = useRef<{
      group: THREE.Group;
      woodBox: THREE.Mesh;
      woodEdges: THREE.LineSegments;
      handleBar: THREE.Mesh;
      metalRod: THREE.Mesh;
      accessoryHolder: THREE.Group;
      accessorySig: string;
    } | null>(null);

    useEffect(() => {
      const ensureLivePartPool = (mod: { carcass: { bodyMaterialId: string }; surfaceFinishOverride?: Parameters<typeof getV3PbrMaterial>[4] }): NonNullable<typeof livePartPoolRef.current> | null => {
        const gGroup = ghostSnapGroupRef.current;
        if (!gGroup) return null;
        const matDef =
          DEFAULT_MATERIALS.find((m) => m.id === mod.carcass.bodyMaterialId) ||
          (project.customMaterials || []).find((m) => m.id === mod.carcass.bodyMaterialId) ||
          DEFAULT_MATERIALS[0];
        const woodMat = getV3PbrMaterial(matDef, false, false, "lengthwise", mod.surfaceFinishOverride);
        const metalMat = getV3PbrMaterial(DEFAULT_MATERIALS[0], false, true, "lengthwise");

        if (!livePartPoolRef.current) {
          const unitBox = markSharedGeometry(new THREE.BoxGeometry(1, 1, 1));
          const unitCyl = markSharedGeometry(new THREE.CylinderGeometry(0.5, 0.5, 1, 16));
          unitCyl.rotateZ(Math.PI / 2);
          const woodBox = new THREE.Mesh(unitBox, woodMat);
          woodBox.raycast = () => {};
          const woodEdges = new THREE.LineSegments(
            markSharedGeometry(new THREE.EdgesGeometry(unitBox)),
            markSharedMaterial(new THREE.LineBasicMaterial({ color: 0x8c6d46 }))
          );
          woodEdges.raycast = () => {};
          woodBox.add(woodEdges);

          const handleBar = new THREE.Mesh(unitBox, metalMat);
          handleBar.raycast = () => {};
          const metalRod = new THREE.Mesh(unitCyl, metalMat);
          metalRod.raycast = () => {};
          const accessoryHolder = new THREE.Group();
          accessoryHolder.name = "v12_live_accessory_preview";
          accessoryHolder.visible = false;

          const group = new THREE.Group();
          group.name = "v12_live_real_3d_part_preview";
          group.add(woodBox, handleBar, metalRod, accessoryHolder);
          livePartPoolRef.current = {
            group,
            woodBox,
            woodEdges,
            handleBar,
            metalRod,
            accessoryHolder,
            accessorySig: "",
          };
        } else {
          livePartPoolRef.current.woodBox.material = woodMat;
          if (!livePartPoolRef.current.accessoryHolder) {
            const accessoryHolder = new THREE.Group();
            accessoryHolder.name = "v12_live_accessory_preview";
            accessoryHolder.visible = false;
            livePartPoolRef.current.group.add(accessoryHolder);
            livePartPoolRef.current.accessoryHolder = accessoryHolder;
            livePartPoolRef.current.accessorySig = "";
          }
        }
        const sceneRoot = gGroup.parent || gGroup;
        if (livePartPoolRef.current.group.parent !== sceneRoot) {
          sceneRoot.add(livePartPoolRef.current.group);
        }
        livePartPoolRef.current.group.visible = true;
        return livePartPoolRef.current;
      };

      const computeLivePlacementFromClient = (
        clientX: number,
        clientY: number,
        spec: { id: string; title: string; visual: string }
      ) => {
        const curRenderer = rendererRef.current;
        const cam = (controlsRef.current?.object as THREE.Camera) || perspCamRef.current;
        const st = latestStateRef.current;
        if (!curRenderer || !cam || !st.project.modules.length) return null;

        const rect = curRenderer.domElement.getBoundingClientRect();
        if (
          rect.width <= 0 ||
          rect.height <= 0 ||
          clientX < rect.left ||
          clientX > rect.right ||
          clientY < rect.top ||
          clientY > rect.bottom
        ) {
          return null;
        }

        const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
        const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
        const rc = new THREE.Raycaster();
        rc.setFromCamera(new THREE.Vector2(ndcX, ndcY), cam);

        // Hit-test ALL main modules (prioritizing exact bounds match, then closest horizontal match)
        // so multi-module Open Wardrobe Systems can receive dragged parts in ANY unit!
        let mod = st.project.modules[st.activeModuleIndex] || st.project.modules[0];
        let matchedModIdx = st.activeModuleIndex;
        let relX = -99999;
        let relY = -99999;
        let bestHorizontalScore = Infinity;

        for (let mIdx = 0; mIdx < st.project.modules.length; mIdx++) {
          const candMod = st.project.modules[mIdx];
          if (!candMod || candMod.category === "complementary" || !candMod.bays.length) continue;
          const cPl = calculateModulePlacement(candMod);
          const rightAxis = new THREE.Vector3(Math.cos(cPl.rotationYRad), 0, -Math.sin(cPl.rotationYRad));
          const frontNormal = new THREE.Vector3(Math.sin(cPl.rotationYRad), 0, Math.cos(cPl.rotationYRad));
          const midPlaneAnchor = new THREE.Vector3(cPl.origin.x, cPl.origin.y, cPl.origin.z).addScaledVector(
            frontNormal,
            candMod.dimensions.depth * 0.5
          );
          const midInteriorPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(frontNormal, midPlaneAnchor);
          const hitPt = new THREE.Vector3();
          if (!rc.ray.intersectPlane(midInteriorPlane, hitPt)) continue;

          const cRelX = hitPt.clone().sub(cPl.origin).dot(rightAxis);
          const cRelY = hitPt.y - candMod.position.y;
          if (cRelY < -120 || cRelY > candMod.dimensions.height + 160) continue;

          const horizDistOutside =
            cRelX < 0 ? -cRelX : cRelX > candMod.dimensions.width ? cRelX - candMod.dimensions.width : 0;
          const camDist = hitPt.distanceTo(cam.position);
          // Reject hits behind camera ray or absurdly far away
          const toHit = hitPt.clone().sub(cam.position);
          if (toHit.dot(rc.ray.direction) <= 0) continue;
          const compositeScore = (horizDistOutside === 0 ? 0 : 50000 + horizDistOutside * 200) + camDist;
          if (horizDistOutside <= 140 && compositeScore < bestHorizontalScore) {
            bestHorizontalScore = compositeScore;
            mod = candMod;
            matchedModIdx = mIdx;
            relX = cRelX;
            relY = cRelY;
          }
        }

        if (!Number.isFinite(bestHorizontalScore)) {
          return null;
        }

        const carcassT = mod.carcass?.panelThickness || 18;
        const plinthH = mod.carcass?.plinthHeight ?? 80;
        const netH = calculateNetInnerHeight(mod);
        const bayWidths = calculateBayWidths(mod);

        let targetBayIdx = 0;
        let accX = carcassT;
        let bayStartX = carcassT;
        let curBayWidth = bayWidths[0] || 500;
        for (let i = 0; i < bayWidths.length; i++) {
          const bw = bayWidths[i];
          if (relX >= accX - carcassT && relX <= accX + bw + carcassT) {
            targetBayIdx = i;
            bayStartX = accX;
            curBayWidth = bw;
            break;
          }
          accX += bw + carcassT;
        }
        if (relX > accX) {
          targetBayIdx = Math.max(0, bayWidths.length - 1);
          curBayWidth = bayWidths[targetBayIdx] || 500;
          bayStartX = carcassT + bayWidths.slice(0, targetBayIdx).reduce((s, w) => s + w + carcassT, 0);
        }
        targetBayIdx = Math.max(0, Math.min(mod.bays.length - 1, targetBayIdx));

        const cursorElevY = relY - plinthH - carcassT;
        const minElev = spec.visual === "drawer" || spec.visual === "internal_drawer" ? 0 : 32;
        const maxElev =
          spec.visual === "drawer" || spec.visual === "internal_drawer"
            ? Math.max(0, netH - 180)
            : Math.max(64, netH - 32);
        const clampedRawY = Math.max(minElev, Math.min(maxElev, cursorElevY));
        const nearest32 = Math.round(clampedRawY / 32) * 32;
        let snappedElevY =
          Math.abs(clampedRawY - nearest32) <= 5 && nearest32 >= minElev && nearest32 <= maxElev
            ? nearest32
            : Math.round(clampedRawY / 2) * 2;
        if (spec.visual === "shelf" && spec.id !== "lib_fixed_shelf") {
          const holeYs = computeBaySystem32ShelfHoleElevations(mod, targetBayIdx, undefined, {
            includeFixedShelves: false,
          });
          if (holeYs && holeYs.length > 0) {
            snappedElevY = holeYs.reduce((best, hy) =>
              Math.abs(clampedRawY - hy) < Math.abs(clampedRawY - best) ? hy : best
            , holeYs[0]);
          }
        }
        const localBayX = Math.max(
          40,
          Math.min(Math.max(72, curBayWidth - carcassT - 40), Math.round((relX - bayStartX) / 5) * 5)
        );

        let subBotY = 0;
        let subSpanH = 320;
        let ivLabel = "";
        if (spec.visual === "sub_divider") {
          const bayObj = mod.bays[targetBayIdx];
          const ivs = bayObj ? getBayShelfIntervalsForSubDivider(bayObj, netH, carcassT) : [];
          const candIvs =
            ivs.filter((iv) => !iv.hasConflict).length > 0
              ? ivs.filter((iv) => !iv.hasConflict)
              : ivs.filter((iv) => iv.conflictReason !== "Çekmece var");
          if (candIvs.length > 0) {
            const bestIv =
              candIvs.find((iv) => cursorElevY >= iv.botY - 18 && cursorElevY <= iv.topY + 18) ||
              candIvs.reduce((best, iv) =>
                Math.abs((iv.botY + iv.topY) / 2 - cursorElevY) <
                Math.abs((best.botY + best.topY) / 2 - cursorElevY)
                  ? iv
                  : best
              );
            subBotY = bestIv.botY;
            subSpanH = Math.max(80, bestIv.height);
            ivLabel = bestIv.label;
          } else {
            subBotY = Math.max(0, Math.min(netH - 320, snappedElevY - 160));
            subSpanH = Math.min(netH - subBotY, 320);
          }
        }

        return {
    width,
    depth,
          mod,
          matchedModIdx,
          carcassT,
          plinthH,
          bayStartX,
          curBayWidth,
          targetBayIdx,
          snappedElevY,
          localBayX,
          subBotY,
          subSpanH,
          ivLabel,
        };
      };

      let autoOpenedOnce = false;

      const onLiveMove = (ev: Event) => {
        if (pausedRef.current) return;
        const detail = (
          ev as CustomEvent<{ id: string; title: string; visual: string; clientX: number; clientY: number }>
        ).detail;
        if (!detail) return;
        const st = latestStateRef.current;
        if (!autoOpenedOnce && st.doorOpenAngleDeg < 15 && !st.doorsHiddenIn3D) {
          autoOpenedOnce = true;
          st.setDoorOpenAngleDeg(85);
        }
        const target = computeLivePlacementFromClient(detail.clientX, detail.clientY, detail);
        if (!target) {
          if (livePartPoolRef.current) {
            livePartPoolRef.current.group.visible = false;
            requestRender();
          }
          window.dispatchEvent(new CustomEvent("birim:live-part-snapped-in-bay", { detail: { active: false } }));
          setSnapBannerDedup(null);
          return;
        }
        window.dispatchEvent(new CustomEvent("birim:live-part-snapped-in-bay", { detail: { active: true } }));
        const pool = ensureLivePartPool(target.mod);
        if (!pool) return;

        const { mod, carcassT, plinthH, bayStartX, curBayWidth, targetBayIdx, snappedElevY, localBayX, subBotY, subSpanH, ivLabel } = target;
        const pl = calculateModulePlacement(mod);
        const placeLocalToWorld = (lx: number, ly: number, lz: number) => {
          const cosR = Math.cos(pl.rotationYRad);
          const sinR = Math.sin(pl.rotationYRad);
          return new THREE.Vector3(
            pl.origin.x + lx * cosR + lz * sinR,
            pl.origin.y + ly,
            pl.origin.z - lx * sinR + lz * cosR
          );
        };
        const baseYLocal = plinthH + carcassT;
        const netInnerHLocal = Math.max(120, mod.dimensions.height - plinthH - 2 * carcassT);
        const partD = Math.max(80, mod.dimensions.depth - carcassT - 24);
        const centerZLocal = 14 + partD / 2;
        pool.group.rotation.y = pl.rotationYRad;

        pool.woodBox.visible = false;
        pool.handleBar.visible = false;
        pool.metalRod.visible = false;
        pool.accessoryHolder.visible = false;

        pool.group.position.set(pl.origin.x, pl.origin.y, pl.origin.z);
        void placeLocalToWorld;
        const specialFittingVisuals = new Set([
          "wire_basket",
          "trouser_rack",
          "shoe_rack",
          "jewelry_tray",
          "tie_rack",
          "wardrobe_lift",
          "waste_bin",
          "spice_pullout",
          "pantry_pullout",
          "corner_lemans",
        ]);
        const fittingTypeFromId = detail.id.startsWith("lib_") ? detail.id.slice(4) : "";
        const resolvedFittingType = specialFittingVisuals.has(detail.visual)
          ? detail.visual
          : specialFittingVisuals.has(fittingTypeFromId)
          ? fittingTypeFromId
          : detail.id === "lib_tie_belt"
          ? "tie_rack"
          : null;

        if (detail.visual === "sub_divider") {
          pool.woodBox.visible = true;
          pool.woodBox.scale.set(carcassT, subSpanH, partD);
          pool.woodBox.position.set(bayStartX + localBayX + carcassT / 2, baseYLocal + subBotY + subSpanH / 2, centerZLocal);
          setSnapBannerDedup(`📐 ${detail.title} • Bölme ${targetBayIdx + 1} (${ivLabel || "Raf Arası"}) • X: ${localBayX} mm`);
        } else if (detail.visual === "rail") {
          const clampedRailY = Math.max(100, Math.min(Math.max(100, netInnerHLocal - 24), snappedElevY));
          pool.metalRod.visible = true;
          pool.metalRod.scale.set(curBayWidth - 6, 22, 22);
          pool.metalRod.position.set(bayStartX + curBayWidth / 2, baseYLocal + clampedRailY, centerZLocal);
          setSnapBannerDedup(`📐 ${detail.title} • Bölme ${targetBayIdx + 1} • Y: ${clampedRailY} mm`);
        } else if (resolvedFittingType) {
          const fitW = Math.max(80, Math.round(curBayWidth - 4));
          const fitD = Math.max(120, Math.round(partD));
          const fitH =
            resolvedFittingType === "waste_bin"
              ? Math.min(340, netInnerHLocal)
              : resolvedFittingType === "pantry_pullout"
              ? Math.min(Math.max(360, netInnerHLocal - 40), netInnerHLocal)
              : resolvedFittingType === "spice_pullout"
              ? Math.min(320, netInnerHLocal)
              : resolvedFittingType === "wardrobe_lift"
              ? Math.min(Math.max(220, netInnerHLocal - 32), Math.min(820, Math.max(420, netInnerHLocal - 80)))
              : resolvedFittingType === "wire_basket"
              ? 85
              : 80;
          const clampedItemY =
            resolvedFittingType === "wardrobe_lift"
              ? Math.max(
                  32,
                  Math.min(
                    Math.max(32, netInnerHLocal - fitH - 48),
                    snappedElevY - Math.round(fitH * 0.75)
                  )
                )
              : Math.max(0, Math.min(Math.max(0, netInnerHLocal - fitH), snappedElevY));
          const nextSig = `${resolvedFittingType}|${fitW}|${fitH}|${fitD}`;
          if (pool.accessorySig !== nextSig) {
            disposeObject3DTree(pool.accessoryHolder);
            pool.accessoryHolder.clear();
            const chromeDef =
              DEFAULT_MATERIALS.find((m) => m.id === "mat_metal_chrome") || DEFAULT_MATERIALS[0];
            const chromeMat = getV3PbrMaterial(chromeDef, false, true, "lengthwise");
            const edgeMat = markSharedMaterial(
              new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.7 })
            );
            const previewComp = {
              id: `live_preview_fitting_${resolvedFittingType}`,
              role: "special_fitting" as const,
              label: detail.title,
              bayIndex: targetBayIdx,
              dimensions: { width: fitW, height: fitH, depth: fitD },
              position: { x: 0, y: 0, z: 0 },
              materialId: "mat_metal_chrome",
              isManufacturablePanel: false,
            };
            const built = createComponentMesh(previewComp, chromeMat, edgeMat, {
              componentId: previewComp.id,
              role: "special_fitting",
              isSelectionHelper: true,
            });
            built.traverse((obj) => {
              obj.raycast = () => {};
            });
            pool.accessoryHolder.add(built);
            pool.accessorySig = nextSig;
          }
          pool.accessoryHolder.visible = true;
          pool.accessoryHolder.position.set(bayStartX + 2, baseYLocal + clampedItemY, 24);
          setSnapBannerDedup(`📐 ${detail.title} • Bölme ${targetBayIdx + 1} • Y: ${clampedItemY} mm`);
        } else if (detail.visual === "drawer" || detail.visual === "internal_drawer") {
          const drwH = Math.min(180, Math.max(90, netInnerHLocal));
          const clampedDrwY = Math.max(0, Math.min(Math.max(0, netInnerHLocal - drwH), snappedElevY));
          pool.woodBox.visible = true;
          pool.woodBox.scale.set(curBayWidth - 6, drwH, partD - 12);
          pool.woodBox.position.set(bayStartX + curBayWidth / 2, baseYLocal + clampedDrwY + drwH / 2, centerZLocal);
          if (detail.visual === "drawer") {
            pool.handleBar.visible = true;
            pool.handleBar.scale.set(Math.min(140, curBayWidth * 0.35), 10, 18);
            pool.handleBar.position.set(bayStartX + curBayWidth / 2, baseYLocal + clampedDrwY + Math.min(drwH - 18, 115), mod.dimensions.depth - 12);
          }
          setSnapBannerDedup(`📐 ${detail.title} • Bölme ${targetBayIdx + 1} • Y: ${clampedDrwY} mm`);
        } else {
          const shThick = detail.id === "lib_fixed_shelf" ? 25 : carcassT;
          const clampedItemY = Math.max(0, Math.min(Math.max(0, netInnerHLocal - shThick), snappedElevY));
          pool.woodBox.visible = true;
          pool.woodBox.scale.set(curBayWidth - 4, shThick, partD);
          pool.woodBox.position.set(
            bayStartX + curBayWidth / 2,
            baseYLocal + clampedItemY + shThick / 2,
            centerZLocal
          );
          setSnapBannerDedup(`📐 ${detail.title} • Bölme ${targetBayIdx + 1} • Y: ${clampedItemY} mm`);
        }

        requestRender();
      };

      const hideLivePart = () => {
        autoOpenedOnce = false;
        window.dispatchEvent(new CustomEvent("birim:live-part-snapped-in-bay", { detail: { active: false } }));
        if (livePartPoolRef.current) {
          livePartPoolRef.current.group.visible = false;
          requestRender();
        }
      };

      const onLiveCancel = () => {
        hideLivePart();
        setSnapBannerDedup(null);
      };

      const onLiveDrop = (ev: Event) => {
        if (pausedRef.current) return;
        const detail = (
          ev as CustomEvent<{ id: string; title: string; visual: string; clientX: number; clientY: number; dropId?: string }>
        ).detail;
        hideLivePart();
        if (!detail) return;
        // V77: Strict single-insert dedupe lock (prevents duplicate inserts across mounted viewports or double pointer events!)
        const winAny = window as unknown as { __birimLastPartDropId?: string; __birimLastPartDropTs?: number };
        const nowMs = Date.now();
        if (
          (detail.dropId && winAny.__birimLastPartDropId === detail.dropId) ||
          (typeof winAny.__birimLastPartDropTs === "number" && nowMs - winAny.__birimLastPartDropTs < 240)
        ) {
          return;
        }
        winAny.__birimLastPartDropId = detail.dropId || String(nowMs);
        winAny.__birimLastPartDropTs = nowMs;

        const target = computeLivePlacementFromClient(detail.clientX, detail.clientY, detail);
        if (!target) {
          setSnapBannerDedup(null);
          return;
        }
        const elevToCommit =
          detail.visual === "sub_divider"
            ? Math.round(target.subBotY + target.subSpanH / 2)
            : target.snappedElevY;
        // Synchronously switch Zustand activeModuleIndex BEFORE inserting so it ALWAYS lands in the exact hovered module!
        if (typeof target.matchedModIdx === "number") {
          useConfiguratorStore.getState().setActiveModuleIndex(target.matchedModIdx);
          useConfiguratorStore.getState().setActiveBayIndex(target.targetBayIdx);
        }
        latestStateRef.current.addInteriorItemAtElevation(target.targetBayIdx, detail.id, elevToCommit, {
          offsetX: target.localBayX,
          exactElevation: true,
        });
        setSnapBannerDedup(`✓ ${detail.title} yerleştirildi • Bölme ${target.targetBayIdx + 1}`);
        setTimeout(() => setSnapBannerDedup(null), 2400);
      };

      const onLiveMaterialDrop = (ev: Event) => {
        if (pausedRef.current) return;
        const detail = (
          ev as CustomEvent<{ materialId: string; materialName?: string; clientX: number; clientY: number }>
        ).detail;
        if (!detail?.materialId) return;
        const curRenderer = rendererRef.current;
        const cam = (controlsRef.current?.object as THREE.Camera) || perspCamRef.current;
        if (!curRenderer || !cam) return;
        const rect = curRenderer.domElement.getBoundingClientRect();
        if (
          rect.width <= 0 ||
          rect.height <= 0 ||
          detail.clientX < rect.left ||
          detail.clientX > rect.right ||
          detail.clientY < rect.top ||
          detail.clientY > rect.bottom
        ) {
          return;
        }
        const ndcX = ((detail.clientX - rect.left) / rect.width) * 2 - 1;
        const ndcY = -((detail.clientY - rect.top) / rect.height) * 2 + 1;
        const rc = new THREE.Raycaster();
        rc.setFromCamera(new THREE.Vector2(ndcX, ndcY), cam);

        const st = latestStateRef.current;
        if (sceneObjectsGroupRef.current) {
          const soHits = rc.intersectObject(sceneObjectsGroupRef.current, true);
          for (const h of soHits) {
            let cur: THREE.Object3D | null = h.object;
            while (cur && !cur.userData?.sceneObjectId) cur = cur.parent;
            if (cur?.userData?.sceneObjectId) {
              (st.updateSceneObject as (id: string, p: Record<string, unknown>) => void)(
                String(cur.userData.sceneObjectId),
                { materialId: detail.materialId }
              );
              setSnapBannerDedup(`✓ Malzeme atandı: ${detail.materialName || detail.materialId}`);
              setTimeout(() => setSnapBannerDedup(null), 2400);
              return;
            }
          }
        }
        if (meshGroupRef.current) {
          const hits = rc.intersectObject(meshGroupRef.current, true);
          for (const h of hits) {
            if (h.object?.userData?.isSelectionHelper) continue;
            let cur: THREE.Object3D | null = h.object;
            while (cur && !cur.userData?.componentId) cur = cur.parent;
            if (cur?.userData?.componentId) {
              if (
                typeof cur.userData.moduleIndex === "number" &&
                cur.userData.moduleIndex !== st.activeModuleIndex
              ) {
                st.setActiveModuleIndex(cur.userData.moduleIndex);
              }
              (st as unknown as {
                applyMaterialToSimilarComponents?: (
                  matId: string,
                  compId: string,
                  scope: "single"
                ) => void;
              }).applyMaterialToSimilarComponents?.(
                detail.materialId,
                String(cur.userData.componentId),
                "single"
              );
              setSnapBannerDedup(`✓ Malzeme atandı: ${detail.materialName || detail.materialId}`);
              setTimeout(() => setSnapBannerDedup(null), 2400);
              return;
            }
          }
        }
      };

      window.addEventListener("birim:live-3d-part-move", onLiveMove);
      window.addEventListener("birim:live-3d-part-drop", onLiveDrop);
      window.addEventListener("birim:live-3d-part-cancel", onLiveCancel);
      const onLiveHardwareMove = (ev: Event) => {
        if (pausedRef.current) return;
        const detail = (
          ev as CustomEvent<{
            hardwareId: string;
            sku: string;
            name: string;
            familyId: string;
            canMount: boolean;
            clientX: number;
            clientY: number;
          }>
        ).detail;
        if (!detail?.hardwareId) return;
        const target = computeLivePlacementFromClient(detail.clientX, detail.clientY, {
          id: detail.hardwareId,
          title: detail.name,
          visual: detail.familyId,
        });
        if (!target) {
          setSnapBannerDedup("⚠ Donanımı yerleştirmek için bir dolap bölmesinin üzerine sürükleyin");
          return;
        }
        const st = latestStateRef.current;
        const mod = st.project.modules[target.matchedModIdx ?? st.activeModuleIndex] || st.project.modules[0];
        const hw = getHardwareProductById(detail.hardwareId);
        if (mod && hw) {
          const check = evaluateHardwareMountPlacement(mod, hw, target.targetBayIdx);
          if (check.canMount) {
            setSnapBannerDedup(
              `✓ Geçerli Montaj Noktası • Bölme ${target.targetBayIdx + 1} (${check.targetSurface}) • ${hw.sku}`
            );
          } else {
            const firstErr = check.issues.find((i) => i.severity === "error");
            setSnapBannerDedup(
              `✕ Geçersiz Alan (Bölme ${target.targetBayIdx + 1}): ${firstErr?.reasonTr || check.summaryTr}`
            );
          }
        }
      };

      const onLiveHardwareCancel = () => {
        setSnapBannerDedup(null);
      };

      const onLiveHardwareDrop = (ev: Event) => {
        if (pausedRef.current) return;
        const detail = (
          ev as CustomEvent<{
            hardwareId: string;
            sku: string;
            name: string;
            familyId: string;
            clientX: number;
            clientY: number;
          }>
        ).detail;
        if (!detail?.hardwareId) return;
        const target = computeLivePlacementFromClient(detail.clientX, detail.clientY, {
          id: detail.hardwareId,
          title: detail.name,
          visual: detail.familyId,
        });
        if (!target) {
          setSnapBannerDedup(null);
          return;
        }
        const st = latestStateRef.current;
        if (typeof target.matchedModIdx === "number" && target.matchedModIdx !== st.activeModuleIndex) {
          st.setActiveModuleIndex(target.matchedModIdx);
        }
        const res = useConfiguratorStore.getState().applyHardwareProductToBay(target.targetBayIdx, detail.hardwareId);
        setSnapBannerDedup(res.applied ? `✓ ${res.messageTr}` : `⚠ ${res.messageTr}`);
        setTimeout(() => setSnapBannerDedup(null), 3200);
      };

      window.addEventListener("birim:live-material-drop", onLiveMaterialDrop);
      window.addEventListener("birim:live-hardware-move", onLiveHardwareMove);
      window.addEventListener("birim:live-hardware-drop", onLiveHardwareDrop);
      window.addEventListener("birim:live-hardware-cancel", onLiveHardwareCancel);
      return () => {
        window.removeEventListener("birim:live-3d-part-move", onLiveMove);
        window.removeEventListener("birim:live-3d-part-drop", onLiveDrop);
        window.removeEventListener("birim:live-3d-part-cancel", onLiveCancel);
        window.removeEventListener("birim:live-material-drop", onLiveMaterialDrop);
        window.removeEventListener("birim:live-hardware-move", onLiveHardwareMove);
        window.removeEventListener("birim:live-hardware-drop", onLiveHardwareDrop);
        window.removeEventListener("birim:live-hardware-cancel", onLiveHardwareCancel);
      };
    }, [project.customMaterials, requestRender, setSnapBannerDedup]);

const clear3DGhostPreview = useCallback(() => {
      setIsDraggingItemOver3D(false);
      lastGhostKeyRef.current = "";
      if (ghostSnapGroupRef.current) {
        disposeObject3DTree(ghostSnapGroupRef.current);
        ghostSnapGroupRef.current.clear();
        requestRender();
      }
    }, [requestRender]);

    const resolve3DHitPointFromDragEvent = (e: React.DragEvent<HTMLDivElement>): THREE.Vector3 => {
      const rect = e.currentTarget.getBoundingClientRect();
      const cam = (controlsRef.current?.object as THREE.Camera) || perspCamRef.current;
      const hitPt = new THREE.Vector3();
      if (cam && rect.width > 0 && rect.height > 0) {
        const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        const rc = new THREE.Raycaster();
        rc.setFromCamera(new THREE.Vector2(ndcX, ndcY), cam);

        // O(1) cached raycast (zero recursive scene traversal & zero mid-drag React setState!)
        if (meshGroupRef.current) {
          const solidMeshes = getCachedSolidMeshes(meshGroupRef.current, true);
          const hits = rc.intersectObjects(solidMeshes, false);
          if (hits.length > 0) {
            return hits[0].point.clone();
          }
        }

        const mod = activeModule || project.modules[0];
        const planeZ = mod ? (mod.position.z + mod.dimensions.depth / 2) : 280;
        const cabinetPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -planeZ);
        if (rc.ray.intersectPlane(cabinetPlane, hitPt)) {
          return hitPt;
        }
        const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        if (rc.ray.intersectPlane(floorPlane, hitPt)) {
          return hitPt;
        }
      }
      return hitPt;
    };

    const resolve3DWorldXFromDragEvent = (e: React.DragEvent<HTMLDivElement>): number => {
      const rect = e.currentTarget.getBoundingClientRect();
      const cam = (controlsRef.current?.object as THREE.Camera) || perspCamRef.current;
      if (cam && rect.width > 0 && rect.height > 0) {
        const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        const rc = new THREE.Raycaster();
        rc.setFromCamera(new THREE.Vector2(ndcX, ndcY), cam);
        // Intersect with vertical cabinet front/mid plane Z=280mm or floor plane Y=0mm
        const wallPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -280);
        const hitPt = new THREE.Vector3();
        if (rc.ray.intersectPlane(wallPlane, hitPt)) {
          return Math.max(0, Math.round(hitPt.x));
        }
        const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        if (rc.ray.intersectPlane(floorPlane, hitPt)) {
          return Math.max(0, Math.round(hitPt.x));
        }
      }
      const relX = Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)));
      const wallLen = spaceWalls?.[0]?.length || 3600;
      return Math.round((relX * wallLen) / 50) * 50;
    };

    const resolve3DDragTargetWallAndPoint = (
      e: React.DragEvent<HTMLDivElement>
    ): {
      wallId: string;
      hitPoint: THREE.Vector3 | null;
      hitWallDirectly: boolean;
    } => {
      const effWalls = getEffectiveSpaceWalls(project);
      const liveActiveWallId = useConfiguratorStore.getState().activeWallId || undefined;
      const fallbackWallId =
        liveActiveWallId && effWalls.some((w) => w.id === liveActiveWallId)
          ? liveActiveWallId
          : effWalls[0]?.id || "wall_main";

      let targetWallId = fallbackWallId;
      let hitPoint: THREE.Vector3 | null = null;
      let hitWallDirectly = false;

      const curCam = (controlsRef.current?.object as THREE.Camera) || perspCamRef.current;
      const domRect = rendererRef.current
        ? rendererRef.current.domElement.getBoundingClientRect()
        : e.currentTarget.getBoundingClientRect();

      if (curCam && domRect.width > 0 && domRect.height > 0) {
        const ndcX = ((e.clientX - domRect.left) / domRect.width) * 2 - 1;
        const ndcY = -((e.clientY - domRect.top) / domRect.height) * 2 + 1;
        const rc = new THREE.Raycaster();
        rc.setFromCamera(new THREE.Vector2(ndcX, ndcY), curCam);

        const isNodeVisible = (obj: THREE.Object3D | null): boolean => {
          let cur: THREE.Object3D | null = obj;
          while (cur) {
            if (!cur.visible) return false;
            cur = cur.parent;
          }
          return true;
        };

        // 1. Check direct raycast onto visible 3D wall meshes
        if (roomArchGroupRef.current) {
          const wHits = rc.intersectObjects(roomArchGroupRef.current.children, true);
          for (const wh of wHits) {
            if (
              wh.object?.userData?.isRoomWall &&
              wh.object.userData.wallId &&
              isNodeVisible(wh.object)
            ) {
              targetWallId = String(wh.object.userData.wallId);
              hitPoint = wh.point.clone();
              hitWallDirectly = true;
              break;
            }
          }
        }

        // 2. If cursor is over floor/empty space (not directly on a wall mesh),
        //    intersect ray with the SELECTED wall's own front plane (or floor plane)
        if (!hitPoint) {
          const selectedWall = effWalls.find((w) => w.id === targetWallId) || effWalls[0];
          if (selectedWall) {
            const roomCenter = computeRoomDynamicCenter(effWalls);
            const basis = getWallRoomBasis(selectedWall, roomCenter);
            const planeNormal = new THREE.Vector3(basis.inwardNormal.x, 0, basis.inwardNormal.z);
            if (planeNormal.lengthSq() > 1e-6) {
              planeNormal.normalize();
              const planeAnchor = new THREE.Vector3(
                basis.p0.x + basis.inwardNormal.x * 280,
                0,
                basis.p0.z + basis.inwardNormal.z * 280
              );
              const targetWallPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
                planeNormal,
                planeAnchor
              );
              const pt = new THREE.Vector3();
              if (rc.ray.intersectPlane(targetWallPlane, pt)) {
                hitPoint = pt;
              }
            }
          }
          if (!hitPoint) {
            const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
            const pt = new THREE.Vector3();
            if (rc.ray.intersectPlane(floorPlane, pt)) {
              hitPoint = pt;
            }
          }
        }
      }

      return { wallId: targetWallId, hitPoint, hitWallDirectly };
    };

    const handle3DDragOver = (e: React.DragEvent<HTMLDivElement>) => {
      const draggedMat = typeof window !== "undefined" ? (window as any).__birimDraggedMaterial : null;
      const hasMatMime = e.dataTransfer.types.includes("application/x-birim-material");
      if (hasMatMime || draggedMat) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        if (draggedMat?.materialName) {
          setSnapBannerDedup(`🎨 ${draggedMat.materialName} — Uygulamak için ürün yüzeyine bırakın`);
        }
        return;
      }
      const activeAcc = typeof window !== "undefined" ? (window as any).__birimActiveDraggedAccessory : null;
      const hasAccessoryMime = e.dataTransfer.types.includes("application/x-birim-accessory-id");

      // CASE 1: ACCESSORY / INTERIOR ITEM DRAG
      if (hasAccessoryMime || activeAcc) {
        e.preventDefault();
        void isDraggingItemOver3D;
        e.dataTransfer.dropEffect = "copy";
        const mod = activeModule || project.modules[0];
        if (!mod) return;

        const hit = resolve3DHitPointFromDragEvent(e);
        const relX = hit.x - mod.position.x;
        const relY = hit.y - mod.position.y;

        const carcassT = mod.carcass?.panelThickness || 18;
        const plinthH = mod.carcass?.plinthHeight || 0;
        const netH = calculateNetInnerHeight(mod);
        const bayWidths = calculateBayWidths(mod);

        // 1. Identify which Bay is hovered
        let targetBayIdx = 0;
        let accX = carcassT;
        let bayStartX = carcassT;
        let curBayWidth = bayWidths[0] || 500;

        for (let i = 0; i < bayWidths.length; i++) {
          const bw = bayWidths[i];
          if (relX >= accX && relX <= accX + bw + carcassT) {
            targetBayIdx = i;
            bayStartX = accX;
            curBayWidth = bw;
            break;
          }
          accX += bw + carcassT;
        }
        targetBayIdx = Math.max(0, Math.min(mod.bays.length - 1, targetBayIdx));

        // 2. Identify Elevation Y (snapped to 32mm hole pattern) & Horizontal Offset X inside Bay
        const cursorElevY = relY - plinthH - carcassT;
        const snappedElevY = Math.max(64, Math.min(netH - 64, Math.round(cursorElevY / 32) * 32));
        const localBayX = Math.max(
          48,
          Math.min(curBayWidth - 48, Math.round((relX - bayStartX) / 10) * 10)
        );
        const accKind = activeAcc?.visual || "shelf";
        const isVerticalDivider = accKind === "sub_divider" || accKind === "carcass_divider";

        // If sub_divider (Raf Arası Dikme), find shelf immediately below & above cursor
        const bayShelves = [...(mod.bays[targetBayIdx]?.shelves || [])].sort(
          (a, b) => a.elevationY - b.elevationY
        );
        let subBotY = 0;
        let subTopY = netH;
        if (accKind === "sub_divider") {
          for (const sh of bayShelves) {
            if (sh.elevationY <= cursorElevY) {
              subBotY = sh.elevationY + (sh.thickness || carcassT);
            } else if (sh.elevationY > cursorElevY && subTopY === netH) {
              subTopY = sh.elevationY;
            }
          }
          if (subTopY - subBotY < 96) {
            subBotY = Math.max(0, Math.min(netH - 320, snappedElevY - 160));
            subTopY = Math.min(netH, subBotY + 320);
          }
        }
        const subSpanH = Math.max(120, subTopY - subBotY);

        lastAccessoryDropTargetRef.current = {
          bayIndex: targetBayIdx,
          elevationY: accKind === "sub_divider" ? Math.round((subBotY + subTopY) / 2) : snappedElevY,
          offsetX: localBayX,
          accessory: activeAcc || { id: "lib_shelf", title: "Raf", visual: "shelf" },
        };

        const ghostKey = `acc_${targetBayIdx}_${snappedElevY}_${isVerticalDivider ? localBayX : 0}_${activeAcc?.id || "shelf"}`;
        if (lastGhostKeyRef.current !== ghostKey && ghostSnapGroupRef.current) {
          lastGhostKeyRef.current = ghostKey;
          const gGroup = ghostSnapGroupRef.current;
          disposeObject3DTree(gGroup);
          gGroup.clear();

          // Render Ghost Accessory Mesh
          const ghostWorldX = mod.position.x + bayStartX;
          const ghostWorldY = mod.position.y + plinthH + carcassT + snappedElevY;
          const ghostWorldZ = mod.position.z + 10;
          const ghostD = mod.dimensions.depth - 30;

          let accGeo: THREE.BufferGeometry;
          if (accKind === "sub_divider") {
            accGeo = new THREE.BoxGeometry(carcassT, subSpanH, ghostD);
          } else if (accKind === "carcass_divider") {
            accGeo = new THREE.BoxGeometry(carcassT, netH, ghostD);
          } else if (accKind === "drawer" || accKind === "internal_drawer") {
            accGeo = new THREE.BoxGeometry(curBayWidth - 10, 160, ghostD);
          } else if (accKind === "rail") {
            accGeo = new THREE.CylinderGeometry(12, 12, curBayWidth - 8, 16);
          } else if (accKind === "shelf") {
            accGeo = new THREE.BoxGeometry(curBayWidth - 4, 18, ghostD);
          } else {
            accGeo = new THREE.BoxGeometry(curBayWidth - 12, 100, ghostD);
          }

          const accMesh = new THREE.Mesh(
            accGeo,
            new THREE.MeshBasicMaterial({
              color: 0x2563eb,
              transparent: true,
              opacity: 0.55,
              depthWrite: false,
            })
          );

          if (accKind === "sub_divider") {
            accMesh.position.set(
              ghostWorldX + localBayX,
              mod.position.y + plinthH + carcassT + subBotY + subSpanH / 2,
              ghostWorldZ + ghostD / 2
            );
          } else if (accKind === "carcass_divider") {
            accMesh.position.set(
              ghostWorldX + localBayX,
              mod.position.y + plinthH + carcassT + netH / 2,
              ghostWorldZ + ghostD / 2
            );
          } else if (accKind === "rail") {
            accMesh.rotation.z = Math.PI / 2;
            accMesh.position.set(ghostWorldX + curBayWidth / 2, ghostWorldY, ghostWorldZ + ghostD / 2);
          } else if (accKind === "drawer" || accKind === "internal_drawer") {
            accMesh.position.set(ghostWorldX + curBayWidth / 2, ghostWorldY + 80, ghostWorldZ + ghostD / 2);
          } else if (accKind === "shelf") {
            accMesh.position.set(ghostWorldX + curBayWidth / 2, ghostWorldY + 9, ghostWorldZ + ghostD / 2);
          } else {
            accMesh.position.set(ghostWorldX + curBayWidth / 2, ghostWorldY + 50, ghostWorldZ + ghostD / 2);
          }

          accMesh.add(
            new THREE.LineSegments(
              new THREE.EdgesGeometry(accGeo),
              new THREE.LineBasicMaterial({ color: 0x60a5fa, linewidth: 2 })
            )
          );
          gGroup.add(accMesh);

          // Laser measurement guide rod
          if (isVerticalDivider) {
            add3DRod(
              gGroup,
              new THREE.Vector3(ghostWorldX, mod.position.y + plinthH + carcassT + subBotY + 30, mod.position.z + ghostD),
              new THREE.Vector3(ghostWorldX + localBayX, mod.position.y + plinthH + carcassT + subBotY + 30, mod.position.z + ghostD),
              3.5,
              snapSlotActiveRodMat
            );
          } else {
            add3DRod(
              gGroup,
              new THREE.Vector3(ghostWorldX + 25, mod.position.y + plinthH + carcassT, mod.position.z + 25),
              new THREE.Vector3(ghostWorldX + 25, ghostWorldY, mod.position.z + 25),
              3.5,
              snapSlotActiveRodMat
            );
          }

          requestRender();
        }

        if (accKind === "sub_divider") {
          setSnapBannerDedup(
            `📐 Raf Arası Dikme • Bölme ${targetBayIdx + 1} • Sol Mesafe X: ${localBayX} mm (Boy: ${subSpanH} mm)`
          );
        } else if (accKind === "carcass_divider") {
          setSnapBannerDedup(
            `📐 Ara Dikme (Bölme ${targetBayIdx + 1} İç Düzeniyle 2'ye Bölünür) • X: ${localBayX} mm`
          );
        } else {
          setSnapBannerDedup(`📐 ${activeAcc?.title || "Aksesuar"} • Bölme ${targetBayIdx + 1} • Y: ${snappedElevY} mm`);
        }
        return;
      }

      // CASE 1.5: V5 SCENE OBJECT (APPLIANCE / FURNITURE / GLB) DRAG
      const hasSceneObjMime = e.dataTransfer.types.includes("application/x-birim-scene-object-id");
      const activeSceneCatId = getActiveDraggedSceneCatalogId();
      if (hasSceneObjMime || activeSceneCatId) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        const wx = resolve3DWorldXFromDragEvent(e);
        setSnapBannerDedup(`🧲 3D OBJE YERLEŞTİRME: X ≈ ${wx} mm (Yüzey / Tezgâh Mıknatısı Aktif)`);
        return;
      }

      // CASE 2: MODULE / CABINET DRAG
      const hasMime = e.dataTransfer.types.includes("application/x-birim-template-id");
      const activeTplId = getActiveDraggedTemplateId();
      if (!hasMime && !activeTplId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";

      const dragTarget = resolve3DDragTargetWallAndPoint(e);
      const tplId = activeTplId || "v4_kb_01_single_door";
      const preview = computeMultiWallDragPreview(project, tplId, {
        wallId: dragTarget.wallId,
        ...(dragTarget.hitPoint
          ? { worldX: dragTarget.hitPoint.x, worldZ: dragTarget.hitPoint.z }
          : {}),
      });
      if (!preview) return;

      const ghostKey = `${preview.wallId}_${preview.templateId}_${preview.snappedX}_${preview.snappedY}_${preview.snappedZ}_${preview.rotationYDeg}_${preview.isSnappedToSlot ? 1 : 0}`;
      if (lastGhostKeyRef.current !== ghostKey && ghostSnapGroupRef.current) {
        lastGhostKeyRef.current = ghostKey;
        const gGroup = ghostSnapGroupRef.current;
        disposeObject3DTree(gGroup);
        gGroup.clear();

        const { p0, rawTangent: wt, inwardNormal: wn } = preview.wallBasis;
        const slotPadRotY = Math.atan2(-wt.z, wt.x);

        // A. Render ALL Magnetic Snap Target Slots along the TARGET wall (Vertical Laser Guides + Floor/Wall Target Pads)
        preview.snapSlots.forEach((slot) => {
          const rodMat = slot.isActive ? snapSlotActiveRodMat : snapSlotIdleRodMat;
          const rodRadius = slot.isActive ? 6.5 : 4;
          const s0 = slot.alongMm;
          const s1 = slot.alongMm + slot.width;
          const b0x = p0.x + wt.x * s0;
          const b0z = p0.z + wt.z * s0;
          const f0x = b0x + wn.x * slot.depth;
          const f0z = b0z + wn.z * slot.depth;

          // Left snap edge vertical laser lines (back & front of wall)
          add3DRod(
            gGroup,
            new THREE.Vector3(b0x, slot.position.y, b0z),
            new THREE.Vector3(b0x, slot.position.y + slot.height + 180, b0z),
            rodRadius,
            rodMat
          );
          add3DRod(
            gGroup,
            new THREE.Vector3(f0x, slot.position.y, f0z),
            new THREE.Vector3(f0x, slot.position.y + slot.height + 180, f0z),
            rodRadius,
            rodMat
          );
          if (slot.isActive) {
            // Right edge laser line for the locked snap slot
            const f1x = p0.x + wt.x * s1 + wn.x * slot.depth;
            const f1z = p0.z + wt.z * s1 + wn.z * slot.depth;
            add3DRod(
              gGroup,
              new THREE.Vector3(f1x, slot.position.y, f1z),
              new THREE.Vector3(f1x, slot.position.y + slot.height + 180, f1z),
              rodRadius,
              rodMat
            );
          }

          // Magnetic Slot Footprint Target Box aligned flush to the target wall
          const padGeo = new THREE.BoxGeometry(slot.width, 10, slot.depth);
          const padMesh = new THREE.Mesh(
            padGeo,
            new THREE.MeshBasicMaterial({
              color: slot.isActive ? 0x10b981 : 0xf59e0b,
              transparent: true,
              opacity: slot.isActive ? 0.36 : 0.14,
              depthWrite: false,
            })
          );
          const midAlong = slot.alongMm + slot.width * 0.5;
          const padCx = p0.x + wt.x * midAlong + wn.x * (slot.depth * 0.5);
          const padCz = p0.z + wt.z * midAlong + wn.z * (slot.depth * 0.5);
          padMesh.position.set(padCx, slot.position.y + 5, padCz);
          padMesh.rotation.y = slotPadRotY;
          padMesh.add(
            new THREE.LineSegments(
              new THREE.EdgesGeometry(padGeo),
              slot.isActive ? ghostLockedEdgeMat : ghostFreeEdgeMat
            )
          );
          gGroup.add(padMesh);
        });

        // B. Render Full-Scale 3D Ghost Cabinet Silhouette on the TARGET wall at exact world pose
        const ghostBreakdown = generateModuleGeometry(preview.previewModule, {
          doorOpenAngleDeg: 0,
          drawerOpenMm: 0,
          explodedFactor: 0,
        });
        const ghostModContainer = createModuleGroup(preview.previewModule);
        const fillMat = preview.isSnappedToSlot ? ghostLockedMat : ghostFreeMat;
        const lineMat = preview.isSnappedToSlot ? ghostLockedEdgeMat : ghostFreeEdgeMat;

        ghostBreakdown.components.forEach((comp) => {
          ghostModContainer.add(
            createComponentMesh(comp, fillMat, lineMat, {
              componentId: comp.id,
              role: comp.role,
              moduleIndex: -1,
            })
          );
        });
        gGroup.add(ghostModContainer);
        requestRender();
      }

      setSnapBannerDedup(
        `🧲 SİLUET SNAP: ${preview.previewModule.name} (${preview.previewModule.dimensions.width}×${preview.previewModule.dimensions.height}mm) → ${preview.snapLabel}`
      );
    };

    const handle3DDrop = (e: React.DragEvent<HTMLDivElement>) => {
      const rawMatJson = e.dataTransfer.getData("application/x-birim-material");
      const winDraggedMat = typeof window !== "undefined" ? (window as any).__birimDraggedMaterial : null;
      let droppedMat: { materialId: string; materialName?: string } | null = winDraggedMat;
      if (!droppedMat && rawMatJson) {
        try { droppedMat = JSON.parse(rawMatJson); } catch {}
      }
      if (droppedMat?.materialId) {
        e.preventDefault();
        if (typeof window !== "undefined") (window as any).__birimDraggedMaterial = null;
        const curRenderer = rendererRef.current;
        const curGroup = meshGroupRef.current;
        const curCam = (controlsRef.current?.object as THREE.Camera) || perspCamRef.current;
        if (curRenderer && curGroup && curCam) {
          const rect = curRenderer.domElement.getBoundingClientRect();
          const ndc = new THREE.Vector2(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            -((e.clientY - rect.top) / rect.height) * 2 + 1
          );
          const rc = new THREE.Raycaster();
          rc.setFromCamera(ndc, curCam);
          const hits = rc.intersectObjects(curGroup.children, true);
          const hit = hits.find((h) => h.object instanceof THREE.Mesh && typeof h.object.userData?.moduleIndex === "number");
          if (hit) {
            const mIdx = Number(hit.object.userData.moduleIndex);
            const role = String(hit.object.userData.role || "");
            const cid = String(hit.object.userData.componentId || "");
            const matId = droppedMat.materialId;
            const st = useConfiguratorStore.getState();
            let zoneLabel = "Gövde";
            st.applyBatchProjectUpdate((draft) => {
              const m = draft.modules[mIdx];
              if (!m) return;
              if (role === "door" || role.startsWith("door_") && role !== "door_handle" && role !== "door_hinge" || role === "drawer_front") {
                m.carcass.doorMaterialId = matId;
                m.bays.forEach((b) => { if (b.door) b.door.doorMaterialId = matId; });
                zoneLabel = "Kapak & Cephe";
              } else if (role === "door_handle" || role === "drawer_handle" || role === "gola_profile") {
                m.bays.forEach((b) => { if (b.door) b.door.handleMaterialId = matId; });
                zoneLabel = "Kulp / Gola";
              } else if (role === "countertop" || cid.includes("countertop")) {
                m.carcass.countertopMaterialId = matId;
                zoneLabel = "Tezgâh";
              } else if (role === "plinth" || cid.includes("plinth")) {
                m.carcass.plinthMaterialId = matId;
                zoneLabel = "Baza";
              } else {
                m.carcass.bodyMaterialId = matId;
                zoneLabel = "Gövde";
              }
            }, "Sürükle-bırak malzeme uygulandı");
            st.setActiveModuleIndex(mIdx);
            setSnapBannerDedup(`✓ ${droppedMat.materialName || "Malzeme"} → Modül #${mIdx + 1} ${zoneLabel} uygulandı`);
            setTimeout(() => setSnapBannerDedup(null), 2600);
          } else {
            setSnapBannerDedup(null);
          }
        }
        return;
      }
      const activeAcc = typeof window !== "undefined" ? (window as any).__birimActiveDraggedAccessory : null;
      const hasAccessoryMime = e.dataTransfer.types.includes("application/x-birim-accessory-id");

      if (hasAccessoryMime || activeAcc || lastAccessoryDropTargetRef.current) {
        e.preventDefault();
        clear3DGhostPreview();
        const dropInfo = lastAccessoryDropTargetRef.current;
        const acc = dropInfo?.accessory || activeAcc || { id: "lib_shelf", title: "Raf" };
        const bayIdx = dropInfo ? dropInfo.bayIndex : 0;
        const elevY = dropInfo ? dropInfo.elevationY : 400;

        addInteriorItemAtElevation(bayIdx, acc.id, elevY, { offsetX: dropInfo?.offsetX });

        // Auto-open doors if closed so the user sees the newly placed accessory
        if (doorOpenAngleDeg === 0) {
          setDoorOpenAngleDeg(85);
        }

        setSnapBannerDedup(`✓ ${acc.title} yerleştirildi: Bölme ${bayIdx + 1} (Y: ${elevY} mm)`);
        setTimeout(() => setSnapBannerDedup(null), 3500);

        lastAccessoryDropTargetRef.current = null;
        if (typeof window !== "undefined") {
          (window as any).__birimActiveDraggedAccessory = null;
        }
        return;
      }

      // Detect if user dropped directly onto a 3D Wall (or fall back to selected activeWallId)
      const dropTarget = resolve3DDragTargetWallAndPoint(e);
      const dropWallId: string | undefined = dropTarget.wallId;
      const dropHitPoint: THREE.Vector3 | null = dropTarget.hitPoint;
      if (dropTarget.hitWallDirectly && dropWallId) {
        useConfiguratorStore.getState().setActiveWallId(dropWallId);
      }
      const effDropWalls = getEffectiveSpaceWalls(project);
      const primaryWallId = effDropWalls[0]?.id || "wall_main";
      const isSecondaryTargetWall = Boolean(
        dropWallId && (dropWallId !== primaryWallId || effDropWalls.length > 1)
      );

      const droppedSceneCatId =
        e.dataTransfer.getData("application/x-birim-scene-object-id") ||
        getActiveDraggedSceneCatalogId();
      if (droppedSceneCatId) {
        e.preventDefault();
        clear3DGhostPreview();
        setActiveDraggedSceneCatalogId(null);
        const wx = dropHitPoint ? dropHitPoint.x : resolve3DWorldXFromDragEvent(e);
        const wz = dropHitPoint ? dropHitPoint.z : 0;
        const placed = addSceneObjectFromCatalog(droppedSceneCatId, {
          x: wx,
          z: wz,
          wallId: dropWallId,
        });
        if (placed) {
          setSnapBannerDedup(`✓ ${placed.name} hedef duvara yerleştirildi`);
          setTimeout(() => setSnapBannerDedup(null), 3200);
        }
        return;
      }

      const tplId =
        e.dataTransfer.getData("application/x-birim-template-id") ||
        getActiveDraggedTemplateId();
      clear3DGhostPreview();
      setActiveDraggedTemplateId(null);
      if (!tplId) return;
      e.preventDefault();
      if (isSecondaryTargetWall && dropWallId) {
        const placedMod = useConfiguratorStore.getState().appendModuleWithMultiWallSnap(tplId, {
          wallId: dropWallId,
          ...(dropHitPoint ? { worldX: dropHitPoint.x, worldZ: dropHitPoint.z } : {}),
        });
        const wName = effDropWalls.find((w) => w.id === dropWallId)?.name || "Seçili Duvar";
        if (placedMod) {
          setSnapBannerDedup(`✓ ${placedMod.name} → ${wName} üzerine yerleştirildi`);
          setTimeout(() => setSnapBannerDedup(null), 3200);
        }
        return;
      }
      const rawWorldX = resolve3DWorldXFromDragEvent(e);
      const res = dropV4TemplateWithSnap(tplId, rawWorldX);
      if (res) {
        setSnapBannerDedup(`✓ ${res.placedName} → ${res.snapLabel}`);
        setTimeout(() => setSnapBannerDedup(null), 3200);
      } else {
        setSnapBannerDedup(null);
      }
    };


  return {
    clear3DGhostPreview,
    handle3DDragOver,
    handle3DDrop,
  };
}
