/**
 * BİRİM Studio — Ana İş Parçacığını Bloklamayan Progresif Ahşap PBR Web Worker'ı
 *
 * 1024×1024 / 512×512 ahşap damar + pürüzlülük + Sobel normal haritası hesabını
 * arka plan Web Worker'ına taşır ve tamamlandığında sıfır-kopya Transferable ArrayBuffer
 * ile mevcut THREE.CanvasTexture nesnelerini sessizce HD çözünürlüğe yükseltir.
 * Node/Vitest ortamında (Worker yoksa) çağrılmaz; mevcut senkron yol korunur.
 */

import type * as THREE from "three";

export interface WoodWorkerUpgradeParams {
  targetSize: number;
  hr: number;
  hg: number;
  hb: number;
  isWalnut: boolean;
  colorCanvas: HTMLCanvasElement;
  roughCanvas: HTMLCanvasElement;
  normalCanvas: HTMLCanvasElement;
  colorMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
}

export interface StoneWorkerUpgradeParams {
  targetSize: number;
  br: number;
  bg: number;
  bb: number;
  veinRgb: [number, number, number];
  isDarkStone: boolean;
  colorCanvas: HTMLCanvasElement;
  roughCanvas: HTMLCanvasElement;
  normalCanvas: HTMLCanvasElement;
  colorMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
}

const WOOD_WORKER_SOURCE = `
const PERM_512 = (() => {
  const p = new Uint8Array(512);
  const base = new Uint8Array(256);
  for (let i = 0; i < 256; i++) base[i] = i;
  let s = 133791;
  for (let i = 255; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    const tmp = base[i]; base[i] = base[j]; base[j] = tmp;
  }
  for (let i = 0; i < 512; i++) p[i] = base[i & 255];
  return p;
})();
const clampByte = (v) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));
const fract = (v) => v - Math.floor(v);
const hash2D = (ix, iy) => PERM_512[PERM_512[ix & 255] + (iy & 255)] * 0.00392156862745098;
function periodicNoise(x, y, px, py) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const ix0 = ((x0 % px) + px) % px, ix1 = (ix0 + 1) % px;
  const iy0 = ((y0 % py) + py) % py, iy1 = (iy0 + 1) % py;
  const a = hash2D(ix0, iy0), b = hash2D(ix1, iy0);
  const c = hash2D(ix0, iy1), d = hash2D(ix1, iy1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function periodicFbm(nx, ny, px, py, octaves) {
  let sum = 0, amp = 0.5, norm = 0, fx = px, fy = py;
  for (let o = 0; o < octaves; o++) {
    sum += amp * periodicNoise(nx * fx, ny * fy, fx, fy);
    norm += amp; amp *= 0.5; fx *= 2; fy *= 2;
  }
  return sum / norm;
}

self.onmessage = (ev) => {
  const { id, kind, size, hr, hg, hb, isWalnut, br, bg, bb, veinRgb, isDarkStone } = ev.data;
  const W = size, H = size;
  const colorData = new Uint8ClampedArray(W * H * 4);
  const roughData = new Uint8ClampedArray(W * H * 4);
  const normalData = new Uint8ClampedArray(W * H * 4);
  const heightField = new Float32Array(W * H);

  if (kind === "stone") {
    const strength = isDarkStone ? 0.22 : 0.3;
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
        const idx = (y * W + x) * 4;
        colorData[idx] = clampByte(br * (1 - vFactor * strength) + veinRgb[0] * vFactor * strength);
        colorData[idx + 1] = clampByte(bg * (1 - vFactor * strength) + veinRgb[1] * vFactor * strength);
        colorData[idx + 2] = clampByte(bb * (1 - vFactor * strength) + veinRgb[2] * vFactor * strength);
        colorData[idx + 3] = 255;

        const rv = clampByte(72 + warp * 26 + vFactor * 28);
        roughData[idx] = rv;
        roughData[idx + 1] = rv;
        roughData[idx + 2] = rv;
        roughData[idx + 3] = 255;

        heightField[y * W + x] = 0.5 + (warp - 0.5) * 0.14 - vFactor * 0.08;
      }
    }
  } else {
  for (let y = 0; y < H; y++) {
    const ny = y / H;
    for (let x = 0; x < W; x++) {
      const nx = x / W;
      const meander = (periodicNoise(nx * 3, ny, 3, 1) - 0.5) * 0.08;
      const ux = fract(nx + meander);
      const uy = ny;
      const broadHeartwood = periodicFbm(ux, uy, 4, 1, 2);
      const mediumFibers = periodicFbm(ux, uy, isWalnut ? 18 : 22, 2, 2);
      const fineGrain = periodicNoise(ux * 84, uy * 8, 84, 8);
      const poreNoise = periodicNoise(ux * 168 + 0.37, uy * 28 + 0.19, 168, 28);
      const poreDepth = poreNoise > 0.77 ? Math.min(1, (poreNoise - 0.77) * 4.4) : 0;
      const medullaryRay = !isWalnut ? Math.max(0, periodicNoise(ux * 10 + 0.61, uy * 52, 10, 52) - 0.75) * 0.95 : 0;
      const latewoodBand = periodicNoise((ux + 0.41) * (isWalnut ? 10 : 14), uy, isWalnut ? 10 : 14, 1);
      const plankCenter = ((ux * 2.0) % 1.0) - 0.5;
      const cathedralField = Math.abs(plankCenter) * (isWalnut ? 11.5 : 14.0) + Math.cos(uy * Math.PI * 2) * 1.35 + (broadHeartwood - 0.5) * 2.4;
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

      const idx = (y * W + x) * 4;
      colorData[idx] = clampByte(hr * (1 + fiberDelta * 1.05));
      colorData[idx + 1] = clampByte(hg * (1 + fiberDelta * 0.98));
      colorData[idx + 2] = clampByte(hb * (1 + fiberDelta * 0.88));
      colorData[idx + 3] = 255;

      const roughByte = clampByte(126 + (mediumFibers - 0.5) * 32 + poreDepth * 82 - (latewoodBand - 0.5) * 20 - medullaryRay * 22);
      roughData[idx] = roughByte;
      roughData[idx + 1] = roughByte;
      roughData[idx + 2] = roughByte;
      roughData[idx + 3] = 255;

      heightField[y * W + x] = 0.55 + (mediumFibers - 0.5) * 0.22 + (fineGrain - 0.5) * 0.09 + (latewoodBand - 0.5) * 0.1 - poreDepth * 0.42;
    }
  }
  }

  const sample = (x, y) => heightField[(((y % H) + H) % H) * W + (((x % W) + W) % W)];
  const strength = kind === "stone" ? 0.75 : 1.85;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const tl = sample(x - 1, y - 1), t = sample(x, y - 1), tr = sample(x + 1, y - 1);
      const l = sample(x - 1, y), r = sample(x + 1, y);
      const bl = sample(x - 1, y + 1), b = sample(x, y + 1), br = sample(x + 1, y + 1);
      const dX = tr + 2 * r + br - (tl + 2 * l + bl);
      const dY = bl + 2 * b + br - (tl + 2 * t + tr);
      let nx = -dX * strength, ny = -dY * strength, nz = 1.0;
      const invLen = 1.0 / Math.sqrt(nx * nx + ny * ny + nz * nz);
      const idx = (y * W + x) * 4;
      normalData[idx] = clampByte((nx * invLen * 0.5 + 0.5) * 255);
      normalData[idx + 1] = clampByte((ny * invLen * 0.5 + 0.5) * 255);
      normalData[idx + 2] = clampByte((nz * invLen * 0.5 + 0.5) * 255);
      normalData[idx + 3] = 255;
    }
  }

  self.postMessage(
    { id, size, colorBuf: colorData.buffer, roughBuf: roughData.buffer, normalBuf: normalData.buffer },
    [colorData.buffer, roughData.buffer, normalData.buffer]
  );
};
`;

