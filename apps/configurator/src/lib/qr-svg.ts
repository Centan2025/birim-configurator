/**
 * Pure, dependency-free ISO/IEC 18004 QR Code SVG Generator (Versions 1..8, Byte Mode, EC Level L).
 * Runs 100% offline in both browser and Node.js with zero external CDN or network requests.
 */

interface QrVersionSpec {
  version: number;
  size: number;
  totalDataCodewords: number;
  ecCodewordsPerBlock: number;
  numBlocks: number;
  alignmentCenters: number[];
}

const QR_VERSION_TABLE_L: QrVersionSpec[] = [
  { version: 1, size: 21, totalDataCodewords: 19, ecCodewordsPerBlock: 7, numBlocks: 1, alignmentCenters: [] },
  { version: 2, size: 25, totalDataCodewords: 34, ecCodewordsPerBlock: 10, numBlocks: 1, alignmentCenters: [6, 18] },
  { version: 3, size: 29, totalDataCodewords: 55, ecCodewordsPerBlock: 15, numBlocks: 1, alignmentCenters: [6, 22] },
  { version: 4, size: 33, totalDataCodewords: 80, ecCodewordsPerBlock: 20, numBlocks: 1, alignmentCenters: [6, 26] },
  { version: 5, size: 37, totalDataCodewords: 108, ecCodewordsPerBlock: 26, numBlocks: 1, alignmentCenters: [6, 30] },
  { version: 6, size: 41, totalDataCodewords: 136, ecCodewordsPerBlock: 18, numBlocks: 2, alignmentCenters: [6, 34] },
  { version: 7, size: 45, totalDataCodewords: 156, ecCodewordsPerBlock: 20, numBlocks: 2, alignmentCenters: [6, 22, 38] },
  { version: 8, size: 49, totalDataCodewords: 194, ecCodewordsPerBlock: 24, numBlocks: 2, alignmentCenters: [6, 24, 42] },
];

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function buildGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const root = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], root);
    }
    poly = next;
  }
  return poly;
}

function computeReedSolomonRemainder(data: Uint8Array, ecLen: number): Uint8Array {
  const gen = buildGeneratorPoly(ecLen);
  const rem = new Uint8Array(ecLen);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ rem[0];
    rem.copyWithin(0, 1);
    rem[ecLen - 1] = 0;
    if (factor !== 0) {
      for (let j = 0; j < ecLen; j++) {
        rem[j] ^= gfMul(gen[j + 1], factor);
      }
    }
  }
  return rem;
}

function computeFormatBits(ecLevelBits: number, maskPattern: number): number {
  const data = (ecLevelBits << 3) | maskPattern;
  let rem = data << 10;
  for (let i = 4; i >= 0; i--) {
    if ((rem >> (i + 10)) & 1) {
      rem ^= 0x537 << i;
    }
  }
  return ((data << 10) | rem) ^ 0x5412;
}

function computeVersionBits(version: number): number {
  let rem = version << 12;
  for (let i = 5; i >= 0; i--) {
    if ((rem >> (i + 12)) & 1) {
      rem ^= 0x1f25 << i;
    }
  }
  return (version << 12) | rem;
}

