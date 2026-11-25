import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import type { SceneObjectInstance } from "@birim/core";
import { resolvePersistentGlbAssetUrl } from "@birim/integrations";
import { markSharedGeometry, markSharedMaterial } from "./webglResourceGuard";
import { decimateHighPolyBufferGeometry } from "./wardrobeGlbAssetLoader";

let sharedSceneGltfLoader: GLTFLoader | null = null;
const glbSceneCache = new Map<string, THREE.Group>();
const glbInFlight = new Map<string, Promise<THREE.Group | null>>();
const sceneObjRenderListeners = new Set<(loadedKey?: string) => void>();

export const BUILTIN_SCENE_OBJECT_GLB_BASE_PATH = "/models/scene-objects";

const BUILTIN_SCENE_OBJECT_IDS = new Set<string>([
  "obj_fridge_french_910",
  "obj_fridge_solo_700",
  "obj_cooktop_ind_600",
  "obj_cooktop_ind_800",
  "obj_oven_builtin_600",
  "obj_microwave_builtin_600",
  "obj_hood_wall_900",
  "obj_hood_island_900",
  "obj_dishwasher_600",
  "obj_washer_dryer_600",
  "obj_wine_cooler_600",
  "obj_sink_undermount_550",
  "obj_bath_vessel_sink",
  "obj_birim_dining_table_1800",
  "obj_birim_dining_chair",
  "obj_birim_bar_stool",
  "obj_birim_modular_sofa_2400",
  "obj_birim_armchair",
  "obj_birim_double_bed_160",
  "obj_birim_ottoman_bench",
  "obj_birim_coffee_table",
  "obj_area_rug_300x200",
  "obj_pendant_linear_1200",
  "obj_espresso_station",
  "obj_arch_door_900",
  "obj_arch_window_1400",
  "obj_arch_radiator_1000",
  "obj_arch_combi_boiler",
  "obj_arch_column_400",
  "obj_decor_olive_tree",
  "obj_plant_monstera_deliciosa",
  "obj_plant_fiddle_leaf_fig",
  "obj_plant_strelitzia_nicolai",
  "obj_plant_sansevieria_snake",
  "obj_plant_zz_countertop",
  "obj_plant_trailing_pothos_shelf",
  "obj_plant_kitchen_herb_trio",
  "obj_decor_full_mirror",
  "obj_decor_framed_art",
]);

export function resolveEffectiveSceneObjectGlbUrl(obj: SceneObjectInstance): string | undefined {
  // Force sleek procedural frameless OLED TV instead of legacy low-res beige-arch GLB
  if (obj.catalogId === "obj_wall_tv_65" || obj.visualKind === "wall_tv_oled") {
    const raw = (obj.glbUrl || "").trim();
    if (raw.startsWith("blob:") || raw.startsWith("data:")) return raw;
    return undefined;
  }
  if (obj.glbUrl && obj.glbUrl.trim().length > 0) {
    return obj.glbUrl.trim();
  }
  if (obj.catalogId && BUILTIN_SCENE_OBJECT_IDS.has(obj.catalogId)) {
    return `${BUILTIN_SCENE_OBJECT_GLB_BASE_PATH}/${obj.catalogId}.glb`;
  }
  return undefined;
}

export function isSceneObjectGlbCached(cacheKey?: string): boolean {
  return Boolean(cacheKey && glbSceneCache.has(cacheKey));
}

export function subscribeSceneObjectGlbLoaded(cb: (loadedKey?: string) => void): () => void {
  sceneObjRenderListeners.add(cb);
  return () => {
    sceneObjRenderListeners.delete(cb);
  };
}

function notifySceneObjLoaded(loadedKey?: string): void {
  sceneObjRenderListeners.forEach((cb) => {
    try {
      cb(loadedKey);
    } catch {
      // ignore
    }
  });
}

