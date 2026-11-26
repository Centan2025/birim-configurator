"use client";

import React, { useEffect, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  createSceneObjectInstanceFromCatalog,
  type SceneObjectCatalogItem,
} from "@birim/catalog";
import {
  buildSceneObject3DGroup,
  isSceneObjectGlbCached,
  resolveEffectiveSceneObjectGlbUrl,
  subscribeSceneObjectGlbLoaded,
} from "../materials/sceneObject3DBuilder";
import {
  attachWebGLContextRecovery,
  disposeObject3DTree,
  disposeWebGLRendererCleanly,
  probeWebGL2Support,
} from "../materials/webglResourceGuard";

interface SceneObjectThumbnailProps {
  item: Pick<SceneObjectCatalogItem, "catalogId" | "name" | "primaryColorHex">;
  className?: string;
}

const THUMB_W = 240;
const THUMB_H = 192;
const thumbnailCache = new Map<string, string>();
const glbThumbnailRendered = new Set<string>();

let sharedThumbRenderer: THREE.WebGLRenderer | null = null;
let sharedThumbScene: THREE.Scene | null = null;
let sharedThumbCamera: THREE.PerspectiveCamera | null = null;
let sharedThumbEnvTarget: THREE.WebGLRenderTarget | null = null;
let thumbIdleReleaseTimer: ReturnType<typeof setTimeout> | null = null;
let detachThumbContextRecovery: (() => void) | null = null;

function releaseThumbRigIfIdle(): void {
  if (thumbIdleReleaseTimer) {
    clearTimeout(thumbIdleReleaseTimer);
    thumbIdleReleaseTimer = null;
  }
  if (detachThumbContextRecovery) {
    detachThumbContextRecovery();
    detachThumbContextRecovery = null;
  }
  if (sharedThumbEnvTarget) {
    sharedThumbEnvTarget.dispose();
    sharedThumbEnvTarget = null;
  }
  if (sharedThumbScene) {
    sharedThumbScene.environment = null;
    disposeObject3DTree(sharedThumbScene);
    sharedThumbScene = null;
  }
  if (sharedThumbRenderer) {
    disposeWebGLRendererCleanly(sharedThumbRenderer);
    sharedThumbRenderer = null;
  }
  sharedThumbCamera = null;
}

function scheduleThumbRigIdleRelease(): void {
  if (thumbIdleReleaseTimer) clearTimeout(thumbIdleReleaseTimer);
  thumbIdleReleaseTimer = setTimeout(releaseThumbRigIfIdle, 15_000);
}

function getThumbRig(): {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
} | null {
  if (typeof window === "undefined") return null;
  const cap = probeWebGL2Support();
  if (!cap.supported) return null;
  if (sharedThumbRenderer && sharedThumbScene && sharedThumbCamera) {
    return {
      renderer: sharedThumbRenderer,
      scene: sharedThumbScene,
      camera: sharedThumbCamera,
    };
  }

  try {
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: "low-power",
    });
    renderer.setSize(THUMB_W, THUMB_H, false);
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmrem.fromScene(roomEnv, 0.04);
    roomEnv.dispose();
    scene.environment = envTarget.texture;
    sharedThumbEnvTarget = envTarget;
    pmrem.dispose();

    const hemi = new THREE.HemisphereLight("#ffffff", "#d6d3d1", 1.0);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight("#fffaf0", 1.45);
    keyLight.position.set(1800, 2600, 2200);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight("#e0f2fe", 0.6);
    fillLight.position.set(-1800, 900, 1200);
    scene.add(fillLight);

    const camera = new THREE.PerspectiveCamera(30, THUMB_W / THUMB_H, 1, 50000);

    sharedThumbRenderer = renderer;
    sharedThumbScene = scene;
    sharedThumbCamera = camera;
    detachThumbContextRecovery = attachWebGLContextRecovery(renderer.domElement, {
      onContextLost: () => {
        releaseThumbRigIfIdle();
      },
    });
    return { renderer, scene, camera };
  } catch {
    return null;
  }
}

function computeVisibleBounds(root: THREE.Object3D): THREE.Box3 {
  const box = new THREE.Box3();
  const childBox = new THREE.Box3();
  root.updateMatrixWorld(true);

  root.traverse((child) => {
    if (
      child instanceof THREE.Mesh &&
      child.visible &&
      !child.userData?.isSceneObjectHitbox &&
      child.geometry
    ) {
      if (!child.geometry.boundingBox) {
        child.geometry.computeBoundingBox();
      }
      if (child.geometry.boundingBox) {
        childBox.copy(child.geometry.boundingBox).applyMatrix4(child.matrixWorld);
        box.union(childBox);
      }
    }
  });
  return box;
}

