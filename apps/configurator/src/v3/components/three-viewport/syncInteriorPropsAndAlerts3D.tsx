"use client";

import React from "react";
import * as THREE from "three";
import { generateModuleGeometry, DEFAULT_MATERIALS } from "../../adapter/useV3Adapter";
import { calculateModulePlacement } from "@birim/core";
import { disposeObject3DTree } from "../../materials/webglResourceGuard";
import { createSculptedHangingShirtGroup, createFoldedKnitwearStackGroup, createLiddedStorageBoxGroup, createSculptedShoePairGroup } from "../../materials/wardrobePropsBuilder";
import { freezeStaticObject3DSubtree } from "../../materials/wardrobeGlbAssetLoader";
import { Viewport3DContextMenu } from "../Viewport3DContextMenu";
import { useConfiguratorStore } from "../../../store/useConfiguratorStore";
import { type PaintTool3DState } from "../../../v11/quickMaterialAndMoodboardEngine";
import { computeHeroStudioFraming } from "./viewport3DSharedAssets";
import { computeFastParametricSceneBounds, formatEngineeringErrorCode } from "./viewport3DSceneHelpers";

import type {
  SyncInteriorWardrobeProps3DCtx,
  Viewport3DBottomAlertsAndContextMenuProps,
  Viewport3DBottomCenterHudStackProps,
  Viewport3DBeaconPopoverBodyProps,
} from "./viewport3DTypes";

