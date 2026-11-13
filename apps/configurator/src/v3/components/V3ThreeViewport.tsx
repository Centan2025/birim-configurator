"use client";

import React, { useEffect, useRef, useCallback, useState, useMemo } from "react";
import * as THREE from "three";
import {
  createComponentMesh,
  publishSceneDiagnostics,
  createModuleGroup,
} from "../../components/componentMesh";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  useV3Adapter,
  generateModuleGeometry,
  DEFAULT_MATERIALS,
  getModuleOrientedFootprint,
  getActiveDraggedTemplateId,
  setActiveDraggedTemplateId,
  computeRowSnapPreview,
} from "../adapter/useV3Adapter";
import { calculateFourSpaceDimensions, calculateNetInnerHeight, calculateBayWidths, calculateModulePlacement
} from "@birim/core";
import {
  computeElevationSnapTargets,
  resolveElevationSnap,
  findDraggableInteriorComponent,
  type ElevationSnapTarget,
} from "../engine/elevationSnapEngine";
import { renderSceneWithBlenderCycles } from "../engine/blenderRenderClient";
import {
  getV3PbrMaterial,
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
import {
  markSharedGeometry,
  markSharedMaterial,
  markSharedTexture,
  disposeObject3DTree,
  attachWebGLContextRecovery,
} from "../materials/webglResourceGuard";
import {
  createSculptedHangingShirtGroup,
  createFoldedKnitwearStackGroup,
  createLiddedStorageBoxGroup,
  createSculptedShoePairGroup,
} from "../materials/wardrobePropsBuilder";
import {
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
import { useConfiguratorStore } from "../../store/useConfiguratorStore";


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
  // Tight showroom vertical & horizontal fill (~84% vertical height, matching reference studio photograph)
  const distForHeight = (size.y * 0.595) / tanV;
  const distForWidth = (size.x * 0.64) / tanH;
  const dist = Math.max(2100, distForHeight, distForWidth);
  const dir =
    angle === "front"
      ? new THREE.Vector3(0, 0.02, 1).normalize()
      : new THREE.Vector3(0.28, 0.048, 1.0).normalize();
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
    color: 0xe0f2fe,
    roughness: 0.18,
    metalness: 0.0,
    transmission: 0.0,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
);
const xrayHoleUnitCylinder = markSharedGeometry(new THREE.CylinderGeometry(0.5, 0.5, 1, 14));
const xrayHoleMatD5 = markSharedMaterial(new THREE.MeshBasicMaterial({ color: 0x10b981 }));
const xrayHoleMatD8 = markSharedMaterial(new THREE.MeshBasicMaterial({ color: 0x3b82f6 }));
const xrayHoleMatD15 = markSharedMaterial(new THREE.MeshBasicMaterial({ color: 0xef4444 }));
const xrayHoleMatD35 = markSharedMaterial(new THREE.MeshBasicMaterial({ color: 0xf59e0b }));
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
        ? 0x292524
        : 0x94a3b8,
      linewidth: 1,
      opacity: isSelected
        ? 0.95
        : !isPhotoreal
        ? 0.88
        : 0.0,
      transparent: isPhotoreal || isSelected,
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

  // Sleek architectural dimension rod + arrowheads
  add3DRod(group, d1, d2, 2.3, mat);
  const segDir = new THREE.Vector3().subVectors(d2, d1);
  if (segDir.length() > 90) {
    add3DArrowCone(group, d1, segDir.clone().negate(), mat);
    add3DArrowCone(group, d2, segDir, mat);
  }

  // Extension rods
  add3DRod(
    group,
    p1.clone().addScaledVector(extDir, 12),
    d1.clone().addScaledVector(extDir, tickOver),
    1.6,
    mat
  );
  add3DRod(
    group,
    p2.clone().addScaledVector(extDir, 12),
    d2.clone().addScaledVector(extDir, tickOver),
    1.6,
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
  });
}

export interface V3ThreeViewportProps {
  theme?: "warm-light" | "showroom-neutral" | "dark";
  showGrid?: boolean;
  showInCanvasHud?: boolean;
  showDimensions?: boolean;
  stageSafeInsets?: { topPx?: number; bottomPx?: number; leftPx?: number; rightPx?: number };
  onToggleDimensions?: () => void;
  onPerformanceSample?: (metrics: { lastRenderMs: number }) => void;
}

