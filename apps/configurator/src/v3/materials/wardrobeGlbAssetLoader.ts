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
 * Curated Ready-Made 3D .GLB Asset Catalog from verified open 3D repositories
 * (Khronos Group glTF-Sample-Assets & open GitHub glTF/GLB 3D scan/sculpt repositories).
 * Zero hand-drawn procedural clothing or footwear geometry is generated.
 */
export const DEFAULT_WARDROBE_GLB_CATALOG: Record<
  WardrobeGlbCategory,
  WardrobeGlbCatalogEntry
> = {
  jacket: {
    category: "jacket",
    label: "Askılı Ceket / Dış Giyim (.GLB)",
    localOverridePath: "/models/wardrobe/jacket.glb",
    remoteUrl:
      "https://raw.githubusercontent.com/faizan8684/PowerAppsMR/master/jacket.glb",
    sourceTitle: "GitHub — PowerAppsMR (jacket.glb)",
    sourceUrl: "https://github.com/faizan8684/PowerAppsMR/blob/master/jacket.glb",
    targetMm: { w: 485, h: 830, d: 235 },
    anchor: "top",
  },
  shirt: {
    category: "shirt",
    label: "Askılı Gömlek / Üst Giyim (UV-Baked .GLB)",
    localOverridePath: "/models/wardrobe/shirt.glb",
    remoteUrl:
      "https://raw.githubusercontent.com/adrianhajdin/project_threejs_ai/main/client/public/shirt_baked.glb",
    sourceTitle: "GitHub — Three.js Baked Shirt (shirt_baked.glb)",
    sourceUrl:
      "https://github.com/adrianhajdin/project_threejs_ai/blob/main/client/public/shirt_baked.glb",
    targetMm: { w: 455, h: 750, d: 195 },
    anchor: "top",
  },
  shoe: {
    category: "shoe",
    label: "3D Taranmış Deri/Süet Ayakkabı (Khronos .GLB)",
    localOverridePath: "/models/wardrobe/shoe.glb",
    remoteUrl:
      "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/MaterialsVariantsShoe/glTF-Binary/MaterialsVariantsShoe.glb",
    sourceTitle: "Khronos Group glTF-Sample-Assets — MaterialsVariantsShoe",
    sourceUrl:
      "https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/MaterialsVariantsShoe",
    targetMm: { w: 112, h: 114, d: 285 },
    anchor: "bottom",
  },
  folded_cloth: {
    category: "folded_cloth",
    label: "Katlı Tekstil / Keten Kumaş (Khronos SheenCloth .GLB)",
    localOverridePath: "/models/wardrobe/folded_cloth.glb",
    remoteUrl: "/models/wardrobe/folded_cloth.glb",
    sourceTitle: "Khronos Group glTF-Sample-Assets — SheenCloth",
    sourceUrl:
      "https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/SheenCloth",
    targetMm: { w: 265, h: 92, d: 275 },
    anchor: "bottom",
  },
  silk_pouf: {
    category: "silk_pouf",
    label: "İpek / Deri Organizer & Çanta Pufu (Khronos .GLB)",
    localOverridePath: "/models/wardrobe/silk_pouf.glb",
    remoteUrl:
      "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/SpecularSilkPouf/glTF-Binary/SpecularSilkPouf.glb",
    sourceTitle: "Khronos Group glTF-Sample-Assets — SpecularSilkPouf",
    sourceUrl:
      "https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/SpecularSilkPouf",
    targetMm: { w: 255, h: 134, d: 255 },
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
    targetMm: { w: 152, h: 52, d: 148 },
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
    targetMm: { w: 88, h: 58, d: 96 },
    anchor: "bottom",
  },
};

const STORAGE_KEY_URLS = "birim_v62_custom_wardrobe_glb_urls";
const STORAGE_KEY_ENABLED = "birim_v62_wardrobe_glb_enabled";

