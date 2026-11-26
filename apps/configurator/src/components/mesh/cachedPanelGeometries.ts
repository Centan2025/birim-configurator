import * as THREE from "three";
import { ComponentGeometry } from "@birim/geometry";
import { markSharedGeometry } from "../../v3/materials/webglResourceGuard";

const bevelFrustumCache = new Map<
  string,
  { frustumGeo: THREE.BufferGeometry; frustumEdges: THREE.EdgesGeometry }
>();

/**
 * Builds a true 3D 45°-Sloped Chamfered Frustum Geometry for 45°-beveled cabinet doors (bevel_45).
 * Matches the 2D trapezoidal cross-section drawing 1-to-1: the outer perimeter slopes inward at 45°
 * from the back base (±w/2, ±h/2, -d/2) to the inner bevel plateau (±(w/2 - bevel), ±(h/2 - bevel), +d/2)
 * with 4 crisp diagonal 45° miter lines at the corners!
 */
function createBevel45FrustumGeometry(w: number, h: number, d: number, bevelMm: number): THREE.BufferGeometry {
  const hw = Math.max(20, w / 2);
  const hh = Math.max(20, h / 2);
  const hd = Math.max(3, d / 2);
  const zShoulder = -hd + d * 0.34; // Straight rear shoulder before 45° front chamfer begins
  const b = Math.min(bevelMm, hw * 0.32, hh * 0.32);
  const iw = hw - b;
  const ih = hh - b;
  const TILE_MM = 520;

  // 12 vertices: 0..3 rear base (z = -hd), 4..7 shoulder perimeter (z = zShoulder), 8..11 front 45° plateau (z = +hd)
  const v = [
    [-hw, -hh, -hd],       [hw, -hh, -hd],       [hw, hh, -hd],       [-hw, hh, -hd],
    [-hw, -hh, zShoulder], [hw, -hh, zShoulder], [hw, hh, zShoulder], [-hw, hh, zShoulder],
    [-iw, -ih, hd],        [iw, -ih, hd],        [iw, ih, hd],        [-iw, ih, hd],
  ];

  const quads = [
    [8, 9, 10, 11], // front plateau
    [1, 0, 3, 2],   // rear face
    [0, 1, 5, 4],   // bottom straight shoulder
    [1, 2, 6, 5],   // right straight shoulder
    [2, 3, 7, 6],   // top straight shoulder
    [3, 0, 4, 7],   // left straight shoulder
    [4, 5, 9, 8],   // bottom 45° chamfer slope
    [5, 6, 10, 9],  // right 45° chamfer slope
    [6, 7, 11, 10], // top 45° chamfer slope
    [7, 4, 8, 11],  // left 45° chamfer slope
  ];

  const positions: number[] = [];
  const uvs: number[] = [];
  const pushTri = (i0: number, i1: number, i2: number) => {
    for (const idx of [i0, i1, i2]) {
      const [vx, vy, vz] = v[idx];
      positions.push(vx, vy, vz);
      // World-scale millimeter UV projection so wood grain never distorts on 45° bevel slopes!
      uvs.push((vx + hw) / TILE_MM, (vy + hh) / TILE_MM);
    }
  };
  for (const [a, bIdx, c, dIdx] of quads) {
    pushTri(a, bIdx, c);
    pushTri(a, c, dIdx);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geom.computeVertexNormals();
  return geom;
}

export function getCachedBevel45Frustum(
  w: number,
  h: number,
  d: number,
  bevelMm: number
): { frustumGeo: THREE.BufferGeometry; frustumEdges: THREE.EdgesGeometry } {
  const key = `${Math.round(w)}_${Math.round(h)}_${Math.round(d * 10)}_${Math.round(bevelMm)}`;
  const cached = bevelFrustumCache.get(key);
  if (cached) return cached;

  if (bevelFrustumCache.size >= 96) {
    const oldestKey = bevelFrustumCache.keys().next().value;
    if (oldestKey) {
      const evicted = bevelFrustumCache.get(oldestKey);
      if (evicted) {
        delete evicted.frustumGeo.userData.__birimSharedResource;
        delete evicted.frustumEdges.userData.__birimSharedResource;
        evicted.frustumGeo.dispose();
        evicted.frustumEdges.dispose();
      }
      bevelFrustumCache.delete(oldestKey);
    }
  }

  const frustumGeo = markSharedGeometry(createBevel45FrustumGeometry(w, h, d, bevelMm));
  const frustumEdges = markSharedGeometry(new THREE.EdgesGeometry(frustumGeo, 12));
  const entry = { frustumGeo, frustumEdges };
  bevelFrustumCache.set(key, entry);
  return entry;
}

/**
 * Builds a true 45° Gönye Burun (Miter-Nose) Finger-Pull Geometry (`hnd_bevel_30_backing`):
 * Crisp vertical front face (+Z) spanning full height, with either the TOP edge (`edge = "top"`)
 * or BOTTOM edge (`edge = "bottom"`) mitered at 45° across the full panel thickness toward -Z.
 */
function createTopBevel45PullGeometry(
  w: number,
  h: number,
  d: number,
  edge: "top" | "bottom" = "top"
): { geom: THREE.BufferGeometry; bevelDrop: number } {
  const hw = Math.max(20, w / 2);
  const hh = Math.max(20, h / 2);
  const hd = Math.max(3, d / 2);
  const bevelDrop = Math.min(d, Math.max(8, h * 0.35));
  const yBackBot = edge === "bottom" ? -hh + bevelDrop : -hh;
  const yBackTop = edge === "top" ? hh - bevelDrop : hh;
  const TILE_MM = 520;

  // 8 vertices of trapezoidal prism:
  // 0..3: left face (x = -hw), 4..7: right face (x = +hw)
  // order: back-bot, front-bot, front-top, back-top
  const v = [
    [-hw, yBackBot, -hd],
    [-hw, -hh, hd],
    [-hw, hh, hd],
    [-hw, yBackTop, -hd],
    [hw, yBackBot, -hd],
    [hw, -hh, hd],
    [hw, hh, hd],
    [hw, yBackTop, -hd],
  ];

  const quads = [
    [1, 5, 6, 2], // front face (+Z, full height crisp vertical)
    [4, 0, 3, 7], // rear face (-Z, shortened on beveled edge)
    [2, 6, 7, 3], // top face (45° miter slope when edge="top", flat when edge="bottom")
    [0, 4, 5, 1], // bottom face (45° miter slope when edge="bottom", flat when edge="top")
    [0, 1, 2, 3], // left trapezoidal end face (-X)
    [5, 4, 7, 6], // right trapezoidal end face (+X)
  ];

  const positions: number[] = [];
  const uvs: number[] = [];
  const pushTri = (i0: number, i1: number, i2: number) => {
    for (const idx of [i0, i1, i2]) {
      const [vx, vy, vz] = v[idx];
      positions.push(vx, vy, vz);
      uvs.push((vx + hw) / TILE_MM, (vy + hh) / TILE_MM);
    }
  };
  for (const [a, bIdx, c, dIdx] of quads) {
    pushTri(a, bIdx, c);
    pushTri(a, c, dIdx);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geom.computeVertexNormals();
  return { geom, bevelDrop };
}

const topBevel45PullCache = new Map<
  string,
  { geo: THREE.BufferGeometry; edges: THREE.EdgesGeometry; bevelDrop: number }
>();

export function getCachedTopBevel45Pull(
  w: number,
  h: number,
  d: number,
  edge: "top" | "bottom" = "top"
): { geo: THREE.BufferGeometry; edges: THREE.EdgesGeometry; bevelDrop: number } {
  const key = `${Math.round(w)}_${Math.round(h)}_${Math.round(d * 10)}_${edge}`;
  const cached = topBevel45PullCache.get(key);
  if (cached) return cached;

  if (topBevel45PullCache.size >= 96) {
    const oldestKey = topBevel45PullCache.keys().next().value;
    if (oldestKey) {
      const evicted = topBevel45PullCache.get(oldestKey);
      if (evicted) {
        delete evicted.geo.userData.__birimSharedResource;
        delete evicted.edges.userData.__birimSharedResource;
        evicted.geo.dispose();
        evicted.edges.dispose();
      }
      topBevel45PullCache.delete(oldestKey);
    }
  }

  const built = createTopBevel45PullGeometry(w, h, d, edge);
  const geo = markSharedGeometry(built.geom);
  const edges = markSharedGeometry(new THREE.EdgesGeometry(geo, 12));
  const entry = { geo, edges, bevelDrop: built.bevelDrop };
  topBevel45PullCache.set(key, entry);
  return entry;
}


const countertopCutoutCache = new Map<string, { geo: THREE.BufferGeometry; edges: THREE.EdgesGeometry }>();

export function getCachedCountertopCutoutGeometry(
  w: number,
  h: number,
  d: number,
  hole: NonNullable<ComponentGeometry["cutoutHole"]>,
  grainCrosswise = false
): { geo: THREE.BufferGeometry; edges: THREE.EdgesGeometry } {
  const resolvedW = hole.widthMm ?? hole.width ?? 0;
  const resolvedD = hole.depthMm ?? hole.depth ?? 0;
  const resolvedOffX = hole.offsetX ?? (hole.centerXMm ?? w / 2) - resolvedW / 2;
  const resolvedOffZ = hole.offsetZ ?? (hole.centerZMm ?? d / 2) - resolvedD / 2;
  const key = `${Math.round(w)}_${Math.round(h)}_${Math.round(d)}_${Math.round(resolvedOffX)}_${Math.round(resolvedOffZ)}_${Math.round(resolvedW)}_${Math.round(resolvedD)}_${Math.round(hole.cornerRadiusMm || 10)}_${grainCrosswise ? 1 : 0}`;
  const hit = countertopCutoutCache.get(key);
  if (hit) return hit;

  if (countertopCutoutCache.size >= 48) {
    const oldest = countertopCutoutCache.keys().next().value;
    if (oldest) {
      const ev = countertopCutoutCache.get(oldest);
      if (ev) {
        delete ev.geo.userData.__birimSharedResource;
        delete ev.edges.userData.__birimSharedResource;
        ev.geo.dispose();
        ev.edges.dispose();
      }
      countertopCutoutCache.delete(oldest);
    }
  }

  const hw = w / 2;
  const hd = d / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-hw, -hd);
  shape.lineTo(hw, -hd);
  shape.lineTo(hw, hd);
  shape.lineTo(-hw, hd);
  shape.closePath();

  // Clamp inner cutout safely inside countertop margins (minimum 35mm front/rear/side bridge)
  const holeW = Math.max(80, Math.min(w - 70, resolvedW));
  const holeD = Math.max(80, Math.min(d - 70, resolvedD));
  const x0 = Math.max(-hw + 35, Math.min(hw - 35 - holeW, -hw + resolvedOffX));
  // Shape Y maps to -Z after rotateX(-PI/2), so z in [-hd..hd] maps to shapeY = -z
  const zFront = Math.max(-hd + 35, Math.min(hd - 35 - holeD, -hd + resolvedOffZ));
  const yTop = -zFront;
  const yBot = -(zFront + holeD);
  const r = Math.max(2, Math.min(hole.cornerRadiusMm ?? 12, holeW * 0.2, holeD * 0.2));

  const holePath = new THREE.Path();
  // Clockwise hole winding inside CCW outer shape
  holePath.moveTo(x0 + r, yBot);
  holePath.lineTo(x0 + holeW - r, yBot);
  holePath.quadraticCurveTo(x0 + holeW, yBot, x0 + holeW, yBot + r);
  holePath.lineTo(x0 + holeW, yTop - r);
  holePath.quadraticCurveTo(x0 + holeW, yTop, x0 + holeW - r, yTop);
  holePath.lineTo(x0 + r, yTop);
  holePath.quadraticCurveTo(x0, yTop, x0, yTop - r);
  holePath.lineTo(x0, yBot + r);
  holePath.quadraticCurveTo(x0, yBot, x0 + r, yBot);
  shape.holes.push(holePath);

  const extrudeGeo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(4, h),
    bevelEnabled: true,
    bevelThickness: Math.min(1.5, h * 0.12),
    bevelSize: 1.2,
    bevelSegments: 2,
    curveSegments: 6,
  });
  extrudeGeo.rotateX(-Math.PI / 2);
  extrudeGeo.translate(0, -h / 2, 0);

  // Normalize UVs to physical millimeter scale (matching 780x2850mm veneer/stone UV convention)
  const posAttr = extrudeGeo.getAttribute("position");
  const normAttr = extrudeGeo.getAttribute("normal");
  const uvArr = new Float32Array(posAttr.count * 2);
  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vy = posAttr.getY(i);
    const vz = posAttr.getZ(i);
    const ay = Math.abs(normAttr.getY(i));
    let u = ay > 0.5 ? (vx + hw) / 900 : (vx + vz + hw) / 900;
    let v = ay > 0.5 ? (vz + hd) / 900 : (vy + h / 2) / 900;
    if (grainCrosswise) {
      const tmp = u;
      u = v;
      v = tmp;
    }
    uvArr[i * 2] = u;
    uvArr[i * 2 + 1] = v;
  }
  extrudeGeo.setAttribute("uv", new THREE.BufferAttribute(uvArr, 2));

  const sharedGeo = markSharedGeometry(extrudeGeo);
  const sharedEdges = markSharedGeometry(new THREE.EdgesGeometry(extrudeGeo, 18));
  const entry = { geo: sharedGeo, edges: sharedEdges };
  countertopCutoutCache.set(key, entry);
  return entry;
}


