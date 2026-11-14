import * as THREE from "three";
import {
  ModuleInstance,
  SpaceDefinition,
  computeSystem32MultiHoleYs,
  resolveMultiHoleSpec,
  resolveSpaceCeilingConfig,
} from "@birim/core";
import type { ComponentGeometry } from "@birim/geometry";
import { markSharedGeometry, markSharedMaterial } from "./webglResourceGuard";

const sharedPinHoleCylinder = (() => {
  const g = new THREE.CylinderGeometry(2.6, 2.6, 1.4, 14);
  g.rotateZ(Math.PI / 2);
  return markSharedGeometry(g);
})();

const sharedPinHoleMat = markSharedMaterial(
  new THREE.MeshStandardMaterial({
    color: 0x262523,
    roughness: 0.72,
    metalness: 0.35,
  })
);

const sharedSpotTrimGeo = markSharedGeometry(new THREE.CylinderGeometry(42, 42, 6, 24));
const sharedSpotCoreGeo = markSharedGeometry(new THREE.CylinderGeometry(28, 28, 3, 20));
const sharedSpotTrimMat = markSharedMaterial(
  new THREE.MeshStandardMaterial({
    color: 0x27272a,
    roughness: 0.35,
    metalness: 0.8,
  })
);
const sharedSpotGlowMat = markSharedMaterial(
  new THREE.MeshStandardMaterial({
    color: 0xfff3d6,
    emissive: new THREE.Color(0xffcf75),
    emissiveIntensity: 2.4,
    roughness: 0.2,
  })
);

/**
 * Seçilen modülün `multiHoleMode` (`full_system_32`, `zone_32`, `cluster_5`, `cluster_3`, `single_pin`)
 * ayarına göre sol yan dikme iç yüzü, sağ yan dikme iç yüzü ve ara dikmelerin her iki yüzündeki
 * gerçek Ø5mm System 32 çoklu delik dizilerini tek bir `THREE.InstancedMesh` olarak üretir.
 */
export function build3DModuleMultiHoleInstancedMesh(
  mod: ModuleInstance,
  components: ComponentGeometry[]
): THREE.InstancedMesh | null {
  const spec = resolveMultiHoleSpec(mod);
  if (spec.mode === "none" || !spec.showIn3DRender || mod.category === "complementary") {
    return null;
  }

  const panelT = mod.carcass.panelThickness || 18;
  const matrices: THREE.Matrix4[] = [];
  const dummy = new THREE.Object3D();

  for (const comp of components) {
    const isLeftSide = comp.role === "carcass_side_left";
    const isRightSide = comp.role === "carcass_side_right";
    const isDivider = comp.role === "carcass_divider";
    if (!isLeftSide && !isRightSide && !isDivider) continue;

    const panelH = comp.dimensions.height;
    const panelD = comp.dimensions.depth;
    if (panelH < 180 || panelD < 160) continue;

    const frontSetback = spec.frontSetbackMm;
    const rearLimit = Math.max(frontSetback + 64, panelD - 48);
    const kSteps = Math.max(2, Math.floor((rearLimit - frontSetback) / 32));
    const backSetback = Math.min(panelD - 37, frontSetback + kSteps * 32);
    const midSetback =
      spec.rowCount === 3 && panelD >= 480 && kSteps >= 6
        ? frontSetback + Math.floor(kSteps / 2) * 32
        : null;

    const zOffsetsFromFront = [frontSetback];
    if (
      midSetback !== null &&
      Math.abs(midSetback - frontSetback) >= 64 &&
      Math.abs(backSetback - midSetback) >= 64
    ) {
      zOffsetsFromFront.push(midSetback);
    }
    if (Math.abs(backSetback - frontSetback) >= 64) {
      zOffsetsFromFront.push(backSetback);
    }

    let adjShelfYs: number[] = [];
    let fixedShelfYs: number[] = [];
    const bottomOffsetY =
      isLeftSide || isRightSide
        ? Math.max(0, (mod.carcass.plinthHeight || 0) - (comp.position.y || 0))
        : 0;

    if (isLeftSide || isRightSide) {
      const bayIdx = isRightSide ? Math.max(0, mod.bays.length - 1) : 0;
      const bay = mod.bays[bayIdx];
      adjShelfYs = (bay?.shelves || [])
        .filter((s) => !s.isHidden && s.isAdjustable !== false)
        .map((s) => bottomOffsetY + panelT + s.elevationY);
      fixedShelfYs = (bay?.shelves || [])
        .filter((s) => !s.isHidden && s.isAdjustable === false)
        .map((s) => bottomOffsetY + panelT + s.elevationY);
    } else if (isDivider && typeof comp.bayIndex === "number") {
      const lb = mod.bays[comp.bayIndex];
      const rb = mod.bays[comp.bayIndex + 1];
      const allShelves = [...(lb?.shelves || []), ...(rb?.shelves || [])].filter((s) => !s.isHidden);
      adjShelfYs = allShelves.filter((s) => s.isAdjustable !== false).map((s) => s.elevationY);
      fixedShelfYs = allShelves.filter((s) => s.isAdjustable === false).map((s) => s.elevationY);
    }

    const holeYs = computeSystem32MultiHoleYs({
      mode: spec.mode,
      panelHeightMm: panelH,
      bottomOffsetY,
      panelThicknessMm: isDivider ? 0 : panelT,
      edgeMarginMm: spec.edgeMarginMm,
      adjustableShelfYsMm: adjShelfYs,
      blockedYsMm: fixedShelfYs.map((fy) => ({ y: fy, clearanceMm: 18 })),
    });

    if (holeYs.length === 0) continue;

    // comp.position modül içi sol-alt-arka köşedir: X [px..px+cw], Y [py..py+panelH], Z [pz..pz+panelD] (ön yüz pz + panelD)
    const px = comp.position.x;
    const py = comp.position.y;
    const pz = comp.position.z;
    const cw = comp.dimensions.width;

    const facesX: number[] = isLeftSide
      ? [px + cw + 0.35] // Sol dikmenin sağ (iç) yüzü
      : isRightSide
      ? [px - 0.35] // Sağ dikmenin sol (iç) yüzü
      : [px - 0.35, px + cw + 0.35]; // Orta dikmenin her iki yüzü

    for (const wx of facesX) {
      for (const hy of holeYs) {
        const wy = py + hy;
        for (const frontDist of zOffsetsFromFront) {
          const wz = pz + panelD - frontDist;
          dummy.position.set(wx, wy, wz);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          matrices.push(dummy.matrix.clone());
        }
      }
    }
  }

  if (matrices.length === 0) return null;

  const inst = new THREE.InstancedMesh(sharedPinHoleCylinder, sharedPinHoleMat, matrices.length);
  inst.name = `v74_multihole_${mod.id}`;
  inst.raycast = () => {};
  inst.castShadow = false;
  inst.receiveShadow = false;
  matrices.forEach((mtx, i) => inst.setMatrixAt(i, mtx));
  inst.instanceMatrix.needsUpdate = true;
  return inst;
}

