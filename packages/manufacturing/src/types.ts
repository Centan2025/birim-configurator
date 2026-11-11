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
  lengthMm: UnitLength; // Nominal finished length (Boy — along grain when grained, Y axis in panel DXF)
  widthMm: UnitLength; // Nominal finished width (En — across grain, X axis in panel DXF)
  nominalLengthMm?: UnitLength; // Bitmiş / Anma Boy (mm)
  nominalWidthMm?: UnitLength; // Bitmiş / Anma En (mm)
  netCutLengthMm?: UnitLength; // Testere Net Kesim Boyu (Bant - Ön Freze düşülmüş, mm)
  netCutWidthMm?: UnitLength; // Testere Net Kesim Eni (Bant - Ön Freze düşülmüş, mm)
  preMillingMm?: UnitLength; // Kenar bantlama ön freze bıçak kazıma payı (mm)
  edgeBandCode?: string; // Fabrika kenar bant kodu (ör. "1B 1mm", "4K 1mm", "Bantsız")
  thicknessMm: UnitLength; // Thickness (Kalınlık)
  quantity: number;
  edgeBanding: EdgeBandingConfig;
  grain: GrainDirection;
  grainGroupId?: string;
  cncFileName?: string;
  areaM2: number;
  edgeBandMeters: number;
  holes?: DrillingHole[];
  notes?: string;
  /** True when right side panel is mirrored in X so inner face is referenced upward on CNC */
  mirrorInnerFaceX?: boolean;
  /** Back groove routing active on this panel */
  hasBackGroove?: boolean;
  /** Back groove distance from rear edge (default 18-20mm) */
  backGrooveOffsetMm?: UnitLength;
  /** Back groove width (t_back + 0.5mm, e.g. 8.5mm) */
  backGrooveWidthMm?: UnitLength;
  /** Optional CNC LED groove routing metadata */
  ledGrooveSpec?: {
    enabled: boolean;
    offsetFromFrontMm: UnitLength;
    widthMm: UnitLength;
    depthMm: UnitLength;
    cableExitHole?: boolean;
  };
  /** Optional Gola L/C profile notches on front edge of side/divider panels */
  golaNotches?: {
    kind: "L_TOP" | "C_MID";
    yBottomMm: UnitLength;
    widthMm: UnitLength;
    heightMm: UnitLength;
  }[];
  /** Optional U-shaped siphon cutout on under-sink drawer bottom & back */
  siphonCutout?: {
    widthMm: UnitLength;
    depthMm: UnitLength;
  };
  /** Explicit sink/cooktop CNC cutout metadata (prevents false cutouts on plain countertops) */
  hasSinkOrHobCutout?: boolean;
  cutoutWidthMm?: UnitLength;
  cutoutDepthMm?: UnitLength;
  cutoutCenterXMm?: UnitLength;
  utilityCutouts?: import("@birim/core").PanelCutoutConfig[];
  /** Carcass joinery topology (sides_through, top_bottom_through, miter_45, kitchen_stretchers) */
  carcassJoineryTopology?: "sides_through" | "top_bottom_through" | "miter_45" | "kitchen_stretchers";
  /** Back panel construction mode (grooved, rebated, nailed, flush, none) */
  backPanelMode?: "grooved" | "rebated" | "nailed" | "flush" | "none";
  /** Wooden drawer 8.5mm x 6mm bottom groove (13mm above bottom edge on 16mm wooden sides & front) */
  hasDrawerBottomGroove?: boolean;
  drawerBottomGrooveOffsetMm?: UnitLength;
  drawerBottomGrooveWidthMm?: UnitLength;
  drawerBottomGrooveDepthMm?: UnitLength;
  /** Top-left & top-right corner notches on grooved wall-cabinet back panels for EN 14749 hangers */
  wallHangerCornerNotches?: {
    widthMm: UnitLength;
    heightMm: UnitLength;
  };
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
    totalWeightKg?: number;
  };
  cutList: CutPiece[];
  hardwareList: HardwareBOMItem[];
  materialUsage: {
    materialId: string;
    materialName: string;
    grossAreaM2: number;
    netAreaM2: number;
    estimatedSheetsCount: number;
  }[];
  nestingResults: NestingOptimizationResult[];
  validationWarnings: string[];
  shelfDeflectionAnalyses?: ShelfDeflectionBOMEntry[];
  productionGate?: ProductionGateSummary;
}
