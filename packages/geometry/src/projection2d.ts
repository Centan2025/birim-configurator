import { UnitLength } from "@birim/core";
import { ModuleGeometryBreakdown, ComponentGeometry } from "./types";

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

export function generateElevation2D(
  breakdown: ModuleGeometryBreakdown,
  selectedComponentId?: string
): Elevation2DData {
  const { overall, components, bayWidths } = breakdown;
  const padding = 150;

  const elements: Rect2D[] = components
    .filter((c) => c.role !== "carcass_back" && c.role !== "hanging_rail")
    .map((c) => ({
      id: c.id,
      label: c.label,
      x: c.position.x,
      y: overall.height - (c.position.y + c.dimensions.height),
      width: c.dimensions.width,
      height: c.dimensions.height,
      role: c.role,
      isSelected: c.id === selectedComponentId,
    }));

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

  let currentX = 18;
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
    currentX += bw + 18;
  });

  return {
    viewBox: {
      x: -padding,
      y: -padding,
      width: overall.width + padding * 2,
      height: overall.height + padding * 2,
    },
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
  const padding = 120;

  const elements: Rect2D[] = components
    .filter((c) => c.role.startsWith("carcass") || c.role.startsWith("door"))
    .map((c) => ({
      id: c.id,
      label: c.label,
      x: c.position.x,
      y: c.position.z,
      width: c.dimensions.width,
      height: c.dimensions.depth,
      role: c.role,
      isSelected: c.id === selectedComponentId,
    }));

  const dimensionLines: DimensionLine2D[] = [
    {
      id: "dim_plan_width",
      x1: 0,
      y1: -30,
      x2: overall.width,
      y2: -30,
      value: overall.width,
      label: `Genişlik: ${overall.width} mm`,
      orientation: "horizontal",
      offset: -30,
    },
    {
      id: "dim_plan_depth",
      x1: -40,
      y1: 0,
      x2: -40,
      y2: overall.depth,
      value: overall.depth,
      label: `Derinlik: ${overall.depth} mm`,
      orientation: "vertical",
      offset: -40,
    },
  ];

  return {
    viewBox: {
      x: -padding,
      y: -padding,
      width: overall.width + padding * 2,
      height: overall.depth + padding * 2,
    },
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

  // Filter components visible in depth cross-section (bottom, top, plinth, shelves, drawer boxes)
  const elements: Rect2D[] = components
    .filter(
      (c) =>
        c.role === "carcass_bottom" ||
        c.role === "carcass_top" ||
        c.role === "plinth" ||
        c.role === "shelf" ||
        c.role === "drawer_box" ||
        c.role === "carcass_back"
    )
    .map((c) => ({
      id: c.id,
      label: c.label,
      x: c.position.z,
      y: overall.height - (c.position.y + c.dimensions.height),
      width: c.dimensions.depth,
      height: c.dimensions.height,
      role: c.role,
      isSelected: c.id === selectedComponentId,
    }));

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
    viewBox: {
      x: -padding,
      y: -padding,
      width: overall.depth + padding * 2,
      height: overall.height + padding * 2,
    },
    elements,
    dimensionLines,
    bayLines: [],
  };
}