export function syncInteriorWardrobeProps3D(ctx: SyncInteriorWardrobeProps3DCtx) {
  const { activeModuleIndex, cutawayActiveBay, doorOpenAngleDeg, effectiveDoorsHiddenIn3D, glbCatalogRev, isStoreBatchDragging, isXrayActive, lifestylePropsCacheRef, project, propsRoot, renderEdgeMode, requestRender, showInteriorProps3D } = ctx;
      // Instant 0.01ms GPU visibility toggle without disposing or rebuilding any prop geometry!
      if (!showInteriorProps3D || renderEdgeMode === "cad" || isXrayActive) {
        if (propsRoot.visible) {
          propsRoot.visible = false;
          requestRender();
        }
        return;
      }

      // Skip expensive geometry rebuilds during active batch drags, BUT always sync live module transforms so open-wardrobe belongings move 1:1!
      if (isStoreBatchDragging) {
        let movedDuringBatch = false;
        for (const holder of propsRoot.children) {
          const mId = holder.userData?.moduleId;
          const mIdx = holder.userData?.moduleIndex;
          const mod =
            (typeof mId === "string" ? project.modules.find((m) => m.id === mId) : undefined) ||
            (typeof mIdx === "number" ? project.modules[mIdx] : undefined);
          if (!mod) continue;
          const pl = calculateModulePlacement(mod);
          if (
            Math.abs(holder.position.x - pl.origin.x) > 0.05 ||
            Math.abs(holder.position.y - pl.origin.y) > 0.05 ||
            Math.abs(holder.position.z - pl.origin.z) > 0.05 ||
            Math.abs(holder.rotation.y - pl.rotationYRad) > 0.0005
          ) {
            holder.position.set(pl.origin.x, pl.origin.y, pl.origin.z);
            holder.rotation.y = pl.rotationYRad;
            holder.updateMatrix();
            holder.updateMatrixWorld(true);
            movedDuringBatch = true;
          }
        }
        if (movedDuringBatch) {
          requestRender();
        }
        return;
      }

      propsRoot.visible = true;
      const isMultiModuleScene = project.modules.length > 2;
      const maxGarmentsPerRail = isMultiModuleScene ? 2 : 3;

      const nextHolders: THREE.Group[] = [];

      project.modules.forEach((mod, modIdx) => {
        if (mod.category === "complementary" || mod.bays.length < 1) return;
        const subLower = String(mod.moduleSubType || "").toLowerCase();
        const nameLower = String(mod.name || "").toLowerCase();
        const skipWardrobeProps =
          mod.category === "kitchen_base" ||
          mod.category === "kitchen_wall" ||
          mod.category === "kitchen_tall" ||
          mod.category === "kitchen_corner" ||
          mod.category === "kitchen_island" ||
          subLower.includes("tv") ||
          subLower.includes("vitrine") ||
          subLower.includes("bookcase") ||
          subLower.includes("media") ||
          subLower.includes("bar") ||
          subLower.includes("coffee") ||
          subLower.includes("bath") ||
          subLower.includes("laundry") ||
          ((nameLower.includes("tv") ||
            nameLower.includes("vitrin") ||
            nameLower.includes("kitaplık") ||
            nameLower.includes("medya") ||
            nameLower.includes("konsol") ||
            nameLower.includes("banyo") ||
            nameLower.includes("kahve")) &&
            !nameLower.includes("gardırop") &&
            !nameLower.includes("vestiyer") &&
            !nameLower.includes("portmanto"));
        if (skipWardrobeProps) return;

        const isModPropsVisible =
          effectiveDoorsHiddenIn3D ||
          (cutawayActiveBay && modIdx === activeModuleIndex) ||
          doorOpenAngleDeg > 8 ||
          Boolean(mod.isOpenFront) ||
          mod.bays.some(
            (b) =>
              b.door.type === "open" ||
              b.door.doorSystemId === "open" ||
              Boolean(b.door.isGlassFramed) ||
              b.door.crossSectionProfile === "glass_frame" ||
              b.door.crossSectionProfile === "center_glass_frame" ||
              b.door.crossSectionProfile === "u_glass_open_top" ||
              String(b.door.doorMaterialId || "").includes("glass")
          );

        if (!isModPropsVisible) return;

        // Compact, deterministic string signature (avoids expensive JSON.stringify on full bay objects!)
        const T = mod.carcass.panelThickness || 18;
        const plinthH = mod.carcass.plinthHeight ?? 100;
        const rsSig = mod.carcass.roofSlope
          ? `${mod.carcass.roofSlope.side}:${mod.carcass.roofSlope.kneeWallHeightMm}:${mod.carcass.roofSlope.slopeRunMm}`
          : "";
        const rs2Sig = mod.carcass.secondaryRoofSlope
          ? `${mod.carcass.secondaryRoofSlope.side}:${mod.carcass.secondaryRoofSlope.kneeWallHeightMm}:${mod.carcass.secondaryRoofSlope.slopeRunMm}`
          : "";
        const scSig = mod.carcass.slopedCeiling
          ? `${mod.carcass.slopedCeiling.mode}:${mod.carcass.slopedCeiling.kneeHeightMm}:${mod.carcass.slopedCeiling.slopeAngleDeg}`
          : "";
        let interiorPropsSig = `${mod.id}|${mod.dimensions.width}x${mod.dimensions.height}x${mod.dimensions.depth}|${mod.moduleSubType || ""}|${T}:${plinthH}:G${maxGarmentsPerRail}:R${glbCatalogRev}|RS[${rsSig}|${rs2Sig}|${scSig}]`;
        for (let b = 0; b < mod.bays.length; b++) {
          const bay = mod.bays[b];
          const sPart = (bay.shelves || []).map((sh) => `${sh.elevationY}:${sh.isHidden ? 1 : 0}`).join(",");
          const rPart = (bay.hangingRails || []).map((hr) => `${hr.elevationY}:${hr.isHidden ? 1 : 0}`).join(",");
          const dPart = (bay.drawers || []).map((dr) => `${dr.elevationY}:${dr.height}`).join(",");
          const fPart = (bay.specialFittings || [])
            .filter((sf) => sf.type === "shoe_rack" && !sf.isHidden)
            .map((sf) => `${sf.elevationY}`)
            .join(",");
          interiorPropsSig += `|B${b}(${bay.customWidth ?? ""}:${bay.widthRatio ?? ""}:${bay.door?.slidingMountingType || bay.door?.doorSystemId || ""}|S[${sPart}]|R[${rPart}]|D[${dPart}]|F[${fPart}])`;
        }

        let modPropsHolder = lifestylePropsCacheRef.current.get(interiorPropsSig);
        if (!modPropsHolder) {
          modPropsHolder = new THREE.Group();
          modPropsHolder.name = `v3_cached_lifestyle_props_${mod.id}`;
          modPropsHolder.userData = { isSharedCachedProps: true };
          modPropsHolder.raycast = () => {};

          const breakdown = generateModuleGeometry(mod, {
            doorOpenAngleDeg: 0,
            drawerOpenMm: 0,
            explodedFactor: 0,
          });
          const innerH =
            breakdown.netInnerHeight || Math.max(300, mod.dimensions.height - plinthH - 2 * T);
          const modD = mod.dimensions.depth;
          let bayStartX = T;

          const hasInsetSliding = mod.bays.some(
            (b) =>
              b.door?.slidingMountingType === "inset_inside" ||
              b.door?.doorSystemId === "sliding_bottom_rolling"
          );
          const isCornerSubType =
            Boolean(mod.isCorner) ||
            mod.moduleSubType === "l_corner" ||
            mod.moduleSubType === "corner_wardrobe" ||
            mod.moduleSubType === "blind_corner";

          mod.bays.forEach((bayObj, bIdx) => {
            const bw =
              breakdown.bayWidths[bIdx] ||
              Math.round((mod.dimensions.width - (mod.bays.length + 1) * T) / mod.bays.length);
            const propsGroup = new THREE.Group();
            propsGroup.name = `v3_lifestyle_props_bay_${bIdx}`;
            propsGroup.raycast = () => {};

            const bayRailComps = breakdown.components.filter(
              (c) =>
                c.role === "hanging_rail" &&
                c.bayIndex === bIdx &&
                c.dimensions.width >= c.dimensions.depth
            );
            const effectiveModD = isCornerSubType ? Math.min(modD, 600) : modD;
            const frontSafeZ = hasInsetSliding ? effectiveModD - 66 : effectiveModD - 22;
            const backSafeZ = T + 14;
            const centerZ = (backSafeZ + frontSafeZ) * 0.5;

            const sortedShelves = [...(bayObj.shelves || [])]
              .filter((sh) => !sh.isHidden)
              .sort((a, b) => a.elevationY - b.elevationY);
            const sortedRails = [...(bayObj.hangingRails || [])]
              .filter((hr) => !hr.isHidden)
              .sort((a, b) => (a.elevationY || 0) - (b.elevationY || 0));

            sortedRails.forEach((rail, rIdx) => {
              const rawRailElev = rail.elevationY || 1650;
              const clampedRailElev = Math.max(
                48,
                Math.min(Math.max(80, innerH - 36), rawRailElev)
              );
              const matchedRailComp =
                bayRailComps.find((rc) => rc.id === rail.id) || bayRailComps[rIdx];

              const railStartX = matchedRailComp ? matchedRailComp.position.x : bayStartX;
              const railSpanW = matchedRailComp ? matchedRailComp.dimensions.width : bw;
              const railCenterY = matchedRailComp
                ? matchedRailComp.position.y + matchedRailComp.dimensions.height * 0.5
                : plinthH + T + clampedRailElev + 12.5;
              const railCenterZ = matchedRailComp
                ? matchedRailComp.position.z + matchedRailComp.dimensions.depth * 0.5
                : effectiveModD * 0.5 + 0.5;

              const obstaclesBelow = [
                0,
                ...sortedShelves
                  .filter((sh) => sh.elevationY < clampedRailElev - 140)
                  .map((sh) => {
                    const gapAboveShelf = clampedRailElev - (sh.elevationY + T);
                    const hasBoxUnderRail = gapAboveShelf > 720 && bw >= 420;
                    return sh.elevationY + T + (hasBoxUnderRail ? 152 : 0);
                  }),
                ...sortedRails
                  .filter((r) => (r.elevationY || 0) < clampedRailElev - 220)
                  .map((r) => (r.elevationY || 0) + 34),
                ...(bayObj.drawers || [])
                  .filter((d) => (d.elevationY || 0) < clampedRailElev - 100)
                  .map((d) => (d.elevationY || 0) + d.height + 18),
              ];
              const floorObstacleY = Math.max(...obstaclesBelow);
              const clearDropMm = clampedRailElev + 12.5 - floorObstacleY - 22;
              if (clearDropMm < 330 || railSpanW < 210 || effectiveModD < 340) return;

              const safeClearDepthZ = Math.max(
                180,
                2 * Math.min(railCenterZ - backSafeZ, frontSafeZ - railCenterZ)
              );

              const sidePadX = 82;
              const innerSpanX = railSpanW - sidePadX * 2;
              const minStepX = 225;
              const garmentCount =
                innerSpanX < 20
                  ? 1
                  : Math.max(1, Math.min(maxGarmentsPerRail, 1 + Math.floor(innerSpanX / minStepX)));

              for (let g = 0; g < garmentCount; g++) {
                const gx =
                  garmentCount === 1
                    ? railStartX + railSpanW * 0.5
                    : railStartX +
                      sidePadX +
                      ((g + 0.5) / garmentCount) * Math.max(0, railSpanW - sidePadX * 2 + 28) -
                      14;
                const clearLeft = gx - (railStartX + 12);
                const clearRight = railStartX + railSpanW - 12 - gx;
                const neighborSlot =
                  garmentCount === 1
                    ? Math.min(clearLeft, clearRight) * 2
                    : (railSpanW - sidePadX * 2 + 28) / garmentCount - 16;
                const maxSlotWidthMm = Math.max(
                  88,
                  Math.min(neighborSlot, clearLeft * 2, clearRight * 2)
                );

                const desiredH = 835 + ((g + rIdx) % 3) * 26;
                const garmentH = Math.min(desiredH, clearDropMm);
                const shirtGrp = createSculptedHangingShirtGroup(
                  g + bIdx * 2 + rIdx,
                  garmentH,
                  safeClearDepthZ,
                  maxSlotWidthMm
                );
                shirtGrp.position.set(gx, railCenterY, railCenterZ);
                shirtGrp.userData = {
                  ...shirtGrp.userData,
                  propOwnerKind: "rail",
                  propBayIndex: bIdx,
                  propOwnerId: rail.id,
                  propOwnerIdx: rIdx,
                };
                propsGroup.add(shirtGrp);
              }
            });

            // Evaluate exact sloped ceiling underside (world Y) over a prop footprint [x0..x1] x [z0..modD]
            const evalSlopedUndersideWorldY = (x0: number, x1: number, z0: number): number => {
              const modW = mod.dimensions.width;
              const modH = mod.dimensions.height;
              let minY = plinthH + T + innerH;
              const applySlope = (sSide: "left" | "right" | "rear", sKnee: number, sRun: number) => {
                const rise = Math.max(1, modH - sKnee);
                const rad = Math.atan2(rise, Math.max(1, sRun));
                const vertT = T / Math.max(0.4, Math.cos(rad));
                if (sSide === "left") {
                  const cx = Math.max(0, Math.min(modW, x0));
                  const yAt = cx >= sRun ? modH - T : sKnee + (cx / sRun) * rise - vertT;
                  if (yAt < minY) minY = yAt;
                } else if (sSide === "right") {
                  const dR = Math.max(0, modW - Math.max(0, Math.min(modW, x1)));
                  const yAt = dR >= sRun ? modH - T : sKnee + (dR / sRun) * rise - vertT;
                  if (yAt < minY) minY = yAt;
                } else {
                  const cz = Math.max(0, Math.min(modD, z0));
                  const yAt = cz >= sRun ? modH - T : sKnee + (cz / sRun) * rise - vertT;
                  if (yAt < minY) minY = yAt;
                }
              };
              const rsProp = mod.carcass.roofSlope;
              const scProp = mod.carcass.slopedCeiling;
              if (rsProp && rsProp.side && rsProp.side !== "none") {
                const maxSpan = rsProp.side === "rear" ? modD : modW;
                applySlope(
                  rsProp.side,
                  Math.max(400, Math.min(modH - 120, rsProp.kneeWallHeightMm)),
                  Math.max(150, Math.min(maxSpan, rsProp.slopeRunMm))
                );
              } else if (scProp && scProp.mode && scProp.mode !== "none") {
                const fSide: "left" | "right" | "rear" =
                  scProp.mode === "left_slope"
                    ? "left"
                    : scProp.mode === "right_slope"
                    ? "right"
                    : "rear";
                const fKnee = Math.max(400, Math.min(modH - 120, scProp.kneeHeightMm));
                const maxSpan = fSide === "rear" ? modD : modW;
                const fRun = Math.max(
                  150,
                  Math.min(
                    maxSpan,
                    Math.round((modH - fKnee) / Math.max(0.15, Math.tan(((scProp.slopeAngleDeg || 35) * Math.PI) / 180)))
                  )
                );
                applySlope(fSide, fKnee, fRun);
              }
              const rs2Prop = mod.carcass.secondaryRoofSlope;
              if (rs2Prop && rs2Prop.side && rs2Prop.side !== "none") {
                const maxSpan = rs2Prop.side === "rear" ? modD : modW;
                applySlope(
                  rs2Prop.side,
                  Math.max(400, Math.min(modH - 20, rs2Prop.kneeWallHeightMm)),
                  Math.max(150, Math.min(maxSpan, rs2Prop.slopeRunMm))
                );
              }
              return minY;
            };

            sortedShelves.forEach((sh, sIdx) => {
              const shelfTopLocalY = sh.elevationY + (sh.thickness || T);
              const shelfTopWorldY = plinthH + T + shelfTopLocalY;
              const nextShelf = sortedShelves[sIdx + 1];
              const propHalfW = Math.min(165, bw * 0.34);
              const propHalfD = Math.min(165, (modD - 105) * 0.5);
              const slopedCeilWorldY = nextShelf
                ? plinthH + T + nextShelf.elevationY
                : evalSlopedUndersideWorldY(
                    bayStartX + bw * 0.5 - propHalfW,
                    bayStartX + bw * 0.5 + propHalfW,
                    Math.max(T, centerZ - propHalfD)
                  );
              const ceilingLocalY = Math.max(0, slopedCeilWorldY - (plinthH + T));
              const clearHeadroom = ceilingLocalY - shelfTopLocalY;
              const railInsideSpace = sortedRails.some(
                (r) =>
                  (r.elevationY || 0) > shelfTopLocalY + 60 &&
                  (r.elevationY || 0) < ceilingLocalY - 40 &&
                  clearHeadroom > 520
              );
              if (bw < 310 || modD < 300 || clearHeadroom < 135) return;

              const isTopmostLuggageShelf = !nextShelf && sh.elevationY > innerH * 0.68;

              const tagShelfProp = (grp: THREE.Object3D) => {
                grp.userData = {
                  ...grp.userData,
                  propOwnerKind: "shelf",
                  propBayIndex: bIdx,
                  propOwnerId: sh.id,
                  propOwnerIdx: sIdx,
                };
                propsGroup.add(grp);
              };
              if (isTopmostLuggageShelf) {
                const boxH = Math.min(155, clearHeadroom - 28);
                const boxD = Math.min(330, modD - 105);
                if (bw >= 680 && !isMultiModuleScene) {
                  const boxW = Math.min(300, bw * 0.41);
                  [-0.24, 0.24].forEach((frac) => {
                    const bGrp = createLiddedStorageBoxGroup(boxW, boxH, boxD);
                    bGrp.position.set(bayStartX + bw * (0.5 + frac), shelfTopWorldY, centerZ);
                    tagShelfProp(bGrp);
                  });
                } else {
                  const boxW = Math.min(330, bw * 0.64);
                  const bGrp = createLiddedStorageBoxGroup(boxW, boxH, boxD);
                  bGrp.position.set(bayStartX + bw * 0.5, shelfTopWorldY, centerZ);
                  tagShelfProp(bGrp);
                }
              } else if (!railInsideSpace) {
                if (sIdx % 2 === 0) {
                  const layers = clearHeadroom >= 210 ? 3 : 2;
                  const stackW = Math.min(345, bw >= 640 ? bw * 0.44 : bw * 0.68);
                  const stackD = Math.min(350, modD - 95);
                  const knitGrp = createFoldedKnitwearStackGroup(
                    stackW,
                    stackD,
                    layers,
                    bIdx + sIdx
                  );
                  knitGrp.position.set(
                    bw >= 640 && !isMultiModuleScene ? bayStartX + bw * 0.29 : bayStartX + bw * 0.5,
                    shelfTopWorldY,
                    centerZ
                  );
                  tagShelfProp(knitGrp);

                  if (bw >= 640 && clearHeadroom >= 165 && !isMultiModuleScene) {
                    const boxW = Math.min(270, bw * 0.39);
                    const boxH = Math.min(148, clearHeadroom - 24);
                    const boxD = Math.min(320, modD - 105);
                    const bGrp = createLiddedStorageBoxGroup(boxW, boxH, boxD);
                    bGrp.position.set(bayStartX + bw * 0.73, shelfTopWorldY, centerZ);
                    tagShelfProp(bGrp);
                  }
                } else {
                  const boxW = Math.min(330, bw * 0.64);
                  const boxH = Math.min(150, clearHeadroom - 26);
                  const boxD = Math.min(325, modD - 105);
                  const bGrp = createLiddedStorageBoxGroup(boxW, boxH, boxD);
                  bGrp.position.set(bayStartX + bw * 0.5, shelfTopWorldY, centerZ);
                  tagShelfProp(bGrp);
                }
              } else if (clearHeadroom > 720 && bw >= 420) {
                const boxW = Math.min(300, bw * 0.56);
                const boxH = 138;
                const boxD = Math.min(315, modD - 115);
                const bGrp = createLiddedStorageBoxGroup(boxW, boxH, boxD);
                bGrp.position.set(bayStartX + bw * 0.48, shelfTopWorldY, centerZ);
                tagShelfProp(bGrp);
              }
            });

            const shoeRacks = (bayObj.specialFittings || []).filter(
              (f) => f.type === "shoe_rack" && !f.isHidden
            );
            const rackDepthMm = Math.max(120, modD - 54);
            const rackCenterZ = 24 + rackDepthMm * 0.5;
            const maxShoeDepthMm = Math.min(
              Math.max(200, frontSafeZ - backSafeZ - 24),
              Math.max(190, rackDepthMm * 0.72)
            );
            const rackTiltRad = 0.22; // Matches componentMesh.ts _fitting_shoe_rack inclinedGroup.rotation.x
            shoeRacks.forEach((sr, srIdx) => {
              const fitH = Math.max(65, sr.height || 85);
              // componentMesh.ts places inclinedGroup at cy + 8, support chrome bars at local y = 4 with radius 5 -> local top y = fitH/2 + 17
              // Shift shoe slightly back (-14mm along Z) so toes sit cleanly behind the raised front stop bar (+d*0.36)
              const zBackShift = -14;
              const slopeLiftY = -zBackShift * Math.sin(rackTiltRad);
              const rackWorldY = plinthH + T + (sr.elevationY || 180) + fitH * 0.5 + 17 + slopeLiftY;
              const pairCount = isMultiModuleScene ? 1 : Math.max(1, Math.min(2, Math.floor((bw - 40) / 285)));
              const stepP = (bw - 50) / pairCount;
              for (let p = 0; p < pairCount; p++) {
                const shoePair = createSculptedShoePairGroup(p + srIdx + bIdx, maxShoeDepthMm);
                shoePair.position.set(
                  bayStartX + 25 + stepP * (p + 0.5),
                  rackWorldY,
                  rackCenterZ + zBackShift
                );
                shoePair.rotation.x = rackTiltRad;
                shoePair.userData = {
                  ...shoePair.userData,
                  propOwnerKind: "special_fitting",
                  propBayIndex: bIdx,
                  propOwnerId: sr.id,
                  propOwnerIdx: srIdx,
                };
                propsGroup.add(shoePair);
              }
            });

            const hasLowDrawer = (bayObj.drawers || []).some((d) => (d.elevationY || 0) < 280);
            const hasLowShoeRack = shoeRacks.some((sr) => (sr.elevationY || 0) < 260);
            const hasLowHangingShirtsToFloor = sortedRails.some(
              (r) => (r.elevationY || 0) > 650 && (r.elevationY || 0) < 1150 && !hasLowDrawer
            );
            if (
              !hasLowDrawer &&
              !hasLowShoeRack &&
              !hasLowHangingShirtsToFloor &&
              bIdx % 2 === 0 &&
              bw >= 420 &&
              mod.dimensions.height >= 1400
            ) {
              const floorTopY = plinthH + T;
              const shoePair = createSculptedShoePairGroup(bIdx, maxShoeDepthMm);
              shoePair.position.set(bayStartX + bw * 0.5, floorTopY, centerZ + 6);
              propsGroup.add(shoePair);
            }

            modPropsHolder!.add(propsGroup);
            bayStartX += bw + T;
          });

          freezeStaticObject3DSubtree(modPropsHolder, true);

          while (lifestylePropsCacheRef.current.size >= 32) {
            const oldestKey = lifestylePropsCacheRef.current.keys().next().value;
            if (!oldestKey) break;
            const evictedGrp = lifestylePropsCacheRef.current.get(oldestKey);
            lifestylePropsCacheRef.current.delete(oldestKey);
            if (evictedGrp && !evictedGrp.parent) {
              disposeObject3DTree(evictedGrp);
            }
          }
          lifestylePropsCacheRef.current.set(interiorPropsSig, modPropsHolder);
        }

        const pl = calculateModulePlacement(mod);
        modPropsHolder.position.set(pl.origin.x, pl.origin.y, pl.origin.z);
        modPropsHolder.rotation.y = pl.rotationYRad;
        modPropsHolder.visible = true;
        modPropsHolder.userData = {
          ...modPropsHolder.userData,
          isSharedCachedProps: true,
          moduleIndex: modIdx,
          moduleId: mod.id,
        };
        modPropsHolder.updateMatrix();
        modPropsHolder.updateMatrixWorld(true);
        modPropsHolder.matrixAutoUpdate = false;
        nextHolders.push(modPropsHolder);
      });

      propsRoot.clear();
      for (let i = 0; i < nextHolders.length; i++) {
        propsRoot.add(nextHolders[i]);
      }
      requestRender();
}

