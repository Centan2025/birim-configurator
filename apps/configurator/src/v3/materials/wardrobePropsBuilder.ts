import * as THREE from "three";
import { markSharedGeometry, markSharedMaterial, markSharedTexture } from "./webglResourceGuard";

/**
 * Sculpted, GPU-Cached 3D Wardrobe Lifestyle Props Builder (V5.0 Studio Edition):
 * Replaces primitive cubes with smooth, anatomically contoured, physically shaded 3D assets:
 * 1. Contoured Wooden Coat Hangers + Swan-Neck Chrome/Brass Hooks + Draped Collared Shirts with Sleeves & Pleats
 * 2. U-Folded Rounded Knitwear / Towel Stacks with Curved Front Fold Loops & Recessed Creases
 * 3. Two-Piece Architectural Linen Storage Boxes with Overhanging Fitted Lids & Brass/Leather Pulls
 * 4. Sculpted 3D Lasted Leather/Suede Shoes & Minimalist Sneakers with Welt Soles & Instep Arches
 */

let cachedFabricRoughnessTex: THREE.CanvasTexture | null = null;
let cachedFabricNormalTex: THREE.CanvasTexture | null = null;

function ensureFabricTextures(): {
  roughTex: THREE.CanvasTexture | null;
  normTex: THREE.CanvasTexture | null;
} {
  if (typeof document === "undefined") {
    return { roughTex: null, normTex: null };
  }
  if (cachedFabricRoughnessTex && cachedFabricNormalTex) {
    return { roughTex: cachedFabricRoughnessTex, normTex: cachedFabricNormalTex };
  }

  const S = 128;
  const rCan = document.createElement("canvas");
  rCan.width = S;
  rCan.height = S;
  const rCtx = rCan.getContext("2d")!;
  const rImg = rCtx.createImageData(S, S);

  const nCan = document.createElement("canvas");
  nCan.width = S;
  nCan.height = S;
  const nCtx = nCan.getContext("2d")!;
  const nImg = nCtx.createImageData(S, S);

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      // Fine cross-woven linen/poplin textile micro-relief
      const warp = Math.sin((x / S) * Math.PI * 64);
      const weft = Math.sin((y / S) * Math.PI * 64);
      const weave = warp * 0.5 + weft * 0.5;
      const idx = (y * S + x) * 4;

      const rv = Math.round(212 + weave * 22);
      rImg.data[idx] = rv;
      rImg.data[idx + 1] = rv;
      rImg.data[idx + 2] = rv;
      rImg.data[idx + 3] = 255;

      nImg.data[idx] = Math.round(128 + warp * 18);
      nImg.data[idx + 1] = Math.round(128 + weft * 18);
      nImg.data[idx + 2] = 248;
      nImg.data[idx + 3] = 255;
    }
  }
  rCtx.putImageData(rImg, 0, 0);
  nCtx.putImageData(nImg, 0, 0);

  const rTex = markSharedTexture(new THREE.CanvasTexture(rCan));
  rTex.wrapS = THREE.RepeatWrapping;
  rTex.wrapT = THREE.RepeatWrapping;
  rTex.repeat.set(6, 8);
  rTex.needsUpdate = true;

  const nTex = markSharedTexture(new THREE.CanvasTexture(nCan));
  nTex.wrapS = THREE.RepeatWrapping;
  nTex.wrapT = THREE.RepeatWrapping;
  nTex.repeat.set(6, 8);
  nTex.needsUpdate = true;

  cachedFabricRoughnessTex = rTex;
  cachedFabricNormalTex = nTex;
  return { roughTex: rTex, normTex: nTex };
}

