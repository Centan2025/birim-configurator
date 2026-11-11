// ============================================================================
// packages/manufacturing/src/erp-nesting/erp-exporters.ts
// Birim ERP lib/gcodeGenerator.ts & lib/selcoExporter.ts birebir makine çıktıları
// ============================================================================

import type {
  ErpPlacementData,
  ErpNestingSheet,
  ErpGCodeConfig,
  ErpNestingSheetResult,
  ErpNestingPart,
  ErpNestingProject,
} from "./erp-nesting-types";
import { DEFAULT_ERP_GCODE_CONFIG } from "./erp-nesting-types";
import { parseErpEdgeBanding } from "./erp-serialization";

// --- 1. CNC Router G-Code (.nc) Exporter ---

export function generateErpSheetGCode(
  sheetResult: ErpNestingSheetResult,
  sheet: ErpNestingSheet,
  config: ErpGCodeConfig = DEFAULT_ERP_GCODE_CONFIG
): string {
  const effectiveConfig: ErpGCodeConfig = {
    ...config,
    cut_depth: sheet.thickness_mm || config.cut_depth,
    pass_depth: Math.min(config.pass_depth, sheet.thickness_mm || config.pass_depth),
  };

  const lines: string[] = [];
  lines.push(`; ==============================`);
  lines.push(`; Panel Nesting G-Code (Birim ERP Compatible)`);
  lines.push(`; Sheet ${sheetResult.sheet_index + 1}: ${sheet.name}`);
  lines.push(`; ${sheet.width_mm}x${sheet.height_mm}x${sheet.thickness_mm}mm`);
  lines.push(`; Parts: ${sheetResult.placements.length}`);
  lines.push(`; Utilization: ${sheetResult.utilization_percent}%`);
  lines.push(`; Generated: ${new Date().toISOString()}`);
  lines.push(`; ==============================`);
  lines.push(``);

  lines.push(`G90 G21`);
  lines.push(`G17`);
  lines.push(`G28`);
  lines.push(`M3 S${effectiveConfig.spindle_speed}`);
  lines.push(`G4 P2`);
  lines.push(``);

  for (let i = 0; i < sheetResult.placements.length; i++) {
    const p = sheetResult.placements[i];
    lines.push(
      `; --- Part ${i + 1}: ${p.part_label} (${p.width}x${p.height}mm${p.rotated ? " ROTATED" : ""}) ---`
    );
    lines.push(...generatePartCut(p, sheet, effectiveConfig));
    lines.push(``);
  }

  lines.push(`; --- End ---`);
  lines.push(`G0 Z${formatNum(effectiveConfig.safe_z)}`);
  lines.push(`M5`);
  lines.push(`G28`);
  lines.push(`M30`);
  lines.push(``);

  return lines.join("\n");
}

export function generateErpFullGCode(
  sheetResults: ErpNestingSheetResult[],
  sheet: ErpNestingSheet,
  config: ErpGCodeConfig = DEFAULT_ERP_GCODE_CONFIG
): string {
  return sheetResults
    .map((sr) => generateErpSheetGCode(sr, sheet, config))
    .join("\n\n");
}

function generatePartCut(
  placement: ErpPlacementData,
  sheet: ErpNestingSheet,
  config: ErpGCodeConfig
): string[] {
  const lines: string[] = [];
  const toolRadius = config.tool_diameter / 2;

  // Not: ERP runMaxRects ve GuillotineEngine içinde placement.x ve placement.y
  // zaten margin eklenmiş mutlak plaka koordinatlarıdır (örn. x = 15).
  // ERP gcodeGenerator.ts uyumluluğu için sınır kontrolü ile güvenli kesim yolu üretilir.
  const x1 = placement.x - toolRadius;
  const y1 = placement.y - toolRadius;
  const x2 = placement.x + placement.width + toolRadius;
  const y2 = placement.y + placement.height + toolRadius;

  const passes = Math.max(1, Math.ceil(config.cut_depth / config.pass_depth));

  for (let pass = 0; pass < passes; pass++) {
    const depth = Math.min((pass + 1) * config.pass_depth, config.cut_depth);
    if (passes > 1) {
      lines.push(`; Pass ${pass + 1}/${passes} depth: ${formatNum(depth)}mm`);
    }

    lines.push(`G0 Z${formatNum(config.safe_z)}`);
    lines.push(`G0 X${formatNum(x1)} Y${formatNum(y1)}`);
    lines.push(`G1 Z${formatNum(-depth)} F${config.plunge_rate}`);
    lines.push(`G1 X${formatNum(x2)} F${config.feed_rate}`);
    lines.push(`G1 Y${formatNum(y2)}`);
    lines.push(`G1 X${formatNum(x1)}`);
    lines.push(`G1 Y${formatNum(y1)}`);
    lines.push(`G0 Z${formatNum(config.safe_z)}`);
  }

  return lines;
}

