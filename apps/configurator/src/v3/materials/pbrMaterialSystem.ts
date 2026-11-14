import * as THREE from "three";
import { MaterialDefinition } from "@birim/core";
import { markSharedMaterial, markSharedTexture } from "./webglResourceGuard";

interface CachedTextureSet {
  colorMap?: THREE.CanvasTexture;
  roughnessMap?: THREE.CanvasTexture;
  normalMap?: THREE.CanvasTexture;
  bumpMap?: THREE.CanvasTexture;
}

const textureCache = new Map<string, CachedTextureSet>();
const rotatedTexCache = new Map<string, THREE.CanvasTexture>();
const pbrMaterialCache = new Map<string, THREE.MeshPhysicalMaterial>();
const customImageTexCache = new Map<string, THREE.Texture>();

export function invalidateCustomMaterialCache(matId?: string): void {
  if (!matId) {
    pbrMaterialCache.clear();
    swatchDataUrlCache.clear();
    customImageTexCache.clear();
    return;
  }
  swatchDataUrlCache.delete(matId);
  for (const k of Array.from(pbrMaterialCache.keys())) {
    if (k.includes(matId)) pbrMaterialCache.delete(k);
  }
  for (const k of Array.from(customImageTexCache.keys())) {
    if (k.startsWith(matId)) customImageTexCache.delete(k);
  }
}

function getOrLoadCustomImageTexture(
  matDef: MaterialDefinition,
  rotRad: number
): THREE.Texture | null {
  if (!matDef.textureUrl || typeof document === "undefined") return null;
  const cKey = `${matDef.id}_rot:${rotRad.toFixed(2)}`;
  const hit = customImageTexCache.get(cKey);
  if (hit) return hit;

  const loader = new THREE.TextureLoader();
  const tex = loader.load(matDef.textureUrl);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1.2, 1.2);
  if (rotRad !== 0) {
    tex.center.set(0.5, 0.5);
    tex.rotation = rotRad;
  }
  markSharedTexture(tex);
  customImageTexCache.set(cKey, tex);
  return tex;
}


function fract(x: number): number {
  return x - Math.floor(x);
}

function hash2D(x: number, y: number): number {
  return fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453123);
}

/**
 * Periodic seamless value noise so tileable textures wrap across [0..period] with zero seam lines.
 */
