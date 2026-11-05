import { ParametricPart, DrillingHole, calculateDoorHingePositionsY } from "@birim/core";
import { getDrillingTemplateForHardware } from "@birim/catalog";

export function generateDrillingForPart(part: ParametricPart): DrillingHole[] {
  const holes: DrillingHole[] = [];
  const { width, height } = part.dimensions;
  const drillTpl = getDrillingTemplateForHardware(part.hardwareRefId);

  // 1. Side Panels (Sol ve Sağ Yan)
  if (part.role.includes("side") && !part.role.includes("drawer")) {
    const face = "face_front";

    // Minifix bolt holes for bottom and top panel joints (at 50mm and width - 50mm)
    const jointXPositions = [50, Math.max(80, width - 50)];
    jointXPositions.forEach((x, idx) => {
      // Bottom panel joint holes
      holes.push({
        id: `H_${part.id}_minifix_bolt_bot_${idx}`,
        diameter: 8,
        depth: 12,
        x,
        y: 18 / 2,
        z: 0,
        direction: face,
        purpose: "minifix_bolt",
      });
      holes.push({
        id: `H_${part.id}_dowel_bot_${idx}`,
        diameter: 8,
        depth: 12,
        x: x + 32,
        y: 18 / 2,
        z: 0,
        direction: face,
        purpose: "dowel",
      });

      // Top panel joint holes
      holes.push({
        id: `H_${part.id}_minifix_bolt_top_${idx}`,
        diameter: 8,
        depth: 12,
        x,
        y: height - 18 / 2,
        z: 0,
        direction: face,
        purpose: "minifix_bolt",
      });
      holes.push({
        id: `H_${part.id}_dowel_top_${idx}`,
        diameter: 8,
        depth: 12,
        x: x + 32,
        y: height - 18 / 2,
        z: 0,
        direction: face,
        purpose: "dowel",
      });
    });

    // Hinge mounting plate holes (37mm or 57mm inset, 32mm vertical pitch)
    // Computed before System 32 shelf pin holes so colliding shelf pin holes on the same X column are suppressed
    const frontX = part.isInsetDoor ? 57 : drillTpl.system32FrontSetbackMm;
    const backX = Math.max(100, width - 50);

    const hingePositionsY =
      part.hingePositionsY && part.hingePositionsY.length > 0
        ? part.hingePositionsY
        : calculateDoorHingePositionsY(height);

    const hingeMountYCoords: number[] = [];
    hingePositionsY.forEach((hy, idx) => {
      const yA = hy - 16;
      const yB = hy + 16;
      hingeMountYCoords.push(yA, yB);
      holes.push({
        id: `H_${part.id}_hinge_mount_${idx}_a`,
        diameter: 5,
        depth: 12,
        x: frontX,
        y: yA,
        z: 0,
        direction: face,
        purpose: "hinge_mount",
      });
      holes.push({
        id: `H_${part.id}_hinge_mount_${idx}_b`,
        diameter: 5,
        depth: 12,
        x: frontX,
        y: yB,
        z: 0,
        direction: face,
        purpose: "hinge_mount",
      });
    });

    // System 32 Shelf Pin Line Boring (with automatic collision avoidance against hinge mounting plate holes)
    const startY = 300;
    const endY = height - 300;
    for (let y = startY; y <= endY; y += 64) {
      const collidesWithHingeMount = hingeMountYCoords.some((hmy) => Math.abs(hmy - y) < 12);
      if (!collidesWithHingeMount) {
        holes.push({
          id: `H_${part.id}_shelf_pin_front_${y}`,
          diameter: 5,
          depth: 12,
          x: frontX,
          y,
          z: 0,
          direction: face,
          purpose: "shelf_pin",
        });
      }
      holes.push({
        id: `H_${part.id}_shelf_pin_back_${y}`,
        diameter: 5,
        depth: 12,
        x: backX,
        y,
        z: 0,
        direction: face,
        purpose: "shelf_pin",
      });
    }
  }

  // 2. Horizontal Panels: Bottom, Top, Shelves
  else if (part.role === "carcass_bottom" || part.role === "carcass_top" || part.role === "shelf") {
    if (part.role !== "shelf") {
      const edgePositionsY = [50, Math.max(80, height - 50)];
      edgePositionsY.forEach((y, idx) => {
        holes.push({
          id: `H_${part.id}_cam_left_${idx}`,
          diameter: 15,
          depth: 13.5,
          x: 34,
          y,
          z: 0,
          direction: "face_front",
          purpose: "minifix_cam",
        });
        holes.push({
          id: `H_${part.id}_cam_right_${idx}`,
          diameter: 15,
          depth: 13.5,
          x: width - 34,
          y,
          z: 0,
          direction: "face_front",
          purpose: "minifix_cam",
        });
      });
    }
  }

  // 3. Doors (Kapaklar): Manufacturer-Specific Hinge Cups (Blum 45x9.5, Hettich TH52x5.5, Salice 48x9) & Handle Holes
  else if (part.role.includes("door")) {
    const isSlidingOrLift =
      part.label.includes("Sürgülü") ||
      part.label.includes("Kalkar") ||
      part.label.includes("Tambur");

    if (!isSlidingOrLift) {
      const isLeftHinged = part.role.includes("left");
      const cupRadius = drillTpl.cupDiameterMm / 2; // 17.5mm
      const cupCenterDist = cupRadius + drillTpl.cupEdgeTabMm; // 21.5mm
      const cupX = isLeftHinged ? cupCenterDist : width - cupCenterDist;
      const halfBossPitch = drillTpl.bossPitchMm / 2; // 22.5mm (Blum), 26.0mm (Hettich TH52), 24.0mm (Salice)
      const bossOffset = drillTpl.bossOffsetMm; // 9.5mm (Blum), 5.5mm (Hettich), 9.0mm (Salice)
      const effectiveCupDepth = part.hardwareRefId ? drillTpl.cupDepthMm : 12.5;

      const hingePositionsY =
        part.hingePositionsY && part.hingePositionsY.length > 0
          ? part.hingePositionsY
          : calculateDoorHingePositionsY(height);

      hingePositionsY.forEach((hy, idx) => {
        // 35mm cup hole with manufacturer-specific depth (13.0mm Blum, 11.7mm 155°, 12.8mm Hettich, 12.5mm legacy default)
        holes.push({
          id: `H_${part.id}_hinge_cup_${idx}`,
          diameter: drillTpl.cupDiameterMm,
          depth: effectiveCupDepth,
          x: cupX,
          y: hy,
          z: 0,
          direction: "face_back",
          purpose: "hinge_cup",
        });
        // 2x 8mm boss holes using manufacturer bossPitchMm & bossOffsetMm
        holes.push({
          id: `H_${part.id}_hinge_screw_${idx}_a`,
          diameter: 8,
          depth: 11,
          x: cupX + (isLeftHinged ? bossOffset : -bossOffset),
          y: hy - halfBossPitch,
          z: 0,
          direction: "face_back",
          purpose: "hinge_cup",
        });
        holes.push({
          id: `H_${part.id}_hinge_screw_${idx}_b`,
          diameter: 8,
          depth: 11,
          x: cupX + (isLeftHinged ? bossOffset : -bossOffset),
          y: hy + halfBossPitch,
          z: 0,
          direction: "face_back",
          purpose: "hinge_cup",
        });
      });
    }

    // Handle drilling holes (if C-C spacing is defined, e.g., 160mm or 960mm)
    if (part.handleSpacingMm && part.handleSpacingMm > 0) {
      const isLeftHinged = part.role.includes("left");
      const handleX = isLeftHinged ? Math.max(35, width - 45) : 45;
      const centerY = Math.round(height / 2);
      const halfCc = part.handleSpacingMm / 2;
      holes.push({
        id: `H_${part.id}_handle_a`,
        diameter: 5,
        depth: 18,
        x: handleX,
        y: Math.max(40, centerY - halfCc),
        z: 0,
        direction: "face_front",
        purpose: "handle",
      });
      holes.push({
        id: `H_${part.id}_handle_b`,
        diameter: 5,
        depth: 18,
        x: handleX,
        y: Math.min(height - 40, centerY + halfCc),
        z: 0,
        direction: "face_front",
        purpose: "handle",
      });
    }
  }

  return holes;
}
