import { componentBounds } from "./component-transform";
import { UnitLength } from "@birim/core";
import { ComponentGeometry, ModuleGeometryBreakdown } from "./types";

type Bounds3D = ReturnType<typeof componentBounds>;

const projectionCacheByComponents = new WeakMap<
  ComponentGeometry[],
  Map<string, Elevation2DData>
>();

function getCachedProjection(
  components: ComponentGeometry[],
  cacheKey: string,
  compute: () => Elevation2DData
): Elevation2DData {
  let subMap = projectionCacheByComponents.get(components);
  if (subMap) {
    const hit = subMap.get(cacheKey);
    if (hit) return hit;
  } else {
    subMap = new Map<string, Elevation2DData>();
    projectionCacheByComponents.set(components, subMap);
  }
  const computed = compute();
  if (subMap.size >= 24) {
    const oldest = subMap.keys().next().value;
    if (oldest !== undefined) subMap.delete(oldest);
  }
  subMap.set(cacheKey, computed);
  return computed;
}

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
  return getCachedProjection(
    breakdown.components,
    `elev|${selectedComponentId || ""}`,
    () => {
      const { overall, components, bayWidths } = breakdown;
      const padding = 150;

      const hasFrontPlinth = components.some((c) => c.id.includes("_plinth_front"));
      const keptWithBounds: { c: ComponentGeometry; bounds: Bounds3D; sortZ: number }[] = [];
      for (let i = 0; i < components.length; i++) {
        const c = components[i];
        if (c.role === "carcass_back" || c.role === "hanging_rail" || c.id.includes("_sub_")) {
          continue;
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
          continue;
        }
        // Only show front-row legs as ISO hidden dashed contours (avoid duplicate rear-row overlap at same X!)
        if (c.id.includes("_plastic_leg_") && c.position.z < 70) {
          continue;
        }
        const bounds = componentBounds(c);
        const sortZ =
          bounds.max.z + (c.role.includes("handle") || c.role === "gola_profile" ? 500 : 0);
        keptWithBounds.push({ c, bounds, sortZ });
      }
      keptWithBounds.sort((a, b) => a.sortZ - b.sortZ);

      const elements: Rect2D[] = keptWithBounds.map(({ c, bounds }) => {
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

      const panelThickness =
        components.find((c) => c.role === "carcass_side_left")?.dimensions.width ?? 0;
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
  );
}

export function generateTopPlan2D(
  breakdown: ModuleGeometryBreakdown,
  selectedComponentId?: string
): Elevation2DData {
  return getCachedProjection(
    breakdown.components,
    `plan|${selectedComponentId || ""}`,
    () => {
      const { overall, components } = breakdown;
      const padding = 160;

      const elements: Rect2D[] = components
        .filter(
          (c) =>
            c.role.startsWith("carcass") ||
            c.role === "countertop" ||
            c.role.startsWith("door") ||
            c.role === "drawer_front" ||
            c.role === "shelf" ||
            c.role === "hanging_rail" ||
            c.role === "special_fitting"
        )
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
  );
}

/**
 * Generates Cross-section 2D view (Düşey Kesit Çizimi) slicing through Depth x Height
 */
export function generateCrossSection2D(
  breakdown: ModuleGeometryBreakdown,
  selectedComponentId?: string,
  options?: { direction?: "Z" | "X"; cutCoordMm?: number }
): Elevation2DData {
  const dir = options?.direction || "Z";
  const cutCoordKey = typeof options?.cutCoordMm === "number" ? String(Math.round(options.cutCoordMm)) : "auto";
  return getCachedProjection(
    breakdown.components,
    `sec|${selectedComponentId || ""}|${dir}|${cutCoordKey}`,
    () => {
      const { overall, components } = breakdown;
      const padding = 120;

      // Direction "X": B-B Longitudinal Cross-Section (Boyuna Kesit at Depth Z = cutCoordMm, projecting Width X vs Height Y)
      if (dir === "X") {
        const cutZ =
          typeof options?.cutCoordMm === "number"
            ? Math.max(0, Math.min(overall.depth, options.cutCoordMm))
            : Math.round(overall.depth * 0.5);

        const keptX: { c: ComponentGeometry; bounds: Bounds3D }[] = [];
        for (let i = 0; i < components.length; i++) {
          const c = components[i];
          if (
            c.role === "door_left" ||
            c.role === "door_right" ||
            c.role === "door_sliding" ||
            c.role === "door_lift" ||
            c.role === "door_handle" ||
            c.role === "drawer_handle" ||
            c.role === "drawer_front"
          ) {
            if (cutZ >= overall.depth - 36) {
              keptX.push({ c, bounds: componentBounds(c) });
            }
            continue;
          }
          const b = componentBounds(c);
          if (c.role === "drawer_back") {
            if (b.min.z <= cutZ + 45) keptX.push({ c, bounds: b });
            continue;
          }
          if (
            c.role.startsWith("carcass_") ||
            c.role === "plinth" ||
            c.role === "countertop" ||
            c.role === "sub_divider" ||
            (b.min.z <= cutZ + 45 && b.max.z >= cutZ - 45)
          ) {
            keptX.push({ c, bounds: b });
          }
        }
        const orderX = (r: string) =>
          r === "carcass_back"
            ? 0
            : r === "drawer_back"
            ? 1
            : r.startsWith("drawer_side")
            ? 2
            : r === "drawer_bottom"
            ? 4
            : 3;
        keptX.sort((a, b) => orderX(a.c.role) - orderX(b.c.role));

        const elements: Rect2D[] = keptX.map(({ c, bounds }) => ({
          id: c.id,
          label: c.label,
          x: bounds.min.x,
          y: overall.height - bounds.max.y,
          width: Math.max(4, bounds.max.x - bounds.min.x),
          height: Math.max(4, bounds.max.y - bounds.min.y),
          role: c.role,
          isSelected: c.id === selectedComponentId,
        }));

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

      const boundsCache = new Map<ComponentGeometry, Bounds3D>();
      const getBoundsCached = (c: ComponentGeometry): Bounds3D => {
        let b = boundsCache.get(c);
        if (!b) {
          b = componentBounds(c);
          boundsCache.set(c, b);
        }
        return b;
      };

      let drawerSliceByBay: Map<number, boolean> | null = null;
      if (typeof cutX === "number") {
        drawerSliceByBay = new Map<number, boolean>();
        for (let i = 0; i < components.length; i++) {
          const dc = components[i];
          if (
            typeof dc.bayIndex === "number" &&
            (dc.role === "drawer_bottom" || dc.role === "drawer_front")
          ) {
            const db = getBoundsCached(dc);
            const prev = drawerSliceByBay.get(dc.bayIndex) || false;
            drawerSliceByBay.set(dc.bayIndex, prev || (cutX >= db.min.x - 24 && cutX <= db.max.x + 24));
          }
        }
      }

      const keptZ: ComponentGeometry[] = [];
      for (let i = 0; i < components.length; i++) {
        const c = components[i];
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
        if (!isAllowedRole) continue;
        if (
          c.id.includes("_plinth_side_") ||
          c.id.includes("_plinth_rib_") ||
          c.id.includes("_plinth_seal_left") ||
          c.id.includes("_plinth_seal_right")
        ) {
          continue;
        }
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
          if (
            (c.role === "drawer_side_left" || c.role === "drawer_slide") &&
            typeof c.bayIndex === "number" &&
            drawerSliceByBay?.has(c.bayIndex)
          ) {
            if (drawerSliceByBay.get(c.bayIndex)) keptZ.push(c);
            continue;
          }
          const b = getBoundsCached(c);
          if (cutX >= b.min.x - 24 && cutX <= b.max.x + 24) {
            keptZ.push(c);
          }
          continue;
        }
        keptZ.push(c);
      }

      const zLayer = (r: string) =>
        r === "drawer_side_left" || r === "drawer_slide"
          ? 0
          : r === "carcass_divider"
          ? 1
          : r === "drawer_back" || r === "drawer_front"
          ? 3
          : r === "drawer_bottom" || r === "carcass_back"
          ? 5
          : r === "door_hinge" || r === "special_fitting"
          ? 6
          : 2;
      keptZ.sort((a, b) => zLayer(a.role) - zLayer(b.role));

      const elements: Rect2D[] = keptZ.map((c) => {
        const bounds = getBoundsCached(c);
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
  );
}
