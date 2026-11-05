import { HandleCategory, ModuleCategory } from "@birim/core";
import { ComponentGeometry } from "./types";

export interface HandlePlacementContext {
  moduleCategory?: ModuleCategory;
  moduleElevationY?: number;
  moduleHeight?: number;
}

/** Representative visual geometry for all V4 handle & profile systems (Bar, Knob, Long Profile, Gola, J-Pull, Recessed Grip, Edge Profile). */
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

  // Top/bottom edge-mounted profiles (edge_profile, j_pull, gola_profile) are horizontal on drawers, base doors, or wall doors;
  // on tall/wardrobe doors (>= 1200mm), putting a J-pull or edge profile at the top edge (~2200mm) is unreachable, so it mounts vertically along the opening stile.
  const isLiftDoor =
    front.id.includes("lift_") || Boolean(front.rotation && Math.abs(front.rotation[0]) > 0.001);
  const isTopBottomEdgeProfile =
    category === "edge_profile" || category === "j_pull" || category === "gola_profile";
  const horizontal =
    drawer || isLiftDoor || (isTopBottomEdgeProfile && !isTallOrWardrobeFront);

  // Clamp handle span strictly inside the front face with safe margins
  const maxAllowedSpan = Math.max(
    24,
    (horizontal ? front.dimensions.width : front.dimensions.height) - (drawer ? 48 : 40)
  );
  const targetSpan =
    category === "long_profile_handle"
      ? drawer
        ? Math.min(600, Math.round(front.dimensions.width * 0.72))
        : Math.min(1100, Math.max(600, Math.round(front.dimensions.height * 0.58)))
      : category === "decorative_bespoke"
      ? 160
      : drawer
      ? Math.min(192, Math.round(front.dimensions.width * 0.6))
      : 192;
  const span = Math.min(targetSpan, maxAllowedSpan);

  const openingSideX =
    front.role === "door_right"
      ? Math.min(45, front.dimensions.width / 2)
      : Math.max(front.dimensions.width / 2, front.dimensions.width - 45);
  const cx = horizontal ? front.dimensions.width / 2 : openingSideX;

  // Ergonomic vertical placement:
  // - Drawers: centered vertically when front height <= 260mm (so handles never overflow top edge), or upper ergonomic zone for deep drawers
  // - Wall / upper cabinets: near bottom edge so user can reach from below
  // - Tall / wardrobe doors: ergonomic waist/chest height (~1020mm from module bottom)
  // - Base cabinets: near top edge
  const ergonomicTallCy = Math.max(
    120,
    Math.min(front.dimensions.height - 180, 1020 - front.position.y)
  );
  const wallVerticalCy =
    category === "knob"
      ? 48
      : Math.min(front.dimensions.height / 2, Math.max(70, Math.round(span / 2 + 45)));

  const cy = drawer
    ? front.dimensions.height <= 260
      ? front.dimensions.height / 2
      : Math.max(front.dimensions.height / 2, front.dimensions.height - 36)
    : isWallOrHighFront
    ? horizontal
      ? Math.min(front.dimensions.height / 2, 38)
      : wallVerticalCy
    : isTallOrWardrobeFront
    ? ergonomicTallCy
    : horizontal
    ? front.dimensions.height - 18
    : Math.max(
        front.dimensions.height / 2,
        front.dimensions.height - Math.max(60, Math.round(span / 2 + 32))
      );

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
    primitive: ComponentGeometry["primitive"] = "box",
    customMatId?: string
  ) => {
    const fixed = category === "gola_profile";
    parts.push({
      id: `${front.id}_handle_${name}`,
      role: fixed ? "gola_profile" : drawer ? "drawer_handle" : "door_handle",
      label: `${category} (${name})`,
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
        customMatId ||
        (category === "milled_wood_grip" || category === "j_pull"
          ? front.materialId
          : "mat_anodized_metal"),
      isFrontFacing: true,
      isManufacturablePanel: false,
    });
  };

  if (category === "knob") {
    add("stem", cx, cy, z, 12, 12, 16, "cylinder");
    add("knob", cx, cy, z + 12, 34, 34, 20, "sphere");
  } else if (
    category === "bar_handle" ||
    category === "long_profile_handle" ||
    category === "decorative_bespoke"
  ) {
    for (const sign of [-1, 1]) {
      add(
        `mount_${sign}`,
        cx + (horizontal ? (sign * (span - 24)) / 2 : 0),
        cy + (horizontal ? 0 : (sign * (span - 24)) / 2),
        z,
        12,
        12,
        24,
        "cylinder"
      );
    }
    add(
      "grip",
      cx,
      cy,
      z + 20,
      horizontal ? span : 14,
      horizontal ? 14 : span,
      16,
      category === "decorative_bespoke" ? "sphere" : "box"
    );
  } else if (category === "recessed_grip" || category === "milled_wood_grip") {
    // 3D Recessed Finger Pocket Cutout (Gömme Kulp / Ahşap Oyma Kulp Yuvası)
    const pocketW = horizontal
      ? Math.min(136, Math.max(48, front.dimensions.width - 36))
      : 38;
    const pocketH = horizontal
      ? Math.min(38, Math.max(22, front.dimensions.height - 20))
      : Math.min(148, Math.max(52, front.dimensions.height - 36));
    add("recessed_pocket", cx, cy, z - 2, pocketW, pocketH, 10);
  } else {
    // Edge-mounted detail systems: Gola Channel (gola_profile), J-Pull Cutout (j_pull), Top/Side Aluminum Edge Profile (edge_profile)
    const fullW = Math.max(24, front.dimensions.width - 2);
    const top = front.dimensions.height;
    if (!horizontal) {
      // Tall / wardrobe door: vertical Gola / J-Pull / Edge profile along the opening stile
      const isRightDoor = front.role === "door_right";
      const edgeX = isRightDoor ? 14 : Math.max(14, front.dimensions.width - 14);
      const vSpan =
        category === "gola_profile"
          ? Math.max(120, front.dimensions.height - 8)
          : Math.min(480, Math.max(120, front.dimensions.height - 40));
      const vCy = category === "gola_profile" ? front.dimensions.height / 2 : cy;
      if (category === "gola_profile") {
        add("gola_vertical_channel", edgeX, vCy, -14, 34, vSpan, 28);
      } else if (category === "j_pull") {
        add("jpull_vertical_cutout", edgeX, vCy, z - 4, 24, vSpan, 12);
      } else {
        add("edge_vertical_profile", edgeX, vCy, z, 22, Math.max(180, span), 24);
      }
    } else if (isWallOrHighFront) {
      // Upper Wall Cabinet: place Gola / J-Pull / Edge profile at the BOTTOM edge (y ≈ 0..24)
      if (category === "gola_profile") {
        add("gola_horizontal_channel", front.dimensions.width / 2, 15, -14, fullW, 30, 28);
      } else if (category === "j_pull") {
        add("jpull_horizontal_cutout", front.dimensions.width / 2, 12, z - 4, fullW, 24, 12);
      } else {
        add("edge_horizontal_profile", front.dimensions.width / 2, 8, z, Math.max(140, span), 16, 26);
      }
    } else {
      // Base Cabinet or Drawer: place at the TOP edge!
      // Note: for Gola on doors, v4-profiles deducts 30mm from door height, so the 30mm Gola channel sits right in the top gap (top + 14)!
      // On drawers, place flush along the top edge (top - 14) so it never collides with the upper drawer.
      const golaY = drawer ? top - 14 : top + 14;
      if (category === "gola_profile") {
        add("gola_horizontal_channel", front.dimensions.width / 2, golaY, -14, fullW, 30, 28);
      } else if (category === "j_pull") {
        add("jpull_horizontal_cutout", front.dimensions.width / 2, top - 12, z - 4, fullW, 24, 12);
      } else {
        add("edge_horizontal_profile", front.dimensions.width / 2, top - 6, z, Math.max(140, span), 16, 26);
      }
    }
  }
  return parts;
}