const pentagonCornerCache = new Map<
  string,
  { geo: THREE.BufferGeometry; edges: THREE.EdgesGeometry }
>();

export function getCachedPentagonCornerGeometry(
  w: number,
  h: number,
  d: number,
  wingX: number,
  wingZ: number,
  grainCrosswise = false
): { geo: THREE.BufferGeometry; edges: THREE.EdgesGeometry } {
  const safeW = Math.max(80, w);
  const safeH = Math.max(4, h);
  const safeD = Math.max(80, d);
  const wx = Math.max(40, Math.min(safeW - 12, wingX));
  const wz = Math.max(40, Math.min(safeD - 12, wingZ));
  const key = `pent_${Math.round(safeW)}_${Math.round(safeH)}_${Math.round(safeD)}_${Math.round(wx)}_${Math.round(wz)}_${grainCrosswise ? 1 : 0}`;
  const hit = pentagonCornerCache.get(key);
  if (hit) return hit;

  if (pentagonCornerCache.size >= 64) {
    const oldest = pentagonCornerCache.keys().next().value;
    if (oldest) {
      const ev = pentagonCornerCache.get(oldest);
      if (ev) {
        delete ev.geo.userData.__birimSharedResource;
        delete ev.edges.userData.__birimSharedResource;
        ev.geo.dispose();
        ev.edges.dispose();
      }
      pentagonCornerCache.delete(oldest);
    }
  }

  const hw = safeW / 2;
  const hd = safeD / 2;
  // Shape Y maps to -Z after rotateX(-PI/2):
  // Back-Left (-hw, -hd) -> (-hw, +hd)
  // Front-Left (-hw, +hd) -> (-hw, -hd)
  // Front-Return (-hw + wx, +hd) -> (-hw + wx, -hd)
  // Right-Wing (+hw, -hd + wz) -> (+hw, +hd - wz)
  // Back-Right (+hw, -hd) -> (+hw, +hd)
  const shape = new THREE.Shape();
  shape.moveTo(-hw, hd);
  shape.lineTo(-hw, -hd);
  shape.lineTo(-hw + wx, -hd);
  shape.lineTo(hw, hd - wz);
  shape.lineTo(hw, hd);
  shape.closePath();

  const extrudeGeo = new THREE.ExtrudeGeometry(shape, {
    depth: safeH,
    bevelEnabled: true,
    bevelThickness: Math.min(1.4, safeH * 0.1),
    bevelSize: 1.0,
    bevelSegments: 2,
  });
  extrudeGeo.rotateX(-Math.PI / 2);
  extrudeGeo.translate(0, -safeH / 2, 0);

  const posAttr = extrudeGeo.getAttribute("position");
  const normAttr = extrudeGeo.getAttribute("normal");
  const uvArr = new Float32Array(posAttr.count * 2);
  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vy = posAttr.getY(i);
    const vz = posAttr.getZ(i);
    const ay = Math.abs(normAttr.getY(i));
    let u = ay > 0.5 ? (vx + hw) / 900 : (vx + vz + hw) / 900;
    let v = ay > 0.5 ? (vz + hd) / 900 : (vy + safeH / 2) / 900;
    if (grainCrosswise) {
      const tmp = u;
      u = v;
      v = tmp;
    }
    uvArr[i * 2] = u;
    uvArr[i * 2 + 1] = v;
  }
  extrudeGeo.setAttribute("uv", new THREE.BufferAttribute(uvArr, 2));

  const sharedGeo = markSharedGeometry(extrudeGeo);
  const sharedEdges = markSharedGeometry(new THREE.EdgesGeometry(extrudeGeo, 18));
  const entry = { geo: sharedGeo, edges: sharedEdges };
  pentagonCornerCache.set(key, entry);
  return entry;
}


