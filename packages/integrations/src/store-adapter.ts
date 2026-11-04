import { DesignProject } from "@birim/core";
import { ManufacturingBOM } from "@birim/manufacturing";
import { PricingBreakdown } from "@birim/pricing";
import { IStoreAdapter, StoreQuoteItemPayload, AuditLogEntry } from "./types";

export class MockStoreAdapter implements IStoreAdapter {
  private inMemorySnapshots: Map<string, StoreQuoteItemPayload> = new Map();
  private idempotencyRegistry: Map<string, string> = new Map();
  private auditLogs: AuditLogEntry[] = [];

  async createOrUpdateQuoteItem(
    project: DesignProject,
    bom: ManufacturingBOM,
    pricing: PricingBreakdown,
    quoteId = "quote_mock_default",
    idempotencyKey?: string
  ): Promise<{ success: boolean; snapshotId: string; timestamp: string }> {
    // Idempotency check: if key already exists, return previous result
    if (idempotencyKey && this.idempotencyRegistry.has(idempotencyKey)) {
      const existingSnapshotId = this.idempotencyRegistry.get(idempotencyKey)!;
      return {
        success: true,
        snapshotId: existingSnapshotId,
        timestamp: new Date().toISOString(),
      };
    }

    const mainMod = project.modules[0];
    const snapshotId = `snp_${project.id}_v${project.version}_${Date.now()}`;

    const payload: StoreQuoteItemPayload = {
      quoteId,
      cartItemId: `cart_item_${project.id}`,
      branchId: project.branchId,
      idempotencyKey,
      signature: `SIG_HMAC_SHA256_${Date.now()}`,
      configuratorSnapshot: {
        designId: project.id,
        version: project.version,
        title: project.title,
        category: mainMod ? mainMod.category : "custom",
        dimensionsSummary: mainMod
          ? `${mainMod.dimensions.width} x ${mainMod.dimensions.height} x ${mainMod.dimensions.depth} mm`
          : "Çoklu Modül",
        calculatedPriceEur: pricing.totalWithVatEur,
        calculatedPriceTry: pricing.totalWithVatTry,
        materialsSummary: mainMod
          ? `Gövde: ${mainMod.carcass.bodyMaterialId} | Kapak: ${mainMod.carcass.doorMaterialId}`
          : "Çoklu Malzeme",
        bomSummary: {
          totalPieces: bom.summary.totalPiecesCount,
          totalAreaM2: bom.summary.totalPanelAreaM2,
          totalHardwareCount: bom.summary.totalHardwareCount,
          totalDrillingHolesCount: bom.summary.totalDrillingHolesCount || 0,
        },
        rawProjectData: JSON.parse(JSON.stringify(project)),
      },
    };

    this.inMemorySnapshots.set(snapshotId, payload);
    if (idempotencyKey) {
      this.idempotencyRegistry.set(idempotencyKey, snapshotId);
    }

    // Write audit log
    this.auditLogs.push({
      id: `AUDIT_${Date.now()}`,
      timestamp: new Date().toISOString(),
      userId: "STORE_SALES_REP_01",
      branchId: project.branchId,
      action: "QUOTE_SNAPSHOT_CREATED",
      resourceId: snapshotId,
      details: {
        quoteId,
        priceEur: pricing.totalWithVatEur,
        piecesCount: bom.summary.totalPiecesCount,
      },
    });

    return {
      success: true,
      snapshotId,
      timestamp: new Date().toISOString(),
    };
  }

  getSnapshot(snapshotId: string): StoreQuoteItemPayload | undefined {
    return this.inMemorySnapshots.get(snapshotId);
  }

  getAuditLogs(): AuditLogEntry[] {
    return this.auditLogs;
  }
}
