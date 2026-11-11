import { DEFAULT_MATERIALS, MaterialDefinition, roundMm } from "@birim/core";
import { ManufacturingBOM } from "@birim/manufacturing";
import {
  PricingBreakdown,
  PricingParameters,
  MaterialAlternativeComparison,
} from "./types";

export const DEFAULT_PRICING_PARAMS: PricingParameters = {
  wasteFactorPercent: 12,
  laborRatePerHourEur: 28,
  estimatedHoursPerM2: 0.65,
  operationalOverheadPercent: 10,
  assemblyCostEur: 95,
  cncCostPerHoleEur: 0.04,
  packagingCostEur: 35,
  targetMarginPercent: 35,
  currency: "EUR",
  eurTryExchangeRate: 38.5,
};

function isExteriorVisibleRole(role: string | undefined): boolean {
  if (!role) return false;
  return (
    role.startsWith("door") ||
    role === "drawer_front" ||
    role === "plinth" ||
    role === "end_panel" ||
    role === "wall_filler" ||
    role === "fascia_panel"
  );
}

export function calculateProjectPrice(
  bom: ManufacturingBOM,
  params: PricingParameters = DEFAULT_PRICING_PARAMS,
  materialsMap: Map<string, MaterialDefinition> = new Map(
    DEFAULT_MATERIALS.map((m) => [m.id, m])
  )
): PricingBreakdown {
  const materialLines: PricingBreakdown["details"]["materialLines"] = [];
  let totalMaterialCostEur = 0;
  let totalEdgeBandCostEur = 0;

  const wasteMultiplier = 1 + Math.max(0, params.wasteFactorPercent) / 100;

  // Map real 2D guillotine nesting gross board area (minus reusable stock remnants) when available
  const nestedEffectiveAreaByMat = new Map<string, number>();
  bom.nestingResults.forEach((nr) => {
    const remnantArea = nr.sheets.reduce((acc, s) => acc + (s.usableRemnantAreaM2 || 0), 0);
    const billableBoardArea = Math.max(nr.totalNetAreaM2, nr.totalGrossAreaM2 - remnantArea);
    nestedEffectiveAreaByMat.set(
      nr.materialId,
      (nestedEffectiveAreaByMat.get(nr.materialId) || 0) + billableBoardArea
    );
  });

  // 1. Raw sheet material cost (honors params.wasteFactorPercent & real nesting board count)
  bom.materialUsage.forEach((item) => {
    const mat = materialsMap.get(item.materialId) || DEFAULT_MATERIALS[0];
    const nestedArea = nestedEffectiveAreaByMat.get(item.materialId);
    const paramGrossArea = roundMm(item.netAreaM2 * wasteMultiplier, 2);
    const effectiveGrossAreaM2 =
      nestedArea && params.wasteFactorPercent === DEFAULT_PRICING_PARAMS.wasteFactorPercent
        ? roundMm(Math.min(nestedArea, item.netAreaM2 * 1.35), 2)
        : paramGrossArea;

    const lineCost = effectiveGrossAreaM2 * mat.costPerM2;
    totalMaterialCostEur += lineCost;
    materialLines.push({
      name: item.materialName,
      grossAreaM2: effectiveGrossAreaM2,
      rateEur: mat.costPerM2,
      totalEur: roundMm(lineCost, 2),
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
      totalEur: roundMm(hw.totalPrice, 2),
    });
  });

  // 4. CNC Drilling Operations Cost
  const totalHolesCount = bom.summary.totalDrillingHolesCount || 0;
  const cncDrillingCost = totalHolesCount * params.cncCostPerHoleEur;

  const rawMaterialsTotal =
    totalMaterialCostEur + totalEdgeBandCostEur + totalHardwareCostEur + cncDrillingCost;

  // 5. Labor cost
  const totalHours = bom.summary.totalPanelAreaM2 * params.estimatedHoursPerM2;
  const laborCost = totalHours * params.laborRatePerHourEur;

  // 6. Operational overhead
  const operationalOverhead =
    (rawMaterialsTotal + laborCost) * (params.operationalOverheadPercent / 100);

  // 7. Net production cost
  const netProductionCost = rawMaterialsTotal + laborCost + operationalOverhead;

  // 8. Fixed logistics (only charged when project actually has parts)
  const logisticsTotal =
    bom.cutList.length > 0 ? params.assemblyCostEur + params.packagingCostEur : 0;

  // 9. Margin
  const marginAmount =
    (netProductionCost + logisticsTotal) * (params.targetMarginPercent / 100);

  // 10. Net subtotal before VAT
  const subtotalNetEur = netProductionCost + logisticsTotal + marginAmount;
  const subtotalNetTry = subtotalNetEur * params.eurTryExchangeRate;

  // 11. VAT (KDV %20)
  const vatRatePercent = 20;
  const vatAmountEur = subtotalNetEur * (vatRatePercent / 100);
  const vatAmountTry = subtotalNetTry * (vatRatePercent / 100);

  const totalWithVatEur = subtotalNetEur + vatAmountEur;
  const totalWithVatTry = subtotalNetTry + vatAmountTry;

  // Separate structural carcass/back/drawer-box area from exterior visible fronts
  // so luxury front alternatives do NOT falsely reprice hidden carcass/back panels!
  let structuralCarcassCostEur = 0;
  let exteriorNetAreaM2 = 0;
  let exteriorEdgeBandMeters = 0;
  let structuralEdgeBandCostEur = 0;

  bom.cutList.forEach((piece) => {
    const pMat = materialsMap.get(piece.materialId) || DEFAULT_MATERIALS[0];
    if (isExteriorVisibleRole(piece.componentRole)) {
      exteriorNetAreaM2 += piece.areaM2;
      exteriorEdgeBandMeters += piece.edgeBandMeters;
    } else {
      structuralCarcassCostEur += piece.areaM2 * wasteMultiplier * pMat.costPerM2;
      structuralEdgeBandCostEur += piece.edgeBandMeters * (pMat.edgeBandCostPerM || 1.5);
    }
  });

  const materialAlternatives: MaterialAlternativeComparison[] = DEFAULT_MATERIALS.filter(
    (altMat) => altMat.id !== "mat_led_warm_3000k"
  ).map((altMat) => {
    const altExteriorMatCost =
      exteriorNetAreaM2 > 0
        ? exteriorNetAreaM2 * wasteMultiplier * altMat.costPerM2
        : bom.summary.totalPanelAreaM2 * 0.35 * wasteMultiplier * altMat.costPerM2;
    const altExteriorEbCost =
      exteriorEdgeBandMeters * (altMat.edgeBandCostPerM || 1.5);

    const altMatCostEur = structuralCarcassCostEur + altExteriorMatCost;
    const altEbCostEur = structuralEdgeBandCostEur + altExteriorEbCost;

    const altRaw =
      altMatCostEur + altEbCostEur + totalHardwareCostEur + cncDrillingCost;
    const altOverhead =
      (altRaw + laborCost) * (params.operationalOverheadPercent / 100);
    const altNetProd = altRaw + laborCost + altOverhead;
    const altMargin =
      (altNetProd + logisticsTotal) * (params.targetMarginPercent / 100);
    const altSubtotalEur = altNetProd + logisticsTotal + altMargin;
    const altTotalVatEur = altSubtotalEur * 1.2;

    const diffEur = altTotalVatEur - totalWithVatEur;
    const diffPercent = totalWithVatEur > 0 ? (diffEur / totalWithVatEur) * 100 : 0;

    return {
      materialId: altMat.id,
      materialName: altMat.name,
      totalWithVatEur: roundMm(altTotalVatEur, 2),
      totalWithVatTry: roundMm(altTotalVatEur * params.eurTryExchangeRate, 2),
      diffEur: roundMm(diffEur, 2),
      diffPercent: roundMm(diffPercent, 1),
    };
  });

  return {
    currency: params.currency,
    materialCost: roundMm(totalMaterialCostEur, 2),
    materialCostEur: roundMm(totalMaterialCostEur, 2),
    edgeBandCost: roundMm(totalEdgeBandCostEur, 2),
    edgeBandCostEur: roundMm(totalEdgeBandCostEur, 2),
    hardwareCost: roundMm(totalHardwareCostEur, 2),
    hardwareCostEur: roundMm(totalHardwareCostEur, 2),
    laborCostEur: roundMm(laborCost, 2),
    cncDrillingCost: roundMm(cncDrillingCost, 2),
    rawMaterialsTotal: roundMm(rawMaterialsTotal, 2),
    laborCost: roundMm(laborCost, 2),
    operationalOverhead: roundMm(operationalOverhead, 2),
    netProductionCost: roundMm(netProductionCost, 2),
    assemblyCost: roundMm(bom.cutList.length > 0 ? params.assemblyCostEur : 0, 2),
    packagingCost: roundMm(bom.cutList.length > 0 ? params.packagingCostEur : 0, 2),
    marginAmount: roundMm(marginAmount, 2),
    subtotalNetEur: roundMm(subtotalNetEur, 2),
    subtotalNetTry: roundMm(subtotalNetTry, 2),
    vatRatePercent,
    vatAmountEur: roundMm(vatAmountEur, 2),
    vatAmountTry: roundMm(vatAmountTry, 2),
    totalWithVatEur: roundMm(totalWithVatEur, 2),
    totalWithVatTry: roundMm(totalWithVatTry, 2),
    details: {
      materialLines,
      hardwareLines,
      totalEdgeBandMeters: bom.summary.totalEdgeBandMeters,
      totalHolesCount,
    },
    materialAlternatives,
  };
}