const lShapeCornerCache = new Map<string, { geo: THREE.BufferGeometry; edges: THREE.EdgesGeometry }>();

export function getCachedLShapeCornerGeometry(
  w: number,
  h: number,
  d: number,
  wingX: number,
  wingZ: number,
  grainCrosswise = false
): { geo: THREE.BufferGeometry; edges: THREE.EdgesGeometry } {
  const safeW = Math.max(20, Math.round(w));
  const safeH = Math.max(4, Math.round(h));
  const safeD = Math.max(20, Math.round(d));
  const wx = Math.max(10, Math.min(safeW - 10, Math.round(wingX)));
  const wz = Math.max(10, Math.min(safeD - 10, Math.round(wingZ)));
  const key = `${safeW}_${safeH}_${safeD}_wx${wx}_wz${wz}_${grainCrosswise ? 1 : 0}`;
  const cached = lShapeCornerCache.get(key);
  if (cached) return cached;
  if (lShapeCornerCache.size >= 160) {
    const oldest = lShapeCornerCache.keys().next().value;
    if (oldest) {
      const ev = lShapeCornerCache.get(oldest);
      if (ev) {
        delete ev.geo.userData.__birimSharedResource;
        delete ev.edges.userData.__birimSharedResource;
        ev.geo.dispose();
        ev.edges.dispose();
      }
      lShapeCornerCache.delete(oldest);
    }
  }

  const hw = safeW / 2;
  const hd = safeD / 2;
  // Shape Y maps to -Z after rotateX(-PI/2):
  // 6-sided seamless single-piece L-corner slab (ZERO seam between wings!)
  const shape = new THREE.Shape();
  shape.moveTo(-hw, hd);               // Back-Left  (x=0, z=0)
  shape.lineTo(-hw, -hd);              // Front-Left (x=0, z=D)
  shape.lineTo(-hw + wx, -hd);         // Return Front-Right (x=wx, z=D)
  shape.lineTo(-hw + wx, hd - wz);     // Inner 90° L-Corner (x=wx, z=wz)
  shape.lineTo(hw, hd - wz);           // Main-Wing Front-Right (x=W, z=wz)
  shape.lineTo(hw, hd);                // Back-Right (x=W, z=0)
  shape.closePath();

  const extrudeGeo = new THREE.ExtrudeGeometry(shape, {
    depth: safeH,
    bevelEnabled: true,
    bevelThickness: Math.min(1.4, safeH * 0.1),
    bevelSize: 1.0,
    bevelSegments: 2,
  });
  extrudeGeo.rotateX(-Math.PI / 2);
  extrudeGeo.translate(0, -safeH / 2, 0);

  const posAttr = extrudeGeo.getAttribute("position");
  const normAttr = extrudeGeo.getAttribute("normal");
  const uvArr = new Float32Array(posAttr.count * 2);
  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vy = posAttr.getY(i);
    const vz = posAttr.getZ(i);
    const ay = Math.abs(normAttr.getY(i));
    let u = ay > 0.5 ? (vx + hw) / 900 : (vx + vz + hw) / 900;
    let v = ay > 0.5 ? (vz + hd) / 900 : (vy + safeH / 2) / 900;
    if (grainCrosswise) {
      const tmp = u;
      u = v;
      v = tmp;
    }
    uvArr[i * 2] = u;
    uvArr[i * 2 + 1] = v;
  }
  extrudeGeo.setAttribute("uv", new THREE.BufferAttribute(uvArr, 2));

  const sharedGeo = markSharedGeometry(extrudeGeo);
  const sharedEdges = markSharedGeometry(new THREE.EdgesGeometry(extrudeGeo, 18));
  const entry = { geo: sharedGeo, edges: sharedEdges };
  lShapeCornerCache.set(key, entry);
  return entry;
}

