export type UnitLength = number; // in millimeters (mm)

export type OpeningDirection =
  | "left"
  | "right"
  | "double"
  | "lift"
  | "sliding"
  | "folding"
  | "open"
  | "none"
  | "single_left"
  | "single_right"
  | "inset_left"
  | "inset_right"
  | "inset_double"
  | "half_overlay_left"
  | "half_overlay_right"
  | "sliding_bottom"
  | "lift_parallel"
  | "lift_bi_fold"
  | "lift_up_stay"
  | "pocket"
  | "tambour";

export type DoorSystemId =
  | "hinged_single"
  | "hinged_double"
  | "hinged_inset"
  | "hinged_overlay_variant"
  | "sliding_top_hung"
  | "sliding_bottom_rolling"
  | "lift_parallel"
  | "lift_bi_fold"
  | "lift_up_stay"
  | "folding_side"
  | "pocket_retractable"
  | "tambour_roller"
  | "open";

export type DoorOverlayType = "full_overlay" | "half_overlay" | "inset";

export type HandleCategory =
  | "knob"
  | "bar_handle"
  | "long_profile_handle"
  | "edge_profile"
  | "recessed_grip"
  | "gola_profile"
  | "j_pull"
  | "milled_wood_grip"
  | "decorative_bespoke"
  | "handleless_plain";

export type OpeningTechnology =
  | "manual_standard"
  | "soft_close"
  | "push_to_open"
  | "push_to_open_soft_close"
  | "servo_electric"
  | "sliding_damped"
  | "folding_assisted"
  | "lift_counterbalanced"
  | "pocket_assisted"
  | "drop_down_damped";

export type BackPanelType = "grooved" | "rebated" | "nailed" | "flush";

export type ModuleFamilyId =
  | "fam_kitchen_base"
  | "fam_kitchen_wall"
  | "fam_kitchen_tall"
  | "fam_wardrobe"
  | "fam_special_corner"
  | "fam_complementary";

export type ModuleCategory =
  | "wardrobe"
  | "wardrobe_corner"
  | "wardrobe_walkin"
  | "kitchen_base"
  | "kitchen_wall"
  | "kitchen_tall"
  | "kitchen_corner"
  | "kitchen_island"
  | "special_corner"
  | "complementary";

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
  category: "wood" | "lacquer" | "laminate" | "glass" | "stone" | "metal" | "mirror" | "compact";
  thickness: UnitLength; // standard: 18mm, 8mm, etc.
  densityKgPerM3?: number; // default: 650 laminate, 750 lacquer/MDF, 920 glass
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
  hardwareRefId?: string;
  handleSpacingMm?: UnitLength;
  isInsetDoor?: boolean;
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
  slideType: "soft_close" | "push_to_open" | "standard" | "push_to_open_soft_close" | "servo_electric";
  isInternal?: boolean; // İç çekmece (behind door)
  frontMaterialId?: string;
  hardwareProductId?: string;
  nominalLengthMm?: UnitLength;
}

export interface SpecialFittingConfig {
  id: string;
  bayIndex: number;
  elevationY: UnitLength;
  type:
    | "trouser_rack"
    | "shoe_rack"
    | "wire_basket"
    | "tie_rack"
    | "led_profile"
    | "wardrobe_lift"
    | "jewelry_tray"
    | "corner_lemans"
    | "pantry_pullout"
    | "waste_bin"
    | "spice_pullout"
    | "cutlery_tray";
  height: UnitLength;
  hardwareProductId?: string;
}

