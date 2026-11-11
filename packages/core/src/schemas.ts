import { z } from "zod";
import { DesignProject, SUPPORTED_PROJECT_SCHEMA_VERSION } from "./types";
import { migrateV3ProjectToV4 } from "./v4-profiles";

export const OpeningDirectionSchema = z.enum([
  "left",
  "right",
  "double",
  "lift",
  "sliding",
  "folding",
  "open",
  "none",
  "single_left",
  "single_right",
  "inset_left",
  "inset_right",
  "inset_double",
  "half_overlay_left",
  "half_overlay_right",
  "sliding_bottom",
  "lift_parallel",
  "lift_bi_fold",
  "lift_up_stay",
  "pocket",
  "tambour",
]);

export const DoorConfigTypeSchema = z.preprocess(
  (val) => {
    if (val === "left") return "single_left";
    if (val === "right") return "single_right";
    if (val === "none") return "open";
    if (val === "lift") return "lift_up_stay";
    return val;
  },
  z.enum([
    "single_left",
    "single_right",
    "double",
    "sliding",
    "folding",
    "open",
    "inset_left",
    "inset_right",
    "inset_double",
    "half_overlay_left",
    "half_overlay_right",
    "sliding_bottom",
    "lift_parallel",
    "lift_bi_fold",
    "lift_up_stay",
    "pocket",
    "tambour",
  ])
);

export const DoorSystemIdSchema = z
  .enum([
    "hinged_single",
    "hinged_double",
    "hinged_inset",
    "hinged_overlay_variant",
    "sliding_top_hung",
    "sliding_bottom_rolling",
    "sliding_coplanar",
    "lift_parallel",
    "lift_bi_fold",
    "lift_up_stay",
    "folding_side",
    "pocket_retractable",
    "tambour_roller",
    "open",
  ])
  .optional();

export const DoorOverlayTypeSchema = z
  .enum(["full_overlay", "half_overlay", "inset"])
  .optional();

export const HandleCategorySchema = z
  .enum([
    "knob",
    "bar_handle",
    "long_profile_handle",
    "edge_profile",
    "recessed_grip",
    "gola_profile",
    "j_pull",
    "milled_wood_grip",
    "decorative_bespoke",
    "handleless_plain",
  ])
  .optional();

export const OpeningTechnologySchema = z
  .enum([
    "manual_standard",
    "soft_close",
    "push_to_open",
    "push_to_open_soft_close",
    "servo_electric",
    "sliding_damped",
    "folding_assisted",
    "lift_counterbalanced",
    "pocket_assisted",
    "drop_down_damped",
  ])
  .optional();

export const DoorCrossSectionProfileSchema = z
  .enum([
    "flat_slab",
    "shaker_frame",
    "fluted_ribbed",
    "glass_frame",
    "mirror_door",
    "bevel_45",
    "custom_cad_profile",
  ])
  .optional();

export const BackPanelTypeSchema = z.enum(["grooved", "rebated", "nailed", "flush"]);
export const ModuleFamilyIdSchema = z
  .enum([
    "fam_kitchen_base",
    "fam_kitchen_wall",
    "fam_kitchen_tall",
    "fam_wardrobe",
    "fam_special_corner",
    "fam_complementary",
  ])
  .optional();

export const ModuleCategorySchema = z.enum([
  "wardrobe",
  "wardrobe_corner",
  "wardrobe_walkin",
  "kitchen_base",
  "kitchen_wall",
  "kitchen_tall",
  "kitchen_corner",
  "kitchen_island",
  "special_corner",
  "complementary",
]);

export const JointTypeSchema = z.enum([
  "minifix_dowel",
  "confirmat",
  "dowel_only",
  "groove",
  "rebate",
]);
export const GrainDirectionSchema = z.enum(["lengthwise", "crosswise", "none"]);

export const Dimensions3DSchema = z.object({
  width: z.number().min(15, "Min width 15mm").max(5000, "Max width 5000mm"),
  height: z.number().min(15, "Min height 15mm").max(3200, "Max height 3200mm"),
  depth: z.number().min(15, "Min depth 15mm").max(1200, "Max depth 1200mm"),
});