// Shared Materials (Curated Warm Editorial Wardrobe Palette matching Studio Reference)
const shirtMaterialsCache: THREE.MeshPhysicalMaterial[] = [];
const knitMaterialsCache: THREE.MeshPhysicalMaterial[] = [];
let hangerWoodMat: THREE.MeshPhysicalMaterial | null = null;
let hangerHookMat: THREE.MeshPhysicalMaterial | null = null;
let boxBodyLinenMat: THREE.MeshPhysicalMaterial | null = null;
let boxLidLinenMat: THREE.MeshPhysicalMaterial | null = null;
let boxShadowRimMat: THREE.MeshStandardMaterial | null = null;
let boxPullPlateMat: THREE.MeshPhysicalMaterial | null = null;
let shoeUpperCamelMat: THREE.MeshPhysicalMaterial | null = null;
let shoeUpperEspressoMat: THREE.MeshPhysicalMaterial | null = null;
let shoeUpperTaupeMat: THREE.MeshPhysicalMaterial | null = null;
let shoeSoleCreamMat: THREE.MeshStandardMaterial | null = null;
let shoeInnerDarkMat: THREE.MeshStandardMaterial | null = null;

function ensurePropMaterials() {
  if (shirtMaterialsCache.length > 0) return;
  const { roughTex, normTex } = ensureFabricTextures();

  // 1. Shirt / Overshirt Fabrics (Warm Camel, Soft Cream, Powder Oxford Blue, Oatmeal Taupe, Warm Sand)
  const shirtHexes = ["#C99E72", "#EAE1D3", "#B5C3D3", "#CFC1AE", "#D8B994"];
  shirtHexes.forEach((hex) => {
    const mat = markSharedMaterial(
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(hex),
        roughness: 0.84,
        roughnessMap: roughTex,
        normalMap: normTex,
        normalScale: new THREE.Vector2(0.18, 0.18),
        metalness: 0.0,
        sheen: 0.58,
        sheenRoughness: 0.72,
        sheenColor: new THREE.Color("#fffaf2"),
        envMapIntensity: 0.62,
        side: THREE.DoubleSide,
      })
    );
    shirtMaterialsCache.push(mat);
  });

  // 2. Folded Knitwear / Towel Palette (Warm Cream, Sand Cashmere, Soft Biscuit)
  const knitHexes = ["#EFE7DA", "#DCCBB5", "#CEB9A1"];
  knitHexes.forEach((hex) => {
    const mat = markSharedMaterial(
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(hex),
        roughness: 0.88,
        roughnessMap: roughTex,
        normalMap: normTex,
        normalScale: new THREE.Vector2(0.24, 0.24),
        metalness: 0.0,
        sheen: 0.68,
        sheenRoughness: 0.65,
        sheenColor: new THREE.Color("#fffdf9"),
        envMapIntensity: 0.55,
      })
    );
    knitMaterialsCache.push(mat);
  });

  hangerWoodMat = markSharedMaterial(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#BA7938"),
      roughness: 0.34,
      metalness: 0.02,
      clearcoat: 0.45,
      clearcoatRoughness: 0.24,
    })
  );

  hangerHookMat = markSharedMaterial(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#D8D3C8"),
      roughness: 0.18,
      metalness: 0.94,
      envMapIntensity: 1.4,
    })
  );

  boxBodyLinenMat = markSharedMaterial(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#C6B098"),
      roughness: 0.86,
      roughnessMap: roughTex,
      normalMap: normTex,
      normalScale: new THREE.Vector2(0.16, 0.16),
      sheen: 0.35,
      sheenColor: new THREE.Color("#faf5ee"),
      envMapIntensity: 0.5,
    })
  );

  boxLidLinenMat = markSharedMaterial(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#CEBAA3"),
      roughness: 0.84,
      roughnessMap: roughTex,
      normalMap: normTex,
      normalScale: new THREE.Vector2(0.15, 0.15),
      sheen: 0.35,
      sheenColor: new THREE.Color("#faf5ee"),
      envMapIntensity: 0.52,
    })
  );

  boxShadowRimMat = markSharedMaterial(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color("#1F1B18"),
      roughness: 0.95,
    })
  );

  boxPullPlateMat = markSharedMaterial(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#8A7256"),
      roughness: 0.42,
      metalness: 0.35,
    })
  );

  shoeUpperCamelMat = markSharedMaterial(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#9C7654"),
      roughness: 0.62,
      sheen: 0.45,
      sheenRoughness: 0.6,
      clearcoat: 0.12,
    })
  );

  shoeUpperEspressoMat = markSharedMaterial(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#3D312A"),
      roughness: 0.44,
      clearcoat: 0.28,
      clearcoatRoughness: 0.32,
    })
  );

  shoeUpperTaupeMat = markSharedMaterial(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#B8ACA0"),
      roughness: 0.74,
      sheen: 0.5,
    })
  );

  shoeSoleCreamMat = markSharedMaterial(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color("#EAE4DA"),
      roughness: 0.68,
    })
  );

  shoeInnerDarkMat = markSharedMaterial(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color("#1C1917"),
      roughness: 0.92,
    })
  );
}