/**
 * 3D Sahnede Mimari Tavan ve 6 Tavan Tipini (`flat_plaster`, `dropped_perimeter_cove`,
 * `gypsum_soffit_bulkhead`, `exposed_wood_beams`, `coffered_baffle`, `sloped_attic`) üretir.
 */
export function build3DArchitecturalCeilingGroup(
  space: SpaceDefinition,
  mainWallLengthMm: number
): THREE.Group | null {
  const cfg = resolveSpaceCeilingConfig(space);
  if (!cfg.enabled || !cfg.showIn3D) return null;

  const group = new THREE.Group();
  group.name = "v74_architectural_ceiling_3d";

  const ceilH = space.ceilingHeight || 2600;
  const spanW = Math.max(1600, mainWallLengthMm);
  const roomDepthZ = 2500;
  const slabThickness = 90;
  const isTranslucent = Boolean(cfg.translucentCutawayIn3D);
  const baseOpacity = isTranslucent ? 0.38 : 1.0;

  const plasterMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(cfg.colorHex || "#F5F3EE"),
    roughness: 0.86,
    metalness: 0.01,
    clearcoat: 0.04,
    transparent: isTranslucent,
    opacity: baseOpacity,
    depthWrite: !isTranslucent,
    side: THREE.DoubleSide,
  });

  const soffitMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#EAE6DF"),
    roughness: 0.82,
    metalness: 0.01,
    transparent: isTranslucent,
    opacity: isTranslucent ? 0.44 : 1.0,
    depthWrite: !isTranslucent,
  });

  const oakBeamMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#9A6F44"),
    roughness: 0.56,
    metalness: 0.02,
    clearcoat: 0.12,
    transparent: isTranslucent,
    opacity: isTranslucent ? 0.5 : 1.0,
    depthWrite: !isTranslucent,
  });

  const addRecessedSpots = (spotY: number, zCenter: number, count: number) => {
    if (!cfg.hasRecessedSpots || isTranslucent) return;
    const step = spanW / (count + 1);
    for (let i = 1; i <= count; i++) {
      const sx = step * i;
      const trim = new THREE.Mesh(sharedSpotTrimGeo, sharedSpotTrimMat);
      trim.position.set(sx, spotY - 2, zCenter);
      trim.raycast = () => {};
      group.add(trim);

      const core = new THREE.Mesh(sharedSpotCoreGeo, sharedSpotGlowMat);
      core.position.set(sx, spotY - 4, zCenter);
      core.raycast = () => {};
      group.add(core);
    }
  };

  if (cfg.ceilingType === "sloped_attic") {
    const kneeH = cfg.slopeKneeHeightMm;
    const rad = (cfg.slopeAngleDeg * Math.PI) / 180;
    if (cfg.slopeDirection === "back_to_front") {
      const riseZ = Math.min(roomDepthZ, (ceilH - kneeH) / Math.max(0.08, Math.tan(rad)));
      const slopeLen = Math.hypot(riseZ, ceilH - kneeH);
      const slopeMesh = new THREE.Mesh(
        new THREE.BoxGeometry(spanW, slabThickness, slopeLen),
        plasterMat
      );
      slopeMesh.position.set(spanW / 2, (kneeH + ceilH) / 2 + slabThickness / 2, riseZ / 2);
      slopeMesh.rotation.x = -Math.atan2(ceilH - kneeH, Math.max(1, riseZ));
      slopeMesh.raycast = () => {};
      slopeMesh.receiveShadow = true;
      group.add(slopeMesh);

      if (riseZ < roomDepthZ) {
        const flatExt = new THREE.Mesh(
          new THREE.BoxGeometry(spanW, slabThickness, roomDepthZ - riseZ),
          plasterMat
        );
        flatExt.position.set(
          spanW / 2,
          ceilH + slabThickness / 2,
          riseZ + (roomDepthZ - riseZ) / 2
        );
        flatExt.raycast = () => {};
        group.add(flatExt);
      }
    } else {
      const runX = Math.min(spanW, (ceilH - kneeH) / Math.max(0.08, Math.tan(rad)));
      const slopeLen = Math.hypot(runX, ceilH - kneeH);
      const isRightToLeft = cfg.slopeDirection === "right_to_left";
      const slopeMesh = new THREE.Mesh(
        new THREE.BoxGeometry(slopeLen, slabThickness, roomDepthZ),
        plasterMat
      );
      const centerSlopeX = isRightToLeft ? spanW - runX / 2 : runX / 2;
      slopeMesh.position.set(centerSlopeX, (kneeH + ceilH) / 2 + slabThickness / 2, roomDepthZ / 2);
      slopeMesh.rotation.z =
        (isRightToLeft ? -1 : 1) * Math.atan2(ceilH - kneeH, Math.max(1, runX));
      slopeMesh.raycast = () => {};
      slopeMesh.receiveShadow = true;
      group.add(slopeMesh);

      if (runX < spanW) {
        const flatW = spanW - runX;
        const flatMesh = new THREE.Mesh(
          new THREE.BoxGeometry(flatW, slabThickness, roomDepthZ),
          plasterMat
        );
        flatMesh.position.set(
          isRightToLeft ? flatW / 2 : runX + flatW / 2,
          ceilH + slabThickness / 2,
          roomDepthZ / 2
        );
        flatMesh.raycast = () => {};
        group.add(flatMesh);
      }
    }
    return group;
  }

  // Ana üst tavan plağı (tüm düz tabanlı tavan tipleri için)
  const mainSlab = new THREE.Mesh(
    new THREE.BoxGeometry(spanW, slabThickness, roomDepthZ),
    plasterMat
  );
  mainSlab.position.set(spanW / 2, ceilH + slabThickness / 2, roomDepthZ / 2);
  mainSlab.raycast = () => {};
  mainSlab.castShadow = !isTranslucent;
  mainSlab.receiveShadow = true;
  group.add(mainSlab);

  if (cfg.ceilingType === "flat_plaster") {
    addRecessedSpots(ceilH, 680, Math.max(2, Math.round(spanW / 950)));
  } else if (cfg.ceilingType === "dropped_perimeter_cove") {
    const drop = Math.max(60, cfg.dropHeightMm);
    const bandD = Math.min(900, Math.max(320, cfg.soffitDepthMm));
    const sideBandW = Math.min(480, Math.max(240, Math.round(spanW * 0.12)));

    // Arka (dolap üstü) havuz tavan bandı
    const rearBand = new THREE.Mesh(new THREE.BoxGeometry(spanW, drop, bandD), soffitMat);
    rearBand.position.set(spanW / 2, ceilH - drop / 2, bandD / 2);
    rearBand.raycast = () => {};
    rearBand.castShadow = !isTranslucent;
    rearBand.receiveShadow = true;
    group.add(rearBand);

    // Sol ve sağ havuz yan bantları
    const remainZ = Math.max(200, roomDepthZ - bandD);
    [-1, 1].forEach((dir) => {
      const sideBand = new THREE.Mesh(new THREE.BoxGeometry(sideBandW, drop, remainZ), soffitMat);
      sideBand.position.set(
        dir < 0 ? sideBandW / 2 : spanW - sideBandW / 2,
        ceilH - drop / 2,
        bandD + remainZ / 2
      );
      sideBand.raycast = () => {};
      group.add(sideBand);
    });

    // Gizli LED ışık havuzu (3000K sıcak bant)
    if (cfg.hasHiddenLedCove) {
      const innerSpanW = Math.max(300, spanW - sideBandW * 2 + 40);
      const coveLedMat = new THREE.MeshStandardMaterial({
        color: 0xfff3d1,
        emissive: new THREE.Color(0xffbe55),
        emissiveIntensity: 3.1,
        roughness: 0.2,
      });
      const ledStripRear = new THREE.Mesh(new THREE.BoxGeometry(innerSpanW, 10, 14), coveLedMat);
      ledStripRear.position.set(spanW / 2, ceilH - drop + 22, bandD + 6);
      ledStripRear.raycast = () => {};
      group.add(ledStripRear);
    }

    addRecessedSpots(ceilH - drop, bandD * 0.52, Math.max(2, Math.round(spanW / 1000)));
  } else if (cfg.ceilingType === "gypsum_soffit_bulkhead") {
    const drop = Math.max(60, cfg.dropHeightMm);
    const soffitD = Math.max(300, cfg.soffitDepthMm);
    const bulkhead = new THREE.Mesh(new THREE.BoxGeometry(spanW, drop, soffitD), soffitMat);
    bulkhead.position.set(spanW / 2, ceilH - drop / 2, soffitD / 2);
    bulkhead.raycast = () => {};
    bulkhead.castShadow = !isTranslucent;
    bulkhead.receiveShadow = true;
    group.add(bulkhead);

    addRecessedSpots(ceilH, soffitD + 420, Math.max(2, Math.round(spanW / 950)));
  } else if (cfg.ceilingType === "exposed_wood_beams") {
    const bH = cfg.beamHeightMm;
    const bW = cfg.beamWidthMm;
    const spacing = cfg.beamSpacingMm;
    const count = Math.max(2, Math.floor(spanW / spacing) + 1);
    const startX = (spanW - (count - 1) * spacing) / 2;

    const beamGeo = new THREE.BoxGeometry(bW, bH, roomDepthZ);
    const instBeams = new THREE.InstancedMesh(beamGeo, oakBeamMat, count);
    instBeams.raycast = () => {};
    instBeams.castShadow = !isTranslucent;
    instBeams.receiveShadow = true;
    const mtx = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      mtx.makeTranslation(startX + i * spacing, ceilH - bH / 2, roomDepthZ / 2);
      instBeams.setMatrixAt(i, mtx);
    }
    instBeams.instanceMatrix.needsUpdate = true;
    group.add(instBeams);
  } else if (cfg.ceilingType === "coffered_baffle") {
    const slatH = Math.max(50, cfg.dropHeightMm);
    const pitch = Math.max(60, cfg.bafflePitchMm);
    const slatW = Math.min(42, Math.round(pitch * 0.34));
    const count = Math.max(4, Math.floor((spanW - 40) / pitch));
    const startX = (spanW - (count - 1) * pitch) / 2;

    // Akustik siyah keçe arka tavan tablası
    if (!isTranslucent) {
      const feltMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.95 });
      const feltBacking = new THREE.Mesh(new THREE.BoxGeometry(spanW, 12, roomDepthZ), feltMat);
      feltBacking.position.set(spanW / 2, ceilH - 6, roomDepthZ / 2);
      feltBacking.raycast = () => {};
      group.add(feltBacking);
    }

    const slatGeo = new THREE.BoxGeometry(slatW, slatH, roomDepthZ);
    const instSlats = new THREE.InstancedMesh(slatGeo, oakBeamMat, count);
    instSlats.raycast = () => {};
    instSlats.castShadow = !isTranslucent;
    instSlats.receiveShadow = true;
    const mtx = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      mtx.makeTranslation(startX + i * pitch, ceilH - slatH / 2, roomDepthZ / 2);
      instSlats.setMatrixAt(i, mtx);
    }
    instSlats.instanceMatrix.needsUpdate = true;
    group.add(instSlats);
  }

  return group;
}
