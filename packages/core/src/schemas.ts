import { z } from "zod";
import { SUPPORTED_PROJECT_SCHEMA_VERSION } from "./types";

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

export const DoorSystemIdSchema = z
  .enum([
    "hinged_single",
    "hinged_double",
    "hinged_inset",
    "hinged_overlay_variant",
    "sliding_top_hung",
    "sliding_bottom_rolling",
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
export const JointTypeSchema = z.enum(["minifix_dowel", "confirmat", "dowel_only", "groove", "rebate"]);
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

export const ShelfConfigSchema = z.object({
  id: z.string(),
  bayIndex: z.number().int().min(0),
  elevationY: z.number().min(0),
  isAdjustable: z.boolean().default(true),
  thickness: z.number().optional(),
});

export const HangingRailConfigSchema = z.object({
  id: z.string(),
  bayIndex: z.number().int().min(0),
  elevationY: z.number().min(0),
  isLiftMechanism: z.boolean().optional(),
});

export const DrawerConfigSchema = z.object({
  id: z.string(),
  bayIndex: z.number().int().min(0),
  elevationY: z.number().min(0),
  height: z.number().min(80).max(600),
  slideType: z
    .enum(["soft_close", "push_to_open", "standard", "push_to_open_soft_close", "servo_electric"])
    .default("soft_close"),
  isInternal: z.boolean().optional(),
  frontMaterialId: z.string().optional(),
  hardwareProductId: z.string().optional(),
  nominalLengthMm: z.number().optional(),
});

export const SpecialFittingConfigSchema = z.object({
  id: z.string(),
  bayIndex: z.number().int().min(0),
  elevationY: z.number().min(0),
  type: z.enum([
    "trouser_rack",
    "shoe_rack",
    "wire_basket",
    "tie_rack",
    "led_profile",
    "wardrobe_lift",
    "jewelry_tray",
    "corner_lemans",
    "pantry_pullout",
    "waste_bin",
    "spice_pullout",
    "cutlery_tray",
  ]),
  height: z.number().min(10).max(2200),
  hardwareProductId: z.string().optional(),
});

export const DoorConfigSchema = z.object({
  id: z.string(),
  bayIndex: z.number().int().min(0),
  type: OpeningDirectionSchema,
  doorSystemId: DoorSystemIdSchema,
  overlayType: DoorOverlayTypeSchema,
  openingTechnology: OpeningTechnologySchema,
  handleCategory: HandleCategorySchema,
  handleProfileId: z.string().optional(),
  hardwareProductId: z.string().optional(),
  doorThicknessMm: z.number().optional(),
  doorMaterialId: z.string().optional(),
  handleType: z.enum(["standard", "integrated_profile", "push_to_open", "none"]).optional(),
  softClose: z.boolean().default(true),
  hingeCount: z.number().int().optional(),
  isGlassFramed: z.boolean().optional(),
});

export const BayConfigSchema = z.object({
  index: z.number().int().min(0),
  widthRatio: z.number().positive().optional(),
  customWidth: z.number().positive().optional(),
  shelves: z.array(ShelfConfigSchema).default([]),
  hangingRails: z.array(HangingRailConfigSchema).default([]),
  drawers: z.array(DrawerConfigSchema).default([]),
  specialFittings: z.array(SpecialFittingConfigSchema).default([]),
  subDividers: z
    .array(
      z.object({
        id: z.string(),
        bayIndex: z.number().int().min(0),
        offsetX: z.number().min(40),
        elevationY: z.number().min(0),
        height: z.number().min(80).max(2600),
        thickness: z.number().optional(),
      })
    )
    .default([])
    .optional(),
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
  jointType: JointTypeSchema.default("minifix_dowel"),
  doorThickness: z.number().min(10).max(36).optional(),
  overlayDistance: z.number().optional(),
  system32FrontSetback: z.number().optional(),
  constructionProfileId: z.string().optional(),
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
});

export const ArchitecturalElementSchema = z.object({
  id: z.string(),
  type: z.enum(["door", "window", "column", "beam", "plumbing", "electrical", "ventilation"]),
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

export const SpaceDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum([
    "room",
    "wardrobe_zone",
    "kitchen_straight",
    "kitchen_l",
    "kitchen_u",
    "kitchen_parallel",
    "kitchen_island",
    "kitchen_peninsula",
  ]),
  walls: z.array(WallDefinitionSchema).default([]),
  ceilingHeight: z.number().positive().default(2600),
  elements: z.array(ArchitecturalElementSchema).default([]),
  floorPlanUnderlay: FloorPlanUnderlaySchema.optional(),
});

export const ProjectVerificationSnapshotSchema = z.object({
  overallStatus: z.enum(["COMPATIBLE", "COMPATIBLE_WITH_CONDITIONS", "INCOMPATIBLE", "UNVERIFIED"]),
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
    .max(SUPPORTED_PROJECT_SCHEMA_VERSION, "Desteklenmeyen ileri şema sürümü (forward-version rejected)")
    .optional(),
  catalogVersion: z.string().optional(),
  revisionId: z.string().optional(),
  libraryVersionId: z.string().optional(),
  constructionProfileId: z.string().optional(),
  title: z.string().min(1),
  customerName: z.string().optional(),
  branchId: z.string().default("branch_main"),
  status: z
    .enum(["draft", "technically_validated", "quoted", "production_approved", "exported_to_erp"])
    .default("draft"),
  space: SpaceDefinitionSchema,
  modules: z.array(ModuleInstanceSchema).min(1, "Proje en az 1 modül içermelidir"),
  verificationSnapshot: ProjectVerificationSnapshotSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
