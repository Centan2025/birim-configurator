import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const BATCHABLE_STRUCTURAL_AND_INTERIOR_ROLES = new Set<string>([
  "carcass_side_left",
  "carcass_side_right",
  "carcass_top",
  "carcass_bottom",
  "carcass_back",
  "carcass_plinth",
  "carcass_divider",
  "carcass_stretcher",
  "plinth",
  "end_panel",
  "countertop",
  "shelf",
  "shelf_fixed",
  "sub_divider",
  "carcass_sub_divider",
  "hanging_rail",
  "gola_profile",
]);

const BATCHABLE_CLOSED_KINEMATIC_ROLES = new Set<string>([
  "door_left",
  "door_right",
  "door_single",
  "door_sliding",
  "door_lift",
  "door_handle",
  "drawer_front",
  "drawer_box",
  "drawer_back",
  "drawer_bottom",
  "drawer_side_left",
  "drawer_side_right",
  "drawer_handle",
  "drawer_slide",
  "door_hinge",
]);

export interface BatchedPartFaceRange {
  faceStart: number;
  faceEnd: number;
  sourceMesh: THREE.Mesh;
}

export interface BatchStaticModuleOptions {
  /**
   * Kapak/çekmece/patlatma sürgüleri kapalıyken (`0`) inaktif modüllerin kapak,
   * çekmece, kulp ve menteşelerini de malzeme bazında birleştirerek 50 modülde
   * draw call sayısını ~1.158'den <150 seviyesine indirir.
   */
  includeInteriorAndClosedFronts?: boolean;
}

function resolveInheritedMeshMetadata(mesh: THREE.Mesh, moduleIndex: number): void {
  let cursor: THREE.Object3D | null = mesh;
  let componentId: string | undefined;
  let role: string | undefined;
  let bayIndex: number | undefined;
  let label: string | undefined;

  while (cursor) {
    const ud = cursor.userData;
    if (ud) {
      if (componentId === undefined && typeof ud.componentId === "string") componentId = ud.componentId;
      if (role === undefined && typeof ud.role === "string") role = ud.role;
      if (bayIndex === undefined && typeof ud.bayIndex === "number") bayIndex = ud.bayIndex;
      if (label === undefined && typeof ud.label === "string") label = ud.label;
    }
    if (cursor.userData?.isModuleRoot) break;
    cursor = cursor.parent;
  }

  mesh.userData = mesh.userData || {};
  if (componentId !== undefined && mesh.userData.componentId === undefined) {
    mesh.userData.componentId = componentId;
  }
  if (role !== undefined && mesh.userData.role === undefined) {
    mesh.userData.role = role;
  }
  if (bayIndex !== undefined && mesh.userData.bayIndex === undefined) {
    mesh.userData.bayIndex = bayIndex;
  }
  if (label !== undefined && mesh.userData.label === undefined) {
    mesh.userData.label = label;
  }
  if (typeof mesh.userData.moduleIndex !== "number") {
    mesh.userData.moduleIndex = moduleIndex;
  }
}

export function findBatchedSourceMeshByFaceIndex(
  ranges: ReadonlyArray<BatchedPartFaceRange>,
  faceIndex: number | undefined | null
): THREE.Mesh | null {
  if (typeof faceIndex !== "number" || faceIndex < 0 || ranges.length === 0) {
    return ranges[0]?.sourceMesh ?? null;
  }
  let lo = 0;
  let hi = ranges.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const item = ranges[mid];
    if (faceIndex < item.faceStart) {
      hi = mid - 1;
    } else if (faceIndex >= item.faceEnd) {
      lo = mid + 1;
    } else {
      return item.sourceMesh;
    }
  }
  return ranges[0]?.sourceMesh ?? null;
}

/**
 * Birleştirilmiş (`isStaticCarcassBatch`) modül grubunu orijinal tekil `THREE.Mesh`
 * görünürlüğüne geri döndürür ve geçici birleştirilmiş `BufferGeometry` belleğini temizler.
 * Aktif modül değiştiğinde veya malzeme fast-path güncellemesi öncesinde çağrılır.
 */
export function unbatchStaticModuleMeshes(modContainer: THREE.Group): number {
  let restoredCount = 0;
  const toRemove: THREE.Mesh[] = [];

  for (const child of modContainer.children) {
    if (child instanceof THREE.Mesh && child.userData?.isStaticCarcassBatch) {
      const hiddenSources = child.userData.batchedSourceMeshes as THREE.Mesh[] | undefined;
      if (Array.isArray(hiddenSources)) {
        for (const src of hiddenSources) {
          src.visible = true;
          delete src.userData.__hiddenByStaticBatch;
          restoredCount += 1;
        }
      }
      toRemove.push(child);
    }
  }

  if (toRemove.length === 0) {
    return 0;
  }

  for (const batchMesh of toRemove) {
    modContainer.remove(batchMesh);
    if (batchMesh.geometry && !batchMesh.geometry.userData?.__isSharedGeometry) {
      batchMesh.geometry.dispose();
    }
  }

  return restoredCount;
}

