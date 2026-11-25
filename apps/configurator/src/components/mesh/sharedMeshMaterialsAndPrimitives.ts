import * as THREE from "three";
import { ComponentGeometry } from "@birim/geometry";
import {
  markSharedGeometry,
  markSharedMaterial,
} from "../../v3/materials/webglResourceGuard";

export const box = markSharedGeometry(new THREE.BoxGeometry(1, 1, 1));
export const sphere = markSharedGeometry(new THREE.SphereGeometry(0.5, 20, 14));
export const cylinder = new THREE.CylinderGeometry(0.5, 0.5, 1, 20);
cylinder.rotateX(Math.PI / 2);
markSharedGeometry(cylinder);
export const cylinderY = markSharedGeometry(new THREE.CylinderGeometry(0.5, 0.5, 1, 20));
export const edges = markSharedGeometry(new THREE.EdgesGeometry(box));
export const cylinderRimEdges = markSharedGeometry(new THREE.EdgesGeometry(cylinder, 28));

export const liftDoorDirectionGeo = (() => {
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    "position",
    new THREE.BufferAttribute(
      new Float32Array([-0.46, -0.45, 0.52, 0.0, 0.45, 0.52, 0.0, 0.45, 0.52, 0.46, -0.45, 0.52]),
      3
    )
  );
  return markSharedGeometry(g);
})();

export const leftDoorDirectionGeo = (() => {
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    "position",
    new THREE.BufferAttribute(
      new Float32Array([-0.48, 0.46, 0.52, 0.45, 0.0, 0.52, 0.45, 0.0, 0.52, -0.48, -0.46, 0.52]),
      3
    )
  );
  return markSharedGeometry(g);
})();

export const rightDoorDirectionGeo = (() => {
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    "position",
    new THREE.BufferAttribute(
      new Float32Array([0.48, 0.46, 0.52, -0.45, 0.0, 0.52, -0.45, 0.0, 0.52, 0.48, -0.46, 0.52]),
      3
    )
  );
  return markSharedGeometry(g);
})();


export const darkDamperMat = new THREE.MeshStandardMaterial({
  color: 0x1e293b,
  roughness: 0.32,
  metalness: 0.65,
});
export const screwHeadMat = new THREE.MeshStandardMaterial({
  color: 0x94a3b8,
  roughness: 0.2,
  metalness: 0.92,
});
export const chromeHardwareMat = new THREE.MeshStandardMaterial({
  color: 0xe2e8f0,
  roughness: 0.16,
  metalness: 0.94,
});
export const blumAccentMat = new THREE.MeshStandardMaterial({
  color: 0xea580c,
  roughness: 0.3,
  metalness: 0.2,
});
export const darkCavityMat = new THREE.MeshStandardMaterial({
  color: 0x09090b,
  roughness: 0.85,
  metalness: 0.1,
});
export const burnerRingMat = new THREE.MeshBasicMaterial({
  color: 0xef4444,
});
export const handleAccentMat = new THREE.MeshStandardMaterial({
  color: 0xd97706,
  roughness: 0.22,
  metalness: 0.88,
});
export const revealShadowMat = new THREE.LineBasicMaterial({
  color: 0x1c1917,
  transparent: true,
  opacity: 0.34,
});
export const doorDirectionLineMat = new THREE.LineBasicMaterial({
  color: 0x64748b,
  transparent: true,
  opacity: 0.55,
});

export const sharedDarkAnodizedFrameMat = markSharedMaterial(
  new THREE.MeshStandardMaterial({
    color: 0x1e2024,
    roughness: 0.34,
    metalness: 0.85,
  })
);
export const sharedSmokedGlassPaneMat = markSharedMaterial(
  new THREE.MeshPhysicalMaterial({
    color: 0x242c35,
    roughness: 0.04,
    metalness: 0.12,
    transmission: 0,
    ior: 1.52,
    reflectivity: 0.98,
    clearcoat: 0.9,
    clearcoatRoughness: 0.03,
    envMapIntensity: 1.65,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  })
);
export const sharedBronzeMirrorPaneMat = markSharedMaterial(
  new THREE.MeshPhysicalMaterial({
    color: 0xcbb69e,
    roughness: 0.02,
    metalness: 0.98,
    clearcoat: 1.0,
    clearcoatRoughness: 0.015,
    envMapIntensity: 1.6,
  })
);
export const sharedSilverMirrorPaneMat = markSharedMaterial(
  new THREE.MeshPhysicalMaterial({
    color: 0xe6eaef,
    roughness: 0.02,
    metalness: 0.98,
    clearcoat: 1.0,
    clearcoatRoughness: 0.015,
    envMapIntensity: 1.6,
  })
);
export const fugaShadowGapMat = markSharedMaterial(
  new THREE.MeshStandardMaterial({
    color: 0x0e0d0c,
    roughness: 0.96,
    metalness: 0.0,
  })
);

[
  darkDamperMat,
  screwHeadMat,
  chromeHardwareMat,
  blumAccentMat,
  darkCavityMat,
  burnerRingMat,
  handleAccentMat,
  revealShadowMat,
  doorDirectionLineMat,
].forEach((m) => markSharedMaterial(m));