export const Position3DSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

export const Rotation3DSchema = z
  .object({
    x: z.number().default(0),
    y: z.number().default(0),
    z: z.number().default(0),
  })
  .optional();

export const CadPolygonPointSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

export const ShelfConfigSchema = z.preprocess(
  (raw) => {
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const rec = raw as Record<string, unknown>;
      if (typeof rec.isAdjustable !== "boolean" && typeof rec.isFixed === "boolean") {
        return { ...rec, isAdjustable: !rec.isFixed };
      }
    }
    return raw;
  },
  z.object({
    id: z.string(),
    bayIndex: z.number().int().min(0),
    elevationY: z.number().min(0),
    isAdjustable: z.boolean().default(true),
    thickness: z.number().min(8).max(50).optional(),
    isHidden: z.boolean().optional(),
  })
);

export const HangingRailConfigSchema = z.object({
  id: z.string(),
  bayIndex: z.number().int().min(0),
  elevationY: z.number().min(0),
  isLiftMechanism: z.boolean().optional(),
  isHidden: z.boolean().optional(),
});

export const DrawerConfigSchema = z.preprocess(
  (raw) => {
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const rec = { ...(raw as Record<string, unknown>) };
      if (!rec.slideType) {
        rec.slideType = rec.softClose === false ? "standard" : "soft_close";
      }
      if (rec.hardwareProductId === "hw_blum_legrabox_c40") {
        rec.hardwareProductId = "hw_blum_legrabox_c70";
      }
      return rec;
    }
    return raw;
  },
  z.object({
    id: z.string(),
    bayIndex: z.number().int().min(0),
    elevationY: z.number().min(0),
    height: z.number().min(60).max(800),
    slideType: z
      .enum([
        "soft_close",
        "push_to_open",
        "standard",
        "push_to_open_soft_close",
        "servo_electric",
      ])
      .default("soft_close"),
    isInternal: z.boolean().optional(),
    frontMaterialId: z.string().optional(),
    hardwareProductId: z.string().optional(),
    nominalLengthMm: z.number().min(200).max(800).optional(),
    isHidden: z.boolean().optional(),
  })
);

export const SpecialFittingConfigSchema = z.preprocess(
  (raw) => {
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const rec = { ...(raw as Record<string, unknown>) };
      if (rec.type === "trouser_pullout") {
        rec.type = "trouser_rack";
      }
      return rec;
    }
    return raw;
  },
  z.object({
    id: z.string(),
    bayIndex: z.number().int().min(0),
    elevationY: z.number().min(0),
    type: z.enum([
      "trouser_rack",
      "shoe_rack",
      "wire_basket",
      "tie_rack",
      "belt_rack",
      "led_profile",
      "led_vertical_strip",
      "led_rod_strip",
      "wardrobe_lift",
      "jewelry_tray",
      "corner_lemans",
      "pantry_pullout",
      "waste_bin",
      "spice_pullout",
      "cutlery_tray",
    ]),
    height: z.number().min(8).max(2800),
    width: z.number().min(8).max(3600).optional(),
    depth: z.number().min(8).max(1200).optional(),
    hardwareProductId: z.string().optional(),
    isHidden: z.boolean().optional(),
  })
);

