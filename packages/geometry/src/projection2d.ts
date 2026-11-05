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

  const elements: Rect2D[] = components
    .filter((c) => c.role !== "carcass_back" && c.role !== "hanging_rail" && !c.id.includes("_sub_"))
    .map((c) => {
      const bounds = componentBounds(c);
      return {
        id: c.id,
        label: c.label,
        x: bounds.min.x,
        y: overall.height - bounds.max.y,
        width: bounds.max.x - bounds.min.x,
        height: bounds.max.y - bounds.min.y,
        role: c.role,
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
    .filter((c) => c.role.startsWith("carcass") || c.role.startsWith("door") || c.role === "drawer_front")
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
  selectedComponentId?: string
): Elevation2DData {
  const { overall, components } = breakdown;
  const padding = 120;

  // Filter components visible in depth cross-section (bottom, top, plinth, shelves, drawer boxes, doors)
  const elements: Rect2D[] = components
    .filter(
      (c) =>
        c.role === "carcass_bottom" ||
        c.role === "carcass_top" ||
        c.role === "plinth" ||
        c.role === "shelf" ||
        c.role === "drawer_box" ||
        c.role === "drawer_side_left" ||
        c.role === "drawer_bottom" ||
        c.role === "drawer_front" ||
        c.role === "door_left" ||
        c.role === "door_right" ||
        c.role === "door_hinge" ||
        c.role === "special_fitting" ||
        c.role === "carcass_back"
    )
    .map((c) => {
      const bounds = componentBounds(c);
      return {
        id: c.id,
        label: c.label,
        x: bounds.min.z,
        y: overall.height - bounds.max.y,
        width: bounds.max.z - bounds.min.z,
        height: bounds.max.y - bounds.min.y,
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
