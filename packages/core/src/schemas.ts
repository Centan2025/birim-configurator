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
    "j_pull_bevel",
    "cove_arch",
    "custom_cad_profile",
  ])
  .optional();

export const BackPanelTypeSchema = z.enum(["grooved", "rebated", "nailed", "flush", "none"]);
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
  "miter_45",
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
    isFixed: z.boolean().optional(),
    thickness: z.number().min(4).max(50).optional(),
    frontSetbackMm: z.number().min(0).max(300).optional(),
    pinHoleGroup: z.enum(["single", "triple_32", "five_64", "full_line"]).optional(),
    isGlass: z.boolean().optional(),
    materialId: z.string().optional(),
    isHidden: z.boolean().optional(),
  })
);

export const HangingRailConfigSchema = z.object({
  id: z.string(),
  bayIndex: z.number().int().min(0),
  elevationY: z.number().min(0),
  profileType: z.enum(["oval_30x15", "round_25"]).optional(),
  hasIntegratedLed: z.boolean().optional(),
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
    boxSystemType: z
      .enum([
        "wooden_undermount",
        "metal_box_legrabox",
        "metal_box_tandembox",
        "metal_box_avantech",
        "ball_bearing_side",
      ])
      .optional(),
    boxSideProfileCode: z.enum(["N", "M", "K", "C", "F"]).optional(),
    isInternal: z.boolean().optional(),
    hasSiphonCutout: z.boolean().optional(),
    siphonCutoutWidthMm: z.number().min(40).max(1000).optional(),
    siphonCutoutDepthMm: z.number().min(40).max(800).optional(),
    hasCooktopHeatShield: z.boolean().optional(),
    grainGroupId: z.string().optional(),
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
      "magic_corner",
      "carousel_half_moon",
      "pantry_pullout",
      "waste_bin",
      "spice_pullout",
      "dish_drainer",
      "imove_pull_down",
      "foldable_ironing_board",
      "swivel_mirror",
      "cutlery_tray",
    ]),
    swingDirection: z.enum(["left", "right"]).optional(),
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
  grainGroupId: z.string().optional(),
  bottomOverhangMm: z.number().min(-100).max(100).optional(),
  doorBottomGapMm: z.number().min(0).max(2500).optional(),
  doorTopGapMm: z.number().min(0).max(2500).optional(),
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
  doorFrameConstruction: z.enum(["monoblock_cnc", "five_piece_rail_stile"]).optional(),
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

export const PlinthConstructionTypeSchema = z.enum([
  "pedestal_box",
  "adjustable_legs_clip",
  "gable_rails",
]);

export const SlopedCeilingConfigSchema = z.object({
  mode: z.enum(["none", "back_slope", "left_slope", "right_slope"]),
  kneeHeightMm: z.number().min(100).max(3200),
  slopeAngleDeg: z.number().min(1).max(85),
  topFlatSpanMm: z.number().min(0).max(3600).optional(),
});

export const BaseboardNotchConfigSchema = z.object({
  enabled: z.boolean(),
  depthMm: z.number().min(5).max(150),
  heightMm: z.number().min(10).max(300),
});

