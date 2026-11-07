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

  // 1. WOOD VENEERS & GRAINED LAMINATES (Kastamonu Freze/Safir Meşe, Çamsan İskandinav Meşe, Yıldız Barok Ceviz)
  if (matDef.category === "wood" || (matDef.category === "laminate" && matDef.hasGrain)) {
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
    const [hr, hg, hb] = hexToRgb(matDef.colorHex || (isWalnut ? "#624230" : "#c29a68"));
    const baseRgb: [number, number, number] = [hr, hg, hb];
    const darkGrainRgb: [number, number, number] = [
      Math.max(12, Math.round(hr * 0.62)),
      Math.max(10, Math.round(hg * 0.6)),
      Math.max(8, Math.round(hb * 0.56)),
    ];
    const highlightRgb: [number, number, number] = [
      Math.min(250, Math.round(hr * 1.14)),
      Math.min(248, Math.round(hg * 1.14)),
      Math.min(242, Math.round(hb * 1.12)),
    ];

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

  // 3. NEOLITH SINTERED STONE, DEKTON, BELENCO, ÇİMSTONE & NATURAL MARBLE VEINING
  if (matDef.category === "stone") {
    const W = 512;
    const H = 512;
    const colorCanvas = document.createElement("canvas");
    colorCanvas.width = W;
    colorCanvas.height = H;
    const cCtx = colorCanvas.getContext("2d")!;
    const cImg = cCtx.createImageData(W, H);
    const [br, bg, bb] = hexToRgb(matDef.colorHex || "#f4f3ef");

    const idLower = matDef.id.toLowerCase();
    const isGoldVeined =
      idLower.includes("luxe") || idLower.includes("abu_dhabi") || idLower.includes("entzo");
    const isDarkStone = idLower.includes("basalt") || idLower.includes("piombo");
    const isEmperador = idLower.includes("emperador");

    // Vein target RGB based on specific Neolith / Dekton / Marble decor
    const veinRgb: [number, number, number] = isGoldVeined
      ? [184, 146, 92] // Warm gold/ochre Calacatta Luxe & Dekton Entzo veins
      : isDarkStone
      ? [215, 212, 206] // Fine crisp mineral white veins on Basalt Black / Pietra di Piombo
      : isEmperador
      ? [238, 228, 212] // Cream spiderweb veins on Light Emperador
      : [138, 142, 148]; // Classic Carrara / Estatuario cool-warm grey veins

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const nx = x / W;
        const ny = y / H;
        const warp = fbm(nx * 4.5, ny * 4.5);
        const vein1 = Math.pow(
          Math.max(0, 1 - Math.abs(Math.sin((nx * 3.1 + ny * 2.2 + warp * 1.7) * Math.PI)) * 4.5),
          2.3
        );
        const vein2 =
          Math.pow(
            Math.max(0, 1 - Math.abs(Math.sin((nx * 6.8 - ny * 4.2 + warp * 2.3) * Math.PI)) * 6.2),
            2.8
          ) * 0.65;
        const vFactor = Math.min(1, vein1 + vein2);
        const strength = isDarkStone ? 0.24 : 0.36;
        const idx = (y * W + x) * 4;
        cImg.data[idx] = Math.round(br * (1 - vFactor * strength) + veinRgb[0] * vFactor * strength);
        cImg.data[idx + 1] = Math.round(bg * (1 - vFactor * strength) + veinRgb[1] * vFactor * strength);
        cImg.data[idx + 2] = Math.round(bb * (1 - vFactor * strength) + veinRgb[2] * vFactor * strength);
        cImg.data[idx + 3] = 255;
      }
    }
    cCtx.putImageData(cImg, 0, 0);
    const colorMap = new THREE.CanvasTexture(colorCanvas);
    colorMap.wrapS = THREE.RepeatWrapping;
    colorMap.wrapT = THREE.RepeatWrapping;
    colorMap.colorSpace = THREE.SRGBColorSpace;
    colorMap.needsUpdate = true;
    const set: CachedTextureSet = { colorMap };
    textureCache.set(matDef.id, set);
    return set;
  }

  return {};
}

