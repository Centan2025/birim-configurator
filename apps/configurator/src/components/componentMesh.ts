import * as THREE from "three";
import { calculateModulePlacement, ModuleInstance } from "@birim/core";
import { ComponentGeometry } from "@birim/geometry";
import {
  markSharedGeometry,
  markSharedMaterial,
} from "../v3/materials/webglResourceGuard";
import {
  getCachedJPullBevelDoorGeometry,
  getCachedContouredDoorSweepGeometry,
} from "../v3/materials/capsuleAndProfileGeometry";

const box = markSharedGeometry(new THREE.BoxGeometry(1, 1, 1));
const sphere = markSharedGeometry(new THREE.SphereGeometry(0.5, 20, 14));
const cylinder = new THREE.CylinderGeometry(0.5, 0.5, 1, 20);
cylinder.rotateX(Math.PI / 2);
markSharedGeometry(cylinder);
const cylinderY = markSharedGeometry(new THREE.CylinderGeometry(0.5, 0.5, 1, 20));
const edges = markSharedGeometry(new THREE.EdgesGeometry(box));
const cylinderRimEdges = markSharedGeometry(new THREE.EdgesGeometry(cylinder, 28));

const liftDoorDirectionGeo = (() => {
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    "position",
    new THREE.BufferAttribute(
      new Float32Array([-0.46, -0.45, 0.52, 0.0, 0.45, 0.52, 0.0, 0.45, 0.52, 0.46, -0.45, 0.52]),
      3
    )
  );
  return markSharedGeometry(g);
})();

const leftDoorDirectionGeo = (() => {
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    "position",
    new THREE.BufferAttribute(
      new Float32Array([-0.48, 0.46, 0.52, 0.45, 0.0, 0.52, 0.45, 0.0, 0.52, -0.48, -0.46, 0.52]),
      3
    )
  );
  return markSharedGeometry(g);
})();

const rightDoorDirectionGeo = (() => {
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    "position",
    new THREE.BufferAttribute(
      new Float32Array([0.48, 0.46, 0.52, -0.45, 0.0, 0.52, -0.45, 0.0, 0.52, 0.48, -0.46, 0.52]),
      3
    )
  );
  return markSharedGeometry(g);
})();

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

