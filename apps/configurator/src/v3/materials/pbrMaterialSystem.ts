import * as THREE from "three";
import { MaterialDefinition } from "@birim/core";
import { markSharedMaterial, markSharedTexture } from "./webglResourceGuard";

interface CachedTextureSet {
  colorMap?: THREE.CanvasTexture;
  roughnessMap?: THREE.CanvasTexture;
  bumpMap?: THREE.CanvasTexture;
}

const textureCache = new Map<string, CachedTextureSet>();
const rotatedTexCache = new Map<string, THREE.CanvasTexture>();
const pbrMaterialCache = new Map<string, THREE.MeshPhysicalMaterial>();

/**
 * Deterministic pseudo-random noise helpers for realistic rift-cut / quarter-sawn
 * architectural wood fibers, medullary rays, pores, and honed stone veining.
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

function fbm(x: number, y: number, octaves = 4): number {
  let val = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    val += amp * smoothNoise(x * freq, y * freq);
    freq *= 2.03;
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
 * Generates seamless, non-periodic Rift-Cut European Oak / American Walnut Veneer,
 * Silk-Matte Supramat micro-roughness, or Honed Sintered Stone CanvasTextures once
 * and caches them permanently on GPU.
 */
function getOrCreateProceduralMaps(matDef: MaterialDefinition): CachedTextureSet {
  const cached = textureCache.get(matDef.id);
  if (cached) return cached;

  if (typeof document === "undefined") {
    return {};
  }

  // 1. ARCHITECTURAL RIFT-CUT / QUARTER-SAWN WOOD VENEERS & GRAINED LAMINATES
  // Zero periodic sine-wave "zebra stripes" — pure organic longitudinal fiber bundles, micro-pores & warm heartwood drift.
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

    const idLow = matDef.id.toLowerCase();
    const isWalnut = idLow.includes("walnut") || idLow.includes("ceviz");
    const isSmoked = idLow.includes("smoked") || idLow.includes("fume");
    const [hr, hg, hb] = hexToRgb(
      matDef.colorHex || (isWalnut ? "#684936" : isSmoked ? "#4a3b31" : "#c8a982")
    );

    // Tileable periodic domain wrap helper via 2-angle blend along X/Y
    for (let y = 0; y < H; y++) {
      const ny = y / H;
      for (let x = 0; x < W; x++) {
        const nx = x / W;

        // Gentle organic lateral fiber meander (keeps grain natural, never ruler-straight or zebra-striped)
        const meander = (fbm(nx * 3.2 + 5.1, ny * 1.4 + 2.3, 3) - 0.5) * 0.14;
        const ux = nx + meander;

        // Multi-scale rift-cut longitudinal wood fiber bands (stretched 14x vertically along Y)
        const broadTone = fbm(ux * 5.5 + 1.7, ny * 0.85 + 0.4, 3); // soft heartwood/sapwood warmth
        const mediumFibers = fbm(ux * (isWalnut ? 22.0 : 28.0) + 3.4, ny * 2.2, 4);
        const fineFibers = smoothNoise(ux * 78.0 + 7.2, ny * 6.5);

        // Open-pore wood vessels (tiny dark recessed vertical capillaries characteristic of real oak & walnut)
        const poreField = smoothNoise(ux * 155.0 + 11.3, ny * 24.0 + 4.1);
        const poreDepth = poreField > 0.79 ? Math.min(1, (poreField - 0.79) * 4.2) : 0;

        // Delicate quarter-sawn medullary fleck shimmer on Oak
        const rayShimmer = !isWalnut
          ? Math.max(0, smoothNoise(ux * 9.0 + 19.0, ny * 46.0) - 0.74) * 0.9
          : 0;

        // Subtle, refined architectural contrast (around +-9% luminance modulation — calm gallery luxury)
        const fiberDelta =
          (broadTone - 0.5) * (isWalnut ? 0.22 : 0.16) +
          (mediumFibers - 0.5) * (isWalnut ? 0.18 : 0.14) +
          (fineFibers - 0.5) * 0.06 +
          rayShimmer * 0.07 -
          poreDepth * (isWalnut ? 0.16 : 0.13);

        const r = hr * (1 + fiberDelta * 0.96);
        const g = hg * (1 + fiberDelta * 0.99);
        const b = hb * (1 + fiberDelta * 1.05);

        const idx = (y * W + x) * 4;
        cImg.data[idx] = clampByte(r);
        cImg.data[idx + 1] = clampByte(g);
        cImg.data[idx + 2] = clampByte(b);
        cImg.data[idx + 3] = 255;

        // Micro-bump & roughness map: wood pores are slightly recessed & matte; latewood fibers satin-smooth
        const roughVal = clampByte(152 + (mediumFibers - 0.5) * 28 + poreDepth * 58 - rayShimmer * 18);
        bImg.data[idx] = roughVal;
        bImg.data[idx + 1] = roughVal;
        bImg.data[idx + 2] = roughVal;
        bImg.data[idx + 3] = 255;
      }
    }

    cCtx.putImageData(cImg, 0, 0);
    bCtx.putImageData(bImg, 0, 0);

    const colorMap = markSharedTexture(new THREE.CanvasTexture(colorCanvas));
    colorMap.wrapS = THREE.RepeatWrapping;
    colorMap.wrapT = THREE.RepeatWrapping;
    colorMap.repeat.set(1.15, 1.65);
    colorMap.colorSpace = THREE.SRGBColorSpace;
    colorMap.anisotropy = 4;
    colorMap.needsUpdate = true;

    const bumpMap = markSharedTexture(new THREE.CanvasTexture(bumpCanvas));
    bumpMap.wrapS = THREE.RepeatWrapping;
    bumpMap.wrapT = THREE.RepeatWrapping;
    bumpMap.repeat.set(1.15, 1.65);
    bumpMap.anisotropy = 4;
    bumpMap.needsUpdate = true;

    const set: CachedTextureSet = { colorMap, bumpMap, roughnessMap: bumpMap };
    textureCache.set(matDef.id, set);
    return set;
  }

  // 2. SILK MATTE LACQUER & SUPRAMAT MELAMINE (Ultra-fine architectural micro-velvet roughness)
  if (matDef.category === "lacquer" || matDef.category === "laminate") {
    const S = 128;
    const roughCanvas = document.createElement("canvas");
    roughCanvas.width = S;
    roughCanvas.height = S;
    const rCtx = roughCanvas.getContext("2d")!;
    const rImg = rCtx.createImageData(S, S);

    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const n = hash2D(x * 0.9, y * 0.9);
        const v = Math.round(206 + n * 18);
        const idx = (y * S + x) * 4;
        rImg.data[idx] = v;
        rImg.data[idx + 1] = v;
        rImg.data[idx + 2] = v;
        rImg.data[idx + 3] = 255;
      }
    }
    rCtx.putImageData(rImg, 0, 0);

    const roughnessMap = markSharedTexture(new THREE.CanvasTexture(roughCanvas));
    roughnessMap.wrapS = THREE.RepeatWrapping;
    roughnessMap.wrapT = THREE.RepeatWrapping;
    roughnessMap.repeat.set(3, 3);
    roughnessMap.needsUpdate = true;

    const set: CachedTextureSet = { roughnessMap };
    textureCache.set(matDef.id, set);
    return set;
  }

  // 3. NEOLITH SINTERED STONE, DEKTON, BELENCO, ÇİMSTONE & HONED MARBLE VEINING
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

    const veinRgb: [number, number, number] = isGoldVeined
      ? [182, 148, 98]
      : isDarkStone
      ? [210, 206, 198]
      : isEmperador
      ? [235, 225, 210]
      : [148, 146, 142];

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const nx = x / W;
        const ny = y / H;
        const warp = fbm(nx * 4.2, ny * 4.2);
        const vein1 = Math.pow(
          Math.max(0, 1 - Math.abs(Math.sin((nx * 2.8 + ny * 2.0 + warp * 1.65) * Math.PI)) * 4.8),
          2.4
        );
        const vein2 =
          Math.pow(
            Math.max(0, 1 - Math.abs(Math.sin((nx * 6.2 - ny * 3.8 + warp * 2.2) * Math.PI)) * 6.5),
            2.9
          ) * 0.55;
        const vFactor = Math.min(1, vein1 + vein2);
        const strength = isDarkStone ? 0.22 : 0.3;
        const idx = (y * W + x) * 4;
        cImg.data[idx] = clampByte(br * (1 - vFactor * strength) + veinRgb[0] * vFactor * strength);
        cImg.data[idx + 1] = clampByte(bg * (1 - vFactor * strength) + veinRgb[1] * vFactor * strength);
        cImg.data[idx + 2] = clampByte(bb * (1 - vFactor * strength) + veinRgb[2] * vFactor * strength);
        cImg.data[idx + 3] = 255;
      }
    }
    cCtx.putImageData(cImg, 0, 0);
    const colorMap = markSharedTexture(new THREE.CanvasTexture(colorCanvas));
    colorMap.wrapS = THREE.RepeatWrapping;
    colorMap.wrapT = THREE.RepeatWrapping;
    colorMap.colorSpace = THREE.SRGBColorSpace;
    colorMap.anisotropy = 4;
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

