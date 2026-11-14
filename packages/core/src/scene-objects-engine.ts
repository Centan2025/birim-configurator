import {
  DesignProject,
  Dimensions3D,
  ModuleCategory,
  ModuleFamilyId,
  ModuleInstance,
  Position3D,
  Rotation3D,
  UnitLength,
  ValidationIssue,
  WallDefinition,
} from "./types";
import { PanelCutoutConfig } from "./panel-cutouts";

export type SceneObjectCategory =
  | "appliance"
  | "plumbing_fixture"
  | "freestanding_furniture"
  | "lighting_electronics"
  | "architectural_prop"
  | "custom_glb";

export type SceneObjectAnchorMode =
  | "wall_base"
  | "wall_elevated"
  | "countertop_cutout"
  | "module_cavity"
  | "free_floor"
  | "surface_raycast"
  | "ceiling";

export type SceneObjectVisualKind =
  | "fridge_french_door"
  | "fridge_single"
  | "dishwasher"
  | "oven_builtin"
  | "microwave_builtin"
  | "cooktop_induction"
  | "hood_wall_chimney"
  | "hood_island"
  | "washer_dryer"
  | "wine_cooler"
  | "sink_undermount_faucet"
  | "sink_vessel_bath"
  | "dining_table_oak"
  | "dining_chair"
  | "bar_stool"
  | "sofa_modular"
  | "armchair"
  | "bed_double"
  | "nightstand"
  | "ottoman_pouf"
  | "coffee_table"
  | "area_rug"
  | "pendant_linear_led"
  | "pendant_triple"
  | "wall_tv_oled"
  | "espresso_machine"
  | "door_interior_swing"
  | "window_double_sash"
  | "radiator_panel"
  | "boiler_combi"
  | "structural_column"
  | "ceiling_beam"
  | "electrical_panel"
  | "plant_olive_tree"
  | "wall_mirror_full"
  | "framed_art"
  | "custom_glb_mesh";

export interface SceneObjectClearanceSpec {
  frontSwingMm?: UnitLength;
  topVentMm?: UnitLength;
  rearVentMm?: UnitLength;
  sideLeftMm?: UnitLength;
  sideRightMm?: UnitLength;
  minWalkwayFrontMm?: UnitLength;
}

export interface SceneObjectCutoutTrigger {
  kind: "sink" | "cooktop" | "cable_port";
  cutoutWidthMm: UnitLength;
  cutoutDepthMm: UnitLength;
  cornerRadiusMm?: UnitLength;
  requiresUnderSinkSiphonCutout?: boolean;
  requiresUnderSinkDripTray?: boolean;
  requiresCooktopHeatShield?: boolean;
}

export interface SceneObjectMepTrigger {
  discipline:
    | "plumbing_cold"
    | "plumbing_hot"
    | "plumbing_drain"
    | "elec_appliance"
    | "elec_counter"
    | "elec_led_driver"
    | "hvac_hood_flue";
  label: string;
  offsetXFromCenterMm: number;
  elevationFromFloorMm: number;
  diameterOrSpec: string;
  codeNote: string;
}

export interface SceneObjectInstance {
  id: string;
  catalogId: string;
  sku: string;
  name: string;
  brand?: string;
  category: SceneObjectCategory;
  anchorMode: SceneObjectAnchorMode;
  visualKind: SceneObjectVisualKind;
  position: Position3D;
  rotation: Rotation3D;
  dimensions: Dimensions3D;
  scaleFactor?: number;
  primaryColorHex?: string;
  secondaryColorHex?: string;
  metalness?: number;
  roughness?: number;
  /** Optional external or IndexedDB/Cloudflare R2 .glb / .gltf URL */
  glbUrl?: string;
  /** Optional IndexedDB persistent asset key when uploaded from local disk */
  localAssetKey?: string;
  /** Optional host module ID when mounted onto/into a specific cabinet */
  hostModuleId?: string;
  hostWallId?: string;
  commercialRole: "quoted_product" | "client_supplied" | "decor_only";
  unitPriceEur: number;
  quantity?: number;
  clearance?: SceneObjectClearanceSpec;
  cutoutTrigger?: SceneObjectCutoutTrigger;
  mepTriggers?: SceneObjectMepTrigger[];
  lightEmission?: {
    enabled: boolean;
    colorTempK: 2700 | 3000 | 4000;
    lumens: number;
  };
  doorSwing?: "left" | "right";
  isLocked?: boolean;
  isHidden?: boolean;
}