let sharedWorker: Worker | null = null;
let nextJobId = 1;
interface PendingCanvasJob {
  colorCanvas: HTMLCanvasElement;
  roughCanvas: HTMLCanvasElement;
  normalCanvas: HTMLCanvasElement;
  colorMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
}
const pendingJobs = new Map<number, PendingCanvasJob>();

function getOrCreateWoodWorker(): Worker | null {
  if (typeof window === "undefined" || typeof Worker === "undefined" || typeof Blob === "undefined") {
    return null;
  }
  if (sharedWorker) return sharedWorker;
  try {
    const blob = new Blob([WOOD_WORKER_SOURCE], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    sharedWorker = new Worker(url);
    URL.revokeObjectURL(url);
    sharedWorker.onmessage = (ev: MessageEvent<{
      id: number;
      size: number;
      colorBuf: ArrayBuffer;
      roughBuf: ArrayBuffer;
      normalBuf: ArrayBuffer;
    }>) => {
      const { id, size, colorBuf, roughBuf, normalBuf } = ev.data;
      const job = pendingJobs.get(id);
      if (!job) return;
      pendingJobs.delete(id);
      try {
        const applyBuf = (canvas: HTMLCanvasElement, buf: ArrayBuffer, tex: THREE.CanvasTexture) => {
          const resized = canvas.width !== size || canvas.height !== size;
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          ctx.putImageData(new ImageData(new Uint8ClampedArray(buf), size, size), 0, 0);
          // 128px -> 512/1024px boyut değişiminde eski GPU texture slotunu boşalt ki
          // glCopySubTextureCHROMIUM (GL_INVALID_VALUE: Offset overflows texture dimensions) oluşmasın
          if (resized) {
            tex.dispose();
          }
          tex.needsUpdate = true;
        };
        applyBuf(job.colorCanvas, colorBuf, job.colorMap);
        applyBuf(job.roughCanvas, roughBuf, job.roughnessMap);
        applyBuf(job.normalCanvas, normalBuf, job.normalMap);
        window.dispatchEvent(new CustomEvent("birim:pbr-texture-ready"));
      } catch {
        // ignore disposed canvas/texture
      }
    };
    return sharedWorker;
  } catch {
    return null;
  }
}

export function canUseAsyncWoodPbrWorker(): boolean {
  return typeof window !== "undefined" && typeof Worker !== "undefined" && typeof Blob !== "undefined";
}

export function scheduleAsyncWoodPbrUpgrade(params: WoodWorkerUpgradeParams): boolean {
  const worker = getOrCreateWoodWorker();
  if (!worker) return false;
  const id = nextJobId++;
  pendingJobs.set(id, params);
  worker.postMessage({
    id,
    kind: "wood",
    size: params.targetSize,
    hr: params.hr,
    hg: params.hg,
    hb: params.hb,
    isWalnut: params.isWalnut,
  });
  return true;
}

export function scheduleAsyncStonePbrUpgrade(params: StoneWorkerUpgradeParams): boolean {
  const worker = getOrCreateWoodWorker();
  if (!worker) return false;
  const id = nextJobId++;
  pendingJobs.set(id, params);
  worker.postMessage({
    id,
    kind: "stone",
    size: params.targetSize,
    br: params.br,
    bg: params.bg,
    bb: params.bb,
    veinRgb: params.veinRgb,
    isDarkStone: params.isDarkStone,
  });
  return true;
}