/**
 * Calm, wide-format architectural gallery floor textures with subtle micro-bevel joints
 * so the furniture remains the visual focal point (zero harsh cartoon grids).
 */
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
        const plankRow = Math.floor(y / 85);
        const plankX = (x + (plankRow % 2) * 192) % 384;
        const plankY = y % 85;
        const isMicroJoint = plankX === 0 || plankY === 0;
        const plankSeed = hash2D(plankRow, Math.floor((x + (plankRow % 2) * 192) / 384));
        const fiber =
          (fbm((x / S) * 6, (y / S) * 42, 3) - 0.5) * 12 + (plankSeed - 0.5) * 8;
        const baseR = isWalnut ? 136 : 216;
        const baseG = isWalnut ? 108 : 202;
        const baseB = isWalnut ? 86 : 182;
        const seamDrop = isMicroJoint ? 16 : 0;
        img.data[idx] = clampByte(baseR + fiber - seamDrop);
        img.data[idx + 1] = clampByte(baseG + fiber * 0.92 - seamDrop);
        img.data[idx + 2] = clampByte(baseB + fiber * 0.82 - seamDrop);
        img.data[idx + 3] = 255;
      } else if (style === "herringbone_oak") {
        const col = Math.floor(x / 85);
        const diag = col % 2 === 0 ? (x + y) % 85 : (x - y + 512) % 85;
        const isSeam = x % 85 === 0 || diag === 0;
        const grain = (fbm((x / S) * 14, (y / S) * 14, 3) - 0.5) * 10;
        const seamDrop = isSeam ? 14 : 0;
        img.data[idx] = clampByte(218 + grain - seamDrop);
        img.data[idx + 1] = clampByte(205 + grain * 0.92 - seamDrop);
        img.data[idx + 2] = clampByte(186 + grain * 0.82 - seamDrop);
        img.data[idx + 3] = 255;
      } else if (style === "neolith_calacatta") {
        const tileX = x % 256;
        const tileY = y % 256;
        const isGrout = tileX === 0 || tileY === 0;
        const warp = fbm((x / S) * 3.5, (y / S) * 3.5, 3);
        const vein = Math.pow(
          Math.max(0, 1 - Math.abs(Math.sin(((x / S) * 2.5 + (y / S) * 1.8 + warp * 1.4) * Math.PI)) * 5.2),
          2.5
        );
        img.data[idx] = isGrout ? 222 : clampByte(242 - vein * 28);
        img.data[idx + 1] = isGrout ? 219 : clampByte(239 - vein * 30);
        img.data[idx + 2] = isGrout ? 213 : clampByte(233 - vein * 34);
        img.data[idx + 3] = 255;
      } else if (style === "microcement") {
        const n = (fbm((x / S) * 5, (y / S) * 5, 4) - 0.5) * 10;
        img.data[idx] = clampByte(229 + n);
        img.data[idx + 1] = clampByte(225 + n);
        img.data[idx + 2] = clampByte(218 + n);
        img.data[idx + 3] = 255;
      } else {
        // Honed Roman Travertine large architectural slabs
        const tileX = x % 256;
        const tileY = y % 256;
        const isGrout = tileX === 0 || tileY === 0;
        const n = (fbm((x / S) * 7, (y / S) * 3.5, 3) - 0.5) * 12;
        img.data[idx] = isGrout ? 208 : clampByte(228 + n);
        img.data[idx + 1] = isGrout ? 202 : clampByte(222 + n);
        img.data[idx + 2] = isGrout ? 192 : clampByte(210 + n);
        img.data[idx + 3] = 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = markSharedTexture(new THREE.CanvasTexture(canvas));
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(style === "microcement" ? 3 : 4.5, style === "microcement" ? 3 : 4.5);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  floorTextureCache.set(style, tex);
  return tex;
}

