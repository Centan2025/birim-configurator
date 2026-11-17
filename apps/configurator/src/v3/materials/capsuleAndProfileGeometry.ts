import * as THREE from "three";
import { ModuleInstance } from "@birim/core";
import { markSharedGeometry } from "./webglResourceGuard";

const contouredDoorCache = new Map<
  string,
  { geo: THREE.BufferGeometry; edges: THREE.EdgesGeometry }
>();
const capsuleSlabCache = new Map<
  string,
  { geo: THREE.BufferGeometry; edges: THREE.EdgesGeometry }
>();

function evictOldest<T extends { geo: THREE.BufferGeometry; edges: THREE.EdgesGeometry }>(
  cache: Map<string, T>,
  limit = 64
): void {
  if (cache.size < limit) return;
  const firstKey = cache.keys().next().value;
  if (firstKey !== undefined) {
    const old = cache.get(firstKey);
    if (old) {
      old.geo.dispose();
      old.edges.dispose();
    }
    cache.delete(firstKey);
  }
}

/**
 * Applies world-scale millimeter UV coordinates (600mm repeat unit) to any BufferGeometry
 * using dominant face normal box-projection so wood grain and custom uploaded textures
 * never stretch on multi-stepped, 45°-beveled, or curved capsule surfaces.
 */
export function applyWorldMillimeterBoxUVs(
  geo: THREE.BufferGeometry,
  isCrossGrain = false
): THREE.BufferGeometry {
  geo.computeVertexNormals();
  const pos = geo.getAttribute("position");
  const norm = geo.getAttribute("normal");
  if (!pos || !norm) return geo;

  const uvs = new Float32Array(pos.count * 2);
  const scaleMm = 600;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = Math.abs(norm.getX(i));
    const ny = Math.abs(norm.getY(i));
    const nz = Math.abs(norm.getZ(i));

    let u = 0;
    let v = 0;
    if (ny >= nx && ny >= nz) {
      // Top / bottom horizontal surface (tabletops, shelves)
      u = x / scaleMm;
      v = z / scaleMm;
    } else if (nx >= nz) {
      // Side / curved X-dominant tangent
      u = z / scaleMm;
      v = y / scaleMm;
    } else {
      // Front / back Z-dominant face
      u = x / scaleMm;
      v = y / scaleMm;
    }

    if (isCrossGrain) {
      uvs[i * 2] = v;
      uvs[i * 2 + 1] = u;
    } else {
      uvs[i * 2] = u;
      uvs[i * 2 + 1] = v;
    }
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  return geo;
}

/**
 * Builds a true multi-ring concentric 3D perimeter-swept door geometry from ANY 2D cross-section
 * polygon (`profilePoints` in normalized [0..1] x [0..1], e.g. from `.DXF`, `.SVG`, `.JSON` or cove/ogee presets).
 * - `pt.x` in [0..1]: radial distance from outer perimeter (0 = outer door edge, 1 = inner panel boundary)
 * - `pt.y` in [0..1]: thickness fraction from rear face (`-d/2`) to front peak (`+d/2`)
 */
export function getCachedContouredDoorSweepGeometry(
  w: number,
  h: number,
  d: number,
  profilePoints: { x: number; y: number }[],
  isCrossGrain = false
): { geo: THREE.BufferGeometry; edges: THREE.EdgesGeometry } {
  const cleanPts = (profilePoints || [])
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
    .slice(0, 14)
    .map((p) => ({
      x: Math.max(0, Math.min(1, p.x)),
      y: Math.max(0.15, Math.min(1, p.y)),
    }))
    .sort((a, b) => a.x - b.x);

  const rings =
    cleanPts.length >= 2
      ? cleanPts
      : [
          { x: 0, y: 0.38 },
          { x: 0.28, y: 1.0 },
          { x: 0.62, y: 0.62 },
          { x: 1.0, y: 0.72 },
        ];

  const sig = rings.map((p) => `${Math.round(p.x * 100)}:${Math.round(p.y * 100)}`).join("|");
  const key = `sweep_${Math.round(w)}_${Math.round(h)}_${Math.round(d * 10)}_${isCrossGrain ? 1 : 0}_${sig}`;
  const hit = contouredDoorCache.get(key);
  if (hit) return hit;

  evictOldest(contouredDoorCache);

  const hw = w / 2;
  const hh = h / 2;
  const hd = d / 2;
  const maxInsetMm = Math.min(76, Math.max(22, Math.min(w, h) * 0.18));

  const positions: number[] = [];
  const pushQuad = (
    a: [number, number, number],
    b: [number, number, number],
    c: [number, number, number],
    e: [number, number, number]
  ) => {
    positions.push(...a, ...b, ...c, ...a, ...c, ...e);
  };

  // Ensure ring[0] starts at outer perimeter x=0
  const fullRings = rings[0].x > 0.01 ? [{ x: 0, y: Math.max(0.28, rings[0].y * 0.65) }, ...rings] : rings;

  const ringCorners = fullRings.map((r) => {
    const inset = Math.min(r.x * maxInsetMm, hw - 12, hh - 12);
    const zFront = -hd + d * r.y;
    const rx = hw - inset;
    const ry = hh - inset;
    return [
      [-rx, -ry, zFront] as [number, number, number], // 0: BL
      [rx, -ry, zFront] as [number, number, number],  // 1: BR
      [rx, ry, zFront] as [number, number, number],   // 2: TR
      [-rx, ry, zFront] as [number, number, number],  // 3: TL
    ];
  });

  // 1. Rear flat face (-hd) & 4 outer perimeter shoulder walls (-hd -> ringCorners[0])
  const backCorners: [number, number, number][] = [
    [-hw, -hh, -hd],
    [hw, -hh, -hd],
    [hw, hh, -hd],
    [-hw, hh, -hd],
  ];
  // Back face (normal -Z)
  pushQuad(backCorners[1], backCorners[0], backCorners[3], backCorners[2]);

  const outerFront = ringCorners[0];
  for (let side = 0; side < 4; side++) {
    const next = (side + 1) % 4;
    pushQuad(backCorners[side], backCorners[next], outerFront[next], outerFront[side]);
  }

  // 2. Concentric contoured profile slopes between consecutive rings
  for (let r = 0; r + 1 < ringCorners.length; r++) {
    const cA = ringCorners[r];
    const cB = ringCorners[r + 1];
    for (let side = 0; side < 4; side++) {
      const next = (side + 1) % 4;
      pushQuad(cA[side], cA[next], cB[next], cB[side]);
    }
  }

  // 3. Innermost center panel cap (+Z)
  const inner = ringCorners[ringCorners.length - 1];
  pushQuad(inner[0], inner[1], inner[2], inner[3]);

  let rawGeo = new THREE.BufferGeometry();
  rawGeo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  rawGeo = applyWorldMillimeterBoxUVs(rawGeo, isCrossGrain);

  const geo = markSharedGeometry(rawGeo);
  const edges = markSharedGeometry(new THREE.EdgesGeometry(geo, 18));
  const entry = { geo, edges };
  contouredDoorCache.set(key, entry);
  return entry;
}