function renderCatalogThumbnail(catalogId: string): {
  url: string | null;
  glbKey?: string;
  usedGlb: boolean;
} {
  const rig = getThumbRig();
  if (!rig) return { url: null, usedGlb: false };

  const instance = createSceneObjectInstanceFromCatalog(catalogId, {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
  });
  if (!instance) return { url: null, usedGlb: false };

  const glbKey = resolveEffectiveSceneObjectGlbUrl(instance);
  const usedGlb = !glbKey || isSceneObjectGlbCached(glbKey);

  const { renderer, scene, camera } = rig;
  const group = buildSceneObject3DGroup(instance, { renderer });
  scene.add(group);

  let dataUrl: string | null = null;
  try {
    const box = computeVisibleBounds(group);
    if (box.isEmpty()) {
      box.set(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(
          instance.dimensions.width,
          instance.dimensions.height,
          instance.dimensions.depth
        )
      );
    }

    const center = box.getCenter(new THREE.Vector3());
    const min = box.min;
    const max = box.max;

    const viewDir = new THREE.Vector3(0.68, 0.44, 1.0).normalize();
    const worldUp = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(worldUp, viewDir).normalize();
    const up = new THREE.Vector3().crossVectors(viewDir, right).normalize();

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;

    const corner = new THREE.Vector3();
    for (let ix = 0; ix < 2; ix++) {
      for (let iy = 0; iy < 2; iy++) {
        for (let iz = 0; iz < 2; iz++) {
          corner.set(
            ix === 0 ? min.x : max.x,
            iy === 0 ? min.y : max.y,
            iz === 0 ? min.z : max.z
          );
          corner.sub(center);
          const px = corner.dot(right);
          const py = corner.dot(up);
          const pz = corner.dot(viewDir);
          if (px < minX) minX = px;
          if (px > maxX) maxX = px;
          if (py < minY) minY = py;
          if (py > maxY) maxY = py;
          if (pz < minZ) minZ = pz;
          if (pz > maxZ) maxZ = pz;
        }
      }
    }

    const projW = Math.max(10, maxX - minX);
    const projH = Math.max(10, maxY - minY);
    const projD = Math.max(10, maxZ - minZ);

    const vFovRad = THREE.MathUtils.degToRad(camera.fov);
    const halfTanV = Math.tan(vFovRad / 2);
    const halfTanH = halfTanV * camera.aspect;
    const distV = projH / 2 / (halfTanV * 0.78);
    const distH = projW / 2 / (halfTanH * 0.78);
    const dist = Math.max(distV, distH) + projD / 2;

    camera.position.copy(center).addScaledVector(viewDir, dist);
    camera.lookAt(center);
    camera.near = Math.max(1, dist * 0.05);
    camera.far = dist * 4;
    camera.updateProjectionMatrix();

    renderer.render(scene, camera);
    dataUrl = renderer.domElement.toDataURL("image/png");
    thumbnailCache.set(catalogId, dataUrl);
    if (usedGlb) {
      glbThumbnailRendered.add(catalogId);
    }
  } finally {
    scene.remove(group);
    disposeObject3DTree(group);
    scheduleThumbRigIdleRelease();
  }

  return { url: dataUrl, glbKey, usedGlb };
}

export const SceneObjectThumbnail: React.FC<SceneObjectThumbnailProps> = React.memo(
  ({ item, className = "w-full h-full object-contain" }) => {
    const [src, setSrc] = useState<string | null>(
      () => thumbnailCache.get(item.catalogId) ?? null
    );

    useEffect(() => {
      let cancelled = false;
      let expectedGlbKey: string | undefined;

      const renderNow = () => {
        if (glbThumbnailRendered.has(item.catalogId)) {
          const cached = thumbnailCache.get(item.catalogId);
          if (cached && !cancelled) {
            setSrc((prev) => (prev === cached ? prev : cached));
          }
          return;
        }
        const res = renderCatalogThumbnail(item.catalogId);
        expectedGlbKey = res.glbKey;
        if (!cancelled && res.url) {
          setSrc((prev) => (prev === res.url ? prev : res.url));
        }
      };

      const raf = requestAnimationFrame(renderNow);
      const unsub = subscribeSceneObjectGlbLoaded((loadedKey) => {
        if (glbThumbnailRendered.has(item.catalogId)) return;
        if (loadedKey && expectedGlbKey && loadedKey !== expectedGlbKey) return;
        thumbnailCache.delete(item.catalogId);
        requestAnimationFrame(renderNow);
      });
      return () => {
        cancelled = true;
        cancelAnimationFrame(raf);
        unsub();
      };
    }, [item.catalogId]);

    if (!src) {
      return (
        <div
          className="w-8 h-8 rounded-full border border-black/10 animate-pulse"
          style={{ backgroundColor: item.primaryColorHex || "#D6D3D1" }}
          aria-hidden="true"
        />
      );
    }

    return (
      <img
        src={src}
        alt={item.name}
        className={className}
        draggable={false}
      />
    );
  }
);

SceneObjectThumbnail.displayName = "SceneObjectThumbnail";
export default SceneObjectThumbnail;