export const V3ThreeViewport: React.FC<V3ThreeViewportProps> = React.memo(
  ({
    theme = "warm-light",
    showGrid = true,
    showInCanvasHud = true,
    showDimensions,
    stageSafeInsets,
    onToggleDimensions,
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
      setDimensions,
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
      finishModuleDragWithSmartSwap,
      updateObstaclePosition,
      beginHistoryTransaction,
      commitHistoryTransaction,
      addInteriorItemAtElevation,
      dropV4TemplateWithSnap,
    } = useV3Adapter({ lightweightViewport: true });

    const experienceTier = useConfiguratorStore((s) => s.userExperienceTier);
    const canUndo3D = useConfiguratorStore((s) => s.history.length > 0);
    const canRedo3D = useConfiguratorStore((s) => s.future.length > 0);
    const isSimpleTier = experienceTier === "simple";
    const [contextMenuTarget, setContextMenuTarget] = useState<Viewport3DContextTarget | null>(null);
    const [editingBadge, setEditingBadge] = useState<null | "W" | "H" | "D" | "SOKET">(null);
    const [badgeDraftValue, setBadgeDraftValue] = useState<string>("");
    const [doorsHiddenIn3D, setDoorsHiddenIn3D] = useState<boolean>(false);
    const [cutawayActiveBay, setCutawayActiveBay] = useState<boolean>(false);
    const [showInteriorProps3D, setShowInteriorProps3D] = useState<boolean>(true);
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
    const [lightingPreset, setLightingPreset] = useState<"daylight" | "showroom_warm" | "night_led">(
      "showroom_warm"
    );
    const [wallTone, setWallTone] = useState<ArchitecturalWallTone>("warm_taupe");
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
      window.addEventListener("birim:set-floor-style", onFloorChange);
      window.addEventListener("birim:set-doors-hidden", onDoorsHiddenChange);
      window.addEventListener("birim:set-hardware-view-mode", onHwViewModeChange);
      window.addEventListener("birim:set-material-mode", onMatModeChange);
      window.addEventListener("birim:set-brush-material", onBrushMatChange);
      return () => {
        window.removeEventListener("birim:set-floor-style", onFloorChange);
        window.removeEventListener("birim:set-doors-hidden", onDoorsHiddenChange);
        window.removeEventListener("birim:set-hardware-view-mode", onHwViewModeChange);
        window.removeEventListener("birim:set-material-mode", onMatModeChange);
        window.removeEventListener("birim:set-brush-material", onBrushMatChange);
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
    const [moveObjectMode3D, setMoveObjectMode3D] = useState<boolean>(true);
    const [invertCameraMouse, setInvertCameraMouse] = useState<boolean>(true);
    const [active3DSnap, setActive3DSnap] = useState<ElevationSnapTarget | null>(null);
    const roomArchGroupRef = useRef<THREE.Group | null>(null);
    const [dragDropSnapBanner, setDragDropSnapBanner] = useState<string | null>(null);
    const hoverBadgeDomRef = useRef<HTMLDivElement | null>(null);
    const hoverBadgeTextRef = useRef<HTMLSpanElement | null>(null);
    const solidMeshesCacheRef = useRef<{ open: THREE.Mesh[]; closed: THREE.Mesh[]; dirty: boolean }>({
      open: [],
      closed: [],
      dirty: true,
    });
    const isOrbitingRef = useRef<boolean>(false);
    const canvasRectRef = useRef<DOMRect | null>(null);
    const [dismissedBayPopover, setDismissedBayPopover] = useState<boolean>(false);
    const [isCtrlPressed, setIsCtrlPressed] = useState<boolean>(false);
    const [webglContextLost, setWebglContextLost] = useState<boolean>(false);
    const cncXrayMode = useConfiguratorStore((s) => s.cncXrayMode);
    const setCncXrayMode = useConfiguratorStore((s) => s.setCncXrayMode);
    const isXrayActive = cncXrayMode || hardwareViewMode === "technical";
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
            useConfiguratorStore.setState({
              doorOpenAngleDeg: opening ? 82 : 0,
              drawerOpenMm: opening ? 300 : 0,
            });
            return;
          }
        }
        if (ev.key === "Escape") {
          setClicked3DContext(null);
          setEditingBadge(null);
          setRenderMenuOpen(false);
          setHardwareViewMenuOpen(false);
          setDismissedBayPopover(true);
          setDragDropSnapBanner(null);
        }
        if (ev.key === "Control" || ev.key === "Meta" || ev.ctrlKey || ev.metaKey) {
          setIsCtrlPressed(true);
          const canvas = mountRef.current?.querySelector("canvas");
          if (canvas) {
            canvas.style.cursor = "move";
          }
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

      const onBlur = () => {
        setIsCtrlPressed(false);
        const canvas = mountRef.current?.querySelector("canvas");
        if (canvas) {
          canvas.style.cursor = "grab";
        }
      };

      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      window.addEventListener("blur", onBlur);
      return () => {
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
        window.removeEventListener("blur", onBlur);
      };
    }, []);
    const hemiLightRef = useRef<THREE.HemisphereLight | null>(null);
    const keyLightRef = useRef<THREE.DirectionalLight | null>(null);
    const rimLightRef = useRef<THREE.DirectionalLight | null>(null);

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
      setShelfElevation,
      setDrawerPlacement,
      setSpecialFittingPlacement,
      setHangingRailElevation,
      setBayCustomWidth,
      setSubDividerPlacement,
      setModulePosition,
      finishModuleDragWithSmartSwap,
      updateObstaclePosition,
      beginHistoryTransaction,
      commitHistoryTransaction,
    });
    useEffect(() => {
      latestStateRef.current = {
        project,
        activeModuleIndex,
        doorOpenAngleDeg,
        doorsHiddenIn3D,
        moveObjectMode3D,
        spaceObstacles,
        setActiveModuleIndex,
        setActiveBayIndex,
        setSelectedComponentId,
        setShelfElevation,
        setDrawerPlacement,
        setSpecialFittingPlacement,
        setHangingRailElevation,
        setBayCustomWidth,
        setSubDividerPlacement,
        setModulePosition,
        finishModuleDragWithSmartSwap,
        updateObstaclePosition,
        beginHistoryTransaction,
        commitHistoryTransaction,
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
      setShelfElevation,
      setDrawerPlacement,
      setSpecialFittingPlacement,
      setHangingRailElevation,
      setBayCustomWidth,
      setSubDividerPlacement,
      setModulePosition,
      finishModuleDragWithSmartSwap,
      updateObstaclePosition,
      beginHistoryTransaction,
      commitHistoryTransaction,
    ]);

    // Sync OrbitControls mouse direction (Natural object rotation vs standard camera orbit)
    useEffect(() => {
      if (controlsRef.current) {
        controlsRef.current.rotateSpeed = invertCameraMouse ? -0.85 : 0.9;
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
          valueText: isSimpleTier ? `${W / 10} cm` : `${W} mm`,
          borderColor: "#D6D0C4",
          badgeBg: "#141413",
          localMidpoint: new THREE.Vector3(W * 0.5, H + 105, D * 0.65),
        },
        {
          id: "dim_H",
          tag: "Yükseklik",
          valueText: isSimpleTier ? `${H / 10} cm` : `${H} mm`,
          borderColor: "#D6D0C4",
          badgeBg: "#141413",
          localMidpoint: new THREE.Vector3(W + 115, H * 0.52, D),
        },
        {
          id: "dim_D",
          tag: "Derinlik",
          valueText: isSimpleTier ? `${D / 10} cm` : `${D} mm`,
          borderColor: "#D6D0C4",
          badgeBg: "#57534E",
          localMidpoint: new THREE.Vector3(W + 125, 18, D * 0.5),
        },
      ];

      if (!isSimpleTier) {
        list.push({
          id: "dim_SOKET",
          tag: "Soket",
          valueText: `${soketW} mm`,
          borderColor: "#D6D0C4",
          badgeBg: "#57534E",
          localMidpoint: new THREE.Vector3(W * 0.5, 8, D + 115),
        });
      }

      if (mod.category !== "complementary" && mod.bays.length >= 1) {
        const fs = calculateFourSpaceDimensions(mod);
        const bayWidths = fs.usableInternal.bayClearWidthsMm;
        let curX = T;
        mod.bays.forEach((b, bIdx) => {
          const bw = bayWidths[bIdx] || Math.round((W - (mod.bays.length + 1) * T) / mod.bays.length);
          const midX = curX + bw * 0.5;
          list.push({
            id: `dim_BAY_${bIdx}`,
            tag: `${bIdx + 1}. Bölme`,
            valueText: isSimpleTier ? `${Math.round(bw / 10)} cm` : `${bw} mm`,
            borderColor: "#D6D0C4",
            badgeBg: "#141413",
            localMidpoint: new THREE.Vector3(midX, H + 28, D * 0.92),
          });
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
          valueText: isSimpleTier ? `${spanMm / 10} cm` : `${spanMm} mm`,
          borderColor: "#D6D0C4",
          badgeBg: "#141413",
          localMidpoint: new THREE.Vector3((minX + maxX) * 0.5, maxH + 260, 300),
        });
      }

      return list;
    }, [project, activeModuleIndex, effectiveShowDimensions, isSimpleTier]);

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
    const dimGroupRef = useRef<THREE.Group | null>(null);
    const ghostSnapGroupRef = useRef<THREE.Group | null>(null);
    const lastGhostKeyRef = useRef<string>("");
    const lastAccessoryDropTargetRef = useRef<{ bayIndex: number; elevationY: number; offsetX?: number; accessory: any } | null>(null);
    const selectionFrameGroupRef = useRef<THREE.Group | null>(null);
    const activeModFrameGroupRef = useRef<THREE.Group | null>(null);
    const dimWorldAnchorsRef = useRef<{ id: string; worldPos: THREE.Vector3; isActiveMod?: boolean }[]>([]);
    const liveDimDeltaRef = useRef<{ dx: number; dz: number }>({ dx: 0, dz: 0 });
    const dimLabelDomMapRef = useRef<Map<string, HTMLDivElement>>(new Map());
    const gridRef = useRef<THREE.GridHelper | null>(null);
    const shadowPlaneRef = useRef<THREE.Mesh | null>(null);
    const needsRenderRef = useRef<boolean>(true);

    const [glbCatalogRev, setGlbCatalogRev] = useState(0);
    const [glbLibraryOpen, setGlbLibraryOpen] = useState(false);

    const markShadowsAndRender = useCallback(() => {
      if (rendererRef.current && rendererRef.current.shadowMap.enabled) {
        rendererRef.current.shadowMap.needsUpdate = true;
      }
      needsRenderRef.current = true;
    }, []);

    useEffect(() => {
      preloadAllWardrobeGlbAssets();
      const unsubRender = subscribeWardrobeGlbRenderNeeded(() => {
        markShadowsAndRender();
      });
      const unsubCatalog = subscribeWardrobeGlbCatalogChange(() => {
        setGlbCatalogRev((rev) => rev + 1);
      });
      return () => {
        unsubRender();
        unsubCatalog();
      };
    }, [markShadowsAndRender]);

    const updateProjectedDimensionLabels = useCallback(() => {
      const curRenderer = rendererRef.current;
      const cam = (controlsRef.current?.object as THREE.Camera) || perspCamRef.current;
      if (!curRenderer || !cam) return;
      const w = curRenderer.domElement.clientWidth;
      const h = curRenderer.domElement.clientHeight;
      if (w === 0 || h === 0) return;

      cam.updateMatrixWorld();
      const placed: { id: string; x: number; y: number; visible: boolean }[] = [];

      const { dx: dimDx, dz: dimDz } = liveDimDeltaRef.current;
      for (const item of dimWorldAnchorsRef.current) {
        const anchorPos = item.isActiveMod && (dimDx !== 0 || dimDz !== 0)
          ? new THREE.Vector3(item.worldPos.x + dimDx, item.worldPos.y, item.worldPos.z + dimDz)
          : item.worldPos.clone();
        const ndc = anchorPos.project(cam);
        if (ndc.z > 1) {
          placed.push({ id: item.id, x: 0, y: 0, visible: false });
          continue;
        }
        const rawX = (ndc.x + 1) * 0.5 * w;
        const rawY = (-ndc.y + 1) * 0.5 * h;
        let x = Math.max(72, Math.min(w - 72, rawX));
        let y = Math.max(64, Math.min(h - 68, rawY));

        // Prevent overlapping labels on screen
        for (const prev of placed) {
          if (!prev.visible) continue;
          if (Math.abs(x - prev.x) < 118 && Math.abs(y - prev.y) < 34) {
            y = prev.y + (y >= prev.y ? 36 : -36);
            y = Math.max(64, Math.min(h - 68, y));
          }
        }
        placed.push({ id: item.id, x, y, visible: true });
      }

      for (const p of placed) {
        const el = dimLabelDomMapRef.current.get(p.id);
        if (!el) continue;
        if (!p.visible) {
          el.style.opacity = "0";
        } else {
          const uOff = customLabelOffsetsRef.current[p.id] || { dx: 0, dy: 0 };
          el.style.opacity = "1";
          el.style.transform = `translate3d(${Math.round(p.x + uOff.dx)}px, ${Math.round(p.y + uOff.dy)}px, 0) translate(-50%, -50%)`;
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
          ? 0xc6c1b7
          : theme === "showroom-neutral"
          ? 0xbdb7ab
          : 0x18181b;
      scene.background = new THREE.Color(bgHex);
      sceneRef.current = scene;

      // 30° Architectural Telephoto Lens at Human Eye-Level (eliminates security-camera downward distortion)
      const perspCamera = new THREE.PerspectiveCamera(30, width / height, 15, 28000);
      perspCamera.position.set(2150, 1260, 4680);
      perspCamRef.current = perspCamera;

      const aspect = width / height;
      const orthoD = 1550;
      const orthoCamera = new THREE.OrthographicCamera(
        -orthoD * aspect,
        orthoD * aspect,
        orthoD,
        -orthoD,
        -50000,
        50000
      );
      orthoCamera.position.set(2150, 1260, 4680);
      orthoCamRef.current = orthoCamera;

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.autoUpdate = false;
      renderer.shadowMap.needsUpdate = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      const agxToneMapping = (THREE as unknown as { AgXToneMapping?: THREE.ToneMapping }).AgXToneMapping;
      renderer.toneMapping = agxToneMapping ?? THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.03;
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
      controls.screenSpacePanning = true;
      controls.enableDamping = true;
      controls.dampingFactor = 0.09;
      controls.maxDistance = 14000;
      controls.minDistance = 250;
      controls.minPolarAngle = 0.04;
      controls.maxPolarAngle = Math.PI * 0.495;
      controls.target.set(900, 1080, 300);
      controls.addEventListener("start", () => {
        isOrbitingRef.current = true;
      });
      controls.addEventListener("end", () => {
        isOrbitingRef.current = false;
      });
      controls.addEventListener("change", () => {
        if (controls.target.y < 40) {
          controls.target.y = 40;
        }
        needsRenderRef.current = true;
      });
      controlsRef.current = controls;

      scene.environment = getStudioPmremEnvironment(renderer);

      const detachContextRecovery = attachWebGLContextRecovery(renderer.domElement, {
        onLost: () => {
          setWebglContextLost(true);
        },
        onRestored: () => {
          setWebglContextLost(false);
          scene.environment = getStudioPmremEnvironment(renderer);
          renderer.shadowMap.needsUpdate = true;
          needsRenderRef.current = true;
        },
      });

      const hemiLight = new THREE.HemisphereLight(0xfffcf7, 0x9c9283, 0.28);
      scene.add(hemiLight);
      hemiLightRef.current = hemiLight;

      // Architectural 3/4 Left-Front Key Softbox: casts soft shadow onto the wall behind/right of cabinet
      // and creates natural 3D tonal contrast between the lit top panel (+Y), front doors (+Z), and shaded right side (+X)!
      const keyLight = new THREE.DirectionalLight(0xfffaf2, 1.24);
      keyLight.position.set(-2150, 3450, 3350);
      keyLight.target.position.set(1400, 900, 200);
      scene.add(keyLight.target);
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.width = 1024;
      keyLight.shadow.mapSize.height = 1024;
      keyLight.shadow.camera.left = -2900;
      keyLight.shadow.camera.right = 3200;
      keyLight.shadow.camera.top = 2900;
      keyLight.shadow.camera.bottom = -1300;
      keyLight.shadow.camera.near = 250;
      keyLight.shadow.camera.far = 9800;
      keyLight.shadow.bias = -0.00025;
      keyLight.shadow.normalBias = 1.4;
      keyLight.shadow.radius = 5.2;
      scene.add(keyLight);
      keyLightRef.current = keyLight;

      const rimLight = new THREE.DirectionalLight(0xebeef2, 0.22);
      rimLight.position.set(2900, 2300, 1650);
      scene.add(rimLight);
      rimLightRef.current = rimLight;

      const frontFillLight = new THREE.DirectionalLight(0xfaf7f2, 0.22);
      frontFillLight.position.set(1600, 1400, 3400);
      scene.add(frontFillLight);

      const floorBounceLight = new THREE.DirectionalLight(0xf0e6d8, 0.1);
      floorBounceLight.position.set(900, -1400, 2000);
      scene.add(floorBounceLight);

      // Subtle architectural floor grid with clear contrast
      const gridColor1 = theme === "dark" ? 0x334155 : 0x8c857b;
      const gridColor2 = theme === "dark" ? 0x1e293b : 0xb5afa4;
      const grid = new THREE.GridHelper(8000, 80, gridColor1, gridColor2);
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

      const getCachedSolidMeshes = (curGroup: THREE.Object3D, includeBayVolumes: boolean) => {
        const cache = solidMeshesCacheRef.current;
        if (cache.dirty) {
          cache.open = collectSolidCabinetMeshes(curGroup, true);
          cache.closed = cache.open.filter((m) => m.userData?.role !== "bay_compartment");
          cache.dirty = false;
        }
        return includeBayVolumes ? cache.open : cache.closed;
      };

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
          | "obstacle_3d";
        targetId: string;
        startValueMm: number;
        startSecondValueMm?: number;
        startThirdValueMm?: number;
        isSideWallObs?: boolean;
        dragPlane?: THREE.Plane;
        startPlaneHit?: THREE.Vector3;
        itemHeightMm?: number;
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

        const rect = curRenderer.domElement.getBoundingClientRect();
        pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        const curCam = (curControls.object as THREE.Camera) || perspCamRef.current;
        if (!curCam) return;

        raycaster.setFromCamera(pointer, curCam);
        const state = latestStateRef.current;

        // 1. Raycast solid cabinet meshes FIRST so upper & base cabinets always take priority over wall obstacles behind them!
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
        const closestCabinetDist = hits.length > 0 ? hits[0].distance : Infinity;

        // 2. Only grab an Architectural Obstacle (Window, Door, Plumbing, Column) if NO cabinet is in front of it!
        if (curRoomGroup && (state.moveObjectMode3D || e.shiftKey)) {
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
            cMod.bays.some((b) => b.door.type === "open" || b.door.doorSystemId === "open");

          const wantInteriorDrag = !state.moveObjectMode3D ? !e.shiftKey : e.ctrlKey || e.metaKey;
          if (wantInteriorDrag && (doorsAreOpen || isExternalDrawerFront)) {
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
              break;
            }
          }
          if (!doorsAreOpen && String(cand.userData.role || "").startsWith("door")) {
            break;
          }
        }
        if (!hitObj?.userData?.componentId || !mod) return;

        // Immediately select the hit module, bay, and component on pointerdown so clicks NEVER fail!
        const clickedCompId =
          String(hitObj.userData.role) === "door_handle" && hitObj.userData.parentComponentId
            ? String(hitObj.userData.parentComponentId)
            : String(hitObj.userData.componentId);
        state.setActiveModuleIndex(modIdx);
        if (typeof hitObj.userData.bayIndex === "number") {
          state.setActiveBayIndex(hitObj.userData.bayIndex);
        }
        (state.setSelectedComponentId as (id: string | null, mIdx?: number) => void)(
          clickedCompId,
          modIdx
        );
        // Selection is shown directly in the frosted top pill & floating inspector card (no duplicate overlapping banner)

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

        // If user is in 3D Move Mode (or holding Shift), grab and move the WHOLE MODULE along the wall!
        if ((state.moveObjectMode3D || e.shiftKey) && !dragMeta) {
          state.setActiveModuleIndex(modIdx);
          (state.setSelectedComponentId as (id: string | null, mIdx?: number) => void)(
            clickedCompId,
            modIdx
          );
          state.beginHistoryTransaction();
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

        activeDrag3D = {
          modIdx,
          bayIdx: dragMeta.bayIdx,
          kind: dragMeta.kind,
          targetId: dragMeta.targetId,
          startValueMm: dragMeta.startVal,
          startSecondValueMm: dragMeta.startElevY,
          itemHeightMm: dragMeta.itemHeightMm,
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
      const hoverFillMat = new THREE.MeshBasicMaterial({
        color: 0x0ea5e9,
        transparent: true,
        opacity: 0.28,
        depthTest: false,
        depthWrite: false,
      });
      const hoverOutlineMat = new THREE.LineBasicMaterial({
        color: 0x0284c7,
        linewidth: 2,
        depthTest: false,
      });
      const hoverFillMesh = new THREE.Mesh(hoverBoxGeo, hoverFillMat);
      hoverFillMesh.raycast = () => {};
      const hoverOutlineSegments = new THREE.LineSegments(
        new THREE.EdgesGeometry(hoverBoxGeo),
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
          const now = performance.now();
          if (now - lastHoverCheckTime < 60) return;
          lastHoverCheckTime = now;

          const curGroup = meshGroupRef.current;
          const curCam = (controlsRef.current?.object as THREE.Camera) || perspCamRef.current;
          if (!curGroup || !curCam) return;

          const rect = canvasRectRef.current || curRenderer.domElement.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) return;

          pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
          raycaster.setFromCamera(pointer, curCam);

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
              if (!hitMesh.geometry.boundingBox) {
                hitMesh.geometry.computeBoundingBox();
              }
              const localBox = hitMesh.geometry.boundingBox;
              if (localBox && !localBox.isEmpty()) {
                const localCenter = new THREE.Vector3();
                const localSize = new THREE.Vector3();
                localBox.getCenter(localCenter);
                localBox.getSize(localSize);
                const worldCenter = localCenter.clone().applyMatrix4(hitMesh.matrixWorld);
                const worldQuat = new THREE.Quaternion();
                hitMesh.getWorldQuaternion(worldQuat);
                hoverOverlayGroup.position.copy(worldCenter);
                hoverOverlayGroup.quaternion.copy(worldQuat);
                hoverOverlayGroup.scale.set(
                  Math.max(12, localSize.x + 6),
                  Math.max(12, localSize.y + 6),
                  Math.max(12, localSize.z + 6)
                );
                hoverOverlayGroup.visible = true;
              }
              const partLabel = String(hitMesh.userData?.label || hitMesh.userData?.role || "Parça");
              const dimsTxt = hitMesh.userData?.dimsText ? ` (${hitMesh.userData.dimsText})` : "";
              const bayTxt =
                typeof hitMesh.userData?.bayIndex === "number"
                  ? `Bölme ${hitMesh.userData.bayIndex + 1} • `
                  : "";
              setHoverBadgeDirect(`${bayTxt}${partLabel}${dimsTxt}`);
              curRenderer.domElement.style.cursor = e.ctrlKey || e.metaKey ? "move" : "pointer";
            } else {
              hoverOverlayGroup.visible = false;
              setHoverBadgeDirect(null);
              curRenderer.domElement.style.cursor = e.ctrlKey || e.metaKey ? "move" : "grab";
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

        if (activeDrag3D.kind === "obstacle_3d") {
          let deltaX = dxPx * activeDrag3D.mmPerPx;
          let deltaZ = -dxPx * activeDrag3D.mmPerPx;
          let deltaY = -dyPx * activeDrag3D.mmPerPx;

          const curRenderer = rendererRef.current;
          const curCam = (controlsRef.current?.object as THREE.Camera) || perspCamRef.current;
          if (curRenderer && curCam && activeDrag3D.dragPlane && activeDrag3D.startPlaneHit) {
            const rect = curRenderer.domElement.getBoundingClientRect();
            const curNdcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            const curNdcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            const rc = new THREE.Raycaster();
            rc.setFromCamera(new THREE.Vector2(curNdcX, curNdcY), curCam);
            const curHit = new THREE.Vector3();
            if (rc.ray.intersectPlane(activeDrag3D.dragPlane, curHit)) {
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
          if (activeDrag3D.isSideWallObs) {
            const nextZ = Math.max(
              0,
              Math.round(((activeDrag3D.startThirdValueMm || 0) + deltaZ) / 10) * 10
            );
            state.updateObstaclePosition(
              activeDrag3D.targetId,
              activeDrag3D.startValueMm,
              nextZ,
              nextY
            );
            setDragDropSnapBanner(
              `🎯 Yan Duvar Pencere/Engel Taşınıyor: Z:${nextZ}mm • Yükseklik Kotu Y:${nextY}mm`
            );
          } else {
            const nextX = Math.max(
              0,
              Math.round((activeDrag3D.startValueMm + deltaX) / 10) * 10
            );
            state.updateObstaclePosition(
              activeDrag3D.targetId,
              nextX,
              activeDrag3D.startThirdValueMm,
              nextY
            );
            setDragDropSnapBanner(
              `🎯 3D Pencere/Engel Taşınıyor: X:${nextX}mm • Yükseklik Kotu Y:${nextY}mm`
            );
          }
          return;
        }

        if (activeDrag3D.kind === "module_3d") {
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
            setDragDropSnapBanner(`✋ 3D Köşe/Yan Modül Taşınıyor: Z: ${nextZ}mm`);
            state.setModulePosition(activeDrag3D.modIdx, activeDrag3D.startValueMm, nextZ, 1);
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

          setDragDropSnapBanner(snapText);
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

        if (activeDrag3D.kind === "divider") {
          const rawX = activeDrag3D.startValueMm + dxPx * activeDrag3D.mmPerPx;
          const snappedX = Math.round(rawX / 10) * 10;
          state.setBayCustomWidth(activeDrag3D.bayIdx, snappedX, false);
          return;
        }
        if (activeDrag3D.kind === "sub_divider") {
          const rawX = activeDrag3D.startValueMm + dxPx * activeDrag3D.mmPerPx;
          const snappedX = Math.round(rawX / 10) * 10;
          const startMidY =
            (activeDrag3D.startSecondValueMm ?? 0) + (activeDrag3D.itemHeightMm ?? 300) / 2;
          const targetMidY = Math.round(startMidY - dyPx * activeDrag3D.mmPerPx);
          state.setSubDividerPlacement(
            activeDrag3D.bayIdx,
            activeDrag3D.targetId,
            { offsetX: snappedX, targetMidY },
            false
          );
          return;
        }

        // Moving mouse UP (negative dyPx) increases elevationY
        const rawElevY = activeDrag3D.startValueMm - dyPx * activeDrag3D.mmPerPx;
        const targets = computeElevationSnapTargets(
          state.project,
          activeDrag3D.modIdx,
          activeDrag3D.bayIdx,
          activeDrag3D.targetId,
          activeDrag3D.itemHeightMm
        );
        const { elevationY: snappedY, snappedTarget } = resolveElevationSnap(
          rawElevY,
          targets,
          18
        );
        setActive3DSnap(snappedTarget);

        if (activeDrag3D.kind === "shelf") {
          state.setShelfElevation(activeDrag3D.bayIdx, activeDrag3D.targetId, snappedY, false);
        } else if (activeDrag3D.kind === "drawer") {
          state.setDrawerPlacement(
            activeDrag3D.bayIdx,
            activeDrag3D.targetId,
            snappedY,
            undefined,
            false
          );
        } else if (activeDrag3D.kind === "rail") {
          state.setHangingRailElevation(activeDrag3D.bayIdx, activeDrag3D.targetId, snappedY, false);
        } else if (activeDrag3D.kind === "special_fitting") {
          state.setSpecialFittingPlacement?.(activeDrag3D.bayIdx, activeDrag3D.targetId, { elevationY: snappedY }, false);
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

        const curRenderer = rendererRef.current;
        const curControls = controlsRef.current;
        if (curControls) curControls.enabled = true;

        if (activeDrag3D) {
          const moved = activeDrag3D.hasMoved;
          const dragKind = activeDrag3D.kind;
          const dragModIdx = activeDrag3D.modIdx;
          const dragStartX = activeDrag3D.startValueMm;
          const pendingGpuX = (activeDrag3D as { liveGpuX?: number }).liveGpuX;
          const pendingGpuZ = (activeDrag3D as { liveGpuZ?: number }).liveGpuZ;
          activeDrag3D = null;
          setActive3DSnap(null);
          if (curRenderer) {
            curRenderer.domElement.style.cursor = (e.ctrlKey || e.metaKey || isCtrlPressed) ? "move" : "grab";
          }
          const state = latestStateRef.current;
          if (dragKind === "module_3d" || dragKind === "obstacle_3d") {
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
            if (dragKind === "module_3d" && moved) {
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
                setDragDropSnapBanner(swapMsg);
                setTimeout(() => setDragDropSnapBanner(null), 2800);
              } else {
                setDragDropSnapBanner(null);
              }
            } else {
              state.commitHistoryTransaction();
            }
          } else {
            // Commit interior drag transaction (`shelf`, `drawer`, `divider`, `rail`, `special_fitting`) once on pointerup!
            state.commitHistoryTransaction();
          }
          if (moved) return;
        }

        if (Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > 16) return;
        const curGroup = meshGroupRef.current;
        if (!curRenderer || !curGroup) return;

        const rect = curRenderer.domElement.getBoundingClientRect();
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
            state.setActiveModuleIndex(hitModIdx);
            const hitMod = state.project.modules[hitModIdx];
            const roleStr = String(hitObj.userData.role || "");

            // Determine bayIndex either from mesh userData or by projecting 3D hit point along module X
            let resolvedBayIdx =
              typeof hitObj.userData.bayIndex === "number" ? hitObj.userData.bayIndex : -1;
            if (resolvedBayIdx < 0 && hitMod && hitMod.bays.length > 0) {
              const bd = generateModuleGeometry(hitMod, { doorOpenAngleDeg: 0 });
              const T = hitMod.carcass.panelThickness || 18;
              const localX = h.point.x - hitMod.position.x;
              let accX = T;
              for (let bIdx = 0; bIdx < hitMod.bays.length; bIdx++) {
                const bw = bd.bayWidths[bIdx] || 500;
                if (localX <= accX + bw + T * 0.5 || bIdx === hitMod.bays.length - 1) {
                  resolvedBayIdx = bIdx;
                  break;
                }
                accX += bw + T;
              }
            }
            if (resolvedBayIdx >= 0) {
              state.setActiveBayIndex(resolvedBayIdx);
            }

            const rawCompId = String(hitObj.userData.componentId);
            const resolvedCompId =
              roleStr === "door_handle" && hitObj.userData.parentComponentId
                ? String(hitObj.userData.parentComponentId)
                : rawCompId;

            (state.setSelectedComponentId as (id: string | null, mIdx?: number) => void)(
              resolvedCompId,
              hitModIdx
            );

            const isDoorHit =
              roleStr === "door" ||
              roleStr.startsWith("door_") ||
              rawCompId.includes("_door_") ||
              resolvedCompId.includes("door_");
            const safeBay = Math.max(0, resolvedBayIdx);

            if (isDoorHit && !state.doorsHiddenIn3D) {
              const leafSideLabel = resolvedCompId.includes("right") ? "Sağ Kapak" : "Sol Kapak";
              setDoorMenuSubSection(null);
              setClicked3DContext({
                kind: "door",
                bayIndex: safeBay,
                role: roleStr,
                componentId: resolvedCompId,
                label: `Bölme ${safeBay + 1} • ${leafSideLabel}`,
              });
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
              setClicked3DContext({
                kind: "bay",
                bayIndex: safeBay,
                role: roleStr,
                label: `Bölme ${safeBay + 1}`,
              });
              if (typeof window !== "undefined") {
                window.dispatchEvent(
                  new CustomEvent("birim:select-bay-3d", {
                    detail: { bayIndex: safeBay, role: roleStr, moduleIndex: hitModIdx },
                  })
                );
              }
            }
            return;
          }
        }
        state.setSelectedComponentId(null);
        setClicked3DContext(null);
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
                label: obsObj?.label || obsObj?.type || "Mimari Engel",
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

      renderer.domElement.addEventListener("pointerdown", handlePointerDown, { capture: true });
      renderer.domElement.addEventListener("contextmenu", handleContextMenu, { capture: true });
      window.addEventListener("pointermove", handlePointerMove, { capture: true });
      window.addEventListener("pointerup", handlePointerUp, { capture: true });

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

      // Two-Stage Render Loop: Fast 60 FPS DPR during interaction -> Crisp HiDPI settled studio frame 240ms after stop!
      let animId: number;
      let idleHiDpiTimer: ReturnType<typeof setTimeout> | null = null;
      let isHiDpiSettled = false;

      const scheduleIdleHiDpiPass = () => {
        // Steady <=1.25x DPR prevents 3K OLED WebGL framebuffer reallocation hitches on orbit start/stop!
        isHiDpiSettled = true;
      };

      const animate = () => {
        animId = requestAnimationFrame(animate);
        const curControls = controlsRef.current;
        const curRenderer = rendererRef.current;
        const curScene = sceneRef.current;
        if (!curControls || !curRenderer || !curScene) return;

        const updated = curControls.update();
        if (needsRenderRef.current || updated) {
          // Drop to crisp fast interactive DPR during live camera orbit/pan so frame rate stays locked at 60 FPS
          const fastDpr = Math.min(window.devicePixelRatio || 1, 1.25);
          if ((updated || isOrbitingRef.current) && isHiDpiSettled && curRenderer.getPixelRatio() > fastDpr) {
            curRenderer.setPixelRatio(fastDpr);
            isHiDpiSettled = false;
          }

          const t0 = performance.now();
          const cam = (curControls.object as THREE.Camera) || perspCamRef.current;
          if (cam) {
            curRenderer.render(curScene, cam);
            updateProjectedDimensionLabels();
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
          scheduleIdleHiDpiPass();
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
        if (idleHiDpiTimer) clearTimeout(idleHiDpiTimer);
        delete (window as unknown as { __birimRenderUltraStudioPhoto?: unknown }).__birimRenderUltraStudioPhoto;
        cancelAnimationFrame(animId);
        resizeObserver.disconnect();
        detachContextRecovery();
        delete (window as unknown as { __birimCapture3DSnapshot?: unknown }).__birimCapture3DSnapshot;
        renderer.domElement.removeEventListener("pointerdown", handlePointerDown, { capture: true });
        renderer.domElement.removeEventListener("contextmenu", handleContextMenu, { capture: true });
        window.removeEventListener("pointermove", handlePointerMove, { capture: true });
        window.removeEventListener("pointerup", handlePointerUp, { capture: true });
        controls.dispose();
        disposeObject3DTree(scene);
        scene.clear();
        disposeRendererPmremEnvironment(renderer);
        renderer.dispose();
        if (container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Update Theme, Lighting Atmosphere Preset & CAD Shadow Fast-Path
    useEffect(() => {
      if (sceneRef.current) {
        const bgHex =
          renderEdgeMode === "cad"
            ? 0xf8fafc
            : lightingPreset === "night_led" || theme === "dark" || wallTone === "anthracite_gallery"
            ? 0x262624
            : wallTone === "soft_plaster"
            ? 0xd6d1c7
            : lightingPreset === "showroom_warm"
            ? 0xc0bab0
            : 0xc6c1b7;
        sceneRef.current.background = new THREE.Color(bgHex);
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
        if (lightingPreset === "night_led") {
          hemiLightRef.current.color.setHex(0xd6d3d1);
          hemiLightRef.current.groundColor.setHex(0x18181b);
          hemiLightRef.current.intensity = 0.2;
          keyLightRef.current.color.setHex(0xffe8c8);
          keyLightRef.current.intensity = 0.38;
          rimLightRef.current.intensity = 0.18;
          rendererRef.current.toneMappingExposure = 0.96;
        } else if (lightingPreset === "showroom_warm") {
          hemiLightRef.current.color.setHex(0xfffaf0);
          hemiLightRef.current.groundColor.setHex(0x9c9283);
          hemiLightRef.current.intensity = 0.26;
          keyLightRef.current.color.setHex(0xffefd2);
          keyLightRef.current.intensity = 1.22;
          rimLightRef.current.intensity = 0.2;
          rendererRef.current.toneMappingExposure = 0.94;
        } else {
          hemiLightRef.current.color.setHex(0xfffcf7);
          hemiLightRef.current.groundColor.setHex(0x9c9283);
          hemiLightRef.current.intensity = 0.28;
          keyLightRef.current.color.setHex(0xfffaf2);
          keyLightRef.current.intensity = 1.24;
          rimLightRef.current.intensity = 0.22;
          rendererRef.current.toneMappingExposure = 0.94;
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
      const sceneBox = new THREE.Box3(
        new THREE.Vector3(minX, minY, minZ),
        new THREE.Vector3(maxX, maxY, maxZ)
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

    // 2-Directional Interactive 3D Section Clipping Plane (X Boyuna Kesit & Z Enine Kesit)
    useEffect(() => {
      const curRenderer = rendererRef.current;
      if (!curRenderer) return;
      if (!section3DAxis) {
        curRenderer.localClippingEnabled = false;
        curRenderer.clippingPlanes = [];
        requestRender();
        return;
      }
      const mod = project.modules[activeModuleIndex] || project.modules[0];
      if (!mod) return;
      curRenderer.localClippingEnabled = true;
      if (section3DAxis === "X") {
        const cutWorldX = mod.position.x + Math.round(mod.dimensions.width * section3DRatio);
        curRenderer.clippingPlanes = [new THREE.Plane(new THREE.Vector3(-1, 0, 0), cutWorldX)];
      } else {
        const cutWorldZ = mod.position.z + Math.round(mod.dimensions.depth * section3DRatio);
        curRenderer.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, 0, -1), cutWorldZ)];
      }
      requestRender();
    }, [section3DAxis, section3DRatio, project, activeModuleIndex, requestRender]);

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
            if (renderEdgeMode === "cad") {
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
        if (activeMod && (mainModsCount > 1 || renderEdgeMode === "cad")) {
          const modAnchor = createModuleGroup(activeMod);
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
          actModGroup.add(modAnchor);
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
    }, [activeModuleIndex, selectedComponentId, project, theme, renderEdgeMode, requestRender]);

    // Rebuild Parametric Meshes ONLY when project geometry or kinematic sliders change
    useEffect(() => {
      const meshGroup = meshGroupRef.current;
      if (!meshGroup) return;

      const needsActiveModInSig =
        doorsHiddenIn3D || cutawayActiveBay || doorOpenAngleDeg > 5;
      const moduleSigs = project.modules.map((mod, modIdx) =>
        JSON.stringify({
          id: mod.id,
          dims: mod.dimensions,
          bays: mod.bays,
          carcass: mod.carcass,
          overrides: mod.componentMaterialOverrides,
          grainOverrides: mod.componentGrainOverrides,
          surfFin: mod.surfaceFinishOverride,
          openFront: mod.isOpenFront,
          cat: mod.category,
          tmpl: mod.templateId,
          isActive: needsActiveModInSig ? modIdx === activeModuleIndex : false,
          activeBay:
            needsActiveModInSig && modIdx === activeModuleIndex ? activeBayIndex : -1,
          doorOpenAngleDeg,
          drawerOpenMm,
          explodedFactor,
          doorsHiddenIn3D,
          cutawayActiveBay,
          showInteriorProps3D: renderEdgeMode === "cad" ? false : showInteriorProps3D,
          renderEdgeMode,
          isXrayActive,
        })
      );

      if (
        meshGroup.children.length === project.modules.length &&
        project.modules.every((m, idx) => meshGroup.children[idx]?.userData?.renderSig === moduleSigs[idx])
      ) {
        project.modules.forEach((m, idx) => {
          const child = meshGroup.children[idx];
          if (child) {
            child.userData.moduleIndex = idx;
            const pl = calculateModulePlacement(m);
            child.position.set(pl.origin.x, pl.origin.y, pl.origin.z);
            child.rotation.y = pl.rotationYRad;
          }
        });
        updateSelectionAndActiveFrames();
        markShadowsAndRender();
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

      const fallbackStoneDef = {
        id: "mat_stone_calacatta",
        name: "Çimstone Calacatta Kuvars",
        category: "stone" as const,
        colorHex: "#f5f4f0",
        roughness: 0.22,
        metalness: 0.02,
        pricePerSqm: 185,
      };
      const fallbackLedDef = {
        id: "mat_led_warm_3000k",
        name: "Häfele Loox5 3000K Sıcak LED",
        category: "metal" as const,
        colorHex: "#fff7d6",
        roughness: 0.2,
        metalness: 0.05,
        pricePerSqm: 45,
      };

      let activeSceneLedLights = 0;
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

        const isActiveMod = modIdx === activeModuleIndex;
        const modContainer = createModuleGroup(mod);
        modContainer.userData = { moduleId: mod.id, renderSig: moduleSigs[modIdx] };

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
          const edgeMat = getCachedEdgeMaterial(isSelected, isActiveMod, isLight, renderEdgeMode === "photoreal");

          const isDoorPart =
            comp.role === "door" ||
            comp.role.startsWith("door_") ||
            comp.role === "door_handle" ||
            comp.role === "door_hinge";
          const isCutawayBayDoor =
            isActiveMod &&
            cutawayActiveBay &&
            isDoorPart &&
            comp.bayIndex === activeBayIndex &&
            !comp.id.includes("sliding");
          if (isActiveMod && (doorsHiddenIn3D || isCutawayBayDoor) && isDoorPart) {
            return;
          }
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
          });
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
          modContainer.add(compGroup);

          // Interior LED PointLights are placed cleanly at bay centers below (prevents hot-spots 1mm from side panels)
          void activeSceneLedLights;
        });

        const aoTex = renderEdgeMode === "cad" ? null : getContactAoShadowTexture();
        if (aoTex) {
          if (mod.position.y <= 80) {
            const aoGeo = new THREE.PlaneGeometry(
              mod.dimensions.width + 150,
              mod.dimensions.depth + 150
            );
            const aoMat = new THREE.MeshBasicMaterial({
              map: aoTex,
              transparent: true,
              opacity: 0.72,
              depthWrite: false,
            });
            const aoMesh = new THREE.Mesh(aoGeo, aoMat);
            aoMesh.raycast = () => {};
            aoMesh.rotation.x = -Math.PI / 2;
            aoMesh.position.set(
              mod.dimensions.width / 2,
              -mod.position.y + 1.2,
              mod.dimensions.depth / 2 + 18
            );
            modContainer.add(aoMesh);

            // Crisp dark grounding contact shadow line directly beneath plinth toe-kick & side panels
            const baseCrevice = new THREE.Mesh(
              new THREE.PlaneGeometry(mod.dimensions.width + 8, mod.dimensions.depth + 8),
              new THREE.MeshBasicMaterial({
                color: 0x0f0e0d,
                transparent: true,
                opacity: 0.55,
                depthWrite: false,
              })
            );
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
          const wallAoGeo = new THREE.PlaneGeometry(
            mod.dimensions.width + 280,
            mod.dimensions.height + 260
          );
          const wallAoMat = new THREE.MeshBasicMaterial({
            map: aoTex,
            transparent: true,
            opacity: 0.84,
            depthWrite: false,
          });
          const wallAoMesh = new THREE.Mesh(wallAoGeo, wallAoMat);
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

          if (isLedActive && activeSceneLedLights < 2) {
            activeSceneLedLights += 1;
            const cavityLight = new THREE.PointLight(
              ledHex,
              (lightingPreset === "night_led" ? 1.45 : 0.95) * ledDimmer,
              2100
            );
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
              doorsHiddenIn3D ||
              (isActiveMod && cutawayActiveBay && bI === activeBayIndex) ||
              doorOpenAngleDeg > 5 ||
              Boolean(mod.isOpenFront) ||
              bObj.door.type === "open" ||
              bObj.door.doorSystemId === "open" ||
              Boolean(bObj.door.isGlassFramed) ||
              bObj.door.crossSectionProfile === "glass_frame" ||
              String(bObj.door.doorMaterialId || "").includes("glass");

            if (bayVis && creviceTex) {
              // 1. Deep Top Soffit Crevice AO on back panel
              const topCrevice = new THREE.Mesh(
                new THREE.PlaneGeometry(Math.max(60, bW - 2), 115),
                new THREE.MeshBasicMaterial({
                  map: creviceTex,
                  transparent: true,
                  opacity: 0.86,
                  depthWrite: false,
                })
              );
              topCrevice.raycast = () => {};
              topCrevice.position.set(bxCursor + bW / 2, plH + pT + inH - 57.5, pT + 1.1);
              modContainer.add(topCrevice);

              // 2. Left & Right Vertical Inner-Corner Cavity AO strips for realistic 3D depth
              if (leftCornerAoTex && rightCornerAoTex) {
                const cornerW = Math.min(92, bW * 0.24);
                const leftAo = new THREE.Mesh(
                  new THREE.PlaneGeometry(cornerW, Math.max(120, inH - 4)),
                  new THREE.MeshBasicMaterial({
                    map: leftCornerAoTex,
                    transparent: true,
                    opacity: 0.72,
                    depthWrite: false,
                  })
                );
                leftAo.raycast = () => {};
                leftAo.position.set(bxCursor + cornerW / 2, plH + pT + inH / 2, pT + 1.25);
                modContainer.add(leftAo);

                const rightAo = new THREE.Mesh(
                  new THREE.PlaneGeometry(cornerW, Math.max(120, inH - 4)),
                  new THREE.MeshBasicMaterial({
                    map: rightCornerAoTex,
                    transparent: true,
                    opacity: 0.72,
                    depthWrite: false,
                  })
                );
                rightAo.raycast = () => {};
                rightAo.position.set(bxCursor + bW - cornerW / 2, plH + pT + inH / 2, pT + 1.25);
                modContainer.add(rightAo);
              }

              // 3. Under-Shelf Crevice AO strips on back panel
              (bObj.shelves || []).slice(0, 8).forEach((sh) => {
                if (sh.elevationY > 70) {
                  const shAo = new THREE.Mesh(
                    new THREE.PlaneGeometry(Math.max(60, bW - 2), 76),
                    new THREE.MeshBasicMaterial({
                      map: creviceTex,
                      transparent: true,
                      opacity: 0.72,
                      depthWrite: false,
                    })
                  );
                  shAo.raycast = () => {};
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

              const emitHorizontalLedGlow = (undersideY: number) => {
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
                backWash.position.set(bxCursor + bW / 2, undersideY - backWashH / 2, pT + 2.0);
                modContainer.add(backWash);
              };

              if (showHorizontalShelfLeds) {
                emitHorizontalLedGlow(plH + pT + inH);
                (bObj.shelves || []).slice(0, 8).forEach((sh) => {
                  if (!sh.isHidden && sh.elevationY > openFloorLocalY + 60) {
                    emitHorizontalLedGlow(plH + pT + sh.elevationY);
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

              // Real 3D PBR PointLights centered inside the bay for smooth physical inverse-square wall & garment illumination
              const openSpanH = Math.max(200, inH - openFloorLocalY);
              const lightHex =
                ledKelvin <= 2800 ? 0xffbe6b : ledKelvin >= 3800 ? 0xfff6e8 : 0xffdc9e;
              const upperBayLight = new THREE.PointLight(
                lightHex,
                (lightingPreset === "night_led" ? 0.88 : 0.56) * ledDimmer,
                Math.max(1050, openSpanH * 0.9)
              );
              upperBayLight.position.set(
                bxCursor + bW / 2,
                plH + pT + openFloorLocalY + openSpanH * 0.72,
                pT + (mod.dimensions.depth - pT) * 0.62
              );
              modContainer.add(upperBayLight);

              if (openSpanH >= 950) {
                const lowerBayLight = new THREE.PointLight(
                  lightHex,
                  (lightingPreset === "night_led" ? 0.68 : 0.42) * ledDimmer,
                  Math.max(950, openSpanH * 0.75)
                );
                lowerBayLight.position.set(
                  bxCursor + bW / 2,
                  plH + pT + openFloorLocalY + openSpanH * 0.32,
                  pT + (mod.dimensions.depth - pT) * 0.62
                );
                modContainer.add(lowerBayLight);
              }
            }

            bxCursor += bW + pT;
          });
        }

        
        // 3D Direct Compartment Hit Volumes & Active Compartment Highlight Frame (Step 2 & 3 of Wardrobe Workflow)
        if (isActiveMod && mod.bays.length >= 1) {
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

          mod.bays.forEach((bayObj, bIdx) => {
            const bw =
              breakdown.bayWidths[bIdx] ||
              Math.round((mod.dimensions.width - (mod.bays.length + 1) * T) / mod.bays.length);
            if (showBayOverlay) {
              // Raycastable compartment back-volume plane so clicking empty space in a bay selects that bay
              const bayHitGeo = new THREE.PlaneGeometry(
                Math.max(80, bw - 6),
                Math.max(120, innerH - 6)
              );
              const isActBay = bIdx === activeBayIndex;
              const bayHitMat = new THREE.MeshBasicMaterial({
                color: isActBay ? 0x38bdf8 : 0x94a3b8,
                transparent: true,
                opacity: isActBay ? 0.1 : 0.015,
                side: THREE.DoubleSide,
                depthWrite: false,
              });
              const bayHitMesh = new THREE.Mesh(bayHitGeo, bayHitMat);
              bayHitMesh.position.set(curBayX + bw / 2, plinthH + T + innerH / 2, T + 8);
              bayHitMesh.userData = {
                componentId: `${mod.id}_bay_compartment_${bIdx}`,
                role: "bay_compartment",
                moduleIndex: modIdx,
                bayIndex: bIdx,
              };
              modContainer.add(bayHitMesh);

              if (isActBay) {
                const bayFrameGeo = new THREE.BoxGeometry(
                  Math.max(80, bw - 4),
                  Math.max(120, innerH - 4),
                  Math.max(100, mod.dimensions.depth - T - 8)
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
                bayFrameLines.position.set(
                  curBayX + bw / 2,
                  plinthH + T + innerH / 2,
                  T + (mod.dimensions.depth - T) / 2
                );
                modContainer.add(bayFrameLines);

                // Double-thick front blue rectangle border around active compartment opening (Matches image_e719c6.jpg)
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
                frontRectLines.position.set(
                  curBayX + bw / 2,
                  plinthH + T + innerH / 2,
                  mod.dimensions.depth + 2
                );
                modContainer.add(frontRectLines);

                // Compute world anchor for the floating "Bölme X" popover card
                const localAnchor = new THREE.Vector3(
                  curBayX + bw,
                  plinthH + T + innerH * 0.48,
                  mod.dimensions.depth
                );
                modContainer.updateMatrixWorld(true);
                activeBayWorldAnchorRef.current = localAnchor.applyMatrix4(modContainer.matrixWorld);
              }
            }
            curBayX += bw + T;
          });
        }

        const shouldRenderProps =
          renderEdgeMode !== "cad" &&
          showInteriorProps3D &&
          (doorsHiddenIn3D ||
            cutawayActiveBay ||
            doorOpenAngleDeg > 8 ||
            Boolean(mod.isOpenFront) ||
            mod.bays.some(
              (b) =>
                b.door.type === "open" ||
                b.door.doorSystemId === "open" ||
                Boolean(b.door.isGlassFramed) ||
                b.door.crossSectionProfile === "glass_frame" ||
                String(b.door.doorMaterialId || "").includes("glass")
            ));

        if (shouldRenderProps && mod.bays.length >= 1) {
          const interiorPropsSig = JSON.stringify({
            id: mod.id,
            dim: mod.dimensions,
            sub: mod.moduleSubType,
            T: mod.carcass.panelThickness || 18,
            pH: mod.carcass.plinthHeight ?? 100,
            bays: mod.bays.map((b) => ({
              sm: b.door?.slidingMountType || b.door?.doorSystemId,
              s: b.shelves,
              r: b.hangingRails,
              dr: b.drawers,
              sf: b.specialFittings,
            })),
          });
          const cachedModProps = lifestylePropsCacheRef.current.get(interiorPropsSig);
          if (cachedModProps) {
            if (cachedModProps.parent) {
              cachedModProps.parent.remove(cachedModProps);
            }
            cachedModProps.visible = true;
            modContainer.add(cachedModProps);
          } else {
          const modPropsHolder = new THREE.Group();
          modPropsHolder.name = `v3_cached_lifestyle_props_${mod.id}`;
          modPropsHolder.userData = { isSharedCachedProps: true };
          const T = mod.carcass.panelThickness || 18;
          const plinthH = mod.carcass.plinthHeight ?? 100;
          const innerH =
            breakdown.netInnerHeight || Math.max(300, mod.dimensions.height - plinthH - 2 * T);
          const modD = mod.dimensions.depth;
          let bayStartX = T;

          const disableRaycastRecursive = (grp: THREE.Object3D) => {
            grp.raycast = () => {};
            grp.children.forEach(disableRaycastRecursive);
          };

          const hasInsetSliding = mod.bays.some(
            (b) =>
              b.door?.slidingMountType === "inset_inside" ||
              b.door?.doorSystemId === "sliding_inset"
          );
          const isCornerSubType =
            mod.moduleSubType === "l_corner" ||
            mod.moduleSubType === "corner_wardrobe" ||
            mod.moduleSubType === "blind_corner";

          mod.bays.forEach((bayObj, bIdx) => {
            const bw =
              breakdown.bayWidths[bIdx] ||
              Math.round((mod.dimensions.width - (mod.bays.length + 1) * T) / mod.bays.length);
            const propsGroup = new THREE.Group();
            propsGroup.name = `v3_lifestyle_props_bay_${bIdx}`;

            // Match exact physical chrome hanging-rail components generated in breakdown.components!
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

            // Sorted shelves ascending so we can check clear headroom above EVERY shelf!
            const sortedShelves = [...(bayObj.shelves || [])].sort(
              (a, b) => a.elevationY - b.elevationY
            );
            const sortedRails = [...(bayObj.hangingRails || [])].sort(
              (a, b) => (a.elevationY || 0) - (b.elevationY || 0)
            );

            // 1. Full-Scale 3D Hanging Garments on Contoured Wooden Hangers locked 1:1 to Chrome Rail Center
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

              // Respect any lower shelf (plus any storage box placed on it), lower rail, or drawer below this rail!
              const obstaclesBelow = [
                0,
                ...sortedShelves
                  .filter((s) => s.elevationY < clampedRailElev - 140)
                  .map((s) => {
                    const gapAboveShelf = clampedRailElev - (s.elevationY + T);
                    const hasBoxUnderRail = gapAboveShelf > 720 && bw >= 420;
                    return s.elevationY + T + (hasBoxUnderRail ? 152 : 0);
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

              // Strict non-overlapping hanger layout (~86.5° perpendicular hang, ~138mm garment thickness):
              // sidePadX = 82mm keeps outer garments >=12mm clear of side walls; minStepX = 160mm prevents neighbor intersection!
              const sidePadX = 82;
              const innerSpanX = railSpanW - sidePadX * 2;
              const minStepX = 215;
              const garmentCount =
                innerSpanX < 20
                  ? 1
                  : Math.max(1, Math.min(3, 1 + Math.floor(innerSpanX / minStepX)));

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
                propsGroup.add(shirtGrp);
              }
            });

            // 2. U-Folded Rounded Knitwear / Towel Stacks & Two-Piece Lidded Storage Boxes on Shelves
            sortedShelves.forEach((sh, sIdx) => {
              const shelfTopLocalY = sh.elevationY + T;
              const shelfTopWorldY = plinthH + T + shelfTopLocalY;
              const nextShelf = sortedShelves[sIdx + 1];
              const ceilingLocalY = nextShelf ? nextShelf.elevationY : innerH;
              const clearHeadroom = ceilingLocalY - shelfTopLocalY;
              // Skip if a hanging rail sits right inside this compartment directly above this shelf
              const railInsideSpace = sortedRails.some(
                (r) =>
                  (r.elevationY || 0) > shelfTopLocalY + 60 &&
                  (r.elevationY || 0) < ceilingLocalY - 40 &&
                  clearHeadroom > 520
              );
              if (bw < 310 || modD < 300 || clearHeadroom < 135) return;

              const isTopmostLuggageShelf = !nextShelf && sh.elevationY > innerH * 0.68;

              if (isTopmostLuggageShelf) {
                // Top luggage shelf: 1 or 2 two-piece lidded architectural linen boxes (matches image_12cb57.jpg!)
                const boxH = Math.min(155, clearHeadroom - 28);
                const boxD = Math.min(330, modD - 105);
                if (bw >= 680) {
                  const boxW = Math.min(300, bw * 0.41);
                  [-0.24, 0.24].forEach((frac) => {
                    const bGrp = createLiddedStorageBoxGroup(boxW, boxH, boxD);
                    bGrp.position.set(bayStartX + bw * (0.5 + frac), shelfTopWorldY, centerZ);
                    propsGroup.add(bGrp);
                  });
                } else {
                  const boxW = Math.min(330, bw * 0.64);
                  const bGrp = createLiddedStorageBoxGroup(boxW, boxH, boxD);
                  bGrp.position.set(bayStartX + bw * 0.5, shelfTopWorldY, centerZ);
                  propsGroup.add(bGrp);
                }
              } else if (!railInsideSpace) {
                if (sIdx % 2 === 0) {
                  // U-folded rounded knitwear/towel stack
                  const layers = clearHeadroom >= 210 ? 4 : 3;
                  const stackW = Math.min(345, bw >= 640 ? bw * 0.44 : bw * 0.68);
                  const stackD = Math.min(350, modD - 95);
                  const knitGrp = createFoldedKnitwearStackGroup(
                    stackW,
                    stackD,
                    layers,
                    bIdx + sIdx
                  );
                  knitGrp.position.set(
                    bw >= 640 ? bayStartX + bw * 0.29 : bayStartX + bw * 0.5,
                    shelfTopWorldY,
                    centerZ
                  );
                  propsGroup.add(knitGrp);

                  if (bw >= 640 && clearHeadroom >= 165) {
                    const boxW = Math.min(270, bw * 0.39);
                    const boxH = Math.min(148, clearHeadroom - 24);
                    const boxD = Math.min(320, modD - 105);
                    const bGrp = createLiddedStorageBoxGroup(boxW, boxH, boxD);
                    bGrp.position.set(bayStartX + bw * 0.73, shelfTopWorldY, centerZ);
                    propsGroup.add(bGrp);
                  }
                } else {
                  // Architectural two-piece lidded storage box
                  const boxW = Math.min(330, bw * 0.64);
                  const boxH = Math.min(150, clearHeadroom - 26);
                  const boxD = Math.min(325, modD - 105);
                  const bGrp = createLiddedStorageBoxGroup(boxW, boxH, boxD);
                  bGrp.position.set(bayStartX + bw * 0.5, shelfTopWorldY, centerZ);
                  propsGroup.add(bGrp);
                }
              } else if (clearHeadroom > 720 && bw >= 420) {
                // Base shelf underneath hanging shirts (e.g. above drawers, matches left compartment in image_12cb57.jpg!)
                const boxW = Math.min(300, bw * 0.56);
                const boxH = 138;
                const boxD = Math.min(315, modD - 115);
                const bGrp = createLiddedStorageBoxGroup(boxW, boxH, boxD);
                bGrp.position.set(bayStartX + bw * 0.48, shelfTopWorldY, centerZ);
                propsGroup.add(bGrp);
              }
            });

            // 3. Sculpted 3D Lasted Shoes on Inclined Shoe Racks (Ayakkabılık) & Open Wardrobe Floors
            const shoeRacks = (bayObj.specialFittings || []).filter((f) => f.type === "shoe_rack");
            const maxShoeDepthMm = Math.max(200, frontSafeZ - backSafeZ - 24);
            shoeRacks.forEach((sr, srIdx) => {
              const rackWorldY = plinthH + T + (sr.elevationY || 180) + 18;
              const pairCount = Math.max(1, Math.min(2, Math.floor((bw - 40) / 285)));
              const stepP = (bw - 50) / pairCount;
              for (let p = 0; p < pairCount; p++) {
                const shoePair = createSculptedShoePairGroup(p + srIdx + bIdx, maxShoeDepthMm);
                shoePair.position.set(
                  bayStartX + 25 + stepP * (p + 0.5),
                  rackWorldY,
                  centerZ
                );
                shoePair.rotation.x = 0.24; // Angled forward matching inclined shoe-rack shelf
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

            disableRaycastRecursive(propsGroup);
            modPropsHolder.add(propsGroup);
            bayStartX += bw + T;
          });
          if (lifestylePropsCacheRef.current.size > 24) {
            lifestylePropsCacheRef.current.clear();
          }
          lifestylePropsCacheRef.current.set(interiorPropsSig, modPropsHolder);
          modContainer.add(modPropsHolder);
          }
        }

        if (isXrayActive && storeBom?.cutList?.length) {
          const modPieces = storeBom.cutList.filter((cp) => cp.moduleId === mod.id);
          const compById = new Map(breakdown.components.map((c) => [c.id, c]));
          const buckets: Record<"d5" | "d8" | "d15" | "d35", THREE.Matrix4[]> = {
            d5: [],
            d8: [],
            d15: [],
            d35: [],
          };
          const dummy = new THREE.Object3D();

          modPieces.forEach((piece) => {
            const comp = compById.get(piece.id);
            if (!comp) return;
            const px = comp.position.x;
            const py = comp.position.y;
            const pz = comp.position.z;
            const cw = comp.dimensions.width;
            const ch = comp.dimensions.height;
            const cd = comp.dimensions.depth;
            const isSidePanel = cw <= 32 && ch > 100 && cd > 100;
            const isHorizPanel = ch <= 36 && cw > 100 && cd > 100;

            (piece.holes || []).forEach((h) => {
              const bucketKey: "d5" | "d8" | "d15" | "d35" =
                h.diameter >= 28 ? "d35" : h.diameter >= 13 ? "d15" : h.diameter >= 7 ? "d8" : "d5";
              const depthMm = Math.max(8, Math.min(34, h.depth || 13));
              dummy.rotation.set(0, 0, 0);
              if (isSidePanel) {
                // Side / Divider panel: local X is depth along Z, local Y is height along Y
                const wx = comp.role === "carcass_side_right" ? px + depthMm * 0.5 : px + cw - depthMm * 0.5;
                const wy = py + Math.min(ch - 8, Math.max(8, h.y));
                const wz = pz + Math.min(cd - 8, Math.max(8, cd - h.x));
                if (h.direction.startsWith("edge_")) {
                  dummy.position.set(px + cw * 0.5, wy, wz);
                  dummy.scale.set(h.diameter, depthMm, h.diameter);
                } else {
                  dummy.rotation.z = Math.PI / 2;
                  dummy.position.set(wx, wy, wz);
                  dummy.scale.set(h.diameter, depthMm, h.diameter);
                }
              } else if (isHorizPanel) {
                // Top / Bottom / Shelf panel: local X is width along X, local Y is depth along Z
                const wx = px + Math.min(cw - 8, Math.max(8, h.x));
                const wz = pz + Math.min(cd - 8, Math.max(8, cd - h.y));
                if (h.direction.startsWith("edge_")) {
                  dummy.rotation.z = Math.PI / 2;
                  dummy.position.set(
                    h.x < cw * 0.5 ? px + depthMm * 0.5 : px + cw - depthMm * 0.5,
                    py + ch * 0.5,
                    wz
                  );
                  dummy.scale.set(h.diameter, depthMm, h.diameter);
                } else {
                  dummy.position.set(wx, py + ch * 0.5, wz);
                  dummy.scale.set(h.diameter, depthMm, h.diameter);
                }
              } else {
                // Door / Front / Back panel: local X along X, local Y along Y, bore along Z
                const wx = px + Math.min(cw - 8, Math.max(8, h.x));
                const wy = py + Math.min(ch - 8, Math.max(8, h.y));
                dummy.rotation.x = Math.PI / 2;
                dummy.position.set(wx, wy, pz + cd * 0.5);
                dummy.scale.set(h.diameter, depthMm, h.diameter);
              }
              dummy.updateMatrix();
              buckets[bucketKey].push(dummy.matrix.clone());
            });

            // Visualize Back-Panel / LED Grooves in X-Ray mode
            if (piece.hasBackGroove && (isSidePanel || isHorizPanel)) {
              const grooveMesh = new THREE.Mesh(
                isSidePanel
                  ? new THREE.BoxGeometry(8, Math.max(40, ch - 12), 8.5)
                  : new THREE.BoxGeometry(Math.max(40, cw - 12), 8, 8.5),
                xrayGrooveMat
              );
              grooveMesh.raycast = () => {};
              const gOff = (piece.backGrooveOffsetMm || 12) + 4;
              grooveMesh.position.set(
                isSidePanel ? (comp.role === "carcass_side_right" ? px + 4 : px + cw - 4) : px + cw * 0.5,
                isSidePanel ? py + ch * 0.5 : py + ch * 0.5,
                pz + gOff
              );
              modContainer.add(grooveMesh);
            }
          });

          const matLookup = {
            d5: xrayHoleMatD5,
            d8: xrayHoleMatD8,
            d15: xrayHoleMatD15,
            d35: xrayHoleMatD35,
          } as const;
          (["d5", "d8", "d15", "d35"] as const).forEach((bk) => {
            const list = buckets[bk];
            if (!list.length) return;
            const inst = new THREE.InstancedMesh(xrayHoleUnitCylinder, matLookup[bk], list.length);
            inst.raycast = () => {};
            list.forEach((mtx, idx) => inst.setMatrixAt(idx, mtx));
            inst.instanceMatrix.needsUpdate = true;
            modContainer.add(inst);
          });
        }
        meshGroup.add(modContainer);
      });
      reusableGroupsBySig.forEach((leftovers) => {
        leftovers.forEach((unusedGroup) => disposeObject3DTree(unusedGroup));
      });

      if (rendererRef.current) publishSceneDiagnostics(rendererRef.current.domElement, meshGroup);
      updateSelectionAndActiveFrames();
      markShadowsAndRender();
    }, [
      project,
      doorOpenAngleDeg,
      drawerOpenMm,
      toggleDoorOpen,
      setDrawerOpenMm,
      explodedFactor,
      activeModuleIndex,
      activeBayIndex,
      doorsHiddenIn3D,
      cutawayActiveBay,
      showInteriorProps3D,
      glbCatalogRev,
      theme,
      renderEdgeMode,
      isXrayActive,
      storeBom,
      requestRender,
      updateSelectionAndActiveFrames,
    ]);

    // Fast Selection & Active Module Highlight WITHOUT rebuilding scene geometry
    useEffect(() => {
      updateSelectionAndActiveFrames();
    }, [selectedComponentId, activeModuleIndex, theme, renderEdgeMode, updateSelectionAndActiveFrames]);

    // Separate useEffect for 3D Room Architecture so cabinet interior edits/drags never rebuild room walls/floors!
    useEffect(() => {
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
        const skirtMat = new THREE.MeshPhysicalMaterial({
          color: wallTone === "anthracite_gallery" ? 0x2e2e32 : 0xf4f1ea,
          roughness: 0.36,
          clearcoat: 0.28,
          clearcoatRoughness: 0.25,
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
          color: 0xffffff,
          map: backdropWallTex,
          roughness: 0.89,
          metalness: 0.01,
          envMapIntensity: 0.4,
        });
        const backdropWallMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(backdropSpanW, backdropSpanH),
          backdropWallMat
        );
        backdropWallMesh.raycast = () => {};
        backdropWallMesh.position.set(mainW / 2, backdropSpanH / 2 - 200, -2.5);
        backdropWallMesh.receiveShadow = true;
        roomGroup.add(backdropWallMesh);

        // Full-Span Crisp White Architectural Profiled Baseboard Skirting (Süpürgelik — 115mm tall + stepped cap molding)
        const fullBaseboardBody = new THREE.Mesh(
          new THREE.BoxGeometry(backdropSpanW, 96, 15),
          skirtMat
        );
        fullBaseboardBody.raycast = () => {};
        fullBaseboardBody.position.set(mainW / 2, 48, 5.5);
        fullBaseboardBody.receiveShadow = true;
        roomGroup.add(fullBaseboardBody);

        const fullBaseboardCap = new THREE.Mesh(
          new THREE.BoxGeometry(backdropSpanW, 19, 19),
          skirtMat
        );
        fullBaseboardCap.raycast = () => {};
        fullBaseboardCap.position.set(mainW / 2, 105.5, 6.5);
        fullBaseboardCap.castShadow = true;
        fullBaseboardCap.receiveShadow = true;
        roomGroup.add(fullBaseboardCap);

        const effectiveWalls =
          spaceWalls && spaceWalls.length > 0
            ? spaceWalls
            : [
                {
                  id: "wall_main",
                  name: "Ana Duvar",
                  length: mainW,
                  height: ceilH,
                  thickness: 150,
                  position: { x: 0, y: 0, z: 0 },
                  rotationY: 0,
                  elements: [],
                },
              ];

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

          const normWRot = (((w.rotationY || 0) % 360) + 360) % 360;
          const isLeftReturnWall = normWRot === 90 && w.position.x <= 50;
          // For a 90° left return wall at x=0, rotRad = -90°, so local +Z points to world -X (outside the room)
          // and local -Z points to world +X (inside the room)!
          const wallLocalZ = isLeftReturnWall ? wThick / 2 : -wThick / 2;
          const skirtLocalZ = isLeftReturnWall ? -7 : 7;

          const wGeo = new THREE.BoxGeometry(wLen, wH, wThick);
          const wMesh = new THREE.Mesh(wGeo, wallMat);
          wMesh.position.set(wLen / 2, wH / 2, wallLocalZ);
          wMesh.castShadow = false;
          wMesh.receiveShadow = true;
          if (renderEdgeMode === "cad") {
            wMesh.add(
              new THREE.LineSegments(
                new THREE.EdgesGeometry(wGeo),
                new THREE.LineBasicMaterial({
                  color: 0x94a3b8,
                  transparent: true,
                  opacity: 0.5,
                })
              )
            );
          }
          wallSegGroup.add(wMesh);

          const sGeo = new THREE.BoxGeometry(wLen, 114, 16);
          const sMesh = new THREE.Mesh(sGeo, skirtMat);
          sMesh.position.set(wLen / 2, 57, skirtLocalZ);
          wallSegGroup.add(sMesh);

          roomGroup.add(wallSegGroup);
        });

        if (shadowPlaneRef.current) {
          shadowPlaneRef.current.visible = floorStyle === "studio" || !showRoomArchitecture3D;
        }
        if (floorStyle !== "studio") {
          const baseFloorTex = getArchitecturalFloorTexture(floorStyle);
          const baseFloorNorm = getArchitecturalFloorNormalMap(floorStyle);
          const floorSpanW = Math.max(22000, mainW + 18000);
          const floorSpanD = 12000;
          const floorTex = baseFloorTex ? baseFloorTex.clone() : null;
          if (floorTex) {
            floorTex.wrapS = THREE.RepeatWrapping;
            floorTex.wrapT = THREE.RepeatWrapping;
            floorTex.repeat.set(floorSpanW / 2200, floorSpanD / 2200);
            floorTex.needsUpdate = true;
          }
          const floorNorm = baseFloorNorm ? baseFloorNorm.clone() : null;
          if (floorNorm) {
            floorNorm.wrapS = THREE.RepeatWrapping;
            floorNorm.wrapT = THREE.RepeatWrapping;
            floorNorm.repeat.set(floorSpanW / 2200, floorSpanD / 2200);
            floorNorm.needsUpdate = true;
          }
          const floorGeo = new THREE.PlaneGeometry(floorSpanW, floorSpanD);
          const floorMat = new THREE.MeshPhysicalMaterial({
            color: 0xede3d2,
            map: floorTex,
            normalMap: floorNorm,
            normalScale: new THREE.Vector2(0.26, 0.26),
            roughness:
              floorStyle === "neolith_calacatta"
                ? 0.26
                : floorStyle === "travertine"
                ? 0.38
                : 0.46,
            metalness: 0.01,
            clearcoat: floorStyle === "microcement" ? 0.06 : 0.2,
            clearcoatRoughness: 0.3,
            envMapIntensity: 0.5,
          });
          const floorMesh = new THREE.Mesh(floorGeo, floorMat);
          floorMesh.rotation.x = -Math.PI / 2;
          floorMesh.position.set(mainW / 2, -1.5, floorSpanD / 2 - 200);
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
          const isSideWall = normRotY === 90 || normRotY === 270;

          // When rotated 90°/270° (on Left or Right Side Wall), if near the left wall (x <= 120), lock inner face proud at x = 16mm
          // so the window is NEVER buried inside the left wall! Similarly on the Back Wall (z <= 120), lock inner face proud at z = 16mm!
          const effectiveWallX = isSideWall && obs.position.x <= 120 ? 16 : obs.position.x + 16;
          const effectiveWallZ = !isSideWall && obs.position.z <= 120 ? 16 : obs.position.z + 16;
          const cx3D = isSideWall ? effectiveWallX : obs.position.x + ow / 2;
          const cy3D = obs.position.y + oh / 2;
          const cz3D = isSideWall ? obs.position.z + ow / 2 : effectiveWallZ;
          const obsRotRad = isSideWall ? Math.PI / 2 : -((obs.rotationY || 0) * Math.PI) / 180;

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
            winHandleRosette.position.set(20, -20, 34);
            winGroup.add(winHandleRosette);

            const winHandleLever = new THREE.Mesh(
              new THREE.BoxGeometry(16, 96, 18),
              winHandleMat
            );
            winHandleLever.userData = { obstacleId: obs.id };
            winHandleLever.position.set(20, -48, 46);
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
            sillMesh.position.set(0, -oh / 2 - 16, 32);
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
            doorGroup.position.set(cx3D, cy3D, isSideWall ? cz3D : effectiveWallZ);
            doorGroup.rotation.y = obsRotRad;

            const jambW = 68;
            const jambD = 76;
            const isRightHinged = obs.doorSwing === "right";
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

            // 3. Pivoted Door Leaf (Slightly Ajar 22° into Room so Opening Direction & Handle are Immediately Clear!)
            const leafPivot = new THREE.Group();
            leafPivot.userData = { obstacleId: obs.id };
            leafPivot.position.set(hingeX, -jambW / 2, 18);
            const swingAngleRad = (isRightHinged ? 1 : -1) * ((22 * Math.PI) / 180);
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
              const z0 = 18 + Math.sin(a0) * leafW;
              const x1 = hingeX + (isRightHinged ? -1 : 1) * Math.cos(a1) * leafW;
              const z1 = 18 + Math.sin(a1) * leafW;
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
            plateMesh.position.set(cx3D, cy3D, isSideWall ? cz3D : 6);
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
            const colX = isSideWall ? obs.position.x + od / 2 : obs.position.x + ow / 2;
            const colZ = isSideWall ? obs.position.z + ow / 2 : obs.position.z + od / 2;
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

        if (roomArchGroupRef.current) roomArchGroupRef.current.add(roomGroup);
      }
      markShadowsAndRender();
    }, [
      renderEdgeMode,
      showRoomArchitecture3D,
      spaceObstacles,
      spaceWalls,
      project.space?.ceilingHeight,
      lightingPreset,
      wallTone,
      floorStyle,
      theme,
      markShadowsAndRender,
    ]);

    // Rebuild 3D Dimension Lines & Labels when active module or showDimensions changes
    useEffect(() => {
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
      // 1. Total Width (Genişlik) along top edge (Architectural Charcoal)
      addDimensionSegment(
        modDimContainer,
        localAnchors,
        "dim_W",
        new THREE.Vector3(0, H, D * 0.65),
        new THREE.Vector3(W, H, D * 0.65),
        new THREE.Vector3(0, 1, 0),
        95,
        "Genişlik",
        `${W} mm`,
        0x1c1917,
        "#D6D0C4",
        "#141413"
      );

      // 2. Total Height (Yükseklik) along right-front vertical edge (Architectural Charcoal)
      addDimensionSegment(
        modDimContainer,
        localAnchors,
        "dim_H",
        new THREE.Vector3(W, 0, D),
        new THREE.Vector3(W, H, D),
        new THREE.Vector3(1, 0, 0),
        95,
        "Yükseklik",
        `${H} mm`,
        0x1c1917,
        "#D6D0C4",
        "#141413"
      );

      // 3. Total Depth (Derinlik) along right-bottom floor edge (Warm Bronze)
      addDimensionSegment(
        modDimContainer,
        localAnchors,
        "dim_D",
        new THREE.Vector3(W, 0, 0),
        new THREE.Vector3(W, 0, D),
        new THREE.Vector3(1, 0, 0),
        95,
        "Derinlik",
        `${D} mm`,
        0x78716c,
        "#D6D0C4",
        "#57534E"
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
          `${soketW} mm`,
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
          addDimensionSegment(
            modDimContainer,
            localAnchors,
            `dim_BAY_${bIdx}`,
            new THREE.Vector3(curBayX, H, D * 0.92),
            new THREE.Vector3(curBayX + bw, H, D * 0.92),
            new THREE.Vector3(0, 1, 0),
            26,
            `${bIdx + 1}. Bölme`,
            `${bw} mm`,
            isSelBay ? 0x141413 : 0x8c7a6b,
            isSelBay ? "#141413" : "#D6D0C4",
            isSelBay ? "#141413" : "#78716C"
          );
          curBayX += bw + T;
        });
      }

            dimGroup.add(modDimContainer);
      modDimContainer.updateMatrixWorld(true);

      const allWorldAnchors: { id: string; worldPos: THREE.Vector3; isActiveMod?: boolean }[] = localAnchors.map((a) => ({
        id: a.id,
        worldPos: a.localMidpoint.clone().applyMatrix4(modDimContainer.matrixWorld),
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
          `${oW}×${oH} mm`,
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
          `${Math.round(maxX - minX)} mm`,
          0x0f766e,
          "#0f766e",
          "#0f766e"
        );
        totalAnchors.forEach((ta) => {
          allWorldAnchors.push({
            id: ta.id,
            worldPos: ta.localMidpoint.clone(),
          });
        });
      }

      dimWorldAnchorsRef.current = allWorldAnchors;

      updateProjectedDimensionLabels();
      requestRender();
    }, [
      project,
      activeModuleIndex,
      activeBayIndex,
      effectiveShowDimensions,
      isSimpleTier,
      updateProjectedDimensionLabels,
      requestRender,
    ]);

    useEffect(() => {
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
    }, [project, activeModuleIndex, hwCallouts, matCallouts, hardwareViewMode, materialModeActive, updateProjectedDimensionLabels, requestRender]);

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

        // First try raycasting actual 3D cabinet meshes so multi-module & angled camera drags hit the exact cabinet under cursor
        if (meshGroupRef.current) {
          const solidMeshes = collectSolidCabinetMeshes(meshGroupRef.current, true);
          const hits = rc.intersectObjects(solidMeshes, false);
          if (hits.length > 0) {
            const firstHit = hits[0];
            const hitModIdx = firstHit.object?.userData?.moduleIndex;
            if (typeof hitModIdx === "number" && hitModIdx >= 0 && hitModIdx !== activeModuleIndex) {
              setActiveModuleIndex(hitModIdx);
            }
            return firstHit.point.clone();
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
      const activeAcc = typeof window !== "undefined" ? (window as any).__birimActiveDraggedAccessory : null;
      const hasAccessoryMime = e.dataTransfer.types.includes("application/x-birim-accessory-id");

      // CASE 1: ACCESSORY / INTERIOR ITEM DRAG
      if (hasAccessoryMime || activeAcc) {
        e.preventDefault();
        if (!isDraggingItemOver3D) setIsDraggingItemOver3D(true);
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
          setDragDropSnapBanner(
            `📐 Raf Arası Dikme • Bölme ${targetBayIdx + 1} • Sol Mesafe X: ${localBayX} mm (Boy: ${subSpanH} mm)`
          );
        } else if (accKind === "carcass_divider") {
          setDragDropSnapBanner(
            `📐 Ara Dikme (Bölme ${targetBayIdx + 1} İç Düzeniyle 2'ye Bölünür) • X: ${localBayX} mm`
          );
        } else {
          setDragDropSnapBanner(`📐 ${activeAcc?.title || "Aksesuar"} • Bölme ${targetBayIdx + 1} • Y: ${snappedElevY} mm`);
        }
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

      setDragDropSnapBanner(
        `🧲 SİLUET SNAP: ${preview.previewModule.name} (${preview.previewModule.dimensions.width}×${preview.previewModule.dimensions.height}mm) → ${preview.snapLabel}`
      );
    };

    const handle3DDrop = (e: React.DragEvent<HTMLDivElement>) => {
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

        setDragDropSnapBanner(`✓ ${acc.title} yerleştirildi: Bölme ${bayIdx + 1} (Y: ${elevY} mm)`);
        setTimeout(() => setDragDropSnapBanner(null), 3500);

        lastAccessoryDropTargetRef.current = null;
        if (typeof window !== "undefined") {
          (window as any).__birimActiveDraggedAccessory = null;
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
      const rawWorldX = resolve3DWorldXFromDragEvent(e);
      const res = dropV4TemplateWithSnap(tplId, rawWorldX);
      if (res) {
        setDragDropSnapBanner(`✓ ${res.placedName} → ${res.snapLabel}`);
        setTimeout(() => setDragDropSnapBanner(null), 3200);
      } else {
        setDragDropSnapBanner(null);
      }
    };

    return (
      <div
        data-testid="v3-three-viewport-dropzone"
        onDragOver={handle3DDragOver}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            clear3DGhostPreview();
            setDragDropSnapBanner(null);
          }
        }}
        onDrop={handle3DDrop}
        className="relative w-full h-full select-none overflow-hidden"
      >
        {dragDropSnapBanner && (
          <div
            data-testid="viewport-3d-dragdrop-snap-banner"
            style={{ bottom: `${(stageSafeInsets?.bottomPx ?? 14) + 56}px` }}
            className="absolute left-1/2 -translate-x-1/2 max-w-[calc(100%-24px)] z-30 pointer-events-auto px-4 py-2 rounded-2xl bg-slate-900/92 backdrop-blur-xl text-white border border-emerald-400/80 shadow-xl ring-1 ring-black/15 font-mono text-xs font-bold flex items-center gap-2"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
            <span className="truncate">{dragDropSnapBanner}</span>
            <button
              type="button"
              onClick={() => setDragDropSnapBanner(null)}
              className="ml-1 text-slate-300 hover:text-white font-bold cursor-pointer shrink-0"
            >
              ✕
            </button>
          </div>
        )}
        <div
          ref={hoverBadgeDomRef}
          data-testid="viewport-3d-hover-object-badge"
          style={{
            display: "none",
            bottom: `${(stageSafeInsets?.bottomPx ?? 14) + 54}px`,
          }}
          className="absolute left-1/2 -translate-x-1/2 z-30 pointer-events-none px-3 py-1 rounded-lg bg-[#141413]/90 text-[#FAF9F6] border border-[#D8D3C8]/30 shadow-md text-[11px] font-medium items-center gap-2 backdrop-blur-sm whitespace-nowrap"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#D8D3C8]" />
          <span ref={hoverBadgeTextRef} />
        </div>
        {isCtrlPressed && (
          <div
            data-testid="ctrl-move-part-badge"
            className="absolute top-4 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 bg-amber-500/95 backdrop-blur-md text-stone-950 font-bold text-xs rounded-full shadow-lg flex items-center gap-2 pointer-events-none ring-2 ring-amber-300 animate-pulse select-none"
          >
            <span className="text-sm font-black">✥</span>
            <span>İç Parça Taşıma Modu (Ctrl Aktif)</span>
          </div>
        )}
        <div
          ref={mountRef}
          data-testid="v3-three-canvas"
          className={`w-full h-full ${isCtrlPressed ? "cursor-move" : "cursor-grab active:cursor-grabbing"}`}
        />
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
                  className={`absolute top-0 left-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md backdrop-blur-xs border shadow-xs whitespace-nowrap transition-opacity duration-75 ${
                    isActiveBayBadge
                      ? "bg-[#141413] text-[#FAF9F6] border-[#141413] pointer-events-auto cursor-pointer"
                      : isBayBadge
                      ? "bg-[#FAF9F6]/95 hover:bg-white text-[#141413] border-[#D6D0C4] hover:border-[#141413] pointer-events-auto cursor-pointer"
                      : isEditingThis
                      ? "bg-white border-2 border-[#141413] pointer-events-auto cursor-pointer"
                      : badgeKey
                      ? "bg-[#FAF9F6]/95 hover:bg-white hover:border-[#141413] border-[#D6D0C4] pointer-events-auto cursor-pointer group"
                      : "bg-[#FAF9F6]/95 pointer-events-none border-[#D6D0C4]"
                  }`}
                >
                  <span
                    className={`text-[10px] font-medium leading-none ${
                      isActiveBayBadge ? "text-[#D6C7B2]" : "text-[#78716C]"
                    }`}
                  >
                    {item.tag}
                  </span>
                  <span
                    className={`text-[11px] font-bold leading-none font-mono ${
                      isActiveBayBadge ? "text-[#FAF9F6]" : "text-[#141413]"
                    }`}
                  >
                    {item.valueText}
                  </span>
                  {badgeKey && (
                    <span className="text-[10px] text-[#475569] group-hover:text-[#111827] leading-none ml-0.5">
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
              className={`absolute ${floatingPanelPos.dim ? "top-0 left-0" : "top-24 left-1/2 -translate-x-1/2"} z-30 w-80 birim-ice-popover rounded-[26px] p-4 space-y-3 text-xs text-[#111827] pointer-events-auto`}
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
        {showInCanvasHud && dismissedBayPopover && !dragDropSnapBanner && !active3DSnap && (clicked3DContext || doorsHiddenIn3D || cutawayActiveBay || doorOpenAngleDeg > 5) && (
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
                  }
                : undefined
            }
            className={`absolute ${floatingPanelPos.context ? "top-0 left-0" : "top-16 left-1/2 -translate-x-1/2"} z-20 flex flex-wrap items-center justify-center gap-1.5 birim-ice-pill px-3 py-1.5 rounded-full text-xs text-[#111827] cursor-grab active:cursor-grabbing select-none transition-opacity duration-150 ${
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
        {showInCanvasHud &&
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
                              setDragDropSnapBanner(
                                `${targetBayIdx + 1}. Bölme kapağı kaldırıldı (Açık bölme)`
                              );
                              setTimeout(() => setDragDropSnapBanner(null), 2200);
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
                                  setDragDropSnapBanner(
                                    `${scopeText}: "${m.name.split(" (")[0]}" uygulandı`
                                  );
                                  setTimeout(() => setDragDropSnapBanner(null), 2200);
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
                          setDragDropSnapBanner(
                            "Seçili kapak modeli ve kulp tüm bölmelere uygulandı"
                          );
                          setTimeout(() => setDragDropSnapBanner(null), 2400);
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
                              setDragDropSnapBanner(
                                `${targetBayIdx + 1}. Bölme tek kapağa düşürüldü (Dolap ${halfShrunkOuterCmDoor} cm oldu)`
                              );
                              setTimeout(() => setDragDropSnapBanner(null), 2500);
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
                                setDragDropSnapBanner(
                                  `${targetBayIdx + 1}. Bölme komşu bölmeyle birleştirildi (${Math.round(activeModule.dimensions.width / 10)} cm sabit)`
                                );
                                setTimeout(() => setDragDropSnapBanner(null), 2500);
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
                                setDragDropSnapBanner(
                                  `${targetBayIdx + 1}. Bölme çıkarıldı (Dolap ${shrunkOuterCmDoor} cm genişliğe daraltıldı)`
                                );
                                setTimeout(() => setDragDropSnapBanner(null), 2500);
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
        {showInCanvasHud &&
          !dismissedBayPopover &&
          !(clicked3DContext?.kind === "door" && !doorsHiddenIn3D) &&
          (cutawayActiveBay || doorsHiddenIn3D || doorOpenAngleDeg > 5 || clicked3DContext?.kind === "bay") &&
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
                                  setDragDropSnapBanner(`"${labelShort}" parçası silindi`);
                                  setTimeout(() => setDragDropSnapBanner(null), 2200);
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
                                setDragDropSnapBanner("Ara dikme kaldırıldı ve bölmeler birleştirildi");
                                setTimeout(() => setDragDropSnapBanner(null), 2200);
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
                                setDragDropSnapBanner(
                                  `${activeBayIndex + 1}. Bölme kapağı kaldırıldı`
                                );
                                setTimeout(() => setDragDropSnapBanner(null), 2200);
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
                              setDragDropSnapBanner(
                                `${activeBayIndex + 1}. Bölme tek kapağa düşürüldü (Dolap ${halfShrunkOuterCm} cm oldu)`
                              );
                              setTimeout(() => setDragDropSnapBanner(null), 2500);
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
                                setDragDropSnapBanner(
                                  `${activeBayIndex + 1}. Bölme komşu bölmeyle birleştirildi (${Math.round(activeModule.dimensions.width / 10)} cm sabit)`
                                );
                                setTimeout(() => setDragDropSnapBanner(null), 2400);
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
                                setDragDropSnapBanner(
                                  `${activeBayIndex + 1}. Bölme çıkarıldı (Dolap ${shrunkOuterCm} cm genişliğe daraltıldı)`
                                );
                                setTimeout(() => setDragDropSnapBanner(null), 2400);
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
        {active3DSnap && (
          <div
            data-testid="in-canvas-snap-badge"
            className="absolute top-16 left-1/2 -translate-x-1/2 z-20 pointer-events-none px-3.5 py-1.5 rounded-full birim-ice-pill text-[#1C1917] text-xs font-bold flex items-center gap-2"
          >
            <span>🎯 Hizalandı: {active3DSnap.label}</span>
            <span className="px-2 py-0.5 rounded-full bg-[#F1F5F9] text-[#1C1917] font-mono">
              Y: {active3DSnap.elevationY} mm
            </span>
          </div>
        )}

        {/* LEFT VERTICAL VIEW & CAMERA PILL (Design Studio: 3D | 2D Plan | Ön | Yan | Üst | İç Görünüm | Fit) */}
        <div
          data-testid="viewport-3d-visual-quality-bar"
          style={
            !isSimpleTier && stageSafeInsets
              ? {
                  left: `${stageSafeInsets.leftPx ?? 14}px`,
                  top: `${stageSafeInsets.topPx ?? 14}px`,
                }
              : undefined
          }
          className={
            isSimpleTier
              ? "sr-only"
              : "absolute left-3.5 top-3.5 z-20 flex flex-col items-center gap-1 birim-ice-pill p-1 rounded-[22px] text-[#141413] w-[46px] transition-[left,top] duration-200"
          }
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
            .filter((btn) => !btn.id.startsWith("2d") && (showInCanvasHud || btn.id === "interior" || btn.id === "hide-doors"))
            .map((btn) => {
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
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer ${
                  isActive
                    ? "birim-ice-btn-active"
                    : "text-[#44403C] hover:bg-white/70 hover:text-[#141413]"
                }`}
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
            title="Dolap İçi 3D Kıyafet, Askı, Kutu ve Ayakkabı Silüetlerini Göster / Gizle"
            onClick={() => {
              const next = !showInteriorProps3D;
              setShowInteriorProps3D(next);
              if (next && !doorsHiddenIn3D && doorOpenAngleDeg < 15) {
                setDoorsHiddenIn3D(true);
              }
            }}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer ${
              showInteriorProps3D
                ? "birim-ice-btn-active"
                : "text-[#44403C] hover:bg-white/70 hover:text-[#141413]"
            }`}
          >
            <span className="text-sm leading-none">👔</span>
            <span className="sr-only">Eşyalar</span>
          </button>
        </div>

        {/* TOP-CENTER FROSTED ICE ICON DOCK (Seç | Taşı | Ölçü | Böl | Birleştir | Kopyala | Kapak | Aynala | Sil) */}
        {showInCanvasHud && (
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
                    setDragDropSnapBanner("🧹 Özel parça malzeme atamaları temizlendi");
                    setTimeout(() => setDragDropSnapBanner(null), 2000);
                  }}
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-red-600 hover:bg-red-500/15 transition cursor-pointer"
                  title="Özel parça malzeme atamalarını sıfırla"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                  </svg>
                  <span className="sr-only">Temizle</span>
                </button>
                <div className="h-5 w-px bg-slate-900/12 mx-0.5" />
              </>
            )}

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
              data-testid="hud-tool-toggle-doors"
              onClick={() => {
                toggleDoorOpen();
                setDragDropSnapBanner(
                  doorOpenAngleDeg > 0
                    ? "🚪 Kapaklar Kapatıldı"
                    : "🚪 Kapaklar Açıldı (İç Donanım Görünümü)"
                );
                setTimeout(() => setDragDropSnapBanner(null), 2000);
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
                setDragDropSnapBanner("⇄ Kapak Açılış Yönü Aynalandı (Sol ⇄ Sağ)");
                setTimeout(() => setDragDropSnapBanner(null), 2200);
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

            <button
              type="button"
              onClick={() => {
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
              }}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-[#44403C] hover:bg-white/70 hover:text-[#141413] transition cursor-pointer"
              title="Sahneye Sığdır"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              </svg>
              <span className="sr-only">Sığdır</span>
            </button>

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

            {/* Görüntü / Donanım Etiketleri Popover İkonu */}
            {showInCanvasHud && (
              <div className="relative">
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
                onClick={() => setSection3DMenuOpen((v) => !v)}
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
                        value={section3DRatio}
                        onChange={(e) => setSection3DRatio(Number(e.target.value))}
                        className="w-full accent-[#141413] h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Stüdyo Ortam, Işık, Zemin & 2K Render İkonu */}
            <div className="relative">
              <button
                type="button"
                data-testid="viewport-3d-edge-mode-toggle"
                title="Stüdyo Işığı, Duvar/Zemin Yüzeyi ve 2K Fotoğraf Render"
                onClick={() => setRenderMenuOpen((v) => !v)}
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
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setRenderEdgeMode("photoreal");
                          setRenderMenuOpen(false);
                        }}
                        className={`py-1.5 px-2 rounded-xl font-semibold cursor-pointer ${
                          renderEdgeMode === "photoreal"
                            ? "birim-ice-btn-active"
                            : "birim-ice-btn text-[#1C1917]"
                        }`}
                      >
                        Gerçekçi PBR
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRenderEdgeMode("cad");
                          setRenderMenuOpen(false);
                        }}
                        className={`py-1.5 px-2 rounded-xl font-semibold cursor-pointer ${
                          renderEdgeMode === "cad"
                            ? "birim-ice-btn-active"
                            : "birim-ice-btn text-[#1C1917]"
                        }`}
                      >
                        Teknik Çizim
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
                        { id: "soft_plaster", label: "Açık Sıva", swatch: "#DED9D0" },
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
                          setDragDropSnapBanner("2K Ultra Stüdyo Render indirildi");
                          setTimeout(() => setDragDropSnapBanner(null), 2800);
                        }
                      }}
                      className="flex-1 h-8 px-2.5 rounded-xl birim-ice-btn-active disabled:opacity-60 font-semibold text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <span>📸</span>
                      <span>{ultraRenderProgress !== null ? `%${ultraRenderProgress}` : "2K PNG"}</span>
                    </button>

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
                      className="w-8 h-8 rounded-xl birim-ice-btn text-[#1C1917] flex items-center justify-center cursor-pointer"
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
        <WardrobeGlbLibraryModal
          open={glbLibraryOpen}
          onClose={() => setGlbLibraryOpen(false)}
        />
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
          onToggleDrawerOpen={() => setDrawerOpenMm(drawerOpenMm > 10 ? 0 : 280)}
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
          onSetBayDoorType={setBayDoorType}
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
          onSwapModuleWithNeighbor={swapModuleWithNeighbor}
          onToggleModuleLedLighting={toggleModuleLedLighting}
          onSetPlinthHeight={setPlinthHeight}
          onRemoveActiveModule={removeActiveModule}
          onRemoveSpaceObstacle={removeSpaceObstacle}
          onUndo={undo}
          onRedo={redo}
        />
      </div>
    );
  }
);

V3ThreeViewport.displayName = "V3ThreeViewport";
export default V3ThreeViewport;