const floorTextureCache = new Map<string, THREE.CanvasTexture>();

export type ArchitecturalFloorStyle =
  | "oak_parquet"
  | "herringbone_oak"
  | "walnut_parquet"
  | "travertine"
  | "neolith_calacatta"
  | "microcement"
  | "studio";

export function getArchitecturalFloorTexture(
  style: ArchitecturalFloorStyle
): THREE.CanvasTexture | null {
  if (typeof document === "undefined" || style === "studio") return null;
  const cached = floorTextureCache.get(style);
  if (cached) return cached;

  const S = 512;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(S, S);

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const idx = (y * S + x) * 4;
      if (style === "oak_parquet" || style === "walnut_parquet") {
        const isWalnut = style === "walnut_parquet";
        const plankRow = Math.floor(y / 64);
        const plankX = (x + (plankRow % 2) * 128) % 256;
        const plankY = y % 64;
        const isGap = plankX < 2 || plankY < 2;
        const plankSeed = hash2D(plankRow, Math.floor((x + (plankRow % 2) * 128) / 256));
        const grain = smoothNoise((x / S) * 16, (y / S) * 64) * 18 + (plankSeed - 0.5) * 16;
        const baseR = isWalnut ? 132 : 206;
        const baseG = isWalnut ? 98 : 176;
        const baseB = isWalnut ? 74 : 138;
        img.data[idx] = isGap ? 88 : Math.min(248, Math.max(60, Math.round(baseR + grain)));
        img.data[idx + 1] = isGap ? 70 : Math.min(232, Math.max(48, Math.round(baseG + grain * 0.85)));
        img.data[idx + 2] = isGap ? 54 : Math.min(205, Math.max(36, Math.round(baseB + grain * 0.65)));
        img.data[idx + 3] = 255;
      } else if (style === "herringbone_oak") {
        // Chevron / Herringbone Nordic Oak Parquet
        const col = Math.floor(x / 64);
        const diag = col % 2 === 0 ? (x + y) % 64 : (x - y + 512) % 64;
        const isSeam = x % 64 < 2 || diag < 2;
        const grain = smoothNoise((x / S) * 24, (y / S) * 24) * 14;
        img.data[idx] = isSeam ? 150 : Math.round(218 + grain);
        img.data[idx + 1] = isSeam ? 130 : Math.round(196 + grain * 0.9);
        img.data[idx + 2] = isSeam ? 105 : Math.round(164 + grain * 0.75);
        img.data[idx + 3] = 255;
      } else if (style === "neolith_calacatta") {
        // Large-Format Neolith Calacatta Porcelain Floor Slab (60x120)
        const tileX = x % 256;
        const tileY = y % 256;
        const isGrout = tileX < 2 || tileY < 2;
        const warp = fbm((x / S) * 4, (y / S) * 4);
        const vein = Math.pow(
          Math.max(0, 1 - Math.abs(Math.sin(((x / S) * 3 + (y / S) * 2 + warp * 1.5) * Math.PI)) * 5.0),
          2.4
        );
        img.data[idx] = isGrout ? 205 : Math.round(244 - vein * 42);
        img.data[idx + 1] = isGrout ? 202 : Math.round(241 - vein * 46);
        img.data[idx + 2] = isGrout ? 196 : Math.round(235 - vein * 52);
        img.data[idx + 3] = 255;
      } else if (style === "microcement") {
        // Warm Cashmere Seamless Microcement
        const n = fbm((x / S) * 6, (y / S) * 6) * 14;
        img.data[idx] = Math.round(228 + n);
        img.data[idx + 1] = Math.round(224 + n);
        img.data[idx + 2] = Math.round(216 + n);
        img.data[idx + 3] = 255;
      } else {
        // Italian Travertine / Warm Stone Tiles
        const tileX = x % 256;
        const tileY = y % 256;
        const isGrout = tileX < 3 || tileY < 3;
        const n = fbm((x / S) * 8, (y / S) * 4) * 18;
        img.data[idx] = isGrout ? 185 : Math.round(226 + n);
        img.data[idx + 1] = isGrout ? 180 : Math.round(220 + n);
        img.data[idx + 2] = isGrout ? 172 : Math.round(208 + n);
        img.data[idx + 3] = 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  floorTextureCache.set(style, tex);
  return tex;
}

/**
 * Generates a realistic 3-stop studio environment map (Procedural PMREM Equirectangular texture)
 * so glass, anodized metal, silk lacquer, and wood clearcoat reflect realistic architectural softboxes.
 */
let cachedStudioEnvTexture: THREE.DataTexture | null = null;
let cachedPmremEnvTexture: THREE.Texture | null = null;

/**
 * Generates a prefiltered, mipmapped GGX radiance environment map (PMREM) from a virtual
 * architectural studio scene with high-dynamic-range softbox lightformers and window panels.
 * Computed once on GPU (< 4ms) for zero per-frame overhead and photorealistic reflections.
 */
export function getStudioPmremEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  if (cachedPmremEnvTexture) return cachedPmremEnvTexture;
  try {
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileCubemapShader();

    const envScene = new THREE.Scene();

    // Enclosing soft warm architectural studio room shell
    const roomBox = new THREE.Mesh(
      new THREE.BoxGeometry(36, 24, 36),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0.76, 0.75, 0.72), side: THREE.BackSide })
    );
    envScene.add(roomBox);

    // Warm oak floor bounce card
    const floorBounce = new THREE.Mesh(
      new THREE.PlaneGeometry(32, 32),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0.95, 0.88, 0.78), side: THREE.DoubleSide })
    );
    floorBounce.rotation.x = -Math.PI / 2;
    floorBounce.position.set(0, -11.5, 0);
    envScene.add(floorBounce);

    // Helper to add HDR emissive studio lightformer panels (RGB > 1.0 for crisp specular reflections)
    const addLightformer = (
      w: number,
      h: number,
      pos: [number, number, number],
      rot: [number, number, number],
      rgb: [number, number, number]
    ) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(rgb[0], rgb[1], rgb[2]),
          side: THREE.DoubleSide,
          toneMapped: false,
        })
      );
      m.position.set(pos[0], pos[1], pos[2]);
      m.rotation.set(rot[0], rot[1], rot[2]);
      envScene.add(m);
    };

    // 1. Overhead large diffused skylight softbox
    addLightformer(22, 16, [0, 11.8, 2], [Math.PI / 2, 0, 0], [4.2, 4.15, 4.0]);
    // 2. Left tall architectural window lightformer (creates natural vertical reflections on cabinet doors)
    addLightformer(14, 18, [-17.5, 2.5, 6], [0, Math.PI / 2, 0], [5.8, 5.6, 5.2]);
    // 3. Right warm fill softbox
    addLightformer(12, 15, [17.5, 3.0, 5], [0, -Math.PI / 2, 0], [3.6, 3.3, 2.9]);
    // 4. Front-top grazing highlight strip (accentuates Gola channels, handles, and countertop bevels)
    addLightformer(20, 5, [0, 7.5, 17.5], [0, Math.PI, 0], [3.9, 3.85, 3.75]);

    const renderTarget = pmremGenerator.fromScene(envScene, 0.035);
    cachedPmremEnvTexture = renderTarget.texture;
    roomBox.geometry.dispose();
    (roomBox.material as THREE.Material).dispose();
    floorBounce.geometry.dispose();
    (floorBounce.material as THREE.Material).dispose();
    pmremGenerator.dispose();
    return cachedPmremEnvTexture;
  } catch {
    return getStudioEnvironmentTexture();
  }
}