export function getUniversalSceneGltfLoader(renderer?: THREE.WebGLRenderer | null): GLTFLoader | null {
  if (typeof window === "undefined") return null;
  if (sharedSceneGltfLoader) return sharedSceneGltfLoader;

  const loader = new GLTFLoader();
  loader.setCrossOrigin("anonymous");

  const draco = new DRACOLoader();
  draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
  loader.setDRACOLoader(draco);

  try {
    const ktx2 = new KTX2Loader();
    ktx2.setTranscoderPath("https://www.gstatic.com/basis-universal/versioned/2021-04-15-ba1c3e4/");
    if (renderer) {
      ktx2.detectSupport(renderer);
    }
    loader.setKTX2Loader(ktx2);
  } catch {
    // Graceful fallback if KTX2 transcoder is offline
  }

  sharedSceneGltfLoader = loader;
  return loader;
}

const SHARED_SCENE_UNIT_BOX = markSharedGeometry(new THREE.BoxGeometry(1, 1, 1));
const SHARED_INVISIBLE_HITBOX_MAT = markSharedMaterial(
  new THREE.MeshBasicMaterial({ visible: false })
);
const sharedSceneMatPool = new Map<string, THREE.MeshStandardMaterial>();
let sharedGlowHaloGeo: THREE.SphereGeometry | null = null;
const sharedGlowHaloMats = new Map<string, THREE.MeshBasicMaterial>();

function getSharedGlowHaloGeo(): THREE.SphereGeometry {
  if (!sharedGlowHaloGeo) {
    sharedGlowHaloGeo = markSharedGeometry(new THREE.SphereGeometry(1, 10, 8));
  }
  return sharedGlowHaloGeo;
}