export const DoorConfigSchema = z.object({
  id: z.string(),
  bayIndex: z.number().int().min(0),
  type: DoorConfigTypeSchema,
  doorSystemId: DoorSystemIdSchema,
  slidingMountingType: z
    .enum(["inset_inside", "top_hung_exposed", "top_hung_pelmet", "coplanar_flush"])
    .optional(),
  overlayType: DoorOverlayTypeSchema,
  openingTechnology: OpeningTechnologySchema,
  handleCategory: HandleCategorySchema,
  handleProfileId: z.string().optional(),
  hardwareProductId: z.string().optional(),
  doorThicknessMm: z.number().min(8).max(40).optional(),
  doorMaterialId: z.string().optional(),
  handleType: z.enum(["standard", "integrated_profile", "push_to_open", "none"]).optional(),
  softClose: z.boolean().default(true),
  hingeCount: z.number().int().min(0).max(8).optional(),
  hingeBottomOffsetMm: z.number().min(40).max(500).optional(),
  hingeTopOffsetMm: z.number().min(40).max(500).optional(),
  isGlassFramed: z.boolean().optional(),
  crossSectionProfile: DoorCrossSectionProfileSchema,
  customCadProfileName: z.string().optional(),
  customCadPolygon: z.array(CadPolygonPointSchema).optional(),
  handleOrientation: z.enum(["auto", "vertical", "horizontal"]).optional(),
  handleOffsetY: z.number().optional(),
  handleEdgeInsetX: z.number().optional(),
  handleLengthMm: z.number().min(20).max(2800).optional(),
  handleMaterialId: z.string().optional(),
  doorEdgeBandThicknessMm: z.number().min(0.4).max(3).optional(),
});

export const SubDividerConfigSchema = z.object({
  id: z.string(),
  bayIndex: z.number().int().min(0),
  offsetX: z.number().min(30),
  elevationY: z.number().min(0),
  height: z.number().min(60).max(2800),
  thickness: z.number().min(8).max(36).optional(),
  isHidden: z.boolean().optional(),
});

export const BayConfigSchema = z.object({
  index: z.number().int().min(0),
  widthRatio: z.number().positive().optional(),
  customWidth: z.number().positive().optional(),
  shelves: z.array(ShelfConfigSchema).default([]),
  hangingRails: z.array(HangingRailConfigSchema).default([]),
  drawers: z.array(DrawerConfigSchema).default([]),
  specialFittings: z.array(SpecialFittingConfigSchema).default([]),
  subDividers: z.array(SubDividerConfigSchema).default([]).optional(),
  door: DoorConfigSchema,
});

export const CarcassConfigSchema = z.object({
  panelThickness: z.number().min(12).max(36).default(18),
  backPanelThickness: z.number().min(3).max(19).default(8),
  backPanelType: BackPanelTypeSchema.default("grooved"),
  plinthHeight: z.number().min(0).max(250).default(80),
  doorPerimeterGap: z.number().min(1).max(10).default(2),
  edgeBandThickness: z.number().min(0.4).max(3).default(1),
  bodyMaterialId: z.string().default("mat_melamine_white"),
  doorMaterialId: z.string().default("mat_lacquer_cream"),
  countertopMaterialId: z.string().optional(),
  plinthMaterialId: z.string().optional(),
  hasAdjustableLegs: z.boolean().optional(),
  crossSectionProfile: DoorCrossSectionProfileSchema,
  customCadProfileName: z.string().optional(),
  customCadPolygon: z.array(CadPolygonPointSchema).optional(),
  jointType: JointTypeSchema.default("minifix_dowel"),
  doorThickness: z.number().min(10).max(36).optional(),
  overlayDistance: z.number().optional(),
  system32FrontSetback: z.number().optional(),
  constructionProfileId: z.string().optional(),
  hingeDrillingTemplateId: z.string().optional(),
  drawerDrillingSetId: z.string().optional(),
  cncProductionNote: z.string().optional(),
  ledLightingEnabled: z.boolean().optional(),
  ledColorTempK: z.union([z.literal(2700), z.literal(3000), z.literal(4000)]).optional(),
  ledSensorType: z.enum(["ir_door", "pir_motion", "manual_switch"]).optional(),
  ledPlacementMode: z
    .enum(["shelf_underside", "vertical_sides", "hanging_rod", "full_showcase"])
    .optional(),
  ledDimmerPct: z.number().min(10).max(100).optional(),
  ledFrontSetbackMm: z.number().min(25).max(350).optional(),
  ledShelfSetbackMm: z.number().min(25).max(350).optional(),
  ledAlignShelfAndSide: z.boolean().optional(),
  ledChannelWidthMm: z.number().min(6).max(35).optional(),
  ledChannelDepthMm: z.number().min(3).max(20).optional(),
});

