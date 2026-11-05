import { describe, it, expect } from "vitest";
import { createInitialProject } from "@birim/core";
import { generateBOMForProject } from "@birim/manufacturing";
import { calculateProjectPrice } from "@birim/pricing";
import { MockStoreAdapter, MockERPAdapter } from "@birim/integrations";

describe("Store & ERP Integration Adapters", () => {
  it("serializes design snapshot for Store CPQ adapter", async () => {
    const proj = createInitialProject();
    const bom = generateBOMForProject(proj);
    const pricing = calculateProjectPrice(bom);

    const storeAdapter = new MockStoreAdapter();
    const result = await storeAdapter.createOrUpdateQuoteItem(proj, bom, pricing, "quote_test_88");

    expect(result.success).toBe(true);
    expect(result.snapshotId).toBeDefined();

    const snapshot = storeAdapter.getSnapshot(result.snapshotId);
    expect(snapshot).toBeDefined();
    expect(snapshot!.quoteId).toBe("quote_test_88");
    expect(snapshot!.branchId).toBe(proj.branchId);
    expect(snapshot!.configuratorSnapshot.calculatedPriceEur).toBe(pricing.totalWithVatEur);
    expect(snapshot!.configuratorSnapshot.bomSummary.totalPieces).toBe(bom.summary.totalPiecesCount);
  });

  it("exports production blueprint matching ERP workshop routing", async () => {
    const proj = createInitialProject();
    const bom = generateBOMForProject(proj);

    const erpAdapter = new MockERPAdapter();
    await expect(erpAdapter.publishProductionBlueprint(proj, bom, "order_2026_0991")).rejects.toThrow(/UNVERIFIED/);
  });
});
