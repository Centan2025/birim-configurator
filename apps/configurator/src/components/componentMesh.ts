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
  hole: NonNullable<import("@birim/geometry").ComponentBox3D["cutoutHole"]>,
  grainCrosswise = false
): { geo: THREE.BufferGeometry; edges: THREE.EdgesGeometry } {
  const key = `${Math.round(w)}_${Math.round(h)}_${Math.round(d)}_${Math.round(hole.offsetX)}_${Math.round(hole.offsetZ)}_${Math.round(hole.width)}_${Math.round(hole.depth)}_${Math.round(hole.cornerRadiusMm || 10)}_${grainCrosswise ? 1 : 0}`;
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
  const holeW = Math.max(80, Math.min(w - 70, hole.width));
  const holeD = Math.max(80, Math.min(d - 70, hole.depth));
  const x0 = Math.max(-hw + 35, Math.min(hw - 35 - holeW, -hw + hole.offsetX));
  // Shape Y maps to -Z after rotateX(-PI/2), so z in [-hd..hd] maps to shapeY = -z
  const zFront = Math.max(-hd + 35, Math.min(hd - 35 - holeD, -hd + hole.offsetZ));
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
    color: 0x28313b,
    roughness: 0.035,
    metalness: 0.08,
    transmission: 0.66,
    ior: 1.52,
    reflectivity: 0.98,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    envMapIntensity: 1.75,
    transparent: true,
    opacity: 0.54,
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
  if (comp.role === "door_hinge") {
    const isRightHinge = comp.id.includes("right");
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
    carcassFixedGroup.rotation.y = -doorYaw;

    const plateX = dirSign * 5;
    const plateZ = -42;
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
  if (comp.role === "hanging_rail") {
    const w = comp.dimensions.width;
    // Left & Right Side-Panel Mounting Flanges (Askı Borusu Flanjları)
    [-w / 2 + 4, w / 2 - 4].forEach((fx) => {
      const flange = new THREE.Mesh(cylinderY, chromeHardwareMat);
      flange.rotation.z = Math.PI / 2;
      flange.scale.set(34, 8, 22);
      flange.position.set(cx + fx, cy, cz);
      tagSubMesh(flange, userData, comp);
      group.add(flange);
    });

    // Main Oval Chrome Hanging Rod (15×25mm oval profile)
    const rod = new THREE.Mesh(cylinderY, chromeHardwareMat);
    rod.rotation.z = Math.PI / 2;
    rod.scale.set(25, Math.max(40, w - 6), 16);
    rod.position.set(cx, cy, cz);
    tagSubMesh(rod, userData, comp);
    group.add(rod);

    // Top Dark Anti-Slip Rubber Insert Strip (sculpted wooden hangers & collared shirts are added by wardrobePropsBuilder)
    const rubberStrip = new THREE.Mesh(box, darkDamperMat);
    rubberStrip.scale.set(Math.max(40, w - 12), 3, 6);
    rubberStrip.position.set(cx, cy + 12.5, cz);
    tagSubMesh(rubberStrip, userData, comp);
    group.add(rubberStrip);

    return group;
  }

  // 1E. REALISTIC 3D HÄFELE TELESCOPIC TROUSER RACK (Pantolonluk — Pull-Out Frame + Non-Slip Rods)
  if (comp.id.includes("_fitting_trouser_rack")) {
    const w = comp.dimensions.width;
    const h = comp.dimensions.height;
    const d = comp.dimensions.depth;
    const frameY = cy + h * 0.22;

    // Left & Right Ball-Bearing Side Slide Channels + Front & Back Frame Crossbars
    [-w / 2 + 10, w / 2 - 10].forEach((sx) => {
      const sideRail = new THREE.Mesh(box, darkDamperMat);
      sideRail.scale.set(18, 28, d);
      sideRail.position.set(cx + sx, frameY, cz);
      sideRail.add(new THREE.LineSegments(edges, revealShadowMat));
      tagSubMesh(sideRail, userData, comp);
      group.add(sideRail);
    });

    [-d / 2 + 12, d / 2 - 12].forEach((sz) => {
      const crossBar = new THREE.Mesh(box, chromeHardwareMat);
      crossBar.scale.set(Math.max(60, w - 20), 22, 18);
      crossBar.position.set(cx, frameY, cz + sz);
      crossBar.add(new THREE.LineSegments(edges, revealShadowMat));
      tagSubMesh(crossBar, userData, comp);
      group.add(crossBar);
    });

    // 8 Non-Slip Flocked Cylindrical Trouser Hanger Rods spanning back-to-front
    const rodCount = Math.max(5, Math.min(10, Math.floor((w - 56) / 62)));
    const stepX = (w - 64) / Math.max(1, rodCount - 1);
    for (let r = 0; r < rodCount; r++) {
      const rx = cx - (w - 64) / 2 + r * stepX;
      const rodMesh = new THREE.Mesh(cylinder, chromeHardwareMat);
      rodMesh.scale.set(11, 11, Math.max(80, d - 32));
      rodMesh.position.set(rx, frameY + 4, cz);
      tagSubMesh(rodMesh, userData, comp);
      group.add(rodMesh);

      // Anti-slip rubber grip rings on each trouser bar
      [-d * 0.22, d * 0.18].forEach((rz) => {
        const gripRing = new THREE.Mesh(cylinder, darkCavityMat);
        gripRing.scale.set(13.5, 13.5, 24);
        gripRing.position.set(rx, frameY + 4, cz + rz);
        tagSubMesh(gripRing, userData, comp);
        group.add(gripRing);
      });
    }
    return group;
  }

  // 1F. REALISTIC 3D HÄFELE INCLINED PULL-OUT SHOE RACK (Ayakkabılık — 15° Inclined Slatted Shelf + Front Heel Guard)
  if (comp.id.includes("_fitting_shoe_rack")) {
    const w = comp.dimensions.width;
    const d = comp.dimensions.depth;

    // Left & Right Side Telescopic Slides
    [-w / 2 + 8, w / 2 - 8].forEach((sx) => {
      const slide = new THREE.Mesh(box, darkDamperMat);
      slide.scale.set(14, 24, d);
      slide.position.set(cx + sx, cy, cz);
      tagSubMesh(slide, userData, comp);
      group.add(slide);
    });

    // 15°-Inclined Slatted Shoe Platform Group
    const inclinedGroup = new THREE.Group();
    inclinedGroup.position.set(cx, cy + 6, cz);
    inclinedGroup.rotation.x = 0.22; // ~13 deg forward tilt

    const trayBase = new THREE.Mesh(box, screwHeadMat);
    trayBase.scale.set(Math.max(60, w - 24), 8, Math.max(80, d - 24));
    trayBase.add(new THREE.LineSegments(edges, revealShadowMat));
    tagSubMesh(trayBase, userData, comp);
    inclinedGroup.add(trayBase);

    // 4 Chrome橫 Gripping Bars across the inclined shoe shelf
    [-d * 0.34, -d * 0.12, d * 0.12, d * 0.36].forEach((bz, bIdx) => {
      const bar = new THREE.Mesh(box, chromeHardwareMat);
      bar.scale.set(Math.max(60, w - 28), bIdx === 3 ? 22 : 10, 8);
      bar.position.set(0, bIdx === 3 ? 12 : 6, bz);
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

  // 1H. REALISTIC 3D VELVET JEWELRY & WATCH ORGANIZER TRAY (Kadife Takı / Saat / Kemer Çekmecesi)
  if (comp.id.includes("_fitting_jewelry_tray")) {
    const w = comp.dimensions.width;
    const h = Math.min(72, comp.dimensions.height);
    const d = comp.dimensions.depth;

    // Outer Frame Box
    const outerTray = new THREE.Mesh(box, darkDamperMat);
    outerTray.scale.set(w, h, d);
    outerTray.position.set(cx, cy, cz);
    outerTray.add(new THREE.LineSegments(edges, revealShadowMat));
    tagSubMesh(outerTray, userData, comp);
    group.add(outerTray);

    // 4x3 Divided Velvet Grid Cells inside the Tray
    const cols = 4;
    const rows = 3;
    for (let c = 1; c < cols; c++) {
      const divX = new THREE.Mesh(box, screwHeadMat);
      divX.scale.set(6, h - 6, d - 16);
      divX.position.set(cx - w / 2 + (c * w) / cols, cy + 3, cz);
      tagSubMesh(divX, userData, comp);
      group.add(divX);
    }
    for (let r = 1; r < rows; r++) {
      const divZ = new THREE.Mesh(box, screwHeadMat);
      divZ.scale.set(w - 16, h - 6, 6);
      divZ.position.set(cx, cy + 3, cz - d / 2 + (r * d) / rows);
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

  // 1I. REALISTIC 3D WIRE MESH BASKET (Häfele Tel Sepet)
  if (comp.id.includes("_fitting_wire_basket")) {
    const w = comp.dimensions.width;
    const h = Math.min(160, comp.dimensions.height);
    const d = comp.dimensions.depth;

    // Top Rim & Bottom Wire Frame
    [cy + h * 0.38, cy - h * 0.38].forEach((ry, idx) => {
      const rim = new THREE.Mesh(box, chromeHardwareMat);
      rim.scale.set(idx === 0 ? w : w * 0.88, 10, idx === 0 ? d : d * 0.88);
      rim.position.set(cx, ry, cz);
      rim.add(new THREE.LineSegments(edges, revealShadowMat));
      tagSubMesh(rim, userData, comp);
      group.add(rim);
    });

    // Vertical & Bottom Chrome Wire Ribs
    const ribCount = 7;
    const stepX = (w - 48) / (ribCount - 1);
    for (let i = 0; i < ribCount; i++) {
      const rx = cx - (w - 48) / 2 + i * stepX;
      const wire = new THREE.Mesh(box, chromeHardwareMat);
      wire.scale.set(4, h * 0.76, d * 0.9);
      wire.position.set(rx, cy, cz);
      wire.add(new THREE.LineSegments(edges, revealShadowMat));
      tagSubMesh(wire, userData, comp);
      group.add(wire);
    }
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

  // 2. REAL 3D BLUM AVENTOS LIFT-UP MECHANISMS (HK top / HL top / HF Bi-Fold)
  if (comp.id.includes("_aventos_mech_")) {
    const isRightSide = comp.id.includes("_right");
    const isHL = comp.id.includes("_hl_");
    const isHF = comp.id.includes("_hf_");
    const w = comp.dimensions.width;
    const h = comp.dimensions.height;
    const d = comp.dimensions.depth;
    const liftPitch = comp.rotation?.[0] || 0;

    // A. Stationary Anthracite Silk-Matte Blum AVENTOS Power Storage Unit (Counter-rotated so it stays bolted to side panel!)
    const housingGroup = new THREE.Group();
    housingGroup.rotation.x = -liftPitch;

    const housingBox = new THREE.Mesh(box, darkDamperMat);
    housingBox.scale.set(w * 0.85, h * 0.82, Math.min(190, d * 0.78));
    housingBox.position.set(cx, cy + h * 0.06, cz - d * 0.08);
    housingBox.add(new THREE.LineSegments(edges, revealShadowMat));
    tagSubMesh(housingBox, userData, comp);
    housingGroup.add(housingBox);

    // Blum Orange/Amber Power Factor Adjustment Dial & Chrome Cover Plate
    const dialSign = isRightSide ? -1 : 1;
    const dialMesh = new THREE.Mesh(cylinder, blumAccentMat);
    dialMesh.scale.set(18, 18, w * 0.92);
    dialMesh.rotation.y = Math.PI / 2;
    dialMesh.position.set(cx + dialSign * 2, cy + h * 0.05, cz + d * 0.14);
    tagSubMesh(dialMesh, userData, comp);
    housingGroup.add(dialMesh);

    group.add(housingGroup);

    // B. Articulated Telescopic Chrome Lever Arm & Gas Spring Strut (Rotates with lift angle toward the door back)
    const armLen = Math.max(130, d * 0.95);
    const mainArm = new THREE.Mesh(box, chromeHardwareMat);
    mainArm.scale.set(10, 18, armLen);
    mainArm.position.set(cx + dialSign * 6, cy - h * 0.12, cz + d * 0.28);
    mainArm.add(new THREE.LineSegments(edges, revealShadowMat));
    tagSubMesh(mainArm, userData, comp);
    group.add(mainArm);

    // Telescopic Inner Rod & Gas Damper Cylinder
    const gasStrut = new THREE.Mesh(cylinder, darkDamperMat);
    gasStrut.scale.set(12, 12, armLen * 0.62);
    gasStrut.position.set(cx + dialSign * 6, cy - h * 0.24, cz + d * 0.12);
    tagSubMesh(gasStrut, userData, comp);
    group.add(gasStrut);

    if (isHL || isHF) {
      // Secondary Parallelogram Link (HL) or Bi-Fold Lower Extension Rod (HF)
      const secArm = new THREE.Mesh(box, chromeHardwareMat);
      secArm.scale.set(8, 14, armLen * 0.88);
      secArm.position.set(
        cx + dialSign * 8,
        cy - h * (isHF ? 0.42 : 0.32),
        cz + d * (isHF ? 0.42 : 0.26)
      );
      secArm.rotation.x = isHF ? 0.32 : 0.05;
      tagSubMesh(secArm, userData, comp);
      group.add(secArm);
    }

    // Door Back Clip Bracket at front end of arm
    const doorBracket = new THREE.Mesh(box, screwHeadMat);
    doorBracket.scale.set(18, 48, 14);
    doorBracket.position.set(cx + dialSign * 6, cy - h * 0.15, cz + d * 0.68);
    tagSubMesh(doorBracket, userData, comp);
    group.add(doorBracket);

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

  // 5A. GOLA EXTRUDED L/C ALUMINUM PROFILE CHANNEL (Horizontal or Vertical)
  if (comp.role === "gola_profile" || comp.handleCategory === "gola_profile") {
    const w = comp.dimensions.width;
    const h = comp.dimensions.height;
    const d = comp.dimensions.depth;
    const isVert = h > w * 1.5;

    // Deep dark recessed finger-pull shadow cavity inside the Gola channel
    const shadowWell = new THREE.Mesh(box, darkCavityMat);
    shadowWell.scale.set(isVert ? w * 0.65 : w, isVert ? h : h * 0.78, d * 0.75);
    shadowWell.position.set(cx, cy, cz + 2);
    tagSubMesh(shadowWell, userData, comp);
    group.add(shadowWell);

    // Anodized Aluminum / Matte Black Back Web of Gola Profile
    const backWeb = new THREE.Mesh(box, material);
    backWeb.scale.set(isVert ? 4 : w, isVert ? h : h, 4);
    backWeb.position.set(cx, cy, cz - d * 0.35);
    backWeb.add(new THREE.LineSegments(edges, revealShadowMat));
    tagSubMesh(backWeb, userData, comp);
    group.add(backWeb);

    // Bottom / Side Horizontal Shelf of L-Gola Profile
    const shelfFlange = new THREE.Mesh(box, material);
    shelfFlange.scale.set(isVert ? w : w, isVert ? h : 4, d);
    shelfFlange.position.set(cx, isVert ? cy : cy - h * 0.42, cz + 4);
    shelfFlange.add(new THREE.LineSegments(edges, revealShadowMat));
    tagSubMesh(shelfFlange, userData, comp);
    group.add(shelfFlange);

    // Front Upward Finger-Hook Lip of Gola Profile
    const frontLip = new THREE.Mesh(box, material);
    frontLip.scale.set(isVert ? 5 : w, isVert ? h : 9, 4);
    frontLip.position.set(cx, isVert ? cy : cy - h * 0.28, cz + d * 0.52);
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

  // 5D. EXTRUDED ALUMINUM EDGE PROFILE HANDLE (Üst/Alt Kenar Alüminyum Kulp Profili)
  if (comp.handleCategory === "edge_profile") {
    const w = comp.dimensions.width;
    const h = comp.dimensions.height;
    const d = comp.dimensions.depth;
    const isVert = h > w * 1.5;

    // Top/Edge Clamping Flange wrapping over the door edge
    const flangeMesh = new THREE.Mesh(box, chromeHardwareMat);
    flangeMesh.scale.set(isVert ? 6 : w, isVert ? h : 5, d * 0.95);
    flangeMesh.position.set(cx, isVert ? cy : cy + h * 0.3, cz);
    flangeMesh.add(new THREE.LineSegments(edges, revealShadowMat));
    tagSubMesh(flangeMesh, userData, comp);
    group.add(flangeMesh);

    // Forward-Projecting Curved Finger-Pull Lip
    const pullLip = new THREE.Mesh(box, chromeHardwareMat);
    pullLip.scale.set(isVert ? 18 : w, isVert ? h : 10, d * 1.05);
    pullLip.position.set(cx, isVert ? cy : cy + h * 0.1, cz + d * 0.32);
    pullLip.add(new THREE.LineSegments(edges, revealShadowMat));
    tagSubMesh(pullLip, userData, comp);
    group.add(pullLip);

    // Dark Underside Finger Shadow Recess
    const underShadow = new THREE.Mesh(box, darkCavityMat);
    underShadow.scale.set(isVert ? 8 : w - 4, isVert ? h - 4 : 6, d * 0.7);
    underShadow.position.set(cx, isVert ? cy : cy - h * 0.2, cz + d * 0.2);
    tagSubMesh(underShadow, userData, comp);
    group.add(underShadow);

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

  // 5.9 TRUE 3D COUNTERTOP / PANEL APERTURE EXTRUSION (Sink & Cooktop See-Through Cutout!)
  if (comp.cutoutHole && comp.cutoutHole.width > 40 && comp.cutoutHole.depth > 40) {
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
          userData?.continuousGrainUv
        )
      : useWorldUvFlatBox
      ? getCachedWorldUvBoxGeometry(
          comp.dimensions.width,
          comp.dimensions.height,
          comp.dimensions.depth,
          isCrossGrain,
          userData?.continuousGrainUv?.offsetXMm || 0,
          userData?.continuousGrainUv?.offsetYMm || 0
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
      String(comp.materialId || "").includes("glass");
    if (
      !isTranslucentGlassFront &&
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
        ? "glass_frame"
        : comp.materialId === "mat_bronze_mirror"
        ? "mirror_door"
        : comp.handleCategory === "decorative_bespoke"
        ? "shaker_frame"
        : "flat_slab");
    const w = comp.dimensions.width;
    const h = comp.dimensions.height;
    const d = comp.dimensions.depth;

    if (activeProfile === "glass_frame" && w > 140 && h > 140) {
      // 1. Füme Cam Vitrin Kapak (`glass_frame`): 4 world-UV perimeter frame bars + true translucent smoked glass center pane!
      mesh.visible = false;
      const frameW = Math.min(54, Math.max(34, Math.round(w * 0.11)));
      const innerW = Math.max(40, w - 2 * frameW);
      const innerH = Math.max(40, h - 2 * frameW);
      const frameMat =
        comp.materialId === "mat_smoked_glass" ? sharedDarkAnodizedFrameMat : material;
      const frameBars = [
        { sx: frameW, sy: h, px: cx - w / 2 + frameW / 2, py: cy, horiz: false },
        { sx: frameW, sy: h, px: cx + w / 2 - frameW / 2, py: cy, horiz: false },
        { sx: innerW, sy: frameW, px: cx, py: cy + h / 2 - frameW / 2, horiz: true },
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
      glassPane.position.set(cx, cy, cz);
      tagSubMesh(glassPane, userData, comp);
      glassPane.castShadow = false; // Allow studio & LED light to illuminate inner shelves & clothes behind smoked glass!
      glassPane.renderOrder = 4;
      group.add(glassPane);
    } else if (activeProfile === "mirror_door" && w > 140 && h > 140) {
      // 2. Aynalı Kapak (`mirror_door`): Crisp slim perimeter bezel + full-height silver/bronze mirror pane!
      const rimW = 14;
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
      const { geo: jpGeo, edges: jpEdges } = getCachedJPullBevelDoorGeometry(w, h, d, isCrossGrain);
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
    } else if (activeProfile === "custom_cad_profile" && w > 140 && h > 140) {
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

export function createModuleGroup(module: ModuleInstance) {
  const placement = calculateModulePlacement(module);
  const group = new THREE.Group();
  group.position.set(placement.origin.x, placement.origin.y, placement.origin.z);
  group.rotation.y = placement.rotationYRad;
  return group;
}
