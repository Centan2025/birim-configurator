import { ModuleInstance, ValidationIssue, UnitLength, DesignProject } from "./types";

export interface SystemRulesConfig {
  minCarcassWidth: UnitLength;
  maxCarcassWidth: UnitLength;
  minCarcassHeight: UnitLength;
  maxCarcassHeight: UnitLength;
  minCarcassDepth: UnitLength;
  maxCarcassDepth: UnitLength;
  maxShelfSpanWithoutSupport: UnitLength; // 950mm
  minDrawerHeight: UnitLength;
  maxDrawerHeight: UnitLength;
  minHangingSpaceHeight: UnitLength;
  standardPanelThicknesses: UnitLength[];
  hingeZonesY: UnitLength[]; // Typical hinge heights: ~100mm from bottom and top
}

export const DEFAULT_RULES: SystemRulesConfig = {
  minCarcassWidth: 200,
  maxCarcassWidth: 3600,
  minCarcassHeight: 300,
  maxCarcassHeight: 2800,
  minCarcassDepth: 200,
  maxCarcassDepth: 950,
  maxShelfSpanWithoutSupport: 950,
  minDrawerHeight: 80,
  maxDrawerHeight: 450,
  minHangingSpaceHeight: 850,
  standardPanelThicknesses: [16, 18, 19, 22, 25],
  hingeZonesY: [100, 850, 1500, 2050],
};

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
    return idx === 0 ? uniformWidth + remainder : uniformWidth;
  });
}

export function calculateNetInnerHeight(module: ModuleInstance): UnitLength {
  const { height } = module.dimensions;
  const { panelThickness, plinthHeight } = module.carcass;
  return Math.max(0, height - plinthHeight - 2 * panelThickness);
}

export function calculateNetInnerDepth(module: ModuleInstance): UnitLength {
  const { depth } = module.dimensions;
  const backOffset = 20;
  return Math.max(0, depth - backOffset);
}

/**
 * Validates a single module for manufacturing and physical constraints.
 */
