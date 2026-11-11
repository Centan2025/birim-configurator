import { OptimizedSheet } from "./sheet-nesting";

export interface SelcoMachineConfig {
  machineModel: "Biesse_Selco_WNT_600";
  sawBladeKerfMm: number;
  minGripperCutWidthMm: number;
  trimCutLeftMm: number;
  trimCutRightMm: number;
  trimCutTopMm: number;
  trimCutBottomMm: number;
  scoringBladeKerfMm: number;
  feedSpeedMPerMin: number;
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

function escapeXmlAttr(value: string | number | boolean): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
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

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<BiesseProductionBatch id="${escapeXmlAttr(batchId)}" machine="${escapeXmlAttr(
    config.machineModel
  )}" status="UNVERIFIED_DRAFT">\n`;
  xml += `  <MachineParameters kerf="${escapeXmlAttr(
    config.sawBladeKerfMm
  )}" minGripper="${escapeXmlAttr(config.minGripperCutWidthMm)}" feedSpeed="${escapeXmlAttr(
    config.feedSpeedMPerMin
  )}"/>\n`;
  sawingPatterns.forEach((p) => {
    xml += `  <SheetPattern sheetIndex="${escapeXmlAttr(
      p.sheetIndex
    )}" material="${escapeXmlAttr(p.material)}" length="${escapeXmlAttr(
      p.sheetLength
    )}" width="${escapeXmlAttr(p.sheetWidth)}">\n`;
    p.cuts.forEach((c) => {
      xml += `    <Part pieceId="${escapeXmlAttr(c.partId)}" label="${escapeXmlAttr(
        c.partLabel
      )}" x="${escapeXmlAttr(c.x)}" y="${escapeXmlAttr(c.y)}" length="${escapeXmlAttr(
        c.length
      )}" width="${escapeXmlAttr(c.width)}" rotated="${escapeXmlAttr(c.rotated)}"/>\n`;
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
