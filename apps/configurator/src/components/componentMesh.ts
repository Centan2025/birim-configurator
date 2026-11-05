import * as THREE from "three";
import { calculateModulePlacement, ModuleInstance } from "@birim/core";
import { ComponentGeometry } from "@birim/geometry";

const box = new THREE.BoxGeometry(1, 1, 1);
const sphere = new THREE.SphereGeometry(0.5, 16, 10);
const cylinder = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
cylinder.rotateX(Math.PI / 2);
const edges = new THREE.EdgesGeometry(box);

/** Shared unit geometry: component transforms are explicit, never inferred from labels. */
export function createComponentMesh(comp: ComponentGeometry, material: THREE.Material, edgeMaterial: THREE.Material, userData: Record<string, unknown>): THREE.Group {
  const group = new THREE.Group();
  const pivot = comp.pivot ?? comp.position;
  group.position.set(pivot.x, pivot.y, pivot.z);
  if (comp.rotation) group.rotation.set(...comp.rotation);
  const mesh = new THREE.Mesh(comp.primitive === "sphere" ? sphere : comp.primitive === "cylinder" ? cylinder : box, material);
  mesh.scale.set(comp.dimensions.width, comp.dimensions.height, comp.dimensions.depth);
  mesh.position.set(comp.position.x - pivot.x + comp.dimensions.width / 2, comp.position.y - pivot.y + comp.dimensions.height / 2, comp.position.z - pivot.z + comp.dimensions.depth / 2);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { ...userData, parentComponentId: comp.parentComponentId, handleCategory: comp.handleCategory };
  if (!comp.primitive || comp.primitive === "box") mesh.add(new THREE.LineSegments(edges, edgeMaterial));
  group.add(mesh);
  return group;
}

/** Opt-in local QA evidence from actual rendered mesh transforms, not a second model. */
export function publishSceneDiagnostics(canvas: HTMLCanvasElement, scene: THREE.Object3D) {
  if (!new URLSearchParams(window.location.search).has("audit")) return;
  scene.updateMatrixWorld(true);
  const meshes: unknown[] = [];
  scene.traverse(obj => {
    if (!(obj instanceof THREE.Mesh) || !obj.userData.componentId) return;
    const point = obj.getWorldPosition(new THREE.Vector3());
    meshes.push({ id: obj.userData.componentId, role: obj.userData.role, parent: obj.userData.parentComponentId,
      category: obj.userData.handleCategory, center: point.toArray(), matrix: obj.matrixWorld.toArray(), scale: obj.scale.toArray(), materialId: obj.userData.matDef?.id, color: (obj.material as THREE.MeshPhysicalMaterial).color?.getHexString(), geometry: obj.geometry.type });
  });
  canvas.dataset.scene = JSON.stringify(meshes);
}

export function createModuleGroup(module: ModuleInstance) {
  const placement = calculateModulePlacement(module);
  const group = new THREE.Group();
  group.position.set(placement.origin.x, placement.origin.y, placement.origin.z);
  group.rotation.y = placement.rotationYRad;
  return group;
}