function periodicNoise(x: number, y: number, periodX: number, periodY: number): number {
  const px = Math.max(1, Math.round(periodX));
  const py = Math.max(1, Math.round(periodY));
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;

  const x0 = ((ix % px) + px) % px;
  const x1 = (x0 + 1) % px;
  const y0 = ((iy % py) + py) % py;
  const y1 = (y0 + 1) % py;

  const u = fx * fx * (3.0 - 2.0 * fx);
  const v = fy * fy * (3.0 - 2.0 * fy);

  const a = hash2D(x0, y0);
  const b = hash2D(x1, y0);
  const c = hash2D(x0, y1);
  const d = hash2D(x1, y1);

  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

function periodicFbm(
  nx: number,
  ny: number,
  baseFreqX: number,
  baseFreqY: number,
  octaves = 4
): number {
  let val = 0;
  let amp = 0.5;
  let fx = baseFreqX;
  let fy = baseFreqY;
  for (let i = 0; i < octaves; i++) {
    val += amp * periodicNoise(nx * fx, ny * fy, fx, fy);
    fx *= 2;
    fy *= 2;
    amp *= 0.5;
  }
  return val;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = (hex || "#d6d3cd").replace("#", "");
  const num = parseInt(clean, 16);
  if (!Number.isFinite(num)) return [214, 211, 205];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function clampByte(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

/**
 * Converts a seamless [0..1] heightfield into a true RGB Tangent-Space Normal Map via 3x3 Sobel gradients.
 */
function buildNormalMapFromHeightField(
  heights: Float32Array,
  W: number,
  H: number,
  strength: number,
  repeatX = 1,
  repeatY = 1
): THREE.CanvasTexture {
  const nCanvas = document.createElement("canvas");
  nCanvas.width = W;
  nCanvas.height = H;
  const nCtx = nCanvas.getContext("2d")!;
  const nImg = nCtx.createImageData(W, H);

  const sample = (x: number, y: number): number => {
    const wx = ((x % W) + W) % W;
    const wy = ((y % H) + H) % H;
    return heights[wy * W + wx];
  };

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const tl = sample(x - 1, y - 1);
      const t = sample(x, y - 1);
      const tr = sample(x + 1, y - 1);
      const l = sample(x - 1, y);
      const r = sample(x + 1, y);
      const bl = sample(x - 1, y + 1);
      const b = sample(x, y + 1);
      const br = sample(x + 1, y + 1);

      const dX = tr + 2 * r + br - (tl + 2 * l + bl);
      const dY = bl + 2 * b + br - (tl + 2 * t + tr);

      let nx = -dX * strength;
      let ny = -dY * strength;
      let nz = 1.0;
      const invLen = 1.0 / Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx *= invLen;
      ny *= invLen;
      nz *= invLen;

      const idx = (y * W + x) * 4;
      nImg.data[idx] = clampByte((nx * 0.5 + 0.5) * 255);
      nImg.data[idx + 1] = clampByte((ny * 0.5 + 0.5) * 255);
      nImg.data[idx + 2] = clampByte((nz * 0.5 + 0.5) * 255);
      nImg.data[idx + 3] = 255;
    }
  }

  nCtx.putImageData(nImg, 0, 0);
  const normalTex = markSharedTexture(new THREE.CanvasTexture(nCanvas));
  normalTex.wrapS = THREE.RepeatWrapping;
  normalTex.wrapT = THREE.RepeatWrapping;
  normalTex.repeat.set(repeatX, repeatY);
  normalTex.anisotropy = 4;
  normalTex.needsUpdate = true;
  return normalTex;
}

/**
 * Generates high-definition 3-Channel PBR Texture Suites (Albedo + Micro-Roughness + Sobel Tangent Normal Map)
 * cached once per material on GPU.
 */
function getOrCreateProceduralMaps(matDef: MaterialDefinition): CachedTextureSet {
  const cached = textureCache.get(matDef.id);
  if (cached) return cached;

  if (typeof document === "undefined") {
    return {};
  }

  // 0. WOVEN ARCHITECTURAL LINEN / TEXTILE PANEL (Cross-Slub Yarn Albedo + Weave Normal + Roughness)
  if (matDef.id.includes("linen") || matDef.id.includes("fabric") || matDef.id.includes("keten")) {
    const S = 384;
    const colorCanvas = document.createElement("canvas");
    colorCanvas.width = S;
    colorCanvas.height = S;
    const cCtx = colorCanvas.getContext("2d")!;
    const cImg = cCtx.createImageData(S, S);

    const roughCanvas = document.createElement("canvas");
    roughCanvas.width = S;
    roughCanvas.height = S;
    const rCtx = roughCanvas.getContext("2d")!;
    const rImg = rCtx.createImageData(S, S);
    const heightField = new Float32Array(S * S);

    const [br, bg, bb] = hexToRgb(matDef.colorHex || "#cbbba4");
    for (let y = 0; y < S; y++) {
      const ny = y / S;
      for (let x = 0; x < S; x++) {
        const nx = x / S;
        const warp = Math.sin(nx * Math.PI * 96) * 0.5 + 0.5;
        const weft = Math.sin(ny * Math.PI * 96) * 0.5 + 0.5;
        const slubX = periodicFbm(nx, ny, 24, 3, 3) - 0.5;
        const slubY = periodicFbm(nx + 0.31, ny + 0.17, 3, 24, 3) - 0.5;
        const overUnder = (Math.floor(x / 2) + Math.floor(y / 2)) % 2 === 0 ? warp : weft;
        const delta = (overUnder - 0.5) * 18 + slubX * 22 + slubY * 18;
        const idx = (y * S + x) * 4;
        cImg.data[idx] = clampByte(br + delta);
        cImg.data[idx + 1] = clampByte(bg + delta * 0.96);
        cImg.data[idx + 2] = clampByte(bb + delta * 0.9);
        cImg.data[idx + 3] = 255;

        const rv = clampByte(214 + (0.5 - overUnder) * 24 + slubX * 16);
        rImg.data[idx] = rv;
        rImg.data[idx + 1] = rv;
        rImg.data[idx + 2] = rv;
        rImg.data[idx + 3] = 255;
        heightField[y * S + x] = 0.5 + (overUnder - 0.5) * 0.28 + slubX * 0.14 + slubY * 0.14;
      }
    }
    cCtx.putImageData(cImg, 0, 0);
    rCtx.putImageData(rImg, 0, 0);

    const colorMap = markSharedTexture(new THREE.CanvasTexture(colorCanvas));
    colorMap.wrapS = THREE.RepeatWrapping;
    colorMap.wrapT = THREE.RepeatWrapping;
    colorMap.repeat.set(2.4, 2.4);
    colorMap.colorSpace = THREE.SRGBColorSpace;
    colorMap.anisotropy = 4;
    colorMap.needsUpdate = true;

    const roughnessMap = markSharedTexture(new THREE.CanvasTexture(roughCanvas));
    roughnessMap.wrapS = THREE.RepeatWrapping;
    roughnessMap.wrapT = THREE.RepeatWrapping;
    roughnessMap.repeat.set(2.4, 2.4);
    roughnessMap.needsUpdate = true;

    const normalMap = buildNormalMapFromHeightField(heightField, S, S, 1.45, 2.4, 2.4);
    const set: CachedTextureSet = { colorMap, roughnessMap, normalMap };
    textureCache.set(matDef.id, set);
    return set;
  }

  // 1. HIGH-DEFINITION RIFT-CUT / CATHEDRAL ARCHITECTURAL WOOD VENEERS (768x768 3-Map PBR)
  if (matDef.category === "wood" || (matDef.category === "laminate" && matDef.hasGrain)) {
    const W = 768;
    const H = 768;
    const colorCanvas = document.createElement("canvas");
    colorCanvas.width = W;
    colorCanvas.height = H;
    const cCtx = colorCanvas.getContext("2d")!;

    const roughCanvas = document.createElement("canvas");
    roughCanvas.width = W;
    roughCanvas.height = H;
    const rCtx = roughCanvas.getContext("2d")!;

    const cImg = cCtx.createImageData(W, H);
    const rImg = rCtx.createImageData(W, H);
    const heightField = new Float32Array(W * H);

    const idLow = matDef.id.toLowerCase();
    const isWalnut = idLow.includes("walnut") || idLow.includes("ceviz");
    const isSmoked = idLow.includes("smoked") || idLow.includes("fume");
    const isNordic = idLow.includes("iskandinav") || idLow.includes("nordic");
    const isSafir = idLow.includes("safir");
    const isNaturalOak = idLow.includes("oak") || idLow.includes("mese");
    // Species-calibrated natural architectural veneers
    const calibratedWoodHex = isWalnut
      ? "#593b28"
      : isSmoked
      ? "#44352a"
      : isNordic
      ? "#d5be9d"
      : isSafir
      ? "#bf915d"
      : isNaturalOak
      ? "#be8950"
      : matDef.colorHex || "#be8950";
    const [hr, hg, hb] = hexToRgb(calibratedWoodHex);

    for (let y = 0; y < H; y++) {
      const ny = y / H;
      for (let x = 0; x < W; x++) {
        const nx = x / W;

        // Pure longitudinal rift-cut fiber meander (zero horizontal banding)
        const meander = (periodicFbm(nx, ny, 3, 1, 3) - 0.5) * 0.09;
        const ux = fract(nx + meander);
        const uy = ny;

        const broadHeartwood = periodicFbm(ux, uy, 4, 1, 3);
        const mediumFibers = periodicFbm(ux, uy, isWalnut ? 20 : 26, 2, 4);
        const fineGrain = periodicNoise(ux * 84, uy * 8, 84, 8);

        // Open-pore longitudinal wood vessels (characteristic recessed capillaries of European Oak & American Walnut)
        const poreNoise = periodicNoise(ux * 168 + 0.37, uy * 28 + 0.19, 168, 28);
        const poreDepth = poreNoise > 0.77 ? Math.min(1, (poreNoise - 0.77) * 4.4) : 0;

        // Delicate quarter-sawn silver medullary ray shimmer on Oak
        const medullaryRay = !isWalnut
          ? Math.max(0, periodicNoise(ux * 10 + 0.61, uy * 52, 10, 52) - 0.75) * 0.95
          : 0;

        // Organic non-periodic latewood fiber density (zero periodic sine stripes)
        const latewoodBand = periodicFbm(ux + 0.41, uy, isWalnut ? 10 : 14, 1, 3);

        // Authentic tangential cathedral V-crown growth ring modulation blended with rift-cut flank fibers
        const plankCenter = ((ux * 2.0) % 1.0) - 0.5;
        const cathedralField =
          Math.abs(plankCenter) * (isWalnut ? 11.5 : 14.0) +
          Math.cos(uy * Math.PI * 2) * 1.35 +
          (broadHeartwood - 0.5) * 2.4;
        const ringWave = Math.pow(0.5 + 0.5 * Math.sin(cathedralField * Math.PI * 2), 2.6);
        const flankWeight = Math.min(1, Math.abs(plankCenter) * 2.6);
        const cathedralAccent = (ringWave - 0.35) * (1 - flankWeight * 0.55) * (isWalnut ? 0.16 : 0.12);

        const fiberDelta =
          (broadHeartwood - 0.5) * (isWalnut ? 0.24 : 0.19) +
          (mediumFibers - 0.5) * (isWalnut ? 0.2 : 0.17) +
          (latewoodBand - 0.5) * (isWalnut ? 0.12 : 0.1) +
          cathedralAccent +
          (fineGrain - 0.5) * 0.06 +
          medullaryRay * 0.08 -
          poreDepth * (isWalnut ? 0.22 : 0.17);

        const r = hr * (1 + fiberDelta * 1.04);
        const g = hg * (1 + fiberDelta * 0.98);
        const b = hb * (1 + fiberDelta * 0.9);

        const idx = (y * W + x) * 4;
        cImg.data[idx] = clampByte(r);
        cImg.data[idx + 1] = clampByte(g);
        cImg.data[idx + 2] = clampByte(b);
        cImg.data[idx + 3] = 255;

        // Physical Roughness Map: open pores are recessed & matte (high roughness); latewood ridges are satin-smooth
        const roughByte = clampByte(
          126 + (mediumFibers - 0.5) * 32 + poreDepth * 82 - (latewoodBand - 0.5) * 20 - medullaryRay * 22
        );
        rImg.data[idx] = roughByte;
        rImg.data[idx + 1] = roughByte;
        rImg.data[idx + 2] = roughByte;
        rImg.data[idx + 3] = 255;

        // Physical Micro-Heightfield for Sobel Tangent Normal Map
        heightField[y * W + x] =
          0.55 +
          (mediumFibers - 0.5) * 0.22 +
          (fineGrain - 0.5) * 0.09 +
          (latewoodBand - 0.5) * 0.1 -
          poreDepth * 0.42;
      }
    }

    cCtx.putImageData(cImg, 0, 0);
    rCtx.putImageData(rImg, 0, 0);

    const colorMap = markSharedTexture(new THREE.CanvasTexture(colorCanvas));
    colorMap.wrapS = THREE.RepeatWrapping;
    colorMap.wrapT = THREE.RepeatWrapping;
    colorMap.colorSpace = THREE.SRGBColorSpace;
    colorMap.anisotropy = 4;
    colorMap.needsUpdate = true;

    const roughnessMap = markSharedTexture(new THREE.CanvasTexture(roughCanvas));
    roughnessMap.wrapS = THREE.RepeatWrapping;
    roughnessMap.wrapT = THREE.RepeatWrapping;
    roughnessMap.anisotropy = 4;
    roughnessMap.needsUpdate = true;

    const normalMap = buildNormalMapFromHeightField(heightField, W, H, 1.85, 1, 1);

    const set: CachedTextureSet = {
      colorMap,
      roughnessMap,
      normalMap,
      bumpMap: roughnessMap,
    };
    textureCache.set(matDef.id, set);
    return set;
  }

  // 2. BRUSHED ARCHITECTURAL METALS (Anodized Black, Brushed Brass, Inox, Anthracite)
  if (matDef.category === "metal") {
    const S = 256;
    const roughCanvas = document.createElement("canvas");
    roughCanvas.width = S;
    roughCanvas.height = S;
    const rCtx = roughCanvas.getContext("2d")!;
    const rImg = rCtx.createImageData(S, S);
    const heightField = new Float32Array(S * S);

    for (let y = 0; y < S; y++) {
      const ny = y / S;
      for (let x = 0; x < S; x++) {
        const nx = x / S;
        // Directional fine linear brushing along Y
        const brush = periodicNoise(nx * 128, ny * 6, 128, 6);
        const micro = hash2D(x * 0.8, y * 0.15);
        const idx = (y * S + x) * 4;
        const rv = clampByte(138 + (brush - 0.5) * 38 + (micro - 0.5) * 16);
        rImg.data[idx] = rv;
        rImg.data[idx + 1] = rv;
        rImg.data[idx + 2] = rv;
        rImg.data[idx + 3] = 255;
        heightField[y * S + x] = 0.5 + (brush - 0.5) * 0.25 + (micro - 0.5) * 0.1;
      }
    }
    rCtx.putImageData(rImg, 0, 0);

    const roughnessMap = markSharedTexture(new THREE.CanvasTexture(roughCanvas));
    roughnessMap.wrapS = THREE.RepeatWrapping;
    roughnessMap.wrapT = THREE.RepeatWrapping;
    roughnessMap.anisotropy = 4;
    roughnessMap.needsUpdate = true;

    const normalMap = buildNormalMapFromHeightField(heightField, S, S, 0.9, 1, 1);
    const set: CachedTextureSet = { roughnessMap, normalMap };
    textureCache.set(matDef.id, set);
    return set;
  }

  // 3. SILK MATTE ITALIAN LACQUER & SUPRAMAT MELAMINE (Micro-velvet roughness + subtle sprayed lacquer skin normal)
  if (matDef.category === "lacquer" || matDef.category === "laminate") {
    const S = 256;
    const roughCanvas = document.createElement("canvas");
    roughCanvas.width = S;
    roughCanvas.height = S;
    const rCtx = roughCanvas.getContext("2d")!;
    const rImg = rCtx.createImageData(S, S);
    const heightField = new Float32Array(S * S);

    for (let y = 0; y < S; y++) {
      const ny = y / S;
      for (let x = 0; x < S; x++) {
        const nx = x / S;
        const softSkin = periodicFbm(nx, ny, 12, 12, 3);
        const fineVelvet = hash2D(x * 0.9, y * 0.9);
        const v = clampByte(192 + (softSkin - 0.5) * 18 + (fineVelvet - 0.5) * 12);
        const idx = (y * S + x) * 4;
        rImg.data[idx] = v;
        rImg.data[idx + 1] = v;
        rImg.data[idx + 2] = v;
        rImg.data[idx + 3] = 255;
        heightField[y * S + x] = 0.5 + (softSkin - 0.5) * 0.12 + (fineVelvet - 0.5) * 0.04;
      }
    }
    rCtx.putImageData(rImg, 0, 0);

    const roughnessMap = markSharedTexture(new THREE.CanvasTexture(roughCanvas));
    roughnessMap.wrapS = THREE.RepeatWrapping;
    roughnessMap.wrapT = THREE.RepeatWrapping;
    roughnessMap.repeat.set(2.5, 2.5);
    roughnessMap.anisotropy = 4;
    roughnessMap.needsUpdate = true;

    const normalMap = buildNormalMapFromHeightField(heightField, S, S, 0.35, 2.5, 2.5);

    const set: CachedTextureSet = { roughnessMap, normalMap };
    textureCache.set(matDef.id, set);
    return set;
  }

  // 4. NEOLITH SINTERED STONE, DEKTON, BELENCO & HONED MARBLE VEINING (768x768 3-Map PBR)
  if (matDef.category === "stone") {
    const W = 768;
    const H = 768;
    const colorCanvas = document.createElement("canvas");
    colorCanvas.width = W;
    colorCanvas.height = H;
    const cCtx = colorCanvas.getContext("2d")!;
    const cImg = cCtx.createImageData(W, H);

    const roughCanvas = document.createElement("canvas");
    roughCanvas.width = W;
    roughCanvas.height = H;
    const rCtx = roughCanvas.getContext("2d")!;
    const rImg = rCtx.createImageData(W, H);
    const heightField = new Float32Array(W * H);

    const [br, bg, bb] = hexToRgb(matDef.colorHex || "#f4f3ef");

    const idLower = matDef.id.toLowerCase();
    const isGoldVeined =
      idLower.includes("luxe") || idLower.includes("abu_dhabi") || idLower.includes("entzo");
    const isDarkStone = idLower.includes("basalt") || idLower.includes("piombo");
    const isEmperador = idLower.includes("emperador");

    const veinRgb: [number, number, number] = isGoldVeined
      ? [182, 148, 98]
      : isDarkStone
      ? [210, 206, 198]
      : isEmperador
      ? [235, 225, 210]
      : [148, 146, 142];

    for (let y = 0; y < H; y++) {
      const ny = y / H;
      for (let x = 0; x < W; x++) {
        const nx = x / W;
        const warp = periodicFbm(nx, ny, 4, 4, 4);
        const vein1 = Math.pow(
          Math.max(0, 1 - Math.abs(Math.sin((nx * 2.0 + ny * 2.0 + warp * 1.65) * Math.PI)) * 4.8),
          2.4
        );
        const vein2 =
          Math.pow(
            Math.max(0, 1 - Math.abs(Math.sin((nx * 4.0 - ny * 4.0 + warp * 2.2) * Math.PI)) * 6.5),
            2.9
          ) * 0.55;
        const vFactor = Math.min(1, vein1 + vein2);
        const strength = isDarkStone ? 0.22 : 0.3;
        const idx = (y * W + x) * 4;
        cImg.data[idx] = clampByte(br * (1 - vFactor * strength) + veinRgb[0] * vFactor * strength);
        cImg.data[idx + 1] = clampByte(bg * (1 - vFactor * strength) + veinRgb[1] * vFactor * strength);
        cImg.data[idx + 2] = clampByte(bb * (1 - vFactor * strength) + veinRgb[2] * vFactor * strength);
        cImg.data[idx + 3] = 255;

        const rv = clampByte(72 + warp * 26 + vFactor * 28);
        rImg.data[idx] = rv;
        rImg.data[idx + 1] = rv;
        rImg.data[idx + 2] = rv;
        rImg.data[idx + 3] = 255;

        heightField[y * W + x] = 0.5 + (warp - 0.5) * 0.14 - vFactor * 0.08;
      }
    }
    cCtx.putImageData(cImg, 0, 0);
    rCtx.putImageData(rImg, 0, 0);

    const colorMap = markSharedTexture(new THREE.CanvasTexture(colorCanvas));
    colorMap.wrapS = THREE.RepeatWrapping;
    colorMap.wrapT = THREE.RepeatWrapping;
    colorMap.colorSpace = THREE.SRGBColorSpace;
    colorMap.anisotropy = 4;
    colorMap.needsUpdate = true;

    const roughnessMap = markSharedTexture(new THREE.CanvasTexture(roughCanvas));
    roughnessMap.wrapS = THREE.RepeatWrapping;
    roughnessMap.wrapT = THREE.RepeatWrapping;
    roughnessMap.anisotropy = 4;
    roughnessMap.needsUpdate = true;

    const normalMap = buildNormalMapFromHeightField(heightField, W, H, 0.75, 1, 1);

    const set: CachedTextureSet = { colorMap, roughnessMap, normalMap };
    textureCache.set(matDef.id, set);
    return set;
  }

  return {};
}

const floorTextureCache = new Map<string, THREE.CanvasTexture>();
const floorNormalCache = new Map<string, THREE.CanvasTexture>();
const wallTextureCache = new Map<string, THREE.CanvasTexture>();
const wallNormalCache = new Map<string, THREE.CanvasTexture>();

export type ArchitecturalWallTone =
  | "brut_concrete"
  | "anthracite_gallery"
  | "warm_taupe"
  | "soft_plaster";

/**
 * Procedural Birim Architectural Fair-Faced Concrete ("Brüt Beton") & Micro-Troweled Gallery Wall Texture
 * with paired Sobel Tangent Normal Map for subtle formwork joints and mineral plaster relief.
 */
export function getArchitecturalWallTexture(
  tone: ArchitecturalWallTone
): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const cached = wallTextureCache.get(tone);
  if (cached) return cached;

  const S = 512;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(S, S);
  const heightField = new Float32Array(S * S);

  const palette: Record<ArchitecturalWallTone, [number, number, number]> = {
    brut_concrete: [132, 127, 120],
    anthracite_gallery: [56, 55, 53],
    warm_taupe: [152, 143, 131],
    soft_plaster: [204, 199, 190],
  };
  const [br, bg, bb] = palette[tone];
  const isConcrete = tone === "brut_concrete" || tone === "anthracite_gallery";

  for (let y = 0; y < S; y++) {
    const ny = y / S;
    for (let x = 0; x < S; x++) {
      const nx = x / S;
      const cloud = (periodicFbm(nx, ny, 4, 4, 4) - 0.5) * (isConcrete ? 20 : 11);
      const trowel = (periodicFbm(nx + 0.3, ny + 0.7, 12, 8, 3) - 0.5) * (isConcrete ? 9 : 6);
      const fineMineral = (hash2D(x * 0.7, y * 0.7) - 0.5) * 5;
      const isFormworkJoint = isConcrete && (x % 256 === 0 || y % 256 === 0);

      // Subtle architectural concrete tie-cone dimples at panel centers
      const dxTie = ((x + 128) % 256) - 128;
      const dyTie = ((y + 128) % 256) - 128;
      const distTie = Math.sqrt(dxTie * dxTie + dyTie * dyTie);
      const isTieCone = isConcrete && distTie < 3.6;

      const seamDelta = isFormworkJoint ? -13 : isTieCone ? -18 : 0;

      const idx = (y * S + x) * 4;
      img.data[idx] = clampByte(br + cloud + trowel + fineMineral + seamDelta);
      img.data[idx + 1] = clampByte(bg + cloud + trowel + fineMineral + seamDelta);
      img.data[idx + 2] = clampByte(bb + cloud + trowel + fineMineral + seamDelta);
      img.data[idx + 3] = 255;

      heightField[y * S + x] =
        0.5 +
        cloud * 0.008 +
        trowel * 0.01 -
        (isFormworkJoint ? 0.32 : 0) -
        (isTieCone ? 0.4 : 0);
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = markSharedTexture(new THREE.CanvasTexture(canvas));
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3.2, 2.1);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  wallTextureCache.set(tone, tex);

  const nTex = buildNormalMapFromHeightField(heightField, S, S, 1.35, 3.2, 2.1);
  wallNormalCache.set(tone, nTex);

  return tex;
}

export function getArchitecturalWallNormalMap(
  tone: ArchitecturalWallTone
): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  if (!wallNormalCache.has(tone)) {
    getArchitecturalWallTexture(tone);
  }
  return wallNormalCache.get(tone) || null;
}

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
  const heightField = new Float32Array(S * S);

  for (let y = 0; y < S; y++) {
    const ny = y / S;
    for (let x = 0; x < S; x++) {
      const nx = x / S;
      const idx = (y * S + x) * 4;
      if (style === "oak_parquet" || style === "walnut_parquet") {
        const isWalnut = style === "walnut_parquet";
        const plankRow = Math.floor(y / 64);
        const plankX = (x + (plankRow % 2) * 128) % 256;
        const plankY = y % 64;
        const isMicroJoint = plankX === 0 || plankY === 0;
        const plankSeed = hash2D(plankRow, Math.floor((x + (plankRow % 2) * 128) / 256));
        const fiber =
          (periodicFbm(nx, ny, 8, 40, 3) - 0.5) * 14 + (plankSeed - 0.5) * 9;
        const baseR = isWalnut ? 118 : 182;
        const baseG = isWalnut ? 90 : 162;
        const baseB = isWalnut ? 70 : 136;
        const seamDrop = isMicroJoint ? 22 : 0;
        img.data[idx] = clampByte(baseR + fiber - seamDrop);
        img.data[idx + 1] = clampByte(baseG + fiber * 0.92 - seamDrop);
        img.data[idx + 2] = clampByte(baseB + fiber * 0.82 - seamDrop);
        img.data[idx + 3] = 255;
        heightField[y * S + x] = 0.5 + fiber * 0.008 - (isMicroJoint ? 0.36 : 0);
      } else if (style === "herringbone_oak") {
        const col = Math.floor(x / 64);
        const diag = col % 2 === 0 ? (x + y) % 64 : (x - y + 512) % 64;
        const isSeam = x % 64 === 0 || diag === 0;
        const plankId = Math.floor((col % 2 === 0 ? x + y : x - y + 512) / 64);
        const plankTint = (hash2D(col, plankId) - 0.5) * 9;
        const grain = (periodicFbm(nx, ny, 16, 16, 3) - 0.5) * 14 + plankTint;
        const seamDrop = isSeam ? 28 : 0;
        img.data[idx] = clampByte(178 + grain - seamDrop);
        img.data[idx + 1] = clampByte(158 + grain * 0.92 - seamDrop);
        img.data[idx + 2] = clampByte(132 + grain * 0.82 - seamDrop);
        img.data[idx + 3] = 255;
        heightField[y * S + x] = 0.5 + grain * 0.007 - (isSeam ? 0.35 : 0);
      } else if (style === "neolith_calacatta") {
        const tileX = x % 256;
        const tileY = y % 256;
        const isGrout = tileX === 0 || tileY === 0;
        const warp = periodicFbm(nx, ny, 4, 4, 3);
        const vein = Math.pow(
          Math.max(0, 1 - Math.abs(Math.sin((nx * 2.0 + ny * 2.0 + warp * 1.4) * Math.PI)) * 5.2),
          2.5
        );
        img.data[idx] = isGrout ? 214 : clampByte(240 - vein * 28);
        img.data[idx + 1] = isGrout ? 211 : clampByte(237 - vein * 30);
        img.data[idx + 2] = isGrout ? 205 : clampByte(231 - vein * 34);
        img.data[idx + 3] = 255;
        heightField[y * S + x] = isGrout ? 0.2 : 0.5 - vein * 0.05;
      } else if (style === "microcement") {
        const n = (periodicFbm(nx, ny, 6, 6, 4) - 0.5) * 12;
        img.data[idx] = clampByte(224 + n);
        img.data[idx + 1] = clampByte(220 + n);
        img.data[idx + 2] = clampByte(213 + n);
        img.data[idx + 3] = 255;
        heightField[y * S + x] = 0.5 + n * 0.01;
      } else {
        const tileX = x % 256;
        const tileY = y % 256;
        const isGrout = tileX === 0 || tileY === 0;
        const n = (periodicFbm(nx, ny, 8, 4, 3) - 0.5) * 13;
        img.data[idx] = isGrout ? 202 : clampByte(226 + n);
        img.data[idx + 1] = isGrout ? 196 : clampByte(220 + n);
        img.data[idx + 2] = isGrout ? 186 : clampByte(208 + n);
        img.data[idx + 3] = 255;
        heightField[y * S + x] = isGrout ? 0.22 : 0.5 + n * 0.008;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  const rep = style === "microcement" ? 3 : 4.5;
  const tex = markSharedTexture(new THREE.CanvasTexture(canvas));
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(rep, rep);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  floorTextureCache.set(style, tex);

  const nTex = buildNormalMapFromHeightField(heightField, S, S, 1.1, rep, rep);
  floorNormalCache.set(style, nTex);

  return tex;
}

export function getArchitecturalFloorNormalMap(
  style: ArchitecturalFloorStyle
): THREE.CanvasTexture | null {
  if (typeof document === "undefined" || style === "studio") return null;
  if (!floorNormalCache.has(style)) {
    getArchitecturalFloorTexture(style);
  }
  return floorNormalCache.get(style) || null;
}

let cachedStudioEnvTexture: THREE.DataTexture | null = null;
const pmremTargetByRenderer = new WeakMap<THREE.WebGLRenderer, THREE.WebGLRenderTarget>();

export function disposeRendererPmremEnvironment(
  renderer: THREE.WebGLRenderer | null | undefined
): void {
  if (!renderer) return;
  const target = pmremTargetByRenderer.get(renderer);
  if (target) {
    target.dispose();
    pmremTargetByRenderer.delete(renderer);
  }
}

/**
 * High-Contrast Architectural Photography Studio HDRI Rig (PMREM IBL):
 * - Dark gallery negative-fill enclosure ([0.16, 0.15, 0.14]) for luxury Fresnel contrast on glass, mirrors & lacquer
 * - 4-Bay Floor-to-Ceiling North Daylight Window Wall with dark structural mullions (creates crisp architectural window reflections!)
 * - Diffused overhead architectural softbox scrim + warm indirect travertine/oak floor & cove bounce
 */
export function getStudioPmremEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const existingTarget = pmremTargetByRenderer.get(renderer);
  if (existingTarget) return existingTarget.texture;
  try {
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileCubemapShader();

    const envScene = new THREE.Scene();

    // Rich architectural charcoal-stone negative fill enclosure so glass & satin lacquer reflections never wash out
    const roomBox = new THREE.Mesh(
      new THREE.BoxGeometry(40, 28, 40),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.22, 0.21, 0.195),
        side: THREE.BackSide,
      })
    );
    envScene.add(roomBox);

    // Warm oak / limestone floor bounce
    const floorBounce = new THREE.Mesh(
      new THREE.PlaneGeometry(36, 36),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.68, 0.59, 0.48),
        side: THREE.DoubleSide,
        toneMapped: false,
      })
    );
    floorBounce.rotation.x = -Math.PI / 2;
    floorBounce.position.set(0, -13.2, 0);
    envScene.add(floorBounce);

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

    // 1. 4-Bay Floor-to-Ceiling North Daylight Window Bank (Right-Front: creates real mullion reflections on glass & lacquer!)
    const bayZPositions = [-4.5, 1.5, 7.5, 13.5];
    bayZPositions.forEach((bz, idx) => {
      const skyBoost = 1 - idx * 0.05;
      // Upper sky pane
      addLightformer(
        4.9,
        10.5,
        [19.2, 6.2, bz],
        [0, -Math.PI / 2, 0],
        [6.4 * skyBoost, 6.18 * skyBoost, 5.85 * skyBoost]
      );
      // Lower garden/horizon pane
      addLightformer(
        4.9,
        9.5,
        [19.2, -4.4, bz],
        [0, -Math.PI / 2, 0],
        [3.9 * skyBoost, 3.72 * skyBoost, 3.45 * skyBoost]
      );
    });

    // 2. Overhead Architectural Softbox Ceiling Scrim
    addLightformer(18, 14, [1.5, 13.4, 4], [Math.PI / 2, 0, 0], [3.35, 3.28, 3.16]);

    // 3. Warm Opposite Plaster Bounce Wall + Warm 3000K Cove Accent (Left)
    addLightformer(16, 18, [-19.2, 1.5, 4], [0, Math.PI / 2, 0], [1.45, 1.35, 1.22]);
    addLightformer(14, 1.8, [-18.8, 10.5, 5], [0, Math.PI / 2, 0], [3.1, 2.35, 1.55]);

    // 4. Subtle Front Fill Strip for Handle & Bevel Edge Specular Glints
    addLightformer(20, 5.5, [-1.5, 5.8, 19.2], [0, Math.PI, 0], [2.45, 2.4, 2.32]);

    const renderTarget = pmremGenerator.fromScene(envScene, 0.03);
    markSharedTexture(renderTarget.texture);
    pmremTargetByRenderer.set(renderer, renderTarget);

    envScene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (obj.material instanceof THREE.Material) obj.material.dispose();
      }
    });
    envScene.clear();
    pmremGenerator.dispose();
    return renderTarget.texture;
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
    const v = y / (height - 1);
    for (let x = 0; x < width; x++) {
      const u = x / (width - 1);
      const softboxKey = Math.exp(-Math.pow((u - 0.24) * 5.2, 2) - Math.pow((v - 0.65) * 4.2, 2));
      const softboxFill = Math.exp(-Math.pow((u - 0.78) * 5.0, 2) - Math.pow((v - 0.56) * 5.0, 2));
      const topSkylight = Math.exp(-Math.pow((v - 0.92) * 4.0, 2));

      const skyR = 186 + softboxKey * 66 + softboxFill * 30 + topSkylight * 36;
      const skyG = 182 + softboxKey * 64 + softboxFill * 28 + topSkylight * 35;
      const skyB = 176 + softboxKey * 58 + softboxFill * 26 + topSkylight * 33;

      const groundR = 132;
      const groundG = 124;
      const groundB = 112;

      const blend = Math.pow(v, 0.78);
      const r = clampByte(groundR * (1 - blend) + skyR * blend);
      const g = clampByte(groundG * (1 - blend) + skyG * blend);
      const b = clampByte(groundB * (1 - blend) + skyB * blend);

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
  markSharedTexture(tex);
  cachedStudioEnvTexture = tex;
  return tex;
}

