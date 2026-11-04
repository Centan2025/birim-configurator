import { ParametricPart, DrillingHole } from "@birim/core";

export function generateDrillingForPart(part: ParametricPart): DrillingHole[] {
  const holes: DrillingHole[] = [];
  const { width, height } = part.dimensions;

  // 1. Side Panels (Sol ve Sağ Yan)
  if (part.role.includes("side")) {
    const isLeft = part.role.includes("left");
    const face = isLeft ? "face_front" : "face_front";

    // Minifix bolt holes for bottom and top panel joints (at 50mm and width - 50mm)
    const jointXPositions = [50, Math.max(80, width - 50)];
    jointXPositions.forEach((x, idx) => {
      // Bottom panel joint holes
      holes.push({
        id: `H_${part.id}_minifix_bolt_bot_${idx}`,
        diameter: 8,
        depth: 12,
        x,
        y: 18 / 2, // center of 18mm bottom panel
        z: 0,
        direction: face,
        purpose: "minifix_bolt",
      });
      holes.push({
        id: `H_${part.id}_dowel_bot_${idx}`,
        diameter: 8,
        depth: 12,
        x: x + 32, // System 32 dowel pair
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

    // System 32 Shelf Pin Line Boring (every 32mm in intermediate heights)
    const startY = 300;
    const endY = height - 300;
    const frontX = 37; // Standard 37mm inset
    const backX = Math.max(100, width - 50);

    for (let y = startY; y <= endY; y += 64) {
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

    // Hinge mounting plate holes (37mm inset, 32mm vertical pitch)
    const hingePositionsY = height > 2000 ? [100, 750, 1400, height - 100] : [100, height / 2, height - 100];
    hingePositionsY.forEach((hy, idx) => {
      holes.push({
        id: `H_${part.id}_hinge_mount_${idx}_a`,
        diameter: 5,
        depth: 12,
        x: frontX,
        y: hy - 16,
        z: 0,
        direction: face,
        purpose: "hinge_mount",
      });
      holes.push({
        id: `H_${part.id}_hinge_mount_${idx}_b`,
        diameter: 5,
        depth: 12,
        x: frontX,
        y: hy + 16,
        z: 0,
        direction: face,
        purpose: "hinge_mount",
      });
    });
  }

  // 2. Horizontal Panels: Bottom, Top, Shelves
  else if (part.role === "carcass_bottom" || part.role === "carcass_top" || part.role === "shelf") {
    // Minifix Cam Pockets: Ø15mm, depth 13.5mm, 34mm from left/right edge
    if (part.role !== "shelf") {
      const edgePositionsY = [50, Math.max(80, height - 50)];
      edgePositionsY.forEach((y, idx) => {
        // Left edge minifix cam
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
        // Right edge minifix cam
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

  // 3. Doors (Kapaklar): Blum 35mm hinge cups
  else if (part.role.includes("door")) {
    const isLeftHinged = part.role.includes("left");
    const cupX = isLeftHinged ? 21.5 : width - 21.5;
    const hingePositionsY = height > 2000 ? [100, 750, 1400, height - 100] : [100, height / 2, height - 100];

    hingePositionsY.forEach((hy, idx) => {
      // 35mm cup hole
      holes.push({
        id: `H_${part.id}_hinge_cup_${idx}`,
        diameter: 35,
        depth: 12.5,
        x: cupX,
        y: hy,
        z: 0,
        direction: "face_back",
        purpose: "hinge_cup",
      });
      // 2x 8mm dowel holes for Blum knock-in hinges
      holes.push({
        id: `H_${part.id}_hinge_screw_${idx}_a`,
        diameter: 8,
        depth: 11,
        x: cupX + (isLeftHinged ? 9.5 : -9.5),
        y: hy - 22.5,
        z: 0,
        direction: "face_back",
        purpose: "hinge_cup",
      });
      holes.push({
        id: `H_${part.id}_hinge_screw_${idx}_b`,
        diameter: 8,
        depth: 11,
        x: cupX + (isLeftHinged ? 9.5 : -9.5),
        y: hy + 22.5,
        z: 0,
        direction: "face_back",
        purpose: "hinge_cup",
      });
    });
  }

  return holes;
}