export function getStudioEnvironmentTexture(): THREE.DataTexture {
  if (cachedStudioEnvTexture) return cachedStudioEnvTexture;

  const width = 256;
  const height = 128;
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    const v = y / (height - 1); // 0 = bottom, 1 = top
    for (let x = 0; x < width; x++) {
      const u = x / (width - 1);
      // High-contrast studio softboxes + window lightformer + warm floor bounce
      const softboxKey = Math.exp(-Math.pow((u - 0.22) * 5.5, 2) - Math.pow((v - 0.66) * 4.5, 2));
      const softboxFill = Math.exp(-Math.pow((u - 0.78) * 5.0, 2) - Math.pow((v - 0.58) * 5.0, 2));
      const topSkylight = Math.exp(-Math.pow((v - 0.92) * 4.0, 2));

      const skyR = 205 + softboxKey * 50 + softboxFill * 38 + topSkylight * 35;
      const skyG = 203 + softboxKey * 49 + softboxFill * 36 + topSkylight * 35;
      const skyB = 198 + softboxKey * 46 + softboxFill * 34 + topSkylight * 36;

      const groundR = 156;
      const groundG = 148;
      const groundB = 138;

      const blend = Math.pow(v, 0.75);
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
  isRailOrMetalFitting: boolean,
  grainDirection: "lengthwise" | "crosswise" | "custom" = "lengthwise",
  surfaceFinishOverride?: "matte" | "satin" | "gloss"
): THREE.MeshPhysicalMaterial {
  const key = `pbr_${matDef.id}_sel:${isSelected ? 1 : 0}_metal:${isRailOrMetalFitting ? 1 : 0}_gr:${grainDirection}_fin:${surfaceFinishOverride || "def"}`;
  const existing = pbrMaterialCache.get(key);
  if (existing) return existing;

  const emissive = isSelected ? new THREE.Color(0x2563eb) : new THREE.Color(0x000000);
  const emissiveIntensity = isSelected ? 0.42 : 0.0;

  // 0. Warm 3000K Recessed LED Channel Emissive Material
  if (matDef.id === "mat_led_warm_3000k") {
    const ledMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#fff9e6"),
      emissive: new THREE.Color("#ffbe3d"),
      emissiveIntensity: isSelected ? 2.4 : 1.85,
      roughness: 0.1,
      metalness: 0.05,
      clearcoat: 0.9,
    });
    pbrMaterialCache.set(key, ledMat);
    return ledMat;
  }

  // 1. Brushed Anodized Champagne/Chrome Hardware (Hanging rails, fittings)
  if (isRailOrMetalFitting || matDef.category === "metal") {
    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#d4d2cd"),
      metalness: 0.92,
      roughness: 0.18,
      clearcoat: 0.45,
      clearcoatRoughness: 0.14,
      ior: 1.6,
      reflectivity: 0.95,
      envMapIntensity: 1.55,
      emissive,
      emissiveIntensity,
    });
    pbrMaterialCache.set(key, mat);
    return mat;
  }

  // 2. Smoked Glass with Aluminum Frame sheen
  if (matDef.category === "glass" || matDef.id.includes("glass")) {
    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(matDef.colorHex),
      metalness: 0.1,
      roughness: 0.05,
      transmission: 0.64,
      transparent: true,
      opacity: 0.84,
      depthWrite: false,
      ior: 1.52,
      reflectivity: 0.98,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      envMapIntensity: 1.65,
      emissive,
      emissiveIntensity,
    });
    pbrMaterialCache.set(key, mat);
    return mat;
  }

  const maps = getOrCreateProceduralMaps(matDef);

  // 3. Natural Wood Veneers (Oak & American Walnut) with Two-Component Satin Polyurethane Clearcoat & Grain Direction UV Rotation
  if (matDef.category === "wood" || (matDef.category === "laminate" && matDef.hasGrain)) {
    let colorTex = maps.colorMap || null;
    let bumpTex = maps.bumpMap || null;
    if (colorTex && grainDirection !== "lengthwise") {
      const rotRad = grainDirection === "crosswise" ? Math.PI / 2 : Math.PI / 4;
      colorTex = colorTex.clone();
      colorTex.center.set(0.5, 0.5);
      colorTex.rotation = rotRad;
      colorTex.needsUpdate = true;
      if (bumpTex) {
        bumpTex = bumpTex.clone();
        bumpTex.center.set(0.5, 0.5);
        bumpTex.rotation = rotRad;
        bumpTex.needsUpdate = true;
      }
    }
    const roughVal =
      surfaceFinishOverride === "gloss"
        ? 0.14
        : surfaceFinishOverride === "satin"
        ? 0.32
        : surfaceFinishOverride === "matte"
        ? 0.56
        : 0.44;
    const clearcoatVal =
      surfaceFinishOverride === "gloss" ? 0.88 : surfaceFinishOverride === "matte" ? 0.18 : 0.42;
    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#ffffff"),
      map: colorTex,
      bumpMap: bumpTex,
      bumpScale: 0.0032,
      roughnessMap: bumpTex,
      roughness: roughVal,
      metalness: 0.02,
      ior: 1.49,
      specularIntensity: 0.85,
      clearcoat: clearcoatVal,
      clearcoatRoughness: surfaceFinishOverride === "gloss" ? 0.08 : 0.28,
      reflectivity: 0.62,
      envMapIntensity: 1.35,
      emissive,
      emissiveIntensity,
    });
    pbrMaterialCache.set(key, mat);
    return mat;
  }

  // 3b. Polished Calacatta Marble & Quartz Countertop (Çimstone / Belenco)
  if (matDef.category === "stone" || matDef.id.includes("stone") || matDef.id.includes("calacatta")) {
    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#ffffff"),
      map: maps.colorMap || null,
      roughness: 0.12,
      metalness: 0.03,
      ior: 1.54,
      specularIntensity: 1.0,
      clearcoat: 0.92,
      clearcoatRoughness: 0.08,
      reflectivity: 0.96,
      envMapIntensity: 1.5,
      emissive,
      emissiveIntensity,
    });
    pbrMaterialCache.set(key, mat);
    return mat;
  }

  // 4. Silk Matte Lacquer & Soft-Touch Supramat — Velvety micro-sheen + clearcoat lobe
  if (matDef.category === "lacquer") {
    const [r, g, b] = hexToRgb(matDef.colorHex);
    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(`rgb(${r}, ${g}, ${b})`),
      roughnessMap: maps.roughnessMap || null,
      roughness: 0.24,
      metalness: 0.02,
      ior: 1.49,
      specularIntensity: 0.88,
      sheen: 0.25,
      sheenRoughness: 0.42,
      sheenColor: new THREE.Color("#f8fafc"),
      clearcoat: 0.58,
      clearcoatRoughness: 0.22,
      reflectivity: 0.74,
      envMapIntensity: 1.38,
      emissive,
      emissiveIntensity,
    });
    pbrMaterialCache.set(key, mat);
    return mat;
  }

  // 5. Calibrated Melamine / MDF-Lam (Kastamonu / Yıldız / AGT / Çamsan)
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(matDef.colorHex),
    roughnessMap: maps.roughnessMap || null,
    roughness: 0.32,
    metalness: 0.03,
    ior: 1.48,
    specularIntensity: 0.82,
    sheen: 0.14,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color("#f8fafc"),
    clearcoat: 0.36,
    clearcoatRoughness: 0.28,
    reflectivity: 0.65,
    envMapIntensity: 1.28,
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


/**
 * WP-10: Computes physical millimeter-based UV repeat factors and rotation
 * for panel dimensions (in mm) and wood grain direction.
 */
export function computePhysicalUvScale(
  widthMm: number,
  heightMm: number,
  grain: "lengthwise" | "crosswise" | "none" = "lengthwise"
): { repeatX: number; repeatY: number; rotationRad: number } {
  const referenceTileMm = 600;
  const repeatX = Math.max(0.1, Number((widthMm / referenceTileMm).toFixed(3)));
  const repeatY = Math.max(0.1, Number((heightMm / referenceTileMm).toFixed(3)));
  const rotationRad = grain === "crosswise" ? Math.PI / 2 : 0;
  return { repeatX, repeatY, rotationRad };
}
