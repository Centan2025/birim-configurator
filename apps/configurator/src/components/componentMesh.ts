import * as THREE from "three";
import { calculateModulePlacement, ModuleInstance } from "@birim/core";
import { ComponentGeometry } from "@birim/geometry";
import {
  getBakedContactShadowMaterial,
  publishSceneDiagnostics,
} from "./mesh/sharedMeshMaterialsAndPrimitives";
import { getCachedCountertopCutoutGeometry } from "./mesh/cachedPanelGeometries";
import { tryBuildHardwareOrFittingMesh } from "./mesh/hardwareAndFittingMeshes";
import { tryBuildOrAugmentHandleAndGolaMesh } from "./mesh/handleAndGolaMeshes";
import { buildPanelAndDoorProfileMesh } from "./mesh/panelAndDoorProfileMeshes";

export { publishSceneDiagnostics };

export function resolveCountertopCutoutMeshGeometry(
  w: number,
  h: number,
  d: number,
  hole: NonNullable<ComponentGeometry["cutoutHole"]>,
  grainCrosswise = false
) {
  return getCachedCountertopCutoutGeometry(w, h, d, hole, grainCrosswise);
}

export function createComponentMesh(
  comp: ComponentGeometry,
  material: THREE.Material,
  edgeMaterial: THREE.LineBasicMaterial,
  userData: Record<string, unknown>
): THREE.Group {
  const group = new THREE.Group();
  const pivot = comp.pivot ?? comp.position;
  group.position.set(pivot.x, pivot.y, pivot.z);
  if (comp.rotation) group.rotation.set(...comp.rotation);
  group.userData = userData;

  const cx = comp.position.x - pivot.x + comp.dimensions.width / 2;
  const cy = comp.position.y - pivot.y + comp.dimensions.height / 2;
  const cz = comp.position.z - pivot.z + comp.dimensions.depth / 2;

  const ctx = { comp, material, edgeMaterial, userData, group, cx, cy, cz };

  const hwMesh = tryBuildHardwareOrFittingMesh(ctx);
  if (hwMesh) return hwMesh;

  const handleMesh = tryBuildOrAugmentHandleAndGolaMesh(ctx);
  if (handleMesh) return handleMesh;

  return buildPanelAndDoorProfileMesh(ctx);
}

export function createModuleGroup(module: ModuleInstance) {
  const placement = calculateModulePlacement(module);
  const group = new THREE.Group();
  group.position.set(placement.origin.x, placement.origin.y, placement.origin.z);
  group.rotation.y = placement.rotationYRad;

  // Grounded Baked Floor Contact Shadow (near-zero GPU cost, anchors cabinet to floor)
  const isFloorStanding =
    module.category !== "kitchen_wall" &&
    module.category !== "complementary" &&
    (module.position?.y ?? 0) <= 50;
  if (isFloorStanding) {
    const contactMat = getBakedContactShadowMaterial();
    if (contactMat) {
      const padMm = 140;
      const planeW = module.dimensions.width + padMm * 2;
      const planeD = module.dimensions.depth + padMm * 2;
      const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(planeW, planeD), contactMat);
      shadowPlane.rotation.x = -Math.PI / 2;
      shadowPlane.position.set(module.dimensions.width / 2, 0.8, module.dimensions.depth / 2);
      shadowPlane.renderOrder = -1;
      shadowPlane.raycast = () => {};
      shadowPlane.userData = { isSelectionHelper: true, isContactShadow: true };
      group.add(shadowPlane);
    }
  }
  return group;
}
