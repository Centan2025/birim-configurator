import { componentBounds } from "./component-transform";
import { UnitLength } from "@birim/core";
import { ModuleGeometryBreakdown } from "./types";

export interface Rect2D {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  role: string;
  color?: string;
  isSelected?: boolean;
}

export interface DimensionLine2D {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  value: UnitLength;
  label: string;
  orientation: "horizontal" | "vertical";
  offset: number;
}

export interface Elevation2DData {
  viewBox: { x: number; y: number; width: number; height: number };
  elements: Rect2D[];
  dimensionLines: DimensionLine2D[];
  bayLines: { x: number; y1: number; y2: number; label: string }[];
}

function computeExpandedViewBox(
  baseWidth: number,
  baseHeight: number,
  elements: Rect2D[],
  padding: number
): { x: number; y: number; width: number; height: number } {
  let minX = 0;
  let minY = 0;
  let maxX = baseWidth;
  let maxY = baseHeight;
  for (const el of elements) {
    if (el.x < minX) minX = el.x;
    if (el.y < minY) minY = el.y;
    if (el.x + el.width > maxX) maxX = el.x + el.width;
    if (el.y + el.height > maxY) maxY = el.y + el.height;
  }
  return {
    x: minX - padding,
    y: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  };
}

export function generateElevation2D(
  breakdown: ModuleGeometryBreakdown,
  selectedComponentId?: string
): Elevation2DData {
  const { overall, components, bayWidths } = breakdown;
  const padding = 150;

  const hasFrontPlinth = components.some((c) => c.id.includes("_plinth_front"));
  const elements: Rect2D[] = components
    .filter((c) => {
      if (c.role === "carcass_back" || c.role === "hanging_rail" || c.id.includes("_sub_")) {
        return false;
      }
      // Hide rear/internal plinth stretchers, clips, side seals & rear-row legs in 2D Front Elevation so _plinth_front is crisp!
      if (
        c.id.includes("_plinth_rear") ||
        c.id.includes("_plinth_rib_") ||
        c.id.includes("_plinth_side_") ||
        c.id.includes("_plinth_clip_") ||
        c.id.includes("_plinth_glide_") ||
        c.id.includes("_plinth_seal_left") ||
        c.id.includes("_plinth_seal_right")
      ) {
        return false;
      }
      // Only show front-row legs as ISO hidden dashed contours (avoid duplicate rear-row overlap at same X!)
      if (c.id.includes("_plastic_leg_") && c.position.z < 70) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      // Paint back-to-front by max Z so door_handle & drawer_handle ALWAYS sit on top of drawer_front & door panels!
      const za = componentBounds(a).max.z + (a.role.includes("handle") || a.role === "gola_profile" ? 500 : 0);
      const zb = componentBounds(b).max.z + (b.role.includes("handle") || b.role === "gola_profile" ? 500 : 0);
      return za - zb;
    })
    .map((c) => {
      const bounds = componentBounds(c);
      const isHiddenLegBehindPlinth = hasFrontPlinth && c.id.includes("_plastic_leg_");
      const isPlinthSeal = c.id.includes("_plinth_seal_");
      return {
        id: c.id,
        label: c.label,
        x: bounds.min.x,
        y: overall.height - bounds.max.y,
        width: bounds.max.x - bounds.min.x,
        height: bounds.max.y - bounds.min.y,
        role: isHiddenLegBehindPlinth
          ? "plinth_leg_hidden"
          : isPlinthSeal
          ? "plinth_seal"
          : c.role,
        isSelected: c.id === selectedComponentId,
      };
    });

  const dimensionLines: DimensionLine2D[] = [
    {
      id: "dim_total_width",
      x1: 0,
      y1: -40,
      x2: overall.width,
      y2: -40,
      value: overall.width,
      label: `${overall.width} mm`,
      orientation: "horizontal",
      offset: -40,
    },
    {
      id: "dim_total_height",
      x1: -50,
      y1: overall.height,
      x2: -50,
      y2: 0,
      value: overall.height,
      label: `${overall.height} mm`,
      orientation: "vertical",
      offset: -50,
    },
  ];

  const panelThickness = components.find((c) => c.role === "carcass_side_left")?.dimensions.width ?? 0;
  let currentX = panelThickness;
  bayWidths.forEach((bw, i) => {
    dimensionLines.push({
      id: `dim_bay_${i}`,
      x1: currentX,
      y1: overall.height + 40,
      x2: currentX + bw,
      y2: overall.height + 40,
      value: bw,
      label: `B${i + 1}: ${bw} mm`,
      orientation: "horizontal",
      offset: 40,
    });
    currentX += bw + panelThickness;
  });

  return {
    viewBox: computeExpandedViewBox(overall.width, overall.height, elements, padding),
    elements,
    dimensionLines,
    bayLines: [],
  };
}

