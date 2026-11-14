import {
  ParametricPart,
  DrillingHole,
  calculateDoorHingePositionsY,
  computeSystem32MultiHoleYs,
  roundMm,
} from "@birim/core";
import { getDrillingTemplateForHardware } from "@birim/catalog";

/**
 * Generates collision-free, mirrored, System-32 compliant CNC drilling operations:
 * - Left & Right Carcass Side Panels:
 *   - Depth-aware Minifix + Dowel connector rule (W < 250mm -> 2 minifix; 250..500mm -> 2 minifix + 2 dowel;
 *     W > 500mm with useDepthBasedConnectorRule -> 3 minifix + 3 dowel)
 *   - System 32 front setback X1 = 37mm (57mm on inset doors) and rear column X2 = X1 + k * 32mm
 *     so concealed runner rear holes align on exact 32mm multiples!
 * - Intermediate Carcass Dividers:
 *   - Double-sided System 32 boring + T-junction through-bolt holes (`minifix_through_bolt`)
 *     when two fixed shelves meet at the same height on opposite sides!
 * - Carcass Bottom & Top Horizontal Panels + Stretchers
 * - Doors: Manufacturer-specific Ø35mm hinge cup + boss holes (Blum 45x9.5, Hettich 52x5.5, Salice 48x9)
 * - LED Cable Exit Holes (Ø10mm) on grooved LED shelves/sides
 */
