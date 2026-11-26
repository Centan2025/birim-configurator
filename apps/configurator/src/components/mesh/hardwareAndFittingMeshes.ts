import * as THREE from "three";
import { ComponentGeometry } from "@birim/geometry";
import { box, sphere, cylinder, cylinderY, darkDamperMat, screwHeadMat, chromeHardwareMat, darkCavityMat, tagSubMesh } from "./sharedMeshMaterialsAndPrimitives";
import { tryBuildArchitecturalOrMechanismMesh } from "./architecturalAndMechanismMeshes";
import { markSharedMaterial } from "../../v3/materials/webglResourceGuard";

const SHARED_ZINC_STEEL_MAT = markSharedMaterial(
  new THREE.MeshStandardMaterial({ color: 0xe6ecf4, metalness: 0.95, roughness: 0.17, envMapIntensity: 1.45 })
);
const SHARED_INNER_CARRIAGE_MAT = markSharedMaterial(
  new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.92, roughness: 0.21, envMapIntensity: 1.35 })
);
const SHARED_DARK_POLYMER_MAT = markSharedMaterial(
  new THREE.MeshStandardMaterial({ color: 0x26292e, metalness: 0.12, roughness: 0.68 })
);
const SHARED_LATCH_BLUM_MAT = markSharedMaterial(
  new THREE.MeshStandardMaterial({ color: 0xea580c, metalness: 0.08, roughness: 0.45 })
);
const SHARED_LATCH_HETTICH_MAT = markSharedMaterial(
  new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.08, roughness: 0.45 })
);
const SHARED_BRUSHED_ALU_MAT = markSharedMaterial(
  new THREE.MeshStandardMaterial({ color: 0xdbe3ec, metalness: 0.93, roughness: 0.2, envMapIntensity: 1.4 })
);
const SHARED_CHROME_ROD_MAT = markSharedMaterial(
  new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.97, roughness: 0.12, envMapIntensity: 1.5 })
);
const SHARED_SLIDE_CAP_MAT = markSharedMaterial(
  new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.35, roughness: 0.45 })
);
const SHARED_CHROME_METAL_MAT = markSharedMaterial(
  new THREE.MeshStandardMaterial({ color: 0xeef2f6, metalness: 0.96, roughness: 0.14, envMapIntensity: 1.5 })
);
const SHARED_BRUSHED_STEEL_MAT = markSharedMaterial(
  new THREE.MeshStandardMaterial({ color: 0xd5dce6, metalness: 0.92, roughness: 0.22, envMapIntensity: 1.35 })
);
const SHARED_DARK_ANODIZED_MAT = markSharedMaterial(
  new THREE.MeshStandardMaterial({ color: 0x22252a, metalness: 0.25, roughness: 0.55 })
);
const SHARED_TRAY_SURFACE_MAT = markSharedMaterial(
  new THREE.MeshStandardMaterial({ color: 0xf4f1ea, metalness: 0.05, roughness: 0.52 })
);

export interface ComponentMeshBuildContext {
  comp: ComponentGeometry;
  material: THREE.Material;
  edgeMaterial: THREE.LineBasicMaterial;
  userData: Record<string, unknown>;
  group: THREE.Group;
  cx: number;
  cy: number;
  cz: number;
}