const worldUvBoxCache = new Map<string, THREE.BufferGeometry>();

export function getCachedWorldUvBoxGeometry(
  w: number,
  h: number,
  d: number,
  grainCrosswise = false,
  grainOffsetXMm = 0,
  grainOffsetYMm = 0
): THREE.BufferGeometry {
  const key = `${Math.round(w)}_${Math.round(h)}_${Math.round(d)}_${grainCrosswise ? 1 : 0}_gx${Math.round(grainOffsetXMm)}_gy${Math.round(grainOffsetYMm)}`;
  const hit = worldUvBoxCache.get(key);
  if (hit) return hit;

  if (worldUvBoxCache.size >= 160) {
    const oldest = worldUvBoxCache.keys().next().value;
    if (oldest) {
      const ev = worldUvBoxCache.get(oldest);
      if (ev) {
        delete ev.userData.__birimSharedResource;
        ev.dispose();
      }
      worldUvBoxCache.delete(oldest);
    }
  }

  const geo = new THREE.BoxGeometry(Math.max(1, w), Math.max(1, h), Math.max(1, d));
  const pos = geo.getAttribute("position");
  const norm = geo.getAttribute("normal");
  const uv = geo.getAttribute("uv");
  const hw = w / 2;
  const hh = h / 2;
  const hd = d / 2;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const ax = Math.abs(norm.getX(i));
    const ay = Math.abs(norm.getY(i));
    const az = Math.abs(norm.getZ(i));
    let u = 0;
    let v = 0;
    if (az >= ax && az >= ay) {
      u = (grainOffsetXMm + vx + hw) / 780;
      v = (grainOffsetYMm + vy + hh) / 2850;
    } else if (ax >= ay) {
      u = (grainOffsetXMm + vz + hd) / 780;
      v = (grainOffsetYMm + vy + hh) / 2850;
    } else {
      u = (grainOffsetXMm + vx + hw) / 780;
      v = (grainOffsetYMm + vz + hd) / 2850;
    }
    if (grainCrosswise) {
      const t = u;
      u = v;
      v = t;
    }
    uv.setXY(i, u, v);
  }
  uv.needsUpdate = true;
  const shared = markSharedGeometry(geo);
  worldUvBoxCache.set(key, shared);
  return shared;
}

