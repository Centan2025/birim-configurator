import * as THREE from "three";
import { markSharedMaterial } from "../../v3/materials/webglResourceGuard";
import {
  getCachedJPullBevelDoorGeometry,
  getCachedContouredDoorSweepGeometry,
} from "../../v3/materials/capsuleAndProfileGeometry";
import {
  box,
  sphere,
  cylinder,
  edges,
  liftDoorDirectionGeo,
  leftDoorDirectionGeo,
  rightDoorDirectionGeo,
  darkCavityMat,
  revealShadowMat,
  doorDirectionLineMat,
  sharedDarkAnodizedFrameMat,
  sharedSmokedGlassPaneMat,
  sharedBronzeMirrorPaneMat,
  sharedSilverMirrorPaneMat,
  fugaShadowGapMat,
  tagSubMesh,
  disableLineRaycast,
} from "./sharedMeshMaterialsAndPrimitives";
import {
  getCachedBevel45Frustum,
  getCachedTopBevel45Pull,
  getCachedCountertopCutoutGeometry,
  getCachedPentagonCornerGeometry,
  getCachedLShapeCornerGeometry,
  getCachedWorldUvBoxGeometry,
  getCachedBeveledPanelGeometry,
  getCachedMiter45CarcassGeometry,
  getCachedPolygonContourGeometry,
} from "./cachedPanelGeometries";
import type { ComponentMeshBuildContext } from "./hardwareAndFittingMeshes";