export function generateTopPlan2D(
  breakdown: ModuleGeometryBreakdown,
  selectedComponentId?: string
): Elevation2DData {
  const { overall, components } = breakdown;
  const padding = 160;

  const elements: Rect2D[] = components
    .filter((c) => c.role.startsWith("carcass") || c.role.startsWith("door") || c.role === "drawer_front" || c.role === "shelf" || c.role === "hanging_rail" || c.role === "special_fitting")
    .map((c) => {
      const bounds = componentBounds(c);
      return {
        id: c.id,
        label: c.label,
        x: bounds.min.x,
        y: bounds.min.z,
        width: bounds.max.x - bounds.min.x,
        height: bounds.max.z - bounds.min.z,
        role: c.role,
        isSelected: c.id === selectedComponentId,
      };
    });

  const dimensionLines: DimensionLine2D[] = [
    {
      id: "dim_plan_width",
      x1: 0,
      y1: -45,
      x2: overall.width,
      y2: -45,
      value: overall.width,
      label: `Genişlik: ${overall.width} mm`,
      orientation: "horizontal",
      offset: -45,
    },
    {
      id: "dim_plan_depth",
      x1: -55,
      y1: 0,
      x2: -55,
      y2: overall.depth,
      value: overall.depth,
      label: `Derinlik: ${overall.depth} mm`,
      orientation: "vertical",
      offset: -55,
    },
  ];

  return {
    viewBox: computeExpandedViewBox(overall.width, overall.depth, elements, padding),
    elements,
    dimensionLines,
    bayLines: [],
  };
}

/**
 * Generates Cross-section 2D view (Düşey Kesit Çizimi) slicing through Depth x Height
 */