/**
 * Builds a precision handleless 45°-sloped integrated J-Pull top-channel door (`j_pull_bevel`).
 */
export function getCachedJPullBevelDoorGeometry(
  w: number,
  h: number,
  d: number,
  isCrossGrain = false
): { geo: THREE.BufferGeometry; edges: THREE.EdgesGeometry } {
  const key = `jpull_${Math.round(w)}_${Math.round(h)}_${Math.round(d * 10)}_${isCrossGrain ? 1 : 0}`;
  const hit = contouredDoorCache.get(key);
  if (hit) return hit;

  evictOldest(contouredDoorCache);

  const hw = w / 2;
  const hh = h / 2;
  const hd = d / 2;
  const grooveH = Math.min(36, Math.max(24, h * 0.06));
  const lipT = Math.max(5, d * 0.28);
  const yGrooveBot = hh - grooveH;
  const zBack = -hd;
  const zLipFront = -hd + lipT;
  const zFront = hd;

  // Extrude Y-Z cross-section along X [-hw .. +hw]
  // Cross section in (Y, Z) CCW when viewed from +X:
  const yzLoop: [number, number][] = [
    [-hh, zBack],
    [-hh, zFront],
    [yGrooveBot - 8, zFront],
    [yGrooveBot, zLipFront],
    [hh, zLipFront],
    [hh, zBack],
  ];

  const positions: number[] = [];
  const pushQuad = (
    a: [number, number, number],
    b: [number, number, number],
    c: [number, number, number],
    e: [number, number, number]
  ) => {
    positions.push(...a, ...b, ...c, ...a, ...c, ...e);
  };

  for (let i = 0; i < yzLoop.length; i++) {
    const [y0, z0] = yzLoop[i];
    const [y1, z1] = yzLoop[(i + 1) % yzLoop.length];
    pushQuad([-hw, y0, z0], [hw, y0, z0], [hw, y1, z1], [-hw, y1, z1]);
  }

  // Left (-hw) and Right (+hw) end caps via fan triangulation from centroid
  const cyAvg = 0;
  const czAvg = 0;
  for (let i = 0; i < yzLoop.length; i++) {
    const [y0, z0] = yzLoop[i];
    const [y1, z1] = yzLoop[(i + 1) % yzLoop.length];
    // Right cap (+X)
    positions.push(hw, cyAvg, czAvg, hw, y0, z0, hw, y1, z1);
    // Left cap (-X)
    positions.push(-hw, cyAvg, czAvg, -hw, y1, z1, -hw, y0, z0);
  }

  let rawGeo = new THREE.BufferGeometry();
  rawGeo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  rawGeo = applyWorldMillimeterBoxUVs(rawGeo, isCrossGrain);

  const geo = markSharedGeometry(rawGeo);
  const edges = markSharedGeometry(new THREE.EdgesGeometry(geo, 16));
  const entry = { geo, edges };
  contouredDoorCache.set(key, entry);
  return entry;
}

/**
 * Builds a true stadium / capsule horizontal slab (`THREE.ExtrudeGeometry` rotated into X-Z plane)
 * with radius `R = min(cornerRadiusMm, depthMm / 2)` and optional 45° Swiss-edge bottom chamfer.
 */
export function getCachedCapsuleStadiumSlabGeometry(
  widthMm: number,
  depthMm: number,
  thicknessMm: number,
  cornerRadiusMm?: number,
  swissEdgeBevelMm = 0
): { geo: THREE.BufferGeometry; edges: THREE.EdgesGeometry } {
  const r = Math.max(20, Math.min(depthMm / 2, widthMm / 2, cornerRadiusMm ?? depthMm / 2));
  const key = `capslab_${Math.round(widthMm)}_${Math.round(depthMm)}_${Math.round(thicknessMm)}_${Math.round(r)}_${Math.round(swissEdgeBevelMm)}`;
  const hit = capsuleSlabCache.get(key);
  if (hit) return hit;

  evictOldest(capsuleSlabCache);

  const hw = widthMm / 2;
  const hd = depthMm / 2;
  const shape = new THREE.Shape();

  if (Math.abs(r - hd) <= 2 && widthMm >= depthMm) {
    // True Stadium / Capsule (two full 180° semicircular end-caps!)
    const straightHalf = Math.max(0, hw - hd);
    shape.moveTo(-straightHalf, -hd);
    shape.lineTo(straightHalf, -hd);
    shape.absarc(straightHalf, 0, hd, -Math.PI / 2, Math.PI / 2, false);
    shape.lineTo(-straightHalf, hd);
    shape.absarc(-straightHalf, 0, hd, Math.PI / 2, (3 * Math.PI) / 2, false);
  } else {
    // Rounded-corner architectural capsule/island rectangle
    shape.moveTo(-hw + r, -hd);
    shape.lineTo(hw - r, -hd);
    shape.absarc(hw - r, -hd + r, r, -Math.PI / 2, 0, false);
    shape.lineTo(hw, hd - r);
    shape.absarc(hw - r, hd - r, r, 0, Math.PI / 2, false);
    shape.lineTo(-hw + r, hd);
    shape.absarc(-hw + r, hd - r, r, Math.PI / 2, Math.PI, false);
    shape.lineTo(-hw, -hd + r);
    shape.absarc(-hw + r, -hd + r, r, Math.PI, (3 * Math.PI) / 2, false);
  }

  const bev = Math.min(swissEdgeBevelMm, thicknessMm * 0.42);
  const ext = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(4, thicknessMm - bev),
    bevelEnabled: bev > 0.5,
    bevelThickness: bev,
    bevelSize: bev,
    bevelSegments: 2,
    curveSegments: 28,
  });

  // Rotate from X-Y extrude (+Z) into horizontal X-Z slab centered at origin (0, 0, 0)
  ext.rotateX(-Math.PI / 2);
  ext.computeBoundingBox();
  if (ext.boundingBox) {
    const center = new THREE.Vector3();
    ext.boundingBox.getCenter(center);
    ext.translate(-center.x, -center.y, -center.z);
  }
  applyWorldMillimeterBoxUVs(ext, false);

  const geo = markSharedGeometry(ext);
  const edges = markSharedGeometry(new THREE.EdgesGeometry(geo, 22));
  const entry = { geo, edges };
  capsuleSlabCache.set(key, entry);
  return entry;
}

