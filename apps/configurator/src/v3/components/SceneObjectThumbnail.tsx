"use client";

import React, { useEffect, useState } from "react";
import * as THREE from "three";
import {
  createSceneObjectInstanceFromCatalog,
  type SceneObjectCatalogItem,
} from "@birim/catalog";
import {
  buildSceneObject3DGroup,
  subscribeSceneObjectGlbLoaded,
} from "../materials/sceneObject3DBuilder";

interface SceneObjectThumbnailProps {
  item: Pick<SceneObjectCatalogItem, "catalogId" | "name" | "primaryColorHex">;
  className?: string;
}

const THUMB_W = 240;
const THUMB_H = 192;
const thumbnailCache = new Map<string, string>();

let sharedThumbRenderer: THREE.WebGLRenderer | null = null;
let sharedThumbScene: THREE.Scene | null = null;
let sharedThumbCamera: THREE.PerspectiveCamera | null = null;

function getThumbRig(): {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
} | null {
  if (typeof window === "undefined") return null;
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
    renderer.toneMappingExposure = 1.15;

    const scene = new THREE.Scene();
    const hemi = new THREE.HemisphereLight("#ffffff", "#d6d3d1", 1.35);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight("#fffaf0", 1.85);
    keyLight.position.set(1800, 2600, 2200);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight("#e0f2fe", 0.75);
    fillLight.position.set(-1800, 900, 1200);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight("#ffffff", 0.55);
    rimLight.position.set(400, 1400, -1800);
    scene.add(rimLight);

    const camera = new THREE.PerspectiveCamera(30, THUMB_W / THUMB_H, 1, 50000);

    sharedThumbRenderer = renderer;
    sharedThumbScene = scene;
    sharedThumbCamera = camera;
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

function renderCatalogThumbnail(catalogId: string): string | null {
  const rig = getThumbRig();
  if (!rig) return null;

  const instance = createSceneObjectInstanceFromCatalog(catalogId, {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
  });
  if (!instance) return null;

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
  } finally {
    scene.remove(group);
  }

  return dataUrl;
}

export const SceneObjectThumbnail: React.FC<SceneObjectThumbnailProps> = React.memo(
  ({ item, className = "w-full h-full object-contain" }) => {
    const [src, setSrc] = useState<string | null>(
      () => thumbnailCache.get(item.catalogId) ?? null
    );

    useEffect(() => {
      let cancelled = false;
      const renderNow = () => {
        const url =
          thumbnailCache.get(item.catalogId) ??
          renderCatalogThumbnail(item.catalogId);
        if (!cancelled && url) {
          setSrc((prev) => (prev === url ? prev : url));
        }
      };

      const raf = requestAnimationFrame(renderNow);
      const unsub = subscribeSceneObjectGlbLoaded(() => {
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