let sharedGltfLoader: GLTFLoader | null = null;
const normalizedTemplateCache = new Map<WardrobeGlbCategory, THREE.Group>();
const inFlightLoads = new Map<WardrobeGlbCategory, Promise<THREE.Group | null>>();
const customBlobUrls = new Map<WardrobeGlbCategory, { url: string; fileName: string }>();
const customRemoteUrls = new Map<WardrobeGlbCategory, string>();
const loadErrorMap = new Map<WardrobeGlbCategory, string>();
const shirtTintMaterialCache = new Map<string, THREE.Material>();

let propsEnabledState = true;
let hydratedFromStorage = false;

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
        if (typeof u === "string" && u.trim().length > 4) {
          customRemoteUrls.set(cat, u.trim());
        }
      });
    }
  } catch {
    // Ignore storage restriction errors in sandboxed iframes
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

const TEXTURE_SLOTS_TO_PROTECT = [
  "map",
  "normalMap",
  "roughnessMap",
  "metalnessMap",
  "aoMap",
  "emissiveMap",
  "alphaMap",
  "bumpMap",
  "sheenColorMap",
  "sheenRoughnessMap",
  "specularMap",
  "specularColorMap",
  "specularIntensityMap",
  "transmissionMap",
  "thicknessMap",
] as const;

function protectSharedGltfResources(root: THREE.Object3D): void {
  root.traverse((obj) => {
    obj.raycast = () => {};
    if (obj instanceof THREE.Mesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
      if (obj.geometry) {
        markSharedGeometry(obj.geometry);
      }
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((mat) => {
        if (!mat) return;
        markSharedMaterial(mat);
        const rec = mat as unknown as Record<string, unknown>;
        TEXTURE_SLOTS_TO_PROTECT.forEach((slot) => {
          const tex = rec[slot];
          if (tex instanceof THREE.Texture) {
            markSharedTexture(tex);
          }
        });
      });
    }
  });
}

/**
 * Relaxes character A-pose sleeves on loaded garment meshes so they hang naturally
 * downward under gravity on a wardrobe coat hanger, and opens high back collars
 * so the wooden coat hanger crown & chrome hook sit visibly inside the collar.
 */
function relaxGarmentSleevesForHangerDrape(
  rawScene: THREE.Group,
  category: WardrobeGlbCategory
): void {
  if (category !== "jacket" && category !== "shirt") return;

  rawScene.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh) || !(obj.geometry instanceof THREE.BufferGeometry)) {
      return;
    }
    const posAttr = obj.geometry.attributes.position;
    if (!posAttr || posAttr.count === 0) return;

    const clonedGeo = obj.geometry.clone();
    const pos = clonedGeo.attributes.position;

    if (category === "jacket") {
      // In jacket.glb, torso is |x| <= 0.24, y in [-0.53, +0.53]; sleeves extend out to |x| = 1.0 in A-pose.
      const pivotAbsX = 0.23;
      const pivotY = 0.26;
      const maxDropRad = 0.74; // ~42.5 deg downward sleeve drape

      for (let i = 0; i < pos.count; i++) {
        let vx = pos.getX(i);
        let vy = pos.getY(i);
        const vz = pos.getZ(i);
        const absX = Math.abs(vx);

        // Gently lower high stand-up back collar so wooden hanger crown & hook are clearly visible
        if (absX < 0.22 && vy > 0.35) {
          vy = 0.35 + (vy - 0.35) * 0.42;
        }

        if (absX > pivotAbsX) {
          const signX = vx >= 0 ? 1 : -1;
          const t = Math.min(1, (absX - pivotAbsX) / 0.16);
          const smoothT = t * t * (3 - 2 * t);
          const theta = smoothT * maxDropRad;
          const cosT = Math.cos(theta);
          const sinT = Math.sin(theta);

          const dx = absX - pivotAbsX;
          const dy = vy - pivotY;
          const newDx = dx * cosT + dy * sinT;
          const newDy = -dx * sinT + dy * cosT;

          vx = signX * (pivotAbsX + newDx * 0.92);
          vy = pivotY + newDy;
        }

        pos.setXYZ(i, vx, vy, vz);
      }
    } else if (category === "shirt") {
      // In shirt.glb, torso is |x| <= 0.165; short sleeves extend to |x| = 0.275.
      const pivotAbsX = 0.16;
      const pivotY = 0.175;
      const maxDropRad = 0.44; // ~25 deg natural short-sleeve droop over hanger tips

      for (let i = 0; i < pos.count; i++) {
        let vx = pos.getX(i);
        let vy = pos.getY(i);
        const vz = pos.getZ(i);
        const absX = Math.abs(vx);

        if (absX > pivotAbsX) {
          const signX = vx >= 0 ? 1 : -1;
          const t = Math.min(1, (absX - pivotAbsX) / 0.065);
          const smoothT = t * t * (3 - 2 * t);
          const theta = smoothT * maxDropRad;
          const cosT = Math.cos(theta);
          const sinT = Math.sin(theta);

          const dx = absX - pivotAbsX;
          const dy = vy - pivotY;
          const newDx = dx * cosT + dy * sinT;
          const newDy = -dx * sinT + dy * cosT;

          vx = signX * (pivotAbsX + newDx * 0.94);
          vy = pivotY + newDy;
        }

        pos.setXYZ(i, vx, vy, vz);
      }
    }

    pos.needsUpdate = true;
    clonedGeo.computeVertexNormals();
    clonedGeo.computeBoundingBox();
    clonedGeo.computeBoundingSphere();
    obj.geometry = markSharedGeometry(clonedGeo);
  });
}