function getRotatedClone(
  baseTex: THREE.CanvasTexture | undefined,
  cacheKey: string,
  rotRad: number
): THREE.CanvasTexture | null {
  if (!baseTex) return null;
  if (rotRad === 0) return baseTex;
  let rot = rotatedTexCache.get(cacheKey);
  if (!rot) {
    rot = baseTex.clone();
    rot.center.set(0.5, 0.5);
    rot.rotation = rotRad;
    rot.needsUpdate = true;
    markSharedTexture(rot);
    rotatedTexCache.set(cacheKey, rot);
  }
  return rot;
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

  const emissive = isSelected ? new THREE.Color(0x1d4ed8) : new THREE.Color(0x000000);
  const emissiveIntensity = isSelected ? 0.18 : 0.0;

  // 0A. Custom User-Uploaded Texture (.JPG / .PNG DataURL or URL)
  if (matDef.textureUrl) {
    const rotRad =
      grainDirection === "crosswise"
        ? Math.PI / 2
        : grainDirection === "custom"
        ? Math.PI / 4
        : 0;
    const userTex = getOrLoadCustomImageTexture(matDef, rotRad);
    const effRough =
      surfaceFinishOverride === "gloss"
        ? 0.08
        : surfaceFinishOverride === "satin"
        ? 0.32
        : surfaceFinishOverride === "matte"
        ? 0.68
        : matDef.roughness ?? 0.48;
    const customMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#ffffff"),
      map: userTex,
      roughness: effRough,
      metalness: matDef.metalness ?? 0.04,
      clearcoat: effRough < 0.2 ? 0.85 : 0.15,
      clearcoatRoughness: effRough < 0.2 ? 0.06 : 0.35,
      envMapIntensity: 1.05,
      emissive,
      emissiveIntensity,
    });
    markSharedMaterial(customMat);
    pbrMaterialCache.set(key, customMat);
    return customMat;
  }

  // 0. Multi-Kelvin Architectural Recessed LED Diffuser Materials (2700K / 3000K / 4000K)
  if (matDef.id.startsWith("mat_led_")) {
    const is2700 = matDef.id.includes("2700");
    const is4000 = matDef.id.includes("4000");
    const emissiveHex = is2700 ? "#ffb04a" : is4000 ? "#fff1d8" : "#ffce70";
    const coreHex = is2700 ? "#ffe4b8" : is4000 ? "#ffffff" : "#fff2d6";
    const ledMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(coreHex),
      emissive: new THREE.Color(emissiveHex),
      emissiveIntensity: isSelected ? 4.0 : 3.45,
      roughness: 0.16,
      metalness: 0.0,
      envMapIntensity: 0.12,
      clearcoat: 0.4,
    });
    markSharedMaterial(ledMat);
    pbrMaterialCache.set(key, ledMat);
    return ledMat;
  }

  // 1. Brushed Architectural Hardware (Honors Matte Black K019, Satin Inox K020, Brushed Brass K021, Anthracite K022!)
  if (isRailOrMetalFitting || matDef.category === "metal") {
    const idLow = matDef.id.toLowerCase();
    const isMatteBlack = idLow.includes("black") || idLow.includes("siyah");
    const isBrass = idLow.includes("brass") || idLow.includes("pirinc") || idLow.includes("bronze");
    const isAnthracite = idLow.includes("anthracite") || idLow.includes("antrasit");

    const metalColor = isMatteBlack
      ? "#1d1d1b"
      : isBrass
      ? "#bfa065"
      : isAnthracite
      ? "#3d3e42"
      : matDef.category === "metal" && matDef.colorHex
      ? matDef.colorHex
      : "#d4cfc6";

    const metalMaps = getOrCreateProceduralMaps({
      ...matDef,
      id: `metal_brush_${isMatteBlack ? "blk" : isBrass ? "brs" : isAnthracite ? "ant" : "inx"}`,
      category: "metal",
    });

    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(metalColor),
      metalness: isMatteBlack ? 0.72 : 0.92,
      roughness: isMatteBlack ? 0.38 : isBrass ? 0.24 : 0.2,
      roughnessMap: metalMaps.roughnessMap || null,
      normalMap: metalMaps.normalMap || null,
      normalScale: new THREE.Vector2(0.16, 0.16),
      clearcoat: isMatteBlack ? 0.12 : 0.4,
      clearcoatRoughness: 0.22,
      ior: 1.65,
      reflectivity: 0.95,
      envMapIntensity: isMatteBlack ? 1.15 : 1.45,
      emissive,
      emissiveIntensity,
    });
    markSharedMaterial(mat);
    pbrMaterialCache.set(key, mat);
    return mat;
  }

  // 2. Architectural Bronze / Silver Mirror
  if (matDef.category === "mirror" || matDef.id.includes("mirror") || matDef.id.includes("ayna")) {
    const isBronze = matDef.id.toLowerCase().includes("bronze") || matDef.id.toLowerCase().includes("bronz");
    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(isBronze ? "#cbb69e" : "#e6eaef"),
      metalness: 0.98,
      roughness: 0.025,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      ior: 1.55,
      reflectivity: 1.0,
      envMapIntensity: 1.55,
      emissive,
      emissiveIntensity,
    });
    markSharedMaterial(mat);
    pbrMaterialCache.set(key, mat);
    return mat;
  }

  // 3. 60-FPS Architectural Smoked / Fluted Showcase Glass (Zero transmissionRenderTarget double-pass!)
  if (matDef.category === "glass" || matDef.id.includes("glass")) {
    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(matDef.colorHex || "#2b333d"),
      metalness: 0.12,
      roughness: 0.06,
      transmission: 0,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
      reflectivity: 0.92,
      clearcoat: 0.55,
      clearcoatRoughness: 0.04,
      envMapIntensity: 1.45,
      emissive,
      emissiveIntensity,
    });
    markSharedMaterial(mat);
    pbrMaterialCache.set(key, mat);
    return mat;
  }

  // 3B. Dedicated Physical Textile / Woven Linen Class (`fabric`)
  if (matDef.id.includes("linen") || matDef.id.includes("fabric") || matDef.id.includes("keten")) {
    const fMaps = getOrCreateProceduralMaps(matDef);
    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#ffffff"),
      map: fMaps.colorMap || null,
      roughnessMap: fMaps.roughnessMap || null,
      normalMap: fMaps.normalMap || null,
      normalScale: new THREE.Vector2(0.32, 0.32),
      roughness: 0.86,
      metalness: 0.0,
      sheen: 0.78,
      sheenRoughness: 0.58,
      sheenColor: new THREE.Color("#faf6ef"),
      envMapIntensity: 0.55,
      emissive,
      emissiveIntensity,
    });
    markSharedMaterial(mat);
    pbrMaterialCache.set(key, mat);
    return mat;
  }

  const maps = getOrCreateProceduralMaps(matDef);

  // 4. Natural Rift-Cut Wood Veneers (Oak & Walnut) with 3-Map PBR (Albedo + Pore Roughness + Sobel Normal)
  if (matDef.category === "wood" || (matDef.category === "laminate" && matDef.hasGrain)) {
    const rotRad =
      grainDirection === "lengthwise"
        ? 0
        : grainDirection === "crosswise"
        ? Math.PI / 2
        : Math.PI / 4;
    const colorTex = getRotatedClone(maps.colorMap, `${matDef.id}_c_${grainDirection}`, rotRad);
    const roughTex = getRotatedClone(maps.roughnessMap, `${matDef.id}_r_${grainDirection}`, rotRad);
    const normTex = getRotatedClone(maps.normalMap, `${matDef.id}_n_${grainDirection}`, rotRad);

    const roughVal =
      surfaceFinishOverride === "gloss"
        ? 0.16
        : surfaceFinishOverride === "satin"
        ? 0.36
        : surfaceFinishOverride === "matte"
        ? 0.56
        : 0.44;
    const clearcoatVal = surfaceFinishOverride === "gloss" ? 0.78 : 0;

    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#ffffff"),
      map: colorTex,
      roughnessMap: roughTex,
      normalMap: normTex,
      normalScale: new THREE.Vector2(0.38, 0.38),
      roughness: roughVal,
      metalness: 0.01,
      ior: 1.5,
      specularIntensity: 0.82,
      clearcoat: clearcoatVal,
      clearcoatRoughness: surfaceFinishOverride === "gloss" ? 0.08 : 0.32,
      reflectivity: 0.56,
      envMapIntensity: 0.92,
      emissive,
      emissiveIntensity,
    });
    markSharedMaterial(mat);
    pbrMaterialCache.set(key, mat);
    return mat;
  }

  // 5. Honed / Polished Calacatta Marble & Sintered Stone Countertop
  if (matDef.category === "stone" || matDef.id.includes("stone") || matDef.id.includes("calacatta")) {
    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#ffffff"),
      map: maps.colorMap || null,
      roughnessMap: maps.roughnessMap || null,
      normalMap: maps.normalMap || null,
      normalScale: new THREE.Vector2(0.22, 0.22),
      roughness: 0.18,
      metalness: 0.02,
      ior: 1.54,
      specularIntensity: 0.94,
      clearcoat: 0.82,
      clearcoatRoughness: 0.09,
      reflectivity: 0.92,
      envMapIntensity: 1.28,
      emissive,
      emissiveIntensity,
    });
    markSharedMaterial(mat);
    pbrMaterialCache.set(key, mat);
    return mat;
  }

  // 6. Silk Matte Italian Lacquer & Soft-Touch Supramat (with physical 85% diffuse ceiling so whites sculpt in 3D!)
  if (matDef.category === "lacquer") {
    const [rawR, rawG, rawB] = hexToRgb(matDef.colorHex);
    const r = Math.min(226, Math.round(rawR * 0.91));
    const g = Math.min(224, Math.round(rawG * 0.905));
    const b = Math.min(219, Math.round(rawB * 0.895));
    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(`rgb(${r}, ${g}, ${b})`),
      roughnessMap: maps.roughnessMap || null,
      normalMap: maps.normalMap || null,
      normalScale: new THREE.Vector2(0.05, 0.05),
      roughness: surfaceFinishOverride === "gloss" || (matDef.roughness ?? 0.35) <= 0.12 ? 0.06 : 0.28,
      metalness: 0.01,
      ior: 1.5,
      specularIntensity: 0.85,
      sheen: 0,
      clearcoat: surfaceFinishOverride === "gloss" || (matDef.roughness ?? 0.35) <= 0.12 ? 0.88 : 0,
      clearcoatRoughness: surfaceFinishOverride === "gloss" ? 0.05 : 0.26,
      reflectivity: 0.62,
      envMapIntensity: 0.88,
      emissive,
      emissiveIntensity,
    });
    markSharedMaterial(mat);
    pbrMaterialCache.set(key, mat);
    return mat;
  }

  // 7. Calibrated Architectural Melamine / MDF-Lam (physical 85% max albedo prevents flat #FFFFFF blowout!)
  const [mRawR, mRawG, mRawB] = hexToRgb(matDef.colorHex);
  const mR = Math.min(225, Math.round(mRawR * 0.905));
  const mG = Math.min(223, Math.round(mRawG * 0.9));
  const mB = Math.min(218, Math.round(mRawB * 0.89));
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(`rgb(${mR}, ${mG}, ${mB})`),
    roughnessMap: maps.roughnessMap || null,
    normalMap: maps.normalMap || null,
    normalScale: new THREE.Vector2(0.04, 0.04),
    roughness: surfaceFinishOverride === "gloss" ? 0.13 : 0.36,
    metalness: 0.01,
    ior: 1.49,
    specularIntensity: 0.72,
    sheen: 0,
    clearcoat: surfaceFinishOverride === "gloss" ? 0.75 : 0,
    clearcoatRoughness: surfaceFinishOverride === "gloss" ? 0.07 : 0.32,
    reflectivity: 0.54,
    envMapIntensity: 0.82,
    emissive,
    emissiveIntensity,
  });
  markSharedMaterial(mat);
  pbrMaterialCache.set(key, mat);
  return mat;
}

