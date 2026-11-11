import {
  ParametricPart,
  DrillingHole,
  calculateDoorHingePositionsY,
  roundMm,
} from "@birim/core";
import { getDrillingTemplateForHardware } from "@birim/catalog";

/**
 * Generates collision-free, mirrored, panel-thickness-aware CNC drilling operations:
 * - Left & Right Carcass Side Panels (with mirror symmetry so inner faces oppose accurately,
 *   plinth offset on floor-standing wardrobes, conditional hinge mounts, and rear dowels placed
 *   inward from rear Minifix bolts so they NEVER intersect the 8mm back groove)
 * - Middle Carcass Dividers (double-sided System 32 shelf pin + conditional front/back hinge mounts + Minifix cams)
 * - Carcass Bottom & Top Horizontal Panels (Minifix 15mm cams along Y = 34 / height - 34 matching side panel
 *   butt joints + 8mm edge-drilled bolt/dowel channels along edge_bottom / edge_top)
 * - Doors (manufacturer-specific 35mm hinge cup + 2x8mm boss holes + optional handle bores)
 */
export function generateDrillingForPart(part: ParametricPart): DrillingHole[] {
  const holes: DrillingHole[] = [];
  const { width, height, depth: partThickness } = part.dimensions;
  const panelT = part.matingPanelThicknessMm || partThickness || 18;
  const drillTpl = getDrillingTemplateForHardware(part.hardwareRefId);
  const mirrorX = Boolean(part.mirrorInnerFaceX);
  const mapX = (xFromFrontEdge: number): number =>
    roundMm(mirrorX ? width - xFromFrontEdge : xFromFrontEdge, 2);

  // 1. Outer Carcass Side Panels (carcass_side_left & carcass_side_right)
  if (part.role.includes("side") && !part.role.includes("drawer")) {
    const face = "face_front";
    const bottomOffsetY = Math.max(0, part.bottomJointOffsetY ?? 0);
    const botJointY = roundMm(bottomOffsetY + panelT / 2, 2);
    const topJointY = roundMm(height - panelT / 2, 2);

    // Groove sits at [width - 20, width - 12] from front edge when hasBackGroove !== false.
    // Front Minifix bolt at 50mm (dowel at 50 + 32 = 82mm);
    // Rear Minifix bolt at width - 50mm (dowel INWARD at width - 50 - 32 = width - 82mm -> 62mm clear of groove!).
    const frontBoltX = 50;
    const rearBoltX = Math.max(114, width - 50);
    const jointSpecs =
      width >= 180
        ? [
            { boltFromFront: frontBoltX, dowelFromFront: frontBoltX + 32 },
            { boltFromFront: rearBoltX, dowelFromFront: rearBoltX - 32 },
          ]
        : [{ boltFromFront: Math.round(width / 2), dowelFromFront: null }];

    jointSpecs.forEach((jt, idx) => {
      const bx = mapX(jt.boltFromFront);
      holes.push({
        id: `H_${part.id}_minifix_bolt_bot_${idx}`,
        diameter: 8,
        depth: 12,
        x: bx,
        y: botJointY,
        z: 0,
        direction: face,
        purpose: "minifix_bolt",
      });
      holes.push({
        id: `H_${part.id}_minifix_bolt_top_${idx}`,
        diameter: 8,
        depth: 12,
        x: bx,
        y: topJointY,
        z: 0,
        direction: face,
        purpose: "minifix_bolt",
      });

      if (jt.dowelFromFront !== null) {
        const dx = mapX(jt.dowelFromFront);
        holes.push({
          id: `H_${part.id}_dowel_bot_${idx}`,
          diameter: 8,
          depth: 12,
          x: dx,
          y: botJointY,
          z: 0,
          direction: face,
          purpose: "dowel",
        });
        holes.push({
          id: `H_${part.id}_dowel_top_${idx}`,
          diameter: 8,
          depth: 12,
          x: dx,
          y: topJointY,
          z: 0,
          direction: face,
          purpose: "dowel",
        });
      }
    });

    const frontSetbackFromFront = part.isInsetDoor ? 57 : drillTpl.system32FrontSetbackMm;
    const backPinFromFront = Math.max(100, width - 52);
    const frontPinX = mapX(frontSetbackFromFront);
    const backPinX = mapX(backPinFromFront);

    // Conditional hinge mounting plate holes: ONLY drilled when part.hingePositionsY is explicitly non-empty
    const hingePositionsY = part.hingePositionsY ?? [];
    const hingeMountYCoords: number[] = [];

    hingePositionsY.forEach((hy, idx) => {
      const yA = roundMm(hy - 16, 2);
      const yB = roundMm(hy + 16, 2);
      if (yA < 16 || yB > height - 16) return;
      hingeMountYCoords.push(yA, yB);
      holes.push({
        id: `H_${part.id}_hinge_mount_${idx}_a`,
        diameter: 5,
        depth: 12,
        x: frontPinX,
        y: yA,
        z: 0,
        direction: face,
        purpose: "hinge_mount",
      });
      holes.push({
        id: `H_${part.id}_hinge_mount_${idx}_b`,
        diameter: 5,
        depth: 12,
        x: frontPinX,
        y: yB,
        z: 0,
        direction: face,
        purpose: "hinge_mount",
      });
    });

    // System 32 Shelf Pin Line Boring (starts safely above bottom carcass panel)
    const startY = Math.max(bottomOffsetY + panelT + 96, 160);
    const endY = height - ( panelT + 96 );
    for (let y = startY; y <= endY; y += 32) {
      const collidesWithHingeMount = hingeMountYCoords.some((hmy) => Math.abs(hmy - y) < 14);
      if (!collidesWithHingeMount) {
        holes.push({
          id: `H_${part.id}_shelf_pin_front_${y}`,
          diameter: 5,
          depth: 12,
          x: frontPinX,
          y,
          z: 0,
          direction: face,
          purpose: "shelf_pin",
        });
      }
      if (Math.abs(backPinX - frontPinX) >= 64) {
        holes.push({
          id: `H_${part.id}_shelf_pin_back_${y}`,
          diameter: 5,
          depth: 12,
          x: backPinX,
          y,
          z: 0,
          direction: face,
          purpose: "shelf_pin",
        });
      }
    }
  }

  // 2. Intermediate Carcass Dividers (carcass_divider)
  else if (part.role === "carcass_divider" && width >= 140 && height >= 180) {
    // Top & bottom Minifix 15mm cams + edge bores for joining into carcass_bottom (y=0) and carcass_top (y=height)
    const jointXs =
      width >= 200 ? [50, Math.max(114, width - 50)] : [Math.round(width / 2)];
    jointXs.forEach((jx, idx) => {
      // Bottom connection (y = 34 cam + edge_bottom bore)
      holes.push(
        {
          id: `H_${part.id}_div_cam_bot_${idx}`,
          diameter: 15,
          depth: 13.5,
          x: jx,
          y: 34,
          z: 0,
          direction: "face_front",
          purpose: "minifix_cam",
        },
        {
          id: `H_${part.id}_div_edge_bot_${idx}`,
          diameter: 8,
          depth: 34,
          x: jx,
          y: 0,
          z: roundMm(partThickness / 2, 2),
          direction: "edge_bottom",
          purpose: "minifix_bolt",
        },
        // Top connection (y = height - 34 cam + edge_top bore)
        {
          id: `H_${part.id}_div_cam_top_${idx}`,
          diameter: 15,
          depth: 13.5,
          x: jx,
          y: roundMm(height - 34, 2),
          z: 0,
          direction: "face_front",
          purpose: "minifix_cam",
        },
        {
          id: `H_${part.id}_div_edge_top_${idx}`,
          diameter: 8,
          depth: 34,
          x: jx,
          y: height,
          z: roundMm(partThickness / 2, 2),
          direction: "edge_top",
          purpose: "minifix_bolt",
        }
      );
    });

    const frontX = part.isInsetDoor ? 57 : drillTpl.system32FrontSetbackMm;
    const backX = Math.max(96, width - 37);

    // Front face (left bay side) hinge mounts
    const frontHingesY = part.hingePositionsY ?? [];
    const frontMountYs: number[] = [];
    frontHingesY.forEach((hy, idx) => {
      const yA = roundMm(hy - 16, 2);
      const yB = roundMm(hy + 16, 2);
      if (yA < 16 || yB > height - 16) return;
      frontMountYs.push(yA, yB);
      holes.push(
        {
          id: `H_${part.id}_div_hinge_front_${idx}_a`,
          diameter: 5,
          depth: 11,
          x: frontX,
          y: yA,
          z: 0,
          direction: "face_front",
          purpose: "hinge_mount",
        },
        {
          id: `H_${part.id}_div_hinge_front_${idx}_b`,
          diameter: 5,
          depth: 11,
          x: frontX,
          y: yB,
          z: 0,
          direction: "face_front",
          purpose: "hinge_mount",
        }
      );
    });

    // Back face (right bay side) hinge mounts
    const backHingesY = part.hingePositionsBackY ?? [];
    const backMountYs: number[] = [];
    backHingesY.forEach((hy, idx) => {
      const yA = roundMm(hy - 16, 2);
      const yB = roundMm(hy + 16, 2);
      if (yA < 16 || yB > height - 16) return;
      backMountYs.push(yA, yB);
      holes.push(
        {
          id: `H_${part.id}_div_hinge_back_${idx}_a`,
          diameter: 5,
          depth: 11,
          x: frontX,
          y: yA,
          z: partThickness,
          direction: "face_back",
          purpose: "hinge_mount",
        },
        {
          id: `H_${part.id}_div_hinge_back_${idx}_b`,
          diameter: 5,
          depth: 11,
          x: frontX,
          y: yB,
          z: partThickness,
          direction: "face_back",
          purpose: "hinge_mount",
        }
      );
    });

    // Double-sided System 32 shelf pin holes (11mm blind depth on 18mm+ divider; staggered by 32mm if < 22mm thick so front/back pins never punch through!)
    const blindDepth = partThickness >= 22 ? 11 : Math.min(8.5, roundMm(partThickness * 0.45, 1));
    const startY = 96;
    const endY = height - 96;
    for (let y = startY; y <= endY; y += 32) {
      if (!frontMountYs.some((my) => Math.abs(my - y) < 14)) {
        holes.push({
          id: `H_${part.id}_div_pin_f_front_${y}`,
          diameter: 5,
          depth: blindDepth,
          x: frontX,
          y,
          z: 0,
          direction: "face_front",
          purpose: "shelf_pin",
        });
      }
      if (!backMountYs.some((my) => Math.abs(my - y) < 14)) {
        holes.push({
          id: `H_${part.id}_div_pin_b_front_${y}`,
          diameter: 5,
          depth: blindDepth,
          x: frontX,
          y,
          z: partThickness,
          direction: "face_back",
          purpose: "shelf_pin",
        });
      }
      if (Math.abs(backX - frontX) >= 64) {
        holes.push(
          {
            id: `H_${part.id}_div_pin_f_back_${y}`,
            diameter: 5,
            depth: blindDepth,
            x: backX,
            y,
            z: 0,
            direction: "face_front",
            purpose: "shelf_pin",
          },
          {
            id: `H_${part.id}_div_pin_b_back_${y}`,
            diameter: 5,
            depth: blindDepth,
            x: backX,
            y,
            z: partThickness,
            direction: "face_back",
            purpose: "shelf_pin",
          }
        );
      }
    }
  }

  // 3. Horizontal Carcass Panels: carcass_bottom & carcass_top
  // Local coordinates: width = cabinet depth (X: 0 front -> width rear), height = horizontal span between left & right side panels (Y: 0 left butt joint -> height right butt joint)
  else if (part.role === "carcass_bottom" || part.role === "carcass_top") {
    const frontBoltX = 50;
    const rearBoltX = Math.max(114, width - 50);
    const jointSpecs =
      width >= 180
        ? [
            { boltX: frontBoltX, dowelX: frontBoltX + 32 },
            { boltX: rearBoltX, dowelX: rearBoltX - 32 },
          ]
        : [{ boltX: Math.round(width / 2), dowelX: null }];

    const camFace = part.role === "carcass_top" ? "face_back" : "face_front";
    const camZ = camFace === "face_back" ? partThickness : 0;
    const midZ = roundMm(partThickness / 2, 2);

    jointSpecs.forEach((jt, idx) => {
      // Left butt-joint end (y = 0 -> cam at y = 34, edge_bottom channel at y = 0)
      holes.push(
        {
          id: `H_${part.id}_cam_left_${idx}`,
          diameter: 15,
          depth: 13.5,
          x: jt.boltX,
          y: 34,
          z: camZ,
          direction: camFace,
          purpose: "minifix_cam",
        },
        {
          id: `H_${part.id}_edge_bolt_left_${idx}`,
          diameter: 8,
          depth: 34,
          x: jt.boltX,
          y: 0,
          z: midZ,
          direction: "edge_bottom",
          purpose: "minifix_bolt",
        }
      );

      // Right butt-joint end (y = height -> cam at y = height - 34, edge_top channel at y = height)
      holes.push(
        {
          id: `H_${part.id}_cam_right_${idx}`,
          diameter: 15,
          depth: 13.5,
          x: jt.boltX,
          y: roundMm(height - 34, 2),
          z: camZ,
          direction: camFace,
          purpose: "minifix_cam",
        },
        {
          id: `H_${part.id}_edge_bolt_right_${idx}`,
          diameter: 8,
          depth: 34,
          x: jt.boltX,
          y: height,
          z: midZ,
          direction: "edge_top",
          purpose: "minifix_bolt",
        }
      );

      if (jt.dowelX !== null) {
        holes.push(
          {
            id: `H_${part.id}_edge_dowel_left_${idx}`,
            diameter: 8,
            depth: 24,
            x: jt.dowelX,
            y: 0,
            z: midZ,
            direction: "edge_bottom",
            purpose: "dowel",
          },
          {
            id: `H_${part.id}_edge_dowel_right_${idx}`,
            diameter: 8,
            depth: 24,
            x: jt.dowelX,
            y: height,
            z: midZ,
            direction: "edge_top",
            purpose: "dowel",
          }
        );
      }
    });
  }

  // 4. Doors (Kapaklar): Manufacturer-Specific Hinge Cups & Handle Holes
  else if (part.role.includes("door")) {
    const isSlidingOrLift =
      part.label.includes("Sürgülü") ||
      part.label.includes("Kalkar") ||
      part.label.includes("Tambur");

    if (!isSlidingOrLift) {
      const isLeftHinged = part.role.includes("left");
      const cupRadius = drillTpl.cupDiameterMm / 2;
      const cupCenterDist = cupRadius + drillTpl.cupEdgeTabMm;
      const cupX = roundMm(isLeftHinged ? cupCenterDist : width - cupCenterDist, 2);
      const halfBossPitch = drillTpl.bossPitchMm / 2;
      const bossOffset = drillTpl.bossOffsetMm;
      const effectiveCupDepth = part.hardwareRefId ? drillTpl.cupDepthMm : 12.5;

      const hingePositionsY =
        part.hingePositionsY && part.hingePositionsY.length > 0
          ? part.hingePositionsY
          : calculateDoorHingePositionsY(height);

      hingePositionsY.forEach((hy, idx) => {
        holes.push({
          id: `H_${part.id}_hinge_cup_${idx}`,
          diameter: drillTpl.cupDiameterMm,
          depth: effectiveCupDepth,
          x: cupX,
          y: roundMm(hy, 2),
          z: 0,
          direction: "face_back",
          purpose: "hinge_cup",
        });
        holes.push({
          id: `H_${part.id}_hinge_screw_${idx}_a`,
          diameter: 8,
          depth: 11,
          x: roundMm(cupX + (isLeftHinged ? bossOffset : -bossOffset), 2),
          y: roundMm(hy - halfBossPitch, 2),
          z: 0,
          direction: "face_back",
          purpose: "hinge_cup",
        });
        holes.push({
          id: `H_${part.id}_hinge_screw_${idx}_b`,
          diameter: 8,
          depth: 11,
          x: roundMm(cupX + (isLeftHinged ? bossOffset : -bossOffset), 2),
          y: roundMm(hy + halfBossPitch, 2),
          z: 0,
          direction: "face_back",
          purpose: "hinge_cup",
        });
      });
    }

    if (part.handleSpacingMm && part.handleSpacingMm > 0) {
      const isLeftHinged = part.role.includes("left");
      const handleX = isLeftHinged ? Math.max(35, width - 45) : 45;
      const centerY = Math.round(height / 2);
      const halfCc = part.handleSpacingMm / 2;
      holes.push({
        id: `H_${part.id}_handle_a`,
        diameter: 5,
        depth: partThickness,
        x: handleX,
        y: Math.max(40, roundMm(centerY - halfCc, 2)),
        z: 0,
        direction: "face_front",
        purpose: "handle",
      });
      holes.push({
        id: `H_${part.id}_handle_b`,
        diameter: 5,
        depth: partThickness,
        x: handleX,
        y: Math.min(height - 40, roundMm(centerY + halfCc, 2)),
        z: 0,
        direction: "face_front",
        purpose: "handle",
      });
    }
  }

  return holes;
}