/**
 * Aktif olmayan (seçili/düzenlenmeyen) modüllerdeki aynı materyalli statik gövde,
 * iç donatı ve (kinematik kapalıyken) kapak/çekmece/kulp parçalarını tek `THREE.Mesh`
 * içinde birleştirir.
 *
 * - Özel `faceIndex -> sourceMesh` ikili arama (O(log k)) raycast delegasyonu sayesinde
 *   inaktif modülün herhangi bir kapağına, rafına, çekmecesine veya kulpuna tıklandığında /
 *   üzerine gelindiğinde / boya fırçası sürüldüğünde %100 orijinal tekil `sourceMesh` döner!
 * - Aktif modülde çağrılmaz; böylece tekil parça sürükleme, kesit ve X-Ray %100 korunur.
 * - 50 modüllü sahnelerde toplam draw call sayısını ~1.158'den ~110-145 bandına indirir.
 */
export function batchStaticModuleCarcassMeshes(
  modContainer: THREE.Group,
  moduleIndex: number,
  options?: BatchStaticModuleOptions
): number {
  // Idempotency guard: clear any stale batch on this container before re-batching
  unbatchStaticModuleMeshes(modContainer);

  const includeClosedFronts = options?.includeInteriorAndClosedFronts !== false;
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
    if (
      obj.userData?.isStaticCarcassBatch ||
      obj.userData?.isResizeHandle3D ||
      obj.userData?.isSelectionHelper ||
      obj.userData?.isContactShadow ||
      obj.userData?.role === "bay_compartment"
    ) {
      return;
    }

    const role = String(obj.userData?.role || obj.parent?.userData?.role || "");
    const isAllowedRole =
      BATCHABLE_STRUCTURAL_AND_INTERIOR_ROLES.has(role) ||
      (includeClosedFronts && BATCHABLE_CLOSED_KINEMATIC_ROLES.has(role));
    if (!isAllowedRole) return;

    const geo = obj.geometry;
    if (!(geo instanceof THREE.BufferGeometry)) return;
    if (!geo.attributes.position || !geo.attributes.normal) return;

    resolveInheritedMeshMetadata(obj, moduleIndex);

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
    const faceRanges: BatchedPartFaceRange[] = [];
    let currentFaceOffset = 0;
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
      const posCount = cloned.attributes.position?.count || 0;
      const triCount = Math.floor(posCount / 3);
      if (triCount <= 0) {
        cloned.dispose();
        compatible = false;
        break;
      }
      relMatrix.multiplyMatrices(invContainer, m.matrixWorld);
      cloned.applyMatrix4(relMatrix);
      prepared.push(cloned);
      faceRanges.push({
        faceStart: currentFaceOffset,
        faceEnd: currentFaceOffset + triCount,
        sourceMesh: m,
      });
      currentFaceOffset += triCount;
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
    batchedMesh.updateMatrix();
    batchedMesh.matrixAutoUpdate = false;
    batchedMesh.userData = {
      isStaticCarcassBatch: true,
      moduleIndex,
      role: bucket.roles[0] || "carcass_side_left",
      componentId:
        refMesh.userData?.componentId ||
        refMesh.parent?.userData?.componentId ||
        `static_carcass_${moduleIndex}`,
      batchedSourceMeshes: bucket.meshes,
      batchedFaceRanges: faceRanges,
    };

    // Exact per-triangle raycast delegation: returns the exact original `sourceMesh`
    // (door, shelf, drawer, handle, or panel) so hover outlines, click selection,
    // paint-bucket brush, and cross-module interior drag-drop behave 100% identically!
    batchedMesh.raycast = function (
      raycaster: THREE.Raycaster,
      intersects: THREE.Intersection[]
    ): void {
      const localHits: THREE.Intersection[] = [];
      THREE.Mesh.prototype.raycast.call(batchedMesh, raycaster, localHits);
      if (localHits.length === 0) return;
      for (let i = 0; i < localHits.length; i++) {
        const hit = localHits[i];
        const srcMesh = findBatchedSourceMeshByFaceIndex(faceRanges, hit.faceIndex);
        if (srcMesh) {
          srcMesh.updateWorldMatrix(true, false);
          intersects.push({
            ...hit,
            object: srcMesh,
          });
        } else {
          intersects.push(hit);
        }
      }
    };

    for (const m of bucket.meshes) {
      m.visible = false;
      m.userData.__hiddenByStaticBatch = true;
    }
    modContainer.add(batchedMesh);
    savedDrawCalls += bucket.meshes.length - 1;
  }

  return savedDrawCalls;
}