export function getPbrCacheStats(): { texturesCount: number; materialsCount: number } {
  return {
    texturesCount:
      textureCache.size * 3 +
      rotatedTexCache.size +
      floorTextureCache.size +
      floorNormalCache.size +
      wallTextureCache.size +
      wallNormalCache.size,
    materialsCount: pbrMaterialCache.size,
  };
}

export function computePhysicalUvScale(
  widthMm: number,
  heightMm: number,
  grain: "lengthwise" | "crosswise" | "none" = "lengthwise"
): { repeatX: number; repeatY: number; rotationRad: number } {
  const referenceTileMm = 650;
  const repeatX = Math.max(0.1, Number((widthMm / referenceTileMm).toFixed(3)));
  const repeatY = Math.max(0.1, Number((heightMm / referenceTileMm).toFixed(3)));
  const rotationRad = grain === "crosswise" ? Math.PI / 2 : 0;
  return { repeatX, repeatY, rotationRad };
}


export type PhysicalMaterialClass =
  | "wood"
  | "lacquer"
  | "fabric"
  | "metal"
  | "glass"
  | "mirror"
  | "stone"
  | "melamine";

export function classifyPhysicalMaterial(matDef: MaterialDefinition): PhysicalMaterialClass {
  const idLow = (matDef.id || "").toLowerCase();
  if (idLow.includes("linen") || idLow.includes("fabric") || idLow.includes("keten")) return "fabric";
  if (matDef.category === "glass" || idLow.includes("glass")) return "glass";
  if (matDef.category === "mirror" || idLow.includes("mirror") || idLow.includes("ayna")) return "mirror";
  if (matDef.category === "metal") return "metal";
  if (matDef.category === "stone" || idLow.includes("calacatta") || idLow.includes("neolith")) return "stone";
  if (matDef.category === "wood" || (matDef.category === "laminate" && matDef.hasGrain)) return "wood";
  if (matDef.category === "lacquer") return "lacquer";
  return "melamine";
}