export function tryBuildHardwareOrFittingMesh(ctx: ComponentMeshBuildContext): THREE.Group | null {
  const { comp, material, edgeMaterial, userData, group, cx, cy, cz } = ctx;
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

    const zincSteelMat = SHARED_ZINC_STEEL_MAT;
    const innerCarriageMat = SHARED_INNER_CARRIAGE_MAT;
    const darkPolymerMat = SHARED_DARK_POLYMER_MAT;
    const latchAccentMat = isHettich ? SHARED_LATCH_HETTICH_MAT : SHARED_LATCH_BLUM_MAT;

    // A. Outer Carcass Mounting C-Channel (bolted flush to carcass side wall, strictly bounded to `h`)
    const wallX = isRightSlide ? w - 2.2 : 2.2;
    const outerWeb = new THREE.Mesh(box, zincSteelMat);
    outerWeb.scale.set(2.8, Math.max(10, h * 0.92), railLen);
    outerWeb.position.set(wallX, cy, cz);
    tagSubMesh(outerWeb, userData, comp);
    group.add(outerWeb);

    [-1, 1].forEach((vy) => {
      const flange = new THREE.Mesh(box, zincSteelMat);
      flange.scale.set(8.5, 2.0, railLen * 0.98);
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
      screw.scale.set(5.0, 2.4, 5.0);
      screw.position.set(wallX + inwardSign * 1.8, cy, sz);
      tagSubMesh(screw, userData, comp);
      group.add(screw);
    });

    // B. Middle Telescopic Synchronized Carriage + Ball/Roller Cage
    const midX = wallX + inwardSign * 6.4;
    const midCarriage = new THREE.Mesh(box, innerCarriageMat);
    midCarriage.scale.set(4.8, Math.max(8, h * 0.52), railLen * 0.88);
    midCarriage.position.set(midX, cy, cz + railLen * 0.04);
    tagSubMesh(midCarriage, userData, comp);
    group.add(midCarriage);

    const rollerCage = new THREE.Mesh(box, darkPolymerMat);
    rollerCage.scale.set(2.6, Math.min(7.5, h * 0.42), railLen * 0.56);
    rollerCage.position.set(midX - inwardSign * 1.4, cy, cz);
    tagSubMesh(rollerCage, userData, comp);
    group.add(rollerCage);

    // C. Inner Undermount Drawer Support L-Rail (flush against underside of drawer bottom!)
    const innerX = wallX + inwardSign * 11.2;
    const supportShelf = new THREE.Mesh(box, zincSteelMat);
    supportShelf.scale.set(8.8, 2.8, railLen * 0.94);
    supportShelf.position.set(innerX, cy + h * 0.36, cz + railLen * 0.02);
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

    const brushedAluMat = SHARED_BRUSHED_ALU_MAT;
    const chromeRodMat = SHARED_CHROME_ROD_MAT;
    const capMat = SHARED_SLIDE_CAP_MAT;

    const isHighGallery = h >= 150;
    const baseWallH = isHighGallery ? Math.min(92, h * 0.56) : h;
    const sideWall = new THREE.Mesh(box, brushedAluMat);
    sideWall.scale.set(Math.max(10, w), baseWallH, d);
    sideWall.position.set(cx, baseWallH / 2, cz);
    tagSubMesh(sideWall, userData, comp);
    group.add(sideWall);

    const topTrim = new THREE.Mesh(box, chromeRodMat);
    topTrim.scale.set(Math.max(10.5, w + 0.5), 2.4, d);
    topTrim.position.set(cx, isHighGallery ? baseWallH + 1.2 : Math.max(2, h - 1.2), cz);
    tagSubMesh(topTrim, userData, comp);
    group.add(topTrim);

    const brandCap = new THREE.Mesh(box, capMat);
    brandCap.scale.set(1.8, 12, 34);
    brandCap.position.set(cx + inward * (w / 2 + 0.6), baseWallH * 0.62, d - 68);
    tagSubMesh(brandCap, userData, comp);
    group.add(brandCap);

    // High pot-and-pan gallery railing rod (axis along Z -> `cylinder` with NO rotation!)
    if (isHighGallery && h > baseWallH + 18) {
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

    const chromeMetalMat = SHARED_CHROME_METAL_MAT;
    const brushedSteelMat = SHARED_BRUSHED_STEEL_MAT;
    const darkAnodizedMat = SHARED_DARK_ANODIZED_MAT;
    const traySurfaceMat = SHARED_TRAY_SURFACE_MAT;

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

    // 5. Kesseböhmer LeMans II Corner Kidney Trays (Strictly anchored to pivot-relative local origin ox/oy/oz so closed trays stay 100% inside cabinet!)
    if (idLower.includes("lemans") || lblLower.includes("lemans") || lblLower.includes("köşe")) {
      const ox = cx - w / 2;
      const oy = cy - h / 2;
      const oz = cz - d / 2;
      const poleX = ox + w * 0.22;
      const poleZ = oz + d * 0.28;
      const pole = new THREE.Mesh(cylinderY, chromeMetalMat);
      pole.scale.set(24, Math.max(240, h), 24);
      pole.position.set(poleX, cy, poleZ);
      tagSubMesh(pole, userData, comp);
      group.add(pole);

      // Top & bottom pole mounting flanges
      [oy + 8, oy + h - 8].forEach((fy) => {
        const flange = new THREE.Mesh(cylinderY, darkAnodizedMat);
        flange.scale.set(44, 12, 44);
        flange.position.set(poleX, fy, poleZ);
        tagSubMesh(flange, userData, comp);
        group.add(flange);
      });

      [oy + h * 0.28, oy + h * 0.72].forEach((ty) => {
        // Swing arm bracket connecting pole to tray underside
        const arm = new THREE.Mesh(box, brushedSteelMat);
        arm.scale.set(w * 0.42, 10, 24);
        arm.position.set(poleX + w * 0.18, ty - 10, poleZ + d * 0.14);
        tagSubMesh(arm, userData, comp);
        group.add(arm);

        const trayLobe1 = new THREE.Mesh(cylinderY, traySurfaceMat);
        trayLobe1.scale.set(w * 0.48, 14, d * 0.52);
        trayLobe1.position.set(ox + w * 0.34, ty, oz + d * 0.45);
        tagSubMesh(trayLobe1, userData, comp);
        group.add(trayLobe1);

        const trayLobe2 = new THREE.Mesh(cylinderY, traySurfaceMat);
        trayLobe2.scale.set(w * 0.44, 14, d * 0.46);
        trayLobe2.position.set(ox + w * 0.65, ty, oz + d * 0.54);
        tagSubMesh(trayLobe2, userData, comp);
        group.add(trayLobe2);

        // Connected vertical chrome posts + perimeter top rim bars
        const postCoords: [number, number][] = [
          [ox + w * 0.15, oz + d * 0.45],
          [ox + w * 0.34, oz + d * 0.24],
          [ox + w * 0.56, oz + d * 0.36],
          [ox + w * 0.82, oz + d * 0.54],
          [ox + w * 0.65, oz + d * 0.74],
          [ox + w * 0.34, oz + d * 0.67],
        ];
        postCoords.forEach(([px, pz]) => {
          const post = new THREE.Mesh(cylinderY, chromeMetalMat);
          post.scale.set(6, 36, 6);
          post.position.set(px, ty + 22, pz);
          tagSubMesh(post, userData, comp);
          group.add(post);
        });
        const rimBand1 = new THREE.Mesh(box, chromeMetalMat);
        rimBand1.scale.set(w * 0.46, 5, 5);
        rimBand1.position.set(ox + w * 0.42, ty + 38, oz + d * 0.25);
        tagSubMesh(rimBand1, userData, comp);
        group.add(rimBand1);

        const rimBand2 = new THREE.Mesh(box, chromeMetalMat);
        rimBand2.scale.set(w * 0.50, 5, 5);
        rimBand2.position.set(ox + w * 0.52, ty + 38, oz + d * 0.71);
        tagSubMesh(rimBand2, userData, comp);
        group.add(rimBand2);

        // Showroom Kitchenware Props: Stainless Steel Stockpot + Ceramic Bowl sitting flush on tray
        const potBody = new THREE.Mesh(cylinderY, chromeMetalMat);
        potBody.scale.set(Math.min(175, w * 0.22), 95, Math.min(175, w * 0.22));
        potBody.position.set(ox + w * 0.36, ty + 8 + 47.5, oz + d * 0.45);
        tagSubMesh(potBody, userData, comp);
        group.add(potBody);

        const potLid = new THREE.Mesh(cylinderY, brushedSteelMat);
        potLid.scale.set(Math.min(180, w * 0.23), 8, Math.min(180, w * 0.23));
        potLid.position.set(ox + w * 0.36, ty + 8 + 98, oz + d * 0.45);
        tagSubMesh(potLid, userData, comp);
        group.add(potLid);

        const potKnob = new THREE.Mesh(cylinderY, darkAnodizedMat);
        potKnob.scale.set(26, 14, 26);
        potKnob.position.set(ox + w * 0.36, ty + 8 + 108, oz + d * 0.45);
        tagSubMesh(potKnob, userData, comp);
        group.add(potKnob);

        const ceramicMat = new THREE.MeshStandardMaterial({ color: 0xe6dfd5, roughness: 0.35, metalness: 0.04 });
        const bowl = new THREE.Mesh(cylinderY, ceramicMat);
        bowl.scale.set(Math.min(135, w * 0.17), 60, Math.min(135, w * 0.17));
        bowl.position.set(ox + w * 0.65, ty + 8 + 30, oz + d * 0.54);
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

    // 7. Servetto / Häfele Pull-Down Wardrobe Lift (Realistic Hydraulic Side Housings + Telescopic Lift Arms + Curved U-Bends + Telescopic Bar + Pull Wand)
    if (idLower.includes("wardrobe_lift") || idLower.includes("pantograph") || lblLower.includes("asansör") || lblLower.includes("pantograf")) {
      const topBarY = Math.max(180, h - 22);
      const pivotY = Math.max(46, Math.min(topBarY - 160, Math.round(h * 0.14)));
      const bendR = 32;
      const armTopY = Math.max(pivotY + 60, topBarY - bendR);
      const armLen = Math.max(60, armTopY - pivotY);
      const housingH = Math.min(138, Math.max(96, h * 0.18));
      const housingD = Math.min(96, Math.max(68, d * 0.18));
      const railRadius = 11;

      const rubberStopMat = new THREE.MeshStandardMaterial({
        color: 0x181a1f,
        roughness: 0.85,
        metalness: 0.05,
      });

      const bendGeo = new THREE.TorusGeometry(bendR, railRadius, 12, 16, Math.PI / 2);

      [-1, 1].forEach((sx) => {
        const isLeft = sx < 0;
        const wallX = isLeft ? 13 : w - 13;
        const armX = isLeft ? 34 : w - 34;

        // Wall-mounted back flange plate
        const mountPlate = new THREE.Mesh(box, darkAnodizedMat);
        mountPlate.scale.set(4, housingH + 14, housingD + 14);
        mountPlate.position.set(isLeft ? 2 : w - 2, pivotY, cz);
        tagSubMesh(mountPlate, userData, comp);
        group.add(mountPlate);

        // Hydraulic damper housing body
        const housing = new THREE.Mesh(box, darkAnodizedMat);
        housing.scale.set(22, housingH, housingD);
        housing.position.set(wallX, pivotY, cz);
        tagSubMesh(housing, userData, comp);
        group.add(housing);

        // Front bumper / soft-return damper stop
        const bumper = new THREE.Mesh(cylinderY, rubberStopMat);
        bumper.rotation.z = Math.PI / 2;
        bumper.scale.set(16, 12, 16);
        bumper.position.set(wallX - sx * 10, pivotY + housingH * 0.24, cz + housingD * 0.34);
        tagSubMesh(bumper, userData, comp);
        group.add(bumper);

        // Circular hydraulic pivot hub + chrome axle cap
        const pivotHub = new THREE.Mesh(cylinderY, rubberStopMat);
        pivotHub.rotation.z = Math.PI / 2;
        pivotHub.scale.set(44, 14, 44);
        pivotHub.position.set(wallX - sx * 12, pivotY, cz);
        tagSubMesh(pivotHub, userData, comp);
        group.add(pivotHub);

        const pivotCap = new THREE.Mesh(cylinderY, chromeMetalMat);
        pivotCap.rotation.z = Math.PI / 2;
        pivotCap.scale.set(20, 18, 20);
        pivotCap.position.set(wallX - sx * 15, pivotY, cz);
        tagSubMesh(pivotCap, userData, comp);
        group.add(pivotCap);

        // Lower telescopic flat-profile lift arm (anthracite steel)
        const lowerArmLen = armLen * 0.54;
        const lowerArm = new THREE.Mesh(box, darkAnodizedMat);
        lowerArm.scale.set(12, lowerArmLen, 24);
        lowerArm.position.set(armX, pivotY + lowerArmLen / 2, cz);
        tagSubMesh(lowerArm, userData, comp);
        group.add(lowerArm);

        // Mid collar sleeve between lower & upper arm
        const midCollar = new THREE.Mesh(box, rubberStopMat);
        midCollar.scale.set(16, 16, 28);
        midCollar.position.set(armX, pivotY + lowerArmLen, cz);
        tagSubMesh(midCollar, userData, comp);
        group.add(midCollar);

        // Upper chrome round lift arm
        const upperArmLen = Math.max(24, armLen - lowerArmLen);
        const upperArm = new THREE.Mesh(cylinderY, chromeMetalMat);
        upperArm.scale.set(railRadius * 2, upperArmLen, railRadius * 2);
        upperArm.position.set(armX, pivotY + lowerArmLen + upperArmLen / 2, cz);
        tagSubMesh(upperArm, userData, comp);
        group.add(upperArm);

        // Smooth 90-degree curved chrome elbow connecting vertical arm to horizontal bar
        const bend = new THREE.Mesh(bendGeo, chromeMetalMat);
        if (isLeft) {
          bend.position.set(armX + bendR, armTopY, cz);
          bend.rotation.z = Math.PI / 2;
        } else {
          bend.position.set(armX - bendR, armTopY, cz);
          bend.rotation.z = 0;
        }
        tagSubMesh(bend, userData, comp);
        group.add(bend);
      });

      // Horizontal telescopic chrome hanging bar spanning between curved elbows
      const barSpan = Math.max(80, w - 2 * (34 + bendR));
      const topBar = new THREE.Mesh(cylinderY, chromeMetalMat);
      topBar.rotation.z = Math.PI / 2;
      topBar.scale.set(railRadius * 2, barSpan, railRadius * 2);
      topBar.position.set(cx, topBarY, cz);
      tagSubMesh(topBar, userData, comp);
      group.add(topBar);

      // Subtle anti-slip PVC ridge along top of bar
      const antiSlip = new THREE.Mesh(box, rubberStopMat);
      antiSlip.scale.set(barSpan * 0.94, 3, 5);
      antiSlip.position.set(cx, topBarY + railRadius + 0.5, cz);
      tagSubMesh(antiSlip, userData, comp);
      group.add(antiSlip);

      // Central swivel collar + telescopic chrome pull-down wand + ergonomic T-handle grip
      const collar = new THREE.Mesh(cylinderY, rubberStopMat);
      collar.rotation.z = Math.PI / 2;
      collar.scale.set(30, 34, 30);
      collar.position.set(cx, topBarY, cz);
      tagSubMesh(collar, userData, comp);
      group.add(collar);

      const wandLen = Math.min(640, Math.max(260, armLen * 0.86));
      const pullWand = new THREE.Mesh(cylinderY, chromeMetalMat);
      pullWand.scale.set(10, wandLen, 10);
      pullWand.position.set(cx, topBarY - wandLen / 2, cz);
      tagSubMesh(pullWand, userData, comp);
      group.add(pullWand);

      // Ergonomic T-handle grip at bottom of pull wand
      const gripStem = new THREE.Mesh(cylinderY, rubberStopMat);
      gripStem.scale.set(16, 22, 16);
      gripStem.position.set(cx, topBarY - wandLen + 6, cz);
      tagSubMesh(gripStem, userData, comp);
      group.add(gripStem);

      const wandGrip = new THREE.Mesh(cylinderY, rubberStopMat);
      wandGrip.rotation.z = Math.PI / 2;
      wandGrip.scale.set(18, 108, 18);
      wandGrip.position.set(cx, topBarY - wandLen, cz);
      tagSubMesh(wandGrip, userData, comp);
      group.add(wandGrip);

      [-54, 54].forEach((gx) => {
        const cap = new THREE.Mesh(cylinderY, chromeMetalMat);
        cap.rotation.z = Math.PI / 2;
        cap.scale.set(16, 6, 16);
        cap.position.set(cx + gx, topBarY - wandLen, cz);
        tagSubMesh(cap, userData, comp);
        group.add(cap);
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

  return tryBuildArchitecturalOrMechanismMesh(ctx);
}
