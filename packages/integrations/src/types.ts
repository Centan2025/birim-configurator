import { DesignProject } from "@birim/core";
import { ManufacturingBOM } from "@birim/manufacturing";
import { PricingBreakdown } from "@birim/pricing";

export interface StoreQuoteItemPayload {
  quoteId: string;
  cartItemId: string;
  branchId: string;
  configuratorSnapshot: {
    designId: string;
    version: number;
    title: string;
    category: string;
    dimensionsSummary: string;
    calculatedPriceEur: number;
    calculatedPriceTry: number;
    materialsSummary: string;
    bomSummary: {
      totalPieces: number;
      totalAreaM2: number;
      totalHardwareCount: number;
    };
    rawProjectData: DesignProject;
  };
}

export interface ERPBlueprintPayload {
  id?: string;
  order_id: string;
  version: number;
  status: "draft" | "active" | "completed" | "archived";
  items: {
    piece_id: string;
    label: string;
    material: string;
    dimensions_mm: [number, number, number]; // [length, width, thickness]
    edge_banding: { top: boolean; bottom: boolean; left: boolean; right: boolean; thickness_mm: number };
    grain: string;
    workshops: string[]; // e.g. ["ebatlama", "kenar_bantlama", "cnc", "montaj"]
  }[];
  hardware_items: {
    sku: string;
    name: string;
    quantity: number;
    unit: string;
  }[];
  metadata: {
    project_id: string;
    project_title: string;
    branch_id: string;
    generated_at: string;
  };
}

export interface IStoreAdapter {
  createOrUpdateQuoteItem(project: DesignProject, bom: ManufacturingBOM, pricing: PricingBreakdown, quoteId: string): Promise<{ success: boolean; snapshotId: string; timestamp: string }>;
}

export interface IERPAdapter {
  publishProductionBlueprint(project: DesignProject, bom: ManufacturingBOM, orderId: string): Promise<{ success: boolean; blueprintId: string; itemsCount: number }>;
}
