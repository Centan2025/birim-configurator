import { computeSystem32MultiHoleYs, roundMm, type DrillingHole } from "@birim/core";
import type { PartDrillingContext } from "./drilling-context";

export function drillIntermediateDivider(ctx: PartDrillingContext): boolean {
  const {
    part, holes, width, height, partThickness, panelT, drillTpl,
    insetSetbackX, buildJointSpecs, buildFixedShelfCoaxialSpecs,
    getDrawerRunnerHoleXs, pickTwoEndJoints,
  } = ctx;
  // 2. Intermediate Carcass Dividers (carcass_divider) — Coaxial System 32 Joint Specs matching carcass_bottom & carcass_top!
  if (part.role === "carcass_divider" && width >= 140 && height >= 180) {
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

    // Single-sided Fixed Shelves on Intermediate Divider (face_front = left bay, face_back = right bay)
    const divBlindDepth = Math.min(11, Math.max(8, partThickness - 5));
    (part.dividerLeftFixedShelfYs || []).forEach((ly, lIdx) => {
      if (ly <= 48 || ly >= height - 48) return;
      (typeof part.fixedShelfDepthMm === "number" && part.fixedShelfDepthMm >= 140
        ? buildFixedShelfCoaxialSpecs(part.fixedShelfDepthMm, part.fixedShelfFrontOffsetMm ?? 0)
        : pickTwoEndJoints(divJointSpecs)
      ).forEach((js, xIdx) => {
        holes.push({
          id: `H_${part.id}_div_lfs_bolt_${lIdx}_${xIdx}`,
          diameter: 8,
          depth: divBlindDepth,
          x: js.boltFromFront,
          y: roundMm(ly, 2),
          z: 0,
          direction: "face_front",
          purpose: "minifix_bolt",
        });
        if (js.dowelFromFront !== null) {
          holes.push({
            id: `H_${part.id}_div_lfs_dowel_${lIdx}_${xIdx}`,
            diameter: 8,
            depth: divBlindDepth,
            x: js.dowelFromFront,
            y: roundMm(ly, 2),
            z: 0,
            direction: "face_front",
            purpose: "dowel",
          });
        }
      });
    });
    (part.dividerRightFixedShelfYs || []).forEach((ry, rIdx) => {
      if (ry <= 48 || ry >= height - 48) return;
      (typeof part.fixedShelfDepthMm === "number" && part.fixedShelfDepthMm >= 140
        ? buildFixedShelfCoaxialSpecs(part.fixedShelfDepthMm, part.fixedShelfFrontOffsetMm ?? 0)
        : pickTwoEndJoints(divJointSpecs)
      ).forEach((js, xIdx) => {
        holes.push({
          id: `H_${part.id}_div_rfs_bolt_${rIdx}_${xIdx}`,
          diameter: 8,
          depth: divBlindDepth,
          x: js.boltFromFront,
          y: roundMm(ry, 2),
          z: partThickness,
          direction: "face_back",
          purpose: "minifix_bolt",
        });
        if (js.dowelFromFront !== null) {
          holes.push({
            id: `H_${part.id}_div_rfs_dowel_${rIdx}_${xIdx}`,
            diameter: 8,
            depth: divBlindDepth,
            x: js.dowelFromFront,
            y: roundMm(ry, 2),
            z: partThickness,
            direction: "face_back",
            purpose: "dowel",
          });
        }
      });
    });
    (part.dividerLeftRafixYs || []).forEach((ly, lIdx) => {
      if (ly <= 48 || ly >= height - 48) return;
      [37, Math.max(101, width - 37)].forEach((rx, xIdx) => {
        holes.push({
          id: `H_${part.id}_div_lrafix_${lIdx}_${xIdx}`,
          diameter: 5,
          depth: divBlindDepth,
          x: rx,
          y: roundMm(ly, 2),
          z: 0,
          direction: "face_front",
          purpose: "rafix_stud",
        });
      });
    });
    (part.dividerRightRafixYs || []).forEach((ry, rIdx) => {
      if (ry <= 48 || ry >= height - 48) return;
      [37, Math.max(101, width - 37)].forEach((rx, xIdx) => {
        holes.push({
          id: `H_${part.id}_div_rrafix_${rIdx}_${xIdx}`,
          diameter: 5,
          depth: divBlindDepth,
          x: rx,
          y: roundMm(ry, 2),
          z: partThickness,
          direction: "face_back",
          purpose: "rafix_stud",
        });
      });
    });

    // Blum/Hettich Drawer Runner Ø5x12mm Euro Screw Holes on Intermediate Divider (left=face_front, right=face_back)
    (part.dividerLeftDrawerRunners || []).forEach((drw, dIdx) => {
      if (drw.y <= 14 || drw.y >= height - 24) return;
      const xs = getDrawerRunnerHoleXs(drw.runnerLengthMm, Boolean(part.isInsetDoor || drw.isInternal), width);
      const tag = drw.drawerId || `ld${dIdx}`;
      xs.forEach((rx, xIdx) => {
        holes.push({
          id: `H_${part.id}_drw_runner_${tag}_${xIdx}`,
          diameter: 5,
          depth: 11,
          x: rx,
          y: roundMm(drw.y, 2),
          z: 0,
          direction: "face_front",
          purpose: "drawer_runner" as DrillingHole["purpose"],
        });
      });
    });
    (part.dividerRightDrawerRunners || []).forEach((drw, dIdx) => {
      if (drw.y <= 14 || drw.y >= height - 24) return;
      const xs = getDrawerRunnerHoleXs(drw.runnerLengthMm, Boolean(part.isInsetDoor || drw.isInternal), width);
      const tag = drw.drawerId || `rd${dIdx}`;
      xs.forEach((rx, xIdx) => {
        holes.push({
          id: `H_${part.id}_drw_runner_${tag}_${xIdx}`,
          diameter: 5,
          depth: 11,
          x: rx,
          y: roundMm(drw.y, 2),
          z: partThickness,
          direction: "face_back",
          purpose: "drawer_runner" as DrillingHole["purpose"],
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
      blockedYsMm: [
        ...tJunctionYs,
        ...(part.dividerLeftFixedShelfYs || []),
        ...(part.dividerRightFixedShelfYs || []),
        ...(part.dividerLeftRafixYs || []),
        ...(part.dividerRightRafixYs || []),
      ].map((ty) => ({ y: ty, clearanceMm: 18 })),
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
    return true;
  }
  return false;
}