const microBevelPanelCache = new Map<string, THREE.BufferGeometry>();

function hashStringSeed(str: string): [number, number] {
  let h1 = 2166136261;
  let h2 = 16777619;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619);
    h2 = Math.imul(h2 ^ (c + 31), 2166136261);
  }
  return [((h1 >>> 0) % 1000) / 1000, ((h2 >>> 0) % 1000) / 1000];
}

/**
 * Builds a watertight 3D Micro-Beveled Panel Geometry (smooth 2-segment rounded edges + corner fillets)
 * with analytical surface normals so studio HDRI light catches realistic 1.5mm specular edge highlights,
 * plus physical millimeter-scaled UVs so wood grain never stretches across tall doors vs short drawers.
 */
function createMicroBeveledBoxGeometry(
  w: number,
  h: number,
  d: number,
  radiusMm: number,
  seedU: number,
  seedV: number,
  continuousGrainUv?: { offsetXMm: number; offsetYMm: number; crosswise?: boolean }
): THREE.BufferGeometry {
  const hw = Math.max(2, w / 2);
  const hh = Math.max(2, h / 2);
  const hd = Math.max(1.5, d / 2);
  const r = Math.min(radiusMm, hw * 0.28, hh * 0.28, hd * 0.42);
  const ix = hw - r;
  const iy = hh - r;
  const iz = hd - r;

  // 6 profile samples per axis: [-1, -0.707, 0] on negative core, [0, +0.707, +1] on positive core
  const profDirs = [-1, -Math.SQRT1_2, 0, 0, Math.SQRT1_2, 1];
  const profSigns = [-1, -1, -1, 1, 1, 1];
  const N = profDirs.length; // 6

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const emitFaceGrid = (
    evalNode: (i: number, j: number) => {
      sx: number;
      sy: number;
      sz: number;
      dx: number;
      dy: number;
      dz: number;
    },
    flipWinding: boolean
  ) => {
    const baseVertex = positions.length / 3;
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const { sx, sy, sz, dx, dy, dz } = evalNode(i, j);
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
        const nx = dx / len;
        const ny = dy / len;
        const nz = dz / len;

        const vx = sx * ix + r * nx;
        const vy = sy * iy + r * ny;
        const vz = sz * iz + r * nz;

        positions.push(vx, vy, vz);
        normals.push(nx, ny, nz);

        // Full-Sheet 2800mm Continuous Veneer Leaf UV Mapping (ZERO horizontal seam across 220cm doors!)
        const ax = Math.abs(nx);
        const ay = Math.abs(ny);
        const az = Math.abs(nz);
        let u = 0;
        let v = 0;
        const gxOff = continuousGrainUv ? continuousGrainUv.offsetXMm : 0;
        const gyOff = continuousGrainUv ? continuousGrainUv.offsetYMm : 0;
        const effSu = continuousGrainUv ? 0 : seedU;
        const effSv = continuousGrainUv ? 0 : seedV * 0.08;
        if (az >= ax && az >= ay) {
          u = (gxOff + vx + hw) / 780 + effSu;
          v = (gyOff + vy + hh) / 2850 + effSv;
        } else if (ax >= ay) {
          u = (gxOff + vz + hd) / 780 + effSu;
          v = (gyOff + vy + hh) / 2850 + effSv;
        } else {
          u = (gxOff + vx + hw) / 780 + effSu;
          v = (gyOff + vz + hd) / 780 + effSv;
        }
        if (continuousGrainUv?.crosswise) {
          const tmpUv = u;
          u = v;
          v = tmpUv;
        }
        uvs.push(u, v);
      }
    }

    for (let j = 0; j < N - 1; j++) {
      for (let i = 0; i < N - 1; i++) {
        const a = baseVertex + j * N + i;
        const b = a + 1;
        const c = a + N + 1;
        const dIdx = a + N;
        if (flipWinding) {
          indices.push(a, c, b, a, dIdx, c);
        } else {
          indices.push(a, b, c, a, c, dIdx);
        }
      }
    }
  };

  // +Z Front & -Z Back
  emitFaceGrid(
    (i, j) => ({
      sx: profSigns[i],
      sy: profSigns[j],
      sz: 1,
      dx: profDirs[i],
      dy: profDirs[j],
      dz: 1,
    }),
    false
  );
  emitFaceGrid(
    (i, j) => ({
      sx: profSigns[i],
      sy: profSigns[j],
      sz: -1,
      dx: profDirs[i],
      dy: profDirs[j],
      dz: -1,
    }),
    true
  );

  // +X Right & -X Left
  emitFaceGrid(
    (i, j) => ({
      sx: 1,
      sy: profSigns[j],
      sz: profSigns[i],
      dx: 1,
      dy: profDirs[j],
      dz: profDirs[i],
    }),
    true
  );
  emitFaceGrid(
    (i, j) => ({
      sx: -1,
      sy: profSigns[j],
      sz: profSigns[i],
      dx: -1,
      dy: profDirs[j],
      dz: profDirs[i],
    }),
    false
  );

  // +Y Top & -Y Bottom
  emitFaceGrid(
    (i, j) => ({
      sx: profSigns[i],
      sy: 1,
      sz: profSigns[j],
      dx: profDirs[i],
      dy: 1,
      dz: profDirs[j],
    }),
    true
  );
  emitFaceGrid(
    (i, j) => ({
      sx: profSigns[i],
      sy: -1,
      sz: profSigns[j],
      dx: profDirs[i],
      dy: -1,
      dz: profDirs[j],
    }),
    false
  );

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geom.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeBoundingBox();
  geom.computeBoundingSphere();
  return geom;
}

