import * as THREE from "three";
import { markSharedGeometry, markSharedMaterial, markSharedTexture } from "../../materials/webglResourceGuard";

let cachedContactAoTex: THREE.CanvasTexture | null = null;
export function getContactAoShadowTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  if (cachedContactAoTex) return cachedContactAoTex;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const grad = ctx.createRadialGradient(128, 128, 18, 128, 128, 126);
  grad.addColorStop(0, "rgba(10, 9, 8, 0.84)");
  grad.addColorStop(0.48, "rgba(15, 14, 12, 0.52)");
  grad.addColorStop(0.78, "rgba(20, 18, 16, 0.22)");
  grad.addColorStop(1, "rgba(20, 18, 16, 0.0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const tex = markSharedTexture(new THREE.CanvasTexture(canvas));
  tex.needsUpdate = true;
  cachedContactAoTex = tex;
  return tex;
}

export const SHARED_UNIT_AO_PLANE_GEO = markSharedGeometry(new THREE.PlaneGeometry(1, 1));
export const SHARED_SUBDIV_GRAB_BOX_GEO = markSharedGeometry(new THREE.BoxGeometry(1, 1, 1));
export const SHARED_SUBDIV_GRAB_MAT = markSharedMaterial(
  new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    colorWrite: false,
  })
);
export const SHARED_BAY_HIT_MAT = markSharedMaterial(
  new THREE.MeshBasicMaterial({
    color: 0x94a3b8,
    transparent: true,
    opacity: 0.012,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
);
export const creviceAoMatCache: {
  topMat: THREE.MeshBasicMaterial | null;
  shelfMat: THREE.MeshBasicMaterial | null;
  leftCornerMat: THREE.MeshBasicMaterial | null;
  rightCornerMat: THREE.MeshBasicMaterial | null;
} = { topMat: null, shelfMat: null, leftCornerMat: null, rightCornerMat: null };
export const SHARED_BASE_CREVICE_MAT = markSharedMaterial(
  new THREE.MeshBasicMaterial({
    color: 0x0f0e0d,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  })
);
let cachedGroundAoMat: THREE.MeshBasicMaterial | null = null;
let cachedWallAoMat: THREE.MeshBasicMaterial | null = null;
export function getCachedContactAoMaterials(aoTex: THREE.CanvasTexture) {
  if (!cachedGroundAoMat) {
    cachedGroundAoMat = markSharedMaterial(
      new THREE.MeshBasicMaterial({
        map: aoTex,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
      })
    );
  }
  if (!cachedWallAoMat) {
    cachedWallAoMat = markSharedMaterial(
      new THREE.MeshBasicMaterial({
        map: aoTex,
        transparent: true,
        opacity: 0.84,
        depthWrite: false,
      })
    );
  }
  return { groundAoMat: cachedGroundAoMat, wallAoMat: cachedWallAoMat };
}

let cachedCreviceAoTex: THREE.CanvasTexture | null = null;
export function getLinearCreviceAoTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  if (cachedCreviceAoTex) return cachedCreviceAoTex;
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const grad = ctx.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, "rgba(10, 9, 8, 0.56)");
  grad.addColorStop(0.38, "rgba(12, 11, 10, 0.22)");
  grad.addColorStop(1, "rgba(12, 11, 10, 0.0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 128);
  const tex = markSharedTexture(new THREE.CanvasTexture(canvas));
  tex.needsUpdate = true;
  cachedCreviceAoTex = tex;
  return tex;
}

export const cachedSideCornerAoMap = new Map<string, THREE.CanvasTexture>();
export function getHorizontalCornerAoTexture(side: "left" | "right"): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const hit = cachedSideCornerAoMap.get(side);
  if (hit) return hit;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const grad =
    side === "left"
      ? ctx.createLinearGradient(0, 0, 128, 0)
      : ctx.createLinearGradient(128, 0, 0, 0);
  grad.addColorStop(0, "rgba(10, 9, 8, 0.46)");
  grad.addColorStop(0.36, "rgba(12, 11, 10, 0.16)");
  grad.addColorStop(1, "rgba(12, 11, 10, 0.0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 64);
  const tex = markSharedTexture(new THREE.CanvasTexture(canvas));
  tex.needsUpdate = true;
  cachedSideCornerAoMap.set(side, tex);
  return tex;
}

export const cachedUnderShelfGlowMap = new Map<number, THREE.CanvasTexture>();
export function getKelvinUnderShelfWashTexture(kelvin: number): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const kKey = kelvin <= 2800 ? 2700 : kelvin >= 3800 ? 4000 : 3000;
  const hit = cachedUnderShelfGlowMap.get(kKey);
  if (hit) return hit;
  const W = 96;
  const H = 192;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const img = ctx.createImageData(W, H);
  const [rC, gC, bC] =
    kKey === 2700 ? [255, 208, 142] : kKey === 4000 ? [255, 248, 236] : [255, 228, 182];
  for (let y = 0; y < H; y++) {
    const v = y / (H - 1);
    const vertFade = Math.pow(Math.max(0, 1 - v), 2.35);
    for (let x = 0; x < W; x++) {
      const u = x / (W - 1);
      const horizFade = Math.pow(Math.sin(u * Math.PI), 0.45);
      const a = Math.round(255 * 0.48 * vertFade * horizFade);
      const idx = (y * W + x) * 4;
      img.data[idx] = rC;
      img.data[idx + 1] = gC;
      img.data[idx + 2] = bC;
      img.data[idx + 3] = x === 0 || x === W - 1 || y === H - 1 ? 0 : a;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = markSharedTexture(new THREE.CanvasTexture(canvas));
  tex.needsUpdate = true;
  cachedUnderShelfGlowMap.set(kKey, tex);
  return tex;
}

export const cachedStripBloomMap = new Map<number, THREE.CanvasTexture>();
export function getGaussianLedBloomTexture(kelvin: number): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const kKey = kelvin <= 2800 ? 2700 : kelvin >= 3800 ? 4000 : 3000;
  const hit = cachedStripBloomMap.get(kKey);
  if (hit) return hit;
  const W = 128;
  const H = 64;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const img = ctx.createImageData(W, H);
  const [rC, gC, bC] =
    kKey === 2700 ? [255, 214, 154] : kKey === 4000 ? [255, 250, 242] : [255, 236, 198];
  for (let y = 0; y < H; y++) {
    const v = y / (H - 1);
    const endTipFade = y === 0 || y === H - 1 ? 0 : Math.pow(Math.sin(v * Math.PI), 0.25);
    for (let x = 0; x < W; x++) {
      const u = x / (W - 1);
      // Strict Gaussian bell curve across width so outer edges are 100% transparent (ZERO hard yellow band!)
      const d = (u - 0.5) * 6.4;
      const gauss = x === 0 || x === W - 1 ? 0 : Math.exp(-d * d);
      const a = Math.round(255 * gauss * endTipFade);
      const idx = (y * W + x) * 4;
      img.data[idx] = rC;
      img.data[idx + 1] = gC;
      img.data[idx + 2] = bC;
      img.data[idx + 3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = markSharedTexture(new THREE.CanvasTexture(canvas));
  tex.needsUpdate = true;
  cachedStripBloomMap.set(kKey, tex);
  return tex;
}

export function computeHeroStudioFraming(
  bounds: THREE.Box3,
  fovDeg: number,
  aspect: number,
  angle: "hero" | "front" = "hero"
): { target: THREE.Vector3; position: THREE.Vector3; dist: number } {
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const target = new THREE.Vector3(
    center.x,
    bounds.min.y + size.y * 0.485,
    center.z
  );
  const halfVertRad = ((fovDeg || 30) * Math.PI) / 360;
  const tanV = Math.max(0.18, Math.tan(halfVertRad));
  const safeAspect = Math.max(0.85, aspect || 1.5);
  const tanH = tanV * safeAspect;
  // Balanced architectural framing (~70% vertical fill, front-biased hero angle)
  const distForHeight = (size.y * 0.74) / tanV;
  const distForWidth = (size.x * 0.78) / tanH;
  const dist = Math.max(2600, distForHeight, distForWidth);
  const dir =
    angle === "front"
      ? new THREE.Vector3(0, 0.02, 1).normalize()
      : new THREE.Vector3(0.16, 0.065, 1.0).normalize();
  const position = target.clone().addScaledVector(dir, dist);
  return { target, position, dist };
}

let cachedLedWashTex: THREE.CanvasTexture | null = null;
export function getWarmLedWashTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  if (cachedLedWashTex) return cachedLedWashTex;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const grad = ctx.createLinearGradient(0, 0, 128, 0);
  grad.addColorStop(0, "rgba(255, 202, 108, 0.34)");
  grad.addColorStop(0.38, "rgba(255, 206, 124, 0.12)");
  grad.addColorStop(1, "rgba(255, 210, 140, 0.0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = markSharedTexture(new THREE.CanvasTexture(canvas));
  tex.needsUpdate = true;
  cachedLedWashTex = tex;
  return tex;
}

export function createActiveWallBadgeMesh(
  wallName: string,
  wallLengthMm: number,
  displayUnit: "mm" | "cm",
  isStrongFocus: boolean,
  inwardIsPositiveLocalZ: boolean
): THREE.Mesh | null {
  if (typeof document === "undefined") return null;
  const dimText =
    displayUnit === "cm"
      ? `${Number((wallLengthMm / 10).toFixed(1))} cm`
      : `${Math.round(wallLengthMm)} mm`;
  const cleanName = (wallName || "Ana Duvar").trim();
  const titleText = `${cleanName} · ${dimText}`;
  const tagText = "AKTİF";

  const dpr = 3;
  const padX = 28;
  const dotBlockW = 28;
  const pillH = 62;
  const arrowH = 14;

  const measureCanvas = document.createElement("canvas");
  const mCtx = measureCanvas.getContext("2d");
  if (!mCtx) return null;
  mCtx.font = "800 15px Inter, system-ui, -apple-system, sans-serif";
  const tagW = mCtx.measureText(tagText).width;
  mCtx.font = "700 22px Inter, system-ui, -apple-system, sans-serif";
  const titleW = mCtx.measureText(titleText).width;

  const tagPillW = Math.ceil(tagW + 22);
  const gapW = 16;
  const logicalW = Math.max(320, Math.min(720, Math.ceil(padX * 2 + dotBlockW + tagPillW + gapW + titleW)));
  const logicalH = pillH + arrowH + 14;

  const canvas = document.createElement("canvas");
  canvas.width = logicalW * dpr;
  canvas.height = logicalH * dpr;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.scale(dpr, dpr);
  const bx = 5;
  const by = 5;
  const bw = logicalW - 10;
  const bh = pillH;
  const r = bh / 2;

  const drawRoundedRect = (x: number, y: number, w: number, h: number, rad: number) => {
    const rr = Math.min(rad, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  };

  // High-contrast backdrop with soft outer glow
  ctx.save();
  ctx.shadowColor = isStrongFocus ? "rgba(56, 189, 248, 0.62)" : "rgba(15, 23, 42, 0.52)";
  ctx.shadowBlur = isStrongFocus ? 14 : 10;
  ctx.shadowOffsetY = 2;
  drawRoundedRect(bx, by, bw, bh, r);
  ctx.fillStyle = isStrongFocus ? "rgba(10, 22, 42, 0.96)" : "rgba(15, 23, 42, 0.92)";
  ctx.fill();
  ctx.restore();

  // Crisp cyan border
  drawRoundedRect(bx, by, bw, bh, r);
  ctx.lineWidth = isStrongFocus ? 3 : 2.4;
  ctx.strokeStyle = isStrongFocus ? "#38bdf8" : "rgba(56, 189, 248, 0.88)";
  ctx.stroke();

  // Bottom pointer triangle pointing straight to the active wall top edge
  const cx = logicalW / 2;
  ctx.beginPath();
  ctx.moveTo(cx - 11, by + bh - 1);
  ctx.lineTo(cx + 11, by + bh - 1);
  ctx.lineTo(cx, by + bh + arrowH);
  ctx.closePath();
  ctx.fillStyle = isStrongFocus ? "#38bdf8" : "rgba(56, 189, 248, 0.9)";
  ctx.fill();

  // Active status glowing dot
  const dotX = bx + padX + 4;
  const dotY = by + bh / 2;
  ctx.beginPath();
  ctx.arc(dotX, dotY, 10, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(56, 189, 248, 0.30)";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(dotX, dotY, 5.5, 0, Math.PI * 2);
  ctx.fillStyle = "#7dd3fc";
  ctx.fill();

  // "AKTİF" high-contrast pill
  const tagX = dotX + 20;
  const tagH = 30;
  const tagY = by + (bh - tagH) / 2;
  drawRoundedRect(tagX, tagY, tagPillW, tagH, 15);
  ctx.fillStyle = "rgba(56, 189, 248, 0.28)";
  ctx.fill();
  ctx.font = "800 15px Inter, system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#bae6fd";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillText(tagText, tagX + tagPillW / 2, dotY + 1);

  // Wall name & length (pure white bold for maximum readability)
  ctx.font = "700 22px Inter, system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.fillText(titleText, tagX + tagPillW + gapW, dotY + 1);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  tex.needsUpdate = true;

  const baseOpacity = isStrongFocus ? 0.99 : 0.92;
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: baseOpacity,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
  });

  const aspect = logicalW / logicalH;
  const maxWorldW = Math.max(520, wallLengthMm * 0.72);
  const rawWorldH = 225;
  const rawWorldW = aspect * rawWorldH;
  const fitScale = rawWorldW > maxWorldW ? maxWorldW / rawWorldW : 1;
  const worldW = rawWorldW * fitScale;
  const worldH = rawWorldH * fitScale;

  const geo = new THREE.PlaneGeometry(worldW, worldH);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.y = inwardIsPositiveLocalZ ? 0 : Math.PI;
  mesh.renderOrder = 950;
  mesh.raycast = () => {};
  mesh.userData = {
    isWallFocusIndicator: true,
    isWallBadgeSprite: true,
    baseScaleX: 1,
    baseScaleY: 1,
    baseOpacity,
  };
  return mesh;
}

export const xrayIcePanelMat = markSharedMaterial(
  new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    emissive: new THREE.Color(0x0284c7),
    emissiveIntensity: 0.26,
    roughness: 0.16,
    metalness: 0.05,
    transmission: 0.0,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
);
export const xrayHoleUnitCylinder = markSharedGeometry(new THREE.CylinderGeometry(0.5, 0.5, 1, 14));
export const hingeMountHole3DMat = markSharedMaterial(new THREE.MeshBasicMaterial({ color: 0x111827 }));
export const hingeMountRing3DMat = markSharedMaterial(new THREE.MeshBasicMaterial({ color: 0xd97706 }));
export const xrayHoleMatD5 = markSharedMaterial(new THREE.MeshBasicMaterial({ color: 0x10b981, toneMapped: false }));
export const xrayHoleMatD8 = markSharedMaterial(new THREE.MeshBasicMaterial({ color: 0x2563eb, toneMapped: false }));
export const xrayHoleMatD15 = markSharedMaterial(new THREE.MeshBasicMaterial({ color: 0xef4444, toneMapped: false }));
export const xrayHoleMatCable = markSharedMaterial(new THREE.MeshBasicMaterial({ color: 0x06b6d4, toneMapped: false }));
export const xrayLedGrooveMat = markSharedMaterial(
  new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.92, toneMapped: false })
);
export const xrayLedDriverMat = markSharedMaterial(
  new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.34, depthWrite: false, toneMapped: false })
);
export const xrayHoleMatD35 = markSharedMaterial(new THREE.MeshBasicMaterial({ color: 0xf59e0b, toneMapped: false }));
export const xrayGrooveMat = markSharedMaterial(
  new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.72 })
);
export const ghostLockedMat = markSharedMaterial(new THREE.MeshBasicMaterial({
  color: 0x10b981,
  transparent: true,
  opacity: 0.28,
  depthWrite: false,
}));
export const ghostFreeMat = markSharedMaterial(new THREE.MeshBasicMaterial({
  color: 0x0ea5e9,
  transparent: true,
  opacity: 0.26,
  depthWrite: false,
}));
export const ghostLockedEdgeMat = markSharedMaterial(new THREE.LineBasicMaterial({
  color: 0x047857,
  transparent: true,
  opacity: 0.95,
}));
export const ghostFreeEdgeMat = markSharedMaterial(new THREE.LineBasicMaterial({
  color: 0x0369a1,
  transparent: true,
  opacity: 0.92,
}));
export const snapSlotActiveRodMat = markSharedMaterial(new THREE.MeshBasicMaterial({
  color: 0x10b981,
  transparent: true,
  opacity: 0.95,
  depthTest: false,
}));
export const snapSlotIdleRodMat = markSharedMaterial(new THREE.MeshBasicMaterial({
  color: 0xf59e0b,
  transparent: true,
  opacity: 0.78,
  depthTest: false,
}));