const sharedTrackGrooveMat = new THREE.MeshStandardMaterial({
  color: "#1B1917",
  roughness: 0.88,
  metalness: 0.08,
});
const sharedAcousticFeltMat = new THREE.MeshStandardMaterial({
  color: "#1F1D1B",
  roughness: 0.96,
  metalness: 0.0,
});
const sharedClearGlassShelfMat = new THREE.MeshPhysicalMaterial({
  color: "#E8F1F2",
  roughness: 0.06,
  metalness: 0.02,
  transmission: 0.72,
  transparent: true,
  opacity: 0.52,
});
const sharedSteelApronMat = new THREE.MeshStandardMaterial({
  color: "#1E1E1C",
  roughness: 0.42,
  metalness: 0.72,
});
const sharedWarmLedMat = new THREE.MeshBasicMaterial({
  color: "#FFF1C9",
});

interface TrackPathSegment {
  length: number;
  evalAt: (localS: number) => { x: number; z: number; rotY: number };
}

function samplePiecewiseTrack(
  segments: TrackPathSegment[],
  sMm: number
): { x: number; z: number; rotY: number } {
  let rem = Math.max(0, sMm);
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (rem <= seg.length || i === segments.length - 1) {
      return seg.evalAt(Math.min(seg.length, rem));
    }
    rem -= seg.length;
  }
  return { x: 0, z: 0, rotY: 0 };
}

/**
 * Builds a complete, production-accurate interactive 3D PBR `THREE.Group` for parametric curved/tambour modules:
 * - `capsule_stadium`: Kapsül Tamburlu Bar Dolabı / Tambur TV Ünitesi (180° stadyum CNC kanal + kerf cep koridoru)
 * - `rounded_corners`: R-Köşeli Tambur TV Konsolu / Büfe (4×90° CNC kerf köşe + kavisli tambur kapak)
 * - `capsule_table`: Kapsül Stadyum Yemek / Toplantı Masası (Swiss-edge tabla + çelik travers + yivli sütun ayaklar)
 * Strictly synchronized 1:1 in dimensions, heights, bays, shelves, and drawers with `mesh-generator.ts`!
 */
