import { UnitLength } from "@birim/core";

export interface EdgeBandingConfig {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
  thickness: UnitLength; // e.g. 1mm or 2mm ABS
}

export type GrainDirection = "lengthwise" | "crosswise" | "none";

export interface CutPiece {
  id: string;
  pieceName: string;
  moduleName: string;
  componentRole: string;
  materialId: string;
  materialName: string;
  lengthMm: UnitLength; // Net length (Boy)
  widthMm: UnitLength; // Net width (En)
  thicknessMm: UnitLength; // Thickness (Kalınlık)
  quantity: number;
  edgeBanding: EdgeBandingConfig;
  grain: GrainDirection;
  areaM2: number;
  edgeBandMeters: number;
  notes?: string;
}

export interface HardwareBOMItem {
  sku: string;
  name: string;
  category: "hinge" | "slide" | "handle" | "connector" | "leg" | "rod" | "fastener";
  quantity: number;
  unit: "adet" | "takım" | "metre";
  unitPrice: number;
  totalPrice: number;
}

export interface ManufacturingBOM {
  projectId: string;
  version: number;
  createdAt: string;
  summary: {
    totalPiecesCount: number;
    totalPanelAreaM2: number;
    totalEdgeBandMeters: number;
    totalHardwareCount: number;
  };
  cutList: CutPiece[];
  hardwareList: HardwareBOMItem[];
  materialUsage: {
    materialId: string;
    materialName: string;
    grossAreaM2: number; // including 12% standard waste factor
    netAreaM2: number;
    estimatedSheetsCount: number; // standard 2800x2070 sheet (5.796 m²)
  }[];
  validationWarnings: string[];
}
