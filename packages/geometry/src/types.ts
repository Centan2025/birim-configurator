import { UnitLength, Position3D, Dimensions3D } from "@birim/core";

export type ComponentRole =
  | "carcass_side_left"
  | "carcass_side_right"
  | "carcass_bottom"
  | "carcass_top"
  | "carcass_divider"
  | "carcass_sub_divider"
  | "carcass_back"
  | "plinth"
  | "shelf"
  | "hanging_rail"
  | "drawer_front"
  | "drawer_box"
  | "drawer_bottom"
  | "drawer_side_left"
  | "drawer_side_right"
  | "drawer_back"
  | "drawer_handle"
  | "drawer_slide"
  | "door_left"
  | "door_right"
  | "countertop";

export interface ComponentGeometry {
  id: string;
  role: ComponentRole;
  label: string;
  bayIndex?: number;
  dimensions: Dimensions3D; // width (dx), height (dy), depth (dz)
  position: Position3D; // local position relative to module origin (bottom-left-front = 0,0,0)
  rotation?: [number, number, number]; // in radians
  materialId: string;
  isFrontFacing?: boolean;
}

export interface ModuleGeometryBreakdown {
  moduleId: string;
  overall: Dimensions3D;
  components: ComponentGeometry[];
  bayWidths: UnitLength[];
  netInnerHeight: UnitLength;
  netInnerDepth: UnitLength;
}