export function encodeQrMatrix(text: string): boolean[][] {
  const utf8 = new TextEncoder().encode(text);
  const spec = QR_VERSION_TABLE_L.find((s) => utf8.length + 3 <= s.totalDataCodewords);
  if (!spec) {
    throw new Error(`QR payload exceeds supported Version 8 capacity (${utf8.length} bytes)`);
  }

  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >>> i) & 1);
    }
  };
  pushBits(0b0100, 4);
  pushBits(utf8.length, 8);
  for (const b of utf8) pushBits(b, 8);

  const maxBits = spec.totalDataCodewords * 8;
  const termLen = Math.min(4, maxBits - bits.length);
  pushBits(0, termLen);
  while (bits.length % 8 !== 0) bits.push(0);

  const dataBytes = new Uint8Array(spec.totalDataCodewords);
  for (let i = 0; i < bits.length / 8; i++) {
    let byte = 0;
    for (let b = 0; b < 8; b++) byte = (byte << 1) | bits[i * 8 + b];
    dataBytes[i] = byte;
  }
  let padToggle = true;
  for (let i = bits.length / 8; i < spec.totalDataCodewords; i++) {
    dataBytes[i] = padToggle ? 0xec : 0x11;
    padToggle = !padToggle;
  }

  const blockDataLen = Math.floor(spec.totalDataCodewords / spec.numBlocks);
  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];
  let offset = 0;
  for (let b = 0; b < spec.numBlocks; b++) {
    const slice = dataBytes.slice(offset, offset + blockDataLen);
    offset += blockDataLen;
    dataBlocks.push(slice);
    ecBlocks.push(computeReedSolomonRemainder(slice, spec.ecCodewordsPerBlock));
  }

  const finalCodewords: number[] = [];
  for (let i = 0; i < blockDataLen; i++) {
    for (let b = 0; b < spec.numBlocks; b++) finalCodewords.push(dataBlocks[b][i]);
  }
  for (let i = 0; i < spec.ecCodewordsPerBlock; i++) {
    for (let b = 0; b < spec.numBlocks; b++) finalCodewords.push(ecBlocks[b][i]);
  }

  const finalBits: number[] = [];
  for (const cw of finalCodewords) {
    for (let bit = 7; bit >= 0; bit--) finalBits.push((cw >>> bit) & 1);
  }

  const N = spec.size;
  const modules: boolean[][] = Array.from({ length: N }, () => Array(N).fill(false));
  const isFunction: boolean[][] = Array.from({ length: N }, () => Array(N).fill(false));

  const setFunc = (r: number, c: number, dark: boolean) => {
    if (r < 0 || r >= N || c < 0 || c >= N) return;
    modules[r][c] = dark;
    isFunction[r][c] = true;
  };

  const drawFinder = (topR: number, leftC: number) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = topR + dr;
        const c = leftC + dc;
        if (r < 0 || r >= N || c < 0 || c >= N) continue;
        const inOuter = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
        const onBorder = dr === 0 || dr === 6 || dc === 0 || dc === 6;
        const inCore = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
        setFunc(r, c, inOuter && (onBorder || inCore));
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, N - 7);
  drawFinder(N - 7, 0);

  for (let i = 8; i < N - 8; i++) {
    setFunc(6, i, i % 2 === 0);
    setFunc(i, 6, i % 2 === 0);
  }

  const centers = spec.alignmentCenters;
  for (let i = 0; i < centers.length; i++) {
    for (let j = 0; j < centers.length; j++) {
      if (
        (i === 0 && j === 0) ||
        (i === 0 && j === centers.length - 1) ||
        (i === centers.length - 1 && j === 0)
      ) {
        continue;
      }
      const cr = centers[i];
      const cc = centers[j];
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const dist = Math.max(Math.abs(dr), Math.abs(dc));
          setFunc(cr + dr, cc + dc, dist !== 1);
        }
      }
    }
  }

  setFunc(4 * spec.version + 9, 8, true);
  for (let i = 0; i <= 8; i++) {
    if (!isFunction[8][i]) setFunc(8, i, false);
    if (!isFunction[i][8]) setFunc(i, 8, false);
  }
  for (let i = 0; i < 8; i++) {
    if (!isFunction[8][N - 1 - i]) setFunc(8, N - 1 - i, false);
    if (!isFunction[N - 1 - i][8]) setFunc(N - 1 - i, 8, false);
  }
  if (spec.version >= 7) {
    const vBits = computeVersionBits(spec.version);
    for (let i = 0; i < 18; i++) {
      const bit = ((vBits >>> i) & 1) === 1;
      const a = N - 11 + (i % 3);
      const b = Math.floor(i / 3);
      setFunc(b, a, bit);
      setFunc(a, b, bit);
    }
  }

  let bitIdx = 0;
  let upward = true;
  for (let right = N - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < N; vert++) {
      const r = upward ? N - 1 - vert : vert;
      for (let j = 0; j < 2; j++) {
        const c = right - j;
        if (!isFunction[r][c]) {
          const dark = bitIdx < finalBits.length ? finalBits[bitIdx] === 1 : false;
          modules[r][c] = dark;
          bitIdx++;
        }
      }
    }
    upward = !upward;
  }

  const maskPattern = 0;
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (!isFunction[r][c] && (r + c) % 2 === 0) {
        modules[r][c] = !modules[r][c];
      }
    }
  }

  const fmt = computeFormatBits(0b01, maskPattern);
  for (let i = 0; i <= 5; i++) modules[8][i] = ((fmt >>> i) & 1) === 1;
  modules[8][7] = ((fmt >>> 6) & 1) === 1;
  modules[8][8] = ((fmt >>> 7) & 1) === 1;
  modules[7][8] = ((fmt >>> 8) & 1) === 1;
  for (let i = 9; i < 15; i++) modules[14 - i][8] = ((fmt >>> i) & 1) === 1;

  for (let i = 0; i < 8; i++) modules[N - 1 - i][8] = ((fmt >>> i) & 1) === 1;
  for (let i = 8; i < 15; i++) modules[8][N - 15 + i] = ((fmt >>> i) & 1) === 1;

  return modules;
}

export function generateQrCodeSvg(
  text: string,
  options?: {
    sizePx?: number;
    darkHex?: string;
    lightHex?: string;
    marginModules?: number;
  }
): string {
  const matrix = encodeQrMatrix(text);
  const N = matrix.length;
  const margin = options?.marginModules ?? 3;
  const total = N + margin * 2;
  const sizePx = options?.sizePx ?? 180;
  const darkHex = options?.darkHex ?? "#141413";
  const lightHex = options?.lightHex ?? "#FFFFFF";

  const pathParts: string[] = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (matrix[r][c]) {
        pathParts.push(`M${c + margin},${r + margin}h1v1h-1z`);
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${sizePx}" height="${sizePx}" shape-rendering="crispEdges" role="img" aria-label="QR Kod"><rect width="${total}" height="${total}" fill="${lightHex}" rx="2"/><path d="${pathParts.join("")}" fill="${darkHex}"/></svg>`;
}
