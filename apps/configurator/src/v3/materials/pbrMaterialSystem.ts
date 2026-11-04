import * as THREE from "three";
import { MaterialDefinition } from "@birim/core";

interface CachedTextureSet {
  colorMap?: THREE.CanvasTexture;
  roughnessMap?: THREE.CanvasTexture;
  bumpMap?: THREE.CanvasTexture;
}

const textureCache = new Map<string, CachedTextureSet>();
const pbrMaterialCache = new Map<string, THREE.MeshPhysicalMaterial>();

/**
 * Deterministic pseudo-random noise helper for realistic wood cathedral grain & pores.
 */
function fract(x: number): number {
  return x - Math.floor(x);
}

function hash2D(x: number, y: number): number {
  return fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453123);
}

function smoothNoise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;

  const u = fx * fx * (3.0 - 2.0 * fx);
  const v = fy * fy * (3.0 - 2.0 * fy);

  const a = hash2D(ix, iy);
  const b = hash2D(ix + 1, iy);
  const c = hash2D(ix, iy + 1);
  const d = hash2D(ix + 1, iy + 1);

  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

function fbm(x: number, y: number): number {
  let val = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < 4; i++) {
    val += amp * smoothNoise(x * freq, y * freq);
    freq *= 2.02;
    amp *= 0.5;
  }
  return val;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/**
 * Generates high-resolution organic Wood Veneer (Oak / Walnut) or Silk Matte Lacquer
 * Albedo, Roughness, and Micro-Bump CanvasTextures once and caches them on GPU.
 */