export const Viewport3DBottomAlertsAndContextMenu: React.FC<Viewport3DBottomAlertsAndContextMenuProps> = (props) => {
  const { addAdjacentModule, addInteriorItemAtElevation, applyApprovedEngineeringFix, applyBayInteriorPreset, applyMaterialToSimilarComponents, applyV4Template, canRedo3D, canUndo3D, contextMenuTarget, controlsRef, doorOpenAngleDeg, doorsHiddenIn3D, drawerOpenMm, duplicateActiveModule, effectiveShowDimensions, engineeringAlertCollapsed, equalizeBaysAndShelves, flipActiveDoorDirection, handleToggleDimensions, live3DEngineeringReport, minimalChrome, moveInteriorItemToBay, paintTool3D, perspCamRef, project, redo, removeActiveModule, removeBayAt, removeSelectedInteriorComponent, removeSpaceObstacle, requestRender, restoreHoverPreviewMaterials, rotateActiveModule90, setBayDoorType, setContextMenuTarget, setDoorsHiddenIn3D, setDrawerPlacement, setEngineeringAlertCollapsed, setHangingRailElevation, setPaintTool3D, setPlinthHeight, setShelfElevation, setShelfThickness, setShowInteriorProps3D, showInCanvasHud, showInteriorProps3D, splitBayIntoTwo, stageSafeInsets, swapModuleWithNeighbor, toggleDoorOpen, toggleModuleLedLighting, undo } = props;
  return (
    <>
        {(() => {
          const allBlocking = live3DEngineeringReport?.blockingSafetyAndEngineeringErrors || [];
          const spatialBlocking = allBlocking.find(
            (e) =>
              e.code === "ERR_COLUMN_COLLISION" ||
              e.code === "ERR_WINDOW_COLLISION" ||
              e.code === "ERR_WALL_BOUNDARY_OVERFLOW"
          );
          const shouldShowAlertHud =
            allBlocking.length > 0 && (!minimalChrome || (showInCanvasHud && Boolean(spatialBlocking)));
          const activeAlertFinding = spatialBlocking || allBlocking[0];
          if (!shouldShowAlertHud || !activeAlertFinding) return null;
          return (
          <div
            data-testid="viewport-3d-engineering-alert-hud"
            style={{
              bottom: `${(stageSafeInsets?.bottomPx ?? 14) + 72}px`,
              left: `${stageSafeInsets?.leftPx ?? 16}px`,
            }}
            className="absolute z-40 max-w-sm rounded-2xl bg-slate-950/92 backdrop-blur-md border border-red-500/80 text-xs text-slate-100 shadow-xl pointer-events-auto transition-[left,bottom] duration-200"
          >
            {engineeringAlertCollapsed ? (
              <button
                type="button"
                onClick={() => setEngineeringAlertCollapsed(false)}
                className="px-3 py-1.5 flex items-center gap-2 text-[11px] font-bold text-red-300 hover:text-white cursor-pointer"
                title="Mühendislik engel detayını aç"
              >
                <span>● Engel ({allBlocking.length})</span>
                <span className="text-[10px] text-slate-400">▴ Aç</span>
              </button>
            ) : (
              <div className="p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-red-400">
                    ● 3B Sahne Mühendislik Engeli ({allBlocking.length})
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      title={`Teknik Kural: ${activeAlertFinding.code}`}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-950/80 border border-red-500/40 text-red-200 whitespace-nowrap"
                    >
                      {formatEngineeringErrorCode(activeAlertFinding.code)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setEngineeringAlertCollapsed(true)}
                      title="Uyarı panelini küçült"
                      className="w-5 h-5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] flex items-center justify-center cursor-pointer"
                    >
                      —
                    </button>
                  </div>
                </div>
                <div className="text-[11px] text-slate-200 leading-snug">
                  {activeAlertFinding.message}
                </div>
                {activeAlertFinding.remediationProposals &&
                  activeAlertFinding.remediationProposals.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {activeAlertFinding.remediationProposals.map((prop) => (
                        <button
                          key={prop.id}
                          type="button"
                          onClick={() => applyApprovedEngineeringFix(prop)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-[11px] cursor-pointer transition"
                        >
                          ✓ Onayla: {prop.label}
                        </button>
                      ))}
                    </div>
                  )}
              </div>
            )}
          </div>
          );
        })()}
        {paintTool3D.mode !== "none" && (() => {
          const safeTop = Math.max(122, (stageSafeInsets?.topPx ?? 118) + 4);
          const safeLeft = stageSafeInsets?.leftPx ?? 76;
          const safeRight = stageSafeInsets?.rightPx ?? 64;
          const allBrushMats = [...DEFAULT_MATERIALS, ...(project.customMaterials || [])];
          const curBrushDef = allBrushMats.find((m) => m.id === paintTool3D.materialId);
          return (
        <div
          data-testid="v15-active-paint-tool-hud"
          style={{
            top: `${safeTop}px`,
            left: `calc(${safeLeft}px + (100% - ${safeLeft + safeRight}px) / 2)`,
            maxWidth: `calc(100% - ${safeLeft + safeRight + 16}px)`,
          }}
          className="pointer-events-auto absolute -translate-x-1/2 z-30 py-1 px-2.5 rounded-full bg-[#1E2026]/82 text-white backdrop-blur-2xl shadow-[0_14px_36px_rgba(15,23,42,0.26)] border border-white/20 flex items-center gap-2 text-[11px] font-semibold whitespace-nowrap overflow-x-auto no-scrollbar transition-[top,left] duration-150 max-md:!left-1/2 max-md:!max-w-[calc(100vw-24px)]"
        >
          <span
            className="w-4 h-4 rounded-full border border-white/50 shrink-0 shadow-xs"
            style={{
              backgroundColor: curBrushDef?.colorHex || "#cfc6b8",
            }}
          />
          <span className="truncate max-w-[190px]">
            {paintTool3D.mode === "eyedropper"
              ? "Damlalık: Yüzeye tıklayarak rengi fırçaya alın"
              : `Fırça: ${curBrushDef?.name || "Malzeme"}`}
          </span>
          {paintTool3D.mode === "paint" && (
            <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-white/12 border border-white/15 shrink-0">
              {(
                [
                  { id: "active_scope", label: "Akıllı Yüzey" },
                  { id: "clicked_part", label: "Tek Parça" },
                  { id: "clicked_module", label: "Tüm Dolap" },
                  { id: "replace_matching_project", label: "Aynı Rengi Değiştir" },
                ] as const
              ).map((bm) => (
                <button
                  key={bm.id}
                  type="button"
                  onClick={() => {
                    const nextSt: PaintTool3DState = { ...paintTool3D, clickBehavior: bm.id };
                    setPaintTool3D(nextSt);
                    window.dispatchEvent(
                      new CustomEvent("birim:sync-paint-tool-from-3d", { detail: nextSt })
                    );
                  }}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition cursor-pointer ${
                    paintTool3D.clickBehavior === bm.id
                      ? "bg-white text-[#18181B]"
                      : "text-white/80 hover:text-white"
                  }`}
                >
                  {bm.label}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              restoreHoverPreviewMaterials();
              const cleared: PaintTool3DState = { ...paintTool3D, mode: "none" };
              setPaintTool3D(cleared);
              if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("birim:request-clear-paint-tool-3d"));
              }
            }}
            className="px-2 py-0.5 rounded-full bg-white/15 hover:bg-white/25 text-[10.5px] cursor-pointer shrink-0"
          >
            Kapat (Esc)
          </button>
        </div>
          );
        })()}
      <Viewport3DContextMenu
          target={contextMenuTarget}
          project={project}
          doorOpenAngleDeg={doorOpenAngleDeg}
          drawerOpenMm={drawerOpenMm}
          doorsHiddenIn3D={doorsHiddenIn3D}
          showDimensions={Boolean(effectiveShowDimensions)}
          showInteriorProps3D={showInteriorProps3D}
          canUndo={canUndo3D}
          canRedo={canRedo3D}
          onClose={() => setContextMenuTarget(null)}
          onToggleDoorOpen={toggleDoorOpen}
          onToggleDoorsHidden={() => setDoorsHiddenIn3D((prev) => !prev)}
          onToggleDrawerOpen={() => useConfiguratorStore.getState().toggleDrawerOpen(true)}
          onToggleDimensions={handleToggleDimensions}
          onToggleInteriorProps={() => setShowInteriorProps3D((prev) => !prev)}
          onFitScene={() => {
            const controls = controlsRef.current;
            const perspective = perspCamRef.current;
            if (!controls || !perspective) return;
            const bounds = computeFastParametricSceneBounds(project.modules);
            if (!bounds.isEmpty()) {
              const framed = computeHeroStudioFraming(
                bounds,
                perspective.fov,
                perspective.aspect,
                "hero"
              );
              controls.target.copy(framed.target);
              perspective.position.copy(framed.position);
              perspective.lookAt(framed.target);
              perspective.updateProjectionMatrix();
              controls.update();
              requestRender();
            }
          }}
          onFlipDoorDirection={flipActiveDoorDirection}
          onSetBayDoorType={(bayIdx, type) =>
            setBayDoorType(bayIdx, type as Parameters<typeof setBayDoorType>[1])
          }
          onApplyMaterialToSimilar={applyMaterialToSimilarComponents}
          onAddInteriorItemAtElevation={addInteriorItemAtElevation}
          onApplyBayInteriorPreset={applyBayInteriorPreset}
          onSetShelfElevation={setShelfElevation}
          onSetShelfThickness={setShelfThickness}
          onSetDrawerPlacement={setDrawerPlacement}
          onSetHangingRailElevation={setHangingRailElevation}
          onMoveInteriorItemToBay={moveInteriorItemToBay}
          onSplitBayIntoTwo={splitBayIntoTwo}
          onEqualizeBaysAndShelves={equalizeBaysAndShelves}
          onRemoveBayAt={removeBayAt}
          onRemoveSelectedInteriorComponent={removeSelectedInteriorComponent}
          onAddAdjacentModule={addAdjacentModule}
          onDuplicateActiveModule={duplicateActiveModule}
          onRotateActiveModule90={rotateActiveModule90}
          onSwapModuleWithNeighbor={(modIdx, dir) =>
            swapModuleWithNeighbor(modIdx, dir === 1 ? "right" : "left")
          }
          onReplaceModuleWithTemplate={(modIdx, tplId) => {
            useConfiguratorStore.getState().setActiveModuleIndex(modIdx);
            applyV4Template(tplId, false);
          }}
          onToggleModuleLedLighting={toggleModuleLedLighting}
          onSetPlinthHeight={setPlinthHeight}
          onRemoveActiveModule={removeActiveModule}
          onRemoveSpaceObstacle={removeSpaceObstacle}
          onUndo={undo}
          onRedo={redo}
        />
    </>
  );
};

export const Viewport3DBottomCenterHudStack: React.FC<Viewport3DBottomCenterHudStackProps> = (props) => {
  const { duplicateSceneObject, hoverBadgeDomRef, hoverBadgeTextRef, project, removeSceneObject, selectedSceneObjectId, setSelectedSceneObjectId, setSnapBannerDedup, snapBannerDomRef, snapBannerTextRef, stageSafeInsets, updateSceneObject } = props;
  return (
        <div
          style={{ bottom: `${(stageSafeInsets?.bottomPx ?? 14) + 56}px` }}
          className="absolute left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1.5 max-w-[calc(100%-24px)] pointer-events-none transition-[bottom] duration-200"
        >
          <div
            ref={hoverBadgeDomRef}
            data-testid="viewport-3d-hover-object-badge"
            style={{ display: "none" }}
            className="pointer-events-none px-3 py-1 rounded-lg bg-[#141413]/90 text-[#FAF9F6] border border-[#D8D3C8]/30 shadow-md text-[11px] font-medium items-center gap-2 backdrop-blur-sm whitespace-nowrap"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#D8D3C8]" />
            <span ref={hoverBadgeTextRef} />
          </div>
          <div
            ref={snapBannerDomRef}
            data-testid="viewport-3d-dragdrop-snap-banner"
            style={{ display: "none" }}
            className="pointer-events-auto max-w-full px-3.5 py-1.5 rounded-full bg-[#FAF8F4]/95 backdrop-blur-xl text-[#141413] border border-[#DFD9CE] shadow-lg font-mono text-[11px] font-bold items-center gap-2"
          >
            <span className="w-2 h-2 rounded-full bg-[#38BDF8] shrink-0" />
            <span ref={snapBannerTextRef} className="truncate" />
            <button
              type="button"
              onClick={() => setSnapBannerDedup(null)}
              className="ml-1 text-[#78716C] hover:text-[#141413] font-bold cursor-pointer shrink-0"
            >
              ✕
            </button>
          </div>
          {selectedSceneObjectId && (() => {
            const selObj = (project.sceneObjects || []).find((o) => o.id === selectedSceneObjectId);
            if (!selObj) return null;
            return (
              <div
                data-testid="v5-selected-scene-object-hud"
                className="pointer-events-auto px-3.5 py-2 rounded-2xl birim-ice-dark-bar text-white flex flex-wrap items-center justify-center gap-2 shadow-xl text-[11px]"
              >
                <span className="font-bold text-amber-300 truncate max-w-[180px]">{selObj.name}</span>
                <button
                  type="button"
                  onClick={() => updateSceneObject(selObj.id, { position: { ...selObj.position, x: Math.max(0, selObj.position.x - 50) } })}
                  className="px-2 py-1 rounded-lg bg-white/15 hover:bg-white/25 font-mono cursor-pointer"
                >
                  ◀ X-50
                </button>
                <button
                  type="button"
                  onClick={() => updateSceneObject(selObj.id, { position: { ...selObj.position, x: selObj.position.x + 50 } })}
                  className="px-2 py-1 rounded-lg bg-white/15 hover:bg-white/25 font-mono cursor-pointer"
                >
                  X+50 ▶
                </button>
                <button
                  type="button"
                  onClick={() => updateSceneObject(selObj.id, { position: { ...selObj.position, z: Math.max(0, selObj.position.z - 50) } })}
                  className="px-2 py-1 rounded-lg bg-white/15 hover:bg-white/25 font-mono cursor-pointer"
                >
                  ▲ Z-50
                </button>
                <button
                  type="button"
                  onClick={() => updateSceneObject(selObj.id, { position: { ...selObj.position, z: selObj.position.z + 50 } })}
                  className="px-2 py-1 rounded-lg bg-white/15 hover:bg-white/25 font-mono cursor-pointer"
                >
                  ▼ Z+50
                </button>
                <button
                  type="button"
                  onClick={() => updateSceneObject(selObj.id, { rotation: { ...selObj.rotation, y: ((selObj.rotation?.y || 0) + 90) % 360 } })}
                  className="px-2.5 py-1 rounded-lg bg-sky-500/30 hover:bg-sky-500/45 font-bold cursor-pointer"
                >
                  ↻ 90°
                </button>
                <button
                  type="button"
                  onClick={() => duplicateSceneObject(selObj.id)}
                  className="px-2 py-1 rounded-lg bg-white/15 hover:bg-white/25 cursor-pointer"
                >
                  Çoğalt
                </button>
                <button
                  type="button"
                  onClick={() => removeSceneObject(selObj.id)}
                  className="px-2 py-1 rounded-lg bg-rose-500/40 hover:bg-rose-500/60 font-bold cursor-pointer"
                >
                  Sil
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSceneObjectId(null)}
                  className="px-1.5 py-1 rounded-lg text-stone-300 hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              </div>
            );
          })()}
        </div>
  );
};

export const Viewport3DBeaconPopoverBody: React.FC<Viewport3DBeaconPopoverBodyProps> = (props) => {
  const { activeBayIndex, activeModuleIndex, applyApprovedEngineeringFix, project, selectedBeaconFinding, setActiveBayIndex, setActiveModuleIndex, setSelectedBeaconFinding, spatialItems } = props;
  return (
    <>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-3 h-3 rounded-full shrink-0 ${
                            selectedBeaconFinding.severity === "error"
                              ? "bg-red-600"
                              : "bg-amber-500"
                          }`}
                        />
                        <div>
                          <div className="font-bold text-[13px] leading-snug">
                            {selectedBeaconFinding.title}
                          </div>
                          <div className="text-[10.5px] text-[#78716C]">
                            Modül {selectedBeaconFinding.moduleIndex + 1} •{" "}
                            {selectedBeaconFinding.bayIndex + 1}. Bölme
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedBeaconFinding(null)}
                        className="w-7 h-7 rounded-full hover:bg-[#EFECE4] text-[#57534E] flex items-center justify-center cursor-pointer shrink-0"
                        title="Kapat"
                      >
                        ✕
                      </button>
                    </div>

                    <p className="text-[11.5px] text-[#44403C] leading-relaxed bg-white/80 rounded-2xl p-3 border border-[#EAE4D8]">
                      {selectedBeaconFinding.message}
                    </p>

                    {selectedBeaconFinding.suggestions.length > 0 && (
                      <div className="space-y-1 text-[11px] text-[#57534E] px-1">
                        {selectedBeaconFinding.suggestions.slice(0, 2).map((sg, idx) => (
                          <div key={idx} className="flex items-start gap-1.5">
                            <span className="text-[#8C7A6B] font-bold">•</span>
                            <span>{sg}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {selectedBeaconFinding.remediationProposals.slice(0, 2).map((prop) => (
                        <button
                          key={prop.id}
                          type="button"
                          onClick={() => {
                            applyApprovedEngineeringFix(prop);
                            setSelectedBeaconFinding(null);
                          }}
                          className="px-3.5 py-2 rounded-full bg-[#141413] hover:bg-[#292524] text-white font-semibold text-[11px] cursor-pointer transition"
                        >
                          ✓ Otomatik Düzelt: {prop.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveModuleIndex(selectedBeaconFinding.moduleIndex);
                          setActiveBayIndex(selectedBeaconFinding.bayIndex);
                          if (typeof window !== "undefined") {
                            window.dispatchEvent(
                              new CustomEvent("birim:select-bay-3d", {
                                detail: {
                                  moduleIndex: selectedBeaconFinding.moduleIndex,
                                  bayIndex: selectedBeaconFinding.bayIndex,
                                },
                              })
                            );
                          }
                          setSelectedBeaconFinding(null);
                        }}
                        className="px-3 py-2 rounded-full bg-[#EFECE4] hover:bg-[#E4DFD3] text-[#141413] font-semibold text-[11px] cursor-pointer transition"
                      >
                        Sağ Panelde Göster →
                      </button>
                    </div>

                    {spatialItems.length > 1 && (
                      <div className="flex items-center justify-between pt-2 border-t border-[#E6E1D6] text-[10.5px] text-[#78716C]">
                        <span>Diğer kırmızı/turuncu noktalar ({spatialItems.length}):</span>
                        <div className="flex items-center gap-1">
                          {spatialItems.slice(0, 5).map((it, idx) => (
                            <button
                              key={`${it.code}_${idx}`}
                              type="button"
                              onClick={() => {
                                const mIdx = project.modules.findIndex(
                                  (m) => m.id === it.targetModuleId
                                );
                                const bMatch = String(it.targetId || "").match(/bay_(\d+)/);
                                setSelectedBeaconFinding({
                                  code: it.code,
                                  severity: it.severity,
                                  title: formatEngineeringErrorCode(it.code),
                                  message: it.message,
                                  suggestions: it.suggestions || [],
                                  remediationProposals: it.remediationProposals || [],
                                  moduleIndex: mIdx >= 0 ? mIdx : activeModuleIndex,
                                  bayIndex: bMatch ? Number(bMatch[1]) : activeBayIndex,
                                });
                              }}
                              className={`w-6 h-6 rounded-full font-mono font-bold text-[10px] cursor-pointer ${
                                selectedBeaconFinding.code === it.code
                                  ? "bg-red-600 text-white"
                                  : "bg-[#EFECE4] text-[#44403C] hover:bg-[#E2DDD0]"
                              }`}
                            >
                              {idx + 1}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
    </>
  );
};
