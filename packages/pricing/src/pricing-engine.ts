import { DEFAULT_MATERIALS, MaterialDefinition } from "@birim/core";
import { ManufacturingBOM } from "@birim/manufacturing";
import { PricingBreakdown, PricingParameters } from "./types";

export const DEFAULT_PRICING_PARAMS: PricingParameters = {
  wasteFactorPercent: 12, // %12 fire
  laborRatePerHourEur: 28,
  estimatedHoursPerM2: 0.65,
  operationalOverheadPercent: 10,
  assemblyCostEur: 95,
  targetMarginPercent: 35, // %35 kâr marjı
  currency: "EUR",
  eurTryExchangeRate: 38.5,
};

export function calculateProjectPrice(
  bom: ManufacturingBOM,
  params: PricingParameters = DEFAULT_PRICING_PARAMS,
  materialsMap: Map<string, MaterialDefinition> = new Map(DEFAULT_MATERIALS.map((m) => [m.id, m]))
): PricingBreakdown {
  const materialLines: PricingBreakdown["details"]["materialLines"] = [];
  let totalMaterialCostEur = 0;
  let totalEdgeBandCostEur = 0;

  // 1. Raw sheet material cost
  bom.materialUsage.forEach((item) => {
    const mat = materialsMap.get(item.materialId) || DEFAULT_MATERIALS[0];
    const lineCost = item.grossAreaM2 * mat.costPerM2;
    totalMaterialCostEur += lineCost;
    materialLines.push({
      name: item.materialName,
      grossAreaM2: item.grossAreaM2,
      rateEur: mat.costPerM2,
      totalEur: Number(lineCost.toFixed(2)),
    });
  });

  // 2. Edge band cost
  bom.cutList.forEach((piece) => {
    const mat = materialsMap.get(piece.materialId) || DEFAULT_MATERIALS[0];
    totalEdgeBandCostEur += piece.edgeBandMeters * (mat.edgeBandCostPerM || 1.5);
  });

  // 3. Hardware cost
  const hardwareLines: PricingBreakdown["details"]["hardwareLines"] = [];
  let totalHardwareCostEur = 0;
  bom.hardwareList.forEach((hw) => {
    totalHardwareCostEur += hw.totalPrice;
    hardwareLines.push({
      name: hw.name,
      qty: hw.quantity,
      unitPriceEur: hw.unitPrice,
      totalEur: Number(hw.totalPrice.toFixed(2)),
    });
  });

  const rawMaterialsTotal = totalMaterialCostEur + totalEdgeBandCostEur + totalHardwareCostEur;

  // 4. Labor cost: based on total panel area & estimated hours
  const totalHours = bom.summary.totalPanelAreaM2 * params.estimatedHoursPerM2;
  const laborCost = totalHours * params.laborRatePerHourEur;

  // 5. Operational overhead
  const operationalOverhead = (rawMaterialsTotal + laborCost) * (params.operationalOverheadPercent / 100);

  // 6. Net production cost
  const netProductionCost = rawMaterialsTotal + laborCost + operationalOverhead;

  // 7. Margin
  const marginAmount = (netProductionCost + params.assemblyCostEur) * (params.targetMarginPercent / 100);

  // 8. Net subtotal before VAT
  const subtotalNetEur = netProductionCost + params.assemblyCostEur + marginAmount;
  const subtotalNetTry = subtotalNetEur * params.eurTryExchangeRate;

  // 9. VAT (KDV %20)
  const vatRatePercent = 20;
  const vatAmountEur = subtotalNetEur * (vatRatePercent / 100);
  const vatAmountTry = subtotalNetTry * (vatRatePercent / 100);

  const totalWithVatEur = subtotalNetEur + vatAmountEur;
  const totalWithVatTry = subtotalNetTry + vatAmountTry;

  return {
    currency: params.currency,
    materialCost: Number(totalMaterialCostEur.toFixed(2)),
    edgeBandCost: Number(totalEdgeBandCostEur.toFixed(2)),
    hardwareCost: Number(totalHardwareCostEur.toFixed(2)),
    rawMaterialsTotal: Number(rawMaterialsTotal.toFixed(2)),
    laborCost: Number(laborCost.toFixed(2)),
    operationalOverhead: Number(operationalOverhead.toFixed(2)),
    netProductionCost: Number(netProductionCost.toFixed(2)),
    assemblyCost: Number(params.assemblyCostEur.toFixed(2)),
    marginAmount: Number(marginAmount.toFixed(2)),
    subtotalNetEur: Number(subtotalNetEur.toFixed(2)),
    subtotalNetTry: Number(subtotalNetTry.toFixed(2)),
    vatRatePercent,
    vatAmountEur: Number(vatAmountEur.toFixed(2)),
    vatAmountTry: Number(vatAmountTry.toFixed(2)),
    totalWithVatEur: Number(totalWithVatEur.toFixed(2)),
    totalWithVatTry: Number(totalWithVatTry.toFixed(2)),
    details: {
      materialLines,
      hardwareLines,
      totalEdgeBandMeters: bom.summary.totalEdgeBandMeters,
    },
  };
}
