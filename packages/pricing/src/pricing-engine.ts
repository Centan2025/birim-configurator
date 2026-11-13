import { DEFAULT_MATERIALS, MaterialDefinition, roundMm } from "@birim/core";
import { ManufacturingBOM } from "@birim/manufacturing";
import {
  PricingBreakdown,
  PricingParameters,
  MaterialAlternativeComparison,
  LeadTimeEstimate,
} from "./types";

const STANDARD_SHEET_M2 = (2800 * 2070) / 1_000_000; // 5.796 m²

const STOCKED_CORE_MATERIAL_IDS = new Set([
  "mat_melamine_white",
  "mat_melamine_anthracite",
  "mat_melamine_cashmere",
  "mat_mdf_white",
  "mat_back_white_8mm",
]);

export const DEFAULT_PRICING_PARAMS: PricingParameters = {
  wasteFactorPercent: 12,
  laborRatePerHourEur: 28,
  estimatedHoursPerM2: 0.65,
  operationalOverheadPercent: 10,
  assemblyCostEur: 95,
  perModuleInstallEur: 22,
  deliveryBaseEur: 45,
  cncCostPerHoleEur: 0.04,
  packagingCostEur: 35,
  targetMarginPercent: 35,
  minSpecialDecorBoardFraction: 0.5,
  lacquerPaintshopMatteEurPerM2: 18,
  lacquerPaintshopGlossEurPerM2: 26,
  miter45LinearMeterEur: 9.5,
  currency: "EUR",
  eurTryExchangeRate: 41.8,
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

function estimateLeadTimeForMaterials(
  usedMaterials: MaterialDefinition[],
  hasMiter45OrSpecial: boolean
): LeadTimeEstimate {
  const hasLacquer = usedMaterials.some(
    (m) => m.category === "lacquer" || m.name.toLowerCase().includes("lake")
  );
  if (hasLacquer) {
    return {
      minBusinessDays: 18,
      maxBusinessDays: 24,
      label: "18–24 İş Günü",
      reason: "Boyahane poliüretan astar, zımpara, kürlenme ve son kat lake süreci dahildir.",
    };
  }
  const hasVeneerStoneOrGlass = usedMaterials.some(
    (m) => m.category === "wood" && m.id.includes("veneer") || m.category === "stone" || m.category === "glass" || m.category === "compact"
  );
  if (hasVeneerStoneOrGlass || hasMiter45OrSpecial) {
    return {
      minBusinessDays: 12,
      maxBusinessDays: 16,
      label: "12–16 İş Günü",
      reason: "Doğal kaplama / porselen taş kesimi veya 5-eksen gönye/alüminyum çerçeve işçiliği dahildir.",
    };
  }
  return {
    minBusinessDays: 7,
    maxBusinessDays: 10,
    label: "7–10 İş Günü",
    reason: "Stoklu plaka ebatlama, CNC delik ve otomatik kenar bantlama hattı standart terminidir.",
  };
}

export function calculateProjectPrice(
  bom: ManufacturingBOM,
  params: PricingParameters = DEFAULT_PRICING_PARAMS,
  materialsMap: Map<string, MaterialDefinition> = new Map(
    DEFAULT_MATERIALS.map((m) => [m.id, m])
  )
): PricingBreakdown {
  const materialLines: PricingBreakdown["details"]["materialLines"] = [];
  const surchargeLines: PricingBreakdown["details"]["surchargeLines"] = [];
  let totalMaterialCostEur = 0;
  let totalEdgeBandCostEur = 0;

  const wasteMultiplier = 1 + Math.max(0, params.wasteFactorPercent) / 100;
  const minSpecialBoardM2 = roundMm(
    STANDARD_SHEET_M2 * (params.minSpecialDecorBoardFraction ?? 0.5),
    3
  );

  // Real 2D guillotine nesting gross board area minus reusable offcut remnants (>= 0.45 m²)
  const nestedEffectiveAreaByMat = new Map<string, number>();
  bom.nestingResults.forEach((nr) => {
    const remnantArea = nr.sheets.reduce((acc, s) => acc + (s.usableRemnantAreaM2 || 0), 0);
    const billableBoardArea = Math.max(nr.totalNetAreaM2, nr.totalGrossAreaM2 - remnantArea);
    nestedEffectiveAreaByMat.set(
      nr.materialId,
      (nestedEffectiveAreaByMat.get(nr.materialId) || 0) + billableBoardArea
    );
  });

  const usedMaterialDefs: MaterialDefinition[] = [];

  // 1. Raw sheet material cost with factory minimum half-board floor for non-stock special decors
  bom.materialUsage.forEach((item) => {
    const mat = materialsMap.get(item.materialId) || DEFAULT_MATERIALS[0];
    usedMaterialDefs.push(mat);
    const nestedArea = nestedEffectiveAreaByMat.get(item.materialId);
    const paramGrossArea = roundMm(item.netAreaM2 * wasteMultiplier, 2);

    const isStockedDecor = STOCKED_CORE_MATERIAL_IDS.has(mat.id);
    const baseBillable =
      nestedArea && params.wasteFactorPercent === DEFAULT_PRICING_PARAMS.wasteFactorPercent
        ? roundMm(Math.max(paramGrossArea, nestedArea), 2)
        : paramGrossArea;

    const minSheetApplied = !isStockedDecor && item.netAreaM2 > 0 && baseBillable < minSpecialBoardM2;
    const effectiveGrossAreaM2 = minSheetApplied ? roundMm(minSpecialBoardM2, 2) : baseBillable;

    const lineCost = effectiveGrossAreaM2 * mat.costPerM2;
    totalMaterialCostEur += lineCost;
    materialLines.push({
      name: minSheetApplied ? `${item.materialName} (Min. Yarım Plaka Kuralı)` : item.materialName,
      grossAreaM2: effectiveGrossAreaM2,
      rateEur: mat.costPerM2,
      totalEur: roundMm(lineCost, 2),
      minSheetApplied,
    });
  });

  // 2. Edge band + Factory Specialized Process Surcharges (Boyahane Lake, 45° Gönye, Temperli Cam/Alüminyum)
  let paintshopLacquerCostEur = 0;
  let miterAndSpecialCncCostEur = 0;
  let glassAndAluminumFrameCostEur = 0;
  const distinctModules = new Set<string>();

  const matteRate = params.lacquerPaintshopMatteEurPerM2 ?? 18;
  const glossRate = params.lacquerPaintshopGlossEurPerM2 ?? 26;
  const miterRate = params.miter45LinearMeterEur ?? 9.5;

  bom.cutList.forEach((piece) => {
    distinctModules.add(piece.moduleId);
    const mat = materialsMap.get(piece.materialId) || DEFAULT_MATERIALS[0];
    totalEdgeBandCostEur += piece.edgeBandMeters * (mat.edgeBandCostPerM || 1.5);

    // 2a. Paintshop polyurethane primer + sanding + double-face lacquer booth cost
    if (mat.category === "lacquer" || mat.name.toLowerCase().includes("lake")) {
      const isGloss = mat.finish === "gloss" || mat.name.toLowerCase().includes("parlak");
      const faceFactor = isExteriorVisibleRole(piece.componentRole) ? 1.35 : 1.0;
      paintshopLacquerCostEur += piece.areaM2 * (isGloss ? glossRate : matteRate) * faceFactor;
    }

    // 2b. 5-Axis 45° Miter Carcass / Angled Table Scarf Joint + Gola / LED CNC Routing
    if (piece.carcassJoineryTopology === "miter_45") {
      const perimM = ((piece.lengthMm + piece.widthMm) * 2) / 1000;
      miterAndSpecialCncCostEur += perimM * miterRate;
    } else if (piece.miterBevelAngleDeg) {
      miterAndSpecialCncCostEur += (piece.widthMm / 1000) * (miterRate * 1.4);
    }
    if (piece.golaNotches && piece.golaNotches.length > 0) {
      miterAndSpecialCncCostEur += piece.golaNotches.length * 1.85;
    }
    if (piece.ledGrooveSpec?.enabled) {
      miterAndSpecialCncCostEur += (piece.lengthMm / 1000) * 2.4;
    }

    // 2c. Tempered Glass + Anodized Aluminum Frame Profile Linear Cutting & 4x Corner Cleats
    if (mat.category === "glass" || piece.materialId.includes("glass")) {
      const framePerimM = ((piece.lengthMm + piece.widthMm) * 2) / 1000;
      glassAndAluminumFrameCostEur += framePerimM * 11.5 + 24;
    }
  });

  if (paintshopLacquerCostEur > 0) {
    surchargeLines.push({
      label: "Boyahane Astar & İpek Mat/Parlak Lake İşçiliği",
      totalEur: roundMm(paintshopLacquerCostEur, 2),
    });
  }
  if (miterAndSpecialCncCostEur > 0) {
    surchargeLines.push({
      label: "5-Eksen 45° Gönye / Gola / LED CNC Freze İşçiliği",
      totalEur: roundMm(miterAndSpecialCncCostEur, 2),
    });
  }
  if (glassAndAluminumFrameCostEur > 0) {
    surchargeLines.push({
      label: "Temperli Cam & Alüminyum Çerçeve Kesim/Köşe Montajı",
      totalEur: roundMm(glassAndAluminumFrameCostEur, 2),
    });
  }

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
    totalMaterialCostEur +
    totalEdgeBandCostEur +
    totalHardwareCostEur +
    cncDrillingCost +
    glassAndAluminumFrameCostEur;

  // 5. Workshop + Paintshop + Special CNC Labor
  const baseWorkshopLabor = bom.summary.totalPanelAreaM2 * params.estimatedHoursPerM2 * params.laborRatePerHourEur;
  const laborCost = baseWorkshopLabor + paintshopLacquerCostEur + miterAndSpecialCncCostEur;

  // 6. Operational overhead
  const operationalOverhead =
    (rawMaterialsTotal + laborCost) * (params.operationalOverheadPercent / 100);

  // 7. Net production cost
  const netProductionCost = rawMaterialsTotal + laborCost + operationalOverhead;

  // 8. Module-scaled Delivery, Floor-Carry & On-Site Installation
  const modCount = Math.max(1, distinctModules.size);
  const deliveryFee = bom.cutList.length > 0 ? (params.deliveryBaseEur ?? 45) : 0;
  const installFee =
    bom.cutList.length > 0
      ? params.assemblyCostEur + Math.max(0, modCount - 1) * (params.perModuleInstallEur ?? 22)
      : 0;
  const deliveryAndInstallationEur = deliveryFee + installFee;
  const logisticsTotal =
    bom.cutList.length > 0 ? deliveryAndInstallationEur + params.packagingCostEur : 0;

  if (deliveryAndInstallationEur > 0) {
    surchargeLines.push({
      label: `Şantiye Nakliye + Kat Taşıma + Uzman Montaj (${modCount} Modül)`,
      totalEur: roundMm(deliveryAndInstallationEur, 2),
    });
  }

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

  const leadTime = estimateLeadTimeForMaterials(
    usedMaterialDefs,
    miterAndSpecialCncCostEur > 15 || glassAndAluminumFrameCostEur > 0
  );

  // Separate structural carcass from exterior fronts for accurate material comparison
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
    const rawExtArea =
      exteriorNetAreaM2 > 0
        ? exteriorNetAreaM2 * wasteMultiplier
        : bom.summary.totalPanelAreaM2 * 0.35 * wasteMultiplier;
    const isAltStocked = STOCKED_CORE_MATERIAL_IDS.has(altMat.id);
    const billableExtArea = !isAltStocked && rawExtArea > 0 ? Math.max(minSpecialBoardM2, rawExtArea) : rawExtArea;

    const altExteriorMatCost = billableExtArea * altMat.costPerM2;
    const altExteriorEbCost = exteriorEdgeBandMeters * (altMat.edgeBandCostPerM || 1.5);
    const altPaintshop =
      altMat.category === "lacquer" || altMat.name.toLowerCase().includes("lake")
        ? rawExtArea * (altMat.finish === "gloss" ? glossRate : matteRate) * 1.25
        : 0;

    const altMatCostEur = structuralCarcassCostEur + altExteriorMatCost;
    const altEbCostEur = structuralEdgeBandCostEur + altExteriorEbCost;

    const altRaw =
      altMatCostEur + altEbCostEur + totalHardwareCostEur + cncDrillingCost + glassAndAluminumFrameCostEur;
    const altLabor = baseWorkshopLabor + altPaintshop + miterAndSpecialCncCostEur;
    const altOverhead = (altRaw + altLabor) * (params.operationalOverheadPercent / 100);
    const altNetProd = altRaw + altLabor + altOverhead;
    const altMargin = (altNetProd + logisticsTotal) * (params.targetMarginPercent / 100);
    const altSubtotalEur = altNetProd + logisticsTotal + altMargin;
    const altTotalVatEur = altSubtotalEur * 1.2;

    const diffEur = altTotalVatEur - totalWithVatEur;
    const diffPercent = totalWithVatEur > 0 ? (diffEur / totalWithVatEur) * 100 : 0;
    const altLead = estimateLeadTimeForMaterials([altMat], false);

    return {
      materialId: altMat.id,
      materialName: altMat.name,
      totalWithVatEur: roundMm(altTotalVatEur, 2),
      totalWithVatTry: roundMm(altTotalVatEur * params.eurTryExchangeRate, 2),
      diffEur: roundMm(diffEur, 2),
      diffPercent: roundMm(diffPercent, 1),
      leadTimeLabel: altLead.label,
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
    paintshopLacquerCostEur: roundMm(paintshopLacquerCostEur, 2),
    miterAndSpecialCncCostEur: roundMm(miterAndSpecialCncCostEur, 2),
    glassAndAluminumFrameCostEur: roundMm(glassAndAluminumFrameCostEur, 2),
    deliveryAndInstallationEur: roundMm(deliveryAndInstallationEur, 2),
    rawMaterialsTotal: roundMm(rawMaterialsTotal, 2),
    laborCost: roundMm(laborCost, 2),
    operationalOverhead: roundMm(operationalOverhead, 2),
    netProductionCost: roundMm(netProductionCost, 2),
    assemblyCost: roundMm(installFee, 2),
    packagingCost: roundMm(bom.cutList.length > 0 ? params.packagingCostEur : 0, 2),
    marginAmount: roundMm(marginAmount, 2),
    subtotalNetEur: roundMm(subtotalNetEur, 2),
    subtotalNetTry: roundMm(subtotalNetTry, 2),
    vatRatePercent,
    vatAmountEur: roundMm(vatAmountEur, 2),
    vatAmountTry: roundMm(vatAmountTry, 2),
    totalWithVatEur: roundMm(totalWithVatEur, 2),
    totalWithVatTry: roundMm(totalWithVatTry, 2),
    leadTime,
    details: {
      materialLines,
      hardwareLines,
      surchargeLines,
      totalEdgeBandMeters: bom.summary.totalEdgeBandMeters,
      totalHolesCount,
    },
    materialAlternatives,
  };
}
