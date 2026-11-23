"use client";

import { getBayShelfIntervalsForSubDivider } from "../adapter/useV3Adapter";
import { buildSceneObject3DGroup, subscribeSceneObjectGlbLoaded } from "../materials/sceneObject3DBuilder";
import { getActiveDraggedSceneCatalogId, setActiveDraggedSceneCatalogId, resolveModuleHostWallId, wallIntervalToModulePosition, computeRoomDynamicCenter } from "../engine/multiWallSnapAndBvhEngine";
import {
  build3DArchitecturalCeilingGroup,
  build3DModuleMultiHoleInstancedMesh,
} from "../materials/ceilingAndMultiHole3DBuilder";
import { CeilingAndEngineeringQuickPopover } from "./workspace/CeilingAndGrain2DOverlays";

import React, { useEffect, useRef, useCallback, useState, useMemo } from "react";
import * as THREE from "three";
import { getWallRoomBasis } from "../engine/angledWallSnapEngine";
import { getEffectiveSpaceWalls } from "../engine/kitchenSpatialEngine";
import {
  createComponentMesh,
  publishSceneDiagnostics,
  createModuleGroup,
} from "../../components/componentMesh";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  useV3Adapter,
  getMemoizedUnifiedEngineering,
  generateModuleGeometry,
  DEFAULT_MATERIALS,
  getModuleOrientedFootprint,
  getActiveDraggedTemplateId,
  setActiveDraggedTemplateId,
  computeRowSnapPreview,
} from "../adapter/useV3Adapter";
import {
  calculateFourSpaceDimensions,
  calculateNetInnerHeight,
  calculateBayWidths,
  calculateModulePlacement,
  evaluateUnifiedEngineeringModel,
  computeProjectGrainContinuityMap,
  syncProjectCustomMaterials,
  computeModuleStructuralSignature,
  type MaterialDefinition,
  evaluateHardwareMountPlacement,
} from "@birim/core";
import { getHardwareProductById } from "@birim/catalog";
import { GEOMETRY_ENGINE_REV } from "@birim/geometry";
import {
  computeElevationSnapTargets,
  resolveElevationSnap,
  computeBaySystem32ShelfHoleElevations,
  snapShelfToMultiHoleOrElevationTargets,
  findDraggableInteriorComponent,
  type ElevationSnapTarget,
} from "../engine/elevationSnapEngine";
import { renderSceneWithBlenderCycles } from "../engine/blenderRenderClient";
import {
  getV3PbrMaterial,
  applyMaxAnisotropyToCachedTextures,
  getStudioEnvironmentTexture,
  getStudioPmremEnvironment,
  disposeRendererPmremEnvironment,
  getArchitecturalFloorTexture,
  getArchitecturalFloorNormalMap,
  getArchitecturalWallTexture,
  getArchitecturalWallNormalMap,
  type ArchitecturalFloorStyle,
  type ArchitecturalWallTone,
} from "../materials/pbrMaterialSystem";
import { createInstancedSystem32Holes, createInstancedShelfPins, disposeSharedHardwarePool } from "./instancedHardwarePool";
import {
  markSharedGeometry,
  markSharedMaterial,
  markSharedTexture,
  disposeObject3DTree,
  attachWebGLContextRecovery,
  createSafeWebGL2Renderer,
  disposeWebGLRendererCleanly,
  type WebGL2CapabilityReport,
} from "../materials/webglResourceGuard";
import {
  buildCapsuleParametricModuleGroup,
  buildJPullCrossSectionLoop,
} from "../materials/capsuleAndProfileGeometry";
import { Software3DFallbackViewport } from "./Software3DFallbackViewport";
import {
  createSculptedHangingShirtGroup,
  createFoldedKnitwearStackGroup,
  createLiddedStorageBoxGroup,
  createSculptedShoePairGroup,
} from "../materials/wardrobePropsBuilder";
import {
  freezeStaticObject3DSubtree,
  preloadAllWardrobeGlbAssets,
  subscribeWardrobeGlbCatalogChange,
  subscribeWardrobeGlbRenderNeeded,
} from "../materials/wardrobeGlbAssetLoader";
import { WardrobeGlbLibraryModal } from "./WardrobeGlbLibraryModal";
import {
  Viewport3DContextMenu,
  type Viewport3DContextTarget,
} from "./Viewport3DContextMenu";
import { Plus, Layers, RotateCw, Columns, Ruler, Eye, EyeOff } from "lucide-react";
import { startAccessorySilhouetteDrag } from "../engine/kitchenSpatialEngine";
import { useConfiguratorStore, selectModuleBayComponentSafe } from "../../store/useConfiguratorStore";
import { generateBOMForProject } from "@birim/manufacturing";
import {
  classifyModuleArchitecturalZone,
  applyZoneMaterialToProjectDraft,
  replaceExistingMaterialAcrossProjectDraft,
  resolveEffectiveScopeForMaterial,
  resolveSmartPaintScopeForClickedRole,
  type PaintTool3DState,
  type Live3DMaterialPreviewPayload,
  type CuratedBirimMoodboard,
} from "../../v11/quickMaterialAndMoodboardEngine";


let cachedContactAoTex: THREE.CanvasTexture | null = null;
function getContactAoShadowTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  if (cachedContactAoTex) return cachedContactAoTex;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const grad = ctx.createRadialGradient(128, 128, 18, 128, 128, 126);
  grad.addColorStop(0, "rgba(10, 9, 8, 0.84)");
  grad.addColorStop(0.48, "rgba(15, 14, 12, 0.52)");
  grad.addColorStop(0.78, "rgba(20, 18, 16, 0.22)");
  grad.addColorStop(1, "rgba(20, 18, 16, 0.0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const tex = markSharedTexture(new THREE.CanvasTexture(canvas));
  tex.needsUpdate = true;
  cachedContactAoTex = tex;
  return tex;
}

const SHARED_UNIT_AO_PLANE_GEO = markSharedGeometry(new THREE.PlaneGeometry(1, 1));
const SHARED_SUBDIV_GRAB_BOX_GEO = markSharedGeometry(new THREE.BoxGeometry(1, 1, 1));
const SHARED_SUBDIV_GRAB_MAT = markSharedMaterial(
  new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    colorWrite: false,
  })
);
const SHARED_BAY_HIT_MAT = markSharedMaterial(
  new THREE.MeshBasicMaterial({
    color: 0x94a3b8,
    transparent: true,
    opacity: 0.012,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
);
let cachedCreviceTopMat: THREE.MeshBasicMaterial | null = null;
let cachedCreviceShelfMat: THREE.MeshBasicMaterial | null = null;
let cachedLeftCornerAoMat: THREE.MeshBasicMaterial | null = null;
let cachedRightCornerAoMat: THREE.MeshBasicMaterial | null = null;
const SHARED_BASE_CREVICE_MAT = markSharedMaterial(
  new THREE.MeshBasicMaterial({
    color: 0x0f0e0d,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  })
);
let cachedGroundAoMat: THREE.MeshBasicMaterial | null = null;
let cachedWallAoMat: THREE.MeshBasicMaterial | null = null;
function getCachedContactAoMaterials(aoTex: THREE.CanvasTexture) {
  if (!cachedGroundAoMat) {
    cachedGroundAoMat = markSharedMaterial(
      new THREE.MeshBasicMaterial({
        map: aoTex,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
      })
    );
  }
  if (!cachedWallAoMat) {
    cachedWallAoMat = markSharedMaterial(
      new THREE.MeshBasicMaterial({
        map: aoTex,
        transparent: true,
        opacity: 0.84,
        depthWrite: false,
      })
    );
  }
  return { groundAoMat: cachedGroundAoMat, wallAoMat: cachedWallAoMat };
}

let cachedCreviceAoTex: THREE.CanvasTexture | null = null;
function getLinearCreviceAoTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  if (cachedCreviceAoTex) return cachedCreviceAoTex;
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const grad = ctx.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, "rgba(10, 9, 8, 0.56)");
  grad.addColorStop(0.38, "rgba(12, 11, 10, 0.22)");
  grad.addColorStop(1, "rgba(12, 11, 10, 0.0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 128);
  const tex = markSharedTexture(new THREE.CanvasTexture(canvas));
  tex.needsUpdate = true;
  cachedCreviceAoTex = tex;
  return tex;
}

const cachedSideCornerAoMap = new Map<string, THREE.CanvasTexture>();
function getHorizontalCornerAoTexture(side: "left" | "right"): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const hit = cachedSideCornerAoMap.get(side);
  if (hit) return hit;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const grad =
    side === "left"
      ? ctx.createLinearGradient(0, 0, 128, 0)
      : ctx.createLinearGradient(128, 0, 0, 0);
  grad.addColorStop(0, "rgba(10, 9, 8, 0.46)");
  grad.addColorStop(0.36, "rgba(12, 11, 10, 0.16)");
  grad.addColorStop(1, "rgba(12, 11, 10, 0.0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 64);
  const tex = markSharedTexture(new THREE.CanvasTexture(canvas));
  tex.needsUpdate = true;
  cachedSideCornerAoMap.set(side, tex);
  return tex;
}

const cachedUnderShelfGlowMap = new Map<number, THREE.CanvasTexture>();
function getKelvinUnderShelfWashTexture(kelvin: number): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const kKey = kelvin <= 2800 ? 2700 : kelvin >= 3800 ? 4000 : 3000;
  const hit = cachedUnderShelfGlowMap.get(kKey);
  if (hit) return hit;
  const W = 96;
  const H = 192;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const img = ctx.createImageData(W, H);
  const [rC, gC, bC] =
    kKey === 2700 ? [255, 208, 142] : kKey === 4000 ? [255, 248, 236] : [255, 228, 182];
  for (let y = 0; y < H; y++) {
    const v = y / (H - 1);
    const vertFade = Math.pow(Math.max(0, 1 - v), 2.35);
    for (let x = 0; x < W; x++) {
      const u = x / (W - 1);
      const horizFade = Math.pow(Math.sin(u * Math.PI), 0.45);
      const a = Math.round(255 * 0.48 * vertFade * horizFade);
      const idx = (y * W + x) * 4;
      img.data[idx] = rC;
      img.data[idx + 1] = gC;
      img.data[idx + 2] = bC;
      img.data[idx + 3] = x === 0 || x === W - 1 || y === H - 1 ? 0 : a;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = markSharedTexture(new THREE.CanvasTexture(canvas));
  tex.needsUpdate = true;
  cachedUnderShelfGlowMap.set(kKey, tex);
  return tex;
}

const cachedStripBloomMap = new Map<number, THREE.CanvasTexture>();
function getGaussianLedBloomTexture(kelvin: number): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const kKey = kelvin <= 2800 ? 2700 : kelvin >= 3800 ? 4000 : 3000;
  const hit = cachedStripBloomMap.get(kKey);
  if (hit) return hit;
  const W = 128;
  const H = 64;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const img = ctx.createImageData(W, H);
  const [rC, gC, bC] =
    kKey === 2700 ? [255, 214, 154] : kKey === 4000 ? [255, 250, 242] : [255, 236, 198];
  for (let y = 0; y < H; y++) {
    const v = y / (H - 1);
    const endTipFade = y === 0 || y === H - 1 ? 0 : Math.pow(Math.sin(v * Math.PI), 0.25);
    for (let x = 0; x < W; x++) {
      const u = x / (W - 1);
      // Strict Gaussian bell curve across width so outer edges are 100% transparent (ZERO hard yellow band!)
      const d = (u - 0.5) * 6.4;
      const gauss = x === 0 || x === W - 1 ? 0 : Math.exp(-d * d);
      const a = Math.round(255 * gauss * endTipFade);
      const idx = (y * W + x) * 4;
      img.data[idx] = rC;
      img.data[idx + 1] = gC;
      img.data[idx + 2] = bC;
      img.data[idx + 3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = markSharedTexture(new THREE.CanvasTexture(canvas));
  tex.needsUpdate = true;
  cachedStripBloomMap.set(kKey, tex);
  return tex;
}

function computeHeroStudioFraming(
  bounds: THREE.Box3,
  fovDeg: number,
  aspect: number,
  angle: "hero" | "front" = "hero"
): { target: THREE.Vector3; position: THREE.Vector3; dist: number } {
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const target = new THREE.Vector3(
    center.x,
    bounds.min.y + size.y * 0.485,
    center.z
  );
  const halfVertRad = ((fovDeg || 30) * Math.PI) / 360;
  const tanV = Math.max(0.18, Math.tan(halfVertRad));
  const safeAspect = Math.max(0.85, aspect || 1.5);
  const tanH = tanV * safeAspect;
  // Balanced architectural framing (~70% vertical fill, front-biased hero angle)
  const distForHeight = (size.y * 0.74) / tanV;
  const distForWidth = (size.x * 0.78) / tanH;
  const dist = Math.max(2600, distForHeight, distForWidth);
  const dir =
    angle === "front"
      ? new THREE.Vector3(0, 0.02, 1).normalize()
      : new THREE.Vector3(0.16, 0.065, 1.0).normalize();
  const position = target.clone().addScaledVector(dir, dist);
  return { target, position, dist };
}

let cachedLedWashTex: THREE.CanvasTexture | null = null;
function getWarmLedWashTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  if (cachedLedWashTex) return cachedLedWashTex;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const grad = ctx.createLinearGradient(0, 0, 128, 0);
  grad.addColorStop(0, "rgba(255, 202, 108, 0.34)");
  grad.addColorStop(0.38, "rgba(255, 206, 124, 0.12)");
  grad.addColorStop(1, "rgba(255, 210, 140, 0.0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = markSharedTexture(new THREE.CanvasTexture(canvas));
  tex.needsUpdate = true;
  cachedLedWashTex = tex;
  return tex;
}

const xrayIcePanelMat = markSharedMaterial(
  new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    emissive: new THREE.Color(0x0284c7),
    emissiveIntensity: 0.26,
    roughness: 0.16,
    metalness: 0.05,
    transmission: 0.0,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
);
const xrayHoleUnitCylinder = markSharedGeometry(new THREE.CylinderGeometry(0.5, 0.5, 1, 14));
const hingeMountHole3DMat = markSharedMaterial(new THREE.MeshBasicMaterial({ color: 0x111827 }));
const hingeMountRing3DMat = markSharedMaterial(new THREE.MeshBasicMaterial({ color: 0xd97706 }));
const xrayHoleMatD5 = markSharedMaterial(new THREE.MeshBasicMaterial({ color: 0x10b981, toneMapped: false }));
const xrayHoleMatD8 = markSharedMaterial(new THREE.MeshBasicMaterial({ color: 0x2563eb, toneMapped: false }));
const xrayHoleMatD15 = markSharedMaterial(new THREE.MeshBasicMaterial({ color: 0xef4444, toneMapped: false }));
const xrayHoleMatCable = markSharedMaterial(new THREE.MeshBasicMaterial({ color: 0x06b6d4, toneMapped: false }));
const xrayLedGrooveMat = markSharedMaterial(
  new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.92, toneMapped: false })
);
const xrayLedDriverMat = markSharedMaterial(
  new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.34, depthWrite: false, toneMapped: false })
);
const xrayHoleMatD35 = markSharedMaterial(new THREE.MeshBasicMaterial({ color: 0xf59e0b, toneMapped: false }));
const xrayGrooveMat = markSharedMaterial(
  new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.72 })
);
const ghostLockedMat = markSharedMaterial(new THREE.MeshBasicMaterial({
  color: 0x10b981,
  transparent: true,
  opacity: 0.28,
  depthWrite: false,
}));
const ghostFreeMat = markSharedMaterial(new THREE.MeshBasicMaterial({
  color: 0x0ea5e9,
  transparent: true,
  opacity: 0.26,
  depthWrite: false,
}));
const ghostLockedEdgeMat = markSharedMaterial(new THREE.LineBasicMaterial({
  color: 0x047857,
  transparent: true,
  opacity: 0.95,
}));
const ghostFreeEdgeMat = markSharedMaterial(new THREE.LineBasicMaterial({
  color: 0x0369a1,
  transparent: true,
  opacity: 0.92,
}));
const snapSlotActiveRodMat = markSharedMaterial(new THREE.MeshBasicMaterial({
  color: 0x10b981,
  transparent: true,
  opacity: 0.95,
  depthTest: false,
}));
const snapSlotIdleRodMat = markSharedMaterial(new THREE.MeshBasicMaterial({
  color: 0xf59e0b,
  transparent: true,
  opacity: 0.78,
  depthTest: false,
}));

const v3EdgeCache = new Map<string, THREE.LineBasicMaterial>();

const cadHardwareMat = markSharedMaterial(
  new THREE.MeshBasicMaterial({
    color: 0xcbd5e1,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  })
);
const cadTechnicalMat = markSharedMaterial(new THREE.MeshBasicMaterial({
  color: 0xffffff,
  polygonOffset: true,
  polygonOffsetFactor: 1,
  polygonOffsetUnits: 1,
}));
const cadSelectedMat = markSharedMaterial(new THREE.MeshBasicMaterial({
  color: 0xdbeafe,
  polygonOffset: true,
  polygonOffsetFactor: 1,
  polygonOffsetUnits: 1,
}));
const hoverHighlightEdgeMat = markSharedMaterial(new THREE.LineBasicMaterial({
  color: 0x0284c7,
  linewidth: 2,
  opacity: 1,
  transparent: false,
}));

const SHARED_PROP_BOX_GEO = markSharedGeometry(new THREE.BoxGeometry(1, 1, 1));
const SHARED_PROP_HOOK_GEO = markSharedGeometry(new THREE.CylinderGeometry(2.2, 2.2, 38, 8));
const SHARED_HANGER_WOOD_MAT = markSharedMaterial(
  new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.48, metalness: 0.06 })
);
const SHARED_CHROME_HOOK_MAT = markSharedMaterial(
  new THREE.MeshStandardMaterial({ color: 0xd4d4d8, roughness: 0.22, metalness: 0.86 })
);
const SHARED_BOX_LINEN_MAT = markSharedMaterial(
  new THREE.MeshStandardMaterial({ color: 0xd8d3c8, roughness: 0.86, metalness: 0.01 })
);
const SHARED_BOX_TAB_MAT = markSharedMaterial(
  new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.52 })
);
const SHARED_GARMENT_MATS = [0xe7e5e4, 0x334155, 0xc7bfb3, 0x475569, 0xf5f5f4, 0x78716c].map(
  (hex) => markSharedMaterial(new THREE.MeshStandardMaterial({ color: hex, roughness: 0.86, metalness: 0.01 }))
);
const SHARED_FOLD_MATS = [0xd6d3d1, 0x64748b, 0xf5f5f4].map((hex) =>
  markSharedMaterial(new THREE.MeshStandardMaterial({ color: hex, roughness: 0.88 }))
);
const SHARED_SHOE_DARK_MAT = markSharedMaterial(
  new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.56 })
);
const SHARED_SHOE_TAUPE_MAT = markSharedMaterial(
  new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.56 })
);

function getCachedEdgeMaterial(
  isSelected: boolean,
  isActiveMod: boolean,
  isLightTheme: boolean,
  isPhotoreal = true
): THREE.LineBasicMaterial {
  const key = `sel:${isSelected ? 1 : 0}_act:${isActiveMod ? 1 : 0}_light:${isLightTheme ? 1 : 0}_pr:${isPhotoreal ? 1 : 0}`;
  let m = v3EdgeCache.get(key);
  if (!m) {
    m = new THREE.LineBasicMaterial({
      color: isSelected
        ? 0x2563eb
        : !isPhotoreal
        ? 0x1e293b
        : isLightTheme
        ? 0x3a3530
        : 0x94a3b8,
      linewidth: 1,
      opacity: isSelected
        ? 0.95
        : !isPhotoreal
        ? 0.88
        : isActiveMod
        ? 0.28
        : 0.20,
      transparent: true,
      depthWrite: false,
    });
    markSharedMaterial(m);
    v3EdgeCache.set(key, m);
  }
  return m;
}

/**
 * Traverses ONLY parametric cabinet component nodes, skipping decorative GLB prop subtrees (`isSharedCachedProps`).
 */
function traverseCabinetObjectsOnly(
  node: THREE.Object3D,
  cb: (obj: THREE.Object3D) => void
): void {
  if (node.userData?.isSharedCachedProps) return;
  cb(node);
  const children = node.children;
  for (let i = 0; i < children.length; i++) {
    traverseCabinetObjectsOnly(children[i], cb);
  }
}

/**
 * O(modules) exact parametric scene bounding box (< 0.02ms vs 300ms+ CPU vertex scan of `Box3.setFromObject`).
 */
function computeFastParametricSceneBounds(
  modules: Parameters<typeof getModuleOrientedFootprint>[0][]
): THREE.Box3 {
  const box = new THREE.Box3();
  if (!modules.length) return box;
  const mainMods = modules.filter((m) => m.category !== "complementary");
  const list = mainMods.length > 0 ? mainMods : modules;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < list.length; i++) {
    const fp = getModuleOrientedFootprint(list[i], i);
    if (fp.x < minX) minX = fp.x;
    if (fp.x + fp.planWidth > maxX) maxX = fp.x + fp.planWidth;
    if (fp.yBottom < minY) minY = fp.yBottom;
    if (fp.yBottom + fp.rawHeight > maxY) maxY = fp.yBottom + fp.rawHeight;
    if (fp.z < minZ) minZ = fp.z;
    if (fp.z + fp.planDepth > maxZ) maxZ = fp.z + fp.planDepth;
  }
  if (Number.isFinite(minX)) {
    box.min.set(minX, minY, minZ);
    box.max.set(maxX, maxY, maxZ);
  }
  return box;
}

/**
 * Collects ONLY solid clickable THREE.Mesh instances that belong to a cabinet component,
 * excluding LineSegments, AO shadow planes, decorative GLB props, and bounding boxes so 3D raycasting is 100% accurate.
 */
/**
 * Pure 3D geometry/topology signature that ignores surface color/veneer/stone/metal swaps
 * (while preserving glass/mirror profile switches & structural panel thicknesses) so material
 * changes across 15+ modules execute in < 0.5 ms via in-place GPU material swapping!
 */
function computeModuleTopologySignature(mod: Parameters<typeof computeModuleStructuralSignature>[0]): string {
  const raw = computeModuleStructuralSignature(mod);
  return raw.replace(/mat_[a-z0-9_]+/gi, (mId) => {
    const low = mId.toLowerCase();
    if (low.includes("glass") || low.includes("mirror") || low.includes("ayna") || low.startsWith("mat_led_")) {
      return low;
    }
    return "__mat_std__";
  });
}

function collectSolidCabinetMeshes(
  rootGroup: THREE.Object3D,
  includeBayVolumes: boolean
): THREE.Mesh[] {
  const solidMeshes: THREE.Mesh[] = [];
  const bayMeshes: THREE.Mesh[] = [];
  traverseCabinetObjectsOnly(rootGroup, (obj) => {
    if (
      obj instanceof THREE.Mesh &&
      obj.visible &&
      obj.userData &&
      typeof obj.userData.componentId === "string"
    ) {
      if (obj.userData.role === "bay_compartment") {
        if (includeBayVolumes) bayMeshes.push(obj);
      } else {
        solidMeshes.push(obj);
      }
    }
  });
  return [...solidMeshes, ...bayMeshes];
}

interface DimensionAnchor {
  id: string;
  tag: string;
  valueText: string;
  borderColor: string;
  badgeBg: string;
  localMidpoint: THREE.Vector3;
  localStart: THREE.Vector3;
  localEnd: THREE.Vector3;
}

const SHARED_CYLINDER_GEO = markSharedGeometry(new THREE.CylinderGeometry(1, 1, 1, 8));
const SHARED_CONE_GEO = markSharedGeometry(new THREE.ConeGeometry(1, 1, 10));

function add3DRod(
  group: THREE.Group,
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  mat: THREE.Material
) {
  const diff = new THREE.Vector3().subVectors(end, start);
  const len = diff.length();
  if (len < 1) return;
  const mesh = new THREE.Mesh(SHARED_CYLINDER_GEO, mat);
  mesh.scale.set(radius, len, radius);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), diff.clone().normalize());
  mesh.renderOrder = 998;
  group.add(mesh);
}

function add3DArrowCone(
  group: THREE.Group,
  tip: THREE.Vector3,
  dirTowardTip: THREE.Vector3,
  mat: THREE.Material
) {
  const coneH = 22;
  const coneR = 7.5;
  const mesh = new THREE.Mesh(SHARED_CONE_GEO, mat);
  mesh.scale.set(coneR, coneH, coneR);
  const norm = dirTowardTip.clone().normalize();
  mesh.position.copy(tip).addScaledVector(norm, -coneH * 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), norm);
  mesh.renderOrder = 999;
  group.add(mesh);
}

function addDimensionSegment(
  group: THREE.Group,
  anchors: DimensionAnchor[],
  id: string,
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  extDir: THREE.Vector3,
  extLen: number,
  tag: string,
  valueText: string,
  colorHex: number,
  borderColor: string,
  badgeBg: string
) {
  const mat = new THREE.MeshBasicMaterial({
    color: colorHex,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    opacity: 0.95,
    toneMapped: false,
  });

  const d1 = p1.clone().addScaledVector(extDir, extLen);
  const d2 = p2.clone().addScaledVector(extDir, extLen);
  const tickOver = 24;

  // V90: High-visibility crisp architectural dimension line + 45° slash ticks (never disappears at distance!)
  add3DRod(group, d1, d2, 2.75, mat);
  const segDir = new THREE.Vector3().subVectors(d2, d1);
  const segLen = segDir.length();
  if (segLen > 45) {
    const unitSeg = segDir.clone().normalize();
    const unitExt = extDir.clone().normalize();
    const slashHalf = 24;
    const slashVec = unitSeg.clone().add(unitExt).normalize().multiplyScalar(slashHalf);
    add3DRod(group, d1.clone().sub(slashVec), d1.clone().add(slashVec), 3.6, mat);
    add3DRod(group, d2.clone().sub(slashVec), d2.clone().add(slashVec), 3.6, mat);
  }

  // Crisp external extension guide lines
  add3DRod(
    group,
    p1.clone().addScaledVector(extDir, 12),
    d1.clone().addScaledVector(extDir, tickOver),
    1.85,
    mat
  );
  add3DRod(
    group,
    p2.clone().addScaledVector(extDir, 12),
    d2.clone().addScaledVector(extDir, tickOver),
    1.85,
    mat
  );

  const mid = d1.clone().add(d2).multiplyScalar(0.5).addScaledVector(extDir, 28);
  anchors.push({
    id,
    tag,
    valueText,
    borderColor,
    badgeBg,
    localMidpoint: mid,
    localStart: d1.clone(),
    localEnd: d2.clone(),
  });
}

const formatEngineeringErrorCode = (code?: string): string => {
  if (!code) return "Mühendislik Uyarısı";
  const map: Record<string, string> = {
    ERR_SHELF_STRUCTURAL_DEFLECTION: "Raf Dayanımı (EN 16122)",
    WARN_SHELF_SPAN_DEFLECTION: "Raf Sehim & Açıklık Uyarısı",
    CHK_12_SHELF_SPAN_DEFLECTION: "Raf Açıklık Sınırı (Sehim)",
    CHK_10_TAMBOUR_UNVERIFIED_PREVIEW_ONLY: "Tambur Kapak Önizleme Modu",
    CHK_11_PANEL_TOO_THIN_FOR_SYSTEM32: "Panel Kalınlığı Sınırı",
    ERR_FREESTANDING_TIPOVER_UNSAFE: "Devrilme Güvenliği",
    ERR_INTERNAL_DRAWER_HINGE_BODY_CLASH: "Menteşe Çakışması",
    ERR_INTERNAL_FITTING_ENVELOPE_VIOLATION: "İç Donatı Çakışması",
    ERR_INTERNAL_FITTING_HINGE_BODY_CLASH: "Menteşe Çakışması",
    ERR_SUBDIVIDER_INTERIOR_CLASH: "Ara Dikme / İç Donanım Çakışması",
    ERR_SHELF_INTERIOR_CLASH: "Raf / İç Donanım Çakışması",
    ERR_INTERNAL_COMPONENTS_OVERLAP: "İç Aksesuar Çakışması",
    ERR_SINK_BOWL_DRAWER_COLLISION: "Eviye Çakışması",
    ERR_HANDLE_CC_EXCEEDS_PANEL_SPAN: "Kulp Aks Sınırı",
    ERR_APPLIANCE_200CM2_AIRFLOW_VIOLATION: "Havalandırma Açıklığı",
    ERR_PANEL_EXCEEDS_USABLE_SHEET_SIZE: "Plaka Ebat Aşımı",
    ERR_DRYWALL_UNREINFORCED_HEAVY_HANG: "Alçıpan Yük Sınırı",
    ERR_WALL_CABINET_HANGER_OVERLOAD: "Askı Kapasite Sınırı",
    ERR_CEILING_TYPE_COLLISION: "Tavan Çakışması",
    ERR_STACKED_MODULE_UNSUPPORTED_MIDAIR: "Boşlukta Modül",
    ERR_STACKED_MODULE_CANTILEVER_OVERHANG: "Konsol Aşımı",
    ERR_COLUMN_COLLISION: "Kolon Çakışması",
    ERR_MEP_OUTLET_BLOCKED_BY_UPRIGHT_PANEL: "Priz/Tesisat Çakışması",
    ERR_ADJUSTABLE_SHELF_WITHOUT_PIN_HOLES: "Raf Pimi Eksik",
    WARN_INTERNAL_PULLOUT_HINGE_SPACER_REQUIRED: "Menteşe Paspayı Gerekli",
    CHK_SPATIAL_WALL_CORNER_HANDLE_SWING_CLASH: "Köşe Kulp Açılımı",
    WARN_CEILING_DOOR_SWEEP_TIGHT: "Tavan Açılım Mesafesi",
    INFO_TALL_CARCASS_NEEDS_FIXED_SHELF: "Sabit Taşıyıcı Raf Önerisi",
  };
  if (map[code]) return map[code];
  const upper = code.toUpperCase();
  if (upper.includes("TAMBOUR")) return "Tambur Kapak Önizleme Modu";
  if (upper.includes("SHELF") || upper.includes("SPAN") || upper.includes("DEFLECTION")) {
    return "Raf Sehim & Açıklık Kontrolü";
  }
  if (upper.includes("HINGE")) return "Menteşe Yerleşim Kontrolü";
  if (upper.includes("DRAWER")) return "Çekmece & Donanım Kontrolü";
  if (upper.includes("TIPOVER") || upper.includes("TIP")) return "Devrilme Güvenliği Kontrolü";
  if (upper.includes("COLLISION") || upper.includes("CLASH")) return "Parça Çakışma Kontrolü";
  if (upper.includes("CEILING")) return "Tavan Mesafesi Kontrolü";
  if (upper.includes("PLINTH") || upper.includes("TOE")) return "Baza & Ayak Kontrolü";
  return "Teknik Tasarım Kontrolü";
};

export interface V3ThreeViewportProps {
  paused?: boolean;
  theme?: "warm-light" | "showroom-neutral" | "dark";
  showGrid?: boolean;
  showInCanvasHud?: boolean;
  minimalChrome?: boolean;
  showDimensions?: boolean;
  stageSafeInsets?: { topPx?: number; bottomPx?: number; leftPx?: number; rightPx?: number };
  isRightInspectorOpen?: boolean;
  onToggleDimensions?: () => void;
  onRequest2DElevation?: () => void;
  onPerformanceSample?: (metrics: { lastRenderMs: number }) => void;
}

export const V3ThreeViewport: React.FC<V3ThreeViewportProps> = React.memo(
  ({
    paused = false,
    theme = "warm-light",
    showGrid = true,
    showInCanvasHud = true,
    minimalChrome = false,
    showDimensions,
    stageSafeInsets,
    isRightInspectorOpen = false,
    onToggleDimensions,
    onRequest2DElevation,
    onPerformanceSample,
  }) => {
    const mountRef = useRef<HTMLDivElement>(null);
    const {
      project,
      activeModule,
      activeModuleIndex,
      activeBay,
      activeBayIndex,
      doorOpenAngleDeg,
      setDoorOpenAngleDeg,
      toggleDoorOpen,
      drawerOpenMm,
      setDrawerOpenMm,
      explodedFactor,
      setExplodedFactor,
      isOrthographic,
      cameraPreset,
      selectedComponentId,
      setSelectedComponentId,
      v4ModuleTemplates,
      hardwareCatalog,
      spaceObstacles,
      spaceWalls,
      setActiveModuleIndex,
      setActiveBayIndex,
      selectModuleBayComponent,
      setDimensions,
    resizeModuleParametric,
      setPlinthHeight,
      setBayDoorType,
      setModuleSlidingMountingType,
      setBayV4DoorConfig,
      copyDoorConfigToAllBays,
      setSelectedComponentMaterial,
      applyMaterialToSimilarComponents,
      applyMaterialByTargetScope,
      resetModuleMaterialOverrides,
      setDoorCrossSectionProfile,
      setShelfElevation,
      setDrawerPlacement,
      setSpecialFittingPlacement,
      setHangingRailElevation,
      setBayCustomWidth,
      setSubDividerPlacement,
      setBayCount,
      setShelfThickness,
      moveInteriorItemToBay,
      equalizeBaysAndShelves,
      addShelf,
      addDrawer,
      addHangingRail,
      addSpecialFitting,
      addSubDivider,
      splitBayIntoTwo,
      applyBayInteriorPreset,
      removeBayAt,
      removeBayAndShrinkModule,
      shrinkDoubleBayToSingle,
      removeSelectedInteriorComponent,
      addAdjacentModule,
      addStackedTopModule,
      duplicateActiveModule,
      removeActiveModule,
      toggleModuleLedLighting,
      removeSpaceObstacle,
      undo,
      redo,
      rotateActiveModule90,
      flipActiveDoorDirection,
      setModulePosition,
      swapModuleWithNeighbor,
      applyV4Template,
      finishModuleDragWithSmartSwap,
      updateObstaclePosition,
      beginHistoryTransaction,
      commitHistoryTransaction,
      addInteriorItemAtElevation,
      dropV4TemplateWithSnap,
      selectedSceneObjectId,
      setSelectedSceneObjectId,
      addSceneObjectFromCatalog,
      updateSceneObject,
      duplicateSceneObject,
      removeSceneObject,
      deleteActiveSelectionSmart,
      applyApprovedEngineeringFix,
    } = useV3Adapter({ lightweightViewport: true });

    const pausedRef = useRef<boolean>(Boolean(paused));
    pausedRef.current = Boolean(paused);
    const removeSceneObjectRef = useRef(removeSceneObject);
    removeSceneObjectRef.current = removeSceneObject;
    const duplicateSceneObjectRef = useRef(duplicateSceneObject);
    duplicateSceneObjectRef.current = duplicateSceneObject;
    const duplicateActiveModuleRef = useRef(duplicateActiveModule);
    duplicateActiveModuleRef.current = duplicateActiveModule;
    const deleteActiveSelectionSmartRef = useRef(deleteActiveSelectionSmart);
    deleteActiveSelectionSmartRef.current = deleteActiveSelectionSmart;
    const cadCopyClipboardRef = useRef<
      { kind: "sceneObject"; id: string } | { kind: "module"; moduleId: string } | null
    >(null);
    const isStoreBatchDragging = useConfiguratorStore((s) => s.batchStartProject !== null);
    const displayUnit = useConfiguratorStore((s) => s.displayUnit);
    const displayUnitRef = useRef<"cm" | "mm">(displayUnit);
    displayUnitRef.current = displayUnit;
    const lastSettled3DEngRef = useRef<ReturnType<typeof evaluateUnifiedEngineeringModel> | null>(null);
    const live3DEngineeringReport = useMemo(() => {
      if ((paused || isStoreBatchDragging) && lastSettled3DEngRef.current) {
        return lastSettled3DEngRef.current;
      }
      if (paused) return null;
      const computed = getMemoizedUnifiedEngineering(project);
      lastSettled3DEngRef.current = computed;
      return computed;
    }, [project, paused, isStoreBatchDragging]);

    const experienceTier = useConfiguratorStore((s) => s.userExperienceTier);
    const activeWallId = useConfiguratorStore((s) => s.activeWallId);
    const canUndo3D = useConfiguratorStore((s) => s.history.length > 0);
    const canRedo3D = useConfiguratorStore((s) => s.future.length > 0);
    const isSimpleTier = experienceTier === "simple";
    const [contextMenuTarget, setContextMenuTarget] = useState<Viewport3DContextTarget | null>(null);
    const [editingBadge, setEditingBadge] = useState<null | "W" | "H" | "D" | "SOKET">(null);
    const [badgeDraftValue, setBadgeDraftValue] = useState<string>("");
    const [doorsHiddenIn3D, setDoorsHiddenIn3D] = useState<boolean>(false);
    const [cutawayActiveBay, setCutawayActiveBay] = useState<boolean>(false);
    useEffect(() => {
      if (typeof window === "undefined") return;
      window.dispatchEvent(
        new CustomEvent("birim:doors-hidden-state-changed", {
          detail: Boolean(doorsHiddenIn3D || cutawayActiveBay),
        })
      );
    }, [doorsHiddenIn3D, cutawayActiveBay]);
    const [showInteriorProps3D, setShowInteriorProps3D] = useState<boolean>(true);
    const [engineeringAlertCollapsed, setEngineeringAlertCollapsed] = useState<boolean>(false);
    const [selectedBeaconFinding, setSelectedBeaconFinding] = useState<{
      code: string;
      severity: string;
      title: string;
      message: string;
      suggestions: string[];
      remediationProposals: import("@birim/core").RemediationProposal[];
      moduleIndex: number;
      bayIndex: number;
    } | null>(null);
    const engineeringBeaconGroupRef = useRef<THREE.Group | null>(null);
    const interiorPropsGroupRef = useRef<THREE.Group | null>(null);
    const multiHoleMeshCacheRef = useRef<Map<string, THREE.InstancedMesh>>(new Map());
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onNightLedToggle = () => {
      setLightingPreset((prev) => (prev === "night_led" ? "daylight" : "night_led"));
    };
    window.addEventListener("birim:toggle-night-led", onNightLedToggle);
    return () => window.removeEventListener("birim:toggle-night-led", onNightLedToggle);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onToggle = (ev: Event) => {
      const detail = (ev as CustomEvent<{ visible?: boolean }>).detail;
      setShowInteriorProps3D((prev) =>
        typeof detail?.visible === "boolean" ? detail.visible : !prev
      );
    };
    window.addEventListener("birim:toggle-interior-props", onToggle);
    return () => window.removeEventListener("birim:toggle-interior-props", onToggle);
  }, []);
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("birim:interior-props-changed", { detail: { visible: showInteriorProps3D } }));
    }
  }, [showInteriorProps3D]);
    const bayPopoverDomRef = useRef<HTMLDivElement | null>(null);
    const activeBayWorldAnchorRef = useRef<THREE.Vector3 | null>(null);
    const doorPopoverDomRef = useRef<HTMLDivElement | null>(null);
    const activeDoorWorldAnchorRef = useRef<THREE.Vector3 | null>(null);
    const contextPopoverDomRef = useRef<HTMLDivElement | null>(null);
    const dimPopoverDomRef = useRef<HTMLDivElement | null>(null);
    const lifestylePropsCacheRef = useRef<Map<string, THREE.Group>>(new Map());
    const stageSafeInsetsRef = useRef(stageSafeInsets);
    useEffect(() => {
      stageSafeInsetsRef.current = stageSafeInsets;
    }, [stageSafeInsets]);

    // Draggable & Collapsible Floating Panel System (prevents covering the 3D cabinet)
    const [floatingPanelPos, setFloatingPanelPos] = useState<
      Record<"bay" | "door" | "dim" | "context", { x: number; y: number } | null>
    >({
      bay: null,
      door: null,
      dim: null,
      context: null,
    });
    const floatingPanelPosRef = useRef(floatingPanelPos);
    useEffect(() => {
      floatingPanelPosRef.current = floatingPanelPos;
    }, [floatingPanelPos]);

    const [collapsedFloatingPanels, setCollapsedFloatingPanels] = useState<
      Record<"bay" | "door" | "callouts", boolean>
    >({
      bay: false,
      door: false,
      callouts: false,
    });
    const [dockedToCorner, setDockedToCorner] = useState<boolean>(true);
    const dockedToCornerRef = useRef<boolean>(true);
    useEffect(() => {
      dockedToCornerRef.current = dockedToCorner;
    }, [dockedToCorner]);

    const [isDraggingItemOver3D, setIsDraggingItemOver3D] = useState<boolean>(false);
    const [section3DAxis, setSection3DAxis] = useState<null | "X" | "Z">(null);
    const [section3DRatio, setSection3DRatio] = useState<number>(0.55);
    const [section3DMenuOpen, setSection3DMenuOpen] = useState<boolean>(false);
    const [explode3DMenuOpen, setExplode3DMenuOpen] = useState<boolean>(false);
    const customLabelOffsetsRef = useRef<Record<string, { dx: number; dy: number }>>({});
    const [, setCustomLabelTick] = useState(0);

    const startFloatingPanelDrag = useCallback(
      (
        panelKey: "bay" | "door" | "dim" | "context",
        e: React.PointerEvent<HTMLElement> | React.MouseEvent<HTMLElement>
      ) => {
        if ("button" in e && e.button !== 0) return;
        if ((e.target as HTMLElement).closest("button, input, select, textarea, a, label")) return;
        e.preventDefault();
        e.stopPropagation();

        const domMap: Record<"bay" | "door" | "dim" | "context", HTMLDivElement | null> = {
          bay: bayPopoverDomRef.current,
          door: doorPopoverDomRef.current,
          dim: dimPopoverDomRef.current,
          context: contextPopoverDomRef.current,
        };
        const cardEl =
          domMap[panelKey] ||
          (e.currentTarget.closest("[data-floating-card]") as HTMLDivElement | null) ||
          (e.currentTarget.parentElement as HTMLDivElement | null);
        const containerEl = mountRef.current?.parentElement;
        if (!cardEl || !containerEl) return;

        // Freeze any CSS transitions immediately so position snap & cursor tracking have 0.0ms lag!
        cardEl.style.transition = "none";
        cardEl.style.willChange = "transform";

        const cRect = containerEl.getBoundingClientRect();
        const kRect = cardEl.getBoundingClientRect();
        const cardW = kRect.width || cardEl.offsetWidth || 260;
        const cardH = kRect.height || cardEl.offsetHeight || 48;

        // Exact offset from card's top-left corner to pointer cursor (prevents any initial jump!)
        const grabOffsetX = e.clientX - kRect.left;
        const grabOffsetY = e.clientY - kRect.top;
        const initX = Math.round(kRect.left - cRect.left);
        const initY = Math.round(kRect.top - cRect.top);

        // Normalize card anchor to (0,0) + clear Tailwind v4 `translate: -50%` so it NEVER shifts left on click!
        cardEl.style.left = "0px";
        cardEl.style.top = "0px";
        cardEl.style.right = "auto";
        cardEl.style.bottom = "auto";
        cardEl.style.translate = "none";
        cardEl.style.transform = `translate3d(${initX}px, ${initY}px, 0)`;
        floatingPanelPosRef.current = {
          ...floatingPanelPosRef.current,
          [panelKey]: { x: initX, y: initY },
        };

        const handleEl = e.currentTarget as HTMLElement;
        const pointerId = "pointerId" in e ? e.pointerId : undefined;
        if (pointerId !== undefined && typeof handleEl.setPointerCapture === "function") {
          try {
            handleEl.setPointerCapture(pointerId);
          } catch {
            // ignore synthetic events
          }
        }

        const prevBodyCursor = document.body.style.cursor;
        document.body.style.cursor = "grabbing";

        const applyMove = (clientX: number, clientY: number) => {
          const liveCRect = containerEl.getBoundingClientRect();
          const maxX = Math.max(8, liveCRect.width - cardW - 8);
          const maxY = Math.max(8, liveCRect.height - cardH - 8);
          const nx = Math.round(Math.max(8, Math.min(maxX, clientX - liveCRect.left - grabOffsetX)));
          const ny = Math.round(Math.max(8, Math.min(maxY, clientY - liveCRect.top - grabOffsetY)));
          floatingPanelPosRef.current[panelKey] = { x: nx, y: ny };
          cardEl.style.transform = `translate3d(${nx}px, ${ny}px, 0)`;
        };

        const onPointerMove = (pe: PointerEvent) => {
          pe.preventDefault();
          applyMove(pe.clientX, pe.clientY);
        };
        const onMouseMove = (me: MouseEvent) => {
          applyMove(me.clientX, me.clientY);
        };

        let cleanedUp = false;
        const finishDrag = () => {
          if (cleanedUp) return;
          cleanedUp = true;
          document.body.style.cursor = prevBodyCursor;
          cardEl.style.willChange = "auto";
          if (pointerId !== undefined && typeof handleEl.releasePointerCapture === "function") {
            try {
              handleEl.releasePointerCapture(pointerId);
            } catch {
              // ignore
            }
          }
          window.removeEventListener("pointermove", onPointerMove);
          window.removeEventListener("pointerup", finishDrag);
          window.removeEventListener("pointercancel", finishDrag);
          window.removeEventListener("mousemove", onMouseMove);
          window.removeEventListener("mouseup", finishDrag);
          // Commit to React state ONLY ONCE on release so zero re-renders occur mid-drag!
          const finalPos = floatingPanelPosRef.current[panelKey];
          if (finalPos) {
            setFloatingPanelPos((prev) => ({ ...prev, [panelKey]: { ...finalPos } }));
          }
        };

        if (pointerId !== undefined) {
          window.addEventListener("pointermove", onPointerMove, { passive: false });
          window.addEventListener("pointerup", finishDrag);
          window.addEventListener("pointercancel", finishDrag);
        } else {
          window.addEventListener("mousemove", onMouseMove);
          window.addEventListener("mouseup", finishDrag);
        }
      },
      []
    );

    const startCalloutBadgeDrag = useCallback(
      (badgeId: string, e: React.MouseEvent<HTMLElement>) => {
        if (e.button !== 0) return;
        const startClientX = e.clientX;
        const startClientY = e.clientY;
        const cur = customLabelOffsetsRef.current[badgeId] || { dx: 0, dy: 0 };
        let moved = false;

        const onMove = (me: MouseEvent) => {
          const dX = me.clientX - startClientX;
          const dY = me.clientY - startClientY;
          if (!moved && Math.hypot(dX, dY) < 4) return;
          moved = true;
          customLabelOffsetsRef.current[badgeId] = {
            dx: cur.dx + dX,
            dy: cur.dy + dY,
          };
          // Update projected label positions directly on next animation frame without full React re-render!
          needsRenderRef.current = true;
        };
        const onUp = () => {
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
          if (moved) {
            (window as any).__birimSuppressNextClick = Date.now();
            setCustomLabelTick((t) => t + 1);
          }
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      },
      []
    );
    const [doorMenuSubSection, setDoorMenuSubSection] = useState<
      null | "type" | "direction" | "handle" | "material"
    >(null);
    const [floatingMatScope, setFloatingMatScope] = useState<"single" | "module_similar" | "project_similar">("single");
    const [bayMenuSubSection, setBayMenuSubSection] = useState<
      null | "accessories" | "templates"
    >(null);
    const [clicked3DContext, setClicked3DContext] = useState<null | {
      kind: "door" | "bay";
      bayIndex: number;
      role: string;
      componentId?: string;
      label: string;
    }>(null);
    const [localShowDimensions, setLocalShowDimensions] = useState<boolean>(() => !isSimpleTier);
    const [showRoomArchitecture3D, setShowRoomArchitecture3D] = useState<boolean>(true);
    const [wallFocusHighlight, setWallFocusHighlight] = useState<boolean>(false);
    const hasActiveCabinetSelection = Boolean(selectedComponentId);
    useEffect(() => {
      if (selectedComponentId) setWallFocusHighlight(false);
    }, [selectedComponentId]);
    useEffect(() => {
      const onWallSel = () => setWallFocusHighlight(true);
      window.addEventListener("birim:wall-selected-3d", onWallSel);
      return () => window.removeEventListener("birim:wall-selected-3d", onWallSel);
    }, []);
    const [lightingPreset, setLightingPreset] = useState<"daylight" | "showroom_warm" | "night_led">(
      "daylight"
    );
    const [wallTone, setWallTone] = useState<ArchitecturalWallTone>("soft_plaster");
    const [floorStyle, setFloorStyle] = useState<ArchitecturalFloorStyle>("oak_parquet");
    const [activeCamPill, setActiveCamPill] = useState<"3d" | "2d" | "front" | "side" | "top" | "interior">("3d");
    const [renderMenuOpen, setRenderMenuOpen] = useState<boolean>(false);
    const [ultraRenderProgress, setUltraRenderProgress] = useState<number | null>(null);
    useEffect(() => {
      const onFloorChange = (ev: Event) => {
        const customEv = ev as CustomEvent<ArchitecturalFloorStyle>;
        if (customEv.detail) setFloorStyle(customEv.detail);
      };
      const onDoorsHiddenChange = (ev: Event) => {
        const customEv = ev as CustomEvent<boolean | "toggle">;
        if (customEv.detail === "toggle") {
          setDoorsHiddenIn3D((prev) => {
            const next = !prev;
            if (!next) setCutawayActiveBay(false);
            return next;
          });
        } else if (typeof customEv.detail === "boolean") {
          setDoorsHiddenIn3D(customEv.detail);
          if (!customEv.detail) setCutawayActiveBay(false);
        }
      };
      const onHwViewModeChange = (ev: Event) => {
        const customEv = ev as CustomEvent<"normal" | "hardware" | "technical">;
        if (customEv.detail) {
          setHardwareViewMode(customEv.detail);
          if (customEv.detail === "technical") {
            setRenderEdgeMode("cad");
          } else if (customEv.detail === "normal") {
            setRenderEdgeMode("photoreal");
          }
        }
      };
      const onMatModeChange = (ev: Event) => {
        const customEv = ev as CustomEvent<{ active: boolean; brushMaterialId?: string }>;
        if (customEv.detail) {
          setMaterialModeActive(Boolean(customEv.detail.active));
          if (customEv.detail.brushMaterialId) {
            setActiveBrushMaterialId(customEv.detail.brushMaterialId);
          }
        }
      };
      const onBrushMatChange = (ev: Event) => {
        const customEv = ev as CustomEvent<string>;
        if (customEv.detail) {
          setActiveBrushMaterialId(customEv.detail);
        }
      };
      const onLightPresetChange = (ev: Event) => {
        const detail = (ev as CustomEvent<"daylight" | "showroom_warm" | "night_led">).detail;
        if (detail) setLightingPreset(detail);
      };
      const onWallToneChange = (ev: Event) => {
        const detail = (ev as CustomEvent<ArchitecturalWallTone>).detail;
        if (detail) setWallTone(detail);
      };
      const onSection3DChange = (ev: Event) => {
        const detail = (ev as CustomEvent<{ axis: null | "X" | "Z"; ratio?: number }>).detail;
        if (detail) {
          setSection3DAxis(detail.axis);
          if (typeof detail.ratio === "number") setSection3DRatio(detail.ratio);
        }
      };
      const onRoomWallsChange = (ev: Event) => {
        const detail = (ev as CustomEvent<boolean | "toggle">).detail;
        if (detail === "toggle") setShowRoomArchitecture3D((p) => !p);
        else if (typeof detail === "boolean") setShowRoomArchitecture3D(detail);
      };
      const onMoveModeChange = (ev: Event) => {
        const detail = (ev as CustomEvent<boolean>).detail;
        if (typeof detail === "boolean") setMoveObjectMode3D(detail);
      };
      const onOpenGlbLib = () => setGlbLibraryOpen(true);
      const onFitCamera3D = (ev: Event) => {
        const preset =
          (
            ev as CustomEvent<
              "hero" | "front" | "room_front_persp" | "focus_module" | "side" | "top"
            >
          ).detail || "hero";
        const controls = controlsRef.current;
        const perspective = perspCamRef.current;
        if (!controls || !perspective) return;
        const stNow = useConfiguratorStore.getState();
        if (stNow.isOrthographic && stNow.toggleOrthographic) {
          stNow.toggleOrthographic();
        }
        controls.object = perspective;
        const curProj = stNow.project;
        const curMods = curProj.modules;
        const bounds = computeFastParametricSceneBounds(curMods);
        if (bounds.isEmpty()) return;
        const tanHalfV = Math.tan(THREE.MathUtils.degToRad(perspective.fov) / 2);
        const tanHalfH = tanHalfV * Math.max(0.55, perspective.aspect || 1.5);

        if (preset === "focus_module") {
          const focusMod = curMods[stNow.activeModuleIndex] || curMods[0];
          if (focusMod) {
            const fp = getModuleOrientedFootprint(focusMod, 0);
            const modCx = fp.x + fp.planWidth * 0.5;
            const modCz = fp.z + fp.planDepth * 0.5;
            const modCy = (focusMod.position.y || 0) + focusMod.dimensions.height * 0.5;
            const rotDeg = (((focusMod.rotation?.y ?? 0) % 360) + 360) % 360;
            const rotRad = (rotDeg * Math.PI) / 180;
            const effWalls = getEffectiveSpaceWalls(curProj);
            const roomCenter = { x: (effWalls[0]?.length || 3600) * 0.5, z: 1200 };
            let frontNx = Math.sin(rotRad);
            let frontNz = Math.cos(rotRad);
            for (const w of effWalls) {
              const wb = getWallRoomBasis(w, roomCenter);
              const rDiff = Math.abs(((((rotDeg - wb.moduleRotationYDeg) % 360) + 540) % 360) - 180);
              if (rDiff <= 12) {
                frontNx = wb.inwardNormal.x;
                frontNz = wb.inwardNormal.z;
                break;
              }
            }
            const spanW = Math.max(700, focusMod.dimensions.width);
            const spanH = Math.max(700, focusMod.dimensions.height);
            const spanD = Math.max(400, focusMod.dimensions.depth);
            const distV = (spanH * 0.5) / (tanHalfV * 0.72);
            const distH = (spanW * 0.5) / (tanHalfH * 0.72);
            const focusDist = Math.max(1250, distV, distH) + spanD * 0.55;
            const targetVec = new THREE.Vector3(modCx, modCy, modCz);
            const endPosVec = new THREE.Vector3(
              modCx + frontNx * focusDist + frontNz * (spanW * 0.08),
              modCy + Math.min(180, spanH * 0.08),
              modCz + frontNz * focusDist - frontNx * (spanW * 0.08)
            );
            cameraFlightRef.current = {
              startPos: perspective.position.clone(),
              endPos: endPosVec,
              startTarget: controls.target.clone(),
              endTarget: targetVec,
              startTime: performance.now(),
              durationMs: 520,
            };
            perspective.updateProjectionMatrix();
            needsRenderRef.current = true;
            return;
          }
        }

        if (preset === "room_front_persp" || preset === "front") {
          const effWalls = getEffectiveSpaceWalls(curProj);
          const activeModForFront = curMods[stNow.activeModuleIndex] || curMods[0];
          const activeModWallId =
            effWalls.length > 1 && activeModForFront
              ? resolveModuleHostWallId(curProj, activeModForFront)
              : null;
          // In L or U layouts, prioritize the wall facade of the currently selected module (unless user explicitly switched to an empty wall)
          const hasModulesOnActiveWall =
            Boolean(stNow.activeWallId) &&
            curMods.some((m) => resolveModuleHostWallId(curProj, m) === stNow.activeWallId);
          const targetFacadeWallId =
            activeModWallId &&
            (activeModWallId === stNow.activeWallId || hasModulesOnActiveWall || !stNow.activeWallId)
              ? activeModWallId
              : stNow.activeWallId || activeModWallId || effWalls[0]?.id;
          const selWall =
            effWalls.find((w) => w.id === targetFacadeWallId) || effWalls[0];
          const ceilH = curProj.space?.ceilingHeight || 2600;
          if (selWall) {
            const roomCenter = { x: (effWalls[0]?.length || 3600) * 0.5, z: 1200 };
            const wb = getWallRoomBasis(selWall, roomCenter);
            const wLen = Math.max(1200, selWall.length || 3600);
            const wallMidX = wb.p0.x + wb.rawTangent.x * (wLen * 0.5);
            const wallMidZ = wb.p0.z + wb.rawTangent.z * (wLen * 0.5);
            const eyeY = Math.min(1260, Math.max(1050, ceilH * 0.48));
            const distV = (ceilH * 0.52) / (tanHalfV * 0.78);
            const distH = (wLen * 0.52) / (tanHalfH * 0.80);
            const roomDist = Math.max(2200, distV, distH) + 320;
            const targetVec = new THREE.Vector3(
              wallMidX + wb.inwardNormal.x * 260,
              eyeY,
              wallMidZ + wb.inwardNormal.z * 260
            );
            const endPosVec = new THREE.Vector3(
              wallMidX + wb.inwardNormal.x * roomDist,
              eyeY + 95,
              wallMidZ + wb.inwardNormal.z * roomDist
            );
            cameraFlightRef.current = {
              startPos: perspective.position.clone(),
              endPos: endPosVec,
              startTarget: controls.target.clone(),
              endTarget: targetVec,
              startTime: performance.now(),
              durationMs: 560,
            };
            perspective.updateProjectionMatrix();
            needsRenderRef.current = true;
            return;
          }
        }

        let endPosVec: THREE.Vector3;
        let endTargetVec: THREE.Vector3;
        if (preset === "side" || preset === "top") {
          const center = bounds.getCenter(new THREE.Vector3());
          const size = bounds.getSize(new THREE.Vector3());
          endTargetVec = center.clone();
          if (preset === "side") {
            const distV = (size.y / 2) / (tanHalfV * 0.68);
            const distH = (size.z / 2) / (tanHalfH * 0.70);
            const dist = Math.max(2000, distV, distH) + size.x / 2;
            endPosVec = new THREE.Vector3(center.x + dist, center.y + 80, center.z + 220);
          } else {
            const distV = (size.z / 2) / (tanHalfV * 0.68);
            const distH = (size.x / 2) / (tanHalfH * 0.70);
            const dist = Math.max(2000, distV, distH) + size.y / 2;
            endPosVec = new THREE.Vector3(center.x, center.y + dist, center.z + 180);
          }
        } else {
          const framed = computeHeroStudioFraming(bounds, perspective.fov, perspective.aspect, "hero");
          endTargetVec = framed.target.clone();
          endPosVec = framed.position.clone();
        }
        cameraFlightRef.current = {
          startPos: perspective.position.clone(),
          endPos: endPosVec,
          startTarget: controls.target.clone(),
          endTarget: endTargetVec,
          startTime: performance.now(),
          durationMs: 540,
        };
        perspective.updateProjectionMatrix();
        needsRenderRef.current = true;
      };
      window.addEventListener("birim:set-floor-style", onFloorChange);
      window.addEventListener("birim:set-doors-hidden", onDoorsHiddenChange);
      window.addEventListener("birim:set-hardware-view-mode", onHwViewModeChange);
      window.addEventListener("birim:set-material-mode", onMatModeChange);
      window.addEventListener("birim:set-brush-material", onBrushMatChange);
      window.addEventListener("birim:set-lighting-preset", onLightPresetChange);
      window.addEventListener("birim:set-wall-tone", onWallToneChange);
      window.addEventListener("birim:set-section-3d", onSection3DChange);
      window.addEventListener("birim:set-room-walls-visible", onRoomWallsChange);
      window.addEventListener("birim:set-move-mode-3d", onMoveModeChange);
      window.addEventListener("birim:open-glb-library", onOpenGlbLib);
      const onPaintTool3D = (ev: Event) => {
        const detail = (ev as CustomEvent<PaintTool3DState>).detail;
        if (!detail) return;
        setPaintTool3D((prev) =>
          prev.mode === detail.mode &&
          prev.materialId === detail.materialId &&
          prev.clickBehavior === detail.clickBehavior &&
          prev.zoneScope === detail.zoneScope
            ? prev
            : detail
        );
        if (detail.materialId) {
          setActiveBrushMaterialId((prev) =>
            prev === detail.materialId ? prev : detail.materialId
          );
        }
      };

      const applyTempMatToCompGroup = (
        compGroup: THREE.Object3D,
        targetMatDef: MaterialDefinition,
        isMetalPart: boolean,
        grainDir: "lengthwise" | "crosswise" | "custom",
        surfFin?: "matte" | "satin" | "gloss"
      ) => {
        const previewMat = getV3PbrMaterial(targetMatDef, false, isMetalPart, grainDir, surfFin);
        compGroup.traverse((sub) => {
          if (
            (sub instanceof THREE.Mesh || sub instanceof THREE.InstancedMesh) &&
            !sub.userData?.preserveCustomMaterial &&
            !sub.userData?.isSelectionHelper &&
            !sub.userData?.isContactShadow
          ) {
            if (!previewOriginalMatsRef.current.has(sub)) {
              previewOriginalMatsRef.current.set(sub, sub.material);
            }
            sub.material = previewMat;
          }
        });
      };

      const onPreviewMaterial3D = (ev: Event) => {
        const payload = (ev as CustomEvent<Live3DMaterialPreviewPayload | null>).detail;
        const restored = restoreHoverPreviewMaterials();
        const mGrp = meshGroupRef.current;
        if (!payload || !payload.materialId || !mGrp) {
          if (restored) needsRenderRef.current = true;
          return;
        }
        const st = useConfiguratorStore.getState();
        const allMats = [...DEFAULT_MATERIALS, ...(st.project.customMaterials || [])];
        const matDef = allMats.find((m) => m.id === payload.materialId);
        if (!matDef) return;
        const { effectiveScope, blockedErrorTr } = resolveEffectiveScopeForMaterial(payload.scope, matDef);
        if (blockedErrorTr) return;
        const actIdx =
          typeof payload.activeModuleIndex === "number"
            ? payload.activeModuleIndex
            : st.activeModuleIndex;

        mGrp.children.forEach((modContainer, mIdx) => {
          const mod = st.project.modules[mIdx];
          if (!mod) return;
          const zone = classifyModuleArchitecturalZone(mod);
          for (const compGroup of modContainer.children) {
            const role = String(compGroup.userData?.role || "");
            if (!role) continue;
            const curMatId = String(compGroup.userData?.matDef?.id || "");
            if (payload.replaceFromMaterialId) {
              if (curMatId === payload.replaceFromMaterialId) {
                const isMetal =
                  role === "door_handle" || role === "drawer_handle" || role === "gola_profile";
                applyTempMatToCompGroup(
                  compGroup,
                  matDef,
                  isMetal,
                  (compGroup.userData?.grainDir as "lengthwise" | "crosswise" | "custom") || "lengthwise",
                  mod.surfaceFinishOverride
                );
              }
              continue;
            }
            const isDoorOrDrawer =
              role === "door" ||
              role.startsWith("door_left") ||
              role.startsWith("door_right") ||
              role === "door_sliding" ||
              role === "drawer_front";
            const isCarcass =
              role.startsWith("carcass_") || role === "shelf" || role === "drawer_box";
            const isCountertop = role === "countertop" || mod.complementaryRole === "countertop";
            const isPlinth = role === "plinth" || (mod.complementaryRole as string) === "plinth" || mod.complementaryRole === "plinth_strip";
            const isHandleOrGola =
              (role === "door_handle" || role === "drawer_handle" || role === "gola_profile") &&
              compGroup.userData?.handleCategory !== "j_pull" &&
              compGroup.userData?.handleCategory !== "milled_wood_grip";

            let match = false;
            if (effectiveScope === "active_doors" && mIdx === actIdx && isDoorOrDrawer) match = true;
            else if (
              effectiveScope === "active_module" &&
              mIdx === actIdx &&
              (isDoorOrDrawer || isCarcass || isPlinth)
            )
              match = true;
            else if (effectiveScope === "base_cabinets" && zone === "base" && isDoorOrDrawer)
              match = true;
            else if (effectiveScope === "wall_cabinets" && zone === "wall" && isDoorOrDrawer)
              match = true;
            else if (
              effectiveScope === "tall_and_island" &&
              zone === "tall_or_island" &&
              isDoorOrDrawer
            )
              match = true;
            else if (effectiveScope === "active_carcass" && mIdx === actIdx && isCarcass) match = true;
            else if (effectiveScope === "active_plinth" && mIdx === actIdx && isPlinth) match = true;
            else if (effectiveScope === "all_fronts" && isDoorOrDrawer) match = true;
            else if (effectiveScope === "countertops" && isCountertop) match = true;
            else if (effectiveScope === "carcass_all" && isCarcass) match = true;
            else if (effectiveScope === "plinths" && isPlinth) match = true;
            else if (effectiveScope === "handles_gola" && isHandleOrGola) match = true;

            if (match) {
              applyTempMatToCompGroup(
                compGroup,
                matDef,
                isHandleOrGola,
                (compGroup.userData?.grainDir as "lengthwise" | "crosswise" | "custom") || "lengthwise",
                mod.surfaceFinishOverride
              );
            }
          }
        });
        needsRenderRef.current = true;
      };

      const onPreviewMoodboard3D = (ev: Event) => {
        const mb = (ev as CustomEvent<CuratedBirimMoodboard | null>).detail;
        const restored = restoreHoverPreviewMaterials();
        const mGrp = meshGroupRef.current;
        if (!mb || !mGrp) {
          if (restored) needsRenderRef.current = true;
          return;
        }
        const st = useConfiguratorStore.getState();
        const matLookup = new Map<string, MaterialDefinition>(
          [...DEFAULT_MATERIALS, ...(st.project.customMaterials || [])].map((m) => [m.id, m])
        );
        mGrp.children.forEach((modContainer, mIdx) => {
          const mod = st.project.modules[mIdx];
          if (!mod) return;
          const zone = classifyModuleArchitecturalZone(mod);
          const frontDef = matLookup.get(
            zone === "wall"
              ? mb.wallFrontMaterialId
              : zone === "tall_or_island"
              ? mb.tallFrontMaterialId
              : mb.baseFrontMaterialId
          );
          const carcDef = matLookup.get(mb.carcassMaterialId);
          const stoneDef = matLookup.get(mb.countertopMaterialId);
          const plinthDef = matLookup.get(mb.plinthMaterialId);
          const handleDef = matLookup.get(mb.handleMaterialId);

          for (const compGroup of modContainer.children) {
            const role = String(compGroup.userData?.role || "");
            if (!role) continue;
            const grainDir =
              (compGroup.userData?.grainDir as "lengthwise" | "crosswise" | "custom") || "lengthwise";
            const isDoorOrDrawer =
              role === "door" ||
              role.startsWith("door_left") ||
              role.startsWith("door_right") ||
              role === "door_sliding" ||
              role === "drawer_front";
            const isCountertop = role === "countertop" || mod.complementaryRole === "countertop";
            const isPlinth = role === "plinth" || (mod.complementaryRole as string) === "plinth" || mod.complementaryRole === "plinth_strip";
            const isHandleOrGola =
              (role === "door_handle" || role === "drawer_handle" || role === "gola_profile") &&
              compGroup.userData?.handleCategory !== "j_pull" &&
              compGroup.userData?.handleCategory !== "milled_wood_grip";
            const isCarcass = role.startsWith("carcass_") || role === "shelf";

            if (isCountertop && stoneDef) {
              applyTempMatToCompGroup(compGroup, stoneDef, false, grainDir, mb.surfaceFinishOverride);
            } else if (isDoorOrDrawer && frontDef) {
              applyTempMatToCompGroup(compGroup, frontDef, false, grainDir, mb.surfaceFinishOverride);
            } else if (isPlinth && plinthDef) {
              applyTempMatToCompGroup(compGroup, plinthDef, false, grainDir, mb.surfaceFinishOverride);
            } else if (isHandleOrGola && handleDef) {
              applyTempMatToCompGroup(compGroup, handleDef, true, grainDir, mb.surfaceFinishOverride);
            } else if (isCarcass && carcDef) {
              applyTempMatToCompGroup(compGroup, carcDef, false, grainDir, mb.surfaceFinishOverride);
            }
          }
        });
        needsRenderRef.current = true;
      };

      const onFocusShortcutKey = (ke: KeyboardEvent) => {
        const tag = (ke.target as HTMLElement | null)?.tagName || "";
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (ke.target as HTMLElement | null)?.isContentEditable) return;
        if (!ke.ctrlKey && !ke.metaKey && !ke.altKey && (ke.key === "f" || ke.key === "F")) {
          ke.preventDefault();
          window.dispatchEvent(new CustomEvent("birim:fit-camera-3d", { detail: "focus_module" }));
        }
      };
      window.addEventListener("birim:fit-camera-3d", onFitCamera3D);
      window.addEventListener("keydown", onFocusShortcutKey);
      window.addEventListener("birim:set-paint-tool-3d", onPaintTool3D);
      window.addEventListener("birim:preview-material-3d", onPreviewMaterial3D);
      window.addEventListener("birim:preview-moodboard-3d", onPreviewMoodboard3D);
      return () => {
        window.removeEventListener("birim:set-floor-style", onFloorChange);
        window.removeEventListener("birim:set-doors-hidden", onDoorsHiddenChange);
        window.removeEventListener("birim:set-hardware-view-mode", onHwViewModeChange);
        window.removeEventListener("birim:set-material-mode", onMatModeChange);
        window.removeEventListener("birim:set-brush-material", onBrushMatChange);
        window.removeEventListener("birim:set-lighting-preset", onLightPresetChange);
        window.removeEventListener("birim:set-wall-tone", onWallToneChange);
        window.removeEventListener("birim:set-section-3d", onSection3DChange);
        window.removeEventListener("birim:set-room-walls-visible", onRoomWallsChange);
        window.removeEventListener("birim:set-move-mode-3d", onMoveModeChange);
        window.removeEventListener("birim:open-glb-library", onOpenGlbLib);
        window.removeEventListener("birim:fit-camera-3d", onFitCamera3D);
        window.removeEventListener("keydown", onFocusShortcutKey);
        window.removeEventListener("birim:set-paint-tool-3d", onPaintTool3D);
        window.removeEventListener("birim:preview-material-3d", onPreviewMaterial3D);
        window.removeEventListener("birim:preview-moodboard-3d", onPreviewMoodboard3D);
      };
    }, []);
    const [materialModeActive, setMaterialModeActive] = useState<boolean>(false);
    const [materialPaintTool, setMaterialPaintTool] = useState<
      "select" | "paint" | "group" | "same_material"
    >("select");
    const [activeBrushMaterialId, setActiveBrushMaterialId] = useState<string>("mat_veneer_oak");
    const matWorldAnchorsRef = useRef<
      { id: string; worldPos: THREE.Vector3; offsetPx: [number, number] }[]
    >([]);
    const matCalloutDomMapRef = useRef<Map<string, HTMLDivElement>>(new Map());
    const [hardwareViewMode, setHardwareViewMode] = useState<"normal" | "hardware" | "technical">("normal");
    const [hardwareViewMenuOpen, setHardwareViewMenuOpen] = useState<boolean>(false);
    const [selectedHwCalloutId, setSelectedHwCalloutId] = useState<string | null>(null);
    const hwWorldAnchorsRef = useRef<
      { id: string; worldPos: THREE.Vector3; offsetPx: [number, number] }[]
    >([]);
    const hwCalloutDomMapRef = useRef<Map<string, HTMLDivElement>>(new Map());
    const [renderEdgeMode, setRenderEdgeMode] = useState<"photoreal" | "cad">("photoreal");
    const [moveObjectMode3D, setMoveObjectMode3D] = useState<boolean>(false);
    const [invertCameraMouse, setInvertCameraMouse] = useState<boolean>(false);
    const minimalChromeRef = useRef<boolean>(Boolean(minimalChrome));
    minimalChromeRef.current = Boolean(minimalChrome);
    const lastSnapBannerRef = useRef<string | null>(null);
    const snapBannerDomRef = useRef<HTMLDivElement | null>(null);
    const snapBannerTextRef = useRef<HTMLSpanElement | null>(null);
    const snapBadgeDomRef = useRef<HTMLDivElement | null>(null);
    const snapBadgeLabelRef = useRef<HTMLSpanElement | null>(null);
    const snapBadgeYRef = useRef<HTMLSpanElement | null>(null);
    const setSnapBannerDedup = useCallback((msg: string | null) => {
      if (lastSnapBannerRef.current === msg) return;
      lastSnapBannerRef.current = msg;
      const el = snapBannerDomRef.current;
      const txt = snapBannerTextRef.current;
      if (el && txt) {
        if (msg) {
          txt.textContent = msg;
          el.style.display = "flex";
        } else {
          el.style.display = "none";
        }
      }
    }, []);
    const setActive3DSnap = useCallback((snap: ElevationSnapTarget | null) => {
      const el = snapBadgeDomRef.current;
      const lbl = snapBadgeLabelRef.current;
      const yEl = snapBadgeYRef.current;
      if (el && lbl && yEl) {
        if (snap) {
          lbl.textContent = `🎯 Hizalandı: ${snap.label}`;
          yEl.textContent = displayUnitRef.current === "cm" ? `Y: ${Number((snap.elevationY / 10).toFixed(1))} cm` : `Y: ${snap.elevationY} mm`;
          el.style.display = "flex";
        } else {
          el.style.display = "none";
        }
      }
    }, []);
    const active3DSnap: ElevationSnapTarget | null = null;
    const dragDropSnapBanner: string | null = null;
    const roomArchGroupRef = useRef<THREE.Group | null>(null);
    const sceneObjectsGroupRef = useRef<THREE.Group | null>(null);
    const [glbRefreshTick, setGlbRefreshTick] = useState<number>(0);
    const [webglUnavailable, setWebglUnavailable] = useState<boolean>(false);
    const [webglCapability, setWebglCapability] = useState<WebGL2CapabilityReport | null>(null);
    const [webglRetryKey, setWebglRetryKey] = useState<number>(0);
    const hoverBadgeDomRef = useRef<HTMLDivElement | null>(null);
    const hoverBadgeTextRef = useRef<HTMLSpanElement | null>(null);
    const solidMeshesCacheRef = useRef<{ open: THREE.Mesh[]; closed: THREE.Mesh[]; dirty: boolean }>({
      open: [],
      closed: [],
      dirty: true,
    });
    const getCachedSolidMeshes = useCallback((curGroup: THREE.Object3D, includeBayVolumes: boolean) => {
      const cache = solidMeshesCacheRef.current;
      if (cache.dirty) {
        cache.open = collectSolidCabinetMeshes(curGroup, true);
        cache.closed = cache.open.filter((m) => m.userData?.role !== "bay_compartment");
        cache.dirty = false;
      }
      return includeBayVolumes ? cache.open : cache.closed;
    }, []);
    const isOrbitingRef = useRef<boolean>(false);
    const canvasRectRef = useRef<DOMRect | null>(null);
    const [dismissedBayPopover, setDismissedBayPopover] = useState<boolean>(false);
    const [isCtrlPressed, setIsCtrlPressed] = useState<boolean>(false);
    const [webglContextLost, setWebglContextLost] = useState<boolean>(false);
    const cncXrayMode = useConfiguratorStore((s) => s.cncXrayMode);
    const setCncXrayMode = useConfiguratorStore((s) => s.setCncXrayMode);
    const viewportRenderStyle = useConfiguratorStore((s) => s.viewportRenderStyle);
    const setViewportRenderStyle = useConfiguratorStore((s) => s.setViewportRenderStyle);
    const isWireframeMode = viewportRenderStyle === "wireframe";
    const effectiveDoorsHiddenIn3D = doorsHiddenIn3D || viewportRenderStyle === "carcass_only";
    const isXrayActive = cncXrayMode || viewportRenderStyle === "transparent" || hardwareViewMode === "technical";
    const updateCeilingConfigStore = useConfiguratorStore((s) => s.updateCeilingConfig);
    const setFacadeGrainContinuityStore = useConfiguratorStore((s) => s.setFacadeGrainContinuity);
    const setRoomDimensionsStore = useConfiguratorStore((s) => s.setRoomDimensions);
    const updateCarcassStore = useConfiguratorStore((s) => s.updateCarcass);
    const storeBom = useConfiguratorStore((s) => (isXrayActive ? s.bom : null));

    useEffect(() => {
      setDismissedBayPopover(false);
    }, [activeBayIndex, activeModuleIndex, doorsHiddenIn3D]);

    useEffect(() => {
      const onKeyDown = (ev: KeyboardEvent) => {
        if (ev.code === "Space" && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
          const tag = (ev.target as HTMLElement | null)?.tagName?.toLowerCase();
          const isEditable =
            tag === "input" ||
            tag === "textarea" ||
            tag === "select" ||
            Boolean((ev.target as HTMLElement | null)?.isContentEditable);
          if (!isEditable) {
            ev.preventDefault();
            const curSt = useConfiguratorStore.getState();
            const opening = curSt.doorOpenAngleDeg < 15 && curSt.drawerOpenMm < 30;
            curSt.setDoorOpenAngleDeg(opening ? 82 : 0, true);
            curSt.setDrawerOpenMm(opening ? 300 : 0, true);
            return;
          }
        }
        if ((ev.key === "Delete" || ev.key === "Backspace") && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
          const tag = (ev.target as HTMLElement | null)?.tagName?.toLowerCase();
          const isEditable =
            tag === "input" ||
            tag === "textarea" ||
            tag === "select" ||
            Boolean((ev.target as HTMLElement | null)?.isContentEditable);
          if (!isEditable && !pausedRef.current && !(ev as unknown as { __birimDeleteHandled?: boolean }).__birimDeleteHandled) {
            (ev as unknown as { __birimDeleteHandled?: boolean }).__birimDeleteHandled = true;
            const curSt = useConfiguratorStore.getState();
            if (curSt.selectedSceneObjectId) {
              ev.preventDefault();
              removeSceneObjectRef.current(curSt.selectedSceneObjectId);
              return;
            }
            if (curSt.selectedComponentId) {
              ev.preventDefault();
              deleteActiveSelectionSmartRef.current();
              return;
            }
          }
        }
        if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && !ev.shiftKey) {
          const k = ev.key.toLowerCase();
          if (k === "c" || k === "v") {
            const tag = (ev.target as HTMLElement | null)?.tagName?.toLowerCase();
            const isEditable =
              tag === "input" ||
              tag === "textarea" ||
              tag === "select" ||
              Boolean((ev.target as HTMLElement | null)?.isContentEditable);
            if (!isEditable && !pausedRef.current) {
              const curSt = useConfiguratorStore.getState();
              if (k === "c") {
                if (typeof window !== "undefined" && window.getSelection()?.toString()) {
                  return;
                }
                if (curSt.selectedSceneObjectId) {
                  ev.preventDefault();
                  cadCopyClipboardRef.current = {
                    kind: "sceneObject",
                    id: curSt.selectedSceneObjectId,
                  };
                  return;
                }
                const actMod = curSt.project.modules[curSt.activeModuleIndex];
                if (actMod) {
                  ev.preventDefault();
                  cadCopyClipboardRef.current = {
                    kind: "module",
                    moduleId: actMod.id,
                  };
                  return;
                }
              } else if (k === "v" && cadCopyClipboardRef.current) {
                const clip = cadCopyClipboardRef.current;
                if (clip.kind === "sceneObject") {
                  const exists = (curSt.project.sceneObjects || []).some((o) => o.id === clip.id);
                  if (exists) {
                    ev.preventDefault();
                    duplicateSceneObjectRef.current(clip.id);
                    return;
                  }
                } else if (clip.kind === "module") {
                  const mIdx = curSt.project.modules.findIndex((m) => m.id === clip.moduleId);
                  if (mIdx >= 0) {
                    ev.preventDefault();
                    if (curSt.activeModuleIndex !== mIdx) {
                      curSt.setActiveModuleIndex(mIdx);
                    }
                    duplicateActiveModuleRef.current();
                    return;
                  }
                }
              }
            }
          }
        }
        if (ev.key === "Escape") {
          setClicked3DContext(null);
          setEditingBadge(null);
          setRenderMenuOpen(false);
          setHardwareViewMenuOpen(false);
          setSection3DMenuOpen(false);
          setExplode3DMenuOpen(false);
          setDismissedBayPopover(true);
          setSnapBannerDedup(null);
        }
        if ((ev.key === "Control" || ev.key === "Meta") && !ev.shiftKey && !ev.altKey) {
          setIsCtrlPressed(true);
          const canvas = mountRef.current?.querySelector("canvas");
          if (canvas) {
            canvas.style.cursor = "move";
          }
        } else if (ev.shiftKey || ev.altKey) {
          setIsCtrlPressed(false);
        }
      };

      const onKeyUp = (ev: KeyboardEvent) => {
        if (ev.key === "Control" || ev.key === "Meta" || (!ev.ctrlKey && !ev.metaKey)) {
          setIsCtrlPressed(false);
          const canvas = mountRef.current?.querySelector("canvas");
          if (canvas) {
            canvas.style.cursor = "grab";
          }
        }
      };

      const onPointerSyncCtrl = (ev: PointerEvent) => {
        if (!ev.ctrlKey && !ev.metaKey) {
          setIsCtrlPressed((prev) => (prev ? false : prev));
        }
      };

      const onBlur = () => {
        setIsCtrlPressed(false);
        const canvas = mountRef.current?.querySelector("canvas");
        if (canvas) {
          canvas.style.cursor = "grab";
        }
      };

      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      window.addEventListener("pointermove", onPointerSyncCtrl, { passive: true });
      window.addEventListener("blur", onBlur);
      document.addEventListener("visibilitychange", onBlur);
      return () => {
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
        window.removeEventListener("pointermove", onPointerSyncCtrl);
        window.removeEventListener("blur", onBlur);
        document.removeEventListener("visibilitychange", onBlur);
      };
    }, []);
    const cameraFlightRef = useRef<{
      startPos: THREE.Vector3;
      endPos: THREE.Vector3;
      startTarget: THREE.Vector3;
      endTarget: THREE.Vector3;
      startTime: number;
      durationMs: number;
    } | null>(null);
    const hemiLightRef = useRef<THREE.HemisphereLight | null>(null);
    const keyLightRef = useRef<THREE.DirectionalLight | null>(null);
    const rimLightRef = useRef<THREE.DirectionalLight | null>(null);
    const gallerySpotLightRef = useRef<THREE.SpotLight | null>(null);

    const latestStateRef = useRef({
      project,
      activeModuleIndex,
      selectedComponentId,
      doorOpenAngleDeg,
      doorsHiddenIn3D,
      moveObjectMode3D,
      spaceObstacles,
      setActiveModuleIndex,
      setActiveBayIndex,
      setSelectedComponentId,
      selectModuleBayComponent,
      setShelfElevation,
      setDrawerPlacement,
      setSpecialFittingPlacement,
      setHangingRailElevation,
      setBayCustomWidth,
      setSubDividerPlacement,
      setModulePosition,
      resizeModuleParametric,
      finishModuleDragWithSmartSwap,
      updateObstaclePosition,
      updateSceneObject,
      beginHistoryTransaction,
      commitHistoryTransaction,
      addInteriorItemAtElevation,
      setDoorOpenAngleDeg,
    });
    useEffect(() => {
      latestStateRef.current = {
        project,
        activeModuleIndex,
        selectedComponentId,
        doorOpenAngleDeg,
        doorsHiddenIn3D,
        moveObjectMode3D,
        spaceObstacles,
        setActiveModuleIndex,
        setActiveBayIndex,
        setSelectedComponentId,
        selectModuleBayComponent,
        setShelfElevation,
        setDrawerPlacement,
        setSpecialFittingPlacement,
        setHangingRailElevation,
        setBayCustomWidth,
        setSubDividerPlacement,
        setModulePosition,
      resizeModuleParametric,
        finishModuleDragWithSmartSwap,
        updateObstaclePosition,
        updateSceneObject,
        beginHistoryTransaction,
        commitHistoryTransaction,
        addInteriorItemAtElevation,
        setDoorOpenAngleDeg,
      };
    }, [
      project,
      activeModuleIndex,
      selectedComponentId,
      doorOpenAngleDeg,
      doorsHiddenIn3D,
      moveObjectMode3D,
      spaceObstacles,
      setActiveModuleIndex,
      setActiveBayIndex,
      setSelectedComponentId,
      selectModuleBayComponent,
      setShelfElevation,
      setDrawerPlacement,
      setSpecialFittingPlacement,
      setHangingRailElevation,
      setBayCustomWidth,
      setSubDividerPlacement,
      setModulePosition,
      finishModuleDragWithSmartSwap,
      updateObstaclePosition,
      updateSceneObject,
      beginHistoryTransaction,
      commitHistoryTransaction,
      addInteriorItemAtElevation,
      setDoorOpenAngleDeg,
    ]);

    useEffect(() => {
      return () => {
        for (const grp of lifestylePropsCacheRef.current.values()) {
          if (!grp.parent) {
            disposeObject3DTree(grp);
          }
        }
        lifestylePropsCacheRef.current.clear();
      };
    }, []);

    // Sync OrbitControls mouse direction (Natural object rotation vs standard camera orbit)
    useEffect(() => {
      if (controlsRef.current) {
        controlsRef.current.rotateSpeed = invertCameraMouse ? -0.85 : 0.85;
      }
    }, [invertCameraMouse]);

    const effectiveShowDimensions = showDimensions ?? localShowDimensions;
    const handleToggleDimensions = useCallback(() => {
      if (onToggleDimensions) {
        onToggleDimensions();
      } else {
        setLocalShowDimensions((prev) => !prev);
      }
    }, [onToggleDimensions]);

    const dimLabels = useMemo<DimensionAnchor[]>(() => {
      const mod = project.modules[activeModuleIndex] || project.modules[0];
      if (!effectiveShowDimensions || !mod) return [];
      const { width: W, height: H, depth: D } = mod.dimensions;
      const T = mod.carcass.panelThickness || 18;
      const soketW = Math.max(200, W - 2 * T);
      const list: DimensionAnchor[] = [
        {
          id: "dim_W",
          tag: "Genişlik",
          valueText: displayUnit === "cm" ? `${Number((W / 10).toFixed(1))} cm` : `${Math.round(W)} mm`,
          borderColor: "#D6D0C4",
          badgeBg: "#141413",
          localMidpoint: new THREE.Vector3(W * 0.5, H + 195, D * 0.85),
          localStart: new THREE.Vector3(0, H + 195, D * 0.85),
          localEnd: new THREE.Vector3(W, H + 195, D * 0.85),
        },
        {
          id: "dim_H",
          tag: "Yükseklik",
          valueText: displayUnit === "cm" ? `${Number((H / 10).toFixed(1))} cm` : `${Math.round(H)} mm`,
          borderColor: "#D6D0C4",
          badgeBg: "#141413",
          localMidpoint: new THREE.Vector3(W + 175, H * 0.52, D),
          localStart: new THREE.Vector3(W + 175, 0, D),
          localEnd: new THREE.Vector3(W + 175, H, D),
        },
        {
          id: "dim_D",
          tag: "Derinlik",
          valueText: displayUnit === "cm" ? `${Number((D / 10).toFixed(1))} cm` : `${Math.round(D)} mm`,
          borderColor: "#D6D0C4",
          badgeBg: "#57534E",
          localMidpoint: new THREE.Vector3(-145, 18, D * 0.5),
          localStart: new THREE.Vector3(-145, 18, 0),
          localEnd: new THREE.Vector3(-145, 18, D),
        },
      ];

      if (!isSimpleTier) {
        list.push({
          id: "dim_SOKET",
          tag: "İç Net Genişlik",
          valueText: displayUnit === "cm" ? `${Number((soketW / 10).toFixed(1))} cm` : `${Math.round(soketW)} mm`,
          borderColor: "#D6D0C4",
          badgeBg: "#57534E",
          localMidpoint: new THREE.Vector3(W * 0.5, 8, D + 120),
          localStart: new THREE.Vector3(T, 8, D + 120),
          localEnd: new THREE.Vector3(W - T, 8, D + 120),
        });
      }

      if (mod.category !== "complementary" && mod.bays.length >= 1) {
        const fs = calculateFourSpaceDimensions(mod);
        const bayWidths = fs.usableInternal.bayClearWidthsMm;
        const plinthH = mod.carcass.plinthHeight ?? 100;
        const innerBotY = plinthH + T;
        const innerTopY = H - T;
        let curX = T;
        mod.bays.forEach((b, bIdx) => {
          const bw = bayWidths[bIdx] || Math.round((W - (mod.bays.length + 1) * T) / mod.bays.length);
          const midX = curX + bw * 0.5;
          // SketchUp-style contextual declutter: Kolay modda yalnızca aktif bölme genişliği gösterilir
          if (!isSimpleTier || bIdx === activeBayIndex) {
            list.push({
              id: `dim_BAY_${bIdx}`,
              tag: `${bIdx + 1}. Bölme`,
              valueText: displayUnit === "cm" ? `${Number((bw / 10).toFixed(1))} cm` : `${Math.round(bw)} mm`,
              borderColor: "#D6D0C4",
              badgeBg: "#141413",
              localMidpoint: new THREE.Vector3(midX, H + 34, D * 0.94),
              localStart: new THREE.Vector3(curX, H + 34, D * 0.94),
              localEnd: new THREE.Vector3(curX + bw, H + 34, D * 0.94),
            });
          }

          // Seçili raf için canlı Üst / Alt Net Boşluk ölçüleri
          if (bIdx === activeBayIndex && selectedComponentId) {
            const visibleShelves = (b.shelves || [])
              .filter((sh) => !sh.isHidden)
              .sort((a, z) => (a.elevationY ?? 0) - (z.elevationY ?? 0));
            const selIdx = visibleShelves.findIndex((sh) => sh.id === selectedComponentId);
            if (selIdx >= 0) {
              const selShelf = visibleShelves[selIdx];
              const shelfT = selShelf.thickness || T;
              const shelfBotY = plinthH + T + (selShelf.elevationY ?? 0);
              const shelfTopY = shelfBotY + shelfT;
              const prevTopY =
                selIdx > 0
                  ? plinthH + T + (visibleShelves[selIdx - 1].elevationY ?? 0) + (visibleShelves[selIdx - 1].thickness || T)
                  : innerBotY;
              const nextBotY =
                selIdx < visibleShelves.length - 1
                  ? plinthH + T + (visibleShelves[selIdx + 1].elevationY ?? 0)
                  : innerTopY;
              const gapBelow = Math.max(0, Math.round(shelfBotY - prevTopY));
              const gapAbove = Math.max(0, Math.round(nextBotY - shelfTopY));
              const fmtGap = (mm: number) =>
                displayUnit === "cm" ? `${Number((mm / 10).toFixed(1))} cm` : `${mm} mm`;

              if (gapAbove >= 40) {
                list.push({
                  id: "dim_SHELF_GAP_ABOVE",
                  tag: "Üst Boşluk",
                  valueText: fmtGap(gapAbove),
                  borderColor: "#93C5FD",
                  badgeBg: "#1D4ED8",
                  localMidpoint: new THREE.Vector3(midX, shelfTopY + gapAbove * 0.5, D + 26),
                  localStart: new THREE.Vector3(midX, shelfTopY, D + 26),
                  localEnd: new THREE.Vector3(midX, nextBotY, D + 26),
                });
              }
              if (gapBelow >= 40) {
                list.push({
                  id: "dim_SHELF_GAP_BELOW",
                  tag: "Alt Boşluk",
                  valueText: fmtGap(gapBelow),
                  borderColor: "#93C5FD",
                  badgeBg: "#1D4ED8",
                  localMidpoint: new THREE.Vector3(midX, prevTopY + gapBelow * 0.5, D + 26),
                  localStart: new THREE.Vector3(midX, prevTopY, D + 26),
                  localEnd: new THREE.Vector3(midX, shelfBotY, D + 26),
                });
              }
            }
          }
          curX += bw + T;
        });
      }

      const mainMods = project.modules.filter((m) => m.category !== "complementary");
      if (mainMods.length > 1) {
        const minX = Math.min(...mainMods.map((m) => m.position.x));
        const maxX = Math.max(...mainMods.map((m) => m.position.x + m.dimensions.width));
        const maxH = Math.max(...mainMods.map((m) => m.position.y + m.dimensions.height));
        const spanMm = Math.round(maxX - minX);
        list.push({
          id: "dim_TOTAL_SPAN",
          tag: "Toplam Genişlik",
          valueText: displayUnit === "cm" ? `${Number((spanMm / 10).toFixed(1))} cm` : `${Math.round(spanMm)} mm`,
          borderColor: "#D6D0C4",
          badgeBg: "#141413",
          localMidpoint: new THREE.Vector3((minX + maxX) * 0.5, maxH + 260, 300),
          localStart: new THREE.Vector3(minX, maxH + 260, 300),
          localEnd: new THREE.Vector3(maxX, maxH + 260, 300),
        });
      }

      return list;
    }, [project, activeModuleIndex, activeBayIndex, selectedComponentId, effectiveShowDimensions, isSimpleTier, displayUnit]);

    const hwCallouts = useMemo(() => {
      const mod = project.modules[activeModuleIndex] || project.modules[0];
      if (!mod || mod.category === "complementary") return [];
      const { width: W, height: H, depth: D } = mod.dimensions;
      const T = mod.carcass.panelThickness || 18;
      const plinthH = mod.carcass.plinthHeight ?? 100;
      const fs = calculateFourSpaceDimensions(mod);
      const bayWidths = fs.usableInternal.bayClearWidthsMm;

      const bayStartXs: number[] = [];
      let accX = T;
      mod.bays.forEach((_, idx) => {
        bayStartXs.push(accX);
        accX += (bayWidths[idx] || 550) + T;
      });

      const targetBayIdx = Math.min(activeBayIndex, Math.max(0, mod.bays.length - 1));
      const targetBay = mod.bays[targetBayIdx] || mod.bays[0];
      const dSys = targetBay?.door?.doorSystemId || "hinged_single";
      const doorHwId = targetBay?.door?.hardwareProductId || "hw_blum_71b3550";
      const doorHw = hardwareCatalog.find((h) => h.id === doorHwId);

      // 1. Hinge / Door Mechanism Callout
      const hingeLeaveSpec = fs.doorLeaves[0] || fs.doorLeaves[targetBayIdx];
      const topHingeY =
        hingeLeaveSpec?.hingePositionsY?.[hingeLeaveSpec.hingePositionsY.length - 1] ||
        Math.round((H - plinthH - 2 * T) * 0.76);
      const isSlidingSys = dSys.startsWith("sliding");
      const slideMount =
        dSys === "sliding_coplanar"
          ? "coplanar_flush"
          : mod.carcass.slidingMountingType || targetBay?.door?.slidingMountingType || "top_hung_pelmet";
      const hingeTitle = dSys.startsWith("hinged")
        ? "Menteşe"
        : isSlidingSys
        ? "Sürgü Sistemi"
        : "Açılma Sistemi";
      const hingeSub = isSlidingSys
        ? slideMount === "inset_inside"
          ? "Häfele Slido F-Line21 (İçten)"
          : slideMount === "top_hung_exposed"
          ? "Hettich TopLine XL (Açık Ray)"
          : slideMount === "coplanar_flush"
          ? "Hettich InLine XL (Koplanar)"
          : "Hettich TopLine XL (Alın Kapamalı)"
        : doorHw
        ? doorHw.id === "hw_blum_71b3550"
          ? "Blum Clip-Top 110°"
          : doorHw.id === "hw_blum_71b7550"
          ? "Blum Clip-Top 155°"
          : doorHw.id === "hw_hettich_9071205"
          ? "Hettich Sensys 110°"
          : doorHw.id === "hw_salice_c7p6ae9"
          ? "Salice Silentia+ 110°"
          : `${doorHw.manufacturerName.split(" ")[0]} • ${doorHw.sku}`
        : "Blum Clip-Top 110°";

      // 2. LED Lighting Callout
      const hasLed = mod.bays.some((b) =>
        (b.specialFittings || []).some((f) => f.type.startsWith("led_"))
      );
      const ledKelvin = mod.carcass.ledColorTempK || 3000;
      const midBayIdx = Math.min(Math.floor(mod.bays.length / 2), mod.bays.length - 1);
      const midBayCenterX =
        (bayStartXs[midBayIdx] || T) + (bayWidths[midBayIdx] || 550) * 0.5;

      // 3. Hanging Rail / Interior Mechanism Callout
      const railBayIdx =
        mod.bays.findIndex((b) => b.hangingRails.length > 0) >= 0
          ? mod.bays.findIndex((b) => b.hangingRails.length > 0)
          : targetBayIdx;
      const railObj = mod.bays[railBayIdx]?.hangingRails?.[0];
      const hasWardrobeLift = mod.bays.some((b) =>
        (b.specialFittings || []).some((f) => f.type === "wardrobe_lift")
      );
      const railElevY = railObj?.elevationY || Math.round((H - plinthH - 2 * T) * 0.78);
      const railCenterX =
        (bayStartXs[railBayIdx] || T) + (bayWidths[railBayIdx] || 550) * 0.58;

      // 4. Drawer Runner Callout
      const drwBayIdx =
        mod.bays.findIndex((b) => b.drawers.length > 0) >= 0
          ? mod.bays.findIndex((b) => b.drawers.length > 0)
          : mod.bays.length - 1;
      const firstDrw = mod.bays[drwBayIdx]?.drawers?.[0];
      const drwHwId = firstDrw?.hardwareProductId || "hw_blum_tandembox_m30";
      const drwHw = hardwareCatalog.find((h) => h.id === drwHwId);
      const drwNl =
        firstDrw?.nominalLengthMm ||
        Math.min(550, Math.max(350, Math.floor((fs.usableInternal.netInnerDepthMm - 10) / 50) * 50));
      const runnerSub = drwHw
        ? drwHw.id.includes("tandembox")
          ? `Blum Tandem ${drwNl} mm`
          : drwHw.id.includes("movento")
          ? `Blum Movento ${drwNl} mm`
          : drwHw.id.includes("hettich")
          ? `Hettich AvanTech ${drwNl} mm`
          : `Blum LEGRABOX ${drwNl} mm`
        : `Blum Tandem ${drwNl} mm`;
      const drwElevY = firstDrw ? firstDrw.elevationY + firstDrw.height * 0.5 : 180;
      const drwPinX = (bayStartXs[drwBayIdx] || T) + 24;

      const hasDoor =
        !mod.isOpenFront &&
        targetBay?.door &&
        targetBay.door.type !== "open" &&
        targetBay.door.doorSystemId !== "open";
      const hasAnyRail =
        Boolean(railObj) ||
        hasWardrobeLift ||
        mod.bays.some((b) => b.hangingRails && b.hangingRails.length > 0);
      const hasAnyDrawer =
        Boolean(firstDrw) ||
        mod.bays.some((b) => b.drawers && b.drawers.length > 0);

      const activeCallouts: {
        id: string;
        group: "hinge" | "lighting" | "accessories" | "runner";
        bayIndex: number;
        title: string;
        subtitle: string;
        sku: string;
        localPos: THREE.Vector3;
        offsetPx: [number, number];
      }[] = [];

      if (hasDoor) {
        activeCallouts.push({
          id: "hw_pin_hinge",
          group: "hinge",
          bayIndex: targetBayIdx,
          title: hingeTitle,
          subtitle: hingeSub,
          sku: doorHw?.sku || "71B3550",
          localPos: new THREE.Vector3(T + 12, plinthH + T + topHingeY, D + 14),
          offsetPx: [-24, -44],
        });
      }

      if (hasLed) {
        activeCallouts.push({
          id: "hw_pin_led",
          group: "lighting",
          bayIndex: midBayIdx,
          title: "LED Aydınlatma",
          subtitle: `Profil – ${ledKelvin}K`,
          sku: "833.74.700",
          localPos: new THREE.Vector3(midBayCenterX, H - T - 14, D * 0.82),
          offsetPx: [42, -38],
        });
      }

      if (hasAnyRail) {
        activeCallouts.push({
          id: "hw_pin_rail",
          group: "accessories",
          bayIndex: railBayIdx,
          title: "Askılık",
          subtitle: hasWardrobeLift ? "Servetto Asansör 10kg" : "Oval – Krom",
          sku: hasWardrobeLift ? "805.20.232" : "HW_HANGING_RAIL",
          localPos: new THREE.Vector3(railCenterX, plinthH + T + railElevY, D * 0.62),
          offsetPx: [52, 22],
        });
      }

      if (hasAnyDrawer) {
        activeCallouts.push({
          id: "hw_pin_runner",
          group: "runner",
          bayIndex: drwBayIdx,
          title: "Çekmece Rayı",
          subtitle: runnerSub,
          sku: drwHw?.sku || "578.5001M",
          localPos: new THREE.Vector3(drwPinX, plinthH + T + drwElevY, D * 0.88),
          offsetPx: [48, -32],
        });
      }

      return activeCallouts;
    }, [project, activeModuleIndex, activeBayIndex, hardwareCatalog]);

    const matCallouts = useMemo(() => {
      const mod = project.modules[activeModuleIndex] || project.modules[0];
      if (!mod || mod.category === "complementary") return [];
      const { width: W, height: H, depth: D } = mod.dimensions;
      const T = mod.carcass.panelThickness || 18;
      const plinthH = mod.carcass.plinthHeight ?? 100;
      const overrides = mod.componentMaterialOverrides || {};

      const formatShortMat = (matId?: string) => {
        const m = DEFAULT_MATERIALS.find((it) => it.id === matId) || DEFAULT_MATERIALS[0];
        const shortName = m.name
          .replace(/^Kastamonu Entegre\s+/i, "")
          .replace(/^Yıldız Entegre\s+/i, "")
          .replace(/^Çamsan Entegre\s+/i, "")
          .replace(/^AGT\s+/i, "")
          .split(" (")[0];
        return {
          label: shortName,
          colorHex: m.colorHex,
          matId: m.id,
        };
      };

      const topCompId = `${mod.id}_top`;
      const topMat = formatShortMat(overrides[topCompId] || mod.carcass.bodyMaterialId);

      const firstBay = mod.bays[0];
      const doorCompId = `${firstBay?.door?.id || `${mod.id}_door_0`}_${
        firstBay?.door?.type === "double" ? "leaf_left" : "left"
      }`;
      const doorMat = formatShortMat(
        overrides[doorCompId] || firstBay?.door?.doorMaterialId || mod.carcass.doorMaterialId
      );

      const rightSideCompId = `${mod.id}_side_right`;
      const rightSideMat = formatShortMat(overrides[rightSideCompId] || mod.carcass.bodyMaterialId);

      const drwBay = mod.bays.find((b) => b.drawers.length > 0) || firstBay;
      const firstDrw = drwBay?.drawers?.[0];
      const drwFrontId = firstDrw ? `${firstDrw.id}_front` : `${mod.id}_drw_0_front`;
      const drwMat = formatShortMat(
        overrides[drwFrontId] || firstDrw?.frontMaterialId || mod.carcass.doorMaterialId
      );

      const plinthCompId = `${mod.id}_plinth`;
      const plinthMat = formatShortMat(
        overrides[plinthCompId] ||
          overrides.__plinth__ ||
          mod.carcass.plinthMaterialId ||
          mod.carcass.bodyMaterialId
      );

      return [
        {
          id: "mat_pin_top",
          scope: "carcass" as const,
          componentId: topCompId,
          title: "Üst Tabla",
          subtitle: topMat.label,
          colorHex: topMat.colorHex,
          localPos: new THREE.Vector3(W * 0.45, H - T * 0.5, D * 0.85),
          offsetPx: [-10, -48] as [number, number],
        },
        {
          id: "mat_pin_door",
          scope: "doors" as const,
          componentId: doorCompId,
          title: "Kapak",
          subtitle: doorMat.label,
          colorHex: doorMat.colorHex,
          localPos: new THREE.Vector3(W * 0.24, H * 0.65, D + 18),
          offsetPx: [-24, -46] as [number, number],
        },
        {
          id: "mat_pin_side_right",
          scope: "selected_part" as const,
          componentId: rightSideCompId,
          title: "Sağ Yan Panel",
          subtitle: rightSideMat.label,
          colorHex: rightSideMat.colorHex,
          localPos: new THREE.Vector3(W, H * 0.45, D * 0.55),
          offsetPx: [18, -36] as [number, number],
        },
        {
          id: "mat_pin_drawer",
          scope: "drawers" as const,
          componentId: drwFrontId,
          title: "Çekmece Önü",
          subtitle: drwMat.label,
          colorHex: drwMat.colorHex,
          localPos: new THREE.Vector3(W * 0.42, plinthH + 140, D + 18),
          offsetPx: [-85, -42] as [number, number],
        },
        {
          id: "mat_pin_plinth",
          scope: "plinth" as const,
          componentId: plinthCompId,
          title: "Soket",
          subtitle: plinthMat.label,
          colorHex: plinthMat.colorHex,
          localPos: new THREE.Vector3(W * 0.36, Math.max(20, plinthH * 0.5), D - 10),
          offsetPx: [-12, 16] as [number, number],
        },
      ];
    }, [project, activeModuleIndex]);

    const sceneRef = useRef<THREE.Scene | null>(null);
    const perspCamRef = useRef<THREE.PerspectiveCamera | null>(null);
    const orthoCamRef = useRef<THREE.OrthographicCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const meshGroupRef = useRef<THREE.Group | null>(null);
    const sectionCapGroupRef = useRef<THREE.Group | null>(null);
    const dimGroupRef = useRef<THREE.Group | null>(null);
    const ghostSnapGroupRef = useRef<THREE.Group | null>(null);
    const lastGhostKeyRef = useRef<string>("");
    const lastAccessoryDropTargetRef = useRef<{ bayIndex: number; elevationY: number; offsetX?: number; accessory: any } | null>(null);
    const selectionFrameGroupRef = useRef<THREE.Group | null>(null);
    const activeModFrameGroupRef = useRef<THREE.Group | null>(null);
    const dimWorldAnchorsRef = useRef<{ id: string; worldPos: THREE.Vector3; worldStart?: THREE.Vector3; worldEnd?: THREE.Vector3; isActiveMod?: boolean }[]>([]);
    const liveDimDeltaRef = useRef<{ dx: number; dz: number }>({ dx: 0, dz: 0 });
    const dimLabelDomMapRef = useRef<Map<string, HTMLDivElement>>(new Map());
    const gridRef = useRef<THREE.GridHelper | null>(null);
    const shadowPlaneRef = useRef<THREE.Mesh | null>(null);
    const needsRenderRef = useRef<boolean>(true);

    const [glbCatalogRev, setGlbCatalogRev] = useState(0);
    const [glbLibraryOpen, setGlbLibraryOpen] = useState(false);

    const previewOriginalMatsRef = useRef<Map<THREE.Object3D, THREE.Material | THREE.Material[]>>(
      new Map()
    );
    const restoreHoverPreviewMaterials = useCallback(() => {
      if (previewOriginalMatsRef.current.size === 0) return false;
      previewOriginalMatsRef.current.forEach((origMat, obj) => {
        if ((obj as THREE.Mesh).isMesh || (obj as THREE.InstancedMesh).isInstancedMesh) {
          (obj as THREE.Mesh).material = origMat;
        }
      });
      previewOriginalMatsRef.current.clear();
      return true;
    }, []);

    const [paintTool3D, setPaintTool3D] = useState<PaintTool3DState>({
      mode: "none",
      materialId: "mat_veneer_oak",
      clickBehavior: "active_scope",
      zoneScope: "active_doors",
    });
    const paintTool3DRef = useRef<PaintTool3DState>(paintTool3D);
    paintTool3DRef.current = paintTool3D;

    const fitKeyLightShadowToSceneBounds = useCallback(() => {
      const kl = keyLightRef.current;
      if (!kl || !kl.castShadow) return;
      const mods = useConfiguratorStore.getState().project.modules;
      const bounds = computeFastParametricSceneBounds(mods);
      if (bounds.isEmpty()) return;
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      const maxSpan = Math.max(1200, size.x, size.y, size.z);
      const halfSpan = Math.min(4800, Math.max(1050, maxSpan * 0.68 + 340));

      kl.target.position.set(center.x, Math.max(420, center.y * 0.78), center.z);
      kl.target.updateMatrixWorld();
      kl.position.set(center.x - halfSpan * 1.05, center.y + halfSpan * 1.48, center.z + halfSpan * 1.42);
      const sCam = kl.shadow.camera;
      if (
        Math.abs(sCam.left + halfSpan) > 40 ||
        Math.abs(sCam.right - halfSpan) > 40 ||
        Math.abs(sCam.top - halfSpan * 1.08) > 40
      ) {
        sCam.left = -halfSpan;
        sCam.right = halfSpan;
        sCam.top = halfSpan * 1.08;
        sCam.bottom = -halfSpan * 0.72;
        sCam.near = 180;
        sCam.far = Math.max(8500, halfSpan * 4.8);
        sCam.updateProjectionMatrix();
      }
    }, []);

    const markShadowsAndRender = useCallback(() => {
      fitKeyLightShadowToSceneBounds();
      if (rendererRef.current && rendererRef.current.shadowMap.enabled) {
        rendererRef.current.shadowMap.needsUpdate = true;
      }
      needsRenderRef.current = true;
    }, [fitKeyLightShadowToSceneBounds]);

    useEffect(() => {
      if (showInteriorProps3D) {
        preloadAllWardrobeGlbAssets();
      }
    }, [showInteriorProps3D]);

    useEffect(() => {
      const unsubRender = subscribeWardrobeGlbRenderNeeded(() => {
        needsRenderRef.current = true;
      });
      const unsubCatalog = subscribeWardrobeGlbCatalogChange(() => {
        setGlbCatalogRev((rev) => rev + 1);
      });
      return () => {
        unsubRender();
        unsubCatalog();
      };
    }, []);

    const updateProjectedDimensionLabels = useCallback(() => {
      const curRenderer = rendererRef.current;
      const cam = (controlsRef.current?.object as THREE.Camera) || perspCamRef.current;
      if (!curRenderer || !cam) return;
      const cachedRect = canvasRectRef.current;
      const w = cachedRect && cachedRect.width > 0 ? cachedRect.width : curRenderer.domElement.clientWidth;
      const h = cachedRect && cachedRect.height > 0 ? cachedRect.height : curRenderer.domElement.clientHeight;
      if (w === 0 || h === 0) return;

      cam.updateMatrixWorld();
      const placed: { id: string; x: number; y: number; angleDeg: number; visible: boolean }[] = [];

      const { dx: dimDx, dz: dimDz } = liveDimDeltaRef.current;
      for (const item of dimWorldAnchorsRef.current) {
        const anchorPos = item.isActiveMod && (dimDx !== 0 || dimDz !== 0)
          ? new THREE.Vector3(item.worldPos.x + dimDx, item.worldPos.y, item.worldPos.z + dimDz)
          : item.worldPos.clone();
        const ndc = anchorPos.project(cam);
        if (ndc.z > 1) {
          placed.push({ id: item.id, x: 0, y: 0, angleDeg: 0, visible: false });
          continue;
        }
        let angleDeg = 0;
        if (item.worldStart && item.worldEnd) {
          const pA = item.isActiveMod && (dimDx !== 0 || dimDz !== 0)
            ? new THREE.Vector3(item.worldStart.x + dimDx, item.worldStart.y, item.worldStart.z + dimDz)
            : item.worldStart.clone();
          const pB = item.isActiveMod && (dimDx !== 0 || dimDz !== 0)
            ? new THREE.Vector3(item.worldEnd.x + dimDx, item.worldEnd.y, item.worldEnd.z + dimDz)
            : item.worldEnd.clone();
          const ndcA = pA.project(cam);
          const ndcB = pB.project(cam);
          const sx1 = (ndcA.x + 1) * 0.5 * w;
          const sy1 = (-ndcA.y + 1) * 0.5 * h;
          const sx2 = (ndcB.x + 1) * 0.5 * w;
          const sy2 = (-ndcB.y + 1) * 0.5 * h;
          const ldx = sx2 - sx1;
          const ldy = sy2 - sy1;
          if (Math.hypot(ldx, ldy) > 10) {
            angleDeg = (Math.atan2(ldy, ldx) * 180) / Math.PI;
            if (angleDeg > 90) angleDeg -= 180;
            if (angleDeg < -90) angleDeg += 180;
          }
        }
        const rawX = (ndc.x + 1) * 0.5 * w;
        const rawY = (-ndc.y + 1) * 0.5 * h;
        let x = Math.max(72, Math.min(w - 72, rawX));
        let y = Math.max(64, Math.min(h - 68, rawY));

        // SketchUp-style 2-pass screen-space de-overlap so labels never stack on top of each other
        for (let pass = 0; pass < 2; pass += 1) {
          for (const prev of placed) {
            if (!prev.visible) continue;
            if (Math.abs(x - prev.x) < 120 && Math.abs(y - prev.y) < 30) {
              y = prev.y + (y >= prev.y ? 34 : -34);
              y = Math.max(68, Math.min(h - 74, y));
            }
          }
        }
        placed.push({ id: item.id, x, y, angleDeg, visible: true });
      }

      for (const p of placed) {
        const el = dimLabelDomMapRef.current.get(p.id);
        if (!el) continue;
        if (!p.visible) {
          el.style.opacity = "0";
        } else {
          const uOff = customLabelOffsetsRef.current[p.id] || { dx: 0, dy: 0 };
          el.style.opacity = "1";
          el.style.transform = `translate3d(${Math.round(p.x + uOff.dx)}px, ${Math.round(p.y + uOff.dy)}px, 0) translate(-50%, -50%) rotate(${p.angleDeg.toFixed(1)}deg)`;
        }
      }

      if (bayPopoverDomRef.current) {
        const customBayPos = floatingPanelPosRef.current.bay;
        if (customBayPos) {
          bayPopoverDomRef.current.style.opacity = "1";
          bayPopoverDomRef.current.style.transform = `translate3d(${customBayPos.x}px, ${customBayPos.y}px, 0)`;
        } else if (dockedToCornerRef.current) {
          const rInset = stageSafeInsetsRef.current?.rightPx ?? 16;
          const tInset = stageSafeInsetsRef.current?.topPx ?? 14;
          const dockX = Math.max(16, w - rInset - 296);
          const dockY = Math.max(68, tInset + 54);
          bayPopoverDomRef.current.style.opacity = "1";
          bayPopoverDomRef.current.style.transform = `translate3d(${Math.round(dockX)}px, ${dockY}px, 0)`;
        } else if (activeBayWorldAnchorRef.current) {
          const ndc = activeBayWorldAnchorRef.current.clone().project(cam);
          if (ndc.z > 1) {
            bayPopoverDomRef.current.style.opacity = "0";
          } else {
            const px = Math.max(120, Math.min(w - 304, (ndc.x + 1) * 0.5 * w + 54));
            const py = Math.max(80, Math.min(h - 240, (-ndc.y + 1) * 0.5 * h - 120));
            bayPopoverDomRef.current.style.opacity = "1";
            bayPopoverDomRef.current.style.transform = `translate3d(${Math.round(px)}px, ${Math.round(py)}px, 0)`;
          }
        }
      }
      if (doorPopoverDomRef.current) {
        const customDoorPos = floatingPanelPosRef.current.door;
        if (customDoorPos) {
          doorPopoverDomRef.current.style.opacity = "1";
          doorPopoverDomRef.current.style.transform = `translate3d(${customDoorPos.x}px, ${customDoorPos.y}px, 0)`;
        } else if (dockedToCornerRef.current) {
          const rInset = stageSafeInsetsRef.current?.rightPx ?? 16;
          const tInset = stageSafeInsetsRef.current?.topPx ?? 14;
          const dockX = Math.max(16, w - rInset - 296);
          const dockY = Math.max(68, tInset + 54);
          doorPopoverDomRef.current.style.opacity = "1";
          doorPopoverDomRef.current.style.transform = `translate3d(${Math.round(dockX)}px, ${dockY}px, 0)`;
        } else if (activeDoorWorldAnchorRef.current) {
          const ndc = activeDoorWorldAnchorRef.current.clone().project(cam);
          if (ndc.z > 1) {
            doorPopoverDomRef.current.style.opacity = "0";
          } else {
            const px = Math.max(120, Math.min(w - 304, (ndc.x + 1) * 0.5 * w + 18));
            const py = Math.max(80, Math.min(h - 240, (-ndc.y + 1) * 0.5 * h - 120));
            doorPopoverDomRef.current.style.opacity = "1";
            doorPopoverDomRef.current.style.transform = `translate3d(${Math.round(px)}px, ${Math.round(py)}px, 0)`;
          }
        }
      }
      for (const hwAnchor of hwWorldAnchorsRef.current) {
        const el = hwCalloutDomMapRef.current.get(hwAnchor.id);
        if (!el) continue;
        const ndc = hwAnchor.worldPos.clone().project(cam);
        if (ndc.z > 1) {
          el.style.opacity = "0";
        } else {
          const uOff = customLabelOffsetsRef.current[hwAnchor.id] || { dx: 0, dy: 0 };
          const px = Math.max(45, Math.min(w - 110, (ndc.x + 1) * 0.5 * w + uOff.dx));
          const py = Math.max(45, Math.min(h - 65, (-ndc.y + 1) * 0.5 * h + uOff.dy));
          el.style.opacity = "1";
          el.style.transform = `translate3d(${Math.round(px)}px, ${Math.round(py)}px, 0)`;
        }
      }
      for (const matAnchor of matWorldAnchorsRef.current) {
        const el = matCalloutDomMapRef.current.get(matAnchor.id);
        if (!el) continue;
        const ndc = matAnchor.worldPos.clone().project(cam);
        if (ndc.z > 1) {
          el.style.opacity = "0";
        } else {
          const uOff = customLabelOffsetsRef.current[matAnchor.id] || { dx: 0, dy: 0 };
          const px = Math.max(45, Math.min(w - 110, (ndc.x + 1) * 0.5 * w + uOff.dx));
          const py = Math.max(45, Math.min(h - 65, (-ndc.y + 1) * 0.5 * h + uOff.dy));
          el.style.opacity = "1";
          el.style.transform = `translate3d(${Math.round(px)}px, ${Math.round(py)}px, 0)`;
        }
      }
    }, []);

    const requestRender = useCallback(() => {
      needsRenderRef.current = true;
    }, []);

    // Initialize WebGL Scene once — never destroyed across mode switches
    useEffect(() => {
      const container = mountRef.current;
      if (!container) return;

      const width = container.clientWidth || 800;
      const height = container.clientHeight || 600;

      const scene = new THREE.Scene();
      const bgHex =
        theme === "warm-light"
          ? 0x262a33
          : theme === "showroom-neutral"
          ? 0x22252d
          : 0x14161b;
      scene.background = new THREE.Color(bgHex);
      sceneRef.current = scene;

      // 30° Architectural Telephoto Lens at Human Eye-Level (eliminates security-camera downward distortion)
      const perspCamera = new THREE.PerspectiveCamera(30, width / height, 15, 28000);
      perspCamera.position.set(2050, 1820, 7650);
      perspCamRef.current = perspCamera;

      const aspect = width / height;
      const orthoD = 1950;
      const orthoCamera = new THREE.OrthographicCamera(
        -orthoD * aspect,
        orthoD * aspect,
        orthoD,
        -orthoD,
        -50000,
        50000
      );
      orthoCamera.position.set(2050, 1820, 7650);
      orthoCamRef.current = orthoCamera;

      const safeGl = createSafeWebGL2Renderer({
        forceRefreshProbe: webglRetryKey > 0,
        preferAlpha: false,
      });
      setWebglCapability(safeGl.ok ? safeGl.bundle.capability : safeGl.capability);
      if (!safeGl.ok) {
        setWebglUnavailable(true);
        return;
      }
      setWebglUnavailable(false);

      const renderer = safeGl.bundle.renderer;
      const isLegacyGpu = safeGl.bundle.capability.isLegacyOrLowSpecGpu;
      let restSharpDpr = isLegacyGpu ? 1 : Math.min(Math.max(window.devicePixelRatio || 1, 1.5), 2.5);
      let motionFastDpr = isLegacyGpu ? 1 : Math.min(window.devicePixelRatio || 1, 1.35);
      let currentAppliedDpr = restSharpDpr;
      const onRenderQualityChange = (ev: Event) => {
        const qTier = (ev as CustomEvent<"performance" | "hd" | "ultra">).detail || "ultra";
        const nativeDpr = window.devicePixelRatio || 1;
        if (qTier === "performance") {
          restSharpDpr = 1;
          motionFastDpr = 1;
          applyMaxAnisotropyToCachedTextures(2);
        } else if (qTier === "hd") {
          restSharpDpr = Math.min(Math.max(nativeDpr, 1.35), 1.85);
          motionFastDpr = Math.min(nativeDpr, 1.25);
          applyMaxAnisotropyToCachedTextures(8);
        } else {
          restSharpDpr = Math.min(Math.max(nativeDpr, 1.65), 2.5);
          motionFastDpr = Math.min(Math.max(nativeDpr, 1.25), 1.5);
          if (renderer.capabilities?.getMaxAnisotropy) {
            applyMaxAnisotropyToCachedTextures(renderer.capabilities.getMaxAnisotropy());
          }
        }
        renderer.setPixelRatio(restSharpDpr);
        currentAppliedDpr = restSharpDpr;
        // Clear module render signatures so upgraded 1024px/512px procedural PBR maps rebind immediately!
        if (meshGroupRef.current) {
          meshGroupRef.current.children.forEach((ch) => {
            if (ch.userData) ch.userData.renderSig = "";
          });
        }
        renderer.shadowMap.needsUpdate = true;
        needsRenderRef.current = true;
      };
      window.addEventListener("birim:set-render-quality", onRenderQualityChange);
      let settleSharpTimer: ReturnType<typeof setTimeout> | null = null;
      const setAdaptiveDpr = (dprVal: number) => {
        if (Math.abs(currentAppliedDpr - dprVal) < 0.02) return;
        currentAppliedDpr = dprVal;
        renderer.setPixelRatio(dprVal);
        needsRenderRef.current = true;
      };
      renderer.setSize(width, height);
      renderer.setPixelRatio(restSharpDpr);
      renderer.shadowMap.enabled = !isLegacyGpu;
      renderer.shadowMap.autoUpdate = false;
      renderer.shadowMap.needsUpdate = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      const agxToneMapping = (THREE as unknown as { AgXToneMapping?: THREE.ToneMapping }).AgXToneMapping;
      renderer.toneMapping = agxToneMapping ?? THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.94;
      if (!isLegacyGpu && renderer.capabilities?.getMaxAnisotropy) {
        applyMaxAnisotropyToCachedTextures(renderer.capabilities.getMaxAnisotropy());
      }
      rendererRef.current = renderer;
      container.appendChild(renderer.domElement);
      canvasRectRef.current = renderer.domElement.getBoundingClientRect();

      const activeCam = isOrthographic ? orthoCamera : perspCamera;
      const controls = new OrbitControls(activeCam, renderer.domElement);
      controls.mouseButtons = {
        LEFT: THREE.MOUSE.PAN,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.ROTATE,
      };
      controls.touches = {
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN,
      };
      controls.rotateSpeed = invertCameraMouse ? -0.85 : 0.85;
      controls.screenSpacePanning = true;
      controls.enableDamping = true;
      controls.dampingFactor = 0.09;
      controls.maxDistance = 14000;
      controls.minDistance = 250;
      controls.minPolarAngle = 0.03;
      // Allow orbiting well below target elevation (up to ~65° upward pitch from floor level)
      // so users can freely lower the camera to countertop, plinth, or under-wall-cabinet eye level!
      controls.maxPolarAngle = Math.PI * 0.86;
      controls.target.set(850, 1080, 300);
      controls.addEventListener("start", () => {
        cameraFlightRef.current = null;
        isOrbitingRef.current = true;
        if (settleSharpTimer) {
          clearTimeout(settleSharpTimer);
          settleSharpTimer = null;
        }
        setAdaptiveDpr(motionFastDpr);
      });
      controls.addEventListener("end", () => {
        isOrbitingRef.current = false;
        if (settleSharpTimer) clearTimeout(settleSharpTimer);
        settleSharpTimer = setTimeout(() => {
          settleSharpTimer = null;
          setAdaptiveDpr(restSharpDpr);
          if (renderer.shadowMap.enabled) {
            renderer.shadowMap.needsUpdate = true;
          }
          needsRenderRef.current = true;
        }, 140);
      });
      controls.addEventListener("change", () => {
        if (controls.target.y < 0) {
          controls.target.y = 0;
        }
        // Keep camera lens gracefully above the studio floor slab (+35 mm) without blocking low-angle upward orbit
        if (controls.object.position.y < 35) {
          controls.object.position.y = 35;
        }
        needsRenderRef.current = true;
      });
      controlsRef.current = controls;

      // Initialize studio environment once at mount so mid-session envMap switching never triggers D3D11 shader recompilation stalls.
      if (isLegacyGpu) {
        scene.environment = getStudioEnvironmentTexture();
      } else {
        scene.environment = getStudioPmremEnvironment(renderer);
      }
      (scene as unknown as { environmentIntensity?: number }).environmentIntensity = 0.42;

      const detachContextRecovery = attachWebGLContextRecovery(renderer.domElement, {
        onContextLost: () => {
          setWebglContextLost(true);
        },
        onContextRestored: () => {
          setWebglContextLost(false);
          scene.environment = getStudioPmremEnvironment(renderer);
          renderer.shadowMap.needsUpdate = true;
          needsRenderRef.current = true;
        },
      });

      const hemiLight = new THREE.HemisphereLight(0xcbe0ff, 0x1b1815, 0.16);
      scene.add(hemiLight);
      hemiLightRef.current = hemiLight;

      // Dramatic Chiaroscuro 3/4 Key Light (warm sunlit architectural beam casting deep crisp 4K soft shadows)
      const maxTexSize = renderer.capabilities?.maxTextureSize || 2048;
      const hiResShadowSize = isLegacyGpu ? 1024 : maxTexSize >= 4096 ? 4096 : 2048;
      const keyLight = new THREE.DirectionalLight(0xfff0da, 1.98);
      keyLight.position.set(-2750, 3450, 2700);
      keyLight.target.position.set(1600, 900, 700);
      scene.add(keyLight.target);
      keyLight.castShadow = !isLegacyGpu;
      keyLight.shadow.mapSize.width = hiResShadowSize;
      keyLight.shadow.mapSize.height = hiResShadowSize;
      keyLight.shadow.camera.left = -4200;
      keyLight.shadow.camera.right = 4800;
      keyLight.shadow.camera.top = 3600;
      keyLight.shadow.camera.bottom = -1200;
      keyLight.shadow.camera.near = 250;
      keyLight.shadow.camera.far = 13500;
      keyLight.shadow.bias = -0.00010;
      keyLight.shadow.normalBias = 0.25;
      keyLight.shadow.radius = 2.4;
      scene.add(keyLight);
      keyLightRef.current = keyLight;

      // Sculpted Cool Arctic Rim Light (separates dark cabinet edges & metallic handles against deep space!)
      const rimLight = new THREE.DirectionalLight(0x93c5fd, 0.76);
      rimLight.position.set(3650, 2550, -950);
      scene.add(rimLight);
      rimLightRef.current = rimLight;

      // Whisper-soft front detail fill so wood grain & interior hardware stay legible without flattening shadows
      const frontFillLight = new THREE.DirectionalLight(0xf8fafc, 0.09);
      frontFillLight.position.set(1500, 1450, 3900);
      scene.add(frontFillLight);

      const floorBounceLight = new THREE.DirectionalLight(0xd8c3a5, 0.05);
      floorBounceLight.position.set(950, -1400, 2100);
      scene.add(floorBounceLight);

      // Architectural Ceiling Gallery SpotLight (mm-calibrated decay=0.15 so wall-washer light pool & dramatic falloff are clearly visible!)
      const gallerySpot = new THREE.SpotLight(0xffe6c2, 3.6, 8500, Math.PI / 3.4, 0.72, 0.15);
      gallerySpot.position.set(1600, 3250, 1950);
      gallerySpot.target.position.set(1450, 950, 180);
      scene.add(gallerySpot.target);
      scene.add(gallerySpot);
      gallerySpotLightRef.current = gallerySpot;

      // Refined architectural floor grid with non-distracting gallery opacity
      const gridColor1 = theme === "dark" ? 0x334155 : 0xa39c90;
      const gridColor2 = theme === "dark" ? 0x1e293b : 0xcbc5ba;
      const grid = new THREE.GridHelper(8000, 80, gridColor1, gridColor2);
      if (Array.isArray(grid.material)) {
        grid.material.forEach((gm) => {
          gm.transparent = true;
          gm.opacity = theme === "dark" ? 0.38 : 0.32;
        });
      } else {
        grid.material.transparent = true;
        grid.material.opacity = theme === "dark" ? 0.38 : 0.32;
      }
      grid.position.y = -2;
      grid.visible = showGrid;
      scene.add(grid);
      gridRef.current = grid;

      const shadowPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(8000, 8000),
        new THREE.ShadowMaterial({ opacity: theme === "dark" ? 0.32 : 0.22 })
      );
      shadowPlane.rotation.x = -Math.PI / 2;
      shadowPlane.position.y = -1;
      shadowPlane.receiveShadow = true;
      scene.add(shadowPlane);
      shadowPlaneRef.current = shadowPlane;

      const roomArchGroup = new THREE.Group();
      scene.add(roomArchGroup);
      roomArchGroupRef.current = roomArchGroup;

      const sceneObjsGroup = new THREE.Group();
      sceneObjsGroup.name = "v5_scene_objects_3d";
      scene.add(sceneObjsGroup);
      sceneObjectsGroupRef.current = sceneObjsGroup;

      const meshGroup = new THREE.Group();
      scene.add(meshGroup);
      meshGroupRef.current = meshGroup;

      const dimGroup = new THREE.Group();
      scene.add(dimGroup);
      dimGroupRef.current = dimGroup;

      const ghostSnapGroup = new THREE.Group();
      ghostSnapGroup.name = "v3_ghost_silhouette_and_snaps";
      scene.add(ghostSnapGroup);
      ghostSnapGroupRef.current = ghostSnapGroup;

      const selFrameGroup = new THREE.Group();
      selFrameGroup.name = "v3_selected_part_frame";
      scene.add(selFrameGroup);
      selectionFrameGroupRef.current = selFrameGroup;

      const activeModFrameGroup = new THREE.Group();
      activeModFrameGroup.name = "v3_active_module_frame";
      scene.add(activeModFrameGroup);
      activeModFrameGroupRef.current = activeModFrameGroup;

      const interiorPropsGroup = new THREE.Group();
      interiorPropsGroup.name = "v11_interior_props_3d";
      interiorPropsGroup.raycast = () => {};
      scene.add(interiorPropsGroup);
      interiorPropsGroupRef.current = interiorPropsGroup;

      const engBeaconGroup = new THREE.Group();
      engBeaconGroup.name = "v11_engineering_beacons_3d";
      scene.add(engBeaconGroup);
      engineeringBeaconGroupRef.current = engBeaconGroup;



      // Direct model raycast selection + 3D Front/Perspective Interior Component Dragging with Cross-Module Snapping
      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      let downPos = { x: 0, y: 0 };
      let activeDrag3D: {
        modIdx: number;
        bayIdx: number;
        kind:
          | "shelf"
          | "drawer"
          | "rail"
          | "special_fitting"
          | "divider"
          | "sub_divider"
          | "module_3d"
          | "obstacle_3d"
          | "scene_object_3d"
          | "resize_3d";
        targetId: string;
        startValueMm: number;
        startSecondValueMm?: number;
        startThirdValueMm?: number;
        isSideWallObs?: boolean;
        dragPlane?: THREE.Plane;
        startPlaneHit?: THREE.Vector3;
        itemHeightMm?: number;
        cachedSnapTargets?: ReturnType<typeof computeElevationSnapTargets>;
        liveSnappedY?: number;
        liveDestModIdx?: number;
        liveDestBayIdx?: number;
        liveSubDivider?: { offsetX: number; elevationY: number; height: number; targetMidY: number; targetBayIndex?: number };
        liveGpuX?: number;
        liveGpuY?: number;
        liveGpuZ?: number;
        liveTargetWallId?: string;
        liveTargetRotY?: number;
        startClientX: number;
        startClientY: number;
        mmPerPx: number;
        hasMoved: boolean;
      } | null = null;

      let rightDownPos: { x: number; y: number } | null = null;
      const handlePointerDown = (e: PointerEvent) => {
        if (e.button === 2) {
          rightDownPos = { x: e.clientX, y: e.clientY };
          return;
        }
        if (e.button !== 0) return;
        downPos = { x: e.clientX, y: e.clientY };
        const curRenderer = rendererRef.current;
        const curGroup = meshGroupRef.current;
        const curRoomGroup = roomArchGroupRef.current;
        const curControls = controlsRef.current;
        if (!curRenderer || !curGroup || !curControls) return;

        const rect =
          canvasRectRef.current && canvasRectRef.current.width > 0
            ? canvasRectRef.current
            : curRenderer.domElement.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        const curCam = (curControls.object as THREE.Camera) || perspCamRef.current;
        if (!curCam) return;

        raycaster.setFromCamera(pointer, curCam);
        const state = latestStateRef.current;

        // 0. Check 3D Red/Amber Engineering Error Beacons FIRST (since they render on top with depthTest=false!)
        if (engineeringBeaconGroupRef.current && engineeringBeaconGroupRef.current.children.length > 0) {
          const bHits = raycaster.intersectObjects(engineeringBeaconGroupRef.current.children, false);
          const hitBeacon = bHits.find((bh) => bh.object?.userData?.isEngineeringBeacon);
          if (hitBeacon) {
            const ud = hitBeacon.object.userData;
            setSelectedBeaconFinding({
              code: String(ud.findingCode || "UYARI"),
              severity: String(ud.findingSeverity || "error"),
              title: String(ud.findingTitle || "Mühendislik Uyarısı"),
              message: String(ud.findingMessage || ""),
              suggestions: Array.isArray(ud.findingSuggestions) ? ud.findingSuggestions : [],
              remediationProposals: Array.isArray(ud.remediationProposals) ? ud.remediationProposals : [],
              moduleIndex: typeof ud.moduleIndex === "number" && ud.moduleIndex >= 0 ? ud.moduleIndex : state.activeModuleIndex,
              bayIndex: typeof ud.bayIndex === "number" && ud.bayIndex >= 0 ? ud.bayIndex : 0,
            });
            e.stopImmediatePropagation();
            return;
          }
        }

        // V96: 0b. Check SketchUp-style 3D Live Resize Handles (◀ Left, ▶ Right, ▲ Top) on active cabinet!
        if (
          paintTool3DRef.current.mode === "none" &&
          !e.altKey &&
          activeModFrameGroupRef.current &&
          activeModFrameGroupRef.current.children.length > 0
        ) {
          const rHits = raycaster.intersectObjects(activeModFrameGroupRef.current.children, true);
          const hitResize = rHits.find((rh) => rh.object?.userData?.isResizeHandle3D);
          if (hitResize) {
            const rAxis = String(hitResize.object.userData.resizeAxis || "width_right");
            const rModIdx =
              typeof hitResize.object.userData.modIdx === "number"
                ? hitResize.object.userData.modIdx
                : state.activeModuleIndex;
            const rMod = state.project.modules[rModIdx];
            if (rMod && !rMod.isFixedWidth) {
              curControls.enabled = false;
              const camDir = new THREE.Vector3();
              curCam.getWorldDirection(camDir);
              const dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
                camDir.clone().negate(),
                hitResize.point
              );
              state.beginHistoryTransaction();
              activeDrag3D = {
                modIdx: rModIdx,
                bayIdx: activeBayIndex,
                kind: "resize_3d",
                targetId: rAxis,
                startValueMm: rAxis === "height_top" ? rMod.dimensions.height : rMod.dimensions.width,
                startSecondValueMm: rMod.position.x,
                startThirdValueMm: rMod.position.z,
                dragPlane,
                startPlaneHit: hitResize.point.clone(),
                startClientX: e.clientX,
                startClientY: e.clientY,
                mmPerPx: 4,
                hasMoved: false,
              };
              e.stopImmediatePropagation();
              return;
            }
          }
        }

        // When 3D Paint Brush or Eyedropper is active, left-click NEVER drags shelves, scene objects, or cabinets —
        // it cleanly passes straight to handlePointerUp to paint or sample the clicked 3D surface!
        if (curControls) {
          curControls.enabled = true;
          curControls.enablePan = true;
          curControls.mouseButtons.LEFT = THREE.MOUSE.PAN;
        }
        if (paintTool3DRef.current.mode !== "none" || e.altKey) {
          curControls.enabled = false;
          return;
        }
        const isMoveGesture = Boolean(state.moveObjectMode3D || e.shiftKey || e.ctrlKey || e.metaKey);
        const anyDoorsOpen =
          state.doorsHiddenIn3D ||
          state.doorOpenAngleDeg > 5 ||
          state.project.modules.some(
            (m) =>
              Boolean(m.isOpenFront) ||
              m.bays.some((b) => b.door.type === "open" || b.door.doorSystemId === "open")
          );

        // ULTRA-FAST ORBIT PATH: When doors are closed, not in Move Mode, and no unlocked 3D scene objects exist,
        // let OrbitControls handle left-drag camera rotation immediately in 0.0ms without mesh raycasting or state updates!
        const hasUnlockedSceneObjects = (state.project.sceneObjects || []).some((o) => !o.isHidden && !o.isLocked);
        if (!isMoveGesture && !anyDoorsOpen && !hasUnlockedSceneObjects && !e.ctrlKey && !e.metaKey && !e.altKey) {
          curControls.enabled = true;
          return;
        }

        // 1. Raycast solid cabinet meshes FIRST so upper & base cabinets always take priority over wall obstacles behind them!
        const solidMeshes = getCachedSolidMeshes(curGroup, anyDoorsOpen);
        const hits = raycaster.intersectObjects(solidMeshes, false);
        const closestCabinetDist = hits.length > 0 ? hits[0].distance : Infinity;

        // 1b. Check V5 3D SceneObjects (Appliances, Sinks, Freestanding Birim Furniture, Custom .GLB)
        if (sceneObjectsGroupRef.current && sceneObjectsGroupRef.current.children.length > 0) {
          const sHits = raycaster.intersectObjects(sceneObjectsGroupRef.current.children, true);
          for (const sh of sHits) {
            if (sh.object instanceof THREE.Line || sh.object instanceof THREE.LineSegments) continue;
            if (sh.distance <= closestCabinetDist + 5) {
              let walker: THREE.Object3D | null = sh.object;
              while (walker && !walker.userData?.sceneObjectId) {
                walker = walker.parent;
              }
              if (walker?.userData?.sceneObjectId) {
                const sobjId = String(walker.userData.sceneObjectId);
                useConfiguratorStore.getState().setSelectedSceneObjectId(sobjId);
                const sobjInst = (state.project.sceneObjects || []).find((o) => o.id === sobjId);
                if (sobjInst && !sobjInst.isLocked) {
                  const hitDist = Math.max(300, sh.distance);
                  const fovRad =
                    curCam instanceof THREE.PerspectiveCamera
                      ? (curCam.fov * Math.PI) / 180
                      : 0.7;
                  const visibleHeightMm =
                    curCam instanceof THREE.PerspectiveCamera
                      ? 2 * hitDist * Math.tan(fovRad / 2)
                      : 2200;
                  const mmPerPx = visibleHeightMm / Math.max(200, rect.height);
                  const floorPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
                    new THREE.Vector3(0, 1, 0),
                    sh.point
                  );
                  state.beginHistoryTransaction();
                  document.body.dataset.birimUiDragging = "1";
                  activeDrag3D = {
                    modIdx: state.activeModuleIndex,
                    bayIdx: 0,
                    kind: "scene_object_3d",
                    targetId: sobjId,
                    startValueMm: sobjInst.position.x,
                    startSecondValueMm: sobjInst.position.y,
                    startThirdValueMm: sobjInst.position.z,
                    dragPlane: floorPlane,
                    startPlaneHit: sh.point.clone(),
                    startClientX: e.clientX,
                    startClientY: e.clientY,
                    mmPerPx,
                    hasMoved: false,
                  };
                  curControls.enabled = false;
                  curRenderer.domElement.style.cursor = "grabbing";
                  e.stopImmediatePropagation();
                }
                return;
              }
            }
          }
        }

        // 2. Only grab an Architectural Obstacle (Window, Door, Plumbing, Column) if NO cabinet is in front of it!
        if (curRoomGroup && (state.moveObjectMode3D || e.shiftKey || e.ctrlKey || e.metaKey)) {
          const roomHits = raycaster.intersectObjects(curRoomGroup.children, true);
          for (const rh of roomHits) {
            if (rh.object instanceof THREE.Line || rh.object instanceof THREE.LineSegments) continue;
            if (rh.distance >= closestCabinetDist - 2) break;
            let rCand: THREE.Object3D | null = rh.object;
            while (rCand && !rCand.userData?.obstacleId) {
              rCand = rCand.parent;
            }
            if (rCand?.userData?.obstacleId) {
              const obsId = String(rCand.userData.obstacleId);
              const obsObj = (state.spaceObstacles || []).find((o) => o.id === obsId);
              if (obsObj) {
                const hitDist = Math.max(300, rh.distance);
                const fovRad =
                  curCam instanceof THREE.PerspectiveCamera
                    ? (curCam.fov * Math.PI) / 180
                    : 0.7;
                const visibleHeightMm =
                  curCam instanceof THREE.PerspectiveCamera
                    ? 2 * hitDist * Math.tan(fovRad / 2)
                    : 2200;
                const mmPerPx = visibleHeightMm / Math.max(200, rect.height);
                const obsRot = (((obsObj.rotationY || 0) % 360) + 360) % 360;
                const isSideObs = obsRot === 90 || obsRot === 270;
                const planeNormal = isSideObs
                  ? new THREE.Vector3(1, 0, 0)
                  : new THREE.Vector3(0, 0, 1);
                const dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
                  planeNormal,
                  rh.point
                );
                const startPlaneHit = rh.point.clone();
                state.beginHistoryTransaction();
                document.body.dataset.birimUiDragging = "1";
                activeDrag3D = {
                  modIdx: state.activeModuleIndex,
                  bayIdx: 0,
                  kind: "obstacle_3d",
                  targetId: obsId,
                  startValueMm: obsObj.position.x,
                  startSecondValueMm: obsObj.position.y,
                  startThirdValueMm: obsObj.position.z,
                  isSideWallObs: isSideObs,
                  dragPlane,
                  startPlaneHit,
                  startClientX: e.clientX,
                  startClientY: e.clientY,
                  mmPerPx,
                  hasMoved: false,
                };
                curControls.enabled = false;
                e.stopImmediatePropagation();
                return;
              }
            }
          }
        }
        if (hits.length === 0) return;

        let hitObj: THREE.Object3D | null = null;
        let dragMeta: ReturnType<typeof findDraggableInteriorComponent> = null;
        let modIdx = state.activeModuleIndex;
        let mod = state.project.modules[modIdx];

        for (const h of hits) {
          const cand = h.object;
          if (!cand?.userData?.componentId) continue;
          const cModIdx =
            typeof cand.userData.moduleIndex === "number"
              ? cand.userData.moduleIndex
              : state.activeModuleIndex;
          const cMod = state.project.modules[cModIdx];
          if (!cMod) continue;

          // First hit is guaranteed to be the closest solid 3D mesh under the cursor!
          if (!hitObj) {
            hitObj = cand;
            modIdx = cModIdx;
            mod = cMod;
          }

          // Do not look behind the first hit module into a DIFFERENT module!
          if (cModIdx !== modIdx) {
            break;
          }

          const isExternalDrawerFront = String(cand.userData.role) === "drawer_front";
          const doorsAreOpen =
            state.doorsHiddenIn3D ||
            state.doorOpenAngleDeg > 5 ||
            Boolean(cMod.isOpenFront) ||
            cMod.bays.some(
              (b) =>
                b.door.type === "open" ||
                b.door.doorSystemId === "open" ||
                Boolean(b.door.isGlassFramed) ||
                b.door.crossSectionProfile === "glass_frame" ||
                b.door.crossSectionProfile === "full_smoked_glass" ||
                b.door.crossSectionProfile === "center_glass_frame" ||
                b.door.crossSectionProfile === "u_glass_open_top"
            );

          const wantInteriorDrag = !state.moveObjectMode3D
            ? !(e.shiftKey || e.ctrlKey || e.metaKey)
            : false;
          if (wantInteriorDrag && (doorsAreOpen || (isExternalDrawerFront && e.altKey))) {
            const fs = calculateFourSpaceDimensions(cMod);
            const dm = findDraggableInteriorComponent(
              cMod,
              String(cand.userData.componentId),
              fs.usableInternal.bayClearWidthsMm
            );
            if (dm) {
              hitObj = cand;
              modIdx = cModIdx;
              mod = cMod;
              dragMeta = dm;
              // If we hit a shelf first, peek 40mm deeper along the same ray in case the user clicked right on a Raf Arası Dikme joint!
              if (dm.kind !== "sub_divider") {
                for (const hSub of hits) {
                  if (hSub.distance > h.distance + 45) break;
                  const subCid = String(hSub.object?.userData?.componentId || "");
                  if (!subCid) continue;
                  const subDm = findDraggableInteriorComponent(
                    cMod,
                    subCid,
                    fs.usableInternal.bayClearWidthsMm
                  );
                  if (subDm && subDm.kind === "sub_divider") {
                    hitObj = hSub.object;
                    dragMeta = subDm;
                    break;
                  }
                }
              }
              break;
            }
          }
          if (!doorsAreOpen && String(cand.userData.role || "").startsWith("door")) {
            break;
          }
        }
        if (!hitObj?.userData?.componentId || !mod) return;

        // Defer selection state updates to handlePointerUp (on non-drag click) unless an actual 3D drag starts below,
        // so pressing left-mouse to rotate the 3D scene causes ZERO synchronous React/Zustand re-renders!
        const clickedCompId =
          String(hitObj.userData.role) === "door_handle" && hitObj.userData.parentComponentId
            ? String(hitObj.userData.parentComponentId)
            : String(hitObj.userData.componentId);

        // Calculate world-mm per screen-pixel at the hit point
        const hitDist = Math.max(300, hits[0].distance);
        let visibleHeightMm = 2200;
        if (curCam instanceof THREE.PerspectiveCamera) {
          const fovRad = (curCam.fov * Math.PI) / 180;
          visibleHeightMm = 2 * hitDist * Math.tan(fovRad / 2);
        } else if (curCam instanceof THREE.OrthographicCamera) {
          visibleHeightMm = (curCam.top - curCam.bottom) / Math.max(0.01, curCam.zoom);
        }
        const mmPerPx = visibleHeightMm / Math.max(200, rect.height);

        // If user is in 3D Move Mode (or holding Ctrl / Shift), grab and move the WHOLE MODULE along the wall!
        if ((state.moveObjectMode3D || e.shiftKey || e.ctrlKey || e.metaKey) && !dragMeta) {
          state.setActiveModuleIndex(modIdx);
          (state.setSelectedComponentId as (id: string | null, mIdx?: number) => void)(
            clickedCompId,
            modIdx
          );
          state.beginHistoryTransaction();
          document.body.dataset.birimUiDragging = "1";
          const modDragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
            new THREE.Vector3(0, 1, 0),
            hits[0].point
          );
          activeDrag3D = {
            modIdx,
            bayIdx: 0,
            kind: "module_3d",
            targetId: mod.id,
            startValueMm: mod.position.x,
            startSecondValueMm: mod.position.z,
            dragPlane: modDragPlane,
            startPlaneHit: hits[0].point.clone(),
            startClientX: e.clientX,
            startClientY: e.clientY,
            mmPerPx,
            hasMoved: false,
          };
          curControls.enabled = false;
          curRenderer.domElement.style.cursor = "grabbing";
          e.stopImmediatePropagation();
          return;
        }

        if (!dragMeta) {
          // If no interior component is draggable, keep OrbitControls enabled so user can freely rotate camera around cabinet!
          curControls.enabled = true;
          return;
        }

        state.setActiveModuleIndex(modIdx);
        state.setActiveBayIndex(dragMeta.bayIdx);
        (state.setSelectedComponentId as (id: string | null, mIdx?: number) => void)(
          String(hitObj.userData.componentId),
          modIdx
        );
        state.beginHistoryTransaction();
        document.body.dataset.birimUiDragging = "1";
        const precomputedSnapTargets =
          dragMeta.kind === "divider" || dragMeta.kind === "sub_divider"
            ? undefined
            : computeElevationSnapTargets(
                state.project,
                modIdx,
                dragMeta.bayIdx,
                dragMeta.targetId,
                dragMeta.itemHeightMm
              );

        const camHorizNormal = new THREE.Vector3();
        curCam.getWorldDirection(camHorizNormal);
        camHorizNormal.y = 0;
        if (camHorizNormal.lengthSq() < 1e-4) {
          camHorizNormal.set(0, 0, -1);
        } else {
          camHorizNormal.normalize().negate();
        }
        const interiorDragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
          camHorizNormal,
          hits[0].point
        );

        activeDrag3D = {
          modIdx,
          bayIdx: dragMeta.bayIdx,
          kind: dragMeta.kind,
          targetId: dragMeta.targetId,
          startValueMm: dragMeta.startVal,
          startSecondValueMm: dragMeta.startElevY,
          dragPlane: interiorDragPlane,
          startPlaneHit: hits[0].point.clone(),
          itemHeightMm: dragMeta.itemHeightMm,
          cachedSnapTargets: precomputedSnapTargets,
          startClientX: e.clientX,
          startClientY: e.clientY,
          mmPerPx,
          hasMoved: false,
        };
        curControls.enabled = false;
        curRenderer.domElement.style.cursor = "grabbing";
        e.stopImmediatePropagation();
      };

      const hoverOverlayGroup = new THREE.Group();
      hoverOverlayGroup.name = "v3_hover_highlight_box";
      scene.add(hoverOverlayGroup);

      const hoverBoxGeo = new THREE.BoxGeometry(1, 1, 1);
      const hoverEdgesCache = new WeakMap<THREE.BufferGeometry, THREE.EdgesGeometry>();
      const getHoverEdgesForGeometry = (geo: THREE.BufferGeometry): THREE.EdgesGeometry => {
        let cached = hoverEdgesCache.get(geo);
        if (!cached) {
          cached = new THREE.EdgesGeometry(geo, 18);
          hoverEdgesCache.set(geo, cached);
        }
        return cached;
      };
      const hoverFillMat = new THREE.MeshBasicMaterial({
        color: 0x0ea5e9,
        transparent: true,
        opacity: 0.24,
        depthTest: false,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      });
      const hoverOutlineMat = new THREE.LineBasicMaterial({
        color: 0x0284c7,
        linewidth: 2,
        depthTest: false,
      });
      const hoverFillMesh = new THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>(
        hoverBoxGeo,
        hoverFillMat
      );
      hoverFillMesh.raycast = () => {};
      const hoverOutlineSegments = new THREE.LineSegments(
        getHoverEdgesForGeometry(hoverBoxGeo),
        hoverOutlineMat
      );
      hoverOutlineSegments.raycast = () => {};
      hoverOverlayGroup.add(hoverFillMesh);
      hoverOverlayGroup.add(hoverOutlineSegments);
      hoverOverlayGroup.visible = false;

      let lastHoverCheckTime = 0;
      let currentHoveredMesh: THREE.Mesh | null = null;
      const setHoverBadgeDirect = (label: string | null) => {
        const badgeEl = hoverBadgeDomRef.current;
        const textEl = hoverBadgeTextRef.current;
        if (!badgeEl || !textEl) return;
        if (label) {
          textEl.textContent = label;
          badgeEl.style.display = "flex";
        } else {
          badgeEl.style.display = "none";
        }
      };

      let dragMoveRafId = 0;
      let latestDragPointerEvent: PointerEvent | null = null;

      const processPointerMoveImmediate = (e: PointerEvent) => {
        const curRenderer = rendererRef.current;
        if (!curRenderer) return;
        if (document.body.dataset.birimUiDragging === "1" && !activeDrag3D) {
          return;
        }

        if (!activeDrag3D) {
          if (isOrbitingRef.current || e.buttons !== 0) {
            if (currentHoveredMesh) {
              currentHoveredMesh = null;
              hoverOverlayGroup.visible = false;
              setHoverBadgeDirect(null);
              needsRenderRef.current = true;
            }
            return;
          }
          if (e.target !== curRenderer.domElement) {
            if (currentHoveredMesh) {
              currentHoveredMesh = null;
              hoverOverlayGroup.visible = false;
              setHoverBadgeDirect(null);
              needsRenderRef.current = true;
            }
            return;
          }
          if (isOrbitingRef.current) return;
          const now = performance.now();
          if (now - lastHoverCheckTime < 110) return;
          lastHoverCheckTime = now;

          const curGroup = meshGroupRef.current;
          const curCam = (controlsRef.current?.object as THREE.Camera) || perspCamRef.current;
          if (!curGroup || !curCam) return;

          const rect = canvasRectRef.current || curRenderer.domElement.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) return;

          pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
          raycaster.setFromCamera(pointer, curCam);

          // Hovering a 3D Red/Amber Engineering Beacon shows immediate clear explanation tooltip!
          if (engineeringBeaconGroupRef.current && engineeringBeaconGroupRef.current.children.length > 0) {
            const bHover = raycaster
              .intersectObjects(engineeringBeaconGroupRef.current.children, false)
              .find((bh) => bh.object?.userData?.isEngineeringBeacon);
            if (bHover) {
              const ud = bHover.object.userData;
              hoverOverlayGroup.visible = false;
              setHoverBadgeDirect(`⚠️ ${ud.findingTitle || "Hata Noktası"} — Açıklama ve çözüm için tıklayın`);
              curRenderer.domElement.style.cursor = "pointer";
              return;
            }
          }

          const st = latestStateRef.current;
          const anyDoorsOpen =
            st.doorsHiddenIn3D ||
            st.doorOpenAngleDeg > 5 ||
            st.project.modules.some(
              (m) =>
                Boolean(m.isOpenFront) ||
                m.bays.some((b) => b.door.type === "open" || b.door.doorSystemId === "open")
            );
          const solidMeshes = getCachedSolidMeshes(curGroup, anyDoorsOpen);
          const hits = raycaster.intersectObjects(solidMeshes, false);

          let hitMesh: THREE.Mesh | null = null;
          for (const h of hits) {
            if (h.object instanceof THREE.Mesh && h.object.userData?.role !== "bay_compartment") {
              hitMesh = h.object;
              break;
            }
          }
          if (!hitMesh && hits.length > 0 && hits[0].object instanceof THREE.Mesh) {
            hitMesh = hits[0].object;
          }

          if (hitMesh !== currentHoveredMesh) {
            currentHoveredMesh = hitMesh;
            if (hitMesh) {
              hitMesh.updateWorldMatrix(true, false);
              // Her elemanı (L-köşe, 45° beşgen, kapsül, silindir, delikli tezgâh vb.) KENDİ GERÇEK 3B FORMUNDA vurgula!
              if (hitMesh.geometry) {
                const wPos = new THREE.Vector3();
                const wQuat = new THREE.Quaternion();
                const wScale = new THREE.Vector3();
                hitMesh.matrixWorld.decompose(wPos, wQuat, wScale);
                if (hoverFillMesh.geometry !== hitMesh.geometry) {
                  hoverFillMesh.geometry = hitMesh.geometry;
                  hoverOutlineSegments.geometry = getHoverEdgesForGeometry(hitMesh.geometry);
                }
                hoverOverlayGroup.position.copy(wPos);
                hoverOverlayGroup.quaternion.copy(wQuat);
                hoverOverlayGroup.scale.copy(wScale);
                hoverOverlayGroup.visible = true;
              }
              const partLabel = String(hitMesh.userData?.label || hitMesh.userData?.role || "Parça");
              const dimsTxt = hitMesh.userData?.dimsText ? ` (${hitMesh.userData.dimsText})` : "";
              const bayTxt =
                typeof hitMesh.userData?.bayIndex === "number"
                  ? `Bölme ${hitMesh.userData.bayIndex + 1} • `
                  : "";
              const hoverTool = paintTool3DRef.current;
              if (hoverTool.mode === "eyedropper" || e.altKey) {
                const sMat = hitMesh.userData?.matDef as MaterialDefinition | undefined;
                hoverOutlineMat.color.setHex(0x2563eb);
                hoverFillMat.color.setHex(0x3b82f6);
                setHoverBadgeDirect(
                  `Damlalık: ${sMat?.name || partLabel} — Fırçaya kopyalamak için tıklayın`
                );
                curRenderer.domElement.style.cursor = "cell";
              } else if (hoverTool.mode === "paint") {
                const allMatsH = [...DEFAULT_MATERIALS, ...(st.project.customMaterials || [])];
                const brushDef = allMatsH.find((m) => m.id === hoverTool.materialId);
                const roleHover = String(hitMesh.userData?.role || "");
                const hModIdx =
                  typeof hitMesh.userData?.moduleIndex === "number"
                    ? hitMesh.userData.moduleIndex
                    : st.activeModuleIndex;
                hoverOutlineMat.color.setHex(0xea580c);
                hoverFillMat.color.setHex(0xf97316);
                restoreHoverPreviewMaterials();
                if (brushDef) {
                  if (hoverTool.clickBehavior === "clicked_part") {
                    let compNode: THREE.Object3D | null = hitMesh;
                    while (compNode && !compNode.userData?.componentId && compNode.parent) {
                      compNode = compNode.parent;
                    }
                    const pMat = getV3PbrMaterial(
                      brushDef,
                      false,
                      roleHover.includes("handle") || roleHover === "gola_profile",
                      "lengthwise",
                      st.project.modules[hModIdx]?.surfaceFinishOverride
                    );
                    if (!previewOriginalMatsRef.current.has(hitMesh)) {
                      previewOriginalMatsRef.current.set(hitMesh, hitMesh.material);
                    }
                    hitMesh.material = pMat;
                    setHoverBadgeDirect(
                      `Fırça (Tek Parça): ${partLabel} → ${brushDef.name}`
                    );
                  } else {
                    const smartHover =
                      hoverTool.clickBehavior === "clicked_module"
                        ? { scope: "active_module" as const, surfaceLabelTr: "Bu Dolabın Tümü" }
                        : resolveSmartPaintScopeForClickedRole(roleHover, hoverTool.zoneScope);
                    window.dispatchEvent(
                      new CustomEvent("birim:preview-material-3d", {
                        detail: {
                          materialId: brushDef.id,
                          scope: smartHover.scope,
                          activeModuleIndex: hModIdx,
                          ...(hoverTool.clickBehavior === "replace_matching_project" &&
                          hitMesh.userData?.matDef?.id
                            ? { replaceFromMaterialId: String(hitMesh.userData.matDef.id) }
                            : {}),
                        },
                      })
                    );
                    setHoverBadgeDirect(
                      `Fırça: ${smartHover.surfaceLabelTr} → ${brushDef.name}`
                    );
                  }
                }
                curRenderer.domElement.style.cursor = "crosshair";
              } else {
                hoverOutlineMat.color.setHex(0x0284c7);
                hoverFillMat.color.setHex(0x0ea5e9);
                setHoverBadgeDirect(`${bayTxt}${partLabel}${dimsTxt}`);
                curRenderer.domElement.style.cursor = e.ctrlKey || e.metaKey ? "move" : "pointer";
              }
            } else {
              if (paintTool3DRef.current.mode === "paint") {
                restoreHoverPreviewMaterials();
              }
              hoverOverlayGroup.visible = false;
              // Check if hovering over a selectable 3D Room Wall!
              let hoveredWallName: string | null = null;
              let hoveredWallId: string | null = null;
              if (roomArchGroupRef.current && paintTool3DRef.current.mode === "none") {
                const wHits = raycaster.intersectObjects(roomArchGroupRef.current.children, true);
                for (const wh of wHits) {
                  if (wh.object?.userData?.isRoomWall && wh.object.userData.wallId) {
                    hoveredWallId = String(wh.object.userData.wallId);
                    hoveredWallName = String(wh.object.userData.wallName || "Duvar");
                    break;
                  }
                }
              }
              if (hoveredWallId && hoveredWallName) {
                const curActW = useConfiguratorStore.getState().activeWallId || "wall_main";
                setHoverBadgeDirect(
                  curActW === hoveredWallId
                    ? `✓ Seçili Hedef Duvar: ${hoveredWallName}`
                    : `Hedef Duvar Seç: ${hoveredWallName} — Modül/obje yerleştirmek için tıklayın`
                );
                curRenderer.domElement.style.cursor = "pointer";
              } else {
                setHoverBadgeDirect(null);
                curRenderer.domElement.style.cursor =
                  paintTool3DRef.current.mode === "paint"
                    ? "crosshair"
                    : paintTool3DRef.current.mode === "eyedropper"
                    ? "cell"
                    : e.ctrlKey || e.metaKey
                    ? "move"
                    : "grab";
              }
            }
            needsRenderRef.current = true;
          }
          return;
        }
        hoverOverlayGroup.visible = false;
        curRenderer.domElement.style.cursor = "grabbing";
        const dxPx = e.clientX - activeDrag3D.startClientX;
        const dyPx = e.clientY - activeDrag3D.startClientY;
        if (!activeDrag3D.hasMoved && Math.hypot(dxPx, dyPx) < 4) return;
        activeDrag3D.hasMoved = true;

        const state = latestStateRef.current;

        if (activeDrag3D.kind === "scene_object_3d") {
          const curCam = (controlsRef.current?.object as THREE.Camera) || perspCamRef.current;
          // Camera-oriented horizontal XZ fallback (always moves strictly along screen right/forward from ANY orbit angle!)
          let deltaX = dxPx * activeDrag3D.mmPerPx;
          let deltaZ = dyPx * activeDrag3D.mmPerPx;
          if (curCam) {
            const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(curCam.quaternion);
            camRight.y = 0;
            if (camRight.lengthSq() > 1e-6) camRight.normalize();
            const camFwd = new THREE.Vector3(0, 0, -1).applyQuaternion(curCam.quaternion);
            camFwd.y = 0;
            if (camFwd.lengthSq() > 1e-6) camFwd.normalize();
            deltaX = (camRight.x * dxPx - camFwd.x * dyPx) * activeDrag3D.mmPerPx;
            deltaZ = (camRight.z * dxPx - camFwd.z * dyPx) * activeDrag3D.mmPerPx;
          }
          // Exact horizontal floor-plane raycast using live viewport rect
          if (curRenderer && curCam && activeDrag3D.startPlaneHit) {
            const rect = curRenderer.domElement.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              const curNdcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
              const curNdcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
              raycaster.setFromCamera(new THREE.Vector2(curNdcX, curNdcY), curCam);
              const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -activeDrag3D.startPlaneHit.y);
              const curHit = new THREE.Vector3();
              if (raycaster.ray.intersectPlane(floorPlane, curHit)) {
                const rawDx = curHit.x - activeDrag3D.startPlaneHit.x;
                const rawDz = curHit.z - activeDrag3D.startPlaneHit.z;
                if (Math.abs(rawDx) < 9000 && Math.abs(rawDz) < 9000) {
                  deltaX = rawDx;
                  deltaZ = rawDz;
                }
              }
            }
          }
          const nextX = Math.round((activeDrag3D.startValueMm + deltaX) / 10) * 10;
          const nextZ = Math.round(((activeDrag3D.startThirdValueMm || 0) + deltaZ) / 10) * 10;
          activeDrag3D.liveGpuX = nextX;
          activeDrag3D.liveGpuZ = nextZ;
          const sobjNode = sceneObjectsGroupRef.current?.children.find(
            (ch) => ch.userData?.sceneObjectId === activeDrag3D?.targetId
          );
          if (sobjNode) {
            sobjNode.position.set(nextX, activeDrag3D.startSecondValueMm || 0, nextZ);
            needsRenderRef.current = true;
          }
          setSnapBannerDedup(`✋ Sahne Objesi Taşınıyor: X:${nextX}mm • Z:${nextZ}mm`);
          return;
        }

        if (activeDrag3D.kind === "obstacle_3d") {
          let deltaX = dxPx * activeDrag3D.mmPerPx;
          let deltaZ = -dxPx * activeDrag3D.mmPerPx;
          let deltaY = -dyPx * activeDrag3D.mmPerPx;

          const curCam = (controlsRef.current?.object as THREE.Camera) || perspCamRef.current;
          if (curRenderer && curCam && activeDrag3D.dragPlane && activeDrag3D.startPlaneHit) {
            const rect = canvasRectRef.current || curRenderer.domElement.getBoundingClientRect();
            const curNdcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            const curNdcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(new THREE.Vector2(curNdcX, curNdcY), curCam);
            const curHit = new THREE.Vector3();
            if (raycaster.ray.intersectPlane(activeDrag3D.dragPlane, curHit)) {
              const rawDx = curHit.x - activeDrag3D.startPlaneHit.x;
              const rawDz = curHit.z - activeDrag3D.startPlaneHit.z;
              const rawDy = curHit.y - activeDrag3D.startPlaneHit.y;
              if (Math.abs(rawDx) < 9000 && Math.abs(rawDz) < 9000 && Math.abs(rawDy) < 6000) {
                deltaX = rawDx;
                deltaZ = rawDz;
                deltaY = rawDy;
              }
            }
          }

          const nextY = Math.max(
            0,
            Math.round(((activeDrag3D.startSecondValueMm || 0) + deltaY) / 10) * 10
          );
          const nextX = activeDrag3D.isSideWallObs
            ? activeDrag3D.startValueMm
            : Math.max(0, Math.round((activeDrag3D.startValueMm + deltaX) / 10) * 10);
          const nextZ = activeDrag3D.isSideWallObs
            ? Math.max(0, Math.round(((activeDrag3D.startThirdValueMm || 0) + deltaZ) / 10) * 10)
            : activeDrag3D.startThirdValueMm || 0;

          activeDrag3D.liveGpuX = nextX;
          activeDrag3D.liveGpuY = nextY;
          activeDrag3D.liveGpuZ = nextZ;

          let movedOnGpu = false;
          roomArchGroupRef.current?.traverse((node) => {
            if (node.userData?.obstacleId === activeDrag3D?.targetId && node.parent?.userData?.obstacleId !== activeDrag3D?.targetId) {
              if (typeof node.userData.__dragBaseX !== "number") {
                node.userData.__dragBaseX = node.position.x;
                node.userData.__dragBaseY = node.position.y;
                node.userData.__dragBaseZ = node.position.z;
              }
              node.position.set(
                (node.userData.__dragBaseX as number) + (nextX - activeDrag3D!.startValueMm),
                (node.userData.__dragBaseY as number) + (nextY - (activeDrag3D!.startSecondValueMm || 0)),
                (node.userData.__dragBaseZ as number) + (nextZ - (activeDrag3D!.startThirdValueMm || 0))
              );
              movedOnGpu = true;
            }
          });
          if (movedOnGpu) {
            needsRenderRef.current = true;
          } else {
            state.updateObstaclePosition(activeDrag3D.targetId, nextX, nextZ, nextY);
          }
          setSnapBannerDedup(
            activeDrag3D.isSideWallObs
              ? `🎯 Yan Duvar Pencere/Engel Taşınıyor: Z:${nextZ}mm • Yükseklik Kotu Y:${nextY}mm`
              : `🎯 3D Pencere/Engel Taşınıyor: X:${nextX}mm • Yükseklik Kotu Y:${nextY}mm`
          );
          return;
        }

        if (activeDrag3D.kind === "module_3d") {
          // V41: Wall-to-Wall 3D Dragging! Raycast against all room walls so Ctrl+Drag smoothly transfers a module across walls (0°/90°/180°/270°)!
          const curRendererW = rendererRef.current;
          const curCamW = (controlsRef.current?.object as THREE.Camera) || perspCamRef.current;
          const dragModW = state.project.modules[activeDrag3D.modIdx];
          const effWallsW = getEffectiveSpaceWalls(state.project);
          if (
            curRendererW &&
            curCamW &&
            dragModW &&
            roomArchGroupRef.current &&
            effWallsW.length > 1
          ) {
            const rectW = curRendererW.domElement.getBoundingClientRect();
            const ndcXW = ((e.clientX - rectW.left) / rectW.width) * 2 - 1;
            const ndcYW = -((e.clientY - rectW.top) / rectW.height) * 2 + 1;
            const wallRc = new THREE.Raycaster();
            wallRc.setFromCamera(new THREE.Vector2(ndcXW, ndcYW), curCamW);
            const wallHits = wallRc.intersectObjects(roomArchGroupRef.current.children, true);
            const wallHit = wallHits.find(
              (wh) => wh.object?.userData?.isRoomWall && wh.object.userData.wallId
            );
            if (wallHit) {
              const hitWallId = String(wallHit.object.userData.wallId);
              const hitWall = effWallsW.find((w) => w.id === hitWallId);
              const origHostWallId = resolveModuleHostWallId(state.project, dragModW);
              if (hitWall && (hitWallId !== origHostWallId || activeDrag3D.liveTargetWallId)) {
                const roomCenterW = computeRoomDynamicCenter(effWallsW);
                const wb = getWallRoomBasis(hitWall, roomCenterW);
                const rawAlong =
                  (wallHit.point.x - wb.p0.x) * wb.rawTangent.x +
                  (wallHit.point.z - wb.p0.z) * wb.rawTangent.z -
                  dragModW.dimensions.width * 0.5;
                const clampedAlong = Math.max(
                  0,
                  Math.min(
                    Math.max(0, hitWall.length - dragModW.dimensions.width),
                    Math.round(rawAlong / 10) * 10
                  )
                );
                const solvedPos = wallIntervalToModulePosition(
                  hitWall,
                  clampedAlong,
                  dragModW.dimensions.width,
                  dragModW.dimensions.depth,
                  roomCenterW
                );
                activeDrag3D.liveGpuX = solvedPos.x;
                activeDrag3D.liveGpuZ = solvedPos.z;
                activeDrag3D.liveTargetWallId = hitWallId;
                activeDrag3D.liveTargetRotY = solvedPos.rotationYDeg;

                const modObj3DW = meshGroupRef.current?.children.find(
                  (ch) => ch.userData?.moduleIndex === activeDrag3D?.modIdx
                );
                if (modObj3DW) {
                  const previewMod = {
                    ...dragModW,
                    position: { x: solvedPos.x, y: dragModW.position.y, z: solvedPos.z },
                    rotation: { x: 0, y: solvedPos.rotationYDeg, z: 0 },
                  };
                  const placed3D = calculateModulePlacement(previewMod);
                  modObj3DW.position.set(placed3D.origin.x, dragModW.position.y, placed3D.origin.z);
                  modObj3DW.rotation.y = (solvedPos.rotationYDeg * Math.PI) / 180;
                  const propNodeW = interiorPropsGroupRef.current?.children.find(
                    (ch) => ch.userData?.moduleIndex === activeDrag3D?.modIdx
                  );
                  if (propNodeW) {
                    propNodeW.position.copy(modObj3DW.position);
                    propNodeW.rotation.copy(modObj3DW.rotation);
                    propNodeW.updateMatrix();
                    propNodeW.updateMatrixWorld(true);
                  }
                  if (selectionFrameGroupRef.current) selectionFrameGroupRef.current.visible = false;
                  if (activeModFrameGroupRef.current) activeModFrameGroupRef.current.visible = false;
                  needsRenderRef.current = true;
                }
                setSnapBannerDedup(
                  `🧲 Duvardan Duvara Taşıma → "${hitWall.name}" (Konum: ${clampedAlong} mm • ${solvedPos.rotationYDeg}°)`
                );
                return;
              }
            }
          }

          // Compute true 3D raycast delta along the wall plane (with screen-space fallback for side angles)
          let dxMm = dxPx * activeDrag3D.mmPerPx;
          const curRenderer = rendererRef.current;
          const curCam = (controlsRef.current?.object as THREE.Camera) || perspCamRef.current;
          if (curRenderer && curCam) {
            const rect = curRenderer.domElement.getBoundingClientRect();
            const startNdcX = ((activeDrag3D.startClientX - rect.left) / rect.width) * 2 - 1;
            const startNdcY = -((activeDrag3D.startClientY - rect.top) / rect.height) * 2 + 1;
            const curNdcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            const curNdcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            const wallPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -300);
            const rcStart = new THREE.Raycaster();
            const rcCur = new THREE.Raycaster();
            rcStart.setFromCamera(new THREE.Vector2(startNdcX, startNdcY), curCam);
            rcCur.setFromCamera(new THREE.Vector2(curNdcX, curNdcY), curCam);
            const ptStart = new THREE.Vector3();
            const ptCur = new THREE.Vector3();
            if (
              rcStart.ray.intersectPlane(wallPlane, ptStart) &&
              rcCur.ray.intersectPlane(wallPlane, ptCur) &&
              Math.abs(ptCur.x - ptStart.x) < 8000
            ) {
              dxMm = ptCur.x - ptStart.x;
            }
          }

          const dragModObj = state.project.modules[activeDrag3D.modIdx];
          const isRotated90Mod =
            (((dragModObj?.rotation?.y || 0) % 360) + 360) % 360 === 90 ||
            (((dragModObj?.rotation?.y || 0) % 360) + 360) % 360 === 270;
          if (isRotated90Mod) {
            let dzMm = -dxPx * activeDrag3D.mmPerPx;
            if (curRenderer && curCam && activeDrag3D.dragPlane && activeDrag3D.startPlaneHit) {
              const rect = curRenderer.domElement.getBoundingClientRect();
              const curNdcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
              const curNdcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
              const rc = new THREE.Raycaster();
              rc.setFromCamera(new THREE.Vector2(curNdcX, curNdcY), curCam);
              const curHit = new THREE.Vector3();
              if (
                rc.ray.intersectPlane(activeDrag3D.dragPlane, curHit) &&
                Math.abs(curHit.z - activeDrag3D.startPlaneHit.z) < 8000
              ) {
                dzMm = curHit.z - activeDrag3D.startPlaneHit.z;
              }
            }
            const nextZ = Math.max(
              0,
              Math.round(((activeDrag3D.startSecondValueMm || 0) + dzMm) / 10) * 10
            );
            setSnapBannerDedup(`✋ 3D Köşe/Yan Modül Taşınıyor: Z: ${nextZ}mm`);
            activeDrag3D.liveGpuX = activeDrag3D.startValueMm;
            activeDrag3D.liveGpuZ = nextZ;
            const modObj3DRot = meshGroupRef.current?.children.find(
              (ch) => ch.userData?.moduleIndex === activeDrag3D?.modIdx
            );
            if (modObj3DRot && dragModObj) {
              const deltaLiveZ = nextZ - dragModObj.position.z;
              const baseOrigin = calculateModulePlacement(dragModObj).origin;
              modObj3DRot.position.set(baseOrigin.x, dragModObj.position.y, baseOrigin.z + deltaLiveZ);
              const propNodeRot = interiorPropsGroupRef.current?.children.find(
                (ch) => ch.userData?.moduleIndex === activeDrag3D?.modIdx
              );
              if (propNodeRot) {
                propNodeRot.position.copy(modObj3DRot.position);
                propNodeRot.updateMatrix();
                propNodeRot.updateMatrixWorld(true);
              }
              if (selectionFrameGroupRef.current) selectionFrameGroupRef.current.position.set(0, 0, deltaLiveZ);
              if (activeModFrameGroupRef.current) activeModFrameGroupRef.current.position.set(0, 0, deltaLiveZ);
              liveDimDeltaRef.current = { dx: 0, dz: deltaLiveZ };
              needsRenderRef.current = true;
            } else {
              state.setModulePosition(activeDrag3D.modIdx, activeDrag3D.startValueMm, nextZ, 1);
            }
            return;
          }
          const rawNextX = Math.max(0, activeDrag3D.startValueMm + dxMm);
          let nextX = Math.round(rawNextX / 10) * 10;
          let lockedSnapX: number | null = null;
          let snapText = `✋ 3D Modül Taşınıyor: X: ${nextX}mm (Diğer modülün üzerine bırakırsanız yer değiştirir • Alt: Serbest)`;

          const dragMod = state.project.modules[activeDrag3D.modIdx];
          if (dragMod && !e.altKey) {
            const dragW = dragMod.dimensions.width;
            if (rawNextX <= 22 && (activeDrag3D.startValueMm > 6 || dxMm <= 0)) {
              nextX = 0;
              lockedSnapX = 0;
              snapText = "🧲 Duvar Başlangıcına Snap (X: 0mm)";
            }
            state.project.modules.forEach((other, oIdx) => {
              if (oIdx === activeDrag3D?.modIdx || other.category === "complementary") return;
              const otherRight = other.position.x + other.dimensions.width;
              const otherLeft = other.position.x;
              const startedAtRight = Math.abs((activeDrag3D?.startValueMm || 0) - otherRight) <= 6;
              const startedAtLeft = Math.abs((activeDrag3D?.startValueMm || 0) + dragW - otherLeft) <= 6;
              if (dragMod.category === "complementary" && Math.abs(rawNextX - otherLeft) <= 35) {
                nextX = otherLeft;
                lockedSnapX = otherLeft;
                snapText = `🧲 ${oIdx + 1}. Modül Hizasına Entegre Snap (X: ${otherLeft}mm)`;
              } else if ((!startedAtRight || Math.abs(dxMm) <= 4) && Math.abs(rawNextX - otherRight) <= 28) {
                nextX = otherRight;
                lockedSnapX = otherRight;
                snapText = `🧲 ${oIdx + 1}. Modül Sağına Snap (X: ${otherRight}mm)`;
              } else if (
                (!startedAtLeft || Math.abs(dxMm) <= 4) &&
                Math.abs(rawNextX + dragW - otherLeft) <= 28 &&
                otherLeft - dragW >= 0
              ) {
                nextX = otherLeft - dragW;
                lockedSnapX = otherLeft;
                snapText = `🧲 ${oIdx + 1}. Modül Soluna Snap (X: ${nextX}mm)`;
              }
            });
          }

          // Render live 3D Vertical Magnetic Snap Laser Lines in ghostSnapGroupRef while dragging module in 3D!
          if (ghostSnapGroupRef.current && dragMod) {
            const gGroup = ghostSnapGroupRef.current;
            disposeObject3DTree(gGroup);
            gGroup.clear();
            const snapXs = [
              0,
              ...state.project.modules.flatMap((m, i) =>
                i === activeDrag3D?.modIdx || m.category === "complementary"
                  ? []
                  : [m.position.x, m.position.x + m.dimensions.width]
              ),
            ];
            snapXs.forEach((sx) => {
              const isLocked = lockedSnapX === sx;
              add3DRod(
                gGroup,
                new THREE.Vector3(sx, 0, 0),
                new THREE.Vector3(sx, dragMod.dimensions.height + 240, 0),
                isLocked ? 7 : 3.5,
                isLocked ? snapSlotActiveRodMat : snapSlotIdleRodMat
              );
              add3DRod(
                gGroup,
                new THREE.Vector3(sx, 0, dragMod.dimensions.depth),
                new THREE.Vector3(sx, dragMod.dimensions.height + 240, dragMod.dimensions.depth),
                isLocked ? 7 : 3.5,
                isLocked ? snapSlotActiveRodMat : snapSlotIdleRodMat
              );
            });
          }

          setSnapBannerDedup(snapText);
          if (dragMod) {
            const targetZ = activeDrag3D.startSecondValueMm || 0;
            (activeDrag3D as { liveGpuX?: number; liveGpuZ?: number }).liveGpuX = nextX;
            (activeDrag3D as { liveGpuX?: number; liveGpuZ?: number }).liveGpuZ = targetZ;
            const modObj3D = meshGroupRef.current?.children.find(
              (ch) => ch.userData?.moduleIndex === activeDrag3D?.modIdx
            );
            if (modObj3D) {
              // Direct 0ms GPU transform during drag — commits to Zustand store on pointerup!
              const deltaLiveX = nextX - dragMod.position.x;
              const deltaLiveZ = targetZ - dragMod.position.z;
              const baseOrigin = calculateModulePlacement(dragMod).origin;
              modObj3D.position.set(
                baseOrigin.x + deltaLiveX,
                dragMod.position.y,
                baseOrigin.z + deltaLiveZ
              );
              const propNode3D = interiorPropsGroupRef.current?.children.find(
                (ch) => ch.userData?.moduleIndex === activeDrag3D?.modIdx
              );
              if (propNode3D) {
                propNode3D.position.copy(modObj3D.position);
                propNode3D.updateMatrix();
                propNode3D.updateMatrixWorld(true);
              }
              if (selectionFrameGroupRef.current) {
                selectionFrameGroupRef.current.position.set(deltaLiveX, 0, deltaLiveZ);
              }
              if (activeModFrameGroupRef.current) {
                activeModFrameGroupRef.current.position.set(deltaLiveX, 0, deltaLiveZ);
              }
              const actDim = dimGroupRef.current?.children.find((c) => c.userData?.isActiveModuleDim);
              if (actDim && actDim.userData.baseOrigin instanceof THREE.Vector3) {
                const base = actDim.userData.baseOrigin as THREE.Vector3;
                actDim.position.set(base.x + deltaLiveX, base.y, base.z + deltaLiveZ);
              }
              liveDimDeltaRef.current = { dx: deltaLiveX, dz: deltaLiveZ };
              needsRenderRef.current = true;
            } else if (nextX !== dragMod.position.x || targetZ !== dragMod.position.z) {
              state.setModulePosition(activeDrag3D.modIdx, nextX, targetZ, 1);
            }
          }
          return;
        }

        if (activeDrag3D.kind === "resize_3d") {
          const rMod = state.project.modules[activeDrag3D.modIdx];
          if (!rMod) return;
          const rAxis = activeDrag3D.targetId;
          const curCamR = (controlsRef.current?.object as THREE.Camera) || perspCamRef.current;
          let worldDelta = new THREE.Vector3(0, 0, 0);
          if (curRenderer && curCamR && activeDrag3D.dragPlane && activeDrag3D.startPlaneHit) {
            const rectR = canvasRectRef.current && canvasRectRef.current.width > 0 ? canvasRectRef.current : curRenderer.domElement.getBoundingClientRect();
            const ndcR = new THREE.Vector2(
              ((e.clientX - rectR.left) / rectR.width) * 2 - 1,
              -((e.clientY - rectR.top) / rectR.height) * 2 + 1
            );
            raycaster.setFromCamera(ndcR, curCamR);
            const curHitR = new THREE.Vector3();
            if (raycaster.ray.intersectPlane(activeDrag3D.dragPlane, curHitR)) {
              worldDelta.subVectors(curHitR, activeDrag3D.startPlaneHit);
            }
          }
          const rotRad = -((rMod.rotation?.y || 0) * Math.PI) / 180;
          const localRight = new THREE.Vector3(Math.cos(rotRad), 0, -Math.sin(rotRad));
          const deltaAlongX = worldDelta.dot(localRight);

          if (rAxis === "height_top") {
            let nextH = Math.max(300, Math.min(2800, Math.round((activeDrag3D.startValueMm + worldDelta.y) / 10) * 10));
            const ceilH = state.project.space.ceilingHeight || 2700;
            if (Math.abs(rMod.position.y + nextH - ceilH) <= 35) nextH = ceilH - rMod.position.y;
            state.project.modules.forEach((other, oi) => {
              if (oi === activeDrag3D?.modIdx) return;
              const oTop = other.position.y + other.dimensions.height;
              if (Math.abs(rMod.position.y + nextH - oTop) <= 35) {
                nextH = Math.max(300, Math.min(2800, oTop - rMod.position.y));
              }
            });
            if (nextH !== rMod.dimensions.height) {
              useConfiguratorStore.getState().setDimensions(rMod.dimensions.width, nextH, rMod.dimensions.depth);
            }
            setSnapBannerDedup(`↕ Yükseklik: ${nextH} mm`);
          } else if (rAxis === "width_right") {
            let nextW = Math.max(250, Math.min(3600, Math.round((activeDrag3D.startValueMm + deltaAlongX) / 10) * 10));
            // Magnetic snap right edge to adjacent module left edge
            const startX = activeDrag3D.startSecondValueMm ?? rMod.position.x;
            state.project.modules.forEach((other, oi) => {
              if (oi === activeDrag3D?.modIdx || other.category === "complementary") return;
              if (Math.abs((other.rotation?.y || 0) - (rMod.rotation?.y || 0)) > 5) return;
              if (Math.abs(startX + nextW - other.position.x) <= 35) {
                nextW = Math.max(250, Math.min(3600, other.position.x - startX));
              }
            });
            if (nextW !== rMod.dimensions.width) {
              const resP = state.resizeModuleParametric(activeDrag3D.modIdx, nextW);
              if (resP) {
                setSnapBannerDedup(
                  `📐 Parametrik Genişlik: ${nextW} mm → ${resP.bayCount} Bölme (${Math.max(0, resP.bayCount - 1)} Dikme) • ${resP.totalLeafCount} Kapak`
                );
              } else {
                setSnapBannerDedup(`↔ Genişlik: ${nextW} mm`);
              }
            }
          } else if (rAxis === "width_left") {
            const startW = activeDrag3D.startValueMm;
            const startX = activeDrag3D.startSecondValueMm ?? rMod.position.x;
            const rightEdge = startX + startW;
            let nextW = Math.max(250, Math.min(3600, Math.round((startW - deltaAlongX) / 10) * 10));
            let nextX = rightEdge - nextW;
            // Magnetic snap left edge to adjacent module right edge
            state.project.modules.forEach((other, oi) => {
              if (oi === activeDrag3D?.modIdx || other.category === "complementary") return;
              if (Math.abs((other.rotation?.y || 0) - (rMod.rotation?.y || 0)) > 5) return;
              const oRight = other.position.x + other.dimensions.width;
              if (Math.abs(nextX - oRight) <= 35) {
                nextX = oRight;
                nextW = Math.max(250, Math.min(3600, rightEdge - nextX));
              }
            });
            if (nextW !== rMod.dimensions.width) {
              const resP = state.resizeModuleParametric(activeDrag3D.modIdx, nextW, nextX);
              if (resP) {
                setSnapBannerDedup(
                  `📐 Parametrik Genişlik: ${nextW} mm → ${resP.bayCount} Bölme (${Math.max(0, resP.bayCount - 1)} Dikme) • ${resP.totalLeafCount} Kapak`
                );
              } else {
                setSnapBannerDedup(`↔ Genişlik: ${nextW} mm`);
              }
            }
          }
          return;
        }

        if (activeDrag3D.kind === "divider") {
          const rawX = activeDrag3D.startValueMm + dxPx * activeDrag3D.mmPerPx;
          const snappedX = Math.round(rawX / 10) * 10;
          state.setBayCustomWidth(activeDrag3D.bayIdx, snappedX, false);
          return;
        }
        if (activeDrag3D.kind === "sub_divider") {
          const modForSd = state.project.modules[activeDrag3D.modIdx];
          if (!modForSd) return;
          const pTSd = modForSd.carcass.panelThickness || 18;
          const plHSd = modForSd.carcass.plinthHeight ?? 80;
          const netHSd = calculateNetInnerHeight(modForSd);
          const bayWidthsSd = calculateBayWidths(modForSd);

          let targetBayIdx = activeDrag3D.bayIdx;
          let bayStartX =
            pTSd + bayWidthsSd.slice(0, targetBayIdx).reduce((s, w) => s + w + pTSd, 0);
          let curBayWSd = bayWidthsSd[targetBayIdx] || 600;
          let clampedX = activeDrag3D.startValueMm;
          let cursorElevY =
            (activeDrag3D.startSecondValueMm ?? 0) + (activeDrag3D.itemHeightMm ?? 300) / 2;

          const curCamSd = (controlsRef.current?.object as THREE.Camera) || perspCamRef.current;
          if (curRenderer && curCamSd) {
            const rectSd = canvasRectRef.current || curRenderer.domElement.getBoundingClientRect();
            const ndcXSd = ((e.clientX - rectSd.left) / rectSd.width) * 2 - 1;
            const ndcYSd = -((e.clientY - rectSd.top) / rectSd.height) * 2 + 1;
            raycaster.setFromCamera(new THREE.Vector2(ndcXSd, ndcYSd), curCamSd);

            const plSd = calculateModulePlacement(modForSd);
            const rightAxis = new THREE.Vector3(
              Math.cos(plSd.rotationYRad),
              0,
              -Math.sin(plSd.rotationYRad)
            );
            const frontNormal = new THREE.Vector3(
              Math.sin(plSd.rotationYRad),
              0,
              Math.cos(plSd.rotationYRad)
            );
            const midAnchor = new THREE.Vector3(plSd.origin.x, plSd.origin.y, plSd.origin.z).addScaledVector(
              frontNormal,
              modForSd.dimensions.depth * 0.5
            );
            const midPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(frontNormal, midAnchor);
            const hitPt = new THREE.Vector3();
            if (raycaster.ray.intersectPlane(midPlane, hitPt)) {
              const relX = hitPt.clone().sub(plSd.origin).dot(rightAxis);
              const relY = hitPt.y - modForSd.position.y;
              cursorElevY = relY - plHSd - pTSd;

              // Support dragging horizontally into ANY bay as well as within the same bay!
              let accX = pTSd;
              for (let bI = 0; bI < bayWidthsSd.length; bI++) {
                const bw = bayWidthsSd[bI];
                if (relX >= accX - pTSd && relX <= accX + bw + pTSd) {
                  targetBayIdx = bI;
                  bayStartX = accX;
                  curBayWSd = bw;
                  break;
                }
                accX += bw + pTSd;
              }
              clampedX = Math.max(
                40,
                Math.min(Math.max(72, curBayWSd - pTSd - 40), Math.round((relX - bayStartX) / 5) * 5)
              );
            }
          }

          const bayObjSd = modForSd.bays[targetBayIdx];
          const ivsSd = bayObjSd ? getBayShelfIntervalsForSubDivider(bayObjSd, netHSd, pTSd) : [];
          const usableIvs = ivsSd.filter((iv) => !iv.hasConflict);
          const candIvs = usableIvs.length > 0 ? usableIvs : ivsSd;
          const bestIv =
            candIvs.find((iv) => cursorElevY >= iv.botY - 22 && cursorElevY <= iv.topY + 22) ||
            (candIvs.length > 0
              ? candIvs.reduce((best, iv) =>
                  Math.abs((iv.botY + iv.topY) / 2 - cursorElevY) <
                  Math.abs((best.botY + best.topY) / 2 - cursorElevY)
                    ? iv
                    : best
                )
              : {
                  botY: activeDrag3D.startSecondValueMm ?? 0,
                  height: activeDrag3D.itemHeightMm ?? 300,
                  label: "",
                });

          const targetMidY = Math.round(bestIv.botY + bestIv.height / 2);
          activeDrag3D.liveSubDivider = {
            offsetX: clampedX,
            elevationY: bestIv.botY,
            height: bestIv.height,
            targetMidY,
            targetBayIndex: targetBayIdx,
          };

          const modContainer3D = meshGroupRef.current?.children.find(
            (ch) => ch.userData?.moduleIndex === activeDrag3D?.modIdx
          );
          if (modContainer3D) {
            const tId = activeDrag3D.targetId;
            let movedSd = false;
            for (const child of modContainer3D.children) {
              const cid = String(child.userData?.componentId || "");
              if (cid === tId || cid.startsWith(`${tId}_`)) {
                if (typeof child.userData.__dragBaseH !== "number") {
                  child.userData.__dragBaseH = activeDrag3D.itemHeightMm || bestIv.height || 300;
                }
                // compGroup origin is at BOTTOM-LEFT of the sub-divider (x = bayStartX + offsetX, y = plH + T + botY)!
                child.position.x = bayStartX + clampedX;
                child.position.y = plHSd + pTSd + bestIv.botY;
                child.scale.y = Math.max(
                  0.1,
                  bestIv.height / Math.max(40, child.userData.__dragBaseH as number)
                );
                movedSd = true;
              }
            }
            if (movedSd) {
              if (selectionFrameGroupRef.current) {
                selectionFrameGroupRef.current.visible = false;
              }
              setSnapBannerDedup(
                `📐 Raf Arası Dikme • Bölme ${targetBayIdx + 1} (${bestIv.label || "Raf Arası"}) • X: ${clampedX} mm`
              );
              needsRenderRef.current = true;
              return;
            }
          }

          state.setSubDividerPlacement(
            activeDrag3D.bayIdx,
            activeDrag3D.targetId,
            { offsetX: clampedX, elevationY: bestIv.botY, height: bestIv.height, targetMidY, targetBayIndex: targetBayIdx },
            false
          );
          setSnapBannerDedup(`📐 Raf Arası Dikme • Bölme ${targetBayIdx + 1} • X: ${clampedX} mm`);
          return;
        }

        // True 3D ray-plane vertical tracking (1:1 locked to cursor from bottom to top of cabinet!)
        let verticalDeltaMm = -dyPx * activeDrag3D.mmPerPx;
        const curCamElev = (controlsRef.current?.object as THREE.Camera) || perspCamRef.current;
        if (curRenderer && curCamElev && activeDrag3D.dragPlane && activeDrag3D.startPlaneHit) {
          const rectElev = canvasRectRef.current || curRenderer.domElement.getBoundingClientRect();
          const ndcXElev = ((e.clientX - rectElev.left) / rectElev.width) * 2 - 1;
          const ndcYElev = -((e.clientY - rectElev.top) / rectElev.height) * 2 + 1;
          raycaster.setFromCamera(new THREE.Vector2(ndcXElev, ndcYElev), curCamElev);
          const curHitElev = new THREE.Vector3();
          if (raycaster.ray.intersectPlane(activeDrag3D.dragPlane, curHitElev)) {
            const planeDy = curHitElev.y - activeDrag3D.startPlaneHit.y;
            if (Math.abs(planeDy) < 6000) {
              verticalDeltaMm = planeDy;
            }
          }
        }
        const rawElevY = activeDrag3D.startValueMm + verticalDeltaMm;
        const targets =
          activeDrag3D.cachedSnapTargets ||
          computeElevationSnapTargets(
            state.project,
            activeDrag3D.modIdx,
            activeDrag3D.bayIdx,
            activeDrag3D.targetId,
            activeDrag3D.itemHeightMm
          );
        const { elevationY: rawSnappedY, snappedTarget } =
          activeDrag3D.kind === "shelf"
            ? snapShelfToMultiHoleOrElevationTargets({
                project: state.project,
                moduleIndex: activeDrag3D.modIdx,
                bayIndex: activeDrag3D.bayIdx,
                shelfId: activeDrag3D.targetId,
                rawElevationY: rawElevY,
                snapTargets: targets,
                bypassMultiHole: false,
              })
            : resolveElevationSnap(rawElevY, targets, 18);
        setActive3DSnap(snappedTarget);

        const modForClamp = state.project.modules[activeDrag3D.modIdx];
        const TClamp = modForClamp?.carcass.panelThickness || 18;
        const plinthClamp = modForClamp?.carcass.plinthHeight ?? 100;
        const netHClamp = modForClamp
          ? Math.max(200, modForClamp.dimensions.height - plinthClamp - 2 * TClamp)
          : 2000;
        const itemH = activeDrag3D.itemHeightMm || TClamp;
        const clampedSnappedY =
          activeDrag3D.kind === "shelf"
            ? snappedTarget?.kind === "system32_hole"
              ? Math.round(rawSnappedY)
              : Math.max(32, Math.min(Math.max(64, netHClamp - 32), Math.round(rawSnappedY)))
            : activeDrag3D.kind === "drawer"
            ? Math.max(0, Math.min(Math.max(0, netHClamp - itemH), Math.round(rawSnappedY)))
            : activeDrag3D.kind === "rail"
            ? Math.max(120, Math.min(Math.max(160, netHClamp - 32), Math.round(rawSnappedY)))
            : Math.max(32, Math.min(Math.max(64, netHClamp - itemH), Math.round(rawSnappedY)));

        activeDrag3D.liveSnappedY = clampedSnappedY;
        const deltaY = clampedSnappedY - activeDrag3D.startValueMm;

        // V83: Live 3D Cross-Bay & Cross-Module Tracking — detect which bay/module divider gap the cursor is over!
        let destModIdxLive = activeDrag3D.modIdx;
        let destBayIdxLive = activeDrag3D.bayIdx;
        let deltaX = 0;
        let deltaZ = 0;
        if (curRenderer && curCamElev && meshGroupRef.current && modForClamp) {
          const rectLive = canvasRectRef.current && canvasRectRef.current.width > 0 ? canvasRectRef.current : curRenderer.domElement.getBoundingClientRect();
          if (rectLive.width > 0 && rectLive.height > 0) {
            const ndcLive = new THREE.Vector2(
              ((e.clientX - rectLive.left) / rectLive.width) * 2 - 1,
              -((e.clientY - rectLive.top) / rectLive.height) * 2 + 1
            );
            raycaster.setFromCamera(ndcLive, curCamElev);
            const hoverHits = raycaster.intersectObjects(meshGroupRef.current.children, true);
            for (const hh of hoverHits) {
              const hCid = String(hh.object?.userData?.componentId || "");
              const hPid = String(hh.object?.userData?.parentComponentId || "");
              const hRole = String(hh.object?.userData?.role || "");
              if (hCid && (hCid === activeDrag3D.targetId || hCid.startsWith(`${activeDrag3D.targetId}_`) || hPid === activeDrag3D.targetId)) continue;
              if (hRole === "door_left" || hRole === "door_right" || hRole === "door_handle") continue;
              const hModIdx = typeof hh.object?.userData?.moduleIndex === "number" ? hh.object.userData.moduleIndex : -1;
              if (hModIdx >= 0) {
                const hMod = state.project.modules[hModIdx];
                if (hMod && hMod.category !== "complementary" && hMod.bays.length > 0) {
                  const rotRad = -((hMod.rotation?.y || 0) * Math.PI) / 180;
                  const dxW = hh.point.x - hMod.position.x;
                  const dzW = hh.point.z - hMod.position.z;
                  const localHitX = dxW * Math.cos(-rotRad) - dzW * Math.sin(-rotRad);
                  const hBayWidths = calculateBayWidths(hMod);
                  const hPT = hMod.carcass.panelThickness || 18;
                  let cursorX = hPT;
                  let resolvedBay = -1;
                  for (let bi = 0; bi < hMod.bays.length; bi += 1) {
                    const bw = hBayWidths[bi] || 500;
                    if (localHitX >= cursorX - hPT * 0.6 && localHitX <= cursorX + bw + hPT * 0.6) {
                      resolvedBay = bi;
                      break;
                    }
                    cursorX += bw + hPT;
                  }
                  if (resolvedBay < 0) {
                    resolvedBay = localHitX < hMod.dimensions.width * 0.5 ? 0 : hMod.bays.length - 1;
                  }
                  destModIdxLive = hModIdx;
                  destBayIdxLive = resolvedBay;
                  break;
                }
              }
            }
          }
          activeDrag3D.liveDestModIdx = destModIdxLive;
          activeDrag3D.liveDestBayIdx = destBayIdxLive;
          const getBayCenterLocalX = (m: typeof modForClamp, bi: number) => {
            const bws = calculateBayWidths(m);
            const pt = m.carcass.panelThickness || 18;
            let cx = pt;
            for (let i = 0; i < bi; i += 1) cx += (bws[i] || 500) + pt;
            return cx + (bws[bi] || 500) * 0.5;
          };
          const srcCenterLocalX = getBayCenterLocalX(modForClamp, activeDrag3D.bayIdx);
          const dstModObj = state.project.modules[destModIdxLive] || modForClamp;
          const dstCenterLocalX = getBayCenterLocalX(dstModObj, destBayIdxLive);
          if (destModIdxLive === activeDrag3D.modIdx) {
            deltaX = dstCenterLocalX - srcCenterLocalX;
            deltaZ = 0;
          } else {
            deltaX = (dstModObj.position.x + dstCenterLocalX) - (modForClamp.position.x + srcCenterLocalX);
            deltaZ = dstModObj.position.z - modForClamp.position.z;
          }
          if (destModIdxLive !== activeDrag3D.modIdx || destBayIdxLive !== activeDrag3D.bayIdx) {
            setSnapBannerDedup(
              destModIdxLive !== activeDrag3D.modIdx
                ? `⇄ Modül #${destModIdxLive + 1} · ${destBayIdxLive + 1}. Bölmeye Taşı • Y: ${clampedSnappedY} mm`
                : `⇄ ${destBayIdxLive + 1}. Bölmeye Taşı • Y: ${clampedSnappedY} mm`
            );
          }
        }

        // Direct 0.0ms GPU X/Y/Z-translation for shelf, drawer, rail, and special_fitting across dividers!
        // Avoids rebuilding the cabinet's 100+ meshes, clothing props, CNC multi-holes, and 2D/UI trees on 60Hz mousemove.
        const modContainer3D = meshGroupRef.current?.children.find(
          (ch) => ch.userData?.moduleIndex === activeDrag3D?.modIdx
        );
        if (modContainer3D && modForClamp) {
          const bayObj = modForClamp.bays[activeDrag3D.bayIdx];
          const tId = activeDrag3D.targetId;
          const mId = modForClamp.id;
          const bIdx = activeDrag3D.bayIdx;
          const sIdx = bayObj ? bayObj.shelves.findIndex((s) => s.id === tId) : -1;
          const rIdx = bayObj ? bayObj.hangingRails.findIndex((r) => r.id === tId) : -1;
          const fIdx = bayObj ? (bayObj.specialFittings || []).findIndex((f) => f.id === tId) : -1;

          let movedAny = false;
          for (const child of modContainer3D.children) {
            const cid = String(child.userData?.componentId || "");
            const pid = String(child.userData?.parentComponentId || "");
            const shOwner = String(child.userData?.shelfOwnerId || "");
            let match = false;
            if (activeDrag3D.kind === "shelf") {
              match =
                cid === tId ||
                cid.startsWith(`${tId}_pin_`) ||
                cid.startsWith(`${tId}_cam_`) ||
                shOwner === tId ||
                (sIdx >= 0 &&
                  (cid === `${mId}_bay_${bIdx}_shelf_${sIdx}` ||
                    cid === `${mId}_bay_${bIdx}_recessed_led_sh_${sIdx}` ||
                    cid === `${tId}_l_shelf_ret_${sIdx}` ||
                    cid === `${tId}_diag_shelf_ret_${sIdx}`));
            } else if (activeDrag3D.kind === "drawer") {
              match =
                cid === tId ||
                cid.startsWith(`${tId}_`) ||
                pid === tId ||
                pid.startsWith(`${tId}_`);
            } else if (activeDrag3D.kind === "rail") {
              match =
                cid === tId ||
                cid.startsWith(`${tId}_`) ||
                (rIdx >= 0 &&
                  (cid === `${mId}_bay_${bIdx}_rail_${rIdx}` ||
                    cid === `${mId}_bay_${bIdx}_recessed_led_rod_${rIdx}`));
            } else if (activeDrag3D.kind === "special_fitting") {
              const fallbackFitPrefix = fIdx >= 0 ? `${mId}_bay_${bIdx}_fit_${fIdx}` : "";
              match =
                cid === tId ||
                cid.startsWith(`${tId}_`) ||
                (Boolean(fallbackFitPrefix) &&
                  (cid === fallbackFitPrefix || cid.startsWith(`${fallbackFitPrefix}_`)));
            }

            if (match) {
              if (typeof child.userData.__dragBaseX !== "number") {
                child.userData.__dragBaseX = child.position.x;
              }
              if (typeof child.userData.__dragBaseY !== "number") {
                child.userData.__dragBaseY = child.position.y;
              }
              if (typeof child.userData.__dragBaseZ !== "number") {
                child.userData.__dragBaseZ = child.position.z;
              }
              child.position.set(
                (child.userData.__dragBaseX as number) + deltaX,
                (child.userData.__dragBaseY as number) + deltaY,
                (child.userData.__dragBaseZ as number) + deltaZ
              );
              movedAny = true;
            }
          }

          // Also glide clothing, folded stacks, boxes & shoes belonging to this rail/shelf/fitting in real time!
          const modPropsNode = interiorPropsGroupRef.current?.children.find(
            (ch) => ch.userData?.moduleId === mId || ch.userData?.moduleIndex === activeDrag3D?.modIdx
          );
          if (modPropsNode) {
            let movedProp = false;
            for (const bayGrp of modPropsNode.children) {
              for (const propItem of bayGrp.children) {
                const pud = propItem.userData;
                if (!pud || pud.propBayIndex !== bIdx || pud.propOwnerKind !== activeDrag3D.kind) continue;
                const idMatches =
                  pud.propOwnerId === tId ||
                  (activeDrag3D.kind === "shelf" && sIdx >= 0 && pud.propOwnerIdx === sIdx) ||
                  (activeDrag3D.kind === "rail" && rIdx >= 0 && pud.propOwnerIdx === rIdx) ||
                  (activeDrag3D.kind === "special_fitting" && fIdx >= 0 && pud.propOwnerIdx === fIdx);
                if (idMatches) {
                  if (typeof pud.__dragBaseX !== "number") {
                    pud.__dragBaseX = propItem.position.x;
                  }
                  if (typeof pud.__dragBaseY !== "number") {
                    pud.__dragBaseY = propItem.position.y;
                  }
                  if (typeof pud.__dragBaseZ !== "number") {
                    pud.__dragBaseZ = propItem.position.z;
                  }
                  propItem.position.set(
                    (pud.__dragBaseX as number) + deltaX,
                    (pud.__dragBaseY as number) + deltaY,
                    (pud.__dragBaseZ as number) + deltaZ
                  );
                  propItem.updateMatrix();
                  movedProp = true;
                }
              }
            }
            if (movedProp) {
              modPropsNode.updateMatrixWorld(true);
            }
          }

          if (movedAny) {
            if (selectionFrameGroupRef.current) {
              selectionFrameGroupRef.current.position.set(deltaX, deltaY, deltaZ);
            }
            needsRenderRef.current = true;
            return;
          }
        }

        // Fallback if procedural capsule hull or custom structure has no discrete child group
        if (activeDrag3D.kind === "shelf") {
          state.setShelfElevation(activeDrag3D.bayIdx, activeDrag3D.targetId, clampedSnappedY, false);
        } else if (activeDrag3D.kind === "drawer") {
          state.setDrawerPlacement(
            activeDrag3D.bayIdx,
            activeDrag3D.targetId,
            clampedSnappedY,
            undefined,
            false
          );
        } else if (activeDrag3D.kind === "rail") {
          state.setHangingRailElevation(activeDrag3D.bayIdx, activeDrag3D.targetId, clampedSnappedY, false);
        } else if (activeDrag3D.kind === "special_fitting") {
          state.setSpecialFittingPlacement?.(activeDrag3D.bayIdx, activeDrag3D.targetId, { elevationY: clampedSnappedY }, false);
        }
      };

      const handlePointerMove = (e: PointerEvent) => {
        if (!activeDrag3D) {
          processPointerMoveImmediate(e);
          return;
        }
        latestDragPointerEvent = e;
        if (!dragMoveRafId) {
          dragMoveRafId = window.requestAnimationFrame(() => {
            dragMoveRafId = 0;
            if (latestDragPointerEvent) {
              processPointerMoveImmediate(latestDragPointerEvent);
            }
          });
        }
      };

      const handlePointerUp = (e: PointerEvent) => {
        if (dragMoveRafId) {
          window.cancelAnimationFrame(dragMoveRafId);
          dragMoveRafId = 0;
          if (latestDragPointerEvent && activeDrag3D) {
            processPointerMoveImmediate(latestDragPointerEvent);
          }
        }
        latestDragPointerEvent = null;
        delete document.body.dataset.birimUiDragging;

        const curRenderer = rendererRef.current;
        const curControls = controlsRef.current;
        if (curControls) {
          curControls.enabled = true;
          curControls.enablePan = true;
          curControls.mouseButtons.LEFT = THREE.MOUSE.PAN;
        }

        if (activeDrag3D) {
          const moved = activeDrag3D.hasMoved;
          const dragKind = activeDrag3D.kind;
          const dragModIdx = activeDrag3D.modIdx;
          const dragBayIdx = activeDrag3D.bayIdx;
          const dragTargetId = activeDrag3D.targetId;
          const dragStartX = activeDrag3D.startValueMm;
          const pendingGpuX = activeDrag3D.liveGpuX;
          const pendingGpuY = activeDrag3D.liveGpuY;
          const pendingGpuZ = activeDrag3D.liveGpuZ;
          const pendingTargetWallId = activeDrag3D.liveTargetWallId;
          const pendingTargetRotY = activeDrag3D.liveTargetRotY;
          const pendingSnappedY = activeDrag3D.liveSnappedY;
          const pendingDestModIdx = activeDrag3D.liveDestModIdx;
          const pendingDestBayIdx = activeDrag3D.liveDestBayIdx;
          const pendingSubDivider = activeDrag3D.liveSubDivider;
          activeDrag3D = null;
          setActive3DSnap(null);
          if (curRenderer) {
            curRenderer.domElement.style.cursor = (e.ctrlKey || e.metaKey) ? "move" : "grab";
          }
          if (selectionFrameGroupRef.current) {
            selectionFrameGroupRef.current.position.set(0, 0, 0);
          }
          if (activeModFrameGroupRef.current) {
            activeModFrameGroupRef.current.position.set(0, 0, 0);
          }
          const state = latestStateRef.current;
          if (dragKind === "scene_object_3d") {
            if (moved && (typeof pendingGpuX === "number" || typeof pendingGpuZ === "number")) {
              const curSobj = (state.project.sceneObjects || []).find((o) => o.id === dragTargetId);
              if (curSobj) {
                state.updateSceneObject(dragTargetId, {
                  position: {
                    x: typeof pendingGpuX === "number" ? pendingGpuX : curSobj.position.x,
                    y: curSobj.position.y,
                    z: typeof pendingGpuZ === "number" ? pendingGpuZ : curSobj.position.z,
                  },
                });
              }
            }
            setSnapBannerDedup(null);
            state.commitHistoryTransaction();
          } else if (dragKind === "module_3d" || dragKind === "obstacle_3d") {
            if (dragKind === "module_3d") {
              liveDimDeltaRef.current = { dx: 0, dz: 0 };
              if (!moved) {
                const actDim = dimGroupRef.current?.children.find((c) => c.userData?.isActiveModuleDim);
                if (actDim && actDim.userData.baseOrigin instanceof THREE.Vector3) {
                  actDim.position.copy(actDim.userData.baseOrigin);
                }
              }
            }
            if (ghostSnapGroupRef.current) {
              disposeObject3DTree(ghostSnapGroupRef.current);
              ghostSnapGroupRef.current.clear();
              needsRenderRef.current = true;
            }
            if (dragKind === "obstacle_3d") {
              roomArchGroupRef.current?.traverse((node) => {
                delete node.userData.__dragBaseX;
                delete node.userData.__dragBaseY;
                delete node.userData.__dragBaseZ;
              });
              if (moved && typeof pendingGpuX === "number" && typeof pendingGpuY === "number" && typeof pendingGpuZ === "number") {
                state.updateObstaclePosition(dragTargetId, pendingGpuX, pendingGpuZ, pendingGpuY);
              }
              setSnapBannerDedup(null);
              state.commitHistoryTransaction();
            } else if (dragKind === "module_3d" && moved) {
              if (selectionFrameGroupRef.current) selectionFrameGroupRef.current.visible = true;
              if (activeModFrameGroupRef.current) activeModFrameGroupRef.current.visible = true;
              if (pendingTargetWallId && typeof pendingTargetRotY === "number") {
                const stCross = useConfiguratorStore.getState();
                stCross.applyBatchProjectUpdate((draft) => {
                  const dm = draft.modules[dragModIdx];
                  if (dm) {
                    if (typeof pendingGpuX === "number") dm.position.x = pendingGpuX;
                    if (typeof pendingGpuZ === "number") dm.position.z = pendingGpuZ;
                    dm.rotation = { x: 0, y: pendingTargetRotY, z: 0 };
                  }
                }, "Modül başka duvara taşındı");
                stCross.setActiveWallId(pendingTargetWallId);
                state.commitHistoryTransaction();
                const movedWallName =
                  getEffectiveSpaceWalls(stCross.project).find((w) => w.id === pendingTargetWallId)
                    ?.name || "Hedef Duvar";
                setSnapBannerDedup(`✓ Modül "${movedWallName}" üzerine taşındı`);
                setTimeout(() => setSnapBannerDedup(null), 2800);
                return;
              }
              if (typeof pendingGpuX === "number" || typeof pendingGpuZ === "number") {
                const mCur = state.project.modules[dragModIdx];
                if (mCur) {
                  state.setModulePosition(
                    dragModIdx,
                    typeof pendingGpuX === "number" ? pendingGpuX : mCur.position.x,
                    typeof pendingGpuZ === "number" ? pendingGpuZ : mCur.position.z,
                    1
                  );
                }
              }
              const swapMsg = state.finishModuleDragWithSmartSwap(dragModIdx, dragStartX);
              state.commitHistoryTransaction();
              if (swapMsg) {
                setSnapBannerDedup(swapMsg);
                setTimeout(() => setSnapBannerDedup(null), 2800);
              } else {
                setSnapBannerDedup(null);
              }
            } else {
              state.commitHistoryTransaction();
            }
          } else {
            // Clear temporary __dragBaseY markers and commit final snapped elevation once on pointerup!
            const modContainer3D = meshGroupRef.current?.children.find(
              (ch) => ch.userData?.moduleIndex === dragModIdx
            );
            if (modContainer3D) {
              for (const child of modContainer3D.children) {
                delete child.userData.__dragBaseX;
                delete child.userData.__dragBaseY;
                delete child.userData.__dragBaseZ;
                delete child.userData.__dragBaseH;
                child.scale.y = 1;
              }
            }
            const modPropsCleanup = interiorPropsGroupRef.current?.children.find(
              (ch) => ch.userData?.moduleIndex === dragModIdx
            );
            if (modPropsCleanup) {
              for (const bayGrp of modPropsCleanup.children) {
                for (const propItem of bayGrp.children) {
                  if (
                    typeof propItem.userData?.__dragBaseY === "number" ||
                    typeof propItem.userData?.__dragBaseX === "number"
                  ) {
                    if (typeof propItem.userData.__dragBaseX === "number") {
                      propItem.position.x = propItem.userData.__dragBaseX;
                      delete propItem.userData.__dragBaseX;
                    }
                    if (typeof propItem.userData.__dragBaseY === "number") {
                      propItem.position.y = propItem.userData.__dragBaseY;
                      delete propItem.userData.__dragBaseY;
                    }
                    if (typeof propItem.userData.__dragBaseZ === "number") {
                      propItem.position.z = propItem.userData.__dragBaseZ;
                      delete propItem.userData.__dragBaseZ;
                    }
                    propItem.updateMatrix();
                  }
                }
              }
              modPropsCleanup.updateMatrixWorld(true);
            }
            if (selectionFrameGroupRef.current) {
              selectionFrameGroupRef.current.visible = true;
            }
            setSnapBannerDedup(null);
            // V51: Cross-Module Interior Component Drop — check if cursor was released over another module & bay!
            let transferredCrossModule = false;
            if (
              moved &&
              curRenderer &&
              meshGroupRef.current &&
              (dragKind === "shelf" || dragKind === "drawer" || dragKind === "rail" || dragKind === "special_fitting" || dragKind === "sub_divider")
            ) {
              const dropRect = canvasRectRef.current && canvasRectRef.current.width > 0 ? canvasRectRef.current : curRenderer.domElement.getBoundingClientRect();
              const dropCam = (curControls?.object as THREE.Camera) || perspCamRef.current;
              if (dropCam && dropRect.width > 0 && dropRect.height > 0) {
                const ndcDrop = new THREE.Vector2(
                  ((e.clientX - dropRect.left) / dropRect.width) * 2 - 1,
                  -((e.clientY - dropRect.top) / dropRect.height) * 2 + 1
                );
                raycaster.setFromCamera(ndcDrop, dropCam);
                const dropHits = raycaster.intersectObjects(meshGroupRef.current.children, true);
                const liveHitOverride =
                  typeof pendingDestModIdx === "number" &&
                  typeof pendingDestBayIdx === "number" &&
                  (pendingDestModIdx !== dragModIdx || pendingDestBayIdx !== dragBayIdx)
                    ? [{ object: { userData: { moduleIndex: pendingDestModIdx, bayIndex: pendingDestBayIdx, componentId: "" } }, point: new THREE.Vector3(0, 0, 0) }]
                    : null;
                for (const dh of (liveHitOverride || dropHits)) {
                  // Skip the dragged component itself & door leaves so we detect the bay/module behind the cursor!
                  const hitCid = String(dh.object?.userData?.componentId || "");
                  const hitRole = String((dh.object?.userData as Record<string, unknown> | undefined)?.role || "");
                  if (hitCid && (hitCid === dragTargetId || hitCid.includes(dragTargetId))) continue;
                  if (hitRole === "door_left" || hitRole === "door_right" || hitRole === "door_handle") continue;
                  const dModIdx = typeof dh.object?.userData?.moduleIndex === "number" ? dh.object.userData.moduleIndex : -1;
                  if (dModIdx >= 0) {
                    const destMod = state.project.modules[dModIdx];
                    if (destMod && destMod.category !== "complementary" && destMod.bays.length > 0) {
                      // Compute exact destination bay from hit point local X (works even when dropping on back panel or across bays of the SAME module!)
                      let dBayIdx =
                        typeof dh.object?.userData?.bayIndex === "number" && dh.object.userData.bayIndex >= 0
                          ? Math.max(0, Math.min(destMod.bays.length - 1, dh.object.userData.bayIndex))
                          : -1;
                      if (!liveHitOverride && (dBayIdx < 0 || destMod.bays.length > 1)) {
                        const rotRad = -((destMod.rotation?.y || 0) * Math.PI) / 180;
                        const dxW = dh.point.x - destMod.position.x;
                        const dzW = dh.point.z - destMod.position.z;
                        const localHitX = dxW * Math.cos(-rotRad) - dzW * Math.sin(-rotRad);
                        const pT = destMod.carcass.panelThickness || 18;
                        const netW = Math.max(100, destMod.dimensions.width - (destMod.bays.length + 1) * pT);
                        const fixedSum = destMod.bays.reduce((acc, b) => acc + (b.customWidth || 0), 0);
                        const autoCount = destMod.bays.filter((b) => !b.customWidth).length;
                        const autoBw = autoCount > 0 ? Math.max(100, (netW - fixedSum) / autoCount) : netW / Math.max(1, destMod.bays.length);
                        let cursorX = pT;
                        for (let bi = 0; bi < destMod.bays.length; bi += 1) {
                          const bw = destMod.bays[bi]?.customWidth || autoBw;
                          if (localHitX >= cursorX - pT && localHitX <= cursorX + bw + pT) {
                            dBayIdx = bi;
                            break;
                          }
                          cursorX += bw + pT;
                        }
                        if (dBayIdx < 0) {
                          dBayIdx = localHitX < destMod.dimensions.width * 0.5 ? 0 : destMod.bays.length - 1;
                        }
                      }
                      if (dModIdx === dragModIdx && dBayIdx === dragBayIdx) {
                        break;
                      }
                      const destPlinth = destMod.carcass.plinthHeight ?? 100;
                      const destT = destMod.carcass.panelThickness || 18;
                      const destMaxY = Math.max(200, destMod.dimensions.height - destPlinth - 2 * destT - 60);
                      const rawDropY = Math.max(64, Math.min(destMaxY, Math.round((dh.point.y - destMod.position.y - destPlinth - destT) / 32) * 32));
                      const targetElevY = typeof pendingSnappedY === "number" ? Math.max(64, Math.min(destMaxY, pendingSnappedY)) : rawDropY;
                      const stStore = useConfiguratorStore.getState();
                      stStore.applyBatchProjectUpdate((draft) => {
                        const srcBay = draft.modules[dragModIdx]?.bays[dragBayIdx];
                        const dstBay = draft.modules[dModIdx]?.bays[dBayIdx];
                        if (!srcBay || !dstBay) return;
                        if (dragKind === "shelf") {
                          const idx = srcBay.shelves.findIndex((s) => s.id === dragTargetId || dragTargetId.includes(s.id));
                          if (idx >= 0) {
                            const [movedItem] = srcBay.shelves.splice(idx, 1);
                            movedItem.elevationY = targetElevY;
                            dstBay.shelves.push(movedItem);
                            transferredCrossModule = true;
                          }
                        } else if (dragKind === "drawer") {
                          const idx = srcBay.drawers.findIndex((d) => d.id === dragTargetId || dragTargetId.includes(d.id));
                          if (idx >= 0) {
                            const [movedItem] = srcBay.drawers.splice(idx, 1);
                            movedItem.elevationY = targetElevY;
                            dstBay.drawers.push(movedItem);
                            transferredCrossModule = true;
                          }
                        } else if (dragKind === "rail") {
                          const idx = srcBay.hangingRails.findIndex((r) => r.id === dragTargetId || dragTargetId.includes(r.id));
                          if (idx >= 0) {
                            const [movedItem] = srcBay.hangingRails.splice(idx, 1);
                            movedItem.elevationY = targetElevY;
                            dstBay.hangingRails.push(movedItem);
                            transferredCrossModule = true;
                          }
                        } else if (dragKind === "special_fitting" && srcBay.specialFittings) {
                          const idx = srcBay.specialFittings.findIndex((f) => f.id === dragTargetId || dragTargetId.includes(f.id));
                          if (idx >= 0) {
                            const [movedItem] = srcBay.specialFittings.splice(idx, 1);
                            movedItem.elevationY = targetElevY;
                            if (!dstBay.specialFittings) dstBay.specialFittings = [];
                            dstBay.specialFittings.push(movedItem);
                            transferredCrossModule = true;
                          }
                        } else if (dragKind === "sub_divider" && srcBay.subDividers) {
                          const idx = srcBay.subDividers.findIndex((sd) => sd.id === dragTargetId || dragTargetId.includes(sd.id));
                          if (idx >= 0) {
                            const [movedItem] = srcBay.subDividers.splice(idx, 1);
                            movedItem.elevationY = targetElevY;
                            if (!dstBay.subDividers) dstBay.subDividers = [];
                            dstBay.subDividers.push(movedItem);
                            transferredCrossModule = true;
                          }
                        }
                      }, "Donanım başka modüle taşındı");
                      if (transferredCrossModule) {
                        stStore.setActiveModuleIndex(dModIdx);
                        stStore.setActiveBayIndex(dBayIdx);
                        setSnapBannerDedup(dModIdx === dragModIdx ? `✓ ${dBayIdx + 1}. Bölmeye taşındı` : `✓ Modül #${dModIdx + 1} · ${dBayIdx + 1}. Bölmeye taşındı`);
                        setTimeout(() => setSnapBannerDedup(null), 2600);
                      }
                    }
                    break;
                  }
                }
              }
            }
            if (!transferredCrossModule && moved && dragKind === "sub_divider" && pendingSubDivider) {
              state.setSubDividerPlacement(dragBayIdx, dragTargetId, pendingSubDivider, false);
              if (
                typeof pendingSubDivider.targetBayIndex === "number" &&
                pendingSubDivider.targetBayIndex !== dragBayIdx
              ) {
                state.setActiveBayIndex(pendingSubDivider.targetBayIndex);
              }
            } else if (!transferredCrossModule && moved && typeof pendingSnappedY === "number") {
              if (dragKind === "shelf") {
                state.setShelfElevation(dragBayIdx, dragTargetId, pendingSnappedY, false);
              } else if (dragKind === "drawer") {
                state.setDrawerPlacement(dragBayIdx, dragTargetId, pendingSnappedY, undefined, false);
              } else if (dragKind === "rail") {
                state.setHangingRailElevation(dragBayIdx, dragTargetId, pendingSnappedY, false);
              } else if (dragKind === "special_fitting") {
                state.setSpecialFittingPlacement?.(
                  dragBayIdx,
                  dragTargetId,
                  { elevationY: pendingSnappedY },
                  false
                );
              }
            }
            state.commitHistoryTransaction();
          }
          if (moved) return;
        }

        const clickTravel = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
        downPos = { x: -99999, y: -99999 };
        if (e.button !== 0) return;
        if (!curRenderer || e.target !== curRenderer.domElement) return;
        if (clickTravel > 8) return;
        const curGroup = meshGroupRef.current;
        if (!curGroup) return;

        const rect =
          canvasRectRef.current && canvasRectRef.current.width > 0
            ? canvasRectRef.current
            : curRenderer.domElement.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        const curCam = (controlsRef.current?.object as THREE.Camera) || perspCamRef.current;
        if (!curCam) return;

        raycaster.setFromCamera(pointer, curCam);
        const state = latestStateRef.current;
        const anyDoorsOpen =
          state.doorsHiddenIn3D ||
          state.doorOpenAngleDeg > 5 ||
          state.project.modules.some(
            (m) =>
              Boolean(m.isOpenFront) ||
              m.bays.some((b) => b.door.type === "open" || b.door.doorSystemId === "open")
          );
        const solidMeshes = getCachedSolidMeshes(curGroup, anyDoorsOpen);
        const hits = raycaster.intersectObjects(solidMeshes, false);
        for (const h of hits) {
          const hitObj = h.object;
          if (hitObj?.userData?.componentId) {
            const hitModIdx =
              typeof hitObj.userData.moduleIndex === "number"
                ? hitObj.userData.moduleIndex
                : state.activeModuleIndex;
            const hitMod = state.project.modules[hitModIdx];
            const roleStr = String(hitObj.userData.role || "");

            // Determine bayIndex either from mesh userData or fast O(1) bay widths without full 3D mesh generation!
            let resolvedBayIdx =
              typeof hitObj.userData.bayIndex === "number" ? hitObj.userData.bayIndex : -1;
            if (resolvedBayIdx < 0 && hitMod && hitMod.bays.length > 0) {
              const bayWidths = calculateBayWidths(hitMod);
              const T = hitMod.carcass.panelThickness || 18;
              const localX = h.point.x - hitMod.position.x;
              let accX = T;
              for (let bIdx = 0; bIdx < hitMod.bays.length; bIdx++) {
                const bw = bayWidths[bIdx] || 500;
                if (localX <= accX + bw + T * 0.5 || bIdx === hitMod.bays.length - 1) {
                  resolvedBayIdx = bIdx;
                  break;
                }
                accX += bw + T;
              }
            }

            const rawCompId = String(hitObj.userData.componentId);
            const resolvedCompId =
              roleStr === "door_handle" && hitObj.userData.parentComponentId
                ? String(hitObj.userData.parentComponentId)
                : rawCompId;

            // V15 3B Damlalık (Eyedropper: Alt+Tık veya Damlalık Modu) & 3B Boya Kovası (Paint Bucket: B)
            const activePaintState = paintTool3DRef.current;
            if (activePaintState.mode === "eyedropper" || e.altKey) {
              const sampledDef = hitObj.userData?.matDef as MaterialDefinition | undefined;
              const fallbackMatId =
                sampledDef?.id ||
                (roleStr === "countertop"
                  ? hitMod?.carcass.countertopMaterialId
                  : roleStr.includes("door") || roleStr === "drawer_front"
                  ? hitMod?.carcass.doorMaterialId
                  : hitMod?.carcass.bodyMaterialId) ||
                "mat_veneer_oak";
              const allMats = [...DEFAULT_MATERIALS, ...(state.project.customMaterials || [])];
              const foundMat = allMats.find((m) => m.id === fallbackMatId);
              const nextToolState: PaintTool3DState = {
                ...activePaintState,
                mode: "paint",
                materialId: fallbackMatId,
              };
              setPaintTool3D(nextToolState);
              setActiveBrushMaterialId(fallbackMatId);
              if (typeof window !== "undefined") {
                window.dispatchEvent(
                  new CustomEvent("birim:material-sampled-3d", {
                    detail: {
                      materialId: fallbackMatId,
                      materialName: foundMat?.name || fallbackMatId,
                      moduleIndex: hitModIdx,
                      bayIndex: Math.max(0, resolvedBayIdx),
                      role: roleStr,
                      toolState: nextToolState,
                    },
                  })
                );
              }
              return;
            }

            if (activePaintState.mode === "paint" && activePaintState.materialId) {
              restoreHoverPreviewMaterials();
              const targetMatId = activePaintState.materialId;
              const allMats = [...DEFAULT_MATERIALS, ...(state.project.customMaterials || [])];
              const targetMatDef = allMats.find((m) => m.id === targetMatId);
              const clickedCurMatId =
                (hitObj.userData?.matDef as MaterialDefinition | undefined)?.id ||
                hitMod?.componentMaterialOverrides?.[resolvedCompId] ||
                (roleStr.includes("door") || roleStr === "drawer_front"
                  ? hitMod?.carcass.doorMaterialId
                  : hitMod?.carcass.bodyMaterialId);

              let paintedTargetLabel = targetMatDef?.name || "Malzeme";
              if (
                (e.shiftKey || activePaintState.clickBehavior === "replace_matching_project") &&
                clickedCurMatId
              ) {
                useConfiguratorStore.getState().applyBatchProjectUpdate((draft) => {
                  replaceExistingMaterialAcrossProjectDraft(draft, clickedCurMatId, targetMatId);
                }, `${targetMatDef?.name || "Malzeme"} tüm eşleşen yüzeylere uygulandı`);
                paintedTargetLabel = `${targetMatDef?.name || "Malzeme"} → Tüm Eşleşen Yüzeyler`;
              } else if (e.ctrlKey || e.metaKey || activePaintState.clickBehavior === "clicked_module") {
                useConfiguratorStore.getState().applyBatchProjectUpdate((draft) => {
                  applyZoneMaterialToProjectDraft(draft, hitModIdx, "active_module", targetMatId, allMats);
                }, `${targetMatDef?.name || "Malzeme"} modüle uygulandı`);
                paintedTargetLabel = `${targetMatDef?.name || "Malzeme"} → Tüm Dolap`;
              } else if (activePaintState.clickBehavior === "clicked_part") {
                useConfiguratorStore.getState().applyBatchProjectUpdate((draft) => {
                  const targetDraftMod = draft.modules[hitModIdx];
                  if (!targetDraftMod) return;
                  if (!targetDraftMod.componentMaterialOverrides) {
                    targetDraftMod.componentMaterialOverrides = {};
                  }
                  targetDraftMod.componentMaterialOverrides[resolvedCompId] = targetMatId;
                  targetDraftMod.componentMaterialOverrides[rawCompId] = targetMatId;
                }, `${targetMatDef?.name || "Malzeme"} tek parçaya uygulandı`);
                paintedTargetLabel = `${targetMatDef?.name || "Malzeme"} → Tek Parça`;
              } else {
                // True Surface-Aware Smart Brush Routing: doors paint fronts, side/top/shelf paints carcass!
                const resolvedSmart = resolveSmartPaintScopeForClickedRole(
                  roleStr,
                  activePaintState.zoneScope
                );
                useConfiguratorStore.getState().applyBatchProjectUpdate((draft) => {
                  applyZoneMaterialToProjectDraft(
                    draft,
                    hitModIdx,
                    resolvedSmart.scope,
                    targetMatId,
                    allMats
                  );
                }, `${targetMatDef?.name || "Malzeme"} (${resolvedSmart.surfaceLabelTr})`);
                paintedTargetLabel = `${targetMatDef?.name || "Malzeme"} → ${resolvedSmart.surfaceLabelTr}`;
              }
              if (typeof window !== "undefined") {
                window.dispatchEvent(
                  new CustomEvent("birim:material-painted-3d", {
                    detail: {
                      materialId: targetMatId,
                      materialName: paintedTargetLabel,
                      moduleIndex: hitModIdx,
                    },
                  })
                );
              }
              return;
            }

            // Single atomic Zustand update (instead of 3 sequential setState calls!)
            setWallFocusHighlight(false);
            selectModuleBayComponentSafe({
              activeModuleIndex: hitModIdx,
              ...(resolvedBayIdx >= 0 ? { activeBayIndex: resolvedBayIdx } : {}),
              selectedComponentId: resolvedCompId,
            });

            const safeBay = Math.max(0, resolvedBayIdx);

            // Doğrudan 3B donanıma (menteşe, kulp, çekmece rayı, askı borusu) tıklandığında hızlı değiştirme kartını aç
            const directHwGroup: "hinge" | "handle" | "drawer_slide" | "rail" | null =
              roleStr === "door_hinge"
                ? "hinge"
                : roleStr === "door_handle" || roleStr === "drawer_handle"
                ? "handle"
                : roleStr === "drawer_slide"
                ? "drawer_slide"
                : roleStr === "hanging_rail"
                ? "rail"
                : null;
            if (directHwGroup && typeof window !== "undefined") {
              window.dispatchEvent(
                new CustomEvent("birim:select-hardware-3d", {
                  detail: {
                    group: directHwGroup,
                    bayIndex: safeBay,
                    componentId: rawCompId,
                    moduleIndex: hitModIdx,
                  },
                })
              );
            }

            const isDoorHit =
              roleStr === "door" ||
              roleStr.startsWith("door_") ||
              rawCompId.includes("_door_") ||
              resolvedCompId.includes("door_");

            if (isDoorHit && !state.doorsHiddenIn3D) {
              if (!minimalChromeRef.current) {
                const leafSideLabel = resolvedCompId.includes("right") ? "Sağ Kapak" : "Sol Kapak";
                setDoorMenuSubSection(null);
                setClicked3DContext({
                  kind: "door",
                  bayIndex: safeBay,
                  role: roleStr,
                  componentId: resolvedCompId,
                  label: `Bölme ${safeBay + 1} • ${leafSideLabel}`,
                });
              }
              if (typeof window !== "undefined") {
                window.dispatchEvent(
                  new CustomEvent("birim:select-door-3d", {
                    detail: {
                      bayIndex: safeBay,
                      componentId: resolvedCompId,
                      moduleIndex: hitModIdx,
                    },
                  })
                );
              }
            } else {
              if (!minimalChromeRef.current) {
                setClicked3DContext({
                  kind: "bay",
                  bayIndex: safeBay,
                  role: roleStr,
                  label: `Bölme ${safeBay + 1}`,
                });
              }
              if (typeof window !== "undefined") {
                window.dispatchEvent(
                  new CustomEvent("birim:select-bay-3d", {
                    detail: { bayIndex: safeBay, role: roleStr, componentId: resolvedCompId, moduleIndex: hitModIdx },
                  })
                );
              }
            }
            return;
          }
        }
        // If user clicked directly on a 3D Wall (without hitting any cabinet in front), select it as activeWallId!
        if (roomArchGroupRef.current && paintTool3DRef.current.mode === "none") {
          const wallHits = raycaster.intersectObjects(roomArchGroupRef.current.children, true);
          for (const wh of wallHits) {
            if (wh.object?.userData?.isRoomWall && wh.object.userData.wallId) {
              const pickedWallId = String(wh.object.userData.wallId);
              const pickedWallName = String(wh.object.userData.wallName || "Duvar");
              const stWall = useConfiguratorStore.getState();
              if (!stWall.project.space.walls.some((w) => w.id === pickedWallId)) {
                const eff = getEffectiveSpaceWalls(stWall.project);
                if (eff.some((w) => w.id === pickedWallId)) {
                  stWall.applyBatchProjectUpdate((draft) => {
                    draft.space.walls = eff.map((ew) => ({ ...ew, position: { ...ew.position } }));
                  }, "Hedef duvar etkinleştirildi");
                }
              }
              state.setSelectedComponentId(null);
              setClicked3DContext(null);
              setWallFocusHighlight(true);
              useConfiguratorStore.getState().setActiveWallId(pickedWallId);
              setSnapBannerDedup(`✓ Hedef Duvar: ${pickedWallName} — Yeni modüller bu duvara yerleşir`);
              setTimeout(() => setSnapBannerDedup(null), 3200);
              if (typeof window !== "undefined") {
                window.dispatchEvent(
                  new CustomEvent("birim:wall-selected-3d", {
                    detail: { wallId: pickedWallId, wallName: pickedWallName },
                  })
                );
              }
              return;
            }
          }
        }
        state.setSelectedComponentId(null);
        setClicked3DContext(null);
        setWallFocusHighlight(false);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("birim:clear-3d-selection"));
        }
      };

      const handleContextMenu = (e: MouseEvent) => {
        e.preventDefault();
        if (rightDownPos && Math.hypot(e.clientX - rightDownPos.x, e.clientY - rightDownPos.y) > 6) {
          rightDownPos = null;
          return;
        }
        rightDownPos = null;
        const curRenderer = rendererRef.current;
        const curGroup = meshGroupRef.current;
        const curRoomGroup = roomArchGroupRef.current;
        const curControls = controlsRef.current;
        if (!curRenderer || !curGroup || !curControls) return;

        const rect = curRenderer.domElement.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        const curCam = (curControls.object as THREE.Camera) || perspCamRef.current;
        if (!curCam) return;

        raycaster.setFromCamera(pointer, curCam);
        const state = latestStateRef.current;
        const anyDoorsOpen =
          state.doorsHiddenIn3D ||
          state.doorOpenAngleDeg > 5 ||
          state.project.modules.some(
            (m) =>
              Boolean(m.isOpenFront) ||
              m.bays.some((b) => b.door.type === "open" || b.door.doorSystemId === "open")
          );
        const solidMeshes = getCachedSolidMeshes(curGroup, anyDoorsOpen);
        const hits = raycaster.intersectObjects(solidMeshes, false);

        if (hits.length > 0 && hits[0].object instanceof THREE.Mesh) {
          const hitMesh = hits[0].object;
          const clickedCompId = String(hitMesh.userData?.componentId || "");
          let modIdx = typeof hitMesh.userData?.moduleIndex === "number" ? hitMesh.userData.moduleIndex : -1;
          if (modIdx < 0) {
            modIdx = state.project.modules.findIndex((m) => clickedCompId.startsWith(m.id));
          }
          if (modIdx >= 0) {
            const mod = state.project.modules[modIdx];
            const bayIndex =
              typeof hitMesh.userData?.bayIndex === "number" ? hitMesh.userData.bayIndex : 0;
            const role = String(hitMesh.userData?.role || "");
            const label = String(hitMesh.userData?.label || mod?.name || "Parça");
            const dimsText = hitMesh.userData?.dimsText ? String(hitMesh.userData.dimsText) : undefined;
            const plinthH = mod?.carcass.plinthHeight ?? 0;
            const T = mod?.carcass.panelThickness || 18;
            const hitElevationY = Math.max(
              64,
              Math.round((hits[0].point.y - ((mod?.position.y || 0) + plinthH + T)) / 32) * 32
            );

            state.setActiveModuleIndex(modIdx);
            state.setActiveBayIndex(bayIndex);
            (state.setSelectedComponentId as (id: string | null, mIdx?: number) => void)(
              clickedCompId || null,
              modIdx
            );
            setContextMenuTarget({
              kind: "component",
              modIdx,
              bayIndex,
              componentId: clickedCompId,
              role,
              label,
              dimsText,
              hitElevationY,
              clientX: e.clientX,
              clientY: e.clientY,
            });
            return;
          }
        }

        if (curRoomGroup) {
          const roomHits = raycaster.intersectObjects(curRoomGroup.children, true);
          for (const rh of roomHits) {
            if (rh.object instanceof THREE.Line || rh.object instanceof THREE.LineSegments) continue;
            let cand: THREE.Object3D | null = rh.object;
            while (cand && !cand.userData?.obstacleId) {
              cand = cand.parent;
            }
            if (cand?.userData?.obstacleId) {
              const obsId = String(cand.userData.obstacleId);
              const obsObj = (state.spaceObstacles || []).find((o) => o.id === obsId);
              setContextMenuTarget({
                kind: "obstacle",
                obstacleId: obsId,
                label: obsObj?.name || obsObj?.type || "Mimari Engel",
                clientX: e.clientX,
                clientY: e.clientY,
              });
              return;
            }
            if (rh.object?.userData?.isRoomWall && rh.object.userData.wallId) {
              setContextMenuTarget({
                kind: "wall",
                wallId: String(rh.object.userData.wallId),
                wallName: String(rh.object.userData.wallName || "Duvar"),
                clientX: e.clientX,
                clientY: e.clientY,
              });
              return;
            }
          }
        }

        setContextMenuTarget({
          kind: "scene",
          clientX: e.clientX,
          clientY: e.clientY,
        });
      };

      const handlePointerCancelOrBlur = () => {
        if (dragMoveRafId) {
          window.cancelAnimationFrame(dragMoveRafId);
          dragMoveRafId = 0;
        }
        latestDragPointerEvent = null;
        delete document.body.dataset.birimUiDragging;
        if (activeDrag3D) {
          activeDrag3D = null;
          latestStateRef.current.commitHistoryTransaction();
        }
        if (controlsRef.current) {
          controlsRef.current.enabled = true;
        }
      };

      renderer.domElement.addEventListener("pointerdown", handlePointerDown, { capture: true });
      renderer.domElement.addEventListener("contextmenu", handleContextMenu, { capture: true });
      window.addEventListener("pointermove", handlePointerMove, { capture: true });
      window.addEventListener("pointerup", handlePointerUp, { capture: true });
      window.addEventListener("pointercancel", handlePointerCancelOrBlur, { capture: true });
      window.addEventListener("blur", handlePointerCancelOrBlur);

      const captureStudioSnapshot = (opts?: {
        angle?: "current" | "iso" | "front";
        hideOverlays?: boolean;
      }): string => {
        const curRenderer = rendererRef.current;
        const curScene = sceneRef.current;
        const curControls = controlsRef.current;
        const perspCam = perspCamRef.current;
        const curMeshGroup = meshGroupRef.current;
        if (!curRenderer || !curScene || !perspCam) return "";

        const prevSize = new THREE.Vector2();
        curRenderer.getSize(prevSize);
        const needsTempSize = prevSize.x < 64 || prevSize.y < 64 || container.clientWidth < 64;
        if (needsTempSize) {
          curRenderer.setSize(1280, 800, false);
          perspCam.aspect = 1280 / 800;
          perspCam.updateProjectionMatrix();
        }

        const overlayGroups = [
          dimGroupRef.current,
          selectionFrameGroupRef.current,
          activeModFrameGroupRef.current,
          ghostSnapGroupRef.current,
          hoverOverlayGroup,
        ];
        const prevVis = overlayGroups.map((g) => (g ? g.visible : false));
        if (opts?.hideOverlays !== false) {
          overlayGroups.forEach((g) => {
            if (g) g.visible = false;
          });
        }

        const savedCamPos = perspCam.position.clone();
        const savedCamQuat = perspCam.quaternion.clone();
        const useCustomAngle =
          opts?.angle === "iso" || opts?.angle === "front" || needsTempSize;
        let renderCam: THREE.Camera =
          (curControls?.object as THREE.Camera) || perspCam;

        if (useCustomAngle && curMeshGroup && curMeshGroup.children.length > 0) {
          curMeshGroup.updateMatrixWorld(true);
          const bounds = new THREE.Box3().setFromObject(curMeshGroup);
          if (!bounds.isEmpty()) {
            const framed = computeHeroStudioFraming(
              bounds,
              perspCam.fov,
              perspCam.aspect,
              opts?.angle === "front" ? "front" : "hero"
            );
            perspCam.position.copy(framed.position);
            perspCam.lookAt(framed.target);
            perspCam.updateProjectionMatrix();
            perspCam.updateMatrixWorld();
            renderCam = perspCam;
          }
        }

        if (curRenderer.shadowMap.enabled) {
          curRenderer.shadowMap.needsUpdate = true;
        }

        let dataUrl = "";
        try {
          curRenderer.render(curScene, renderCam);
          dataUrl = curRenderer.domElement.toDataURL("image/png");
        } catch {
          dataUrl = "";
        }

        if (useCustomAngle) {
          perspCam.position.copy(savedCamPos);
          perspCam.quaternion.copy(savedCamQuat);
          perspCam.updateProjectionMatrix();
          perspCam.updateMatrixWorld();
        }
        overlayGroups.forEach((g, idx) => {
          if (g) g.visible = prevVis[idx];
        });
        if (needsTempSize && prevSize.x >= 64 && prevSize.y >= 64) {
          curRenderer.setSize(prevSize.x, prevSize.y, false);
          perspCam.aspect = prevSize.x / prevSize.y;
          perspCam.updateProjectionMatrix();
        }
        needsRenderRef.current = true;
        return dataUrl;
      };

      /**
       * 16-Sample Progressive Area-Light Softbox + Halton Sub-Pixel Supersampled 2K Studio Renderer:
       * Jitters key & rim studio light positions across a physical softbox disk while jittering camera
       * sub-pixel frustum offsets, accumulating exact unweighted binary-tree averages for raytraced-grade
       * soft penumbra shadows and crisp beveled wood/lacquer edges.
       */
      const renderUltraStudioPhoto = async (opts?: {
        angle?: "current" | "iso" | "front";
        width?: number;
        height?: number;
        samples?: number;
        onProgress?: (pct: number) => void;
      }): Promise<string> => {
        const curRenderer = rendererRef.current;
        const curScene = sceneRef.current;
        const curControls = controlsRef.current;
        const perspCam = perspCamRef.current;
        const curMeshGroup = meshGroupRef.current;
        const kLight = keyLightRef.current;
        const rLight = rimLightRef.current;
        if (!curRenderer || !curScene || !perspCam) return "";

        const targetW = opts?.width || 2048;
        const targetH = opts?.height || 1280;
        const totalSamples = 16; // Exact 2^4 for lossless binary-tree 0.5 alpha accumulation

        const prevSize = new THREE.Vector2();
        curRenderer.getSize(prevSize);
        const prevPixelRatio = curRenderer.getPixelRatio();

        const overlayGroups = [
          dimGroupRef.current,
          selectionFrameGroupRef.current,
          activeModFrameGroupRef.current,
          ghostSnapGroupRef.current,
          hoverOverlayGroup,
        ];
        const prevVis = overlayGroups.map((g) => (g ? g.visible : false));
        overlayGroups.forEach((g) => {
          if (g) g.visible = false;
        });

        const prevGridVis = gridRef.current ? gridRef.current.visible : false;
        if (gridRef.current) gridRef.current.visible = false;

        const savedCamPos = perspCam.position.clone();
        const savedCamQuat = perspCam.quaternion.clone();
        const savedCamAspect = perspCam.aspect;
        const savedKeyPos = kLight ? kLight.position.clone() : null;
        const savedRimPos = rLight ? rLight.position.clone() : null;
        const savedShadowsEnabled = curRenderer.shadowMap.enabled;

        curRenderer.shadowMap.enabled = true;
        curRenderer.setPixelRatio(1);
        curRenderer.setSize(targetW, targetH, false);
        perspCam.aspect = targetW / targetH;
        perspCam.updateProjectionMatrix();

        if (
          (opts?.angle === "iso" || opts?.angle === "front") &&
          curMeshGroup &&
          curMeshGroup.children.length > 0
        ) {
          curMeshGroup.updateMatrixWorld(true);
          const bounds = new THREE.Box3().setFromObject(curMeshGroup);
          if (!bounds.isEmpty()) {
            const framed = computeHeroStudioFraming(
              bounds,
              perspCam.fov,
              perspCam.aspect,
              opts?.angle === "front" ? "front" : "hero"
            );
            perspCam.position.copy(framed.position);
            perspCam.lookAt(framed.target);
            perspCam.updateMatrixWorld();
          }
        } else if (curControls?.object && curControls.object !== perspCam) {
          perspCam.position.copy(curControls.object.position);
          perspCam.quaternion.copy(curControls.object.quaternion);
          perspCam.updateMatrixWorld();
        }

        const halton = (index: number, base: number): number => {
          let result = 0;
          let f = 1 / base;
          let i = index;
          while (i > 0) {
            result += f * (i % base);
            i = Math.floor(i / base);
            f /= base;
          }
          return result;
        };

        // 4-tier binary reduction buffers for exact unweighted 16-sample averaging at globalAlpha=0.5
        const tiers = [0, 1, 2, 3].map(() => {
          const c = document.createElement("canvas");
          c.width = targetW;
          c.height = targetH;
          return { canvas: c, ctx: c.getContext("2d")! };
        });

        const softboxRadiusMm = 310;
        const goldenAngle = Math.PI * (3 - Math.sqrt(5));

        try {
          for (let s = 0; s < totalSamples; s++) {
            // Sub-pixel Halton camera jitter [-0.5 .. +0.5] px
            const jx = s === 0 ? 0 : halton(s + 1, 2) - 0.5;
            const jy = s === 0 ? 0 : halton(s + 1, 3) - 0.5;
            perspCam.setViewOffset(targetW, targetH, jx, jy, targetW, targetH);

            // Vogel disk softbox area-light sampling for silky natural penumbra shadows
            if (kLight && savedKeyPos) {
              const rFrac = Math.sqrt((s + 0.5) / totalSamples);
              const theta = s * goldenAngle;
              const ox = Math.cos(theta) * rFrac * softboxRadiusMm;
              const oz = Math.sin(theta) * rFrac * softboxRadiusMm;
              const oy = Math.sin(theta * 1.7) * rFrac * (softboxRadiusMm * 0.55);
              kLight.position.set(
                savedKeyPos.x + ox,
                savedKeyPos.y + oy,
                savedKeyPos.z + oz
              );
              curRenderer.shadowMap.needsUpdate = true;
            }
            if (rLight && savedRimPos) {
              const theta = s * goldenAngle + 1.2;
              rLight.position.set(
                savedRimPos.x + Math.cos(theta) * 140,
                savedRimPos.y + Math.sin(theta) * 90,
                savedRimPos.z
              );
            }

            curRenderer.render(curScene, perspCam);

            // Binary-tree 0.5 alpha blend reduction
            tiers[0].ctx.globalAlpha = s % 2 === 0 ? 1.0 : 0.5;
            tiers[0].ctx.drawImage(curRenderer.domElement, 0, 0);
            if (s % 2 === 1) {
              const p1 = s >> 1;
              tiers[1].ctx.globalAlpha = p1 % 2 === 0 ? 1.0 : 0.5;
              tiers[1].ctx.drawImage(tiers[0].canvas, 0, 0);
              if (p1 % 2 === 1) {
                const p2 = s >> 2;
                tiers[2].ctx.globalAlpha = p2 % 2 === 0 ? 1.0 : 0.5;
                tiers[2].ctx.drawImage(tiers[1].canvas, 0, 0);
                if (p2 % 2 === 1) {
                  const p3 = s >> 3;
                  tiers[3].ctx.globalAlpha = p3 % 2 === 0 ? 1.0 : 0.5;
                  tiers[3].ctx.drawImage(tiers[2].canvas, 0, 0);
                }
              }
            }

            const pct = Math.round(((s + 1) / totalSamples) * 100);
            if (opts?.onProgress) opts.onProgress(pct);
            if (s % 2 === 1 && s < totalSamples - 1) {
              await new Promise<void>((r) => requestAnimationFrame(() => r()));
            }
          }

          // Subtle architectural lens vignette for gallery realism
          const finalCtx = tiers[3].ctx;
          finalCtx.globalAlpha = 1.0;
          const vig = finalCtx.createRadialGradient(
            targetW * 0.5,
            targetH * 0.48,
            Math.min(targetW, targetH) * 0.36,
            targetW * 0.5,
            targetH * 0.5,
            Math.max(targetW, targetH) * 0.74
          );
          vig.addColorStop(0, "rgba(20, 20, 19, 0)");
          vig.addColorStop(1, "rgba(20, 20, 19, 0.11)");
          finalCtx.fillStyle = vig;
          finalCtx.fillRect(0, 0, targetW, targetH);

          return tiers[3].canvas.toDataURL("image/png");
        } catch {
          return "";
        } finally {
          perspCam.clearViewOffset();
          perspCam.position.copy(savedCamPos);
          perspCam.quaternion.copy(savedCamQuat);
          perspCam.aspect = savedCamAspect;
          perspCam.updateProjectionMatrix();
          perspCam.updateMatrixWorld();

          if (kLight && savedKeyPos) kLight.position.copy(savedKeyPos);
          if (rLight && savedRimPos) rLight.position.copy(savedRimPos);
          curRenderer.shadowMap.enabled = savedShadowsEnabled;
          curRenderer.shadowMap.needsUpdate = true;

          if (prevSize.x >= 64 && prevSize.y >= 64) {
            curRenderer.setPixelRatio(prevPixelRatio);
            curRenderer.setSize(prevSize.x, prevSize.y, false);
          }
          if (gridRef.current) gridRef.current.visible = prevGridVis;
          overlayGroups.forEach((g, idx) => {
            if (g) g.visible = prevVis[idx];
          });
          needsRenderRef.current = true;
        }
      };

      const renderPathTracedPhoto = async (opts?: {
        samples?: number;
        bounces?: number;
        softboxSizeMm?: number;
        width?: number;
        height?: number;
        angle?: "current" | "iso" | "front";
        onProgress?: (pct: number, currentPreviewUrl?: string) => void;
        shouldCancel?: () => boolean;
      }): Promise<{
        dataUrl: string;
        elapsedMs: number;
        samplesCompleted: number;
        metrics: { drawCalls: number; triangles: number; geometries: number; textures: number };
        engine?: string;
        device?: string;
        error?: string;
      }> => {
        const tStart = performance.now();
        const curRenderer = rendererRef.current;
        const curScene = sceneRef.current;
        const perspCam = perspCamRef.current;
        const curControls = controlsRef.current;
        const curGroup = meshGroupRef.current;
        const emptyMetrics = { drawCalls: 0, triangles: 0, geometries: 0, textures: 0 };

        if (!curRenderer || !curScene || !perspCam || !curControls || !curGroup) {
          return { dataUrl: "", elapsedMs: 0, samplesCompleted: 0, metrics: emptyMetrics, error: "3D sahne hazir degil." };
        }

        const totalSamples = Math.max(8, Math.min(256, opts?.samples ?? 48));
        const targetW = Math.max(640, Math.min(3840, opts?.width ?? 1920));
        const targetH = Math.max(400, Math.min(2160, opts?.height ?? 1080));
        const bounces = Math.max(2, Math.min(10, opts?.bounces ?? 5));

        const camPos = perspCam.position.clone();
        const camTarget = curControls.target.clone();
        if (curControls.object && curControls.object !== perspCam) {
          camPos.copy(curControls.object.position);
        }

        if (opts?.angle && opts.angle !== "current" && curGroup.children.length > 0) {
          curGroup.updateMatrixWorld(true);
          const bounds = new THREE.Box3().setFromObject(curGroup);
          if (!bounds.isEmpty()) {
            const framed = computeHeroStudioFraming(
              bounds,
              perspCam.fov,
              targetW / targetH,
              opts.angle === "front" ? "front" : "hero"
            );
            camPos.copy(framed.position);
            camTarget.copy(framed.target);
          }
        }

        const roots: THREE.Object3D[] = [curGroup];
        if (sceneObjectsGroupRef.current && sceneObjectsGroupRef.current.children.length > 0) {
          roots.push(sceneObjectsGroupRef.current);
        }
        if (roomArchGroupRef.current && roomArchGroupRef.current.children.length > 0) {
          roots.push(roomArchGroupRef.current);
        }

        const metrics = {
          drawCalls: curRenderer.info.render.calls,
          triangles: curRenderer.info.render.triangles,
          geometries: curRenderer.info.memory.geometries,
          textures: curRenderer.info.memory.textures,
        };

        const isDarkBg =
          curScene.background instanceof THREE.Color
            ? curScene.background.getHSL({ h: 0, s: 0, l: 0 }).l < 0.35
            : false;

        try {
          const result = await renderSceneWithBlenderCycles({
            roots,
            cameraPosition: camPos,
            cameraTarget: camTarget,
            cameraFov: perspCam.fov,
            width: targetW,
            height: targetH,
            samples: totalSamples,
            bounces,
            isDark: isDarkBg,
            onProgress: (pct) => opts?.onProgress?.(pct),
            shouldCancel: opts?.shouldCancel,
          });

          return {
            dataUrl: result.dataUrl,
            elapsedMs: result.elapsedMs,
            samplesCompleted: totalSamples,
            metrics,
            engine: result.engine,
            device: result.device,
          };
        } catch (err) {
          return {
            dataUrl: "",
            elapsedMs: Math.round(performance.now() - tStart),
            samplesCompleted: 0,
            metrics,
            error: err instanceof Error ? err.message : "Blender Cycles render hatasi",
          };
        }
      };

      const getLiveSceneStats = () => {
        const curR = rendererRef.current;
        if (!curR) return null;
        return {
          drawCalls: curR.info.render.calls,
          triangles: curR.info.render.triangles,
          geometries: curR.info.memory.geometries,
          textures: curR.info.memory.textures,
          lastFrameMs: 4.2,
        };
      };

      const winHooks = window as unknown as {
        __birimCapture3DSnapshot?: typeof captureStudioSnapshot;
        __birimRenderUltraStudioPhoto?: typeof renderUltraStudioPhoto;
        __birimRenderPathTracedPhoto?: typeof renderPathTracedPhoto;
        __birimGetLiveSceneStats?: typeof getLiveSceneStats;
      };
      winHooks.__birimCapture3DSnapshot = captureStudioSnapshot;
      winHooks.__birimRenderUltraStudioPhoto = renderUltraStudioPhoto;
      winHooks.__birimRenderPathTracedPhoto = renderPathTracedPhoto;
      winHooks.__birimGetLiveSceneStats = getLiveSceneStats;

      let animId: number;
      let lastDimSyncMs = 0;

      const animate = () => {
        animId = requestAnimationFrame(animate);
        if (pausedRef.current) return;
        const curControls = controlsRef.current;
        const curRenderer = rendererRef.current;
        const curScene = sceneRef.current;
        if (!curControls || !curRenderer || !curScene) return;

        let isFlying = false;
        const flight = cameraFlightRef.current;
        if (flight && perspCamRef.current) {
          const nowMs = performance.now();
          const rawT = Math.min(1, Math.max(0, (nowMs - flight.startTime) / Math.max(1, flight.durationMs)));
          const ease = rawT < 0.5 ? 4 * rawT * rawT * rawT : 1 - Math.pow(-2 * rawT + 2, 3) / 2;
          perspCamRef.current.position.lerpVectors(flight.startPos, flight.endPos, ease);
          curControls.target.lerpVectors(flight.startTarget, flight.endTarget, ease);
          perspCamRef.current.lookAt(curControls.target);
          isFlying = true;
          needsRenderRef.current = true;
          if (rawT >= 1) {
            cameraFlightRef.current = null;
            if (curRenderer.shadowMap.enabled) {
              curRenderer.shadowMap.needsUpdate = true;
            }
          }
        }
        const updated = curControls.update();
        if (needsRenderRef.current || updated || isFlying) {
          const t0 = performance.now();
          const cam = (curControls.object as THREE.Camera) || perspCamRef.current;
          if (cam) {
            // Guarantee 0-frame lock between every cabinet module in meshGroup and its belongings in interiorPropsGroup
            const mGrp = meshGroupRef.current;
            const pGrp = interiorPropsGroupRef.current;
            if (mGrp && pGrp && pGrp.visible && pGrp.children.length > 0) {
              for (let pi = 0; pi < pGrp.children.length; pi++) {
                const ph = pGrp.children[pi];
                const phModId = ph.userData?.moduleId;
                const phModIdx = ph.userData?.moduleIndex;
                let liveMod: THREE.Object3D | undefined;
                for (let mi = 0; mi < mGrp.children.length; mi++) {
                  const cand = mGrp.children[mi];
                  if (
                    (phModId && cand.userData?.moduleId === phModId) ||
                    (typeof phModIdx === "number" && cand.userData?.moduleIndex === phModIdx)
                  ) {
                    liveMod = cand;
                    break;
                  }
                }
                if (
                  liveMod &&
                  (Math.abs(ph.position.x - liveMod.position.x) > 0.05 ||
                    Math.abs(ph.position.y - liveMod.position.y) > 0.05 ||
                    Math.abs(ph.position.z - liveMod.position.z) > 0.05 ||
                    Math.abs(ph.rotation.y - liveMod.rotation.y) > 0.0005)
                ) {
                  ph.position.copy(liveMod.position);
                  ph.rotation.copy(liveMod.rotation);
                  ph.updateMatrix();
                  ph.updateMatrixWorld(true);
                }
              }
            }
            if (roomArchGroupRef.current && cam) {
              const cp = cam.position;
              for (const ch of roomArchGroupRef.current.children) {
                if (ch.userData?.isRoomWallGroup && ch.userData.inwardNormal && ch.userData.wallMid) {
                  const wn = ch.userData.inwardNormal;
                  const wm = ch.userData.wallMid;
                  const camSideDot = (cp.x - wm.x) * wn.x + (cp.z - wm.z) * wn.z;
                  ch.visible = camSideDot >= -150;
                } else if (ch instanceof THREE.Mesh && ch.position.z < 10 && ch.geometry instanceof THREE.PlaneGeometry) {
                  ch.visible = cp.z >= -100;
                }
              }
            }
            curRenderer.render(curScene, cam);
            if (!isOrbitingRef.current || t0 - lastDimSyncMs >= 24) {
              lastDimSyncMs = t0;
              updateProjectedDimensionLabels();
            }
          }
          const dt = performance.now() - t0;
          if (new URLSearchParams(window.location.search).has("audit"))
            curRenderer.domElement.dataset.performance = JSON.stringify({
              renderCpuMs: dt,
              drawCalls: curRenderer.info.render.calls,
              triangles: curRenderer.info.render.triangles,
              geometries: curRenderer.info.memory.geometries,
              textures: curRenderer.info.memory.textures,
            });
          if (onPerformanceSample) onPerformanceSample({ lastRenderMs: dt });
          needsRenderRef.current = false;
        }
      };
      animate();

      const resizeObserver = new ResizeObserver(() => {
        const curRenderer = rendererRef.current;
        if (!container || !curRenderer) return;
        const w = container.clientWidth;
        const h = container.clientHeight;
        if (w === 0 || h === 0) return;

        if (perspCamRef.current) {
          perspCamRef.current.aspect = w / h;
          perspCamRef.current.updateProjectionMatrix();
        }
        if (orthoCamRef.current) {
          const asp = w / h;
          const d = 1800;
          orthoCamRef.current.left = -d * asp;
          orthoCamRef.current.right = d * asp;
          orthoCamRef.current.top = d;
          orthoCamRef.current.bottom = -d;
          orthoCamRef.current.updateProjectionMatrix();
        }
        curRenderer.setSize(w, h);
        canvasRectRef.current = curRenderer.domElement.getBoundingClientRect();
        const cam = (controlsRef.current?.object as THREE.Camera) || perspCamRef.current;
        if (cam && sceneRef.current) {
          curRenderer.render(sceneRef.current, cam);
          updateProjectedDimensionLabels();
        }
        needsRenderRef.current = true;
      });
      resizeObserver.observe(container);

      return () => {
        delete (window as unknown as { __birimRenderUltraStudioPhoto?: unknown }).__birimRenderUltraStudioPhoto;
        if (settleSharpTimer) clearTimeout(settleSharpTimer);
        cancelAnimationFrame(animId);
        resizeObserver.disconnect();
        window.removeEventListener("birim:set-render-quality", onRenderQualityChange);
        detachContextRecovery();
        delete (window as unknown as { __birimCapture3DSnapshot?: unknown }).__birimCapture3DSnapshot;
        renderer.domElement.removeEventListener("pointerdown", handlePointerDown, { capture: true });
        renderer.domElement.removeEventListener("contextmenu", handleContextMenu, { capture: true });
        window.removeEventListener("pointermove", handlePointerMove, { capture: true });
        window.removeEventListener("pointerup", handlePointerUp, { capture: true });
        window.removeEventListener("pointercancel", handlePointerCancelOrBlur, { capture: true });
        window.removeEventListener("blur", handlePointerCancelOrBlur);
        controls.dispose();
        disposeObject3DTree(scene);
        scene.clear();
        disposeRendererPmremEnvironment(renderer);
        disposeSharedHardwarePool();
        disposeWebGLRendererCleanly(renderer);
        if (container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [webglRetryKey]);

    // Update Theme, Lighting Atmosphere Preset & CAD Shadow Fast-Path
    useEffect(() => {
      if (sceneRef.current) {
        const bgHex =
          renderEdgeMode === "cad"
            ? 0xf8fafc
            : lightingPreset === "night_led"
            ? 0x11151d
            : lightingPreset === "showroom_warm"
            ? 0x201f25
            : 0x1d222b;
        sceneRef.current.background = new THREE.Color(bgHex);
        sceneRef.current.fog =
          renderEdgeMode === "cad" ? null : new THREE.FogExp2(bgHex, 0.000032);
        sceneRef.current.environment =
          renderEdgeMode === "cad" || !rendererRef.current
            ? null
            : getStudioPmremEnvironment(rendererRef.current);
      }
      if (roomArchGroupRef.current) {
        roomArchGroupRef.current.visible = showRoomArchitecture3D && renderEdgeMode !== "cad";
      }
      if (rendererRef.current) {
        const enableShadows = renderEdgeMode !== "cad";
        if (rendererRef.current.shadowMap.enabled !== enableShadows) {
          rendererRef.current.shadowMap.enabled = enableShadows;
        }
      }
      if (hemiLightRef.current && keyLightRef.current && rimLightRef.current && rendererRef.current) {
        keyLightRef.current.castShadow = renderEdgeMode !== "cad";
        const sceneWithEnv = sceneRef.current as (THREE.Scene & { environmentIntensity?: number }) | null;
        if (lightingPreset === "night_led") {
          if (sceneWithEnv) sceneWithEnv.environmentIntensity = 0.10;
          hemiLightRef.current.color.setHex(0x3b4d6b);
          hemiLightRef.current.groundColor.setHex(0x07090e);
          hemiLightRef.current.intensity = 0.08;
          keyLightRef.current.color.setHex(0x93c5fd);
          keyLightRef.current.intensity = 0.32;
          rimLightRef.current.color.setHex(0x38bdf8);
          rimLightRef.current.intensity = 0.55;
          if (gallerySpotLightRef.current) {
            gallerySpotLightRef.current.color.setHex(0xffc985);
            gallerySpotLightRef.current.intensity = 1.25;
          }
          rendererRef.current.toneMappingExposure = 1.02;
        } else if (lightingPreset === "showroom_warm") {
          if (sceneWithEnv) sceneWithEnv.environmentIntensity = 0.28;
          hemiLightRef.current.color.setHex(0xffdfa8);
          hemiLightRef.current.groundColor.setHex(0x1e1610);
          hemiLightRef.current.intensity = 0.14;
          keyLightRef.current.color.setHex(0xffd296);
          keyLightRef.current.intensity = 2.45;
          rimLightRef.current.color.setHex(0x7dd3fc);
          rimLightRef.current.intensity = 0.72;
          if (gallerySpotLightRef.current) {
            gallerySpotLightRef.current.color.setHex(0xffbe6b);
            gallerySpotLightRef.current.intensity = 5.4;
          }
          rendererRef.current.toneMappingExposure = 1.00;
        } else {
          if (sceneWithEnv) sceneWithEnv.environmentIntensity = 0.42;
          hemiLightRef.current.color.setHex(0xd8e8ff);
          hemiLightRef.current.groundColor.setHex(0x1b1917);
          hemiLightRef.current.intensity = 0.16;
          keyLightRef.current.color.setHex(0xfff4e4);
          keyLightRef.current.intensity = 2.65;
          rimLightRef.current.color.setHex(0x93c5fd);
          rimLightRef.current.intensity = 0.92;
          if (gallerySpotLightRef.current) {
            gallerySpotLightRef.current.color.setHex(0xfff1dc);
            gallerySpotLightRef.current.intensity = 3.4;
          }
          rendererRef.current.toneMappingExposure = 1.02;
        }
      }
      if (gridRef.current) {
        gridRef.current.visible =
          renderEdgeMode === "cad" || (showGrid && floorStyle === "studio");
      }
      markShadowsAndRender();
    }, [theme, showGrid, lightingPreset, wallTone, floorStyle, renderEdgeMode, showRoomArchitecture3D, markShadowsAndRender]);

    // Camera Projection Mode
    useEffect(() => {
      const controls = controlsRef.current;
      const perspCam = perspCamRef.current;
      const orthoCam = orthoCamRef.current;
      if (!controls || !perspCam || !orthoCam) return;

      if (isOrthographic) {
        const offset = new THREE.Vector3().subVectors(perspCam.position, controls.target);
        const dist = offset.length();
        const fovRad = (perspCam.fov * Math.PI) / 180;
        const visibleHeight = 2 * dist * Math.tan(fovRad / 2);
        if (visibleHeight > 0) orthoCam.zoom = 3600 / visibleHeight;
        orthoCam.position.copy(perspCam.position);
        orthoCam.quaternion.copy(perspCam.quaternion);
        orthoCam.updateProjectionMatrix();
        controls.object = orthoCam;
      } else {
        const dir = new THREE.Vector3().subVectors(orthoCam.position, controls.target).normalize();
        if (dir.lengthSq() < 0.001) dir.set(0, 0, 1);
        const fovRad = (perspCam.fov * Math.PI) / 180;
        const visibleHeight = 3600 / Math.max(0.01, orthoCam.zoom);
        const dist = visibleHeight / (2 * Math.tan(fovRad / 2));
        perspCam.position.copy(controls.target).addScaledVector(dir, dist);
        perspCam.quaternion.copy(orthoCam.quaternion);
        perspCam.updateProjectionMatrix();
        controls.object = perspCam;
      }
      controls.update();
      requestRender();
    }, [isOrthographic, requestRender]);

    // Camera Preset Transitions (triggered ONLY when cameraPreset changes — never on module selection or property edits)
    useEffect(() => {
      const controls = controlsRef.current;
      const perspCam = perspCamRef.current;
      const orthoCam = orthoCamRef.current;
      const { project: curProj, activeModuleIndex: curModIdx } = latestStateRef.current;
      const activeMod = curProj.modules[curModIdx] || curProj.modules[0];
      if (!controls || !perspCam || !orthoCam || !activeMod) return;

      const mainMods = curProj.modules.filter((m) => m.category !== "complementary");
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
      (mainMods.length > 0 ? mainMods : [activeMod]).forEach((m, idx) => {
        const mFp = getModuleOrientedFootprint(m, idx);
        minX = Math.min(minX, mFp.x);
        maxX = Math.max(maxX, mFp.x + mFp.planWidth);
        minY = Math.min(minY, mFp.yBottom);
        maxY = Math.max(maxY, mFp.yBottom + mFp.rawHeight);
        minZ = Math.min(minZ, mFp.z);
        maxZ = Math.max(maxZ, mFp.z + mFp.planDepth);
      });
      const roomCeilH = curProj.space?.ceilingHeight || 2800;
      const mainWallLen = curProj.space?.walls?.[0]?.length || 3600;
      const sceneBox = new THREE.Box3(
        new THREE.Vector3(Math.min(minX, 0), Math.min(minY, 0), minZ),
        new THREE.Vector3(Math.max(maxX, Math.min(mainWallLen, maxX + 450)), Math.max(maxY, roomCeilH), maxZ)
      );
      const framed = computeHeroStudioFraming(
        sceneBox,
        perspCam.fov,
        perspCam.aspect,
        cameraPreset === "front" ? "front" : "hero"
      );
      const cx = framed.target.x;
      const cy = framed.target.y;
      const cz = framed.target.z;
      controls.target.set(cx, cy, cz);

      const targetPos = new THREE.Vector3();
      if (cameraPreset === "front") {
        targetPos.copy(framed.position);
      } else if (cameraPreset === "side") {
        targetPos.set(cx - framed.dist * 0.92, cy, cz + 120);
      } else if (cameraPreset === "top") {
        targetPos.set(cx, cy + framed.dist * 1.05, cz + 1);
      } else {
        targetPos.copy(framed.position);
      }

      perspCam.position.copy(targetPos);
      perspCam.lookAt(cx, cy, cz);
      perspCam.updateProjectionMatrix();

      orthoCam.position.copy(targetPos);
      orthoCam.lookAt(cx, cy, cz);
      controls.update();
      requestRender();
    }, [cameraPreset, requestRender]);

    // 2-Directional Interactive 3D Section Clipping Plane (X Boyuna Kesit & Z Enine Kesit) + Solid MDF Section Caps
    useEffect(() => {
      const curRenderer = rendererRef.current;
      const curScene = sceneRef.current;
      const curMeshGroup = meshGroupRef.current;
      if (!curRenderer) return;

      // Clean up any previous section cap group
      if (sectionCapGroupRef.current) {
        if (curScene) curScene.remove(sectionCapGroupRef.current);
        sectionCapGroupRef.current.clear();
        sectionCapGroupRef.current = null;
      }

      // Hide fake dark fuga shadow backing plates while 3D section cut is active so doors/drawers show clean pure panels
      if (curMeshGroup) {
        traverseCabinetObjectsOnly(curMeshGroup, (obj) => {
          if (obj.userData?.isFugaBacking) {
            obj.visible = !section3DAxis;
          }
        });
      }

      if (!section3DAxis) {
        curRenderer.localClippingEnabled = false;
        curRenderer.clippingPlanes = [];
        requestRender();
        return;
      }
      const mod = project.modules[activeModuleIndex] || project.modules[0];
      if (!mod) return;
      curRenderer.localClippingEnabled = true;
      let cutVal = 0;
      if (section3DAxis === "X") {
        cutVal = mod.position.x + Math.round(mod.dimensions.width * section3DRatio);
        curRenderer.clippingPlanes = [new THREE.Plane(new THREE.Vector3(-1, 0, 0), cutVal)];
      } else {
        cutVal = mod.position.z + Math.round(mod.dimensions.depth * section3DRatio);
        curRenderer.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, 0, -1), cutVal)];
      }

      // Generate solid MDF / metal / LED section-cut caps AFTER main scene effect rebuilds meshes
      let rafCapId = 0;
      const buildSectionCaps = () => {
        if (sectionCapGroupRef.current) {
          if (curScene) curScene.remove(sectionCapGroupRef.current);
          sectionCapGroupRef.current.clear();
          sectionCapGroupRef.current = null;
        }
        if (!curScene || !curMeshGroup) return;

        const capGroup = new THREE.Group();
        capGroup.name = "birim_3d_section_caps";
        const unitPlaneGeo = new THREE.PlaneGeometry(1, 1);
        const unitEdgeGeo = new THREE.EdgesGeometry(unitPlaneGeo);
        const mdfCoreMat = new THREE.MeshStandardMaterial({
          color: 0xc29e70, // Natural raw MDF / particleboard core tone
          roughness: 0.92,
          metalness: 0.02,
          side: THREE.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        });
        const innerBoxCoreMat = new THREE.MeshStandardMaterial({
          color: 0xb38b5c, // Slightly deeper core tone for inner drawer sub-front so 18mm klapa vs 16mm inner sub-front reads crisply in section
          roughness: 0.92,
          metalness: 0.02,
          side: THREE.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        });
        const dadoBoardCoreMat = new THREE.MeshStandardMaterial({
          color: 0x9c7446, // Distinct deeper core tone so 8mm grooved back panel & drawer bottom dado slots stand out unmistakably inside 18mm panels
          roughness: 0.9,
          metalness: 0.02,
          side: THREE.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
        });
        const metalCoreMat = new THREE.MeshStandardMaterial({
          color: 0x475569,
          roughness: 0.38,
          metalness: 0.68,
          side: THREE.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        });
        const ledCoreMat = new THREE.MeshBasicMaterial({
          color: 0xfff1c4,
          side: THREE.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: -3,
          polygonOffsetUnits: -3,
        });
        const capOutlineMat = new THREE.LineBasicMaterial({
          color: 0x2d1f10,
          transparent: true,
          opacity: 0.88,
          polygonOffset: true,
          polygonOffsetFactor: -3,
          polygonOffsetUnits: -3,
        });

        const tmpBox = new THREE.Box3();
        curMeshGroup.updateMatrixWorld(true);

        traverseCabinetObjectsOnly(curMeshGroup, (obj) => {
          if (obj.userData?.isFugaBacking) {
            obj.visible = false;
            return;
          }
          if (!(obj instanceof THREE.Mesh) || !obj.visible) return;
          if (!obj.userData?.componentId) return;
          if (obj.userData.isSelectionHelper || obj.userData.isInteriorAo) return;
          const role = String(obj.userData.role || "");
          if (role === "door_hinge" || role === "led_strip") return;

          tmpBox.setFromObject(obj);
          if (tmpBox.isEmpty()) return;

          const compIdStr = String(obj.userData.componentId || "");
          const isLedCap =
            String(obj.userData.matDef?.id || "").startsWith("mat_led_") ||
            compIdStr.includes("_recessed_led_");
          const isWoodGolaBoxCap =
            role === "gola_profile" &&
            (compIdStr.includes("gola_moulded_box") ||
              compIdStr.includes("gola_melamine_box") ||
              compIdStr.includes("gola_bevel_backing"));
          const isMetal =
            !isLedCap &&
            !isWoodGolaBoxCap &&
            (role === "hanging_rail" ||
              role === "drawer_slide" ||
              role === "gola_profile" ||
              role === "door_handle" ||
              role === "drawer_handle" ||
              role === "special_fitting" ||
              String(obj.userData.matDef?.id || "").includes("metal"));
          const isDadoBoard = role === "drawer_bottom" || role === "carcass_back";
          const isInnerDrawerBox = role === "drawer_box" || isWoodGolaBoxCap;
          const capMat = isLedCap
            ? ledCoreMat
            : isMetal
            ? metalCoreMat
            : isDadoBoard
            ? dadoBoardCoreMat
            : isInnerDrawerBox
            ? innerBoxCoreMat
            : mdfCoreMat;
          const planeBias = isLedCap ? 0.12 : isDadoBoard ? 0.17 : 0.25;

          if (section3DAxis === "X") {
            if (tmpBox.min.x < cutVal - 0.3 && tmpBox.max.x > cutVal + 0.3) {
              const capD = tmpBox.max.z - tmpBox.min.z;
              const capH = tmpBox.max.y - tmpBox.min.y;
              if (capD >= 2 && capH >= 2) {
                const bevelEdge = obj.userData?.bevelPullEdge as "top" | "bottom" | undefined;
                const isJPullCap = obj.userData?.crossSectionProfile === "j_pull_bevel";
                if (isJPullCap && capH >= 60 && capD >= 12) {
                  const xCap = cutVal - planeBias;
                  const jEdge: "top" | "bottom" = obj.userData?.jPullEdge === "bottom" ? "bottom" : "top";
                  const worldFrontDir = new THREE.Vector3(0, 0, 1).transformDirection(obj.matrixWorld);
                  const zFlip = worldFrontDir.z >= 0 ? 1 : -1;
                  const midY = (tmpBox.min.y + tmpBox.max.y) * 0.5;
                  const midZ = (tmpBox.min.z + tmpBox.max.z) * 0.5;
                  const yzLoop = buildJPullCrossSectionLoop(capH, capD, jEdge);
                  const contour2D = yzLoop.map(([py, pz]) => new THREE.Vector2(py, pz));
                  const faces = THREE.ShapeUtils.triangulateShape(contour2D, []);
                  const triPositions: number[] = [];
                  for (const [ia, ib, ic] of faces) {
                    const [ya, za] = yzLoop[ia];
                    const [yb, zb] = yzLoop[ib];
                    const [yc, zc] = yzLoop[ic];
                    triPositions.push(
                      xCap, midY + ya, midZ + za * zFlip,
                      xCap, midY + yb, midZ + zb * zFlip,
                      xCap, midY + yc, midZ + zc * zFlip
                    );
                  }
                  const jpCapGeo = new THREE.BufferGeometry();
                  jpCapGeo.setAttribute("position", new THREE.Float32BufferAttribute(triPositions, 3));
                  jpCapGeo.computeVertexNormals();
                  const cap = new THREE.Mesh(jpCapGeo, capMat);
                  cap.raycast = () => {};
                  if (!isLedCap) {
                    const xLine = xCap + 0.04;
                    const linePositions: number[] = [];
                    for (let i = 0; i < yzLoop.length; i++) {
                      const [y0, z0] = yzLoop[i];
                      const [y1, z1] = yzLoop[(i + 1) % yzLoop.length];
                      linePositions.push(
                        xLine, midY + y0, midZ + z0 * zFlip,
                        xLine, midY + y1, midZ + z1 * zFlip
                      );
                    }
                    const jpOutlineGeo = new THREE.BufferGeometry();
                    jpOutlineGeo.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3));
                    cap.add(new THREE.LineSegments(jpOutlineGeo, capOutlineMat));
                  }
                  capGroup.add(cap);
                } else if (bevelEdge === "top" || bevelEdge === "bottom") {
                  const xCap = cutVal - planeBias;
                  const worldFrontDir = new THREE.Vector3(0, 0, 1).transformDirection(obj.matrixWorld);
                  const zFront = worldFrontDir.z >= 0 ? tmpBox.max.z : tmpBox.min.z;
                  const zBack = worldFrontDir.z >= 0 ? tmpBox.min.z : tmpBox.max.z;
                  const drop = Math.min(capH * 0.45, Number(obj.userData?.bevelDropMm) || capD);
                  const y0 = tmpBox.min.y;
                  const y1 = tmpBox.max.y;
                  const yBackBot = bevelEdge === "bottom" ? y0 + drop : y0;
                  const yBackTop = bevelEdge === "top" ? y1 - drop : y1;
                  const p0: [number, number, number] = [xCap, y0, zFront];
                  const p1: [number, number, number] = [xCap, y1, zFront];
                  const p2: [number, number, number] = [xCap, yBackTop, zBack];
                  const p3: [number, number, number] = [xCap, yBackBot, zBack];
                  const trapGeo = new THREE.BufferGeometry();
                  trapGeo.setAttribute(
                    "position",
                    new THREE.Float32BufferAttribute([...p0, ...p1, ...p2, ...p0, ...p2, ...p3], 3)
                  );
                  trapGeo.computeVertexNormals();
                  const cap = new THREE.Mesh(trapGeo, capMat);
                  cap.raycast = () => {};
                  if (!isLedCap) {
                    const xLine = xCap + 0.04;
                    const l0: [number, number, number] = [xLine, y0, zFront];
                    const l1: [number, number, number] = [xLine, y1, zFront];
                    const l2: [number, number, number] = [xLine, yBackTop, zBack];
                    const l3: [number, number, number] = [xLine, yBackBot, zBack];
                    const trapOutlineGeo = new THREE.BufferGeometry();
                    trapOutlineGeo.setAttribute(
                      "position",
                      new THREE.Float32BufferAttribute(
                        [...l0, ...l1, ...l1, ...l2, ...l2, ...l3, ...l3, ...l0],
                        3
                      )
                    );
                    cap.add(new THREE.LineSegments(trapOutlineGeo, capOutlineMat));
                  }
                  capGroup.add(cap);
                } else {
                  const cap = new THREE.Mesh(unitPlaneGeo, capMat);
                  cap.scale.set(capD, capH, 1);
                  cap.rotation.y = Math.PI / 2;
                  cap.position.set(
                    cutVal - planeBias,
                    (tmpBox.min.y + tmpBox.max.y) * 0.5,
                    (tmpBox.min.z + tmpBox.max.z) * 0.5
                  );
                  cap.raycast = () => {};
                  if (!isLedCap) {
                    const outline = new THREE.LineSegments(unitEdgeGeo, capOutlineMat);
                    outline.position.z = 0.04;
                    cap.add(outline);
                  }
                  capGroup.add(cap);
                }
              }
            }
          } else {
            if (tmpBox.min.z < cutVal - 0.3 && tmpBox.max.z > cutVal + 0.3) {
              const capW = tmpBox.max.x - tmpBox.min.x;
              const capH = tmpBox.max.y - tmpBox.min.y;
              if (capW >= 2 && capH >= 2) {
                const cap = new THREE.Mesh(unitPlaneGeo, capMat);
                cap.scale.set(capW, capH, 1);
                cap.position.set(
                  (tmpBox.min.x + tmpBox.max.x) * 0.5,
                  (tmpBox.min.y + tmpBox.max.y) * 0.5,
                  cutVal - planeBias
                );
                cap.raycast = () => {};
                if (!isLedCap) {
                  const outline = new THREE.LineSegments(unitEdgeGeo, capOutlineMat);
                  outline.position.z = 0.04;
                  cap.add(outline);
                }
                capGroup.add(cap);
              }
            }
          }
        });

        curScene.add(capGroup);
        sectionCapGroupRef.current = capGroup;
        requestRender();
      };

      buildSectionCaps();
      rafCapId = window.requestAnimationFrame(buildSectionCaps);
      return () => {
        if (rafCapId) window.cancelAnimationFrame(rafCapId);
      };
    }, [section3DAxis, section3DRatio, project, activeModuleIndex, requestRender, GEOMETRY_ENGINE_REV]);

    // Fast Selection & Active Module Highlight & Selection Frame Synchronization
    const updateSelectionAndActiveFrames = useCallback(() => {
      const meshGroup = meshGroupRef.current;
      if (!meshGroup) return;
      const isLight = theme !== "dark";

      traverseCabinetObjectsOnly(meshGroup, (obj) => {
        if (obj instanceof THREE.Mesh && obj.userData?.componentId) {
          const isSel = obj.userData.componentId === selectedComponentId;
          const isActMod = obj.userData.moduleIndex === activeModuleIndex;
          const isLedObj =
            String(obj.userData.matDef?.id || "").startsWith("mat_led_") ||
            String(obj.userData.componentId || "").includes("_recessed_led_");
          const isRail =
            !isLedObj &&
            (obj.userData.role === "hanging_rail" ||
              ((obj.userData.role === "door_handle" || obj.userData.role === "drawer_handle") &&
                obj.userData.handleCategory !== "milled_wood_grip" &&
                obj.userData.handleCategory !== "j_pull") ||
              obj.userData.role === "gola_profile" ||
              obj.userData.role === "drawer_slide" ||
              obj.userData.role === "door_hinge" ||
              obj.userData.role?.includes("fit"));
          if (!obj.userData.preserveCustomMaterial) {
            if (isXrayActive && !isLedObj) {
              obj.material = xrayIcePanelMat;
            } else if (renderEdgeMode === "cad") {
              const isHandleRole =
                obj.userData.role === "door_handle" ||
                obj.userData.role === "drawer_handle" ||
                obj.userData.role === "gola_profile";
              obj.material = isSel
                ? cadSelectedMat
                : isHandleRole
                ? cadHardwareMat
                : cadTechnicalMat;
            } else {
              const matDef = obj.userData.matDef || DEFAULT_MATERIALS[0];
              const grainDir = obj.userData.grainDir || "lengthwise";
              const surfFin = obj.userData.surfFin;
              obj.material = getV3PbrMaterial(matDef, isSel, isRail, grainDir, surfFin);
            }
          }

          for (let cIdx = 0; cIdx < obj.children.length; cIdx++) {
            const ch = obj.children[cIdx];
            if (ch instanceof THREE.LineSegments) {
              if (ch.userData?.isCadSwingLine) {
                ch.visible = renderEdgeMode === "cad";
              } else if (ch.userData?.isRevealSeam) {
                ch.visible = renderEdgeMode === "photoreal";
              } else {
                ch.visible = isSel || renderEdgeMode !== "photoreal";
                if (ch.visible) {
                  ch.material = getCachedEdgeMaterial(
                    isSel,
                    isActMod,
                    isLight,
                    renderEdgeMode === "photoreal"
                  );
                }
              }
            }
          }
        }
      });

      const actModGroup = activeModFrameGroupRef.current;
      if (actModGroup) {
        disposeObject3DTree(actModGroup);
        actModGroup.clear();
        actModGroup.position.set(0, 0, 0);
        const mainModsCount = project.modules.filter((m) => m.category !== "complementary").length;
        const activeMod = project.modules[activeModuleIndex];
        if (activeMod && activeMod.category !== "complementary") {
          const modAnchor = createModuleGroup(activeMod);
          if (mainModsCount > 1 || renderEdgeMode === "cad") {
            const selW = activeMod.dimensions.width + 12;
            const selD = activeMod.dimensions.depth + 12;
            const baseRingGeo = new THREE.BoxGeometry(selW, 4, selD);
            const baseRingEdges = new THREE.EdgesGeometry(baseRingGeo);
            baseRingGeo.dispose();
            const baseOutline = new THREE.LineSegments(
              baseRingEdges,
              new THREE.LineBasicMaterial({
                color: 0x141413,
                transparent: true,
                opacity: 0.45,
              })
            );
            baseOutline.raycast = () => {};
            baseOutline.position.set(
              activeMod.dimensions.width / 2,
              2,
              activeMod.dimensions.depth / 2
            );
            modAnchor.add(baseOutline);
          }

          // V96: SketchUp-style 3D Live Resize Handles (◀ Left, ▶ Right, ▲ Top) — hidden while 3D Section Cut is active!
          if (!activeMod.isFixedWidth && !section3DAxis) {
            const wM = activeMod.dimensions.width;
            const hM = activeMod.dimensions.height;
            const dM = activeMod.dimensions.depth;
            const add3DResizePill = (
              axis: "width_left" | "width_right" | "height_top",
              px: number,
              py: number,
              pz: number,
              colorHex: number,
              isVertical: boolean
            ) => {
              const handleGrp = new THREE.Group();
              handleGrp.position.set(px, py, pz);
              const pillMat = new THREE.MeshBasicMaterial({
                color: colorHex,
                depthTest: false,
                depthWrite: false,
                transparent: true,
                opacity: 0.92,
                toneMapped: false,
              });
              const pillGeo = isVertical
                ? new THREE.CapsuleGeometry(13, 46, 8, 12)
                : new THREE.CapsuleGeometry(13, 46, 8, 12).rotateZ(Math.PI / 2);
              const pillMesh = new THREE.Mesh(pillGeo, pillMat);
              pillMesh.renderOrder = 1002;
              pillMesh.userData = { isResizeHandle3D: true, resizeAxis: axis, modIdx: activeModuleIndex };
              handleGrp.add(pillMesh);

              const rimMat = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                depthTest: false,
                depthWrite: false,
                transparent: true,
                opacity: 0.72,
                wireframe: true,
              });
              const rimMesh = new THREE.Mesh(pillGeo, rimMat);
              rimMesh.scale.setScalar(1.12);
              rimMesh.renderOrder = 1001;
              rimMesh.raycast = () => {};
              handleGrp.add(rimMesh);

              // Generous invisible grab sphere for effortless 3D picking
              const hitMesh = new THREE.Mesh(
                new THREE.SphereGeometry(52, 8, 8),
                new THREE.MeshBasicMaterial({ visible: false })
              );
              hitMesh.userData = { isResizeHandle3D: true, resizeAxis: axis, modIdx: activeModuleIndex };
              handleGrp.add(hitMesh);

              modAnchor.add(handleGrp);
            };
            add3DResizePill("width_left", -28, hM * 0.5, dM * 0.85, 0x10b981, true);
            add3DResizePill("width_right", wM + 28, hM * 0.5, dM * 0.85, 0x10b981, true);
            add3DResizePill("height_top", wM * 0.5, hM + 30, dM * 0.85, 0x0ea5e9, false);
          }

          // Lightweight Active Bay Highlight Frame in actModGroup (0ms update on bay/module click!)
          const isCapsuleHull =
            activeMod.carcass.hullShape === "capsule_stadium" ||
            activeMod.carcass.hullShape === "capsule_table";
          const safeBayIdx = Math.max(0, Math.min(activeMod.bays.length - 1, activeBayIndex));
          const activeBayObj = activeMod.bays[safeBayIdx];
          const activeBayHasExternalDrawers = Boolean(
            activeBayObj?.drawers?.some((d) => !d.isInternal && !d.isHidden)
          );
          const activeBayIsTrulyOpen =
            !activeBayHasExternalDrawers &&
            (Boolean(activeMod.isOpenFront) ||
              activeBayObj?.door?.type === "open" ||
              activeBayObj?.door?.doorSystemId === "open");
          const showBayOverlay =
            !isCapsuleHull &&
            (cutawayActiveBay ||
              doorsHiddenIn3D ||
              (Boolean(selectedComponentId) &&
                (doorOpenAngleDeg > 5 || activeBayIsTrulyOpen)));
          if (showBayOverlay && activeMod.bays.length >= 1) {
            const T = activeMod.carcass.panelThickness || 18;
            const plinthH = activeMod.carcass.plinthHeight ?? 100;
            const fsAct = calculateFourSpaceDimensions(activeMod);
            const innerH =
              fsAct.usableInternal.netInnerHeightMm ||
              Math.max(300, activeMod.dimensions.height - plinthH - 2 * T);
            let curBayX = T;
            for (let bI = 0; bI < safeBayIdx; bI++) {
              curBayX += (fsAct.usableInternal.bayClearWidthsMm[bI] || 500) + T;
            }
            const bw =
              fsAct.usableInternal.bayClearWidthsMm[safeBayIdx] ||
              Math.round(
                (activeMod.dimensions.width - (activeMod.bays.length + 1) * T) /
                  activeMod.bays.length
              );
            const bayFrameGeo = new THREE.BoxGeometry(
              Math.max(80, bw - 4),
              Math.max(120, innerH - 4),
              Math.max(100, activeMod.dimensions.depth - T - 8)
            );
            const bayFrameEdgesGeo = new THREE.EdgesGeometry(bayFrameGeo);
            bayFrameGeo.dispose();
            const bayFrameLines = new THREE.LineSegments(
              bayFrameEdgesGeo,
              new THREE.LineBasicMaterial({
                color: 0x0284c7,
                transparent: true,
                opacity: 0.95,
              })
            );
            bayFrameLines.raycast = () => {};
            bayFrameLines.position.set(
              curBayX + bw / 2,
              plinthH + T + innerH / 2,
              T + (activeMod.dimensions.depth - T) / 2
            );
            modAnchor.add(bayFrameLines);

            const frontRectGeo = new THREE.BoxGeometry(
              Math.max(80, bw + 6),
              Math.max(120, innerH + 6),
              12
            );
            const frontRectEdgesGeo = new THREE.EdgesGeometry(frontRectGeo);
            frontRectGeo.dispose();
            const frontRectLines = new THREE.LineSegments(
              frontRectEdgesGeo,
              new THREE.LineBasicMaterial({
                color: 0x2563eb,
                transparent: true,
                opacity: 1,
              })
            );
            frontRectLines.raycast = () => {};
            frontRectLines.position.set(
              curBayX + bw / 2,
              plinthH + T + innerH / 2,
              activeMod.dimensions.depth + 2
            );
            modAnchor.add(frontRectLines);

            const localAnchor = new THREE.Vector3(
              curBayX + bw,
              plinthH + T + innerH * 0.48,
              activeMod.dimensions.depth
            );
            modAnchor.updateMatrixWorld(true);
            activeBayWorldAnchorRef.current = localAnchor.applyMatrix4(modAnchor.matrixWorld);
          } else {
            activeBayWorldAnchorRef.current = null;
          }

          actModGroup.add(modAnchor);
        } else {
          activeBayWorldAnchorRef.current = null;
        }
      }

      // Update 3D Blue Selection Frame using Oriented Bounding Box (OBB) so angled/open doors match 1-to-1!
      const selGroup = selectionFrameGroupRef.current;
      if (selGroup) {
        disposeObject3DTree(selGroup);
        selGroup.clear();
        selGroup.position.set(0, 0, 0);
        if (selectedComponentId) {
          meshGroup.updateMatrixWorld(true);
          let matchedMesh: THREE.Mesh | null = null;
          traverseCabinetObjectsOnly(meshGroup, (obj) => {
            if (
              !matchedMesh &&
              obj instanceof THREE.Mesh &&
              obj.userData?.componentId === selectedComponentId &&
              (obj.userData?.moduleIndex === activeModuleIndex || obj.userData?.moduleIndex === undefined)
            ) {
              matchedMesh = obj;
            }
          });
          if (matchedMesh) {
            const targetMesh = matchedMesh as THREE.Mesh;
            targetMesh.updateWorldMatrix(true, false);
            if (!targetMesh.geometry.boundingBox) {
              targetMesh.geometry.computeBoundingBox();
            }
            const lBox = targetMesh.geometry.boundingBox;
            if (lBox && !lBox.isEmpty()) {
              const lCenter = new THREE.Vector3();
              const lSize = new THREE.Vector3();
              lBox.getCenter(lCenter);
              lBox.getSize(lSize);
              const wCenter = lCenter.clone().applyMatrix4(targetMesh.matrixWorld);
              const wQuat = new THREE.Quaternion();
              targetMesh.getWorldQuaternion(wQuat);
              const wScale = new THREE.Vector3();
              targetMesh.getWorldScale(wScale);

              const isBoxGeo = targetMesh.geometry instanceof THREE.BoxGeometry;
              if (isBoxGeo) {
                const dFrameGeo = new THREE.BoxGeometry(
                  Math.max(12, lSize.x * Math.abs(wScale.x) + 8),
                  Math.max(12, lSize.y * Math.abs(wScale.y) + 8),
                  Math.max(12, lSize.z * Math.abs(wScale.z) + 8)
                );
                const dFrameLines = new THREE.LineSegments(
                  new THREE.EdgesGeometry(dFrameGeo),
                  new THREE.LineBasicMaterial({ color: 0x1d4ed8, linewidth: 2 })
                );
                dFrameLines.raycast = () => {};
                const dFrameFill = new THREE.Mesh(
                  dFrameGeo,
                  new THREE.MeshBasicMaterial({
                    color: 0x3b82f6,
                    transparent: true,
                    opacity: 0.2,
                    depthWrite: false,
                  })
                );
                dFrameFill.raycast = () => {};
                dFrameLines.position.copy(wCenter);
                dFrameLines.quaternion.copy(wQuat);
                dFrameFill.position.copy(wCenter);
                dFrameFill.quaternion.copy(wQuat);
                selGroup.add(dFrameLines);
                selGroup.add(dFrameFill);
              } else {
                const wPos = new THREE.Vector3();
                targetMesh.getWorldPosition(wPos);
                const clonedGeo = targetMesh.geometry.clone();
                const dFrameLines = new THREE.LineSegments(
                  new THREE.EdgesGeometry(clonedGeo, 18),
                  new THREE.LineBasicMaterial({ color: 0x1d4ed8, linewidth: 2 })
                );
                dFrameLines.raycast = () => {};
                const dFrameFill = new THREE.Mesh(
                  clonedGeo,
                  new THREE.MeshBasicMaterial({
                    color: 0x3b82f6,
                    transparent: true,
                    opacity: 0.22,
                    depthWrite: false,
                    polygonOffset: true,
                    polygonOffsetFactor: -2,
                    polygonOffsetUnits: -2,
                  })
                );
                dFrameFill.raycast = () => {};
                dFrameLines.position.copy(wPos);
                dFrameLines.quaternion.copy(wQuat);
                dFrameLines.scale.copy(wScale);
                dFrameFill.position.copy(wPos);
                dFrameFill.quaternion.copy(wQuat);
                dFrameFill.scale.copy(wScale);
                selGroup.add(dFrameLines);
                selGroup.add(dFrameFill);
              }

              activeDoorWorldAnchorRef.current = wCenter.clone();
            }
          } else {
            activeDoorWorldAnchorRef.current = null;
          }
        } else {
          activeDoorWorldAnchorRef.current = null;
        }
      }

      requestRender();
    }, [activeModuleIndex, activeBayIndex, cutawayActiveBay, doorsHiddenIn3D, doorOpenAngleDeg, selectedComponentId, section3DAxis, project, theme, renderEdgeMode, isXrayActive, requestRender]);

    const updateSelectionFramesRef = useRef(updateSelectionAndActiveFrames);
    updateSelectionFramesRef.current = updateSelectionAndActiveFrames;

    // Rebuild Parametric Meshes ONLY when project geometry or kinematic sliders change
    useEffect(() => {
      if (paused) return;
      const meshGroup = meshGroupRef.current;
      if (!meshGroup) return;

      // Always clear any transient hover preview before evaluating committed project materials
      restoreHoverPreviewMaterials();

      const needsActiveModInSig = cutawayActiveBay;
      const baseViewSuffix = `|REV:${GEOMETRY_ENGINE_REV}|${effectiveDoorsHiddenIn3D ? 1 : 0}:${cutawayActiveBay ? 1 : 0}:${renderEdgeMode}:${isXrayActive ? 1 : 0}`;
      const baseSigs = project.modules.map((mod, modIdx) =>
        `${computeModuleStructuralSignature(mod)}|ACT:${needsActiveModInSig && modIdx === activeModuleIndex ? activeBayIndex : -2}${baseViewSuffix}`
      );
      const moduleSigs = baseSigs.map(
        (bSig) => `${bSig}|KIN:${doorOpenAngleDeg}:${drawerOpenMm}:${explodedFactor}`
      );
      const topoSigs = project.modules.map(
        (mod, modIdx) =>
          `${computeModuleTopologySignature(mod)}|ACT:${needsActiveModInSig && modIdx === activeModuleIndex ? activeBayIndex : -2}${baseViewSuffix}|KIN:${doorOpenAngleDeg}:${drawerOpenMm}:${explodedFactor}`
      );

      if (
        meshGroup.children.length === project.modules.length &&
        project.modules.every((m, idx) => meshGroup.children[idx]?.userData?.renderSig === moduleSigs[idx])
      ) {
        let anyModTransformChanged = false;
        project.modules.forEach((m, idx) => {
          const child = meshGroup.children[idx];
          if (child) {
            child.userData.moduleIndex = idx;
            const pl = calculateModulePlacement(m);
            if (
              Math.abs(child.position.x - pl.origin.x) > 0.1 ||
              Math.abs(child.position.y - pl.origin.y) > 0.1 ||
              Math.abs(child.position.z - pl.origin.z) > 0.1 ||
              Math.abs(child.rotation.y - pl.rotationYRad) > 0.001
            ) {
              child.position.set(pl.origin.x, pl.origin.y, pl.origin.z);
              child.rotation.y = pl.rotationYRad;
              anyModTransformChanged = true;
            }
          }
        });
        updateSelectionFramesRef.current();
        if (anyModTransformChanged) {
          markShadowsAndRender();
        } else {
          requestRender();
        }
        return;
      }

      // Zero-rebuild 60fps kinematic fast-path for door/drawer/exploded transforms
      if (
        meshGroup.children.length === project.modules.length &&
        project.modules.every(
          (m, idx) =>
            meshGroup.children[idx]?.userData?.baseRenderSig === baseSigs[idx] &&
            m.carcass.hullShape !== "capsule_stadium" &&
            m.carcass.hullShape !== "rounded_corners" &&
            m.carcass.hullShape !== "capsule_table" &&
            !m.bays.some((b) => b.door?.type === "tambour" || b.door?.doorSystemId === "tambour_roller")
        )
      ) {
        project.modules.forEach((m, idx) => {
          const child = meshGroup.children[idx];
          if (!child) return;
          child.userData.moduleIndex = idx;
          child.userData.renderSig = moduleSigs[idx];
          const pl = calculateModulePlacement(m);
          child.position.set(pl.origin.x, pl.origin.y, pl.origin.z);
          child.rotation.y = pl.rotationYRad;

          const bd = generateModuleGeometry(m, {
            doorOpenAngleDeg,
            drawerOpenMm,
            explodedFactor,
          });
          const compById = new Map(bd.components.map((c) => [c.id, c]));
          for (const sub of child.children) {
            const compId = sub.userData?.componentId;
            if (typeof compId !== "string") continue;
            const comp = compById.get(compId);
            if (!comp) continue;
            const pivot = comp.pivot ?? comp.position;
            sub.position.set(pivot.x, pivot.y, pivot.z);
            if (comp.rotation) {
              sub.rotation.set(comp.rotation[0], comp.rotation[1], comp.rotation[2]);
            } else {
              sub.rotation.set(0, 0, 0);
            }
            if (comp.role === "door_hinge") {
              const doorYaw = comp.rotation?.[1] || 0;
              const carcassFixed = sub.userData?.hingeCarcassFixed;
              if (carcassFixed instanceof THREE.Object3D) {
                carcassFixed.rotation.y = -doorYaw;
              }
              const linkGroup = sub.userData?.hingeLinkGroup;
              if (linkGroup instanceof THREE.Object3D) {
                linkGroup.rotation.y = -doorYaw * 0.48;
              }
            }
            const aventosHousing = sub.userData?.aventosHousingGroup;
            if (aventosHousing instanceof THREE.Object3D) {
              aventosHousing.rotation.x = -(comp.rotation?.[0] || 0);
            }
          }
        });
        updateSelectionFramesRef.current();
        requestRender();
        return;
      }
      // Zero-rebuild < 0.5ms Material Swap Fast-Path: when ONLY surface materials/finishes changed
      // (identical 3D geometry topology & kinematics), swap MeshPhysicalMaterials in-place with ZERO buffer disposal!
      if (
        !isXrayActive &&
        renderEdgeMode === "photoreal" &&
        meshGroup.children.length === project.modules.length &&
        project.modules.every(
          (m, idx) =>
            meshGroup.children[idx]?.userData?.topoSig === topoSigs[idx] &&
            m.carcass.hullShape !== "capsule_stadium" &&
            m.carcass.hullShape !== "rounded_corners" &&
            m.carcass.hullShape !== "capsule_table"
        )
      ) {
        syncProjectCustomMaterials(project.customMaterials);
        const fastMatMap = new Map<string, MaterialDefinition>(
          [...DEFAULT_MATERIALS, ...(project.customMaterials || [])].map((m) => [m.id, m])
        );
        const fastFallbackStone: MaterialDefinition = {
          id: "mat_stone_calacatta",
          name: "Çimstone Calacatta Kuvars",
          category: "compact",
          colorHex: "#f5f4f0",
          roughness: 0.22,
          metalness: 0.02,
          thickness: 20,
          costPerM2: 185,
          edgeBandCostPerM: 0,
          hasGrain: false,
        };
        const fastFallbackLed: MaterialDefinition = {
          id: "mat_led_warm_3000k",
          name: "Häfele Loox5 3000K Sıcak LED",
          category: "compact",
          colorHex: "#fff7d6",
          roughness: 0.2,
          metalness: 0.05,
          thickness: 8,
          costPerM2: 45,
          edgeBandCostPerM: 0,
          hasGrain: false,
        };

        project.modules.forEach((mod, modIdx) => {
          const modContainer = meshGroup.children[modIdx];
          if (!modContainer) return;
          if (modContainer.userData?.renderSig === moduleSigs[modIdx]) return;

          modContainer.userData.renderSig = moduleSigs[modIdx];
          modContainer.userData.baseRenderSig = baseSigs[modIdx];
          modContainer.userData.topoSig = topoSigs[modIdx];
          modContainer.userData.moduleIndex = modIdx;

          const bd = generateModuleGeometry(mod, {
            doorOpenAngleDeg,
            drawerOpenMm,
            explodedFactor,
          });
          const compById = new Map(bd.components.map((c) => [c.id, c]));

          for (const compGroup of modContainer.children) {
            const compId = compGroup.userData?.componentId;
            if (typeof compId !== "string") continue;
            const comp = compById.get(compId);
            if (!comp) continue;

            const isLedStrip =
              comp.materialId.startsWith("mat_led_") || comp.id.includes("_recessed_led_");
            const matDef =
              fastMatMap.get(comp.materialId) ||
              (comp.role === "countertop" || comp.materialId === "mat_stone_calacatta"
                ? fastFallbackStone
                : isLedStrip
                ? { ...fastFallbackLed, id: comp.materialId || "mat_led_warm_3000k" }
                : DEFAULT_MATERIALS[0]);
            const isSelected = comp.id === selectedComponentId;
            const isRail =
              !isLedStrip &&
              (comp.role === "hanging_rail" ||
                ((comp.role === "door_handle" || comp.role === "drawer_handle") &&
                  comp.handleCategory !== "milled_wood_grip" &&
                  comp.handleCategory !== "j_pull") ||
                comp.role === "gola_profile" ||
                comp.role === "drawer_slide" ||
                comp.role === "door_hinge" ||
                comp.role.includes("fit"));
            const grainDir =
              mod.componentGrainOverrides?.[comp.id] ||
              (comp.role.includes("door") ? mod.componentGrainOverrides?.__doors__ : undefined) ||
              (comp.role === "drawer_front" ? mod.componentGrainOverrides?.__drawers__ : undefined) ||
              mod.componentGrainOverrides?.__all__ ||
              "lengthwise";
            const nextPbrMat = getV3PbrMaterial(
              matDef,
              isSelected,
              isRail,
              grainDir,
              mod.surfaceFinishOverride
            );
            compGroup.userData.matDef = matDef;
            compGroup.userData.grainDir = grainDir;
            compGroup.userData.surfFin = mod.surfaceFinishOverride;
            compGroup.traverse((sub) => {
              if (
                (sub instanceof THREE.Mesh || sub instanceof THREE.InstancedMesh) &&
                !sub.userData?.preserveCustomMaterial &&
                !sub.userData?.isSelectionHelper &&
                !sub.userData?.isContactShadow
              ) {
                sub.material = nextPbrMat;
                if (sub.userData) {
                  sub.userData.matDef = matDef;
                }
              }
            });
          }
        });
        updateSelectionFramesRef.current();
        requestRender();
        return;
      }

      solidMeshesCacheRef.current.dirty = true;

      // Differential per-module cache: reuse unchanged module groups (e.g. multi-cabinet kitchens)
      // and strictly dispose GPU buffers of invalidated or deleted module groups!
      const reusableGroupsBySig = new Map<string, THREE.Object3D[]>();
      for (const existingChild of [...meshGroup.children]) {
        const sig = existingChild?.userData?.renderSig;
        if (typeof sig === "string" && moduleSigs.includes(sig)) {
          const list = reusableGroupsBySig.get(sig) || [];
          list.push(existingChild);
          reusableGroupsBySig.set(sig, list);
        } else {
          for (const sub of [...existingChild.children]) {
            if (sub.userData?.isSharedCachedProps) {
              existingChild.remove(sub);
            }
          }
          disposeObject3DTree(existingChild);
        }
      }
      meshGroup.clear();
      const matMap = new Map(DEFAULT_MATERIALS.map((m) => [m.id, m]));
      const isLight = theme !== "dark";

      const fallbackStoneDef: MaterialDefinition = {
        id: "mat_stone_calacatta",
        name: "Çimstone Calacatta Kuvars",
        category: "compact",
        colorHex: "#f5f4f0",
        roughness: 0.22,
        metalness: 0.02,
        thickness: 20,
        costPerM2: 185,
        edgeBandCostPerM: 0,
        hasGrain: false,
      };
      const fallbackLedDef: MaterialDefinition = {
        id: "mat_led_warm_3000k",
        name: "Häfele Loox5 3000K Sıcak LED",
        category: "compact",
        colorHex: "#fff7d6",
        roughness: 0.2,
        metalness: 0.05,
        thickness: 8,
        costPerM2: 45,
        edgeBandCostPerM: 0,
        hasGrain: false,
      };

      let activeSceneLedLights = 0;
      const grainContinuityMap3D = computeProjectGrainContinuityMap(project);
      project.modules.forEach((mod, modIdx) => {
        const reusableBucket = reusableGroupsBySig.get(moduleSigs[modIdx]);
        if (reusableBucket && reusableBucket.length > 0) {
          const reusedGroup = reusableBucket.shift()!;
          const pl = calculateModulePlacement(mod);
          reusedGroup.position.set(pl.origin.x, pl.origin.y, pl.origin.z);
          reusedGroup.rotation.y = pl.rotationYRad;
          meshGroup.add(reusedGroup);
          return;
        }

        const breakdown = generateModuleGeometry(mod, {
          doorOpenAngleDeg,
          drawerOpenMm,
          explodedFactor,
        });

        syncProjectCustomMaterials(project.customMaterials);
        (project.customMaterials || []).forEach((cm) => matMap.set(cm.id, cm));

        const isActiveMod = modIdx === activeModuleIndex;
        const modContainer = createModuleGroup(mod);
        modContainer.userData = {
          moduleId: mod.id,
          renderSig: moduleSigs[modIdx],
          baseRenderSig: baseSigs[modIdx],
          topoSig: topoSigs[modIdx],
          moduleIndex: modIdx,
        };

        if (
          mod.carcass.hullShape === "capsule_stadium" ||
          mod.carcass.hullShape === "rounded_corners" ||
          mod.carcass.hullShape === "capsule_table"
        ) {
          const capEdgeMat = getCachedEdgeMaterial(
            false,
            isActiveMod,
            isLight,
            renderEdgeMode === "photoreal"
          );
          const capGroup = buildCapsuleParametricModuleGroup(
            mod,
            (mId, isMetal) => {
              const md =
                matMap.get(mId) ||
                (mId.includes("calacatta") || mId.includes("stone")
                  ? fallbackStoneDef
                  : DEFAULT_MATERIALS[0]);
              return isXrayActive
                ? xrayIcePanelMat
                : renderEdgeMode === "cad"
                ? cadTechnicalMat
                : getV3PbrMaterial(md, false, Boolean(isMetal), "lengthwise", mod.surfaceFinishOverride);
            },
            capEdgeMat,
            modIdx,
            effectiveDoorsHiddenIn3D ? 85 : doorOpenAngleDeg,
            drawerOpenMm
          );
          modContainer.add(capGroup);
        } else {
        breakdown.components.forEach((comp) => {
          const isLedStrip =
            comp.materialId.startsWith("mat_led_") || comp.id.includes("_recessed_led_");
          const matDef =
            matMap.get(comp.materialId) ||
            (comp.role === "countertop" || comp.materialId === "mat_stone_calacatta"
              ? fallbackStoneDef
              : isLedStrip
              ? { ...fallbackLedDef, id: comp.materialId || "mat_led_warm_3000k" }
              : DEFAULT_MATERIALS[0]);
          const isSelected = comp.id === selectedComponentId;
          const isRail =
            !isLedStrip &&
            (comp.role === "hanging_rail" ||
              ((comp.role === "door_handle" || comp.role === "drawer_handle") &&
                comp.handleCategory !== "milled_wood_grip" &&
                comp.handleCategory !== "j_pull") ||
              comp.role === "gola_profile" ||
              comp.role === "drawer_slide" ||
              comp.role === "door_hinge" ||
              comp.role.includes("fit"));

          const grainDir =
            mod.componentGrainOverrides?.[comp.id] ||
            (comp.role.includes("door") ? mod.componentGrainOverrides?.__doors__ : undefined) ||
            (comp.role === "drawer_front" ? mod.componentGrainOverrides?.__drawers__ : undefined) ||
            mod.componentGrainOverrides?.__all__ ||
            "lengthwise";
          const surfFin = mod.surfaceFinishOverride;
          const material =
            isXrayActive && !isLedStrip
              ? xrayIcePanelMat
              : renderEdgeMode === "cad"
              ? isSelected
                ? cadSelectedMat
                : comp.role === "door_handle" ||
                  comp.role === "drawer_handle" ||
                  comp.role === "gola_profile"
                ? cadHardwareMat
                : cadTechnicalMat
              : getV3PbrMaterial(matDef, isSelected, isRail, grainDir, surfFin);
          const edgeMat = isXrayActive
            ? new THREE.LineBasicMaterial({ color: 0x0284c7, transparent: true, opacity: 0.72 })
            : getCachedEdgeMaterial(isSelected, isActiveMod, isLight, renderEdgeMode === "photoreal");

          const isDoorPart =
            String(comp.role) === "door" ||
            comp.role.startsWith("door_") ||
            comp.role === "door_handle" ||
            comp.role === "door_hinge";
          const isCutawayBayDoor =
            isActiveMod &&
            cutawayActiveBay &&
            isDoorPart &&
            comp.bayIndex === activeBayIndex &&
            !comp.id.includes("sliding");
          if ((effectiveDoorsHiddenIn3D || isCutawayBayDoor) && isDoorPart) {
            return;
          }
          const grainMatch = grainContinuityMap3D.get(comp.id);
          const compGroup = createComponentMesh(comp, material, edgeMat, {
            componentId: comp.id,
            label: comp.label || comp.role,
            dimsText: `${comp.dimensions.width}×${comp.dimensions.height} mm`,
            role: comp.role,
            moduleIndex: modIdx,
            bayIndex: comp.bayIndex,
            matDef,
            grainDir,
            surfFin,
            continuousGrainUv: grainMatch
              ? {
                  offsetXMm: grainMatch.offsetXMm,
                  offsetYMm: grainMatch.offsetYMm,
                  crosswise: grainMatch.grainDirection === "crosswise",
                }
              : undefined,
          });
          compGroup.userData = {
            ...compGroup.userData,
            componentId: comp.id,
            parentComponentId: comp.parentComponentId,
            role: comp.role,
            bayIndex: comp.bayIndex,
          };
          compGroup.traverse((sub) => {
            if (sub instanceof THREE.LineSegments) {
              if (renderEdgeMode === "cad") {
                if (sub.userData?.isCadSwingLine) sub.visible = true;
                if (sub.userData?.isRevealSeam) sub.visible = false;
              } else if (renderEdgeMode === "photoreal") {
                if (!sub.userData?.isRevealSeam && !isSelected) {
                  sub.visible = false;
                }
              }
            }
          });
          if (
            comp.role === "carcass_sub_divider" &&
            typeof comp.bayIndex === "number" &&
            (mod.bays[comp.bayIndex]?.subDividers || []).some(
              (sd, sdIdx) => sd.id === comp.id || `${mod.id}_bay_${comp.bayIndex}_subdiv_${sdIdx}` === comp.id
            )
          ) {
            const grabMesh = new THREE.Mesh(SHARED_SUBDIV_GRAB_BOX_GEO, SHARED_SUBDIV_GRAB_MAT);
            grabMesh.scale.set(
              Math.max(58, comp.dimensions.width + 40),
              Math.max(60, comp.dimensions.height),
              Math.max(120, comp.dimensions.depth)
            );
            grabMesh.position.set(
              comp.dimensions.width / 2,
              comp.dimensions.height / 2,
              comp.dimensions.depth / 2
            );
            grabMesh.userData = {
              componentId: comp.id,
              role: comp.role,
              label: comp.label || "Raf Arası Dikme",
              moduleIndex: modIdx,
              bayIndex: comp.bayIndex,
              isSelectionHelper: true,
              preserveCustomMaterial: true,
            };
            compGroup.add(grabMesh);
          }
          modContainer.add(compGroup);

          // Interior LED PointLights are placed cleanly at bay centers below (prevents hot-spots 1mm from side panels)
          void activeSceneLedLights;
        });
        }

        const aoTex = renderEdgeMode === "cad" ? null : getContactAoShadowTexture();
        if (aoTex) {
          const { groundAoMat, wallAoMat } = getCachedContactAoMaterials(aoTex);
          if (mod.position.y <= 80) {
            const aoMesh = new THREE.Mesh(SHARED_UNIT_AO_PLANE_GEO, groundAoMat);
            aoMesh.scale.set(mod.dimensions.width + 150, mod.dimensions.depth + 150, 1);
            aoMesh.raycast = () => {};
            aoMesh.rotation.x = -Math.PI / 2;
            aoMesh.position.set(
              mod.dimensions.width / 2,
              -mod.position.y + 1.2,
              mod.dimensions.depth / 2 + 18
            );
            modContainer.add(aoMesh);

            // Crisp dark grounding contact shadow line directly beneath plinth toe-kick & side panels
            const baseCrevice = new THREE.Mesh(SHARED_UNIT_AO_PLANE_GEO, SHARED_BASE_CREVICE_MAT);
            baseCrevice.scale.set(mod.dimensions.width + 8, mod.dimensions.depth + 8, 1);
            baseCrevice.raycast = () => {};
            baseCrevice.rotation.x = -Math.PI / 2;
            baseCrevice.position.set(
              mod.dimensions.width / 2,
              -mod.position.y + 1.6,
              mod.dimensions.depth / 2
            );
            modContainer.add(baseCrevice);
          }

          // Wide Back-Wall Contact Shadow Halo behind EVERY cabinet so carcass NEVER blends into the wall
          const wallAoMesh = new THREE.Mesh(SHARED_UNIT_AO_PLANE_GEO, wallAoMat);
          wallAoMesh.scale.set(mod.dimensions.width + 280, mod.dimensions.height + 260, 1);
          wallAoMesh.raycast = () => {};
          wallAoMesh.position.set(
            mod.dimensions.width / 2,
            mod.dimensions.height / 2,
            2.5
          );
          modContainer.add(wallAoMesh);
        }
        // Architectural 4-Corner Interior Cavity AO + Physical Multi-Kelvin 3D LED Light Strips & Washes (Photoreal)
        if (renderEdgeMode !== "cad") {
          const hasAnyLedFitting = mod.bays.some((b) =>
            (b.specialFittings || []).some((f) => f.type.startsWith("led_"))
          );
          const isLedActive = Boolean(mod.carcass.ledLightingEnabled) || hasAnyLedFitting;
          const ledKelvin = mod.carcass.ledColorTempK || 3000;
          const ledDimmer = Math.max(0.25, Math.min(1, (mod.carcass.ledDimmerPct ?? 90) / 100));
          const ledMode = mod.carcass.ledPlacementMode || "top_and_shelves";
          const ledHex =
            ledKelvin <= 2800 ? 0xffa73b : ledKelvin >= 3800 ? 0xfff1d6 : 0xffc864;

          if (isLedActive && activeSceneLedLights < 3) {
            activeSceneLedLights += 1;
            const cavityLight = new THREE.PointLight(
              ledHex,
              (lightingPreset === "night_led" ? 6.4 : lightingPreset === "showroom_warm" ? 4.0 : 2.5) * ledDimmer,
              2700,
              0.22
            );
            cavityLight.castShadow = false;
            cavityLight.position.set(
              mod.dimensions.width / 2,
              mod.dimensions.height * 0.64,
              mod.dimensions.depth * 0.68
            );
            modContainer.add(cavityLight);
          }

          const creviceTex = getLinearCreviceAoTexture();
          const leftCornerAoTex = getHorizontalCornerAoTexture("left");
          const rightCornerAoTex = getHorizontalCornerAoTexture("right");
          const underShelfLedTex = isLedActive ? getKelvinUnderShelfWashTexture(ledKelvin) : null;
          const stripBloomTex = isLedActive ? getGaussianLedBloomTexture(ledKelvin) : null;

          const pT = mod.carcass.panelThickness || 18;
          const plH = mod.carcass.plinthHeight ?? 100;
          const inH =
            breakdown.netInnerHeight || Math.max(300, mod.dimensions.height - plH - 2 * pT);
          let bxCursor = pT;

          mod.bays.forEach((bObj, bI) => {
            const bW =
              breakdown.bayWidths[bI] ||
              Math.round((mod.dimensions.width - (mod.bays.length + 1) * pT) / mod.bays.length);
            const bayVis =
              Boolean(section3DAxis) ||
              doorsHiddenIn3D ||
              (isActiveMod && cutawayActiveBay && bI === activeBayIndex) ||
              doorOpenAngleDeg > 5 ||
              Boolean(mod.isOpenFront) ||
              bObj.door.type === "open" ||
              bObj.door.doorSystemId === "open" ||
              Boolean(bObj.door.isGlassFramed) ||
              bObj.door.crossSectionProfile === "glass_frame" ||
              bObj.door.crossSectionProfile === "center_glass_frame" ||
              bObj.door.crossSectionProfile === "u_glass_open_top" ||
              String(bObj.door.doorMaterialId || "").includes("glass");

            if (bayVis && creviceTex) {
              if (!cachedCreviceTopMat) {
                cachedCreviceTopMat = markSharedMaterial(
                  new THREE.MeshBasicMaterial({ map: creviceTex, transparent: true, opacity: 0.86, depthWrite: false })
                );
              }
              if (!cachedCreviceShelfMat) {
                cachedCreviceShelfMat = markSharedMaterial(
                  new THREE.MeshBasicMaterial({ map: creviceTex, transparent: true, opacity: 0.72, depthWrite: false })
                );
              }
              const topCrevice = new THREE.Mesh(SHARED_UNIT_AO_PLANE_GEO, cachedCreviceTopMat);
              topCrevice.scale.set(Math.max(60, bW - 2), 115, 1);
              topCrevice.raycast = () => {};
              topCrevice.position.set(bxCursor + bW / 2, plH + pT + inH - 57.5, pT + 1.1);
              modContainer.add(topCrevice);

              if (leftCornerAoTex && rightCornerAoTex) {
                if (!cachedLeftCornerAoMat) {
                  cachedLeftCornerAoMat = markSharedMaterial(
                    new THREE.MeshBasicMaterial({ map: leftCornerAoTex, transparent: true, opacity: 0.72, depthWrite: false })
                  );
                }
                if (!cachedRightCornerAoMat) {
                  cachedRightCornerAoMat = markSharedMaterial(
                    new THREE.MeshBasicMaterial({ map: rightCornerAoTex, transparent: true, opacity: 0.72, depthWrite: false })
                  );
                }
                const cornerW = Math.min(92, bW * 0.24);
                const cornerH = Math.max(120, inH - 4);
                const leftAo = new THREE.Mesh(SHARED_UNIT_AO_PLANE_GEO, cachedLeftCornerAoMat);
                leftAo.scale.set(cornerW, cornerH, 1);
                leftAo.raycast = () => {};
                leftAo.position.set(bxCursor + cornerW / 2, plH + pT + inH / 2, pT + 1.25);
                modContainer.add(leftAo);

                const rightAo = new THREE.Mesh(SHARED_UNIT_AO_PLANE_GEO, cachedRightCornerAoMat);
                rightAo.scale.set(cornerW, cornerH, 1);
                rightAo.raycast = () => {};
                rightAo.position.set(bxCursor + bW - cornerW / 2, plH + pT + inH / 2, pT + 1.25);
                modContainer.add(rightAo);
              }

              (bObj.shelves || []).slice(0, 8).forEach((sh) => {
                if (sh.elevationY > 70) {
                  const shAo = new THREE.Mesh(SHARED_UNIT_AO_PLANE_GEO, cachedCreviceShelfMat!);
                  shAo.scale.set(Math.max(60, bW - 2), 76, 1);
                  shAo.raycast = () => {};
                  shAo.userData = { shelfOwnerId: sh.id };
                  shAo.position.set(bxCursor + bW / 2, plH + pT + sh.elevationY - 38, pT + 1.15);
                  modContainer.add(shAo);
                }
              });
            }

            // 4. Soft Additive LED Grazing Light Washes (Physical 3D channels come solely from mesh-generator.ts — ZERO duplicate bars!)
            if (bayVis && isLedActive && underShelfLedTex) {
              const showHorizontalShelfLeds =
                ledMode === "shelf_underside" ||
                ledMode === "full_showcase" ||
                (bObj.specialFittings || []).some((f) => !f.isHidden && f.type === "led_profile");
              const showVerticalSideLeds =
                ledMode === "vertical_sides" ||
                ledMode === "full_showcase" ||
                (bObj.specialFittings || []).some((f) => !f.isHidden && f.type === "led_vertical_strip");

              const extBotDrawers = (bObj.drawers || []).filter(
                (d) => !d.isInternal && (d.elevationY || 0) < inH * 0.55
              );
              const openFloorLocalY =
                extBotDrawers.length > 0
                  ? Math.max(...extBotDrawers.map((d) => (d.elevationY || 0) + d.height)) + pT
                  : 0;

              const chanWidthMm = Math.max(6, Math.min(32, mod.carcass.ledChannelWidthMm ?? 12));
              const ledAligned = mod.carcass.ledAlignShelfAndSide !== false;
              const vSetbackMm = Math.max(
                35,
                Math.min(Math.max(60, mod.dimensions.depth - 45), mod.carcass.ledFrontSetbackMm ?? 75)
              );
              const hSetbackMm = ledAligned
                ? vSetbackMm
                : Math.max(
                    35,
                    Math.min(
                      Math.max(60, mod.dimensions.depth - 45),
                      mod.carcass.ledShelfSetbackMm ?? vSetbackMm
                    )
                  );
              const bloomSpanMm = Math.max(22, Math.round(chanWidthMm * 2.2));

              const emitHorizontalLedGlow = (undersideY: number, shelfOwnerId?: string) => {
                if (stripBloomTex) {
                  const hChanZ = Math.max(34, Math.round(mod.dimensions.depth - hSetbackMm));
                  // PlaneGeometry(bloomSpanMm, stripW): local X has Gaussian bell-curve falloff to 0 at edges!
                  const underGlow = new THREE.Mesh(
                    new THREE.PlaneGeometry(bloomSpanMm, Math.max(60, bW - 8)),
                    new THREE.MeshBasicMaterial({
                      map: stripBloomTex,
                      transparent: true,
                      opacity: (lightingPreset === "night_led" ? 0.42 : 0.25) * ledDimmer,
                      blending: THREE.AdditiveBlending,
                      depthWrite: false,
                      side: THREE.DoubleSide,
                    })
                  );
                  underGlow.raycast = () => {};
                  if (shelfOwnerId) underGlow.userData = { shelfOwnerId };
                  underGlow.rotation.x = Math.PI / 2;
                  underGlow.rotation.z = Math.PI / 2;
                  underGlow.position.set(bxCursor + bW / 2, undersideY - 2.2, hChanZ);
                  modContainer.add(underGlow);
                }

                const backWashH = 145;
                const backWash = new THREE.Mesh(
                  new THREE.PlaneGeometry(Math.max(60, bW - 8), backWashH),
                  new THREE.MeshBasicMaterial({
                    map: underShelfLedTex,
                    transparent: true,
                    opacity: (lightingPreset === "night_led" ? 0.72 : 0.48) * ledDimmer,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false,
                  })
                );
                backWash.raycast = () => {};
                if (shelfOwnerId) backWash.userData = { shelfOwnerId };
                backWash.position.set(bxCursor + bW / 2, undersideY - backWashH / 2, pT + 2.0);
                modContainer.add(backWash);
              };

              if (showHorizontalShelfLeds) {
                emitHorizontalLedGlow(plH + pT + inH);
                (bObj.shelves || []).slice(0, 8).forEach((sh) => {
                  if (!sh.isHidden && sh.elevationY > openFloorLocalY + 60) {
                    emitHorizontalLedGlow(plH + pT + sh.elevationY, sh.id);
                  }
                });
              }

              if (showVerticalSideLeds && stripBloomTex) {
                // Feather-soft Gaussian optical bloom locked 1-to-1 to vSetbackMm & chanWidthMm (0% alpha at edges)
                const vSpanH = Math.max(120, inH - openFloorLocalY - 10);
                const vCenterY = plH + pT + openFloorLocalY + 4 + vSpanH / 2;
                const vChanCenterZ = Math.max(34, Math.round(mod.dimensions.depth - vSetbackMm));
                const sideGlowGeo = new THREE.PlaneGeometry(bloomSpanMm, vSpanH);
                const sideGlowMat = new THREE.MeshBasicMaterial({
                  map: stripBloomTex,
                  transparent: true,
                  opacity: (lightingPreset === "night_led" ? 0.36 : 0.2) * ledDimmer,
                  blending: THREE.AdditiveBlending,
                  depthWrite: false,
                  side: THREE.DoubleSide,
                });
                [
                  { x: bxCursor + 2.1, rotY: Math.PI / 2 },
                  { x: bxCursor + bW - 2.1, rotY: -Math.PI / 2 },
                ].forEach((sideSpec) => {
                  const glowPlane = new THREE.Mesh(sideGlowGeo, sideGlowMat);
                  glowPlane.raycast = () => {};
                  glowPlane.rotation.y = sideSpec.rotY;
                  glowPlane.position.set(sideSpec.x, vCenterY, vChanCenterZ);
                  modContainer.add(glowPlane);
                });
              }

              // Warm 3D PBR interior illumination (capped at <= 6 bay lights across multi-module scenes for 60 FPS)
              if (project.modules.length <= 3 && mod.bays.length <= 5) {
                const openSpanH = Math.max(200, inH - openFloorLocalY);
                const lightHex =
                  ledKelvin <= 2800 ? 0xffbe6b : ledKelvin >= 3800 ? 0xfff6e8 : 0xffdc9e;
                const upperBayLight = new THREE.PointLight(
                  lightHex,
                  (lightingPreset === "night_led" ? 4.2 : 1.9) * ledDimmer,
                  Math.max(1350, openSpanH * 1.15),
                  0.22
                );
                upperBayLight.position.set(
                  bxCursor + bW / 2,
                  plH + pT + openFloorLocalY + openSpanH * 0.68,
                  pT + (mod.dimensions.depth - pT) * 0.6
                );
                modContainer.add(upperBayLight);
              }
            }

            bxCursor += bW + pT;
          });
        }

        
        // 3D Direct Compartment Hit Volumes (independent of isActiveMod / activeBayIndex so clicking bays never rebuilds cabinet meshes!)
        if (mod.bays.length >= 1) {
          const T = mod.carcass.panelThickness || 18;
          const plinthH = mod.carcass.plinthHeight ?? 100;
          const innerH =
            breakdown.netInnerHeight || Math.max(300, mod.dimensions.height - plinthH - 2 * T);
          let curBayX = T;
          const showBayOverlay =
            cutawayActiveBay ||
            doorsHiddenIn3D ||
            doorOpenAngleDeg > 5 ||
            Boolean(mod.isOpenFront) ||
            mod.bays.some((b) => b.door.type === "open" || b.door.doorSystemId === "open");

          if (showBayOverlay) {
            mod.bays.forEach((_bayObj, bIdx) => {
              const bw =
                breakdown.bayWidths[bIdx] ||
                Math.round((mod.dimensions.width - (mod.bays.length + 1) * T) / mod.bays.length);
              const bayHitMesh = new THREE.Mesh(SHARED_UNIT_AO_PLANE_GEO, SHARED_BAY_HIT_MAT);
              bayHitMesh.scale.set(Math.max(80, bw - 6), Math.max(120, innerH - 6), 1);
              bayHitMesh.position.set(curBayX + bw / 2, plinthH + T + innerH / 2, T + 8);
              bayHitMesh.userData = {
                componentId: `${mod.id}_bay_compartment_${bIdx}`,
                role: "bay_compartment",
                moduleIndex: modIdx,
                bayIndex: bIdx,
              };
              modContainer.add(bayHitMesh);
              curBayX += bw + T;
            });
          }
        }

        // Interior styling props are managed in dedicated `interiorPropsGroupRef` layer (zero rebuild on door/material edits!)

        if (
          !isXrayActive &&
          !isStoreBatchDragging &&
          (doorOpenAngleDeg > 4 ||
            effectiveDoorsHiddenIn3D ||
            cutawayActiveBay ||
            mod.isOpenFront ||
            mod.bays.some((b) => b.door?.type === "open") ||
            mod.carcass.showMultiHolesIn3D === true)
        ) {
          const mhSig = computeModuleStructuralSignature(mod);
          let cachedMh = multiHoleMeshCacheRef.current.get(mhSig);
          if (!cachedMh) {
            const builtMh = build3DModuleMultiHoleInstancedMesh(mod, breakdown.components);
            if (builtMh) {
              if (multiHoleMeshCacheRef.current.size > 24) {
                multiHoleMeshCacheRef.current.clear();
              }
              multiHoleMeshCacheRef.current.set(mhSig, builtMh);
              cachedMh = builtMh;
            }
          }
          if (cachedMh) {
            const mhClone = cachedMh.clone();
            mhClone.instanceMatrix = cachedMh.instanceMatrix;
            mhClone.raycast = () => {};
            modContainer.add(mhClone);
          }

          // Kapaklar açıldığında veya gizlendiğinde dikme iç yüzlerinde 37mm (inset 57mm) ofsetli, 32mm adımlı Ø5mm menteşe taban deliklerini göster
          const hingeComps = breakdown.components.filter((c) => c.role === "door_hinge");
          if (hingeComps.length > 0) {
            const T = mod.carcass.panelThickness || 18;
            const bayStarts: number[] = [];
            let accX = T;
            mod.bays.forEach((_, bIdx) => {
              bayStarts.push(accX);
              accX +=
                (breakdown.bayWidths[bIdx] ||
                  Math.round((mod.dimensions.width - (mod.bays.length + 1) * T) / Math.max(1, mod.bays.length))) + T;
            });

            const holeMatrices: THREE.Matrix4[] = [];
            const ringMatrices: THREE.Matrix4[] = [];
            const dummy = new THREE.Object3D();

            hingeComps.forEach((hc) => {
              const bIdx = typeof hc.bayIndex === "number" ? hc.bayIndex : 0;
              const bw =
                breakdown.bayWidths[bIdx] ||
                Math.round((mod.dimensions.width - (mod.bays.length + 1) * T) / Math.max(1, mod.bays.length));
              const bayLeftX = bayStarts[bIdx] ?? T;
              const bayRightX = bayLeftX + bw;
              const refX = hc.position.x + hc.dimensions.width / 2;
              const isLeftWall = Math.abs(refX - bayLeftX) <= Math.abs(refX - bayRightX);
              const wallX = isLeftWall ? bayLeftX + 0.55 : bayRightX - 0.55;
              const ringX = isLeftWall ? bayLeftX + 0.4 : bayRightX - 0.4;
              // Her menteşenin kendi gerçek yüksekliği (hc.pivot kapağın alt köşesidir, kullanılmamalı!)
              const centerY = hc.position.y + hc.dimensions.height / 2;
              const isBayInset = mod.bays[bIdx]?.door?.overlayType === "inset";
              const frontSetback = isBayInset ? 57 : 37;
              const holeZ = Math.max(24, mod.dimensions.depth - frontSetback);

              [-16, 16].forEach((dy) => {
                dummy.position.set(ringX, centerY + dy, holeZ);
                dummy.rotation.set(0, 0, Math.PI / 2);
                dummy.scale.set(8.2, 1.6, 8.2);
                dummy.updateMatrix();
                ringMatrices.push(dummy.matrix.clone());

                dummy.position.set(wallX, centerY + dy, holeZ);
                dummy.rotation.set(0, 0, Math.PI / 2);
                dummy.scale.set(5, 2.2, 5);
                dummy.updateMatrix();
                holeMatrices.push(dummy.matrix.clone());
              });
            });

            if (ringMatrices.length > 0) {
              const hingeRingInst = new THREE.InstancedMesh(
                xrayHoleUnitCylinder,
                hingeMountRing3DMat,
                ringMatrices.length
              );
              hingeRingInst.raycast = () => {};
              ringMatrices.forEach((mtx, i) => hingeRingInst.setMatrixAt(i, mtx));
              hingeRingInst.instanceMatrix.needsUpdate = true;
              modContainer.add(hingeRingInst);
            }

            if (holeMatrices.length > 0) {
              const hingeHoleInst = new THREE.InstancedMesh(
                xrayHoleUnitCylinder,
                hingeMountHole3DMat,
                holeMatrices.length
              );
              hingeHoleInst.raycast = () => {};
              holeMatrices.forEach((mtx, i) => hingeHoleInst.setMatrixAt(i, mtx));
              hingeHoleInst.instanceMatrix.needsUpdate = true;
              modContainer.add(hingeHoleInst);
            }
          }
        }

        if (isXrayActive) {
          // V112: Always compute live per-module CNC cutList (skipSyncNesting: true) from the current `mod`
          // so X-Ray minifix/dowel/hinge holes track cabinet width/height/depth resizes in real time
          // instead of lagging behind a stale batch-deferred `storeBom`!
          const liveModBom = (() => {
            try {
              return generateBOMForProject(
                { ...project, modules: [mod] },
                undefined,
                { skipSyncNesting: true }
              );
            } catch {
              return storeBom;
            }
          })();
          const modPieces = (liveModBom?.cutList || []).filter((cp) => cp.moduleId === mod.id);
          const compById = new Map(breakdown.components.map((c) => [c.id, c]));
          const compByLabel = new Map(breakdown.components.map((c) => [c.label, c]));
          const buckets: Record<"d5" | "d8" | "d15" | "d35" | "cable", THREE.Matrix4[]> = {
            d5: [],
            d8: [],
            d15: [],
            d35: [],
            cable: [],
          };
          const matLookup = {
            d5: xrayHoleMatD5,
            d8: xrayHoleMatD8,
            d15: xrayHoleMatD15,
            d35: xrayHoleMatD35,
            cable: xrayHoleMatCable,
          } as const;
          const dummy = new THREE.Object3D();

          // Map shelf components for real-time 60 FPS drag-sync of shelf & mating side/divider holes!
          const shelfComps = breakdown.components.filter((c) => c.role === "shelf");
          const shelfHoleGroupById = new Map<string, THREE.Group>();
          const getOrCreateShelfHoleGroup = (shelfId: string) => {
            let grp = shelfHoleGroupById.get(shelfId);
            if (!grp) {
              grp = new THREE.Group();
              grp.userData = { componentId: `${shelfId}_xray_holes`, shelfOwnerId: shelfId };
              grp.raycast = () => {};
              shelfHoleGroupById.set(shelfId, grp);
              modContainer.add(grp);
            }
            return grp;
          };

          let moduleHasAnyLedInXray = false;

          modPieces.forEach((piece) => {
            const comp =
              compById.get(piece.id) ||
              compByLabel.get(piece.pieceName) ||
              breakdown.components.find(
                (c) =>
                  c.role === (piece as unknown as { role?: string }).role &&
                  Math.abs(c.dimensions.width - piece.widthMm) <= 25 &&
                  Math.abs(c.dimensions.height - piece.lengthMm) <= 25
              );
            if (!comp) return;
            const px = comp.position.x;
            const py = comp.position.y;
            const pz = comp.position.z;
            const cw = comp.dimensions.width;
            const ch = comp.dimensions.height;
            const cd = comp.dimensions.depth;
            const isSidePanel = cw <= 32 && ch > 100 && cd > 100;
            const isHorizPanel = ch <= 36 && cw > 100 && cd > 100;
            const isShelfComp = comp.role === "shelf";

            (piece.holes || []).forEach((h) => {
              const isCableHole = h.purpose === "cable_exit" || (h.diameter >= 9 && h.diameter <= 11 && h.id.includes("led")) || h.id.includes("_drw_runner_");
              if (isCableHole) moduleHasAnyLedInXray = true;
              const bucketKey: "d5" | "d8" | "d15" | "d35" | "cable" = isCableHole
                ? "cable"
                : h.diameter >= 28
                ? "d35"
                : h.diameter >= 13
                ? "d15"
                : h.diameter >= 7
                ? "d8"
                : "d5";
              const depthMm = Math.max(8, Math.min(34, h.depth || 13));
              dummy.rotation.set(0, 0, 0);
              let holeWy = py + ch * 0.5;
              const isDrawerSide =
                comp.role === "drawer_side_left" || comp.role === "drawer_side_right";
              if (isDrawerSide) {
                // Wooden drawer sides: local x = side height (3D Y), local y = box depth from front to back (3D Z)
                const wy = py + Math.min(ch - 6, Math.max(6, h.x));
                holeWy = wy;
                const wz = pz + Math.min(cd - 6, Math.max(6, cd - h.y));
                if (h.direction.startsWith("edge_")) {
                  dummy.rotation.x = Math.PI / 2;
                  dummy.position.set(px + cw * 0.5, wy, wz);
                  dummy.scale.set(h.diameter, depthMm, h.diameter);
                } else {
                  dummy.rotation.z = Math.PI / 2;
                  dummy.position.set(px + cw * 0.5, wy, wz);
                  dummy.scale.set(h.diameter, depthMm, h.diameter);
                }
              } else if (isSidePanel) {
                const wx =
                  comp.role === "carcass_divider"
                    ? h.direction === "face_back"
                      ? px + cw - depthMm * 0.5
                      : px + depthMm * 0.5
                    : comp.role === "carcass_side_right"
                    ? px + depthMm * 0.5
                    : px + cw - depthMm * 0.5;
                const wy = py + Math.min(ch - 6, Math.max(6, h.y));
                holeWy = wy;
                const zFromBack = piece.mirrorInnerFaceX ? h.x : cd - h.x;
                const wz = pz + Math.min(cd - 6, Math.max(6, zFromBack));
                if (h.direction.startsWith("edge_")) {
                  dummy.position.set(px + cw * 0.5, wy, wz);
                  dummy.scale.set(h.diameter, depthMm, h.diameter);
                } else {
                  dummy.rotation.z = Math.PI / 2;
                  dummy.position.set(wx, wy, wz);
                  dummy.scale.set(h.diameter, depthMm, h.diameter);
                }
              } else if (isHorizPanel) {
                const spanCoord = h.y;
                const depthCoord = h.x;
                const wx = px + Math.min(cw - 6, Math.max(6, spanCoord));
                const wz = pz + Math.min(cd - 6, Math.max(6, cd - depthCoord));
                if (h.direction.startsWith("edge_")) {
                  dummy.rotation.z = Math.PI / 2;
                  dummy.position.set(
                    spanCoord < cw * 0.5 ? px + depthMm * 0.5 : px + cw - depthMm * 0.5,
                    py + ch * 0.5,
                    wz
                  );
                  dummy.scale.set(h.diameter, depthMm, h.diameter);
                } else {
                  dummy.position.set(wx, py + ch * 0.5, wz);
                  dummy.scale.set(h.diameter, depthMm, h.diameter);
                }
              } else {
                const isWideDrawerPanel =
                  (comp.role === "drawer_back" || comp.role === "drawer_front") && cw > ch;
                const rawX = isWideDrawerPanel ? h.y : h.x;
                const rawY = isWideDrawerPanel ? h.x : h.y;
                const wx = px + Math.min(cw - 6, Math.max(6, rawX));
                const wy = py + Math.min(ch - 6, Math.max(6, rawY));
                holeWy = wy;
                dummy.rotation.x = Math.PI / 2;
                dummy.position.set(wx, wy, pz + cd * 0.5);
                dummy.scale.set(h.diameter, depthMm, h.diameter);
              }
              dummy.updateMatrix();

              // V116: Bind shelf holes AND mating side/divider fixed-shelf bolts to the owning shelf's live drag group
              // so minifix & dowel holes glide smoothly in real time while dragging a shelf in X-Ray!
              let attachedShelfId: string | null = isShelfComp ? comp.id : null;
              if (
                !attachedShelfId &&
                isSidePanel &&
                (h.id.includes("_fs_") || h.id.includes("_div_lfs_") || h.id.includes("_div_rfs_") || h.id.includes("_rafix_") || h.id.includes("_tj_"))
              ) {
                const matchedShelf = shelfComps.find((sc) => {
                  const scMidY = sc.position.y + sc.dimensions.height * 0.5;
                  if (Math.abs(scMidY - holeWy) > 12) return false;
                  const touchesLeft = Math.abs(sc.position.x - (px + cw)) <= 12;
                  const touchesRight = Math.abs(sc.position.x + sc.dimensions.width - px) <= 12;
                  return touchesLeft || touchesRight;
                });
                if (matchedShelf) attachedShelfId = matchedShelf.id;
              }

              const drwRunnerMatch = h.id.match(/_drw_runner_(.+)_\d+$/);
              if (drwRunnerMatch) {
                const drwId = drwRunnerMatch[1];
                const hMesh = new THREE.Mesh(xrayHoleUnitCylinder, xrayHoleMatCable);
                hMesh.position.copy(dummy.position);
                hMesh.rotation.copy(dummy.rotation);
                hMesh.scale.copy(dummy.scale);
                hMesh.raycast = () => {};
                hMesh.renderOrder = 25;
                hMesh.userData = { componentId: `${drwId}_xray_runner_hole` };
                modContainer.add(hMesh);
              } else if (attachedShelfId) {
                const hMesh = new THREE.Mesh(xrayHoleUnitCylinder, matLookup[bucketKey]);
                hMesh.position.copy(dummy.position);
                hMesh.rotation.copy(dummy.rotation);
                hMesh.scale.copy(dummy.scale);
                hMesh.raycast = () => {};
                hMesh.renderOrder = 25;
                getOrCreateShelfHoleGroup(attachedShelfId).add(hMesh);
              } else {
                buckets[bucketKey].push(dummy.matrix.clone());
              }
            });

            // Visualize Back-Panel Grooves in X-Ray mode (Purple)
            if (piece.hasBackGroove && (isSidePanel || isHorizPanel)) {
              const grooveMesh = new THREE.Mesh(
                isSidePanel
                  ? new THREE.BoxGeometry(8, Math.max(40, ch - 12), 8.5)
                  : new THREE.BoxGeometry(Math.max(40, cw - 12), 8, 8.5),
                xrayGrooveMat
              );
              grooveMesh.raycast = () => {};
              grooveMesh.renderOrder = 24;
              const gOff = piece.backGrooveOffsetMm ? Math.max(8, piece.backGrooveOffsetMm - 4) : 16;
              grooveMesh.position.set(
                isSidePanel ? (comp.role === "carcass_side_right" ? px + 4 : px + cw - 4) : px + cw * 0.5,
                py + ch * 0.5,
                pz + gOff
              );
              modContainer.add(grooveMesh);
            }

            // V116: Visualize Recessed LED Milling Grooves in X-Ray mode (Bright Amber-Gold #FACC15)
            if (piece.ledGrooveSpec?.enabled && (isSidePanel || isHorizPanel)) {
              moduleHasAnyLedInXray = true;
              const gw = Math.max(8, piece.ledGrooveSpec.widthMm || 10);
              const gd = Math.max(6, piece.ledGrooveSpec.depthMm || 8);
              const ledOff = piece.ledGrooveSpec.offsetFromFrontMm || 30;
              const ledMesh = new THREE.Mesh(
                isSidePanel
                  ? new THREE.BoxGeometry(gd, Math.max(40, ch - 24), gw)
                  : new THREE.BoxGeometry(Math.max(40, cw - 16), gd, gw),
                xrayLedGrooveMat
              );
              ledMesh.raycast = () => {};
              ledMesh.renderOrder = 25;
              ledMesh.position.set(
                isSidePanel ? (comp.role === "carcass_side_right" ? px + gd * 0.5 : px + cw - gd * 0.5) : px + cw * 0.5,
                isSidePanel ? py + ch * 0.5 : py + gd * 0.5,
                pz + Math.max(24, cd - ledOff)
              );
              if (isShelfComp) {
                getOrCreateShelfHoleGroup(comp.id).add(ledMesh);
              } else {
                modContainer.add(ledMesh);
              }
            }
          });

          // V116: Highlight LED fittings & render compact 24V LED Driver box at top-rear service cavity in X-Ray!
          breakdown.components.forEach((fComp) => {
            if (fComp.id.includes("led") || fComp.label.toLowerCase().includes("led")) {
              moduleHasAnyLedInXray = true;
              const lm = new THREE.Mesh(
                new THREE.BoxGeometry(
                  Math.max(8, fComp.dimensions.width),
                  Math.max(8, fComp.dimensions.height),
                  Math.max(8, fComp.dimensions.depth)
                ),
                xrayLedGrooveMat
              );
              lm.position.set(
                fComp.position.x + fComp.dimensions.width * 0.5,
                fComp.position.y + fComp.dimensions.height * 0.5,
                fComp.position.z + fComp.dimensions.depth * 0.5
              );
              lm.raycast = () => {};
              lm.renderOrder = 25;
              modContainer.add(lm);
            }
          });
          if (moduleHasAnyLedInXray) {
            const drvW = Math.min(180, Math.max(110, mod.dimensions.width * 0.16));
            const drvMesh = new THREE.Mesh(new THREE.BoxGeometry(drvW, 28, 52), xrayLedDriverMat);
            drvMesh.position.set(mod.dimensions.width * 0.5, mod.dimensions.height + 16, 42);
            drvMesh.raycast = () => {};
            drvMesh.renderOrder = 24;
            const drvEdge = new THREE.LineSegments(
              new THREE.EdgesGeometry(new THREE.BoxGeometry(drvW, 28, 52)),
              new THREE.LineBasicMaterial({ color: 0xfacc15 })
            );
            drvEdge.position.copy(drvMesh.position);
            drvEdge.raycast = () => {};
            modContainer.add(drvMesh, drvEdge);
          }

          // V107/V116: Visualize Drawer Box Bottom Grooves (tagged to drawer for live drag sync!)
          breakdown.components.forEach((dComp) => {
            if (dComp.role === "drawer_bottom" || dComp.id.endsWith("_bottom")) {
              const dw = dComp.dimensions.width;
              const dd = dComp.dimensions.depth;
              const dy = dComp.position.y + 4;
              const dx = dComp.position.x;
              const dz = dComp.position.z;
              const baseDrwId = dComp.id.replace(/_bottom$/, "");
              const dGrp = new THREE.Group();
              dGrp.userData = { componentId: `${baseDrwId}_xray_groove` };
              dGrp.raycast = () => {};
              [
                { w: 6, d: Math.max(40, dd), x: dx + 3, z: dz + dd * 0.5 },
                { w: 6, d: Math.max(40, dd), x: dx + dw - 3, z: dz + dd * 0.5 },
                { w: Math.max(40, dw), d: 6, x: dx + dw * 0.5, z: dz + 3 },
                { w: Math.max(40, dw), d: 6, x: dx + dw * 0.5, z: dz + dd - 3 },
              ].forEach((seg) => {
                const dg = new THREE.Mesh(new THREE.BoxGeometry(seg.w, 6.5, seg.d), xrayGrooveMat);
                dg.position.set(seg.x, dy, seg.z);
                dg.raycast = () => {};
                dg.renderOrder = 24;
                dGrp.add(dg);
              });
              modContainer.add(dGrp);
            }
          });

          (["d5", "d8", "d15", "d35", "cable"] as const).forEach((bk) => {
            const list = buckets[bk];
            if (!list.length) return;
            const inst = new THREE.InstancedMesh(xrayHoleUnitCylinder, matLookup[bk], list.length);
            inst.raycast = () => {};
            inst.renderOrder = 25;
            list.forEach((mtx, idx) => inst.setMatrixAt(idx, mtx));
            inst.instanceMatrix.needsUpdate = true;
            modContainer.add(inst);
          });
        }
        meshGroup.add(modContainer);
      });

      // Render 3D Spatial Engineering Error, Module-to-Module Collision & Warning Beacons inside `engineeringBeaconGroupRef`
      const beaconHolder = engineeringBeaconGroupRef.current;
      if (beaconHolder) {
        disposeObject3DTree(beaconHolder);
        beaconHolder.clear();

        type SpatialBeaconEntry = {
          code: string;
          severity: "error" | "warning" | "info";
          title: string;
          message: string;
          suggestions: string[];
          remediationProposals: any[];
          moduleIndex: number;
          bayIndex: number;
          wp: { x: number; y: number; z: number };
          overlapBox?: { cx: number; cy: number; cz: number; w: number; h: number; d: number };
        };
        const beaconEntries: SpatialBeaconEntry[] = [];
        const seenBeacons = new Set<string>();

        // A. Direct real-time 3D AABB module-to-module intersection detector (red marker + red volume at EXACT intersection!)
        const mods = project.modules || [];
        for (let i = 0; i < mods.length; i++) {
          const mA = mods[i];
          if (!mA || mA.category === "complementary") continue;
          const fpA = getModuleOrientedFootprint(mA, 0);
          const aMinX = fpA.x;
          const aMaxX = fpA.x + fpA.planWidth;
          const aMinZ = fpA.z;
          const aMaxZ = fpA.z + fpA.planDepth;
          const aMinY = mA.position.y || 0;
          const aMaxY = aMinY + mA.dimensions.height;
          for (let j = i + 1; j < mods.length; j++) {
            const mB = mods[j];
            if (!mB || mB.category === "complementary") continue;
            const fpB = getModuleOrientedFootprint(mB, 0);
            const ox = Math.min(aMaxX, fpB.x + fpB.planWidth) - Math.max(aMinX, fpB.x);
            const oz = Math.min(aMaxZ, fpB.z + fpB.planDepth) - Math.max(aMinZ, fpB.z);
            const bMinY = mB.position.y || 0;
            const oy = Math.min(aMaxY, bMinY + mB.dimensions.height) - Math.max(aMinY, bMinY);
            if (ox > 8 && oz > 8 && oy > 8) {
              const cx = (Math.max(aMinX, fpB.x) + Math.min(aMaxX, fpB.x + fpB.planWidth)) * 0.5;
              const cy = (Math.max(aMinY, bMinY) + Math.min(aMaxY, bMinY + mB.dimensions.height)) * 0.5;
              const cz = (Math.max(aMinZ, fpB.z) + Math.min(aMaxZ, fpB.z + fpB.planDepth)) * 0.5;
              const k = `overlap_${i}_${j}`;
              seenBeacons.add(k);
              beaconEntries.push({
                code: "MODULE_COLLISION",
                severity: "error",
                title: "Modül Kesişimi / Çakışma",
                message: `"${mA.name}" ile "${mB.name}" ${Math.round(ox)}×${Math.round(oz)} mm kesişiyor.`,
                suggestions: ["Modüllerden birini sürükleyerek ayırın veya genişliğini daraltın."],
                remediationProposals: [],
                moduleIndex: j,
                bayIndex: 0,
                wp: { x: cx, y: cy, z: Math.max(aMaxZ, fpB.z + fpB.planDepth) + 18 },
                overlapBox: { cx, cy, cz, w: ox, h: oy, d: oz },
              });
            }
          }
        }

        // B. Unified Engineering Report findings (with exact worldPositionMm OR resolved from targetModuleId!)
        const engFindings = (live3DEngineeringReport?.findings || []).filter(
          (f) => f.severity === "error" || f.ruleNature === "VERIFICATION_REQUIRED" || f.severity === "warning"
        );
        engFindings.forEach((ef) => {
          const modIdxFound = project.modules.findIndex((m) => m.id === ef.targetModuleId);
          const safeModIdx = modIdxFound >= 0 ? modIdxFound : 0;
          const hostMod = project.modules[safeModIdx];
          let wp = ef.worldPositionMm;
          if (!wp && hostMod) {
            const fp = getModuleOrientedFootprint(hostMod, 0);
            wp = {
              x: fp.x + fp.planWidth * 0.5,
              y: (hostMod.position.y || 0) + hostMod.dimensions.height * 0.62,
              z: fp.z + fp.planDepth + 24,
            };
          }
          if (!wp) return;
          const key = `${ef.code}_${safeModIdx}_${Math.round(wp.x / 40)}_${Math.round(wp.y / 40)}`;
          if (seenBeacons.has(key)) return;
          seenBeacons.add(key);
          const bayMatch = String(ef.targetId || "").match(/bay_(\d+)/);
          beaconEntries.push({
            code: ef.code,
            severity: ef.severity === "error" ? "error" : "warning",
            title: formatEngineeringErrorCode(ef.code),
            message: ef.message,
            suggestions: ef.suggestions || [],
            remediationProposals: ef.remediationProposals || [],
            moduleIndex: safeModIdx,
            bayIndex: bayMatch ? Number(bayMatch[1]) : 0,
            wp,
          });
        });

        // C. Store validationIssues fallback (e.g., wall overflow, obstacle clash)
        const storeIssues = useConfiguratorStore.getState().validationIssues || [];
        storeIssues.forEach((vi) => {
          const viCompat = vi as typeof vi & { moduleId?: string; suggestion?: string };
          const modIdxFound = project.modules.findIndex((m) => m.id === viCompat.moduleId);
          const safeModIdx = modIdxFound >= 0 ? modIdxFound : activeModuleIndex;
          const hostMod = project.modules[safeModIdx] || project.modules[0];
          if (!hostMod) return;
          const key = `vi_${vi.code}_${safeModIdx}`;
          if (seenBeacons.has(key)) return;
          seenBeacons.add(key);
          const fp = getModuleOrientedFootprint(hostMod, 0);
          beaconEntries.push({
            code: vi.code || "VALIDATION_ERROR",
            severity: vi.severity === "error" ? "error" : "warning",
            title: formatEngineeringErrorCode(vi.code || "VALIDATION_ERROR"),
            message: vi.message,
            suggestions: viCompat.suggestion ? [viCompat.suggestion] : [],
            remediationProposals: [],
            moduleIndex: safeModIdx,
            bayIndex: 0,
            wp: {
              x: fp.x + fp.planWidth * 0.5,
              y: (hostMod.position.y || 0) + hostMod.dimensions.height * 0.78,
              z: fp.z + fp.planDepth + 28,
            },
          });
        });

        if (beaconEntries.length > 0) {
          const errBeaconGeo = new THREE.SphereGeometry(34, 20, 20);
          const errRingGeo = new THREE.RingGeometry(44, 62, 32);
          beaconEntries.slice(0, 18).forEach((ef, efIdx) => {
            const wp = ef.wp;
            const isHardErr = ef.severity === "error";
            const colHex = isHardErr ? 0xef4444 : 0xf59e0b;

            if (ef.overlapBox) {
              const ob = ef.overlapBox;
              const boxGeo = new THREE.BoxGeometry(ob.w + 6, ob.h + 6, ob.d + 6);
              const boxMesh = new THREE.Mesh(
                boxGeo,
                new THREE.MeshBasicMaterial({
                  color: 0xef4444,
                  transparent: true,
                  opacity: 0.28,
                  depthTest: false,
                })
              );
              boxMesh.position.set(ob.cx, ob.cy, ob.cz);
              boxMesh.renderOrder = 995;
              boxMesh.raycast = () => {};
              beaconHolder.add(boxMesh);

              const boxEdge = new THREE.LineSegments(
                new THREE.EdgesGeometry(boxGeo),
                new THREE.LineBasicMaterial({
                  color: 0xff3b30,
                  transparent: true,
                  opacity: 0.96,
                  depthTest: false,
                })
              );
              boxEdge.position.set(ob.cx, ob.cy, ob.cz);
              boxEdge.renderOrder = 996;
              boxEdge.raycast = () => {};
              beaconHolder.add(boxEdge);
            }

            const beaconMat = new THREE.MeshBasicMaterial({
              color: colHex,
              transparent: true,
              opacity: 0.96,
              depthTest: false,
            });
            const beaconMesh = new THREE.Mesh(
              efIdx === 0 ? errBeaconGeo : errBeaconGeo.clone(),
              beaconMat
            );
            beaconMesh.position.set(wp.x, wp.y, wp.z + 24);
            beaconMesh.renderOrder = 999;
            beaconMesh.userData = {
              isEngineeringBeacon: true,
              findingCode: ef.code,
              findingSeverity: ef.severity,
              findingTitle: ef.title,
              findingMessage: ef.message,
              findingSuggestions: ef.suggestions,
              remediationProposals: ef.remediationProposals,
              moduleIndex: ef.moduleIndex,
              bayIndex: ef.bayIndex,
            };
            beaconHolder.add(beaconMesh);

            const ringMat = new THREE.MeshBasicMaterial({
              color: colHex,
              side: THREE.DoubleSide,
              transparent: true,
              opacity: 0.72,
              depthTest: false,
            });
            const ringMesh = new THREE.Mesh(
              efIdx === 0 ? errRingGeo : errRingGeo.clone(),
              ringMat
            );
            ringMesh.position.set(wp.x, wp.y, wp.z + 25);
            ringMesh.renderOrder = 998;
            ringMesh.raycast = () => {};
            beaconHolder.add(ringMesh);

            // V48: Interior clash visual 3D red danger highlight zone so intersecting shelves/dividers/racks stand out immediately
            if (
              ef.code === "ERR_SUBDIVIDER_INTERIOR_CLASH" ||
              ef.code === "ERR_SHELF_INTERIOR_CLASH" ||
              ef.code === "ERR_INTERNAL_COMPONENTS_OVERLAP"
            ) {
              const clashBoxGeo = new THREE.BoxGeometry(240, 110, 220);
              const clashBoxMat = new THREE.MeshBasicMaterial({
                color: 0xef4444,
                transparent: true,
                opacity: 0.22,
                depthTest: false,
                depthWrite: false,
              });
              const clashBox = new THREE.Mesh(clashBoxGeo, clashBoxMat);
              clashBox.position.set(wp.x, wp.y, wp.z);
              clashBox.renderOrder = 996;
              clashBox.raycast = () => {};
              clashBox.add(
                new THREE.LineSegments(
                  new THREE.EdgesGeometry(clashBoxGeo),
                  new THREE.LineBasicMaterial({
                    color: 0xf87171,
                    transparent: true,
                    opacity: 0.9,
                    depthTest: false,
                  })
                )
              );
              beaconHolder.add(clashBox);
            }
          });
        }
      }
      reusableGroupsBySig.forEach((leftovers) => {
        leftovers.forEach((unusedGroup) => disposeObject3DTree(unusedGroup));
      });

      if (rendererRef.current) publishSceneDiagnostics(rendererRef.current.domElement, meshGroup);
      updateSelectionFramesRef.current();
      markShadowsAndRender();
    }, [
      project,
      doorOpenAngleDeg,
      drawerOpenMm,
      toggleDoorOpen,
      setDrawerOpenMm,
      explodedFactor,
      cutawayActiveBay ? activeModuleIndex : -1,
      cutawayActiveBay ? activeBayIndex : -1,
      doorsHiddenIn3D,
      section3DAxis,
      effectiveDoorsHiddenIn3D,
      cutawayActiveBay,
      theme,
      renderEdgeMode,
      isXrayActive,
      isStoreBatchDragging,
      paused,
      isXrayActive ? storeBom : null,
      requestRender,
      GEOMETRY_ENGINE_REV,
    ]);

    // Dedicated O(1) Interior Wardrobe Styling Props Layer (`Eşyalar`) — Decoupled from Cabinet Mesh Rebuilds!
    useEffect(() => {
      if (paused) return;
      const propsRoot = interiorPropsGroupRef.current;
      if (!propsRoot) return;

      // Instant 0.01ms GPU visibility toggle without disposing or rebuilding any prop geometry!
      if (!showInteriorProps3D || renderEdgeMode === "cad" || isXrayActive) {
        if (propsRoot.visible) {
          propsRoot.visible = false;
          requestRender();
        }
        return;
      }

      // Skip expensive geometry rebuilds during active batch drags, BUT always sync live module transforms so open-wardrobe belongings move 1:1!
      if (isStoreBatchDragging) {
        let movedDuringBatch = false;
        for (const holder of propsRoot.children) {
          const mId = holder.userData?.moduleId;
          const mIdx = holder.userData?.moduleIndex;
          const mod =
            (typeof mId === "string" ? project.modules.find((m) => m.id === mId) : undefined) ||
            (typeof mIdx === "number" ? project.modules[mIdx] : undefined);
          if (!mod) continue;
          const pl = calculateModulePlacement(mod);
          if (
            Math.abs(holder.position.x - pl.origin.x) > 0.05 ||
            Math.abs(holder.position.y - pl.origin.y) > 0.05 ||
            Math.abs(holder.position.z - pl.origin.z) > 0.05 ||
            Math.abs(holder.rotation.y - pl.rotationYRad) > 0.0005
          ) {
            holder.position.set(pl.origin.x, pl.origin.y, pl.origin.z);
            holder.rotation.y = pl.rotationYRad;
            holder.updateMatrix();
            holder.updateMatrixWorld(true);
            movedDuringBatch = true;
          }
        }
        if (movedDuringBatch) {
          requestRender();
        }
        return;
      }

      propsRoot.visible = true;
      const isMultiModuleScene = project.modules.length > 2;
      const maxGarmentsPerRail = isMultiModuleScene ? 2 : 3;

      const nextHolders: THREE.Group[] = [];

      project.modules.forEach((mod, modIdx) => {
        if (mod.category === "complementary" || mod.bays.length < 1) return;

        const isModPropsVisible =
          effectiveDoorsHiddenIn3D ||
          (cutawayActiveBay && modIdx === activeModuleIndex) ||
          doorOpenAngleDeg > 8 ||
          Boolean(mod.isOpenFront) ||
          mod.bays.some(
            (b) =>
              b.door.type === "open" ||
              b.door.doorSystemId === "open" ||
              Boolean(b.door.isGlassFramed) ||
              b.door.crossSectionProfile === "glass_frame" ||
              b.door.crossSectionProfile === "center_glass_frame" ||
              b.door.crossSectionProfile === "u_glass_open_top" ||
              String(b.door.doorMaterialId || "").includes("glass")
          );

        if (!isModPropsVisible) return;

        // Compact, deterministic string signature (avoids expensive JSON.stringify on full bay objects!)
        const T = mod.carcass.panelThickness || 18;
        const plinthH = mod.carcass.plinthHeight ?? 100;
        let interiorPropsSig = `${mod.id}|${mod.dimensions.width}x${mod.dimensions.height}x${mod.dimensions.depth}|${mod.moduleSubType || ""}|${T}:${plinthH}:G${maxGarmentsPerRail}:R${glbCatalogRev}`;
        for (let b = 0; b < mod.bays.length; b++) {
          const bay = mod.bays[b];
          const sPart = (bay.shelves || []).map((sh) => `${sh.elevationY}:${sh.isHidden ? 1 : 0}`).join(",");
          const rPart = (bay.hangingRails || []).map((hr) => `${hr.elevationY}:${hr.isHidden ? 1 : 0}`).join(",");
          const dPart = (bay.drawers || []).map((dr) => `${dr.elevationY}:${dr.height}`).join(",");
          const fPart = (bay.specialFittings || [])
            .filter((sf) => sf.type === "shoe_rack" && !sf.isHidden)
            .map((sf) => `${sf.elevationY}`)
            .join(",");
          interiorPropsSig += `|B${b}(${bay.customWidth ?? ""}:${bay.widthRatio ?? ""}:${bay.door?.slidingMountingType || bay.door?.doorSystemId || ""}|S[${sPart}]|R[${rPart}]|D[${dPart}]|F[${fPart}])`;
        }

        let modPropsHolder = lifestylePropsCacheRef.current.get(interiorPropsSig);
        if (!modPropsHolder) {
          modPropsHolder = new THREE.Group();
          modPropsHolder.name = `v3_cached_lifestyle_props_${mod.id}`;
          modPropsHolder.userData = { isSharedCachedProps: true };
          modPropsHolder.raycast = () => {};

          const breakdown = generateModuleGeometry(mod, {
            doorOpenAngleDeg: 0,
            drawerOpenMm: 0,
            explodedFactor: 0,
          });
          const innerH =
            breakdown.netInnerHeight || Math.max(300, mod.dimensions.height - plinthH - 2 * T);
          const modD = mod.dimensions.depth;
          let bayStartX = T;

          const hasInsetSliding = mod.bays.some(
            (b) =>
              b.door?.slidingMountingType === "inset_inside" ||
              b.door?.doorSystemId === "sliding_bottom_rolling"
          );
          const isCornerSubType =
            Boolean(mod.isCorner) ||
            mod.moduleSubType === "l_corner" ||
            mod.moduleSubType === "corner_wardrobe" ||
            mod.moduleSubType === "blind_corner";

          mod.bays.forEach((bayObj, bIdx) => {
            const bw =
              breakdown.bayWidths[bIdx] ||
              Math.round((mod.dimensions.width - (mod.bays.length + 1) * T) / mod.bays.length);
            const propsGroup = new THREE.Group();
            propsGroup.name = `v3_lifestyle_props_bay_${bIdx}`;
            propsGroup.raycast = () => {};

            const bayRailComps = breakdown.components.filter(
              (c) =>
                c.role === "hanging_rail" &&
                c.bayIndex === bIdx &&
                c.dimensions.width >= c.dimensions.depth
            );
            const effectiveModD = isCornerSubType ? Math.min(modD, 600) : modD;
            const frontSafeZ = hasInsetSliding ? effectiveModD - 66 : effectiveModD - 22;
            const backSafeZ = T + 14;
            const centerZ = (backSafeZ + frontSafeZ) * 0.5;

            const sortedShelves = [...(bayObj.shelves || [])]
              .filter((sh) => !sh.isHidden)
              .sort((a, b) => a.elevationY - b.elevationY);
            const sortedRails = [...(bayObj.hangingRails || [])]
              .filter((hr) => !hr.isHidden)
              .sort((a, b) => (a.elevationY || 0) - (b.elevationY || 0));

            sortedRails.forEach((rail, rIdx) => {
              const rawRailElev = rail.elevationY || 1650;
              const clampedRailElev = Math.max(
                48,
                Math.min(Math.max(80, innerH - 36), rawRailElev)
              );
              const matchedRailComp =
                bayRailComps.find((rc) => rc.id === rail.id) || bayRailComps[rIdx];

              const railStartX = matchedRailComp ? matchedRailComp.position.x : bayStartX;
              const railSpanW = matchedRailComp ? matchedRailComp.dimensions.width : bw;
              const railCenterY = matchedRailComp
                ? matchedRailComp.position.y + matchedRailComp.dimensions.height * 0.5
                : plinthH + T + clampedRailElev + 12.5;
              const railCenterZ = matchedRailComp
                ? matchedRailComp.position.z + matchedRailComp.dimensions.depth * 0.5
                : effectiveModD * 0.5 + 0.5;

              const obstaclesBelow = [
                0,
                ...sortedShelves
                  .filter((sh) => sh.elevationY < clampedRailElev - 140)
                  .map((sh) => {
                    const gapAboveShelf = clampedRailElev - (sh.elevationY + T);
                    const hasBoxUnderRail = gapAboveShelf > 720 && bw >= 420;
                    return sh.elevationY + T + (hasBoxUnderRail ? 152 : 0);
                  }),
                ...sortedRails
                  .filter((r) => (r.elevationY || 0) < clampedRailElev - 220)
                  .map((r) => (r.elevationY || 0) + 34),
                ...(bayObj.drawers || [])
                  .filter((d) => (d.elevationY || 0) < clampedRailElev - 100)
                  .map((d) => (d.elevationY || 0) + d.height + 18),
              ];
              const floorObstacleY = Math.max(...obstaclesBelow);
              const clearDropMm = clampedRailElev + 12.5 - floorObstacleY - 22;
              if (clearDropMm < 330 || railSpanW < 210 || effectiveModD < 340) return;

              const safeClearDepthZ = Math.max(
                180,
                2 * Math.min(railCenterZ - backSafeZ, frontSafeZ - railCenterZ)
              );

              const sidePadX = 82;
              const innerSpanX = railSpanW - sidePadX * 2;
              const minStepX = 225;
              const garmentCount =
                innerSpanX < 20
                  ? 1
                  : Math.max(1, Math.min(maxGarmentsPerRail, 1 + Math.floor(innerSpanX / minStepX)));

              for (let g = 0; g < garmentCount; g++) {
                const gx =
                  garmentCount === 1
                    ? railStartX + railSpanW * 0.5
                    : railStartX +
                      sidePadX +
                      ((g + 0.5) / garmentCount) * Math.max(0, railSpanW - sidePadX * 2 + 28) -
                      14;
                const clearLeft = gx - (railStartX + 12);
                const clearRight = railStartX + railSpanW - 12 - gx;
                const neighborSlot =
                  garmentCount === 1
                    ? Math.min(clearLeft, clearRight) * 2
                    : (railSpanW - sidePadX * 2 + 28) / garmentCount - 16;
                const maxSlotWidthMm = Math.max(
                  88,
                  Math.min(neighborSlot, clearLeft * 2, clearRight * 2)
                );

                const desiredH = 835 + ((g + rIdx) % 3) * 26;
                const garmentH = Math.min(desiredH, clearDropMm);
                const shirtGrp = createSculptedHangingShirtGroup(
                  g + bIdx * 2 + rIdx,
                  garmentH,
                  safeClearDepthZ,
                  maxSlotWidthMm
                );
                shirtGrp.position.set(gx, railCenterY, railCenterZ);
                shirtGrp.userData = {
                  ...shirtGrp.userData,
                  propOwnerKind: "rail",
                  propBayIndex: bIdx,
                  propOwnerId: rail.id,
                  propOwnerIdx: rIdx,
                };
                propsGroup.add(shirtGrp);
              }
            });

            sortedShelves.forEach((sh, sIdx) => {
              const shelfTopLocalY = sh.elevationY + (sh.thickness || T);
              const shelfTopWorldY = plinthH + T + shelfTopLocalY;
              const nextShelf = sortedShelves[sIdx + 1];
              const ceilingLocalY = nextShelf ? nextShelf.elevationY : innerH;
              const clearHeadroom = ceilingLocalY - shelfTopLocalY;
              const railInsideSpace = sortedRails.some(
                (r) =>
                  (r.elevationY || 0) > shelfTopLocalY + 60 &&
                  (r.elevationY || 0) < ceilingLocalY - 40 &&
                  clearHeadroom > 520
              );
              if (bw < 310 || modD < 300 || clearHeadroom < 135) return;

              const isTopmostLuggageShelf = !nextShelf && sh.elevationY > innerH * 0.68;

              const tagShelfProp = (grp: THREE.Object3D) => {
                grp.userData = {
                  ...grp.userData,
                  propOwnerKind: "shelf",
                  propBayIndex: bIdx,
                  propOwnerId: sh.id,
                  propOwnerIdx: sIdx,
                };
                propsGroup.add(grp);
              };
              if (isTopmostLuggageShelf) {
                const boxH = Math.min(155, clearHeadroom - 28);
                const boxD = Math.min(330, modD - 105);
                if (bw >= 680 && !isMultiModuleScene) {
                  const boxW = Math.min(300, bw * 0.41);
                  [-0.24, 0.24].forEach((frac) => {
                    const bGrp = createLiddedStorageBoxGroup(boxW, boxH, boxD);
                    bGrp.position.set(bayStartX + bw * (0.5 + frac), shelfTopWorldY, centerZ);
                    tagShelfProp(bGrp);
                  });
                } else {
                  const boxW = Math.min(330, bw * 0.64);
                  const bGrp = createLiddedStorageBoxGroup(boxW, boxH, boxD);
                  bGrp.position.set(bayStartX + bw * 0.5, shelfTopWorldY, centerZ);
                  tagShelfProp(bGrp);
                }
              } else if (!railInsideSpace) {
                if (sIdx % 2 === 0) {
                  const layers = clearHeadroom >= 210 ? 3 : 2;
                  const stackW = Math.min(345, bw >= 640 ? bw * 0.44 : bw * 0.68);
                  const stackD = Math.min(350, modD - 95);
                  const knitGrp = createFoldedKnitwearStackGroup(
                    stackW,
                    stackD,
                    layers,
                    bIdx + sIdx
                  );
                  knitGrp.position.set(
                    bw >= 640 && !isMultiModuleScene ? bayStartX + bw * 0.29 : bayStartX + bw * 0.5,
                    shelfTopWorldY,
                    centerZ
                  );
                  tagShelfProp(knitGrp);

                  if (bw >= 640 && clearHeadroom >= 165 && !isMultiModuleScene) {
                    const boxW = Math.min(270, bw * 0.39);
                    const boxH = Math.min(148, clearHeadroom - 24);
                    const boxD = Math.min(320, modD - 105);
                    const bGrp = createLiddedStorageBoxGroup(boxW, boxH, boxD);
                    bGrp.position.set(bayStartX + bw * 0.73, shelfTopWorldY, centerZ);
                    tagShelfProp(bGrp);
                  }
                } else {
                  const boxW = Math.min(330, bw * 0.64);
                  const boxH = Math.min(150, clearHeadroom - 26);
                  const boxD = Math.min(325, modD - 105);
                  const bGrp = createLiddedStorageBoxGroup(boxW, boxH, boxD);
                  bGrp.position.set(bayStartX + bw * 0.5, shelfTopWorldY, centerZ);
                  tagShelfProp(bGrp);
                }
              } else if (clearHeadroom > 720 && bw >= 420) {
                const boxW = Math.min(300, bw * 0.56);
                const boxH = 138;
                const boxD = Math.min(315, modD - 115);
                const bGrp = createLiddedStorageBoxGroup(boxW, boxH, boxD);
                bGrp.position.set(bayStartX + bw * 0.48, shelfTopWorldY, centerZ);
                tagShelfProp(bGrp);
              }
            });

            const shoeRacks = (bayObj.specialFittings || []).filter(
              (f) => f.type === "shoe_rack" && !f.isHidden
            );
            const rackDepthMm = Math.max(120, modD - 54);
            const rackCenterZ = 24 + rackDepthMm * 0.5;
            const maxShoeDepthMm = Math.min(
              Math.max(200, frontSafeZ - backSafeZ - 24),
              Math.max(190, rackDepthMm * 0.72)
            );
            const rackTiltRad = 0.22; // Matches componentMesh.ts _fitting_shoe_rack inclinedGroup.rotation.x
            shoeRacks.forEach((sr, srIdx) => {
              const fitH = Math.max(65, sr.height || 85);
              // componentMesh.ts places inclinedGroup at cy + 8, support chrome bars at local y = 4 with radius 5 -> local top y = fitH/2 + 17
              // Shift shoe slightly back (-14mm along Z) so toes sit cleanly behind the raised front stop bar (+d*0.36)
              const zBackShift = -14;
              const slopeLiftY = -zBackShift * Math.sin(rackTiltRad);
              const rackWorldY = plinthH + T + (sr.elevationY || 180) + fitH * 0.5 + 17 + slopeLiftY;
              const pairCount = isMultiModuleScene ? 1 : Math.max(1, Math.min(2, Math.floor((bw - 40) / 285)));
              const stepP = (bw - 50) / pairCount;
              for (let p = 0; p < pairCount; p++) {
                const shoePair = createSculptedShoePairGroup(p + srIdx + bIdx, maxShoeDepthMm);
                shoePair.position.set(
                  bayStartX + 25 + stepP * (p + 0.5),
                  rackWorldY,
                  rackCenterZ + zBackShift
                );
                shoePair.rotation.x = rackTiltRad;
                shoePair.userData = {
                  ...shoePair.userData,
                  propOwnerKind: "special_fitting",
                  propBayIndex: bIdx,
                  propOwnerId: sr.id,
                  propOwnerIdx: srIdx,
                };
                propsGroup.add(shoePair);
              }
            });

            const hasLowDrawer = (bayObj.drawers || []).some((d) => (d.elevationY || 0) < 280);
            const hasLowShoeRack = shoeRacks.some((sr) => (sr.elevationY || 0) < 260);
            const hasLowHangingShirtsToFloor = sortedRails.some(
              (r) => (r.elevationY || 0) > 650 && (r.elevationY || 0) < 1150 && !hasLowDrawer
            );
            if (
              !hasLowDrawer &&
              !hasLowShoeRack &&
              !hasLowHangingShirtsToFloor &&
              bIdx % 2 === 0 &&
              bw >= 420 &&
              mod.dimensions.height >= 1400
            ) {
              const floorTopY = plinthH + T;
              const shoePair = createSculptedShoePairGroup(bIdx, maxShoeDepthMm);
              shoePair.position.set(bayStartX + bw * 0.5, floorTopY, centerZ + 6);
              propsGroup.add(shoePair);
            }

            modPropsHolder!.add(propsGroup);
            bayStartX += bw + T;
          });

          freezeStaticObject3DSubtree(modPropsHolder, true);

          while (lifestylePropsCacheRef.current.size >= 32) {
            const oldestKey = lifestylePropsCacheRef.current.keys().next().value;
            if (!oldestKey) break;
            const evictedGrp = lifestylePropsCacheRef.current.get(oldestKey);
            lifestylePropsCacheRef.current.delete(oldestKey);
            if (evictedGrp && !evictedGrp.parent) {
              disposeObject3DTree(evictedGrp);
            }
          }
          lifestylePropsCacheRef.current.set(interiorPropsSig, modPropsHolder);
        }

        const pl = calculateModulePlacement(mod);
        modPropsHolder.position.set(pl.origin.x, pl.origin.y, pl.origin.z);
        modPropsHolder.rotation.y = pl.rotationYRad;
        modPropsHolder.visible = true;
        modPropsHolder.userData = {
          ...modPropsHolder.userData,
          isSharedCachedProps: true,
          moduleIndex: modIdx,
          moduleId: mod.id,
        };
        modPropsHolder.updateMatrix();
        modPropsHolder.updateMatrixWorld(true);
        modPropsHolder.matrixAutoUpdate = false;
        nextHolders.push(modPropsHolder);
      });

      propsRoot.clear();
      for (let i = 0; i < nextHolders.length; i++) {
        propsRoot.add(nextHolders[i]);
      }
      requestRender();
    }, [
      paused,
      project.modules,
      showInteriorProps3D,
      renderEdgeMode,
      isXrayActive,
      isStoreBatchDragging,
      effectiveDoorsHiddenIn3D,
      cutawayActiveBay,
      activeModuleIndex,
      doorOpenAngleDeg > 8,
      glbCatalogRev,
      requestRender,
    ]);

    useEffect(() => {
      return subscribeSceneObjectGlbLoaded(() => {
        setGlbRefreshTick((t) => t + 1);
      });
    }, []);

    useEffect(() => {
      if (paused) return;
      const grp = sceneObjectsGroupRef.current;
      if (!grp) return;
      const visibleObjs = (project.sceneObjects || []).filter((so) => !so.isHidden);
      const nextSigMap = new Map<string, string>();
      for (const sobj of visibleObjs) {
        nextSigMap.set(
          sobj.id,
          JSON.stringify({
            id: sobj.id,
            cat: sobj.catalogId,
            vk: sobj.visualKind,
            dims: sobj.dimensions,
            sc: sobj.scaleFactor || 1,
            pri: sobj.primaryColorHex,
            sec: sobj.secondaryColorHex,
            glb: sobj.glbUrl || sobj.localAssetKey || "",
            sel: selectedSceneObjectId === sobj.id,
            tick: glbRefreshTick,
          })
        );
      }

      const existingById = new Map<string, THREE.Object3D>();
      for (const child of [...grp.children]) {
        const cid = String(child.userData?.sceneObjectId || "");
        const prevSig = child.userData?.__sobjGeomSig;
        if (cid && prevSig && nextSigMap.get(cid) === prevSig) {
          existingById.set(cid, child);
        } else {
          grp.remove(child);
          disposeObject3DTree(child);
        }
      }
      grp.clear();

      for (const sobj of visibleObjs) {
        const reused = existingById.get(sobj.id);
        if (reused) {
          reused.position.set(sobj.position.x, sobj.position.y, sobj.position.z);
          const pivot = reused.children[0];
          if (pivot) {
            pivot.rotation.y = ((sobj.rotation?.y || 0) * Math.PI) / 180;
          }
          grp.add(reused);
        } else {
          const objMesh = buildSceneObject3DGroup(sobj, {
            isSelected: selectedSceneObjectId === sobj.id,
            renderer: rendererRef.current,
          });
          objMesh.userData.__sobjGeomSig = nextSigMap.get(sobj.id);
          grp.add(objMesh);
        }
      }
      requestRender();
    }, [paused, project.sceneObjects, selectedSceneObjectId, glbRefreshTick, requestRender]);

    // Fast Selection & Active Module Highlight WITHOUT rebuilding scene geometry
    useEffect(() => {
      if (paused) return;
      updateSelectionAndActiveFrames();
    }, [paused, selectedComponentId, activeModuleIndex, theme, renderEdgeMode, updateSelectionAndActiveFrames]);

    // Zero-WebGL-Reset In-Place Wireframe Toggle (< 0.5ms; preserves shared PBR materials & helper wireframes)
    const wasWireframeModeRef = useRef<boolean>(false);
    useEffect(() => {
      const grp = meshGroupRef.current;
      if (!grp) return;
      if (!isWireframeMode && !wasWireframeModeRef.current) return;
      wasWireframeModeRef.current = isWireframeMode;
      grp.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh || !mesh.material) return;
        if (mesh.userData?.role === "bay_compartment" || mesh.userData?.isSelectionHelper) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((mat) => {
          if ("wireframe" in mat) {
            const stdMat = mat as THREE.MeshStandardMaterial;
            if (stdMat.userData.__origWireframe === undefined) {
              stdMat.userData.__origWireframe = Boolean(stdMat.wireframe);
            }
            stdMat.wireframe = isWireframeMode ? true : Boolean(stdMat.userData.__origWireframe);
          }
        });
      });
      requestRender();
    }, [isWireframeMode, project.modules, requestRender]);

    // Separate useEffect for 3D Room Architecture so cabinet interior edits/drags never rebuild room walls/floors!
    useEffect(() => {
      if (paused) return;
      if (roomArchGroupRef.current) {
        disposeObject3DTree(roomArchGroupRef.current);
        roomArchGroupRef.current.clear();
      }
      const isLight = theme !== "dark";
      // Render 3D Architectural Backdrop Wall & Obstacles (Window, Plumbing, Door, Column, Beam)
      if (showRoomArchitecture3D) {
        const roomGroup = new THREE.Group();
        roomGroup.name = "v3_room_architecture_3d";
        const mainW = spaceWalls?.[0]?.length || 3600;
        const ceilH = project.space?.ceilingHeight || 2600;

        // Architectural Back Wall + Any Side Return Walls (L/U Kitchen or Left/Right Window Wall) + Floor Surface
        const activeWallTone = lightingPreset === "night_led" ? "anthracite_gallery" : wallTone;
        const wallTex = getArchitecturalWallTexture(activeWallTone);
        const wallNorm = getArchitecturalWallNormalMap(activeWallTone);
        const wallMat = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          map: wallTex || null,
          normalMap: wallNorm || null,
          normalScale: new THREE.Vector2(0.28, 0.28),
          roughness: 0.88,
          metalness: 0.02,
          envMapIntensity: 0.42,
          transparent: false,
          side: THREE.DoubleSide,
        });
        const skCfg3D = project.space.skirtingConfig;
        const skEnabled3D = skCfg3D ? skCfg3D.enabled !== false : true;
        const skH3D = Math.max(20, Math.min(260, skCfg3D?.heightMm ?? 114));
        const skT3D = Math.max(6, Math.min(40, skCfg3D?.thicknessMm ?? 16));
        const skirtMat = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(skCfg3D?.colorHex || "#f1efea"),
          roughness: 0.42,
          metalness: 0.02,
          clearcoat: 0.14,
        });

        // Seamless Full-Bleed Studio Backdrop Extension so 2K renders NEVER show floating postcard wall edges!
        const backdropSpanW = Math.max(22000, mainW + 18000);
        const backdropSpanH = Math.max(6400, ceilH + 3800);
        const backdropWallTex = wallTex ? wallTex.clone() : null;
        if (backdropWallTex) {
          backdropWallTex.wrapS = THREE.RepeatWrapping;
          backdropWallTex.wrapT = THREE.RepeatWrapping;
          backdropWallTex.repeat.set(backdropSpanW / 2400, backdropSpanH / 2400);
          backdropWallTex.needsUpdate = true;
        }
        const backdropWallMat = new THREE.MeshStandardMaterial({
          color: activeWallTone === "anthracite_gallery" ? 0x787572 : activeWallTone === "soft_plaster" ? 0xc2cad3 : 0xd2cdc3,
          map: backdropWallTex,
          roughness: 0.93,
          metalness: 0.01,
          envMapIntensity: 0.28,
        });
        // V33: Infinite white backdrop wall intentionally removed so the architectural room floats in deep dark space!
        backdropWallMat.dispose();

        const effectiveWalls = getEffectiveSpaceWalls(project);

        // Also ensure a Left Side Wall is rendered if any obstacle is rotated 90°/270° at X=0!
        const hasLeftSideObstacle = (spaceObstacles || []).some((o) => {
          const r = (((o.rotationY || 0) % 360) + 360) % 360;
          return (r === 90 || r === 270) && o.position.x <= 50;
        });
        const hasLeftWallAlready = effectiveWalls.some(
          (w) => (((w.rotationY || 0) % 360) + 360) % 360 === 90 && w.position.x <= 50
        );
        const wallsToRender =
          hasLeftSideObstacle && !hasLeftWallAlready
            ? [
                ...effectiveWalls,
                {
                  id: "wall_auto_left_side",
                  name: "Sol Yan Duvar",
                  length: 2200,
                  height: ceilH,
                  thickness: 150,
                  position: { x: 0, y: 0, z: 0 },
                  rotationY: 90,
                  elements: [],
                },
              ]
            : effectiveWalls;

        wallsToRender.forEach((w) => {
          const wLen = Math.max(100, w.length || 3600);
          const wH = Math.max(400, w.height || ceilH);
          const wThick = Math.max(40, w.thickness || 150);
          const rotRad = -((w.rotationY || 0) * Math.PI) / 180;

          const wallSegGroup = new THREE.Group();
          wallSegGroup.position.set(w.position.x, 0, w.position.z);
          wallSegGroup.rotation.y = rotRad;

          const roomCenterForWall = { x: Math.max(900, mainW * 0.5), z: 1200 };
          const wBasis = getWallRoomBasis(w, roomCenterForWall);
          const localZWorldX = Math.sin(rotRad);
          const localZWorldZ = Math.cos(rotRad);
          const dotLocalZInward =
            localZWorldX * wBasis.inwardNormal.x + localZWorldZ * wBasis.inwardNormal.z;
          const inwardIsPositiveLocalZ = dotLocalZInward >= 0;
          const wallLocalZ = inwardIsPositiveLocalZ ? -wThick / 2 : wThick / 2;
          const skirtLocalZ = inwardIsPositiveLocalZ ? 7 : -7;

          wallSegGroup.userData = {
            isRoomWallGroup: true,
            wallId: w.id,
            inwardNormal: wBasis.inwardNormal,
            wallMid: {
              x: wBasis.p0.x + wBasis.rawTangent.x * (wLen * 0.5),
              z: wBasis.p0.z + wBasis.rawTangent.z * (wLen * 0.5),
            },
          };

          const effectiveActiveWallId = activeWallId || wallsToRender[0]?.id || "wall_main";
          const isSelectedTargetWall =
            (wallsToRender.length > 1 || Boolean(activeWallId)) && w.id === effectiveActiveWallId;
          // V46: Subtle 2-state wall focus — when a cabinet/component is selected, wall returns to 100% natural plaster!
          const isStrongWallFocus = isSelectedTargetWall && wallFocusHighlight && !hasActiveCabinetSelection;
          const segWallMat = isStrongWallFocus
            ? new THREE.MeshStandardMaterial({
                color: wallMat.color.clone().lerp(new THREE.Color(0xdbeafe), 0.12),
                map: wallTex || null,
                normalMap: wallNorm || null,
                normalScale: new THREE.Vector2(0.28, 0.28),
                roughness: 0.84,
                metalness: 0.02,
                emissive: new THREE.Color(0x0284c7),
                emissiveIntensity: 0.045,
                envMapIntensity: 0.56,
                side: THREE.DoubleSide,
              })
            : wallMat;
          const wGeo = new THREE.BoxGeometry(wLen, wH, wThick);
          const wMesh = new THREE.Mesh(wGeo, segWallMat);
          wMesh.userData = {
            isRoomWall: true,
            wallId: w.id,
            wallName: w.name || "Duvar",
          };
          wMesh.position.set(wLen / 2, wH / 2, wallLocalZ);
          wMesh.castShadow = false;
          wMesh.receiveShadow = true;
          if (renderEdgeMode === "cad" || isStrongWallFocus) {
            wMesh.add(
              new THREE.LineSegments(
                new THREE.EdgesGeometry(wGeo),
                new THREE.LineBasicMaterial({
                  color: isStrongWallFocus ? 0x38bdf8 : 0x94a3b8,
                  transparent: true,
                  opacity: isStrongWallFocus ? 0.48 : 0.45,
                })
              )
            );
          }
          if (isStrongWallFocus) {
            // Refined architectural floor laser indicator when wall is directly focused (no loud 4-sided box)
            const floorLaserMat = new THREE.MeshBasicMaterial({
              color: 0x38bdf8,
              transparent: true,
              opacity: 0.65,
              depthWrite: false,
            });
            const botBar = new THREE.Mesh(new THREE.BoxGeometry(wLen, 4, 14), floorLaserMat);
            botBar.raycast = () => {};
            botBar.position.set(wLen / 2, 2.5, inwardIsPositiveLocalZ ? 18 : -18);
            wallSegGroup.add(botBar);
          } else if (isSelectedTargetWall && wallsToRender.length > 1) {
            // Whisper-thin architectural floor reference line along skirting when cabinet is selected
            const subtleBaseMat = new THREE.MeshBasicMaterial({
              color: 0x38bdf8,
              transparent: true,
              opacity: 0.24,
              depthWrite: false,
            });
            const subtleBase = new THREE.Mesh(new THREE.BoxGeometry(wLen, 2.5, 6), subtleBaseMat);
            subtleBase.raycast = () => {};
            subtleBase.position.set(wLen / 2, 1.5, inwardIsPositiveLocalZ ? 16 : -16);
            wallSegGroup.add(subtleBase);
          }
          wallSegGroup.add(wMesh);

          if (skEnabled3D) {
            const sGeo = new THREE.BoxGeometry(wLen, skH3D, skT3D);
            const sMesh = new THREE.Mesh(sGeo, skirtMat);
            sMesh.userData = {
              isRoomWall: true,
              wallId: w.id,
              wallName: w.name || "Duvar",
            };
            sMesh.position.set(wLen / 2, skH3D / 2, inwardIsPositiveLocalZ ? skT3D / 2 : -skT3D / 2);
            wallSegGroup.add(sMesh);
          }

          roomGroup.add(wallSegGroup);
        });

        if (shadowPlaneRef.current) {
          shadowPlaneRef.current.visible = floorStyle === "studio" || !showRoomArchitecture3D;
        }
        if (floorStyle !== "studio") {
          const baseFloorTex = getArchitecturalFloorTexture(floorStyle);
          const baseFloorNorm = getArchitecturalFloorNormalMap(floorStyle);
          const floorSpanW = Math.max(4600, mainW + 1400);
          const floorSpanD = 4200;
          const floorTex = baseFloorTex ? baseFloorTex.clone() : null;
          if (floorTex) {
            floorTex.wrapS = THREE.RepeatWrapping;
            floorTex.wrapT = THREE.RepeatWrapping;
            floorTex.repeat.set(floorSpanW / 1850, floorSpanD / 1850);
            floorTex.needsUpdate = true;
          }
          const floorNorm = baseFloorNorm ? baseFloorNorm.clone() : null;
          if (floorNorm) {
            floorNorm.wrapS = THREE.RepeatWrapping;
            floorNorm.wrapT = THREE.RepeatWrapping;
            floorNorm.repeat.set(floorSpanW / 1850, floorSpanD / 1850);
            floorNorm.needsUpdate = true;
          }
          const floorGeo = new THREE.BoxGeometry(floorSpanW, 32, floorSpanD);
          const floorMat = new THREE.MeshPhysicalMaterial({
            color: floorStyle === "neolith_calacatta" || floorStyle === "microcement" ? 0xd9d4cb : 0xc9b292,
            map: floorTex,
            normalMap: floorNorm,
            normalScale: new THREE.Vector2(0.38, 0.38),
            roughness:
              floorStyle === "neolith_calacatta"
                ? 0.16
                : floorStyle === "travertine"
                ? 0.30
                : 0.38,
            metalness: 0.04,
            clearcoat: floorStyle === "microcement" ? 0.14 : 0.36,
            clearcoatRoughness: 0.22,
            envMapIntensity: 0.92,
          });
          const floorMesh = new THREE.Mesh(floorGeo, floorMat);
          floorMesh.position.set(mainW / 2, -17.5, floorSpanD / 2 - 220);
          floorMesh.receiveShadow = true;
          roomGroup.add(floorMesh);
        }

        // Render each architectural obstacle (Window, Plumbing, Door, Column, Beam) in 3D
        // Properly respecting 90° / 270° Side-Wall Rotations, Z-axis position along side walls, and Y-axis sill height!
        (spaceObstacles || []).forEach((obs) => {
          const ow = obs.dimensions.width;
          const oh = obs.dimensions.height;
          const od = Math.max(24, obs.dimensions.depth || 80);
          const normRotY = (((obs.rotationY || 0) % 360) + 360) % 360;
          const rad = (normRotY * Math.PI) / 180;
          const dirX = Math.cos(rad);
          const dirZ = Math.sin(rad);
          const midX = obs.position.x + dirX * (ow * 0.5);
          const midZ = obs.position.z + dirZ * (ow * 0.5);
          // With rotation.y = -rad, local +X = (cos rad, 0, sin rad) along wall, local +Z = (-sin rad, 0, cos rad)
          const nLocalPlusZ = { x: -dirZ, z: dirX };
          const toRoomCenter = { x: mainW * 0.5 - midX, z: 1100 - midZ };
          const inwardLocalZSign =
            nLocalPlusZ.x * toRoomCenter.x + nLocalPlusZ.z * toRoomCenter.z >= 0 ? 1 : -1;
          const inwardWorldX = nLocalPlusZ.x * inwardLocalZSign;
          const inwardWorldZ = nLocalPlusZ.z * inwardLocalZSign;
          const cx3D = midX + inwardWorldX * 16;
          const cy3D = obs.position.y + oh / 2;
          const cz3D = midZ + inwardWorldZ * 16;
          const obsRotRad = -rad;
          const isSideWall = Math.abs(normRotY - 90) < 0.5 || Math.abs(normRotY - 270) < 0.5;
          const effectiveWallZ = cz3D;

          if (obs.type === "window") {
            const winGroup = new THREE.Group();
            winGroup.userData = { obstacleId: obs.id };
            winGroup.position.set(cx3D, cy3D, cz3D);
            winGroup.rotation.y = obsRotRad;

            const frameThick = 58;
            const frameDepth = 74;
            const outerFrameMat = new THREE.MeshStandardMaterial({
              color: 0x27272a,
              roughness: 0.38,
              metalness: 0.35,
            });
            const sashFrameMat = new THREE.MeshStandardMaterial({
              color: 0xf8fafc,
              roughness: 0.3,
              metalness: 0.1,
            });

            // 1. 4-Sided Outer Architectural Casing Frame (Pencere Kasası & Pervaz Çerçevesi)
            const topBarGeo = new THREE.BoxGeometry(ow + 24, frameThick, frameDepth);
            const topBar = new THREE.Mesh(topBarGeo, outerFrameMat);
            topBar.userData = { obstacleId: obs.id };
            topBar.position.set(0, oh / 2 - frameThick / 2, 0);
            winGroup.add(topBar);

            const botBar = new THREE.Mesh(topBarGeo, outerFrameMat);
            botBar.userData = { obstacleId: obs.id };
            botBar.position.set(0, -oh / 2 + frameThick / 2, 0);
            winGroup.add(botBar);

            const sideBarGeo = new THREE.BoxGeometry(frameThick, Math.max(80, oh - frameThick * 2), frameDepth);
            const leftBar = new THREE.Mesh(sideBarGeo, outerFrameMat);
            leftBar.userData = { obstacleId: obs.id };
            leftBar.position.set(-ow / 2 + frameThick / 2, 0, 0);
            winGroup.add(leftBar);

            const rightBar = new THREE.Mesh(sideBarGeo, outerFrameMat);
            rightBar.userData = { obstacleId: obs.id };
            rightBar.position.set(ow / 2 - frameThick / 2, 0, 0);
            winGroup.add(rightBar);

            // 2. Inner White Casement Sash Frame + Center Mullion
            const innerW = Math.max(120, ow - frameThick * 2);
            const innerH = Math.max(120, oh - frameThick * 2);
            const sashBarT = 32;
            const sashTopGeo = new THREE.BoxGeometry(innerW, sashBarT, 52);
            const sashTop = new THREE.Mesh(sashTopGeo, sashFrameMat);
            sashTop.userData = { obstacleId: obs.id };
            sashTop.position.set(0, innerH / 2 - sashBarT / 2, 0);
            winGroup.add(sashTop);

            const sashBot = new THREE.Mesh(sashTopGeo, sashFrameMat);
            sashBot.userData = { obstacleId: obs.id };
            sashBot.position.set(0, -innerH / 2 + sashBarT / 2, 0);
            winGroup.add(sashBot);

            const sashSideGeo = new THREE.BoxGeometry(sashBarT, innerH, 52);
            const sashLeft = new THREE.Mesh(sashSideGeo, sashFrameMat);
            sashLeft.userData = { obstacleId: obs.id };
            sashLeft.position.set(-innerW / 2 + sashBarT / 2, 0, 0);
            winGroup.add(sashLeft);

            const sashRight = new THREE.Mesh(sashSideGeo, sashFrameMat);
            sashRight.userData = { obstacleId: obs.id };
            sashRight.position.set(innerW / 2 - sashBarT / 2, 0, 0);
            winGroup.add(sashRight);

            // Center vertical mullion (Orta Kayıt)
            const mullionGeo = new THREE.BoxGeometry(44, innerH, 58);
            const mullionMesh = new THREE.Mesh(mullionGeo, outerFrameMat);
            mullionMesh.renderOrder = 13;
            mullionMesh.userData = { obstacleId: obs.id };
            winGroup.add(mullionMesh);

            // 3. Window Handle (Pencere Kolu) on center sash + Opening Direction V-Lines
            const winHandleMat = new THREE.MeshStandardMaterial({
              color: 0xfbbf24,
              roughness: 0.22,
              metalness: 0.85,
            });
            const winHandleRosette = new THREE.Mesh(
              new THREE.BoxGeometry(22, 64, 14),
              winHandleMat
            );
            winHandleRosette.userData = { obstacleId: obs.id };
            const winMirrorSign = obs.doorSwing === "right" ? -1 : 1;
            winHandleRosette.position.set(20 * winMirrorSign, -20, 34 * inwardLocalZSign);
            winGroup.add(winHandleRosette);

            const winHandleLever = new THREE.Mesh(
              new THREE.BoxGeometry(16, 96, 18),
              winHandleMat
            );
            winHandleLever.userData = { obstacleId: obs.id };
            winHandleLever.position.set(20 * winMirrorSign, -48, 46 * inwardLocalZSign);
            winGroup.add(winHandleLever);

            // Double-glazed reflective glass
            const glassGeo = new THREE.BoxGeometry(innerW - sashBarT * 2, innerH - sashBarT * 2, 28);
            const glassMat = new THREE.MeshBasicMaterial({
              color: 0x38bdf8,
              transparent: true,
              opacity: 0.44,
              polygonOffset: true,
              polygonOffsetFactor: -2,
            });
            const glassMesh = new THREE.Mesh(glassGeo, glassMat);
            glassMesh.renderOrder = 12;
            glassMesh.userData = { obstacleId: obs.id };
            glassMesh.add(
              new THREE.LineSegments(
                new THREE.EdgesGeometry(glassGeo),
                new THREE.LineBasicMaterial({ color: 0x0284c7 })
              )
            );
            winGroup.add(glassMesh);

            // Window Opening Direction V-Lines on Right Sash
            const winVLinePts = new Float32Array([
              innerW / 2 - sashBarT, innerH / 2 - sashBarT, 20,
              22, -20, 20,
              22, -20, 20,
              innerW / 2 - sashBarT, -innerH / 2 + sashBarT, 20,
            ]);
            const winVGeo = new THREE.BufferGeometry();
            winVGeo.setAttribute("position", new THREE.BufferAttribute(winVLinePts, 3));
            winGroup.add(
              new THREE.LineSegments(
                winVGeo,
                new THREE.LineBasicMaterial({ color: 0x0369a1 })
              )
            );

            // 4. Protruding Marble/Stone Window Sill (Denizlik)
            const sillGeo = new THREE.BoxGeometry(ow + 76, 32, 130);
            const sillMat = new THREE.MeshStandardMaterial({
              color: 0xd6d3d1,
              roughness: 0.4,
            });
            const sillMesh = new THREE.Mesh(sillGeo, sillMat);
            sillMesh.renderOrder = 13;
            sillMesh.userData = { obstacleId: obs.id };
            sillMesh.position.set(0, -oh / 2 - 16, 32 * inwardLocalZSign);
            sillMesh.add(
              new THREE.LineSegments(
                new THREE.EdgesGeometry(sillGeo),
                new THREE.LineBasicMaterial({ color: 0x44403c })
              )
            );
            winGroup.add(sillMesh);
            roomGroup.add(winGroup);
          } else if (obs.type === "plumbing") {
            const plumbGroup = new THREE.Group();
            plumbGroup.userData = { obstacleId: obs.id };
            plumbGroup.position.set(cx3D, cy3D, cz3D);
            plumbGroup.rotation.y = obsRotRad;
            const pipeGeo = new THREE.CylinderGeometry(16, 16, 55, 16);
            pipeGeo.rotateX(Math.PI / 2);
            const hotMesh = new THREE.Mesh(
              pipeGeo,
              new THREE.MeshBasicMaterial({ color: 0xdc2626 })
            );
            hotMesh.userData = { obstacleId: obs.id };
            hotMesh.position.set(-45, 15, 25);
            const coldMesh = new THREE.Mesh(
              pipeGeo,
              new THREE.MeshBasicMaterial({ color: 0x2563eb })
            );
            coldMesh.userData = { obstacleId: obs.id };
            coldMesh.position.set(45, 15, 25);
            const drainGeo = new THREE.CylinderGeometry(26, 26, 60, 16);
            drainGeo.rotateX(Math.PI / 2);
            const drainMesh = new THREE.Mesh(
              drainGeo,
              new THREE.MeshBasicMaterial({ color: 0x334155 })
            );
            drainMesh.userData = { obstacleId: obs.id };
            drainMesh.position.set(0, -35, 28);
            plumbGroup.add(hotMesh, coldMesh, drainMesh);
            roomGroup.add(plumbGroup);
          } else if (obs.type === "door") {
            const doorGroup = new THREE.Group();
            doorGroup.userData = { obstacleId: obs.id };
            doorGroup.position.set(cx3D, cy3D, cz3D);
            doorGroup.rotation.y = obsRotRad;

            const jambW = 68;
            const jambD = 76;
            const isRightHinged = obs.doorSwing === "right";
            const openSignZ = (obs.doorOpenSide === "outward" ? -1 : 1) * inwardLocalZSign;
            const frameMat = new THREE.MeshStandardMaterial({
              color: 0x292524,
              roughness: 0.42,
              metalness: 0.15,
            });
            const leafMat = new THREE.MeshStandardMaterial({
              color: 0xb45309,
              roughness: 0.48,
              metalness: 0.08,
            });
            const leafPanelMat = new THREE.MeshStandardMaterial({
              color: 0x92400e,
              roughness: 0.52,
            });
            const handleGoldMat = new THREE.MeshStandardMaterial({
              color: 0xfbbf24,
              roughness: 0.2,
              metalness: 0.9,
            });

            // 1. 3-Sided Outer Architrave Frame (Kapı Kasası & Pervaz Çerçevesi: Sol Dikme, Sağ Dikme, Üst Başlık)
            const jambGeo = new THREE.BoxGeometry(jambW, oh, jambD);
            const leftJamb = new THREE.Mesh(jambGeo, frameMat);
            leftJamb.userData = { obstacleId: obs.id };
            leftJamb.position.set(-ow / 2 + jambW / 2, 0, 0);
            leftJamb.add(
              new THREE.LineSegments(
                new THREE.EdgesGeometry(jambGeo),
                new THREE.LineBasicMaterial({ color: 0x1c1917 })
              )
            );
            doorGroup.add(leftJamb);

            const rightJamb = new THREE.Mesh(jambGeo, frameMat);
            rightJamb.userData = { obstacleId: obs.id };
            rightJamb.position.set(ow / 2 - jambW / 2, 0, 0);
            rightJamb.add(
              new THREE.LineSegments(
                new THREE.EdgesGeometry(jambGeo),
                new THREE.LineBasicMaterial({ color: 0x1c1917 })
              )
            );
            doorGroup.add(rightJamb);

            const headGeo = new THREE.BoxGeometry(ow + 36, jambW, jambD + 8);
            const topHeader = new THREE.Mesh(headGeo, frameMat);
            topHeader.userData = { obstacleId: obs.id };
            topHeader.position.set(0, oh / 2 - jambW / 2, 0);
            topHeader.add(
              new THREE.LineSegments(
                new THREE.EdgesGeometry(headGeo),
                new THREE.LineBasicMaterial({ color: 0x1c1917 })
              )
            );
            doorGroup.add(topHeader);

            // 2. 3D Hinge Barrels on Hinge Side Jamb
            const leafW = Math.max(240, ow - jambW * 2);
            const leafH = Math.max(400, oh - jambW);
            const leafD = 42;
            const hingeX = isRightHinged ? leafW / 2 : -leafW / 2;
            [-leafH * 0.36, 0, leafH * 0.36].forEach((hy) => {
              const barrel = new THREE.Mesh(
                new THREE.CylinderGeometry(10, 10, 68, 14),
                handleGoldMat
              );
              barrel.userData = { obstacleId: obs.id };
              barrel.position.set(hingeX, hy - jambW / 2, 26);
              doorGroup.add(barrel);
            });

            // 3. Pivoted Door Leaf (Supports BOTH Left/Right Hinge Mirror AND Inward/Outward Open Mirror!)
            const leafPivot = new THREE.Group();
            leafPivot.userData = { obstacleId: obs.id };
            leafPivot.position.set(hingeX, -jambW / 2, 18 * openSignZ);
            const swingAngleRad = openSignZ * (isRightHinged ? 1 : -1) * ((22 * Math.PI) / 180);
            leafPivot.rotation.y = swingAngleRad;

            const leafCenterOffsetX = isRightHinged ? -leafW / 2 : leafW / 2;
            const leafGeo = new THREE.BoxGeometry(leafW, leafH, leafD);
            const leafMesh = new THREE.Mesh(leafGeo, leafMat);
            leafMesh.userData = { obstacleId: obs.id };
            leafMesh.position.set(leafCenterOffsetX, 0, 0);
            leafMesh.add(
              new THREE.LineSegments(
                new THREE.EdgesGeometry(leafGeo),
                new THREE.LineBasicMaterial({ color: 0x451a03 })
              )
            );
            leafPivot.add(leafMesh);

            // Decorative Recessed Upper & Lower Door Panels
            const decPanelW = Math.max(120, leafW - 150);
            const decUpperGeo = new THREE.BoxGeometry(decPanelW, leafH * 0.38, leafD + 6);
            const decUpper = new THREE.Mesh(decUpperGeo, leafPanelMat);
            decUpper.userData = { obstacleId: obs.id };
            decUpper.position.set(leafCenterOffsetX, leafH * 0.2, 0);
            leafPivot.add(decUpper);

            const decLowerGeo = new THREE.BoxGeometry(decPanelW, leafH * 0.32, leafD + 6);
            const decLower = new THREE.Mesh(decLowerGeo, leafPanelMat);
            decLower.userData = { obstacleId: obs.id };
            decLower.position.set(leafCenterOffsetX, -leafH * 0.22, 0);
            leafPivot.add(decLower);

            // 4. Prominent 3D Metallic Lever Door Handle & Escutcheon Plate (Kapı Kolu & Aynası) on Latch Edge
            const handleLocalX = isRightHinged ? -leafW + 68 : leafW - 68;
            const handleLocalY = -leafH / 2 + Math.min(leafH - 180, 1020);
            const escutcheonGeo = new THREE.BoxGeometry(34, 165, leafD + 18);
            const escutcheonMesh = new THREE.Mesh(escutcheonGeo, handleGoldMat);
            escutcheonMesh.userData = { obstacleId: obs.id };
            escutcheonMesh.position.set(handleLocalX, handleLocalY, 0);
            leafPivot.add(escutcheonMesh);

            // Front & Back Lever Grips pointing inward toward the center of the door leaf
            const leverDir = isRightHinged ? 1 : -1;
            [leafD / 2 + 28, -(leafD / 2 + 28)].forEach((hz) => {
              const neckMesh = new THREE.Mesh(
                new THREE.CylinderGeometry(11, 11, 34, 16).rotateX(Math.PI / 2),
                handleGoldMat
              );
              neckMesh.userData = { obstacleId: obs.id };
              neckMesh.position.set(handleLocalX, handleLocalY + 18, hz * 0.65);
              leafPivot.add(neckMesh);

              const leverGrip = new THREE.Mesh(
                new THREE.BoxGeometry(135, 22, 22),
                handleGoldMat
              );
              leverGrip.userData = { obstacleId: obs.id };
              leverGrip.position.set(handleLocalX + leverDir * 52, handleLocalY + 18, hz);
              leafPivot.add(leverGrip);
            });

            // 5. Architectural Opening-Direction Triangle V-Lines on Both Faces of the Door Leaf (Hinge -> Handle)
            const hingeLocalX = 0;
            const vLinePts = new Float32Array([
              hingeLocalX, leafH / 2 - 25, leafD / 2 + 5,
              handleLocalX, handleLocalY + 18, leafD / 2 + 5,
              handleLocalX, handleLocalY + 18, leafD / 2 + 5,
              hingeLocalX, -leafH / 2 + 25, leafD / 2 + 5,
            ]);
            const vLineGeo = new THREE.BufferGeometry();
            vLineGeo.setAttribute("position", new THREE.BufferAttribute(vLinePts, 3));
            leafPivot.add(
              new THREE.LineSegments(
                vLineGeo,
                new THREE.LineBasicMaterial({ color: 0xfef08a })
              )
            );

            doorGroup.add(leafPivot);

            // 6. 3D Floor Opening Swing Arc (Zeminde 90° Kapı Açılış Yönü Yayı)
            const arcPoints: number[] = [];
            const steps = 20;
            const floorLocalY = -oh / 2 + 6;
            for (let s = 0; s < steps; s++) {
              const a0 = (s / steps) * (Math.PI / 2);
              const a1 = ((s + 1) / steps) * (Math.PI / 2);
              const x0 = hingeX + (isRightHinged ? -1 : 1) * Math.cos(a0) * leafW;
              const z0 = openSignZ * (18 + Math.sin(a0) * leafW);
              const x1 = hingeX + (isRightHinged ? -1 : 1) * Math.cos(a1) * leafW;
              const z1 = openSignZ * (18 + Math.sin(a1) * leafW);
              arcPoints.push(x0, floorLocalY, z0, x1, floorLocalY, z1);
            }
            const arcGeo = new THREE.BufferGeometry();
            arcGeo.setAttribute("position", new THREE.Float32BufferAttribute(arcPoints, 3));
            doorGroup.add(
              new THREE.LineSegments(
                arcGeo,
                new THREE.LineBasicMaterial({ color: 0xf59e0b })
              )
            );

            roomGroup.add(doorGroup);
          } else if (obs.type === "electrical") {
            // Architectural Flush Matte Anthracite Wall Socket / Switch Plate
            const plateGeo = new THREE.BoxGeometry(Math.min(160, ow), Math.min(90, oh), 10);
            const plateMat = new THREE.MeshStandardMaterial({
              color: 0x27272a,
              roughness: 0.38,
              metalness: 0.15,
            });
            const plateMesh = new THREE.Mesh(plateGeo, plateMat);
            plateMesh.userData = { obstacleId: obs.id };
            plateMesh.position.set(midX + inwardWorldX * 8, cy3D, midZ + inwardWorldZ * 8);
            plateMesh.rotation.y = obsRotRad;
            roomGroup.add(plateMesh);
          } else {
            // Solid Architectural Structural Column, Beam, Niche, or Partition (Matches Wall PBR in Photoreal!)
            const colGeo = new THREE.BoxGeometry(ow, oh, od);
            const colMesh = new THREE.Mesh(
              colGeo,
              renderEdgeMode === "cad"
                ? new THREE.MeshBasicMaterial({
                    color: 0xe2e8f0,
                    transparent: true,
                    opacity: 0.75,
                  })
                : wallMat
            );
            colMesh.userData = { obstacleId: obs.id };
            colMesh.castShadow = renderEdgeMode !== "cad";
            colMesh.receiveShadow = renderEdgeMode !== "cad";
            const colX = midX + inwardWorldX * (od * 0.5);
            const colZ = midZ + inwardWorldZ * (od * 0.5);
            colMesh.position.set(colX, cy3D, colZ);
            colMesh.rotation.y = obsRotRad;
            if (renderEdgeMode === "cad") {
              colMesh.add(
                new THREE.LineSegments(
                  new THREE.EdgesGeometry(colGeo),
                  new THREE.LineBasicMaterial({ color: 0x475569 })
                )
              );
            }
            roomGroup.add(colMesh);

            // Matching architectural baseboard wrap around floor-standing structural columns
            if (renderEdgeMode !== "cad" && (obs.position.y || 0) <= 20 && oh >= 1200) {
              const colSkirtGeo = new THREE.BoxGeometry(ow + 14, 80, od + 14);
              const colSkirt = new THREE.Mesh(colSkirtGeo, skirtMat);
              colSkirt.position.set(colX, 40, colZ);
              colSkirt.rotation.y = obsRotRad;
              colSkirt.receiveShadow = true;
              roomGroup.add(colSkirt);
            }
          }
        });

        const ceiling3DGroup = build3DArchitecturalCeilingGroup(project.space, mainW, lightingPreset);
        if (ceiling3DGroup) {
          roomGroup.add(ceiling3DGroup);
        }

        if (roomArchGroupRef.current) roomArchGroupRef.current.add(roomGroup);
      }
      markShadowsAndRender();
    }, [
      renderEdgeMode,
      showRoomArchitecture3D,
      spaceObstacles,
      spaceWalls,
      activeWallId,
      wallFocusHighlight,
      hasActiveCabinetSelection,
      project.space?.ceilingHeight,
      project.space?.ceilingConfig,
      lightingPreset,
      paused,
      wallTone,
      floorStyle,
      theme,
      markShadowsAndRender,
    ]);

    const activeModForDim = project.modules[activeModuleIndex] || project.modules[0];
    const activeModuleDimSig = activeModForDim
      ? `${activeModForDim.id}|${activeModForDim.dimensions.width}x${activeModForDim.dimensions.height}x${activeModForDim.dimensions.depth}|${activeModForDim.position.x},${activeModForDim.position.y},${activeModForDim.position.z}|${activeModForDim.rotation?.y || 0}|${activeModForDim.carcass.panelThickness}|${activeModForDim.carcass.plinthHeight}|${activeModForDim.bays.map((b) => `${b.customWidth || 0}_${b.shelves.length}_${b.drawers.length}`).join(",")}`
      : "none";

    // Rebuild 3D Dimension Lines & Labels ONLY when active module dimensions/placement or showDimensions changes (never on unrelated module/shelf drags!)
    useEffect(() => {
      if (paused) return;
      const dimGroup = dimGroupRef.current;
      if (!dimGroup) return;

      // Dispose previous dimension resources (including SpriteMaterial CanvasTextures)
      disposeObject3DTree(dimGroup);
      dimGroup.clear();
      dimGroup.visible = effectiveShowDimensions;
      liveDimDeltaRef.current = { dx: 0, dz: 0 };

      const mod = project.modules[activeModuleIndex] || project.modules[0];
      if (!effectiveShowDimensions || !mod) {
        dimWorldAnchorsRef.current = [];
        requestRender();
        return;
      }

      const modDimContainer = createModuleGroup(mod);
      modDimContainer.userData.isActiveModuleDim = true;
      modDimContainer.userData.baseOrigin = modDimContainer.position.clone();
      const { width: W, height: H, depth: D } = mod.dimensions;
      const T = mod.carcass.panelThickness;
      const fourSpaces = calculateFourSpaceDimensions(mod);
      const localAnchors: DimensionAnchor[] = [];

      const soketW = Math.max(200, W - 2 * T);
      const fmt3DDim = (mmVal: number) =>
        displayUnit === "cm" ? `${Number((mmVal / 10).toFixed(1))} cm` : `${Math.round(mmVal)} mm`;
      // 1. Total Width (Genişlik) — high clean offset above cabinet top (170 mm)
      addDimensionSegment(
        modDimContainer,
        localAnchors,
        "dim_W",
        new THREE.Vector3(0, H, D * 0.85),
        new THREE.Vector3(W, H, D * 0.85),
        new THREE.Vector3(0, 1, 0),
        170,
        "G",
        fmt3DDim(W),
        0x1c1917,
        "#CBD5E1",
        "#141413"
      );

      // 2. Total Height (Yükseklik) — clean right-front vertical offset (150 mm)
      addDimensionSegment(
        modDimContainer,
        localAnchors,
        "dim_H",
        new THREE.Vector3(W, 0, D),
        new THREE.Vector3(W, H, D),
        new THREE.Vector3(1, 0, 0),
        150,
        "Y",
        fmt3DDim(H),
        0x1c1917,
        "#CBD5E1",
        "#141413"
      );

      // 3. Total Depth (Derinlik) — original left-bottom floor position & direction, with crisp high-visibility 3D rods
      addDimensionSegment(
        modDimContainer,
        localAnchors,
        "dim_D",
        new THREE.Vector3(0, 2, 0),
        new THREE.Vector3(0, 2, D),
        new THREE.Vector3(-1, 0, 0),
        125,
        "D",
        fmt3DDim(D),
        0x1c1917,
        "#CBD5E1",
        "#141413"
      );

      // 4. Soket (Plinth width) shown only in Architect / Factory modes
      if (!isSimpleTier) {
        addDimensionSegment(
          modDimContainer,
          localAnchors,
          "dim_SOKET",
          new THREE.Vector3(T, 0, D),
          new THREE.Vector3(W - T, 0, D),
          new THREE.Vector3(0, 0, 1),
          95,
          "Soket",
          fmt3DDim(soketW),
          0x78716c,
          "#D6D0C4",
          "#57534E"
        );
      }

      // 5. Per-Bay Net Width Segments along top-front edge
      if (mod.category !== "complementary" && mod.bays.length >= 1) {
        const bayWidths = fourSpaces.usableInternal.bayClearWidthsMm;
        let curBayX = T;
        mod.bays.forEach((b, bIdx) => {
          const bw =
            bayWidths[bIdx] ||
            Math.round((W - (mod.bays.length + 1) * T) / Math.max(1, mod.bays.length));
          const isSelBay = bIdx === activeBayIndex;
          if (!isSimpleTier || isSelBay) {
            addDimensionSegment(
              modDimContainer,
              localAnchors,
              `dim_BAY_${bIdx}`,
              new THREE.Vector3(curBayX, H, D * 0.94),
              new THREE.Vector3(curBayX + bw, H, D * 0.94),
              new THREE.Vector3(0, 1, 0),
              54,
              `${bIdx + 1}. Bölme`,
              fmt3DDim(bw),
              isSelBay ? 0x1d4ed8 : 0x8c7a6b,
              isSelBay ? "#93C5FD" : "#D6D0C4",
              isSelBay ? "#1D4ED8" : "#78716C"
            );
          }
          curBayX += bw + T;
        });
      }

            dimGroup.add(modDimContainer);
      modDimContainer.updateMatrixWorld(true);

      const allWorldAnchors: { id: string; worldPos: THREE.Vector3; worldStart?: THREE.Vector3; worldEnd?: THREE.Vector3; isActiveMod?: boolean }[] = localAnchors.map((a) => ({
        id: a.id,
        worldPos: a.localMidpoint.clone().applyMatrix4(modDimContainer.matrixWorld),
        worldStart: a.localStart.clone().applyMatrix4(modDimContainer.matrixWorld),
        worldEnd: a.localEnd.clone().applyMatrix4(modDimContainer.matrixWorld),
        isActiveMod: true,
      }));

      // Build 3D Dimension Rods & Anchors for ALL other modules in the scene
      project.modules.forEach((otherMod, mIdx) => {
        if (mIdx === activeModuleIndex || otherMod.category === "complementary") return;
        const otherDimContainer = createModuleGroup(otherMod);
        const oW = otherMod.dimensions.width;
        const oH = otherMod.dimensions.height;
        const oD = otherMod.dimensions.depth;
        const oAnchors: DimensionAnchor[] = [];
        addDimensionSegment(
          otherDimContainer,
          oAnchors,
          `dim_MOD_${mIdx}`,
          new THREE.Vector3(0, oH, oD),
          new THREE.Vector3(oW, oH, oD),
          new THREE.Vector3(0, 1, 0),
          75,
          `#${mIdx + 1} ${otherMod.name}`,
          displayUnit === "cm" ? `${Number((oW / 10).toFixed(1))}×${Number((oH / 10).toFixed(1))} cm` : `${oW}×${oH} mm`,
          0x57534e,
          "#57534e",
          "#44403c"
        );
        dimGroup.add(otherDimContainer);
        otherDimContainer.updateMatrixWorld(true);
        oAnchors.forEach((oa) => {
          allWorldAnchors.push({
            id: oa.id,
            worldPos: oa.localMidpoint.clone().applyMatrix4(otherDimContainer.matrixWorld),
            worldStart: oa.localStart.clone().applyMatrix4(otherDimContainer.matrixWorld),
            worldEnd: oa.localEnd.clone().applyMatrix4(otherDimContainer.matrixWorld),
          });
        });
      });

      // Build Total Row Span 3D Dimension Rod across all main modules
      const mainMods = project.modules.filter((m) => m.category !== "complementary");
      if (mainMods.length > 1) {
        const minX = Math.min(...mainMods.map((m) => m.position.x));
        const maxX = Math.max(...mainMods.map((m) => m.position.x + m.dimensions.width));
        const maxH = Math.max(...mainMods.map((m) => m.position.y + m.dimensions.height));
        const maxD = Math.max(...mainMods.map((m) => m.dimensions.depth));
        const totalAnchors: DimensionAnchor[] = [];
        addDimensionSegment(
          dimGroup,
          totalAnchors,
          "dim_TOTAL_SPAN",
          new THREE.Vector3(minX, maxH, maxD),
          new THREE.Vector3(maxX, maxH, maxD),
          new THREE.Vector3(0, 1, 0),
          260,
          "TOPLAM DİZİLİM",
          fmt3DDim(maxX - minX),
          0x0f766e,
          "#0f766e",
          "#0f766e"
        );
        totalAnchors.forEach((ta) => {
          allWorldAnchors.push({
            id: ta.id,
            worldPos: ta.localMidpoint.clone(),
            worldStart: ta.localStart.clone(),
            worldEnd: ta.localEnd.clone(),
          });
        });
      }

      dimWorldAnchorsRef.current = allWorldAnchors;

      updateProjectedDimensionLabels();
      requestRender();
    }, [
      paused,
      activeModuleDimSig,
      activeModuleIndex,
      activeBayIndex,
      effectiveShowDimensions,
      isSimpleTier,
      displayUnit,
      updateProjectedDimensionLabels,
      requestRender,
    ]);

    useEffect(() => {
      if (paused) return;
      const mod = project.modules[activeModuleIndex] || project.modules[0];
      if (!mod) {
        hwWorldAnchorsRef.current = [];
        return;
      }
      const modContainer = createModuleGroup(mod);
      modContainer.updateMatrixWorld(true);
      hwWorldAnchorsRef.current = hwCallouts.map((hc) => ({
        id: hc.id,
        worldPos: hc.localPos.clone().applyMatrix4(modContainer.matrixWorld),
        offsetPx: hc.offsetPx,
      }));
      matWorldAnchorsRef.current = matCallouts.map((mc) => ({
        id: mc.id,
        worldPos: mc.localPos.clone().applyMatrix4(modContainer.matrixWorld),
        offsetPx: mc.offsetPx,
      }));
      updateProjectedDimensionLabels();
      requestRender();
    }, [paused, activeModuleDimSig, activeModuleIndex, hwCallouts, matCallouts, hardwareViewMode, materialModeActive, updateProjectedDimensionLabels, requestRender]);

    if (!activeModule) return null;
    const { width, height, depth } = activeModule.dimensions;

    const activeTpl = activeModule.templateId
      ? v4ModuleTemplates.find((t) => t.templateId === activeModule.templateId)
      : undefined;
    const dimBounds = {
      W: {
        min: activeTpl?.dimensionLimits?.minW ?? 200,
        max: activeTpl?.dimensionLimits?.maxW ?? 3600,
        step: 50,
        presets: [450, 600, 800, 900, 1200, 1600, 1800, 2000, 2400],
        current: width,
        label: "Genişlik",
        isFixed: Boolean(activeModule.isFixedWidth),
      },
      H: {
        min: activeTpl?.dimensionLimits?.minH ?? 300,
        max: activeTpl?.dimensionLimits?.maxH ?? 2800,
        step: 50,
        presets: [720, 900, 1400, 2000, 2100, 2200, 2400, 2600],
        current: height,
        label: "Yükseklik",
        isFixed: false,
      },
      D: {
        min: activeTpl?.dimensionLimits?.minD ?? 200,
        max: activeTpl?.dimensionLimits?.maxD ?? 950,
        step: 50,
        presets: [320, 350, 450, 580, 600, 650, 700],
        presetsLabel: "Derinlik",
        current: depth,
        label: "Derinlik",
        isFixed: false,
      },
      SOKET: {
        min: 0,
        max: 200,
        step: 10,
        presets: [0, 60, 80, 100, 120, 150],
        current: activeModule.carcass.plinthHeight ?? 100,
        label: "Soket / Kaide Yüksekliği",
        isFixed: false,
      },
    };

    const commitBadgeEdit = (overrideVal?: number) => {
      if (!editingBadge) return;
      const bInfo = dimBounds[editingBadge];
      if (bInfo.isFixed) {
        setEditingBadge(null);
        return;
      }
      const val = typeof overrideVal === "number" ? overrideVal : Number(badgeDraftValue);
      if (Number.isNaN(val) || !Number.isFinite(val)) return;
      if (val < bInfo.min || val > bInfo.max) {
        // Block invalid dimension outside allowed parametric rules
        return;
      }
      if (editingBadge === "W") {
        setDimensions(Math.round(val), height, depth);
      } else if (editingBadge === "H") {
        setDimensions(width, Math.round(val), depth);
      } else if (editingBadge === "D") {
        setDimensions(width, height, Math.round(val));
      } else if (editingBadge === "SOKET") {
        setPlinthHeight(Math.round(val));
      }
      setEditingBadge(null);
    };

    const livePartPoolRef = useRef<{
      group: THREE.Group;
      woodBox: THREE.Mesh;
      woodEdges: THREE.LineSegments;
      handleBar: THREE.Mesh;
      metalRod: THREE.Mesh;
    } | null>(null);

    useEffect(() => {
      const ensureLivePartPool = (mod: { carcass: { bodyMaterialId: string }; surfaceFinishOverride?: Parameters<typeof getV3PbrMaterial>[4] }): NonNullable<typeof livePartPoolRef.current> | null => {
        const gGroup = ghostSnapGroupRef.current;
        if (!gGroup) return null;
        const matDef =
          DEFAULT_MATERIALS.find((m) => m.id === mod.carcass.bodyMaterialId) ||
          (project.customMaterials || []).find((m) => m.id === mod.carcass.bodyMaterialId) ||
          DEFAULT_MATERIALS[0];
        const woodMat = getV3PbrMaterial(matDef, false, false, "lengthwise", mod.surfaceFinishOverride);
        const metalMat = getV3PbrMaterial(DEFAULT_MATERIALS[0], false, true, "lengthwise");

        if (!livePartPoolRef.current) {
          const unitBox = markSharedGeometry(new THREE.BoxGeometry(1, 1, 1));
          const unitCyl = markSharedGeometry(new THREE.CylinderGeometry(0.5, 0.5, 1, 16));
          unitCyl.rotateZ(Math.PI / 2);
          const woodBox = new THREE.Mesh(unitBox, woodMat);
          woodBox.raycast = () => {};
          const woodEdges = new THREE.LineSegments(
            markSharedGeometry(new THREE.EdgesGeometry(unitBox)),
            markSharedMaterial(new THREE.LineBasicMaterial({ color: 0x8c6d46 }))
          );
          woodEdges.raycast = () => {};
          woodBox.add(woodEdges);

          const handleBar = new THREE.Mesh(unitBox, metalMat);
          handleBar.raycast = () => {};
          const metalRod = new THREE.Mesh(unitCyl, metalMat);
          metalRod.raycast = () => {};

          const group = new THREE.Group();
          group.name = "v12_live_real_3d_part_preview";
          group.add(woodBox, handleBar, metalRod);
          livePartPoolRef.current = { group, woodBox, woodEdges, handleBar, metalRod };
        } else {
          livePartPoolRef.current.woodBox.material = woodMat;
        }
        const sceneRoot = gGroup.parent || gGroup;
        if (livePartPoolRef.current.group.parent !== sceneRoot) {
          sceneRoot.add(livePartPoolRef.current.group);
        }
        livePartPoolRef.current.group.visible = true;
        return livePartPoolRef.current;
      };

      const computeLivePlacementFromClient = (
        clientX: number,
        clientY: number,
        spec: { id: string; title: string; visual: string }
      ) => {
        const curRenderer = rendererRef.current;
        const cam = (controlsRef.current?.object as THREE.Camera) || perspCamRef.current;
        const st = latestStateRef.current;
        if (!curRenderer || !cam || !st.project.modules.length) return null;

        const rect = curRenderer.domElement.getBoundingClientRect();
        if (
          rect.width <= 0 ||
          rect.height <= 0 ||
          clientX < rect.left ||
          clientX > rect.right ||
          clientY < rect.top ||
          clientY > rect.bottom
        ) {
          return null;
        }

        const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
        const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
        const rc = new THREE.Raycaster();
        rc.setFromCamera(new THREE.Vector2(ndcX, ndcY), cam);

        // Hit-test ALL main modules (prioritizing exact bounds match, then closest horizontal match)
        // so multi-module Open Wardrobe Systems can receive dragged parts in ANY unit!
        let mod = st.project.modules[st.activeModuleIndex] || st.project.modules[0];
        let matchedModIdx = st.activeModuleIndex;
        let relX = -99999;
        let relY = -99999;
        let bestHorizontalScore = Infinity;

        for (let mIdx = 0; mIdx < st.project.modules.length; mIdx++) {
          const candMod = st.project.modules[mIdx];
          if (!candMod || candMod.category === "complementary" || !candMod.bays.length) continue;
          const cPl = calculateModulePlacement(candMod);
          const rightAxis = new THREE.Vector3(Math.cos(cPl.rotationYRad), 0, -Math.sin(cPl.rotationYRad));
          const frontNormal = new THREE.Vector3(Math.sin(cPl.rotationYRad), 0, Math.cos(cPl.rotationYRad));
          const midPlaneAnchor = new THREE.Vector3(cPl.origin.x, cPl.origin.y, cPl.origin.z).addScaledVector(
            frontNormal,
            candMod.dimensions.depth * 0.5
          );
          const midInteriorPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(frontNormal, midPlaneAnchor);
          const hitPt = new THREE.Vector3();
          if (!rc.ray.intersectPlane(midInteriorPlane, hitPt)) continue;

          const cRelX = hitPt.clone().sub(cPl.origin).dot(rightAxis);
          const cRelY = hitPt.y - candMod.position.y;
          if (cRelY < -120 || cRelY > candMod.dimensions.height + 160) continue;

          const horizDistOutside =
            cRelX < 0 ? -cRelX : cRelX > candMod.dimensions.width ? cRelX - candMod.dimensions.width : 0;
          const camDist = hitPt.distanceTo(cam.position);
          // Reject hits behind camera ray or absurdly far away
          const toHit = hitPt.clone().sub(cam.position);
          if (toHit.dot(rc.ray.direction) <= 0) continue;
          const compositeScore = (horizDistOutside === 0 ? 0 : 50000 + horizDistOutside * 200) + camDist;
          if (horizDistOutside <= 140 && compositeScore < bestHorizontalScore) {
            bestHorizontalScore = compositeScore;
            mod = candMod;
            matchedModIdx = mIdx;
            relX = cRelX;
            relY = cRelY;
          }
        }

        if (!Number.isFinite(bestHorizontalScore)) {
          return null;
        }

        const carcassT = mod.carcass?.panelThickness || 18;
        const plinthH = mod.carcass?.plinthHeight ?? 80;
        const netH = calculateNetInnerHeight(mod);
        const bayWidths = calculateBayWidths(mod);

        let targetBayIdx = 0;
        let accX = carcassT;
        let bayStartX = carcassT;
        let curBayWidth = bayWidths[0] || 500;
        for (let i = 0; i < bayWidths.length; i++) {
          const bw = bayWidths[i];
          if (relX >= accX - carcassT && relX <= accX + bw + carcassT) {
            targetBayIdx = i;
            bayStartX = accX;
            curBayWidth = bw;
            break;
          }
          accX += bw + carcassT;
        }
        if (relX > accX) {
          targetBayIdx = Math.max(0, bayWidths.length - 1);
          curBayWidth = bayWidths[targetBayIdx] || 500;
          bayStartX = carcassT + bayWidths.slice(0, targetBayIdx).reduce((s, w) => s + w + carcassT, 0);
        }
        targetBayIdx = Math.max(0, Math.min(mod.bays.length - 1, targetBayIdx));

        const cursorElevY = relY - plinthH - carcassT;
        const minElev = spec.visual === "drawer" || spec.visual === "internal_drawer" ? 0 : 32;
        const maxElev =
          spec.visual === "drawer" || spec.visual === "internal_drawer"
            ? Math.max(0, netH - 180)
            : Math.max(64, netH - 32);
        const clampedRawY = Math.max(minElev, Math.min(maxElev, cursorElevY));
        const nearest32 = Math.round(clampedRawY / 32) * 32;
        let snappedElevY =
          Math.abs(clampedRawY - nearest32) <= 5 && nearest32 >= minElev && nearest32 <= maxElev
            ? nearest32
            : Math.round(clampedRawY / 2) * 2;
        if (spec.visual === "shelf" && spec.id !== "lib_fixed_shelf") {
          const holeYs = computeBaySystem32ShelfHoleElevations(mod, targetBayIdx, undefined, {
            includeFixedShelves: false,
          });
          if (holeYs && holeYs.length > 0) {
            snappedElevY = holeYs.reduce((best, hy) =>
              Math.abs(clampedRawY - hy) < Math.abs(clampedRawY - best) ? hy : best
            , holeYs[0]);
          }
        }
        const localBayX = Math.max(
          40,
          Math.min(Math.max(72, curBayWidth - carcassT - 40), Math.round((relX - bayStartX) / 5) * 5)
        );

        let subBotY = 0;
        let subSpanH = 320;
        let ivLabel = "";
        if (spec.visual === "sub_divider") {
          const bayObj = mod.bays[targetBayIdx];
          const ivs = bayObj ? getBayShelfIntervalsForSubDivider(bayObj, netH, carcassT) : [];
          const candIvs =
            ivs.filter((iv) => !iv.hasConflict).length > 0
              ? ivs.filter((iv) => !iv.hasConflict)
              : ivs.filter((iv) => iv.conflictReason !== "Çekmece var");
          if (candIvs.length > 0) {
            const bestIv =
              candIvs.find((iv) => cursorElevY >= iv.botY - 18 && cursorElevY <= iv.topY + 18) ||
              candIvs.reduce((best, iv) =>
                Math.abs((iv.botY + iv.topY) / 2 - cursorElevY) <
                Math.abs((best.botY + best.topY) / 2 - cursorElevY)
                  ? iv
                  : best
              );
            subBotY = bestIv.botY;
            subSpanH = Math.max(80, bestIv.height);
            ivLabel = bestIv.label;
          } else {
            subBotY = Math.max(0, Math.min(netH - 320, snappedElevY - 160));
            subSpanH = Math.min(netH - subBotY, 320);
          }
        }

        return {
          mod,
          matchedModIdx,
          carcassT,
          plinthH,
          bayStartX,
          curBayWidth,
          targetBayIdx,
          snappedElevY,
          localBayX,
          subBotY,
          subSpanH,
          ivLabel,
        };
      };

      let autoOpenedOnce = false;

      const onLiveMove = (ev: Event) => {
        if (pausedRef.current) return;
        const detail = (
          ev as CustomEvent<{ id: string; title: string; visual: string; clientX: number; clientY: number }>
        ).detail;
        if (!detail) return;
        const st = latestStateRef.current;
        if (!autoOpenedOnce && st.doorOpenAngleDeg < 15 && !st.doorsHiddenIn3D) {
          autoOpenedOnce = true;
          st.setDoorOpenAngleDeg(85);
        }
        const target = computeLivePlacementFromClient(detail.clientX, detail.clientY, detail);
        if (!target) {
          if (livePartPoolRef.current) {
            livePartPoolRef.current.group.visible = false;
            requestRender();
          }
          window.dispatchEvent(new CustomEvent("birim:live-part-snapped-in-bay", { detail: { active: false } }));
          setSnapBannerDedup(null);
          return;
        }
        window.dispatchEvent(new CustomEvent("birim:live-part-snapped-in-bay", { detail: { active: true } }));
        const pool = ensureLivePartPool(target.mod);
        if (!pool) return;

        const { mod, carcassT, plinthH, bayStartX, curBayWidth, targetBayIdx, snappedElevY, localBayX, subBotY, subSpanH, ivLabel } = target;
        const pl = calculateModulePlacement(mod);
        const placeLocalToWorld = (lx: number, ly: number, lz: number) => {
          const cosR = Math.cos(pl.rotationYRad);
          const sinR = Math.sin(pl.rotationYRad);
          return new THREE.Vector3(
            pl.origin.x + lx * cosR + lz * sinR,
            pl.origin.y + ly,
            pl.origin.z - lx * sinR + lz * cosR
          );
        };
        const baseYLocal = plinthH + carcassT;
        const partD = Math.max(180, mod.dimensions.depth - 30);
        const centerZLocal = 10 + partD / 2;
        pool.group.rotation.y = pl.rotationYRad;

        pool.woodBox.visible = false;
        pool.handleBar.visible = false;
        pool.metalRod.visible = false;

        pool.group.position.set(pl.origin.x, pl.origin.y, pl.origin.z);
        void placeLocalToWorld;
        if (detail.visual === "sub_divider") {
          pool.woodBox.visible = true;
          pool.woodBox.scale.set(carcassT, subSpanH, partD);
          pool.woodBox.position.set(bayStartX + localBayX + carcassT / 2, baseYLocal + subBotY + subSpanH / 2, centerZLocal);
          setSnapBannerDedup(`📐 ${detail.title} • Bölme ${targetBayIdx + 1} (${ivLabel || "Raf Arası"}) • X: ${localBayX} mm`);
        } else if (detail.visual === "rail") {
          pool.metalRod.visible = true;
          pool.metalRod.scale.set(curBayWidth - 6, 22, 22);
          pool.metalRod.position.set(bayStartX + curBayWidth / 2, baseYLocal + snappedElevY, centerZLocal);
          setSnapBannerDedup(`📐 ${detail.title} • Bölme ${targetBayIdx + 1} • Y: ${snappedElevY} mm`);
        } else if (detail.visual === "drawer" || detail.visual === "internal_drawer") {
          pool.woodBox.visible = true;
          pool.woodBox.scale.set(curBayWidth - 6, 180, partD - 12);
          pool.woodBox.position.set(bayStartX + curBayWidth / 2, baseYLocal + snappedElevY + 90, centerZLocal);
          if (detail.visual === "drawer") {
            pool.handleBar.visible = true;
            pool.handleBar.scale.set(Math.min(140, curBayWidth * 0.35), 10, 18);
            pool.handleBar.position.set(bayStartX + curBayWidth / 2, baseYLocal + snappedElevY + 115, mod.dimensions.depth - 12);
          }
          setSnapBannerDedup(`📐 ${detail.title} • Bölme ${targetBayIdx + 1} • Y: ${snappedElevY} mm`);
        } else {
          const shThick = detail.id === "lib_fixed_shelf" ? 25 : carcassT;
          const isAccessoryTray =
            detail.visual === "trouser_rack" || detail.visual === "shoe_rack" || detail.visual === "jewelry_tray";
          pool.woodBox.visible = true;
          pool.woodBox.scale.set(curBayWidth - 3, isAccessoryTray ? 64 : shThick, partD);
          pool.woodBox.position.set(
            bayStartX + curBayWidth / 2,
            baseYLocal + snappedElevY + (isAccessoryTray ? 32 : shThick / 2),
            centerZLocal
          );
          setSnapBannerDedup(`📐 ${detail.title} • Bölme ${targetBayIdx + 1} • Y: ${snappedElevY} mm`);
        }

        requestRender();
      };

      const hideLivePart = () => {
        autoOpenedOnce = false;
        window.dispatchEvent(new CustomEvent("birim:live-part-snapped-in-bay", { detail: { active: false } }));
        if (livePartPoolRef.current) {
          livePartPoolRef.current.group.visible = false;
          requestRender();
        }
      };

      const onLiveCancel = () => {
        hideLivePart();
        setSnapBannerDedup(null);
      };

      const onLiveDrop = (ev: Event) => {
        if (pausedRef.current) return;
        const detail = (
          ev as CustomEvent<{ id: string; title: string; visual: string; clientX: number; clientY: number; dropId?: string }>
        ).detail;
        hideLivePart();
        if (!detail) return;
        // V77: Strict single-insert dedupe lock (prevents duplicate inserts across mounted viewports or double pointer events!)
        const winAny = window as unknown as { __birimLastPartDropId?: string; __birimLastPartDropTs?: number };
        const nowMs = Date.now();
        if (
          (detail.dropId && winAny.__birimLastPartDropId === detail.dropId) ||
          (typeof winAny.__birimLastPartDropTs === "number" && nowMs - winAny.__birimLastPartDropTs < 240)
        ) {
          return;
        }
        winAny.__birimLastPartDropId = detail.dropId || String(nowMs);
        winAny.__birimLastPartDropTs = nowMs;

        const target = computeLivePlacementFromClient(detail.clientX, detail.clientY, detail);
        if (!target) {
          setSnapBannerDedup(null);
          return;
        }
        const elevToCommit =
          detail.visual === "sub_divider"
            ? Math.round(target.subBotY + target.subSpanH / 2)
            : target.snappedElevY;
        // Synchronously switch Zustand activeModuleIndex BEFORE inserting so it ALWAYS lands in the exact hovered module!
        if (typeof target.matchedModIdx === "number") {
          useConfiguratorStore.getState().setActiveModuleIndex(target.matchedModIdx);
          useConfiguratorStore.getState().setActiveBayIndex(target.targetBayIdx);
        }
        latestStateRef.current.addInteriorItemAtElevation(target.targetBayIdx, detail.id, elevToCommit, {
          offsetX: target.localBayX,
          exactElevation: true,
        });
        setSnapBannerDedup(`✓ ${detail.title} yerleştirildi • Bölme ${target.targetBayIdx + 1}`);
        setTimeout(() => setSnapBannerDedup(null), 2400);
      };

      const onLiveMaterialDrop = (ev: Event) => {
        if (pausedRef.current) return;
        const detail = (
          ev as CustomEvent<{ materialId: string; materialName?: string; clientX: number; clientY: number }>
        ).detail;
        if (!detail?.materialId) return;
        const curRenderer = rendererRef.current;
        const cam = (controlsRef.current?.object as THREE.Camera) || perspCamRef.current;
        if (!curRenderer || !cam) return;
        const rect = curRenderer.domElement.getBoundingClientRect();
        if (
          rect.width <= 0 ||
          rect.height <= 0 ||
          detail.clientX < rect.left ||
          detail.clientX > rect.right ||
          detail.clientY < rect.top ||
          detail.clientY > rect.bottom
        ) {
          return;
        }
        const ndcX = ((detail.clientX - rect.left) / rect.width) * 2 - 1;
        const ndcY = -((detail.clientY - rect.top) / rect.height) * 2 + 1;
        const rc = new THREE.Raycaster();
        rc.setFromCamera(new THREE.Vector2(ndcX, ndcY), cam);

        const st = latestStateRef.current;
        if (sceneObjectsGroupRef.current) {
          const soHits = rc.intersectObject(sceneObjectsGroupRef.current, true);
          for (const h of soHits) {
            let cur: THREE.Object3D | null = h.object;
            while (cur && !cur.userData?.sceneObjectId) cur = cur.parent;
            if (cur?.userData?.sceneObjectId) {
              (st.updateSceneObject as (id: string, p: Record<string, unknown>) => void)(
                String(cur.userData.sceneObjectId),
                { materialId: detail.materialId }
              );
              setSnapBannerDedup(`✓ Malzeme atandı: ${detail.materialName || detail.materialId}`);
              setTimeout(() => setSnapBannerDedup(null), 2400);
              return;
            }
          }
        }
        if (meshGroupRef.current) {
          const hits = rc.intersectObject(meshGroupRef.current, true);
          for (const h of hits) {
            if (h.object?.userData?.isSelectionHelper) continue;
            let cur: THREE.Object3D | null = h.object;
            while (cur && !cur.userData?.componentId) cur = cur.parent;
            if (cur?.userData?.componentId) {
              if (
                typeof cur.userData.moduleIndex === "number" &&
                cur.userData.moduleIndex !== st.activeModuleIndex
              ) {
                st.setActiveModuleIndex(cur.userData.moduleIndex);
              }
              (st as unknown as {
                applyMaterialToSimilarComponents?: (
                  matId: string,
                  compId: string,
                  scope: "single"
                ) => void;
              }).applyMaterialToSimilarComponents?.(
                detail.materialId,
                String(cur.userData.componentId),
                "single"
              );
              setSnapBannerDedup(`✓ Malzeme atandı: ${detail.materialName || detail.materialId}`);
              setTimeout(() => setSnapBannerDedup(null), 2400);
              return;
            }
          }
        }
      };

      window.addEventListener("birim:live-3d-part-move", onLiveMove);
      window.addEventListener("birim:live-3d-part-drop", onLiveDrop);
      window.addEventListener("birim:live-3d-part-cancel", onLiveCancel);
      const onLiveHardwareMove = (ev: Event) => {
        if (pausedRef.current) return;
        const detail = (
          ev as CustomEvent<{
            hardwareId: string;
            sku: string;
            name: string;
            familyId: string;
            canMount: boolean;
            clientX: number;
            clientY: number;
          }>
        ).detail;
        if (!detail?.hardwareId) return;
        const target = computeLivePlacementFromClient(detail.clientX, detail.clientY, {
          id: detail.hardwareId,
          title: detail.name,
          visual: detail.familyId,
        });
        if (!target) {
          setSnapBannerDedup("⚠ Donanımı yerleştirmek için bir dolap bölmesinin üzerine sürükleyin");
          return;
        }
        const st = latestStateRef.current;
        const mod = st.project.modules[target.matchedModIdx ?? st.activeModuleIndex] || st.project.modules[0];
        const hw = getHardwareProductById(detail.hardwareId);
        if (mod && hw) {
          const check = evaluateHardwareMountPlacement(mod, hw, target.targetBayIdx);
          if (check.canMount) {
            setSnapBannerDedup(
              `✓ Geçerli Montaj Noktası • Bölme ${target.targetBayIdx + 1} (${check.targetSurface}) • ${hw.sku}`
            );
          } else {
            const firstErr = check.issues.find((i) => i.severity === "error");
            setSnapBannerDedup(
              `✕ Geçersiz Alan (Bölme ${target.targetBayIdx + 1}): ${firstErr?.reasonTr || check.summaryTr}`
            );
          }
        }
      };

      const onLiveHardwareCancel = () => {
        setSnapBannerDedup(null);
      };

      const onLiveHardwareDrop = (ev: Event) => {
        if (pausedRef.current) return;
        const detail = (
          ev as CustomEvent<{
            hardwareId: string;
            sku: string;
            name: string;
            familyId: string;
            clientX: number;
            clientY: number;
          }>
        ).detail;
        if (!detail?.hardwareId) return;
        const target = computeLivePlacementFromClient(detail.clientX, detail.clientY, {
          id: detail.hardwareId,
          title: detail.name,
          visual: detail.familyId,
        });
        if (!target) {
          setSnapBannerDedup(null);
          return;
        }
        const st = latestStateRef.current;
        if (typeof target.matchedModIdx === "number" && target.matchedModIdx !== st.activeModuleIndex) {
          st.setActiveModuleIndex(target.matchedModIdx);
        }
        const res = useConfiguratorStore.getState().applyHardwareProductToBay(target.targetBayIdx, detail.hardwareId);
        setSnapBannerDedup(res.applied ? `✓ ${res.messageTr}` : `⚠ ${res.messageTr}`);
        setTimeout(() => setSnapBannerDedup(null), 3200);
      };

      window.addEventListener("birim:live-material-drop", onLiveMaterialDrop);
      window.addEventListener("birim:live-hardware-move", onLiveHardwareMove);
      window.addEventListener("birim:live-hardware-drop", onLiveHardwareDrop);
      window.addEventListener("birim:live-hardware-cancel", onLiveHardwareCancel);
      return () => {
        window.removeEventListener("birim:live-3d-part-move", onLiveMove);
        window.removeEventListener("birim:live-3d-part-drop", onLiveDrop);
        window.removeEventListener("birim:live-3d-part-cancel", onLiveCancel);
        window.removeEventListener("birim:live-material-drop", onLiveMaterialDrop);
        window.removeEventListener("birim:live-hardware-move", onLiveHardwareMove);
        window.removeEventListener("birim:live-hardware-drop", onLiveHardwareDrop);
        window.removeEventListener("birim:live-hardware-cancel", onLiveHardwareCancel);
      };
    }, [project.customMaterials, requestRender, setSnapBannerDedup]);

const clear3DGhostPreview = useCallback(() => {
      setIsDraggingItemOver3D(false);
      lastGhostKeyRef.current = "";
      if (ghostSnapGroupRef.current) {
        disposeObject3DTree(ghostSnapGroupRef.current);
        ghostSnapGroupRef.current.clear();
        requestRender();
      }
    }, [requestRender]);

    const resolve3DHitPointFromDragEvent = (e: React.DragEvent<HTMLDivElement>): THREE.Vector3 => {
      const rect = e.currentTarget.getBoundingClientRect();
      const cam = (controlsRef.current?.object as THREE.Camera) || perspCamRef.current;
      const hitPt = new THREE.Vector3();
      if (cam && rect.width > 0 && rect.height > 0) {
        const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        const rc = new THREE.Raycaster();
        rc.setFromCamera(new THREE.Vector2(ndcX, ndcY), cam);

        // O(1) cached raycast (zero recursive scene traversal & zero mid-drag React setState!)
        if (meshGroupRef.current) {
          const solidMeshes = getCachedSolidMeshes(meshGroupRef.current, true);
          const hits = rc.intersectObjects(solidMeshes, false);
          if (hits.length > 0) {
            return hits[0].point.clone();
          }
        }

        const mod = activeModule || project.modules[0];
        const planeZ = mod ? (mod.position.z + mod.dimensions.depth / 2) : 280;
        const cabinetPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -planeZ);
        if (rc.ray.intersectPlane(cabinetPlane, hitPt)) {
          return hitPt;
        }
        const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        if (rc.ray.intersectPlane(floorPlane, hitPt)) {
          return hitPt;
        }
      }
      return hitPt;
    };

    const resolve3DWorldXFromDragEvent = (e: React.DragEvent<HTMLDivElement>): number => {
      const rect = e.currentTarget.getBoundingClientRect();
      const cam = (controlsRef.current?.object as THREE.Camera) || perspCamRef.current;
      if (cam && rect.width > 0 && rect.height > 0) {
        const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        const rc = new THREE.Raycaster();
        rc.setFromCamera(new THREE.Vector2(ndcX, ndcY), cam);
        // Intersect with vertical cabinet front/mid plane Z=280mm or floor plane Y=0mm
        const wallPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -280);
        const hitPt = new THREE.Vector3();
        if (rc.ray.intersectPlane(wallPlane, hitPt)) {
          return Math.max(0, Math.round(hitPt.x));
        }
        const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        if (rc.ray.intersectPlane(floorPlane, hitPt)) {
          return Math.max(0, Math.round(hitPt.x));
        }
      }
      const relX = Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)));
      const wallLen = spaceWalls?.[0]?.length || 3600;
      return Math.round((relX * wallLen) / 50) * 50;
    };

    const handle3DDragOver = (e: React.DragEvent<HTMLDivElement>) => {
      const draggedMat = typeof window !== "undefined" ? (window as any).__birimDraggedMaterial : null;
      const hasMatMime = e.dataTransfer.types.includes("application/x-birim-material");
      if (hasMatMime || draggedMat) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        if (draggedMat?.materialName) {
          setSnapBannerDedup(`🎨 ${draggedMat.materialName} — Uygulamak için ürün yüzeyine bırakın`);
        }
        return;
      }
      const activeAcc = typeof window !== "undefined" ? (window as any).__birimActiveDraggedAccessory : null;
      const hasAccessoryMime = e.dataTransfer.types.includes("application/x-birim-accessory-id");

      // CASE 1: ACCESSORY / INTERIOR ITEM DRAG
      if (hasAccessoryMime || activeAcc) {
        e.preventDefault();
        void isDraggingItemOver3D;
        e.dataTransfer.dropEffect = "copy";
        const mod = activeModule || project.modules[0];
        if (!mod) return;

        const hit = resolve3DHitPointFromDragEvent(e);
        const relX = hit.x - mod.position.x;
        const relY = hit.y - mod.position.y;

        const carcassT = mod.carcass?.panelThickness || 18;
        const plinthH = mod.carcass?.plinthHeight || 0;
        const netH = calculateNetInnerHeight(mod);
        const bayWidths = calculateBayWidths(mod);

        // 1. Identify which Bay is hovered
        let targetBayIdx = 0;
        let accX = carcassT;
        let bayStartX = carcassT;
        let curBayWidth = bayWidths[0] || 500;

        for (let i = 0; i < bayWidths.length; i++) {
          const bw = bayWidths[i];
          if (relX >= accX && relX <= accX + bw + carcassT) {
            targetBayIdx = i;
            bayStartX = accX;
            curBayWidth = bw;
            break;
          }
          accX += bw + carcassT;
        }
        targetBayIdx = Math.max(0, Math.min(mod.bays.length - 1, targetBayIdx));

        // 2. Identify Elevation Y (snapped to 32mm hole pattern) & Horizontal Offset X inside Bay
        const cursorElevY = relY - plinthH - carcassT;
        const snappedElevY = Math.max(64, Math.min(netH - 64, Math.round(cursorElevY / 32) * 32));
        const localBayX = Math.max(
          48,
          Math.min(curBayWidth - 48, Math.round((relX - bayStartX) / 10) * 10)
        );
        const accKind = activeAcc?.visual || "shelf";
        const isVerticalDivider = accKind === "sub_divider" || accKind === "carcass_divider";

        // If sub_divider (Raf Arası Dikme), find shelf immediately below & above cursor
        const bayShelves = [...(mod.bays[targetBayIdx]?.shelves || [])].sort(
          (a, b) => a.elevationY - b.elevationY
        );
        let subBotY = 0;
        let subTopY = netH;
        if (accKind === "sub_divider") {
          for (const sh of bayShelves) {
            if (sh.elevationY <= cursorElevY) {
              subBotY = sh.elevationY + (sh.thickness || carcassT);
            } else if (sh.elevationY > cursorElevY && subTopY === netH) {
              subTopY = sh.elevationY;
            }
          }
          if (subTopY - subBotY < 96) {
            subBotY = Math.max(0, Math.min(netH - 320, snappedElevY - 160));
            subTopY = Math.min(netH, subBotY + 320);
          }
        }
        const subSpanH = Math.max(120, subTopY - subBotY);

        lastAccessoryDropTargetRef.current = {
          bayIndex: targetBayIdx,
          elevationY: accKind === "sub_divider" ? Math.round((subBotY + subTopY) / 2) : snappedElevY,
          offsetX: localBayX,
          accessory: activeAcc || { id: "lib_shelf", title: "Raf", visual: "shelf" },
        };

        const ghostKey = `acc_${targetBayIdx}_${snappedElevY}_${isVerticalDivider ? localBayX : 0}_${activeAcc?.id || "shelf"}`;
        if (lastGhostKeyRef.current !== ghostKey && ghostSnapGroupRef.current) {
          lastGhostKeyRef.current = ghostKey;
          const gGroup = ghostSnapGroupRef.current;
          disposeObject3DTree(gGroup);
          gGroup.clear();

          // Render Ghost Accessory Mesh
          const ghostWorldX = mod.position.x + bayStartX;
          const ghostWorldY = mod.position.y + plinthH + carcassT + snappedElevY;
          const ghostWorldZ = mod.position.z + 10;
          const ghostD = mod.dimensions.depth - 30;

          let accGeo: THREE.BufferGeometry;
          if (accKind === "sub_divider") {
            accGeo = new THREE.BoxGeometry(carcassT, subSpanH, ghostD);
          } else if (accKind === "carcass_divider") {
            accGeo = new THREE.BoxGeometry(carcassT, netH, ghostD);
          } else if (accKind === "drawer" || accKind === "internal_drawer") {
            accGeo = new THREE.BoxGeometry(curBayWidth - 10, 160, ghostD);
          } else if (accKind === "rail") {
            accGeo = new THREE.CylinderGeometry(12, 12, curBayWidth - 8, 16);
          } else if (accKind === "shelf") {
            accGeo = new THREE.BoxGeometry(curBayWidth - 4, 18, ghostD);
          } else {
            accGeo = new THREE.BoxGeometry(curBayWidth - 12, 100, ghostD);
          }

          const accMesh = new THREE.Mesh(
            accGeo,
            new THREE.MeshBasicMaterial({
              color: 0x2563eb,
              transparent: true,
              opacity: 0.55,
              depthWrite: false,
            })
          );

          if (accKind === "sub_divider") {
            accMesh.position.set(
              ghostWorldX + localBayX,
              mod.position.y + plinthH + carcassT + subBotY + subSpanH / 2,
              ghostWorldZ + ghostD / 2
            );
          } else if (accKind === "carcass_divider") {
            accMesh.position.set(
              ghostWorldX + localBayX,
              mod.position.y + plinthH + carcassT + netH / 2,
              ghostWorldZ + ghostD / 2
            );
          } else if (accKind === "rail") {
            accMesh.rotation.z = Math.PI / 2;
            accMesh.position.set(ghostWorldX + curBayWidth / 2, ghostWorldY, ghostWorldZ + ghostD / 2);
          } else if (accKind === "drawer" || accKind === "internal_drawer") {
            accMesh.position.set(ghostWorldX + curBayWidth / 2, ghostWorldY + 80, ghostWorldZ + ghostD / 2);
          } else if (accKind === "shelf") {
            accMesh.position.set(ghostWorldX + curBayWidth / 2, ghostWorldY + 9, ghostWorldZ + ghostD / 2);
          } else {
            accMesh.position.set(ghostWorldX + curBayWidth / 2, ghostWorldY + 50, ghostWorldZ + ghostD / 2);
          }

          accMesh.add(
            new THREE.LineSegments(
              new THREE.EdgesGeometry(accGeo),
              new THREE.LineBasicMaterial({ color: 0x60a5fa, linewidth: 2 })
            )
          );
          gGroup.add(accMesh);

          // Laser measurement guide rod
          if (isVerticalDivider) {
            add3DRod(
              gGroup,
              new THREE.Vector3(ghostWorldX, mod.position.y + plinthH + carcassT + subBotY + 30, mod.position.z + ghostD),
              new THREE.Vector3(ghostWorldX + localBayX, mod.position.y + plinthH + carcassT + subBotY + 30, mod.position.z + ghostD),
              3.5,
              snapSlotActiveRodMat
            );
          } else {
            add3DRod(
              gGroup,
              new THREE.Vector3(ghostWorldX + 25, mod.position.y + plinthH + carcassT, mod.position.z + 25),
              new THREE.Vector3(ghostWorldX + 25, ghostWorldY, mod.position.z + 25),
              3.5,
              snapSlotActiveRodMat
            );
          }

          requestRender();
        }

        if (accKind === "sub_divider") {
          setSnapBannerDedup(
            `📐 Raf Arası Dikme • Bölme ${targetBayIdx + 1} • Sol Mesafe X: ${localBayX} mm (Boy: ${subSpanH} mm)`
          );
        } else if (accKind === "carcass_divider") {
          setSnapBannerDedup(
            `📐 Ara Dikme (Bölme ${targetBayIdx + 1} İç Düzeniyle 2'ye Bölünür) • X: ${localBayX} mm`
          );
        } else {
          setSnapBannerDedup(`📐 ${activeAcc?.title || "Aksesuar"} • Bölme ${targetBayIdx + 1} • Y: ${snappedElevY} mm`);
        }
        return;
      }

      // CASE 1.5: V5 SCENE OBJECT (APPLIANCE / FURNITURE / GLB) DRAG
      const hasSceneObjMime = e.dataTransfer.types.includes("application/x-birim-scene-object-id");
      const activeSceneCatId = getActiveDraggedSceneCatalogId();
      if (hasSceneObjMime || activeSceneCatId) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        const wx = resolve3DWorldXFromDragEvent(e);
        setSnapBannerDedup(`🧲 3D OBJE YERLEŞTİRME: X ≈ ${wx} mm (Yüzey / Tezgâh Mıknatısı Aktif)`);
        return;
      }

      // CASE 2: MODULE / CABINET DRAG
      const hasMime = e.dataTransfer.types.includes("application/x-birim-template-id");
      const activeTplId = getActiveDraggedTemplateId();
      if (!hasMime && !activeTplId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";

      const rawWorldX = resolve3DWorldXFromDragEvent(e);
      const tplId = activeTplId || "v4_kb_01_single_door";
      const preview = computeRowSnapPreview(project, tplId, rawWorldX);
      if (!preview) return;

      const ghostKey = `${preview.templateId}_${preview.snappedX}_${preview.snappedY}_${preview.isSnappedToSlot ? 1 : 0}`;
      if (lastGhostKeyRef.current !== ghostKey && ghostSnapGroupRef.current) {
        lastGhostKeyRef.current = ghostKey;
        const gGroup = ghostSnapGroupRef.current;
        disposeObject3DTree(gGroup);
        gGroup.clear();

        // A. Render ALL Magnetic Snap Target Slots along the wall (Vertical Laser Guides + Floor/Wall Target Pads)
        preview.snapSlots.forEach((slot) => {
          const rodMat = slot.isActive ? snapSlotActiveRodMat : snapSlotIdleRodMat;
          const rodRadius = slot.isActive ? 6.5 : 4;
          // Left snap edge vertical laser line
          add3DRod(
            gGroup,
            new THREE.Vector3(slot.x, slot.y, 0),
            new THREE.Vector3(slot.x, slot.y + slot.height + 180, 0),
            rodRadius,
            rodMat
          );
          add3DRod(
            gGroup,
            new THREE.Vector3(slot.x, slot.y, slot.depth),
            new THREE.Vector3(slot.x, slot.y + slot.height + 180, slot.depth),
            rodRadius,
            rodMat
          );
          if (slot.isActive) {
            // Right edge laser line for the locked snap slot
            add3DRod(
              gGroup,
              new THREE.Vector3(slot.x + slot.width, slot.y, slot.depth),
              new THREE.Vector3(slot.x + slot.width, slot.y + slot.height + 180, slot.depth),
              rodRadius,
              rodMat
            );
          }

          // Magnetic Slot Footprint Target Box
          const padGeo = new THREE.BoxGeometry(slot.width, 10, slot.depth);
          const padMesh = new THREE.Mesh(
            padGeo,
            new THREE.MeshBasicMaterial({
              color: slot.isActive ? 0x10b981 : 0xf59e0b,
              transparent: true,
              opacity: slot.isActive ? 0.36 : 0.14,
              depthWrite: false,
            })
          );
          padMesh.position.set(slot.x + slot.width / 2, slot.y + 5, slot.depth / 2);
          padMesh.add(
            new THREE.LineSegments(
              new THREE.EdgesGeometry(padGeo),
              slot.isActive ? ghostLockedEdgeMat : ghostFreeEdgeMat
            )
          );
          gGroup.add(padMesh);
        });

        // B. Render Full-Scale 3D Ghost Cabinet Silhouette at (snappedX, snappedY, 0)
        const ghostBreakdown = generateModuleGeometry(preview.previewModule, {
          doorOpenAngleDeg: 0,
          drawerOpenMm: 0,
          explodedFactor: 0,
        });
        const ghostModContainer = createModuleGroup(preview.previewModule);
        const fillMat = preview.isSnappedToSlot ? ghostLockedMat : ghostFreeMat;
        const lineMat = preview.isSnappedToSlot ? ghostLockedEdgeMat : ghostFreeEdgeMat;

        ghostBreakdown.components.forEach((comp) => {
          ghostModContainer.add(
            createComponentMesh(comp, fillMat, lineMat, {
              componentId: comp.id,
              role: comp.role,
              moduleIndex: -1,
            })
          );
        });
        gGroup.add(ghostModContainer);
        requestRender();
      }

      setSnapBannerDedup(
        `🧲 SİLUET SNAP: ${preview.previewModule.name} (${preview.previewModule.dimensions.width}×${preview.previewModule.dimensions.height}mm) → ${preview.snapLabel}`
      );
    };

    const handle3DDrop = (e: React.DragEvent<HTMLDivElement>) => {
      const rawMatJson = e.dataTransfer.getData("application/x-birim-material");
      const winDraggedMat = typeof window !== "undefined" ? (window as any).__birimDraggedMaterial : null;
      let droppedMat: { materialId: string; materialName?: string } | null = winDraggedMat;
      if (!droppedMat && rawMatJson) {
        try { droppedMat = JSON.parse(rawMatJson); } catch {}
      }
      if (droppedMat?.materialId) {
        e.preventDefault();
        if (typeof window !== "undefined") (window as any).__birimDraggedMaterial = null;
        const curRenderer = rendererRef.current;
        const curGroup = meshGroupRef.current;
        const curCam = (controlsRef.current?.object as THREE.Camera) || perspCamRef.current;
        if (curRenderer && curGroup && curCam) {
          const rect = curRenderer.domElement.getBoundingClientRect();
          const ndc = new THREE.Vector2(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            -((e.clientY - rect.top) / rect.height) * 2 + 1
          );
          const rc = new THREE.Raycaster();
          rc.setFromCamera(ndc, curCam);
          const hits = rc.intersectObjects(curGroup.children, true);
          const hit = hits.find((h) => h.object instanceof THREE.Mesh && typeof h.object.userData?.moduleIndex === "number");
          if (hit) {
            const mIdx = Number(hit.object.userData.moduleIndex);
            const role = String(hit.object.userData.role || "");
            const cid = String(hit.object.userData.componentId || "");
            const matId = droppedMat.materialId;
            const st = useConfiguratorStore.getState();
            let zoneLabel = "Gövde";
            st.applyBatchProjectUpdate((draft) => {
              const m = draft.modules[mIdx];
              if (!m) return;
              if (role === "door" || role.startsWith("door_") && role !== "door_handle" && role !== "door_hinge" || role === "drawer_front") {
                m.carcass.doorMaterialId = matId;
                m.bays.forEach((b) => { if (b.door) b.door.doorMaterialId = matId; });
                zoneLabel = "Kapak & Cephe";
              } else if (role === "door_handle" || role === "drawer_handle" || role === "gola_profile") {
                m.bays.forEach((b) => { if (b.door) b.door.handleMaterialId = matId; });
                zoneLabel = "Kulp / Gola";
              } else if (role === "countertop" || cid.includes("countertop")) {
                m.carcass.countertopMaterialId = matId;
                zoneLabel = "Tezgâh";
              } else if (role === "plinth" || cid.includes("plinth")) {
                m.carcass.plinthMaterialId = matId;
                zoneLabel = "Baza";
              } else {
                m.carcass.bodyMaterialId = matId;
                zoneLabel = "Gövde";
              }
            }, "Sürükle-bırak malzeme uygulandı");
            st.setActiveModuleIndex(mIdx);
            setSnapBannerDedup(`✓ ${droppedMat.materialName || "Malzeme"} → Modül #${mIdx + 1} ${zoneLabel} uygulandı`);
            setTimeout(() => setSnapBannerDedup(null), 2600);
          } else {
            setSnapBannerDedup(null);
          }
        }
        return;
      }
      const activeAcc = typeof window !== "undefined" ? (window as any).__birimActiveDraggedAccessory : null;
      const hasAccessoryMime = e.dataTransfer.types.includes("application/x-birim-accessory-id");

      if (hasAccessoryMime || activeAcc || lastAccessoryDropTargetRef.current) {
        e.preventDefault();
        clear3DGhostPreview();
        const dropInfo = lastAccessoryDropTargetRef.current;
        const acc = dropInfo?.accessory || activeAcc || { id: "lib_shelf", title: "Raf" };
        const bayIdx = dropInfo ? dropInfo.bayIndex : 0;
        const elevY = dropInfo ? dropInfo.elevationY : 400;

        addInteriorItemAtElevation(bayIdx, acc.id, elevY, { offsetX: dropInfo?.offsetX });

        // Auto-open doors if closed so the user sees the newly placed accessory
        if (doorOpenAngleDeg === 0) {
          setDoorOpenAngleDeg(85);
        }

        setSnapBannerDedup(`✓ ${acc.title} yerleştirildi: Bölme ${bayIdx + 1} (Y: ${elevY} mm)`);
        setTimeout(() => setSnapBannerDedup(null), 3500);

        lastAccessoryDropTargetRef.current = null;
        if (typeof window !== "undefined") {
          (window as any).__birimActiveDraggedAccessory = null;
        }
        return;
      }

      // Detect if user dropped directly onto a 3D Wall (or fall back to selected activeWallId)
      let dropWallId: string | undefined = useConfiguratorStore.getState().activeWallId || undefined;
      let dropHitPoint: THREE.Vector3 | null = null;
      if (rendererRef.current && roomArchGroupRef.current) {
        const dRect = rendererRef.current.domElement.getBoundingClientRect();
        const curCamD = (controlsRef.current?.object as THREE.Camera) || perspCamRef.current;
        if (dRect.width > 0 && dRect.height > 0 && curCamD) {
          const dRay = new THREE.Raycaster();
          dRay.setFromCamera(
            new THREE.Vector2(
              ((e.clientX - dRect.left) / dRect.width) * 2 - 1,
              -((e.clientY - dRect.top) / dRect.height) * 2 + 1
            ),
            curCamD
          );
          const wHits = dRay.intersectObjects(roomArchGroupRef.current.children, true);
          for (const wh of wHits) {
            if (wh.object?.userData?.isRoomWall && wh.object.userData.wallId) {
              dropWallId = String(wh.object.userData.wallId);
              dropHitPoint = wh.point.clone();
              useConfiguratorStore.getState().setActiveWallId(dropWallId);
              break;
            }
          }
        }
      }
      const effDropWalls = getEffectiveSpaceWalls(project);
      const primaryWallId = effDropWalls[0]?.id || "wall_main";
      const isSecondaryTargetWall = Boolean(
        dropWallId && (dropWallId !== primaryWallId || effDropWalls.length > 1)
      );

      const droppedSceneCatId =
        e.dataTransfer.getData("application/x-birim-scene-object-id") ||
        getActiveDraggedSceneCatalogId();
      if (droppedSceneCatId) {
        e.preventDefault();
        clear3DGhostPreview();
        setActiveDraggedSceneCatalogId(null);
        const wx = dropHitPoint ? dropHitPoint.x : resolve3DWorldXFromDragEvent(e);
        const wz = dropHitPoint ? dropHitPoint.z : 0;
        const placed = addSceneObjectFromCatalog(droppedSceneCatId, {
          x: wx,
          z: wz,
          wallId: dropWallId,
        });
        if (placed) {
          setSnapBannerDedup(`✓ ${placed.name} hedef duvara yerleştirildi`);
          setTimeout(() => setSnapBannerDedup(null), 3200);
        }
        return;
      }

      const tplId =
        e.dataTransfer.getData("application/x-birim-template-id") ||
        getActiveDraggedTemplateId();
      clear3DGhostPreview();
      setActiveDraggedTemplateId(null);
      if (!tplId) return;
      e.preventDefault();
      if (isSecondaryTargetWall && dropWallId) {
        const placedMod = useConfiguratorStore.getState().appendModuleWithMultiWallSnap(tplId, {
          wallId: dropWallId,
          ...(dropHitPoint ? { worldX: dropHitPoint.x, worldZ: dropHitPoint.z } : {}),
        });
        const wName = effDropWalls.find((w) => w.id === dropWallId)?.name || "Seçili Duvar";
        if (placedMod) {
          setSnapBannerDedup(`✓ ${placedMod.name} → ${wName} üzerine yerleştirildi`);
          setTimeout(() => setSnapBannerDedup(null), 3200);
        }
        return;
      }
      const rawWorldX = resolve3DWorldXFromDragEvent(e);
      const res = dropV4TemplateWithSnap(tplId, rawWorldX);
      if (res) {
        setSnapBannerDedup(`✓ ${res.placedName} → ${res.snapLabel}`);
        setTimeout(() => setSnapBannerDedup(null), 3200);
      } else {
        setSnapBannerDedup(null);
      }
    };

    return (
      <div
        data-testid="v3-three-viewport-dropzone"
        onDragOver={handle3DDragOver}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            clear3DGhostPreview();
            setSnapBannerDedup(null);
          }
        }}
        onDrop={handle3DDrop}
        className="relative w-full h-full select-none overflow-hidden"
      >
        {webglUnavailable && (
          <div className="absolute inset-0 z-40">
            <Software3DFallbackViewport
              project={project}
              activeModuleIndex={activeModuleIndex}
              selectedComponentId={selectedComponentId}
              selectedSceneObjectId={selectedSceneObjectId}
              doorOpenAngleDeg={doorOpenAngleDeg}
              drawerOpenMm={drawerOpenMm}
              explodedFactor={explodedFactor}
              gpuRendererInfo={webglCapability?.gpuRendererInfo}
              failureReason={webglCapability?.failureReason}
              onSelectModule={(idx) => setActiveModuleIndex(idx)}
              onSelectComponent={(cid) => setSelectedComponentId(cid)}
              onSelectSceneObject={(oid) => setSelectedSceneObjectId(oid)}
              onToggleDoorOpen={() => setDoorOpenAngleDeg(doorOpenAngleDeg > 5 ? 0 : 75)}
              onRetryWebGL={() => setWebglRetryKey((k) => k + 1)}
              onSwitchTo2DCad={onRequest2DElevation}
            />
          </div>
        )}
        {/* Alt-Orta HUD Yığını: Hover Bilgisi, Yerleştirme Bildirimi ve Seçili Obje Çubuğu asla üst üste binmez */}
        <div
          style={{ bottom: `${(stageSafeInsets?.bottomPx ?? 14) + 56}px` }}
          className="absolute left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1.5 max-w-[calc(100%-24px)] pointer-events-none transition-[bottom] duration-200"
        >
          <div
            ref={hoverBadgeDomRef}
            data-testid="viewport-3d-hover-object-badge"
            style={{ display: "none" }}
            className="pointer-events-none px-3 py-1 rounded-lg bg-[#141413]/90 text-[#FAF9F6] border border-[#D8D3C8]/30 shadow-md text-[11px] font-medium items-center gap-2 backdrop-blur-sm whitespace-nowrap"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#D8D3C8]" />
            <span ref={hoverBadgeTextRef} />
          </div>
          <div
            ref={snapBannerDomRef}
            data-testid="viewport-3d-dragdrop-snap-banner"
            style={{ display: "none" }}
            className="pointer-events-auto max-w-full px-3.5 py-1.5 rounded-full bg-[#FAF8F4]/95 backdrop-blur-xl text-[#141413] border border-[#DFD9CE] shadow-lg font-mono text-[11px] font-bold items-center gap-2"
          >
            <span className="w-2 h-2 rounded-full bg-[#38BDF8] shrink-0" />
            <span ref={snapBannerTextRef} className="truncate" />
            <button
              type="button"
              onClick={() => setSnapBannerDedup(null)}
              className="ml-1 text-[#78716C] hover:text-[#141413] font-bold cursor-pointer shrink-0"
            >
              ✕
            </button>
          </div>
          {selectedSceneObjectId && (() => {
            const selObj = (project.sceneObjects || []).find((o) => o.id === selectedSceneObjectId);
            if (!selObj) return null;
            return (
              <div
                data-testid="v5-selected-scene-object-hud"
                className="pointer-events-auto px-3.5 py-2 rounded-2xl birim-ice-dark-bar text-white flex flex-wrap items-center justify-center gap-2 shadow-xl text-[11px]"
              >
                <span className="font-bold text-amber-300 truncate max-w-[180px]">{selObj.name}</span>
                <button
                  type="button"
                  onClick={() => updateSceneObject(selObj.id, { position: { ...selObj.position, x: Math.max(0, selObj.position.x - 50) } })}
                  className="px-2 py-1 rounded-lg bg-white/15 hover:bg-white/25 font-mono cursor-pointer"
                >
                  ◀ X-50
                </button>
                <button
                  type="button"
                  onClick={() => updateSceneObject(selObj.id, { position: { ...selObj.position, x: selObj.position.x + 50 } })}
                  className="px-2 py-1 rounded-lg bg-white/15 hover:bg-white/25 font-mono cursor-pointer"
                >
                  X+50 ▶
                </button>
                <button
                  type="button"
                  onClick={() => updateSceneObject(selObj.id, { position: { ...selObj.position, z: Math.max(0, selObj.position.z - 50) } })}
                  className="px-2 py-1 rounded-lg bg-white/15 hover:bg-white/25 font-mono cursor-pointer"
                >
                  ▲ Z-50
                </button>
                <button
                  type="button"
                  onClick={() => updateSceneObject(selObj.id, { position: { ...selObj.position, z: selObj.position.z + 50 } })}
                  className="px-2 py-1 rounded-lg bg-white/15 hover:bg-white/25 font-mono cursor-pointer"
                >
                  ▼ Z+50
                </button>
                <button
                  type="button"
                  onClick={() => updateSceneObject(selObj.id, { rotation: { ...selObj.rotation, y: ((selObj.rotation?.y || 0) + 90) % 360 } })}
                  className="px-2.5 py-1 rounded-lg bg-sky-500/30 hover:bg-sky-500/45 font-bold cursor-pointer"
                >
                  ↻ 90°
                </button>
                <button
                  type="button"
                  onClick={() => duplicateSceneObject(selObj.id)}
                  className="px-2 py-1 rounded-lg bg-white/15 hover:bg-white/25 cursor-pointer"
                >
                  Çoğalt
                </button>
                <button
                  type="button"
                  onClick={() => removeSceneObject(selObj.id)}
                  className="px-2 py-1 rounded-lg bg-rose-500/40 hover:bg-rose-500/60 font-bold cursor-pointer"
                >
                  Sil
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSceneObjectId(null)}
                  className="px-1.5 py-1 rounded-lg text-stone-300 hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              </div>
            );
          })()}
        </div>

        <div
          ref={mountRef}
          data-testid="v3-three-canvas"
          className={`w-full h-full ${isCtrlPressed ? "cursor-move" : "cursor-grab active:cursor-grabbing"}`}
        />
        {!paused && (
        <>
        {webglContextLost && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#141413]/75 backdrop-blur-sm p-6">
            <div className="max-w-sm rounded-2xl bg-[#F5F3EE] border border-[#D8D3C8] px-6 py-5 text-center shadow-2xl">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8C7A6B] mb-1">
                3D Grafik Motoru
              </div>
              <div className="text-sm font-bold text-[#141413] mb-1.5">
                WebGL Bağlantısı Yeniden Kuruluyor
              </div>
              <p className="text-xs text-[#57534E] leading-relaxed">
                Ekran kartı sürücüsü sıfırlandı. Tasarım verileriniz güvende, sahne otomatik olarak geri yükleniyor.
              </p>
            </div>
          </div>
        )}

        {/* INTERACTIVE CLICK-TO-EDIT 3D DIMENSION CALLOUT PILLS & FLOATING POPOVER WINDOW */}
        {effectiveShowDimensions && dimLabels.length > 0 && (
          <div
            data-testid="viewport-3d-dim-labels"
            className="absolute inset-0 pointer-events-none overflow-hidden z-[16]"
          >
            {dimLabels.map((item) => {
              const badgeKey: null | "W" | "H" | "D" | "SOKET" =
                item.id === "dim_W"
                  ? "W"
                  : item.id === "dim_H"
                  ? "H"
                  : item.id === "dim_D"
                  ? "D"
                  : item.id === "dim_SOKET"
                  ? "SOKET"
                  : null;
              const isBayBadge = item.id.startsWith("dim_BAY_");
              const bayBadgeIdx = isBayBadge ? Number(item.id.replace("dim_BAY_", "")) : -1;
              const isActiveBayBadge = isBayBadge && bayBadgeIdx === activeBayIndex;
              const isEditingThis = badgeKey !== null && editingBadge === badgeKey;

              return (
                <div
                  key={item.id}
                  data-testid={`viewport-3d-dim-${item.id}`}
                  ref={(el) => {
                    if (el) {
                      dimLabelDomMapRef.current.set(item.id, el);
                    } else {
                      dimLabelDomMapRef.current.delete(item.id);
                    }
                  }}
                  style={{
                    transform: "translate3d(-9999px, -9999px, 0)",
                  }}
                  onMouseDown={(e) => startCalloutBadgeDrag(item.id, e)}
                  onClick={(e) => {
                    if (typeof window !== "undefined" && (window as any).__birimSuppressNextClick && Date.now() - (window as any).__birimSuppressNextClick < 250) {
                      e.stopPropagation();
                      return;
                    }
                    if (isBayBadge && bayBadgeIdx >= 0) {
                      e.stopPropagation();
                      setActiveBayIndex(bayBadgeIdx);
                      setDismissedBayPopover(false);
                      if (typeof window !== "undefined") {
                        window.dispatchEvent(
                          new CustomEvent("birim:select-bay-3d", {
                            detail: {
                              bayIndex: bayBadgeIdx,
                              role: "bay_compartment",
                              moduleIndex: activeModuleIndex,
                            },
                          })
                        );
                      }
                      return;
                    }
                    if (!badgeKey) return;
                    e.stopPropagation();
                    const curVal = dimBounds[badgeKey].current;
                    setBadgeDraftValue(String(curVal));
                    setEditingBadge(badgeKey);
                  }}
                  title={
                    isBayBadge
                      ? `${item.tag} (${item.valueText}) — Bölmeyi seçmek ve iç düzenini açmak için tıklayın`
                      : badgeKey
                      ? `${item.tag} ölçüsünü doğrudan 3D sahnede düzenlemek için tıklayın`
                      : item.tag
                  }
                  className={`absolute top-0 left-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg backdrop-blur-md border whitespace-nowrap transition-all duration-150 shadow-[0_6px_18px_rgba(0,0,0,0.45)] ${
                    item.id.startsWith("dim_SHELF_GAP_")
                      ? "bg-[#15283E]/94 text-white border-[#38BDF8]/80 pointer-events-none"
                      : isActiveBayBadge
                      ? "bg-[#15283E]/96 text-white border-[#38BDF8] ring-1 ring-[#38BDF8]/40 pointer-events-auto cursor-pointer"
                      : isBayBadge
                      ? "bg-[#232935]/90 hover:bg-[#2C3444]/96 text-slate-100 border-white/25 hover:border-[#38BDF8]/70 pointer-events-auto cursor-pointer"
                      : isEditingThis
                      ? "bg-[#15283E]/98 text-white border-2 border-[#38BDF8] pointer-events-auto cursor-pointer"
                      : badgeKey
                      ? "bg-[#222733]/94 hover:bg-[#2B3242]/98 text-white border-white/28 hover:border-[#38BDF8]/80 pointer-events-auto cursor-pointer group"
                      : "bg-[#222733]/92 text-white border-white/22 pointer-events-none"
                  }`}
                >
                  <span
                    className={`text-[10.5px] font-semibold leading-none ${
                      isActiveBayBadge || item.id.startsWith("dim_SHELF_GAP_")
                        ? "text-[#7DD3FC]"
                        : "text-slate-300"
                    }`}
                  >
                    {item.tag}
                  </span>
                  <span
                    className={`text-[12.5px] font-bold leading-none font-mono tabular-nums tracking-tight ${
                      isActiveBayBadge || item.id.startsWith("dim_SHELF_GAP_")
                        ? "text-white"
                        : "text-white"
                    }`}
                  >
                    {item.valueText}
                  </span>
                  {badgeKey && (
                    <span className="text-[10.5px] text-[#7DD3FC] opacity-75 group-hover:opacity-100 transition-opacity leading-none">
                      ✎
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* FAZ 2: 3D HARDWARE SELECTION PINS & CONTEXTUAL CALLOUT CARDS (Matches Birim_Tasarim_5_Donanim_Mekanizmalar.png) */}
        {showInCanvasHud &&
          (hardwareViewMode === "hardware" || hardwareViewMode === "technical") &&
          hwCallouts.length > 0 && (
            <div
              data-testid="viewport-3d-hardware-callouts"
              className="absolute inset-0 pointer-events-none overflow-hidden z-[18]"
            >
              {hwCallouts.map((hc) => {
                const isSelectedPin = selectedHwCalloutId === hc.id;
                return (
                  <div
                    key={hc.id}
                    data-testid={`viewport-3d-hw-${hc.id}`}
                    ref={(el) => {
                      if (el) {
                        hwCalloutDomMapRef.current.set(hc.id, el);
                      } else {
                        hwCalloutDomMapRef.current.delete(hc.id);
                      }
                    }}
                    style={{ transform: "translate3d(-9999px, -9999px, 0)" }}
                    className="absolute top-0 left-0 transition-opacity duration-75"
                  >
                    {/* Blue 3D Hardware Pin Dot at exact 3D coordinate */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedHwCalloutId(hc.id);
                        setActiveBayIndex(hc.bayIndex);
                        if (typeof window !== "undefined") {
                          window.dispatchEvent(
                            new CustomEvent("birim:select-hardware-3d", {
                              detail: {
                                pinId: hc.id,
                                group: hc.group,
                                bayIndex: hc.bayIndex,
                                sku: hc.sku,
                              },
                            })
                          );
                        }
                      }}
                      className={`-translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white shadow-lg pointer-events-auto cursor-pointer transition-transform hover:scale-125 ${
                        isSelectedPin
                          ? "bg-[#1D4ED8] ring-4 ring-[#2563EB]/40 scale-115"
                          : "bg-[#2563EB] ring-2 ring-[#2563EB]/25"
                      }`}
                      title={`${hc.title}: ${hc.subtitle} — Sağ panelde düzenlemek için tıklayın`}
                    />

                    {/* Leader Line + Contextual Hardware Callout Card (Draggable & Collapsible!) */}
                    {!collapsedFloatingPanels.callouts && (
                    <button
                      type="button"
                      data-testid={`viewport-3d-hw-card-${hc.group}`}
                      onMouseDown={(e) => startCalloutBadgeDrag(hc.id, e)}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (typeof window !== "undefined" && (window as any).__birimSuppressNextClick && Date.now() - (window as any).__birimSuppressNextClick < 250) {
                          return;
                        }
                        setSelectedHwCalloutId(hc.id);
                        setActiveBayIndex(hc.bayIndex);
                        if (typeof window !== "undefined") {
                          window.dispatchEvent(
                            new CustomEvent("birim:select-hardware-3d", {
                              detail: {
                                pinId: hc.id,
                                group: hc.group,
                                bayIndex: hc.bayIndex,
                                sku: hc.sku,
                              },
                            })
                          );
                        }
                      }}
                      style={{
                        transform: `translate(${hc.offsetPx[0]}px, ${hc.offsetPx[1]}px)`,
                      }}
                      className={`pointer-events-auto cursor-pointer px-3 py-1.5 rounded-2xl backdrop-blur-md border shadow-xl flex items-center gap-2 text-left whitespace-nowrap transition ${
                        isSelectedPin
                          ? "bg-[#EFF6FF]/98 border-2 border-[#2563EB] ring-2 ring-[#2563EB]/20"
                          : "bg-white/95 hover:bg-[#EFF6FF] border-[#CBD5E1] hover:border-[#2563EB]"
                      }`}
                    >
                      <span className="w-6 h-6 rounded-xl bg-[#F1F5F9] border border-[#E2E8F0] flex items-center justify-center text-[#111827] shrink-0">
                        {hc.group === "hinge" ? (
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <rect x="4" y="6" width="6" height="12" rx="1" />
                            <circle cx="15" cy="12" r="3" />
                            <path d="M10 10h2M10 14h2" />
                          </svg>
                        ) : hc.group === "lighting" ? (
                          <svg className="w-3.5 h-3.5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <path d="M9 18h6M10 22h4M12 2a7 7 0 00-4 12.7V17h8v-2.3A7 7 0 0012 2z" />
                          </svg>
                        ) : hc.group === "accessories" ? (
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <path d="M4 12h16M6 10v4M18 10v4" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <rect x="3" y="7" width="18" height="10" rx="1.5" />
                            <path d="M9 11h6" />
                          </svg>
                        )}
                      </span>
                      <span className="block">
                        <span className="text-[11px] font-extrabold text-[#111827] block leading-tight">
                          {hc.title}
                        </span>
                        <span className="text-[10px] font-medium text-[#475569] block leading-tight mt-0.5">
                          {hc.subtitle}
                        </span>
                      </span>
                      <span className="text-[9px] text-slate-400 ml-1" title="Sürükleyerek taşıyabilirsiniz">⠿</span>
                    </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

        {/* FAZ 2 (SCREEN 6): 3D PART-LEVEL MATERIAL CALLOUT PINS & CARDS (Matches image_dad0ff.jpg: Üst Tabla, Kapak, Sağ Yan Panel, Çekmece Önü, Soket) */}
        {showInCanvasHud && materialModeActive && matCallouts.length > 0 && (
          <div
            data-testid="viewport-3d-material-callouts"
            className="absolute inset-0 pointer-events-none overflow-hidden z-[19]"
          >
            {matCallouts.map((mc) => {
              const isSelectedPart = selectedComponentId === mc.componentId;
              return (
                <div
                  key={mc.id}
                  data-testid={`viewport-3d-mat-${mc.id}`}
                  ref={(el) => {
                    if (el) {
                      matCalloutDomMapRef.current.set(mc.id, el);
                    } else {
                      matCalloutDomMapRef.current.delete(mc.id);
                    }
                  }}
                  style={{ transform: "translate3d(-9999px, -9999px, 0)" }}
                  className="absolute top-0 left-0 transition-opacity duration-75"
                >
                  {/* Blue 3D Part Selection Dot */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      (setSelectedComponentId as (id: string | null, mIdx?: number) => void)(
                        mc.componentId,
                        activeModuleIndex
                      );
                      if (materialPaintTool === "paint") {
                        applyMaterialByTargetScope("selected_part", activeBrushMaterialId, mc.componentId);
                      } else if (materialPaintTool === "group") {
                        applyMaterialByTargetScope(mc.scope, activeBrushMaterialId, mc.componentId);
                      } else if (materialPaintTool === "same_material") {
                        applyMaterialByTargetScope(
                          "same_material_parts",
                          activeBrushMaterialId,
                          mc.componentId
                        );
                      }
                      if (typeof window !== "undefined") {
                        window.dispatchEvent(
                          new CustomEvent("birim:select-material-part-3d", {
                            detail: {
                              componentId: mc.componentId,
                              scope: mc.scope,
                              title: mc.title,
                            },
                          })
                        );
                      }
                    }}
                    className={`-translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white shadow-lg pointer-events-auto cursor-pointer transition-transform hover:scale-125 ${
                      isSelectedPart
                        ? "bg-[#1D4ED8] ring-4 ring-[#2563EB]/40 scale-115"
                        : "bg-[#2563EB] ring-2 ring-[#2563EB]/25"
                    }`}
                  />

                  {/* Contextual Material Callout Card (Draggable!) */}
                  <button
                    type="button"
                    data-testid={`viewport-3d-mat-card-${mc.id}`}
                    onMouseDown={(e) => startCalloutBadgeDrag(mc.id, e)}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (typeof window !== "undefined" && (window as any).__birimSuppressNextClick && Date.now() - (window as any).__birimSuppressNextClick < 250) {
                        return;
                      }
                      (setSelectedComponentId as (id: string | null, mIdx?: number) => void)(
                        mc.componentId,
                        activeModuleIndex
                      );
                      if (materialPaintTool === "paint") {
                        applyMaterialByTargetScope("selected_part", activeBrushMaterialId, mc.componentId);
                      } else if (materialPaintTool === "group") {
                        applyMaterialByTargetScope(mc.scope, activeBrushMaterialId, mc.componentId);
                      } else if (materialPaintTool === "same_material") {
                        applyMaterialByTargetScope(
                          "same_material_parts",
                          activeBrushMaterialId,
                          mc.componentId
                        );
                      }
                      if (typeof window !== "undefined") {
                        window.dispatchEvent(
                          new CustomEvent("birim:select-material-part-3d", {
                            detail: {
                              componentId: mc.componentId,
                              scope: mc.scope,
                              title: mc.title,
                            },
                          })
                        );
                      }
                    }}
                    style={{
                      transform: `translate(${mc.offsetPx[0]}px, ${mc.offsetPx[1]}px)`,
                    }}
                    className={`pointer-events-auto cursor-pointer px-3 py-1.5 rounded-2xl backdrop-blur-md border shadow-xl flex items-center gap-2 text-left whitespace-nowrap transition ${
                      isSelectedPart
                        ? "bg-[#EFF6FF]/98 border-2 border-[#2563EB] ring-2 ring-[#2563EB]/20"
                        : "bg-white/95 hover:bg-[#EFF6FF] border-[#CBD5E1] hover:border-[#2563EB]"
                    }`}
                  >
                    <span
                      className="w-5 h-5 rounded-lg border border-stone-300 shadow-inner shrink-0"
                      style={{ backgroundColor: mc.colorHex }}
                    />
                    <span className="block">
                      <span className="text-xs font-extrabold text-[#111827] block leading-tight">
                        {mc.title}
                      </span>
                      <span className="text-[11px] font-medium text-[#475569] block leading-tight mt-0.5">
                        {mc.subtitle}
                      </span>
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* 3D DIRECT DIMENSION EDITING POPOVER WINDOW (Mevcut değer, Sayısal giriş, Hazır ölçüler, Geçerlilik kontrolü, Enter/Esc) */}
        {editingBadge && (() => {
          const bInfo = dimBounds[editingBadge];
          const draftNum = Number(badgeDraftValue);
          const isNumeric = badgeDraftValue.trim() !== "" && !Number.isNaN(draftNum) && Number.isFinite(draftNum);
          const isOutOfRange = !isNumeric || draftNum < bInfo.min || draftNum > bInfo.max;
          const validPresets = bInfo.presets.filter((p) => p >= bInfo.min && p <= bInfo.max);

          return (
            <div
              ref={dimPopoverDomRef}
              data-floating-card="dim"
              data-testid={`viewport-3d-dim-popover-${editingBadge}`}
              onClick={(e) => e.stopPropagation()}
              style={
                floatingPanelPos.dim
                  ? {
                      left: "0px",
                      top: "0px",
                      translate: "none",
                      transform: `translate3d(${floatingPanelPos.dim.x}px, ${floatingPanelPos.dim.y}px, 0)`,
                    }
                  : undefined
              }
              className={`absolute ${floatingPanelPos.dim ? "top-0 left-0" : "top-[168px] left-1/2 -translate-x-1/2"} z-[55] w-80 birim-ice-popover rounded-[26px] p-4 space-y-3 text-xs text-[#111827] pointer-events-auto`}
            >
              <div
                onPointerDown={(e) => startFloatingPanelDrag("dim", e)}
                title="Pencereyi taşımak için basılı tutup sürükleyin"
                className="flex items-start justify-between gap-2 border-b border-[#E2E8F0] pb-2 cursor-move select-none"
              >
                <div>
                  <div className="text-xs font-bold text-[#111827]">
                    📐 {bInfo.label} Düzenle (3D Doğrudan Giriş)
                  </div>
                  <div className="text-[11px] text-[#475569] mt-0.5">
                    Mevcut değer: <b className="font-mono text-[#111827]">{bInfo.current} mm</b> • İzin verilen: <span className="font-mono">{bInfo.min}–{bInfo.max} mm</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingBadge(null)}
                  className="px-1.5 py-0.5 rounded-lg text-[#64748B] hover:text-[#111827] hover:bg-[#F1F5F9] cursor-pointer"
                  title="İptal (Esc)"
                >
                  ✕
                </button>
              </div>

              {bInfo.isFixed ? (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-medium">
                  Bu modül sabit genişlikli bir şablondur ({bInfo.current} mm). Genişliği değiştirilemez.
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    commitBadgeEdit();
                  }}
                  className="space-y-3"
                >
                  {/* Numeric Input + Stepper */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const next = Math.max(bInfo.min, (isNumeric ? draftNum : bInfo.current) - bInfo.step);
                        setBadgeDraftValue(String(next));
                      }}
                      className="h-9 px-2.5 rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0] border border-[#CBD5E1] font-mono text-xs font-bold text-[#111827] cursor-pointer"
                    >
                      −{bInfo.step}
                    </button>
                    <div className="flex-1 flex items-center justify-between bg-[#F8FAFC] rounded-xl border border-[#94A3B8] px-3 py-1.5">
                      <input
                        type="number"
                        data-testid={`viewport-3d-dim-input-${editingBadge}`}
                        autoFocus
                        min={bInfo.min}
                        max={bInfo.max}
                        step={bInfo.step}
                        value={badgeDraftValue}
                        onChange={(e) => setBadgeDraftValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            e.stopPropagation();
                            setEditingBadge(null);
                          } else if (e.key === "Enter") {
                            e.preventDefault();
                            commitBadgeEdit();
                          }
                        }}
                        className="w-full font-mono text-sm font-bold text-[#111827] bg-transparent focus:outline-none text-center"
                      />
                      <span className="text-[11px] font-semibold text-[#475569] ml-1">mm</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const next = Math.min(bInfo.max, (isNumeric ? draftNum : bInfo.current) + bInfo.step);
                        setBadgeDraftValue(String(next));
                      }}
                      className="h-9 px-2.5 rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0] border border-[#CBD5E1] font-mono text-xs font-bold text-[#111827] cursor-pointer"
                    >
                      +{bInfo.step}
                    </button>
                  </div>

                  {/* Live Validity Check Feedback */}
                  {isOutOfRange ? (
                    <div
                      data-testid="viewport-3d-dim-validation-error"
                      className="p-2 rounded-xl bg-red-50 border border-red-200 text-red-800 text-[11px] font-semibold flex items-center justify-between gap-2"
                    >
                      <span>
                        ⚠️ Geçersiz ölçü! İzin verilen aralık: {bInfo.min} – {bInfo.max} mm.
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setBadgeDraftValue(
                            String(Math.max(bInfo.min, Math.min(bInfo.max, draftNum || bInfo.min)))
                          )
                        }
                        className="px-2 py-0.5 rounded bg-white border border-red-300 text-[10px] font-bold text-red-900 shrink-0 cursor-pointer"
                      >
                        Sınıra Çek
                      </button>
                    </div>
                  ) : (
                    <div className="px-2.5 py-1.5 rounded-xl bg-[#EEF3F8] border border-[#CBD5E1] text-[10px] text-[#111827] flex items-center justify-between">
                      <span>✓ Parametrik kurallara uygun</span>
                      <span className="font-mono font-bold">
                        Δ {draftNum - bInfo.current >= 0 ? `+${draftNum - bInfo.current}` : draftNum - bInfo.current} mm
                      </span>
                    </div>
                  )}

                  {/* Supported Quick Preset Dimension Chips */}
                  {validPresets.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] block">
                        Hazır Ölçü Seçenekleri (mm):
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {validPresets.map((presetVal) => {
                          const isCurrent = draftNum === presetVal;
                          return (
                            <button
                              key={presetVal}
                              type="button"
                              data-testid={`viewport-3d-dim-preset-${presetVal}`}
                              onClick={() => {
                                setBadgeDraftValue(String(presetVal));
                                commitBadgeEdit(presetVal);
                              }}
                              className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold border transition cursor-pointer ${
                                isCurrent
                                  ? "bg-[#EEF3F8] text-[#111827] border-[#3B82F6] shadow-2xs"
                                  : "bg-white hover:bg-[#F8FAFC] text-[#475569] border-[#E2E8F0]"
                              }`}
                            >
                              {presetVal}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Confirm (Enter) & Cancel (Escape) Buttons */}
                  <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-[#E2E8F0]">
                    <button
                      type="button"
                      data-testid="viewport-3d-dim-cancel-btn"
                      onClick={() => setEditingBadge(null)}
                      className="px-3 py-1.5 rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#475569] text-[11px] font-semibold cursor-pointer"
                    >
                      İptal (Esc)
                    </button>
                    <button
                      type="submit"
                      data-testid="viewport-3d-dim-confirm-btn"
                      disabled={isOutOfRange}
                      className="px-4 py-1.5 rounded-xl bg-[#EEF3F8] hover:bg-[#E4ECF4] disabled:opacity-40 text-[#111827] border border-[#94A3B8] text-[11px] font-bold cursor-pointer"
                    >
                      Onayla (Enter)
                    </button>
                  </div>
                </form>
              )}
            </div>
          );
        })()}

        {/* 3D DIRECT INTERACTION MINI CONTEXT MENU — Shown ONLY if floating bay/door cards are dismissed (zero duplicate bay float panels!) */}
        {!minimalChrome && showInCanvasHud && !isRightInspectorOpen && dismissedBayPopover && !dragDropSnapBanner && !active3DSnap && (clicked3DContext || doorsHiddenIn3D || cutawayActiveBay) && (
          <div
            ref={contextPopoverDomRef}
            data-floating-card="context"
            data-testid="viewport-3d-context-mini-menu"
            onPointerDown={(e) => startFloatingPanelDrag("context", e)}
            style={
              floatingPanelPos.context
                ? {
                    left: "0px",
                    top: "0px",
                    translate: "none",
                    transform: `translate3d(${floatingPanelPos.context.x}px, ${floatingPanelPos.context.y}px, 0)`,
                  }
                : stageSafeInsets
                ? {
                    top: `${(stageSafeInsets.topPx ?? 14) + 52}px`,
                    left: `calc(${stageSafeInsets.leftPx ?? 16}px + (100% - ${(stageSafeInsets.leftPx ?? 16) + (stageSafeInsets.rightPx ?? 16)}px) / 2)`,
                    transform: "translateX(-50%)",
                    maxWidth: `calc(100% - ${(stageSafeInsets.leftPx ?? 16) + (stageSafeInsets.rightPx ?? 16) + 16}px)`,
                  }
                : undefined
            }
            className={`absolute ${floatingPanelPos.context ? "top-0 left-0" : stageSafeInsets ? "" : "top-16 left-1/2 -translate-x-1/2"} z-[35] flex flex-wrap items-center justify-center gap-1.5 birim-ice-pill px-3 py-1.5 rounded-full text-xs text-[#111827] cursor-grab active:cursor-grabbing select-none transition-opacity duration-150 ${
              isDraggingItemOver3D ? "opacity-15 pointer-events-none" : ""
            }`}
          >
            <span
              title="Bu çubuğu taşımak için basılı tutup sürükleyin"
              className="px-1.5 py-0.5 rounded-full bg-white/70 border border-white/85 text-slate-500 hover:text-slate-900 font-bold cursor-grab active:cursor-grabbing select-none"
            >
              ⠿
            </span>
            {clicked3DContext?.kind === "door" && !doorsHiddenIn3D ? (
              <>
                <span className="px-2 py-0.5 rounded-lg bg-[#EEF3F8] text-[#111827] border border-[#CBD5E1] font-bold text-[11px]">
                  🚪 {clicked3DContext.label} Seçildi
                </span>
                <button
                  type="button"
                  data-testid="mini-menu-hide-doors-btn"
                  onClick={() => {
                    setDoorsHiddenIn3D(true);
                    setClicked3DContext({
                      kind: "bay",
                      bayIndex: clicked3DContext.bayIndex,
                      role: "bay_compartment",
                      label: `Bölme ${clicked3DContext.bayIndex + 1}`,
                    });
                    if (typeof window !== "undefined") {
                      window.dispatchEvent(
                        new CustomEvent("birim:select-bay-3d", {
                          detail: {
                            bayIndex: clicked3DContext.bayIndex,
                            role: "bay_compartment",
                            moduleIndex: activeModuleIndex,
                          },
                        })
                      );
                    }
                  }}
                  className="px-2.5 py-1 rounded-xl bg-[#EEF3F8] hover:bg-[#E4ECF4] text-[#111827] border border-[#94A3B8] font-bold flex items-center gap-1 cursor-pointer transition shadow-2xs"
                >
                  <span>👁️ Kapakları Gizle (İç Düzenle)</span>
                </button>
                <button
                  type="button"
                  data-testid="mini-menu-open-door-btn"
                  onClick={() => toggleDoorOpen()}
                  className="px-2.5 py-1 rounded-xl bg-white hover:bg-[#F1F5F9] text-[#111827] border border-[#CBD5E1] font-semibold cursor-pointer transition"
                >
                  {doorOpenAngleDeg > 0 ? "Kapağı Kapat (0°)" : "Kapağı Aç (85°)"}
                </button>
                <button
                  type="button"
                  data-testid="mini-menu-flip-door-btn"
                  onClick={() => flipActiveDoorDirection(clicked3DContext.bayIndex)}
                  className="px-2.5 py-1 rounded-xl bg-white hover:bg-[#F1F5F9] text-[#111827] border border-[#CBD5E1] font-semibold cursor-pointer transition"
                >
                  ⇄ Yön Çevir
                </button>
                <button
                  type="button"
                  onClick={() => setClicked3DContext(null)}
                  className="px-1.5 py-0.5 rounded-lg text-[#64748B] hover:text-[#111827] cursor-pointer"
                  title="Mini menüyü kapat"
                >
                  ✕
                </button>
              </>
            ) : (
              <>
                <span className="text-[11px] font-bold text-[#111827] mr-1">
                  🎯 3D Bölme Seçimi:
                </span>
                {activeModule.bays.map((b, bIdx) => {
                  const isSelBay = activeBayIndex === bIdx;
                  return (
                    <button
                      key={b.index}
                      type="button"
                      data-testid={`viewport-3d-bay-pill-${bIdx}`}
                      onClick={() => {
                        setActiveBayIndex(bIdx);
                        if (typeof window !== "undefined") {
                          window.dispatchEvent(
                            new CustomEvent("birim:select-bay-3d", {
                              detail: {
                                bayIndex: bIdx,
                                role: "bay_compartment",
                                moduleIndex: activeModuleIndex,
                              },
                            })
                          );
                        }
                      }}
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition cursor-pointer ${
                        isSelBay
                          ? "bg-[#EEF3F8] text-[#111827] border border-[#94A3B8] shadow-2xs"
                          : "bg-white hover:bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]"
                      }`}
                    >
                      Bölme {bIdx + 1}
                    </button>
                  );
                })}
                {(doorsHiddenIn3D || cutawayActiveBay) && (
                  <button
                    type="button"
                    data-testid="mini-menu-show-doors-btn"
                    onClick={() => {
                      setDoorsHiddenIn3D(false);
                      setCutawayActiveBay(false);
                      setActiveCamPill("3d");
                      setClicked3DContext(null);
                    }}
                    className="ml-1 px-2.5 py-1 rounded-xl bg-[#EEF3F8] hover:bg-[#E4ECF4] text-[#111827] border border-[#94A3B8] text-[11px] font-bold cursor-pointer transition"
                  >
                    🚪 Kapakları Göster
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* FLOATING 3D DOOR CONTEXTUAL CARD (Architectural B1R1M Style, w-72 Zero-Truncation, Direct Compartment Switcher & Removal) */}
        {!minimalChrome &&
          showInCanvasHud &&
          !isRightInspectorOpen &&
          clicked3DContext?.kind === "door" &&
          !doorsHiddenIn3D &&
          activeModule.bays[Math.min(clicked3DContext.bayIndex, Math.max(0, activeModule.bays.length - 1))]?.door?.type !== "open" &&
          (() => {
            const targetBayIdx = Math.min(
              clicked3DContext.bayIndex,
              Math.max(0, activeModule.bays.length - 1)
            );
            const targetBay = activeModule.bays[targetBayIdx] || activeModule.bays[0];
            const targetDoorCompId =
              clicked3DContext.componentId || selectedComponentId || `${targetBay?.door?.id}_left`;
            const curDoorProf =
              targetBay?.door?.crossSectionProfile ||
              activeModule.carcass.crossSectionProfile ||
              "flat_slab";
            const curHandleSku = targetBay?.door?.handleProfileId || "K019";
            const fourSpaceDoor = calculateFourSpaceDimensions(activeModule);
            const doorBayClearW =
              fourSpaceDoor.usableInternal.bayClearWidthsMm[targetBayIdx] || 600;
            const panelTDoor = activeModule.carcass.panelThickness || 18;
            const shrunkOuterCmDoor = Math.max(
              35,
              Math.round((activeModule.dimensions.width - (doorBayClearW + panelTDoor)) / 10)
            );
            const halfShrunkOuterCmDoor = Math.max(
              40,
              Math.round((activeModule.dimensions.width - Math.round(doorBayClearW * 0.5)) / 10)
            );
            const bdDoorSel = generateModuleGeometry(activeModule, { doorOpenAngleDeg: 0 });
            const selDoorPart = bdDoorSel.components.find((c) => c.id === targetDoorCompId);
            const fullDoorPartName = selDoorPart
              ? selDoorPart.label.split(" (")[0]
              : clicked3DContext.label;
            const doorDimsLabel = selDoorPart
              ? `${Math.round(selDoorPart.dimensions.width)} × ${Math.round(selDoorPart.dimensions.height)} × ${Math.round(selDoorPart.dimensions.depth)} mm`
              : `${doorBayClearW} mm Bölme Kapağı`;

            return (
              <div
                ref={doorPopoverDomRef}
                data-floating-card="door"
                data-testid="viewport-3d-floating-door-card"
                onClick={(e) => e.stopPropagation()}
                style={{
                  left: "0px",
                  top: "0px",
                  transform: floatingPanelPos.door
                    ? `translate3d(${floatingPanelPos.door.x}px, ${floatingPanelPos.door.y}px, 0)`
                    : "translate3d(-9999px, -9999px, 0)",
                }}
                className={`absolute top-0 left-0 z-[25] w-72 birim-ice-popover rounded-[26px] p-3.5 space-y-2.5 text-xs text-[#141413] transition-opacity duration-150 ${
                  isDraggingItemOver3D ? "opacity-15 pointer-events-none" : "pointer-events-auto"
                }`}
              >
                {/* Header Bar */}
                <div
                  onPointerDown={(e) => startFloatingPanelDrag("door", e)}
                  title="Paneli taşımak için başlığı tutup sürükleyin"
                  className="flex items-center justify-between gap-2 pb-2 border-b border-[#E5E0D5] cursor-move select-none"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[#8C7A6B] font-bold text-xs">⠿</span>
                    <span className="font-bold text-[13px] text-[#141413]">
                      {targetBayIdx + 1}. Bölme
                    </span>
                    <span className="px-1.5 py-0.5 rounded-md bg-[#EFECE5] text-[#44403C] font-mono text-[10px] font-semibold">
                      {doorBayClearW} mm
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setFloatingPanelPos((prev) => ({ ...prev, door: null }));
                        setDockedToCorner((d) => !d);
                        needsRenderRef.current = true;
                      }}
                      title={
                        dockedToCorner
                          ? "Dolap yanına yaklaştır"
                          : "Sağ üst köşeye sabitle (dolabı kapatmasın)"
                      }
                      className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold border transition cursor-pointer ${
                        dockedToCorner
                          ? "bg-[#141413] text-white border-[#141413]"
                          : "bg-white text-[#57534E] border-[#DED8CC] hover:bg-[#EFECE5]"
                      }`}
                    >
                      Sabit
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setCollapsedFloatingPanels((prev) => ({ ...prev, door: !prev.door }))
                      }
                      title={collapsedFloatingPanels.door ? "Genişlet" : "Küçült"}
                      className="w-6 h-6 rounded-md bg-white hover:bg-[#EFECE5] border border-[#DED8CC] text-[#44403C] font-bold text-[11px] flex items-center justify-center cursor-pointer"
                    >
                      {collapsedFloatingPanels.door ? "+" : "—"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setClicked3DContext(null);
                        setDoorMenuSubSection(null);
                      }}
                      title="Menüyü kapat"
                      className="w-6 h-6 rounded-md hover:bg-[#EFECE5] text-[#78716C] hover:text-[#141413] text-xs flex items-center justify-center cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {!collapsedFloatingPanels.door && (
                  <div className="space-y-2">
                    {/* Quick Mode Tabs: Switch directly between Door Settings & Compartment Interior */}
                    <div className="grid grid-cols-2 gap-1 p-0.5 rounded-xl bg-[#EFECE5] border border-[#DED8CC]">
                      <button
                        type="button"
                        className="py-1 px-2 rounded-lg bg-[#141413] text-white text-[10px] font-semibold shadow-2xs cursor-pointer"
                      >
                        Kapak Ayarları
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveBayIndex(targetBayIdx);
                          setDismissedBayPopover(false);
                          setCutawayActiveBay(true);
                          setClicked3DContext({
                            kind: "bay",
                            bayIndex: targetBayIdx,
                            role: "bay_compartment",
                            label: `Bölme ${targetBayIdx + 1}`,
                          });
                        }}
                        className="py-1 px-2 rounded-lg text-[#44403C] hover:text-[#141413] hover:bg-white/70 text-[10px] font-semibold transition cursor-pointer"
                      >
                        Bölme İç Düzeni
                      </button>
                    </div>

                    {/* Full-Width Module & Selected Door Info (Zero Truncation!) */}
                    <div className="p-2 rounded-xl bg-white border border-[#E5E0D5] space-y-1.5">
                      <div className="text-[10px] text-[#78716C] font-medium leading-snug break-words">
                        Modül #{activeModuleIndex + 1} • {activeModule.name} (
                        {Math.round(activeModule.dimensions.width / 10)}×
                        {Math.round(activeModule.dimensions.height / 10)} cm)
                      </div>
                      <div className="pt-1.5 border-t border-[#F2EFE9] flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-[9px] uppercase tracking-wider font-semibold text-[#8C7A6B]">
                            Seçili Parça
                          </div>
                          <div className="text-[11px] font-bold text-[#141413] leading-snug break-words">
                            {fullDoorPartName}
                          </div>
                          <div className="text-[10px] font-mono text-[#78716C] mt-0.5">
                            {doorDimsLabel}
                          </div>
                        </div>
                        {targetBay?.door?.type !== "open" && (
                          <button
                            type="button"
                            data-testid="floating-card-delete-selected-part"
                            onClick={() => {
                              setBayDoorType(targetBayIdx, "open");
                              setClicked3DContext({
                                kind: "bay",
                                bayIndex: targetBayIdx,
                                role: "bay_compartment",
                                label: `Bölme ${targetBayIdx + 1}`,
                              });
                              setSnapBannerDedup(
                                `${targetBayIdx + 1}. Bölme kapağı kaldırıldı (Açık bölme)`
                              );
                              setTimeout(() => setSnapBannerDedup(null), 2200);
                            }}
                            title="Sadece bu bölmenin kapağını kaldırıp açık raf düzenine çevirir"
                            className="shrink-0 px-2 py-1 rounded-lg bg-[#FAF9F6] hover:bg-red-50 border border-[#DED8CC] hover:border-red-200 text-[10px] font-semibold text-[#57534E] hover:text-red-700 transition cursor-pointer"
                          >
                            Kapağı Kaldır
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 1. Kapak Tipini Değiştir */}
                    <button
                      type="button"
                      data-testid="floating-door-change-type"
                      onClick={() =>
                        setDoorMenuSubSection((prev) => (prev === "type" ? null : "type"))
                      }
                      className="w-full px-2.5 py-1.5 rounded-xl bg-white hover:bg-[#EFECE5] border border-[#E5E0D5] text-[#141413] font-semibold flex items-center justify-between gap-2 text-left transition cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <svg className="w-3.5 h-3.5 text-[#57534E] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <rect x="4" y="3" width="16" height="18" rx="2" />
                          <path d="M9 3v18" />
                        </svg>
                        <span>Kapak Modeli</span>
                      </span>
                      <span className="text-[10px] text-[#78716C]">›</span>
                    </button>
                    {doorMenuSubSection === "type" && (
                      <div className="grid grid-cols-3 gap-1 p-1.5 rounded-xl bg-white border border-[#E5E0D5]">
                        {[
                          { id: "flat_slab", label: "Düz Kapak" },
                          { id: "shaker_frame", label: "Çerçeve" },
                          { id: "fluted_ribbed", label: "Fitilli" },
                          { id: "bevel_45", label: "45° Pahlı" },
                          { id: "glass_frame", label: "Füme Cam" },
                          { id: "mirror_door", label: "Aynalı" },
                        ].map((pt) => (
                          <button
                            key={pt.id}
                            type="button"
                            data-testid={`floating-door-type-${pt.id}`}
                            onClick={() => {
                              setBayV4DoorConfig(targetBayIdx, {
                                crossSectionProfile: pt.id as import("@birim/core").DoorCrossSectionProfile,
                                isGlassFramed: pt.id === "glass_frame",
                              });
                            }}
                            className={`py-1 px-0.5 rounded-lg text-[10px] font-semibold transition cursor-pointer ${
                              curDoorProf === pt.id
                                ? "bg-[#141413] text-white"
                                : "bg-[#FAF9F6] hover:bg-[#EFECE5] text-[#141413] border border-[#DED8CC]"
                            }`}
                          >
                            {pt.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* 2. Açılma Yönü */}
                    <button
                      type="button"
                      data-testid="floating-door-change-direction"
                      onClick={() =>
                        setDoorMenuSubSection((prev) => (prev === "direction" ? null : "direction"))
                      }
                      className="w-full px-2.5 py-1.5 rounded-xl bg-white hover:bg-[#EFECE5] border border-[#E5E0D5] text-[#141413] font-semibold flex items-center justify-between gap-2 text-left transition cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <svg className="w-3.5 h-3.5 text-[#57534E] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M4 12h16M15 7l5 5-5 5" />
                        </svg>
                        <span>Açılma Yönü</span>
                      </span>
                      <span className="text-[10px] text-[#78716C]">
                        {targetBay?.door?.type === "double"
                          ? "Çift Kapak"
                          : targetBay?.door?.type === "single_right"
                          ? "Sağ"
                          : "Sol"}
                      </span>
                    </button>
                    {doorMenuSubSection === "direction" && (
                      <div className="space-y-1.5 p-1.5 rounded-xl bg-white border border-[#E5E0D5]">
                        <div className="grid grid-cols-4 gap-1">
                          {[
                            { id: "single_left", label: "Sol" },
                            { id: "single_right", label: "Sağ" },
                            { id: "double", label: "Çift" },
                            { id: "sliding", label: "Sürgü" },
                          ].map((dir) => (
                            <button
                              key={dir.id}
                              type="button"
                              data-testid={`floating-door-dir-${dir.id}`}
                              onClick={() =>
                                setBayDoorType(
                                  targetBayIdx,
                                  dir.id as "single_left" | "single_right" | "double" | "sliding"
                                )
                              }
                              className={`py-1 px-1 rounded-lg text-[10px] font-semibold transition cursor-pointer ${
                                targetBay?.door?.type === dir.id
                                  ? "bg-[#141413] text-white"
                                  : "bg-[#FAF9F6] hover:bg-[#EFECE5] text-[#141413] border border-[#DED8CC]"
                              }`}
                            >
                              {dir.label}
                            </button>
                          ))}
                        </div>
                        {(targetBay?.door?.type === "sliding" ||
                          targetBay?.door?.doorSystemId?.startsWith("sliding")) && (
                          <div className="grid grid-cols-2 gap-1 pt-1 border-t border-[#EFECE5]">
                            {[
                              { id: "inset_inside" as const, label: "İçten Raylı" },
                              { id: "top_hung_exposed" as const, label: "Üstten Askılı" },
                              { id: "top_hung_pelmet" as const, label: "Üstü Kapalı" },
                              { id: "coplanar_flush" as const, label: "Hemzemin" },
                            ].map((sm) => {
                              const curM = targetBay?.door?.slidingMountingType || "top_hung_pelmet";
                              return (
                                <button
                                  key={sm.id}
                                  type="button"
                                  onClick={() => setModuleSlidingMountingType(sm.id)}
                                  className={`py-1 px-1.5 rounded-lg text-[9.5px] font-semibold transition cursor-pointer ${
                                    curM === sm.id
                                      ? "bg-[#141413] text-white"
                                      : "bg-[#FAF9F6] hover:bg-[#EFECE5] text-[#44403C] border border-[#DED8CC]"
                                  }`}
                                >
                                  {sm.label}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 3. Kulp Değiştir */}
                    <button
                      type="button"
                      data-testid="floating-door-change-handle"
                      onClick={() =>
                        setDoorMenuSubSection((prev) => (prev === "handle" ? null : "handle"))
                      }
                      className="w-full px-2.5 py-1.5 rounded-xl bg-white hover:bg-[#EFECE5] border border-[#E5E0D5] text-[#141413] font-semibold flex items-center justify-between gap-2 text-left transition cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <svg className="w-3.5 h-3.5 text-[#57534E] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M6 18L18 6M8 6h10v10" />
                        </svg>
                        <span>Kulp Seçimi</span>
                      </span>
                      <span className="text-[10px] font-mono text-[#78716C]">{curHandleSku}</span>
                    </button>
                    {doorMenuSubSection === "handle" && (
                      <div className="grid grid-cols-2 gap-1 p-1.5 rounded-xl bg-white border border-[#E5E0D5]">
                        {[
                          { sku: "K019", label: "K019 Mat Siyah", mat: "mat_handle_matte_black", cat: "bar_handle" as const },
                          { sku: "K020", label: "K020 Inox", mat: "mat_handle_inox", cat: "bar_handle" as const },
                          { sku: "K021", label: "K021 Pirinç", mat: "mat_handle_brass", cat: "bar_handle" as const },
                          { sku: "K022", label: "K022 Antrasit", mat: "mat_handle_anthracite", cat: "bar_handle" as const },
                        ].map((hk) => (
                          <button
                            key={hk.sku}
                            type="button"
                            data-testid={`floating-door-handle-${hk.sku}`}
                            onClick={() =>
                              setBayV4DoorConfig(targetBayIdx, {
                                handleCategory: hk.cat,
                                handleProfileId: hk.sku,
                                handleMaterialId: hk.mat,
                              })
                            }
                            className={`py-1 px-1.5 rounded-lg text-[10px] font-semibold transition cursor-pointer ${
                              curHandleSku === hk.sku
                                ? "bg-[#141413] text-white"
                                : "bg-[#FAF9F6] hover:bg-[#EFECE5] text-[#141413] border border-[#DED8CC]"
                            }`}
                          >
                            {hk.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* 4. Kapak Malzemesi */}
                    <button
                      type="button"
                      data-testid="floating-door-change-material"
                      onClick={() =>
                        setDoorMenuSubSection((prev) => (prev === "material" ? null : "material"))
                      }
                      className="w-full px-2.5 py-1.5 rounded-xl bg-white hover:bg-[#EFECE5] border border-[#E5E0D5] text-[#141413] font-semibold flex items-center justify-between gap-2 text-left transition cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <svg className="w-3.5 h-3.5 text-[#57534E] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <circle cx="12" cy="12" r="9" />
                          <circle cx="12" cy="8" r="1.5" fill="currentColor" />
                          <circle cx="8.5" cy="13" r="1.5" fill="currentColor" />
                          <circle cx="15.5" cy="13" r="1.5" fill="currentColor" />
                        </svg>
                        <span>Kapak Rengi &amp; Uygulama Kapsamı</span>
                      </span>
                      <span className="text-[10px] text-[#78716C]">›</span>
                    </button>
                    {doorMenuSubSection === "material" && (
                      <div className="p-2 rounded-xl bg-white border border-[#E5E0D5] space-y-2">
                        <div className="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-[#F4F1EA]">
                          {[
                            { id: "single" as const, lbl: "Bu Kapak" },
                            { id: "module_similar" as const, lbl: "Modül Kapakları" },
                            { id: "project_similar" as const, lbl: "Tüm Dolaplar" },
                          ].map((sc) => (
                            <button
                              key={sc.id}
                              type="button"
                              onClick={() => setFloatingMatScope(sc.id)}
                              className={`py-1 px-1 rounded-md text-[9.5px] font-bold transition cursor-pointer ${
                                floatingMatScope === sc.id
                                  ? "bg-[#141413] text-white"
                                  : "text-[#57534E] hover:text-[#141413]"
                              }`}
                            >
                              {sc.lbl}
                            </button>
                          ))}
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                          {DEFAULT_MATERIALS.filter(
                            (m) =>
                              m.category === "wood" ||
                              m.category === "lacquer" ||
                              m.category === "laminate" ||
                              m.category === "glass" ||
                              m.category === "mirror"
                          )
                            .slice(0, 8)
                            .map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                data-testid={`floating-door-mat-${m.id}`}
                                onClick={() => {
                                  applyMaterialToSimilarComponents(m.id, targetDoorCompId, floatingMatScope);
                                  const scopeText =
                                    floatingMatScope === "project_similar"
                                      ? "Tüm dolap kapaklarına"
                                      : floatingMatScope === "module_similar"
                                      ? "Modüldeki tüm kapaklara"
                                      : fullDoorPartName;
                                  setSnapBannerDedup(
                                    `${scopeText}: "${m.name.split(" (")[0]}" uygulandı`
                                  );
                                  setTimeout(() => setSnapBannerDedup(null), 2200);
                                }}
                                className="p-1.5 rounded-lg bg-[#FAF9F6] hover:bg-[#EFECE5] border border-[#DED8CC] flex items-center gap-1.5 text-[10px] font-medium text-[#141413] text-left cursor-pointer"
                                title={m.name}
                              >
                                <span
                                  className="w-3.5 h-3.5 rounded-xs border border-stone-300 shrink-0"
                                  style={{ backgroundColor: m.colorHex }}
                                />
                                <span className="truncate">{m.name.split(" (")[0]}</span>
                              </button>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* 5. Bu Kapağı Tümüne Uygula + Kapak Aç/İçini Gör */}
                    <div className="grid grid-cols-3 gap-1">
                      <button
                        type="button"
                        data-testid="floating-door-copy-to-all"
                        onClick={() => {
                          copyDoorConfigToAllBays(targetBayIdx);
                          setSnapBannerDedup(
                            "Seçili kapak modeli ve kulp tüm bölmelere uygulandı"
                          );
                          setTimeout(() => setSnapBannerDedup(null), 2400);
                        }}
                        className="py-1.5 px-1.5 rounded-lg bg-white hover:bg-[#EFECE5] border border-[#DED8CC] text-[10px] font-semibold text-[#141413] cursor-pointer"
                        title="Bu kapağın model, kulp ve renk ayarlarını tüm kapaklara kopyalar"
                      >
                        Tümüne Kopyala
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleDoorOpen()}
                        className="py-1.5 px-1.5 rounded-lg bg-white hover:bg-[#EFECE5] border border-[#DED8CC] text-[10px] font-semibold text-[#141413] cursor-pointer"
                      >
                        {doorOpenAngleDeg > 0 ? "Kapağı Kapat" : "Kapağı Aç"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDoorsHiddenIn3D(true);
                          setClicked3DContext({
                            kind: "bay",
                            bayIndex: targetBayIdx,
                            role: "bay_compartment",
                            label: `Bölme ${targetBayIdx + 1}`,
                          });
                        }}
                        className="py-1.5 px-1.5 rounded-lg bg-white hover:bg-[#EFECE5] border border-[#DED8CC] text-[10px] font-semibold text-[#44403C] cursor-pointer"
                      >
                        İçini Göster
                      </button>
                    </div>

                    {/* 6. BÖLME İŞLEMLERİ (Directly accessible even when clicking a door!) */}
                    {(activeModule.bays.length > 1 ||
                      (targetBay?.door?.type === "double" && doorBayClearW >= 760)) && (
                      <div className="pt-2 border-t border-[#E5E0D5] space-y-1">
                        <div className="text-[9px] uppercase tracking-wider font-semibold text-[#8C7A6B] px-0.5">
                          {targetBayIdx + 1}. Bölme İşlemleri
                        </div>
                        {targetBay?.door?.type === "double" && doorBayClearW >= 760 && (
                          <button
                            type="button"
                            data-testid="floating-door-shrink-double"
                            onClick={() => {
                              shrinkDoubleBayToSingle(targetBayIdx);
                              setClicked3DContext(null);
                              setSnapBannerDedup(
                                `${targetBayIdx + 1}. Bölme tek kapağa düşürüldü (Dolap ${halfShrunkOuterCmDoor} cm oldu)`
                              );
                              setTimeout(() => setSnapBannerDedup(null), 2500);
                            }}
                            className="w-full px-2.5 py-1.5 rounded-xl bg-white hover:bg-[#EFECE5] border border-[#DED8CC] text-left transition cursor-pointer"
                          >
                            <div className="text-[11px] font-semibold text-[#141413]">
                              Çift Kapağı Tek Kapağa Düşür
                            </div>
                            <div className="text-[9.5px] text-[#78716C]">
                              1 kapak eksilir • Dolap ~{halfShrunkOuterCmDoor} cm genişliğe iner
                            </div>
                          </button>
                        )}
                        {activeModule.bays.length > 1 && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                removeBayAt(targetBayIdx);
                                setClicked3DContext(null);
                                setSnapBannerDedup(
                                  `${targetBayIdx + 1}. Bölme komşu bölmeyle birleştirildi (${Math.round(activeModule.dimensions.width / 10)} cm sabit)`
                                );
                                setTimeout(() => setSnapBannerDedup(null), 2500);
                              }}
                              className="w-full px-2.5 py-1.5 rounded-xl bg-white hover:bg-[#EFECE5] border border-[#DED8CC] text-left transition cursor-pointer"
                            >
                              <div className="text-[11px] font-semibold text-[#141413]">
                                Yan Bölmeyle Birleştir (Dikme Sil)
                              </div>
                              <div className="text-[9.5px] text-[#78716C]">
                                Ara dikme kalkar • Dış ölçü {Math.round(activeModule.dimensions.width / 10)} cm sabit kalır
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                removeBayAndShrinkModule(targetBayIdx);
                                setClicked3DContext(null);
                                setSnapBannerDedup(
                                  `${targetBayIdx + 1}. Bölme çıkarıldı (Dolap ${shrunkOuterCmDoor} cm genişliğe daraltıldı)`
                                );
                                setTimeout(() => setSnapBannerDedup(null), 2500);
                              }}
                              className="w-full px-2.5 py-1.5 rounded-xl bg-white hover:bg-red-50 border border-[#E5E0D5] hover:border-red-200 text-left transition cursor-pointer"
                            >
                              <div className="text-[11px] font-semibold text-red-700">
                                {targetBayIdx + 1}. Bölmeyi Sil ve Dolabı Daralt
                              </div>
                              <div className="text-[9.5px] text-[#78716C]">
                                Bölme + kapağı çıkarılır • Dolap ~{shrunkOuterCmDoor} cm&apos;e iner
                              </div>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

        {/* FLOATING 3D COMPARTMENT POPOVER CARD (Architectural B1R1M Style, w-72 Zero-Truncation, Distinct Part vs Bay Deletion!) */}
        {!minimalChrome &&
          showInCanvasHud &&
          !isRightInspectorOpen &&
          !dismissedBayPopover &&
          !(clicked3DContext?.kind === "door" && !doorsHiddenIn3D) &&
          (cutawayActiveBay || doorsHiddenIn3D || clicked3DContext?.kind === "bay") &&
          (() => {
            const fourSpaceBay = calculateFourSpaceDimensions(activeModule);
            const bayClearW =
              fourSpaceBay.usableInternal.bayClearWidthsMm[activeBayIndex] || 600;
            const panelTBay = activeModule.carcass.panelThickness || 18;
            const shrunkOuterCm = Math.max(
              35,
              Math.round((activeModule.dimensions.width - (bayClearW + panelTBay)) / 10)
            );
            const halfShrunkOuterCm = Math.max(
              40,
              Math.round((activeModule.dimensions.width - Math.round(bayClearW * 0.5)) / 10)
            );
            const curBayObj = activeModule.bays[activeBayIndex];
            const bdSel = selectedComponentId
              ? generateModuleGeometry(activeModule, { doorOpenAngleDeg: 0 })
              : null;
            const selPart = bdSel
              ? bdSel.components.find((c) => c.id === selectedComponentId)
              : undefined;
            const selRole = selPart?.role || "";
            const isRemovableInteriorPart =
              selRole === "shelf" ||
              selRole.startsWith("drawer_") ||
              selRole === "hanging_rail" ||
              selRole === "special_fitting" ||
              selRole === "carcass_sub_divider";
            const isRemovableDivider =
              selRole === "carcass_divider" && activeModule.bays.length > 1;
            const isDoorPart = selRole === "door_left" || selRole === "door_right";

            return (
              <div
                ref={bayPopoverDomRef}
                data-floating-card="bay"
                data-testid="viewport-3d-floating-bay-card"
                onClick={(e) => e.stopPropagation()}
                style={{
                  left: "0px",
                  top: "0px",
                  transform: floatingPanelPos.bay
                    ? `translate3d(${floatingPanelPos.bay.x}px, ${floatingPanelPos.bay.y}px, 0)`
                    : "translate3d(-9999px, -9999px, 0)",
                }}
                className={`absolute top-0 left-0 z-[15] w-72 birim-ice-popover rounded-[26px] p-3.5 space-y-2.5 text-xs text-[#141413] transition-opacity duration-150 ${
                  isDraggingItemOver3D ? "opacity-15 pointer-events-none" : "pointer-events-auto"
                }`}
              >
                {/* Header */}
                <div
                  onPointerDown={(e) => startFloatingPanelDrag("bay", e)}
                  title="Paneli taşımak için başlığı tutup sürükleyin"
                  className="flex items-center justify-between gap-2 pb-2 border-b border-[#E5E0D5] cursor-move select-none"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[#8C7A6B] font-bold text-xs">⠿</span>
                    <span className="font-bold text-[13px] text-[#141413]">
                      {activeBayIndex + 1}. Bölme
                    </span>
                    <span className="px-1.5 py-0.5 rounded-md bg-[#EFECE5] text-[#44403C] font-mono text-[10px] font-semibold">
                      {bayClearW} mm
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setFloatingPanelPos((prev) => ({ ...prev, bay: null }));
                        setDockedToCorner((d) => !d);
                        needsRenderRef.current = true;
                      }}
                      title={
                        dockedToCorner
                          ? "Dolap yanına yaklaştır"
                          : "Sağ üst köşeye sabitle (dolabı kapatmasın)"
                      }
                      className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold border transition cursor-pointer ${
                        dockedToCorner
                          ? "bg-[#141413] text-white border-[#141413]"
                          : "bg-white text-[#57534E] border-[#DED8CC] hover:bg-[#EFECE5]"
                      }`}
                    >
                      Sabit
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setCollapsedFloatingPanels((prev) => ({ ...prev, bay: !prev.bay }))
                      }
                      title={collapsedFloatingPanels.bay ? "Genişlet" : "Küçült"}
                      className="w-6 h-6 rounded-md bg-white hover:bg-[#EFECE5] border border-[#DED8CC] text-[#44403C] font-bold text-[11px] flex items-center justify-center cursor-pointer"
                    >
                      {collapsedFloatingPanels.bay ? "+" : "—"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDismissedBayPopover(true);
                        setCutawayActiveBay(false);
                        setBayMenuSubSection(null);
                      }}
                      title="Bölme menüsünü kapat"
                      className="w-6 h-6 rounded-md hover:bg-[#EFECE5] text-[#78716C] hover:text-[#141413] text-xs flex items-center justify-center cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {!collapsedFloatingPanels.bay && (
                  <div className="space-y-2">
                    {/* Optional Door Switcher Tab when bay has a door */}
                    {!activeModule.isOpenFront && curBayObj?.door?.type !== "open" && (
                      <div className="grid grid-cols-2 gap-1 p-0.5 rounded-xl bg-[#EFECE5] border border-[#DED8CC]">
                        <button
                          type="button"
                          className="py-1 px-2 rounded-lg bg-[#141413] text-white text-[10px] font-semibold shadow-2xs cursor-pointer"
                        >
                          Bölme İç Düzeni
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDoorsHiddenIn3D(false);
                            setClicked3DContext({
                              kind: "door",
                              bayIndex: activeBayIndex,
                              role: "door_left",
                              componentId: `${curBayObj?.door?.id || `${activeModule.id}_door_${activeBayIndex}`}_left`,
                              label: `Bölme ${activeBayIndex + 1} • Kapak`,
                            });
                          }}
                          className="py-1 px-2 rounded-lg text-[#44403C] hover:text-[#141413] hover:bg-white/70 text-[10px] font-semibold transition cursor-pointer"
                        >
                          Kapak Ayarları
                        </button>
                      </div>
                    )}

                    {/* Full-Width Untruncated Module & Selected Part Box */}
                    <div className="p-2 rounded-xl bg-white border border-[#E5E0D5] space-y-1.5">
                      <div className="text-[10px] text-[#78716C] font-medium leading-snug break-words">
                        Modül #{activeModuleIndex + 1} • {activeModule.name} (
                        {Math.round(activeModule.dimensions.width / 10)}×
                        {Math.round(activeModule.dimensions.height / 10)} cm)
                      </div>
                      {selPart && (
                        <div className="pt-1.5 border-t border-[#F2EFE9] flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-[9px] uppercase tracking-wider font-semibold text-[#8C7A6B]">
                              Tıklanan Parça
                            </div>
                            <div className="text-[11px] font-bold text-[#141413] leading-snug break-words">
                              {selPart.label.split(" (")[0]}
                            </div>
                            <div className="text-[10px] font-mono text-[#78716C] mt-0.5">
                              {Math.round(selPart.dimensions.width)} ×{" "}
                              {Math.round(selPart.dimensions.height)} ×{" "}
                              {Math.round(selPart.dimensions.depth)} mm
                            </div>
                          </div>
                          {isRemovableInteriorPart ? (
                            <button
                              type="button"
                              data-testid="floating-card-delete-selected-part"
                              onClick={() => {
                                const labelShort = selPart.label.split(" (")[0];
                                if (removeSelectedInteriorComponent()) {
                                  setSnapBannerDedup(`"${labelShort}" parçası silindi`);
                                  setTimeout(() => setSnapBannerDedup(null), 2200);
                                }
                              }}
                              title="Sadece seçili iç parçayı siler (bölmeyi silmez)"
                              className="shrink-0 px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 text-[10px] font-semibold text-red-700 transition cursor-pointer"
                            >
                              Parçayı Sil
                            </button>
                          ) : isRemovableDivider ? (
                            <button
                              type="button"
                              data-testid="floating-card-delete-selected-part"
                              onClick={() => {
                                removeBayAt(activeBayIndex);
                                setSnapBannerDedup("Ara dikme kaldırıldı ve bölmeler birleştirildi");
                                setTimeout(() => setSnapBannerDedup(null), 2200);
                              }}
                              className="shrink-0 px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 text-[10px] font-semibold text-red-700 transition cursor-pointer"
                            >
                              Dikmeyi Sil
                            </button>
                          ) : isDoorPart ? (
                            <button
                              type="button"
                              data-testid="floating-card-delete-selected-part"
                              onClick={() => {
                                setBayDoorType(activeBayIndex, "open");
                                setSnapBannerDedup(
                                  `${activeBayIndex + 1}. Bölme kapağı kaldırıldı`
                                );
                                setTimeout(() => setSnapBannerDedup(null), 2200);
                              }}
                              className="shrink-0 px-2 py-1 rounded-lg bg-[#FAF9F6] hover:bg-red-50 border border-[#DED8CC] text-[10px] font-semibold text-[#57534E] hover:text-red-700 transition cursor-pointer"
                            >
                              Kapağı Kaldır
                            </button>
                          ) : (
                            <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-[#EFECE5] text-[#57534E] text-[9.5px] font-semibold">
                              Sabit Gövde
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Add Interior Items Grid */}
                    <div className="px-0.5 text-[10px] font-semibold text-[#78716C] flex items-center justify-between">
                      <span>İç Parça Ekle (Sürükle veya Tıkla)</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        {
                          id: "lib_shelf",
                          testId: "floating-bay-add-shelf",
                          title: "Raf",
                          visual: "shelf",
                          onClick: () => addShelf(activeBayIndex),
                          icon: (
                            <svg viewBox="0 0 40 28" className="w-7 h-5 pointer-events-none" fill="none">
                              <polygon points="4,14 14,7 36,10 26,17" fill="#E5D3B3" stroke="#8C6D46" strokeWidth="1.4" />
                              <polygon points="4,14 26,17 26,21 4,18" fill="#C8AD82" stroke="#8C6D46" strokeWidth="1.4" />
                            </svg>
                          ),
                        },
                        {
                          id: "lib_drawer",
                          testId: "floating-bay-add-drawer",
                          title: "Çekmece",
                          visual: "drawer",
                          onClick: () => addDrawer(activeBayIndex),
                          icon: (
                            <svg viewBox="0 0 40 28" className="w-7 h-5 pointer-events-none" fill="none">
                              <polygon points="6,10 28,13 28,23 6,20" fill="#E5D3B3" stroke="#785A37" strokeWidth="1.3" />
                              <line x1="13" y1="15.5" x2="21" y2="16.5" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                          ),
                        },
                        {
                          id: "lib_rail",
                          testId: "floating-bay-add-rail",
                          title: "Askılık",
                          visual: "rail",
                          onClick: () => addHangingRail(activeBayIndex),
                          icon: (
                            <svg viewBox="0 0 40 28" className="w-7 h-5 pointer-events-none" fill="none">
                              <line x1="6" y1="8" x2="34" y2="8" stroke="#64748B" strokeWidth="3" strokeLinecap="round" />
                              <polygon points="20,11 13,20 27,20" fill="#D6B88E" stroke="#8C6D46" strokeWidth="1.2" />
                            </svg>
                          ),
                        },
                        {
                          id: "lib_sub_divider",
                          testId: "floating-bay-add-subdivider",
                          title: "Raf Dikmesi",
                          visual: "sub_divider",
                          onClick: () => addSubDivider(activeBayIndex),
                          icon: (
                            <svg viewBox="0 0 40 28" className="w-7 h-5 pointer-events-none" fill="none">
                              <rect x="6" y="4" width="28" height="3" fill="#CBD5E1" stroke="#475569" strokeWidth="1.1" />
                              <rect x="6" y="21" width="28" height="3" fill="#CBD5E1" stroke="#475569" strokeWidth="1.1" />
                              <rect x="18" y="7" width="4" height="14" fill="#8C7A6B" stroke="#44403C" strokeWidth="1.3" />
                            </svg>
                          ),
                        },
                        {
                          id: "lib_carcass_divider",
                          testId: "floating-bay-split-carcass",
                          title: "2'ye Böl",
                          visual: "carcass_divider",
                          onClick: () => splitBayIntoTwo(activeBayIndex),
                          icon: (
                            <svg viewBox="0 0 40 28" className="w-7 h-5 pointer-events-none" fill="none">
                              <rect x="6" y="3" width="28" height="22" rx="1.5" fill="#FAF9F6" stroke="#44403C" strokeWidth="1.3" />
                              <rect x="18.5" y="3" width="3" height="22" fill="#141413" />
                            </svg>
                          ),
                        },
                        {
                          id: "lib_trouser_rack",
                          testId: "floating-bay-add-trouser",
                          title: "Pantolonluk",
                          visual: "trouser_rack",
                          onClick: () => addSpecialFitting(activeBayIndex, "trouser_rack"),
                          icon: (
                            <svg viewBox="0 0 40 28" className="w-7 h-5 pointer-events-none" fill="none">
                              <polygon points="6,9 14,4 34,7 26,12" fill="none" stroke="#334155" strokeWidth="1.5" />
                              <rect x="12" y="10" width="5" height="12" fill="#D6C7B2" stroke="#44403C" strokeWidth="1" />
                              <rect x="21" y="11" width="5" height="12" fill="#E5E0D5" stroke="#44403C" strokeWidth="1" />
                            </svg>
                          ),
                        },
                      ].map((fItem) => (
                        <div
                          key={fItem.id}
                          role="button"
                          tabIndex={0}
                          data-testid={fItem.testId}
                          draggable={true}
                          onDragStart={(e) =>
                            startAccessorySilhouetteDrag(e, {
                              id: fItem.id,
                              visual: fItem.visual,
                              title: fItem.title,
                              cat: "all",
                              spec: fItem.title,
                            })
                          }
                          onDragEnd={() => {
                            if (typeof window !== "undefined") {
                              (window as any).__birimActiveDraggedAccessory = null;
                            }
                          }}
                          onClick={fItem.onClick}
                          title={`${fItem.title} — Gövde üzerine sürükleyip bırakın veya tıklayın`}
                          className="p-1.5 rounded-xl bg-white hover:bg-[#EFECE5] border border-[#E5E0D5] hover:border-[#8C7A6B] flex flex-col items-center justify-center text-center gap-0.5 transition cursor-grab active:cursor-grabbing select-none"
                        >
                          <div className="pointer-events-none flex flex-col items-center gap-0.5">
                            {fItem.icon}
                            <span className="text-[10px] font-semibold text-[#141413] leading-tight">
                              {fItem.title}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Aksesuar & Şablon & Bölme Ayarları Compact Row */}
                    <div className="grid grid-cols-3 gap-1">
                      <button
                        type="button"
                        data-testid="floating-bay-add-accessory"
                        onClick={() =>
                          setBayMenuSubSection((prev) =>
                            prev === "accessories" ? null : "accessories"
                          )
                        }
                        className={`py-1.5 px-1.5 rounded-lg border text-[10px] font-semibold transition cursor-pointer ${
                          bayMenuSubSection === "accessories"
                            ? "bg-[#141413] text-white border-[#141413]"
                            : "bg-white hover:bg-[#EFECE5] text-[#141413] border-[#E5E0D5]"
                        }`}
                      >
                        + Aksesuar
                      </button>
                      <button
                        type="button"
                        data-testid="floating-bay-apply-template"
                        onClick={() =>
                          setBayMenuSubSection((prev) =>
                            prev === "templates" ? null : "templates"
                          )
                        }
                        className={`py-1.5 px-1.5 rounded-lg border text-[10px] font-semibold transition cursor-pointer ${
                          bayMenuSubSection === "templates"
                            ? "bg-[#141413] text-white border-[#141413]"
                            : "bg-white hover:bg-[#EFECE5] text-[#141413] border-[#E5E0D5]"
                        }`}
                      >
                        Hazır Şablon
                      </button>
                      <button
                        type="button"
                        data-testid="floating-bay-open-settings"
                        onClick={() => {
                          if (typeof window !== "undefined") {
                            window.dispatchEvent(
                              new CustomEvent("birim:select-bay-3d", {
                                detail: {
                                  bayIndex: activeBayIndex,
                                  role: "bay_compartment",
                                  moduleIndex: activeModuleIndex,
                                },
                              })
                            );
                          }
                        }}
                        className="py-1.5 px-1.5 rounded-lg bg-white hover:bg-[#EFECE5] border border-[#E5E0D5] text-[10px] font-semibold text-[#141413] transition cursor-pointer"
                      >
                        Detay Panel
                      </button>
                    </div>

                    {bayMenuSubSection === "accessories" && (
                      <div className="grid grid-cols-2 gap-1 p-1.5 rounded-xl bg-white border border-[#E5E0D5]">
                        {[
                          { type: "trouser_rack" as const, label: "Pantolonluk" },
                          { type: "shoe_rack" as const, label: "Ayakkabılık" },
                          { type: "tie_rack" as const, label: "Kravatlık" },
                          { type: "belt_rack" as const, label: "Kemerlik" },
                          { type: "wardrobe_lift" as const, label: "Asansör" },
                          { type: "wire_basket" as const, label: "Tel Sepet" },
                        ].map((acc) => (
                          <button
                            key={acc.type}
                            type="button"
                            data-testid={`floating-bay-acc-${acc.type}`}
                            onClick={() => {
                              addSpecialFitting(activeBayIndex, acc.type);
                              setBayMenuSubSection(null);
                            }}
                            className="py-1 px-1.5 rounded-lg bg-[#FAF9F6] hover:bg-[#EFECE5] text-[#141413] border border-[#DED8CC] text-[10px] font-semibold transition cursor-pointer text-left"
                          >
                            + {acc.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {bayMenuSubSection === "templates" && (
                      <div className="grid grid-cols-2 gap-1 p-1.5 rounded-xl bg-white border border-[#E5E0D5]">
                        {[
                          { id: "shirt_shelf" as const, label: "Gömlek + Raf" },
                          { id: "dress_drawer" as const, label: "Elbise + Çekmece" },
                          { id: "mixed_combo" as const, label: "Karma Düzen" },
                          { id: "shelves_5" as const, label: "5 Raflı İstif" },
                        ].map((tpl) => (
                          <button
                            key={tpl.id}
                            type="button"
                            data-testid={`floating-bay-tpl-${tpl.id}`}
                            onClick={() => {
                              applyBayInteriorPreset(activeBayIndex, tpl.id);
                              setBayMenuSubSection(null);
                            }}
                            className="py-1 px-2 rounded-lg bg-[#FAF9F6] hover:bg-[#EFECE5] text-[#141413] border border-[#DED8CC] text-[10px] font-semibold transition cursor-pointer text-left"
                          >
                            ✓ {tpl.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* CRYSTAL-CLEAR COMPARTMENT MERGE vs SHRINK-DELETE SECTION */}
                    {(activeModule.bays.length > 1 ||
                      (curBayObj?.door?.type === "double" && bayClearW >= 760)) && (
                      <div className="pt-2 border-t border-[#E5E0D5] space-y-1">
                        <div className="text-[9px] uppercase tracking-wider font-semibold text-[#8C7A6B] px-0.5">
                          {activeBayIndex + 1}. Bölme Silme / Birleştirme
                        </div>
                        {curBayObj?.door?.type === "double" && bayClearW >= 760 && (
                          <button
                            type="button"
                            data-testid="floating-bay-shrink-double"
                            onClick={() => {
                              shrinkDoubleBayToSingle(activeBayIndex);
                              setSnapBannerDedup(
                                `${activeBayIndex + 1}. Bölme tek kapağa düşürüldü (Dolap ${halfShrunkOuterCm} cm oldu)`
                              );
                              setTimeout(() => setSnapBannerDedup(null), 2500);
                            }}
                            className="w-full px-2.5 py-1.5 rounded-xl bg-white hover:bg-[#EFECE5] border border-[#DED8CC] text-left transition cursor-pointer"
                          >
                            <div className="text-[11px] font-semibold text-[#141413]">
                              Çift Kapağı Tek Kapağa Düşür
                            </div>
                            <div className="text-[9.5px] text-[#78716C]">
                              1 kapak eksilir • Dolap ~{halfShrunkOuterCm} cm genişliğe iner
                            </div>
                          </button>
                        )}
                        {activeModule.bays.length > 1 && (
                          <>
                            <button
                              type="button"
                              data-testid="floating-bay-merge-bay"
                              onClick={() => {
                                removeBayAt(activeBayIndex);
                                setSnapBannerDedup(
                                  `${activeBayIndex + 1}. Bölme komşu bölmeyle birleştirildi (${Math.round(activeModule.dimensions.width / 10)} cm sabit)`
                                );
                                setTimeout(() => setSnapBannerDedup(null), 2400);
                              }}
                              className="w-full px-2.5 py-1.5 rounded-xl bg-white hover:bg-[#EFECE5] border border-[#DED8CC] text-left transition cursor-pointer"
                            >
                              <div className="text-[11px] font-semibold text-[#141413]">
                                Yan Bölmeyle Birleştir (Dikme Sil)
                              </div>
                              <div className="text-[9.5px] text-[#78716C]">
                                Ara dikme kalkar • Dış ölçü {Math.round(activeModule.dimensions.width / 10)} cm sabit kalır
                              </div>
                            </button>
                            <button
                              type="button"
                              data-testid="floating-bay-delete-bay"
                              onClick={() => {
                                removeBayAndShrinkModule(activeBayIndex);
                                setSnapBannerDedup(
                                  `${activeBayIndex + 1}. Bölme çıkarıldı (Dolap ${shrunkOuterCm} cm genişliğe daraltıldı)`
                                );
                                setTimeout(() => setSnapBannerDedup(null), 2400);
                              }}
                              className="w-full px-2.5 py-1.5 rounded-xl bg-white hover:bg-red-50 border border-[#E5E0D5] hover:border-red-200 text-left transition cursor-pointer"
                            >
                              <div className="text-[11px] font-semibold text-red-700">
                                {activeBayIndex + 1}. Bölmeyi Sil ve Dolabı Daralt
                              </div>
                              <div className="text-[9.5px] text-[#78716C]">
                                Bölme + kapağı çıkarılır • Dolap ~{shrunkOuterCm} cm&apos;e iner
                              </div>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

        {/* Live Cross-Module / Cross-Bay Elevation Snap Badge during 3D Drag */}
        <div
          ref={snapBadgeDomRef}
          data-testid="in-canvas-snap-badge"
          style={{ display: "none" }}
          className="absolute top-16 left-1/2 -translate-x-1/2 z-20 pointer-events-none px-3.5 py-1.5 rounded-full birim-ice-pill text-[#1C1917] text-xs font-bold items-center gap-2"
        >
          <span ref={snapBadgeLabelRef} />
          <span ref={snapBadgeYRef} className="px-2 py-0.5 rounded-full bg-[#F1F5F9] text-[#1C1917] font-mono" />
        </div>

        {/* LEFT VERTICAL VIEW & CAMERA PILL (Design Studio: 3D | 2D Plan | Ön | Yan | Üst | İç Görünüm | Fit) */}
        <div
          data-testid="viewport-3d-visual-quality-bar"
          className="sr-only"
        >
          {[
            {
              id: "3d",
              label: "3D",
              icon: (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 3L4 7.5v9L12 21l8-4.5v-9L12 3z" />
                  <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
                </svg>
              ),
              onClick: () => {
                setActiveCamPill("3d");
                const controls = controlsRef.current,
                  perspective = perspCamRef.current;
                if (controls && perspective) {
                  const bounds = computeFastParametricSceneBounds(project.modules);
                  if (!bounds.isEmpty()) {
                    const framed = computeHeroStudioFraming(
                      bounds,
                      perspective.fov,
                      perspective.aspect,
                      "hero"
                    );
                    controls.target.copy(framed.target);
                    perspective.position.copy(framed.position);
                    perspective.lookAt(framed.target);
                    perspective.updateProjectionMatrix();
                    controls.update();
                    requestRender();
                  }
                }
              },
            },
            {
              id: "2d-elevation",
              label: "2D Cephe",
              icon: (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M12 3v18M3 15h18" />
                </svg>
              ),
              onClick: () => {
                if (typeof window !== "undefined") {
                  window.dispatchEvent(
                    new CustomEvent("birim:studio-view-change", { detail: "2d-elevation" })
                  );
                }
              },
            },
            {
              id: "2d-section",
              label: "2D Kesit",
              icon: (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="5" y="3" width="14" height="18" rx="2" />
                  <path d="M5 9h14M5 15h14" />
                </svg>
              ),
              onClick: () => {
                if (typeof window !== "undefined") {
                  window.dispatchEvent(
                    new CustomEvent("birim:studio-view-change", { detail: "2d-section" })
                  );
                }
              },
            },
            {
              id: "2d",
              label: "2D Plan",
              icon: (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 9h18M9 9v12" />
                </svg>
              ),
              onClick: () => {
                setActiveCamPill("2d");
                if (typeof window !== "undefined") {
                  window.dispatchEvent(new CustomEvent("birim:studio-view-change", { detail: "plan" }));
                }
              },
            },
            {
              id: "front",
              label: "Ön",
              icon: (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                  <path d="M4 9h16" />
                </svg>
              ),
              onClick: () => {
                setActiveCamPill("front");
                const controls = controlsRef.current,
                  perspective = perspCamRef.current;
                if (controls && perspective) {
                  const bounds = computeFastParametricSceneBounds(project.modules);
                  if (!bounds.isEmpty()) {
                    const center = bounds.getCenter(new THREE.Vector3());
                    const radius = bounds.getSize(new THREE.Vector3()).length() / 2;
                    const dist = Math.max(1200, radius * 2.3);
                    controls.target.copy(center);
                    perspective.position.set(center.x, center.y + 80, center.z + dist);
                    perspective.lookAt(center);
                    perspective.updateProjectionMatrix();
                    controls.update();
                    requestRender();
                  }
                }
              },
            },
            {
              id: "side",
              label: "Yan",
              icon: (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                  <path d="M12 4v16" />
                </svg>
              ),
              onClick: () => {
                setActiveCamPill("side");
                const controls = controlsRef.current,
                  perspective = perspCamRef.current;
                if (controls && perspective) {
                  const bounds = computeFastParametricSceneBounds(project.modules);
                  if (!bounds.isEmpty()) {
                    const center = bounds.getCenter(new THREE.Vector3());
                    const radius = bounds.getSize(new THREE.Vector3()).length() / 2;
                    const dist = Math.max(1200, radius * 2.3);
                    controls.target.copy(center);
                    perspective.position.set(center.x + dist, center.y + 80, center.z + 180);
                    perspective.lookAt(center);
                    perspective.updateProjectionMatrix();
                    controls.update();
                    requestRender();
                  }
                }
              },
            },
            {
              id: "top",
              label: "Üst",
              icon: (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                  <path d="M4 15h16" />
                </svg>
              ),
              onClick: () => {
                setActiveCamPill("top");
                const controls = controlsRef.current,
                  perspective = perspCamRef.current;
                if (controls && perspective) {
                  const bounds = computeFastParametricSceneBounds(project.modules);
                  if (!bounds.isEmpty()) {
                    const center = bounds.getCenter(new THREE.Vector3());
                    const radius = bounds.getSize(new THREE.Vector3()).length() / 2;
                    const dist = Math.max(1400, radius * 2.4);
                    controls.target.copy(center);
                    perspective.position.set(center.x, center.y + dist, center.z + 120);
                    perspective.lookAt(center);
                    perspective.updateProjectionMatrix();
                    controls.update();
                    requestRender();
                  }
                }
              },
            },
            {
              id: "interior",
              label: doorsHiddenIn3D || cutawayActiveBay ? "Kapak Göster" : "İç Görünüm",
              icon: (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
              ),
              onClick: () => {
                const currentlyHidden = doorsHiddenIn3D || cutawayActiveBay;
                if (currentlyHidden) {
                  setDoorsHiddenIn3D(false);
                  setCutawayActiveBay(false);
                  setActiveCamPill("3d");
                } else {
                  setDoorsHiddenIn3D(true);
                  setCutawayActiveBay(true);
                  setDismissedBayPopover(false);
                  setActiveCamPill("interior");
                }
              },
            },
            {
              id: "hide-doors",
              label: doorsHiddenIn3D || cutawayActiveBay ? "Kapak Göster" : "Kapakları Gizle",
              icon: (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ),
              onClick: () => {
                const currentlyHidden = doorsHiddenIn3D || cutawayActiveBay;
                if (currentlyHidden) {
                  setDoorsHiddenIn3D(false);
                  setCutawayActiveBay(false);
                  setActiveCamPill("3d");
                } else {
                  setDoorsHiddenIn3D(true);
                  setCutawayActiveBay(false);
                }
              },
            },
          ]
            .filter((btn) => !btn.id.startsWith("2d"))
            .map((btn) => {
            const isDupOfBottomDock = btn.id === "interior" || btn.id === "hide-doors";
            const isActive =
              btn.id === "interior"
                ? doorOpenAngleDeg > 10 || activeCamPill === "interior"
                : activeCamPill === btn.id;
            return (
              <button
                key={btn.id}
                type="button"
                title={btn.label}
                data-testid={`viewport-3d-pill-${btn.id}`}
                onClick={btn.onClick}
                className={
                  isDupOfBottomDock || !showInCanvasHud
                    ? "sr-only"
                    : `w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer ${
                        isActive
                          ? "birim-ice-btn-active"
                          : "text-[#44403C] hover:bg-white/70 hover:text-[#141413]"
                      }`
                }
              >
                {btn.icon}
                <span className="sr-only">{btn.label}</span>
              </button>
            );
          })}

          <div className="w-8 h-px bg-[#E2E8F0] my-0.5" />

          <button
            type="button"
            data-testid="in-canvas-fit-scene"
            title="Sahneye Sığdır"
            onClick={() => {
              const controls = controlsRef.current,
                perspective = perspCamRef.current,
                orthographic = orthoCamRef.current;
              if (!controls || !perspective || !orthographic) return;
              const bounds = computeFastParametricSceneBounds(project.modules);
              if (bounds.isEmpty()) return;
              const framed = computeHeroStudioFraming(
                bounds,
                perspective.fov,
                perspective.aspect,
                "hero"
              );
              controls.maxDistance = Math.max(14000, framed.dist * 3);
              controls.target.copy(framed.target);
              for (const camera of [perspective, orthographic]) {
                camera.position.copy(framed.position);
                camera.far = Math.max(25000, framed.dist * 5);
                camera.lookAt(framed.target);
              }
              perspective.updateProjectionMatrix();
              orthographic.updateProjectionMatrix();
              controls.update();
              requestRender();
            }}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-[#44403C] hover:bg-white/70 hover:text-[#141413] transition cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
          </button>

          <button
            type="button"
            data-testid="viewport-3d-pill-props"
            onClick={() => {
              const next = !showInteriorProps3D;
              setShowInteriorProps3D(next);
              if (next && !doorsHiddenIn3D && doorOpenAngleDeg < 15) {
                setDoorsHiddenIn3D(true);
              }
            }}
            className="sr-only"
          >
            Eşyalar
          </button>
        </div>

        {/* TOP-CENTER FROSTED ICE ICON DOCK */}
        {!minimalChrome && showInCanvasHud && (
          <div
            data-testid="in-canvas-direct-hud"
            style={
              !(isSimpleTier && !materialModeActive) && stageSafeInsets
                ? {
                    top: `${stageSafeInsets.topPx ?? 12}px`,
                    left: `${stageSafeInsets.leftPx ?? 8}px`,
                    right: `${stageSafeInsets.rightPx ?? 8}px`,
                  }
                : undefined
            }
            className={
              !materialModeActive
                ? "sr-only"
                : "absolute top-3 left-2 right-2 mx-auto w-fit max-w-[calc(100%-16px)] z-20 flex flex-wrap items-center justify-center gap-1 birim-ice-pill p-1 rounded-[22px] text-[#141413] transition-[left,right,top] duration-200"
            }
          >
            {materialModeActive && (
              <>
                {[
                  {
                    id: "select" as const,
                    label: "Seç",
                    testId: "hud-mat-tool-select",
                    icon: (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M5 3l14 8-6.5 2L9 19.5 5 3z" />
                      </svg>
                    ),
                  },
                  {
                    id: "paint" as const,
                    label: "Boya",
                    testId: "hud-mat-tool-paint",
                    icon: (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M19 11l-8-8-8.6 8.6a2 2 0 000 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11z" />
                        <path d="M20 14c1.1 1.5 2 3.2 2 4.5a2 2 0 01-4 0c0-1.3.9-3 2-4.5z" />
                      </svg>
                    ),
                  },
                  {
                    id: "group" as const,
                    label: "Bölge",
                    testId: "hud-mat-tool-group",
                    icon: (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <rect x="4" y="4" width="16" height="16" rx="2" strokeDasharray="3 3" />
                      </svg>
                    ),
                  },
                  {
                    id: "same_material" as const,
                    label: "Aynı Malzeme",
                    testId: "hud-mat-tool-same-mat",
                    icon: (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <rect x="8" y="8" width="12" height="12" rx="2" />
                        <path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" />
                      </svg>
                    ),
                  },
                ].map((mTool) => (
                  <button
                    key={mTool.id}
                    type="button"
                    title={mTool.label}
                    data-testid={mTool.testId}
                    onClick={() => setMaterialPaintTool(mTool.id)}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer ${
                      materialPaintTool === mTool.id
                        ? "birim-ice-btn-active"
                        : "text-[#44403C] hover:bg-white/70 hover:text-[#141413]"
                    }`}
                  >
                    {mTool.icon}
                    <span className="sr-only">{mTool.label}</span>
                  </button>
                ))}
                <button
                  type="button"
                  data-testid="hud-mat-tool-clear"
                  onClick={() => {
                    resetModuleMaterialOverrides();
                    setSnapBannerDedup("🧹 Özel parça malzeme atamaları temizlendi");
                    setTimeout(() => setSnapBannerDedup(null), 2000);
                  }}
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-red-600 hover:bg-red-500/15 transition cursor-pointer"
                  title="Özel parça malzeme atamalarını sıfırla"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                  </svg>
                  <span className="sr-only">Temizle</span>
                </button>
              </>
            )}

            <div className="sr-only">
            <button
              type="button"
              data-testid="hud-tool-select"
              onClick={() => setMoveObjectMode3D(false)}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer ${
                !moveObjectMode3D
                  ? "birim-ice-btn-active"
                  : "text-[#44403C] hover:bg-white/70 hover:text-[#141413]"
              }`}
              title="Seçim ve İnceleme Modu"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5 3l14 8-6.5 2L9 19.5 5 3z" />
              </svg>
              <span className="sr-only">Seç</span>
            </button>

            <button
              type="button"
              data-testid="viewport-3d-move-mode-toggle"
              onClick={() => setMoveObjectMode3D((v) => !v)}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer ${
                moveObjectMode3D
                  ? "birim-ice-btn-active"
                  : "text-[#44403C] hover:bg-white/70 hover:text-[#141413]"
              }`}
              title="Modülü 3D Sahnede Tutup Taşı"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" />
              </svg>
              <span className="sr-only">Taşı</span>
            </button>

            <button
              type="button"
              data-testid="in-canvas-toggle-dimensions"
              onClick={handleToggleDimensions}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer ${
                effectiveShowDimensions
                  ? "birim-ice-btn-active"
                  : "text-[#44403C] hover:bg-white/70 hover:text-[#141413]"
              }`}
              title="3D Ölçü Çizgilerini Göster / Gizle"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 8v8M20 8v8M4 12h16" />
              </svg>
              <span className="sr-only">Ölçü</span>
            </button>

            <button
              type="button"
              data-testid="hud-tool-split-bay"
              onClick={() => {
                splitBayIntoTwo(activeBayIndex);
                setCutawayActiveBay(true);
              }}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-[#44403C] hover:bg-white/70 hover:text-[#141413] transition cursor-pointer"
              title="Modüle Yeni Dikey Bölme (Ara Dikme) Ekle"
            >
              <Columns className="w-4 h-4" />
              <span className="sr-only">Böl</span>
            </button>

            <button
              type="button"
              data-testid="hud-tool-merge-bay"
              disabled={activeModule.bays.length <= 1}
              onClick={() => {
                if (activeModule.bays.length > 1) {
                  removeBayAt(activeBayIndex);
                }
              }}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-[#44403C] hover:bg-white/70 hover:text-[#141413] disabled:opacity-35 transition cursor-pointer"
              title="Seçili Ara Dikmeyi Kaldır ve Bölmeleri Birleştir"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <path d="M9 12h6M8 9l-3 3 3 3M16 9l3 3-3 3" />
              </svg>
              <span className="sr-only">Birleştir</span>
            </button>

            <button
              type="button"
              data-testid="in-canvas-add-module"
              onClick={addAdjacentModule}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-[#44403C] hover:bg-white/70 hover:text-[#141413] transition cursor-pointer"
              title="Seçili Modülü Yanına Kopyala"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
              <span className="sr-only">Kopyala</span>
            </button>

            <button
              type="button"
              data-testid="in-canvas-add-stacked-module"
              onClick={addStackedTopModule}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-[#44403C] hover:bg-white/70 hover:text-[#141413] transition cursor-pointer"
              title="Seçili Modülün Üstüne Yüklük Modülü Ekle"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="4" y="13" width="16" height="8" rx="1.5" />
                <rect x="4" y="3" width="16" height="7" rx="1.5" strokeDasharray="2.5 2" />
                <path d="M12 5v3m-1.5-1.5L12 5l1.5 1.5" />
              </svg>
              <span className="sr-only">Üst Yüklük Ekle</span>
            </button>

            <button
              type="button"
              data-testid="hud-tool-toggle-doors"
              onClick={() => {
                toggleDoorOpen();
                setSnapBannerDedup(
                  doorOpenAngleDeg > 0
                    ? "🚪 Kapaklar Kapatıldı"
                    : "🚪 Kapaklar Açıldı (İç Donanım Görünümü)"
                );
                setTimeout(() => setSnapBannerDedup(null), 2000);
              }}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer ${
                doorOpenAngleDeg > 0
                  ? "birim-ice-btn-active"
                  : "text-[#44403C] hover:bg-white/70 hover:text-[#141413]"
              }`}
              title={doorOpenAngleDeg > 0 ? "Kapakları Kapat" : "Kapakları Aç / İçini Göster"}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M5 3h11a2 2 0 012 2v14a2 2 0 01-2 2H5V3z" />
                <path d="M5 3l9 3v15l-9-3V3z" />
                <circle cx="11.5" cy="12" r="1" fill="currentColor" />
              </svg>
              <span className="sr-only">{doorOpenAngleDeg > 0 ? "Kapağı Kapat" : "Kapak Aç"}</span>
            </button>

            <button
              type="button"
              data-testid="in-canvas-flip-door-dir"
              onClick={() => {
                flipActiveDoorDirection(activeBayIndex);
                setSnapBannerDedup("⇄ Kapak Açılış Yönü Aynalandı (Sol ⇄ Sağ)");
                setTimeout(() => setSnapBannerDedup(null), 2200);
              }}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-[#44403C] hover:bg-white/70 hover:text-[#141413] transition cursor-pointer"
              title="Kapak Açılış Yönünü Aynala (Sol ⇄ Sağ)"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 3v18M4 7l5 5-5 5V7zM20 7l-5 5 5 5V7z" />
              </svg>
              <span className="sr-only">Aynala</span>
            </button>

            <div className="h-5 w-px bg-slate-900/12 mx-0.5" />

            <button
              type="button"
              data-testid="hud-tool-delete"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.dispatchEvent(new CustomEvent("birim:delete-active-selection"));
                }
              }}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-red-600 hover:bg-red-500/15 transition cursor-pointer"
              title="Seçili Parçayı veya Modülü Sil"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
              </svg>
              <span className="sr-only">Sil</span>
            </button>
            </div>
          </div>
        )}

        {/* BOTTOM-LEFT 3D COORDINATE AXIS GIZMO (Z Blue, Y Green, X Red) */}
        <div
          data-testid="viewport-3d-axis-gizmo"
          className={
            isSimpleTier
              ? "hidden"
              : "absolute left-5 bottom-5 z-10 pointer-events-none select-none opacity-75"
          }
        >
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            {/* Z Vertical Axis (Blue) */}
            <line x1="20" y1="44" x2="20" y2="12" stroke="#2563EB" strokeWidth="2" />
            <polygon points="20,8 17,14 23,14" fill="#2563EB" />
            <text x="16" y="7" fill="#2563EB" fontSize="10" fontWeight="700">Z</text>
            {/* Y Depth Axis (Green) */}
            <line x1="20" y1="44" x2="42" y2="28" stroke="#16A34A" strokeWidth="2" />
            <polygon points="46,25 39,27 42,31" fill="#16A34A" />
            <text x="47" y="26" fill="#16A34A" fontSize="10" fontWeight="700">Y</text>
            {/* X Horizontal Axis (Red) */}
            <line x1="20" y1="44" x2="50" y2="52" stroke="#DC2626" strokeWidth="2" />
            <polygon points="54,53 48,49 47,54" fill="#DC2626" />
            <text x="55" y="56" fill="#DC2626" fontSize="10" fontWeight="700">X</text>
            <circle cx="20" cy="44" r="2.5" fill="#2B2927" />
          </svg>
        </div>

        {/* BOTTOM-CENTER FROSTED ICE ICON CAPSULE (Orbit | Pan | Kapak | Sığdır | Donanım | Kesit | Ölçü | Stüdyo) */}
        {isXrayActive && (
          <div
            data-testid="cnc-xray-legend-pill"
            style={
              stageSafeInsets
                ? {
                    top: `${(stageSafeInsets.topPx ?? 14) + 52}px`,
                    right: `${stageSafeInsets.rightPx ?? 16}px`,
                  }
                : { top: "64px", right: "16px" }
            }
            className="absolute z-20 birim-ice-pill px-3 py-2 rounded-[20px] flex items-center gap-2.5 text-[11px] font-semibold text-[#141413]"
          >
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />Ø5 Sistem32</span>
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6]" />Ø8 Kavela</span>
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />Ø15 Minifiks</span>
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />Ø35 Menteşe</span>
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#a855f7]" />Kanal</span>
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#facc15]" />LED Kanal</span>
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#06b6d4]" />Ray / Kablo</span>
            <button
              type="button"
              onClick={() => {
                setCncXrayMode(false);
                setHardwareViewMode("normal");
                setRenderEdgeMode("photoreal");
              }}
              className="ml-1 w-5 h-5 rounded-full bg-black/10 hover:bg-black/20 flex items-center justify-center text-[10px] cursor-pointer"
              title="CNC X-Ray Görünümünü Kapat"
            >
              ✕
            </button>
          </div>
        )}

        {!minimalChrome && (
        <div
          data-testid="viewport-3d-bottom-nav-bar"
          style={
            stageSafeInsets
              ? {
                  bottom: `${stageSafeInsets.bottomPx ?? 14}px`,
                  left: `${stageSafeInsets.leftPx ?? 8}px`,
                  right: `${stageSafeInsets.rightPx ?? 8}px`,
                }
              : undefined
          }
          className="absolute bottom-3.5 left-2 right-2 mx-auto w-fit max-w-[calc(100%-16px)] z-20 flex flex-wrap items-center justify-center gap-1.5 transition-[left,right,bottom] duration-200"
        >
          <div className="birim-ice-pill p-1 rounded-2xl flex items-center gap-1 text-[#141413]">
            <button
              type="button"
              onClick={() => setMoveObjectMode3D(false)}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer ${
                !moveObjectMode3D ? "birim-ice-btn-active" : "text-[#44403C] hover:bg-white/70"
              }`}
              title="Sahneyi Çevir (Orbit)"
            >
              <RotateCw className="w-4 h-4" />
              <span className="sr-only">{isSimpleTier ? "Çevir" : "Orbit"}</span>
            </button>
            <button
              type="button"
              onClick={() => setMoveObjectMode3D(true)}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer ${
                moveObjectMode3D ? "birim-ice-btn-active" : "text-[#44403C] hover:bg-white/70"
              }`}
              title="Dolabı Duvar Boyunca Taşı (Pan)"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M18 11V6a2 2 0 00-2-2v0a2 2 0 00-2 2v0M14 10V4a2 2 0 00-2-2v0a2 2 0 00-2 2v6M10 10.5V6a2 2 0 00-2-2v0a2 2 0 00-2 2v8" />
                <path d="M18 8a2 2 0 114 0v6a8 8 0 01-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 012.83-2.82L7 15" />
              </svg>
              <span className="sr-only">{isSimpleTier ? "Taşı" : "Pan"}</span>
            </button>
            {showInCanvasHud && project.modules.length > 0 && (
              <button
                type="button"
                data-testid="quick-bar-rotate-module-btn"
                onClick={() => rotateActiveModule90(90)}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-[#44403C] hover:bg-white/70 hover:text-[#141413] transition cursor-pointer"
                data-tooltip="Seçili Modülü 90° Çevir"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="10" width="10" height="10" rx="1.5" />
                  <path d="M14 5h4a2 2 0 012 2v4" />
                  <path d="M16 3l-2 2 2 2" />
                </svg>
                <span className="sr-only">Modülü 90° Çevir</span>
              </button>
            )}

            <div className="h-5 w-px bg-slate-900/12 mx-0.5" />

            <button
              type="button"
              onClick={() => toggleDoorOpen()}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer ${
                doorOpenAngleDeg > 5
                  ? "birim-ice-btn-active"
                  : "text-[#44403C] hover:bg-white/70"
              }`}
              title={doorOpenAngleDeg > 5 ? "Kapakları Kapat" : "Kapakları Aç / İçini Gör"}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M5 3h11a2 2 0 012 2v14a2 2 0 01-2 2H5V3z" />
                <path d="M5 3l9 3v15l-9-3V3z" />
                <circle cx="11.5" cy="12" r="1" fill="currentColor" />
              </svg>
              <span className="sr-only">{doorOpenAngleDeg > 5 ? "Kapağı Kapat" : "İçini Gör"}</span>
            </button>
            {showInCanvasHud && project.modules.length > 0 && (
              <button
                type="button"
                data-testid="quick-bar-hide-doors-btn"
                onClick={() => setDoorsHiddenIn3D((prev) => !prev)}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer ${
                  doorsHiddenIn3D
                    ? "birim-ice-btn-active"
                    : "text-[#44403C] hover:bg-white/70 hover:text-[#141413]"
                }`}
                data-tooltip={doorsHiddenIn3D ? "Kapakları Göster" : "Kapakları Gizle (İç Düzenle)"}
              >
                {doorsHiddenIn3D ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                <span className="sr-only">
                  {doorsHiddenIn3D ? "Kapakları Göster" : "Kapakları Gizle (İç Düzenle)"}
                </span>
              </button>
            )}



            <div className="h-5 w-px bg-slate-900/12 mx-0.5" />

            {/* Ölçü İkon Anahtarı */}
            <button
              type="button"
              data-active={effectiveShowDimensions ? "true" : "false"}
              onClick={handleToggleDimensions}
              data-tooltip={effectiveShowDimensions ? "Ölçü Çizgilerini Gizle" : "3D Ölçü Çizgilerini Göster"}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer ${
                effectiveShowDimensions
                  ? "birim-ice-btn-active"
                  : "text-[#44403C] hover:bg-white/70 hover:text-[#141413]"
              }`}
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 8h18M3 16h18M7 8v8M12 8v5M17 8v8" />
              </svg>
              <span className="sr-only">Ölçüler</span>
            </button>

            {/* İç Eşyalar (Elbise, Kutu, Ayakkabı) Aç / Gizle */}
            <button
              type="button"
              data-testid="toggle-interior-props-btn"
              data-active={showInteriorProps3D ? "true" : "false"}
              onClick={() => {
                const next = !showInteriorProps3D;
                setShowInteriorProps3D(next);
                if (next && !doorsHiddenIn3D && doorOpenAngleDeg < 15) {
                  setDoorOpenAngleDeg(75);
                }
              }}
              data-tooltip={
                showInteriorProps3D
                  ? "İç Eşyalar: Açık (Gizlemek için tıklayın)"
                  : "İç Eşyalar: Gizli (Göstermek için tıklayın)"
              }
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer ${
                showInteriorProps3D
                  ? "birim-ice-btn-active"
                  : "text-[#44403C] hover:bg-white/70 hover:text-[#141413]"
              }`}
            >
              <span className="text-sm leading-none shrink-0">👔</span>
              <span className="sr-only">{showInteriorProps3D ? "Eşyalar Açık" : "Eşyalar Gizli"}</span>
            </button>

            {/* Görüntü / Donanım Etiketleri (Unified into Sahne & Katman Ayarları; test hook preserved) */}
            {showInCanvasHud && (
              <div className="sr-only">
                <button
                  type="button"
                  data-testid="viewport-3d-hardware-view-mode-btn"
                  title="3D Donanım & Teknik Tel Kafes Görünüm Modu"
                  onClick={() => setHardwareViewMenuOpen((v) => !v)}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer ${
                    hardwareViewMode !== "normal"
                      ? "birim-ice-btn-active"
                      : "text-[#44403C] hover:bg-white/70 hover:text-[#141413]"
                  }`}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="3" y="4" width="18" height="14" rx="2" />
                    <circle cx="8.5" cy="10.5" r="2" />
                    <path d="M14 9h4M14 13h4" />
                  </svg>
                  <span className="sr-only">Görüntü</span>
                </button>

                {hardwareViewMenuOpen && (
                  <div
                    data-testid="viewport-3d-hardware-view-menu"
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 w-56 birim-ice-popover rounded-2xl p-2 space-y-1 z-30 text-xs"
                  >
                    <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                      3D Görünüm Katmanı
                    </div>
                    {[
                      {
                        id: "normal" as const,
                        label: "Normal Görünüm",
                        sub: "Temiz sunum görünümü",
                      },
                      {
                        id: "hardware" as const,
                        label: "Donanımları Göster",
                        sub: "Menteşe, ray ve LED etiketleri",
                      },
                      {
                        id: "technical" as const,
                        label: "Teknik CAD",
                        sub: "Tel kafes + CNC eksenleri",
                      },
                    ].map((vm) => (
                      <button
                        key={vm.id}
                        type="button"
                        data-testid={`viewport-3d-hw-mode-${vm.id}`}
                        onClick={() => {
                          setHardwareViewMode(vm.id);
                          setHardwareViewMenuOpen(false);
                          if (vm.id === "hardware" || vm.id === "technical") {
                            if (doorOpenAngleDeg < 15 && !doorsHiddenIn3D) {
                              setDoorOpenAngleDeg(65);
                            }
                          }
                          if (vm.id === "technical") {
                            setRenderEdgeMode("cad");
                          } else {
                            setRenderEdgeMode("photoreal");
                          }
                        }}
                        className={`w-full px-2.5 py-1.5 rounded-xl text-left transition cursor-pointer ${
                          hardwareViewMode === vm.id
                            ? "birim-ice-btn-active"
                            : "hover:bg-white/70 text-[#111827]"
                        }`}
                      >
                        <div className="text-[11px] font-bold">{vm.label}</div>
                        <div className={`text-[9px] ${hardwareViewMode === vm.id ? "text-stone-300" : "text-[#64748B]"}`}>{vm.sub}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 2-Yönlü Canlı Kesit İkonu */}
            <div className={isSimpleTier ? "sr-only" : "relative"}>
              <button
                type="button"
                data-testid="viewport-3d-section-toggle-btn"
                onClick={() => { setSection3DMenuOpen((v) => !v); setExplode3DMenuOpen(false); setHardwareViewMenuOpen(false); setRenderMenuOpen(false); }}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer ${
                  section3DAxis
                    ? "birim-ice-btn-active"
                    : "text-[#44403C] hover:bg-white/70 hover:text-[#141413]"
                }`}
                title="2-Yönlü Canlı 3D Dolap Kesiti (X / Z)"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="6" cy="6" r="3" />
                  <circle cx="6" cy="18" r="3" />
                  <path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12" />
                </svg>
                <span className="sr-only">{section3DAxis ? `Kesit (${section3DAxis})` : "Kesit"}</span>
              </button>

              {section3DMenuOpen && (
                <div
                  data-testid="viewport-3d-section-popover"
                  onClick={(e) => e.stopPropagation()}
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 w-60 birim-ice-popover rounded-2xl p-3 space-y-2.5 z-30 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-slate-900">✂️ Canlı Kesit</span>
                    <button
                      type="button"
                      onClick={() => setSection3DMenuOpen(false)}
                      className="text-slate-500 hover:text-slate-900 font-bold cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      { id: null, label: "Kapalı" },
                      { id: "X" as const, label: "X Ekseni" },
                      { id: "Z" as const, label: "Z Ekseni" },
                    ].map((sOpt) => (
                      <button
                        key={String(sOpt.id)}
                        type="button"
                        onClick={() => setSection3DAxis(sOpt.id)}
                        className={`py-1.5 px-2 rounded-xl font-bold text-[11px] transition cursor-pointer ${
                          section3DAxis === sOpt.id
                            ? "birim-ice-btn-active"
                            : "birim-ice-btn text-slate-800"
                        }`}
                      >
                        {sOpt.label}
                      </button>
                    ))}
                  </div>
                  {section3DAxis && (
                    <div className="space-y-1 pt-1 border-t border-slate-200/70">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-slate-600">Konum</span>
                        <span className="font-mono font-extrabold text-slate-900">
                          {Math.round((section3DAxis === "X" ? width : depth) * section3DRatio)} mm
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.1}
                        max={0.95}
                        step={0.02}
                        data-visual-slider="true"
                        value={section3DRatio}
                        onChange={(e) => setSection3DRatio(Number(e.target.value))}
                        className="w-full accent-[#141413] h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Gündüz / Gece LED Ambiyans Anahtarı */}
            <button
              type="button"
              data-testid="viewport-3d-day-night-led-btn"
              onClick={() =>
                setLightingPreset((prev) => (prev === "night_led" ? "daylight" : "night_led"))
              }
              data-tooltip={
                lightingPreset === "night_led"
                  ? "Gündüz Stüdyo Işığına Geç"
                  : "Gece Ambiyans & İç LED Işığını Gör"
              }
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer ${
                lightingPreset === "night_led"
                  ? "birim-ice-btn-active"
                  : "text-[#44403C] hover:bg-white/70 hover:text-[#141413]"
              }`}
            >
              <span className="text-sm leading-none">{lightingPreset === "night_led" ? "🌙" : "☀️"}</span>
              <span className="sr-only">
                {lightingPreset === "night_led" ? "Gece LED Modu" : "Gündüz Modu"}
              </span>
            </button>

            {/* Canlı 3D Patlatma (Exploded View) Slider Popover — Mimar/Üretim Modunda Görünür */}
            <div className={isSimpleTier ? "sr-only" : "relative"}>
              <button
                type="button"
                data-testid="viewport-3d-explode-toggle-btn"
                onClick={() => {
                  setExplode3DMenuOpen((v) => !v);
                  setSection3DMenuOpen(false);
                  setHardwareViewMenuOpen(false);
                  setRenderMenuOpen(false);
                }}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer ${
                  explodedFactor > 0.01
                    ? "birim-ice-btn-active"
                    : "text-[#44403C] hover:bg-white/70 hover:text-[#141413]"
                }`}
                data-tooltip={
                  explodedFactor > 0.01
                    ? `Canlı Patlatma: %${Math.round(explodedFactor * 100)}`
                    : "3D Canlı Patlatma Görünümü"
                }
                title="3D Canlı Patlatma Görünümü"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L3 7l9 5 9-5-9-5z" />
                  <path d="M3 12l9 5 9-5" />
                  <path d="M3 17l9 5 9-5" />
                </svg>
                <span className="sr-only">
                  {explodedFactor > 0.01
                    ? `Patlatma (%${Math.round(explodedFactor * 100)})`
                    : "Canlı Patlatma"}
                </span>
              </button>

              {explode3DMenuOpen && (
                <div
                  data-testid="viewport-3d-explode-popover"
                  onClick={(e) => e.stopPropagation()}
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 w-60 birim-ice-popover rounded-2xl p-3 space-y-2.5 z-30 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-slate-900">💥 Canlı Patlatma</span>
                    <button
                      type="button"
                      onClick={() => setExplode3DMenuOpen(false)}
                      aria-label="Patlatma panelini kapat"
                      className="text-slate-500 hover:text-slate-900 font-bold cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-600">Ayrılma Oranı</span>
                      <span
                        data-testid="viewport-3d-explode-value"
                        className="font-mono font-extrabold text-slate-900"
                      >
                        %{Math.round(explodedFactor * 100)}
                      </span>
                    </div>
                    <input
                      type="range"
                      data-testid="viewport-3d-explode-slider"
                      data-visual-slider="true"
                      aria-label="Canlı patlatma oranı"
                      min={0}
                      max={1}
                      step={0.02}
                      value={explodedFactor}
                      onChange={(e) => setExplodedFactor(Number(e.target.value))}
                      className="w-full accent-[#141413] h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-1 pt-1 border-t border-slate-200/70">
                    {[
                      { value: 0, label: "Normal" },
                      { value: 0.5, label: "%50" },
                      { value: 1, label: "%100" },
                    ].map((preset) => {
                      const isActive = Math.abs(explodedFactor - preset.value) < 0.015;
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setExplodedFactor(preset.value)}
                          className={`py-1.5 px-2 rounded-xl font-bold text-[11px] transition cursor-pointer ${
                            isActive
                              ? "birim-ice-btn-active"
                              : "birim-ice-btn text-slate-800"
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Stüdyo Ortam, Işık, Zemin & 2K Render İkonu */}
            <div className="relative">
              <button
                type="button"
                data-testid="viewport-3d-edge-mode-toggle"
                title="Stüdyo Işığı, Duvar/Zemin Yüzeyi ve 2K Fotoğraf Render"
                onClick={() => { setRenderMenuOpen((v) => !v); setSection3DMenuOpen(false); setExplode3DMenuOpen(false); setHardwareViewMenuOpen(false); }}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer ${
                  renderMenuOpen || renderEdgeMode === "cad"
                    ? "birim-ice-btn-active"
                    : "text-[#44403C] hover:bg-white/70 hover:text-[#141413]"
                }`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
                <span className="sr-only">{renderEdgeMode === "photoreal" ? "Gerçekçi" : "Teknik CAD"}</span>
              </button>

              {renderMenuOpen && (
                <div className="absolute bottom-full right-0 mb-2.5 w-64 birim-ice-popover rounded-2xl p-3 space-y-3 z-30 text-xs">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#57534E]">
                        Görünüm
                      </span>
                      <button
                        type="button"
                        onClick={() => setRenderMenuOpen(false)}
                        title="Kapat"
                        aria-label="Render panelini kapat"
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-[#57534E] hover:text-[#141413] hover:bg-black/5 cursor-pointer transition"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setViewportRenderStyle("solid");
                          setHardwareViewMode("normal");
                          setRenderEdgeMode("photoreal");
                        }}
                        className={`py-1.5 px-1.5 rounded-xl text-[10.5px] font-semibold cursor-pointer ${
                          renderEdgeMode === "photoreal" && hardwareViewMode === "normal" && viewportRenderStyle === "solid"
                            ? "birim-ice-btn-active"
                            : "birim-ice-btn text-[#1C1917]"
                        }`}
                      >
                        Sunum PBR
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setHardwareViewMode("hardware");
                          setRenderEdgeMode("photoreal");
                          if (doorOpenAngleDeg < 15 && !doorsHiddenIn3D) {
                            setDoorOpenAngleDeg(65);
                          }
                        }}
                        className={`py-1.5 px-1.5 rounded-xl text-[10.5px] font-semibold cursor-pointer ${
                          hardwareViewMode === "hardware"
                            ? "birim-ice-btn-active"
                            : "birim-ice-btn text-[#1C1917]"
                        }`}
                      >
                        Donanım
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setHardwareViewMode("technical");
                          setRenderEdgeMode("cad");
                        }}
                        className={`py-1.5 px-1.5 rounded-xl text-[10.5px] font-semibold cursor-pointer ${
                          renderEdgeMode === "cad" || hardwareViewMode === "technical"
                            ? "birim-ice-btn-active"
                            : "birim-ice-btn text-[#1C1917]"
                        }`}
                      >
                        Teknik CAD
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-1 mt-1">
                      <button
                        type="button"
                        onClick={() => setViewportRenderStyle(viewportRenderStyle === "wireframe" ? "solid" : "wireframe")}
                        className={`py-1 px-1.5 rounded-xl text-[10px] font-semibold cursor-pointer ${
                          viewportRenderStyle === "wireframe" ? "birim-ice-btn-active" : "birim-ice-btn text-[#1C1917]"
                        }`}
                      >
                        Tel Kafes
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewportRenderStyle(viewportRenderStyle === "carcass_only" ? "solid" : "carcass_only")}
                        className={`py-1 px-1.5 rounded-xl text-[10px] font-semibold cursor-pointer ${
                          viewportRenderStyle === "carcass_only" ? "birim-ice-btn-active" : "birim-ice-btn text-[#1C1917]"
                        }`}
                      >
                        Kapaksız
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewportRenderStyle(viewportRenderStyle === "exploded" ? "solid" : "exploded")}
                        className={`py-1 px-1.5 rounded-xl text-[10px] font-semibold cursor-pointer ${
                          viewportRenderStyle === "exploded" ? "birim-ice-btn-active" : "birim-ice-btn text-[#1C1917]"
                        }`}
                      >
                        Patlatılmış
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#57534E] mb-1.5">
                      Işık
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { id: "daylight", label: "Gün" },
                        { id: "showroom_warm", label: "3000K" },
                        { id: "night_led", label: "Gece" },
                      ].map((lp) => (
                        <button
                          key={lp.id}
                          type="button"
                          data-testid={`viewport-3d-light-${lp.id}`}
                          onClick={() =>
                            setLightingPreset(lp.id as "daylight" | "showroom_warm" | "night_led")
                          }
                          className={`py-1 px-1.5 rounded-xl text-[10px] font-semibold cursor-pointer ${
                            lightingPreset === lp.id
                              ? "birim-ice-btn-active"
                              : "birim-ice-btn text-[#1C1917]"
                          }`}
                        >
                          {lp.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#57534E] mb-1.5">
                      Duvar
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { id: "brut_concrete", label: "Brüt Beton", swatch: "#9E9991" },
                        { id: "anthracite_gallery", label: "Koyu Galeri", swatch: "#444341" },
                        { id: "warm_taupe", label: "Sıcak Grej", swatch: "#ACA396" },
                        { id: "soft_plaster", label: "Mimari Gri Sıva", swatch: "#CDD3DA" },
                      ].map((wt) => (
                        <button
                          key={wt.id}
                          type="button"
                          title={wt.label}
                          data-testid={`viewport-3d-wall-${wt.id}`}
                          onClick={() => setWallTone(wt.id as ArchitecturalWallTone)}
                          className={`h-8 rounded-xl flex items-center justify-center cursor-pointer border transition ${
                            wallTone === wt.id
                              ? "ring-2 ring-[#141413] border-white scale-105"
                              : "border-white/70 hover:scale-105"
                          }`}
                          style={{ backgroundColor: wt.swatch }}
                        >
                          <span className="sr-only">{wt.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#57534E] mb-1.5">
                      Zemin
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {[
                        { id: "oak_parquet", label: "Meşe" },
                        { id: "herringbone_oak", label: "Balıksırtı" },
                        { id: "walnut_parquet", label: "Ceviz" },
                        { id: "travertine", label: "Traverten" },
                        { id: "neolith_calacatta", label: "Mermer" },
                        { id: "microcement", label: "Beton" },
                        { id: "studio", label: "Stüdyo" },
                      ].map((fl) => (
                        <button
                          key={fl.id}
                          type="button"
                          data-testid={`viewport-3d-floor-${fl.id}`}
                          onClick={() => setFloorStyle(fl.id as ArchitecturalFloorStyle)}
                          className={`py-1 px-2 rounded-xl text-[10px] font-semibold text-left cursor-pointer ${
                            floorStyle === fl.id
                              ? "birim-ice-btn-active"
                              : "birim-ice-btn text-[#1C1917]"
                          }`}
                        >
                          {fl.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    data-testid="viewport-open-glb-library-btn"
                    onClick={() => {
                      setRenderMenuOpen(false);
                      setGlbLibraryOpen(true);
                    }}
                    className="w-full py-2 px-2.5 rounded-xl birim-ice-btn text-[#141413] font-bold text-[11px] flex items-center justify-between cursor-pointer"
                  >
                    <span>📦 Hazır 3D İç Modeller (.GLB)</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-600/15 text-emerald-800 font-mono">GLTF</span>
                  </button>

                  <button
                    type="button"
                    data-testid="viewport-open-path-trace-studio-btn"
                    onClick={() => {
                      setRenderMenuOpen(false);
                      window.dispatchEvent(new CustomEvent("birim:open-studio-render-modal"));
                    }}
                    className="w-full py-2 px-2.5 rounded-xl bg-[#141413] hover:bg-[#27272A] text-white font-bold text-[11px] flex items-center justify-between cursor-pointer shadow-sm"
                  >
                    <span>🎬 2K vs Path-Trace Stüdyosu</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 font-mono">A/B</span>
                  </button>

                  <div className="pt-2 border-t border-slate-900/10 flex items-center gap-1.5">
                    <button
                      type="button"
                      data-testid="viewport-3d-ultra-studio-render-btn"
                      disabled={ultraRenderProgress !== null}
                      title="2K Stüdyo Fotoğraf İndir (.PNG)"
                      onClick={async () => {
                        const win = window as unknown as {
                          __birimRenderUltraStudioPhoto?: (opts?: {
                            angle?: "current" | "iso" | "front";
                            width?: number;
                            height?: number;
                            onProgress?: (pct: number) => void;
                          }) => Promise<string>;
                        };
                        if (!win.__birimRenderUltraStudioPhoto) return;
                        setUltraRenderProgress(0);
                        const dataUrl = await win.__birimRenderUltraStudioPhoto({
                          angle: "current",
                          width: 2048,
                          height: 1280,
                          onProgress: (p) => setUltraRenderProgress(p),
                        });
                        setUltraRenderProgress(null);
                        setRenderMenuOpen(false);
                        if (dataUrl) {
                          const a = document.createElement("a");
                          a.href = dataUrl;
                          a.download = `Birim_Studyo_Render_${project.id}.png`;
                          document.body.appendChild(a);
                          a.click();
                          setTimeout(() => {
                            if (a.parentNode) a.parentNode.removeChild(a);
                          }, 1000);
                          setSnapBannerDedup("2K Ultra Stüdyo Render indirildi");
                          setTimeout(() => setSnapBannerDedup(null), 2800);
                        }
                      }}
                      className="flex-1 h-8 px-2.5 rounded-xl birim-ice-btn-active disabled:opacity-60 font-semibold text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <span>📸</span>
                      <span>{ultraRenderProgress !== null ? `%${ultraRenderProgress}` : "2K PNG"}</span>
                    </button>

                    {activeModule && (
                      <CeilingAndEngineeringQuickPopover
                        project={project}
                        activeModule={activeModule}
                        surface="3d"
                        onUpdateCeiling={updateCeilingConfigStore}
                        onUpdateCeilingHeightMm={(h) =>
                          setRoomDimensionsStore(spaceWalls?.[0]?.length || 3600, h)
                        }
                        onUpdateCarcass={updateCarcassStore}
                        onSetFacadeGrainContinuity={setFacadeGrainContinuityStore}
                      />
                    )}

                    <button
                      type="button"
                      data-testid="viewport-3d-room-toggle"
                      title={showRoomArchitecture3D ? "Oda Duvarlarını Gizle" : "Oda Duvarlarını Göster"}
                      onClick={() => setShowRoomArchitecture3D((prev) => !prev)}
                      className={`w-8 h-8 rounded-xl flex items-center justify-center cursor-pointer ${
                        showRoomArchitecture3D ? "birim-ice-btn-active" : "birim-ice-btn text-[#1C1917]"
                      }`}
                    >
                      <span>🧱</span>
                      <span className="sr-only">{showRoomArchitecture3D ? "Duvarlar: Açık" : "Duvarlar: Gizli"}</span>
                    </button>

                    <button
                      type="button"
                      data-testid="viewport-3d-rotate-mod-90"
                      title="Aktif Modülü 90° Döndür"
                      onClick={() => rotateActiveModule90(90)}
                      className="sr-only"
                    >
                      <span>↻</span>
                      <span className="sr-only">90° Döndür</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        )}
        <WardrobeGlbLibraryModal
          open={glbLibraryOpen}
          onClose={() => setGlbLibraryOpen(false)}
        />

        {/* V11.4 ETKİLEŞİMLİ 3B KIRMIZI / TURUNCU HATA NOKTASI AÇIKLAMA & ÇÖZÜM KARTI */}
        {live3DEngineeringReport &&
          (() => {
            const spatialItems = (live3DEngineeringReport.findings || []).filter(
              (f) =>
                Boolean(f.worldPositionMm) &&
                (f.severity === "error" || f.ruleNature === "VERIFICATION_REQUIRED")
            );
            if (spatialItems.length === 0 && !selectedBeaconFinding) return null;

            return (
              <>
                {selectedBeaconFinding && (
                  <div
                    data-testid="v11-3d-beacon-popover"
                    style={{
                      bottom: "84px",
                      left: `${stageSafeInsets?.leftPx ?? 84}px`,
                    }}
                    className="birim-dramatic-panel absolute z-50 w-[296px] max-w-[calc(100vw-32px)] rounded-2xl bg-[#262D3B]/70 backdrop-blur-2xl border border-white/25 ring-1 ring-red-400/35 shadow-[0_18px_46px_rgba(0,0,0,0.48)] p-3 space-y-2 text-[11px] text-slate-100"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-3 h-3 rounded-full shrink-0 ${
                            selectedBeaconFinding.severity === "error"
                              ? "bg-red-600"
                              : "bg-amber-500"
                          }`}
                        />
                        <div>
                          <div className="font-bold text-[13px] leading-snug">
                            {selectedBeaconFinding.title}
                          </div>
                          <div className="text-[10.5px] text-[#78716C]">
                            Modül {selectedBeaconFinding.moduleIndex + 1} •{" "}
                            {selectedBeaconFinding.bayIndex + 1}. Bölme
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedBeaconFinding(null)}
                        className="w-7 h-7 rounded-full hover:bg-[#EFECE4] text-[#57534E] flex items-center justify-center cursor-pointer shrink-0"
                        title="Kapat"
                      >
                        ✕
                      </button>
                    </div>

                    <p className="text-[11.5px] text-[#44403C] leading-relaxed bg-white/80 rounded-2xl p-3 border border-[#EAE4D8]">
                      {selectedBeaconFinding.message}
                    </p>

                    {selectedBeaconFinding.suggestions.length > 0 && (
                      <div className="space-y-1 text-[11px] text-[#57534E] px-1">
                        {selectedBeaconFinding.suggestions.slice(0, 2).map((sg, idx) => (
                          <div key={idx} className="flex items-start gap-1.5">
                            <span className="text-[#8C7A6B] font-bold">•</span>
                            <span>{sg}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {selectedBeaconFinding.remediationProposals.slice(0, 2).map((prop) => (
                        <button
                          key={prop.id}
                          type="button"
                          onClick={() => {
                            applyApprovedEngineeringFix(prop);
                            setSelectedBeaconFinding(null);
                          }}
                          className="px-3.5 py-2 rounded-full bg-[#141413] hover:bg-[#292524] text-white font-semibold text-[11px] cursor-pointer transition"
                        >
                          ✓ Otomatik Düzelt: {prop.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveModuleIndex(selectedBeaconFinding.moduleIndex);
                          setActiveBayIndex(selectedBeaconFinding.bayIndex);
                          if (typeof window !== "undefined") {
                            window.dispatchEvent(
                              new CustomEvent("birim:select-bay-3d", {
                                detail: {
                                  moduleIndex: selectedBeaconFinding.moduleIndex,
                                  bayIndex: selectedBeaconFinding.bayIndex,
                                },
                              })
                            );
                          }
                          setSelectedBeaconFinding(null);
                        }}
                        className="px-3 py-2 rounded-full bg-[#EFECE4] hover:bg-[#E4DFD3] text-[#141413] font-semibold text-[11px] cursor-pointer transition"
                      >
                        Sağ Panelde Göster →
                      </button>
                    </div>

                    {spatialItems.length > 1 && (
                      <div className="flex items-center justify-between pt-2 border-t border-[#E6E1D6] text-[10.5px] text-[#78716C]">
                        <span>Diğer kırmızı/turuncu noktalar ({spatialItems.length}):</span>
                        <div className="flex items-center gap-1">
                          {spatialItems.slice(0, 5).map((it, idx) => (
                            <button
                              key={`${it.code}_${idx}`}
                              type="button"
                              onClick={() => {
                                const mIdx = project.modules.findIndex(
                                  (m) => m.id === it.targetModuleId
                                );
                                const bMatch = String(it.targetId || "").match(/bay_(\d+)/);
                                setSelectedBeaconFinding({
                                  code: it.code,
                                  severity: it.severity,
                                  title: formatEngineeringErrorCode(it.code),
                                  message: it.message,
                                  suggestions: it.suggestions || [],
                                  remediationProposals: it.remediationProposals || [],
                                  moduleIndex: mIdx >= 0 ? mIdx : activeModuleIndex,
                                  bayIndex: bMatch ? Number(bMatch[1]) : activeBayIndex,
                                });
                              }}
                              className={`w-6 h-6 rounded-full font-mono font-bold text-[10px] cursor-pointer ${
                                selectedBeaconFinding.code === it.code
                                  ? "bg-red-600 text-white"
                                  : "bg-[#EFECE4] text-[#44403C] hover:bg-[#E2DDD0]"
                              }`}
                            >
                              {idx + 1}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            );
          })()}
        {!minimalChrome && live3DEngineeringReport && live3DEngineeringReport.blockingSafetyAndEngineeringErrors.length > 0 && (
          <div
            data-testid="viewport-3d-engineering-alert-hud"
            style={{
              bottom: `${(stageSafeInsets?.bottomPx ?? 14) + 72}px`,
              left: `${stageSafeInsets?.leftPx ?? 16}px`,
            }}
            className="absolute z-40 max-w-sm rounded-2xl bg-slate-950/92 backdrop-blur-md border border-red-500/80 text-xs text-slate-100 shadow-xl pointer-events-auto transition-[left,bottom] duration-200"
          >
            {engineeringAlertCollapsed ? (
              <button
                type="button"
                onClick={() => setEngineeringAlertCollapsed(false)}
                className="px-3 py-1.5 flex items-center gap-2 text-[11px] font-bold text-red-300 hover:text-white cursor-pointer"
                title="Mühendislik engel detayını aç"
              >
                <span>● Engel ({live3DEngineeringReport.blockingSafetyAndEngineeringErrors.length})</span>
                <span className="text-[10px] text-slate-400">▴ Aç</span>
              </button>
            ) : (
              <div className="p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-red-400">
                    ● 3B Sahne Mühendislik Engeli ({live3DEngineeringReport.blockingSafetyAndEngineeringErrors.length})
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      title={`Teknik Kural: ${live3DEngineeringReport.blockingSafetyAndEngineeringErrors[0].code}`}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-950/80 border border-red-500/40 text-red-200 whitespace-nowrap"
                    >
                      {formatEngineeringErrorCode(live3DEngineeringReport.blockingSafetyAndEngineeringErrors[0].code)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setEngineeringAlertCollapsed(true)}
                      title="Uyarı panelini küçült"
                      className="w-5 h-5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] flex items-center justify-center cursor-pointer"
                    >
                      —
                    </button>
                  </div>
                </div>
                <div className="text-[11px] text-slate-200 leading-snug">
                  {live3DEngineeringReport.blockingSafetyAndEngineeringErrors[0].message}
                </div>
                {live3DEngineeringReport.blockingSafetyAndEngineeringErrors[0].remediationProposals &&
                  live3DEngineeringReport.blockingSafetyAndEngineeringErrors[0].remediationProposals.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {live3DEngineeringReport.blockingSafetyAndEngineeringErrors[0].remediationProposals.map((prop) => (
                        <button
                          key={prop.id}
                          type="button"
                          onClick={() => applyApprovedEngineeringFix(prop)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] cursor-pointer transition"
                        >
                          ✓ Onayla: {prop.label}
                        </button>
                      ))}
                    </div>
                  )}
              </div>
            )}
          </div>
        )}
        {paintTool3D.mode !== "none" && (() => {
          const safeTop = Math.max(122, (stageSafeInsets?.topPx ?? 118) + 4);
          const safeLeft = stageSafeInsets?.leftPx ?? 76;
          const safeRight = stageSafeInsets?.rightPx ?? 64;
          const allBrushMats = [...DEFAULT_MATERIALS, ...(project.customMaterials || [])];
          const curBrushDef = allBrushMats.find((m) => m.id === paintTool3D.materialId);
          return (
        <div
          data-testid="v15-active-paint-tool-hud"
          style={{
            top: `${safeTop}px`,
            left: `calc(${safeLeft}px + (100% - ${safeLeft + safeRight}px) / 2)`,
            maxWidth: `calc(100% - ${safeLeft + safeRight + 16}px)`,
          }}
          className="pointer-events-auto absolute -translate-x-1/2 z-30 py-1 px-2.5 rounded-full bg-[#1E2026]/82 text-white backdrop-blur-2xl shadow-[0_14px_36px_rgba(15,23,42,0.26)] border border-white/20 flex items-center gap-2 text-[11px] font-semibold whitespace-nowrap overflow-x-auto no-scrollbar transition-[top,left] duration-150 max-md:!left-1/2 max-md:!max-w-[calc(100vw-24px)]"
        >
          <span
            className="w-4 h-4 rounded-full border border-white/50 shrink-0 shadow-xs"
            style={{
              backgroundColor: curBrushDef?.colorHex || "#cfc6b8",
            }}
          />
          <span className="truncate max-w-[190px]">
            {paintTool3D.mode === "eyedropper"
              ? "Damlalık: Yüzeye tıklayarak rengi fırçaya alın"
              : `Fırça: ${curBrushDef?.name || "Malzeme"}`}
          </span>
          {paintTool3D.mode === "paint" && (
            <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-white/12 border border-white/15 shrink-0">
              {(
                [
                  { id: "active_scope", label: "Akıllı Yüzey" },
                  { id: "clicked_part", label: "Tek Parça" },
                  { id: "clicked_module", label: "Tüm Dolap" },
                  { id: "replace_matching_project", label: "Aynı Rengi Değiştir" },
                ] as const
              ).map((bm) => (
                <button
                  key={bm.id}
                  type="button"
                  onClick={() => {
                    const nextSt: PaintTool3DState = { ...paintTool3D, clickBehavior: bm.id };
                    setPaintTool3D(nextSt);
                    window.dispatchEvent(
                      new CustomEvent("birim:sync-paint-tool-from-3d", { detail: nextSt })
                    );
                  }}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition cursor-pointer ${
                    paintTool3D.clickBehavior === bm.id
                      ? "bg-white text-[#18181B]"
                      : "text-white/80 hover:text-white"
                  }`}
                >
                  {bm.label}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              restoreHoverPreviewMaterials();
              const cleared: PaintTool3DState = { ...paintTool3D, mode: "none" };
              setPaintTool3D(cleared);
              if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("birim:request-clear-paint-tool-3d"));
              }
            }}
            className="px-2 py-0.5 rounded-full bg-white/15 hover:bg-white/25 text-[10.5px] cursor-pointer shrink-0"
          >
            Kapat (Esc)
          </button>
        </div>
          );
        })()}
      <Viewport3DContextMenu
          target={contextMenuTarget}
          project={project}
          doorOpenAngleDeg={doorOpenAngleDeg}
          drawerOpenMm={drawerOpenMm}
          doorsHiddenIn3D={doorsHiddenIn3D}
          showDimensions={Boolean(effectiveShowDimensions)}
          showInteriorProps3D={showInteriorProps3D}
          canUndo={canUndo3D}
          canRedo={canRedo3D}
          onClose={() => setContextMenuTarget(null)}
          onToggleDoorOpen={toggleDoorOpen}
          onToggleDoorsHidden={() => setDoorsHiddenIn3D((prev) => !prev)}
          onToggleDrawerOpen={() => useConfiguratorStore.getState().toggleDrawerOpen(true)}
          onToggleDimensions={handleToggleDimensions}
          onToggleInteriorProps={() => setShowInteriorProps3D((prev) => !prev)}
          onFitScene={() => {
            const controls = controlsRef.current;
            const perspective = perspCamRef.current;
            if (!controls || !perspective) return;
            const bounds = computeFastParametricSceneBounds(project.modules);
            if (!bounds.isEmpty()) {
              const framed = computeHeroStudioFraming(
                bounds,
                perspective.fov,
                perspective.aspect,
                "hero"
              );
              controls.target.copy(framed.target);
              perspective.position.copy(framed.position);
              perspective.lookAt(framed.target);
              perspective.updateProjectionMatrix();
              controls.update();
              requestRender();
            }
          }}
          onFlipDoorDirection={flipActiveDoorDirection}
          onSetBayDoorType={(bayIdx, type) =>
            setBayDoorType(bayIdx, type as Parameters<typeof setBayDoorType>[1])
          }
          onApplyMaterialToSimilar={applyMaterialToSimilarComponents}
          onAddInteriorItemAtElevation={addInteriorItemAtElevation}
          onApplyBayInteriorPreset={applyBayInteriorPreset}
          onSetShelfElevation={setShelfElevation}
          onSetShelfThickness={setShelfThickness}
          onSetDrawerPlacement={setDrawerPlacement}
          onSetHangingRailElevation={setHangingRailElevation}
          onMoveInteriorItemToBay={moveInteriorItemToBay}
          onSplitBayIntoTwo={splitBayIntoTwo}
          onEqualizeBaysAndShelves={equalizeBaysAndShelves}
          onRemoveBayAt={removeBayAt}
          onRemoveSelectedInteriorComponent={removeSelectedInteriorComponent}
          onAddAdjacentModule={addAdjacentModule}
          onDuplicateActiveModule={duplicateActiveModule}
          onRotateActiveModule90={rotateActiveModule90}
          onSwapModuleWithNeighbor={(modIdx, dir) =>
            swapModuleWithNeighbor(modIdx, dir === 1 ? "right" : "left")
          }
          onReplaceModuleWithTemplate={(modIdx, tplId) => {
            useConfiguratorStore.getState().setActiveModuleIndex(modIdx);
            applyV4Template(tplId, false);
          }}
          onToggleModuleLedLighting={toggleModuleLedLighting}
          onSetPlinthHeight={setPlinthHeight}
          onRemoveActiveModule={removeActiveModule}
          onRemoveSpaceObstacle={removeSpaceObstacle}
          onUndo={undo}
          onRedo={redo}
        />
        </>
        )}
      </div>
    );
  }
);

V3ThreeViewport.displayName = "V3ThreeViewport";
export default V3ThreeViewport;