function getOrCreateProceduralMaps(matDef: MaterialDefinition): CachedTextureSet {
  const cached = textureCache.get(matDef.id);
  if (cached) return cached;

  if (typeof document === "undefined") {
    return {};
  }

  // 1. WOOD VENEERS (Natural Oak & American Walnut)
  if (matDef.category === "wood") {
    const W = 512;
    const H = 512;
    const colorCanvas = document.createElement("canvas");
    colorCanvas.width = W;
    colorCanvas.height = H;
    const cCtx = colorCanvas.getContext("2d")!;

    const bumpCanvas = document.createElement("canvas");
    bumpCanvas.width = W;
    bumpCanvas.height = H;
    const bCtx = bumpCanvas.getContext("2d")!;

    const cImg = cCtx.createImageData(W, H);
    const bImg = bCtx.createImageData(W, H);

    const isWalnut = matDef.id.includes("walnut");
    // Authentic calibrated RGB palettes for European Natural Oak & American Black Walnut
    const baseRgb: [number, number, number] = isWalnut ? [98, 66, 48] : [194, 154, 104];
    const darkGrainRgb: [number, number, number] = isWalnut ? [54, 34, 23] : [148, 108, 64];
    const highlightRgb: [number, number, number] = isWalnut ? [124, 86, 62] : [214, 178, 128];

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        // Vertical lengthwise grain (along Y)
        const nx = x / W;
        const ny = y / H;

        // Cathedral arch distortion + organic fiber wobble
        const turbulence = fbm(nx * 6.0, ny * 2.2) * 0.35;
        const ringPos = (nx * (isWalnut ? 11.0 : 14.0) + turbulence) * Math.PI * 2;
        const ringWave = Math.sin(ringPos);
        const cathedralFactor = Math.pow((ringWave + 1) * 0.5, isWalnut ? 1.8 : 2.3);

        // Fine vertical wood vessels / pores
        const finePore = smoothNoise(nx * 95.0, ny * 18.0);
        const vesselStreak = finePore > 0.76 ? (finePore - 0.76) * 3.2 : 0;

        // Subtle plank-wide tonal warmth variation
        const macroWarmth = smoothNoise(nx * 2.5, ny * 1.5);

        const idx = (y * W + x) * 4;

        // Blend base, highlight, dark grain, and vessel streaks
        let r =
          baseRgb[0] * (1 - cathedralFactor * 0.45) +
          darkGrainRgb[0] * (cathedralFactor * 0.45) +
          (highlightRgb[0] - baseRgb[0]) * macroWarmth * 0.3 -
          vesselStreak * 28;
        let g =
          baseRgb[1] * (1 - cathedralFactor * 0.45) +
          darkGrainRgb[1] * (cathedralFactor * 0.45) +
          (highlightRgb[1] - baseRgb[1]) * macroWarmth * 0.3 -
          vesselStreak * 24;
        let b =
          baseRgb[2] * (1 - cathedralFactor * 0.45) +
          darkGrainRgb[2] * (cathedralFactor * 0.45) +
          (highlightRgb[2] - baseRgb[2]) * macroWarmth * 0.3 -
          vesselStreak * 18;

        cImg.data[idx] = Math.min(255, Math.max(0, Math.round(r)));
        cImg.data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
        cImg.data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
        cImg.data[idx + 3] = 255;

        // Bump / Roughness height value (pores are recessed and slightly rougher)
        const bumpVal = Math.min(
          255,
          Math.max(0, Math.round(140 + cathedralFactor * 45 - vesselStreak * 95))
        );
        bImg.data[idx] = bumpVal;
        bImg.data[idx + 1] = bumpVal;
        bImg.data[idx + 2] = bumpVal;
        bImg.data[idx + 3] = 255;
      }
    }

    cCtx.putImageData(cImg, 0, 0);
    bCtx.putImageData(bImg, 0, 0);

    const colorMap = new THREE.CanvasTexture(colorCanvas);
    colorMap.wrapS = THREE.RepeatWrapping;
    colorMap.wrapT = THREE.RepeatWrapping;
    colorMap.colorSpace = THREE.SRGBColorSpace;
    colorMap.anisotropy = 4;
    colorMap.needsUpdate = true;

    const bumpMap = new THREE.CanvasTexture(bumpCanvas);
    bumpMap.wrapS = THREE.RepeatWrapping;
    bumpMap.wrapT = THREE.RepeatWrapping;
    bumpMap.anisotropy = 4;
    bumpMap.needsUpdate = true;

    const set: CachedTextureSet = { colorMap, bumpMap, roughnessMap: bumpMap };
    textureCache.set(matDef.id, set);
    return set;
  }

  // 2. SILK MATTE LACQUER & MELAMINE (Subtle micro-stipple roughness map so it never looks like raw plastic)
  if (matDef.category === "lacquer" || matDef.category === "laminate") {
    const S = 256;
    const roughCanvas = document.createElement("canvas");
    roughCanvas.width = S;
    roughCanvas.height = S;
    const rCtx = roughCanvas.getContext("2d")!;
    const rImg = rCtx.createImageData(S, S);

    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const n = hash2D(x * 0.8, y * 0.8);
        const v = Math.round(195 + n * 35);
        const idx = (y * S + x) * 4;
        rImg.data[idx] = v;
        rImg.data[idx + 1] = v;
        rImg.data[idx + 2] = v;
        rImg.data[idx + 3] = 255;
      }
    }
    rCtx.putImageData(rImg, 0, 0);

    const roughnessMap = new THREE.CanvasTexture(roughCanvas);
    roughnessMap.wrapS = THREE.RepeatWrapping;
    roughnessMap.wrapT = THREE.RepeatWrapping;
    roughnessMap.needsUpdate = true;

    const set: CachedTextureSet = { roughnessMap };
    textureCache.set(matDef.id, set);
    return set;
  }

  return {};
}

/**
 * Generates a realistic 3-stop studio environment map (Procedural PMREM Equirectangular texture)
 * so glass, anodized metal, silk lacquer, and wood clearcoat reflect realistic architectural softboxes.
 */
let cachedStudioEnvTexture: THREE.DataTexture | null = null;

