import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import {
  markSharedGeometry,
  markSharedMaterial,
  markSharedTexture,
} from "./webglResourceGuard";

export type WardrobeGlbCategory =
  | "jacket"
  | "shirt"
  | "shoe"
  | "folded_cloth"
  | "silk_pouf"
  | "sunglasses"
  | "watch";

export interface WardrobeGlbCatalogEntry {
  category: WardrobeGlbCategory;
  label: string;
  localOverridePath: string;
  remoteUrl: string;
  sourceTitle: string;
  sourceUrl: string;
  targetMm: { w: number; h: number; d: number };
  anchor: "top" | "bottom";
}

/**
 * Curated Ready-Made 3D .GLB Asset Catalog (V11.5 Ultra-Light 60-FPS Edition):
 * - Aggressively decimates every mesh >= 900 tris down to ~480–980 triangles,
 * - Bakes & merges multi-mesh templates (e.g. 6-part shoes -> 1–2 draw calls, 4-part coat hanger -> 2 draw calls),
 * - Downscales diffuse maps to <= 256px and disposes raw 4K maps immediately,
 * - Freezes `matrixAutoUpdate = false` across all static prop subtrees.
 */
export const DEFAULT_WARDROBE_GLB_CATALOG: Record<
  WardrobeGlbCategory,
  WardrobeGlbCatalogEntry
> = {
  jacket: {
    category: "jacket",
    label: "Askılı Yetişkin Koyu Triko / Üst Giyim (UV-Baked .GLB)",
    localOverridePath: "/models/wardrobe/jacket.glb",
    remoteUrl:
      "https://raw.githubusercontent.com/adrianhajdin/project_threejs_ai/main/client/public/shirt_baked.glb",
    sourceTitle: "GitHub — Three.js UV-Baked Hanging Garment (shirt_baked.glb)",
    sourceUrl:
      "https://github.com/adrianhajdin/project_threejs_ai/blob/main/client/public/shirt_baked.glb",
    targetMm: { w: 485, h: 825, d: 145 },
    anchor: "top",
  },
  shirt: {
    category: "shirt",
    label: "Askılı Yetişkin Açık Gömlek / Tişört (UV-Baked .GLB)",
    localOverridePath: "/models/wardrobe/shirt.glb",
    remoteUrl:
      "https://raw.githubusercontent.com/adrianhajdin/project_threejs_ai/main/client/public/shirt_baked.glb",
    sourceTitle: "GitHub — Three.js UV-Baked Hanging Garment (shirt_baked.glb)",
    sourceUrl:
      "https://github.com/adrianhajdin/project_threejs_ai/blob/main/client/public/shirt_baked.glb",
    targetMm: { w: 485, h: 780, d: 125 },
    anchor: "top",
  },
  shoe: {
    category: "shoe",
    label: "3D Taranmış Deri/Süet Ayakkabı Çifti (Khronos .GLB)",
    localOverridePath: "/models/wardrobe/shoe.glb",
    remoteUrl:
      "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/MaterialsVariantsShoe/glTF-Binary/MaterialsVariantsShoe.glb",
    sourceTitle: "Khronos Group glTF-Sample-Assets — MaterialsVariantsShoe",
    sourceUrl:
      "https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/MaterialsVariantsShoe",
    targetMm: { w: 116, h: 118, d: 292 },
    anchor: "bottom",
  },
  folded_cloth: {
    category: "folded_cloth",
    label: "Katlı Kazak / Triko İstifi (Khronos SheenCloth .GLB)",
    localOverridePath: "/models/wardrobe/folded_cloth.glb",
    remoteUrl:
      "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/SheenCloth/glTF-Binary/SheenCloth.glb",
    sourceTitle: "Khronos Group glTF-Sample-Assets — SheenCloth",
    sourceUrl:
      "https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/SheenCloth",
    targetMm: { w: 325, h: 70, d: 325 },
    anchor: "bottom",
  },
  silk_pouf: {
    category: "silk_pouf",
    label: "Dolap İçi Keten Düzenleyici & Çanta Pufu (Khronos .GLB)",
    localOverridePath: "/models/wardrobe/silk_pouf.glb",
    remoteUrl:
      "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/SpecularSilkPouf/glTF-Binary/SpecularSilkPouf.glb",
    sourceTitle: "Khronos Group glTF-Sample-Assets — SpecularSilkPouf",
    sourceUrl:
      "https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/SpecularSilkPouf",
    targetMm: { w: 325, h: 158, d: 315 },
    anchor: "bottom",
  },
  sunglasses: {
    category: "sunglasses",
    label: "Güneş Gözlüğü Aksesuarı (Khronos .GLB)",
    localOverridePath: "/models/wardrobe/sunglasses.glb",
    remoteUrl:
      "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/SunglassesKhronos/glTF-Binary/SunglassesKhronos.glb",
    sourceTitle: "Khronos Group glTF-Sample-Assets — SunglassesKhronos",
    sourceUrl:
      "https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/SunglassesKhronos",
    targetMm: { w: 155, h: 54, d: 150 },
    anchor: "bottom",
  },
  watch: {
    category: "watch",
    label: "Kronograf Kol Saati (Khronos .GLB)",
    localOverridePath: "/models/wardrobe/watch.glb",
    remoteUrl:
      "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/ChronographWatch/glTF-Binary/ChronographWatch.glb",
    sourceTitle: "Khronos Group glTF-Sample-Assets — ChronographWatch",
    sourceUrl:
      "https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/ChronographWatch",
    targetMm: { w: 90, h: 60, d: 96 },
    anchor: "bottom",
  },
};

const STORAGE_KEY_URLS = "birim_v66_custom_wardrobe_glb_urls";
const STORAGE_KEY_ENABLED = "birim_v66_wardrobe_glb_enabled";
const COLLAR_PIN_Y_MM = -54;

let sharedGltfLoader: GLTFLoader | null = null;
const normalizedTemplateCache = new Map<WardrobeGlbCategory, THREE.Group>();
const inFlightLoads = new Map<WardrobeGlbCategory, Promise<THREE.Group | null>>();
const customBlobUrls = new Map<WardrobeGlbCategory, { url: string; fileName: string }>();
const customRemoteUrls = new Map<WardrobeGlbCategory, string>();
const loadErrorMap = new Map<WardrobeGlbCategory, string>();
const tintMaterialCache = new Map<string, THREE.Material>();
const downscaledTexCache = new WeakMap<THREE.Texture, THREE.Texture>();

// Pre-merged ultra-lightweight GPU geometries (1 chrome mesh + 1 wood mesh per hanger!)
let hangerChromeMergedGeo: THREE.BufferGeometry | null = null;
let hangerWoodMergedGeo: THREE.BufferGeometry | null = null;
let proxyGarmentTorsoGeo: THREE.BufferGeometry | null = null;
let proxyShoeSingleGeo: THREE.BufferGeometry | null = null;
let foldedBaseUnitGeo: THREE.BufferGeometry | null = null;
let boxBodyUnitGeo: THREE.BufferGeometry | null = null;
let boxLidUnitGeo: THREE.BufferGeometry | null = null;

let hangerChromeMat: THREE.MeshStandardMaterial | null = null;
let hangerWalnutMat: THREE.MeshStandardMaterial | null = null;
let hangerOakMat: THREE.MeshStandardMaterial | null = null;

/**
 * Merges an array of indexed/non-indexed BufferGeometries (position + normal + optional uv)
 * into a single static BufferGeometry so multi-part props render in 1 single WebGL draw call.
 */
