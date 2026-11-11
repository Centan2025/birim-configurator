// ============================================================================
// packages/manufacturing/src/erp-nesting/erp-serialization.ts
// Birim ERP lib/nestingService.ts & PartListPanel.tsx birebir serileştirme katmanı
// ============================================================================

import type {
  ErpGrainDirection,
  ErpNestingPart,
  ErpNestingSheet,
} from "./erp-nesting-types";

export function normalizeErpEdgeValue(val?: string | null): string {
  if (!val) return "";
  const clean = val.trim().toLowerCase();
  if (
    clean === "" ||
    clean === "none" ||
    clean === "yok" ||
    clean.includes("bantsız") ||
    clean.includes("bantsiz")
  ) {
    return "";
  }
  if (clean.includes("2") || clean.includes("2.0") || clean.includes("2mm")) {
    return "2.00mm PVC";
  }
  if (clean.includes("1") || clean.includes("1.0") || clean.includes("1mm")) {
    return "1.00mm PVC";
  }
  if (clean.includes("0.4") || clean.includes("0.40")) {
    return "0.40mm PVC";
  }
  return val.trim();
}

export function formatErpTapeByThickness(
  hasBand: boolean,
  thicknessMm: number
): string {
  if (!hasBand || thicknessMm <= 0) return "";
  if (thicknessMm >= 1.8) return "2.00mm PVC";
  if (thicknessMm >= 0.7) return "1.00mm PVC";
  return "0.40mm PVC";
}

export function buildErpEdgeSummaryCode(p: {
  edgeL1?: string;
  edgeL2?: string;
  edgeW1?: string;
  edgeW2?: string;
}): string {
  const tags: string[] = [];
  if (p.edgeL1) tags.push("L1");
  if (p.edgeL2) tags.push("L2");
  if (p.edgeW1) tags.push("W1");
  if (p.edgeW2) tags.push("W2");
  return tags.join(",");
}

export function serializeErpEdgeBanding(p: {
  edge_banding?: string | null;
  edgeL1?: string;
  edgeL2?: string;
  edgeW1?: string;
  edgeW2?: string;
  hasGroove?: boolean;
  grooveSide?: string;
  grooveOffset?: number;
  grooveWidth?: number;
  grooveDepth?: number;
}): string | null {
  if (p.edgeL1 || p.edgeL2 || p.edgeW1 || p.edgeW2 || p.hasGroove) {
    const autoSummary = buildErpEdgeSummaryCode(p);
    return JSON.stringify({
      edgeL1: p.edgeL1 || "",
      edgeL2: p.edgeL2 || "",
      edgeW1: p.edgeW1 || "",
      edgeW2: p.edgeW2 || "",
      hasGroove: Boolean(p.hasGroove),
      grooveSide: p.grooveSide || "Alt",
      grooveOffset: p.grooveOffset ?? 20,
      grooveWidth: p.grooveWidth ?? 4,
      grooveDepth: p.grooveDepth ?? 8,
      summary: p.edge_banding || autoSummary,
    });
  }
  return p.edge_banding || null;
}

export function parseErpEdgeBanding(edgeBandingStr: string | null | undefined): {
  edgeL1?: string;
  edgeL2?: string;
  edgeW1?: string;
  edgeW2?: string;
  hasGroove?: boolean;
  grooveSide?: string;
  grooveOffset?: number;
  grooveWidth?: number;
  grooveDepth?: number;
  summary?: string;
} {
  if (!edgeBandingStr) return {};
  try {
    if (edgeBandingStr.startsWith("{")) {
      const parsed = JSON.parse(edgeBandingStr) as {
        edgeL1?: string;
        edgeL2?: string;
        edgeW1?: string;
        edgeW2?: string;
        hasGroove?: boolean;
        grooveSide?: string;
        grooveOffset?: number;
        grooveWidth?: number;
        grooveDepth?: number;
        summary?: string;
      };
      return {
        edgeL1: parsed.edgeL1 || undefined,
        edgeL2: parsed.edgeL2 || undefined,
        edgeW1: parsed.edgeW1 || undefined,
        edgeW2: parsed.edgeW2 || undefined,
        hasGroove: parsed.hasGroove ?? undefined,
        grooveSide: parsed.grooveSide || undefined,
        grooveOffset:
          parsed.grooveOffset !== undefined ? Number(parsed.grooveOffset) : undefined,
        grooveWidth:
          parsed.grooveWidth !== undefined ? Number(parsed.grooveWidth) : undefined,
        grooveDepth:
          parsed.grooveDepth !== undefined ? Number(parsed.grooveDepth) : undefined,
        summary: parsed.summary || undefined,
      };
    }
  } catch {
    // Plain text fallback
  }
  return { summary: edgeBandingStr };
}