export const v3EdgeCache = new Map<string, THREE.LineBasicMaterial>();

export const cadHardwareMat = markSharedMaterial(
  new THREE.MeshBasicMaterial({
    color: 0xcbd5e1,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  })
);
export const cadTechnicalMat = markSharedMaterial(new THREE.MeshBasicMaterial({
  color: 0xffffff,
  polygonOffset: true,
  polygonOffsetFactor: 1,
  polygonOffsetUnits: 1,
}));
export const cadSelectedMat = markSharedMaterial(new THREE.MeshBasicMaterial({
  color: 0xdbeafe,
  polygonOffset: true,
  polygonOffsetFactor: 1,
  polygonOffsetUnits: 1,
}));
export const hoverHighlightEdgeMat = markSharedMaterial(new THREE.LineBasicMaterial({
  color: 0x0284c7,
  linewidth: 2,
  opacity: 1,
  transparent: false,
}));

export const SHARED_PROP_BOX_GEO = markSharedGeometry(new THREE.BoxGeometry(1, 1, 1));
export const SHARED_PROP_HOOK_GEO = markSharedGeometry(new THREE.CylinderGeometry(2.2, 2.2, 38, 8));
export const SHARED_HANGER_WOOD_MAT = markSharedMaterial(
  new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.48, metalness: 0.06 })
);
export const SHARED_CHROME_HOOK_MAT = markSharedMaterial(
  new THREE.MeshStandardMaterial({ color: 0xd4d4d8, roughness: 0.22, metalness: 0.86 })
);
export const SHARED_BOX_LINEN_MAT = markSharedMaterial(
  new THREE.MeshStandardMaterial({ color: 0xd8d3c8, roughness: 0.86, metalness: 0.01 })
);
export const SHARED_BOX_TAB_MAT = markSharedMaterial(
  new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.52 })
);
export const SHARED_GARMENT_MATS = [0xe7e5e4, 0x334155, 0xc7bfb3, 0x475569, 0xf5f5f4, 0x78716c].map(
  (hex) => markSharedMaterial(new THREE.MeshStandardMaterial({ color: hex, roughness: 0.86, metalness: 0.01 }))
);
export const SHARED_FOLD_MATS = [0xd6d3d1, 0x64748b, 0xf5f5f4].map((hex) =>
  markSharedMaterial(new THREE.MeshStandardMaterial({ color: hex, roughness: 0.88 }))
);
export const SHARED_SHOE_DARK_MAT = markSharedMaterial(
  new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.56 })
);
export const SHARED_SHOE_TAUPE_MAT = markSharedMaterial(
  new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.56 })
);

export function getCachedEdgeMaterial(
  isSelected: boolean,
  isActiveMod: boolean,
  isLightTheme: boolean,
  isPhotoreal = true
): THREE.LineBasicMaterial {
  const key = `sel:${isSelected ? 1 : 0}_act:${isActiveMod ? 1 : 0}_light:${isLightTheme ? 1 : 0}_pr:${isPhotoreal ? 1 : 0}`;
  let m = v3EdgeCache.get(key);
  if (!m) {
    m = new THREE.LineBasicMaterial({
      color: isSelected
        ? 0x2563eb
        : !isPhotoreal
        ? 0x1e293b
        : isLightTheme
        ? 0x3a3530
        : 0x94a3b8,
      linewidth: 1,
      opacity: isSelected
        ? 0.95
        : !isPhotoreal
        ? 0.88
        : isActiveMod
        ? 0.28
        : 0.20,
      transparent: true,
      depthWrite: false,
    });
    markSharedMaterial(m);
    v3EdgeCache.set(key, m);
  }
  return m;
}