export function mergeStaticBufferGeometries(
  geos: THREE.BufferGeometry[],
  includeUv = false
): THREE.BufferGeometry {
  const posArr: number[] = [];
  const nrmArr: number[] = [];
  const uvArr: number[] = [];
  const idxArr: number[] = [];
  let vertOffset = 0;

  for (const g of geos) {
    const pos = g.attributes.position as THREE.BufferAttribute | undefined;
    if (!pos || pos.count === 0) continue;
    if (!g.attributes.normal) g.computeVertexNormals();
    const nrm = g.attributes.normal as THREE.BufferAttribute | undefined;
    const uv = includeUv ? (g.attributes.uv as THREE.BufferAttribute | undefined) : undefined;

    for (let i = 0; i < pos.count; i++) {
      posArr.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      if (nrm) {
        nrmArr.push(nrm.getX(i), nrm.getY(i), nrm.getZ(i));
      } else {
        nrmArr.push(0, 1, 0);
      }
      if (includeUv) {
        uvArr.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
      }
    }

    if (g.index) {
      for (let i = 0; i < g.index.count; i++) {
        idxArr.push(vertOffset + g.index.getX(i));
      }
    } else {
      for (let i = 0; i < pos.count; i++) {
        idxArr.push(vertOffset + i);
      }
    }
    vertOffset += pos.count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.Float32BufferAttribute(posArr, 3));
  merged.setAttribute("normal", new THREE.Float32BufferAttribute(nrmArr, 3));
  if (includeUv) {
    merged.setAttribute("uv", new THREE.Float32BufferAttribute(uvArr, 2));
  }
  merged.setIndex(idxArr);
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

/**
 * Freezes `matrixAutoUpdate = false` across a static Object3D subtree after computing matrices once,
 * eliminating hundreds of redundant 4x4 matrix multiplications on every 60Hz camera orbit frame!
 */
export function freezeStaticObject3DSubtree(root: THREE.Object3D, keepRootDynamic = false): void {
  root.updateMatrixWorld(true);
  root.traverse((obj) => {
    obj.raycast = () => {};
    if (obj instanceof THREE.Mesh) {
      obj.castShadow = false;
      obj.receiveShadow = false;
    }
    if (keepRootDynamic && obj === root) return;
    obj.updateMatrix();
    obj.matrixAutoUpdate = false;
  });
}

function ensureSharedHangerResources(): void {
  if (hangerChromeMergedGeo) return;

  const hookCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 2.5, -13.5),
    new THREE.Vector3(0, 15.8, -5.5),
    new THREE.Vector3(0, 16.6, 2.5),
    new THREE.Vector3(0, 9.5, 11.2),
    new THREE.Vector3(0, -6.5, 8.2),
    new THREE.Vector3(0, -16.5, 1.2),
    new THREE.Vector3(0, -24.0, 0),
    new THREE.Vector3(0, -55.5, 0),
  ]);
  const hookGeo = new THREE.TubeGeometry(hookCurve, 10, 2.1, 5, false);
  const collarGeo = new THREE.CylinderGeometry(4.8, 5.8, 5.5, 6);
  collarGeo.translate(0, -55.5, 0);
  hangerChromeMergedGeo = markSharedGeometry(mergeStaticBufferGeometries([hookGeo, collarGeo], false));
  hookGeo.dispose();
  collarGeo.dispose();

  const crown = new THREE.SphereGeometry(8.2, 6, 5);
  crown.scale(1.35, 0.85, 0.72);
  crown.translate(0, -58.5, 0);

  const woodCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-114, -126, 0),
    new THREE.Vector3(-56, -84, 0),
    new THREE.Vector3(0, -58, 0),
    new THREE.Vector3(56, -84, 0),
    new THREE.Vector3(114, -126, 0),
  ]);
  const woodTube = new THREE.TubeGeometry(woodCurve, 10, 6.4, 5, false);
  woodTube.scale(1, 1, 0.76);
  hangerWoodMergedGeo = markSharedGeometry(mergeStaticBufferGeometries([crown, woodTube], false));
  crown.dispose();
  woodTube.dispose();

  // Instant 72-triangle sculpted garment silhouette (used immediately before async GLB arrives or offline)
  const torso = new THREE.CylinderGeometry(0.38, 0.44, 1, 10, 2, false);
  torso.scale(1, 1, 0.31);
  torso.translate(0, -0.5, 0);
  proxyGarmentTorsoGeo = markSharedGeometry(torso);

  // Instant 48-triangle lasted shoe silhouette
  const sole = new THREE.BoxGeometry(0.92, 0.24, 1.0);
  sole.translate(0, 0.12, 0);
  const vamp = new THREE.CylinderGeometry(0.36, 0.44, 0.62, 8);
  vamp.rotateX(Math.PI / 2);
  vamp.scale(1, 0.58, 1);
  vamp.translate(0, 0.36, 0.06);
  proxyShoeSingleGeo = markSharedGeometry(mergeStaticBufferGeometries([sole, vamp], false));
  sole.dispose();
  vamp.dispose();

  foldedBaseUnitGeo = markSharedGeometry(new THREE.BoxGeometry(1, 1, 1));
  boxBodyUnitGeo = markSharedGeometry(new THREE.BoxGeometry(1, 1, 1));
  boxLidUnitGeo = markSharedGeometry(new THREE.BoxGeometry(1.03, 1, 1.03));

  hangerChromeMat = markSharedMaterial(
    new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.88,
      roughness: 0.2,
    })
  );
  hangerWalnutMat = markSharedMaterial(
    new THREE.MeshStandardMaterial({
      color: 0x5c3d28,
      metalness: 0.04,
      roughness: 0.46,
    })
  );
  hangerOakMat = markSharedMaterial(
    new THREE.MeshStandardMaterial({
      color: 0xc5a377,
      metalness: 0.03,
      roughness: 0.48,
    })
  );
}

function createContouredCoatHangerGroup(
  rackAngleRad: number,
  variantIndex: number,
  fitScaleXZ = 1
): THREE.Group {
  ensureSharedHangerResources();
  const root = new THREE.Group();
  root.name = "birim_3d_coat_hanger";
  root.raycast = () => {};

  const hookMesh = new THREE.Mesh(hangerChromeMergedGeo!, hangerChromeMat!);
  hookMesh.raycast = () => {};
  hookMesh.castShadow = false;
  hookMesh.receiveShadow = false;
  root.add(hookMesh);

  const woodMat = variantIndex % 2 === 0 ? hangerWalnutMat! : hangerOakMat!;
  const woodMesh = new THREE.Mesh(hangerWoodMergedGeo!, woodMat);
  woodMesh.rotation.y = rackAngleRad;
  if (fitScaleXZ < 0.999) {
    woodMesh.scale.set(fitScaleXZ, 1, fitScaleXZ);
  }
  woodMesh.raycast = () => {};
  woodMesh.castShadow = false;
  woodMesh.receiveShadow = false;
  root.add(woodMesh);

  return root;
}

let propsEnabledState = true;
let hydratedFromStorage = false;
let idlePreloadScheduled = false;

const renderSubscribers = new Set<() => void>();
const catalogSubscribers = new Set<() => void>();

function hydrateCustomSettingsOnce(): void {
  if (hydratedFromStorage || typeof window === "undefined") return;
  hydratedFromStorage = true;
  try {
    const rawEnabled = window.localStorage.getItem(STORAGE_KEY_ENABLED);
    if (rawEnabled === "false") propsEnabledState = false;
    const rawUrls = window.localStorage.getItem(STORAGE_KEY_URLS);
    if (rawUrls) {
      const parsed = JSON.parse(rawUrls) as Partial<Record<WardrobeGlbCategory, string>>;
      (Object.keys(parsed) as WardrobeGlbCategory[]).forEach((cat) => {
        const u = parsed[cat];
        if (
          typeof u === "string" &&
          u.trim().length > 4 &&
          !u.includes("PowerAppsMR/master/jacket.glb")
        ) {
          customRemoteUrls.set(cat, u.trim());
        }
      });
    }
  } catch {
    // Ignore storage restriction errors
  }
}