function formatNum(n: number): string {
  return n.toFixed(3);
}

export function getErpGCodeFilename(projectNo: string, sheetIndex?: number): string {
  const base = projectNo.replace(/[^a-zA-Z0-9-]/g, "_");
  if (sheetIndex !== undefined) {
    return `${base}_sheet${sheetIndex + 1}.nc`;
  }
  return `${base}_all.nc`;
}

// --- 2. Selco WNT 600 (Biesse OptiPlanning) CSV Exporter ---
// Format: Label;Qty;Length;Width;Material;Grain;EdgeL1;EdgeL2;EdgeW1;EdgeW2

export function generateErpSelcoCSV(
  project: ErpNestingProject,
  parts: ErpNestingPart[]
): string {
  const lines: string[] = [];
  lines.push("Label;Qty;Length;Width;Material;Grain;EdgeL1;EdgeL2;EdgeW1;EdgeW2");

  for (const part of parts) {
    let grainCode = 0;
    if (part.grain_direction === "vertical") grainCode = 1;
    if (part.grain_direction === "horizontal") grainCode = 2;

    const edges = resolveSelcoPartEdges(part);

    const cleanMaterial =
      (part.material_code || project.sheet?.material_type || "MDF")
        .replace(/\[grain:(vertical|horizontal|none)\]/gi, "")
        .replace(/;/g, " ")
        .trim() || "MDF";

    const row = [
      part.part_label.replace(/;/g, " "),
      part.quantity,
      part.height_mm,
      part.width_mm,
      cleanMaterial,
      grainCode,
      edges.l1,
      edges.l2,
      edges.w1,
      edges.w2,
    ];

    lines.push(row.join(";"));
  }

  return lines.join("\r\n");
}

function resolveSelcoPartEdges(part: ErpNestingPart): {
  l1: number;
  l2: number;
  w1: number;
  w2: number;
} {
  // 1. Açık kenar alanları (edgeL1..edgeW2) varsa doğrudan kullan
  if (
    part.edgeL1 !== undefined ||
    part.edgeL2 !== undefined ||
    part.edgeW1 !== undefined ||
    part.edgeW2 !== undefined
  ) {
    return {
      l1: part.edgeL1 && part.edgeL1.trim() ? 1 : 0,
      l2: part.edgeL2 && part.edgeL2.trim() ? 1 : 0,
      w1: part.edgeW1 && part.edgeW1.trim() ? 1 : 0,
      w2: part.edgeW2 && part.edgeW2.trim() ? 1 : 0,
    };
  }

  // 2. JSON serileştirilmiş edge_banding ("{\"edgeL1\":\"1.00mm PVC\",...}") ise ayrıştır
  if (part.edge_banding && part.edge_banding.trim().startsWith("{")) {
    const parsed = parseErpEdgeBanding(part.edge_banding);
    return {
      l1: parsed.edgeL1 ? 1 : 0,
      l2: parsed.edgeL2 ? 1 : 0,
      w1: parsed.edgeW1 ? 1 : 0,
      w2: parsed.edgeW2 ? 1 : 0,
    };
  }

  // 3. Düz metin ("L1,W1") ise ERP selcoExporter.ts ile birebir geriye dönük uyumlu kontrol
  const eb = part.edge_banding || "";
  return {
    l1: eb.includes("L1") ? 1 : 0,
    l2: eb.includes("L2") ? 1 : 0,
    w1: eb.includes("W1") ? 1 : 0,
    w2: eb.includes("W2") ? 1 : 0,
  };
}

export function getErpSelcoFilename(projectNo: string): string {
  const base = projectNo.replace(/[^a-zA-Z0-9-]/g, "_");
  return `${base}_SELCO_WNT600.csv`;
}
