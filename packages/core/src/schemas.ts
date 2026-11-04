import { z } from "zod";

export const OpeningDirectionSchema = z.enum(["left", "right", "double", "lift", "sliding", "folding", "open", "none"]);
export const BackPanelTypeSchema = z.enum(["grooved", "rebated", "nailed", "flush"]);
export const ModuleCategorySchema = z.enum([
  "wardrobe",
  "wardrobe_corner",
  "wardrobe_walkin",
  "kitchen_base",
  "kitchen_wall",
  "kitchen_tall",
  "kitchen_corner",
  "kitchen_island",
]);
export const JointTypeSchema = z.enum(["minifix_dowel", "confirmat", "dowel_only", "groove", "rebate"]);
export const GrainDirectionSchema = z.enum(["lengthwise", "crosswise", "none"]);

export const Dimensions3DSchema = z.object({
  width: z.number().min(150, "Min width 150mm").max(5000, "Max width 5000mm"),
  height: z.number().min(200, "Min height 200mm").max(3200, "Max height 3200mm"),
  depth: z.number().min(150, "Min depth 150mm").max(1200, "Max depth 1200mm"),
});

export const Position3DSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

export const Rotation3DSchema = z.object({
  x: z.number().default(0),
  y: z.number().default(0),
  z: z.number().default(0),
}).optional();

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
  slideType: z.enum(["soft_close", "push_to_open", "standard"]).default("soft_close"),
  isInternal: z.boolean().optional(),
  frontMaterialId: z.string().optional(),
});

export const SpecialFittingConfigSchema = z.object({
  id: z.string(),
  bayIndex: z.number().int().min(0),
  elevationY: z.number().min(0),
  type: z.enum(["trouser_rack", "shoe_rack", "wire_basket", "tie_rack", "led_profile"]),
  height: z.number().min(20).max(400),
});

export const DoorConfigSchema = z.object({
  id: z.string(),
  bayIndex: z.number().int().min(0),
  type: OpeningDirectionSchema,
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
});

export const ModuleInstanceSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: ModuleCategorySchema,
  position: Position3DSchema,
  rotation: Rotation3DSchema,
  dimensions: Dimensions3DSchema,
  bays: z.array(BayConfigSchema).min(1, "Modül en az 1 bölme içermelidir"),
  carcass: CarcassConfigSchema,
  isOpenFront: z.boolean().optional(),
  isCorner: z.boolean().optional(),
  cornerAngleDeg: z.number().optional(),
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

export const SpaceDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["room", "wardrobe_zone", "kitchen_straight", "kitchen_l", "kitchen_u", "kitchen_parallel", "kitchen_island"]),
  walls: z.array(WallDefinitionSchema).default([]),
  ceilingHeight: z.number().positive().default(2600),
  elements: z.array(ArchitecturalElementSchema).default([]),
});

export const DesignProjectSchema = z.object({
  id: z.string(),
  version: z.number().int().positive().default(1),
  title: z.string().min(1),
  customerName: z.string().optional(),
  branchId: z.string().default("branch_main"),
  status: z.enum(["draft", "technically_validated", "quoted", "production_approved", "exported_to_erp"]).default("draft"),
  space: SpaceDefinitionSchema,
  modules: z.array(ModuleInstanceSchema).min(1, "Proje en az 1 modül içermelidir"),
  createdAt: z.string(),
  updatedAt: z.string(),
});