function getCachedBevel45Frustum(
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


const countertopCutoutCache = new Map<string, { geo: THREE.BufferGeometry; edges: THREE.EdgesGeometry }>();

function getCachedCountertopCutoutGeometry(
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

function getCachedPentagonCornerGeometry(
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

const worldUvBoxCache = new Map<string, THREE.BufferGeometry>();

function getCachedWorldUvBoxGeometry(
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

function getCachedBeveledPanelGeometry(
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

const darkDamperMat = new THREE.MeshStandardMaterial({
  color: 0x1e293b,
  roughness: 0.32,
  metalness: 0.65,
});
const screwHeadMat = new THREE.MeshStandardMaterial({
  color: 0x94a3b8,
  roughness: 0.2,
  metalness: 0.92,
});
const chromeHardwareMat = new THREE.MeshStandardMaterial({
  color: 0xe2e8f0,
  roughness: 0.16,
  metalness: 0.94,
});
const blumAccentMat = new THREE.MeshStandardMaterial({
  color: 0xea580c,
  roughness: 0.3,
  metalness: 0.2,
});
const darkCavityMat = new THREE.MeshStandardMaterial({
  color: 0x09090b,
  roughness: 0.85,
  metalness: 0.1,
});
const burnerRingMat = new THREE.MeshBasicMaterial({
  color: 0xef4444,
});
const handleAccentMat = new THREE.MeshStandardMaterial({
  color: 0xd97706,
  roughness: 0.22,
  metalness: 0.88,
});
const revealShadowMat = new THREE.LineBasicMaterial({
  color: 0x1c1917,
  transparent: true,
  opacity: 0.34,
});
const doorDirectionLineMat = new THREE.LineBasicMaterial({
  color: 0x64748b,
  transparent: true,
  opacity: 0.55,
});

const sharedDarkAnodizedFrameMat = markSharedMaterial(
  new THREE.MeshStandardMaterial({
    color: 0x1e2024,
    roughness: 0.34,
    metalness: 0.85,
  })
);
const sharedSmokedGlassPaneMat = markSharedMaterial(
  new THREE.MeshPhysicalMaterial({
    color: 0x242c35,
    roughness: 0.04,
    metalness: 0.12,
    transmission: 0,
    ior: 1.52,
    reflectivity: 0.98,
    clearcoat: 0.9,
    clearcoatRoughness: 0.03,
    envMapIntensity: 1.65,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  })
);
const sharedBronzeMirrorPaneMat = markSharedMaterial(
  new THREE.MeshPhysicalMaterial({
    color: 0xcbb69e,
    roughness: 0.02,
    metalness: 0.98,
    clearcoat: 1.0,
    clearcoatRoughness: 0.015,
    envMapIntensity: 1.6,
  })
);
const sharedSilverMirrorPaneMat = markSharedMaterial(
  new THREE.MeshPhysicalMaterial({
    color: 0xe6eaef,
    roughness: 0.02,
    metalness: 0.98,
    clearcoat: 1.0,
    clearcoatRoughness: 0.015,
    envMapIntensity: 1.6,
  })
);
const fugaShadowGapMat = markSharedMaterial(
  new THREE.MeshStandardMaterial({
    color: 0x0e0d0c,
    roughness: 0.96,
    metalness: 0.0,
  })
);

[
  darkDamperMat,
  screwHeadMat,
  chromeHardwareMat,
  blumAccentMat,
  darkCavityMat,
  burnerRingMat,
  handleAccentMat,
  revealShadowMat,
  doorDirectionLineMat,
].forEach((m) => markSharedMaterial(m));

const customAccentMaterials = new Set<THREE.Material>([
  darkDamperMat,
  screwHeadMat,
  chromeHardwareMat,
  blumAccentMat,
  darkCavityMat,
  burnerRingMat,
  handleAccentMat,
  sharedSmokedGlassPaneMat,
  sharedBronzeMirrorPaneMat,
  sharedSilverMirrorPaneMat,
  fugaShadowGapMat,
]);

function tagSubMesh(
  mesh: THREE.Mesh,
  userData: Record<string, unknown>,
  comp: ComponentGeometry
) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const isCustomMat =
    ! Array.isArray(mesh.material) && customAccentMaterials.has(mesh.material);
  mesh.userData = {
    ...userData,
    parentComponentId: comp.parentComponentId,
    handleCategory: comp.handleCategory,
    preserveCustomMaterial: isCustomMat,
  };
}

/**
 * Shared unit geometry with realistic multi-part 3D mechanical assemblies for:
 * - True 2-Part Concealed Hinges (Carcass plate stays stationary on side panel while Ø35mm cup rotates with door + articulated link arm)
 * - Blum AVENTOS HK / HL / HF Lift-Up Power Storage Units & Telescopic Arms
 * - Gola Extruded L/C Channels, J-Pull Milled Door Cutouts, Recessed Finger Pockets & Edge Profiles
 * - Stainless Steel Undermount Sink + Swan-Neck Faucet & 4-Zone Induction Cooktop
 */
function disableLineRaycast(obj: THREE.Object3D) {
  obj.traverse((child) => {
    if (child instanceof THREE.Line || child instanceof THREE.LineSegments) {
      child.raycast = () => {};
    }
  });
}

export function createComponentMesh(
  comp: ComponentGeometry,
  material: THREE.Material,
  edgeMaterial: THREE.Material,
  userData: Record<string, unknown>
): THREE.Group {
  const group = new THREE.Group();
  const pivot = comp.pivot ?? comp.position;
  group.position.set(pivot.x, pivot.y, pivot.z);
  if (comp.rotation) group.rotation.set(...comp.rotation);

  const cx = comp.position.x - pivot.x + comp.dimensions.width / 2;
  const cy = comp.position.y - pivot.y + comp.dimensions.height / 2;
  const cz = comp.position.z - pivot.z + comp.dimensions.depth / 2;

  // 1. TRUE 2-PART CONCEALED HINGE KINEMATICS (Blum CLIP top BLUMOTION / Hettich Sensys)
  //    - Door-Mounted Ø35mm Cup & Flange rotate WITH the door leaf
  //    - Carcass-Mounted Cruciform System 32 Plate & Damper Body stay STATIONARY on the carcass side panel (counter-rotated by -doorYaw)!
  //    - Articulated Gooseneck Link Arm bridges between the stationary carcass plate and the rotating door cup!
  if (comp.id.includes("_lcorner_bifold_hinge_")) {
    // Blum CLIP top 79T8500 60° Inner-Corner Bi-Fold Hinge — strictly on the INSIDE back faces of Leaf 1 & Leaf 2!
    const wing1 = new THREE.Mesh(box, chromeHardwareMat);
    wing1.scale.set(22, 44, 4);
    wing1.position.set(cx + 4, cy, cz + 7);
    tagSubMesh(wing1, userData, comp);
    group.add(wing1);

    const wing2 = new THREE.Mesh(box, chromeHardwareMat);
    wing2.scale.set(4, 44, 22);
    wing2.position.set(cx + 7, cy, cz + 4);
    tagSubMesh(wing2, userData, comp);
    group.add(wing2);

    const knuckle = new THREE.Mesh(cylinderY, screwHeadMat);
    knuckle.scale.set(8, 48, 8);
    knuckle.position.set(cx + 6, cy, cz + 6);
    tagSubMesh(knuckle, userData, comp);
    group.add(knuckle);
    return group;
  }

  if (comp.role === "door_hinge") {
    const isDiag45Hinge = comp.id.includes("_diag45_hinge_");
    const isRightHinge = comp.id.includes("right") || comp.label.includes("Sağ");
    const dirSign = isRightHinge ? -1 : 1;
    const doorYaw = comp.rotation?.[1] || 0;
    // NOTE: group origin is at door pivot (z_local = 0 is OUTER face of 18mm door, z_local = -18 is INNER back face of door).
    // All hinge parts MUST stay at z_local <= -15 so NOTHING ever pokes through the front face of the door!
    const cupX = dirSign * 21;

    // PART A (ROTATES WITH DOOR): Ø35mm Cylindrical Hinge Cup + Oval Flange strictly on INNER back face of door (z_local = -18.5)
    const cupMesh = new THREE.Mesh(cylinder, chromeHardwareMat);
    cupMesh.scale.set(35, 35, 5);
    cupMesh.position.set(cupX, cy, -16.5);
    tagSubMesh(cupMesh, userData, comp);
    group.add(cupMesh);

    const flangeMesh = new THREE.Mesh(box, chromeHardwareMat);
    flangeMesh.scale.set(22, 58, 2.5);
    flangeMesh.position.set(cupX, cy, -19.2);
    tagSubMesh(flangeMesh, userData, comp);
    group.add(flangeMesh);

    [-22.5, 22.5].forEach((dy) => {
      const boss = new THREE.Mesh(cylinder, screwHeadMat);
      boss.scale.set(8, 8, 3);
      boss.position.set(cupX, cy + dy, -18.5);
      tagSubMesh(boss, userData, comp);
      group.add(boss);
    });

    // PART B (STATIONARY ON CARCASS SIDE PANEL): Counter-rotate by -doorYaw around hinge pivot (0, cy, 0)
    // Positioned inside the carcass at z_local = -42..-22 so it stays bolted to the inner side panel!
    const carcassFixedGroup = new THREE.Group();
    // On +45° diagonal corner doors, rotation[1] at closed state is +diagAngle (~0.785 rad),
    // so counter-rotating by -(doorYaw) aligns with the front-return Z panel; shift plateX = -22 so it stays strictly inside x <= wingD - 14!
    carcassFixedGroup.rotation.y = -doorYaw;

    const plateX = isDiag45Hinge ? -22 : dirSign * 5;
    const plateZ = isDiag45Hinge ? -28 : -42;
    const mountWingVert = new THREE.Mesh(box, chromeHardwareMat);
    mountWingVert.scale.set(6, 54, 16);
    mountWingVert.position.set(plateX, cy, plateZ);
    tagSubMesh(mountWingVert, userData, comp);
    carcassFixedGroup.add(mountWingVert);

    const mountWingHoriz = new THREE.Mesh(box, chromeHardwareMat);
    mountWingHoriz.scale.set(8, 18, 32);
    mountWingHoriz.position.set(plateX + dirSign * 2, cy, plateZ + 4);
    tagSubMesh(mountWingHoriz, userData, comp);
    carcassFixedGroup.add(mountWingHoriz);

    [-16, 16].forEach((dy) => {
      const mountScrew = new THREE.Mesh(sphere, screwHeadMat);
      mountScrew.scale.set(6.5, 6.5, 6.5);
      mountScrew.position.set(plateX + dirSign * 3, cy + dy, plateZ);
      tagSubMesh(mountScrew, userData, comp);
      carcassFixedGroup.add(mountScrew);
    });

    const armBody = new THREE.Mesh(box, chromeHardwareMat);
    armBody.scale.set(13, 15, 24);
    armBody.position.set(plateX + dirSign * 6, cy, -33);
    tagSubMesh(armBody, userData, comp);
    carcassFixedGroup.add(armBody);

    const damperMesh = new THREE.Mesh(cylinder, darkDamperMat);
    damperMesh.scale.set(10, 10, 20);
    damperMesh.position.set(plateX + dirSign * 6, cy + 3, -32);
    tagSubMesh(damperMesh, userData, comp);
    carcassFixedGroup.add(damperMesh);

    group.add(carcassFixedGroup);

    // PART C (ARTICULATED FOLDING GOOSENECK LINKAGE ARM): Strictly behind inner door face (z_local = -25)
    const linkGroup = new THREE.Group();
    linkGroup.rotation.y = -doorYaw * 0.48;
    const neckLink = new THREE.Mesh(box, chromeHardwareMat);
    neckLink.scale.set(14, 13, 14);
    neckLink.position.set(dirSign * 13, cy, -25);
    tagSubMesh(neckLink, userData, comp);
    linkGroup.add(neckLink);

    const pivotPin = new THREE.Mesh(cylinderY, screwHeadMat);
    pivotPin.scale.set(6, 18, 6);
    pivotPin.position.set(dirSign * 9, cy, -21);
    tagSubMesh(pivotPin, userData, comp);
    linkGroup.add(pivotPin);

    group.add(linkGroup);
    group.userData.hingeCarcassFixed = carcassFixedGroup;
    group.userData.hingeLinkGroup = linkGroup;
    return group;
  }

  // 1B. WORLD-STANDARD PLINTH HARDWARE: HÄFELE AXILO 78 LEGS, C-CLIPS, PVC WATER SEALS & STEEL M10 GLIDES
  if (comp.id.includes("_plastic_leg_")) {
    const h = comp.dimensions.height;
    // 1. Wide Ø64mm ribbed floor glide foot with subtle radial step
    const baseFoot = new THREE.Mesh(cylinderY, darkCavityMat);
    baseFoot.scale.set(64, 6, 64);
    baseFoot.position.set(cx, cy - h / 2 + 3, cz);
    tagSubMesh(baseFoot, userData, comp);
    group.add(baseFoot);

    const footHub = new THREE.Mesh(cylinderY, darkDamperMat);
    footHub.scale.set(48, 8, 48);
    footHub.position.set(cx, cy - h / 2 + 8, cz);
    tagSubMesh(footHub, userData, comp);
    group.add(footHub);

    // 2. Threaded Ø36mm heavy-duty ABS column
    const legShaft = new THREE.Mesh(cylinderY, darkDamperMat);
    legShaft.scale.set(36, Math.max(18, h - 20), 36);
    legShaft.position.set(cx, cy + 1, cz);
    tagSubMesh(legShaft, userData, comp);
    group.add(legShaft);

    // 3. Häfele Axilo™ gear adjustment collar ring
    const collarRing = new THREE.Mesh(cylinderY, screwHeadMat);
    collarRing.scale.set(46, 11, 46);
    collarRing.position.set(cx, cy - h * 0.14, cz);
    tagSubMesh(collarRing, userData, comp);
    group.add(collarRing);

    // 4. Rectangular 76×52mm Carcass-Edge Support Saddle Plate (supports both Side Panel & Bottom Panel!)
    const topSaddle = new THREE.Mesh(box, darkCavityMat);
    topSaddle.scale.set(76, 7, 52);
    topSaddle.position.set(cx, cy + h / 2 - 3.5, cz);
    tagSubMesh(topSaddle, userData, comp);
    group.add(topSaddle);

    return group;
  }

  if (comp.id.includes("_plinth_clip_")) {
    const w = comp.dimensions.width;
    const h = comp.dimensions.height;
    const d = comp.dimensions.depth;
    // Rear plinth screw-on bracket plate
    const plate = new THREE.Mesh(box, darkCavityMat);
    plate.scale.set(w, h * 0.72, 4);
    plate.position.set(cx, cy, cz + d / 2 - 2);
    tagSubMesh(plate, userData, comp);
    group.add(plate);

    // Twin spring C-clamp jaws snapping around the Ø36mm front leg shaft
    [-14, 14].forEach((ox) => {
      const jaw = new THREE.Mesh(box, darkDamperMat);
      jaw.scale.set(5, h * 0.52, Math.max(14, d - 4));
      jaw.position.set(cx + ox, cy, cz - 1);
      tagSubMesh(jaw, userData, comp);
      group.add(jaw);
    });
    return group;
  }

  if (comp.id.includes("_plinth_seal_")) {
    const w = comp.dimensions.width;
    const h = comp.dimensions.height;
    const d = comp.dimensions.depth;
    // Co-extruded rigid U-grip channel + soft floor-sealing elastomer wiper lip
    const uGrip = new THREE.Mesh(box, screwHeadMat);
    uGrip.scale.set(w, Math.max(1.8, h * 0.65), d);
    uGrip.position.set(cx, cy + h * 0.18, cz);
    tagSubMesh(uGrip, userData, comp);
    group.add(uGrip);

    const floorLip = new THREE.Mesh(box, darkDamperMat);
    floorLip.scale.set(w, Math.max(1.5, h * 0.45), d + 1.2);
    floorLip.position.set(cx, cy - h * 0.25, cz);
    tagSubMesh(floorLip, userData, comp);
    group.add(floorLip);
    return group;
  }

  if (comp.id.includes("_plinth_glide_")) {
    const h = comp.dimensions.height;
    const pad = new THREE.Mesh(cylinderY, darkCavityMat);
    pad.scale.set(28, 5, 28);
    pad.position.set(cx, cy - h / 2 + 2.5, cz);
    tagSubMesh(pad, userData, comp);
    group.add(pad);

    const m10Bolt = new THREE.Mesh(cylinderY, chromeHardwareMat);
    m10Bolt.scale.set(10, Math.max(10, h - 5), 10);
    m10Bolt.position.set(cx, cy + 2.5, cz);
    tagSubMesh(m10Bolt, userData, comp);
    group.add(m10Bolt);
    return group;
  }

  if (comp.id.includes("_plinth_corner_")) {
    const cornerPost = new THREE.Mesh(box, screwHeadMat);
    cornerPost.scale.set(comp.dimensions.width, comp.dimensions.height, comp.dimensions.depth);
    cornerPost.position.set(cx, cy, cz);
    tagSubMesh(cornerPost, userData, comp);
    group.add(cornerPost);
    return group;
  }

  // 1C. FLUSH RECESSED ARCHITECTURAL LED CHANNEL WITH GLOWING OPAL DIFFUSER (_recessed_led_)
  if (comp.id.includes("_recessed_led_")) {
    const w = comp.dimensions.width;
    const h = comp.dimensions.height;
    const d = comp.dimensions.depth;
    const isVerticalSideChannel = h > w * 2;

    // Delicate 1mm satin-silver anodized trim lip on front/back edges (NEVER dark black screwHeadMat!)
    const bezel = new THREE.Mesh(box, chromeHardwareMat);
    if (isVerticalSideChannel) {
      bezel.scale.set(Math.max(0.6, w * 0.52), h, d + 2.0);
      bezel.position.set(cx, cy, cz);
    } else {
      bezel.scale.set(w, Math.max(0.6, h * 0.52), d + 2.0);
      bezel.position.set(cx, cy + h * 0.2, cz);
    }
    tagSubMesh(bezel, userData, comp);
    bezel.castShadow = false;
    bezel.receiveShadow = false;
    group.add(bezel);

    // Pure self-luminous warm opal PMMA diffuser core proud of the trim along the inward axis
    const diffuser = new THREE.Mesh(box, material);
    if (isVerticalSideChannel) {
      diffuser.scale.set(w, Math.max(4, h - 1.5), Math.max(4, d - 1.2));
      diffuser.position.set(cx, cy, cz);
    } else {
      diffuser.scale.set(Math.max(4, w - 1.5), h, Math.max(4, d - 1.2));
      diffuser.position.set(cx, cy - 0.15, cz);
    }
    tagSubMesh(diffuser, userData, comp);
    diffuser.castShadow = false;
    diffuser.receiveShadow = false;
    group.add(diffuser);

    return group;
  }

  // Skip legacy duplicate sub-boxes for trouser_rack / wardrobe_lift because our realistic 3D assembly builds them below
  if (
    comp.id.includes("_sub_rod_") ||
    comp.id.includes("_sub_damper_") ||
    comp.id.includes("_sub_pull_wand")
  ) {
    return group;
  }

  // 1D. REALISTIC 3D WARDROBE HANGING RAIL (Ø25mm Oval/Round Chrome Bar + Side Rosette Flanges + Anti-Slip Strip + Coat Hangers)
  // 1B. REALISTIC 3D CONCEALED TELESCOPIC DRAWER RUNNER (Blum MOVENTO / LEGRABOX / Hettich Quadro)
  // Axis verified: `cylinder` = Z-axis, `cylinderY` = Y-axis, `cylinderY` + rotZ(PI/2) = X-axis.
  if (comp.role === "drawer_slide") {
    const { width: w, height: h, depth: d } = comp.dimensions;
    const isRightSlide = comp.id.includes("right");
    const isHettich = (comp.label || "").toLowerCase().includes("hettich");
    const inwardSign = isRightSlide ? -1 : 1;
    const railLen = Math.max(180, d);

    const zincSteelMat = new THREE.MeshStandardMaterial({
      color: 0xe6ecf4,
      metalness: 0.95,
      roughness: 0.17,
      envMapIntensity: 1.45,
    });
    const innerCarriageMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      metalness: 0.92,
      roughness: 0.21,
      envMapIntensity: 1.35,
    });
    const darkPolymerMat = new THREE.MeshStandardMaterial({
      color: 0x26292e,
      metalness: 0.12,
      roughness: 0.68,
    });
    const latchAccentMat = new THREE.MeshStandardMaterial({
      color: isHettich ? 0x334155 : 0xea580c,
      metalness: 0.08,
      roughness: 0.45,
    });

    // A. Outer Carcass Mounting C-Channel (bolted flush to carcass side wall)
    const wallX = isRightSlide ? w - 2.2 : 2.2;
    const outerWeb = new THREE.Mesh(box, zincSteelMat);
    outerWeb.scale.set(2.8, Math.max(24, h * 0.88), railLen);
    outerWeb.position.set(wallX, cy, cz);
    tagSubMesh(outerWeb, userData, comp);
    group.add(outerWeb);

    [-1, 1].forEach((vy) => {
      const flange = new THREE.Mesh(box, zincSteelMat);
      flange.scale.set(8.5, 2.2, railLen * 0.98);
      flange.position.set(wallX + inwardSign * 3.8, cy + vy * (h * 0.42), cz);
      tagSubMesh(flange, userData, comp);
      group.add(flange);
    });

    // System 32 Euro mounting screws (axis along X -> cylinderY rotated around Z by PI/2)
    const screwOffsetsFromFront = [37, 69, Math.min(railLen - 45, 261), Math.max(110, railLen - 37)];
    screwOffsetsFromFront.forEach((zFromFront) => {
      const sz = d - zFromFront;
      if (sz < 16 || sz > d - 16) return;
      const screw = new THREE.Mesh(cylinderY, screwHeadMat);
      screw.rotation.z = Math.PI / 2;
      screw.scale.set(5.5, 2.6, 5.5);
      screw.position.set(wallX + inwardSign * 1.8, cy + 2, sz);
      tagSubMesh(screw, userData, comp);
      group.add(screw);
    });

    // B. Middle Telescopic Synchronized Carriage + Ball/Roller Cage
    const midX = wallX + inwardSign * 6.4;
    const midCarriage = new THREE.Mesh(box, innerCarriageMat);
    midCarriage.scale.set(4.8, Math.max(14, h * 0.46), railLen * 0.88);
    midCarriage.position.set(midX, cy - 1, cz + railLen * 0.04);
    tagSubMesh(midCarriage, userData, comp);
    group.add(midCarriage);

    const rollerCage = new THREE.Mesh(box, darkPolymerMat);
    rollerCage.scale.set(2.6, 8.5, railLen * 0.56);
    rollerCage.position.set(midX - inwardSign * 1.4, cy - 1, cz);
    tagSubMesh(rollerCage, userData, comp);
    group.add(rollerCage);

    // C. Inner Undermount Drawer Support L-Rail
    const innerX = wallX + inwardSign * 11.2;
    const supportShelf = new THREE.Mesh(box, zincSteelMat);
    supportShelf.scale.set(8.8, 3.2, railLen * 0.94);
    supportShelf.position.set(innerX, cy + h * 0.16, cz + railLen * 0.02);
    tagSubMesh(supportShelf, userData, comp);
    group.add(supportShelf);

    // D. Hydraulic Soft-Close Damper Cylinder (axis along Z -> `cylinder` with NO rotation!)
    const damperLen = Math.min(115, railLen * 0.3);
    const damperZ = Math.max(60, railLen * 0.26);
    const damperBody = new THREE.Mesh(cylinder, darkPolymerMat);
    damperBody.scale.set(7.5, 7.5, damperLen);
    damperBody.position.set(midX + inwardSign * 1.2, cy - h * 0.24, damperZ);
    tagSubMesh(damperBody, userData, comp);
    group.add(damperBody);

    const damperRod = new THREE.Mesh(cylinder, chromeHardwareMat);
    damperRod.scale.set(3.2, 3.2, damperLen * 0.65);
    damperRod.position.set(midX + inwardSign * 1.2, cy - h * 0.24, damperZ + damperLen * 0.68);
    tagSubMesh(damperRod, userData, comp);
    group.add(damperRod);

    // E. Front 4D Locking Device Latch (Blum Orange / Hettich Slate)
    const frontLatch = new THREE.Mesh(box, latchAccentMat);
    frontLatch.scale.set(14, 9.5, 32);
    frontLatch.position.set(innerX + inwardSign * 3.5, cy + h * 0.22, d - 22);
    tagSubMesh(frontLatch, userData, comp);
    group.add(frontLatch);

    const latchTrigger = new THREE.Mesh(box, darkPolymerMat);
    latchTrigger.scale.set(9, 4.5, 16);
    latchTrigger.position.set(innerX + inwardSign * 5.2, cy + h * 0.05, d - 16);
    tagSubMesh(latchTrigger, userData, comp);
    group.add(latchTrigger);

    // F. Rear Positioning Hook Pin (axis along Z -> `cylinder` with NO rotation!)
    const rearHook = new THREE.Mesh(cylinder, chromeHardwareMat);
    rearHook.scale.set(4.5, 4.5, 14);
    rearHook.position.set(innerX, cy + h * 0.34, 10);
    tagSubMesh(rearHook, userData, comp);
    group.add(rearHook);

    return group;
  }

  // 1C. REALISTIC METAL DRAWER SIDE PROFILE (Blum LEGRABOX / TANDEMBOX / Hettich AvanTech)
  if (
    (comp.role === "drawer_side_left" || comp.role === "drawer_side_right") &&
    comp.materialId === "mat_anodized_metal"
  ) {
    const { width: w, height: h, depth: d } = comp.dimensions;
    const isRight = comp.role === "drawer_side_right";
    const inward = isRight ? -1 : 1;

    const brushedAluMat = new THREE.MeshStandardMaterial({
      color: 0xdbe3ec,
      metalness: 0.93,
      roughness: 0.2,
      envMapIntensity: 1.4,
    });
    const chromeRodMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      metalness: 0.97,
      roughness: 0.12,
      envMapIntensity: 1.5,
    });
    const capMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.35,
      roughness: 0.45,
    });

    const baseWallH = Math.min(h, Math.max(58, h * 0.62));
    const sideWall = new THREE.Mesh(box, brushedAluMat);
    sideWall.scale.set(Math.max(10, w), baseWallH, d);
    sideWall.position.set(cx, baseWallH / 2, cz);
    tagSubMesh(sideWall, userData, comp);
    group.add(sideWall);

    const topTrim = new THREE.Mesh(box, chromeRodMat);
    topTrim.scale.set(Math.max(10.5, w + 0.5), 3, d);
    topTrim.position.set(cx, baseWallH + 1.5, cz);
    tagSubMesh(topTrim, userData, comp);
    group.add(topTrim);

    const brandCap = new THREE.Mesh(box, capMat);
    brandCap.scale.set(1.8, 12, 34);
    brandCap.position.set(cx + inward * (w / 2 + 0.6), baseWallH * 0.62, d - 68);
    tagSubMesh(brandCap, userData, comp);
    group.add(brandCap);

    // High pot-and-pan gallery railing rod (axis along Z -> `cylinder` with NO rotation!)
    if (h > baseWallH + 18) {
      const railY = h - 8;
      const galleryRod = new THREE.Mesh(cylinder, chromeRodMat);
      galleryRod.scale.set(8, 8, Math.max(40, d - 16));
      galleryRod.position.set(cx, railY, cz);
      tagSubMesh(galleryRod, userData, comp);
      group.add(galleryRod);

      [14, d - 14].forEach((pz) => {
        const post = new THREE.Mesh(box, brushedAluMat);
        post.scale.set(Math.max(9, w * 0.8), railY - baseWallH, 10);
        post.position.set(cx, baseWallH + (railY - baseWallH) / 2, pz);
        tagSubMesh(post, userData, comp);
        group.add(post);
      });
    }
    return group;
  }

  // 1D. REALISTIC 3D SPECIAL FITTINGS & ARCHITECTURAL HARDWARE (100% Axis-Verified)
  if (comp.role === "special_fitting") {
    const { width: w, height: h, depth: d } = comp.dimensions;
    const idLower = (comp.id || "").toLowerCase();
    const lblLower = (comp.label || "").toLowerCase();

    const chromeMetalMat = new THREE.MeshStandardMaterial({
      color: 0xeef2f6,
      metalness: 0.96,
      roughness: 0.14,
      envMapIntensity: 1.5,
    });
    const brushedSteelMat = new THREE.MeshStandardMaterial({
      color: 0xd5dce6,
      metalness: 0.92,
      roughness: 0.22,
      envMapIntensity: 1.35,
    });
    const darkAnodizedMat = new THREE.MeshStandardMaterial({
      color: 0x22252a,
      metalness: 0.25,
      roughness: 0.55,
    });
    const traySurfaceMat = new THREE.MeshStandardMaterial({
      color: 0xf4f1ea,
      metalness: 0.05,
      roughness: 0.52,
    });

    // 1. Adjustable Axilo Plinth Foot (Vertical Y-axis -> `cylinderY`!)
    if (idLower.includes("_axilo_leg_")) {
      const topPlate = new THREE.Mesh(box, darkAnodizedMat);
      topPlate.scale.set(34, 8, 34);
      topPlate.position.set(cx, h - 4, cz);
      tagSubMesh(topPlate, userData, comp);
      group.add(topPlate);

      const stem = new THREE.Mesh(cylinderY, darkAnodizedMat);
      stem.scale.set(22, Math.max(16, h - 18), 22);
      stem.position.set(cx, h / 2, cz);
      tagSubMesh(stem, userData, comp);
      group.add(stem);

      const chromeCollar = new THREE.Mesh(cylinderY, chromeMetalMat);
      chromeCollar.scale.set(26, 8, 26);
      chromeCollar.position.set(cx, 18, cz);
      tagSubMesh(chromeCollar, userData, comp);
      group.add(chromeCollar);

      const footPad = new THREE.Mesh(cylinderY, darkAnodizedMat);
      footPad.scale.set(36, 10, 36);
      footPad.position.set(cx, 5, cz);
      tagSubMesh(footPad, userData, comp);
      group.add(footPad);
      return group;
    }

    // 2. EN 14749 Anti-Tip Steel Wall L-Bracket (wallScrew along Z -> `cylinder` NO rotation!)
    if (idLower.includes("_anti_tip_")) {
      const vertLeg = new THREE.Mesh(box, brushedSteelMat);
      vertLeg.scale.set(w, h, 3.5);
      vertLeg.position.set(cx, cy, 2);
      tagSubMesh(vertLeg, userData, comp);
      group.add(vertLeg);

      const horizLeg = new THREE.Mesh(box, brushedSteelMat);
      horizLeg.scale.set(w, 3.5, d);
      horizLeg.position.set(cx, h - 2, cz);
      tagSubMesh(horizLeg, userData, comp);
      group.add(horizLeg);

      const wallScrew = new THREE.Mesh(cylinder, screwHeadMat);
      wallScrew.scale.set(7, 7, 4);
      wallScrew.position.set(cx, cy - 6, 4.5);
      tagSubMesh(wallScrew, userData, comp);
      group.add(wallScrew);
      return group;
    }

    // 3. Blum TIP-ON Push-to-Open Piston (axis along Z -> `cylinder` NO rotation!)
    if (idLower.includes("_tip_on_")) {
      const adapterPlate = new THREE.Mesh(box, brushedSteelMat);
      adapterPlate.scale.set(14, 16, d * 0.78);
      adapterPlate.position.set(cx, cy, cz - 4);
      tagSubMesh(adapterPlate, userData, comp);
      group.add(adapterPlate);

      const plunger = new THREE.Mesh(cylinder, chromeMetalMat);
      plunger.scale.set(9.5, 9.5, d * 0.35);
      plunger.position.set(cx, cy, d - 12);
      tagSubMesh(plunger, userData, comp);
      group.add(plunger);

      const magnetTip = new THREE.Mesh(cylinder, darkAnodizedMat);
      magnetTip.scale.set(11, 11, 3.5);
      magnetTip.position.set(cx, cy, d - 1);
      tagSubMesh(magnetTip, userData, comp);
      group.add(magnetTip);
      return group;
    }

    // 4. System 32 Ø5mm Chrome Steel Shelf Support Pin (axis along X -> `cylinderY` + rotZ(PI/2))
    if (idLower.includes("_shelf_pin_")) {
      const pinBarrel = new THREE.Mesh(cylinderY, chromeMetalMat);
      pinBarrel.rotation.z = Math.PI / 2;
      pinBarrel.scale.set(5, 10, 5);
      pinBarrel.position.set(cx, cy, cz);
      tagSubMesh(pinBarrel, userData, comp);
      group.add(pinBarrel);

      const pinSpade = new THREE.Mesh(box, chromeMetalMat);
      pinSpade.scale.set(7, 2.2, 10);
      pinSpade.position.set(cx, cy + 2.2, cz);
      tagSubMesh(pinSpade, userData, comp);
      group.add(pinSpade);
      return group;
    }

    // 5. Kesseböhmer LeMans II Corner Kidney Trays (Zero floating parts: pole + swing arms + trays + connected railing posts)
    if (idLower.includes("lemans") || lblLower.includes("lemans") || lblLower.includes("köşe")) {
      const poleX = w * 0.2;
      const poleZ = d * 0.25;
      const pole = new THREE.Mesh(cylinderY, chromeMetalMat);
      pole.scale.set(24, Math.max(360, h), 24);
      pole.position.set(poleX, cy, poleZ);
      tagSubMesh(pole, userData, comp);
      group.add(pole);

      // Top & bottom pole mounting flanges
      [8, h - 8].forEach((fy) => {
        const flange = new THREE.Mesh(cylinderY, darkAnodizedMat);
        flange.scale.set(44, 12, 44);
        flange.position.set(poleX, fy, poleZ);
        tagSubMesh(flange, userData, comp);
        group.add(flange);
      });

      [h * 0.28, h * 0.72].forEach((ty) => {
        // Swing arm bracket connecting pole to tray underside
        const arm = new THREE.Mesh(box, brushedSteelMat);
        arm.scale.set(w * 0.45, 10, 26);
        arm.position.set(poleX + w * 0.2, ty - 10, poleZ + d * 0.16);
        tagSubMesh(arm, userData, comp);
        group.add(arm);

        const trayLobe1 = new THREE.Mesh(cylinderY, traySurfaceMat);
        trayLobe1.scale.set(w * 0.52, 16, d * 0.54);
        trayLobe1.position.set(w * 0.34, ty, d * 0.44);
        tagSubMesh(trayLobe1, userData, comp);
        group.add(trayLobe1);

        const trayLobe2 = new THREE.Mesh(cylinderY, traySurfaceMat);
        trayLobe2.scale.set(w * 0.46, 16, d * 0.48);
        trayLobe2.position.set(w * 0.66, ty, d * 0.56);
        tagSubMesh(trayLobe2, userData, comp);
        group.add(trayLobe2);

        // Connected vertical chrome posts + perimeter top rim bars
        const postCoords: [number, number][] = [
          [w * 0.14, d * 0.44],
          [w * 0.34, d * 0.22],
          [w * 0.56, d * 0.36],
          [w * 0.84, d * 0.56],
          [w * 0.66, d * 0.76],
          [w * 0.34, d * 0.68],
        ];
        postCoords.forEach(([px, pz]) => {
          const post = new THREE.Mesh(cylinderY, chromeMetalMat);
          post.scale.set(6, 36, 6);
          post.position.set(px, ty + 22, pz);
          tagSubMesh(post, userData, comp);
          group.add(post);
        });
        const rimBand1 = new THREE.Mesh(box, chromeMetalMat);
        rimBand1.scale.set(w * 0.48, 5, 5);
        rimBand1.position.set(w * 0.42, ty + 38, d * 0.24);
        tagSubMesh(rimBand1, userData, comp);
        group.add(rimBand1);

        const rimBand2 = new THREE.Mesh(box, chromeMetalMat);
        rimBand2.scale.set(w * 0.52, 5, 5);
        rimBand2.position.set(w * 0.52, ty + 38, d * 0.72);
        tagSubMesh(rimBand2, userData, comp);
        group.add(rimBand2);

        // Showroom Kitchenware Props: Stainless Steel Stockpot + Ceramic Bowl sitting flush on tray
        const potBody = new THREE.Mesh(cylinderY, chromeMetalMat);
        potBody.scale.set(Math.min(185, w * 0.24), 105, Math.min(185, w * 0.24));
        potBody.position.set(w * 0.36, ty + 8 + 52.5, d * 0.44);
        tagSubMesh(potBody, userData, comp);
        group.add(potBody);

        const potLid = new THREE.Mesh(cylinderY, brushedSteelMat);
        potLid.scale.set(Math.min(190, w * 0.245), 8, Math.min(190, w * 0.245));
        potLid.position.set(w * 0.36, ty + 8 + 108, d * 0.44);
        tagSubMesh(potLid, userData, comp);
        group.add(potLid);

        const potKnob = new THREE.Mesh(cylinderY, darkAnodizedMat);
        potKnob.scale.set(28, 14, 28);
        potKnob.position.set(w * 0.36, ty + 8 + 118, d * 0.44);
        tagSubMesh(potKnob, userData, comp);
        group.add(potKnob);

        const ceramicMat = new THREE.MeshStandardMaterial({ color: 0xe6dfd5, roughness: 0.35, metalness: 0.04 });
        const bowl = new THREE.Mesh(cylinderY, ceramicMat);
        bowl.scale.set(Math.min(140, w * 0.18), 64, Math.min(140, w * 0.18));
        bowl.position.set(w * 0.66, ty + 8 + 32, d * 0.56);
        tagSubMesh(bowl, userData, comp);
        group.add(bowl);
      });
      return group;
    }

    // 6. Kesseböhmer DISPENSA / Boy Kiler (Twin vertical chrome frame + top/bottom runner tracks + connected 4-sided gallery baskets)
    if (idLower.includes("pantry") || idLower.includes("dispensa") || lblLower.includes("kiler")) {
      // Top & bottom telescopic runner tracks
      [8, h - 8].forEach((ry) => {
        const track = new THREE.Mesh(box, brushedSteelMat);
        track.scale.set(36, 14, d * 0.92);
        track.position.set(cx, ry, cz);
        tagSubMesh(track, userData, comp);
        group.add(track);
      });

      // Front & rear vertical steel support columns joining top & bottom tracks
      [d * 0.16, d * 0.84].forEach((czCol) => {
        const col = new THREE.Mesh(box, brushedSteelMat);
        col.scale.set(22, h - 16, 22);
        col.position.set(cx, cy, czCol);
        tagSubMesh(col, userData, comp);
        group.add(col);
      });

      const tiers = Math.max(3, Math.min(6, Math.round(h / 320)));
      const bw = w * 0.88;
      const bd = d * 0.84;
      for (let ti = 0; ti < tiers; ti++) {
        const ty = (h / (tiers + 0.5)) * (ti + 0.5);
        const shelfBase = new THREE.Mesh(box, traySurfaceMat);
        shelfBase.scale.set(bw, 14, bd);
        shelfBase.position.set(cx, ty, cz);
        tagSubMesh(shelfBase, userData, comp);
        group.add(shelfBase);

        // 4 corner chrome posts connecting shelfBase to 4-sided gallery rails
        [-1, 1].forEach((sx) => {
          [-1, 1].forEach((sz) => {
            const post = new THREE.Mesh(cylinderY, chromeMetalMat);
            post.scale.set(6, 40, 6);
            post.position.set(cx + sx * (bw / 2 - 4), ty + 24, cz + sz * (bd / 2 - 4));
            tagSubMesh(post, userData, comp);
            group.add(post);
          });
          const sideRail = new THREE.Mesh(cylinder, chromeMetalMat);
          sideRail.scale.set(6, 6, bd - 6);
          sideRail.position.set(cx + sx * (bw / 2 - 4), ty + 42, cz);
          tagSubMesh(sideRail, userData, comp);
          group.add(sideRail);
        });
        [-1, 1].forEach((sz) => {
          const crossRail = new THREE.Mesh(cylinderY, chromeMetalMat);
          crossRail.rotation.z = Math.PI / 2;
          crossRail.scale.set(6, bw - 6, 6);
          crossRail.position.set(cx, ty + 42, cz + sz * (bd / 2 - 4));
          tagSubMesh(crossRail, userData, comp);
          group.add(crossRail);
        });

        // Showroom Pantry Props: Glass Jars with Oak Lids & Olive Oil Bottles
        const jarGlassMat = new THREE.MeshPhysicalMaterial({ color: 0xdbeafe, transparent: true, opacity: 0.48, roughness: 0.1, metalness: 0.05 });
        const oakLidMat = new THREE.MeshStandardMaterial({ color: 0xb68d5c, roughness: 0.65, metalness: 0.0 });
        const oliveBottleMat = new THREE.MeshStandardMaterial({ color: 0x3b4d2b, roughness: 0.18, metalness: 0.08 });
        const contentColors = [0xd4a373, 0x8c5a3c, 0xe9d8a6, 0x6b705c];
        const jarCount = Math.max(2, Math.min(4, Math.floor(bd / 110)));
        for (let ji = 0; ji < jarCount; ji++) {
          const jz = cz - bd * 0.34 + (ji / Math.max(1, jarCount - 1)) * (bd * 0.68);
          const isBottle = (ti + ji) % 3 === 0;
          if (isBottle) {
            const bottle = new THREE.Mesh(cylinderY, oliveBottleMat);
            bottle.scale.set(52, 175, 52);
            bottle.position.set(cx - bw * 0.14, ty + 7 + 87.5, jz);
            tagSubMesh(bottle, userData, comp);
            group.add(bottle);
            const neck = new THREE.Mesh(cylinderY, oliveBottleMat);
            neck.scale.set(22, 48, 22);
            neck.position.set(cx - bw * 0.14, ty + 7 + 195, jz);
            tagSubMesh(neck, userData, comp);
            group.add(neck);
          } else {
            const fillMat = new THREE.MeshStandardMaterial({ color: contentColors[(ti + ji) % contentColors.length], roughness: 0.78 });
            const jarFill = new THREE.Mesh(cylinderY, fillMat);
            jarFill.scale.set(66, 92, 66);
            jarFill.position.set(cx + bw * 0.12, ty + 7 + 48, jz);
            tagSubMesh(jarFill, userData, comp);
            group.add(jarFill);

            const jarOuter = new THREE.Mesh(cylinderY, jarGlassMat);
            jarOuter.scale.set(74, 128, 74);
            jarOuter.position.set(cx + bw * 0.12, ty + 7 + 64, jz);
            tagSubMesh(jarOuter, userData, comp);
            group.add(jarOuter);

            const lid = new THREE.Mesh(cylinderY, oakLidMat);
            lid.scale.set(76, 16, 76);
            lid.position.set(cx + bw * 0.12, ty + 7 + 132, jz);
            tagSubMesh(lid, userData, comp);
            group.add(lid);
          }
        }
      }
      return group;
    }

    // 7. Pantograph Wardrobe Lift (Connected side housings + pivot joints + twin lift arms + elbow joints + top bar + central wand & T-handle)
    if (idLower.includes("wardrobe_lift") || idLower.includes("pantograph") || lblLower.includes("asansör") || lblLower.includes("pantograf")) {
      const pivotY = Math.max(45, h * 0.22);
      const topBarY = Math.max(pivotY + 120, h - 18);
      const armLen = topBarY - pivotY;

      [-1, 1].forEach((sx) => {
        const wallX = sx < 0 ? 11 : w - 11;
        const armX = wallX - sx * 12;

        const housing = new THREE.Mesh(box, darkAnodizedMat);
        housing.scale.set(20, 96, 52);
        housing.position.set(wallX, pivotY, cz);
        tagSubMesh(housing, userData, comp);
        group.add(housing);

        // Pivot joint cylinder connecting housing to arm
        const pivotAxle = new THREE.Mesh(cylinderY, chromeMetalMat);
        pivotAxle.rotation.z = Math.PI / 2;
        pivotAxle.scale.set(16, 18, 16);
        pivotAxle.position.set(wallX - sx * 6, pivotY, cz);
        tagSubMesh(pivotAxle, userData, comp);
        group.add(pivotAxle);

        const arm = new THREE.Mesh(cylinderY, chromeMetalMat);
        arm.scale.set(14, armLen, 14);
        arm.position.set(armX, pivotY + armLen / 2, cz);
        tagSubMesh(arm, userData, comp);
        group.add(arm);

        // Top elbow bracket joining arm cleanly to horizontal hanging bar
        const elbow = new THREE.Mesh(box, darkAnodizedMat);
        elbow.scale.set(22, 22, 22);
        elbow.position.set(armX, topBarY, cz);
        tagSubMesh(elbow, userData, comp);
        group.add(elbow);
      });

      const topBar = new THREE.Mesh(cylinderY, chromeMetalMat);
      topBar.rotation.z = Math.PI / 2;
      topBar.scale.set(22, Math.max(120, w - 42), 22);
      topBar.position.set(cx, topBarY, cz);
      tagSubMesh(topBar, userData, comp);
      group.add(topBar);

      // Central T-collar + pull-down wand + T-handle grip
      const collar = new THREE.Mesh(box, darkAnodizedMat);
      collar.scale.set(24, 26, 26);
      collar.position.set(cx, topBarY, cz);
      tagSubMesh(collar, userData, comp);
      group.add(collar);

      const wandLen = Math.min(340, armLen * 0.92);
      const pullWand = new THREE.Mesh(cylinderY, chromeMetalMat);
      pullWand.scale.set(9, wandLen, 9);
      pullWand.position.set(cx, topBarY - wandLen / 2, cz);
      tagSubMesh(pullWand, userData, comp);
      group.add(pullWand);

      const wandGrip = new THREE.Mesh(cylinderY, darkAnodizedMat);
      wandGrip.rotation.z = Math.PI / 2;
      wandGrip.scale.set(14, 72, 14);
      wandGrip.position.set(cx, topBarY - wandLen, cz);
      tagSubMesh(wandGrip, userData, comp);
      group.add(wandGrip);

      // Showroom Hanging Garments on Pantograph Bar (left & right of central pull wand)
      const jacketPalette = [0x263244, 0x4b4640, 0xc7bdb1, 0x353941];
      const hangerWoodMat = new THREE.MeshStandardMaterial({ color: 0x9c7651, roughness: 0.6 });
      const garmentSpan = Math.max(120, w - 110);
      const slotXs = [cx - garmentSpan * 0.34, cx - garmentSpan * 0.16, cx + garmentSpan * 0.16, cx + garmentSpan * 0.34];
      slotXs.forEach((gx, gi) => {
        const fabricMat = new THREE.MeshStandardMaterial({
          color: jacketPalette[gi % jacketPalette.length],
          roughness: 0.88,
          metalness: 0.02,
        });
        const hook = new THREE.Mesh(cylinderY, chromeMetalMat);
        hook.scale.set(5, 34, 5);
        hook.position.set(gx, topBarY - 18, cz);
        tagSubMesh(hook, userData, comp);
        group.add(hook);

        const hanger = new THREE.Mesh(box, hangerWoodMat);
        hanger.scale.set(12, 14, Math.min(360, d * 0.72));
        hanger.position.set(gx, topBarY - 38, cz);
        tagSubMesh(hanger, userData, comp);
        group.add(hanger);

        const garmentH = Math.min(460, Math.max(220, armLen * 0.85));
        const garment = new THREE.Mesh(box, fabricMat);
        garment.scale.set(34, garmentH, Math.min(370, d * 0.74));
        garment.position.set(gx, topBarY - 42 - garmentH / 2, cz);
        tagSubMesh(garment, userData, comp);
        group.add(garment);
      });
      return group;
    }

    // 8. Pull-Out Chrome Trouser Rack (Complete 4-sided anodized frame + side slides + connected trouser bars + front pull handle)
    if (idLower.includes("trouser") || lblLower.includes("pantolon")) {
      const frameY = cy;
      const frameFrontZ = d - 16;
      const frameRearZ = 16;
      const frameDepth = Math.max(120, frameFrontZ - frameRearZ);
      const sideRailXLeft = 10;
      const sideRailXRight = w - 10;
      const innerFrameW = Math.max(80, sideRailXRight - sideRailXLeft);

      // Left & Right side frame beams + outer telescopic slide tracks
      [sideRailXLeft, sideRailXRight].forEach((sxPos, idx) => {
        const isR = idx === 1;
        const outerSlide = new THREE.Mesh(box, brushedSteelMat);
        outerSlide.scale.set(10, 26, frameDepth + 12);
        outerSlide.position.set(isR ? w - 5 : 5, frameY, cz);
        tagSubMesh(outerSlide, userData, comp);
        group.add(outerSlide);

        const sideBeam = new THREE.Mesh(box, darkAnodizedMat);
        sideBeam.scale.set(14, 22, frameDepth);
        sideBeam.position.set(isR ? sxPos - 6 : sxPos + 6, frameY, cz);
        tagSubMesh(sideBeam, userData, comp);
        group.add(sideBeam);
      });

      // Front & Rear structural aluminum crossbars connecting left & right beams (zero floating rods!)
      [frameRearZ, frameFrontZ].forEach((czBar) => {
        const crossBar = new THREE.Mesh(box, darkAnodizedMat);
        crossBar.scale.set(innerFrameW, 20, 14);
        crossBar.position.set(cx, frameY, czBar);
        tagSubMesh(crossBar, userData, comp);
        group.add(crossBar);
      });

      // Sleek brushed chrome front pull bar handle
      const frontHandle = new THREE.Mesh(cylinderY, chromeMetalMat);
      frontHandle.rotation.z = Math.PI / 2;
      frontHandle.scale.set(10, Math.min(220, innerFrameW * 0.45), 10);
      frontHandle.position.set(cx, frameY, frameFrontZ + 14);
      tagSubMesh(frontHandle, userData, comp);
      group.add(frontHandle);

      [-1, 1].forEach((hs) => {
        const standoff = new THREE.Mesh(cylinder, chromeMetalMat);
        standoff.scale.set(7, 7, 14);
        standoff.position.set(cx + hs * Math.min(95, innerFrameW * 0.2), frameY, frameFrontZ + 7);
        tagSubMesh(standoff, userData, comp);
        group.add(standoff);
      });

      // Parallel chrome trouser rods spanning solidly from rear crossbar to front crossbar + anti-slip end collars
      const barCount = Math.max(5, Math.min(11, Math.floor((innerFrameW - 40) / 52)));
      for (let bi = 0; bi < barCount; bi++) {
        const bx = (sideRailXLeft + 26) + (bi / Math.max(1, barCount - 1)) * (innerFrameW - 52);
        const rod = new THREE.Mesh(cylinder, chromeMetalMat);
        rod.scale.set(11, 11, frameDepth);
        rod.position.set(bx, frameY + 2, cz);
        tagSubMesh(rod, userData, comp);
        group.add(rod);

        // Anti-slip dark polymer grip sleeves along each rod
        [-frameDepth * 0.24, frameDepth * 0.24].forEach((dz) => {
          const sleeve = new THREE.Mesh(cylinder, darkAnodizedMat);
          sleeve.scale.set(12.2, 12.2, 22);
          sleeve.position.set(bx, frameY + 2, cz + dz);
          tagSubMesh(sleeve, userData, comp);
          group.add(sleeve);
        });

        // Draped Tailored Trousers on alternating/most rods (realistic folded wool/cotton fabric)
        const trouserColors = [0x1f2b3d, 0xc8beb0, 0x34383f, 0x9b7b59, 0x4c5866, 0x5c5349];
        const shouldHangTrouser = bi < Math.max(4, barCount - 2);
        if (shouldHangTrouser) {
          const fabricMat = new THREE.MeshStandardMaterial({
            color: trouserColors[bi % trouserColors.length],
            roughness: 0.9,
            metalness: 0.02,
          });
          const clothDepth = Math.min(310, frameDepth * 0.76);
          const hangDrop = Math.min(380, Math.max(240, frameY * 0.8 + 180));

          // Rounded cloth fold wrapping cleanly over the chrome rod
          const topFold = new THREE.Mesh(cylinder, fabricMat);
          topFold.scale.set(19, 19, clothDepth);
          topFold.position.set(bx, frameY + 4, cz);
          tagSubMesh(topFold, userData, comp);
          group.add(topFold);

          // Twin hanging trouser legs draped smoothly below the rod
          [-5.5, 5.5].forEach((legOffset) => {
            const leg = new THREE.Mesh(box, fabricMat);
            leg.scale.set(8.5, hangDrop, clothDepth - 6);
            leg.position.set(bx + legOffset, frameY + 2 - hangDrop / 2, cz);
            tagSubMesh(leg, userData, comp);
            group.add(leg);
          });
        }
      }
      return group;
    }

    // 9. Jewelry / Cutlery Multi-Compartment Organizer Tray (Complete 4-sided frame + cross & longitudinal dividers)
    if (idLower.includes("jewelry") || idLower.includes("cutlery") || lblLower.includes("takı") || lblLower.includes("düzenleyici")) {
      const tw = w * 0.94;
      const td = d * 0.92;
      const wallH = Math.min(54, Math.max(32, h * 0.75));
      const trayBase = new THREE.Mesh(box, traySurfaceMat);
      trayBase.scale.set(tw, 8, td);
      trayBase.position.set(cx, 5, cz);
      tagSubMesh(trayBase, userData, comp);
      group.add(trayBase);

      // Front & rear perimeter walls
      [-1, 1].forEach((sz) => {
        const fbWall = new THREE.Mesh(box, darkAnodizedMat);
        fbWall.scale.set(tw, wallH, 8);
        fbWall.position.set(cx, 5 + wallH / 2, cz + sz * (td / 2 - 4));
        tagSubMesh(fbWall, userData, comp);
        group.add(fbWall);
      });

      // Left, right & inner longitudinal dividers
      for (let ci = 0; ci <= 3; ci++) {
        const dx = cx - tw / 2 + 4 + (ci / 3) * (tw - 8);
        const div = new THREE.Mesh(box, darkAnodizedMat);
        div.scale.set(7, wallH, td);
        div.position.set(dx, 5 + wallH / 2, cz);
        tagSubMesh(div, userData, comp);
        group.add(div);
      }

      // Inner transverse cross-divider
      const midCross = new THREE.Mesh(box, darkAnodizedMat);
      midCross.scale.set(tw - 10, wallH * 0.85, 6);
      midCross.position.set(cx, 5 + (wallH * 0.85) / 2, cz);
      tagSubMesh(midCross, userData, comp);
      group.add(midCross);

      // Showroom Jewelry Props: Watch Cushions with Metallic Watches + Folded Sunglasses + Brass Ring Box
      const cushionMat = new THREE.MeshStandardMaterial({ color: 0xd6cfc4, roughness: 0.92 });
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.92, roughness: 0.22 });
      [-1, 1].forEach((wi) => {
        const wx = cx - tw * 0.32 + wi * 28;
        const wz = cz - td * 0.24;
        const pillow = new THREE.Mesh(box, cushionMat);
        pillow.scale.set(36, 22, 54);
        pillow.position.set(wx, 20, wz);
        tagSubMesh(pillow, userData, comp);
        group.add(pillow);

        const watchDial = new THREE.Mesh(cylinderY, goldMat);
        watchDial.scale.set(30, 8, 30);
        watchDial.position.set(wx, 33, wz);
        tagSubMesh(watchDial, userData, comp);
        group.add(watchDial);
      });

      // Minimal sunglasses in center compartment
      const glassFrame = new THREE.Mesh(box, darkAnodizedMat);
      glassFrame.scale.set(118, 12, 34);
      glassFrame.position.set(cx, 16, cz + td * 0.22);
      tagSubMesh(glassFrame, userData, comp);
      group.add(glassFrame);

      // Small brass jewelry case in right compartment
      const ringBox = new THREE.Mesh(box, goldMat);
      ringBox.scale.set(54, 24, 54);
      ringBox.position.set(cx + tw * 0.32, 21, cz - td * 0.2);
      tagSubMesh(ringBox, userData, comp);
      group.add(ringBox);
      return group;
    }
  }

  // Interior Baked Ambient Occlusion vignette on cabinet back panel (adds realistic interior depth at 0 FPS cost)
  if (comp.role === "carcass_back") {
    const { width: w, height: h, depth: d } = comp.dimensions;
    const baseBack = new THREE.Mesh(box, material);
    baseBack.scale.set(w, h, d);
    baseBack.position.set(cx, cy, cz);
    baseBack.castShadow = true;
    baseBack.receiveShadow = true;
    tagSubMesh(baseBack, userData, comp);
    group.add(baseBack);

    const aoMat = getBakedInteriorAoMaterial();
    if (aoMat) {
      const aoPlane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), aoMat);
      aoPlane.position.set(cx, cy, cz + d / 2 + 0.6);
      aoPlane.raycast = () => {};
      aoPlane.userData = { isSelectionHelper: true, isInteriorAo: true };
      group.add(aoPlane);
    }
    return group;
  }

  if (comp.role === "hanging_rail") {
    const w = comp.dimensions.width;
    // V91: 3D Hanging Rail 100% Matched with 2D Front Elevation (Flange Backplates + Screws + Sockets + Wide-Span Center Support!)
    [-1, 1].forEach((sideSign) => {
      const plateX = cx + sideSign * (w / 2 - 3);
      const plate = new THREE.Mesh(box, chromeHardwareMat);
      plate.scale.set(6, 48, 24);
      plate.position.set(plateX, cy, cz);
      tagSubMesh(plate, userData, comp);
      group.add(plate);

      // Upper & lower countersunk mounting screw heads
      [-17, 17].forEach((sy) => {
        const screw = new THREE.Mesh(cylinderY, darkDamperMat);
        screw.rotation.z = Math.PI / 2;
        screw.scale.set(4.5, 2.5, 4.5);
        screw.position.set(plateX - sideSign * 3.2, cy + sy, cz);
        tagSubMesh(screw, userData, comp);
        group.add(screw);
      });

      // Machined collar socket gripping the oval rod
      const socket = new THREE.Mesh(cylinderY, chromeHardwareMat);
      socket.rotation.z = Math.PI / 2;
      socket.scale.set(32, 14, 21);
      socket.position.set(cx + sideSign * (w / 2 - 12), cy, cz);
      tagSubMesh(socket, userData, comp);
      group.add(socket);
    });

    // Main Oval Chrome Hanging Rod (16×26mm oval profile)
    const rod = new THREE.Mesh(cylinderY, chromeHardwareMat);
    rod.rotation.z = Math.PI / 2;
    rod.scale.set(26, Math.max(40, w - 28), 16);
    rod.position.set(cx, cy, cz);
    tagSubMesh(rod, userData, comp);
    group.add(rod);

    // Top Dark Anti-Slip Rubber Insert Strip
    const rubberStrip = new THREE.Mesh(box, darkDamperMat);
    rubberStrip.scale.set(Math.max(40, w - 34), 2.5, 5.5);
    rubberStrip.position.set(cx, cy + 12.8, cz);
    tagSubMesh(rubberStrip, userData, comp);
    group.add(rubberStrip);

    // Center Vertical Chrome Support Bracket (Orta Askı Ayağı) for wide spans >= 850 mm (matches 2D Elevation!)
    if (w >= 850) {
      const collar = new THREE.Mesh(cylinderY, chromeHardwareMat);
      collar.rotation.z = Math.PI / 2;
      collar.scale.set(33, 18, 22);
      collar.position.set(cx, cy, cz);
      tagSubMesh(collar, userData, comp);
      group.add(collar);

      const stem = new THREE.Mesh(cylinderY, chromeHardwareMat);
      stem.scale.set(9, 44, 9);
      stem.position.set(cx, cy + 35, cz);
      tagSubMesh(stem, userData, comp);
      group.add(stem);

      const topFlange = new THREE.Mesh(cylinderY, chromeHardwareMat);
      topFlange.scale.set(30, 6, 30);
      topFlange.position.set(cx, cy + 58, cz);
      tagSubMesh(topFlange, userData, comp);
      group.add(topFlange);
    }

    return group;
  }

  // 1E. REALISTIC 3D HÄFELE TELESCOPIC TROUSER RACK [807.95.122] (Front-Pull Frame + Non-Slip Flocked Rods + Front Pull Handle)
  if (comp.id.includes("_fitting_trouser_rack")) {
    const w = comp.dimensions.width;
    const h = comp.dimensions.height;
    const d = comp.dimensions.depth;
    const frameY = cy + h * 0.18;

    // Left & Right Häfele Full-Extension Soft-Close Side Runners
    [-w / 2 + 9, w / 2 - 9].forEach((sx) => {
      const sideRail = new THREE.Mesh(box, darkDamperMat);
      sideRail.scale.set(16, 30, Math.max(120, d - 8));
      sideRail.position.set(cx + sx, frameY, cz);
      sideRail.add(new THREE.LineSegments(edges, revealShadowMat));
      tagSubMesh(sideRail, userData, comp);
      group.add(sideRail);
    });

    // Rear Mounting Crossbar (-Z) & Front Ergonomic Brushed-Aluminum Pull Bar (+Z)
    const rearBar = new THREE.Mesh(box, darkDamperMat);
    rearBar.scale.set(Math.max(60, w - 22), 24, 16);
    rearBar.position.set(cx, frameY, cz - d / 2 + 12);
    tagSubMesh(rearBar, userData, comp);
    group.add(rearBar);

    const frontPullBar = new THREE.Mesh(box, chromeHardwareMat);
    frontPullBar.scale.set(Math.max(60, w - 22), 26, 16);
    frontPullBar.position.set(cx, frameY, cz + d / 2 - 10);
    frontPullBar.add(new THREE.LineSegments(edges, revealShadowMat));
    tagSubMesh(frontPullBar, userData, comp);
    group.add(frontPullBar);

    // Front Center Pull Handle Grip (+Z facing user)
    const pullGrip = new THREE.Mesh(cylinderY, chromeHardwareMat);
    pullGrip.rotation.z = Math.PI / 2;
    pullGrip.scale.set(10, Math.min(180, Math.max(80, w * 0.32)), 10);
    pullGrip.position.set(cx, frameY, cz + d / 2 + 8);
    tagSubMesh(pullGrip, userData, comp);
    group.add(pullGrip);

    // Parallel Non-Slip Chrome Trouser Hanger Rods spanning back-to-front with dark silicone grip sleeves & front end-caps
    const rodCount = Math.max(5, Math.min(9, Math.floor((w - 56) / 66)));
    const spanW = Math.max(40, w - 72);
    const stepX = spanW / Math.max(1, rodCount - 1);
    const rodLen = Math.max(80, d - 34);
    for (let r = 0; r < rodCount; r++) {
      const rx = cx - spanW / 2 + r * stepX;
      const rodMesh = new THREE.Mesh(cylinder, chromeHardwareMat);
      rodMesh.scale.set(10, 10, rodLen);
      rodMesh.position.set(rx, frameY + 3, cz);
      tagSubMesh(rodMesh, userData, comp);
      group.add(rodMesh);

      // Matte anthracite anti-slip flocked sleeve covering central 76% of each trouser bar
      const gripSleeve = new THREE.Mesh(cylinder, darkCavityMat);
      gripSleeve.scale.set(12.2, 12.2, rodLen * 0.76);
      gripSleeve.position.set(rx, frameY + 3, cz);
      tagSubMesh(gripSleeve, userData, comp);
      group.add(gripSleeve);
    }
    return group;
  }

  // 1F. REALISTIC 3D HÄFELE INCLINED PULL-OUT SHOE RACK [807.96.310] (Open Tubular Chrome Tiers + Front Heel Guard)
  if (comp.id.includes("_fitting_shoe_rack")) {
    const w = comp.dimensions.width;
    const d = comp.dimensions.depth;

    [-w / 2 + 8, w / 2 - 8].forEach((sx) => {
      const slide = new THREE.Mesh(box, darkDamperMat);
      slide.scale.set(14, 28, d);
      slide.position.set(cx + sx, cy, cz);
      tagSubMesh(slide, userData, comp);
      group.add(slide);
    });

    const inclinedGroup = new THREE.Group();
    inclinedGroup.position.set(cx, cy + 8, cz);
    inclinedGroup.rotation.x = 0.22; // tilts front (+Z) slightly down toward user

    // Side slanted cheek rails
    [-w / 2 + 16, w / 2 - 16].forEach((sx) => {
      const cheek = new THREE.Mesh(box, darkDamperMat);
      cheek.scale.set(8, 22, Math.max(80, d - 24));
      cheek.position.set(sx, 0, 0);
      tagSubMesh(cheek, userData, comp);
      inclinedGroup.add(cheek);
    });

    // 4 Open Tubular Chrome Shoe Support Rails + Raised Front Heel Stop Bar (+Z)
    [-d * 0.34, -d * 0.12, d * 0.12, d * 0.36].forEach((bz, bIdx) => {
      const bar = new THREE.Mesh(cylinderY, chromeHardwareMat);
      bar.rotation.z = Math.PI / 2;
      bar.scale.set(bIdx === 3 ? 13 : 10, Math.max(60, w - 32), bIdx === 3 ? 13 : 10);
      bar.position.set(0, bIdx === 3 ? 14 : 4, bz);
      tagSubMesh(bar, userData, comp);
      inclinedGroup.add(bar);
    });

    group.add(inclinedGroup);
    return group;
  }

  // 1G. REALISTIC 3D HÄFELE PULL-OUT TIE RACK & BELT RACK (Kravatlık & Kemerlik)
  if (comp.id.includes("_fitting_tie_rack") || comp.id.includes("_fitting_belt_rack")) {
    const isBelt = comp.id.includes("_fitting_belt_rack");
    const w = comp.dimensions.width;
    const d = comp.dimensions.depth;

    // Side-Mounted Telescopic Runner Channel + Pull-Out Carrier Bar along Left & Right Side Walls
    [-w / 2 + 14, w / 2 - 14].forEach((sx) => {
      const railBody = new THREE.Mesh(box, darkDamperMat);
      railBody.scale.set(22, 34, Math.max(100, d - 20));
      railBody.position.set(cx + sx, cy, cz);
      railBody.add(new THREE.LineSegments(edges, revealShadowMat));
      tagSubMesh(railBody, userData, comp);
      group.add(railBody);
    });

    // Cross Organizer Frame with Chrome Tie Pegs or Belt Compartments
    const mainBar = new THREE.Mesh(box, chromeHardwareMat);
    mainBar.scale.set(Math.max(60, w - 20), 26, 28);
    mainBar.position.set(cx, cy + 6, cz + d * 0.28);
    mainBar.add(new THREE.LineSegments(edges, revealShadowMat));
    tagSubMesh(mainBar, userData, comp);
    group.add(mainBar);

    const hookCount = isBelt ? 7 : 10;
    const stepX = (w - 64) / Math.max(1, hookCount - 1);
    for (let k = 0; k < hookCount; k++) {
      const kx = cx - (w - 64) / 2 + k * stepX;
      const peg = new THREE.Mesh(isBelt ? box : cylinder, isBelt ? handleAccentMat : chromeHardwareMat);
      peg.scale.set(isBelt ? 8 : 7, isBelt ? 24 : 7, isBelt ? Math.max(80, d * 0.65) : Math.max(70, d * 0.55));
      peg.position.set(kx, cy + 4, cz);
      tagSubMesh(peg, userData, comp);
      group.add(peg);
    }
    return group;
  }

  // 1H. REALISTIC 3D HÄFELE VELVET JEWELRY & WATCH ORGANIZER TRAY [807.88.150] (Open-Top Divided Tray)
  if (comp.id.includes("_fitting_jewelry_tray")) {
    const w = comp.dimensions.width;
    const h = Math.min(72, Math.max(54, comp.dimensions.height));
    const d = comp.dimensions.depth;
    const wallT = 12;

    // Recessed Velvet Floor Slab (bottom only — top is completely OPEN so compartments are visible!)
    const floorSlab = new THREE.Mesh(box, darkCavityMat);
    floorSlab.scale.set(w - 4, 10, d - 4);
    floorSlab.position.set(cx, cy - h / 2 + 5, cz);
    tagSubMesh(floorSlab, userData, comp);
    group.add(floorSlab);

    // 4 Open-Top Outer Frame Walls (Left, Right, Back, Front with brushed pull lip)
    [-w / 2 + wallT / 2, w / 2 - wallT / 2].forEach((sx) => {
      const sw = new THREE.Mesh(box, darkDamperMat);
      sw.scale.set(wallT, h, d);
      sw.position.set(cx + sx, cy, cz);
      sw.add(new THREE.LineSegments(edges, revealShadowMat));
      tagSubMesh(sw, userData, comp);
      group.add(sw);
    });
    const backW = new THREE.Mesh(box, darkDamperMat);
    backW.scale.set(Math.max(40, w - wallT * 2), h, wallT);
    backW.position.set(cx, cy, cz - d / 2 + wallT / 2);
    tagSubMesh(backW, userData, comp);
    group.add(backW);

    const frontW = new THREE.Mesh(box, chromeHardwareMat);
    frontW.scale.set(Math.max(40, w - wallT * 2), h, wallT + 2);
    frontW.position.set(cx, cy, cz + d / 2 - wallT / 2);
    frontW.add(new THREE.LineSegments(edges, revealShadowMat));
    tagSubMesh(frontW, userData, comp);
    group.add(frontW);

    // 4x3 Visible Velvet Compartment Dividers inside Open Tray
    const cols = 4;
    const rows = 3;
    const innerW = Math.max(40, w - wallT * 2 - 4);
    const innerD = Math.max(40, d - wallT * 2 - 4);
    for (let c = 1; c < cols; c++) {
      const divX = new THREE.Mesh(box, screwHeadMat);
      divX.scale.set(6, h - 14, innerD);
      divX.position.set(cx - innerW / 2 + (c * innerW) / cols, cy - 2, cz);
      tagSubMesh(divX, userData, comp);
      group.add(divX);
    }
    for (let r = 1; r < rows; r++) {
      const divZ = new THREE.Mesh(box, screwHeadMat);
      divZ.scale.set(innerW, h - 14, 6);
      divZ.position.set(cx, cy - 2, cz - innerD / 2 + (r * innerD) / rows);
      tagSubMesh(divZ, userData, comp);
      group.add(divZ);
    }
    return group;
  }

  // 1H-SLIDE. REALISTIC 3D SLIDING DOOR TRACKS, ROLLER CARRIAGES, DAMPERS & COPLANAR PANTOGRAPHS
  if (
    comp.id.includes("_sliding_track_") ||
    comp.id.includes("_sliding_guide_bottom") ||
    comp.id.includes("_sliding_carriage_") ||
    comp.id.includes("_sliding_coplanar_mech_")
  ) {
    const w = comp.dimensions.width;
    const h = comp.dimensions.height;
    const d = comp.dimensions.depth;

    // A) Extruded Twin-Channel Anodized Aluminum Track Profile (Inset or Top-Hung)
    if (comp.id.includes("_sliding_track_") || comp.id.includes("_sliding_guide_bottom")) {
      const basePlate = new THREE.Mesh(box, screwHeadMat);
      basePlate.scale.set(w, Math.max(4, h * 0.28), d);
      basePlate.position.set(cx, cy + (comp.id.includes("_bottom") ? -h * 0.34 : h * 0.34), cz);
      tagSubMesh(basePlate, userData, comp);
      group.add(basePlate);

      // Front, Center & Rear Extruded Track Ribs forming Dual Running Channels + Dark Dust Brush Strips
      [-d * 0.42, 0, d * 0.42].forEach((rz) => {
        const rib = new THREE.Mesh(box, chromeHardwareMat);
        rib.scale.set(w, h * 0.85, 4.2);
        rib.position.set(cx, cy, cz + rz);
        tagSubMesh(rib, userData, comp);
        group.add(rib);
      });

      [-d * 0.21, d * 0.21].forEach((czOff) => {
        const grooveShadow = new THREE.Mesh(box, darkCavityMat);
        grooveShadow.scale.set(Math.max(20, w - 4), Math.max(3, h * 0.4), Math.max(6, d * 0.3));
        grooveShadow.position.set(cx, cy - h * 0.1, cz + czOff);
        tagSubMesh(grooveShadow, userData, comp);
        group.add(grooveShadow);
      });

      // Left & Right Integrated Silent-System Hydraulic Soft-Close Damper Cartridges inside Track Ends
      if (!comp.id.includes("_guide_bottom") && w >= 500) {
        [-w / 2 + 95, w / 2 - 95].forEach((dx) => {
          const damperBody = new THREE.Mesh(box, darkDamperMat);
          damperBody.scale.set(140, Math.max(8, h * 0.55), 16);
          damperBody.position.set(cx + dx, cy, cz + d * 0.2);
          tagSubMesh(damperBody, userData, comp);
          group.add(damperBody);

          const pistonRod = new THREE.Mesh(cylinderY, chromeHardwareMat);
          pistonRod.rotation.z = Math.PI / 2;
          pistonRod.scale.set(5, 48, 5);
          pistonRod.position.set(cx + dx + (dx < 0 ? 85 : -85), cy, cz + d * 0.2);
          tagSubMesh(pistonRod, userData, comp);
          group.add(pistonRod);
        });
      }
      return group;
    }

    // B) Top-Hung Gooseneck Steel Bracket + Twin Ball-Bearing Roller Carriage (TopLine XL) or Inset Roller
    if (comp.id.includes("_sliding_carriage_")) {
      const isTopHung = comp.id.includes("_top_");
      // Door-back mounting plate
      const doorPlate = new THREE.Mesh(box, chromeHardwareMat);
      doorPlate.scale.set(w * 0.72, h * 0.68, 5);
      doorPlate.position.set(cx, cy - h * 0.18, cz + d * 0.36);
      tagSubMesh(doorPlate, userData, comp);
      group.add(doorPlate);

      if (isTopHung) {
        // Gooseneck curved steel hanger arm reaching over cabinet roof onto the twin track
        const neckVert = new THREE.Mesh(box, screwHeadMat);
        neckVert.scale.set(28, h * 0.95, 7);
        neckVert.position.set(cx, cy + h * 0.15, cz + d * 0.32);
        tagSubMesh(neckVert, userData, comp);
        group.add(neckVert);

        const neckHoriz = new THREE.Mesh(box, screwHeadMat);
        neckHoriz.scale.set(32, 7, Math.max(16, d * 0.88));
        neckHoriz.position.set(cx, cy + h * 0.55, cz);
        tagSubMesh(neckHoriz, userData, comp);
        group.add(neckHoriz);
      }

      // Twin Precision Delrin/Steel Ball-Bearing Rollers
      [-w * 0.26, w * 0.26].forEach((wx) => {
        const wheel = new THREE.Mesh(cylinder, darkDamperMat);
        wheel.scale.set(22, 22, 8);
        wheel.position.set(cx + wx, cy + (isTopHung ? h * 0.38 : 0), cz - d * 0.28);
        tagSubMesh(wheel, userData, comp);
        group.add(wheel);

        const hub = new THREE.Mesh(cylinder, chromeHardwareMat);
        hub.scale.set(9, 9, 10);
        hub.position.set(cx + wx, cy + (isTopHung ? h * 0.38 : 0), cz - d * 0.28);
        tagSubMesh(hub, userData, comp);
        group.add(hub);
      });
      return group;
    }

    // C) Coplanar Pantograph Swing-Out Mechanism (Hettich InLine XL)
    if (comp.id.includes("_sliding_coplanar_mech_")) {
      const housing = new THREE.Mesh(box, darkDamperMat);
      housing.scale.set(w, h * 0.65, Math.min(44, d));
      housing.position.set(cx, cy, cz - d * 0.22);
      tagSubMesh(housing, userData, comp);
      group.add(housing);

      [-w * 0.32, w * 0.32].forEach((ax) => {
        const swingArm = new THREE.Mesh(box, chromeHardwareMat);
        swingArm.scale.set(16, 8, Math.max(28, d * 0.86));
        swingArm.position.set(cx + ax, cy - 2, cz + d * 0.12);
        swingArm.rotation.y = d > 60 ? 0.28 : 0.04;
        tagSubMesh(swingArm, userData, comp);
        group.add(swingArm);
      });
      return group;
    }
  }

  // 1I. REALISTIC 3D HÄFELE WIRE MESH BASKET [807.52.220] (True Open Chrome Wire Lattice + Soft-Close Side Runners)
  if (comp.id.includes("_fitting_wire_basket")) {
    const w = comp.dimensions.width;
    const h = Math.min(180, Math.max(120, comp.dimensions.height));
    const d = comp.dimensions.depth;
    const bw = Math.max(80, w - 34);
    const bd = Math.max(100, d - 16);
    const topY = cy + h * 0.42;
    const midY = cy;
    const botY = cy - h * 0.42;
    const wallH = topY - botY;

    // Left & Right Häfele Soft-Close Telescopic Side Runners
    [-w / 2 + 8, w / 2 - 8].forEach((sx) => {
      const runner = new THREE.Mesh(box, darkDamperMat);
      runner.scale.set(14, 30, Math.max(100, d - 10));
      runner.position.set(cx + sx, topY - 12, cz);
      runner.add(new THREE.LineSegments(edges, revealShadowMat));
      tagSubMesh(runner, userData, comp);
      group.add(runner);
    });

    // Helper: Open Perimeter Rectangular Wire Ring at a given Y height
    const addPerimeterRing = (ry: number, rW: number, rD: number, dia: number) => {
      // Front & Back horizontal chrome wires
      [-rD / 2, rD / 2].forEach((rz) => {
        const wireX = new THREE.Mesh(cylinderY, chromeHardwareMat);
        wireX.rotation.z = Math.PI / 2;
        wireX.scale.set(dia, rW, dia);
        wireX.position.set(cx, ry, cz + rz);
        tagSubMesh(wireX, userData, comp);
        group.add(wireX);
      });
      // Left & Right horizontal chrome wires
      [-rW / 2, rW / 2].forEach((rx) => {
        const wireZ = new THREE.Mesh(cylinder, chromeHardwareMat);
        wireZ.scale.set(dia, dia, rD);
        wireZ.position.set(cx + rx, ry, cz);
        tagSubMesh(wireZ, userData, comp);
        group.add(wireZ);
      });
    };

    // 3 Open Chrome Perimeter Rings (Top Rim Ø7mm, Mid Ring Ø4mm, Bottom Rim Ø6mm)
    addPerimeterRing(topY, bw, bd, 7);
    addPerimeterRing(midY, bw - 8, bd - 8, 4);
    addPerimeterRing(botY, bw - 16, bd - 16, 6);

    // Front & Back Vertical Wire Mesh Bars (true open lattice — NO solid slabs!)
    const frontBars = Math.max(6, Math.min(12, Math.round(bw / 48)));
    for (let i = 0; i <= frontBars; i++) {
      const rx = cx - (bw - 14) / 2 + (i * (bw - 14)) / frontBars;
      [-bd / 2 + 4, bd / 2 - 4].forEach((rz) => {
        const vWire = new THREE.Mesh(cylinderY, chromeHardwareMat);
        vWire.scale.set(3.8, wallH, 3.8);
        vWire.position.set(rx, cy, cz + rz);
        tagSubMesh(vWire, userData, comp);
        group.add(vWire);
      });
      // Bottom front-to-back floor grid wire
      const bWire = new THREE.Mesh(cylinder, chromeHardwareMat);
      bWire.scale.set(3.8, 3.8, bd - 16);
      bWire.position.set(rx, botY, cz);
      tagSubMesh(bWire, userData, comp);
      group.add(bWire);
    }

    // Left & Right Side Vertical Wire Mesh Bars + 3 Bottom Cross-Support Wires
    const sideBars = Math.max(4, Math.min(8, Math.round(bd / 58)));
    for (let j = 1; j < sideBars; j++) {
      const rz = cz - (bd - 14) / 2 + (j * (bd - 14)) / sideBars;
      [-bw / 2 + 4, bw / 2 - 4].forEach((rx) => {
        const sWire = new THREE.Mesh(cylinderY, chromeHardwareMat);
        sWire.scale.set(3.8, wallH, 3.8);
        sWire.position.set(cx + rx, cy, rz);
        tagSubMesh(sWire, userData, comp);
        group.add(sWire);
      });
      // Bottom left-to-right cross wire
      const cWire = new THREE.Mesh(cylinderY, chromeHardwareMat);
      cWire.rotation.z = Math.PI / 2;
      cWire.scale.set(3.8, bw - 16, 3.8);
      cWire.position.set(cx, botY, rz);
      tagSubMesh(cWire, userData, comp);
      group.add(cWire);
    }

    // Front Center Pull Handle Arc on Upper Rim (+Z)
    const pullBar = new THREE.Mesh(cylinderY, chromeHardwareMat);
    pullBar.rotation.z = Math.PI / 2;
    pullBar.scale.set(9, Math.min(140, bw * 0.28), 9);
    pullBar.position.set(cx, topY - 14, cz + bd / 2 + 7);
    tagSubMesh(pullBar, userData, comp);
    group.add(pullBar);

    return group;
  }

  // 1J. REALISTIC 3D SERVETTO PULL-DOWN WARDROBE LIFT (Gardırop Asansörü 10kg)
  if (comp.id.includes("_fitting_wardrobe_lift")) {
    const w = comp.dimensions.width;
    const h = comp.dimensions.height;

    // Left & Right Hydraulic Side Housing Boxes + Pivoting Chrome Lift Arms
    [-w / 2 + 12, w / 2 - 12].forEach((sx) => {
      const boxHousing = new THREE.Mesh(box, darkDamperMat);
      boxHousing.scale.set(24, 130, 88);
      boxHousing.position.set(cx + sx, cy - h * 0.25, cz);
      boxHousing.add(new THREE.LineSegments(edges, revealShadowMat));
      tagSubMesh(boxHousing, userData, comp);
      group.add(boxHousing);

      const arm = new THREE.Mesh(box, chromeHardwareMat);
      arm.scale.set(10, Math.max(180, h * 0.75), 18);
      arm.position.set(cx + sx * 0.94, cy + h * 0.08, cz);
      tagSubMesh(arm, userData, comp);
      group.add(arm);
    });

    // Top Horizontal Chrome Hanging Bar
    const topBar = new THREE.Mesh(cylinderY, chromeHardwareMat);
    topBar.rotation.z = Math.PI / 2;
    topBar.scale.set(24, Math.max(60, w - 36), 24);
    topBar.position.set(cx, cy + h * 0.38, cz);
    tagSubMesh(topBar, userData, comp);
    group.add(topBar);

    // Central Vertical Pull-Down Wand with Ergonomic Grip Handle
    const wand = new THREE.Mesh(cylinderY, chromeHardwareMat);
    wand.scale.set(12, Math.max(240, h * 0.85), 12);
    wand.position.set(cx, cy - h * 0.05, cz + 14);
    tagSubMesh(wand, userData, comp);
    group.add(wand);

    const grip = new THREE.Mesh(cylinderY, darkCavityMat);
    grip.scale.set(22, 110, 22);
    grip.position.set(cx, cy - h * 0.42, cz + 14);
    tagSubMesh(grip, userData, comp);
    group.add(grip);

    return group;
  }

  // 1K. KESSEBÖHMER LEMANS II BLIND-CORNER KIDNEY SWING TRAYS (_fitting_corner_lemans)
  if (comp.id.includes("_fitting_corner_lemans")) {
    const w = comp.dimensions.width;
    const h = comp.dimensions.height;
    const d = comp.dimensions.depth;

    // Vertical Ø34mm Telescopic Chrome Axle Post with Top & Bottom Mounting Flanges
    const poleX = cx - w * 0.04;
    const poleZ = cz + d * 0.14;
    const pole = new THREE.Mesh(cylinderY, chromeHardwareMat);
    pole.scale.set(32, Math.max(240, h), 32);
    pole.position.set(poleX, cy, poleZ);
    tagSubMesh(pole, userData, comp);
    group.add(pole);

    [cy - h / 2 + 5, cy + h / 2 - 5].forEach((fy) => {
      const flange = new THREE.Mesh(cylinderY, screwHeadMat);
      flange.scale.set(62, 8, 62);
      flange.position.set(poleX, fy, poleZ);
      tagSubMesh(flange, userData, comp);
      group.add(flange);
    });

    // Build 2 Asymmetric Kidney / Peanut Arena Trays (Anthracite Non-Slip Base + Chrome Gallery Rim + Swing Arm)
    const trayW = Math.min(w * 0.82, 760);
    const trayD = Math.min(d * 0.78, 430);
    const hwT = trayW / 2;
    const hdT = trayD / 2;
    const kidneyShape = new THREE.Shape();
    kidneyShape.moveTo(-hwT * 0.78, -hdT * 0.86);
    kidneyShape.bezierCurveTo(-hwT * 0.15, -hdT * 1.04, hwT * 0.55, -hdT * 0.98, hwT * 0.88, -hdT * 0.42);
    kidneyShape.bezierCurveTo(hwT * 1.08, 0, hwT * 0.96, hdT * 0.76, hwT * 0.36, hdT * 0.92);
    kidneyShape.bezierCurveTo(0, hdT * 0.98, -hwT * 0.18, hdT * 0.46, -hwT * 0.48, hdT * 0.58);
    kidneyShape.bezierCurveTo(-hwT * 0.88, hdT * 0.74, -hwT * 1.04, hdT * 0.18, -hwT * 0.96, -hdT * 0.36);
    kidneyShape.bezierCurveTo(-hwT * 0.92, -hdT * 0.65, -hwT * 0.88, -hdT * 0.8, -hwT * 0.78, -hdT * 0.86);

    const baseTrayGeo = new THREE.ExtrudeGeometry(kidneyShape, {
      depth: 10,
      bevelEnabled: true,
      bevelThickness: 1.5,
      bevelSize: 1.5,
      bevelSegments: 2,
      curveSegments: 14,
    });
    baseTrayGeo.rotateX(-Math.PI / 2);

    const rimPts3D = kidneyShape.getPoints(36).map((pt) => new THREE.Vector3(pt.x, 0, -pt.y));
    rimPts3D.push(rimPts3D[0].clone());
    const rimCurve = new THREE.CatmullRomCurve3(rimPts3D, true);
    const rimTubeGeo = new THREE.TubeGeometry(rimCurve, 56, 4.2, 8, true);

    [-h * 0.32, h * 0.16].forEach((tyOff) => {
      const ty = cy + tyOff;
      // Articulated S-Arm under tray connecting to vertical pole
      const armHub = new THREE.Mesh(cylinderY, darkDamperMat);
      armHub.scale.set(46, 28, 46);
      armHub.position.set(poleX, ty - 14, poleZ);
      tagSubMesh(armHub, userData, comp);
      group.add(armHub);

      const swingArm = new THREE.Mesh(box, darkDamperMat);
      swingArm.scale.set(Math.max(120, trayW * 0.48), 12, 26);
      swingArm.position.set(cx + w * 0.04, ty - 10, cz + d * 0.04);
      swingArm.rotation.y = 0.24;
      tagSubMesh(swingArm, userData, comp);
      group.add(swingArm);

      const trayFloor = new THREE.Mesh(baseTrayGeo, darkDamperMat);
      trayFloor.position.set(cx + w * 0.04, ty, cz - d * 0.02);
      tagSubMesh(trayFloor, userData, comp);
      group.add(trayFloor);

      // Twin Chrome Arena Gallery Rails (+24mm & +46mm above tray floor)
      [24, 46].forEach((railH) => {
        const railMesh = new THREE.Mesh(rimTubeGeo, chromeHardwareMat);
        railMesh.position.set(cx + w * 0.04, ty + railH, cz - d * 0.02);
        tagSubMesh(railMesh, userData, comp);
        group.add(railMesh);
      });
    });

    return group;
  }

  // 1L. KESSEBÖHMER / HÄFELE MAGIC CORNER DUAL-STAGE WIRE PULL-OUT (_fitting_magic_corner)
  if (comp.id.includes("_fitting_magic_corner")) {
    const w = comp.dimensions.width;
    const h = comp.dimensions.height;
    const d = comp.dimensions.depth;

    // Anthracite Base Track Frame
    const baseRail = new THREE.Mesh(box, darkDamperMat);
    baseRail.scale.set(w * 0.88, 16, 36);
    baseRail.position.set(cx, cy - h * 0.44, cz);
    tagSubMesh(baseRail, userData, comp);
    group.add(baseRail);

    // 4 Chrome Wire Baskets: 2 Rear Blind-Zone Baskets (left) + 2 Front Pull-Out Baskets (right)
    const basketW = Math.max(140, w * 0.39);
    const basketD = Math.max(160, d * 0.72);
    const zones = [
      { bx: cx - w * 0.22, bz: cz - d * 0.06 },
      { bx: cx + w * 0.22, bz: cz + d * 0.08 },
    ];
    zones.forEach((zn) => {
      // Vertical carrier upright
      const post = new THREE.Mesh(box, darkDamperMat);
      post.scale.set(16, h * 0.86, 16);
      post.position.set(zn.bx, cy, zn.bz - basketD * 0.42);
      tagSubMesh(post, userData, comp);
      group.add(post);

      [-h * 0.3, h * 0.18].forEach((byOff) => {
        const by = cy + byOff;
        const floorPlate = new THREE.Mesh(box, darkDamperMat);
        floorPlate.scale.set(basketW, 8, basketD);
        floorPlate.position.set(zn.bx, by, zn.bz);
        tagSubMesh(floorPlate, userData, comp);
        group.add(floorPlate);

        // 4-sided Chrome Gallery Rail around basket
        [
          { sx: basketW, sz: 5, dx: 0, dz: basketD / 2 },
          { sx: basketW, sz: 5, dx: 0, dz: -basketD / 2 },
          { sx: 5, sz: basketD, dx: -basketW / 2, dz: 0 },
          { sx: 5, sz: basketD, dx: basketW / 2, dz: 0 },
        ].forEach((seg) => {
          const rail = new THREE.Mesh(box, chromeHardwareMat);
          rail.scale.set(seg.sx, 6, seg.sz);
          rail.position.set(zn.bx + seg.dx, by + 42, zn.bz + seg.dz);
          tagSubMesh(rail, userData, comp);
          group.add(rail);
        });
      });
    });

    return group;
  }

  // 1M. HÄFELE 270° 3/4 PIE-CUT CORNER CAROUSEL TURNTABLES (_fitting_carousel_half_moon)
  if (comp.id.includes("_fitting_carousel_half_moon")) {
    const dia = Math.min(comp.dimensions.width, comp.dimensions.depth);
    const h = comp.dimensions.height;
    const radius = Math.max(140, dia * 0.46);

    // Central Telescopic Ø30mm Chrome Spindle
    const spindle = new THREE.Mesh(cylinderY, chromeHardwareMat);
    spindle.scale.set(28, Math.max(240, h), 28);
    spindle.position.set(cx, cy, cz);
    tagSubMesh(spindle, userData, comp);
    group.add(spindle);

    // 270° 3/4 Pie-Cut Sector Shape (leaving 90° L-corner notch open when at rest)
    const pieShape = new THREE.Shape();
    pieShape.moveTo(0, 0);
    pieShape.absarc(0, 0, radius, Math.PI * 0.02, Math.PI * 1.48, false);
    pieShape.lineTo(0, 0);

    const discGeo = new THREE.ExtrudeGeometry(pieShape, {
      depth: 10,
      bevelEnabled: true,
      bevelThickness: 1.5,
      bevelSize: 1.5,
      curveSegments: 28,
    });
    discGeo.rotateX(-Math.PI / 2);

    const rimPts = pieShape.getPoints(40).map((p) => new THREE.Vector3(p.x, 0, -p.y));
    rimPts.push(rimPts[0].clone());
    const rimTube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rimPts, true), 52, 4, 8, true);

    [-h * 0.3, h * 0.18].forEach((tyOff) => {
      const ty = cy + tyOff;
      const disc = new THREE.Mesh(discGeo, darkDamperMat);
      disc.position.set(cx, ty, cz);
      tagSubMesh(disc, userData, comp);
      group.add(disc);

      const rim = new THREE.Mesh(rimTube, chromeHardwareMat);
      rim.position.set(cx, ty + 34, cz);
      tagSubMesh(rim, userData, comp);
      group.add(rim);
    });

    return group;
  }

  // 1N. OPEN-FRAME KITCHEN ACCESSORIES (_fitting_pantry_pullout, _fitting_waste_bin, _fitting_spice_pullout)
  if (
    comp.id.includes("_fitting_pantry_pullout") ||
    comp.id.includes("_fitting_waste_bin") ||
    comp.id.includes("_fitting_spice_pullout")
  ) {
    const w = comp.dimensions.width;
    const h = comp.dimensions.height;
    const d = comp.dimensions.depth;
    // Sleek telescopic runner frame + vertical spine (sub-components render individual baskets/bins!)
    const spine = new THREE.Mesh(box, darkDamperMat);
    spine.scale.set(22, Math.max(80, h - 16), 28);
    spine.position.set(cx, cy, cz - d * 0.42);
    tagSubMesh(spine, userData, comp);
    group.add(spine);

    [-w * 0.44, w * 0.44].forEach((rx) => {
      const runner = new THREE.Mesh(box, chromeHardwareMat);
      runner.scale.set(8, 18, Math.max(100, d - 16));
      runner.position.set(cx + rx, cy - h / 2 + 12, cz);
      tagSubMesh(runner, userData, comp);
      group.add(runner);
    });

    if (comp.id.includes("_fitting_spice_pullout")) {
      [-h * 0.32, h * 0.14].forEach((sy) => {
        const tray = new THREE.Mesh(box, chromeHardwareMat);
        tray.scale.set(Math.max(60, w - 18), 10, Math.max(100, d - 20));
        tray.position.set(cx, cy + sy, cz);
        tagSubMesh(tray, userData, comp);
        group.add(tray);
      });
    }
    return group;
  }

  // 2. TRUE ARTICULATED BLUM AVENTOS LIFT-UP SUB-ASSEMBLIES (HK top / HL top / HF Bi-Fold)
  if (comp.id.includes("_aventos_mech_")) {
    const isRightSide = comp.id.includes("_right");
    const w = comp.dimensions.width;
    const h = comp.dimensions.height;
    const d = comp.dimensions.depth;
    const dialSign = isRightSide ? -1 : 1;

    // 2A. Stationary Blum AVENTOS Power Unit Housing (Silk-Matte Anthracite + Brushed Cover + Orange LF Dial)
    if (comp.id.includes("_aventos_mech_housing_")) {
      const housingBox = new THREE.Mesh(box, darkDamperMat);
      housingBox.scale.set(w, h, d);
      housingBox.position.set(cx, cy, cz);
      housingBox.add(new THREE.LineSegments(edges, revealShadowMat));
      tagSubMesh(housingBox, userData, comp);
      group.add(housingBox);

      const accentCap = new THREE.Mesh(box, screwHeadMat);
      accentCap.scale.set(w + 1.5, h * 0.56, d * 0.62);
      accentCap.position.set(cx + dialSign * 0.8, cy + h * 0.06, cz + d * 0.08);
      tagSubMesh(accentCap, userData, comp);
      group.add(accentCap);

      const dialMesh = new THREE.Mesh(cylinder, blumAccentMat);
      dialMesh.scale.set(16, 16, w + 3);
      dialMesh.rotation.y = Math.PI / 2;
      dialMesh.position.set(cx + dialSign * 1.5, cy + h * 0.04, cz + d * 0.34);
      tagSubMesh(dialMesh, userData, comp);
      group.add(dialMesh);

      // Front Chrome Shoulder Clevis Boss at Nose Pivot
      const nosePin = new THREE.Mesh(cylinder, chromeHardwareMat);
      nosePin.scale.set(14, 14, w + 4);
      nosePin.rotation.y = Math.PI / 2;
      nosePin.position.set(cx, cy + h * 0.04, cz + d * 0.5 - 14);
      tagSubMesh(nosePin, userData, comp);
      group.add(nosePin);
      return group;
    }

    // 2B. Primary or Secondary Articulated Lever Arm (`_arm1_` / `_arm2_`): Exact Pin-to-Pin Length `d`!
    if (comp.id.includes("_aventos_mech_arm1_") || comp.id.includes("_aventos_mech_arm2_")) {
      const isPrimary = comp.id.includes("_arm1_");
      const armBar = new THREE.Mesh(box, chromeHardwareMat);
      armBar.scale.set(w, h, d);
      armBar.position.set(cx, cy, cz);
      armBar.add(new THREE.LineSegments(edges, revealShadowMat));
      tagSubMesh(armBar, userData, comp);
      group.add(armBar);

      if (isPrimary) {
        // Integrated dark-grey BLUMOTION hydraulic damper sleeve along primary arm
        const sleeve = new THREE.Mesh(cylinder, darkDamperMat);
        sleeve.scale.set(h * 0.85, h * 0.85, d * 0.52);
        sleeve.position.set(cx, cy - h * 0.15, cz - d * 0.12);
        tagSubMesh(sleeve, userData, comp);
        group.add(sleeve);
      }

      // Precision Clevis Joint Pins at BOTH Ends (`z_local = 0` and `z_local = d`) so joints look seamlessly bolted!
      [cz - d / 2, cz + d / 2].forEach((pinZ) => {
        const pin = new THREE.Mesh(cylinder, screwHeadMat);
        pin.scale.set(h * 1.15, h * 1.15, w + 5);
        pin.rotation.y = Math.PI / 2;
        pin.position.set(cx, cy, pinZ);
        tagSubMesh(pin, userData, comp);
        group.add(pin);
      });
      return group;
    }

    // 2C. Door Rear Clip Mounting Plate (`_aventos_mech_pad_`) or HF Ceiling/Center Knuckle Hinges
    const plate = new THREE.Mesh(box, screwHeadMat);
    plate.scale.set(w, h, d);
    plate.position.set(cx, cy, cz);
    plate.add(new THREE.LineSegments(edges, revealShadowMat));
    tagSubMesh(plate, userData, comp);
    group.add(plate);

    const knucklePin = new THREE.Mesh(cylinder, chromeHardwareMat);
    knucklePin.scale.set(11, 11, w + 4);
    knucklePin.rotation.y = Math.PI / 2;
    knucklePin.position.set(cx, cy, cz - d * 0.25);
    tagSubMesh(knucklePin, userData, comp);
    group.add(knucklePin);
    return group;
  }

  // 3. REAL 3D KITCHEN SINK BASIN + SWAN-NECK MIXER FAUCET (_cutout_sink)
  if (comp.id.includes("_cutout_sink")) {
    const w = comp.dimensions.width;
    const h = comp.dimensions.height;
    const d = comp.dimensions.depth;

    // Stainless Steel Outer Flange Rim
    const rimMesh = new THREE.Mesh(box, chromeHardwareMat);
    rimMesh.scale.set(w + 24, 6, d + 24);
    rimMesh.position.set(cx, cy + h * 0.35, cz);
    rimMesh.add(new THREE.LineSegments(edges, revealShadowMat));
    tagSubMesh(rimMesh, userData, comp);
    group.add(rimMesh);

    // Deep Dark Undermount Sink Bowl Cavity
    const bowlMesh = new THREE.Mesh(box, darkCavityMat);
    bowlMesh.scale.set(w - 16, h, d - 28);
    bowlMesh.position.set(cx, cy + h * 0.22, cz + 6);
    tagSubMesh(bowlMesh, userData, comp);
    group.add(bowlMesh);

    // Chrome Drain Basket Strainer in center of sink bowl
    const drainRing = new THREE.Mesh(cylinderY, chromeHardwareMat);
    drainRing.scale.set(76, 6, 76);
    drainRing.position.set(cx, cy + h * 0.42, cz + 6);
    tagSubMesh(drainRing, userData, comp);
    group.add(drainRing);

    // Tall Chrome Swan-Neck Kitchen Mixer Faucet (Kuğu Borulu Evye Bataryası)
    const faucetZ = cz - d * 0.42;
    const baseStem = new THREE.Mesh(cylinderY, chromeHardwareMat);
    baseStem.scale.set(36, 240, 36);
    baseStem.position.set(cx, cy + 120, faucetZ);
    tagSubMesh(baseStem, userData, comp);
    group.add(baseStem);

    const topSpoutReach = new THREE.Mesh(cylinder, chromeHardwareMat);
    topSpoutReach.scale.set(24, 24, 185);
    topSpoutReach.position.set(cx, cy + 235, faucetZ + 85);
    tagSubMesh(topSpoutReach, userData, comp);
    group.add(topSpoutReach);

    const aeratorNozzle = new THREE.Mesh(cylinderY, chromeHardwareMat);
    aeratorNozzle.scale.set(24, 55, 24);
    aeratorNozzle.position.set(cx, cy + 212, faucetZ + 170);
    tagSubMesh(aeratorNozzle, userData, comp);
    group.add(aeratorNozzle);

    const mixerLever = new THREE.Mesh(box, handleAccentMat);
    mixerLever.scale.set(68, 10, 14);
    mixerLever.position.set(cx + 38, cy + 68, faucetZ);
    tagSubMesh(mixerLever, userData, comp);
    group.add(mixerLever);

    return group;
  }

  // 4. REAL 3D 4-ZONE BLACK GLASS INDUCTION COOKTOP (_cutout_cooktop)
  if (comp.id.includes("_cutout_cooktop")) {
    const w = comp.dimensions.width;
    const h = comp.dimensions.height;
    const d = comp.dimensions.depth;

    // Schott Ceran Black Ceramic Glass Plate
    const glassPlate = new THREE.Mesh(box, darkCavityMat);
    glassPlate.scale.set(w, 10, d);
    glassPlate.position.set(cx, cy + h * 0.25, cz);
    glassPlate.add(new THREE.LineSegments(edges, revealShadowMat));
    tagSubMesh(glassPlate, userData, comp);
    group.add(glassPlate);

    // 4 Induction Burner Zones with glowing ceramic heating rings
    const zones = [
      { dx: -w * 0.24, dz: -d * 0.2, dia: Math.min(180, w * 0.3) },
      { dx: w * 0.24, dz: -d * 0.2, dia: Math.min(145, w * 0.24) },
      { dx: -w * 0.24, dz: d * 0.18, dia: Math.min(145, w * 0.24) },
      { dx: w * 0.24, dz: d * 0.18, dia: Math.min(200, w * 0.33) },
    ];
    zones.forEach((zn) => {
      const outerRing = new THREE.Mesh(cylinderY, burnerRingMat);
      outerRing.scale.set(zn.dia, 4, zn.dia);
      outerRing.position.set(cx + zn.dx, cy + h * 0.35, cz + zn.dz);
      tagSubMesh(outerRing, userData, comp);
      group.add(outerRing);

      const innerCore = new THREE.Mesh(cylinderY, darkCavityMat);
      innerCore.scale.set(zn.dia * 0.84, 5, zn.dia * 0.84);
      innerCore.position.set(cx + zn.dx, cy + h * 0.37, cz + zn.dz);
      tagSubMesh(innerCore, userData, comp);
      group.add(innerCore);
    });

    return group;
  }

  // 5. REAL 3D EDGE-MOUNTED & CUTOUT HANDLE SYSTEMS (Gola Channel, J-Pull Groove Cutout, Recessed Grip Pocket, Edge Profile)
  if (
    (comp.role === "door_handle" || comp.role === "drawer_handle") &&
    (comp.id.includes("_handle_mount_") ||
      comp.id.includes("_handle_rosette_") ||
      comp.id.includes("_handle_stem"))
  ) {
    return group;
  }

  // 5A-BRACKET. REAL 3D GOLA CARCASS FIXING BRACKET / SNAP-ON CLIP (Scilm SU116 / Häfele 712.63.511 — 35×14×35mm)
  if (comp.id.includes("_gola_fixing_bracket_")) {
    const w = comp.dimensions.width;
    const h = comp.dimensions.height;
    const d = comp.dimensions.depth;
    const isRightClip = comp.id.includes("_R");
    const isVertClip = comp.id.includes("_vert_");

    if (isVertClip) {
      // U-Spacer / Snap-on Clip locking vertical Gola 1020 onto front edge of 18mm carcass divider
      const bodyBlock = new THREE.Mesh(box, darkDamperMat);
      bodyBlock.scale.set(w * 0.78, h * 0.72, d);
      bodyBlock.position.set(cx, cy, cz);
      bodyBlock.add(new THREE.LineSegments(edges, revealShadowMat));
      tagSubMesh(bodyBlock, userData, comp);
      group.add(bodyBlock);

      const lockHead = new THREE.Mesh(box, chromeHardwareMat);
      lockHead.scale.set(w * 0.92, h * 0.45, 5);
      lockHead.position.set(cx, cy, cz + d / 2 - 2.5);
      tagSubMesh(lockHead, userData, comp);
      group.add(lockHead);
      return group;
    }

    // Side-panel mounting flange (bolted flush against left/right carcass upright with 2 Euro-screws)
    const wallSign = isRightClip ? 1 : -1;
    const flangeT = 4;
    const sideFlange = new THREE.Mesh(box, darkDamperMat);
    sideFlange.scale.set(flangeT, h, d);
    sideFlange.position.set(cx + wallSign * (w / 2 - flangeT / 2), cy, cz);
    sideFlange.add(new THREE.LineSegments(edges, revealShadowMat));
    tagSubMesh(sideFlange, userData, comp);
    group.add(sideFlange);

    // Two Ø6mm countersunk zinc chipboard/Euro screw heads fastening bracket into carcass side panel
    [-d * 0.24, d * 0.16].forEach((sz, sIdx) => {
      const screw = new THREE.Mesh(cylinder, chromeHardwareMat);
      screw.rotation.y = Math.PI / 2;
      screw.scale.set(6, 6, 2.5);
      screw.position.set(
        cx + wallSign * (w / 2 - flangeT - 0.8),
        cy + (sIdx === 0 ? 6 : -6),
        cz + sz
      );
      tagSubMesh(screw, userData, comp);
      group.add(screw);
    });

    // Front T-slot locking tongue engaging the extruded rear dovetail track of the L/C Gola channel
    const frontTongue = new THREE.Mesh(box, screwHeadMat);
    frontTongue.scale.set(w, Math.min(20, h * 0.56), 11);
    frontTongue.position.set(cx, cy, cz + d / 2 - 5.5);
    frontTongue.add(new THREE.LineSegments(edges, revealShadowMat));
    tagSubMesh(frontTongue, userData, comp);
    group.add(frontTongue);

    // Stiffening horizontal gusset web bridging side flange to front locking tongue
    const gussetWeb = new THREE.Mesh(box, darkDamperMat);
    gussetWeb.scale.set(w - flangeT, 5, d * 0.78);
    gussetWeb.position.set(cx - wallSign * (flangeT / 2), cy, cz + d * 0.08);
    tagSubMesh(gussetWeb, userData, comp);
    group.add(gussetWeb);

    return group;
  }

  // 5A. WORLD-STANDARD GOLA / MELAMINE FINGER BOX / MOULDED BOX / BEVEL BACKING PLATE
  if (comp.role === "gola_profile" || comp.handleCategory === "gola_profile") {
    const w = comp.dimensions.width;
    const h = comp.dimensions.height;
    const d = comp.dimensions.depth;
    const cid = comp.id;

    // Case 1: 60x18mm Flat Backing Plate behind 30°/45° Beveled Door
    if (cid.includes("gola_bevel_backing")) {
      const plate = new THREE.Mesh(box, material);
      plate.scale.set(w, h, d);
      plate.position.set(cx, cy, cz);
      plate.add(new THREE.LineSegments(edges, revealShadowMat));
      tagSubMesh(plate, userData, comp);
      group.add(plate);
      return group;
    }

    // Case 2: 60x38mm Melamine / Veneer 2-Piece Recessed Finger Box ("Gola de Melamina")
    if (cid.includes("gola_melamine_box") || cid.includes("gola_moulded_box")) {
      const boardT = cid.includes("gola_moulded_box") ? 12 : 16;
      const vBack = new THREE.Mesh(box, material);
      vBack.scale.set(w, h, boardT);
      vBack.position.set(cx, cy, cz - d / 2 + boardT / 2);
      vBack.add(new THREE.LineSegments(edges, revealShadowMat));
      tagSubMesh(vBack, userData, comp);
      group.add(vBack);

      const hBot = new THREE.Mesh(box, material);
      hBot.scale.set(w, boardT, d);
      hBot.position.set(cx, cy - h / 2 + boardT / 2, cz);
      hBot.add(new THREE.LineSegments(edges, revealShadowMat));
      tagSubMesh(hBot, userData, comp);
      group.add(hBot);
      return group;
    }

    // Case 3: 73.5x26mm Horizontal C-Gola Profile (Between Drawers + Rear Dovetail Fixing Track)
    if (cid.includes("gola_c_channel")) {
      const backWeb = new THREE.Mesh(box, material);
      backWeb.scale.set(w, h, 2.5);
      backWeb.position.set(cx, cy, cz - d / 2 + 1.25);
      tagSubMesh(backWeb, userData, comp);
      group.add(backWeb);

      // Extruded rear dovetail track rails on back of C-web for SU116 / 712.63.511 carcass brackets
      for (const rSgn of [-1, 1]) {
        const rearTrackRib = new THREE.Mesh(box, material);
        rearTrackRib.scale.set(w, 2.4, 3.5);
        rearTrackRib.position.set(cx, cy + rSgn * 8.5, cz - d / 2 - 1.5);
        tagSubMesh(rearTrackRib, userData, comp);
        group.add(rearTrackRib);
      }

      for (const sgn of [-1, 1]) {
        const flange = new THREE.Mesh(box, material);
        flange.scale.set(w, 2.5, d);
        flange.position.set(cx, cy + sgn * (h / 2 - 1.25), cz);
        tagSubMesh(flange, userData, comp);
        group.add(flange);

        const lip = new THREE.Mesh(box, material);
        lip.scale.set(w, 8, 2.5);
        lip.position.set(cx, cy + sgn * (h / 2 - 4), cz + d / 2 - 1.25);
        tagSubMesh(lip, userData, comp);
        group.add(lip);
      }
      return group;
    }

    // Case 4: Wall Cabinet Bottom Gola 268 (18x26mm Inverted Recessed Channel)
    if (cid.includes("gola_wall_268")) {
      const topWeb = new THREE.Mesh(box, material);
      topWeb.scale.set(w, 2.5, d);
      topWeb.position.set(cx, cy + h / 2 - 1.25, cz);
      tagSubMesh(topWeb, userData, comp);
      group.add(topWeb);

      const rearWall = new THREE.Mesh(box, material);
      rearWall.scale.set(w, h, 2.5);
      rearWall.position.set(cx, cy, cz - d / 2 + 1.25);
      tagSubMesh(rearWall, userData, comp);
      group.add(rearWall);
      return group;
    }

    // Case 5: Vertical Gola 1020 (Tall / Wardrobe) vs Horizontal Top L-Gola (56x26mm)
    const isVert = h > w * 1.5;
    if (isVert) {
      const backWeb = new THREE.Mesh(box, material);
      backWeb.scale.set(w, h, 2.5);
      backWeb.position.set(cx, cy, cz - d / 2 + 1.25);
      tagSubMesh(backWeb, userData, comp);
      group.add(backWeb);

      for (const sgn of [-1, 1]) {
        const sideWall = new THREE.Mesh(box, material);
        sideWall.scale.set(2.5, h, d);
        sideWall.position.set(cx + sgn * (w / 2 - 1.25), cy, cz);
        tagSubMesh(sideWall, userData, comp);
        group.add(sideWall);
      }
      return group;
    }

    // Default: True Extruded L-Gola Profile (2.5mm thin anodized aluminum walls + rear dovetail bracket track!)
    const backWeb = new THREE.Mesh(box, material);
    backWeb.scale.set(w, h, 2.5);
    backWeb.position.set(cx, cy, cz - d / 2 + 1.25);
    backWeb.add(new THREE.LineSegments(edges, revealShadowMat));
    tagSubMesh(backWeb, userData, comp);
    group.add(backWeb);

    for (const rSgn of [-1, 1]) {
      const rearTrackRib = new THREE.Mesh(box, material);
      rearTrackRib.scale.set(w, 2.2, 3.5);
      rearTrackRib.position.set(cx, cy - 4 + rSgn * 7.5, cz - d / 2 - 1.5);
      tagSubMesh(rearTrackRib, userData, comp);
      group.add(rearTrackRib);
    }

    const botFlange = new THREE.Mesh(box, material);
    botFlange.scale.set(w, 2.5, d);
    botFlange.position.set(cx, cy - h / 2 + 1.25, cz);
    botFlange.add(new THREE.LineSegments(edges, revealShadowMat));
    tagSubMesh(botFlange, userData, comp);
    group.add(botFlange);

    const frontLip = new THREE.Mesh(box, material);
    frontLip.scale.set(w, 7, 2.5);
    frontLip.position.set(cx, cy - h / 2 + 3.5, cz + d / 2 - 1.25);
    frontLip.add(new THREE.LineSegments(edges, revealShadowMat));
    tagSubMesh(frontLip, userData, comp);
    group.add(frontLip);

    return group;
  }

  // 5B. MILLED J-PULL DOOR EDGE CUTOUT GROOVE (Kendinden J-Kulp Kapak Kenar Kesiti / Pah Detayı)
  if (comp.handleCategory === "j_pull") {
    const w = comp.dimensions.width;
    const h = comp.dimensions.height;
    const d = comp.dimensions.depth;
    const isVert = h > w * 1.5;

    // 1. Deep Dark Carved Finger Groove Cavity along the Door Edge
    const grooveMesh = new THREE.Mesh(box, darkCavityMat);
    grooveMesh.scale.set(isVert ? w * 0.55 : w, isVert ? h : h * 0.58, d + 4);
    grooveMesh.position.set(cx, isVert ? cy : cy + h * 0.16, cz + 2);
    tagSubMesh(grooveMesh, userData, comp);
    group.add(grooveMesh);

    // 2. Milled Front J-Hook Lip & Chamfer Step (matches door material with crisp shadow edge)
    const jLipMesh = new THREE.Mesh(box, material);
    jLipMesh.scale.set(isVert ? w * 0.45 : w, isVert ? h : h * 0.36, d + 6);
    jLipMesh.position.set(cx, isVert ? cy : cy - h * 0.25, cz + 4);
    jLipMesh.add(new THREE.LineSegments(edges, revealShadowMat));
    tagSubMesh(jLipMesh, userData, comp);
    group.add(jLipMesh);

    return group;
  }

  // 5C. RECESSED GRIP / MILLED WOOD GRIP POCKET CUTOUT (Gömme Kulp Yuvası)
  if (comp.handleCategory === "recessed_grip" || comp.handleCategory === "milled_wood_grip") {
    const w = comp.dimensions.width;
    const h = comp.dimensions.height;
    const d = comp.dimensions.depth;

    // Outer Bezel Surround Frame
    const bezelMesh = new THREE.Mesh(box, material);
    bezelMesh.scale.set(w, h, Math.max(6, d * 0.6));
    bezelMesh.position.set(cx, cy, cz + 2);
    bezelMesh.add(new THREE.LineSegments(edges, revealShadowMat));
    tagSubMesh(bezelMesh, userData, comp);
    group.add(bezelMesh);

    // Deep Dark Recessed Finger Cavity Well inside the Bezel
    const cavityWell = new THREE.Mesh(box, darkCavityMat);
    cavityWell.scale.set(Math.max(16, w - 12), Math.max(12, h - 10), Math.max(7, d * 0.72));
    cavityWell.position.set(cx, cy, cz + 3.5);
    tagSubMesh(cavityWell, userData, comp);
    group.add(cavityWell);

    return group;
  }

  // 5D. EXTRUDED ALUMINUM EDGE PROFILE HANDLE (Kapak Üst Kenarına Geçme L-Dudak Profil)
  if (comp.handleCategory === "edge_profile") {
    const w = comp.dimensions.width;
    const h = comp.dimensions.height;
    const d = comp.dimensions.depth;
    const isVert = h > w * 1.5;

    const topPlate = new THREE.Mesh(box, material);
    topPlate.scale.set(isVert ? 2.2 : w, isVert ? h : 2.2, d);
    topPlate.position.set(cx, isVert ? cy : cy + h / 2 - 1.1, cz);
    topPlate.add(new THREE.LineSegments(edges, revealShadowMat));
    tagSubMesh(topPlate, userData, comp);
    group.add(topPlate);

    const frontHook = new THREE.Mesh(box, material);
    frontHook.scale.set(isVert ? 2.5 : w, isVert ? h : 10, 2.5);
    frontHook.position.set(cx, isVert ? cy : cy + h / 2 - 5, cz + d / 2 - 1.25);
    frontHook.add(new THREE.LineSegments(edges, revealShadowMat));
    tagSubMesh(frontHook, userData, comp);
    group.add(frontHook);

    return group;
  }

  // 5E. REALISTIC 3D BAR / KNOB / LONG PROFILE HANDLES FLUSH-MOUNTED ON DOOR FACE + CRISP CAD EDGE OUTLINES!
  if (comp.role === "door_handle" || comp.role === "drawer_handle") {
    const w = comp.dimensions.width;
    const h = comp.dimensions.height;
    const d = comp.dimensions.depth;
    const doorFaceZ = cz - d * 0.5;

    if (comp.handleCategory === "knob") {
      const stemLen = 14;
      const stem = new THREE.Mesh(cylinder, material);
      stem.scale.set(11, 11, stemLen);
      stem.position.set(cx, cy, doorFaceZ + stemLen / 2 - 2);
      tagSubMesh(stem, userData, comp);
      group.add(stem);

      const capDepth = 10;
      const cap = new THREE.Mesh(cylinder, material);
      cap.scale.set(Math.max(24, w), Math.max(24, h), capDepth);
      cap.position.set(cx, cy, doorFaceZ + stemLen - 2 + capDepth / 2 - 1);
      const capEdges = new THREE.LineSegments(cylinderRimEdges, edgeMaterial);
      capEdges.userData.isPrimaryEdge = true;
      cap.add(capEdges);
      tagSubMesh(cap, userData, comp);
      group.add(cap);
      return group;
    }

    if (comp.id.includes("cup_pull") || (comp as { handleProfileId?: string }).handleProfileId === "hnd_cup_pull_96") {
      const cupW = Math.max(92, w);
      const cupH = Math.max(30, h * 2.2);
      const cupShell = new THREE.Mesh(cylinder, material);
      cupShell.scale.set(cupW, cupH, 24);
      cupShell.position.set(cx, cy, doorFaceZ + 8);
      tagSubMesh(cupShell, userData, comp);
      group.add(cupShell);
      const underHollow = new THREE.Mesh(box, darkCavityMat);
      underHollow.scale.set(cupW * 0.76, cupH * 0.45, 16);
      underHollow.position.set(cx, cy - cupH * 0.24, doorFaceZ + 8);
      underHollow.raycast = () => {};
      underHollow.userData = { preserveCustomMaterial: true };
      group.add(underHollow);
      return group;
    }

    const isVertical = h > w * 1.5;
    const barW = isVertical ? Math.max(11, w) : Math.max(96, w);
    const barH = isVertical ? Math.max(128, h) : Math.max(11, h);
    const barD = 10;
    const postLen = 16;

    const span = isVertical ? Math.max(36, barH * 0.78) : Math.max(36, barW * 0.78);
    [-span / 2, span / 2].forEach((offset) => {
      const post = new THREE.Mesh(cylinder, material);
      post.scale.set(10, 10, postLen);
      post.position.set(
        cx + (isVertical ? 0 : offset),
        cy + (isVertical ? offset : 0),
        doorFaceZ + postLen / 2 - 2
      );
      const postEdges = new THREE.LineSegments(cylinderRimEdges, edgeMaterial);
      postEdges.userData.isPrimaryEdge = true;
      post.add(postEdges);
      tagSubMesh(post, userData, comp);
      group.add(post);
    });

    const barGeo = getCachedBeveledPanelGeometry(barW, barH, barD, 1.8, comp.id);
    const barMesh = new THREE.Mesh(barGeo, material);
    barMesh.position.set(cx, cy, doorFaceZ + postLen - 3 + barD / 2);
    const barEdgeLines = new THREE.LineSegments(edges, edgeMaterial);
    barEdgeLines.scale.set(barW, barH, barD);
    barEdgeLines.userData.isPrimaryEdge = true;
    barMesh.add(barEdgeLines);
    tagSubMesh(barMesh, userData, comp);
    group.add(barMesh);
    return group;
  }

  // 5.85 TRUE 3D 5-SIDED PENTAGONAL 45° DIAGONAL CORNER SLAB (_pentagon_wx<X>_wz<Z>)
  const pentMatch = comp.id.match(/_pentagon_wx(\d+)_wz(\d+)/);
  if (pentMatch) {
    const isCrossPent =
      userData?.grainDir === "crosswise" || comp.grainDirection === "crosswise";
    const { geo: pentGeo, edges: pentEdges } = getCachedPentagonCornerGeometry(
      comp.dimensions.width,
      comp.dimensions.height,
      comp.dimensions.depth,
      Number(pentMatch[1]),
      Number(pentMatch[2]),
      isCrossPent
    );
    const pentMesh = new THREE.Mesh(pentGeo, material);
    pentMesh.position.set(cx, cy, cz);
    tagSubMesh(pentMesh, userData, comp);
    group.add(pentMesh);

    const pentLines = new THREE.LineSegments(pentEdges, edgeMaterial);
    pentLines.position.set(cx, cy, cz);
    pentLines.userData.isPrimaryEdge = true;
    group.add(pentLines);
    return group;
  }

  // 5.9 TRUE 3D COUNTERTOP / PANEL APERTURE EXTRUSION (Sink & Cooktop See-Through Cutout!)
  const cutoutW = comp.cutoutHole?.widthMm ?? comp.cutoutHole?.width ?? 0;
  const cutoutD = comp.cutoutHole?.depthMm ?? comp.cutoutHole?.depth ?? 0;
  if (comp.cutoutHole && cutoutW > 40 && cutoutD > 40) {
    const isCross =
      userData?.grainDir === "crosswise" || comp.grainDirection === "crosswise";
    const { geo: cutGeo, edges: cutEdges } = getCachedCountertopCutoutGeometry(
      comp.dimensions.width,
      comp.dimensions.height,
      comp.dimensions.depth,
      comp.cutoutHole,
      isCross
    );
    const cutMesh = new THREE.Mesh(cutGeo, material);
    cutMesh.position.set(cx, cy, cz);
    tagSubMesh(cutMesh, userData, comp);
    group.add(cutMesh);

    const cutLines = new THREE.LineSegments(cutEdges, edgeMaterial);
    cutLines.position.set(cx, cy, cz);
    cutLines.userData.isPrimaryEdge = true;
    group.add(cutLines);
    return group;
  }

  // 6. ARCHITECTURAL MICRO-BEVELED PANEL & DOOR MESH WITH PHYSICAL FUGA SHADOW REVEAL
  const isBeveledFrontRole =
    (!comp.primitive || comp.primitive === "box") &&
    (comp.role === "door_left" ||
      comp.role === "door_right" ||
      comp.role === "drawer_front" ||
      comp.role === "countertop" ||
      comp.role === "carcass_side_left" ||
      comp.role === "carcass_side_right" ||
      comp.role === "carcass_top" ||
      comp.role === "carcass_bottom" ||
      comp.role === "carcass_divider" ||
      comp.role === "shelf" ||
      comp.role === "plinth");

  const bevelRadiusMm =
    comp.role === "door_left" || comp.role === "door_right" || comp.role === "drawer_front"
      ? 1.7
      : comp.role === "countertop"
      ? 2.0
      : 0.9;

  const useTrueBevelGeo =
    isBeveledFrontRole &&
    comp.dimensions.width >= 12 &&
    comp.dimensions.height >= 12 &&
    comp.dimensions.depth >= 8 &&
    comp.crossSectionProfile !== "bevel_45" && comp.crossSectionProfile !== "j_pull_bevel" && comp.crossSectionProfile !== "cove_arch" && comp.crossSectionProfile !== "custom_cad_profile";

  const isCrossGrain =
    userData?.grainDir === "crosswise" || comp.grainDirection === "crosswise";
  const rawGrainUv = userData?.continuousGrainUv;
  const continuousGrainUv =
    rawGrainUv &&
    typeof rawGrainUv === "object" &&
    "offsetXMm" in rawGrainUv &&
    "offsetYMm" in rawGrainUv &&
    typeof (rawGrainUv as { offsetXMm: unknown }).offsetXMm === "number" &&
    typeof (rawGrainUv as { offsetYMm: unknown }).offsetYMm === "number"
      ? (rawGrainUv as { offsetXMm: number; offsetYMm: number; crosswise?: boolean })
      : undefined;
  const useWorldUvFlatBox =
    !useTrueBevelGeo &&
    (!comp.primitive || comp.primitive === "box") &&
    comp.isManufacturablePanel !== false;

  const mesh = new THREE.Mesh(
    comp.primitive === "sphere"
      ? sphere
      : comp.primitive === "cylinder"
      ? cylinder
      : useTrueBevelGeo
      ? getCachedBeveledPanelGeometry(
          comp.dimensions.width,
          comp.dimensions.height,
          comp.dimensions.depth,
          bevelRadiusMm,
          comp.id,
          continuousGrainUv
        )
      : useWorldUvFlatBox
      ? getCachedWorldUvBoxGeometry(
          comp.dimensions.width,
          comp.dimensions.height,
          comp.dimensions.depth,
          isCrossGrain,
          continuousGrainUv?.offsetXMm || 0,
          continuousGrainUv?.offsetYMm || 0
        )
      : box,
    material
  );
  if (!useTrueBevelGeo && !useWorldUvFlatBox) {
    mesh.scale.set(comp.dimensions.width, comp.dimensions.height, comp.dimensions.depth);
  }
  mesh.position.set(cx, cy, cz);
  tagSubMesh(mesh, userData, comp);

  if (!comp.primitive || comp.primitive === "box") {
    const cadFrameHolder = new THREE.Group();
    cadFrameHolder.position.set(cx, cy, cz);
    cadFrameHolder.scale.set(comp.dimensions.width, comp.dimensions.height, comp.dimensions.depth);

    const primaryEdgeLines = new THREE.LineSegments(edges, edgeMaterial);
    primaryEdgeLines.userData.isPrimaryEdge = true;
    cadFrameHolder.add(primaryEdgeLines);

    // Physical dark recessed shadow backing behind doors & drawer fronts for authentic 2-3mm joinery reveal depth!
    const isTranslucentGlassFront =
      comp.crossSectionProfile === "glass_frame" ||
      comp.crossSectionProfile === "full_smoked_glass" ||
      comp.crossSectionProfile === "center_glass_frame" ||
      comp.crossSectionProfile === "u_glass_open_top" ||
      String(comp.materialId || "").includes("glass");
    if (
      !isTranslucentGlassFront &&
      !(material as THREE.MeshPhysicalMaterial)?.transparent &&
      (comp.role === "door_left" ||
        comp.role === "door_right" ||
        comp.role === "drawer_front")
    ) {
      const fugaPlate = new THREE.Mesh(box, fugaShadowGapMat);
      fugaPlate.scale.set(
        Math.max(10, comp.dimensions.width + 2.2),
        Math.max(10, comp.dimensions.height + 2.2),
        1.4
      );
      fugaPlate.position.set(cx, cy, cz - comp.dimensions.depth * 0.5 - 0.9);
      fugaPlate.castShadow = false;
      fugaPlate.receiveShadow = false;
      fugaPlate.raycast = () => {};
      fugaPlate.userData = { preserveCustomMaterial: true, isFugaBacking: true };
      group.add(fugaPlate);
    }

    // Technical CAD Opening-Direction V-Lines on Hinged Cabinet Doors (shown ONLY in Technical CAD mode!)
    if (comp.role === "door_left" || comp.role === "door_right") {
      const isLiftDoor = comp.id.includes("lift_");
      const sharedDirGeo = isLiftDoor
        ? liftDoorDirectionGeo
        : comp.role === "door_left"
        ? leftDoorDirectionGeo
        : rightDoorDirectionGeo;
      const swingLines = new THREE.LineSegments(sharedDirGeo, doorDirectionLineMat);
      swingLines.userData.isCadSwingLine = true;
      swingLines.visible = false;
      cadFrameHolder.add(swingLines);
    }

    group.add(cadFrameHolder);
  }
  group.add(mesh);

  // 6A-INT. SLEEK RECESSED TOP FINGER-PULL CUTOUT ON INTERNAL DRAWERS (Matches Reference Studio Wardrobe!)
  if (comp.role === "drawer_front" && (comp as { isInternalDrawer?: boolean }).isInternalDrawer) {
    const gripW = Math.min(180, Math.max(90, comp.dimensions.width * 0.32));
    const gripH = 18;
    const gripWell = new THREE.Mesh(box, darkCavityMat);
    gripWell.scale.set(gripW, gripH, comp.dimensions.depth + 2.4);
    gripWell.position.set(cx, cy + comp.dimensions.height / 2 - gripH / 2 + 0.5, cz);
    gripWell.raycast = () => {};
    gripWell.userData = { preserveCustomMaterial: true };
    group.add(gripWell);
  }

  // 6B. 3D CNC DOOR CROSS-SECTION PROFILE RENDERING (Strict 1-to-1 Name <-> Geometry Alignment + World-Scale UVs!)
  if (comp.role === "door_left" || comp.role === "door_right" || comp.role === "drawer_front") {
    const explicitProfile = comp.crossSectionProfile;
    const activeProfile =
      explicitProfile ||
      (comp.materialId === "mat_smoked_glass"
        ? "full_smoked_glass"
        : comp.materialId === "mat_bronze_mirror"
        ? "mirror_door"
        : comp.handleCategory === "decorative_bespoke"
        ? "shaker_frame"
        : "flat_slab");
    const w = comp.dimensions.width;
    const h = comp.dimensions.height;
    const d = comp.dimensions.depth;

    if (comp.id.includes("_tambour_curtain") && w > 80 && h > 40) {
      // 0. Dikey / Yatay Esnek Tambur Panjur Kapak (`_tambour_curtain`): Akustik keçe sırt + gerçek yatay lamel dizisi!
      mesh.visible = false;
      const backing = new THREE.Mesh(box, darkCavityMat);
      backing.scale.set(Math.max(40, w - 4), Math.max(30, h - 2), 3);
      backing.position.set(cx, cy, cz - d * 0.35);
      backing.userData = { preserveCustomMaterial: true };
      group.add(backing);

      const slatPitch = 22;
      const slatCount = Math.max(2, Math.floor(h / slatPitch));
      const actualPitch = h / slatCount;
      const slatH = Math.max(12, actualPitch - 2.2);
      const slatD = Math.max(10, d - 2);
      const slatGeo = getCachedWorldUvBoxGeometry(w, slatH, slatD, true);
      const instSlats = new THREE.InstancedMesh(slatGeo, material, slatCount);
      const mtx = new THREE.Matrix4();
      const yBottom = cy - h / 2;
      for (let si = 0; si < slatCount; si++) {
        mtx.identity();
        mtx.setPosition(cx, yBottom + (si + 0.5) * actualPitch, cz + 1);
        instSlats.setMatrixAt(si, mtx);
      }
      instSlats.instanceMatrix.needsUpdate = true;
      instSlats.castShadow = true;
      instSlats.receiveShadow = true;
      tagSubMesh(instSlats, userData, comp);
      group.add(instSlats);
    } else if (activeProfile === "full_smoked_glass" && w > 80 && h > 80) {
      // 1B. Tam Füme Cam (Çerçevesiz): full edge-to-edge translucent smoked glass pane!
      mesh.visible = false;
      const glassPane = new THREE.Mesh(box, sharedSmokedGlassPaneMat);
      glassPane.scale.set(w, h, Math.max(8, d * 0.45));
      glassPane.position.set(cx, cy, cz);
      const gEdge = new THREE.LineSegments(edges, revealShadowMat);
      glassPane.add(gEdge);
      tagSubMesh(glassPane, userData, comp);
      glassPane.castShadow = false;
      glassPane.renderOrder = 4;
      group.add(glassPane);
    } else if (
      (activeProfile === "glass_frame" ||
        activeProfile === "center_glass_frame" ||
        activeProfile === "u_glass_open_top") &&
      w > 100 &&
      h > 80
    ) {
      // 1. Camlı Vitrin / Ortası Camlı / Üstü Açık Çekmece: perimeter frame bars + true translucent smoked glass center pane!
      mesh.visible = false;
      const isOpenTopDrawer =
        activeProfile === "u_glass_open_top" && comp.role === "drawer_front";
      const frameW = Math.min(54, Math.max(24, Math.round(Math.min(w, h) * 0.14)));
      const innerW = Math.max(40, w - 2 * frameW);
      const innerH = isOpenTopDrawer
        ? Math.max(40, h - frameW)
        : Math.max(40, h - 2 * frameW);
      const frameMat =
        comp.materialId === "mat_smoked_glass" ? sharedDarkAnodizedFrameMat : material;
      const frameBars = [
        { sx: frameW, sy: h, px: cx - w / 2 + frameW / 2, py: cy, horiz: false },
        { sx: frameW, sy: h, px: cx + w / 2 - frameW / 2, py: cy, horiz: false },
        ...(isOpenTopDrawer
          ? []
          : [{ sx: innerW, sy: frameW, px: cx, py: cy + h / 2 - frameW / 2, horiz: true }]),
        { sx: innerW, sy: frameW, px: cx, py: cy - h / 2 + frameW / 2, horiz: true },
      ];
      frameBars.forEach((fb) => {
        const barGeo = getCachedWorldUvBoxGeometry(fb.sx, fb.sy, d, fb.horiz);
        const bar = new THREE.Mesh(barGeo, frameMat);
        bar.position.set(fb.px, fb.py, cz);
        tagSubMesh(bar, userData, comp);
        group.add(bar);
      });
      const glassPane = new THREE.Mesh(box, sharedSmokedGlassPaneMat);
      glassPane.scale.set(innerW, innerH, Math.max(6, d * 0.32));
      glassPane.position.set(cx, isOpenTopDrawer ? cy + frameW / 2 : cy, cz);
      tagSubMesh(glassPane, userData, comp);
      glassPane.castShadow = false; // Allow studio & LED light to illuminate inner shelves & clothes behind smoked glass!
      glassPane.renderOrder = 4;
      group.add(glassPane);
    } else if (
      (activeProfile === "mirror_door" || activeProfile === "mirror_frameless") &&
      w > 100 &&
      h > 100
    ) {
      // 2. Aynalı Kapak: Çerçeveli (14mm rim) veya Çerçevesiz (edge-to-edge)!
      const isFrameless = activeProfile === "mirror_frameless";
      const rimW = isFrameless ? 0 : 14;
      const mirrorW = Math.max(40, w - 2 * rimW);
      const mirrorH = Math.max(40, h - 2 * rimW);
      const mirrorMat =
        comp.materialId === "mat_bronze_mirror"
          ? sharedBronzeMirrorPaneMat
          : sharedSilverMirrorPaneMat;
      const mirrorPane = new THREE.Mesh(box, mirrorMat);
      mirrorPane.scale.set(mirrorW, mirrorH, 4);
      mirrorPane.position.set(cx, cy, cz + d * 0.5 - 0.5);
      const mEdge = new THREE.LineSegments(edges, revealShadowMat);
      mirrorPane.add(mEdge);
      tagSubMesh(mirrorPane, userData, comp);
      group.add(mirrorPane);
    } else if (activeProfile === "shaker_frame" && w > 160 && h > 160) {
      // 3. 5-Parçalı Çerçeveli Shaker Kapak (`shaker_frame`): True recessed 12mm center panel + 18mm outer stiles & rails!
      mesh.visible = false;
      const stileW = Math.min(66, Math.max(42, Math.round(w * 0.13)));
      const innerW = Math.max(40, w - 2 * stileW);
      const innerH = Math.max(40, h - 2 * stileW);
      const centerD = Math.max(10, d - 6);
      const centerGeo = getCachedWorldUvBoxGeometry(innerW + 4, innerH + 4, centerD, isCrossGrain);
      const centerPanel = new THREE.Mesh(centerGeo, material);
      centerPanel.position.set(cx, cy, cz - (d - centerD) / 2);
      tagSubMesh(centerPanel, userData, comp);
      group.add(centerPanel);

      const innerFrameOutline = new THREE.LineSegments(edges, revealShadowMat);
      innerFrameOutline.scale.set(innerW, innerH, d);
      innerFrameOutline.position.set(cx, cy, cz);
      group.add(innerFrameOutline);

      const frameBars = [
        { sx: stileW, sy: h, px: cx - w / 2 + stileW / 2, py: cy, horiz: false },
        { sx: stileW, sy: h, px: cx + w / 2 - stileW / 2, py: cy, horiz: false },
        { sx: innerW, sy: stileW, px: cx, py: cy + h / 2 - stileW / 2, horiz: true },
        { sx: innerW, sy: stileW, px: cx, py: cy - h / 2 + stileW / 2, horiz: true },
      ];
      frameBars.forEach((fb) => {
        const barGeo = getCachedWorldUvBoxGeometry(fb.sx, fb.sy, d, fb.horiz);
        const bar = new THREE.Mesh(barGeo, material);
        bar.position.set(fb.px, fb.py, cz);
        tagSubMesh(bar, userData, comp);
        group.add(bar);
      });
    } else if (activeProfile === "fluted_ribbed" && w > 120) {
      // 4. Dikey Fitilli / CNC Çıtalı Kapak (`fluted_ribbed`): Milled dark shadow grooves + world-UV vertical ribs (zero grain stretch!)
      mesh.visible = false;
      const backThickness = Math.max(11, d - 6);
      const backingGeo = getCachedWorldUvBoxGeometry(w, h, backThickness, isCrossGrain);
      const backingMesh = new THREE.Mesh(backingGeo, darkCavityMat);
      backingMesh.position.set(cx, cy, cz - (d - backThickness) / 2);
      tagSubMesh(backingMesh, userData, comp);
      group.add(backingMesh);

      const slatPitch = 30;
      const slatCount = Math.min(36, Math.max(4, Math.floor((w - 8) / slatPitch)));
      const slatW = Math.max(14, (w - (slatCount - 1) * 5) / slatCount);
      const ribDepth = d - backThickness + 1.5;
      const slatGeo = getCachedWorldUvBoxGeometry(slatW, h - 2, ribDepth, false);
      const startLeft = cx - w / 2 + slatW / 2;
      const stepX = slatCount > 1 ? (w - slatW) / (slatCount - 1) : 0;
      const instSlats = new THREE.InstancedMesh(slatGeo, material, slatCount);
      const slatMtx = new THREE.Matrix4();
      for (let s = 0; s < slatCount; s++) {
        slatMtx.makeTranslation(startLeft + s * stepX, cy, cz + d / 2 - ribDepth / 2);
        instSlats.setMatrixAt(s, slatMtx);
      }
      instSlats.instanceMatrix.needsUpdate = true;
      tagSubMesh(instSlats as unknown as THREE.Mesh, userData, comp);
      group.add(instSlats);
    } else if (activeProfile === "bevel_45" && w > 120 && h > 120) {
      // 5. 45° Pahlı Kesit Kapak (`bevel_45`): Hide flat box (NO double-scaling!), render precision 2-tier 45° chamfered frustum!
      mesh.visible = false;
      group.children.forEach((ch) => {
        if ((ch as THREE.Group).children?.some((sub) => sub.userData?.isPrimaryEdge)) {
          ch.visible = false;
        }
      });
      const bevelSlopeW = Math.min(30, Math.round(Math.min(w, h) * 0.08));
      const { frustumGeo, frustumEdges } = getCachedBevel45Frustum(w, h, d, bevelSlopeW);
      const frustumMesh = new THREE.Mesh(frustumGeo, material);
      frustumMesh.position.set(cx, cy, cz);
      frustumMesh.castShadow = true;
      frustumMesh.receiveShadow = true;
      frustumMesh.add(new THREE.LineSegments(frustumEdges, revealShadowMat));
      tagSubMesh(frustumMesh, userData, comp);
      group.add(frustumMesh);
    } else if (activeProfile === "j_pull_bevel" && w > 120 && h > 120) {
      // 6. 45° Eğimli Gizli J-Kulp Parmak Kanallı Kapak (`j_pull_bevel`)
      mesh.visible = false;
      const { geo: jpGeo, edges: jpEdges } = getCachedJPullBevelDoorGeometry(w, h, d, isCrossGrain, comp.jPullEdge || "top");
      const jpMesh = new THREE.Mesh(jpGeo, material);
      jpMesh.position.set(cx, cy, cz);
      jpMesh.castShadow = true;
      jpMesh.receiveShadow = true;
      jpMesh.add(new THREE.LineSegments(jpEdges, revealShadowMat));
      tagSubMesh(jpMesh, userData, comp);
      group.add(jpMesh);
    } else if (activeProfile === "cove_arch" && w > 140 && h > 140) {
      // 7. İçbükey Kavisli (Cove) Çok Kademeli Çerçeve Kapak (`cove_arch`)
      mesh.visible = false;
      const covePoly = [
        { x: 0.0, y: 0.95 },
        { x: 0.16, y: 1.0 },
        { x: 0.38, y: 0.72 },
        { x: 0.64, y: 0.52 },
        { x: 0.86, y: 0.46 },
        { x: 1.0, y: 0.46 },
      ];
      const { geo: cvGeo, edges: cvEdges } = getCachedContouredDoorSweepGeometry(
        w,
        h,
        d,
        covePoly,
        isCrossGrain
      );
      const cvMesh = new THREE.Mesh(cvGeo, material);
      cvMesh.position.set(cx, cy, cz);
      cvMesh.castShadow = true;
      cvMesh.receiveShadow = true;
      cvMesh.add(new THREE.LineSegments(cvEdges, revealShadowMat));
      tagSubMesh(cvMesh, userData, comp);
      group.add(cvMesh);
    } else if (activeProfile === "custom_cad_profile" && w > 100 && h > 80) {
      // 8. Gerçek Çok Halkalı 3D Özel CAD (.DXF / .SVG / .JSON) Kesit Örme (Perimeter Sweep/Loft)
      mesh.visible = false;
      const poly =
        comp.customCadPolygon && comp.customCadPolygon.length >= 2
          ? comp.customCadPolygon
          : [
              { x: 0.0, y: 0.42 },
              { x: 0.24, y: 1.0 },
              { x: 0.55, y: 0.64 },
              { x: 0.82, y: 0.88 },
              { x: 1.0, y: 0.58 },
            ];
      const { geo: swGeo, edges: swEdges } = getCachedContouredDoorSweepGeometry(
        w,
        h,
        d,
        poly,
        isCrossGrain
      );
      const sweptDoor = new THREE.Mesh(swGeo, material);
      sweptDoor.position.set(cx, cy, cz);
      sweptDoor.castShadow = true;
      sweptDoor.receiveShadow = true;
      sweptDoor.add(new THREE.LineSegments(swEdges, revealShadowMat));
      tagSubMesh(sweptDoor, userData, comp);
      group.add(sweptDoor);
    }
  }

  disableLineRaycast(group);
  return group;
}

