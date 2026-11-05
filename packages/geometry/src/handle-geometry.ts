import { HandleCategory, ModuleCategory } from "@birim/core";
import { ComponentGeometry } from "./types";

export interface HandlePlacementContext {
  moduleCategory?: ModuleCategory;
  moduleElevationY?: number;
  moduleHeight?: number;
}

/** Representative visual geometry only. No mounting/machining dimensions are certified. */
export function generateHandleGeometry(
  front: ComponentGeometry,
  category: HandleCategory,
  context?: HandlePlacementContext
): ComponentGeometry[] {
  if (category === "handleless_plain") return [];
  const drawer = front.role === "drawer_front";
  const isWallOrHighFront =
    !drawer &&
    (context?.moduleCategory === "kitchen_wall" ||
      (context?.moduleElevationY ?? 0) >= 1100 ||
      front.position.y >= 1100);
  const isTallOrWardrobeFront =
    !drawer &&
    !isWallOrHighFront &&
    (context?.moduleCategory === "wardrobe" ||
      context?.moduleCategory === "wardrobe_walkin" ||
      context?.moduleCategory === "wardrobe_corner" ||
      context?.moduleCategory === "kitchen_tall" ||
      context?.moduleCategory === "special_corner" ||
      front.dimensions.height >= 1200);

  // Top/bottom edge-mounted profiles (edge_profile, j_pull, gola_profile) are horizontal only on drawers, base doors, or wall doors;
  // on tall/wardrobe doors (>= 1200mm), putting a J-pull or edge profile at the top edge (~2200mm) is unreachable, so it mounts vertically along the opening stile.
  const isTopBottomEdgeProfile =
    category === "edge_profile" || category === "j_pull" || category === "gola_profile";
  const horizontal = drawer || (isTopBottomEdgeProfile && !isTallOrWardrobeFront);

  // Clamp handle span strictly inside the front face with safe margins
  const maxAllowedSpan = Math.max(
    24,
    (horizontal ? front.dimensions.width : front.dimensions.height) - (drawer ? 48 : 40)
  );
  const targetSpan =
    category === "long_profile_handle"
      ? drawer
        ? Math.min(600, Math.round(front.dimensions.width * 0.72))
        : 1000
      : category === "decorative_bespoke"
      ? 152
      : drawer
      ? Math.min(184, Math.round(front.dimensions.width * 0.6))
      : 184;
  const span = Math.min(targetSpan, maxAllowedSpan);

  const openingSideX =
    front.role === "door_right"
      ? Math.min(45, front.dimensions.width / 2)
      : Math.max(front.dimensions.width / 2, front.dimensions.width - 45);
  const cx = horizontal ? front.dimensions.width / 2 : openingSideX;

  // Ergonomic vertical placement:
  // - Drawers: centered vertically when front height <= 260mm (so handles never overflow top edge), or upper ergonomic zone for deep drawers
  // - Wall / upper cabinets: near bottom edge so user can reach from below
  // - Tall / wardrobe doors: ergonomic waist/chest height (~1000mm from module bottom)
  // - Base cabinets: near top edge
  const ergonomicTallCy = Math.max(
    120,
    Math.min(front.dimensions.height - 180, 1020 - front.position.y)
  );
  const cy = drawer
    ? front.dimensions.height <= 260
      ? front.dimensions.height / 2
      : Math.max(front.dimensions.height / 2, front.dimensions.height - 36)
    : isWallOrHighFront
    ? Math.min(front.dimensions.height / 2, 36)
    : isTallOrWardrobeFront
    ? ergonomicTallCy
    : horizontal
    ? front.dimensions.height - 18
    : Math.max(front.dimensions.height / 2, front.dimensions.height - Math.max(60, span / 2 + 25));

  const z = front.dimensions.depth;
  const parts: ComponentGeometry[] = [];
  const add = (
    name: string,
    x: number,
    y: number,
    dz: number,
    w: number,
    h: number,
    d: number,
    primitive: ComponentGeometry["primitive"] = "box"
  ) => {
    const fixed = category === "gola_profile";
    parts.push({
      id: `${front.id}_handle_${name}`,
      role: fixed ? "gola_profile" : drawer ? "drawer_handle" : "door_handle",
      label: `${category} (${name}, temsili)`,
      bayIndex: front.bayIndex,
      dimensions: { width: w, height: h, depth: d },
      position: {
        x: front.position.x + x - w / 2,
        y: front.position.y + y - h / 2,
        z: front.position.z + dz,
      },
      rotation: fixed ? undefined : front.rotation,
      pivot: fixed ? undefined : front.pivot,
      primitive,
      parentComponentId: front.id,
      handleCategory: category,
      materialId:
        category === "milled_wood_grip" || category === "j_pull"
          ? front.materialId
          : "mat_anodized_metal",
      isFrontFacing: true,
      isManufacturablePanel: false,
    });
  };
  if (category === "knob") {
    add("stem", cx, cy, z, 12, 12, 15, "cylinder");
    add("knob", cx, cy, z + 12, 32, 32, 18, "sphere");
  } else if (
    category === "bar_handle" ||
    category === "long_profile_handle" ||
    category === "decorative_bespoke" ||
    category === "milled_wood_grip"
  ) {
    for (const sign of [-1, 1]) {
      add(
        `mount_${sign}`,
        cx + (horizontal ? (sign * (span - 24)) / 2 : 0),
        cy + (horizontal ? 0 : (sign * (span - 24)) / 2),
        z,
        12,
        12,
        22,
        "cylinder"
      );
    }
    add(
      "grip",
      cx,
      cy,
      z + 18,
      horizontal ? span : category === "milled_wood_grip" ? 24 : 12,
      horizontal ? (category === "milled_wood_grip" ? 24 : 12) : span,
      category === "milled_wood_grip" ? 20 : 12,
      category === "decorative_bespoke" ? "sphere" : "box"
    );
    if (category === "decorative_bespoke") {
      for (const sign of [-1, 1]) {
        add(
          `rosette_${sign}`,
          cx + (horizontal ? (sign * (span - 24)) / 2 : 0),
          cy + (horizontal ? 0 : (sign * (span - 24)) / 2),
          z,
          24,
          24,
          4,
          "sphere"
        );
      }
    }
  } else if (category === "recessed_grip") {
    // Fit recessed grip strictly inside the front panel height/width (never overflow shallow drawer fronts)
    const rimW = horizontal
      ? Math.min(110, Math.max(36, front.dimensions.width - 36))
      : 30;
    const rimH = horizontal
      ? Math.min(34, Math.max(18, front.dimensions.height - 20))
      : Math.min(110, Math.max(40, front.dimensions.height - 36));
    const halfW = rimW / 2 - 2;
    const halfH = rimH / 2 - 2;
    add("rim_left", cx - halfW, cy, z, 4, rimH, 2);
    add("rim_right", cx + halfW, cy, z, 4, rimH, 2);
    add("rim_top", cx, cy + halfH, z, rimW - 4, 4, 2);
    add("rim_bottom", cx, cy - halfH, z, rimW - 4, 4, 2);
  } else {
    const w = Math.max(20, front.dimensions.width - 12);
    const top = front.dimensions.height;
    if (!horizontal) {
      // Tall / wardrobe door: vertical J-pull / Gola / Edge profile on the opening stile at ergonomic reach height
      const edgeX = front.role === "door_right" ? 6 : Math.max(6, front.dimensions.width - 6);
      const vSpan = Math.min(
        category === "gola_profile" ? front.dimensions.height - 20 : 320,
        Math.max(80, front.dimensions.height - 40)
      );
      const vCy = category === "gola_profile" ? front.dimensions.height / 2 : cy;
      if (category === "gola_profile") {
        add("channel_back", edgeX, vCy, -12, 24, vSpan, 3);
        add("channel_lip", edgeX, vCy, -12, 3, vSpan, 20);
      } else if (category === "j_pull") {
        add("rebate", edgeX, vCy, z, 10, vSpan, 2);
        add("lip", edgeX, vCy, z, 4, vSpan, 8);
      } else {
        add("flange", edgeX, vCy, z, 12, span, 3);
        add("lip", edgeX, vCy, z, 3, span, 20);
      }
    } else if (isWallOrHighFront) {
      // Wall cabinet: place J-pull / Gola / Edge profile at the BOTTOM edge (y ≈ 0..10), never at the unreachable top!
      if (category === "gola_profile") {
        add("channel_back", front.dimensions.width / 2, 14, -12, w, 28, 3);
        add("channel_lip", front.dimensions.width / 2, 2, -12, w, 3, 20);
      } else if (category === "j_pull") {
        add("rebate", front.dimensions.width / 2, 6, z, w, 10, 2);
        add("lip", front.dimensions.width / 2, 2, z, w, 4, 8);
      } else {
        add("flange", front.dimensions.width / 2, 6, z, span, 12, 3);
        add("lip", front.dimensions.width / 2, 2, z, span, 3, 18);
      }
    } else {
      // Base cabinet or drawer: place flush within the top edge (never protruding above `top`)
      if (category === "gola_profile") {
        add("channel_back", front.dimensions.width / 2, top - 14, -12, w, 28, 3);
        add("channel_lip", front.dimensions.width / 2, top - 2, -12, w, 3, 20);
      } else if (category === "j_pull") {
        add("rebate", front.dimensions.width / 2, top - 6, z, w, 10, 2);
        add("lip", front.dimensions.width / 2, top - 2, z, w, 4, 8);
      } else {
        add("flange", front.dimensions.width / 2, top - 6, z, span, 12, 3);
        add("lip", front.dimensions.width / 2, top - 2, z, span, 3, 18);
      }
    }
  }
  return parts;
}