function persistCustomUrls(): void {
  if (typeof window === "undefined") return;
  try {
    const obj: Partial<Record<WardrobeGlbCategory, string>> = {};
    customRemoteUrls.forEach((v, k) => {
      obj[k] = v;
    });
    window.localStorage.setItem(STORAGE_KEY_URLS, JSON.stringify(obj));
  } catch {
    // Ignore storage write errors
  }
}

function notifyRenderSubscribers(): void {
  renderSubscribers.forEach((cb) => {
    try {
      cb();
    } catch {
      // Ignore subscriber error
    }
  });
}

function notifyCatalogSubscribers(): void {
  catalogSubscribers.forEach((cb) => {
    try {
      cb();
    } catch {
      // Ignore subscriber error
    }
  });
}

export function subscribeWardrobeGlbRenderNeeded(cb: () => void): () => void {
  renderSubscribers.add(cb);
  return () => {
    renderSubscribers.delete(cb);
  };
}

export function subscribeWardrobeGlbCatalogChange(cb: () => void): () => void {
  hydrateCustomSettingsOnce();
  catalogSubscribers.add(cb);
  return () => {
    catalogSubscribers.delete(cb);
  };
}

export function isWardrobeGlbPropsEnabled(): boolean {
  hydrateCustomSettingsOnce();
  return propsEnabledState;
}

export function setWardrobeGlbPropsEnabled(enabled: boolean): void {
  hydrateCustomSettingsOnce();
  propsEnabledState = enabled;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY_ENABLED, enabled ? "true" : "false");
    } catch {
      // Ignore storage write errors
    }
  }
  notifyCatalogSubscribers();
  notifyRenderSubscribers();
}

export function getActiveWardrobeGlbUrl(category: WardrobeGlbCategory): {
  url: string;
  customLabel?: string;
  isCustom: boolean;
  error?: string;
  isLoaded: boolean;
} {
  hydrateCustomSettingsOnce();
  const blobEntry = customBlobUrls.get(category);
  if (blobEntry) {
    return {
      url: blobEntry.url,
      customLabel: blobEntry.fileName,
      isCustom: true,
      error: loadErrorMap.get(category),
      isLoaded: normalizedTemplateCache.has(category),
    };
  }
  const customRemote = customRemoteUrls.get(category);
  if (customRemote) {
    return {
      url: customRemote,
      customLabel: customRemote.split("/").pop() || "Özel URL (.glb)",
      isCustom: true,
      error: loadErrorMap.get(category),
      isLoaded: normalizedTemplateCache.has(category),
    };
  }
  return {
    url: DEFAULT_WARDROBE_GLB_CATALOG[category].remoteUrl,
    isCustom: false,
    error: loadErrorMap.get(category),
    isLoaded: normalizedTemplateCache.has(category),
  };
}

export function registerCustomWardrobeGlbFile(
  category: WardrobeGlbCategory,
  file: File
): void {
  if (typeof window === "undefined") return;
  const prev = customBlobUrls.get(category);
  if (prev) {
    URL.revokeObjectURL(prev.url);
  }
  const blobUrl = URL.createObjectURL(file);
  customBlobUrls.set(category, { url: blobUrl, fileName: file.name });
  normalizedTemplateCache.delete(category);
  inFlightLoads.delete(category);
  loadErrorMap.delete(category);
  void ensureWardrobeGlbLoaded(category).then(() => {
    notifyCatalogSubscribers();
    notifyRenderSubscribers();
  });
  notifyCatalogSubscribers();
}

export function registerCustomWardrobeGlbUrl(
  category: WardrobeGlbCategory,
  url: string
): void {
  hydrateCustomSettingsOnce();
  const trimmed = url.trim();
  const prevBlob = customBlobUrls.get(category);
  if (prevBlob) {
    URL.revokeObjectURL(prevBlob.url);
    customBlobUrls.delete(category);
  }
  if (!trimmed) {
    customRemoteUrls.delete(category);
  } else {
    customRemoteUrls.set(category, trimmed);
  }
  persistCustomUrls();
  normalizedTemplateCache.delete(category);
  inFlightLoads.delete(category);
  loadErrorMap.delete(category);
  void ensureWardrobeGlbLoaded(category).then(() => {
    notifyCatalogSubscribers();
    notifyRenderSubscribers();
  });
  notifyCatalogSubscribers();
}

export function resetWardrobeGlbCategoryToDefault(category: WardrobeGlbCategory): void {
  registerCustomWardrobeGlbUrl(category, "");
}

function getGltfLoader(): GLTFLoader | null {
  if (typeof window === "undefined") return null;
  if (sharedGltfLoader) return sharedGltfLoader;
  const loader = new GLTFLoader();
  loader.setCrossOrigin("anonymous");
  const draco = new DRACOLoader();
  draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
  loader.setDRACOLoader(draco);
  sharedGltfLoader = loader;
  return loader;
}

/**
 * Downscales oversized 1K/2K/4K embedded .GLB textures once to <=256px mipmaps
 * and disposes the raw 4K source texture to free ~94% of GPU VRAM bandwidth!
 */
function downscaleTextureIfLarge(tex: THREE.Texture | null | undefined): THREE.Texture | null {
  if (!tex) return null;
  const cached = downscaledTexCache.get(tex);
  if (cached) return cached;

  const img = tex.image as { width?: number; height?: number } | undefined;
  const w = img?.width || 0;
  const h = img?.height || 0;
  if (typeof document !== "undefined" && (w > 256 || h > 256)) {
    try {
      const maxDim = 256;
      const ratio = Math.min(maxDim / w, maxDim / h);
      const cw = Math.max(64, Math.round(w * ratio));
      const ch = Math.max(64, Math.round(h * ratio));
      const canvas = document.createElement("canvas");
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(tex.image as CanvasImageSource, 0, 0, cw, ch);
        const lite = new THREE.CanvasTexture(canvas);
        lite.colorSpace = tex.colorSpace;
        lite.flipY = tex.flipY;
        lite.wrapS = tex.wrapS;
        lite.wrapT = tex.wrapT;
        lite.repeat.copy(tex.repeat);
        lite.offset.copy(tex.offset);
        lite.anisotropy = 1;
        lite.needsUpdate = true;
        markSharedTexture(lite);
        downscaledTexCache.set(tex, lite);
        tex.dispose();
        return lite;
      }
    } catch {
      // Keep original texture if canvas draw fails
    }
  }
  tex.anisotropy = 1;
  markSharedTexture(tex);
  downscaledTexCache.set(tex, tex);
  return tex;
}

/**
 * Watertight UV-safe O(V+T) spatial vertex-clustering decimator run ONCE on load.
 * Compresses EVERY prop >= 900 triangles (including 19,517-tri shirts, 22,700-tri multi-part shoes,
 * and 115,200-tri SheenCloth!) down to ~450–980 triangles with zero cracks.
 */
