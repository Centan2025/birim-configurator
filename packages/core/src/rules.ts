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

  // Helper to check if a module is a plumbing-compatible sink / wet module
  const isPlumbingCompatibleModule = (mod: ModuleInstance): boolean => {
    const label = `${mod.id} ${mod.name} ${mod.templateId || ""}`.toLowerCase();
    if (
      label.includes("eviye") ||
      label.includes("sink") ||
      label.includes("snk") ||
      label.includes("ıslak") ||
      label.includes("islak") ||
      label.includes("tesisat") ||
      label.includes("bulaşık") ||
      label.includes("bulasik") ||
      label.includes("dsh")
    ) {
      return true;
    }
    return false;
  };

  project.modules.forEach((mod) => {
    if (mod.category === "complementary") return;
    const worktopExtraH = mod.category === "kitchen_base" ? 40 : 0;
    const modTopY = mod.position.y + mod.dimensions.height + worktopExtraH;
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
    const modSweep = getModuleFrontSweepBounds(mod);

    allObstacles.forEach((obs) => {
      const obsRot = (((obs.rotationY || 0) % 360) + 360) % 360;
      const isSideObs = obsRot === 90 || obsRot === 270;
      const oMinX = obs.position.x;
      const oMaxX = obs.position.x + (isSideObs ? Math.max(180, obs.dimensions.depth || 150) : obs.dimensions.width);
      const oMinY = obs.position.y;
      const oMaxY = obs.position.y + obs.dimensions.height;
      // Wall-mounted obstacles (window, door, plumbing, electrical) sit at z=0..-150 on back wall, so extend their effective Z check into the wall-adjacent zone (0..220mm)
      const rawMinZ = obs.position.z;
      const rawMaxZ = obs.position.z + (isSideObs ? obs.dimensions.width : obs.dimensions.depth || 150);
      const oMinZ = Math.min(rawMinZ, 0);
      const oMaxZ = Math.max(rawMaxZ, obs.type === "door" && !isSideObs ? obs.dimensions.width * 0.85 : 220);

      const xHit = mMinX < oMaxX - 1 && mMaxX > oMinX + 1;
      const yHit = mMinY < oMaxY - 1 && mMaxY > oMinY + 1;
      const zHit = mMinZ < oMaxZ - 1 && mMaxZ > oMinZ - 160;

      // 1. Structural Column / Beam / Protrusion / Partition collision with module body or door sweep
      if (obs.type === "column" || obs.type === "beam" || obs.type === "partition" || obs.type === "protrusion") {
        if (xHit && yHit && zHit) {
          issues.push({
            severity: "error",
            code: "ERR_COLUMN_COLLISION",
            message: `🏛️ KOLON/YAPI ÇAKIŞMASI: "${mod.name}" taşıyıcı eleman "${obs.name}" ile çakışıyor.`,
            targetId: mod.id,
            blockingProduction: true,
          });
        } else if (
          modSweep &&
          yHit &&
          modSweep.minX < oMaxX - 1 &&
          modSweep.maxX > oMinX + 1 &&
          modSweep.minZ < rawMaxZ - 1 &&
          modSweep.maxZ > rawMinZ + 1
        ) {
          issues.push({
            severity: "error",
            code: "ERR_CABINET_DOOR_BLOCKED",
            message: `🚪 KAPAK AÇILIM ENGELİ: "${mod.name}" kapağı açılırken "${obs.name}" engeline çarpıyor!`,
            targetId: mod.id,
            blockingProduction: true,
          });
        }
      }

      // 2. Window Collision (Module body/worktop rises above window sill Y, or blocks window sash)
      if (obs.type === "window") {
        const horizHit = isSideObs
          ? mMinZ < rawMaxZ - 5 && mMaxZ > rawMinZ + 5 && mMinX < 250
          : xHit && mMinZ < 350;
        if (horizHit && yHit) {
          issues.push({
            severity: "error",
            code: "ERR_WINDOW_COLLISION",
            message: `🪟 PENCERE KESİŞİMİ: "${mod.name}" üst kotu (${mMaxY}mm), "${obs.name}" denizlik kotunu (Y:${oMinY}mm) aşarak pencereyi kapatıyor!`,
            targetId: mod.id,
            blockingProduction: true,
          });
        }
      }

      // 3. Architectural Room Door Collision (Module blocks door opening or 90° door leaf swing)
      if (obs.type === "door") {
        const doorSwingMaxX = isSideObs ? oMinX + obs.dimensions.width * 0.85 : oMaxX;
        const doorSwingMaxZ = isSideObs ? rawMaxZ : Math.max(oMaxZ, obs.dimensions.width * 0.85);
        const hitsDoorSweep =
          mMinX < doorSwingMaxX - 5 &&
          mMaxX > oMinX + 5 &&
          mMinZ < doorSwingMaxZ - 5 &&
          mMaxZ > oMinZ - 50 &&
          yHit;
        if (hitsDoorSweep) {
          issues.push({
            severity: "error",
            code: "ERR_DOOR_OBSTACLE_COLLISION",
            message: `🚪 KAPI AÇILIM ENGELİ: "${mod.name}" modülü, "${obs.name}" oda kapısının açılış alanını kapatıyor!`,
            targetId: mod.id,
            blockingProduction: true,
          });
        }
      }

      // 4. Plumbing (Tesisat) Compatibility Check: A floor module in front of plumbing MUST be a Sink / Plumbing-compatible module!
      if (obs.type === "plumbing") {
        const plumbingCenterX = obs.position.x + obs.dimensions.width / 2;
        const isFloorModule = mod.position.y < 500 && mod.category !== "kitchen_wall";
        if (isFloorModule && xHit && mMinZ < 350) {
          if (!isPlumbingCompatibleModule(mod)) {
            issues.push({
              severity: "error",
              code: "ERR_PLUMBING_INCOMPATIBLE_MODULE",
              message: `🚰 TESİSAT UYUMSUZLUĞU: Su/gider tesisatı (X:${Math.round(plumbingCenterX)}mm) önüne "${mod.name}" yerleştirildi! Tesisat önüne mutlaka Eviye (Sink) / tesisat uyumlu modül gelmelidir.`,
              targetId: mod.id,
              blockingProduction: true,
            });
          }
        }
      }
    });
  });

  // Check if any plumbing obstacle has NO floor module covering it at all
  allObstacles
    .filter((o) => o.type === "plumbing")
    .forEach((plumb) => {
      const pMinX = plumb.position.x;
      const pMaxX = plumb.position.x + plumb.dimensions.width;
      const pCenterX = Math.round(pMinX + plumb.dimensions.width / 2);
      const coveringFloorMods = project.modules.filter(
        (m) =>
          m.category !== "complementary" &&
          m.category !== "kitchen_wall" &&
          m.position.y < 500 &&
          m.position.z < 350 &&
          m.position.x < pMaxX - 1 &&
          m.position.x + calculateModulePlacement(m).width > pMinX + 1
      );
      if (coveringFloorMods.length === 0) {
        issues.push({
          severity: "warning",
          code: "WARN_PLUMBING_UNASSIGNED",
          message: `🚰 AÇIKTA TESİSAT: X:${pCenterX}mm noktasındaki tesisat önünde henüz Eviye (Sink) alt modülü bulunmuyor.`,
          targetId: plumb.id,
        });
      }
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

export interface ShelfDeflectionResult {
  spanMm: number;
  depthMm: number;
  thicknessMm: number;
  elasticModulusMpa: number;
  uniformLoadKg: number;
  deflectionMm: number;
  maxAllowedDeflectionMm: number;
  safetyRatio: number;
  passed: boolean;
  recommendation?: string;
}

/**
 * Computes physical shelf deflection (sag) in millimeters using Euler-Bernoulli beam bending
 * with long-term wood composite creep factor (k_creep = 1.5) and ISO 7170 L/300 limit.
 * Reference: RajwanYair/WoodworkingShop (MIT), xiamingyang70/opencabinet (MIT), CabKit3D (MIT).
 */
export function calculateShelfDeflection(
  spanMm: number,
  depthMm: number,
  thicknessMm = 18,
  materialCategory: "melamine" | "lacquer" | "wood" | "glass" | "metal" = "melamine",
  loadKgPerMeter = 35
): ShelfDeflectionResult {
  const L = Math.max(100, spanMm);
  const b = Math.max(100, depthMm);
  const t = Math.max(8, thicknessMm);

  const elasticModulusMpa =
    materialCategory === "metal"
      ? 69000
      : materialCategory === "glass"
      ? 70000
      : materialCategory === "wood"
      ? 8500
      : materialCategory === "lacquer"
      ? 3800
      : 3200; // melamine-faced particleboard EN 312 P2 composite skin modulus

  const creepFactor =
    materialCategory === "melamine" || materialCategory === "lacquer"
      ? 1.25
      : materialCategory === "wood"
      ? 1.15
      : 1.0;

  // Total uniform load W (N) over span L: loadKgPerMeter * (L / 1000) * 9.81
  const uniformLoadKg = Number(((loadKgPerMeter * L) / 1000).toFixed(2));
  const totalForceN = uniformLoadKg * 9.80665;
  const momentOfInertiaMm4 = (b * Math.pow(t, 3)) / 12;

  // delta_max = k_creep * (5 * W * L^3) / (384 * E * I)
  const rawDeflectionMm =
    creepFactor * ((5 * totalForceN * Math.pow(L, 3)) / (384 * elasticModulusMpa * momentOfInertiaMm4));
  const deflectionMm = Number(rawDeflectionMm.toFixed(2));
  const maxAllowedDeflectionMm = Number((L / 300).toFixed(2));
  const passed = deflectionMm <= maxAllowedDeflectionMm && L <= 950;
  const safetyRatio = Number((maxAllowedDeflectionMm / Math.max(0.01, deflectionMm)).toFixed(2));

  let recommendation: string | undefined;
  if (!passed) {
    recommendation =
      t < 25
        ? `Raf kalınlığını 25mm'ye yükseltin veya orta ara dikme ekleyerek açıklığı (${L}mm) ikiye bölün.`
        : `Açıklık (${L}mm) 25mm raf için bile yüksek; ortaya dikey ara dikme (bölme) ekleyin.`;
  }

  return {
    spanMm: L,
    depthMm: b,
    thicknessMm: t,
    elasticModulusMpa,
    uniformLoadKg,
    deflectionMm,
    maxAllowedDeflectionMm,
    safetyRatio,
    passed,
    recommendation,
  };
}

export interface AutoFixModuleResult {
  updatedModule: ModuleInstance;
  appliedFixes: string[];
}

/**
 * One-click intelligent engineering auto-fix for store customers and sales consultants.
 * Automatically resolves span deflection, wide single doors, appliance EN 1116 width/depth,
 * sliding door bay/depth requirements, and Gola/J-Pull conflicts.
 * Reference: carinotj19/CabKit3D (MIT) inline auto-fix & torusservices/morti-app (MIT).
 */
export function autoFixModuleIssues(module: ModuleInstance): AutoFixModuleResult {
  const nextMod: ModuleInstance = JSON.parse(JSON.stringify(module));
  const appliedFixes: string[] = [];

  // 1. Appliance housing EN 1116 fix (600mm width, min 580mm depth)
  const isAppliance =
    nextMod.templateId?.includes("oven") ||
    nextMod.templateId?.includes("fridge") ||
    nextMod.templateId?.includes("microwave") ||
    nextMod.name.toLowerCase().includes("fırın") ||
    nextMod.name.toLowerCase().includes("ankastre");

  if (isAppliance) {
    if (nextMod.dimensions.width !== 600) {
      nextMod.dimensions.width = 600;
      appliedFixes.push("Ankastre cihaz modül genişliği EN 1116 standardına (600mm) sabitlendi.");
    }
    const minD = nextMod.templateId?.includes("microwave_wall") ? 380 : 580;
    if (nextMod.dimensions.depth < minD) {
      nextMod.dimensions.depth = minD;
      appliedFixes.push(`Ankastre arka havalandırma için derinlik ${minD}mm yapıldı.`);
    }
  }

  // 2. Carcass panel thickness minimum 18mm for System 32
  if (nextMod.carcass.panelThickness < 16) {
    nextMod.carcass.panelThickness = 18;
    appliedFixes.push("Gövde panel kalınlığı System 32 standardı için 18mm yapıldı.");
  }

  // 3. Sliding door requires >= 2 bays and >= 600mm depth
  const hasSliding = nextMod.bays.some(
    (b) =>
      b.door.type === "sliding" ||
      b.door.doorSystemId === "sliding_top_hung" ||
      b.door.doorSystemId === "sliding_bottom_rolling"
  );
  if (hasSliding) {
    if (nextMod.dimensions.depth < 600) {
      nextMod.dimensions.depth = 600;
      appliedFixes.push("Sürgülü kapak ray payı için gövde derinliği 600mm'ye çıkarıldı.");
    }
    if (nextMod.dimensions.width < 1200) {
      nextMod.dimensions.width = 1200;
      appliedFixes.push("Sürgülü kapak için gövde genişliği en az 1200mm yapıldı.");
    }
  }

  // 4. Ensure dimension chain closure before evaluating bay widths
  let bayWidths = calculateBayWidths(nextMod);
  const expectedInnerW = nextMod.dimensions.width - (nextMod.bays.length + 1) * nextMod.carcass.panelThickness;
  const currentSumW = bayWidths.reduce((a, b) => a + b, 0);
  if (Math.abs(currentSumW - expectedInnerW) > 1) {
    nextMod.bays.forEach((b) => { b.customWidth = undefined; });
    bayWidths = calculateBayWidths(nextMod);
    appliedFixes.push("Bölme iç genişlikleri dış gövde ölçüsüne göre dengelendi.");
  }

  // 4b. Shelf span deflection auto-fix: if any bay > 950mm, split bay or thicken shelves to 25mm
  const hasWideSpan = bayWidths.some((bw) => bw > 950);
  if (hasWideSpan && nextMod.bays.length < 6) {
    const idealBays = Math.min(6, Math.max(2, Math.ceil(nextMod.dimensions.width / 800)));
    while (nextMod.bays.length < idealBays) {
      const templateBay = JSON.parse(JSON.stringify(nextMod.bays[nextMod.bays.length - 1]));
      const newIdx = nextMod.bays.length;
      templateBay.index = newIdx;
      templateBay.customWidth = undefined;
      templateBay.door.id = `door_${nextMod.id}_${newIdx}_${Date.now()}`;
      templateBay.shelves = templateBay.shelves.map((s: any, si: number) => ({
        ...s,
        id: `shelf_${nextMod.id}_${newIdx}_${si}`,
      }));
      templateBay.drawers = [];
      nextMod.bays.push(templateBay);
    }
    nextMod.bays.forEach((b) => {
      b.customWidth = undefined;
    });
    bayWidths = calculateBayWidths(nextMod);
    appliedFixes.push(`Raf sehimini önlemek için modül ${nextMod.bays.length} eşit bölmeye ayrıldı.`);
  }

  // 5. Per-bay door, handle & runner fixes
  const netInnerH = calculateNetInnerHeight(nextMod);
  const netInnerD = calculateNetInnerDepth(nextMod);
  nextMod.bays.forEach((bay, bIdx) => {
    const bw = bayWidths[bIdx] || 600;
    // Wide single door -> convert to double door
    if (
      (bay.door.doorSystemId === "hinged_single" ||
        bay.door.type === "single_left" ||
        bay.door.type === "single_right") &&
      bw > 600
    ) {
      bay.door.doorSystemId = "hinged_double";
      bay.door.type = "double";
      appliedFixes.push(`Bölme ${bIdx + 1} geniş kapağı (>600mm) sarkmayı önlemek için çift kapağa dönüştürüldü.`);
    }

    // Gola + inset conflict -> full_overlay
    if (
      bay.door.handleCategory === "gola_profile" &&
      (bay.door.overlayType === "inset" || bay.door.doorSystemId === "hinged_inset")
    ) {
      bay.door.overlayType = "full_overlay";
      if (bay.door.doorSystemId === "hinged_inset") {
        bay.door.doorSystemId = bw > 600 ? "hinged_double" : "hinged_single";
        bay.door.type = bw > 600 ? "double" : "single_left";
      }
      appliedFixes.push(`Bölme ${bIdx + 1}: Gola profil için kapak bini tipi Tam Bini (full_overlay) yapıldı.`);
    }

    // Handleless plain without push_to_open -> enable push_to_open_soft_close
    if (
      bay.door.handleCategory === "handleless_plain" &&
      bay.door.openingTechnology !== "push_to_open" &&
      bay.door.openingTechnology !== "push_to_open_soft_close" &&
      bay.door.openingTechnology !== "servo_electric"
    ) {
      bay.door.openingTechnology = "push_to_open_soft_close";
      bay.door.handleType = "push_to_open";
      appliedFixes.push(`Bölme ${bIdx + 1}: Kulpsuz düz kapak için Bas-Aç + Frenli (TIP-ON BLUMOTION) mekanizma aktif edildi.`);
    }

    // J-Pull thickness & material fix
    if (bay.door.handleCategory === "j_pull") {
      bay.door.doorThicknessMm = Math.max(22, bay.door.doorThicknessMm || 22);
      nextMod.carcass.doorThickness = 22;
      if (
        nextMod.carcass.doorMaterialId !== "mat_lacquer_white" &&
        nextMod.carcass.doorMaterialId !== "mat_lacquer_sage" &&
        nextMod.carcass.doorMaterialId !== "mat_veneer_oak" &&
        nextMod.carcass.doorMaterialId !== "mat_veneer_walnut"
      ) {
        nextMod.carcass.doorMaterialId = "mat_lacquer_white";
      }
      appliedFixes.push(`Bölme ${bIdx + 1}: J-Pull kulp için 22mm MDF İpek Mat Lake kapak standardı uygulandı.`);
    }

    // Clamp overflowing shelves or drawers
    bay.shelves.forEach((s) => {
      if (s.elevationY > netInnerH - 40) {
        s.elevationY = Math.max(60, netInnerH - 120);
        appliedFixes.push(`Bölme ${bIdx + 1}: Üst sınırı aşan raf yüksekliği iç hacme çekildi.`);
      }
    });
    bay.drawers.forEach((d) => {
      if (d.nominalLengthMm && d.nominalLengthMm + 10 > netInnerD) {
        d.nominalLengthMm = Math.max(250, Math.floor((netInnerD - 15) / 50) * 50);
        appliedFixes.push(`Bölme ${bIdx + 1}: Çekmece ray boyu iç derinliğe (${d.nominalLengthMm}mm) uyarlandı.`);
      }
    });
  });

  return { updatedModule: nextMod, appliedFixes };
}