export function buildPanelAndDoorProfileMesh(ctx: ComponentMeshBuildContext): THREE.Group {
  const { comp, material, edgeMaterial, userData, group, cx, cy, cz } = ctx;
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

  // 5.86 TRUE 3D SINGLE-PIECE 6-SIDED L-CORNER SLAB (_lshape_wx<X>_wz<Z>) — ZERO SEAM!
  const lShapeMatch = comp.id.match(/_lshape_wx(\d+)_wz(\d+)/);
  if (lShapeMatch) {
    const isCrossL =
      userData?.grainDir === "crosswise" || comp.grainDirection === "crosswise";
    const { geo: lGeo, edges: lEdges } = getCachedLShapeCornerGeometry(
      comp.dimensions.width,
      comp.dimensions.height,
      comp.dimensions.depth,
      Number(lShapeMatch[1]),
      Number(lShapeMatch[2]),
      isCrossL
    );
    const lMesh = new THREE.Mesh(lGeo, material);
    lMesh.position.set(cx, cy, cz);
    tagSubMesh(lMesh, userData, comp);
    group.add(lMesh);

    const lLines = new THREE.LineSegments(lEdges, edgeMaterial);
    lLines.position.set(cx, cy, cz);
    lLines.userData.isPrimaryEdge = true;
    group.add(lLines);
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

  const hasSlopedPolygonContour =
    (!comp.primitive || comp.primitive === "box") &&
    Array.isArray(comp.polygonContourMm) &&
    comp.polygonContourMm.length >= 3 &&
    (comp.thicknessAxis === "x" || comp.thicknessAxis === "z") &&
    comp.dimensions.width >= 2 &&
    comp.dimensions.height >= 12 &&
    comp.dimensions.depth >= 2;
  const polygonContourEntry = hasSlopedPolygonContour
    ? getCachedPolygonContourGeometry(
        comp.dimensions.width,
        comp.dimensions.height,
        comp.dimensions.depth,
        comp.thicknessAxis as "x" | "z",
        comp.polygonContourMm!
      )
    : null;

  const isMiter45CarcassPanel =
    !polygonContourEntry &&
    (!comp.primitive || comp.primitive === "box") &&
    (comp.role === "carcass_top" ||
      comp.role === "carcass_bottom" ||
      comp.role === "carcass_side_left" ||
      comp.role === "carcass_side_right") &&
    (Boolean(userData?.isMiter45Carcass) || (typeof comp.label === "string" && comp.label.includes("45° Gönye"))) &&
    comp.dimensions.width >= 12 &&
    comp.dimensions.height >= 12 &&
    comp.dimensions.depth >= 8;
  const miter45Entry = isMiter45CarcassPanel
    ? getCachedMiter45CarcassGeometry(
        comp.role as "carcass_top" | "carcass_bottom" | "carcass_side_left" | "carcass_side_right",
        comp.dimensions.width,
        comp.dimensions.height,
        comp.dimensions.depth
      )
    : null;

  const useTrueBevelGeo =
    !polygonContourEntry &&
    !isMiter45CarcassPanel &&
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
    !polygonContourEntry &&
    !useTrueBevelGeo &&
    (!comp.primitive || comp.primitive === "box") &&
    comp.isManufacturablePanel !== false;

  const mesh = new THREE.Mesh(
    comp.primitive === "sphere"
      ? sphere
      : comp.primitive === "cylinder"
      ? cylinder
      : polygonContourEntry
      ? polygonContourEntry.geo
      : miter45Entry
      ? miter45Entry.geo
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
  if (miter45Entry) {
    const miterEdgeMat = new THREE.LineBasicMaterial({ color: 0x1E293B, transparent: true, opacity: 0.58 });
    markSharedMaterial(miterEdgeMat);
    const miterLines = new THREE.LineSegments(miter45Entry.edges, miterEdgeMat);
    miterLines.userData.isRevealSeam = true;
    miterLines.raycast = () => {};
    mesh.add(miterLines);
  }
  if (!polygonContourEntry && !useTrueBevelGeo && !useWorldUvFlatBox && !isMiter45CarcassPanel) {
    mesh.scale.set(comp.dimensions.width, comp.dimensions.height, comp.dimensions.depth);
  }
  mesh.position.set(cx, cy, cz);
  tagSubMesh(mesh, userData, comp);

  if (!comp.primitive || comp.primitive === "box") {
    const cadFrameHolder = new THREE.Group();
    cadFrameHolder.position.set(cx, cy, cz);
    if (polygonContourEntry) {
      const primaryEdgeLines = new THREE.LineSegments(polygonContourEntry.edges, edgeMaterial);
      primaryEdgeLines.userData.isPrimaryEdge = true;
      cadFrameHolder.add(primaryEdgeLines);
    } else if (miter45Entry) {
      const primaryEdgeLines = new THREE.LineSegments(miter45Entry.edges, edgeMaterial);
      primaryEdgeLines.userData.isPrimaryEdge = true;
      cadFrameHolder.add(primaryEdgeLines);
    } else {
      cadFrameHolder.scale.set(comp.dimensions.width, comp.dimensions.height, comp.dimensions.depth);
      const primaryEdgeLines = new THREE.LineSegments(edges, edgeMaterial);
      primaryEdgeLines.userData.isPrimaryEdge = true;
      cadFrameHolder.add(primaryEdgeLines);
    }

    // Physical dark recessed shadow backing behind doors & drawer fronts for authentic 2-3mm joinery reveal depth!
    const isTranslucentGlassFront =
      comp.crossSectionProfile === "glass_frame" ||
      comp.crossSectionProfile === "full_smoked_glass" ||
      comp.crossSectionProfile === "center_glass_frame" ||
      comp.crossSectionProfile === "u_glass_open_top" ||
      String(comp.materialId || "").includes("glass");
    const isStandardZFacingDoor =
      !polygonContourEntry &&
      comp.thicknessAxis !== "x" &&
      comp.dimensions.depth <= 36 &&
      Math.abs(comp.rotation?.[1] || 0) < 0.04 && Math.abs(comp.rotation?.[0] || 0) < 0.04 &&
      !String(comp.id || "").includes("_l_door") &&
      !String(comp.id || "").includes("_corner_");
    if (
      isStandardZFacingDoor &&
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
    } else if (activeProfile === "bevel_45" && comp.handleProfileId === "hnd_bevel_30_backing" && w > 60 && h > 60) {
      // 5a. 45° Gönye Burun Kulpsuz Kapak / Çekmece (`hnd_bevel_30_backing`): Üstten veya alttan 45° gönye burun!
      mesh.visible = false;
      group.children.forEach((ch) => {
        if ((ch as THREE.Group).children?.some((sub) => sub.userData?.isPrimaryEdge)) {
          ch.visible = false;
        }
      });
      const pullEdge: "top" | "bottom" = comp.bevelPullEdge === "bottom" ? "bottom" : "top";
      const { geo: tbGeo, edges: tbEdges, bevelDrop } = getCachedTopBevel45Pull(w, h, d, pullEdge);
      const tbMesh = new THREE.Mesh(tbGeo, material);
      tbMesh.position.set(cx, cy, cz);
      tbMesh.castShadow = true;
      tbMesh.receiveShadow = true;
      tbMesh.add(new THREE.LineSegments(tbEdges, revealShadowMat));
      tagSubMesh(tbMesh, userData, comp);
      tbMesh.userData.bevelPullEdge = pullEdge;
      tbMesh.userData.bevelDropMm = bevelDrop;
      group.add(tbMesh);
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
    } else if (activeProfile === "j_pull_bevel" && w > 100 && h >= 80) {
      // 6. CNC Frezeli Gizli J-Kulp Parmak Kanallı Kapak / Çekmece Klapası (`j_pull_bevel`)
      mesh.visible = false;
      const jEdge: "top" | "bottom" = comp.jPullEdge || "top";
      const { geo: jpGeo, edges: jpEdges } = getCachedJPullBevelDoorGeometry(w, h, d, isCrossGrain, jEdge);
      const jpMesh = new THREE.Mesh(jpGeo, material);
      jpMesh.position.set(cx, cy, cz);
      jpMesh.castShadow = true;
      jpMesh.receiveShadow = true;
      jpMesh.add(new THREE.LineSegments(jpEdges, revealShadowMat));
      tagSubMesh(jpMesh, userData, comp);
      jpMesh.userData.crossSectionProfile = "j_pull_bevel";
      jpMesh.userData.jPullEdge = jEdge;
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