export const CarcassConfigSchema = z.object({
  panelThickness: z.number().min(12).max(36).default(18),
  topPanelThicknessMm: z.number().min(12).max(80).optional(),
  crownMolding: z
    .object({
      enabled: z.boolean(),
      style: z.enum(["modern_flat", "stepped", "classic_coving", "led_channel"]),
      heightMm: z.number().min(20).max(200),
      projectionMm: z.number().min(0).max(120),
      materialId: z.string().optional(),
    })
    .optional(),
  backPanelThickness: z.number().min(3).max(19).default(8),
  backPanelType: BackPanelTypeSchema.default("grooved"),
  backOffsetMm: z.number().min(0).max(120).optional(),
  preMillingMm: z.number().min(0).max(3).optional(),
  allowJumboSheet3660: z.boolean().optional(),
  carcassJoineryTopology: z
    .enum(["sides_through", "top_bottom_through", "miter_45", "kitchen_stretchers"])
    .optional(),
  kitchenTopStretcherMode: z
    .enum(["horizontal", "vertical_sink", "aluminum_reinforced"])
    .optional(),
  appliedEndPanelLeft: z.enum(["none", "carcass_height", "floor_to_top"]).optional(),
  appliedEndPanelRight: z.enum(["none", "carcass_height", "floor_to_top"]).optional(),
  baseboardNotch: BaseboardNotchConfigSchema.optional(),
  slopedCeiling: SlopedCeilingConfigSchema.optional(),
  hasPlinthDrawer: z.boolean().optional(),
  hasWaterfallLeft: z.boolean().optional(),
  hasWaterfallRight: z.boolean().optional(),
  countertopJointMode: z.enum(["butt_90", "miter_45", "masons_miter"]).optional(),
  hasCountertopUpstand: z.boolean().optional(),
  hasUnderSinkAluminumTray: z.boolean().optional(),
  islandBackCladding: z.boolean().optional(),
  islandOverhangRearMm: z.number().min(0).max(800).optional(),
  internalDrawerHingeSolution: z.enum(["auto_155_hinge", "spacer_block_25mm"]).optional(),
  wallSuspensionType: z.enum(["visible_bracket", "concealed_camar_807"]).optional(),
  wallAnchored: z.boolean().optional(),
  floorAnchored: z.boolean().optional(),
  useDepthBasedConnectors: z.boolean().optional(),
  plinthHeight: z.number().min(0).max(250).default(80),
  plinthConstruction: PlinthConstructionTypeSchema.optional(),
  plinthSetbackMm: z.number().min(0).max(150).optional(),
  doorPerimeterGap: z.number().min(1).max(10).default(2),
  centerRevealGapMm: z.number().min(1).max(12).optional(),
  edgeBandThickness: z.number().min(0.4).max(3).default(1),
  bodyMaterialId: z.string().default("mat_melamine_white"),
  doorMaterialId: z.string().default("mat_lacquer_cream"),
  countertopMaterialId: z.string().optional(),
  plinthMaterialId: z.string().optional(),
  hasAdjustableLegs: z.boolean().optional(),
  crossSectionProfile: DoorCrossSectionProfileSchema,
  customCadProfileName: z.string().optional(),
  customCadPolygon: z.array(CadPolygonPointSchema).optional(),
  hullShape: z.enum(["rectangular", "capsule_stadium", "capsule_table", "rounded_corners"]).optional(),
  cornerRadiusMm: z.number().min(10).max(2000).optional(),
  tambourSlatPitchMm: z.number().min(12).max(80).optional(),
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
    .enum(["shelf_underside", "vertical_sides", "hanging_rod", "full_showcase", "top_and_shelves"])
    .optional(),
  ledDimmerPct: z.number().min(10).max(100).optional(),
  ledFrontSetbackMm: z.number().min(25).max(350).optional(),
  ledShelfSetbackMm: z.number().min(25).max(350).optional(),
  ledAlignShelfAndSide: z.boolean().optional(),
  ledChannelWidthMm: z.number().min(6).max(35).optional(),
  ledChannelDepthMm: z.number().min(3).max(20).optional(),
  multiHoleMode: z
    .enum(["full_system_32", "zone_32", "cluster_5", "cluster_3", "single_pin", "none"])
    .optional(),
  multiHoleRowCount: z.union([z.literal(2), z.literal(3)]).optional(),
  multiHoleFrontSetbackMm: z.number().min(20).max(150).optional(),
  multiHoleEdgeMarginMm: z.number().min(32).max(256).optional(),
  multiHoleDividerThroughBore: z.boolean().optional(),
  showMultiHolesIn3D: z.boolean().optional(),
  grainContinuityMode: z
    .enum(["none", "module_vertical", "module_4way", "facade_continuous"])
    .optional(),
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
  bays: z.array(BayConfigSchema).default([]),
  rootCell: z.any().optional(),
  carcass: CarcassConfigSchema,
  bodyMaterialId: z.string().optional(),
  doorMaterialId: z.string().optional(),
  isOpenFront: z.boolean().optional(),
  isCorner: z.boolean().optional(),
  cornerAngleDeg: z.number().optional(),
  isFixedWidth: z.boolean().optional(),
  isFreestandingDishwasher: z.boolean().optional(),
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
      "attached_table",
    ])
    .optional(),
  islandCountertopConfig: z
    .object({
      barOverhangMm: z.number().optional(),
      waterfallLeft: z.boolean().optional(),
      waterfallRight: z.boolean().optional(),
      countertopMaterialId: z.string().optional(),
    })
    .optional(),
  attachedTableConfig: z
    .object({
      anchorModuleId: z.string().optional(),
      angleDeg: z.number().optional(),
      legStyle: z.enum(["waterfall_slab", "metal_u_frame", "pedestal_column"]).optional(),
      topThicknessMm: z.number().optional(),
    })
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
    "gas_valve",
    "flue_duct",
    "radiator",
    "baseboard",
    "niche",
    "protrusion",
    "partition",
  ]),
  rotationY: z.number().optional(),
  doorSwing: z.enum(["left", "right"]).optional(),
  sillProtrusionMm: z.number().optional(),
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

