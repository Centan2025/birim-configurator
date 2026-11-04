import { z } from "zod";

export const OpeningDirectionSchema = z.enum(["left", "right", "double", "lift", "sliding", "none"]);
export const BackPanelTypeSchema = z.enum(["grooved", "rebated", "nailed", "flush"]);
export const ModuleCategorySchema = z.enum(["wardrobe", "kitchen_base", "kitchen_wall", "kitchen_tall", "kitchen_corner"]);

export const Dimensions3DSchema = z.object({
  width: z.number().min(200, "Min width 200mm").max(5000, "Max width 5000mm"),
  height: z.number().min(300, "Min height 300mm").max(3200, "Max height 3200mm"),
  depth: z.number().min(150, "Min depth 150mm").max(1200, "Max depth 1200mm"),
});

export const Position3DSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

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
});

export const DrawerConfigSchema = z.object({
  id: z.string(),
  bayIndex: z.number().int().min(0),
  elevationY: z.number().min(0),
  height: z.number().min(80).max(600),
  slideType: z.enum(["soft_close", "push_to_open", "standard"]).default("soft_close"),
  frontMaterialId: z.string().optional(),
});

export const DoorConfigSchema = z.object({
  id: z.string(),
  bayIndex: z.number().int().min(0),
  type: z.enum(["single_left", "single_right", "double", "sliding", "open"]),
  doorMaterialId: z.string().optional(),
  handleType: z.string().optional(),
  softClose: z.boolean().default(true),
  hingeCount: z.number().int().optional(),
});

export const BayConfigSchema = z.object({
  index: z.number().int().min(0),
  widthRatio: z.number().positive().optional(),
  customWidth: z.number().positive().optional(),
  shelves: z.array(ShelfConfigSchema).default([]),
  hangingRails: z.array(HangingRailConfigSchema).default([]),
  drawers: z.array(DrawerConfigSchema).default([]),
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
});

export const ModuleInstanceSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: ModuleCategorySchema,
  position: Position3DSchema,
  dimensions: Dimensions3DSchema,
  bays: z.array(BayConfigSchema).min(1, "Module must have at least 1 bay"),
  carcass: CarcassConfigSchema,
  isOpenFront: z.boolean().optional(),
});

export const DesignProjectSchema = z.object({
  id: z.string(),
  version: z.number().int().positive().default(1),
  title: z.string().min(1),
  customerName: z.string().optional(),
  branchId: z.string().default("branch_main"),
  status: z.enum(["draft", "quoted", "confirmed", "production_ready"]).default("draft"),
  space: z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(["room", "wardrobe_zone", "kitchen_straight", "kitchen_l", "kitchen_u"]),
    walls: z.array(z.any()).default([]),
    ceilingHeight: z.number().positive().default(2600),
  }),
  modules: z.array(ModuleInstanceSchema).min(1, "Project must contain at least one module"),
  createdAt: z.string(),
  updatedAt: z.string(),
});
