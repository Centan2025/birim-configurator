import { OptimizedSheet } from "./sheet-nesting";

export interface SelcoMachineConfig {
  machineModel: "Biesse_Selco_WNT_600";
  sawBladeKerfMm: number; // 4.4mm (UNVERIFIED: confirm blade specs from factory)
  minGripperCutWidthMm: number; // 70mm (UNVERIFIED: verify clamp gripper depth on physical machine)
  trimCutLeftMm: number; // 15mm
  trimCutRightMm: number; // 15mm
  trimCutTopMm: number; // 15mm
  trimCutBottomMm: number; // 15mm
  scoringBladeKerfMm: number; // 3.2mm çizici bıçak (UNVERIFIED)
  feedSpeedMPerMin: number; // 60 m/min (UNVERIFIED)
  controllerFormat: "OSAI_OPEN_XML" | "BIESSE_CIX_OPT";
}

export const DEFAULT_SELCO_CONFIG: SelcoMachineConfig = {
  machineModel: "Biesse_Selco_WNT_600",
  sawBladeKerfMm: 4.4,
  minGripperCutWidthMm: 70,
  trimCutLeftMm: 15,
  trimCutRightMm: 15,
  trimCutTopMm: 15,
  trimCutBottomMm: 15,
  scoringBladeKerfMm: 3.2,
  feedSpeedMPerMin: 60,
  controllerFormat: "OSAI_OPEN_XML",
};

export interface SelcoExportPackage {
  batchId: string;
  generatedAt: string;
  machineTarget: string;
  status: "DRAFT_UNVERIFIED_PENDING_FACTORY_CONFIRMATION";
  sheetCount: number;
  sawingPatterns: {
    sheetIndex: number;
    material: string;
    sheetWidth: number;
    sheetLength: number;
    cutsCount: number;
    cuts: {
      cutIndex: number;
      partId: string;
      partLabel: string;
      length: number;
      width: number;
      x: number;
      y: number;
      rotated: boolean;
    }[];
  }[];
  xmlOutputDraft: string;
  unverifiedNotes: string[];
}

export function generateSelcoExportPackage(
  optimizedSheets: OptimizedSheet[],
  config: SelcoMachineConfig = DEFAULT_SELCO_CONFIG
): SelcoExportPackage {
  const batchId = `SELCO_BATCH_${Date.now()}`;
  const unverifiedNotes = [
    "UNVERIFIED: Bıçak kerf değeri (4.4mm) fabrika Selco takım tablosu ile doğrulanmalıdır.",
    "UNVERIFIED: Tutucu kıskaç minimum ölçüsü (70mm) fabrika şefi tarafından onaylanmalıdır.",
    "UNVERIFIED: CIX/XML dosya yüklemesi öncesinde Selco OptiPlanning yazılımında ön izleme yapılmalıdır.",
  ];

  const sawingPatterns = optimizedSheets.map((sheet) => ({
    sheetIndex: sheet.sheetIndex,
    material: sheet.materialName,
    sheetWidth: sheet.sheetDimension.widthMm,
    sheetLength: sheet.sheetDimension.lengthMm,
    cutsCount: sheet.placedPieces.length,
    cuts: sheet.placedPieces.map((p, idx) => ({
      cutIndex: idx + 1,
      partId: p.pieceId,
      partLabel: p.pieceName,
      length: p.length,
      width: p.width,
      x: p.x,
      y: p.y,
      rotated: p.isRotated,
    })),
  }));

  // Generate XML draft for Selco controller
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<BiesseProductionBatch id="${batchId}" machine="${config.machineModel}" status="UNVERIFIED_DRAFT">\n`;
  xml += `  <MachineParameters kerf="${config.sawBladeKerfMm}" minGripper="${config.minGripperCutWidthMm}" feedSpeed="${config.feedSpeedMPerMin}"/>\n`;
  sawingPatterns.forEach((p) => {
    xml += `  <SheetPattern sheetIndex="${p.sheetIndex}" material="${p.material}" length="${p.sheetLength}" width="${p.sheetWidth}">\n`;
    p.cuts.forEach((c) => {
      xml += `    <Part pieceId="${c.partId}" label="${c.partLabel}" x="${c.x}" y="${c.y}" length="${c.length}" width="${c.width}" rotated="${c.rotated}"/>\n`;
    });
    xml += `  </SheetPattern>\n`;
  });
  xml += `</BiesseProductionBatch>\n`;

  return {
    batchId,
    generatedAt: new Date().toISOString(),
    machineTarget: config.machineModel,
    status: "DRAFT_UNVERIFIED_PENDING_FACTORY_CONFIRMATION",
    sheetCount: optimizedSheets.length,
    sawingPatterns,
    xmlOutputDraft: xml,
    unverifiedNotes,
  };
}
