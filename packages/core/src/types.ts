export type UnitLength = number; // in millimeters (mm)

export type OpeningDirection = "left" | "right" | "double" | "lift" | "sliding" | "folding" | "open" | "none";

export type BackPanelType = "grooved" | "rebated" | "nailed" | "flush";

export type ModuleCategory =
  | "wardrobe"
  | "wardrobe_corner"
  | "wardrobe_walkin"
  | "kitchen_base"
  | "kitchen_wall"
  | "kitchen_tall"
  | "kitchen_corner"
  | "kitchen_island";

export type JointType = "minifix_dowel" | "confirmat" | "dowel_only" | "groove" | "rebate";

export type GrainDirection = "lengthwise" | "crosswise" | "none";

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

export interface Rotation3D {
  x: number; // degrees
  y: number; // degrees
  z: number; // degrees
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
  costPerM2: number; // EUR per m²
  edgeBandCostPerM: number;
  hasGrain: boolean;
}

export interface EdgeBandingSpec {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
  thickness: UnitLength; // e.g. 1mm or 2mm ABS
  colorMatchId?: string;
}

export interface DrillingHole {
  id: string;
  diameter: UnitLength; // e.g. 5, 8, 15, 35 mm
  depth: UnitLength; // e.g. 12.5, 13.5, 30 mm
  x: UnitLength; // coordinate on the piece's coordinate system
  y: UnitLength;
  z: UnitLength; // surface face: 0 for front, thickness for back, or edge
  direction: "face_front" | "face_back" | "edge_top" | "edge_bottom" | "edge_left" | "edge_right";
  purpose: "minifix_cam" | "minifix_bolt" | "dowel" | "hinge_cup" | "hinge_mount" | "shelf_pin" | "slide_mount" | "handle";
}

export interface ParametricPart {
  id: string; // Deterministic stable ID (e.g. "P_mod1_side_left")
  moduleId: string;
  bayIndex?: number;
  label: string;
  role: string;
  dimensions: Dimensions3D; // width, height, thickness (net dimensions)
  materialId: string;
  grain: GrainDirection;
  edgeBanding: EdgeBandingSpec;
  jointType: JointType;
  holes: DrillingHole[];
  position: Position3D; // Global or module-relative position
  rotation?: [number, number, number];
  isFrontFacing?: boolean;
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
  elevationY: UnitLength;
  isLiftMechanism?: boolean; // Pull-down wardrobe lift
}

export interface DrawerConfig {
  id: string;
  bayIndex: number;
  elevationY: UnitLength;
  height: UnitLength;
  slideType: "soft_close" | "push_to_open" | "standard";
  isInternal?: boolean; // İç çekmece (behind door)
  frontMaterialId?: string;
}

export interface SpecialFittingConfig {
  id: string;
  bayIndex: number;
  elevationY: UnitLength;
  type: "trouser_rack" | "shoe_rack" | "wire_basket" | "tie_rack" | "led_profile";
  height: UnitLength;
}

export interface DoorConfig {
  id: string;
  bayIndex: number;
  type: "single_left" | "single_right" | "double" | "sliding" | "folding" | "open";
  doorMaterialId?: string;
  handleType?: "standard" | "integrated_profile" | "push_to_open" | "none";
  softClose: boolean;
  hingeCount?: number;
  isGlassFramed?: boolean;
}

export interface BayConfig {
  index: number;
  widthRatio?: number;
  customWidth?: UnitLength;
  shelves: ShelfConfig[];
  hangingRails: HangingRailConfig[];
  drawers: DrawerConfig[];
  specialFittings: SpecialFittingConfig[];
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
  jointType: JointType;
}

export interface ModuleInstance {
  id: string;
  name: string;
  category: ModuleCategory;
  position: Position3D;
  rotation?: Rotation3D;
  dimensions: Dimensions3D;
  bays: BayConfig[];
  carcass: CarcassConfig;
  isOpenFront?: boolean;
  isCorner?: boolean;
  cornerAngleDeg?: number; // 90 for standard L-corner
}

export interface ArchitecturalElement {
  id: string;
  type: "door" | "window" | "column" | "beam" | "plumbing" | "electrical" | "ventilation";
  name: string;
  position: Position3D;
  dimensions: Dimensions3D;
  metadata?: Record<string, string | number>;
}

export interface WallDefinition {
  id: string;
  name: string;
  length: UnitLength;
  height: UnitLength;
  thickness: UnitLength;
  position: Position3D;
  rotationY: number; // degrees
  elements: ArchitecturalElement[];
}

export interface SpaceDefinition {
  id: string;
  name: string;
  type: "room" | "wardrobe_zone" | "kitchen_straight" | "kitchen_l" | "kitchen_u" | "kitchen_parallel" | "kitchen_island";
  walls: WallDefinition[];
  ceilingHeight: UnitLength;
  elements: ArchitecturalElement[];
}

export interface DesignProject {
  id: string;
  version: number;
  title: string;
  customerName?: string;
  branchId: string;
  status: "draft" | "technically_validated" | "quoted" | "production_approved" | "exported_to_erp";
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
  blockingProduction?: boolean;
}
