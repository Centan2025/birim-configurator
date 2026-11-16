import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import type { SceneObjectInstance } from "@birim/core";
import { resolvePersistentGlbAssetUrl } from "@birim/integrations";
import { markSharedGeometry, markSharedMaterial } from "./webglResourceGuard";

let sharedSceneGltfLoader: GLTFLoader | null = null;
const glbSceneCache = new Map<string, THREE.Group>();
const glbInFlight = new Map<string, Promise<THREE.Group | null>>();
const sceneObjRenderListeners = new Set<() => void>();

export function subscribeSceneObjectGlbLoaded(cb: () => void): () => void {
  sceneObjRenderListeners.add(cb);
  return () => {
    sceneObjRenderListeners.delete(cb);
  };
}

function notifySceneObjLoaded(): void {
  sceneObjRenderListeners.forEach((cb) => {
    try {
      cb();
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

function tagSelectableHierarchy(root: THREE.Object3D, sceneObjectId: string): void {
  root.userData = {
    ...root.userData,
    isSceneObject: true,
    sceneObjectId,
  };
  root.traverse((child) => {
    child.userData = {
      ...child.userData,
      isSceneObject: true,
      sceneObjectId,
    };
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

function makeMat(hex: string, roughness = 0.5, metalness = 0.1, opacity = 1): THREE.MeshStandardMaterial {
  return markSharedMaterial(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(hex),
      roughness,
      metalness,
      transparent: opacity < 0.99,
      opacity,
    })
  );
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
  const geo = markSharedGeometry(new THREE.BoxGeometry(Math.max(2, w), Math.max(2, h), Math.max(2, d)));
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

/**
 * Builds an architectural-grade procedural 3D PBR assembly centered around local origin `(0..W, 0..H, 0..D)`
 * (matching Birim's millimeter cabinet coordinate system: bottom-rear-left at `(0,0,0)`)
 * OR mounts an external / IndexedDB / Cloudflare R2 `.GLB` model normalized to exact millimeter bounds!
 */
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
  // Rotate around center of object footprint so rotating 90°/180° stays in place cleanly
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

  // If custom .GLB URL or persistent IndexedDB asset key is supplied, mount normalized .GLB mesh
  if (obj.glbUrl || obj.localAssetKey) {
    const cacheKey = obj.localAssetKey || obj.glbUrl || obj.id;
    const cached = glbSceneCache.get(cacheKey);
    if (cached) {
      const clone = cached.clone(true);
      fitArbitraryGlbIntoBox(clone, W, H, D);
      inner.add(clone);
    } else {
      // Immediate translucent proxy while async GLB resolves
      const proxyMat = makeMat(priHex, 0.5, 0.2, 0.45);
      addBox(inner, W, H, D, W / 2, H / 2, D / 2, proxyMat);
      void loadCustomSceneGlbAsync(cacheKey, obj.glbUrl, obj.localAssetKey, options?.renderer).then((tpl) => {
        if (tpl) notifySceneObjLoaded();
      });
    }
  } else {
    buildProceduralVisualByKind(inner, obj, W, H, D, priMat, secMat, chromeMat, glassDarkMat);
  }

  // Optional real 3D lighting emission (Pendant lights, Island Hood, Wine Cooler)
  if (obj.lightEmission?.enabled) {
    const kelvinColor =
      obj.lightEmission.colorTempK === 2700
        ? 0xffd299
        : obj.lightEmission.colorTempK === 4000
        ? 0xf4f8ff
        : 0xffe3b8;
    const ptLight = new THREE.PointLight(kelvinColor, 1.35, 2800, 1.6);
    ptLight.position.set(W / 2, Math.max(40, H * 0.15), D / 2);
    ptLight.castShadow = false;
    inner.add(ptLight);
  }

  // Selection highlight wireframe + clearance envelope indicator when selected
  if (options?.isSelected) {
    const selGeo = new THREE.BoxGeometry(W + 12, H + 12, D + 12);
    const edges = new THREE.EdgesGeometry(selGeo);
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

  tagSelectableHierarchy(root, obj.id);
  return root;
}

function fitArbitraryGlbIntoBox(model: THREE.Group, targetW: number, targetH: number, targetD: number): void {
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  if (box.isEmpty()) return;
  const size = new THREE.Vector3();
  box.getSize(size);
  const s = Math.min(
    targetW / Math.max(1e-4, size.x),
    targetH / Math.max(1e-4, size.y),
    targetD / Math.max(1e-4, size.z)
  );
  model.scale.multiplyScalar(s);
  model.updateMatrixWorld(true);
  const scaledBox = new THREE.Box3().setFromObject(model);
  const center = new THREE.Vector3();
  scaledBox.getCenter(center);
  model.position.x += targetW / 2 - center.x;
  model.position.z += targetD / 2 - center.z;
  model.position.y += -scaledBox.min.y;
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
      // Main carcass + upper left/right French doors + lower freezer drawer + recessed ice dispenser
      addBox(g, W, H, D - 45, W / 2, H / 2, (D - 45) / 2, secMat);
      const freezerH = H * 0.34;
      const upperH = H - freezerH - 18;
      const doorW = (W - 10) / 2;
      addBox(g, doorW, upperH, 40, doorW / 2 + 2, freezerH + 14 + upperH / 2, D - 20, priMat);
      addBox(g, doorW, upperH, 40, W - doorW / 2 - 2, freezerH + 14 + upperH / 2, D - 20, priMat);
      addBox(g, W - 4, freezerH - 6, 40, W / 2, freezerH / 2, D - 20, priMat);
      // Vertical handles + water dispenser recess
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
      // Control fascia + OLED display + oven bar handle
      const fasciaH = Math.min(95, H * 0.2);
      addBox(g, W - 4, fasciaH, 24, W / 2, H - fasciaH / 2 - 2, D - 10, priMat);
      addBox(g, W * 0.78, 16, 28, W / 2, H - fasciaH - 26, D + 10, chromeMat);
      break;
    }

    case "cooktop_induction": {
      // Sleek beveled black ceramic glass + 4 subtle induction zone rings
      addBox(g, W, 12, D, W / 2, H - 6, D / 2, glassDarkMat);
      addBox(g, W - 50, H - 12, D - 50, W / 2, (H - 12) / 2, D / 2, secMat);
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
        cyl.position.set(rx, H + 0.8, rz);
        g.add(cyl);
      });
      break;
    }

    case "sink_undermount_faucet":
    case "sink_vessel_bath": {
      const rimT = 28;
      const basinH = Math.min(190, H * 0.5);
      // Outer sink rim + dark basin floor + tall gooseneck faucet
      addBox(g, W, 10, rimT, W / 2, 5, rimT / 2, priMat);
      addBox(g, W, 10, rimT, W / 2, 5, D - rimT / 2, priMat);
      addBox(g, rimT, 10, D, rimT / 2, 5, D / 2, priMat);
      addBox(g, rimT, 10, D, W - rimT / 2, 5, D / 2, priMat);
      addBox(g, W - rimT * 2, 8, D - rimT * 2, W / 2, -basinH * 0.35, D / 2, secMat);
      // Gooseneck faucet stem & spout
      const stemH = Math.max(180, H - 40);
      const stem = new THREE.Mesh(
        markSharedGeometry(new THREE.CylinderGeometry(14, 16, stemH, 16)),
        chromeMat
      );
      stem.position.set(W / 2, stemH / 2, 36);
      g.add(stem);
      const spout = new THREE.Mesh(
        markSharedGeometry(new THREE.TorusGeometry(75, 11, 12, 24, Math.PI)),
        chromeMat
      );
      spout.rotation.y = Math.PI / 2;
      spout.position.set(W / 2, stemH, 111);
      g.add(spout);
      break;
    }

    case "hood_wall_chimney":
    case "hood_island": {
      const canopyH = Math.min(75, H * 0.12);
      addBox(g, W, canopyH, D, W / 2, canopyH / 2, D / 2, priMat);
      const flueW = Math.min(280, W * 0.34);
      const flueD = Math.min(260, D * 0.55);
      addBox(g, flueW, H - canopyH, flueD, W / 2, canopyH + (H - canopyH) / 2, obj.visualKind === "hood_island" ? D / 2 : flueD / 2, chromeMat);
      break;
    }

    case "washer_dryer": {
      addBox(g, W, H, D, W / 2, H / 2, D / 2, priMat);
      const drum = new THREE.Mesh(
        markSharedGeometry(new THREE.CylinderGeometry(195, 195, 32, 28)),
        glassDarkMat
      );
      drum.rotation.x = Math.PI / 2;
      drum.position.set(W / 2, H * 0.48, D + 6);
      g.add(drum);
      addBox(g, W - 20, 90, 12, W / 2, H - 55, D + 4, secMat);
      break;
    }

    case "dining_table_oak":
    case "coffee_table": {
      const topT = obj.visualKind === "coffee_table" ? 32 : 38;
      addBox(g, W, topT, D, W / 2, H - topT / 2, D / 2, priMat);
      const legW = obj.visualKind === "coffee_table" ? 90 : 64;
      const legInset = 95;
      [
        [legInset, legInset],
        [W - legInset, legInset],
        [legInset, D - legInset],
        [W - legInset, D - legInset],
      ].forEach(([lx, lz]) => {
        addBox(g, legW, H - topT, legW, lx, (H - topT) / 2, lz, secMat);
      });
      break;
    }

    case "dining_chair":
    case "bar_stool": {
      const seatY = obj.visualKind === "bar_stool" ? H * 0.82 : H * 0.56;
      addBox(g, W - 20, 48, D - 20, W / 2, seatY, D / 2, priMat);
      addBox(g, W - 30, H - seatY, 42, W / 2, seatY + (H - seatY) / 2, 26, priMat);
      const legR = 16;
      [
        [45, 45],
        [W - 45, 45],
        [45, D - 45],
        [W - 45, D - 45],
      ].forEach(([lx, lz]) => {
        addBox(g, legR * 2, seatY - 24, legR * 2, lx, (seatY - 24) / 2, lz, secMat);
      });
      if (obj.visualKind === "bar_stool") {
        addBox(g, W - 90, 18, 18, W / 2, 230, D - 45, chromeMat);
      }
      break;
    }

    case "sofa_modular":
    case "armchair": {
      const seatH = H * 0.52;
      const armW = Math.min(160, W * 0.14);
      addBox(g, W, seatH - 40, D, W / 2, 40 + (seatH - 40) / 2, D / 2, priMat);
      addBox(g, W, H - seatH + 80, 210, W / 2, seatH + (H - seatH) / 2 - 20, 105, priMat);
      addBox(g, armW, H * 0.78, D, armW / 2, 40 + (H * 0.78) / 2, D / 2, priMat);
      addBox(g, armW, H * 0.78, D, W - armW / 2, 40 + (H * 0.78) / 2, D / 2, priMat);
      break;
    }

    case "bed_double": {
      addBox(g, W, 110, 95, W / 2, H / 2, 48, secMat);
      addBox(g, W, H, 95, W / 2, H / 2, 48, secMat);
      addBox(g, W, 260, D - 95, W / 2, 160, 95 + (D - 95) / 2, secMat);
      addBox(g, W - 80, 240, D - 160, W / 2, 390, 110 + (D - 160) / 2, priMat);
      // Two pillows
      addBox(g, W * 0.36, 110, 360, W * 0.28, 535, 310, priMat);
      addBox(g, W * 0.36, 110, 360, W * 0.72, 535, 310, priMat);
      break;
    }

    case "pendant_linear_led": {
      const barH = 38;
      addBox(g, W, barH, D, W / 2, barH / 2, D / 2, priMat);
      const glowMat = makeMat("#FEF08A", 0.1, 0.0);
      addBox(g, W - 24, 8, D - 18, W / 2, 2, D / 2, glowMat);
      // Suspension cables up to ceiling
      addBox(g, 4, H - barH, 4, W * 0.18, barH + (H - barH) / 2, D / 2, chromeMat);
      addBox(g, 4, H - barH, 4, W * 0.82, barH + (H - barH) / 2, D / 2, chromeMat);
      break;
    }

    case "wall_tv_oled": {
      addBox(g, W, H, D * 0.5, W / 2, H / 2, D * 0.25, priMat);
      addBox(g, W - 18, H - 18, 8, W / 2, H / 2, D * 0.55, glassDarkMat);
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
