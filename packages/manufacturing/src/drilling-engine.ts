import { ParametricPart, DrillingHole, roundMm } from "@birim/core";
import { createPartDrillingContext } from "./drilling/drilling-context";
import { drillOuterSidePanel } from "./drilling/side-panel-drilling";
import { drillIntermediateDivider } from "./drilling/divider-drilling";
import { drillHorizontalPanel, drillFlushBackPanel } from "./drilling/horizontal-and-back-drilling";
import { drillDoorOrDrawerPart } from "./drilling/front-and-drawer-drilling";

/**
 * Generates collision-free, mirrored, System-32 compliant CNC drilling operations
 * by delegating in strict priority order to specialized part-role boring modules.
 */
export function generateDrillingForPart(part: ParametricPart): DrillingHole[] {
  const ctx = createPartDrillingContext(part);
  const { holes, width, height, connectorSys } = ctx;

  const isFixedShelfPart =
    part.role === "shelf_fixed" ||
    (part.role === "shelf" &&
      (part.label.includes("Sabit") || part.label.includes("Taşıyıcı Tabla")));

  if (
    connectorSys === "lamello_cabineo" &&
    (part.role === "carcass_top" || part.role === "carcass_bottom" || isFixedShelfPart)
  ) {
    const pocketXs = [37, Math.max(69, width - 37)];
    pocketXs.forEach((px, pIdx) => {
      holes.push(
        {
          id: `H_${part.id}_cabineo_L_${pIdx}`,
          diameter: 15,
          depth: 12.5,
          x: roundMm(px, 2),
          y: 12,
          z: 0,
          direction: "face_front",
          purpose: "cabineo_pocket",
        },
        {
          id: `H_${part.id}_cabineo_R_${pIdx}`,
          diameter: 15,
          depth: 12.5,
          x: roundMm(px, 2),
          y: roundMm(height - 12, 2),
          z: 0,
          direction: "face_front",
          purpose: "cabineo_pocket",
        }
      );
    });
    if (!isFixedShelfPart && part.dividerJointPositionsY && part.dividerJointPositionsY.length > 0) {
      const divFace = part.role === "carcass_top" ? "face_back" : "face_front";
      const divZ = divFace === "face_back" ? ctx.partThickness : 0;
      part.dividerJointPositionsY.forEach((divY, dIdx) => {
        if (divY <= 20 || divY >= height - 20) return;
        pocketXs.forEach((px, pIdx) => {
          holes.push({
            id: `H_${part.id}_cabineo_div_${dIdx}_${pIdx}`,
            diameter: 5,
            depth: 11,
            x: roundMm(px, 2),
            y: roundMm(divY, 2),
            z: divZ,
            direction: divFace,
            purpose: "cabineo_pocket",
          });
        });
      });
    }
    return holes;
  }

  if (drillOuterSidePanel(ctx)) return holes;
  if (drillIntermediateDivider(ctx)) return holes;
  if (drillHorizontalPanel(ctx)) return holes;
  if (drillDoorOrDrawerPart(ctx)) return holes;
  drillFlushBackPanel(ctx);

  return holes;
}