function getSharedGlowHaloMat(kelvinKey: string, kelvinColor: number): THREE.MeshBasicMaterial {
  let mat = sharedGlowHaloMats.get(kelvinKey);
  if (!mat) {
    mat = markSharedMaterial(
      new THREE.MeshBasicMaterial({
        color: kelvinColor,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    sharedGlowHaloMats.set(kelvinKey, mat);
  }
  return mat;
}

function tagSelectableHierarchy(
  root: THREE.Object3D,
  inner: THREE.Group,
  sceneObjectId: string,
  W: number,
  H: number,
  D: number
): void {
  root.userData = {
    ...root.userData,
    isSceneObject: true,
    sceneObjectId,
  };
  inner.traverse((child) => {
    child.raycast = () => {};
    child.userData = {
      ...child.userData,
      isSceneObject: true,
      sceneObjectId,
    };
    if (child instanceof THREE.Mesh) {
      child.castShadow = false;
      child.receiveShadow = true;
    }
    if (child !== inner) {
      child.updateMatrix();
      child.matrixAutoUpdate = false;
    }
  });
  // Single 12-triangle O(1) proxy hitbox (material.visible=false => 0 WebGL draw calls, instant raycast!)
  const hitProxy = new THREE.Mesh(SHARED_SCENE_UNIT_BOX, SHARED_INVISIBLE_HITBOX_MAT);
  hitProxy.scale.set(Math.max(20, W), Math.max(20, H), Math.max(20, D));
  hitProxy.position.set(W / 2, H / 2, D / 2);
  hitProxy.userData = {
    isSceneObject: true,
    sceneObjectId,
    isSceneObjectHitbox: true,
  };
  inner.add(hitProxy);
}

function makeMat(hex: string, roughness = 0.5, metalness = 0.1, opacity = 1): THREE.MeshStandardMaterial {
  const key = `${hex}_${roughness.toFixed(2)}_${metalness.toFixed(2)}_${opacity.toFixed(2)}`;
  let mat = sharedSceneMatPool.get(key);
  if (!mat) {
    mat = markSharedMaterial(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(hex),
        roughness,
        metalness,
        transparent: opacity < 0.99,
        opacity,
      })
    );
    sharedSceneMatPool.set(key, mat);
  }
  return mat;
}

function addBox(
  parent: THREE.Group,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  mat: THREE.Material
): THREE.Mesh {
  const m = new THREE.Mesh(SHARED_SCENE_UNIT_BOX, mat);
  m.scale.set(Math.max(2, w), Math.max(2, h), Math.max(2, d));
  m.position.set(x, y, z);
  m.raycast = () => {};
  parent.add(m);
  return m;
}

/**
 * Normalizes any MeshPhysicalMaterial inside loaded .GLB assets into single-pass MeshStandardMaterial
 * so external .GLB files never trigger 1.4s D3D11 WebGL shader recompilations.
 */
function normalizeGlbMaterialForFastWebGL(mat: THREE.Material): THREE.Material {
  if (mat instanceof THREE.MeshPhysicalMaterial) {
    const std = markSharedMaterial(
      new THREE.MeshStandardMaterial({
        name: mat.name,
        color: mat.color.clone(),
        map: mat.map,
        normalMap: mat.normalMap,
        roughnessMap: mat.roughnessMap,
        metalnessMap: mat.metalnessMap,
        aoMap: mat.aoMap,
        emissive: mat.emissive.clone(),
        emissiveMap: mat.emissiveMap,
        emissiveIntensity: mat.emissiveIntensity,
        roughness: Math.max(0.05, mat.roughness),
        metalness: mat.metalness,
        transparent: mat.transparent || mat.transmission > 0.15,
        opacity: mat.transmission > 0.15 ? Math.min(mat.opacity, 0.55) : mat.opacity,
        side: mat.side,
      })
    );
    return std;
  }
  markSharedMaterial(mat);
  return mat;
}

export function buildSceneObject3DGroup(
  obj: SceneObjectInstance,
  options?: { isSelected?: boolean; renderer?: THREE.WebGLRenderer | null }
): THREE.Group {
  const scale = obj.scaleFactor || 1;
  const W = Math.max(20, obj.dimensions.width * scale);
  const H = Math.max(8, obj.dimensions.height * scale);
  const D = Math.max(20, obj.dimensions.depth * scale);

  const root = new THREE.Group();
  root.name = `v5_scene_obj_${obj.id}`;
  root.position.set(obj.position.x, obj.position.y, obj.position.z);
  const rotYRad = (((obj.rotation?.y || 0) * Math.PI) / 180);
  const pivot = new THREE.Group();
  pivot.position.set(W / 2, 0, D / 2);
  pivot.rotation.y = rotYRad;
  const inner = new THREE.Group();
  inner.position.set(-W / 2, 0, -D / 2);
  pivot.add(inner);
  root.add(pivot);

  const priHex = obj.primaryColorHex || "#CBD5E1";
  const secHex = obj.secondaryColorHex || "#1E293B";
  const priMat = makeMat(priHex, obj.roughness ?? 0.35, obj.metalness ?? 0.45);
  const secMat = makeMat(secHex, 0.3, 0.5);
  const chromeMat = makeMat("#E2E8F0", 0.16, 0.92);
  const glassDarkMat = makeMat("#0F172A", 0.08, 0.25, 0.84);

  const effectiveGlbUrl = resolveEffectiveSceneObjectGlbUrl(obj);
  const preserveCountertopDatum =
    obj.anchorMode === "countertop_cutout" && obj.visualKind !== "sink_vessel_bath";
  const allowAxisStretch = Boolean(obj.catalogId && BUILTIN_SCENE_OBJECT_IDS.has(obj.catalogId));

  if (effectiveGlbUrl || obj.localAssetKey) {
    const cacheKey = obj.localAssetKey || effectiveGlbUrl || obj.id;
    const cached = glbSceneCache.get(cacheKey);
    if (cached) {
      const clone = cached.clone(true);
      fitArbitraryGlbIntoBox(clone, W, H, D, preserveCountertopDatum, allowAxisStretch);
      inner.add(clone);
    } else {
      // Render detailed architectural fallback immediately until async .GLB resolves from public/models/scene-objects
      buildProceduralVisualByKind(inner, obj, W, H, D, priMat, secMat, chromeMat, glassDarkMat);
      void loadCustomSceneGlbAsync(cacheKey, effectiveGlbUrl, obj.localAssetKey, options?.renderer)
        .then((tpl) => {
          if (tpl) notifySceneObjLoaded(cacheKey);
        })
        .catch(() => {
          // Graceful procedural fallback already rendered
        });
    }
  } else {
    buildProceduralVisualByKind(inner, obj, W, H, D, priMat, secMat, chromeMat, glassDarkMat);
  }

  if (obj.lightEmission?.enabled) {
    const kelvinKey =
      obj.lightEmission.colorTempK === 2700
        ? "2700"
        : obj.lightEmission.colorTempK === 4000
        ? "4000"
        : "3000";
    const kelvinColor =
      kelvinKey === "2700" ? 0xffd299 : kelvinKey === "4000" ? 0xf4f8ff : 0xffe3b8;
    const haloRadius = Math.min(90, Math.max(36, Math.min(W, D) * 0.18));
    const glowHalo = new THREE.Mesh(
      getSharedGlowHaloGeo(),
      getSharedGlowHaloMat(kelvinKey, kelvinColor)
    );
    glowHalo.scale.setScalar(haloRadius);
    glowHalo.raycast = () => {};
    glowHalo.position.set(W / 2, Math.max(40, H * 0.18), D / 2);
    inner.add(glowHalo);
  }

  if (options?.isSelected) {
    const selGeo = new THREE.BoxGeometry(W + 12, H + 12, D + 12);
    const edges = new THREE.EdgesGeometry(selGeo);
    selGeo.dispose();
    const selLines = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x2563eb })
    );
    selLines.position.set(W / 2, H / 2, D / 2);
    selLines.raycast = () => {};
    inner.add(selLines);

    if (obj.clearance?.frontSwingMm && obj.clearance.frontSwingMm > 50) {
      const sw = obj.clearance.frontSwingMm;
      const zoneGeo = new THREE.PlaneGeometry(W, sw);
      const zoneMesh = new THREE.Mesh(
        zoneGeo,
        new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.18,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      zoneMesh.rotation.x = -Math.PI / 2;
      zoneMesh.position.set(W / 2, 4, D + sw / 2);
      zoneMesh.raycast = () => {};
      inner.add(zoneMesh);
    }
  }

  tagSelectableHierarchy(root, inner, obj.id, W, H, D);
  return root;
}

