import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const BATCHABLE_CARCASS_ROLES = new Set<string>([
  "carcass_side_left",
  "carcass_side_right",
  "carcass_top",
  "carcass_bottom",
  "carcass_back",
  "carcass_plinth",
  "carcass_divider",
]);

/**
 * Aktif olmayan (seçili/düzenlenmeyen) modüllerdeki aynı materyalli statik gövde panellerini
 * (yan dikme, üst/alt tabla, arkalık, baza, sabit dikme) tek bir `THREE.Mesh` içinde birleştirir.
 *
 * - Aktif modülde çağrılmaz; böylece tekil parça seçimi, boya fırçası ve kesit/sürükleme %100 korunur.
 * - 50 modüllü sahnelerde statik gövde draw call sayısını modül başına 6-9'dan 1-2'ye düşürür.
 */
export function batchStaticModuleCarcassMeshes(
  modContainer: THREE.Group,
  moduleIndex: number
): number {
  modContainer.updateMatrixWorld(true);
  const invContainer = new THREE.Matrix4().copy(modContainer.matrixWorld).invert();

  const groupsByMat = new Map<
    string,
    { material: THREE.Material; meshes: THREE.Mesh[]; roles: string[] }
  >();

  modContainer.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh) || obj instanceof THREE.InstancedMesh) return;
    if (!obj.visible) return;
    if (Array.isArray(obj.material)) return;
    if (obj.userData?.isStaticCarcassBatch || obj.userData?.isResizeHandle3D) return;

    const role = String(obj.userData?.role || obj.parent?.userData?.role || "");
    if (!BATCHABLE_CARCASS_ROLES.has(role)) return;

    const geo = obj.geometry;
    if (!(geo instanceof THREE.BufferGeometry)) return;
    if (!geo.attributes.position || !geo.attributes.normal) return;

    const matKey = `${obj.material.uuid}|${obj.castShadow ? 1 : 0}|${obj.receiveShadow ? 1 : 0}`;
    let bucket = groupsByMat.get(matKey);
    if (!bucket) {
      bucket = { material: obj.material, meshes: [], roles: [] };
      groupsByMat.set(matKey, bucket);
    }
    bucket.meshes.push(obj);
    bucket.roles.push(role);
  });

  let savedDrawCalls = 0;
  const relMatrix = new THREE.Matrix4();

  for (const bucket of groupsByMat.values()) {
    if (bucket.meshes.length < 2) continue;

    const prepared: THREE.BufferGeometry[] = [];
    let compatible = true;
    const hasUv = Boolean(bucket.meshes[0].geometry.attributes.uv);

    for (const m of bucket.meshes) {
      if (Boolean(m.geometry.attributes.uv) !== hasUv) {
        compatible = false;
        break;
      }
      const cloned = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      // Normalize attribute set so mergeGeometries never fails on mismatched optional attributes
      for (const attrName of Object.keys(cloned.attributes)) {
        if (attrName !== "position" && attrName !== "normal" && attrName !== "uv") {
          cloned.deleteAttribute(attrName);
        }
      }
      relMatrix.multiplyMatrices(invContainer, m.matrixWorld);
      cloned.applyMatrix4(relMatrix);
      prepared.push(cloned);
    }

    if (!compatible || prepared.length < 2) {
      for (const g of prepared) g.dispose();
      continue;
    }

    const merged = mergeGeometries(prepared, false);
    for (const g of prepared) g.dispose();
    if (!merged) continue;

    const refMesh = bucket.meshes[0];
    const batchedMesh = new THREE.Mesh(merged, bucket.material);
    batchedMesh.castShadow = refMesh.castShadow;
    batchedMesh.receiveShadow = refMesh.receiveShadow;
    batchedMesh.userData = {
      isStaticCarcassBatch: true,
      moduleIndex,
      role: bucket.roles[0] || "carcass_side_left",
      componentId: refMesh.userData?.componentId || refMesh.parent?.userData?.componentId || `static_carcass_${moduleIndex}`,
    };

    for (const m of bucket.meshes) {
      m.visible = false;
    }
    modContainer.add(batchedMesh);
    savedDrawCalls += bucket.meshes.length - 1;
  }

  return savedDrawCalls;
}