export interface CustomModuleTemplateRecord {
  templateId: string;
  name: string;
  description: string;
  familyId: ModuleFamilyId;
  category: ModuleCategory;
  createdAt: string;
  baseDimensions: Dimensions3D;
  serializedModuleSnapshot: ModuleInstance;
}

export interface ObstacleNotchSpec {
  id: string;
  obstacleId: string;
  obstacleName: string;
  corner: "rear_left" | "rear_right" | "top_rear" | "bottom_rear";
  notchWidthMm: UnitLength;
  notchDepthMm: UnitLength;
  notchHeightMm: UnitLength;
}

export interface WallFreeGapSlot {
  id: string;
  wallId: string;
  wallName: string;
  zone: "base" | "wall";
  startAlongMm: UnitLength;
  endAlongMm: UnitLength;
  widthMm: UnitLength;
  targetElevationY: UnitLength;
  worldOriginX: UnitLength;
  worldOriginZ: UnitLength;
  moduleRotationYDeg: number;
}

export interface WorkTriangleLegMetric {
  fromLabel: string;
  toLabel: string;
  distanceMm: number;
  passed: boolean;
  idealRangeLabel: string;
}

export interface WorkTriangleReport {
  isComplete: boolean;
  perimeterMm: number;
  perimeterPassed: boolean;
  legs: WorkTriangleLegMetric[];
  ergonomicWarnings: string[];
}

function getWallBasisSimple(wall: WallDefinition) {
  const rad = ((wall.rotationY || 0) * Math.PI) / 180;
  const tx = Math.cos(rad);
  const tz = Math.sin(rad);
  // Inward normal pointing into the room (+Z when wall rotationY === 0)
  const nx = -tz;
  const nz = tx;
  const betaRad = Math.atan2(nx, nz);
  const moduleRotationYDeg = (((Math.round((betaRad * 180) / Math.PI * 10) / 10) % 360) + 360) % 360;
  return {
    p0: { x: wall.position.x, z: wall.position.z },
    tx,
    tz,
    nx,
    nz,
    moduleRotationYDeg,
  };
}

/**
 * Finds free, unoccupied wall spans along all room walls so the user can either:
 * 1) Click "Boşluğa Sığdır (Fit-to-Gap)" to generate an exact custom-width cabinet, or
 * 2) Auto-generate wall fillers for gaps <= 180mm.
 */
