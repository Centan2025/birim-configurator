import * as THREE from "three";
import { calculateModulePlacement, ModuleInstance } from "@birim/core";
import { ComponentGeometry } from "@birim/geometry";
import {
  markSharedGeometry,
  markSharedMaterial,
} from "../v3/materials/webglResourceGuard";

const box = markSharedGeometry(new THREE.BoxGeometry(1, 1, 1));
const sphere = markSharedGeometry(new THREE.SphereGeometry(0.5, 20, 14));
const cylinder = new THREE.CylinderGeometry(0.5, 0.5, 1, 20);
cylinder.rotateX(Math.PI / 2);
markSharedGeometry(cylinder);
const cylinderY = markSharedGeometry(new THREE.CylinderGeometry(0.5, 0.5, 1, 20));
const edges = markSharedGeometry(new THREE.EdgesGeometry(box));

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
  const hw = w / 2;
  const hh = h / 2;
  const hd = d / 2;
  const b = Math.min(bevelMm, hw * 0.35, hh * 0.35);
  const iw = hw - b;
  const ih = hh - b;

  // 8 vertices: 0..3 back rectangle (z = -hd), 4..7 front beveled plateau (z = +hd)
  const v = [
    [-hw, -hh, -hd], // 0: back bottom-left
    [hw, -hh, -hd],  // 1: back bottom-right
    [hw, hh, -hd],   // 2: back top-right
    [-hw, hh, -hd],  // 3: back top-left
    [-iw, -ih, hd],  // 4: front bottom-left (inward by bevelMm)
    [iw, -ih, hd],   // 5: front bottom-right
    [iw, ih, hd],    // 6: front top-right
    [-iw, ih, hd],   // 7: front top-left
  ];

  // 6 quad faces (front plateau, back base, bottom 45° slope, right 45° slope, top 45° slope, left 45° slope)
  const quads = [
    [4, 5, 6, 7], // front face
    [1, 0, 3, 2], // back face
    [0, 1, 5, 4], // bottom 45° chamfer slope
    [1, 2, 6, 5], // right 45° chamfer slope
    [2, 3, 7, 6], // top 45° chamfer slope
    [3, 0, 4, 7], // left 45° chamfer slope
  ];

  const positions: number[] = [];
  const uvs: number[] = [];
  for (const [a, bIdx, c, dIdx] of quads) {
    positions.push(...v[a], ...v[bIdx], ...v[c], ...v[a], ...v[c], ...v[dIdx]);
    uvs.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
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
  opacity: 0.65,
});
const doorDirectionLineMat = new THREE.LineBasicMaterial({
  color: 0xd97706,
  transparent: true,
  opacity: 0.52,
});

