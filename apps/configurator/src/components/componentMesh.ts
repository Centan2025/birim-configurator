import * as THREE from "three";
import { calculateModulePlacement, ModuleInstance } from "@birim/core";
import { ComponentGeometry } from "@birim/geometry";

const box = new THREE.BoxGeometry(1, 1, 1);
const sphere = new THREE.SphereGeometry(0.5, 20, 14);
const cylinder = new THREE.CylinderGeometry(0.5, 0.5, 1, 20);
cylinder.rotateX(Math.PI / 2);
const cylinderY = new THREE.CylinderGeometry(0.5, 0.5, 1, 20);
const edges = new THREE.EdgesGeometry(box);

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

const customAccentMaterials = new Set<THREE.Material>([
  darkDamperMat,
  screwHeadMat,
  chromeHardwareMat,
  blumAccentMat,
  darkCavityMat,
  burnerRingMat,
  handleAccentMat,
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

  // 5E. REALISTIC 3D BAR / KNOB / LONG PROFILE HANDLES WITH STANDOFF LEGS
  if (comp.role === "door_handle" || comp.role === "drawer_handle") {
    const w = comp.dimensions.width;
    const h = comp.dimensions.height;
    const d = comp.dimensions.depth;

    if (comp.handleCategory === "knob") {
      const stem = new THREE.Mesh(cylinder, screwHeadMat);
      stem.scale.set(Math.min(14, w * 0.5), Math.min(14, h * 0.5), d * 0.6);
      stem.position.set(cx, cy, cz - d * 0.15);
      tagSubMesh(stem, userData, comp);
      group.add(stem);

      const cap = new THREE.Mesh(cylinder, material);
      cap.scale.set(Math.max(24, w * 1.15), Math.max(24, h * 1.15), Math.max(12, d * 0.55));
      cap.position.set(cx, cy, cz + d * 0.28);
      tagSubMesh(cap, userData, comp);
      group.add(cap);
      return group;
    }

    // Bar handle (vertical or horizontal) with 2 cylindrical standoff posts + high-visibility edge ring
    const isVertical = h > w * 1.5;
    const barW = isVertical ? Math.max(13, w * 1.15) : Math.max(96, w);
    const barH = isVertical ? Math.max(128, h) : Math.max(13, h * 1.15);
    const barD = Math.max(13, d * 0.45);

    const barMesh = new THREE.Mesh(isVertical ? cylinderY : box, material);
    barMesh.scale.set(barW, barH, barD);
    barMesh.position.set(cx, cy, cz + d * 0.34);
    tagSubMesh(barMesh, userData, comp);
    if (!isVertical) {
      barMesh.add(new THREE.LineSegments(edges, revealShadowMat));
    }
    group.add(barMesh);

    const span = isVertical ? Math.max(36, barH * 0.72) : Math.max(36, barW * 0.72);
    [-span / 2, span / 2].forEach((offset) => {
      const post = new THREE.Mesh(cylinder, handleAccentMat);
      post.scale.set(11, 11, d * 0.78);
      post.position.set(
        cx + (isVertical ? 0 : offset),
        cy + (isVertical ? offset : 0),
        cz - d * 0.05
      );
      tagSubMesh(post, userData, comp);
      group.add(post);
    });
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
      const faceZ = 0.52;
      if (isLiftDoor) {
        // Lift-up door: V-lines point from bottom left/right corners to top center hinge
        const liftPts = new Float32Array([
          -0.46, -0.45, faceZ,
          0.0, 0.45, faceZ,
          0.0, 0.45, faceZ,
          0.46, -0.45, faceZ,
        ]);
        const liftGeo = new THREE.BufferGeometry();
        liftGeo.setAttribute("position", new THREE.BufferAttribute(liftPts, 3));
        mesh.add(new THREE.LineSegments(liftGeo, doorDirectionLineMat));
      } else {
        const isLeftHinged = comp.role === "door_left";
        const hingeX = isLeftHinged ? -0.48 : 0.48;
        const handleX = isLeftHinged ? 0.45 : -0.45;
        const dirPts = new Float32Array([
          hingeX, 0.46, faceZ,
          handleX, 0.0, faceZ,
          handleX, 0.0, faceZ,
          hingeX, -0.46, faceZ,
        ]);
        const dirGeo = new THREE.BufferGeometry();
        dirGeo.setAttribute("position", new THREE.BufferAttribute(dirPts, 3));
        mesh.add(new THREE.LineSegments(dirGeo, doorDirectionLineMat));
      }
    }
  }
  group.add(mesh);

  // 6B. 3D CNC DOOR CROSS-SECTION PROFILE RENDERING (Shaker Frame / Fluted Ribbed / 45° Bevel / Custom DXF-SVG CAD Profile)
  if (
    (comp.role === "door_left" || comp.role === "door_right" || comp.role === "drawer_front") &&
    typeof window !== "undefined"
  ) {
    const activeProfile =
      (window as unknown as { __birimDoorCrossSection?: string }).__birimDoorCrossSection ||
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
      const frustumGeo = createBevel45FrustumGeometry(w, h, bevelDepth, bevelSlopeW);
      const frustumMesh = new THREE.Mesh(frustumGeo, material);
      frustumMesh.position.set(cx, cy, cz + d * 0.22);
      frustumMesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(frustumGeo, 12), revealShadowMat));
      tagSubMesh(frustumMesh, userData, comp);
      group.add(frustumMesh);
    } else if (activeProfile === "custom_cad_profile" && w > 140 && h > 140) {
      // Custom CAD Profile: Outer 45° Bevel + Recessed Inner Groove + Raised Center Field (matches the 2D custom CAD diagram!)
      const frustumGeo = createBevel45FrustumGeometry(w, h, 8, 22);
      const outerBevel = new THREE.Mesh(frustumGeo, material);
      outerBevel.position.set(cx, cy, cz + d * 0.5 + 3);
      outerBevel.add(new THREE.LineSegments(new THREE.EdgesGeometry(frustumGeo, 12), revealShadowMat));
      tagSubMesh(outerBevel, userData, comp);
      group.add(outerBevel);

      if (w > 200 && h > 200) {
        const grooveWell = new THREE.Mesh(box, darkCavityMat);
        grooveWell.scale.set(w - 56, h - 56, 3);
        grooveWell.position.set(cx, cy, cz + d * 0.5 + 6.2);
        tagSubMesh(grooveWell, userData, comp);
        group.add(grooveWell);

        const innerField = new THREE.Mesh(box, material);
        innerField.scale.set(w - 84, h - 84, 4);
        innerField.position.set(cx, cy, cz + d * 0.5 + 7.8);
        innerField.add(new THREE.LineSegments(edges, revealShadowMat));
        tagSubMesh(innerField, userData, comp);
        group.add(innerField);
      }
    }
  }

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