/** Opt-in local QA evidence from actual rendered mesh transforms, not a second model. */
export function publishSceneDiagnostics(canvas: HTMLCanvasElement, scene: THREE.Object3D) {
  if (!new URLSearchParams(window.location.search).has("audit")) return;
  scene.updateMatrixWorld(true);
  const meshes: unknown[] = [];
  scene.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh) || !obj.userData.componentId) return;
    const point = obj.getWorldPosition(new THREE.Vector3());
    meshes.push({
      id: obj.userData.componentId,
      role: obj.userData.role,
      parent: obj.userData.parentComponentId,
      category: obj.userData.handleCategory,
      center: point.toArray(),
      matrix: obj.matrixWorld.toArray(),
      scale: obj.scale.toArray(),
      materialId: obj.userData.matDef?.id,
      color: (obj.material as THREE.MeshPhysicalMaterial).color?.getHexString(),
      geometry: obj.geometry.type,
    });
  });
  canvas.dataset.scene = JSON.stringify(meshes);
}

let cachedContactShadowMat: THREE.MeshBasicMaterial | null = null;
function getBakedContactShadowMaterial(): THREE.MeshBasicMaterial | null {
  if (typeof document === "undefined") return null;
  if (cachedContactShadowMat) return cachedContactShadowMat;
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, size, size);
  // Soft two-tier ambient occlusion contact shadow (tight dark core under plinth + soft outer falloff)
  const drawSoftRect = (pad: number, alpha: number, blurPx: number) => {
    ctx.save();
    ctx.filter = `blur(${blurPx}px)`;
    ctx.fillStyle = `rgba(18, 16, 14, ${alpha})`;
    ctx.fillRect(pad, pad, size - pad * 2, size - pad * 2);
    ctx.restore();
  };
  drawSoftRect(34, 0.22, 22);
  drawSoftRect(46, 0.34, 10);
  drawSoftRect(54, 0.28, 4);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  cachedContactShadowMat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    opacity: 0.85,
  });
  return cachedContactShadowMat;
}