export function findWallFreeGaps(
  project: DesignProject,
  zone: "base" | "wall" = "base"
): WallFreeGapSlot[] {
  const walls: WallDefinition[] =
    project.space.walls && project.space.walls.length > 0
      ? project.space.walls
      : [
          {
            id: "wall_main",
            name: "Ana Duvar",
            length: 3600,
            height: project.space.ceilingHeight || 2600,
            thickness: 150,
            position: { x: 0, y: 0, z: 0 },
            rotationY: 0,
            elements: [],
          },
        ];

  const slots: WallFreeGapSlot[] = [];

  for (const wall of walls) {
    const basis = getWallBasisSimple(wall);
    const occupied: { start: number; end: number }[] = [];

    for (const mod of project.modules) {
      if (mod.category === "complementary" || mod.category === "kitchen_island") continue;
      const isWallMod =
        mod.category === "kitchen_wall" || mod.moduleFamilyId === "fam_kitchen_wall";
      if ((zone === "wall") !== isWallMod) continue;

      const modRot = (((mod.rotation?.y ?? 0) % 360) + 360) % 360;
      const angDiff = Math.abs(
        ((((modRot - basis.moduleRotationYDeg) % 360) + 540) % 360) - 180
      );
      if (angDiff > 22) continue;

      const dx = mod.position.x - basis.p0.x;
      const dz = mod.position.z - basis.p0.z;
      const perp = Math.abs(dx * basis.nx + dz * basis.nz);
      if (perp > 450) continue;

      const alongStart = dx * basis.tx + dz * basis.tz;
      const alongEnd = alongStart + mod.dimensions.width;
      occupied.push({
        start: Math.max(0, Math.min(wall.length, Math.min(alongStart, alongEnd))),
        end: Math.max(0, Math.min(wall.length, Math.max(alongStart, alongEnd))),
      });
    }

    // Also mark floor-reaching doors on base zone as occupied spans
    if (zone === "base") {
      const allObs = [...(project.space.elements || []), ...(wall.elements || [])];
      for (const el of allObs) {
        if (el.type !== "door") continue;
        const dx = el.position.x - basis.p0.x;
        const dz = el.position.z - basis.p0.z;
        const perp = Math.abs(dx * basis.nx + dz * basis.nz);
        if (perp > 350) continue;
        const alongStart = dx * basis.tx + dz * basis.tz;
        occupied.push({
          start: Math.max(0, alongStart - 40),
          end: Math.min(wall.length, alongStart + el.dimensions.width + 40),
        });
      }
    }

    occupied.sort((a, b) => a.start - b.start);
    const merged: { start: number; end: number }[] = [];
    for (const seg of occupied) {
      if (seg.end - seg.start < 5) continue;
      const prev = merged[merged.length - 1];
      if (!prev || seg.start > prev.end + 2) {
        merged.push({ ...seg });
      } else {
        prev.end = Math.max(prev.end, seg.end);
      }
    }

    let cursor = 0;
    const rawGaps: { start: number; end: number }[] = [];
    for (const seg of merged) {
      if (seg.start - cursor >= 15) {
        rawGaps.push({ start: Math.round(cursor), end: Math.round(seg.start) });
      }
      cursor = Math.max(cursor, seg.end);
    }
    if (wall.length - cursor >= 15) {
      rawGaps.push({ start: Math.round(cursor), end: Math.round(wall.length) });
    }

    rawGaps.forEach((g, idx) => {
      const wMm = g.end - g.start;
      const wx = Math.round(basis.p0.x + basis.tx * g.start);
      const wz = Math.round(basis.p0.z + basis.tz * g.start);
      slots.push({
        id: `gap_${wall.id}_${zone}_${idx}`,
        wallId: wall.id,
        wallName: wall.name,
        zone,
        startAlongMm: g.start,
        endAlongMm: g.end,
        widthMm: wMm,
        targetElevationY: zone === "wall" ? 1450 : 0,
        worldOriginX: wx,
        worldOriginZ: wz,
        moduleRotationYDeg: basis.moduleRotationYDeg,
      });
    });
  }

  return slots;
}

/**
 * Generates complementary auto-fillers (wall scribing strips 15..180mm), ceiling top fascia/crown panels,
 * and under-cabinet LED valance channels across the entire project.
 */
