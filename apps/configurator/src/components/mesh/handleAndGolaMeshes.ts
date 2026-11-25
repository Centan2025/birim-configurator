import * as THREE from "three";
import {
  box,
  cylinder,
  cylinderRimEdges,
  edges,
  darkDamperMat,
  screwHeadMat,
  chromeHardwareMat,
  darkCavityMat,
  revealShadowMat,
  tagSubMesh,
} from "./sharedMeshMaterialsAndPrimitives";
import { getCachedBeveledPanelGeometry } from "./cachedPanelGeometries";
import type { ComponentMeshBuildContext } from "./hardwareAndFittingMeshes";

export function tryBuildOrAugmentHandleAndGolaMesh(ctx: ComponentMeshBuildContext): THREE.Group | null {
  const { comp, material, edgeMaterial, userData, group, cx, cy, cz } = ctx;
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

    // Case 2: Melamine / Veneer 2-Piece Recessed Finger Box ("Gola de Melamina") & Moulded Recessed Finger Box
    // - Top (`gola_moulded_box` / `gola_melamine_box`): L-shaped (vertical back + bottom flange)
    // - Intermediate (`_mid`, between drawers): U-shaped (vertical back + top flange + bottom flange, zero aluminum brackets!)
    if (cid.includes("gola_melamine_box") || cid.includes("gola_moulded_box")) {
      const boardT = cid.includes("gola_moulded_box") ? 12 : 16;
      const isMidUBox = cid.includes("_mid");
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

      if (isMidUBox) {
        const hTop = new THREE.Mesh(box, material);
        hTop.scale.set(w, boardT, d);
        hTop.position.set(cx, cy + h / 2 - boardT / 2, cz);
        hTop.add(new THREE.LineSegments(edges, revealShadowMat));
        tagSubMesh(hTop, userData, comp);
        group.add(hTop);
      }
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
  return null;
}