export interface DoorConfig {
  id: string;
  bayIndex: number;
  type:
    | "single_left"
    | "single_right"
    | "double"
    | "sliding"
    | "folding"
    | "open"
    | "inset_left"
    | "inset_right"
    | "inset_double"
    | "half_overlay_left"
    | "half_overlay_right"
    | "sliding_bottom"
    | "lift_parallel"
    | "lift_bi_fold"
    | "lift_up_stay"
    | "pocket"
    | "tambour";
  doorSystemId?: DoorSystemId;
  overlayType?: DoorOverlayType;
  openingTechnology?: OpeningTechnology;
  handleCategory?: HandleCategory;
  handleProfileId?: string;
  hardwareProductId?: string;
  doorThicknessMm?: UnitLength;
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
  subDividers?: {
    id: string;
    bayIndex: number;
    offsetX: UnitLength;
    elevationY: UnitLength;
    height: UnitLength;
    thickness?: UnitLength;
  }[];
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
  doorThickness?: UnitLength; // default 18
  overlayDistance?: UnitLength;
  system32FrontSetback?: UnitLength; // default 37
  constructionProfileId?: string;
}

export interface ModuleInstance {
  id: string;
  name: string;
  category: ModuleCategory;
  moduleFamilyId?: ModuleFamilyId;
  templateId?: string;
  position: Position3D;
  rotation?: Rotation3D;
  dimensions: Dimensions3D;
  bays: BayConfig[];
  carcass: CarcassConfig;
  isOpenFront?: boolean;
  isCorner?: boolean;
  cornerAngleDeg?: number; // 90 for standard L-corner
  isFixedWidth?: boolean;
  complementaryRole?:
    | "plinth_strip"
    | "leveling_feet"
    | "skirting"
    | "wall_filler"
    | "end_panel"
    | "top_infill"
    | "fascia_panel"
    | "back_cladding"
    | "countertop"
    | "waterfall_edge"
    | "backsplash"
    | "crown_molding"
    | "led_channel"
    | "wall_bracket"
    | "service_spacer";
  requiresFactoryValidation?: boolean;
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

export interface FloorPlanPolyline {
  points: { x: UnitLength; z: UnitLength }[];
  layer?: string;
}

export interface FloorPlanUnderlay {
  fileName: string;
  fileType: "dxf" | "dwg" | "pdf" | "svg" | "image";
  scaleMmPerUnit: number;
  widthMm: UnitLength;
  depthMm: UnitLength;
  offsetXMm: UnitLength;
  offsetZMm: UnitLength;
  opacity: number;
  dataUrl?: string;
  polylines?: FloorPlanPolyline[];
}

export interface SpaceDefinition {
  id: string;
  name: string;
  type:
    | "room"
    | "wardrobe_zone"
    | "kitchen_straight"
    | "kitchen_l"
    | "kitchen_u"
    | "kitchen_parallel"
    | "kitchen_island"
    | "kitchen_peninsula";
  walls: WallDefinition[];
  ceilingHeight: UnitLength;
  elements: ArchitecturalElement[];
  floorPlanUnderlay?: FloorPlanUnderlay;
}

export const SUPPORTED_PROJECT_SCHEMA_VERSION = 4;

export interface ProjectVerificationSnapshot {
  overallStatus: CompatibilityStatus;
  canApproveProduction: boolean;
  unverifiedCount: number;
  evaluatedAt: string;
}

export interface DesignProject {
  id: string;
  version: number;
  schemaVersion?: number;
  catalogVersion?: string;
  revisionId?: string;
  libraryVersionId?: string;
  constructionProfileId?: string;
  title: string;
  customerName?: string;
  branchId: string;
  status: "draft" | "technically_validated" | "quoted" | "production_approved" | "exported_to_erp";
  space: SpaceDefinition;
  modules: ModuleInstance[];
  verificationSnapshot?: ProjectVerificationSnapshot;
  createdAt: string;
  updatedAt: string;
}

export type CompatibilityStatus =
  | "COMPATIBLE"
  | "COMPATIBLE_WITH_CONDITIONS"
  | "INCOMPATIBLE"
  | "UNVERIFIED";

export interface ValidationIssue {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
  targetId?: string;
  blockingProduction?: boolean;
  compatibilityStatus?: CompatibilityStatus;
  categoryIndex?: number;
  suggestions?: string[];
  sourceId?: string;
}
