import { ModuleInstance, ValidationIssue, UnitLength } from "./types";

export interface SystemRulesConfig {
  minCarcassWidth: UnitLength;
  maxCarcassWidth: UnitLength;
  minCarcassHeight: UnitLength;
  maxCarcassHeight: UnitLength;
  minCarcassDepth: UnitLength;
  maxCarcassDepth: UnitLength;
  maxShelfSpanWithoutSupport: UnitLength; // Deflection threshold: e.g. 950mm
  minDrawerHeight: UnitLength;
  maxDrawerHeight: UnitLength;
  minHangingSpaceHeight: UnitLength; // e.g. 850mm for shirts, 1300mm for long coats
  standardPanelThicknesses: UnitLength[];
}

export const DEFAULT_RULES: SystemRulesConfig = {
  minCarcassWidth: 300,
  maxCarcassWidth: 3600,
  minCarcassHeight: 400,
  maxCarcassHeight: 2800,
  minCarcassDepth: 250,
  maxCarcassDepth: 900,
  maxShelfSpanWithoutSupport: 950,
  minDrawerHeight: 100,
  maxDrawerHeight: 450,
  minHangingSpaceHeight: 850,
  standardPanelThicknesses: [16, 18, 19, 22, 25],
};

/**
 * Calculates net interior widths for each bay in a module.
 * Net width = (Total Width - 2 * outerSideThickness - (numBays - 1) * dividerThickness) divided by bays
 */
export function calculateBayWidths(module: ModuleInstance): UnitLength[] {
  const { width } = module.dimensions;
  const { panelThickness } = module.carcass;
  const numBays = Math.max(1, module.bays.length);

  const totalDividerThickness = (numBays - 1) * panelThickness;
  const totalOuterThickness = 2 * panelThickness;
  const availableInnerWidth = width - totalOuterThickness - totalDividerThickness;

  if (availableInnerWidth <= 0) {
    return module.bays.map(() => 0);
  }

  // Check if any bays have custom fixed widths
  const fixedBays = module.bays.filter((b) => b.customWidth && b.customWidth > 0);
  const totalFixedWidth = fixedBays.reduce((sum, b) => sum + (b.customWidth || 0), 0);
  const variableBaysCount = numBays - fixedBays.length;

  if (variableBaysCount === 0) {
    return module.bays.map((b) => b.customWidth || 0);
  }

  const remainingWidth = Math.max(0, availableInnerWidth - totalFixedWidth);
  const uniformWidth = Math.floor(remainingWidth / variableBaysCount);
  const remainder = remainingWidth - uniformWidth * variableBaysCount;

  return module.bays.map((b, idx) => {
    if (b.customWidth && b.customWidth > 0) {
      return b.customWidth;
    }
    // Allocate integer remainder to first variable bay
    return idx === 0 ? uniformWidth + remainder : uniformWidth;
  });
}

/**
 * Calculates net inner height of carcass:
 * Net Height = Total Height - plinthHeight - 2 * panelThickness (bottom & top panels)
 */
export function calculateNetInnerHeight(module: ModuleInstance): UnitLength {
  const { height } = module.dimensions;
  const { panelThickness, plinthHeight } = module.carcass;
  return Math.max(0, height - plinthHeight - 2 * panelThickness);
}

/**
 * Calculates net inner depth of carcass:
 * Net Depth = Total Depth - backPanelGrooveOffset (typically 20mm inset for back panel)
 */
export function calculateNetInnerDepth(module: ModuleInstance): UnitLength {
  const { depth } = module.dimensions;
  const backOffset = 20; // standard 20mm clearance for wall unevenness + groove
  return Math.max(0, depth - backOffset);
}

/**
 * Validates module against structural & manufacturing limits
 */
export function validateModule(
  module: ModuleInstance,
  rules: SystemRulesConfig = DEFAULT_RULES
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { width, height, depth } = module.dimensions;

  // Carcass dimensions checks
  if (width < rules.minCarcassWidth) {
    issues.push({
      severity: "error",
      code: "ERR_WIDTH_TOO_SMALL",
      message: `Genişlik ${width}mm, izin verilen minimum ${rules.minCarcassWidth}mm'den küçük.`,
      targetId: module.id,
    });
  } else if (width > rules.maxCarcassWidth) {
    issues.push({
      severity: "error",
      code: "ERR_WIDTH_TOO_LARGE",
      message: `Genişlik ${width}mm, izin verilen maksimum ${rules.maxCarcassWidth}mm'den büyük.`,
      targetId: module.id,
    });
  }

  if (height < rules.minCarcassHeight) {
    issues.push({
      severity: "error",
      code: "ERR_HEIGHT_TOO_SMALL",
      message: `Yükseklik ${height}mm, izin verilen minimum ${rules.minCarcassHeight}mm'den küçük.`,
      targetId: module.id,
    });
  } else if (height > rules.maxCarcassHeight) {
    issues.push({
      severity: "error",
      code: "ERR_HEIGHT_TOO_LARGE",
      message: `Yükseklik ${height}mm, izin verilen maksimum ${rules.maxCarcassHeight}mm'den büyük.`,
      targetId: module.id,
    });
  }

  if (depth < rules.minCarcassDepth) {
    issues.push({
      severity: "error",
      code: "ERR_DEPTH_TOO_SMALL",
      message: `Derinlik ${depth}mm, izin verilen minimum ${rules.minCarcassDepth}mm'den küçük.`,
      targetId: module.id,
    });
  }

  const bayWidths = calculateBayWidths(module);
  const netInnerHeight = calculateNetInnerHeight(module);

  // Check bay spans for shelf deflection risk
  bayWidths.forEach((bayWidth, idx) => {
    if (bayWidth > rules.maxShelfSpanWithoutSupport) {
      issues.push({
        severity: "warning",
        code: "WARN_SHELF_SPAN_DEFLECTION",
        message: `Bölme ${idx + 1} genişliği (${bayWidth}mm), ${rules.maxShelfSpanWithoutSupport}mm sınırını aşıyor; orta dikme önerilir.`,
        targetId: `bay_${idx}`,
      });
    }

    const bay = module.bays[idx];
    if (bay) {
      // Check drawer heights & elevation bounds
      bay.drawers.forEach((drawer, dIdx) => {
        if (drawer.height < rules.minDrawerHeight || drawer.height > rules.maxDrawerHeight) {
          issues.push({
            severity: "warning",
            code: "WARN_DRAWER_HEIGHT",
            message: `Çekmece ${dIdx + 1} yüksekliği (${drawer.height}mm) standart sınırlar dışında (${rules.minDrawerHeight}-${rules.maxDrawerHeight}mm).`,
            targetId: drawer.id,
          });
        }
        if (drawer.elevationY + drawer.height > netInnerHeight) {
          issues.push({
            severity: "error",
            code: "ERR_DRAWER_OVERFLOW",
            message: `Çekmece ${dIdx + 1} dolap iç yüksekliğini aşıyor (${drawer.elevationY + drawer.height}mm > ${netInnerHeight}mm).`,
            targetId: drawer.id,
          });
        }
      });

      // Check shelf elevation bounds
      bay.shelves.forEach((shelf, sIdx) => {
        if (shelf.elevationY > netInnerHeight) {
          issues.push({
            severity: "error",
            code: "ERR_SHELF_OVERFLOW",
            message: `Raf ${sIdx + 1} dolap üst sınırını aşıyor (${shelf.elevationY}mm > ${netInnerHeight}mm).`,
            targetId: shelf.id,
          });
        }
      });
    }
  });

  return issues;
}