export const customAccentMaterials = new Set<THREE.Material>([
  darkDamperMat,
  screwHeadMat,
  chromeHardwareMat,
  blumAccentMat,
  darkCavityMat,
  burnerRingMat,
  handleAccentMat,
  sharedSmokedGlassPaneMat,
  sharedBronzeMirrorPaneMat,
  sharedSilverMirrorPaneMat,
  fugaShadowGapMat,
]);

export function tagSubMesh(
  mesh: THREE.Mesh,
  userData: Record<string, unknown>,
  comp: ComponentGeometry
) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const isCustomMat =
    ! Array.isArray(mesh.material) && customAccentMaterials.has(mesh.material);
  mesh.userData = {
    ...userData,
    parentComponentId: comp.parentComponentId,
    handleCategory: comp.handleCategory,
    preserveCustomMaterial: isCustomMat,
  };
}

/**
 * Shared unit geometry with realistic multi-part 3D mechanical assemblies for:
 * - True 2-Part Concealed Hinges (Carcass plate stays stationary on side panel while Ø35mm cup rotates with door + articulated link arm)
 * - Blum AVENTOS HK / HL / HF Lift-Up Power Storage Units & Telescopic Arms
 * - Gola Extruded L/C Channels, J-Pull Milled Door Cutouts, Recessed Finger Pockets & Edge Profiles
 * - Stainless Steel Undermount Sink + Swan-Neck Faucet & 4-Zone Induction Cooktop
 */
export function disableLineRaycast(obj: THREE.Object3D) {
  obj.traverse((child) => {
    if (child instanceof THREE.Line || child instanceof THREE.LineSegments) {
      child.raycast = () => {};
    }
  });
}


export function publishSceneDiagnostics(canvas: HTMLCanvasElement, scene: THREE.Object3D) {
  if (!new URLSearchParams(window.location.search).has("audit")) return;
  scene.updateMatrixWorld(true);
  const meshes: unknown[] = [];
  scene.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh) || !obj.userData.componentId) return;
    const point = obj.getWorldPosition(new THREE.Vector3());
    meshes.push({
      id: obj.userData.componentId,
      role: obj.userData.role,
      parent: obj.userData.parentComponentId,
      category: obj.userData.handleCategory,
      center: point.toArray(),
      matrix: obj.matrixWorld.toArray(),
      scale: obj.scale.toArray(),
      materialId: obj.userData.matDef?.id,
      color: (obj.material as THREE.MeshPhysicalMaterial).color?.getHexString(),
      geometry: obj.geometry.type,
    });
  });
  canvas.dataset.scene = JSON.stringify(meshes);
}

let cachedContactShadowMat: THREE.MeshBasicMaterial | null = null;
export function getBakedContactShadowMaterial(): THREE.MeshBasicMaterial | null {
  if (typeof document === "undefined") return null;
  if (cachedContactShadowMat) return cachedContactShadowMat;
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, size, size);
  // Soft two-tier ambient occlusion contact shadow (tight dark core under plinth + soft outer falloff)
  const drawSoftRect = (pad: number, alpha: number, blurPx: number) => {
    ctx.save();
    ctx.filter = `blur(${blurPx}px)`;
    ctx.fillStyle = `rgba(18, 16, 14, ${alpha})`;
    ctx.fillRect(pad, pad, size - pad * 2, size - pad * 2);
    ctx.restore();
  };
  drawSoftRect(34, 0.22, 22);
  drawSoftRect(46, 0.34, 10);
  drawSoftRect(54, 0.28, 4);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  cachedContactShadowMat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    opacity: 0.85,
  });
  return cachedContactShadowMat;
}

let cachedInteriorAoMat: THREE.MeshBasicMaterial | null = null;
export function getBakedInteriorAoMaterial(): THREE.MeshBasicMaterial | null {
  if (typeof document === "undefined") return null;
  if (cachedInteriorAoMat) return cachedInteriorAoMat;
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, size, size);
  // Subtle perimeter vignette darkening inside cabinet corners (baked crevice AO, 0 FPS cost)
  const topG = ctx.createLinearGradient(0, 0, 0, size * 0.26);
  topG.addColorStop(0, "rgba(22, 19, 16, 0.22)");
  topG.addColorStop(1, "rgba(22, 19, 16, 0)");
  ctx.fillStyle = topG;
  ctx.fillRect(0, 0, size, size * 0.26);

  const botG = ctx.createLinearGradient(0, size, 0, size * 0.78);
  botG.addColorStop(0, "rgba(22, 19, 16, 0.18)");
  botG.addColorStop(1, "rgba(22, 19, 16, 0)");
  ctx.fillStyle = botG;
  ctx.fillRect(0, size * 0.78, size, size * 0.22);

  const leftG = ctx.createLinearGradient(0, 0, size * 0.18, 0);
  leftG.addColorStop(0, "rgba(22, 19, 16, 0.16)");
  leftG.addColorStop(1, "rgba(22, 19, 16, 0)");
  ctx.fillStyle = leftG;
  ctx.fillRect(0, 0, size * 0.18, size);

  const rightG = ctx.createLinearGradient(size, 0, size * 0.82, 0);
  rightG.addColorStop(0, "rgba(22, 19, 16, 0.16)");
  rightG.addColorStop(1, "rgba(22, 19, 16, 0)");
  ctx.fillStyle = rightG;
  ctx.fillRect(size * 0.82, 0, size * 0.18, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  cachedInteriorAoMat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    opacity: 0.9,
  });
  return cachedInteriorAoMat;
}