export function getCachedBeveledPanelGeometry(
  w: number,
  h: number,
  d: number,
  radiusMm: number,
  seedKey: string,
  continuousGrainUv?: { offsetXMm: number; offsetYMm: number; crosswise?: boolean }
): THREE.BufferGeometry {
  const bucket = Math.abs(seedKey.split("").reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7)) % 6;
  const cgKey = continuousGrainUv
    ? `cg_${Math.round(continuousGrainUv.offsetXMm)}_${Math.round(continuousGrainUv.offsetYMm)}_${continuousGrainUv.crosswise ? 1 : 0}`
    : `s${bucket}`;
  const key = `bv_${Math.round(w)}_${Math.round(h)}_${Math.round(d * 10)}_r${Math.round(radiusMm * 10)}_${cgKey}`;
  const cached = microBevelPanelCache.get(key);
  if (cached) return cached;

  if (microBevelPanelCache.size >= 180) {
    const oldest = microBevelPanelCache.keys().next().value;
    if (oldest) {
      const ev = microBevelPanelCache.get(oldest);
      if (ev) {
        delete ev.userData.__birimSharedResource;
        ev.dispose();
      }
      microBevelPanelCache.delete(oldest);
    }
  }

  const [su, sv] = hashStringSeed(`s_${bucket}`);
  const geo = markSharedGeometry(createMicroBeveledBoxGeometry(w, h, d, radiusMm, su, sv, continuousGrainUv));
  microBevelPanelCache.set(key, geo);
  return geo;
}


