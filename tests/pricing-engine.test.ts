import { describe, it, expect } from "vitest";
import { createInitialProject } from "@birim/core";
import { generateBOMForProject } from "@birim/manufacturing";
import { calculateProjectPrice, DEFAULT_PRICING_PARAMS } from "@birim/pricing";

describe("Pricing Engine", () => {
  it("computes deterministic price with positive margin and VAT", () => {
    const proj = createInitialProject();
    const bom = generateBOMForProject(proj);
    const price = calculateProjectPrice(bom, DEFAULT_PRICING_PARAMS);

    expect(price.materialCost).toBeGreaterThan(0);
    expect(price.edgeBandCost).toBeGreaterThan(0);
    expect(price.hardwareCost).toBeGreaterThan(0);
    expect(price.laborCost).toBeGreaterThan(0);
    expect(price.marginAmount).toBeGreaterThan(0);
    expect(price.subtotalNetEur).toBeGreaterThan(price.netProductionCost);
    expect(price.totalWithVatEur).toBeGreaterThan(price.subtotalNetEur);
    expect(price.totalWithVatTry).toBeGreaterThan(price.totalWithVatEur);
    expect(Math.abs(price.totalWithVatTry - price.totalWithVatEur * DEFAULT_PRICING_PARAMS.eurTryExchangeRate)).toBeLessThan(1);
  });

  it("updates pricing dynamically when materials change", () => {
    const proj = createInitialProject();
    const bom1 = generateBOMForProject(proj);
    const price1 = calculateProjectPrice(bom1);

    // Change doors to luxury American Walnut (95 EUR/m² vs 75 EUR/m²)
    proj.modules[0].carcass.doorMaterialId = "mat_veneer_walnut";
    const bom2 = generateBOMForProject(proj);
    const price2 = calculateProjectPrice(bom2);

    expect(price2.materialCost).toBeGreaterThan(price1.materialCost);
    expect(price2.totalWithVatEur).toBeGreaterThan(price1.totalWithVatEur);
  });
});