export function parseErpSheetGrain(rawMaterialType: string | null | undefined): {
  cleanMaterialType: string;
  grainDirection: ErpGrainDirection;
} {
  if (!rawMaterialType) {
    return { cleanMaterialType: "MDF", grainDirection: "vertical" };
  }
  const match = rawMaterialType.match(/\[grain:(vertical|horizontal|none)\]/i);
  if (match) {
    const grainDirection = match[1].toLowerCase() as ErpGrainDirection;
    const cleanMaterialType = rawMaterialType
      .replace(/\[grain:(vertical|horizontal|none)\]/i, "")
      .trim();
    return { cleanMaterialType: cleanMaterialType || "MDF", grainDirection };
  }

  const lower = rawMaterialType.toLowerCase();
  if (
    lower.includes("düz") ||
    lower.includes("lake") ||
    lower.includes("beyaz") ||
    lower.includes("sac") ||
    lower.includes("metal") ||
    lower.includes("alüminyum") ||
    lower.includes("kompakt") ||
    lower.includes("pleksi") ||
    lower.includes("akrilik") ||
    lower.includes("ham") ||
    lower.includes("antrasit") ||
    lower.includes("kaşmir") ||
    lower.includes("kasmir") ||
    lower.includes("arkalık") ||
    lower.includes("arkalik")
  ) {
    return { cleanMaterialType: rawMaterialType, grainDirection: "none" };
  }

  return { cleanMaterialType: rawMaterialType, grainDirection: "vertical" };
}

export function formatErpMaterialTypeWithGrain(
  materialType: string,
  grain?: ErpGrainDirection | null
): string {
  const clean = materialType
    .replace(/\[grain:(vertical|horizontal|none)\]/i, "")
    .trim();
  if (!grain) return clean;
  return `${clean} [grain:${grain}]`;
}

export function adjustErpGrooveSideForRotation(
  originalSide: string | undefined,
  rotationDeg: number
): string {
  if (!originalSide) return "";
  let cleanSide = originalSide.trim().toLowerCase();
  if (cleanSide === "top" || cleanSide === "üst") cleanSide = "üst";
  if (cleanSide === "bottom" || cleanSide === "alt") cleanSide = "alt";
  if (cleanSide === "left" || cleanSide === "sol") cleanSide = "sol";
  if (cleanSide === "right" || cleanSide === "sağ") cleanSide = "sağ";

  const sides = ["alt", "sağ", "üst", "sol"];
  const sidesTr = ["Alt", "Sağ", "Üst", "Sol"];
  const index = sides.indexOf(cleanSide);
  if (index < 0) return originalSide;
  const shift = Math.floor(((rotationDeg % 360) + 360) % 360 / 90) % 4;
  return sidesTr[(index + shift) % 4];
}

export function mapErpPartFromDb(raw: ErpNestingPart): ErpNestingPart {
  const parsed = parseErpEdgeBanding(raw.edge_banding);
  return {
    ...raw,
    edgeL1: raw.edgeL1 ?? parsed.edgeL1,
    edgeL2: raw.edgeL2 ?? parsed.edgeL2,
    edgeW1: raw.edgeW1 ?? parsed.edgeW1,
    edgeW2: raw.edgeW2 ?? parsed.edgeW2,
    hasGroove: raw.hasGroove ?? parsed.hasGroove ?? false,
    grooveSide: raw.grooveSide ?? parsed.grooveSide ?? "Alt",
    grooveOffset: raw.grooveOffset ?? parsed.grooveOffset ?? 20,
    grooveWidth: raw.grooveWidth ?? parsed.grooveWidth ?? 4,
    grooveDepth: raw.grooveDepth ?? parsed.grooveDepth ?? 8,
    grain_direction: (raw.grain_direction as ErpGrainDirection) || null,
  };
}

export function mapErpSheetFromDb(raw: ErpNestingSheet): ErpNestingSheet {
  const parsed = parseErpSheetGrain(raw.material_type);
  return {
    ...raw,
    material_type: parsed.cleanMaterialType,
    grain_direction: raw.grain_direction || parsed.grainDirection,
  };
}