export function buildCapsuleParametricModuleGroup(
  mod: ModuleInstance,
  resolveMat: (matId: string, isMetal?: boolean) => THREE.Material,
  edgeMat: THREE.LineBasicMaterial,
  modIdx: number,
  doorOpenAngleDeg: number,
  drawerOpenMm = 0
): THREE.Group {
  const root = new THREE.Group();
  const W = mod.dimensions.width;
  const H = mod.dimensions.height;
  const D = mod.dimensions.depth;
  const T = mod.carcass.panelThickness || 18;
  const isRoundedRect = mod.carcass.hullShape === "rounded_corners";
  const maxAllowedR = Math.max(40, Math.min(D / 2, W / 2 - 40));
  const R = isRoundedRect
    ? Math.max(65, Math.min(Math.max(65, D / 2 - 20), maxAllowedR, mod.carcass.cornerRadiusMm || 110))
    : mod.carcass.hullShape === "capsule_table"
    ? Math.max(80, Math.min(maxAllowedR, mod.carcass.cornerRadiusMm || D / 2))
    : maxAllowedR;
  const cx = W / 2;
  const cz = D / 2;

  const bodyMat = resolveMat(mod.carcass.bodyMaterialId || "mat_veneer_walnut", false);
  const doorMat = resolveMat(mod.carcass.doorMaterialId || mod.carcass.bodyMaterialId || "mat_veneer_walnut", false);
  const topMat = resolveMat(
    mod.carcass.countertopMaterialId || mod.carcass.doorMaterialId || "mat_stone_calacatta",
    false
  );
  const brassMat = resolveMat(mod.carcass.plinthMaterialId || "mat_metal_brass", true);

  const tagMesh = (
    m: THREE.Object3D,
    compId: string,
    role: string,
    label: string,
    bayIdx = 0,
    dimsOverride?: string
  ) => {
    m.userData = {
      componentId: compId,
      moduleIndex: modIdx,
      bayIndex: bayIdx,
      role,
      label,
      dimsText: dimsOverride || `${W}×${H}×${D} mm`,
    };
  };

  // =========================================================================
  // CASE A: CAPSULE STADIUM DINING / MEETING TABLE (`capsule_table`)
  // =========================================================================
  if (mod.carcass.hullShape === "capsule_table") {
    const topThick = mod.carcass.topPanelThicknessMm || mod.attachedTableConfig?.topThicknessMm || 36;
    const pedH = Math.max(120, H - topThick);
    const { geo: topGeo, edges: topEdges } = getCachedCapsuleStadiumSlabGeometry(
      W,
      D,
      topThick,
      R,
      Math.min(12, topThick * 0.32)
    );
    const topMesh = new THREE.Mesh(topGeo, topMat);
    topMesh.position.set(cx, pedH + topThick / 2, cz);
    topMesh.castShadow = true;
    topMesh.receiveShadow = true;
    topMesh.add(new THREE.LineSegments(topEdges, edgeMat));
    tagMesh(
      topMesh,
      `${mod.id}_capsule_table_top`,
      "countertop",
      `Kapsül Masa Üst Tablası (${W}×${D}×${topThick}mm)`,
      0,
      `${W}×${topThick}×${D} mm`
    );
    root.add(topMesh);

    const pedR = Math.round(Math.min(185, Math.max(95, D * 0.21)));
    const pedCount = W >= 1450 ? 2 : 1;
    const pedPositionsX =
      pedCount === 1
        ? [cx]
        : [Math.max(pedR + 90, Math.round(W * 0.26)), Math.min(W - pedR - 90, Math.round(W * 0.74))];

    // Structural matte-black steel anti-sag apron beam + circular mounting flanges underneath top
    if (pedPositionsX.length >= 2) {
      const spanBeamW = Math.max(240, pedPositionsX[1] - pedPositionsX[0] + pedR);
      const apronBeam = new THREE.Mesh(
        new THREE.BoxGeometry(spanBeamW, 28, 76),
        sharedSteelApronMat
      );
      apronBeam.position.set(cx, pedH - 14, cz);
      apronBeam.castShadow = true;
      tagMesh(apronBeam, `${mod.id}_table_steel_apron`, "special_fitting", "Çelik Sarkma Önleyici Masa Traversi");
      root.add(apronBeam);
    }

    const ribCount = Math.max(20, Math.round((2 * Math.PI * pedR) / 24));
    const ribGeo = applyWorldMillimeterBoxUVs(new THREE.BoxGeometry(14, Math.max(80, pedH - 22), 10), false);

    pedPositionsX.forEach((px, idx) => {
      // Upper steel mounting flange plate
      const topFlange = new THREE.Mesh(
        new THREE.CylinderGeometry(pedR + 22, pedR + 22, 6, 28),
        sharedSteelApronMat
      );
      topFlange.position.set(px, pedH - 3, cz);
      tagMesh(topFlange, `${mod.id}_pedestal_flange_${idx + 1}`, "special_fitting", `Sütun Çelik Bağlantı Flanşı #${idx + 1}`);
      root.add(topFlange);

      // Kerf-bent cylindrical wooden core + internal circular discs
      const coreCyl = new THREE.Mesh(
        applyWorldMillimeterBoxUVs(new THREE.CylinderGeometry(pedR - 4, pedR - 4, Math.max(80, pedH - 16), 32), false),
        doorMat
      );
      coreCyl.position.set(px, 12 + (pedH - 16) / 2, cz);
      coreCyl.castShadow = true;
      coreCyl.receiveShadow = true;
      tagMesh(
        coreCyl,
        `${mod.id}_kerf_pedestal_${idx + 1}`,
        "kerf_curve",
        `Silindirik Kapsül Sütun Ayak #${idx + 1} (Ø${pedR * 2}mm)`
      );
      root.add(coreCyl);

      const instRibs = new THREE.InstancedMesh(ribGeo, doorMat, ribCount);
      const mtx = new THREE.Matrix4();
      for (let s = 0; s < ribCount; s++) {
        const ang = (s / ribCount) * Math.PI * 2;
        const rx = px + Math.cos(ang) * pedR;
        const rz = cz + Math.sin(ang) * pedR;
        mtx.makeRotationY(-ang + Math.PI / 2);
        mtx.setPosition(rx, 12 + (pedH - 16) / 2, rz);
        instRibs.setMatrixAt(s, mtx);
      }
      instRibs.instanceMatrix.needsUpdate = true;
      instRibs.castShadow = true;
      instRibs.receiveShadow = true;
      tagMesh(instRibs, `${mod.id}_pedestal_ribs_${idx + 1}`, "kerf_curve", `Yivli Sütun Yüzeyi #${idx + 1}`);
      root.add(instRibs);

      // Brushed brass / metal plinth collar ring + concealed floor glides
      const baseRing = new THREE.Mesh(new THREE.CylinderGeometry(pedR + 8, pedR + 11, 14, 32), brassMat);
      baseRing.position.set(px, 7, cz);
      tagMesh(baseRing, `${mod.id}_pedestal_ring_${idx + 1}`, "plinth", `Metal Sütun Baza Bileziği #${idx + 1}`);
      root.add(baseRing);
    });

    return root;
  }

  // =========================================================================
  // CASE B: PRODUCTION TAMBOUR SYSTEM (`capsule_stadium` & `rounded_corners`)
  // =========================================================================
  const legH = Math.max(0, mod.carcass.plinthHeight ?? 0);
  const hasTopTray = Boolean(
    mod.carcass.countertopMaterialId && mod.carcass.hasCountertopTray !== false
  );
  const topTrayT = hasTopTray ? 20 : 0;
  const bodyH = Math.max(180, H - legH - topTrayT);
  const innerClearH = Math.max(120, bodyH - 2 * T);
  const yBot = legH;
  const yTop = legH + bodyH;
  const straightSpanW = Math.max(0, W - 2 * R);
  const flatSideZ = Math.max(0, D - 2 * R);
  const trackInsetMm = 18;
  const pocketCorridorMm = 32;
  const pocketOuterR = Math.max(52, R - pocketCorridorMm);

  // 1. Turned Architectural Legs (4 or 6 legs for wide TV units) OR Recessed Contoured Plinth
  if (legH >= 85) {
    const legInsetX = Math.max(R * 0.72, 130);
    const legInsetZ = Math.max(68, D * 0.2);
    const legCoords: [number, number][] = [
      [legInsetX, legInsetZ],
      [W - legInsetX, legInsetZ],
      [legInsetX, D - legInsetZ],
      [W - legInsetX, D - legInsetZ],
    ];
    if (W >= 1800) {
      legCoords.push([cx, legInsetZ], [cx, D - legInsetZ]);
    }
    legCoords.forEach(([lx, lz], i) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(15, 10, legH - 6, 20), brassMat);
      leg.position.set(lx, (legH - 6) / 2 + 3, lz);
      leg.castShadow = true;
      tagMesh(leg, `${mod.id}_leg_${i}`, "plinth", `Torna Metal Ayak #${i + 1}`);
      root.add(leg);

      const topPlate = new THREE.Mesh(new THREE.CylinderGeometry(28, 28, 5, 20), brassMat);
      topPlate.position.set(lx, legH - 2.5, lz);
      root.add(topPlate);

      const footPad = new THREE.Mesh(new THREE.CylinderGeometry(12, 13, 4, 16), sharedAcousticFeltMat);
      footPad.position.set(lx, 2, lz);
      root.add(footPad);
    });
    if (legH >= 130 && W >= 800) {
      const crossBar = new THREE.Mesh(
        new THREE.BoxGeometry(Math.max(180, W - 2 * legInsetX), 12, 12),
        brassMat
      );
      crossBar.position.set(cx, legH * 0.36, cz);
      tagMesh(crossBar, `${mod.id}_leg_crossbar`, "plinth", "Alt Metal Gergi Kayıdı");
      root.add(crossBar);
    }
  } else if (legH > 0) {
    const { geo: plGeo } = getCachedCapsuleStadiumSlabGeometry(
      Math.max(160, W - 70),
      Math.max(140, D - 70),
      legH,
      Math.max(24, R - 35),
      0
    );
    const plinth = new THREE.Mesh(plGeo, brassMat);
    plinth.position.set(cx, legH / 2, cz);
    plinth.castShadow = true;
    tagMesh(plinth, `${mod.id}_capsule_plinth`, "plinth", "Geri Çekmeli Kavisli Baza");
    root.add(plinth);
  }

  // 2. Contoured Bottom & Top Slabs + Visible 8.5×7.5mm CNC Tambour Guide Groove Loop!
  const { geo: carcassSlabGeo, edges: carcassSlabEdges } = getCachedCapsuleStadiumSlabGeometry(
    W,
    D,
    T,
    R,
    0
  );
  const botSlab = new THREE.Mesh(carcassSlabGeo, doorMat);
  botSlab.position.set(cx, yBot + T / 2, cz);
  botSlab.castShadow = true;
  botSlab.receiveShadow = true;
  botSlab.add(new THREE.LineSegments(carcassSlabEdges, edgeMat));
  tagMesh(botSlab, `${mod.id}_capsule_bottom`, "carcass_bottom", "CNC Kontur Alt Tabla");
  root.add(botSlab);

  const topCarcassSlab = new THREE.Mesh(carcassSlabGeo, doorMat);
  topCarcassSlab.position.set(cx, yTop - T / 2, cz);
  topCarcassSlab.castShadow = true;
  topCarcassSlab.receiveShadow = true;
  topCarcassSlab.add(new THREE.LineSegments(carcassSlabEdges, edgeMat));
  tagMesh(topCarcassSlab, `${mod.id}_capsule_top`, "carcass_top", "CNC Kontur Üst Tabla");
  root.add(topCarcassSlab);

  // Recessed CNC Guide Track Ring Visualization on Top of Bottom Slab & Underside of Top Slab
  if (!mod.isOpenFront) {
    const rTrack = Math.max(30, R - trackInsetMm);
    const trackOuterW = W - 2 * (trackInsetMm - 4);
    const trackOuterD = D - 2 * (trackInsetMm - 4);
    const { geo: trackRingGeo } = getCachedCapsuleStadiumSlabGeometry(
      trackOuterW,
      trackOuterD,
      1.6,
      rTrack + 4,
      0
    );
    const botTrack = new THREE.Mesh(trackRingGeo, sharedTrackGrooveMat);
    botTrack.position.set(cx, yBot + T + 0.5, cz);
    tagMesh(botTrack, `${mod.id}_cnc_track_bot`, "special_fitting", "8.5×7.5mm CNC Tambur Kılavuz Kanalı");
    root.add(botTrack);

    const topTrack = new THREE.Mesh(trackRingGeo, sharedTrackGrooveMat);
    topTrack.position.set(cx, yTop - T - 0.5, cz);
    root.add(topTrack);
  }

  // Optional 20mm Recessed Stone/Marble Top Tray (`hasTopTray`)
  if (hasTopTray && topTrayT > 0) {
    const trayInset = 8;
    const trayW = Math.max(160, W - 2 * trayInset);
    const trayD = Math.max(140, D - 2 * trayInset);
    const trayR = Math.max(40, R - trayInset);
    const { geo: counterGeo, edges: counterEdges } = getCachedCapsuleStadiumSlabGeometry(
      trayW,
      trayD,
      topTrayT,
      trayR,
      4
    );
    const counterMesh = new THREE.Mesh(counterGeo, topMat);
    counterMesh.position.set(cx, yTop + topTrayT / 2, cz);
    counterMesh.castShadow = true;
    counterMesh.receiveShadow = true;
    counterMesh.add(new THREE.LineSegments(counterEdges, edgeMat));
    tagMesh(
      counterMesh,
      `${mod.id}_capsule_marble_top`,
      "countertop",
      `Üst Mermer / Kuvars Tabla (${trayW}×${trayD}×${topTrayT}mm)`
    );
    root.add(counterMesh);
  }

  // 3. Internal Curved CNC Kerf-Bent Pocket Shells (Creates real 32mm lateral pocket corridor!)
  const midInnerY = yBot + T + innerClearH / 2;
  if (isRoundedRect) {
    // 4 quarter-cylinders at the 4 rounded corners + 2 flat side pocket walls
    const cornerDefs: { cx: number; cz: number; thetaStart: number; label: string }[] = [
      { cx: R, cz: D - R, thetaStart: Math.PI * 1.5, label: "Sol Ön R-Köşe Kerf Cep Duvarı" },
      { cx: R, cz: R, thetaStart: Math.PI, label: "Sol Arka R-Köşe Kerf Cep Duvarı" },
      { cx: W - R, cz: R, thetaStart: Math.PI * 0.5, label: "Sağ Arka R-Köşe Kerf Cep Duvarı" },
      { cx: W - R, cz: D - R, thetaStart: 0, label: "Sağ Ön R-Köşe Kerf Cep Duvarı" },
    ];
    cornerDefs.forEach((cd, idx) => {
      const qGeo = new THREE.CylinderGeometry(
        pocketOuterR,
        pocketOuterR,
        innerClearH,
        16,
        1,
        true,
        cd.thetaStart,
        Math.PI * 0.5
      );
      const qMat = bodyMat.clone();
      qMat.side = THREE.DoubleSide;
      const qMesh = new THREE.Mesh(qGeo, qMat);
      qMesh.position.set(cd.cx, midInnerY, cd.cz);
      tagMesh(qMesh, `${mod.id}_kerf_corner_${idx + 1}`, "kerf_curve", cd.label);
      root.add(qMesh);
    });
    if (flatSideZ >= 60) {
      [pocketCorridorMm + T / 2, W - pocketCorridorMm - T / 2].forEach((sx, si) => {
        const sideWall = new THREE.Mesh(
          applyWorldMillimeterBoxUVs(new THREE.BoxGeometry(T, innerClearH, flatSideZ), false),
          bodyMat
        );
        sideWall.position.set(sx, midInnerY, cz);
        tagMesh(sideWall, `${mod.id}_rounded_side_wall_${si + 1}`, "carcass_divider", `Yan Cep İç Duvarı #${si + 1}`);
        root.add(sideWall);
      });
    }
  } else {
    // 2 × 180° semicircular kerf-bent inner pocket walls at x = R and x = W - R
    const doubleBodyMat = bodyMat.clone();
    doubleBodyMat.side = THREE.DoubleSide;
    const leftShell = new THREE.Mesh(
      new THREE.CylinderGeometry(pocketOuterR, pocketOuterR, innerClearH, 28, 1, true, Math.PI, Math.PI),
      doubleBodyMat
    );
    leftShell.position.set(R, midInnerY, cz);
    tagMesh(leftShell, `${mod.id}_kerf_curve_1`, "kerf_curve", "Sol Kavisli Kerf İç Cep Gövdesi");
    root.add(leftShell);

    const rightShell = new THREE.Mesh(
      new THREE.CylinderGeometry(pocketOuterR, pocketOuterR, innerClearH, 28, 1, true, 0, Math.PI),
      doubleBodyMat
    );
    rightShell.position.set(W - R, midInnerY, cz);
    tagMesh(rightShell, `${mod.id}_kerf_curve_2`, "kerf_curve", "Sağ Kavisli Kerf İç Cep Gövdesi");
    root.add(rightShell);
  }

  // 4. Internal Tangent Bulkheads, Rear Back Panel (with Cable Cutout on TV Units), Bays, Dividers, Shelves & Drawers!
  const zRearBack = pocketCorridorMm;
  const zInnerStart = zRearBack + T;
  const zInnerFrontLimit = Math.max(zInnerStart + 120, D - 34);
  const netInnerD = Math.max(120, zInnerFrontLimit - zInnerStart);
  const centerLeftX = Math.min(R, Math.max(pocketCorridorMm + T, R));
  const centerRightX = Math.max(centerLeftX + 2 * T + 100, W - R);
  const centerSpanW = Math.max(120, centerRightX - centerLeftX);

  if (straightSpanW >= 120) {
    [centerLeftX + T / 2, centerRightX - T / 2].forEach((bx, bi) => {
      const bulk = new THREE.Mesh(
        applyWorldMillimeterBoxUVs(new THREE.BoxGeometry(T, innerClearH, netInnerD), false),
        bodyMat
      );
      bulk.position.set(bx, midInnerY, zInnerStart + netInnerD / 2);
      bulk.castShadow = true;
      bulk.receiveShadow = true;
      tagMesh(bulk, `${mod.id}_capsule_bulkhead_${bi + 1}`, "carcass_divider", `İç Taşıyıcı Dikme #${bi + 1}`);
      root.add(bulk);
    });

    const backWall = new THREE.Mesh(
      applyWorldMillimeterBoxUVs(new THREE.BoxGeometry(centerSpanW, innerClearH, T), false),
      bodyMat
    );
    backWall.position.set(centerLeftX + centerSpanW / 2, midInnerY, zRearBack + T / 2);
    backWall.receiveShadow = true;
    tagMesh(backWall, `${mod.id}_capsule_center_back`, "carcass_back", "Orta Düz Arkalık Paneli");
    root.add(backWall);

    // Render brushed cable grommet escutcheon if TV cable cutout exists
    if ((mod.utilityCutouts || []).some((co) => co.kind === "cable_grommet")) {
      const grommet = new THREE.Mesh(
        new THREE.BoxGeometry(160, 52, T + 4),
        sharedTrackGrooveMat
      );
      grommet.position.set(cx, yBot + T + Math.min(innerClearH - 45, innerClearH * 0.68), zRearBack + T / 2);
      tagMesh(grommet, `${mod.id}_cable_grommet`, "special_fitting", "Medya Kablo Geçiş Menfezi");
      root.add(grommet);
    }
  }

  // Bay layout & real interior components
  const bayCount = Math.max(1, mod.bays.length);
  const availBaysClearW = Math.max(
    120,
    (straightSpanW >= 120 ? centerSpanW - 2 * T : W - 2 * (pocketCorridorMm + T)) - (bayCount - 1) * T
  );
  const bayZoneOriginX = straightSpanW >= 120 ? centerLeftX + T : pocketCorridorMm + T;
  const rawRatios = mod.bays.map((b) =>
    b.customWidth && b.customWidth > 60 ? b.customWidth : Math.max(100, availBaysClearW / bayCount)
  );
  const ratioSum = rawRatios.reduce((a, b) => a + b, 0) || 1;
  const computedBayClearWs = rawRatios.map((r) => Math.max(80, Math.round((availBaysClearW * r) / ratioSum)));
  const diffW = availBaysClearW - computedBayClearWs.reduce((a, b) => a + b, 0);
  if (computedBayClearWs.length > 0) {
    computedBayClearWs[computedBayClearWs.length - 1] = Math.max(
      80,
      computedBayClearWs[computedBayClearWs.length - 1] + diffW
    );
  }

  let cursorBayX = bayZoneOriginX;
  const bayStartsX: number[] = [];
  mod.bays.forEach((bay, bi) => {
    const bClearW = computedBayClearWs[bi] || availBaysClearW;
    bayStartsX.push(cursorBayX);

    if (bi > 0) {
      const divMesh = new THREE.Mesh(
        applyWorldMillimeterBoxUVs(new THREE.BoxGeometry(T, innerClearH, netInnerD), false),
        bodyMat
      );
      divMesh.position.set(cursorBayX - T / 2, midInnerY, zInnerStart + netInnerD / 2);
      divMesh.castShadow = true;
      divMesh.receiveShadow = true;
      tagMesh(divMesh, `${mod.id}_capsule_bay_div_${bi}`, "carcass_divider", `Ara Bölme Dikmesi #${bi}`, bi);
      root.add(divMesh);
    }

    // Real Shelves
    (bay.shelves || []).forEach((sh, si) => {
      if (sh.isHidden) return;
      const shT = sh.thickness || (sh.isGlass ? 8 : T);
      const clampedElev = Math.max(32, Math.min(innerClearH - shT - 24, sh.elevationY));
      const shD = Math.max(100, netInnerD - 8);
      const shMesh = new THREE.Mesh(
        sh.isGlass
          ? new THREE.BoxGeometry(bClearW, shT, shD)
          : applyWorldMillimeterBoxUVs(new THREE.BoxGeometry(bClearW, shT, shD), true),
        sh.isGlass ? sharedClearGlassShelfMat : bodyMat
      );
      const shY = yBot + T + clampedElev + shT / 2;
      shMesh.position.set(cursorBayX + bClearW / 2, shY, zInnerStart + 4 + shD / 2);
      shMesh.castShadow = !sh.isGlass;
      shMesh.receiveShadow = true;
      tagMesh(shMesh, sh.id || `${mod.id}_cap_shelf_${bi}_${si}`, "shelf", `Bölme ${bi + 1} Raf ${si + 1}`, bi);
      root.add(shMesh);

      if (mod.carcass.ledLightingEnabled) {
        const ledBar = new THREE.Mesh(
          new THREE.BoxGeometry(Math.max(60, bClearW - 24), 3, 8),
          sharedWarmLedMat
        );
        ledBar.position.set(cursorBayX + bClearW / 2, shY - shT / 2 - 1.6, zInnerStart + shD - 42);
        root.add(ledBar);
      }
    });

    // Real Drawers (Media Console Drawers & Internal Buffet Drawers)
    (bay.drawers || []).forEach((dr, di) => {
      if (dr.isHidden) return;
      const drFrontH = Math.max(80, Math.min(innerClearH - 8, dr.height));
      const drElev = Math.max(0, Math.min(innerClearH - drFrontH, dr.elevationY));
      const isBehindTambour = bay.door?.type !== "open" && !mod.isOpenFront;
      const frontZ = isBehindTambour ? zInnerFrontLimit - T : D - trackInsetMm - T;
      const boxDepth = Math.max(180, Math.floor((frontZ - zInnerStart - 16) / 25) * 25);
      const pullZ = Math.min(boxDepth * 0.75, Math.max(0, drawerOpenMm));
      const boxH = Math.max(60, drFrontH - 36);
      const drMat = dr.frontMaterialId ? resolveMat(dr.frontMaterialId, false) : doorMat;
      const baseY = yBot + T + drElev;

      const frontMesh = new THREE.Mesh(
        applyWorldMillimeterBoxUVs(new THREE.BoxGeometry(Math.max(80, bClearW - 4), drFrontH - 4, T), true),
        drMat
      );
      frontMesh.position.set(cursorBayX + bClearW / 2, baseY + drFrontH / 2, frontZ + T / 2 + pullZ);
      frontMesh.castShadow = true;
      frontMesh.receiveShadow = true;
      frontMesh.add(
        new THREE.LineSegments(
          new THREE.EdgesGeometry(frontMesh.geometry),
          edgeMat
        )
      );
      tagMesh(frontMesh, `${dr.id}_front`, "drawer_front", `Bölme ${bi + 1} Çekmece ${di + 1}`, bi);
      root.add(frontMesh);

      const boxBody = new THREE.Mesh(
        new THREE.BoxGeometry(Math.max(70, bClearW - 26), boxH, boxDepth),
        bodyMat
      );
      boxBody.position.set(
        cursorBayX + bClearW / 2,
        baseY + 10 + boxH / 2,
        frontZ - boxDepth / 2 + pullZ
      );
      tagMesh(boxBody, `${dr.id}_bottom`, "drawer_box", `Çekmece Kasası B${bi + 1}.${di + 1}`, bi);
      root.add(boxBody);
    });

    cursorBayX += bClearW + T;
  });

  // 5. TRUE ARC-LENGTH PARAMETERIZED SLIDING CURVED TAMBOUR DOORS!
  // Constant slat count, constant physical slat width, tangential tracking along the exact CNC stadium/rounded-rect groove!
  const anyClosedDoor = !mod.isOpenFront && mod.bays.some((b) => b.door?.type !== "open");
  if (anyClosedDoor) {
    const rTrack = Math.max(30, R - trackInsetMm);
    const hasOpenCenterMediaBay =
      mod.bays.length >= 3 &&
      mod.bays[0]?.door?.type !== "open" &&
      mod.bays[1]?.door?.type === "open" &&
      mod.bays[mod.bays.length - 1]?.door?.type !== "open";

    const leftMeetingX = hasOpenCenterMediaBay
      ? Math.max(R + 40, bayStartsX[1] - T / 2)
      : cx - 1.5;
    const rightMeetingX = hasOpenCenterMediaBay
      ? Math.min(W - R - 40, bayStartsX[mod.bays.length - 1] - T / 2)
      : cx + 1.5;

    const frontStraightLeft = Math.max(0, leftMeetingX - R);
    const frontStraightRight = Math.max(0, W - R - rightMeetingX);
    const quarterArcLen = 0.5 * Math.PI * rTrack;
    const rearPocketStraight = Math.max(120, W * 0.45);

    // Left Track Piecewise Path: s=0 at leftMeetingX on front -> front-left curve -> left side -> rear-left curve -> rear pocket
    const leftSegments: TrackPathSegment[] = [
      {
        length: frontStraightLeft,
        evalAt: (s) => ({ x: leftMeetingX - s, z: D - trackInsetMm, rotY: 0 }),
      },
      {
        length: quarterArcLen,
        evalAt: (s) => {
          const ang = Math.PI * 0.5 + s / rTrack; // PI/2 -> PI
          return {
            x: R + Math.cos(ang) * rTrack,
            z: D - R + Math.sin(ang) * rTrack,
            rotY: -(ang - Math.PI * 0.5),
          };
        },
      },
      ...(flatSideZ > 0.5
        ? [
            {
              length: flatSideZ,
              evalAt: (s: number) => ({
                x: trackInsetMm,
                z: D - R - s,
                rotY: -Math.PI * 0.5,
              }),
            },
          ]
        : []),
      {
        length: quarterArcLen,
        evalAt: (s) => {
          const ang = Math.PI + s / rTrack; // PI -> 1.5*PI
          return {
            x: R + Math.cos(ang) * rTrack,
            z: R + Math.sin(ang) * rTrack,
            rotY: -(ang - Math.PI * 0.5),
          };
        },
      },
      {
        length: rearPocketStraight,
        evalAt: (s) => ({ x: R + s, z: trackInsetMm, rotY: Math.PI }),
      },
    ];

    // Right Track Piecewise Path: s=0 at rightMeetingX on front -> front-right curve -> right side -> rear-right curve -> rear pocket
    const rightSegments: TrackPathSegment[] = [
      {
        length: frontStraightRight,
        evalAt: (s) => ({ x: rightMeetingX + s, z: D - trackInsetMm, rotY: 0 }),
      },
      {
        length: quarterArcLen,
        evalAt: (s) => {
          const ang = Math.PI * 0.5 - s / rTrack; // PI/2 -> 0
          return {
            x: W - R + Math.cos(ang) * rTrack,
            z: D - R + Math.sin(ang) * rTrack,
            rotY: Math.PI * 0.5 - ang,
          };
        },
      },
      ...(flatSideZ > 0.5
        ? [
            {
              length: flatSideZ,
              evalAt: (s: number) => ({
                x: W - trackInsetMm,
                z: D - R - s,
                rotY: Math.PI * 0.5,
              }),
            },
          ]
        : []),
      {
        length: quarterArcLen,
        evalAt: (s) => {
          const ang = -s / rTrack; // 0 -> -PI/2
          return {
            x: W - R + Math.cos(ang) * rTrack,
            z: R + Math.sin(ang) * rTrack,
            rotY: Math.PI * 0.5 - ang,
          };
        },
      },
      {
        length: rearPocketStraight,
        evalAt: (s) => ({ x: W - R - s, z: trackInsetMm, rotY: Math.PI }),
      },
    ];

    const slatPitch = Math.max(15, Math.min(40, mod.carcass.tambourSlatPitchMm || 22));
    const slatW = Math.max(12, slatPitch - 2.4);
    const slatH = Math.max(80, innerClearH + 4);
    const slatThick = 13;

    // Each curtain wraps from its front meeting edge around the entire side curve (180° = 2*quarterArc + flatSideZ) when closed!
    const sideFullCurveLen = 2 * quarterArcLen + flatSideZ;
    const leftCurtainLen = frontStraightLeft + sideFullCurveLen;
    const rightCurtainLen = frontStraightRight + sideFullCurveLen;

    const leftSlatCount = Math.max(6, Math.floor(leftCurtainLen / slatPitch));
    const rightSlatCount = Math.max(6, Math.floor(rightCurtainLen / slatPitch));

    const openRatio = Math.max(0, Math.min(0.92, doorOpenAngleDeg / 85));
    const leftSlideShiftMm = openRatio * Math.max(80, frontStraightLeft + quarterArcLen * 0.35);
    const rightSlideShiftMm = openRatio * Math.max(80, frontStraightRight + quarterArcLen * 0.35);

    const slatGeo = applyWorldMillimeterBoxUVs(new THREE.BoxGeometry(slatW, slatH, slatThick), false);
    const feltGeo = new THREE.BoxGeometry(slatPitch + 0.4, slatH - 8, 2.2);

    const totalSlats = leftSlatCount + rightSlatCount;
    const instSlats = new THREE.InstancedMesh(slatGeo, doorMat, totalSlats);
    const instFelt = new THREE.InstancedMesh(feltGeo, sharedAcousticFeltMat, totalSlats);

    const tmpMtx = new THREE.Matrix4();
    const tmpFeltMtx = new THREE.Matrix4();
    let instanceIdx = 0;

    // Populate Left Tambour Curtain
    for (let i = 0; i < leftSlatCount; i++) {
      const s = leftSlideShiftMm + (i + 0.5) * slatPitch;
      const pose = samplePiecewiseTrack(leftSegments, s);
      tmpMtx.makeRotationY(pose.rotY);
      tmpMtx.setPosition(pose.x, midInnerY, pose.z);
      instSlats.setMatrixAt(instanceIdx, tmpMtx);

      // Acoustic felt backing sits 5.5mm inward along local -Z normal
      const inX = -Math.sin(pose.rotY) * 5.5;
      const inZ = -Math.cos(pose.rotY) * 5.5;
      tmpFeltMtx.makeRotationY(pose.rotY);
      tmpFeltMtx.setPosition(pose.x + inX, midInnerY, pose.z + inZ);
      instFelt.setMatrixAt(instanceIdx, tmpFeltMtx);
      instanceIdx++;
    }

    // Populate Right Tambour Curtain
    for (let i = 0; i < rightSlatCount; i++) {
      const s = rightSlideShiftMm + (i + 0.5) * slatPitch;
      const pose = samplePiecewiseTrack(rightSegments, s);
      tmpMtx.makeRotationY(pose.rotY);
      tmpMtx.setPosition(pose.x, midInnerY, pose.z);
      instSlats.setMatrixAt(instanceIdx, tmpMtx);

      const inX = -Math.sin(pose.rotY) * 5.5;
      const inZ = -Math.cos(pose.rotY) * 5.5;
      tmpFeltMtx.makeRotationY(pose.rotY);
      tmpFeltMtx.setPosition(pose.x + inX, midInnerY, pose.z + inZ);
      instFelt.setMatrixAt(instanceIdx, tmpFeltMtx);
      instanceIdx++;
    }

    instSlats.instanceMatrix.needsUpdate = true;
    instSlats.castShadow = true;
    instSlats.receiveShadow = true;
    tagMesh(
      instSlats,
      `${mod.id}_capsule_tambour_left`,
      "door_left",
      `CNC Kavisli Tambur Sürgü Kapak (${totalSlats} Lamel)`
    );
    root.add(instSlats);

    instFelt.instanceMatrix.needsUpdate = true;
    tagMesh(instFelt, `${mod.id}_tambour_felt_backing`, "special_fitting", "Akustik Keçe Tambur Sırtlığı");
    root.add(instFelt);

    // Leading-edge Brushed Brass / Matte Black Magnetic Pull Handle Stiles (Travel along the curve with the leading slat!)
    const handleH = Math.min(220, Math.max(90, innerClearH * 0.44));
    const leftLeadPose = samplePiecewiseTrack(leftSegments, leftSlideShiftMm + 8);
    const rightLeadPose = samplePiecewiseTrack(rightSegments, rightSlideShiftMm + 8);
    [leftLeadPose, rightLeadPose].forEach((pose, idx) => {
      const outX = Math.sin(pose.rotY) * 9;
      const outZ = Math.cos(pose.rotY) * 9;
      const hMesh = new THREE.Mesh(new THREE.BoxGeometry(7, handleH, 12), brassMat);
      hMesh.rotation.y = pose.rotY;
      hMesh.position.set(pose.x + outX, midInnerY, pose.z + outZ);
      hMesh.castShadow = true;
      tagMesh(
        hMesh,
        `${mod.id}_tambour_handle_${idx}`,
        "door_handle",
        `Tambur Mıknatıslı Çekme Kulpu #${idx + 1}`
      );
      root.add(hMesh);
    });
  }

  return root;
}