const swatchDataUrlCache = new Map<string, string>();

/**
 * Generates and caches a crisp 96x96 photorealistic material swatch DataURL for UI cards,
 * dropdowns, and callout badges so every wood veneer, stone slab, smoked glass, mirror,
 * woven linen, brushed metal, and soft-touch lacquer displays accurate visual character.
 */
export function getMaterialPreviewDataUrl(matDef: MaterialDefinition | undefined | null): string {
  if (!matDef || typeof document === "undefined") return "";
  const hit = swatchDataUrlCache.get(matDef.id);
  if (hit) return hit;

  const S = 96;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const ctx = c.getContext("2d");
  if (!ctx) return "";

  const cls = classifyPhysicalMaterial(matDef);

  if (cls === "wood" || cls === "stone" || cls === "fabric") {
    const maps = getOrCreateProceduralMaps(matDef);
    const srcImg = maps.colorMap?.image as HTMLCanvasElement | undefined;
    if (srcImg) {
      ctx.drawImage(srcImg, 0, 0, Math.min(384, srcImg.width), Math.min(384, srcImg.height), 0, 0, S, S);
      // Soft studio directional lighting gradient across swatch
      const sheen = ctx.createLinearGradient(0, 0, S, S);
      sheen.addColorStop(0, "rgba(255,255,255,0.16)");
      sheen.addColorStop(0.5, "rgba(255,255,255,0)");
      sheen.addColorStop(1, "rgba(0,0,0,0.14)");
      ctx.fillStyle = sheen;
      ctx.fillRect(0, 0, S, S);
      const url = c.toDataURL("image/png");
      swatchDataUrlCache.set(matDef.id, url);
      return url;
    }
  }

  if (cls === "glass") {
    const g = ctx.createLinearGradient(0, 0, S, S);
    g.addColorStop(0, "#3b4450");
    g.addColorStop(0.45, "#232931");
    g.addColorStop(1, "#181d23");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    // Crisp architectural window reflection slash + dark aluminum perimeter frame
    ctx.fillStyle = "rgba(255,255,255,0.24)";
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(42, 0);
    ctx.lineTo(0, 56);
    ctx.lineTo(0, 22);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#111317";
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, S - 6, S - 6);
    const url = c.toDataURL("image/png");
    swatchDataUrlCache.set(matDef.id, url);
    return url;
  }

  if (cls === "mirror") {
    const isBronze = matDef.id.toLowerCase().includes("bronze") || matDef.id.toLowerCase().includes("bronz");
    const g = ctx.createLinearGradient(0, 0, S, S);
    g.addColorStop(0, isBronze ? "#efe0cc" : "#f8fafc");
    g.addColorStop(0.48, isBronze ? "#bfa488" : "#cbd5e1");
    g.addColorStop(0.54, isBronze ? "#fff5e8" : "#ffffff");
    g.addColorStop(1, isBronze ? "#7b654f" : "#64748b");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = 2;
    ctx.strokeRect(5, 5, S - 10, S - 10);
    const url = c.toDataURL("image/png");
    swatchDataUrlCache.set(matDef.id, url);
    return url;
  }

  // Lacquer / Melamine / Metal brushed or velvet sheen
  const baseHex = matDef.colorHex || "#e5e5e0";
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, S, S);
  const isGloss = (matDef.roughness ?? 0.4) <= 0.15 || matDef.id.includes("evogloss");
  const grad = ctx.createLinearGradient(0, 0, S, S);
  grad.addColorStop(0, isGloss ? "rgba(255,255,255,0.42)" : "rgba(255,255,255,0.18)");
  grad.addColorStop(0.45, "rgba(255,255,255,0.02)");
  grad.addColorStop(1, "rgba(0,0,0,0.14)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, S, S);
  const url = c.toDataURL("image/png");
  swatchDataUrlCache.set(matDef.id, url);
  return url;
}