const MITER_45_CARCASS_GEO_CACHE = new Map<string, { geo: THREE.BufferGeometry; edges: THREE.EdgesGeometry }>();

export function getCachedMiter45CarcassGeometry(
  role: "carcass_top" | "carcass_bottom" | "carcass_side_left" | "carcass_side_right",
  w: number,
  h: number,
  d: number
): { geo: THREE.BufferGeometry; edges: THREE.EdgesGeometry } {
  const key = `${role}_${Math.round(w * 10)}_${Math.round(h * 10)}_${Math.round(d * 10)}`;
  const cached = MITER_45_CARCASS_GEO_CACHE.get(key);
  if (cached) return cached;

  const hw = w / 2;
  const hh = h / 2;
  const shape = new THREE.Shape();

  const gap = 0.35; // 0.35mm physical shadow-gap relief so 45° miter seam catches light cleanly without Z-fighting
  if (role === "carcass_top") {
    const inset = Math.min(h, Math.max(0, hw - 1));
    shape.moveTo(-hw + gap, hh);
    shape.lineTo(hw - gap, hh);
    shape.lineTo(hw - inset - gap, -hh);
    shape.lineTo(-hw + inset + gap, -hh);
    shape.closePath();
  } else if (role === "carcass_bottom") {
    const inset = Math.min(h, Math.max(0, hw - 1));
    shape.moveTo(-hw + gap, -hh);
    shape.lineTo(hw - gap, -hh);
    shape.lineTo(hw - inset - gap, hh);
    shape.lineTo(-hw + inset + gap, hh);
    shape.closePath();
  } else if (role === "carcass_side_left") {
    const inset = Math.min(w, Math.max(0, hh - 1));
    shape.moveTo(-hw, -hh + gap);
    shape.lineTo(-hw, hh - gap);
    shape.lineTo(hw, hh - inset - gap);
    shape.lineTo(hw, -hh + inset + gap);
    shape.closePath();
  } else {
    // carcass_side_right
    const inset = Math.min(w, Math.max(0, hh - 1));
    shape.moveTo(hw, -hh + gap);
    shape.lineTo(hw, hh - gap);
    shape.lineTo(-hw, hh - inset - gap);
    shape.lineTo(-hw, -hh + inset + gap);
    shape.closePath();
  }

  const rawGeo = new THREE.ExtrudeGeometry(shape, {
    depth: d,
    bevelEnabled: false,
    curveSegments: 1,
    steps: 1,
  });
  rawGeo.translate(0, 0, -d / 2);
  const geo = rawGeo.index ? rawGeo.toNonIndexed() : rawGeo;
  if (geo !== rawGeo) rawGeo.dispose();
  geo.computeVertexNormals();

  // Tri-planar world-mm UVs so woodgrain / melamine textures match adjacent panels cleanly
  const pos = geo.getAttribute("position");
  const norm = geo.getAttribute("normal");
  const uvArr = new Float32Array(pos.count * 2);
  const uvScale = 1 / 600;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    const pz = pos.getZ(i);
    const nx = Math.abs(norm.getX(i));
    const ny = Math.abs(norm.getY(i));
    const nz = Math.abs(norm.getZ(i));
    if (nz >= nx && nz >= ny) {
      uvArr[i * 2] = (px + hw) * uvScale;
      uvArr[i * 2 + 1] = (py + hh) * uvScale;
    } else if (nx >= ny) {
      uvArr[i * 2] = (pz + d / 2) * uvScale;
      uvArr[i * 2 + 1] = (py + hh) * uvScale;
    } else {
      uvArr[i * 2] = (px + hw) * uvScale;
      uvArr[i * 2 + 1] = (pz + d / 2) * uvScale;
    }
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uvArr, 2));
  geo.computeBoundingBox();
  geo.computeBoundingSphere();

  const edges = new THREE.EdgesGeometry(geo, 20);
  markSharedGeometry(geo);
  markSharedGeometry(edges);

  if (MITER_45_CARCASS_GEO_CACHE.size >= 96) {
    const oldestKey = MITER_45_CARCASS_GEO_CACHE.keys().next().value;
    if (oldestKey) {
      const ev = MITER_45_CARCASS_GEO_CACHE.get(oldestKey);
      if (ev) {
        ev.geo.dispose();
        ev.edges.dispose();
      }
      MITER_45_CARCASS_GEO_CACHE.delete(oldestKey);
    }
  }
  const entry = { geo, edges };
  MITER_45_CARCASS_GEO_CACHE.set(key, entry);
  return entry;
}