let cachedHangerWoodMat: THREE.MeshPhysicalMaterial | null = null;
let cachedHangerHookMat: THREE.MeshPhysicalMaterial | null = null;
let cachedHangerHookGeo: THREE.BufferGeometry | null = null;
let cachedHangerFerruleGeo: THREE.BufferGeometry | null = null;
let cachedHangerYokeGeo: THREE.BufferGeometry | null = null;
let cachedHangerCrestGeo: THREE.BufferGeometry | null = null;

function ensureCoatHangerResources(): {
  woodMat: THREE.MeshPhysicalMaterial;
  hookMat: THREE.MeshPhysicalMaterial;
  hookGeo: THREE.BufferGeometry;
  ferruleGeo: THREE.BufferGeometry;
  yokeGeo: THREE.BufferGeometry;
  crestGeo: THREE.BufferGeometry;
} {
  if (!cachedHangerWoodMat) {
    cachedHangerWoodMat = markSharedMaterial(
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color("#B57436"),
        roughness: 0.32,
        metalness: 0.02,
        clearcoat: 0.48,
        clearcoatRoughness: 0.22,
      })
    );
  }
  if (!cachedHangerHookMat) {
    cachedHangerHookMat = markSharedMaterial(
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color("#E2E6EC"),
        roughness: 0.16,
        metalness: 0.95,
        envMapIntensity: 1.5,
      })
    );
  }
  if (!cachedHangerHookGeo) {
    // Swan-neck chrome hook looping around the horizontal X-axis hanging rail at (y=0, z=0)
    const hookCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -40, 0),
      new THREE.Vector3(0, -18, 0),
      new THREE.Vector3(0, -7, -14),
      new THREE.Vector3(0, 10, -15),
      new THREE.Vector3(0, 20, 0),
      new THREE.Vector3(0, 9, 14),
    ]);
    cachedHangerHookGeo = markSharedGeometry(
      new THREE.TubeGeometry(hookCurve, 22, 2.5, 10, false)
    );
  }
  if (!cachedHangerFerruleGeo) {
    const fg = new THREE.CylinderGeometry(5.2, 6.6, 11, 14);
    fg.translate(0, -33, 0);
    cachedHangerFerruleGeo = markSharedGeometry(fg);
  }
  if (!cachedHangerYokeGeo) {
    // Contoured wooden coat-hanger shoulder yoke centered at z=0 so it enters directly into the collar & shoulders
    const yokeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-140, -90, 0),
      new THREE.Vector3(-88, -62, 0),
      new THREE.Vector3(-50, -45, 0),
      new THREE.Vector3(0, -38, 0),
      new THREE.Vector3(50, -45, 0),
      new THREE.Vector3(88, -62, 0),
      new THREE.Vector3(140, -90, 0),
    ]);
    const yg = new THREE.TubeGeometry(yokeCurve, 28, 9.5, 12, false);
    yg.scale(1.0, 1.22, 0.72);
    cachedHangerYokeGeo = markSharedGeometry(yg);
  }
  if (!cachedHangerCrestGeo) {
    // Sculpted wooden neck block at the apex of the hanger
    const cg = new THREE.SphereGeometry(13.5, 16, 12);
    cg.scale(1.65, 1.12, 0.68);
    cg.translate(0, -42, 0);
    cachedHangerCrestGeo = markSharedGeometry(cg);
  }

  return {
    woodMat: cachedHangerWoodMat,
    hookMat: cachedHangerHookMat,
    hookGeo: cachedHangerHookGeo,
    ferruleGeo: cachedHangerFerruleGeo,
    yokeGeo: cachedHangerYokeGeo,
    crestGeo: cachedHangerCrestGeo,
  };
}

