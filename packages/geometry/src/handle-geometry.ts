import { HandleCategory, ModuleCategory, resolveCanonicalHandlePlacement } from "@birim/core";
import { ComponentGeometry } from "./types";

export interface HandlePlacementContext {
  moduleCategory?: ModuleCategory;
  moduleElevationY?: number;
  moduleHeight?: number;
  handleOrientation?: "auto" | "vertical" | "horizontal";
  handleOffsetY?: number;
  handleEdgeInsetX?: number;
  handleLengthMm?: number;
  handleMaterialId?: string;
  handleProfileId?: string;
  crossSectionProfile?: string;
  openingTechnology?: string;
  spacingCcMm?: number;
}

/** Representative visual geometry for all V4 handle & profile systems (Bar, Knob, Long Profile, Gola, J-Pull, Recessed Grip, Edge Profile). */
export function generateHandleGeometry(
  front: ComponentGeometry,
  category: HandleCategory,
  context?: HandlePlacementContext
): ComponentGeometry[] {
  if (
    category === "handleless_plain" ||
    front.id.includes("_lift_bifold_top") ||
    front.label.includes("Katlanır Kalkar Üst Kanat")
  ) {
    return [];
  }
  const canon = resolveCanonicalHandlePlacement({
    partRole: front.role,
    partId: front.id,
    partLabel: front.label,
    frontWidthMm: front.dimensions.width,
    frontHeightMm: front.dimensions.height,
    frontElevationYMm: front.position.y,
    moduleCategory: context?.moduleCategory,
    moduleElevationYMm: context?.moduleElevationY,
    handleCategory: category,
    openingTechnology: context?.openingTechnology,
    crossSectionProfile: context?.crossSectionProfile,
    spacingCcMm: context?.spacingCcMm ?? (context?.handleLengthMm ? Math.max(32, context.handleLengthMm - 24) : 160),
    handleOrientation: context?.handleOrientation,
    handleOffsetY: context?.handleOffsetY,
    handleEdgeInsetX: context?.handleEdgeInsetX,
  });
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

  const autoHorizontal =
    drawer || isLiftDoor || (isTopBottomEdgeProfile && !isTallOrWardrobeFront);
  const horizontal =
    !drawer && context?.handleOrientation === "horizontal"
      ? true
      : !drawer && context?.handleOrientation === "vertical"
      ? false
      : autoHorizontal;

  // Clamp handle span strictly inside the front face with safe margins
  const maxAllowedSpan = Math.max(
    24,
    (horizontal ? front.dimensions.width : front.dimensions.height) - (drawer ? 48 : 40)
  );
  const defaultTargetSpan =
    category === "long_profile_handle"
      ? drawer
        ? Math.min(600, Math.round(front.dimensions.width * 0.72))
        : Math.min(1100, Math.max(600, Math.round(front.dimensions.height * 0.58)))
      : category === "decorative_bespoke"
      ? 160
      : drawer
      ? Math.min(192, Math.round(front.dimensions.width * 0.6))
      : isTallOrWardrobeFront
      ? 256
      : 192;
  const targetSpan =
    !drawer && context?.handleLengthMm && context.handleLengthMm >= 64
      ? context.handleLengthMm
      : defaultTargetSpan;
  const span = Math.min(targetSpan, maxAllowedSpan);

  const edgeInset = Math.max(
    22,
    Math.min(120, context?.handleEdgeInsetX ?? 42)
  );
  const openingSideX =
    front.role === "door_right"
      ? Math.min(edgeInset, front.dimensions.width / 2)
      : Math.max(front.dimensions.width / 2, front.dimensions.width - edgeInset);
  const cx = canon.centerXMm;

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

  const defaultCy = drawer
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

  const cy = canon.centerYMm;

  // Resolve handle finish material ID from K019 / K020 / K021 / K022 or explicit handleMaterialId
  const resolvedHandleMatId =
    context?.handleMaterialId ||
    (context?.handleProfileId === "K020"
      ? "mat_handle_inox"
      : context?.handleProfileId === "K021"
      ? "mat_handle_brass"
      : context?.handleProfileId === "K022"
      ? "mat_handle_anthracite"
      : context?.handleProfileId === "K019"
      ? "mat_handle_matte_black"
      : "mat_handle_matte_black");

  // Exact outer face of the door panel (dz = z means flush against the door front face — NEVER detached!)
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
          : resolvedHandleMatId),
      isFrontFacing: true,
      isManufacturablePanel: false,
    });
  };

  if (category === "knob") {
    add("stem", cx, cy, z - 2, 12, 12, 14, "cylinder");
    // Flush against door outer face (dz = z) with total depth 22mm so stem + knob attach directly to door
    add("knob", cx, cy, z, 32, 32, 22, "sphere");
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
        z - 2,
        12,
        12,
        18,
        "cylinder"
      );
    }
    // IMPORTANT: dz = z (NOT z + 20!) so the handle assembly starts directly on the door outer face with zero air gap!
    add(
      "grip",
      cx,
      cy,
      z,
      horizontal ? span : 14,
      horizontal ? 14 : span,
      24,
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
    add("recessed_pocket", cx, cy, z - 4, pocketW, pocketH, 8);
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
        add("jpull_vertical_cutout", edgeX, vCy, z - 4, 24, vSpan, 10);
      } else {
        add("edge_vertical_profile", edgeX, vCy, z - 2, 20, Math.max(180, span), 18);
      }
    } else if (isWallOrHighFront) {
      // Upper Wall Cabinet: place Gola / J-Pull / Edge profile at the BOTTOM edge (y ≈ 0..24)
      if (category === "gola_profile") {
        add("gola_horizontal_channel", front.dimensions.width / 2, 15, -14, fullW, 30, 28);
      } else if (category === "j_pull") {
        add("jpull_horizontal_cutout", front.dimensions.width / 2, 12, z - 4, fullW, 24, 10);
      } else {
        add("edge_horizontal_profile", front.dimensions.width / 2, 8, z - 2, Math.max(140, span), 16, 18);
      }
    } else {
      // Base Cabinet or Drawer: place at the TOP edge!
      const golaY = drawer ? top - 14 : top + 14;
      if (category === "gola_profile") {
        add("gola_horizontal_channel", front.dimensions.width / 2, golaY, -14, fullW, 30, 28);
      } else if (category === "j_pull") {
        add("jpull_horizontal_cutout", front.dimensions.width / 2, top - 12, z - 4, fullW, 24, 10);
      } else {
        add("edge_horizontal_profile", front.dimensions.width / 2, top - 6, z - 2, Math.max(140, span), 16, 18);
      }
    }
  }
  return parts;
}
