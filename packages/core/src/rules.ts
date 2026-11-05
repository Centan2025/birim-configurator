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

/** Module position is the minimum room-plan corner, rotation is in degrees. */
export function calculateModulePlacement(module: ModuleInstance) {
  const rotationYRad = ((module.rotation?.y ?? 0) * Math.PI) / 180;
  const c = Math.cos(rotationYRad),
    s = Math.sin(rotationYRad);
  const corners = [0, module.dimensions.width].flatMap((x) =>
    [0, module.dimensions.depth].map((z) => ({ x: x * c + z * s, z: -x * s + z * c }))
  );
  const minX = Math.min(...corners.map((p) => p.x)),
    minZ = Math.min(...corners.map((p) => p.z));
  return {
    rotationYRad,
    origin: { x: module.position.x - minX, y: module.position.y, z: module.position.z - minZ },
    width: Math.max(...corners.map((p) => p.x)) - minX,
    depth: Math.max(...corners.map((p) => p.z)) - minZ,
  };
}

/**
 * Computes the 3D AABB of a module's front door/drawer opening sweep zone in room coordinates.
 */
export function getModuleFrontSweepBounds(module: ModuleInstance): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
} | null {
  if (
    module.isOpenFront ||
    module.category === "complementary" ||
    !module.bays.some((b) => (b.door.type !== "open" && b.door.type !== "sliding") || b.drawers.length > 0)
  ) {
    return null;
  }
  const place = calculateModulePlacement(module);
  const rotY = (((module.rotation?.y ?? 0) % 360) + 360) % 360;
  const sweepDepth = Math.min(550, Math.max(350, Math.round(module.dimensions.width / Math.max(1, module.bays.length))));
  const minY = module.position.y;
  const maxY = module.position.y + module.dimensions.height;

  if (rotY === 90) {
    return {
      minX: module.position.x + place.width,
      maxX: module.position.x + place.width + sweepDepth,
      minY,
      maxY,
      minZ: module.position.z,
      maxZ: module.position.z + place.depth,
    };
  }
  if (rotY === 180) {
    return {
      minX: module.position.x,
      maxX: module.position.x + place.width,
      minY,
      maxY,
      minZ: module.position.z - sweepDepth,
      maxZ: module.position.z,
    };
  }
  if (rotY === 270) {
    return {
      minX: module.position.x - sweepDepth,
      maxX: module.position.x,
      minY,
      maxY,
      minZ: module.position.z,
      maxZ: module.position.z + place.depth,
    };
  }
  return {
    minX: module.position.x,
    maxX: module.position.x + place.width,
    minY,
    maxY,
    minZ: module.position.z + place.depth,
    maxZ: module.position.z + place.depth + sweepDepth,
  };
}

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

  let distributedRemainder = false;
  return module.bays.map((b) => {
    if (b.customWidth && b.customWidth > 0) {
      return b.customWidth;
    }
    if (!distributedRemainder) {
      distributedRemainder = true;
      return uniformWidth + remainder;
    }
    return uniformWidth;
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
 * Validates entire project including multi-module collisions, front opening sweeps, and architectural space boundaries.
 */
export function validateProject(project: DesignProject): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // 1. Module-level validations
  project.modules.forEach((mod) => {
    issues.push(...validateModule(mod));
  });

  // 2. Ceiling height & explicit architectural obstacle checks
  const ceiling = project.space.ceilingHeight || 2600;
  const allObstacles = [
    ...(project.space.elements || []),
    ...(project.space.walls || []).flatMap((w) => w.elements || []),
  ];

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

    const place = calculateModulePlacement(mod);
    const mMinX = mod.position.x;
    const mMaxX = mod.position.x + place.width;
    const mMinY = mod.position.y;
    const mMaxY = modTopY;
    const mMinZ = mod.position.z;
    const mMaxZ = mod.position.z + place.depth;

    allObstacles.forEach((obs) => {
      const oMinX = obs.position.x;
      const oMaxX = obs.position.x + obs.dimensions.width;
      const oMinY = obs.position.y;
      const oMaxY = obs.position.y + obs.dimensions.height;
      const oMinZ = obs.position.z;
      const oMaxZ = obs.position.z + obs.dimensions.depth;

      const xHit = mMinX < oMaxX - 0.001 && mMaxX > oMinX + 0.001;
      const yHit = mMinY < oMaxY - 0.001 && mMaxY > oMinY + 0.001;
      const zHit = mMinZ < oMaxZ - 0.001 && mMaxZ > oMinZ + 0.001;

      if (xHit && yHit && zHit) {
        if (obs.type === "column" || obs.type === "beam") {
          issues.push({
            severity: "error",
            code: "ERR_COLUMN_COLLISION",
            message: `Modül "${mod.name}" taşıyıcı eleman "${obs.name}" ile çakışıyor.`,
            targetId: mod.id,
            blockingProduction: true,
          });
        } else if (obs.type === "window" || obs.type === "door") {
          issues.push({
            severity: "error",
            code: obs.type === "window" ? "ERR_WINDOW_COLLISION" : "ERR_DOOR_OBSTACLE_COLLISION",
            message: `Modül "${mod.name}" mimari açıklık "${obs.name}" ile çakışıyor.`,
            targetId: mod.id,
            blockingProduction: true,
          });
        }
      }
    });
  });

  // 3. Multi-module 3D collision / overlap check (AABB) & Front Opening Sweep Collision
  for (let i = 0; i < project.modules.length; i++) {
    for (let j = i + 1; j < project.modules.length; j++) {
      const m1 = project.modules[i];
      const m2 = project.modules[j];

      const a = calculateModulePlacement(m1),
        b = calculateModulePlacement(m2);
      const xOverlap =
        m1.position.x < m2.position.x + b.width - 0.001 && m1.position.x + a.width > m2.position.x + 0.001;
      const yOverlap =
        m1.position.y < m2.position.y + m2.dimensions.height &&
        m1.position.y + m1.dimensions.height > m2.position.y;
      const zOverlap =
        m1.position.z < m2.position.z + b.depth - 0.001 && m1.position.z + a.depth > m2.position.z + 0.001;

      if (xOverlap && yOverlap && zOverlap) {
        issues.push({
          severity: "error",
          code: "ERR_MODULE_COLLISION",
          message: `"${m1.name}" ve "${m2.name}" modülleri 3D uzayda çakışıyor.`,
          targetId: `${m1.id}_${m2.id}`,
          blockingProduction: true,
        });
        continue;
      }

      const sweep1 = getModuleFrontSweepBounds(m1);
      const sweep2 = getModuleFrontSweepBounds(m2);
      const rot1 = (((m1.rotation?.y ?? 0) % 360) + 360) % 360;
      const rot2 = (((m2.rotation?.y ?? 0) % 360) + 360) % 360;

      // Check if m1's front opening sweep hits m2's solid body or vice versa
      const s1HitsM2Body =
        sweep1 &&
        yOverlap &&
        sweep1.minX < m2.position.x + b.width - 0.001 &&
        sweep1.maxX > m2.position.x + 0.001 &&
        sweep1.minZ < m2.position.z + b.depth - 0.001 &&
        sweep1.maxZ > m2.position.z + 0.001;
      const s2HitsM1Body =
        sweep2 &&
        yOverlap &&
        sweep2.minX < m1.position.x + a.width - 0.001 &&
        sweep2.maxX > m1.position.x + 0.001 &&
        sweep2.minZ < m1.position.z + a.depth - 0.001 &&
        sweep2.maxZ > m1.position.z + 0.001;
      const perpendicularSweepsIntersect =
        sweep1 &&
        sweep2 &&
        rot1 !== rot2 &&
        yOverlap &&
        sweep1.minX < sweep2.maxX - 0.001 &&
        sweep1.maxX > sweep2.minX + 0.001 &&
        sweep1.minZ < sweep2.maxZ - 0.001 &&
        sweep1.maxZ > sweep2.minZ + 0.001;

      if (s1HitsM2Body || s2HitsM1Body || perpendicularSweepsIntersect) {
        issues.push({
          severity: "warning",
          code: "WARN_FRONT_OPENING_SWEEP_COLLISION",
          message: `"${m1.name}" ve "${m2.name}" kapak/çekmece açılım süpürme hacimleri çakışıyor; köşe kör dolgu çıtası (min 50mm) veya açılış yönü kontrolü önerilir.`,
          targetId: `${m1.id}_${m2.id}`,
        });
      }
    }
  }

  return issues;
}
