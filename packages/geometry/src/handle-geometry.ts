import { HandleCategory, ModuleCategory, resolveCanonicalHandlePlacement } from "@birim/core";
import { ComponentGeometry } from "./types";

export interface HandlePlacementContext {
  moduleCategory?: ModuleCategory;
  moduleElevationY?: number;
  moduleHeight?: number;
  moduleWidth?: number;
  moduleDepth?: number;
  panelThickness?: number;
  /** Stationary bay clear span [bayStartX .. bayStartX + bayWidth] on carcass (unaffected by door/drawer motion) */
  carcassBayStartX?: number;
  carcassBayWidth?: number;
  /** Stationary closed front Z0 plane on carcass (unaffected by pulledZ / liftDz / knuckleJointZ) */
  carcassFrontZ0?: number;
  /** Stationary closed front Y0 & height on carcass (unaffected by liftDy / knuckleJointY) */
  carcassClosedY0?: number;
  carcassClosedHeight?: number;
  /** Exact Y bottom of the next external drawer front above this drawer (for symmetrical C-Gola centering) */
  nextUpperDrawerBottomY?: number;
  /** Explicit flag indicating whether this front reaches the top of the base cabinet under the countertop */
  isTopAtCabinetCeiling?: boolean;
  /** For top drawers reaching the cabinet ceiling: false when top > 1200mm ergonomically omits unreachable Top L-Gola */
  emitTopLGola?: boolean;
  /** For intermediate drawers in a multi-drawer stack: true ONLY when this drawer's top gap gets a C-Gola */
  emitIntermediateCGola?: boolean;
  /** Stationary yaw angle for angled/corner carcass Gola channels (unaffected by doorOpenAngleDeg) */
  stationaryYawRad?: number;
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
    category === "j_pull" ||
    context?.handleProfileId === "hnd_overhang_recessed_lip" ||
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
    frontElevationYMm: context?.carcassClosedY0 ?? front.position.y,
    moduleCategory: context?.moduleCategory,
    moduleElevationYMm: context?.moduleElevationY,
    handleCategory: category,
    openingTechnology: context?.openingTechnology,
    crossSectionProfile: context?.crossSectionProfile,
    spacingCcMm:
      context?.spacingCcMm ??
      (context?.handleLengthMm ? Math.max(32, context.handleLengthMm - 24) : 160),
    handleOrientation: context?.handleOrientation,
    handleOffsetY: context?.handleOffsetY,
    handleEdgeInsetX: context?.handleEdgeInsetX,
  });
  const drawer = front.role === "drawer_front";
  const closedY0 = context?.carcassClosedY0 ?? front.position.y;
  const closedH = context?.carcassClosedHeight ?? front.dimensions.height;
  const isWallOrHighFront =
    !drawer &&
    (context?.moduleCategory === "kitchen_wall" ||
      (context?.moduleElevationY ?? 0) >= 1100 ||
      closedY0 >= 1100);
  const isTallOrWardrobeFront =
    !drawer &&
    !isWallOrHighFront &&
    (context?.moduleCategory === "wardrobe" ||
      context?.moduleCategory === "wardrobe_walkin" ||
      context?.moduleCategory === "wardrobe_corner" ||
      context?.moduleCategory === "kitchen_tall" ||
      context?.moduleCategory === "special_corner" ||
      closedH >= 1200);

  // Top/bottom edge-mounted profiles (edge_profile, j_pull, gola_profile) are horizontal on drawers, base doors, or wall doors;
  // on tall/wardrobe doors (>= 1200mm), putting a J-pull or edge profile at the top edge (~2200mm) is unreachable, so it mounts vertically along the opening stile.
  const isLiftDoor =
    front.id.includes("lift_") || Boolean(front.rotation && Math.abs(front.rotation[0]) > 0.001);
  const isTopBottomEdgeProfile =
    category === "edge_profile" || (category as string) === "j_pull" || category === "gola_profile";

  const autoHorizontal =
    drawer || isLiftDoor || (isTopBottomEdgeProfile && !isTallOrWardrobeFront);
  const isExplicitVerticalGola = context?.handleProfileId === "hnd_gola_vertical";
  const horizontal = isExplicitVerticalGola
    ? false
    : !drawer && context?.handleOrientation === "horizontal"
    ? true
    : !drawer && context?.handleOrientation === "vertical"
    ? false
    : autoHorizontal;

  // On double doors (_leaf_left + _leaf_right), horizontal carcass-mounted Gola spans the entire bay once via _leaf_left!
  if (category === "gola_profile" && horizontal && front.id.includes("_leaf_right")) {
    return [];
  }

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

  const cx = canon.centerXMm;
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

  // Helper for door/drawer-mounted handles (moves & rotates WITH the door or drawer leaf)
  const addDoorMounted = (
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
    parts.push({
      id: `${front.id}_handle_${name}`,
      role: drawer ? "drawer_handle" : "door_handle",
      label: `${category} (${name})`,
      bayIndex: front.bayIndex,
      dimensions: { width: w, height: h, depth: d },
      position: {
        x: front.position.x + x - w / 2,
        y: front.position.y + y - h / 2,
        z: front.position.z + dz,
      },
      rotation: front.rotation,
      pivot: front.pivot,
      primitive,
      parentComponentId: front.id,
      handleCategory: category,
      materialId:
        customMatId ||
        (category === "milled_wood_grip" || (category as string) === "j_pull"
          ? front.materialId
          : resolvedHandleMatId),
      isFrontFacing: true,
      isManufacturablePanel: false,
    });
  };

  // Helper for stationary CARCASS-MOUNTED Gola channels & Fixing Brackets (100% independent of door/drawer motion!)
  const isLCornerReturn = front.id.includes("_lcorner_return");
  const isDiag45 = front.id.includes("_diag45_door");
  const isAngledCarcassFront = isLCornerReturn || isDiag45 || context?.stationaryYawRad !== undefined;
  const stationaryRotation: [number, number, number] | undefined =
    context?.stationaryYawRad !== undefined
      ? [0, context.stationaryYawRad, 0]
      : isLCornerReturn
      ? [0, Math.PI / 2, 0]
      : undefined;
  const stationaryPivot = isAngledCarcassFront ? front.pivot : undefined;

  const addCarcassGola = (
    name: string,
    worldX: number,
    worldY: number,
    worldZ: number,
    w: number,
    h: number,
    d: number,
    label: string,
    useWoodFinish = false
  ) => {
    parts.push({
      id: `${front.id}_handle_${name}`,
      role: "gola_profile",
      label,
      bayIndex: front.bayIndex,
      dimensions: { width: w, height: h, depth: d },
      position: { x: worldX, y: worldY, z: worldZ },
      rotation: stationaryRotation,
      pivot: stationaryPivot,
      primitive: "box",
      // Carcass-mounted Gola is bolted to cabinet side panels — NEVER parented to a moving door or drawer!
      parentComponentId: undefined,
      handleCategory: "gola_profile",
      materialId: useWoodFinish ? front.materialId : resolvedHandleMatId,
      isFrontFacing: true,
      isManufacturablePanel: false,
    });
  };

  const addCarcassFixingBracket = (
    name: string,
    worldX: number,
    worldY: number,
    worldZ: number,
    w: number,
    h: number,
    d: number,
    label: string
  ) => {
    if (isAngledCarcassFront) return;
    parts.push({
      id: `${front.id}_gola_fixing_bracket_${name}`,
      role: "special_fitting",
      label,
      bayIndex: front.bayIndex,
      dimensions: { width: w, height: h, depth: d },
      position: { x: worldX, y: worldY, z: worldZ },
      primitive: "box",
      parentComponentId: undefined,
      materialId: "mat_anodized_metal",
      isManufacturablePanel: false,
    });
  };

  if (category === "knob") {
    addDoorMounted("stem", cx, cy, z - 2, 12, 12, 14, "cylinder");
    addDoorMounted("knob", cx, cy, z, 32, 32, 22, "sphere");
  } else if (
    category === "bar_handle" ||
    category === "long_profile_handle" ||
    category === "decorative_bespoke"
  ) {
    for (const sign of [-1, 1]) {
      addDoorMounted(
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
    addDoorMounted(
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
    const pocketW = horizontal
      ? Math.min(136, Math.max(48, front.dimensions.width - 36))
      : 38;
    const pocketH = horizontal
      ? Math.min(38, Math.max(22, front.dimensions.height - 20))
      : Math.min(148, Math.max(52, front.dimensions.height - 36));
    addDoorMounted("recessed_pocket", cx, cy, z - 4, pocketW, pocketH, 8);
  } else if ((category as string) === "j_pull") {
    // CNC J-Pull channel is milled directly into the 3D door leaf (`j_pull_bevel` at top for base, bottom for upper wall) — no extra metal bar!
    return [];
  } else if (category !== "gola_profile") {
    // Door-edge-mounted Clip-On Aluminum Edge Profile (moves WITH door/drawer!)
    const top = front.dimensions.height;
    if (!horizontal) {
      const isRightDoor = front.role === "door_right";
      const edgeX = isRightDoor ? 3 : Math.max(3, front.dimensions.width - 3);
      addDoorMounted("edge_vertical_profile", edgeX, cy, 0, 6, Math.max(180, span), z + 18);
    } else if (isWallOrHighFront) {
      addDoorMounted(
        "edge_horizontal_profile",
        front.dimensions.width / 2,
        2,
        0,
        Math.max(140, span),
        4,
        z + 18
      );
    } else {
      addDoorMounted(
        "edge_horizontal_profile",
        front.dimensions.width / 2,
        top - 1,
        0,
        Math.max(140, span),
        4,
        z + 18
      );
    }
  } else {
    // =========================================================================
    // STATIONARY CARCASS-MOUNTED GOLA SYSTEMS + CARCASS FIXING BRACKETS
    // Rigidly bolted to cabinet side panels / dividers via L-shaped snap-on /
    // screw fixing clips (Scilm SU116 / Häfele 712.63.511 / Gelmar 35×12×35mm).
    // NEVER moves or rotates when doors or drawers open!
    // =========================================================================
    const stationaryZ0 =
      context?.carcassFrontZ0 ?? context?.moduleDepth ?? front.position.z;
    const bayX0 = isAngledCarcassFront
      ? front.position.x + 1
      : context?.carcassBayStartX ?? front.position.x + 1;
    const baySpanW = isAngledCarcassFront
      ? Math.max(24, front.dimensions.width - 2)
      : Math.max(24, context?.carcassBayWidth ?? front.dimensions.width - 2);
    const panelT = context?.panelThickness ?? 18;
    const modH = context?.moduleHeight ?? 870;

    if (!horizontal) {
      // Skip drawer fronts when Vertical Gola 1020 is active (one continuous vertical profile spans the tall cabinet!)
      if (drawer) {
        return parts;
      }
      // Tall / Wardrobe Vertical Gola 1020 (56×26mm C-channel on center divider or 46×26mm L-channel)
      const isRightDoor = front.role === "door_right";
      const isDoubleLeafLeft = front.id.includes("_leaf_left");
      const isDoubleLeafRight = front.id.includes("_leaf_right");
      const isSharedRightNeighbor =
        !isDoubleLeafLeft && !isDoubleLeafRight && isRightDoor && (front.bayIndex ?? 0) > 0;
      if (!isDoubleLeafRight && !isSharedRightNeighbor) {
        const isCenterCGola =
          isDoubleLeafLeft || (!isRightDoor && (front.bayIndex ?? 0) === 0);
        const golaW = isCenterCGola ? 56 : 46;
        const centerWorldX = isDoubleLeafLeft
          ? front.position.x + front.dimensions.width + 15
          : !isRightDoor
          ? front.position.x + front.dimensions.width + 15
          : front.position.x - 15;
        const vSpan = Math.max(120, closedH);
        addCarcassGola(
          "gola_vertical_channel",
          centerWorldX - golaW / 2,
          closedY0,
          stationaryZ0 - 26,
          golaW,
          vSpan,
          26,
          `Dikey Alüminyum Gola 1020 (${golaW}×26mm — Gövde Dikmesine Sabit)`
        );
        // 3 Vertical Gola Fixing / Spacer Brackets locking channel to recessed carcass divider
        const clipYs = [
          closedY0 + 120,
          closedY0 + vSpan / 2 - 17.5,
          closedY0 + Math.max(180, vSpan - 155),
        ];
        clipYs.forEach((clipY, cIdx) => {
          addCarcassFixingBracket(
            `vert_${cIdx + 1}`,
            centerWorldX - 15,
            clipY,
            stationaryZ0 - 26 - 24,
            30,
            35,
            24,
            `Dikey Gola 1020 Gövde Sabitleyici Klips #${cIdx + 1} (Häfele 712.63.590)`
          );
        });
      }
    } else if (isWallOrHighFront) {
      // Upper Wall Cabinet: Gola 268 sits permanently inside the recessed 18mm carcass bottom panel
      // at module-local Y = [0 .. panelT], Z = [stationaryZ0 - 26 .. stationaryZ0]!
      addCarcassGola(
        "gola_wall_268_channel",
        bayX0,
        0,
        stationaryZ0 - 26,
        baySpanW,
        panelT,
        26,
        `Üst Dolap Alt Tabla Gömme Gola 268 (${panelT}×26mm — Alt Tablaya Sabit)`
      );
    } else {
      // Base Cabinet / Drawer Stack: Horizontal Top Gola & Intermediate C-Gola
      const profId = context?.handleProfileId || "";
      const closedTopY = closedY0 + closedH;
      const isTopFrontAtCountertop =
        typeof context?.isTopAtCabinetCeiling === "boolean"
          ? context.isTopAtCabinetCeiling
          : closedTopY >= modH - 45;

      // Anthropometric Guard: When a tall drawer stack exceeds 1200 mm, the top drawer cannot be gripped from above;
      // Top L-Gola is omitted (`emitTopLGola === false`) and the drawer is pulled underhand from the C-Gola below it!
      if (drawer && isTopFrontAtCountertop && context?.emitTopLGola === false) {
        return parts;
      }

      if (profId === "hnd_gola_melamine_box") {
        if (isTopFrontAtCountertop) {
          addCarcassGola(
            "gola_melamine_box",
            bayX0,
            modH - 60,
            stationaryZ0 - 38,
            baySpanW,
            60,
            38,
            "Melamin Gömme Parmak Kutusu (60×38mm — Gövdeye Sabit)",
            true
          );
        } else {
          if (drawer && context?.emitIntermediateCGola === false) {
            return parts;
          }
          const upperBotY = context?.nextUpperDrawerBottomY ?? closedTopY + 30;
          const gapMidY = (closedTopY + upperBotY) / 2;
          addCarcassGola(
            "gola_melamine_box_mid",
            bayX0,
            gapMidY - 33,
            stationaryZ0 - 38,
            baySpanW,
            66,
            38,
            "Melamin Orta Gömme Parmak Kutusu (66×38mm — Gövdeye Sabit)",
            true
          );
        }
      } else if (profId === "hnd_gola_moulded_box") {
        if (isTopFrontAtCountertop) {
          addCarcassGola(
            "gola_moulded_box",
            bayX0,
            modH - 60,
            stationaryZ0 - 25,
            baySpanW,
            60,
            25,
            "Şekillendirilmiş Gömme Parmak Kutusu (60×25mm — Gövdeye Sabit)",
            true
          );
        } else {
          if (drawer && context?.emitIntermediateCGola === false) {
            return parts;
          }
          const upperBotY = context?.nextUpperDrawerBottomY ?? closedTopY + 30;
          const gapMidY = (closedTopY + upperBotY) / 2;
          addCarcassGola(
            "gola_moulded_box_mid",
            bayX0,
            gapMidY - 33,
            stationaryZ0 - 25,
            baySpanW,
            66,
            25,
            "Şekillendirilmiş Orta Gömme Parmak Kutusu (66×25mm — Gövdeye Sabit)",
            true
          );
        }
      } else if (profId === "hnd_bevel_30_backing") {
        if (isTopFrontAtCountertop) {
          addCarcassGola(
            "gola_bevel_backing",
            bayX0,
            modH - 60,
            stationaryZ0 - 18,
            baySpanW,
            60,
            18,
            "45° Pahlı Kapak Üst Arka Kapama Bandı (60×18mm — Gövdeye Sabit)",
            true
          );
        } else {
          // Unpaired intermediate drawers (e.g. 1–2 in a 3-drawer unit) stay joined with 3mm fuga and ZERO backing strip!
          if (drawer && context?.emitIntermediateCGola === false) {
            return parts;
          }
          const upperBotY = context?.nextUpperDrawerBottomY ?? closedTopY + 30;
          const gapMidY = (closedTopY + upperBotY) / 2;
          addCarcassGola(
            "gola_bevel_backing",
            bayX0,
            gapMidY - 33,
            stationaryZ0 - 18,
            baySpanW,
            66,
            18,
            "45° Pahlı Çekmece Orta Arka Kapama Bandı (66×18mm — Gövdeye Sabit)",
            true
          );
        }
      } else if (!isTopFrontAtCountertop) {
        // Unpaired intermediate drawers (e.g. gap 1–2 in a 3-drawer unit, gaps 1–2 & 3–4 in a 5-drawer unit)
        // use a crisp 3mm standard reveal with ZERO C-Gola profile (they pull from the paired C-Gola below or L-Gola above!)
        if (drawer && context?.emitIntermediateCGola === false) {
          return parts;
        }
        // Intermediate Horizontal C-Gola (73.5×26mm) symmetrically centered on the 32mm gap between drawers!
        const upperBotY = context?.nextUpperDrawerBottomY ?? closedTopY + 32;
        const gapMidY = (closedTopY + upperBotY) / 2;
        const cH = 73.5;
        addCarcassGola(
          "gola_c_channel",
          bayX0,
          gapMidY - cH / 2,
          stationaryZ0 - 26,
          baySpanW,
          cH,
          26,
          "Orta Yatay Alüminyum C-Gola Profili (73.5×26mm — Yan Dikmelere Sabit)"
        );
        // Left & Right Carcass Fixing Brackets (Scilm SU116 / Häfele 712.63.511 — 35×14×35mm)
        // Screwed into left/right carcass side panels and locked into C-Gola rear dovetail slot!
        if (baySpanW >= 80) {
          addCarcassFixingBracket(
            "mid_L",
            bayX0,
            gapMidY - 17.5,
            stationaryZ0 - 26 - 35,
            14,
            35,
            35,
            "Orta C-Gola Sol Gövde Sabitleyici L-Klips (Scilm SU116 / 35×14×35mm)"
          );
          addCarcassFixingBracket(
            "mid_R",
            bayX0 + baySpanW - 14,
            gapMidY - 17.5,
            stationaryZ0 - 26 - 35,
            14,
            35,
            35,
            "Orta C-Gola Sağ Gövde Sabitleyici L-Klips (Scilm SU116 / 35×14×35mm)"
          );
        }
      } else {
        // Top Horizontal L-Gola (56×26mm) flush under countertop [modH - 56 .. modH]
        addCarcassGola(
          "gola_l_channel",
          bayX0,
          modH - 56,
          stationaryZ0 - 26,
          baySpanW,
          56,
          26,
          "Üst Yatay Alüminyum L-Gola Profili (56×26mm — Yan Dikme & Üst Kayda Sabit)"
        );
        // Left & Right Top Carcass Fixing Brackets (35×14×32mm) directly below recessed front top stretcher [modH - 50 .. modH - 18]
        if (baySpanW >= 80) {
          addCarcassFixingBracket(
            "top_L",
            bayX0,
            modH - panelT - 32,
            stationaryZ0 - 26 - 35,
            14,
            32,
            35,
            "Üst L-Gola Sol Gövde Sabitleyici L-Klips (Scilm SU116 / 35×14×32mm)"
          );
          addCarcassFixingBracket(
            "top_R",
            bayX0 + baySpanW - 14,
            modH - panelT - 32,
            stationaryZ0 - 26 - 35,
            14,
            32,
            35,
            "Üst L-Gola Sağ Gövde Sabitleyici L-Klips (Scilm SU116 / 35×14×32mm)"
          );
        }
      }
    }
  }
  return parts;
}
