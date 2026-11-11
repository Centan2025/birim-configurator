// ============================================================================
// packages/manufacturing/src/erp-nesting/erp-nesting-types.ts
// Birim Portal / ERP CNC Panel Nesting Modülü ile %100 Birebir Veri Sözleşmesi
// Kaynak Şema: birim-nesting-module/types/nesting.ts
// ============================================================================

export type ErpGrainDirection = "horizontal" | "vertical" | "none";

export type ErpNestingProjectStatus =
  | "draft"
  | "optimized"
  | "approved"
  | "cutting"
  | "completed";

export type ErpNestingSourceType = "manual" | "excel" | "production_order";

export interface ErpNestingSheet {
  id: string;
  organization_id: string;
  name: string;
  material_type: string;
  width_mm: number;
  height_mm: number;
  thickness_mm: number;
  kerf_mm: number;
  edge_margin_mm: number;
  cost_per_sheet: number | null;
  grain_direction?: ErpGrainDirection | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ErpNestingSheetInput {
  name: string;
  material_type: string;
  width_mm: number;
  height_mm: number;
  thickness_mm: number;
  kerf_mm: number;
  edge_margin_mm: number;
  cost_per_sheet: number | null;
  grain_direction?: ErpGrainDirection | null;
}

export interface ErpNestingGroove {
  id?: string;
  grooveType?: string;
  distanceFromEdge: number;
  offset?: number;
  width: number;
  depth: number;
  side: "top" | "bottom" | "left" | "right" | "üst" | "alt" | "sol" | "sağ" | string;
  adjustedSide?: string;
}

export interface ErpNestingPart {
  id: string;
  project_id: string;
  part_label: string;
  width_mm: number;
  height_mm: number;
  quantity: number;
  can_rotate: boolean;
  grain_direction: ErpGrainDirection | null;
  edge_banding: string | null;
  edgeL1?: string;
  edgeL2?: string;
  edgeW1?: string;
  edgeW2?: string;
  hasGroove?: boolean;
  grooveSide?: string;
  grooveOffset?: number;
  grooveWidth?: number;
  grooveDepth?: number;
  grooves?: ErpNestingGroove[];
  material_code: string | null;
  color: string;
  priority: number;
  created_at: string;
}

export interface ErpNestingPartInput {
  part_label: string;
  width_mm: number;
  height_mm: number;
  quantity: number;
  can_rotate: boolean;
  grain_direction: ErpGrainDirection | null;
  edge_banding: string | null;
  edgeL1?: string;
  edgeL2?: string;
  edgeW1?: string;
  edgeW2?: string;
  hasGroove?: boolean;
  grooveSide?: string;
  grooveOffset?: number;
  grooveWidth?: number;
  grooveDepth?: number;
  material_code: string | null;
}

export interface ErpNestingPlacement {
  id: string;
  project_id: string;
  part_id: string;
  sheet_index: number;
  x_mm: number;
  y_mm: number;
  placed_width_mm: number;
  placed_height_mm: number;
  is_rotated: boolean;
  rotation?: number;
  hasCollision?: boolean;
  created_at: string;
  part?: ErpNestingPart;
}

export interface ErpRectData {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ErpCutSequence {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  isTraversal?: boolean;
  stepNumber?: number;
  step?: number;
  type?: "rip" | "cross" | "part" | "trim" | string;
  description?: string;
}

export interface ErpPlacementData {
  part_id: string;
  part_label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotated: boolean;
  rotation?: number;
  color: string;
  edgeL1?: string;
  edgeL2?: string;
  edgeW1?: string;
  edgeW2?: string;
  hasGroove?: boolean;
  grooveSide?: string;
  grooveOffset?: number;
  grooveWidth?: number;
  grooveDepth?: number;
  grooves?: ErpNestingGroove[];
  hasCollision?: boolean;
  isSharedEdge?: { top: boolean; bottom: boolean; left: boolean; right: boolean };
  grain_direction?: ErpGrainDirection | null;
  can_rotate?: boolean;
}

export interface ErpRemnantSheetInput {
  id?: string;
  name?: string;
  width: number;
  height: number;
  kerf?: number;
  margin?: number;
}

export interface ErpNestingSheetResult {
  sheet_index: number;
  placements: ErpPlacementData[];
  utilization_percent: number;
  waste_mm2: number;
  free_rects: ErpRectData[];
  sequences?: ErpCutSequence[];
  cuttingInstructions?: string[];
  is_remnant?: boolean;
  remnant_id?: string;
  sheet_name?: string;
  sheet_width?: number;
  sheet_height?: number;
}

export interface ErpNestingOptimizationSettings {
  algorithm?: "Guillotine" | "MaxRects" | "Auto";
  sawKerf?: number;
  edgeMargin?: number;
  partSpacing?: number;
  useCommonCut?: boolean;
  useOnionSkin?: boolean;
  onionSkinAreaThreshold?: number;
  rotationAllowed?: boolean;
  grainRule?: boolean;
  cutDirection?: "rip" | "cross";
  kerf?: number;
  margin?: number;
  spacing?: number;
  minRemnantWidth?: number;
  allowRotation?: boolean;
  considerGrain?: boolean;
  commonCut?: boolean;
  onionSkin?: boolean;
  priorityRemnantSheets?: ErpRemnantSheetInput[];
  useRemnantsFirst?: boolean;
}

export interface ErpNestingOptimizationResult {
  sheets: ErpNestingSheetResult[];
  total_parts_placed: number;
  total_parts_requested: number;
  overall_utilization: number;
  total_waste_mm2: number;
  algorithm: string;
  computed_at: string;
  settings?: ErpNestingOptimizationSettings;
}

export interface ErpNestingProject {
  id: string;
  organization_id: string;
  project_no: string;
  name: string;
  status: ErpNestingProjectStatus;
  sheet_id: string | null;
  source_type: ErpNestingSourceType;
  source_ref: string | null;
  created_by: string;
  optimization_data: ErpNestingOptimizationResult | null;
  total_sheets_used: number;
  utilization_percent: number;
  waste_area_mm2: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  sheet?: ErpNestingSheet;
  parts?: ErpNestingPart[];
  placements?: ErpNestingPlacement[];
}

export interface ErpGCodeConfig {
  feed_rate: number;
  plunge_rate: number;
  safe_z: number;
  cut_depth: number;
  pass_depth: number;
  tool_diameter: number;
  spindle_speed: number;
  unit: "mm" | "inch";
}

export const DEFAULT_ERP_GCODE_CONFIG: ErpGCodeConfig = {
  feed_rate: 3000,
  plunge_rate: 500,
  safe_z: 5,
  cut_depth: 18,
  pass_depth: 18,
  tool_diameter: 6,
  spindle_speed: 18000,
  unit: "mm",
};

export interface ErpReclaimableRemnant {
  sheet_index: number;
  remnant_index: number;
  x_mm: number;
  y_mm: number;
  width_mm: number;
  height_mm: number;
  area_mm2: number;
  estimated_value: number;
}

export const ERP_PART_COLORS: readonly string[] = [
  "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
  "#ec4899", "#f43f5e", "#ef4444", "#f97316",
  "#f59e0b", "#eab308", "#84cc16", "#22c55e",
  "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9",
  "#3b82f6", "#2563eb", "#7c3aed", "#9333ea",
] as const;

export function getErpPartColor(index: number): string {
  return ERP_PART_COLORS[index % ERP_PART_COLORS.length];
}

// --- Birim Configurator -> Birim ERP Köprü (Bridge) Veri Paketleri ---

export interface BirimErpPartTraceMeta {
  erp_part_id: string;
  part_label: string;
  source_piece_ids: string[];
  module_ids: string[];
  module_names: string[];
  component_role: string;
  nominal_length_mm: number;
  nominal_width_mm: number;
  net_cut_length_mm: number;
  net_cut_width_mm: number;
  crosswise_canonicalized: boolean;
  drilling_holes_count: number;
}

export interface BirimErpNestingBoardJob {
  job_index: number;
  group_key: string;
  material_id: string;
  material_name: string;
  material_code: string;
  thickness_mm: number;
  sheet_input: ErpNestingSheetInput;
  sheet_record: ErpNestingSheet;
  project_record: ErpNestingProject;
  part_inputs: ErpNestingPartInput[];
  part_records: ErpNestingPart[];
  placement_records: ErpNestingPlacement[];
  optimization_result: ErpNestingOptimizationResult;
  reclaimable_remnants: ErpReclaimableRemnant[];
  part_traceability: BirimErpPartTraceMeta[];
  selco_csv: string;
  cnc_gcode: string;
  api_requests: {
    post_sheet: { endpoint: "/api/nesting/sheets"; method: "POST"; body: ErpNestingSheetInput };
    post_project: {
      endpoint: "/api/nesting";
      method: "POST";
      body: {
        name: string;
        sheet_id: string;
        source_type: "production_order";
        source_ref: string;
        notes: string;
      };
    };
    post_parts: {
      endpoint: string;
      method: "POST";
      body: { parts: ErpNestingPartInput[] };
    };
    post_optimize: {
      endpoint: string;
      method: "POST";
      body: { settings: ErpNestingOptimizationSettings };
    };
  };
}

export interface BirimErpNestingBuildOptions {
  organizationId?: string;
  createdBy?: string;
  orderRef?: string;
  sheetWidthMm?: number;
  sheetHeightMm?: number;
  kerfMm?: number;
  edgeMarginMm?: number;
  partSpacingMm?: number;
  algorithm?: "Auto" | "Guillotine" | "MaxRects";
  useCommonCut?: boolean;
  useNetCutDimensions?: boolean;
  aggregateIdenticalParts?: boolean;
  minRemnantWidthMm?: number;
  minRemnantHeightMm?: number;
}

export interface BirimErpNestingExportBundle {
  schema_version: "birim-erp-nesting/v1.0";
  generated_at: string;
  source_system: "birim-configurator";
  source_project_id: string;
  source_project_title: string;
  source_project_version: number;
  organization_id: string;
  order_ref: string;
  dimension_basis: "net_cut_mm" | "nominal_finished_mm";
  settings: ErpNestingOptimizationSettings & {
    sheet_width_mm: number;
    sheet_height_mm: number;
  };
  summary: {
    board_groups_count: number;
    total_sheets_used: number;
    total_parts_requested: number;
    total_parts_placed: number;
    unplaced_parts_count: number;
    overall_utilization_percent: number;
    total_waste_m2: number;
    reclaimable_remnants_count: number;
    reclaimable_remnants_area_m2: number;
  };
  jobs: BirimErpNestingBoardJob[];
  combined_selco_csv: string;
  combined_cnc_gcode: string;
}
