"use client";

import { build3DModuleMultiHoleInstancedMesh } from "../../materials/ceilingAndMultiHole3DBuilder";
import * as THREE from "three";
import { createComponentMesh, publishSceneDiagnostics, createModuleGroup } from "../../../components/componentMesh";
import { batchStaticModuleCarcassMeshes } from "../staticCarcassBatcher";
import { generateModuleGeometry, DEFAULT_MATERIALS, getModuleOrientedFootprint } from "../../adapter/useV3Adapter";
import { calculateModulePlacement, computeProjectGrainContinuityMap, syncProjectCustomMaterials, computeModuleStructuralSignature, type MaterialDefinition } from "@birim/core";
import { GEOMETRY_ENGINE_REV } from "@birim/geometry";
import { getV3PbrMaterial } from "../../materials/pbrMaterialSystem";
import { markSharedMaterial, disposeObject3DTree, getCachedHardwarePerformanceTier } from "../../materials/webglResourceGuard";
import { buildCapsuleParametricModuleGroup } from "../../materials/capsuleAndProfileGeometry";
import { useConfiguratorStore } from "../../../store/useConfiguratorStore";
import { generateBOMForProject } from "@birim/manufacturing";
import { getContactAoShadowTexture, SHARED_UNIT_AO_PLANE_GEO, SHARED_SUBDIV_GRAB_BOX_GEO, SHARED_SUBDIV_GRAB_MAT, SHARED_BAY_HIT_MAT, SHARED_BASE_CREVICE_MAT, getCachedContactAoMaterials, getLinearCreviceAoTexture, getHorizontalCornerAoTexture, getKelvinUnderShelfWashTexture, getGaussianLedBloomTexture, xrayIcePanelMat, xrayHoleUnitCylinder, hingeMountHole3DMat, hingeMountRing3DMat, xrayHoleMatD5, xrayHoleMatD8, xrayHoleMatD15, xrayHoleMatCable, xrayLedGrooveMat, xrayLedDriverMat, xrayHoleMatD35, xrayGrooveMat, cadHardwareMat, cadTechnicalMat, cadSelectedMat, getCachedEdgeMaterial, creviceAoMatCache } from "./viewport3DSharedAssets";
import { computeModuleTopologySignature, formatEngineeringErrorCode } from "./viewport3DSceneHelpers";

import type { SyncParametricCabinetMeshes3DCtx } from "./viewport3DTypes";