export function computeAutoFillersAndTrimForProject(project: DesignProject): {
  addedModules: ModuleInstance[];
  summaryNotes: string[];
} {
  const existingNonAuto = project.modules.filter(
    (m) => !m.id.startsWith("mod_autofiller_") && !m.id.startsWith("mod_autotop_") && !m.id.startsWith("mod_autovalance_")
  );
  const tempProject: DesignProject = { ...project, modules: existingNonAuto };

  const addedModules: ModuleInstance[] = [];
  const summaryNotes: string[] = [];

  const primaryMod = existingNonAuto.find((m) => m.category !== "complementary") || existingNonAuto[0];
  const bodyMat = primaryMod?.carcass.bodyMaterialId || "mat_melamine_white";
  const doorMat = primaryMod?.carcass.doorMaterialId || "mat_lacquer_cream";
  const ceilH = project.space.ceilingHeight || 2600;

  // 1. Wall-end scribing fillers (15mm .. 180mm) on base & wall zones
  for (const zone of ["base", "wall"] as const) {
    const gaps = findWallFreeGaps(tempProject, zone);
    for (const gap of gaps) {
      if (gap.widthMm >= 18 && gap.widthMm <= 180) {
        // Only add filler if there is at least one cabinet on this wall
        const hasNeighborOnWall = existingNonAuto.some((m) => {
          const isWall = m.category === "kitchen_wall" || m.moduleFamilyId === "fam_kitchen_wall";
          return (zone === "wall") === isWall && m.category !== "complementary";
        });
        if (!hasNeighborOnWall) continue;

        const refHeight =
          zone === "wall"
            ? 720
            : primaryMod?.category.startsWith("wardrobe")
            ? primaryMod.dimensions.height
            : 870;
        const refDepth = zone === "wall" ? 350 : primaryMod?.dimensions.depth || 580;
        const plinthH = zone === "wall" ? 0 : primaryMod?.carcass.plinthHeight ?? 100;

        const fillerId = `mod_autofiller_${gap.wallId}_${zone}_${gap.startAlongMm}`;
        addedModules.push({
          id: fillerId,
          name: `Otomatik Duvar Kör/Tesviye Paneli (${gap.widthMm}mm)`,
          category: "complementary",
          moduleFamilyId: "fam_complementary",
          complementaryRole: "wall_filler",
          isOpenFront: true,
          isFixedWidth: true,
          position: {
            x: gap.worldOriginX,
            y: gap.targetElevationY,
            z: gap.worldOriginZ,
          },
          rotation: { x: 0, y: gap.moduleRotationYDeg, z: 0 },
          dimensions: {
            width: gap.widthMm,
            height: refHeight,
            depth: Math.min(refDepth, 600),
          },
          carcass: {
            panelThickness: 18,
            backPanelThickness: 8,
            backPanelType: "none",
            plinthHeight: plinthH,
            doorPerimeterGap: 2,
            edgeBandThickness: 1,
            bodyMaterialId: doorMat,
            doorMaterialId: doorMat,
            jointType: "minifix_dowel",
          },
          bays: [
            {
              index: 0,
              door: { id: `door_${fillerId}`, bayIndex: 0, type: "open", softClose: false },
              shelves: [],
              hangingRails: [],
              drawers: [],
              specialFittings: [],
            },
          ],
        });
        summaryNotes.push(
          `${gap.wallName} (${zone === "wall" ? "Üst" : "Alt"}): ${gap.widthMm}mm boşluğa otomatik duvar tesviye/kör paneli eklendi.`
        );
      }
    }
  }

  // 2. Ceiling Top Fascia / Crown Molding Infill (for tall & wardrobe/wall cabinets within 20..280mm of ceiling)
  const topCandidates = existingNonAuto.filter(
    (m) =>
      m.category === "wardrobe" ||
      m.category === "wardrobe_walkin" ||
      m.category === "kitchen_tall" ||
      m.category === "kitchen_wall"
  );
  for (const mod of topCandidates) {
    const topY = mod.position.y + mod.dimensions.height;
    const ceilGap = ceilH - topY;
    if (ceilGap >= 20 && ceilGap <= 280) {
      const topId = `mod_autotop_${mod.id}`;
      addedModules.push({
        id: topId,
        name: `Üst Alın / Taç Kapama Paneli (${mod.name} • H:${ceilGap}mm)`,
        category: "complementary",
        moduleFamilyId: "fam_complementary",
        complementaryRole: "top_infill",
        isOpenFront: true,
        position: {
          x: mod.position.x,
          y: topY,
          z: mod.position.z,
        },
        rotation: mod.rotation ? { ...mod.rotation } : { x: 0, y: 0, z: 0 },
        dimensions: {
          width: mod.dimensions.width,
          height: ceilGap,
          depth: Math.max(80, mod.dimensions.depth - 20),
        },
        carcass: {
          panelThickness: 18,
          backPanelThickness: 8,
          backPanelType: "none",
          plinthHeight: 0,
          doorPerimeterGap: 2,
          edgeBandThickness: 1,
          bodyMaterialId: bodyMat,
          doorMaterialId: doorMat,
          jointType: "minifix_dowel",
        },
        bays: [
          {
            index: 0,
            door: { id: `door_${topId}`, bayIndex: 0, type: "open", softClose: false },
            shelves: [],
            hangingRails: [],
            drawers: [],
            specialFittings: [],
          },
        ],
      });
      summaryNotes.push(
        `${mod.name} üstü ile tavan (${ceilH}mm) arasındaki ${ceilGap}mm boşluğa alın/taç kapama eklendi.`
      );
    }
  }

  // 3. Under-cabinet LED Light Valance strip for kitchen wall cabinets
  const wallCabs = existingNonAuto.filter((m) => m.category === "kitchen_wall");
  for (const wc of wallCabs) {
    if (wc.position.y > 900) {
      const valId = `mod_autovalance_${wc.id}`;
      addedModules.push({
        id: valId,
        name: `Üst Dolap Altı Işık Bandı & LED Profil (${wc.name})`,
        category: "complementary",
        moduleFamilyId: "fam_complementary",
        complementaryRole: "led_channel",
        isOpenFront: true,
        position: {
          x: wc.position.x,
          y: wc.position.y - 28,
          z: wc.position.z,
        },
        rotation: wc.rotation ? { ...wc.rotation } : { x: 0, y: 0, z: 0 },
        dimensions: {
          width: wc.dimensions.width,
          height: 28,
          depth: wc.dimensions.depth,
        },
        carcass: {
          panelThickness: 18,
          backPanelThickness: 8,
          backPanelType: "none",
          plinthHeight: 0,
          doorPerimeterGap: 2,
          edgeBandThickness: 1,
          bodyMaterialId: doorMat,
          doorMaterialId: doorMat,
          jointType: "dowel_only",
          ledLightingEnabled: true,
          ledColorTempK: 3000,
        },
        bays: [
          {
            index: 0,
            door: { id: `door_${valId}`, bayIndex: 0, type: "open", softClose: false },
            shelves: [],
            hangingRails: [],
            drawers: [],
            specialFittings: [],
          },
        ],
      });
      summaryNotes.push(`${wc.name} altına 28mm gizli ışık bandı & 3000K LED kanal eklendi.`);
    }
  }

  return { addedModules, summaryNotes };
}

