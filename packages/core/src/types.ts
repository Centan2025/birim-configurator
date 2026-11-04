export type UnitLength = number; // in millimeters (mm)

export type OpeningDirection = "left" | "right" | "double" | "lift" | "sliding" | "none";

export type BackPanelType = "grooved" | "rebated" | "nailed" | "flush";

export type ModuleCategory = "wardrobe" | "kitchen_base" | "kitchen_wall" | "kitchen_tall" | "kitchen_corner";

export interface Dimensions3D {
  width: UnitLength;
  height: UnitLength;
  depth: UnitLength;
}

export interface Position3D {
  x: UnitLength;
  y: UnitLength;
  z: UnitLength;
}

export interface MaterialDefinition {
  id: string;
  name: string;
  category: "wood" | "lacquer" | "laminate" | "glass" | "stone" | "metal";
  thickness: UnitLength; // standard: 18mm, 8mm, etc.
  colorHex: string;
  roughness: number;
  metalness: number;
  textureUrl?: string;
  costPerM2: number; // EUR or TRY per m²
  edgeBandCostPerM: number;
}

export interface HardwareItem {
  id: string;
  name: string;
  sku: string;
  category: "hinge" | "slide" | "handle" | "rod" | "connector" | "leg" | "damper";
  unitPrice: number;
  quantity: number;
  metadata?: Record<string, string | number>;
}

export interface ShelfConfig {
  id: string;
  bayIndex: number;
  elevationY: UnitLength; // offset from inner bottom panel
  isAdjustable: boolean;
  thickness?: UnitLength;
}

export interface HangingRailConfig {
  id: string;
  bayIndex: number;
  elevationY: UnitLength; // offset from inner bottom panel
}

export interface DrawerConfig {
  id: string;
  bayIndex: number;
  elevationY: UnitLength;
  height: UnitLength;
  slideType: "soft_close" | "push_to_open" | "standard";
  frontMaterialId?: string;
}

export interface DoorConfig {
  id: string;
  bayIndex: number;
  type: "single_left" | "single_right" | "double" | "sliding" | "open";
  doorMaterialId?: string;
  handleType?: string;
  softClose: boolean;
  hingeCount?: number;
}

export interface BayConfig {
  index: number;
  widthRatio?: number; // relative ratio (e.g. 1, 1, 1) or fixed width
  customWidth?: UnitLength; // override if fixed
  shelves: ShelfConfig[];
  hangingRails: HangingRailConfig[];
  drawers: DrawerConfig[];
  door: DoorConfig;
}

export interface CarcassConfig {
  panelThickness: UnitLength; // default 18
  backPanelThickness: UnitLength; // default 8
  backPanelType: BackPanelType;
  plinthHeight: UnitLength; // default 80 or 100
  doorPerimeterGap: UnitLength; // default 2
  edgeBandThickness: UnitLength; // default 1
  bodyMaterialId: string;
  doorMaterialId: string;
}

export interface ModuleInstance {
  id: string;
  name: string;
  category: ModuleCategory;
  position: Position3D;
  dimensions: Dimensions3D;
  bays: BayConfig[];
  carcass: CarcassConfig;
  isOpenFront?: boolean;
}

export interface WallDefinition {
  id: string;
  name: string;
  length: UnitLength;
  height: UnitLength;
  thickness: UnitLength;
  position: Position3D;
  rotationY: number; // in radians or degrees
}

export interface SpaceDefinition {
  id: string;
  name: string;
  type: "room" | "wardrobe_zone" | "kitchen_straight" | "kitchen_l" | "kitchen_u";
  walls: WallDefinition[];
  ceilingHeight: UnitLength;
}

export interface DesignProject {
  id: string;
  version: number;
  title: string;
  customerName?: string;
  branchId: string;
  status: "draft" | "quoted" | "confirmed" | "production_ready";
  space: SpaceDefinition;
  modules: ModuleInstance[];
  createdAt: string;
  updatedAt: string;
}

export interface ValidationIssue {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
  targetId?: string;
}
