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
    color: 0xfff8e7,
    emissive: new THREE.Color(0xffd27d),
    emissiveIntensity: 3.2,
    roughness: 0.15,
  })
);

let cachedVolumetricConeTex: THREE.CanvasTexture | null = null;
function getVolumetricSpotConeTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  if (cachedVolumetricConeTex) return cachedVolumetricConeTex;
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 256;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0.0, "rgba(255, 240, 205, 0.85)");
  g.addColorStop(0.18, "rgba(255, 224, 168, 0.42)");
  g.addColorStop(0.55, "rgba(255, 212, 145, 0.14)");
  g.addColorStop(1.0, "rgba(255, 204, 128, 0.0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  cachedVolumetricConeTex = tex;
  return tex;
}

let cachedRadialHaloTex: THREE.CanvasTexture | null = null;
function getSoftRadialLightHaloTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  if (cachedRadialHaloTex) return cachedRadialHaloTex;
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
  g.addColorStop(0.0, "rgba(255, 245, 220, 0.95)");
  g.addColorStop(0.28, "rgba(255, 222, 165, 0.45)");
  g.addColorStop(0.65, "rgba(255, 205, 130, 0.12)");
  g.addColorStop(1.0, "rgba(255, 195, 110, 0.0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  cachedRadialHaloTex = tex;
  return tex;
}