export const SpaceCeilingConfigSchema = z.object({
  enabled: z.boolean().default(false),
  ceilingType: z
    .enum([
      "flat_plaster",
      "dropped_perimeter_cove",
      "gypsum_soffit_bulkhead",
      "exposed_wood_beams",
      "coffered_baffle",
      "sloped_attic",
    ])
    .default("flat_plaster"),
  showIn3D: z.boolean().optional(),
  showInElevation2D: z.boolean().optional(),
  translucentCutawayIn3D: z.boolean().optional(),
  dropHeightMm: z.number().min(0).max(1500).optional(),
  soffitDepthMm: z.number().min(100).max(2000).optional(),
  beamHeightMm: z.number().min(30).max(800).optional(),
  beamWidthMm: z.number().min(30).max(500).optional(),
  beamSpacingMm: z.number().min(200).max(3000).optional(),
  bafflePitchMm: z.number().min(40).max(600).optional(),
  hasHiddenLedCove: z.boolean().optional(),
  hasRecessedSpots: z.boolean().optional(),
  slopeKneeHeightMm: z.number().min(400).max(5000).optional(),
  slopeAngleDeg: z.number().min(3).max(75).optional(),
  slopeDirection: z.enum(["left_to_right", "right_to_left", "back_to_front"]).optional(),
  colorHex: z.string().optional(),
});