const sharedSmokedGlassPaneMat = markSharedMaterial(
  new THREE.MeshPhysicalMaterial({
    color: 0x334155,
    roughness: 0.08,
    metalness: 0.15,
    transparent: true,
    opacity: 0.36,
  })
);
const sharedBronzeMirrorPaneMat = markSharedMaterial(
  new THREE.MeshStandardMaterial({
    color: 0xc2b29f,
    roughness: 0.03,
    metalness: 0.95,
  })
);
const sharedSilverMirrorPaneMat = markSharedMaterial(
  new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.03,
    metalness: 0.95,
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

  // 1B. REAL 3D ADJUSTABLE BLACK ABS PLASTIC KITCHEN CABINET LEGS (_plastic_leg_)
  if (comp.id.includes("_plastic_leg_")) {
    const h = comp.dimensions.height;
    // Wide Ø68mm circular floor glide flange
    const baseFoot = new THREE.Mesh(cylinderY, darkCavityMat);
    baseFoot.scale.set(68, 8, 68);
    baseFoot.position.set(cx, cy - h / 2 + 4, cz);
    tagSubMesh(baseFoot, userData, comp);
    group.add(baseFoot);

    // Threaded adjustable Ø38mm ABS vertical shaft
    const legShaft = new THREE.Mesh(cylinderY, darkDamperMat);
    legShaft.scale.set(38, Math.max(20, h - 18), 38);
    legShaft.position.set(cx, cy, cz);
    tagSubMesh(legShaft, userData, comp);
    group.add(legShaft);

    // Adjustment knurled collar ring
    const collarRing = new THREE.Mesh(cylinderY, darkCavityMat);
    collarRing.scale.set(46, 12, 46);
    collarRing.position.set(cx, cy - h * 0.15, cz);
    tagSubMesh(collarRing, userData, comp);
    group.add(collarRing);

    // Top carcass mounting socket plate
    const topSocket = new THREE.Mesh(cylinderY, darkCavityMat);
    topSocket.scale.set(58, 10, 58);
    topSocket.position.set(cx, cy + h / 2 - 5, cz);
    tagSubMesh(topSocket, userData, comp);
    group.add(topSocket);

    return group;
  }

  // 1C. RECESSED ALUMINUM LED CHANNEL WITH FLUSH 3000K OPAL DIFFUSER (_recessed_led_)
  if (comp.id.includes("_recessed_led_")) {
    const w = comp.dimensions.width;
    const h = comp.dimensions.height;
    const d = comp.dimensions.depth;
    // Anodized recessed aluminum housing milled into the panel
    const housing = new THREE.Mesh(box, screwHeadMat);
    housing.scale.set(w, h, d);
    housing.position.set(cx, cy, cz);
    tagSubMesh(housing, userData, comp);
    group.add(housing);

    // Warm 3000K glowing opal diffuser core flush with the panel face
    const diffuser = new THREE.Mesh(box, material);
    diffuser.scale.set(Math.max(3, w * 0.86), Math.max(3, h * 0.86), Math.max(3, d * 0.86));
    diffuser.position.set(cx, cy, cz + 0.5);
    tagSubMesh(diffuser, userData, comp);
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

    // Top Dark Anti-Slip Rubber Insert Strip
    const rubberStrip = new THREE.Mesh(box, darkDamperMat);
    rubberStrip.scale.set(Math.max(40, w - 12), 3, 6);
    rubberStrip.position.set(cx, cy + 12.5, cz);
    tagSubMesh(rubberStrip, userData, comp);
    group.add(rubberStrip);

    // Subtle Realistic Coat Hanger Hooks & Shoulder Bars along the rail
    const hangerCount = Math.min(5, Math.max(2, Math.floor((w - 120) / 110)));
    const hStep = (w - 160) / Math.max(1, hangerCount - 1);
    for (let i = 0; i < hangerCount; i++) {
      const hx = cx - (w - 160) / 2 + i * hStep;
      const hook = new THREE.Mesh(cylinderY, chromeHardwareMat);
      hook.scale.set(3.5, 36, 3.5);
      hook.position.set(hx, cy - 18, cz);
      tagSubMesh(hook, userData, comp);
      group.add(hook);

      const shoulder = new THREE.Mesh(box, screwHeadMat);
      shoulder.scale.set(14, 18, Math.min(340, comp.position.z * 1.45));
      shoulder.position.set(hx, cy - 42, cz);
      tagSubMesh(shoulder, userData, comp);
      group.add(shoulder);
    }

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

  // 5E. REALISTIC 3D BAR / KNOB / LONG PROFILE HANDLES FLUSH-MOUNTED ON DOOR FACE (ZERO AIR GAP!)
  if (comp.role === "door_handle" || comp.role === "drawer_handle") {
    const w = comp.dimensions.width;
    const h = comp.dimensions.height;
    const d = comp.dimensions.depth;
    // Note: comp.position.z = front.position.z + front.dimensions.depth, so the exact outer face of the door leaf is at z_local = cz - d * 0.5!
    const doorFaceZ = cz - d * 0.5;

    if (comp.handleCategory === "knob") {
      // Stem embeds 2mm into the door panel and extends 12mm outward to the knob cap
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
      tagSubMesh(cap, userData, comp);
      group.add(cap);
      return group;
    }

    // Bar handle (vertical or horizontal) with 2 standoff legs directly embedded into the door face (doorFaceZ - 2mm) and bridged by the grip bar
    const isVertical = h > w * 1.5;
    const barW = isVertical ? Math.max(11, w) : Math.max(96, w);
    const barH = isVertical ? Math.max(128, h) : Math.max(11, h);
    const barD = 10;
    const postLen = 16; // Standoff projection from door surface

    const span = isVertical ? Math.max(36, barH * 0.78) : Math.max(36, barW * 0.78);
    [-span / 2, span / 2].forEach((offset) => {
      const post = new THREE.Mesh(cylinder, material);
      post.scale.set(10, 10, postLen);
      post.position.set(
        cx + (isVertical ? 0 : offset),
        cy + (isVertical ? offset : 0),
        doorFaceZ + postLen / 2 - 2
      );
      tagSubMesh(post, userData, comp);
      group.add(post);
    });

    const barMesh = new THREE.Mesh(box, material);
    barMesh.scale.set(barW, barH, barD);
    // Sits directly on the outer tips of the two standoff posts with 2mm overlap — zero gap!
    barMesh.position.set(cx, cy, doorFaceZ + postLen - 3 + barD / 2);
    tagSubMesh(barMesh, userData, comp);
    barMesh.add(new THREE.LineSegments(edges, revealShadowMat));
    group.add(barMesh);
    return group;
  }

  // 6. STANDARD PANEL & COMPONENT MESH WITH REALISTIC REVEAL SEAM DEFINITION + DOOR OPENING DIRECTION INDICATOR
  const mesh = new THREE.Mesh(
    comp.primitive === "sphere"
      ? sphere
      : comp.primitive === "cylinder"
      ? cylinder
      : box,
    material
  );
  mesh.scale.set(comp.dimensions.width, comp.dimensions.height, comp.dimensions.depth);
  mesh.position.set(cx, cy, cz);
  tagSubMesh(mesh, userData, comp);

  if (!comp.primitive || comp.primitive === "box") {
    mesh.add(new THREE.LineSegments(edges, edgeMaterial));
    // Add crisp dark shadow reveal outline on doors, drawer fronts, and countertops so seams are always distinct
    if (
      comp.role === "door_left" ||
      comp.role === "door_right" ||
      comp.role === "drawer_front" ||
      comp.role === "countertop"
    ) {
      const revealFrame = new THREE.LineSegments(edges, revealShadowMat);
      revealFrame.scale.set(1.002, 1.002, 1.002);
      mesh.add(revealFrame);
    }

    // Add architectural Opening-Direction V-Lines on Hinged Cabinet Doors (door_left / door_right)
    // Pointing from the top & bottom hinge corners toward the handle edge so door swing direction is unmistakable in 3D Perspective
    if (comp.role === "door_left" || comp.role === "door_right") {
      const isLiftDoor = comp.id.includes("lift_");
      const sharedDirGeo = isLiftDoor
        ? liftDoorDirectionGeo
        : comp.role === "door_left"
        ? leftDoorDirectionGeo
        : rightDoorDirectionGeo;
      mesh.add(new THREE.LineSegments(sharedDirGeo, doorDirectionLineMat));
    }
  }
  group.add(mesh);

  // 6B. 3D CNC DOOR CROSS-SECTION PROFILE RENDERING (Shaker Frame / Fluted Ribbed / 45° Bevel / Custom DXF-SVG CAD Profile)
  if (comp.role === "door_left" || comp.role === "door_right" || comp.role === "drawer_front") {
    const activeProfile =
      comp.crossSectionProfile ||
      (comp.handleCategory === "decorative_bespoke" ? "shaker_frame" : "flat_slab");
    const w = comp.dimensions.width;
    const h = comp.dimensions.height;
    const d = comp.dimensions.depth;

    if (activeProfile === "shaker_frame" && w > 160 && h > 160) {
      const stileW = Math.min(68, Math.max(38, Math.round(w * 0.14)));
      const innerW = Math.max(40, w - 2 * stileW);
      const innerH = Math.max(40, h - 2 * stileW);
      // Recessed shadow frame + raised 6mm outer Shaker stiles & rails
      const recessWell = new THREE.Mesh(box, darkCavityMat);
      recessWell.scale.set(innerW + 4, innerH + 4, 2.5);
      recessWell.position.set(cx, cy, cz + d * 0.5 - 0.5);
      tagSubMesh(recessWell, userData, comp);
      group.add(recessWell);

      const centerPanel = new THREE.Mesh(box, material);
      centerPanel.scale.set(innerW - 4, innerH - 4, 2.5);
      centerPanel.position.set(cx, cy, cz + d * 0.5 + 0.4);
      centerPanel.add(new THREE.LineSegments(edges, revealShadowMat));
      tagSubMesh(centerPanel, userData, comp);
      group.add(centerPanel);

      // Left, Right, Top, Bottom 5mm Raised Shaker Frame Bars
      const frameBars = [
        { sx: stileW, sy: h, px: cx - w / 2 + stileW / 2, py: cy },
        { sx: stileW, sy: h, px: cx + w / 2 - stileW / 2, py: cy },
        { sx: innerW, sy: stileW, px: cx, py: cy + h / 2 - stileW / 2 },
        { sx: innerW, sy: stileW, px: cx, py: cy - h / 2 + stileW / 2 },
      ];
      frameBars.forEach((fb) => {
        const bar = new THREE.Mesh(box, material);
        bar.scale.set(fb.sx, fb.sy, 4.5);
        bar.position.set(fb.px, fb.py, cz + d * 0.5 + 2.2);
        bar.add(new THREE.LineSegments(edges, revealShadowMat));
        tagSubMesh(bar, userData, comp);
        group.add(bar);
      });
    } else if (activeProfile === "fluted_ribbed" && w > 120) {
      // Vertical CNC Fluted / Ribbed Slats across the door front
      const slatPitch = 36;
      const slatCount = Math.min(28, Math.max(4, Math.floor((w - 24) / slatPitch)));
      const spanW = w - 28;
      const stepX = spanW / Math.max(1, slatCount - 1);
      for (let s = 0; s < slatCount; s++) {
        const slat = new THREE.Mesh(box, material);
        slat.scale.set(Math.max(10, stepX * 0.62), h - 16, 4.5);
        slat.position.set(cx - spanW / 2 + s * stepX, cy, cz + d * 0.5 + 2.2);
        slat.add(new THREE.LineSegments(edges, revealShadowMat));
        tagSubMesh(slat, userData, comp);
        group.add(slat);
      }
    } else if (activeProfile === "bevel_45" && w > 120 && h > 120) {
      // TRUE 3D 45°-SLOPED PERIMETER CHAMFER (matches the 2D trapezoidal cross-section 1-to-1!)
      // Back 8mm is straight edge-banded base; front 12mm slopes inward at a 45° angle (32mm visual chamfer width)
      mesh.scale.set(w, h, Math.max(6, d * 0.42));
      mesh.position.set(cx, cy, cz - d * 0.29);

      const bevelDepth = Math.max(10, d * 0.68);
      const bevelSlopeW = 32;
      const { frustumGeo, frustumEdges } = getCachedBevel45Frustum(w, h, bevelDepth, bevelSlopeW);
      const frustumMesh = new THREE.Mesh(frustumGeo, material);
      frustumMesh.position.set(cx, cy, cz + d * 0.22);
      frustumMesh.add(new THREE.LineSegments(frustumEdges, revealShadowMat));
      tagSubMesh(frustumMesh, userData, comp);
      group.add(frustumMesh);
    } else if (activeProfile === "custom_cad_profile" && w > 140 && h > 140) {
      const poly = comp.customCadPolygon;
      const firstPtY = poly && poly.length >= 3 ? poly[1]?.y ?? 0.65 : 0.65;
      const bevelSlopeMm = Math.max(14, Math.min(44, Math.round(firstPtY * 34)));
      const { frustumGeo, frustumEdges } = getCachedBevel45Frustum(w, h, 8, bevelSlopeMm);
      const outerBevel = new THREE.Mesh(frustumGeo, material);
      outerBevel.position.set(cx, cy, cz + d * 0.5 + 3);
      outerBevel.add(new THREE.LineSegments(frustumEdges, revealShadowMat));
      tagSubMesh(outerBevel, userData, comp);
      group.add(outerBevel);

      if (w > 200 && h > 200) {
        const grooveInset = Math.max(42, bevelSlopeMm * 2 + 12);
        const grooveWell = new THREE.Mesh(box, darkCavityMat);
        grooveWell.scale.set(w - grooveInset, h - grooveInset, 3);
        grooveWell.position.set(cx, cy, cz + d * 0.5 + 6.2);
        tagSubMesh(grooveWell, userData, comp);
        group.add(grooveWell);

        const innerField = new THREE.Mesh(box, material);
        innerField.scale.set(w - grooveInset - 26, h - grooveInset - 26, 4.2);
        innerField.position.set(cx, cy, cz + d * 0.5 + 7.8);
        innerField.add(new THREE.LineSegments(edges, revealShadowMat));
        tagSubMesh(innerField, userData, comp);
        group.add(innerField);
      }
    } else if (
      (activeProfile === "glass_frame" || comp.materialId === "mat_smoked_glass") &&
      w > 140 &&
      h > 140
    ) {
      // Framed Showcase Glass Door (Cam Kapak): Hide solid slab, build 4 outer frame stiles/rails + translucent smoked glass center pane!
      mesh.visible = false;
      const frameW = Math.min(54, Math.max(32, Math.round(w * 0.11)));
      const innerW = Math.max(40, w - 2 * frameW);
      const innerH = Math.max(40, h - 2 * frameW);
      const frameBars = [
        { sx: frameW, sy: h, px: cx - w / 2 + frameW / 2, py: cy },
        { sx: frameW, sy: h, px: cx + w / 2 - frameW / 2, py: cy },
        { sx: innerW, sy: frameW, px: cx, py: cy + h / 2 - frameW / 2 },
        { sx: innerW, sy: frameW, px: cx, py: cy - h / 2 + frameW / 2 },
      ];
      frameBars.forEach((fb) => {
        const bar = new THREE.Mesh(box, material);
        bar.scale.set(fb.sx, fb.sy, d);
        bar.position.set(fb.px, fb.py, cz);
        bar.add(new THREE.LineSegments(edges, revealShadowMat));
        tagSubMesh(bar, userData, comp);
        group.add(bar);
      });
      const glassPane = new THREE.Mesh(box, sharedSmokedGlassPaneMat);
      glassPane.scale.set(innerW, innerH, Math.max(6, d * 0.35));
      glassPane.position.set(cx, cy, cz);
      glassPane.add(new THREE.LineSegments(edges, revealShadowMat));
      tagSubMesh(glassPane, userData, comp);
      group.add(glassPane);
    } else if (
      (activeProfile === "mirror_door" || comp.materialId === "mat_bronze_mirror") &&
      w > 140 &&
      h > 140
    ) {
      const rimW = 24;
      const mirrorW = Math.max(40, w - 2 * rimW);
      const mirrorH = Math.max(40, h - 2 * rimW);
      const mirrorMat =
        comp.materialId === "mat_bronze_mirror"
          ? sharedBronzeMirrorPaneMat
          : sharedSilverMirrorPaneMat;
      const mirrorPane = new THREE.Mesh(box, mirrorMat);
      mirrorPane.scale.set(mirrorW, mirrorH, 3.5);
      mirrorPane.position.set(cx, cy, cz + d * 0.5 + 1.5);
      mirrorPane.add(new THREE.LineSegments(edges, revealShadowMat));
      tagSubMesh(mirrorPane, userData, comp);
      group.add(mirrorPane);
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
