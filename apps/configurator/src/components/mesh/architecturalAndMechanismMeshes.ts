import * as THREE from "three";
import {
  box,
  sphere,
  cylinder,
  cylinderY,
  edges,
  darkDamperMat,
  screwHeadMat,
  chromeHardwareMat,
  blumAccentMat,
  darkCavityMat,
  burnerRingMat,
  handleAccentMat,
  revealShadowMat,
  tagSubMesh,
  getBakedInteriorAoMaterial,
} from "./sharedMeshMaterialsAndPrimitives";
import { getCachedPolygonContourGeometry } from "./cachedPanelGeometries";
import type { ComponentMeshBuildContext } from "./hardwareAndFittingMeshes";

export function tryBuildArchitecturalOrMechanismMesh(ctx: ComponentMeshBuildContext): THREE.Group | null {
  const { comp, material, edgeMaterial, userData, group, cx, cy, cz } = ctx;
  // Interior Baked Ambient Occlusion vignette on cabinet back panel (adds realistic interior depth at 0 FPS cost)
  if (comp.role === "carcass_back") {
    const { width: w, height: h, depth: d } = comp.dimensions;
    if (Array.isArray(comp.polygonContourMm) && comp.polygonContourMm.length >= 3) {
      const polyEntry = getCachedPolygonContourGeometry(w, h, d, "z", comp.polygonContourMm);
      const slopedBack = new THREE.Mesh(polyEntry.geo, material);
      slopedBack.position.set(cx, cy, cz);
      slopedBack.castShadow = true;
      slopedBack.receiveShadow = true;
      tagSubMesh(slopedBack, userData, comp);
      group.add(slopedBack);

      const primaryEdgeLines = new THREE.LineSegments(polyEntry.edges, edgeMaterial);
      primaryEdgeLines.position.set(cx, cy, cz);
      primaryEdgeLines.userData.isPrimaryEdge = true;
      primaryEdgeLines.raycast = () => {};
      group.add(primaryEdgeLines);
      return group;
    }

    const baseBack = new THREE.Mesh(box, material);
    baseBack.scale.set(w, h, d);
    baseBack.position.set(cx, cy, cz);
    baseBack.castShadow = true;
    baseBack.receiveShadow = true;
    tagSubMesh(baseBack, userData, comp);
    group.add(baseBack);

    const isTransparentXrayMat = Boolean((material as THREE.Material).transparent && (material as THREE.Material).opacity < 0.5);
    const aoMat = isTransparentXrayMat ? null : getBakedInteriorAoMaterial();
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

    // Rear Carrier Bar (mounted toward the back -Z) so tie/belt pegs project FORWARD (+Z) toward the user
    const rearBarZ = cz - d * 0.30;
    const mainBar = new THREE.Mesh(box, chromeHardwareMat);
    mainBar.scale.set(Math.max(60, w - 28), 26, 24);
    mainBar.position.set(cx, cy + 6, rearBarZ);
    mainBar.add(new THREE.LineSegments(edges, revealShadowMat));
    tagSubMesh(mainBar, userData, comp);
    group.add(mainBar);

    const hookCount = isBelt ? 7 : 10;
    const stepX = (w - 64) / Math.max(1, hookCount - 1);
    const pegLen = isBelt ? Math.max(80, d * 0.58) : Math.max(70, d * 0.54);
    const pegCenterZ = rearBarZ + 12 + pegLen / 2;
    const tipZ = rearBarZ + 12 + pegLen;

    for (let k = 0; k < hookCount; k++) {
      const kx = cx - (w - 64) / 2 + k * stepX;
      const peg = new THREE.Mesh(isBelt ? box : cylinder, isBelt ? handleAccentMat : chromeHardwareMat);
      peg.scale.set(isBelt ? 8 : 7, isBelt ? 22 : 7, pegLen);
      peg.position.set(kx, cy + 4, pegCenterZ);
      tagSubMesh(peg, userData, comp);
      group.add(peg);

      // Front anti-slip upturned stop tip (+Z end)
      const tip = new THREE.Mesh(sphere, handleAccentMat);
      tip.scale.set(10, 10, 10);
      tip.position.set(kx, cy + 7, tipZ);
      tagSubMesh(tip, userData, comp);
      group.add(tip);
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
    const h = Math.min(180, Math.max(60, comp.dimensions.height));
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
  return null;
}
