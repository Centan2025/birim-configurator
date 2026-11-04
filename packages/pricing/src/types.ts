export interface PricingParameters {
  wasteFactorPercent: number; // e.g. 12 (%)
  laborRatePerHourEur: number; // e.g. 28 EUR / hr
  estimatedHoursPerM2: number; // e.g. 0.65 hr / m²
  operationalOverheadPercent: number; // e.g. 10 (%)
  assemblyCostEur: number; // e.g. 95 EUR
  cncCostPerHoleEur: number; // e.g. 0.04 EUR per hole
  packagingCostEur: number; // e.g. 35 EUR
  targetMarginPercent: number; // e.g. 35 (%)
  currency: "EUR" | "TRY";
  eurTryExchangeRate: number; // e.g. 38.5
}

export interface MaterialAlternativeComparison {
  materialId: string;
  materialName: string;
  totalWithVatEur: number;
  totalWithVatTry: number;
  diffEur: number;
  diffPercent: number;
}

export interface PricingBreakdown {
  currency: "EUR" | "TRY";
  materialCost: number;
  edgeBandCost: number;
  hardwareCost: number;
  cncDrillingCost: number;
  rawMaterialsTotal: number;
  laborCost: number;
  operationalOverhead: number;
  netProductionCost: number;
  assemblyCost: number;
  packagingCost: number;
  marginAmount: number;
  subtotalNetEur: number;
  subtotalNetTry: number;
  vatRatePercent: number;
  vatAmountEur: number;
  vatAmountTry: number;
  totalWithVatEur: number;
  totalWithVatTry: number;
  details: {
    materialLines: { name: string; grossAreaM2: number; rateEur: number; totalEur: number }[];
    hardwareLines: { name: string; qty: number; unitPriceEur: number; totalEur: number }[];
    totalEdgeBandMeters: number;
    totalHolesCount: number;
  };
  materialAlternatives?: MaterialAlternativeComparison[];
}