const POLYGON_CONTOUR_GEO_CACHE = new Map<
  string,
  { geo: THREE.BufferGeometry; edges: THREE.EdgesGeometry }
>();

/**
 * Builds true 3D extruded non-rectangular panel geometry (trapezoid / pentagon)
 * from `comp.polygonContourMm` for sloped-ceiling / attic-cut panels:
 * - thicknessAxis === "z" (doors, backs): contour points are [xMm (0..w), yMm (0..h)], extruded along Z (d)
 * - thicknessAxis === "x" (sides, dividers): contour points are [zMm (0..d), yMm (0..h)], extruded along X (w)
 */
export function getCachedPolygonContourGeometry(
  w: number,
  h: number,
  d: number,
  thicknessAxis: "x" | "z",
  contour: [number, number][]
): { geo: THREE.BufferGeometry; edges: THREE.EdgesGeometry } {
  const ptsKey = contour.map(([a, b]) => `${Math.round(a)},${Math.round(b)}`).join(";");
  const key = `${thicknessAxis}_${Math.round(w)}_${Math.round(h)}_${Math.round(d)}_${ptsKey}`;
  const cached = POLYGON_CONTOUR_GEO_CACHE.get(key);
  if (cached) return cached;

  const shape = new THREE.Shape();
  const halfU = thicknessAxis === "z" ? w / 2 : d / 2;
  const halfV = h / 2;
  const extrudeDepth = thicknessAxis === "z" ? d : w;

  contour.forEach(([u, v], idx) => {
    const sx = u - halfU;
    const sy = v - halfV;
    if (idx === 0) shape.moveTo(sx, sy);
    else shape.lineTo(sx, sy);
  });
  shape.closePath();

  const rawGeo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(1, extrudeDepth),
    bevelEnabled: false,
    curveSegments: 1,
    steps: 1,
  });
  rawGeo.translate(0, 0, -Math.max(1, extrudeDepth) / 2);
  if (thicknessAxis === "x") {
    // Map local shape X (zMm - d/2) -> +Z, extrude Z (-w/2..+w/2) -> X
    rawGeo.rotateY(-Math.PI / 2);
  }
  const geo = rawGeo.index ? rawGeo.toNonIndexed() : rawGeo;
  if (geo !== rawGeo) rawGeo.dispose();
  geo.computeVertexNormals();

  // Tri-planar world-mm UVs matching adjacent rectangular panels
  const pos = geo.getAttribute("position");
  const norm = geo.getAttribute("normal");
  const uvArr = new Float32Array(pos.count * 2);
  const uvScale = 1 / 600;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    const pz = pos.getZ(i);
    const nx = Math.abs(norm.getX(i));
    const ny = Math.abs(norm.getY(i));
    const nz = Math.abs(norm.getZ(i));
    if (nz >= nx && nz >= ny) {
      uvArr[i * 2] = (px + w / 2) * uvScale;
      uvArr[i * 2 + 1] = (py + h / 2) * uvScale;
    } else if (nx >= ny) {
      uvArr[i * 2] = (pz + d / 2) * uvScale;
      uvArr[i * 2 + 1] = (py + h / 2) * uvScale;
    } else {
      uvArr[i * 2] = (px + w / 2) * uvScale;
      uvArr[i * 2 + 1] = (pz + d / 2) * uvScale;
    }
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uvArr, 2));
  geo.computeBoundingBox();
  geo.computeBoundingSphere();

  const edges = new THREE.EdgesGeometry(geo, 18);
  markSharedGeometry(geo);
  markSharedGeometry(edges);

  if (POLYGON_CONTOUR_GEO_CACHE.size >= 120) {
    const oldestKey = POLYGON_CONTOUR_GEO_CACHE.keys().next().value;
    if (oldestKey) {
      const ev = POLYGON_CONTOUR_GEO_CACHE.get(oldestKey);
      if (ev) {
        ev.geo.dispose();
        ev.edges.dispose();
      }
      POLYGON_CONTOUR_GEO_CACHE.delete(oldestKey);
    }
  }
  const entry = { geo, edges };
  POLYGON_CONTOUR_GEO_CACHE.set(key, entry);
  return entry;
}