export function generateDrillingForPart(part: ParametricPart): DrillingHole[] {
  const holes: DrillingHole[] = [];
  const { width, height, depth: partThickness } = part.dimensions;
  const panelT = part.matingPanelThicknessMm || partThickness || 18;
  const drillTpl = getDrillingTemplateForHardware(part.hardwareRefId);
  const mirrorX = Boolean(part.mirrorInnerFaceX);
  const mapX = (xFromFrontEdge: number): number =>
    roundMm(mirrorX ? width - xFromFrontEdge : xFromFrontEdge, 2);

  // Dynamic inset door setback: X = 37 + T_door + reveal (57mm for 18mm door, 61mm for 22mm door per Blum spec!)
  const insetSetbackX = roundMm(
    37 + (part.insetDoorThicknessMm || 18) + (part.insetRevealGapMm ?? 2),
    2
  );
  // Helper: compute joint X positions strictly aligned to European System 32 (37mm + k * 32mm)
  const buildJointSpecs = (panelDepthW: number) => {
    const frontBoltX = part.isInsetDoor ? insetSetbackX : 37;
    if (panelDepthW < 180) {
      return [{ boltFromFront: Math.round(panelDepthW / 2), dowelFromFront: null as number | null }];
    }
    if (panelDepthW < 250) {
      const kSmall = Math.max(2, Math.floor((panelDepthW - frontBoltX - 28) / 32));
      return [
        { boltFromFront: frontBoltX, dowelFromFront: null as number | null },
        { boltFromFront: frontBoltX + kSmall * 32, dowelFromFront: null as number | null },
      ];
    }
    // Keep >= 37mm rear margin so rear minifix never collides with 18-20mm back groove!
    const kSteps = Math.max(3, Math.floor((panelDepthW - frontBoltX - 37) / 32));
    const rearBoltX = frontBoltX + kSteps * 32;
    if (part.useDepthBasedConnectorRule && panelDepthW > 500 && kSteps >= 6) {
      const midSteps = Math.floor(kSteps / 2);
      const midBoltX = frontBoltX + midSteps * 32;
      return [
        { boltFromFront: frontBoltX, dowelFromFront: frontBoltX + 32 },
        { boltFromFront: midBoltX, dowelFromFront: midBoltX + 32 },
        { boltFromFront: rearBoltX, dowelFromFront: rearBoltX - 32 },
      ];
    }
    return [
      { boltFromFront: frontBoltX, dowelFromFront: frontBoltX + 32 },
      { boltFromFront: rearBoltX, dowelFromFront: rearBoltX - 32 },
    ];
  };

  const topology = part.carcassJoineryTopology || "sides_through";

  // 1. Outer Carcass Side Panels (carcass_side_left & carcass_side_right)
  if (part.role.includes("side") && !part.role.includes("drawer")) {
    const face = "face_front";
    const midZ = roundMm(partThickness / 2, 2);
    const bottomOffsetY = Math.max(0, part.bottomJointOffsetY ?? 0);
    const botJointY = roundMm(bottomOffsetY + panelT / 2, 2);
    const topJointY = roundMm(height - panelT / 2, 2);
    const jointSpecs = buildJointSpecs(width);

    if (topology === "miter_45") {
      // P1-05: 45° mitered carcass corners use concealed Clamex/biscuit slots instead of butt-joint edge dowels/minifix
      // that would blow through the 45° beveled outer edge! System 32 internal hinge & shelf holes still proceed below.
    } else if (topology === "top_bottom_through" && bottomOffsetY === 0) {
      // Tip B (without floor-descending gable_rails): Top & Bottom run full outer width -> Side panels sit BETWEEN them!
      jointSpecs.forEach((jt, idx) => {
        const bx = mapX(jt.boltFromFront);
        holes.push(
          {
            id: `H_${part.id}_side_cam_bot_${idx}`,
            diameter: 15,
            depth: 13.5,
            x: bx,
            y: 34,
            z: 0,
            direction: face,
            purpose: "minifix_cam",
          },
          {
            id: `H_${part.id}_side_edge_bot_${idx}`,
            diameter: 8,
            depth: 34,
            x: bx,
            y: 0,
            z: midZ,
            direction: "edge_bottom",
            purpose: "minifix_bolt",
          },
          {
            id: `H_${part.id}_side_cam_top_${idx}`,
            diameter: 15,
            depth: 13.5,
            x: bx,
            y: roundMm(height - 34, 2),
            z: 0,
            direction: face,
            purpose: "minifix_cam",
          },
          {
            id: `H_${part.id}_side_edge_top_${idx}`,
            diameter: 8,
            depth: 34,
            x: bx,
            y: height,
            z: midZ,
            direction: "edge_top",
            purpose: "minifix_bolt",
          }
        );
        if (jt.dowelFromFront !== null) {
          const dx = mapX(jt.dowelFromFront);
          holes.push(
            {
              id: `H_${part.id}_side_edge_dowel_bot_${idx}`,
              diameter: 8,
              depth: 22,
              x: dx,
              y: 0,
              z: midZ,
              direction: "edge_bottom",
              purpose: "dowel",
            },
            {
              id: `H_${part.id}_side_edge_dowel_top_${idx}`,
              diameter: 8,
              depth: 22,
              x: dx,
              y: height,
              z: midZ,
              direction: "edge_top",
              purpose: "dowel",
            }
          );
        }
      });
    } else if (topology === "miter_45") {
      // Tip C: 45° Mitered carcass — omit 9mm edge-splitting minifix bolts; place internal alignment dowels!
      jointSpecs.slice(0, 2).forEach((jt, idx) => {
        const dx = mapX(jt.boltFromFront);
        holes.push(
          {
            id: `H_${part.id}_miter_dowel_bot_${idx}`,
            diameter: 8,
            depth: 10,
            x: dx,
            y: roundMm(bottomOffsetY + 14, 2),
            z: 0,
            direction: face,
            purpose: "dowel",
          },
          {
            id: `H_${part.id}_miter_dowel_top_${idx}`,
            diameter: 8,
            depth: 10,
            x: dx,
            y: roundMm(height - 14, 2),
            z: 0,
            direction: face,
            purpose: "dowel",
          }
        );
      });
    } else {
      // Tip A (sides_through) & Tip D (kitchen_stretchers):
      // Bottom panel spans full depth -> gets all `jointSpecs` bolts + dowels.
      jointSpecs.forEach((jt, idx) => {
        const bx = mapX(jt.boltFromFront);
        holes.push({
          id: `H_${part.id}_minifix_bolt_bot_${idx}`,
          diameter: 8,
          depth: 11,
          x: bx,
          y: botJointY,
          z: 0,
          direction: face,
          purpose: "minifix_bolt",
        });
        if (jt.dowelFromFront !== null) {
          holes.push({
            id: `H_${part.id}_dowel_bot_${idx}`,
            diameter: 8,
            depth: 12,
            x: mapX(jt.dowelFromFront),
            y: botJointY,
            z: 0,
            direction: face,
            purpose: "dowel",
          });
        }
      });

      // Top joints: in `kitchen_stretchers` mode, NEVER drill into empty space under the countertop —
      // target ONLY the real 90mm front & rear stretchers (or vertical sink apron)!
      if (topology === "kitchen_stretchers") {
        const sMode = part.kitchenStretcherMode || "horizontal";
        if (sMode === "vertical_sink") {
          const vertX = mapX(roundMm(panelT / 2, 2));
          holes.push(
            {
              id: `H_${part.id}_sink_apron_bolt_top`,
              diameter: 8,
              depth: 11,
              x: vertX,
              y: roundMm(height - 26, 2),
              z: 0,
              direction: face,
              purpose: "minifix_bolt",
            },
            {
              id: `H_${part.id}_sink_apron_dowel_bot`,
              diameter: 8,
              depth: 12,
              x: vertX,
              y: roundMm(height - 64, 2),
              z: 0,
              direction: face,
              purpose: "dowel",
            }
          );
        } else {
          // Rear 90mm stretcher sits at z = 26..116mm from rear -> from front edge: width - 116 .. width - 26
          const rearBoltFromFront = Math.max(120, width - 52);
          const rearDowelFromFront = Math.max(96, width - 84);
          holes.push(
            {
              id: `H_${part.id}_stretcher_rear_bolt`,
              diameter: 8,
              depth: 11,
              x: mapX(rearBoltFromFront),
              y: topJointY,
              z: 0,
              direction: face,
              purpose: "minifix_bolt",
            },
            {
              id: `H_${part.id}_stretcher_rear_dowel`,
              diameter: 8,
              depth: 12,
              x: mapX(rearDowelFromFront),
              y: topJointY,
              z: 0,
              direction: face,
              purpose: "dowel",
            }
          );
          if (sMode === "horizontal") {
            // Front 90mm horizontal stretcher spans 0..90mm from front edge -> bolt at 37mm, dowel at 69mm
            holes.push(
              {
                id: `H_${part.id}_stretcher_front_bolt`,
                diameter: 8,
                depth: 11,
                x: mapX(37),
                y: topJointY,
                z: 0,
                direction: face,
                purpose: "minifix_bolt",
              },
              {
                id: `H_${part.id}_stretcher_front_dowel`,
                diameter: 8,
                depth: 12,
                x: mapX(69),
                y: topJointY,
                z: 0,
                direction: face,
                purpose: "dowel",
              }
            );
          }
        }
      } else {
        jointSpecs.forEach((jt, idx) => {
          holes.push({
            id: `H_${part.id}_minifix_bolt_top_${idx}`,
            diameter: 8,
            depth: 11,
            x: mapX(jt.boltFromFront),
            y: topJointY,
            z: 0,
            direction: face,
            purpose: "minifix_bolt",
          });
          if (jt.dowelFromFront !== null) {
            holes.push({
              id: `H_${part.id}_dowel_top_${idx}`,
              diameter: 8,
              depth: 12,
              x: mapX(jt.dowelFromFront),
              y: topJointY,
              z: 0,
              direction: face,
              purpose: "dowel",
            });
          }
        });
      }
    }

    // EN 14749 Concealed Wall Cabinet Hanger Anchor Bores (2 x Ø10x12mm at top rear)
    if (part.isWallCabinet && height >= 300 && width >= 220) {
      const hangerXFromFront = Math.max(96, width - 38);
      [height - 38, height - 70].forEach((hy, hIdx) => {
        holes.push({
          id: `H_${part.id}_wall_hanger_${hIdx}`,
          diameter: 10,
          depth: 12,
          x: mapX(hangerXFromFront),
          y: roundMm(hy, 2),
          z: 0,
          direction: face,
          purpose: "wall_hanger",
        });
      });
    }

    // Fixed shelf / Oven carrier shelf intermediate Minifix + Dowel rows on side panel
    (part.fixedShelfJointYs || []).forEach((fsY, fsIdx) => {
      if (fsY <= botJointY + 32 || fsY >= topJointY - 32) return;
      jointSpecs.slice(0, 2).forEach((jt, idx) => {
        holes.push({
          id: `H_${part.id}_fs_bolt_${fsIdx}_${idx}`,
          diameter: 8,
          depth: 11,
          x: mapX(jt.boltFromFront),
          y: roundMm(fsY, 2),
          z: 0,
          direction: face,
          purpose: "minifix_bolt",
        });
        if (jt.dowelFromFront !== null) {
          holes.push({
            id: `H_${part.id}_fs_dowel_${fsIdx}_${idx}`,
            diameter: 8,
            depth: 12,
            x: mapX(jt.dowelFromFront),
            y: roundMm(fsY, 2),
            z: 0,
            direction: face,
            purpose: "dowel",
          });
        }
      });
    });

    // System 32 front setback X1 = 37mm (57mm inset, or custom multiHoleFrontSetbackMm) and rear column X2 = X1 + k * 32mm
    const baseFrontSetback = part.multiHoleFrontSetbackMm ?? drillTpl.system32FrontSetbackMm;
    const frontSetbackFromFront = part.isInsetDoor ? insetSetbackX : baseFrontSetback;
    const rearClearanceLimit = Math.max(frontSetbackFromFront + 64, width - 48);
    const kSteps = Math.max(2, Math.floor((rearClearanceLimit - frontSetbackFromFront) / 32));
    const backPinFromFront = Math.min(width - 37, frontSetbackFromFront + kSteps * 32);
    const midPinFromFront =
      part.multiHoleRowCount === 3 && width >= 480 && kSteps >= 6
        ? frontSetbackFromFront + Math.floor(kSteps / 2) * 32
        : null;
    const frontPinX = mapX(frontSetbackFromFront);
    const backPinX = mapX(backPinFromFront);
    const midPinX = midPinFromFront !== null ? mapX(midPinFromFront) : null;

    // Conditional hinge mounting plate holes (37mm from front, 32mm vertical pitch)
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

    // V7.4 Çoklu Delik Sistemi (Tam Boy Sistem 32 / Bölgesel / 5'li Küme / 3'lü Küme / Tekli Pim / Deliksiz)
    const sideMultiHoleMode = part.multiHoleMode || "full_system_32";
    const sideMultiHoleYs = computeSystem32MultiHoleYs({
      mode: sideMultiHoleMode,
      panelHeightMm: height,
      bottomOffsetY,
      panelThicknessMm: panelT,
      edgeMarginMm: part.multiHoleEdgeMarginMm ?? 96,
      adjustableShelfYsMm: part.adjustableShelfPositionsY ?? [],
      blockedYsMm: (part.fixedShelfJointYs || []).map((fsy) => ({ y: fsy, clearanceMm: 18 })),
    });

    for (const y of sideMultiHoleYs) {
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
      if (midPinX !== null && Math.abs(midPinX - frontPinX) >= 64 && Math.abs(backPinX - midPinX) >= 64) {
        holes.push({
          id: `H_${part.id}_shelf_pin_mid_${y}`,
          diameter: 5,
          depth: 12,
          x: midPinX,
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

    // LED cable exit bore Ø10mm near top rear when vertical LED groove is active
    if (part.ledGrooveSpec?.enabled && part.ledGrooveSpec.cableExitHole) {
      holes.push({
        id: `H_${part.id}_led_cable_exit`,
        diameter: 10,
        depth: partThickness,
        x: mapX(part.ledGrooveSpec.offsetFromFrontMm),
        y: Math.max(80, height - 48),
        z: 0,
        direction: face,
        purpose: "cable_exit",
      });
    }
  }

  // 2. Intermediate Carcass Dividers (carcass_divider) — Coaxial System 32 Joint Specs matching carcass_bottom & carcass_top!
  else if (part.role === "carcass_divider" && width >= 140 && height >= 180) {
    const divJointSpecs = buildJointSpecs(width);
    const jointXs = divJointSpecs.map((js) => js.boltFromFront);

    divJointSpecs.forEach((js, idx) => {
      const jx = js.boltFromFront;
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
      if (js.dowelFromFront !== null) {
        holes.push(
          {
            id: `H_${part.id}_div_dowel_bot_${idx}`,
            diameter: 8,
            depth: 22,
            x: js.dowelFromFront,
            y: 0,
            z: roundMm(partThickness / 2, 2),
            direction: "edge_bottom",
            purpose: "dowel",
          },
          {
            id: `H_${part.id}_div_dowel_top_${idx}`,
            diameter: 8,
            depth: 22,
            x: js.dowelFromFront,
            y: height,
            z: roundMm(partThickness / 2, 2),
            direction: "edge_top",
            purpose: "dowel",
          }
        );
      }
    });

    // T-Junction Through-Bolt Minifix Protection (Checklist #15!):
    // When two fixed shelves meet at the same height on opposite sides of a 18mm divider,
    // drill Ø8mm through-holes (`minifix_through_bolt`) for double-sided coaxial minifix spindles!
    const tJunctionYs = part.tJunctionFixedShelfYs ?? [];
    tJunctionYs.forEach((ty, tIdx) => {
      if (ty <= 48 || ty >= height - 48) return;
      [50, Math.max(114, width - 50)].forEach((jx, xIdx) => {
        holes.push({
          id: `H_${part.id}_div_tjunction_through_${tIdx}_${xIdx}`,
          diameter: 8,
          depth: partThickness,
          x: jx,
          y: roundMm(ty, 2),
          z: 0,
          direction: "face_front",
          purpose: "minifix_through_bolt",
        });
      });
    });

    const frontX = part.isInsetDoor ? insetSetbackX : drillTpl.system32FrontSetbackMm;
    const kDivSteps = Math.max(2, Math.floor((Math.max(frontX + 64, width - 37) - frontX) / 32));
    const backX = Math.min(width - 37, frontX + kDivSteps * 32);

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

    const throughBoreDiv = Boolean(part.multiHoleDividerThroughBore);
    const blindDepth = throughBoreDiv
      ? partThickness
      : partThickness >= 22
      ? 11
      : Math.min(8.5, roundMm(partThickness * 0.45, 1));
    const midDivX =
      part.multiHoleRowCount === 3 && width >= 480 && kDivSteps >= 6
        ? frontX + Math.floor(kDivSteps / 2) * 32
        : null;
    const divMultiHoleYs = computeSystem32MultiHoleYs({
      mode: part.multiHoleMode || "full_system_32",
      panelHeightMm: height,
      bottomOffsetY: 0,
      panelThicknessMm: 0,
      edgeMarginMm: part.multiHoleEdgeMarginMm ?? 96,
      adjustableShelfYsMm: part.adjustableShelfPositionsY ?? [],
      blockedYsMm: tJunctionYs.map((ty) => ({ y: ty, clearanceMm: 18 })),
    });

    for (const y of divMultiHoleYs) {
      const frontHingeHit = frontMountYs.some((my) => Math.abs(my - y) < 14);
      const backHingeHit = backMountYs.some((my) => Math.abs(my - y) < 14);

      if (throughBoreDiv) {
        if (!frontHingeHit && !backHingeHit) {
          holes.push({
            id: `H_${part.id}_div_pin_thru_front_${y}`,
            diameter: 5,
            depth: partThickness,
            x: frontX,
            y,
            z: 0,
            direction: "face_front",
            purpose: "shelf_pin",
          });
        }
        if (midDivX !== null && Math.abs(midDivX - frontX) >= 64 && Math.abs(backX - midDivX) >= 64) {
          holes.push({
            id: `H_${part.id}_div_pin_thru_mid_${y}`,
            diameter: 5,
            depth: partThickness,
            x: midDivX,
            y,
            z: 0,
            direction: "face_front",
            purpose: "shelf_pin",
          });
        }
        if (Math.abs(backX - frontX) >= 64) {
          holes.push({
            id: `H_${part.id}_div_pin_thru_back_${y}`,
            diameter: 5,
            depth: partThickness,
            x: backX,
            y,
            z: 0,
            direction: "face_front",
            purpose: "shelf_pin",
          });
        }
      } else {
        if (!frontHingeHit) {
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
        if (!backHingeHit) {
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
        if (midDivX !== null && Math.abs(midDivX - frontX) >= 64 && Math.abs(backX - midDivX) >= 64) {
          holes.push(
            {
              id: `H_${part.id}_div_pin_f_mid_${y}`,
              diameter: 5,
              depth: blindDepth,
              x: midDivX,
              y,
              z: 0,
              direction: "face_front",
              purpose: "shelf_pin",
            },
            {
              id: `H_${part.id}_div_pin_b_mid_${y}`,
              diameter: 5,
              depth: blindDepth,
              x: midDivX,
              y,
              z: partThickness,
              direction: "face_back",
              purpose: "shelf_pin",
            }
          );
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
  }

  // 3. Horizontal Carcass Panels, 90mm Stretchers & Fixed/Appliance Carrier Shelves
  else if (
    part.role === "carcass_bottom" ||
    part.role === "carcass_top" ||
    (part.role === "shelf" && (part.label.includes("Sabit") || part.label.includes("Taşıyıcı Tabla")))
  ) {
    const isFixedOrCarrierShelf = part.role === "shelf";
    const jointSpecs =
      width <= 110
        ? [{ boltFromFront: 32, dowelFromFront: width >= 80 ? 64 : (null as number | null) }]
        : buildJointSpecs(width);

    if (!isFixedOrCarrierShelf && topology === "top_bottom_through") {
      // Tip B: Horizontal top/bottom panels run full width and receive FACE bolts + dowels near y = 9 & y = height - 9!
      const boltFace = part.role === "carcass_top" ? "face_back" : "face_front";
      const boltZ = boltFace === "face_back" ? partThickness : 0;
      const leftInsetY = roundMm(panelT / 2, 2);
      const rightInsetY = roundMm(height - panelT / 2, 2);
      jointSpecs.forEach((jt, idx) => {
        holes.push(
          {
            id: `H_${part.id}_tb_bolt_left_${idx}`,
            diameter: 8,
            depth: 11,
            x: jt.boltFromFront,
            y: leftInsetY,
            z: boltZ,
            direction: boltFace,
            purpose: "minifix_bolt",
          },
          {
            id: `H_${part.id}_tb_bolt_right_${idx}`,
            diameter: 8,
            depth: 11,
            x: jt.boltFromFront,
            y: rightInsetY,
            z: boltZ,
            direction: boltFace,
            purpose: "minifix_bolt",
          }
        );
        if (jt.dowelFromFront !== null) {
          holes.push(
            {
              id: `H_${part.id}_tb_dowel_left_${idx}`,
              diameter: 8,
              depth: 12,
              x: jt.dowelFromFront,
              y: leftInsetY,
              z: boltZ,
              direction: boltFace,
              purpose: "dowel",
            },
            {
              id: `H_${part.id}_tb_dowel_right_${idx}`,
              diameter: 8,
              depth: 12,
              x: jt.dowelFromFront,
              y: rightInsetY,
              z: boltZ,
              direction: boltFace,
              purpose: "dowel",
            }
          );
        }
      });
      if (part.dividerJointPositionsY && part.dividerJointPositionsY.length > 0) {
        part.dividerJointPositionsY.forEach((divY, dIdx) => {
          if (divY <= 20 || divY >= height - 20) return;
          jointSpecs.forEach((jt, jIdx) => {
            holes.push({
              id: `H_${part.id}_tb_div_mate_bolt_${dIdx}_${jIdx}`,
              diameter: 8,
              depth: 11,
              x: jt.boltFromFront,
              y: roundMm(divY, 2),
              z: boltZ,
              direction: boltFace,
              purpose: "minifix_bolt",
            });
            if (jt.dowelFromFront !== null) {
              holes.push({
                id: `H_${part.id}_tb_div_mate_dowel_${dIdx}_${jIdx}`,
                diameter: 8,
                depth: 12,
                x: jt.dowelFromFront,
                y: roundMm(divY, 2),
                z: boltZ,
                direction: boltFace,
                purpose: "dowel",
              });
            }
          });
        });
      }
      return holes;
    }

    if (
      (!isFixedOrCarrierShelf && topology === "miter_45") ||
      part.id.includes("_capsule_bottom") ||
      part.id.includes("_capsule_top")
    ) {
      return holes;
    }

    const camFace = part.role === "carcass_top" || part.role === "shelf" ? "face_back" : "face_front";
    const camZ = camFace === "face_back" ? partThickness : 0;
    const midZ = roundMm(partThickness / 2, 2);

    jointSpecs.forEach((jt, idx) => {
      holes.push(
        {
          id: `H_${part.id}_cam_left_${idx}`,
          diameter: 15,
          depth: 13.5,
          x: jt.boltFromFront,
          y: 34,
          z: camZ,
          direction: camFace,
          purpose: "minifix_cam",
        },
        {
          id: `H_${part.id}_edge_bolt_left_${idx}`,
          diameter: 8,
          depth: 34,
          x: jt.boltFromFront,
          y: 0,
          z: midZ,
          direction: "edge_bottom",
          purpose: "minifix_bolt",
        },
        {
          id: `H_${part.id}_cam_right_${idx}`,
          diameter: 15,
          depth: 13.5,
          x: jt.boltFromFront,
          y: roundMm(height - 34, 2),
          z: camZ,
          direction: camFace,
          purpose: "minifix_cam",
        },
        {
          id: `H_${part.id}_edge_bolt_right_${idx}`,
          diameter: 8,
          depth: 34,
          x: jt.boltFromFront,
          y: height,
          z: midZ,
          direction: "edge_top",
          purpose: "minifix_bolt",
        }
      );

      if (jt.dowelFromFront !== null) {
        holes.push(
          {
            id: `H_${part.id}_edge_dowel_left_${idx}`,
            diameter: 8,
            depth: 22,
            x: jt.dowelFromFront,
            y: 0,
            z: midZ,
            direction: "edge_bottom",
            purpose: "dowel",
          },
          {
            id: `H_${part.id}_edge_dowel_right_${idx}`,
            diameter: 8,
            depth: 22,
            x: jt.dowelFromFront,
            y: height,
            z: midZ,
            direction: "edge_top",
            purpose: "dowel",
          }
        );
      }
    });

    // P0-05: Bore exact coaxial mating face holes on carcass_bottom & carcass_top for every intermediate divider!
    if (!isFixedOrCarrierShelf && part.dividerJointPositionsY && part.dividerJointPositionsY.length > 0) {
      const divFace = part.role === "carcass_top" ? "face_back" : "face_front";
      const divZ = divFace === "face_back" ? partThickness : 0;
      part.dividerJointPositionsY.forEach((divY, dIdx) => {
        if (divY <= 20 || divY >= height - 20) return;
        jointSpecs.forEach((jt, jIdx) => {
          holes.push({
            id: `H_${part.id}_div_mate_bolt_${dIdx}_${jIdx}`,
            diameter: 8,
            depth: 11,
            x: jt.boltFromFront,
            y: roundMm(divY, 2),
            z: divZ,
            direction: divFace,
            purpose: "minifix_bolt",
          });
          if (jt.dowelFromFront !== null) {
            holes.push({
              id: `H_${part.id}_div_mate_dowel_${dIdx}_${jIdx}`,
              diameter: 8,
              depth: 12,
              x: jt.dowelFromFront,
              y: roundMm(divY, 2),
              z: divZ,
              direction: divFace,
              purpose: "dowel",
            });
          }
        });
      });
    }

    if (part.ledGrooveSpec?.enabled && part.ledGrooveSpec.cableExitHole) {
      holes.push({
        id: `H_${part.id}_led_cable_exit`,
        diameter: 10,
        depth: partThickness,
        x: Math.max(20, width - 24),
        y: Math.round(height / 2),
        z: 0,
        direction: "face_back",
        purpose: "cable_exit",
      });
    }
  }

  // 4. Doors (Kapaklar): Manufacturer-Specific Ø35mm Hinge Cups (including AVENTOS HF Bi-Fold!) & Handle Bores
  else if (part.role.includes("door")) {
    const isBifoldLiftLeaf = part.label.includes("Katlanır Kalkar") || part.label.includes("AVENTOS HF");
    const isPureSlidingOrStayLift =
      (part.label.includes("Sürgü") ||
        part.label.includes("Kalkar") ||
        part.label.includes("Tambur")) &&
      !isBifoldLiftLeaf;

    if (isBifoldLiftLeaf && width >= 220 && height >= 180) {
      // AVENTOS HF Bi-Fold: Ø35mm cups lie along horizontal top/bottom edges (X = 80mm & width - 80mm, Y = 22.5mm or height - 22.5mm)!
      const cupXs = [Math.min(90, Math.round(width * 0.2)), Math.max(width - 90, Math.round(width * 0.8))];
      const isUpperLeaf = part.label.includes("Üst Kanat");
      cupXs.forEach((cx, idx) => {
        if (isUpperLeaf) {
          // Top carcass hinge 70T5550 (near top edge y = height - 22.5) + center safety hinge 78Z5500T (near bottom edge y = 22.5)
          holes.push(
            {
              id: `H_${part.id}_hf_top_cup_${idx}`,
              diameter: 35,
              depth: 12.5,
              x: cx,
              y: roundMm(height - 22.5, 2),
              z: 0,
              direction: "face_back",
              purpose: "hinge_cup",
            },
            {
              id: `H_${part.id}_hf_mid_cup_${idx}`,
              diameter: 35,
              depth: 12.5,
              x: cx,
              y: 22.5,
              z: 0,
              direction: "face_back",
              purpose: "hinge_cup",
            }
          );
        } else {
          // Lower leaf receives matching center hinge 78Z5500T along top edge (y = height - 22.5)
          holes.push({
            id: `H_${part.id}_hf_low_mid_cup_${idx}`,
            diameter: 35,
            depth: 12.5,
            x: cx,
            y: roundMm(height - 22.5, 2),
            z: 0,
            direction: "face_back",
            purpose: "hinge_cup",
          });
        }
      });
    } else if (!isPureSlidingOrStayLift) {
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

    const isUpperBifoldLeaf =
      part.id.includes("_lift_bifold_top") ||
      part.label.includes("Katlanır Kalkar Üst Kanat") ||
      (isBifoldLiftLeaf && part.label.includes("Üst Kanat"));
    if (!isUpperBifoldLeaf && part.handleSpacingMm && part.handleSpacingMm > 0) {
      const isLiftHorizontalFallback =
        part.id.includes("lift_") ||
        part.label.includes("Kalkar") ||
        part.id.includes("_dsh_door");
      const hSpec = part.handleDrillSpec || {
        orientation: isLiftHorizontalFallback ? ("horizontal" as const) : ("vertical" as const),
        centerXMm: isLiftHorizontalFallback
          ? roundMm(width / 2, 2)
          : part.role.includes("left")
          ? Math.max(35, width - 42)
          : 42,
        centerYMm: isLiftHorizontalFallback ? Math.min(height / 2, 40) : roundMm(height / 2, 2),
        spacingCcMm: part.handleSpacingMm,
      };

      if (hSpec.spacingCcMm === 1) {
        holes.push({
          id: `H_${part.id}_handle_knob`,
          diameter: 5,
          depth: partThickness,
          x: roundMm(hSpec.centerXMm, 2),
          y: roundMm(hSpec.centerYMm, 2),
          z: 0,
          direction: "face_front",
          purpose: "handle",
        });
      } else {
        // P0-02: Never silently clamp manufacturer C-C screw pitch!
        const halfCc = hSpec.spacingCcMm / 2;
        const holeA =
          hSpec.orientation === "horizontal"
            ? { x: roundMm(hSpec.centerXMm - halfCc, 2), y: roundMm(hSpec.centerYMm, 2) }
            : { x: roundMm(hSpec.centerXMm, 2), y: roundMm(hSpec.centerYMm - halfCc, 2) };
        const holeB =
          hSpec.orientation === "horizontal"
            ? { x: roundMm(hSpec.centerXMm + halfCc, 2), y: roundMm(hSpec.centerYMm, 2) }
            : { x: roundMm(hSpec.centerXMm, 2), y: roundMm(hSpec.centerYMm + halfCc, 2) };
        holes.push(
          {
            id: `H_${part.id}_handle_a`,
            diameter: 5,
            depth: partThickness,
            x: holeA.x,
            y: holeA.y,
            z: 0,
            direction: "face_front",
            purpose: "handle",
          },
          {
            id: `H_${part.id}_handle_b`,
            diameter: 5,
            depth: partThickness,
            x: holeB.x,
            y: holeB.y,
            z: 0,
            direction: "face_front",
            purpose: "handle",
          }
        );
      }
    }
  }

  // 5. Drawer Fronts (`drawer_front`): ZSF / EXPANDO Front-Fixing Boss Holes (face_back) + Handle Through-Holes (face_front)
  else if (part.role === "drawer_front" && width >= 80 && height >= 200) {
    // Note: in CutPiece local coords for drawer_front, `height` = horizontal span (Boy), `width` = vertical front height (En)
    const bracketBottomY = Math.min(roundMm(width * 0.42, 2), 42);
    const leftBrkY = 32.5;
    const rightBrkY = Math.max(leftBrkY + 60, roundMm(height - 32.5, 2));

    [leftBrkY, rightBrkY].forEach((spanPos, sIdx) => {
      holes.push({
        id: `H_${part.id}_zsf_a_${sIdx}`,
        diameter: 10,
        depth: 12,
        x: bracketBottomY,
        y: spanPos,
        z: partThickness,
        direction: "face_back",
        purpose: "drawer_front_fixer",
      });
      if (width >= bracketBottomY + 46) {
        holes.push({
          id: `H_${part.id}_zsf_b_${sIdx}`,
          diameter: 10,
          depth: 12,
          x: roundMm(bracketBottomY + 32, 2),
          y: spanPos,
          z: partThickness,
          direction: "face_back",
          purpose: "drawer_front_fixer",
        });
      }
    });

    if (part.handleSpacingMm && part.handleSpacingMm > 0) {
      // Note: on drawer_front CutPiece local coords, `width` = vertical front height (3D Y), `height` = horizontal span (3D X)!
      const handleVertX = part.handleDrillSpec
        ? roundMm(part.handleDrillSpec.centerYMm, 2)
        : roundMm(width <= 260 ? width * 0.5 : Math.max(width * 0.5, width - 38), 2);
      const midSpanY = part.handleDrillSpec
        ? roundMm(part.handleDrillSpec.centerXMm, 2)
        : roundMm(height / 2, 2);
      const cc = part.handleDrillSpec?.spacingCcMm ?? part.handleSpacingMm;
      if (cc === 1) {
        holes.push({
          id: `H_${part.id}_drw_knob`,
          diameter: 5,
          depth: partThickness,
          x: handleVertX,
          y: midSpanY,
          z: 0,
          direction: "face_front",
          purpose: "handle",
        });
      } else {
        // P0-02: Never silently alter manufacturer C-C pitch; exact halfCc is drilled!
        const halfCc = cc / 2;
        holes.push(
          {
            id: `H_${part.id}_drw_handle_l`,
            diameter: 5,
            depth: partThickness,
            x: handleVertX,
            y: roundMm(midSpanY - halfCc, 2),
            z: 0,
            direction: "face_front",
            purpose: "handle",
          },
          {
            id: `H_${part.id}_drw_handle_r`,
            diameter: 5,
            depth: partThickness,
            x: handleVertX,
            y: roundMm(midSpanY + halfCc, 2),
            z: 0,
            direction: "face_front",
            purpose: "handle",
          }
        );
      }
    }
  }

  // 6. Wooden Drawer Sides (`drawer_side_left` / `drawer_side_right`): Dowel/Confirmat Rear Joint + Locking Device Catch Bore
  else if ((part.role === "drawer_side_left" || part.role === "drawer_side_right") && width >= 65 && height >= 200) {
    // Local coords: `height` = box depth (Boy), `width` = side height (En)
    const midZ = roundMm(partThickness / 2, 2);
    const lowX = Math.min(28, roundMm(width * 0.35, 2));
    const highX = Math.max(lowX + 24, roundMm(width - 20, 2));
    // Rear board (`drawer_back`) sits between the two 16mm wooden sides -> drill face pilot holes at rear (y = height - 8mm)
    holes.push(
      {
        id: `H_${part.id}_dside_rear_a`,
        diameter: 5,
        depth: partThickness,
        x: lowX,
        y: roundMm(height - 8, 2),
        z: 0,
        direction: "face_front",
        purpose: "dowel",
      },
      {
        id: `H_${part.id}_dside_rear_b`,
        diameter: 5,
        depth: partThickness,
        x: highX,
        y: roundMm(height - 8, 2),
        z: 0,
        direction: "face_front",
        purpose: "dowel",
      },
      // Front edge dowel to align with drawer front
      {
        id: `H_${part.id}_dside_front_dowel`,
        diameter: 8,
        depth: 22,
        x: Math.round(width / 2),
        y: 0,
        z: midZ,
        direction: "edge_bottom",
        purpose: "dowel",
      }
    );
  }

  // 7. Drawer Back Panel (`drawer_back`): Blum MOVENTO/TANDEM Ø6x10mm Rear Hook Holes (Wooden) or Steel Back Adapter Holes (Metal Box)
  else if (part.role === "drawer_back" && width >= 55 && height >= 120) {
    // Local coords: `height` = back width (Boy), `width` = back height (En)
    if (part.isWoodenDrawerBox) {
      // Blum MOVENTO / TANDEM concealed runner rear hook holes: Ø6mm x 10mm at 11mm from bottom edge, 7mm from outer side face (= inset from inner board edge or 10mm)
      const hookFromBottomX = 11;
      holes.push(
        {
          id: `H_${part.id}_blum_rear_hook_l`,
          diameter: 6,
          depth: 10,
          x: hookFromBottomX,
          y: 10,
          z: partThickness,
          direction: "face_back",
          purpose: "drawer_hook",
        },
        {
          id: `H_${part.id}_blum_rear_hook_r`,
          diameter: 6,
          depth: 10,
          x: hookFromBottomX,
          y: roundMm(height - 10, 2),
          z: partThickness,
          direction: "face_back",
          purpose: "drawer_hook",
        }
      );
    } else {
      // LEGRABOX / TANDEMBOX 16mm wooden back board: steel rear-bracket screw bores on left & right ends
      const lowX = 18;
      const highX = Math.max(36, roundMm(width - 18, 2));
      [9, roundMm(height - 9, 2)].forEach((endY, eIdx) => {
        holes.push(
          {
            id: `H_${part.id}_mbox_back_a_${eIdx}`,
            diameter: 5,
            depth: 12,
            x: lowX,
            y: endY,
            z: partThickness,
            direction: "face_back",
            purpose: "slide_mount",
          },
          {
            id: `H_${part.id}_mbox_back_b_${eIdx}`,
            diameter: 5,
            depth: 12,
            x: highX,
            y: endY,
            z: partThickness,
            direction: "face_back",
            purpose: "slide_mount",
          }
        );
      });
    }
  }

  // 8. 18mm Structural Flush Back Panel (`carcass_back` with `backPanelMode === "flush"`): Minifix Cams + Edge Bolts!
  else if (part.role === "carcass_back" && part.backPanelMode === "flush" && partThickness >= 16 && width >= 200 && height >= 200) {
    const midZ = roundMm(partThickness / 2, 2);
    [64, roundMm(height - 64, 2)].forEach((py, idx) => {
      holes.push(
        {
          id: `H_${part.id}_flush_cam_l_${idx}`,
          diameter: 15,
          depth: 13.5,
          x: 34,
          y: py,
          z: partThickness,
          direction: "face_back",
          purpose: "minifix_cam",
        },
        {
          id: `H_${part.id}_flush_edge_l_${idx}`,
          diameter: 8,
          depth: 34,
          x: 0,
          y: py,
          z: midZ,
          direction: "edge_left",
          purpose: "minifix_bolt",
        },
        {
          id: `H_${part.id}_flush_cam_r_${idx}`,
          diameter: 15,
          depth: 13.5,
          x: roundMm(width - 34, 2),
          y: py,
          z: partThickness,
          direction: "face_back",
          purpose: "minifix_cam",
        },
        {
          id: `H_${part.id}_flush_edge_r_${idx}`,
          diameter: 8,
          depth: 34,
          x: width,
          y: py,
          z: midZ,
          direction: "edge_right",
          purpose: "minifix_bolt",
        }
      );
    });
  }

  return holes;
}