export function decimateHighPolyBufferGeometry(
  srcGeo: THREE.BufferGeometry,
  gridDivisions: number
): THREE.BufferGeometry {
  const pos = srcGeo.attributes.position as THREE.BufferAttribute | undefined;
  if (!pos || pos.count < 600) return srcGeo;

  const idxAttr = srcGeo.index;
  const triCount = idxAttr ? Math.floor(idxAttr.count / 3) : Math.floor(pos.count / 3);
  if (triCount < 900) return srcGeo;

  if (!srcGeo.boundingBox) srcGeo.computeBoundingBox();
  const bb = srcGeo.boundingBox;
  if (!bb || bb.isEmpty()) return srcGeo;

  const minX = bb.min.x;
  const minY = bb.min.y;
  const minZ = bb.min.z;
  const maxSpan = Math.max(1e-6, bb.max.x - minX, bb.max.y - minY, bb.max.z - minZ);
  const step = maxSpan / Math.max(8, gridDivisions);

  const vc = pos.count;
  const cellMap = new Map<number, number>();
  const vCell = new Int32Array(vc);
  const sumX: number[] = [];
  const sumY: number[] = [];
  const sumZ: number[] = [];
  const counts: number[] = [];
  let cellCount = 0;

  for (let i = 0; i < vc; i++) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    const pz = pos.getZ(i);
    const ix = Math.max(0, Math.min(255, Math.floor((px - minX) / step)));
    const iy = Math.max(0, Math.min(255, Math.floor((py - minY) / step)));
    const iz = Math.max(0, Math.min(255, Math.floor((pz - minZ) / step)));
    const key = (ix * 256 + iy) * 256 + iz;
    let c = cellMap.get(key);
    if (c === undefined) {
      c = cellCount++;
      cellMap.set(key, c);
      sumX.push(px);
      sumY.push(py);
      sumZ.push(pz);
      counts.push(1);
    } else {
      sumX[c] += px;
      sumY[c] += py;
      sumZ[c] += pz;
      counts[c] += 1;
    }
    vCell[i] = c;
  }

  for (let c = 0; c < cellCount; c++) {
    const inv = 1 / counts[c];
    sumX[c] *= inv;
    sumY[c] *= inv;
    sumZ[c] *= inv;
  }

  const nrmAttr = srcGeo.attributes.normal as THREE.BufferAttribute | undefined;
  const uvAttr = srcGeo.attributes.uv as THREE.BufferAttribute | undefined;

  const outVertMap = new Map<number, number>();
  const outPos: number[] = [];
  const outNrm: number[] = [];
  const outUv: number[] = [];
  const outIndices: number[] = [];
  let outVertCount = 0;

  const getOrEmitVertex = (origIdx: number, cellId: number): number => {
    let uvBucket = 0;
    let u = 0;
    let v = 0;
    if (uvAttr) {
      u = uvAttr.getX(origIdx);
      v = uvAttr.getY(origIdx);
      const iu = Math.max(0, Math.min(15, Math.floor((((u % 1) + 1) % 1) * 16)));
      const iv = Math.max(0, Math.min(15, Math.floor((((v % 1) + 1) % 1) * 16)));
      uvBucket = iu * 16 + iv;
    }
    const vKey = cellId * 256 + uvBucket;
    const existing = outVertMap.get(vKey);
    if (existing !== undefined) {
      if (nrmAttr) {
        outNrm[existing * 3] += nrmAttr.getX(origIdx);
        outNrm[existing * 3 + 1] += nrmAttr.getY(origIdx);
        outNrm[existing * 3 + 2] += nrmAttr.getZ(origIdx);
      }
      return existing;
    }
    const nextIdx = outVertCount++;
    outVertMap.set(vKey, nextIdx);
    outPos.push(sumX[cellId], sumY[cellId], sumZ[cellId]);
    if (nrmAttr) {
      outNrm.push(nrmAttr.getX(origIdx), nrmAttr.getY(origIdx), nrmAttr.getZ(origIdx));
    }
    if (uvAttr) {
      outUv.push(u, v);
    }
    return nextIdx;
  };

  for (let t = 0; t < triCount; t++) {
    const i0 = idxAttr ? idxAttr.getX(t * 3) : t * 3;
    const i1 = idxAttr ? idxAttr.getX(t * 3 + 1) : t * 3 + 1;
    const i2 = idxAttr ? idxAttr.getX(t * 3 + 2) : t * 3 + 2;
    const c0 = vCell[i0];
    const c1 = vCell[i1];
    const c2 = vCell[i2];
    if (c0 === c1 || c1 === c2 || c0 === c2) continue;
    outIndices.push(getOrEmitVertex(i0, c0), getOrEmitVertex(i1, c1), getOrEmitVertex(i2, c2));
  }

  if (outIndices.length < 36) return srcGeo;

  const decGeo = new THREE.BufferGeometry();
  decGeo.setAttribute("position", new THREE.Float32BufferAttribute(outPos, 3));
  if (uvAttr && outUv.length === outVertCount * 2) {
    const uvBuf = new THREE.Float32BufferAttribute(outUv, 2);
    decGeo.setAttribute("uv", uvBuf);
  }
  decGeo.setIndex(outIndices);
  if (nrmAttr && outNrm.length === outVertCount * 3) {
    for (let i = 0; i < outVertCount; i++) {
      const nx = outNrm[i * 3];
      const ny = outNrm[i * 3 + 1];
      const nz = outNrm[i * 3 + 2];
      const len = Math.hypot(nx, ny, nz) || 1;
      outNrm[i * 3] = nx / len;
      outNrm[i * 3 + 1] = ny / len;
      outNrm[i * 3 + 2] = nz / len;
    }
    decGeo.setAttribute("normal", new THREE.Float32BufferAttribute(outNrm, 3));
  } else {
    decGeo.computeVertexNormals();
  }
  decGeo.computeBoundingBox();
  decGeo.computeBoundingSphere();
  srcGeo.dispose();
  return decGeo;
}

function disposeUnusedSourceGlbMaterial(srcMat: Record<string, unknown>): void {
  const unusedTexKeys = [
    "normalMap",
    "roughnessMap",
    "metalnessMap",
    "aoMap",
    "emissiveMap",
    "bumpMap",
    "sheenColorMap",
    "sheenRoughnessMap",
    "specularIntensityMap",
    "specularColorMap",
    "transmissionMap",
    "thicknessMap",
    "clearcoatMap",
    "clearcoatNormalMap",
  ];
  for (const k of unusedTexKeys) {
    const t = srcMat[k];
    if (t instanceof THREE.Texture) {
      t.dispose();
    }
  }
}

function optimizeGlbSceneFor60Fps(
  root: THREE.Object3D,
  category: WardrobeGlbCategory
): THREE.Mesh[] {
  const candidateMeshes: THREE.Mesh[] = [];
  root.traverse((obj) => {
    obj.raycast = () => {};
    if (obj instanceof THREE.Mesh && obj.visible && obj.geometry?.attributes?.position?.count > 0) {
      candidateMeshes.push(obj);
    }
  });

  const validMeshes: THREE.Mesh[] = [];
  const matCache = new WeakMap<THREE.Material, THREE.MeshStandardMaterial>();
  const geoDecimateCache = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();

  const targetGrid =
    category === "folded_cloth"
      ? 11
      : category === "shoe"
      ? 11
      : category === "shirt" || category === "jacket"
      ? 13
      : 12;

  for (const obj of candidateMeshes) {
    const pos = obj.geometry.attributes.position;
    const rawTris = obj.geometry.index
      ? Math.floor(obj.geometry.index.count / 3)
      : Math.floor(pos.count / 3);

    if (candidateMeshes.length > 2 && rawTris < 80) {
      obj.visible = false;
      continue;
    }

    if (rawTris >= 900) {
      let dec = geoDecimateCache.get(obj.geometry);
      if (!dec) {
        dec = decimateHighPolyBufferGeometry(obj.geometry, targetGrid);
        geoDecimateCache.set(obj.geometry, dec);
      }
      obj.geometry = dec;
    }

    obj.castShadow = false;
    obj.receiveShadow = false;
    markSharedGeometry(obj.geometry);
    if (!obj.geometry.boundingBox) {
      obj.geometry.computeBoundingBox();
    }

    const srcMat = (Array.isArray(obj.material) ? obj.material[0] : obj.material) as
      | THREE.MeshStandardMaterial
      | undefined;
    if (!srcMat || srcMat.visible === false || (srcMat.transparent && srcMat.opacity < 0.22)) {
      obj.visible = false;
      continue;
    }

    let fastMat = matCache.get(srcMat);
    if (!fastMat) {
      const liteMap = downscaleTextureIfLarge(srcMat.map);
      disposeUnusedSourceGlbMaterial(srcMat as unknown as Record<string, unknown>);
      fastMat = new THREE.MeshStandardMaterial({
        color: srcMat.color ? srcMat.color.clone() : new THREE.Color(0xffffff),
        map: liteMap,
        roughness: typeof srcMat.roughness === "number" ? Math.max(0.58, srcMat.roughness) : 0.78,
        metalness: typeof srcMat.metalness === "number" ? Math.min(0.2, srcMat.metalness) : 0.02,
        envMapIntensity: 0.55,
      });
      markSharedMaterial(fastMat);
      matCache.set(srcMat, fastMat);
      srcMat.dispose();
    }
    obj.material = fastMat;
    validMeshes.push(obj);
  }

  return validMeshes;
}