export const SpaceDefinitionSchema = z.object({
  ceilingConfig: SpaceCeilingConfigSchema.optional(),
  id: z.string(),
  name: z.string(),
  type: SpaceTypeSchema.default("room"),
  walls: z.array(WallDefinitionSchema).default([]),
  ceilingHeight: z.number().positive().default(2600),
  wallSubstrateType: z
    .enum([
      "reinforced_concrete",
      "solid_brick",
      "hollow_brick",
      "aerated_concrete",
      "drywall_reinforced",
      "drywall_unreinforced",
    ])
    .optional(),
  slopedCeiling: SlopedCeilingConfigSchema.optional(),
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


export const SceneObjectInstanceSchema = z.object({
  id: z.string(),
  catalogId: z.string(),
  sku: z.string().default("OBJ-CUSTOM"),
  name: z.string(),
  brand: z.string().optional(),
  category: z.enum([
    "appliance",
    "plumbing_fixture",
    "freestanding_furniture",
    "lighting_electronics",
    "architectural_prop",
    "custom_glb",
  ]),
  anchorMode: z.enum([
    "wall_base",
    "wall_elevated",
    "countertop_cutout",
    "module_cavity",
    "free_floor",
    "surface_raycast",
    "ceiling",
  ]),
  visualKind: z.string(),
  position: Position3DSchema,
  rotation: z.object({
    x: z.number().default(0),
    y: z.number().default(0),
    z: z.number().default(0),
  }),
  dimensions: z.object({
    width: z.number().min(10).max(10000),
    height: z.number().min(5).max(6000),
    depth: z.number().min(10).max(10000),
  }),
  scaleFactor: z.number().positive().optional(),
  primaryColorHex: z.string().optional(),
  secondaryColorHex: z.string().optional(),
  metalness: z.number().min(0).max(1).optional(),
  roughness: z.number().min(0).max(1).optional(),
  glbUrl: z.string().optional(),
  localAssetKey: z.string().optional(),
  hostModuleId: z.string().optional(),
  hostWallId: z.string().optional(),
  commercialRole: z.enum(["quoted_product", "client_supplied", "decor_only"]).default("quoted_product"),
  unitPriceEur: z.number().min(0).default(0),
  quantity: z.number().int().min(1).optional(),
  clearance: z
    .object({
      frontSwingMm: z.number().optional(),
      topVentMm: z.number().optional(),
      rearVentMm: z.number().optional(),
      sideLeftMm: z.number().optional(),
      sideRightMm: z.number().optional(),
      minWalkwayFrontMm: z.number().optional(),
    })
    .optional(),
  cutoutTrigger: z
    .object({
      kind: z.enum(["sink", "cooktop", "cable_port"]),
      cutoutWidthMm: z.number(),
      cutoutDepthMm: z.number(),
      cornerRadiusMm: z.number().optional(),
      requiresUnderSinkSiphonCutout: z.boolean().optional(),
      requiresUnderSinkDripTray: z.boolean().optional(),
      requiresCooktopHeatShield: z.boolean().optional(),
    })
    .optional(),
  mepTriggers: z
    .array(
      z.object({
        discipline: z.enum([
          "plumbing_cold",
          "plumbing_hot",
          "plumbing_drain",
          "elec_appliance",
          "elec_counter",
          "elec_led_driver",
          "hvac_hood_flue",
        ]),
        label: z.string(),
        offsetXFromCenterMm: z.number(),
        elevationFromFloorMm: z.number(),
        diameterOrSpec: z.string(),
        codeNote: z.string(),
      })
    )
    .optional(),
  lightEmission: z
    .object({
      enabled: z.boolean(),
      colorTempK: z.union([z.literal(2700), z.literal(3000), z.literal(4000)]),
      lumens: z.number(),
    })
    .optional(),
  doorSwing: z.enum(["left", "right"]).optional(),
  isLocked: z.boolean().optional(),
  isHidden: z.boolean().optional(),
});

export const CustomModuleTemplateRecordSchema = z.object({
  templateId: z.string(),
  name: z.string(),
  description: z.string().default(""),
  familyId: ModuleFamilyIdSchema.default("fam_wardrobe"),
  category: ModuleCategorySchema,
  createdAt: z.string(),
  baseDimensions: Dimensions3DSchema,
  serializedModuleSnapshot: ModuleInstanceSchema,
});

export const CustomMaterialDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  brand: z.string().optional(),
  decorCode: z.string().optional(),
  surfaceFinish: z.string().optional(),
  category: z.enum(["wood", "lacquer", "laminate", "glass", "stone", "metal", "mirror", "compact"]),
  thickness: z.number().min(4).max(60).default(18),
  densityKgPerM3: z.number().optional(),
  elasticModulusMpa: z.number().positive().optional(),
  mechanicalDataVerified: z.boolean().optional(),
  finish: z.string().optional(),
  colorHex: z.string(),
  roughness: z.number().min(0).max(1),
  metalness: z.number().min(0).max(1),
  textureUrl: z.string().optional(),
  costPerM2: z.number().min(0),
  edgeBandCostPerM: z.number().min(0),
  hasGrain: z.boolean(),
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
  ergonomicProfileId: z
    .enum(["TR_RESIDENTIAL", "EU_EN_STANDARD", "ACCESSIBLE_EN17210"])
    .optional(),
  displayUnit: z.enum(["mm", "cm"]).optional(),
  facadeGrainContinuity: z.boolean().optional(),
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
  sceneObjects: z.array(SceneObjectInstanceSchema).default([]).optional(),
  customModuleTemplates: z.array(CustomModuleTemplateRecordSchema).default([]).optional(),
  customMaterials: z.array(CustomMaterialDefinitionSchema).default([]).optional(),
  continuousLayers: z.any().optional(),
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
):
  | { ok: true; success: true; project: DesignProject; data: DesignProject }
  | { ok: false; success: false; error: string } {
  const preNormalized = migrateProjectPayload(raw);
  const parsed = DesignProjectSchema.safeParse(preNormalized);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return {
      ok: false,
      success: false,
      error: firstIssue
        ? `${firstIssue.path.join(".")}: ${firstIssue.message}`
        : "Geçersiz proje şeması.",
    };
  }
  const migrated = migrateV3ProjectToV4(parsed.data as unknown as DesignProject);
  return { ok: true, success: true, project: migrated, data: migrated };
}
