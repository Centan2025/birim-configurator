import * as THREE from "three";
import {
  createReadyMadeHangingGarmentGroup,
  createReadyMadeShoePairGroup,
  createReadyMadeFoldedTextileGroup,
  createReadyMadeShelfAccessoryGroup,
} from "./wardrobeGlbAssetLoader";

/**
 * Ready-Made 3D .GLB Wardrobe Interior Accessories Bridge (V6.2):
 * Per user requirement ("ceket ayakkabı gömlek içi gibi iç aksesuarlar için sitelerden hazır düzgün modeller bul, sen çizme"),
 * all procedural hand-drawn clothing, rods, sleeves, boxes, and footwear primitives have been completely removed
 * and delegated 100% to verified ready-made 3D .GLB models loaded via GLTFLoader + DRACOLoader in wardrobeGlbAssetLoader.ts.
 */

export function createSculptedHangingShirtGroup(
  variantIndex: number,
  garmentHeightMm = 880,
  cabinetDepthMm = 520
): THREE.Group {
  return createReadyMadeHangingGarmentGroup(
    variantIndex,
    garmentHeightMm,
    cabinetDepthMm
  );
}

export function createFoldedKnitwearStackGroup(
  widthMm = 270,
  depthMm = 290,
  layers = 2,
  variantIndex = 0
): THREE.Group {
  return createReadyMadeFoldedTextileGroup(
    widthMm,
    depthMm,
    layers,
    variantIndex
  );
}

let rollingAccessorySeed = 0;

export function createLiddedStorageBoxGroup(
  widthMm = 280,
  heightMm = 145,
  depthMm = 290
): THREE.Group {
  rollingAccessorySeed = (rollingAccessorySeed + 1) % 12;
  return createReadyMadeShelfAccessoryGroup(
    widthMm,
    heightMm,
    depthMm,
    rollingAccessorySeed
  );
}

export function createSculptedShoePairGroup(variantIndex = 0): THREE.Group {
  return createReadyMadeShoePairGroup(variantIndex);
}
