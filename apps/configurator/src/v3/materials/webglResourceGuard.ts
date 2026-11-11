import * as THREE from "three";

const SHARED_RESOURCE_FLAG = "__birimSharedResource";

export function markSharedGeometry<T extends THREE.BufferGeometry>(geometry: T): T {
  geometry.userData = { ...geometry.userData, [SHARED_RESOURCE_FLAG]: true };
  return geometry;
}

export function markSharedMaterial<T extends THREE.Material>(material: T): T {
  material.userData = { ...material.userData, [SHARED_RESOURCE_FLAG]: true };
  return material;
}

export function markSharedTexture<T extends THREE.Texture>(texture: T): T {
  texture.userData = { ...texture.userData, [SHARED_RESOURCE_FLAG]: true };
  return texture;
}

export function isSharedWebGLResource(
  resource: { userData?: Record<string, unknown> } | null | undefined
): boolean {
  return Boolean(resource?.userData?.[SHARED_RESOURCE_FLAG]);
}

function disposeMaterialSafely(mat: THREE.Material | null | undefined): void {
  if (!mat || isSharedWebGLResource(mat)) return;
  const record = mat as unknown as Record<string, unknown>;
  const textureKeys = [
    "map",
    "bumpMap",
    "normalMap",
    "roughnessMap",
    "metalnessMap",
    "aoMap",
    "alphaMap",
    "emissiveMap",
  ];
  for (const key of textureKeys) {
    const candidate = record[key];
    if (candidate instanceof THREE.Texture && !isSharedWebGLResource(candidate)) {
      candidate.dispose();
    }
  }
  mat.dispose();
}

/**
 * Traverses an Object3D subtree, disposes all non-shared BufferGeometries, EdgesGeometries,
 * Materials, and owned Textures from GPU VRAM, and clears the container's children.
 */
export function disposeObject3DTree(root: THREE.Object3D | null | undefined): void {
  if (!root) return;
  const geometriesToDispose = new Set<THREE.BufferGeometry>();
  const materialsToDispose = new Set<THREE.Material>();

  root.traverse((obj) => {
    if (
      obj instanceof THREE.Mesh ||
      obj instanceof THREE.Line ||
      obj instanceof THREE.LineSegments ||
      obj instanceof THREE.Points
    ) {
      if (obj.geometry && !isSharedWebGLResource(obj.geometry)) {
        geometriesToDispose.add(obj.geometry);
      }
      if (Array.isArray(obj.material)) {
        obj.material.forEach((m) => {
          if (m && !isSharedWebGLResource(m)) materialsToDispose.add(m);
        });
      } else if (obj.material && !isSharedWebGLResource(obj.material)) {
        materialsToDispose.add(obj.material);
      }
    }
  });

  geometriesToDispose.forEach((geo) => geo.dispose());
  materialsToDispose.forEach((mat) => disposeMaterialSafely(mat));
  root.clear();
}

/**
 * Attaches WebGL context-loss & restoration handlers so GPU driver resets or background tab
 * eviction recover gracefully instead of leaving a dead white canvas.
 */
export function attachWebGLContextRecovery(
  canvas: HTMLCanvasElement,
  callbacks: {
    onContextLost?: () => void;
    onContextRestored?: () => void;
  }
): () => void {
  const handleLost = (event: Event) => {
    event.preventDefault();
    callbacks.onContextLost?.();
  };
  const handleRestored = () => {
    callbacks.onContextRestored?.();
  };

  canvas.addEventListener("webglcontextlost", handleLost, false);
  canvas.addEventListener("webglcontextrestored", handleRestored, false);

  return () => {
    canvas.removeEventListener("webglcontextlost", handleLost, false);
    canvas.removeEventListener("webglcontextrestored", handleRestored, false);
  };
}
