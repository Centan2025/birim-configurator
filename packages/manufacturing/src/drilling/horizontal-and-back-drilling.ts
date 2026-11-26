import { roundMm } from "@birim/core";
import type { PartDrillingContext } from "./drilling-context";

export function drillHorizontalPanel(ctx: PartDrillingContext): boolean {
  const {
    part, holes, width, height, partThickness, panelT,
    topology, buildJointSpecs, pickTwoEndJoints,
  } = ctx;
  // 3. Horizontal Carcass Panels, 90mm Stretchers & Fixed/Appliance Carrier Shelves
  if (
    part.role === "carcass_bottom" ||
    part.role === "carcass_top" ||
    part.role === "shelf_fixed" ||
    (part.role === "shelf" && (part.label.includes("Sabit") || part.label.includes("Taşıyıcı Tabla")))
  ) {
    const isFixedOrCarrierShelf = part.role === "shelf" || part.role === "shelf_fixed";
    if (
      part.id.includes("_capsule_bottom") ||
      part.id.includes("_capsule_top") ||
      part.id.includes("_rounded_bottom") ||
      part.id.includes("_rounded_top") ||
      part.id.includes("_pedestal_disc_")
    ) {
      return true;
    }

    const rawJointSpecs =
      width <= 110
        ? [{ boltFromFront: 32, dowelFromFront: width >= 80 ? 64 : (null as number | null) }]
        : buildJointSpecs(width);
    const jointSpecs = isFixedOrCarrierShelf ? pickTwoEndJoints(rawJointSpecs) : rawJointSpecs;

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
      return true;
    }

    if (
      (!isFixedOrCarrierShelf && topology === "miter_45") ||
      part.id.includes("_capsule_bottom") ||
      part.id.includes("_capsule_top")
    ) {
      return true;
    }

    const camFace = part.role === "carcass_top" || part.role === "shelf" ? "face_back" : "face_front";
    const camZ = camFace === "face_back" ? partThickness : 0;
    const midZ = roundMm(partThickness / 2, 2);

    // Rafix 20 Fixed Shelf Housing Bores (Ø20x14.2mm on underside, 9.5mm edge center, zero edge boring required!)
    if (isFixedOrCarrierShelf && part.label.includes("Rafix")) {
      const rafixPocketDepth = roundMm(Math.min(14.2, Math.max(12.5, partThickness - 3.8)), 2);
      [37, Math.max(101, width - 37)].forEach((rx, idx) => {
        holes.push(
          {
            id: `H_${part.id}_rafix_pocket_left_${idx}`,
            diameter: 20,
            depth: rafixPocketDepth,
            x: rx,
            y: 9.5,
            z: camZ,
            direction: camFace,
            purpose: "rafix_housing",
          },
          {
            id: `H_${part.id}_rafix_pocket_right_${idx}`,
            diameter: 20,
            depth: rafixPocketDepth,
            x: rx,
            y: roundMm(height - 9.5, 2),
            z: camZ,
            direction: camFace,
            purpose: "rafix_housing",
          }
        );
      });
      return true;
    }

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
    return true;
  }
  return false;
}

export function drillFlushBackPanel(ctx: PartDrillingContext): boolean {
  const { part, holes, width, height, partThickness } = ctx;
  // 8. 18mm Structural Flush Back Panel (`carcass_back` with `backPanelMode === "flush"`): Minifix Cams + Edge Bolts!
  if (part.role === "carcass_back" && part.backPanelMode === "flush" && partThickness >= 16 && width >= 200 && height >= 200) {
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
    return true;
  }
  return false;
}