function createWardrobeCoatHangerParts(): {
  hookGroup: THREE.Group;
  yokeGroup: THREE.Group;
} {
  const { woodMat, hookMat, hookGeo, ferruleGeo, yokeGeo, crestGeo } =
    ensureCoatHangerResources();

  const hookGroup = new THREE.Group();
  hookGroup.name = "birim_wardrobe_hanger_hook";
  const hookMesh = new THREE.Mesh(hookGeo, hookMat);
  const ferruleMesh = new THREE.Mesh(ferruleGeo, hookMat);
  hookGroup.add(hookMesh, ferruleMesh);
  disableRaycastAndEnableShadows(hookGroup);

  const yokeGroup = new THREE.Group();
  yokeGroup.name = "birim_wardrobe_hanger_yoke";
  const yokeMesh = new THREE.Mesh(yokeGeo, woodMat);
  const crestMesh = new THREE.Mesh(crestGeo, woodMat);
  yokeGroup.add(yokeMesh, crestMesh);
  disableRaycastAndEnableShadows(yokeGroup);

  return { hookGroup, yokeGroup };
}

function normalizeLoadedGlbScene(
  rawScene: THREE.Group,
  entry: WardrobeGlbCatalogEntry
): THREE.Group | null {
  relaxGarmentSleevesForHangerDrape(rawScene, entry.category);
  protectSharedGltfResources(rawScene);
  rawScene.updateMatrixWorld(true);

  const preBox = new THREE.Box3().setFromObject(rawScene);
  if (preBox.isEmpty()) return null;
  const preSize = new THREE.Vector3();
  preBox.getSize(preSize);
  if (preSize.x < 1e-6 || preSize.y < 1e-6 || preSize.z < 1e-6) return null;

  const orientHolder = new THREE.Group();
  orientHolder.add(rawScene);

  // Automatic horizontal orientation normalization:
  // - Shoes: heel-to-toe length must align along Z (facing out of the wardrobe)
  // - Garments (jacket / shirt): shoulder span aligns along X, chest depth along Z
  if (entry.category === "shoe" && preSize.x > preSize.z * 1.18) {
    orientHolder.rotation.y = -Math.PI / 2;
  } else if (
    (entry.category === "jacket" || entry.category === "shirt") &&
    preSize.z > preSize.x * 1.18
  ) {
    orientHolder.rotation.y = Math.PI / 2;
  }

  orientHolder.updateMatrixWorld(true);
  const oBox = new THREE.Box3().setFromObject(orientHolder);
  const oSize = new THREE.Vector3();
  oBox.getSize(oSize);

  if (entry.category === "jacket" || entry.category === "shirt") {
    // Scale garments to exact realistic adult wardrobe proportions so sleeve/chest ratios never shrink garment height
    orientHolder.scale.set(
      entry.targetMm.w / Math.max(1e-5, oSize.x),
      entry.targetMm.h / Math.max(1e-5, oSize.y),
      entry.targetMm.d / Math.max(1e-5, oSize.z)
    );
  } else {
    const uniformScale = Math.min(
      entry.targetMm.w / Math.max(1e-5, oSize.x),
      entry.targetMm.h / Math.max(1e-5, oSize.y),
      entry.targetMm.d / Math.max(1e-5, oSize.z)
    );
    orientHolder.scale.setScalar(uniformScale);
  }
  orientHolder.updateMatrixWorld(true);

  const sBox = new THREE.Box3().setFromObject(orientHolder);
  const sCenter = new THREE.Vector3();
  sBox.getCenter(sCenter);
  const sSize = new THREE.Vector3();
  sBox.getSize(sSize);

  // Center X and Z at 0, and pin Y either on the coat hanger shoulders ("top") or flush on the shelf ("bottom")
  orientHolder.position.x -= sCenter.x;
  orientHolder.position.z -= sCenter.z;
  if (entry.anchor === "top") {
    // Shift garment forward in Z so its actual collar & top shoulder ridge (not front chest bulge) sit at z = 0 on the hanger
    const shoulderRidgeForwardOffsetMm = entry.category === "jacket" ? 36 : 25;
    orientHolder.position.z += shoulderRidgeForwardOffsetMm;
    // Offset garment downward so the wooden coat-hanger crown (y = -38..-52 mm) sits inside the collar
    // while the hanger arms (|x| = 75..148 mm) tuck cleanly inside the garment shoulders
    const hangerCollarOffsetMm = entry.category === "jacket" ? 32 : 38;
    orientHolder.position.y -= sBox.max.y + hangerCollarOffsetMm;
  } else {
    orientHolder.position.y -= sBox.min.y;
  }
  orientHolder.updateMatrixWorld(true);

  const normalizedRoot = new THREE.Group();
  normalizedRoot.name = `birim_glb_template_${entry.category}`;
  normalizedRoot.add(orientHolder);
  normalizedRoot.userData = {
    glbCategory: entry.category,
    sizeMm: { w: sSize.x, h: sSize.y, d: sSize.z },
  };
  return normalizedRoot;
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
    const candidateUrls = activeSource.isCustom
      ? [activeSource.url]
      : Array.from(new Set([entry.localOverridePath, activeSource.url]));

    for (const candidateUrl of candidateUrls) {
      try {
        const gltf: GLTF = await loader.loadAsync(candidateUrl);
        const normalized = normalizeLoadedGlbScene(gltf.scene, entry);
        if (normalized) {
          normalizedTemplateCache.set(category, normalized);
          loadErrorMap.delete(category);
          notifyCatalogSubscribers();
          notifyRenderSubscribers();
          return normalized;
        }
      } catch (err) {
        loadErrorMap.set(
          category,
          err instanceof Error ? err.message : "GLB model yüklenemedi"
        );
      }
    }
    notifyCatalogSubscribers();
    return null;
  })().finally(() => {
    inFlightLoads.delete(category);
  });

  inFlightLoads.set(category, loadPromise);
  return loadPromise;
}