// ============================================================================
// 1. SCULPTED WOODEN HANGER + DRAPED COLLARED SHIRT GEOMETRIES (GPU-Cached)
// ============================================================================
let sharedHookGeo: THREE.BufferGeometry | null = null;
let sharedHangerBarGeo: THREE.BufferGeometry | null = null;
const shirtTorsoCache = new Map<number, THREE.BufferGeometry>();
let sharedCollarGeo: THREE.BufferGeometry | null = null;
let sharedSleeveGeo: THREE.BufferGeometry | null = null;
let sharedPlacketGeo: THREE.BufferGeometry | null = null;

function getHookAndHangerGeos() {
  if (!sharedHookGeo) {
    // Swan-neck curved coat-hanger hook wrapping around Ø25mm hanging rail at y=0
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -42, 0),
      new THREE.Vector3(0, -18, 0),
      new THREE.Vector3(0, -8, -11),
      new THREE.Vector3(0, 8, -13),
      new THREE.Vector3(0, 18, 0),
      new THREE.Vector3(0, 10, 12),
    ]);
    sharedHookGeo = markSharedGeometry(new THREE.TubeGeometry(curve, 16, 1.9, 8, false));
  }

  if (!sharedHangerBarGeo) {
    // Contoured curved wooden coat-hanger yoke spanning along Z (front-to-back inside wardrobe)
    const armCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -76, -185),
      new THREE.Vector3(0, -56, -105),
      new THREE.Vector3(0, -42, 0),
      new THREE.Vector3(0, -56, 105),
      new THREE.Vector3(0, -76, 185),
    ]);
    const g = new THREE.TubeGeometry(armCurve, 18, 8.5, 10, false);
    g.scale(0.68, 1.15, 1.0); // Sculpted flat-oval beechwood hanger cross-section
    sharedHangerBarGeo = markSharedGeometry(g);
  }
  return { hookGeo: sharedHookGeo, hangerBarGeo: sharedHangerBarGeo };
}

/**
 * Builds a normalized unit-scale sculpted shirt torso (height = 1.0 from y=0 down to y=-1.0,
 * depth = 1.0 along Z, thickness = 1.0 along X) with organic vertical drape folds & contoured shoulders.
 */