function fitArbitraryGlbIntoBox(
  model: THREE.Group,
  targetW: number,
  targetH: number,
  targetD: number,
  preserveCountertopDatum = false,
  allowAxisStretch = false
): void {
  model.position.set(0, 0, 0);
  model.scale.set(1, 1, 1);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  if (box.isEmpty()) return;
  const size = new THREE.Vector3();
  box.getSize(size);

  const sx = targetW / Math.max(1e-4, size.x);
  const sy = targetH / Math.max(1e-4, size.y);
  const sz = targetD / Math.max(1e-4, size.z);

  if (allowAxisStretch) {
    model.scale.set(sx, sy, sz);
  } else {
    const s = Math.min(sx, sy, sz);
    model.scale.multiplyScalar(s);
  }

  model.updateMatrixWorld(true);
  const scaledBox = new THREE.Box3().setFromObject(model);
  const center = new THREE.Vector3();
  scaledBox.getCenter(center);
  model.position.x += targetW / 2 - center.x;
  model.position.z += targetD / 2 - center.z;

  // Recessed undermount sinks & induction cooktops author y=0 at countertop plane (with basin/chassis at y < 0)
  if (preserveCountertopDatum && scaledBox.min.y < -2) {
    model.position.y = 0;
  } else {
    model.position.y += -scaledBox.min.y;
  }
}