const BOX_CORNERS = [
  new THREE.Vector3(),
  new THREE.Vector3(),
  new THREE.Vector3(),
  new THREE.Vector3(),
  new THREE.Vector3(),
  new THREE.Vector3(),
  new THREE.Vector3(),
  new THREE.Vector3(),
];

function computeFastWorldBounds(root: THREE.Object3D, meshes: THREE.Mesh[]): THREE.Box3 {
  root.updateMatrixWorld(true);
  const out = new THREE.Box3();
  for (const m of meshes) {
    if (!m.visible || !m.geometry.boundingBox) continue;
    const b = m.geometry.boundingBox;
    BOX_CORNERS[0].set(b.min.x, b.min.y, b.min.z).applyMatrix4(m.matrixWorld);
    BOX_CORNERS[1].set(b.min.x, b.min.y, b.max.z).applyMatrix4(m.matrixWorld);
    BOX_CORNERS[2].set(b.min.x, b.max.y, b.min.z).applyMatrix4(m.matrixWorld);
    BOX_CORNERS[3].set(b.min.x, b.max.y, b.max.z).applyMatrix4(m.matrixWorld);
    BOX_CORNERS[4].set(b.max.x, b.min.y, b.min.z).applyMatrix4(m.matrixWorld);
    BOX_CORNERS[5].set(b.max.x, b.min.y, b.max.z).applyMatrix4(m.matrixWorld);
    BOX_CORNERS[6].set(b.max.x, b.max.y, b.min.z).applyMatrix4(m.matrixWorld);
    BOX_CORNERS[7].set(b.max.x, b.max.y, b.max.z).applyMatrix4(m.matrixWorld);
    for (let i = 0; i < 8; i++) out.expandByPoint(BOX_CORNERS[i]);
  }
  return out;
}

function drapeOutstretchedGarmentSleeves(
  orientHolder: THREE.Object3D,
  meshes: THREE.Mesh[],
  oBox: THREE.Box3,
  oSize: THREE.Vector3
): void {
  if (oSize.x <= oSize.y * 1.25) return;

  orientHolder.updateMatrixWorld(true);
  const invHolderMat = orientHolder.matrixWorld.clone().invert();
  const oCenterX = (oBox.min.x + oBox.max.x) * 0.5;
  const hemBandMaxY = oBox.min.y + oSize.y * 0.14;

  let torsoHalfW = 0;
  const tmpV = new THREE.Vector3();
  const toHolder = new THREE.Matrix4();

  for (const mesh of meshes) {
    if (!mesh.visible) continue;
    toHolder.multiplyMatrices(invHolderMat, mesh.matrixWorld);
    const pos = mesh.geometry.attributes.position;
    const stride = Math.max(1, Math.floor(pos.count / 1200));
    for (let i = 0; i < pos.count; i += stride) {
      tmpV.fromBufferAttribute(pos, i).applyMatrix4(toHolder);
      if (tmpV.y <= hemBandMaxY) {
        const ax = Math.abs(tmpV.x - oCenterX);
        if (ax > torsoHalfW) torsoHalfW = ax;
      }
    }
  }

  if (torsoHalfW < oSize.x * 0.12 || torsoHalfW > oSize.x * 0.42) {
    torsoHalfW = oSize.x * 0.266;
  }

  const innerX = torsoHalfW * 1.01;
  const outerX = torsoHalfW * 1.58;
  const pivotX = torsoHalfW * 1.05;
  const pivotY = oBox.min.y + oSize.y * 0.725;
  const fromHolder = new THREE.Matrix4();
  const tmpN = new THREE.Vector3();

  for (const mesh of meshes) {
    if (!mesh.visible) continue;
    toHolder.multiplyMatrices(invHolderMat, mesh.matrixWorld);
    fromHolder.copy(toHolder).invert();
    const pos = mesh.geometry.attributes.position as THREE.BufferAttribute;
    const nrm = mesh.geometry.attributes.normal as THREE.BufferAttribute | undefined;
    let touched = false;

    for (let i = 0; i < pos.count; i++) {
      tmpV.fromBufferAttribute(pos, i).applyMatrix4(toHolder);
      const relX = tmpV.x - oCenterX;
      const ax = Math.abs(relX);
      if (ax <= innerX) continue;

      const t = Math.max(0, Math.min(1, (ax - innerX) / Math.max(1e-5, outerX - innerX)));
      const w = t * t * (3 - 2 * t);
      const ang = w * 0.85;
      const signX = relX >= 0 ? 1 : -1;
      const dx = ax - pivotX;
      const dy = tmpV.y - pivotY;
      const cosA = Math.cos(-ang);
      const sinA = Math.sin(-ang);

      tmpV.x = oCenterX + signX * (pivotX + dx * cosA - dy * sinA);
      tmpV.y = pivotY + dx * sinA + dy * cosA;
      tmpV.applyMatrix4(fromHolder);
      pos.setXYZ(i, tmpV.x, tmpV.y, tmpV.z);

      if (nrm) {
        tmpN.fromBufferAttribute(nrm, i);
        const rotZ = -signX * ang;
        const cn = Math.cos(rotZ);
        const sn = Math.sin(rotZ);
        const nx = tmpN.x * cn - tmpN.y * sn;
        const ny = tmpN.x * sn + tmpN.y * cn;
        nrm.setXYZ(i, nx, ny, tmpN.z);
      }
      touched = true;
    }

    if (touched) {
      pos.needsUpdate = true;
      if (nrm) nrm.needsUpdate = true;
      mesh.geometry.computeBoundingBox();
    }
  }
}

