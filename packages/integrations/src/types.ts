import { CompatibilityStatus, DesignProject } from "@birim/core";
import {
  ManufacturingBOM,
  type BirimErpNestingExportBundle,
  type BirimErpNestingBuildOptions,
} from "@birim/manufacturing";
import { PricingBreakdown } from "@birim/pricing";

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  branchId: string;
  action:
    | "QUOTE_SNAPSHOT_CREATED"
    | "PRODUCTION_BLUEPRINT_EXPORTED"
    | "ERP_NESTING_BUNDLE_EXPORTED"
    | "DESIGN_LOCKED";
  resourceId: string;
  details: Record<string, string | number>;
}

export interface StoreQuoteItemPayload {
  quoteId: string;
  cartItemId: string;
  branchId: string;
  idempotencyKey?: string;
  signature?: string;
  configuratorSnapshot: {
    designId: string;
    version: number;
    libraryVersionId?: string;
    title: string;
    category: string;
    dimensionsSummary: string;
    calculatedPriceEur: number;
    calculatedPriceTry: number;
    materialsSummary: string;
    selectedDoorSystems?: string[];
    selectedHardwareSkus?: string[];
    compatibilityStatus?: CompatibilityStatus;
    bomSummary: {
      totalPieces: number;
      totalAreaM2: number;
      totalHardwareCount: number;
      totalDrillingHolesCount: number;
    };
    rawProjectData: DesignProject;
  };
}

export interface ERPBlueprintPayload {
  id?: string;
  order_id: string;
  version: number;
  branch_id: string;
  idempotency_key?: string;
  status: "draft" | "active" | "completed" | "archived";
  items: {
    piece_id: string;
    label: string;
    material: string;
    dimensions_mm: [number, number, number];
    net_cut_dimensions_mm: [number, number, number];
    edge_banding: {
      top: boolean;
      bottom: boolean;
      left: boolean;
      right: boolean;
      thickness_mm: number;
      erp_serialized_edge_banding: string | null;
    };
    grain: string;
    workshops: string[];
    drilling_count: number;
  }[];
  hardware_items: {
    sku: string;
    name: string;
    quantity: number;
    unit: string;
  }[];
  nesting_bundle: BirimErpNestingExportBundle;
  metadata: {
    project_id: string;
    project_title: string;
    branch_id: string;
    generated_at: string;
    library_version_id?: string;
    compatibility_status?: CompatibilityStatus;
    cnc_production_approved?: boolean;
  };
}

export interface IStoreAdapter {
  createOrUpdateQuoteItem(
    project: DesignProject,
    bom: ManufacturingBOM,
    pricing: PricingBreakdown,
    quoteId: string,
    idempotencyKey?: string
  ): Promise<{ success: boolean; snapshotId: string; timestamp: string }>;
  getAuditLogs(): AuditLogEntry[];
}

export interface IERPAdapter {
  publishProductionBlueprint(
    project: DesignProject,
    bom: ManufacturingBOM,
    orderId: string,
    idempotencyKey?: string,
    nestingOptions?: BirimErpNestingBuildOptions
  ): Promise<{
    success: boolean;
    blueprintId: string;
    itemsCount: number;
    nestingJobsCount: number;
    totalSheetsUsed: number;
    nestingBundle: BirimErpNestingExportBundle;
  }>;
  buildNestingPayload(
    project: DesignProject,
    bom: ManufacturingBOM,
    orderId?: string,
    nestingOptions?: BirimErpNestingBuildOptions
  ): BirimErpNestingExportBundle;
  getAuditLogs(): AuditLogEntry[];
}