export function validateModule(
  module: ModuleInstance,
  rules: SystemRulesConfig = DEFAULT_RULES
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { width, height, depth } = module.dimensions;

  // Basic boundaries
  if (width < rules.minCarcassWidth) {
    issues.push({
      severity: "error",
      code: "ERR_WIDTH_TOO_SMALL",
      message: `Genişlik ${width}mm, asgari sınır (${rules.minCarcassWidth}mm) altında.`,
      targetId: module.id,
      blockingProduction: true,
    });
  } else if (width > rules.maxCarcassWidth) {
    issues.push({
      severity: "error",
      code: "ERR_WIDTH_TOO_LARGE",
      message: `Genişlik ${width}mm, azami üretim sınırı (${rules.maxCarcassWidth}mm) üzerinde. Modülü 2 gövdeye bölünüz.`,
      targetId: module.id,
      blockingProduction: true,
    });
  }

  if (height < rules.minCarcassHeight) {
    issues.push({
      severity: "error",
      code: "ERR_HEIGHT_TOO_SMALL",
      message: `Yükseklik ${height}mm, asgari sınır (${rules.minCarcassHeight}mm) altında.`,
      targetId: module.id,
      blockingProduction: true,
    });
  } else if (height > rules.maxCarcassHeight) {
    issues.push({
      severity: "error",
      code: "ERR_HEIGHT_TOO_LARGE",
      message: `Yükseklik ${height}mm, standart plaka boyu (${rules.maxCarcassHeight}mm) üzerinde. Tepe modülü kullanınız.`,
      targetId: module.id,
      blockingProduction: true,
    });
  }

  if (depth < rules.minCarcassDepth) {
    issues.push({
      severity: "error",
      code: "ERR_DEPTH_TOO_SMALL",
      message: `Derinlik ${depth}mm, asgari derinlik (${rules.minCarcassDepth}mm) altında.`,
      targetId: module.id,
      blockingProduction: true,
    });
  }

  const bayWidths = calculateBayWidths(module);
  const netInnerHeight = calculateNetInnerHeight(module);

  // Check bay spans and interior collisions
  bayWidths.forEach((bayWidth, idx) => {
    if (bayWidth > rules.maxShelfSpanWithoutSupport) {
      issues.push({
        severity: "warning",
        code: "WARN_SHELF_SPAN_DEFLECTION",
        message: `Bölme ${idx + 1} genişliği (${bayWidth}mm), ${rules.maxShelfSpanWithoutSupport}mm'yi aşıyor; orta dikme önerilir.`,
        targetId: `bay_${idx}`,
      });
    }

    const bay = module.bays[idx];
    if (bay) {
      // Check drawers
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
            blockingProduction: true,
          });
        }

        // Check internal drawer hinge collision
        if (drawer.isInternal && bay.door.type !== "open") {
          // If drawer elevation matches hinge zone
          const isNearHinge = rules.hingeZonesY.some((hy) => Math.abs(drawer.elevationY - hy) < 50);
          if (isNearHinge) {
            issues.push({
              severity: "warning",
              code: "WARN_INTERNAL_DRAWER_HINGE_COLLISION",
              message: `Bölme ${idx + 1} iç çekmecesi menteşe montaj yüksekliği ile çakışabilir; menteşe payı (distans) gereklidir.`,
              targetId: drawer.id,
            });
          }
        }
      });

      // Check shelves
      bay.shelves.forEach((shelf, sIdx) => {
        if (shelf.elevationY > netInnerHeight) {
          issues.push({
            severity: "error",
            code: "ERR_SHELF_OVERFLOW",
            message: `Raf ${sIdx + 1} dolap üst sınırını aşıyor (${shelf.elevationY}mm > ${netInnerHeight}mm).`,
            targetId: shelf.id,
            blockingProduction: true,
          });
        }
      });

      // Check sliding door requirements
      if (bay.door.type === "sliding" && depth < 580) {
        issues.push({
          severity: "warning",
          code: "WARN_SLIDING_DOOR_DEPTH",
          message: `Sürgülü kapak mekanizması yaklaşık 80-100mm iç derinlik kaybı yaratır. Minimum 600mm gövde derinliği önerilir (Mevcut: ${depth}mm).`,
          targetId: bay.door.id,
        });
      }
    }
  });

  return issues;
}

/**
 * Validates entire project including multi-module collisions and architectural space boundaries.
 */
export function validateProject(project: DesignProject): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // 1. Module-level validations
  project.modules.forEach((mod) => {
    issues.push(...validateModule(mod));
  });

  // 2. Ceiling height check
  const ceiling = project.space.ceilingHeight || 2600;
  project.modules.forEach((mod) => {
    const modTopY = mod.position.y + mod.dimensions.height;
    if (modTopY > ceiling) {
      issues.push({
        severity: "error",
        code: "ERR_CEILING_COLLISION",
        message: `Modül "${mod.name}" yüksekliği (${modTopY}mm) tavan yüksekliğini (${ceiling}mm) aşıyor.`,
        targetId: mod.id,
        blockingProduction: true,
      });
    }
  });

  // 3. Multi-module 3D collision / overlap check (AABB)
  for (let i = 0; i < project.modules.length; i++) {
    for (let j = i + 1; j < project.modules.length; j++) {
      const m1 = project.modules[i];
      const m2 = project.modules[j];

      const xOverlap =
        m1.position.x < m2.position.x + m2.dimensions.width &&
        m1.position.x + m1.dimensions.width > m2.position.x;
      const yOverlap =
        m1.position.y < m2.position.y + m2.dimensions.height &&
        m1.position.y + m1.dimensions.height > m2.position.y;
      const zOverlap =
        m1.position.z < m2.position.z + m2.dimensions.depth &&
        m1.position.z + m1.dimensions.depth > m2.position.z;

      if (xOverlap && yOverlap && zOverlap) {
        issues.push({
          severity: "error",
          code: "ERR_MODULE_COLLISION",
          message: `"${m1.name}" ve "${m2.name}" modülleri 3D uzayda çakışıyor.`,
          targetId: `${m1.id}_${m2.id}`,
          blockingProduction: true,
        });
      }
    }
  }

  return issues;
}
