import { UnitLength, Position3D, Dimensions3D } from "@birim/core";

export type ComponentRole =
  | "carcass_side_left"
  | "carcass_side_right"
  | "carcass_bottom"
  | "carcass_top"
  | "carcass_divider"
  | "carcass_sub_divider"
  | "carcass_back"
  | "end_panel"
  | "plinth"
  | "shelf"
  | "hanging_rail"
  | "special_fitting"
  | "drawer_front"
  | "drawer_box"
  | "drawer_bottom"
  | "drawer_side_left"
  | "drawer_side_right"
  | "drawer_back"
  | "door_handle"
  | "door_hinge"
  | "gola_profile"
  | "drawer_handle"
  | "drawer_slide"
  | "door_left"
  | "door_right"
  | "door_stile_left"
  | "door_stile_right"
  | "door_rail_top"
  | "door_rail_bottom"
  | "door_center_panel"
  | "kerf_curve"
  | "countertop";

export type PanelThicknessAxis = "x" | "y" | "z";

export interface ComponentGeometry {
  id: string;
  role: ComponentRole;
  label: string;
  bayIndex?: number;
  dimensions: Dimensions3D; // width (dx), height (dy), depth (dz) in mm
  position: Position3D; // local position relative to module origin (bottom-left-rear = 0,0,0) in mm
  rotation?: [number, number, number]; // Euler XYZ in radians
  pivot?: Position3D; // module-space pivot in mm; position remains the closed local box origin
  primitive?: "box" | "sphere" | "cylinder";
  parentComponentId?: string;
  handleCategory?: import("@birim/core").HandleCategory;
  slidingMountingType?: import("@birim/core").SlidingMountingType;
  isInternalDrawer?: boolean;
  crossSectionProfile?: import("@birim/core").DoorCrossSectionProfile;
  customCadPolygon?: { x: number; y: number }[];
  /** Analytical rectangular 3D aperture cut through a countertop (sink / cooktop hole) */
  cutoutHole?: {
    centerXMm: UnitLength;
    centerZMm: UnitLength;
    widthMm: UnitLength;
    depthMm: UnitLength;
  };
  /** U-shaped siphon cutout on under-sink drawer bottom & back */
  siphonCutout?: {
    widthMm: UnitLength;
    depthMm: UnitLength;
  };
  materialId: string;
  isFrontFacing?: boolean;
  /** True only if this component represents a cuttable sheet/panel piece in BOM (false for UI hardware/handles/profiles) */
  isManufacturablePanel?: boolean;
  /** Explicit axis along which panel thickness lies ("x" for vertical sides/dividers, "y" for horizontal shelves/top/bottom, "z" for fronts/backs) */
  thicknessAxis?: PanelThicknessAxis;
  /** True 2D CNC outer polygon vertices [xMm, yMm][] for non-rectangular panels (sloped ceiling, capsule stadium) */
  polygonContourMm?: [number, number][];
  /** Parametric CNC kerf-bending engineering data for curved shells */
  kerfBendingMeta?: {
    outerRadiusMm: number;
    bendAngleDeg: number;
    unfoldedArcLengthMm: number;
    kerfCount: number;
    kerfSpacingMm: number;
    residualWebMm: number;
  };
}

export interface ModuleGeometryBreakdown {
  moduleId: string;
  overall: Dimensions3D;
  components: ComponentGeometry[];
  bayWidths: UnitLength[];
  netInnerHeight: UnitLength;
  netInnerDepth: UnitLength;
}