let cachedInteriorAoMat: THREE.MeshBasicMaterial | null = null;
function getBakedInteriorAoMaterial(): THREE.MeshBasicMaterial | null {
  if (typeof document === "undefined") return null;
  if (cachedInteriorAoMat) return cachedInteriorAoMat;
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, size, size);
  // Subtle perimeter vignette darkening inside cabinet corners (baked crevice AO, 0 FPS cost)
  const topG = ctx.createLinearGradient(0, 0, 0, size * 0.26);
  topG.addColorStop(0, "rgba(22, 19, 16, 0.22)");
  topG.addColorStop(1, "rgba(22, 19, 16, 0)");
  ctx.fillStyle = topG;
  ctx.fillRect(0, 0, size, size * 0.26);

  const botG = ctx.createLinearGradient(0, size, 0, size * 0.78);
  botG.addColorStop(0, "rgba(22, 19, 16, 0.18)");
  botG.addColorStop(1, "rgba(22, 19, 16, 0)");
  ctx.fillStyle = botG;
  ctx.fillRect(0, size * 0.78, size, size * 0.22);

  const leftG = ctx.createLinearGradient(0, 0, size * 0.18, 0);
  leftG.addColorStop(0, "rgba(22, 19, 16, 0.16)");
  leftG.addColorStop(1, "rgba(22, 19, 16, 0)");
  ctx.fillStyle = leftG;
  ctx.fillRect(0, 0, size * 0.18, size);

  const rightG = ctx.createLinearGradient(size, 0, size * 0.82, 0);
  rightG.addColorStop(0, "rgba(22, 19, 16, 0.16)");
  rightG.addColorStop(1, "rgba(22, 19, 16, 0)");
  ctx.fillStyle = rightG;
  ctx.fillRect(size * 0.82, 0, size * 0.18, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  cachedInteriorAoMat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    opacity: 0.9,
  });
  return cachedInteriorAoMat;
}

export function createModuleGroup(module: ModuleInstance) {
  const placement = calculateModulePlacement(module);
  const group = new THREE.Group();
  group.position.set(placement.origin.x, placement.origin.y, placement.origin.z);
  group.rotation.y = placement.rotationYRad;

  // Grounded Baked Floor Contact Shadow (near-zero GPU cost, anchors cabinet to floor)
  const isFloorStanding =
    module.category !== "kitchen_wall" &&
    module.category !== "complementary" &&
    (module.position?.y ?? 0) <= 50;
  if (isFloorStanding) {
    const contactMat = getBakedContactShadowMaterial();
    if (contactMat) {
      const padMm = 140;
      const planeW = module.dimensions.width + padMm * 2;
      const planeD = module.dimensions.depth + padMm * 2;
      const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(planeW, planeD), contactMat);
      shadowPlane.rotation.x = -Math.PI / 2;
      shadowPlane.position.set(module.dimensions.width / 2, 0.8, module.dimensions.depth / 2);
      shadowPlane.renderOrder = -1;
      shadowPlane.raycast = () => {};
      shadowPlane.userData = { isSelectionHelper: true, isContactShadow: true };
      group.add(shadowPlane);
    }
  }
  return group;
}