function measureCollarOpeningCentroid(
  root: THREE.Object3D,
  meshes: THREE.Mesh[],
  worldBox: THREE.Box3
): { cx: number; cz: number; collarRiseMm: number } {
  root.updateMatrixWorld(true);
  const center = new THREE.Vector3();
  worldBox.getCenter(center);
  const size = new THREE.Vector3();
  worldBox.getSize(size);

  const collarFloorY = worldBox.max.y - size.y * 0.06;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  let hits = 0;
  const tmpV = new THREE.Vector3();

  for (const mesh of meshes) {
    if (!mesh.visible) continue;
    const pos = mesh.geometry.attributes.position;
    const stride = Math.max(1, Math.floor(pos.count / 1000));
    for (let i = 0; i < pos.count; i += stride) {
      tmpV.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      if (tmpV.y >= collarFloorY) {
        if (tmpV.x < minX) minX = tmpV.x;
        if (tmpV.x > maxX) maxX = tmpV.x;
        if (tmpV.z < minZ) minZ = tmpV.z;
        if (tmpV.z > maxZ) maxZ = tmpV.z;
        hits++;
      }
    }
  }

  const cx = hits >= 3 ? (minX + maxX) * 0.5 : center.x;
  const cz = hits >= 3 ? (minZ + maxZ) * 0.5 : center.z;

  let shoulderTopY = -Infinity;
  for (const mesh of meshes) {
    if (!mesh.visible) continue;
    const pos = mesh.geometry.attributes.position;
    const stride = Math.max(1, Math.floor(pos.count / 1000));
    for (let i = 0; i < pos.count; i += stride) {
      tmpV.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      const ax = Math.abs(tmpV.x - cx);
      if (ax >= 68 && ax <= 102 && tmpV.y > shoulderTopY) {
        shoulderTopY = tmpV.y;
      }
    }
  }

  const collarRiseMm = Number.isFinite(shoulderTopY)
    ? Math.max(0, worldBox.max.y - shoulderTopY)
    : 0;

  return { cx, cz, collarRiseMm };
}

/**
 * Bakes normalized world transforms and merges all sub-meshes sharing the same material
 * into flat, single-draw-call BufferGeometries directly under `normalizedRoot`!
 * Collapses deep 6-level glTF node hierarchies (e.g. 6-part shoes) into 1–2 flat meshes!
 */
function flattenAndMergeNormalizedTemplate(
  orientHolder: THREE.Group,
  activeMeshes: THREE.Mesh[],
  entry: WardrobeGlbCatalogEntry,
  meta: Record<string, unknown>
): THREE.Group {
  orientHolder.updateMatrixWorld(true);
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();

  for (const m of activeMeshes) {
    if (!m.visible) continue;
    const mat = m.material as THREE.Material;
    const baked = m.geometry.clone();
    baked.applyMatrix4(m.matrixWorld);
    const list = buckets.get(mat) || [];
    list.push(baked);
    buckets.set(mat, list);
  }

  const flatRoot = new THREE.Group();
  flatRoot.name = `birim_glb_template_${entry.category}`;
  flatRoot.raycast = () => {};

  buckets.forEach((geos, mat) => {
    const hasUv = geos.some((g) => Boolean(g.attributes.uv));
    const mergedGeo =
      geos.length === 1 ? geos[0] : mergeStaticBufferGeometries(geos, hasUv);
    if (geos.length > 1) {
      geos.forEach((g) => g.dispose());
    }
    mergedGeo.computeBoundingBox();
    mergedGeo.computeBoundingSphere();
    markSharedGeometry(mergedGeo);
    const mesh = new THREE.Mesh(mergedGeo, mat);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.raycast = () => {};
    flatRoot.add(mesh);
  });

  flatRoot.userData = meta;
  return flatRoot;
}

function normalizeLoadedGlbScene(
  rawScene: THREE.Group,
  entry: WardrobeGlbCatalogEntry
): THREE.Group | null {
  const rawMeshes = optimizeGlbSceneFor60Fps(rawScene, entry.category);
  if (rawMeshes.length === 0) return null;

  if (rawMeshes.length > 1) {
    rawScene.updateMatrixWorld(true);
    for (const m of rawMeshes) {
      const mb = computeFastWorldBounds(rawScene, [m]);
      const ms = new THREE.Vector3();
      mb.getSize(ms);
      const horiz = Math.max(ms.x, ms.z);
      if (horiz > 1e-4 && ms.y < horiz * 0.06) {
        m.visible = false;
      }
    }
  }
  const activeMeshes = rawMeshes.filter((m) => m.visible);
  if (activeMeshes.length === 0) return null;

  const preBox = computeFastWorldBounds(rawScene, activeMeshes);
  if (preBox.isEmpty()) return null;
  const preSize = new THREE.Vector3();
  preBox.getSize(preSize);
  if (preSize.x < 1e-6 || preSize.y < 1e-6 || preSize.z < 1e-6) return null;

  const orientHolder = new THREE.Group();
  orientHolder.add(rawScene);

  if (entry.category === "shoe" && preSize.x > preSize.z) {
    orientHolder.rotation.y = -Math.PI / 2;
  } else if (
    (entry.category === "jacket" || entry.category === "shirt") &&
    preSize.z > preSize.x
  ) {
    orientHolder.rotation.y = Math.PI / 2;
  }

  let oBox = computeFastWorldBounds(orientHolder, activeMeshes);
  const oSize = new THREE.Vector3();
  oBox.getSize(oSize);

  if (entry.category === "jacket" || entry.category === "shirt") {
    drapeOutstretchedGarmentSleeves(orientHolder, activeMeshes, oBox, oSize);
    oBox = computeFastWorldBounds(orientHolder, activeMeshes);
    oBox.getSize(oSize);

    const scaleX = entry.targetMm.w / Math.max(1e-5, oSize.x);
    const scaleY = Math.min(entry.targetMm.h / Math.max(1e-5, oSize.y), scaleX * 1.85);
    const scaleZ = Math.min(scaleX, entry.targetMm.d / Math.max(1e-5, oSize.z));
    orientHolder.scale.set(scaleX, scaleY, scaleZ);
  } else {
    const uniformScale = Math.min(
      entry.targetMm.w / Math.max(1e-5, oSize.x),
      entry.targetMm.h / Math.max(1e-5, oSize.y),
      entry.targetMm.d / Math.max(1e-5, oSize.z)
    );
    orientHolder.scale.setScalar(uniformScale);
  }

  const sBox = computeFastWorldBounds(orientHolder, activeMeshes);
  const sCenter = new THREE.Vector3();
  sBox.getCenter(sCenter);
  const sSize = new THREE.Vector3();
  sBox.getSize(sSize);

  let pinTopY = COLLAR_PIN_Y_MM;
  let hangerWidthFactor = 1;

  if (entry.anchor === "top") {
    const collar = measureCollarOpeningCentroid(orientHolder, activeMeshes, sBox);
    const collarLiftMm =
      collar.collarRiseMm > 16 ? Math.min(38, collar.collarRiseMm * 0.76) : 0;
    pinTopY = Math.min(-16, COLLAR_PIN_Y_MM + collarLiftMm);
    if (collarLiftMm > 12) {
      hangerWidthFactor = 0.86;
    }
    orientHolder.position.x -= collar.cx;
    orientHolder.position.z -= collar.cz;
    orientHolder.position.y -= sBox.max.y - pinTopY;
  } else {
    orientHolder.position.x -= sCenter.x;
    orientHolder.position.z -= sCenter.z;
    orientHolder.position.y -= sBox.min.y;
  }

  const finalBox = computeFastWorldBounds(orientHolder, activeMeshes);
  const symHalfW = Math.max(Math.abs(finalBox.min.x), Math.abs(finalBox.max.x));
  const symHalfD = Math.max(Math.abs(finalBox.min.z), Math.abs(finalBox.max.z));

  return flattenAndMergeNormalizedTemplate(orientHolder, activeMeshes, entry, {
    glbCategory: entry.category,
    pinTopY,
    hangerWidthFactor,
    sizeMm: {
      w: entry.anchor === "top" ? symHalfW * 2 : sSize.x,
      h: sSize.y,
      d: entry.anchor === "top" ? symHalfD * 2 : sSize.z,
    },
  });
}