function getSculptedShirtTorsoGeo(pleatVariant: number): THREE.BufferGeometry {
  const key = pleatVariant % 3;
  const cached = shirtTorsoCache.get(key);
  if (cached) return cached;

  const segU = 28; // Around horizontal perimeter
  const segV = 16; // Top shoulder (v=0) down to bottom hem (v=1)
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const phase = key * 1.35;

  for (let iv = 0; iv <= segV; iv++) {
    const v = iv / segV;
    // Shoulder dome rounding at top (v < 0.14), natural drape waist & slight bottom flare
    const shoulderTaper = v < 0.14 ? 0.36 + 0.64 * Math.sin((v / 0.14) * (Math.PI / 2)) : 1.0;
    const hemFlare = 1.0 + Math.pow(v, 1.6) * 0.12;
    const y = -v;

    // Slight natural gravity sway along X
    const swayX = Math.sin(v * Math.PI * 0.9 + phase) * 0.04;

    for (let iu = 0; iu <= segU; iu++) {
      const u = iu / segU;
      const theta = u * Math.PI * 2;

      // Soft vertical fabric pleats/drapes that deepen toward the bottom hem
      const pleatAmp = Math.pow(v, 0.85) * 0.13;
      const pleat =
        1.0 +
        pleatAmp * Math.sin(theta * 5 + phase) +
        pleatAmp * 0.55 * Math.cos(theta * 9 - phase * 0.7);

      // Super-elliptical shirt cross-section (slim side profile along X, wide shoulder span along Z)
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);
      const rx = 0.5 * hemFlare * pleat * (0.85 + 0.15 * Math.abs(sinT));
      const rz = 0.5 * shoulderTaper * (1.0 - v * 0.06) * (1.0 + pleatAmp * 0.22 * Math.sin(theta * 3));

      const px = cosT * rx + swayX;
      const pz = sinT * rz;

      positions.push(px, y, pz);
      uvs.push(u * 2, v * 2);
    }
  }

  const stride = segU + 1;
  for (let iv = 0; iv < segV; iv++) {
    for (let iu = 0; iu < segU; iu++) {
      const a = iv * stride + iu;
      const b = a + 1;
      const c = a + stride + 1;
      const d = a + stride;
      indices.push(a, d, b, b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const shared = markSharedGeometry(geo);
  shirtTorsoCache.set(key, shared);
  return shared;
}

function getShirtDetailGeos() {
  if (!sharedCollarGeo) {
    // Sculpted turn-down folded shirt collar ring at neck
    const g = new THREE.CylinderGeometry(28, 36, 36, 18, 1, true);
    g.scale(0.62, 1.0, 1.35);
    sharedCollarGeo = markSharedGeometry(g);
  }
  if (!sharedSleeveGeo) {
    // Tapered draped long shirt sleeve with cuff
    const g = new THREE.CylinderGeometry(26, 21, 1.0, 14, 4, false);
    g.translate(0, -0.5, 0);
    g.scale(0.74, 1.0, 1.05);
    sharedSleeveGeo = markSharedGeometry(g);
  }
  if (!sharedPlacketGeo) {
    sharedPlacketGeo = markSharedGeometry(new THREE.BoxGeometry(4, 1.0, 22));
  }
  return {
    collarGeo: sharedCollarGeo,
    sleeveGeo: sharedSleeveGeo,
    placketGeo: sharedPlacketGeo,
  };
}

export function createSculptedHangingShirtGroup(
  variantIdx: number,
  garmentHeightMm: number,
  garmentDepthMm: number
): THREE.Group {
  ensurePropMaterials();
  const grp = new THREE.Group();

  const { hookGeo, hangerBarGeo } = getHookAndHangerGeos();
  const { collarGeo, sleeveGeo, placketGeo } = getShirtDetailGeos();
  const torsoGeo = getSculptedShirtTorsoGeo(variantIdx);
  const fabricMat = shirtMaterialsCache[variantIdx % shirtMaterialsCache.length];

  const effDepth = Math.max(240, Math.min(430, garmentDepthMm));
  const hangerScaleZ = effDepth / 410;

  // 1. Swan-Neck Metal Hook + Contoured Wooden Hanger
  const hook = new THREE.Mesh(hookGeo, hangerHookMat!);
  hook.castShadow = true;
  grp.add(hook);

  const hanger = new THREE.Mesh(hangerBarGeo, hangerWoodMat!);
  hanger.scale.set(1, 1, hangerScaleZ);
  hanger.castShadow = true;
  grp.add(hanger);

  // 2. Sculpted Draped Shirt Body
  const bodyH = Math.max(420, garmentHeightMm - 45);
  const bodyThickX = 54 + (variantIdx % 3) * 6;
  const torso = new THREE.Mesh(torsoGeo, fabricMat);
  torso.position.set(0, -48, 0);
  torso.scale.set(bodyThickX, bodyH, effDepth * 0.84);
  torso.castShadow = true;
  torso.receiveShadow = true;
  grp.add(torso);

  // 3. Turn-Down Shirt Collar around Hanger Neck
  const collar = new THREE.Mesh(collarGeo, fabricMat);
  collar.position.set(0, -46, 0);
  collar.castShadow = true;
  grp.add(collar);

  // 4. Front & Back Draped Long Sleeves hanging naturally from shoulder tips
  const sleeveLen = bodyH * 0.84;
  [-1, 1].forEach((sideSign) => {
    const sleeve = new THREE.Mesh(sleeveGeo, fabricMat);
    sleeve.position.set(
      sideSign * 2,
      -68,
      sideSign * (effDepth * 0.41)
    );
    sleeve.rotation.x = sideSign * 0.055;
    sleeve.scale.set(1.0, sleeveLen, 1.0);
    sleeve.castShadow = true;
    sleeve.receiveShadow = true;
    grp.add(sleeve);
  });

  // 5. Raised Center Placket Seam along front-facing side (+Z)
  const placket = new THREE.Mesh(placketGeo, fabricMat);
  placket.position.set(0, -56 - bodyH * 0.46, effDepth * 0.41);
  placket.scale.set(1, bodyH * 0.88, 1);
  grp.add(placket);

  // Slight organic per-garment yaw angle on the rail
  grp.rotation.y = ((variantIdx % 4) - 1.5) * 0.04;
  return grp;
}

// ============================================================================
// 2. U-FOLDED ROUNDED KNITWEAR / TOWEL STACK GEOMETRY (GPU-Cached)
// ============================================================================
let sharedFoldedLayerGeo: THREE.BufferGeometry | null = null;

function getFoldedKnitLayerGeo(): THREE.BufferGeometry {
  if (sharedFoldedLayerGeo) return sharedFoldedLayerGeo;

  // Cross-section in Y-Z plane: smooth 180° rounded front fold loop at +Z and tucked soft layers toward -Z,
  // extruded along X with smooth rounded bevels so every folded sweater looks plump & tactile!
  const shape = new THREE.Shape();
  const lenZ = 0.88;
  const halfH = 0.44;
  const creaseY = 0.04;

  shape.moveTo(-lenZ * 0.5, -halfH);
  shape.lineTo(lenZ * 0.34, -halfH);
  // Smooth rounded front C-fold loop at +Z
  shape.absarc(lenZ * 0.34, 0, halfH, -Math.PI / 2, Math.PI / 2, false);
  // Gently crowned pillowed top surface back to -Z
  shape.quadraticCurveTo(0, halfH * 1.12, -lenZ * 0.5, halfH * 0.92);
  shape.quadraticCurveTo(-lenZ * 0.56, halfH * 0.5, -lenZ * 0.5, creaseY);
  // Subtle recessed middle fold crease
  shape.lineTo(lenZ * 0.24, creaseY * 0.5);
  shape.lineTo(-lenZ * 0.5, -creaseY);
  shape.quadraticCurveTo(-lenZ * 0.56, -halfH * 0.5, -lenZ * 0.5, -halfH);

  const extrude = new THREE.ExtrudeGeometry(shape, {
    depth: 0.88,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: 0.06,
    bevelThickness: 0.06,
    curveSegments: 14,
  });
  // Rotate so extrusion axis (originally Z) aligns with X (width), Y stays height, X (shape) aligns with Z (depth)
  extrude.center();
  extrude.rotateY(Math.PI / 2);
  extrude.computeVertexNormals();

  sharedFoldedLayerGeo = markSharedGeometry(extrude);
  return sharedFoldedLayerGeo;
}

export function createFoldedKnitwearStackGroup(
  stackW: number,
  stackD: number,
  layersCount = 3,
  seedOffset = 0
): THREE.Group {
  ensurePropMaterials();
  const grp = new THREE.Group();
  const geo = getFoldedKnitLayerGeo();
  const layerH = 38;

  for (let i = 0; i < layersCount; i++) {
    const mat = knitMaterialsCache[(i + seedOffset) % knitMaterialsCache.length];
    const mesh = new THREE.Mesh(geo, mat);
    const shrink = 1 - i * 0.025;
    mesh.scale.set(stackW * shrink, layerH, stackD * shrink);
    mesh.position.set(
      ((i % 2 === 0 ? 1 : -1) * (i * 1.8)),
      layerH * 0.5 + i * (layerH - 2),
      0
    );
    mesh.rotation.y = ((i + seedOffset) % 3 - 1) * 0.022;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    grp.add(mesh);
  }
  return grp;
}

// ============================================================================
// 3. TWO-PIECE ARCHITECTURAL LIDDED LINEN STORAGE BOX (Overhanging Fitted Lid!)
// ============================================================================
let sharedUnitRoundedBoxGeo: THREE.BufferGeometry | null = null;

function getUnitRoundedBoxGeo(): THREE.BufferGeometry {
  if (sharedUnitRoundedBoxGeo) return sharedUnitRoundedBoxGeo;
  const shape = new THREE.Shape();
  const r = 0.04;
  const hw = 0.5 - r;
  const hd = 0.5 - r;
  shape.moveTo(-hw, -hd - r);
  shape.lineTo(hw, -hd - r);
  shape.absarc(hw, -hd, r, -Math.PI / 2, 0, false);
  shape.lineTo(hw + r, hd);
  shape.absarc(hw, hd, r, 0, Math.PI / 2, false);
  shape.lineTo(-hw, hd + r);
  shape.absarc(-hw, hd, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(-hw - r, -hd);
  shape.absarc(-hw, -hd, r, Math.PI, Math.PI * 1.5, false);

  const g = new THREE.ExtrudeGeometry(shape, {
    depth: 0.94,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.02,
    bevelThickness: 0.03,
  });
  g.center();
  g.rotateX(Math.PI / 2);
  g.computeVertexNormals();
  sharedUnitRoundedBoxGeo = markSharedGeometry(g);
  return sharedUnitRoundedBoxGeo;
}

export function createLiddedStorageBoxGroup(
  boxW: number,
  boxH: number,
  boxD: number
): THREE.Group {
  ensurePropMaterials();
  const grp = new THREE.Group();
  const unitGeo = getUnitRoundedBoxGeo();

  const lidH = Math.min(36, Math.max(26, boxH * 0.23));
  const bodyH = Math.max(60, boxH - lidH * 0.35);

  // 1. Main Linen Box Base
  const baseMesh = new THREE.Mesh(unitGeo, boxBodyLinenMat!);
  baseMesh.scale.set(boxW - 8, bodyH, boxD - 8);
  baseMesh.position.set(0, bodyH * 0.5, 0);
  baseMesh.castShadow = true;
  baseMesh.receiveShadow = true;
  grp.add(baseMesh);

  // 2. Dark Shadow Reveal Line directly beneath Overhanging Lid
  const rimShadow = new THREE.Mesh(unitGeo, boxShadowRimMat!);
  rimShadow.scale.set(boxW - 3, 4, boxD - 3);
  rimShadow.position.set(0, boxH - lidH - 1.5, 0);
  grp.add(rimShadow);

  // 3. Overhanging Fitted Box Lid (+8mm wider & deeper so it casts a real shadow step!)
  const lidMesh = new THREE.Mesh(unitGeo, boxLidLinenMat!);
  lidMesh.scale.set(boxW, lidH, boxD);
  lidMesh.position.set(0, boxH - lidH * 0.5, 0);
  lidMesh.castShadow = true;
  lidMesh.receiveShadow = true;
  grp.add(lidMesh);

  // 4. Subtle Stitched Leather / Warm Brass Label Pull on Front Face
  const pullMesh = new THREE.Mesh(unitGeo, boxPullPlateMat!);
  pullMesh.scale.set(Math.min(48, boxW * 0.2), 14, 5);
  pullMesh.position.set(0, bodyH * 0.52, (boxD - 8) * 0.5 + 2);
  grp.add(pullMesh);

  return grp;
}

// ============================================================================
// 4. SCULPTED 3D LASTED LEATHER / SUEDE SHOES WITH WELT SOLES (GPU-Cached)
// ============================================================================
let sharedShoeUpperGeo: THREE.BufferGeometry | null = null;
let sharedShoeSoleGeo: THREE.BufferGeometry | null = null;
let sharedShoeOpeningGeo: THREE.BufferGeometry | null = null;

function getSculptedShoeGeos() {
  if (!sharedShoeUpperGeo) {
    // 2D footprint outline of a lasted loafer/sneaker extruded & sculpted with arched instep
    const soleShape = new THREE.Shape();
    // Heel at z = -105, Toe at z = +115, Width ~76mm
    soleShape.moveTo(0, -105);
    soleShape.bezierCurveTo(34, -105, 36, -65, 31, -20);
    soleShape.bezierCurveTo(28, 20, 41, 55, 36, 88);
    soleShape.bezierCurveTo(30, 112, 14, 118, 0, 118);
    soleShape.bezierCurveTo(-14, 118, -30, 112, -36, 88);
    soleShape.bezierCurveTo(-41, 55, -28, 20, -31, -20);
    soleShape.bezierCurveTo(-36, -65, -34, -105, 0, -105);

    const soleGeo = new THREE.ExtrudeGeometry(soleShape, {
      depth: 13,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 2,
      bevelThickness: 2,
      curveSegments: 16,
    });
    soleGeo.rotateX(Math.PI / 2);
    soleGeo.translate(0, 15, 0);
    soleGeo.computeVertexNormals();
    sharedShoeSoleGeo = markSharedGeometry(soleGeo);

    // Sculpted Upper: extrude & deform top vertices to form heel counter, ankle dip, raised instep & rounded toe!
    const upperGeo = new THREE.ExtrudeGeometry(soleShape, {
      depth: 56,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 3,
      bevelSize: 2.5,
      bevelThickness: 4,
      curveSegments: 16,
    });
    upperGeo.rotateX(Math.PI / 2);
    upperGeo.translate(0, 68, 0);

    const pos = upperGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let vx = pos.getX(i);
      let vy = pos.getY(i);
      const vz = pos.getZ(i); // -105 (heel) .. +118 (toe)

      const tNorm = (vz + 105) / 223; // 0 = heel, 1 = toe tip
      const hRatio = Math.max(0, Math.min(1, (vy - 14) / 58));

      // Anatomical shoe profile height curve: tall heel (0.95), dipped collar (0.72), arched instep (0.82), sleek tapered toe (0.36)
      let profileMaxY = 66;
      if (tNorm < 0.35) {
        profileMaxY = 68 - Math.sin((tNorm / 0.35) * Math.PI) * 8;
      } else {
        const toeT = (tNorm - 0.35) / 0.65;
        profileMaxY = 66 * (1 - Math.pow(toeT, 1.45) * 0.58);
      }

      vy = 13 + hRatio * (profileMaxY - 13);
      // Taper upper inward near top of vamp/collar
      const inward = 1 - hRatio * (0.16 + tNorm * 0.14);
      vx *= inward;

      pos.setXYZ(i, vx, vy, vz);
    }
    upperGeo.computeVertexNormals();
    sharedShoeUpperGeo = markSharedGeometry(upperGeo);

    const openGeo = new THREE.CylinderGeometry(22, 20, 8, 16);
    openGeo.scale(1.0, 1.0, 1.55);
    sharedShoeOpeningGeo = markSharedGeometry(openGeo);
  }
  return {
    upperGeo: sharedShoeUpperGeo!,
    soleGeo: sharedShoeSoleGeo!,
    openingGeo: sharedShoeOpeningGeo!,
  };
}

export function createSculptedShoePairGroup(pairVariantIdx: number): THREE.Group {
  ensurePropMaterials();
  const grp = new THREE.Group();
  const { upperGeo, soleGeo, openingGeo } = getSculptedShoeGeos();

  const upperMats = [shoeUpperCamelMat!, shoeUpperEspressoMat!, shoeUpperTaupeMat!];
  const upperMat = upperMats[pairVariantIdx % upperMats.length];

  [-46, 46].forEach((offsetX, sideIdx) => {
    const shoe = new THREE.Group();
    shoe.position.set(offsetX, 0, 0);
    shoe.scale.set(sideIdx === 0 ? 1 : -1, 1, 1); // Mirror left & right last!
    shoe.rotation.y = sideIdx === 0 ? 0.035 : -0.035;

    const sole = new THREE.Mesh(soleGeo, shoeSoleCreamMat!);
    sole.castShadow = true;
    sole.receiveShadow = true;
    shoe.add(sole);

    const upper = new THREE.Mesh(upperGeo, upperMat);
    upper.castShadow = true;
    upper.receiveShadow = true;
    shoe.add(upper);

    const footOpening = new THREE.Mesh(openingGeo, shoeInnerDarkMat!);
    footOpening.position.set(0, 61, -42);
    footOpening.rotation.x = 0.18;
    shoe.add(footOpening);

    grp.add(shoe);
  });

  return grp;
}
