import { UnitLength, DrillingHole } from "@birim/core";
import { NestingOptimizationResult } from "./sheet-nesting";

export interface EdgeBandingConfig {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
  thickness: UnitLength; // e.g. 1mm or 2mm ABS
}

export type GrainDirection = "lengthwise" | "crosswise" | "none";

export interface CutPiece {
  id: string; // Stable part ID
  pieceName: string;
  moduleName: string;
  moduleId: string;
  componentRole: string;
  materialId: string;
  materialName: string;
  lengthMm: UnitLength; // Nominal finished length (Boy)
  widthMm: UnitLength; // Nominal finished width (En)
  nominalLengthMm?: UnitLength; // Bitmiş / Anma Boy (mm)
  nominalWidthMm?: UnitLength; // Bitmiş / Anma En (mm)
  netCutLengthMm?: UnitLength; // Testere Net Kesim Boyu (Bant kalınlığı düşülmüş, mm)
  netCutWidthMm?: UnitLength; // Testere Net Kesim Eni (Bant kalınlığı düşülmüş, mm)
  edgeBandCode?: string; // Fabrika kenar bant kodu (ör. "1B 1mm", "4K 1mm", "Bantsız")
  thicknessMm: UnitLength; // Thickness (Kalınlık)
  quantity: number;
  edgeBanding: EdgeBandingConfig;
  grain: GrainDirection;
  areaM2: number;
  edgeBandMeters: number;
  holes?: DrillingHole[];
  notes?: string;
}

export interface HardwareBOMItem {
  sku: string;
  name: string;
  category: "hinge" | "slide" | "handle" | "connector" | "leg" | "rod" | "fastener" | "special";
  quantity: number;
  unit: "adet" | "takım" | "metre";
  unitPrice: number;
  totalPrice: number;
}

export interface ShelfDeflectionBOMEntry {
  moduleId: string;
  moduleName: string;
  bayIndex: number;
  spanMm: number;
  depthMm: number;
  thicknessMm: number;
  deflectionMm: number;
  maxAllowedMm: number;
  passed: boolean;
  recommendation?: string;
}

export interface ProductionGateSummary {
  isReadyForErp: boolean;
  checks: {
    id: string;
    label: string;
    passed: boolean;
    detail: string;
  }[];
}

export interface ManufacturingBOM {
  projectId: string;
  version: number;
  createdAt: string;
  approvalStatus: "draft" | "technically_validated" | "production_approved";
  summary: {
    totalPiecesCount: number;
    totalPanelAreaM2: number;
    totalEdgeBandMeters: number;
    totalHardwareCount: number;
    totalDrillingHolesCount: number;
  };
  cutList: CutPiece[];
  hardwareList: HardwareBOMItem[];
  materialUsage: {
    materialId: string;
    materialName: string;
    grossAreaM2: number; // Flat 12% standard fallback
    netAreaM2: number;
    estimatedSheetsCount: number;
  }[];
  nestingResults: NestingOptimizationResult[]; // Real 2D Guillotine Bin Packing Results
  validationWarnings: string[];
  shelfDeflectionAnalyses?: ShelfDeflectionBOMEntry[];
  productionGate?: ProductionGateSummary;
}