export function getStudioEnvironmentTexture(): THREE.DataTexture {
  if (cachedStudioEnvTexture) return cachedStudioEnvTexture;

  const width = 128;
  const height = 64;
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    const v = y / (height - 1); // 0 = bottom, 1 = top
    for (let x = 0; x < width; x++) {
      const u = x / (width - 1);
      // Warm skylight top, soft neutral horizon with studio softbox highlights, warm floor bounce
      const softbox1 = Math.exp(-Math.pow((u - 0.25) * 6, 2) - Math.pow((v - 0.68) * 5, 2));
      const softbox2 = Math.exp(-Math.pow((u - 0.75) * 5, 2) - Math.pow((v - 0.58) * 6, 2));

      const skyR = 246 + softbox1 * 9 + softbox2 * 8;
      const skyG = 243 + softbox1 * 10 + softbox2 * 8;
      const skyB = 236 + softbox1 * 12 + softbox2 * 10;

      const groundR = 218;
      const groundG = 212;
      const groundB = 202;

      const blend = Math.pow(v, 0.85);
      const r = Math.min(255, Math.round(groundR * (1 - blend) + skyR * blend));
      const g = Math.min(255, Math.round(groundG * (1 - blend) + skyG * blend));
      const b = Math.min(255, Math.round(groundB * (1 - blend) + skyB * blend));

      const idx = (y * width + x) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  cachedStudioEnvTexture = tex;
  return tex;
}

/**
 * Returns a calibrated, GPU-cached `THREE.MeshPhysicalMaterial` for any Birim material definition.
 */
export function getV3PbrMaterial(
  matDef: MaterialDefinition,
  isSelected: boolean,
  isRailOrMetalFitting: boolean
): THREE.MeshPhysicalMaterial {
  const key = `pbr_${matDef.id}_sel:${isSelected ? 1 : 0}_metal:${isRailOrMetalFitting ? 1 : 0}`;
  const existing = pbrMaterialCache.get(key);
  if (existing) return existing;

  const emissive = isSelected ? new THREE.Color(0xb86b2b) : new THREE.Color(0x000000);
  const emissiveIntensity = isSelected ? 0.18 : 0.0;

  // 1. Brushed Anodized Champagne/Chrome Hardware (Hanging rails, fittings)
  if (isRailOrMetalFitting || matDef.category === "metal") {
    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#c8c6c0"),
      metalness: 0.88,
      roughness: 0.22,
      clearcoat: 0.3,
      clearcoatRoughness: 0.2,
      reflectivity: 0.9,
      emissive,
      emissiveIntensity,
    });
    pbrMaterialCache.set(key, mat);
    return mat;
  }

  // 2. Smoked Glass with Aluminum Frame sheen
  if (matDef.category === "glass" || matDef.id.includes("glass")) {
    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#262b30"),
      metalness: 0.15,
      roughness: 0.08,
      transmission: 0.58,
      transparent: true,
      opacity: 0.82,
      ior: 1.52,
      reflectivity: 0.95,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      emissive,
      emissiveIntensity,
    });
    pbrMaterialCache.set(key, mat);
    return mat;
  }

  const maps = getOrCreateProceduralMaps(matDef);

  // 3. Natural Wood Veneers (Oak & American Walnut) with Satin Clearcoat
  if (matDef.category === "wood") {
    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#ffffff"), // Pure white multiplier so procedural wood map colors shine accurately
      map: maps.colorMap || null,
      bumpMap: maps.bumpMap || null,
      bumpScale: 0.0025,
      roughnessMap: maps.roughnessMap || null,
      roughness: 0.52,
      metalness: 0.02,
      clearcoat: 0.28, // Two-component satin polyurethane furniture varnish
      clearcoatRoughness: 0.38,
      reflectivity: 0.45,
      emissive,
      emissiveIntensity,
    });
    pbrMaterialCache.set(key, mat);
    return mat;
  }

  // 4. Silk Matte Lacquer (Cream & Sage Green) — Soft velvety sheen
  if (matDef.category === "lacquer") {
    const [r, g, b] = hexToRgb(matDef.colorHex);
    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(`rgb(${r}, ${g}, ${b})`),
      roughnessMap: maps.roughnessMap || null,
      roughness: 0.32,
      metalness: 0.02,
      clearcoat: 0.42, // Silk matte polyurethane topcoat
      clearcoatRoughness: 0.36,
      reflectivity: 0.52,
      emissive,
      emissiveIntensity,
    });
    pbrMaterialCache.set(key, mat);
    return mat;
  }

  // 5. Calibrated Melamine (White / Anthracite)
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(matDef.colorHex),
    roughnessMap: maps.roughnessMap || null,
    roughness: 0.46,
    metalness: 0.03,
    clearcoat: 0.12,
    clearcoatRoughness: 0.5,
    emissive,
    emissiveIntensity,
  });
  pbrMaterialCache.set(key, mat);
  return mat;
}

export function getPbrCacheStats(): { texturesCount: number; materialsCount: number } {
  return {
    texturesCount: textureCache.size,
    materialsCount: pbrMaterialCache.size,
  };
}