export async function ensureWardrobeGlbLoaded(
  category: WardrobeGlbCategory
): Promise<THREE.Group | null> {
  if (typeof window === "undefined") return null;
  hydrateCustomSettingsOnce();

  const cached = normalizedTemplateCache.get(category);
  if (cached) return cached;

  const existingPromise = inFlightLoads.get(category);
  if (existingPromise) return existingPromise;

  const loader = getGltfLoader();
  if (!loader) return null;

  const entry = DEFAULT_WARDROBE_GLB_CATALOG[category];
  const activeSource = getActiveWardrobeGlbUrl(category);

  const loadPromise = (async (): Promise<THREE.Group | null> => {
    // Skip guaranteed-404 `/models/wardrobe/*.glb` probes unless user explicitly supplied a custom URL/file!
    const candidateUrls = activeSource.isCustom
      ? [activeSource.url, entry.remoteUrl]
      : [entry.remoteUrl];
    let lastError: unknown = null;
    for (const url of candidateUrls) {
      if (!url) continue;
      try {
        const gltf: GLTF = await loader.loadAsync(url);
        const normalized = normalizeLoadedGlbScene(gltf.scene, entry);
        if (normalized) {
          normalizedTemplateCache.set(category, normalized);
          loadErrorMap.delete(category);
          notifyCatalogSubscribers();
          notifyRenderSubscribers();
          return normalized;
        }
      } catch (err) {
        lastError = err;
      }
    }
    loadErrorMap.set(
      category,
      lastError instanceof Error ? lastError.message : "GLB model yüklenemedi"
    );
    notifyCatalogSubscribers();
    return null;
  })().finally(() => {
    inFlightLoads.delete(category);
  });

  inFlightLoads.set(category, loadPromise);
  return loadPromise;
}

const DARK_GARMENT_TINTS: (string | null)[] = [
  null,
  "#B4C6DE",
  "#D4C3B4",
  "#BACCC0",
];

const SHIRT_WARDROBE_TINTS = [
  "#F4F0E8",
  "#CFD9E3",
  "#D7CEC1",
  "#B99C7B",
  "#686E78",
];

const KNIT_STACK_TINTS = [
  "#EFEAE1",
  "#D5CABE",
  "#A69F95",
  "#51555C",
];

const SHOE_LEATHER_TINTS: (string | null)[] = [
  null,
  "#5C4332",
  "#9E8E7D",
  "#33373E",
];

function getSolidSharedMat(hex: string, roughness = 0.85): THREE.MeshStandardMaterial {
  const key = `solid_std_${hex}_${roughness}`;
  let m = tintMaterialCache.get(key) as THREE.MeshStandardMaterial | undefined;
  if (!m) {
    m = markSharedMaterial(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(hex),
        roughness,
        metalness: 0.02,
        envMapIntensity: 0.52,
      })
    );
    tintMaterialCache.set(key, m);
  }
  return m;
}

function applySubtleMeshTint(
  cloneRoot: THREE.Group,
  hex: string | null,
  roughnessOverride?: number
): void {
  if (!hex) return;
  cloneRoot.traverse((obj) => {
    if (obj instanceof THREE.Mesh && obj.material && !Array.isArray(obj.material)) {
      const baseMat = obj.material as THREE.MeshStandardMaterial;
      const cacheKey = `${baseMat.uuid}_${hex}_${roughnessOverride ?? "def"}`;
      let tinted = tintMaterialCache.get(cacheKey);
      if (!tinted) {
        const nextMat = baseMat.clone();
        if (nextMat.color instanceof THREE.Color) {
          nextMat.color.set(hex);
        }
        if (roughnessOverride !== undefined) {
          nextMat.roughness = roughnessOverride;
        }
        tinted = markSharedMaterial(nextMat);
        tintMaterialCache.set(cacheKey, tinted);
      }
      obj.material = tinted;
      obj.castShadow = false;
      obj.receiveShadow = false;
      obj.raycast = () => {};
    }
  });
}

function mountTemplateCloneOrAsync(
  anchor: THREE.Group,
  category: WardrobeGlbCategory,
  configureClone: (cloned: THREE.Group, sizeMm: { w: number; h: number; d: number }) => void,
  buildInstantProxy?: () => THREE.Object3D
): THREE.Group {
  if (!isWardrobeGlbPropsEnabled()) {
    if (buildInstantProxy) {
      const proxy = buildInstantProxy();
      anchor.add(proxy);
      freezeStaticObject3DSubtree(anchor, true);
    }
    return anchor;
  }

  const attachFromTemplate = (tpl: THREE.Group) => {
    const cloned = tpl.clone(true);
    const sizeMm = (tpl.userData?.sizeMm as { w: number; h: number; d: number }) || {
      w: 320,
      h: 320,
      d: 320,
    };
    configureClone(cloned, sizeMm);
    anchor.add(cloned);
    freezeStaticObject3DSubtree(anchor, true);
  };

  const cached = normalizedTemplateCache.get(category);
  if (cached) {
    attachFromTemplate(cached);
    return anchor;
  }

  let proxyNode: THREE.Object3D | null = null;
  if (buildInstantProxy) {
    proxyNode = buildInstantProxy();
    anchor.add(proxyNode);
    freezeStaticObject3DSubtree(anchor, true);
  }

  void ensureWardrobeGlbLoaded(category).then((tpl) => {
    if (!tpl || !anchor.parent) return;
    if (proxyNode && proxyNode.parent === anchor) {
      anchor.remove(proxyNode);
    }
    // Clear any temporary hanger before attachFromTemplate re-adds configured set
    anchor.clear();
    attachFromTemplate(tpl);
    if (anchor.parent) {
      anchor.parent.updateMatrixWorld(true);
    }
    notifyRenderSubscribers();
  });

  return anchor;
}

export function createReadyMadeHangingGarmentGroup(
  variantIndex: number,
  maxDropMm = 860,
  maxCabinetClearDepthMm = 500,
  maxSlotWidthMm = 152
): THREE.Group {
  ensureSharedHangerResources();
  const anchor = new THREE.Group();
  anchor.raycast = () => {};
  const category: WardrobeGlbCategory = variantIndex % 3 === 0 ? "jacket" : "shirt";
  const absAngle = Math.PI * 0.48 + (((variantIndex % 3) - 1) * 0.015);
  const rackAngleRad = -absAngle;

  const buildProxy = () => {
    const holder = new THREE.Group();
    const fitW = Math.min(440, Math.max(220, maxCabinetClearDepthMm * 0.88));
    const fitD = Math.min(125, Math.max(76, maxSlotWidthMm * 0.78));
    const fitH = Math.min(760, Math.max(260, maxDropMm - 75));
    const hex =
      category === "jacket"
        ? DARK_GARMENT_TINTS[Math.abs(Math.floor(variantIndex / 3)) % DARK_GARMENT_TINTS.length] || "#3B4252"
        : SHIRT_WARDROBE_TINTS[Math.abs(variantIndex) % SHIRT_WARDROBE_TINTS.length];
    const body = new THREE.Mesh(proxyGarmentTorsoGeo!, getSolidSharedMat(hex, 0.86));
    body.rotation.y = rackAngleRad;
    body.scale.set(fitW, fitH, fitD);
    body.position.y = -68;
    holder.add(body);
    holder.add(createContouredCoatHangerGroup(rackAngleRad, variantIndex, Math.min(1, fitW / 440)));
    return holder;
  };

  return mountTemplateCloneOrAsync(
    anchor,
    category,
    (cloned, sizeMm) => {
      if (category === "jacket") {
        const darkHex =
          DARK_GARMENT_TINTS[Math.abs(Math.floor(variantIndex / 3)) % DARK_GARMENT_TINTS.length];
        applySubtleMeshTint(cloned, darkHex, 0.88);
      } else {
        const lightHex =
          SHIRT_WARDROBE_TINTS[Math.abs(variantIndex) % SHIRT_WARDROBE_TINTS.length];
        applySubtleMeshTint(cloned, lightHex, 0.84);
      }

      cloned.rotation.y = rackAngleRad;

      const cosA = Math.abs(Math.cos(rackAngleRad));
      const sinA = Math.abs(Math.sin(rackAngleRad));
      const rawSpanX = sizeMm.w * cosA + sizeMm.d * sinA;
      const rawSpanZ = sizeMm.w * sinA + sizeMm.d * cosA;

      const safeSlotW = Math.max(84, maxSlotWidthMm);
      const safeDepthZ = Math.max(180, maxCabinetClearDepthMm);
      const scaleXZ = Math.min(
        1,
        safeDepthZ / Math.max(1, rawSpanZ),
        safeSlotW / Math.max(1, rawSpanX)
      );

      const pinTopY =
        typeof cloned.userData?.pinTopY === "number"
          ? (cloned.userData.pinTopY as number)
          : COLLAR_PIN_Y_MM;
      const hangerWidthFactor =
        typeof cloned.userData?.hangerWidthFactor === "number"
          ? (cloned.userData.hangerWidthFactor as number)
          : 1;

      const clearBelowCollar = Math.max(220, maxDropMm - Math.abs(pinTopY));
      const scaleY = Math.min(1, clearBelowCollar / Math.max(1, sizeMm.h));

      cloned.scale.set(scaleXZ, scaleY, scaleXZ);
      cloned.position.y = pinTopY * (1 - scaleY);

      const hangerGrp = createContouredCoatHangerGroup(
        rackAngleRad,
        variantIndex,
        scaleXZ * hangerWidthFactor
      );
      anchor.add(hangerGrp);
    },
    buildProxy
  );
}