/**
 * Automatically notches cabinet carcasses (or steps back depth) around intersecting columns,
 * plumbing stacks, flues, or radiators so installers don't have to improvise jigsaw cuts on site.
 */
export function autoNotchModulesAroundObstacles(project: DesignProject): {
  updatedModules: ModuleInstance[];
  appliedNotches: string[];
} {
  const obstacles = [
    ...(project.space.elements || []),
    ...project.space.walls.flatMap((w) => w.elements || []),
  ].filter((el) =>
    ["column", "beam", "plumbing", "flue_duct", "gas_valve", "electrical", "protrusion"].includes(
      el.type
    )
  );

  const appliedNotches: string[] = [];
  const updatedModules = project.modules.map((mod) => {
    if (mod.category === "complementary") return mod;
    const modMinX = mod.position.x;
    const modMaxX = mod.position.x + mod.dimensions.width;
    const modMinY = mod.position.y;
    const modMaxY = mod.position.y + mod.dimensions.height;
    const modMinZ = mod.position.z;
    const modMaxZ = mod.position.z + mod.dimensions.depth;

    let mutated = false;
    const nextCutouts: PanelCutoutConfig[] = [...(mod.utilityCutouts || [])];

    for (const obs of obstacles) {
      const oMinX = obs.position.x;
      const oMaxX = obs.position.x + obs.dimensions.width;
      const oMinY = obs.position.y;
      const oMaxY = obs.position.y + obs.dimensions.height;
      const oMinZ = obs.position.z;
      const oMaxZ = obs.position.z + obs.dimensions.depth;

      const overlapX = Math.min(modMaxX, oMaxX) - Math.max(modMinX, oMinX);
      const overlapY = Math.min(modMaxY, oMaxY) - Math.max(modMinY, oMinY);
      const overlapZ = Math.min(modMaxZ, oMaxZ) - Math.max(modMinZ, oMinZ);

      if (overlapX <= 2 || overlapY <= 2 || overlapZ <= 2) continue;

      const cutoutId = `auto_notch_${mod.id}_${obs.id}`;
      if (nextCutouts.some((c) => c.id === cutoutId)) continue;

      const relCenterX = Math.max(
        40,
        Math.min(
          mod.dimensions.width - 40,
          Math.round((Math.max(modMinX, oMinX) + Math.min(modMaxX, oMaxX)) / 2 - modMinX)
        )
      );
      const relCenterY = Math.max(
        40,
        Math.min(
          mod.dimensions.height - 40,
          Math.round((Math.max(modMinY, oMinY) + Math.min(modMaxY, oMaxY)) / 2 - modMinY)
        )
      );

      if (obs.type === "electrical" || obs.type === "plumbing" || obs.type === "gas_valve") {
        nextCutouts.push({
          id: cutoutId,
          targetPanel: "back",
          kind: obs.type === "electrical" ? "socket_double" : "plumbing_pass",
          shape: "rect",
          centerXMm: relCenterX,
          centerYMm: relCenterY,
          widthMm: Math.min(mod.dimensions.width - 60, Math.max(80, Math.round(overlapX + 20))),
          heightMm: Math.min(mod.dimensions.height - 60, Math.max(80, Math.round(overlapY + 20))),
          cornerRadiusMm: 8,
          label: `Otomatik ${obs.name} Geçiş Boşluğu`,
        });
        mutated = true;
        appliedNotches.push(`${mod.name}: "${obs.name}" için arka panel CNC geçiş kesimi açıldı.`);
      } else {
        // Column / beam / protrusion -> corner notch on left/right side + back panel
        const onLeftHalf = relCenterX <= mod.dimensions.width * 0.5;
        nextCutouts.push({
          id: cutoutId,
          targetPanel: onLeftHalf ? "left_side" : "right_side",
          kind: "baseboard_notch",
          shape: "corner_notch",
          centerXMm: Math.round(overlapZ / 2),
          centerYMm: relCenterY,
          widthMm: Math.min(mod.dimensions.depth - 120, Math.max(30, Math.round(overlapZ + 5))),
          heightMm: Math.min(mod.dimensions.height, Math.max(60, Math.round(overlapY + 5))),
          label: `Kolon/Kiriş Kertme (${obs.name})`,
        });
        mutated = true;
        appliedNotches.push(
          `${mod.name}: "${obs.name}" (${Math.round(overlapX)}×${Math.round(overlapZ)}mm) etrafına otomatik karkas kertme tanımlandı.`
        );
      }
    }

    if (!mutated) return mod;
    return {
      ...mod,
      utilityCutouts: nextCutouts,
    };
  });

  return { updatedModules, appliedNotches };
}