let cachedCoveWashTex: THREE.CanvasTexture | null = null;
function getCoveWallWashTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  if (cachedCoveWashTex) return cachedCoveWashTex;
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 128;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0.0, "rgba(255, 214, 140, 0.0)");
  g.addColorStop(0.22, "rgba(255, 225, 165, 0.78)");
  g.addColorStop(0.55, "rgba(255, 208, 130, 0.28)");
  g.addColorStop(1.0, "rgba(255, 196, 110, 0.0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  cachedCoveWashTex = tex;
  return tex;
}

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
  const hingeComps = components.filter((c) => c.role === "door_hinge");

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

    const bottomOffsetY =
      isLeftSide || isRightSide
        ? Math.max(0, (mod.carcass.plinthHeight || 0) - (comp.position.y || 0))
        : 0;

    // comp.position modül içi sol-alt-arka köşedir: X [px..px+cw], Y [py..py+panelH], Z [pz..pz+panelD] (ön yüz pz + panelD)
    const px = comp.position.x;
    const py = comp.position.y;
    const pz = comp.position.z;
    const cw = comp.dimensions.width;

    const faceSpecs: Array<{ wx: number; bayIdx: number }> = isLeftSide
      ? [{ wx: px + cw + 0.35, bayIdx: 0 }] // Sol dikmenin sağ (iç) yüzü
      : isRightSide
      ? [{ wx: px - 0.35, bayIdx: Math.max(0, mod.bays.length - 1) }] // Sağ dikmenin sol (iç) yüzü
      : typeof comp.bayIndex === "number"
      ? [
          { wx: px - 0.35, bayIdx: comp.bayIndex }, // Orta dikmenin sol yüzü -> yalnızca sol bölme rafları
          { wx: px + cw + 0.35, bayIdx: comp.bayIndex + 1 }, // Orta dikmenin sağ yüzü -> yalnızca sağ bölme rafları
        ]
      : [
          { wx: px - 0.35, bayIdx: 0 },
          { wx: px + cw + 0.35, bayIdx: Math.max(0, mod.bays.length - 1) },
        ];

    const baseOffset = isDivider ? 0 : bottomOffsetY + panelT;

    for (const faceSpec of faceSpecs) {
      const bay = mod.bays[faceSpec.bayIdx];
      const visibleShelves = (bay?.shelves || []).filter((s) => !s.isHidden);
      const isFixedShelf = (s: (typeof visibleShelves)[number]) =>
        s.isAdjustable === false || s.isFixed === true;

      const adjShelfYs = visibleShelves
        .filter((s) => !isFixedShelf(s))
        .map((s) => baseOffset + s.elevationY);

      // Raf-bazlı delik modlarında (cluster_5 / cluster_3 / single_pin) hareketli raf yoksa delik üretilmez;
      // Tam Boy 32 / Bölge 32 modları ise UI seçimi (resolveMultiHoleSpec) ile birebir tutarlı çizilir.
      const isShelfClusterMode =
        spec.mode === "cluster_5" || spec.mode === "cluster_3" || spec.mode === "single_pin";
      if (isShelfClusterMode && adjShelfYs.length === 0) {
        continue;
      }

      // Sabit raf ve çekmece kasası bölgelerinde Sistem 32 raf pimi deliği açılmaz
      const visibleDrawers = (bay?.drawers || []).filter((d) => !d.isHidden);
      const blockedYsMm = [
        ...visibleShelves
          .filter((s) => isFixedShelf(s))
          .map((s) => {
            const st = s.thickness || panelT;
            return {
              y: baseOffset + s.elevationY + st / 2,
              clearanceMm: st / 2 + 4,
            };
          }),
        ...visibleDrawers.map((dr) => ({
          y: baseOffset + dr.elevationY + dr.height / 2,
          clearanceMm: dr.height / 2 + 16,
        })),
      ];

      const holeYs = computeSystem32MultiHoleYs({
        mode: spec.mode,
        panelHeightMm: panelH,
        bottomOffsetY,
        panelThicknessMm: isDivider ? 0 : panelT,
        edgeMarginMm: spec.edgeMarginMm,
        adjustableShelfYsMm: adjShelfYs,
        blockedYsMm,
      });

      if (holeYs.length === 0) continue;

      // Bu yüze denk gelen menteşe taban deliklerini (±16mm) topla; ön sırada çakışan raf pimi deliklerini ele
      const bayHingeHoleYs: number[] = [];
      for (const hc of hingeComps) {
        if ((hc.bayIndex ?? 0) !== faceSpec.bayIdx) continue;
        const hcCenterX = hc.position.x + hc.dimensions.width / 2;
        if (Math.abs(hcCenterX - faceSpec.wx) > 60) continue;
        const hcCenterY = hc.position.y + hc.dimensions.height / 2;
        bayHingeHoleYs.push(hcCenterY - 16, hcCenterY + 16);
      }

      const isBayInset = bay?.door?.overlayType === "inset";
      const bayHingeSetback = isBayInset ? 57 : 37;

      for (const hy of holeYs) {
        const wy = py + hy;
        for (const frontDist of zOffsetsFromFront) {
          if (
            Math.abs(frontDist - bayHingeSetback) <= 4 &&
            bayHingeHoleYs.some((hmy) => Math.abs(hmy - wy) < 14)
          ) {
            continue;
          }
          const wz = pz + panelD - frontDist;
          dummy.position.set(faceSpec.wx, wy, wz);
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
export interface WallCeilingProfilePoint {
  s: number;
  y: number;
}

type SlopeDirId = "left_to_right" | "right_to_left" | "back_to_front";

interface ResolvedWallSlopeParam {
  dir: SlopeDirId;
  kneeH: number;
  angleDeg: number;
  slopeTan: number;
}

function getActiveWallSlopeParams(
  space: SpaceDefinition,
  cfg: ReturnType<typeof resolveSpaceCeilingConfig>,
  ceilH: number
): ResolvedWallSlopeParam[] {
  const rawWallSlopes = space.ceilingConfig?.wallSlopes;
  const rawDirs = space.ceilingConfig?.slopeDirections;
  const activeDirs: SlopeDirId[] =
    Array.isArray(rawDirs) && rawDirs.length > 0
      ? Array.from(new Set(rawDirs))
      : cfg.slopeDirections && cfg.slopeDirections.length > 0
        ? cfg.slopeDirections
        : [space.ceilingConfig?.slopeDirection || cfg.slopeDirection || "left_to_right"];

  const out: ResolvedWallSlopeParam[] = [];
  for (const dir of activeDirs) {
    const ws = rawWallSlopes?.[dir];
    if (ws && ws.enabled === false) continue;
    const kneeH = Math.max(300, Math.min(ceilH, ws?.kneeHeightMm ?? cfg.slopeKneeHeightMm));
    const angleDeg = Math.max(5, Math.min(65, ws?.angleDeg ?? cfg.slopeAngleDeg));
    const slopeTan = Math.max(0.08, Math.tan((angleDeg * Math.PI) / 180));
    out.push({ dir, kneeH, angleDeg, slopeTan });
  }
  return out;
}

/**
 * Evaluates the exact ceiling underside height (mm) at any world (x, z) coordinate,
 * matching `build3DArchitecturalCeilingGroup` 1:1 for single- or multi-wall `sloped_attic` roofs.
 */
export function evaluateCeilingHeightAtWorldXZ(
  space: SpaceDefinition,
  mainWallLengthMm: number,
  worldX: number,
  worldZ: number
): number {
  const ceilH = space.ceilingHeight || 2600;
  const cfg = resolveSpaceCeilingConfig(space);
  if (!cfg.enabled || !cfg.showIn3D || cfg.ceilingType !== "sloped_attic") {
    return ceilH;
  }

  const spanW = Math.max(1600, mainWallLengthMm);
  const sideWallMaxZ = (space.walls || []).reduce((maxZ, w) => {
    const rot = (((w.rotationY || 0) % 360) + 360) % 360;
    const extZ = rot === 90 || rot === 270 ? w.position.z + w.length : w.position.z + 2600;
    return Math.max(maxZ, extZ);
  }, 2600);
  const roomDepthZ = Math.max(2500, Math.min(4800, sideWallMaxZ));
  const activeParams = getActiveWallSlopeParams(space, cfg, ceilH);

  let minH = ceilH;
  for (const p of activeParams) {
    let hDir = ceilH;
    if (p.dir === "back_to_front") {
      const riseZ = Math.min(roomDepthZ, (ceilH - p.kneeH) / p.slopeTan);
      const t = Math.max(0, Math.min(1, worldZ / Math.max(1, riseZ)));
      hDir = p.kneeH + (ceilH - p.kneeH) * t;
    } else if (p.dir === "right_to_left") {
      const runX = Math.min(spanW, (ceilH - p.kneeH) / p.slopeTan);
      const distFromRight = spanW - worldX;
      const t = Math.max(0, Math.min(1, distFromRight / Math.max(1, runX)));
      hDir = p.kneeH + (ceilH - p.kneeH) * t;
    } else {
      const runX = Math.min(spanW, (ceilH - p.kneeH) / p.slopeTan);
      const t = Math.max(0, Math.min(1, worldX / Math.max(1, runX)));
      hDir = p.kneeH + (ceilH - p.kneeH) * t;
    }
    if (hDir < minH) minH = hDir;
  }
  return minH;
}

/**
 * Computes the exact piecewise-linear top profile `[{ s, y }]` along a wall segment `s ∈ [0, wLen]`
 * so walls and their CAD selection frames clip cleanly against single- or multi-wall sloped ceilings.
 */
export function computeWallTopProfileForCeiling(
  space: SpaceDefinition,
  mainWallLengthMm: number,
  wall: { position: { x: number; z: number }; rotationY?: number; length: number; height?: number }
): { points: WallCeilingProfilePoint[]; isClipped: boolean; minTopY: number; maxTopY: number } {
  const ceilH = space.ceilingHeight || 2600;
  const wLen = Math.max(100, wall.length || 3600);
  const wH = Math.max(400, wall.height || ceilH);
  const cfg = resolveSpaceCeilingConfig(space);

  if (!cfg.enabled || !cfg.showIn3D || cfg.ceilingType !== "sloped_attic") {
    return {
      points: [
        { s: 0, y: wH },
        { s: wLen, y: wH },
      ],
      isClipped: false,
      minTopY: wH,
      maxTopY: wH,
    };
  }

  const rotRad = -((wall.rotationY || 0) * Math.PI) / 180;
  const dirX = Math.cos(rotRad);
  const dirZ = -Math.sin(rotRad);

  const spanW = Math.max(1600, mainWallLengthMm);
  const sideWallMaxZ = (space.walls || []).reduce((maxZ, w) => {
    const rot = (((w.rotationY || 0) % 360) + 360) % 360;
    const extZ = rot === 90 || rot === 270 ? w.position.z + w.length : w.position.z + 2600;
    return Math.max(maxZ, extZ);
  }, 2600);
  const roomDepthZ = Math.max(2500, Math.min(4800, sideWallMaxZ));
  const activeParams = getActiveWallSlopeParams(space, cfg, ceilH);
  const activeDirs = activeParams.map((p) => p.dir);

  const candidateS: number[] = [0, wLen];
  const pushIfInterior = (sVal: number) => {
    if (Number.isFinite(sVal) && sVal > 5 && sVal < wLen - 5) {
      candidateS.push(sVal);
    }
  };

  for (const p of activeParams) {
    const runX = Math.min(spanW, (ceilH - p.kneeH) / p.slopeTan);
    const riseZ = Math.min(roomDepthZ, (ceilH - p.kneeH) / p.slopeTan);
    if (p.dir === "back_to_front" && Math.abs(dirZ) > 1e-4) {
      pushIfInterior((0 - wall.position.z) / dirZ);
      pushIfInterior((riseZ - wall.position.z) / dirZ);
    } else if (p.dir === "left_to_right" && Math.abs(dirX) > 1e-4) {
      pushIfInterior((0 - wall.position.x) / dirX);
      pushIfInterior((runX - wall.position.x) / dirX);
    } else if (p.dir === "right_to_left" && Math.abs(dirX) > 1e-4) {
      pushIfInterior((spanW - runX - wall.position.x) / dirX);
      pushIfInterior((spanW - wall.position.x) / dirX);
    }
  }
  // If both left and right slopes meet in the middle (gable ridge)
  if (activeDirs.includes("left_to_right") && activeDirs.includes("right_to_left") && Math.abs(dirX) > 1e-4) {
    pushIfInterior((spanW * 0.5 - wall.position.x) / dirX);
  }
  // Diagonal hip intersections where two slopes meet
  if (activeDirs.length > 1) {
    const steps = 16;
    for (let k = 1; k < steps; k++) {
      pushIfInterior((wLen * k) / steps);
    }
  }

  candidateS.sort((a, b) => a - b);
  const uniqueS: number[] = [];
  for (const sVal of candidateS) {
    if (uniqueS.length === 0 || sVal - uniqueS[uniqueS.length - 1] > 2) {
      uniqueS.push(sVal);
    }
  }

  const points: WallCeilingProfilePoint[] = uniqueS.map((s) => {
    const wx = wall.position.x + dirX * s;
    const wz = wall.position.z + dirZ * s;
    const hCeil = evaluateCeilingHeightAtWorldXZ(space, mainWallLengthMm, wx, wz);
    return { s, y: Math.max(250, Math.min(wH, hCeil)) };
  });

  let minTopY = Infinity;
  let maxTopY = -Infinity;
  let isClipped = false;
  for (const p of points) {
    if (p.y < minTopY) minTopY = p.y;
    if (p.y > maxTopY) maxTopY = p.y;
    if (p.y < wH - 2) isClipped = true;
  }

  return { points, isClipped, minTopY, maxTopY };
}

export function build3DArchitecturalCeilingGroup(
  space: SpaceDefinition,
  mainWallLengthMm: number,
  lightingPreset: "daylight" | "showroom_warm" | "night_led" = "daylight"
): THREE.Group | null {
  const cfg = resolveSpaceCeilingConfig(space);
  if (!cfg.enabled || !cfg.showIn3D) return null;

  const group = new THREE.Group();
  group.name = "v74_architectural_ceiling_3d";

  const ceilH = space.ceilingHeight || 2600;
  const spanW = Math.max(1600, mainWallLengthMm);
  const sideWallMaxZ = (space.walls || []).reduce((maxZ, w) => {
    const rot = (((w.rotationY || 0) % 360) + 360) % 360;
    const extZ = rot === 90 || rot === 270 ? w.position.z + w.length : w.position.z + 2600;
    return Math.max(maxZ, extZ);
  }, 2600);
  const roomDepthZ = Math.max(2500, Math.min(4800, sideWallMaxZ));
  const slabThickness = 75;
  const isTranslucent = Boolean(cfg.translucentCutawayIn3D);
  const baseOpacity = isTranslucent ? 0.36 : 1.0;

  // Smart ArchViz One-Way Ceiling Deck Material:
  // Visible from inside/below the room (FrontSide rotated +PI/2 around X -> normal -Y),
  // automatically invisible when orbiting from ABOVE ceiling height so it never blocks camera or studio key light!
  const deckOneWayMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(cfg.colorHex || "#F6F4EF"),
    roughness: 0.85,
    metalness: 0.01,
    clearcoat: 0.04,
    transparent: isTranslucent,
    opacity: baseOpacity,
    depthWrite: !isTranslucent,
    side: THREE.FrontSide,
  });

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
    const coneTex = getVolumetricSpotConeTexture();
    const haloTex = getSoftRadialLightHaloTexture();
    const isNight = lightingPreset === "night_led";
    const isWarm = lightingPreset === "showroom_warm";
    const coneOpacity = isNight ? 0.24 : isWarm ? 0.16 : 0.085;
    const haloOpacity = isNight ? 0.85 : isWarm ? 0.62 : 0.36;
    const poolOpacity = isNight ? 0.24 : isWarm ? 0.16 : 0.08;
    const coneH = Math.max(600, Math.min(1850, spotY - 220));
    const coneGeo = coneTex ? new THREE.ConeGeometry(340, coneH, 16, 1, true) : null;
    const coneMat = coneTex
      ? new THREE.MeshBasicMaterial({
          map: coneTex,
          color: isNight ? 0xffcf82 : 0xffe2b0,
          transparent: true,
          opacity: coneOpacity,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      : null;
    const lensHaloGeo = haloTex ? new THREE.PlaneGeometry(210, 210) : null;
    const lensHaloMat = haloTex
      ? new THREE.MeshBasicMaterial({
          map: haloTex,
          color: 0xffe4b5,
          transparent: true,
          opacity: haloOpacity,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      : null;
    const floorPoolGeo = haloTex ? new THREE.PlaneGeometry(860, 860) : null;
    const floorPoolMat = haloTex
      ? new THREE.MeshBasicMaterial({
          map: haloTex,
          color: 0xffd79a,
          transparent: true,
          opacity: poolOpacity,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      : null;

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

      if (lensHaloGeo && lensHaloMat) {
        const halo = new THREE.Mesh(lensHaloGeo, lensHaloMat);
        halo.rotation.x = Math.PI / 2;
        halo.position.set(sx, spotY - 7, zCenter);
        halo.raycast = () => {};
        group.add(halo);
      }
      if (coneGeo && coneMat) {
        const cone = new THREE.Mesh(coneGeo, coneMat);
        cone.position.set(sx, spotY - 12 - coneH / 2, zCenter);
        cone.raycast = () => {};
        group.add(cone);
      }
      if (floorPoolGeo && floorPoolMat) {
        const pool = new THREE.Mesh(floorPoolGeo, floorPoolMat);
        pool.rotation.x = -Math.PI / 2;
        pool.position.set(sx, 3.2, zCenter);
        pool.raycast = () => {};
        group.add(pool);
      }
    }

    // Zero-shadow pooled real PointLights (max 2) so cabinets, doors & handles catch real warm ceiling illumination at 60 FPS
    const realLightCount = Math.min(2, Math.max(1, count));
    const realIntensity = isNight ? 3.2 : isWarm ? 2.4 : 1.35;
    for (let li = 0; li < realLightCount; li++) {
      const lx = realLightCount === 1 ? spanW * 0.5 : spanW * (li === 0 ? 0.30 : 0.70);
      const pl = new THREE.PointLight(0xffd699, realIntensity, 3800, 0.32);
      pl.castShadow = false;
      pl.position.set(lx, Math.max(1400, spotY - 140), zCenter + 80);
      group.add(pl);
    }
  };

  if (cfg.ceilingType === "sloped_attic") {
    // Seamless watertight sloped roof slab (supports single-wall, gable, and multi-wall hip roofs with independent per-wall knee & angle)
    const activeParams = getActiveWallSlopeParams(space, cfg, ceilH);
    const activeDirs = activeParams.map((p) => p.dir);

    const maxWallThick = (space.walls || []).reduce(
      (mx, w) => Math.max(mx, w.thickness || 150),
      150
    );
    const leftPad = maxWallThick;
    const rightPad = maxWallThick;
    const backPad = maxWallThick;

    const rawXs: number[] = [-leftPad, 0, spanW, spanW + rightPad];
    const rawZs: number[] = [-backPad, 0, roomDepthZ];

    for (const p of activeParams) {
      const runX = Math.min(spanW, (ceilH - p.kneeH) / p.slopeTan);
      const riseZ = Math.min(roomDepthZ, (ceilH - p.kneeH) / p.slopeTan);
      if (p.dir === "left_to_right" && runX > 10 && runX < spanW - 10) {
        rawXs.push(runX);
      } else if (p.dir === "right_to_left" && runX > 10 && runX < spanW - 10) {
        rawXs.push(spanW - runX);
      } else if (p.dir === "back_to_front" && riseZ > 10 && riseZ < roomDepthZ - 10) {
        rawZs.push(riseZ);
      }
    }
    if (activeDirs.includes("left_to_right") && activeDirs.includes("right_to_left")) {
      const pL = activeParams.find((p) => p.dir === "left_to_right");
      const pR = activeParams.find((p) => p.dir === "right_to_left");
      if (pL && pR) {
        const meetX = (pR.kneeH - pL.kneeH + spanW * pR.slopeTan) / Math.max(0.08, pL.slopeTan + pR.slopeTan);
        if (meetX > 10 && meetX < spanW - 10) rawXs.push(meetX);
      }
    }
    // Add smooth subdivision lines when two perpendicular slopes intersect (hip roof ridge)
    if (
      activeDirs.includes("back_to_front") &&
      (activeDirs.includes("left_to_right") || activeDirs.includes("right_to_left"))
    ) {
      const subN = 28;
      for (let i = 1; i < subN; i++) {
        rawXs.push((spanW * i) / subN);
        rawZs.push((roomDepthZ * i) / subN);
      }
    }

    const dedupeSorted = (arr: number[]) => {
      arr.sort((a, b) => a - b);
      const out: number[] = [];
      for (const v of arr) {
        if (out.length === 0 || v - out[out.length - 1] > 2) out.push(v);
      }
      return out;
    };
    const xs = dedupeSorted(rawXs);
    const zs = dedupeSorted(rawZs);

    const evalUnderY = (wx: number, wz: number): number => {
      const cx = Math.max(0, Math.min(spanW, wx));
      const cz = Math.max(0, Math.min(roomDepthZ, wz));
      return evaluateCeilingHeightAtWorldXZ(space, mainWallLengthMm, cx, cz);
    };

    const nx = xs.length;
    const nz = zs.length;
    const positions: number[] = [];
    const pushTri = (
      ax: number,
      ay: number,
      az: number,
      bx: number,
      by: number,
      bz: number,
      cx: number,
      cy: number,
      cz: number
    ) => {
      positions.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    };
    const pushQuad = (
      a: [number, number, number],
      b: [number, number, number],
      c: [number, number, number],
      d: [number, number, number]
    ) => {
      pushTri(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
      pushTri(a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2]);
    };

    const botGrid: [number, number, number][][] = [];
    const topGrid: [number, number, number][][] = [];
    for (let iz = 0; iz < nz; iz++) {
      const bRow: [number, number, number][] = [];
      const tRow: [number, number, number][] = [];
      for (let ix = 0; ix < nx; ix++) {
        const yB = evalUnderY(xs[ix], zs[iz]);
        bRow.push([xs[ix], yB, zs[iz]]);
        tRow.push([xs[ix], yB + slabThickness, zs[iz]]);
      }
      botGrid.push(bRow);
      topGrid.push(tRow);
    }

    // Top (+Y) and bottom (-Y) roof faces
    for (let iz = 0; iz < nz - 1; iz++) {
      for (let ix = 0; ix < nx - 1; ix++) {
        // Top face (CCW when viewed from +Y)
        pushQuad(
          topGrid[iz][ix],
          topGrid[iz + 1][ix],
          topGrid[iz + 1][ix + 1],
          topGrid[iz][ix + 1]
        );
        // Bottom face (CCW when viewed from -Y)
        pushQuad(
          botGrid[iz][ix],
          botGrid[iz][ix + 1],
          botGrid[iz + 1][ix + 1],
          botGrid[iz + 1][ix]
        );
      }
    }

    // Perimeter thickness fascia walls (front, back, left, right)
    for (let ix = 0; ix < nx - 1; ix++) {
      // Front edge (z = roomDepthZ, normal +Z)
      pushQuad(
        botGrid[nz - 1][ix],
        botGrid[nz - 1][ix + 1],
        topGrid[nz - 1][ix + 1],
        topGrid[nz - 1][ix]
      );
      // Back edge (z = -backPad, normal -Z)
      pushQuad(
        botGrid[0][ix + 1],
        botGrid[0][ix],
        topGrid[0][ix],
        topGrid[0][ix + 1]
      );
    }
    for (let iz = 0; iz < nz - 1; iz++) {
      // Left edge (x = -leftPad, normal -X)
      pushQuad(
        botGrid[iz][0],
        botGrid[iz + 1][0],
        topGrid[iz + 1][0],
        topGrid[iz][0]
      );
      // Right edge (x = spanW + rightPad, normal +X)
      pushQuad(
        botGrid[iz + 1][nx - 1],
        botGrid[iz][nx - 1],
        topGrid[iz][nx - 1],
        topGrid[iz + 1][nx - 1]
      );
    }

    const roofGeo = new THREE.BufferGeometry();
    roofGeo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    roofGeo.computeVertexNormals();

    const roofMesh = new THREE.Mesh(roofGeo, plasterMat);
    roofMesh.raycast = () => {};
    roofMesh.receiveShadow = true;
    group.add(roofMesh);
    return group;
  }

  // Ana üst tavan yüzeyi: Alttan bakıldığında tam dolu mimari tavan, üstten bakıldığında sahneyi ve stüdyo ışığını kapatmayan akıllı ArchViz yüzey!
  const mainSlab = new THREE.Mesh(
    new THREE.PlaneGeometry(spanW, roomDepthZ),
    deckOneWayMat
  );
  mainSlab.rotation.x = Math.PI / 2;
  mainSlab.position.set(spanW / 2, ceilH, roomDepthZ / 2);
  mainSlab.raycast = () => {};
  mainSlab.castShadow = false;
  mainSlab.receiveShadow = true;
  group.add(mainSlab);

  // Tavan kenar kontur çerçevesi (üstten bakışta tavan sınırını zarifçe belli eder)
  const rimEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(spanW, 24, roomDepthZ));
  const rimLines = new THREE.LineSegments(
    rimEdges,
    new THREE.LineBasicMaterial({ color: 0xd6d0c4, transparent: true, opacity: 0.55 })
  );
  rimLines.position.set(spanW / 2, ceilH + 12, roomDepthZ / 2);
  rimLines.raycast = () => {};
  group.add(rimLines);

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
    rearBand.castShadow = false;
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

      // Zero-cost additive cove light wash across ceiling recess + 1 lightweight PointLight
      const coveWashTex = getCoveWallWashTexture();
      if (coveWashTex && !isTranslucent) {
        const washOpacity = lightingPreset === "night_led" ? 0.42 : lightingPreset === "showroom_warm" ? 0.28 : 0.14;
        const coveWash = new THREE.Mesh(
          new THREE.PlaneGeometry(innerSpanW, 340),
          new THREE.MeshBasicMaterial({
            map: coveWashTex,
            color: 0xffcf7a,
            transparent: true,
            opacity: washOpacity,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
          })
        );
        coveWash.rotation.x = Math.PI / 2;
        coveWash.position.set(spanW / 2, ceilH - 8, bandD + 160);
        coveWash.raycast = () => {};
        group.add(coveWash);

        const covePl = new THREE.PointLight(
          0xffca78,
          lightingPreset === "night_led" ? 2.8 : lightingPreset === "showroom_warm" ? 1.9 : 1.0,
          3200,
          0.35
        );
        covePl.castShadow = false;
        covePl.position.set(spanW / 2, ceilH - drop * 0.5, bandD + 140);
        group.add(covePl);
      }
    }

    addRecessedSpots(ceilH - drop, bandD * 0.52, Math.max(2, Math.round(spanW / 1000)));
  } else if (cfg.ceilingType === "gypsum_soffit_bulkhead") {
    const drop = Math.max(60, cfg.dropHeightMm);
    const soffitD = Math.max(300, cfg.soffitDepthMm);
    const bulkhead = new THREE.Mesh(new THREE.BoxGeometry(spanW, drop, soffitD), soffitMat);
    bulkhead.position.set(spanW / 2, ceilH - drop / 2, soffitD / 2);
    bulkhead.raycast = () => {};
    bulkhead.castShadow = false;
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