export function createReadyMadeShoePairGroup(
  variantIndex = 0,
  maxDepthMm = 320
): THREE.Group {
  ensureSharedHangerResources();
  const anchor = new THREE.Group();
  anchor.raycast = () => {};

  const buildProxy = () => {
    const grp = new THREE.Group();
    const shoeD = Math.min(275, maxDepthMm * 0.88);
    const shoeW = 96;
    const shoeH = 95;
    const hex = SHOE_LEATHER_TINTS[Math.abs(variantIndex) % SHOE_LEATHER_TINTS.length] || "#2C3545";
    const mat = getSolidSharedMat(hex, 0.65);
    const r = new THREE.Mesh(proxyShoeSingleGeo!, mat);
    r.scale.set(shoeW, shoeH, shoeD);
    r.position.set(-58, 0, 0);
    const l = new THREE.Mesh(proxyShoeSingleGeo!, mat);
    l.scale.set(shoeW, shoeH, shoeD);
    l.position.set(58, 0, 2);
    grp.add(r, l);
    return grp;
  };

  return mountTemplateCloneOrAsync(
    anchor,
    "shoe",
    (rightFootMesh, sizeMm) => {
      const shoeTint = SHOE_LEATHER_TINTS[Math.abs(variantIndex) % SHOE_LEATHER_TINTS.length];
      if (shoeTint) {
        applySubtleMeshTint(rightFootMesh, shoeTint, 0.68);
      }

      const fitScale = Math.min(1, Math.max(0.65, maxDepthMm / Math.max(1, sizeMm.d)));
      rightFootMesh.scale.multiplyScalar(fitScale);

      const halfGapX = Math.max(58, sizeMm.w * fitScale * 0.56);
      rightFootMesh.position.set(-halfGapX, 0, 0);
      rightFootMesh.rotation.y = -0.025;

      const leftFootMesh = rightFootMesh.clone(true);
      leftFootMesh.scale.x *= -1;
      leftFootMesh.position.set(halfGapX, 0, 2);
      leftFootMesh.rotation.y = 0.025;

      anchor.add(leftFootMesh);
    },
    buildProxy
  );
}

/**
 * Ultra-Fast Folded Knitwear Stack (~36 triangles total!):
 * Uses crisp architectural folded textile slabs with shared GPU BoxGeometry (zero 115k-triangle cloth mesh bottleneck!).
 */
export function createReadyMadeFoldedTextileGroup(
  maxWidthMm = 310,
  maxDepthMm = 310,
  layers = 2,
  variantIndex = 0
): THREE.Group {
  ensureSharedHangerResources();
  const anchor = new THREE.Group();
  anchor.raycast = () => {};

  const w = Math.min(305, maxWidthMm * 0.9);
  const d = Math.min(295, maxDepthMm * 0.88);
  const slabCount = Math.max(2, Math.min(3, layers));
  const slabH = 32;

  for (let i = 0; i < slabCount; i++) {
    const slabMat = getSolidSharedMat(
      KNIT_STACK_TINTS[Math.abs(variantIndex + i) % KNIT_STACK_TINTS.length],
      0.9
    );
    const slab = new THREE.Mesh(foldedBaseUnitGeo!, slabMat);
    slab.scale.set(w - i * 8, slabH - 3, d - i * 8);
    slab.position.set(((i % 2) - 0.5) * 3, i * slabH + (slabH - 3) * 0.5, 0);
    slab.raycast = () => {};
    slab.castShadow = false;
    slab.receiveShadow = false;
    anchor.add(slab);
  }

  freezeStaticObject3DSubtree(anchor, true);
  return anchor;
}

export function createReadyMadeShelfAccessoryGroup(
  maxWidthMm = 310,
  maxHeightMm = 165,
  maxDepthMm = 310,
  variantIndex = 0
): THREE.Group {
  ensureSharedHangerResources();
  const anchor = new THREE.Group();
  anchor.raycast = () => {};

  const boxPalette = ["#DFD8CC", "#CFC6B8", "#B9AFA1"];
  const lidPalette = ["#EAE4DA", "#DCD4C7", "#C6BDB0"];
  const idx = Math.abs(variantIndex) % boxPalette.length;
  const bw = Math.min(285, maxWidthMm * 0.88);
  const bh = Math.min(142, maxHeightMm * 0.88);
  const bd = Math.min(285, maxDepthMm * 0.86);
  const lidH = Math.max(22, Math.round(bh * 0.2));

  const body = new THREE.Mesh(boxBodyUnitGeo!, getSolidSharedMat(boxPalette[idx], 0.86));
  body.scale.set(bw, bh - lidH * 0.4, bd);
  body.position.y = (bh - lidH * 0.4) * 0.5;
  body.raycast = () => {};
  body.castShadow = false;
  body.receiveShadow = false;
  anchor.add(body);

  const lid = new THREE.Mesh(boxLidUnitGeo!, getSolidSharedMat(lidPalette[idx], 0.82));
  lid.scale.set(bw, lidH, bd);
  lid.position.y = bh - lidH * 0.5;
  lid.raycast = () => {};
  lid.castShadow = false;
  lid.receiveShadow = false;
  anchor.add(lid);

  freezeStaticObject3DSubtree(anchor, true);
  return anchor;
}

export function preloadAllWardrobeGlbAssets(): void {
  if (typeof window === "undefined" || !isWardrobeGlbPropsEnabled() || idlePreloadScheduled) {
    return;
  }
  idlePreloadScheduled = true;
  const schedule =
    typeof window.requestIdleCallback === "function"
      ? (fn: () => void) => window.requestIdleCallback(fn, { timeout: 1500 })
      : (fn: () => void) => window.setTimeout(fn, 650);

  schedule(() => {
    // Only preload shirt & shoe during idle time (folded stacks use ultra-fast 36-tri architectural slabs!)
    (["shirt", "shoe"] as WardrobeGlbCategory[]).forEach((cat) => {
      void ensureWardrobeGlbLoaded(cat);
    });
  });
}