export function syncParametricCabinetMeshes3D(ctx: SyncParametricCabinetMeshes3DCtx): boolean {
  const { activeBayIndex, activeModuleIndex, cutawayActiveBay, doorOpenAngleDeg, doorsHiddenIn3D, drawerOpenMm, effectiveDoorsHiddenIn3D, engineeringBeaconGroupRef, explodedFactor, isStoreBatchDragging, isXrayActive, lightingPreset, live3DEngineeringReport, markShadowsAndRender, meshGroup, multiHoleMeshCacheRef, project, renderEdgeMode, rendererRef, requestRender, restoreHoverPreviewMaterials, section3DAxis, selectedComponentId, solidMeshesCacheRef, spaceObstacles, storeBom, theme, updateSelectionFramesRef } = ctx;
      restoreHoverPreviewMaterials();

      const needsActiveModInSig = cutawayActiveBay;
      const baseViewSuffix = `|REV:${GEOMETRY_ENGINE_REV}|${effectiveDoorsHiddenIn3D ? 1 : 0}:${cutawayActiveBay ? 1 : 0}:${renderEdgeMode}:${isXrayActive ? 1 : 0}`;
      const baseSigs = project.modules.map((mod, modIdx) =>
        `${computeModuleStructuralSignature(mod)}|ACT:${needsActiveModInSig && modIdx === activeModuleIndex ? activeBayIndex : -2}${baseViewSuffix}`
      );
      const moduleSigs = baseSigs.map(
        (bSig) => `${bSig}|KIN:${doorOpenAngleDeg}:${drawerOpenMm}:${explodedFactor}`
      );
      const topoSigs = project.modules.map(
        (mod, modIdx) =>
          `${computeModuleTopologySignature(mod)}|ACT:${needsActiveModInSig && modIdx === activeModuleIndex ? activeBayIndex : -2}${baseViewSuffix}|KIN:${doorOpenAngleDeg}:${drawerOpenMm}:${explodedFactor}`
      );

      if (
        meshGroup.children.length === project.modules.length &&
        project.modules.every((m, idx) => meshGroup.children[idx]?.userData?.renderSig === moduleSigs[idx])
      ) {
        let anyModTransformChanged = false;
        project.modules.forEach((m, idx) => {
          const child = meshGroup.children[idx];
          if (child) {
            child.userData.moduleIndex = idx;
            const pl = calculateModulePlacement(m);
            if (
              Math.abs(child.position.x - pl.origin.x) > 0.1 ||
              Math.abs(child.position.y - pl.origin.y) > 0.1 ||
              Math.abs(child.position.z - pl.origin.z) > 0.1 ||
              Math.abs(child.rotation.y - pl.rotationYRad) > 0.001
            ) {
              child.position.set(pl.origin.x, pl.origin.y, pl.origin.z);
              child.rotation.y = pl.rotationYRad;
              anyModTransformChanged = true;
            }
          }
        });
        updateSelectionFramesRef.current();
        if (anyModTransformChanged) {
          markShadowsAndRender();
        } else {
          requestRender();
        }
        return false;
      }

      // Zero-rebuild 60fps kinematic fast-path for door/drawer/exploded transforms
      if (
        meshGroup.children.length === project.modules.length &&
        project.modules.every(
          (m, idx) =>
            meshGroup.children[idx]?.userData?.baseRenderSig === baseSigs[idx] &&
            m.carcass.hullShape !== "capsule_stadium" &&
            m.carcass.hullShape !== "rounded_corners" &&
            m.carcass.hullShape !== "capsule_table" &&
            !m.bays.some((b) => b.door?.type === "tambour" || b.door?.doorSystemId === "tambour_roller")
        )
      ) {
        project.modules.forEach((m, idx) => {
          const child = meshGroup.children[idx];
          if (!child) return;
          child.userData.moduleIndex = idx;
          child.userData.renderSig = moduleSigs[idx];
          const pl = calculateModulePlacement(m);
          child.position.set(pl.origin.x, pl.origin.y, pl.origin.z);
          child.rotation.y = pl.rotationYRad;

          const bd = generateModuleGeometry(m, {
            doorOpenAngleDeg,
            drawerOpenMm,
            explodedFactor,
          });
          const compById = new Map(bd.components.map((c) => [c.id, c]));
          for (const sub of child.children) {
            const compId = sub.userData?.componentId;
            if (typeof compId !== "string") continue;
            const comp = compById.get(compId);
            if (!comp) continue;
            const pivot = comp.pivot ?? comp.position;
            sub.position.set(pivot.x, pivot.y, pivot.z);
            if (comp.rotation) {
              sub.rotation.set(comp.rotation[0], comp.rotation[1], comp.rotation[2]);
            } else {
              sub.rotation.set(0, 0, 0);
            }
            if (comp.role === "door_hinge") {
              const doorYaw = comp.rotation?.[1] || 0;
              const carcassFixed = sub.userData?.hingeCarcassFixed;
              if (carcassFixed instanceof THREE.Object3D) {
                carcassFixed.rotation.y = -doorYaw;
              }
              const linkGroup = sub.userData?.hingeLinkGroup;
              if (linkGroup instanceof THREE.Object3D) {
                linkGroup.rotation.y = -doorYaw * 0.48;
              }
            }
            const aventosHousing = sub.userData?.aventosHousingGroup;
            if (aventosHousing instanceof THREE.Object3D) {
              aventosHousing.rotation.x = -(comp.rotation?.[0] || 0);
            }
          }
        });
        updateSelectionFramesRef.current();
        requestRender();
        return false;
      }
      // Zero-rebuild < 0.5ms Material Swap Fast-Path: when ONLY surface materials/finishes changed
      // (identical 3D geometry topology & kinematics), swap MeshPhysicalMaterials in-place with ZERO buffer disposal!
      if (
        !isXrayActive &&
        renderEdgeMode === "photoreal" &&
        meshGroup.children.length === project.modules.length &&
        project.modules.every(
          (m, idx) =>
            meshGroup.children[idx]?.userData?.topoSig === topoSigs[idx] &&
            m.carcass.hullShape !== "capsule_stadium" &&
            m.carcass.hullShape !== "rounded_corners" &&
            m.carcass.hullShape !== "capsule_table"
        )
      ) {
        syncProjectCustomMaterials(project.customMaterials);
        const fastMatMap = new Map<string, MaterialDefinition>(
          [...DEFAULT_MATERIALS, ...(project.customMaterials || [])].map((m) => [m.id, m])
        );
        const fastFallbackStone: MaterialDefinition = {
          id: "mat_stone_calacatta",
          name: "Çimstone Calacatta Kuvars",
          category: "compact",
          colorHex: "#f5f4f0",
          roughness: 0.22,
          metalness: 0.02,
          thickness: 20,
          costPerM2: 185,
          edgeBandCostPerM: 0,
          hasGrain: false,
        };
        const fastFallbackLed: MaterialDefinition = {
          id: "mat_led_warm_3000k",
          name: "Häfele Loox5 3000K Sıcak LED",
          category: "compact",
          colorHex: "#fff7d6",
          roughness: 0.2,
          metalness: 0.05,
          thickness: 8,
          costPerM2: 45,
          edgeBandCostPerM: 0,
          hasGrain: false,
        };

        project.modules.forEach((mod, modIdx) => {
          const modContainer = meshGroup.children[modIdx];
          if (!modContainer) return;
          if (modContainer.userData?.renderSig === moduleSigs[modIdx]) return;

          modContainer.userData.renderSig = moduleSigs[modIdx];
          modContainer.userData.baseRenderSig = baseSigs[modIdx];
          modContainer.userData.topoSig = topoSigs[modIdx];
          modContainer.userData.moduleIndex = modIdx;

          const bd = generateModuleGeometry(mod, {
            doorOpenAngleDeg,
            drawerOpenMm,
            explodedFactor,
          });
          const compById = new Map(bd.components.map((c) => [c.id, c]));

          for (const compGroup of modContainer.children) {
            const compId = compGroup.userData?.componentId;
            if (typeof compId !== "string") continue;
            const comp = compById.get(compId);
            if (!comp) continue;

            const isLedStrip =
              comp.materialId.startsWith("mat_led_") || comp.id.includes("_recessed_led_");
            const matDef =
              fastMatMap.get(comp.materialId) ||
              (comp.role === "countertop" || comp.materialId === "mat_stone_calacatta"
                ? fastFallbackStone
                : isLedStrip
                ? { ...fastFallbackLed, id: comp.materialId || "mat_led_warm_3000k" }
                : DEFAULT_MATERIALS[0]);
            const isSelected = comp.id === selectedComponentId;
            const isRail =
              !isLedStrip &&
              (comp.role === "hanging_rail" ||
                ((comp.role === "door_handle" || comp.role === "drawer_handle") &&
                  comp.handleCategory !== "milled_wood_grip" &&
                  comp.handleCategory !== "j_pull") ||
                comp.role === "gola_profile" ||
                comp.role === "drawer_slide" ||
                comp.role === "door_hinge" ||
                comp.role.includes("fit"));
            const grainDir =
              mod.componentGrainOverrides?.[comp.id] ||
              (comp.role.includes("door") ? mod.componentGrainOverrides?.__doors__ : undefined) ||
              (comp.role === "drawer_front" ? mod.componentGrainOverrides?.__drawers__ : undefined) ||
              mod.componentGrainOverrides?.__all__ ||
              "lengthwise";
            const nextPbrMat = getV3PbrMaterial(
              matDef,
              isSelected,
              isRail,
              grainDir,
              mod.surfaceFinishOverride
            );
            compGroup.userData.matDef = matDef;
            compGroup.userData.grainDir = grainDir;
            compGroup.userData.surfFin = mod.surfaceFinishOverride;
            compGroup.traverse((sub) => {
              if (
                (sub instanceof THREE.Mesh || sub instanceof THREE.InstancedMesh) &&
                !sub.userData?.preserveCustomMaterial &&
                !sub.userData?.isSelectionHelper &&
                !sub.userData?.isContactShadow
              ) {
                sub.material = nextPbrMat;
                if (sub.userData) {
                  sub.userData.matDef = matDef;
                }
              }
            });
          }
        });
        updateSelectionFramesRef.current();
        requestRender();
        return false;
      }

      solidMeshesCacheRef.current.dirty = true;

      // Differential per-module cache: reuse unchanged module groups (e.g. multi-cabinet kitchens)
      // and strictly dispose GPU buffers of invalidated or deleted module groups!
      const reusableGroupsBySig = new Map<string, THREE.Object3D[]>();
      for (const existingChild of [...meshGroup.children]) {
        const sig = existingChild?.userData?.renderSig;
        if (typeof sig === "string" && moduleSigs.includes(sig)) {
          const list = reusableGroupsBySig.get(sig) || [];
          list.push(existingChild);
          reusableGroupsBySig.set(sig, list);
        } else {
          for (const sub of [...existingChild.children]) {
            if (sub.userData?.isSharedCachedProps) {
              existingChild.remove(sub);
            }
          }
          disposeObject3DTree(existingChild);
        }
      }
      meshGroup.clear();
      const matMap = new Map(DEFAULT_MATERIALS.map((m) => [m.id, m]));
      const isLight = theme !== "dark";

      const fallbackStoneDef: MaterialDefinition = {
        id: "mat_stone_calacatta",
        name: "Çimstone Calacatta Kuvars",
        category: "compact",
        colorHex: "#f5f4f0",
        roughness: 0.22,
        metalness: 0.02,
        thickness: 20,
        costPerM2: 185,
        edgeBandCostPerM: 0,
        hasGrain: false,
      };
      const fallbackLedDef: MaterialDefinition = {
        id: "mat_led_warm_3000k",
        name: "Häfele Loox5 3000K Sıcak LED",
        category: "compact",
        colorHex: "#fff7d6",
        roughness: 0.2,
        metalness: 0.05,
        thickness: 8,
        costPerM2: 45,
        edgeBandCostPerM: 0,
        hasGrain: false,
      };

      let activeSceneLedLights = 0;
      const grainContinuityMap3D = computeProjectGrainContinuityMap(project);
      project.modules.forEach((mod, modIdx) => {
        const reusableBucket = reusableGroupsBySig.get(moduleSigs[modIdx]);
        if (reusableBucket && reusableBucket.length > 0) {
          const reusedGroup = reusableBucket.shift()!;
          const pl = calculateModulePlacement(mod);
          reusedGroup.position.set(pl.origin.x, pl.origin.y, pl.origin.z);
          reusedGroup.rotation.y = pl.rotationYRad;
          meshGroup.add(reusedGroup);
          return;
        }

        const breakdown = generateModuleGeometry(mod, {
          doorOpenAngleDeg,
          drawerOpenMm,
          explodedFactor,
        });

        syncProjectCustomMaterials(project.customMaterials);
        (project.customMaterials || []).forEach((cm) => matMap.set(cm.id, cm));

        const isActiveMod = modIdx === activeModuleIndex;
        const modContainer = createModuleGroup(mod);
        modContainer.userData = {
          moduleId: mod.id,
          renderSig: moduleSigs[modIdx],
          baseRenderSig: baseSigs[modIdx],
          topoSig: topoSigs[modIdx],
          moduleIndex: modIdx,
        };

        if (
          mod.carcass.hullShape === "capsule_stadium" ||
          mod.carcass.hullShape === "rounded_corners" ||
          mod.carcass.hullShape === "capsule_table"
        ) {
          const capEdgeMat = getCachedEdgeMaterial(
            false,
            isActiveMod,
            isLight,
            renderEdgeMode === "photoreal"
          );
          const capGroup = buildCapsuleParametricModuleGroup(
            mod,
            (mId, isMetal) => {
              const md =
                matMap.get(mId) ||
                (mId.includes("calacatta") || mId.includes("stone")
                  ? fallbackStoneDef
                  : DEFAULT_MATERIALS[0]);
              return isXrayActive
                ? xrayIcePanelMat
                : renderEdgeMode === "cad"
                ? cadTechnicalMat
                : getV3PbrMaterial(md, false, Boolean(isMetal), "lengthwise", mod.surfaceFinishOverride);
            },
            capEdgeMat,
            modIdx,
            effectiveDoorsHiddenIn3D ? 85 : doorOpenAngleDeg,
            drawerOpenMm
          );
          modContainer.add(capGroup);
        } else {
        breakdown.components.forEach((comp) => {
          const isLedStrip =
            comp.materialId.startsWith("mat_led_") || comp.id.includes("_recessed_led_");
          const matDef =
            matMap.get(comp.materialId) ||
            (comp.role === "countertop" || comp.materialId === "mat_stone_calacatta"
              ? fallbackStoneDef
              : isLedStrip
              ? { ...fallbackLedDef, id: comp.materialId || "mat_led_warm_3000k" }
              : DEFAULT_MATERIALS[0]);
          const isSelected = comp.id === selectedComponentId;
          const isRail =
            !isLedStrip &&
            (comp.role === "hanging_rail" ||
              ((comp.role === "door_handle" || comp.role === "drawer_handle") &&
                comp.handleCategory !== "milled_wood_grip" &&
                comp.handleCategory !== "j_pull") ||
              comp.role === "gola_profile" ||
              comp.role === "drawer_slide" ||
              comp.role === "door_hinge" ||
              comp.role.includes("fit"));

          const grainDir =
            mod.componentGrainOverrides?.[comp.id] ||
            (comp.role.includes("door") ? mod.componentGrainOverrides?.__doors__ : undefined) ||
            (comp.role === "drawer_front" ? mod.componentGrainOverrides?.__drawers__ : undefined) ||
            mod.componentGrainOverrides?.__all__ ||
            "lengthwise";
          const surfFin = mod.surfaceFinishOverride;
          const material =
            isXrayActive && !isLedStrip
              ? xrayIcePanelMat
              : renderEdgeMode === "cad"
              ? isSelected
                ? cadSelectedMat
                : comp.role === "door_handle" ||
                  comp.role === "drawer_handle" ||
                  comp.role === "gola_profile"
                ? cadHardwareMat
                : cadTechnicalMat
              : getV3PbrMaterial(matDef, isSelected, isRail, grainDir, surfFin);
          const edgeMat = isXrayActive
            ? new THREE.LineBasicMaterial({ color: 0x0284c7, transparent: true, opacity: 0.72 })
            : getCachedEdgeMaterial(isSelected, isActiveMod, isLight, renderEdgeMode === "photoreal");

          const isDoorPart =
            String(comp.role) === "door" ||
            comp.role.startsWith("door_") ||
            comp.role === "door_handle" ||
            comp.role === "door_hinge";
          const isCutawayBayDoor =
            isActiveMod &&
            cutawayActiveBay &&
            isDoorPart &&
            comp.bayIndex === activeBayIndex &&
            !comp.id.includes("sliding");
          if ((effectiveDoorsHiddenIn3D || isCutawayBayDoor) && isDoorPart) {
            return;
          }
          const grainMatch = grainContinuityMap3D.get(comp.id);
          const isMiter45Mod =
            mod.carcass.carcassJoineryTopology === "miter_45" ||
            mod.carcass.jointType === "miter_45";
          const compGroup = createComponentMesh(comp, material, edgeMat, {
            componentId: comp.id,
            isMiter45Carcass: isMiter45Mod,
            label: comp.label || comp.role,
            dimsText: `${comp.dimensions.width}×${comp.dimensions.height} mm`,
            role: comp.role,
            moduleIndex: modIdx,
            bayIndex: comp.bayIndex,
            matDef,
            grainDir,
            surfFin,
            continuousGrainUv: grainMatch
              ? {
                  offsetXMm: grainMatch.offsetXMm,
                  offsetYMm: grainMatch.offsetYMm,
                  crosswise: grainMatch.grainDirection === "crosswise",
                }
              : undefined,
          });
          compGroup.userData = {
            ...compGroup.userData,
            componentId: comp.id,
            parentComponentId: comp.parentComponentId,
            role: comp.role,
            bayIndex: comp.bayIndex,
          };
          compGroup.traverse((sub) => {
            if (sub instanceof THREE.LineSegments) {
              if (renderEdgeMode === "cad") {
                if (sub.userData?.isCadSwingLine) sub.visible = true;
                if (sub.userData?.isRevealSeam) sub.visible = false;
              } else if (renderEdgeMode === "photoreal") {
                if (!sub.userData?.isRevealSeam && !isSelected) {
                  sub.visible = false;
                }
              }
            }
          });
          if (
            comp.role === "carcass_sub_divider" &&
            typeof comp.bayIndex === "number" &&
            (mod.bays[comp.bayIndex]?.subDividers || []).some(
              (sd, sdIdx) => sd.id === comp.id || `${mod.id}_bay_${comp.bayIndex}_subdiv_${sdIdx}` === comp.id
            )
          ) {
            const grabMesh = new THREE.Mesh(SHARED_SUBDIV_GRAB_BOX_GEO, SHARED_SUBDIV_GRAB_MAT);
            grabMesh.scale.set(
              Math.max(58, comp.dimensions.width + 40),
              Math.max(60, comp.dimensions.height),
              Math.max(120, comp.dimensions.depth)
            );
            grabMesh.position.set(
              comp.dimensions.width / 2,
              comp.dimensions.height / 2,
              comp.dimensions.depth / 2
            );
            grabMesh.userData = {
              componentId: comp.id,
              role: comp.role,
              label: comp.label || "Raf Arası Dikme",
              moduleIndex: modIdx,
              bayIndex: comp.bayIndex,
              isSelectionHelper: true,
              preserveCustomMaterial: true,
            };
            compGroup.add(grabMesh);
          }
          modContainer.add(compGroup);

          // Interior LED PointLights are placed cleanly at bay centers below (prevents hot-spots 1mm from side panels)
          void activeSceneLedLights;
        });
        }

        const aoTex = renderEdgeMode === "cad" ? null : getContactAoShadowTexture();
        if (aoTex) {
          const { groundAoMat, wallAoMat } = getCachedContactAoMaterials(aoTex);
          if (!isActiveMod && !isXrayActive) {
            if (mod.carcass.carcassJoineryTopology !== "miter_45" && mod.carcass.jointType !== "miter_45") {
              batchStaticModuleCarcassMeshes(modContainer, modIdx);
            }
          }

          if (mod.position.y <= 80) {
            const aoMesh = new THREE.Mesh(SHARED_UNIT_AO_PLANE_GEO, groundAoMat);
            aoMesh.scale.set(mod.dimensions.width + 150, mod.dimensions.depth + 150, 1);
            aoMesh.raycast = () => {};
            aoMesh.rotation.x = -Math.PI / 2;
            aoMesh.position.set(
              mod.dimensions.width / 2,
              -mod.position.y + 1.2,
              mod.dimensions.depth / 2 + 18
            );
            modContainer.add(aoMesh);

            // Crisp dark grounding contact shadow line directly beneath plinth toe-kick & side panels
            const baseCrevice = new THREE.Mesh(SHARED_UNIT_AO_PLANE_GEO, SHARED_BASE_CREVICE_MAT);
            baseCrevice.scale.set(mod.dimensions.width + 8, mod.dimensions.depth + 8, 1);
            baseCrevice.raycast = () => {};
            baseCrevice.rotation.x = -Math.PI / 2;
            baseCrevice.position.set(
              mod.dimensions.width / 2,
              -mod.position.y + 1.6,
              mod.dimensions.depth / 2
            );
            modContainer.add(baseCrevice);
          }

          // Wide Back-Wall Contact Shadow Halo behind EVERY cabinet so carcass NEVER blends into the wall
          const wallAoMesh = new THREE.Mesh(SHARED_UNIT_AO_PLANE_GEO, wallAoMat);
          wallAoMesh.scale.set(mod.dimensions.width + 280, mod.dimensions.height + 260, 1);
          wallAoMesh.raycast = () => {};
          wallAoMesh.position.set(
            mod.dimensions.width / 2,
            mod.dimensions.height / 2,
            2.5
          );
          modContainer.add(wallAoMesh);
        }
        // Architectural 4-Corner Interior Cavity AO + Physical Multi-Kelvin 3D LED Light Strips & Washes (Photoreal)
        if (renderEdgeMode !== "cad") {
          const hasAnyLedFitting = mod.bays.some((b) =>
            (b.specialFittings || []).some((f) => f.type.startsWith("led_"))
          );
          const isLedActive = Boolean(mod.carcass.ledLightingEnabled) || hasAnyLedFitting;
          const ledKelvin = mod.carcass.ledColorTempK || 3000;
          const ledDimmer = Math.max(0.25, Math.min(1, (mod.carcass.ledDimmerPct ?? 90) / 100));
          const ledMode = mod.carcass.ledPlacementMode || "top_and_shelves";
          const ledHex =
            ledKelvin <= 2800 ? 0xffa73b : ledKelvin >= 3800 ? 0xfff1d6 : 0xffc864;

          const hwTierForLights = getCachedHardwarePerformanceTier();
          const allowDynamicPointLights =
            hwTierForLights !== "tier0_software" && hwTierForLights !== "tier1_low_igpu";

          if (allowDynamicPointLights && isLedActive && activeSceneLedLights < 3) {
            activeSceneLedLights += 1;
            const cavityLight = new THREE.PointLight(
              ledHex,
              (lightingPreset === "night_led" ? 6.4 : lightingPreset === "showroom_warm" ? 4.0 : 2.5) * ledDimmer,
              2700,
              0.22
            );
            cavityLight.castShadow = false;
            cavityLight.position.set(
              mod.dimensions.width / 2,
              mod.dimensions.height * 0.64,
              mod.dimensions.depth * 0.68
            );
            modContainer.add(cavityLight);
          }

          const creviceTex = getLinearCreviceAoTexture();
          const leftCornerAoTex = getHorizontalCornerAoTexture("left");
          const rightCornerAoTex = getHorizontalCornerAoTexture("right");
          const underShelfLedTex = isLedActive ? getKelvinUnderShelfWashTexture(ledKelvin) : null;
          const stripBloomTex = isLedActive ? getGaussianLedBloomTexture(ledKelvin) : null;

          const pT = mod.carcass.panelThickness || 18;
          const plH = mod.carcass.plinthHeight ?? 100;
          const inH =
            breakdown.netInnerHeight || Math.max(300, mod.dimensions.height - plH - 2 * pT);
          let bxCursor = pT;

          mod.bays.forEach((bObj, bI) => {
            const bW =
              breakdown.bayWidths[bI] ||
              Math.round((mod.dimensions.width - (mod.bays.length + 1) * pT) / mod.bays.length);
            const bayVis =
              Boolean(section3DAxis) ||
              doorsHiddenIn3D ||
              (isActiveMod && cutawayActiveBay && bI === activeBayIndex) ||
              doorOpenAngleDeg > 5 ||
              Boolean(mod.isOpenFront) ||
              bObj.door.type === "open" ||
              bObj.door.doorSystemId === "open" ||
              Boolean(bObj.door.isGlassFramed) ||
              bObj.door.crossSectionProfile === "glass_frame" ||
              bObj.door.crossSectionProfile === "center_glass_frame" ||
              bObj.door.crossSectionProfile === "u_glass_open_top" ||
              String(bObj.door.doorMaterialId || "").includes("glass");

            if (bayVis && creviceTex) {
              if (!creviceAoMatCache.topMat) {
                creviceAoMatCache.topMat = markSharedMaterial(
                  new THREE.MeshBasicMaterial({ map: creviceTex, transparent: true, opacity: 0.86, depthWrite: false })
                );
              }
              if (!creviceAoMatCache.shelfMat) {
                creviceAoMatCache.shelfMat = markSharedMaterial(
                  new THREE.MeshBasicMaterial({ map: creviceTex, transparent: true, opacity: 0.72, depthWrite: false })
                );
              }
              const topCrevice = new THREE.Mesh(SHARED_UNIT_AO_PLANE_GEO, creviceAoMatCache.topMat);
              topCrevice.scale.set(Math.max(60, bW - 2), 115, 1);
              topCrevice.raycast = () => {};
              topCrevice.position.set(bxCursor + bW / 2, plH + pT + inH - 57.5, pT + 1.1);
              modContainer.add(topCrevice);

              if (leftCornerAoTex && rightCornerAoTex) {
                if (!creviceAoMatCache.leftCornerMat) {
                  creviceAoMatCache.leftCornerMat = markSharedMaterial(
                    new THREE.MeshBasicMaterial({ map: leftCornerAoTex, transparent: true, opacity: 0.72, depthWrite: false })
                  );
                }
                if (!creviceAoMatCache.rightCornerMat) {
                  creviceAoMatCache.rightCornerMat = markSharedMaterial(
                    new THREE.MeshBasicMaterial({ map: rightCornerAoTex, transparent: true, opacity: 0.72, depthWrite: false })
                  );
                }
                const cornerW = Math.min(92, bW * 0.24);
                const cornerH = Math.max(120, inH - 4);
                const leftAo = new THREE.Mesh(SHARED_UNIT_AO_PLANE_GEO, creviceAoMatCache.leftCornerMat);
                leftAo.scale.set(cornerW, cornerH, 1);
                leftAo.raycast = () => {};
                leftAo.position.set(bxCursor + cornerW / 2, plH + pT + inH / 2, pT + 1.25);
                modContainer.add(leftAo);

                const rightAo = new THREE.Mesh(SHARED_UNIT_AO_PLANE_GEO, creviceAoMatCache.rightCornerMat);
                rightAo.scale.set(cornerW, cornerH, 1);
                rightAo.raycast = () => {};
                rightAo.position.set(bxCursor + bW - cornerW / 2, plH + pT + inH / 2, pT + 1.25);
                modContainer.add(rightAo);
              }

              (bObj.shelves || []).slice(0, 8).forEach((sh) => {
                if (sh.elevationY > 70) {
                  const shAo = new THREE.Mesh(SHARED_UNIT_AO_PLANE_GEO, creviceAoMatCache.shelfMat!);
                  shAo.scale.set(Math.max(60, bW - 2), 76, 1);
                  shAo.raycast = () => {};
                  shAo.userData = { shelfOwnerId: sh.id };
                  shAo.position.set(bxCursor + bW / 2, plH + pT + sh.elevationY - 38, pT + 1.15);
                  modContainer.add(shAo);
                }
              });
            }

            // 4. Soft Additive LED Grazing Light Washes (Physical 3D channels come solely from mesh-generator.ts — ZERO duplicate bars!)
            if (bayVis && isLedActive && underShelfLedTex) {
              const showHorizontalShelfLeds =
                ledMode === "shelf_underside" ||
                ledMode === "full_showcase" ||
                (bObj.specialFittings || []).some((f) => !f.isHidden && f.type === "led_profile");
              const showVerticalSideLeds =
                ledMode === "vertical_sides" ||
                ledMode === "full_showcase" ||
                (bObj.specialFittings || []).some((f) => !f.isHidden && f.type === "led_vertical_strip");

              const extBotDrawers = (bObj.drawers || []).filter(
                (d) => !d.isInternal && (d.elevationY || 0) < inH * 0.55
              );
              const openFloorLocalY =
                extBotDrawers.length > 0
                  ? Math.max(...extBotDrawers.map((d) => (d.elevationY || 0) + d.height)) + pT
                  : 0;

              const chanWidthMm = Math.max(6, Math.min(32, mod.carcass.ledChannelWidthMm ?? 12));
              const ledAligned = mod.carcass.ledAlignShelfAndSide !== false;
              const vSetbackMm = Math.max(
                35,
                Math.min(Math.max(60, mod.dimensions.depth - 45), mod.carcass.ledFrontSetbackMm ?? 75)
              );
              const hSetbackMm = ledAligned
                ? vSetbackMm
                : Math.max(
                    35,
                    Math.min(
                      Math.max(60, mod.dimensions.depth - 45),
                      mod.carcass.ledShelfSetbackMm ?? vSetbackMm
                    )
                  );
              const bloomSpanMm = Math.max(22, Math.round(chanWidthMm * 2.2));

              const emitHorizontalLedGlow = (undersideY: number, shelfOwnerId?: string) => {
                if (stripBloomTex) {
                  const hChanZ = Math.max(34, Math.round(mod.dimensions.depth - hSetbackMm));
                  // Reuse SHARED_UNIT_AO_PLANE_GEO (scaled) to avoid per-shelf BufferGeometry allocation
                  const underGlow = new THREE.Mesh(
                    SHARED_UNIT_AO_PLANE_GEO,
                    new THREE.MeshBasicMaterial({
                      map: stripBloomTex,
                      transparent: true,
                      opacity: (lightingPreset === "night_led" ? 0.42 : 0.25) * ledDimmer,
                      blending: THREE.AdditiveBlending,
                      depthWrite: false,
                      side: THREE.DoubleSide,
                    })
                  );
                  underGlow.scale.set(bloomSpanMm, Math.max(60, bW - 8), 1);
                  underGlow.raycast = () => {};
                  if (shelfOwnerId) underGlow.userData = { shelfOwnerId };
                  underGlow.rotation.x = Math.PI / 2;
                  underGlow.rotation.z = Math.PI / 2;
                  underGlow.position.set(bxCursor + bW / 2, undersideY - 2.2, hChanZ);
                  modContainer.add(underGlow);
                }

                const backWashH = 145;
                const backWash = new THREE.Mesh(
                  SHARED_UNIT_AO_PLANE_GEO,
                  new THREE.MeshBasicMaterial({
                    map: underShelfLedTex,
                    transparent: true,
                    opacity: (lightingPreset === "night_led" ? 0.72 : 0.48) * ledDimmer,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false,
                  })
                );
                backWash.scale.set(Math.max(60, bW - 8), backWashH, 1);
                backWash.raycast = () => {};
                if (shelfOwnerId) backWash.userData = { shelfOwnerId };
                backWash.position.set(bxCursor + bW / 2, undersideY - backWashH / 2, pT + 2.0);
                modContainer.add(backWash);
              };

              if (showHorizontalShelfLeds) {
                emitHorizontalLedGlow(plH + pT + inH);
                (bObj.shelves || []).slice(0, 8).forEach((sh) => {
                  if (!sh.isHidden && sh.elevationY > openFloorLocalY + 60) {
                    emitHorizontalLedGlow(plH + pT + sh.elevationY, sh.id);
                  }
                });
              }

              if (showVerticalSideLeds && stripBloomTex) {
                // Feather-soft Gaussian optical bloom locked 1-to-1 to vSetbackMm & chanWidthMm (0% alpha at edges)
                const vSpanH = Math.max(120, inH - openFloorLocalY - 10);
                const vCenterY = plH + pT + openFloorLocalY + 4 + vSpanH / 2;
                const vChanCenterZ = Math.max(34, Math.round(mod.dimensions.depth - vSetbackMm));
                const sideGlowMat = new THREE.MeshBasicMaterial({
                  map: stripBloomTex,
                  transparent: true,
                  opacity: (lightingPreset === "night_led" ? 0.36 : 0.2) * ledDimmer,
                  blending: THREE.AdditiveBlending,
                  depthWrite: false,
                  side: THREE.DoubleSide,
                });
                [
                  { x: bxCursor + 2.1, rotY: Math.PI / 2 },
                  { x: bxCursor + bW - 2.1, rotY: -Math.PI / 2 },
                ].forEach((sideSpec) => {
                  const glowPlane = new THREE.Mesh(SHARED_UNIT_AO_PLANE_GEO, sideGlowMat);
                  glowPlane.scale.set(bloomSpanMm, vSpanH, 1);
                  glowPlane.raycast = () => {};
                  glowPlane.rotation.y = sideSpec.rotY;
                  glowPlane.position.set(sideSpec.x, vCenterY, vChanCenterZ);
                  modContainer.add(glowPlane);
                });
              }

              // Warm 3D PBR interior illumination (strictly capped at <= 3 total scene PointLights & disabled on tier0/tier1)
              if (
                allowDynamicPointLights &&
                activeSceneLedLights < 3 &&
                project.modules.length <= 3 &&
                mod.bays.length <= 5
              ) {
                activeSceneLedLights += 1;
                const openSpanH = Math.max(200, inH - openFloorLocalY);
                const lightHex =
                  ledKelvin <= 2800 ? 0xffbe6b : ledKelvin >= 3800 ? 0xfff6e8 : 0xffdc9e;
                const upperBayLight = new THREE.PointLight(
                  lightHex,
                  (lightingPreset === "night_led" ? 4.2 : 1.9) * ledDimmer,
                  Math.max(1350, openSpanH * 1.15),
                  0.22
                );
                upperBayLight.position.set(
                  bxCursor + bW / 2,
                  plH + pT + openFloorLocalY + openSpanH * 0.68,
                  pT + (mod.dimensions.depth - pT) * 0.6
                );
                modContainer.add(upperBayLight);
              }
            }

            bxCursor += bW + pT;
          });
        }

        
        // 3D Direct Compartment Hit Volumes (independent of isActiveMod / activeBayIndex so clicking bays never rebuilds cabinet meshes!)
        if (mod.bays.length >= 1) {
          const T = mod.carcass.panelThickness || 18;
          const plinthH = mod.carcass.plinthHeight ?? 100;
          const innerH =
            breakdown.netInnerHeight || Math.max(300, mod.dimensions.height - plinthH - 2 * T);
          let curBayX = T;
          const showBayOverlay =
            cutawayActiveBay ||
            doorsHiddenIn3D ||
            doorOpenAngleDeg > 5 ||
            Boolean(mod.isOpenFront) ||
            mod.bays.some((b) => b.door.type === "open" || b.door.doorSystemId === "open");

          if (showBayOverlay) {
            mod.bays.forEach((_bayObj, bIdx) => {
              const bw =
                breakdown.bayWidths[bIdx] ||
                Math.round((mod.dimensions.width - (mod.bays.length + 1) * T) / mod.bays.length);
              const bayHitMesh = new THREE.Mesh(SHARED_UNIT_AO_PLANE_GEO, SHARED_BAY_HIT_MAT);
              bayHitMesh.scale.set(Math.max(80, bw - 6), Math.max(120, innerH - 6), 1);
              bayHitMesh.position.set(curBayX + bw / 2, plinthH + T + innerH / 2, T + 8);
              bayHitMesh.userData = {
                componentId: `${mod.id}_bay_compartment_${bIdx}`,
                role: "bay_compartment",
                moduleIndex: modIdx,
                bayIndex: bIdx,
              };
              modContainer.add(bayHitMesh);
              curBayX += bw + T;
            });
          }
        }

        // Interior styling props are managed in dedicated `interiorPropsGroupRef` layer (zero rebuild on door/material edits!)

        if (
          !isXrayActive &&
          !isStoreBatchDragging &&
          (doorOpenAngleDeg > 4 ||
            effectiveDoorsHiddenIn3D ||
            cutawayActiveBay ||
            mod.isOpenFront ||
            mod.bays.some((b) => b.door?.type === "open") ||
            mod.carcass.showMultiHolesIn3D === true)
        ) {
          const mhSig = computeModuleStructuralSignature(mod);
          let cachedMh = multiHoleMeshCacheRef.current.get(mhSig);
          if (!cachedMh) {
            const builtMh = build3DModuleMultiHoleInstancedMesh(mod, breakdown.components);
            if (builtMh) {
              if (multiHoleMeshCacheRef.current.size > 24) {
                multiHoleMeshCacheRef.current.clear();
              }
              multiHoleMeshCacheRef.current.set(mhSig, builtMh);
              cachedMh = builtMh;
            }
          }
          if (cachedMh) {
            const mhClone = cachedMh.clone();
            mhClone.instanceMatrix = cachedMh.instanceMatrix;
            mhClone.raycast = () => {};
            modContainer.add(mhClone);
          }

          // Kapaklar açıldığında veya gizlendiğinde dikme iç yüzlerinde 37mm (inset 57mm) ofsetli, 32mm adımlı Ø5mm menteşe taban deliklerini göster
          const hingeComps = breakdown.components.filter((c) => c.role === "door_hinge");
          if (hingeComps.length > 0) {
            const T = mod.carcass.panelThickness || 18;
            const bayStarts: number[] = [];
            let accX = T;
            mod.bays.forEach((_, bIdx) => {
              bayStarts.push(accX);
              accX +=
                (breakdown.bayWidths[bIdx] ||
                  Math.round((mod.dimensions.width - (mod.bays.length + 1) * T) / Math.max(1, mod.bays.length))) + T;
            });

            const holeMatrices: THREE.Matrix4[] = [];
            const ringMatrices: THREE.Matrix4[] = [];
            const dummy = new THREE.Object3D();

            hingeComps.forEach((hc) => {
              const bIdx = typeof hc.bayIndex === "number" ? hc.bayIndex : 0;
              const bw =
                breakdown.bayWidths[bIdx] ||
                Math.round((mod.dimensions.width - (mod.bays.length + 1) * T) / Math.max(1, mod.bays.length));
              const bayLeftX = bayStarts[bIdx] ?? T;
              const bayRightX = bayLeftX + bw;
              const refX = hc.position.x + hc.dimensions.width / 2;
              const isLeftWall = Math.abs(refX - bayLeftX) <= Math.abs(refX - bayRightX);
              const wallX = isLeftWall ? bayLeftX + 0.55 : bayRightX - 0.55;
              const ringX = isLeftWall ? bayLeftX + 0.4 : bayRightX - 0.4;
              // Her menteşenin kendi gerçek yüksekliği (hc.pivot kapağın alt köşesidir, kullanılmamalı!)
              const centerY = hc.position.y + hc.dimensions.height / 2;
              const isBayInset = mod.bays[bIdx]?.door?.overlayType === "inset";
              const frontSetback = isBayInset ? 57 : 37;
              const holeZ = Math.max(24, mod.dimensions.depth - frontSetback);

              [-16, 16].forEach((dy) => {
                dummy.position.set(ringX, centerY + dy, holeZ);
                dummy.rotation.set(0, 0, Math.PI / 2);
                dummy.scale.set(8.2, 1.6, 8.2);
                dummy.updateMatrix();
                ringMatrices.push(dummy.matrix.clone());

                dummy.position.set(wallX, centerY + dy, holeZ);
                dummy.rotation.set(0, 0, Math.PI / 2);
                dummy.scale.set(5, 2.2, 5);
                dummy.updateMatrix();
                holeMatrices.push(dummy.matrix.clone());
              });
            });

            if (ringMatrices.length > 0) {
              const hingeRingInst = new THREE.InstancedMesh(
                xrayHoleUnitCylinder,
                hingeMountRing3DMat,
                ringMatrices.length
              );
              hingeRingInst.raycast = () => {};
              ringMatrices.forEach((mtx, i) => hingeRingInst.setMatrixAt(i, mtx));
              hingeRingInst.instanceMatrix.needsUpdate = true;
              modContainer.add(hingeRingInst);
            }

            if (holeMatrices.length > 0) {
              const hingeHoleInst = new THREE.InstancedMesh(
                xrayHoleUnitCylinder,
                hingeMountHole3DMat,
                holeMatrices.length
              );
              hingeHoleInst.raycast = () => {};
              holeMatrices.forEach((mtx, i) => hingeHoleInst.setMatrixAt(i, mtx));
              hingeHoleInst.instanceMatrix.needsUpdate = true;
              modContainer.add(hingeHoleInst);
            }
          }
        }

        if (isXrayActive) {
          // V112: Always compute live per-module CNC cutList (skipSyncNesting: true) from the current `mod`
          // so X-Ray minifix/dowel/hinge holes track cabinet width/height/depth resizes in real time
          // instead of lagging behind a stale batch-deferred `storeBom`!
          const liveModBom = (() => {
            if (isStoreBatchDragging && storeBom) return storeBom;
            try {
              return generateBOMForProject(
                { ...project, modules: [mod] },
                undefined,
                { skipSyncNesting: true }
              );
            } catch {
              return storeBom;
            }
          })();
          const modPieces = (liveModBom?.cutList || []).filter((cp) => cp.moduleId === mod.id);
          const compById = new Map(breakdown.components.map((c) => [c.id, c]));
          const compByLabel = new Map(breakdown.components.map((c) => [c.label, c]));
          const buckets: Record<"d5" | "d8" | "d15" | "d35" | "cable", THREE.Matrix4[]> = {
            d5: [],
            d8: [],
            d15: [],
            d35: [],
            cable: [],
          };
          const matLookup = {
            d5: xrayHoleMatD5,
            d8: xrayHoleMatD8,
            d15: xrayHoleMatD15,
            d35: xrayHoleMatD35,
            cable: xrayHoleMatCable,
          } as const;
          const dummy = new THREE.Object3D();

          // Map shelf components for real-time 60 FPS drag-sync of shelf & mating side/divider holes!
          const shelfComps = breakdown.components.filter((c) => c.role === "shelf");
          const shelfHoleGroupById = new Map<string, THREE.Group>();
          const getOrCreateShelfHoleGroup = (shelfId: string) => {
            let grp = shelfHoleGroupById.get(shelfId);
            if (!grp) {
              grp = new THREE.Group();
              grp.userData = { componentId: `${shelfId}_xray_holes`, shelfOwnerId: shelfId };
              grp.raycast = () => {};
              shelfHoleGroupById.set(shelfId, grp);
              modContainer.add(grp);
            }
            return grp;
          };

          let moduleHasAnyLedInXray = false;

          modPieces.forEach((piece) => {
            const comp =
              compById.get(piece.id) ||
              compByLabel.get(piece.pieceName) ||
              breakdown.components.find(
                (c) =>
                  c.role === (piece as unknown as { role?: string }).role &&
                  Math.abs(c.dimensions.width - piece.widthMm) <= 25 &&
                  Math.abs(c.dimensions.height - piece.lengthMm) <= 25
              );
            if (!comp) return;
            const px = comp.position.x;
            const py = comp.position.y;
            const pz = comp.position.z;
            const cw = comp.dimensions.width;
            const ch = comp.dimensions.height;
            const cd = comp.dimensions.depth;
            const isSidePanel = cw <= 32 && ch > 100 && cd > 100;
            const isHorizPanel = ch <= 36 && cw > 100 && cd > 100;
            const isShelfComp = comp.role === "shelf";
            const hasCompRotation =
              Boolean(comp.rotation) &&
              (Math.abs(comp.rotation![0] || 0) > 1e-4 ||
                Math.abs(comp.rotation![1] || 0) > 1e-4 ||
                Math.abs(comp.rotation![2] || 0) > 1e-4);
            let compRotMatrix: THREE.Matrix4 | null = null;
            if (hasCompRotation && comp.rotation) {
              const piv = comp.pivot ?? comp.position;
              const tPos = new THREE.Matrix4().makeTranslation(piv.x, piv.y, piv.z);
              const tNeg = new THREE.Matrix4().makeTranslation(-piv.x, -piv.y, -piv.z);
              const rMat = new THREE.Matrix4().makeRotationFromEuler(
                new THREE.Euler(comp.rotation[0], comp.rotation[1], comp.rotation[2])
              );
              compRotMatrix = tPos.multiply(rMat).multiply(tNeg);
            }
            const polyContour =
              Array.isArray(comp.polygonContourMm) && comp.polygonContourMm.length >= 3
                ? comp.polygonContourMm
                : null;
            const isInsidePoly2D = (u: number, v: number, poly: [number, number][]): boolean => {
              let inside = false;
              for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) {
                const xi = poly[a][0];
                const yi = poly[a][1];
                const xj = poly[b][0];
                const yj = poly[b][1];
                const intersect =
                  yi > v !== yj > v && u < ((xj - xi) * (v - yi)) / (yj - yi || 1e-6) + xi;
                if (intersect) inside = !inside;
              }
              return inside;
            };

            (piece.holes || []).forEach((h) => {
              const isCableHole = h.purpose === "cable_exit" || (h.diameter >= 9 && h.diameter <= 11 && h.id.includes("led")) || h.id.includes("_drw_runner_");
              if (isCableHole) moduleHasAnyLedInXray = true;
              const bucketKey: "d5" | "d8" | "d15" | "d35" | "cable" = isCableHole
                ? "cable"
                : h.diameter >= 28
                ? "d35"
                : h.diameter >= 13
                ? "d15"
                : h.diameter >= 7
                ? "d8"
                : "d5";
              const depthMm = Math.max(8, Math.min(34, h.depth || 13));
              dummy.rotation.set(0, 0, 0);
              let holeWy = py + ch * 0.5;
              const isDrawerSide =
                comp.role === "drawer_side_left" || comp.role === "drawer_side_right";
              if (isDrawerSide) {
                // Wooden drawer sides: local x = side height (3D Y), local y = box depth from front to back (3D Z)
                const wy = py + Math.min(ch - 6, Math.max(6, h.x));
                holeWy = wy;
                const wz = pz + Math.min(cd - 6, Math.max(6, cd - h.y));
                if (h.direction.startsWith("edge_")) {
                  dummy.rotation.x = Math.PI / 2;
                  dummy.position.set(px + cw * 0.5, wy, wz);
                  dummy.scale.set(h.diameter, depthMm, h.diameter);
                } else {
                  dummy.rotation.z = Math.PI / 2;
                  dummy.position.set(px + cw * 0.5, wy, wz);
                  dummy.scale.set(h.diameter, depthMm, h.diameter);
                }
              } else if (isSidePanel) {
                if (h.y > ch + 4) return;
                const localY = Math.min(ch - 6, Math.max(6, h.y));
                const zFromBack = piece.mirrorInnerFaceX ? h.x : cd - h.x;
                const localZ = Math.min(cd - 6, Math.max(6, zFromBack));
                if (polyContour && comp.thicknessAxis === "x" && !isInsidePoly2D(localZ, localY, polyContour)) {
                  return;
                }
                const wx =
                  comp.role === "carcass_divider"
                    ? h.direction === "face_back"
                      ? px + cw - depthMm * 0.5
                      : px + depthMm * 0.5
                    : comp.role === "carcass_side_right"
                    ? px + depthMm * 0.5
                    : px + cw - depthMm * 0.5;
                const wy = py + localY;
                holeWy = wy;
                const wz = pz + localZ;
                if (h.direction.startsWith("edge_")) {
                  dummy.position.set(px + cw * 0.5, wy, wz);
                  dummy.scale.set(h.diameter, depthMm, h.diameter);
                } else {
                  dummy.rotation.z = Math.PI / 2;
                  dummy.position.set(wx, wy, wz);
                  dummy.scale.set(h.diameter, depthMm, h.diameter);
                }
              } else if (isHorizPanel) {
                const spanCoord = h.y;
                const depthCoord = h.x;
                if (spanCoord > cw + 6 || depthCoord > cd + 6) return;
                // Skip duplicate edge joint holes at the mitered seam where _top_sloped meets _top_flat
                const hasFlatSibling = breakdown.components.some((c) => c.id === `${mod.id}_top_flat`);
                if (hasFlatSibling && comp.id.includes("_top_sloped")) {
                  const rotZ = comp.rotation?.[2] || 0;
                  if (rotZ > 0 && spanCoord > cw - 24) return;
                  if (rotZ < 0 && spanCoord < 24) return;
                }
                if (hasFlatSibling && comp.id.includes("_top_flat")) {
                  const slopedSibling = breakdown.components.find((c) => c.id === `${mod.id}_top_sloped`);
                  const rotZ = slopedSibling?.rotation?.[2] || 0;
                  if (rotZ > 0 && spanCoord < 24) return;
                  if (rotZ < 0 && spanCoord > cw - 24) return;
                }
                const wx = px + Math.min(cw - 6, Math.max(6, spanCoord));
                const wz = pz + Math.min(cd - 6, Math.max(6, cd - depthCoord));
                if (h.direction.startsWith("edge_")) {
                  dummy.rotation.z = Math.PI / 2;
                  dummy.position.set(
                    spanCoord < cw * 0.5 ? px + depthMm * 0.5 : px + cw - depthMm * 0.5,
                    py + ch * 0.5,
                    wz
                  );
                  dummy.scale.set(h.diameter, depthMm, h.diameter);
                } else {
                  dummy.position.set(wx, py + ch * 0.5, wz);
                  dummy.scale.set(h.diameter, depthMm, h.diameter);
                }
              } else {
                const isAlreadySwappedDrawerFront =
                  comp.role === "drawer_front" && piece.widthMm > piece.lengthMm && cw > ch;
                const isWideDrawerPanel =
                  (comp.role === "drawer_back" && cw > ch) ||
                  (comp.role === "drawer_front" && cw > ch && !isAlreadySwappedDrawerFront);
                const rawX = isWideDrawerPanel ? h.y : h.x;
                const rawY = isWideDrawerPanel ? h.x : h.y;
                if (rawX > cw + 6 || rawY > ch + 6) return;
                const localX = Math.min(cw - 6, Math.max(6, rawX));
                const localY = Math.min(ch - 6, Math.max(6, rawY));
                if (polyContour && comp.thicknessAxis === "z" && !isInsidePoly2D(localX, localY, polyContour)) {
                  return;
                }
                const wx = px + localX;
                const wy = py + localY;
                holeWy = wy;
                dummy.rotation.x = Math.PI / 2;
                dummy.position.set(wx, wy, pz + cd * 0.5);
                dummy.scale.set(h.diameter, depthMm, h.diameter);
              }
              dummy.updateMatrix();
              if (compRotMatrix) {
                dummy.matrix.premultiply(compRotMatrix);
                dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
              }

              // V116: Bind shelf holes AND mating side/divider fixed-shelf bolts to the owning shelf's live drag group
              // so minifix & dowel holes glide smoothly in real time while dragging a shelf in X-Ray!
              let attachedShelfId: string | null = isShelfComp ? comp.id : null;
              if (
                !attachedShelfId &&
                isSidePanel &&
                (h.id.includes("_fs_") || h.id.includes("_div_lfs_") || h.id.includes("_div_rfs_") || h.id.includes("_rafix_") || h.id.includes("_tj_"))
              ) {
                const matchedShelf = shelfComps.find((sc) => {
                  const scMidY = sc.position.y + sc.dimensions.height * 0.5;
                  if (Math.abs(scMidY - holeWy) > 12) return false;
                  const touchesLeft = Math.abs(sc.position.x - (px + cw)) <= 12;
                  const touchesRight = Math.abs(sc.position.x + sc.dimensions.width - px) <= 12;
                  return touchesLeft || touchesRight;
                });
                if (matchedShelf) attachedShelfId = matchedShelf.id;
              }

              const drwRunnerMatch = h.id.match(/_drw_runner_(.+)_\d+$/);
              if (drwRunnerMatch) {
                const drwId = drwRunnerMatch[1];
                const hMesh = new THREE.Mesh(xrayHoleUnitCylinder, xrayHoleMatCable);
                hMesh.position.copy(dummy.position);
                hMesh.rotation.copy(dummy.rotation);
                hMesh.scale.copy(dummy.scale);
                hMesh.raycast = () => {};
                hMesh.renderOrder = 25;
                hMesh.userData = { componentId: `${drwId}_xray_runner_hole` };
                modContainer.add(hMesh);
              } else if (attachedShelfId) {
                const hMesh = new THREE.Mesh(xrayHoleUnitCylinder, matLookup[bucketKey]);
                hMesh.position.copy(dummy.position);
                hMesh.rotation.copy(dummy.rotation);
                hMesh.scale.copy(dummy.scale);
                hMesh.raycast = () => {};
                hMesh.renderOrder = 25;
                getOrCreateShelfHoleGroup(attachedShelfId).add(hMesh);
              } else {
                buckets[bucketKey].push(dummy.matrix.clone());
              }
            });

            // Visualize Back-Panel Grooves in X-Ray mode (Purple)
            if (piece.hasBackGroove && (isSidePanel || isHorizPanel)) {
              let effectiveSideGrooveH = ch;
              if (isSidePanel && polyContour && comp.thicknessAxis === "x") {
                const rearPts = polyContour.filter(([zPt]) => zPt <= 2);
                const rearTopY = rearPts.reduce((mx, [, yPt]) => Math.max(mx, yPt), 0);
                if (rearTopY > 40) effectiveSideGrooveH = Math.min(ch, rearTopY);
              }
              const grooveMesh = new THREE.Mesh(
                isSidePanel
                  ? new THREE.BoxGeometry(8, Math.max(40, effectiveSideGrooveH - 12), 8.5)
                  : new THREE.BoxGeometry(Math.max(40, cw - 12), 8, 8.5),
                xrayGrooveMat
              );
              grooveMesh.raycast = () => {};
              grooveMesh.renderOrder = 24;
              const gOff = piece.backGrooveOffsetMm ? Math.max(8, piece.backGrooveOffsetMm - 4) : 16;
              grooveMesh.position.set(
                isSidePanel ? (comp.role === "carcass_side_right" ? px + 4 : px + cw - 4) : px + cw * 0.5,
                isSidePanel ? py + effectiveSideGrooveH * 0.5 : py + ch * 0.5,
                pz + gOff
              );
              if (compRotMatrix) {
                grooveMesh.updateMatrix();
                grooveMesh.matrix.premultiply(compRotMatrix);
                grooveMesh.matrix.decompose(grooveMesh.position, grooveMesh.quaternion, grooveMesh.scale);
              }
              modContainer.add(grooveMesh);
            }

            // V116: Visualize Recessed LED Milling Grooves in X-Ray mode (Bright Amber-Gold #FACC15)
            if (piece.ledGrooveSpec?.enabled && (isSidePanel || isHorizPanel)) {
              moduleHasAnyLedInXray = true;
              const gw = Math.max(8, piece.ledGrooveSpec.widthMm || 10);
              const gd = Math.max(6, piece.ledGrooveSpec.depthMm || 8);
              const ledOff = piece.ledGrooveSpec.offsetFromFrontMm || 30;
              const ledMesh = new THREE.Mesh(
                isSidePanel
                  ? new THREE.BoxGeometry(gd, Math.max(40, ch - 24), gw)
                  : new THREE.BoxGeometry(Math.max(40, cw - 16), gd, gw),
                xrayLedGrooveMat
              );
              ledMesh.raycast = () => {};
              ledMesh.renderOrder = 25;
              ledMesh.position.set(
                isSidePanel ? (comp.role === "carcass_side_right" ? px + gd * 0.5 : px + cw - gd * 0.5) : px + cw * 0.5,
                isSidePanel ? py + ch * 0.5 : py + gd * 0.5,
                pz + Math.max(24, cd - ledOff)
              );
              if (isShelfComp) {
                getOrCreateShelfHoleGroup(comp.id).add(ledMesh);
              } else {
                modContainer.add(ledMesh);
              }
            }
          });

          // V116: Highlight LED fittings & render compact 24V LED Driver box at top-rear service cavity in X-Ray!
          breakdown.components.forEach((fComp) => {
            if (fComp.id.includes("led") || fComp.label.toLowerCase().includes("led")) {
              moduleHasAnyLedInXray = true;
              const lm = new THREE.Mesh(
                new THREE.BoxGeometry(
                  Math.max(8, fComp.dimensions.width),
                  Math.max(8, fComp.dimensions.height),
                  Math.max(8, fComp.dimensions.depth)
                ),
                xrayLedGrooveMat
              );
              lm.position.set(
                fComp.position.x + fComp.dimensions.width * 0.5,
                fComp.position.y + fComp.dimensions.height * 0.5,
                fComp.position.z + fComp.dimensions.depth * 0.5
              );
              lm.raycast = () => {};
              lm.renderOrder = 25;
              modContainer.add(lm);
            }
          });
          if (moduleHasAnyLedInXray) {
            const drvW = Math.min(180, Math.max(110, mod.dimensions.width * 0.16));
            const isSlopedMod =
              (mod.carcass.roofSlope && mod.carcass.roofSlope.side !== "none") ||
              (mod.carcass.slopedCeiling && mod.carcass.slopedCeiling.mode !== "none");
            const drvY = isSlopedMod
              ? Math.max(20, (mod.carcass.plinthHeight || 80) * 0.5)
              : mod.dimensions.height + 16;
            const drvGeo = new THREE.BoxGeometry(drvW, 28, 52);
            const drvMesh = new THREE.Mesh(drvGeo, xrayLedDriverMat);
            drvMesh.position.set(mod.dimensions.width * 0.5, drvY, isSlopedMod ? Math.min(140, mod.dimensions.depth * 0.4) : 42);
            drvMesh.raycast = () => {};
            drvMesh.renderOrder = 24;
            const drvEdge = new THREE.LineSegments(
              new THREE.EdgesGeometry(drvGeo),
              new THREE.LineBasicMaterial({ color: 0xfacc15 })
            );
            drvEdge.position.copy(drvMesh.position);
            drvEdge.raycast = () => {};
            modContainer.add(drvMesh, drvEdge);
          }

          // V107/V116: Visualize Drawer Box Bottom Grooves (tagged to drawer for live drag sync!)
          breakdown.components.forEach((dComp) => {
            if (dComp.role === "drawer_bottom" || dComp.id.endsWith("_bottom")) {
              const dw = dComp.dimensions.width;
              const dd = dComp.dimensions.depth;
              const dy = dComp.position.y + 4;
              const dx = dComp.position.x;
              const dz = dComp.position.z;
              const baseDrwId = dComp.id.replace(/_bottom$/, "");
              const dGrp = new THREE.Group();
              dGrp.userData = { componentId: `${baseDrwId}_xray_groove` };
              dGrp.raycast = () => {};
              [
                { w: 6, d: Math.max(40, dd), x: dx + 3, z: dz + dd * 0.5 },
                { w: 6, d: Math.max(40, dd), x: dx + dw - 3, z: dz + dd * 0.5 },
                { w: Math.max(40, dw), d: 6, x: dx + dw * 0.5, z: dz + 3 },
                { w: Math.max(40, dw), d: 6, x: dx + dw * 0.5, z: dz + dd - 3 },
              ].forEach((seg) => {
                const dg = new THREE.Mesh(SHARED_SUBDIV_GRAB_BOX_GEO, xrayGrooveMat);
                dg.scale.set(seg.w, 6.5, seg.d);
                dg.position.set(seg.x, dy, seg.z);
                dg.raycast = () => {};
                dg.renderOrder = 24;
                dGrp.add(dg);
              });
              modContainer.add(dGrp);
            }
          });

          (["d5", "d8", "d15", "d35", "cable"] as const).forEach((bk) => {
            const list = buckets[bk];
            if (!list.length) return;
            const inst = new THREE.InstancedMesh(xrayHoleUnitCylinder, matLookup[bk], list.length);
            inst.raycast = () => {};
            inst.renderOrder = 25;
            list.forEach((mtx, idx) => inst.setMatrixAt(idx, mtx));
            inst.instanceMatrix.needsUpdate = true;
            modContainer.add(inst);
          });
        }
        meshGroup.add(modContainer);
      });

      // Render 3D Spatial Engineering Error, Module-to-Module Collision & Warning Beacons inside `engineeringBeaconGroupRef`
      const beaconHolder = engineeringBeaconGroupRef.current;
      if (beaconHolder) {
        disposeObject3DTree(beaconHolder);
        beaconHolder.clear();

        type SpatialBeaconEntry = {
          code: string;
          severity: "error" | "warning" | "info";
          title: string;
          message: string;
          suggestions: string[];
          remediationProposals: import("@birim/core").RemediationProposal[];
          moduleIndex: number;
          bayIndex: number;
          wp: { x: number; y: number; z: number };
          overlapBox?: { cx: number; cy: number; cz: number; w: number; h: number; d: number };
        };
        const beaconEntries: SpatialBeaconEntry[] = [];
        const seenBeacons = new Set<string>();

        // A. Direct real-time 3D AABB module-to-module intersection detector (red marker + red volume at EXACT intersection!)
        const mods = project.modules || [];
        for (let i = 0; i < mods.length; i++) {
          const mA = mods[i];
          if (!mA || mA.category === "complementary") continue;
          const fpA = getModuleOrientedFootprint(mA, 0);
          const aMinX = fpA.x;
          const aMaxX = fpA.x + fpA.planWidth;
          const aMinZ = fpA.z;
          const aMaxZ = fpA.z + fpA.planDepth;
          const aMinY = mA.position.y || 0;
          const aMaxY = aMinY + mA.dimensions.height;
          for (let j = i + 1; j < mods.length; j++) {
            const mB = mods[j];
            if (!mB || mB.category === "complementary") continue;
            const fpB = getModuleOrientedFootprint(mB, 0);
            const ox = Math.min(aMaxX, fpB.x + fpB.planWidth) - Math.max(aMinX, fpB.x);
            const oz = Math.min(aMaxZ, fpB.z + fpB.planDepth) - Math.max(aMinZ, fpB.z);
            const bMinY = mB.position.y || 0;
            const oy = Math.min(aMaxY, bMinY + mB.dimensions.height) - Math.max(aMinY, bMinY);
            if (ox > 8 && oz > 8 && oy > 8) {
              const cx = (Math.max(aMinX, fpB.x) + Math.min(aMaxX, fpB.x + fpB.planWidth)) * 0.5;
              const cy = (Math.max(aMinY, bMinY) + Math.min(aMaxY, bMinY + mB.dimensions.height)) * 0.5;
              const cz = (Math.max(aMinZ, fpB.z) + Math.min(aMaxZ, fpB.z + fpB.planDepth)) * 0.5;
              const k = `overlap_${i}_${j}`;
              seenBeacons.add(k);
              beaconEntries.push({
                code: "MODULE_COLLISION",
                severity: "error",
                title: "Modül Kesişimi / Çakışma",
                message: `"${mA.name}" ile "${mB.name}" ${Math.round(ox)}×${Math.round(oz)} mm kesişiyor.`,
                suggestions: ["Modüllerden birini sürükleyerek ayırın veya genişliğini daraltın."],
                remediationProposals: [],
                moduleIndex: j,
                bayIndex: 0,
                wp: { x: cx, y: cy, z: Math.max(aMaxZ, fpB.z + fpB.planDepth) + 18 },
                overlapBox: { cx, cy, cz, w: ox, h: oy, d: oz },
              });
            }
          }
        }

        // A2. Architectural Column / Beam 3D Red Highlight Volume when module intersects an un-notched structural obstacle
        (spaceObstacles || []).forEach((obs) => {
          if (obs.type !== "column" && obs.type !== "beam" && obs.type !== "protrusion" && obs.type !== "partition") {
            return;
          }
          const rotNorm = (((obs.rotationY || 0) % 360) + 360) % 360;
          const isRot90 = rotNorm === 90 || rotNorm === 270;
          const effW = isRot90 ? obs.dimensions.depth || obs.dimensions.width : obs.dimensions.width;
          const effD = isRot90 ? obs.dimensions.width : obs.dimensions.depth || obs.dimensions.width;
          const ox1 = obs.position.x;
          const ox2 = ox1 + effW;
          const oy1 = obs.position.y;
          const oy2 = oy1 + obs.dimensions.height;
          const oz1 = obs.position.z;
          const oz2 = oz1 + effD;

          for (let mi = 0; mi < mods.length; mi++) {
            const m = mods[mi];
            if (!m || m.category === "complementary") continue;
            const alreadyNotched = (m.utilityCutouts || []).some(
              (co) => co.id === `auto_notch_${m.id}_${obs.id}`
            );
            if (alreadyNotched) continue;
            const fp = getModuleOrientedFootprint(m, 0);
            const xHit = fp.x < ox2 - 2 && fp.x + fp.planWidth > ox1 + 2;
            const zHit = fp.z < oz2 - 2 && fp.z + fp.planDepth > oz1 + 2;
            const yHit = fp.yBottom < oy2 - 2 && fp.yTop > oy1 + 2;
            if (xHit && zHit && yHit) {
              const colKey = `obs_col_${obs.id}_${mi}`;
              seenBeacons.add(colKey);
              beaconEntries.push({
                code: "ERR_COLUMN_COLLISION",
                severity: "error",
                title: "Kolon Çakışması",
                message: `"${m.name}" modülü "${obs.name}" ile çakışıyor.`,
                suggestions: ["'Çentiğe Uyarla (CNC)' veya 'Kolon Önünde Dur' ile çözün."],
                remediationProposals: [],
                moduleIndex: mi,
                bayIndex: 0,
                wp: {
                  x: (ox1 + ox2) * 0.5,
                  y: Math.min(fp.yTop - 160, Math.max(fp.yBottom + 320, (oy1 + Math.min(fp.yTop, oy2)) * 0.65)),
                  z: Math.max(oz2, fp.z + fp.planDepth) + 28,
                },
                overlapBox: {
                  cx: (ox1 + ox2) * 0.5,
                  cy: (oy1 + oy2) * 0.5,
                  cz: (oz1 + oz2) * 0.5,
                  w: effW + 8,
                  h: obs.dimensions.height + 8,
                  d: effD + 8,
                },
              });
              break;
            }
          }
        });

        // B. Unified Engineering Report findings (with exact worldPositionMm OR resolved from targetModuleId!)
        const engFindings = (live3DEngineeringReport?.findings || []).filter(
          (f) => f.severity === "error" || f.ruleNature === "VERIFICATION_REQUIRED" || f.severity === "warning"
        );
        engFindings.forEach((ef) => {
          const modIdxFound = project.modules.findIndex((m) => m.id === ef.targetModuleId);
          const safeModIdx = modIdxFound >= 0 ? modIdxFound : 0;
          const hostMod = project.modules[safeModIdx];
          let wp = ef.worldPositionMm;
          if (!wp && hostMod) {
            const fp = getModuleOrientedFootprint(hostMod, 0);
            wp = {
              x: fp.x + fp.planWidth * 0.5,
              y: (hostMod.position.y || 0) + hostMod.dimensions.height * 0.62,
              z: fp.z + fp.planDepth + 24,
            };
          }
          if (!wp) return;
          const key = `${ef.code}_${safeModIdx}_${Math.round(wp.x / 40)}_${Math.round(wp.y / 40)}`;
          if (seenBeacons.has(key)) return;
          seenBeacons.add(key);
          const bayMatch = String(ef.targetId || "").match(/bay_(\d+)/);
          beaconEntries.push({
            code: ef.code,
            severity: ef.severity === "error" ? "error" : "warning",
            title: formatEngineeringErrorCode(ef.code),
            message: ef.message,
            suggestions: ef.suggestions || [],
            remediationProposals: ef.remediationProposals || [],
            moduleIndex: safeModIdx,
            bayIndex: bayMatch ? Number(bayMatch[1]) : 0,
            wp,
          });
        });

        // C. Store validationIssues fallback (e.g., wall overflow, obstacle clash)
        const storeIssues = useConfiguratorStore.getState().validationIssues || [];
        storeIssues.forEach((vi) => {
          const viCompat = vi as typeof vi & { moduleId?: string; targetId?: string; suggestion?: string };
          const matchModId = viCompat.moduleId || viCompat.targetId;
          const modIdxFound = project.modules.findIndex((m) => m.id === matchModId);
          const safeModIdx = modIdxFound >= 0 ? modIdxFound : activeModuleIndex;
          const hostMod = project.modules[safeModIdx] || project.modules[0];
          if (!hostMod) return;
          const key = `vi_${vi.code}_${safeModIdx}`;
          if (seenBeacons.has(key)) return;
          seenBeacons.add(key);
          const fp = getModuleOrientedFootprint(hostMod, 0);
          beaconEntries.push({
            code: vi.code || "VALIDATION_ERROR",
            severity: vi.severity === "error" ? "error" : "warning",
            title: formatEngineeringErrorCode(vi.code || "VALIDATION_ERROR"),
            message: vi.message,
            suggestions: viCompat.suggestion ? [viCompat.suggestion] : [],
            remediationProposals: [],
            moduleIndex: safeModIdx,
            bayIndex: 0,
            wp: {
              x: fp.x + fp.planWidth * 0.5,
              y: (hostMod.position.y || 0) + hostMod.dimensions.height * 0.78,
              z: fp.z + fp.planDepth + 28,
            },
          });
        });

        if (beaconEntries.length > 0) {
          const errBeaconGeo = new THREE.SphereGeometry(34, 20, 20);
          const errRingGeo = new THREE.RingGeometry(44, 62, 32);
          beaconEntries.slice(0, 18).forEach((ef, efIdx) => {
            const wp = ef.wp;
            const isHardErr = ef.severity === "error";
            const colHex = isHardErr ? 0xef4444 : 0xf59e0b;

            if (ef.overlapBox) {
              const ob = ef.overlapBox;
              const boxGeo = new THREE.BoxGeometry(ob.w + 6, ob.h + 6, ob.d + 6);
              const boxMesh = new THREE.Mesh(
                boxGeo,
                new THREE.MeshBasicMaterial({
                  color: 0xef4444,
                  transparent: true,
                  opacity: 0.28,
                  depthTest: false,
                })
              );
              boxMesh.position.set(ob.cx, ob.cy, ob.cz);
              boxMesh.renderOrder = 995;
              boxMesh.raycast = () => {};
              beaconHolder.add(boxMesh);

              const boxEdge = new THREE.LineSegments(
                new THREE.EdgesGeometry(boxGeo),
                new THREE.LineBasicMaterial({
                  color: 0xff3b30,
                  transparent: true,
                  opacity: 0.96,
                  depthTest: false,
                })
              );
              boxEdge.position.set(ob.cx, ob.cy, ob.cz);
              boxEdge.renderOrder = 996;
              boxEdge.raycast = () => {};
              beaconHolder.add(boxEdge);
            }

            const beaconMat = new THREE.MeshBasicMaterial({
              color: colHex,
              transparent: true,
              opacity: 0.96,
              depthTest: false,
            });
            const beaconMesh = new THREE.Mesh(
              efIdx === 0 ? errBeaconGeo : errBeaconGeo.clone(),
              beaconMat
            );
            beaconMesh.position.set(wp.x, wp.y, wp.z + 24);
            beaconMesh.renderOrder = 999;
            beaconMesh.userData = {
              isEngineeringBeacon: true,
              findingCode: ef.code,
              findingSeverity: ef.severity,
              findingTitle: ef.title,
              findingMessage: ef.message,
              findingSuggestions: ef.suggestions,
              remediationProposals: ef.remediationProposals,
              moduleIndex: ef.moduleIndex,
              bayIndex: ef.bayIndex,
            };
            beaconHolder.add(beaconMesh);

            const ringMat = new THREE.MeshBasicMaterial({
              color: colHex,
              side: THREE.DoubleSide,
              transparent: true,
              opacity: 0.72,
              depthTest: false,
            });
            const ringMesh = new THREE.Mesh(
              efIdx === 0 ? errRingGeo : errRingGeo.clone(),
              ringMat
            );
            ringMesh.position.set(wp.x, wp.y, wp.z + 25);
            ringMesh.renderOrder = 998;
            ringMesh.raycast = () => {};
            beaconHolder.add(ringMesh);

            // V48: Interior clash visual 3D red danger highlight zone so intersecting shelves/dividers/racks stand out immediately
            if (
              ef.code === "ERR_SUBDIVIDER_INTERIOR_CLASH" ||
              ef.code === "ERR_SHELF_INTERIOR_CLASH" ||
              ef.code === "ERR_INTERNAL_COMPONENTS_OVERLAP"
            ) {
              const clashBoxGeo = new THREE.BoxGeometry(240, 110, 220);
              const clashBoxMat = new THREE.MeshBasicMaterial({
                color: 0xef4444,
                transparent: true,
                opacity: 0.22,
                depthTest: false,
                depthWrite: false,
              });
              const clashBox = new THREE.Mesh(clashBoxGeo, clashBoxMat);
              clashBox.position.set(wp.x, wp.y, wp.z);
              clashBox.renderOrder = 996;
              clashBox.raycast = () => {};
              clashBox.add(
                new THREE.LineSegments(
                  new THREE.EdgesGeometry(clashBoxGeo),
                  new THREE.LineBasicMaterial({
                    color: 0xf87171,
                    transparent: true,
                    opacity: 0.9,
                    depthTest: false,
                  })
                )
              );
              beaconHolder.add(clashBox);
            }
          });
        }
      }
      reusableGroupsBySig.forEach((leftovers) => {
        leftovers.forEach((unusedGroup) => disposeObject3DTree(unusedGroup));
      });

      if (
        rendererRef.current &&
        typeof window !== "undefined" &&
        window.location.search.includes("audit")
      ) {
        publishSceneDiagnostics(rendererRef.current.domElement, meshGroup);
      }
  return true;
}
