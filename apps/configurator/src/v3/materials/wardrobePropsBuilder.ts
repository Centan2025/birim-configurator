import * as THREE from "three";
import {
  createReadyMadeHangingGarmentGroup,
  createReadyMadeShoePairGroup,
  createReadyMadeFoldedTextileGroup,
  createReadyMadeShelfAccessoryGroup,
} from "./wardrobeGlbAssetLoader";

/**
 * Ready-Made 3D .GLB Wardrobe Interior Accessories Bridge (V6.5):
 * Delegates 100% to verified ready-made 3D .GLB models loaded via GLTFLoader + DRACOLoader
 * with strict 3-axis cabinet containment, non-overlapping hanger slots, and vertex-measured collar fit.
 */

export function createSculptedHangingShirtGroup(
  variantIndex: number,
  garmentHeightMm = 820,
  cabinetDepthMm = 490,
  maxSlotWidthMm = 146
): THREE.Group {
  return createReadyMadeHangingGarmentGroup(
    variantIndex,
    garmentHeightMm,
    cabinetDepthMm,
    maxSlotWidthMm
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

export function createSculptedShoePairGroup(
  variantIndex = 0,
  maxDepthMm = 320
): THREE.Group {
  return createReadyMadeShoePairGroup(variantIndex, maxDepthMm);
}