async function loadCustomSceneGlbAsync(
  cacheKey: string,
  glbUrl?: string,
  localAssetKey?: string,
  renderer?: THREE.WebGLRenderer | null
): Promise<THREE.Group | null> {
  if (glbSceneCache.has(cacheKey)) return glbSceneCache.get(cacheKey)!;
  if (glbInFlight.has(cacheKey)) return glbInFlight.get(cacheKey)!;

  const loader = getUniversalSceneGltfLoader(renderer);
  if (!loader) return null;

  const task = (async () => {
    try {
      let resolvedUrl = glbUrl || "";
      if (localAssetKey) {
        const persisted = await resolvePersistentGlbAssetUrl(localAssetKey);
        if (persisted) resolvedUrl = persisted;
      }
      if (!resolvedUrl) return null;
      const gltf: GLTF = await loader.loadAsync(resolvedUrl);
      gltf.scene.traverse((child) => {
        child.raycast = () => {};
        if (child instanceof THREE.Mesh && child.geometry) {
          const idx = child.geometry.index;
          const pos = child.geometry.attributes.position;
          const triCount = idx ? Math.floor(idx.count / 3) : pos ? Math.floor(pos.count / 3) : 0;
          // Only decimate ultra-dense >25,000-triangle raw photogrammetry scans; preserve studio CAD GLBs intact!
          if (triCount > 25000) {
            child.geometry = decimateHighPolyBufferGeometry(child.geometry, 96);
          }
          markSharedGeometry(child.geometry);
          if (Array.isArray(child.material)) {
            child.material = child.material.map(normalizeGlbMaterialForFastWebGL);
          } else if (child.material) {
            child.material = normalizeGlbMaterialForFastWebGL(child.material);
          }
          child.castShadow = false;
          child.receiveShadow = true;
        }
      });
      glbSceneCache.set(cacheKey, gltf.scene);
      return gltf.scene;
    } catch {
      return null;
    } finally {
      glbInFlight.delete(cacheKey);
    }
  })();

  glbInFlight.set(cacheKey, task);
  return task;
}