export function generateCrossSection2D(
  breakdown: ModuleGeometryBreakdown,
  selectedComponentId?: string,
  options?: { direction?: "Z" | "X"; cutCoordMm?: number }
): Elevation2DData {
  const { overall, components } = breakdown;
  const padding = 120;
  const dir = options?.direction || "Z";

  // Direction "X": B-B Longitudinal Cross-Section (Boyuna Kesit at Depth Z = cutCoordMm, projecting Width X vs Height Y)
  if (dir === "X") {
    const cutZ =
      typeof options?.cutCoordMm === "number"
        ? Math.max(0, Math.min(overall.depth, options.cutCoordMm))
        : Math.round(overall.depth * 0.5);

    const elements: Rect2D[] = components
      .filter((c) => {
        if (
          c.role === "door_left" ||
          c.role === "door_right" ||
          c.role === "door_sliding" ||
          c.role === "door_lift" ||
          c.role === "door_handle" ||
          c.role === "drawer_handle" ||
          c.role === "drawer_front"
        ) {
          return cutZ >= overall.depth - 36;
        }
        const b = componentBounds(c);
        // In B-B Longitudinal Section (looking rearward toward Z=0), drawer_back sits behind the cutZ plane
        // in front of carcass_back and MUST remain visible inside the sliced drawer box!
        if (c.role === "drawer_back") {
          return b.min.z <= cutZ + 45;
        }
        return (
          c.role.startsWith("carcass_") ||
          c.role === "plinth" ||
          c.role === "countertop" ||
          c.role === "sub_divider" ||
          (b.min.z <= cutZ + 45 && b.max.z >= cutZ - 45)
        );
      })
      .sort((a, b) => {
        const order = (r: string) =>
          r === "carcass_back" ? 0 : r === "drawer_back" ? 1 : r.startsWith("drawer_side") ? 2 : 3;
        return order(a.role) - order(b.role);
      })
      .map((c) => {
        const bounds = componentBounds(c);
        return {
          id: c.id,
          label: c.label,
          x: bounds.min.x,
          y: overall.height - bounds.max.y,
          width: Math.max(4, bounds.max.x - bounds.min.x),
          height: Math.max(4, bounds.max.y - bounds.min.y),
          role: c.role,
          isSelected: c.id === selectedComponentId,
        };
      });

    const dimensionLines: DimensionLine2D[] = [
      {
        id: "dim_sec_width_x",
        x1: 0,
        y1: -30,
        x2: overall.width,
        y2: -30,
        value: overall.width,
        label: `B-B Boyuna Kesit Genişlik: ${overall.width} mm (Derinlik Z: ${cutZ} mm)`,
        orientation: "horizontal",
        offset: -30,
      },
      {
        id: "dim_sec_height_x",
        x1: -40,
        y1: overall.height,
        x2: -40,
        y2: 0,
        value: overall.height,
        label: `Yükseklik: ${overall.height} mm`,
        orientation: "vertical",
        offset: -40,
      },
    ];

    return {
      viewBox: computeExpandedViewBox(overall.width, overall.height, elements, padding),
      elements,
      dimensionLines,
      bayLines: [],
    };
  }

  // Direction "Z": A-A Transverse Side Cross-Section (Enine Yan Kesit at Width X = cutCoordMm, projecting Depth Z vs Height Y)
  const cutX =
    typeof options?.cutCoordMm === "number"
      ? Math.max(0, Math.min(overall.width, options.cutCoordMm))
      : undefined;

  // Filter components visible in depth cross-section at cutX
  const elements: Rect2D[] = components
    .filter((c) => {
      const isAllowedRole =
        c.role === "carcass_bottom" ||
        c.role === "carcass_top" ||
        c.role === "plinth" ||
        c.role === "countertop" ||
        c.role === "shelf" ||
        c.role === "sub_divider" ||
        c.role === "carcass_divider" ||
        c.role === "hanging_rail" ||
        c.role === "drawer_box" ||
        c.role === "drawer_side_left" ||
        c.role === "drawer_slide" ||
        c.role === "drawer_back" ||
        c.role === "drawer_bottom" ||
        c.role === "drawer_front" ||
        c.role === "door_left" ||
        c.role === "door_right" ||
        c.role === "door_hinge" ||
        c.role === "special_fitting" ||
        c.role === "carcass_back";
      if (!isAllowedRole) return false;
      // In A-A Transverse Side Section, exclude left/right side plinths & ribs spanning full Z so recessed front/rear rails & seal profile show cleanly!
      if (
        c.id.includes("_plinth_side_") ||
        c.id.includes("_plinth_rib_") ||
        c.id.includes("_plinth_seal_left") ||
        c.id.includes("_plinth_seal_right")
      ) {
        return false;
      }
      // Always show one representative pair of front/rear plinth legs & clip in Side Section so toe-kick engineering is visible!
      const isRepPlinthHardware =
        c.id.endsWith("_plastic_leg_1") ||
        c.id.endsWith("_plastic_leg_2") ||
        c.id.endsWith("_plinth_clip_2") ||
        c.id.includes("_plinth_seal_front");
      if (
        !isRepPlinthHardware &&
        typeof cutX === "number" &&
        (c.role === "shelf" ||
          c.role === "sub_divider" ||
          c.role === "carcass_divider" ||
          c.role === "hanging_rail" ||
          c.role.startsWith("drawer_") ||
          c.role.startsWith("door_") ||
          c.role === "special_fitting")
      ) {
        if (c.role === "drawer_side_left" || c.role === "drawer_slide") {
          // Include the side wall & runner of the bay currently sliced by cutX as background elevation!
          if (typeof c.bayIndex === "number") {
            const bayDrawers = components.filter(
              (dc) => dc.bayIndex === c.bayIndex && (dc.role === "drawer_bottom" || dc.role === "drawer_front")
            );
            if (bayDrawers.length > 0) {
              return bayDrawers.some((dc) => {
                const db = componentBounds(dc);
                return cutX >= db.min.x - 24 && cutX <= db.max.x + 24;
              });
            }
          }
        }
        const b = componentBounds(c);
        return cutX >= b.min.x - 24 && cutX <= b.max.x + 24;
      }
      return true;
    })
    .sort((a, b) => {
      // Draw background elevation elements first so sliced cross-section boards (`drawer_back`, `drawer_bottom`, `drawer_front`) sit cleanly ON TOP!
      const zLayer = (r: string) =>
        r === "drawer_side_left" || r === "drawer_slide"
          ? 0
          : r === "carcass_divider"
          ? 1
          : r === "drawer_bottom"
          ? 3
          : r === "drawer_back" || r === "drawer_front"
          ? 4
          : 2;
      return zLayer(a.role) - zLayer(b.role);
    })
    .map((c) => {
      const bounds = componentBounds(c);
      return {
        id: c.id,
        label: c.label,
        x: bounds.min.z,
        y: overall.height - bounds.max.y,
        width: Math.max(4, bounds.max.z - bounds.min.z),
        height: Math.max(4, bounds.max.y - bounds.min.y),
        role: c.role,
        isSelected: c.id === selectedComponentId,
      };
    });

  const dimensionLines: DimensionLine2D[] = [
    {
      id: "dim_sec_depth",
      x1: 0,
      y1: -30,
      x2: overall.depth,
      y2: -30,
      value: overall.depth,
      label: `Net Derinlik: ${overall.depth} mm`,
      orientation: "horizontal",
      offset: -30,
    },
    {
      id: "dim_sec_height",
      x1: -40,
      y1: overall.height,
      x2: -40,
      y2: 0,
      value: overall.height,
      label: `Net Yükseklik: ${overall.height} mm`,
      orientation: "vertical",
      offset: -40,
    },
  ];

  return {
    viewBox: computeExpandedViewBox(overall.depth, overall.height, elements, padding),
    elements,
    dimensionLines,
    bayLines: [],
  };
}
