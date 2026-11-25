import { ModuleInstance } from "@birim/core";
import { ComponentGeometry } from "../types";

/**
 * Applies true 3D sloped-ceiling / attic / under-stairs cutting to all module components
 * (sides, dividers, sloped & flat top panels, back panel, shelves, and doors)
 * reading either `module.carcass.roofSlope` or `module.carcass.slopedCeiling`.
 */
export function applySlopedCeilingToComponents(
  components: ComponentGeometry[],
  module: ModuleInstance,
  panelT: number,
  bodyMatId: string
): void {
  const W = module.dimensions.width;
  const H = module.dimensions.height;
  const D = module.dimensions.depth;
  const T = Math.max(12, panelT || module.carcass.panelThickness || 18);

  const rs = module.carcass.roofSlope;
  const sc = module.carcass.slopedCeiling;

  let side: "none" | "left" | "right" | "rear" = "none";
  let kneeH = H;
  let runMm = 0;

  if (rs && rs.side && rs.side !== "none") {
    side = rs.side;
    kneeH = Math.max(400, Math.min(H - 120, Math.round(rs.kneeWallHeightMm)));
    const maxRun = side === "rear" ? D : W;
    runMm = Math.max(150, Math.min(maxRun, Math.round(rs.slopeRunMm)));
  } else if (sc && sc.mode && sc.mode !== "none") {
    side =
      sc.mode === "left_slope"
        ? "left"
        : sc.mode === "right_slope"
        ? "right"
        : "rear";
    kneeH = Math.max(400, Math.min(H - 120, Math.round(sc.kneeHeightMm)));
    const maxRun = side === "rear" ? D : W;
    const rad = ((Math.max(5, Math.min(75, sc.slopeAngleDeg || 35))) * Math.PI) / 180;
    const computedRun = Math.round((H - kneeH) / Math.max(0.15, Math.tan(rad)));
    runMm = Math.max(150, Math.min(maxRun, computedRun));
  }

  if (side === "none" || H - kneeH < 20) return;

  const rise = H - kneeH;
  const slopeRad = Math.atan2(rise, runMm);
  const slopedLen = Math.round(Math.hypot(runMm, rise));

  const getCeilingYAtX = (xMm: number): number => {
    const x = Math.max(0, Math.min(W, xMm));
    if (side === "left") {
      if (x >= runMm) return H;
      return kneeH + (x / runMm) * rise;
    }
    if (side === "right") {
      const distR = W - x;
      if (distR >= runMm) return H;
      return kneeH + (distR / runMm) * rise;
    }
    return H;
  };

  const toRemove = new Set<number>();
  const topPanelsToAdd: ComponentGeometry[] = [];
  let replacedTop = false;

  for (let i = 0; i < components.length; i++) {
    const comp = components[i];
    const role = comp.role;
    const { x, y, z } = comp.position;
    const { width: cw, height: ch, depth: cd } = comp.dimensions;

    // 1. Replace flat carcass_top with sloped + optional flat top panel
    if (role === "carcass_top") {
      toRemove.add(i);
      if (!replacedTop) {
        replacedTop = true;
        if (side === "left") {
          const flatSpan = W - runMm;
          if (flatSpan > T + 20) {
            topPanelsToAdd.push({
              id: `${module.id}_top_flat`,
              role: "carcass_top",
              label: "Üst Panel (Düz Kısım)",
              dimensions: { width: Math.max(40, flatSpan - T), height: T, depth: D },
              position: { x: runMm, y: H - T, z: 0 },
              materialId: bodyMatId,
              isManufacturablePanel: true,
              thicknessAxis: "y",
            });
          }
          topPanelsToAdd.push({
            id: `${module.id}_top_sloped`,
            role: "carcass_top",
            label: `Eğimli Üst Tabla (${Math.round((slopeRad * 180) / Math.PI)}°)`,
            dimensions: { width: slopedLen, height: T, depth: D },
            position: { x: 0, y: kneeH - T, z: 0 },
            pivot: { x: 0, y: kneeH, z: 0 },
            rotation: [0, 0, slopeRad],
            materialId: bodyMatId,
            isManufacturablePanel: true,
            thicknessAxis: "y",
          });
        } else if (side === "right") {
          const flatSpan = W - runMm;
          if (flatSpan > T + 20) {
            topPanelsToAdd.push({
              id: `${module.id}_top_flat`,
              role: "carcass_top",
              label: "Üst Panel (Düz Kısım)",
              dimensions: { width: Math.max(40, flatSpan - T), height: T, depth: D },
              position: { x: T, y: H - T, z: 0 },
              materialId: bodyMatId,
              isManufacturablePanel: true,
              thicknessAxis: "y",
            });
          }
          topPanelsToAdd.push({
            id: `${module.id}_top_sloped`,
            role: "carcass_top",
            label: `Eğimli Üst Tabla (${Math.round((slopeRad * 180) / Math.PI)}°)`,
            dimensions: { width: slopedLen, height: T, depth: D },
            position: { x: W - runMm, y: H - T, z: 0 },
            pivot: { x: W - runMm, y: H, z: 0 },
            rotation: [0, 0, -slopeRad],
            materialId: bodyMatId,
            isManufacturablePanel: true,
            thicknessAxis: "y",
          });
        } else {
          // rear slope
          const flatDepth = D - runMm;
          if (flatDepth > 20) {
            topPanelsToAdd.push({
              id: `${module.id}_top_flat`,
              role: "carcass_top",
              label: "Üst Panel (Ön Düz Kısım)",
              dimensions: { width: Math.max(40, W - 2 * T), height: T, depth: flatDepth },
              position: { x: T, y: H - T, z: runMm },
              materialId: bodyMatId,
              isManufacturablePanel: true,
              thicknessAxis: "y",
            });
          }
          topPanelsToAdd.push({
            id: `${module.id}_top_sloped`,
            role: "carcass_top",
            label: `Eğimli Arka Üst Tabla (${Math.round((slopeRad * 180) / Math.PI)}°)`,
            dimensions: { width: Math.max(40, W - 2 * T), height: T, depth: slopedLen },
            position: { x: T, y: kneeH - T, z: 0 },
            pivot: { x: T, y: kneeH, z: 0 },
            rotation: [-slopeRad, 0, 0],
            materialId: bodyMatId,
            isManufacturablePanel: true,
            thicknessAxis: "y",
          });
        }
      }
      continue;
    }

    // 2. Side panels, end panels, and vertical dividers
    if (
      role === "carcass_side_left" ||
      role === "carcass_side_right" ||
      role === "carcass_divider" ||
      role === "end_panel"
    ) {
      if (side === "left" || side === "right") {
        const slopedTopVerticalThick = T / Math.max(0.4, Math.cos(slopeRad));
        let maxTop: number;
        if (role === "carcass_side_left") {
          maxTop = side === "left" ? kneeH - slopedTopVerticalThick : getCeilingYAtX(0);
        } else if (role === "carcass_side_right") {
          maxTop = side === "right" ? kneeH - slopedTopVerticalThick : getCeilingYAtX(W);
        } else if (role === "carcass_divider") {
          const yLowEdge = Math.min(getCeilingYAtX(x), getCeilingYAtX(x + cw));
          const underSlope =
            (side === "left" && x < runMm) || (side === "right" && x + cw > W - runMm);
          maxTop = yLowEdge - (underSlope ? slopedTopVerticalThick : T);
        } else {
          maxTop = Math.min(getCeilingYAtX(x), getCeilingYAtX(x + cw));
        }
        const newH = Math.max(120, Math.min(ch, Math.round(maxTop - y)));
        if (newH < ch - 1) {
          comp.dimensions = { ...comp.dimensions, height: newH };
          comp.polygonContourMm = undefined;
        }
      } else {
        // rear slope: 5-point or 4-point contour in [zMm (0..cd), yMm (0..ch)]
        // Keep side/divider strictly underneath the sloped top panel thickness so it never pokes through the roof slab
        const slopedTopVerticalThick = T / Math.max(0.4, Math.cos(slopeRad));
        const kneeRel = Math.max(120, Math.min(ch - 20, Math.floor(kneeH - slopedTopVerticalThick - y)));
        const frontTopRel =
          runMm >= cd - 4
            ? Math.max(kneeRel + 10, Math.min(ch, Math.floor(H - slopedTopVerticalThick - y)))
            : Math.max(kneeRel + 10, Math.min(ch, Math.floor(H - T - y)));
        const runClamped = Math.max(40, Math.min(cd, runMm));
        const contour: [number, number][] =
          runClamped < cd - 4
            ? [
                [0, 0],
                [cd, 0],
                [cd, frontTopRel],
                [runClamped, frontTopRel],
                [0, kneeRel],
              ]
            : [
                [0, 0],
                [cd, 0],
                [cd, frontTopRel],
                [0, kneeRel],
              ];
        comp.polygonContourMm = contour;
        comp.thicknessAxis = "x";
      }
      continue;
    }

    // 3. Back panel (clipped strictly beneath sloped-top underside so it NEVER pokes above the slope)
    if (role === "carcass_back") {
      const slopedTopVerticalThick = T / Math.max(0.4, Math.cos(slopeRad));
      if (side === "rear") {
        const newH = Math.max(80, Math.min(ch, Math.floor(kneeH - slopedTopVerticalThick - 2 - y)));
        comp.dimensions = { ...comp.dimensions, height: newH };
        comp.polygonContourMm = undefined;
      } else {
        const x0 = x;
        const x1 = x + cw;
        const backTopAtX = (xPos: number) => {
          const underSlope =
            (side === "left" && xPos < runMm) || (side === "right" && xPos > W - runMm);
          return getCeilingYAtX(xPos) - (underSlope ? slopedTopVerticalThick : T) - 1;
        };
        const hL = Math.max(40, Math.min(ch, Math.floor(backTopAtX(x0) - y)));
        const hR = Math.max(40, Math.min(ch, Math.floor(backTopAtX(x1) - y)));
        const hFlatTop = Math.max(40, Math.min(ch, Math.floor(H - T - 1 - y)));
        if (hL < ch - 1 || hR < ch - 1) {
          const breakX = side === "left" ? runMm : W - runMm;
          const contour: [number, number][] =
            breakX > x0 + 6 && breakX < x1 - 6
              ? [
                  [0, 0],
                  [cw, 0],
                  [cw, hR],
                  [Math.round(breakX - x0), hFlatTop],
                  [0, hL],
                ]
              : [
                  [0, 0],
                  [cw, 0],
                  [cw, hR],
                  [0, hL],
                ];
          comp.polygonContourMm = contour;
          comp.thicknessAxis = "z";
        }
      }
      continue;
    }

    // 4. Shelves (trim width on left/right slope, trim depth on rear slope)
    if (role === "shelf") {
      const shelfTopY = y + ch;
      if (shelfTopY > kneeH - T) {
        const frac = Math.min(1, Math.max(0, (shelfTopY - (kneeH - T)) / Math.max(1, rise)));
        if (side === "left") {
          const cutX = frac * runMm + T;
          if (cutX >= x + cw - 60) {
            toRemove.add(i);
          } else if (cutX > x + 2) {
            const delta = Math.round(cutX - x);
            comp.position = { ...comp.position, x: x + delta };
            comp.dimensions = { ...comp.dimensions, width: Math.max(40, cw - delta) };
          }
        } else if (side === "right") {
          const cutX = W - frac * runMm - T;
          if (cutX <= x + 60) {
            toRemove.add(i);
          } else if (cutX < x + cw - 2) {
            comp.dimensions = { ...comp.dimensions, width: Math.max(40, Math.round(cutX - x)) };
          }
        } else {
          const cutZ = frac * runMm + T;
          if (cutZ >= z + cd - 80) {
            toRemove.add(i);
          } else if (cutZ > z + 2) {
            const delta = Math.round(cutZ - z);
            comp.position = { ...comp.position, z: z + delta };
            comp.dimensions = { ...comp.dimensions, depth: Math.max(60, cd - delta) };
          }
        }
      }
      continue;
    }

    // 5. Doors & fronts: true 3D sloped polygon contour on left/right slope
    if (
      (side === "left" || side === "right") &&
      (role === "door_left" ||
        role === "door_right" ||
        role === "door_sliding" ||
        role === "drawer_front")
    ) {
      const x0 = x;
      const x1 = x + cw;
      const hL = Math.max(40, Math.min(ch, Math.round(getCeilingYAtX(x0) - 2 - y)));
      const hR = Math.max(40, Math.min(ch, Math.round(getCeilingYAtX(x1) - 2 - y)));
      if (hL < ch - 1 || hR < ch - 1) {
        const breakX = side === "left" ? runMm : W - runMm;
        const contour: [number, number][] =
          breakX > x0 + 6 && breakX < x1 - 6
            ? [
                [0, 0],
                [cw, 0],
                [cw, hR],
                [Math.round(breakX - x0), ch],
                [0, hL],
              ]
            : [
                [0, 0],
                [cw, 0],
                [cw, hR],
                [0, hL],
              ];
        comp.polygonContourMm = contour;
        comp.thicknessAxis = "z";
      }
      continue;
    }

    // 6. Adjust or remove hardware/fittings (hanging rails, flanges, top hinges, pins) that intersect the sloped ceiling
    if (comp.isManufacturablePanel === false) {
      if (side === "left" || side === "right") {
        const yL = getCeilingYAtX(x);
        const yR = getCeilingYAtX(x + cw);
        const ceilingUndersideAtComp = Math.min(yL, yR) - T / Math.max(0.4, Math.cos(slopeRad));

        if (role === "hanging_rail" || comp.id.includes("_rail")) {
          const safeTopY = ceilingUndersideAtComp - 30;
          if (y + ch > safeTopY) {
            const nextY = Math.round(safeTopY - ch);
            const minUsableRailY = (module.carcass.plinthHeight || 0) + T + 420;
            if (nextY < minUsableRailY) {
              toRemove.add(i);
            } else {
              comp.position = { ...comp.position, y: nextY };
            }
          }
        } else if (y + ch > ceilingUndersideAtComp + 2) {
          toRemove.add(i);
        }
      } else {
        const yBack = z >= runMm ? H : kneeH + (Math.max(0, z) / runMm) * rise;
        const yFront = z + cd >= runMm ? H : kneeH + (Math.max(0, z + cd) / runMm) * rise;
        const maxY = Math.min(yBack, yFront) - T / Math.max(0.4, Math.cos(slopeRad));
        if (y + ch > maxY + 2) {
          toRemove.add(i);
        }
      }
    }
  }

  // Remove trimmed/replaced entries in reverse order
  const sortedRemove = Array.from(toRemove).sort((a, b) => b - a);
  for (const idx of sortedRemove) {
    components.splice(idx, 1);
  }
  if (topPanelsToAdd.length > 0) {
    components.push(...topPanelsToAdd);
  }

  // Compound (hip-roof / dual-axis) secondary slope clip pass when `secondaryRoofSlope` is active
  const rs2 = module.carcass.secondaryRoofSlope;
  if (!rs2 || !rs2.side || rs2.side === "none" || rs2.side === side) return;
  const secSide = rs2.side;
  const secKneeH = Math.max(400, Math.min(H - 20, Math.round(rs2.kneeWallHeightMm)));
  const secMaxRun = secSide === "rear" ? D : W;
  const secRunMm = Math.max(150, Math.min(secMaxRun, Math.round(rs2.slopeRunMm)));
  const secRise = H - secKneeH;
  if (secRise < 20) return;
  const secSlopeRad = Math.atan2(secRise, secRunMm);
  const secSlopedTopVertT = T / Math.max(0.4, Math.cos(secSlopeRad));

  const getSecCeilingYAtX = (xMm: number): number => {
    const cx = Math.max(0, Math.min(W, xMm));
    if (secSide === "left") {
      return cx >= secRunMm ? H : secKneeH + (cx / secRunMm) * secRise;
    }
    if (secSide === "right") {
      const distR = W - cx;
      return distR >= secRunMm ? H : secKneeH + (distR / secRunMm) * secRise;
    }
    return H;
  };

  const getSecCeilingYAtZ = (zMm: number): number => {
    const cz = Math.max(0, Math.min(D, zMm));
    if (secSide === "rear") {
      return cz >= secRunMm ? H : secKneeH + (cz / secRunMm) * secRise;
    }
    return H;
  };

  // Helper: clip an existing [u, v] polygon contour against a horizontal ceiling cap v <= capV
  const clipContourTopToCap = (pts: [number, number][], capV: number): [number, number][] => {
    const out: [number, number][] = [];
    for (let k = 0; k < pts.length; k++) {
      const cur = pts[k];
      const nxt = pts[(k + 1) % pts.length];
      const curIn = cur[1] <= capV + 0.5;
      const nxtIn = nxt[1] <= capV + 0.5;
      if (curIn) out.push(cur);
      if (curIn !== nxtIn) {
        const dy = nxt[1] - cur[1];
        const t = Math.abs(dy) > 1e-4 ? (capV - cur[1]) / dy : 0;
        out.push([Math.round(cur[0] + (nxt[0] - cur[0]) * t), Math.round(capV)]);
      }
    }
    return out.length >= 3 ? out : pts;
  };

  const secRemove = new Set<number>();
  const secTopPanelsToAdd: ComponentGeometry[] = [];
  let addedSecTopPanel = false;
  for (let i = 0; i < components.length; i++) {
    const comp = components[i];
    const role = comp.role;
    const { x, y, z } = comp.position;
    const { width: cw, height: ch, depth: cd } = comp.dimensions;

    // A. Trim existing top panels so their low lateral edge does not poke through the secondary roof slope,
    //    and cap that trimmed lateral zone with a matching sloped top panel so no bay is left open!
    if (role === "carcass_top" && (secSide === "left" || secSide === "right")) {
      const trimInset = Math.min(cw - 60, Math.round(secRunMm));
      if (trimInset > 8 && cw - trimInset >= 60) {
        if (secSide === "left") {
          comp.position = { ...comp.position, x: x + trimInset };
          if (comp.pivot) comp.pivot = { ...comp.pivot, x: comp.pivot.x + trimInset };
          comp.dimensions = { ...comp.dimensions, width: cw - trimInset };
        } else {
          comp.dimensions = { ...comp.dimensions, width: cw - trimInset };
        }

        if (!addedSecTopPanel) {
          addedSecTopPanel = true;
          const secSpanX = Math.max(60, Math.min(secRunMm, trimInset + T));
          const cornerLowY = Math.min(kneeH, secKneeH);
          if (side === "rear") {
            // Compound hip-roof corner: keep rear-corner flat at min(kneeH, secKneeH) and slope only the front zone
            // so the lateral top panel NEVER pokes through the rear roof slope at z = 0!
            const zSplit = Math.max(80, Math.min(D - 80, Math.round(runMm * 0.55)));
            const frontD = Math.max(60, D - zSplit);
            const rearCeilAtSplit =
              zSplit >= runMm ? H : kneeH + (zSplit / Math.max(1, runMm)) * rise;
            const cappedRise = Math.max(10, Math.min(secRise, rearCeilAtSplit - secKneeH));
            const cappedSlopeRad = Math.atan2(cappedRise, Math.max(60, secSpanX));
            const frontSlopedLen = Math.round(Math.hypot(secSpanX, cappedRise));

            secTopPanelsToAdd.push({
              id: `${module.id}_top_corner_rear_flat`,
              role: "carcass_top",
              label: "Kırma Köşe Üst Tabla (Arka)",
              dimensions: { width: secSpanX, height: T, depth: zSplit },
              position: {
                x: secSide === "left" ? T : W - T - secSpanX,
                y: cornerLowY - T,
                z: 0,
              },
              materialId: bodyMatId,
              isManufacturablePanel: true,
              thicknessAxis: "y",
            });

            if (secSide === "left") {
              secTopPanelsToAdd.push({
                id: `${module.id}_top_sloped_sec`,
                role: "carcass_top",
                label: `Kırma Köşe Eğimli Üst Tabla (Sol ${Math.round((cappedSlopeRad * 180) / Math.PI)}°)`,
                dimensions: { width: frontSlopedLen, height: T, depth: frontD },
                position: { x: 0, y: secKneeH - T, z: zSplit },
                pivot: { x: 0, y: secKneeH, z: zSplit },
                rotation: [0, 0, cappedSlopeRad],
                materialId: bodyMatId,
                isManufacturablePanel: true,
                thicknessAxis: "y",
              });
            } else {
              secTopPanelsToAdd.push({
                id: `${module.id}_top_sloped_sec`,
                role: "carcass_top",
                label: `Kırma Köşe Eğimli Üst Tabla (Sağ ${Math.round((cappedSlopeRad * 180) / Math.PI)}°)`,
                dimensions: { width: frontSlopedLen, height: T, depth: frontD },
                position: { x: W - secSpanX, y: secKneeH + cappedRise - T, z: zSplit },
                pivot: { x: W - secSpanX, y: secKneeH + cappedRise, z: zSplit },
                rotation: [0, 0, -cappedSlopeRad],
                materialId: bodyMatId,
                isManufacturablePanel: true,
                thicknessAxis: "y",
              });
            }
          } else {
            const secRiseAtSpan = (secSpanX / Math.max(1, secRunMm)) * secRise;
            const secSlopedLen = Math.round(Math.hypot(secSpanX, secRiseAtSpan));
            if (secSide === "left") {
              secTopPanelsToAdd.push({
                id: `${module.id}_top_sloped_sec`,
                role: "carcass_top",
                label: `İkincil Eğimli Üst Tabla (Sol ${Math.round((secSlopeRad * 180) / Math.PI)}°)`,
                dimensions: { width: secSlopedLen, height: T, depth: D },
                position: { x: 0, y: secKneeH - T, z: 0 },
                pivot: { x: 0, y: secKneeH, z: 0 },
                rotation: [0, 0, secSlopeRad],
                materialId: bodyMatId,
                isManufacturablePanel: true,
                thicknessAxis: "y",
              });
            } else {
              secTopPanelsToAdd.push({
                id: `${module.id}_top_sloped_sec`,
                role: "carcass_top",
                label: `İkincil Eğimli Üst Tabla (Sağ ${Math.round((secSlopeRad * 180) / Math.PI)}°)`,
                dimensions: { width: secSlopedLen, height: T, depth: D },
                position: { x: W - secSpanX, y: H - T, z: 0 },
                pivot: { x: W - secSpanX, y: H, z: 0 },
                rotation: [0, 0, -secSlopeRad],
                materialId: bodyMatId,
                isManufacturablePanel: true,
                thicknessAxis: "y",
              });
            }
          }
        }
      }
      continue;
    }

    // B. Sides, dividers, end panels
    if (
      role === "carcass_side_left" ||
      role === "carcass_side_right" ||
      role === "carcass_divider" ||
      role === "end_panel"
    ) {
      if (secSide === "left" || secSide === "right") {
        const yLowEdge = Math.min(getSecCeilingYAtX(x), getSecCeilingYAtX(x + cw));
        const underSec =
          (secSide === "left" && x < secRunMm) || (secSide === "right" && x + cw > W - secRunMm);
        const capWorldY = yLowEdge - (underSec ? secSlopedTopVertT : T);
        const capLocalY = Math.max(80, Math.floor(capWorldY - y));
        if (Array.isArray(comp.polygonContourMm) && comp.polygonContourMm.length >= 3) {
          comp.polygonContourMm = clipContourTopToCap(comp.polygonContourMm, capLocalY);
        } else if (capLocalY < ch - 1) {
          comp.dimensions = { ...comp.dimensions, height: capLocalY };
        }
      } else {
        // secondary rear slope on a side/divider
        const kneeRel = Math.max(80, Math.min(ch - 10, Math.floor(secKneeH - secSlopedTopVertT - y)));
        const frontTopRel = Math.max(kneeRel + 10, Math.min(ch, Math.floor(H - secSlopedTopVertT - y)));
        const runClamped = Math.max(40, Math.min(cd, secRunMm));
        comp.polygonContourMm =
          runClamped < cd - 4
            ? [
                [0, 0],
                [cd, 0],
                [cd, frontTopRel],
                [runClamped, frontTopRel],
                [0, kneeRel],
              ]
            : [
                [0, 0],
                [cd, 0],
                [cd, frontTopRel],
                [0, kneeRel],
              ];
        comp.thicknessAxis = "x";
      }
      continue;
    }

    // C. Back panel
    if (role === "carcass_back") {
      if (secSide === "left" || secSide === "right") {
        const x0 = x;
        const x1 = x + cw;
        const secBackTopAtX = (xPos: number) => {
          const underSec =
            (secSide === "left" && xPos < secRunMm) || (secSide === "right" && xPos > W - secRunMm);
          return getSecCeilingYAtX(xPos) - (underSec ? secSlopedTopVertT : T) - 1;
        };
        const hL = Math.max(40, Math.min(ch, Math.floor(secBackTopAtX(x0) - y)));
        const hR = Math.max(40, Math.min(ch, Math.floor(secBackTopAtX(x1) - y)));
        if (hL < ch - 1 || hR < ch - 1) {
          const breakX = secSide === "left" ? secRunMm : W - secRunMm;
          comp.polygonContourMm =
            breakX > x0 + 6 && breakX < x1 - 6
              ? [
                  [0, 0],
                  [cw, 0],
                  [cw, hR],
                  [Math.round(breakX - x0), ch],
                  [0, hL],
                ]
              : [
                  [0, 0],
                  [cw, 0],
                  [cw, hR],
                  [0, hL],
                ];
          comp.thicknessAxis = "z";
        }
      } else {
        const backZ = Math.max(0, z);
        const ceilAtBackZ = getSecCeilingYAtZ(backZ);
        const newH = Math.max(80, Math.min(ch, Math.floor(ceilAtBackZ - secSlopedTopVertT - y)));
        if (newH < ch - 1) {
          comp.dimensions = { ...comp.dimensions, height: newH };
        }
      }
      continue;
    }

    // D. Doors & drawer fronts (clip front face against secondary lateral slope)
    if (
      (secSide === "left" || secSide === "right") &&
      (role === "door_left" ||
        role === "door_right" ||
        role === "door_sliding" ||
        role === "drawer_front")
    ) {
      const x0 = x;
      const x1 = x + cw;
      const hL = Math.max(40, Math.min(ch, Math.floor(getSecCeilingYAtX(x0) - 2 - y)));
      const hR = Math.max(40, Math.min(ch, Math.floor(getSecCeilingYAtX(x1) - 2 - y)));
      if (hL < ch - 1 || hR < ch - 1) {
        const breakX = secSide === "left" ? secRunMm : W - secRunMm;
        comp.polygonContourMm =
          breakX > x0 + 6 && breakX < x1 - 6
            ? [
                [0, 0],
                [cw, 0],
                [cw, hR],
                [Math.round(breakX - x0), ch],
                [0, hL],
              ]
            : [
                [0, 0],
                [cw, 0],
                [cw, hR],
                [0, hL],
              ];
        comp.thicknessAxis = "z";
      }
      continue;
    }

    // E. Shelves & hardware under secondary slope
    if (role === "shelf" && (secSide === "left" || secSide === "right")) {
      const shelfTopY = y + ch;
      if (shelfTopY > secKneeH - T) {
        const frac = Math.min(1, Math.max(0, (shelfTopY - (secKneeH - T)) / Math.max(1, secRise)));
        if (secSide === "left") {
          const cutX = frac * secRunMm + T;
          if (cutX >= x + cw - 60) {
            secRemove.add(i);
          } else if (cutX > x + 2) {
            const delta = Math.round(cutX - x);
            comp.position = { ...comp.position, x: x + delta };
            comp.dimensions = { ...comp.dimensions, width: Math.max(40, cw - delta) };
          }
        } else {
          const maxRightX = W - frac * secRunMm - T;
          if (maxRightX <= x + 60) {
            secRemove.add(i);
          } else if (maxRightX < x + cw - 2) {
            comp.dimensions = { ...comp.dimensions, width: Math.max(40, Math.round(maxRightX - x)) };
          }
        }
      }
      continue;
    }

    if (comp.isManufacturablePanel === false && (secSide === "left" || secSide === "right")) {
      const yL = getSecCeilingYAtX(x);
      const yR = getSecCeilingYAtX(x + cw);
      const ceilUnder = Math.min(yL, yR) - secSlopedTopVertT;
      if (role === "hanging_rail" || comp.id.includes("_rail")) {
        const safeTopY = ceilUnder - 30;
        if (y + ch > safeTopY) {
          const nextY = Math.round(safeTopY - ch);
          const minUsableRailY = (module.carcass.plinthHeight || 0) + T + 420;
          if (nextY < minUsableRailY) secRemove.add(i);
          else comp.position = { ...comp.position, y: nextY };
        }
      } else if (y + ch > ceilUnder + 2) {
        secRemove.add(i);
      }
    }
  }

  const sortedSecRemove = Array.from(secRemove).sort((a, b) => b - a);
  for (const idx of sortedSecRemove) {
    components.splice(idx, 1);
  }
  if (secTopPanelsToAdd.length > 0) {
    components.push(...secTopPanelsToAdd);
  }
}