function buildProceduralVisualByKind(
  g: THREE.Group,
  obj: SceneObjectInstance,
  W: number,
  H: number,
  D: number,
  priMat: THREE.Material,
  secMat: THREE.Material,
  chromeMat: THREE.Material,
  glassDarkMat: THREE.Material
): void {
  switch (obj.visualKind) {
    case "fridge_french_door": {
      addBox(g, W, H, D - 45, W / 2, H / 2, (D - 45) / 2, secMat);
      const freezerH = H * 0.34;
      const upperH = H - freezerH - 18;
      const doorW = (W - 10) / 2;
      addBox(g, doorW, upperH, 40, doorW / 2 + 2, freezerH + 14 + upperH / 2, D - 20, priMat);
      addBox(g, doorW, upperH, 40, W - doorW / 2 - 2, freezerH + 14 + upperH / 2, D - 20, priMat);
      addBox(g, W - 4, freezerH - 6, 40, W / 2, freezerH / 2, D - 20, priMat);
      addBox(g, 14, upperH * 0.62, 24, W / 2 - 26, freezerH + upperH * 0.5, D + 8, chromeMat);
      addBox(g, 14, upperH * 0.62, 24, W / 2 + 26, freezerH + upperH * 0.5, D + 8, chromeMat);
      addBox(g, W * 0.72, 14, 24, W / 2, freezerH - 48, D + 8, chromeMat);
      addBox(g, 160, 230, 8, doorW * 0.5, freezerH + upperH * 0.45, D + 1, glassDarkMat);
      break;
    }

    case "fridge_single":
    case "dishwasher":
    case "wine_cooler": {
      addBox(g, W, H, D - 30, W / 2, H / 2, (D - 30) / 2, secMat);
      addBox(g, W - 4, H - 8, 28, W / 2, H / 2, D - 14, priMat);
      if (obj.visualKind === "wine_cooler") {
        addBox(g, W - 90, H - 110, 30, W / 2, H / 2, D - 13, glassDarkMat);
        for (let i = 1; i <= 4; i++) {
          addBox(g, W - 110, 16, D - 90, W / 2, (H * i) / 5, D / 2, secMat);
        }
      }
      addBox(g, W * 0.68, 14, 22, W / 2, H - 55, D + 8, chromeMat);
      break;
    }

    case "oven_builtin":
    case "microwave_builtin": {
      addBox(g, W, H, D - 22, W / 2, H / 2, (D - 22) / 2, secMat);
      addBox(g, W, H - 4, 22, W / 2, H / 2, D - 11, glassDarkMat);
      const fasciaH = Math.min(95, H * 0.2);
      addBox(g, W - 4, fasciaH, 24, W / 2, H - fasciaH / 2 - 2, D - 10, priMat);
      addBox(g, W * 0.78, 16, 28, W / 2, H - fasciaH - 26, D + 10, chromeMat);
      break;
    }

    case "cooktop_induction": {
      addBox(g, W, 10, D, W / 2, 5, D / 2, glassDarkMat);
      addBox(g, W - 50, Math.max(20, H - 10), D - 50, W / 2, -(H - 10) / 2, D / 2, secMat);
      const ringMat = makeMat("#64748B", 0.25, 0.6);
      const offsets = [
        [W * 0.27, D * 0.3],
        [W * 0.73, D * 0.3],
        [W * 0.27, D * 0.72],
        [W * 0.73, D * 0.72],
      ];
      offsets.forEach(([rx, rz], idx) => {
        const r = idx % 2 === 0 ? Math.min(95, W * 0.14) : Math.min(80, W * 0.11);
        const cyl = new THREE.Mesh(
          markSharedGeometry(new THREE.RingGeometry(r * 0.86, r, 28)),
          ringMat
        );
        cyl.rotation.x = -Math.PI / 2;
        cyl.position.set(rx, 10.8, rz);
        g.add(cyl);
      });
      break;
    }

    case "sink_undermount_faucet":
    case "sink_vessel_bath": {
      const rimT = 28;
      const basinH = Math.min(180, H * 0.45);
      addBox(g, W, 10, rimT, W / 2, 5, rimT / 2, priMat);
      addBox(g, W, 10, rimT, W / 2, 5, D - rimT / 2, priMat);
      addBox(g, rimT, 10, D, rimT / 2, 5, D / 2, priMat);
      addBox(g, rimT, 10, D, W - rimT / 2, 5, D / 2, priMat);
      addBox(g, W - rimT * 2, 8, D - rimT * 2, W / 2, -basinH * 0.5, D / 2, secMat);
      const stemH = Math.max(180, H - basinH);
      const stem = new THREE.Mesh(
        markSharedGeometry(new THREE.CylinderGeometry(14, 16, stemH, 16)),
        chromeMat
      );
      stem.position.set(W / 2, stemH / 2, 42);
      g.add(stem);
      const spout = new THREE.Mesh(
        markSharedGeometry(new THREE.TorusGeometry(75, 11, 12, 24, Math.PI)),
        chromeMat
      );
      spout.rotation.y = Math.PI / 2;
      spout.position.set(W / 2, stemH, 117);
      g.add(spout);
      break;
    }

    case "hood_wall_chimney":
    case "hood_island": {
      const canopyH = Math.min(75, H * 0.12);
      addBox(g, W, canopyH, D, W / 2, canopyH / 2, D / 2, priMat);
      const chimW = Math.min(310, W * 0.36);
      const chimD = Math.min(280, D * 0.55);
      addBox(
        g,
        chimW,
        H - canopyH,
        chimD,
        W / 2,
        canopyH + (H - canopyH) / 2,
        obj.visualKind === "hood_island" ? D / 2 : chimD / 2,
        secMat
      );
      break;
    }

    case "washer_dryer": {
      addBox(g, W, H, D - 18, W / 2, H / 2, (D - 18) / 2, priMat);
      const ring = new THREE.Mesh(
        markSharedGeometry(new THREE.TorusGeometry(Math.min(185, W * 0.3), 24, 14, 32)),
        secMat
      );
      ring.position.set(W / 2, H * 0.44, D - 10);
      g.add(ring);
      break;
    }

    case "espresso_machine": {
      addBox(g, W * 0.62, H * 0.86, D * 0.85, W * 0.34, H * 0.43, D * 0.48, priMat);
      addBox(g, W * 0.30, H * 0.64, D * 0.58, W * 0.82, H * 0.32, D * 0.48, secMat);
      const hopper = new THREE.Mesh(
        markSharedGeometry(new THREE.CylinderGeometry(52, 32, H * 0.34, 18)),
        glassDarkMat
      );
      hopper.position.set(W * 0.82, H * 0.82, D * 0.48);
      g.add(hopper);
      break;
    }

    case "dining_table_oak":
    case "coffee_table": {
      const topT = obj.visualKind === "coffee_table" ? 38 : 36;
      addBox(g, W, topT, D, W / 2, H - topT / 2, D / 2, priMat);
      const legW = obj.visualKind === "coffee_table" ? 160 : 56;
      addBox(g, legW, H - topT, legW, W * 0.22, (H - topT) / 2, D / 2, secMat);
      addBox(g, legW, H - topT, legW, W * 0.78, (H - topT) / 2, D / 2, secMat);
      break;
    }

    case "dining_chair":
    case "bar_stool": {
      const seatY = obj.visualKind === "bar_stool" ? H * 0.82 : H * 0.56;
      addBox(g, W - 40, 56, D - 50, W / 2, seatY, D / 2, priMat);
      addBox(g, W - 50, H - seatY, 44, W / 2, seatY + (H - seatY) / 2, 36, priMat);
      for (const lx of [50, W - 50]) {
        for (const lz of [50, D - 50]) {
          addBox(g, 28, seatY, 28, lx, seatY / 2, lz, secMat);
        }
      }
      break;
    }

    case "sofa_modular":
    case "armchair":
    case "ottoman_pouf": {
      if (obj.visualKind === "ottoman_pouf") {
        addBox(g, W - 60, 55, D - 60, W / 2, 28, D / 2, secMat);
        addBox(g, W, H - 55, D, W / 2, 55 + (H - 55) / 2, D / 2, priMat);
      } else {
        const seatH = H * 0.52;
        addBox(g, W, seatH, D, W / 2, seatH / 2, D / 2, priMat);
        addBox(g, W, H - seatH, 180, W / 2, seatH + (H - seatH) / 2, 90, priMat);
        addBox(g, 160, H * 0.75, D, 80, H * 0.375, D / 2, priMat);
        addBox(g, 160, H * 0.75, D, W - 80, H * 0.375, D / 2, priMat);
      }
      break;
    }

    case "bed_double": {
      addBox(g, W, H, 120, W / 2, H / 2, 60, priMat);
      addBox(g, W - 20, 320, D - 120, W / 2, 180, 120 + (D - 120) / 2, secMat);
      addBox(g, W - 90, 220, D - 180, W / 2, 410, 140 + (D - 180) / 2, priMat);
      break;
    }

    case "area_rug": {
      addBox(g, W, Math.max(8, H), D, W / 2, Math.max(4, H / 2), D / 2, priMat);
      break;
    }

    case "door_interior_swing":
    case "window_double_sash":
    case "structural_column":
    case "radiator_panel":
    case "boiler_combi": {
      addBox(g, W, H, D, W / 2, H / 2, D / 2, priMat);
      if (obj.visualKind === "window_double_sash") {
        addBox(g, W * 0.42, H - 130, D + 4, W * 0.27, H / 2, D / 2, glassDarkMat);
        addBox(g, W * 0.42, H - 130, D + 4, W * 0.73, H / 2, D / 2, glassDarkMat);
      } else if (obj.visualKind === "boiler_combi") {
        const flue = new THREE.Mesh(
          markSharedGeometry(new THREE.CylinderGeometry(48, 48, 130, 16)),
          secMat
        );
        flue.position.set(W / 2, H - 45, D * 0.35);
        g.add(flue);
      }
      break;
    }

    case "pendant_linear_led": {
      const barH = 42;
      addBox(g, W, barH, D, W / 2, barH / 2, D / 2, priMat);
      addBox(g, W - 40, 10, D - 24, W / 2, 4, D / 2, secMat);
      addBox(g, 4, H - barH, 4, W * 0.18, barH + (H - barH) / 2, D / 2, chromeMat);
      addBox(g, 4, H - barH, 4, W * 0.82, barH + (H - barH) / 2, D / 2, chromeMat);
      break;
    }

    case "wall_tv_oled": {
      // Sleek ultra-thin frameless 65" OLED TV (matte anodized chassis + deep obsidian glossy OLED glass, no blurry wallpaper)
      const chassisMat = makeMat("#14171C", 0.42, 0.55);
      const oledGlassMat = makeMat("#070A10", 0.06, 0.14);
      const mountMat = makeMat("#1E242D", 0.5, 0.6);
      // Rear VESA wall bracket
      addBox(g, W * 0.36, H * 0.32, Math.max(8, D * 0.34), W / 2, H / 2, Math.max(4, D * 0.17), mountMat);
      // Slim anodized frame
      addBox(g, W, H, Math.max(12, D * 0.46), W / 2, H / 2, D * 0.52, chassisMat);
      // Edge-to-edge deep black OLED display glass
      addBox(g, Math.max(40, W - 12), Math.max(40, H - 12), 6, W / 2, H / 2, D * 0.78, oledGlassMat);
      // Subtle standby status LED dot at bottom center
      addBox(g, 14, 3, 2, W / 2, 7, D * 0.85, makeMat("#CBD5E1", 0.2, 0.1));
      break;
    }

    case "wall_mirror_full":
    case "framed_art": {
      addBox(g, W, H, D * 0.55, W / 2, H / 2, D * 0.28, secMat);
      addBox(
        g,
        W - 24,
        H - 24,
        10,
        W / 2,
        H / 2,
        D * 0.68,
        obj.visualKind === "wall_mirror_full" ? chromeMat : priMat
      );
      break;
    }

    case "plant_olive_tree": {
      const potH = H * 0.26;
      const pot = new THREE.Mesh(
        markSharedGeometry(new THREE.CylinderGeometry(W * 0.28, W * 0.21, potH, 20)),
        secMat
      );
      pot.position.set(W / 2, potH / 2, D / 2);
      g.add(pot);
      const trunk = new THREE.Mesh(
        markSharedGeometry(new THREE.CylinderGeometry(18, 28, H * 0.55, 10)),
        makeMat("#6B4F35", 0.88, 0.02)
      );
      trunk.position.set(W / 2, potH + H * 0.26, D / 2);
      g.add(trunk);
      const canopyPositions = [
        [W / 2, H * 0.76, D / 2, W * 0.36],
        [W * 0.36, H * 0.66, D * 0.44, W * 0.26],
        [W * 0.66, H * 0.68, D * 0.56, W * 0.25],
      ];
      canopyPositions.forEach(([cx, cy, cz, cr]) => {
        const leaf = new THREE.Mesh(
          markSharedGeometry(new THREE.SphereGeometry(cr, 14, 12)),
          priMat
        );
        leaf.position.set(cx, cy, cz);
        g.add(leaf);
      });
      break;
    }

    default: {
      addBox(g, W, H, D, W / 2, H / 2, D / 2, priMat);
      addBox(g, W - 36, H - 36, 12, W / 2, H / 2, D + 2, secMat);
      break;
    }
  }
}