/**
 * Evaluates NKBA Kitchen Work Triangle (Refrigerator <-> Sink <-> Cooktop) and scene-object
 * clearance / ergonomic constraints across BOTH parametric modules and free `sceneObjects`.
 */
export function evaluateKitchenWorkTriangleAndErgonomics(
  project: DesignProject
): {
  report: WorkTriangleReport;
  issues: ValidationIssue[];
} {
  const sceneObjects = (project.sceneObjects || []).filter((o) => !o.isHidden);
  const issues: ValidationIssue[] = [];
  const ergonomicWarnings: string[] = [];

  const getModCenter = (m: ModuleInstance) => ({
    x: m.position.x + m.dimensions.width / 2,
    y: m.position.y + m.dimensions.height / 2,
    z: m.position.z + m.dimensions.depth / 2,
    id: m.id,
    label: m.name,
  });

  const getObjCenter = (o: SceneObjectInstance) => ({
    x: o.position.x + o.dimensions.width / 2,
    y: o.position.y + o.dimensions.height / 2,
    z: o.position.z + o.dimensions.depth / 2,
    id: o.id,
    label: o.name,
  });

  // Locate Fridge, Sink, and Cooktop from either SceneObjects or Modules
  const fridgeObj = sceneObjects.find((o) => (o.visualKind || "").startsWith("fridge"));
  const fridgeMod = project.modules.find(
    (m) =>
      m.templateId?.includes("fridge") ||
      m.name.toLowerCase().includes("buzdolab") ||
      m.rootCell?.contents?.applianceType === "fridge"
  );
  const fridgePt = fridgeObj ? getObjCenter(fridgeObj) : fridgeMod ? getModCenter(fridgeMod) : null;

  const sinkObj = sceneObjects.find((o) => (o.visualKind || "").startsWith("sink_undermount"));
  const sinkMod = project.modules.find(
    (m) =>
      m.templateId?.includes("sink") ||
      m.name.toLowerCase().includes("eviye") ||
      m.name.toLowerCase().includes("evye") ||
      m.carcass.kitchenTopStretcherMode === "vertical_sink"
  );
  const sinkPt = sinkObj ? getObjCenter(sinkObj) : sinkMod ? getModCenter(sinkMod) : null;

  const hobObj = sceneObjects.find((o) => o.visualKind === "cooktop_induction");
  const hobMod = project.modules.find(
    (m) =>
      m.templateId?.includes("cooktop") ||
      m.templateId?.includes("hob") ||
      m.name.toLowerCase().includes("ocak") ||
      m.bays.some((b) => b.drawers.some((d) => d.hasCooktopHeatShield))
  );
  const hobPt = hobObj ? getObjCenter(hobObj) : hobMod ? getModCenter(hobMod) : null;

  const dist2D = (a: { x: number; z: number }, b: { x: number; z: number }) =>
    Math.round(Math.hypot(a.x - b.x, a.z - b.z));

  const legs: WorkTriangleLegMetric[] = [];
  let perimeterMm = 0;
  let perimeterPassed = true;
  const isComplete = Boolean(fridgePt && sinkPt && hobPt);

  if (fridgePt && sinkPt && hobPt) {
    const dFS = dist2D(fridgePt, sinkPt);
    const dSH = dist2D(sinkPt, hobPt);
    const dHF = dist2D(hobPt, fridgePt);
    perimeterMm = dFS + dSH + dHF;
    perimeterPassed = perimeterMm >= 3600 && perimeterMm <= 7900;

    legs.push(
      {
        fromLabel: "Buzdolabı",
        toLabel: "Eviye",
        distanceMm: dFS,
        passed: dFS >= 1200 && dFS <= 2700,
        idealRangeLabel: "1200–2700 mm",
      },
      {
        fromLabel: "Eviye",
        toLabel: "Ocak",
        distanceMm: dSH,
        passed: dSH >= 1200 && dSH <= 2700,
        idealRangeLabel: "1200–2700 mm",
      },
      {
        fromLabel: "Ocak",
        toLabel: "Buzdolabı",
        distanceMm: dHF,
        passed: dHF >= 1200 && dHF <= 2700,
        idealRangeLabel: "1200–2700 mm",
      }
    );

    if (!perimeterPassed) {
      const msg =
        perimeterMm < 3600
          ? `Mutfak çalışma üçgeni toplam çevresi çok dar (${perimeterMm}mm < 3600mm). Eviye, ocak ve buzdolabı arasına hazırlık tezgâhı bırakın.`
          : `Mutfak çalışma üçgeni toplam çevresi çok geniş (${perimeterMm}mm > 7900mm). Adım mesafesini azaltmak için ada eviyesi veya kule yerleşimini yakınlaştırın.`;
      ergonomicWarnings.push(msg);
      issues.push({
        severity: "warning",
        code: "ERG_WORK_TRIANGLE_PERIMETER",
        message: msg,
        compatibilityStatus: "COMPATIBLE_WITH_CONDITIONS",
      });
    }
  }

  // Check SceneObject clearance envelopes (ceiling ventilation, cooktop-to-tall-unit 300mm rule, walkway)
  const ceilH = project.space.ceilingHeight || 2600;
  for (const obj of sceneObjects) {
    const topVent = obj.clearance?.topVentMm || 0;
    if (obj.position.y + obj.dimensions.height + topVent > ceilH) {
      const msg = `${obj.name}: Üst yüksekliği + havalandırma payı (${
        obj.position.y + obj.dimensions.height + topVent
      }mm) tavan yüksekliğini (${ceilH}mm) aşıyor.`;
      ergonomicWarnings.push(msg);
      issues.push({
        severity: "warning",
        code: "OBJ_CEILING_CLEARANCE",
        message: msg,
        targetId: obj.id,
        compatibilityStatus: "COMPATIBLE_WITH_CONDITIONS",
      });
    }

    // Cooktop proximity to tall cabinet / fridge (<300mm fire & elbow hazard)
    if (obj.visualKind === "cooktop_induction") {
      const tallUnits = project.modules.filter(
        (m) => m.category === "kitchen_tall" || m.category === "wardrobe"
      );
      for (const tu of tallUnits) {
        const horizGap = Math.max(
          tu.position.x - (obj.position.x + obj.dimensions.width),
          obj.position.x - (tu.position.x + tu.dimensions.width)
        );
        const zDiff = Math.abs(tu.position.z - obj.position.z);
        if (zDiff < 400 && horizGap > -50 && horizGap < 300) {
          const msg = `Ergonomi & Yangın Kuralı: "${obj.name}" ile boy dolap "${tu.name}" arasında en az 300mm yan tezgâh mesafesi olmalıdır (Mevcut: ${Math.max(
            0,
            Math.round(horizGap)
          )}mm).`;
          ergonomicWarnings.push(msg);
          issues.push({
            severity: "warning",
            code: "ERG_COOKTOP_TALL_PROXIMITY",
            message: msg,
            targetId: obj.id,
            compatibilityStatus: "COMPATIBLE_WITH_CONDITIONS",
          });
        }
      }
    }
  }

  return {
    report: {
      isComplete,
      perimeterMm,
      perimeterPassed,
      legs,
      ergonomicWarnings,
    },
    issues,
  };
}
