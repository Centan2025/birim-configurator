import { calculateDoorHingePositionsY, roundMm, type DrillingHole } from "@birim/core";
import type { PartDrillingContext } from "./drilling-context";

export function drillDoorOrDrawerPart(ctx: PartDrillingContext): boolean {
  const {
    part, holes, width, height, partThickness,
    drillTpl, isVisualOnlyHardware, getDrawerRunnerHoleXs,
  } = ctx;
  const beforeLen = holes.length;
  // 4. Doors (Kapaklar): Manufacturer-Specific Ø35mm Hinge Cups (including AVENTOS HF Bi-Fold!) & Handle Bores
  if (part.role.includes("door")) {
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

  // 7b. Internal Drawer Blind Divider (`carcass_sub_divider` with `drawerRunnerSpecs`): Euro Screw Runner Holes
  else if (part.role === "carcass_sub_divider" && part.drawerRunnerSpecs && part.drawerRunnerSpecs.length > 0 && width >= 120 && height >= 80) {
    const face: "face_front" | "face_back" = "face_front";
    part.drawerRunnerSpecs.forEach((drw, dIdx) => {
      if (drw.y < 12 || drw.y > height - 16) return;
      // Blind divider starts directly behind the front filler strip (flush with internal drawer front),
      // so the concealed runner front setback from the blind divider's front edge is standard 37mm.
      const xs = getDrawerRunnerHoleXs(drw.runnerLengthMm, false, width);
      const tag = drw.drawerId || `d${dIdx}`;
      xs.forEach((rx, xIdx) => {
        holes.push({
          id: `H_${part.id}_blind_runner_${tag}_${xIdx}`,
          diameter: 5,
          depth: 12,
          x: roundMm(rx, 2),
          y: roundMm(drw.y, 2),
          z: 0,
          direction: face,
          purpose: "drawer_runner" as DrillingHole["purpose"],
        });
      });
    });
  }
  return holes.length > beforeLen;
}
