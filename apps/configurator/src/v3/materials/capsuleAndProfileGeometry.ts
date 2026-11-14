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

/**
 * Builds a complete, interactive 3D PBR `THREE.Group` for parametric curved/capsule modules:
 * - `capsule_stadium`: Kapsül Tamburlu Bar Dolabı / Kavisli Konsol / Ada (with sliding curved tambour doors!)
 * - `capsule_table`: Kapsül (Stadyum Form) Yemek / Toplantı Masası (Swiss-edge top + twin fluted columns!)
 */
export function buildCapsuleParametricModuleGroup(
  mod: ModuleInstance,
  resolveMat: (matId: string, isMetal?: boolean) => THREE.Material,
  edgeMat: THREE.LineBasicMaterial,
  modIdx: number,
  doorOpenAngleDeg: number
): THREE.Group {
  const root = new THREE.Group();
  const W = mod.dimensions.width;
  const H = mod.dimensions.height;
  const D = mod.dimensions.depth;
  const T = mod.carcass.panelThickness || 18;
  const R = Math.min(D / 2, W / 2, mod.carcass.cornerRadiusMm || D / 2);
  const cx = W / 2;
  const cz = D / 2;

  const bodyMat = resolveMat(mod.carcass.bodyMaterialId || "mat_veneer_walnut", false);
  const doorMat = resolveMat(mod.carcass.doorMaterialId || mod.carcass.bodyMaterialId || "mat_veneer_walnut", false);
  const topMat = resolveMat(
    mod.carcass.countertopMaterialId || mod.carcass.doorMaterialId || "mat_stone_calacatta",
    false
  );
  const brassMat = resolveMat(mod.carcass.plinthMaterialId || "mat_metal_brass", true);

  const tagMesh = (m: THREE.Object3D, compId: string, role: string, label: string) => {
    m.userData = {
      componentId: compId,
      moduleIndex: modIdx,
      bayIndex: 0,
      role,
      label,
      dimsText: `${W}×${H}×${D} mm`,
    };
  };

  // CASE A: CAPSULE STADIUM DINING / MEETING TABLE (`capsule_table`)
  if (mod.carcass.hullShape === "capsule_table") {
    const topThick = Math.max(28, T * 2);
    const { geo: topGeo, edges: topEdges } = getCachedCapsuleStadiumSlabGeometry(W, D, topThick, R, 12);
    const topMesh = new THREE.Mesh(topGeo, topMat);
    topMesh.position.set(cx, H - topThick / 2, cz);
    topMesh.castShadow = true;
    topMesh.receiveShadow = true;
    topMesh.add(new THREE.LineSegments(topEdges, edgeMat));
    tagMesh(topMesh, `${mod.id}_capsule_top`, "countertop", "Kapsül Üst Tabla (45° Swiss Pahlı)");
    root.add(topMesh);

    // Sub-frame stiffener apron under capsule top
    const { geo: apronGeo } = getCachedCapsuleStadiumSlabGeometry(
      Math.max(400, W - 260),
      Math.max(240, D - 260),
      22,
      Math.max(80, R - 130),
      0
    );
    const apron = new THREE.Mesh(apronGeo, bodyMat);
    apron.position.set(cx, H - topThick - 11, cz);
    tagMesh(apron, `${mod.id}_apron`, "top", "Alt Taşıyıcı Şase");
    root.add(apron);

    // Twin sculptural fluted pedestal columns + brushed metal floor rings
    const pedH = Math.max(300, H - topThick - 22);
    const pedR = Math.min(185, Math.max(95, D * 0.21));
    const pedPositionsX = W >= 1450 ? [W * 0.27, W * 0.73] : [cx];
    const ribCount = 24;
    const ribGeo = applyWorldMillimeterBoxUVs(new THREE.BoxGeometry(16, pedH - 16, 12), false);

    pedPositionsX.forEach((px, idx) => {
      const coreCyl = new THREE.Mesh(
        applyWorldMillimeterBoxUVs(new THREE.CylinderGeometry(pedR - 5, pedR + 6, pedH, 28), false),
        doorMat
      );
      coreCyl.position.set(px, pedH / 2 + 8, cz);
      coreCyl.castShadow = true;
      coreCyl.receiveShadow = true;
      tagMesh(coreCyl, `${mod.id}_pedestal_${idx}`, "side_left", `Yivli Kapsül Sütun Ayak ${idx + 1}`);
      root.add(coreCyl);

      const instRibs = new THREE.InstancedMesh(ribGeo, doorMat, ribCount);
      const mtx = new THREE.Matrix4();
      for (let s = 0; s < ribCount; s++) {
        const ang = (s / ribCount) * Math.PI * 2;
        const rx = px + Math.cos(ang) * (pedR + 1);
        const rz = cz + Math.sin(ang) * (pedR + 1);
        mtx.makeRotationY(-ang + Math.PI / 2);
        mtx.setPosition(rx, pedH / 2 + 8, rz);
        instRibs.setMatrixAt(s, mtx);
      }
      instRibs.instanceMatrix.needsUpdate = true;
      tagMesh(instRibs, `${mod.id}_pedestal_ribs_${idx}`, "door_left", `CNC Çıtalı Sütun Yüzeyi ${idx + 1}`);
      root.add(instRibs);

      // Brushed brass / metal plinth collar ring
      const baseRing = new THREE.Mesh(new THREE.CylinderGeometry(pedR + 14, pedR + 18, 16, 28), brassMat);
      baseRing.position.set(px, 8, cz);
      tagMesh(baseRing, `${mod.id}_pedestal_ring_${idx}`, "plinth", "Metal Baza Bileziği");
      root.add(baseRing);
    });

    return root;
  }

  // CASE B: CAPSULE FLUTED TAMBOUR BAR CABINET / CURVED CREDENZA (`capsule_stadium` | `rounded_corners`)
  const legH = Math.max(0, mod.carcass.plinthHeight ?? 180);
  const topSlabT = 22;
  const bodyH = Math.max(240, H - legH - topSlabT);
  const yBot = legH;
  const yTop = legH + bodyH;
  const straightHalf = Math.max(0, W / 2 - R);

  // 1. Brushed Brass / Metal Architectural Legs & Stretcher Frame (when legH >= 60)
  if (legH >= 60) {
    const legInsetX = Math.max(R * 0.75, 140);
    const legInsetZ = Math.max(70, D * 0.18);
    const legCoords: [number, number][] = [
      [legInsetX, legInsetZ],
      [W - legInsetX, legInsetZ],
      [legInsetX, D - legInsetZ],
      [W - legInsetX, D - legInsetZ],
    ];
    legCoords.forEach(([lx, lz], i) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(15, 11, legH, 16), brassMat);
      leg.position.set(lx, legH / 2, lz);
      leg.castShadow = true;
      tagMesh(leg, `${mod.id}_leg_${i}`, "plinth", "Torna Metal Kapsül Ayak");
      root.add(leg);
    });
    if (legH >= 130 && W >= 700) {
      const crossBar = new THREE.Mesh(
        new THREE.BoxGeometry(Math.max(180, W - 2 * legInsetX), 14, 14),
        brassMat
      );
      crossBar.position.set(cx, legH * 0.36, cz);
      tagMesh(crossBar, `${mod.id}_leg_crossbar`, "plinth", "Alt Metal Kayıt");
      root.add(crossBar);
    }
  } else if (legH > 0) {
    const { geo: plGeo } = getCachedCapsuleStadiumSlabGeometry(W - 50, D - 50, legH, Math.max(20, R - 25), 0);
    const plinth = new THREE.Mesh(plGeo, brassMat);
    plinth.position.set(cx, legH / 2, cz);
    tagMesh(plinth, `${mod.id}_capsule_plinth`, "plinth", "Kavisli Baza");
    root.add(plinth);
  }

  // 2. Bottom, Interior Bar Shelves & Top Carcass Stadium Slabs + Stone/Marble Top Counter
  const { geo: carcassSlabGeo, edges: carcassSlabEdges } = getCachedCapsuleStadiumSlabGeometry(W, D, T, R, 0);
  const botSlab = new THREE.Mesh(carcassSlabGeo, bodyMat);
  botSlab.position.set(cx, yBot + T / 2, cz);
  botSlab.add(new THREE.LineSegments(carcassSlabEdges, edgeMat));
  tagMesh(botSlab, `${mod.id}_bot_slab`, "bottom", "Kapsül Alt Tabla");
  root.add(botSlab);

  const topCarcassSlab = new THREE.Mesh(carcassSlabGeo, bodyMat);
  topCarcassSlab.position.set(cx, yTop - T / 2, cz);
  tagMesh(topCarcassSlab, `${mod.id}_top_slab`, "top", "Kapsül Üst Gövde Tablası");
  root.add(topCarcassSlab);

  // Sculpted Marble / Wood Top Tray Slab
  const { geo: counterGeo, edges: counterEdges } = getCachedCapsuleStadiumSlabGeometry(
    W + 8,
    D + 8,
    topSlabT,
    R + 4,
    6
  );
  const counterMesh = new THREE.Mesh(counterGeo, topMat);
  counterMesh.position.set(cx, yTop + topSlabT / 2, cz);
  counterMesh.castShadow = true;
  counterMesh.receiveShadow = true;
  counterMesh.add(new THREE.LineSegments(counterEdges, edgeMat));
  tagMesh(counterMesh, `${mod.id}_capsule_countertop`, "countertop", "Kapsül Mermer / Ahşap Üst Tabla");
  root.add(counterMesh);

  // Interior shelves (visible when tambour doors slide open!)
  const { geo: innerShelfGeo } = getCachedCapsuleStadiumSlabGeometry(
    Math.max(160, W - 2 * T - 16),
    Math.max(140, D - 2 * T - 24),
    T,
    Math.max(20, R - T - 8),
    0
  );
  const shelfCount = Math.max(1, mod.bays[0]?.shelves?.length || 2);
  for (let s = 1; s <= shelfCount; s++) {
    const sy = yBot + (bodyH / (shelfCount + 1)) * s;
    const sh = new THREE.Mesh(innerShelfGeo, bodyMat);
    sh.position.set(cx, sy, cz);
    tagMesh(sh, `${mod.id}_inner_shelf_${s}`, "shelf", `Kapsül İç Bar Rafı ${s}`);
    root.add(sh);
  }

  // Rear straight backing panel + Left & Right 180° Kerf-Bent Semicircular Curved Carcass Shells
  if (straightHalf > 8) {
    const backWall = new THREE.Mesh(
      applyWorldMillimeterBoxUVs(new THREE.BoxGeometry(straightHalf * 2, bodyH - 2 * T, T), false),
      bodyMat
    );
    backWall.position.set(cx, yBot + bodyH / 2, T / 2);
    tagMesh(backWall, `${mod.id}_back_panel`, "back", "Arka Gövde Paneli");
    root.add(backWall);
  }

  const innerH = bodyH - 2 * T;
  const leftArcGeo = applyWorldMillimeterBoxUVs(
    new THREE.CylinderGeometry(R - 4, R - 4, innerH, 24, 1, true, Math.PI, Math.PI),
    false
  );
  // Left semicircle (-X end, angles PI/2 .. 3*PI/2 in standard X-Z)
  const leftShell = new THREE.Mesh(
    new THREE.CylinderGeometry(R - 6, R - 6, innerH, 24, 1, true, Math.PI, Math.PI),
    bodyMat
  );
  leftShell.material = bodyMat;
  leftShell.position.set(cx - straightHalf, yBot + bodyH / 2, cz);
  leftShell.rotation.y = Math.PI / 2;
  tagMesh(leftShell, `${mod.id}_curved_left`, "side_left", "Sol Kavisli Gövde (CNC Kerf-Bending)");
  root.add(leftShell);
  leftArcGeo.dispose();

  const rightShell = new THREE.Mesh(
    new THREE.CylinderGeometry(R - 6, R - 6, innerH, 24, 1, true, 0, Math.PI),
    bodyMat
  );
  rightShell.position.set(cx + straightHalf, yBot + bodyH / 2, cz);
  rightShell.rotation.y = Math.PI / 2;
  tagMesh(rightShell, `${mod.id}_curved_right`, "side_right", "Sağ Kavisli Gövde (CNC Kerf-Bending)");
  root.add(rightShell);

  // 3. Fluted Tambour Slats wrapping Left & Right Curves + Sliding Front Tambour Doors!
  const slatPitch = mod.carcass.tambourSlatPitchMm || 24;
  const slatW = Math.max(14, slatPitch - 4);
  const slatGeo = applyWorldMillimeterBoxUVs(new THREE.BoxGeometry(slatW, bodyH - 4, 10), false);

  const slatTransforms: THREE.Matrix4[] = [];
  const pushSlat = (x: number, z: number, rotY: number) => {
    const m = new THREE.Matrix4();
    m.makeRotationY(rotY);
    m.setPosition(x, yBot + bodyH / 2, z);
    slatTransforms.push(m);
  };

  // Left & Right 180° curved fluted tambour end wraps
  const arcLen = Math.PI * (R - 2);
  const arcSlats = Math.max(10, Math.floor(arcLen / slatPitch));
  for (let i = 0; i <= arcSlats; i++) {
    const frac = i / arcSlats;
    // Left end: theta from PI/2 (front) -> 3*PI/2 (back) in X = center + cos(theta), Z = center + sin(theta)
    const angL = Math.PI / 2 + frac * Math.PI;
    pushSlat(
      cx - straightHalf + Math.cos(angL) * (R - 4),
      cz + Math.sin(angL) * (R - 4),
      -angL + Math.PI / 2
    );
    // Right end: theta from -PI/2 (back) -> +PI/2 (front)
    const angR = -Math.PI / 2 + frac * Math.PI;
    pushSlat(
      cx + straightHalf + Math.cos(angR) * (R - 4),
      cz + Math.sin(angR) * (R - 4),
      -angR + Math.PI / 2
    );
  }

  // Front Sliding Tambour Doors (glide open toward left/right curves as `doorOpenAngleDeg` increases!)
  const openRatio = Math.max(0, Math.min(0.88, doorOpenAngleDeg / 85));
  const halfSpan = straightHalf;
  const closedWidthPerLeaf = halfSpan * (1 - openRatio);
  if (closedWidthPerLeaf > 16) {
    const leafSlats = Math.max(2, Math.floor(closedWidthPerLeaf / slatPitch));
    for (let i = 0; i < leafSlats; i++) {
      const lx = cx - halfSpan + (i + 0.5) * (closedWidthPerLeaf / leafSlats);
      pushSlat(lx, D - 5, 0);
      const rx = cx + halfSpan - (i + 0.5) * (closedWidthPerLeaf / leafSlats);
      pushSlat(rx, D - 5, 0);
    }
  }

  const instTambour = new THREE.InstancedMesh(slatGeo, doorMat, slatTransforms.length);
  slatTransforms.forEach((mtx, idx) => instTambour.setMatrixAt(idx, mtx));
  instTambour.instanceMatrix.needsUpdate = true;
  instTambour.castShadow = true;
  instTambour.receiveShadow = true;
  tagMesh(
    instTambour,
    `${mod.id}_tambour_slats`,
    "door_left",
    "CNC Çıtalı Kavisli Tambur Sürgü Kapak"
  );
  root.add(instTambour);

  // Vertical Brushed Brass Tambour Finger Pull Handles on Left & Right Meeting Stiles
  const handleH = Math.min(260, bodyH * 0.38);
  const handleOffset = halfSpan * openRatio + 18;
  [-handleOffset, handleOffset].forEach((hxOff, idx) => {
    const hMesh = new THREE.Mesh(new THREE.BoxGeometry(8, handleH, 14), brassMat);
    hMesh.position.set(cx + hxOff, yBot + bodyH / 2, D + 3);
    tagMesh(hMesh, `${mod.id}_tambour_handle_${idx}`, "door_handle", "Pirinç Tambur Kulp");
    root.add(hMesh);
  });

  return root;
}