export const ModuleInstanceSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: ModuleCategorySchema,
  moduleFamilyId: ModuleFamilyIdSchema,
  templateId: z.string().optional(),
  position: Position3DSchema,
  rotation: Rotation3DSchema,
  dimensions: Dimensions3DSchema,
  bays: z.array(BayConfigSchema).min(1, "Modül en az 1 bölme içermelidir"),
  carcass: CarcassConfigSchema,
  isOpenFront: z.boolean().optional(),
  isCorner: z.boolean().optional(),
  cornerAngleDeg: z.number().optional(),
  isFixedWidth: z.boolean().optional(),
  complementaryRole: z
    .enum([
      "plinth_strip",
      "leveling_feet",
      "skirting",
      "wall_filler",
      "end_panel",
      "top_infill",
      "fascia_panel",
      "back_cladding",
      "countertop",
      "waterfall_edge",
      "backsplash",
      "crown_molding",
      "led_channel",
      "wall_bracket",
      "service_spacer",
    ])
    .optional(),
  requiresFactoryValidation: z.boolean().optional(),
  componentMaterialOverrides: z.record(z.string()).optional(),
  componentGrainOverrides: z
    .record(z.enum(["lengthwise", "crosswise", "custom"]))
    .optional(),
  surfaceFinishOverride: z.enum(["matte", "satin", "gloss"]).optional(),
  edgeBandMaterialId: z.string().optional(),
  utilityCutouts: z
    .array(
      z.object({
        id: z.string(),
        targetPanel: z.enum(["back", "left_side", "right_side", "bottom"]),
        kind: z.enum([
          "socket_single",
          "socket_double",
          "junction_box",
          "cable_grommet",
          "plumbing_pass",
          "baseboard_notch",
        ]),
        shape: z.enum(["rect", "circle", "corner_notch"]),
        centerXMm: z.number(),
        centerYMm: z.number(),
        widthMm: z.number().min(8).max(2000),
        heightMm: z.number().min(8).max(2000),
        diameterMm: z.number().min(8).max(1000).optional(),
        cornerRadiusMm: z.number().min(0).max(200).optional(),
        label: z.string(),
      })
    )
    .optional(),
});

export const ArchitecturalElementSchema = z.object({
  id: z.string(),
  type: z.enum([
    "door",
    "window",
    "column",
    "beam",
    "plumbing",
    "electrical",
    "ventilation",
    "niche",
    "protrusion",
    "partition",
  ]),
  rotationY: z.number().optional(),
  doorSwing: z.enum(["left", "right"]).optional(),
  name: z.string(),
  position: Position3DSchema,
  dimensions: Dimensions3DSchema,
  metadata: z.record(z.union([z.string(), z.number()])).optional(),
});

export const WallDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  length: z.number().positive(),
  height: z.number().positive(),
  thickness: z.number().positive(),
  position: Position3DSchema,
  rotationY: z.number().default(0),
  wallType: z.enum(["standard", "concrete", "drywall", "niche_wall"]).optional(),
  elements: z.array(ArchitecturalElementSchema).default([]),
});

export const FloorPlanPolylineSchema = z.object({
  points: z.array(z.object({ x: z.number(), z: z.number() })),
  layer: z.string().optional(),
});

export const FloorPlanUnderlaySchema = z.object({
  fileName: z.string(),
  fileType: z.enum(["dxf", "dwg", "pdf", "svg", "image"]),
  scaleMmPerUnit: z.number().positive().default(1),
  widthMm: z.number().positive(),
  depthMm: z.number().positive(),
  offsetXMm: z.number().default(0),
  offsetZMm: z.number().default(0),
  opacity: z.number().min(0.05).max(1).default(0.75),
  dataUrl: z.string().optional(),
  polylines: z.array(FloorPlanPolylineSchema).optional(),
});

