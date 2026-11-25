import { computeSystem32MultiHoleYs, roundMm, type DrillingHole } from "@birim/core";
import type { PartDrillingContext } from "./drilling-context";

export function drillOuterSidePanel(ctx: PartDrillingContext): boolean {
  const {
    part, holes, width, height, partThickness, panelT, drillTpl,
    insetSetbackX, topology, mapX, buildJointSpecs,
    buildFixedShelfCoaxialSpecs, getDrawerRunnerHoleXs, pickTwoEndJoints,
  } = ctx;
  // 1. Outer Carcass Side Panels (carcass_side_left & carcass_side_right)
  if (part.role.includes("side") && !part.role.includes("drawer")) {
    const face = "face_front";
    const midZ = roundMm(partThickness / 2, 2);
    const bottomOffsetY = Math.max(0, part.bottomJointOffsetY ?? 0);
    const botJointY = roundMm(bottomOffsetY + panelT / 2, 2);
    const topJointY = roundMm(height - panelT / 2, 2);
    const jointSpecs = buildJointSpecs(width);

    if (topology === "top_bottom_through" && bottomOffsetY === 0) {
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
    } else if (String(topology) === "miter_45") {
      // Tip C: 45° Mitered carcass — omit 9mm edge-splitting minifix bolts; place internal alignment dowels!
      (typeof part.fixedShelfDepthMm === "number" && part.fixedShelfDepthMm >= 140
        ? buildFixedShelfCoaxialSpecs(part.fixedShelfDepthMm, part.fixedShelfFrontOffsetMm ?? 0)
        : pickTwoEndJoints(jointSpecs)
      ).forEach((jt, idx) => {
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
        const topNotch = (part.golaNotches || []).find((gn) => gn.kind === "L_TOP");
        const golaFrontShiftMm = topNotch ? topNotch.widthMm : 0;
        if (sMode === "vertical_sink") {
          const vertX = mapX(roundMm(golaFrontShiftMm + panelT / 2, 2));
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
            // Front 90mm horizontal stretcher shifts back by golaFrontShiftMm when top Gola/Finger-Box is active!
            const frontBoltX = roundMm(golaFrontShiftMm + 37, 2);
            const frontDowelX = roundMm(golaFrontShiftMm + 69, 2);
            holes.push(
              {
                id: `H_${part.id}_stretcher_front_bolt`,
                diameter: 8,
                depth: 11,
                x: mapX(frontBoltX),
                y: topJointY,
                z: 0,
                direction: face,
                purpose: "minifix_bolt",
              },
              {
                id: `H_${part.id}_stretcher_front_dowel`,
                diameter: 8,
                depth: 12,
                x: mapX(frontDowelX),
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
    if (topology !== "miter_45") (part.fixedShelfJointYs || []).forEach((fsY, fsIdx) => {
      if (fsY <= botJointY + 32 || fsY >= topJointY - 32) return;
      (typeof part.fixedShelfDepthMm === "number" && part.fixedShelfDepthMm >= 140
        ? buildFixedShelfCoaxialSpecs(part.fixedShelfDepthMm, part.fixedShelfFrontOffsetMm ?? 0)
        : pickTwoEndJoints(jointSpecs)
      ).forEach((jt, idx) => {
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

    // Rafix 20 fixed shelf Ø5x11mm connecting bolt holes on side panel (9.5mm above shelf underside -> shelf center - 9 + 9.5 = center + 0.5mm, aligned at System 32 front/back columns)
    (part.rafixShelfJointYs || []).forEach((rfY, rfIdx) => {
      if (rfY <= botJointY + 32 || rfY >= topJointY - 32) return;
      [37, Math.max(101, width - 37)].forEach((rx, xIdx) => {
        holes.push({
          id: `H_${part.id}_rafix_stud_${rfIdx}_${xIdx}`,
          diameter: 5,
          depth: 11,
          x: mapX(rx),
          y: roundMm(rfY, 2),
          z: 0,
          direction: face,
          purpose: "rafix_stud",
        });
      });
    });

    // Blum/Hettich Concealed Drawer Runner Ø5x12mm Carcass Euro Screw Holes (37/57mm + 32mm + rear b1)
    (part.drawerRunnerSpecs || []).forEach((drw, dIdx) => {
      if (drw.y <= botJointY + 12 || drw.y >= topJointY - 24) return;
      const xs = getDrawerRunnerHoleXs(drw.runnerLengthMm, Boolean(part.isInsetDoor || drw.isInternal), width);
      const tag = drw.drawerId || `d${dIdx}`;
      xs.forEach((rx, xIdx) => {
        holes.push({
          id: `H_${part.id}_drw_runner_${tag}_${xIdx}`,
          diameter: 5,
          depth: 12,
          x: mapX(rx),
          y: roundMm(drw.y, 2),
          z: 0,
          direction: face,
          purpose: "drawer_runner" as DrillingHole["purpose"],
        });
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
      blockedYsMm: [
        ...[...(part.fixedShelfJointYs || []), ...(part.rafixShelfJointYs || [])].map((fsy) => ({
          y: fsy,
          clearanceMm: 18,
        })),
        ...(part.drawerRunnerSpecs || []).map((dr) => ({
          y: dr.y + 36,
          clearanceMm: 52,
        })),
      ],
    });

    // Column-grouped System 32 boring: front column first, then optional mid column, then rear column
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
    }
    if (midPinX !== null && Math.abs(midPinX - frontPinX) >= 64 && Math.abs(backPinX - midPinX) >= 64) {
      for (const y of sideMultiHoleYs) {
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
    }
    if (Math.abs(backPinX - frontPinX) >= 64) {
      for (const y of sideMultiHoleYs) {
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
    return true;
  }

  return false;
}
