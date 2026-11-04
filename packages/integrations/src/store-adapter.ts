import { DesignProject } from "@birim/core";
import { ManufacturingBOM } from "@birim/manufacturing";
import { PricingBreakdown } from "@birim/pricing";
import { IStoreAdapter, StoreQuoteItemPayload } from "./types";

export class MockStoreAdapter implements IStoreAdapter {
  private inMemorySnapshots: Map<string, StoreQuoteItemPayload> = new Map();

  async createOrUpdateQuoteItem(
    project: DesignProject,
    bom: ManufacturingBOM,
    pricing: PricingBreakdown,
    quoteId = "quote_mock_default"
  ): Promise<{ success: boolean; snapshotId: string; timestamp: string }> {
    const mainMod = project.modules[0];
    const snapshotId = `snp_${project.id}_v${project.version}_${Date.now()}`;

    const payload: StoreQuoteItemPayload = {
      quoteId,
      cartItemId: `cart_item_${project.id}`,
      branchId: project.branchId,
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
        },
        rawProjectData: JSON.parse(JSON.stringify(project)),
      },
    };

    this.inMemorySnapshots.set(snapshotId, payload);

    return {
      success: true,
      snapshotId,
      timestamp: new Date().toISOString(),
    };
  }

  getSnapshot(snapshotId: string): StoreQuoteItemPayload | undefined {
    return this.inMemorySnapshots.get(snapshotId);
  }
}