export const SpaceTypeSchema = z.preprocess(
  (val) => {
    if (val === "kitchen_linear") return "kitchen_straight";
    if (val === "wardrobe" || val === "walkin") return "wardrobe_zone";
    if (val === "living") return "room";
    return val;
  },
  z.enum([
    "room",
    "wardrobe_zone",
    "kitchen_straight",
    "kitchen_l",
    "kitchen_u",
    "kitchen_parallel",
    "kitchen_island",
    "kitchen_peninsula",
  ])
);

export const SpaceDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: SpaceTypeSchema.default("room"),
  walls: z.array(WallDefinitionSchema).default([]),
  ceilingHeight: z.number().positive().default(2600),
  elements: z.array(ArchitecturalElementSchema).default([]),
  floorPlanUnderlay: FloorPlanUnderlaySchema.optional(),
});

export const ProjectVerificationSnapshotSchema = z.object({
  overallStatus: z.enum([
    "COMPATIBLE",
    "COMPATIBLE_WITH_CONDITIONS",
    "INCOMPATIBLE",
    "UNVERIFIED",
  ]),
  canApproveProduction: z.boolean(),
  unverifiedCount: z.number().int().min(0),
  evaluatedAt: z.string(),
});

export const DesignProjectSchema = z.object({
  id: z.string(),
  version: z.number().int().positive().default(1),
  schemaVersion: z
    .number()
    .int()
    .min(1, "Geçersiz şema sürümü")
    .max(
      SUPPORTED_PROJECT_SCHEMA_VERSION,
      "Desteklenmeyen ileri şema sürümü (forward-version rejected)"
    )
    .optional(),
  catalogVersion: z.string().optional(),
  revisionId: z.string().optional(),
  libraryVersionId: z.string().optional(),
  constructionProfileId: z.string().optional(),
  title: z.string().min(1),
  customerName: z.string().optional(),
  branchId: z.string().default("branch_main"),
  status: z
    .enum([
      "draft",
      "technically_validated",
      "quoted",
      "production_approved",
      "exported_to_erp",
    ])
    .default("draft"),
  space: SpaceDefinitionSchema,
  modules: z.array(ModuleInstanceSchema).min(1, "Proje en az 1 modül içermelidir"),
  verificationSnapshot: ProjectVerificationSnapshotSchema.optional(),
  createdAt: z.string().default(() => new Date().toISOString()),
  updatedAt: z.string().default(() => new Date().toISOString()),
});

/**
 * Normalizes legacy V1/V2/V3/V4 payloads prior to strict schema parsing so older saved JSONs
 * never crash when newly added fields or renamed enum values are encountered.
 */
export function migrateProjectPayload(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const obj = { ...(raw as Record<string, unknown>) };
  const nowIso = new Date().toISOString();

  if (typeof obj.id !== "string" || !obj.id.trim()) {
    obj.id = `proj_${Date.now()}`;
  }
  if (typeof obj.title !== "string" || !obj.title.trim()) {
    obj.title = "Birim Tasarım Projesi";
  }
  if (typeof obj.branchId !== "string" || !obj.branchId.trim()) {
    obj.branchId = "branch_main";
  }
  if (typeof obj.createdAt !== "string") {
    obj.createdAt = nowIso;
  }
  if (typeof obj.updatedAt !== "string") {
    obj.updatedAt = nowIso;
  }
  if (!obj.space || typeof obj.space !== "object") {
    obj.space = {
      id: "space_default",
      name: "Ana Mekân",
      type: "room",
      walls: [],
      ceilingHeight: 2600,
      elements: [],
    };
  }
  return obj;
}

/**
 * Validates and migrates any JSON project object into a canonical V4 DesignProject.
 */
export function parseAndMigrateProject(
  raw: unknown
): { ok: true; project: DesignProject } | { ok: false; error: string } {
  const preNormalized = migrateProjectPayload(raw);
  const parsed = DesignProjectSchema.safeParse(preNormalized);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return {
      ok: false,
      error: firstIssue
        ? `${firstIssue.path.join(".")}: ${firstIssue.message}`
        : "Geçersiz proje şeması.",
    };
  }
  const migrated = migrateV3ProjectToV4(parsed.data as DesignProject);
  return { ok: true, project: migrated };
}
