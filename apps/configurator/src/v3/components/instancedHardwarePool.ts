import * as THREE from "three";

/**
 * Shared Geometry & Material Cache + InstancedMesh builders for high-count
 * repetitive cabinet hardware (System 32 shelf-pin holes, Ø5mm metal pins,
 * Euro screws, and hinge cup bodies). Reduces hundreds of individual WebGL
 * draw calls down to 1–2 InstancedMesh draw calls per module.
 */

interface SharedHardwareAssets {
  holeGeo: THREE.CylinderGeometry;
  pinStemGeo: THREE.CylinderGeometry;
  pinCollarGeo: THREE.CylinderGeometry;
  holeMat: THREE.MeshStandardMaterial;
  pinMetalMat: THREE.MeshStandardMaterial;
}

let cachedAssets: SharedHardwareAssets | null = null;

function getSharedHardwareAssets(): SharedHardwareAssets {
  if (cachedAssets) return cachedAssets;

  // Ø5mm System 32 bore hole recess (oriented along X axis for side panels)
  const holeGeo = new THREE.CylinderGeometry(2.5, 2.5, 1.4, 8);
  holeGeo.rotateZ(Math.PI / 2);

  // Ø5mm steel shelf pin stem
  const pinStemGeo = new THREE.CylinderGeometry(2.4, 2.4, 14, 10);
  pinStemGeo.rotateZ(Math.PI / 2);

  // Steel pin collar/stop
  const pinCollarGeo = new THREE.CylinderGeometry(4.0, 4.0, 2.2, 10);
  pinCollarGeo.rotateZ(Math.PI / 2);

  const holeMat = new THREE.MeshStandardMaterial({
    color: 0x3b352e,
    roughness: 0.92,
    metalness: 0.05,
  });

  const pinMetalMat = new THREE.MeshStandardMaterial({
    color: 0xd8dce0,
    roughness: 0.24,
    metalness: 0.88,
  });

  cachedAssets = {
    holeGeo,
    pinStemGeo,
    pinCollarGeo,
    holeMat,
    pinMetalMat,
  };
  return cachedAssets;
}

export interface InstancedPoint3D {
  x: number;
  y: number;
  z: number;
}

/**
 * Builds a single-draw-call InstancedMesh for all System 32 bore holes across a module.
 */
export function createInstancedSystem32Holes(
  points: readonly InstancedPoint3D[],
  name = "instanced_system32_holes"
): THREE.InstancedMesh | null {
  if (!points.length) return null;
  const { holeGeo, holeMat } = getSharedHardwareAssets();
  const mesh = new THREE.InstancedMesh(holeGeo, holeMat, points.length);
  mesh.name = name;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = true;

  const dummy = new THREE.Object3D();
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i];
    dummy.position.set(p.x, p.y, p.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}

/**
 * Builds a single-draw-call InstancedMesh group for Ø5mm metallic shelf support pins.
 */
export function createInstancedShelfPins(
  points: readonly InstancedPoint3D[],
  name = "instanced_shelf_pins"
): THREE.Group | null {
  if (!points.length) return null;
  const { pinStemGeo, pinCollarGeo, pinMetalMat } = getSharedHardwareAssets();
  const group = new THREE.Group();
  group.name = name;

  const stems = new THREE.InstancedMesh(pinStemGeo, pinMetalMat, points.length);
  const collars = new THREE.InstancedMesh(pinCollarGeo, pinMetalMat, points.length);
  stems.castShadow = false;
  stems.receiveShadow = true;
  collars.castShadow = false;
  collars.receiveShadow = true;

  const dummy = new THREE.Object3D();
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i];
    dummy.position.set(p.x, p.y, p.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    stems.setMatrixAt(i, dummy.matrix);
    collars.setMatrixAt(i, dummy.matrix);
  }
  stems.instanceMatrix.needsUpdate = true;
  collars.instanceMatrix.needsUpdate = true;
  stems.computeBoundingSphere();
  collars.computeBoundingSphere();

  group.add(stems, collars);
  return group;
}

/**
 * Disposes shared cached GPU assets when the entire 3D viewport unmounts permanently.
 */
export function disposeSharedHardwarePool(): void {
  if (!cachedAssets) return;
  cachedAssets.holeGeo.dispose();
  cachedAssets.pinStemGeo.dispose();
  cachedAssets.pinCollarGeo.dispose();
  cachedAssets.holeMat.dispose();
  cachedAssets.pinMetalMat.dispose();
  cachedAssets = null;
}