export function getMaterialSwatchStyle(
  matDef: MaterialDefinition | undefined | null
): { backgroundColor: string; backgroundImage?: string; backgroundSize?: string; backgroundPosition?: string } {
  const fallbackHex = matDef?.colorHex || "#d6d3cd";
  if (matDef?.textureUrl) {
    return {
      backgroundColor: fallbackHex,
      backgroundImage: `url("${matDef.textureUrl}")`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    };
  }
  if (!matDef) return { backgroundColor: fallbackHex };

  // Check if a cached dataUrl already exists from 3D/export usage without forcing heavy procedural map generation
  const cachedUrl = swatchDataUrlCache.get(matDef.id);
  if (cachedUrl) {
    return {
      backgroundColor: fallbackHex,
      backgroundImage: `url("${cachedUrl}")`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    };
  }

  const cls = classifyPhysicalMaterial(matDef);
  if (cls === "glass") {
    return {
      backgroundColor: "#232931",
      backgroundImage:
        "linear-gradient(135deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.06) 38%, rgba(24,29,35,0.7) 100%)",
    };
  }
  if (cls === "mirror") {
    const isBronze =
      matDef.id.toLowerCase().includes("bronze") || matDef.id.toLowerCase().includes("bronz");
    return {
      backgroundColor: fallbackHex,
      backgroundImage: isBronze
        ? "linear-gradient(135deg, #efe0cc 0%, #bfa488 48%, #fff5e8 54%, #7b654f 100%)"
        : "linear-gradient(135deg, #f8fafc 0%, #cbd5e1 48%, #ffffff 54%, #64748b 100%)",
    };
  }

  const isGloss = (matDef.roughness ?? 0.4) <= 0.15 || matDef.id.includes("evogloss");
  return {
    backgroundColor: fallbackHex,
    backgroundImage: isGloss
      ? "linear-gradient(135deg, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.02) 48%, rgba(0,0,0,0.12) 100%)"
      : "linear-gradient(135deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.02) 50%, rgba(0,0,0,0.1) 100%)",
  };
}