const SHIRT_WARDROBE_TINTS = [
  "#F4F0E8", // Fildişi Poplin
  "#CFD9E3", // Buz Mavisi Oxford
  "#D7CEC1", // Taş Keten
  "#43474D", // Antrasit Merinos
];

function applyShirtWardrobeTint(cloneRoot: THREE.Group, variantIdx: number): void {
  const hex = SHIRT_WARDROBE_TINTS[Math.abs(variantIdx) % SHIRT_WARDROBE_TINTS.length];
  cloneRoot.traverse((obj) => {
    if (obj instanceof THREE.Mesh && obj.material && !Array.isArray(obj.material)) {
      const baseMat = obj.material as THREE.MeshStandardMaterial;
      const cacheKey = `${baseMat.uuid}_${hex}`;
      let tinted = shirtTintMaterialCache.get(cacheKey);
      if (!tinted) {
        const nextMat = baseMat.clone();
        if ("color" in nextMat && nextMat.color instanceof THREE.Color) {
          nextMat.color.set(hex);
        }
        if ("aoMapIntensity" in nextMat) {
          nextMat.aoMapIntensity = 0.28;
        }
        if ("roughness" in nextMat) {
          nextMat.roughness = 0.85;
        }
        tinted = markSharedMaterial(nextMat);
        shirtTintMaterialCache.set(cacheKey, tinted);
      }
      obj.material = tinted;
      obj.castShadow = true;
      obj.receiveShadow = true;
      obj.raycast = () => {};
    }
  });
}

