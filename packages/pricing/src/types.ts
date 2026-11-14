export interface PricingParameters {
  wasteFactorPercent: number; // e.g. 12 (%)
  laborRatePerHourEur: number; // e.g. 28 EUR / hr
  estimatedHoursPerM2: number; // e.g. 0.65 hr / m²
  operationalOverheadPercent: number; // e.g. 10 (%)
  assemblyCostEur: number; // Base on-site installation fee (EUR)
  perModuleInstallEur?: number; // Additional installation fee per module (EUR)
  deliveryBaseEur?: number; // Urban transport & floor carry base fee (EUR)
  cncCostPerHoleEur: number; // e.g. 0.04 EUR per hole
  packagingCostEur: number; // e.g. 35 EUR
  targetMarginPercent: number; // e.g. 35 (%)
  minSpecialDecorBoardFraction?: number; // Default 0.5 sheet (2.898 m²) minimum factory board open rule for special colors
  lacquerPaintshopMatteEurPerM2?: number; // Default 18 EUR/m² booth primer + topcoat
  lacquerPaintshopGlossEurPerM2?: number; // Default 26 EUR/m² high-gloss buffing
  miter45LinearMeterEur?: number; // Default 9.5 EUR/m 5-axis aggregate bevel cut
  currency: "EUR" | "TRY";
  eurTryExchangeRate: number; // Dynamic EUR/TRY rate (default 41.80)
}

export interface MaterialAlternativeComparison {
  materialId: string;
  materialName: string;
  totalWithVatEur: number;
  totalWithVatTry: number;
  diffEur: number;
  diffPercent: number;
  leadTimeLabel?: string;
}

export interface LeadTimeEstimate {
  minBusinessDays: number;
  maxBusinessDays: number;
  label: string;
  reason: string;
}

export interface PricingBreakdown {
  currency: "EUR" | "TRY";
  materialCost: number;
  materialCostEur?: number;
  edgeBandCost: number;
  edgeBandCostEur?: number;
  hardwareCost: number;
  hardwareCostEur?: number;
  laborCostEur?: number;
  cncDrillingCost: number;
  paintshopLacquerCostEur: number;
  miterAndSpecialCncCostEur: number;
  glassAndAluminumFrameCostEur: number;
  deliveryAndInstallationEur: number;
  commercialObjectsCostEur?: number;
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
  leadTime: LeadTimeEstimate;
  details: {
    materialLines: {
      name: string;
      grossAreaM2: number;
      rateEur: number;
      totalEur: number;
      minSheetApplied?: boolean;
    }[];
    hardwareLines: { name: string; qty: number; unitPriceEur: number; totalEur: number }[];
    surchargeLines: { label: string; totalEur: number }[];
    commercialObjectLines?: { sku: string; name: string; qty: number; unitPriceEur: number; totalEur: number }[];
    totalEdgeBandMeters: number;
    totalHolesCount: number;
  };
  materialAlternatives?: MaterialAlternativeComparison[];
}