let cachedStudioEnvTexture: THREE.DataTexture | null = null;
const pmremTargetByRenderer = new WeakMap<THREE.WebGLRenderer, THREE.WebGLRenderTarget>();

export function disposeRendererPmremEnvironment(renderer: THREE.WebGLRenderer | null | undefined): void {
  if (!renderer) return;
  const target = pmremTargetByRenderer.get(renderer);
  if (target) {
    target.dispose();
    pmremTargetByRenderer.delete(renderer);
  }
}

/**
 * Generates an asymmetric Architectural Daylight Gallery PMREM environment map
 * (floor-to-ceiling north window key + soft skylight diffuser + warm limestone floor bounce)
 * so wood satin clearcoat, brushed hardware, Supramat lacquer, and smoked glass exhibit
 * genuine sculptural light-to-shadow modeling.
 */
export function getStudioPmremEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const existingTarget = pmremTargetByRenderer.get(renderer);
  if (existingTarget) return existingTarget.texture;
  try {
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileCubemapShader();

    const envScene = new THREE.Scene();

    // Calm gallery plaster enclosure (darker side opposite key window for crisp form contrast)
    const roomBox = new THREE.Mesh(
      new THREE.BoxGeometry(38, 26, 38),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0.62, 0.6, 0.57), side: THREE.BackSide })
    );
    envScene.add(roomBox);

    // Warm travertine / oak floor bounce
    const floorBounce = new THREE.Mesh(
      new THREE.PlaneGeometry(34, 34),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0.86, 0.82, 0.75), side: THREE.DoubleSide })
    );
    floorBounce.rotation.x = -Math.PI / 2;
    floorBounce.position.set(0, -12.2, 0);
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

    // Overhead gallery skylight diffuser
    addLightformer(20, 14, [2, 12.4, 3], [Math.PI / 2, 0, 0], [2.9, 2.86, 2.78]);
    // Tall floor-to-ceiling architectural window key light (right-front)
    addLightformer(14, 20, [18.0, 2.5, 7], [0, -Math.PI / 2, 0], [4.6, 4.45, 4.2]);
    // Subtle opposite fill wall reflection (left)
    addLightformer(12, 16, [-18.0, 2.0, 4], [0, Math.PI / 2, 0], [1.65, 1.62, 1.58]);
    // Soft front studio fill strip for brushed metal handles & glass reflections
    addLightformer(18, 6, [0, 6.5, 18.2], [0, Math.PI, 0], [2.4, 2.36, 2.3]);

    const renderTarget = pmremGenerator.fromScene(envScene, 0.04);
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

      const skyR = 196 + softboxKey * 54 + softboxFill * 28 + topSkylight * 32;
      const skyG = 193 + softboxKey * 52 + softboxFill * 27 + topSkylight * 31;
      const skyB = 188 + softboxKey * 48 + softboxFill * 25 + topSkylight * 30;

      const groundR = 152;
      const groundG = 145;
      const groundB = 135;

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
  const emissiveIntensity = isSelected ? 0.24 : 0.0;

  // 0. Warm 3000K Recessed LED Channel Emissive Material
  if (matDef.id === "mat_led_warm_3000k") {
    const ledMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#fff9e6"),
      emissive: new THREE.Color("#ffbe3d"),
      emissiveIntensity: isSelected ? 2.2 : 1.75,
      roughness: 0.12,
      metalness: 0.05,
      clearcoat: 0.85,
    });
    markSharedMaterial(ledMat);
    pbrMaterialCache.set(key, ledMat);
    return ledMat;
  }

  // 1. Brushed Anodized Champagne / Satin Inox Hardware (Handles, Hanging Rails, Gola, Hinges)
  if (isRailOrMetalFitting || matDef.category === "metal") {
    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#cfc9be"),
      metalness: 0.88,
      roughness: 0.24,
      clearcoat: 0.35,
      clearcoatRoughness: 0.2,
      ior: 1.6,
      reflectivity: 0.92,
      envMapIntensity: 1.28,
      emissive,
      emissiveIntensity,
    });
    markSharedMaterial(mat);
    pbrMaterialCache.set(key, mat);
    return mat;
  }

  // 2. Architectural Smoked / Fluted Showcase Glass
  if (matDef.category === "glass" || matDef.id.includes("glass")) {
    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(matDef.colorHex || "#334155"),
      metalness: 0.08,
      roughness: 0.06,
      transmission: 0.68,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      ior: 1.52,
      reflectivity: 0.96,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      envMapIntensity: 1.38,
      emissive,
      emissiveIntensity,
    });
    markSharedMaterial(mat);
    pbrMaterialCache.set(key, mat);
    return mat;
  }

  const maps = getOrCreateProceduralMaps(matDef);

  // 3. Natural Rift-Cut Wood Veneers (Oak & Walnut) with Two-Component Italian Satin Furniture Finish
  if (matDef.category === "wood" || (matDef.category === "laminate" && matDef.hasGrain)) {
    let colorTex = maps.colorMap || null;
    let bumpTex = maps.bumpMap || null;
    if (colorTex && grainDirection !== "lengthwise") {
      const rotRad = grainDirection === "crosswise" ? Math.PI / 2 : Math.PI / 4;
      const rotColorKey = `${matDef.id}_color_rot_${grainDirection}`;
      let cachedRotColor = rotatedTexCache.get(rotColorKey);
      if (!cachedRotColor) {
        cachedRotColor = colorTex.clone();
        cachedRotColor.center.set(0.5, 0.5);
        cachedRotColor.rotation = rotRad;
        cachedRotColor.needsUpdate = true;
        markSharedTexture(cachedRotColor);
        rotatedTexCache.set(rotColorKey, cachedRotColor);
      }
      colorTex = cachedRotColor;
      if (bumpTex) {
        const rotBumpKey = `${matDef.id}_bump_rot_${grainDirection}`;
        let cachedRotBump = rotatedTexCache.get(rotBumpKey);
        if (!cachedRotBump) {
          cachedRotBump = bumpTex.clone();
          cachedRotBump.center.set(0.5, 0.5);
          cachedRotBump.rotation = rotRad;
          cachedRotBump.needsUpdate = true;
          markSharedTexture(cachedRotBump);
          rotatedTexCache.set(rotBumpKey, cachedRotBump);
        }
        bumpTex = cachedRotBump;
      }
    }
    const roughVal =
      surfaceFinishOverride === "gloss"
        ? 0.16
        : surfaceFinishOverride === "satin"
        ? 0.34
        : surfaceFinishOverride === "matte"
        ? 0.52
        : 0.4;
    const clearcoatVal =
      surfaceFinishOverride === "gloss" ? 0.82 : surfaceFinishOverride === "matte" ? 0.14 : 0.28;
    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#ffffff"),
      map: colorTex,
      bumpMap: bumpTex,
      bumpScale: 0.0018,
      roughnessMap: bumpTex,
      roughness: roughVal,
      metalness: 0.01,
      ior: 1.49,
      specularIntensity: 0.72,
      clearcoat: clearcoatVal,
      clearcoatRoughness: surfaceFinishOverride === "gloss" ? 0.09 : 0.34,
      reflectivity: 0.54,
      envMapIntensity: 1.06,
      emissive,
      emissiveIntensity,
    });
    markSharedMaterial(mat);
    pbrMaterialCache.set(key, mat);
    return mat;
  }

  // 3b. Honed / Polished Calacatta Marble & Sintered Stone Countertop
  if (matDef.category === "stone" || matDef.id.includes("stone") || matDef.id.includes("calacatta")) {
    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#ffffff"),
      map: maps.colorMap || null,
      roughness: 0.16,
      metalness: 0.02,
      ior: 1.54,
      specularIntensity: 0.92,
      clearcoat: 0.78,
      clearcoatRoughness: 0.1,
      reflectivity: 0.9,
      envMapIntensity: 1.22,
      emissive,
      emissiveIntensity,
    });
    markSharedMaterial(mat);
    pbrMaterialCache.set(key, mat);
    return mat;
  }

  // 4. Silk Matte Lacquer & Soft-Touch Supramat — Velvety micro-sheen
  if (matDef.category === "lacquer") {
    const [r, g, b] = hexToRgb(matDef.colorHex);
    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(`rgb(${r}, ${g}, ${b})`),
      roughnessMap: maps.roughnessMap || null,
      roughness: surfaceFinishOverride === "gloss" ? 0.1 : 0.3,
      metalness: 0.01,
      ior: 1.49,
      specularIntensity: 0.76,
      sheen: 0.2,
      sheenRoughness: 0.48,
      sheenColor: new THREE.Color("#fafaf9"),
      clearcoat: surfaceFinishOverride === "gloss" ? 0.88 : 0.32,
      clearcoatRoughness: surfaceFinishOverride === "gloss" ? 0.06 : 0.28,
      reflectivity: 0.64,
      envMapIntensity: 1.08,
      emissive,
      emissiveIntensity,
    });
    markSharedMaterial(mat);
    pbrMaterialCache.set(key, mat);
    return mat;
  }

  // 5. Calibrated Architectural Melamine / MDF-Lam (Kastamonu / Yıldız / AGT / Çamsan)
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(matDef.colorHex),
    roughnessMap: maps.roughnessMap || null,
    roughness: surfaceFinishOverride === "gloss" ? 0.14 : 0.36,
    metalness: 0.01,
    ior: 1.48,
    specularIntensity: 0.72,
    sheen: 0.12,
    sheenRoughness: 0.54,
    sheenColor: new THREE.Color("#fafaf9"),
    clearcoat: surfaceFinishOverride === "gloss" ? 0.8 : 0.22,
    clearcoatRoughness: surfaceFinishOverride === "gloss" ? 0.08 : 0.32,
    reflectivity: 0.56,
    envMapIntensity: 1.02,
    emissive,
    emissiveIntensity,
  });
  markSharedMaterial(mat);
  pbrMaterialCache.set(key, mat);
  return mat;
}

export function getPbrCacheStats(): { texturesCount: number; materialsCount: number } {
  return {
    texturesCount: textureCache.size + rotatedTexCache.size + floorTextureCache.size,
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