function disableRaycastAndEnableShadows(root: THREE.Object3D): void {
  root.traverse((obj) => {
    obj.raycast = () => {};
    if (obj instanceof THREE.Mesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
}

function mountTemplateCloneOrAsync(
  anchor: THREE.Group,
  category: WardrobeGlbCategory,
  configureClone: (cloned: THREE.Group, sizeMm: { w: number; h: number; d: number }) => void
): THREE.Group {
  if (!isWardrobeGlbPropsEnabled()) {
    return anchor;
  }

  const attachFromTemplate = (tpl: THREE.Group) => {
    const cloned = tpl.clone(true);
    disableRaycastAndEnableShadows(cloned);
    const sizeMm = (tpl.userData?.sizeMm as { w: number; h: number; d: number }) || {
      w: 300,
      h: 300,
      d: 300,
    };
    configureClone(cloned, sizeMm);
    anchor.add(cloned);
  };

  const cached = normalizedTemplateCache.get(category);
  if (cached) {
    attachFromTemplate(cached);
    return anchor;
  }

  void ensureWardrobeGlbLoaded(category).then((tpl) => {
    if (!tpl || !anchor.parent) return;
    attachFromTemplate(tpl);
    notifyRenderSubscribers();
  });

  return anchor;
}

/**
 * Ready-Made 3D Hanging Garment (.GLB Jacket & UV-Baked Shirt) on Contoured Wooden Hanger & Chrome Hook.
 * Automatically clamps drop height & cabinet depth so zero parts ever protrude outside the cabinet.
 */
export function createReadyMadeHangingGarmentGroup(
  variantIndex: number,
  maxDropMm = 880,
  maxCabinetClearDepthMm = 520
): THREE.Group {
  const anchor = new THREE.Group();
  anchor.raycast = () => {};
  // Alternate between real 3D Jacket (.glb) and real 3D UV-Baked Shirt (.glb)
  const category: WardrobeGlbCategory = variantIndex % 3 === 0 ? "jacket" : "shirt";

  return mountTemplateCloneOrAsync(anchor, category, (cloned, sizeMm) => {
    if (category === "shirt") {
      applyShirtWardrobeTint(cloned, variantIndex);
    }
    // Natural 3/4 boutique rack angle (~56 deg) so wooden hanger & shoulders are visible and fit inside cabinet depth
    const rackAngleRad = -Math.PI * 0.31 + ((variantIndex % 3) - 1) * 0.04;

    const { hookGroup, yokeGroup } = createWardrobeCoatHangerParts();
    anchor.add(hookGroup);

    yokeGroup.rotation.y = rackAngleRad;
    cloned.rotation.y = rackAngleRad;

    const cosA = Math.abs(Math.cos(rackAngleRad));
    const sinA = Math.abs(Math.sin(rackAngleRad));
    // Rounded shoulders & tapered sleeves occupy ~72% of rectangular bounding-box corner projection
    const effectiveDepth = sizeMm.w * sinA * 0.72 + sizeMm.d * cosA * 0.74;
    const depthClamp =
      effectiveDepth > maxCabinetClearDepthMm
        ? maxCabinetClearDepthMm / Math.max(1, effectiveDepth)
        : 1;
    const totalDropH = sizeMm.h + 58;
    const heightClamp =
      totalDropH > maxDropMm ? maxDropMm / Math.max(1, totalDropH) : 1;
    const fitScale = Math.min(1, depthClamp, heightClamp);
    if (fitScale < 0.999) {
      cloned.scale.multiplyScalar(fitScale);
      yokeGroup.scale.multiplyScalar(fitScale);
    }

    anchor.add(yokeGroup);
  });
}

/**
 * Ready-Made 3D Scanned Footwear Pair (Khronos MaterialsVariantsShoe.glb — Right + Mirrored Left).
 */
export function createReadyMadeShoePairGroup(variantIndex = 0): THREE.Group {
  const anchor = new THREE.Group();
  anchor.raycast = () => {};

  return mountTemplateCloneOrAsync(anchor, "shoe", (baseShoe, sizeMm) => {
    const halfGapX = Math.max(56, sizeMm.w * 0.54);
    // After rotation.y = -PI/2, baseShoe has its medial (big-toe) arch on +X, so it belongs at -halfGapX
    baseShoe.position.set(-halfGapX, 0, 0);
    baseShoe.rotation.y = 0.03;

    const mirroredShoe = baseShoe.clone(true);
    disableRaycastAndEnableShadows(mirroredShoe);
    mirroredShoe.scale.x *= -1;
    mirroredShoe.position.set(halfGapX, 0, 3);
    mirroredShoe.rotation.y = -0.035;

    if (variantIndex % 2 === 1) {
      anchor.rotation.y = 0.025;
    }
    anchor.add(mirroredShoe);
  });
}

/**
 * Ready-Made 3D Folded Fabric / Textile Stack (Khronos SheenCloth.glb).
 */
export function createReadyMadeFoldedTextileGroup(
  maxWidthMm = 270,
  maxDepthMm = 290,
  _layers = 2,
  variantIndex = 0
): THREE.Group {
  const anchor = new THREE.Group();
  anchor.raycast = () => {};

  return mountTemplateCloneOrAsync(anchor, "folded_cloth", (cloned, sizeMm) => {
    const fitScale = Math.min(
      1.05,
      maxWidthMm / Math.max(1, sizeMm.w),
      maxDepthMm / Math.max(1, sizeMm.d)
    );
    cloned.scale.multiplyScalar(fitScale);
    cloned.rotation.y = (variantIndex % 4) * (Math.PI * 0.5);
  });
}

/**
 * Ready-Made 3D Shelf Organizer / Silk Pouf / Display Accessory (SpecularSilkPouf, SunglassesKhronos, ChronographWatch).
 */
export function createReadyMadeShelfAccessoryGroup(
  maxWidthMm = 280,
  maxHeightMm = 145,
  maxDepthMm = 290,
  variantIndex = 0
): THREE.Group {
  const anchor = new THREE.Group();
  anchor.raycast = () => {};

  const catCycle: WardrobeGlbCategory[] = ["silk_pouf", "sunglasses", "watch"];
  const category =
    maxHeightMm < 95
      ? catCycle[(Math.abs(variantIndex) % 2) + 1]
      : catCycle[Math.abs(variantIndex) % catCycle.length];

  return mountTemplateCloneOrAsync(anchor, category, (cloned, sizeMm) => {
    const fitScale = Math.min(
      1.05,
      maxWidthMm / Math.max(1, sizeMm.w),
      maxHeightMm / Math.max(1, sizeMm.h),
      maxDepthMm / Math.max(1, sizeMm.d)
    );
    cloned.scale.multiplyScalar(fitScale);
    if (category === "sunglasses" || category === "watch") {
      cloned.rotation.y = -0.22 + (variantIndex % 3) * 0.18;
    }
  });
}

/**
 * Prewarms all default ready-made .GLB wardrobe models in the background on browser idle.
 */
export function preloadAllWardrobeGlbAssets(): void {
  if (typeof window === "undefined" || !isWardrobeGlbPropsEnabled()) return;
  (Object.keys(DEFAULT_WARDROBE_GLB_CATALOG) as WardrobeGlbCategory[]).forEach(
    (cat) => {
      void ensureWardrobeGlbLoaded(cat);
    }
  );
}
