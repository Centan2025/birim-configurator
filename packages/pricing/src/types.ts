export interface PricingParameters {
  wasteFactorPercent: number; // e.g. 12 (%)
  laborRatePerHourEur: number; // e.g. 25 EUR / hr
  estimatedHoursPerM2: number; // e.g. 0.8 hr / m²
  operationalOverheadPercent: number; // e.g. 10 (%)
  assemblyCostEur: number; // e.g. 120 EUR
  targetMarginPercent: number; // e.g. 35 (%)
  currency: "EUR" | "TRY";
  eurTryExchangeRate: number; // e.g. 38.5
}

export interface PricingBreakdown {
  currency: "EUR" | "TRY";
  materialCost: number;
  edgeBandCost: number;
  hardwareCost: number;
  rawMaterialsTotal: number;
  laborCost: number;
  operationalOverhead: number;
  netProductionCost: number;
  assemblyCost: number;
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
  };
}
